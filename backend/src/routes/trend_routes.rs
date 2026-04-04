// Routes TrendPulse — Yukpo
// Trends globales, personnalisées, search avancé, forecasting, webhooks

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::trend_controller::{
        dismiss_auto_draft, get_forecast, get_pulse, get_trends_for_me, get_user_context,
        list_auto_drafts, list_regions, publish_auto_draft, search_trends, subscribe_trend_webhook,
    },
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn trend_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes publiques (sans auth)
    let public = Router::new()
        .route("/api/trends/pulse", get(get_pulse))
        .route("/api/trends/search", get(search_trends))
        .route("/api/trends/regions", get(list_regions))
        .route("/api/trends/forecast", get(get_forecast));

    // Routes protégées (auth requise)
    let protected = Router::new()
        .route("/api/trends/for-me", get(get_trends_for_me))
        .route(
            "/api/trends/webhook/subscribe",
            post(subscribe_trend_webhook),
        )
        .route("/api/user/context", get(get_user_context))
        // Auto-drafts tendance
        .route(
            "/api/trends/auto-drafts/{service_id}",
            get(list_auto_drafts),
        )
        .route(
            "/api/trends/auto-drafts/{id}/publish",
            post(publish_auto_draft),
        )
        .route(
            "/api/trends/auto-drafts/{id}/dismiss",
            post(dismiss_auto_draft),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth));

    Router::new().merge(public).merge(protected)
}
