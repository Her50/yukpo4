// Reputation Controller — Yukpo
// Monitoring mentions, crise, config par partenaire

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

use crate::{core::types::AppError, middlewares::jwt::AuthenticatedUser, state::AppState};

// ─── List mentions ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct MentionQuery {
    pub platform: Option<String>,
    pub sentiment: Option<String>,
    pub is_crisis: Option<bool>,
    pub unread_only: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// GET /api/social-ai/reputation/:service_id/mentions
pub async fn list_mentions(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(service_id): Path<i32>,
    Query(q): Query<MentionQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = q.limit.unwrap_or(50).min(200);
    let offset = q.offset.unwrap_or(0);

    let rows = sqlx::query(
        r#"SELECT id, platform, author_name, author_handle, content, url,
                  sentiment, sentiment_score, is_crisis, crisis_level,
                  likes, shares, replies, reach_estimate,
                  is_read, is_handled, detected_at, published_at
           FROM reputation_mentions
           WHERE user_id = $1
             AND ($2::text IS NULL OR service_id = $2::int)
             AND ($3::text IS NULL OR platform = $3)
             AND ($4::text IS NULL OR sentiment = $4)
             AND ($5::boolean IS NULL OR is_crisis = $5)
             AND ($6::boolean IS NULL OR ($6 = false) OR is_read = false)
           ORDER BY detected_at DESC
           LIMIT $7 OFFSET $8"#,
    )
    .bind(auth.id)
    .bind(service_id)
    .bind(&q.platform)
    .bind(&q.sentiment)
    .bind(q.is_crisis)
    .bind(q.unread_only)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let mentions: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.try_get::<i64, _>("id").unwrap_or(0),
                "platform": r.try_get::<String, _>("platform").unwrap_or_default(),
                "author_name": r.try_get::<Option<String>, _>("author_name").ok().flatten(),
                "author_handle": r.try_get::<Option<String>, _>("author_handle").ok().flatten(),
                "content": r.try_get::<String, _>("content").unwrap_or_default(),
                "url": r.try_get::<Option<String>, _>("url").ok().flatten(),
                "sentiment": r.try_get::<Option<String>, _>("sentiment").ok().flatten(),
                "sentiment_score": r.try_get::<Option<f64>, _>("sentiment_score").ok().flatten(),
                "is_crisis": r.try_get::<bool, _>("is_crisis").unwrap_or(false),
                "crisis_level": r.try_get::<Option<i32>, _>("crisis_level").ok().flatten().unwrap_or(0),
                "likes": r.try_get::<Option<i32>, _>("likes").ok().flatten().unwrap_or(0),
                "shares": r.try_get::<Option<i32>, _>("shares").ok().flatten().unwrap_or(0),
                "reach_estimate": r.try_get::<Option<i32>, _>("reach_estimate").ok().flatten().unwrap_or(0),
                "is_read": r.try_get::<bool, _>("is_read").unwrap_or(false),
                "is_handled": r.try_get::<bool, _>("is_handled").unwrap_or(false),
                "detected_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("detected_at").ok().flatten().map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok(Json(
        json!({ "mentions": mentions, "count": mentions.len() }),
    ))
}

/// POST /api/social-ai/reputation/mention/:id/read
pub async fn mark_mention_read(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(mention_id): Path<i64>,
) -> Result<Json<Value>, AppError> {
    sqlx::query("UPDATE reputation_mentions SET is_read = true WHERE id = $1 AND user_id = $2")
        .bind(mention_id)
        .bind(auth.id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(Json(json!({ "ok": true })))
}

/// POST /api/social-ai/reputation/mention/:id/handle
pub async fn mark_mention_handled(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(mention_id): Path<i64>,
) -> Result<Json<Value>, AppError> {
    sqlx::query(
        r#"UPDATE reputation_mentions
           SET is_handled = true, handled_by = $1, handled_at = NOW()
           WHERE id = $2 AND user_id = $1"#,
    )
    .bind(auth.id)
    .bind(mention_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(Json(json!({ "ok": true })))
}

// ─── Crisis events ────────────────────────────────────────────────────────────

/// GET /api/social-ai/reputation/:service_id/crises
pub async fn list_crisis_events(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(service_id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let rows = sqlx::query(
        r#"SELECT id, title, description, crisis_level, status,
                  trigger_platform, trigger_content,
                  ai_response_draft, ai_response_approved, ai_response_sent,
                  mentions_count, negative_reach,
                  detected_at, resolved_at
           FROM crisis_events
           WHERE user_id = $1 AND service_id = $2
           ORDER BY detected_at DESC
           LIMIT 50"#,
    )
    .bind(auth.id)
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let crises: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.try_get::<i32, _>("id").unwrap_or(0),
                "title": r.try_get::<String, _>("title").unwrap_or_default(),
                "description": r.try_get::<Option<String>, _>("description").ok().flatten(),
                "crisis_level": r.try_get::<i32, _>("crisis_level").unwrap_or(1),
                "status": r.try_get::<String, _>("status").unwrap_or_default(),
                "trigger_platform": r.try_get::<Option<String>, _>("trigger_platform").ok().flatten(),
                "trigger_content": r.try_get::<Option<String>, _>("trigger_content").ok().flatten(),
                "ai_response_draft": r.try_get::<Option<String>, _>("ai_response_draft").ok().flatten(),
                "ai_response_approved": r.try_get::<Option<bool>, _>("ai_response_approved").ok().flatten().unwrap_or(false),
                "ai_response_sent": r.try_get::<Option<bool>, _>("ai_response_sent").ok().flatten().unwrap_or(false),
                "mentions_count": r.try_get::<Option<i32>, _>("mentions_count").ok().flatten().unwrap_or(0),
                "negative_reach": r.try_get::<Option<i32>, _>("negative_reach").ok().flatten().unwrap_or(0),
                "detected_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("detected_at").ok().flatten().map(|d| d.to_rfc3339()),
                "resolved_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("resolved_at").ok().flatten().map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok(Json(json!({ "crises": crises })))
}

/// POST /api/social-ai/reputation/crisis/:id/resolve
pub async fn resolve_crisis(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(crisis_id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    sqlx::query(
        r#"UPDATE crisis_events
           SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND user_id = $2"#,
    )
    .bind(crisis_id)
    .bind(auth.id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(Json(json!({ "ok": true })))
}

// ─── Monitor config ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitorConfigBody {
    pub is_active: Option<bool>,
    pub monitor_platforms: Option<Vec<String>>,
    pub keywords: Option<Vec<String>>,
    pub crisis_sentiment_threshold: Option<f64>,
    pub crisis_reach_threshold: Option<i32>,
    pub alert_on_negative: Option<bool>,
    pub alert_on_positive: Option<bool>,
    pub notify_whatsapp: Option<String>,
    pub notify_email: Option<String>,
    pub notify_in_app: Option<bool>,
}

/// GET /api/social-ai/reputation/:service_id/config
pub async fn get_monitor_config(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(service_id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let row = sqlx::query(
        r#"SELECT id, is_active, monitor_platforms, keywords,
                  crisis_sentiment_threshold, crisis_reach_threshold,
                  alert_on_negative, alert_on_positive,
                  notify_whatsapp, notify_email, notify_in_app
           FROM reputation_monitor_config
           WHERE user_id = $1 AND service_id = $2"#,
    )
    .bind(auth.id)
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    match row {
        None => Ok(Json(json!({ "config": null }))),
        Some(r) => Ok(Json(json!({
            "config": {
                "id": r.try_get::<i32, _>("id").unwrap_or(0),
                "is_active": r.try_get::<bool, _>("is_active").unwrap_or(true),
                "monitor_platforms": r.try_get::<Vec<String>, _>("monitor_platforms").unwrap_or_default(),
                "keywords": r.try_get::<Vec<String>, _>("keywords").unwrap_or_default(),
                "crisis_sentiment_threshold": r.try_get::<Option<f64>, _>("crisis_sentiment_threshold").ok().flatten(),
                "crisis_reach_threshold": r.try_get::<Option<i32>, _>("crisis_reach_threshold").ok().flatten(),
                "alert_on_negative": r.try_get::<bool, _>("alert_on_negative").unwrap_or(true),
                "alert_on_positive": r.try_get::<bool, _>("alert_on_positive").unwrap_or(false),
                "notify_whatsapp": r.try_get::<Option<String>, _>("notify_whatsapp").ok().flatten(),
                "notify_email": r.try_get::<Option<String>, _>("notify_email").ok().flatten(),
                "notify_in_app": r.try_get::<bool, _>("notify_in_app").unwrap_or(true),
            }
        }))),
    }
}

/// PUT /api/social-ai/reputation/:service_id/config
pub async fn upsert_monitor_config(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(service_id): Path<i32>,
    Json(body): Json<MonitorConfigBody>,
) -> Result<Json<Value>, AppError> {
    sqlx::query(
        r#"INSERT INTO reputation_monitor_config
               (user_id, service_id, is_active, monitor_platforms, keywords,
                crisis_sentiment_threshold, crisis_reach_threshold,
                alert_on_negative, alert_on_positive,
                notify_whatsapp, notify_email, notify_in_app, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
           ON CONFLICT (user_id, service_id) DO UPDATE SET
               is_active = COALESCE($3, reputation_monitor_config.is_active),
               monitor_platforms = COALESCE($4, reputation_monitor_config.monitor_platforms),
               keywords = COALESCE($5, reputation_monitor_config.keywords),
               crisis_sentiment_threshold = COALESCE($6, reputation_monitor_config.crisis_sentiment_threshold),
               crisis_reach_threshold = COALESCE($7, reputation_monitor_config.crisis_reach_threshold),
               alert_on_negative = COALESCE($8, reputation_monitor_config.alert_on_negative),
               alert_on_positive = COALESCE($9, reputation_monitor_config.alert_on_positive),
               notify_whatsapp = COALESCE($10, reputation_monitor_config.notify_whatsapp),
               notify_email = COALESCE($11, reputation_monitor_config.notify_email),
               notify_in_app = COALESCE($12, reputation_monitor_config.notify_in_app),
               updated_at = NOW()"#,
    )
    .bind(auth.id)
    .bind(service_id)
    .bind(body.is_active)
    .bind(body.monitor_platforms.as_deref())
    .bind(body.keywords.as_deref())
    .bind(body.crisis_sentiment_threshold)
    .bind(body.crisis_reach_threshold)
    .bind(body.alert_on_negative)
    .bind(body.alert_on_positive)
    .bind(&body.notify_whatsapp)
    .bind(&body.notify_email)
    .bind(body.notify_in_app)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(Json(json!({ "ok": true })))
}
