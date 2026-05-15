// ✅ Controller Parrainage Yukpo — PR #1
// Date : 2026-05-15
//
// Endpoints :
//   GET  /api/referral/me              → code + stats du user connecté
//   POST /api/referral/track-click     → public, enregistre un clic anonyme
//
// La conversion (crédit bonus) est gérée en PR #2 (hook sur completed order).

use std::sync::Arc;

use axum::{extract::State, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::referral_service;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct MyReferralResponse {
    pub code: String,
    pub share_url: String,
    pub bonus_amount_xaf: i32,
    pub total_clicks: i64,
    pub total_signups: i64,
    pub total_conversions: i64,
    pub total_bonus_xaf: i64,
}

/// Renvoie le code de parrainage du user connecté + ses stats.
/// Crée le code si absent (idempotent).
pub async fn get_my_referral(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let stats = referral_service::get_stats(&state.pg, user_id)
        .await
        .map_err(|e| AppError::Internal(format!("referral stats: {e}")))?;

    // URL publique de partage. Le frontend bourse est l'expérience la plus
    // virale (parents + scan liste scolaire), donc on pointe par défaut là.
    // Override possible via env REFERRAL_SHARE_BASE_URL (ex: pour staging).
    let base = std::env::var("REFERRAL_SHARE_BASE_URL")
        .unwrap_or_else(|_| "https://bourse.yukpomnang.com".to_string());
    let share_url = format!("{}/?ref={}", base.trim_end_matches('/'), stats.code);

    Ok(Json(MyReferralResponse {
        code: stats.code,
        share_url,
        bonus_amount_xaf: 500,
        total_clicks: stats.total_clicks,
        total_signups: stats.total_signups,
        total_conversions: stats.total_conversions,
        total_bonus_xaf: stats.total_bonus_xaf,
    }))
}

#[derive(Debug, Deserialize)]
pub struct TrackClickInput {
    pub code: String,
    /// Path de landing (ex: "/", "/scan-liste"). Optionnel.
    pub landing_path: Option<String>,
    /// User-Agent côté client. Optionnel mais utile pour anti-fraude.
    pub user_agent: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TrackClickResponse {
    pub ok: bool,
}

/// Endpoint PUBLIC. Enregistre un clic anonyme depuis le frontend
/// quand l'URL contient `?ref=XXX`. Hash IP + UA pour respect RGPD.
///
/// Rate-limit ❗ : ce endpoint est public. Pour la v1 on s'appuie sur le
/// middleware global de rate-limiting si présent. Pour la v2 on ajoutera
/// un throttle par IP+code (max 10/min) au niveau de ce handler.
pub async fn track_click(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(input): Json<TrackClickInput>,
) -> AppResult<impl IntoResponse> {
    let code = input.code.trim();
    if code.is_empty() || code.len() > 10 {
        return Err(AppError::BadRequest("Code invalide".into()));
    }

    // Hash IP (X-Forwarded-For privilégié pour env reverse-proxy/CDN)
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .or_else(|| headers.get("x-real-ip").and_then(|v| v.to_str().ok()).map(|s| s.to_string()));
    let ip_hash = ip.map(|i| hex_hash(&i));

    let ua_hash = input.user_agent.as_deref().filter(|s| !s.is_empty()).map(hex_hash);

    referral_service::record_click(
        &state.pg,
        code,
        ip_hash.as_deref(),
        ua_hash.as_deref(),
        input.landing_path.as_deref(),
    )
    .await
    .map_err(|e| AppError::Internal(format!("referral click: {e}")))?;

    Ok(Json(TrackClickResponse { ok: true }))
}

fn hex_hash(s: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(s.as_bytes());
    let out = hasher.finalize();
    format!("{:x}", out)
}
