// ✅ Routes pour orientation scolaire et établissements

use axum::{
    middleware,
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

use crate::controllers::orientation_scolaire_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn orientation_scolaire_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes publiques (sans JWT)
    let public_routes = Router::new()
        .route(
            "/api/orientation-scolaire/etablissements/search",
            get(orientation_scolaire_controller::search_etablissements),
        )
        .route(
            "/api/orientation-scolaire/etablissements/{id}",
            get(orientation_scolaire_controller::get_etablissement_details),
        )
        .route(
            "/api/orientation-scolaire/etablissements/suggest",
            get(orientation_scolaire_controller::suggest_etablissements),
        )
        .route(
            "/api/orientation-scolaire/programmes/search",
            get(orientation_scolaire_controller::search_programmes),
        )
        .route(
            "/api/orientation-scolaire/etablissements/{id}/programmes",
            get(orientation_scolaire_controller::get_programmes_by_etablissement),
        )
        .route(
            "/api/orientation-scolaire/fournitures/search",
            get(orientation_scolaire_controller::search_fournitures),
        )
        .route(
            "/api/orientation-scolaire/etablissements/{id}/fournitures",
            get(orientation_scolaire_controller::get_fournitures_by_etablissement),
        )
        // Concours
        .route(
            "/api/orientation-scolaire/concours/actifs",
            get(orientation_scolaire_controller::list_concours_actifs),
        )
        .route(
            "/api/orientation-scolaire/concours/search",
            get(orientation_scolaire_controller::search_concours),
        )
        .route(
            "/api/orientation-scolaire/concours/{id}",
            get(orientation_scolaire_controller::get_concours_details),
        )
        // Expériences
        .route(
            "/api/orientation-scolaire/experiences/search",
            get(orientation_scolaire_controller::search_experiences),
        )
        .route(
            "/api/orientation-scolaire/etablissements/{id}/experiences",
            get(orientation_scolaire_controller::list_experiences_by_etablissement),
        )
        // Conférences
        .route(
            "/api/orientation-scolaire/conferences/programmees",
            get(orientation_scolaire_controller::list_conferences_programmees),
        )
        .route(
            "/api/orientation-scolaire/conferences/search",
            get(orientation_scolaire_controller::search_conferences),
        )
        .route(
            "/api/orientation-scolaire/conferences/{id}",
            get(orientation_scolaire_controller::get_conference_details),
        );

    // Routes protégées (avec JWT)
    let protected_routes = Router::new()
        .route(
            "/api/orientation-scolaire/etablissements",
            post(orientation_scolaire_controller::create_etablissement),
        )
        .route(
            "/api/orientation-scolaire/etablissements/{id}/statistiques",
            put(orientation_scolaire_controller::update_statistiques_examens),
        )
        .route(
            "/api/orientation-scolaire/programmes",
            post(orientation_scolaire_controller::upload_programme),
        )
        .route(
            "/api/orientation-scolaire/fournitures",
            post(orientation_scolaire_controller::upload_fournitures),
        )
        // Concours
        .route(
            "/api/orientation-scolaire/concours",
            post(orientation_scolaire_controller::create_concours),
        )
        // Expériences
        .route(
            "/api/orientation-scolaire/experiences",
            post(orientation_scolaire_controller::create_experience),
        )
        // Conférences
        .route(
            "/api/orientation-scolaire/conferences",
            post(orientation_scolaire_controller::create_conference),
        )
        .route(
            "/api/orientation-scolaire/conferences/{id}/join",
            post(orientation_scolaire_controller::join_conference),
        )
        // Endpoints IA
        .route(
            "/api/orientation/ai/analyze-profile",
            post(orientation_scolaire_controller::ai_analyze_profile),
        )
        .route(
            "/api/orientation/ai/recommendations",
            post(orientation_scolaire_controller::ai_recommendations),
        )
        .route(
            "/api/orientation/ai/compare-programs",
            post(orientation_scolaire_controller::ai_compare_programs),
        )
        .route(
            "/api/orientation/my-profile",
            get(orientation_scolaire_controller::get_my_profile),
        )
        .route(
            "/api/orientation/analytics",
            get(orientation_scolaire_controller::get_analytics),
        )
        .layer(middleware::from_fn_with_state(state.clone(), jwt_auth));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .with_state(state)
}
