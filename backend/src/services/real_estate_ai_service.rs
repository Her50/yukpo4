//! ✅ Service IA pour Immobilier (Vente/Location)
//!
//! Ce service utilise l'IA pour :
//! - Estimer le prix d'un bien immobilier
//! - Recommander des biens selon profil/budget
//! - Analyser le marché immobilier local
//! - Suggérer des investissements
//! - Détecter des anomalies dans les annonces

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Estimation de prix d'un bien immobilier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceEstimate {
    pub estimated_price: f64,
    pub price_per_m2: f64,
    pub price_range_min: f64,
    pub price_range_max: f64,
    pub confidence_level: f64, // 0.0 à 1.0
    pub reasoning: String,
    pub market_analysis: String,
    pub factors: Vec<String>, // Facteurs influençant le prix
}

/// Recommandations de biens selon profil
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyRecommendation {
    pub property_ids: Vec<i32>,
    pub recommendations: String,
    pub budget_analysis: String,
    pub location_analysis: String,
    pub investment_potential: Option<String>,
}

/// Analyse de marché immobilier local
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketAnalysis {
    pub average_price_per_m2: f64,
    pub price_trend: String, // "rising", "stable", "falling"
    pub demand_level: String, // "high", "medium", "low"
    pub best_areas: Vec<String>,
    pub investment_opportunities: Vec<String>,
    pub analysis: String,
}

/// Simulation de prêt immobilier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoanSimulation {
    pub property_price: f64,
    pub down_payment: f64,
    pub loan_amount: f64,
    pub interest_rate: f64,
    pub loan_duration_years: i32,
    pub monthly_payment: f64,
    pub total_interest: f64,
    pub total_cost: f64,
    pub affordability_analysis: String,
    pub recommendations: String,
}

/// Service IA pour Immobilier
pub struct RealEstateAIService {
    app_ia: Arc<AppIA>,
}

impl RealEstateAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Estime le prix d'un bien immobilier avec IA
    pub async fn estimate_property_price(
        &self,
        type_bien: &str,
        superficie_m2: f64,
        nb_chambres: i32,
        standing: &str,
        quartier: &str,
        ville: &str,
        equipements: Option<serde_json::Value>,
    ) -> AppResult<PriceEstimate> {
        let equipements_str = equipements
            .as_ref()
            .and_then(|e| serde_json::to_string(e).ok())
            .unwrap_or_else(|| "Non spécifiés".to_string());

        let prompt = format!(
            r#"
Tu es l'expert immobilier IA de Yukpomnang spécialisé dans l'évaluation de biens immobiliers en Afrique francophone.

CONTEXTE :
- Type de bien : {}
- Superficie : {} m²
- Nombre de chambres : {}
- Standing : {}
- Quartier : {}
- Ville : {}
- Équipements : {}

TON RÔLE :
- Estimer le prix de vente/location réaliste du bien
- Analyser le marché local
- Fournir une fourchette de prix
- Identifier les facteurs influençant le prix

IMPORTANT :
- Prendre en compte le marché local africain
- Considérer les spécificités du quartier
- Analyser les équipements disponibles
- Fournir des estimations réalistes

RÉPONSE ATTENDUE (JSON strict) :
{{
    "estimated_price": 50000000,
    "price_per_m2": 500000,
    "price_range_min": 45000000,
    "price_range_max": 55000000,
    "confidence_level": 0.85,
    "reasoning": "Explication détaillée de l'estimation",
    "market_analysis": "Analyse du marché local",
    "factors": ["Facteur 1", "Facteur 2", "Facteur 3"]
}}
"#,
            type_bien, superficie_m2, nb_chambres, standing, quartier, ville, equipements_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[RealEstateAIService] Estimation prix générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let estimate: PriceEstimate = match serde_json::from_str(&response) {
            Ok(e) => e,
            Err(e) => {
                log::warn!(
                    "[RealEstateAIService] Erreur parsing JSON, utilisation estimation basique: {}",
                    e
                );
                // Fallback : estimation basique
                PriceEstimate {
                    estimated_price: superficie_m2 * 500000.0, // Prix moyen par m²
                    price_per_m2: 500000.0,
                    price_range_min: superficie_m2 * 400000.0,
                    price_range_max: superficie_m2 * 600000.0,
                    confidence_level: 0.5,
                    reasoning: response.clone(),
                    market_analysis: "Analyse non disponible".to_string(),
                    factors: vec!["Superficie".to_string(), "Standing".to_string()],
                }
            }
        };

        Ok(estimate)
    }

    /// Recommande des biens selon profil/budget
    pub async fn recommend_properties(
        &self,
        budget_max: f64,
        type_bien: Option<&str>,
        nb_chambres_min: Option<i32>,
        quartier: Option<&str>,
        ville: &str,
        preferences: Option<serde_json::Value>,
    ) -> AppResult<PropertyRecommendation> {
        let type_bien_str = type_bien.unwrap_or("Tous types");
        let nb_chambres_str = nb_chambres_min
            .map(|n| n.to_string())
            .unwrap_or_else(|| "Non spécifié".to_string());
        let quartier_str = quartier.unwrap_or("Tous quartiers");
        let preferences_str = preferences
            .as_ref()
            .and_then(|p| serde_json::to_string(p).ok())
            .unwrap_or_else(|| "Non spécifiées".to_string());

        let prompt = format!(
            r#"
Tu es l'assistant immobilier intelligent de Yukpomnang.

CONTEXTE :
- Budget maximum : {} FCFA
- Type de bien souhaité : {}
- Nombre de chambres minimum : {}
- Quartier souhaité : {}
- Ville : {}
- Préférences : {}

TON RÔLE :
- Recommander les meilleurs biens selon le budget
- Analyser la faisabilité du budget
- Suggérer des alternatives
- Évaluer le potentiel d'investissement

RÉPONSE ATTENDUE (JSON strict) :
{{
    "property_ids": [1, 2, 3],
    "recommendations": "Description des recommandations",
    "budget_analysis": "Analyse de la faisabilité budgétaire",
    "location_analysis": "Analyse de la localisation",
    "investment_potential": "Potentiel d'investissement si applicable"
}}
"#,
            budget_max, type_bien_str, nb_chambres_str, quartier_str, ville, preferences_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[RealEstateAIService] Recommandations générées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let recommendation: PropertyRecommendation = match serde_json::from_str(&response) {
            Ok(r) => r,
            Err(e) => {
                log::warn!(
                    "[RealEstateAIService] Erreur parsing JSON, utilisation recommandation basique: {}",
                    e
                );
                PropertyRecommendation {
                    property_ids: vec![],
                    recommendations: response.clone(),
                    budget_analysis: "Analyse non disponible".to_string(),
                    location_analysis: "Analyse non disponible".to_string(),
                    investment_potential: None,
                }
            }
        };

        Ok(recommendation)
    }

    /// Analyse le marché immobilier local
    pub async fn analyze_local_market(
        &self,
        ville: &str,
        quartier: Option<&str>,
        type_bien: Option<&str>,
    ) -> AppResult<MarketAnalysis> {
        let quartier_str = quartier.unwrap_or("Tous quartiers");
        let type_bien_str = type_bien.unwrap_or("Tous types");

        let prompt = format!(
            r#"
Tu es l'analyste immobilier IA de Yukpomnang.

CONTEXTE :
- Ville : {}
- Quartier : {}
- Type de bien : {}

TON RÔLE :
- Analyser le marché immobilier local
- Identifier les tendances de prix
- Évaluer la demande
- Suggérer les meilleures zones d'investissement

RÉPONSE ATTENDUE (JSON strict) :
{{
    "average_price_per_m2": 500000,
    "price_trend": "rising",
    "demand_level": "high",
    "best_areas": ["Quartier 1", "Quartier 2"],
    "investment_opportunities": ["Opportunité 1", "Opportunité 2"],
    "analysis": "Analyse détaillée du marché"
}}
"#,
            ville, quartier_str, type_bien_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[RealEstateAIService] Analyse marché générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let analysis: MarketAnalysis = match serde_json::from_str(&response) {
            Ok(a) => a,
            Err(e) => {
                log::warn!(
                    "[RealEstateAIService] Erreur parsing JSON, utilisation analyse basique: {}",
                    e
                );
                MarketAnalysis {
                    average_price_per_m2: 500000.0,
                    price_trend: "stable".to_string(),
                    demand_level: "medium".to_string(),
                    best_areas: vec![],
                    investment_opportunities: vec![],
                    analysis: response.clone(),
                }
            }
        };

        Ok(analysis)
    }

    /// Simule un prêt immobilier
    pub async fn simulate_loan(
        &self,
        property_price: f64,
        down_payment_percent: f64,
        loan_duration_years: i32,
        monthly_income: Option<f64>,
    ) -> AppResult<LoanSimulation> {
        let down_payment = property_price * (down_payment_percent / 100.0);
        let loan_amount = property_price - down_payment;
        let monthly_income_str = monthly_income
            .map(|i| i.to_string())
            .unwrap_or_else(|| "Non spécifié".to_string());

        let prompt = format!(
            r#"
Tu es le conseiller financier immobilier IA de Yukpomnang.

CONTEXTE :
- Prix du bien : {} FCFA
- Apport : {} FCFA ({}%)
- Durée du prêt : {} ans
- Revenu mensuel : {} FCFA

TON RÔLE :
- Simuler le prêt immobilier
- Calculer les mensualités
- Analyser la capacité de remboursement
- Donner des recommandations

IMPORTANT :
- Taux d'intérêt moyen : 8-12% par an (selon profil)
- Analyser l'accessibilité financière
- Suggérer des optimisations

RÉPONSE ATTENDUE (JSON strict) :
{{
    "property_price": 50000000,
    "down_payment": 10000000,
    "loan_amount": 40000000,
    "interest_rate": 10.0,
    "loan_duration_years": 20,
    "monthly_payment": 386000,
    "total_interest": 52640000,
    "total_cost": 92640000,
    "affordability_analysis": "Analyse de la capacité de remboursement",
    "recommendations": "Recommandations personnalisées"
}}
"#,
            property_price,
            down_payment,
            down_payment_percent,
            loan_duration_years,
            monthly_income_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[RealEstateAIService] Simulation prêt générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let simulation: LoanSimulation = match serde_json::from_str(&response) {
            Ok(s) => s,
            Err(e) => {
                log::warn!(
                    "[RealEstateAIService] Erreur parsing JSON, utilisation simulation basique: {}",
                    e
                );
                // Fallback : calcul basique
                let interest_rate = 10.0;
                let monthly_rate = interest_rate / 100.0 / 12.0;
                let num_payments = loan_duration_years * 12;
                let monthly_payment = loan_amount
                    * (monthly_rate * (1.0_f64 + monthly_rate).powi(num_payments))
                    / ((1.0_f64 + monthly_rate).powi(num_payments) - 1.0);
                let total_interest = (monthly_payment * num_payments as f64) - loan_amount;

                LoanSimulation {
                    property_price,
                    down_payment,
                    loan_amount,
                    interest_rate,
                    loan_duration_years,
                    monthly_payment,
                    total_interest,
                    total_cost: property_price + total_interest,
                    affordability_analysis: response.clone(),
                    recommendations: "Consultez un conseiller financier".to_string(),
                }
            }
        };

        Ok(simulation)
    }

    /// Détecte des anomalies dans une annonce
    pub async fn detect_anomalies(
        &self,
        property_data: serde_json::Value,
    ) -> AppResult<Vec<String>> {
        let property_str = serde_json::to_string(&property_data)
            .unwrap_or_else(|_| "Données non disponibles".to_string());

        let prompt = format!(
            r#"
Tu es l'expert immobilier IA de Yukpomnang spécialisé dans la détection d'anomalies.

CONTEXTE :
Données du bien :
{}

TON RÔLE :
- Détecter les anomalies potentielles (prix suspect, incohérences, etc.)
- Identifier les informations manquantes
- Signaler les risques

RÉPONSE ATTENDUE (JSON strict) :
{{
    "anomalies": ["Anomalie 1", "Anomalie 2"]
}}
"#,
            property_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[RealEstateAIService] Détection anomalies avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let anomalies: Vec<String> = match serde_json::from_str::<serde_json::Value>(&response) {
            Ok(v) => {
                if let Some(anoms) = v.get("anomalies").and_then(|a| a.as_array()) {
                    anoms
                        .iter()
                        .filter_map(|a| a.as_str().map(|s| s.to_string()))
                        .collect()
                } else {
                    vec![]
                }
            }
            Err(e) => {
                log::warn!("[RealEstateAIService] Erreur parsing anomalies: {}", e);
                vec![]
            }
        };

        Ok(anomalies)
    }
}

