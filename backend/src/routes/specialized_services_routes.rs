use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;

use crate::controllers::pharmacy_controller;
use crate::controllers::specialized_services_controller;
use crate::controllers::blood_bank_controller;
use crate::controllers::blood_donation_matching_controller;
use crate::controllers::bus_ticket_controller;
use crate::controllers::bus_ticket_payment_controller;
use crate::controllers::bus_ticket_validation_controller;
use crate::controllers::bus_seat_management_controller;
use crate::controllers::agency_schedule_controller;
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
            "/api/pharmacies/{id}",
            get(pharmacy_controller::get_pharmacy),
        )
        // Routes protégées (création) - middleware appliqué au Router
        .route(
            "/api/pharmacies",
            post(pharmacy_controller::create_pharmacy)
                .get(pharmacy_controller::list_pharmacies), // ✅ Ajout GET
        )
        .route(
            "/api/hopitaux",
            post(specialized_services_controller::create_hospital)
                .get(specialized_services_controller::list_hospitals), // ✅ Ajout GET
        )
        .route(
            "/api/laboratoires",
            post(specialized_services_controller::create_laboratory)
                .get(specialized_services_controller::list_laboratories), // ✅ Ajout GET
        )
        .route(
            "/api/agences-voyage",
            post(specialized_services_controller::create_travel_agency)
                .get(specialized_services_controller::list_travel_agencies), // ✅ Ajout GET
        )
        .route(
            "/api/covoiturages",
            post(specialized_services_controller::create_covoiturage)
                .get(specialized_services_controller::list_covoiturages), // ✅ Ajout GET
        )
        .route(
            "/api/taxis",
            post(specialized_services_controller::create_taxi)
                .get(specialized_services_controller::list_taxis), // ✅ Ajout GET
        )
        // Routes Banques de sang (publiques pour recherche, protégées pour création/modification)
        .route(
            "/api/banques-sang/search",
            get(blood_bank_controller::search_blood_banks),
        )
        .route(
            "/api/banques-sang/{id}",
            get(blood_bank_controller::get_blood_bank),
        )
        .route(
            "/api/banques-sang",
            post(blood_bank_controller::create_blood_bank)
                .get(blood_bank_controller::list_blood_banks), // ✅ Ajout GET
        )
        .route(
            "/api/banques-sang/{id}/stocks",
            post(blood_bank_controller::update_blood_bank_stocks),
        )
        // Routes Tickets Bus (publiques pour recherche, protégées pour liaison)
        .route(
            "/api/bus-tickets/search",
            get(bus_ticket_controller::search_bus_tickets),
        )
        .route(
            "/api/bus-tickets/{product_id}/availability",
            get(bus_ticket_controller::get_seat_availability),
        )
        .route(
            "/api/bus-tickets/create-product",
            post(bus_ticket_controller::create_bus_product),
        )
        .route(
            "/api/bus-tickets/link",
            post(bus_ticket_controller::link_bus_product_to_agency),
        )
        .route(
            "/api/bus-tickets/agency/tickets",
            get(bus_ticket_controller::get_agency_tickets),
        )
        .route(
            "/api/bus-tickets/reservations",
            post(bus_ticket_controller::create_reservations),
        )
        // Routes paiement tickets bus (protégées JWT)
        .route(
            "/api/bus-tickets/payment",
            post(bus_ticket_payment_controller::process_ticket_payment),
        )
        .route(
            "/api/bus-tickets/my-tickets",
            get(bus_ticket_payment_controller::get_user_tickets),
        )
        .route(
            "/api/bus-tickets/ticket/{payment_id}",
            get(bus_ticket_payment_controller::get_ticket_details),
        )
        // Routes validation tickets bus (protégées JWT)
        .route(
            "/api/bus-tickets/validate",
            post(bus_ticket_validation_controller::validate_ticket_qr),
        )
        .route(
            "/api/bus-tickets/boarding/{product_id}/summary",
            get(bus_ticket_validation_controller::get_boarding_summary),
        )
        .route(
            "/api/bus-tickets/boarding/{product_id}/passengers",
            get(bus_ticket_validation_controller::get_bus_passengers_list),
        )
        .route(
            "/api/bus-tickets/validate/manual",
            post(bus_ticket_validation_controller::validate_passenger_manual),
        )
        // Routes gestion places non disponibles (protégées JWT)
        .route(
            "/api/bus-tickets/seats/block",
            post(bus_seat_management_controller::block_seat),
        )
        .route(
            "/api/bus-tickets/seats/unblock",
            post(bus_seat_management_controller::unblock_seat),
        )
        .route(
            "/api/bus-tickets/seats/{product_id}/blocks",
            get(bus_seat_management_controller::get_blocked_seats),
        )
        .route(
            "/api/bus-tickets/seats/{product_id}/availability",
            get(bus_seat_management_controller::get_seat_availability_with_blocks),
        )
        // Routes Système Intelligent Matching Banque de Sang (protégées JWT)
        .route(
            "/api/blood-donation/requests",
            post(blood_donation_matching_controller::create_blood_donation_request),
        )
        .route(
            "/api/blood-donation/requests",
            get(blood_donation_matching_controller::list_active_requests),
        )
        .route(
            "/api/blood-donation/requests/{request_id}/matches",
            get(blood_donation_matching_controller::list_matches_for_request),
        )
        .route(
            "/api/blood-donation/requests/notify",
            post(blood_donation_matching_controller::notify_donors_for_request),
        )
        .route(
            "/api/blood-donation/matches/update-status",
            post(blood_donation_matching_controller::update_match_status),
        )
        .route(
            "/api/blood-donation/donor/update-last-donation",
            post(blood_donation_matching_controller::update_last_donation),
        )
        .route(
            "/api/blood-donation/donor/blood-groups",
            get(blood_donation_matching_controller::get_user_blood_groups),
        )
        .route(
            "/api/blood-donation/donor/blood-group",
            post(blood_donation_matching_controller::create_or_update_blood_group),
        )
        // ✅ NOUVEAU: Routes horaires d'agence (publiques pour consultation, protégées pour gestion)
        .route(
            "/api/bus-tickets/agencies/{agency_id}/schedules",
            get(agency_schedule_controller::get_available_times),
        )
        .route(
            "/api/bus-tickets/agencies/schedules",
            post(agency_schedule_controller::create_schedule),
        )
        .route(
            "/api/bus-tickets/agencies/schedules",
            get(agency_schedule_controller::get_agency_schedules),
        )
        .route(
            "/api/bus-tickets/agencies/schedules/{schedule_id}",
            put(agency_schedule_controller::update_schedule),
        )
        .route(
            "/api/bus-tickets/agencies/schedules/{schedule_id}",
            delete(agency_schedule_controller::delete_schedule),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}

