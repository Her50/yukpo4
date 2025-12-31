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
        immersive_orchestrator::{
            ImmersiveOrchestrator, Storyboard, TimelineBusinessContext, TimelineRequest,
        },
        story_template_service::StoryTemplateSpec,
        studio_service::{
            AttachAssetPayload, CreateStudioSessionPayload, PreviewResponse, PublishResponse,
            SetDependenciesPayload, StudioDynamicAssetRecord, StudioPreviewEventRecord,
            StudioPreviewMetrics, StudioSessionAggregate, StudioSessionRecord,
            StudioTimelineClipRecord, TimelineClipPayload, UpdateStudioSessionPayload,
            VideoDependency,
        },
    },
    state::AppState,
};

pub async fn create_session(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateStudioSessionPayload>,
) -> AppResult<Json<StudioSessionAggregate>> {
    log::info!(
        "[Studio] create_session - user_id: {}, service_id: {:?}, brief: {:?}",
        user.id,
        payload.service_id,
        payload.brief
    );
    
    match state.studio_service.create_session(user.id, payload).await {
        Ok(session) => {
            log::info!(
                "[Studio] ✅ Session créée avec succès - session_id: {}",
                session.session.id
            );
            Ok(Json(session))
        }
        Err(e) => {
            log::error!(
                "[Studio] ❌ Erreur création session - user_id: {}, erreur: {:?}",
                user.id,
                e
            );
            Err(e)
        }
    }
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

#[axum::debug_handler]
pub async fn trigger_short_preview(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
) -> AppResult<Json<PreviewResponse>> {
    log::info!(
        "[StudioController] ✅ Route trigger_short_preview appelée - user_id={}, session_id={}",
        user.id, session_id
    );
    
    // ✅ AMÉLIORÉ: Vérifier la disponibilité du renderer avant de continuer
    if !state.studio_service.is_renderer_available() {
        log::warn!(
            "[StudioController] ⚠️ Renderer vidéo indisponible - user_id={}, session_id={}",
            user.id, session_id
        );
        return Err(crate::core::types::AppError::BadRequest(
            "Le service de prévisualisation vidéo n'est pas configuré. Vérifiez que VIDEO_RENDERER_PROJECT_ROOT existe et que VIDEO_RENDERER_ENABLED=true, ou configurez VIDEO_RENDERER_RPC_URL pour utiliser un renderer distant.".into()
        ));
    }
    
    let preview = state
        .studio_service
        .trigger_short_preview(session_id, user.id)
        .await
        .map_err(|e| {
            log::error!(
                "[StudioController] ❌ Erreur trigger_short_preview - user_id={}, session_id={}: {}",
                user.id, session_id, e
            );
            e
        })?;
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

#[derive(Debug, Serialize)]
pub struct StoryboardResponse {
    pub storyboard: Storyboard,
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

/// ✅ Phase 7 - Amélioration 22 : POST /api/studio/sessions/{session_id}/suggestions
/// Génère des suggestions IA basées sur le brief
#[derive(Deserialize)]
pub struct GenerateSuggestionsPayload {
    pub brief: String,
    #[serde(default)]
    pub product_name: Option<String>,
    #[serde(default)]
    pub service_name: Option<String>,
}

#[derive(Serialize)]
pub struct SuggestionsResponse {
    pub suggestions: Vec<String>,
}

pub async fn generate_suggestions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<GenerateSuggestionsPayload>,
) -> AppResult<Json<SuggestionsResponse>> {
    // Vérifier que la session existe et appartient à l'utilisateur
    state
        .studio_service
        .get_session(session_id, user.id)
        .await?;

    // ✅ Phase 7 - Amélioration 22 : Générer des suggestions basées sur le brief avec IA
    let suggestions = if payload.brief.trim().is_empty() {
        // Si brief vide, suggestions par défaut
        vec![
            "Introduction accrocheuse du produit".to_string(),
            "Mise en avant des avantages principaux".to_string(),
            "Preuve sociale et témoignages".to_string(),
            "Appel à l'action clair et incitatif".to_string(),
        ]
    } else {
        // ✅ Intégration IA pour générer des suggestions intelligentes
        let product_name = payload.product_name.as_deref().unwrap_or("produit");
        let service_name = payload.service_name.as_deref().unwrap_or("service");

        let prompt = format!(
            "Tu es un expert en marketing vidéo pour Yukpomnang. Analyse ce brief et génère 4-5 suggestions concises (une phrase chacune) pour améliorer la vidéo promotionnelle.\n\nBrief : {}\nProduit : {}\nService : {}\n\nFormat de réponse (JSON strict) :\n{{\n  \"suggestions\": [\n    \"Suggestion 1\",\n    \"Suggestion 2\",\n    \"Suggestion 3\",\n    \"Suggestion 4\"\n  ]\n}}\n\nLes suggestions doivent être :\n- Concrètes et actionnables\n- Adaptées au contexte du brief\n- Orientées vers l'engagement et la conversion\n- Maximum 15 mots chacune",
            payload.brief,
            product_name,
            service_name
        );

        // Appeler l'IA pour générer des suggestions
        match state.ia.predict(&prompt).await {
            Ok((_, response, _)) => {
                // Extraire le JSON de la réponse
                let json_block = extract_json_from_text(&response);
                if let Some(json_str) = json_block {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                        if let Some(suggestions_array) =
                            parsed.get("suggestions").and_then(|v| v.as_array())
                        {
                            let ai_suggestions: Vec<String> = suggestions_array
                                .iter()
                                .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                                .filter(|s| !s.is_empty())
                                .take(5)
                                .collect();

                            if !ai_suggestions.is_empty() {
                                return Ok(Json(SuggestionsResponse {
                                    suggestions: ai_suggestions,
                                }));
                            }
                        }
                    }
                }

                // Fallback si parsing JSON échoue : extraire les suggestions du texte
                let fallback_suggestions = extract_suggestions_from_text(&response);
                if !fallback_suggestions.is_empty() {
                    return Ok(Json(SuggestionsResponse {
                        suggestions: fallback_suggestions,
                    }));
                }

                // Dernier fallback : suggestions basiques
                generate_fallback_suggestions(&payload.brief)
            }
            Err(e) => {
                log::warn!(
                    "Erreur IA pour suggestions: {}. Utilisation de fallback.",
                    e
                );
                generate_fallback_suggestions(&payload.brief)
            }
        }
    };

    Ok(Json(SuggestionsResponse { suggestions }))
}

/// Fonction helper pour extraire un bloc JSON depuis un texte
fn extract_json_from_text(text: &str) -> Option<String> {
    // Chercher un bloc JSON entre accolades
    let start = text.find('{')?;
    let mut depth = 0;
    let mut end = start;

    for (i, ch) in text[start..].char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    end = start + i + 1;
                    break;
                }
            }
            _ => {}
        }
    }

    if depth == 0 {
        Some(text[start..end].to_string())
    } else {
        None
    }
}

/// Fonction helper pour extraire des suggestions depuis un texte (fallback)
fn extract_suggestions_from_text(text: &str) -> Vec<String> {
    let lines: Vec<&str> = text.lines().collect();
    let mut suggestions = Vec::new();

    for line in lines {
        let trimmed = line.trim();
        // Chercher des lignes qui commencent par des numéros, tirets, ou puces
        if trimmed.starts_with(|c: char| c.is_ascii_digit() || c == '-' || c == '•' || c == '*') {
            let cleaned = trimmed
                .trim_start_matches(|c: char| {
                    c.is_ascii_digit() || c == '-' || c == '•' || c == '*' || c == '.' || c == ' '
                })
                .trim()
                .to_string();
            if !cleaned.is_empty() && cleaned.len() <= 100 {
                suggestions.push(cleaned);
            }
        }
    }

    suggestions.truncate(5);
    suggestions
}

/// Fonction helper pour générer des suggestions de fallback basées sur le brief
fn generate_fallback_suggestions(brief: &str) -> Vec<String> {
    let brief_lower = brief.to_lowercase();
    let mut suggestions = Vec::new();

    // Suggestions contextuelles basées sur le contenu du brief
    if brief_lower.contains("prix") || brief_lower.contains("coût") || brief_lower.contains("tarif")
    {
        suggestions.push("Mettre en avant le rapport qualité/prix".to_string());
    }
    if brief_lower.contains("livraison") || brief_lower.contains("rapide") {
        suggestions.push("Souligner la rapidité de livraison".to_string());
    }
    if brief_lower.contains("qualité") || brief_lower.contains("premium") {
        suggestions.push("Mettre en avant la qualité premium".to_string());
    }
    if brief_lower.contains("promo")
        || brief_lower.contains("réduction")
        || brief_lower.contains("offre")
    {
        suggestions.push("Mettre en avant l'offre promotionnelle".to_string());
    }

    // Suggestions génériques si pas assez de suggestions contextuelles
    if suggestions.len() < 3 {
        suggestions.push("Introduction accrocheuse du produit".to_string());
        suggestions.push("Mise en avant des avantages principaux".to_string());
        suggestions.push("Appel à l'action clair et incitatif".to_string());
    }

    // Limiter à 4-5 suggestions
    suggestions.truncate(5);
    suggestions
}

pub async fn generate_storyboard(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<TemplateRecommendationPayload>,
) -> AppResult<Json<StoryboardResponse>> {
    state
        .studio_service
        .get_session(session_id, user.id)
        .await?;

    let script_outline = if payload.script_outline.is_empty() {
        vec![
            "Introduction Yukpo Studio".to_string(),
            "Mettre en avant l'offre".to_string(),
            "Preuve sociale rapide".to_string(),
            "Appel à l'action".to_string(),
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
    let timeline_result = orchestrator
        .generate_timeline(timeline_request.clone())
        .await?;
    let storyboard = orchestrator.build_storyboard(&timeline_request, &timeline_result);

    // ✅ CORRIGÉ: Sauvegarder automatiquement la timeline générée
    let clips = state
        .studio_service
        .convert_immersive_timeline_to_clips(&timeline_result.timeline)?;
    if !clips.is_empty() {
        let _ = state
            .studio_service
            .save_timeline(session_id, user.id, clips)
            .await;
        log::info!(
            "[StudioController] ✅ Timeline sauvegardée automatiquement pour session {}",
            session_id
        );
    }

    Ok(Json(StoryboardResponse { storyboard }))
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

// ✅ Phase 9 - Amélioration 31 : Définir les dépendances (vidéos suivantes) pour une session
pub async fn set_dependencies(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<SetDependenciesPayload>,
) -> AppResult<Json<Vec<VideoDependency>>> {
    let deps = state
        .studio_service
        .set_dependencies(session_id, user.id, payload)
        .await?;
    Ok(Json(deps))
}

// ✅ Phase 9 - Amélioration 31 : Récupérer la vidéo suivante dans la chaîne
pub async fn get_next_video(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
) -> AppResult<Json<crate::services::studio_service::NextVideoResponse>> {
    let next = state.studio_service.get_next_video(session_id).await?;
    Ok(Json(next))
}

// ✅ Phase 9 - Amélioration 31 : Récupérer toutes les dépendances d'une session
pub async fn get_dependencies(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Path(session_id): Path<Uuid>,
) -> AppResult<Json<Vec<VideoDependency>>> {
    let deps = state.studio_service.get_dependencies(session_id).await?;
    Ok(Json(deps))
}
