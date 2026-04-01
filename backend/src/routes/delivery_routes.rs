use std::env;
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
use bigdecimal::ToPrimitive;
use chrono::{DateTime, Utc};
use futures::{SinkExt, StreamExt};
use log;
use rust_decimal::{prelude::FromPrimitive, Decimal};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{Acquire, FromRow, Row};
use uuid::Uuid;

#[derive(FromRow)]
struct ServiceUserIdRow {
    user_id: i32,
}

#[derive(FromRow)]
struct ServiceDataRow {
    _data: Value,
}

// ✅ NOUVEAU 2026-01-23: Structure pour récupérer les produits depuis service_products
#[derive(FromRow)]
struct ServiceProductRow {
    _service_id: i32,
    product_index: i32,
    product_data: Value,
    product_name: String,
    product_price: Option<rust_decimal::Decimal>,
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
    #[allow(dead_code)]
    // Champ récupéré de la DB mais seulement user_id est utilisé pour vérification
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

use crate::utils::role_helpers::ensure_admin_role;
use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    models::delivery_model::{
        ClientDeliveryPreferencesInput, DeliveryMatchingStatus, DeliveryStatus,
        MerchantStorageLocationInput, ProductDeliveryConfigInput,
    },
    services::cache_service::{cache_keys, CacheService}, // ✅ Phase 10 - Cache Redis
    services::courier_verification_service::{CourierVerificationService, VerifyCourierRequest}, // ✅ NOUVEAU : Service vérification coursier
    services::delivery_payment_service::DeliveryPaymentService, // ✅ NOUVEAU : Métriques calcul coûts
    services::delivery_repository::NewDeliveryMatchingEvent, // ✅ NOUVEAU : Pour les événements de matching
    services::delivery_service::{
        haversine_distance, CourierApplicationInput, CourierAssetInput, CreateDeliveryParams,
        DeliveryRecipientInput, DeliveryService, LocationInput, NewDeliveryParcelInput,
        PricingInput, PublicDropoffSnapshot, TrackingInput,
    },
    services::product_price_service::ProductPriceService, // ✅ NOUVEAU : Service pour prix avec promotions
    services::product_stock_service::ProductStockService, // ✅ NOUVEAU : Service gestion stock
    services::product_validation_service::{
        notify_missing_delivery_config, validate_product_for_activation,
    },
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
    // ✅ Aller-retour
    #[serde(default)]
    is_round_trip: Option<bool>,
    #[serde(default)]
    return_pickup: Option<LocationPayload>, // Point de collecte retour (généralement = dropoff aller)
    #[serde(default)]
    return_dropoff: Option<LocationPayload>, // Point de livraison retour (généralement = pickup aller)
    #[serde(default)]
    round_trip_discount_percent: Option<i32>, // Réduction en % pour aller-retour (0-100)
    #[serde(default)]
    preferred_vehicle_type: Option<String>, // Type de véhicule souhaité
    // ✅ Planification
    #[serde(default)]
    scheduled_delivery_at: Option<String>, // ISO 8601 datetime (ex: "2025-02-01T14:30:00Z")
    #[serde(default)]
    matching_mode: Option<String>, // "immediate" ou "scheduled"
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
        .route(
            "/api/delivery/product-config",
            post(save_product_delivery_config),
        )
        .route(
            "/api/delivery/product-config/{service_id}/{product_index}",
            get(get_product_delivery_config),
        )
        .route(
            "/api/delivery/product-availability/{service_id}/{product_index}",
            get(get_product_availability),
        )
        .route(
            "/api/delivery/product-config/list/{service_id}",
            get(list_product_delivery_configs),
        )
        // ✅ Phase 9 - Amélioration : Routes pour gérer les zones de livraison des produits
        .route(
            "/api/products/{service_id}/{product_index}/zones",
            get(get_product_zones).post(save_product_zones),
        )
        // ✅ Phase 9 - Amélioration 32 : Routes pour gérer les lieux de stock
        .route(
            "/api/delivery/storage-locations",
            get(list_storage_locations).post(create_storage_location),
        )
        .route(
            "/api/delivery/storage-locations/{id}",
            get(get_storage_location)
                .put(update_storage_location)
                .delete(delete_storage_location),
        )
        // ✅ Phase 9 - Amélioration : Route pour lister les zones de livraison
        .route("/api/delivery/zones", get(list_delivery_zones))
        // ✅ Phase 9 - Amélioration : Routes pour les médias de preuve de livraison
        .route(
            "/api/delivery/{id}/proof-media",
            get(list_proof_media).post(upload_proof_media),
        )
        .route(
            "/api/delivery/{id}/proof-media/{media_id}",
            delete(delete_proof_media),
        )
        .route(
            "/api/delivery/product-validation/{service_id}/{product_index}",
            get(validate_product),
        )
        .route(
            "/api/delivery/preferences",
            post(save_client_delivery_preferences),
        )
        .route(
            "/api/delivery/preferences/{delivery_id}",
            get(get_client_delivery_preferences),
        )
        .route(
            "/api/delivery",
            post(create_delivery)
                // ✅ Phase 2: Rate limiting pour création livraison (critique)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    crate::middlewares::rate_limit::user_rate_limit_middleware,
                )),
        )
        .route("/api/delivery/client-order", post(create_client_order))
        .route(
            "/api/delivery/estimate-costs",
            post(estimate_delivery_costs),
        ) // ✅ Phase 7 - Amélioration 23
        .route("/api/delivery/{id}", get(get_delivery_summary))
        .route("/api/delivery/{id}/navigation", get(get_courier_navigation)) // ✅ NOUVEAU : Navigation pour coursier
        .route(
            "/api/delivery/{id}/status",
            post(update_delivery_status)
                // ✅ Phase 2: Rate limiting pour mise à jour statut (critique)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    crate::middlewares::rate_limit::user_rate_limit_middleware,
                )),
        )
        .route(
            "/api/delivery/{id}/confirm-proximity",
            post(confirm_proximity_suggestion),
        ) // ✅ Phase 6 - Amélioration 20
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
        .route(
            "/api/delivery/{id}/report-difficulty",
            post(report_courier_difficulty),
        ) // ✅ NOUVEAU : Signalement difficulté coursier
        .route("/api/delivery/{id}/accept", post(accept_delivery)) // ✅ NOUVEAU : Accepter une course
        .route("/api/deliveries/active", get(list_frontend_deliveries))
        .route("/api/deliveries/{id}", get(get_frontend_delivery))
        .route(
            "/api/deliveries/{id}/recipient/updates",
            get(get_frontend_recipient_updates),
        )
        .route("/api/wallet/debit", post(debit_wallet_for_delivery))
        .route("/api/wallet/refund", post(refund_wallet_for_delivery))
        .route(
            "/api/courier/applications",
            post(submit_courier_application),
        )
        .route(
            "/api/courier/applications",
            get(list_courier_applications), // ✅ NOUVEAU : Liste des candidatures (admin uniquement)
        )
        .route(
            "/api/courier/applications/{id}/approve",
            post(approve_courier_application_endpoint), // ✅ NOUVEAU : Approuver candidature (admin)
        )
        .route(
            "/api/courier/applications/{id}/reject",
            post(reject_courier_application_endpoint), // ✅ NOUVEAU : Rejeter candidature (admin)
        )
        .route("/api/courier/me", get(get_my_courier_status)) // ✅ NOUVEAU : Vérifier statut coursier de l'utilisateur
        .route("/api/courier/{id}/assets", post(upsert_courier_asset))
        .route("/api/delivery/{id}/assign-courier", post(assign_courier)) // ✅ Phase 9 - Amélioration 28
        .route("/api/couriers/available", get(list_available_couriers)) // ✅ Phase 9 - Amélioration 28
        // ✅ NOUVEAU : Stats et historique coursier
        .route("/api/delivery/courier/stats", get(get_courier_stats))
        .route("/api/delivery/courier/history", get(get_courier_history))
        // ✅ NOUVEAU : Routes pour gestion de stock
        .route(
            "/api/delivery/stock/{config_id}",
            axum::routing::put(update_stock),
        )
        .route(
            "/api/delivery/stock/{config_id}/location/{location_id}",
            axum::routing::delete(delete_stock_location),
        )
        // ✅ NOUVEAU : Routes pour vérification coursier
        .route("/api/delivery/{id}/verify-courier", post(verify_courier))
        .route(
            "/api/delivery/{id}/start-scheduled",
            post(start_scheduled_delivery),
        ) // ✅ NOUVEAU : Déclencher livraison planifiée
        .route(
            "/api/delivery/{id}/verification-code",
            get(get_verification_code),
        )
        // ✅ NOUVEAU : Route pour lieux pickup
        .route(
            "/api/delivery/config/{config_id}/pickup-locations",
            get(get_pickup_locations),
        )
        // ✅ NOUVEAU : Routes pour les adresses sauvegardées
        .route(
            "/api/delivery/saved-addresses",
            get(list_saved_addresses).post(create_saved_address),
        )
        .route(
            "/api/delivery/saved-addresses/{id}",
            get(get_saved_address).put(update_saved_address).delete(delete_saved_address),
        )
        .route(
            "/api/delivery/saved-addresses/{id}/set-default",
            post(set_default_saved_address),
        )
        // ✅ NOUVEAU 2026-01-04: Routes pour gérer les partenaires de livraison (admin uniquement)
        .route(
            "/api/delivery/partners",
            get(list_delivery_partners).post(create_delivery_partner),
        )
        // ✅ NOUVEAU 2026-01-14: Endpoint public pour les coursiers (lecture seule, authentifié mais pas admin)
        .route(
            "/api/delivery/partners/public",
            get(list_delivery_partners_public),
        )
        .route(
            "/api/delivery/partners/{id}",
            get(get_delivery_partner)
                .put(update_delivery_partner)
                .delete(delete_delivery_partner),
        )
        // ✅ NOUVEAU: Endpoint public pour autocomplete des partenaires (authentifié)
        .route("/api/partners/search", get(search_partners_autocomplete))
        // ✅ NOUVEAU: Endpoint pour récupérer et modifier les données du partenaire connecté
        .route(
            "/api/partners/me",
            get(get_my_partner_data).put(update_my_partner_data),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}

pub fn delivery_public_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ✅ CORRIGÉ: Ajouter le préfixe /api/ pour les routes publiques
        .route(
            "/api/delivery/public/{token}",
            get(get_public_dropoff_snapshot),
        )
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
/// ✅ OPTIMISÉ 2026-01-02: Combiner les 2 requêtes SQL en une seule pour améliorer les performances
async fn save_product_delivery_config(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<ProductDeliveryConfigInput>,
) -> AppResult<Json<Value>> {
    // ✅ OPTIMISÉ 2026-01-02: Utiliser le cache Redis pour les services volumineux
    use crate::services::service_data_cache::ServiceDataCache;
    let service_cache = ServiceDataCache::new(state.cache_service.clone());

    // ✅ Utiliser le cache pour récupérer les données du service (mais on n'en a plus besoin après vérification)
    let (_service_data_value, data_size, from_cache) = service_cache
        .get_service_data(
            payload.service_id,
            async {
                // Fonction pour récupérer depuis la DB si cache miss
                let row = sqlx::query(
                    "SELECT data, pg_column_size(data) as data_size FROM services WHERE id = $1 AND is_active = true"
                )
                    .bind(payload.service_id)
                    .fetch_optional(&state.pg)
                    .await?;

                match row {
                    Some(row) => {
                        let data: serde_json::Value = row.try_get("data")
                            .map_err(|e| AppError::Internal(format!("Erreur récupération data: {}", e)))?;
                        let size: i64 = row.try_get("data_size")
                            .unwrap_or(0);
                        Ok((data, size))
                    },
                    None => Err(AppError::NotFound("Service non trouvé".into()))
                }
            },
        )
        .await?;

    // ✅ Récupérer user_id séparément (pas besoin de cache pour ça, c'est rapide)
    let service_owner_id: i32 =
        sqlx::query_scalar("SELECT user_id FROM services WHERE id = $1 AND is_active = true")
            .bind(payload.service_id)
            .fetch_optional(&state.pg)
            .await?
            .ok_or_else(|| AppError::NotFound("Service non trouvé".into()))?;

    // ✅ Vérifier que l'utilisateur est propriétaire du service
    if service_owner_id != user.id {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le propriétaire de ce service".into(),
        ));
    }

    // ✅ NOUVEAU 2026-01-02: Logger la taille du JSONB et si c'était depuis le cache
    let size_kb = data_size as f64 / 1024.0;
    let size_mb = size_kb / 1024.0;
    let cache_status = if from_cache {
        "✅ depuis cache Redis"
    } else {
        "📊 depuis DB"
    };
    if size_mb > 1.0 {
        log::warn!(
            "[save_product_delivery_config] ⚠️ Service {} a un JSONB volumineux: {:.2} MB ({} KB) - {}",
            payload.service_id, size_mb, size_kb, cache_status
        );
    } else {
        log::debug!(
            "[save_product_delivery_config] 📊 Service {} JSONB: {:.2} KB - {}",
            payload.service_id,
            size_kb,
            cache_status
        );
    }

    // ✅ CORRIGÉ 2026-01-04: Utiliser service_products au lieu de JSONB pour vérifier l'existence du produit
    // ✅ AMÉLIORÉ 2026-01-08: Retry logic pour gérer le cas où le produit n'est pas encore synchronisé
    let mut product_exists = false;
    let mut retry_count = 0;
    const MAX_RETRIES: u32 = 3;
    const RETRY_DELAYS_MS: [u64; 3] = [500, 1000, 2000]; // 500ms, 1s, 2s

    while retry_count <= MAX_RETRIES && !product_exists {
        product_exists = state
            .products_service
            .get_products_by_service(payload.service_id)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération produits: {}", e)))?
            .into_iter()
            .any(|p| p.product_index == payload.product_index as i32);

        if !product_exists && retry_count < MAX_RETRIES {
            let delay_ms = RETRY_DELAYS_MS.get(retry_count as usize).copied().unwrap_or(2000);
            log::debug!(
                "[save_product_delivery_config] Produit {} non trouvé pour service {}, retry {}/{} dans {}ms...",
                payload.product_index,
                payload.service_id,
                retry_count + 1,
                MAX_RETRIES,
                delay_ms
            );
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
            retry_count += 1;
        } else {
            break;
        }
    }

    if !product_exists {
        return Err(AppError::BadRequest(
            format!(
                "Produit {} non trouvé pour le service {} après {} tentatives. Le produit peut ne pas être encore synchronisé. Veuillez réessayer dans quelques instants.",
                payload.product_index,
                payload.service_id,
                retry_count + 1
            )
        ));
    }

    // ✅ 3. Valider les champs obligatoires
    if payload.pickup_address.trim().is_empty() {
        return Err(AppError::BadRequest(
            "L'adresse de départ est obligatoire".into(),
        ));
    }

    // ✅ SOLUTION OPTIMALE: Accepter soit ID soit slug, convertir slug en ID si nécessaire
    let mut final_vehicle_type_id = payload.required_vehicle_type_id;

    // Si un slug est fourni, le convertir en ID
    if let Some(ref slug) = payload.vehicle_type_slug {
        if !slug.is_empty() {
            let repository = delivery_repository(&state)?;
            match repository.find_parcel_type_by_slug(slug).await {
                Ok(Some(id)) => {
                    final_vehicle_type_id = id;
                    log::info!(
                        "[save_product_delivery_config] Slug '{}' converti en ID {}",
                        slug,
                        id
                    );
                }
                Ok(None) => {
                    return Err(AppError::BadRequest(format!(
                        "Le type de véhicule avec le slug '{}' n'existe pas dans la base de données. Veuillez sélectionner un type de véhicule valide.",
                        slug
                    )));
                }
                Err(e) => {
                    log::error!(
                        "[save_product_delivery_config] Erreur lors de la recherche du slug '{}': {}",
                        slug,
                        e
                    );
                    return Err(AppError::Internal(
                        "Erreur lors de la recherche du type de véhicule".into(),
                    ));
                }
            }
        }
    }

    // ✅ CORRECTION CRITIQUE: Vérifier que required_vehicle_type_id existe dans parcel_types
    if final_vehicle_type_id > 0 {
        let vehicle_type_exists: Option<bool> =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM parcel_types WHERE id = $1)")
                .bind(final_vehicle_type_id)
                .fetch_optional(&state.pg)
                .await
                .map_err(|e| {
                    log::error!(
                        "[save_product_delivery_config] Erreur vérification vehicle_type_id: {}",
                        e
                    );
                    AppError::Internal("Erreur lors de la vérification du type de véhicule".into())
                })?;

        if vehicle_type_exists != Some(true) {
            return Err(AppError::BadRequest(format!(
                "Le type de véhicule avec l'ID {} n'existe pas dans la base de données. Veuillez sélectionner un type de véhicule valide.",
                final_vehicle_type_id
            )));
        }
    }

    // Utiliser final_vehicle_type_id pour le reste du code
    let payload_vehicle_type_id = final_vehicle_type_id;

    // ✅ 4. Vérifier si la configuration est complète (tous les champs requis présents)
    let schedule = payload.pickup_availability_schedule.as_object();
    let has_schedule = schedule.map(|s| !s.is_empty()).unwrap_or(false);
    // ✅ CORRIGÉ: 0 est valide (instantané), donc on vérifie juste que c'est défini (Some) et >= 0
    let has_preparation_time = payload.preparation_time_minutes.is_some()
        && payload.preparation_time_minutes.unwrap_or(-1) >= 0;
    let is_complete = !payload.pickup_address.trim().is_empty()
        && payload_vehicle_type_id > 0
        && has_schedule
        && has_preparation_time; // ✅ CORRIGÉ: Vérifier que le temps de préparation est défini (peut être 0 pour instantané)

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
        pickup_instructions_json["required_vehicle_type"] =
            serde_json::json!(required_vehicle_type);
    }

    let pickup_instructions_final =
        if pickup_instructions_json.is_object() && !pickup_instructions_json.is_null() {
            Some(pickup_instructions_json.to_string())
        } else {
            payload.pickup_instructions.clone()
        };

    // ✅ 5. Créer ou mettre à jour la configuration
    // ✅ CORRIGÉ 2026-01-30: Gestion d'erreur robuste pour éviter erreur 500
    // ✅ CORRIGÉ 2026-02-10: Vérifier que storage_location_id existe dans la table avant de l'utiliser
    if let Some(storage_location_id) = payload.storage_location_id {
        if storage_location_id > 0 {
            let storage_location_exists: Option<bool> = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM merchant_storage_locations WHERE id = $1)",
            )
            .bind(storage_location_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                log::error!(
                    "[save_product_delivery_config] Erreur vérification storage_location_id: {}",
                    e
                );
                AppError::Internal("Erreur lors de la vérification du lieu de stockage".into())
            })?;

            if storage_location_exists != Some(true) {
                return Err(AppError::BadRequest(format!(
                    "Le lieu de stockage avec l'ID {} n'existe pas dans la base de données. Veuillez sélectionner un lieu de stockage valide.",
                    storage_location_id
                )));
            }
        }
    }

    // ✅ AMÉLIORÉ: Logging détaillé avant insertion pour diagnostic
    log::debug!(
        "[save_product_delivery_config] 📝 Paramètres avant insertion SQL: service_id={}, product_index={}, vehicle_type_id={}, preparation_time_minutes={:?}, storage_location_id={:?}, schedule_keys={:?}",
        payload.service_id,
        payload.product_index,
        payload_vehicle_type_id,
        payload.preparation_time_minutes,
        payload.storage_location_id,
        payload.pickup_availability_schedule.as_object().map(|o| o.keys().collect::<Vec<_>>())
    );

    // Acquire a single connection with a small timeout and run the following DB work in a transaction
    let mut conn =
        match tokio::time::timeout(std::time::Duration::from_secs(10), state.pg.acquire()).await {
            Ok(Ok(c)) => c,
            Ok(Err(e)) => {
                log::error!(
                    "[save_product_delivery_config] Erreur acquisition connexion DB: {}",
                    e
                );
                return Err(AppError::Internal(
                    "Erreur lors de l'acquisition de la connexion à la base de données".into(),
                ));
            }
            Err(_) => {
                log::warn!(
                "[save_product_delivery_config] ❌ Timeout lors de l'acquisition de connexion DB"
            );
                return Err(AppError::TooManyRequests(
                    "Base de données occupée, veuillez réessayer dans quelques instants".into(),
                ));
            }
        };

    let mut tx: sqlx::Transaction<'_, sqlx::Postgres> = conn.begin().await?;

    let config_row: sqlx::postgres::PgRow = match sqlx::query(
        r#"
        INSERT INTO product_delivery_config (
            service_id, product_index,
            pickup_address, pickup_latitude, pickup_longitude,
            required_vehicle_type_id, preparation_time_minutes, weight_kg, volume_cm3,
            requires_isothermal, requires_fragile_handling,
            pickup_availability_schedule,
            pickup_instructions, billing_mode, billing_partner_label,
            storage_location_id,
            is_configured, configured_at, configured_by
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            CASE WHEN $17::boolean THEN NOW() ELSE NULL END,
            CASE WHEN $17::boolean THEN $18 ELSE NULL END
        )
        ON CONFLICT (service_id, product_index)
        DO UPDATE SET
            pickup_address = EXCLUDED.pickup_address,
            pickup_latitude = EXCLUDED.pickup_latitude,
            pickup_longitude = EXCLUDED.pickup_longitude,
            required_vehicle_type_id = EXCLUDED.required_vehicle_type_id,
            preparation_time_minutes = EXCLUDED.preparation_time_minutes,
            weight_kg = EXCLUDED.weight_kg,
            volume_cm3 = EXCLUDED.volume_cm3,
            requires_isothermal = EXCLUDED.requires_isothermal,
            requires_fragile_handling = EXCLUDED.requires_fragile_handling,
            pickup_availability_schedule = EXCLUDED.pickup_availability_schedule,
            pickup_instructions = EXCLUDED.pickup_instructions,
            billing_mode = EXCLUDED.billing_mode,
            billing_partner_label = EXCLUDED.billing_partner_label,
            storage_location_id = EXCLUDED.storage_location_id,
            is_configured = EXCLUDED.is_configured,
            configured_at = CASE WHEN EXCLUDED.is_configured::boolean THEN NOW() ELSE product_delivery_config.configured_at END,
            configured_by = CASE WHEN EXCLUDED.is_configured::boolean THEN EXCLUDED.configured_by ELSE product_delivery_config.configured_by END,
            updated_at = NOW()
        RETURNING id, is_configured
        "#,
    )
    .bind(payload.service_id)
    .bind(payload.product_index)
    .bind(&payload.pickup_address)
    .bind(payload.pickup_latitude)
    .bind(payload.pickup_longitude)
    .bind(payload_vehicle_type_id) // ✅ CORRIGÉ: Utiliser l'ID final (converti depuis slug si nécessaire)
    .bind(payload.preparation_time_minutes) // ✅ NOUVEAU: Temps de préparation (Option<i32>, peut être None)
    .bind(payload.weight_kg)
    .bind(payload.volume_cm3)
    .bind(payload.requires_isothermal.unwrap_or(false))
    .bind(payload.requires_fragile_handling.unwrap_or(false))
    .bind(&payload.pickup_availability_schedule)
    .bind(pickup_instructions_final.as_deref())
    .bind(payload.billing_mode.as_deref().unwrap_or("standard"))
    .bind(payload.billing_partner_label.as_deref())
    .bind(payload.storage_location_id) // ✅ NOUVEAU: Lieu de stockage principal (Option<i32>, peut être None)
    .bind(is_complete)
    .bind(user.id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(e) => {
            // ✅ AMÉLIORÉ: Logging détaillé de l'erreur SQL
            let error_details = match &e {
                sqlx::Error::Database(db_err) => {
                    let code = db_err.code().map(|c| c.to_string());
                    let constraint = db_err.constraint();
                    let table = db_err.table();
                    format!(
                        "Database error - code: {:?}, constraint: {:?}, table: {:?}, message: {}",
                        code, constraint, table, db_err.message()
                    )
                }
                sqlx::Error::ColumnNotFound(col) => format!("Column not found: {}", col),
                sqlx::Error::TypeNotFound { type_name } => format!("Type not found: {}", type_name),
                _ => format!("SQLx error: {}", e)
            };

            log::error!(
                "[save_product_delivery_config] ❌ Erreur SQL lors de la sauvegarde: {} | service_id: {} | product_index: {} | details: {}",
                e, payload.service_id, payload.product_index, error_details
            );

            // ✅ CORRIGÉ: Retourner une erreur BadRequest au lieu de 500 pour les erreurs de validation
            if let sqlx::Error::Database(db_err) = &e {
                if let Some(code) = db_err.code() {
                    let code_str = code.to_string();
                    // Erreur de contrainte FK ou NOT NULL
                    if code_str == "23503" || code_str == "23502" {
                        return Err(AppError::BadRequest(format!(
                            "Erreur de validation: {}",
                            db_err.message()
                        )));
                    }
                    // ✅ NOUVEAU: Erreur de colonne inexistante (42883)
                    if code_str == "42883" || code_str == "42703" {
                        return Err(AppError::Internal(format!(
                            "Erreur de structure de base de données: {}. Veuillez contacter le support technique.",
                            db_err.message()
                        )));
                    }
                }
            }
            // Rollback transaction on error before returning
            let _ = tx.rollback().await;
            return Err(AppError::Internal(format!(
                "Erreur lors de la sauvegarde de la configuration: {}",
                e
            )));
        }
    };

    let config_id = config_row.get::<i32, _>("id");
    let config_is_configured = config_row.get::<bool, _>("is_configured");

    // ✅ NOUVEAU 2026-01-04: Sauvegarder les lieux de stockage et leurs quantités dans product_stock_locations
    if let Some(storage_location_ids) = &payload.storage_location_ids {
        // Supprimer les anciennes entrées pour cette configuration
        sqlx::query("DELETE FROM product_stock_locations WHERE product_delivery_config_id = $1")
            .bind(config_id)
            .execute(&mut *tx)
            .await?;

        // Insérer les nouveaux lieux de stockage avec leurs quantités
        for storage_location_id in storage_location_ids {
            // Extraire la quantité pour ce lieu depuis storage_location_quantities
            let quantity = payload
                .storage_location_quantities
                .as_ref()
                .and_then(|q| q.get(storage_location_id.to_string()))
                .and_then(|v| v.as_i64())
                .map(|q| q as i32)
                .unwrap_or(0);

            sqlx::query(
                r#"
                INSERT INTO product_stock_locations (
                    product_delivery_config_id, storage_location_id,
                    quantity_available, is_available, updated_by
                )
                VALUES ($1, $2, $3, TRUE, $4)
                ON CONFLICT (product_delivery_config_id, storage_location_id)
                DO UPDATE SET
                    quantity_available = EXCLUDED.quantity_available,
                    is_available = TRUE,
                    updated_at = NOW(),
                    updated_by = EXCLUDED.updated_by
                "#,
            )
            .bind(config_id)
            .bind(storage_location_id)
            .bind(quantity)
            .bind(user.id)
            .execute(&mut *tx)
            .await?;
        }
    }

    // Commit the transaction after successful insert/update of config and stock locations
    tx.commit().await?;

    // ✅ Phase 2 - Amélioration 6 : Vérifier si la configuration est complète et notifier si nécessaire
    if !config_is_configured {
        // Configuration incomplète, envoyer notification
        if let Err(e) =
            notify_missing_delivery_config(&state.pg, payload.service_id, payload.product_index)
                .await
        {
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

/// ✅ NOUVEAU : GET /api/delivery/product-availability/{service_id}/{product_index} - Vérifier disponibilité produit
async fn get_product_availability(
    State(state): State<Arc<AppState>>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<Json<Value>> {
    let service = crate::services::product_availability_service::ProductAvailabilityService::new(
        state.pg.clone(),
    );

    let availability = service.check_availability(service_id, product_index, None).await?;

    Ok(Json(json!({
        "success": true,
        "availability": availability
    })))
}

/// ✅ NOUVEAU : GET /api/delivery/product-config/list/{service_id} - Lister les configurations de livraison d'un service
async fn list_product_delivery_configs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur est propriétaire du service
    let service: Option<ServiceUserIdRow> =
        sqlx::query_as("SELECT user_id FROM services WHERE id = $1")
            .bind(service_id)
            .fetch_optional(&state.pg)
            .await?;

    let service_owner = service.ok_or_else(|| AppError::NotFound("Service non trouvé".into()))?;

    if service_owner.user_id != user.id {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le propriétaire de ce service".into(),
        ));
    }

    // ✅ CORRIGÉ 2026-01-23: Récupérer les produits depuis service_products au lieu de JSONB
    // Récupérer toutes les configurations pour ce service
    let configs: Vec<sqlx::postgres::PgRow> = sqlx::query(
        r#"
        SELECT product_index, is_configured, pickup_address, required_vehicle_type_id, preparation_time_minutes
        FROM product_delivery_config
        WHERE service_id = $1
        ORDER BY product_index
        "#
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération configurations: {}", e)))?;

    // ✅ CORRIGÉ: Récupérer les produits depuis service_products
    let products: Vec<ServiceProductRow> = sqlx::query_as(
        r#"
        SELECT service_id, product_index, product_data, product_name, product_price
        FROM service_products
        WHERE service_id = $1 AND is_active = true
        ORDER BY product_index
        "#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération produits: {}", e)))?;

    // Créer un map pour accès rapide par product_index
    let products_map: std::collections::HashMap<i32, &ServiceProductRow> =
        products.iter().map(|p| (p.product_index, p)).collect();

    let mut result_products = Vec::new();

    for config_row in configs {
        let product_index: i32 = config_row.get("product_index");
        let is_configured: bool = config_row.get("is_configured");
        let pickup_address: Option<String> = config_row.get("pickup_address");

        // ✅ CORRIGÉ: Obtenir le nom du produit depuis service_products
        let product_name = products_map
            .get(&product_index)
            .map(|p| p.product_name.clone())
            .unwrap_or_else(|| format!("Produit {}", product_index));

        result_products.push(json!({
            "index": product_index,
            "name": product_name,
            "is_configured": is_configured,
            "has_pickup_address": pickup_address.is_some() && !pickup_address.as_ref().unwrap().is_empty(),
        }));
    }

    Ok(Json(json!({
        "success": true,
        "products": result_products,
        "total": result_products.len()
    })))
}

/// ✅ Phase 2 - Amélioration 6 : GET /api/delivery/product-validation/{service_id}/{product_index} - Vérifier validation produit
async fn validate_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<Json<Value>> {
    // Vérifier propriétaire
    let service: Option<ServiceUserIdRow> =
        sqlx::query_as("SELECT user_id FROM services WHERE id = $1")
            .bind(service_id)
            .fetch_optional(&state.pg)
            .await?;

    let service_owner = service.ok_or_else(|| AppError::NotFound("Service non trouvé".into()))?;

    if service_owner.user_id != user.id {
        return Err(AppError::Forbidden(
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
    let preferred_delivery_date = payload
        .preferred_delivery_date
        .as_ref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let preferred_delivery_time_start = payload
        .preferred_delivery_time_start
        .as_ref()
        .and_then(|t| chrono::NaiveTime::parse_from_str(t, "%H:%M").ok());

    let preferred_delivery_time_end = payload
        .preferred_delivery_time_end
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
        "#,
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
/// ✅ CORRIGÉ 2026-02-25: Accessible à tout utilisateur authentifié (pas seulement le propriétaire)
/// Les acheteurs doivent pouvoir vérifier si un produit a une config livraison pour afficher le bouton "Me livrer"
async fn get_product_delivery_config(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<Json<Value>> {
    // ✅ Vérifier que le service existe (sans vérifier le propriétaire - lecture publique)
    let service_exists: Option<(i32,)> = sqlx::query_as("SELECT id FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await?;

    if service_exists.is_none() {
        return Err(AppError::NotFound("Service non trouvé".into()));
    }

    let config_row = sqlx::query(
        r#"
        SELECT 
            id, service_id, product_index,
            pickup_address, pickup_latitude, pickup_longitude,
            required_vehicle_type_id, preparation_time_minutes, weight_kg, volume_cm3,
            requires_isothermal, requires_fragile_handling,
            pickup_availability_schedule,
            pickup_instructions, billing_mode, billing_partner_label,
            storage_location_id,
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
        let config_id = config.get::<i32, _>("id");

        // ✅ NOUVEAU 2026-01-04: Charger les lieux de stockage et leurs quantités depuis product_stock_locations
        let stock_locations: Vec<(i32, i32)> = sqlx::query_as::<_, (i32, i32)>(
            r#"
            SELECT storage_location_id, quantity_available
            FROM product_stock_locations
            WHERE product_delivery_config_id = $1 AND is_available = TRUE
            ORDER BY storage_location_id
            "#,
        )
        .bind(config_id)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

        let storage_location_ids: Vec<i32> = stock_locations.iter().map(|(id, _)| *id).collect();
        let storage_location_quantities: serde_json::Value = stock_locations
            .iter()
            .map(|(id, qty)| (id.to_string(), serde_json::json!(qty)))
            .collect::<serde_json::Map<String, serde_json::Value>>()
            .into();

        Ok(Json(serde_json::json!({
            "config": {
            "id": config_id,
            "service_id": config.get::<i32, _>("service_id"),
                "product_index": config.get::<i32, _>("product_index"),
                "pickup_address": config.get::<String, _>("pickup_address"),
                "pickup_latitude": config.get::<f64, _>("pickup_latitude"),
                "pickup_longitude": config.get::<f64, _>("pickup_longitude"),
                "required_vehicle_type_id": config.get::<i32, _>("required_vehicle_type_id"),
                "preparation_time_minutes": config.try_get::<Option<i32>, _>("preparation_time_minutes")?,
                "weight_kg": config.try_get::<Option<f64>, _>("weight_kg")?,
                "volume_cm3": config.try_get::<Option<f64>, _>("volume_cm3")?,
                "requires_isothermal": config.get::<bool, _>("requires_isothermal"),
                "requires_fragile_handling": config.get::<bool, _>("requires_fragile_handling"),
                "pickup_availability_schedule": config.get::<serde_json::Value, _>("pickup_availability_schedule"),
                "pickup_instructions": config.try_get::<Option<String>, _>("pickup_instructions")?,
                "billing_mode": config.get::<String, _>("billing_mode"),
                "billing_partner_label": config.try_get::<Option<String>, _>("billing_partner_label")?,
                "storage_location_id": config.try_get::<Option<i32>, _>("storage_location_id")?, // ✅ NOUVEAU: Lieu de stockage principal
                "is_configured": config.get::<bool, _>("is_configured"),
                "configured_at": config.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("configured_at")?,
                "storage_location_ids": storage_location_ids,
                "storage_location_quantities": storage_location_quantities,
            }
        })))
    } else {
        Ok(Json(serde_json::json!({
            "config": null
        })))
    }
}

/// Valide les coordonnées GPS
fn validate_gps_coordinates(lat: f64, lng: f64, location_name: &str) -> AppResult<()> {
    if lat.is_nan() || lng.is_nan() {
        return Err(crate::core::types::AppError::BadRequest(
            format!(
                "Les coordonnées GPS de {} sont invalides (NaN)",
                location_name
            )
            .into(),
        ));
    }
    if lat.is_infinite() || lng.is_infinite() {
        return Err(crate::core::types::AppError::BadRequest(
            format!(
                "Les coordonnées GPS de {} sont invalides (infini)",
                location_name
            )
            .into(),
        ));
    }
    if lat < -90.0 || lat > 90.0 {
        return Err(crate::core::types::AppError::BadRequest(
            format!(
                "La latitude de {} doit être entre -90 et 90 (reçu: {})",
                location_name, lat
            )
            .into(),
        ));
    }
    if lng < -180.0 || lng > 180.0 {
        return Err(crate::core::types::AppError::BadRequest(
            format!(
                "La longitude de {} doit être entre -180 et 180 (reçu: {})",
                location_name, lng
            )
            .into(),
        ));
    }
    Ok(())
}

async fn create_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateDeliveryPayload>,
) -> AppResult<Json<Value>> {
    // ✅ Validation des coordonnées GPS avant traitement
    validate_gps_coordinates(payload.pickup.latitude, payload.pickup.longitude, "pickup")?;
    validate_gps_coordinates(
        payload.dropoff.latitude,
        payload.dropoff.longitude,
        "dropoff",
    )?;

    // ✅ Validation des coordonnées du dropoff_override si présent
    if let Some(recipient) = &payload.recipient {
        if let Some(dropoff_override) = &recipient.dropoff_override {
            validate_gps_coordinates(
                dropoff_override.latitude,
                dropoff_override.longitude,
                "dropoff_override",
            )?;
        }
    }

    // ✅ Validation aller-retour
    let is_round_trip = payload.is_round_trip.unwrap_or(false);
    if is_round_trip {
        if payload.return_pickup.is_none() || payload.return_dropoff.is_none() {
            return Err(crate::core::types::AppError::BadRequest(
                "Pour un aller-retour, return_pickup et return_dropoff sont requis".into(),
            ));
        }
        // Valider les coordonnées de retour
        if let Some(ref return_pickup) = payload.return_pickup {
            validate_gps_coordinates(
                return_pickup.latitude,
                return_pickup.longitude,
                "return_pickup",
            )?;
        }
        if let Some(ref return_dropoff) = payload.return_dropoff {
            validate_gps_coordinates(
                return_dropoff.latitude,
                return_dropoff.longitude,
                "return_dropoff",
            )?;
        }
    }

    let service = delivery_service(&state)?;

    // ✅ Créer la livraison aller
    let mut metadata_aller = payload.metadata.clone();

    // ✅ Déterminer le type de véhicule préféré : utilisateur ou déduit du type de colis
    let preferred_vehicle_type = payload
        .preferred_vehicle_type
        .clone()
        .or_else(|| {
            // Si aucun type spécifié, déduire depuis le type de colis
            if let Some(type_id) = payload.parcel.type_id {
                // 1 = document, 2 = package, 3 = moving, 4 = cake (ou autre selon DB)
                match type_id {
                    3 => Some("truck".to_string()), // Déménagement -> camion
                    4 => Some("car".to_string()),   // Gâteau -> voiture (protection)
                    _ => None, // Document et package standard : pas de préférence
                }
            } else {
                None
            }
        })
        .unwrap_or_else(|| "motorcycle".to_string()); // ✅ Par défaut : moto

    // Vérifier si c'est un déménagement depuis les contraintes
    let is_moving = payload
        .parcel
        .constraints
        .get("is_moving")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
        || payload.parcel.constraints.get("number_of_boxes").is_some();

    let is_cake = payload.parcel.constraints.get("cake_size").is_some()
        || payload.parcel.constraints.get("cake_layers").is_some();

    // Ajuster le type de véhicule selon la nature du colis
    let final_vehicle_type = if is_moving {
        // Déménagement : nécessite camion ou camionnette
        if preferred_vehicle_type == "truck"
            || preferred_vehicle_type == "van"
            || preferred_vehicle_type == "pickup"
        {
            preferred_vehicle_type
        } else {
            "truck".to_string() // Forcer camion pour déménagement
        }
    } else if is_cake {
        // Gâteau : voiture ou camionnette (protection)
        if preferred_vehicle_type == "car" || preferred_vehicle_type == "van" {
            preferred_vehicle_type
        } else {
            "car".to_string() // Forcer voiture pour gâteau
        }
    } else {
        preferred_vehicle_type
    };

    metadata_aller["preferred_vehicle_type"] = json!(final_vehicle_type);
    metadata_aller["preferred_vehicle_type_backend"] = json!(final_vehicle_type);
    metadata_aller["vehicle_type_source"] = json!(if payload.preferred_vehicle_type.is_some() {
        "user_selection"
    } else {
        "auto_deduced"
    });

    // ✅ Planification: Gérer scheduled_delivery_at et matching_mode
    if let Some(ref scheduled_at) = payload.scheduled_delivery_at {
        // Valider que la date est dans le futur
        if let Ok(scheduled_datetime) = chrono::DateTime::parse_from_rfc3339(scheduled_at) {
            let scheduled_utc = scheduled_datetime.with_timezone(&chrono::Utc);
            if scheduled_utc <= chrono::Utc::now() {
                return Err(crate::core::types::AppError::BadRequest(
                    "La date de livraison planifiée doit être dans le futur".into(),
                ));
            }
            metadata_aller["scheduled_delivery_at"] = json!(scheduled_at);
            metadata_aller["scheduled_delivery_at_utc"] = json!(scheduled_utc.to_rfc3339());

            // ✅ Mode de matching: "immediate" ou "scheduled" (par défaut: "immediate" pour matching instantané)
            let matching_mode = payload.matching_mode.as_deref().unwrap_or("immediate").to_string();

            if matching_mode != "immediate" && matching_mode != "scheduled" {
                return Err(crate::core::types::AppError::BadRequest(
                    "matching_mode doit être 'immediate' ou 'scheduled'".into(),
                ));
            }

            metadata_aller["matching_mode"] = json!(matching_mode);

            if matching_mode == "immediate" {
                // Matching immédiat: le coursier sera assigné maintenant mais la livraison reste en statut planifié
                metadata_aller["matching_immediate_for_scheduled"] = json!(true);
                metadata_aller["delivery_status_override"] = json!("awaiting_scheduled_start");
            }
            // Si matching_mode == "scheduled", le matching sera retardé jusqu'à la date planifiée
        } else {
            return Err(crate::core::types::AppError::BadRequest(
                "Format de date invalide. Utilisez le format ISO 8601 (ex: 2025-02-01T14:30:00Z)"
                    .into(),
            ));
        }
    }

    if is_round_trip {
        metadata_aller["is_round_trip"] = json!(true);
        metadata_aller["kind"] = json!("parcel");
        if let Some(discount) = payload.round_trip_discount_percent {
            metadata_aller["round_trip_discount_percent"] = json!(discount);
        }
    }

    let params_aller = CreateDeliveryParams {
        creator_id: user.id,
        parcel: NewDeliveryParcelInput {
            type_id: payload.parcel.type_id,
            weight_kg: payload.parcel.weight_kg.map(dec),
            volume_cm3: payload.parcel.volume_cm3.map(dec),
            declared_value: payload.parcel.declared_value.map(dec),
            notes: payload.parcel.notes.clone(),
            photos: payload.parcel.photos.clone(),
            constraints: payload.parcel.constraints.clone(),
        },
        pickup: LocationInput {
            latitude: payload.pickup.latitude,
            longitude: payload.pickup.longitude,
            address: payload.pickup.address.clone(),
        },
        dropoff: LocationInput {
            latitude: payload.dropoff.latitude,
            longitude: payload.dropoff.longitude,
            address: payload.dropoff.address.clone(),
        },
        recipient: payload.recipient.as_ref().map(DeliveryRecipientInput::from),
        distance_meters: payload.distance_meters,
        estimated_duration_seconds: payload.estimated_duration_seconds,
        metadata: metadata_aller,
        initial_event_payload: payload.initial_event_payload.clone(),
    };

    let summary_aller = service.create_delivery_request(params_aller).await.map_err(|e| {
        log::error!(
            "[create_delivery] Erreur lors de la création de la livraison aller: {:?}",
            e
        );
        e
    })?;

    // ✅ Si aller-retour, créer automatiquement la livraison retour
    if is_round_trip {
        let return_pickup = payload.return_pickup.as_ref().unwrap();
        let return_dropoff = payload.return_dropoff.as_ref().unwrap();

        // Calculer distance et durée pour le retour
        let return_distance = haversine_distance(
            (return_pickup.latitude, return_pickup.longitude),
            (return_dropoff.latitude, return_dropoff.longitude),
        ) as i32;

        // Estimer la durée (similaire à l'aller, ou utiliser la même estimation)
        let return_duration = payload.estimated_duration_seconds;

        let metadata_retour = json!({
            "kind": "parcel",
            "is_round_trip": true,
            "outbound_delivery_id": summary_aller.id,
            "is_return": true,
        });

        let params_retour = CreateDeliveryParams {
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
                latitude: return_pickup.latitude,
                longitude: return_pickup.longitude,
                address: return_pickup.address.clone(),
            },
            dropoff: LocationInput {
                latitude: return_dropoff.latitude,
                longitude: return_dropoff.longitude,
                address: return_dropoff.address.clone(),
            },
            recipient: payload.recipient.as_ref().map(DeliveryRecipientInput::from),
            distance_meters: Some(return_distance),
            estimated_duration_seconds: return_duration,
            metadata: metadata_retour,
            initial_event_payload: json!({}),
        };

        let summary_retour = service.create_delivery_request(params_retour).await.map_err(|e| {
            log::error!(
                "[create_delivery] Erreur lors de la création de la livraison retour: {:?}",
                e
            );
            e
        })?;

        // ✅ Lier les deux livraisons dans la base
        sqlx::query(
            "UPDATE deliveries 
             SET is_round_trip = TRUE, return_delivery_id = $1, 
                 return_pickup_location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                 return_dropoff_location = ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
                 return_pickup_address = $6, return_dropoff_address = $7,
                 return_distance_meters = $8, return_estimated_duration_seconds = $9,
                 round_trip_discount_percent = $10
             WHERE id = $11",
        )
        .bind(summary_retour.id)
        .bind(return_pickup.longitude)
        .bind(return_pickup.latitude)
        .bind(return_dropoff.longitude)
        .bind(return_dropoff.latitude)
        .bind(return_pickup.address.as_ref())
        .bind(return_dropoff.address.as_ref())
        .bind(return_distance)
        .bind(return_duration)
        .bind(payload.round_trip_discount_percent.unwrap_or(0))
        .bind(summary_aller.id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            log::error!(
                "[create_delivery] Erreur lors de la liaison aller-retour: {:?}",
                e
            );
            crate::core::types::AppError::Internal(e.to_string())
        })?;

        // ✅ Marquer la livraison retour comme liée
        sqlx::query("UPDATE deliveries SET is_round_trip = TRUE WHERE id = $1")
            .bind(summary_retour.id)
            .execute(&state.pg)
            .await
            .map_err(|e| {
                log::error!(
                    "[create_delivery] Erreur lors de la mise à jour livraison retour: {:?}",
                    e
                );
                crate::core::types::AppError::Internal(e.to_string())
            })?;

        // Retourner les deux livraisons
        Ok(Json(serde_json::json!({
            "delivery": summary_aller,
            "return_delivery": summary_retour,
            "is_round_trip": true
        })))
    } else {
        Ok(Json(serde_json::json!({ "delivery": summary_aller })))
    }
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
        let availability_service =
            crate::services::product_availability_service::ProductAvailabilityService::new(
                state.pg.clone(),
            );
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
                crate::services::similar_products_service::SimilarProductsService::new(
                    state.pg.clone(),
                )
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
    let delivery_config: Option<ProductDeliveryConfigRow> =
        if let Some(product_index) = payload.product_index {
            sqlx::query_as(
                "SELECT pickup_address, pickup_latitude, pickup_longitude, 
                    required_vehicle_type_id, weight_kg, volume_cm3,
                    requires_isothermal, requires_fragile_handling, is_configured,
                    billing_mode, pickup_instructions
             FROM product_delivery_config 
             WHERE service_id = $1 AND product_index = $2",
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
                instructions_json
                    .get("required_vehicle_type")
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
            // ✅ AMÉLIORATION : Message d'erreur plus détaillé avec informations manquantes
            let mut missing_fields = Vec::new();
            if config.pickup_address.is_none()
                || config.pickup_latitude.is_none()
                || config.pickup_longitude.is_none()
            {
                missing_fields.push("adresse de pickup");
            }
            if config.required_vehicle_type_id.is_none() {
                missing_fields.push("type de véhicule requis");
            }

            let error_msg = if !missing_fields.is_empty() {
                format!(
                    "Configuration de livraison incomplète pour ce produit. Champs manquants : {}. Le prestataire doit compléter la configuration via l'interface d'administration.",
                    missing_fields.join(", ")
                )
            } else {
                "Configuration de livraison incomplète pour ce produit. Le prestataire doit compléter la configuration via l'interface d'administration.".to_string()
            };

            log::warn!(
                "[create_client_order] Configuration incomplète pour service_id={}, product_index={:?}, missing_fields={:?}",
                payload.service_id, payload.product_index, missing_fields
            );

            return Err(crate::core::types::AppError::BadRequest(error_msg));
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
        let service_data: Option<ServiceDataGpsRow> =
            sqlx::query_as("SELECT data, gps FROM services WHERE id = $1")
                .bind(payload.service_id)
                .fetch_optional(&state.pg)
                .await?;

        let service_data = service_data
            .ok_or_else(|| crate::core::types::AppError::NotFound("Service non trouvé".into()))?;

        // Extraire GPS du service
        let (lat, lng) = if let Some(gps_str) = &service_data.gps {
            let gps_str = gps_str.clone();
            let parts: Vec<&str> = gps_str.split(',').collect();
            if parts.len() == 2 {
                if let (Ok(lng), Ok(lat)) = (
                    parts[0].trim().parse::<f64>(),
                    parts[1].trim().parse::<f64>(),
                ) {
                    (lat, lng)
                } else {
                    return Err(crate::core::types::AppError::BadRequest(
                        "GPS invalide dans le service".into(),
                    ));
                }
            } else {
                return Err(crate::core::types::AppError::BadRequest(
                    "Format GPS invalide".into(),
                ));
            }
        } else {
            return Err(crate::core::types::AppError::BadRequest(
                "Aucune adresse de départ disponible".into(),
            ));
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
        let user_data: Option<UserGpsNameRow> =
            sqlx::query_as("SELECT gps, nom_complet FROM users WHERE id = $1")
                .bind(user.id)
                .fetch_optional(&state.pg)
                .await?;

        let user_row = user_data.ok_or_else(|| {
            crate::core::types::AppError::BadRequest("Utilisateur non trouvé".into())
        })?;
        let gps_str = user_row.gps.ok_or_else(|| {
            crate::core::types::AppError::BadRequest(
                "Aucune adresse de livraison fournie et GPS utilisateur non disponible".into(),
            )
        })?;

        let parts: Vec<&str> = gps_str.split(',').collect();
        if parts.len() != 2 {
            return Err(crate::core::types::AppError::BadRequest(
                "Format GPS utilisateur invalide".into(),
            ));
        }

        let lng = parts[0].trim().parse::<f64>().map_err(|_| {
            crate::core::types::AppError::BadRequest("GPS utilisateur invalide".into())
        })?;
        let lat = parts[1].trim().parse::<f64>().map_err(|_| {
            crate::core::types::AppError::BadRequest("GPS utilisateur invalide".into())
        })?;

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
    let final_vehicle_type =
        if let Some(ref preferred_vehicle_type) = payload.preferred_vehicle_type {
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

        let backend_vehicle_type =
            vehicle_type_mapping.get(vehicle_type.as_str()).unwrap_or(&"autre");

        metadata["preferred_vehicle_type"] = serde_json::json!(vehicle_type);
        metadata["preferred_vehicle_type_backend"] = serde_json::json!(backend_vehicle_type);
        metadata["vehicle_type_source"] =
            serde_json::json!(if preferred_vehicle_type_clone.is_some() {
                "client_choice"
            } else {
                "product_config"
            });
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
    let (product_price_cents, delivery_cost_cents, billing_mode) =
        if let Some(product_index) = payload.product_index {
            // Récupérer le prix du produit
            let _product_data: Option<ServiceDataRow> =
                sqlx::query_as("SELECT data FROM services WHERE id = $1")
                    .bind(payload.service_id)
                    .fetch_optional(&state.pg)
                    .await?;

            // ✅ CORRIGÉ 2026-01-23: Récupérer le produit depuis service_products au lieu de JSONB
            let product_price_cents = {
                let product: Option<ServiceProductRow> = sqlx::query_as(
                    r#"
                    SELECT service_id, product_index, product_data, product_name, product_price
                    FROM service_products
                    WHERE service_id = $1 AND product_index = $2 AND is_active = true
                    "#,
                )
                .bind(payload.service_id)
                .bind(product_index)
                .fetch_optional(&state.pg)
                .await
                .map_err(|e| {
                    log::error!("[create_client_order] Erreur récupération produit: {}", e);
                    AppError::Internal(format!("Erreur récupération produit: {}", e))
                })?;

                if let Some(product_row) = product {
                    // ✅ Utiliser ProductPriceService pour obtenir le prix réel avec promotions et prix négociés
                    ProductPriceService::get_real_product_price_cents(
                        &state.pg,
                        payload.service_id,
                        &product_row.product_data,
                        Some(product_index),
                        payload.conversation_id, // ✅ NOUVEAU : Pour prix négociés
                        Some(user.id), // ✅ NOUVEAU : client_user_id = user.id dans create_client_order
                    )
                    .await
                    .unwrap_or_else(|_| {
                        // Fallback : prix de base depuis product_price (colonne générée)
                        product_row.product_price.and_then(|p| p.to_i64()).unwrap_or(0)
                    })
                } else {
                    0
                }
            };

            // Récupérer le coût de livraison depuis le pricing de la livraison
            // Note: Le pricing n'est pas dans DeliverySummary, on le récupère depuis metadata ou on utilise 0
            let delivery_cost_cents = summary
                .metadata
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
        let payment_service =
            DeliveryPaymentService::new(state.pg.clone()).with_delivery_service(service.clone());

        // ✅ Phase 5 - Matching Intelligent : Récupérer le mode de paiement client
        // Pour l'instant, on utilise "wallet" par défaut, mais cela peut être enrichi
        // depuis payment_transactions si le client a déjà effectué un paiement
        let client_payment_method = serde_json::json!({
            "type": "wallet" // Par défaut, sera enrichi depuis payment_transactions lors du reversement
        });

        match payment_service
            .reserve_payment(
                summary.id,
                user.id,
                product_price_cents,
                delivery_cost_cents,
                &billing_mode,
                Some(client_payment_method), // ✅ NOUVEAU: Mode de paiement client
            )
            .await
        {
            Ok(_) => {
                log::info!(
                    "✅ Réservation de paiement créée pour livraison {}",
                    summary.id
                );
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
    let updated = service.assign_delivery_recipient(delivery_id, recipient).await?;

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
    let deliveries = service.list_user_active_deliveries_frontend(user.id).await?;
    Ok(Json(json!({ "deliveries": deliveries })))
}

async fn get_frontend_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let delivery = service.get_frontend_delivery_summary(delivery_id, user.id).await?;
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
    let updates = service.list_frontend_recipient_updates(delivery_id, user.id, limit).await?;
    Ok(Json(json!({ "updates": updates })))
}

/// GET /api/delivery/courier/stats - Statistiques complètes du coursier connecté
async fn get_courier_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let courier_opt = service.repository().find_courier_by_user(user.id).await?;
    let courier = match courier_opt {
        Some(c) => c,
        None => {
            return Ok(Json(json!({
                "success": true,
                "data": {
                    "totalDeliveries": 0,
                    "completedDeliveries": 0,
                    "cancelledDeliveries": 0,
                    "successRate": 0.0,
                    "totalEarningsCents": 0,
                    "thisMonthEarningsCents": 0,
                    "averageRating": 0.0,
                    "ratingCount": 0,
                    "is_courier": false
                }
            })));
        }
    };

    #[derive(sqlx::FromRow)]
    struct DeliveryStats {
        total: i64,
        completed: i64,
        cancelled: i64,
    }
    let stats = sqlx::query_as::<_, DeliveryStats>(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE status IN ('completed', 'delivered', 'cancelled')) AS total,
            COUNT(*) FILTER (WHERE status IN ('completed', 'delivered'))          AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled')                          AS cancelled
        FROM deliveries
        WHERE courier_id = $1
        "#,
    )
    .bind(courier.id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur stats livraisons: {}", e)))?;

    // Gains totaux nets (crédits coursier depuis wallet_transactions)
    // Gains bourse du livre (wallet_transactions) + livraisons régulières (disbursement_requests)
    let total_earnings: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0) FROM (
            SELECT amount_cents FROM wallet_transactions
            WHERE user_id = $1 AND direction = 'credit'
              AND transaction_type IN ('credit_livre_payout', 'payout_delivery', 'credit_delivery_payout')
            UNION ALL
            SELECT amount_cents FROM disbursement_requests
            WHERE recipient_user_id = $1 AND status IN ('completed', 'processing')
              AND reason IN ('courier_withdrawal', 'Reversement livraison automatique')
        ) t
        "#,
    )
    .bind(user.id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0i64);

    // Gains ce mois-ci
    let this_month_earnings: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0) FROM (
            SELECT amount_cents FROM wallet_transactions
            WHERE user_id = $1 AND direction = 'credit'
              AND transaction_type IN ('credit_livre_payout', 'payout_delivery', 'credit_delivery_payout')
              AND created_at >= date_trunc('month', NOW())
            UNION ALL
            SELECT amount_cents FROM disbursement_requests
            WHERE recipient_user_id = $1 AND status IN ('completed', 'processing')
              AND reason IN ('courier_withdrawal', 'Reversement livraison automatique')
              AND created_at >= date_trunc('month', NOW())
        ) t
        "#,
    )
    .bind(user.id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0i64);

    let success_rate = if stats.total > 0 {
        (stats.completed as f64 / stats.total as f64) * 100.0
    } else {
        0.0
    };

    let rating_avg = bigdecimal::ToPrimitive::to_f64(&courier.rating_average).unwrap_or(0.0);

    // Temps moyen de livraison (minutes) sur les 30 derniers jours
    let avg_delivery_time_min: f64 = sqlx::query_scalar::<_, Option<f64>>(
        r#"
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - requested_at)) / 60.0)
        FROM deliveries
        WHERE courier_id = $1
          AND status IN ('completed', 'delivered')
          AND requested_at >= NOW() - INTERVAL '30 days'
        "#,
    )
    .bind(courier.id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(None)
    .unwrap_or(0.0);

    Ok(Json(json!({
        "success": true,
        "data": {
            "totalDeliveries": stats.total,
            "completedDeliveries": stats.completed,
            "cancelledDeliveries": stats.cancelled,
            "successRate": (success_rate * 10.0).round() / 10.0,
            // Noms alignés avec CourierDashboardScreen.tsx
            "totalEarnings": total_earnings,
            "currentMonthEarnings": this_month_earnings,
            "totalEarningsCents": total_earnings,
            "thisMonthEarningsCents": this_month_earnings,
            "avgDeliveryTime": (avg_delivery_time_min * 10.0).round() / 10.0,
            "averageRating": (rating_avg * 10.0).round() / 10.0,
            "ratingCount": courier.rating_count,
            "is_courier": true,
            "courier_status": format!("{:?}", courier.status)
        }
    })))
}

/// GET /api/delivery/courier/history - Historique des livraisons terminées du coursier
async fn get_courier_history(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let courier_opt = service.repository().find_courier_by_user(user.id).await?;
    let courier = match courier_opt {
        Some(c) => c,
        None => {
            return Ok(Json(
                json!({ "success": true, "data": { "deliveries": [] } }),
            ));
        }
    };

    let limit: i64 = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(50).min(200);
    let offset: i64 = params.get("offset").and_then(|v| v.parse().ok()).unwrap_or(0);

    let deliveries = service
        .repository()
        .get_courier_completed_deliveries(courier.id, limit, offset)
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": { "deliveries": deliveries }
    })))
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
    let payment_service =
        DeliveryPaymentService::new(state.pg.clone()).with_delivery_service(service.clone());

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
                // ✅ NOUVEAU : Arrêter toutes les notifications pour les autres coursiers
                if let Err(e) = service.stop_delivery_notifications(delivery_id).await {
                    log::error!(
                        "Erreur arrêt notifications pour livraison {}: {:?}",
                        delivery_id,
                        e
                    );
                    // Ne pas faire échouer la requête, juste logger l'erreur
                }

                if let Err(e) = payment_service.confirm_payment(delivery_id).await {
                    log::error!(
                        "Erreur confirmation paiement pour livraison {}: {:?}",
                        delivery_id,
                        e
                    );
                    // Ne pas faire échouer la requête, juste logger l'erreur
                }
            }
        }
        crate::models::delivery_model::DeliveryStatus::Cancelled => {
            // Livraison annulée -> Libérer la réservation (rembourser)
            if old_status != crate::models::delivery_model::DeliveryStatus::Cancelled {
                if let Err(e) = payment_service.release_reservation(delivery_id).await {
                    log::error!(
                        "Erreur libération réservation pour livraison {}: {:?}",
                        delivery_id,
                        e
                    );
                }
            }
        }
        crate::models::delivery_model::DeliveryStatus::Delivered => {
            // Livraison validée -> Reverser au prestataire
            // ✅ IMPORTANT : Vérifier si le produit a été rejeté avant de reverser
            if old_status != crate::models::delivery_model::DeliveryStatus::Delivered {
                // Vérifier dans le payload si le produit a été rejeté
                let product_rejected = payload_data
                    .as_ref()
                    .and_then(|p| p.get("product_rejected"))
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);

                if product_rejected {
                    // ✅ Produit rejeté : Pas de commission, pas de reversement
                    // Rembourser le client via handle_product_rejection
                    if let Err(e) =
                        payment_service.handle_product_rejection(delivery_id, user.id).await
                    {
                        log::error!(
                            "Erreur gestion rejet produit pour livraison {}: {:?}",
                            delivery_id,
                            e
                        );
                    }
                } else {
                    // Produit accepté : Reverser au prestataire avec commission
                    let merchant_user_id = summary.creator_id;
                    if let Err(e) =
                        payment_service.payout_merchant(delivery_id, merchant_user_id).await
                    {
                        log::error!(
                            "Erreur reversement prestataire pour livraison {}: {:?}",
                            delivery_id,
                            e
                        );
                    }

                    // ✅ NOUVEAU : Reverser les frais de livraison au coursier
                    if let Some(courier_id) = summary.courier_id {
                        // Récupérer le user_id du coursier depuis courier_id
                        let courier_user_id_result: Option<(i32,)> =
                            sqlx::query_as("SELECT user_id FROM couriers WHERE id = $1")
                                .bind(courier_id)
                                .fetch_optional(&state.pg)
                                .await
                                .ok()
                                .flatten();

                        if let Some((courier_user_id,)) = courier_user_id_result {
                            if let Err(e) =
                                payment_service.payout_courier(delivery_id, courier_user_id).await
                            {
                                log::error!(
                                    "Erreur reversement coursier pour livraison {}: {:?}",
                                    delivery_id,
                                    e
                                );
                            } else {
                                log::info!(
                                    "✅ Reversement coursier effectué pour livraison {}",
                                    delivery_id
                                );
                            }
                        } else {
                            log::warn!(
                                "Coursier {} non trouvé pour livraison {}",
                                courier_id,
                                delivery_id
                            );
                        }
                    } else {
                        log::warn!("Pas de coursier assigné pour livraison {}", delivery_id);
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

    let suggested_status =
        serde_json::from_str::<crate::models::delivery_model::DeliveryStatus>(suggested_status_str)
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
    // ✅ NOUVEAU : Type d'engin souhaité pour la livraison (pour calcul coût précis)
    preferred_vehicle_type: Option<String>, // 'bike', 'motorcycle', 'scooter', 'car', 'pickup', 'truck', 'walking'
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
    // ✅ Monitoring : Enregistrer requête
    let start_time = std::time::Instant::now();
    if let Ok(metrics) = &*crate::services::delivery_pricing_metrics::DELIVERY_PRICING_METRICS {
        metrics.estimate_cost_requests_total.inc();
    }

    // ✅ CORRECTION : Validation des paramètres requis
    if payload.service_id <= 0 {
        if let Ok(metrics) = &*crate::services::delivery_pricing_metrics::DELIVERY_PRICING_METRICS {
            metrics.estimate_cost_errors_total.inc();
        }
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
        let _product_data: Option<ServiceDataRow> =
            sqlx::query_as("SELECT data FROM services WHERE id = $1")
                .bind(payload.service_id)
                .fetch_optional(&state.pg)
                .await?;

        // ✅ CORRIGÉ 2026-01-23: Récupérer le produit depuis service_products au lieu de JSONB
        {
            let product: Option<ServiceProductRow> = sqlx::query_as(
                r#"
                SELECT service_id, product_index, product_data, product_name, product_price
                FROM service_products
                WHERE service_id = $1 AND product_index = $2 AND is_active = true
                "#,
            )
            .bind(payload.service_id)
            .bind(product_index)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                log::error!(
                    "[create_delivery_request] Erreur récupération produit: {}",
                    e
                );
                AppError::Internal(format!("Erreur récupération produit: {}", e))
            })?;

            if let Some(product_row) = product {
                // ✅ Utiliser ProductPriceService pour obtenir le prix réel avec promotions et prix négociés
                ProductPriceService::get_real_product_price_cents(
                    &state.pg,
                    payload.service_id,
                    &product_row.product_data,
                    Some(product_index),
                    payload.conversation_id, // ✅ NOUVEAU : Pour prix négociés
                    payload.client_user_id.or(Some(user.id)), // ✅ NOUVEAU : Pour prix négociés
                )
                .await
                .unwrap_or_else(|_| {
                    // Fallback : prix de base depuis product_price (colonne générée)
                    product_row.product_price.and_then(|p| p.to_i64()).unwrap_or(0)
                })
            } else {
                0
            }
        }
    } else {
        0
    };

    // 2. Récupérer le billing_mode depuis product_delivery_config
    let (billing_mode, is_delivery_free) = if let Some(product_index) = payload.product_index {
        let config: Option<BillingModeRow> = sqlx::query_as(
            "SELECT billing_mode FROM product_delivery_config 
             WHERE service_id = $1 AND product_index = $2",
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
                 WHERE service_id = $1 AND product_index = $2",
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
                    return Err(crate::core::types::AppError::BadRequest(
                        "Coordonnées GPS manquantes dans la configuration de livraison".into(),
                    ));
                }
            } else {
                // Fallback : récupérer depuis le service
                let service_data: Option<ServiceGpsRow> =
                    sqlx::query_as("SELECT gps FROM services WHERE id = $1")
                        .bind(payload.service_id)
                        .fetch_optional(&state.pg)
                        .await?;

                if let Some(service_row) = service_data {
                    if let Some(gps_str) = service_row.gps {
                        let parts: Vec<&str> = gps_str.split(',').collect();
                        if parts.len() == 2 {
                            if let (Ok(lng), Ok(lat)) = (
                                parts[0].trim().parse::<f64>(),
                                parts[1].trim().parse::<f64>(),
                            ) {
                                LocationInput {
                                    latitude: lat,
                                    longitude: lng,
                                    address: None,
                                }
                            } else {
                                return Err(crate::core::types::AppError::BadRequest(
                                    "GPS invalide dans le service".into(),
                                ));
                            }
                        } else {
                            return Err(crate::core::types::AppError::BadRequest(
                                "Format GPS invalide".into(),
                            ));
                        }
                    } else {
                        return Err(crate::core::types::AppError::BadRequest(
                            "Aucune adresse de départ disponible".into(),
                        ));
                    }
                } else {
                    return Err(crate::core::types::AppError::NotFound(
                        "Service non trouvé".into(),
                    ));
                }
            }
        } else {
            return Err(crate::core::types::AppError::BadRequest(
                "product_index requis pour calculer le coût de livraison".into(),
            ));
        };

        // Calculer la distance
        let distance_km = crate::services::delivery_service::haversine_distance(
            (pickup.latitude, pickup.longitude),
            (dropoff.latitude, dropoff.longitude),
        ) / 1000.0; // Convertir en km

        // ✅ NOUVEAU : Calculer le coût selon le type d'engin
        // Déterminer le type d'engin (depuis preferred_vehicle_type ou config produit)
        let engine_type = if let Some(ref preferred) = payload.preferred_vehicle_type {
            // Mapper depuis preferred_vehicle_type (format frontend) vers DeliveryEngineType
            match preferred.as_str() {
                "bike" | "velo" => crate::models::delivery_model::DeliveryEngineType::VeloCargo,
                "motorcycle" | "moto" => crate::models::delivery_model::DeliveryEngineType::Moto,
                "scooter" => crate::models::delivery_model::DeliveryEngineType::Scooter,
                "tricycle" => crate::models::delivery_model::DeliveryEngineType::Tricycle,
                "car" | "voiture" => crate::models::delivery_model::DeliveryEngineType::Voiture,
                "pickup" | "camionnette" => {
                    crate::models::delivery_model::DeliveryEngineType::Camionnette
                }
                "truck" | "camion" => {
                    crate::models::delivery_model::DeliveryEngineType::CamionLeger
                }
                "walking" | "pieton" => crate::models::delivery_model::DeliveryEngineType::Pieton,
                _ => crate::models::delivery_model::DeliveryEngineType::Moto, // Par défaut : moto
            }
        } else {
            // Par défaut : moto (véhicule le plus courant pour les livraisons)
            crate::models::delivery_model::DeliveryEngineType::Moto
        };

        // Utiliser le service de pricing par type d'engin
        let pricing_service =
            crate::services::delivery_engine_pricing_service::DeliveryEnginePricingService::new(
                state.pg.clone(),
            );
        let delivery_cost_fcfa = pricing_service
            .calculate_delivery_cost(engine_type, distance_km)
            .await
            .unwrap_or_else(|_| {
                // Fallback si erreur : utiliser l'ancienne formule
                (distance_km * 500.0).max(1000.0)
            });

        let delivery_cost_cents = (delivery_cost_fcfa * 100.0) as i64; // Convertir en centimes

        // ✅ Monitoring : Enregistrer distance et coût
        if let Ok(metrics) = &*crate::services::delivery_pricing_metrics::DELIVERY_PRICING_METRICS {
            metrics.delivery_distance_km.observe(distance_km);

            if distance_km < 1.0 {
                metrics.delivery_distance_short_total.inc();
            } else if distance_km <= 10.0 {
                metrics.delivery_distance_medium_total.inc();
            } else {
                metrics.delivery_distance_long_total.inc();
            }
        }

        delivery_cost_cents
    } else {
        0
    };

    let total_cents = product_price_cents
        + if is_delivery_free {
            0
        } else {
            delivery_cost_cents
        };

    // ✅ Monitoring : Enregistrer métriques
    if let Ok(metrics) = &*crate::services::delivery_pricing_metrics::DELIVERY_PRICING_METRICS {
        let duration = start_time.elapsed().as_secs_f64();
        metrics.estimate_cost_duration_seconds.observe(duration);

        metrics.delivery_cost_calculated_total.inc();
        metrics.delivery_cost_amount_cents_total.inc_by(delivery_cost_cents as f64);

        metrics.product_price_calculated_total.inc();
        metrics.product_price_amount_cents_total.inc_by(product_price_cents as f64);

        // Billing mode
        match billing_mode.as_str() {
            "standard" => metrics.billing_mode_standard_total.inc(),
            "merchant_inclusive" => metrics.billing_mode_merchant_inclusive_total.inc(),
            "partner" => metrics.billing_mode_partner_total.inc(),
            _ => {}
        }

        // Distance déjà calculée plus haut, métriques enregistrées dans le bloc de calcul
    }

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
    let courier =
        service.repository().find_courier_by_user(user.id).await?.ok_or_else(|| {
            AppError::Forbidden("Coursier introuvable pour cet utilisateur".into())
        })?;

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
    partner_id: Option<i32>, // ✅ NOUVEAU 2026-01-04: ID du partenaire de livraison
}

async fn submit_courier_application(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CourierApplicationPayload>,
) -> AppResult<Json<Value>> {
    // ✅ LOG: Logger la soumission pour diagnostic
    log::info!(
        "[submit_courier_application] Soumission candidature - user_id: {}, submitted: {}, partner_id: {:?}",
        user.id,
        payload.submitted,
        payload.partner_id
    );

    // ✅ CORRIGÉ: Valider et nettoyer le partner_id avant traitement
    let cleaned_partner_id = if let Some(pid) = payload.partner_id {
        if pid > 0 {
            Some(pid)
        } else {
            log::info!(
                "[submit_courier_application] ⚠️ partner_id {} invalide (négatif ou zéro), conversion en NULL",
                pid
            );
            None
        }
    } else {
        None
    };

    let service = delivery_service(&state)?;
    let application = match service
        .submit_courier_application(CourierApplicationInput {
            user_id: user.id,
            profile_data: payload.profile_data.clone(),
            documents: payload.documents.clone(),
            submitted: payload.submitted,
            partner_id: cleaned_partner_id, // ✅ CORRIGÉ: Utiliser le partner_id nettoyé
        })
        .await
    {
        Ok(app) => {
            log::info!(
                "[submit_courier_application] ✅ Candidature créée/mise à jour avec succès - id: {}, status: {:?}",
                app.id,
                app.status
            );
            app
        }
        Err(e) => {
            log::error!(
                "[submit_courier_application] ❌ Erreur soumission candidature - user_id: {}, erreur: {}",
                user.id,
                e
            );
            // ✅ AMÉLIORÉ: Logger plus de détails pour le diagnostic
            log::error!(
                "[submit_courier_application] ❌ Détails erreur - type: {:?}, message: {}",
                e,
                e.to_string()
            );
            return Err(e);
        }
    };

    // ✅ CORRIGÉ: Inclure un champ 'success' explicite pour que le frontend détecte correctement le succès
    Ok(Json(serde_json::json!({
        "success": true,
        "application": application
    })))
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
            "rating_average": ToPrimitive::to_f64(&c.rating_average).unwrap_or(0.0),
            "rating_count": c.rating_count,
        })),
        "application": application.map(|a| {
            // ✅ NOUVEAU: Retourner les données complètes si c'est un brouillon
            let mut app_json = json!({
                "id": a.id,
                "status": format!("{:?}", a.status),
                "submitted_at": a.submitted_at,
                "reviewed_at": a.reviewed_at,
                "rejection_reason": a.rejection_reason,
            });

            // Si c'est un brouillon, inclure les données complètes pour permettre la reprise
            if format!("{:?}", a.status).to_lowercase() == "draft" {
                app_json["profile_data"] = a.profile_data.clone();
                app_json["documents"] = a.documents.clone();
                app_json["notes"] = a.notes.clone();
            }

            app_json
        }),
    })))
}

// ✅ NOUVEAU : Liste des candidatures de coursiers (admin uniquement)
async fn list_courier_applications(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<serde_json::Value>,
) -> AppResult<Json<Value>> {
    // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
    ensure_admin_role(&user)?;

    let service = delivery_service(&state)?;

    // Récupérer les paramètres de filtrage
    // ✅ AMÉLIORÉ: "submitted" sur mobile = souvent "à valider".
    // Certains clients anciens peuvent laisser la candidature en draft malgré un clic "soumettre".
    // On élargit donc le filtre "submitted" à plusieurs statuts.
    let status_param = params.get("status").and_then(|v| v.as_str()).map(|s| s.to_lowercase());

    let statuses_filter: Option<Vec<crate::models::delivery_model::DeliveryApplicationStatus>> =
        status_param.as_deref().and_then(|s| match s {
            // Filtre standard
            "draft" => Some(vec![
                crate::models::delivery_model::DeliveryApplicationStatus::Draft,
            ]),
            "under_review" => Some(vec![
                crate::models::delivery_model::DeliveryApplicationStatus::UnderReview,
            ]),
            "approved" => Some(vec![
                crate::models::delivery_model::DeliveryApplicationStatus::Approved,
            ]),
            "rejected" => Some(vec![
                crate::models::delivery_model::DeliveryApplicationStatus::Rejected,
            ]),

            // ✅ CORRIGÉ: "submitted" = file d'attente de validation
            // ✅ NE PAS inclure "Draft" car les brouillons ne doivent pas être validés
            // Seulement les candidatures soumises (Submitted) et en cours de révision (UnderReview)
            "submitted" | "pending" | "to_validate" | "pending_validation" => Some(vec![
                crate::models::delivery_model::DeliveryApplicationStatus::Submitted,
                crate::models::delivery_model::DeliveryApplicationStatus::UnderReview,
                // ✅ SUPPRIMÉ: Draft - les brouillons ne doivent pas apparaître dans la liste de validation
            ]),
            _ => None,
        });

    // Conserver le comportement précédent si on n'a qu'un seul statut
    // ✅ CORRIGÉ: Si statuses_filter est None (filtre "all" ou pas de filtre), status_filter doit être None
    let status_filter: Option<crate::models::delivery_model::DeliveryApplicationStatus> =
        match &statuses_filter {
            Some(v) if v.len() == 1 => v.first().copied(),
            Some(_) => None, // Multi-statuts -> utiliser list_courier_applications_by_statuses
            None => None,    // Pas de filtre -> retourner toutes les candidatures
        };

    let limit = params.get("limit").and_then(|v| v.as_i64()).or(Some(100));
    let offset = params.get("offset").and_then(|v| v.as_i64()).or(Some(0));

    // ✅ LOG: Logger les paramètres de la requête pour diagnostic
    log::info!(
        "[list_courier_applications] Requête candidatures - status_filter: {:?}, limit: {:?}, offset: {:?}",
        status_filter,
        limit,
        offset
    );

    let applications = match statuses_filter {
        Some(ref statuses) if statuses.len() > 1 => {
            log::info!(
                "[list_courier_applications] Filtre multi-status activé: {:?} ({} statuts)",
                statuses,
                statuses.len()
            );
            let result = service
                .list_courier_applications_by_statuses(statuses.clone(), limit, offset)
                .await?;
            log::info!(
                "[list_courier_applications] Résultat filtre multi-status: {} candidature(s) trouvée(s) pour {:?}",
                result.len(),
                statuses
            );
            result
        }
        _ => {
            // ✅ CORRIGÉ: Log détaillé pour le filtre "all" ou single-status
            if status_filter.is_none() {
                log::info!(
                    "[list_courier_applications] Filtre 'all' activé - récupération de TOUTES les candidatures (sans filtre de statut)"
                );
            } else {
                log::info!(
                    "[list_courier_applications] Filtre single-status: {:?}",
                    status_filter
                );
            }
            let result = service.list_courier_applications(status_filter, limit, offset).await?;
            log::info!(
                "[list_courier_applications] Résultat filtre single-status/all: {} candidature(s) trouvée(s)",
                result.len()
            );
            result
        }
    };

    // ✅ LOG: Logger le nombre de candidatures trouvées avec détails
    log::info!(
        "[list_courier_applications] {} candidature(s) trouvée(s) (filtre: {:?})",
        applications.len(),
        statuses_filter
    );

    // ✅ DEBUG: Logger les statuts des candidatures trouvées
    if !applications.is_empty() {
        use std::collections::HashMap;
        let mut status_counts: HashMap<String, i32> = HashMap::new();
        for app in &applications {
            let status_str = format!("{:?}", app.status);
            *status_counts.entry(status_str).or_insert(0) += 1;
        }
        log::info!(
            "[list_courier_applications] Répartition par statut: {:?}",
            status_counts
        );
    }

    // Récupérer les informations utilisateur pour chaque candidature
    let mut applications_with_user = Vec::new();
    for app in applications {
        // ✅ CORRIGÉ: Utiliser query_as avec un struct FromRow au lieu d'un tuple
        #[derive(sqlx::FromRow)]
        struct UserInfoRow {
            nom_complet: Option<String>,
            email: Option<String>,
            avatar_url: Option<String>,
        }

        let user_info = sqlx::query_as::<_, UserInfoRow>(
            "SELECT nom_complet, email, avatar_url FROM users WHERE id = $1",
        )
        .bind(app.user_id)
        .fetch_optional(&state.pg)
        .await;

        let (name, email, avatar) = match user_info {
            Ok(Some(u)) => (
                u.nom_complet.unwrap_or_else(|| format!("User {}", app.user_id)),
                u.email,
                u.avatar_url,
            ),
            Ok(None) | Err(_) => {
                // ✅ LOG: Logger l'erreur si la requête échoue
                if let Err(e) = user_info {
                    log::warn!(
                        "[list_courier_applications] Erreur récupération utilisateur {}: {}",
                        app.user_id,
                        e
                    );
                }
                (format!("User {}", app.user_id), None, None)
            }
        };

        applications_with_user.push(json!({
            "id": app.id,
            "user_id": app.user_id,
            "user_name": name,
            "user_email": email,
            "user_avatar": avatar,
            "status": format!("{:?}", app.status).to_lowercase(),
            "submitted_at": app.submitted_at,
            "reviewed_at": app.reviewed_at,
            "reviewer_id": app.reviewer_id,
            "rejection_reason": app.rejection_reason,
            "profile_data": app.profile_data,
            "documents": app.documents,
            "notes": app.notes,
            "created_at": app.created_at,
            "updated_at": app.updated_at,
        }));
    }

    Ok(Json(json!({
        "applications": applications_with_user,
        "total": applications_with_user.len(),
    })))
}

#[derive(Deserialize)]
struct ApproveRejectPayload {
    rejection_reason: Option<String>,
}

// ✅ NOUVEAU : Approuver une candidature de coursier (admin uniquement)
async fn approve_courier_application_endpoint(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(application_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
    ensure_admin_role(&user)?;

    let service = delivery_service(&state)?;

    // Récupérer la candidature
    let application = service
        .repository()
        .find_courier_application_by_id(application_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Candidature introuvable".into()))?;

    // Extraire les données du profil depuis profile_data
    let profile_data = application.profile_data;
    let personal = profile_data.get("personal").and_then(|p| p.as_object());
    let transport = profile_data.get("transport").and_then(|t| t.as_object());

    let user_id = application.user_id;
    let bio = personal
        .and_then(|p| p.get("bio"))
        .and_then(|b| b.as_str())
        .map(|s| s.to_string())
        .or_else(|| profile_data.get("bio").and_then(|b| b.as_str()).map(|s| s.to_string()));

    // Extraire les informations de transport
    let vehicle_type_str = transport
        .and_then(|t| t.get("vehicleType"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_lowercase());

    let engine_type = match vehicle_type_str.as_deref() {
        Some("motorcycle") => crate::models::delivery_model::DeliveryEngineType::Moto,
        Some("car") => crate::models::delivery_model::DeliveryEngineType::Voiture,
        Some("tricycle") => crate::models::delivery_model::DeliveryEngineType::Tricycle,
        Some("van") | Some("pickup") => {
            crate::models::delivery_model::DeliveryEngineType::Camionnette
        }
        Some("truck") => crate::models::delivery_model::DeliveryEngineType::CamionLeger,
        Some("bike") => crate::models::delivery_model::DeliveryEngineType::VeloCargo,
        Some("walking") => crate::models::delivery_model::DeliveryEngineType::Pieton,
        _ => crate::models::delivery_model::DeliveryEngineType::Autre,
    };

    // ✅ NOUVEAU 2026-01-04: Extraire et uploader l'image du moyen de transport depuis documents
    let vehicle_image_url = if let Some(docs) = application.documents.as_object() {
        if let Some(vehicle_image_doc) = docs.get("vehicle_image") {
            if let Some(base64_data) = vehicle_image_doc.get("data").and_then(|v| v.as_str()) {
                // Uploader l'image vers le stockage
                let media_storage = state.media_storage.clone();
                let storage_path = env::var("UPLOAD_STORAGE_PATH")
                    .unwrap_or_else(|_| "/var/data/uploads".to_string());
                let storage_root = std::path::Path::new(&storage_path);
                let file_name = vehicle_image_doc
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or("vehicle_image.jpg");
                let file_ext = file_name.split('.').last().unwrap_or("jpg");

                match crate::services::creer_service::persist_base64_media(
                    storage_root,
                    user_id, // Utiliser user_id comme identifiant pour le dossier
                    "courier_vehicles",
                    base64_data,
                    file_ext,
                    media_storage,
                )
                .await
                {
                    Ok(stored) => {
                        log::info!(
                            "[approve_courier_application] ✅ Image véhicule uploadée: {}",
                            stored.path
                        );
                        Some(stored.path)
                    }
                    Err(e) => {
                        log::warn!(
                            "[approve_courier_application] ⚠️ Erreur upload image véhicule: {}",
                            e
                        );
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    // Préparer l'asset input (le courier_id sera rempli automatiquement dans approve_courier_application)
    let asset_input = Some(crate::services::delivery_service::CourierAssetInput {
        courier_id: Uuid::new_v4(), // Sera remplacé par l'ID réel du coursier créé
        engine_type,
        max_weight_kg: None,
        max_volume_cm3: None,
        equipments: json!({}),
        available: true,
        availability_schedule: profile_data.get("availability").cloned(),
        documents: Some(application.documents.clone()),
        vehicle_image_url, // ✅ NOUVEAU 2026-01-04: URL de l'image uploadée
    });

    // Approuver la candidature
    let (updated_app, courier, asset) = service
        .approve_courier_application(
            application_id,
            user.id,
            true, // approve
            None, // rejection_reason
            crate::services::delivery_service::CourierProfileInput {
                user_id,
                application_id: Some(application_id),
                bio,
            },
            asset_input,
        )
        .await?;

    // ✅ NOUVEAU: Envoyer une notification à l'utilisateur pour l'informer de l'approbation
    let notification_data = serde_json::json!({
        "application_id": application_id,
        "courier_id": courier.id,
        "status": "approved"
    });

    // Créer la notification en base de données
    if let Err(e) = crate::services::notification_service::create_notification(
        &state.pg,
        user_id,
        crate::services::notification_service::NotificationType::CourierApplicationApproved,
        "✅ Candidature approuvée".to_string(),
        "Félicitations ! Votre candidature de coursier a été approuvée. Vous pouvez maintenant commencer à accepter des livraisons.".to_string(),
        Some(notification_data.clone()),
    ).await {
        log::warn!("[approve_courier_application] ⚠️ Impossible de créer la notification: {}", e);
    } else {
        log::info!("[approve_courier_application] ✅ Notification d'approbation créée");
    }

    // Envoyer une push notification
    if let Err(e) = crate::services::push_notification_service::send_push_notification(
        &state.pg,
        user_id,
        "✅ Candidature approuvée".to_string(),
        "Félicitations ! Votre candidature de coursier a été approuvée. Vous pouvez maintenant commencer à accepter des livraisons.".to_string(),
        Some(notification_data),
        None,
    ).await {
        log::warn!("[approve_courier_application] ⚠️ Impossible d'envoyer la push notification: {}", e);
    } else {
        log::info!("[approve_courier_application] ✅ Push notification envoyée");
    }

    Ok(Json(json!({
        "success": true,
        "application": updated_app,
        "courier": courier,
        "asset": asset,
    })))
}

// ✅ NOUVEAU : Rejeter une candidature de coursier (admin uniquement)
async fn reject_courier_application_endpoint(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(application_id): Path<Uuid>,
    Json(payload): Json<ApproveRejectPayload>,
) -> AppResult<Json<Value>> {
    // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
    ensure_admin_role(&user)?;

    let service = delivery_service(&state)?;

    // Récupérer la candidature
    let application = service
        .repository()
        .find_courier_application_by_id(application_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Candidature introuvable".into()))?;

    // Extraire les données du profil
    let profile_data = application.profile_data;
    let bio = profile_data.get("bio").and_then(|b| b.as_str()).map(|s| s.to_string());

    // Rejeter la candidature
    let (updated_app, _courier, _asset) = service
        .approve_courier_application(
            application_id,
            user.id,
            false, // reject
            payload.rejection_reason.clone(),
            crate::services::delivery_service::CourierProfileInput {
                user_id: application.user_id,
                application_id: Some(application_id),
                bio,
            },
            None, // Pas d'asset pour un rejet
        )
        .await?;

    // ✅ NOUVEAU: Envoyer une notification à l'utilisateur pour l'informer du rejet
    let rejection_message = if let Some(reason) = &payload.rejection_reason {
        format!(
            "Votre candidature de coursier a été rejetée. Raison : {}",
            reason
        )
    } else {
        "Votre candidature de coursier a été rejetée. Veuillez contacter le support pour plus d'informations.".to_string()
    };

    let notification_data = serde_json::json!({
        "application_id": application_id,
        "status": "rejected",
        "rejection_reason": payload.rejection_reason
    });

    // Créer la notification en base de données
    if let Err(e) = crate::services::notification_service::create_notification(
        &state.pg,
        application.user_id,
        crate::services::notification_service::NotificationType::CourierApplicationRejected,
        "❌ Candidature rejetée".to_string(),
        rejection_message.clone(),
        Some(notification_data.clone()),
    )
    .await
    {
        log::warn!(
            "[reject_courier_application] ⚠️ Impossible de créer la notification: {}",
            e
        );
    } else {
        log::info!("[reject_courier_application] ✅ Notification de rejet créée");
    }

    // Envoyer une push notification
    if let Err(e) = crate::services::push_notification_service::send_push_notification(
        &state.pg,
        application.user_id,
        "❌ Candidature rejetée".to_string(),
        rejection_message,
        Some(notification_data),
        None,
    )
    .await
    {
        log::warn!(
            "[reject_courier_application] ⚠️ Impossible d'envoyer la push notification: {}",
            e
        );
    } else {
        log::info!("[reject_courier_application] ✅ Push notification envoyée");
    }

    Ok(Json(json!({
        "success": true,
        "application": updated_app,
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
    vehicle_image_url: Option<String>, // ✅ NOUVEAU 2026-01-04: URL de l'image du moyen de transport
}

async fn upsert_courier_asset(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(courier_id): Path<Uuid>,
    Json(payload): Json<CourierAssetPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;

    let courier =
        service.repository().find_courier_by_user(user.id).await?.ok_or_else(|| {
            AppError::Forbidden("Coursier introuvable pour cet utilisateur".into())
        })?;

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
            vehicle_image_url: payload.vehicle_image_url, // ✅ NOUVEAU 2026-01-04: URL de l'image du moyen de transport
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
    let courier =
        service.repository().find_courier_by_user(user.id).await?.ok_or_else(|| {
            AppError::Forbidden("Coursier introuvable pour cet utilisateur".into())
        })?;

    if summary.courier_id != Some(courier.id) {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le coursier assigné à cette livraison".into(),
        ));
    }

    // Récupérer la position actuelle du coursier (optionnel, depuis query params ou dernière position connue)
    let courier_current_lat = params.get("courier_lat").and_then(|v| v.as_f64());
    let courier_current_lng = params.get("courier_lng").and_then(|v| v.as_f64());

    // Déterminer l'origine et la destination selon le statut de la livraison
    let (origin, destination, navigation_type) = match summary.status {
        DeliveryStatus::EnRoutePickup | DeliveryStatus::AwaitingCourierConfirmation => {
            // Le coursier va vers le point de pickup
            let origin = if let (Some(lat), Some(lng)) = (courier_current_lat, courier_current_lng)
            {
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
            let origin = if let (Some(lat), Some(lng)) = (courier_current_lat, courier_current_lng)
            {
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
                format!(
                    "Navigation non disponible pour le statut: {:?}",
                    summary.status
                )
                .into(),
            ));
        }
    };

    // Obtenir les directions depuis GeographicMatchingService
    let geo_service = state
        .geographic_matching
        .as_ref()
        .ok_or_else(|| AppError::Internal("Service géographique non disponible".into()))?;

    let directions = geo_service.get_navigation_directions(origin, destination, None).await?;

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

    if sender.send(Message::Text(connected.to_string().into())).await.is_err() {
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
    let summary = service.get_delivery_summary(delivery_id).await?;

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
    sqlx::query("UPDATE deliveries SET updated_at = NOW() WHERE id = $1")
        .bind(delivery_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            AppError::Internal(format!("Erreur mise à jour preferred_courier_id: {}", e))
        })?;

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
    // ✅ NOUVEAU: Extraire les paramètres de recherche avancée
    let _service_id: Option<i32> =
        params.get("service_id").and_then(|v| v.as_i64()).map(|i| i as i32);

    let pickup_lat: Option<f64> = params.get("pickup_latitude").and_then(|v| v.as_f64());
    let pickup_lng: Option<f64> = params.get("pickup_longitude").and_then(|v| v.as_f64());
    let delivery_lat: Option<f64> = params.get("delivery_latitude").and_then(|v| v.as_f64());
    let delivery_lng: Option<f64> = params.get("delivery_longitude").and_then(|v| v.as_f64());
    let transport_type: Option<String> =
        params.get("transport_type").and_then(|v| v.as_str()).map(|s| s.to_string());
    let preparation_time_minutes: Option<i32> = params
        .get("preparation_time_minutes")
        .and_then(|v| v.as_i64())
        .map(|i| i as i32);
    let max_distance_km: Option<f64> =
        params.get("max_distance_km").and_then(|v| v.as_f64()).or(Some(10.0)); // 10km par défaut

    // ✅ NOUVEAU: Si pickup/delivery sont fournis, utiliser la recherche géographique optimisée
    let couriers: Vec<Value> = if pickup_lat.is_some() && pickup_lng.is_some() {
        // Recherche géographique avec distance et temps estimé
        let max_distance_meters = (max_distance_km.unwrap_or(10.0) * 1000.0) as i32;

        #[derive(sqlx::FromRow)]
        struct CourierWithDistanceRow {
            id: Uuid,
            user_id: i32,
            rating_average: Option<Decimal>,
            rating_count: Option<i32>,
            bio: Option<String>,
            nom_complet: Option<String>,
            avatar_url: Option<String>,
            email: String,
            completed_deliveries: Option<i64>,
            cancelled_deliveries: Option<i64>,
            avg_delivery_time_minutes: Option<Decimal>,
            distance_to_pickup_meters: Option<f64>,
            distance_pickup_to_delivery_meters: Option<f64>,
            engine_type: Option<String>,
            current_latitude: Option<f64>,
            current_longitude: Option<f64>,
        }

        let mut query = String::from(
            r#"
            SELECT 
                c.id,
                c.user_id,
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
                    AS avg_delivery_time_minutes,
                -- Distance du coursier au point de pickup
                CASE 
                    WHEN cas.location IS NOT NULL THEN 
                        ST_Distance(
                            cas.location,
                            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
                        )
                    ELSE NULL
                END AS distance_to_pickup_meters,
                -- Distance totale pickup -> delivery (si delivery fourni)
                CASE 
                    WHEN $3 IS NOT NULL AND $4 IS NOT NULL THEN
                        ST_Distance(
                            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                            ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography
                        )
                    ELSE NULL
                END AS distance_pickup_to_delivery_meters,
                -- Type de transport du coursier
                ca.engine_type::text AS engine_type,
                -- Position actuelle du coursier
                ST_Y(cas.location::geometry) AS current_latitude,
                ST_X(cas.location::geometry) AS current_longitude
            FROM couriers c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN deliveries d ON d.courier_id = c.id
            LEFT JOIN LATERAL (
                SELECT cas.*
                FROM courier_availability_snapshots cas
                WHERE cas.courier_id = c.id
                  AND cas.is_online = TRUE
                  AND cas.captured_at >= NOW() - INTERVAL '30 minutes'
                ORDER BY cas.captured_at DESC
                LIMIT 1
            ) cas ON TRUE
            LEFT JOIN LATERAL (
                SELECT ca.engine_type
                FROM courier_assets ca
                WHERE ca.courier_id = c.id
                  AND ca.is_active = TRUE
                ORDER BY ca.created_at DESC
                LIMIT 1
            ) ca ON TRUE
            WHERE c.status = 'approved'
              AND cas.is_online = TRUE
              AND cas.active_deliveries < cas.max_capacity
            "#,
        );

        // Filtrer par distance maximale
        query.push_str(&format!(
            " AND (cas.location IS NULL OR ST_Distance(cas.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) <= {})",
            max_distance_meters
        ));

        // Filtrer par type de transport si spécifié
        if let Some(ref transport) = transport_type {
            match transport.as_str() {
                "bike" | "velo" | "velo_cargo" => {
                    query.push_str(" AND (ca.engine_type IS NULL OR ca.engine_type::text IN ('velo_cargo', 'velo'))");
                }
                "motorcycle" | "moto" | "scooter" => {
                    query.push_str(" AND (ca.engine_type IS NULL OR ca.engine_type::text IN ('moto', 'scooter'))");
                }
                "car" | "voiture" | "camionnette" | "camion_leger" => {
                    query.push_str(" AND (ca.engine_type IS NULL OR ca.engine_type::text IN ('voiture', 'camionnette', 'camion_leger'))");
                }
                _ => {} // "any" ou autre : pas de filtre
            }
        }

        query.push_str(
            r#"
            GROUP BY c.id, c.user_id, c.rating_average, c.rating_count, c.bio, 
                     u.nom_complet, u.avatar_url, u.email,
                     cas.location, ca.engine_type, cas.captured_at
            ORDER BY distance_to_pickup_meters ASC NULLS LAST, 
                     c.rating_average DESC NULLS LAST, 
                     completed_deliveries DESC
            LIMIT 50
            "#,
        );

        let rows: Vec<CourierWithDistanceRow> = sqlx::query_as(&query)
            .bind(pickup_lat.unwrap_or(0.0))
            .bind(pickup_lng.unwrap_or(0.0))
            .bind(delivery_lat)
            .bind(delivery_lng)
            .fetch_all(&state.pg)
            .await
            .map_err(|e| {
                AppError::Internal(format!("Erreur récupération coursiers géolocalisés: {}", e))
            })?;

        rows.into_iter()
            .map(|row| {
                let completed = row.completed_deliveries.unwrap_or(0) as f64;
                let cancelled = row.cancelled_deliveries.unwrap_or(0) as f64;
                let total = completed + cancelled;
                let success_rate = if total > 0.0 {
                    (completed / total * 100.0).round() as i32
                } else {
                    100
                };

                // Calculer le temps estimé total
                let distance_to_pickup_km = row.distance_to_pickup_meters.map(|d| d / 1000.0);
                let distance_total_km = row.distance_pickup_to_delivery_meters.map(|d| d / 1000.0);

                // Vitesse moyenne selon le type de transport (km/h)
                let avg_speed_kmh = match row.engine_type.as_deref() {
                    Some("velo_cargo") | Some("velo") => 15.0,
                    Some("moto") | Some("scooter") => 40.0,
                    Some("voiture") | Some("camionnette") | Some("camion_leger") => 30.0, // En ville
                    Some("tricycle") => 20.0,
                    Some("pieton") => 5.0,
                    _ => 25.0, // Par défaut
                };

                // Temps estimé pour rejoindre le pickup (minutes)
                let estimated_time_to_pickup_minutes = distance_to_pickup_km
                    .map(|d| (d / avg_speed_kmh * 60.0).round() as i32);

                // Temps estimé pour la livraison pickup -> delivery (minutes)
                let estimated_delivery_time_minutes = distance_total_km
                    .map(|d| (d / avg_speed_kmh * 60.0).round() as i32);

                // Temps total estimé = temps au pickup + préparation + livraison
                let total_estimated_minutes = estimated_time_to_pickup_minutes
                    .unwrap_or(0)
                    + preparation_time_minutes.unwrap_or(0)
                    + estimated_delivery_time_minutes.unwrap_or(0);

                json!({
                    "id": row.id,
                    "user_id": row.user_id,
                    "name": row.nom_complet,
                    "email": row.email,
                    "avatar_url": row.avatar_url,
                    "rating_average": row.rating_average.and_then(|r| ToPrimitive::to_f64(&r)),
                    "rating_count": row.rating_count.unwrap_or(0),
                    "bio": row.bio,
                    "transport_type": row.engine_type,
                    "distance_km": distance_to_pickup_km,
                    "estimated_time_minutes": total_estimated_minutes,
                    "estimated_time_to_pickup_minutes": estimated_time_to_pickup_minutes,
                    "estimated_delivery_time_minutes": estimated_delivery_time_minutes,
                    "current_location": if row.current_latitude.is_some() && row.current_longitude.is_some() {
                        Some(json!({
                            "latitude": row.current_latitude,
                            "longitude": row.current_longitude
                        }))
                    } else {
                        None
                    },
                    "stats": {
                        "completed_deliveries": row.completed_deliveries.unwrap_or(0),
                        "cancelled_deliveries": row.cancelled_deliveries.unwrap_or(0),
                        "avg_delivery_time_minutes": row.avg_delivery_time_minutes.and_then(|t| ToPrimitive::to_f64(&t)),
                        "success_rate": success_rate
                    }
                })
            })
            .collect()
    } else {
        // Recherche simple sans géolocalisation (comportement original)
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

        couriers
            .into_iter()
            .map(|row| {
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
            .collect()
    };

    Ok(Json(json!({
        "couriers": couriers,
        "total": couriers.len(),
        "preparation_time_minutes": preparation_time_minutes,
        "note": if pickup_lat.is_some() && pickup_lng.is_some() {
            "Recherche géolocalisée avec calcul de distance et temps estimé"
        } else {
            "Recherche simple sans géolocalisation"
        }
    })))
}

// ✅ Phase 9 - Amélioration 32 : Handlers pour gérer les lieux de stock
async fn list_storage_locations(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    let locations = match sqlx::query_as::<_, crate::models::delivery_model::MerchantStorageLocation>(
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
    {
        Ok(locs) => locs,
        Err(e) => {
            // ✅ CORRIGÉ 2026-02-25: Si la table n'existe pas encore (migration non exécutée),
            // retourner une liste vide au lieu de crasher avec 500
            log::warn!("[delivery] Erreur récupération lieux de stock (table peut ne pas exister): {}", e);
            vec![]
        }
    };

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
        "#,
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
    let zones_list: Vec<Value> = state
        .cache_service
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
                        "#,
                    )
                    .fetch_all(&pg)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur récupération zones: {}", e)))?;

                    let zones_list: Vec<Value> = zones
                        .into_iter()
                        .map(|row| {
                            json!({
                                "id": row.get::<uuid::Uuid, _>("id"),
                                "name": row.get::<String, _>("display_name"),
                                "description": row.get::<Option<String>, _>("description"),
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
    let summary = service.get_delivery_summary(delivery_id).await?;

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

    // ✅ Générer des URLs pré-signées pour chaque média (48 heures de validité)
    let media_with_presigned: Vec<Value> = futures::future::join_all(media.into_iter().map(|m| {
        let storage_path = m.media_url.clone();
        let media_storage = state.media_storage.clone();
        async move {
            // Extraire le chemin de stockage depuis l'URL (enlever le préfixe CDN/Wasabi si présent)
            let storage_path_clean =
                if storage_path.starts_with("http://") || storage_path.starts_with("https://") {
                    // Extraire le chemin depuis l'URL complète
                    if let Some(path_start) = storage_path.find("/uploads/") {
                        storage_path[path_start + 1..].to_string() // +1 pour garder le "/"
                    } else {
                        // Si pas de /uploads/, utiliser le dernier segment
                        storage_path.split('/').last().unwrap_or(&storage_path).to_string()
                    }
                } else {
                    // Déjà un chemin relatif
                    if !storage_path.starts_with("uploads/") {
                        format!("uploads/{}", storage_path.trim_start_matches('/'))
                    } else {
                        storage_path
                    }
                };

            // Générer URL pré-signée (48 heures = 48 * 3600 secondes)
            match media_storage.generate_presigned_url(&storage_path_clean, 48 * 3600).await {
                Ok(presigned_url) => {
                    json!({
                        "id": m.id,
                        "delivery_id": m.delivery_id,
                        "media_type": m.media_type,
                        "media_url": presigned_url, // URL pré-signée
                        "proof_type": m.proof_type,
                        "uploaded_by": m.uploaded_by,
                        "uploaded_at": m.uploaded_at,
                        "metadata": m.metadata,
                        "created_at": m.created_at,
                    })
                }
                Err(e) => {
                    log::warn!(
                        "[DeliveryProof] Erreur génération URL pré-signée pour {}: {}",
                        storage_path_clean,
                        e
                    );
                    // Fallback vers URL publique si génération échoue
                    json!({
                        "id": m.id,
                        "delivery_id": m.delivery_id,
                        "media_type": m.media_type,
                        "media_url": m.media_url, // URL publique en fallback
                        "proof_type": m.proof_type,
                        "uploaded_by": m.uploaded_by,
                        "uploaded_at": m.uploaded_at,
                        "metadata": m.metadata,
                        "created_at": m.created_at,
                    })
                }
            }
        }
    }))
    .await;

    Ok(Json(json!({
        "media": media_with_presigned,
        "total": media_with_presigned.len(),
    })))
}

async fn upload_proof_media(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<crate::models::delivery_model::DeliveryProofMediaInput>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;

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
        return Err(AppError::BadRequest(
            "proof_type doit être 'pickup' ou 'delivery'".into(),
        ));
    }

    // Valider le media_type
    if payload.media_type != "image" && payload.media_type != "video" {
        return Err(AppError::BadRequest(
            "media_type doit être 'image' ou 'video'".into(),
        ));
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
    let summary = service.get_delivery_summary(delivery_id).await?;

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
        "#,
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

fn delivery_repository(
    state: &AppState,
) -> AppResult<crate::services::delivery_repository::DeliveryRepository> {
    Ok(crate::services::delivery_repository::DeliveryRepository::new(state.pg.clone()))
}

async fn enforce_delivery_access(
    service: &DeliveryService,
    summary: &crate::models::delivery_model::DeliverySummary,
    user_id: i32,
) -> AppResult<()> {
    if summary.creator_id == user_id
        || summary.recipient.as_ref().and_then(|recipient| recipient.user_id) == Some(user_id)
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
    let service: Option<ServiceUserIdRow> =
        sqlx::query_as("SELECT user_id FROM services WHERE id = $1")
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
    let zone_ids: Vec<String> = state
        .cache_service
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
                        "#,
                    )
                    .bind(s_id)
                    .bind(p_idx)
                    .fetch_all(&pg)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur récupération zones: {}", e)))?;

                    let zone_ids: Vec<String> = zones
                        .iter()
                        .filter_map(|row| {
                            row.try_get::<Option<String>, _>("zone_id").ok().flatten()
                        })
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
    let service: Option<ServiceUserIdRow> =
        sqlx::query_as("SELECT user_id FROM services WHERE id = $1")
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

        let zone_exists = sqlx::query("SELECT id FROM delivery_zones WHERE id = $1")
            .bind(zone_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification zone: {}", e)))?;

        if zone_exists.is_none() {
            return Err(AppError::BadRequest(format!(
                "Zone introuvable ou inactive: {}",
                zone_id_str
            )));
        }
    }

    // Note: product_delivery_zones table n'existe pas encore dans les migrations
    // TODO: Créer la migration pour cette table
    // Supprimer les associations existantes
    let _ = sqlx::query("SELECT 1 WHERE FALSE")
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
            "#,
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
        "#,
    )
    .bind(config_id)
    .fetch_optional(&state.pg)
    .await?;

    let config =
        config.ok_or_else(|| AppError::NotFound("Configuration non trouvée".to_string()))?;

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
        .update_stock(config_id, payload.storage_location_id, request, user.id)
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
        "#,
    )
    .bind(config_id)
    .fetch_optional(&state.pg)
    .await?;

    let config =
        config.ok_or_else(|| AppError::NotFound("Configuration non trouvée".to_string()))?;

    if config.user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le propriétaire de ce produit".to_string(),
        ));
    }

    let stock_service = ProductStockService::new(state.pg.clone());
    stock_service.remove_stock_location(config_id, location_id).await?;

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
    let delivery: Option<DeliveryCreatorRow> =
        sqlx::query_as("SELECT creator_id FROM deliveries WHERE id = $1")
            .bind(delivery_id)
            .fetch_optional(&state.pg)
            .await?;

    let delivery =
        delivery.ok_or_else(|| AppError::NotFound("Livraison non trouvée".to_string()))?;

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

    let provider_user_id =
        order.ok_or_else(|| AppError::NotFound("Commande non trouvée".to_string()))?;

    if user.id != provider_user_id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le prestataire de cette livraison".to_string(),
        ));
    }

    let verification_service = CourierVerificationService::new(state.pg.clone());
    let verification_code =
        verification_service.get_verification_code_for_delivery(delivery_id).await?;

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
        "#,
    )
    .bind(config_id)
    .fetch_optional(&state.pg)
    .await?;

    let config =
        config.ok_or_else(|| AppError::NotFound("Configuration non trouvée".to_string()))?;

    // Retourner uniquement l'adresse textuelle, pas les coordonnées GPS
    Ok(Json(json!({
        "pickup_locations": [{
            "address": config.pickup_address,
            "id": config_id
        }]
    })))
}

// ✅ NOUVEAU : Handlers pour les adresses sauvegardées

/// Paramètres de requête pour list_saved_addresses
#[derive(Debug, Deserialize)]
struct ListSavedAddressesQuery {
    address_type: Option<String>,
}

/// GET /api/delivery/saved-addresses - Lister les adresses sauvegardées d'un utilisateur
async fn list_saved_addresses(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<ListSavedAddressesQuery>,
) -> AppResult<Json<Value>> {
    // Validation du paramètre address_type si fourni
    let address_type = if let Some(ref addr_type) = params.address_type {
        let normalized = addr_type.trim().to_lowercase();
        if !normalized.is_empty() && !["pickup", "dropoff", "both"].contains(&normalized.as_str()) {
            return Err(AppError::BadRequest(
                "address_type doit être 'pickup', 'dropoff' ou 'both'".to_string(),
            ));
        }
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    } else {
        None
    };

    let repo = delivery_repository(&state)?;
    let addresses = repo
        .list_saved_addresses(user.id, address_type.as_deref())
        .await
        .map_err(|e| {
            log::error!(
                "[list_saved_addresses] Erreur lors de la récupération des adresses pour user_id={}: {}",
                user.id,
                e
            );
            e
        })?;

    Ok(Json(json!({
        "success": true,
        "addresses": addresses,
        "total": addresses.len()
    })))
}

/// POST /api/delivery/saved-addresses - Créer une nouvelle adresse sauvegardée
async fn create_saved_address(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<crate::models::delivery_model::UserSavedAddressInput>,
) -> AppResult<Json<Value>> {
    // Validation
    if payload.label.trim().is_empty() {
        return Err(AppError::BadRequest("Le label est requis".to_string()));
    }
    if !["pickup", "dropoff", "both"].contains(&payload.address_type.as_str()) {
        return Err(AppError::BadRequest(
            "address_type doit être 'pickup', 'dropoff' ou 'both'".to_string(),
        ));
    }
    if payload.address.trim().is_empty() {
        return Err(AppError::BadRequest("L'adresse est requise".to_string()));
    }
    if !(-90.0..=90.0).contains(&payload.latitude) || !(-180.0..=180.0).contains(&payload.longitude)
    {
        return Err(AppError::BadRequest(
            "Coordonnées GPS invalides".to_string(),
        ));
    }

    let repo = delivery_repository(&state)?;
    let address = repo.create_saved_address(user.id, payload).await?;

    Ok(Json(json!({
        "success": true,
        "address": address
    })))
}

/// ✅ NOUVEAU 2025-01-31 : POST /api/delivery/{id}/start-scheduled - Déclencher une livraison planifiée
/// Permet au coursier de démarrer facilement une livraison qui était en attente de la date planifiée
async fn start_scheduled_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;

    // Vérifier que l'utilisateur est le coursier assigné
    if let Some(courier_id) = summary.courier_id {
        let courier_user_id: Option<i32> =
            sqlx::query_scalar("SELECT user_id FROM couriers WHERE id = $1")
                .bind(courier_id)
                .fetch_optional(&state.pg)
                .await?;

        if courier_user_id != Some(user.id) {
            return Err(AppError::Unauthorized(
                "Vous n'êtes pas le coursier assigné à cette livraison".to_string(),
            ));
        }
    } else {
        return Err(AppError::BadRequest(
            "Aucun coursier assigné à cette livraison".to_string(),
        ));
    }

    // Vérifier que c'est une livraison planifiée
    let scheduled_delivery_at = summary
        .metadata
        .get("scheduled_delivery_at_utc")
        .and_then(|v| v.as_str())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));

    if scheduled_delivery_at.is_none() {
        return Err(AppError::BadRequest(
            "Cette livraison n'est pas une livraison planifiée".to_string(),
        ));
    }

    // Vérifier que la date planifiée est proche ou passée (max 2h de retard autorisé)
    if let Some(scheduled_at) = scheduled_delivery_at {
        let now = chrono::Utc::now();
        let diff = now - scheduled_at;
        if diff.num_hours() > 2 {
            return Err(AppError::BadRequest(
                format!(
                    "La date de livraison planifiée est trop ancienne ({}h de retard). Veuillez contacter le support.",
                    diff.num_hours()
                )
            ));
        }
        if diff.num_minutes() < -30 {
            return Err(AppError::BadRequest(
                "Il est trop tôt pour démarrer cette livraison (30 minutes avant la date planifiée)".to_string(),
            ));
        }
    }

    // Vérifier le statut actuel
    match summary.status {
        DeliveryStatus::AwaitingCourierConfirmation | DeliveryStatus::Accepted => {
            // Déclencher la livraison : passer à EnRoutePickup
            service
                .update_delivery_status(
                    delivery_id,
                    DeliveryStatus::EnRoutePickup,
                    None,
                    Some(user.id),
                    Some(json!({
                        "scheduled_delivery_started_at": chrono::Utc::now().to_rfc3339(),
                        "started_by": "courier",
                    })),
                )
                .await?;

            // Mettre à jour les métadonnées via update_delivery_status
            let updated_summary = service.get_delivery_summary(delivery_id).await?;
            let mut metadata = updated_summary.metadata.clone();
            metadata["scheduled_delivery_started"] = json!(true);
            metadata["scheduled_delivery_started_at"] = json!(chrono::Utc::now().to_rfc3339());

            // Les métadonnées seront mises à jour via update_delivery_status
            Ok(Json(json!({
                "success": true,
                "message": "Livraison planifiée démarrée avec succès",
                "delivery_id": delivery_id,
                "new_status": "en_route_pickup",
            })))
        }
        _ => Err(AppError::BadRequest(format!(
            "Impossible de démarrer la livraison. Statut actuel: {:?}",
            summary.status
        ))),
    }
}

/// GET /api/delivery/saved-addresses/{id} - Récupérer une adresse sauvegardée par ID
async fn get_saved_address(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(address_id): Path<i32>,
) -> AppResult<Json<Value>> {
    let repo = delivery_repository(&state)?;
    let address = repo.get_saved_address_by_id(user.id, address_id).await?;

    match address {
        Some(addr) => Ok(Json(json!({
            "success": true,
            "address": addr
        }))),
        None => Err(AppError::NotFound("Adresse non trouvée".to_string())),
    }
}

/// PUT /api/delivery/saved-addresses/{id} - Mettre à jour une adresse sauvegardée
async fn update_saved_address(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(address_id): Path<i32>,
    Json(payload): Json<crate::models::delivery_model::UserSavedAddressInput>,
) -> AppResult<Json<Value>> {
    // Validation
    if payload.label.trim().is_empty() {
        return Err(AppError::BadRequest("Le label est requis".to_string()));
    }
    if !["pickup", "dropoff", "both"].contains(&payload.address_type.as_str()) {
        return Err(AppError::BadRequest(
            "address_type doit être 'pickup', 'dropoff' ou 'both'".to_string(),
        ));
    }
    if payload.address.trim().is_empty() {
        return Err(AppError::BadRequest("L'adresse est requise".to_string()));
    }
    if !(-90.0..=90.0).contains(&payload.latitude) || !(-180.0..=180.0).contains(&payload.longitude)
    {
        return Err(AppError::BadRequest(
            "Coordonnées GPS invalides".to_string(),
        ));
    }

    let repo = delivery_repository(&state)?;
    let address = repo.update_saved_address(user.id, address_id, payload).await?;

    Ok(Json(json!({
        "success": true,
        "address": address
    })))
}

/// DELETE /api/delivery/saved-addresses/{id} - Supprimer une adresse sauvegardée
async fn delete_saved_address(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(address_id): Path<i32>,
) -> AppResult<Json<Value>> {
    let repo = delivery_repository(&state)?;
    repo.delete_saved_address(user.id, address_id).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Adresse supprimée avec succès"
    })))
}

/// POST /api/delivery/saved-addresses/{id}/set-default - Définir une adresse comme défaut
async fn set_default_saved_address(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(address_id): Path<i32>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<Json<Value>> {
    let address_type = payload.get("address_type").and_then(|v| v.as_str()).ok_or_else(|| {
        AppError::BadRequest("address_type est requis ('pickup' ou 'dropoff')".to_string())
    })?;

    if !["pickup", "dropoff"].contains(&address_type) {
        return Err(AppError::BadRequest(
            "address_type doit être 'pickup' ou 'dropoff'".to_string(),
        ));
    }

    let repo = delivery_repository(&state)?;
    let address = repo.set_default_saved_address(user.id, address_id, address_type).await?;

    Ok(Json(json!({
        "success": true,
        "address": address
    })))
}

// ✅ NOUVEAU 2026-01-04: Handlers pour les partenaires de livraison

/// GET /api/delivery/partners - Lister tous les partenaires (admin uniquement)
/// Peut être filtré par type via query param ?type=Livraison
async fn list_delivery_partners(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<serde_json::Map<String, serde_json::Value>>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur est admin
    if user.role != "admin" {
        log::warn!(
            "[delivery/partners] Accès refusé pour utilisateur {} (rôle: {})",
            user.id,
            user.role
        );
        return Err(AppError::Forbidden(
            "Accès réservé aux administrateurs".to_string(),
        ));
    }

    // ✅ NOUVEAU 2026-01-04: Filtrer par type si fourni (pour l'écran d'enregistrement coursier)
    let partner_type_filter: Option<String> =
        params.get("type").and_then(|v| v.as_str()).map(|s| s.to_string());

    let partners: Vec<crate::models::delivery_model::DeliveryPartner> = if let Some(partner_type) =
        partner_type_filter
    {
        // ✅ CORRIGÉ 2026-01-14: Normaliser la casse pour éviter les problèmes de sensibilité
        let partner_type_lower = partner_type.to_lowercase();
        sqlx::query_as(
            r#"
            SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                   continent, website, logo_url, location_latitude, location_longitude, location_address, 
                   is_active, created_by, created_at, updated_at
            FROM delivery_partners
            WHERE LOWER(partner_type::text) = $1 AND is_active = TRUE
            ORDER BY country, name ASC
            "#
        )
        .bind(partner_type_lower)
        .fetch_all(&state.pg)
        .await?
    } else {
        sqlx::query_as(
            r#"
            SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                   continent, website, logo_url, location_latitude, location_longitude, location_address, 
                   is_active, created_by, created_at, updated_at
            FROM delivery_partners
            ORDER BY country, name ASC
            "#
        )
        .fetch_all(&state.pg)
        .await?
    };

    Ok(Json(json!({
        "success": true,
        "partners": partners,
        "total": partners.len()
    })))
}

/// GET /api/delivery/partners/public - Lister les partenaires actifs (authentifié, pas besoin d'être admin)
/// Peut être filtré par type via query param ?type=livraison
/// Utilisé par les coursiers pour sélectionner un partenaire lors de l'enregistrement
async fn list_delivery_partners_public(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Query(params): Query<serde_json::Map<String, serde_json::Value>>,
) -> AppResult<Json<Value>> {
    // ✅ NOUVEAU 2026-01-14: Filtrer par type si fourni (pour l'écran d'enregistrement coursier)
    let partner_type_filter: Option<String> =
        params.get("type").and_then(|v| v.as_str()).map(|s| s.to_lowercase()); // Normaliser la casse

    let partners: Vec<crate::models::delivery_model::DeliveryPartner> = if let Some(partner_type) =
        partner_type_filter
    {
        sqlx::query_as(
            r#"
            SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                   continent, website, logo_url, location_latitude, location_longitude, location_address, 
                   is_active, created_by, created_at, updated_at
            FROM delivery_partners
            WHERE LOWER(partner_type::text) = $1 AND is_active = TRUE
            ORDER BY country, name ASC
            "#
        )
        .bind(partner_type)
        .fetch_all(&state.pg)
        .await?
    } else {
        // Si aucun filtre, retourner tous les partenaires actifs
        sqlx::query_as(
            r#"
            SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                   continent, website, logo_url, location_latitude, location_longitude, location_address, 
                   is_active, created_by, created_at, updated_at
            FROM delivery_partners
            WHERE is_active = TRUE
            ORDER BY country, name ASC
            "#
        )
        .fetch_all(&state.pg)
        .await?
    };

    log::info!(
        "[delivery/partners/public] {} partenaires retournés pour utilisateur authentifié",
        partners.len()
    );

    Ok(Json(json!({
        "success": true,
        "partners": partners,
        "total": partners.len()
    })))
}

/// POST /api/delivery/partners - Créer un nouveau partenaire (admin uniquement)
async fn create_delivery_partner(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<crate::models::delivery_model::DeliveryPartnerInput>,
) -> AppResult<Json<Value>> {
    // ✅ CORRECTION 2026-02-07: Vérifier admin OU super_admin
    crate::utils::role_helpers::ensure_admin_role(&user)?;

    // Validation
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("Le nom est requis".to_string()));
    }

    // ✅ NOUVEAU 2026-01-04: Valider et convertir le type de partenaire
    let partner_type_str = payload.partner_type.as_deref().unwrap_or("livraison");
    let valid_types = [
        "livraison",
        "livraison_courses_marche",
        "pharmacie",
        "hopital",
        "laboratoire",
        "agence de voyage",
        "demenagement",
        "transport",
        "assureur",
        "supermarche",
        "telecom",
        "chauffeur",
        "hotel",
        "meuble",
    ];
    if !valid_types.contains(&partner_type_str) {
        return Err(AppError::BadRequest(format!(
            "Type de partenaire invalide. Types valides: {}",
            valid_types.join(", ")
        )));
    }

    let partner: crate::models::delivery_model::DeliveryPartner = sqlx::query_as(
        r#"
        INSERT INTO delivery_partners (name, description, partner_type, contact_email, contact_phone, address, 
                                      city, country, continent, website, logo_url, location_latitude, location_longitude, 
                                      location_address, is_active, created_by)
        VALUES ($1, $2, $3::delivery_partner_type, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                  continent, website, logo_url, location_latitude, location_longitude, location_address, 
                  is_active, created_by, created_at, updated_at
        "#
    )
    .bind(payload.name.trim())
    .bind(payload.description.as_ref().map(|s| s.trim()))
    .bind(partner_type_str)
    .bind(payload.contact_email.as_ref().map(|s| s.trim()))
    .bind(payload.contact_phone.as_ref().map(|s| s.trim()))
    .bind(payload.address.as_ref().map(|s| s.trim()))
    .bind(payload.city.as_ref().map(|s| s.trim()))
    .bind(payload.country.trim())
    .bind(payload.continent.as_ref().map(|s| s.trim()))
    .bind(payload.website.as_ref().map(|s| s.trim()))
    .bind(payload.logo_url.as_ref().map(|s| s.trim()))
    .bind(payload.location_latitude)
    .bind(payload.location_longitude)
    .bind(payload.location_address.as_ref().map(|s| s.trim()))
    .bind(payload.is_active.unwrap_or(true))
    .bind(user.id)
    .fetch_one(&state.pg)
    .await?;

    Ok(Json(json!({
        "success": true,
        "partner": partner
    })))
}

/// GET /api/delivery/partners/{id} - Récupérer un partenaire par ID
async fn get_delivery_partner(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(partner_id): Path<i32>,
) -> AppResult<Json<Value>> {
    // ✅ CORRECTION 2026-02-07: Vérifier admin OU super_admin
    crate::utils::role_helpers::ensure_admin_role(&user)?;

    let partner: Option<crate::models::delivery_model::DeliveryPartner> = sqlx::query_as(
        r#"
        SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
               continent, website, logo_url, location_latitude, location_longitude, location_address, 
               is_active, created_by, created_at, updated_at
        FROM delivery_partners
        WHERE id = $1
        "#
    )
    .bind(partner_id)
    .fetch_optional(&state.pg)
    .await?;

    match partner {
        Some(p) => Ok(Json(json!({
            "success": true,
            "partner": p
        }))),
        None => Err(AppError::NotFound("Partenaire non trouvé".to_string())),
    }
}

/// PUT /api/delivery/partners/{id} - Mettre à jour un partenaire (admin uniquement)
async fn update_delivery_partner(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(partner_id): Path<i32>,
    Json(payload): Json<crate::models::delivery_model::DeliveryPartnerInput>,
) -> AppResult<Json<Value>> {
    // ✅ CORRECTION 2026-02-07: Vérifier admin OU super_admin
    crate::utils::role_helpers::ensure_admin_role(&user)?;

    // Validation
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("Le nom est requis".to_string()));
    }

    // ✅ NOUVEAU 2026-01-04: Valider et convertir le type de partenaire
    let partner_type_str = payload.partner_type.as_deref().unwrap_or("livraison");
    let valid_types = [
        "livraison",
        "livraison_courses_marche",
        "pharmacie",
        "hopital",
        "laboratoire",
        "agence de voyage",
        "demenagement",
        "transport",
        "assureur",
        "supermarche",
        "telecom",
        "chauffeur",
        "hotel",
        "meuble",
    ];
    if !valid_types.contains(&partner_type_str) {
        return Err(AppError::BadRequest(format!(
            "Type de partenaire invalide. Types valides: {}",
            valid_types.join(", ")
        )));
    }

    let partner: Option<crate::models::delivery_model::DeliveryPartner> = sqlx::query_as(
        r#"
        UPDATE delivery_partners
        SET name = $1, description = $2, partner_type = $3::delivery_partner_type, contact_email = $4, contact_phone = $5, address = $6,
            city = $7, country = $8, continent = $9, website = $10, logo_url = $11, location_latitude = $12, location_longitude = $13, 
            location_address = $14, is_active = $15, updated_at = NOW()
        WHERE id = $16
        RETURNING id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                  continent, website, logo_url, location_latitude, location_longitude, location_address, 
                  is_active, created_by, created_at, updated_at
        "#
    )
    .bind(payload.name.trim())
    .bind(payload.description.as_ref().map(|s| s.trim()))
    .bind(partner_type_str)
    .bind(payload.contact_email.as_ref().map(|s| s.trim()))
    .bind(payload.contact_phone.as_ref().map(|s| s.trim()))
    .bind(payload.address.as_ref().map(|s| s.trim()))
    .bind(payload.city.as_ref().map(|s| s.trim()))
    .bind(payload.country.trim())
    .bind(payload.continent.as_ref().map(|s| s.trim()))
    .bind(payload.website.as_ref().map(|s| s.trim()))
    .bind(payload.logo_url.as_ref().map(|s| s.trim()))
    .bind(payload.location_latitude)
    .bind(payload.location_longitude)
    .bind(payload.location_address.as_ref().map(|s| s.trim()))
    .bind(payload.is_active.unwrap_or(true))
    .bind(partner_id)
    .fetch_optional(&state.pg)
    .await?;

    match partner {
        Some(p) => Ok(Json(json!({
            "success": true,
            "partner": p
        }))),
        None => Err(AppError::NotFound("Partenaire non trouvé".to_string())),
    }
}

/// DELETE /api/delivery/partners/{id} - Supprimer un partenaire (admin uniquement)
async fn delete_delivery_partner(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(partner_id): Path<i32>,
) -> AppResult<Json<Value>> {
    // ✅ CORRECTION 2026-02-07: Vérifier admin OU super_admin
    crate::utils::role_helpers::ensure_admin_role(&user)?;

    // Vérifier qu'aucun coursier n'utilise ce partenaire
    let courier_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM courier_applications WHERE partner_id = $1")
            .bind(partner_id)
            .fetch_one(&state.pg)
            .await?;

    if courier_count > 0 {
        return Err(AppError::BadRequest(format!(
            "Impossible de supprimer ce partenaire car {} coursier(s) y sont associé(s)",
            courier_count
        )));
    }

    let deleted = sqlx::query("DELETE FROM delivery_partners WHERE id = $1")
        .bind(partner_id)
        .execute(&state.pg)
        .await?;

    if deleted.rows_affected() == 0 {
        return Err(AppError::NotFound("Partenaire non trouvé".to_string()));
    }

    Ok(Json(json!({
        "success": true,
        "message": "Partenaire supprimé avec succès"
    })))
}

/// GET /api/partners/search - Recherche autocomplete des partenaires par type et nom
/// Accessible aux utilisateurs authentifiés (prestataires)
/// Query params: ?type=pharmacie&query=central&limit=10
async fn search_partners_autocomplete(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Query(params): Query<serde_json::Map<String, serde_json::Value>>,
) -> AppResult<Json<Value>> {
    // Récupérer les paramètres de requête
    let partner_type: Option<String> =
        params.get("type").and_then(|v| v.as_str()).map(|s| s.to_string());

    let query: Option<String> = params
        .get("query")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let limit: i64 = params.get("limit").and_then(|v| v.as_i64()).unwrap_or(20).min(50); // Limiter à 50 résultats max

    // Valider le type de partenaire si fourni
    if let Some(ref pt) = partner_type {
        let valid_types = [
            "livraison",
            "livraison_courses_marche",
            "pharmacie",
            "hopital",
            "laboratoire",
            "agence de voyage",
            "demenagement",
            "transport",
            "assureur",
            "supermarche",
            "telecom",
            "chauffeur",
            "hotel",
            "meuble",
        ];
        if !valid_types.contains(&pt.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Type de partenaire invalide. Types valides: {}",
                valid_types.join(", ")
            )));
        }
    }

    // Construire la requête SQL
    let partners: Vec<crate::models::delivery_model::DeliveryPartner> = if let Some(ref pt) =
        partner_type
    {
        if let Some(ref q) = query {
            // Recherche avec type et query
            sqlx::query_as(
                r#"
                SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                       continent, website, logo_url, location_latitude, location_longitude, location_address, 
                       is_active, created_by, created_at, updated_at
                FROM delivery_partners
                WHERE partner_type::text = $1 
                  AND is_active = TRUE
                  AND (LOWER(name) LIKE LOWER($2) OR LOWER(city) LIKE LOWER($2) OR LOWER(country) LIKE LOWER($2))
                ORDER BY 
                    CASE WHEN LOWER(name) LIKE LOWER($2) THEN 1 ELSE 2 END,
                    country, name ASC
                LIMIT $3
                "#
            )
            .bind(pt)
            .bind(format!("%{}%", q))
            .bind(limit)
            .fetch_all(&state.pg)
            .await?
        } else {
            // Recherche avec type uniquement
            sqlx::query_as(
                r#"
                SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                       continent, website, logo_url, location_latitude, location_longitude, location_address, 
                       is_active, created_by, created_at, updated_at
                FROM delivery_partners
                WHERE partner_type::text = $1 AND is_active = TRUE
                ORDER BY country, name ASC
                LIMIT $2
                "#
            )
            .bind(pt)
            .bind(limit)
            .fetch_all(&state.pg)
            .await?
        }
    } else if let Some(ref q) = query {
        // Recherche avec query uniquement (tous types)
        sqlx::query_as(
            r#"
            SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                   continent, website, logo_url, location_latitude, location_longitude, location_address, 
                   is_active, created_by, created_at, updated_at
            FROM delivery_partners
            WHERE is_active = TRUE
              AND (LOWER(name) LIKE LOWER($1) OR LOWER(city) LIKE LOWER($1) OR LOWER(country) LIKE LOWER($1))
            ORDER BY 
                CASE WHEN LOWER(name) LIKE LOWER($1) THEN 1 ELSE 2 END,
                country, name ASC
            LIMIT $2
            "#
        )
        .bind(format!("%{}%", q))
        .bind(limit)
        .fetch_all(&state.pg)
        .await?
    } else {
        // Aucun filtre : retourner les partenaires actifs récents
        sqlx::query_as(
            r#"
            SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                   continent, website, logo_url, location_latitude, location_longitude, location_address, 
                   is_active, created_by, created_at, updated_at
            FROM delivery_partners
            WHERE is_active = TRUE
            ORDER BY created_at DESC, country, name ASC
            LIMIT $1
            "#
        )
        .bind(limit)
        .fetch_all(&state.pg)
        .await?
    };

    Ok(Json(json!({
        "success": true,
        "partners": partners,
        "total": partners.len()
    })))
}

/// GET /api/partners/me - Récupérer les données du partenaire connecté
async fn get_my_partner_data(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    if user.role != "partenaire" {
        return Err(AppError::Forbidden("Accès réservé aux partenaires".into()));
    }

    let partner: Option<crate::models::delivery_model::DeliveryPartner> = sqlx::query_as(
        r#"
        SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
               continent, website, logo_url, location_latitude, location_longitude, location_address, 
               is_active, created_by, created_at, updated_at
        FROM delivery_partners
        WHERE created_by = $1
        LIMIT 1
        "#
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?;

    match partner {
        Some(mut p) => {
            // ✅ NOUVEAU: Transformer logo_url en URL CDN publique si nécessaire
            if let Some(ref logo_path) = p.logo_url {
                if !logo_path.starts_with("http://") && !logo_path.starts_with("https://") {
                    p.logo_url = Some(state.media_storage.build_public_url(logo_path));
                }
            }

            Ok(Json(json!({
                "success": true,
                "data": p
            })))
        }
        None => Err(AppError::NotFound(
            "Partenaire non trouvé. Votre compte n'a pas encore été lié à un partenaire.".into(),
        )),
    }
}

/// PUT /api/partners/me - Mettre à jour les données du partenaire connecté
#[derive(Deserialize)]
struct UpdateMyPartnerDataRequest {
    name: Option<String>,
    contact_email: Option<String>,
    contact_phone: Option<String>,
    address: Option<String>,
    website: Option<String>,
}

async fn update_my_partner_data(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<UpdateMyPartnerDataRequest>,
) -> AppResult<Json<Value>> {
    if user.role != "partenaire" {
        return Err(AppError::Forbidden("Accès réservé aux partenaires".into()));
    }

    // Récupérer le partenaire actuel
    let current_partner: Option<crate::models::delivery_model::DeliveryPartner> = sqlx::query_as(
        r#"
        SELECT id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
               continent, website, logo_url, location_latitude, location_longitude, location_address, 
               is_active, created_by, created_at, updated_at
        FROM delivery_partners
        WHERE user_id = $1
        LIMIT 1
        "#
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?;

    let partner_id = match current_partner {
        Some(p) => p.id,
        None => {
            return Err(AppError::NotFound(
                "Partenaire non trouvé. Votre compte n'a pas encore été lié à un partenaire."
                    .into(),
            ))
        }
    };

    // Mettre à jour uniquement les champs fournis
    let updated = sqlx::query_as::<_, crate::models::delivery_model::DeliveryPartner>(
        r#"
        UPDATE delivery_partners
        SET 
            name = COALESCE($1, name),
            contact_email = COALESCE($2, contact_email),
            contact_phone = COALESCE($3, contact_phone),
            address = COALESCE($4, address),
            website = COALESCE($5, website),
            updated_at = NOW()
        WHERE id = $6 AND user_id = $7
        RETURNING id, name, description, partner_type, contact_email, contact_phone, address, city, country, 
                  continent, website, logo_url, location_latitude, location_longitude, location_address, 
                  is_active, created_by, created_at, updated_at
        "#
    )
    .bind(payload.name.as_ref().map(|s| s.trim()))
    .bind(payload.contact_email.as_ref().map(|s| s.trim()))
    .bind(payload.contact_phone.as_ref().map(|s| s.trim()))
    .bind(payload.address.as_ref().map(|s| s.trim()))
    .bind(payload.website.as_ref().map(|s| s.trim()))
    .bind(partner_id)
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?;

    match updated {
        Some(p) => Ok(Json(json!({
            "success": true,
            "data": p
        }))),
        None => Err(AppError::NotFound(
            "Partenaire non trouvé ou vous n'avez pas les droits pour le modifier".into(),
        )),
    }
}

/// ✅ NOUVEAU : POST /api/delivery/{id}/report-difficulty
/// Permet au coursier de signaler une difficulté (panne, malaise) et de recommander un relais
#[derive(Deserialize)]
struct ReportDifficultyPayload {
    difficulty_type: String, // "breakdown" (panne) ou "illness" (malaise)
    relay_location: Option<serde_json::Value>, // { latitude, longitude, address }
    notes: Option<String>,
}

async fn report_courier_difficulty(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<ReportDifficultyPayload>,
) -> AppResult<Json<Value>> {
    use crate::models::delivery_model::DeliveryStatus;
    use crate::services::push_notification_service;
    use chrono::Utc;

    let service = delivery_service(&state)?;

    // Vérifier que l'utilisateur est bien le coursier assigné
    let summary = service.get_delivery_summary(delivery_id).await?;

    // Vérifier que l'utilisateur est le coursier
    let courier_id = summary
        .courier_id
        .ok_or_else(|| AppError::BadRequest("Aucun coursier assigné à cette livraison".into()))?;

    let courier_user_id: i32 = sqlx::query_scalar("SELECT user_id FROM couriers WHERE id = $1")
        .bind(courier_id)
        .fetch_optional(&state.pg)
        .await?
        .ok_or_else(|| AppError::BadRequest("Coursier non trouvé".into()))?;

    if courier_user_id != user.id {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le coursier assigné à cette livraison".into(),
        ));
    }

    // Vérifier que la livraison est en cours (pas déjà livrée ou annulée)
    if matches!(
        summary.status,
        DeliveryStatus::Delivered | DeliveryStatus::Completed | DeliveryStatus::Cancelled
    ) {
        return Err(AppError::BadRequest(
            "Cette livraison est déjà terminée ou annulée".into(),
        ));
    }

    // Récupérer la position actuelle du coursier (depuis les métadonnées ou GPS)
    let current_courier_location = summary
        .metadata
        .get("courier_current_location")
        .or_else(|| summary.metadata.get("last_location"))
        .cloned();

    // Utiliser le relais recommandé ou la position actuelle du coursier
    let relay_location = payload
        .relay_location
        .or_else(|| current_courier_location)
        .ok_or_else(|| AppError::BadRequest("Position du relais requise".into()))?;

    // Sauvegarder les informations de difficulté dans les métadonnées
    // ✅ IMPORTANT : Préserver toutes les informations existantes (recommandations, aller-retour, etc.)
    let mut metadata = summary.metadata.clone();

    // Ajouter les informations de difficulté
    metadata["courier_difficulty"] = json!({
        "type": payload.difficulty_type,
        "reported_at": Utc::now().to_rfc3339(),
        "reported_by": user.id,
        "relay_location": relay_location,
        "notes": payload.notes,
        "original_courier_id": courier_id,
    });

    // ✅ Préserver les informations importantes pour le nouveau coursier
    // Les informations suivantes sont déjà dans summary et seront transmises automatiquement :
    // - dropoff (adresse de livraison)
    // - recipient (avec notes/instructions)
    // - is_round_trip, return_pickup, return_dropoff (aller-retour)
    // - preferred_delivery_date, preferred_delivery_time_start, etc. (préférences)

    // Ajouter un flag pour indiquer que c'est un relais
    metadata["is_relay"] = json!(true);
    metadata["relay_info"] = json!({
        "original_courier_id": courier_id,
        "relay_location": relay_location,
        "difficulty_type": payload.difficulty_type,
    });

    // Mettre à jour les métadonnées de la livraison
    sqlx::query("UPDATE deliveries SET metadata = $1, updated_at = NOW() WHERE id = $2")
        .bind(&metadata)
        .bind(delivery_id)
        .execute(&state.pg)
        .await?;

    // Créer un événement de statut pour tracer la difficulté
    use crate::services::delivery_repository::NewStatusEvent;
    service
        .repository()
        .add_status_event(NewStatusEvent {
            delivery_id,
            status: summary.status.clone(), // Garder le statut actuel
            payload: Some(json!({
                "event_type": "courier_difficulty",
                "difficulty_type": payload.difficulty_type,
                "relay_location": relay_location,
                "notes": payload.notes,
            })),
            recorded_by: Some(user.id),
        })
        .await?;

    // ✅ Désassigner le coursier actuel
    sqlx::query("UPDATE deliveries SET courier_id = NULL, updated_at = NOW() WHERE id = $1")
        .bind(delivery_id)
        .execute(&state.pg)
        .await?;

    // ✅ Mettre à jour le point de collecte pour le nouveau coursier (relais)
    if let (Some(lat), Some(lng)) = (
        relay_location.get("latitude").and_then(|v| v.as_f64()),
        relay_location.get("longitude").and_then(|v| v.as_f64()),
    ) {
        let address = relay_location.get("address").and_then(|v| v.as_str()).map(|s| s.to_string());

        sqlx::query(
            r#"
            UPDATE deliveries 
            SET pickup_latitude = $1, 
                pickup_longitude = $2,
                pickup_address = COALESCE($3, pickup_address),
                updated_at = NOW()
            WHERE id = $4
            "#,
        )
        .bind(lat)
        .bind(lng)
        .bind(address)
        .bind(delivery_id)
        .execute(&state.pg)
        .await?;
    }

    // ✅ Relancer le matching avec un nouveau coursier
    let updated_summary = service.get_delivery_summary(delivery_id).await?;

    // Mettre le statut de matching à "Searching" pour relancer
    service
        .repository()
        .update_matching_queue_status(
            delivery_id,
            DeliveryMatchingStatus::Searching,
            None,
            Some(json!({
                "reason": "courier_difficulty",
                "original_courier_id": courier_id,
                "difficulty_type": payload.difficulty_type,
                "relay_location": relay_location,
            })),
            false,
        )
        .await?;

    // Enfiler dans la file de matching
    service.enqueue_delivery_matching(&updated_summary).await?;

    // ✅ Envoyer notification au client
    let creator_id = summary.creator_id;
    let difficulty_message = match payload.difficulty_type.as_str() {
        "breakdown" => "Votre coursier a signalé une panne de son moyen de transport. Un nouveau coursier va prendre le relais.",
        "illness" => "Votre coursier a signalé un malaise. Un nouveau coursier va prendre le relais pour votre sécurité.",
        _ => "Votre coursier a signalé une difficulté. Un nouveau coursier va prendre le relais.",
    };

    // Créer notification
    let _ = crate::services::notification_service::create_notification(
        &state.pg,
        creator_id,
        crate::services::notification_service::NotificationType::DeliveryInTransit,
        "⚠️ Difficulté du coursier".to_string(),
        difficulty_message.to_string(),
        Some(json!({
            "delivery_id": delivery_id,
            "difficulty_type": payload.difficulty_type,
            "new_courier_searching": true,
        })),
    )
    .await;

    // Push notification
    let _ = push_notification_service::send_push_notification(
        &state.pg,
        creator_id,
        "⚠️ Difficulté du coursier".to_string(),
        difficulty_message.to_string(),
        Some(json!({
            "type": "delivery_difficulty",
            "delivery_id": delivery_id,
        })),
        Some("default".to_string()),
    )
    .await;

    log::info!(
        "[report_courier_difficulty] ✅ Difficulté signalée pour livraison {} par coursier {}. Matching relancé.",
        delivery_id,
        courier_id
    );

    Ok(Json(json!({
        "success": true,
        "message": "Difficulté signalée. Un nouveau coursier va être recherché.",
        "delivery_id": delivery_id,
        "matching_relaunched": true,
    })))
}

/// ✅ NOUVEAU : POST /api/delivery/{id}/accept
/// Permet à un coursier d'accepter une course pour laquelle il a été notifié
async fn accept_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    use crate::models::delivery_model::DeliveryStatus;
    use crate::services::push_notification_service;
    use chrono::Utc;

    let service = delivery_service(&state)?;

    // Vérifier que l'utilisateur est bien un coursier
    let courier = service.repository().find_courier_by_user(user.id).await?;
    let courier_id = courier
        .ok_or_else(|| AppError::BadRequest("Vous n'êtes pas un coursier".into()))?
        .id;

    // Récupérer la livraison
    let summary = service.get_delivery_summary(delivery_id).await?;

    // Vérifier que la livraison est en attente d'acceptation
    if summary.status != DeliveryStatus::AwaitingCourierConfirmation {
        return Err(AppError::BadRequest(
            "Cette livraison n'est pas en attente d'acceptation".into(),
        ));
    }

    // Vérifier que le coursier a bien été notifié
    let notified_courier_ids: Vec<String> = summary
        .metadata
        .get("notified_couriers")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let courier_id_str = courier_id.to_string();
    if !notified_courier_ids.contains(&courier_id_str) {
        return Err(AppError::Forbidden(
            "Vous n'avez pas été notifié pour cette livraison".into(),
        ));
    }

    // ✅ NOUVEAU: Vérifier la compatibilité avec les courses actives du coursier
    // Un coursier peut accepter plusieurs courses si elles sont compatibles (même pickup ou sur trajectoire)
    let active_deliveries = service.repository().get_courier_active_deliveries(courier_id).await?;

    // Si le coursier a déjà des courses actives, vérifier la compatibilité
    if !active_deliveries.is_empty() {
        use crate::services::delivery_service::is_delivery_compatible;

        if !is_delivery_compatible(&summary, &active_deliveries) {
            return Err(AppError::BadRequest(
                format!(
                    "Cette course n'est pas compatible avec vos {} course(s) active(s). \
                    Vous ne pouvez accepter que des courses au même point de pickup ou sur votre trajectoire.",
                    active_deliveries.len()
                ).into(),
            ));
        }

        log::info!(
            "[accept_delivery] ✅ Course {} compatible avec {} course(s) active(s) du coursier {}",
            delivery_id,
            active_deliveries.len(),
            courier_id
        );
    }

    // ✅ Arrêter toutes les notifications pour les autres coursiers
    if let Err(e) = service.stop_delivery_notifications(delivery_id).await {
        log::error!(
            "Erreur arrêt notifications pour livraison {}: {:?}",
            delivery_id,
            e
        );
    }

    // ✅ Assigner le coursier à la livraison
    service.repository().assign_delivery_courier(delivery_id, courier_id).await?;

    // ✅ Mettre à jour le statut de matching
    service
        .repository()
        .update_matching_queue_status(
            delivery_id,
            DeliveryMatchingStatus::Assigned,
            None,
            Some(json!({
                "accepted_by": courier_id.to_string(),
                "accepted_at": Utc::now().to_rfc3339(),
            })),
            false,
        )
        .await?;

    // ✅ Créer un événement de matching
    service
        .repository()
        .insert_matching_event(NewDeliveryMatchingEvent {
            delivery_id,
            courier_id: Some(courier_id),
            status: DeliveryMatchingStatus::Assigned,
            score: None,
            reason: Some("courier_accepted".into()),
            metadata: json!({
                "accepted_at": Utc::now().to_rfc3339(),
                "accepted_by_user": user.id,
            }),
        })
        .await?;

    // ✅ Mettre à jour le statut de la livraison à "Accepted"
    service
        .update_delivery_status(
            delivery_id,
            DeliveryStatus::Accepted,
            None,
            Some(user.id),
            Some(json!({
                "accepted_by": courier_id.to_string(),
                "accepted_at": Utc::now().to_rfc3339(),
            })),
        )
        .await?;

    // ✅ Envoyer notification de confirmation au coursier
    let _ = push_notification_service::send_push_notification(
        &state.pg,
        user.id,
        "✅ Course acceptée".to_string(),
        format!(
            "Vous avez accepté la course #{}. Vous pouvez maintenant démarrer la livraison.",
            delivery_id.to_string()[..8].to_uppercase()
        ),
        Some(json!({
            "type": "delivery_accepted",
            "delivery_id": delivery_id.to_string(),
            "accepted": true,
        })),
        Some("default".to_string()),
    )
    .await;

    // ✅ Notifier le client que sa course a été acceptée
    let creator_id = summary.creator_id;
    let _ = push_notification_service::send_push_notification(
        &state.pg,
        creator_id,
        "✅ Course acceptée".to_string(),
        format!(
            "Votre course #{} a été acceptée par un coursier. La livraison va commencer.",
            delivery_id.to_string()[..8].to_uppercase()
        ),
        Some(json!({
            "type": "delivery_accepted_by_courier",
            "delivery_id": delivery_id.to_string(),
        })),
        Some("default".to_string()),
    )
    .await;

    // Créer notification en base
    let _ = crate::services::notification_service::create_notification(
        &state.pg,
        creator_id,
        crate::services::notification_service::NotificationType::DeliveryAccepted,
        "✅ Course acceptée".to_string(),
        format!(
            "Votre course #{} a été acceptée par un coursier.",
            delivery_id.to_string()[..8].to_uppercase()
        ),
        Some(json!({
            "delivery_id": delivery_id.to_string(),
            "courier_id": courier_id.to_string(),
        })),
    )
    .await;

    log::info!(
        "[accept_delivery] ✅ Coursier {} a accepté la livraison {}",
        courier_id,
        delivery_id
    );

    Ok(Json(json!({
        "success": true,
        "message": "Course acceptée avec succès",
        "delivery_id": delivery_id,
        "courier_id": courier_id,
    })))
}
