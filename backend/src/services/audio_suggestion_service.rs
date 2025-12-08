// ✅ NOUVEAU: Service de suggestions audio contextuelles

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use log::info;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSuggestionRequest {
    pub product_name: String,
    pub product_type: Option<String>,
    pub tone: Option<String>, // "energetic", "calm", "dramatic", "romantic"
    pub channel: Option<String>, // "tiktok", "instagram", "youtube"
    pub duration_seconds: Option<f64>,
    pub count: Option<usize>, // défaut: 15
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSuggestion {
    pub track_id: String,
    pub title: String,
    pub genre: String,
    pub mood: String,
    pub bpm: f64,
    pub preview_url: String,
    pub full_url: Option<String>,
    pub relevance_score: f64, // 0.0-1.0
    pub description: String,
    pub duration_seconds: Option<f64>,
    pub license: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSuggestionResponse {
    pub success: bool,
    pub suggestions: Vec<AudioSuggestion>,
    pub context_analysis: AudioContextAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioContextAnalysis {
    pub recommended_genre: String,
    pub recommended_mood: String,
    pub recommended_bpm_range: (f64, f64),
    pub reasoning: String,
}

/// Génère des suggestions audio contextuelles basées sur le produit et le contexte
pub async fn suggest_audio_tracks(
    app_ia: &AppIA,
    request: AudioSuggestionRequest,
) -> AppResult<AudioSuggestionResponse> {
    info!(
        "[AudioSuggestion] Génération suggestions - produit: {}, count: {:?}",
        request.product_name, request.count
    );

    let count = request.count.unwrap_or(15).min(20);
    let tone = request.tone.as_deref().unwrap_or("energetic");
    let channel = request.channel.as_deref().unwrap_or("tiktok");

    // Analyser le contexte avec l'IA pour déterminer le genre/mood optimal
    let context_prompt = format!(
        "Pour un produit '{}' de type '{}', canal '{}', ton '{}', suggère le genre musical, mood et BPM optimal.
Réponds en JSON: {{\"genre\": \"...\", \"mood\": \"...\", \"bpm_min\": 90, \"bpm_max\": 140, \"reasoning\": \"...\"}}",
        request.product_name,
        request.product_type.as_deref().unwrap_or("générique"),
        channel,
        tone
    );

    let context_analysis = match app_ia.predict(&context_prompt).await {
        Ok((_, response, _)) => {
            // Parser la réponse IA
            parse_context_analysis(&response).unwrap_or_else(|| {
                // Fallback basé sur le ton
                get_default_context_analysis(tone, channel)
            })
        }
        Err(_) => get_default_context_analysis(tone, channel),
    };

    // Générer des suggestions basées sur l'analyse
    let suggestions = generate_suggestions_from_context(&context_analysis, count, &request).await?;

    Ok(AudioSuggestionResponse {
        success: true,
        suggestions,
        context_analysis,
    })
}

/// Parse l'analyse de contexte depuis la réponse IA
fn parse_context_analysis(response: &str) -> Option<AudioContextAnalysis> {
    // Extraire JSON de la réponse
    let json_start = response.find('{')?;
    let json_end = response.rfind('}')? + 1;
    let json_str = &response[json_start..json_end];

    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
        Some(AudioContextAnalysis {
            recommended_genre: parsed["genre"].as_str()?.to_string(),
            recommended_mood: parsed["mood"].as_str()?.to_string(),
            recommended_bpm_range: (parsed["bpm_min"].as_f64()?, parsed["bpm_max"].as_f64()?),
            reasoning: parsed["reasoning"].as_str()?.to_string(),
        })
    } else {
        None
    }
}

/// Génère des suggestions par défaut basées sur le ton
fn get_default_context_analysis(tone: &str, channel: &str) -> AudioContextAnalysis {
    let (genre, mood, bpm_min, bpm_max, reasoning) = match tone {
        "energetic" => (
            "Electronic".to_string(),
            "Energetic".to_string(),
            120.0,
            140.0,
            format!("Musique électronique énergique pour canal {} - BPM élevé pour captiver l'attention", channel),
        ),
        "calm" => (
            "Ambient".to_string(),
            "Calm".to_string(),
            70.0,
            90.0,
            format!("Ambiance calme pour canal {} - BPM doux pour détente", channel),
        ),
        "dramatic" => (
            "Cinematic".to_string(),
            "Dramatic".to_string(),
            80.0,
            100.0,
            format!("Musique cinématique dramatique pour canal {} - Ambiance immersive", channel),
        ),
        "romantic" => (
            "Jazz".to_string(),
            "Romantic".to_string(),
            60.0,
            80.0,
            format!("Jazz romantique pour canal {} - Ambiance douce et intime", channel),
        ),
        _ => (
            "Pop".to_string(),
            "Neutral".to_string(),
            100.0,
            120.0,
            format!("Pop neutre pour canal {} - BPM moyen polyvalent", channel),
        ),
    };

    AudioContextAnalysis {
        recommended_genre: genre,
        recommended_mood: mood,
        recommended_bpm_range: (bpm_min, bpm_max),
        reasoning,
    }
}

/// Génère des suggestions audio basées sur le contexte
async fn generate_suggestions_from_context(
    context: &AudioContextAnalysis,
    count: usize,
    request: &AudioSuggestionRequest,
) -> AppResult<Vec<AudioSuggestion>> {
    // TODO: Intégrer avec une vraie bibliothèque audio
    // Pour l'instant, générer des suggestions simulées basées sur le contexte

    let mut suggestions = Vec::new();
    let bpm_range = context.recommended_bpm_range;
    let bpm_step = (bpm_range.1 - bpm_range.0) / count as f64;

    for i in 0..count {
        let bpm = bpm_range.0 + (i as f64 * bpm_step);
        let relevance = 1.0 - (i as f64 * 0.05); // Décroissance de pertinence

        suggestions.push(AudioSuggestion {
            track_id: format!(
                "suggested_{}_{}",
                context.recommended_genre.to_lowercase(),
                i
            ),
            title: format!("{} Track {}", context.recommended_genre, i + 1),
            genre: context.recommended_genre.clone(),
            mood: context.recommended_mood.clone(),
            bpm,
            preview_url: format!(
                "https://audio-library.example.com/preview/{}_{}.mp3",
                context.recommended_genre.to_lowercase(),
                i
            ),
            full_url: None,
            relevance_score: relevance.max(0.5),
            description: format!(
                "{} {} - {} BPM - Parfait pour {}",
                context.recommended_genre,
                context.recommended_mood,
                bpm as u32,
                request.product_name
            ),
            duration_seconds: request.duration_seconds,
            license: "Royalty-free".to_string(),
        });
    }

    info!(
        "[AudioSuggestion] ✅ {} suggestions générées",
        suggestions.len()
    );
    Ok(suggestions)
}
