// ✅ PHASE 3: Routes pour gestion des produits via table service_products
// Date: 2026-01-03

use axum::{
    routing::{delete, get, patch, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::product_stats_controller::{
    get_all_products_stats, get_product_stats, get_product_stats_timeline,
    get_product_stats_visitors,
};
use crate::controllers::products_controller::{
    delete_product, duplicate_product, get_product, get_products_by_service, get_products_by_user,
    get_products_by_user_path, og_placeholder_image, og_product_image, share_product_redirect,
    share_service_redirect, share_tracking_redirect, update_product,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::middleware;

pub fn products_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // GET /api/services/{service_id}/products - Récupérer tous les produits d'un service
        .route(
            "/api/services/{service_id}/products",
            get(get_products_by_service),
        )
        // GET /api/services/{service_id}/products/{product_index} - Récupérer un produit spécifique
        .route(
            "/api/services/{service_id}/products/{product_index}",
            get(get_product),
        )
        // PATCH /api/services/{service_id}/products/{product_index} - Mettre à jour un produit
        .route(
            "/api/services/{service_id}/products/{product_index}",
            patch(update_product).layer(middleware::from_fn_with_state(state.clone(), jwt_auth)),
        )
        // DELETE /api/services/{service_id}/products/{product_index} - Supprimer un produit
        .route(
            "/api/services/{service_id}/products/{product_index}",
            delete(delete_product).layer(middleware::from_fn_with_state(state.clone(), jwt_auth)),
        )
        // POST /api/services/{service_id}/products/{product_index}/duplicate - Dupliquer un produit
        .route(
            "/api/services/{service_id}/products/{product_index}/duplicate",
            post(duplicate_product).layer(middleware::from_fn_with_state(state.clone(), jwt_auth)),
        )
        // GET /api/products?user_id={user_id} - Récupérer tous les produits d'un utilisateur
        .route(
            "/api/products",
            get(get_products_by_user)
                .layer(middleware::from_fn_with_state(state.clone(), jwt_auth)),
        )
        // ✅ ALIAS: /api/products/user/{user_id} (compatibilité mobile)
        .route(
            "/api/products/user/{user_id}",
            get(get_products_by_user_path)
                .layer(middleware::from_fn_with_state(state.clone(), jwt_auth)),
        )
        // ✅ NOUVEAU 2026-03-03: Routes statistiques produit (dashboard prestataire)
        .route(
            "/api/products/{product_id}/stats",
            get(get_product_stats).layer(middleware::from_fn_with_state(state.clone(), jwt_auth)),
        )
        .route(
            "/api/products/{product_id}/stats/timeline",
            get(get_product_stats_timeline)
                .layer(middleware::from_fn_with_state(state.clone(), jwt_auth)),
        )
        .route(
            "/api/products/{product_id}/stats/visitors",
            get(get_product_stats_visitors)
                .layer(middleware::from_fn_with_state(state.clone(), jwt_auth)),
        )
        .route(
            "/api/products/all-stats",
            get(get_all_products_stats)
                .layer(middleware::from_fn_with_state(state.clone(), jwt_auth)),
        )
        // ✅ NOUVEAU: Route publique pour partage intelligent de produits
        // GET /product/:product_id?serviceId=:service_id
        // Détecte le User-Agent et redirige vers l'app si mobile, ou affiche la page web si desktop
        .route("/product/{product_id}", get(share_product_redirect))
        // ✅ NOUVEAU: Route publique pour partage intelligent de services
        .route("/service/{service_id}", get(share_service_redirect))
        // ✅ NOUVEAU: Route publique pour partage de suivi de livraison
        .route("/track/{delivery_id}", get(share_tracking_redirect))
        // ✅ NOUVEAU: Image OG dynamique PNG avec nom + prix + variations (pour WhatsApp/Facebook)
        .route("/api/og-product-image/{product_id}", get(og_product_image))
        // ✅ NOUVEAU: Placeholder OG image dynamique (SVG) quand aucune image produit/service n'existe
        .route("/api/og-placeholder", get(og_placeholder_image))
        .with_state(state)
}
