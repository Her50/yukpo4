// Contrôleur pour les notifications utilisateur
use crate::{middlewares::jwt::AuthenticatedUser, services::notification_service, state::AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    Extension,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct NotificationsQuery {
    pub limit: Option<i64>,
}

/// Récupérer les notifications d'un utilisateur
pub async fn get_user_notifications(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(query): Query<NotificationsQuery>,
) -> Result<Json<Value>, StatusCode> {
    let limit = query.limit.unwrap_or(50);

    match notification_service::get_user_notifications(&state.pg, user.id, limit).await {
        Ok(notifications) => Ok(Json(json!({
            "success": true,
            "data": notifications
        }))),
        Err(e) => {
            log::error!(
                "[NotificationController] Erreur récupération notifications: {}",
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Compter les notifications non lues
pub async fn count_unread_notifications(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    match notification_service::count_unread_notifications(&state.pg, user.id).await {
        Ok(count) => Ok(Json(json!({
            "success": true,
            "count": count
        }))),
        Err(e) => {
            log::error!(
                "[NotificationController] Erreur comptage notifications: {}",
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Marquer une notification comme lue
pub async fn mark_notification_as_read(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(notification_id): Path<i32>,
) -> Result<Json<Value>, StatusCode> {
    match notification_service::mark_notification_as_read(&state.pg, notification_id, user.id).await
    {
        Ok(true) => Ok(Json(json!({
            "success": true,
            "message": "Notification marquée comme lue"
        }))),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            log::error!(
                "[NotificationController] Erreur marquage notification: {}",
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Marquer toutes les notifications comme lues
pub async fn mark_all_notifications_as_read(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    match notification_service::mark_all_as_read(&state.pg, user.id).await {
        Ok(count) => Ok(Json(json!({
            "success": true,
            "count": count,
            "message": format!("{} notifications marquées comme lues", count)
        }))),
        Err(e) => {
            log::error!(
                "[NotificationController] Erreur marquage toutes notifications: {}",
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Supprimer une notification
pub async fn delete_notification(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(notification_id): Path<i32>,
) -> Result<Json<Value>, StatusCode> {
    match notification_service::delete_notification(&state.pg, notification_id, user.id).await {
        Ok(true) => Ok(Json(json!({
            "success": true,
            "message": "Notification supprimée"
        }))),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            log::error!(
                "[NotificationController] Erreur suppression notification: {}",
                e
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
