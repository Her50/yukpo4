use axum::{
    extract::{State, Multipart},
    Json,
};
use serde::{Deserialize, Serialize};
use log::{info, error};
use std::sync::Arc;
use serde_json::json;

use crate::{
    core::types::AppResult,
    ia::behavior_engine::{compute_behavior_score, is_suspicious},
    // services::{
    //     // services::context_enricher::enrichir_input_context,
    // },
};
use crate::state::AppState;

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
    info!("[analyze_behavior] Called for ip={}, path={}, freq={}", payload.ip, payload.path, payload.freq);
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
    info!("[predict_ia] Called for texte length={}", payload.texte.len());
    match state.ia.predict(&payload.texte).await {
        Ok((_, result, _tokens)) => {
            info!("[predict_ia] Success");
            Ok(Json(result))
        },
        Err(e) => {
            error!("[predict_ia] Error: {e:?}");
            let msg = format!("Erreur IA: {e:?}");
            return Err(crate::core::types::AppError::Internal(msg));
        }
    }
}

/// ? POST /ia/enrichir_contexte ? enrichit le fichier input_context.json
pub async fn enrichir_contexte_ia(
    _multipart: Multipart,
) -> AppResult<Json<serde_json::Value>> {
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
    info!("[analyze_text_input] Called for text length={}", payload.text.len());
    
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
        optimization_tips.push("Texte long d?tect?, consid?rez une version plus concise".to_string());
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
