// ✅ Routes Payout Cash — PR #3 (2026-05-15)

use crate::{controllers::wallet_payout_controller, middlewares::jwt::jwt_auth, state::AppState};
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn wallet_payout_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        // ── USER ────────────────────────────────────────────────
        .route(
            "/api/wallet/payout/request",
            post(wallet_payout_controller::request_payout),
        )
        .route(
            "/api/wallet/payout/me",
            get(wallet_payout_controller::list_my_payouts),
        )
        // ── ADMIN ───────────────────────────────────────────────
        .route(
            "/api/admin/wallet/payouts",
            get(wallet_payout_controller::admin_list),
        )
        .route(
            "/api/admin/wallet/payouts/{id}/approve",
            post(wallet_payout_controller::admin_approve),
        )
        .route(
            "/api/admin/wallet/payouts/{id}/paid",
            post(wallet_payout_controller::admin_mark_paid),
        )
        .route(
            "/api/admin/wallet/payouts/{id}/reject",
            post(wallet_payout_controller::admin_reject),
        )
        .route(
            "/api/admin/wallet/treasury-summary",
            get(wallet_payout_controller::admin_treasury_summary),
        )
        // Auth obligatoire sur toutes les routes (admin check inline dans les handlers)
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            jwt_auth,
        ))
        .with_state(state)
}
