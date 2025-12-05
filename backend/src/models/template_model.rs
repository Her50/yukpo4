// ✅ NOUVEAU: Modèle pour les templates vidéo par industrie

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct VideoTemplate {
    pub id: i32,
    pub name: String,
    pub industry: String, // "ecommerce", "services", "creators", "business", "social_media"
    pub subcategory: Option<String>, // e.g., "mode", "restauration", "vlog"
    pub description: String,
    pub timeline: Value, // JSON représentant la VideoTimeline pré-configurée
    pub effects: Value, // JSON array des effets à appliquer
    pub transitions: Value, // JSON array des transitions
    pub style: Value, // JSON avec style (couleurs, typographie, etc.)
    pub duration: f64, // secondes
    pub format: String, // "16:9", "9:16", "1:1", "4:5"
    pub tags: Vec<String>,
    pub thumbnail_url: Option<String>,
    pub preview_url: Option<String>,
    pub is_premium: bool,
    pub popularity_score: f64,
    pub usage_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateStyle {
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
    pub font_family: Option<String>,
    pub font_size: Option<f64>,
    pub text_color: Option<String>,
    pub background_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateMetadata {
    pub industry: String,
    pub subcategory: Option<String>,
    pub tags: Vec<String>,
    pub style: TemplateStyle,
    pub duration: f64,
    pub format: String,
}


