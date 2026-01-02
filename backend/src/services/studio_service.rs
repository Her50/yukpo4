use std::{sync::Arc, time::Instant};

use chrono::{DateTime, Utc};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    services::{
        immersive_timeline::{
            ImmersiveScene, ImmersiveSceneAssets, ImmersiveSceneTransition, ImmersiveTemplate,
            ImmersiveTimeline,
        },
        media_storage_service::MediaStorageService,
        preview_generation_service::{convert_immersive_to_video_timeline, generate_quick_preview, QuickPreviewRequest},
        preview_monitoring::PreviewMonitoring,
        video_renderer::{RenderError, RenderExecutionMode, RenderJobRequest, VideoRenderDispatcher},
    },
};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StudioSessionRecord {
    pub id: Uuid,
    pub user_id: i32,
    pub service_id: Option<i32>,
    pub status: String,
    pub brief: Value,
    pub ai_recommendations: Value,
    pub recommended_templates: Vec<String>,
    pub timeline_settings: Value,
    pub distribution_plan: Value,
    pub preview_status: String,
    pub preview_public_url: Option<String>,
    pub preview_job_id: Option<String>,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StudioPreviewEventRecord {
    pub id: i64,
    pub session_id: Uuid,
    pub template: Option<String>,
    pub clip_count: i32,
    pub duration_seconds: i32,
    pub status: String,
    pub preview_url: Option<String>,
    pub warnings: Value,
    pub job_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PreviewTemplateMetrics {
    pub template: Option<String>,
    pub count: i64,
    pub avg_duration_seconds: f64,
    pub last_preview_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow)]
struct PreviewSummaryRow {
    total_previews: i64,
    last_preview_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioPreviewMetrics {
    pub total_previews: i64,
    pub last_preview_at: Option<DateTime<Utc>>,
    pub templates: Vec<PreviewTemplateMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StudioTimelineClipRecord {
    pub id: i64,
    pub session_id: Uuid,
    pub position: i32,
    pub lane: Option<String>,
    pub duration_seconds: i32,
    pub payload: Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StudioDynamicAssetRecord {
    pub id: i64,
    pub session_id: Uuid,
    pub asset_type: String,
    pub storage_key: Option<String>,
    pub public_url: Option<String>,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StudioSessionAggregate {
    pub session: StudioSessionRecord,
    pub timeline: Vec<StudioTimelineClipRecord>,
    pub assets: Vec<StudioDynamicAssetRecord>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateStudioSessionPayload {
    #[serde(default)]
    pub service_id: Option<i32>,
    #[serde(default = "default_json_object")]
    pub brief: Value,
    #[serde(default = "default_json_object")]
    pub metadata: Value,
    #[serde(default = "default_json_object")]
    pub timeline_settings: Value,
    #[serde(default = "default_json_array")]
    pub distribution_plan: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateStudioSessionPayload {
    pub service_id: Option<i32>,
    pub status: Option<String>,
    pub brief: Option<Value>,
    pub ai_recommendations: Option<Value>,
    pub recommended_templates: Option<Vec<String>>,
    pub timeline_settings: Option<Value>,
    pub distribution_plan: Option<Value>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TimelineClipPayload {
    pub position: i32,
    #[serde(default)]
    pub lane: Option<String>,
    pub duration_seconds: i32,
    #[serde(default = "default_json_object")]
    pub payload: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AttachAssetPayload {
    pub asset_type: String,
    pub storage_key: Option<String>,
    pub public_url: Option<String>,
    #[serde(default = "default_json_object")]
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreviewResponse {
    pub session_id: Uuid,
    pub status: String,
    pub preview_url: Option<String>,
    pub warnings: Vec<String>,
    pub duration_seconds: u32,
    pub template: Option<String>,
    pub clip_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublishResponse {
    pub session_id: Uuid,
    pub status: String,
    pub published_at: DateTime<Utc>,
}

pub struct StudioService {
    pool: PgPool,
    _media_storage: Arc<MediaStorageService>,
    video_renderer: Option<Arc<VideoRenderDispatcher>>,
}

impl StudioService {
    /// ✅ NOUVEAU: Vérifier si le renderer vidéo est disponible
    pub fn is_renderer_available(&self) -> bool {
        self.video_renderer.is_some()
    }

    pub fn new(
        pool: PgPool,
        media_storage: Arc<MediaStorageService>,
        video_renderer: Option<Arc<VideoRenderDispatcher>>,
    ) -> Self {
        Self {
            pool,
            _media_storage: media_storage,
            video_renderer,
        }
    }

    pub async fn create_session(
        &self,
        user_id: i32,
        payload: CreateStudioSessionPayload,
    ) -> AppResult<StudioSessionAggregate> {
        log::info!(
            "[StudioService] create_session - user_id: {}, service_id: {:?}",
            user_id,
            payload.service_id
        );
        
        log::debug!(
            "[StudioService] create_session - Payload: brief: {:?}, metadata: {:?}, timeline_settings: {:?}, distribution_plan: {:?}",
            payload.brief,
            payload.metadata,
            payload.timeline_settings,
            payload.distribution_plan
        );
        
        let record = sqlx::query_as::<_, StudioSessionRecord>(
            r#"
            INSERT INTO studio_sessions (
                user_id,
                service_id,
                brief,
                metadata,
                timeline_settings,
                distribution_plan,
                status,
                preview_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'draft', 'pending')
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(payload.service_id)
        .bind(payload.brief)
        .bind(payload.metadata)
        .bind(payload.timeline_settings)
        .bind(payload.distribution_plan)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            log::error!(
                "[StudioService] ❌ Erreur SQL création session - user_id: {}, service_id: {:?}, erreur: {:?}",
                user_id,
                payload.service_id,
                e
            );
            AppError::Internal(format!("Erreur création session Studio: {}", e))
        })?;

        log::info!(
            "[StudioService] ✅ Session créée - id: {}, user_id: {}, service_id: {:?}",
            record.id,
            user_id,
            record.service_id
        );

        let timeline = Vec::new();
        let assets = Vec::new();
        Ok(StudioSessionAggregate {
            session: record,
            timeline,
            assets,
        })
    }

    pub async fn list_sessions_for_user(
        &self,
        user_id: i32,
    ) -> AppResult<Vec<StudioSessionRecord>> {
        let records = sqlx::query_as::<_, StudioSessionRecord>(
            r#"
            SELECT *
            FROM studio_sessions
            WHERE user_id = $1
            ORDER BY updated_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    pub async fn list_preview_events(
        &self,
        session_id: Uuid,
        user_id: i32,
    ) -> AppResult<Vec<StudioPreviewEventRecord>> {
        let session = self.fetch_session(session_id).await?;
        if session.user_id != user_id {
            return Err(AppError::Forbidden(
                "Cette session appartient à un autre utilisateur.".into(),
            ));
        }

        let events = sqlx::query_as::<_, StudioPreviewEventRecord>(
            r#"
            SELECT *
            FROM studio_preview_events
            WHERE session_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(events)
    }

    pub async fn preview_metrics(
        &self,
        session_id: Uuid,
        user_id: i32,
    ) -> AppResult<StudioPreviewMetrics> {
        let session = self.fetch_session(session_id).await?;
        if session.user_id != user_id {
            return Err(AppError::Forbidden(
                "Cette session appartient à un autre utilisateur.".into(),
            ));
        }

        let summary: PreviewSummaryRow = sqlx::query_as(
            r#"
            SELECT COUNT(*)::bigint AS total_previews,
                   MAX(created_at) AS last_preview_at
            FROM studio_preview_events
            WHERE session_id = $1
            "#,
        )
        .bind(session_id)
        .fetch_one(&self.pool)
        .await?;

        let templates: Vec<PreviewTemplateMetrics> = sqlx::query_as(
            r#"
            SELECT
                template,
                COUNT(*)::bigint AS count,
                COALESCE(AVG(duration_seconds)::float, 0.0) AS avg_duration_seconds,
                MAX(created_at) AS last_preview_at
            FROM studio_preview_events
            WHERE session_id = $1
            GROUP BY template
            ORDER BY COUNT(*) DESC
            "#,
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(StudioPreviewMetrics {
            total_previews: summary.total_previews,
            last_preview_at: summary.last_preview_at,
            templates,
        })
    }

    pub async fn get_session(
        &self,
        session_id: Uuid,
        user_id: i32,
    ) -> AppResult<StudioSessionAggregate> {
        let session = self.fetch_session(session_id).await?;
        if session.user_id != user_id {
            return Err(AppError::Forbidden(
                "Cette session appartient à un autre utilisateur.".into(),
            ));
        }

        let timeline = self.load_timeline(session_id).await?;
        let assets = self.load_assets(session_id).await?;

        Ok(StudioSessionAggregate {
            session,
            timeline,
            assets,
        })
    }

    pub async fn update_session(
        &self,
        session_id: Uuid,
        user_id: i32,
        payload: UpdateStudioSessionPayload,
    ) -> AppResult<StudioSessionAggregate> {
        let record = sqlx::query_as::<_, StudioSessionRecord>(
            r#"
            UPDATE studio_sessions
            SET
                service_id = COALESCE($3, service_id),
                status = COALESCE($4, status),
                brief = COALESCE($5, brief),
                ai_recommendations = COALESCE($6, ai_recommendations),
                recommended_templates = COALESCE($7, recommended_templates),
                timeline_settings = COALESCE($8, timeline_settings),
                distribution_plan = COALESCE($9, distribution_plan),
                metadata = COALESCE($10, metadata)
            WHERE id = $1 AND user_id = $2
            RETURNING *
            "#,
        )
        .bind(session_id)
        .bind(user_id)
        .bind(payload.service_id)
        .bind(payload.status)
        .bind(payload.brief)
        .bind(payload.ai_recommendations)
        .bind(payload.recommended_templates)
        .bind(payload.timeline_settings)
        .bind(payload.distribution_plan)
        .bind(payload.metadata)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Session introuvable ou accès refusé.".to_string()))?;

        let timeline = self.load_timeline(session_id).await?;
        let assets = self.load_assets(session_id).await?;

        Ok(StudioSessionAggregate {
            session: record,
            timeline,
            assets,
        })
    }

    pub async fn save_timeline(
        &self,
        session_id: Uuid,
        user_id: i32,
        clips: Vec<TimelineClipPayload>,
    ) -> AppResult<Vec<StudioTimelineClipRecord>> {
        if clips.is_empty() {
            return Err(AppError::BadRequest(
                "La timeline doit contenir au moins un clip.".into(),
            ));
        }

        // ✅ NOUVEAU: Validation que chaque clip a au moins un média
        for (idx, clip) in clips.iter().enumerate() {
            if clip.duration_seconds <= 0 {
                return Err(AppError::BadRequest(
                    format!("La durée du clip {} doit être positive.", idx + 1)
                ));
            }
            
            // ✅ VALIDATION: Vérifier que le clip a au moins un média dans son payload
            let has_media = if let Some(payload_obj) = clip.payload.as_object() {
                // Vérifier dans assets
                let assets_has_media = payload_obj.get("assets")
                    .and_then(|a| a.as_object())
                    .map(|a| {
                        a.get("videoUrl").or_else(|| a.get("video_url"))
                            .or_else(|| a.get("backgroundUrl")).or_else(|| a.get("background_url"))
                            .or_else(|| a.get("productImageUrl")).or_else(|| a.get("product_image_url"))
                            .and_then(|v| v.as_str())
                            .map(|s| !s.trim().is_empty())
                            .unwrap_or(false)
                    })
                    .unwrap_or(false);
                
                // Vérifier directement dans le payload (format alternatif)
                let direct_has_media = payload_obj.get("video_url").or_else(|| payload_obj.get("videoUrl"))
                    .or_else(|| payload_obj.get("background_url")).or_else(|| payload_obj.get("backgroundUrl"))
                    .or_else(|| payload_obj.get("product_image_url")).or_else(|| payload_obj.get("productImageUrl"))
                    .or_else(|| payload_obj.get("image_url")).or_else(|| payload_obj.get("imageUrl"))
                    .and_then(|v| v.as_str())
                    .map(|s| !s.trim().is_empty())
                    .unwrap_or(false);
                
                assets_has_media || direct_has_media
            } else {
                // Si le payload n'est pas un objet, essayer de parser comme ImmersiveScene
                if let Ok(scene) = serde_json::from_value::<ImmersiveScene>(clip.payload.clone()) {
                    scene.assets.video_url.is_some() 
                        || scene.assets.background_url.is_some() 
                        || scene.assets.product_image_url.is_some()
                } else {
                    false
                }
            };
            
            if !has_media {
                warn!(
                    "[StudioService] ⚠️ Clip {} (position {}) n'a pas de média valide dans son payload",
                    idx + 1, clip.position
                );
                // ✅ CORRIGÉ: Ne pas rejeter immédiatement, mais avertir
                // Le clip sera créé mais sans média, ce qui causera une erreur lors du preview
                // C'est mieux que de rejeter toute la timeline, mais on log l'avertissement
            }
        }

        let mut tx = self.pool.begin().await?;
        self.fetch_session_for_update(&mut tx, session_id, user_id)
            .await?;

        sqlx::query("DELETE FROM studio_timeline_clips WHERE session_id = $1")
            .bind(session_id)
            .execute(&mut *tx)
            .await?;

        for clip in clips {
            sqlx::query(
                r#"
                INSERT INTO studio_timeline_clips (
                    session_id,
                    position,
                    lane,
                    duration_seconds,
                    payload
                )
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(session_id)
            .bind(clip.position)
            .bind(clip.lane)
            .bind(clip.duration_seconds)
            .bind(clip.payload)
            .execute(&mut *tx)
            .await?;
        }

        let timeline = sqlx::query_as::<_, StudioTimelineClipRecord>(
            r#"
            SELECT *
            FROM studio_timeline_clips
            WHERE session_id = $1
            ORDER BY position ASC
            "#,
        )
        .bind(session_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(timeline)
    }

    pub async fn attach_dynamic_asset(
        &self,
        session_id: Uuid,
        user_id: i32,
        payload: AttachAssetPayload,
    ) -> AppResult<StudioDynamicAssetRecord> {
        let mut tx = self.pool.begin().await?;
        self.fetch_session_for_update(&mut tx, session_id, user_id)
            .await?;

        let record = sqlx::query_as::<_, StudioDynamicAssetRecord>(
            r#"
            INSERT INTO studio_dynamic_assets (
                session_id,
                asset_type,
                storage_key,
                public_url,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
        .bind(session_id)
        .bind(payload.asset_type)
        .bind(payload.storage_key)
        .bind(payload.public_url)
        .bind(payload.metadata)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(record)
    }

    pub async fn trigger_preview(
        &self,
        session_id: Uuid,
        user_id: i32,
    ) -> AppResult<PreviewResponse> {
        let preview_start = Instant::now();
        let renderer = self
            .video_renderer
            .clone()
            .ok_or_else(|| AppError::Internal("Renderer vidéo indisponible.".into()))?;

        let session = self.get_session(session_id, user_id).await?;
        if session.timeline.is_empty() {
            return Err(AppError::BadRequest(
                "Impossible de générer un aperçu sans timeline.".into(),
            ));
        }

        // ✅ CORRECTION RACINE: Charger les assets dynamiques pour enrichir les scènes sans médias
        let session_assets = self.load_assets(session_id).await.unwrap_or_default();
        let timeline_model = build_preview_timeline(&session.timeline, &session_assets)?;
        let request = RenderJobRequest {
            job_id: None,
            timeline: Arc::new(timeline_model.clone()),
        };

        let result = renderer.render(&request).await.map_err(|err| {
            warn!(
                "[StudioService] Échec génération preview session {}: {}",
                session_id, err.message
            );
            AppError::Internal(format!("Impossible de générer l'aperçu: {}", err.message))
        })?;

        let preview_url = result
            .public_url
            .clone()
            .or_else(|| result.storage_path.clone())
            .or_else(|| result.master_video.to_str().map(|s| s.to_string()));
        let duration_seconds =
            (timeline_model.total_frames() as f64 / timeline_model.fps as f64).ceil() as u32;
        let template_name = session
            .session
            .recommended_templates
            .first()
            .cloned()
            .or_else(|| session.timeline.first().and_then(|clip| clip.lane.clone()));
        let history_entry = json!({
            "at": Utc::now(),
            "template": template_name,
            "clipCount": session.timeline.len(),
            "durationSeconds": duration_seconds,
            "warnings": result.warnings,
        });
        let metadata_with_history =
            extend_preview_history(session.session.metadata.clone(), history_entry);

        info!(
            "[StudioService] Preview session={} template={:?} clips={} duration={}s",
            session_id,
            template_name.as_deref().unwrap_or("n/a"),
            session.timeline.len(),
            duration_seconds
        );

        sqlx::query(
            r#"
            UPDATE studio_sessions
            SET preview_status = $2,
                preview_public_url = $3,
                preview_job_id = $4,
                metadata = $5
            WHERE id = $1
            "#,
        )
        .bind(session_id)
        .bind("ready")
        .bind(preview_url.clone())
        .bind(Some(result.job_id.clone()))
        .bind(metadata_with_history)
        .execute(&self.pool)
        .await?;

        self.record_preview_event(
            session_id,
            template_name.clone(),
            session.timeline.len() as i32,
            duration_seconds as i32,
            preview_url.clone(),
            &result.warnings,
            Some(result.job_id.clone()),
        )
        .await?;

        let latency_ms = preview_start
            .elapsed()
            .as_millis()
            .min(u128::from(u64::MAX)) as u64;
        PreviewMonitoring::record_request(template_name.as_deref(), latency_ms, &result.warnings);

        Ok(PreviewResponse {
            session_id,
            status: "ready".into(),
            preview_url,
            warnings: result.warnings,
            duration_seconds,
            template: template_name,
            clip_count: session.timeline.len(),
        })
    }

    pub async fn trigger_short_preview(
        &self,
        session_id: Uuid,
        user_id: i32,
    ) -> AppResult<PreviewResponse> {
        let preview_start = Instant::now();
        
        // ✅ CORRIGÉ: Gérer gracieusement l'absence du renderer avec message détaillé
        let renderer = match self.video_renderer.clone() {
            Some(r) => r,
            None => {
                error!(
                    "[StudioService] ❌ Renderer vidéo indisponible pour session {} - Configuration manquante ou désactivée",
                    session_id
                );
                // ✅ AMÉLIORÉ: Message d'erreur plus détaillé pour aider au diagnostic
                return Err(AppError::BadRequest(
                    "Le service de prévisualisation vidéo n'est pas configuré. Vérifiez que VIDEO_RENDERER_PROJECT_ROOT existe et que VIDEO_RENDERER_ENABLED=true, ou configurez VIDEO_RENDERER_RPC_URL pour utiliser un renderer distant.".into()
                ));
            }
        };

        let session = self.get_session(session_id, user_id).await?;
        if session.timeline.is_empty() {
            log::warn!(
                "[StudioService] ⚠️ Timeline vide pour session {} - user_id: {}",
                session_id, user_id
            );
            return Err(AppError::BadRequest(
                "Impossible de générer un aperçu sans timeline. Veuillez d'abord sauvegarder une timeline avec des clips en utilisant POST /api/studio/sessions/{session_id}/timeline.".into(),
            ));
        }

        // Ne garder que les premiers clips pour un aperçu court (max ~5s)
        let mut accumulated = 0;
        let mut short_clips: Vec<StudioTimelineClipRecord> = Vec::new();
        for clip in &session.timeline {
            if accumulated >= 5 {
                break;
            }
            short_clips.push(clip.clone());
            accumulated += clip.duration_seconds.max(1);
            if accumulated >= 5 {
                break;
            }
        }

        // ✅ CORRECTION RACINE: Charger les assets dynamiques pour enrichir les scènes sans médias
        let session_assets = self.load_assets(session_id).await.unwrap_or_default();
        let timeline_model = build_preview_timeline(&short_clips, &session_assets)?;
        let request = RenderJobRequest {
            job_id: None,
            timeline: Arc::new(timeline_model.clone()),
        };

        // ✅ NOUVEAU: Essayer le renderer Remotion, avec fallback vers quick preview si échec non-retryable
        let result = match renderer.render(&request).await {
            Ok(r) => Ok(r),
            Err(err) => {
                error!(
                    "[StudioService] ❌ Échec génération preview Remotion session {}: {} (mode={:?}, retryable={})",
                    session_id, err.message, err.mode, err.retryable
                );
                
                // Si l'erreur est non-retryable (ex: renderer non compilé), utiliser quick preview comme fallback
                if !err.retryable && (err.message.contains("non compilé") || err.message.contains("npm") || err.message.contains("dist/src/index.js")) {
                    warn!(
                        "[StudioService] ⚠️ Renderer Remotion indisponible, utilisation du quick preview comme fallback pour session {}",
                        session_id
                    );
                    
                    // ✅ NOTE: L'enrichissement avec les assets dynamiques est déjà fait dans build_preview_timeline
                    // Convertir ImmersiveTimeline en VideoTimeline
                    let video_timeline = convert_immersive_to_video_timeline(&timeline_model);
                    
                    // Utiliser le quick preview avec le pool de base de données
                    let quick_preview_request = QuickPreviewRequest {
                        timeline: video_timeline,
                        quality: Some("low".to_string()),
                        max_duration: Some(5.0), // Max 5 secondes pour preview court
                    };
                    
                    match generate_quick_preview(quick_preview_request, Some(&self.pool)).await {
                        Ok(quick_result) => {
                            info!(
                                "[StudioService] ✅ Quick preview généré avec succès (fallback) pour session {}",
                                session_id
                            );
                            
                            // Convertir QuickPreviewResponse en RenderJobResponse
                            let preview_path = std::path::PathBuf::from(&quick_result.preview_url);
                            Ok(crate::services::video_renderer::RenderJobResponse {
                                job_id: Uuid::new_v4().to_string(),
                                mode: crate::services::video_renderer::RenderExecutionMode::Offline,
                                master_video: preview_path.clone(),
                                timeline_json: preview_path.clone(),
                                output_dir: preview_path.parent().unwrap_or(&std::path::PathBuf::from(".")).to_path_buf(),
                                warnings: vec![format!(
                                    "Preview généré avec quick preview (fallback) - qualité: {}",
                                    quick_result.quality
                                )],
                                storage_key: None,
                                storage_path: quick_result.thumbnail_url,
                                public_url: Some(quick_result.preview_url),
                                content_length: None,
                                timeline_storage_key: None,
                                timeline_storage_path: None,
                                timeline_public_url: None,
                                timeline_content_length: None,
                            })
                        }
                        Err(quick_err) => {
                            error!(
                                "[StudioService] ❌ Échec quick preview (fallback) pour session {}: {:?}",
                                session_id, quick_err
                            );
                            // Retourner l'erreur originale du renderer Remotion
                            Err(RenderError::new(
                                err.mode,
                                format!("Échec renderer Remotion et fallback quick preview: {} | Quick preview error: {}", err.message, quick_err),
                                false,
                            ))
                        }
                    }
                } else {
                    // Erreur retryable ou autre, retourner l'erreur telle quelle
                    let error_message = match err.mode {
                        RenderExecutionMode::Offline => {
                            if err.message.contains("npm") || err.message.contains("No such file") {
                                format!(
                                    "Le service de rendu vidéo local n'est pas configuré correctement. {} Configurez VIDEO_RENDERER_RPC_URL pour utiliser un renderer distant, ou précompilez le worker Remotion avant le déploiement.",
                                    err.message
                                )
                            } else {
                                format!("Erreur lors du rendu vidéo local: {}", err.message)
                            }
                        }
                        RenderExecutionMode::GpuRpc => {
                            format!("Erreur lors du rendu vidéo distant: {}", err.message)
                        }
                    };

                    Err(RenderError::new(
                        err.mode,
                        error_message,
                        err.retryable,
                    ))
                }
            }
        }.map_err(|err: RenderError| {
            // Convertir RenderError en AppError
            if err.retryable {
                AppError::BadRequest(format!(
                    "Erreur temporaire lors de la génération de l'aperçu: {}. Veuillez réessayer dans quelques instants.",
                    err.message
                ))
            } else {
                AppError::Internal(err.message)
            }
        })?;

        let preview_url = result
            .public_url
            .clone()
            .or_else(|| result.storage_path.clone())
            .or_else(|| result.master_video.to_str().map(|s| s.to_string()));
        let duration_seconds =
            (timeline_model.total_frames() as f64 / timeline_model.fps as f64).ceil() as u32;
        let template_name = session
            .session
            .recommended_templates
            .first()
            .cloned()
            .or_else(|| short_clips.first().and_then(|clip| clip.lane.clone()));

        info!(
            "[StudioService] Short preview session={} template={:?} clips={} duration={}s",
            session_id,
            template_name.as_deref().unwrap_or("n/a"),
            short_clips.len(),
            duration_seconds
        );

        let latency_ms = preview_start
            .elapsed()
            .as_millis()
            .min(u128::from(u64::MAX)) as u64;
        PreviewMonitoring::record_request(template_name.as_deref(), latency_ms, &result.warnings);

        Ok(PreviewResponse {
            session_id,
            status: "ready".into(),
            preview_url,
            warnings: result.warnings,
            duration_seconds,
            template: template_name,
            clip_count: short_clips.len(),
        })
    }

    pub async fn publish_session(
        &self,
        session_id: Uuid,
        user_id: i32,
    ) -> AppResult<PublishResponse> {
        let now = Utc::now();
        let record = sqlx::query_as::<_, StudioSessionRecord>(
            r#"
            UPDATE studio_sessions
            SET status = 'published',
                metadata = jsonb_set(metadata, '{publishedAt}', to_jsonb($3::timestamptz), true)
            WHERE id = $1 AND user_id = $2
            RETURNING *
            "#,
        )
        .bind(session_id)
        .bind(user_id)
        .bind(now)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Session introuvable ou accès refusé.".to_string()))?;

        Ok(PublishResponse {
            session_id: record.id,
            status: record.status,
            published_at: now,
        })
    }

    async fn fetch_session(&self, session_id: Uuid) -> AppResult<StudioSessionRecord> {
        sqlx::query_as::<_, StudioSessionRecord>("SELECT * FROM studio_sessions WHERE id = $1")
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| AppError::NotFound("Session introuvable.".into()))
    }

    async fn load_timeline(&self, session_id: Uuid) -> AppResult<Vec<StudioTimelineClipRecord>> {
        let timeline = sqlx::query_as::<_, StudioTimelineClipRecord>(
            r#"
            SELECT *
            FROM studio_timeline_clips
            WHERE session_id = $1
            ORDER BY position ASC
            "#,
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(timeline)
    }

    async fn load_assets(&self, session_id: Uuid) -> AppResult<Vec<StudioDynamicAssetRecord>> {
        let assets = sqlx::query_as::<_, StudioDynamicAssetRecord>(
            r#"
            SELECT *
            FROM studio_dynamic_assets
            WHERE session_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(assets)
    }

    async fn fetch_session_for_update<'a>(
        &self,
        executor: &mut Transaction<'a, Postgres>,
        session_id: Uuid,
        user_id: i32,
    ) -> AppResult<StudioSessionRecord> {
        let record = sqlx::query_as::<_, StudioSessionRecord>(
            "SELECT * FROM studio_sessions WHERE id = $1 FOR UPDATE",
        )
        .bind(session_id)
        .fetch_optional(&mut **executor)
        .await?
        .ok_or_else(|| AppError::NotFound("Session introuvable.".into()))?;

        if record.user_id != user_id {
            return Err(AppError::Forbidden(
                "Cette session appartient à un autre utilisateur.".into(),
            ));
        }

        Ok(record)
    }
}

/// ✅ AMÉLIORÉ: Construit une timeline avec fallback vers assets dynamiques si les clips n'ont pas de médias
fn build_preview_timeline(clips: &[StudioTimelineClipRecord], session_assets: &[StudioDynamicAssetRecord]) -> AppResult<ImmersiveTimeline> {
    let mut scenes: Vec<ImmersiveScene> = Vec::with_capacity(clips.len());
    let mut asset_index = 0;

    for clip in clips {
        let mut scene = match serde_json::from_value::<ImmersiveScene>(clip.payload.clone()) {
            Ok(scene) => scene,
            Err(parse_err) => {
                // ✅ CORRIGÉ: Si le parsing complet échoue, essayer d'extraire les assets depuis le payload
                warn!(
                    "[build_preview_timeline] ⚠️ Parsing ImmersiveScene échoué pour clip {}: {}. Tentative d'extraction partielle des assets.",
                    clip.id, parse_err
                );
                
                let template = clip
                    .lane
                    .as_deref()
                    .and_then(map_template_name)
                    .unwrap_or(ImmersiveTemplate::ProductShowcase);
                
                // ✅ NOUVEAU: Extraire les assets depuis le payload même si le parsing complet échoue
                let mut assets = ImmersiveSceneAssets::default();
                
                if let Some(payload_obj) = clip.payload.as_object() {
                    // Chercher les assets dans le payload
                    if let Some(assets_value) = payload_obj.get("assets") {
                        if let Ok(extracted_assets) = serde_json::from_value::<ImmersiveSceneAssets>(assets_value.clone()) {
                            assets = extracted_assets;
                            info!(
                                "[build_preview_timeline] ✅ Assets extraits depuis payload pour clip {}",
                                clip.id
                            );
                        } else {
                            // Essayer d'extraire les champs individuellement
                            if let Some(assets_obj) = assets_value.as_object() {
                                assets.video_url = assets_obj.get("videoUrl")
                                    .or_else(|| assets_obj.get("video_url"))
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string())
                                    .filter(|s| !s.trim().is_empty());
                                
                                assets.background_url = assets_obj.get("backgroundUrl")
                                    .or_else(|| assets_obj.get("background_url"))
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string())
                                    .filter(|s| !s.trim().is_empty());
                                
                                assets.product_image_url = assets_obj.get("productImageUrl")
                                    .or_else(|| assets_obj.get("product_image_url"))
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string())
                                    .filter(|s| !s.trim().is_empty());
                                
                                if assets.video_url.is_some() || assets.background_url.is_some() || assets.product_image_url.is_some() {
                                    info!(
                                        "[build_preview_timeline] ✅ Médias extraits partiellement depuis payload pour clip {}",
                                        clip.id
                                    );
                                } else {
                                    warn!(
                                        "[build_preview_timeline] ⚠️ Aucun média trouvé dans assets pour clip {}",
                                        clip.id
                                    );
                                }
                            }
                        }
                    }
                    
                    // ✅ NOUVEAU: Chercher aussi directement dans le payload (format alternatif)
                    if assets.video_url.is_none() && assets.background_url.is_none() && assets.product_image_url.is_none() {
                        assets.video_url = payload_obj.get("video_url")
                            .or_else(|| payload_obj.get("videoUrl"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .filter(|s| !s.trim().is_empty());
                        
                        assets.background_url = payload_obj.get("background_url")
                            .or_else(|| payload_obj.get("backgroundUrl"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .filter(|s| !s.trim().is_empty());
                        
                        assets.product_image_url = payload_obj.get("product_image_url")
                            .or_else(|| payload_obj.get("productImageUrl"))
                            .or_else(|| payload_obj.get("image_url"))
                            .or_else(|| payload_obj.get("imageUrl"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .filter(|s| !s.trim().is_empty());
                        
                        // ✅ CORRECTION RACINE: Extraire media_url du payload (format utilisé par la génération IA)
                        if assets.video_url.is_none() && assets.background_url.is_none() && assets.product_image_url.is_none() {
                            if let Some(media_url_str) = payload_obj.get("media_url")
                                .or_else(|| payload_obj.get("mediaUrl"))
                                .and_then(|v| v.as_str())
                                .filter(|s| !s.trim().is_empty()) {
                                let media_url = media_url_str.to_string();
                                
                                // Déterminer si c'est une vidéo ou une image selon l'URL
                                let is_video = media_url.contains(".mp4") 
                                    || media_url.contains(".mov") 
                                    || media_url.contains(".webm") 
                                    || media_url.contains("video")
                                    || media_url.contains("/video/");
                                
                                if is_video {
                                    assets.video_url = Some(media_url);
                                    info!(
                                        "[build_preview_timeline] ✅ media_url détecté comme vidéo et assigné à video_url pour clip {}",
                                        clip.id
                                    );
                                } else {
                                    // Par défaut, utiliser comme product_image_url (priorité sur background_url pour les produits)
                                    assets.product_image_url = Some(media_url);
                                    info!(
                                        "[build_preview_timeline] ✅ media_url détecté comme image et assigné à product_image_url pour clip {}",
                                        clip.id
                                    );
                                }
                            }
                        }
                    }
                }
                
                ImmersiveScene {
                    id: format!("clip-{}", clip.id),
                    template,
                    duration_in_frames: (clip.duration_seconds.max(1) as u32) * 30,
                    assets,
                    transition: ImmersiveSceneTransition::default(),
                    color_grade: None,
                }
            }
        };

        // ✅ CORRECTION RACINE: Si la scène n'a pas de médias, essayer d'extraire media_url du payload
        if scene.assets.video_url.is_none() 
            && scene.assets.background_url.is_none() 
            && scene.assets.product_image_url.is_none() {
            if let Some(payload_obj) = clip.payload.as_object() {
                // Debug: log le payload pour voir ce qu'il contient
                log::debug!(
                    "[build_preview_timeline] 🔍 Scène {} sans médias, payload keys: {:?}",
                    scene.id,
                    payload_obj.keys().collect::<Vec<_>>()
                );
                
                if let Some(media_url_str) = payload_obj.get("media_url")
                    .or_else(|| payload_obj.get("mediaUrl"))
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.trim().is_empty()) {
                    let media_url = media_url_str.to_string();
                    
                    // Déterminer si c'est une vidéo ou une image selon l'URL
                    let is_video = media_url.contains(".mp4") 
                        || media_url.contains(".mov") 
                        || media_url.contains(".webm") 
                        || media_url.contains("video")
                        || media_url.contains("/video/");
                    
                    if is_video {
                        scene.assets.video_url = Some(media_url.clone());
                        info!(
                            "[build_preview_timeline] ✅ media_url extrait du payload et assigné à video_url pour scène {}: {}",
                            scene.id, media_url
                        );
                    } else {
                        scene.assets.product_image_url = Some(media_url.clone());
                        info!(
                            "[build_preview_timeline] ✅ media_url extrait du payload et assigné à product_image_url pour scène {}: {}",
                            scene.id, media_url
                        );
                    }
                } else {
                    warn!(
                        "[build_preview_timeline] ⚠️ Scène {} sans médias et media_url non trouvé dans payload. Payload: {}",
                        scene.id,
                        serde_json::to_string(payload_obj).unwrap_or_else(|_| "{}".to_string())
                    );
                }
            } else {
                warn!(
                    "[build_preview_timeline] ⚠️ Scène {} sans médias et payload n'est pas un objet. Payload: {}",
                    scene.id,
                    clip.payload
                );
            }
        }

        // ✅ CORRECTION RACINE: Enrichir avec les assets dynamiques si la scène n'a toujours pas de médias
        if scene.assets.video_url.is_none() 
            && scene.assets.background_url.is_none() 
            && scene.assets.product_image_url.is_none() 
            && !session_assets.is_empty() {
            if let Some(asset) = session_assets.get(asset_index) {
                // Utiliser public_url ou storage_key selon disponibilité
                if let Some(url) = asset.public_url.as_ref() {
                    if !url.trim().is_empty() {
                        scene.assets.background_url = Some(url.clone());
                        info!(
                            "[build_preview_timeline] ✅ Asset dynamique {} utilisé comme fallback pour scène {}",
                            asset.id, scene.id
                        );
                        asset_index = (asset_index + 1) % session_assets.len();
                    }
                } else if let Some(storage_key) = asset.storage_key.as_ref() {
                    // Construire l'URL depuis storage_key
                    let api_base_url = std::env::var("API_BASE_URL")
                        .unwrap_or_else(|_| std::env::var("UPLOAD_BASE_URL")
                            .unwrap_or_else(|_| "http://localhost:3000".to_string()));
                    let media_url = format!("{}/api/media/files/{}", api_base_url.trim_end_matches('/'), storage_key.trim_start_matches('/'));
                    scene.assets.background_url = Some(media_url);
                    info!(
                        "[build_preview_timeline] ✅ Asset dynamique {} (storage_key) utilisé comme fallback pour scène {}",
                        asset.id, scene.id
                    );
                    asset_index = (asset_index + 1) % session_assets.len();
                }
            }
        }

        scenes.push(scene);
    }

    if scenes.is_empty() {
        return Err(AppError::BadRequest(
            "Timeline invalide pour l'aperçu.".into(),
        ));
    }

    // ✅ NOUVEAU: Validation finale - vérifier qu'au moins une scène a un média
    let scenes_with_media: Vec<_> = scenes.iter()
        .filter(|scene| {
            scene.assets.video_url.is_some() 
                || scene.assets.background_url.is_some() 
                || scene.assets.product_image_url.is_some()
        })
        .collect();
    
    if scenes_with_media.is_empty() {
        let scene_details: Vec<String> = scenes.iter()
            .enumerate()
            .map(|(idx, scene)| {
                format!(
                    "Scène {} (id: {}): video_url={:?}, background_url={:?}, product_image_url={:?}",
                    idx,
                    scene.id,
                    scene.assets.video_url,
                    scene.assets.background_url,
                    scene.assets.product_image_url
                )
            })
            .collect();
        
        error!(
            "[build_preview_timeline] ❌ Aucune scène n'a de média valide. Détails: {}",
            scene_details.join(" | ")
        );
        
        // ✅ AMÉLIORÉ: Message d'erreur plus clair avec instructions
        let error_message = if scenes.len() == 1 {
            format!(
                "Aucun média n'a été ajouté à votre vidéo. Veuillez d'abord ajouter au moins une image ou une vidéo depuis la médiathèque produit avant de générer le preview. Scène actuelle: {}",
                scenes[0].id
            )
        } else {
            format!(
                "Aucune des {} scènes de votre timeline ne contient de média valide (vidéo, image ou arrière-plan). Veuillez d'abord ajouter des médias aux scènes depuis la médiathèque produit avant de générer le preview.",
                scenes.len()
            )
        };
        
        return Err(AppError::BadRequest(error_message));
    }
    
    info!(
        "[build_preview_timeline] ✅ Timeline construite: {} scènes totales, {} scènes avec médias",
        scenes.len(),
        scenes_with_media.len()
    );

    Ok(ImmersiveTimeline {
        fps: 30,
        width: 1080,
        height: 1920,
        audio_cue_map: None,
        scenes,
    })
}

fn map_template_name(name: &str) -> Option<ImmersiveTemplate> {
    match name.to_lowercase().as_str() {
        "blog" => Some(ImmersiveTemplate::IntroPulse),
        "tutorial" | "tutoriel" => Some(ImmersiveTemplate::ProductShowcase),
        "testimonial" | "témoignage" => Some(ImmersiveTemplate::GlowCTA),
        "comparison" | "comparatif" => Some(ImmersiveTemplate::ARHighlight),
        "cta" => Some(ImmersiveTemplate::GlowCTA),
        _ => None,
    }
}

fn default_json_object() -> Value {
    json!({})
}

fn default_json_array() -> Value {
    json!([])
}

impl StudioService {
    /// Convertit ImmersiveTimeline en Vec<TimelineClipPayload> pour sauvegarde
    pub fn convert_immersive_timeline_to_clips(
        &self,
        timeline: &ImmersiveTimeline,
    ) -> AppResult<Vec<TimelineClipPayload>> {
        fn template_name(template: &ImmersiveTemplate) -> &'static str {
            match template {
                ImmersiveTemplate::IntroPulse => "IntroPulse",
                ImmersiveTemplate::ProductShowcase => "ProductShowcase",
                ImmersiveTemplate::ARHighlight => "ARHighlight",
                ImmersiveTemplate::GlowCTA => "GlowCTA",
            }
        }
        
        let fps = timeline.fps;
        let mut clips = Vec::new();
        
        for (idx, scene) in timeline.scenes.iter().enumerate() {
            let duration_seconds = (scene.duration_in_frames as f64 / fps as f64).ceil() as i32;
            
            // Sérialiser la scène en JSON pour le payload
            let payload = serde_json::to_value(scene).map_err(|e| {
                AppError::Internal(format!("Erreur sérialisation scène: {}", e))
            })?;
            
            let lane = Some(template_name(&scene.template).to_string());
            
            clips.push(TimelineClipPayload {
                position: idx as i32,
                lane,
                duration_seconds,
                payload,
            });
        }
        
        Ok(clips)
    }

    async fn record_preview_event(
        &self,
        session_id: Uuid,
        template: Option<String>,
        clip_count: i32,
        duration_seconds: i32,
        preview_url: Option<String>,
        warnings: &[String],
        job_id: Option<String>,
    ) -> AppResult<StudioPreviewEventRecord> {
        let warnings_value = json!(warnings);
        let record = sqlx::query_as::<_, StudioPreviewEventRecord>(
            r#"
            INSERT INTO studio_preview_events (
                session_id,
                template,
                clip_count,
                duration_seconds,
                status,
                preview_url,
                warnings,
                job_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(session_id)
        .bind(template)
        .bind(clip_count)
        .bind(duration_seconds)
        .bind("ready")
        .bind(preview_url)
        .bind(warnings_value)
        .bind(job_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }
}

fn extend_preview_history(metadata: Value, entry: Value) -> Value {
    match metadata {
        Value::Object(mut map) => {
            let mut history = map
                .remove("previewHistory")
                .and_then(|value| value.as_array().cloned())
                .unwrap_or_default();
            history.push(entry);
            map.insert("previewHistory".to_string(), Value::Array(history));
            Value::Object(map)
        }
        _ => {
            let mut map = serde_json::Map::new();
            map.insert("previewHistory".to_string(), Value::Array(vec![entry]));
            Value::Object(map)
        }
    }
}

// ✅ Phase 9 - Amélioration 31 : Structures pour chaînage vidéos
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct VideoDependency {
    pub id: i32,
    pub parent_session_id: Uuid,
    pub child_session_id: Uuid,
    pub order_index: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetDependenciesPayload {
    pub child_session_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NextVideoResponse {
    pub next_session_id: Option<Uuid>,
    pub order_index: Option<i32>,
}

impl StudioService {
    /// ✅ Phase 9 - Amélioration 31 : Définir les dépendances (vidéos suivantes) pour une session
    pub async fn set_dependencies(
        &self,
        parent_session_id: Uuid,
        user_id: i32,
        payload: SetDependenciesPayload,
    ) -> AppResult<Vec<VideoDependency>> {
        // Vérifier que la session parent appartient à l'utilisateur
        let parent = sqlx::query_as::<_, StudioSessionRecord>(
            "SELECT * FROM studio_sessions WHERE id = $1 AND user_id = $2",
        )
        .bind(parent_session_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if parent.is_none() {
            return Err(AppError::NotFound("Session parent introuvable".to_string()));
        }

        // Vérifier que toutes les sessions enfants appartiennent à l'utilisateur
        for child_id in &payload.child_session_ids {
            let child = sqlx::query_as::<_, StudioSessionRecord>(
                "SELECT * FROM studio_sessions WHERE id = $1 AND user_id = $2",
            )
            .bind(child_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?;

            if child.is_none() {
                return Err(AppError::BadRequest(format!(
                    "Session enfant {} introuvable",
                    child_id
                )));
            }

            // Empêcher les références circulaires
            if *child_id == parent_session_id {
                return Err(AppError::BadRequest(
                    "Une session ne peut pas dépendre d'elle-même".to_string(),
                ));
            }
        }

        // Supprimer les anciennes dépendances
        sqlx::query("DELETE FROM video_dependencies WHERE parent_session_id = $1")
            .bind(parent_session_id)
            .execute(&self.pool)
            .await?;

        // Insérer les nouvelles dépendances avec order_index
        let mut dependencies = Vec::new();
        for (index, child_id) in payload.child_session_ids.iter().enumerate() {
            let dep = sqlx::query_as::<_, VideoDependency>(
                r#"
                INSERT INTO video_dependencies (parent_session_id, child_session_id, order_index)
                VALUES ($1, $2, $3)
                RETURNING id, parent_session_id, child_session_id, order_index, created_at
                "#,
            )
            .bind(parent_session_id)
            .bind(child_id)
            .bind(index as i32)
            .fetch_one(&self.pool)
            .await?;
            dependencies.push(dep);
        }

        Ok(dependencies)
    }

    /// ✅ Phase 9 - Amélioration 31 : Récupérer la vidéo suivante dans la chaîne
    pub async fn get_next_video(&self, session_id: Uuid) -> AppResult<NextVideoResponse> {
        let next = sqlx::query_as::<_, (Option<Uuid>, Option<i32>)>(
            r#"
            SELECT child_session_id, order_index
            FROM video_dependencies
            WHERE parent_session_id = $1
            ORDER BY order_index ASC
            LIMIT 1
            "#,
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some((next_id, order)) = next {
            Ok(NextVideoResponse {
                next_session_id: next_id,
                order_index: order,
            })
        } else {
            Ok(NextVideoResponse {
                next_session_id: None,
                order_index: None,
            })
        }
    }

    /// ✅ Phase 9 - Amélioration 31 : Récupérer toutes les dépendances d'une session
    pub async fn get_dependencies(&self, session_id: Uuid) -> AppResult<Vec<VideoDependency>> {
        let deps = sqlx::query_as::<_, VideoDependency>(
            r#"
            SELECT id, parent_session_id, child_session_id, order_index, created_at
            FROM video_dependencies
            WHERE parent_session_id = $1
            ORDER BY order_index ASC
            "#,
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(deps)
    }
}
