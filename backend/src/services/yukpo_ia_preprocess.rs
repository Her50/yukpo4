//! Prétraitement des pièces jointes YukpoIA avant l’appel au modèle chat :
//! - **audio** + `data_base64` → transcription **Whisper** (OpenAI) si pas de `transcript` utile
//! - **file** + `data_base64` → texte extrait (PDF / xlsx / docx / texte) via `file_extractor`
//! - Après transcription réussie : **une facturation** par fichier audio (`yukpo_ia_whisper`), même logique quota/solde que le chat.

use base64::Engine;
use log::warn;
use reqwest::multipart;
use serde_json::json;
use sqlx::PgPool;

use crate::services::file_extractor::extract_text_from_base64;
use crate::services::yukpo_ia_billing::{self, whisper_app_charge_units};
use crate::services::yukpo_openai_outbound;

const MAX_WHISPER_BYTES: usize = 24 * 1024 * 1024;

fn whisper_enabled() -> bool {
    std::env::var("YUKPO_IA_WHISPER_ENABLED")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(true)
}

fn whisper_billing_enabled() -> bool {
    std::env::var("YUKPO_IA_WHISPER_BILLING_ENABLED")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(true)
}

/// Optionnel : code langue ISO 639-1 pour guider Whisper (réduit les erreurs sur une langue fixe).
fn whisper_language_param(user_lang: &str) -> Option<String> {
    let s = user_lang.trim().to_lowercase();
    let code: String = s.chars().take(2).collect();
    if code.len() == 2 && code.chars().all(|c| c.is_ascii_alphabetic()) {
        Some(code)
    } else {
        None
    }
}

async fn transcribe_whisper_openai(
    api_key: &str,
    bytes: &[u8],
    mime: &str,
    original_name: &str,
    user_lang: &str,
) -> Result<String, String> {
    let ext = if original_name.contains('.') {
        original_name.rsplit('.').next().unwrap_or("m4a").to_lowercase()
    } else {
        match mime {
            "audio/wav" | "audio/x-wav" => "wav",
            "audio/mpeg" | "audio/mp3" => "mp3",
            "audio/webm" => "webm",
            "audio/mp4" | "audio/m4a" | "audio/x-m4a" => "m4a",
            _ => "m4a",
        }
        .to_string()
    };
    let safe_name = format!("yukpo_ia_upload.{ext}");
    let model = std::env::var("OPENAI_WHISPER_MODEL").unwrap_or_else(|_| "whisper-1".to_string());
    let bytes_v = bytes.to_vec();
    let mime_s = mime.to_string();
    let lang_opt = whisper_language_param(user_lang);

    let _conc = yukpo_openai_outbound::acquire_concurrency_permit().await;
    let resp = yukpo_openai_outbound::post_audio_transcriptions(api_key, || {
        let part = multipart::Part::bytes(bytes_v.clone())
            .file_name(safe_name.clone())
            .mime_str(&mime_s)
            .expect("mime str");
        let mut form = multipart::Form::new().text("model", model.clone()).part("file", part);
        if let Some(ref lang) = lang_opt {
            form = form.text("language", lang.clone());
        }
        form
    })
    .await
    .map_err(|e| e)?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Whisper HTTP {}: {}",
            status,
            body.chars().take(400).collect::<String>()
        ));
    }

    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(v.get("text").and_then(|t| t.as_str()).unwrap_or("").to_string())
}

/// Remplit `transcript` / `extracted_text` dans `context.yukpo_ia_attachments`.
/// Retourne la somme des unités facturées pour les transcriptions Whisper (pour la réponse `billing`).
pub async fn preprocess_yukpo_ia_attachments(
    pool: &PgPool,
    user_id: i32,
    context: &mut Option<serde_json::Value>,
    user_lang: &str,
) -> i64 {
    let Some(ctx) = context.as_mut() else {
        return 0;
    };
    let Some(arr) = ctx.get_mut("yukpo_ia_attachments").and_then(|v| v.as_array_mut()) else {
        return 0;
    };

    let api_key = yukpo_openai_outbound::resolve_openai_api_key();
    let mut whisper_billed_total: i64 = 0;

    for att in arr.iter_mut() {
        let Some(obj) = att.as_object_mut() else {
            continue;
        };
        let kind = obj.get("kind").and_then(|k| k.as_str()).unwrap_or("");

        if kind == "audio" && whisper_enabled() {
            let has_tr = obj
                .get("transcript")
                .and_then(|t| t.as_str())
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false);
            if has_tr {
                continue;
            }
            let Some(b64) = obj.get("data_base64").and_then(|v| v.as_str()) else {
                continue;
            };
            let bytes = match base64::engine::general_purpose::STANDARD.decode(b64.trim()) {
                Ok(b) => b,
                Err(e) => {
                    warn!("[YukpoIA preprocess] audio base64: {}", e);
                    continue;
                }
            };
            if bytes.is_empty() || bytes.len() > MAX_WHISPER_BYTES {
                warn!(
                    "[YukpoIA preprocess] audio taille invalide: {} octets",
                    bytes.len()
                );
                continue;
            }
            let mime_str: String =
                obj.get("mime").and_then(|m| m.as_str()).unwrap_or("audio/m4a").to_string();
            let name_str: String =
                obj.get("name").and_then(|n| n.as_str()).unwrap_or("audio.m4a").to_string();

            match api_key.as_deref() {
                Some(key) => match transcribe_whisper_openai(
                    key,
                    &bytes,
                    mime_str.as_str(),
                    name_str.as_str(),
                    user_lang,
                )
                .await
                {
                    Ok(text) => {
                        let clip: String = text.chars().take(12_000).collect();
                        obj.insert("transcript".to_string(), json!(clip));
                        if whisper_billing_enabled() && yukpo_ia_billing::is_billing_enabled() {
                            let units = whisper_app_charge_units();
                            match yukpo_ia_billing::debit_yukpo_ia_units(
                                pool,
                                user_id,
                                units,
                                "yukpo_ia_whisper",
                                "YukpoIA — transcription audio",
                                json!({
                                    "component": "whisper_transcription",
                                    "file_hint": name_str,
                                    "mime": mime_str
                                }),
                            )
                            .await
                            {
                                Ok(b) => {
                                    if let Some(tc) =
                                        b.get("tokens_charged").and_then(|v| v.as_i64())
                                    {
                                        whisper_billed_total += tc;
                                    }
                                }
                                Err(e) => {
                                    warn!("[YukpoIA preprocess] facturation Whisper: {}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        warn!("[YukpoIA preprocess] Whisper: {}", e);
                        obj.insert(
                            "transcript".to_string(),
                            json!(format!(
                                "[Transcription indisponible : {}]",
                                e.chars().take(200).collect::<String>()
                            )),
                        );
                    }
                },
                None => {
                    obj.insert(
                        "transcript".to_string(),
                        json!("[Transcription : OPENAI_API_KEY absente]"),
                    );
                }
            }
            continue;
        }

        if kind == "file" {
            let Some(b64) = obj.get("data_base64").and_then(|v| v.as_str()) else {
                continue;
            };
            if b64.len() < 12 {
                continue;
            }
            let name = obj.get("name").and_then(|n| n.as_str()).unwrap_or("file.bin");
            match extract_text_from_base64(b64, name) {
                Ok(t) => {
                    let clip: String = t.chars().take(24_000).collect();
                    if !clip.trim().is_empty() {
                        obj.insert("extracted_text".to_string(), json!(clip));
                    }
                }
                Err(e) => {
                    warn!("[YukpoIA preprocess] extraction fichier {}: {}", name, e);
                }
            }
        }
    }

    whisper_billed_total
}
