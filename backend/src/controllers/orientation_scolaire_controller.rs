// ✅ Contrôleur pour orientation scolaire et établissements

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::orientation_ai::{
    AnalyzeProfileRequest, CompareProgramsRequest, GenerateRecommendationsRequest,
};
use crate::models::orientation_scolaire::{
    CreateConcoursRequest, CreateConferenceRequest, CreateEtablissementRequest,
    CreateExperienceRequest, CreateFournituresRequest, CreateProgrammeRequest,
    SearchConcoursRequest, SearchConferencesRequest, SearchEtablissementsRequest,
    SearchExperiencesRequest, SearchFournituresRequest, SearchProgrammesRequest,
    SuggestEtablissementsRequest, UpdateStatistiquesExamensRequest,
};
use crate::services::{
    concours_entree_service::ConcoursEntreeService,
    conferences_lives_service::ConferencesLivesService,
    experiences_etudiants_service::ExperiencesEtudiantsService,
    fournitures_scolaires_service::FournituresScolairesService,
    orientation_scolaire_ai_service::OrientationScolaireAIService,
    orientation_scolaire_service::OrientationScolaireService,
    programmes_scolaires_service::ProgrammesScolairesService,
};
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::info;
use serde::Deserialize;
use serde_json::json;
use sqlx;
use std::sync::Arc;

/// Créer un établissement scolaire
pub async fn create_etablissement(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateEtablissementRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ORIENTATION_SCOLAIRE] Création établissement: user_id={}",
        user_id
    );

    // Créer le service associé d'abord
    // TODO: Intégrer avec le système de services existant
    let service_id = 0; // À remplacer par création réelle du service

    let service = OrientationScolaireService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let etablissement = service
        .create_etablissement(user_id, service_id, request)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": etablissement
        })),
    ))
}

/// Rechercher des établissements
pub async fn search_etablissements(
    State(state): State<Arc<AppState>>,
    Query(request): Query<SearchEtablissementsRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[ORIENTATION_SCOLAIRE] Recherche établissements");

    let page = request.page.unwrap_or(1);
    let limit = request.limit.unwrap_or(20);
    let service = OrientationScolaireService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (etablissements, total) = service.search_etablissements(request).await?;
    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": etablissements,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        })),
    ))
}

/// Obtenir les détails d'un établissement
pub async fn get_etablissement_details(
    State(state): State<Arc<AppState>>,
    Path(etablissement_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ORIENTATION_SCOLAIRE] Get details: id={}",
        etablissement_id
    );

    let service = OrientationScolaireService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let etablissement = service.get_etablissement_details(etablissement_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": etablissement
        })),
    ))
}

/// Mettre à jour les statistiques d'examens
pub async fn update_statistiques_examens(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(etablissement_id): Path<i32>,
    Json(request): Json<UpdateStatistiquesExamensRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ORIENTATION_SCOLAIRE] Update stats: user_id={}, etablissement_id={}",
        user_id, etablissement_id
    );

    // TODO: Vérifier que l'utilisateur est propriétaire de l'établissement

    let service = OrientationScolaireService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let etablissement = service
        .update_statistiques_examens(etablissement_id, request)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": etablissement
        })),
    ))
}

/// Suggestions intelligentes d'établissements
pub async fn suggest_etablissements(
    State(state): State<Arc<AppState>>,
    Query(request): Query<SuggestEtablissementsRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[ORIENTATION_SCOLAIRE] Suggestions");

    let service = OrientationScolaireService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let suggestions = service.suggest_etablissements(request).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": suggestions
        })),
    ))
}

/// Upload un programme scolaire
pub async fn upload_programme(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateProgrammeRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[PROGRAMMES_SCOLAIRES] Upload: user_id={}", user_id);

    // TODO: Vérifier que l'utilisateur est propriétaire de l'établissement

    let service = ProgrammesScolairesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let programme = service.upload_programme(request).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": programme
        })),
    ))
}

/// Obtenir les programmes d'un établissement
pub async fn get_programmes_by_etablissement(
    State(state): State<Arc<AppState>>,
    Path(etablissement_id): Path<i32>,
    Query(params): Query<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let page = params.get("page").and_then(|v| v.as_i64());
    let limit = params.get("limit").and_then(|v| v.as_i64());

    let service = ProgrammesScolairesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (programmes, total) = service
        .get_programmes_by_etablissement(etablissement_id, page, limit)
        .await?;

    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(20);
    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": programmes,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        })),
    ))
}

/// Rechercher des programmes
pub async fn search_programmes(
    State(state): State<Arc<AppState>>,
    Query(request): Query<SearchProgrammesRequest>,
) -> AppResult<impl IntoResponse> {
    let page = request.page.unwrap_or(1);
    let limit = request.limit.unwrap_or(20);
    let service = ProgrammesScolairesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (programmes, total) = service.search_programmes(request).await?;
    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": programmes,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        })),
    ))
}

/// Upload une liste de fournitures
pub async fn upload_fournitures(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateFournituresRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[FOURNITURES_SCOLAIRES] Upload: user_id={}", user_id);

    // TODO: Vérifier que l'utilisateur est propriétaire de l'établissement

    let service = FournituresScolairesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let fournitures = service.upload_fournitures(request).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": fournitures
        })),
    ))
}

/// Obtenir les fournitures d'un établissement
pub async fn get_fournitures_by_etablissement(
    State(state): State<Arc<AppState>>,
    Path(etablissement_id): Path<i32>,
    Query(params): Query<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let page = params.get("page").and_then(|v| v.as_i64());
    let limit = params.get("limit").and_then(|v| v.as_i64());

    let service = FournituresScolairesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (fournitures, total) = service
        .get_fournitures_by_etablissement(etablissement_id, page, limit)
        .await?;

    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(20);
    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": fournitures,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        })),
    ))
}

/// Rechercher des fournitures
pub async fn search_fournitures(
    State(state): State<Arc<AppState>>,
    Query(request): Query<SearchFournituresRequest>,
) -> AppResult<impl IntoResponse> {
    let page = request.page.unwrap_or(1);
    let limit = request.limit.unwrap_or(20);
    let service = FournituresScolairesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (fournitures, total) = service.search_fournitures(request).await?;
    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": fournitures,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        })),
    ))
}

// ============================================================================
// CONCOURS
// ============================================================================

/// Lister les concours actifs
pub async fn list_concours_actifs(
    State(state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    let service = ConcoursEntreeService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (concours, _total) = service.list_concours_actifs(None, None).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": concours
        })),
    ))
}

/// Rechercher des concours
pub async fn search_concours(
    State(state): State<Arc<AppState>>,
    Query(request): Query<SearchConcoursRequest>,
) -> AppResult<impl IntoResponse> {
    let page = request.page.unwrap_or(1);
    let limit = request.limit.unwrap_or(20);
    let service = ConcoursEntreeService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (concours, total) = service.search_concours(request).await?;
    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": concours,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        })),
    ))
}

/// Obtenir les détails d'un concours
pub async fn get_concours_details(
    State(state): State<Arc<AppState>>,
    Path(concours_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let service = ConcoursEntreeService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let concours = service.get_concours_details(concours_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": concours
        })),
    ))
}

/// Créer un concours
pub async fn create_concours(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateConcoursRequest>,
) -> AppResult<impl IntoResponse> {
    let service = ConcoursEntreeService::new(Arc::new(_state.pg.clone()), Arc::clone(&_state));
    let concours = service.create_concours(request).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": concours
        })),
    ))
}

// ============================================================================
// EXPÉRIENCES
// ============================================================================

/// Rechercher des expériences
pub async fn search_experiences(
    State(state): State<Arc<AppState>>,
    Query(request): Query<SearchExperiencesRequest>,
) -> AppResult<impl IntoResponse> {
    let page = request.page.unwrap_or(1);
    let limit = request.limit.unwrap_or(20);
    let service = ExperiencesEtudiantsService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (experiences, total) = service.search_experiences(request).await?;
    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": experiences,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        })),
    ))
}

/// Lister les expériences par établissement
pub async fn list_experiences_by_etablissement(
    State(state): State<Arc<AppState>>,
    Path(etablissement_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let service = ExperiencesEtudiantsService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (experiences, _total) = service
        .list_experiences_by_etablissement(etablissement_id, None, None)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": experiences
        })),
    ))
}

/// Créer une expérience
pub async fn create_experience(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateExperienceRequest>,
) -> AppResult<impl IntoResponse> {
    let service = ExperiencesEtudiantsService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let experience = service.create_experience(user_id, request).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": experience
        })),
    ))
}

// ============================================================================
// CONFÉRENCES
// ============================================================================

/// Lister les conférences programmées
pub async fn list_conferences_programmees(
    State(state): State<Arc<AppState>>,
) -> AppResult<impl IntoResponse> {
    let service = ConferencesLivesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (conferences, _total) = service.list_conferences_programmees(None, None).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": conferences
        })),
    ))
}

/// Rechercher des conférences
pub async fn search_conferences(
    State(state): State<Arc<AppState>>,
    Query(request): Query<SearchConferencesRequest>,
) -> AppResult<impl IntoResponse> {
    let page = request.page.unwrap_or(1);
    let limit = request.limit.unwrap_or(20);
    let service = ConferencesLivesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let (conferences, total) = service.search_conferences(request).await?;
    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": conferences,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        })),
    ))
}

/// Obtenir les détails d'une conférence
pub async fn get_conference_details(
    State(state): State<Arc<AppState>>,
    Path(conference_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let service = ConferencesLivesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let conference = service.get_conference_details(conference_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": conference
        })),
    ))
}

/// Créer une conférence
pub async fn create_conference(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateConferenceRequest>,
) -> AppResult<impl IntoResponse> {
    let service = ConferencesLivesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let conference = service.create_conference(user_id, request).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": conference
        })),
    ))
}

/// Rejoindre une conférence
pub async fn join_conference(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(conference_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let service = ConferencesLivesService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let result = service.join_conference(user_id, conference_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": result
        })),
    ))
}

// ============================================================================
// ENDPOINTS IA - ORIENTATION SCOLAIRE
// ============================================================================

/// POST /api/orientation/ai/analyze-profile
/// Analyse profil étudiant IA
pub async fn ai_analyze_profile(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<AnalyzeProfileRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ai_analyze_profile] User ID: {}, Profile ID: {}",
        user_id, request.profile_id
    );

    // Récupérer le profil depuis la base
    let profile = sqlx::query_as::<_, crate::models::orientation_ai::StudentProfile>(
        "SELECT * FROM student_profiles WHERE id = $1 AND user_id = $2",
    )
    .bind(request.profile_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération profil: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Profil non trouvé".to_string()))?;

    let ai_service = OrientationScolaireAIService::new(state.ia.clone());
    let analysis = ai_service
        .analyze_student_profile(
            profile.id,
            &profile.niveau_actuel.unwrap_or_default(),
            &profile.notes_moyennes,
            profile
                .moyenne_generale
                .map(|m| m.to_string().parse().unwrap_or(0.0)),
            &profile.matieres_preferees,
            &profile.objectifs_carriere,
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "analysis": analysis
    })))
}

/// POST /api/orientation/ai/recommendations
/// Recommandations IA programmes/établissements
pub async fn ai_recommendations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<GenerateRecommendationsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ai_recommendations] User ID: {}, Profile ID: {}",
        user_id, request.student_profile_id
    );

    // Vérifier que le profil appartient à l'utilisateur
    let profile_owner: Option<i32> =
        sqlx::query_scalar("SELECT user_id FROM student_profiles WHERE id = $1")
            .bind(request.student_profile_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification profil: {}", e)))?;

    if profile_owner != Some(user_id) {
        return Err(AppError::Forbidden(
            "Ce profil ne vous appartient pas".to_string(),
        ));
    }

    let ai_service = OrientationScolaireAIService::new(state.ia.clone());
    let filiere_str = request.filiere.clone().unwrap_or_default();
    let recommendation = ai_service
        .generate_program_recommendations(
            request.student_profile_id,
            request.etablissement_id.unwrap_or(0),
            &filiere_str,
            request.specialite.as_deref(),
            request.budget_max,
            &request.preference_localisation.unwrap_or_default(),
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "recommendation": recommendation
    })))
}

/// POST /api/orientation/ai/compare-programs
/// Comparaison programmes IA
pub async fn ai_compare_programs(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CompareProgramsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ai_compare_programs] User ID: {}, Profile ID: {}",
        user_id, request.student_profile_id
    );

    // Vérifier que le profil appartient à l'utilisateur
    let profile_owner: Option<i32> =
        sqlx::query_scalar("SELECT user_id FROM student_profiles WHERE id = $1")
            .bind(request.student_profile_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification profil: {}", e)))?;

    if profile_owner != Some(user_id) {
        return Err(AppError::Forbidden(
            "Ce profil ne vous appartient pas".to_string(),
        ));
    }

    let filiere_1_str = request.filiere_1.clone();
    let filiere_2_str = request.filiere_2.clone();
    let ai_service = OrientationScolaireAIService::new(state.ia.clone());
    let comparison = ai_service
        .compare_programs(
            request.student_profile_id,
            request.etablissement_1_id,
            request.etablissement_2_id,
            &filiere_1_str,
            &filiere_2_str,
            request.specialite_1.as_deref(),
            request.specialite_2.as_deref(),
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "comparison": comparison
    })))
}

/// GET /api/orientation/my-profile
/// Mon profil (JWT)
pub async fn get_my_profile(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_profile] User ID: {}", user_id);

    let profile = sqlx::query_as::<_, crate::models::orientation_ai::StudentProfile>(
        "SELECT * FROM student_profiles WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération profil: {}", e)))?;

    Ok(Json(json!({
        "success": true,
        "profile": profile
    })))
}

/// GET /api/orientation/analytics
/// Analytics établissement (JWT)
pub async fn get_analytics(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<AnalyticsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_analytics] User ID: {}, Etablissement ID: {:?}",
        user_id, params.etablissement_id
    );

    let etablissement_id_filter = params.etablissement_id;
    let analytics: Option<crate::models::orientation_ai::OrientationAnalytics> = if let Some(etablissement_id) = etablissement_id_filter {
        sqlx::query_as::<_, crate::models::orientation_ai::OrientationAnalytics>(
            r#"
            SELECT * FROM orientation_analytics
            WHERE user_id = $1 AND etablissement_id = $2
            ORDER BY periode_debut DESC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .bind(etablissement_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération analytics: {}", e)))?
    } else {
        sqlx::query_as::<_, crate::models::orientation_ai::OrientationAnalytics>(
            r#"
            SELECT * FROM orientation_analytics
            WHERE user_id = $1
            ORDER BY periode_debut DESC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération analytics: {}", e)))?
    };

    Ok(Json(json!({ "success": true, "analytics": analytics })))
}

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub etablissement_id: Option<i32>,
}
