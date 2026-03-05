// ✅ NOUVEAU Phase 3.1: Modèle pour génération vidéo complète depuis texte

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GenerativeProvider {
    Runway,
    Pika,
    Sora,
    StableVideoDiffusion,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryboardScene {
    pub scene_number: u32,
    pub description: String,
    pub duration_seconds: f32,
    pub visual_style: Option<String>,
    pub camera_movement: Option<String>,
    pub mood: Option<String>,
    pub prompt: String, // Prompt optimisé pour la génération
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Storyboard {
    pub total_duration: f32,
    pub scenes: Vec<StoryboardScene>,
    pub style_guide: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateVideoRequest {
    pub description: String,
    pub duration_seconds: Option<f64>, // Durée cible (défaut: 30s)
    pub style: Option<String>,
    pub mood: Option<String>,
    pub aspect_ratio: Option<String>, // "16:9", "9:16", "1:1", etc.
    pub provider: Option<GenerativeProvider>,
    pub music_style: Option<String>,
    pub resolution: Option<String>, // "720p", "1080p", "4k"
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GenerativeJobStatus {
    Queued,
    GeneratingStoryboard,
    GeneratingClips,
    Assembling,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerativeJobProgress {
    pub progress: f32, // 0-100
    pub stage: GenerativeJobStatus,
    pub current_scene: Option<u32>,
    pub total_scenes: Option<u32>,
    pub message: Option<String>,
    pub estimated_time_remaining: Option<u64>, // seconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedClip {
    pub scene_number: u32,
    pub provider: GenerativeProvider,
    pub video_url: String,
    pub local_path: Option<String>,
    pub duration_seconds: f32,
    pub thumbnail_url: Option<String>,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerativeJob {
    pub job_id: String,
    pub user_id: i64,
    pub request: GenerateVideoRequest,
    pub status: GenerativeJobStatus,
    pub progress: GenerativeJobProgress,
    pub storyboard: Option<Storyboard>,
    pub generated_clips: Vec<GeneratedClip>,
    pub final_video_url: Option<String>,
    pub final_timeline_id: Option<String>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateVideoResponse {
    pub success: bool,
    pub job_id: String,
    pub message: Option<String>,
    pub estimated_time_seconds: Option<u64>,
}
