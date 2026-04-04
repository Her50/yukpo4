// Longform Content Controller — Yukpo
// Génération et gestion de contenus longs : scripts YT, articles, newsletters, podcasts

use axum::{
    extract::{Extension, Path, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

use crate::{
    core::types::AppError,
    middlewares::jwt::AuthenticatedUser,
    services::longform_content_service::{generate_longform_content, LongformRequest},
    state::AppState,
};

// ─── Génération ───────────────────────────────────────────────────────────────

/// POST /api/social-ai/longform/generate
pub async fn generate_longform(
    State(_state): State<Arc<AppState>>,
    Extension(_auth): Extension<AuthenticatedUser>,
    Json(req): Json<LongformRequest>,
) -> Result<Json<Value>, AppError> {
    let valid_types = [
        "youtube_script",
        "blog_article",
        "newsletter",
        "linkedin_article",
        "podcast_outline",
    ];
    if !valid_types.contains(&req.content_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Type non supporté: {}. Valeurs valides: {}",
            req.content_type,
            valid_types.join(", ")
        )));
    }

    let result = generate_longform_content(&req).await.map_err(|e| AppError::Internal(e))?;

    Ok(Json(json!({
        "content_type": result.content_type,
        "title": result.title,
        "content": result.content,
        "word_count": result.word_count,
        "estimated_duration_min": result.estimated_duration_min,
        "seo_keywords": result.seo_keywords,
        "suggested_hashtags": result.suggested_hashtags,
    })))
}

// ─── Sauvegarde ───────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SaveLongformBody {
    pub content_type: String,
    pub title: Option<String>,
    pub content: String,
    pub language: Option<String>,
    pub word_count: Option<i32>,
    pub estimated_duration_min: Option<i32>,
    pub linked_product_id: Option<i32>,
    pub linked_trend_topic: Option<String>,
    pub ai_model_used: Option<String>,
    pub generation_prompt: Option<String>,
}

/// POST /api/social-ai/longform/:service_id/save
pub async fn save_longform(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Json(body): Json<SaveLongformBody>,
) -> Result<Json<Value>, AppError> {
    let row = sqlx::query(
        r#"INSERT INTO longform_content
               (user_id, service_id, content_type, title, content, language,
                word_count, estimated_duration_min, linked_product_id, linked_trend_topic,
                ai_model_used, generation_prompt, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
           RETURNING id"#,
    )
    .bind(auth.id)
    .bind(service_id)
    .bind(&body.content_type)
    .bind(&body.title)
    .bind(&body.content)
    .bind(body.language.as_deref().unwrap_or("fr"))
    .bind(body.word_count)
    .bind(body.estimated_duration_min)
    .bind(body.linked_product_id)
    .bind(&body.linked_trend_topic)
    .bind(&body.ai_model_used)
    .bind(&body.generation_prompt)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let id: i32 = row.try_get("id").unwrap_or(0);
    Ok(Json(json!({ "ok": true, "id": id })))
}

// ─── Liste ────────────────────────────────────────────────────────────────────

/// GET /api/social-ai/longform/:service_id
pub async fn list_longform(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let rows = sqlx::query(
        r#"SELECT id, content_type, title, language, word_count,
                  estimated_duration_min, linked_trend_topic, status,
                  published_url, published_at, created_at
           FROM longform_content
           WHERE user_id = $1 AND service_id = $2
           ORDER BY created_at DESC
           LIMIT 100"#,
    )
    .bind(auth.id)
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.try_get::<i32, _>("id").unwrap_or(0),
                "content_type": r.try_get::<String, _>("content_type").unwrap_or_default(),
                "title": r.try_get::<Option<String>, _>("title").ok().flatten(),
                "language": r.try_get::<Option<String>, _>("language").ok().flatten(),
                "word_count": r.try_get::<Option<i32>, _>("word_count").ok().flatten(),
                "estimated_duration_min": r.try_get::<Option<i32>, _>("estimated_duration_min").ok().flatten(),
                "linked_trend_topic": r.try_get::<Option<String>, _>("linked_trend_topic").ok().flatten(),
                "status": r.try_get::<String, _>("status").unwrap_or_default(),
                "published_url": r.try_get::<Option<String>, _>("published_url").ok().flatten(),
                "published_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("published_at").ok().flatten().map(|d| d.to_rfc3339()),
                "created_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at").ok().flatten().map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok(Json(json!({ "items": items })))
}
