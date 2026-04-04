// Social Analytics Routes — Yukpo
// Dashboard cross-plateformes, sync insights Meta, A/B test, heures optimales

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::social_analytics_controller::{
    evaluate_ab_test, get_best_posting_hours, get_dashboard, recompute_weekly, sync_insights,
};
use crate::state::AppState;

pub fn social_analytics_routes(state: Arc<AppState>) -> Router {
    Router::new()
        // Dashboard global (30j par défaut, ?days=N)
        .route("/api/social-ai/analytics/{service_id}", get(get_dashboard))
        // Synchro insights depuis Meta Graph API
        .route(
            "/api/social-ai/analytics/{service_id}/sync",
            post(sync_insights),
        )
        // A/B test — évaluer deux posts (?post_id_a=X&post_id_b=Y)
        .route(
            "/api/social-ai/analytics/{service_id}/ab-test",
            get(evaluate_ab_test),
        )
        // Meilleures heures de publication
        .route(
            "/api/social-ai/analytics/{service_id}/best-hours",
            get(get_best_posting_hours),
        )
        // Recalcul agrégats hebdomadaires (admin/cron)
        .route(
            "/api/social-ai/analytics/recompute-weekly",
            post(recompute_weekly),
        )
        .with_state(state)
}
