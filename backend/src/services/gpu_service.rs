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

    /// Scale up (démarrer une instance via GCP Compute Engine API)
    async fn scale_up(&self) -> AppResult<()> {
        let current = *self.current_instances.lock().await;
        if current >= self.config.max_instances {
            return Ok(());
        }

        info!(
            "[GpuService] ⬆️ Démarrage instance GPU via GCP API: {}",
            self.config.gpu_instance_name
        );

        // Appeler l'API GCP Compute Engine pour démarrer l'instance
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}/start",
            self.config.gcp_project_id, self.config.gpu_zone, self.config.gpu_instance_name
        );

        match self.gcp_authenticated_post(&url).await {
            Ok(_) => {
                info!(
                    "[GpuService] ✅ Instance {} démarrée via GCP API",
                    self.config.gpu_instance_name
                );
                *self.current_instances.lock().await = current + 1;
                *self.last_scale_action.lock().await = Some(Instant::now());
                self.log_scale_action("scale_up", current, current + 1).await;
            }
            Err(e) => {
                warn!(
                    "[GpuService] ⚠️ Erreur démarrage instance GCP: {} - incrémentation locale",
                    e
                );
                // Incrémentation locale même en cas d'échec API pour éviter boucle
                *self.current_instances.lock().await = current + 1;
                *self.last_scale_action.lock().await = Some(Instant::now());
                self.log_scale_action("scale_up_fallback", current, current + 1).await;
            }
        }

        Ok(())
    }

    /// Scale down (arrêter une instance via GCP Compute Engine API)
    async fn scale_down(&self) -> AppResult<()> {
        let current = *self.current_instances.lock().await;
        if current <= self.config.min_instances {
            return Ok(());
        }

        info!(
            "[GpuService] ⬇️ Arrêt instance GPU via GCP API: {}",
            self.config.gpu_instance_name
        );

        // Appeler l'API GCP Compute Engine pour arrêter l'instance
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}/stop",
            self.config.gcp_project_id, self.config.gpu_zone, self.config.gpu_instance_name
        );

        match self.gcp_authenticated_post(&url).await {
            Ok(_) => {
                info!(
                    "[GpuService] ✅ Instance {} arrêtée via GCP API",
                    self.config.gpu_instance_name
                );
                *self.current_instances.lock().await = current - 1;
                *self.last_scale_action.lock().await = Some(Instant::now());
                self.log_scale_action("scale_down", current, current - 1).await;
            }
            Err(e) => {
                warn!(
                    "[GpuService] ⚠️ Erreur arrêt instance GCP: {} - décrémentation locale",
                    e
                );
                *self.current_instances.lock().await = current - 1;
                *self.last_scale_action.lock().await = Some(Instant::now());
                self.log_scale_action("scale_down_fallback", current, current - 1).await;
            }
        }

        Ok(())
    }

    /// Récupère l'utilisation actuelle du GPU
    /// ✅ CORRIGÉ 2026-02-18: Ajout retry avec backoff exponentiel et logs détaillés
    async fn get_current_utilization(&self) -> AppResult<f64> {
        let endpoint = format!("{}/api/v1/metrics", self.config.gpu_endpoint);
        let max_retries = 3;
        let mut last_error = None;

        // Retry avec backoff exponentiel
        for attempt in 0..max_retries {
            let response =
                self.http.get(&endpoint).timeout(std::time::Duration::from_secs(5)).send().await;

            match response {
                Ok(resp) if resp.status().is_success() => match resp.json::<Value>().await {
                    Ok(json) => {
                        if let Some(util) = json.get("utilization").and_then(|v| v.as_f64()) {
                            if attempt > 0 {
                                info!(
                                        "[GpuService] ✅ Métriques GPU récupérées après {} tentative(s)",
                                        attempt + 1
                                    );
                            }
                            return Ok(util);
                        } else {
                            last_error =
                                Some(format!("Réponse JSON invalide: pas de champ 'utilization'"));
                        }
                    }
                    Err(e) => {
                        last_error = Some(format!("Erreur parsing JSON: {}", e));
                    }
                },
                Ok(resp) => {
                    let status = resp.status();
                    let error_text = resp.text().await.unwrap_or_default();
                    last_error = Some(format!("HTTP {}: {}", status, error_text));
                }
                Err(e) => {
                    last_error = Some(format!("Erreur réseau: {}", e));
                }
            }

            // Si ce n'est pas la dernière tentative, attendre avant de réessayer
            if attempt < max_retries - 1 {
                let delay_ms = 100 * (1 << attempt); // Backoff exponentiel: 100ms, 200ms, 400ms
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
            }
        }

        // Toutes les tentatives ont échoué — passé en `debug!` pour ne pas
        // polluer les logs Cloud Logging (1 ligne toutes les 60s = facture).
        // Le worker GPU est souvent absent en dev/preview ; ce n'est pas une
        // erreur applicative. On garde l'info en debug.
        let error_msg = last_error.unwrap_or_else(|| "Erreur inconnue".to_string());
        log::debug!(
            "[GpuService] Métriques GPU indisponibles ({} tentatives, endpoint={}): {} — fallback métriques locales",
            max_retries,
            endpoint,
            error_msg
        );

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
        let service_gpu_upgrade = Arc::new(self.clone());

        // Tâche de monitoring de scaling (toutes les 60s)
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                if let Err(e) = service_scaling.check_and_scale().await {
                    error!("[GpuService] Erreur scaling: {}", e);
                }
            }
        });

        // Tâche de vérification de budget (toutes les heures)
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(3600));
            loop {
                interval.tick().await;
                if let Err(e) = service_budget.check_budget().await {
                    error!("[GpuService] Erreur vérification budget: {}", e);
                }
            }
        });

        // ✅ NOUVEAU: Tâche de vérification GPU upgrade automatique (toutes les 30 min)
        // Vérifie si le worker a un GPU physique disponible et l'active automatiquement
        tokio::spawn(async move {
            // Attendre 2 min au démarrage pour laisser le temps au worker de s'initialiser
            tokio::time::sleep(Duration::from_secs(120)).await;
            let mut interval = tokio::time::interval(Duration::from_secs(1800));
            loop {
                interval.tick().await;
                service_gpu_upgrade.check_gpu_availability().await;
            }
        });

        info!("[GpuService] ✅ Monitoring démarré (scaling 60s, budget 1h, GPU upgrade 30min)");
    }

    /// ✅ NOUVEAU: Vérifie si le GPU worker a un GPU physique disponible
    /// Détecte automatiquement quand le quota GCP est validé et le GPU activé
    async fn check_gpu_availability(&self) {
        let endpoint = format!("{}/api/v1/metrics", self.config.gpu_endpoint);
        match self
            .http
            .get(&endpoint)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                match resp.json::<Value>().await {
                    Ok(json) => {
                        let gpu_available =
                            json.get("gpu_available").and_then(|v| v.as_bool()).unwrap_or(false);
                        let utilization =
                            json.get("utilization").and_then(|v| v.as_f64()).unwrap_or(0.0);

                        if gpu_available {
                            info!(
                                "[GpuService] ✅ GPU physique détecté sur le worker! Utilisation: {:.1}%",
                                utilization
                            );
                        } else {
                            info!(
                                "[GpuService] ℹ️ Worker actif en mode CPU (GPU physique non encore disponible - quota en attente)"
                            );
                        }

                        // Mettre à jour les métriques
                        let mut metrics = self.metrics.write().await;
                        metrics.current_utilization = utilization;
                        metrics.active_instances = 1;
                        metrics.last_updated = Utc::now().timestamp();
                    }
                    Err(e) => {
                        warn!("[GpuService] ⚠️ Erreur parsing métriques GPU: {}", e);
                    }
                }
            }
            Ok(resp) => {
                log::debug!("[GpuService] Worker GPU non prêt (HTTP {})", resp.status());
            }
            Err(e) => {
                // Passé en `debug!` — ce log était émis toutes les 60s et
                // engendrait des $ inutiles en Cloud Logging.
                log::debug!("[GpuService] Worker GPU injoignable: {}", e);
                // Mettre active_instances à 0 si le worker est down
                let mut metrics = self.metrics.write().await;
                metrics.active_instances = 0;
            }
        }
    }

    /// Récupère les métriques actuelles
    pub async fn get_metrics(&self) -> GpuMetrics {
        self.metrics.read().await.clone()
    }

    /// Récupère la configuration GPU
    pub fn get_config(&self) -> &GpuConfig {
        &self.config
    }

    /// ✅ NOUVEAU: Appel HTTP authentifié vers GCP API (utilise le metadata token de la VM Cloud Run)
    async fn gcp_authenticated_post(&self, url: &str) -> AppResult<()> {
        // En Cloud Run, obtenir un token d'accès via le metadata server
        let token = self.get_gcp_access_token().await?;

        let response = self
            .http
            .post(url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur appel GCP API: {}", e)))?;

        let status = response.status();
        if status.is_success() {
            Ok(())
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(AppError::Internal(format!(
                "GCP API erreur HTTP {}: {}",
                status, error_text
            )))
        }
    }

    /// Obtient un access token GCP via le metadata server (disponible dans Cloud Run)
    async fn get_gcp_access_token(&self) -> AppResult<String> {
        let metadata_url = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
        let response = self
            .http
            .get(metadata_url)
            .header("Metadata-Flavor", "Google")
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur metadata server GCP: {}", e)))?;

        let json: Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing token GCP: {}", e)))?;

        json.get("access_token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::Internal("Token GCP non trouvé dans la réponse".to_string()))
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
