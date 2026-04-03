pub mod config;
pub mod controllers;
pub mod core;
pub mod handlers;
pub mod ia;
pub mod metrics;
pub mod middlewares;
pub mod migrations;
pub mod models;
pub mod openapi;
pub mod routers;
pub mod routes;
pub mod services;
pub mod state;
pub mod tasks;
pub mod test_utils;
pub mod utils;
pub mod websocket;
// Modules d'optimisation (temporairement commentés pour compilation)
// pub mod semantic_cache_pro;
// pub mod prompt_optimizer_pro;
// pub mod orchestration_ia_optimized;
use crate::routers::router_yukpo::router_yukpo;
use crate::routes::echange_routes;
#[cfg(feature = "image_search")]
use crate::routes::image_search_routes::image_search_routes;
use crate::routes::whatsapp_routes;
use crate::routes::{
    admin_user_routes::admin_user_routes,
    advanced_analytics_routes::advanced_analytics_routes, // ✅ NOUVEAU: Routes analytics avancés
    advanced_timeline_routes::advanced_timeline_routes, // ✅ NOUVEAU Phase 2: Routes timelines multi-pistes avancées
    // Routes déjà dans router_yukpo mais ajoutées ici pour être explicite
    // ai_chat_routes::ai_chat_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    analytics_routes::analytics_routes,
    app_update_routes::app_update_routes,
    // appliance_model_routes::appliance_model_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    ar_routes::ar_routes, // ✅ NOUVEAU Phase 3.2: Routes pour preview AR/VR
    assurance_routes::assurance_routes, // ✅ NOUVEAU: Routes assurance dédiées (recherche, devis IA, comparaison)
    auth_routes::auth_routes,
    auto_search_routes::auto_search_routes, // ✅ NOUVEAU 2026-03-07: Routes recherche automobile intelligente
    autocomplete_routes::autocomplete_routes,
    bourse_livre_routes::bourse_livre_routes, // ✅ NOUVEAU 2025-01-27: Routes pour upload médias chat vers S3/Wasabi
    chat_reactions_routes::create_chat_reactions_router,
    chat_routes::chat_routes,
    combination_routes::combination_routes,
    content_routes::content_routes,
    // conversation_routes::conversation_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (conversation_routes_merged)
    creator_analytics_routes::creator_analytics_routes, // ✅ NOUVEAU: Routes analytics créateurs
    // ✅ Routes supplémentaires importantes
    debug_routes::debug_routes,
    delivery_external_routes::delivery_external_routes,
    delivery_metrics_routes::delivery_metrics_routes,
    delivery_optimization_routes::delivery_optimization_routes,
    // ✅ Routes critiques ajoutées
    delivery_routes::{delivery_public_routes, delivery_routes},
    diagnostic_routes::diagnostic_routes,
    ecommerce_platform_routes::ecommerce_platform_routes, // ✅ 2026-04-01: Routes e-commerce universel
    embedding_routes::embedding_routes,
    export_routes::export_routes, // ✅ NOUVEAU Phase 2.3: Routes pour jobs d'export vidéo
    extended_audio_routes::extended_audio_routes, // ✅ NOUVEAU Phase 2.2: Routes bibliothèque audio étendue
    feature_flags_routes::feature_flags_routes,   // ✅ NOUVEAU: Routes pour feature flags
    flash_promo_routes::flash_promo_routes, // ✅ NOUVEAU: Routes pour flash promotionnels de produits (gratuit)
    followers_routes::followers_routes, // ✅ NOUVEAU 2026-03-05: Routes pour système de suivi vendeurs
    generative_routes::generative_routes, // ✅ NOUVEAU Phase 3.1: Routes pour génération vidéo IA
    global_promo_routes::global_promo_routes,
    health_routes::health_routes,
    // health_structure_routes::health_structure_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    history_routes::history_routes,
    hotel_financial_routes::hotel_financial_routes, // ✅ 2026-03-17: Routes financières hôtel/meublé
    hotel_group_routes::hotel_group_routes, // ✅ 2026-04-01: Routes groupes, form config, profils clients
    hotel_room_management_routes::hotel_room_management_routes, // ✅ 2026-03-01: Routes gestion hôtels/meublés (chambres, réservations, QR)
    ia_routes::ia_routes,
    kyc_admin_routes::kyc_admin_routes, // ✅ NOUVEAU 2025-01-29: Routes admin KYC
    kyc_webhook_routes::kyc_webhook_routes, // ✅ NOUVEAU 2025-01-29: Routes webhook KYC
    live_ai_routes::live_ai_routes,
    live_routes::live_routes,
    media_routes::media_routes,
    metrics_routes::metrics_routes,
    metrics_tracking_routes::metrics_tracking_routes,
    mobile_logs_routes::mobile_logs_routes,
    navigation_routes::navigation_routes, // ✅ NOUVEAU: Routes pour navigation intelligente
    // nearby_services_routes::nearby_services_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    negotiated_price_routes::negotiated_price_routes,
    notification_routes::notification_routes,
    offres_emploi_routes::offres_emploi_routes, // ✅ NOUVEAU 2025-01-28: Routes offres d'emploi
    order_routes::order_routes,
    orientation_scolaire_routes::orientation_scolaire_routes,
    payment_routes::payment_routes,
    phone_verification_routes::phone_verification_routes, // ✅ NOUVEAU 2026-02-25: Routes vérification OTP téléphone
    // phone_model_routes::phone_model_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    plugin_routes::plugin_routes, // ✅ NOUVEAU Phase 2: Routes gestion des plugins
    popular_products_routes::popular_products_routes,
    prestataire_routes::prestataire_routes,
    product_comments_routes::product_comments_routes, // ✅ NOUVEAU: Routes pour commentaires de produits
    product_lifecycle_routes::product_lifecycle_routes,
    product_reactions_routes::product_reactions_routes,
    products_management::products_management_routes, // ✅ Routes pour gestion des produits (DELETE, PATCH, PUT)
    products_routes::products_routes, // ✅ PHASE 3: Routes pour gestion produits via table service_products
    provider_analytics_routes::provider_analytics_routes,
    publicite_ab_testing_routes::publicite_ab_testing_routes, // ✅ NOUVEAU: Routes A/B testing avancé
    publicite_ai_routes::publicite_ai_routes, // ✅ NOUVEAU: Routes IA pour suggestions publicitaires
    publicite_assets_routes::publicite_assets_routes, // ✅ NOUVEAU: Routes bibliothèque de médias
    publicite_audiences_routes::publicite_audiences_routes, // ✅ NOUVEAU: Routes audiences personnalisées
    publicite_auto_optimization_routes::publicite_auto_optimization_routes, // ✅ NOUVEAU: Routes optimisation automatique
    publicite_pixel_routes::publicite_pixel_routes, // ✅ NOUVEAU: Routes tracking pixel avancé
    push_routes::push_routes,
    recommendation_routes::recommendation_routes,
    restaurant_routes::restaurant_routes,
    // scheduling_search_routes::scheduling_search_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (scheduling_search_routes_merged)
    search_history_routes::search_history_routes,
    service_routes::service_routes,
    // service_team_routes::service_team_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (service_team_routes_merged)
    shopping_routes::shopping_routes,
    social_distribution_routes::social_distribution_routes, // ✅ 2026-04-03: Distribution produits multi-canaux
    // signalement_routes::signalement_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (signalement_routes_merged)
    social_features_routes::social_features_routes, // ✅ NOUVEAU: Routes fonctionnalités sociales avancées
    specialized_services_routes::specialized_services_routes,
    stock_media_routes::stock_media_routes, // ✅ NOUVEAU Phase 2: Routes Stock Media Integration
    studio_routes::studio_routes, // ✅ NOUVEAU: Routes Studio pour création vidéo immersive
    supermarket_routes::supermarket_routes, // ✅ NOUVEAU: Routes supermarché dédiées (produits, comparaison, promotions)
    system_health_routes::system_health_routes,
    token_pack_routes::token_pack_routes,
    token_stats_routes::token_stats_routes,
    universal_search_routes::universal_search_routes, // ✅ 2026-04-01: Recherche universelle cross-services
    upload_routes::upload_routes,                     // ✅ NOUVEAU: Routes upload préalable
    user_routes::user_routes,
    // vehicle_model_routes::vehicle_model_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    video_hls_routes::video_hls_routes,
    video_ml_routes::video_ml_routes, // ✅ NOUVEAU: Routes ML pour recommandations et hashtags
    video_routes::video_routes,       // ✅ NOUVEAU: Routes pour récupération des vidéos utilisateur
    // weather_routes::weather_routes, // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    webhook_routes::webhook_routes,
    webrtc_routes::webrtc_routes,
};
use crate::state::AppState;
use crate::websocket::chat_websocket::create_chat_websocket_router;
use crate::websocket::flash_sale_websocket::create_flash_sale_websocket_router;
use crate::websocket::websocket_handler::create_websocket_router;
use axum::{extract::State, routing::get, Json, Router};
use std::sync::Arc;
use tower_http::compression::CompressionLayer;
use tower_http::services::ServeDir;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
// use crate::routes::fournitures_routes;
async fn healthz() -> &'static str {
    "OK"
}

// ✅ Handler explicite pour apple-app-site-association (sans extension)
async fn serve_apple_association(
) -> Result<axum::response::Response<axum::body::Body>, axum::http::StatusCode> {
    use axum::body::Body;
    use axum::response::Response;
    use std::fs;

    match fs::read_to_string("public/.well-known/apple-app-site-association") {
        Ok(content) => {
            let response = Response::builder()
                .status(200)
                .header("Content-Type", "application/json")
                .header("Cache-Control", "no-cache, no-store, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::from(content))
                .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(response)
        }
        Err(_) => Err(axum::http::StatusCode::NOT_FOUND),
    }
}
// ✅ Handler pour servir le logo Yukpo comme favicon
async fn serve_favicon(
) -> Result<axum::response::Response<axum::body::Body>, axum::http::StatusCode> {
    use axum::body::Body;
    use axum::response::Response;
    use std::fs;

    match fs::read("public/logo.png") {
        Ok(content) => {
            let response = Response::builder()
                .status(200)
                .header("Content-Type", "image/png")
                .header("Cache-Control", "public, max-age=604800")
                .body(Body::from(content))
                .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(response)
        }
        Err(_) => Err(axum::http::StatusCode::NOT_FOUND),
    }
}

pub fn init_logging() {
    let log_format = std::env::var("LOG_FORMAT").unwrap_or_else(|_| "plain".to_string());
    let log_level = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
    let filter = EnvFilter::new(log_level);
    if log_format == "json" {
        tracing_subscriber::registry().with(filter).with(fmt::layer().json()).init();
    } else {
        tracing_subscriber::registry().with(filter).with(fmt::layer()).init();
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
    Ok(Json(
        serde_json::json!({"message": "Service temporairement désactivé"}),
    ))
}
pub fn build_app(state: Arc<AppState>) -> Router {
    // Auth routes (public, pas de JWT)
    let auth = auth_routes(state.clone());
    // User routes (protégées par JWT dans le module)
    let users = user_routes(state.clone());
    // ✅ NOUVEAU: Admin user routes (gestion des rôles utilisateurs)
    let admin_users = admin_user_routes(state.clone());
    // Service routes (protégées par JWT dans le module)
    let services = service_routes(state.clone());
    // Media routes (public ou protégées selon module)
    let media = media_routes(state.clone());
    // ✅ NOUVEAU: Video routes (récupération des vidéos utilisateur)
    let videos = video_routes(state.clone());
    // ✅ NOUVEAU: Video ML routes (recommandations ML et hashtags)
    let video_ml = video_ml_routes(state.clone());
    // ✅ NOUVEAU: Video HLS/DASH routes (qualité adaptative serveur)
    let video_hls = video_hls_routes(state.clone());
    // ✅ NOUVEAU: Advanced analytics routes (heatmaps, A/B testing, cohort analysis)
    let advanced_analytics = advanced_analytics_routes(state.clone());
    // ✅ NOUVEAU: Social features routes (Duet, Remix, Stitch, Réactions)
    let social_features = social_features_routes(state.clone());
    // ✅ 2026-04-03: Distribution produits multi-canaux (Facebook OAuth, catalogue, Google Shopping, CSV)
    let social_distribution = social_distribution_routes(state.clone());
    let creator_analytics = creator_analytics_routes(state.clone());
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
    // ✅ NOUVEAU 2025-01-27 : Routes WebSocket pour chat avec Redis pub/sub
    let chat_websocket = create_chat_websocket_router();
    // ✅ NOUVEAU: Routes WebSocket pour mises à jour temps réel Flash Sales
    let flash_sale_websocket = create_flash_sale_websocket_router();
    // ✅ NOUVEAU: Routes WebSocket pour signaling WebRTC (appels audio/vidéo)
    let webrtc_manager = crate::websocket::create_webrtc_manager();
    let webrtc_signaling_ws = crate::websocket::create_webrtc_router(webrtc_manager);
    let taxi_realtime_metrics =
        crate::routes::taxi_realtime_metrics_routes::create_taxi_realtime_metrics_routes(
            state.clone(),
        );

    // ✅ Routes critiques ajoutées
    let delivery = delivery_routes(state.clone());
    let delivery_public = delivery_public_routes(state.clone());
    let delivery_optimization = delivery_optimization_routes(state.clone()); // ✅ NOUVEAU: Routes optimisation (VRP, ML ETA, AI, Forecasting, Fraud)
    let chat = chat_routes(state.clone());
    let notifications = notification_routes(state.clone());
    let shopping = shopping_routes(state.clone());
    let orders = order_routes(state.clone());
    let restaurant = restaurant_routes(state.clone());
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
    let video_metrics = crate::routes::video_metrics_routes::video_metrics_routes();
    let delivery_metrics = delivery_metrics_routes(state.clone());
    let metrics_tracking = metrics_tracking_routes(state.clone());
    let analytics = analytics_routes(state.clone());
    let provider_analytics = provider_analytics_routes(state.clone());
    let global_promos = global_promo_routes(state.clone());
    let flash_promos = flash_promo_routes(state.clone()); // ✅ NOUVEAU: Routes pour flash promotionnels de produits (gratuit)
    let token_packs = token_pack_routes(state.clone());
    let product_lifecycle = product_lifecycle_routes(state.clone());
    let products_management = products_management_routes(state.clone()); // ✅ NOUVEAU: Routes gestion produits (DELETE, PATCH, PUT)
    let products = products_routes(state.clone()); // ✅ PHASE 3: Routes pour gestion produits via table service_products
    let search_history = search_history_routes(state.clone());
    let specialized_services = specialized_services_routes(state.clone());
    let orientation_scolaire = orientation_scolaire_routes(state.clone());
    let offres_emploi = offres_emploi_routes(state.clone()); // ✅ NOUVEAU 2025-01-28: Routes offres d'emploi
    let bourse_livre = bourse_livre_routes(state.clone()); // ✅ NOUVEAU 2025-01-27: Routes bourse du livre avec IA
    let kyc_webhooks = kyc_webhook_routes(state.clone()); // ✅ NOUVEAU 2025-01-29: Routes webhook KYC
    let kyc_admin = kyc_admin_routes(state.clone()); // ✅ NOUVEAU 2025-01-29: Routes admin KYC
    let mobile_logs = mobile_logs_routes(state.clone());
    let navigation = navigation_routes(state.clone()); // ✅ NOUVEAU: Routes navigation intelligente
    let phone_verification = phone_verification_routes(state.clone()); // ✅ NOUVEAU 2026-02-25: Routes vérification OTP téléphone
    let delivery_external = delivery_external_routes(state.clone());
    let negotiated_prices = negotiated_price_routes(state.clone());
    let health = health_routes(state.clone());
    let system_health = system_health_routes(state.clone());
    // ✅ NOUVEAU 2025-01-27 : Routes pour réactions aux messages (optimisées pour scalabilité)
    let chat_reactions = create_chat_reactions_router();
    // ✅ NOUVEAU 2025-01-27 : Routes pour upload médias chat vers S3/Wasabi
    let chat_media = crate::routes::chat_media_routes::create_chat_media_router();

    // ✅ Routes supplémentaires importantes
    let debug = debug_routes(state.clone());
    // let conversations = conversation_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (conversation_routes_merged)
    // let signalements = signalement_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (signalement_routes_merged)
    // let scheduling_search = scheduling_search_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (scheduling_search_routes_merged)
    // let service_team = service_team_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (service_team_routes_merged)
    let product_reactions = product_reactions_routes(state.clone());
    let product_comments = product_comments_routes(state.clone()); // ✅ NOUVEAU: Routes pour commentaires de produits
    let recommendations = recommendation_routes(); // Ne prend pas state
    let token_stats = token_stats_routes(); // Ne prend pas state
                                            // Routes déjà dans router_yukpo mais ajoutées ici pour être explicite
                                            // let ai_chat = ai_chat_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
                                            // let appliance_models = appliance_model_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    let diagnostics = diagnostic_routes(state.clone());
    // let health_structure = health_structure_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    // let nearby_services = nearby_services_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    // let phone_models = phone_model_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    let popular_products = popular_products_routes(state.clone());
    // let vehicle_models = vehicle_model_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    // let weather = weather_routes(state.clone()); // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
    let publicite_ai = publicite_ai_routes(state.clone()); // ✅ NOUVEAU: Routes IA publicité
    let publicite_audiences = publicite_audiences_routes(state.clone()); // ✅ NOUVEAU: Routes audiences
    let publicite_assets = publicite_assets_routes(state.clone()); // ✅ NOUVEAU: Routes assets
    let publicite_ab_testing = publicite_ab_testing_routes(state.clone()); // ✅ NOUVEAU: Routes A/B testing
    let publicite_auto_optimization = publicite_auto_optimization_routes(state.clone()); // ✅ NOUVEAU: Routes auto optimization
    let publicite_pixel = publicite_pixel_routes(state.clone()); // ✅ NOUVEAU: Routes tracking pixel
    let advanced_timelines = advanced_timeline_routes(state.clone()); // ✅ NOUVEAU Phase 2: Routes timelines multi-pistes avancées
    let extended_audio = extended_audio_routes(state.clone()); // ✅ NOUVEAU Phase 2.2: Routes bibliothèque audio étendue
    let export_routes = export_routes(state.clone()); // ✅ NOUVEAU Phase 2.3: Routes pour jobs d'export vidéo
    let generative_routes = generative_routes(state.clone()); // ✅ NOUVEAU Phase 3.1: Routes pour génération vidéo IA
    let ar_routes = ar_routes(state.clone()); // ✅ NOUVEAU Phase 3.2: Routes pour preview AR/VR
    let stock_media = stock_media_routes(state.clone()); // ✅ NOUVEAU Phase 2: Routes Stock Media Integration
    let plugins = plugin_routes(state.clone()); // ✅ NOUVEAU Phase 2: Routes gestion des plugins
    let studio = studio_routes(state.clone()); // ✅ NOUVEAU: Routes Studio pour création vidéo immersive
    let feature_flags = feature_flags_routes(state.clone()); // ✅ NOUVEAU: Routes pour feature flags (résout 404 mobile)
    let gpu = crate::routes::gpu_routes::gpu_routes(state.clone()); // ✅ NOUVEAU 2026-02-14: Routes pour gestion GPU GCP
    let hotel_management = hotel_room_management_routes(state.clone()); // ✅ 2026-03-01: Routes gestion hôtels/meublés (chambres, réservations, QR)
    let hotel_financial = hotel_financial_routes(state.clone()); // ✅ 2026-03-17: Routes financières hôtel/meublé
    let hotel_groups = hotel_group_routes(state.clone()); // ✅ 2026-04-01: Routes groupes, form config, profils clients
    let assurance = assurance_routes(state.clone()); // ✅ NOUVEAU: Routes assurance dédiées (recherche, devis IA, comparaison)
    let auto_search = auto_search_routes(state.clone()); // ✅ NOUVEAU 2026-03-07: Routes recherche automobile intelligente
    let supermarket = supermarket_routes(state.clone()); // ✅ NOUVEAU: Routes supermarché dédiées (produits, comparaison, promotions)
    let ecommerce_platform = ecommerce_platform_routes(state.clone()); // ✅ 2026-04-01: Routes e-commerce universel
    let universal_search = universal_search_routes(state.clone()); // ✅ 2026-04-01: Recherche universelle cross-services
    let followers = followers_routes(state.clone()); // ✅ NOUVEAU 2026-03-05: Routes pour système de suivi vendeurs

    // ✅ NOUVEAU 2026-03-16: Routes pour le réseau de librairies
    let librairie_network =
        crate::routes::librairie_network_routes::librairie_network_routes(state.clone());
    let paiement_agrege =
        crate::routes::paiement_agrege_routes::paiement_agrege_routes(state.clone());

    let multilingue = crate::routes::multilingue_routes::multilingue_routes(state.clone());

    // ✅ 2026-03-18: Routes taux de change live
    let exchange_rates = Router::new().nest(
        "/api/exchange-rates",
        crate::routes::exchange_rate_routes::exchange_rate_routes(),
    );

    // ✅ NOUVEAU 2026-03-06: Configuration WhatsApp Business
    let whatsapp = whatsapp_routes::create_whatsapp_routes(state.clone());

    // ✅ NOUVEAU: Routes pour page de téléchargement APK test
    let test_routes = crate::routes::test_routes::create_test_routes(state.clone());

    let app_update = app_update_routes(state.clone());

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/health", get(healthz)) // ✅ Route pour ALB health checks
        // ✅ CRITIQUE : Servir les fichiers .well-known pour Universal Links / App Links
        // Route explicite pour apple-app-site-association (sans extension, peut poser problème avec ServeDir)
        .route(
            "/.well-known/apple-app-site-association",
            get(serve_apple_association),
        )
        // ServeDir pour les autres fichiers .well-known (assetlinks.json, etc.)
        .nest_service(
            "/.well-known",
            ServeDir::new("public/.well-known").precompressed_gzip().precompressed_br(),
        )
        // ✅ NOUVEAU: Servir le logo Yukpo pour favicon, og:image fallback, et branding partage
        .nest_service("/logo.png", ServeDir::new("public/logo.png"))
        .route("/favicon.ico", get(serve_favicon))
        .nest("/api", auth)
        .merge(users)
        .merge(admin_users) // ✅ NOUVEAU: Routes admin gestion des rôles
        .merge(services)
        .merge(media)
        .merge(stock_media) // ✅ NOUVEAU Phase 2: Routes Stock Media Integration
        .merge(plugins) // ✅ NOUVEAU Phase 2: Routes gestion des plugins
        .merge(videos) // ✅ NOUVEAU: Routes pour récupération des vidéos utilisateur
        .merge(video_ml) // ✅ NOUVEAU: Routes ML recommandations et hashtags
        .merge(video_hls) // ✅ NOUVEAU: Routes HLS/DASH qualité adaptative
        .merge(advanced_analytics) // ✅ NOUVEAU: Routes analytics avancés
        .merge(social_features) // ✅ NOUVEAU: Routes fonctionnalités sociales avancées
        .merge(social_distribution) // ✅ 2026-04-03: Distribution produits multi-canaux
        .merge(creator_analytics) // ✅ NOUVEAU: Routes analytics créateurs
        .merge(uploads) // ✅ NOUVEAU: Upload préalable de fichiers
        .merge(ia)
        .merge(product_comments) // ✅ DÉPLACÉ: Avant yukpo pour éviter les conflits de routes
        .merge(yukpo)
        .merge(echanges)
        .merge(history)
        .merge(payments)
        .merge(prestataires)
        .merge(image_search)
        .merge(websocket)
        .merge(chat_websocket.with_state(state.clone()))
        .merge(flash_sale_websocket.with_state(state.clone()))
        .merge(webrtc_signaling_ws.with_state(state.clone()))
        .merge(taxi_realtime_metrics)
        // ✅ Routes critiques ajoutées
        .merge(delivery)
        .merge(delivery_public)
        .merge(delivery_optimization) // ✅ NOUVEAU: Routes optimisation
        .merge(chat)
        .merge(notifications)
        .merge(shopping)
        .merge(orders)
        .merge(restaurant)
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
        .merge(video_metrics.with_state(state.clone()))
        .merge(delivery_metrics)
        .merge(metrics_tracking)
        .merge(analytics)
        .merge(provider_analytics)
        .merge(global_promos)
        .merge(flash_promos) // ✅ NOUVEAU: Routes pour flash promotionnels de produits (gratuit)
        .merge(token_packs)
        .merge(product_lifecycle)
        .merge(products_management) // ✅ NOUVEAU: Routes gestion produits (DELETE, PATCH, PUT)
        .merge(products) // ✅ PHASE 3: Routes pour gestion produits via table service_products
        .merge(search_history)
        .merge(specialized_services)
        .merge(orientation_scolaire)
        .merge(offres_emploi) // ✅ NOUVEAU 2025-01-28: Routes offres d'emploi
        .merge(bourse_livre) // ✅ NOUVEAU 2025-01-27: Routes bourse du livre avec IA
        .merge(kyc_webhooks) // ✅ NOUVEAU 2025-01-29: Routes webhook KYC
        .merge(kyc_admin) // ✅ NOUVEAU 2025-01-29: Routes admin KYC
        .merge(advanced_timelines) // ✅ NOUVEAU Phase 2: Routes timelines multi-pistes avancées
        .merge(extended_audio) // ✅ NOUVEAU Phase 2.2: Routes bibliothèque audio étendue
        .merge(export_routes) // ✅ NOUVEAU Phase 2.3: Routes pour jobs d'export vidéo
        .merge(generative_routes) // ✅ NOUVEAU Phase 3.1: Routes pour génération vidéo IA
        .merge(ar_routes) // ✅ NOUVEAU Phase 3.2: Routes pour preview AR/VR
        .merge(studio) // ✅ NOUVEAU: Routes Studio pour création vidéo immersive
        .merge(feature_flags) // ✅ NOUVEAU: Routes pour feature flags (résout 404 mobile)
        .merge(gpu) // ✅ NOUVEAU 2026-02-14: Routes pour gestion GPU GCP
        .merge(hotel_management) // ✅ 2026-03-01: Routes gestion hôtels/meublés (chambres, réservations, QR)
        .merge(hotel_financial) // ✅ 2026-03-17: Routes financières hôtel/meublé
        .merge(hotel_groups) // ✅ 2026-04-01: Routes groupes, form config, profils clients
        .merge(assurance) // ✅ NOUVEAU: Routes assurance dédiées (recherche, devis IA, comparaison)
        .merge(auto_search) // ✅ NOUVEAU 2026-03-07: Routes recherche automobile intelligente
        .merge(supermarket) // ✅ NOUVEAU: Routes supermarché dédiées (produits, comparaison, promotions)
        .merge(ecommerce_platform) // ✅ 2026-04-01: Routes e-commerce universel
        .merge(universal_search) // ✅ 2026-04-01: Recherche universelle cross-services
        .merge(followers) // ✅ NOUVEAU 2026-03-05: Routes pour système de suivi vendeurs
        .merge(librairie_network) // ✅ NOUVEAU 2026-03-16: Routes réseau de librairies
        .merge(paiement_agrege) // ✅ NOUVEAU 2026-03-16: Routes paiements agrégés
        .merge(whatsapp) // ✅ NOUVEAU 2026-03-06: Routes WhatsApp Business API
        .merge(multilingue)
        .merge(exchange_rates) // ✅ 2026-03-18: Routes taux de change live (ExchangeRate-API)
        .merge(test_routes) // ✅ NOUVEAU: Routes pour page de téléchargement APK test
        .merge(app_update) // ✅ NOUVEAU 2026-03-21: Routes vérification mises à jour APK
        .merge(mobile_logs)
        .merge(navigation) // ✅ NOUVEAU: Routes navigation intelligente
        .merge(phone_verification) // ✅ NOUVEAU 2026-02-25: Routes vérification OTP téléphone
        .merge(delivery_external)
        .merge(negotiated_prices)
        .merge(health)
        .merge(system_health)
        .merge(chat_reactions.with_state(state.clone()))
        .merge(chat_media.with_state(state.clone()))
        // ✅ Routes supplémentaires importantes
        .merge(debug)
        // .merge(conversations) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (conversation_routes_merged)
        // .merge(signalements) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (signalement_routes_merged)
        // .merge(scheduling_search) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (scheduling_search_routes_merged)
        // .merge(service_team) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (service_team_routes_merged)
        .merge(product_reactions)
        // ✅ DÉPLACÉ: product_comments est maintenant avant yukpo pour éviter les conflits
        .merge(recommendations)
        .merge(token_stats)
        // Routes déjà dans router_yukpo mais ajoutées ici pour être explicite
        // .merge(ai_chat) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
        // .merge(appliance_models) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
        .merge(diagnostics)
        // .merge(health_structure) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
        // .merge(nearby_services) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
        // .merge(phone_models) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
        .merge(popular_products)
        // .merge(vehicle_models) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
        // .merge(weather) // ⚠️ SUPPRIMÉ: Déjà inclus dans router_yukpo (mobile_routes)
        .merge(publicite_ai) // ✅ NOUVEAU: Routes IA publicité
        .merge(publicite_audiences) // ✅ NOUVEAU: Routes audiences
        .merge(publicite_assets) // ✅ NOUVEAU: Routes assets
        .merge(publicite_ab_testing) // ✅ NOUVEAU: Routes A/B testing
        .merge(publicite_auto_optimization) // ✅ NOUVEAU: Routes auto optimization
        .merge(publicite_pixel) // ✅ NOUVEAU: Routes tracking pixel
        .route(
            "/fournitures/gestion",
            axum::routing::post(fournitures_axum_handler),
        )
        // ✅ Phase 7: Compression gzip/brotli pour réponses volumineuses
        .layer(CompressionLayer::new().gzip(true).br(true))
        .with_state(state);
    // Ajouter les routes WebSocket séparément
    // let app = app.merge(websocket);
    app
}
// In main.rs, call init_logging() before anything else.
// For anti-bruteforce, apply axum::middleware::from_fn(anti_bruteforce) only to /auth/login route in auth_routes.rs.
