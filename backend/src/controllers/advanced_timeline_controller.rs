// ✅ NOUVEAU Phase 2: Contrôleur pour timelines multi-pistes avancées

use axum::{
    extract::{Extension, Path as AxumPath, Query, State},
    http::StatusCode,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    models::advanced_timeline_model::{
        AdvancedTimelineRequest, AdvancedTimelineResponse, AdvancedTimelineRow,
    },
    services::advanced_timeline_service::AdvancedTimelineService,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct TimelineListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Crée une nouvelle timeline avancée
pub async fn create_timeline(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(request): Json<AdvancedTimelineRequest>,
) -> AppResult<Json<AdvancedTimelineResponse>> {
    let service = AdvancedTimelineService::new(state.pg.clone());

    let timeline_row = service.create_timeline(user.id, request).await?;

    Ok(Json(AdvancedTimelineResponse {
        success: true,
        timeline: timeline_row,
        message: Some("Timeline créée avec succès".to_string()),
    }))
}

/// Récupère une timeline par ID
pub async fn get_timeline(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    AxumPath(timeline_id): AxumPath<String>,
) -> AppResult<Json<serde_json::Value>> {
    let service = AdvancedTimelineService::new(state.pg.clone());

    match service.get_timeline(&timeline_id, Some(user.id)).await? {
        Some(timeline) => Ok(Json(serde_json::json!({
            "success": true,
            "timeline": timeline,
        }))),
        None => Err(AppError::NotFound(format!(
            "Timeline '{}' non trouvée",
            timeline_id
        ))),
    }
}

/// Liste les timelines de l'utilisateur
pub async fn list_timelines(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(query): Query<TimelineListQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let service = AdvancedTimelineService::new(state.pg.clone());

    let (timelines, total) = service
        .list_timelines(user.id, query.limit, query.offset)
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "timelines": timelines,
        "total": total,
        "limit": query.limit.unwrap_or(50),
        "offset": query.offset.unwrap_or(0),
    })))
}

/// Met à jour une timeline
pub async fn update_timeline(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    AxumPath(timeline_id): AxumPath<String>,
    Json(request): Json<AdvancedTimelineRequest>,
) -> AppResult<Json<AdvancedTimelineResponse>> {
    let service = AdvancedTimelineService::new(state.pg.clone());

    let timeline_row = service
        .update_timeline(&timeline_id, user.id, request)
        .await?;

    Ok(Json(AdvancedTimelineResponse {
        success: true,
        timeline: timeline_row,
        message: Some("Timeline mise à jour avec succès".to_string()),
    }))
}

/// Supprime une timeline
pub async fn delete_timeline(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    AxumPath(timeline_id): AxumPath<String>,
) -> AppResult<Json<serde_json::Value>> {
    let service = AdvancedTimelineService::new(state.pg.clone());

    let deleted = service.delete_timeline(&timeline_id, user.id).await?;

    if deleted {
        Ok(Json(serde_json::json!({
            "success": true,
            "message": "Timeline supprimée avec succès",
        })))
    } else {
        Err(AppError::NotFound(format!(
            "Timeline '{}' non trouvée",
            timeline_id
        )))
    }
}
