use axum::{
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::studio_controller::{
        attach_asset, create_session, generate_storyboard, get_session,
        list_sessions, publish_session, save_timeline, set_dependencies,
        trigger_preview, trigger_short_preview, update_session,
    },
    state::AppState,
};

pub fn studio_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/studio/sessions", post(create_session).get(list_sessions))
        .route("/api/studio/sessions/{session_id}", get(get_session).put(update_session))
        .route("/api/studio/sessions/{session_id}/timeline", put(save_timeline))
        .route("/api/studio/sessions/{session_id}/assets", post(attach_asset))
        .route("/api/studio/sessions/{session_id}/dependencies", put(set_dependencies))
        .route("/api/studio/sessions/{session_id}/storyboard", post(generate_storyboard))
        .route(
            "/api/studio/sessions/{session_id}/preview",
            post(trigger_preview).layer(
                axum::extract::DefaultBodyLimit::max(200_000_000), // ✅ 200 MB pour previews vidéo
            ),
        )
        .route(
            "/api/studio/sessions/{session_id}/preview/short",
            post(trigger_short_preview).layer(
                axum::extract::DefaultBodyLimit::max(200_000_000), // ✅ 200 MB pour previews courtes
            ),
        )
        .route("/api/studio/sessions/{session_id}/publish", post(publish_session))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            crate::middlewares::jwt::jwt_auth,
        ))
        .with_state(state)
}

