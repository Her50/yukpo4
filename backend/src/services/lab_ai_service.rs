//! ✅ Service IA pour Laboratoires/Imagerie
//!
//! Ce service utilise l'IA pour :
//! - Interpréter les résultats d'examens
//! - Détecter les anomalies
//! - Suggérer des examens complémentaires
//! - Prioriser les urgences

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Résultat d'analyse IA d'examen
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabAnalysisResult {
    pub interpretation: String,
    pub anomalies_detected: Vec<Anomaly>,
    pub is_normal: bool,
    pub confidence: f32, // 0.0-1.0
    pub recommendations: Vec<String>,
    pub follow_up_exams: Vec<String>,
}

/// Anomalie détectée
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anomaly {
    pub parameter: String,
    pub value: String,
    pub normal_range: String,
    pub severity: String, // "critical", "high", "moderate", "low"
    pub description: String,
}

/// Service IA pour Laboratoires
pub struct LabAIService {
    app_ia: Arc<AppIA>,
}

impl LabAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Analyse les résultats d'examen avec IA
    pub async fn analyze_examination_results(
        &self,
        examination_type: &str,
        results: serde_json::Value,
        patient_age: Option<i32>,
        patient_sex: Option<&str>,
    ) -> AppResult<LabAnalysisResult> {
        let age_str = patient_age
            .map(|a| a.to_string())
            .unwrap_or_else(|| "Non spécifié".to_string());
        let sex_str = patient_sex.unwrap_or("Non spécifié");
        let results_str = serde_json::to_string(&results).unwrap_or_else(|_| "{}".to_string());

        let prompt = format!(
            r#"
Tu es un expert en interprétation de résultats de laboratoire pour Yukpomnang.

CONTEXTE :
- Type d'examen : {}
- Résultats : {}
- Âge du patient : {} ans
- Sexe : {}

TON RÔLE :
- Interpréter les résultats de manière professionnelle
- Détecter les anomalies par rapport aux valeurs normales
- Identifier les valeurs critiques nécessitant attention immédiate
- Suggérer des examens complémentaires si nécessaire

IMPORTANT :
- Ne JAMAIS poser de diagnostic médical définitif
- Toujours recommander de consulter un médecin pour interprétation finale
- Identifier clairement les valeurs normales vs anormales
- Classifier la sévérité des anomalies (critical, high, moderate, low)

RÉPONSE ATTENDUE (JSON strict) :
{{
    "interpretation": "Interprétation générale des résultats",
    "anomalies_detected": [
        {{
            "parameter": "Hémoglobine",
            "value": "10.5 g/dL",
            "normal_range": "12-16 g/dL",
            "severity": "moderate",
            "description": "Anémie légère"
        }}
    ],
    "is_normal": false,
    "confidence": 0.85,
    "recommendations": ["Consultez votre médecin", "Répéter l'examen dans 1 mois"],
    "follow_up_exams": ["Ferritine", "Bilan ferrique"]
}}
"#,
            examination_type, results_str, age_str, sex_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[LabAIService] Analyse effectuée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let analysis: LabAnalysisResult = match serde_json::from_str(&response) {
            Ok(a) => a,
            Err(e) => {
                log::warn!("[LabAIService] Erreur parsing JSON: {}", e);
                LabAnalysisResult {
                    interpretation: response.clone(),
                    anomalies_detected: vec![],
                    is_normal: true,
                    confidence: 0.5,
                    recommendations: vec![
                        "Consultez votre médecin pour interprétation complète.".to_string()
                    ],
                    follow_up_exams: vec![],
                }
            }
        };

        Ok(analysis)
    }

    /// Détecte les anomalies critiques dans les résultats
    pub async fn detect_critical_anomalies(
        &self,
        results: serde_json::Value,
        examination_type: &str,
    ) -> AppResult<Vec<Anomaly>> {
        let results_str = serde_json::to_string(&results).unwrap_or_else(|_| "{}".to_string());

        let prompt = format!(
            r#"
Tu es un système de détection d'anomalies critiques pour résultats de laboratoire.

CONTEXTE :
- Type d'examen : {}
- Résultats : {}

TON RÔLE :
- Identifier UNIQUEMENT les anomalies critiques nécessitant attention immédiate
- Ignorer les valeurs légèrement hors norme non critiques
- Classifier par sévérité (critical, high, moderate, low)

ANOMALIES CRITIQUES :
- Valeurs potentiellement mortelles
- Valeurs nécessitant traitement immédiat
- Signes de pathologie grave

RÉPONSE ATTENDUE (JSON strict) :
{{
    "critical_anomalies": [
        {{
            "parameter": "Paramètre",
            "value": "Valeur observée",
            "normal_range": "Plage normale",
            "severity": "critical",
            "description": "Description de l'anomalie"
        }}
    ]
}}
"#,
            examination_type, results_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[LabAIService] Détection anomalies avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let anomalies: Vec<Anomaly> = match serde_json::from_str::<serde_json::Value>(&response) {
            Ok(v) => {
                if let Some(crits) = v.get("critical_anomalies").and_then(|a| a.as_array()) {
                    crits
                        .iter()
                        .filter_map(|a| serde_json::from_value(a.clone()).ok())
                        .collect()
                } else {
                    vec![]
                }
            }
            Err(e) => {
                log::warn!("[LabAIService] Erreur parsing anomalies: {}", e);
                vec![]
            }
        };

        Ok(anomalies)
    }

    /// Suggère des examens complémentaires
    pub async fn suggest_follow_up_examinations(
        &self,
        current_exam_type: &str,
        results: serde_json::Value,
        symptoms: Option<&str>,
    ) -> AppResult<Vec<String>> {
        let results_str = serde_json::to_string(&results).unwrap_or_else(|_| "{}".to_string());
        let symptoms_str = symptoms.unwrap_or("Non spécifiés");

        let prompt = format!(
            r#"
Tu es un expert en prescription d'examens complémentaires pour Yukpomnang.

CONTEXTE :
- Examen effectué : {}
- Résultats : {}
- Symptômes : {}

TON RÔLE :
- Suggérer des examens complémentaires pertinents
- Justifier chaque suggestion
- Prioriser par importance

RÉPONSE ATTENDUE (JSON strict) :
{{
    "suggested_exams": [
        "Nom de l'examen 1",
        "Nom de l'examen 2"
    ],
    "reasoning": "Explication des suggestions"
}}
"#,
            current_exam_type, results_str, symptoms_str
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[LabAIService] Suggestions examens avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Parser la réponse JSON
        let exams: Vec<String> = match serde_json::from_str::<serde_json::Value>(&response) {
            Ok(v) => {
                if let Some(suggs) = v.get("suggested_exams").and_then(|s| s.as_array()) {
                    suggs
                        .iter()
                        .filter_map(|s| s.as_str().map(|s| s.to_string()))
                        .collect()
                } else {
                    vec![]
                }
            }
            Err(e) => {
                log::warn!("[LabAIService] Erreur parsing suggestions: {}", e);
                vec![]
            }
        };

        Ok(exams)
    }

    /// Analyse une image de résultat d'examen avec vision IA
    pub async fn analyze_examination_image(
        &self,
        examination_type: &str,
        image_base64: &str,
        patient_age: Option<i32>,
        patient_sex: Option<&str>,
    ) -> AppResult<LabAnalysisResult> {
        let age_str = patient_age
            .map(|a| a.to_string())
            .unwrap_or_else(|| "Non spécifié".to_string());
        let sex_str = patient_sex.unwrap_or("Non spécifié");

        // Construire le prompt pour l'analyse d'image médicale
        let prompt = format!(
            r#"
Tu es un expert en interprétation d'images médicales et de résultats de laboratoire pour Yukpomnang.

CONTEXTE :
- Type d'examen : {}
- Âge du patient : {} ans
- Sexe : {}

TON RÔLE :
- Analyser l'image de résultat d'examen de manière professionnelle
- Identifier les valeurs, paramètres ou observations visibles dans l'image
- Détecter les anomalies par rapport aux valeurs normales
- Identifier les valeurs critiques nécessitant attention immédiate
- Suggérer des examens complémentaires si nécessaire

IMPORTANT :
- Ne JAMAIS poser de diagnostic médical définitif
- Toujours recommander de consulter un médecin pour interprétation finale
- Si l'image ne contient pas de résultats lisibles, le signaler clairement
- Identifier clairement les valeurs normales vs anormales
- Classifier la sévérité des anomalies (critical, high, moderate, low)

RÉPONSE ATTENDUE (JSON strict UNIQUEMENT, sans texte avant ou après) :
{{
    "interpretation": "Interprétation générale de l'image et des résultats observés",
    "anomalies_detected": [
        {{
            "parameter": "Paramètre observé",
            "value": "Valeur observée",
            "normal_range": "Plage normale",
            "severity": "moderate",
            "description": "Description de l'anomalie"
        }}
    ],
    "is_normal": false,
    "confidence": 0.85,
    "recommendations": ["Consultez votre médecin", "Répéter l'examen si nécessaire"],
    "follow_up_exams": ["Examens complémentaires suggérés"]
}}

Réponds UNIQUEMENT le JSON, sans markdown, sans code blocks, sans texte avant ou après.
"#,
            examination_type, age_str, sex_str
        );

        // Préparer l'image base64
        let image_base64_clean = if image_base64.starts_with("data:") {
            image_base64.to_string()
        } else {
            format!("data:image/jpeg;base64,{}", image_base64)
        };

        // Utiliser predict_multimodal pour l'analyse d'image
        let (model_name, response, tokens) = self
            .app_ia
            .predict_multimodal(&prompt, Some(vec![image_base64_clean]))
            .await?;

        log::info!(
            "[LabAIService] Analyse d'image effectuée avec {} (tokens: {})",
            model_name,
            tokens
        );

        // Extraire le JSON de la réponse (l'IA peut ajouter du texte avant/après)
        let json_str = if let Some(start) = response.find('{') {
            if let Some(end) = response.rfind('}') {
                &response[start..=end]
            } else {
                &response[start..]
            }
        } else {
            &response
        };

        // Parser la réponse JSON
        let analysis: LabAnalysisResult = match serde_json::from_str(json_str) {
            Ok(a) => a,
            Err(e) => {
                log::warn!("[LabAIService] Erreur parsing JSON: {}", e);
                log::warn!("[LabAIService] Réponse reçue: {}", response);
                // Fallback: retourner l'interprétation brute
                LabAnalysisResult {
                    interpretation: response.clone(),
                    anomalies_detected: vec![],
                    is_normal: true,
                    confidence: 0.5,
                    recommendations: vec![
                        "Consultez votre médecin pour interprétation complète.".to_string()
                    ],
                    follow_up_exams: vec![],
                }
            }
        };

        Ok(analysis)
    }
}

/// Fonctions helper pour intégration facile dans les contrôleurs
pub async fn analyze_examination_results(
    app_ia: Arc<AppIA>,
    examination_type: &str,
    results: serde_json::Value,
) -> AppResult<String> {
    let service = LabAIService::new(app_ia);
    let analysis = service
        .analyze_examination_results(examination_type, results, None, None)
        .await?;

    Ok(analysis.interpretation)
}
