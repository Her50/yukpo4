// ✅ NOUVEAU Phase 2.2: Modèle pour bibliothèque audio étendue

use serde::{Deserialize, Serialize};

/// Métadonnées audio enrichies (format unifié)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioMetadata {
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub genre: Option<String>,
    pub mood: Option<String>,
    pub bpm: Option<u16>,
    pub duration_ms: u32,
    pub preview_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub license: String,
    pub source: String, // "spotify", "youtube", "epidemic"
    pub popularity_score: f64,
}

/// Paramètres de recherche audio
#[derive(Debug, Deserialize)]
pub struct AudioSearchParams {
    pub q: Option<String>,
    pub genre: Option<String>,
    pub mood: Option<String>,
    pub bpm_min: Option<u16>,
    pub bpm_max: Option<u16>,
    pub license: Option<String>,
    pub source: Option<String>, // "spotify", "youtube", "all"
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Réponse de recherche audio
#[derive(Debug, Serialize)]
pub struct AudioSearchResponse {
    pub success: bool,
    pub tracks: Vec<AudioMetadata>,
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
}

