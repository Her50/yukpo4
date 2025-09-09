use axum::{extract::Json, response::IntoResponse, Router, routing::post};
use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Deserialize)]
struct TranslationRequest {
    text: String,
    target_lang: String, // "en", "fr", "pt", etc.
}

#[derive(Serialize)]
struct TranslationResponse {
    translated_text: String,
}

async fn translate_with_openai(Json(payload): Json<TranslationRequest>) -> impl IntoResponse {
    let prompt = format!(
        "Traduis ce texte en {} :\n\n{}",
        payload.target_lang, payload.text
    );

    let api_key = std::env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY non dÃ©fini");
    let client = Client::new();

    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": "gpt-4",
            "messages": [{ "role": "user", "content": prompt }],
            "temperature": 0.4
        }))
        .send()
        .await
        .unwrap();

    let json = res.json::<serde_json::Value>().await.unwrap();
    let output = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("Erreur")
        .to_string();

    Json(TranslationResponse {
        translated_text: output,
    })
}

pub fn translation_routes() -> Router {
    Router::new().route("/api/translate", post(translate_with_openai))
}

