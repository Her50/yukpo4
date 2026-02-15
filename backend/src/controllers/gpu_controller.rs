// ✅ NOUVEAU 2026-02-14: Contrôleur pour gestion GPU GCP
// Routes API REST pour monitoring, scaling et métriques GPU

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use axum::extract::State;
use axum::Json;
use serde_json::{json, Value};
use std::sync::Arc;

/// GET /api/gpu/metrics - Récupère les métriques GPU actuelles
pub async fn get_gpu_metrics(State(state): State<Arc<AppState>>) -> AppResult<Json<Value>> {
    if let Some(gpu_service) = &state.gpu_service {
        let metrics = gpu_service.get_metrics().await;
        Ok(Json(json!({
            "status": "ok",
            "metrics": metrics,
            "enabled": true
        })))
    } else {
        Ok(Json(json!({
            "status": "disabled",
            "message": "GPU service non configuré",
            "enabled": false
        })))
    }
}

/// GET /api/gpu/status - Récupère le statut du service GPU
pub async fn get_gpu_status(State(state): State<Arc<AppState>>) -> AppResult<Json<Value>> {
    if let Some(gpu_service) = &state.gpu_service {
        let metrics = gpu_service.get_metrics().await;
        Ok(Json(json!({
            "status": "ok",
            "enabled": true,
            "active_instances": metrics.active_instances,
            "current_utilization": metrics.current_utilization,
            "monthly_cost_estimate": metrics.monthly_cost_estimate,
            "total_requests": metrics.total_requests,
            "successful_requests": metrics.successful_requests,
            "failed_requests": metrics.failed_requests,
            "average_response_time_ms": metrics.average_response_time_ms
        })))
    } else {
        Ok(Json(json!({
            "status": "disabled",
            "enabled": false,
            "message": "GPU service non configuré (GPU_ENABLED=false ou variables manquantes)"
        })))
    }
}

/// POST /api/gpu/scale - Scaling manuel des instances GPU
pub async fn scale_gpu_instances(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> AppResult<Json<Value>> {
    if let Some(gpu_service) = &state.gpu_service {
        let target_instances =
            payload.get("instances").and_then(|v| v.as_u64()).ok_or_else(|| {
                AppError::BadRequest("Paramètre 'instances' requis (u64)".to_string())
            })?;

        // Vérifier les limites
        let config = gpu_service.get_config();
        if target_instances > config.max_instances as u64 {
            return Err(AppError::BadRequest(format!(
                "Nombre d'instances ({}) dépasse le maximum ({})",
                target_instances, config.max_instances
            )));
        }
        if target_instances < config.min_instances as u64 {
            return Err(AppError::BadRequest(format!(
                "Nombre d'instances ({}) inférieur au minimum ({})",
                target_instances, config.min_instances
            )));
        }

        // TODO: Implémenter le scaling manuel via GCP API
        // Pour l'instant, on retourne un message
        Ok(Json(json!({
            "status": "ok",
            "message": format!("Scaling vers {} instances demandé", target_instances),
            "target_instances": target_instances,
            "note": "Le scaling sera effectué par le système automatique ou via GCP API"
        })))
    } else {
        Err(AppError::Internal("GPU service non configuré".to_string()))
    }
}

/// POST /api/gpu/check-scale - Force une vérification de scaling
pub async fn check_gpu_scale(State(state): State<Arc<AppState>>) -> AppResult<Json<Value>> {
    if let Some(gpu_service) = &state.gpu_service {
        match gpu_service.check_and_scale().await {
            Ok(_) => {
                let metrics = gpu_service.get_metrics().await;
                Ok(Json(json!({
                    "status": "ok",
                    "message": "Vérification de scaling effectuée",
                    "current_instances": metrics.active_instances,
                    "utilization": metrics.current_utilization
                })))
            }
            Err(e) => Err(AppError::Internal(format!("Erreur scaling: {}", e))),
        }
    } else {
        Err(AppError::Internal("GPU service non configuré".to_string()))
    }
}

/// POST /api/gpu/check-budget - Force une vérification de budget
pub async fn check_gpu_budget(State(state): State<Arc<AppState>>) -> AppResult<Json<Value>> {
    if let Some(gpu_service) = &state.gpu_service {
        match gpu_service.check_budget().await {
            Ok(_) => {
                let metrics = gpu_service.get_metrics().await;
                Ok(Json(json!({
                    "status": "ok",
                    "message": "Vérification de budget effectuée",
                    "monthly_cost_estimate": metrics.monthly_cost_estimate,
                    "monthly_budget": gpu_service.get_config().monthly_budget
                })))
            }
            Err(e) => Err(AppError::Internal(format!(
                "Erreur vérification budget: {}",
                e
            ))),
        }
    } else {
        Err(AppError::Internal("GPU service non configuré".to_string()))
    }
}
