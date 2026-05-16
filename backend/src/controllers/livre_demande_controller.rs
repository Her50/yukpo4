//! Endpoints REST pour les demandes d'achat de livres d'occasion.
//!
//! ✅ 2026-05-16 — Permet à un acheteur de matérialiser sa demande d'achat
//! d'un livre d'occasion (titre + classe + matière + GPS). Ces demandes
//! sont ensuite intégrées comme nœuds-sinks dans le DAG du moteur de
//! matching (`troc_intelligent_service::find_matching_chaine`).

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::livre_scolaire_demande::{
    CreateLivreDemandeRequest, UpdateLivreDemandeRequest,
};
use crate::services::livre_scolaire_demande_service::LivreScolaireDemandeService;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::info;
use std::sync::Arc;

/// POST /api/livres-scolaires/demandes
pub async fn create_demande(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateLivreDemandeRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[demande] create user={} titre={}", user_id, payload.titre);
    if payload.titre.trim().is_empty()
        || payload.matiere.trim().is_empty()
        || payload.classe_souhaitee.trim().is_empty()
    {
        return Err(AppError::BadRequest(
            "titre, matiere et classe_souhaitee sont obligatoires".to_string(),
        ));
    }
    let svc = LivreScolaireDemandeService::new(Arc::new(state.pg.clone()));
    let d = svc.create(user_id, payload).await?;
    Ok((StatusCode::CREATED, Json(d)))
}

/// GET /api/livres-scolaires/demandes/me
pub async fn list_mine(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let svc = LivreScolaireDemandeService::new(Arc::new(state.pg.clone()));
    let demandes = svc.list_for_user(user_id).await?;
    Ok(Json(demandes))
}

/// GET /api/livres-scolaires/demandes/{id}
pub async fn get_demande(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(demande_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let svc = LivreScolaireDemandeService::new(Arc::new(state.pg.clone()));
    let d = svc
        .get(demande_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Demande {} introuvable", demande_id)))?;
    if d.user_id != user_id {
        return Err(AppError::Forbidden(
            "Cette demande n'appartient pas à l'utilisateur authentifié".to_string(),
        ));
    }
    Ok(Json(d))
}

/// PATCH /api/livres-scolaires/demandes/{id}
pub async fn update_demande(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(demande_id): Path<i32>,
    Json(payload): Json<UpdateLivreDemandeRequest>,
) -> AppResult<impl IntoResponse> {
    let svc = LivreScolaireDemandeService::new(Arc::new(state.pg.clone()));
    let d = svc.update(demande_id, user_id, payload).await?;
    Ok(Json(d))
}

/// DELETE /api/livres-scolaires/demandes/{id}
pub async fn cancel_demande(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(demande_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let svc = LivreScolaireDemandeService::new(Arc::new(state.pg.clone()));
    svc.cancel(demande_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
