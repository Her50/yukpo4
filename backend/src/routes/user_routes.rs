use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};
use std::sync::Arc;

use crate::controllers::user_controller::{
    change_password, deduct_balance, delete_user_data, export_user_data, get_consumption_history,
    get_payment_history, get_user_balance, get_user_by_id, get_user_conversations,
    get_user_profile, purchase_pack, recharge_tokens, update_gps_consent, update_gps_location,
    update_user_profile,
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;
use axum::middleware;

pub fn user_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/user/me", get(get_user_profile))
        .route("/api/user/me", put(update_user_profile))
        .route("/api/users/balance", get(get_user_balance))
        .route("/api/wallet/balance", get(get_user_balance)) // ✅ Alias pour compatibilité mobile
        .route(
            "/api/users/consumption-history",
            get(get_consumption_history),
        )
        .route("/api/users/payment-history", get(get_payment_history))
        .route("/api/users/purchase_pack", post(purchase_pack))
        .route("/api/users/deduct-balance", post(deduct_balance))
        .route("/api/tokens/recharge", post(recharge_tokens))
        .route("/api/user/me/gps_consent", patch(update_gps_consent))
        .route("/api/user/me/gps_location", patch(update_gps_location))
        .route("/api/users/change-password", post(change_password))
        .route("/api/user/me/export", get(export_user_data))
        .route("/api/user/me", delete(delete_user_data))
        // ✅ NOUVEAU : Route pour récupérer les conversations
        .route("/api/user/conversations", get(get_user_conversations))
        // Route publique pour récupérer les informations d'un utilisateur par ID
        .route("/api/users/profile/{user_id}", get(get_user_by_id))
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}
