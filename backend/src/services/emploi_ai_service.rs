//! ✅ Service IA pour Offres d'Emploi
//!
//! Ce service utilise l'IA pour :
//! - Matching intelligent CV ↔ offres (amélioration)
//! - Analyse compétences
//! - Suggestions formations
//! - Prédictions salaires

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use crate::services::ia::prompt_loader::load_prompt_section_with_vars;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Matching IA amélioré CV ↔ Offre
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImprovedMatching {
    pub offre_id: i32,
    pub candidat_id: i32,
    pub ai_score: f64, // 0-100
    pub score_competences: f64,
    pub score_experience: f64,
    pub score_cultural_fit: f64,
    pub ai_reasoning: String,
    pub competences_match: Vec<String>,
    pub competences_manquantes: Vec<String>,
    pub improvement_suggestions: Vec<String>,
}

/// Analyse CV IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CVAnalysis {
    pub candidat_id: i32,
    pub score_completude: f64, // 0-100
    pub score_qualite: f64,    // 0-100
    pub score_pertinence: f64, // 0-100
    pub competences_extracted: Vec<String>,
    pub experience_years_extracted: i32,
    pub niveau_etude_extracted: String,
    pub langues_extracted: Vec<serde_json::Value>,
    pub suggestions_amelioration: Vec<String>,
    pub competences_manquantes: Vec<String>,
}

/// Prédiction salaire IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalaryPrediction {
    pub titre_poste: String,
    pub secteur: String,
    pub ville: String,
    pub salaire_predicted_min: f64,
    pub salaire_predicted_max: f64,
    pub salaire_predicted_median: f64,
    pub devise: String,
    pub facteurs_influence: Vec<String>,
    pub comparaison_marche: String,
}

/// Service IA pour Offres d'Emploi
pub struct EmploiAIService {
    app_ia: Arc<AppIA>,
}

impl EmploiAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Matching IA amélioré CV ↔ Offre
    pub async fn generate_improved_matching(
        &self,
        offre_id: i32,
        candidat_id: i32,
        titre_poste: &str,
        competences_requises: &[String],
        competences_candidat: &[String],
        experience_requise: Option<i32>,
        experience_candidat: i32,
    ) -> AppResult<ImprovedMatching> {
        let competences_req_str = competences_requises.join(", ");
        let competences_cand_str = competences_candidat.join(", ");
        let exp_req_str = experience_requise
            .map(|e| e.to_string())
            .unwrap_or_else(|| "Non spécifiée".to_string());

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("offre_id".to_string(), offre_id.to_string());
        variables.insert("candidat_id".to_string(), candidat_id.to_string());
        variables.insert("titre_poste".to_string(), titre_poste.to_string());
        variables.insert(
            "competences_requises".to_string(),
            competences_req_str.clone(),
        );
        variables.insert(
            "competences_candidat".to_string(),
            competences_cand_str.clone(),
        );
        variables.insert("experience_requise".to_string(), exp_req_str.clone());
        variables.insert(
            "experience_candidat".to_string(),
            experience_candidat.to_string(),
        );

        let prompt = load_prompt_section_with_vars("emploi", "Matching Intelligent", &variables)
            .await
            .unwrap_or_else(|e| {
                log::warn!(
                    "[EmploiAIService] Erreur chargement prompt, utilisation fallback: {}",
                    e
                );
                format!(
                    r#"
Tu es l'expert en recrutement intelligent de Yukpomnang.

CONTEXTE :
- Offre ID : {}
- Candidat ID : {}
- Poste : {}
- Compétences requises : {}
- Compétences candidat : {}
- Expérience requise : {}
- Expérience candidat : {} années

TON RÔLE :
- Analyser la correspondance entre le profil candidat et l'offre
- Calculer des scores détaillés (compétences, expérience, fit culturel)
- Identifier les compétences correspondantes et manquantes
- Proposer des suggestions d'amélioration

RÉPONSE ATTENDUE (JSON strict) :
{{
    "offre_id": {},
    "candidat_id": {},
    "ai_score": 85.5,
    "score_competences": 90.0,
    "score_experience": 80.0,
    "score_cultural_fit": 85.0,
    "ai_reasoning": "Explication détaillée du matching",
    "competences_match": ["Compétence 1", "Compétence 2"],
    "competences_manquantes": ["Compétence 3"],
    "improvement_suggestions": ["Suggestion 1", "Suggestion 2"]
}}
"#,
                    offre_id,
                    candidat_id,
                    titre_poste,
                    competences_req_str,
                    competences_cand_str,
                    exp_req_str,
                    experience_candidat,
                    offre_id,
                    candidat_id
                )
            });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[EmploiAIService] Matching amélioré généré avec {} (tokens: {})",
            model_name,
            tokens
        );

        let matching: ImprovedMatching = match serde_json::from_str(&response) {
            Ok(m) => m,
            Err(e) => {
                log::warn!(
                    "[EmploiAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                // Calcul basique de matching
                let competences_match_count = competences_candidat
                    .iter()
                    .filter(|c| competences_requises.contains(c))
                    .count();
                let score_comp = if !competences_requises.is_empty() {
                    (competences_match_count as f64 / competences_requises.len() as f64) * 100.0
                } else {
                    70.0
                };
                ImprovedMatching {
                    offre_id,
                    candidat_id,
                    ai_score: score_comp * 0.7 + (experience_candidat.min(10) as f64 * 3.0),
                    score_competences: score_comp,
                    score_experience: (experience_candidat.min(10) as f64 / 10.0) * 100.0,
                    score_cultural_fit: 75.0,
                    ai_reasoning: "Matching basique calculé".to_string(),
                    competences_match: competences_candidat
                        .iter()
                        .filter(|c| competences_requises.contains(c))
                        .cloned()
                        .collect(),
                    competences_manquantes: competences_requises
                        .iter()
                        .filter(|c| !competences_candidat.contains(c))
                        .cloned()
                        .collect(),
                    improvement_suggestions: vec![],
                }
            }
        };

        Ok(matching)
    }

    /// Analyse CV IA
    pub async fn analyze_cv(
        &self,
        candidat_id: i32,
        cv_text: &str,
        cv_url: Option<&str>,
    ) -> AppResult<CVAnalysis> {
        let cv_url_str = cv_url.unwrap_or("Non spécifiée");
        let cv_text_short = cv_text.chars().take(1000).collect::<String>();

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("candidat_id".to_string(), candidat_id.to_string());
        variables.insert("cv_url".to_string(), cv_url_str.to_string());
        variables.insert("cv_content".to_string(), cv_text_short.clone());

        let prompt = load_prompt_section_with_vars("emploi", "Analyse CV", &variables)
            .await
            .unwrap_or_else(|e| {
                log::warn!(
                    "[EmploiAIService] Erreur chargement prompt, utilisation fallback: {}",
                    e
                );
                format!(
                    r#"
Tu es l'expert en analyse de CV pour Yukpomnang.

CONTEXTE :
- Candidat ID : {}
- CV URL : {}
- Contenu CV (extrait) : {}

TON RÔLE :
- Extraire les compétences, expérience, niveau d'étude, langues
- Évaluer la complétude, qualité et pertinence du CV
- Identifier les points forts et faibles
- Proposer des suggestions d'amélioration
- Identifier les compétences manquantes pour le marché

RÉPONSE ATTENDUE (JSON strict) :
{{
    "candidat_id": {},
    "score_completude": 85.5,
    "score_qualite": 80.0,
    "score_pertinence": 75.0,
    "competences_extracted": ["Compétence 1", "Compétence 2"],
    "experience_years_extracted": 5,
    "niveau_etude_extracted": "Bac+5",
    "langues_extracted": [{{"langue": "Français", "niveau": "Courant"}}],
    "suggestions_amelioration": ["Suggestion 1", "Suggestion 2"],
    "competences_manquantes": ["Compétence 3"]
}}
"#,
                    candidat_id, cv_url_str, cv_text_short, candidat_id
                )
            });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[EmploiAIService] Analyse CV avec {} (tokens: {})",
            model_name,
            tokens
        );

        let analysis: CVAnalysis = match serde_json::from_str(&response) {
            Ok(a) => a,
            Err(e) => {
                log::warn!(
                    "[EmploiAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                CVAnalysis {
                    candidat_id,
                    score_completude: 70.0,
                    score_qualite: 70.0,
                    score_pertinence: 70.0,
                    competences_extracted: vec![],
                    experience_years_extracted: 0,
                    niveau_etude_extracted: "Non spécifié".to_string(),
                    langues_extracted: vec![],
                    suggestions_amelioration: vec![],
                    competences_manquantes: vec![],
                }
            }
        };

        Ok(analysis)
    }

    /// Prédiction salaire IA
    pub async fn predict_salary(
        &self,
        titre_poste: &str,
        secteur: &str,
        ville: &str,
        experience_annees: i32,
        niveau_etude: &str,
        competences: &[String],
    ) -> AppResult<SalaryPrediction> {
        let competences_str = competences.join(", ");

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("titre_poste".to_string(), titre_poste.to_string());
        variables.insert("secteur".to_string(), secteur.to_string());
        variables.insert("ville".to_string(), ville.to_string());
        variables.insert(
            "experience_annees".to_string(),
            experience_annees.to_string(),
        );
        variables.insert("niveau_etude".to_string(), niveau_etude.to_string());
        variables.insert("competences".to_string(), competences_str.clone());

        let prompt = load_prompt_section_with_vars("emploi", "Prédiction Salaire", &variables)
            .await
            .unwrap_or_else(|e| {
                log::warn!(
                    "[EmploiAIService] Erreur chargement prompt, utilisation fallback: {}",
                    e
                );
                format!(
                    r#"
Tu es l'expert en prédiction salariale pour le marché camerounais/africain.

CONTEXTE :
- Poste : {}
- Secteur : {}
- Ville : {}
- Expérience : {} années
- Niveau d'étude : {}
- Compétences : {}

TON RÔLE :
- Prédire une fourchette salariale réaliste en XAF
- Considérer le marché local camerounais/africain
- Prendre en compte l'expérience, niveau d'étude, compétences
- Identifier les facteurs d'influence
- Comparer avec le marché

IMPORTANT :
- Les salaires doivent être réalistes pour le marché local
- Considérer le pouvoir d'achat
- Fournir min, max et médian

RÉPONSE ATTENDUE (JSON strict) :
{{
    "titre_poste": "{}",
    "secteur": "{}",
    "ville": "{}",
    "salaire_predicted_min": 500000.0,
    "salaire_predicted_max": 800000.0,
    "salaire_predicted_median": 650000.0,
    "devise": "XAF",
    "facteurs_influence": ["Facteur 1", "Facteur 2"],
    "comparaison_marche": "Description comparaison marché"
}}
"#,
                    titre_poste,
                    secteur,
                    ville,
                    experience_annees,
                    niveau_etude,
                    competences_str,
                    titre_poste,
                    secteur,
                    ville
                )
            });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[EmploiAIService] Prédiction salaire avec {} (tokens: {})",
            model_name,
            tokens
        );

        let prediction: SalaryPrediction = match serde_json::from_str(&response) {
            Ok(p) => p,
            Err(e) => {
                log::warn!(
                    "[EmploiAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                // Prédiction basique basée sur expérience
                let salaire_base = match experience_annees {
                    0..=2 => 300000.0,
                    3..=5 => 500000.0,
                    6..=10 => 800000.0,
                    _ => 1200000.0,
                };
                SalaryPrediction {
                    titre_poste: titre_poste.to_string(),
                    secteur: secteur.to_string(),
                    ville: ville.to_string(),
                    salaire_predicted_min: salaire_base * 0.8,
                    salaire_predicted_max: salaire_base * 1.3,
                    salaire_predicted_median: salaire_base,
                    devise: "XAF".to_string(),
                    facteurs_influence: vec!["Expérience".to_string(), "Secteur".to_string()],
                    comparaison_marche: "Prédiction basique".to_string(),
                }
            }
        };

        Ok(prediction)
    }
}
