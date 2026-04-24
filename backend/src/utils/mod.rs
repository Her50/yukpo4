pub mod classe_normalization;
pub mod currency;
pub mod db_monitor;
pub mod db_retry;
pub mod detect_intention;
pub mod embedding_client;
pub mod etablissement_upsert;
pub mod jwt_manager;
pub mod lang;
pub mod livekit;
pub mod log;
pub mod normalize_name;
pub mod prompt_sanitizer;
pub mod redis_helper;
pub mod redis_tcp_direct;
pub mod retry;
pub mod role_helpers;
pub mod sanitize_logs;
pub mod session_academique;
pub mod validation;
pub mod version;

use std::sync::Arc;
use uuid::Uuid;

use crate::core::types::AppError;
use crate::state::AppState;

pub fn generate_reference(prefix: &str) -> String {
    let id = Uuid::new_v4().to_string().replace("-", "");
    if prefix.is_empty() {
        id[..12].to_uppercase()
    } else {
        format!("{}-{}", prefix, &id[..12].to_uppercase())
    }
}

pub fn generate_qr_code(data: &str) -> Result<String, AppError> {
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        data.as_bytes(),
    ))
}

/// Expo (Android) attend des valeurs `data` en chaînes ; on aplatit un objet JSON.
fn expo_push_data_strings(data: Option<serde_json::Value>) -> Option<serde_json::Value> {
    let data = data?;
    if let Some(obj) = data.as_object() {
        let mut out = serde_json::Map::new();
        for (k, v) in obj {
            let s = match v {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => String::new(),
                serde_json::Value::Array(_) | serde_json::Value::Object(_) => v.to_string(),
            };
            out.insert(k.clone(), serde_json::Value::String(s));
        }
        return Some(serde_json::Value::Object(out));
    }
    Some(data)
}

/// Envoie une notification via Expo Push (`user_push_tokens`) avec titre, corps et `data` optionnel.
pub async fn send_notification(
    state: &Arc<AppState>,
    user_id: i32,
    title: &str,
    message: &str,
    extra_data: Option<serde_json::Value>,
) -> Result<(), AppError> {
    let data = expo_push_data_strings(extra_data);

    ::log::info!(
        "[send_notification] → user={} title={} msg={} data={:?}",
        user_id,
        title,
        message,
        data
    );

    crate::services::push_notification_service::send_push_notification(
        &state.pg,
        user_id,
        title.to_string(),
        message.to_string(),
        data,
        Some("default".to_string()),
    )
    .await
    .map_err(|e| AppError::Internal(format!("Expo push: {}", e)))?;

    Ok(())
}
