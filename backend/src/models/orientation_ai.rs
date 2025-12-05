// ✅ Modèles pour Orientation Scolaire IA (profils étudiants, recommandations IA, comparaisons, analytics)

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Modèle : Profil étudiant
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StudentProfile {
    pub id: i32,
    pub user_id: i32,
    pub nom_complet: String,
    pub date_naissance: Option<NaiveDate>,
    pub ville: Option<String>,
    pub region: Option<String>,
    pub gps: Option<String>,
    pub niveau_actuel: Option<String>,
    pub classe_actuelle: Option<String>,
    pub etablissement_actuel: Option<String>,
    pub notes_moyennes: serde_json::Value,
    pub moyenne_generale: Option<Decimal>,
    pub classement: Option<i32>,
    pub effectif_classe: Option<i32>,
    pub matieres_preferees: Vec<String>,
    pub matieres_faibles: Vec<String>,
    pub objectifs_carriere: Vec<String>,
    pub secteurs_interets: Vec<String>,
    pub budget_max: Option<Decimal>,
    pub preference_localisation: Vec<String>,
    pub preference_type_etablissement: Vec<String>,
    pub is_complete: bool,
    pub last_analysis_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Modèle : Recommandation IA de programme
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProgramRecommendation {
    pub id: i32,
    pub student_profile_id: i32,
    pub etablissement_id: i32,
    pub recommendation_type: String,
    pub filiere: Option<String>,
    pub specialite: Option<String>,
    pub score_total: Decimal,
    pub score_academique: Option<Decimal>,
    pub score_interets: Option<Decimal>,
    pub score_budget: Option<Decimal>,
    pub score_localisation: Option<Decimal>,
    pub reasoning: Option<String>,
    pub points_forts: Vec<String>,
    pub points_faibles: Vec<String>,
    pub alternatives: Vec<i32>,
    pub model_used: Option<String>,
    pub tokens_consumed: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Modèle : Comparaison de programmes
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProgramComparison {
    pub id: i32,
    pub student_profile_id: i32,
    pub etablissement_1_id: i32,
    pub etablissement_2_id: i32,
    pub filiere_1: Option<String>,
    pub filiere_2: Option<String>,
    pub specialite_1: Option<String>,
    pub specialite_2: Option<String>,
    pub comparison_criteria: serde_json::Value,
    pub comparison_results: serde_json::Value,
    pub winner_etablissement_id: Option<i32>,
    pub winner_reasoning: Option<String>,
    pub score_etablissement_1: Decimal,
    pub score_etablissement_2: Decimal,
    pub model_used: Option<String>,
    pub tokens_consumed: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Modèle : Analytics Orientation Scolaire
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OrientationAnalytics {
    pub id: i32,
    pub etablissement_id: Option<i32>,
    pub user_id: Option<i32>,
    pub nombre_vues: i32,
    pub nombre_contacts: i32,
    pub nombre_recommendations: i32,
    pub nombre_comparaisons: i32,
    pub nombre_inscriptions: i32,
    pub repartition_niveaux: serde_json::Value,
    pub repartition_filieres: serde_json::Value,
    pub repartition_villes: serde_json::Value,
    pub score_satisfaction: Option<Decimal>,
    pub score_popularite: Decimal,
    pub periode_debut: NaiveDate,
    pub periode_fin: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO : Création/mise à jour profil étudiant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrUpdateStudentProfileRequest {
    pub nom_complet: String,
    pub date_naissance: Option<NaiveDate>,
    pub ville: Option<String>,
    pub region: Option<String>,
    pub gps: Option<String>,
    pub niveau_actuel: Option<String>,
    pub classe_actuelle: Option<String>,
    pub etablissement_actuel: Option<String>,
    pub notes_moyennes: Option<serde_json::Value>,
    pub moyenne_generale: Option<f64>,
    pub classement: Option<i32>,
    pub effectif_classe: Option<i32>,
    pub matieres_preferees: Option<Vec<String>>,
    pub matieres_faibles: Option<Vec<String>>,
    pub objectifs_carriere: Option<Vec<String>>,
    pub secteurs_interets: Option<Vec<String>>,
    pub budget_max: Option<f64>,
    pub preference_localisation: Option<Vec<String>>,
    pub preference_type_etablissement: Option<Vec<String>>,
}

/// DTO : Analyse profil IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeProfileRequest {
    pub profile_id: i32,
}

/// DTO : Recommandations IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateRecommendationsRequest {
    pub student_profile_id: i32,
    pub etablissement_id: Option<i32>,
    pub filiere: Option<String>,
    pub specialite: Option<String>,
    pub budget_max: Option<f64>,
    pub preference_localisation: Option<Vec<String>>,
}

/// DTO : Comparaison programmes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompareProgramsRequest {
    pub student_profile_id: i32,
    pub etablissement_1_id: i32,
    pub etablissement_2_id: i32,
    pub filiere_1: String,
    pub filiere_2: String,
    pub specialite_1: Option<String>,
    pub specialite_2: Option<String>,
}
