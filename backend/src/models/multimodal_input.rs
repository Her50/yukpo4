use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct MultiModalInput {
    pub texte: Option<String>,
    pub base64_image: Option<String>,
    pub audio_base64: Option<String>,
    pub video_base64: Option<String>,
    pub doc_base64: Option<String>,
    pub longitude: Option<f64>,
    pub latitude: Option<f64>,
    pub intention: Option<String>,
    pub timestamp: Option<i64>,
} 
