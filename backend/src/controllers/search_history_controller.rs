use axum::{
    extract::{Query, State, Path, Extension, FromRequestParts},
    http::{request::Parts, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use crate::state::AppState;
use crate::services::search_history_service;
use crate::middlewares::jwt::AuthenticatedUser;

/// Extracteur personnalisé pour obtenir optionnellement l'utilisateur authentifié
pub struct OptionalAuth(pub Option<AuthenticatedUser>);

impl<S> FromRequestParts<S> for OptionalAuth
where
    S: Send + Sync,
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user = parts.extensions.get::<AuthenticatedUser>().cloned();
        Ok(OptionalAuth(user))
    }
}

#[derive(Debug, Deserialize)]
pub struct RecordSearchRequest {
    pub query_text: String,
    pub query_type: Option<String>,
    pub category: Option<String>,
    pub filters: Option<serde_json::Value>,
    pub location_lat: Option<f64>,
    pub location_lon: Option<f64>,
    pub results_count: Option<i32>,
    pub session_id: Option<String>,
    pub device_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PopularSearchesQuery {
    pub limit: Option<i64>,
    pub category: Option<String>,
    pub days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct SearchSuggestionsQuery {
    pub prefix: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UserHistoryQuery {
    pub limit: Option<i64>,
}

/// Enregistrer une recherche (peut être anonyme)
pub async fn record_search(
    State(state): State<Arc<AppState>>,
    OptionalAuth(user): OptionalAuth,
    Json(payload): Json<RecordSearchRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let query_type = payload.query_type.unwrap_or_else(|| "text".to_string());
    let results_count = payload.results_count.unwrap_or(0);
    let user_id = user.map(|u| u.id);

    match search_history_service::record_search(
        pool,
        user_id,
        &payload.query_text,
        &query_type,
        payload.category.as_deref(),
        payload.filters.as_ref(),
        payload.location_lat,
        payload.location_lon,
        results_count,
        payload.session_id.as_deref(),
        payload.device_type.as_deref(),
    ).await {
        Ok(id) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "id": id,
                "message": "Recherche enregistrée"
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur enregistrement recherche: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur enregistrement: {}", e),
            ))
        }
    }
}

/// Enregistrer un clic sur un résultat
pub async fn record_search_click(
    Path(search_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let result_id = payload.get("result_id")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .ok_or_else(|| {
            (StatusCode::BAD_REQUEST, "result_id requis".to_string())
        })?;

    match search_history_service::record_search_click(pool, search_id, result_id).await {
        Ok(success) => {
            Ok(Json(serde_json::json!({
                "success": success,
                "message": if success { "Clic enregistré" } else { "Recherche non trouvée" }
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur enregistrement clic: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur enregistrement: {}", e),
            ))
        }
    }
}

/// Récupérer les recherches populaires
pub async fn get_popular_searches(
    Query(query): Query<PopularSearchesQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let limit = query.limit.unwrap_or(10);
    let days = query.days.unwrap_or(30);

    match search_history_service::get_popular_searches(
        pool,
        limit,
        query.category.as_deref(),
        days,
    ).await {
        Ok(popular) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "data": popular,
                "count": popular.len()
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur récupération recherches populaires: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur récupération: {}", e),
            ))
        }
    }
}

/// Récupérer les suggestions de recherche (peut être anonyme)
pub async fn get_search_suggestions(
    Query(query): Query<SearchSuggestionsQuery>,
    State(state): State<Arc<AppState>>,
    OptionalAuth(user): OptionalAuth,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let limit = query.limit.unwrap_or(5);
    let user_id = user.map(|u| u.id);

    match search_history_service::get_search_suggestions(
        pool,
        user_id,
        query.prefix.as_deref(),
        limit,
    ).await {
        Ok(suggestions) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "data": suggestions,
                "count": suggestions.len()
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur récupération suggestions: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur récupération: {}", e),
            ))
        }
    }
}

/// Récupérer l'historique de recherche d'un utilisateur (requiert authentification)
pub async fn get_user_search_history(
    Query(query): Query<UserHistoryQuery>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let limit = query.limit.unwrap_or(50);
    let uid = user.id;

    match search_history_service::get_user_search_history(pool, uid, limit).await {
        Ok(history) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "data": history,
                "count": history.len()
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur récupération historique: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur récupération: {}", e),
            ))
        }
    }
}

