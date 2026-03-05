use axum::{
    middleware,
    routing::{get, patch, post, put},
    Router,
};
use std::sync::Arc;

use crate::controllers::offres_emploi_controller;
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn offres_emploi_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes publiques (sans authentification)
    let public_routes = Router::new()
        // Recherche d'offres (publique)
        .route(
            "/api/offres-emploi/search",
            get(offres_emploi_controller::search_offres),
        )
        // Détails d'une offre (publique)
        .route(
            "/api/offres-emploi/{id}",
            get(offres_emploi_controller::get_offre_details),
        )
        // Tendances du marché (publique)
        .route(
            "/api/offres-emploi/tendances",
            get(offres_emploi_controller::get_tendances_marche),
        )
        // Prédiction salaire (publique)
        .route(
            "/api/offres-emploi/ai/salary-prediction",
            get(offres_emploi_controller::ai_salary_prediction),
        );

    // Routes protégées (avec JWT)
    let protected_routes = Router::new()
        // ==================== CANDIDATS ====================
        // Profil candidat
        .route(
            "/api/offres-emploi/profil",
            post(offres_emploi_controller::create_or_update_profil)
                .get(offres_emploi_controller::get_profil),
        )
        // Matching offres pour candidat
        .route(
            "/api/offres-emploi/matching/offres",
            get(offres_emploi_controller::find_matching_offres),
        )
        // Candidatures
        .route(
            "/api/offres-emploi/candidatures",
            post(offres_emploi_controller::create_candidature),
        )
        .route(
            "/api/offres-emploi/mes-candidatures",
            get(offres_emploi_controller::list_my_candidatures),
        )
        // Alertes
        .route(
            "/api/offres-emploi/alertes",
            post(offres_emploi_controller::create_alerte)
                .get(offres_emploi_controller::list_my_alertes),
        )
        // Dashboard candidat
        .route(
            "/api/offres-emploi/dashboard/candidat",
            get(offres_emploi_controller::get_dashboard_candidat),
        )
        // ==================== EMPLOYEURS ====================
        // Offres d'emploi
        .route(
            "/api/offres-emploi",
            post(offres_emploi_controller::create_offre)
                .get(offres_emploi_controller::list_my_offres),
        )
        .route(
            "/api/offres-emploi/{id}",
            put(offres_emploi_controller::update_offre),
        )
        .route(
            "/api/offres-emploi/{id}/close",
            patch(offres_emploi_controller::close_offre),
        )
        // Candidatures pour une offre
        .route(
            "/api/offres-emploi/{id}/candidatures",
            get(offres_emploi_controller::list_candidatures_offre),
        )
        .route(
            "/api/offres-emploi/candidatures/{id}/statut",
            patch(offres_emploi_controller::update_statut_candidature),
        )
        // Matching candidats pour une offre
        .route(
            "/api/offres-emploi/{id}/matching/candidats",
            get(offres_emploi_controller::find_matching_candidats),
        )
        // Statistiques
        .route(
            "/api/offres-emploi/{id}/stats",
            get(offres_emploi_controller::get_offre_stats),
        )
        // Dashboard employeur
        .route(
            "/api/offres-emploi/dashboard/employeur",
            get(offres_emploi_controller::get_dashboard_employeur),
        )
        // Endpoints IA
        .route(
            "/api/offres-emploi/ai/matching",
            post(offres_emploi_controller::ai_matching),
        )
        .route(
            "/api/offres-emploi/ai/analyze-cv",
            post(offres_emploi_controller::ai_analyze_cv),
        )
        .route(
            "/api/offres-emploi/ai/suggest-formations",
            post(offres_emploi_controller::ai_suggest_formations),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state.clone());

    // Combiner routes publiques et protégées
    Router::new().merge(public_routes).merge(protected_routes).with_state(state)
}
