// ✅ Service de gestion GPU automatisé pour GCP Compute Engine
// Gère le scaling automatique, les coûts, et l'intégration avec les appels IA

use crate::core::types::{AppError, AppResult};
use chrono::Utc;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, RwLock};

/// Configuration GPU
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuConfig {
    /// URL de l'endpoint GPU (Compute Engine VM)
    pub gpu_endpoint: String,
    /// Zone GCP (ex: europe-west1-b)
    pub gpu_zone: String,
    /// Nom de l'instance GPU
    pub gpu_instance_name: String,
    /// Projet GCP
    pub gcp_project_id: String,
    /// Service account pour authentification GCP
    pub gcp_service_account: Option<String>,
    /// Budget mensuel maximum (USD)
    pub monthly_budget: f64,
    /// Seuil d'utilisation pour scale up (%)
    pub scale_up_threshold: f64,
    /// Seuil d'utilisation pour scale down (%)
    pub scale_down_threshold: f64,
    /// Délai minimum avant scale down (secondes)
    pub scale_down_cooldown: u64,
    /// Timeout pour les appels GPU (secondes)
    pub request_timeout: u64,
    /// Nombre maximum d'instances GPU
    pub max_instances: u32,
    /// Nombre minimum d'instances GPU
    pub min_instances: u32,
    /// Activer le GPU
    pub enabled: bool,
}

impl GpuConfig {
    pub fn from_env() -> Option<Self> {
        let enabled = std::env::var("GPU_ENABLED")
            .unwrap_or_else(|_| "false".to_string())
            .parse::<bool>()
            .unwrap_or(false);

        if !enabled {
            return None;
        }

        Some(Self {
            gpu_endpoint: std::env::var("GPU_ENDPOINT")
                .unwrap_or_else(|_| "http://localhost:8080".to_string()),
            gpu_zone: std::env::var("GPU_ZONE").unwrap_or_else(|_| "europe-west1-b".to_string()),
            gpu_instance_name: std::env::var("GPU_INSTANCE_NAME")
                .unwrap_or_else(|_| "yukpo-gpu-worker".to_string()),
            gcp_project_id: std::env::var("GCP_PROJECT_ID")
                .expect("GCP_PROJECT_ID requis si GPU_ENABLED=true"),
            gcp_service_account: std::env::var("GCP_SERVICE_ACCOUNT").ok(),
            monthly_budget: std::env::var("GPU_MONTHLY_BUDGET")
                .unwrap_or_else(|_| "100.0".to_string())
                .parse::<f64>()
                .unwrap_or(100.0),
            scale_up_threshold: std::env::var("GPU_SCALE_UP_THRESHOLD")
                .unwrap_or_else(|_| "70.0".to_string())
                .parse::<f64>()
                .unwrap_or(70.0),
            scale_down_threshold: std::env::var("GPU_SCALE_DOWN_THRESHOLD")
                .unwrap_or_else(|_| "20.0".to_string())
                .parse::<f64>()
                .unwrap_or(20.0),
            scale_down_cooldown: std::env::var("GPU_SCALE_DOWN_COOLDOWN")
                .unwrap_or_else(|_| "300".to_string())
                .parse::<u64>()
                .unwrap_or(300),
            request_timeout: std::env::var("GPU_REQUEST_TIMEOUT")
                .unwrap_or_else(|_| "60".to_string())
                .parse::<u64>()
                .unwrap_or(60),
            max_instances: std::env::var("GPU_MAX_INSTANCES")
                .unwrap_or_else(|_| "3".to_string())
                .parse::<u32>()
                .unwrap_or(3),
            min_instances: std::env::var("GPU_MIN_INSTANCES")
                .unwrap_or_else(|_| "0".to_string())
                .parse::<u32>()
                .unwrap_or(0),
            enabled: true,
        })
    }
}

/// Métriques GPU
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GpuMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_response_time_ms: f64,
    pub current_utilization: f64,
    pub active_instances: u32,
    pub monthly_cost_estimate: f64,
    pub last_updated: i64,
}

/// État d'une instance GPU
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInstanceStatus {
    pub name: String,
    pub status: String, // RUNNING, STOPPED, STARTING, STOPPING
    pub utilization: f64,
    pub uptime_seconds: u64,
    pub cost_estimate_hourly: f64,
}

/// Service de gestion GPU
pub struct GpuService {
    config: Arc<GpuConfig>,
    http: reqwest::Client,
    metrics: Arc<RwLock<GpuMetrics>>,
    instances: Arc<RwLock<Vec<GpuInstanceStatus>>>,
    pool: Arc<PgPool>,
    last_scale_action: Arc<Mutex<Option<Instant>>>,
    current_instances: Arc<Mutex<u32>>,
}

impl GpuService {
    pub fn new(config: GpuConfig, pool: Arc<PgPool>) -> Self {
        let timeout = Duration::from_secs(config.request_timeout);
        let http = reqwest::Client::builder()
            .timeout(timeout)
            .build()
            .expect("Création client HTTP GPU");

        info!(
            "[GpuService] ✅ Initialisé - Endpoint: {}, Budget: ${}/mois",
            config.gpu_endpoint, config.monthly_budget
        );

        Self {
            config: Arc::new(config),
            http,
            metrics: Arc::new(RwLock::new(GpuMetrics::default())),
            instances: Arc::new(RwLock::new(Vec::new())),
            pool,
            last_scale_action: Arc::new(Mutex::new(None)),
            current_instances: Arc::new(Mutex::new(0)),
        }
    }

    /// Appelle le GPU pour un traitement IA
    pub async fn process_ai_request(
        &self,
        prompt: &str,
        model: Option<&str>,
        multimodal_data: Option<Value>,
    ) -> AppResult<Value> {
        if !self.config.enabled {
            return Err(AppError::Internal("GPU service désactivé".to_string()));
        }

        let start = Instant::now();

        // Préparer la requête
        let payload = json!({
            "prompt": prompt,
            "model": model.unwrap_or("default"),
            "multimodal": multimodal_data,
            "timestamp": Utc::now().timestamp(),
        });

        // Appeler l'endpoint GPU
        let response = self
            .http
            .post(&format!("{}/api/v1/ai/predict", self.config.gpu_endpoint))
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur appel GPU: {}", e)))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("[GpuService] Erreur GPU HTTP {}: {}", status, error_text);
            return Err(AppError::Internal(format!(
                "Erreur GPU: {} - {}",
                status, error_text
            )));
        }

        let result: Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing réponse GPU: {}", e)))?;

        let elapsed_ms = start.elapsed().as_millis() as f64;

        // Mettre à jour les métriques
        self.update_metrics(true, elapsed_ms).await;

        info!("[GpuService] ✅ Requête IA traitée en {:.2}ms", elapsed_ms);

        Ok(result)
    }

    /// Vérifie et met à jour le scaling automatique
    pub async fn check_and_scale(&self) -> AppResult<()> {
        if !self.config.enabled {
            return Ok(());
        }

        // Récupérer l'utilisation actuelle
        let utilization = self.get_current_utilization().await?;
        let current = *self.current_instances.lock().await;

        info!(
            "[GpuService] Scaling check - Utilisation: {:.1}%, Instances: {}",
            utilization, current
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

        // Scale up si utilisation élevée
        if utilization >= self.config.scale_up_threshold && current < self.config.max_instances {
            info!(
                "[GpuService] ⬆️ Scale UP - Utilisation: {:.1}% >= {}%",
                utilization, self.config.scale_up_threshold
            );
            self.scale_up().await?;
        }
        // Scale down si utilisation faible
        else if utilization < self.config.scale_down_threshold
            && current > self.config.min_instances
        {
            info!(
                "[GpuService] ⬇️ Scale DOWN - Utilisation: {:.1}% < {}%",
                utilization, self.config.scale_down_threshold
            );
            self.scale_down().await?;
        }

        Ok(())
    }

    /// Scale up (démarrer une instance)
    async fn scale_up(&self) -> AppResult<()> {
        let current = *self.current_instances.lock().await;
        if current >= self.config.max_instances {
            return Ok(());
        }

        // Appeler l'API GCP pour démarrer une instance
        // Note: En production, utiliser gcloud CLI ou GCP API
        info!(
            "[GpuService] Démarrage instance GPU: {}",
            self.config.gpu_instance_name
        );

        // TODO: Implémenter l'appel GCP API pour démarrer l'instance
        // Pour l'instant, on simule
        *self.current_instances.lock().await = current + 1;
        *self.last_scale_action.lock().await = Some(Instant::now());

        // Enregistrer dans la base de données
        self.log_scale_action("scale_up", current, current + 1).await;

        Ok(())
    }

    /// Scale down (arrêter une instance)
    async fn scale_down(&self) -> AppResult<()> {
        let current = *self.current_instances.lock().await;
        if current <= self.config.min_instances {
            return Ok(());
        }

        info!(
            "[GpuService] Arrêt instance GPU: {}",
            self.config.gpu_instance_name
        );

        // TODO: Implémenter l'appel GCP API pour arrêter l'instance
        *self.current_instances.lock().await = current - 1;
        *self.last_scale_action.lock().await = Some(Instant::now());

        // Enregistrer dans la base de données
        self.log_scale_action("scale_down", current, current - 1).await;

        Ok(())
    }

    /// Récupère l'utilisation actuelle du GPU
    async fn get_current_utilization(&self) -> AppResult<f64> {
        // Essayer de récupérer depuis l'endpoint GPU
        let response = self
            .http
            .get(&format!("{}/api/v1/metrics", self.config.gpu_endpoint))
            .send()
            .await;

        match response {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(json) = resp.json::<Value>().await {
                    if let Some(util) = json.get("utilization").and_then(|v| v.as_f64()) {
                        return Ok(util);
                    }
                }
            }
            _ => {
                warn!("[GpuService] Impossible de récupérer métriques GPU, utilisation par défaut");
            }
        }

        // Fallback: utiliser les métriques locales
        let metrics = self.metrics.read().await;
        Ok(metrics.current_utilization)
    }

    /// Met à jour les métriques
    async fn update_metrics(&self, success: bool, response_time_ms: f64) {
        let mut metrics = self.metrics.write().await;
        metrics.total_requests += 1;
        if success {
            metrics.successful_requests += 1;
        } else {
            metrics.failed_requests += 1;
        }

        // Calculer la moyenne mobile de la latence
        let alpha = 0.1; // Facteur de lissage
        metrics.average_response_time_ms =
            alpha * response_time_ms + (1.0 - alpha) * metrics.average_response_time_ms;

        metrics.last_updated = Utc::now().timestamp();
    }

    /// Enregistre une action de scaling dans la base de données
    async fn log_scale_action(&self, action: &str, from: u32, to: u32) {
        // Créer la table si elle n'existe pas
        let create_table = r#"
            CREATE TABLE IF NOT EXISTS gpu_scale_actions (
                id SERIAL PRIMARY KEY,
                action VARCHAR(50) NOT NULL,
                instances_from INTEGER NOT NULL,
                instances_to INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        "#;

        let _ = sqlx::query(create_table).execute(&*self.pool).await;

        let query = r#"
            INSERT INTO gpu_scale_actions (action, instances_from, instances_to, created_at)
            VALUES ($1, $2, $3, NOW())
        "#;

        if let Err(e) = sqlx::query(query)
            .bind(action)
            .bind(from as i32)
            .bind(to as i32)
            .execute(&*self.pool)
            .await
        {
            error!("[GpuService] Erreur log scale action: {}", e);
        }
    }

    /// Vérifie le budget et arrête les instances si nécessaire
    pub async fn check_budget(&self) -> AppResult<()> {
        // Récupérer les coûts depuis GCP Billing API ou estimation locale
        let estimated_cost = self.estimate_monthly_cost().await;

        if estimated_cost > self.config.monthly_budget {
            warn!(
                "[GpuService] ⚠️ Budget dépassé: ${:.2} > ${:.2} - Arrêt des instances",
                estimated_cost, self.config.monthly_budget
            );

            // Arrêter toutes les instances
            let current = *self.current_instances.lock().await;
            for _ in 0..current {
                self.scale_down().await?;
            }
        }

        Ok(())
    }

    /// Estime le coût mensuel
    async fn estimate_monthly_cost(&self) -> f64 {
        // Estimation: ~$0.35/heure pour NVIDIA T4
        let hourly_cost = 0.35;
        let current = *self.current_instances.lock().await;
        let hours_in_month = 730.0; // Moyenne

        current as f64 * hourly_cost * hours_in_month
    }

    /// Démarre le monitoring automatique
    pub async fn start_monitoring(&self) {
        let service_scaling = Arc::new(self.clone());
        let service_budget = Arc::new(self.clone());

        // Tâche de monitoring de scaling
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                if let Err(e) = service_scaling.check_and_scale().await {
                    error!("[GpuService] Erreur scaling: {}", e);
                }
            }
        });

        // Tâche de vérification de budget
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(3600)); // Toutes les heures
            loop {
                interval.tick().await;
                if let Err(e) = service_budget.check_budget().await {
                    error!("[GpuService] Erreur vérification budget: {}", e);
                }
            }
        });

        info!("[GpuService] ✅ Monitoring démarré");
    }

    /// Récupère les métriques actuelles
    pub async fn get_metrics(&self) -> GpuMetrics {
        self.metrics.read().await.clone()
    }
}

impl Clone for GpuService {
    fn clone(&self) -> Self {
        Self {
            config: Arc::clone(&self.config),
            http: self.http.clone(),
            metrics: Arc::clone(&self.metrics),
            instances: Arc::clone(&self.instances),
            pool: Arc::clone(&self.pool),
            last_scale_action: Arc::clone(&self.last_scale_action),
            current_instances: Arc::clone(&self.current_instances),
        }
    }
}
