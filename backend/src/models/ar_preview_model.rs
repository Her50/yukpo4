// ✅ NOUVEAU Phase 3.2: Modèle pour preview AR/VR

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ARScene3D {
    pub scene_id: String,
    pub position: Vector3,
    pub rotation: Vector3,
    pub scale: Vector3,
    pub clips: Vec<ARClip3D>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ARClip3D {
    pub clip_id: String,
    pub video_url: String,
    pub position: Vector3,
    pub rotation: Vector3,
    pub scale: Vector3,
    pub start_time: f32,
    pub duration: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vector3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ARPreviewRequest {
    pub timeline_id: String,
    pub viewport_width: u32,
    pub viewport_height: u32,
    pub camera_position: Vector3,
    pub camera_rotation: Vector3,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ARPreviewResponse {
    pub preview_url: String,
    pub thumbnail_url: String,
    pub scene_data: ARScene3D,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ARTrackingState {
    pub is_tracking: bool,
    pub tracking_quality: f32, // 0.0 - 1.0
    pub camera_position: Vector3,
    pub camera_rotation: Vector3,
    pub detected_planes: Vec<ARPlane>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ARPlane {
    pub plane_id: String,
    pub center: Vector3,
    pub normal: Vector3,
    pub extent: Vector2,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vector2 {
    pub x: f32,
    pub y: f32,
}
