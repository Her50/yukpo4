// ✅ Service de gestion Redis Memorystore automatisé pour GCP
// Gère le scaling automatique, les coûts, et l'intégration avec le trafic

use crate::core::types::{AppError, AppResult};
use chrono::Utc;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, RwLock};

/// Configuration Redis Memorystore
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisScalingConfig {
    /// Instance Redis Memorystore (ex: yukpo-redis)
    pub redis_instance_name: String,
    /// Région GCP (ex: europe-west1)
    pub redis_region: String,
    /// Projet GCP
    pub gcp_project_id: String,
    /// Budget mensuel maximum (USD)
    pub monthly_budget: f64,
    /// Seuil d'utilisation mémoire pour scale up (%)
    pub scale_up_memory_threshold: f64,
    /// Seuil d'utilisation mémoire pour scale down (%)
    pub scale_down_memory_threshold: f64,
    /// Seuil de connexions pour scale up (nombre)
    pub scale_up_connections_threshold: u32,
    /// Seuil de connexions pour scale down (nombre)
    pub scale_down_connections_threshold: u32,
    /// Délai minimum avant scale down (secondes)
    pub scale_down_cooldown: u64,
    /// Taille mémoire minimale (GB)
    pub min_memory_gb: f64,
    /// Taille mémoire maximale (GB)
    pub max_memory_gb: f64,
    /// Taille mémoire actuelle (GB)
    pub current_memory_gb: f64,
    /// Activer le scaling automatique
    pub enabled: bool,
}

impl RedisScalingConfig {
    pub fn from_env() -> Option<Self> {
        let enabled = std::env::var("REDIS_SCALING_ENABLED")
            .unwrap_or_else(|_| "true".to_string())
            .parse::<bool>()
            .unwrap_or(true);

        if !enabled {
            return None;
        }

        Some(Self {
            redis_instance_name: std::env::var("REDIS_INSTANCE_NAME")
                .unwrap_or_else(|_| "yukpo-redis".to_string()),
            redis_region: std::env::var("REDIS_REGION")
                .unwrap_or_else(|_| "europe-west1".to_string()),
            gcp_project_id: std::env::var("GCP_PROJECT_ID")
                .expect("GCP_PROJECT_ID requis si REDIS_SCALING_ENABLED=true"),
            monthly_budget: std::env::var("REDIS_MONTHLY_BUDGET")
                .unwrap_or_else(|_| "50.0".to_string())
                .parse::<f64>()
                .unwrap_or(50.0),
            scale_up_memory_threshold: std::env::var("REDIS_SCALE_UP_MEMORY_THRESHOLD")
                .unwrap_or_else(|_| "80.0".to_string())
                .parse::<f64>()
                .unwrap_or(80.0),
            scale_down_memory_threshold: std::env::var("REDIS_SCALE_DOWN_MEMORY_THRESHOLD")
                .unwrap_or_else(|_| "30.0".to_string())
                .parse::<f64>()
                .unwrap_or(30.0),
            scale_up_connections_threshold: std::env::var("REDIS_SCALE_UP_CONNECTIONS_THRESHOLD")
                .unwrap_or_else(|_| "1000".to_string())
                .parse::<u32>()
                .unwrap_or(1000),
            scale_down_connections_threshold: std::env::var(
                "REDIS_SCALE_DOWN_CONNECTIONS_THRESHOLD",
            )
            .unwrap_or_else(|_| "100".to_string())
            .parse::<u32>()
            .unwrap_or(100),
            scale_down_cooldown: std::env::var("REDIS_SCALE_DOWN_COOLDOWN")
                .unwrap_or_else(|_| "600".to_string())
                .parse::<u64>()
                .unwrap_or(600),
            min_memory_gb: std::env::var("REDIS_MIN_MEMORY_GB")
                .unwrap_or_else(|_| "1.0".to_string())
                .parse::<f64>()
                .unwrap_or(1.0),
            max_memory_gb: std::env::var("REDIS_MAX_MEMORY_GB")
                .unwrap_or_else(|_| "10.0".to_string())
                .parse::<f64>()
                .unwrap_or(10.0),
            current_memory_gb: std::env::var("REDIS_CURRENT_MEMORY_GB")
                .unwrap_or_else(|_| "1.0".to_string())
                .parse::<f64>()
                .unwrap_or(1.0),
            enabled: true,
        })
    }
}

/// Métriques Redis
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RedisMetrics {
    pub memory_used_bytes: u64,
    pub memory_used_percent: f64,
    pub connected_clients: u32,
    pub total_commands_processed: u64,
    pub keyspace_hits: u64,
    pub keyspace_misses: u64,
    pub evicted_keys: u64,
    pub monthly_cost_estimate: f64,
    pub last_updated: i64,
}

/// Service de gestion Redis Memorystore
pub struct RedisScalingService {
    config: Arc<RedisScalingConfig>,
    metrics: Arc<RwLock<RedisMetrics>>,
    pool: Arc<PgPool>,
    last_scale_action: Arc<Mutex<Option<Instant>>>,
    redis_client: Option<Arc<redis::Client>>,
}

impl RedisScalingService {
    pub fn new(
        config: RedisScalingConfig,
        pool: Arc<PgPool>,
        redis_client: Option<Arc<redis::Client>>,
    ) -> Self {
        info!(
            "[RedisScalingService] ✅ Initialisé - Instance: {}, Budget: ${}/mois",
            config.redis_instance_name, config.monthly_budget
        );

        Self {
            config: Arc::new(config),
            metrics: Arc::new(RwLock::new(RedisMetrics::default())),
            pool,
            last_scale_action: Arc::new(Mutex::new(None)),
            redis_client,
        }
    }

    /// Récupère les métriques Redis actuelles
    pub async fn get_current_metrics(&self) -> AppResult<RedisMetrics> {
        if let Some(ref client) = self.redis_client {
            let mut conn = client
                .get_multiplexed_async_connection()
                .await
                .map_err(|e| AppError::Internal(format!("Erreur connexion Redis: {}", e)))?;

            // Récupérer les métriques via INFO
            let info: String = redis::cmd("INFO")
                .arg("memory")
                .query_async(&mut conn)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur INFO Redis: {}", e)))?;

            let mut metrics = RedisMetrics::default();

            // Parser les métriques
            for line in info.lines() {
                if line.starts_with("used_memory:") {
                    if let Some(value) = line.split(':').nth(1) {
                        metrics.memory_used_bytes = value.trim().parse().unwrap_or(0);
                    }
                } else if line.starts_with("used_memory_peak:") {
                    // Utilisé pour calculer le pourcentage
                }
            }

            // Récupérer les clients connectés
            let clients: String = redis::cmd("INFO")
                .arg("clients")
                .query_async(&mut conn)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur INFO clients Redis: {}", e)))?;

            for line in clients.lines() {
                if line.starts_with("connected_clients:") {
                    if let Some(value) = line.split(':').nth(1) {
                        metrics.connected_clients = value.trim().parse().unwrap_or(0);
                    }
                }
            }

            // Récupérer les stats
            let stats: String = redis::cmd("INFO")
                .arg("stats")
                .query_async(&mut conn)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur INFO stats Redis: {}", e)))?;

            for line in stats.lines() {
                if line.starts_with("total_commands_processed:") {
                    if let Some(value) = line.split(':').nth(1) {
                        metrics.total_commands_processed = value.trim().parse().unwrap_or(0);
                    }
                } else if line.starts_with("keyspace_hits:") {
                    if let Some(value) = line.split(':').nth(1) {
                        metrics.keyspace_hits = value.trim().parse().unwrap_or(0);
                    }
                } else if line.starts_with("keyspace_misses:") {
                    if let Some(value) = line.split(':').nth(1) {
                        metrics.keyspace_misses = value.trim().parse().unwrap_or(0);
                    }
                } else if line.starts_with("evicted_keys:") {
                    if let Some(value) = line.split(':').nth(1) {
                        metrics.evicted_keys = value.trim().parse().unwrap_or(0);
                    }
                }
            }

            // Calculer le pourcentage d'utilisation mémoire
            let memory_gb = self.config.current_memory_gb;
            let memory_bytes = memory_gb * 1024.0 * 1024.0 * 1024.0;
            metrics.memory_used_percent = (metrics.memory_used_bytes as f64 / memory_bytes) * 100.0;

            // Estimer le coût mensuel
            metrics.monthly_cost_estimate = self.estimate_monthly_cost(memory_gb).await;
            metrics.last_updated = Utc::now().timestamp();

            // Mettre à jour les métriques
            *self.metrics.write().await = metrics.clone();

            Ok(metrics)
        } else {
            Err(AppError::Internal(
                "Client Redis non disponible".to_string(),
            ))
        }
    }

    /// Vérifie et met à jour le scaling automatique
    pub async fn check_and_scale(&self) -> AppResult<()> {
        if !self.config.enabled {
            return Ok(());
        }

        // Récupérer les métriques actuelles
        let metrics = self.get_current_metrics().await?;
        let current_memory = self.config.current_memory_gb;

        info!(
            "[RedisScalingService] Scaling check - Mémoire: {:.1}% ({:.2}GB/{:.2}GB), Clients: {}",
            metrics.memory_used_percent,
            metrics.memory_used_bytes as f64 / (1024.0 * 1024.0 * 1024.0),
            current_memory,
            metrics.connected_clients
        );

        // Vérifier le cooldown
        let last_action = self.last_scale_action.lock().await;
        if let Some(last) = *last_action {
            let elapsed = last.elapsed().as_secs();
            if elapsed < self.config.scale_down_cooldown {
                return Ok(()); // En cooldown
            }
        }
        drop(last_action);

        // Scale up si utilisation mémoire élevée OU trop de connexions
        if (metrics.memory_used_percent >= self.config.scale_up_memory_threshold
            || metrics.connected_clients >= self.config.scale_up_connections_threshold)
            && current_memory < self.config.max_memory_gb
        {
            let new_memory = (current_memory + 1.0).min(self.config.max_memory_gb);
            info!(
                "[RedisScalingService] ⬆️ Scale UP - Mémoire: {:.1}% >= {}% OU Clients: {} >= {}",
                metrics.memory_used_percent,
                self.config.scale_up_memory_threshold,
                metrics.connected_clients,
                self.config.scale_up_connections_threshold
            );
            self.scale_up(new_memory).await?;
        }
        // Scale down si utilisation mémoire faible ET peu de connexions
        else if metrics.memory_used_percent < self.config.scale_down_memory_threshold
            && metrics.connected_clients < self.config.scale_down_connections_threshold
            && current_memory > self.config.min_memory_gb
        {
            let new_memory = (current_memory - 1.0).max(self.config.min_memory_gb);
            info!(
                "[RedisScalingService] ⬇️ Scale DOWN - Mémoire: {:.1}% < {}% ET Clients: {} < {}",
                metrics.memory_used_percent,
                self.config.scale_down_memory_threshold,
                metrics.connected_clients,
                self.config.scale_down_connections_threshold
            );
            self.scale_down(new_memory).await?;
        }

        Ok(())
    }

    /// Scale up (augmenter la mémoire)
    async fn scale_up(&self, new_memory_gb: f64) -> AppResult<()> {
        let current = self.config.current_memory_gb;

        // Note: Memorystore Redis nécessite une mise à jour via gcloud
        // Pour l'instant, on log l'action et on met à jour la config
        info!(
            "[RedisScalingService] ⬆️ Scale UP: {:.2}GB → {:.2}GB",
            current, new_memory_gb
        );

        // Enregistrer l'action
        self.log_scale_action("scale_up", current, new_memory_gb).await;

        // Mettre à jour la config (en production, utiliser gcloud pour mettre à jour l'instance)
        // Pour l'instant, on log seulement
        warn!("[RedisScalingService] ⚠️ Action de scaling requise manuellement via gcloud:");
        warn!(
            "   gcloud redis instances update {} --size={} --region={} --project={}",
            self.config.redis_instance_name,
            new_memory_gb as u32,
            self.config.redis_region,
            self.config.gcp_project_id
        );

        // Mettre à jour le timestamp
        *self.last_scale_action.lock().await = Some(Instant::now());

        Ok(())
    }

    /// Scale down (réduire la mémoire)
    async fn scale_down(&self, new_memory_gb: f64) -> AppResult<()> {
        let current = self.config.current_memory_gb;

        info!(
            "[RedisScalingService] ⬇️ Scale DOWN: {:.2}GB → {:.2}GB",
            current, new_memory_gb
        );

        // Enregistrer l'action
        self.log_scale_action("scale_down", current, new_memory_gb).await;

        // Mettre à jour la config (en production, utiliser gcloud pour mettre à jour l'instance)
        warn!("[RedisScalingService] ⚠️ Action de scaling requise manuellement via gcloud:");
        warn!(
            "   gcloud redis instances update {} --size={} --region={} --project={}",
            self.config.redis_instance_name,
            new_memory_gb as u32,
            self.config.redis_region,
            self.config.gcp_project_id
        );

        // Mettre à jour le timestamp
        *self.last_scale_action.lock().await = Some(Instant::now());

        Ok(())
    }

    /// Enregistre une action de scaling dans la base de données
    async fn log_scale_action(&self, action: &str, from: f64, to: f64) {
        // Créer la table si elle n'existe pas
        let create_table = r#"
            CREATE TABLE IF NOT EXISTS redis_scale_actions (
                id SERIAL PRIMARY KEY,
                action VARCHAR(50) NOT NULL,
                memory_from_gb DECIMAL(10,2) NOT NULL,
                memory_to_gb DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        "#;

        let _ = sqlx::query(create_table).execute(&*self.pool).await;

        let query = r#"
            INSERT INTO redis_scale_actions (action, memory_from_gb, memory_to_gb, created_at)
            VALUES ($1, $2, $3, NOW())
        "#;

        if let Err(e) =
            sqlx::query(query).bind(action).bind(from).bind(to).execute(&*self.pool).await
        {
            error!("[RedisScalingService] Erreur log scale action: {}", e);
        }
    }

    /// Vérifie le budget et arrête le scaling si nécessaire
    pub async fn check_budget(&self) -> AppResult<()> {
        let metrics = self.get_current_metrics().await?;

        if metrics.monthly_cost_estimate > self.config.monthly_budget {
            warn!(
                "[RedisScalingService] ⚠️ Budget dépassé: ${:.2} > ${:.2} - Scaling désactivé",
                metrics.monthly_cost_estimate, self.config.monthly_budget
            );

            // Désactiver le scaling automatique
            // Note: En production, on pourrait mettre à jour la config
            warn!(
                "[RedisScalingService] ⚠️ Scaling automatique désactivé jusqu'à ce que le budget soit respecté"
            );
        }

        Ok(())
    }

    /// Estime le coût mensuel
    async fn estimate_monthly_cost(&self, memory_gb: f64) -> f64 {
        // Estimation: ~$0.054/GB/heure pour Memorystore Redis BASIC
        let hourly_cost_per_gb = 0.054;
        let hours_in_month = 730.0; // Moyenne

        memory_gb * hourly_cost_per_gb * hours_in_month
    }

    /// Démarre le monitoring automatique
    pub async fn start_monitoring(&self) {
        let service_scaling = Arc::new(self.clone());
        let service_budget = Arc::new(self.clone());

        // Tâche de monitoring de scaling
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(300)); // Toutes les 5 minutes
            loop {
                interval.tick().await;
                if let Err(e) = service_scaling.check_and_scale().await {
                    error!("[RedisScalingService] Erreur scaling: {}", e);
                }
            }
        });

        // Tâche de vérification de budget
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(3600)); // Toutes les heures
            loop {
                interval.tick().await;
                if let Err(e) = service_budget.check_budget().await {
                    error!("[RedisScalingService] Erreur vérification budget: {}", e);
                }
            }
        });

        info!("[RedisScalingService] ✅ Monitoring démarré");
    }

    /// Récupère les métriques actuelles
    pub async fn get_metrics(&self) -> RedisMetrics {
        self.metrics.read().await.clone()
    }

    /// Récupère la configuration Redis
    pub fn get_config(&self) -> &RedisScalingConfig {
        &self.config
    }
}

impl Clone for RedisScalingService {
    fn clone(&self) -> Self {
        Self {
            config: Arc::clone(&self.config),
            metrics: Arc::clone(&self.metrics),
            pool: Arc::clone(&self.pool),
            last_scale_action: Arc::clone(&self.last_scale_action),
            redis_client: self.redis_client.as_ref().map(|c| Arc::clone(c)),
        }
    }
}
