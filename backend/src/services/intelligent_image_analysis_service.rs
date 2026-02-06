// 🖼️ Service d'analyse d'image intelligent avec IA multi-modèles
// Adapte les prompts selon la catégorie de produit et utilise le système multi-modèles existant

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::{AppIA, ModelConfig};
use crate::utils::log::{log_error, log_info, log_warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAnalysis {
    pub description: String,
    pub tags: Vec<String>,
    pub category_detected: String,
    pub marque: Option<String>,
    pub couleurs: Vec<String>,
    pub caracteristiques_cles: HashMap<String, String>,
    pub confiance: f32,
    pub search_query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AICost {
    pub cost_usd: f64,
    pub total_tokens: u32,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub model_used: String,
}

pub struct IntelligentImageAnalysisService;

impl IntelligentImageAnalysisService {
    /// Construire le prompt d'analyse adapté à la catégorie de produit
    fn build_analysis_prompt(category: Option<&str>, is_search_mode: bool) -> String {
        let mode_instruction = if is_search_mode {
            "L'utilisateur CHERCHE ce produit. Extrais les caractéristiques pour MATCHER avec des produits similaires en base."
        } else {
            "Le prestataire CATALOGUE ce produit. Extrais les caractéristiques pour une recherche future optimale."
        };

        let category_instruction = match category {
            Some("vetement") => {
                r#"
TYPE: Vêtement
EXTRAIRE: type exact (veste/t-shirt/pantalon/chemise/pull/robe), marque visible, couleur(s), taille si visible, style (sport/casual/formel), matière apparente, état, motifs/logos distinctifs"#
            }

            Some("chaussure") => {
                r#"
TYPE: Chaussure
EXTRAIRE: type (baskets/sandales/bottes/mocassins), marque, couleur(s), pointure si visible, style, matière, état, semelle visible"#
            }

            Some("automobile") => {
                r#"
TYPE: Véhicule
EXTRAIRE: marque, modèle, couleur carrosserie, année approximative, type (berline/SUV/pick-up/moto), état apparent, immatriculation si lisible, options visibles (jantes/spoiler)"#
            }

            Some("immobilier_batiment") | Some("immobilier_terrain") => {
                r#"
TYPE: Immobilier
EXTRAIRE: type (appartement/villa/studio/terrain), architecture, nombre de pièces estimé, état (neuf/rénové/ancien), environnement (urbain/rural), éléments distinctifs"#
            }

            Some("electromenager") => {
                r#"
TYPE: Électroménager
EXTRAIRE: type appareil (frigo/cuisinière/micro-ondes/machine), marque, modèle, couleur, état, capacité visible, options/fonctionnalités visibles"#
            }

            Some("mobilier") => {
                r#"
TYPE: Mobilier
EXTRAIRE: type (canapé/table/chaise/lit/armoire), style (moderne/classique/rustique), matière, couleur, dimensions approximatives, état, nombre de places si applicable"#
            }

            Some("aliments") => {
                r#"
TYPE: Produit Alimentaire
EXTRAIRE: type produit, marque, conditionnement, poids/volume visible, fraîcheur apparente, origine si indiquée, labels qualité visibles"#
            }

            Some("pharmacie") => {
                r#"
TYPE: Produit Pharmaceutique
EXTRAIRE: type (médicament/équipement), nom du produit, marque/laboratoire, conditionnement, dosage si visible, date péremption si visible"#
            }

            Some("bijoux") => {
                r#"
TYPE: Bijou
EXTRAIRE: type (bague/collier/bracelet/boucles), matière (or/argent/acier), couleur, style, pierres précieuses visibles, état, design distinctif"#
            }

            Some("cosmetique_parfum") => {
                r#"
TYPE: Cosmétique/Parfum
EXTRAIRE: type (parfum/crème/huile), marque, volume, packaging, gamme de produit, usage indiqué (peau/cheveux)"#
            }

            Some("coiffure_beaute") => {
                r#"
TYPE: Produit Capillaire
EXTRAIRE: type (mèches/perruque/tissage/extension), longueur approximative, couleur, texture (lisse/bouclé/crépu), marque, origine, conditionnement"#
            }

            Some("hopital_clinique") => {
                r#"
TYPE: Établissement Médical
EXTRAIRE: type (clinique/hôpital/centre), spécialités visibles (panneaux/enseignes), taille estimée, équipements visibles, environnement"#
            }

            Some("quincaillerie") => {
                r#"
TYPE: Quincaillerie/Matériaux
EXTRAIRE: type produit (outil/matériau/électrique/plomberie), marque, référence visible, dimensions/calibre, matière, état, conditionnement"#
            }

            None | Some("autre") | Some(_) => {
                r#"
TYPE: Produit Général
EXTRAIRE: catégorie principale, type produit, marque, couleur(s), caractéristiques distinctives, état, usage apparent"#
            }
        };

        format!(
            r#"Tu es un expert en identification de produits pour le marché africain (CEMAC).

{}

{}

CONTEXTE: Marketplace Yukpo - Connecter clients et prestataires locaux

INSTRUCTIONS CRITIQUES:
1. Analyse visuelle COMPLÈTE de l'image
2. Identifie TOUS les détails pertinents pour un matching précis
3. Extrais le TEXTE visible (marques, étiquettes, prix)
4. Détecte la CATÉGORIE automatiquement si non fournie
5. Génère une REQUÊTE DE RECHERCHE optimale

FORMAT DE SORTIE (JSON STRICT - PAS DE MARKDOWN):
{{
    "description": "Description détaillée et naturelle du produit visible",
    "tags": ["mot-clé1", "mot-clé2", "mot-clé3", "..."],
    "category_detected": "{}",
    "marque": "Marque détectée ou null",
    "couleurs": ["couleur1", "couleur2"],
    "caracteristiques_cles": {{
        "champ1": "valeur1",
        "champ2": "valeur2"
    }},
    "confiance": 0.95,
    "search_query": "requête de recherche optimisée avec mots-clés pertinents"
}}

IMPORTANT: Retourne UNIQUEMENT le JSON, sans texte explicatif avant ou après."#,
            mode_instruction,
            category_instruction,
            category.unwrap_or("detection_auto")
        )
    }

    /// Analyser une image avec le système multi-modèles (fallback automatique)
    pub async fn analyze_image_multimodel(
        app_ia: &AppIA,
        image_base64: &str,
        category: Option<&str>,
        is_search_mode: bool,
    ) -> AppResult<(ImageAnalysis, AICost)> {
        log_info(&format!(
            "[ImageAnalysis] Analyse image - Catégorie: {:?}, Mode: {}",
            category,
            if is_search_mode {
                "Recherche"
            } else {
                "Catalogage"
            }
        ));

        // Construire le prompt adapté
        let prompt = Self::build_analysis_prompt(category, is_search_mode);

        // Construire le message multimodal
        let messages = json!([{
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": prompt
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": if image_base64.starts_with("data:") {
                            image_base64.to_string()
                        } else {
                            format!("data:image/jpeg;base64,{}", image_base64)
                        }
                    }
                }
            ]
        }]);

        // Essayer les modèles supportant la vision par ordre de priorité
        let models = app_ia.models.read().await;
        let mut vision_models: Vec<&ModelConfig> =
            models.iter().filter(|m| m.enabled && Self::supports_vision(&m.name)).collect();

        // Trier par priorité décroissante
        vision_models.sort_by(|a, b| b.priority.cmp(&a.priority));

        log_info(&format!(
            "[ImageAnalysis] {} modèles Vision disponibles",
            vision_models.len()
        ));

        // Essayer chaque modèle jusqu'à succès
        for model in vision_models {
            log_info(&format!("[ImageAnalysis] Tentative avec {}", model.name));

            match Self::call_vision_api(app_ia, model, &messages).await {
                Ok((analysis, cost)) => {
                    log_info(&format!(
                        "[ImageAnalysis] ✅ Succès avec {} - Coût: ${:.4} ({} tokens)",
                        model.name, cost.cost_usd, cost.total_tokens
                    ));
                    return Ok((analysis, cost));
                }
                Err(e) => {
                    log_warn(&format!(
                        "[ImageAnalysis] ❌ Échec {} : {:?} - Essai modèle suivant",
                        model.name, e
                    ));
                    continue;
                }
            }
        }

        Err(AppError::Internal(
            "Tous les modèles Vision ont échoué".to_string(),
        ))
    }

    /// Vérifier si un modèle supporte la vision
    fn supports_vision(model_name: &str) -> bool {
        matches!(
            model_name,
            "openai-gpt4o"
                | "openai-gpt4o-mini"
                | "claude-3-5-sonnet"
                | "claude-3-opus"
                | "claude-3-sonnet"
                | "gemini-pro-vision"
                | "gemini-1-5-flash"
        )
    }

    /// Appeler l'API Vision du modèle
    async fn call_vision_api(
        app_ia: &AppIA,
        model: &ModelConfig,
        messages: &Value,
    ) -> AppResult<(ImageAnalysis, AICost)> {
        let start_time = std::time::Instant::now();

        // Appeler selon le provider
        let (response_text, tokens_data) = if model.name.starts_with("openai") {
            Self::call_openai_vision(app_ia, model, messages).await?
        } else if model.name.starts_with("claude") {
            Self::call_anthropic_vision(app_ia, model, messages).await?
        } else if model.name.starts_with("gemini") {
            Self::call_gemini_vision(app_ia, model, messages).await?
        } else {
            return Err(AppError::Internal(format!(
                "Modèle non supporté: {}",
                model.name
            )));
        };

        let duration = start_time.elapsed();
        log_info(&format!("[ImageAnalysis] Réponse reçue en {:?}", duration));

        // Parser la réponse JSON
        let analysis = Self::parse_ai_response(&response_text)?;

        // Calculer le coût
        let cost = AICost {
            cost_usd: (tokens_data.total_tokens as f64) * model.cost_per_token,
            total_tokens: tokens_data.total_tokens,
            prompt_tokens: tokens_data.prompt_tokens,
            completion_tokens: tokens_data.completion_tokens,
            model_used: model.name.clone(),
        };

        Ok((analysis, cost))
    }

    /// Appel OpenAI Vision
    async fn call_openai_vision(
        app_ia: &AppIA,
        model: &ModelConfig,
        messages: &Value,
    ) -> AppResult<(String, TokensUsage)> {
        let url = format!("{}/chat/completions", model.base_url);

        let payload = json!({
            "model": model.model,
            "messages": messages,
            "max_tokens": 500,
            "temperature": 0.1  // Bas pour cohérence
        });

        let response = app_ia
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {}", model.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .timeout(std::time::Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| {
                log_error(&format!("[OpenAI Vision] Erreur requête: {}", e));
                AppError::Internal(format!("Erreur OpenAI: {}", e))
            })?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!("OpenAI Error: {}", error_text)));
        }

        let response_json: Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing réponse: {}", e)))?;

        let content = response_json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Pas de contenu dans réponse".to_string()))?
            .to_string();

        let usage = TokensUsage {
            prompt_tokens: response_json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: response_json["usage"]["completion_tokens"].as_u64().unwrap_or(0)
                as u32,
            total_tokens: response_json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
        };

        Ok((content, usage))
    }

    /// Appel Anthropic Claude Vision
    async fn call_anthropic_vision(
        app_ia: &AppIA,
        model: &ModelConfig,
        messages: &Value,
    ) -> AppResult<(String, TokensUsage)> {
        let url = format!("{}/messages", model.base_url);

        let payload = json!({
            "model": model.model,
            "max_tokens": 500,
            "messages": messages
        });

        let response = app_ia
            .http
            .post(&url)
            .header("x-api-key", &model.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&payload)
            .timeout(std::time::Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur Claude: {}", e)))?;

        let response_json: Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing: {}", e)))?;

        let content = response_json["content"][0]["text"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Pas de contenu".to_string()))?
            .to_string();

        let usage = TokensUsage {
            prompt_tokens: response_json["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: response_json["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32,
            total_tokens: (response_json["usage"]["input_tokens"].as_u64().unwrap_or(0)
                + response_json["usage"]["output_tokens"].as_u64().unwrap_or(0))
                as u32,
        };

        Ok((content, usage))
    }

    /// Appel Google Gemini Vision
    async fn call_gemini_vision(
        app_ia: &AppIA,
        model: &ModelConfig,
        messages: &Value,
    ) -> AppResult<(String, TokensUsage)> {
        let url = format!(
            "{}/models/{}:generateContent?key={}",
            model.base_url, model.model, model.api_key
        );

        // Adapter le format pour Gemini
        let content = messages[0]["content"]
            .as_array()
            .ok_or_else(|| AppError::Internal("Format messages invalide".to_string()))?;

        let text_part = content
            .iter()
            .find(|p| p["type"] == "text")
            .and_then(|p| p["text"].as_str())
            .unwrap_or("");

        let image_part = content
            .iter()
            .find(|p| p["type"] == "image_url")
            .and_then(|p| p["image_url"]["url"].as_str())
            .unwrap_or("");

        let payload = json!({
            "contents": [{
                "parts": [
                    { "text": text_part },
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": image_part.replace("data:image/jpeg;base64,", "")
                        }
                    }
                ]
            }]
        });

        let response = app_ia
            .http
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur Gemini: {}", e)))?;

        let response_json: Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing: {}", e)))?;

        let content = response_json["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Pas de contenu".to_string()))?
            .to_string();

        // Gemini ne fournit pas toujours les tokens, estimation
        let estimated_tokens = (content.len() / 4) as u32;

        Ok((
            content,
            TokensUsage {
                prompt_tokens: 1000, // Estimation image
                completion_tokens: estimated_tokens,
                total_tokens: 1000 + estimated_tokens,
            },
        ))
    }

    /// Parser la réponse IA en structure ImageAnalysis
    fn parse_ai_response(response_text: &str) -> AppResult<ImageAnalysis> {
        // Extraire le JSON (l'IA peut ajouter du texte avant/après)
        let json_str = if let Some(start) = response_text.find('{') {
            if let Some(end) = response_text.rfind('}') {
                &response_text[start..=end]
            } else {
                response_text
            }
        } else {
            response_text
        };

        let parsed: Value = serde_json::from_str(json_str).map_err(|e| {
            log_error(&format!("[ImageAnalysis] Erreur parsing JSON: {}", e));
            log_error(&format!("[ImageAnalysis] Réponse reçue: {}", response_text));
            AppError::Internal(format!("Erreur parsing réponse IA: {}", e))
        })?;

        // Extraire les champs
        let description = parsed["description"].as_str().unwrap_or("").to_string();

        let tags: Vec<String> = parsed["tags"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_lowercase())).collect())
            .unwrap_or_default();

        let category_detected = parsed["category_detected"].as_str().unwrap_or("autre").to_string();

        let marque = parsed["marque"]
            .as_str()
            .filter(|s| *s != "null" && !s.is_empty())
            .map(|s| s.to_string());

        let couleurs: Vec<String> = parsed["couleurs"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_lowercase())).collect())
            .unwrap_or_default();

        let caracteristiques_cles: HashMap<String, String> = parsed["caracteristiques_cles"]
            .as_object()
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            })
            .unwrap_or_default();

        let confiance = parsed["confiance"].as_f64().unwrap_or(0.5) as f32;

        let search_query = parsed["search_query"].as_str().unwrap_or(&description).to_string();

        Ok(ImageAnalysis {
            description,
            tags,
            category_detected,
            marque,
            couleurs,
            caracteristiques_cles,
            confiance,
            search_query,
        })
    }

    /// Calculer le coût pour l'utilisateur (×10 du coût IA)
    pub fn calculate_user_cost(ai_cost: &AICost, user_currency: &str) -> i64 {
        // Coût utilisateur = Coût IA × 10
        let user_cost_usd = ai_cost.cost_usd * 10.0;

        // Conversion en devise locale
        let exchange_rate = match user_currency {
            "XAF" | "FCFA" => 600.0, // 1 USD = 600 XAF
            "EUR" => 0.92,           // 1 USD = 0.92 EUR
            "USD" => 100.0,          // Centimes
            _ => 600.0,              // Défaut FCFA
        };

        let cost_in_currency = (user_cost_usd * exchange_rate) as i64;

        // Arrondir au multiple de 10
        ((cost_in_currency + 5) / 10) * 10
    }
}

#[derive(Debug)]
struct TokensUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_cost_calculation() {
        let ai_cost = AICost {
            cost_usd: 0.007,
            total_tokens: 1400,
            prompt_tokens: 1250,
            completion_tokens: 150,
            model_used: "gpt-4o".to_string(),
        };

        // Test XAF
        let cost_xaf = IntelligentImageAnalysisService::calculate_user_cost(&ai_cost, "XAF");
        assert_eq!(cost_xaf, 50); // 0.007 × 10 × 600 = 42 → 50 (arrondi)

        // Test EUR
        let cost_eur = IntelligentImageAnalysisService::calculate_user_cost(&ai_cost, "EUR");
        assert_eq!(cost_eur, 10); // 0.007 × 10 × 0.92 × 100 = 6.44 → 10 (centimes)
    }

    #[test]
    fn test_vision_support() {
        assert!(IntelligentImageAnalysisService::supports_vision(
            "openai-gpt4o"
        ));
        assert!(IntelligentImageAnalysisService::supports_vision(
            "claude-3-5-sonnet"
        ));
        assert!(!IntelligentImageAnalysisService::supports_vision(
            "gpt-3-5-turbo"
        ));
    }
}
