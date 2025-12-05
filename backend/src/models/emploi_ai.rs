// ✅ Modèles pour Offres d'Emploi IA (matching amélioré, analyse CV, prédictions salaires, formations)

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Modèle : Analyse CV IA
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CVAIAnalysis {
    pub id: i32,
    pub candidat_id: i32,
    pub profil_id: Option<i32>,
    pub cv_url: String,
    pub competences_extracted: Vec<String>,
    pub experience_years_extracted: i32,
    pub niveau_etude_extracted: Option<String>,
    pub langues_extracted: serde_json::Value,
    pub certifications_extracted: Vec<String>,
    pub formations_extracted: serde_json::Value,
    pub score_completude: Option<Decimal>,
    pub score_qualite: Option<Decimal>,
    pub score_pertinence: Option<Decimal>,
    pub suggestions_amelioration: Vec<String>,
    pub competences_manquantes: Vec<String>,
    pub formations_suggestees: Vec<String>,
    pub model_used: Option<String>,
    pub tokens_consumed: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Modèle : Prédiction salaire IA
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SalaryPrediction {
    pub id: i32,
    pub offre_id: Option<i32>,
    pub candidat_id: Option<i32>,
    pub titre_poste: String,
    pub secteur: String,
    pub ville: Option<String>,
    pub experience_annees: Option<i32>,
    pub niveau_etude: Option<String>,
    pub competences: Vec<String>,
    pub salaire_predicted_min: Decimal,
    pub salaire_predicted_max: Decimal,
    pub salaire_predicted_median: Decimal,
    pub devise: String,
    pub facteurs_influence: serde_json::Value,
    pub comparaison_marche: Option<String>,
    pub model_used: Option<String>,
    pub tokens_consumed: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Modèle : Suggestions formations IA
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FormationSuggestion {
    pub id: i32,
    pub candidat_id: i32,
    pub offre_id: Option<i32>,
    pub competences_manquantes: Vec<String>,
    pub objectif_carriere: Option<String>,
    pub formations_suggestees: serde_json::Value,
    pub certifications_suggestees: Option<serde_json::Value>,
    pub score_pertinence: Option<Decimal>,
    pub model_used: Option<String>,
    pub tokens_consumed: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Modèle : Analytics Emploi avancés
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EmploiAnalyticsAdvanced {
    pub id: i32,
    pub offre_id: Option<i32>,
    pub entreprise_id: Option<i32>,
    pub nombre_vues: i32,
    pub nombre_candidatures: i32,
    pub nombre_candidatures_qualifiees: i32,
    pub nombre_candidatures_ia_qualifiees: i32,
    pub taux_conversion: Option<Decimal>,
    pub taux_conversion_ia: Option<Decimal>,
    pub repartition_experience: serde_json::Value,
    pub repartition_niveau_etude: serde_json::Value,
    pub repartition_localisation: serde_json::Value,
    pub repartition_competences: serde_json::Value,
    pub score_moyen_matching: Option<Decimal>,
    pub score_moyen_matching_ia: Option<Decimal>,
    pub periode_debut: chrono::NaiveDate,
    pub periode_fin: chrono::NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO : Matching IA amélioré
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImprovedMatchingRequest {
    pub offre_id: i32,
    pub candidat_id: i32,
    pub titre_poste: String,
    pub competences_requises: Vec<String>,
    pub competences_candidat: Vec<String>,
    pub experience_requise: Option<i32>,
    pub experience_candidat: i32,
}

/// DTO : Analyse CV IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeCVRequest {
    pub candidat_id: i32,
    pub cv_text: String,
    pub cv_url: Option<String>,
}

/// DTO : Prédiction salaire
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictSalaryRequest {
    pub titre_poste: String,
    pub secteur: String,
    pub ville: String,
    pub experience_annees: i32,
    pub niveau_etude: String,
    pub competences: Vec<String>,
}

/// DTO : Suggestions formations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestFormationsRequest {
    pub candidat_id: i32,
    pub offre_id: Option<i32>,
    pub competences_manquantes: Option<Vec<String>>,
    pub objectif_carriere: Option<String>,
}
