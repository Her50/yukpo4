// ✅ NOUVEAU 2026-03-11 : Routes admin pour gérer les paramètres plateforme
// (numéros MTN/Orange Money, comptes bancaires, etc.)
// Accessible uniquement aux admin et super-admin

use axum::{
    extract::{Path, State},
    middleware,
    routing::get,
    Extension, Json, Router,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::{jwt_auth, AuthenticatedUser};
use crate::state::AppState;

#[derive(Serialize)]
#[allow(dead_code)]
struct PlatformSettingResponse {
    id: i32,
    key: String,
    value: Value,
    description: Option<String>,
    updated_by: Option<i32>,
    updated_at: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdatePlatformSettingInput {
    pub value: Value,
}

/// Vérifie que l'utilisateur est admin ou super_admin
fn is_admin(role: &str) -> bool {
    role == "admin" || role == "super_admin"
}

/// GET /api/admin/platform-settings - Liste tous les paramètres plateforme
pub async fn list_platform_settings(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<Value>> {
    if !is_admin(&user.role) {
        return Err(AppError::Forbidden(
            "Accès réservé aux administrateurs".into(),
        ));
    }

    let rows = sqlx::query_as::<
        _,
        (
            i32,
            String,
            Value,
            Option<String>,
            Option<i32>,
            Option<chrono::DateTime<chrono::Utc>>,
        ),
    >(
        r#"
        SELECT id, key, value, description, updated_by, updated_at
        FROM platform_settings
        ORDER BY key ASC
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[platform_settings] Erreur liste: {e:?}");
        AppError::Internal("Erreur récupération paramètres plateforme".into())
    })?;

    let settings: Vec<Value> = rows
        .into_iter()
        .map(|(id, key, value, description, updated_by, updated_at)| {
            serde_json::json!({
                "id": id,
                "key": key,
                "value": value,
                "description": description,
                "updated_by": updated_by,
                "updated_at": updated_at.map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "data": settings
    })))
}

/// GET /api/admin/platform-settings/:key - Obtenir un paramètre spécifique
pub async fn get_platform_setting(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
) -> AppResult<Json<Value>> {
    if !is_admin(&user.role) {
        return Err(AppError::Forbidden(
            "Accès réservé aux administrateurs".into(),
        ));
    }

    let row = sqlx::query_as::<
        _,
        (
            i32,
            String,
            Value,
            Option<String>,
            Option<i32>,
            Option<chrono::DateTime<chrono::Utc>>,
        ),
    >(
        r#"
        SELECT id, key, value, description, updated_by, updated_at
        FROM platform_settings
        WHERE key = $1
        "#,
    )
    .bind(&key)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[platform_settings] Erreur get {key}: {e:?}");
        AppError::Internal("Erreur récupération paramètre".into())
    })?;

    match row {
        Some((id, key, value, description, updated_by, updated_at)) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "data": {
                    "id": id,
                    "key": key,
                    "value": value,
                    "description": description,
                    "updated_by": updated_by,
                    "updated_at": updated_at.map(|d| d.to_rfc3339()),
                }
            })))
        }
        None => Err(AppError::NotFound(format!(
            "Paramètre '{}' non trouvé",
            key
        ))),
    }
}

/// PUT /api/admin/platform-settings/:key - Mettre à jour un paramètre
pub async fn update_platform_setting(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
    Json(input): Json<UpdatePlatformSettingInput>,
) -> AppResult<Json<Value>> {
    if !is_admin(&user.role) {
        return Err(AppError::Forbidden(
            "Accès réservé aux administrateurs".into(),
        ));
    }

    info!(
        "[platform_settings] Admin {} met à jour '{}': {:?}",
        user.id, key, input.value
    );

    let result = sqlx::query(
        r#"
        UPDATE platform_settings
        SET value = $1, updated_by = $2, updated_at = NOW()
        WHERE key = $3
        "#,
    )
    .bind(&input.value)
    .bind(user.id)
    .bind(&key)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[platform_settings] Erreur update {key}: {e:?}");
        AppError::Internal("Erreur mise à jour paramètre".into())
    })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Paramètre '{}' non trouvé",
            key
        )));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Paramètre '{}' mis à jour avec succès", key)
    })))
}

/// GET /api/platform/payment-config - Config paiement publique (pour le mobile, sans données sensibles)
/// Retourne uniquement si MTN/Orange sont activés (pas les numéros complets)
pub async fn get_public_payment_config(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<Value>> {
    let rows = sqlx::query_as::<_, (String, Value)>(
        r#"
        SELECT key, value
        FROM platform_settings
        WHERE key IN ('platform_mtn_money', 'platform_orange_money')
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let mut mtn_enabled = false;
    let mut orange_enabled = false;

    for (key, value) in &rows {
        let enabled = value.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
        let phone = value.get("phone").and_then(|v| v.as_str()).unwrap_or("");
        match key.as_str() {
            "platform_mtn_money" => mtn_enabled = enabled && !phone.is_empty(),
            "platform_orange_money" => orange_enabled = enabled && !phone.is_empty(),
            _ => {}
        }
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "data": {
            "mtn_money_enabled": mtn_enabled,
            "orange_money_enabled": orange_enabled,
        }
    })))
}

pub fn platform_settings_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Routes admin (protégées par JWT + vérification rôle dans chaque handler)
        .route("/api/admin/platform-settings", get(list_platform_settings))
        .route(
            "/api/admin/platform-settings/{key}",
            get(get_platform_setting).put(update_platform_setting),
        )
        // Route publique (info limitée)
        .route(
            "/api/platform/payment-config",
            get(get_public_payment_config),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}
