// ✅ Phase 4 - Amélioration 8 : Routes API publiques pour prestataires externes
// ✅ Phase 11 - Livraison hors-app : Formulaire partenaire + WhatsApp commande
use axum::{
    extract::{Path, Query, State},
    response::{Html, Json},
    routing::{delete, get, post},
    Router,
};
use chrono::Utc;
use rust_decimal::prelude::FromPrimitive;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    models::delivery_model::{
        ClientDeliveryPreferencesInput, ExternalDeliveryProvider, ExternalDeliveryRequest,
    },
    services::delivery_service::{
        CreateDeliveryParams, DeliveryRecipientInput, DeliveryService, LocationInput,
        NewDeliveryParcelInput,
    },
    state::AppState,
};

/// Routes publiques pour prestataires externes
pub fn delivery_external_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/external/delivery", post(create_external_delivery))
        .route(
            "/api/external/track/{token}",
            get(get_delivery_status_by_token),
        )
        // ✅ Phase 11: Formulaire HTML pour prestataires (accessible depuis navigateur téléphone)
        .route(
            "/api/delivery/partner-form",
            get(serve_partner_form).post(submit_partner_form),
        )
        // ✅ Phase 11: Webhook WhatsApp pour commande de livraison par message
        .route(
            "/api/delivery/whatsapp-order",
            post(whatsapp_delivery_webhook),
        )
        // ✅ Phase 11: Admin CRUD pour prestataires externes (API key management)
        .route(
            "/api/admin/external-providers",
            get(list_external_providers).post(create_external_provider),
        )
        .route(
            "/api/admin/external-providers/{id}",
            delete(delete_external_provider),
        )
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

        let _prefs_input = ClientDeliveryPreferencesInput {
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

        // ✅ FIX 2026-03-05: Stocker les préférences dans le metadata JSONB de la livraison
        // au lieu de client_delivery_preferences (qui nécessite un user_id FK valide)
        let urgency_level = urgency.unwrap_or_else(|| "standard".to_string());
        let prefs_json = serde_json::json!({
            "preferred_delivery_date": preferred_delivery_date,
            "preferred_delivery_time_start": preferred_delivery_time_start,
            "preferred_delivery_time_end": preferred_delivery_time_end,
            "urgency_level": urgency_level,
            "is_flexible": true,
            "flexibility_window_days": 3,
            "source": "external_api",
        });

        sqlx::query(
            r#"
            UPDATE deliveries
            SET metadata_aller = COALESCE(metadata_aller, '{}'::jsonb) || $2::jsonb
            WHERE id = $1
            "#,
        )
        .bind(summary.id)
        .bind(prefs_json)
        .execute(&state.pg)
        .await
        .ok(); // Ne pas faire échouer si les préférences échouent
    }

    // ✅ 6. Générer et stocker token de suivi public
    let tracking_token = generate_public_tracking_token(&summary.id);

    // Stocker le token dans la base
    sqlx::query(
        r#"
        INSERT INTO public_tracking_tokens (delivery_id, tracking_token, provider_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (delivery_id, tracking_token) DO NOTHING
        "#,
    )
    .bind(summary.id)
    .bind(&tracking_token)
    .bind(provider.id)
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
            if let Err(e) = trigger_webhook(&webhook_url_clone, &summary_clone, &token_clone).await
            {
                log::error!("Erreur webhook pour provider {}: {:?}", provider.id, e);
            }
        });
    }

    Ok(Json(json!({
        "success": true,
        "delivery_id": summary.id,
        "tracking_url": format!("https://yukpo-backend-376093909298.europe-west1.run.app/track/{}", tracking_token),
        "tracking_token": tracking_token,
        "estimated_pickup_time": summary.metadata.get("estimated_pickup_time"),
        "estimated_delivery_time": summary.metadata.get("estimated_delivery_time"),
    })))
}

/// ✅ Phase 4 - Amélioration 8 : GET /api/external/track/{token} - Suivi public d'une livraison
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
        "SELECT * FROM external_delivery_providers WHERE api_key = $1 AND is_active = TRUE",
    )
    .bind(api_key)
    .fetch_optional(&state.pg)
    .await?;

    provider.ok_or_else(|| AppError::Unauthorized("API key invalide ou inactive".into()))
}

/// Vérifie le rate limit pour un provider
async fn check_rate_limit(
    _state: &Arc<AppState>,
    _provider: &ExternalDeliveryProvider,
) -> AppResult<()> {
    // TODO: Implémenter vérification rate limit basée sur last_used_at et rate_limit_per_hour
    // Pour l'instant, on accepte toutes les requêtes
    Ok(())
}

/// Trouve l'ID d'un type de colis par son nom
async fn find_parcel_type_by_name(state: &Arc<AppState>, vehicle_type: &str) -> AppResult<i32> {
    let type_id = sqlx::query_scalar::<_, i32>(
        "SELECT id FROM parcel_types WHERE LOWER(name) = LOWER($1) LIMIT 1",
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
async fn get_delivery_id_from_token(state: &Arc<AppState>, token: &str) -> AppResult<Uuid> {
    let delivery_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT delivery_id FROM public_tracking_tokens WHERE tracking_token = $1",
    )
    .bind(token)
    .fetch_optional(&state.pg)
    .await?;

    delivery_id.ok_or_else(|| AppError::NotFound("Token de suivi invalide".into()))
}

/// Met à jour les statistiques d'un provider
async fn update_provider_stats(state: &Arc<AppState>, provider_id: i32) -> AppResult<()> {
    sqlx::query(
        r#"
        UPDATE external_delivery_providers
        SET
            last_used_at = NOW(),
            total_deliveries = total_deliveries + 1
        WHERE id = $1
        "#,
    )
    .bind(provider_id)
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
        "tracking_url": format!("https://yukpo-backend-376093909298.europe-west1.run.app/track/{}", tracking_token),
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

// ============================================================================
// ✅ Phase 11 : Formulaire partenaire HTML (accessible depuis navigateur téléphone)
// ============================================================================

#[derive(Debug, Deserialize)]
struct PartnerFormQuery {
    key: Option<String>,
}

/// GET /api/delivery/partner-form?key=xxx
/// Sert un formulaire HTML mobile-friendly pour que les prestataires commandent une livraison
async fn serve_partner_form(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PartnerFormQuery>,
) -> AppResult<Html<String>> {
    let api_key = params.key.unwrap_or_default();

    // Vérifier si la clé est valide (optionnel pour afficher le formulaire, requis pour soumettre)
    let provider_name = if !api_key.is_empty() {
        match validate_api_key(&state, &api_key).await {
            Ok(p) => p.provider_name,
            Err(_) => "Partenaire".to_string(),
        }
    } else {
        "Partenaire".to_string()
    };

    let html = format!(
        r#"<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Yukpo Livraison - {provider_name}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5; color: #1f2937; padding: 0;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 20px 16px; text-align: center;
        }}
        .header h1 {{ font-size: 20px; margin-bottom: 4px; }}
        .header p {{ font-size: 13px; opacity: 0.85; }}
        .form-container {{ padding: 16px; max-width: 500px; margin: 0 auto; }}
        .field {{ margin-bottom: 16px; }}
        .field label {{
            display: block; font-size: 13px; font-weight: 600;
            color: #374151; margin-bottom: 6px;
        }}
        .field input, .field select, .field textarea {{
            width: 100%; padding: 12px; border: 1.5px solid #d1d5db;
            border-radius: 10px; font-size: 16px; background: white;
            -webkit-appearance: none; appearance: none;
        }}
        .field input:focus, .field select:focus, .field textarea:focus {{
            border-color: #667eea; outline: none;
            box-shadow: 0 0 0 3px rgba(102,126,234,0.15);
        }}
        .field textarea {{ resize: vertical; min-height: 60px; }}
        .section-title {{
            font-size: 15px; font-weight: 700; color: #667eea;
            margin: 20px 0 12px 0; padding-bottom: 6px;
            border-bottom: 2px solid #e5e7eb;
        }}
        .submit-btn {{
            width: 100%; padding: 16px; border: none; border-radius: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; font-size: 17px; font-weight: 700;
            cursor: pointer; margin-top: 8px; transition: transform 0.2s;
        }}
        .submit-btn:active {{ transform: scale(0.98); }}
        .submit-btn:disabled {{ opacity: 0.6; }}
        .result {{
            margin-top: 16px; padding: 16px; border-radius: 12px;
            display: none; text-align: center;
        }}
        .result.success {{ background: #d1fae5; color: #065f46; display: block; }}
        .result.error {{ background: #fee2e2; color: #991b1b; display: block; }}
        .tracking-link {{
            display: block; margin-top: 12px; padding: 12px;
            background: #667eea; color: white; border-radius: 8px;
            text-decoration: none; font-weight: 600; text-align: center;
        }}
        .spinner {{ display: none; text-align: center; padding: 20px; }}
        .spinner.active {{ display: block; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🚚 Yukpo Livraison</h1>
        <p>{provider_name}</p>
    </div>

    <div class="form-container">
        <form id="deliveryForm" method="POST" action="/api/delivery/partner-form">
            <input type="hidden" name="api_key" value="{api_key}">

            <div class="section-title">📍 Point de retrait</div>
            <div class="field">
                <label>Adresse de retrait *</label>
                <input type="text" name="pickup_address" required placeholder="Ex: Marché Mokolo, Yaoundé">
            </div>

            <div class="section-title">📦 Destination</div>
            <div class="field">
                <label>Adresse de livraison *</label>
                <input type="text" name="dropoff_address" required placeholder="Ex: Carrefour Obili, Yaoundé">
            </div>

            <div class="section-title">👤 Client</div>
            <div class="field">
                <label>Nom du client *</label>
                <input type="text" name="client_name" required placeholder="Jean Dupont">
            </div>
            <div class="field">
                <label>Téléphone du client *</label>
                <input type="tel" name="client_phone" required placeholder="677123456">
            </div>

            <div class="section-title">📦 Colis</div>
            <div class="field">
                <label>Type de véhicule</label>
                <select name="vehicle_type">
                    <option value="moto">🏍️ Moto</option>
                    <option value="tricycle">🛺 Tricycle</option>
                    <option value="voiture">🚗 Voiture</option>
                    <option value="fourgonnette">🚐 Fourgonnette</option>
                </select>
            </div>
            <div class="field">
                <label>Description du colis</label>
                <textarea name="description" placeholder="Ex: Sac de 5kg, fragile"></textarea>
            </div>

            <div class="spinner" id="spinner">⏳ Envoi en cours...</div>
            <button type="submit" class="submit-btn" id="submitBtn">🚚 Commander la livraison</button>
        </form>

        <div id="result"></div>
    </div>

    <script>
        document.getElementById('deliveryForm').addEventListener('submit', async function(e) {{
            e.preventDefault();
            var btn = document.getElementById('submitBtn');
            var spinner = document.getElementById('spinner');
            var resultDiv = document.getElementById('result');
            btn.disabled = true;
            spinner.className = 'spinner active';
            resultDiv.style.display = 'none';

            var formData = new FormData(this);
            var data = {{}};
            formData.forEach(function(value, key) {{ data[key] = value; }});

            try {{
                var response = await fetch('/api/delivery/partner-form', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify(data)
                }});
                var result = await response.json();
                spinner.className = 'spinner';

                if (result.success) {{
                    resultDiv.innerHTML = '<div class="result success">'
                        + '<p style="font-size:18px;font-weight:700">✅ Livraison créée !</p>'
                        + '<p style="margin-top:8px">Le client recevra un SMS de suivi.</p>'
                        + '<a class="tracking-link" href="' + result.tracking_url + '" target="_blank">'
                        + '📍 Voir le suivi</a>'
                        + '<p style="margin-top:12px;font-size:13px;color:#6b7280">ID: ' + result.delivery_id + '</p>'
                        + '</div>';
                    document.getElementById('deliveryForm').reset();
                }} else {{
                    resultDiv.innerHTML = '<div class="result error">'
                        + '<p style="font-weight:700">❌ Erreur</p>'
                        + '<p>' + (result.error || 'Erreur inconnue') + '</p></div>';
                }}
            }} catch (err) {{
                spinner.className = 'spinner';
                resultDiv.innerHTML = '<div class="result error">'
                    + '<p style="font-weight:700">❌ Erreur réseau</p>'
                    + '<p>Vérifiez votre connexion et réessayez.</p></div>';
            }}
            btn.disabled = false;
        }});
    </script>
</body>
</html>"#,
        provider_name = html_escape(&provider_name),
        api_key = html_escape(&api_key),
    );

    Ok(Html(html))
}

/// Paramètres du formulaire partenaire (POST JSON)
#[derive(Debug, Deserialize)]
struct PartnerFormSubmission {
    api_key: String,
    pickup_address: String,
    dropoff_address: String,
    client_name: String,
    client_phone: String,
    vehicle_type: Option<String>,
    description: Option<String>,
}

/// POST /api/delivery/partner-form
/// Traite la soumission du formulaire partenaire et crée une livraison
async fn submit_partner_form(
    State(state): State<Arc<AppState>>,
    Json(form): Json<PartnerFormSubmission>,
) -> AppResult<Json<Value>> {
    log::info!(
        "[PartnerForm] 📝 Nouvelle commande via formulaire: pickup={}, dropoff={}, client={}",
        form.pickup_address,
        form.dropoff_address,
        form.client_name
    );

    // 1. Valider la clé API
    let provider = validate_api_key(&state, &form.api_key).await?;

    // 2. Géocoder les adresses (utiliser des coordonnées par défaut Douala si le geocoding n'est pas dispo)
    let pickup_coords = geocode_address_simple(&state, &form.pickup_address).await;
    let dropoff_coords = geocode_address_simple(&state, &form.dropoff_address).await;

    // 3. Trouver le type de colis
    let vehicle_type = form.vehicle_type.as_deref().unwrap_or("moto");
    let parcel_type_id = find_parcel_type_by_name(&state, vehicle_type).await.unwrap_or(1); // Fallback to ID 1 if type not found

    let internal_parcel = NewDeliveryParcelInput {
        type_id: Some(parcel_type_id),
        weight_kg: None,
        volume_cm3: None,
        declared_value: None,
        notes: form.description.clone(),
        photos: json!([]),
        constraints: json!({}),
    };

    let internal_recipient = DeliveryRecipientInput {
        user_id: None,
        contact_name: Some(form.client_name.clone()),
        contact_phone: Some(form.client_phone.clone()),
        notes: Some(format!(
            "Commande via formulaire partenaire {} - Livrer à: {}",
            provider.provider_name, form.dropoff_address
        )),
        chat_thread_id: None,
        dropoff_override: Some(LocationInput {
            latitude: dropoff_coords.0,
            longitude: dropoff_coords.1,
            address: Some(form.dropoff_address.clone()),
        }),
        dropoff_address: Some(form.dropoff_address.clone()),
        country_code: None,
        allow_tracking: Some(true),
        allow_contact: Some(true),
        consent_granted: Some(true),
        preferred_language: None,
    };

    let system_user_id = get_or_create_external_system_user(&state, provider.id).await?;

    let metadata = json!({
        "external_provider_id": provider.id,
        "external_provider_name": provider.provider_name,
        "source": "partner_form",
        "vehicle_type": vehicle_type,
        "pickup_address_raw": form.pickup_address,
        "dropoff_address_raw": form.dropoff_address,
    });

    let internal_params = CreateDeliveryParams {
        creator_id: system_user_id,
        parcel: internal_parcel,
        pickup: LocationInput {
            latitude: pickup_coords.0,
            longitude: pickup_coords.1,
            address: Some(form.pickup_address.clone()),
        },
        dropoff: LocationInput {
            latitude: dropoff_coords.0,
            longitude: dropoff_coords.1,
            address: Some(form.dropoff_address.clone()),
        },
        recipient: Some(internal_recipient),
        distance_meters: None,
        estimated_duration_seconds: None,
        metadata,
        initial_event_payload: json!({
            "source": "partner_form",
            "provider": provider.provider_name,
            "created_at": Utc::now().to_rfc3339(),
        }),
    };

    // 4. Créer la livraison
    let service = delivery_service(&state);
    let summary = service.create_delivery_request(internal_params).await?;

    // 5. Générer token de suivi
    let tracking_token = generate_public_tracking_token(&summary.id);
    sqlx::query(
        r#"INSERT INTO public_tracking_tokens (delivery_id, tracking_token, provider_id)
           VALUES ($1, $2, $3) ON CONFLICT (delivery_id, tracking_token) DO NOTHING"#,
    )
    .bind(summary.id)
    .bind(&tracking_token)
    .bind(provider.id)
    .execute(&state.pg)
    .await
    .ok();

    // 6. Mettre à jour stats provider
    let _ = update_provider_stats(&state, provider.id).await;

    let tracking_url = format!(
        "https://yukpo-backend-376093909298.europe-west1.run.app/track/{}",
        tracking_token
    );

    // 7. Envoyer SMS au client (si Twilio configuré)
    let sms_message = format!(
        "📦 Bonjour {}, votre livraison de {} est confirmée !\nSuivez-la ici : {}\n- Yukpo Livraison",
        form.client_name, provider.provider_name, tracking_url
    );
    tokio::spawn({
        let pool = state.pg.clone();
        let phone = form.client_phone.clone();
        async move {
            let _ = crate::services::delivery_notification_service::send_sms_notification(
                &pool,
                &phone,
                &sms_message,
                None,
            )
            .await;
        }
    });

    log::info!(
        "[PartnerForm] ✅ Livraison créée: id={}, tracking={}, provider={}",
        summary.id,
        tracking_token,
        provider.provider_name
    );

    Ok(Json(json!({
        "success": true,
        "delivery_id": summary.id,
        "tracking_url": tracking_url,
        "tracking_token": tracking_token,
        "message": format!("Livraison créée. SMS envoyé à {}.", form.client_phone),
    })))
}

// ============================================================================
// ✅ Phase 11 : Webhook WhatsApp pour commande de livraison par message
// ============================================================================

/// POST /api/delivery/whatsapp-order
/// Reçoit un webhook Twilio WhatsApp et parse les commandes de livraison
/// Format attendu:
///   LIVRAISON
///   De: [adresse pickup]
///   Vers: [adresse dropoff]
///   Client: [nom]
///   Tel: [numéro]
///   Colis: [description]
async fn whatsapp_delivery_webhook(
    State(state): State<Arc<AppState>>,
    axum::extract::Form(payload): axum::extract::Form<std::collections::HashMap<String, String>>,
) -> AppResult<axum::response::Response> {
    // Twilio envoie les webhooks en application/x-www-form-urlencoded
    let from = payload.get("From").map(|s| s.as_str()).unwrap_or("");
    let body = payload.get("Body").map(|s| s.as_str()).unwrap_or("");
    let message_sid = payload.get("MessageSid").map(|s| s.as_str()).unwrap_or("");

    log::info!(
        "[WhatsAppOrder] 📥 Message reçu de {}: {} (SID: {})",
        from,
        &body[..body.len().min(100)],
        message_sid
    );

    // Nettoyer le numéro d'envoi (whatsapp:+237677... → 237677...)
    let sender_phone = from.replace("whatsapp:", "").replace("+", "").trim().to_string();

    // Parser le message
    let body_upper = body.to_uppercase();

    let response_message = if body_upper.starts_with("LIVRAISON")
        || body_upper.starts_with("LIV ")
        || body_upper.starts_with("DELIVERY")
    {
        // Tenter de parser la commande
        match parse_delivery_command(body) {
            Ok(cmd) => {
                // Chercher le provider par numéro de téléphone
                let provider = find_provider_by_phone(&state, &sender_phone).await;

                match provider {
                    Some(provider) => {
                        // Créer la livraison
                        match create_delivery_from_whatsapp(&state, &provider, &cmd).await {
                            Ok((delivery_id, tracking_url)) => {
                                log::info!(
                                    "[WhatsAppOrder] ✅ Livraison créée via WhatsApp: {} par {}",
                                    delivery_id,
                                    provider.provider_name
                                );
                                format!(
                                    "✅ Livraison créée !\n\n\
                                    📦 De: {}\n\
                                    📍 Vers: {}\n\
                                    👤 Client: {} ({})\n\n\
                                    🔗 Suivi: {}\n\n\
                                    Le client recevra un SMS avec le lien de suivi.",
                                    cmd.pickup_address,
                                    cmd.dropoff_address,
                                    cmd.client_name,
                                    cmd.client_phone,
                                    tracking_url
                                )
                            }
                            Err(e) => {
                                log::error!("[WhatsAppOrder] ❌ Erreur création livraison: {}", e);
                                format!(
                                    "❌ Erreur lors de la création de la livraison.\n\
                                    Détail: {}\n\n\
                                    Réessayez ou contactez le support.",
                                    e
                                )
                            }
                        }
                    }
                    None => {
                        format!(
                            "⚠️ Votre numéro ({}) n'est pas enregistré comme partenaire Yukpo.\n\n\
                            Contactez-nous pour obtenir votre accès partenaire.\n\
                            📧 support@yukpomnang.com",
                            sender_phone
                        )
                    }
                }
            }
            Err(help_msg) => help_msg,
        }
    } else if body_upper.starts_with("SUIVI ")
        || body_upper.starts_with("TRACK ")
        || body_upper.starts_with("STATUS ")
    {
        // Commande de suivi
        let token = body.split_whitespace().nth(1).unwrap_or("").trim();
        if token.is_empty() {
            "📍 Pour suivre une livraison, envoyez:\nSUIVI [token]\n\nEx: SUIVI 8b4e2f1c"
                .to_string()
        } else {
            match get_delivery_id_from_token(&state, token).await {
                Ok(delivery_id) => {
                    let service = delivery_service(&state);
                    match service.get_delivery_summary(delivery_id).await {
                        Ok(summary) => {
                            use crate::models::delivery_model::DeliveryStatus;
                            let status_emoji = match summary.status {
                                DeliveryStatus::Accepted => "🟢",
                                DeliveryStatus::EnRoutePickup | DeliveryStatus::EnRouteDelivery => {
                                    "🚚"
                                }
                                DeliveryStatus::PickedUp => "📦",
                                DeliveryStatus::Delivered | DeliveryStatus::Completed => "✅",
                                DeliveryStatus::Cancelled => "❌",
                                _ => "🟡",
                            };
                            let status_text = match summary.status {
                                DeliveryStatus::Requested => "En attente",
                                DeliveryStatus::AwaitingCourierConfirmation => {
                                    "En attente de confirmation coursier"
                                }
                                DeliveryStatus::Accepted => "Acceptée",
                                DeliveryStatus::EnRoutePickup => "Coursier en route vers retrait",
                                DeliveryStatus::ArrivalPickup => {
                                    "Coursier arrivé au point de retrait"
                                }
                                DeliveryStatus::PickedUp => "Colis récupéré",
                                DeliveryStatus::EnRouteDelivery => "En cours de livraison",
                                DeliveryStatus::ArrivalDestination => "Arrivé à destination",
                                DeliveryStatus::Delivered => "Livrée",
                                DeliveryStatus::Completed => "Terminée",
                                DeliveryStatus::Cancelled => "Annulée",
                                _ => "En cours",
                            };
                            format!(
                                "{} Statut livraison #{}\n\n\
                                État: {}\n\
                                Coursier: {}\n\n\
                                🔗 Suivi détaillé:\nhttps://yukpo-backend-376093909298.europe-west1.run.app/track/{}",
                                status_emoji,
                                &delivery_id.to_string()[..8],
                                status_text,
                                if summary.courier_id.is_some() { "Assigné" } else { "En attente" },
                                token
                            )
                        }
                        Err(_) => "❌ Impossible de récupérer le statut. Réessayez.".to_string(),
                    }
                }
                Err(_) => format!("❌ Token de suivi '{}' non trouvé.", token),
            }
        }
    } else if body_upper == "AIDE" || body_upper == "HELP" || body_upper == "?" {
        "🚚 *Yukpo Livraison - WhatsApp*\n\n\
        📦 *Commander une livraison:*\n\
        Envoyez un message avec ce format:\n\n\
        LIVRAISON\n\
        De: Marché Mokolo, Yaoundé\n\
        Vers: Carrefour Obili, Yaoundé\n\
        Client: Jean Dupont\n\
        Tel: 677123456\n\
        Colis: Sac de riz 25kg\n\n\
        📍 *Suivre une livraison:*\n\
        SUIVI abc123\n\n\
        ❓ *Aide:*\n\
        AIDE"
            .to_string()
    } else {
        "👋 Bienvenue sur Yukpo Livraison !\n\n\
        Envoyez *AIDE* pour voir les commandes disponibles.\n\n\
        Pour commander une livraison, envoyez *LIVRAISON* suivi des détails."
            .to_string()
    };

    // Répondre via TwiML (Twilio Markup Language)
    let twiml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{}</Message>
</Response>"#,
        xml_escape(&response_message)
    );

    Ok(axum::response::Response::builder()
        .status(200)
        .header("Content-Type", "text/xml")
        .body(axum::body::Body::from(twiml))
        .unwrap_or_else(|_| {
            axum::response::Response::builder()
                .status(500)
                .body(axum::body::Body::empty())
                .unwrap()
        }))
}

/// Parse une commande de livraison depuis un message WhatsApp
struct DeliveryCommand {
    pickup_address: String,
    dropoff_address: String,
    client_name: String,
    client_phone: String,
    description: Option<String>,
}

fn parse_delivery_command(body: &str) -> Result<DeliveryCommand, String> {
    let mut pickup = String::new();
    let mut dropoff = String::new();
    let mut client_name = String::new();
    let mut client_phone = String::new();
    let mut description = None;

    for line in body.lines() {
        let line = line.trim();
        let line_lower = line.to_lowercase();

        if line_lower.starts_with("de:")
            || line_lower.starts_with("from:")
            || line_lower.starts_with("retrait:")
        {
            pickup = line.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
        } else if line_lower.starts_with("vers:")
            || line_lower.starts_with("to:")
            || line_lower.starts_with("destination:")
            || line_lower.starts_with("à:")
            || line_lower.starts_with("a:")
        {
            dropoff = line.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
        } else if line_lower.starts_with("client:")
            || line_lower.starts_with("nom:")
            || line_lower.starts_with("name:")
        {
            client_name = line.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
        } else if line_lower.starts_with("tel:")
            || line_lower.starts_with("phone:")
            || line_lower.starts_with("téléphone:")
            || line_lower.starts_with("telephone:")
        {
            client_phone = line.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
        } else if line_lower.starts_with("colis:")
            || line_lower.starts_with("description:")
            || line_lower.starts_with("parcel:")
        {
            description = Some(line.splitn(2, ':').nth(1).unwrap_or("").trim().to_string());
        }
    }

    // Validation
    if pickup.is_empty() || dropoff.is_empty() || client_name.is_empty() || client_phone.is_empty()
    {
        return Err(
            "⚠️ Format incomplet. Envoyez votre commande comme ceci:\n\n\
            LIVRAISON\n\
            De: [adresse de retrait]\n\
            Vers: [adresse de livraison]\n\
            Client: [nom du client]\n\
            Tel: [numéro du client]\n\
            Colis: [description optionnelle]\n\n\
            Exemple:\n\
            LIVRAISON\n\
            De: Marché Mokolo, Yaoundé\n\
            Vers: Carrefour Obili\n\
            Client: Jean\n\
            Tel: 677123456\n\
            Colis: 2 cartons"
                .to_string(),
        );
    }

    Ok(DeliveryCommand {
        pickup_address: pickup,
        dropoff_address: dropoff,
        client_name,
        client_phone,
        description,
    })
}

/// Cherche un provider par numéro de téléphone
async fn find_provider_by_phone(
    state: &Arc<AppState>,
    phone: &str,
) -> Option<ExternalDeliveryProvider> {
    // Chercher avec le numéro exact ou avec/sans préfixe pays
    let phone_variants = vec![
        phone.to_string(),
        format!("+{}", phone),
        if phone.len() > 3 {
            phone[3..].to_string()
        } else {
            phone.to_string()
        },
    ];

    for variant in &phone_variants {
        if let Ok(Some(provider)) = sqlx::query_as::<_, ExternalDeliveryProvider>(
            "SELECT * FROM external_delivery_providers WHERE contact_phone = $1 AND is_active = TRUE",
        )
        .bind(variant)
        .fetch_optional(&state.pg)
        .await
        {
            return Some(provider);
        }
    }
    None
}

/// Crée une livraison depuis une commande WhatsApp parsée
async fn create_delivery_from_whatsapp(
    state: &Arc<AppState>,
    provider: &ExternalDeliveryProvider,
    cmd: &DeliveryCommand,
) -> AppResult<(Uuid, String)> {
    let pickup_coords = geocode_address_simple(state, &cmd.pickup_address).await;
    let dropoff_coords = geocode_address_simple(state, &cmd.dropoff_address).await;

    // Trouver type de colis par défaut (moto)
    let parcel_type_id = find_parcel_type_by_name(state, "moto").await.unwrap_or(1);

    let internal_parcel = NewDeliveryParcelInput {
        type_id: Some(parcel_type_id),
        weight_kg: None,
        volume_cm3: None,
        declared_value: None,
        notes: cmd.description.clone(),
        photos: json!([]),
        constraints: json!({}),
    };

    let internal_recipient = DeliveryRecipientInput {
        user_id: None,
        contact_name: Some(cmd.client_name.clone()),
        contact_phone: Some(cmd.client_phone.clone()),
        notes: Some(format!(
            "Commande WhatsApp via {} - Livrer à: {}",
            provider.provider_name, cmd.dropoff_address
        )),
        chat_thread_id: None,
        dropoff_override: Some(LocationInput {
            latitude: dropoff_coords.0,
            longitude: dropoff_coords.1,
            address: Some(cmd.dropoff_address.clone()),
        }),
        dropoff_address: Some(cmd.dropoff_address.clone()),
        country_code: None,
        allow_tracking: Some(true),
        allow_contact: Some(true),
        consent_granted: Some(true),
        preferred_language: None,
    };

    let system_user_id = get_or_create_external_system_user(state, provider.id).await?;

    let metadata = json!({
        "external_provider_id": provider.id,
        "external_provider_name": provider.provider_name,
        "source": "whatsapp",
        "pickup_address_raw": cmd.pickup_address,
        "dropoff_address_raw": cmd.dropoff_address,
    });

    let params = CreateDeliveryParams {
        creator_id: system_user_id,
        parcel: internal_parcel,
        pickup: LocationInput {
            latitude: pickup_coords.0,
            longitude: pickup_coords.1,
            address: Some(cmd.pickup_address.clone()),
        },
        dropoff: LocationInput {
            latitude: dropoff_coords.0,
            longitude: dropoff_coords.1,
            address: Some(cmd.dropoff_address.clone()),
        },
        recipient: Some(internal_recipient),
        distance_meters: None,
        estimated_duration_seconds: None,
        metadata,
        initial_event_payload: json!({
            "source": "whatsapp",
            "provider": provider.provider_name,
            "created_at": Utc::now().to_rfc3339(),
        }),
    };

    let service = delivery_service(state);
    let summary = service.create_delivery_request(params).await?;

    // Générer et stocker le token de suivi
    let tracking_token = generate_public_tracking_token(&summary.id);
    sqlx::query(
        r#"INSERT INTO public_tracking_tokens (delivery_id, tracking_token, provider_id)
           VALUES ($1, $2, $3) ON CONFLICT (delivery_id, tracking_token) DO NOTHING"#,
    )
    .bind(summary.id)
    .bind(&tracking_token)
    .bind(provider.id)
    .execute(&state.pg)
    .await
    .ok();

    let _ = update_provider_stats(state, provider.id).await;

    let tracking_url = format!(
        "https://yukpo-backend-376093909298.europe-west1.run.app/track/{}",
        tracking_token
    );

    // Envoyer SMS au client
    let sms_msg = format!(
        "📦 Bonjour {}, votre livraison de {} est confirmée !\nSuivez-la ici : {}\n- Yukpo",
        cmd.client_name, provider.provider_name, tracking_url
    );
    let pool_clone = state.pg.clone();
    let phone_clone = cmd.client_phone.clone();
    tokio::spawn(async move {
        let _ = crate::services::delivery_notification_service::send_sms_notification(
            &pool_clone,
            &phone_clone,
            &sms_msg,
            None,
        )
        .await;
    });

    Ok((summary.id, tracking_url))
}

// ============================================================================
// Helpers communs
// ============================================================================

/// Géocode une adresse en utilisant le service de geocoding existant, avec fallback Douala
async fn geocode_address_simple(_state: &Arc<AppState>, address: &str) -> (f64, f64) {
    // Essayer le service de geocoding existant
    let geocoding_url = format!(
        "https://maps.googleapis.com/maps/api/geocode/json?address={}&key={}&region=cm&language=fr",
        urlencoding::encode(address),
        std::env::var("GOOGLE_MAPS_API_KEY").unwrap_or_default()
    );

    if let Ok(resp) = reqwest::get(&geocoding_url).await {
        if let Ok(json) = resp.json::<Value>().await {
            if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
                if let Some(first) = results.first() {
                    if let (Some(lat), Some(lng)) = (
                        first.pointer("/geometry/location/lat").and_then(|v| v.as_f64()),
                        first.pointer("/geometry/location/lng").and_then(|v| v.as_f64()),
                    ) {
                        log::info!("[Geocode] ✅ {} → ({}, {})", address, lat, lng);
                        return (lat, lng);
                    }
                }
            }
        }
    }

    // Fallback: coordonnées par défaut (centre de Douala)
    log::warn!(
        "[Geocode] ⚠️ Geocoding échoué pour '{}', utilisation coordonnées par défaut Douala",
        address
    );
    (4.0511, 9.7679)
}

/// Échappe les caractères spéciaux pour l'HTML
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// Échappe les caractères spéciaux pour le XML (TwiML)
fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

// ============================================================================
// ✅ Phase 11: Admin CRUD pour prestataires externes
// ============================================================================

/// GET /api/admin/external-providers — Liste tous les prestataires externes
async fn list_external_providers(State(state): State<Arc<AppState>>) -> AppResult<Json<Value>> {
    let providers = sqlx::query_as::<_, ExternalDeliveryProvider>(
        "SELECT * FROM external_delivery_providers ORDER BY created_at DESC",
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[AdminProviders] Erreur list: {}", e);
        AppError::Database(e.to_string())
    })?;

    Ok(Json(json!({
        "success": true,
        "providers": providers,
        "count": providers.len()
    })))
}

/// Input pour créer un prestataire externe depuis l'admin
#[derive(Debug, Deserialize)]
struct CreateExternalProviderInput {
    provider_name: String,
    contact_phone: Option<String>,
    contact_email: Option<String>,
}

/// POST /api/admin/external-providers — Crée un nouveau prestataire externe avec API key auto-générée
async fn create_external_provider(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateExternalProviderInput>,
) -> AppResult<Json<Value>> {
    if payload.provider_name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Le nom du prestataire est requis".into(),
        ));
    }

    // Générer API key et secret
    let api_key = format!("ykp_{}", Uuid::new_v4().to_string().replace("-", ""));
    let api_secret = format!("sec_{}", Uuid::new_v4().to_string().replace("-", ""));

    let provider = sqlx::query_as::<_, ExternalDeliveryProvider>(
        r#"INSERT INTO external_delivery_providers (provider_name, api_key, api_secret, contact_phone, contact_email, is_active)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           RETURNING *"#,
    )
    .bind(payload.provider_name.trim())
    .bind(&api_key)
    .bind(&api_secret)
    .bind(&payload.contact_phone)
    .bind(&payload.contact_email)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[AdminProviders] Erreur create: {}", e);
        AppError::Database(e.to_string())
    })?;

    let form_url =
        "https://yukpo-backend-376093909298.europe-west1.run.app/api/delivery/partner-form";

    log::info!(
        "[AdminProviders] ✅ Prestataire créé: {} (id={}, api_key={})",
        provider.provider_name,
        provider.id,
        &api_key[..12]
    );

    Ok(Json(json!({
        "success": true,
        "provider": provider,
        "form_url": form_url,
        "message": format!("Prestataire '{}' créé avec succès", provider.provider_name)
    })))
}

/// DELETE /api/admin/external-providers/:id — Supprime (désactive) un prestataire externe
async fn delete_external_provider(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> AppResult<Json<Value>> {
    let result =
        sqlx::query("UPDATE external_delivery_providers SET is_active = FALSE WHERE id = $1")
            .bind(id)
            .execute(&state.pg)
            .await
            .map_err(|e| {
                log::error!("[AdminProviders] Erreur delete: {}", e);
                AppError::Database(e.to_string())
            })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Prestataire non trouvé".into()));
    }

    log::info!("[AdminProviders] ✅ Prestataire {} désactivé", id);

    Ok(Json(json!({
        "success": true,
        "message": "Prestataire désactivé avec succès"
    })))
}
