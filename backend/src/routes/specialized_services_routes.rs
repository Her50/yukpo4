use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;

use crate::controllers::agency_schedule_controller;
use crate::controllers::blood_bank_controller;
use crate::controllers::blood_donation_matching_controller;
use crate::controllers::bus_return_trip_controller;
use crate::controllers::bus_seat_management_controller;
use crate::controllers::bus_ticket_controller;
use crate::controllers::bus_ticket_payment_controller;
use crate::controllers::bus_ticket_validation_controller;
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
        .route(
            "/api/taxis/{id}",
            get(specialized_services_controller::get_taxi_details),
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
        // ✅ NOUVEAU 2025-01-29: Routes trajets récurrents (publiques pour cron)
        // Note: Ces endpoints sont publics mais devraient être protégés par token API en production
        // TODO: Implémenter generate_recurring_instances
        // .route(
        //     "/api/covoiturages/recurring/generate",
        //     post(specialized_services_controller::generate_recurring_instances),
        // )
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
        );
    // TODO: Implémenter activate_pending_recurring_instances
    // .route(
    //     "/api/covoiturages/recurring/activate",
    //     post(specialized_services_controller::activate_pending_recurring_instances),
    // );

    // Routes protégées (avec JWT)
    let protected_routes = Router::new()
        // Routes protégées (création) - middleware appliqué au Router
        .route(
            "/api/pharmacies",
            post(pharmacy_controller::create_pharmacy).get(pharmacy_controller::list_pharmacies), // ✅ Ajout GET
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
        // ✅ Routes Terrains
        .route(
            "/api/immobilier/terrains",
            get(specialized_services_controller::search_lands),
        )
        .route(
            "/api/immobilier/terrains/{id}",
            get(specialized_services_controller::get_land_details),
        )
        .route(
            "/api/immobilier/terrains/ai/analysis",
            post(specialized_services_controller::analyze_land),
        )
        // ✅ Routes Décoration
        .route(
            "/api/decoration/decorateurs",
            get(specialized_services_controller::search_decorators),
        )
        .route(
            "/api/decoration/ai/suggestions",
            post(specialized_services_controller::get_decoration_suggestions),
        )
        // ✅ Routes Déménagement (intégré livraison IA)
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
        // TODO: Implémenter ces fonctions
        // .route(
        //     "/api/reservations/{id}/insurance",
        //     post(specialized_services_controller::create_reservation_insurance),
        // )
        // .route(
        //     "/api/reservations/{id}/qr-code",
        //     post(specialized_services_controller::generate_reservation_qr_code),
        // )
        // .route(
        //     "/api/reservations/validate-qr",
        //     post(specialized_services_controller::validate_qr_code),
        // )
        // .route(
        //     "/api/reservations/{id}/schedule-notifications",
        //     post(specialized_services_controller::schedule_proactive_notifications),
        // )
        // ✅ INTÉGRATION TAXI - Fonctionnalités covoiturage
        // TODO: Implémenter ces fonctions
        // .route(
        //     "/api/taxis/intelligent-matching",
        //     post(specialized_services_controller::taxi_intelligent_matching),
        // )
        // .route(
        //     "/api/taxis/{id}/verify-driver",
        //     post(specialized_services_controller::verify_taxi_driver),
        // )
        // TODO: Implémenter get_taxi_details_enhanced
        // .route(
        //     "/api/taxis/{id}/details-enhanced",
        //     get(specialized_services_controller::get_taxi_details_enhanced),
        // )
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
        .route(
            "/api/blood-donation/compatibility/{group}",
            get(blood_donation_matching_controller::get_blood_group_compatibility),
        )
        .route(
            "/api/blood-donation/compatibility",
            get(blood_donation_matching_controller::get_all_blood_group_compatibilities),
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
            "/api/livres-scolaires/{id}/upload-images",
            post(livres_scolaires_controller::upload_images),
        )
        .route(
            "/api/livres-scolaires/{id}/upload-video",
            post(livres_scolaires_controller::upload_video),
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
            "/api/pharmacies/ai/interactions",
            post(specialized_services_controller::check_medication_interactions),
        )
        .route(
            "/api/pharmacies/ai/dosage",
            post(specialized_services_controller::suggest_medication_dosage),
        )
        .route(
            "/api/pharmacies/my-orders",
            get(specialized_services_controller::get_my_pharmacy_orders),
        )
        .route(
            "/api/pharmacies/{id}/analytics",
            get(specialized_services_controller::get_pharmacy_analytics),
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
