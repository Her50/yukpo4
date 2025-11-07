// ?? src/routes/token_pack_routes.rs

use crate::controllers::token_pack_controller::*;
use crate::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn token_pack_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/token_packs", get(list_token_packs))
        .route("/token_packs", post(create_token_pack))
        .with_state(state)
}
