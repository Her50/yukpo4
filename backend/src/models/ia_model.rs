// src/models/ia_model.rs

use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::{DateTime, Utc};

/// ?? Entr?e utilisateur pour l'analyse IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputIA {
    pub prompt: String,
    pub model: Option<String>,           // ex: "openai", "mistral", "local"
    pub lang: Option<String>,            // ex: "fr", "en"
    pub context: Option<Value>,          // JSON libre selon l'appli (ex: user, session, etc.)
}

/// ?? R?ponse g?n?r?e par un moteur IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputIA {
    pub content: String,
    pub tokens_used: Option<u32>,
    pub engine: Option<String>,          // ex: "openai", "mistral"
    pub confidence: Option<f32>,         // si disponible
    pub lang: Option<String>,
    pub cached: bool,
    pub timestamp: Option<DateTime<Utc>>,
}

/// ?? Configuration avanc?e pour moteur IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigIA {
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub top_p: Option<f32>,
    pub frequency_penalty: Option<f32>,
    pub presence_penalty: Option<f32>,
}

/// ? Donn?es du cache enregistr?es dans Redis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheIA {
    pub key: String,
    pub input: InputIA,
    pub output: OutputIA,
    pub timestamp: DateTime<Utc>,
}

/// Requ?te IA simplifi?e
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IARequest {
    pub prompt: String,
    pub context: Option<serde_json::Value>,
    pub engine: String, 
}

/// R?ponse IA simplifi?e
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IAResponse {
    pub text: String,
    pub source: String,
    pub result: String,
    pub confidence: Option<f32>,
}
