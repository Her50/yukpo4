// 🎤 Service de transcription audio
// Utilise OpenAI Whisper API ou une alternative pour transcrire l'audio en texte
// ✅ 2025-12-30: Ajout cache de transcriptions et post-traitement des erreurs

use crate::core::types::{AppError, AppResult};
use crate::utils::log::{log_error, log_info, log_warn};
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;
use md5;

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub language: Option<String>,
    pub confidence: Option<f32>,
    pub duration: Option<f32>,
}

pub struct AudioTranscriptionService;

impl AudioTranscriptionService {
    /// ✅ NOUVEAU 2025-12-30: Transcrire avec cache et post-traitement
    pub async fn transcribe_audio_base64_with_cache(
        pool: &PgPool,
        audio_base64: &str,
    ) -> AppResult<TranscriptionResult> {
        // Calculer hash MD5 de l'audio
        let audio_data = if audio_base64.contains("base64,") {
            audio_base64.split("base64,").nth(1).unwrap_or(audio_base64)
        } else {
            audio_base64
        };

        let audio_bytes = general_purpose::STANDARD.decode(audio_data).map_err(|e| {
            log_error(&format!("[AudioTranscription] Erreur décodage base64: {}", e));
            AppError::Internal(format!("Erreur décodage audio: {}", e))
        })?;

        let audio_hash = format!("{:x}", md5::compute(&audio_bytes));

        log_info(&format!("[AudioTranscription] Hash audio: {}", audio_hash));

        // Vérifier le cache
        let cached_result = sqlx::query_as::<_, (String, Option<String>, Option<f32>, Option<f32>)>(
            r#"
            SELECT transcribed_text, language, confidence, duration
            FROM audio_transcription_cache
            WHERE audio_hash = $1
            "#,
        )
        .bind(&audio_hash)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            log_error(&format!("[AudioTranscription] Erreur cache: {}", e));
            AppError::Internal(format!("Erreur cache: {}", e))
        })?;

        if let Some((cached_text, cached_lang, cached_conf, cached_dur)) = cached_result {
            log_info("[AudioTranscription] ✅ Transcription trouvée dans le cache");

            // Mettre à jour last_used_at et usage_count
            let _ = sqlx::query(
                r#"
                UPDATE audio_transcription_cache
                SET last_used_at = NOW(), usage_count = usage_count + 1
                WHERE audio_hash = $1
                "#,
            )
            .bind(&audio_hash)
            .execute(pool)
            .await;

            // Appliquer corrections via fonction PostgreSQL
            let corrected_text = sqlx::query_scalar::<_, String>(
                "SELECT correct_transcription_errors($1)"
            )
            .bind(&cached_text)
            .fetch_one(pool)
            .await
            .unwrap_or(cached_text);

            return Ok(TranscriptionResult {
                text: corrected_text,
                language: cached_lang,
                confidence: cached_conf,
                duration: cached_dur,
            });
        }

        // Pas dans le cache : transcrire
        log_info("[AudioTranscription] Transcription non trouvée dans cache, appel API...");
        let result = Self::transcribe_audio_base64(audio_base64).await?;

        // Sauvegarder dans le cache
        let _ = sqlx::query(
            r#"
            INSERT INTO audio_transcription_cache (
                audio_hash, transcribed_text, language, confidence, duration, model_used
            ) VALUES ($1, $2, $3, $4, $5, 'whisper-1')
            ON CONFLICT (audio_hash) DO UPDATE SET
                last_used_at = NOW(),
                usage_count = audio_transcription_cache.usage_count + 1
            "#,
        )
        .bind(&audio_hash)
        .bind(&result.text)
        .bind(&result.language)
        .bind(&result.confidence)
        .bind(&result.duration)
        .execute(pool)
        .await;

        // Appliquer corrections
        let corrected_text = sqlx::query_scalar::<_, String>(
            "SELECT correct_transcription_errors($1)"
        )
        .bind(&result.text)
        .fetch_one(pool)
        .await
        .unwrap_or(result.text);

        Ok(TranscriptionResult {
            text: corrected_text,
            language: result.language,
            confidence: result.confidence,
            duration: result.duration,
        })
    }

    /// Transcrire un audio base64 en texte en utilisant OpenAI Whisper (sans cache)
    pub async fn transcribe_audio_base64(audio_base64: &str) -> AppResult<TranscriptionResult> {
        log_info(&format!(
            "[AudioTranscription] Début transcription audio ({} caractères)",
            audio_base64.len()
        ));

        // Décoder le base64
        let audio_data = if audio_base64.contains("base64,") {
            audio_base64.split("base64,").nth(1).unwrap_or(audio_base64)
        } else {
            audio_base64
        };

        let audio_bytes = general_purpose::STANDARD.decode(audio_data).map_err(|e| {
            log_error(&format!(
                "[AudioTranscription] Erreur décodage base64: {}",
                e
            ));
            AppError::Internal(format!("Erreur décodage audio: {}", e))
        })?;

        log_info(&format!(
            "[AudioTranscription] Audio décodé: {} octets",
            audio_bytes.len()
        ));

        // Vérifier si on a une clé API OpenAI
        let api_key = env::var("OPENAI_API_KEY").ok();

        if api_key.is_none() || api_key.as_ref().unwrap().is_empty() {
            log_warn("[AudioTranscription] OPENAI_API_KEY non configurée, retour texte par défaut");
            return Ok(TranscriptionResult {
                text: "[Audio non transcrit - API non configurée]".to_string(),
                language: Some("fr".to_string()),
                confidence: Some(0.0),
                duration: None,
            });
        }

        // Utiliser OpenAI Whisper API
        match Self::transcribe_with_whisper(&audio_bytes, &api_key.unwrap()).await {
            Ok(result) => {
                log_info(&format!(
                    "[AudioTranscription] ✅ Transcription réussie: '{}' ({})",
                    &result.text.chars().take(100).collect::<String>(),
                    result.language.as_ref().unwrap_or(&"unknown".to_string())
                ));
                Ok(result)
            }
            Err(e) => {
                log_error(&format!(
                    "[AudioTranscription] Erreur transcription: {:?}",
                    e
                ));
                // Fallback: retourner un message d'erreur
                Ok(TranscriptionResult {
                    text: format!("[Erreur transcription audio: {}]", e),
                    language: Some("fr".to_string()),
                    confidence: Some(0.0),
                    duration: None,
                })
            }
        }
    }

    /// Transcrire avec OpenAI Whisper API
    async fn transcribe_with_whisper(
        audio_bytes: &[u8],
        api_key: &str,
    ) -> AppResult<TranscriptionResult> {
        let client = reqwest::Client::new();

        // Créer un fichier temporaire pour l'audio (Whisper nécessite un fichier)
        let file_part = reqwest::multipart::Part::bytes(audio_bytes.to_vec())
            .file_name("audio.m4a")
            .mime_str("audio/m4a")
            .map_err(|e| AppError::Internal(format!("Erreur création multipart: {}", e)))?;

        let form = reqwest::multipart::Form::new()
            .part("file", file_part)
            .text("model", "whisper-1")
            .text("language", "fr") // Français par défaut, mais Whisper détecte automatiquement
            .text("response_format", "verbose_json"); // Format détaillé avec métadonnées

        let response = client
            .post("https://api.openai.com/v1/audio/transcriptions")
            .header("Authorization", format!("Bearer {}", api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| {
                log_error(&format!(
                    "[AudioTranscription] Erreur requête Whisper: {}",
                    e
                ));
                AppError::Internal(format!("Erreur requête Whisper: {}", e))
            })?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            log_error(&format!(
                "[AudioTranscription] Erreur Whisper API: {}",
                error_text
            ));
            return Err(AppError::Internal(format!(
                "Erreur Whisper API: {}",
                error_text
            )));
        }

        let whisper_response: serde_json::Value = response.json().await.map_err(|e| {
            log_error(&format!(
                "[AudioTranscription] Erreur parsing réponse: {}",
                e
            ));
            AppError::Internal(format!("Erreur parsing réponse: {}", e))
        })?;

        // Extraire le texte et les métadonnées
        let text = whisper_response["text"].as_str().unwrap_or("").to_string();
        let language = whisper_response["language"].as_str().map(|s| s.to_string());
        let duration = whisper_response["duration"].as_f64().map(|d| d as f32);

        Ok(TranscriptionResult {
            text,
            language,
            confidence: Some(1.0), // Whisper ne fournit pas de score de confiance global
            duration,
        })
    }

    /// Transcrire audio et détecter l'intention
    pub async fn transcribe_and_detect_intent(
        audio_base64: &str,
    ) -> AppResult<(String, Option<String>)> {
        let result = Self::transcribe_audio_base64(audio_base64).await?;

        // Détecter l'intention basique du texte transcrit
        let intent = Self::detect_basic_intent(&result.text);

        Ok((result.text, intent))
    }

    /// Détection d'intention basique sur le texte transcrit
    fn detect_basic_intent(text: &str) -> Option<String> {
        let text_lower = text.to_lowercase();

        if text_lower.contains("cherche") || text_lower.contains("besoin") {
            Some("recherche".to_string())
        } else if text_lower.contains("vend") || text_lower.contains("propose") {
            Some("creation".to_string())
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intent_detection() {
        assert_eq!(
            AudioTranscriptionService::detect_basic_intent("Je cherche un appartement"),
            Some("recherche".to_string())
        );
        assert_eq!(
            AudioTranscriptionService::detect_basic_intent("Je vends une voiture"),
            Some("creation".to_string())
        );
    }
}
