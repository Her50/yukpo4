pub mod controllers;
pub mod models;
pub mod state;
pub mod core;
pub mod middlewares;
pub mod routes;
pub mod ia;
pub mod services;
pub mod utils;
pub mod routers;
pub mod config;
pub mod tasks;
pub mod openapi;
pub mod test_utils;
pub mod websocket;

// Modules d'optimisation (temporairement commentés pour compilation)
// pub mod semantic_cache_pro;
// pub mod prompt_optimizer_pro; 
// pub mod orchestration_ia_optimized;

use std::sync::Arc;

use axum::{
    Router,
    routing::get,
    Json,
    extract::State,
};
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

use crate::state::AppState;
use crate::routes::{
    auth_routes::auth_routes,
    user_routes::user_routes,
    service_routes::service_routes,
    media_routes::media_routes,
    ia_routes::ia_routes,
    history_routes::history_routes,
    payment_routes::payment_routes,
    prestataire_routes::prestataire_routes,
};
#[cfg(feature = "image_search")]
use crate::routes::image_search_routes::image_search_routes;
use crate::routes::echange_routes;
use crate::routers::router_yukpo::router_yukpo;
use crate::websocket::websocket_handler::create_websocket_router;
// use crate::routes::fournitures_routes;

async fn healthz() -> &'static str {
    "OK"
}

pub fn init_logging() {
    let log_format = std::env::var("LOG_FORMAT").unwrap_or_else(|_| "plain".to_string());
    let log_level = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
    let filter = EnvFilter::new(log_level);
    if log_format == "json" {
        tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer().json())
            .init();
    } else {
        tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer())
            .init();
    }
}

// Handler Axum compatible pour la gestion intelligente des fournitures scolaires
async fn fournitures_axum_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    // use crate::services::fournitures_service::gestion_fournitures_scolaires;
    let _user_id = payload.get("user_id").and_then(|v| v.as_i64()).map(|v| v as i32);
    let _pool = &state.pg;
    // match gestion_fournitures_scolaires(user_id, &payload, pool).await {
    //     Ok(res) => Ok(Json(res)),
    //     Err(e) => {
    //         // Si c'est une erreur de validation, retourne 400 avec le message
    //         if let crate::core::types::AppError::BadRequest(_msg) = &e {
    //             return Err(axum::http::StatusCode::BAD_REQUEST);
    //         }
    //         Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
    //     }
    // }
    Ok(Json(serde_json::json!({"message": "Service temporairement d?sactiv?"})))
}

pub fn build_app(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Auth routes (public, pas de JWT)
    let auth = auth_routes(state.clone());
    // User routes (prot?g?es par JWT dans le module)
    let users = user_routes(state.clone());
    // Service routes (prot?g?es par JWT dans le module)
    let services = service_routes(state.clone());
    // Media routes (public ou prot?g?es selon module)
    let media = media_routes(state.clone());
    // IA routes (prot?g?es par JWT dans le module ia_routes.rs)
    let ia = ia_routes(state.clone());
    // Echange routes (prot?g?es par JWT dans le module echange_routes.rs)
    let echanges = echange_routes::echange_routes(state.clone());
    // History routes (prot?g?es par JWT dans le module history_routes.rs)
    let history = history_routes();
    // Payment routes (protégées par JWT dans le module payment_routes.rs)
    let payments = payment_routes(state.clone());

    // Prestataire routes (protégées par JWT)
    let prestataires = prestataire_routes(state.clone());

    // Routes de recherche d'images
    #[cfg(feature = "image_search")]
    let image_search = image_search_routes(state.clone());
    #[cfg(not(feature = "image_search"))]
    let image_search = axum::Router::new();

    // Routes Yukpo (séparées pour éviter les conflits de middleware)
    let yukpo = router_yukpo(state.clone());

    // Routes WebSocket pour le statut en ligne et les notifications
    let websocket = create_websocket_router();

    let app = Router::new()
        .route("/healthz", get(healthz))
        .merge(auth)
        .merge(users)
        .merge(services)
        .merge(media)
        .merge(ia)
        .merge(yukpo)
        .merge(echanges)
        .merge(history)
        .merge(payments)
        .merge(prestataires)
        .merge(image_search)
        .merge(websocket)
        .route("/fournitures/gestion", axum::routing::post(fournitures_axum_handler))
        .with_state(state);
    
    // Ajouter les routes WebSocket séparément
    // let app = app.merge(websocket);

    app
}

// In main.rs, call init_logging() before anything else.
// For anti-bruteforce, apply axum::middleware::from_fn(anti_bruteforce) only to /auth/login route in auth_routes.rs.
