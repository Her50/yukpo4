//! ✅ Service IA pour Banques de Sang
//!
//! Ce service utilise l'IA pour :
//! - Prédire les besoins futurs en sang
//! - Optimiser la distribution des stocks
//! - Analyser les tendances de don
//! - Suggérer des campagnes de sensibilisation

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Prédiction de besoins futurs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BloodDemandForecast {
    pub period: String, // "7_days", "30_days", "90_days"
    pub predictions: Vec<GroupForecast>,
    pub confidence: f32, // 0.0-1.0
    pub factors: Vec<String>,
}

/// Prévision par groupe sanguin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupForecast {
    pub blood_group: String,
    pub expected_demand: i32,
    pub current_stock: i32,
    pub shortage_risk: String, // "critical", "high", "moderate", "low", "none"
    pub recommended_actions: Vec<String>,
}

/// Optimisation de distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistributionOptimization {
    pub recommendations: Vec<DistributionRecommendation>,
    pub total_units: i32,
    pub efficiency_gain: f32, // Pourcentage d'amélioration
}

/// Recommandation de distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistributionRecommendation {
    pub from_bank_id: i32,
    pub to_bank_id: i32,
    pub blood_group: String,
    pub quantity: i32,
    pub reason: String,
    pub urgency: String, // "critical", "high", "moderate", "low"
}

/// Service IA pour Banques de Sang
pub struct BloodBankAIService {
    app_ia: Arc<AppIA>,
}

impl BloodBankAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Prédit les besoins futurs en sang
    pub async fn predict_blood_demand(
        &self,
        bank_id: Option<i32>,
        historical_data: Option<serde_json::Value>,
        period: &str, // "7_days", "30_days", "90_days"
    ) -> AppResult<BloodDemandForecast> {
        let bank_str = bank_id
            .map(|b| b.to_string())
            .unwrap_or_else(|| "Toutes les banques".to_string());
        let historical_str = historical_data
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok())
            .unwrap_or_else(|| "Données historiques non disponibles".to_string());

        let prompt = format!(
            r#"
Tu es un expert en prédiction de besoins sanguins pour Yukpo.

CONTEXTE :
- Banque de sang : {}
- Période de prédiction : {}
- Données historiques : {}

TON RÔLE :
- Analyser les tendances historiques
- Prédire les besoins futurs par groupe sanguin
- Identifier les risques de pénurie
- Recommander des actions préventives

FACTEURS À CONSIDÉRER :
- Saisonnalité (périodes de fêtes, vacances)
- Tendances historiques
- Événements locaux prévus
- Taux de don moyen

RÉPONSE ATTENDUE (JSON strict) :
{{
    "period": "{}",
    "predictions": [
        {{
            "blood_group": "O+",
            "expected_demand": 50,
            "current_stock": 30,
            "shortage_risk": "high",
            "recommended_actions": ["Organiser campagne de don", "Contacter donneurs réguliers"]
        }}
    ],
    "confidence": 0.85,
    "factors": ["Saison des fêtes", "Tendance haussière"]
}}
"#,
            bank_str, period, historical_str, period
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BloodBankAIService] Prédiction générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let forecast: BloodDemandForecast = match serde_json::from_str(&response) {
            Ok(f) => f,
            Err(e) => {
                log::warn!("[BloodBankAIService] Erreur parsing JSON: {}", e);
                BloodDemandForecast {
                    period: period.to_string(),
                    predictions: vec![],
                    confidence: 0.5,
                    factors: vec!["Données insuffisantes".to_string()],
                }
            }
        };

        Ok(forecast)
    }

    /// Optimise la distribution des stocks entre banques
    pub async fn optimize_blood_distribution(
        &self,
        banks_stocks: serde_json::Value,
        current_requests: Option<serde_json::Value>,
    ) -> AppResult<DistributionOptimization> {
        let stocks_str = serde_json::to_string(&banks_stocks).unwrap_or_else(|_| "{}".to_string());
        let requests_str = current_requests
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok())
            .unwrap_or_else(|| "Aucune demande en attente".to_string());

        let prompt = format!(
            r#"
Tu es un expert en optimisation de distribution de stocks sanguins pour Yukpo.

CONTEXTE :
- Stocks actuels par banque : {}
- Demandes en attente : {}

TON RÔLE :
- Analyser les stocks disponibles dans chaque banque
- Identifier les déséquilibres (surplus/déficit)
- Recommander des transferts optimaux entre banques
- Minimiser les pertes et maximiser l'efficacité

CRITÈRES D'OPTIMISATION :
- Prioriser les urgences critiques
- Réduire les risques de péremption
- Équilibrer les stocks entre banques proches
- Minimiser les distances de transport

RÉPONSE ATTENDUE (JSON strict) :
{{
    "recommendations": [
        {{
            "from_bank_id": 1,
            "to_bank_id": 2,
            "blood_group": "O+",
            "quantity": 10,
            "reason": "Surplus dans banque 1, déficit critique dans banque 2",
            "urgency": "critical"
        }}
    ],
    "total_units": 10,
    "efficiency_gain": 15.5
}}
"#,
            stocks_str, requests_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BloodBankAIService] Optimisation générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let optimization: DistributionOptimization = match serde_json::from_str(&response) {
            Ok(o) => o,
            Err(e) => {
                log::warn!("[BloodBankAIService] Erreur parsing JSON: {}", e);
                DistributionOptimization {
                    recommendations: vec![],
                    total_units: 0,
                    efficiency_gain: 0.0,
                }
            }
        };

        Ok(optimization)
    }

    /// Analyse les tendances de don
    pub async fn analyze_donation_trends(
        &self,
        historical_donations: serde_json::Value,
        period: &str,
    ) -> AppResult<String> {
        let donations_str =
            serde_json::to_string(&historical_donations).unwrap_or_else(|_| "{}".to_string());

        let prompt = format!(
            r#"
Tu es un analyste expert en tendances de don de sang pour Yukpo.

CONTEXTE :
- Données historiques de dons : {}
- Période analysée : {}

TON RÔLE :
- Identifier les tendances (augmentation, diminution, stabilité)
- Analyser les facteurs influençant les dons
- Proposer des stratégies d'amélioration
- Recommander des campagnes de sensibilisation

RÉPONSE ATTENDUE :
Analyse détaillée des tendances avec recommandations d'actions.
"#,
            donations_str, period
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[BloodBankAIService] Analyse tendances avec {} (tokens: {})",
            model_name,
            tokens
        );

        Ok(response)
    }
}

/// Fonctions helper pour intégration facile dans les contrôleurs
pub async fn predict_blood_demand(app_ia: Arc<AppIA>, period: &str) -> AppResult<String> {
    let service = BloodBankAIService::new(app_ia);
    let forecast = service.predict_blood_demand(None, None, period).await?;

    Ok(format!(
        "Prédictions pour {}: {} groupes analysés",
        forecast.period,
        forecast.predictions.len()
    ))
}
