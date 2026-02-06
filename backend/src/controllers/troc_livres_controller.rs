// ✅ NOUVEAU: Contrôleur pour trocs de livres scolaires

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::livre_scolaire::LivreScolaire;
use crate::models::troc_livre::{ChaineTrocLivre, TrocLivre};
use crate::models::troc_livre::{CreateTrocChaineRequest, CreateTrocDirectRequest, MatchingResult};
use crate::services::troc_intelligent_service::TrocIntelligentService as Service;
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
use std::sync::Arc;

/// POST /api/troc-livres/match
/// Trouver des matchings (direct + chaînes) pour un livre
pub async fn find_matchings(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<FindMatchingsRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[find_matchings] Livre ID: {}", payload.livre_id);

    let service = Service::new(Arc::new(state.pg.clone()));

    // Rechercher les matchings directs
    let matchings_direct = service.find_matching_direct(payload.livre_id).await.unwrap_or_default();

    // Rechercher les chaînes si demandé
    let matchings_chaine = if payload.include_chaines.unwrap_or(true) {
        service
            .find_matching_chaine(payload.livre_id, payload.max_participants)
            .await
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    let result = MatchingResult {
        matching_type: "direct_et_chaine".to_string(),
        matches: matchings_direct,
        chaines: matchings_chaine,
    };

    Ok(Json(json!({ "success": true, "matchings": result })))
}

#[derive(Debug, Deserialize)]
pub struct FindMatchingsRequest {
    pub livre_id: i32,
    pub include_chaines: Option<bool>,
    pub max_participants: Option<i32>,
}

/// POST /api/troc-livres/direct
/// Créer un troc direct
pub async fn create_troc_direct(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateTrocDirectRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_troc_direct] User ID: {}, Livre offert: {}, Livre souhaité: {}",
        user_id, payload.livre_offert_id, payload.livre_souhaite_id
    );

    let service = Service::new(Arc::new(state.pg.clone()));
    let troc = service.create_troc_direct(user_id, payload).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "troc": troc })),
    ))
}

/// POST /api/troc-livres/chaine
/// Créer un troc en chaîne
pub async fn create_troc_chaine(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateTrocChaineRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_troc_chaine] Nombre de participants: {}",
        payload.participants.len()
    );

    let service = Service::new(Arc::new(state.pg.clone()));
    let chaine = service.create_troc_chaine(payload).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "chaine": chaine })),
    ))
}

/// GET /api/troc-livres/my-trocs
/// Obtenir mes trocs (en attente, acceptés, complétés)
pub async fn get_my_trocs(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<MyTrocsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_my_trocs] User ID: {}, Statut: {:?}",
        user_id, params.statut
    );

    let statut_filter = params.statut.as_deref();

    let trocs = if let Some(statut) = statut_filter {
        sqlx::query_as::<_, TrocLivre>(
            r#"
            SELECT * FROM troc_livres_scolaires
            WHERE (initiateur_id = $1 OR participant_id = $1)
            AND statut = $2
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .bind(user_id)
        .bind(statut)
        .fetch_all(&state.pg)
        .await
    } else {
        sqlx::query_as::<_, TrocLivre>(
            r#"
            SELECT * FROM troc_livres_scolaires
            WHERE (initiateur_id = $1 OR participant_id = $1)
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .bind(user_id)
        .fetch_all(&state.pg)
        .await
    }
    .map_err(|e| AppError::Internal(format!("Erreur récupération trocs: {}", e)))?;

    Ok(Json(json!({ "success": true, "trocs": trocs })))
}

#[derive(Debug, Deserialize)]
pub struct MyTrocsQuery {
    pub statut: Option<String>, // "en_attente", "accepte", "refuse", "complete"
}

/// POST /api/troc-livres/:id/accept
/// Accepter un troc
pub async fn accept_troc(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(troc_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[accept_troc] User ID: {}, Troc ID: {}", user_id, troc_id);

    let service = Service::new(Arc::new(state.pg.clone()));
    let troc = service.accept_troc(troc_id, user_id).await?;

    Ok(Json(json!({ "success": true, "troc": troc })))
}

/// POST /api/troc-livres/:id/refuse
/// Refuser un troc
pub async fn refuse_troc(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(troc_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[refuse_troc] User ID: {}, Troc ID: {}", user_id, troc_id);

    let service = Service::new(Arc::new(state.pg.clone()));
    let troc = service.refuse_troc(troc_id, user_id).await?;

    Ok(Json(json!({ "success": true, "troc": troc })))
}

/// POST /api/troc-livres/:id/complete
/// Finaliser un échange (troc complété)
pub async fn complete_troc(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(troc_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[complete_troc] User ID: {}, Troc ID: {}", user_id, troc_id);

    let service = Service::new(Arc::new(state.pg.clone()));
    let troc = service.complete_troc(troc_id, user_id).await?;

    Ok(Json(json!({ "success": true, "troc": troc })))
}

/// GET /api/troc-livres/:id
/// Obtenir les détails d'un troc
pub async fn get_troc_details(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(troc_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_troc_details] User ID: {}, Troc ID: {}",
        user_id, troc_id
    );

    // Récupérer le troc
    let troc = sqlx::query_as::<_, TrocLivre>("SELECT * FROM troc_livres_scolaires WHERE id = $1")
        .bind(troc_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération troc: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Troc non trouvé".to_string()))?;

    // Vérifier que l'utilisateur est impliqué dans le troc
    if troc.initiateur_id != user_id && troc.participant_id != user_id {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas impliqué dans ce troc".to_string(),
        ));
    }

    // Récupérer les détails des livres
    let livre_offert =
        sqlx::query_as::<_, LivreScolaire>("SELECT * FROM livres_scolaires WHERE id = $1")
            .bind(troc.livre_offert_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération livre offert: {}", e)))?;

    let livre_souhaite =
        sqlx::query_as::<_, LivreScolaire>("SELECT * FROM livres_scolaires WHERE id = $1")
            .bind(troc.livre_souhaite_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                AppError::Internal(format!("Erreur récupération livre souhaité: {}", e))
            })?;

    Ok(Json(json!({
        "success": true,
        "troc": troc,
        "livre_offert": livre_offert,
        "livre_souhaite": livre_souhaite
    })))
}

/// GET /api/troc-livres/chaines/:id
/// Obtenir les détails d'une chaîne de troc
pub async fn get_chaine_details(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: _user_id, .. }): Extension<AuthenticatedUser>,
    Path(chaine_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[get_chaine_details] Chaine ID: {}", chaine_id);

    let chaine = sqlx::query_as::<_, ChaineTrocLivre>(
        r#"
        SELECT * FROM chaines_troc_livres WHERE id = $1
        "#,
    )
    .bind(chaine_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération chaîne: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Chaîne non trouvée".to_string()))?;

    Ok(Json(json!({ "success": true, "chaine": chaine })))
}
