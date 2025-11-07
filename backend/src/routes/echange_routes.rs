use crate::controllers::echange_controller::{
    creer_echange, get_echange_status, relancer_matching,
};
use crate::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn echange_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/echanges", post(creer_echange))
        .route("/echanges/{id}/status", get(get_echange_status))
        .route("/echanges/relancer-matching", post(relancer_matching))
        .with_state(state)
}
