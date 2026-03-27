// ✅ Modèle pour orientation scolaire et établissements

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EtablissementScolaire {
    pub id: i32,
    pub service_id: i32,
    pub user_id: i32,

    // Informations générales
    pub nom_etablissement: String,
    pub type_etablissement: String, // 'primaire', 'secondaire', 'superieur'
    pub sous_type: Option<String>,
    pub niveau_min: Option<i32>,
    pub niveau_max: Option<i32>,

    // Localisation
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: String,
    pub region: Option<String>,
    pub gps: Option<String>, // Format: "lat,lng"

    // Contact
    pub telephone: Option<String>,
    pub email: Option<String>,
    pub site_web: Option<String>,

    // Informations académiques
    #[sqlx(default)]
    pub filieres: Vec<String>,
    #[sqlx(default)]
    pub specialites: Vec<String>,
    #[sqlx(default)]
    pub langues_enseignement: Vec<String>,

    // Statistiques examens (JSON)
    #[sqlx(default)]
    pub statistiques_examens: serde_json::Value,

    // Métadonnées
    pub is_active: bool,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateEtablissementRequest {
    pub nom_etablissement: String,
    pub type_etablissement: String,
    pub sous_type: Option<String>,
    pub niveau_min: Option<i32>,
    pub niveau_max: Option<i32>,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: String,
    pub region: Option<String>,
    pub gps: Option<String>,
    pub telephone: Option<String>,
    pub email: Option<String>,
    pub site_web: Option<String>,
    pub filieres: Option<Vec<String>>,
    pub specialites: Option<Vec<String>>,
    pub langues_enseignement: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateEtablissementRequest {
    pub nom_etablissement: Option<String>,
    pub sous_type: Option<String>,
    pub niveau_min: Option<i32>,
    pub niveau_max: Option<i32>,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub region: Option<String>,
    pub gps: Option<String>,
    pub telephone: Option<String>,
    pub email: Option<String>,
    pub site_web: Option<String>,
    pub filieres: Option<Vec<String>>,
    pub specialites: Option<Vec<String>>,
    pub langues_enseignement: Option<Vec<String>>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchEtablissementsRequest {
    pub type_etablissement: Option<String>,
    pub ville: Option<String>,
    pub region: Option<String>,
    pub filiere: Option<String>,
    pub specialite: Option<String>,
    /// Recherche libre (nom d'établissement, ville)
    pub q: Option<String>,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub rayon_km: Option<f64>, // Rayon de recherche en km (défaut: 10 km)
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatistiquesExamensRequest {
    pub annee: String,
    pub taux_reussite: Option<f64>,
    pub nb_candidats: Option<i32>,
    pub nb_admis: Option<i32>,
    pub moyenne_generale: Option<f64>,
    pub autres_stats: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestEtablissementsRequest {
    pub type_etablissement: String,
    pub domaine: Option<String>,
    pub filiere: Option<String>,
    pub ville: Option<String>,
    pub region: Option<String>,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub limit: Option<i32>,
}

// Programme scolaire
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProgrammeScolaire {
    pub id: i32,
    pub etablissement_id: i32,
    pub type_etablissement: String,
    pub niveau: String,
    pub classe: Option<String>,
    pub filiere: Option<String>,
    pub specialite: Option<String>,
    pub titre: String,
    pub description: Option<String>,
    pub annee_scolaire: String,
    pub fichier_url: Option<String>,
    pub fichier_nom: Option<String>,
    pub fichier_taille: Option<i32>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProgrammeRequest {
    pub etablissement_id: i32,
    pub type_etablissement: String,
    pub niveau: String,
    pub classe: Option<String>,
    pub filiere: Option<String>,
    pub specialite: Option<String>,
    pub titre: String,
    pub description: Option<String>,
    pub annee_scolaire: String,
    pub fichier_url: Option<String>,
    pub fichier_nom: Option<String>,
    pub fichier_taille: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchProgrammesRequest {
    pub etablissement_id: Option<i32>,
    pub type_etablissement: Option<String>,
    pub niveau: Option<String>,
    pub filiere: Option<String>,
    pub annee_scolaire: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

// Fournitures scolaires
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FournituresScolaires {
    pub id: i32,
    pub etablissement_id: i32,
    pub type_etablissement: String,
    pub niveau: String,
    pub classe: Option<String>,
    pub annee_scolaire: String,
    #[sqlx(default)]
    pub liste_fournitures: serde_json::Value, // [{"nom": "Cahier", "quantite": 5, "remarque": "21x29.7"}, ...]
    pub fichier_url: Option<String>,
    pub fichier_nom: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFournituresRequest {
    pub etablissement_id: i32,
    pub type_etablissement: String,
    pub niveau: String,
    pub classe: Option<String>,
    pub annee_scolaire: String,
    pub liste_fournitures: serde_json::Value,
    pub fichier_url: Option<String>,
    pub fichier_nom: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFournituresRequest {
    pub etablissement_id: Option<i32>,
    pub type_etablissement: Option<String>,
    pub niveau: Option<String>,
    pub annee_scolaire: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

// Concours d'entrée
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ConcoursEntree {
    pub id: i32,
    pub etablissement_id: i32,
    pub nom_concours: String,
    pub description: Option<String>,
    pub filiere: Option<String>,
    pub specialite: Option<String>,
    pub date_ouverture_inscription: chrono::NaiveDate,
    pub date_fermeture_inscription: chrono::NaiveDate,
    pub date_concours: chrono::NaiveDate,
    pub date_resultats: Option<chrono::NaiveDate>,
    pub documentation_url: Option<String>,
    pub documentation_nom: Option<String>,
    pub programme_concours: Option<String>,
    pub conditions_admission: Option<String>,
    pub frais_inscription: Option<Decimal>,
    pub nombre_places: Option<i32>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateConcoursRequest {
    pub etablissement_id: i32,
    pub nom_concours: String,
    pub description: Option<String>,
    pub filiere: Option<String>,
    pub specialite: Option<String>,
    pub date_ouverture_inscription: chrono::NaiveDate,
    pub date_fermeture_inscription: chrono::NaiveDate,
    pub date_concours: chrono::NaiveDate,
    pub date_resultats: Option<chrono::NaiveDate>,
    pub documentation_url: Option<String>,
    pub documentation_nom: Option<String>,
    pub programme_concours: Option<String>,
    pub conditions_admission: Option<String>,
    pub frais_inscription: Option<Decimal>,
    pub nombre_places: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConcoursRequest {
    pub etablissement_id: Option<i32>,
    pub filiere: Option<String>,
    pub date_min: Option<chrono::NaiveDate>,
    pub date_max: Option<chrono::NaiveDate>,
    pub actifs_seulement: Option<bool>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

// Expériences d'anciens étudiants
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ExperienceAncienEtudiant {
    pub id: i32,
    pub etablissement_id: i32,
    pub user_id: i32,
    pub filiere: String,
    pub specialite: Option<String>,
    pub annee_entree: i32,
    pub annee_sortie: Option<i32>,
    pub niveau_obtenu: Option<String>,
    pub titre: String,
    pub contenu: String,
    #[sqlx(default)]
    pub points_positifs: Vec<String>,
    #[sqlx(default)]
    pub points_negatifs: Vec<String>,
    pub note_generale: Option<i32>,
    pub is_verified: bool,
    pub is_approved: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateExperienceRequest {
    pub etablissement_id: i32,
    pub filiere: String,
    pub specialite: Option<String>,
    pub annee_entree: i32,
    pub annee_sortie: Option<i32>,
    pub niveau_obtenu: Option<String>,
    pub titre: String,
    pub contenu: String,
    pub points_positifs: Option<Vec<String>>,
    pub points_negatifs: Option<Vec<String>>,
    pub note_generale: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchExperiencesRequest {
    pub etablissement_id: Option<i32>,
    pub filiere: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

// Conférences et lives scolaires
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ConferenceLiveScolaire {
    pub id: i32,
    pub etablissement_id: i32,
    pub user_id: i32,
    pub titre: String,
    pub description: Option<String>,
    pub type_conference: String, // 'orientation', 'information', 'concours', 'temoignage'
    pub date_programmee: DateTime<Utc>,
    pub duree_estimee: Option<i32>,
    pub is_live: bool,
    pub room_name: Option<String>,
    pub room_token: Option<String>,
    pub livekit_url: Option<String>,
    pub nombre_participants: i32,
    pub nombre_max_participants: Option<i32>,
    pub is_active: bool,
    pub is_annule: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateConferenceRequest {
    pub etablissement_id: i32,
    pub titre: String,
    pub description: Option<String>,
    pub type_conference: String,
    pub date_programmee: DateTime<Utc>,
    pub duree_estimee: Option<i32>,
    pub nombre_max_participants: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConferencesRequest {
    pub etablissement_id: Option<i32>,
    pub type_conference: Option<String>,
    pub date_min: Option<DateTime<Utc>>,
    pub date_max: Option<DateTime<Utc>>,
    pub actives_seulement: Option<bool>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

// Suggestions d'orientation
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SuggestionOrientation {
    pub id: i32,
    pub type_etablissement: String,
    pub domaine: Option<String>,
    pub filiere: Option<String>,
    pub ville: Option<String>,
    pub region: Option<String>,
    #[sqlx(default)]
    pub etablissements_suggerees: Vec<i32>,
    #[sqlx(default)]
    pub scores: serde_json::Value,
    #[sqlx(default)]
    pub criteres_utilises: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}
