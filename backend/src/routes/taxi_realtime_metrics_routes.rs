//! ✅ Routes WebSocket Métriques Temps Réel - Taxi & Covoiturage

use axum::{
    extract::{ws::WebSocketUpgrade, State},
    routing::get,
    Router,
};
use std::sync::Arc;

use crate::services::taxi_realtime_metrics_service::{
    handle_realtime_metrics_websocket, TaxiRealtimeMetricsService,
};
use crate::state::AppState;

/// Créer routes WebSocket métriques temps réel
pub fn create_taxi_realtime_metrics_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new().route(
        "/ws/taxi/realtime-metrics",
        get(realtime_metrics_websocket_handler),
    )
}

/// Handler WebSocket métriques temps réel
async fn realtime_metrics_websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> axum::response::Response {
    let metrics_service = Arc::new(TaxiRealtimeMetricsService::new(Arc::new(state.pg.clone())));

    // Démarrer broadcasting
    metrics_service.start_broadcasting().await;

    ws.on_upgrade(move |socket| handle_realtime_metrics_websocket(socket, metrics_service))
}
