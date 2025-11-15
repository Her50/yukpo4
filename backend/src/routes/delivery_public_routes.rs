use std::sync::Arc;

use axum::Router;

use crate::state::AppState;

pub fn delivery_public_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    super::delivery_routes::delivery_public_routes(state)
}
