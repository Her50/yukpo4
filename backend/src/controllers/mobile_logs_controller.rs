// Contrôleur pour recevoir les logs mobile
use crate::core::types::AppError;
use crate::state::AppState;
use axum::{extract::State, response::Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

#[derive(Debug, Deserialize, Serialize)]
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

#[derive(Debug, Deserialize, Serialize, Clone)]
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

#[derive(Debug, Deserialize, Serialize)]
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

/// ✅ NOUVEAU 2026-01-02: Estimer la taille d'un payload de logs
fn estimate_payload_size(logs: &[MobileLogEntry]) -> usize {
    // Estimation rapide: taille JSON approximative
    // On utilise une estimation conservatrice basée sur la taille moyenne des logs
    logs.iter()
        .map(|log| {
            let message_size = log.message.len();
            let component_size = log.component.as_ref().map(|s| s.len()).unwrap_or(0);
            let data_size = log
                .data
                .as_ref()
                .and_then(|d| serde_json::to_string(d).ok())
                .map(|s| s.len())
                .unwrap_or(0);
            let stack_size = log.stack.as_ref().map(|s| s.len()).unwrap_or(0);
            let timestamp_size = log.timestamp.len();
            let user_id_size = log.user_id.as_ref().map(|s| s.len()).unwrap_or(0);
            let device_info_size = log
                .device_info
                .as_ref()
                .and_then(|d| serde_json::to_string(d).ok())
                .map(|s| s.len())
                .unwrap_or(0);

            // Taille de base pour la structure JSON (~200 bytes par log)
            200 + message_size
                + component_size
                + data_size
                + stack_size
                + timestamp_size
                + user_id_size
                + device_info_size
        })
        .sum()
}

/// ✅ NOUVEAU 2026-01-02: Trouver le nombre maximal de logs qui rentrent dans la limite de taille
/// Retourne une slice des logs qui peuvent être acceptés sans dépasser la limite
fn find_max_logs_fitting_size(
    logs: &[MobileLogEntry],
    max_size_bytes: usize,
    max_logs: usize,
) -> &[MobileLogEntry] {
    // Limiter d'abord par le nombre de logs
    let logs_to_check = if logs.len() > max_logs {
        &logs[..max_logs]
    } else {
        logs
    };

    // Trouver le nombre maximal de logs qui rentrent dans la limite de taille
    // On utilise une approche binaire pour optimiser
    let mut left = 0;
    let mut right = logs_to_check.len();
    let mut best = 0;

    while left <= right {
        let mid = (left + right) / 2;
        let test_logs = &logs_to_check[..mid];

        // Estimation de la taille avec batch_id (on ajoute ~100 bytes pour le batch_id et la structure)
        let estimated_size = estimate_payload_size(test_logs) + 100;

        if estimated_size <= max_size_bytes {
            best = mid;
            left = mid + 1;
        } else {
            if mid == 0 {
                break;
            }
            right = mid - 1;
        }
    }

    // Si aucun log ne rentre, on essaie quand même les premiers logs individuels
    // (parfois l'estimation est trop conservatrice)
    if best == 0 && !logs_to_check.is_empty() {
        // Accepter au moins quelques logs même si l'estimation dépasse
        // (la taille réelle peut être inférieure à l'estimation)
        best = logs_to_check.len().min(10);
    }

    &logs_to_check[..best]
}

/// Endpoint pour recevoir les logs mobile
/// ✅ OPTIMISÉ 2025-12-20: Traitement asynchrone, limite de batch, logs groupés
/// ✅ CORRIGÉ 2025-12-31: Validation de taille avant traitement pour éviter les timeouts
pub async fn receive_mobile_logs(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<MobileLogsRequest>,
) -> Result<Json<MobileLogsResponse>, AppError> {
    let batch_id = payload.batch_id.clone();
    let logs_count = payload.logs.len();

    // ✅ NOUVEAU 2025-12-31: Validation de la taille du payload avant traitement
    // Limiter à 100 logs par batch pour éviter les timeouts et les problèmes de mémoire
    const MAX_LOGS_PER_BATCH: usize = 100;
    const MAX_PAYLOAD_SIZE_BYTES: usize = 5_000_000; // 5 MB max par batch

    // ✅ AMÉLIORÉ 2026-01-02: Trouver le nombre maximal de logs qui rentrent dans la limite de taille
    // Au lieu de rejeter complètement les batches trop volumineux, on accepte partiellement
    let logs_to_process =
        find_max_logs_fitting_size(&payload.logs, MAX_PAYLOAD_SIZE_BYTES, MAX_LOGS_PER_BATCH);

    if logs_to_process.len() < logs_count {
        log::warn!(
            "📱[MOBILE-BATCH] Batch {} trop volumineux ({} logs, {} bytes estimés), acceptation partielle ({} logs)",
            batch_id,
            logs_count,
            estimate_payload_size(&payload.logs),
            logs_to_process.len()
        );
    }

    // ✅ OPTIMISATION: Traiter les logs en arrière-plan pour ne pas bloquer la réponse
    // ✅ CRITIQUE 2025-12-31: Cloner les données AVANT de spawner le task pour éviter les problèmes de lifetime
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
    let logs_count_to_process = logs_clone.len();

    // ✅ OPTIMISATION: Traiter les logs de manière asynchrone dans un task spawn
    // ✅ CRITIQUE 2025-12-31: Utiliser spawn pour ne pas bloquer la réponse HTTP
    // La réponse est retournée immédiatement, même si le traitement des logs prend du temps
    tokio::spawn(async move {
        process_mobile_logs_async(logs_clone, batch_id_clone).await;
    });

    // ✅ OPTIMISATION: Retourner immédiatement la réponse sans attendre le traitement des logs
    // Cela évite les timeouts côté client même si le traitement prend du temps
    log::info!(
        "📱[MOBILE-BATCH] Accepté {} logs mobile (batch: {}), traitement en arrière-plan",
        logs_count_to_process,
        batch_id
    );

    Ok(Json(MobileLogsResponse {
        success: true,
        received: logs_count_to_process,
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
fn log_error_group(logs: &[MobileLogEntry], _batch_id: &str) {
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

        // ✅ AMÉLIORÉ : Ne pas logger comme erreur critique les erreurs GPS normales
        // (certains services n'ont simplement pas de GPS configuré, c'est normal)
        let is_gps_error = log.message.contains("AUCUNE source GPS valide trouvée")
            || log.message.contains("Aucune source GPS valide trouvée")
            || (log.message.contains("useLocationDisplay") && log.message.contains("GPS"));

        if is_websocket_abort {
            log::warn!(
                "{} {} (erreur WebSocket normale, ignorée)",
                log_prefix,
                log.message
            );
        } else if is_gps_error {
            // Logger en debug au lieu de error pour ne pas polluer les logs
            log::debug!(
                "{} {} (erreur GPS normale, ignorée)",
                log_prefix,
                log.message
            );
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
fn log_warn_group(logs: &[MobileLogEntry], _batch_id: &str) {
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

        // ✅ AMÉLIORÉ : Ne pas logger comme warning critique les warnings GPS normaux
        // (certains services n'ont simplement pas de GPS configuré, c'est normal)
        let is_gps_warning = log.message.contains("Aucune source GPS valide trouvée")
            || log.message.contains("GPS valide trouvée")
            || (log.message.contains("useLocationDisplay") && log.message.contains("GPS"));

        if is_gps_warning {
            // Logger en debug au lieu de warn pour ne pas polluer les logs
            log::debug!(
                "{} {} (warning GPS normal, ignoré)",
                log_prefix,
                log.message
            );
        } else {
            log::warn!("{} {}", log_prefix, log.message);
        }
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
