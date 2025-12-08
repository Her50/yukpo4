// Contrôleur pour les offres d'emploi et matching intelligent

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::emploi_ai::{
    AnalyzeCVRequest, ImprovedMatchingRequest, SuggestFormationsRequest,
};
use crate::models::offres_emploi_model::{
    CreateAlerteEmploiRequest, CreateCandidatureRequest, CreateOffreEmploiRequest,
    CreateOrUpdateProfilRequest, SearchOffresRequest, UpdateStatutCandidatureRequest,
};
use crate::services::{
    alertes_emploi_service::AlertesEmploiService, candidatures_service::CandidaturesService,
    emploi_ai_service::EmploiAIService, matching_emploi_service::MatchingEmploiService,
    offres_emploi_service::OffresEmploiService, profils_candidats_service::ProfilsCandidatsService,
    statistiques_emploi_service::StatistiquesEmploiService,
};
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::Deserialize;
use serde_json::json;
use sqlx;
use std::sync::Arc;

// ==================== ROUTES PUBLIQUES ====================

/// Recherche publique d'offres d'emploi
pub async fn search_offres(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchOffresRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[search_offres] Recherche publique d'offres");

    let service = OffresEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let (offres, total) = service.search_offres(query).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": offres,
            "total": total
        })),
    ))
}

/// Détails d'une offre (publique)
pub async fn get_offre_details(
    State(state): State<Arc<AppState>>,
    Path(offre_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_offre_details] Détails offre_id={}", offre_id);

    let service = OffresEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let offre = service.get_offre_details(offre_id).await?;

    // Incrémenter les vues
    let _ = service.increment_vues(offre_id).await;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": offre
        })),
    ))
}

// ==================== ROUTES PROTÉGÉES - CANDIDATS ====================

/// Crée ou met à jour le profil candidat
pub async fn create_or_update_profil(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateOrUpdateProfilRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[create_or_update_profil] user_id={}", user_id);

    let service = ProfilsCandidatsService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let profil = service.create_or_update_profil(user_id, request).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": profil
        })),
    ))
}

/// Récupère le profil candidat
pub async fn get_profil(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_profil] user_id={}", user_id);

    let service = ProfilsCandidatsService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let profil = service.get_profil(user_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": profil
        })),
    ))
}

/// Trouve les offres correspondantes pour un candidat (avec matching)
pub async fn find_matching_offres(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<FindMatchingQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[find_matching_offres] user_id={}", user_id);

    let matching_service =
        MatchingEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let matchings = matching_service
        .find_matching_offres(user_id, params.min_score, params.limit)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": matchings
        })),
    ))
}

/// Crée une candidature
pub async fn create_candidature(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateCandidatureRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_candidature] user_id={}, offre_id={}",
        user_id, request.offre_id
    );

    let service = CandidaturesService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let candidature = service.create_candidature(user_id, request).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": candidature
        })),
    ))
}

/// Liste les candidatures d'un candidat
pub async fn list_my_candidatures(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<ListCandidaturesQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[list_my_candidatures] user_id={}", user_id);

    let service = CandidaturesService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let (candidatures, total) = service
        .list_candidatures_candidat(user_id, params.statut, params.page, params.limit)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": candidatures,
            "total": total
        })),
    ))
}

/// Crée une alerte emploi
pub async fn create_alerte(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateAlerteEmploiRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[create_alerte] user_id={}", user_id);

    let service = AlertesEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let alerte = service.create_alerte(user_id, request).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": alerte
        })),
    ))
}

/// Liste les alertes d'un candidat
pub async fn list_my_alertes(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_my_alertes] user_id={}", user_id);

    let service = AlertesEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let alertes = service.list_alertes_candidat(user_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": alertes
        })),
    ))
}

/// Tableau de bord candidat
pub async fn get_dashboard_candidat(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_dashboard_candidat] user_id={}", user_id);

    let service =
        StatistiquesEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let dashboard = service.get_dashboard_candidat(user_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": dashboard
        })),
    ))
}

// ==================== ROUTES PROTÉGÉES - EMPLOYEURS ====================

/// Crée une offre d'emploi
pub async fn create_offre(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateOffreEmploiRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[create_offre] user_id={}", user_id);

    let service = OffresEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let offre = service.create_offre(user_id, request).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": offre
        })),
    ))
}

/// Liste les offres d'un employeur
pub async fn list_my_offres(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<ListOffresQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[list_my_offres] user_id={}", user_id);

    let offres = sqlx::query_as::<_, crate::models::offres_emploi_model::OffreEmploi>(
        r#"
        SELECT * FROM offres_emploi
        WHERE entreprise_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user_id)
    .bind(params.limit.unwrap_or(20))
    .bind((params.page.unwrap_or(1) - 1) * params.limit.unwrap_or(20))
    .fetch_all(&_state.pg)
    .await
    .map_err(|e| {
        error!("[list_my_offres] Erreur: {}", e);
        AppError::Internal(format!("Erreur liste offres: {}", e))
    })?;

    let total: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM offres_emploi WHERE entreprise_id = $1")
            .bind(user_id)
            .fetch_one(&_state.pg)
            .await
            .unwrap_or(0);

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": offres,
            "total": total
        })),
    ))
}

/// Ferme une offre (statut 'pourvue' ou 'fermee')
pub async fn close_offre(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(offre_id): Path<i32>,
    Json(request): Json<CloseOffreRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[close_offre] user_id={}, offre_id={}", user_id, offre_id);

    // Vérifier que l'offre appartient à l'utilisateur
    let offre_owner: Option<i32> =
        sqlx::query_scalar("SELECT entreprise_id FROM offres_emploi WHERE id = $1")
            .bind(offre_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[close_offre] Erreur: {}", e);
                AppError::Internal(format!("Erreur vérification offre: {}", e))
            })?;

    if offre_owner != Some(user_id) {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette offre".to_string(),
        ));
    }

    let service = OffresEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    service.close_offre(offre_id, request.statut).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Offre fermée avec succès"
        })),
    ))
}

/// Liste les candidatures pour une offre (employeur)
pub async fn list_candidatures_offre(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(offre_id): Path<i32>,
    Query(params): Query<ListCandidaturesQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[list_candidatures_offre] user_id={}, offre_id={}",
        user_id, offre_id
    );

    // Vérifier que l'offre appartient à l'utilisateur
    let offre_owner: Option<i32> =
        sqlx::query_scalar("SELECT entreprise_id FROM offres_emploi WHERE id = $1")
            .bind(offre_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[list_candidatures_offre] Erreur: {}", e);
                AppError::Internal(format!("Erreur vérification offre: {}", e))
            })?;

    if offre_owner != Some(user_id) {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette offre".to_string(),
        ));
    }

    let service = CandidaturesService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let (candidatures, total) = service
        .list_candidatures_offre(offre_id, params.statut, params.page, params.limit)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": candidatures,
            "total": total
        })),
    ))
}

/// Met à jour le statut d'une candidature (employeur)
pub async fn update_statut_candidature(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(candidature_id): Path<i32>,
    Json(request): Json<UpdateStatutCandidatureRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_statut_candidature] user_id={}, candidature_id={}",
        user_id, candidature_id
    );

    // Vérifier que la candidature appartient à une offre de l'utilisateur
    let offre_owner: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT o.entreprise_id FROM candidatures c
        JOIN offres_emploi o ON o.id = c.offre_id
        WHERE c.id = $1
        "#,
    )
    .bind(candidature_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[update_statut_candidature] Erreur: {}", e);
        AppError::Internal(format!("Erreur vérification candidature: {}", e))
    })?;

    if offre_owner != Some(user_id) {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette offre".to_string(),
        ));
    }

    let service = CandidaturesService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let candidature = service
        .update_statut_candidature(candidature_id, request)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": candidature
        })),
    ))
}

/// Trouve les candidats correspondants pour une offre (employeur)
pub async fn find_matching_candidats(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(offre_id): Path<i32>,
    Query(params): Query<FindMatchingQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[find_matching_candidats] user_id={}, offre_id={}",
        user_id, offre_id
    );

    // Vérifier que l'offre appartient à l'utilisateur
    let offre_owner: Option<i32> =
        sqlx::query_scalar("SELECT entreprise_id FROM offres_emploi WHERE id = $1")
            .bind(offre_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[find_matching_candidats] Erreur: {}", e);
                AppError::Internal(format!("Erreur vérification offre: {}", e))
            })?;

    if offre_owner != Some(user_id) {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette offre".to_string(),
        ));
    }

    let matching_service =
        MatchingEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let matchings = matching_service
        .find_matching_candidats(offre_id, params.min_score, params.limit)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": matchings
        })),
    ))
}

/// Statistiques d'une offre (employeur)
pub async fn get_offre_stats(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(offre_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_offre_stats] user_id={}, offre_id={}",
        user_id, offre_id
    );

    // Vérifier que l'offre appartient à l'utilisateur
    let offre_owner: Option<i32> =
        sqlx::query_scalar("SELECT entreprise_id FROM offres_emploi WHERE id = $1")
            .bind(offre_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[get_offre_stats] Erreur: {}", e);
                AppError::Internal(format!("Erreur vérification offre: {}", e))
            })?;

    if offre_owner != Some(user_id) {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette offre".to_string(),
        ));
    }

    let service =
        StatistiquesEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let stats = service.calculate_offre_stats(offre_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": stats
        })),
    ))
}

/// Tableau de bord employeur
pub async fn get_dashboard_employeur(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_dashboard_employeur] user_id={}", user_id);

    let service =
        StatistiquesEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let dashboard = service.get_dashboard_employeur(user_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": dashboard
        })),
    ))
}

// ==================== ROUTES PUBLIQUES - TENDANCES ====================

/// Tendances du marché
pub async fn get_tendances_marche(
    State(state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    info!("[get_tendances_marche] Tendances marché");

    let service =
        StatistiquesEmploiService::new(state.pg.clone(), Some(state.redis_client.clone()));
    let tendances = service.get_tendance_marche().await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": tendances
        })),
    ))
}

// ============================================================================
// ENDPOINTS IA - OFFRE D'EMPLOI
// ============================================================================

/// POST /api/offres-emploi/ai/matching
/// Matching intelligent amélioré CV ↔ offres
pub async fn ai_matching(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<ImprovedMatchingRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ai_matching] User ID: {}, Offre ID: {}",
        user_id, request.offre_id
    );

    let ai_service = EmploiAIService::new(state.ia.clone());
    let matching = ai_service
        .generate_improved_matching(
            request.offre_id,
            request.candidat_id,
            &request.titre_poste,
            &request.competences_requises,
            &request.competences_candidat,
            request.experience_requise,
            request.experience_candidat,
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "matching": matching
    })))
}

/// POST /api/offres-emploi/ai/analyze-cv
/// Analyse CV IA
pub async fn ai_analyze_cv(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<AnalyzeCVRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ai_analyze_cv] User ID: {}, Candidat ID: {}",
        user_id, request.candidat_id
    );

    // Vérifier que le candidat est l'utilisateur
    if request.candidat_id != user_id {
        return Err(AppError::Forbidden(
            "Vous ne pouvez analyser que votre propre CV".to_string(),
        ));
    }

    let ai_service = EmploiAIService::new(state.ia.clone());
    let analysis = ai_service
        .analyze_cv(
            request.candidat_id,
            &request.cv_text,
            request.cv_url.as_deref(),
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "analysis": analysis
    })))
}

/// GET /api/offres-emploi/ai/salary-prediction
/// Prédiction salaire IA
pub async fn ai_salary_prediction(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SalaryPredictionQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ai_salary_prediction] Poste: {}, Secteur: {}",
        params.titre_poste, params.secteur
    );

    let ai_service = EmploiAIService::new(state.ia.clone());
    let prediction = ai_service
        .predict_salary(
            &params.titre_poste,
            &params.secteur,
            &params.ville,
            params.experience_annees,
            &params.niveau_etude,
            &params.competences.unwrap_or_default(),
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "prediction": prediction
    })))
}

#[derive(Debug, Deserialize)]
pub struct SalaryPredictionQuery {
    pub titre_poste: String,
    pub secteur: String,
    pub ville: String,
    pub experience_annees: i32,
    pub niveau_etude: String,
    pub competences: Option<Vec<String>>,
}

/// POST /api/offres-emploi/ai/suggest-formations
/// Suggestions formations IA
pub async fn ai_suggest_formations(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<SuggestFormationsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ai_suggest_formations] User ID: {}, Candidat ID: {}",
        user_id, request.candidat_id
    );

    // Vérifier que le candidat est l'utilisateur
    if request.candidat_id != user_id {
        return Err(AppError::Forbidden(
            "Vous ne pouvez demander des suggestions que pour votre profil".to_string(),
        ));
    }

    // TODO: Implémenter suggestions formations dans emploi_ai_service
    Ok(Json(json!({
        "success": true,
        "message": "Suggestions formations à implémenter"
    })))
}

// ==================== QUERY STRUCTS ====================

#[derive(Debug, Deserialize)]
pub struct ListOffresQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ListCandidaturesQuery {
    pub statut: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct FindMatchingQuery {
    pub min_score: Option<f64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CloseOffreRequest {
    pub statut: String,
}
