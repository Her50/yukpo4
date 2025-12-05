//! ✅ Service Métriques Temps Réel - Taxi & Covoiturage
//!
//! Streaming métriques en temps réel via WebSocket
//! Objectif: Dashboard temps réel avec alertes

use crate::core::types::{AppError, AppResult};
use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::time::{interval, Duration};
use uuid::Uuid;

/// Métriques temps réel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimeMetrics {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub available_vehicles: i64,
    pub active_requests: i64,
    pub demand_supply_ratio: f64,
    pub average_wait_time_minutes: f64,
    pub conversion_rate: f64,
    pub alerts: Vec<Alert>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub level: String, // "info", "warning", "critical"
    pub message: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Service métriques temps réel
pub struct TaxiRealtimeMetricsService {
    pool: Arc<PgPool>,
    broadcaster: Arc<broadcast::Sender<RealtimeMetrics>>,
    metrics_interval: Duration,
    total_subscribers: Arc<AtomicU64>,
}

impl TaxiRealtimeMetricsService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        let (tx, _rx) = broadcast::channel(1000);

        Self {
            pool,
            broadcaster: Arc::new(tx),
            metrics_interval: Duration::from_secs(5), // Mise à jour toutes les 5s
            total_subscribers: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Obtenir métriques actuelles
    pub async fn get_current_metrics(&self) -> AppResult<RealtimeMetrics> {
        // Comptage véhicules disponibles
        let available_vehicles: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint
            FROM taxis_ville t
            INNER JOIN services s ON s.id = t.service_id
            WHERE t.is_active = true
            AND t.is_on_duty = true
            AND s.is_active = true
            "#,
        )
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        // Demandes actives (pending + confirmed)
        let active_requests: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint
            FROM specialized_reservations
            WHERE service_type IN ('taxi', 'covoiturage')
            AND status IN ('pending', 'confirmed')
            "#,
        )
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        // Ratio demande/offre
        let demand_supply_ratio = if available_vehicles > 0 {
            active_requests as f64 / available_vehicles as f64
        } else {
            active_requests as f64
        };

        // Temps d'attente moyen (simplifié)
        let average_wait_time_minutes = 5.0; // TODO: Calculer réellement

        // Taux de conversion (simplifié)
        let conversion_rate = 0.75; // TODO: Calculer réellement

        // Détecter alertes
        let alerts = self
            .detect_alerts(available_vehicles, active_requests, demand_supply_ratio)
            .await;

        Ok(RealtimeMetrics {
            timestamp: chrono::Utc::now(),
            available_vehicles,
            active_requests,
            demand_supply_ratio,
            average_wait_time_minutes,
            conversion_rate,
            alerts,
        })
    }

    /// Détecter alertes
    async fn detect_alerts(
        &self,
        available_vehicles: i64,
        active_requests: i64,
        ratio: f64,
    ) -> Vec<Alert> {
        let mut alerts = Vec::new();
        let now = chrono::Utc::now();

        // Alerte: Demande > Offre
        if ratio > 2.0 {
            alerts.push(Alert {
                level: "critical".to_string(),
                message: format!(
                    "Demande critique: {} demandes pour {} véhicules disponibles",
                    active_requests, available_vehicles
                ),
                timestamp: now,
            });
        } else if ratio > 1.5 {
            alerts.push(Alert {
                level: "warning".to_string(),
                message: format!(
                    "Demande élevée: {} demandes pour {} véhicules",
                    active_requests, available_vehicles
                ),
                timestamp: now,
            });
        }

        // Alerte: Pas de véhicules disponibles
        if available_vehicles == 0 && active_requests > 0 {
            alerts.push(Alert {
                level: "critical".to_string(),
                message: "Aucun véhicule disponible".to_string(),
                timestamp: now,
            });
        }

        alerts
    }

    /// Démarrer broadcasting métriques
    pub async fn start_broadcasting(&self) {
        let mut interval = interval(self.metrics_interval);
        let broadcaster = self.broadcaster.clone();
        let pool = self.pool.clone();

        tokio::spawn(async move {
            loop {
                interval.tick().await;

                // Obtenir métriques
                let metrics = Self::get_current_metrics_static(&pool).await;

                // Diffuser
                if let Ok(metrics) = metrics {
                    let _ = broadcaster.send(metrics);
                }
            }
        });
    }

    async fn get_current_metrics_static(pool: &PgPool) -> AppResult<RealtimeMetrics> {
        let service = Self::new(Arc::new(pool.clone()));
        service.get_current_metrics().await
    }

    /// S'abonner aux métriques
    pub fn subscribe(&self, client_id: String) -> broadcast::Receiver<RealtimeMetrics> {
        self.total_subscribers.fetch_add(1, Ordering::Relaxed);
        let receiver = self.broadcaster.subscribe();

        // Le HashMap subscribers n'est pas critique pour le fonctionnement
        // On peut simplement s'abonner au broadcaster

        info!(
            "[TaxiRealtimeMetrics] Client {} abonné, total: {}",
            client_id,
            self.total_subscribers.load(Ordering::Relaxed)
        );

        receiver
    }

    /// Se désabonner
    pub fn unsubscribe(&self, client_id: &str) {
        self.total_subscribers.fetch_sub(1, Ordering::Relaxed);

        info!(
            "[TaxiRealtimeMetrics] Client {} désabonné, total: {}",
            client_id,
            self.total_subscribers.load(Ordering::Relaxed)
        );
    }
}

/// Gérer connexion WebSocket métriques temps réel
pub async fn handle_realtime_metrics_websocket(
    socket: WebSocket,
    metrics_service: Arc<TaxiRealtimeMetricsService>,
) {
    let (mut sender, mut receiver) = socket.split();
    let client_id = Uuid::new_v4().to_string();

    // S'abonner aux métriques
    let mut metrics_rx = metrics_service.subscribe(client_id.clone());

    info!("[TaxiRealtimeMetrics] ✅ WebSocket connecté: {}", client_id);

    // Tâche: Envoyer métriques
    let mut send_task = tokio::spawn(async move {
        loop {
            match metrics_rx.recv().await {
                Ok(metrics) => {
                    let json = json!(metrics);
                    if sender.send(Message::Text(json.to_string())).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    // Tâche: Recevoir messages client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(_))) = receiver.next().await {
            // Client peut envoyer des requêtes (ex: filtrer par zone)
            // Pour l'instant, on ignore
        }
    });

    // Attendre fin d'une des tâches
    tokio::select! {
        _ = &mut send_task => {
            recv_task.abort();
        }
        _ = &mut recv_task => {
            send_task.abort();
        }
    }

    // Désabonner
    metrics_service.unsubscribe(&client_id);
    info!(
        "[TaxiRealtimeMetrics] ❌ WebSocket déconnecté: {}",
        client_id
    );
}
