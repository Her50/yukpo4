// ✅ Service Document AI — Vérification automatique CNI + selfie via Google Cloud Vision API
// Utilise GOOGLE_VISION_API_KEY (fallback sur GOOGLE_MAPS_API_KEY)
// Endpoint REST : https://vision.googleapis.com/v1/images:annotate

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const VISION_API_URL: &str = "https://vision.googleapis.com/v1/images:annotate";

/// Résultat complet de l'analyse KYC par IA
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KycAnalysisResult {
    /// Score global 0-100
    pub score: u8,
    /// Décision : "approved" | "under_review" | "rejected"
    pub decision: String,
    /// Nom extrait par OCR depuis la CNI
    pub extracted_name: Option<String>,
    /// Numéro de CNI extrait par OCR
    pub extracted_id_number: Option<String>,
    /// CNI recto contient bien les mentions d'une CNI camerounaise
    pub cni_front_valid: bool,
    /// CNI verso contient des données cohérentes
    pub cni_back_valid: bool,
    /// Un visage est détecté sur le selfie
    pub selfie_has_face: bool,
    /// Un visage est détecté sur le CNI recto
    pub cni_has_face: bool,
    /// Détails lisibles pour l'affichage mobile
    pub details: Vec<String>,
}

pub struct DocumentAiService {
    client: Client,
    api_key: String,
}

impl DocumentAiService {
    pub fn new() -> Self {
        let api_key = std::env::var("GOOGLE_VISION_API_KEY")
            .or_else(|_| std::env::var("GOOGLE_MAPS_API_KEY"))
            .unwrap_or_default();
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(20))
                .build()
                .unwrap_or_else(|_| Client::new()),
            api_key,
        }
    }

    /// Retourne true si l'analyse IA est activée (KYC_PROVIDER != "manual" + clé API présente)
    pub fn is_enabled(&self) -> bool {
        let provider = std::env::var("KYC_PROVIDER").unwrap_or_else(|_| "manual".to_string());
        provider != "manual" && !self.api_key.is_empty()
    }

    /// Appel REST Google Vision API avec une image en base64
    async fn call_vision_api(&self, base64_image: &str) -> Result<Value, String> {
        let url = format!("{}?key={}", VISION_API_URL, self.api_key);
        let body = json!({
            "requests": [{
                "image": { "content": base64_image },
                "features": [
                    { "type": "DOCUMENT_TEXT_DETECTION" },
                    { "type": "FACE_DETECTION", "maxResults": 3 }
                ]
            }]
        });

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Vision API réseau: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();
            let preview = &body_text[..body_text.len().min(300)];
            return Err(format!("Vision API HTTP {}: {}", status, preview));
        }

        resp.json::<Value>().await.map_err(|e| format!("Vision API parse JSON: {}", e))
    }

    /// Analyse une image : retourne (texte OCR en majuscules, visage_détecté, confiance_visage)
    async fn analyze_image(&self, base64_image: &str) -> (String, bool, f64) {
        match self.call_vision_api(base64_image).await {
            Ok(json) => {
                let text = json["responses"][0]["fullTextAnnotation"]["text"]
                    .as_str()
                    .unwrap_or("")
                    .to_uppercase();

                let best_conf = json["responses"][0]["faceAnnotations"]
                    .as_array()
                    .and_then(|faces| faces.first())
                    .and_then(|f| f["detectionConfidence"].as_f64())
                    .unwrap_or(0.0);

                let has_face = best_conf > 0.70;
                (text, has_face, best_conf)
            }
            Err(e) => {
                log::warn!("[DocumentAI] Vision API erreur: {}", e);
                (String::new(), false, 0.0)
            }
        }
    }

    /// Vérifie si le texte correspond à une CNI camerounaise
    /// Retourne (valide, nom_extrait, numéro_extrait)
    fn parse_cameroon_cni(text: &str) -> (bool, Option<String>, Option<String>) {
        let is_cameroon = text.contains("CAMEROUN") || text.contains("CAMEROON");
        let is_id_doc = text.contains("IDENTIT") // "IDENTITE" ou "IDENTITY"
            || text.contains("CARTE NATIONALE")
            || text.contains("NATIONAL CARD")
            || text.contains("CNI");

        // Numéro CNI : séquence de 6 à 12 chiffres
        let id_number = text.split_whitespace().find_map(|w| {
            let clean: String = w.chars().filter(|c| c.is_ascii_digit()).collect();
            if clean.len() >= 6 && clean.len() <= 12 && clean.len() == w.len() {
                Some(clean)
            } else {
                None
            }
        });

        // Nom : ligne suivant "NOM", "SURNAME" ou "LAST NAME"
        let extracted_name = extract_field_after(text, &["NOM", "SURNAME", "LAST NAME", "PRENOM"]);

        (is_cameroon && is_id_doc, extracted_name, id_number)
    }

    /// Analyse KYC complète : CNI recto + verso + selfie
    /// Score max = 100 (40 + 15 + 30 + 15)
    pub async fn analyze_kyc(
        &self,
        cni_front_base64: &str,
        cni_back_base64: &str,
        selfie_base64: &str,
    ) -> KycAnalysisResult {
        let mut score: u8 = 0;
        let mut details: Vec<String> = Vec::new();

        // ── CNI Recto (max 55 pts) ────────────────────────────────────────────
        let (front_text, cni_has_face, _front_face_conf) =
            self.analyze_image(cni_front_base64).await;
        let (front_valid, extracted_name, extracted_id) = Self::parse_cameroon_cni(&front_text);

        if front_valid {
            score = score.saturating_add(40);
            details.push("✅ CNI recto : document camerounais authentifié".to_string());
        } else if !front_text.is_empty() {
            score = score.saturating_add(15);
            details
                .push("⚠️ CNI recto lisible mais non identifié comme CNI camerounaise".to_string());
        } else {
            details.push("❌ CNI recto : image illisible ou vide".to_string());
        }

        if cni_has_face {
            score = score.saturating_add(15);
            details.push("✅ Visage détecté sur le CNI recto".to_string());
        } else {
            details.push("⚠️ Aucun visage détecté sur le CNI recto".to_string());
        }

        // ── CNI Verso (max 30 pts) ────────────────────────────────────────────
        let (back_text, _, _) = self.analyze_image(cni_back_base64).await;
        let back_valid = !back_text.is_empty()
            && (back_text.contains("CAMEROUN")
                || back_text.contains("CAMEROON")
                || back_text.contains("NATIONAL")
                || back_text.contains("IDENTIT")
                || back_text.contains("REPUBLIQUE"));

        if back_valid {
            score = score.saturating_add(30);
            details.push("✅ CNI verso validé".to_string());
        } else if !back_text.is_empty() {
            score = score.saturating_add(10);
            details.push("⚠️ CNI verso lisible — données incomplètes".to_string());
        } else {
            details.push("❌ CNI verso : image illisible ou vide".to_string());
        }

        // ── Selfie (max 15 pts) ───────────────────────────────────────────────
        let (_, selfie_has_face, selfie_conf) = self.analyze_image(selfie_base64).await;
        if selfie_has_face {
            score = score.saturating_add(15);
            details.push(format!(
                "✅ Visage détecté sur le selfie (confiance {:.0}%)",
                selfie_conf * 100.0
            ));
        } else {
            details.push("❌ Aucun visage détecté sur le selfie".to_string());
        }

        // ── Décision finale ───────────────────────────────────────────────────
        let decision = if score >= 80 {
            "approved"
        } else if score >= 50 {
            "under_review"
        } else {
            "rejected"
        }
        .to_string();

        details.push(format!(
            "Score total : {}/100 → {}",
            score,
            decision.to_uppercase()
        ));

        log::info!(
            "[DocumentAI] Analyse KYC terminée — score={}, décision={}",
            score,
            decision
        );

        KycAnalysisResult {
            score,
            decision,
            extracted_name,
            extracted_id_number: extracted_id,
            cni_front_valid: front_valid,
            cni_back_valid: back_valid,
            selfie_has_face,
            cni_has_face,
            details,
        }
    }
}

/// Extrait la valeur de la ligne suivant un mot-clé dans un texte multi-lignes
fn extract_field_after(text: &str, keywords: &[&str]) -> Option<String> {
    let lines: Vec<&str> = text.lines().collect();
    for (i, line) in lines.iter().enumerate() {
        if keywords.iter().any(|kw| line.contains(kw)) {
            if let Some(next) = lines.get(i + 1) {
                let trimmed = next.trim().to_string();
                if !trimmed.is_empty()
                    && trimmed
                        .chars()
                        .all(|c| c.is_alphabetic() || c == ' ' || c == '-' || c == '\'')
                    && trimmed.len() >= 2
                {
                    return Some(trimmed);
                }
            }
        }
    }
    None
}
