// ?? src/routes/token_pack_routes.rs

use std::sync::Arc;
use axum::{routing::{get, post}, Router};
use crate::controllers::token_pack_controller::*;
use crate::state::AppState;

pub fn token_pack_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/token_packs", get(list_token_packs))
        .route("/token_packs", post(create_token_pack))
        .with_state(state)
}
