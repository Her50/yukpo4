// Content Approval Controller — Yukpo
// Workflow d'approbation pour personnalités publiques et marques sensibles

use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

use crate::{core::types::AppError, middlewares::jwt::AuthenticatedUser, state::AppState};

// ─── Liste des demandes en attente ────────────────────────────────────────────

/// GET /api/social-ai/approval/:service_id/pending
pub async fn list_pending_approvals(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(service_id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let rows = sqlx::query(
        r#"SELECT id, platform, caption, image_url, scheduled_for, hashtags,
                  status, urgency, requires_approval, auto_approve_after,
                  reviewer_note, modified_caption, created_at
           FROM content_approval_queue
           WHERE user_id = $1 AND service_id = $2 AND status = 'pending'
           ORDER BY
               CASE urgency WHEN 'crisis' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
               created_at ASC
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
                "platform": r.try_get::<String, _>("platform").unwrap_or_default(),
                "caption": r.try_get::<String, _>("caption").unwrap_or_default(),
                "image_url": r.try_get::<Option<String>, _>("image_url").ok().flatten(),
                "scheduled_for": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("scheduled_for").ok().flatten().map(|d| d.to_rfc3339()),
                "hashtags": r.try_get::<Option<Vec<String>>, _>("hashtags").ok().flatten().unwrap_or_default(),
                "status": r.try_get::<String, _>("status").unwrap_or_default(),
                "urgency": r.try_get::<String, _>("urgency").unwrap_or_default(),
                "requires_approval": r.try_get::<bool, _>("requires_approval").unwrap_or(false),
                "auto_approve_after": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("auto_approve_after").ok().flatten().map(|d| d.to_rfc3339()),
                "created_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at").ok().flatten().map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok(Json(json!({ "pending": items, "count": items.len() })))
}

// ─── Approuver ────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ApproveBody {
    pub note: Option<String>,
}

/// POST /api/social-ai/approval/:id/approve
pub async fn approve_content(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(approval_id): Path<i32>,
    Json(body): Json<ApproveBody>,
) -> Result<Json<Value>, AppError> {
    let updated = sqlx::query(
        r#"UPDATE content_approval_queue
           SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(),
               reviewer_note = $2, updated_at = NOW()
           WHERE id = $3 AND user_id = $1 AND status = 'pending'"#,
    )
    .bind(auth.id)
    .bind(&body.note)
    .bind(approval_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    if updated.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Demande introuvable ou déjà traitée".to_string(),
        ));
    }

    Ok(Json(json!({ "ok": true, "status": "approved" })))
}

// ─── Rejeter ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RejectBody {
    pub note: String,
}

/// POST /api/social-ai/approval/:id/reject
pub async fn reject_content(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(approval_id): Path<i32>,
    Json(body): Json<RejectBody>,
) -> Result<Json<Value>, AppError> {
    let updated = sqlx::query(
        r#"UPDATE content_approval_queue
           SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(),
               reviewer_note = $2, updated_at = NOW()
           WHERE id = $3 AND user_id = $1 AND status = 'pending'"#,
    )
    .bind(auth.id)
    .bind(&body.note)
    .bind(approval_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    if updated.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Demande introuvable ou déjà traitée".to_string(),
        ));
    }

    Ok(Json(json!({ "ok": true, "status": "rejected" })))
}

// ─── Modifier puis approuver ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ModifyBody {
    pub modified_caption: String,
    pub note: Option<String>,
}

/// POST /api/social-ai/approval/:id/modify
/// Le reviewer modifie le caption puis approuve directement
pub async fn modify_and_approve(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(approval_id): Path<i32>,
    Json(body): Json<ModifyBody>,
) -> Result<Json<Value>, AppError> {
    let updated = sqlx::query(
        r#"UPDATE content_approval_queue
           SET status = 'modified', reviewed_by = $1, reviewed_at = NOW(),
               modified_caption = $2, reviewer_note = $3, updated_at = NOW()
           WHERE id = $4 AND user_id = $1 AND status = 'pending'"#,
    )
    .bind(auth.id)
    .bind(&body.modified_caption)
    .bind(&body.note)
    .bind(approval_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    if updated.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Demande introuvable ou déjà traitée".to_string(),
        ));
    }

    Ok(Json(json!({ "ok": true, "status": "modified" })))
}

// ─── Historique ───────────────────────────────────────────────────────────────

/// GET /api/social-ai/approval/:service_id/history
pub async fn list_approval_history(
    State(state): State<Arc<AppState>>,
    auth: AuthenticatedUser,
    Path(service_id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let rows = sqlx::query(
        r#"SELECT id, platform, caption, modified_caption, status,
                  urgency, reviewer_note, reviewed_at, created_at
           FROM content_approval_queue
           WHERE user_id = $1 AND service_id = $2 AND status != 'pending'
           ORDER BY reviewed_at DESC NULLS LAST
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
                "platform": r.try_get::<String, _>("platform").unwrap_or_default(),
                "caption": r.try_get::<String, _>("caption").unwrap_or_default(),
                "modified_caption": r.try_get::<Option<String>, _>("modified_caption").ok().flatten(),
                "status": r.try_get::<String, _>("status").unwrap_or_default(),
                "urgency": r.try_get::<String, _>("urgency").unwrap_or_default(),
                "reviewer_note": r.try_get::<Option<String>, _>("reviewer_note").ok().flatten(),
                "reviewed_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("reviewed_at").ok().flatten().map(|d| d.to_rfc3339()),
                "created_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at").ok().flatten().map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok(Json(json!({ "history": items })))
}
