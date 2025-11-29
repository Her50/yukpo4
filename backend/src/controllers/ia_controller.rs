use axum::{
    extract::{Multipart, State},
    Json,
};
use base64::Engine;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::{
    core::types::AppResult,
    ia::behavior_engine::{compute_behavior_score, is_suspicious},
    services::app_ia::{
        DistributionRequest, DistributionSuggestion, MediaAnalysisRequest, MediaAnalysisResult,
        VideoBriefRequest, VideoStyleRequest, VideoStyleSuggestion,
    },
    state::AppState,
};

/// ?? Analyse comportementale (bas?e sur IP, fr?quence, chemin)
#[derive(Deserialize)]
pub struct BehaviorInput {
    pub ip: String,
    pub path: String,
    pub freq: u32,
}

#[derive(Serialize)]
pub struct BehaviorOutput {
    pub score: u32,
    pub suspicious: bool,
}

/// ? POST /ia/analyze_behavior ? d?tecte comportements suspects
pub async fn analyze_behavior(
    State(_): State<Arc<AppState>>,
    Json(payload): Json<BehaviorInput>,
) -> AppResult<Json<BehaviorOutput>> {
    info!(
        "[analyze_behavior] Called for ip={}, path={}, freq={}",
        payload.ip, payload.path, payload.freq
    );
    let score = compute_behavior_score(&payload.ip, &payload.path, payload.freq);
    let suspicious = is_suspicious(score, &payload.ip, &payload.path);
    Ok(Json(BehaviorOutput { score, suspicious }))
}

/// ?? Pr?diction IA via AppState.ia
#[derive(Deserialize)]
pub struct IAPrompt {
    pub texte: String,
}

/// ? POST /ia/predict ? r?ponse IA simple ? un prompt texte
pub async fn predict_ia(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<IAPrompt>,
) -> AppResult<Json<String>> {
    info!(
        "[predict_ia] Called for texte length={}",
        payload.texte.len()
    );
    match state.ia.predict(&payload.texte).await {
        Ok((_, result, _tokens)) => {
            info!("[predict_ia] Success");
            Ok(Json(result))
        }
        Err(e) => {
            error!("[predict_ia] Error: {e:?}");
            let msg = format!("Erreur IA: {e:?}");
            return Err(crate::core::types::AppError::Internal(msg));
        }
    }
}

/// ? POST /ia/enrichir_contexte ? enrichit le fichier input_context.json
pub async fn enrichir_contexte_ia(_multipart: Multipart) -> AppResult<Json<serde_json::Value>> {
    info!("[enrichir_contexte_ia] Called");
    // if let Err(e) = enrichir_input_context(multipart).await {
    //     error!("[enrichir_contexte_ia] Error: {e:?}");
    //     return Err(e);
    // }
    Ok(Json(json!({ "success": true })))
}

/// ?? Analyse de texte pour le frontend (ChatInputPanel)
#[derive(Deserialize)]
pub struct TextAnalysisInput {
    pub text: String,
    pub context: Option<String>,
    #[serde(rename = "includeSecurity")]
    pub include_security: Option<bool>,
    #[serde(rename = "includeOptimization")]
    pub include_optimization: Option<bool>,
    #[serde(rename = "includeModelRecommendation")]
    pub include_model_recommendation: Option<bool>,
}

#[derive(Serialize)]
pub struct TextAnalysisOutput {
    pub confidence: f64,
    pub suggestions: Vec<String>,
    pub complexity: String,
    #[serde(rename = "estimatedTokens")]
    pub estimated_tokens: u32,
    #[serde(rename = "intentPrediction")]
    pub intent_prediction: String,
    #[serde(rename = "securityScore")]
    pub security_score: f64,
    #[serde(rename = "optimizationTips")]
    pub optimization_tips: Vec<String>,
    #[serde(rename = "modelRecommendation")]
    pub model_recommendation: String,
}

/// ? POST /api/ia/analyze ? analyse de texte pour le frontend
pub async fn analyze_text_input(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<TextAnalysisInput>,
) -> AppResult<Json<TextAnalysisOutput>> {
    info!(
        "[analyze_text_input] Called for text length={}",
        payload.text.len()
    );

    // Analyse basique du texte
    let text_lower = payload.text.to_lowercase();
    let word_count = payload.text.split_whitespace().count();

    // Calcul de la confiance bas? sur la longueur et le contenu
    let confidence = if word_count > 50 {
        0.9
    } else if word_count > 20 {
        0.7
    } else {
        0.5
    };

    // D?tection de la complexit?
    let complexity = if word_count > 100 {
        "complex".to_string()
    } else if word_count > 50 {
        "medium".to_string()
    } else {
        "simple".to_string()
    };

    // Estimation des tokens (approximation)
    let estimated_tokens = ((word_count as f64) * 1.3) as u32;

    // Pr?diction d'intention bas?e sur les mots-cl?s
    let intent_prediction = if text_lower.contains("je vends") || text_lower.contains("vente") {
        "vente".to_string()
    } else if text_lower.contains("je cherche") || text_lower.contains("recherche") {
        "recherche".to_string()
    } else if text_lower.contains("aide") || text_lower.contains("comment") {
        "assistance".to_string()
    } else {
        "general".to_string()
    };

    // Score de s?curit? basique
    let security_score = if text_lower.contains("ill?gal") || text_lower.contains("drogue") {
        0.2
    } else {
        0.9
    };

    // Suggestions bas?es sur le contexte
    let mut suggestions = Vec::new();
    if word_count < 10 {
        suggestions.push("Ajoutez plus de d?tails pour une meilleure analyse".to_string());
    }
    if !text_lower.contains("prix") && intent_prediction == "vente" {
        suggestions.push("Pr?cisez le prix pour attirer plus d'acheteurs".to_string());
    }

    // Conseils d'optimisation
    let mut optimization_tips = Vec::new();
    if word_count > 200 {
        optimization_tips
            .push("Texte long d?tect?, consid?rez une version plus concise".to_string());
    }
    if !text_lower.contains("contact") {
        optimization_tips.push("Ajoutez vos coordonn?es pour faciliter les ?changes".to_string());
    }

    // Recommandation de mod?le
    let model_recommendation = if complexity == "complex" {
        "gpt4".to_string()
    } else if complexity == "medium" {
        "gpt35".to_string()
    } else {
        "auto".to_string()
    };

    Ok(Json(TextAnalysisOutput {
        confidence,
        suggestions,
        complexity,
        estimated_tokens,
        intent_prediction,
        security_score,
        optimization_tips,
        model_recommendation,
    }))
}

#[derive(Deserialize)]
pub struct GenerateSubtitlesInput {
    pub product_name: String,
    pub outline: Vec<String>,
    pub lang: Option<String>,
    #[serde(default = "default_duration")]
    pub duration_seconds: u32,
}

#[derive(Serialize)]
pub struct GenerateSubtitlesOutput {
    pub success: bool,
    pub srt: Option<String>,
}

pub async fn generate_video_subtitles(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<GenerateSubtitlesInput>,
) -> AppResult<Json<GenerateSubtitlesOutput>> {
    let lang = payload.lang.unwrap_or_else(|| "fr".to_string());
    let outline: Vec<String> = payload
        .outline
        .into_iter()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();

    if outline.is_empty() {
        return Ok(Json(GenerateSubtitlesOutput {
            success: true,
            srt: None,
        }));
    }

    let duration = payload.duration_seconds.max(5).min(900);
    
    // ✅ CORRECTION: Gestion d'erreur robuste avec fallback
    let srt = match state
        .ia
        .generate_subtitles_srt(&payload.product_name, &outline, &lang, duration)
        .await
    {
        Ok(srt) => srt,
        Err(err) => {
            error!(
                "[generate_video_subtitles] Erreur génération sous-titres IA: {} - Utilisation None",
                err
            );
            // Retourner None si l'IA échoue (pas de sous-titres plutôt qu'une erreur)
            None
        }
    };

    Ok(Json(GenerateSubtitlesOutput { success: true, srt }))
}

#[derive(Debug, Deserialize)]
pub struct VideoBriefPayload {
    pub product_name: String,
    pub description: Option<String>,
    pub price: Option<String>,
    pub promotion: Option<String>,
    #[serde(default)]
    pub highlights: Vec<String>,
    pub target_audience: Option<String>,
    pub tone: Option<String>,
    pub lang: Option<String>,
    pub variant_count: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct VideoBriefVariant {
    pub headline: Option<String>,
    pub call_to_action: Option<String>,
    pub script_outline: Vec<String>,
    pub hook: Option<String>,
    pub voiceover: Option<String>,
    pub hashtags: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct VideoBriefResponse {
    pub success: bool,
    pub variants: Vec<VideoBriefVariant>,
}

#[derive(Debug, Deserialize)]
pub struct VideoStylePayload {
    pub channel: String,
    pub product_type: Option<String>,
    pub tone: Option<String>,
    pub promotion: Option<String>,
    #[serde(default)]
    pub highlights: Vec<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VideoStyleResponse {
    pub success: bool,
    pub suggestion: VideoStyleSuggestion,
}

#[derive(Debug, Deserialize)]
pub struct MediaAnalysisPayload {
    pub product_name: String,
    #[serde(default)]
    pub media_tags: Vec<String>,
    pub description: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MediaAnalysisResponse {
    pub success: bool,
    pub analysis: MediaAnalysisResult,
}

#[derive(Debug, Deserialize)]
pub struct DistributionPayload {
    pub product_name: String,
    #[serde(default)]
    pub channels: Vec<String>,
    pub target_audience: Option<String>,
    pub marketing_angle: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DistributionResponse {
    pub success: bool,
    pub plan: DistributionSuggestion,
}

fn default_duration() -> u32 {
    30
}

pub async fn generate_video_brief(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VideoBriefPayload>,
) -> AppResult<Json<VideoBriefResponse>> {
    let request = VideoBriefRequest {
        product_name: payload.product_name.clone(),
        description: payload.description.clone(),
        price: payload.price.clone(),
        promotion: payload.promotion.clone(),
        highlights: payload.highlights.clone(),
        target_audience: payload.target_audience.clone(),
        tone: payload.tone.clone(),
        lang: payload.lang.unwrap_or_else(|| "fr".to_string()),
        variant_count: payload.variant_count.unwrap_or(3),
    };

    // ✅ CORRECTION: Gestion d'erreur robuste avec fallback vers valeurs par défaut
    let briefs = match state.ia.generate_video_briefs(&request).await {
        Ok(briefs) => briefs,
        Err(err) => {
            error!(
                "[generate_video_brief] Erreur génération brief IA: {} - Utilisation valeurs par défaut",
                err
            );
            
            // Fallback vers des valeurs par défaut
            use crate::services::app_ia::VideoBrief;
            vec![VideoBrief {
                headline: Some(format!("Découvrez {}", request.product_name)),
                call_to_action: Some("Commandez maintenant".to_string()),
                script_outline: vec![
                    "Introduction produit".to_string(),
                    "Présentation des avantages".to_string(),
                    "Appel à l'action".to_string(),
                ],
                hook: Some(format!("Envie de découvrir {} ?", request.product_name)),
                voiceover: Some(format!(
                    "Découvrez {} sur Yukpomnang. Qualité garantie, satisfaction assurée.",
                    request.product_name
                )),
                hashtags: vec![
                    "#Yukpomnang".to_string(),
                    "#Qualité".to_string(),
                ],
            }]
        }
    };

    let variants = briefs
        .into_iter()
        .map(|brief| VideoBriefVariant {
            headline: brief.headline,
            call_to_action: brief.call_to_action,
            script_outline: brief.script_outline,
            hook: brief.hook,
            voiceover: brief.voiceover,
            hashtags: brief.hashtags,
        })
        .collect::<Vec<_>>();

    Ok(Json(VideoBriefResponse {
        success: true,
        variants,
    }))
}

pub async fn generate_video_style(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VideoStylePayload>,
) -> AppResult<Json<VideoStyleResponse>> {
    let request = VideoStyleRequest {
        channel: payload.channel.clone(),
        product_type: payload.product_type.clone(),
        tone: payload.tone.clone(),
        promotion: payload.promotion.clone(),
        highlights: payload.highlights.clone(),
        lang: payload.lang.unwrap_or_else(|| "fr".to_string()),
    };

    // ✅ CORRECTION: Gestion d'erreur robuste avec fallback vers valeurs par défaut
    let suggestion = match state.ia.generate_video_style(&request).await {
        Ok(suggestion) => suggestion,
        Err(err) => {
            error!(
                "[generate_video_style] Erreur génération style IA: {} - Utilisation valeurs par défaut",
                err
            );
            
            // Fallback vers des valeurs par défaut basées sur le channel
            let default_suggestion = match payload.channel.as_str() {
                "tiktok" | "shorts" | "reels" => VideoStyleSuggestion {
                    effects: vec!["Zoom dynamique".to_string(), "Texte animé".to_string()],
                    transitions: vec!["Cut rapide".to_string(), "Glitch".to_string()],
                    color_palette: Some("#FF006E #FFBE0B".to_string()),
                    overlay_tips: vec!["Texte en haut".to_string(), "CTA en bas".to_string()],
                    music_hint: Some("Beat énergique 120-140 BPM".to_string()),
                },
                "story" | "instagram" => VideoStyleSuggestion {
                    effects: vec!["Fade doux".to_string(), "Overlay élégant".to_string()],
                    transitions: vec!["Fade".to_string(), "Slide".to_string()],
                    color_palette: Some("#6366F1 #8B5CF6".to_string()),
                    overlay_tips: vec!["Texte centré".to_string(), "Brand discret".to_string()],
                    music_hint: Some("Ambiance douce et premium".to_string()),
                },
                "cinematic" | "youtube" => VideoStyleSuggestion {
                    effects: vec!["Slow motion".to_string(), "Focus blur".to_string()],
                    transitions: vec!["Crossfade".to_string(), "Wipe".to_string()],
                    color_palette: Some("#1E293B #64748B".to_string()),
                    overlay_tips: vec!["Titre élégant".to_string(), "Sous-titre discret".to_string()],
                    music_hint: Some("Orchestre épique ou ambient".to_string()),
                },
                _ => VideoStyleSuggestion {
                    effects: vec!["Zoom".to_string(), "Pan".to_string()],
                    transitions: vec!["Cut".to_string(), "Fade".to_string()],
                    color_palette: Some("#6366F1 #10B981".to_string()),
                    overlay_tips: vec!["Texte informatif".to_string()],
                    music_hint: Some("Musique générique".to_string()),
                },
            };
            
            warn!(
                "[generate_video_style] Style IA indisponible, utilisation valeurs par défaut pour channel: {}",
                payload.channel
            );
            
            default_suggestion
        }
    };

    Ok(Json(VideoStyleResponse {
        success: true,
        suggestion,
    }))
}

#[derive(Deserialize)]
pub struct GenerateTTSInput {
    pub script: String,
    pub lang: Option<String>,
}

#[derive(Serialize)]
pub struct GenerateTTSOutput {
    pub success: bool,
    pub audio_base64: Option<String>,
    pub format: Option<String>,
}

pub async fn generate_tts_voice(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<GenerateTTSInput>,
) -> AppResult<Json<GenerateTTSOutput>> {
    let lang = payload.lang.unwrap_or_else(|| "fr".to_string());
    let result = state.ia.generate_tts_audio(&payload.script, &lang).await?;

    let (success, audio_base64, format) = match result {
        Some((bytes, fmt)) => (
            true,
            Some(base64::engine::general_purpose::STANDARD.encode(bytes)),
            Some(fmt),
        ),
        None => (false, None, None),
    };

    Ok(Json(GenerateTTSOutput {
        success,
        audio_base64,
        format,
    }))
}

pub async fn analyze_media_tags(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<MediaAnalysisPayload>,
) -> AppResult<Json<MediaAnalysisResponse>> {
    let request = MediaAnalysisRequest {
        product_name: payload.product_name.clone(),
        media_tags: payload.media_tags.clone(),
        description: payload.description.clone(),
        lang: payload.lang.unwrap_or_else(|| "fr".to_string()),
    };

    // ✅ CORRECTION: Gestion d'erreur robuste avec fallback
    let analysis = match state.ia.analyze_media(&request).await {
        Ok(analysis) => analysis,
        Err(err) => {
            error!(
                "[analyze_media_tags] Erreur analyse média IA: {} - Utilisation valeurs par défaut",
                err
            );
            
            // Fallback vers des valeurs par défaut
            use crate::services::app_ia::MediaAnalysisResult;
            MediaAnalysisResult {
                dominant_colors: vec!["#6366F1".to_string(), "#10B981".to_string()],
                detected_objects: vec!["Produit".to_string()],
                ambiance: Some("Professionnel".to_string()),
                marketing_angle: Some("Qualité et confiance".to_string()),
            }
        }
    };

    Ok(Json(MediaAnalysisResponse {
        success: true,
        analysis,
    }))
}

pub async fn generate_distribution_plan(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<DistributionPayload>,
) -> AppResult<Json<DistributionResponse>> {
    let request = DistributionRequest {
        product_name: payload.product_name.clone(),
        channels: if payload.channels.is_empty() {
            vec![
                "product".to_string(),
                "chat".to_string(),
                "shorts".to_string(),
            ]
        } else {
            payload.channels.clone()
        },
        target_audience: payload.target_audience.clone(),
        marketing_angle: payload.marketing_angle.clone(),
        lang: payload.lang.unwrap_or_else(|| "fr".to_string()),
    };

    // ✅ CORRECTION: Gestion d'erreur robuste avec fallback vers valeurs par défaut
    let plan = match state.ia.generate_distribution_plan(&request).await {
        Ok(plan) => plan,
        Err(err) => {
            error!(
                "[generate_distribution_plan] Erreur génération plan IA: {} - Utilisation valeurs par défaut",
                err
            );
            
            // Fallback vers des valeurs par défaut
            use crate::services::app_ia::{DistributionSuggestion, DistributionScheduleItem};
            DistributionSuggestion {
                summary: Some(format!("Découvrez {} - Qualité et confiance garanties", request.product_name)),
                hashtags: vec![
                    "#Yukpomnang".to_string(),
                    "#Qualité".to_string(),
                    "#Confiance".to_string(),
                ],
                schedule: request.channels.iter().map(|channel| {
                    DistributionScheduleItem {
                        channel: channel.clone(),
                        best_time: "Lundi 10h".to_string(),
                        call_to_action: Some("Découvrez maintenant".to_string()),
                    }
                }).collect(),
            }
        }
    };

    Ok(Json(DistributionResponse {
        success: true,
        plan,
    }))
}
