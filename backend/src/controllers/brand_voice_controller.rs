// Brand Voice Controller — Yukpo
// Entraînement du style IA par partenaire + génération contextuelle

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{
    core::types::AppError,
    middlewares::jwt::AuthenticatedUser,
    services::brand_voice_service::{
        generate_with_brand_voice, load_brand_voice, train_brand_voice,
    },
    state::AppState,
};

// ─── Entraînement ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TrainBrandVoiceBody {
    /// 3 à 20 exemples de posts écrits par le partenaire
    pub examples: Vec<String>,
}

/// POST /api/social-ai/brand-voice/:service_id/train
pub async fn train(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(service_id): Path<i32>,
    Json(body): Json<TrainBrandVoiceBody>,
) -> Result<Json<Value>, AppError> {
    if body.examples.len() < 3 {
        return Err(AppError::BadRequest(
            "Minimum 3 exemples requis".to_string(),
        ));
    }
    if body.examples.len() > 20 {
        return Err(AppError::BadRequest(
            "Maximum 20 exemples autorisés".to_string(),
        ));
    }

    let summary = train_brand_voice(&state.pg, auth.id, service_id, &body.examples)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(json!({
        "ok": true,
        "brand_voice_summary": summary,
        "examples_count": body.examples.len(),
    })))
}

// ─── Lecture ──────────────────────────────────────────────────────────────────

/// GET /api/social-ai/brand-voice/:service_id
pub async fn get_brand_voice(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(service_id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    use sqlx::Row;

    let row = sqlx::query(
        r#"SELECT brand_voice_summary, brand_voice_examples, brand_voice_trained_at
           FROM social_ai_preferences
           WHERE user_id = $1 AND service_id = $2"#,
    )
    .bind(auth.id)
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    match row {
        None => Ok(Json(json!({ "trained": false }))),
        Some(r) => Ok(Json(json!({
            "trained": r.try_get::<Option<String>, _>("brand_voice_summary").ok().flatten().is_some(),
            "brand_voice_summary": r.try_get::<Option<String>, _>("brand_voice_summary").ok().flatten(),
            "examples_count": r.try_get::<Option<Vec<String>>, _>("brand_voice_examples").ok().flatten().map(|v| v.len()).unwrap_or(0),
            "trained_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("brand_voice_trained_at").ok().flatten().map(|d| d.to_rfc3339()),
        }))),
    }
}

// ─── Génération contextuelle ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct GenerateWithVoiceBody {
    pub content_request: String,
    pub platform: String,
    pub language: Option<String>,
}

/// POST /api/social-ai/brand-voice/:service_id/generate
pub async fn generate_post_with_voice(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(service_id): Path<i32>,
    Json(body): Json<GenerateWithVoiceBody>,
) -> Result<Json<Value>, AppError> {
    let brand_voice = load_brand_voice(&state.pg, auth.id, service_id).await.ok_or_else(|| {
        AppError::BadRequest(
            "Brand voice non entraîné pour ce service. Envoyez des exemples d'abord.".to_string(),
        )
    })?;

    let language = body.language.as_deref().unwrap_or("fr");

    let post = generate_with_brand_voice(
        &body.content_request,
        &brand_voice,
        &body.platform,
        language,
    )
    .await
    .map_err(|e| AppError::Internal(e))?;

    Ok(Json(json!({
        "post": post,
        "platform": body.platform,
        "language": language,
    })))
}
