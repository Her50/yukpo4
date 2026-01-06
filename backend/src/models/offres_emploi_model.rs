use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{types::BigDecimal, FromRow};

/// Type de contrat d'emploi
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TypeContrat {
    CDI,
    CDD,
    Stage,
    Freelance,
    #[serde(rename = "Temps partiel")]
    TempsPartiel,
    Alternance,
}

/// Statut d'une offre d'emploi
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StatutOffre {
    Active,
    Pourvue,
    Fermee,
    Brouillon,
}

/// Statut d'une candidature
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StatutCandidature {
    EnAttente,
    EnCours,
    Acceptee,
    Refusee,
    Annulee,
}

/// Fréquence d'alerte emploi
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FrequenceAlerte {
    Instantanee,
    Quotidienne,
    Hebdomadaire,
}

/// Modèle : Offre d'emploi
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OffreEmploi {
    pub id: i32,
    pub entreprise_id: i32,
    pub titre_poste: String,
    pub description: String,
    pub type_contrat: String,
    pub duree_contrat: Option<i32>,
    pub lieu_travail: String,
    pub adresse: Option<String>,
    pub gps: Option<String>,
    pub remote: bool,
    pub remote_partiel: bool,
    pub salaire_min: Option<BigDecimal>,
    pub salaire_max: Option<BigDecimal>,
    pub devise: String,
    pub salaire_negociable: bool,
    pub niveau_etude: Option<String>,
    pub experience_min: Option<i32>,
    pub competences_requises: Option<Vec<String>>,
    pub langues_requises: Option<Value>,
    pub permis_requis: Option<Vec<String>>,
    pub secteur: String,
    pub domaine: Option<String>,
    pub tags: Option<Vec<String>>,
    pub date_publication: DateTime<Utc>,
    pub date_limite_candidature: Option<NaiveDate>,
    pub date_debut_poste: Option<NaiveDate>,
    pub statut: String,
    pub nombre_candidatures: i32,
    pub nombre_vues: i32,
    pub is_active: bool,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Modèle : Profil candidat
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProfilCandidat {
    pub id: i32,
    pub user_id: i32,
    pub nom_complet: String,
    pub date_naissance: Option<NaiveDate>,
    pub telephone: Option<String>,
    pub email: String,
    pub adresse: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub titre_professionnel: Option<String>,
    pub niveau_etude: Option<String>,
    pub experience_annees: i32,
    pub secteur_principal: Option<String>,
    pub competences: Option<Vec<String>>,
    pub langues: Option<Value>,
    pub permis: Option<Vec<String>>,
    pub certifications: Option<Vec<String>>,
    pub cv_url: Option<String>,
    pub cv_nom: Option<String>,
    pub photo_url: Option<String>,
    pub portfolio_url: Option<String>,
    pub type_contrat_souhaite: Option<Vec<String>>,
    pub salaire_souhaite_min: Option<BigDecimal>,
    pub salaire_souhaite_max: Option<BigDecimal>,
    pub remote_souhaite: bool,
    pub secteurs_interesses: Option<Vec<String>>,
    pub disponible_immediatement: bool,
    pub date_disponibilite: Option<NaiveDate>,
    pub is_active: bool,
    pub is_complete: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Modèle : Candidature
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Candidature {
    pub id: i32,
    pub offre_id: i32,
    pub candidat_id: i32,
    pub profil_id: Option<i32>,
    pub lettre_motivation: Option<String>,
    pub cv_url: Option<String>,
    pub documents_complementaires: Option<Value>,
    pub statut: String,
    pub date_candidature: DateTime<Utc>,
    pub date_modification_statut: Option<DateTime<Utc>>,
    pub score_matching: Option<BigDecimal>,
    pub notes_employeur: Option<String>,
    pub evaluation_candidat: Option<Value>,
    pub is_archived: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Modèle : Matching offre/candidat (cache)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MatchingOffreCandidat {
    pub id: i32,
    pub offre_id: i32,
    pub candidat_id: i32,
    pub score_total: BigDecimal,
    pub score_competences: Option<BigDecimal>,
    pub score_experience: Option<BigDecimal>,
    pub score_localisation: Option<BigDecimal>,
    pub score_salaire: Option<BigDecimal>,
    pub competences_match: Option<Vec<String>>,
    pub competences_manquantes: Option<Vec<String>>,
    pub criteres_match: Option<Value>,
    pub date_calcul: DateTime<Utc>,
    pub is_notified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Modèle : Alerte emploi
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AlerteEmploi {
    pub id: i32,
    pub candidat_id: i32,
    pub titre_poste: Option<String>,
    pub secteur: Option<String>,
    pub type_contrat: Option<Vec<String>>,
    pub salaire_min: Option<BigDecimal>,
    pub lieu_travail: Option<String>,
    pub remote: Option<bool>,
    pub competences: Option<Vec<String>>,
    pub frequence: String,
    pub dernier_envoi: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Modèle : Statistiques offre
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StatistiquesOffre {
    pub id: i32,
    pub offre_id: i32,
    pub nombre_vues: i32,
    pub nombre_candidatures: i32,
    pub nombre_candidatures_qualifiees: i32,
    pub taux_conversion: Option<BigDecimal>,
    pub repartition_experience: Option<Value>,
    pub repartition_niveau_etude: Option<Value>,
    pub repartition_localisation: Option<Value>,
    pub date_calcul: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO : Création d'une offre d'emploi
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOffreEmploiRequest {
    pub titre_poste: String,
    pub description: String,
    pub type_contrat: String,
    pub duree_contrat: Option<i32>,
    pub lieu_travail: String,
    pub adresse: Option<String>,
    pub gps: Option<String>,
    pub remote: Option<bool>,
    pub remote_partiel: Option<bool>,
    pub salaire_min: Option<f64>,
    pub salaire_max: Option<f64>,
    pub devise: Option<String>,
    pub salaire_negociable: Option<bool>,
    pub niveau_etude: Option<String>,
    pub experience_min: Option<i32>,
    pub competences_requises: Option<Vec<String>>,
    pub langues_requises: Option<Value>,
    pub permis_requis: Option<Vec<String>>,
    pub secteur: String,
    pub domaine: Option<String>,
    pub tags: Option<Vec<String>>,
    pub date_limite_candidature: Option<NaiveDate>,
    pub date_debut_poste: Option<NaiveDate>,
}

/// DTO : Recherche d'offres d'emploi
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOffresRequest {
    pub query: Option<String>, // ✅ NOUVEAU: Recherche textuelle
    pub secteur: Option<String>,
    pub type_contrat: Option<Vec<String>>,
    pub salaire_min: Option<f64>,
    pub salaire_max: Option<f64>,
    pub lieu_travail: Option<String>,
    pub gps: Option<String>, // Format: "lat,lng"
    pub distance_max_km: Option<f64>,
    pub remote: Option<bool>,
    pub niveau_etude: Option<String>,
    pub experience_min: Option<i32>,
    pub competences: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// DTO : Création/mise à jour profil candidat
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrUpdateProfilRequest {
    pub nom_complet: String,
    pub date_naissance: Option<NaiveDate>,
    pub telephone: Option<String>,
    pub email: String,
    pub adresse: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub titre_professionnel: Option<String>,
    pub niveau_etude: Option<String>,
    pub experience_annees: Option<i32>,
    pub secteur_principal: Option<String>,
    pub competences: Option<Vec<String>>,
    pub langues: Option<Value>,
    pub permis: Option<Vec<String>>,
    pub certifications: Option<Vec<String>>,
    pub cv_url: Option<String>,
    pub cv_nom: Option<String>,
    pub photo_url: Option<String>,
    pub portfolio_url: Option<String>,
    pub type_contrat_souhaite: Option<Vec<String>>,
    pub salaire_souhaite_min: Option<f64>,
    pub salaire_souhaite_max: Option<f64>,
    pub remote_souhaite: Option<bool>,
    pub secteurs_interesses: Option<Vec<String>>,
    pub disponible_immediatement: Option<bool>,
    pub date_disponibilite: Option<NaiveDate>,
}

/// DTO : Création d'une candidature
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCandidatureRequest {
    pub offre_id: i32,
    pub lettre_motivation: Option<String>,
    pub cv_url: Option<String>,
    pub documents_complementaires: Option<Value>,
}

/// DTO : Mise à jour statut candidature
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatutCandidatureRequest {
    pub statut: String,
    pub notes_employeur: Option<String>,
    pub evaluation_candidat: Option<Value>,
}

/// DTO : Création d'une alerte emploi
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAlerteEmploiRequest {
    pub titre_poste: Option<String>,
    pub secteur: Option<String>,
    pub type_contrat: Option<Vec<String>>,
    pub salaire_min: Option<f64>,
    pub lieu_travail: Option<String>,
    pub remote: Option<bool>,
    pub competences: Option<Vec<String>>,
    pub frequence: Option<String>,
}
