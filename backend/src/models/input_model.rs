// ?? src/models/input_model.rs

use serde::{Deserialize, Serialize};

/// ?? Entr?e multimodale utilis?e pour les requ?tes IA Yukpo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileData {
    pub file_name: String,
    pub data: String, // base64 data
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiModalInput {
    /// Texte libre soumis par l'utilisateur
    pub texte: Option<String>,

    /// Images encod?es en base64 (accepte strings ou objets FileData)
    #[serde(default)]
    pub base64_image: Option<Vec<String>>,

    /// Audios encod?s en base64 (multiple)
    #[serde(default)]
    pub audio_base64: Option<Vec<String>>,

    /// Vid?os encod?es en base64 (multiple)
    #[serde(default)]
    pub video_base64: Option<Vec<String>>,

    /// Documents PDF/Word encod?s
    #[serde(default)]
    pub doc_base64: Option<Vec<String>>,

    /// Feuilles Excel encod?es (multiple)
    #[serde(default)]
    pub excel_base64: Option<Vec<String>>,

    /// Lien vers un site web
    pub site_web: Option<String>,

    /// Coordonn?es GPS mobiles
    pub gps_mobile: Option<String>,
}

// ? ? placer dans: src/models/input_model.rs
