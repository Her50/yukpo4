// Contrôleur pour exposer les métriques de performance

use axum::{extract::State, response::Json};
use std::sync::Arc;
use crate::state::AppState;
use crate::services::query_monitor::QueryMonitor;

/// Obtenir les statistiques de performance globales
pub async fn get_performance_stats(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    // Récupérer le QueryMonitor depuis l'AppState si disponible
    // Pour l'instant, on retourne des stats basiques
    Json(serde_json::json!({
        "status": "ok",
        "message": "Performance stats endpoint - QueryMonitor à intégrer dans AppState",
        "timestamp": chrono::Utc::now(),
    }))
}

/// Obtenir les requêtes les plus lentes
pub async fn get_slow_queries(
    State(_state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "message": "Slow queries endpoint - QueryMonitor à intégrer dans AppState",
        "queries": [],
    }))
}

