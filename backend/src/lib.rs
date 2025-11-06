pub mod controllers;
pub mod models;
pub mod state;
pub mod core;
pub mod middlewares;
pub mod routes;
pub mod modalities;
pub mod ia;
pub mod services;
pub mod utils;
pub mod routers;
pub mod config;
pub mod tasks;
pub mod openapi;
pub mod test_utils;
pub mod websocket;
pub mod database_setup;
pub mod migrations;
// Modules d'optimisation (temporairement comment?s pour compilation)
// pub mod semantic_cache_pro;
// pub mod prompt_optimizer_pro; 
// pub mod orchestration_ia_optimized;
use std::sync::Arc;
use axum::{
    Router,
    routing::get,
    Json,
    extract::State,
    extract::DefaultBodyLimit,
};
use chrono;
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};
use crate::state::AppState;
use crate::middlewares::cors_middleware;



use crate::routes::{
    auth_routes::auth_routes,
    user_routes::user_routes,
    service_routes::service_routes,
    media_routes::media_routes,
    chat_routes::chat_routes, // ✅ NOUVEAU : Routes de chat
    webrtc_routes::webrtc_routes, // ✅ NOUVEAU : Routes WebRTC
    notification_routes::notification_routes, // ✅ NOUVEAU : Routes de notifications
    push_routes::push_routes, // ✅ NOUVEAU : Routes push
    product_lifecycle_routes::product_lifecycle_routes, // ✅ Routes de gestion du cycle de vie des produits
    recommendation_routes::recommendation_routes, // ✅ NOUVEAU: Routes recommandations
    ia_routes::ia_routes,
    history_routes::history_routes,
    payment_routes::payment_routes,
    prestataire_routes::prestataire_routes,
    webhook_routes::webhook_routes,
    autocomplete_routes::autocomplete_routes, // ✅ NOUVEAU: Routes autocomplete
    search_history_routes::search_history_routes, // ✅ NOUVEAU: Routes historique recherche
    combination_routes::combination_routes, // ✅ NOUVEAU 2025-11-03: Routes progression combinaisons
    debug_routes::debug_routes, // ✅ NOUVEAU 2025-11-06: Routes debug tables
};
#[cfg(feature = "image_search")]
use crate::routes::image_search_routes::image_search_routes;
use crate::routes::echange_routes;
use crate::routers::router_yukpo::router_yukpo;
use crate::websocket::{
    websocket_handler::create_websocket_router,
    webrtc_signaling::{create_webrtc_router, create_webrtc_manager},
};
// use crate::routes::fournitures_routes;
async fn healthz() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "service": "yukpomnang-backend"
    }))
}
pub fn init_logging() {
    // ✅ CORRECTION UTF-8: Forcer l'encodage UTF-8 pour Windows et Linux
    #[cfg(target_os = "windows")]
    {
        use std::io::Write;
        let _ = std::io::stdout().write_all("\u{feff}".as_bytes()); // BOM UTF-8
    }
    
    let log_format = std::env::var("LOG_FORMAT").unwrap_or_else(|_| "plain".to_string());
    let log_level = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
    
    // ✅ Filtrer les logs verbeux des dépendances externes
    let filter = EnvFilter::new(&log_level)
        .add_directive("rustls=warn".parse().unwrap())           // Rustls: seulement warnings et erreurs
        .add_directive("hyper=info".parse().unwrap())            // Hyper: info et au-dessus
        .add_directive("tokio=info".parse().unwrap())            // Tokio: info et au-dessus
        .add_directive("sqlx=warn".parse().unwrap())             // SQLx: seulement warnings
        .add_directive("tower=info".parse().unwrap())            // Tower: info et au-dessus
        .add_directive("h2=info".parse().unwrap())               // HTTP/2: info et au-dessus
        .add_directive("trust_dns_proto=warn".parse().unwrap())  // Trust-DNS: seulement warnings
        .add_directive("trust_dns_resolver=warn".parse().unwrap()); // Trust-DNS resolver: seulement warnings
    
    if log_format == "json" {
        tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer().json().with_target(true).with_thread_ids(false))
            .init();
    } else {
        tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer().with_target(true))
            .init();
    }
    
    log::info!("✅ Logging initialisé (format: {}, niveau: {})", log_format, log_level);
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
    // Configuration CORS
    
    // Vérifier que les tables de paiement existent (en arrière-plan)
    let pool = state.pg.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::database_setup::ensure_payment_tables_exist(&pool).await {
            eprintln!("Erreur lors de la vérification des tables de paiement: {}", e);
        }
    });


    
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
    // Payment routes (prot?g?es par JWT dans le module payment_routes.rs)
    let payments = payment_routes(state.clone());
    // Webhook routes (public, pour recevoir les notifications des providers)
    let webhooks = webhook_routes();
    // Prestataire routes (prot?g?es par JWT)
    let prestataires = prestataire_routes(state.clone());
    // Routes de recherche d'images
    #[cfg(feature = "image_search")]
    let image_search = image_search_routes(state.clone());
    #[cfg(not(feature = "image_search"))]
    let image_search = axum::Router::new();
    // Routes Yukpo (s?par?es pour ?viter les conflits de middleware)
    let yukpo = router_yukpo(state.clone());
    // Routes WebSocket pour le statut en ligne et les notifications
    let websocket = create_websocket_router();
    // Routes WebSocket pour le signaling WebRTC
    let webrtc_manager = create_webrtc_manager();
    let webrtc = create_webrtc_router(webrtc_manager);
    
    // ✅ NOUVEAU : Routes de chat et WebRTC HTTP
    let chat = chat_routes(state.clone());
    let webrtc_http = webrtc_routes(state.clone());
    
    // ✅ NOUVEAU : Routes de notifications (si pas déjà ajoutées)
    let notifications = notification_routes(state.clone());
    let push_notifs = push_routes(state.clone());
    
    // ✅ Routes de gestion du cycle de vie des produits
    let product_lifecycle = product_lifecycle_routes(state.clone());
    
    // ✅ NOUVEAU: Routes autocomplete et historique de recherche
    let autocomplete = autocomplete_routes(state.clone());
    let search_history = search_history_routes(state.clone());
    
    // ✅ NOUVEAU 2025-11-03: Routes progression génération combinaisons
    let combinations = combination_routes(state.clone());
    
    // ✅ NOUVEAU 2025-11-06: Routes debug pour vérification des tables
    let debug = debug_routes(state.clone());
    
    // ✅ Routes des modalités personnalisées (déjà incluses dans router_yukpo)
    // let modalities = modalities::routes::create_modalities_router();
    
    let app = Router::new()
        .route("/", get(|| async { "Yukpomnang Backend API - Service actif" }))
        .route("/healthz", get(healthz))
        .route("/api/health", get(|| async { "API Backend Yukpomnang - Opérationnel" }))
        .merge(auth)
        .merge(users)
        .merge(services)
        .merge(media)
        .merge(ia)
        .merge(yukpo)
        .merge(echanges)
        .merge(history)
        .merge(payments)
        .merge(webhooks)
        .merge(prestataires)
        .merge(image_search)
        .merge(websocket)
        .merge(webrtc)  // WebSocket WebRTC
        .merge(chat)  // ✅ NOUVEAU : Routes de chat HTTP
        .merge(webrtc_http)  // ✅ NOUVEAU : Routes WebRTC HTTP
        .merge(notifications)  // ✅ NOUVEAU : Routes de notifications
        .merge(push_notifs)  // ✅ NOUVEAU : Routes push notifications
        .merge(product_lifecycle)  // ✅ Routes de gestion du cycle de vie des produits
        .merge(autocomplete)  // ✅ NOUVEAU : Routes autocomplete
        .merge(search_history)  // ✅ NOUVEAU : Routes historique recherche
        .merge(combinations)  // ✅ NOUVEAU 2025-11-03: Routes progression génération combinaisons
        .merge(debug)  // ✅ NOUVEAU 2025-11-06: Routes debug tables
        // .merge(modalities)  // ✅ Routes des modalités personnalisées (déjà dans router_yukpo)
        .nest("/api", recommendation_routes())  // ✅ NOUVEAU : Routes recommandations
        .route("/fournitures/gestion", axum::routing::post(fournitures_axum_handler))
        .layer(axum::middleware::from_fn(cors_middleware))  // CORS middleware
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024))  // ✅ CRITIQUE: Augmenter limite à 10MB (de 2MB par défaut)
        .with_state(state);    // Ajouter les routes WebSocket s?par?ment
    // let app = app.merge(websocket);
    app
}
// In main.rs, call init_logging() before anything else.
// For anti-bruteforce, apply axum::middleware::from_fn(anti_bruteforce) only to /auth/login route in auth_routes.rs.

