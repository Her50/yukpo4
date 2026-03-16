// ✅ Modèle pour trocs de livres scolaires — V3: DAG sans réciprocité

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

    // Constitution paquet
    pub is_packaged: Option<bool>, // true si déjà inclus dans un paquet de livraison

    // Dates
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub date_echange: Option<DateTime<Utc>>, // Date prévue pour l'échange physique
    pub date_complete: Option<DateTime<Utc>>, // Date de finalisation
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChaineTrocLivre {
    pub id: i32,

    // Participants (ordre de la chaîne) — legacy
    pub participants: serde_json::Value, // JSONB: [{user_id, livre_offert_id, livre_souhaite_id, ordre}]

    // V3: Transferts directionnels (arêtes du DAG)
    pub transfers: Option<serde_json::Value>, // [{sender_id, receiver_id, livre_id, ...}]

    // V3: Route optimisée du coursier
    pub route_optimisee: Option<serde_json::Value>,

    // V3: Planning de livraison multi-jours
    pub delivery_schedule: Option<serde_json::Value>,

    // V3: Référence lisible
    pub reference: Option<String>,

    // V3: Nombre de vendeurs dans la chaîne
    pub nombre_vendeurs: Option<i32>,

    // V3: IDs des paquets générés
    pub package_ids: Option<serde_json::Value>,

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

// ============================================================================
// TRANSFERT DIRECTIONNEL (arête du DAG de la chaîne)
// ============================================================================

/// Un transfert = un livre envoyé de sender vers receiver.
/// Anti-réciprocité: si (A→B) existe, (B→A) est interdit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainTransfer {
    pub sender_id: i32,
    pub receiver_id: i32,
    pub livre_id: i32,
    pub livre_titre: Option<String>,
    pub matiere: Option<String>,
    pub valeur: f64,
    pub mode_listing: String, // 'troc' ou 'vente'
    pub statut: String,       // 'pending', 'picked_up', 'delivered', 'cancelled'
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
    /// true si un troc inverse (participant→initiateur) existe déjà ou serait créé.
    /// Les matchs réciproques causent des allers-retours coursier et sont à éviter.
    #[serde(default)]
    pub is_reciprocal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingChaine {
    pub chaine_id: Option<i32>,
    pub participants: Vec<ParticipantChaine>,
    pub transfers: Vec<ChainTransfer>, // V3: arêtes du DAG
    pub distance_totale_km: f64,
    pub score_proximite: f64,
    pub nombre_participants: i32,
    pub nombre_vendeurs: i32, // V3: vendeurs (source-only)
    pub livres: Vec<serde_json::Value>,
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

// ============================================================================
// ANNULATION LIVRE PAR COURSIER (aléas terrain)
// ============================================================================

/// Requête d'annulation d'un livre par le coursier sur le terrain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookCancellationRequest {
    pub package_id: i32,
    pub livre_id: i32,
    pub raison: Option<String>,
}
