use std::{sync::Arc, time::Instant};

use chrono::{DateTime, Utc};
use log::{info, warn};
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
        preview_monitoring::PreviewMonitoring,
        video_renderer::{RenderJobRequest, VideoRenderDispatcher},
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewTemplateMetrics {
    pub template: Option<String>,
    pub count: i64,
    pub avg_duration_seconds: f64,
    pub last_preview_at: Option<DateTime<Utc>>,
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
        let record = sqlx::query_as::<_, StudioSessionRecord>(
            r#"
            INSERT INTO studio_sessions (
                user_id,
                service_id,
                brief,
                metadata,
                timeline_settings,
                distribution_plan
            )
            VALUES ($1, $2, $3, $4, $5, $6)
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
        .await?;

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

        let summary = sqlx::query!(
            r#"
            SELECT COUNT(*)::bigint AS total_previews,
                   MAX(created_at) AS last_preview_at
            FROM studio_preview_events
            WHERE session_id = $1
            "#,
            session_id
        )
        .fetch_one(&self.pool)
        .await?;

        let templates = sqlx::query_as!(
            PreviewTemplateMetrics,
            r#"
            SELECT
                template,
                COUNT(*)::bigint AS "count!: i64",
                COALESCE(AVG(duration_seconds)::float, 0.0) AS "avg_duration_seconds!: f64",
                MAX(created_at) AS "last_preview_at?"
            FROM studio_preview_events
            WHERE session_id = $1
            GROUP BY template
            ORDER BY COUNT(*) DESC
            "#,
            session_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(StudioPreviewMetrics {
            total_previews: summary.total_previews.unwrap_or(0),
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

        for clip in &clips {
            if clip.duration_seconds <= 0 {
                return Err(AppError::BadRequest(
                    "La durée d'un clip doit être positive.".into(),
                ));
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

        let timeline_model = build_preview_timeline(&session.timeline)?;
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

        let timeline_model = build_preview_timeline(&short_clips)?;
        let request = RenderJobRequest {
            job_id: None,
            timeline: Arc::new(timeline_model.clone()),
        };

        let result = renderer.render(&request).await.map_err(|err| {
            warn!(
                "[StudioService] Échec génération preview courte session {}: {}",
                session_id, err.message
            );
            AppError::Internal(format!(
                "Impossible de générer l'aperçu court: {}",
                err.message
            ))
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

fn build_preview_timeline(clips: &[StudioTimelineClipRecord]) -> AppResult<ImmersiveTimeline> {
    let mut scenes: Vec<ImmersiveScene> = Vec::with_capacity(clips.len());

    for clip in clips {
        let scene = match serde_json::from_value::<ImmersiveScene>(clip.payload.clone()) {
            Ok(scene) => scene,
            Err(_) => {
                let template = clip
                    .lane
                    .as_deref()
                    .and_then(map_template_name)
                    .unwrap_or(ImmersiveTemplate::ProductShowcase);
                ImmersiveScene {
                    id: format!("clip-{}", clip.id),
                    template,
                    duration_in_frames: (clip.duration_seconds.max(1) as u32) * 30,
                    assets: ImmersiveSceneAssets::default(),
                    transition: ImmersiveSceneTransition::default(),
                    color_grade: None,
                }
            }
        };

        scenes.push(scene);
    }

    if scenes.is_empty() {
        return Err(AppError::BadRequest(
            "Timeline invalide pour l'aperçu.".into(),
        ));
    }

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
    pub async fn get_next_video(
        &self,
        session_id: Uuid,
    ) -> AppResult<NextVideoResponse> {
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
    pub async fn get_dependencies(
        &self,
        session_id: Uuid,
    ) -> AppResult<Vec<VideoDependency>> {
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
