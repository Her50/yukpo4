//! ✅ Service IA pour Pharmacies
//!
//! Ce service utilise l'IA pour :
//! - Vérifier les interactions médicamenteuses
//! - Recommander des posologies
//! - Suggérer des alternatives si médicament indisponible
//! - Donner des conseils pharmaceutiques personnalisés

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Analyse d'interactions médicamenteuses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicationInteraction {
    pub severity: String, // "contraindicated", "major", "moderate", "minor", "none"
    pub description: String,
    pub recommendation: String,
    pub alternative_suggestions: Vec<String>,
}

/// Recommandation de posologie
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DosageRecommendation {
    pub dosage: String,
    pub frequency: String,
    pub duration: String,
    pub precautions: Vec<String>,
    pub warnings: Vec<String>,
}

/// Alternative médicamenteuse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicationAlternative {
    pub name: String,
    pub dci: Option<String>,
    pub reason: String,
    pub similarity_score: f32, // 0.0-1.0
}

/// Service IA pour Pharmacies
pub struct PharmacyAIService {
    app_ia: Arc<AppIA>,
}

impl PharmacyAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Vérifie les interactions médicamenteuses
    pub async fn check_medication_interactions(
        &self,
        medications: Vec<String>,
        age: Option<i32>,
        medical_conditions: Option<Vec<String>>,
    ) -> AppResult<MedicationInteraction> {
        let medications_str = medications.join(", ");
        let age_str = age.map(|a| a.to_string()).unwrap_or_else(|| "Non spécifié".to_string());
        let conditions_str = medical_conditions
            .as_ref()
            .map(|c| c.join(", "))
            .unwrap_or_else(|| "Non spécifiées".to_string());

        let prompt = format!(
            r#"
Tu es un pharmacien expert en interactions médicamenteuses pour Yukpo.

CONTEXTE :
- Médicaments : {}
- Âge du patient : {}
- Conditions médicales : {}

TON RÔLE :
- Analyser les interactions entre les médicaments
- Identifier les contre-indications
- Proposer des alternatives si nécessaire
- Donner des recommandations de sécurité

NIVEAUX DE SÉVÉRITÉ :
- "contraindicated" : Contre-indiqué, ne pas prendre ensemble
- "major" : Interaction majeure, nécessite surveillance médicale
- "moderate" : Interaction modérée, précautions recommandées
- "minor" : Interaction mineure, généralement acceptable
- "none" : Aucune interaction connue

RÉPONSE ATTENDUE (JSON strict) :
{{
    "severity": "moderate",
    "description": "Description de l'interaction",
    "recommendation": "Recommandation pour le patient",
    "alternative_suggestions": ["Médicament alternatif 1", "Médicament alternatif 2"]
}}
"#,
            medications_str, age_str, conditions_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[PharmacyAIService] Interactions vérifiées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let interaction: MedicationInteraction = match serde_json::from_str(&response) {
            Ok(i) => i,
            Err(e) => {
                log::warn!(
                    "[PharmacyAIService] Erreur parsing JSON, utilisation réponse basique: {}",
                    e
                );
                MedicationInteraction {
                    severity: "none".to_string(),
                    description: "Vérification des interactions en cours.".to_string(),
                    recommendation: "Consultez votre pharmacien pour confirmation.".to_string(),
                    alternative_suggestions: vec![],
                }
            }
        };

        Ok(interaction)
    }

    /// Recommande une posologie adaptée
    pub async fn suggest_medication_dosage(
        &self,
        medication_name: &str,
        age: Option<i32>,
        weight: Option<f32>,
        medical_condition: Option<&str>,
    ) -> AppResult<DosageRecommendation> {
        let age_str = age.map(|a| a.to_string()).unwrap_or_else(|| "Non spécifié".to_string());
        let weight_str =
            weight.map(|w| w.to_string()).unwrap_or_else(|| "Non spécifié".to_string());
        let condition_str = medical_condition.unwrap_or("Non spécifiée");

        let prompt = format!(
            r#"
Tu es un pharmacien expert en posologie pour Yukpo.

CONTEXTE :
- Médicament : {}
- Âge : {} ans
- Poids : {} kg
- Condition médicale : {}

TON RÔLE :
- Recommander une posologie adaptée au patient
- Donner des précautions d'emploi
- Mettre en garde contre les effets secondaires possibles

IMPORTANT :
- Respecter les posologies standard selon l'âge et le poids
- Adapter selon les conditions médicales
- Toujours recommander de suivre l'ordonnance du médecin

RÉPONSE ATTENDUE (JSON strict) :
{{
    "dosage": "500mg",
    "frequency": "2 fois par jour",
    "duration": "7 jours",
    "precautions": ["Prendre avec les repas", "Éviter l'alcool"],
    "warnings": ["Peut causer somnolence"]
}}
"#,
            medication_name, age_str, weight_str, condition_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[PharmacyAIService] Posologie suggérée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let dosage: DosageRecommendation = match serde_json::from_str(&response) {
            Ok(d) => d,
            Err(e) => {
                log::warn!("[PharmacyAIService] Erreur parsing JSON: {}", e);
                DosageRecommendation {
                    dosage: "Consultez votre médecin".to_string(),
                    frequency: "Selon prescription".to_string(),
                    duration: "Selon prescription".to_string(),
                    precautions: vec![],
                    warnings: vec![],
                }
            }
        };

        Ok(dosage)
    }

    /// Suggère des alternatives si médicament indisponible
    pub async fn suggest_medication_alternatives(
        &self,
        unavailable_medication: &str,
        purpose: Option<&str>,
        allergies: Option<Vec<String>>,
    ) -> AppResult<Vec<MedicationAlternative>> {
        let purpose_str = purpose.unwrap_or("Non spécifiée");
        let allergies_str = allergies
            .as_ref()
            .map(|a| a.join(", "))
            .unwrap_or_else(|| "Aucune connue".to_string());

        let prompt = format!(
            r#"
Tu es un pharmacien expert en alternatives médicamenteuses pour Yukpo.

CONTEXTE :
- Médicament indisponible : {}
- But du traitement : {}
- Allergies connues : {}

TON RÔLE :
- Proposer des alternatives médicamenteuses équivalentes
- Vérifier les allergies et contre-indications
- Expliquer les différences éventuelles

IMPORTANT :
- Toujours vérifier avec le médecin avant substitution
- Respecter les contre-indications
- Proposer des médicaments avec le même principe actif si possible

RÉPONSE ATTENDUE (JSON strict) :
{{
    "alternatives": [
        {{
            "name": "Nom médicament",
            "dci": "DCI du médicament",
            "reason": "Pourquoi cette alternative",
            "similarity_score": 0.95
        }}
    ]
}}
"#,
            unavailable_medication, purpose_str, allergies_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[PharmacyAIService] Alternatives suggérées avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let alternatives: Vec<MedicationAlternative> =
            match serde_json::from_str::<serde_json::Value>(&response) {
                Ok(v) => {
                    if let Some(alts) = v.get("alternatives").and_then(|a| a.as_array()) {
                        alts.iter().filter_map(|a| serde_json::from_value(a.clone()).ok()).collect()
                    } else {
                        vec![]
                    }
                }
                Err(e) => {
                    log::warn!("[PharmacyAIService] Erreur parsing alternatives: {}", e);
                    vec![]
                }
            };

        Ok(alternatives)
    }
}

/// Fonctions helper pour intégration facile dans les contrôleurs
pub async fn check_medication_interactions(
    app_ia: Arc<AppIA>,
    medications: Vec<String>,
) -> AppResult<String> {
    let service = PharmacyAIService::new(app_ia);
    let interaction = service.check_medication_interactions(medications, None, None).await?;

    Ok(interaction.recommendation)
}
