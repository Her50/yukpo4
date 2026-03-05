use axum::{
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::studio_controller::{
        attach_asset, create_session, generate_storyboard, get_dependencies, get_next_video,
        get_session, list_preview_events, list_sessions, list_templates, preview_metrics,
        publish_session, recommend_templates, save_timeline, set_dependencies, trigger_preview,
        trigger_short_preview, update_session,
    },
    state::AppState,
};

pub fn studio_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // ✅ CORRECTION RACINE: Timeout augmenté pour les routes preview (120s = 2min)
    // La génération de preview peut prendre 60-90s avec Remotion ou quick preview
    // Note: Le timeout est géré par Nginx (120s) et côté client mobile (120s)
    // Le timeout Axum par défaut est suffisant car Nginx gère déjà le timeout

    Router::new()
        .route(
            "/api/studio/sessions",
            post(create_session).get(list_sessions),
        )
        .route(
            "/api/studio/sessions/{session_id}",
            get(get_session).put(update_session),
        )
        .route(
            "/api/studio/sessions/{session_id}/timeline",
            put(save_timeline),
        )
        .route(
            "/api/studio/sessions/{session_id}/assets",
            post(attach_asset).layer(
                axum::extract::DefaultBodyLimit::max(200_000_000), // ✅ 200 MB pour attachement d'assets
            ),
        )
        .route(
            "/api/studio/sessions/{session_id}/dependencies",
            put(set_dependencies).get(get_dependencies),
        )
        .route(
            "/api/studio/sessions/{session_id}/storyboard",
            post(generate_storyboard),
        )
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
        .route(
            "/api/studio/sessions/{session_id}/publish",
            post(publish_session),
        )
        .route(
            "/api/studio/sessions/{session_id}/next",
            get(get_next_video),
        )
        .route(
            "/api/studio/sessions/{session_id}/previews",
            get(list_preview_events),
        )
        .route(
            "/api/studio/sessions/{session_id}/preview-metrics",
            get(preview_metrics),
        )
        .route(
            "/api/studio/sessions/{session_id}/template-recommendations",
            post(recommend_templates),
        )
        .route("/api/studio/templates", get(list_templates))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            crate::middlewares::jwt::jwt_auth,
        ))
        .with_state(state)
}
