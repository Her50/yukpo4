// ✅ 2026-04-01: Routes groupes multi-biens hôtel/meublé, form config et profils clients

use crate::controllers::hotel_group_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

pub fn hotel_group_routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // === Groupes multi-propriétés ===
        .route(
            "/api/hotel/groups",
            post(hotel_group_controller::create_property_group)
                .get(hotel_group_controller::list_my_groups),
        )
        .route(
            "/api/hotel/groups/{group_id}",
            get(hotel_group_controller::get_group_details)
                .put(hotel_group_controller::update_property_group)
                .delete(hotel_group_controller::delete_property_group),
        )
        .route(
            "/api/hotel/groups/{group_id}/members",
            post(hotel_group_controller::add_property_to_group),
        )
        .route(
            "/api/hotel/groups/{group_id}/members/{property_id}",
            delete(hotel_group_controller::remove_property_from_group),
        )
        .route(
            "/api/hotel/groups/{group_id}/financial",
            get(hotel_group_controller::get_group_financial_overview),
        )
        // === Formulaires client personnalisés ===
        .route(
            "/api/hotel/properties/{property_id}/form-config",
            get(hotel_group_controller::get_form_config)
                .put(hotel_group_controller::upsert_form_config),
        )
        // === Profils clients sauvegardés ===
        .route(
            "/api/hotel/client-profile",
            get(hotel_group_controller::get_client_profile)
                .put(hotel_group_controller::save_client_profile),
        )
        // Middleware JWT pour toutes les routes
        .layer(middleware::from_fn(jwt_auth))
}
