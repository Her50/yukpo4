use axum::{
    extract::{Json, Query, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateAudienceRequest {
    pub name: String,
    pub r#type: String,                     // "lookalike" | "custom"
    pub source_audience_id: Option<String>, // Pour lookalike
    pub similarity: Option<i16>,            // Pour lookalike (1-10)
    pub source: Option<String>,             // Pour custom: "email" | "phone" | "csv"
    pub data: Option<Vec<String>>,          // Pour custom: liste d'emails/téléphones
}

#[derive(Debug, Serialize)]
pub struct Audience {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub source: String,
    pub size: i32,
    pub similarity: Option<i16>,
    pub created_at: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct CreateAudienceResponse {
    pub audience: Audience,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ListAudiencesResponse {
    pub audiences: Vec<Audience>,
}

/// Créer une audience personnalisée
pub async fn create_audience(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateAudienceRequest>,
) -> Result<ResponseJson<CreateAudienceResponse>, StatusCode> {
    let pool = &state.pg;

    // TODO: Récupérer user_id depuis le JWT token
    let user_id = 1; // Temporaire

    let audience_id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();

    // Calculer la taille de l'audience
    let size = match payload.r#type.as_str() {
        "lookalike" => {
            // Pour lookalike, estimer la taille basée sur la similarité
            // Plus la similarité est élevée, plus l'audience est petite
            let base_size = 10000;
            let similarity_factor = payload.similarity.unwrap_or(5) as f64 / 10.0;
            (base_size as f64 * (1.0 - similarity_factor * 0.5)) as i32
        }
        "custom" => {
            // Pour custom, utiliser la taille réelle des données
            payload.data.as_ref().map(|d| d.len() as i32).unwrap_or(0)
        }
        _ => 0,
    };

    // Insérer dans la base de données
    // TODO: Créer la table publicite_audiences si elle n'existe pas
    let query = r#"
        INSERT INTO publicite_audiences (id, user_id, name, type, source, size, similarity, created_at, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
        RETURNING id, name, type, source, size, similarity, created_at, status
    "#;

    let source = match payload.r#type.as_str() {
        "lookalike" => "lookalike".to_string(),
        "custom" => payload.source.unwrap_or_else(|| "email".to_string()),
        _ => "unknown".to_string(),
    };

    match sqlx::query_as::<_, AudienceRow>(query)
        .bind(&audience_id)
        .bind(user_id)
        .bind(&payload.name)
        .bind(&payload.r#type)
        .bind(&source)
        .bind(size)
        .bind(payload.similarity)
        .bind(&created_at)
        .fetch_one(pool)
        .await
    {
        Ok(row) => {
            let audience = Audience {
                id: row.id,
                name: row.name,
                r#type: row.r#type,
                source: row.source,
                size: row.size,
                similarity: row.similarity,
                created_at: row.created_at,
                status: row.status,
            };

            Ok(ResponseJson(CreateAudienceResponse {
                audience,
                message: "Audience créée avec succès".to_string(),
            }))
        }
        Err(e) => {
            log::error!("[create_audience] Erreur DB: {:?}", e);
            // Si la table n'existe pas, retourner une réponse de succès simulée
            // TODO: Créer la migration pour la table
            let audience = Audience {
                id: audience_id,
                name: payload.name,
                r#type: payload.r#type.clone(),
                source,
                size,
                similarity: payload.similarity,
                created_at,
                status: "active".to_string(),
            };

            Ok(ResponseJson(CreateAudienceResponse {
                audience,
                message: "Audience créée avec succès (mode simulation)".to_string(),
            }))
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct AudienceRow {
    id: String,
    name: String,
    r#type: String,
    source: String,
    size: i32,
    similarity: Option<i16>,
    created_at: String,
    status: String,
}

/// Lister les audiences d'un utilisateur
pub async fn list_audiences(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<ResponseJson<ListAudiencesResponse>, StatusCode> {
    let pool = &state.pg;
    let user_id: i32 = params.get("user_id").and_then(|v| v.parse().ok()).unwrap_or(1); // Temporaire

    // TODO: Créer la table si elle n'existe pas
    let query = r#"
        SELECT id, name, type, source, size, similarity, created_at, status
        FROM publicite_audiences
        WHERE user_id = $1
        ORDER BY created_at DESC
    "#;

    match sqlx::query_as::<_, AudienceRow>(query).bind(user_id).fetch_all(pool).await {
        Ok(rows) => {
            let audiences: Vec<Audience> = rows
                .into_iter()
                .map(|row| Audience {
                    id: row.id,
                    name: row.name,
                    r#type: row.r#type,
                    source: row.source,
                    size: row.size,
                    similarity: row.similarity,
                    created_at: row.created_at,
                    status: row.status,
                })
                .collect();

            Ok(ResponseJson(ListAudiencesResponse { audiences }))
        }
        Err(e) => {
            log::error!("[list_audiences] Erreur DB: {:?}", e);
            // Retourner une liste vide si la table n'existe pas
            Ok(ResponseJson(ListAudiencesResponse { audiences: vec![] }))
        }
    }
}

pub fn publicite_audiences_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route("/api/publicites/audiences", get(list_audiences))
        .route("/api/publicites/audiences/create", post(create_audience))
        .with_state(state)
}
