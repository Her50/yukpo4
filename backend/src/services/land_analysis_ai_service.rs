//! ✅ Service IA pour Analyse de Terrains
//!
//! Ce service utilise l'IA pour :
//! - Analyser la viabilité d'un terrain (zonage, accès, services)
//! - Estimer le prix d'un terrain avec IA
//! - Recommander l'usage d'un terrain
//! - Analyser le potentiel d'investissement

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Analyse de viabilité terrain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LandViabilityAnalysis {
    pub is_viable: bool,
    pub viability_score: f64,    // 0.0 à 1.0
    pub strengths: Vec<String>,  // Points forts
    pub weaknesses: Vec<String>, // Points faibles
    pub recommendations: String,
    pub risks: Vec<String>, // Risques identifiés
}

/// Estimation de prix terrain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LandPriceEstimate {
    pub estimated_price: f64,
    pub price_per_m2: f64,
    pub price_range_min: f64,
    pub price_range_max: f64,
    pub confidence_level: f64, // 0.0 à 1.0
    pub reasoning: String,
    pub factors: Vec<String>, // Facteurs influençant le prix
}

/// Recommandation d'usage terrain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LandUsageRecommendation {
    pub recommended_usage: Vec<String>, // ["Résidentiel", "Commercial"]
    pub usage_analysis: String,
    pub profitability_analysis: String,
    pub development_suggestions: Vec<String>,
    pub reasoning: String,
}

/// Analyse de potentiel investissement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestmentPotentialAnalysis {
    pub investment_score: f64,    // 0.0 à 1.0
    pub potential_return: String, // "Élevé", "Moyen", "Faible"
    pub time_horizon: String,     // "Court terme", "Moyen terme", "Long terme"
    pub risks: Vec<String>,
    pub opportunities: Vec<String>,
    pub recommendations: String,
}

/// Service IA pour Analyse de Terrains
pub struct LandAnalysisAIService {
    app_ia: Arc<AppIA>,
}

impl LandAnalysisAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Analyse la viabilité d'un terrain
    pub async fn analyze_viability(
        &self,
        superficie_m2: f64,
        zonage: &str,
        acces_route: bool,
        type_acces: Option<&str>,
        viabilise: bool,
        quartier: &str,
        ville: &str,
        services_proximite: Option<serde_json::Value>, // {"eau": true, "electricite": true, "ecole": true}
    ) -> AppResult<LandViabilityAnalysis> {
        let acces_str = if acces_route {
            type_acces.unwrap_or("Route disponible")
        } else {
            "Pas d'accès route"
        };
        let services_str = services_proximite
            .as_ref()
            .and_then(|s| serde_json::to_string(s).ok())
            .unwrap_or_else(|| "Non spécifiés".to_string());

        let prompt = format!(
            r#"
Tu es l'expert foncier IA de Yukpo.

CONTEXTE :
- Superficie : {} m²
- Zonage : {}
- Accès route : {}
- Type d'accès : {}
- Viabilisé : {}
- Quartier : {}
- Ville : {}
- Services à proximité : {}

TON RÔLE :
- Analyser la viabilité du terrain pour construction/investissement
- Identifier les points forts et faibles
- Évaluer les risques
- Donner des recommandations

IMPORTANT :
- Considérer le zonage et les réglementations locales
- Évaluer l'accès et la viabilisation
- Analyser le potentiel du quartier
- Identifier les risques (inondation, glissement, etc.)

RÉPONSE ATTENDUE (JSON strict) :
{{
    "is_viable": true,
    "viability_score": 0.85,
    "strengths": ["Point fort 1", "Point fort 2"],
    "weaknesses": ["Point faible 1"],
    "recommendations": "Recommandations détaillées",
    "risks": ["Risque 1", "Risque 2"]
}}
"#,
            superficie_m2, zonage, acces_route, acces_str, viabilise, quartier, ville, services_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[LandAnalysisAIService] Analyse viabilité générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let analysis: LandViabilityAnalysis = match serde_json::from_str(&response) {
            Ok(a) => a,
            Err(e) => {
                log::warn!(
                    "[LandAnalysisAIService] Erreur parsing JSON, utilisation analyse basique: {}",
                    e
                );
                // Fallback : analyse basique
                let score = if viabilise && acces_route { 0.7 } else { 0.4 };
                LandViabilityAnalysis {
                    is_viable: score > 0.5,
                    viability_score: score,
                    strengths: vec![],
                    weaknesses: vec![],
                    recommendations: response.clone(),
                    risks: vec![],
                }
            }
        };

        Ok(analysis)
    }

    /// Estime le prix d'un terrain avec IA
    pub async fn estimate_price(
        &self,
        superficie_m2: f64,
        type_terrain: &str,
        zonage: &str,
        quartier: &str,
        ville: &str,
        acces_route: bool,
        viabilise: bool,
    ) -> AppResult<LandPriceEstimate> {
        let prompt = format!(
            r#"
Tu es l'expert évaluation foncière IA de Yukpo.

CONTEXTE :
- Superficie : {} m²
- Type de terrain : {}
- Zonage : {}
- Quartier : {}
- Ville : {}
- Accès route : {}
- Viabilisé : {}

TON RÔLE :
- Estimer le prix réaliste du terrain
- Calculer le prix au m²
- Fournir une fourchette de prix
- Identifier les facteurs influençant le prix

IMPORTANT :
- Prendre en compte le marché local
- Considérer le zonage et le potentiel
- Analyser la localisation (quartier, ville)
- Évaluer l'impact de la viabilisation et de l'accès

RÉPONSE ATTENDUE (JSON strict) :
{{
    "estimated_price": 50000000,
    "price_per_m2": 50000,
    "price_range_min": 45000000,
    "price_range_max": 55000000,
    "confidence_level": 0.8,
    "reasoning": "Explication détaillée de l'estimation",
    "factors": ["Facteur 1", "Facteur 2", "Facteur 3"]
}}
"#,
            superficie_m2, type_terrain, zonage, quartier, ville, acces_route, viabilise
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[LandAnalysisAIService] Estimation prix générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let estimate: LandPriceEstimate = match serde_json::from_str(&response) {
            Ok(e) => e,
            Err(e) => {
                log::warn!(
                    "[LandAnalysisAIService] Erreur parsing JSON, utilisation estimation basique: {}",
                    e
                );
                // Fallback : estimation basique
                let base_price_per_m2 = if viabilise && acces_route {
                    50000.0
                } else if acces_route {
                    30000.0
                } else {
                    20000.0
                };
                let estimated_price = superficie_m2 * base_price_per_m2;
                LandPriceEstimate {
                    estimated_price,
                    price_per_m2: base_price_per_m2,
                    price_range_min: estimated_price * 0.9,
                    price_range_max: estimated_price * 1.1,
                    confidence_level: 0.6,
                    reasoning: response.clone(),
                    factors: vec!["Superficie".to_string(), "Localisation".to_string()],
                }
            }
        };

        Ok(estimate)
    }

    /// Recommande l'usage d'un terrain
    pub async fn recommend_usage(
        &self,
        superficie_m2: f64,
        zonage: &str,
        quartier: &str,
        ville: &str,
        contraintes: Option<serde_json::Value>,
    ) -> AppResult<LandUsageRecommendation> {
        let contraintes_str = contraintes
            .as_ref()
            .and_then(|c| serde_json::to_string(c).ok())
            .unwrap_or_else(|| "Aucune".to_string());

        let prompt = format!(
            r#"
Tu es le conseiller en développement foncier IA de Yukpo.

CONTEXTE :
- Superficie : {} m²
- Zonage : {}
- Quartier : {}
- Ville : {}
- Contraintes : {}

TON RÔLE :
- Recommander les meilleurs usages pour ce terrain
- Analyser la rentabilité de chaque usage
- Suggérer des développements possibles
- Fournir un raisonnement détaillé

RÉPONSE ATTENDUE (JSON strict) :
{{
    "recommended_usage": ["Résidentiel", "Commercial mixte"],
    "usage_analysis": "Analyse des usages possibles",
    "profitability_analysis": "Analyse de rentabilité",
    "development_suggestions": ["Suggestion 1", "Suggestion 2"],
    "reasoning": "Explication des recommandations"
}}
"#,
            superficie_m2, zonage, quartier, ville, contraintes_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[LandAnalysisAIService] Recommandation usage générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let recommendation: LandUsageRecommendation = match serde_json::from_str(&response) {
            Ok(r) => r,
            Err(e) => {
                log::warn!(
                    "[LandAnalysisAIService] Erreur parsing JSON, utilisation recommandation basique: {}",
                    e
                );
                LandUsageRecommendation {
                    recommended_usage: vec![zonage.to_string()],
                    usage_analysis: response.clone(),
                    profitability_analysis: "Analyse non disponible".to_string(),
                    development_suggestions: vec![],
                    reasoning: "Recommandation basique".to_string(),
                }
            }
        };

        Ok(recommendation)
    }

    /// Analyse le potentiel d'investissement
    pub async fn analyze_investment_potential(
        &self,
        superficie_m2: f64,
        prix: f64,
        quartier: &str,
        ville: &str,
        tendances_marche: Option<serde_json::Value>,
    ) -> AppResult<InvestmentPotentialAnalysis> {
        let prix_m2 = prix / superficie_m2;
        let tendances_str = tendances_marche
            .as_ref()
            .and_then(|t| serde_json::to_string(t).ok())
            .unwrap_or_else(|| "Non spécifiées".to_string());

        let prompt = format!(
            r#"
Tu es l'analyste d'investissement foncier IA de Yukpo.

CONTEXTE :
- Superficie : {} m²
- Prix : {} FCFA ({} FCFA/m²)
- Quartier : {}
- Ville : {}
- Tendances marché : {}

TON RÔLE :
- Analyser le potentiel d'investissement
- Évaluer le retour sur investissement
- Identifier les risques et opportunités
- Recommander un horizon temporel

RÉPONSE ATTENDUE (JSON strict) :
{{
    "investment_score": 0.75,
    "potential_return": "Élevé",
    "time_horizon": "Moyen terme",
    "risks": ["Risque 1", "Risque 2"],
    "opportunities": ["Opportunité 1", "Opportunité 2"],
    "recommendations": "Recommandations d'investissement"
}}
"#,
            superficie_m2, prix, prix_m2, quartier, ville, tendances_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[LandAnalysisAIService] Analyse investissement générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let analysis: InvestmentPotentialAnalysis = match serde_json::from_str(&response) {
            Ok(a) => a,
            Err(e) => {
                log::warn!(
                    "[LandAnalysisAIService] Erreur parsing JSON, utilisation analyse basique: {}",
                    e
                );
                InvestmentPotentialAnalysis {
                    investment_score: 0.6,
                    potential_return: "Moyen".to_string(),
                    time_horizon: "Moyen terme".to_string(),
                    risks: vec![],
                    opportunities: vec![],
                    recommendations: response.clone(),
                }
            }
        };

        Ok(analysis)
    }
}
