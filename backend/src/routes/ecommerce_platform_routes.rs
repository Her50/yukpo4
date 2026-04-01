//! ✅ 2026-04-01: Routes E-Commerce Universel
//!
//! Partenaire (authentifié) :
//! - GET    /api/ecommerce/platforms                        - Types de plateformes supportées
//! - POST   /api/ecommerce/integrations/test-connection     - Tester connexion
//! - POST   /api/ecommerce/integrations                     - Créer intégration
//! - GET    /api/ecommerce/integrations                     - Mes intégrations
//! - DELETE /api/ecommerce/integrations/{id}                - Supprimer intégration
//! - POST   /api/ecommerce/integrations/{id}/sync           - Lancer sync manuelle
//! - GET    /api/ecommerce/integrations/{id}/logs           - Logs de sync
//!
//! Client (public) :
//! - GET    /api/ecommerce/stores                           - Boutiques intégrées
//! - GET    /api/ecommerce/products/search                  - Recherche universelle produits

use crate::controllers::ecommerce_platform_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

pub fn ecommerce_platform_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes publiques (client)
    let public = Router::new()
        .route(
            "/api/ecommerce/platforms",
            get(ecommerce_platform_controller::list_platforms),
        )
        .route(
            "/api/ecommerce/stores",
            get(ecommerce_platform_controller::list_stores),
        )
        .route(
            "/api/ecommerce/products/search",
            get(ecommerce_platform_controller::universal_product_search),
        );

    // Routes authentifiées (partenaire)
    let authenticated = Router::new()
        .route(
            "/api/ecommerce/integrations/test-connection",
            post(ecommerce_platform_controller::test_connection),
        )
        .route(
            "/api/ecommerce/integrations",
            post(ecommerce_platform_controller::create_integration)
                .get(ecommerce_platform_controller::list_my_integrations),
        )
        .route(
            "/api/ecommerce/integrations/{id}",
            delete(ecommerce_platform_controller::delete_integration),
        )
        .route(
            "/api/ecommerce/integrations/{id}/sync",
            post(ecommerce_platform_controller::sync_integration),
        )
        .route(
            "/api/ecommerce/integrations/{id}/logs",
            get(ecommerce_platform_controller::get_sync_logs),
        )
        .layer(middleware::from_fn(jwt_auth));

    Router::new().merge(public).merge(authenticated).with_state(state)
}
