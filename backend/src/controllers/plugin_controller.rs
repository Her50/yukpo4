// ✅ NOUVEAU Phase 2: Controller pour gestion des plugins
// Date: 2025-01-27

use crate::core::types::{AppError, AppResult};
use crate::services::plugin_service::{PluginCategory, PluginMetadata, PluginService};
use axum::{extract::{Query, State, Path}, Json};
use log::info;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct PluginSearchQuery {
    pub q: Option<String>,
    pub category: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct PluginListResponse {
    pub success: bool,
    pub plugins: Vec<PluginMetadata>,
    pub total: usize,
}

/// Liste tous les plugins installés
pub async fn list_plugins(
    State(_state): State<Arc<crate::state::AppState>>,
) -> AppResult<Json<PluginListResponse>> {
    info!("[PluginController] Liste des plugins");

    let plugin_service = PluginService::new(None)
        .map_err(|e| AppError::Internal(format!("Erreur création PluginService: {}", e)))?;

    let plugins = plugin_service.list_plugins().await?;
    let total = plugins.len();

    Ok(Json(PluginListResponse {
        success: true,
        plugins,
        total,
    }))
}

/// Récupère un plugin par son ID
pub async fn get_plugin(
    State(_state): State<Arc<crate::state::AppState>>,
    Path(plugin_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[PluginController] Récupération plugin: {}", plugin_id);

    let plugin_service = PluginService::new(None)
        .map_err(|e| AppError::Internal(format!("Erreur création PluginService: {}", e)))?;

    match plugin_service.get_plugin(&plugin_id).await? {
        Some(plugin) => Ok(Json(serde_json::json!({
            "success": true,
            "plugin": {
                "metadata": plugin.metadata,
                "status": plugin.status,
                "install_date": plugin.install_date,
                "last_used": plugin.last_used,
                "usage_count": plugin.usage_count,
            }
        }))),
        None => Err(AppError::NotFound(format!(
            "Plugin {} non trouvé",
            plugin_id
        ))),
    }
}

/// Recherche dans le marketplace
pub async fn search_marketplace(
    State(_state): State<Arc<crate::state::AppState>>,
    Query(params): Query<PluginSearchQuery>,
) -> AppResult<Json<PluginListResponse>> {
    info!("[PluginController] Recherche marketplace: {:?}", params.q);

    let category = params
        .category
        .as_deref()
        .and_then(|c| match c.to_lowercase().as_str() {
            "effect" => Some(PluginCategory::Effect),
            "transition" => Some(PluginCategory::Transition),
            "filter" => Some(PluginCategory::Filter),
            "export" => Some(PluginCategory::Export),
            "integration" => Some(PluginCategory::Integration),
            _ => None,
        });

    let plugin_service = crate::services::plugin_service::PluginService::new(None)
        .map_err(|e| AppError::Internal(format!("Erreur création PluginService: {}", e)))?;

    let query = params.q.as_deref().unwrap_or("");
    let plugins = plugin_service
        .search_marketplace(&_state.pg, query, category, params.limit)
        .await?;
    let total = plugins.len();

    Ok(Json(PluginListResponse {
        success: true,
        plugins,
        total,
    }))
}

/// Installe un plugin
pub async fn install_plugin(
    State(_state): State<Arc<crate::state::AppState>>,
    Json(metadata): Json<PluginMetadata>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[PluginController] Installation plugin: {}", metadata.id);

    let plugin_service = PluginService::new(None)
        .map_err(|e| AppError::Internal(format!("Erreur création PluginService: {}", e)))?;

    // TODO: Récupérer le fichier plugin depuis Multipart
    // Pour l'instant, on suppose que le plugin est déjà téléchargé
    let temp_path_str = format!("/tmp/{}_temp.zip", metadata.id);
    let temp_path = std::path::Path::new(&temp_path_str);

    let plugin_id = plugin_service.install_plugin(temp_path, metadata).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "plugin_id": plugin_id
    })))
}

/// Active un plugin
pub async fn activate_plugin(
    State(_state): State<Arc<crate::state::AppState>>,
    Path(plugin_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[PluginController] Activation plugin: {}", plugin_id);

    let plugin_service = PluginService::new(None)
        .map_err(|e| AppError::Internal(format!("Erreur création PluginService: {}", e)))?;

    plugin_service.activate_plugin(&plugin_id).await?;

    Ok(Json(serde_json::json!({
        "success": true
    })))
}

/// Désactive un plugin
pub async fn deactivate_plugin(
    State(_state): State<Arc<crate::state::AppState>>,
    Path(plugin_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[PluginController] Désactivation plugin: {}", plugin_id);

    let plugin_service = PluginService::new(None)
        .map_err(|e| AppError::Internal(format!("Erreur création PluginService: {}", e)))?;

    plugin_service.deactivate_plugin(&plugin_id).await?;

    Ok(Json(serde_json::json!({
        "success": true
    })))
}

/// Désinstalle un plugin
pub async fn uninstall_plugin(
    State(_state): State<Arc<crate::state::AppState>>,
    Path(plugin_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    info!("[PluginController] Désinstallation plugin: {}", plugin_id);

    let plugin_service = PluginService::new(None)
        .map_err(|e| AppError::Internal(format!("Erreur création PluginService: {}", e)))?;

    plugin_service.uninstall_plugin(&plugin_id).await?;

    Ok(Json(serde_json::json!({
        "success": true
    })))
}
