use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct HealthStructureQuery {
    #[serde(rename = "type")]
    pub structure_type: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateHealthStructure {
    #[serde(rename = "type")]
    pub structure_type: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct HealthStructure {
    pub id: i32,
    pub structure_type: String,
    pub name: String,
    pub created_at: String,
}

/// Récupérer toutes les structures de santé par type
pub async fn get_health_structures(
    Query(query): Query<HealthStructureQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let structures = sqlx::query_as!(
        HealthStructure,
        r#"
        SELECT id, structure_type, name, created_at::text
        FROM health_structures
        WHERE structure_type = $1
        ORDER BY name ASC
        "#,
        query.structure_type
    )
    .fetch_all(pool)
    .await
    .map_err(|e| {
        eprintln!("❌ Erreur récupération structures de santé: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur récupération structures: {}", e),
        )
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "data": structures,
        "count": structures.len()
    })))
}

/// Créer une nouvelle structure de santé
pub async fn create_health_structure(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateHealthStructure>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    // Valider les données
    if payload.name.trim().len() < 3 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Le nom de la structure doit contenir au moins 3 caractères".to_string(),
        ));
    }

    // Valider le type
    let valid_types = vec!["hopital_clinique", "pharmacie", "laboratoire"];
    if !valid_types.contains(&payload.structure_type.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("Type invalide. Types autorisés: {:?}", valid_types),
        ));
    }

    // Vérifier si la structure existe déjà (insensible à la casse)
    let existing = sqlx::query!(
        r#"
        SELECT id FROM health_structures
        WHERE structure_type = $1 AND LOWER(name) = LOWER($2)
        "#,
        payload.structure_type,
        payload.name.trim()
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        eprintln!("❌ Erreur vérification structure existante: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur vérification: {}", e),
        )
    })?;

    if existing.is_some() {
        return Ok(Json(serde_json::json!({
            "success": true,
            "message": "Structure déjà existante",
            "already_exists": true
        })));
    }

    // Créer la structure
    let structure = sqlx::query_as!(
        HealthStructure,
        r#"
        INSERT INTO health_structures (structure_type, name)
        VALUES ($1, $2)
        RETURNING id, structure_type, name, created_at::text
        "#,
        payload.structure_type,
        payload.name.trim()
    )
    .fetch_one(pool)
    .await
    .map_err(|e| {
        eprintln!("❌ Erreur création structure de santé: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur création structure: {}", e),
        )
    })?;

    println!("✅ Structure de santé créée: {} ({})", structure.name, structure.structure_type);

    Ok(Json(serde_json::json!({
        "success": true,
        "data": structure,
        "message": "Structure créée avec succès"
    })))
}

/// Récupérer toutes les structures (tous types)
pub async fn get_all_health_structures(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pool = &state.pg;
    let structures = sqlx::query_as!(
        HealthStructure,
        r#"
        SELECT id, structure_type, name, created_at::text
        FROM health_structures
        ORDER BY structure_type ASC, name ASC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| {
        eprintln!("❌ Erreur récupération toutes structures: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Erreur récupération: {}", e),
        )
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "data": structures,
        "count": structures.len()
    })))
}

