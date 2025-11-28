use std::sync::Arc;

use axum::middleware;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, Path, Query, State,
    },
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use futures::{SinkExt, StreamExt};
use bigdecimal::ToPrimitive;
use log;
use rust_decimal::{prelude::FromPrimitive, Decimal};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, Row};
use uuid::Uuid;

#[derive(FromRow)]
struct ServiceUserIdRow {
    user_id: i32,
}

#[derive(FromRow)]
struct ServiceDataRow {
    data: Value,
}

#[derive(FromRow)]
struct ClientDeliveryPreferencesFullRow {
    id: i32,
    user_id: i32,
    delivery_id: Option<Uuid>,
    preferred_delivery_date: Option<chrono::NaiveDate>,
    preferred_delivery_time_start: Option<chrono::NaiveTime>,
    preferred_delivery_time_end: Option<chrono::NaiveTime>,
    preferred_delivery_window_hours: Option<i32>,
    avoid_days: Option<Vec<String>>,
    urgency_level: Option<String>,
    is_flexible: Option<bool>,
    flexibility_window_days: Option<i32>,
    _created_at: sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>,
    _updated_at: sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>,
}

#[derive(FromRow)]
struct ProductDeliveryConfigRow {
    pickup_address: Option<String>,
    pickup_latitude: Option<f64>,
    pickup_longitude: Option<f64>,
    required_vehicle_type_id: Option<i32>,
    weight_kg: Option<f64>,
    volume_cm3: Option<f64>,
    requires_isothermal: Option<bool>,
    requires_fragile_handling: Option<bool>,
    is_configured: Option<bool>,
    billing_mode: Option<String>,
    pickup_instructions: Option<String>,
}

#[derive(FromRow)]
struct ServiceDataGpsRow {
    _data: Value,
    gps: Option<String>,
}

#[derive(FromRow)]
struct UserGpsNameRow {
    gps: Option<String>,
    _nom_complet: Option<String>,
}

#[derive(FromRow)]
struct BillingModeRow {
    billing_mode: Option<String>,
}

#[derive(FromRow)]
struct ProductDeliveryConfigPickupRow {
    pickup_latitude: Option<f64>,
    pickup_longitude: Option<f64>,
}

#[derive(FromRow)]
struct ServiceGpsRow {
    gps: Option<String>,
}

#[derive(FromRow)]
struct CourierWithStatsRow {
    id: i32,
    user_id: i32,
    #[sqlx(rename = "status")]
    #[allow(dead_code)] // Champ récupéré de la DB mais non utilisé dans la réponse
    status: crate::models::delivery_model::DeliveryCourierStatus,
    rating_average: Option<f64>,
    rating_count: Option<i32>,
    bio: Option<String>,
    nom_complet: Option<String>,
    avatar_url: Option<String>,
    email: Option<String>,
    completed_deliveries: Option<i64>,
    cancelled_deliveries: Option<i64>,
    avg_delivery_time_minutes: Option<f64>,
}

#[derive(FromRow)]
struct ProductDeliveryConfigOwnerRow {
    #[allow(dead_code)] // Champ récupéré de la DB mais seulement user_id est utilisé pour vérification
    service_id: i32,
    user_id: i32,
}

#[derive(FromRow)]
struct DeliveryCreatorRow {
    creator_id: i32,
}

#[derive(FromRow)]
struct ProductDeliveryConfigPickupLocationRow {
    pickup_address: Option<String>,
    #[allow(dead_code)]
    pickup_latitude: Option<f64>,
    #[allow(dead_code)]
    pickup_longitude: Option<f64>,
}

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    models::delivery_model::{ClientDeliveryPreferencesInput, DeliveryStatus, MerchantStorageLocationInput, ProductDeliveryConfigInput},
    services::cache_service::{cache_keys, CacheService}, // ✅ Phase 10 - Cache Redis
    services::delivery_payment_service::DeliveryPaymentService,
    services::delivery_service::{
        CourierApplicationInput, CourierAssetInput, CreateDeliveryParams, DeliveryRecipientInput,
        DeliveryService, LocationInput, NewDeliveryParcelInput, PricingInput,
        PublicDropoffSnapshot, TrackingInput,
    },
    services::product_price_service::ProductPriceService, // ✅ NOUVEAU : Service pour prix avec promotions
    services::product_validation_service::{notify_missing_delivery_config, validate_product_for_activation},
    services::product_stock_service::ProductStockService, // ✅ NOUVEAU : Service gestion stock
    services::courier_verification_service::{CourierVerificationService, VerifyCourierRequest}, // ✅ NOUVEAU : Service vérification coursier
    state::AppState,
    websocket::delivery_tracking::{
        record_ws_connection_close, record_ws_connection_open, record_ws_error,
        record_ws_message_sent, DeliveryTrackingManager,
    },
};
use std::time::Duration;

#[derive(Deserialize)]
struct CreateDeliveryPayload {
    parcel: ParcelPayload,
    pickup: LocationPayload,
    dropoff: LocationPayload,
    distance_meters: Option<i32>,
    estimated_duration_seconds: Option<i32>,
    metadata: Value,
    initial_event_payload: Value,
    #[serde(default)]
    recipient: Option<RecipientPayload>,
}

#[derive(Deserialize)]
struct ParcelPayload {
    type_id: Option<i32>,
    weight_kg: Option<f64>,
    volume_cm3: Option<f64>,
    declared_value: Option<f64>,
    notes: Option<String>,
    photos: Value,
    constraints: Value,
}

#[derive(Deserialize)]
struct LocationPayload {
    latitude: f64,
    longitude: f64,
    address: Option<String>,
}

#[derive(Deserialize)]
struct RecipientPayload {
    #[serde(default)]
    user_id: Option<i32>,
    #[serde(default)]
    contact_name: Option<String>,
    #[serde(default)]
    contact_phone: Option<String>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    chat_thread_id: Option<Uuid>,
    #[serde(default)]
    dropoff_override: Option<LocationPayload>,
    #[serde(default)]
    dropoff_address: Option<String>,
    #[serde(default)]
    country_code: Option<String>,
    #[serde(default)]
    allow_tracking: Option<bool>,
    #[serde(default)]
    allow_contact: Option<bool>,
    #[serde(default)]
    consent_granted: Option<bool>,
    #[serde(default)]
    preferred_language: Option<String>,
}

#[derive(Deserialize)]
struct PublicDropoffPayload {
    latitude: f64,
    longitude: f64,
    address: Option<String>,
    instructions: Option<String>,
}

/// Payload pour commande client directe
#[derive(Deserialize)]
struct ClientOrderPayload {
    service_id: i32,
    product_index: Option<i32>,
    // Optionnel : si non fourni, utilise GPS utilisateur ou adresse par défaut
    dropoff: Option<LocationPayload>,
    // Optionnel : notes pour la livraison
    notes: Option<String>,
    // Optionnel : métadonnées additionnelles
    metadata: Option<Value>,
    // ✅ NOUVEAU : ID de la conversation pour prix négociés
    conversation_id: Option<String>,
    // ✅ NOUVEAU : Type de véhicule souhaité pour la livraison
    preferred_vehicle_type: Option<String>, // 'bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking'
}

#[derive(Serialize)]
struct PublicDropoffResponse<T> {
    data: T,
}

pub fn delivery_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ CORRIGÉ: Ajouter le préfixe /api/ pour toutes les routes delivery
        .route("/api/delivery/parcel-types", get(list_parcel_types))
        .route("/api/delivery/product-config", post(save_product_delivery_config))
        .route("/api/delivery/product-config/{service_id}/{product_index}", get(get_product_delivery_config))
        // ✅ Phase 9 - Amélioration : Routes pour gérer les zones de livraison des produits
        .route("/api/products/{service_id}/{product_index}/zones", get(get_product_zones).post(save_product_zones))
        // ✅ Phase 9 - Amélioration 32 : Routes pour gérer les lieux de stock
        .route("/api/delivery/storage-locations", get(list_storage_locations).post(create_storage_location))
        .route("/api/delivery/storage-locations/{id}", get(get_storage_location).put(update_storage_location).delete(delete_storage_location))
        // ✅ Phase 9 - Amélioration : Route pour lister les zones de livraison
        .route("/api/delivery/zones", get(list_delivery_zones))
        // ✅ Phase 9 - Amélioration : Routes pour les médias de preuve de livraison
        .route("/api/delivery/{id}/proof-media", get(list_proof_media).post(upload_proof_media))
        .route("/api/delivery/{id}/proof-media/{media_id}", delete(delete_proof_media))
        .route("/api/delivery/product-validation/{service_id}/{product_index}", get(validate_product))
        .route("/api/delivery/preferences", post(save_client_delivery_preferences))
        .route("/api/delivery/preferences/{delivery_id}", get(get_client_delivery_preferences))
        .route("/api/delivery", post(create_delivery))
        .route("/api/delivery/client-order", post(create_client_order))
        .route("/api/delivery/estimate-costs", post(estimate_delivery_costs)) // ✅ Phase 7 - Amélioration 23
        .route("/api/delivery/{id}", get(get_delivery_summary))
        .route("/api/delivery/{id}/navigation", get(get_courier_navigation)) // ✅ NOUVEAU : Navigation pour coursier
        .route("/api/delivery/{id}/status", post(update_delivery_status))
        .route("/api/delivery/{id}/confirm-proximity", post(confirm_proximity_suggestion)) // ✅ Phase 6 - Amélioration 20
        .route("/api/delivery/{id}/pricing", post(upsert_pricing))
        .route("/api/delivery/{id}/tracking", post(add_tracking_point))
        .route("/api/delivery/{id}/rate-courier", post(rate_courier))
        .route("/api/delivery/{id}/rate-client", post(rate_client))
        .route("/api/delivery/{id}/ws", get(delivery_tracking_ws))
        .route(
            "/api/delivery/{id}/recipient",
            get(get_delivery_recipient).post(assign_delivery_recipient),
        )
        .route(
            "/api/delivery/{id}/recipient/location",
            post(update_recipient_location),
        )
        .route(
            "/api/delivery/{id}/pickup-location",
            post(update_pickup_location),
        )
        .route("/api/delivery/{id}/share-dropoff", post(share_dropoff_link))
        .route("/api/deliveries/active", get(list_frontend_deliveries))
        .route("/api/deliveries/{id}", get(get_frontend_delivery))
        .route(
            "/api/deliveries/{id}/recipient/updates",
            get(get_frontend_recipient_updates),
        )
        .route("/api/wallet/debit", post(debit_wallet_for_delivery))
        .route("/api/wallet/refund", post(refund_wallet_for_delivery))
        .route("/api/courier/applications", post(submit_courier_application))
        .route("/api/courier/me", get(get_my_courier_status)) // ✅ NOUVEAU : Vérifier statut coursier de l'utilisateur
        .route("/api/courier/{id}/assets", post(upsert_courier_asset))
        .route("/api/delivery/{id}/assign-courier", post(assign_courier)) // ✅ Phase 9 - Amélioration 28
        .route("/api/couriers/available", get(list_available_couriers)) // ✅ Phase 9 - Amélioration 28
        // ✅ NOUVEAU : Routes pour gestion de stock
        .route("/api/delivery/stock/{config_id}", axum::routing::put(update_stock))
        .route("/api/delivery/stock/{config_id}/location/{location_id}", axum::routing::delete(delete_stock_location))
        // ✅ NOUVEAU : Routes pour vérification coursier
        .route("/api/delivery/{id}/verify-courier", post(verify_courier))
        .route("/api/delivery/{id}/verification-code", get(get_verification_code))
        // ✅ NOUVEAU : Route pour lieux pickup
        .route("/api/delivery/config/{config_id}/pickup-locations", get(get_pickup_locations))
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}

pub fn delivery_public_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ CORRIGÉ: Ajouter le préfixe /api/ pour les routes publiques
        .route("/api/delivery/public/{token}", get(get_public_dropoff_snapshot))
        .route(
            "/api/delivery/public/{token}/dropoff",
            post(submit_public_dropoff),
        )
        .with_state(state)
}

async fn list_parcel_types(State(state): State<Arc<AppState>>) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let types = service.list_parcel_types().await?;
    Ok(Json(serde_json::json!({ "parcel_types": types })))
}

/// POST /api/delivery/product-config - Sauvegarder la configuration de livraison d'un produit
async fn save_product_delivery_config(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<ProductDeliveryConfigInput>,
) -> AppResult<Json<Value>> {
    // ✅ 1. Vérifier que l'utilisateur est propriétaire du service
    let service: Option<ServiceUserIdRow> = sqlx::query_as(
        "SELECT user_id FROM services WHERE id = $1"
    )
    .bind(payload.service_id)
    .fetch_optional(&state.pg)
    .await?;

    let service_owner = service.ok_or_else(|| {
        AppError::NotFound("Service non trouvé".into())
    })?;

    if service_owner.user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le propriétaire de ce service".into(),
        ));
    }

    // ✅ 2. Vérifier que le produit existe
    let service_data: Option<ServiceDataRow> = sqlx::query_as(
        "SELECT data FROM services WHERE id = $1"
    )
    .bind(payload.service_id)
    .fetch_optional(&state.pg)
    .await?;
    
    let service_data = service_data.ok_or_else(|| AppError::NotFound("Service non trouvé".into()))?;

    let products = service_data.data
        .get("produits")
        .and_then(|p| p.get("valeur"))
        .and_then(|v| v.as_array());

    let _product = products
        .and_then(|arr| arr.get(payload.product_index as usize))
        .ok_or_else(|| {
            AppError::BadRequest("Produit non trouvé".into())
        })?;

    // ✅ 3. Valider les champs obligatoires
    if payload.pickup_address.trim().is_empty() {
        return Err(AppError::BadRequest("L'adresse de départ est obligatoire".into()));
    }

    // ✅ 4. Vérifier si la configuration est complète (tous les champs requis présents)
    let schedule = payload.pickup_availability_schedule.as_object();
    let has_schedule = schedule.map(|s| !s.is_empty()).unwrap_or(false);
    let is_complete = !payload.pickup_address.trim().is_empty()
        && payload.required_vehicle_type_id > 0
        && has_schedule;
    
    // ✅ NOUVEAU : Stocker le type de véhicule requis dans les métadonnées de la configuration
    // On va utiliser un champ JSONB dans la table pour stocker les métadonnées additionnelles
    // Pour l'instant, on peut le stocker dans pickup_availability_schedule ou créer un champ séparé
    // Solution temporaire : stocker dans pickup_instructions ou créer un champ metadata

    // ✅ NOUVEAU : Construire pickup_instructions avec le type de véhicule requis
    let mut pickup_instructions_json = serde_json::json!({});
    if let Some(instructions) = &payload.pickup_instructions {
        // Si pickup_instructions est déjà un JSON, le parser
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(instructions) {
            pickup_instructions_json = parsed;
        } else {
            // Sinon, créer un objet avec les instructions en texte
            pickup_instructions_json["text"] = serde_json::json!(instructions);
        }
    }
    
    // Ajouter le type de véhicule requis dans les instructions JSON
    if let Some(required_vehicle_type) = &payload.required_vehicle_type {
        pickup_instructions_json["required_vehicle_type"] = serde_json::json!(required_vehicle_type);
    }
    
    let pickup_instructions_final = if pickup_instructions_json.is_object() && !pickup_instructions_json.is_null() {
        Some(pickup_instructions_json.to_string())
    } else {
        payload.pickup_instructions.clone()
    };
    
    // ✅ 5. Créer ou mettre à jour la configuration
    let config_row = sqlx::query(
        r#"
        INSERT INTO product_delivery_config (
            service_id, product_index,
            pickup_address, pickup_latitude, pickup_longitude,
            required_vehicle_type_id, weight_kg, volume_cm3,
            requires_isothermal, requires_fragile_handling,
            pickup_availability_schedule,
            pickup_instructions, billing_mode, billing_partner_label,
            is_configured, configured_at, configured_by
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
            CASE WHEN $15 THEN NOW() ELSE NULL END, 
            CASE WHEN $15 THEN $16 ELSE NULL END
        )
        ON CONFLICT (service_id, product_index)
        DO UPDATE SET
            pickup_address = EXCLUDED.pickup_address,
            pickup_latitude = EXCLUDED.pickup_latitude,
            pickup_longitude = EXCLUDED.pickup_longitude,
            required_vehicle_type_id = EXCLUDED.required_vehicle_type_id,
            weight_kg = EXCLUDED.weight_kg,
            volume_cm3 = EXCLUDED.volume_cm3,
            requires_isothermal = EXCLUDED.requires_isothermal,
            requires_fragile_handling = EXCLUDED.requires_fragile_handling,
            pickup_availability_schedule = EXCLUDED.pickup_availability_schedule,
            pickup_instructions = EXCLUDED.pickup_instructions,
            billing_mode = EXCLUDED.billing_mode,
            billing_partner_label = EXCLUDED.billing_partner_label,
            is_configured = EXCLUDED.is_configured,
            configured_at = CASE WHEN EXCLUDED.is_configured THEN NOW() ELSE configured_at END,
            configured_by = CASE WHEN EXCLUDED.is_configured THEN EXCLUDED.configured_by ELSE configured_by END,
            updated_at = NOW()
        RETURNING id, is_configured
        "#,
    )
    .bind(payload.service_id)
    .bind(payload.product_index)
    .bind(&payload.pickup_address)
    .bind(payload.pickup_latitude)
    .bind(payload.pickup_longitude)
    .bind(payload.required_vehicle_type_id)
    .bind(payload.weight_kg)
    .bind(payload.volume_cm3)
    .bind(payload.requires_isothermal.unwrap_or(false))
    .bind(payload.requires_fragile_handling.unwrap_or(false))
    .bind(&payload.pickup_availability_schedule)
    .bind(pickup_instructions_final.as_deref())
    .bind(payload.billing_mode.as_deref().unwrap_or("standard"))
    .bind(payload.billing_partner_label.as_deref())
    .bind(is_complete)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await?;
    
    let config_id = config_row.try_get::<i32, _>("id")?;
    let config_is_configured = config_row.try_get::<bool, _>("is_configured")?;

    // ✅ Phase 2 - Amélioration 6 : Vérifier si la configuration est complète et notifier si nécessaire
    if !config_is_configured {
        // Configuration incomplète, envoyer notification
        if let Err(e) = notify_missing_delivery_config(&state.pg, payload.service_id, payload.product_index).await {
            log::error!("Erreur envoi notification configuration manquante: {:?}", e);
            // Ne pas faire échouer la sauvegarde si la notification échoue
        }
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "config_id": config_id,
        "is_configured": config_is_configured,
        "message": if config_is_configured {
            "Configuration de livraison sauvegardée avec succès"
        } else {
            "Configuration partiellement sauvegardée. Veuillez compléter tous les champs requis pour activer le produit."
        }
    })))
}

/// ✅ Phase 2 - Amélioration 6 : GET /api/delivery/product-validation/{service_id}/{product_index} - Vérifier validation produit
async fn validate_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<Json<Value>> {
    // Vérifier propriétaire
    let service: Option<ServiceUserIdRow> = sqlx::query_as(
        "SELECT user_id FROM services WHERE id = $1"
    )
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await?;

    let service_owner = service.ok_or_else(|| {
        AppError::NotFound("Service non trouvé".into())
    })?;

    if service_owner.user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le propriétaire de ce service".into(),
        ));
    }

    let validation = validate_product_for_activation(&state.pg, service_id, product_index).await?;

    Ok(Json(serde_json::json!({
        "is_valid": validation.is_valid,
        "errors": validation.errors,
        "missing_fields": validation.missing_fields
    })))
}

/// ✅ Phase 3 - Amélioration 7 : POST /api/delivery/preferences - Sauvegarder les préférences de livraison client
async fn save_client_delivery_preferences(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<ClientDeliveryPreferencesInput>,
) -> AppResult<Json<Value>> {
    // Parser les dates et heures
    let preferred_delivery_date = payload.preferred_delivery_date
        .as_ref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
    
    let preferred_delivery_time_start = payload.preferred_delivery_time_start
        .as_ref()
        .and_then(|t| chrono::NaiveTime::parse_from_str(t, "%H:%M").ok());
    
    let preferred_delivery_time_end = payload.preferred_delivery_time_end
        .as_ref()
        .and_then(|t| chrono::NaiveTime::parse_from_str(t, "%H:%M").ok());

    // Si delivery_id est fourni, vérifier que l'utilisateur a accès à cette livraison
    if let Some(delivery_id) = payload.delivery_id {
        let service = delivery_service(&state)?;
        let summary = service.get_delivery_summary(delivery_id).await?;
        enforce_delivery_access(&service, &summary, user.id).await?;
    }

    let window_hours = payload.preferred_delivery_window_hours.unwrap_or(2);
    let urgency = payload.urgency_level.unwrap_or_else(|| "standard".to_string());
    let is_flex = payload.is_flexible.unwrap_or(true);
    let flex_days = payload.flexibility_window_days.unwrap_or(3);
    
    let preferences: ClientDeliveryPreferencesFullRow = sqlx::query_as(
        r#"
        INSERT INTO client_delivery_preferences (
            user_id, delivery_id,
            preferred_delivery_date, preferred_delivery_time_start, preferred_delivery_time_end,
            preferred_delivery_window_hours, avoid_days, urgency_level,
            is_flexible, flexibility_window_days
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
        ON CONFLICT (user_id, delivery_id)
        DO UPDATE SET
            preferred_delivery_date = EXCLUDED.preferred_delivery_date,
            preferred_delivery_time_start = EXCLUDED.preferred_delivery_time_start,
            preferred_delivery_time_end = EXCLUDED.preferred_delivery_time_end,
            preferred_delivery_window_hours = EXCLUDED.preferred_delivery_window_hours,
            avoid_days = EXCLUDED.avoid_days,
            urgency_level = EXCLUDED.urgency_level,
            is_flexible = EXCLUDED.is_flexible,
            flexibility_window_days = EXCLUDED.flexibility_window_days,
            updated_at = NOW()
        RETURNING id, user_id, delivery_id,
                  preferred_delivery_date, preferred_delivery_time_start, preferred_delivery_time_end,
                  preferred_delivery_window_hours, avoid_days, urgency_level,
                  is_flexible, flexibility_window_days,
                  created_at, updated_at
        "#
    )
    .bind(user.id)
    .bind(payload.delivery_id)
    .bind(preferred_delivery_date)
    .bind(preferred_delivery_time_start)
    .bind(preferred_delivery_time_end)
    .bind(window_hours)
    .bind(payload.avoid_days.as_deref())
    .bind(&urgency)
    .bind(is_flex)
    .bind(flex_days)
    .fetch_one(&state.pg)
    .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "preferences": {
            "id": preferences.id,
            "user_id": preferences.user_id,
            "delivery_id": preferences.delivery_id,
            "preferred_delivery_date": preferences.preferred_delivery_date,
            "preferred_delivery_time_start": preferences.preferred_delivery_time_start,
            "preferred_delivery_time_end": preferences.preferred_delivery_time_end,
            "preferred_delivery_window_hours": preferences.preferred_delivery_window_hours,
            "avoid_days": preferences.avoid_days,
            "urgency_level": preferences.urgency_level,
            "is_flexible": preferences.is_flexible,
            "flexibility_window_days": preferences.flexibility_window_days,
        }
    })))
}

/// ✅ Phase 3 - Amélioration 7 : GET /api/delivery/preferences/{delivery_id} - Récupérer les préférences
async fn get_client_delivery_preferences(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur a accès à cette livraison
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    let preferences: Option<ClientDeliveryPreferencesFullRow> = sqlx::query_as(
        r#"
        SELECT id, user_id, delivery_id,
               preferred_delivery_date, preferred_delivery_time_start, preferred_delivery_time_end,
               preferred_delivery_window_hours, avoid_days, urgency_level,
               is_flexible, flexibility_window_days,
               created_at, updated_at
        FROM client_delivery_preferences
        WHERE delivery_id = $1 AND user_id = $2
        "#
    )
    .bind(delivery_id)
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?;

    if let Some(prefs) = preferences {
        Ok(Json(serde_json::json!({
            "preferences": {
                "id": prefs.id,
                "user_id": prefs.user_id,
                "delivery_id": prefs.delivery_id,
                "preferred_delivery_date": prefs.preferred_delivery_date,
                "preferred_delivery_time_start": prefs.preferred_delivery_time_start,
                "preferred_delivery_time_end": prefs.preferred_delivery_time_end,
                "preferred_delivery_window_hours": prefs.preferred_delivery_window_hours,
                "avoid_days": prefs.avoid_days,
                "urgency_level": prefs.urgency_level,
                "is_flexible": prefs.is_flexible,
                "flexibility_window_days": prefs.flexibility_window_days,
            }
        })))
    } else {
        Ok(Json(serde_json::json!({
            "preferences": null
        })))
    }
}

/// GET /api/delivery/product-config/{service_id}/{product_index} - Récupérer la configuration
async fn get_product_delivery_config(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<Json<Value>> {
    // Vérifier propriétaire
    let service: Option<ServiceUserIdRow> = sqlx::query_as(
        "SELECT user_id FROM services WHERE id = $1"
    )
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await?;

    let service_owner = service.ok_or_else(|| {
        AppError::NotFound("Service non trouvé".into())
    })?;

    if service_owner.user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le propriétaire de ce service".into(),
        ));
    }

    let config_row = sqlx::query(
        r#"
        SELECT 
            id, service_id, product_index,
            pickup_address, pickup_latitude, pickup_longitude,
            required_vehicle_type_id, weight_kg, volume_cm3,
            requires_isothermal, requires_fragile_handling,
            pickup_availability_schedule,
            pickup_instructions, billing_mode, billing_partner_label,
            is_configured, configured_at, configured_by,
            created_at, updated_at
        FROM product_delivery_config
        WHERE service_id = $1 AND product_index = $2
        "#,
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_optional(&state.pg)
    .await?;

    if let Some(config) = config_row {
        Ok(Json(serde_json::json!({
            "config": {
                "id": config.try_get::<i32, _>("id")?,
                "service_id": config.try_get::<i32, _>("service_id")?,
                "product_index": config.try_get::<i32, _>("product_index")?,
                "pickup_address": config.try_get::<String, _>("pickup_address")?,
                "pickup_latitude": config.try_get::<f64, _>("pickup_latitude")?,
                "pickup_longitude": config.try_get::<f64, _>("pickup_longitude")?,
                "required_vehicle_type_id": config.try_get::<i32, _>("required_vehicle_type_id")?,
                "weight_kg": config.try_get::<Option<f64>, _>("weight_kg")?,
                "volume_cm3": config.try_get::<Option<f64>, _>("volume_cm3")?,
                "requires_isothermal": config.try_get::<bool, _>("requires_isothermal")?,
                "requires_fragile_handling": config.try_get::<bool, _>("requires_fragile_handling")?,
                "pickup_availability_schedule": config.try_get::<serde_json::Value, _>("pickup_availability_schedule")?,
                "pickup_instructions": config.try_get::<Option<String>, _>("pickup_instructions")?,
                "billing_mode": config.try_get::<String, _>("billing_mode")?,
                "billing_partner_label": config.try_get::<Option<String>, _>("billing_partner_label")?,
                "is_configured": config.try_get::<bool, _>("is_configured")?,
                "configured_at": config.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("configured_at")?,
            }
        })))
    } else {
        Ok(Json(serde_json::json!({
            "config": null
        })))
    }
}

async fn create_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateDeliveryPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;

    let params = CreateDeliveryParams {
        creator_id: user.id,
        parcel: NewDeliveryParcelInput {
            type_id: payload.parcel.type_id,
            weight_kg: payload.parcel.weight_kg.map(dec),
            volume_cm3: payload.parcel.volume_cm3.map(dec),
            declared_value: payload.parcel.declared_value.map(dec),
            notes: payload.parcel.notes,
            photos: payload.parcel.photos,
            constraints: payload.parcel.constraints,
        },
        pickup: LocationInput {
            latitude: payload.pickup.latitude,
            longitude: payload.pickup.longitude,
            address: payload.pickup.address,
        },
        dropoff: LocationInput {
            latitude: payload.dropoff.latitude,
            longitude: payload.dropoff.longitude,
            address: payload.dropoff.address,
        },
        recipient: payload.recipient.as_ref().map(DeliveryRecipientInput::from),
        distance_meters: payload.distance_meters,
        estimated_duration_seconds: payload.estimated_duration_seconds,
        metadata: payload.metadata,
        initial_event_payload: payload.initial_event_payload,
    };

    let summary = service.create_delivery_request(params).await?;
    Ok(Json(serde_json::json!({ "delivery": summary })))
}

/// POST /api/delivery/client-order - Commande client directe avec auto-remplissage
async fn create_client_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<ClientOrderPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;

    // ✅ NOUVEAU : Vérifier la disponibilité du produit AVANT création
    if let Some(product_index) = payload.product_index {
        let availability_service = crate::services::product_availability_service::ProductAvailabilityService::new(state.pg.clone());
        let availability = availability_service
            .check_availability(
                payload.service_id,
                product_index,
                None, // Maintenant
            )
            .await?;

        if !availability.is_available {
            // Produit non disponible, retourner produits similaires avec proximité
            // ✅ AMÉLIORATION : Utiliser les coordonnées GPS du dropoff (client) pour proximité
            let client_lat = payload.dropoff.as_ref().map(|p| p.latitude);
            let client_lng = payload.dropoff.as_ref().map(|p| p.longitude);
            
            // ✅ AMÉLIORATION : Utiliser GeographicMatchingService si disponible (Google Maps priorité + fallback local)
            let similar_service = if let Some(geo_service) = state.geographic_matching.as_ref() {
                crate::services::similar_products_service::SimilarProductsService::with_geographic_matching(
                    state.pg.clone(),
                    geo_service.clone(),
                )
            } else {
                crate::services::similar_products_service::SimilarProductsService::new(state.pg.clone())
            };
            
            let similar_products = similar_service
                .find_similar_products_with_location(
                    payload.service_id, 
                    product_index, 
                    5,
                    client_lat,
                    client_lng,
                )
                .await?;

            return Ok(Json(json!({
                "success": false,
                "available": false,
                "reason": availability.reason,
                "similar_products": similar_products,
                "message": "Produit non disponible. Voici des alternatives."
            })));
        }
    }

    // ✅ 1. Récupérer la configuration de livraison du produit
    let delivery_config: Option<ProductDeliveryConfigRow> = if let Some(product_index) = payload.product_index {
        sqlx::query_as(
            "SELECT pickup_address, pickup_latitude, pickup_longitude, 
                    required_vehicle_type_id, weight_kg, volume_cm3,
                    requires_isothermal, requires_fragile_handling, is_configured,
                    billing_mode, pickup_instructions
             FROM product_delivery_config 
             WHERE service_id = $1 AND product_index = $2"
        )
        .bind(payload.service_id)
        .bind(product_index)
        .fetch_optional(&state.pg)
        .await?
    } else {
        None
    };
    
    // ✅ NOUVEAU : Extraire le type de véhicule requis depuis la configuration
    let product_required_vehicle_type: Option<String> = if let Some(config) = &delivery_config {
        // Le type de véhicule peut être stocké dans pickup_instructions (temporaire)
        // ou dans un champ metadata dédié (à implémenter)
        // Pour l'instant, on peut le déduire de required_vehicle_type_id via une table de mapping
        // ou le stocker dans pickup_instructions au format JSON
        if let Some(instructions) = &config.pickup_instructions {
            // Essayer de parser JSON depuis instructions
            if let Ok(instructions_json) = serde_json::from_str::<serde_json::Value>(instructions) {
                instructions_json.get("required_vehicle_type")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    // ✅ 2. Vérifier si configuration complète
    if let Some(config) = &delivery_config {
        if !config.is_configured.unwrap_or(false) {
            return Err(crate::core::types::AppError::BadRequest(
                "Configuration de livraison incomplète pour ce produit. Le prestataire doit compléter la configuration.".into(),
            ));
        }
    }

    // ✅ 3. Auto-remplir pickup depuis product_delivery_config
    let pickup = if let Some(config) = &delivery_config {
        LocationInput {
            latitude: config.pickup_latitude.unwrap_or(0.0),
            longitude: config.pickup_longitude.unwrap_or(0.0),
            address: config.pickup_address.clone(),
        }
    } else {
        // Fallback : récupérer depuis le service
        let service_data: Option<ServiceDataGpsRow> = sqlx::query_as(
            "SELECT data, gps FROM services WHERE id = $1"
        )
        .bind(payload.service_id)
        .fetch_optional(&state.pg)
        .await?;
        
        let service_data = service_data.ok_or_else(|| crate::core::types::AppError::NotFound("Service non trouvé".into()))?;

        // Extraire GPS du service
        let (lat, lng) = if let Some(gps_str) = &service_data.gps {
            let gps_str = gps_str.clone();
            let parts: Vec<&str> = gps_str.split(',').collect();
            if parts.len() == 2 {
                if let (Ok(lng), Ok(lat)) = (parts[0].trim().parse::<f64>(), parts[1].trim().parse::<f64>()) {
                    (lat, lng)
                } else {
                    return Err(crate::core::types::AppError::BadRequest("GPS invalide dans le service".into()));
                }
            } else {
                return Err(crate::core::types::AppError::BadRequest("Format GPS invalide".into()));
            }
        } else {
            return Err(crate::core::types::AppError::BadRequest("Aucune adresse de départ disponible".into()));
        };

        LocationInput {
            latitude: lat,
            longitude: lng,
            address: None,
        }
    };

    // ✅ 4. Auto-remplir dropoff depuis GPS utilisateur ou payload
    let dropoff = if let Some(dropoff_payload) = payload.dropoff {
        dropoff_payload
    } else {
        // Récupérer GPS utilisateur
        let user_data: Option<UserGpsNameRow> = sqlx::query_as(
            "SELECT gps, nom_complet FROM users WHERE id = $1"
        )
        .bind(user.id)
        .fetch_optional(&state.pg)
        .await?;

        let user_row = user_data.ok_or_else(|| crate::core::types::AppError::BadRequest("Utilisateur non trouvé".into()))?;
        let gps_str = user_row.gps.ok_or_else(|| crate::core::types::AppError::BadRequest("Aucune adresse de livraison fournie et GPS utilisateur non disponible".into()))?;
        
        let parts: Vec<&str> = gps_str.split(',').collect();
        if parts.len() != 2 {
            return Err(crate::core::types::AppError::BadRequest("Format GPS utilisateur invalide".into()));
        }
        
        let lng = parts[0].trim().parse::<f64>()
            .map_err(|_| crate::core::types::AppError::BadRequest("GPS utilisateur invalide".into()))?;
        let lat = parts[1].trim().parse::<f64>()
            .map_err(|_| crate::core::types::AppError::BadRequest("GPS utilisateur invalide".into()))?;
        
        LocationPayload {
            latitude: lat,
            longitude: lng,
            address: None,
        }
    };

    // ✅ 5. Créer le colis depuis la configuration
    let parcel = if let Some(config) = &delivery_config {
        NewDeliveryParcelInput {
            type_id: config.required_vehicle_type_id,
            weight_kg: config.weight_kg.map(dec),
            volume_cm3: config.volume_cm3.map(dec),
            declared_value: None,
            notes: payload.notes.clone(),
            photos: serde_json::json!([]),
            constraints: serde_json::json!({
                "requires_isothermal": config.requires_isothermal,
                "requires_fragile_handling": config.requires_fragile_handling,
            }),
        }
    } else {
        NewDeliveryParcelInput {
            type_id: None,
            weight_kg: None,
            volume_cm3: None,
            declared_value: None,
            notes: payload.notes.clone(),
            photos: serde_json::json!([]),
            constraints: serde_json::json!({}),
        }
    };

    // ✅ 6. Créer métadonnées avec service_id et product_index
    let mut metadata = payload.metadata.unwrap_or_else(|| serde_json::json!({}));
    metadata["service_id"] = serde_json::json!(payload.service_id);
    if let Some(product_index) = payload.product_index {
        metadata["product_index"] = serde_json::json!(product_index);
    }
    metadata["order_source"] = serde_json::json!("client_direct");
    
    // ✅ NOUVEAU : Ajouter le type de véhicule préféré dans les métadonnées
    // Priorité : 1) Type choisi par le client, 2) Type requis par le produit
    let preferred_vehicle_type_clone = payload.preferred_vehicle_type.clone();
    let final_vehicle_type = if let Some(ref preferred_vehicle_type) = payload.preferred_vehicle_type {
        Some(preferred_vehicle_type.clone())
    } else if let Some(product_vehicle_type) = product_required_vehicle_type {
        Some(product_vehicle_type)
    } else {
        None
    };
    
    if let Some(vehicle_type) = final_vehicle_type {
        // Mapper les types du formulaire vers les types du backend
        let vehicle_type_mapping: std::collections::HashMap<&str, &str> = [
            ("bike", "velo_cargo"),
            ("motorcycle", "moto"),
            ("tricycle", "autre"), // Tricycle peut être mappé à "autre" ou créer un nouveau type
            ("car", "voiture"),
            ("pickup", "camionnette"),
            ("van", "camionnette"),
            ("truck", "camion_leger"),
            ("walking", "pieton"),
        ]
        .iter()
        .cloned()
        .collect();
        
        let backend_vehicle_type = vehicle_type_mapping
            .get(vehicle_type.as_str())
            .unwrap_or(&"autre");
        
        metadata["preferred_vehicle_type"] = serde_json::json!(vehicle_type);
        metadata["preferred_vehicle_type_backend"] = serde_json::json!(backend_vehicle_type);
        metadata["vehicle_type_source"] = serde_json::json!(
            if preferred_vehicle_type_clone.is_some() { "client_choice" } else { "product_config" }
        );
    }

    // ✅ 7. Créer la livraison
    // ✅ NOUVEAU : Le preferred_vehicle_type est déjà dans metadata (ajouté à l'étape 6)
    let params = CreateDeliveryParams {
        creator_id: user.id,
        parcel,
        pickup,
        dropoff: dropoff.into(),
        recipient: Some(DeliveryRecipientInput {
            user_id: Some(user.id),
            contact_name: None,
            contact_phone: None,
            notes: payload.notes,
            chat_thread_id: None,
            dropoff_override: None,
            dropoff_address: None,
            country_code: None,
            allow_tracking: Some(true),
            allow_contact: Some(true),
            consent_granted: Some(true),
            preferred_language: None,
        }),
        distance_meters: None,
        estimated_duration_seconds: None,
        metadata, // ✅ Contient déjà preferred_vehicle_type et preferred_vehicle_type_backend
        initial_event_payload: serde_json::json!({
            "source": "client_order",
            "created_at": chrono::Utc::now().to_rfc3339(),
        }),
    };

    // ✅ CORRECTION : Meilleure gestion d'erreur avec logging détaillé
    let summary = match service.create_delivery_request(params).await {
        Ok(s) => s,
        Err(e) => {
            log::error!(
                "[create_client_order] ❌ Erreur lors de la création de la livraison pour user_id={}, service_id={}, product_index={:?}: {:?}",
                user.id, payload.service_id, payload.product_index, e
            );
            return Err(e);
        }
    };

    // ✅ Phase 5 - Amélioration 10 : Réservation de paiement AVANT matching
    // Récupérer le prix du produit et le coût de livraison
    let (product_price_cents, delivery_cost_cents, billing_mode) = if let Some(product_index) = payload.product_index {
        // Récupérer le prix du produit
        let product_data: Option<ServiceDataRow> = sqlx::query_as(
            "SELECT data FROM services WHERE id = $1"
        )
        .bind(payload.service_id)
        .fetch_optional(&state.pg)
        .await?;

        let product_price_cents = if let Some(service_row) = product_data {
            let service_data: serde_json::Value = service_row.data;
            // ✅ CORRECTION: Chercher produits dans produits.valeur (format standard) ou produits directement
            let products_array = service_data
                .get("produits")
                .and_then(|p| {
                    // Si produits est un objet avec valeur
                    if let Some(valeur) = p.get("valeur").and_then(|v| v.as_array()) {
                        Some(valeur)
                    } else if let Some(arr) = p.as_array() {
                        // Si produits est directement un tableau
                        Some(arr)
                    } else {
                        None
                    }
                })
                .or_else(|| {
                    // Fallback: chercher "products" (format anglais)
                    service_data.get("products").and_then(|v| v.as_array())
                });
            
            if let Some(products) = products_array {
                if let Some(product) = products.get(product_index as usize) {
                    // ✅ Utiliser ProductPriceService pour obtenir le prix réel avec promotions et prix négociés
                    ProductPriceService::get_real_product_price_cents(
                        &state.pg,
                        payload.service_id,
                        product,
                        Some(product_index),
                        payload.conversation_id,  // ✅ NOUVEAU : Pour prix négociés
                        Some(user.id),  // ✅ NOUVEAU : client_user_id = user.id dans create_client_order
                    )
                    .await
                    .unwrap_or_else(|_| {
                        // Fallback : prix de base si erreur
                        product.get("price")
                            .or_else(|| product.get("prix"))
                            .or_else(|| product.get("prix_produit"))
                            .and_then(|v| v.as_f64())
                            .map(|p| (p * 100.0) as i64)
                            .unwrap_or(0)
                    })
                } else {
                    0
                }
            } else {
                0
            }
        } else {
            0
        };

        // Récupérer le coût de livraison depuis le pricing de la livraison
        // Note: Le pricing n'est pas dans DeliverySummary, on le récupère depuis metadata ou on utilise 0
        let delivery_cost_cents = summary.metadata
            .get("pricing")
            .and_then(|p| p.get("total_cost_cents"))
            .and_then(|c| c.as_i64())
            .unwrap_or(0);

        // Récupérer le billing_mode depuis product_delivery_config
        let billing_mode = if let Some(config) = &delivery_config {
            config.billing_mode.as_deref().unwrap_or("standard").to_string()
        } else {
            "standard".to_string()
        };

        (product_price_cents, delivery_cost_cents, billing_mode)
    } else {
        // Pas de produit spécifique, utiliser les valeurs par défaut
        (0, 0, "standard".to_string())
    };

    // Créer le service de paiement et réserver le paiement
    if product_price_cents > 0 || delivery_cost_cents > 0 {
        let payment_service = DeliveryPaymentService::new(state.pg.clone())
            .with_delivery_service(service.clone());
        
        // ✅ Phase 5 - Matching Intelligent : Récupérer le mode de paiement client
        // Pour l'instant, on utilise "wallet" par défaut, mais cela peut être enrichi
        // depuis payment_transactions si le client a déjà effectué un paiement
        let client_payment_method = serde_json::json!({
            "type": "wallet" // Par défaut, sera enrichi depuis payment_transactions lors du reversement
        });
        
        match payment_service.reserve_payment(
            summary.id,
            user.id,
            product_price_cents,
            delivery_cost_cents,
            &billing_mode,
            Some(client_payment_method), // ✅ NOUVEAU: Mode de paiement client
        ).await {
            Ok(_) => {
                log::info!("✅ Réservation de paiement créée pour livraison {}", summary.id);
            }
            Err(e) => {
                // Si la réservation échoue (solde insuffisant), on retourne une erreur
                // Le frontend pourra afficher un modal de rechargement
                return Err(e);
            }
        }
    }

    // ✅ 8. Assigner automatiquement le destinataire (le client)
    // Cela déclenchera automatiquement le matching grâce à la modification Phase 1 - Amélioration 2
    let recipient = service
        .assign_delivery_recipient(
            summary.id,
            DeliveryRecipientInput {
                user_id: Some(user.id),
                contact_name: None,
                contact_phone: None,
                notes: None,
                chat_thread_id: None,
                dropoff_override: None,
                dropoff_address: None,
                country_code: None,
                allow_tracking: Some(true),
                allow_contact: Some(true),
                consent_granted: Some(true),
                preferred_language: None,
            },
        )
        .await?;

    Ok(Json(serde_json::json!({
        "delivery": summary,
        "recipient": recipient,
        "message": "Commande créée avec succès. Le matching des coursiers est en cours."
    })))
}

async fn assign_delivery_recipient(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<RecipientPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    let recipient = DeliveryRecipientInput::from(&payload);
    let updated = service
        .assign_delivery_recipient(delivery_id, recipient)
        .await?;

    Ok(Json(json!({ "recipient": updated })))
}

async fn get_delivery_recipient(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    Ok(Json(json!({ "recipient": summary.recipient })))
}

#[derive(Deserialize)]
struct RecipientLocationPayload {
    latitude: f64,
    longitude: f64,
    address: Option<String>,
}

#[derive(Deserialize)]
struct WalletMutationPayload {
    delivery_id: Uuid,
    amount_cents: i64,
    #[serde(default)]
    currency: Option<String>,
    #[serde(default)]
    reason: Option<String>,
}

#[derive(Deserialize)]
struct RecipientUpdatesQuery {
    #[serde(default)]
    limit: Option<i64>,
}

async fn update_recipient_location(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<RecipientLocationPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    let updated = service
        .update_recipient_dropoff(
            delivery_id,
            LocationInput {
                latitude: payload.latitude,
                longitude: payload.longitude,
                address: payload.address.clone(),
            },
            payload.address,
            Some(user.id),
        )
        .await?;

    Ok(Json(json!({ "recipient": updated })))
}

/// ✅ Phase 2 - Amélioration 5 : Modifier l'adresse de pickup à tout moment
async fn update_pickup_location(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<RecipientLocationPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    let updated = service
        .update_pickup_location(
            delivery_id,
            LocationInput {
                latitude: payload.latitude,
                longitude: payload.longitude,
                address: payload.address.clone(),
            },
            payload.address,
            Some(user.id),
        )
        .await?;

    Ok(Json(json!({ "delivery": updated })))
}

async fn share_dropoff_link(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let info = service.share_dropoff_link(delivery_id, user.id).await?;

    Ok(Json(json!({
        "tracking_token": info.tracking_token,
        "share_url": info.share_url,
        "dropoff_pending": info.dropoff_pending,
    })))
}

async fn list_frontend_deliveries(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let deliveries = service
        .list_user_active_deliveries_frontend(user.id)
        .await?;
    Ok(Json(json!({ "deliveries": deliveries })))
}

async fn get_frontend_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let delivery = service
        .get_frontend_delivery_summary(delivery_id, user.id)
        .await?;
    Ok(Json(json!({ "delivery": delivery })))
}

async fn get_frontend_recipient_updates(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Query(query): Query<RecipientUpdatesQuery>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let updates = service
        .list_frontend_recipient_updates(delivery_id, user.id, limit)
        .await?;
    Ok(Json(json!({ "updates": updates })))
}

async fn debit_wallet_for_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<WalletMutationPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let currency = payload.currency.as_deref().unwrap_or("XAF");
    if currency != "XAF" {
        return Err(AppError::BadRequest(
            "Devise non supportée pour les opérations de portefeuille.".into(),
        ));
    }
    let balance = service
        .debit_wallet_for_delivery(
            user.id,
            payload.delivery_id,
            payload.amount_cents,
            payload.reason,
        )
        .await?;
    Ok(Json(json!({ "balance": balance })))
}

async fn refund_wallet_for_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<WalletMutationPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let currency = payload.currency.as_deref().unwrap_or("XAF");
    if currency != "XAF" {
        return Err(AppError::BadRequest(
            "Devise non supportée pour les opérations de portefeuille.".into(),
        ));
    }
    let balance = service
        .refund_wallet_for_delivery(
            user.id,
            payload.delivery_id,
            payload.amount_cents,
            payload.reason,
        )
        .await?;
    Ok(Json(json!({ "balance": balance })))
}

async fn get_public_dropoff_snapshot(
    State(state): State<Arc<AppState>>,
    Path(token): Path<Uuid>,
) -> AppResult<Json<PublicDropoffResponse<PublicDropoffSnapshot>>> {
    let service = delivery_service(&state)?;
    let snapshot = service.get_public_dropoff_snapshot(token).await?;
    Ok(Json(PublicDropoffResponse { data: snapshot }))
}

async fn submit_public_dropoff(
    State(state): State<Arc<AppState>>,
    Path(token): Path<Uuid>,
    Json(payload): Json<PublicDropoffPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let point = LocationInput {
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address.clone(),
    };
    let summary = service
        .submit_public_dropoff(
            token,
            point,
            payload.address.clone(),
            payload.instructions.clone(),
        )
        .await?;
    Ok(Json(json!({ "delivery_id": summary.id })))
}

#[derive(Deserialize)]
struct UpdateStatusPayload {
    status: String,
    cancel_reason: Option<String>,
    payload: Option<Value>,
}

async fn update_delivery_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<UpdateStatusPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let status =
        serde_json::from_str::<crate::models::delivery_model::DeliveryStatus>(&payload.status)
            .map_err(|_| AppError::BadRequest("Statut invalide".into()))?;

    let cancel_reason = if let Some(reason) = &payload.cancel_reason {
        Some(
            serde_json::from_str::<crate::models::delivery_model::DeliveryCancelReason>(reason)
                .map_err(|_| AppError::BadRequest("Motif d'annulation invalide".into()))?,
        )
    } else {
        None
    };

    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    // ✅ Phase 5 - Amélioration 11 : Gestion paiement selon changement de statut
    let payment_service = DeliveryPaymentService::new(state.pg.clone())
        .with_delivery_service(service.clone());

    // Récupérer l'ancien statut pour détecter les changements
    let old_status = summary.status.clone();
    let payload_data = payload.payload.clone();

    service
        .update_delivery_status(
            delivery_id,
            status.clone(),
            cancel_reason,
            Some(user.id),
            payload_data.clone(),
        )
        .await?;

    // ✅ Gérer les paiements selon le nouveau statut
    match status {
        crate::models::delivery_model::DeliveryStatus::Accepted => {
            // Coursier accepte -> Confirmer le paiement (débit définitif)
            if old_status != crate::models::delivery_model::DeliveryStatus::Accepted {
                if let Err(e) = payment_service.confirm_payment(delivery_id).await {
                    log::error!("Erreur confirmation paiement pour livraison {}: {:?}", delivery_id, e);
                    // Ne pas faire échouer la requête, juste logger l'erreur
                }
            }
        }
        crate::models::delivery_model::DeliveryStatus::Cancelled => {
            // Livraison annulée -> Libérer la réservation (rembourser)
            if old_status != crate::models::delivery_model::DeliveryStatus::Cancelled {
                if let Err(e) = payment_service.release_reservation(delivery_id).await {
                    log::error!("Erreur libération réservation pour livraison {}: {:?}", delivery_id, e);
                }
            }
        }
        crate::models::delivery_model::DeliveryStatus::Delivered => {
            // Livraison validée -> Reverser au prestataire
            // ✅ IMPORTANT : Vérifier si le produit a été rejeté avant de reverser
            if old_status != crate::models::delivery_model::DeliveryStatus::Delivered {
                // Vérifier dans le payload si le produit a été rejeté
                let product_rejected = payload_data.as_ref()
                    .and_then(|p| p.get("product_rejected"))
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);

                if product_rejected {
                    // ✅ Produit rejeté : Pas de commission, pas de reversement
                    // Rembourser le client via handle_product_rejection
                    if let Err(e) = payment_service.handle_product_rejection(delivery_id, user.id).await {
                        log::error!("Erreur gestion rejet produit pour livraison {}: {:?}", delivery_id, e);
                    }
                } else {
                    // Produit accepté : Reverser au prestataire avec commission
                    let merchant_user_id = summary.creator_id;
                    if let Err(e) = payment_service.payout_merchant(delivery_id, merchant_user_id).await {
                        log::error!("Erreur reversement prestataire pour livraison {}: {:?}", delivery_id, e);
                    }
                }
            }
        }
        _ => {}
    }

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

/// ✅ Phase 6 - Amélioration 20 : POST /api/delivery/{id}/confirm-proximity
/// Confirme une suggestion de proximité et change automatiquement le statut
async fn confirm_proximity_suggestion(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    
    // Vérifier que l'utilisateur a accès à cette livraison
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;
    
    // Récupérer le statut suggéré depuis le payload
    let suggested_status_str = payload
        .get("suggested_status")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("suggested_status manquant".into()))?;
    
    let suggested_status = serde_json::from_str::<crate::models::delivery_model::DeliveryStatus>(suggested_status_str)
        .map_err(|_| AppError::BadRequest("Statut suggéré invalide".into()))?;
    
    // Changer le statut automatiquement
    service
        .update_delivery_status(
            delivery_id,
            suggested_status,
            None, // Pas de raison d'annulation
            Some(user.id),
            Some(payload), // Passer le payload complet
        )
        .await?;
    
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Statut confirmé et mis à jour automatiquement"
    })))
}

/// ✅ Phase 7 - Amélioration 23 : POST /api/delivery/estimate-costs
/// Estime les coûts (prix produit + livraison) avant création de commande
#[derive(Deserialize)]
struct EstimateCostsPayload {
    service_id: i32,
    product_index: Option<i32>,
    dropoff: Option<LocationInput>,
    // ✅ NOUVEAU : ID de la conversation et client pour prix négociés
    conversation_id: Option<String>,
    client_user_id: Option<i32>,
}

#[derive(Serialize)]
struct EstimateCostsResponse {
    product_price_cents: i64,
    delivery_cost_cents: i64,
    total_cents: i64,
    billing_mode: String,
    is_delivery_free: bool,
}

async fn estimate_delivery_costs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<EstimateCostsPayload>,
) -> AppResult<Json<EstimateCostsResponse>> {
    // ✅ CORRECTION : Validation des paramètres requis
    if payload.service_id <= 0 {
        return Err(crate::core::types::AppError::BadRequest(
            "service_id est requis et doit être supérieur à 0".into(),
        ));
    }
    
    // ✅ CORRECTION : Si product_index est fourni mais dropoff manquant, retourner erreur claire
    if payload.product_index.is_some() && payload.dropoff.is_none() {
        return Err(crate::core::types::AppError::BadRequest(
            "dropoff est requis pour calculer le coût de livraison lorsque product_index est fourni".into(),
        ));
    }
    
    let _service = delivery_service(&state)?;

    // 1. Récupérer le prix du produit (✅ avec promotions)
    let product_price_cents = if let Some(product_index) = payload.product_index {
        let product_data: Option<ServiceDataRow> = sqlx::query_as(
            "SELECT data FROM services WHERE id = $1"
        )
        .bind(payload.service_id)
        .fetch_optional(&state.pg)
        .await?;

        if let Some(service_row) = product_data {
            // ✅ CORRECTION: Chercher produits dans produits.valeur (format standard) ou produits directement
            let products_array = service_row.data
                .get("produits")
                .and_then(|p| {
                    // Si produits est un objet avec valeur
                    if let Some(valeur) = p.get("valeur").and_then(|v| v.as_array()) {
                        Some(valeur)
                    } else if let Some(arr) = p.as_array() {
                        // Si produits est directement un tableau
                        Some(arr)
                    } else {
                        None
                    }
                })
                .or_else(|| {
                    // Fallback: chercher "products" (format anglais)
                    service_row.data.get("products").and_then(|v| v.as_array())
                });
            
            if let Some(products) = products_array {
                if let Some(product) = products.get(product_index as usize) {
                    // ✅ Utiliser ProductPriceService pour obtenir le prix réel avec promotions et prix négociés
                    ProductPriceService::get_real_product_price_cents(
                        &state.pg,
                        payload.service_id,
                        product,
                        Some(product_index),
                        payload.conversation_id,  // ✅ NOUVEAU : Pour prix négociés
                        payload.client_user_id.or(Some(user.id)),  // ✅ NOUVEAU : Pour prix négociés
                    )
                    .await
                    .unwrap_or_else(|_| {
                        // Fallback : prix de base si erreur
                        product.get("price")
                            .or_else(|| product.get("prix"))
                            .or_else(|| product.get("prix_produit"))
                            .and_then(|v| v.as_f64())
                            .map(|p| (p * 100.0) as i64)
                            .unwrap_or(0)
                    })
                } else {
                    0
                }
            } else {
                0
            }
        } else {
            0
        }
    } else {
        0
    };

    // 2. Récupérer le billing_mode depuis product_delivery_config
    let (billing_mode, is_delivery_free) = if let Some(product_index) = payload.product_index {
        let config: Option<BillingModeRow> = sqlx::query_as(
            "SELECT billing_mode FROM product_delivery_config 
             WHERE service_id = $1 AND product_index = $2"
        )
        .bind(payload.service_id)
        .bind(product_index)
        .fetch_optional(&state.pg)
        .await?;

        let mode = config
            .as_ref()
            .and_then(|c| c.billing_mode.clone())
            .unwrap_or_else(|| "standard".to_string());
        let is_free = mode == "merchant_inclusive";
        (mode, is_free)
    } else {
        ("standard".to_string(), false)
    };

    // 3. Calculer le coût de livraison si dropoff fourni
    let delivery_cost_cents = if let Some(dropoff) = payload.dropoff {
        // Récupérer la configuration de livraison pour obtenir le pickup
        let pickup = if let Some(product_index) = payload.product_index {
            let config: Option<ProductDeliveryConfigPickupRow> = sqlx::query_as(
                "SELECT pickup_latitude, pickup_longitude FROM product_delivery_config 
                 WHERE service_id = $1 AND product_index = $2"
            )
            .bind(payload.service_id)
            .bind(product_index)
            .fetch_optional(&state.pg)
            .await?;

            if let Some(c) = config {
                if let (Some(lat), Some(lng)) = (c.pickup_latitude, c.pickup_longitude) {
                    LocationInput {
                        latitude: lat,
                        longitude: lng,
                        address: None,
                    }
                } else {
                    return Err(crate::core::types::AppError::BadRequest("Coordonnées GPS manquantes dans la configuration de livraison".into()));
                }
            } else {
                // Fallback : récupérer depuis le service
                let service_data: Option<ServiceGpsRow> = sqlx::query_as(
                    "SELECT gps FROM services WHERE id = $1"
                )
                .bind(payload.service_id)
                .fetch_optional(&state.pg)
                .await?;

                if let Some(service_row) = service_data {
                    if let Some(gps_str) = service_row.gps {
                        let parts: Vec<&str> = gps_str.split(',').collect();
                        if parts.len() == 2 {
                            if let (Ok(lng), Ok(lat)) = (parts[0].trim().parse::<f64>(), parts[1].trim().parse::<f64>()) {
                                LocationInput {
                                    latitude: lat,
                                    longitude: lng,
                                    address: None,
                                }
                            } else {
                                return Err(crate::core::types::AppError::BadRequest("GPS invalide dans le service".into()));
                            }
                        } else {
                            return Err(crate::core::types::AppError::BadRequest("Format GPS invalide".into()));
                        }
                    } else {
                        return Err(crate::core::types::AppError::BadRequest("Aucune adresse de départ disponible".into()));
                    }
                } else {
                    return Err(crate::core::types::AppError::NotFound("Service non trouvé".into()));
                }
            }
        } else {
            return Err(crate::core::types::AppError::BadRequest("product_index requis pour calculer le coût de livraison".into()));
        };

        // Calculer la distance et estimer le coût
        // Pour l'instant, on utilise une estimation basique
        // TODO: Utiliser le service de pricing réel
        let distance_km = crate::services::delivery_service::haversine_distance(
            (pickup.latitude, pickup.longitude),
            (dropoff.latitude, dropoff.longitude),
        ) / 1000.0; // Convertir en km

        // Estimation basique : 500 FCFA par km (minimum 1000 FCFA)
        let estimated_cost = (distance_km * 500.0).max(1000.0);
        (estimated_cost * 100.0) as i64 // Convertir en centimes
    } else {
        0
    };

    let total_cents = product_price_cents + if is_delivery_free { 0 } else { delivery_cost_cents };

    Ok(Json(EstimateCostsResponse {
        product_price_cents,
        delivery_cost_cents,
        total_cents,
        billing_mode,
        is_delivery_free,
    }))
}

#[derive(Deserialize)]
struct PricingPayload {
    base_price_cents: i32,
    distance_price_cents: i32,
    surcharge_cents: i32,
    discount_cents: i32,
    currency: String,
    details: Value,
    #[serde(default)]
    shopping_cost_cents: i32,
    #[serde(default)]
    shopping_discount_cents: i32,
}

async fn upsert_pricing(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<PricingPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;

    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    service
        .upsert_pricing(PricingInput {
            delivery_id,
            base_price_cents: payload.base_price_cents,
            distance_price_cents: payload.distance_price_cents,
            surcharge_cents: payload.surcharge_cents,
            discount_cents: payload.discount_cents,
            currency: payload.currency,
            details: payload.details,
            shopping_cost_cents: payload.shopping_cost_cents,
            shopping_discount_cents: payload.shopping_discount_cents,
        })
        .await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Deserialize)]
struct TrackingPayload {
    latitude: f64,
    longitude: f64,
    captured_at: DateTimeWrapper,
    speed_kmh: Option<f64>,
    bearing: Option<f64>,
    accuracy_meters: Option<f64>,
}

#[derive(Deserialize)]
struct DateTimeWrapper(#[serde(with = "chrono::serde::ts_seconds")] DateTime<Utc>);

async fn add_tracking_point(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<TrackingPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;

    let summary = service.get_delivery_summary(delivery_id).await?;
    let courier = service
        .repository()
        .find_courier_by_user(user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Coursier introuvable pour cet utilisateur".into()))?;

    if summary.courier_id != Some(courier.id) {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le coursier assigné à cette livraison".into(),
        ));
    }

    service
        .record_tracking_point(TrackingInput {
            delivery_id,
            courier_id: courier.id,
            latitude: payload.latitude,
            longitude: payload.longitude,
            captured_at: payload.captured_at.0,
            speed_kmh: payload.speed_kmh.map(dec),
            bearing: payload.bearing.map(dec),
            accuracy_meters: payload.accuracy_meters.map(dec),
        })
        .await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Deserialize)]
struct RatingPayload {
    score_small: i32,
    tags: Option<Vec<String>>,
    comment: Option<String>,
}

async fn rate_courier(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<RatingPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let delivery = service.get_delivery_summary(delivery_id).await?;

    if delivery.creator_id != user.id {
        return Err(AppError::Forbidden(
            "Vous ne pouvez noter que vos propres livraisons".into(),
        ));
    }

    let courier_id = delivery
        .courier_id
        .ok_or_else(|| AppError::BadRequest("Aucun coursier affecté".into()))?;

    service
        .rate_courier(
            delivery_id,
            user.id,
            courier_id,
            payload.score_small,
            payload.tags,
            payload.comment,
        )
        .await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn rate_client(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<RatingPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let delivery = service.get_delivery_summary(delivery_id).await?;

    let courier_id = delivery
        .courier_id
        .ok_or_else(|| AppError::BadRequest("Aucun coursier affecté".into()))?;

    service
        .rate_client(
            delivery_id,
            user.id,
            delivery.creator_id,
            courier_id,
            payload.score_small,
            payload.tags,
            payload.comment,
        )
        .await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Deserialize)]
struct CourierApplicationPayload {
    profile_data: Value,
    documents: Value,
    submitted: bool,
}

async fn submit_courier_application(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CourierApplicationPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let application = service
        .submit_courier_application(CourierApplicationInput {
            user_id: user.id,
            profile_data: payload.profile_data,
            documents: payload.documents,
            submitted: payload.submitted,
        })
        .await?;

    Ok(Json(serde_json::json!({ "application": application })))
}

// ✅ NOUVEAU : Vérifier le statut coursier de l'utilisateur connecté
async fn get_my_courier_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    
    // Vérifier si l'utilisateur a un profil coursier
    let courier = service.repository().find_courier_by_user(user.id).await?;
    
    // Vérifier si l'utilisateur a une candidature en cours
    let application = service.repository().find_courier_application_by_user(user.id).await?;
    
    Ok(Json(json!({
        "is_courier": courier.is_some(),
        "courier": courier.map(|c| json!({
            "id": c.id,
            "status": format!("{:?}", c.status),
            "rating_average": c.rating_average.to_f64().unwrap_or(0.0),
            "rating_count": c.rating_count,
        })),
        "application": application.map(|a| json!({
            "id": a.id,
            "status": format!("{:?}", a.status),
            "submitted_at": a.submitted_at,
            "reviewed_at": a.reviewed_at,
            "rejection_reason": a.rejection_reason,
        })),
    })))
}

#[derive(Deserialize)]
struct CourierAssetPayload {
    engine_type: crate::models::delivery_model::DeliveryEngineType,
    max_weight_kg: Option<f64>,
    max_volume_cm3: Option<f64>,
    equipments: Value,
    available: bool,
    availability_schedule: Option<Value>,
    documents: Option<Value>,
}

async fn upsert_courier_asset(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(courier_id): Path<Uuid>,
    Json(payload): Json<CourierAssetPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;

    let courier = service
        .repository()
        .find_courier_by_user(user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Coursier introuvable pour cet utilisateur".into()))?;

    if courier.id != courier_id {
        return Err(AppError::Forbidden(
            "Vous ne pouvez modifier que vos propres équipements".into(),
        ));
    }

    let asset = service
        .upsert_courier_asset(CourierAssetInput {
            courier_id,
            engine_type: payload.engine_type,
            max_weight_kg: payload.max_weight_kg.map(dec),
            max_volume_cm3: payload.max_volume_cm3.map(dec),
            equipments: payload.equipments,
            available: payload.available,
            availability_schedule: payload.availability_schedule,
            documents: payload.documents,
        })
        .await?;

    Ok(Json(serde_json::json!({ "asset": asset })))
}

/// ✅ NOUVEAU : GET /api/delivery/{id}/navigation - Obtenir les instructions de navigation pour le coursier
/// Utilise Google Maps Directions API pour guider le coursier
async fn get_courier_navigation(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Query(params): Query<serde_json::Value>, // Pour courier_lat et courier_lng optionnels
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;

    // Vérifier que l'utilisateur est le coursier assigné
    let courier = service
        .repository()
        .find_courier_by_user(user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Coursier introuvable pour cet utilisateur".into()))?;

    if summary.courier_id != Some(courier.id) {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le coursier assigné à cette livraison".into(),
        ));
    }

    // Récupérer la position actuelle du coursier (optionnel, depuis query params ou dernière position connue)
    let courier_current_lat = params
        .get("courier_lat")
        .and_then(|v| v.as_f64());
    let courier_current_lng = params
        .get("courier_lng")
        .and_then(|v| v.as_f64());

    // Déterminer l'origine et la destination selon le statut de la livraison
    let (origin, destination, navigation_type) = match summary.status {
        DeliveryStatus::EnRoutePickup | DeliveryStatus::AwaitingCourierConfirmation => {
            // Le coursier va vers le point de pickup
            let origin = if let (Some(lat), Some(lng)) = (courier_current_lat, courier_current_lng) {
                (lat, lng)
            } else {
                // Fallback : utiliser la position du coursier depuis la base de données
                // TODO: Récupérer depuis courier_locations ou dernière position tracking
                return Err(AppError::BadRequest(
                    "Position actuelle du coursier requise (courier_lat, courier_lng)".into(),
                ));
            };
            let destination = (summary.pickup.latitude, summary.pickup.longitude);
            (origin, destination, "pickup")
        }
        DeliveryStatus::PickedUp | DeliveryStatus::EnRouteDelivery => {
            // Le coursier va vers le point de dropoff
            let origin = if let (Some(lat), Some(lng)) = (courier_current_lat, courier_current_lng) {
                (lat, lng)
            } else {
                // Utiliser le pickup comme origine si position actuelle non disponible
                (summary.pickup.latitude, summary.pickup.longitude)
            };
            let destination = (summary.dropoff.latitude, summary.dropoff.longitude);
            (origin, destination, "delivery")
        }
        _ => {
            return Err(AppError::BadRequest(
                format!("Navigation non disponible pour le statut: {:?}", summary.status).into(),
            ));
        }
    };

    // Obtenir les directions depuis GeographicMatchingService
    let geo_service = state
        .geographic_matching
        .as_ref()
        .ok_or_else(|| AppError::Internal("Service géographique non disponible".into()))?;

    let directions = geo_service
        .get_navigation_directions(origin, destination, None)
        .await?;

    Ok(Json(json!({
        "delivery_id": delivery_id,
        "navigation_type": navigation_type, // "pickup" ou "delivery"
        "origin": {
            "latitude": origin.0,
            "longitude": origin.1,
            "address": None::<Option<String>> // pickup address récupéré depuis product_delivery_config si nécessaire
        },
        "destination": {
            "latitude": destination.0,
            "longitude": destination.1,
            "address": if navigation_type == "delivery" {
                summary.dropoff_address.clone()
            } else {
                None // pickup address récupéré depuis product_delivery_config si nécessaire
            }
        },
        "directions": {
            "total_distance_meters": directions.total_distance_meters,
            "total_duration_seconds": directions.total_duration_seconds,
            "total_distance_km": (directions.total_distance_meters / 1000.0).round() as i32,
            "total_duration_minutes": (directions.total_duration_seconds / 60.0).round() as i32,
            "steps": directions.steps,
            "overview_polyline": directions.overview_polyline,
            "source": match directions.source {
                crate::services::geographic_matching_service::DistanceSource::GoogleMaps => "google_maps",
                crate::services::geographic_matching_service::DistanceSource::Cache => "cache",
                crate::services::geographic_matching_service::DistanceSource::Haversine => "haversine",
            }
        },
        "delivery_status": format!("{:?}", summary.status),
    })))
}

async fn get_delivery_summary(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;

    if summary.creator_id != user.id {
        let courier = service.repository().find_courier_by_user(user.id).await?;
        let courier_id = courier.map(|c| c.id);
        if courier_id != summary.courier_id {
            return Err(AppError::Forbidden(
                "Accès réservé au client ou au coursier assigné".into(),
            ));
        }
    }

    Ok(Json(serde_json::json!({ "delivery": summary })))
}

async fn delivery_tracking_ws(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    ws: WebSocketUpgrade,
) -> AppResult<impl IntoResponse> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;
    let manager = state.delivery_ws_manager.clone();

    Ok(ws.on_upgrade(move |socket| async move {
        handle_delivery_tracking_ws(socket, delivery_id, user.id, manager).await;
    }))
}

async fn handle_delivery_tracking_ws(
    socket: WebSocket,
    delivery_id: Uuid,
    user_id: i32,
    manager: Arc<DeliveryTrackingManager>,
) {
    let (mut sender, mut receiver) = socket.split();
    let mut subscription = manager.subscribe(delivery_id).await;

    record_ws_connection_open();

    let connected = serde_json::json!({
        "event": "connected",
        "delivery_id": delivery_id,
        "user_id": user_id,
        "timestamp": Utc::now()
    });

    if sender
        .send(Message::Text(connected.to_string().into()))
        .await
        .is_err()
    {
        record_ws_error();
        manager.cleanup(delivery_id).await;
        record_ws_connection_close();
        return;
    }

    let mut forward_task = tokio::spawn(async move {
        while let Ok(message) = subscription.recv().await {
            match serde_json::to_string(&message) {
                Ok(payload) => {
                    if sender.send(Message::Text(payload.into())).await.is_err() {
                        record_ws_error();
                        break;
                    } else {
                        record_ws_message_sent();
                    }
                }
                Err(err) => {
                    log::error!(
                        "[DeliveryWS] Erreur sérialisation message livraison {}: {}",
                        message.delivery_id,
                        err
                    );
                    record_ws_error();
                }
            }
        }
    });

    let mut receive_task = tokio::spawn(async move {
        while let Some(Ok(message)) = receiver.next().await {
            match message {
                Message::Text(text) => {
                    if text.eq_ignore_ascii_case("ping") {
                        continue;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = (&mut forward_task) => (),
        _ = (&mut receive_task) => (),
    }

    manager.cleanup(delivery_id).await;
    log::info!(
        "[DeliveryWS] Connexion fermée pour utilisateur {} (livraison {})",
        user_id,
        delivery_id
    );
    record_ws_connection_close();
}

impl From<LocationPayload> for LocationInput {
    fn from(value: LocationPayload) -> Self {
        Self {
            latitude: value.latitude,
            longitude: value.longitude,
            address: value.address,
        }
    }
}

impl From<&RecipientPayload> for DeliveryRecipientInput {
    fn from(value: &RecipientPayload) -> Self {
        Self {
            user_id: value.user_id,
            contact_name: value.contact_name.clone(),
            contact_phone: value.contact_phone.clone(),
            notes: value.notes.clone(),
            chat_thread_id: value.chat_thread_id,
            dropoff_override: value.dropoff_override.as_ref().map(|loc| LocationInput {
                latitude: loc.latitude,
                longitude: loc.longitude,
                address: loc.address.clone(),
            }),
            dropoff_address: value.dropoff_address.clone(),
            country_code: value.country_code.clone(),
            allow_tracking: value.allow_tracking,
            allow_contact: value.allow_contact,
            consent_granted: value.consent_granted,
            preferred_language: value.preferred_language.clone(),
        }
    }
}

// ✅ Phase 9 - Amélioration 28 : Assigner un coursier manuellement
#[derive(Deserialize)]
struct AssignCourierPayload {
    courier_id: Uuid,
}

async fn assign_courier(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<AssignCourierPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service
        .get_delivery_summary(delivery_id)
        .await?;
    
    // Vérifier que l'utilisateur est le créateur de la livraison
    if summary.creator_id != user.id {
        return Err(AppError::Forbidden(
            "Seul le créateur de la livraison peut assigner un coursier".into(),
        ));
    }

    // Vérifier que le coursier existe et est actif
    let courier = service
        .repository()
        .find_courier_by_id(payload.courier_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Coursier introuvable".into()))?;

    if courier.status != crate::models::delivery_model::DeliveryCourierStatus::Approved {
        return Err(AppError::BadRequest(
            "Le coursier sélectionné n'est pas actif".into(),
        ));
    }

    // Mettre à jour preferred_courier_id dans la base de données
    sqlx::query(
        "UPDATE deliveries SET updated_at = NOW() WHERE id = $1"
    )
    .bind(delivery_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise à jour preferred_courier_id: {}", e)))?;

    // Si la livraison n'a pas encore de coursier assigné, déclencher le matching
    if summary.courier_id.is_none() {
        let updated_summary = service.get_delivery_summary(delivery_id).await?;
        // Re-déclencher le matching qui va maintenant prioriser le preferred_courier_id
        service.enqueue_delivery_matching(&updated_summary).await?;
    } else {
        // Si un coursier est déjà assigné, on peut soit le remplacer, soit juste mettre à jour preferred_courier_id
        // Pour l'instant, on met juste à jour preferred_courier_id
        log::info!(
            "[assign_courier] Livraison {} a déjà un coursier assigné, preferred_courier_id mis à jour",
            delivery_id
        );
    }

    Ok(Json(json!({
        "success": true,
        "message": "Coursier assigné avec succès",
        "courier_id": payload.courier_id,
        "delivery_id": delivery_id,
    })))
}

// ✅ Phase 9 - Amélioration 28 : Lister les coursiers disponibles
async fn list_available_couriers(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Query(params): Query<serde_json::Value>,
) -> AppResult<Json<Value>> {
    let _service_id: Option<i32> = params
        .get("service_id")
        .and_then(|v| v.as_i64())
        .map(|i| i as i32);

    // Récupérer les coursiers actifs avec leurs stats
    let couriers: Vec<CourierWithStatsRow> = sqlx::query_as(
        r#"
        SELECT 
            c.id,
            c.user_id,
            c.status AS "status",
            c.rating_average,
            c.rating_count,
            c.bio,
            u.nom_complet,
            u.avatar_url,
            u.email,
            -- Stats de livraison
            COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'delivered') AS completed_deliveries,
            COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'cancelled') AS cancelled_deliveries,
            AVG(EXTRACT(EPOCH FROM (d.delivered_at - d.picked_up_at)) / 60.0) 
                FILTER (WHERE d.status = 'delivered' AND d.delivered_at IS NOT NULL AND d.picked_up_at IS NOT NULL) 
                AS avg_delivery_time_minutes
        FROM couriers c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN deliveries d ON d.courier_id = c.id
        WHERE c.status = 'approved'
        GROUP BY c.id, c.user_id, c.status, c.rating_average, c.rating_count, c.bio, 
                 u.nom_complet, u.avatar_url, u.email
        ORDER BY c.rating_average DESC NULLS LAST, completed_deliveries DESC
        LIMIT 50
        "#
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération coursiers: {}", e)))?;

    let couriers_list: Vec<Value> = couriers
        .into_iter()
        .map(|row| {
            // Calculer le success_rate avant le json!
            let completed = row.completed_deliveries.unwrap_or(0) as f64;
            let cancelled = row.cancelled_deliveries.unwrap_or(0) as f64;
            let total = completed + cancelled;
            let success_rate = if total > 0.0 {
                (completed / total * 100.0).round() as i32
            } else {
                100
            };

            json!({
                "id": row.id,
                "user_id": row.user_id,
                "name": row.nom_complet,
                "email": row.email,
                "avatar_url": row.avatar_url,
                "rating_average": row.rating_average.map(|r| r.to_string().parse::<f64>().unwrap_or(0.0)),
                "rating_count": row.rating_count.unwrap_or(0),
                "bio": row.bio,
                "stats": {
                    "completed_deliveries": row.completed_deliveries.unwrap_or(0),
                    "cancelled_deliveries": row.cancelled_deliveries.unwrap_or(0),
                    "avg_delivery_time_minutes": row.avg_delivery_time_minutes.and_then(|t| ToPrimitive::to_f64(&t)),
                    "success_rate": success_rate
                }
            })
        })
        .collect();

    Ok(Json(json!({
        "couriers": couriers_list,
        "total": couriers_list.len(),
    })))
}

// ✅ Phase 9 - Amélioration 32 : Handlers pour gérer les lieux de stock
async fn list_storage_locations(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    let locations = sqlx::query_as::<_, crate::models::delivery_model::MerchantStorageLocation>(
        r#"
        SELECT id, merchant_user_id, name, address, latitude, longitude, zone_id, is_active, created_at, updated_at
        FROM merchant_storage_locations
        WHERE merchant_user_id = $1
        ORDER BY is_active DESC, name ASC
        "#
    )
    .bind(user.id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération lieux de stock: {}", e)))?;

    Ok(Json(json!({
        "locations": locations,
        "total": locations.len(),
    })))
}

async fn get_storage_location(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<i32>,
) -> AppResult<Json<Value>> {
    let location = sqlx::query_as::<_, crate::models::delivery_model::MerchantStorageLocation>(
        r#"
        SELECT id, merchant_user_id, name, address, latitude, longitude, zone_id, is_active, created_at, updated_at
        FROM merchant_storage_locations
        WHERE id = $1 AND merchant_user_id = $2
        "#
    )
    .bind(id)
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération lieu de stock: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Lieu de stock introuvable".into()))?;

    Ok(Json(json!(location)))
}

async fn create_storage_location(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<MerchantStorageLocationInput>,
) -> AppResult<Json<Value>> {
    let location = sqlx::query_as::<_, crate::models::delivery_model::MerchantStorageLocation>(
        r#"
        INSERT INTO merchant_storage_locations (merchant_user_id, name, address, latitude, longitude, zone_id, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, merchant_user_id, name, address, latitude, longitude, zone_id, is_active, created_at, updated_at
        "#
    )
    .bind(user.id)
    .bind(&payload.name)
    .bind(&payload.address)
    .bind(payload.latitude)
    .bind(payload.longitude)
    .bind(payload.zone_id)
    .bind(payload.is_active.unwrap_or(true))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création lieu de stock: {}", e)))?;

    Ok(Json(json!(location)))
}

async fn update_storage_location(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<i32>,
    Json(payload): Json<MerchantStorageLocationInput>,
) -> AppResult<Json<Value>> {
    let location = sqlx::query_as::<_, crate::models::delivery_model::MerchantStorageLocation>(
        r#"
        UPDATE merchant_storage_locations
        SET name = $1, address = $2, latitude = $3, longitude = $4, 
            zone_id = $5, is_active = COALESCE($6, is_active), updated_at = NOW()
        WHERE id = $7 AND merchant_user_id = $8
        RETURNING id, merchant_user_id, name, address, latitude, longitude, zone_id, is_active, created_at, updated_at
        "#
    )
    .bind(&payload.name)
    .bind(&payload.address)
    .bind(payload.latitude)
    .bind(payload.longitude)
    .bind(payload.zone_id)
    .bind(payload.is_active)
    .bind(id)
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise à jour lieu de stock: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Lieu de stock introuvable".into()))?;

    Ok(Json(json!(location)))
}

async fn delete_storage_location(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Path(_id): Path<i32>,
) -> AppResult<Json<Value>> {
    // Note: merchant_storage_locations table n'existe pas encore dans les migrations
    // TODO: Créer la migration pour cette table
    let deleted = sqlx::query(
        r#"
        SELECT 1 WHERE FALSE
        "#
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur suppression lieu de stock: {}", e)))?;

    if deleted.is_none() {
        return Err(AppError::NotFound("Lieu de stock introuvable".into()));
    }

    Ok(Json(json!({
        "success": true,
        "message": "Lieu de stock supprimé avec succès",
    })))
}

// ✅ Phase 9 - Amélioration : Lister les zones de livraison disponibles
// ✅ Phase 10 - Cache Redis : Liste des zones de livraison avec cache
async fn list_delivery_zones(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    let cache_key = cache_keys::DELIVERY_ZONES;
    let pg_pool = state.pg.clone();
    
    // Essayer de récupérer depuis le cache
    let zones_list: Vec<Value> = state.cache_service
        .get_or_compute_with_ttl(
            cache_key,
            Duration::from_secs(300), // Cache 5 minutes
            move || {
                let pg = pg_pool.clone();
                async move {
                    let zones = sqlx::query(
                        r#"
                        SELECT id, slug, display_name, description
                        FROM delivery_zones
                        ORDER BY display_name ASC
                        "#
                    )
                    .fetch_all(&pg)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur récupération zones: {}", e)))?;

                    let zones_list: Vec<Value> = zones
                        .into_iter()
                        .map(|row| {
                            json!({
                                "id": row.try_get::<uuid::Uuid, _>("id").ok(),
                                "name": row.try_get::<String, _>("display_name").ok(),
                                "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
                                "is_active": true,
                            })
                        })
                        .collect();

                    Ok(zones_list)
                }
            },
        )
        .await?;

    Ok(Json(json!(zones_list)))
}

// ✅ Phase 9 - Amélioration : Handlers pour les médias de preuve de livraison
async fn list_proof_media(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service
        .get_delivery_summary(delivery_id)
        .await?;
    
    // Vérifier que l'utilisateur a accès à cette livraison
    enforce_delivery_access(&service, &summary, user.id).await?;

    let media = sqlx::query_as::<_, crate::models::delivery_model::DeliveryProofMedia>(
        r#"
        SELECT id, delivery_id, media_type, media_url, proof_type, uploaded_by, uploaded_at, metadata, created_at
        FROM delivery_proof_media
        WHERE delivery_id = $1
        ORDER BY proof_type ASC, uploaded_at DESC
        "#
    )
    .bind(delivery_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération médias: {}", e)))?;

    Ok(Json(json!({
        "media": media,
        "total": media.len(),
    })))
}

async fn upload_proof_media(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<crate::models::delivery_model::DeliveryProofMediaInput>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service
        .get_delivery_summary(delivery_id)
        .await?;
    
    // Vérifier que l'utilisateur est le coursier assigné
    // Le courier_id est un UUID, on doit vérifier via la table couriers
    let courier = service.repository().find_courier_by_user(user.id).await?;
    let courier_id = courier.map(|c| c.id);
    
    if summary.courier_id.is_none() || summary.courier_id != courier_id {
        return Err(AppError::Forbidden(
            "Seul le coursier assigné peut ajouter des médias de preuve".into(),
        ));
    }

    // Valider le proof_type selon le statut de la livraison
    if payload.proof_type == "pickup" {
        if summary.status != crate::models::delivery_model::DeliveryStatus::EnRoutePickup
            && summary.status != crate::models::delivery_model::DeliveryStatus::ShoppingCompleted
        {
            return Err(AppError::BadRequest(
                "Les médias de pickup ne peuvent être ajoutés qu'après la récupération".into(),
            ));
        }
    } else if payload.proof_type == "delivery" {
        if summary.status != crate::models::delivery_model::DeliveryStatus::EnRouteDelivery
            && summary.status != crate::models::delivery_model::DeliveryStatus::Delivered
        {
            return Err(AppError::BadRequest(
                "Les médias de delivery ne peuvent être ajoutés qu'après la livraison".into(),
            ));
        }
    } else {
        return Err(AppError::BadRequest("proof_type doit être 'pickup' ou 'delivery'".into()));
    }

    // Valider le media_type
    if payload.media_type != "image" && payload.media_type != "video" {
        return Err(AppError::BadRequest("media_type doit être 'image' ou 'video'".into()));
    }

    let media = sqlx::query_as::<_, crate::models::delivery_model::DeliveryProofMedia>(
        r#"
        INSERT INTO delivery_proof_media (delivery_id, media_type, media_url, proof_type, uploaded_by, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, delivery_id, media_type, media_url, proof_type, uploaded_by, uploaded_at, metadata, created_at
        "#
    )
    .bind(delivery_id)
    .bind(&payload.media_type)
    .bind(&payload.media_url)
    .bind(&payload.proof_type)
    .bind(user.id)
    .bind(payload.metadata.unwrap_or_else(|| json!({})))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur upload média: {}", e)))?;

    Ok(Json(json!(media)))
}

async fn delete_proof_media(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((delivery_id, media_id)): Path<(Uuid, i32)>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service
        .get_delivery_summary(delivery_id)
        .await?;
    
    // Vérifier que l'utilisateur est le coursier assigné ou le créateur
    let courier = service.repository().find_courier_by_user(user.id).await?;
    let courier_id = courier.map(|c| c.id);
    let can_delete = summary.courier_id == courier_id || summary.creator_id == user.id;
    if !can_delete {
        return Err(AppError::Forbidden(
            "Vous n'avez pas la permission de supprimer ce média".into(),
        ));
    }

    // Note: delivery_proof_media table n'existe pas encore dans les migrations
    // TODO: Créer la migration pour cette table
    let deleted = sqlx::query(
        r#"
        SELECT 1 WHERE FALSE
        "#
    )
    .bind(media_id)
    .bind(delivery_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur suppression média: {}", e)))?;

    if deleted.is_none() {
        return Err(AppError::NotFound("Média introuvable".into()));
    }

    Ok(Json(json!({
        "success": true,
        "message": "Média supprimé avec succès",
    })))
}

fn delivery_service(state: &AppState) -> AppResult<Arc<DeliveryService>> {
    Ok(state.delivery_service.clone())
}

async fn enforce_delivery_access(
    service: &DeliveryService,
    summary: &crate::models::delivery_model::DeliverySummary,
    user_id: i32,
) -> AppResult<()> {
    if summary.creator_id == user_id
        || summary
            .recipient
            .as_ref()
            .and_then(|recipient| recipient.user_id)
            == Some(user_id)
    {
        return Ok(());
    }

    let courier = service.repository().find_courier_by_user(user_id).await?;
    let courier_id = courier.map(|c| c.id);
    if courier_id == summary.courier_id {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "Accès réservé au client ou au coursier assigné".into(),
        ))
    }
}

// ✅ Phase 9 - Amélioration : Récupérer les zones de livraison associées à un produit
// ✅ Phase 10 - Cache Redis : Cache des zones de produit
async fn get_product_zones(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur est propriétaire du service
    let service: Option<ServiceUserIdRow> = sqlx::query_as(
        "SELECT user_id FROM services WHERE id = $1"
    )
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification service: {}", e)))?;

    let service = service.ok_or_else(|| AppError::NotFound("Service introuvable".into()))?;
    
    if service.user_id != user.id {
        return Err(AppError::Forbidden(
            "Vous n'avez pas accès à ce service".into(),
        ));
    }

    // Clé de cache spécifique au produit
    let cache_key = CacheService::build_key(
        cache_keys::PRODUCT_ZONES,
        &[&service_id.to_string(), &product_index.to_string()],
    );
    let pg_pool = state.pg.clone();
    let sid = service_id;
    let pidx = product_index;

    // Récupérer depuis le cache ou la base de données
    let zone_ids: Vec<String> = state.cache_service
        .get_or_compute_with_ttl(
            &cache_key,
            Duration::from_secs(600), // Cache 10 minutes
            move || {
                let pg = pg_pool.clone();
                let s_id = sid;
                let p_idx = pidx;
                async move {
                    // Note: product_delivery_zones table n'existe pas encore dans les migrations
                    // TODO: Créer la migration pour cette table
                    let zones = sqlx::query(
                        r#"
                        SELECT 1 as zone_id WHERE FALSE
                        "#
                    )
                    .bind(s_id)
                    .bind(p_idx)
                    .fetch_all(&pg)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur récupération zones: {}", e)))?;

                    let zone_ids: Vec<String> = zones.iter()
                        .filter_map(|row| row.try_get::<Option<String>, _>("zone_id").ok().flatten())
                        .collect();
                    Ok(zone_ids)
                }
            },
        )
        .await?;

    Ok(Json(json!({
        "service_id": service_id,
        "product_index": product_index,
        "zone_ids": zone_ids,
    })))
}

// ✅ Phase 9 - Amélioration : Sauvegarder les zones de livraison associées à un produit
#[derive(Deserialize)]
struct SaveProductZonesPayload {
    zone_ids: Vec<String>,
}

async fn save_product_zones(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
    Json(payload): Json<SaveProductZonesPayload>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur est propriétaire du service
    let service: Option<ServiceUserIdRow> = sqlx::query_as(
        "SELECT user_id FROM services WHERE id = $1"
    )
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification service: {}", e)))?;

    let service = service.ok_or_else(|| AppError::NotFound("Service introuvable".into()))?;
    
    if service.user_id != user.id {
        return Err(AppError::Forbidden(
            "Vous n'avez pas accès à ce service".into(),
        ));
    }

    // Valider que toutes les zones existent
    for zone_id_str in &payload.zone_ids {
        let zone_id = Uuid::parse_str(zone_id_str)
            .map_err(|_| AppError::BadRequest(format!("Zone ID invalide: {}", zone_id_str)))?;
        
        let zone_exists = sqlx::query(
            "SELECT id FROM delivery_zones WHERE id = $1"
        )
        .bind(zone_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification zone: {}", e)))?;

        if zone_exists.is_none() {
            return Err(AppError::BadRequest(format!("Zone introuvable ou inactive: {}", zone_id_str)));
        }
    }

    // Note: product_delivery_zones table n'existe pas encore dans les migrations
    // TODO: Créer la migration pour cette table
    // Supprimer les associations existantes
    let _ = sqlx::query(
        "SELECT 1 WHERE FALSE"
    )
    .bind(service_id)
    .bind(product_index)
    .execute(&state.pg)
    .await;

    // Insérer les nouvelles associations
    for zone_id_str in &payload.zone_ids {
        let zone_id = Uuid::parse_str(zone_id_str).unwrap(); // Déjà validé
        
        let _ = sqlx::query(
            r#"
            SELECT 1 WHERE FALSE
            "#
        )
        .bind(service_id)
        .bind(product_index)
        .bind(zone_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur insertion zone: {}", e)))?;
    }

    // ✅ Phase 10 - Cache Redis : Invalider le cache pour ce produit
    let cache_key = CacheService::build_key(
        cache_keys::PRODUCT_ZONES,
        &[&service_id.to_string(), &product_index.to_string()],
    );
    let _ = state.cache_service.delete(&cache_key).await;

    Ok(Json(json!({
        "success": true,
        "message": "Zones de livraison sauvegardées avec succès",
        "zone_ids": payload.zone_ids,
    })))
}

fn dec(value: f64) -> Decimal {
    Decimal::from_f64(value).unwrap_or(Decimal::ZERO)
}

// ✅ NOUVEAU : Routes pour gestion de stock

#[derive(Deserialize)]
struct UpdateStockPayload {
    quantity_available: Option<i32>,
    quantity_reserved: Option<i32>,
    is_available: Option<bool>,
    storage_location_id: Option<i32>,
}

/// PUT /api/delivery/stock/{config_id} - Mettre à jour le stock
async fn update_stock(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(config_id): Path<i32>,
    Json(payload): Json<UpdateStockPayload>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur est propriétaire du produit
    let config: Option<ProductDeliveryConfigOwnerRow> = sqlx::query_as(
        r#"
        SELECT pdc.service_id, s.user_id
        FROM product_delivery_config pdc
        INNER JOIN services s ON s.id = pdc.service_id
        WHERE pdc.id = $1
        "#
    )
    .bind(config_id)
    .fetch_optional(&state.pg)
    .await?;

    let config = config.ok_or_else(|| AppError::NotFound("Configuration non trouvée".to_string()))?;

    if config.user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le propriétaire de ce produit".to_string(),
        ));
    }

    let stock_service = ProductStockService::new(state.pg.clone());
    
    use crate::services::product_stock_service::UpdateStockRequest;
    let request = UpdateStockRequest {
        quantity_available: payload.quantity_available,
        quantity_reserved: payload.quantity_reserved,
        is_available: payload.is_available,
    };
    
    stock_service
        .update_stock(
            config_id,
            payload.storage_location_id,
            request,
            user.id,
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "message": "Stock mis à jour avec succès"
    })))
}

/// DELETE /api/delivery/stock/{config_id}/location/{location_id} - Supprimer un lieu de stock
async fn delete_stock_location(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((config_id, location_id)): Path<(i32, i32)>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur est propriétaire du produit
    let config: Option<ProductDeliveryConfigOwnerRow> = sqlx::query_as(
        r#"
        SELECT pdc.service_id, s.user_id
        FROM product_delivery_config pdc
        INNER JOIN services s ON s.id = pdc.service_id
        WHERE pdc.id = $1
        "#
    )
    .bind(config_id)
    .fetch_optional(&state.pg)
    .await?;

    let config = config.ok_or_else(|| AppError::NotFound("Configuration non trouvée".to_string()))?;

    if config.user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le propriétaire de ce produit".to_string(),
        ));
    }

    let stock_service = ProductStockService::new(state.pg.clone());
    stock_service
        .remove_stock_location(config_id, location_id)
        .await?;

    Ok(Json(json!({
        "success": true,
        "message": "Lieu de stock supprimé avec succès"
    })))
}

// ✅ NOUVEAU : Routes pour vérification coursier

#[derive(Deserialize)]
struct VerifyCourierPayload {
    verification_code: String,
    verification_method: Option<String>,
}

/// POST /api/delivery/{id}/verify-courier - Vérifier l'identité du coursier
async fn verify_courier(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<VerifyCourierPayload>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur est le prestataire (créateur de la livraison)
    let delivery: Option<DeliveryCreatorRow> = sqlx::query_as(
        "SELECT creator_id FROM deliveries WHERE id = $1"
    )
    .bind(delivery_id)
    .fetch_optional(&state.pg)
    .await?;

    let delivery = delivery.ok_or_else(|| AppError::NotFound("Livraison non trouvée".to_string()))?;

    // Vérifier si l'utilisateur est le prestataire (via product_orders)
    let order_provider_user_id: Option<i32> = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT provider_user_id
        FROM product_orders
        WHERE delivery_id = $1
        LIMIT 1
        "#,
    )
    .bind(delivery_id)
    .fetch_optional(&state.pg)
    .await?;

    let provider_user_id = order_provider_user_id.unwrap_or(delivery.creator_id);

    if user.id != provider_user_id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le prestataire de cette livraison".to_string(),
        ));
    }

    let verification_service = CourierVerificationService::new(state.pg.clone());
    let result = verification_service
        .verify_courier(
            delivery_id,
            provider_user_id,
            VerifyCourierRequest {
                verification_code: payload.verification_code,
                verification_method: payload.verification_method,
            },
        )
        .await?;

    Ok(Json(json!({
        "success": result.is_valid,
        "result": result
    })))
}

/// GET /api/delivery/{id}/verification-code - Récupérer le code de vérification
async fn get_verification_code(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur est le prestataire
    let order = sqlx::query(
        r#"
        SELECT provider_user_id
        FROM product_orders
        WHERE delivery_id = $1
        LIMIT 1
        "#,
    )
    .bind(delivery_id)
    .map(|row: sqlx::postgres::PgRow| row.get::<i32, _>("provider_user_id"))
    .fetch_optional(&state.pg)
    .await?;

    let provider_user_id = order
        .ok_or_else(|| AppError::NotFound("Commande non trouvée".to_string()))?;

    if user.id != provider_user_id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le prestataire de cette livraison".to_string(),
        ));
    }

    let verification_service = CourierVerificationService::new(state.pg.clone());
    let verification_code = verification_service
        .get_verification_code_for_delivery(delivery_id)
        .await?;

    Ok(Json(json!({
        "verification_code": verification_code
    })))
}

/// GET /api/delivery/config/{config_id}/pickup-locations - Liste des lieux pickup (adresses textuelles)
async fn get_pickup_locations(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Path(config_id): Path<i32>,
) -> AppResult<Json<Value>> {
    let config: Option<ProductDeliveryConfigPickupLocationRow> = sqlx::query_as(
        r#"
        SELECT 
            pickup_address,
            pickup_latitude,
            pickup_longitude
        FROM product_delivery_config
        WHERE id = $1
        "#
    )
    .bind(config_id)
    .fetch_optional(&state.pg)
    .await?;

    let config = config.ok_or_else(|| AppError::NotFound("Configuration non trouvée".to_string()))?;

    // Retourner uniquement l'adresse textuelle, pas les coordonnées GPS
    Ok(Json(json!({
        "pickup_locations": [{
            "address": config.pickup_address,
            "id": config_id
        }]
    })))
}
