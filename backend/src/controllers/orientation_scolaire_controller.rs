// ✅ Contrôleur pour orientation scolaire et établissements

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::orientation_ai::{
    AnalyzeProfileRequest, CompareProgramsRequest, GenerateRecommendationsRequest,
};
use crate::models::orientation_scolaire::{
    CreateConcoursRequest, CreateConferenceRequest, CreateEtablissementRequest,
    CreateExperienceRequest, CreateFournituresRequest, CreateProgrammeRequest,
    EtablissementScolaire, SearchConcoursRequest, SearchConferencesRequest,
    SearchEtablissementsRequest, SearchExperiencesRequest, SearchFournituresRequest,
    SearchProgrammesRequest, SuggestEtablissementsRequest, UpdateStatistiquesExamensRequest,
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
use chrono::{Datelike, Duration, NaiveDate, Utc};
use log::info;
use serde::Deserialize;
use serde_json::json;
use sqlx;
use std::collections::HashSet;
use std::sync::Arc;

/// Vérifie que l'établissement appartient à l'utilisateur (routes partenaire protégées).
async fn ensure_etablissement_owner(
    pool: &sqlx::PgPool,
    user_id: i32,
    etablissement_id: i32,
) -> AppResult<()> {
    let owner: Option<i32> = sqlx::query_scalar(
        "SELECT user_id FROM etablissements_scolaires WHERE id = $1",
    )
    .bind(etablissement_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur lecture établissement: {}", e)))?;
    match owner {
        Some(uid) if uid == user_id => Ok(()),
        Some(_) => Err(AppError::Forbidden(
            "Accès refusé : cet établissement ne vous appartient pas.".to_string(),
        )),
        None => Err(AppError::NotFound("Établissement introuvable".to_string())),
    }
}

/// Crée une entrée `services` pour rattacher l'établissement au catalogue Yukpo.
async fn create_orientation_service_row(
    pool: &sqlx::PgPool,
    user_id: i32,
    nom_etablissement: &str,
) -> AppResult<i32> {
    let data = json!({
        "kind": "orientation_etablissement",
        "nom_etablissement": nom_etablissement,
        "source": "orientation_scolaire_controller",
    });
    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO services (user_id, data, is_active, created_at, updated_at)
        VALUES ($1, $2::jsonb, TRUE, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(data)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        AppError::Internal(format!(
            "Erreur création service pour établissement scolaire: {}",
            e
        ))
    })?;
    Ok(id)
}

/// GET /api/orientation/etablissements/mine
/// Liste des établissements rattachés au compte (tableau de bord partenaire + rattachement manuels Yukpo).
pub async fn get_my_etablissements(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let rows: Vec<EtablissementScolaire> = sqlx::query_as::<_, EtablissementScolaire>(
        "SELECT * FROM etablissements_scolaires WHERE user_id = $1 ORDER BY id DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    Ok(Json(json!({
        "success": true,
        "data": {
            "etablissements": rows,
            "programs": [],
            "formations": [],
            "inscriptions_count": 0
        }
    })))
}

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

    let service_id =
        create_orientation_service_row(&state.pg, user_id, &request.nom_etablissement).await?;

    let service = OrientationScolaireService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let etablissement = service.create_etablissement(user_id, service_id, request).await?;

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

    ensure_etablissement_owner(&state.pg, user_id, etablissement_id).await?;

    let service = OrientationScolaireService::new(Arc::new(state.pg.clone()), Arc::clone(&state));
    let etablissement = service.update_statistiques_examens(etablissement_id, request).await?;

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

    ensure_etablissement_owner(&state.pg, user_id, request.etablissement_id).await?;

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
    let (programmes, total) =
        service.get_programmes_by_etablissement(etablissement_id, page, limit).await?;

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

    ensure_etablissement_owner(&state.pg, user_id, request.etablissement_id).await?;

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
    let (fournitures, total) =
        service.get_fournitures_by_etablissement(etablissement_id, page, limit).await?;

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
    let (experiences, _total) =
        service.list_experiences_by_etablissement(etablissement_id, None, None).await?;

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
            profile.moyenne_generale.map(|m| m.to_string().parse().unwrap_or(0.0)),
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
    let analytics: Option<crate::models::orientation_ai::OrientationAnalytics> =
        if let Some(etablissement_id) = etablissement_id_filter {
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

    let summary = analytics.as_ref().map(|a| {
        json!({
            "views": a.nombre_vues,
            "profile_views": a.nombre_vues,
            "contact_clicks": a.nombre_contacts,
            "searches": a.nombre_recommendations,
            "cta_clicks": a.nombre_contacts,
            "inscriptions": a.nombre_inscriptions,
        })
    });

    Ok(Json(json!({ "success": true, "analytics": analytics, "summary": summary })))
}

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub etablissement_id: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct TrackOrientationAnalyticsRequest {
    /// Requis sauf pour `candidature_conversion` avec `offre_id` (emploi).
    pub etablissement_id: Option<i32>,
    pub event_type: String, // profile_view | contact_click | filiere_search | candidature_conversion
    pub filiere: Option<String>,
    pub source: Option<String>,
    pub metadata: Option<serde_json::Value>,
    /// Candidature depuis une offre d'emploi (sans rattachement établissement scolaire).
    pub offre_id: Option<i32>,
}

/// Requête unique pour enregistrer plusieurs `filiere_search` (recherche orientation) en une transaction logique côté serveur.
#[derive(Debug, Deserialize)]
pub struct TrackFiliereSearchBatchRequest {
    pub filiere: String,
    pub source: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub etablissement_ids: Vec<i32>,
}

#[derive(Debug, Deserialize)]
pub struct NormalizedAnalyticsQuery {
    pub etablissement_id: Option<i32>,
    pub days: Option<i64>,
}

async fn ensure_orientation_analytics_tables(state: &AppState) -> Result<(), AppError> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS orientation_analytics_events (
            id BIGSERIAL PRIMARY KEY,
            etablissement_id INTEGER REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
            owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('profile_view','contact_click','filiere_search','candidature_conversion')),
            filiere VARCHAR(150),
            source VARCHAR(100),
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création table analytics events: {}", e)))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_orientation_analytics_events_etab_time ON orientation_analytics_events(etablissement_id, created_at DESC)",
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur index analytics events: {}", e)))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_orientation_analytics_events_type ON orientation_analytics_events(event_type, created_at DESC)",
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur index type analytics events: {}", e)))?;

    let _ = sqlx::query(
        "ALTER TABLE orientation_analytics_events ALTER COLUMN etablissement_id DROP NOT NULL",
    )
    .execute(&state.pg)
    .await;

    Ok(())
}

fn current_month_period() -> (NaiveDate, NaiveDate) {
    let now = Utc::now().date_naive();
    let start = NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap_or(now);
    let next_start = if now.month() == 12 {
        NaiveDate::from_ymd_opt(now.year() + 1, 1, 1).unwrap_or(start)
    } else {
        NaiveDate::from_ymd_opt(now.year(), now.month() + 1, 1).unwrap_or(start)
    };
    let end = next_start - Duration::days(1);
    (start, end)
}

/// Enregistre un `filiere_search` pour un établissement (événement + agrégats mensuels + répartition filières).
async fn apply_filiere_search_for_etablissement(
    state: &Arc<AppState>,
    etablissement_id: i32,
    filiere: &str,
    source: Option<&str>,
    metadata: serde_json::Value,
) -> AppResult<()> {
    let owner_user_id: Option<i32> =
        sqlx::query_scalar("SELECT user_id FROM etablissements_scolaires WHERE id = $1")
            .bind(etablissement_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur lecture établissement: {}", e)))?;

    let owner_user_id = owner_user_id
        .ok_or_else(|| AppError::NotFound("Établissement introuvable".to_string()))?;

    sqlx::query(
        r#"
        INSERT INTO orientation_analytics_events (etablissement_id, owner_user_id, actor_user_id, event_type, filiere, source, metadata)
        VALUES ($1, $2, NULL, $3, $4, $5, $6::jsonb)
        "#,
    )
    .bind(etablissement_id)
    .bind(owner_user_id)
    .bind("filiere_search")
    .bind(filiere)
    .bind(source)
    .bind(metadata)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur insertion event analytics: {}", e)))?;

    let (periode_debut, periode_fin) = current_month_period();
    let profile_view_inc = 0i32;
    let contact_click_inc = 0i32;
    let recommendation_inc = 1i32;
    let inscription_inc = 0i32;

    sqlx::query(
        r#"
        INSERT INTO orientation_analytics (
            etablissement_id, user_id, nombre_vues, nombre_contacts, nombre_recommendations, nombre_comparaisons, nombre_inscriptions,
            repartition_niveaux, repartition_filieres, repartition_villes, score_satisfaction, score_popularite,
            periode_debut, periode_fin
        )
        VALUES ($1, $2, $3, $4, $5, 0, $6, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, NULL, 0, $7, $8)
        ON CONFLICT (etablissement_id, user_id, periode_debut, periode_fin)
        DO UPDATE SET
            nombre_vues = orientation_analytics.nombre_vues + EXCLUDED.nombre_vues,
            nombre_contacts = orientation_analytics.nombre_contacts + EXCLUDED.nombre_contacts,
            nombre_recommendations = orientation_analytics.nombre_recommendations + EXCLUDED.nombre_recommendations,
            nombre_inscriptions = orientation_analytics.nombre_inscriptions + EXCLUDED.nombre_inscriptions,
            updated_at = NOW()
        "#,
    )
    .bind(etablissement_id)
    .bind(owner_user_id)
    .bind(profile_view_inc)
    .bind(contact_click_inc)
    .bind(recommendation_inc)
    .bind(inscription_inc)
    .bind(periode_debut)
    .bind(periode_fin)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur upsert analytics mensuel: {}", e)))?;

    let current_map: Option<serde_json::Value> = sqlx::query_scalar(
        r#"
        SELECT repartition_filieres
        FROM orientation_analytics
        WHERE etablissement_id = $1 AND user_id = $2 AND periode_debut = $3 AND periode_fin = $4
        "#,
    )
    .bind(etablissement_id)
    .bind(owner_user_id)
    .bind(periode_debut)
    .bind(periode_fin)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur lecture repartition_filieres: {}", e)))?;

    let mut map = current_map
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default();
    let current = map.get(filiere).and_then(|v| v.as_i64()).unwrap_or(0);
    map.insert(filiere.to_string(), json!(current + 1));

    sqlx::query(
        r#"
        UPDATE orientation_analytics
        SET repartition_filieres = $1::jsonb, updated_at = NOW()
        WHERE etablissement_id = $2 AND user_id = $3 AND periode_debut = $4 AND periode_fin = $5
        "#,
    )
    .bind(serde_json::Value::Object(map))
    .bind(etablissement_id)
    .bind(owner_user_id)
    .bind(periode_debut)
    .bind(periode_fin)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update repartition_filieres: {}", e)))?;

    Ok(())
}

/// POST /api/orientation/analytics/track-filiere-search-batch
/// Agrège plusieurs `filiere_search` en un seul appel (même effet que N appels `/track` par établissement).
pub async fn track_filiere_search_batch(
    State(state): State<Arc<AppState>>,
    Json(request): Json<TrackFiliereSearchBatchRequest>,
) -> AppResult<impl IntoResponse> {
    ensure_orientation_analytics_tables(&state).await?;

    let filiere = request.filiere.trim();
    if filiere.is_empty() {
        return Err(AppError::BadRequest(
            "filiere requise pour le batch filiere_search".to_string(),
        ));
    }

    let mut seen = HashSet::new();
    let mut ids: Vec<i32> = Vec::new();
    for id in request.etablissement_ids {
        if seen.insert(id) {
            ids.push(id);
        }
        if ids.len() >= 50 {
            break;
        }
    }

    let mut base = request.metadata.unwrap_or_else(|| json!({}));
    if let Some(obj) = base.as_object_mut() {
        obj.entry("aggregated_batch".to_string())
            .or_insert(json!(true));
        obj.entry("batch_etablissement_count".to_string())
            .or_insert(json!(ids.len()));
    }

    let mut applied: u32 = 0;
    for eid in ids {
        let mut row_meta = base.clone();
        if let Some(obj) = row_meta.as_object_mut() {
            obj.insert("etablissement_id".to_string(), json!(eid));
        }
        match apply_filiere_search_for_etablissement(
            &state,
            eid,
            filiere,
            request.source.as_deref(),
            row_meta,
        )
        .await
        {
            Ok(()) => applied += 1,
            Err(AppError::NotFound(_)) => {}
            Err(e) => return Err(e),
        }
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Batch filiere_search enregistré",
            "applied": applied,
        })),
    ))
}

/// POST /api/orientation/analytics/track
/// Track normalisé d'événements analytics établissement
pub async fn track_analytics_event(
    State(state): State<Arc<AppState>>,
    Json(request): Json<TrackOrientationAnalyticsRequest>,
) -> AppResult<impl IntoResponse> {
    ensure_orientation_analytics_tables(&state).await?;

    let valid_types = [
        "profile_view",
        "contact_click",
        "filiere_search",
        "candidature_conversion",
    ];
    if !valid_types.contains(&request.event_type.as_str()) {
        return Err(AppError::BadRequest(
            "event_type invalide. Types: profile_view|contact_click|filiere_search|candidature_conversion".to_string(),
        ));
    }

    // Candidature depuis une offre d'emploi : événement seul sans agrégation établissement.
    if request.event_type == "candidature_conversion" {
        if let Some(oid) = request.offre_id {
            let mut metadata = request.metadata.clone().unwrap_or_else(|| json!({}));
            if let Some(obj) = metadata.as_object_mut() {
                obj.entry("offre_id".to_string()).or_insert(json!(oid));
            }
            sqlx::query(
                r#"
            INSERT INTO orientation_analytics_events (etablissement_id, owner_user_id, actor_user_id, event_type, filiere, source, metadata)
            VALUES (NULL, NULL, NULL, $1, NULL, $2, $3::jsonb)
            "#,
            )
            .bind(&request.event_type)
            .bind(request.source.as_deref().unwrap_or("offre_emploi"))
            .bind(metadata)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur insertion event analytics emploi: {}", e)))?;

            return Ok((
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "message": "Event analytics enregistré"
                })),
            ));
        }
    }

    let etablissement_id = request.etablissement_id.ok_or_else(|| {
        AppError::BadRequest("etablissement_id requis pour cet événement".to_string())
    })?;

    if request.event_type == "filiere_search" {
        let filiere = request
            .filiere
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| {
                AppError::BadRequest("filiere requise pour filiere_search".to_string())
            })?;
        let metadata = request.metadata.clone().unwrap_or_else(|| json!({}));
        apply_filiere_search_for_etablissement(
            &state,
            etablissement_id,
            filiere,
            request.source.as_deref(),
            metadata,
        )
        .await?;
        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "message": "Event analytics enregistré"
            })),
        ));
    }

    let owner_user_id: Option<i32> =
        sqlx::query_scalar("SELECT user_id FROM etablissements_scolaires WHERE id = $1")
            .bind(etablissement_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur lecture établissement: {}", e)))?;

    let owner_user_id = owner_user_id
        .ok_or_else(|| AppError::NotFound("Établissement introuvable".to_string()))?;

    let metadata = request.metadata.clone().unwrap_or_else(|| json!({}));

    sqlx::query(
        r#"
        INSERT INTO orientation_analytics_events (etablissement_id, owner_user_id, actor_user_id, event_type, filiere, source, metadata)
        VALUES ($1, $2, NULL, $3, $4, $5, $6::jsonb)
        "#,
    )
    .bind(etablissement_id)
    .bind(owner_user_id)
    .bind(&request.event_type)
    .bind(&request.filiere)
    .bind(&request.source)
    .bind(metadata)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur insertion event analytics: {}", e)))?;

    let (periode_debut, periode_fin) = current_month_period();
    let profile_view_inc = i32::from(request.event_type == "profile_view");
    let contact_click_inc = i32::from(request.event_type == "contact_click");
    let recommendation_inc = 0i32;
    let inscription_inc = i32::from(request.event_type == "candidature_conversion");

    sqlx::query(
        r#"
        INSERT INTO orientation_analytics (
            etablissement_id, user_id, nombre_vues, nombre_contacts, nombre_recommendations, nombre_comparaisons, nombre_inscriptions,
            repartition_niveaux, repartition_filieres, repartition_villes, score_satisfaction, score_popularite,
            periode_debut, periode_fin
        )
        VALUES ($1, $2, $3, $4, $5, 0, $6, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, NULL, 0, $7, $8)
        ON CONFLICT (etablissement_id, user_id, periode_debut, periode_fin)
        DO UPDATE SET
            nombre_vues = orientation_analytics.nombre_vues + EXCLUDED.nombre_vues,
            nombre_contacts = orientation_analytics.nombre_contacts + EXCLUDED.nombre_contacts,
            nombre_recommendations = orientation_analytics.nombre_recommendations + EXCLUDED.nombre_recommendations,
            nombre_inscriptions = orientation_analytics.nombre_inscriptions + EXCLUDED.nombre_inscriptions,
            updated_at = NOW()
        "#,
    )
    .bind(etablissement_id)
    .bind(owner_user_id)
    .bind(profile_view_inc)
    .bind(contact_click_inc)
    .bind(recommendation_inc)
    .bind(inscription_inc)
    .bind(periode_debut)
    .bind(periode_fin)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur upsert analytics mensuel: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Event analytics enregistré"
        })),
    ))
}

/// GET /api/orientation/analytics/normalized
/// Dashboard normalisé des métriques établissement
pub async fn get_analytics_normalized(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<NormalizedAnalyticsQuery>,
) -> AppResult<impl IntoResponse> {
    ensure_orientation_analytics_tables(&state).await?;

    let days = params.days.unwrap_or(30).clamp(1, 3650);
    let from_ts = Utc::now() - Duration::days(days);

    let etablissement_id = if let Some(id) = params.etablissement_id {
        let owner: Option<i32> =
            sqlx::query_scalar("SELECT user_id FROM etablissements_scolaires WHERE id = $1")
                .bind(id)
                .fetch_optional(&state.pg)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur vérification propriétaire: {}", e)))?;
        if owner != Some(user_id) {
            return Err(AppError::Forbidden(
                "Accès analytics refusé pour cet établissement".to_string(),
            ));
        }
        Some(id)
    } else {
        None
    };

    let summary = if let Some(etab_id) = etablissement_id {
        sqlx::query_as::<_, (i64, i64, i64, i64)>(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE event_type = 'profile_view') AS profile_views,
                COUNT(*) FILTER (WHERE event_type = 'contact_click') AS contact_clicks,
                COUNT(*) FILTER (WHERE event_type = 'filiere_search') AS filiere_searches,
                COUNT(*) FILTER (WHERE event_type = 'candidature_conversion') AS candidatures
            FROM orientation_analytics_events
            WHERE etablissement_id = $1 AND created_at >= $2
            "#,
        )
        .bind(etab_id)
        .bind(from_ts)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur summary analytics: {}", e)))?
    } else {
        sqlx::query_as::<_, (i64, i64, i64, i64)>(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE event_type = 'profile_view') AS profile_views,
                COUNT(*) FILTER (WHERE event_type = 'contact_click') AS contact_clicks,
                COUNT(*) FILTER (WHERE event_type = 'filiere_search') AS filiere_searches,
                COUNT(*) FILTER (WHERE event_type = 'candidature_conversion') AS candidatures
            FROM orientation_analytics_events
            WHERE owner_user_id = $1 AND created_at >= $2
            "#,
        )
        .bind(user_id)
        .bind(from_ts)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur summary analytics owner: {}", e)))?
    };

    let by_filiere_rows = if let Some(etab_id) = etablissement_id {
        sqlx::query_as::<_, (Option<String>, i64)>(
            r#"
            SELECT filiere, COUNT(*)::bigint
            FROM orientation_analytics_events
            WHERE etablissement_id = $1 AND event_type = 'filiere_search' AND created_at >= $2
            GROUP BY filiere
            ORDER BY COUNT(*) DESC
            "#,
        )
        .bind(etab_id)
        .bind(from_ts)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur by_filiere analytics: {}", e)))?
    } else {
        sqlx::query_as::<_, (Option<String>, i64)>(
            r#"
            SELECT filiere, COUNT(*)::bigint
            FROM orientation_analytics_events
            WHERE owner_user_id = $1 AND event_type = 'filiere_search' AND created_at >= $2
            GROUP BY filiere
            ORDER BY COUNT(*) DESC
            "#,
        )
        .bind(user_id)
        .bind(from_ts)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur by_filiere owner analytics: {}", e)))?
    };

    let trend_rows = if let Some(etab_id) = etablissement_id {
        sqlx::query_as::<_, (NaiveDate, i64, i64, i64, i64)>(
            r#"
            SELECT
                DATE(created_at) AS day,
                COUNT(*) FILTER (WHERE event_type = 'profile_view')::bigint AS profile_views,
                COUNT(*) FILTER (WHERE event_type = 'contact_click')::bigint AS contact_clicks,
                COUNT(*) FILTER (WHERE event_type = 'filiere_search')::bigint AS filiere_searches,
                COUNT(*) FILTER (WHERE event_type = 'candidature_conversion')::bigint AS candidatures
            FROM orientation_analytics_events
            WHERE etablissement_id = $1 AND created_at >= $2
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            "#,
        )
        .bind(etab_id)
        .bind(from_ts)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur trend analytics: {}", e)))?
    } else {
        sqlx::query_as::<_, (NaiveDate, i64, i64, i64, i64)>(
            r#"
            SELECT
                DATE(created_at) AS day,
                COUNT(*) FILTER (WHERE event_type = 'profile_view')::bigint AS profile_views,
                COUNT(*) FILTER (WHERE event_type = 'contact_click')::bigint AS contact_clicks,
                COUNT(*) FILTER (WHERE event_type = 'filiere_search')::bigint AS filiere_searches,
                COUNT(*) FILTER (WHERE event_type = 'candidature_conversion')::bigint AS candidatures
            FROM orientation_analytics_events
            WHERE owner_user_id = $1 AND created_at >= $2
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            "#,
        )
        .bind(user_id)
        .bind(from_ts)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur trend owner analytics: {}", e)))?
    };

    let profile_views = summary.0.max(0) as f64;
    let candidatures = summary.3.max(0) as f64;
    let contact_clicks = summary.1.max(0) as f64;
    let conversion_rate = if profile_views > 0.0 {
        (candidatures / profile_views) * 100.0
    } else {
        0.0
    };
    let contact_rate = if profile_views > 0.0 {
        (contact_clicks / profile_views) * 100.0
    } else {
        0.0
    };

    let by_filiere = by_filiere_rows
        .into_iter()
        .filter_map(|(filiere, count)| filiere.map(|f| json!({ "filiere": f, "count": count })))
        .collect::<Vec<_>>();
    let trend = trend_rows
        .into_iter()
        .map(|(day, views, clicks, searches, conv)| {
            json!({
                "date": day.to_string(),
                "profile_views": views,
                "contact_clicks": clicks,
                "filiere_searches": searches,
                "candidatures": conv
            })
        })
        .collect::<Vec<_>>();

    Ok(Json(json!({
        "success": true,
        "data": {
            "window_days": days,
            "etablissement_id": etablissement_id,
            "summary": {
                "profile_views": summary.0,
                "contact_clicks": summary.1,
                "filiere_searches": summary.2,
                "candidatures": summary.3,
                "conversion_rate": conversion_rate,
                "contact_rate": contact_rate
            },
            "by_filiere": by_filiere,
            "trend": trend
        }
    })))
}

/// ✅ NOUVEAU: POST /api/orientation/ai/academic-search
/// Recherche académique IA - Utilise le système d'orchestration IA complet avec prompts réels
#[derive(Debug, Deserialize)]
pub struct AcademicSearchRequest {
    pub query: String,
    pub context: Option<serde_json::Value>,
}

pub async fn ai_academic_search(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<AcademicSearchRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[ai_academic_search] User ID: {}, Query: {}",
        user_id, request.query
    );

    // ✅ UTILISER LE SYSTÈME D'ORCHESTRATION IA COMPLET
    use crate::services::orientation_scolaire_ai_service::OrientationScolaireAIService;

    let _ai_service = OrientationScolaireAIService::new(state.ia.clone());

    // ✅ CHARGER LE PROMPT SPÉCIFIQUE pour recherche académique depuis le fichier markdown
    use crate::services::ia::prompt_loader::load_prompt_section_with_vars;
    use std::collections::HashMap;

    let mut variables = HashMap::new();
    variables.insert("query".to_string(), request.query.clone());
    if let Some(context) = &request.context {
        variables.insert(
            "context".to_string(),
            serde_json::to_string(context).unwrap_or_default(),
        );
    } else {
        variables.insert(
            "context".to_string(),
            "Aucun contexte additionnel".to_string(),
        );
    }

    // Charger le prompt depuis le fichier markdown
    let prompt = load_prompt_section_with_vars(
        "orientation_scolaire",
        "Recherche Académique",
        &variables,
    )
    .await
    .unwrap_or_else(|e| {
        log::warn!(
            "[ai_academic_search] Erreur chargement prompt, utilisation fallback: {}",
            e
        );
        format!(
            r#"
Tu es l'assistant académique intelligent de Yukpo, spécialisé dans l'orientation scolaire et l'éducation.

Question académique : {}

Réponds de manière précise et détaillée. Adapte tes réponses au système éducatif camerounais/africain.
"#,
            request.query
        )
    });

    // ✅ APPEL IA RÉEL via app_ia.predict() - Système d'orchestration IA complet
    let (model_name, response, tokens_consumed) = state.ia.predict(&prompt).await?;

    log::info!(
        "[ai_academic_search] ✅ Réponse générée avec {} (tokens: {})",
        model_name,
        tokens_consumed
    );

    // Nettoyer la réponse (extraire le JSON si présent, sinon utiliser le texte directement)
    let response_text = if response.contains("```json") {
        // Si la réponse contient du JSON, extraire le texte de la réponse
        response
            .split("```json")
            .nth(1)
            .and_then(|s| s.split("```").next())
            .unwrap_or(&response)
            .trim()
            .to_string()
    } else if response.contains("```") {
        response
            .split("```")
            .nth(1)
            .and_then(|s| s.split("```").next())
            .unwrap_or(&response)
            .trim()
            .to_string()
    } else {
        response.trim().to_string()
    };

    Ok(Json(json!({
        "success": true,
        "response": response_text,
        "tokens_consumed": tokens_consumed,
        "model_used": model_name
    })))
}
