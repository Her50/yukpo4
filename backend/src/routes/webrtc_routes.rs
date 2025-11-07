// Routes pour WebRTC
use crate::{controllers::webrtc_controller, state::AppState};
use axum::{routing::post, Router};
use std::sync::Arc;

pub fn webrtc_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        // Notifier un appel entrant (envoi push notification)
        .route(
            "/api/webrtc/notify-call",
            post(webrtc_controller::notify_incoming_call),
        )
        .with_state(state)
}
