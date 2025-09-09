use std::sync::Arc;
use axum::{
    routing::{post, get},
    Router,
};

use crate::{
    controllers::ia_controller::{analyze_behavior, predict_ia, enrichir_contexte_ia, analyze_text_input},
    controllers::ia_status_controller::get_ia_status,
    middlewares::jwt::jwt_auth,
    state::AppState,
};



/// ?? Routes centralis?es pour toutes les fonctionnalit?s IA
pub fn ia_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes IA prot?g?es par JWT
    Router::<Arc<AppState>>::new()
        // ?? Analyse comportementale (IP, path, fr?quence)
        .route("/api/ia/score", post(analyze_behavior))
        // ?? Pr?diction texte simple via moteur IA
        .route("/api/ia/predict", post(predict_ia))
        // ?? Enrichissement du contexte
        .route("/api/ia/context", post(enrichir_contexte_ia))
        // ?? Statistiques d'usage des moteurs IA
        .route("/api/ia/status", get(get_ia_status))
        // ?? Analyse de texte pour le frontend (ChatInputPanel)
        .route("/api/ia/analyze", post(analyze_text_input))
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}
