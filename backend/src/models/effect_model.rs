// ✅ NOUVEAU: Modèle pour les effets vidéo stockés en base de données

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Effect {
    pub id: i32,
    pub name: String,
    pub category: String, // "transitions", "visual_effects", "animations", "special"
    pub description: String,
    pub ffmpeg_filter: String,
    pub parameters: Value, // JSON avec paramètres ajustables
    pub tags: Vec<String>, // Tags pour recherche
    pub is_premium: bool,
    pub popularity_score: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectParameter {
    pub name: String,
    pub r#type: String, // "float", "int", "bool", "string", "color"
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub default: Value,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectMetadata {
    pub category: String,
    pub tags: Vec<String>,
    pub parameters: Vec<EffectParameter>,
    pub preview_url: Option<String>,
    pub thumbnail_url: Option<String>,
}
