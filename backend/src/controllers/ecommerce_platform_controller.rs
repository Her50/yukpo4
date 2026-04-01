//! ✅ 2026-04-01: Contrôleur E-Commerce Universel
//!
//! Permet à n'importe quel partenaire (supermarché, boutique mode, électronique, pharmacie, etc.)
//! de connecter sa plateforme e-commerce externe à Yukpo pour importer ses produits.
//!
//! Endpoints partenaire :
//! - GET  /api/ecommerce/platforms                      - Liste des types de plateformes supportées
//! - POST /api/ecommerce/integrations/test-connection   - Tester une connexion avant enregistrement
//! - POST /api/ecommerce/integrations                   - Créer une intégration
//! - GET  /api/ecommerce/integrations                   - Lister mes intégrations
//! - GET  /api/ecommerce/integrations/{id}              - Détail d'une intégration
//! - PUT  /api/ecommerce/integrations/{id}              - Modifier une intégration
//! - DELETE /api/ecommerce/integrations/{id}            - Supprimer une intégration
//! - POST /api/ecommerce/integrations/{id}/sync         - Déclencher sync manuelle
//! - GET  /api/ecommerce/integrations/{id}/logs         - Historique sync
//!
//! Endpoints client :
//! - GET  /api/ecommerce/stores                         - Lister les boutiques intégrées (avec filtre store_category)
//! - GET  /api/ecommerce/stores/{service_id}/products   - Produits d'une boutique intégrée
//! - GET  /api/ecommerce/products/search                - Recherche universelle produits (toutes boutiques)

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;

// ═══════════════════════════════════════════════════════════════
// TYPES DE REQUÊTES / RÉPONSES
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateIntegrationRequest {
    pub service_id: i32,
    pub platform_slug: String,
    pub api_url: String,
    pub auth_type: Option<String>,
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub bearer_token: Option<String>,
    pub basic_auth_user: Option<String>,
    pub basic_auth_pass: Option<String>,
    pub extra_headers: Option<HashMap<String, String>>,
    pub items_path: Option<String>,
    pub field_mapping: Option<HashMap<String, String>>,
    pub category_filter: Option<String>,
    pub sync_schedule: Option<String>, // 'manual' | 'hourly' | 'daily' | 'weekly'
    pub sync_hour: Option<i32>,
    pub sync_day_of_week: Option<i32>,
    pub store_name: Option<String>,
    pub store_logo_url: Option<String>,
    pub overwrite_on_sync: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIntegrationRequest {
    pub api_url: Option<String>,
    pub auth_type: Option<String>,
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub bearer_token: Option<String>,
    pub basic_auth_user: Option<String>,
    pub basic_auth_pass: Option<String>,
    pub extra_headers: Option<HashMap<String, String>>,
    pub items_path: Option<String>,
    pub field_mapping: Option<HashMap<String, String>>,
    pub category_filter: Option<String>,
    pub sync_schedule: Option<String>,
    pub sync_hour: Option<i32>,
    pub sync_day_of_week: Option<i32>,
    pub store_name: Option<String>,
    pub store_logo_url: Option<String>,
    pub overwrite_on_sync: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TestConnectionRequest {
    pub platform_slug: String,
    pub api_url: String,
    pub auth_type: Option<String>,
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub bearer_token: Option<String>,
    pub basic_auth_user: Option<String>,
    pub basic_auth_pass: Option<String>,
    pub extra_headers: Option<HashMap<String, String>>,
    pub items_path: Option<String>,
    pub field_mapping: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
pub struct SyncOptions {
    pub force_full: Option<bool>,  // Forcer un re-sync complet
    pub dry_run: Option<bool>,     // Tester sans insérer
    pub max_products: Option<i32>, // Limiter le nombre de produits
}

#[derive(Debug, Deserialize)]
pub struct StoresQuery {
    pub store_category: Option<String>, // Filtrer par catégorie de boutique
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub radius_km: Option<f64>,
    pub platform_slug: Option<String>,
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UniversalProductSearchQuery {
    pub query: String,
    pub store_category: Option<String>,
    pub platform_slug: Option<String>,
    pub min_price: Option<f64>,
    pub max_price: Option<f64>,
    pub on_promotion: Option<bool>,
    pub in_stock: Option<bool>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub radius_km: Option<f64>,
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct LogsQuery {
    pub limit: Option<i32>,
    pub page: Option<i32>,
}

// ═══════════════════════════════════════════════════════════════
// 1. LISTE DES PLATEFORMES SUPPORTÉES (public)
// ═══════════════════════════════════════════════════════════════

/// GET /api/ecommerce/platforms
/// Liste publique de tous les types de plateformes supportées par Yukpo
pub async fn list_platforms(State(state): State<Arc<AppState>>) -> AppResult<impl IntoResponse> {
    let rows = sqlx::query(
        r#"
        SELECT slug, name, store_category, logo_url, auth_type,
               default_products_endpoint, default_items_path, default_field_mapping,
               supports_webhook, supports_pagination, is_active
        FROM ecommerce_platforms
        WHERE is_active = true
        ORDER BY store_category, name
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur chargement plateformes: {}", e)))?;

    let platforms: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "slug": r.try_get::<String, _>("slug").unwrap_or_default(),
                "name": r.try_get::<String, _>("name").unwrap_or_default(),
                "store_category": r.try_get::<String, _>("store_category").unwrap_or_default(),
                "logo_url": r.try_get::<Option<String>, _>("logo_url").unwrap_or(None),
                "auth_type": r.try_get::<String, _>("auth_type").unwrap_or_default(),
                "default_products_endpoint": r.try_get::<Option<String>, _>("default_products_endpoint").unwrap_or(None),
                "default_items_path": r.try_get::<Option<String>, _>("default_items_path").unwrap_or(None),
                "default_field_mapping": r.try_get::<Value, _>("default_field_mapping").unwrap_or(json!({})),
                "supports_webhook": r.try_get::<bool, _>("supports_webhook").unwrap_or(false),
                "supports_pagination": r.try_get::<bool, _>("supports_pagination").unwrap_or(true),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "platforms": platforms,
            "total": platforms.len()
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 2. TESTER UNE CONNEXION AVANT ENREGISTREMENT
// ═══════════════════════════════════════════════════════════════

/// POST /api/ecommerce/integrations/test-connection
pub async fn test_connection(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<TestConnectionRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ecommerce/test-connection] platform={}, url={}",
        payload.platform_slug, payload.api_url
    );

    // Récupérer les defaults de la plateforme
    let platform_defaults = sqlx::query(
        "SELECT default_items_path, default_field_mapping, default_products_endpoint FROM ecommerce_platforms WHERE slug = $1"
    )
    .bind(&payload.platform_slug)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let items_path = payload
        .items_path
        .clone()
        .or_else(|| {
            platform_defaults
                .as_ref()
                .and_then(|r| r.try_get::<Option<String>, _>("default_items_path").ok().flatten())
        })
        .unwrap_or_else(|| "items".to_string());

    // Construire l'URL complète
    let full_url = if payload.api_url.starts_with("http") {
        payload.api_url.clone()
    } else {
        format!("https://{}", payload.api_url.trim_start_matches('/'))
    };

    let mut req = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Internal(format!("Erreur client HTTP: {}", e)))?
        .get(&full_url);

    req = apply_auth(
        req,
        &payload.auth_type,
        &payload.api_key,
        &payload.api_secret,
        &payload.bearer_token,
        &payload.basic_auth_user,
        &payload.basic_auth_pass,
    );

    if let Some(headers) = &payload.extra_headers {
        for (k, v) in headers {
            req = req.header(k.as_str(), v.as_str());
        }
    }

    let result = req.send().await;

    match result {
        Ok(resp) => {
            let status_code = resp.status().as_u16();
            if !resp.status().is_success() {
                return Ok((
                    StatusCode::OK,
                    Json(json!({
                        "success": false,
                        "reachable": true,
                        "http_status": status_code,
                        "error": format!("L'API a répondu avec le code {}", status_code)
                    })),
                ));
            }

            let body: Value = resp.json().await.unwrap_or(json!({}));

            // Vérifier qu'on peut extraire des produits
            let items = extract_json_path(&body, &items_path);
            let product_count = items.and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);

            // Détecter les champs disponibles sur le premier produit
            let sample_fields: Vec<String> = items
                .and_then(|v| v.as_array())
                .and_then(|a| a.first())
                .and_then(|p| p.as_object())
                .map(|obj| obj.keys().cloned().collect())
                .unwrap_or_default();

            Ok((
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "reachable": true,
                    "http_status": status_code,
                    "products_found": product_count,
                    "sample_fields": sample_fields,
                    "message": format!("Connexion réussie. {} produit(s) détecté(s) au premier appel.", product_count)
                })),
            ))
        }
        Err(e) => Ok((
            StatusCode::OK,
            Json(json!({
                "success": false,
                "reachable": false,
                "error": format!("Impossible de joindre l'API: {}", e)
            })),
        )),
    }
}

// ═══════════════════════════════════════════════════════════════
// 3. CRÉER UNE INTÉGRATION (partenaire)
// ═══════════════════════════════════════════════════════════════

/// POST /api/ecommerce/integrations
pub async fn create_integration(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateIntegrationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ecommerce/create-integration] user_id={}, service_id={}, platform={}",
        user.id, payload.service_id, payload.platform_slug
    );

    // Vérifier propriété du service
    let is_owner: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM services WHERE id = $1 AND user_id = $2)")
            .bind(payload.service_id)
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification: {}", e)))?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de ce service".to_string(),
        ));
    }

    // Vérifier que la plateforme existe
    let platform_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM ecommerce_platforms WHERE slug = $1 AND is_active = true)",
    )
    .bind(&payload.platform_slug)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    if !platform_exists {
        return Err(AppError::BadRequest(format!(
            "Plateforme '{}' non supportée",
            payload.platform_slug
        )));
    }

    let auth_type = payload.auth_type.as_deref().unwrap_or("api_key");
    let sync_schedule = payload.sync_schedule.as_deref().unwrap_or("manual");
    let field_mapping = payload
        .field_mapping
        .as_ref()
        .map(|m| serde_json::to_value(m).unwrap_or(json!({})))
        .unwrap_or(json!({}));
    let extra_headers = payload
        .extra_headers
        .as_ref()
        .map(|h| serde_json::to_value(h).unwrap_or(json!({})))
        .unwrap_or(json!({}));

    // Générer webhook_url + secret
    let webhook_secret = generate_webhook_secret();
    let webhook_url = format!("/api/ecommerce/webhooks/{}", generate_webhook_secret());

    let row = sqlx::query(
        r#"
        INSERT INTO partner_platform_integrations
            (service_id, platform_slug, api_url, auth_type, api_key, api_secret,
             bearer_token, basic_auth_user, basic_auth_pass, extra_headers,
             items_path, field_mapping, category_filter, sync_schedule, sync_hour,
             sync_day_of_week, store_name, store_logo_url, overwrite_on_sync,
             webhook_url, webhook_secret, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'active')
        RETURNING id, created_at
        "#,
    )
    .bind(payload.service_id)
    .bind(&payload.platform_slug)
    .bind(payload.api_url.trim())
    .bind(auth_type)
    .bind(&payload.api_key)
    .bind(&payload.api_secret)
    .bind(&payload.bearer_token)
    .bind(&payload.basic_auth_user)
    .bind(&payload.basic_auth_pass)
    .bind(&extra_headers)
    .bind(&payload.items_path)
    .bind(&field_mapping)
    .bind(&payload.category_filter)
    .bind(sync_schedule)
    .bind(payload.sync_hour.unwrap_or(3))
    .bind(payload.sync_day_of_week.unwrap_or(1))
    .bind(&payload.store_name)
    .bind(&payload.store_logo_url)
    .bind(payload.overwrite_on_sync.unwrap_or(true))
    .bind(&webhook_url)
    .bind(&webhook_secret)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") || e.to_string().contains("duplicate") {
            AppError::BadRequest(
                "Une intégration avec cette URL existe déjà pour ce service".to_string(),
            )
        } else {
            AppError::Internal(format!("Erreur création intégration: {}", e))
        }
    })?;

    let integration_id: i32 = row.get("id");

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "integration_id": integration_id,
            "webhook_url": webhook_url,
            "webhook_secret": webhook_secret,
            "message": "Intégration créée. Lancez une synchronisation pour importer vos produits."
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 4. LISTER MES INTÉGRATIONS (partenaire)
// ═══════════════════════════════════════════════════════════════

/// GET /api/ecommerce/integrations
pub async fn list_my_integrations(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let rows = sqlx::query(
        r#"
        SELECT i.id, i.service_id, i.platform_slug, i.api_url, i.auth_type,
               i.items_path, i.field_mapping, i.category_filter,
               i.sync_schedule, i.sync_hour, i.sync_day_of_week,
               i.status, i.last_sync_at, i.last_sync_status,
               i.last_sync_products_count, i.last_sync_error,
               i.store_name, i.store_logo_url, i.overwrite_on_sync,
               i.webhook_url, i.created_at, i.updated_at,
               p.name as platform_name, p.store_category, p.logo_url as platform_logo,
               p.supports_webhook
        FROM partner_platform_integrations i
        INNER JOIN services s ON s.id = i.service_id AND s.user_id = $1
        LEFT JOIN ecommerce_platforms p ON p.slug = i.platform_slug
        ORDER BY i.created_at DESC
        "#,
    )
    .bind(user.id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let integrations: Vec<Value> = rows.iter().map(|r| {
        json!({
            "id": r.try_get::<i32, _>("id").unwrap_or_default(),
            "service_id": r.try_get::<i32, _>("service_id").unwrap_or_default(),
            "platform_slug": r.try_get::<String, _>("platform_slug").unwrap_or_default(),
            "platform_name": r.try_get::<Option<String>, _>("platform_name").unwrap_or(None),
            "platform_logo": r.try_get::<Option<String>, _>("platform_logo").unwrap_or(None),
            "store_category": r.try_get::<Option<String>, _>("store_category").unwrap_or(None),
            "api_url": r.try_get::<String, _>("api_url").unwrap_or_default(),
            "auth_type": r.try_get::<String, _>("auth_type").unwrap_or_default(),
            "store_name": r.try_get::<Option<String>, _>("store_name").unwrap_or(None),
            "store_logo_url": r.try_get::<Option<String>, _>("store_logo_url").unwrap_or(None),
            "sync_schedule": r.try_get::<String, _>("sync_schedule").unwrap_or_else(|_| "manual".to_string()),
            "sync_hour": r.try_get::<i32, _>("sync_hour").unwrap_or(3),
            "status": r.try_get::<String, _>("status").unwrap_or_default(),
            "last_sync_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_sync_at").unwrap_or(None),
            "last_sync_status": r.try_get::<Option<String>, _>("last_sync_status").unwrap_or(None),
            "last_sync_products_count": r.try_get::<i32, _>("last_sync_products_count").unwrap_or(0),
            "last_sync_error": r.try_get::<Option<String>, _>("last_sync_error").unwrap_or(None),
            "webhook_url": r.try_get::<Option<String>, _>("webhook_url").unwrap_or(None),
            "supports_webhook": r.try_get::<Option<bool>, _>("supports_webhook").unwrap_or(Some(false)),
            "overwrite_on_sync": r.try_get::<bool, _>("overwrite_on_sync").unwrap_or(true),
            "created_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok(),
        })
    }).collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "integrations": integrations,
            "total": integrations.len()
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 5. SUPPRIMER UNE INTÉGRATION
// ═══════════════════════════════════════════════════════════════

/// DELETE /api/ecommerce/integrations/{id}
pub async fn delete_integration(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(integration_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let deleted: bool = sqlx::query_scalar(
        r#"
        DELETE FROM partner_platform_integrations i
        USING services s
        WHERE i.id = $1 AND i.service_id = s.id AND s.user_id = $2
        RETURNING true
        "#,
    )
    .bind(integration_id)
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur suppression: {}", e)))?
    .unwrap_or(false);

    if !deleted {
        return Err(AppError::NotFound(
            "Intégration introuvable ou accès non autorisé".to_string(),
        ));
    }

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "message": "Intégration supprimée" })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 6. SYNCHRONISATION MANUELLE
// ═══════════════════════════════════════════════════════════════

/// POST /api/ecommerce/integrations/{id}/sync
pub async fn sync_integration(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(integration_id): Path<i32>,
    Json(opts): Json<SyncOptions>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ecommerce/sync] integration_id={}, user_id={}",
        integration_id, user.id
    );

    // Charger l'intégration en vérifiant la propriété
    let integration = sqlx::query(
        r#"
        SELECT i.id, i.service_id, i.platform_slug, i.api_url, i.auth_type,
               i.api_key, i.api_secret, i.bearer_token, i.basic_auth_user, i.basic_auth_pass,
               i.extra_headers, i.items_path, i.field_mapping, i.overwrite_on_sync,
               i.category_filter, i.status,
               p.default_items_path, p.default_field_mapping
        FROM partner_platform_integrations i
        INNER JOIN services s ON s.id = i.service_id AND s.user_id = $1
        LEFT JOIN ecommerce_platforms p ON p.slug = i.platform_slug
        WHERE i.id = $2
        "#,
    )
    .bind(user.id)
    .bind(integration_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Intégration introuvable".to_string()))?;

    if integration.try_get::<String, _>("status").unwrap_or_default() == "paused" {
        return Err(AppError::BadRequest(
            "Cette intégration est en pause".to_string(),
        ));
    }

    let service_id: i32 = integration.get("service_id");
    let api_url: String = integration.get("api_url");
    let auth_type: String =
        integration.try_get("auth_type").unwrap_or_else(|_| "api_key".to_string());
    let api_key: Option<String> = integration.try_get("api_key").ok().flatten();
    let api_secret: Option<String> = integration.try_get("api_secret").ok().flatten();
    let bearer_token: Option<String> = integration.try_get("bearer_token").ok().flatten();
    let basic_user: Option<String> = integration.try_get("basic_auth_user").ok().flatten();
    let basic_pass: Option<String> = integration.try_get("basic_auth_pass").ok().flatten();
    let extra_headers: Value = integration.try_get("extra_headers").unwrap_or(json!({}));
    let overwrite: bool = integration.try_get("overwrite_on_sync").unwrap_or(true);

    // items_path : priorité intégration > default plateforme > "items"
    let items_path: String = integration
        .try_get::<Option<String>, _>("items_path")
        .ok()
        .flatten()
        .or_else(|| integration.try_get::<Option<String>, _>("default_items_path").ok().flatten())
        .unwrap_or_else(|| "items".to_string());

    // field_mapping : fusionner default plateforme + override intégration
    let default_mapping: Value = integration.try_get("default_field_mapping").unwrap_or(json!({}));
    let override_mapping: Value = integration.try_get("field_mapping").unwrap_or(json!({}));
    let field_mapping = merge_field_mappings(&default_mapping, &override_mapping);

    // Créer le log de sync
    let log_id: i64 = sqlx::query_scalar(
        "INSERT INTO platform_sync_logs (integration_id, service_id, trigger_type, status) VALUES ($1, $2, 'manual', 'running') RETURNING id"
    )
    .bind(integration_id)
    .bind(service_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur log: {}", e)))?;

    let max_products = opts.max_products.unwrap_or(2000).min(5000);
    let dry_run = opts.dry_run.unwrap_or(false);

    // Exécuter la sync
    let sync_result = execute_sync(
        &state,
        integration_id,
        service_id,
        &api_url,
        &auth_type,
        &api_key,
        &api_secret,
        &bearer_token,
        &basic_user,
        &basic_pass,
        &extra_headers,
        &items_path,
        &field_mapping,
        overwrite,
        max_products,
        dry_run,
    )
    .await;

    // Mettre à jour le log et l'intégration
    match &sync_result {
        Ok(stats) => {
            let _ = sqlx::query(
                r#"UPDATE platform_sync_logs SET status='success', finished_at=NOW(),
                   products_fetched=$1, products_created=$2, products_updated=$3,
                   products_errors=$4, duration_ms=$5
                   WHERE id=$6"#,
            )
            .bind(stats.fetched)
            .bind(stats.created)
            .bind(stats.updated)
            .bind(stats.errors)
            .bind(stats.duration_ms)
            .bind(log_id)
            .execute(&state.pg)
            .await;

            let _ = sqlx::query(
                r#"UPDATE partner_platform_integrations
                   SET last_sync_at=NOW(), last_sync_status='success',
                   last_sync_products_count=$1, last_sync_error=NULL, status='active'
                   WHERE id=$2"#,
            )
            .bind(stats.created + stats.updated)
            .bind(integration_id)
            .execute(&state.pg)
            .await;

            Ok((
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "log_id": log_id,
                    "products_fetched": stats.fetched,
                    "products_created": stats.created,
                    "products_updated": stats.updated,
                    "products_errors": stats.errors,
                    "duration_ms": stats.duration_ms,
                    "dry_run": dry_run,
                    "message": format!("{} produits importés ({} créés, {} mis à jour)", stats.created + stats.updated, stats.created, stats.updated)
                })),
            ))
        }
        Err(e) => {
            let err_msg = e.to_string();
            let _ = sqlx::query(
                "UPDATE platform_sync_logs SET status='error', finished_at=NOW(), error_details=$1 WHERE id=$2"
            )
            .bind(json!([{ "error": &err_msg }]))
            .bind(log_id)
            .execute(&state.pg).await;

            let _ = sqlx::query(
                "UPDATE partner_platform_integrations SET last_sync_at=NOW(), last_sync_status='error', last_sync_error=$1, status='error' WHERE id=$2"
            )
            .bind(&err_msg)
            .bind(integration_id)
            .execute(&state.pg).await;

            Err(AppError::Internal(format!("Erreur sync: {}", err_msg)))
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 7. HISTORIQUE DES SYNCS
// ═══════════════════════════════════════════════════════════════

/// GET /api/ecommerce/integrations/{id}/logs
pub async fn get_sync_logs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(integration_id): Path<i32>,
    Query(query): Query<LogsQuery>,
) -> AppResult<impl IntoResponse> {
    let limit = query.limit.unwrap_or(20).min(100) as i64;
    let offset = ((query.page.unwrap_or(1) - 1) * query.limit.unwrap_or(20)) as i64;

    // Vérifier accès
    let has_access: bool = sqlx::query_scalar(
        r#"SELECT EXISTS (
            SELECT 1 FROM partner_platform_integrations i
            INNER JOIN services s ON s.id = i.service_id AND s.user_id = $1
            WHERE i.id = $2
        )"#,
    )
    .bind(user.id)
    .bind(integration_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    if !has_access {
        return Err(AppError::Forbidden("Accès refusé".to_string()));
    }

    let rows = sqlx::query(
        r#"
        SELECT id, started_at, finished_at, trigger_type, status,
               products_fetched, products_created, products_updated,
               products_skipped, products_errors, duration_ms, error_details
        FROM platform_sync_logs
        WHERE integration_id = $1
        ORDER BY started_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(integration_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur logs: {}", e)))?;

    let logs: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<i64, _>("id").unwrap_or_default(),
        "started_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("started_at").unwrap_or(None),
        "finished_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("finished_at").unwrap_or(None),
        "trigger_type": r.try_get::<String, _>("trigger_type").unwrap_or_default(),
        "status": r.try_get::<String, _>("status").unwrap_or_default(),
        "products_fetched": r.try_get::<i32, _>("products_fetched").unwrap_or(0),
        "products_created": r.try_get::<i32, _>("products_created").unwrap_or(0),
        "products_updated": r.try_get::<i32, _>("products_updated").unwrap_or(0),
        "products_errors": r.try_get::<i32, _>("products_errors").unwrap_or(0),
        "duration_ms": r.try_get::<Option<i32>, _>("duration_ms").unwrap_or(None),
        "error_details": r.try_get::<Value, _>("error_details").unwrap_or(json!([])),
    })).collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "logs": logs, "total": logs.len() })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 8. RECHERCHE UNIVERSELLE DE PRODUITS (tous types de boutiques)
// ═══════════════════════════════════════════════════════════════

/// GET /api/ecommerce/products/search
/// Recherche dans tous les produits importés, quelle que soit la plateforme source
pub async fn universal_product_search(
    State(state): State<Arc<AppState>>,
    Query(query): Query<UniversalProductSearchQuery>,
) -> AppResult<impl IntoResponse> {
    let q = query.query.trim().to_string();
    if q.is_empty() {
        return Err(AppError::BadRequest("Paramètre 'query' requis".to_string()));
    }

    let limit = query.limit.unwrap_or(50).min(200) as i64;
    let offset = ((query.page.unwrap_or(1) - 1) * query.limit.unwrap_or(50)) as i64;

    // Construction dynamique de la clause WHERE
    let mut conditions = vec![
        "sp.is_active = true".to_string(),
        "(sp.product_name ILIKE $1 OR sp.product_data->>'description' ILIKE $1 OR sp.product_data->>'marque' ILIKE $1)".to_string(),
    ];
    let search_param = format!("%{}%", q);

    if query.on_promotion == Some(true) {
        conditions.push("(sp.product_data->>'en_promotion')::boolean = true".to_string());
    }
    if query.in_stock == Some(true) {
        conditions.push("COALESCE((sp.product_data->>'stock')::int, 1) > 0".to_string());
    }
    if let Some(ref cat) = query.store_category {
        conditions.push(format!("sp.store_category = '{}'", cat.replace('\'', "''")));
    }
    if let Some(min_p) = query.min_price {
        conditions.push(format!("sp.product_price >= {}", min_p));
    }
    if let Some(max_p) = query.max_price {
        conditions.push(format!("sp.product_price <= {}", max_p));
    }

    let where_clause = conditions.join(" AND ");

    let rows = sqlx::query(&format!(
        r#"
        SELECT sp.id, sp.service_id, sp.product_index, sp.product_name,
               sp.product_price, sp.product_data, sp.store_category,
               sp.external_product_id, sp.platform_integration_id,
               s.data->>'nom' as service_name, s.data->>'gps' as service_gps,
               i.platform_slug, i.store_name,
               p.name as platform_name, p.store_category as platform_category
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id AND s.is_active = true
        LEFT JOIN partner_platform_integrations i ON i.id = sp.platform_integration_id
        LEFT JOIN ecommerce_platforms p ON p.slug = i.platform_slug
        WHERE {where_clause}
        ORDER BY sp.product_price ASC NULLS LAST
        LIMIT $2 OFFSET $3
        "#
    ))
    .bind(&search_param)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[ecommerce/search] Erreur SQL: {}", e);
        AppError::Internal(format!("Erreur recherche: {}", e))
    })?;

    let products: Vec<Value> = rows.iter().map(|r| {
        let data: Value = r.try_get("product_data").unwrap_or(json!({}));
        let prix: Option<f64> = r.try_get::<Option<rust_decimal::Decimal>, _>("product_price")
            .ok().flatten()
            .and_then(|d| d.to_string().parse::<f64>().ok());

        json!({
            "id": r.try_get::<i32, _>("id").unwrap_or_default(),
            "service_id": r.try_get::<i32, _>("service_id").unwrap_or_default(),
            "product_index": r.try_get::<i32, _>("product_index").unwrap_or_default(),
            "name": r.try_get::<Option<String>, _>("product_name").unwrap_or(None).unwrap_or_else(|| "Produit".to_string()),
            "price": prix,
            "currency": data.get("devise").and_then(|v| v.as_str()).unwrap_or("XAF"),
            "description": data.get("description").and_then(|v| v.as_str()),
            "category": data.get("categorie").or_else(|| data.get("category")).and_then(|v| v.as_str()),
            "brand": data.get("marque").and_then(|v| v.as_str()),
            "unit": data.get("unite").and_then(|v| v.as_str()),
            "stock": data.get("stock").and_then(|v| v.as_i64()),
            "is_promotion": data.get("en_promotion").and_then(|v| v.as_bool()).unwrap_or(false),
            "original_price": data.get("prix_original").and_then(|v| v.as_f64()),
            "images": data.get("images").cloned().unwrap_or(json!([])),
            "store_category": r.try_get::<Option<String>, _>("store_category").unwrap_or(None),
            "store_name": r.try_get::<Option<String>, _>("store_name").unwrap_or(None)
                .or_else(|| r.try_get::<Option<String>, _>("service_name").unwrap_or(None)),
            "platform_slug": r.try_get::<Option<String>, _>("platform_slug").unwrap_or(None),
            "platform_name": r.try_get::<Option<String>, _>("platform_name").unwrap_or(None),
            "external_product_id": r.try_get::<Option<String>, _>("external_product_id").unwrap_or(None),
        })
    }).collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "query": q,
            "products": products,
            "total": products.len()
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 9. LISTE DES BOUTIQUES INTÉGRÉES (client)
// ═══════════════════════════════════════════════════════════════

/// GET /api/ecommerce/stores
pub async fn list_stores(
    State(state): State<Arc<AppState>>,
    Query(query): Query<StoresQuery>,
) -> AppResult<impl IntoResponse> {
    let limit = query.limit.unwrap_or(50).min(200) as i64;

    let store_category_filter = query
        .store_category
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| format!("AND ep.store_category = '{}'", s.replace('\'', "''")))
        .unwrap_or_default();

    let rows = sqlx::query(&format!(
        r#"
        SELECT DISTINCT ON (s.id)
            s.id as service_id,
            COALESCE(i.store_name, s.data->>'nom', s.data->>'name') as name,
            COALESCE(i.store_logo_url, s.data->>'logo_url') as logo_url,
            s.data->>'adresse' as address,
            s.data->>'gps' as gps,
            i.platform_slug,
            ep.name as platform_name,
            ep.store_category,
            ep.logo_url as platform_logo,
            i.last_sync_at,
            i.last_sync_products_count,
            i.status as integration_status
        FROM partner_platform_integrations i
        INNER JOIN services s ON s.id = i.service_id AND s.is_active = true
        INNER JOIN ecommerce_platforms ep ON ep.slug = i.platform_slug
        WHERE i.status = 'active'
        {store_category_filter}
        ORDER BY s.id, i.last_sync_at DESC NULLS LAST
        LIMIT $1
        "#
    ))
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let stores: Vec<Value> = rows.iter().map(|r| json!({
        "service_id": r.try_get::<i32, _>("service_id").unwrap_or_default(),
        "name": r.try_get::<Option<String>, _>("name").unwrap_or(None),
        "logo_url": r.try_get::<Option<String>, _>("logo_url").unwrap_or(None),
        "address": r.try_get::<Option<String>, _>("address").unwrap_or(None),
        "gps": r.try_get::<Option<String>, _>("gps").unwrap_or(None),
        "platform_slug": r.try_get::<Option<String>, _>("platform_slug").unwrap_or(None),
        "platform_name": r.try_get::<Option<String>, _>("platform_name").unwrap_or(None),
        "platform_logo": r.try_get::<Option<String>, _>("platform_logo").unwrap_or(None),
        "store_category": r.try_get::<Option<String>, _>("store_category").unwrap_or(None),
        "last_sync_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_sync_at").unwrap_or(None),
        "products_count": r.try_get::<i32, _>("last_sync_products_count").unwrap_or(0),
    })).collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "stores": stores, "total": stores.len() })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES INTERNES
// ═══════════════════════════════════════════════════════════════

struct SyncStats {
    fetched: i32,
    created: i32,
    updated: i32,
    errors: i32,
    duration_ms: i32,
}

#[allow(clippy::too_many_arguments)]
async fn execute_sync(
    state: &Arc<AppState>,
    integration_id: i32,
    service_id: i32,
    api_url: &str,
    auth_type: &str,
    api_key: &Option<String>,
    api_secret: &Option<String>,
    bearer_token: &Option<String>,
    basic_user: &Option<String>,
    basic_pass: &Option<String>,
    extra_headers: &Value,
    items_path: &str,
    field_mapping: &Value,
    overwrite: bool,
    max_products: i32,
    dry_run: bool,
) -> Result<SyncStats, Box<dyn std::error::Error + Send + Sync>> {
    let start = std::time::Instant::now();

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build()?;

    let mut req = client.get(api_url);
    req = apply_auth(
        req,
        &Some(auth_type.to_string()),
        api_key,
        api_secret,
        bearer_token,
        basic_user,
        basic_pass,
    );

    if let Some(headers) = extra_headers.as_object() {
        for (k, v) in headers {
            if let Some(val) = v.as_str() {
                req = req.header(k.as_str(), val);
            }
        }
    }

    let body: Value = req.send().await?.error_for_status()?.json().await?;
    let items = extract_json_path(&body, items_path)
        .and_then(|v| v.as_array())
        .ok_or("Impossible de trouver la liste de produits dans la réponse")?;

    let mut fetched = 0i32;
    let mut created = 0i32;
    let mut updated = 0i32;
    let mut errors = 0i32;

    // Prochain product_index disponible
    let max_index: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(product_index), 0) FROM service_products WHERE service_id = $1",
    )
    .bind(service_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);
    let mut next_index = max_index + 1;

    for item in items.iter().take(max_products as usize) {
        fetched += 1;
        if dry_run {
            created += 1; // Simuler
            continue;
        }

        let nom = map_field_str(
            item,
            field_mapping,
            "nom",
            &["name", "title", "nom", "nom_produit"],
        );
        if nom.trim().is_empty() {
            errors += 1;
            continue;
        }

        let prix = map_field_f64(
            item,
            field_mapping,
            "prix",
            &["price", "prix", "price_regular"],
        );
        let stock = map_field_i64(
            item,
            field_mapping,
            "stock",
            &["stock", "quantity", "stock_quantity", "quantite"],
        )
        .unwrap_or(1);
        let categorie = map_field_str(
            item,
            field_mapping,
            "categorie",
            &["category", "categorie", "product_type"],
        );
        let marque = map_field_str(
            item,
            field_mapping,
            "marque",
            &["brand", "marque", "vendor"],
        );
        let description = map_field_str(
            item,
            field_mapping,
            "description",
            &["description", "body_html", "short_description"],
        );
        let image_url = map_field_str(
            item,
            field_mapping,
            "image_url",
            &["image_url", "image", "thumbnail_url"],
        );
        let code_barre = map_field_str(
            item,
            field_mapping,
            "code_barre",
            &["sku", "barcode", "ean", "code_barre", "reference"],
        );
        let en_promotion = map_field_bool(
            item,
            field_mapping,
            "en_promotion",
            &["on_sale", "en_promotion", "is_promotion"],
        );
        let prix_promo = map_field_f64(
            item,
            field_mapping,
            "prix_promo",
            &["sale_price", "prix_promo", "discounted_price"],
        );

        // external_product_id : chercher les champs id
        let ext_id = item.get("id").or_else(|| item.get("product_id")).and_then(|v| {
            v.as_str().map(|s| s.to_string()).or_else(|| v.as_i64().map(|n| n.to_string()))
        });

        let product_data = json!({
            "nom": nom,
            "nom_produit": nom,
            "prix": prix.unwrap_or(0.0),
            "prix_produit": prix.unwrap_or(0.0),
            "description": if description.is_empty() { serde_json::Value::Null } else { json!(description) },
            "categorie": if categorie.is_empty() { json!("autres") } else { json!(categorie) },
            "marque": if marque.is_empty() { serde_json::Value::Null } else { json!(marque) },
            "images": if image_url.is_empty() { json!([]) } else { json!([image_url]) },
            "stock": stock,
            "quantite_disponible": stock,
            "code_barre": if code_barre.is_empty() { serde_json::Value::Null } else { json!(code_barre) },
            "en_promotion": en_promotion,
            "prix_promo": prix_promo,
            "prix_original": if en_promotion { prix } else { None::<f64> },
            "origine_champs": "ecommerce_sync",
            "type": "produit"
        });

        // Chercher si un produit externe avec le même ext_id ou nom existe déjà
        let existing_id: Option<i32> = if let Some(ref eid) = ext_id {
            sqlx::query_scalar(
                "SELECT id FROM service_products WHERE service_id = $1 AND external_product_id = $2 AND platform_integration_id = $3 LIMIT 1"
            )
            .bind(service_id)
            .bind(eid)
            .bind(integration_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten()
        } else if overwrite {
            sqlx::query_scalar(
                "SELECT id FROM service_products WHERE service_id = $1 AND product_name = $2 AND platform_integration_id = $3 LIMIT 1"
            )
            .bind(service_id)
            .bind(&nom)
            .bind(integration_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten()
        } else {
            None
        };

        if let Some(existing) = existing_id {
            if overwrite {
                match sqlx::query(
                    "UPDATE service_products SET product_data=$1, is_active=true, updated_at=NOW() WHERE id=$2"
                )
                .bind(&product_data)
                .bind(existing)
                .execute(&state.pg)
                .await {
                    Ok(_) => updated += 1,
                    Err(e) => { warn!("Erreur MAJ produit {}: {}", nom, e); errors += 1; }
                }
            } else {
                // Skip
            }
        } else {
            match sqlx::query(
                r#"INSERT INTO service_products
                   (service_id, product_index, product_data, is_active, platform_integration_id, external_product_id)
                   VALUES ($1,$2,$3,true,$4,$5)"#
            )
            .bind(service_id)
            .bind(next_index)
            .bind(&product_data)
            .bind(integration_id)
            .bind(&ext_id)
            .execute(&state.pg)
            .await {
                Ok(_) => { created += 1; next_index += 1; }
                Err(e) => { warn!("Erreur INSERT produit {}: {}", nom, e); errors += 1; }
            }
        }
    }

    let duration_ms = start.elapsed().as_millis() as i32;
    Ok(SyncStats {
        fetched,
        created,
        updated,
        errors,
        duration_ms,
    })
}

fn apply_auth(
    mut req: reqwest::RequestBuilder,
    auth_type: &Option<String>,
    api_key: &Option<String>,
    api_secret: &Option<String>,
    bearer_token: &Option<String>,
    basic_user: &Option<String>,
    basic_pass: &Option<String>,
) -> reqwest::RequestBuilder {
    match auth_type.as_deref().unwrap_or("api_key") {
        "bearer_token" => {
            if let Some(token) = bearer_token.as_ref().filter(|t| !t.is_empty()) {
                req = req.bearer_auth(token);
            }
        }
        "basic_auth" => {
            if let Some(user) = basic_user.as_ref().filter(|u| !u.is_empty()) {
                req = req.basic_auth(user, basic_pass.as_deref());
            }
        }
        "api_key" | _ => {
            if let Some(key) = api_key.as_ref().filter(|k| !k.is_empty()) {
                if let Some(secret) = api_secret.as_ref().filter(|s| !s.is_empty()) {
                    // WooCommerce style: basic auth avec consumer_key:consumer_secret
                    req = req.basic_auth(key, Some(secret));
                } else {
                    req = req
                        .header("X-API-Key", key.as_str())
                        .header("Authorization", format!("Bearer {}", key));
                }
            }
        }
    }
    req
}

fn extract_json_path<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    for segment in path.split('.').filter(|s| !s.trim().is_empty()) {
        current = current.get(segment)?;
    }
    Some(current)
}

fn merge_field_mappings(default: &Value, overrides: &Value) -> Value {
    let mut merged = default.as_object().cloned().unwrap_or_default();
    if let Some(obj) = overrides.as_object() {
        for (k, v) in obj {
            merged.insert(k.clone(), v.clone());
        }
    }
    Value::Object(merged)
}

fn map_field_str(item: &Value, mapping: &Value, yukpo_key: &str, fallbacks: &[&str]) -> String {
    // Chercher d'abord via le mapping configuré
    if let Some(mapped_key) = mapping.get(yukpo_key).and_then(|v| v.as_str()) {
        if let Some(val) = item.get(mapped_key).and_then(|v| v.as_str()) {
            return val.trim().to_string();
        }
    }
    // Sinon essayer les fallbacks
    for key in fallbacks {
        if let Some(val) = item.get(*key).and_then(|v| v.as_str()) {
            let trimmed = val.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    String::new()
}

fn map_field_f64(
    item: &Value,
    mapping: &Value,
    yukpo_key: &str,
    fallbacks: &[&str],
) -> Option<f64> {
    let try_key = |key: &str| -> Option<f64> {
        item.get(key).and_then(|v| {
            v.as_f64()
                .or_else(|| v.as_str().and_then(|s| s.replace(',', ".").parse::<f64>().ok()))
        })
    };
    if let Some(mapped_key) = mapping.get(yukpo_key).and_then(|v| v.as_str()) {
        if let Some(val) = try_key(mapped_key) {
            return Some(val);
        }
    }
    for key in fallbacks {
        if let Some(val) = try_key(key) {
            return Some(val);
        }
    }
    None
}

fn map_field_i64(
    item: &Value,
    mapping: &Value,
    yukpo_key: &str,
    fallbacks: &[&str],
) -> Option<i64> {
    let try_key = |key: &str| -> Option<i64> {
        item.get(key)
            .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok())))
    };
    if let Some(mapped_key) = mapping.get(yukpo_key).and_then(|v| v.as_str()) {
        if let Some(val) = try_key(mapped_key) {
            return Some(val);
        }
    }
    for key in fallbacks {
        if let Some(val) = try_key(key) {
            return Some(val);
        }
    }
    None
}

fn map_field_bool(item: &Value, mapping: &Value, yukpo_key: &str, fallbacks: &[&str]) -> bool {
    let try_key = |key: &str| -> Option<bool> {
        item.get(key).and_then(|v| {
            v.as_bool().or_else(|| {
                v.as_str()
                    .map(|s| matches!(s.to_lowercase().as_str(), "true" | "1" | "yes" | "oui"))
            })
        })
    };
    if let Some(mapped_key) = mapping.get(yukpo_key).and_then(|v| v.as_str()) {
        if let Some(val) = try_key(mapped_key) {
            return val;
        }
    }
    for key in fallbacks {
        if let Some(val) = try_key(key) {
            return val;
        }
    }
    false
}

fn generate_webhook_secret() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    format!("{:x}", ts ^ 0xDEADBEEFCAFE1234u128)
}
