use axum::{extract::State, response::IntoResponse, Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct TranslateRequest {
    pub text: String,
    pub source_lang: String,
    pub target_lang: String,
}

#[derive(Debug, Serialize)]
pub struct TranslateResponse {
    pub translated: String,
    pub source_lang: String,
    pub target_lang: String,
}

pub fn multilingue_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/multilingue/translate",
            axum::routing::post(translate_text_handler),
        )
        .with_state(state)
}

async fn translate_text_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<TranslateRequest>,
) -> impl IntoResponse {
    match state
        .multilingue_service
        .translate_text(
            &payload.text,
            &payload.source_lang,
            &payload.target_lang,
            &state.pg,
        )
        .await
    {
        Ok(translated) => Json(json!({
            "success": true,
            "data": {
                "translated": translated,
                "source_lang": payload.source_lang,
                "target_lang": payload.target_lang,
            }
        })),
        Err(e) => Json(json!({
            "success": false,
            "error": format!("{}", e),
            "data": {
                "translated": payload.text,
                "source_lang": payload.source_lang,
                "target_lang": payload.target_lang,
            }
        })),
    }
}
