use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use crate::controllers::recommendation_controller::{
    get_recommended_products,
    get_mixed_content,
    track_visibility,
    get_fairness_stats,
};
use crate::state::AppState;

pub fn recommendation_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/produits/recommandes", get(get_recommended_products))
        .route("/content/mixed", get(get_mixed_content))
        .route("/visibility/track", post(track_visibility))
        .route("/visibility/stats", get(get_fairness_stats))
}

