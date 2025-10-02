use std::sync::Arc;
use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use reqwest::Client;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub message: String,
    pub context: Option<serde_json::Value>,
    pub r#type: String,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub message: String,
    pub suggestions: Vec<String>,
    pub confidence: f64,
}

#[derive(Debug, Deserialize)]
pub struct RecommendationsRequest {
    pub preferences: serde_json::Value,
    pub r#type: String,
}

#[derive(Debug, Serialize)]
pub struct RecommendationsResponse {
    pub recommendations: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct AnalyzeRequest {
    pub text: String,
    pub r#type: String,
}

#[derive(Debug, Serialize)]
pub struct AnalyzeResponse {
    pub sentiment: String,
    pub keywords: Vec<String>,
}

/// Chat IA avec OpenAI
pub async fn chat_ai(
    Json(payload): Json<ChatRequest>,
    State(_state): State<Arc<AppState>>,
) -> Result<ResponseJson<ChatResponse>, StatusCode> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let client = Client::new();
    
    // Construire le prompt avec le contexte
    let system_prompt = "Tu es Yukpomnang, un assistant intelligent spécialisé dans les services locaux. Réponds de manière utile et concise en français.";
    let user_message = if let Some(context) = payload.context {
        format!("Contexte: {}\nQuestion: {}", serde_json::to_string(&context).unwrap_or_default(), payload.message)
    } else {
        payload.message
    };
    
    let request_body = serde_json::json!({
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "max_tokens": 500,
        "temperature": 0.7
    });
    
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if !response.status().is_success() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    let openai_response: serde_json::Value = response
        .json()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let message = openai_response["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("Désolé, je n'ai pas pu traiter votre demande.")
        .to_string();
    
    // Générer des suggestions basiques
    let suggestions = vec![
        "Plus d'informations".to_string(),
        "Autres services".to_string(),
        "Aide".to_string(),
    ];
    
    Ok(ResponseJson(ChatResponse {
        message,
        suggestions,
        confidence: 0.8,
    }))
}

/// Génère des recommandations personnalisées
pub async fn get_recommendations(
    Json(payload): Json<RecommendationsRequest>,
    State(_state): State<Arc<AppState>>,
) -> Result<ResponseJson<RecommendationsResponse>, StatusCode> {
    // Pour l'instant, retourner des recommandations basiques
    // TODO: Intégrer avec votre système de recommandations existant
    let recommendations = vec![
        "Restaurant recommandé : Le Bistrot".to_string(),
        "Activité suggérée : Visite du musée".to_string(),
        "Service utile : Pharmacie à proximité".to_string(),
    ];
    
    Ok(ResponseJson(RecommendationsResponse { recommendations }))
}

/// Analyse le sentiment et extrait les mots-clés d'un texte
pub async fn analyze_text(
    Json(payload): Json<AnalyzeRequest>,
    State(_state): State<Arc<AppState>>,
) -> Result<ResponseJson<AnalyzeResponse>, StatusCode> {
    // Analyse basique du sentiment
    let sentiment = if payload.text.to_lowercase().contains("merci") || 
                       payload.text.to_lowercase().contains("parfait") ||
                       payload.text.to_lowercase().contains("excellent") {
        "positif"
    } else if payload.text.to_lowercase().contains("problème") ||
              payload.text.to_lowercase().contains("erreur") ||
              payload.text.to_lowercase().contains("mauvais") {
        "négatif"
    } else {
        "neutre"
    };
    
    // Extraire les mots-clés (mots de plus de 3 caractères)
    let keywords: Vec<String> = payload.text
        .split_whitespace()
        .filter(|word| word.len() > 3)
        .map(|word| word.to_lowercase())
        .take(5)
        .collect();
    
    Ok(ResponseJson(AnalyzeResponse {
        sentiment: sentiment.to_string(),
        keywords,
    }))
}

pub fn ai_chat_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route("/ai/chat", post(chat_ai))
        .route("/ai/recommendations", post(get_recommendations))
        .route("/ai/analyze", post(analyze_text))
        .with_state(state)
}
