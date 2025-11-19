// ✅ Phase 4 - Amélioration 8 : Routes API publiques pour prestataires externes
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::Utc;
use rust_decimal::prelude::FromPrimitive;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    models::delivery_model::{
        ClientDeliveryPreferencesInput, ExternalClientInfo, ExternalDeliveryPreferences,
        ExternalDeliveryProvider, ExternalDeliveryProviderInput, ExternalDeliveryRequest,
        ExternalParcelInput,
    },
    services::delivery_service::{
        CreateDeliveryParams, DeliveryRecipientInput, DeliveryService, LocationInput, NewDeliveryParcelInput,
    },
    state::AppState,
};

/// Routes publiques pour prestataires externes
pub fn delivery_external_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/external/delivery", post(create_external_delivery))
        .route("/api/external/track/:token", get(get_delivery_status_by_token))
        .with_state(state)
}

/// ✅ Phase 4 - Amélioration 8 : POST /api/external/delivery - Créer une livraison via API externe
async fn create_external_delivery(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ExternalDeliveryRequest>,
) -> AppResult<Json<Value>> {
    // ✅ 1. Valider API Key
    let provider = validate_api_key(&state, &payload.api_key).await?;

    // ✅ 2. Vérifier rate limit
    check_rate_limit(&state, &provider).await?;

    // ✅ 3. Convertir en format interne
    let parcel_type_id = find_parcel_type_by_name(&state, &payload.parcel.vehicle_type).await?;

    let internal_parcel = NewDeliveryParcelInput {
        type_id: Some(parcel_type_id),
        weight_kg: payload.parcel.weight_kg.and_then(|w| rust_decimal::Decimal::from_f64(w)),
        volume_cm3: None,
        declared_value: None,
        notes: payload.parcel.description.clone(),
        photos: json!([]),
        constraints: json!({}),
    };

    let internal_recipient = DeliveryRecipientInput {
        user_id: None,
        contact_name: Some(payload.client_info.name.clone()),
        contact_phone: Some(payload.client_info.phone.clone()),
        notes: Some(format!(
            "Commande externe via {} - Adresse: {}",
            payload.service_name, payload.client_info.address
        )),
        chat_thread_id: None,
        dropoff_override: Some(payload.dropoff.clone().into()),
        dropoff_address: Some(payload.client_info.address.clone()),
        country_code: None,
        allow_tracking: Some(true),
        allow_contact: Some(true),
        consent_granted: Some(true),
        preferred_language: None,
    };

    // Pour les livraisons externes, on utilise l'ID du provider comme référence
    // On va créer ou récupérer un utilisateur système pour les livraisons externes
    let system_user_id = get_or_create_external_system_user(&state, provider.id).await?;

    let mut metadata = payload.metadata.unwrap_or_else(|| json!({}));
    metadata["external_provider_id"] = json!(provider.id);
    metadata["external_provider_name"] = json!(provider.provider_name);
    metadata["service_name"] = json!(payload.service_name);
    metadata["source"] = json!("external_api");

    let internal_params = CreateDeliveryParams {
        creator_id: system_user_id,
        parcel: internal_parcel,
        pickup: payload.pickup.clone(),
        dropoff: payload.dropoff.clone(),
        recipient: Some(internal_recipient),
        distance_meters: None,
        estimated_duration_seconds: None,
        metadata,
        initial_event_payload: json!({
            "source": "external_api",
            "provider": provider.provider_name,
            "created_at": Utc::now().to_rfc3339(),
        }),
    };

    // ✅ 4. Créer livraison
    let service = delivery_service(&state);
    let summary = service.create_delivery_request(internal_params).await?;

    // ✅ 5. Sauvegarder préférences client si fournies
    if let Some(prefs) = payload.preferences {
        let preferred_delivery_date = prefs.preferred_delivery_date.clone();
        let preferred_delivery_time_start = prefs.preferred_delivery_time_start.clone();
        let preferred_delivery_time_end = prefs.preferred_delivery_time_end.clone();
        let urgency = prefs.urgency.clone();
        
        let prefs_input = ClientDeliveryPreferencesInput {
            delivery_id: Some(summary.id),
            preferred_delivery_date: preferred_delivery_date.clone(),
            preferred_delivery_time_start: preferred_delivery_time_start.clone(),
            preferred_delivery_time_end: preferred_delivery_time_end.clone(),
            preferred_delivery_window_hours: None,
            avoid_days: None,
            urgency_level: urgency.clone(),
            is_flexible: Some(true),
            flexibility_window_days: Some(3),
        };

        // Note: On ne peut pas utiliser l'endpoint normal car il nécessite un user authentifié
        // On va directement insérer dans la base
        sqlx::query!(
            r#"
            INSERT INTO client_delivery_preferences (
                user_id, delivery_id,
                preferred_delivery_date, preferred_delivery_time_start, preferred_delivery_time_end,
                preferred_delivery_window_hours, urgency_level,
                is_flexible, flexibility_window_days
            )
            VALUES (
                0, $1, $2, $3, $4, 2, $5, TRUE, 3
            )
            ON CONFLICT DO NOTHING
            "#,
            summary.id,
            preferred_delivery_date
                .as_ref()
                .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()),
            preferred_delivery_time_start
                .as_ref()
                .and_then(|t| chrono::NaiveTime::parse_from_str(t, "%H:%M").ok()),
            preferred_delivery_time_end
                .as_ref()
                .and_then(|t| chrono::NaiveTime::parse_from_str(t, "%H:%M").ok()),
            urgency.unwrap_or_else(|| "standard".to_string())
        )
        .execute(&state.pg)
        .await
        .ok(); // Ne pas faire échouer si les préférences échouent
    }

    // ✅ 6. Générer et stocker token de suivi public
    let tracking_token = generate_public_tracking_token(&summary.id);
    
    // Stocker le token dans la base
    sqlx::query!(
        r#"
        INSERT INTO public_tracking_tokens (delivery_id, tracking_token, provider_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (delivery_id, tracking_token) DO NOTHING
        "#,
        summary.id,
        tracking_token,
        provider.id
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur stockage token: {}", e)))?;

    // ✅ 7. Mettre à jour statistiques provider
    update_provider_stats(&state, provider.id).await?;

    // ✅ 8. Webhook optionnel (si configuré) - en arrière-plan
    if let Some(webhook_url) = provider.webhook_url {
        let webhook_url_clone = webhook_url.clone();
        let summary_clone = summary.clone();
        let token_clone = tracking_token.clone();
        tokio::spawn(async move {
            if let Err(e) = trigger_webhook(&webhook_url_clone, &summary_clone, &token_clone).await {
                log::error!("Erreur webhook pour provider {}: {:?}", provider.id, e);
            }
        });
    }

    Ok(Json(json!({
        "success": true,
        "delivery_id": summary.id,
        "tracking_url": format!("https://yukpo.com/track/{}", tracking_token),
        "tracking_token": tracking_token,
        "estimated_pickup_time": summary.metadata.get("estimated_pickup_time"),
        "estimated_delivery_time": summary.metadata.get("estimated_delivery_time"),
    })))
}

/// ✅ Phase 4 - Amélioration 8 : GET /api/external/track/:token - Suivi public d'une livraison
async fn get_delivery_status_by_token(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> AppResult<Json<Value>> {
    // Récupérer livraison depuis token public
    let delivery_id = get_delivery_id_from_token(&state, &token).await?;

    let service = delivery_service(&state);
    let summary = service.get_delivery_summary(delivery_id).await?;

    // Retourner infos publiques (pas de données sensibles)
    Ok(Json(json!({
        "delivery_id": summary.id,
        "status": summary.status,
        "estimated_pickup_time": summary.metadata.get("estimated_pickup_time"),
        "estimated_delivery_time": summary.metadata.get("estimated_delivery_time"),
        "courier_assigned": summary.courier_id.is_some(),
        "last_update": summary.delivered_at.or(Some(summary.requested_at)),
    })))
}

/// Valide une API key et retourne le provider
async fn validate_api_key(
    state: &Arc<AppState>,
    api_key: &str,
) -> AppResult<ExternalDeliveryProvider> {
    let provider = sqlx::query_as::<_, ExternalDeliveryProvider>(
        "SELECT * FROM external_delivery_providers WHERE api_key = $1 AND is_active = TRUE"
    )
    .bind(api_key)
    .fetch_optional(&state.pg)
    .await?;

    provider.ok_or_else(|| {
        AppError::Unauthorized("API key invalide ou inactive".into())
    })
}

/// Vérifie le rate limit pour un provider
async fn check_rate_limit(
    state: &Arc<AppState>,
    provider: &ExternalDeliveryProvider,
) -> AppResult<()> {
    // TODO: Implémenter vérification rate limit basée sur last_used_at et rate_limit_per_hour
    // Pour l'instant, on accepte toutes les requêtes
    Ok(())
}

/// Trouve l'ID d'un type de colis par son nom
async fn find_parcel_type_by_name(
    state: &Arc<AppState>,
    vehicle_type: &str,
) -> AppResult<i32> {
    let type_id = sqlx::query_scalar::<_, i32>(
        "SELECT id FROM parcel_types WHERE LOWER(name) = LOWER($1) LIMIT 1"
    )
    .bind(vehicle_type)
    .fetch_optional(&state.pg)
    .await?;

    type_id.ok_or_else(|| {
        AppError::BadRequest(format!("Type de véhicule '{}' non trouvé", vehicle_type))
    })
}

/// Génère un token public pour le suivi
fn generate_public_tracking_token(delivery_id: &Uuid) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(delivery_id.to_string().as_bytes());
    hasher.update(b"yukpo_tracking_secret_2025");
    let hash = hasher.finalize();
    format!("{:x}", hash)[..16].to_string() // 16 premiers caractères
}

/// Récupère l'ID d'une livraison depuis son token public
async fn get_delivery_id_from_token(
    state: &Arc<AppState>,
    token: &str,
) -> AppResult<Uuid> {
    let delivery_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT delivery_id FROM public_tracking_tokens WHERE tracking_token = $1"
    )
    .bind(token)
    .fetch_optional(&state.pg)
    .await?;

    delivery_id.ok_or_else(|| {
        AppError::NotFound("Token de suivi invalide".into())
    })
}

/// Met à jour les statistiques d'un provider
async fn update_provider_stats(
    state: &Arc<AppState>,
    provider_id: i32,
) -> AppResult<()> {
    sqlx::query!(
        r#"
        UPDATE external_delivery_providers
        SET
            last_used_at = NOW(),
            total_deliveries = total_deliveries + 1
        WHERE id = $1
        "#,
        provider_id
    )
    .execute(&state.pg)
    .await?;

    Ok(())
}

/// Déclenche un webhook pour notifier le provider externe
async fn trigger_webhook(
    webhook_url: &str,
    summary: &crate::models::delivery_model::DeliverySummary,
    tracking_token: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let payload = json!({
        "delivery_id": summary.id,
        "status": summary.status,
        "tracking_token": tracking_token,
        "tracking_url": format!("https://yukpo.com/track/{}", tracking_token),
        "estimated_pickup_time": summary.metadata.get("estimated_pickup_time"),
        "estimated_delivery_time": summary.metadata.get("estimated_delivery_time"),
    });

    let response = client
        .post(webhook_url)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("Webhook returned status {}", response.status()).into());
    }

    Ok(())
}

/// Récupère ou crée un utilisateur système pour les livraisons externes
async fn get_or_create_external_system_user(
    state: &Arc<AppState>,
    provider_id: i32,
) -> AppResult<i32> {
    // Chercher un utilisateur système existant pour ce provider
    let system_user = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT id FROM users
        WHERE email = $1 AND role = 'system'
        LIMIT 1
        "#,
    )
    .bind(format!("external_provider_{}@yukpo.system", provider_id))
    .fetch_optional(&state.pg)
    .await?;

    if let Some(user_id) = system_user {
        return Ok(user_id);
    }

    // Créer un utilisateur système si nécessaire
    // Note: On utilise un email système unique par provider
    let user_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO users (
            email, nom_complet, role, is_active, created_at
        )
        VALUES (
            $1, $2, 'system', TRUE, NOW()
        )
        ON CONFLICT (email) DO UPDATE SET is_active = TRUE
        RETURNING id
        "#,
    )
    .bind(format!("external_provider_{}@yukpo.system", provider_id))
    .bind(format!("External Provider {}", provider_id))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création utilisateur système: {}", e)))?;

    Ok(user_id)
}

/// Helper pour obtenir le service de livraison
fn delivery_service(state: &Arc<AppState>) -> Arc<DeliveryService> {
    state.delivery_service.clone()
}

