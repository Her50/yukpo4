// src/controllers/signalement_controller.rs
// Contrôleur pour gérer les signalements de produits/services

use axum::{
    extract::{Path, Query, State},
    response::Json,
    Extension,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct SignalementRequest {
    pub service_id: i32,
    pub product_id: Option<String>,
    pub product_name: Option<String>,
    pub type_signalement: String,
    pub motifs_predefinis: Option<Vec<String>>,
    pub motif_libre: Option<String>,
    pub preuves: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct SignalementResponse {
    pub id: i32,
    pub message: String,
    pub reference: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RisquePrestataire {
    pub risque: String,
    pub signalements_actifs: i64,
    pub sanctions_actives: i64,
    pub dernier_signalement: Option<chrono::DateTime<chrono::Utc>>,
    pub recommandation: String,
}

/// Créer un signalement
pub async fn create_signalement(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(payload): Json<SignalementRequest>,
) -> AppResult<Json<SignalementResponse>> {
    info!(
        "[create_signalement] User {} signaling service {}",
        auth_user.id, payload.service_id
    );

    let pool = &state.pg;

    // Vérifier que le service existe
    let service_exists =
        sqlx::query("SELECT EXISTS(SELECT 1 FROM services WHERE id = $1) as exists")
            .bind(payload.service_id)
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Internal(format!("Database error: {}", e)))?
            .get::<bool, _>("exists");

    if !service_exists {
        return Err(AppError::NotFound("Service non trouvé".to_string()));
    }

    // Vérifier que l'utilisateur n'a pas déjà signalé ce service récemment (< 24h)
    let recent_signalement = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM signalements 
         WHERE user_id = $1 AND service_id = $2 
         AND created_at > NOW() - INTERVAL '24 hours') as exists",
    )
    .bind(auth_user.id)
    .bind(payload.service_id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Database error: {}", e)))?
    .get::<bool, _>("exists");

    if recent_signalement {
        return Err(AppError::BadRequest(
            "Vous avez déjà signalé ce service récemment. Veuillez attendre 24h.".to_string(),
        ));
    }

    // Créer le signalement
    let result = sqlx::query(
        r#"
        INSERT INTO signalements 
        (user_id, service_id, product_id, product_name, type_signalement, motifs_predefinis, motif_libre, preuves, priorite)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 
            CASE 
                WHEN $5 IN ('arnaque_suspectee', 'harcèlement') THEN 'haute'
                WHEN $5 IN ('contenu_inapproprie', 'produit_contrefait') THEN 'normale'
                ELSE 'normale'
            END
        )
        RETURNING id
        "#
    )
    .bind(auth_user.id)
    .bind(payload.service_id)
    .bind(payload.product_id.as_deref())
    .bind(payload.product_name.as_deref())
    .bind(&payload.type_signalement)
    .bind(payload.motifs_predefinis.as_ref().map(|m| m.as_slice()))
    .bind(payload.motif_libre.as_deref())
    .bind(payload.preuves.as_ref())
    .fetch_one(pool)
    .await
    .map_err(|e| {
        error!("[create_signalement] Error creating signalement: {:?}", e);
        AppError::Internal("Failed to create signalement".to_string())
    })?;

    let signalement_id = result.get::<i32, _>("id");
    let reference = format!(
        "SIG-{}-{}",
        signalement_id,
        chrono::Utc::now().format("%Y%m%d")
    );

    // Créer une notification pour les modérateurs (role = 'admin' ou 'moderateur')
    let _ = sqlx::query(
        r#"
        INSERT INTO notifications (user_id, title, message, type, priority, metadata)
        SELECT id, $1, $2, 'signalement', 'high', $3
        FROM users 
        WHERE role IN ('admin', 'moderateur') AND is_active = TRUE
        "#,
    )
    .bind("🚨 Nouveau signalement")
    .bind(format!(
        "Type: {}\nService ID: {}\n{}",
        payload.type_signalement,
        payload.service_id,
        payload
            .motif_libre
            .as_deref()
            .unwrap_or("Pas de description")
    ))
    .bind(json!({
        "signalement_id": signalement_id,
        "service_id": payload.service_id,
        "type": payload.type_signalement,
        "reference": reference
    }))
    .execute(pool)
    .await;

    info!(
        "[create_signalement] Signalement {} created successfully",
        signalement_id
    );

    Ok(Json(SignalementResponse {
        id: signalement_id,
        message: "Votre signalement a été enregistré. Notre équipe va l'examiner dans les plus brefs délais.".to_string(),
        reference
    }))
}

/// Obtenir le niveau de risque d'un prestataire
pub async fn get_prestataire_risque(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<i32>,
) -> AppResult<Json<RisquePrestataire>> {
    let pool = &state.pg;

    let result = sqlx::query("SELECT check_prestataire_risque($1) as risque")
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Database error: {}", e)))?;

    let risque_json = result.get::<serde_json::Value, _>("risque");

    let risque: RisquePrestataire = serde_json::from_value(risque_json)
        .map_err(|e| AppError::Internal(format!("JSON parse error: {}", e)))?;

    Ok(Json(risque))
}

/// Obtenir les signalements de l'utilisateur
pub async fn get_user_signalements(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Query(params): Query<ListSignalementsQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let pool = &state.pg;
    let limit = params.limit.unwrap_or(20).min(50);
    let offset = params.offset.unwrap_or(0);

    let rows = sqlx::query(
        r#"
        SELECT 
            s.id,
            s.service_id,
            s.product_id,
            s.product_name,
            s.type_signalement,
            s.motifs_predefinis,
            s.motif_libre,
            s.statut,
            s.priorite,
            s.created_at,
            s.traite_at,
            serv.data->>'titre_service' as service_titre
        FROM signalements s
        LEFT JOIN services serv ON s.service_id = serv.id
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(auth_user.id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to fetch signalements: {}", e)))?;

    let signalements: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<i32, _>("id"),
                "service_id": row.get::<i32, _>("service_id"),
                "product_id": row.get::<Option<String>, _>("product_id"),
                "product_name": row.get::<Option<String>, _>("product_name"),
                "service_titre": row.get::<Option<String>, _>("service_titre"),
                "type_signalement": row.get::<String, _>("type_signalement"),
                "motifs_predefinis": row.get::<Option<Vec<String>>, _>("motifs_predefinis"),
                "motif_libre": row.get::<Option<String>, _>("motif_libre"),
                "statut": row.get::<String, _>("statut"),
                "priorite": row.get::<String, _>("priorite"),
                "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                "traite_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("traite_at"),
            })
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": signalements,
        "count": signalements.len()
    })))
}

#[derive(Debug, Deserialize)]
pub struct ListSignalementsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
