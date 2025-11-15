use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    core::types::AppResult,
    middlewares::jwt::AuthenticatedUser,
    services::{
        immersive_orchestrator::{ImmersiveOrchestrator, TimelineBusinessContext, TimelineRequest},
        story_template_service::StoryTemplateSpec,
        studio_service::{
            AttachAssetPayload, CreateStudioSessionPayload, PreviewResponse, PublishResponse,
            StudioDynamicAssetRecord, StudioPreviewEventRecord, StudioPreviewMetrics,
            StudioSessionAggregate, StudioSessionRecord, StudioTimelineClipRecord,
            TimelineClipPayload, UpdateStudioSessionPayload,
        },
    },
    state::AppState,
};

pub async fn create_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateStudioSessionPayload>,
) -> AppResult<Json<StudioSessionAggregate>> {
    let session = state
        .studio_service
        .create_session(user.id, payload)
        .await?;
    Ok(Json(session))
}

pub async fn list_sessions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Vec<StudioSessionRecord>>> {
    let list = state.studio_service.list_sessions_for_user(user.id).await?;
    Ok(Json(list))
}

pub async fn get_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
) -> AppResult<Json<StudioSessionAggregate>> {
    let session = state
        .studio_service
        .get_session(session_id, user.id)
        .await?;
    Ok(Json(session))
}

pub async fn update_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<UpdateStudioSessionPayload>,
) -> AppResult<Json<StudioSessionAggregate>> {
    let session = state
        .studio_service
        .update_session(session_id, user.id, payload)
        .await?;
    Ok(Json(session))
}

pub async fn save_timeline(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
    Json(clips): Json<Vec<TimelineClipPayload>>,
) -> AppResult<Json<Vec<StudioTimelineClipRecord>>> {
    let timeline = state
        .studio_service
        .save_timeline(session_id, user.id, clips)
        .await?;
    Ok(Json(timeline))
}

pub async fn attach_asset(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<AttachAssetPayload>,
) -> AppResult<Json<StudioDynamicAssetRecord>> {
    let asset = state
        .studio_service
        .attach_dynamic_asset(session_id, user.id, payload)
        .await?;
    Ok(Json(asset))
}

pub async fn trigger_preview(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
) -> AppResult<Json<PreviewResponse>> {
    let preview = state
        .studio_service
        .trigger_preview(session_id, user.id)
        .await?;
    Ok(Json(preview))
}

pub async fn publish_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
) -> AppResult<Json<PublishResponse>> {
    let result = state
        .studio_service
        .publish_session(session_id, user.id)
        .await?;
    Ok(Json(result))
}

pub async fn list_templates(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Vec<StoryTemplateSpec>>> {
    Ok(Json(state.story_templates.list().to_vec()))
}

#[derive(Debug, Clone, Deserialize)]
pub struct TemplateBusinessContextPayload {
    pub service_category: Option<String>,
    pub tone: Option<String>,
    pub cta_label: Option<String>,
    pub delivery_sla_minutes: Option<u32>,
    pub stock_level: Option<i32>,
    pub promotion_active: Option<bool>,
    pub price_label: Option<String>,
    pub target_audience: Option<String>,
}

impl From<TemplateBusinessContextPayload> for TimelineBusinessContext {
    fn from(value: TemplateBusinessContextPayload) -> Self {
        TimelineBusinessContext {
            service_category: value.service_category,
            tone: value.tone,
            cta_label: value.cta_label,
            delivery_sla_minutes: value.delivery_sla_minutes,
            stock_level: value.stock_level,
            promotion_active: value.promotion_active,
            price_label: value.price_label,
            target_audience: value.target_audience,
            stock_last_synced_at: None,
            stock_source: None,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct TemplateRecommendationPayload {
    #[serde(default)]
    pub script_outline: Vec<String>,
    pub product_name: Option<String>,
    pub headline: Option<String>,
    pub call_to_action: Option<String>,
    pub style: Option<String>,
    pub duration_seconds: Option<f32>,
    pub template_id: Option<String>,
    pub business_context: Option<TemplateBusinessContextPayload>,
    #[serde(default)]
    pub ai_hints: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct TemplateRecommendationItem {
    pub id: String,
    pub label: String,
    pub description: String,
    pub score: i32,
    pub reasons: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct TemplateRecommendationResponse {
    pub ordered: Vec<TemplateRecommendationItem>,
    pub best_template: Option<String>,
}

pub async fn recommend_templates(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<TemplateRecommendationPayload>,
) -> AppResult<Json<TemplateRecommendationResponse>> {
    // Ensure the user owns the session before computing recommendations
    state
        .studio_service
        .get_session(session_id, user.id)
        .await?;

    let script_outline = if payload.script_outline.is_empty() {
        vec![
            "Introduction Yukpo Studio".to_string(),
            "Mettre en avant l'offre".to_string(),
        ]
    } else {
        payload.script_outline.clone()
    };

    let timeline_request = TimelineRequest {
        script_outline,
        product_name: payload
            .product_name
            .clone()
            .unwrap_or_else(|| "Expérience Yukpo".to_string()),
        headline: payload.headline.clone(),
        call_to_action: payload.call_to_action.clone(),
        style: payload.style.clone(),
        duration_seconds: payload.duration_seconds.unwrap_or(28.0),
        broll_assets: Vec::new(),
        template_id: payload.template_id.clone(),
        business_context: payload.business_context.clone().map(Into::into),
        ai_template_recommendations: payload.ai_hints.clone(),
    };

    let orchestrator = ImmersiveOrchestrator::new(state.clone());
    let ranked = orchestrator.recommend_templates(&timeline_request);

    let ordered: Vec<TemplateRecommendationItem> = ranked
        .iter()
        .map(|item| TemplateRecommendationItem {
            id: item.id.clone(),
            label: item.label.clone(),
            description: item.description.clone(),
            score: item.score,
            reasons: item.reasons.clone(),
        })
        .collect();
    let recommended_ids: Vec<String> = ordered.iter().map(|item| item.id.clone()).collect();

    // Persist ordered recommendations for the session
    let _ = state
        .studio_service
        .update_session(
            session_id,
            user.id,
            UpdateStudioSessionPayload {
                service_id: None,
                status: None,
                brief: None,
                ai_recommendations: None,
                recommended_templates: Some(recommended_ids),
                timeline_settings: None,
                distribution_plan: None,
                metadata: None,
            },
        )
        .await?;

    let best_template = ordered.first().map(|item| item.id.clone());

    Ok(Json(TemplateRecommendationResponse {
        ordered,
        best_template,
    }))
}

pub async fn list_preview_events(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
) -> AppResult<Json<Vec<StudioPreviewEventRecord>>> {
    let events = state
        .studio_service
        .list_preview_events(session_id, user.id)
        .await?;
    Ok(Json(events))
}

pub async fn preview_metrics(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
) -> AppResult<Json<StudioPreviewMetrics>> {
    let metrics = state
        .studio_service
        .preview_metrics(session_id, user.id)
        .await?;
    Ok(Json(metrics))
}
