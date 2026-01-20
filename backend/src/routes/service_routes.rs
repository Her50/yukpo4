// ?? src/routes/service_routes.rs

use axum::{
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

use crate::controllers::service_controller::{
    creer_service, filter_services, get_last_service_for_user, get_my_services,
    get_related_services, get_services_by_user_id, get_services_list, get_services_recent, get_shared_service, insert_user,
    reactivate_service,
};
use crate::middlewares::jwt::jwt_auth;
use crate::middlewares::request_size_limit::request_size_limit;
use crate::state::AppState;
use axum::middleware;

pub fn service_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // ✅ Routes publiques (sans authentification)
    let public_routes = Router::new()
        .route("/services/shared/{id}", get(get_shared_service))
        // ✅ NOUVEAU 2026-01-20: Endpoint public pour récupérer les services d'un utilisateur (boutique prestataire)
        .route("/services/user/{user_id}", get(get_services_by_user_id))
        .with_state(state.clone());
    
    // ✅ Routes protégées (avec authentification JWT)
    let protected_routes = Router::new()
        // ✅ NOUVEAUX endpoints pour liste et services récents
        .route("/services", get(get_services_list))
        .route("/services/recent", get(get_services_recent))
        .route("/services/my-services", get(get_my_services))
        // ✅ CORRECTION 2025-12-01: Limite augmentée à 50 MB pour supporter les médias base64 volumineux
        // Note: Le client mobile envoie encore des médias en base64 (rétrocompatibilité)
        // TODO: Migrer vers upload préalable pour réduire la taille des payloads
        .route(
            "/services/create",
            post(creer_service)
                .layer(
                    axum::extract::DefaultBodyLimit::max(50_000_000), // ✅ 50 MB - pour supporter médias base64 volumineux
                )
                .layer(middleware::from_fn(request_size_limit)),
        )
        .route("/services/filter", get(filter_services))
        .route("/services/related/{id}", get(get_related_services))
        .route("/services/last", get(get_last_service_for_user))
        .route(
            "/services/reactivate/{service_id}/{user_id}",
            put(reactivate_service),
        )
        .route("/services/insert_user", post(insert_user))
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state.clone());
    
    // ✅ Fusionner les routes publiques et protégées
    public_routes.merge(protected_routes)
}
