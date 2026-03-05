/// Routes pour le monitoring du système de livraison
/// Fournit les métriques en temps réel et les alertes

use axum::{
    extract::State,
    response::Json,
    routing::get,
    Router,
};
use serde_json::json;
use sqlx::FromRow;
use std::collections::HashMap;
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    services::delivery_monitoring_service::{DeliveryMonitoringService, AlertLevel},
    state::AppState,
};

/// GET /api/monitoring/metrics - Métriques en temps réel (admin uniquement)
pub async fn get_metrics(
    State(state): State<Arc<AppState>>,
    _user: AuthenticatedUser,
) -> AppResult<Json<serde_json::Value>> {
    let monitoring_service = DeliveryMonitoringService::new(state.pg.clone());
    
    let metrics = monitoring_service.calculate_metrics().await
        .map_err(|e| AppError::Internal(format!("Erreur récupération métriques: {}", e)))?;
    
    Ok(Json(json!({
        "success": true,
        "data": metrics
    })))
}

/// GET /api/monitoring/health - Score de santé du système (public)
pub async fn get_health_score(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    let monitoring_service = DeliveryMonitoringService::new(state.pg.clone());
    
    let metrics = monitoring_service.calculate_metrics().await
        .map_err(|e| AppError::Internal(format!("Erreur récupération santé: {}", e)))?;
    
    let health_status = match metrics.system_health_score {
        score if score >= 90.0 => "excellent",
        score if score >= 80.0 => "good",
        score if score >= 70.0 => "fair",
        score if score >= 50.0 => "poor",
        _ => "critical",
    };
    
    Ok(Json(json!({
        "success": true,
        "health_score": metrics.system_health_score,
        "health_status": health_status,
        "timestamp": metrics.timestamp,
        "metrics": {
            "active_deliveries": metrics.active_deliveries,
            "pending_orders": metrics.pending_orders,
            "available_couriers": metrics.available_couriers,
            "success_rate": metrics.success_rate,
            "avg_delivery_time_minutes": metrics.avg_delivery_time_minutes,
            "today_revenue": metrics.today_revenue
        }
    })))
}

/// GET /api/monitoring/alerts - Alertes actuelles (admin uniquement)
pub async fn get_alerts(
    State(state): State<Arc<AppState>>,
    _user: AuthenticatedUser,
) -> AppResult<Json<serde_json::Value>> {
    let monitoring_service = DeliveryMonitoringService::new(state.pg.clone());
    
    let alerts = monitoring_service.check_alerts().await
        .map_err(|e| AppError::Internal(format!("Erreur récupération alertes: {}", e)))?;
    
    // Compter les alertes par niveau
    let mut counts = HashMap::new();
    counts.insert("critical", 0);
    counts.insert("warning", 0);
    counts.insert("info", 0);
    
    for alert in &alerts {
        *counts.entry(&alert.level).or_insert(0) += 1;
    }
    
    Ok(Json(json!({
        "success": true,
        "alerts": alerts,
        "summary": {
            "total": alerts.len(),
            "critical": counts["critical"],
            "warning": counts["warning"],
            "info": counts["info"]
        }
    })))
}

/// GET /api/monitoring/dashboard - Dashboard complet (admin uniquement)
pub async fn get_dashboard(
    State(state): State<Arc<AppState>>,
    _user: AuthenticatedUser,
) -> AppResult<Json<serde_json::Value>> {
    let monitoring_service = DeliveryMonitoringService::new(state.pg.clone());
    
    let metrics = monitoring_service.calculate_metrics().await
        .map_err(|e| AppError::Internal(format!("Erreur récupération dashboard: {}", e)))?;
    
    let alerts = monitoring_service.check_alerts().await
        .map_err(|e| AppError::Internal(format!("Erreur récupération alertes: {}", e)))?;
    
    // Statistiques des 7 derniers jours
    let seven_days_ago = chrono::Utc::now() - chrono::Duration::days(7);
    
    let weekly_stats: Vec<serde_json::Value> = sqlx::query(
        r#"
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_deliveries,
            COUNT(CASE WHEN status = 'delivered' THEN 1 END) as successful_deliveries,
            COALESCE(SUM(final_total), 0) as revenue
        FROM deliveries 
        WHERE created_at >= $1
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        "#,
    )
    .bind(seven_days_ago)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur stats hebdo: {}", e)))?
    .into_iter()
    .map(|row| {
        let date: String = row.get("date");
        let total: i64 = row.get("total_deliveries");
        let successful: i64 = row.get("successful_deliveries");
        let revenue: f64 = row.get("revenue");
        
        json!({
            "date": date,
            "total_deliveries": total,
            "successful_deliveries": successful,
            "success_rate": if total > 0 { (successful as f64 / total as f64) * 100.0 } else { 0.0 },
            "revenue": revenue
        })
    })
    .collect();
    
    // Top 5 des coursiers
    let top_couriers: Vec<serde_json::Value> = sqlx::query(
        r#"
        SELECT 
            c.id,
            c.nom_complet,
            COUNT(d.id) as deliveries_count,
            AVG(EXTRACT(EPOCH FROM (d.delivered_at - d.accepted_at))/60) as avg_time_minutes,
            COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as successful_deliveries
        FROM couriers c
        LEFT JOIN deliveries d ON c.id = d.courier_id
        WHERE d.created_at >= $1
        GROUP BY c.id, c.nom_complet
        HAVING COUNT(d.id) > 0
        ORDER BY deliveries_count DESC
        LIMIT 5
        "#,
    )
    .bind(seven_days_ago)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur top coursiers: {}", e)))?
    .into_iter()
    .map(|row| {
        json!({
            "id": row.get::<i64, _>("id"),
            "name": row.get::<String, _>("nom_complet"),
            "deliveries_count": row.get::<i64, _>("deliveries_count"),
            "avg_time_minutes": row.get::<Option<f64>, _>("avg_time_minutes").unwrap_or(0.0),
            "success_rate": {
                let total = row.get::<i64, _>("deliveries_count");
                let successful = row.get::<i64, _>("successful_deliveries");
                if total > 0 { (successful as f64 / total as f64) * 100.0 } else { 0.0 }
            }
        })
    })
    .collect();
    
    Ok(Json(json!({
        "success": true,
        "current_metrics": metrics,
        "alerts": alerts,
        "weekly_stats": weekly_stats,
        "top_couriers": top_couriers,
        "system_score": {
            "overall": metrics.system_health_score,
            "grade": match metrics.system_health_score {
                score if score >= 95.0 => "A+",
                score if score >= 90.0 => "A",
                score if score >= 85.0 => "B+",
                score if score >= 80.0 => "B",
                score if score >= 75.0 => "C+",
                score if score >= 70.0 => "C",
                score if score >= 65.0 => "D",
                _ => "F"
            }
        }
    })))
}

pub fn monitoring_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/monitoring/metrics", get(get_metrics))
        .route("/api/monitoring/health", get(get_health_score))
        .route("/api/monitoring/alerts", get(get_alerts))
        .route("/api/monitoring/dashboard", get(get_dashboard))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            crate::middlewares::jwt::jwt_auth,
        ))
        .with_state(state)
}
