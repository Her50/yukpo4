// Routes pour WebRTC
use std::sync::Arc;
use axum::{
    routing::post,
    Router,
};
use crate::{
    state::AppState,
    controllers::webrtc_controller,
};

pub fn webrtc_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        // Notifier un appel entrant (envoi push notification)
        .route("/api/webrtc/notify-call", post(webrtc_controller::notify_incoming_call))
        .with_state(state)
}


