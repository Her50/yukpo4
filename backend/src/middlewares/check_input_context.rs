use axum::{
    body::Body,
    http::Request,
    middleware::Next,
    response::Response,
};
use crate::state::AppState;
use std::sync::Arc;

pub async fn check_input_context(req: Request<Body>, next: Next) -> Response {
    // ? Extraction manuelle du state depuis les extensions
    let state = req
        .extensions()
        .get::<Arc<AppState>>()
        .cloned();

    if let Some(_state) = state {
        // ici tu peux utiliser _state.pg, _state.ia, etc.
        // Exemple : v?rifier qu?un champ obligatoire est bien pr?sent
    } else {
        // Log optionnel
        eprintln!("? AppState non pr?sent dans les extensions.");
    }

    // ? Passe ? la prochaine ?tape de traitement
    next.run(req).await
}
