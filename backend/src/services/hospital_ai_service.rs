//! ✅ Service IA pour Hôpitaux/Cliniques
//!
//! Ce service utilise l'IA pour :
//! - Recommander des hôpitaux basés sur les symptômes
//! - Analyser la sévérité des urgences (triage)
//! - Suggérer des spécialités adaptées
//! - Escalader vers urgence si nécessaire

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

/// Recommandations d'hôpitaux basées sur les symptômes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HospitalRecommendation {
    pub hospital_ids: Vec<i32>,
    pub specialties: Vec<String>,
    pub urgency_level: Option<i32>, // 1-5, None si non urgent
    pub recommendations: String,
    pub advice: String,
}

/// Analyse de sévérité d'urgence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmergencySeverityAnalysis {
    pub severity_level: i32, // 1-5
    pub is_critical: bool,
    pub suggested_action: String,
    pub time_to_treatment_minutes: Option<i32>,
    pub reasoning: String,
}

/// Service IA pour Hôpitaux
pub struct HospitalAIService {
    app_ia: Arc<AppIA>,
}

impl HospitalAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Génère des recommandations d'hôpitaux basées sur les symptômes
    pub async fn generate_hospital_recommendations(
        &self,
        symptoms: &str,
        location: Option<&str>,
        user_location: Option<(f64, f64)>,
    ) -> AppResult<HospitalRecommendation> {
        let location_str = location.unwrap_or("Non spécifiée");
        let user_location_str = if let Some((lat, lng)) = user_location {
            format!("({}, {})", lat, lng)
        } else {
            "Non spécifiée".to_string()
        };

        let prompt = format!(
            r#"
Tu es l'assistant médical intelligent de Yukpomnang.

CONTEXTE :
- Symptômes décrits : {}
- Localisation recherchée : {}
- Position GPS utilisateur : {}

TON RÔLE :
- Analyser les symptômes pour recommander les hôpitaux/cliniques les plus adaptés
- Proposer des spécialités médicales pertinentes
- Donner des conseils de santé généraux (sans diagnostic médical)
- Escalader vers urgence si nécessaire

IMPORTANT :
- Ne JAMAIS faire de diagnostic médical
- Toujours recommander de consulter un professionnel de santé
- En cas d'urgence vitale, diriger immédiatement vers les urgences
- Identifier le niveau d'urgence (1=critique, 5=non urgent)

RÉPONSE ATTENDUE (JSON strict) :
{{
    "hospital_ids": [1, 2, 3],
    "specialties": ["Cardiologie", "Médecine générale"],
    "urgency_level": 3,
    "recommendations": "Description des recommandations",
    "advice": "Conseils généraux pour le patient"
}}
"#,
            symptoms, location_str, user_location_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[HospitalAIService] Recommandations générées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let recommendation: HospitalRecommendation = match serde_json::from_str(&response) {
            Ok(r) => r,
            Err(e) => {
                log::warn!(
                    "[HospitalAIService] Erreur parsing JSON, utilisation réponse textuelle: {}",
                    e
                );
                // Fallback : créer une recommandation basique depuis le texte
                HospitalRecommendation {
                    hospital_ids: vec![],
                    specialties: vec![],
                    urgency_level: None,
                    recommendations: response.clone(),
                    advice: "Consultez un professionnel de santé rapidement.".to_string(),
                }
            }
        };

        Ok(recommendation)
    }

    /// Analyse la sévérité d'une urgence (triage intelligent)
    pub async fn analyze_emergency_severity(
        &self,
        symptoms: &str,
        age: Option<i32>,
        vital_signs: Option<serde_json::Value>,
    ) -> AppResult<EmergencySeverityAnalysis> {
        let age_str = age
            .map(|a| a.to_string())
            .unwrap_or_else(|| "Non spécifié".to_string());
        let vital_signs_str = vital_signs
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok())
            .unwrap_or_else(|| "Non disponibles".to_string());

        let prompt = format!(
            r#"
Tu es un système de triage médical intelligent pour Yukpomnang.

CONTEXTE :
- Symptômes : {}
- Âge du patient : {}
- Signes vitaux : {}

TON RÔLE :
- Évaluer la sévérité de l'urgence (1=critique, 5=non urgent)
- Déterminer si la situation est critique
- Proposer une action immédiate
- Estimer le temps nécessaire avant traitement

RÈGLES :
- Niveau 1 (Critique) : Urgence vitale, soins immédiats nécessaires
- Niveau 2 (Urgent) : Nécessite soins dans l'heure
- Niveau 3 (Semi-urgent) : Nécessite soins dans les 4 heures
- Niveau 4 (Moins urgent) : Nécessite soins dans les 24 heures
- Niveau 5 (Non urgent) : Consultation normale

RÉPONSE ATTENDUE (JSON strict) :
{{
    "severity_level": 3,
    "is_critical": false,
    "suggested_action": "Se rendre aux urgences dans les 4 heures",
    "time_to_treatment_minutes": 240,
    "reasoning": "Explication de l'évaluation"
}}
"#,
            symptoms, age_str, vital_signs_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[HospitalAIService] Analyse sévérité avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let analysis: EmergencySeverityAnalysis = match serde_json::from_str(&response) {
            Ok(a) => a,
            Err(e) => {
                log::warn!(
                    "[HospitalAIService] Erreur parsing JSON, utilisation réponse basique: {}",
                    e
                );
                // Fallback : urgence moyenne
                EmergencySeverityAnalysis {
                    severity_level: 3,
                    is_critical: false,
                    suggested_action: "Consultez un professionnel de santé rapidement.".to_string(),
                    time_to_treatment_minutes: Some(240),
                    reasoning: response.clone(),
                }
            }
        };

        Ok(analysis)
    }

    /// Suggère des spécialités médicales adaptées
    pub async fn suggest_specialty(
        &self,
        symptoms: &str,
        medical_history: Option<&str>,
    ) -> AppResult<Vec<String>> {
        let history_str = medical_history.unwrap_or("Non spécifiée");

        let prompt = format!(
            r#"
Tu es un assistant médical spécialisé dans l'orientation des patients.

CONTEXTE :
- Symptômes : {}
- Historique médical : {}

TON RÔLE :
- Identifier les spécialités médicales les plus pertinentes
- Proposer 1-3 spécialités en ordre de priorité

RÉPONSE ATTENDUE (JSON strict) :
{{
    "specialties": ["Cardiologie", "Médecine générale"]
}}

Retourne UNIQUEMENT le JSON, sans texte supplémentaire.
"#,
            symptoms, history_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[HospitalAIService] Suggestions spécialités avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let specialties: Vec<String> = match serde_json::from_str::<serde_json::Value>(&response) {
            Ok(v) => {
                if let Some(specs) = v.get("specialties").and_then(|s| s.as_array()) {
                    specs
                        .iter()
                        .filter_map(|s| s.as_str().map(|s| s.to_string()))
                        .collect()
                } else {
                    vec![]
                }
            }
            Err(e) => {
                log::warn!("[HospitalAIService] Erreur parsing spécialités: {}", e);
                vec!["Médecine générale".to_string()]
            }
        };

        Ok(specialties)
    }
}

/// Fonctions helper pour intégration facile dans les contrôleurs
pub async fn generate_hospital_recommendations(
    app_ia: Arc<AppIA>,
    symptoms: &str,
    location: Option<&str>,
) -> AppResult<String> {
    let service = HospitalAIService::new(app_ia);
    let recommendation = service
        .generate_hospital_recommendations(symptoms, location, None)
        .await?;

    Ok(recommendation.recommendations)
}

pub async fn analyze_emergency_severity(app_ia: Arc<AppIA>, symptoms: &str) -> AppResult<i32> {
    let service = HospitalAIService::new(app_ia);
    let analysis = service
        .analyze_emergency_severity(symptoms, None, None)
        .await?;

    Ok(analysis.severity_level)
}
