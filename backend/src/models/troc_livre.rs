// ✅ NOUVEAU: Modèle pour trocs de livres scolaires

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TrocLivre {
    pub id: i32,

    // Participants
    pub initiateur_id: i32,
    pub participant_id: i32,

    // Livres échangés
    pub livre_offert_id: i32,
    pub livre_souhaite_id: i32,

    // Type de troc
    pub type_troc: String, // "direct" (2 personnes) ou "chaine" (3+ personnes)
    pub chaine_troc_id: Option<i32>, // ID de la chaîne si type_troc = "chaine"

    // Statut
    pub statut: String, // "en_attente", "accepte", "refuse", "annule", "complete"

    // Validation
    pub validation_initiateur: bool,
    pub validation_participant: bool,
    pub validation_video: bool, // Validation via vidéo live

    // Proximité
    pub distance_km: Option<f64>,

    // Dates
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub date_echange: Option<DateTime<Utc>>, // Date prévue pour l'échange physique
    pub date_complete: Option<DateTime<Utc>>, // Date de finalisation
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChaineTrocLivre {
    pub id: i32,

    // Participants (ordre de la chaîne)
    pub participants: serde_json::Value, // JSONB: [{user_id, livre_offert_id, livre_souhaite_id, ordre}]

    // Statut
    pub statut: String, // "en_formation", "validee", "en_cours", "complete"

    // Score de proximité global
    pub score_proximite: Option<f64>,
    pub distance_totale_km: Option<f64>,

    // Dates
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub date_validation: Option<DateTime<Utc>>,
    pub date_complete: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantChaine {
    pub user_id: i32,
    pub livre_offert_id: i32,
    pub livre_souhaite_id: i32,
    pub ordre: i32, // Ordre dans la chaîne (1, 2, 3, ...)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTrocDirectRequest {
    pub livre_offert_id: i32,   // Livre de l'initiateur
    pub livre_souhaite_id: i32, // Livre du participant
    pub participant_id: i32,    // ID du participant
    pub date_echange: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTrocChaineRequest {
    pub participants: Vec<ParticipantChaine>, // Liste des participants dans l'ordre de la chaîne
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingResult {
    pub matching_type: String, // "direct" ou "chaine"
    pub matches: Vec<MatchingDirect>,
    pub chaines: Vec<MatchingChaine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingDirect {
    pub livre_offert_id: i32,
    pub livre_souhaite_id: i32,
    pub participant_id: i32,
    pub distance_km: Option<f64>,
    pub score_proximite: f64,
    pub livre_offert: Option<serde_json::Value>, // Détails du livre offert
    pub livre_souhaite: Option<serde_json::Value>, // Détails du livre souhaité
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingChaine {
    pub chaine_id: Option<i32>, // ID si chaîne déjà créée
    pub participants: Vec<ParticipantChaine>,
    pub distance_totale_km: f64,
    pub score_proximite: f64,
    pub nombre_participants: i32,
    pub livres: Vec<serde_json::Value>, // Détails des livres de la chaîne
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrocDetails {
    #[serde(flatten)]
    pub troc: TrocLivre,
    pub livre_offert: Option<serde_json::Value>,
    pub livre_souhaite: Option<serde_json::Value>,
    pub initiateur: Option<serde_json::Value>, // Détails utilisateur initiateur
    pub participant: Option<serde_json::Value>, // Détails utilisateur participant
    pub chaine: Option<ChaineTrocLivre>,       // Détails de la chaîne si applicable
}
