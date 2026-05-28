// ✅ Controller Payout Cash Universel — PR #3 (2026-05-15)
//
// User endpoints :
//   POST /api/wallet/payout/request   — créer une demande de payout
//   GET  /api/wallet/payout/me        — lister ses propres demandes
//
// Admin endpoints :
//   GET  /api/admin/wallet/payouts                  — lister (filtre statut)
//   POST /api/admin/wallet/payouts/:id/approve      — valide KYC
//   POST /api/admin/wallet/payouts/:id/paid         — virement effectué
//   POST /api/admin/wallet/payouts/:id/reject       — refuse + refund
//   GET  /api/admin/wallet/treasury-summary         — résumé trésorerie

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::wallet_payout_service::{self, PayoutError};
use crate::state::AppState;

fn require_admin(role: &str) -> AppResult<()> {
    if role == "admin" || role == "super_admin" {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "Accès admin requis pour cette ressource.".into(),
        ))
    }
}

fn map_payout_err(e: PayoutError) -> AppError {
    match e {
        PayoutError::AmountTooLow(_)
        | PayoutError::AmountNotPositive
        | PayoutError::InvalidOperator
        | PayoutError::InvalidPhone
        | PayoutError::InvalidTransition(..)
        | PayoutError::NotFound => AppError::BadRequest(e.to_string()),
        PayoutError::InsufficientBalance { .. } => AppError::BadRequest(e.to_string()),
        PayoutError::Db(err) => AppError::Internal(format!("DB error: {err}")),
    }
}

// ─── USER ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RequestPayoutInput {
    pub amount_xaf: i32,
    pub operator: String,
    pub phone_e164: String,
}

pub async fn request_payout(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(input): Json<RequestPayoutInput>,
) -> AppResult<impl IntoResponse> {
    // ✅ 2026-05-28 — Anti-squat : un compte phone+PIN non vérifié ne peut PAS
    // déclencher de payout (sinon un fraudeur ayant squatté un numéro pourrait
    // encaisser un bonus parrainage qui ne lui appartient pas).
    crate::utils::phone_verified::require_phone_verified(&state.pg, user_id).await?;

    // ✅ 2026-05-16 — Idempotency-Key (RFC 7240 / Stripe pattern). Si le client
    // fournit cette clé, un retry (double-clic, timeout réseau) sera dédoublé
    // par le ledger wallet (UNIQUE INDEX partiel sur dedup_key). Sans clé, on
    // accepte mais on log : le client devrait toujours en fournir une.
    let idempotency_key = headers
        .get("idempotency-key")
        .or_else(|| headers.get("Idempotency-Key"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    if idempotency_key.is_none() {
        log::warn!(
            "[payout] user={} a soumis une demande sans Idempotency-Key. Recommandé pour éviter double-débit en cas de retry.",
            user_id
        );
    }
    let id = wallet_payout_service::request_payout(
        &state.pg,
        user_id,
        input.amount_xaf,
        &input.operator,
        &input.phone_e164,
        idempotency_key.as_deref(),
    )
    .await
    .map_err(map_payout_err)?;

    Ok(Json(serde_json::json!({
        "id": id,
        "status": "pending",
        "message": "Demande enregistrée. L'admin la traitera sous peu."
    })))
}

pub async fn list_my_payouts(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let items = wallet_payout_service::list_for_user(&state.pg, user_id)
        .await
        .map_err(|e| AppError::Internal(format!("DB error: {e}")))?;
    Ok(Json(serde_json::json!({ "items": items })))
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AdminListQuery {
    pub status: Option<String>,
}

pub async fn admin_list(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(q): Query<AdminListQuery>,
) -> AppResult<impl IntoResponse> {
    require_admin(&user.role)?;
    let items = wallet_payout_service::list_admin(&state.pg, q.status.as_deref())
        .await
        .map_err(|e| AppError::Internal(format!("DB error: {e}")))?;
    Ok(Json(serde_json::json!({ "items": items })))
}

#[derive(Debug, Deserialize)]
pub struct AdminApproveInput {
    pub note: Option<String>,
}

pub async fn admin_approve(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<i64>,
    Json(input): Json<AdminApproveInput>,
) -> AppResult<impl IntoResponse> {
    require_admin(&user.role)?;
    wallet_payout_service::approve(&state.pg, id, input.note.as_deref())
        .await
        .map_err(map_payout_err)?;
    Ok(Json(serde_json::json!({ "status": "approved" })))
}

#[derive(Debug, Deserialize)]
pub struct AdminPaidInput {
    pub payout_ref: String,
}

pub async fn admin_mark_paid(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<i64>,
    Json(input): Json<AdminPaidInput>,
) -> AppResult<impl IntoResponse> {
    require_admin(&user.role)?;
    wallet_payout_service::mark_paid(&state.pg, id, &input.payout_ref)
        .await
        .map_err(map_payout_err)?;
    Ok(Json(serde_json::json!({ "status": "paid" })))
}

#[derive(Debug, Deserialize)]
pub struct AdminRejectInput {
    pub reason: String,
}

pub async fn admin_reject(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<i64>,
    Json(input): Json<AdminRejectInput>,
) -> AppResult<impl IntoResponse> {
    require_admin(&user.role)?;
    if input.reason.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Motif de rejet obligatoire (l'utilisateur sera notifié).".into(),
        ));
    }
    wallet_payout_service::reject(&state.pg, id, input.reason.trim())
        .await
        .map_err(map_payout_err)?;
    Ok(Json(
        serde_json::json!({ "status": "rejected", "refunded": true }),
    ))
}

pub async fn admin_treasury_summary(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    require_admin(&user.role)?;
    let summary = wallet_payout_service::treasury_summary(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("DB error: {e}")))?;
    Ok(Json(summary))
}
