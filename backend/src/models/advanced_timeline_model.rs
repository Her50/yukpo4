// ✅ NOUVEAU Phase 2: Modèle backend pour Timeline Multi-Pistes avec Keyframes

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;

/// Type de piste dans la timeline
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "track_type", rename_all = "lowercase")]
pub enum TrackType {
    Video,
    Audio,
    Text,
    Effect,
    Graphic,
    Image,
}

/// Type d'interpolation pour keyframes
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "easing_type", rename_all = "kebab-case")]
pub enum EasingType {
    #[sqlx(rename = "linear")]
    Linear,
    #[sqlx(rename = "ease-in")]
    EaseIn,
    #[sqlx(rename = "ease-out")]
    EaseOut,
    #[sqlx(rename = "ease-in-out")]
    EaseInOut,
    Bezier,
}

/// Keyframe pour animation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Keyframe {
    pub time: f64, // Temps en secondes
    pub value: Value, // Valeur (peut être nombre, array, etc.)
    pub easing: Option<EasingType>,
    pub interpolation: Option<String>, // "linear" | "bezier" | "hold"
}

/// Propriété animable avec keyframes
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AnimatableProperty {
    pub position: Option<Vec<Keyframe>>,
    pub scale: Option<Vec<Keyframe>>,
    pub rotation: Option<Vec<Keyframe>>,
    pub opacity: Option<Vec<Keyframe>>,
    pub color: Option<Vec<Keyframe>>,
    pub blur: Option<Vec<Keyframe>>,
    pub brightness: Option<Vec<Keyframe>>,
    pub contrast: Option<Vec<Keyframe>>,
    pub saturation: Option<Vec<Keyframe>>,
}

/// Clip média sur une piste
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineClip {
    pub id: String,
    pub r#type: TrackType,
    pub start_time: f64, // Temps de début dans la timeline
    pub duration: f64, // Durée du clip
    pub source: String, // URL ou chemin du média
    pub properties: AnimatableProperty,
    pub trim_start: Option<f64>, // Trim de début
    pub trim_end: Option<f64>, // Trim de fin
    pub volume: Option<f64>, // Volume (0.0 - 1.0)
    pub muted: Option<bool>,
    pub locked: Option<bool>,
    pub visible: Option<bool>,
}

/// Piste dans la timeline
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineTrack {
    pub id: String,
    pub r#type: TrackType,
    pub name: String,
    pub clips: Vec<TimelineClip>,
    pub locked: Option<bool>,
    pub muted: Option<bool>,
    pub visible: Option<bool>,
    pub height: Option<u32>, // Hauteur de la piste en pixels
    pub order: u32, // Ordre d'affichage
}

/// Timeline multi-pistes complète
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedTimeline {
    pub id: String,
    pub name: String,
    pub duration: f64, // Durée totale en secondes
    pub tracks: Vec<TimelineTrack>,
    pub fps: Option<u32>, // Frames par seconde (24, 30, 60)
    pub resolution: Option<Resolution>,
    pub backgroundColor: Option<String>,
    pub audioSampleRate: Option<u32>,
    pub createdAt: Option<DateTime<Utc>>,
    pub updatedAt: Option<DateTime<Utc>>,
}

/// Résolution vidéo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resolution {
    pub width: u32,
    pub height: u32,
}

/// Table pour stocker les timelines avancées
#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct AdvancedTimelineRow {
    pub id: i32,
    pub timeline_id: String,
    pub user_id: i32,
    pub name: String,
    pub timeline_data: Value, // JSON AdvancedTimeline
    pub duration: f64,
    pub fps: Option<i32>, // ✅ CORRIGÉ: u32 -> i32 pour compatibilité PostgreSQL
    pub resolution_width: Option<i32>, // ✅ CORRIGÉ: u32 -> i32 pour compatibilité PostgreSQL
    pub resolution_height: Option<i32>, // ✅ CORRIGÉ: u32 -> i32 pour compatibilité PostgreSQL
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Requête pour créer/mettre à jour une timeline
#[derive(Debug, Deserialize)]
pub struct AdvancedTimelineRequest {
    pub name: String,
    pub timeline: AdvancedTimeline,
}

/// Réponse avec timeline
#[derive(Debug, Serialize)]
pub struct AdvancedTimelineResponse {
    pub success: bool,
    pub timeline: AdvancedTimelineRow,
    pub message: Option<String>,
}

