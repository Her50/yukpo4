use crate::models::ia_model::{IARequest, IAResponse};
use crate::core::types::{AppError, AppResult};

/// ?? Appelle le bon fournisseur LLM (OpenAI, Mistral, etc.)
pub async fn call_llm_provider(input: IARequest) -> AppResult<IAResponse> {
    match input.engine.as_str() {
        "openai" => Ok(IAResponse {
            text: format!("R?ponse simul?e de OpenAI pour : {}", input.prompt),
            source: "openai".to_string(),
            result: "success".to_string(),
            confidence: Some(0.95),
        }),

        "mistral" => Ok(IAResponse {
            text: format!("R?ponse simul?e de Mistral pour : {}", input.prompt),
            source: "mistral".to_string(),
            result: "success".to_string(),
            confidence: Some(0.90),
        }),

        _ => Err(AppError::BadRequest("Moteur IA non support?".into())),
    }
}
