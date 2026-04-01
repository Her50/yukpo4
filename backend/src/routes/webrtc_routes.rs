// Routes pour WebRTC
use crate::{controllers::webrtc_controller, middlewares::jwt::jwt_auth, state::AppState};
use axum::{middleware, routing::post, Router};
use std::sync::Arc;

pub fn webrtc_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        // Notifier un appel entrant (envoi push notification)
        .route(
            "/api/webrtc/notify-call",
            post(webrtc_controller::notify_incoming_call),
        )
        // ✅ Protection JWT: seuls les utilisateurs authentifiés peuvent déclencher des notifications d'appel
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}
