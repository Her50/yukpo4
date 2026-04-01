// ✅ NOUVEAU 2026-01-27: Routes pour gestion des chambres/unités hôtels et meublés
// Corrigé 2026-03-01: Routes effectivement montées dans le routeur (étaient manquantes)

use crate::controllers::hotel_room_management_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

pub fn hotel_room_management_routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // === Routes protégées (JWT requis) ===
        // Propriétés gérées par l'utilisateur
        .route(
            "/api/hotel/my-properties",
            get(hotel_room_management_controller::get_my_properties),
        )
        // Réservations
        .route(
            "/api/hotel/reservations/my",
            get(hotel_room_management_controller::get_my_reservations),
        )
        .route(
            "/api/hotel/reservations/manual",
            post(hotel_room_management_controller::create_manual_reservation),
        )
        .route(
            "/api/hotel/reservations/request",
            post(hotel_room_management_controller::request_hotel_reservation),
        )
        .route(
            "/api/hotel/reservations/scan-qr",
            post(hotel_room_management_controller::scan_reservation_qr),
        )
        .route(
            "/api/hotel/reservations/{reservation_id}/qr-codes",
            get(hotel_room_management_controller::get_reservation_qr_codes),
        )
        .route(
            "/api/hotel/reservations/{reservation_id}/check-in",
            post(hotel_room_management_controller::check_in_reservation),
        )
        .route(
            "/api/hotel/reservations/{reservation_id}/check-out",
            post(hotel_room_management_controller::check_out_reservation),
        )
        .route(
            "/api/hotel/reservations/{reservation_id}/guest-qr",
            post(hotel_room_management_controller::generate_guest_qr),
        )
        // Paiement réservation (avance ou solde complet)
        .route(
            "/api/hotel/reservations/{reservation_id}/pay",
            post(hotel_room_management_controller::pay_hotel_reservation),
        )
        // Blocages manuels
        .route(
            "/api/hotel/blockages/manual",
            post(hotel_room_management_controller::create_manual_blockage),
        )
        .route(
            "/api/hotel/blockages/{blockage_id}",
            delete(hotel_room_management_controller::delete_blockage),
        )
        .route(
            "/api/hotel/properties/{property_id}/blockages/manual",
            get(hotel_room_management_controller::list_manual_blockages),
        )
        // Inventaire unités/chambres
        .route(
            "/api/hotel/properties/{property_id}/units",
            get(hotel_room_management_controller::list_property_units)
                .post(hotel_room_management_controller::create_property_unit),
        )
        .route(
            "/api/hotel/units/{unit_id}",
            axum::routing::put(hotel_room_management_controller::update_property_unit)
                .delete(hotel_room_management_controller::delete_property_unit),
        )
        .route(
            "/api/hotel/properties/{property_id}/units/available",
            get(hotel_room_management_controller::list_available_units_for_dates),
        )
        .route(
            "/api/hotel/properties/{property_id}/units/plan",
            get(hotel_room_management_controller::get_units_plan_status),
        )
        // IA tarification et insights
        .route(
            "/api/hotel/units/{unit_id}/ai-pricing",
            post(hotel_room_management_controller::ai_unit_pricing),
        )
        .route(
            "/api/hotel/properties/{property_id}/ai-pricing",
            post(hotel_room_management_controller::ai_property_pricing),
        )
        .route(
            "/api/hotel/properties/{property_id}/ai-insights",
            get(hotel_room_management_controller::get_property_ai_insights),
        )
        // Annulation et pénalités
        .route(
            "/api/hotel/reservations/{reservation_id}/cancel",
            post(hotel_room_management_controller::cancel_hotel_reservation),
        )
        .route(
            "/api/hotel/cancellations/history",
            get(hotel_room_management_controller::get_cancellation_history),
        )
        // Middleware JWT pour toutes les routes
        .layer(middleware::from_fn(jwt_auth))
}
