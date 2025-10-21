use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use sqlx::PgPool;

use crate::controllers::publicite_controller;
use crate::state::AppState;

pub fn publicite_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    let pool = Arc::new(state.pg.clone());
    
    Router::new()
        // Création et gestion
        .route("/create", post(publicite_controller::create_publicite))
        .route("/:id/update", post(publicite_controller::update_publicite))
        .route("/:id", get(publicite_controller::get_publicite_by_id))
        
        // Récupération et affichage
        .route("/actives", get(publicite_controller::get_active_publicites))
        .route("/dashboard", get(publicite_controller::get_publicite_dashboard))
        
        // Tracking analytics
        .route("/track-click", post(publicite_controller::track_publicite_click))
        .route("/track-view", post(publicite_controller::track_publicite_view))
        
        .with_state(pool)
}


