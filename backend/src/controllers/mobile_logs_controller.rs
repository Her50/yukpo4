// Contrôleur pour recevoir les logs mobile
use crate::core::types::AppError;
use crate::state::AppState;
use axum::{extract::State, response::Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct MobileLogEntry {
    pub level: String,
    pub message: String,
    pub component: Option<String>,
    pub data: Option<Value>,
    pub timestamp: String,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
    #[serde(rename = "deviceInfo")]
    pub device_info: Option<DeviceInfo>,
    pub stack: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeviceInfo {
    pub platform: Option<String>,
    pub version: Option<String>,
    #[serde(rename = "deviceId")]
    pub device_id: Option<String>,
    // ✅ Compatibilité avec expo-device
    #[serde(rename = "osName")]
    pub os_name: Option<String>,
    #[serde(rename = "osVersion")]
    pub os_version: Option<String>,
    pub brand: Option<String>,
    pub model: Option<String>,
    #[serde(rename = "isDevice")]
    pub is_device: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct MobileLogsRequest {
    pub logs: Vec<MobileLogEntry>,
    pub batch_id: String,
}

#[derive(Debug, Serialize)]
pub struct MobileLogsResponse {
    pub success: bool,
    pub received: usize,
    pub batch_id: String,
}

/// Endpoint pour recevoir les logs mobile
pub async fn receive_mobile_logs(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<MobileLogsRequest>,
) -> Result<Json<MobileLogsResponse>, AppError> {
    let batch_id = payload.batch_id.clone();
    let logs_count = payload.logs.len();

    // ✅ AMÉLIORÉ : Logger tous les logs mobiles avec un format distinctif
    for log in &payload.logs {
        let component = log.component.as_deref().unwrap_or("unknown");
        let user_info = log
            .user_id
            .as_ref()
            .map(|u| format!("User:{}", u))
            .unwrap_or_default();
        let device_info = log
            .device_info
            .as_ref()
            .map(|d| {
                let platform = d
                    .platform
                    .as_deref()
                    .or_else(|| d.os_name.as_deref())
                    .unwrap_or("unknown");
                let version = d
                    .version
                    .as_deref()
                    .or_else(|| d.os_version.as_deref())
                    .unwrap_or("unknown");
                format!("Device:{}/{}", platform, version)
            })
            .unwrap_or_default();

        let log_prefix = format!(
            "📱[MOBILE] [{}] {}{}{}",
            log.level.to_uppercase(),
            component,
            if !user_info.is_empty() {
                format!(" | {}", user_info)
            } else {
                String::new()
            },
            if !device_info.is_empty() {
                format!(" | {}", device_info)
            } else {
                String::new()
            }
        );

        match log.level.as_str() {
            "error" => {
                log::error!("{} {}", log_prefix, log.message);
                if let Some(data) = &log.data {
                    if let Ok(data_str) = serde_json::to_string(data) {
                        log::error!("{} Data: {}", log_prefix, data_str);
                    }
                }
                if let Some(stack) = &log.stack {
                    log::error!("{} Stack: {}", log_prefix, stack);
                }
            }
            "warn" => {
                log::warn!("{} {}", log_prefix, log.message);
                if let Some(data) = &log.data {
                    if let Ok(data_str) = serde_json::to_string(data) {
                        log::warn!("{} Data: {}", log_prefix, data_str);
                    }
                }
            }
            "info" => {
                log::info!("{} {}", log_prefix, log.message);
                if let Some(data) = &log.data {
                    if let Ok(data_str) = serde_json::to_string(data) {
                        log::info!("{} Data: {}", log_prefix, data_str);
                    }
                }
            }
            "debug" => {
                log::debug!("{} {}", log_prefix, log.message);
                if let Some(data) = &log.data {
                    if let Ok(data_str) = serde_json::to_string(data) {
                        log::debug!("{} Data: {}", log_prefix, data_str);
                    }
                }
            }
            _ => {
                log::info!("{} {}", log_prefix, log.message);
            }
        }
    }

    // Sauvegarder dans la base de données (optionnel, pour historique)
    // Pour l'instant, on log juste dans les logs backend
    // Vous pouvez ajouter une table mobile_logs si besoin d'historique

    log::info!(
        "📱[MOBILE-BATCH] Reçu {} logs mobile (batch: {})",
        logs_count,
        batch_id
    );

    Ok(Json(MobileLogsResponse {
        success: true,
        received: logs_count,
        batch_id,
    }))
}
