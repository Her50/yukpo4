// ?? src/services/multimodal_optimizer.rs
// Service d'optimisation des donn?es multimodales pour APIs IA

use base64::{engine::general_purpose, Engine as _};
use serde_json::{json, Value};
use crate::core::types::AppResult;

/// Configuration optimis?e pour chaque API IA
#[derive(Debug, Clone)]
pub struct MultimodalConfig {
    pub max_image_size: u32,
    pub image_quality: u8,
    pub max_pdf_pages: usize,
    pub text_chunk_size: usize,
    pub enable_ocr: bool,
    pub enable_preprocessing: bool,
}

impl Default for MultimodalConfig {
    fn default() -> Self {
        Self {
            max_image_size: 2048,    // OpenAI recommande 2048x2048 max
            image_quality: 85,       // Balance qualit?/taille
            max_pdf_pages: 10,       // Limiter pour ?viter dilution
            text_chunk_size: 4000,   // Chunks optimaux pour contexte
            enable_ocr: true,
            enable_preprocessing: true,
        }
    }
}

pub struct MultimodalOptimizer {
    _config: MultimodalConfig,
}

impl MultimodalOptimizer {
    pub fn new(_config: MultimodalConfig) -> Self {
        Self { _config }
    }

    /// ??? Optimisation Images pour Vision APIs
    pub async fn optimize_image(&self, image_data: &[u8], _format: &str) -> AppResult<OptimizedMedia> {
        let metadata = json!({
            "original_size": image_data.len(),
            "format": _format,
            "optimization": "basic_base64"
        });

        Ok(OptimizedMedia {
            data: general_purpose::STANDARD.encode(image_data),
            media_type: "image".to_string(),
            size: image_data.len(),
            metadata,
            extracted_text: String::new(),
            optimization_notes: "Image encod?e en base64".to_string(),
        })
    }

    /// ?? Optimisation PDF basique
    pub async fn optimize_pdf(&self, pdf_data: &[u8]) -> AppResult<OptimizedMedia> {
        let metadata = json!({
            "size": pdf_data.len(),
            "text_length": 0,
            "type": "pdf"
        });

        Ok(OptimizedMedia {
            data: general_purpose::STANDARD.encode(pdf_data),
            media_type: "pdf".to_string(),
            size: pdf_data.len(),
            metadata,
            extracted_text: "PDF - extraction de texte non impl?ment?e".to_string(),
            optimization_notes: "PDF encod? en base64".to_string(),
        })
    }

    /// ?? Optimisation Excel/CSV basique
    pub async fn optimize_spreadsheet(&self, data: &[u8], format: &str) -> AppResult<OptimizedMedia> {
        let content = String::from_utf8_lossy(data);
        
        let metadata = json!({
            "size": data.len(),
            "format": format,
            "type": "spreadsheet"
        });

        Ok(OptimizedMedia {
            data: general_purpose::STANDARD.encode(data),
            media_type: "spreadsheet".to_string(),
            size: data.len(),
            metadata,
            extracted_text: content.to_string(),
            optimization_notes: "Donn?es de feuille de calcul encod?es".to_string(),
        })
    }

    /// ?? Optimisation Audio basique
    pub async fn optimize_audio(&self, audio_data: &[u8], _format: &str) -> AppResult<OptimizedMedia> {
        let metadata = json!({
            "size": audio_data.len(),
            "type": "audio"
        });

        Ok(OptimizedMedia {
            data: general_purpose::STANDARD.encode(audio_data),
            media_type: "audio".to_string(),
            size: audio_data.len(),
            metadata,
            extracted_text: String::new(),
            optimization_notes: "Audio encod? en base64".to_string(),
        })
    }

    /// ?? Pr?paration sp?cialis?e pour OpenAI Vision API
    pub async fn prepare_for_openai_vision(&self, media: &OptimizedMedia) -> AppResult<Value> {
        match media.media_type.as_str() {
            "image" => {
                Ok(json!({
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:image/jpeg;base64,{}", media.data),
                        "detail": "high"
                    }
                }))
            },
            "pdf" => {
                Ok(json!({
                    "type": "text",
                    "text": format!(
                        "Document PDF analys?:\n\nM?tadonn?es: {}\n\nContenu extrait:\n{}",
                        serde_json::to_string_pretty(&media.metadata).unwrap_or_default(),
                        self.truncate_text(&media.extracted_text, 8000)
                    )
                }))
            },
            _ => Err("Type de m?dia non support? pour OpenAI Vision".into())
        }
    }

    /// ?? Pr?paration pour Google Gemini
    pub async fn prepare_for_gemini(&self, media: &OptimizedMedia) -> AppResult<Value> {
        match media.media_type.as_str() {
            "image" => {
                Ok(json!({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": media.data
                    }
                }))
            },
            _ => {
                Ok(json!({
                    "text": format!(
                        "Document: {}\nM?tadonn?es: {}\nContenu: {}",
                        media.media_type,
                        media.metadata,
                        self.truncate_text(&media.extracted_text, 6000)
                    )
                }))
            }
        }
    }

    /// ?? Pr?paration pour Claude (Anthropic)
    pub async fn prepare_for_claude(&self, media: &OptimizedMedia) -> AppResult<Value> {
        match media.media_type.as_str() {
            "image" => {
                Ok(json!({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": media.data
                    }
                }))
            },
            _ => {
                Ok(json!({
                    "type": "text",
                    "text": format!(
                        "Analyse de document:\n{}\n\nContenu extrait:\n{}",
                        media.metadata,
                        self.truncate_text(&media.extracted_text, 10000)
                    )
                }))
            }
        }
    }

    fn truncate_text(&self, text: &str, max_length: usize) -> String {
        if text.len() <= max_length {
            text.to_string()
        } else {
            format!("{}...\n\n[Texte tronqu? - {} caract?res total]", 
                   &text[..max_length], text.len())
        }
    }
}

#[derive(Debug, Clone)]
pub struct OptimizedMedia {
    pub data: String,           // Base64 optimis?
    pub media_type: String,     // Type de m?dia
    pub size: usize,           // Taille en bytes
    pub metadata: Value,       // M?tadonn?es extraites
    pub extracted_text: String, // Texte extrait
    pub optimization_notes: String, // Notes d'optimisation
}

/// Factory pour cr?er des optimiseurs selon l'API cible
pub struct OptimizerFactory;

impl OptimizerFactory {
    pub fn for_openai() -> MultimodalOptimizer {
        MultimodalOptimizer::new(MultimodalConfig {
            max_image_size: 2048,  // OpenAI Vision limite
            image_quality: 90,     // Haute qualit? pour analyse
            max_pdf_pages: 15,
            text_chunk_size: 4000,
            enable_ocr: true,
            enable_preprocessing: true,
        })
    }

    pub fn for_gemini() -> MultimodalOptimizer {
        MultimodalOptimizer::new(MultimodalConfig {
            max_image_size: 3072,  // Gemini supporte plus grand
            image_quality: 85,
            max_pdf_pages: 20,
            text_chunk_size: 6000,
            enable_ocr: true,
            enable_preprocessing: true,
        })
    }

    pub fn for_claude() -> MultimodalOptimizer {
        MultimodalOptimizer::new(MultimodalConfig {
            max_image_size: 1568,  // Claude limite plus stricte
            image_quality: 95,     // Tr?s haute qualit?
            max_pdf_pages: 10,
            text_chunk_size: 8000, // Claude g?re bien le long contexte
            enable_ocr: true,
            enable_preprocessing: true,
        })
    }
} 
