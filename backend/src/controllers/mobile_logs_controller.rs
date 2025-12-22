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
/// ✅ OPTIMISÉ 2025-12-20: Traitement asynchrone, limite de batch, logs groupés
pub async fn receive_mobile_logs(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<MobileLogsRequest>,
) -> Result<Json<MobileLogsResponse>, AppError> {
    let batch_id = payload.batch_id.clone();
    let logs_count = payload.logs.len();

    // ✅ OPTIMISATION: Limiter le nombre de logs par batch (max 100)
    const MAX_LOGS_PER_BATCH: usize = 100;
    let logs_to_process = if logs_count > MAX_LOGS_PER_BATCH {
        log::warn!(
            "📱[MOBILE-BATCH] Batch {} contient {} logs (max: {}), traitement limité",
            batch_id,
            logs_count,
            MAX_LOGS_PER_BATCH
        );
        &payload.logs[..MAX_LOGS_PER_BATCH]
    } else {
        &payload.logs[..]
    };

    // ✅ OPTIMISATION: Traiter les logs en arrière-plan pour ne pas bloquer la réponse
    let logs_clone: Vec<MobileLogEntry> = logs_to_process
        .iter()
        .map(|log| MobileLogEntry {
            level: log.level.clone(),
            message: log.message.clone(),
            component: log.component.clone(),
            data: log.data.clone(),
            timestamp: log.timestamp.clone(),
            user_id: log.user_id.clone(),
            device_info: log.device_info.clone(),
            stack: log.stack.clone(),
        })
        .collect();

    let batch_id_clone = batch_id.clone();

    // ✅ OPTIMISATION: Traiter les logs de manière asynchrone dans un task spawn
    tokio::spawn(async move {
        process_mobile_logs_async(logs_clone, batch_id_clone).await;
    });

    // ✅ OPTIMISATION: Retourner immédiatement la réponse sans attendre le traitement des logs
    log::info!(
        "📱[MOBILE-BATCH] Accepté {} logs mobile (batch: {}), traitement en arrière-plan",
        logs_count,
        batch_id
    );

    Ok(Json(MobileLogsResponse {
        success: true,
        received: logs_count,
        batch_id,
    }))
}

/// ✅ NOUVEAU: Traitement asynchrone des logs mobiles avec logs groupés
async fn process_mobile_logs_async(logs: Vec<MobileLogEntry>, batch_id: String) {
    let logs_count = logs.len();

    // ✅ OPTIMISATION: Grouper les logs par niveau pour réduire les appels système
    let mut error_logs = Vec::new();
    let mut warn_logs = Vec::new();
    let mut info_logs = Vec::new();
    let mut debug_logs = Vec::new();
    let mut other_logs = Vec::new();

    for log in logs {
        match log.level.as_str() {
            "error" => error_logs.push(log),
            "warn" => warn_logs.push(log),
            "info" => info_logs.push(log),
            "debug" => debug_logs.push(log),
            _ => other_logs.push(log),
        }
    }

    // ✅ OPTIMISATION: Logger par groupe pour réduire les appels système
    if !error_logs.is_empty() {
        log_error_group(&error_logs, &batch_id);
    }
    if !warn_logs.is_empty() {
        log_warn_group(&warn_logs, &batch_id);
    }
    if !info_logs.is_empty() {
        log_info_group(&info_logs, &batch_id);
    }
    if !debug_logs.is_empty() {
        log_debug_group(&debug_logs, &batch_id);
    }
    if !other_logs.is_empty() {
        log_info_group(&other_logs, &batch_id);
    }

    log::info!(
        "📱[MOBILE-BATCH] Traitement terminé pour {} logs (batch: {})",
        logs_count,
        batch_id
    );
}

/// ✅ NOUVEAU: Logger les erreurs par groupe
fn log_error_group(logs: &[MobileLogEntry], batch_id: &str) {
    for log in logs {
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

        let client_timestamp = if !log.timestamp.is_empty() {
            format!(" | Time:{}", log.timestamp)
        } else {
            String::new()
        };

        let log_prefix = format!(
            "📱[MOBILE] [ERROR] {}{}{}{}",
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
            },
            client_timestamp
        );

        // ✅ AMÉLIORÉ : Ne pas logger comme erreur critique les erreurs WebSocket normales
        let is_websocket_abort = log.message.contains("Software caused connection abort")
            || log.message.contains("connection abort")
            || (log.message.contains("WebSocket") && log.message.contains("abort"));

        if is_websocket_abort {
            log::warn!("{} {} (erreur WebSocket normale, ignorée)", log_prefix, log.message);
        } else {
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
    }
}

/// ✅ NOUVEAU: Logger les warnings par groupe
fn log_warn_group(logs: &[MobileLogEntry], batch_id: &str) {
    for log in logs {
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

        let client_timestamp = if !log.timestamp.is_empty() {
            format!(" | Time:{}", log.timestamp)
        } else {
            String::new()
        };

        let log_prefix = format!(
            "📱[MOBILE] [WARN] {}{}{}{}",
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
            },
            client_timestamp
        );

        log::warn!("{} {}", log_prefix, log.message);
        if let Some(data) = &log.data {
            if let Ok(data_str) = serde_json::to_string(data) {
                log::warn!("{} Data: {}", log_prefix, data_str);
            }
        }
    }
}

/// ✅ NOUVEAU: Logger les infos par groupe (limitée pour éviter le spam)
fn log_info_group(logs: &[MobileLogEntry], batch_id: &str) {
    // ✅ OPTIMISATION: Limiter le nombre de logs INFO à logger (max 50 par batch)
    const MAX_INFO_LOGS: usize = 50;
    let logs_to_log = if logs.len() > MAX_INFO_LOGS {
        &logs[..MAX_INFO_LOGS]
    } else {
        logs
    };

    for log in logs_to_log {
        let component = log.component.as_deref().unwrap_or("unknown");
        let log_prefix = format!("📱[MOBILE] [INFO] {}", component);
        log::info!("{} {}", log_prefix, log.message);
        // ✅ OPTIMISATION: Ne logger les data que si vraiment nécessaire (éviter le spam)
        // if let Some(data) = &log.data {
        //     if let Ok(data_str) = serde_json::to_string(data) {
        //         log::info!("{} Data: {}", log_prefix, data_str);
        //     }
        // }
    }

    if logs.len() > MAX_INFO_LOGS {
        log::info!(
            "📱[MOBILE] [INFO] {} logs INFO supplémentaires non loggés (batch: {})",
            logs.len() - MAX_INFO_LOGS,
            batch_id
        );
    }
}

/// ✅ NOUVEAU: Logger les debug par groupe (très limitée)
fn log_debug_group(logs: &[MobileLogEntry], batch_id: &str) {
    // ✅ OPTIMISATION: Limiter drastiquement les logs DEBUG (max 20 par batch)
    const MAX_DEBUG_LOGS: usize = 20;
    let logs_to_log = if logs.len() > MAX_DEBUG_LOGS {
        &logs[..MAX_DEBUG_LOGS]
    } else {
        logs
    };

    for log in logs_to_log {
        let component = log.component.as_deref().unwrap_or("unknown");
        let log_prefix = format!("📱[MOBILE] [DEBUG] {}", component);
        log::debug!("{} {}", log_prefix, log.message);
    }

    if logs.len() > MAX_DEBUG_LOGS {
        log::debug!(
            "📱[MOBILE] [DEBUG] {} logs DEBUG supplémentaires non loggés (batch: {})",
            logs.len() - MAX_DEBUG_LOGS,
            batch_id
        );
    }
}

// ✅ ANCIEN CODE (supprimé - remplacé par la version optimisée ci-dessus)
// Ancien code de traitement synchrone supprimé pour éviter les blocages
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

        // ✅ AMÉLIORÉ : Inclure le timestamp client si disponible
        let client_timestamp = if !log.timestamp.is_empty() {
            format!(" | Time:{}", log.timestamp)
        } else {
            String::new()
        };

        let log_prefix = format!(
            "📱[MOBILE] [{}] {}{}{}{}",
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
            },
            client_timestamp
        );

        match log.level.as_str() {
            "error" => {
                // ✅ AMÉLIORÉ : Ne pas logger comme erreur critique les erreurs WebSocket normales
                // "Software caused connection abort" est une erreur normale qui peut se produire
                // quand le client se met en arrière-plan ou change de réseau
                let is_websocket_abort = log.message.contains("Software caused connection abort")
                    || log.message.contains("connection abort")
                    || (log.message.contains("WebSocket") && log.message.contains("abort"));
                
                if is_websocket_abort {
                    // Logger comme warning au lieu d'error pour ces cas normaux
                    log::warn!("{} {} (erreur WebSocket normale, ignorée)", log_prefix, log.message);
                } else {
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
