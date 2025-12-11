// ✅ NOUVEAU Phase 2.3: Service de gestion des jobs d'export vidéo

use crate::models::export_model::{
    ExportJob, ExportProgress, ExportQuality, ExportResolution, ExportSettings, ExportStage,
    StartExportRequest,
};
use log::{error, info, warn};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

pub struct ExportService {
    pool: Arc<PgPool>,
    transcoding_service: Arc<crate::services::transcoding_service::TranscodingService>,
    media_storage: Arc<crate::services::media_storage_service::MediaStorageService>,
}

impl ExportService {
    pub fn new(
        pool: Arc<PgPool>,
        media_storage: Arc<crate::services::media_storage_service::MediaStorageService>,
    ) -> Self {
        Self {
            pool,
            transcoding_service: Arc::new(
                crate::services::transcoding_service::TranscodingService::new(),
            ),
            media_storage,
        }
    }

    /// Démarre un nouveau job d'export
    pub async fn start_export(
        &self,
        user_id: i64,
        request: StartExportRequest,
    ) -> Result<String, String> {
        let job_id = Uuid::new_v4().to_string();

        let _progress = ExportProgress {
            progress: 0.0,
            stage: ExportStage::Preparing,
            message: Some("Initialisation du job d'export".to_string()),
            estimated_time_remaining: None,
        };

        // TODO: Créer le job dans la base de données
        // Pour l'instant, on simule
        info!(
            "[ExportService] Nouveau job d'export créé: {} pour user {}",
            job_id, user_id
        );

        // Démarrer le traitement asynchrone
        let pool_clone = Arc::clone(&self.pool);
        let transcoding_clone = Arc::clone(&self.transcoding_service);
        let media_storage_clone = Arc::clone(&self.media_storage);
        let job_id_clone = job_id.clone();
        let timeline_id = request.timeline_id.clone();
        let settings = request.settings.clone();

        let _ = tokio::spawn(async move {
            if let Err(e) = Self::process_export(
                pool_clone,
                transcoding_clone,
                media_storage_clone,
                job_id_clone,
                user_id as i32,
                timeline_id,
                settings,
            )
            .await
            {
                error!("[ExportService] Erreur traitement export: {}", e);
            }
        });

        Ok(job_id)
    }

    /// Traite un job d'export de manière asynchrone
    async fn process_export(
        _pool: Arc<PgPool>,
        _transcoding_service: Arc<crate::services::transcoding_service::TranscodingService>,
        _media_storage: Arc<crate::services::media_storage_service::MediaStorageService>,
        job_id: String,
        _user_id: i32,
        _timeline_id: String,
        _settings: ExportSettings,
    ) -> Result<(), String> {
        info!("[ExportService] Début traitement export: {}", job_id);

        // TODO: Implémenter le pipeline complet:
        // 1. Récupérer la timeline depuis la DB
        // 2. Rendre la vidéo avec Remotion
        // 3. Transcoder selon les paramètres
        // 4. Upload vers S3/Wasabi via MediaStorageService (utilise S3_* ou AWS_* vars existantes)
        //    - Utilise les variables: S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT, etc.
        //    - Ou fallback: AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, etc.
        // 5. Mettre à jour le job dans la DB

        // Pour l'instant, on simule
        warn!(
            "[ExportService] Traitement export non encore implémenté complètement pour job: {}",
            job_id
        );

        Ok(())
    }

    /// Récupère le statut d'un job d'export
    pub async fn get_job_status(&self, job_id: &str, _user_id: i32) -> Result<ExportJob, String> {
        // TODO: Récupérer depuis la DB
        // Pour l'instant, on retourne une erreur
        Err(format!("Job {} non trouvé", job_id))
    }

    /// Annule un job d'export
    pub async fn cancel_job(&self, job_id: &str, _user_id: i32) -> Result<(), String> {
        // TODO: Marquer le job comme annulé dans la DB
        info!("[ExportService] Annulation job: {}", job_id);
        Ok(())
    }

    /// Liste les jobs d'export d'un utilisateur
    pub async fn list_jobs(
        &self,
        _user_id: i32,
        _page: Option<i64>,
        _limit: Option<i64>,
    ) -> Result<Vec<ExportJob>, String> {
        // TODO: Récupérer depuis la DB
        Ok(vec![])
    }

    /// ✅ NOUVEAU Phase 3: Export multi-format simultané
    /// Exporte la même vidéo dans plusieurs formats en parallèle
    pub async fn start_multi_format_export(
        &self,
        user_id: i64,
        timeline_id: String,
        formats: Vec<ExportSettings>,
    ) -> Result<Vec<String>, String> {
        info!(
            "[ExportService] Démarrage export multi-format: {} formats pour timeline {}",
            formats.len(),
            timeline_id
        );

        let mut job_ids = Vec::new();

        // Démarrer un job d'export pour chaque format
        for (index, settings) in formats.iter().enumerate() {
            let request = StartExportRequest {
                timeline_id: timeline_id.clone(),
                settings: settings.clone(),
            };

            match self.start_export(user_id, request).await {
                Ok(job_id) => {
                    info!(
                        "[ExportService] Job {} créé pour format {:?} ({}/{})",
                        job_id,
                        settings.format,
                        index + 1,
                        formats.len()
                    );
                    job_ids.push(job_id);
                }
                Err(e) => {
                    error!(
                        "[ExportService] Erreur création job pour format {:?}: {}",
                        settings.format, e
                    );
                    // Continuer avec les autres formats même si un échoue
                }
            }
        }

        if job_ids.is_empty() {
            return Err("Aucun job d'export n'a pu être créé".to_string());
        }

        Ok(job_ids)
    }

    /// ✅ NOUVEAU Phase 3: Export progressif (qualité adaptative)
    /// Exporte la vidéo en plusieurs qualités pour streaming adaptatif
    pub async fn start_progressive_export(
        &self,
        user_id: i64,
        timeline_id: String,
        base_settings: ExportSettings,
    ) -> Result<Vec<String>, String> {
        info!(
            "[ExportService] Démarrage export progressif pour timeline {}",
            timeline_id
        );

        // Créer plusieurs versions avec différentes qualités
        let mut formats = Vec::new();

        // Qualité basse (360p)
        let mut low_settings = base_settings.clone();
        low_settings.resolution = ExportResolution::P720;
        low_settings.quality = ExportQuality::Low;
        low_settings.bitrate = Some(500);
        formats.push(low_settings);

        // Qualité moyenne (720p)
        let mut medium_settings = base_settings.clone();
        medium_settings.resolution = ExportResolution::P720;
        medium_settings.quality = ExportQuality::Medium;
        medium_settings.bitrate = Some(2000);
        formats.push(medium_settings);

        // Qualité haute (1080p)
        let mut high_settings = base_settings.clone();
        high_settings.resolution = ExportResolution::P1080;
        high_settings.quality = ExportQuality::High;
        high_settings.bitrate = Some(5000);
        formats.push(high_settings);

        // Qualité ultra (4K si demandé)
        if matches!(
            base_settings.resolution,
            ExportResolution::K4 | ExportResolution::K8
        ) {
            let mut ultra_settings = base_settings.clone();
            ultra_settings.resolution = ExportResolution::K4;
            ultra_settings.quality = ExportQuality::Ultra;
            ultra_settings.bitrate = Some(15000);
            formats.push(ultra_settings);
        }

        self.start_multi_format_export(user_id, timeline_id, formats)
            .await
    }
}
