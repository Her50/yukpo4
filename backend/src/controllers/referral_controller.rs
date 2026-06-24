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
    /// 2026-06-08 — Remplace l'ancien bonus_amount_xaf=500 fixe par le
    /// modèle "5% ventes + 25% gains troc". Le front affiche désormais
    /// les pourcentages plutôt qu'un montant unique.
    pub bonus_percent_vente: f64,
    pub bonus_percent_troc: f64,
    pub bonus_seuil_min_xaf: i32,
    pub total_clicks: i64,
    pub total_signups: i64,
    pub total_conversions: i64,
    pub total_bonus_xaf: i64,
    pub total_trocs_filleuls: i64,
    pub total_troc_commission_xaf: i64,
    /// 2026-06-24 — Commission VENDEUR sur ventes occasion des filleuls
    /// (déjà créditée — source ledger 'referral_seller_commission').
    pub total_seller_commission_xaf: i64,
    /// 2026-06-24 — Sprint 2 : montant EFFECTIVE (livraison confirmée
    /// par coursier), retirable en cash via Mobile Money.
    pub total_effective_xaf: i64,
    /// 2026-06-24 — Sprint 2 : montant INITIÉE (en attente de livraison).
    /// Visible mais bloqué pour cash-out.
    pub total_initiee_xaf: i64,
    /// 2026-06-24 — Phase 0 : commission espérée si tous les livres
    /// actuellement en circulation par les filleuls trouvaient preneur.
    /// Motiver l'ambassadeur sur le potentiel terrain.
    pub commission_esperee_xaf: i64,
    pub total_gains_xaf: i64,
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
    // ✅ 2026-05-15 — On pointe vers /parrainage (page dédiée) plutôt que /
    //    pour que le filleul voie le pitch invitation avant de s'inscrire.
    // ✅ 2026-05-16 — Domaine canonique : bourse-du-livre-scolaire.yukpomnang.com
    //    (nom directement compréhensible par l'utilisateur, vs bourse.* trop court).
    let base = std::env::var("REFERRAL_SHARE_BASE_URL")
        .unwrap_or_else(|_| "https://bourse-du-livre-scolaire.yukpomnang.com".to_string());
    let share_url = format!(
        "{}/parrainage?ref={}",
        base.trim_end_matches('/'),
        stats.code
    );

    // 2026-06-08 — Frontend lit ces 3 paramètres pour afficher la formule
    // « 5% sur les ventes ≥ 10 000 FCFA + 25% sur les commissions troc »
    // sans avoir à hardcoder côté React.
    let bonus_percent_vente = std::env::var("REFERRAL_BONUS_PERCENT_VENTE")
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(referral_service::REFERRAL_BONUS_PERCENT_VENTE_DEFAULT);
    let bonus_percent_troc = std::env::var("REFERRAL_TROC_COMMISSION_PERCENT")
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(referral_service::REFERRAL_TROC_COMMISSION_PERCENT_DEFAULT);

    Ok(Json(MyReferralResponse {
        code: stats.code,
        share_url,
        bonus_percent_vente,
        bonus_percent_troc,
        bonus_seuil_min_xaf: referral_service::REFERRAL_MIN_ORDER_XAF,
        total_clicks: stats.total_clicks,
        total_signups: stats.total_signups,
        total_conversions: stats.total_conversions,
        total_bonus_xaf: stats.total_bonus_xaf,
        total_trocs_filleuls: stats.total_trocs_filleuls,
        total_troc_commission_xaf: stats.total_troc_commission_xaf,
        total_seller_commission_xaf: stats.total_seller_commission_xaf,
        total_effective_xaf: stats.total_effective_xaf,
        total_initiee_xaf: stats.total_initiee_xaf,
        commission_esperee_xaf: stats.commission_esperee_xaf,
        total_gains_xaf: stats.total_gains_xaf,
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
