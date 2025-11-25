use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::pharmacy_controller;
use crate::controllers::specialized_services_controller;
use crate::controllers::blood_bank_controller;
use crate::controllers::bus_ticket_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn specialized_services_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Routes Pharmacies (publiques pour recherche, protégées pour création)
        .route(
            "/api/pharmacies/search",
            get(pharmacy_controller::search_pharmacies),
        )
        .route(
            "/api/pharmacies/on-duty",
            get(pharmacy_controller::get_pharmacies_on_duty),
        )
        .route(
            "/api/pharmacies/:id",
            get(pharmacy_controller::get_pharmacy),
        )
        // Routes protégées (création) - middleware appliqué au Router
        .route(
            "/api/pharmacies",
            post(pharmacy_controller::create_pharmacy),
        )
        .route(
            "/api/hopitaux",
            post(specialized_services_controller::create_hospital),
        )
        .route(
            "/api/laboratoires",
            post(specialized_services_controller::create_laboratory),
        )
        .route(
            "/api/agences-voyage",
            post(specialized_services_controller::create_travel_agency),
        )
        .route(
            "/api/covoiturages",
            post(specialized_services_controller::create_covoiturage),
        )
        .route(
            "/api/taxis",
            post(specialized_services_controller::create_taxi),
        )
        // Routes Banques de sang (publiques pour recherche, protégées pour création/modification)
        .route(
            "/api/banques-sang/search",
            get(blood_bank_controller::search_blood_banks),
        )
        .route(
            "/api/banques-sang/:id",
            get(blood_bank_controller::get_blood_bank),
        )
        .route(
            "/api/banques-sang",
            post(blood_bank_controller::create_blood_bank),
        )
        .route(
            "/api/banques-sang/:id/stocks",
            post(blood_bank_controller::update_blood_bank_stocks),
        )
        // Routes Tickets Bus (publiques pour recherche, protégées pour liaison)
        .route(
            "/api/bus-tickets/search",
            get(bus_ticket_controller::search_bus_tickets),
        )
        .route(
            "/api/bus-tickets/:product_id/availability",
            get(bus_ticket_controller::get_seat_availability),
        )
        .route(
            "/api/bus-tickets/link",
            post(bus_ticket_controller::link_bus_product_to_agency),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}

