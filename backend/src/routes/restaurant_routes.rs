use crate::controllers::restaurant_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::{
    middleware,
    routing::{get, patch, post},
    Router,
};
use std::sync::Arc;

pub fn restaurant_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes publiques (sans authentification)
    let public = Router::new()
        .route(
            "/api/restaurant/partner-code/verify",
            get(restaurant_controller::verify_partner_code_public),
        )
        .route(
            "/api/restaurant/public/list",
            get(restaurant_controller::public_list_restaurants),
        )
        .route(
            "/api/restaurant/public/search",
            get(restaurant_controller::public_search),
        )
        .route(
            "/api/restaurant/public/{service_id}/menu",
            get(restaurant_controller::public_get_menu),
        )
        .with_state(state.clone());

    // Routes client authentifié (commander, suivre, noter, historique)
    let client = Router::new()
        .route(
            "/api/restaurant/public/{service_id}/order",
            post(restaurant_controller::public_create_order),
        )
        .route(
            "/api/restaurant/public/orders/history",
            get(restaurant_controller::client_order_history),
        )
        .route(
            "/api/restaurant/public/orders/validate-qr",
            post(restaurant_controller::validate_delivery_qr),
        )
        .route(
            "/api/restaurant/public/orders/{order_id}/status",
            get(restaurant_controller::get_order_status),
        )
        .route(
            "/api/restaurant/public/orders/{order_id}/rate",
            post(restaurant_controller::rate_order),
        )
        .route(
            "/api/restaurant/public/orders/{order_id}/confirm-arrival",
            post(restaurant_controller::client_confirm_arrival),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state.clone());

    // Routes partenaire (propriétaire du restaurant)
    let protected = Router::new()
        // Dashboard & settings
        .route(
            "/api/restaurant/overview",
            get(restaurant_controller::get_overview),
        )
        .route(
            "/api/restaurant/settings",
            patch(restaurant_controller::patch_settings),
        )
        // Tables & plan de salle
        .route(
            "/api/restaurant/tables",
            get(restaurant_controller::list_tables).post(restaurant_controller::create_table),
        )
        .route(
            "/api/restaurant/tables/{id}",
            patch(restaurant_controller::update_table).delete(restaurant_controller::delete_table),
        )
        .route(
            "/api/restaurant/floor-plan",
            get(restaurant_controller::get_floor_plan).put(restaurant_controller::put_floor_plan),
        )
        // Codes partenaires
        .route(
            "/api/restaurant/partner-code",
            post(restaurant_controller::create_partner_code),
        )
        // Menu items
        .route(
            "/api/restaurant/menu",
            get(restaurant_controller::list_menu_items)
                .post(restaurant_controller::create_menu_item),
        )
        .route(
            "/api/restaurant/menu/{id}",
            patch(restaurant_controller::update_menu_item)
                .delete(restaurant_controller::delete_menu_item),
        )
        // Horaires d'ouverture
        .route(
            "/api/restaurant/opening-hours",
            get(restaurant_controller::get_opening_hours)
                .put(restaurant_controller::put_opening_hours),
        )
        // Commandes (partenaire voit et gère ses commandes)
        .route(
            "/api/restaurant/orders",
            get(restaurant_controller::list_orders).post(restaurant_controller::create_order),
        )
        .route(
            "/api/restaurant/orders/{id}/status",
            patch(restaurant_controller::update_order_status_with_payout),
        )
        .route(
            "/api/restaurant/orders/{id}/mark-no-show",
            post(restaurant_controller::partner_mark_no_show),
        )
        .route(
            "/api/restaurant/financial-summary",
            get(restaurant_controller::get_financial_summary),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state.clone());

    Router::new().merge(public).merge(client).merge(protected)
}
