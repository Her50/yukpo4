use crate::controllers::app_update_controller::{check_for_updates, get_update_info};
use crate::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn app_update_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/app/update/check", post(check_for_updates))
        .route("/app/update/info", get(get_update_info))
        .with_state(state)
}
