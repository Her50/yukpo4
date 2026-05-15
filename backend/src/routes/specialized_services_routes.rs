use axum::{
    middleware,
    routing::{delete, get, patch, post, put},
    Router,
};
use std::sync::Arc;

use crate::controllers::agency_schedule_controller;
use crate::controllers::blood_bank_controller;
use crate::controllers::blood_donation_matching_controller;
use crate::controllers::bus_return_trip_controller;
use crate::controllers::bus_seat_management_controller;
use crate::controllers::bus_ticket_controller;
use crate::controllers::bus_ticket_credit_controller;
use crate::controllers::bus_ticket_payment_controller;
use crate::controllers::bus_ticket_rating_controller;
use crate::controllers::bus_ticket_validation_controller;
use crate::controllers::drive_import_controller;
use crate::controllers::livres_scolaires_controller;
use crate::controllers::menu_planning_controller;
use crate::controllers::pharmacy_controller;
use crate::controllers::pharmacy_product_controller;
use crate::controllers::specialized_chat_controller;
use crate::controllers::specialized_payment_controller;
use crate::controllers::specialized_rating_controller;
use crate::controllers::specialized_reservation_controller;
use crate::controllers::specialized_services_controller;
use crate::controllers::specialized_services_unified_controller;
use crate::controllers::taxi_analytics_controller; // ✅ NOUVEAU 2025-01-29: Analytics dashboard (Leadership 100%)
use crate::controllers::taxi_dynamic_pricing_controller; // ✅ NOUVEAU 2025-01-29: Prix dynamique IA (Leadership 100%)
use crate::controllers::taxi_leadership_controller; // ✅ NOUVEAU 2025-01-29: Leadership
use crate::controllers::taxi_recommendations_controller; // ✅ NOUVEAU 2025-01-29: Recommandations
use crate::controllers::taxi_ride_controller; // ✅ 2026-04-01: Tarif GPS + accept/refuse + commission
use crate::controllers::taxi_route_optimization_controller; // ✅ NOUVEAU 2025-01-29: Optimisation routes
use crate::controllers::troc_livres_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn specialized_services_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // ✅ Phase 7: Séparer routes publiques et protégées
    let public_routes = Router::new()
        // ✅ Phase 1: Routes publiques Taxi et Covoiturage (SANS JWT)
        .route(
            "/api/taxis",
            get(specialized_services_controller::list_taxis_public),
        )
        .route(
            "/api/taxis/search",
            get(specialized_services_controller::search_taxis),
        )
        // ✅ 2026-04-01: Estimation tarifaire publique (sans auth — passager peut voir le prix avant de se connecter)
        .route(
            "/api/taxis/estimate-fare",
            get(taxi_ride_controller::estimate_fare),
        )
        .route(
            "/api/taxis/{id}",
            get(specialized_services_controller::get_taxi_details),
        )
        // ✅ NOUVEAU: Notations chauffeur publiques
        .route(
            "/api/drivers/{driver_id}/ratings/{service_type}",
            get(specialized_services_controller::get_driver_ratings),
        )
        // ✅ NOUVEAU 2026-04-01: Suivi partagé public (sans auth)
        .route(
            "/api/track/{token}",
            get(specialized_services_controller::get_public_trip_data),
        )
        .route(
            "/api/covoiturages",
            get(specialized_services_controller::list_covoiturages_public),
        )
        .route(
            "/api/covoiturages/search",
            get(specialized_services_controller::search_covoiturages),
        )
        .route(
            "/api/covoiturages/nearby",
            get(specialized_services_controller::search_covoiturages_nearby),
        )
        .route(
            "/api/covoiturages/{id}",
            get(specialized_services_controller::get_covoiturage_details),
        )
        .route(
            "/api/covoiturages/{id}/reviews",
            get(specialized_services_controller::get_covoiturage_reviews),
        )
        // ✅ Phase 1: Routes publiques Hôpitaux et Laboratoires
        .route(
            "/api/hopitaux/search",
            get(specialized_services_controller::search_hospitals),
        )
        .route(
            "/api/hopitaux/{id}",
            get(specialized_services_controller::get_hospital_details),
        )
        // ✅ NOUVEAU: Autocomplete et IA pour hôpitaux
        .route(
            "/api/hopitaux/services/autocomplete",
            get(specialized_services_controller::autocomplete_medical_services),
        )
        .route(
            "/api/hopitaux/ai/search-pathology",
            post(specialized_services_controller::search_pathology_hospital),
        )
        .route(
            "/api/laboratoires/search",
            get(specialized_services_controller::search_laboratories),
        )
        .route(
            "/api/laboratoires/{id}",
            get(specialized_services_controller::get_laboratory_details),
        )
        // ✅ NOUVEAU: Routes publiques Agences de voyage
        .route(
            "/api/agences-voyage/search",
            get(specialized_services_controller::search_travel_agencies),
        )
        .route(
            "/api/agences-voyage/{id}",
            get(specialized_services_controller::get_travel_agency_details),
        )
        // Routes Pharmacies (publiques pour recherche)
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
        .route(
            "/api/medicines/nearby",
            get(pharmacy_product_controller::search_nearby_medicines),
        )
        // ✅ Ordonnance IA: extraction médicaments par vision + recherche pharmacies par matching
        // ✅ FIX 2026-04-04: DefaultBodyLimit augmenté à 20 MB — image base64 d'ordonnance peut dépasser 6 MB
        .route(
            "/api/pharmacies/ai/extract-ordonnance",
            post(pharmacy_product_controller::extract_ordonnance)
                .layer(axum::extract::DefaultBodyLimit::max(20_000_000)), // 20 MB
        )
        .route(
            "/api/pharmacies/search-by-medications",
            post(pharmacy_product_controller::search_by_medications),
        )
        // Endpoints IA pharmacie — PUBLICS pour permettre à un utilisateur
        // non authentifié d'utiliser la PWA (recherche médicament, scan
        // ordonnance/boîte). Le rate-limit middleware s'applique à tout le
        // router pour éviter l'abus de tokens IA.
        .route(
            "/api/pharmacies/ai/interactions",
            post(specialized_services_controller::check_medication_interactions),
        )
        .route(
            "/api/pharmacies/ai/dosage",
            post(specialized_services_controller::suggest_medication_dosage),
        )
        .route(
            "/api/pharmacies/ai/alternatives",
            post(specialized_services_controller::suggest_medication_alternatives),
        )
        // Router LLM pour la search bar : classifie l'intention (médicament,
        // symptôme, question, chat libre) et retourne la requête reformulée.
        .route(
            "/api/pharmacies/ai/route-intent",
            post(specialized_services_controller::route_text_intent),
        )
        // Log de consentement utilisateur — endpoint PUBLIC (l'utilisateur
        // peut accepter avant de se créer un compte). Si JWT présent, on
        // associe le consent à l'user_id ; sinon on garde seulement ip_hash.
        .route(
            "/api/pharmacies/consent",
            post(specialized_services_controller::pharmacie_consent_log),
        )
        // Workflow "Demande de disponibilité" (RFQ pharmacie) — PUBLIC pour
        // permettre à un utilisateur non connecté de demander des médicaments.
        // Migration : 20260514_003.
        .route(
            "/api/medication-alerts",
            post(specialized_services_controller::create_medication_alert),
        )
        .route(
            "/api/medication-alerts/{id}",
            get(specialized_services_controller::get_medication_alert),
        )
        // Routes Banques de sang (publiques pour recherche)
        .route(
            "/api/banques-sang/search",
            get(blood_bank_controller::search_blood_banks),
        )
        .route(
            "/api/banques-sang/{id}",
            get(blood_bank_controller::get_blood_bank),
        )
        // Routes Tickets Bus (publiques pour recherche)
        .route(
            "/api/bus-tickets/search",
            get(bus_ticket_controller::search_bus_tickets),
        )
        .route(
            "/api/bus-tickets/{product_id}/availability",
            get(bus_ticket_controller::get_seat_availability),
        )
        // Routes horaires d'agence (publiques pour consultation)
        .route(
            "/api/bus-tickets/agencies/{agency_id}/schedules",
            get(agency_schedule_controller::get_available_times),
        )
        // Routes avis et ratings (publiques pour consultation)
        .route(
            "/api/specialized-services/{service_id}/ratings",
            get(specialized_rating_controller::list_service_ratings),
        )
        .route(
            "/api/specialized-services/{service_id}/ratings/stats",
            get(specialized_rating_controller::get_rating_stats),
        )
        // ✅ Routes Livres Scolaires (publiques pour recherche)
        .route(
            "/api/livres-scolaires/search",
            get(livres_scolaires_controller::search_livres_scolaires),
        )
        .route(
            "/api/livres-scolaires/{id}",
            get(livres_scolaires_controller::get_livre_details),
        )
        // ✅ Routes trajets récurrents (protégées JWT — conducteur/admin déclenche)
        .route(
            "/api/covoiturages/recurring/generate",
            post(specialized_services_controller::generate_recurring_instances),
        )
        // ✅ Routes Immobilier (publiques pour recherche)
        .route(
            "/api/immobilier/biens",
            get(specialized_services_controller::search_properties),
        )
        .route(
            "/api/immobilier/biens/{id}",
            get(specialized_services_controller::get_property_details),
        )
        .route(
            "/api/immobilier/ai/recommendations",
            post(specialized_services_controller::get_ai_recommendations),
        )
        .route(
            "/api/immobilier/ai/price-estimate",
            post(specialized_services_controller::estimate_property_price),
        )
        .route(
            "/api/immobilier/analytics",
            get(specialized_services_controller::get_property_analytics),
        )
        // Favoris
        .route(
            "/api/immobilier/biens/{id}/favorite",
            post(specialized_services_controller::add_to_favorites),
        )
        .route(
            "/api/immobilier/biens/{id}/unfavorite",
            delete(specialized_services_controller::remove_from_favorites),
        )
        .route(
            "/api/immobilier/my-favorites",
            get(specialized_services_controller::get_my_favorites),
        )
        // Comparaison
        .route(
            "/api/immobilier/compare",
            post(specialized_services_controller::compare_properties),
        )
        // Alertes prix
        .route(
            "/api/immobilier/alerts",
            post(specialized_services_controller::create_price_alert),
        )
        .route(
            "/api/immobilier/my-alerts",
            get(specialized_services_controller::get_my_price_alerts),
        )
        // Tracking et Partage
        .route(
            "/api/immobilier/biens/{id}/track-view",
            post(specialized_services_controller::track_property_view),
        )
        .route(
            "/api/immobilier/biens/{id}/share",
            post(specialized_services_controller::share_property),
        )
        // Visites virtuelles
        .route(
            "/api/immobilier/biens/{id}/upload-virtual-tour",
            post(specialized_services_controller::upload_virtual_tour),
        )
        .route(
            "/api/immobilier/biens/{id}/virtual-tours",
            get(specialized_services_controller::get_property_virtual_tours),
        );
    // Routes protégées (avec JWT)
    let protected_routes = Router::new()
        // Routes protégées (création) - middleware appliqué au Router
        .route(
            "/api/pharmacies",
            post(pharmacy_controller::create_pharmacy).get(pharmacy_controller::list_pharmacies),
        )
        // ✅ 2026-04-08: Succursales pharmacie
        .route(
            "/api/pharmacies/{id}/branches",
            get(pharmacy_controller::list_branches).post(pharmacy_controller::create_branch),
        )
        .route(
            "/api/pharmacies/branches/{branch_id}",
            axum::routing::patch(pharmacy_controller::update_branch)
                .delete(pharmacy_controller::delete_branch),
        )
        // ✅ NOUVEAU: Routes produits de pharmacie
        .route(
            "/api/pharmacies/products/search",
            get(pharmacy_product_controller::search_products),
        )
        .route(
            "/api/pharmacies/products/budget",
            post(pharmacy_product_controller::calculate_budget),
        )
        .route(
            "/api/pharmacies/{id}/products",
            get(pharmacy_product_controller::get_pharmacy_products),
        )
        .route(
            "/api/pharmacies/products",
            post(pharmacy_product_controller::create_product),
        )
        .route(
            "/api/pharmacies/products/{id}",
            axum::routing::patch(pharmacy_product_controller::update_product)
                .delete(pharmacy_product_controller::delete_product),
        )
        .route(
            "/api/pharmacies/products/bulk-import",
            post(pharmacy_product_controller::bulk_import_products),
        )
        .route(
            "/api/pharmacies/products/sync-external",
            post(pharmacy_product_controller::sync_products_from_external_api),
        )
        // ✅ Partenaire pharmacie : gestion commandes reçues
        .route(
            "/api/pharmacies/{id}/partner-orders",
            get(pharmacy_product_controller::get_partner_orders),
        )
        .route(
            "/api/pharmacies/orders/{order_id}/status",
            axum::routing::patch(pharmacy_product_controller::update_pharmacy_order_status),
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
            post(specialized_services_controller::create_covoiturage), // GET est dans public_routes
        )
        .route(
            "/api/covoiturages/{id}/book",
            post(specialized_services_controller::book_covoiturage),
        )
        .route(
            "/api/covoiturages/my-trips",
            get(specialized_services_controller::get_my_trips),
        )
        .route(
            "/api/covoiturages/{id}/verify-driver",
            post(specialized_services_controller::verify_covoiturage_driver),
        )
        .route(
            "/api/covoiturages/{id}/confirm-departure",
            post(specialized_services_controller::confirm_covoiturage_departure),
        )
        .route(
            "/api/covoiturages/{id}/reviews",
            post(specialized_services_controller::submit_covoiturage_review),
        )
        // ✅ Routes Immobilier (protégées)
        .route(
            "/api/immobilier/biens",
            post(specialized_services_controller::create_property),
        )
        .route(
            "/api/immobilier/biens/{id}",
            put(specialized_services_controller::update_property),
        )
        .route(
            "/api/immobilier/biens/{id}/book-visit",
            post(specialized_services_controller::book_property_visit),
        )
        .route(
            "/api/immobilier/biens/{id}/simulate-loan",
            post(specialized_services_controller::simulate_property_loan),
        )
        .route(
            "/api/immobilier/biens/{id}/upload-media",
            post(specialized_services_controller::upload_property_media),
        )
        .route(
            "/api/immobilier/my-visits",
            get(specialized_services_controller::get_my_visits),
        )
        // ✅ Routes Terrains (partenaire)
        .route(
            "/api/immobilier/terrains",
            get(specialized_services_controller::search_lands)
                .post(specialized_services_controller::create_land),
        )
        .route(
            "/api/immobilier/terrains/my-listings",
            get(specialized_services_controller::get_my_land_listings),
        )
        .route(
            "/api/immobilier/terrains/{id}",
            get(specialized_services_controller::get_land_details)
                .put(specialized_services_controller::update_land),
        )
        .route(
            "/api/immobilier/terrains/{id}/book-visit",
            post(specialized_services_controller::book_land_visit),
        )
        .route(
            "/api/immobilier/terrains/ai/analysis",
            post(specialized_services_controller::analyze_land),
        )
        // ✅ Routes Décoration (partenaire + utilisateur)
        .route(
            "/api/decoration/decorateurs",
            get(specialized_services_controller::search_decorators)
                .post(specialized_services_controller::create_decorator),
        )
        .route(
            "/api/decoration/ai/suggestions",
            post(specialized_services_controller::get_decoration_suggestions),
        )
        .route(
            "/api/decoration/consultations",
            post(specialized_services_controller::create_design_consultation),
        )
        .route(
            "/api/decoration/my-consultations",
            get(specialized_services_controller::get_my_design_consultations),
        )
        .route(
            "/api/decoration/consultations/{id}/respond",
            put(specialized_services_controller::respond_design_consultation),
        )
        // ✅ Routes Déménagement (intégré livraison IA + dashboard partenaire)
        .route(
            "/api/demenagement/quote",
            post(specialized_services_controller::create_moving_quote),
        )
        .route(
            "/api/demenagement/book",
            post(specialized_services_controller::book_moving),
        )
        .route(
            "/api/demenagement/tracking/{id}",
            get(specialized_services_controller::get_moving_tracking),
        )
        .route(
            "/api/demenagement/my-bookings",
            get(specialized_services_controller::get_my_moving_bookings),
        )
        .route(
            "/api/demenagement/bookings/{id}/respond",
            put(specialized_services_controller::respond_moving_booking),
        )
        .route(
            "/api/demenagement/bookings/{id}/location",
            put(specialized_services_controller::update_moving_location),
        )
        .route(
            "/api/reservations/{id}/insurance",
            post(specialized_services_controller::create_reservation_insurance),
        )
        .route(
            "/api/reservations/{id}/qr-code",
            post(specialized_services_controller::generate_reservation_qr_code),
        )
        .route(
            "/api/reservations/validate-qr",
            post(specialized_services_controller::validate_qr_code),
        )
        .route(
            "/api/reservations/{id}/schedule-notifications",
            post(specialized_services_controller::schedule_proactive_notifications),
        )
        // ✅ NOUVEAU 2026-04-01: Paiement Mobile Money
        .route(
            "/api/payments/mobile-money",
            post(specialized_services_controller::initiate_mobile_money_payment),
        )
        .route(
            "/api/payments/{id}/status",
            get(specialized_services_controller::get_payment_status),
        )
        // ✅ SUPPRIMÉ 2026-04-01: /api/payments/history dupliqué (déjà dans payment_routes.rs)
        // ✅ NOUVEAU 2026-04-01: Notations post-trajet
        .route(
            "/api/reservations/rate",
            post(specialized_services_controller::submit_trip_rating),
        )
        .route(
            "/api/reservations/{id}/rating-status",
            get(specialized_services_controller::check_rating_status),
        )
        // ✅ NOUVEAU 2026-04-01: KYC vérification conducteur (15 MB pour 3 images base64)
        .route(
            "/api/driver/verification",
            post(specialized_services_controller::submit_driver_verification)
                .layer(axum::extract::DefaultBodyLimit::max(15_000_000)),
        )
        .route(
            "/api/driver/verification/{service_type}",
            get(specialized_services_controller::get_driver_verification_status),
        )
        // ✅ NOUVEAU 2026-04-01: Programme fidélité
        .route(
            "/api/loyalty/balance",
            get(specialized_services_controller::get_loyalty_balance),
        )
        .route(
            "/api/loyalty/redeem",
            post(specialized_services_controller::redeem_loyalty_reward),
        )
        .route(
            "/api/reservations/{id}/loyalty-credit",
            post(specialized_services_controller::credit_trip_loyalty_points),
        )
        // ✅ NOUVEAU 2026-04-01: Partage trajet
        .route(
            "/api/reservations/{id}/share",
            post(specialized_services_controller::create_trip_share)
                .delete(specialized_services_controller::revoke_trip_share),
        )
        .route(
            "/api/covoiturages/recurring/activate",
            post(specialized_services_controller::activate_pending_recurring_instances),
        )
        // ✅ INTÉGRATION TAXI - Matching intelligent + Détails enrichis
        .route(
            "/api/taxis/intelligent-matching",
            post(specialized_services_controller::taxi_intelligent_matching),
        )
        .route(
            "/api/taxis/{id}/details-enhanced",
            get(specialized_services_controller::get_taxi_details_enhanced),
        )
        .route(
            "/api/taxis",
            post(specialized_services_controller::create_taxi), // GET est dans public_routes
        )
        .route(
            "/api/taxis/{id}/book",
            post(specialized_services_controller::book_taxi),
        )
        .route(
            "/api/taxis/{id}/update-availability",
            post(specialized_services_controller::update_taxi_availability),
        )
        // ✅ 2026-04-01: Flow course taxi — demande passager + accept/refuse chauffeur + paiement
        .route(
            "/api/taxis/rides/request",
            post(taxi_ride_controller::request_ride),
        )
        .route(
            "/api/taxis/rides/{id}/status",
            get(taxi_ride_controller::get_ride_status),
        )
        .route(
            "/api/taxis/rides/{id}/accept",
            post(taxi_ride_controller::accept_ride),
        )
        .route(
            "/api/taxis/rides/{id}/refuse",
            post(taxi_ride_controller::refuse_ride),
        )
        .route(
            "/api/taxis/rides/{id}/pay",
            post(taxi_ride_controller::pay_ride),
        )
        // ✅ 2026-04-01: Dashboard chauffeur — courses en attente (polling 5s)
        .route(
            "/api/taxis/driver/pending-rides",
            get(taxi_ride_controller::driver_pending_rides),
        )
        // ✅ LEADERSHIP GLOBAL 100% - IA Prédictive
        .route(
            "/api/taxi/demand-prediction",
            post(taxi_leadership_controller::predict_demand), // Prédiction demande
        )
        .route(
            "/api/taxi/demand-prediction/multi-zone",
            post(taxi_leadership_controller::predict_demand_multi_zone), // Prédiction multi-zones
        )
        .route(
            "/api/taxi/demand-prediction/heatmap",
            get(taxi_leadership_controller::get_demand_heatmap), // Heatmap prédiction
        )
        .route(
            "/api/taxi/demand-prediction/metrics",
            get(taxi_leadership_controller::get_prediction_metrics), // Métriques prédiction
        )
        .route(
            "/api/taxi/optimize-route",
            post(taxi_route_optimization_controller::optimize_route), // Optimisation itinéraires
        )
        .route(
            "/api/taxi/personalized-recommendations",
            get(taxi_recommendations_controller::get_personalized_recommendations), // Recommandations personnalisées
        )
        // ✅ LEADERSHIP GLOBAL 100% - Business Intelligence
        .route(
            "/api/admin/taxi/analytics/overview",
            get(taxi_analytics_controller::get_analytics_overview), // Vue d'ensemble analytics
        )
        .route(
            "/api/admin/taxi/analytics/demand-trends",
            get(taxi_analytics_controller::get_demand_trends), // Tendance demande
        )
        .route(
            "/api/admin/taxi/analytics/revenue",
            get(taxi_analytics_controller::get_revenue_analytics), // Analytics revenus
        )
        .route(
            "/api/admin/taxi/analytics/driver-performance",
            get(taxi_analytics_controller::get_driver_performance), // Performance conducteurs
        )
        // ✅ LEADERSHIP GLOBAL 100% - Prix Dynamique IA
        .route(
            "/api/taxi/dynamic-price",
            post(taxi_dynamic_pricing_controller::calculate_dynamic_price), // Prix dynamique IA
        )
        .route(
            "/api/hopitaux/{id}/book",
            post(specialized_services_controller::book_hospital),
        )
        .route(
            "/api/laboratoires/{id}/book",
            post(specialized_services_controller::book_laboratory),
        )
        // Routes Banques de sang (protégées pour création/modification)
        .route(
            "/api/banques-sang",
            post(blood_bank_controller::create_blood_bank)
                .get(blood_bank_controller::list_blood_banks), // ✅ Ajout GET
        )
        .route(
            "/api/banques-sang/{id}/stocks",
            post(blood_bank_controller::update_blood_bank_stocks),
        )
        .route(
            "/api/banques-sang/{id}/statistics",
            get(blood_bank_controller::get_blood_bank_statistics),
        )
        // Routes Tickets Bus (protégées pour liaison)
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
        .route(
            "/api/bus-tickets/reservations/{id}/cancel",
            axum::routing::patch(bus_ticket_controller::cancel_reservation),
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
        // ✅ NOUVEAU: Routes demandes de retour (aller-retour) (protégées JWT)
        .route(
            "/api/bus-tickets/return-request",
            post(bus_return_trip_controller::create_return_trip_request),
        )
        .route(
            "/api/bus-tickets/return-requests",
            get(bus_return_trip_controller::list_return_trip_requests),
        )
        .route(
            "/api/bus-tickets/return-request/{request_id}",
            get(bus_return_trip_controller::get_return_trip_request),
        )
        .route(
            "/api/bus-tickets/return-request/{request_id}/confirm",
            post(bus_return_trip_controller::confirm_return_trip_request),
        )
        .route(
            "/api/bus-tickets/check-return-requests",
            post(bus_return_trip_controller::check_return_requests),
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
        // Routes crédits et report de tickets bus (protégées JWT)
        .route(
            "/api/bus-tickets/defer",
            post(bus_ticket_credit_controller::defer_ticket),
        )
        .route(
            "/api/bus-tickets/apply-credit",
            post(bus_ticket_credit_controller::apply_credit),
        )
        .route(
            "/api/bus-tickets/credits",
            get(bus_ticket_credit_controller::get_user_credits),
        )
        .route(
            "/api/bus-tickets/credits/{credit_id}",
            get(bus_ticket_credit_controller::get_credit_details),
        )
        .route(
            "/api/bus-tickets/wallet/transactions",
            post(bus_ticket_credit_controller::get_wallet_transactions),
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
        .route(
            "/api/blood-donation/compatibility/{group}",
            get(blood_donation_matching_controller::get_blood_group_compatibility),
        )
        .route(
            "/api/blood-donation/compatibility",
            get(blood_donation_matching_controller::get_all_blood_group_compatibilities),
        )
        // ✅ Routes notation tickets bus
        .route(
            "/api/bus-tickets/rate",
            post(bus_ticket_rating_controller::rate_bus_ticket),
        )
        .route(
            "/api/bus-tickets/ratings/stats",
            get(bus_ticket_rating_controller::get_ticket_rating_stats),
        )
        // ✅ NOUVEAU: Routes horaires d'agence (protégées pour gestion)
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
        .route(
            "/api/bus-tickets/agencies/schedules/generate-products",
            post(bus_ticket_controller::generate_products_from_schedules),
        )
        // ✅ 2026-04-08: Succursales agences de voyage
        .route(
            "/api/agences/branches",
            get(agency_schedule_controller::list_agence_branches)
                .post(agency_schedule_controller::create_agence_branch),
        )
        .route(
            "/api/agences/branches/{branch_id}",
            axum::routing::patch(agency_schedule_controller::update_agence_branch)
                .delete(agency_schedule_controller::delete_agence_branch),
        )
        // ✅ NOUVEAU: Endpoint unifié pour services spécialisés (remplace 6 appels par 1)
        .route(
            "/api/specialized-services/user",
            get(specialized_services_unified_controller::list_user_specialized_services),
        )
        // ✅ Phase 5.4: Statistiques détaillées pour dashboard
        .route(
            "/api/specialized-services/statistics/detailed",
            get(specialized_services_unified_controller::get_detailed_statistics),
        )
        // ✅ Phase 5.5: Actions batch (activer/désactiver/supprimer plusieurs services)
        .route(
            "/api/specialized-services/batch",
            axum::routing::patch(specialized_services_unified_controller::batch_action),
        )
        // ✅ Phase 6.3: Synchronisation batch pour mode hors ligne
        .route(
            "/api/specialized-services/sync",
            post(specialized_services_unified_controller::sync_services),
        )
        // ✅ Phase 6.4: Résolution de conflits
        .route(
            "/api/specialized-services/conflicts/resolve",
            post(specialized_services_unified_controller::resolve_conflict),
        )
        // ✅ NOUVEAU Phase 3.2: Sauvegarde automatique de brouillons
        .route(
            "/api/specialized-services/drafts",
            post(specialized_services_unified_controller::save_draft)
                .get(specialized_services_unified_controller::get_drafts),
        )
        // ✅ NOUVEAU Phase 3.4: Templates par type
        .route(
            "/api/specialized-services/templates",
            get(specialized_services_unified_controller::get_templates),
        )
        // ✅ NOUVEAU Phase 4.4: Historique de recherches
        .route(
            "/api/specialized-services/search-history",
            post(specialized_services_unified_controller::save_search_history)
                .get(specialized_services_unified_controller::get_search_history),
        )
        // ✅ NOUVEAU Phase 4.5: Recherches sauvegardées
        .route(
            "/api/specialized-services/saved-searches",
            post(specialized_services_unified_controller::save_search)
                .get(specialized_services_unified_controller::get_saved_searches),
        )
        .route(
            "/api/specialized-services/saved-searches/{id}",
            delete(specialized_services_unified_controller::delete_saved_search),
        )
        // ✅ NOUVEAU: Routes réservations
        .route(
            "/api/specialized-services/reservations",
            post(specialized_reservation_controller::create_reservation)
                .get(specialized_reservation_controller::list_user_reservations),
        )
        .route(
            "/api/specialized-services/reservations/prestataire",
            get(specialized_reservation_controller::list_prestataire_reservations),
        )
        .route(
            "/api/specialized-services/reservations/{id}/confirm",
            axum::routing::patch(specialized_reservation_controller::confirm_reservation),
        )
        .route(
            "/api/specialized-services/reservations/{id}/cancel",
            axum::routing::patch(specialized_reservation_controller::cancel_reservation),
        )
        // ✅ NOUVEAU: Routes avis et ratings (protégées pour création)
        .route(
            "/api/specialized-services/ratings",
            post(specialized_rating_controller::create_rating),
        )
        .route(
            "/api/specialized-services/ratings/{id}/helpful",
            post(specialized_rating_controller::mark_rating_helpful),
        )
        // ✅ NOUVEAU: Routes chat intégré
        .route(
            "/api/specialized-services/{service_id}/chat/conversation",
            post(specialized_chat_controller::get_or_create_conversation),
        )
        .route(
            "/api/specialized-services/chat/{conversation_id}/message",
            post(specialized_chat_controller::send_message),
        )
        .route(
            "/api/specialized-services/chat/conversations",
            get(specialized_chat_controller::list_conversations),
        )
        // ✅ NOUVEAU: Routes paiement intégré
        .route(
            "/api/specialized-services/reservations/{id}/payment",
            post(specialized_payment_controller::process_reservation_payment),
        )
        .route(
            "/api/specialized-services/reservations/{id}/refund",
            post(specialized_payment_controller::refund_reservation_payment),
        )
        // ✅ Routes Livres Scolaires (protégées pour création/modification)
        .route(
            "/api/livres-scolaires",
            post(livres_scolaires_controller::create_livre_scolaire),
        )
        .route(
            "/api/livres-scolaires/mes-livres",
            get(livres_scolaires_controller::get_mes_livres),
        )
        .route(
            "/api/livres-scolaires/{id}",
            put(livres_scolaires_controller::update_livre_scolaire)
                .delete(livres_scolaires_controller::delete_livre_scolaire),
        )
        .route(
            "/api/livres-scolaires/{id}/availability",
            axum::routing::patch(livres_scolaires_controller::update_availability),
        )
        // ✅ Routes Troc Livres (protégées)
        .route(
            "/api/troc-livres/match",
            post(troc_livres_controller::find_matchings),
        )
        // ✅ 2026-05-10 : match global pour le checkout (crédit prévisionnel)
        .route(
            "/api/troc-livres/match-all-pending",
            post(troc_livres_controller::match_all_pending),
        )
        // ✅ 2026-05-10 : pool consignation (admin Yukpo only)
        .route(
            "/api/v2/admin/troc/consignation-pool",
            get(troc_livres_controller::list_consignation_pool),
        )
        .route(
            "/api/v2/admin/troc/consignation/{livre_id}/recover",
            post(troc_livres_controller::recover_consignation),
        )
        // ✅ 2026-05-11 : queue notifications WhatsApp (admin)
        .route(
            "/api/v2/admin/wa-queue/pending",
            get(troc_livres_controller::wa_queue_pending),
        )
        .route(
            "/api/v2/admin/wa-queue/{id}/mark-sent",
            post(troc_livres_controller::wa_queue_mark_sent),
        )
        // ✅ 2026-05-11 : retrait volontaire d'un livre par son propriétaire
        .route(
            "/api/troc-livres/{livre_id}/withdraw",
            post(troc_livres_controller::withdraw_livre),
        )
        // ✅ 2026-05-11 : pool troc/vente personnel pour cross-flow detection
        .route(
            "/api/troc-livres/my-pool",
            get(troc_livres_controller::my_troc_pool),
        )
        .route(
            "/api/troc-livres/direct",
            post(troc_livres_controller::create_troc_direct),
        )
        .route(
            "/api/troc-livres/chaine",
            post(troc_livres_controller::create_troc_chaine),
        )
        .route(
            "/api/troc-livres/my-trocs",
            get(troc_livres_controller::get_my_trocs),
        )
        .route(
            "/api/troc-livres/{id}/accept",
            post(troc_livres_controller::accept_troc),
        )
        .route(
            "/api/troc-livres/{id}/refuse",
            post(troc_livres_controller::refuse_troc),
        )
        .route(
            "/api/troc-livres/{id}/complete",
            post(troc_livres_controller::complete_troc),
        )
        .route(
            "/api/troc-livres/{id}",
            get(troc_livres_controller::get_troc_details),
        )
        .route(
            "/api/troc-livres/chaines/{id}",
            get(troc_livres_controller::get_chaine_details),
        )
        // ✅ Routes Hôpitaux (anciennement commentées - maintenant actives)
        .route(
            "/api/hopitaux/ai/recommendations",
            post(specialized_services_controller::get_hospital_ai_recommendations),
        )
        .route(
            "/api/hopitaux/ai/triage",
            post(specialized_services_controller::analyze_emergency_severity),
        )
        .route(
            "/api/hopitaux/{id}/wait-times",
            get(specialized_services_controller::get_hospital_wait_times),
        )
        .route(
            "/api/hopitaux/{id}/emergency-status",
            get(specialized_services_controller::get_hospital_emergency_status),
        )
        .route(
            "/api/hopitaux/my-consultations",
            get(specialized_services_controller::get_my_hospital_consultations),
        )
        .route(
            "/api/hopitaux/{id}/analytics",
            get(specialized_services_controller::get_hospital_analytics),
        )
        .route(
            "/api/hopitaux/{id}/slots",
            post(specialized_services_controller::manage_hospital_slots),
        )
        .route(
            "/api/hopitaux/{id}/available-slots",
            get(specialized_services_controller::get_available_slots),
        )
        .route(
            "/api/laboratoires/{id}/slots",
            post(specialized_services_controller::manage_hospital_slots),
        )
        .route(
            "/api/laboratoires/{id}/available-slots",
            get(specialized_services_controller::get_available_slots),
        )
        .route(
            "/api/appointments/book",
            post(specialized_services_controller::book_slot),
        )
        // ✅ 2025-01-27: Nouvelles routes Pharmacies
        .route(
            "/api/pharmacies/{id}/check-availability",
            post(specialized_services_controller::check_medication_availability),
        )
        .route(
            "/api/pharmacies/{id}/reserve-medication",
            post(specialized_services_controller::reserve_medication),
        )
        .route(
            "/api/pharmacies/{id}/order",
            post(specialized_services_controller::create_pharmacy_order),
        )
        .route(
            "/api/pharmacies/my-orders",
            get(specialized_services_controller::get_my_pharmacy_orders),
        )
        // Pharmacie officielle Yukpo (test admin) — protected JWT requis.
        // Le handler vérifie role='admin' ou 'super_admin'.
        .route(
            "/api/admin/pharmacie/yukpo-official",
            get(specialized_services_controller::admin_get_yukpo_official_pharmacy),
        )
        // Workflow alertes pharmacie côté pharmacien (JWT requis)
        .route(
            "/api/pharmacies/me/alerts",
            get(specialized_services_controller::get_my_pharmacy_alerts),
        )
        .route(
            "/api/medication-alerts/{id}/respond",
            post(specialized_services_controller::respond_to_medication_alert),
        )
        // Archivage ordonnances scannées par le pharmacien (JWT requis)
        // — Migration 20260514_003 (table pharmacy_archived_prescriptions)
        .route(
            "/api/pharmacies/me/prescriptions/archive",
            post(specialized_services_controller::archive_prescription),
        )
        .route(
            "/api/pharmacies/me/prescriptions/search",
            get(specialized_services_controller::search_archived_prescriptions),
        )
        .route(
            "/api/pharmacies/me/prescriptions/{id}",
            get(specialized_services_controller::get_archived_prescription),
        )
        .route(
            "/api/pharmacies/me/prescriptions/{id}",
            delete(specialized_services_controller::delete_archived_prescription),
        )
        // Dashboard analytics pharmacien (taux de réponse, top médicaments,
        // ruptures de stock, top hôpitaux/médecins). Période en jours.
        .route(
            "/api/pharmacies/me/analytics",
            get(specialized_services_controller::get_pharmacy_analytics),
        )
        // Carnet de santé patient + réordre 1 clic (commit 2026-05-15)
        .route(
            "/api/users/me/medication-history",
            get(specialized_services_controller::get_user_medication_history),
        )
        .route(
            "/api/medication-alerts/{id}/reorder",
            post(specialized_services_controller::reorder_medication_alert),
        )
        // Pharmacovigilance (signalements pharmacien)
        .route(
            "/api/pharmacies/me/pharmacovigilance",
            post(specialized_services_controller::submit_pharmacovigilance_report)
                .get(specialized_services_controller::list_pharmacovigilance_reports),
        )
        // ✅ Phase B1 (2026-05-15) : Interactions personnelles (croise historique
        // 90 j du patient avec nouveaux médicaments via IA). Sensible : pas en
        // public — toujours associé à un user_id.
        .route(
            "/api/users/me/check-interactions",
            post(specialized_services_controller::check_personal_interactions),
        )
        // ✅ Phase B1 (2026-05-15) : Coordination réseau de garde (pharmacies
        // voisines ≤ 25 km du pharmacien connecté, on_duty DESC + distance ASC)
        .route(
            "/api/pharmacies/me/duty-network",
            get(specialized_services_controller::get_pharmacy_duty_network),
        )
        // ✅ Phase B1 (2026-05-15) : Radar rupture nationale (admin only —
        // agrégation des médicaments unavailable=false dans pharmacy_responses)
        .route(
            "/api/admin/pharmacie/rupture-radar",
            get(specialized_services_controller::admin_get_rupture_radar),
        )
        .route(
            "/api/pharmacies/me/financial-movements",
            get(specialized_services_controller::get_pharmacy_financial_movements),
        )
        .route(
            "/api/pharmacies/me/withdrawals",
            post(specialized_services_controller::request_pharmacy_withdrawal),
        )
        .route(
            "/api/pharmacies/{id}/analytics",
            get(specialized_services_controller::get_pharmacy_analytics_by_id),
        )
        // ✅ QR codes pharmacie : génération, affichage, validation + reversal financier
        .route(
            "/api/pharmacies/orders/qr/validate",
            post(specialized_services_controller::validate_pharmacy_order_qr),
        )
        .route(
            "/api/pharmacies/orders/{order_id}/qr",
            get(specialized_services_controller::get_pharmacy_order_qr),
        )
        .route(
            "/api/pharmacies/orders/{order_id}/detail",
            get(specialized_services_controller::get_pharmacy_order_detail),
        )
        // ✅ Commandes multi-pharmacies : créer + consulter
        .route(
            "/api/pharmacies/orders/multi",
            post(specialized_services_controller::create_multi_pharmacy_order),
        )
        .route(
            "/api/pharmacies/multi-orders/{multi_order_id}",
            get(specialized_services_controller::get_multi_pharmacy_order),
        )
        // ✅ 2026-04-03: Comptes bancaires partenaires + historique retraits
        .route(
            "/api/partner/bank-accounts",
            get(specialized_services_controller::list_partner_bank_accounts)
                .post(specialized_services_controller::save_partner_bank_account),
        )
        .route(
            "/api/partner/bank-accounts/{id}",
            delete(specialized_services_controller::delete_partner_bank_account),
        )
        .route(
            "/api/partner/withdrawals",
            get(specialized_services_controller::list_partner_withdrawals)
                .post(specialized_services_controller::request_pharmacy_withdrawal),
        )
        // ✅ Import permanent via lien Drive / cloud (pharmacie, supermarché, e-commerce)
        .route(
            "/api/partner/import-links",
            get(drive_import_controller::list_import_links)
                .post(drive_import_controller::save_import_link),
        )
        .route(
            "/api/partner/import-links/{id}",
            delete(drive_import_controller::delete_import_link),
        )
        .route(
            "/api/partner/import-links/{id}/toggle",
            patch(drive_import_controller::toggle_import_link),
        )
        .route(
            "/api/partner/import-links/{id}/sync",
            post(drive_import_controller::manual_sync_import_link),
        )
        // ✅ 2025-01-27: Nouvelles routes Laboratoires
        .route(
            "/api/laboratoires/{id}/examination-types",
            get(specialized_services_controller::get_laboratory_examination_types),
        )
        .route(
            "/api/laboratoires/{id}/book-examination",
            post(specialized_services_controller::book_laboratory_examination),
        )
        .route(
            "/api/laboratoires/examinations/{id}/results",
            get(specialized_services_controller::get_examination_results),
        )
        .route(
            "/api/laboratoires/examinations/{id}/analyze",
            post(specialized_services_controller::analyze_examination_results),
        )
        .route(
            "/api/laboratoires/my-examinations",
            get(specialized_services_controller::get_my_laboratory_examinations),
        )
        .route(
            "/api/laboratoires/{id}/analytics",
            get(specialized_services_controller::get_laboratory_analytics),
        )
        // ✅ NOUVEAU: Autocomplete et IA pour laboratoires
        .route(
            "/api/laboratoires/examinations/autocomplete",
            get(specialized_services_controller::autocomplete_examination_types),
        )
        .route(
            "/api/laboratoires/examinations/analyze-image",
            post(specialized_services_controller::analyze_examination_image),
        )
        .route(
            "/api/laboratoires/ai/search-pathology",
            post(specialized_services_controller::search_pathology_laboratory),
        )
        // ✅ 2025-01-27: Routes Planification Menus
        .route(
            "/api/menus/ai/generate-week",
            post(menu_planning_controller::generate_weekly_menu),
        )
        .route(
            "/api/menus/ai/generate-recipe",
            post(menu_planning_controller::generate_recipe),
        )
        .route(
            "/api/menus/my-week",
            get(menu_planning_controller::get_my_week_menu),
        )
        .route(
            "/api/menus/family-profile",
            get(menu_planning_controller::get_family_profile),
        )
        .route(
            "/api/menus/family-profile",
            put(menu_planning_controller::update_family_profile),
        )
        .route(
            "/api/menus/ai/generate-shopping-list",
            post(menu_planning_controller::generate_intelligent_shopping_list),
        )
        .route(
            "/api/menus/ai/suggest-recipes",
            post(menu_planning_controller::suggest_recipes),
        )
        .route(
            "/api/menus/shopping-list",
            get(menu_planning_controller::get_shopping_list),
        )
        .route(
            "/api/menus/shopping-list",
            post(menu_planning_controller::create_shopping_list),
        )
        .route(
            "/api/menus/history",
            get(menu_planning_controller::get_menu_history),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state.clone());

    // Combiner routes publiques et protégées
    Router::new().merge(public_routes).merge(protected_routes).with_state(state)
}
