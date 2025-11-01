use axum::{
    extract::{Query, State, Path},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::state::AppState;
use crate::services::autocomplete_history_service;

#[derive(Debug, Deserialize)]
pub struct AutocompleteSuggestionsQuery {
    pub identifiant_base: String,
    pub sous_caracteristique: String,
    pub prefix: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertAutocompleteRequest {
    pub identifiant_base: String,
    pub sous_caracteristique: String,
    pub valeur: String,
    pub origine_champs: Option<String>,
    pub user_id: Option<i32>,
    pub service_id: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct HistorizeAutocompleteRequest {
    pub identifiant_base: String,
    pub valeurs: Vec<String>,
    pub separateur: String,
    pub sous_caracteristiques: serde_json::Value,
    pub origine_champs: Option<String>,
    pub user_id: Option<i32>,
    pub service_id: Option<i32>,
}

/// Récupérer les suggestions autocomplete
pub async fn get_autocomplete_suggestions(
    Query(query): Query<AutocompleteSuggestionsQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let limit = query.limit.unwrap_or(10);

    match autocomplete_history_service::get_autocomplete_suggestions(
        pool,
        &query.identifiant_base,
        &query.sous_caracteristique,
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
                format!("Erreur récupération suggestions: {}", e),
            ))
        }
    }
}

/// Récupérer toutes les sous-caractéristiques d'un identifiant_base
pub async fn get_sub_characteristics(
    Path(identifiant_base): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;

    match autocomplete_history_service::get_sub_characteristics(pool, &identifiant_base).await {
        Ok(sub_chars) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "data": sub_chars,
                "count": sub_chars.len()
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur récupération sous-caractéristiques: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur récupération: {}", e),
            ))
        }
    }
}

/// Récupérer toutes les valeurs pour une combinaison identifiant_base + sous_caracteristique
pub async fn get_all_values(
    Path((identifiant_base, sous_caracteristique)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;

    match autocomplete_history_service::get_all_values(
        pool,
        &identifiant_base,
        &sous_caracteristique,
    ).await {
        Ok(values) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "data": values,
                "count": values.len()
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur récupération valeurs: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur récupération: {}", e),
            ))
        }
    }
}

/// Insérer ou mettre à jour une caractéristique autocomplete
pub async fn upsert_autocomplete_characteristic(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpsertAutocompleteRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let origine_champs = payload.origine_champs.unwrap_or_else(|| "ia".to_string());

    match autocomplete_history_service::upsert_autocomplete_characteristic(
        pool,
        &payload.identifiant_base,
        &payload.sous_caracteristique,
        &payload.valeur,
        &origine_champs,
        payload.user_id,
        payload.service_id,
    ).await {
        Ok(id) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "id": id,
                "message": "Caractéristique sauvegardée"
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur upsert caractéristique: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur sauvegarde: {}", e),
            ))
        }
    }
}

/// Historiser un champ autocomplete complet
pub async fn historize_autocomplete_field(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<HistorizeAutocompleteRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let origine_champs = payload.origine_champs.unwrap_or_else(|| "ia".to_string());

    match autocomplete_history_service::historize_autocomplete_field(
        pool,
        &payload.identifiant_base,
        &payload.valeurs,
        &payload.separateur,
        &payload.sous_caracteristiques,
        &origine_champs,
        payload.user_id,
        payload.service_id,
    ).await {
        Ok(ids) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "ids": ids,
                "count": ids.len(),
                "message": "Caractéristiques historisées"
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur historisation: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur historisation: {}", e),
            ))
        }
    }
}

