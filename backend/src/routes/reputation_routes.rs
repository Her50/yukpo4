// Routes Reputation Monitoring — Yukpo

use axum::{
    middleware,
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::reputation_controller::{
        get_monitor_config, list_crisis_events, list_mentions, mark_mention_handled,
        mark_mention_read, resolve_crisis, upsert_monitor_config,
    },
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn reputation_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/social-ai/reputation/{service_id}/mentions",
            get(list_mentions),
        )
        .route(
            "/api/social-ai/reputation/mention/{id}/read",
            post(mark_mention_read),
        )
        .route(
            "/api/social-ai/reputation/mention/{id}/handle",
            post(mark_mention_handled),
        )
        .route(
            "/api/social-ai/reputation/{service_id}/crises",
            get(list_crisis_events),
        )
        .route(
            "/api/social-ai/reputation/crisis/{id}/resolve",
            post(resolve_crisis),
        )
        .route(
            "/api/social-ai/reputation/{service_id}/config",
            get(get_monitor_config).put(upsert_monitor_config),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth))
}
