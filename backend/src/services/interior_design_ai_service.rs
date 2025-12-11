//! ✅ Service IA pour Décoration d'Intérieur
//!
//! Ce service utilise l'IA pour :
//! - Suggérer des décors selon style/budget
//! - Visualiser des projets en 3D
//! - Créer des palettes de couleurs harmonieuses
//! - Optimiser l'espace
//! - Estimer le coût de décoration

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

/// Suggestions de décoration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecorationSuggestions {
    pub style: String,
    pub color_palette: Vec<String>, // Couleurs principales
    pub furniture_suggestions: Vec<String>,
    pub decoration_items: Vec<String>,
    pub layout_suggestions: String,
    pub budget_breakdown: serde_json::Value,
    pub reasoning: String,
}

/// Visualisation 3D d'un projet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Visualization3D {
    pub description: String,
    pub elements: Vec<String>, // Éléments à visualiser
    pub style_notes: String,
    pub color_scheme: Vec<String>,
    pub recommendations: String,
}

/// Estimation de coût décoration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecorationCostEstimate {
    pub total_cost: f64,
    pub cost_breakdown: serde_json::Value,
    pub cost_per_room: serde_json::Value,
    pub recommendations: String,
    pub alternatives: Vec<String>, // Alternatives moins chères
}

/// Optimisation d'espace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceOptimization {
    pub suggestions: Vec<String>,
    pub layout_improvements: String,
    pub furniture_arrangement: String,
    pub storage_solutions: Vec<String>,
    pub reasoning: String,
}

/// Service IA pour Décoration
pub struct InteriorDesignAIService {
    app_ia: Arc<AppIA>,
}

impl InteriorDesignAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Suggère des décors selon style/budget
    pub async fn suggest_decoration(
        &self,
        style: &str,
        budget: f64,
        superficie_m2: f64,
        nb_pieces: i32,
        pieces: Vec<String>, // ["Salon", "Cuisine", "Chambre"]
        preferences: Option<serde_json::Value>,
    ) -> AppResult<DecorationSuggestions> {
        let pieces_str = pieces.join(", ");
        let preferences_str = preferences
            .as_ref()
            .and_then(|p| serde_json::to_string(p).ok())
            .unwrap_or_else(|| "Non spécifiées".to_string());

        let prompt = format!(
            r##"
Tu es le décorateur d'intérieur IA de Yukpomnang.

CONTEXTE :
- Style souhaité : {}
- Budget : {} FCFA
- Superficie : {} m²
- Nombre de pièces : {}
- Pièces à décorer : {}
- Préférences : {}

TON RÔLE :
- Suggérer une décoration complète selon le style et budget
- Proposer une palette de couleurs harmonieuse
- Recommander des meubles et objets de décoration
- Optimiser l'utilisation de l'espace
- Répartir le budget intelligemment

IMPORTANT :
- Adapter aux goûts africains et locaux
- Proposer des alternatives selon budget
- Suggérer des matériaux locaux quand possible

RÉPONSE ATTENDUE (JSON strict) :
{{
    "style": "Moderne africain",
    "color_palette": ["#F4A261", "#E76F51", "#264653"],
    "furniture_suggestions": ["Canapé en tissu africain", "Table basse en bois"],
    "decoration_items": ["Tapis berbère", "Masques décoratifs"],
    "layout_suggestions": "Suggestions d'aménagement",
    "budget_breakdown": {{"meubles": 2000000, "décoration": 500000, "peinture": 300000}},
    "reasoning": "Explication des suggestions"
}}
"##,
            style, budget, superficie_m2, nb_pieces, pieces_str, preferences_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[InteriorDesignAIService] Suggestions générées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let suggestions: DecorationSuggestions = match serde_json::from_str(&response) {
            Ok(s) => s,
            Err(e) => {
                log::warn!(
                    "[InteriorDesignAIService] Erreur parsing JSON, utilisation suggestions basiques: {}",
                    e
                );
                DecorationSuggestions {
                    style: style.to_string(),
                    color_palette: vec!["#FFFFFF".to_string(), "#000000".to_string()],
                    furniture_suggestions: vec![],
                    decoration_items: vec![],
                    layout_suggestions: response.clone(),
                    budget_breakdown: json!({}),
                    reasoning: "Suggestions basiques".to_string(),
                }
            }
        };

        Ok(suggestions)
    }

    /// Génère une visualisation 3D d'un projet
    pub async fn visualize_3d(
        &self,
        description: &str,
        style: &str,
        pieces: Vec<String>,
        dimensions: Option<serde_json::Value>,
    ) -> AppResult<Visualization3D> {
        let pieces_str = pieces.join(", ");
        let dimensions_str = dimensions
            .as_ref()
            .and_then(|d| serde_json::to_string(d).ok())
            .unwrap_or_else(|| "Non spécifiées".to_string());

        let prompt = format!(
            r##"
Tu es le visualiseur 3D IA de Yukpomnang.

CONTEXTE :
- Description du projet : {}
- Style : {}
- Pièces : {}
- Dimensions : {}

TON RÔLE :
- Générer une description détaillée pour visualisation 3D
- Identifier les éléments clés à visualiser
- Définir le schéma de couleurs
- Donner des recommandations de rendu

RÉPONSE ATTENDUE (JSON strict) :
{{
    "description": "Description détaillée pour rendu 3D",
    "elements": ["Élément 1", "Élément 2"],
    "style_notes": "Notes sur le style",
    "color_scheme": ["#F4A261", "#E76F51"],
    "recommendations": "Recommandations de visualisation"
}}
"##,
            description, style, pieces_str, dimensions_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[InteriorDesignAIService] Visualisation 3D générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let visualization: Visualization3D = match serde_json::from_str(&response) {
            Ok(v) => v,
            Err(e) => {
                log::warn!(
                    "[InteriorDesignAIService] Erreur parsing JSON, utilisation visualisation basique: {}",
                    e
                );
                Visualization3D {
                    description: response.clone(),
                    elements: vec![],
                    style_notes: "Notes non disponibles".to_string(),
                    color_scheme: vec![],
                    recommendations: "Recommandations non disponibles".to_string(),
                }
            }
        };

        Ok(visualization)
    }

    /// Estime le coût d'une décoration
    pub async fn estimate_cost(
        &self,
        superficie_m2: f64,
        nb_pieces: i32,
        style: &str,
        niveau_standing: &str, // "Économique", "Standard", "Haut de gamme"
    ) -> AppResult<DecorationCostEstimate> {
        let prompt = format!(
            r##"
Tu es l'estimateur de coûts décoration IA de Yukpomnang.

CONTEXTE :
- Superficie : {} m²
- Nombre de pièces : {}
- Style : {}
- Niveau de standing : {}

TON RÔLE :
- Estimer le coût total de décoration
- Répartir par poste (meubles, décoration, peinture, etc.)
- Estimer par pièce
- Proposer des alternatives moins chères

RÉPONSE ATTENDUE (JSON strict) :
{{
    "total_cost": 5000000,
    "cost_breakdown": {{"meubles": 2000000, "décoration": 1500000, "peinture": 500000, "éclairage": 1000000}},
    "cost_per_room": {{"salon": 2000000, "chambre": 1500000, "cuisine": 1500000}},
    "recommendations": "Recommandations d'optimisation",
    "alternatives": ["Alternative 1", "Alternative 2"]
}}
"##,
            superficie_m2, nb_pieces, style, niveau_standing
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[InteriorDesignAIService] Estimation coût générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let estimate: DecorationCostEstimate = match serde_json::from_str(&response) {
            Ok(e) => e,
            Err(e) => {
                log::warn!(
                    "[InteriorDesignAIService] Erreur parsing JSON, utilisation estimation basique: {}",
                    e
                );
                // Fallback : estimation basique
                let base_cost = superficie_m2 * 50000.0; // Coût moyen par m²
                DecorationCostEstimate {
                    total_cost: base_cost,
                    cost_breakdown: json!({
                        "meubles": base_cost * 0.4,
                        "décoration": base_cost * 0.3,
                        "peinture": base_cost * 0.2,
                        "éclairage": base_cost * 0.1
                    }),
                    cost_per_room: json!({}),
                    recommendations: response.clone(),
                    alternatives: vec![],
                }
            }
        };

        Ok(estimate)
    }

    /// Optimise l'utilisation de l'espace
    pub async fn optimize_space(
        &self,
        superficie_m2: f64,
        nb_pieces: i32,
        pieces: Vec<String>,
        contraintes: Option<serde_json::Value>,
    ) -> AppResult<SpaceOptimization> {
        let pieces_str = pieces.join(", ");
        let contraintes_str = contraintes
            .as_ref()
            .and_then(|c| serde_json::to_string(c).ok())
            .unwrap_or_else(|| "Aucune".to_string());

        let prompt = format!(
            r##"
Tu es l'optimiseur d'espace IA de Yukpomnang.

CONTEXTE :
- Superficie : {} m²
- Nombre de pièces : {}
- Pièces : {}
- Contraintes : {}

TON RÔLE :
- Optimiser l'aménagement de l'espace
- Suggérer des améliorations de layout
- Proposer des solutions de rangement
- Maximiser l'utilisation de l'espace

RÉPONSE ATTENDUE (JSON strict) :
{{
    "suggestions": ["Suggestion 1", "Suggestion 2"],
    "layout_improvements": "Améliorations du layout",
    "furniture_arrangement": "Arrangement des meubles",
    "storage_solutions": ["Solution 1", "Solution 2"],
    "reasoning": "Explication des optimisations"
}}
"##,
            superficie_m2, nb_pieces, pieces_str, contraintes_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[InteriorDesignAIService] Optimisation espace générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let optimization: SpaceOptimization = match serde_json::from_str(&response) {
            Ok(o) => o,
            Err(e) => {
                log::warn!(
                    "[InteriorDesignAIService] Erreur parsing JSON, utilisation optimisation basique: {}",
                    e
                );
                SpaceOptimization {
                    suggestions: vec![],
                    layout_improvements: response.clone(),
                    furniture_arrangement: "Arrangement non disponible".to_string(),
                    storage_solutions: vec![],
                    reasoning: "Optimisation basique".to_string(),
                }
            }
        };

        Ok(optimization)
    }
}
