// Contrôleur pour recevoir les logs mobile
use crate::core::types::AppError;
use crate::state::AppState;
use axum::{extract::State, http::StatusCode, response::Json};
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
    pub userId: Option<String>,
    pub deviceInfo: Option<DeviceInfo>,
    pub stack: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeviceInfo {
    pub platform: String,
    pub version: Option<String>,
    pub deviceId: Option<String>,
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
    State(state): State<Arc<AppState>>,
    Json(payload): Json<MobileLogsRequest>,
) -> Result<Json<MobileLogsResponse>, AppError> {
    let batch_id = payload.batch_id.clone();
    let logs_count = payload.logs.len();

    // Logger les erreurs critiques immédiatement
    for log in &payload.logs {
        if log.level == "error" {
            log::error!(
                "[MobileLog] [{}] {}: {}",
                log.component.as_deref().unwrap_or("unknown"),
                log.message,
                log.data
                    .as_ref()
                    .map(|d| serde_json::to_string(d).unwrap_or_default())
                    .unwrap_or_default()
            );

            // Si stack trace disponible, la logger aussi
            if let Some(stack) = &log.stack {
                log::error!("[MobileLog] Stack trace: {}", stack);
            }
        } else if log.level == "warn" {
            log::warn!(
                "[MobileLog] [{}] {}",
                log.component.as_deref().unwrap_or("unknown"),
                log.message
            );
        }
    }

    // Sauvegarder dans la base de données (optionnel, pour historique)
    // Pour l'instant, on log juste dans les logs backend
    // Vous pouvez ajouter une table mobile_logs si besoin d'historique

    log::info!(
        "[MobileLogs] Reçu {} logs (batch: {})",
        logs_count,
        batch_id
    );

    Ok(Json(MobileLogsResponse {
        success: true,
        received: logs_count,
        batch_id,
    }))
}

