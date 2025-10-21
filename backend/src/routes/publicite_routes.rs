use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::state::AppState;

// Les routes de publicité sont intégrées directement sans Router séparé
pub fn publicite_routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Pas de routes ici, elles sont ajoutées dans router_yukpo directement
}


