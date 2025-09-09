// ? src/services/ocr_engine.rs

use crate::services::app_ia::AppIA;
use crate::core::types::AppResult; // ? chemin corrig?
use crate::utils::log::{log_info, log_warn}; // ? ? condition que ce module existe

/// ?? Analyse OCR automatis?e sur base de PDF encod?s en base64
pub async fn analyser_pdf_base64(app_ia: &AppIA, fichiers: &[String]) -> AppResult<String> {
    if fichiers.is_empty() {
        log_warn("Aucun fichier PDF ? traiter pour l'OCR.");
        return Ok("".to_string());
    }

    log_info(&format!(
        "Lancement OCR sur {} fichier(s) PDF?",
        fichiers.len()
    ));

    let prompt = format!(
        "Tu es une IA OCR. Extrait lisiblement le texte des fichiers PDF suivants :\n{}",
        fichiers.join("\n\n")
    );

    let (_, ocr_result, _tokens) = app_ia.predict(&prompt).await?;
    Ok(ocr_result)
}

/// ?? Logging utilitaire si des fichiers sont rejet?s pour cause de taille
pub fn log_rejet_taille(nom: &str, taille: usize, limite: usize) {
    eprintln!(
        "?? Fichier rejet?: {} ({} octets > limite de {} octets)",
        nom, taille, limite
    );
}

/// OCR sur une image base64 (mock, ? remplacer par un vrai OCR)
pub async fn ocr_image_base64(base64: &str) -> Option<String> {
    // Appel ? l'API FastAPI Python locale
    let client = reqwest::Client::new();
    let url = "http://localhost:8000/ocr_image";
    
    // Envoyer les param?tres comme query parameters avec la cl? API
    let params = [("b64", base64), ("lang", "eng")];
    
    match client.post(url)
        .header("x-api-key", "yukpo_embedding_key_2024")  // Cl? API requise par le microservice Python
        .form(&params)
        .send()
        .await 
    {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(val) => val.get("text").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    Err(e) => {
                        log::warn!("[OCR] Erreur parsing r?ponse: {}", e);
                        None
                    }
                }
            } else {
                log::warn!("[OCR] Erreur HTTP: {}", resp.status());
                None
            }
        },
        Err(e) => {
            log::warn!("[OCR] Erreur connexion: {}", e);
            None
        }
    }
}
