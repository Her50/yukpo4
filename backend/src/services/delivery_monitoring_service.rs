/// Service de monitoring avancé pour le système de livraison
/// Fournit des métriques en temps réel et des alertes proactives

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryMetrics {
    pub timestamp: DateTime<Utc>,
    pub active_deliveries: i64,
    pub pending_orders: i64,
    pub available_couriers: i64,
    pub avg_delivery_time_minutes: f64,
    pub success_rate: f64,
    pub today_revenue: f64,
    pub system_health_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertLevel {
    pub level: String, // "info", "warning", "critical"
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub metric_name: String,
    pub current_value: f64,
    pub threshold: f64,
}

pub struct DeliveryMonitoringService {
    pool: PgPool,
    metrics_cache: Arc<RwLock<DeliveryMetrics>>,
    alerts_cache: Arc<RwLock<Vec<AlertLevel>>>,
}

impl DeliveryMonitoringService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            metrics_cache: Arc::new(RwLock::new(DeliveryMetrics {
                timestamp: Utc::now(),
                active_deliveries: 0,
                pending_orders: 0,
                available_couriers: 0,
                avg_delivery_time_minutes: 0.0,
                success_rate: 0.0,
                today_revenue: 0.0,
                system_health_score: 100.0,
            })),
            alerts_cache: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Calculer les métriques en temps réel
    pub async fn calculate_metrics(&self) -> Result<DeliveryMetrics, sqlx::Error> {
        let now = Utc::now();
        let today_start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();

        // Livraisons actives
        let active_deliveries: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM deliveries WHERE status IN ('accepted', 'en_route_pickup', 'shopping_completed', 'en_route_delivery')"
        )
        .fetch_one(&self.pool)
        .await?;

        // Commandes en attente
        let pending_orders: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM product_orders WHERE status = 'pending'"
        )
        .fetch_one(&self.pool)
        .await?;

        // Coursiers disponibles
        let available_couriers: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM couriers WHERE is_active = true AND is_available = true"
        )
        .fetch_one(&self.pool)
        .await?;

        // Temps moyen de livraison (en minutes)
        let avg_delivery_time: f64 = sqlx::query_scalar(
            r#"
            SELECT AVG(EXTRACT(EPOCH FROM (delivered_at - accepted_at))/60) 
            FROM deliveries 
            WHERE status = 'delivered' 
            AND delivered_at >= $1
            "#,
        )
        .bind(today_start)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0.0);

        // Taux de succès (livraisons complétées / total)
        let total_deliveries: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM deliveries WHERE created_at >= $1"
        )
        .bind(today_start)
        .fetch_one(&self.pool)
        .await?;

        let successful_deliveries: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM deliveries WHERE status = 'delivered' AND created_at >= $1"
        )
        .bind(today_start)
        .fetch_one(&self.pool)
        .await?;

        let success_rate = if total_deliveries > 0 {
            (successful_deliveries as f64 / total_deliveries as f64) * 100.0
        } else {
            0.0
        };

        // Revenu du jour
        let today_revenue: f64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(final_total), 0) 
            FROM deliveries 
            WHERE status = 'delivered' 
            AND delivered_at >= $1
            "#,
        )
        .bind(today_start)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0.0);

        // Score de santé du système (0-100)
        let system_health_score = self.calculate_health_score(
            active_deliveries,
            pending_orders,
            available_couriers,
            success_rate,
            avg_delivery_time,
        ).await;

        let metrics = DeliveryMetrics {
            timestamp: now,
            active_deliveries,
            pending_orders,
            available_couriers,
            avg_delivery_time_minutes: avg_delivery_time,
            success_rate,
            today_revenue,
            system_health_score,
        };

        // Mettre à jour le cache
        {
            let mut cache = self.metrics_cache.write().await;
            *cache = metrics.clone();
        }

        Ok(metrics)
    }

    /// Calculer le score de santé du système
    async fn calculate_health_score(
        &self,
        active_deliveries: i64,
        pending_orders: i64,
        available_couriers: i64,
        success_rate: f64,
        avg_delivery_time: f64,
    ) -> f64 {
        let mut score = 100.0;

        // Pénalité si trop de commandes en attente
        if pending_orders > 50 {
            score -= 20.0;
        } else if pending_orders > 20 {
            score -= 10.0;
        }

        // Pénalité si pas assez de coursiers
        let courier_ratio = if available_couriers > 0 {
            active_deliveries as f64 / available_couriers as f64
        } else {
            999.0 // Infini si pas de coursiers
        };

        if courier_ratio > 5.0 {
            score -= 25.0;
        } else if courier_ratio > 3.0 {
            score -= 15.0;
        } else if courier_ratio > 2.0 {
            score -= 5.0;
        }

        // Pénalité si taux de succès faible
        if success_rate < 80.0 {
            score -= 20.0;
        } else if success_rate < 90.0 {
            score -= 10.0;
        }

        // Pénalité si temps de livraison élevé
        if avg_delivery_time > 60.0 {
            score -= 15.0;
        } else if avg_delivery_time > 45.0 {
            score -= 10.0;
        } else if avg_delivery_time > 30.0 {
            score -= 5.0;
        }

        score.max(0.0).min(100.0)
    }

    /// Vérifier les alertes et les générer si nécessaire
    pub async fn check_alerts(&self) -> Result<Vec<AlertLevel>, sqlx::Error> {
        let metrics = self.calculate_metrics().await?;
        let mut alerts = Vec::new();

        // Alertes sur les commandes en attente
        if metrics.pending_orders > 50 {
            alerts.push(AlertLevel {
                level: "critical".to_string(),
                message: "Nombre critique de commandes en attente".to_string(),
                timestamp: Utc::now(),
                metric_name: "pending_orders".to_string(),
                current_value: metrics.pending_orders as f64,
                threshold: 50.0,
            });
        } else if metrics.pending_orders > 20 {
            alerts.push(AlertLevel {
                level: "warning".to_string(),
                message: "Nombre élevé de commandes en attente".to_string(),
                timestamp: Utc::now(),
                metric_name: "pending_orders".to_string(),
                current_value: metrics.pending_orders as f64,
                threshold: 20.0,
            });
        }

        // Alertes sur les coursiers disponibles
        let courier_ratio = if metrics.available_couriers > 0 {
            metrics.active_deliveries as f64 / metrics.available_couriers as f64
        } else {
            999.0
        };

        if courier_ratio > 5.0 {
            alerts.push(AlertLevel {
                level: "critical".to_string(),
                message: "Pénurie critique de coursiers disponibles".to_string(),
                timestamp: Utc::now(),
                metric_name: "courier_ratio".to_string(),
                current_value: courier_ratio,
                threshold: 5.0,
            });
        } else if courier_ratio > 3.0 {
            alerts.push(AlertLevel {
                level: "warning".to_string(),
                message: "Ratio livraison/coursier élevé".to_string(),
                timestamp: Utc::now(),
                metric_name: "courier_ratio".to_string(),
                current_value: courier_ratio,
                threshold: 3.0,
            });
        }

        // Alertes sur le taux de succès
        if metrics.success_rate < 80.0 {
            alerts.push(AlertLevel {
                level: "critical".to_string(),
                message: "Taux de succès des livraisons critique".to_string(),
                timestamp: Utc::now(),
                metric_name: "success_rate".to_string(),
                current_value: metrics.success_rate,
                threshold: 80.0,
            });
        } else if metrics.success_rate < 90.0 {
            alerts.push(AlertLevel {
                level: "warning".to_string(),
                message: "Taux de succès des livraisons faible".to_string(),
                timestamp: Utc::now(),
                metric_name: "success_rate".to_string(),
                current_value: metrics.success_rate,
                threshold: 90.0,
            });
        }

        // Alertes sur le temps de livraison
        if metrics.avg_delivery_time_minutes > 60.0 {
            alerts.push(AlertLevel {
                level: "critical".to_string(),
                message: "Temps de livraison moyen critique".to_string(),
                timestamp: Utc::now(),
                metric_name: "avg_delivery_time".to_string(),
                current_value: metrics.avg_delivery_time_minutes,
                threshold: 60.0,
            });
        } else if metrics.avg_delivery_time_minutes > 45.0 {
            alerts.push(AlertLevel {
                level: "warning".to_string(),
                message: "Temps de livraison moyen élevé".to_string(),
                timestamp: Utc::now(),
                metric_name: "avg_delivery_time".to_string(),
                current_value: metrics.avg_delivery_time_minutes,
                threshold: 45.0,
            });
        }

        // Alertes sur le score de santé
        if metrics.system_health_score < 70.0 {
            alerts.push(AlertLevel {
                level: "critical".to_string(),
                message: "Score de santé du système critique".to_string(),
                timestamp: Utc::now(),
                metric_name: "health_score".to_string(),
                current_value: metrics.system_health_score,
                threshold: 70.0,
            });
        } else if metrics.system_health_score < 85.0 {
            alerts.push(AlertLevel {
                level: "warning".to_string(),
                message: "Score de santé du système faible".to_string(),
                timestamp: Utc::now(),
                metric_name: "health_score".to_string(),
                current_value: metrics.system_health_score,
                threshold: 85.0,
            });
        }

        // Mettre à jour le cache des alertes
        {
            let mut cache = self.alerts_cache.write().await;
            *cache = alerts.clone();
        }

        Ok(alerts)
    }

    /// Obtenir les métriques depuis le cache
    pub async fn get_cached_metrics(&self) -> DeliveryMetrics {
        let cache = self.metrics_cache.read().await;
        cache.clone()
    }

    /// Obtenir les alertes depuis le cache
    pub async fn get_cached_alerts(&self) -> Vec<AlertLevel> {
        let cache = self.alerts_cache.read().await;
        cache.clone()
    }

    /// Envoyer les alertes critiques aux administrateurs
    pub async fn send_critical_alerts(&self) -> Result<(), Box<dyn std::error::Error>> {
        let alerts = self.check_alerts().await?;
        
        for alert in alerts.iter().filter(|a| a.level == "critical") {
            // Envoyer notification push aux admins
            let admin_users: Vec<i32> = sqlx::query_scalar(
                "SELECT id FROM users WHERE role = 'admin' OR is_admin = true"
            )
            .fetch_all(&self.pool)
            .await?;

            for admin_id in admin_users {
                if let Err(e) = crate::services::push_notification_service::send_push_notification(
                    &self.pool,
                    admin_id,
                    format!("🚨 Alert {}", alert.level.to_uppercase()),
                    alert.message.clone(),
                    Some(serde_json::json!({
                        "type": "system_alert",
                        "level": alert.level,
                        "metric": alert.metric_name,
                        "value": alert.current_value,
                        "threshold": alert.threshold
                    })),
                    Some("critical".to_string()),
                ).await {
                    log::error!("[monitoring] Erreur notification admin {}: {}", admin_id, e);
                }
            }

            // Logger l'alerte critique
            log::error!(
                "[monitoring] 🚨 ALERTE CRITIQUE: {} - {} = {} (seuil: {})",
                alert.message,
                alert.metric_name,
                alert.current_value,
                alert.threshold
            );
        }

        Ok(())
    }

    /// Démarrer le monitoring en arrière-plan
    pub async fn start_monitoring(&self) -> Result<(), Box<dyn std::error::Error>> {
        let service = self.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60)); // Toutes les minutes
            
            loop {
                interval.tick().await;
                
                if let Err(e) = service.calculate_metrics().await {
                    log::error!("[monitoring] Erreur calcul métriques: {}", e);
                }
                
                if let Err(e) = service.send_critical_alerts().await {
                    log::error!("[monitoring] Erreur envoi alertes: {}", e);
                }
            }
        });

        log::info!("[monitoring] Service de monitoring démarré");
        Ok(())
    }
}

impl Clone for DeliveryMonitoringService {
    fn clone(&self) -> Self {
        Self {
            pool: self.pool.clone(),
            metrics_cache: Arc::clone(&self.metrics_cache),
            alerts_cache: Arc::clone(&self.alerts_cache),
        }
    }
}
