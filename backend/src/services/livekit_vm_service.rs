// ✅ Service de gestion automatique de la VM LiveKit (GCP Compute Engine)
// Démarre la VM quand une session live est créée/programmée,
// l'arrête quand plus aucune session n'est active.

use crate::core::types::{AppError, AppResult};
use log::{error, info, warn};
use sqlx::PgPool;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

#[derive(Debug, Clone)]
pub struct LivekitVmConfig {
    /// Zone GCP (ex: europe-west1-b)
    pub zone: String,
    /// Nom de l'instance VM LiveKit
    pub instance_name: String,
    /// Projet GCP
    pub gcp_project_id: String,
    /// Délai minimum avant arrêt après dernière session (secondes) — évite arrêt/démarrage en yo-yo
    pub scale_down_cooldown: u64,
    /// Intervalle de vérification du background task (secondes)
    pub check_interval: u64,
}

impl LivekitVmConfig {
    pub fn from_env() -> Option<Self> {
        let enabled = std::env::var("LIVEKIT_VM_AUTOSCALE")
            .unwrap_or_else(|_| "false".to_string())
            .parse::<bool>()
            .unwrap_or(false);

        if !enabled {
            return None;
        }

        let gcp_project_id = std::env::var("GCP_PROJECT_ID").ok()?;
        let instance_name = std::env::var("LIVEKIT_VM_INSTANCE_NAME")
            .unwrap_or_else(|_| "yukpo-livekit-server".to_string());
        let zone = std::env::var("GPU_ZONE") // réutilise la même zone
            .unwrap_or_else(|_| "europe-west1-b".to_string());
        let scale_down_cooldown = std::env::var("LIVEKIT_VM_COOLDOWN_SECS")
            .unwrap_or_else(|_| "600".to_string()) // 10 min après fin du dernier live
            .parse::<u64>()
            .unwrap_or(600);
        let check_interval = std::env::var("LIVEKIT_VM_CHECK_INTERVAL_SECS")
            .unwrap_or_else(|_| "120".to_string()) // vérification toutes les 2 min
            .parse::<u64>()
            .unwrap_or(120);

        Some(Self {
            zone,
            instance_name,
            gcp_project_id,
            scale_down_cooldown,
            check_interval,
        })
    }
}

pub struct LivekitVmService {
    config: Arc<LivekitVmConfig>,
    pool: Arc<PgPool>,
    http: reqwest::Client,
    /// Timestamp de la dernière fois qu'on a vu 0 session active
    last_idle_at: Arc<Mutex<Option<Instant>>>,
    /// État connu de la VM (pour éviter des appels API redondants)
    known_running: Arc<Mutex<bool>>,
}

impl Clone for LivekitVmService {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            pool: self.pool.clone(),
            http: self.http.clone(),
            last_idle_at: self.last_idle_at.clone(),
            known_running: self.known_running.clone(),
        }
    }
}

impl LivekitVmService {
    pub fn new(config: LivekitVmConfig, pool: Arc<PgPool>) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .expect("Création client HTTP LivekitVmService");

        info!(
            "[LivekitVmService] ✅ Initialisé - VM: {}, Zone: {}, Cooldown: {}s",
            config.instance_name, config.zone, config.scale_down_cooldown
        );

        Self {
            config: Arc::new(config),
            pool,
            http,
            last_idle_at: Arc::new(Mutex::new(None)),
            known_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Appelé dès qu'une session live est créée ou programmée.
    /// Démarre la VM immédiatement si elle est arrêtée — donne 60-90s de boot
    /// pendant que le partenaire configure son live.
    pub async fn ensure_running(&self) {
        let known = self.known_running.lock().await;
        if *known {
            info!("[LivekitVmService] VM déjà running, rien à faire");
            return;
        }
        drop(known);

        info!("[LivekitVmService] ⬆️ Session live détectée — démarrage VM LiveKit");
        match self.start_vm().await {
            Ok(()) => {
                *self.known_running.lock().await = true;
                // Réinitialiser le compteur d'inactivité
                *self.last_idle_at.lock().await = None;
            }
            Err(e) => {
                warn!("[LivekitVmService] ⚠️ Échec démarrage VM: {}", e);
            }
        }
    }

    /// Background task — vérifie toutes les N secondes le nombre de sessions
    /// actives ou programmées, et gère le cycle de vie de la VM.
    pub async fn start_monitoring(self: Arc<Self>) {
        let svc = self.clone();
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(Duration::from_secs(svc.config.check_interval));
            loop {
                interval.tick().await;
                if let Err(e) = svc.check_and_scale().await {
                    warn!("[LivekitVmService] Erreur check_and_scale: {}", e);
                }
            }
        });
        info!(
            "[LivekitVmService] 🔄 Monitoring démarré (intervalle: {}s)",
            self.config.check_interval
        );
    }

    /// Logique principale de scaling basée sur les sessions en DB.
    async fn check_and_scale(&self) -> AppResult<()> {
        let active_count = self.count_active_sessions().await?;
        let known = self.known_running.lock().await;

        if active_count > 0 {
            // Des sessions actives ou programmées — VM doit être up
            *self.last_idle_at.lock().await = None;
            if !*known {
                info!(
                    "[LivekitVmService] ⬆️ {} session(s) active(s) — démarrage VM",
                    active_count
                );
                drop(known);
                match self.start_vm().await {
                    Ok(()) => {
                        *self.known_running.lock().await = true;
                    }
                    Err(e) => {
                        error!("[LivekitVmService] Erreur démarrage: {}", e);
                    }
                }
            }
        } else {
            // Plus de sessions actives
            let mut idle = self.last_idle_at.lock().await;
            if idle.is_none() {
                *idle = Some(Instant::now());
                info!(
                    "[LivekitVmService] ℹ️ Aucune session active — début cooldown {}s",
                    self.config.scale_down_cooldown
                );
            } else if let Some(since) = *idle {
                let elapsed = since.elapsed().as_secs();
                if elapsed >= self.config.scale_down_cooldown && *known {
                    info!(
                        "[LivekitVmService] ⬇️ Cooldown écoulé ({}s) — arrêt VM LiveKit",
                        elapsed
                    );
                    drop(idle);
                    drop(known);
                    match self.stop_vm().await {
                        Ok(()) => {
                            *self.known_running.lock().await = false;
                        }
                        Err(e) => {
                            error!("[LivekitVmService] Erreur arrêt: {}", e);
                        }
                    }
                    return Ok(());
                }
            }
            drop(idle);
            drop(known);
        }

        Ok(())
    }

    /// Compte les sessions live actives OU programmées dans les 2 prochaines heures.
    async fn count_active_sessions(&self) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM live_sessions
            WHERE status IN ('active', 'scheduled')
              AND (
                status = 'active'
                OR (status = 'scheduled' AND start_at <= NOW() + INTERVAL '2 hours')
              )
            "#,
        )
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        Ok(count)
    }

    /// Démarre la VM via l'API GCP Compute Engine.
    async fn start_vm(&self) -> AppResult<()> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}/start",
            self.config.gcp_project_id, self.config.zone, self.config.instance_name
        );
        self.gcp_post(&url).await
    }

    /// Arrête la VM via l'API GCP Compute Engine.
    async fn stop_vm(&self) -> AppResult<()> {
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}/stop",
            self.config.gcp_project_id, self.config.zone, self.config.instance_name
        );
        self.gcp_post(&url).await
    }

    /// Appel HTTP authentifié vers l'API GCP (token via metadata server Cloud Run).
    async fn gcp_post(&self, url: &str) -> AppResult<()> {
        let token = self.get_access_token().await?;

        let resp = self
            .http
            .post(url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .body("{}")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur appel GCP API LiveKit: {}", e)))?;

        if resp.status().is_success() || resp.status().as_u16() == 200 {
            info!("[LivekitVmService] ✅ Appel GCP API réussi: {}", url);
            Ok(())
        } else {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            Err(AppError::Internal(format!(
                "GCP API LiveKit HTTP {}: {}",
                status, body
            )))
        }
    }

    /// Récupère un access token GCP via le metadata server (disponible dans Cloud Run).
    async fn get_access_token(&self) -> AppResult<String> {
        let url = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
        let resp = self
            .http
            .get(url)
            .header("Metadata-Flavor", "Google")
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur metadata server LiveKit: {}", e)))?;

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Parsing token LiveKit: {}", e)))?;

        json.get("access_token")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::Internal("Token GCP LiveKit absent".to_string()))
    }
}
