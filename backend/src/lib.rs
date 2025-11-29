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
pub mod metrics;
pub mod migrations;
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
    upload_routes::upload_routes, // ✅ NOUVEAU: Routes upload préalable
    ia_routes::ia_routes,
    history_routes::history_routes,
    payment_routes::payment_routes,
    prestataire_routes::prestataire_routes,
    // ✅ Routes critiques ajoutées
    delivery_routes::{delivery_routes, delivery_public_routes},
    chat_routes::chat_routes,
    notification_routes::notification_routes,
    shopping_routes::shopping_routes,
    order_routes::order_routes,
    autocomplete_routes::autocomplete_routes,
    combination_routes::combination_routes,
    content_routes::content_routes,
    embedding_routes::embedding_routes,
    live_routes::live_routes,
    live_ai_routes::live_ai_routes,
    push_routes::push_routes,
    webrtc_routes::webrtc_routes,
    webhook_routes::webhook_routes,
    metrics_routes::metrics_routes,
    delivery_metrics_routes::delivery_metrics_routes,
    metrics_tracking_routes::metrics_tracking_routes,
    analytics_routes::analytics_routes,
    provider_analytics_routes::provider_analytics_routes,
    global_promo_routes::global_promo_routes,
    token_pack_routes::token_pack_routes,
    product_lifecycle_routes::product_lifecycle_routes,
    search_history_routes::search_history_routes,
    specialized_services_routes::specialized_services_routes,
    mobile_logs_routes::mobile_logs_routes,
    delivery_external_routes::delivery_external_routes,
    negotiated_price_routes::negotiated_price_routes,
    health_routes::health_routes,
    system_health_routes::system_health_routes,
    // ✅ Routes supplémentaires importantes
    debug_routes::debug_routes,
    conversation_routes::conversation_routes,
    signalement_routes::signalement_routes,
    scheduling_search_routes::scheduling_search_routes,
    service_team_routes::service_team_routes,
    product_reactions_routes::product_reactions_routes,
    recommendation_routes::recommendation_routes,
    token_stats_routes::token_stats_routes,
    // Routes déjà dans router_yukpo mais ajoutées ici pour être explicite
    ai_chat_routes::ai_chat_routes,
    appliance_model_routes::appliance_model_routes,
    diagnostic_routes::diagnostic_routes,
    health_structure_routes::health_structure_routes,
    nearby_services_routes::nearby_services_routes,
    phone_model_routes::phone_model_routes,
    popular_products_routes::popular_products_routes,
    vehicle_model_routes::vehicle_model_routes,
    weather_routes::weather_routes,
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
    Ok(Json(serde_json::json!({"message": "Service temporairement désactivé"})))
}
pub fn build_app(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Auth routes (public, pas de JWT)
    let auth = auth_routes(state.clone());
    // User routes (protégées par JWT dans le module)
    let users = user_routes(state.clone());
    // Service routes (protégées par JWT dans le module)
    let services = service_routes(state.clone());
    // Media routes (public ou protégées selon module)
    let media = media_routes(state.clone());
    // ✅ NOUVEAU: Upload routes (upload préalable avant création service)
    let uploads = upload_routes(state.clone());
    // IA routes (protégées par JWT dans le module ia_routes.rs)
    let ia = ia_routes(state.clone());
    // Echange routes (protégées par JWT dans le module echange_routes.rs)
    let echanges = echange_routes::echange_routes(state.clone());
    // History routes (protégées par JWT dans le module history_routes.rs)
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
    
    // ✅ Routes critiques ajoutées
    let delivery = delivery_routes(state.clone());
    let delivery_public = delivery_public_routes(state.clone());
    let chat = chat_routes(state.clone());
    let notifications = notification_routes(state.clone());
    let shopping = shopping_routes(state.clone());
    let orders = order_routes(state.clone());
    let autocomplete = autocomplete_routes(state.clone());
    let combinations = combination_routes(state.clone());
    let content = content_routes(state.clone());
    let embeddings = embedding_routes(); // Ne prend pas state
    let live = live_routes(state.clone());
    let live_ai = live_ai_routes(state.clone());
    let push = push_routes(state.clone());
    let webrtc = webrtc_routes(state.clone());
    let webhooks = webhook_routes(); // Ne prend pas state
    let metrics = metrics_routes(state.clone());
    let delivery_metrics = delivery_metrics_routes(state.clone());
    let metrics_tracking = metrics_tracking_routes(state.clone());
    let analytics = analytics_routes(state.clone());
    let provider_analytics = provider_analytics_routes(state.clone());
    let global_promos = global_promo_routes(state.clone());
    let token_packs = token_pack_routes(state.clone());
    let product_lifecycle = product_lifecycle_routes(state.clone());
    let search_history = search_history_routes(state.clone());
    let specialized_services = specialized_services_routes(state.clone());
    let mobile_logs = mobile_logs_routes(state.clone());
    let delivery_external = delivery_external_routes(state.clone());
    let negotiated_prices = negotiated_price_routes(state.clone());
    let health = health_routes(state.clone());
    let system_health = system_health_routes(state.clone());
    
    // ✅ Routes supplémentaires importantes
    let debug = debug_routes(state.clone());
    let conversations = conversation_routes(state.clone());
    let signalements = signalement_routes(state.clone());
    let scheduling_search = scheduling_search_routes(state.clone());
    let service_team = service_team_routes(state.clone());
    let product_reactions = product_reactions_routes(state.clone());
    let recommendations = recommendation_routes(); // Ne prend pas state
    let token_stats = token_stats_routes(); // Ne prend pas state
    // Routes déjà dans router_yukpo mais ajoutées ici pour être explicite
    let ai_chat = ai_chat_routes(state.clone());
    let appliance_models = appliance_model_routes(state.clone());
    let diagnostics = diagnostic_routes(state.clone());
    let health_structure = health_structure_routes(state.clone());
    let nearby_services = nearby_services_routes(state.clone());
    let phone_models = phone_model_routes(state.clone());
    let popular_products = popular_products_routes(state.clone());
    let vehicle_models = vehicle_model_routes(state.clone());
    let weather = weather_routes(state.clone());
    
    let app = Router::new()
        .route("/healthz", get(healthz))
        .merge(auth)
        .merge(users)
        .merge(services)
        .merge(media)
        .merge(uploads) // ✅ NOUVEAU: Upload préalable de fichiers
        .merge(ia)
        .merge(yukpo)
        .merge(echanges)
        .merge(history)
        .merge(payments)
        .merge(prestataires)
        .merge(image_search)
        .merge(websocket)
        // ✅ Routes critiques ajoutées
        .merge(delivery)
        .merge(delivery_public)
        .merge(chat)
        .merge(notifications)
        .merge(shopping)
        .merge(orders)
        .merge(autocomplete)
        .merge(combinations)
        .merge(content)
        .merge(embeddings)
        .merge(live)
        .merge(live_ai)
        .merge(push)
        .merge(webrtc)
        .merge(webhooks)
        .merge(metrics)
        .merge(delivery_metrics)
        .merge(metrics_tracking)
        .merge(analytics)
        .merge(provider_analytics)
        .merge(global_promos)
        .merge(token_packs)
        .merge(product_lifecycle)
        .merge(search_history)
        .merge(specialized_services)
        .merge(mobile_logs)
        .merge(delivery_external)
        .merge(negotiated_prices)
        .merge(health)
        .merge(system_health)
        // ✅ Routes supplémentaires importantes
        .merge(debug)
        .merge(conversations)
        .merge(signalements)
        .merge(scheduling_search)
        .merge(service_team)
        .merge(product_reactions)
        .merge(recommendations)
        .merge(token_stats)
        // Routes déjà dans router_yukpo mais ajoutées ici pour être explicite
        .merge(ai_chat)
        .merge(appliance_models)
        .merge(diagnostics)
        .merge(health_structure)
        .merge(nearby_services)
        .merge(phone_models)
        .merge(popular_products)
        .merge(vehicle_models)
        .merge(weather)
        .route("/fournitures/gestion", axum::routing::post(fournitures_axum_handler))
        .with_state(state);
    // Ajouter les routes WebSocket séparément
    // let app = app.merge(websocket);
    app
}
// In main.rs, call init_logging() before anything else.
// For anti-bruteforce, apply axum::middleware::from_fn(anti_bruteforce) only to /auth/login route in auth_routes.rs.
