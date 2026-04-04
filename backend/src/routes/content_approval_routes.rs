// Routes Content Approval — Yukpo

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::content_approval_controller::{
        approve_content, list_approval_history, list_pending_approvals, modify_and_approve,
        reject_content,
    },
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn content_approval_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/social-ai/approval/{service_id}/pending",
            get(list_pending_approvals),
        )
        .route(
            "/api/social-ai/approval/{service_id}/history",
            get(list_approval_history),
        )
        .route(
            "/api/social-ai/approval/{id}/approve",
            post(approve_content),
        )
        .route("/api/social-ai/approval/{id}/reject", post(reject_content))
        .route(
            "/api/social-ai/approval/{id}/modify",
            post(modify_and_approve),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth))
}
