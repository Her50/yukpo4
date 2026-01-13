use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct GenerateAdSuggestionsRequest {
    pub field: String, // "titre" | "description"
    pub products: Vec<serde_json::Value>,
    pub target_audience: Option<serde_json::Value>,
    pub campaign_goal: Option<String>, // "awareness" | "conversion" | "engagement"
    pub count: Option<u32>,            // Nombre de suggestions (défaut: 5)
}

#[derive(Debug, Serialize)]
pub struct AdSuggestion {
    pub text: String,
    pub confidence: f64,
    pub reasoning: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GenerateAdSuggestionsResponse {
    pub suggestions: Vec<AdSuggestion>,
    pub model_used: String,
}

/// Génère des suggestions IA pour titre/description de publicité
pub async fn generate_ad_suggestions(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<GenerateAdSuggestionsRequest>,
) -> Result<ResponseJson<GenerateAdSuggestionsResponse>, StatusCode> {
    let count = payload.count.unwrap_or(5);

    // Construire le prompt pour l'IA
    let product_names: Vec<String> = payload
        .products
        .iter()
        .filter_map(|p| {
            p.get("nom")
                .or_else(|| p.get("nom_produit"))
                .or_else(|| p.get("name"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .collect();

    let product_list = if product_names.is_empty() {
        "produits".to_string()
    } else {
        product_names.join(", ")
    };

    let goal_context = payload
        .campaign_goal
        .as_ref()
        .map(|g| match g.as_str() {
            "awareness" => "pour augmenter la notoriété de la marque",
            "conversion" => "pour maximiser les conversions et ventes",
            "engagement" => "pour maximiser l'engagement et les interactions",
            _ => "pour promouvoir efficacement",
        })
        .unwrap_or("pour promouvoir efficacement");

    let field_instruction = match payload.field.as_str() {
        "titre" => "Génère des titres accrocheurs et percutants",
        "description" => "Génère des descriptions détaillées et engageantes",
        _ => "Génère du contenu",
    };

    // ✅ AMÉLIORATION: Charger le prompt spécialisé depuis le fichier
    let base_prompt = match fs::read_to_string(
        "backend/ia_prompts/publicite_advertisement_prompt.md",
    ) {
        Ok(content) => content,
        Err(e) => {
            log::warn!("[generate_ad_suggestions] Impossible de charger le prompt spécialisé: {:?}, utilisation du prompt inline", e);
            // Fallback au prompt inline
            String::from("Tu es un expert en marketing digital et création de publicités pour la plateforme Yukpo.")
        }
    };

    // Construire le prompt final avec les informations contextuelles
    let audience_context = if let Some(audience) = &payload.target_audience {
        let mut context_parts = Vec::new();

        if let Some(age_range) = audience.get("ageRange").and_then(|a| a.as_object()) {
            if let (Some(min), Some(max)) = (age_range.get("min"), age_range.get("max")) {
                if let (Some(min_val), Some(max_val)) = (min.as_u64(), max.as_u64()) {
                    context_parts.push(format!("Âge cible: {}-{} ans", min_val, max_val));
                }
            }
        }

        if let Some(gender) = audience.get("gender").and_then(|g| g.as_str()) {
            if gender != "all" {
                context_parts.push(format!("Genre: {}", gender));
            }
        }

        if let Some(interests) = audience.get("interests").and_then(|i| i.as_array()) {
            if !interests.is_empty() {
                let interests_str: Vec<String> = interests
                    .iter()
                    .filter_map(|i| i.as_str().map(|s| s.to_string()))
                    .collect();
                if !interests_str.is_empty() {
                    context_parts.push(format!("Intérêts: {}", interests_str.join(", ")));
                }
            }
        }

        if !context_parts.is_empty() {
            format!(
                "\n\nInformations public cible:\n{}",
                context_parts.join("\n")
            )
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    let prompt = format!(
        r#"{base_prompt}

## TÂCHE SPÉCIFIQUE

{field_instruction} pour une publicité promouvant: {product_list}

Objectif de la campagne: {goal_context}{audience_context}

**Produits/services à promouvoir:**
{products_details}

**Instructions spécifiques:**
- Génère exactement {count} suggestions différentes
- Format: Une suggestion par ligne, sans numérotation ni puces
- Chaque suggestion doit être unique et originale"#,
        base_prompt = base_prompt,
        field_instruction = field_instruction,
        product_list = product_list,
        goal_context = goal_context,
        audience_context = audience_context,
        products_details = payload
            .products
            .iter()
            .take(5)
            .map(|p| {
                let nom = p
                    .get("nom")
                    .or_else(|| p.get("nom_produit"))
                    .or_else(|| p.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("produit");
                let prix = p.get("prix").and_then(|v| v.as_f64());
                let desc = p.get("description").and_then(|v| v.as_str());

                let mut details = format!("- {}", nom);
                if let Some(p) = prix {
                    details.push_str(&format!(" ({} FCFA)", p as i64));
                }
                if let Some(d) = desc {
                    details.push_str(&format!(": {}", if d.len() > 100 { &d[..100] } else { d }));
                }
                details
            })
            .collect::<Vec<_>>()
            .join("\n"),
        count = count
    );

    // Appeler l'IA
    match state.ia.predict(&prompt).await {
        Ok((model_name, response, _tokens)) => {
            // Parser les suggestions (une par ligne)
            let suggestions: Vec<AdSuggestion> = response
                .lines()
                .map(|line| line.trim())
                .filter(|line| !line.is_empty())
                .filter(|line| {
                    !line.starts_with("Suggestion")
                        && !line
                            .chars()
                            .next()
                            .map(|c| c.is_ascii_digit())
                            .unwrap_or(false)
                })
                .take(count as usize)
                .map(|text| AdSuggestion {
                    text: text.to_string(),
                    confidence: 0.85,
                    reasoning: None,
                })
                .collect();

            // Si pas assez de suggestions, compléter avec des suggestions par défaut
            let mut final_suggestions = suggestions;
            while final_suggestions.len() < count as usize {
                let default_text = match payload.field.as_str() {
                    "titre" => format!("Découvrez {} - Offre spéciale !", product_list),
                    "description" => format!(
                        "Profitez de nos {} à prix réduits. Qualité garantie et livraison rapide !",
                        product_list
                    ),
                    _ => format!("Promotion sur {}", product_list),
                };
                final_suggestions.push(AdSuggestion {
                    text: default_text,
                    confidence: 0.5,
                    reasoning: Some("Suggestion par défaut".to_string()),
                });
            }

            Ok(ResponseJson(GenerateAdSuggestionsResponse {
                suggestions: final_suggestions,
                model_used: model_name,
            }))
        }
        Err(e) => {
            log::error!("[generate_ad_suggestions] Erreur IA: {:?}", e);
            // Fallback: suggestions par défaut
            let default_suggestions: Vec<AdSuggestion> = (0..count)
                .map(|i| {
                    let text = match payload.field.as_str() {
                        "titre" => format!(
                            "Promotion {} - Offre {} !",
                            product_list,
                            if i == 0 { "spéciale" } else { "limitée" }
                        ),
                        "description" => format!(
                            "Découvrez nos {} à prix réduits. Qualité garantie !",
                            product_list
                        ),
                        _ => format!("Publicité pour {}", product_list),
                    };
                    AdSuggestion {
                        text,
                        confidence: 0.5,
                        reasoning: Some("Suggestion par défaut (IA indisponible)".to_string()),
                    }
                })
                .collect();

            Ok(ResponseJson(GenerateAdSuggestionsResponse {
                suggestions: default_suggestions,
                model_used: "fallback".to_string(),
            }))
        }
    }
}

pub fn publicite_ai_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route(
            "/api/publicites/ai/generate-suggestions",
            post(generate_ad_suggestions),
        )
        .with_state(state)
}
