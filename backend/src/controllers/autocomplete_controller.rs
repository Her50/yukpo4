use axum::{
    extract::{Query, State, Path},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use log::info;
use crate::state::AppState;
use crate::services::autocomplete_history_service;
use crate::services::autocomplete_combinations_service;

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

// ✅ NOUVEAU 2025-11-02: Recherche vectorielle multi-filtres

#[derive(Debug, Deserialize)]
pub struct SearchCombinationsRequest {
    pub query: String, // Texte de recherche libre
    pub user_location: Option<String>, // Localisation de l'utilisateur pour scoring géographique
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SaveAICombinationsRequest {
    pub session_id: String,
    pub combinations: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct LinkCombinationsRequest {
    pub session_id: String,
    pub service_id: i32,
}

/// POST /api/autocomplete/search-combinations
/// Recherche intelligente dans les combinaisons autocomplete
pub async fn search_combinations(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SearchCombinationsRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let query = request.query.trim();
    let user_location = request.user_location.as_deref();
    let limit = request.limit.unwrap_or(20);
    
    info!("🔍 Recherche combinaisons: '{}' (location: {:?}, limit: {})", query, user_location, limit);
    
    if query.is_empty() {
        return Ok(Json(serde_json::json!({
            "success": true,
            "data": [],
            "count": 0
        })));
    }
    
    match autocomplete_combinations_service::search_combinations(pool, query, user_location, limit).await {
        Ok(results) => {
            info!("✅ {} résultats trouvés", results.len());
            Ok(Json(serde_json::json!({
                "success": true,
                "data": results,
                "count": results.len()
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur recherche combinaisons: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur recherche: {}", e)
            ))
        }
    }
}

/// POST /api/autocomplete/save-ai-combinations
/// Sauvegarder les combinaisons générées par l'IA (en arrière-plan)
pub async fn save_ai_combinations(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SaveAICombinationsRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    
    info!("💾 Sauvegarde combinaisons IA (session: {})", request.session_id);
    
    // Extraire les combinaisons depuis le JSON
    let combinations = request.combinations
        .into_iter()
        .filter_map(|combo_json| {
            autocomplete_combinations_service::extract_combinations_from_ai_response(&combo_json).ok()
        })
        .flatten()
        .collect::<Vec<_>>();
    
    if combinations.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Aucune combinaison valide trouvée".to_string()
        ));
    }
    
    match autocomplete_combinations_service::save_ai_combinations_batch(
        pool,
        combinations,
        &request.session_id
    ).await {
        Ok(ids) => {
            info!("✅ {} combinaisons sauvegardées", ids.len());
            Ok(Json(serde_json::json!({
                "success": true,
                "saved_count": ids.len(),
                "ids": ids,
                "session_id": request.session_id
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur sauvegarde combinaisons: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur sauvegarde: {}", e)
            ))
        }
    }
}

/// GET /api/autocomplete/combinations/session/:session_id
/// Récupérer les combinaisons d'une session IA
pub async fn get_combinations_by_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    
    info!("📥 Récupération combinaisons session: {}", session_id);
    
    match autocomplete_combinations_service::get_combinations_by_session(pool, &session_id).await {
        Ok(combinations) => {
            info!("✅ {} combinaisons récupérées", combinations.len());
    Ok(Json(serde_json::json!({
        "success": true,
                "data": combinations,
                "count": combinations.len()
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur récupération combinaisons: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur récupération: {}", e)
            ))
        }
    }
}

/// POST /api/autocomplete/combinations/link-to-service
/// Lier des combinaisons à un service après création
pub async fn link_combinations_to_service(
    State(state): State<Arc<AppState>>,
    Json(request): Json<LinkCombinationsRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    
    info!("🔗 Liaison combinaisons au service {} (session: {})", request.service_id, request.session_id);
    
    match autocomplete_combinations_service::link_combinations_to_service(
        pool,
        &request.session_id,
        request.service_id
    ).await {
        Ok(count) => {
            info!("✅ {} combinaisons liées au service", count);
            Ok(Json(serde_json::json!({
                "success": true,
                "linked_count": count,
                "service_id": request.service_id
            })))
        }
        Err(e) => {
            eprintln!("❌ Erreur liaison combinaisons: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur liaison: {}", e)
            ))
        }
    }
}

