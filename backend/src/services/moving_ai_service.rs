//! ✅ Service IA pour Déménagement
//!
//! Ce service utilise l'IA pour :
//! - Calculer le volume de meubles avec IA
//! - Estimer le coût de déménagement
//! - Optimiser le plan de déménagement
//! - Suggérer des entreprises selon trajet
//! - Prédire la durée de déménagement

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

/// Estimation de volume
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeEstimate {
    pub total_volume_m3: f64,
    pub volume_breakdown: serde_json::Value, // Par pièce ou type
    pub nb_camions_estime: i32,
    pub reasoning: String,
}

/// Estimation de coût déménagement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MovingCostEstimate {
    pub total_cost: f64,
    pub cost_breakdown: serde_json::Value,
    pub distance_km: f64,
    pub duree_estimee_heures: f64,
    pub recommendations: String,
    pub alternatives: Vec<String>, // Alternatives moins chères
}

/// Plan de déménagement optimisé
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MovingPlan {
    pub steps: Vec<String>,          // Étapes du déménagement
    pub timeline: serde_json::Value, // Timeline détaillée
    pub equipment_needed: Vec<String>,
    pub team_size: i32,
    pub recommendations: String,
}

/// Prédiction de durée
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DurationPrediction {
    pub total_duration_hours: f64,
    pub duration_breakdown: serde_json::Value,
    pub factors: Vec<String>, // Facteurs influençant la durée
    pub recommendations: String,
}

/// Service IA pour Déménagement
pub struct MovingAIService {
    app_ia: Arc<AppIA>,
}

impl MovingAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Calcule le volume de meubles avec IA
    pub async fn calculate_volume(
        &self,
        nb_pieces: i32,
        type_habitation: &str,
        meubles: Option<serde_json::Value>, // Liste des meubles
        superficie_m2: Option<f64>,
    ) -> AppResult<VolumeEstimate> {
        let meubles_str = meubles
            .as_ref()
            .and_then(|m| serde_json::to_string(m).ok())
            .unwrap_or_else(|| "Non spécifiés".to_string());
        let superficie_str = superficie_m2
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Non spécifiée".to_string());

        let prompt = format!(
            r#"
Tu es l'expert déménagement IA de Yukpo.

CONTEXTE :
- Nombre de pièces : {}
- Type d'habitation : {}
- Superficie : {} m²
- Meubles : {}

TON RÔLE :
- Estimer le volume total à déménager
- Répartir par pièce ou type
- Estimer le nombre de camions nécessaires
- Fournir un raisonnement détaillé

IMPORTANT :
- Prendre en compte les meubles, électroménager, cartons
- Considérer l'espace perdu (emballage, protection)
- Utiliser des estimations réalistes

RÉPONSE ATTENDUE (JSON strict) :
{{
    "total_volume_m3": 25.5,
    "volume_breakdown": {{"salon": 8.0, "chambre": 5.0, "cuisine": 4.0, "cartons": 8.5}},
    "nb_camions_estime": 1,
    "reasoning": "Explication du calcul"
}}
"#,
            nb_pieces, type_habitation, superficie_str, meubles_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[MovingAIService] Calcul volume généré avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let estimate: VolumeEstimate = match serde_json::from_str(&response) {
            Ok(e) => e,
            Err(e) => {
                log::warn!(
                    "[MovingAIService] Erreur parsing JSON, utilisation estimation basique: {}",
                    e
                );
                // Fallback : estimation basique (environ 1 m³ par pièce)
                let total_volume = nb_pieces as f64 * 1.5;
                VolumeEstimate {
                    total_volume_m3: total_volume,
                    volume_breakdown: json!({}),
                    nb_camions_estime: if total_volume > 20.0 { 2 } else { 1 },
                    reasoning: response.clone(),
                }
            }
        };

        Ok(estimate)
    }

    /// Estime le coût de déménagement
    pub async fn estimate_cost(
        &self,
        adresse_depart: &str,
        adresse_arrivee: &str,
        distance_km: Option<f64>,
        volume_m3: f64,
        nb_pieces: i32,
        services_additionnels: Option<serde_json::Value>, // {"emballage": true, "demontage": true}
    ) -> AppResult<MovingCostEstimate> {
        let distance_str =
            distance_km.map(|d| d.to_string()).unwrap_or_else(|| "À calculer".to_string());
        let services_str = services_additionnels
            .as_ref()
            .and_then(|s| serde_json::to_string(s).ok())
            .unwrap_or_else(|| "Aucun".to_string());

        let prompt = format!(
            r#"
Tu es l'estimateur de coûts déménagement IA de Yukpo.

CONTEXTE :
- Adresse départ : {}
- Adresse arrivée : {}
- Distance : {} km
- Volume : {} m³
- Nombre de pièces : {}
- Services additionnels : {}

TON RÔLE :
- Estimer le coût total du déménagement
- Répartir les coûts (transport, main-d'œuvre, services)
- Estimer la durée
- Proposer des alternatives moins chères

IMPORTANT :
- Prix moyens : 5000-10000 FCFA/km, 50000-100000 FCFA/m³
- Prendre en compte les services additionnels
- Considérer la complexité (étages, accès, etc.)

RÉPONSE ATTENDUE (JSON strict) :
{{
    "total_cost": 500000,
    "cost_breakdown": {{"transport": 200000, "main_oeuvre": 200000, "emballage": 100000}},
    "distance_km": 15.5,
    "duree_estimee_heures": 4.5,
    "recommendations": "Recommandations",
    "alternatives": ["Alternative 1", "Alternative 2"]
}}
"#,
            adresse_depart, adresse_arrivee, distance_str, volume_m3, nb_pieces, services_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[MovingAIService] Estimation coût générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let estimate: MovingCostEstimate = match serde_json::from_str(&response) {
            Ok(e) => e,
            Err(e) => {
                log::warn!(
                    "[MovingAIService] Erreur parsing JSON, utilisation estimation basique: {}",
                    e
                );
                // Fallback : estimation basique
                let distance = distance_km.unwrap_or(10.0);
                let base_cost = volume_m3 * 50000.0 + distance * 5000.0;
                MovingCostEstimate {
                    total_cost: base_cost,
                    cost_breakdown: json!({
                        "transport": distance * 5000.0,
                        "main_oeuvre": volume_m3 * 30000.0,
                        "emballage": volume_m3 * 20000.0
                    }),
                    distance_km: distance,
                    duree_estimee_heures: (volume_m3 / 10.0) + (distance / 30.0) + 2.0,
                    recommendations: response.clone(),
                    alternatives: vec![],
                }
            }
        };

        Ok(estimate)
    }

    /// Optimise le plan de déménagement
    pub async fn optimize_plan(
        &self,
        volume_m3: f64,
        distance_km: f64,
        contraintes: Option<serde_json::Value>, // {"etage_depart": 3, "etage_arrivee": 1, "ascenseur": false}
    ) -> AppResult<MovingPlan> {
        let contraintes_str = contraintes
            .as_ref()
            .and_then(|c| serde_json::to_string(c).ok())
            .unwrap_or_else(|| "Aucune".to_string());

        let prompt = format!(
            r#"
Tu es le planificateur déménagement IA de Yukpo.

CONTEXTE :
- Volume : {} m³
- Distance : {} km
- Contraintes : {}

TON RÔLE :
- Créer un plan de déménagement optimisé
- Définir les étapes chronologiques
- Estimer la taille de l'équipe nécessaire
- Identifier l'équipement requis
- Optimiser le timing

RÉPONSE ATTENDUE (JSON strict) :
{{
    "steps": ["Étape 1", "Étape 2", "Étape 3"],
    "timeline": {{"preparation": "2h", "chargement": "1h", "transport": "1h", "dechargement": "1h"}},
    "equipment_needed": ["Équipement 1", "Équipement 2"],
    "team_size": 3,
    "recommendations": "Recommandations d'optimisation"
}}
"#,
            volume_m3, distance_km, contraintes_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[MovingAIService] Plan optimisé généré avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let plan: MovingPlan = match serde_json::from_str(&response) {
            Ok(p) => p,
            Err(e) => {
                log::warn!(
                    "[MovingAIService] Erreur parsing JSON, utilisation plan basique: {}",
                    e
                );
                MovingPlan {
                    steps: vec![
                        "Préparation et emballage".to_string(),
                        "Chargement".to_string(),
                        "Transport".to_string(),
                        "Déchargement".to_string(),
                    ],
                    timeline: json!({}),
                    equipment_needed: vec![],
                    team_size: if volume_m3 > 20.0 { 4 } else { 2 },
                    recommendations: response.clone(),
                }
            }
        };

        Ok(plan)
    }

    /// Prédit la durée de déménagement
    pub async fn predict_duration(
        &self,
        volume_m3: f64,
        distance_km: f64,
        nb_pieces: i32,
        contraintes: Option<serde_json::Value>,
    ) -> AppResult<DurationPrediction> {
        let contraintes_str = contraintes
            .as_ref()
            .and_then(|c| serde_json::to_string(c).ok())
            .unwrap_or_else(|| "Aucune".to_string());

        let prompt = format!(
            r#"
Tu es le prédicteur de durée déménagement IA de Yukpo.

CONTEXTE :
- Volume : {} m³
- Distance : {} km
- Nombre de pièces : {}
- Contraintes : {}

TON RÔLE :
- Prédire la durée totale du déménagement
- Répartir par phase (préparation, chargement, transport, déchargement)
- Identifier les facteurs influençant la durée
- Donner des recommandations

RÉPONSE ATTENDUE (JSON strict) :
{{
    "total_duration_hours": 6.5,
    "duration_breakdown": {{"preparation": 2.0, "chargement": 1.5, "transport": 1.0, "dechargement": 2.0}},
    "factors": ["Facteur 1", "Facteur 2"],
    "recommendations": "Recommandations"
}}
"#,
            volume_m3, distance_km, nb_pieces, contraintes_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[MovingAIService] Prédiction durée générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let prediction: DurationPrediction = match serde_json::from_str(&response) {
            Ok(p) => p,
            Err(e) => {
                log::warn!(
                    "[MovingAIService] Erreur parsing JSON, utilisation prédiction basique: {}",
                    e
                );
                // Fallback : calcul basique
                let base_duration = (volume_m3 / 10.0) + (distance_km / 30.0) + 2.0;
                DurationPrediction {
                    total_duration_hours: base_duration,
                    duration_breakdown: json!({
                        "preparation": base_duration * 0.3,
                        "chargement": base_duration * 0.25,
                        "transport": base_duration * 0.2,
                        "dechargement": base_duration * 0.25
                    }),
                    factors: vec!["Volume".to_string(), "Distance".to_string()],
                    recommendations: response.clone(),
                }
            }
        };

        Ok(prediction)
    }
}
