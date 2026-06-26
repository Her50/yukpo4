// ✅ Routes Parrainage — PR #1 (2026-05-15)
//
// - GET  /api/referral/me           (auth requise)
// - POST /api/referral/track-click  (public, capture ?ref=XXX côté landing)
//
// PR #2 ajoutera /api/referral/conversions
// PR #3 ajoutera /api/referral/payout/* + /api/admin/referrals/*

use crate::{controllers::referral_controller, middlewares::jwt::jwt_auth, state::AppState};
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn referral_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes protégées (auth requise)
    let authed = Router::<Arc<AppState>>::new()
        .route(
            "/api/referral/me",
            get(referral_controller::get_my_referral),
        )
        // V2.4 — historique par filleul (2026-06-26)
        .route(
            "/api/referral/me/filleuls",
            get(referral_controller::get_my_filleuls),
        )
        // V2.3 — admin shortfalls dashboard (2026-06-26)
        .route(
            "/api/admin/referrals/shortfalls",
            get(referral_controller::admin_shortfalls),
        )
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            jwt_auth,
        ));

    // Routes publiques
    let public = Router::<Arc<AppState>>::new().route(
        "/api/referral/track-click",
        post(referral_controller::track_click),
    );

    authed.merge(public).with_state(state)
}
