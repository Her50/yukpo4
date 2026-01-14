use axum::{extract::State, routing::get, Router, Json};
use std::sync::Arc;
use crate::config::feature_flags::FeatureFlagService;
use crate::state::AppState;

/// ✅ NOUVEAU: Endpoint pour récupérer les feature flags
/// Résout le problème 404 dans l'application mobile
pub async fn get_feature_flags(
    _state: State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let flags = FeatureFlagService::from_env();
    Json(serde_json::json!({
        "gpu_worker": flags.is_enabled_key("gpu_worker"),
        "connectors_livekit": flags.is_enabled_key("connectors_livekit"),
        "delivery_v2": flags.is_enabled_key("delivery_v2"),
        "global_promos": flags.is_enabled_key("global_promos"),
    }))
}

pub fn feature_flags_routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/feature-flags", get(get_feature_flags))
}

