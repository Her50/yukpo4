// Routes TrendPulse — Yukpo
// Trends globales, tendances personnalisées, contexte utilisateur

use axum::{middleware, routing::get, Router};
use std::sync::Arc;

use crate::{
    controllers::trend_controller::{get_pulse, get_trends_for_me, get_user_context},
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn trend_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Route publique : trends globales (pas besoin d'être connecté)
    let public = Router::new().route("/api/trends/pulse", get(get_pulse));

    // Routes protégées : personnalisées + contexte utilisateur
    let protected = Router::new()
        .route("/api/trends/for-me", get(get_trends_for_me))
        .route("/api/user/context", get(get_user_context))
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth));

    Router::new().merge(public).merge(protected)
}
