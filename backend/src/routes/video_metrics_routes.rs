// ✅ Phase 4: Routes pour exposer les métriques Prometheus de scalabilité vidéo

use axum::http::StatusCode;
use axum::{response::Response, routing::get, Router};
use std::sync::Arc;

use crate::services::prometheus_metrics::render_metrics;
use crate::state::AppState;

/// ✅ Expose les métriques Prometheus au format texte
pub async fn prometheus_metrics_handler() -> Response<String> {
    let metrics = render_metrics();
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
        .body(metrics)
        .unwrap()
}

pub fn video_metrics_routes() -> Router<Arc<AppState>> {
    Router::new().route("/metrics/prometheus", get(prometheus_metrics_handler))
}
