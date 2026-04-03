// Routes distribution produits multi-canaux sociaux
// Facebook/Instagram OAuth, catalogue, règles automatiques, feeds Google Shopping / CSV

use axum::{
    middleware,
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::{
        product_distribution_controller::{
            csv_export_feed, distribute_products, facebook_authorize, facebook_callback,
            get_distribution_history, get_distribution_rules, google_shopping_feed,
            track_distribution_click, update_distribution_rules,
        },
        social_connector_controller::{
            connect_account, get_accounts, instagram_authorize, instagram_callback,
            whatsapp_business_info, youtube_authorize, youtube_callback,
        },
    },
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn social_distribution_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes protégées JWT
    let protected = Router::new()
        // ── Connexion comptes sociaux ──────────────────────────────────────
        // Récupérer la liste des comptes connectés
        .route("/api/social/accounts", get(get_accounts))
        // Connecter un compte manuellement (token externe)
        .route("/api/social/accounts/connect", post(connect_account))
        // OAuth Facebook Page (catalog + posts)
        .route("/api/social/facebook/authorize", get(facebook_authorize))
        // OAuth Instagram Business
        .route("/api/social/instagram/authorize", get(instagram_authorize))
        // OAuth YouTube
        .route("/api/social/youtube/authorize", get(youtube_authorize))
        // WhatsApp Business info (pas d'OAuth individuel)
        .route("/api/social/whatsapp/info", get(whatsapp_business_info))
        // ── Distribution produits ──────────────────────────────────────────
        // Distribuer une sélection de produits vers des plateformes
        .route("/api/social/products/distribute", post(distribute_products))
        // Règles de distribution automatique par service
        .route(
            "/api/social/products/rules/:service_id",
            get(get_distribution_rules).put(update_distribution_rules),
        )
        // Historique et analytics de distribution
        .route(
            "/api/social/products/history/:service_id",
            get(get_distribution_history),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth));

    // Routes publiques (OAuth callbacks + feeds + click tracking)
    let public = Router::new()
        // OAuth callbacks (redirects depuis les plateformes)
        .route("/api/social/facebook/callback", get(facebook_callback))
        .route("/api/social/instagram/callback", get(instagram_callback))
        .route("/api/social/youtube/callback", get(youtube_callback))
        // Tracking clics retour depuis les posts distribués
        .route("/api/social/track", get(track_distribution_click))
        // Feeds produits publics (Google Merchant Center, Jumia, etc.)
        .route(
            "/api/feeds/:partner_id/google.xml",
            get(google_shopping_feed),
        )
        .route("/api/feeds/:partner_id/export.csv", get(csv_export_feed));

    Router::new().merge(protected).merge(public)
}
