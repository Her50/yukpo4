//! ✅ Service IA pour Orientation Scolaire
//!
//! Ce service utilise l'IA pour :
//! - Analyser le profil étudiant (notes, intérêts, objectifs)
//! - Recommander filières/établissements
//! - Comparer programmes
//! - Prévoir débouchés

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use crate::services::ia::prompt_loader::load_prompt_section_with_vars;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;

/// Analyse de profil étudiant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentProfileAnalysis {
    pub profile_id: i32,
    pub score_academique: f64, // 0-100
    pub score_interets: f64, // 0-100
    pub points_forts: Vec<String>,
    pub points_faibles: Vec<String>,
    pub filieres_suggestees: Vec<String>,
    pub etablissements_suggestes: Vec<i32>,
    pub reasoning: String,
    pub recommendations: String,
}

/// Recommandations de programmes/établissements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgramRecommendation {
    pub etablissement_id: i32,
    pub filiere: String,
    pub specialite: Option<String>,
    pub score_total: f64, // 0-100
    pub score_academique: f64,
    pub score_interets: f64,
    pub score_budget: f64,
    pub score_localisation: f64,
    pub reasoning: String,
    pub points_forts: Vec<String>,
    pub points_faibles: Vec<String>,
    pub alternatives: Vec<i32>,
}

/// Comparaison de programmes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgramComparison {
    pub etablissement_1_id: i32,
    pub etablissement_2_id: i32,
    pub filiere_1: String,
    pub filiere_2: String,
    pub score_etablissement_1: f64,
    pub score_etablissement_2: f64,
    pub winner_etablissement_id: i32,
    pub winner_reasoning: String,
    pub comparison_details: serde_json::Value,
}

/// Service IA pour Orientation Scolaire
pub struct OrientationScolaireAIService {
    app_ia: Arc<AppIA>,
}

impl OrientationScolaireAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Analyse le profil étudiant
    pub async fn analyze_student_profile(
        &self,
        profile_id: i32,
        niveau_actuel: &str,
        notes_moyennes: &serde_json::Value,
        moyenne_generale: Option<f64>,
        matieres_preferees: &[String],
        objectifs_carriere: &[String],
    ) -> AppResult<StudentProfileAnalysis> {
        let notes_str = serde_json::to_string(notes_moyennes).unwrap_or_else(|_| "{}".to_string());
        let moyenne_str = moyenne_generale
            .map(|m| format!("{:.2}", m))
            .unwrap_or_else(|| "Non spécifiée".to_string());
        let matieres_str = matieres_preferees.join(", ");
        let objectifs_str = objectifs_carriere.join(", ");

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("profile_id".to_string(), profile_id.to_string());
        variables.insert("niveau_actuel".to_string(), niveau_actuel.to_string());
        variables.insert("notes_moyennes".to_string(), notes_str.clone());
        variables.insert("moyenne_generale".to_string(), moyenne_str.clone());
        variables.insert("matieres_preferees".to_string(), matieres_str.clone());
        variables.insert("objectifs_carriere".to_string(), objectifs_str.clone());

        let prompt = load_prompt_section_with_vars(
            "orientation_scolaire",
            "Analyse Profil Étudiant",
            &variables,
        )
        .await
        .unwrap_or_else(|e| {
            log::warn!(
                "[OrientationScolaireAIService] Erreur chargement prompt, utilisation fallback: {}",
                e
            );
            format!(
                r#"
Tu es le conseiller d'orientation intelligent de Yukpomnang.

CONTEXTE :
- Profil étudiant ID : {}
- Niveau actuel : {}
- Notes moyennes : {}
- Moyenne générale : {}
- Matières préférées : {}
- Objectifs carrière : {}

TON RÔLE :
- Analyser le profil académique et les intérêts
- Identifier les points forts et faibles
- Suggérer des filières adaptées
- Recommander des établissements pertinents
- Donner des conseils d'orientation personnalisés

IMPORTANT :
- Adapter les recommandations au système éducatif camerounais/africain
- Considérer les débouchés professionnels locaux
- Prendre en compte les capacités académiques réelles

RÉPONSE ATTENDUE (JSON strict) :
{{
    "profile_id": {},
    "score_academique": 75.5,
    "score_interets": 80.0,
    "points_forts": ["Point fort 1", "Point fort 2"],
    "points_faibles": ["Point faible 1"],
    "filieres_suggestees": ["Filière 1", "Filière 2"],
    "etablissements_suggestes": [1, 2, 3],
    "reasoning": "Explication détaillée de l'analyse",
    "recommendations": "Recommandations personnalisées"
}}
"#,
                profile_id,
                niveau_actuel,
                notes_str,
                moyenne_str,
                matieres_str,
                objectifs_str,
                profile_id
            )
        });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[OrientationScolaireAIService] Analyse profil avec {} (tokens: {})",
            model_name,
            tokens
        );

        let analysis: StudentProfileAnalysis = match serde_json::from_str(&response) {
            Ok(a) => a,
            Err(e) => {
                log::warn!(
                    "[OrientationScolaireAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                StudentProfileAnalysis {
                    profile_id,
                    score_academique: moyenne_generale.unwrap_or(10.0) * 5.0,
                    score_interets: 70.0,
                    points_forts: vec![],
                    points_faibles: vec![],
                    filieres_suggestees: vec![],
                    etablissements_suggestes: vec![],
                    reasoning: "Analyse basique".to_string(),
                    recommendations: "Consultez un conseiller d'orientation".to_string(),
                }
            }
        };

        Ok(analysis)
    }

    /// Génère des recommandations de programmes/établissements
    pub async fn generate_program_recommendations(
        &self,
        student_profile_id: i32,
        etablissement_id: i32,
        filiere: &str,
        specialite: Option<&str>,
        budget_max: Option<f64>,
        preference_localisation: &[String],
    ) -> AppResult<ProgramRecommendation> {
        let specialite_str = specialite.unwrap_or("Non spécifiée");
        let budget_str = budget_max
            .map(|b| format!("{} XAF", b as i64))
            .unwrap_or_else(|| "Non spécifié".to_string());
        let localisation_str = preference_localisation.join(", ");

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("student_profile_id".to_string(), student_profile_id.to_string());
        variables.insert("etablissement_id".to_string(), etablissement_id.to_string());
        variables.insert("filiere".to_string(), filiere.to_string());
        variables.insert("specialite".to_string(), specialite_str.clone());
        variables.insert("budget_max".to_string(), budget_str.clone());
        variables.insert("preference_localisation".to_string(), localisation_str.clone());

        let prompt = load_prompt_section_with_vars(
            "orientation_scolaire",
            "Recommandations Programmes",
            &variables,
        )
        .await
        .unwrap_or_else(|e| {
            log::warn!(
                "[OrientationScolaireAIService] Erreur chargement prompt, utilisation fallback: {}",
                e
            );
            format!(
                r#"
Tu es le conseiller d'orientation intelligent de Yukpomnang.

CONTEXTE :
- Profil étudiant ID : {}
- Établissement ID : {}
- Filière : {}
- Spécialité : {}
- Budget maximum : {}
- Préférences localisation : {}

TON RÔLE :
- Évaluer la pertinence de ce programme pour l'étudiant
- Calculer des scores détaillés (académique, intérêts, budget, localisation)
- Identifier les points forts et faibles
- Proposer des alternatives si nécessaire

RÉPONSE ATTENDUE (JSON strict) :
{{
    "etablissement_id": {},
    "filiere": "{}",
    "specialite": "{}",
    "score_total": 85.5,
    "score_academique": 90.0,
    "score_interets": 80.0,
    "score_budget": 75.0,
    "score_localisation": 85.0,
    "reasoning": "Explication détaillée",
    "points_forts": ["Point fort 1"],
    "points_faibles": ["Point faible 1"],
    "alternatives": [4, 5]
}}
"#,
                student_profile_id,
                etablissement_id,
                filiere,
                specialite_str,
                budget_str,
                localisation_str,
                etablissement_id,
                filiere,
                specialite_str
            )
        });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[OrientationScolaireAIService] Recommandations générées avec {} (tokens: {})",
            model_name,
            tokens
        );

        let recommendation: ProgramRecommendation = match serde_json::from_str(&response) {
            Ok(r) => r,
            Err(e) => {
                log::warn!(
                    "[OrientationScolaireAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                ProgramRecommendation {
                    etablissement_id,
                    filiere: filiere.to_string(),
                    specialite: specialite.map(|s| s.to_string()),
                    score_total: 70.0,
                    score_academique: 75.0,
                    score_interets: 70.0,
                    score_budget: 80.0,
                    score_localisation: 70.0,
                    reasoning: "Recommandation basique".to_string(),
                    points_forts: vec![],
                    points_faibles: vec![],
                    alternatives: vec![],
                }
            }
        };

        Ok(recommendation)
    }

    /// Compare deux programmes
    pub async fn compare_programs(
        &self,
        student_profile_id: i32,
        etablissement_1_id: i32,
        etablissement_2_id: i32,
        filiere_1: &str,
        filiere_2: &str,
        specialite_1: Option<&str>,
        specialite_2: Option<&str>,
    ) -> AppResult<ProgramComparison> {
        let specialite_1_str = specialite_1.unwrap_or("Non spécifiée");
        let specialite_2_str = specialite_2.unwrap_or("Non spécifiée");

        // Charger le prompt depuis le fichier markdown
        let mut variables = HashMap::new();
        variables.insert("student_profile_id".to_string(), student_profile_id.to_string());
        variables.insert("etablissement_1_id".to_string(), etablissement_1_id.to_string());
        variables.insert("etablissement_2_id".to_string(), etablissement_2_id.to_string());
        variables.insert("filiere_1".to_string(), filiere_1.to_string());
        variables.insert("filiere_2".to_string(), filiere_2.to_string());
        variables.insert("specialite_1".to_string(), specialite_1_str.clone());
        variables.insert("specialite_2".to_string(), specialite_2_str.clone());

        let prompt = load_prompt_section_with_vars(
            "orientation_scolaire",
            "Comparaison Programmes",
            &variables,
        )
        .await
        .unwrap_or_else(|e| {
            log::warn!(
                "[OrientationScolaireAIService] Erreur chargement prompt, utilisation fallback: {}",
                e
            );
            format!(
                r#"
Tu es le conseiller d'orientation intelligent de Yukpomnang.

CONTEXTE :
- Profil étudiant ID : {}
- Établissement 1 ID : {} - Filière : {} - Spécialité : {}
- Établissement 2 ID : {} - Filière : {} - Spécialité : {}

TON RÔLE :
- Comparer les deux programmes en détail
- Calculer des scores pour chaque établissement
- Identifier le meilleur choix pour l'étudiant
- Expliquer les différences et similitudes
- Donner des recommandations

RÉPONSE ATTENDUE (JSON strict) :
{{
    "etablissement_1_id": {},
    "etablissement_2_id": {},
    "filiere_1": "{}",
    "filiere_2": "{}",
    "score_etablissement_1": 85.5,
    "score_etablissement_2": 80.0,
    "winner_etablissement_id": {},
    "winner_reasoning": "Explication du choix",
    "comparison_details": {{"critere1": "détail1", "critere2": "détail2"}}
}}
"#,
                student_profile_id,
                etablissement_1_id,
                filiere_1,
                specialite_1_str,
                etablissement_2_id,
                filiere_2,
                specialite_2_str,
                etablissement_1_id,
                etablissement_2_id,
                filiere_1,
                filiere_2,
                etablissement_1_id
            )
        });

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        log::info!(
            "[OrientationScolaireAIService] Comparaison générée avec {} (tokens: {})",
            model_name,
            tokens
        );

        let comparison: ProgramComparison = match serde_json::from_str(&response) {
            Ok(c) => c,
            Err(e) => {
                log::warn!(
                    "[OrientationScolaireAIService] Erreur parsing JSON: {}. Réponse: {}",
                    e,
                    response
                );
                ProgramComparison {
                    etablissement_1_id,
                    etablissement_2_id,
                    filiere_1: filiere_1.to_string(),
                    filiere_2: filiere_2.to_string(),
                    score_etablissement_1: 70.0,
                    score_etablissement_2: 70.0,
                    winner_etablissement_id: etablissement_1_id,
                    winner_reasoning: "Comparaison basique".to_string(),
                    comparison_details: json!({}),
                }
            }
        };

        Ok(comparison)
    }
}

