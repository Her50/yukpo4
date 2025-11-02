use axum::{
    extract::{Query, State, Path},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use log::info;
use crate::state::AppState;
use crate::services::autocomplete_history_service;
use crate::services::geonames_service;

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
    pub filters: Vec<String>,
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct CombinationResult {
    pub service_id: i32,
    pub product_vector: Vec<String>,
    pub location_vector: Vec<String>,
    pub full_vector: Vec<String>,
    pub chosen_location: Option<String>,
    pub usage_count: i32,
    pub has_variant: bool,
    pub variant_dimension: Option<String>,
    pub variant_value: Option<String>,
    pub prix: Option<f64>,
    pub devise: Option<String>,
    pub stock: Option<i32>,
    pub location_score: f32,
    pub popularity_score: f32,
    pub final_score: f32,
}

/// POST /api/autocomplete/search-combinations
/// Recherche multi-filtres progressive dans les vecteurs autocomplete
pub async fn search_combinations(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SearchCombinationsRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let filters = request.filters;
    let limit = request.limit.unwrap_or(20);
    
    info!("🔍 Recherche vectorielle: {:?} (limit: {})", filters, limit);
    
    if filters.is_empty() {
        return Ok(Json(serde_json::json!({
            "success": true,
            "data": [],
            "count": 0
        })));
    }
    
    // Construire WHERE clauses pour chaque filtre
    let mut where_parts = vec![];
    let mut bind_values: Vec<String> = vec![];
    
    for filter in &filters {
        // Vérifier si c'est un terme géographique
        let is_location = is_geographic_term(filter);
        
        if is_location {
            // Recherche géographique bidirectionnelle
            let location_variants = geonames_service::expand_location_search(pool, filter)
                .await
                .unwrap_or_else(|_| vec![filter.clone()]);
            
            info!("🌍 Terme géographique '{}' étendu à {} variantes", filter, location_variants.len());
            
            // Clause : location_vector overlap avec variants
            where_parts.push(format!("location_vector && ${}::TEXT[]", bind_values.len() + 1));
            bind_values.push(format!("{{{}}}", location_variants.join(",")));
        } else {
            // Recherche caractéristique normale
            where_parts.push(format!("${}::TEXT = ANY(full_vector)", bind_values.len() + 1));
            bind_values.push(filter.clone());
        }
    }
    
    // Construire requête SQL
    let where_clause = if where_parts.is_empty() {
        "TRUE".to_string()
    } else {
        where_parts.join(" AND ")
    };
    
    let sql = format!(
        "SELECT 
            service_id,
            product_vector,
            location_vector,
            full_vector,
            chosen_location,
            usage_count,
            has_variant,
            variant_dimension,
            variant_value,
            prix,
            devise,
            stock,
            COALESCE(calculate_location_score($1, location_vector, chosen_location), 0.0) as location_score,
            usage_count::FLOAT as popularity_score
         FROM autocomplete_combinations
         WHERE {}
         ORDER BY 
            (COALESCE(calculate_location_score($1, location_vector, chosen_location), 0.0) * 0.7 
             + (usage_count::FLOAT / 100.0) * 0.3) DESC
         LIMIT ${}",
        where_clause,
        bind_values.len() + 2
    );
    
    info!("🔍 SQL query: {}", sql);
    info!("🔍 Bind values: {:?}", bind_values);
    
    // Construire et exécuter la requête
    let mut query = sqlx::query_as::<_, (
        i32, Vec<String>, Vec<String>, Vec<String>, Option<String>,
        i32, bool, Option<String>, Option<String>, Option<f64>, Option<String>, Option<i32>,
        f32, f32
    )>(&sql);
    
    // Bind location de référence pour scoring (premier filtre)
    query = query.bind(&filters[0]);
    
    // Bind tous les filtres
    for value in &bind_values {
        query = query.bind(value);
    }
    
    // Bind limit
    query = query.bind(limit);
    
    let rows = query.fetch_all(pool).await.map_err(|e| {
        eprintln!("❌ Erreur SQL recherche: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Erreur recherche: {}", e))
    })?;
    
    // Transformer en résultats
    let results: Vec<CombinationResult> = rows.into_iter().map(|row| {
        let location_score = row.12;
        let popularity_score = row.13;
        let final_score = (location_score * 0.7) + (popularity_score / 100.0 * 0.3);
        
        CombinationResult {
            service_id: row.0,
            product_vector: row.1,
            location_vector: row.2,
            full_vector: row.3,
            chosen_location: row.4,
            usage_count: row.5,
            has_variant: row.6,
            variant_dimension: row.7,
            variant_value: row.8,
            prix: row.9,
            devise: row.10,
            stock: row.11,
            location_score,
            popularity_score,
            final_score,
        }
    }).collect();
    
    info!("✅ {} résultats trouvés", results.len());
    
    Ok(Json(serde_json::json!({
        "success": true,
        "data": results,
        "count": results.len()
    })))
}

/// Détermine si un terme est géographique
fn is_geographic_term(term: &str) -> bool {
    let term_lower = term.to_lowercase();
    
    // Liste de mots-clés géographiques
    let geo_keywords = [
        "ville", "quartier", "arrondissement", "région", "département",
        "cameroun", "douala", "yaoundé", "yaounde", "littoral", "centre", "ouest", "sud", "nord", "est",
        "gabon", "libreville", "congo", "brazzaville", "kinshasa",
        "sénégal", "senegal", "dakar", "côte", "cote", "ivoire", "abidjan",
        "akwa", "bonamoussadi", "bonapriso", "bepanda", "makepe", "bonaberi",
        // Ajoutez d'autres selon vos besoins
    ];
    
    geo_keywords.iter().any(|keyword| term_lower.contains(keyword))
}
