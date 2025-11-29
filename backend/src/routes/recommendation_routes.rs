use crate::controllers::recommendation_controller::{
    get_fairness_stats, get_mixed_content, get_recommended_products, track_visibility,
};
use crate::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn recommendation_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/produits/recommandes", get(get_recommended_products))
        .route("/content/mixed", get(get_mixed_content))
        .route("/visibility/track", post(track_visibility))
        .route("/api/visibility/track", post(track_visibility)) // ✅ Alias pour compatibilité mobile
        .route("/visibility/stats", get(get_fairness_stats))
}
