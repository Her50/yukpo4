// ✅ PHASE 3: Routes pour gestion des produits via table service_products
// Date: 2026-01-03

use axum::{
    routing::{delete, get, patch, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::products_controller::{
    delete_product, duplicate_product, get_product, get_products_by_service, get_products_by_user,
    share_product_redirect, update_product,
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
        // ✅ NOUVEAU: Route publique pour partage intelligent de produits
        // GET /product/:product_id?serviceId=:service_id
        // Détecte le User-Agent et redirige vers l'app si mobile, ou affiche la page web si desktop
        .route("/product/{product_id}", get(share_product_redirect))
        .with_state(state)
}
