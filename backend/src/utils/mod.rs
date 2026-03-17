pub mod currency;
pub mod db_monitor;
pub mod db_retry;
pub mod detect_intention;
pub mod embedding_client;
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

pub async fn send_notification(
    _state: &Arc<AppState>,
    user_id: i32,
    title: &str,
    message: &str,
    _extra_data: Option<serde_json::Value>,
) -> Result<(), AppError> {
    ::log::info!(
        "[send_notification] → user={} title={} msg={}",
        user_id, title, message
    );
    Ok(())
}
