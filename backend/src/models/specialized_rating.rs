// ✅ NOUVEAU: Modèle d'avis et ratings pour services spécialisés

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Avis/rating pour un service spécialisé
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct SpecializedRating {
    pub id: i32,
    pub service_id: i32,      // ID du service spécialisé
    pub service_type: String, // "pharmacie", "hopital", etc.
    pub user_id: i32,         // Client qui a laissé l'avis
    pub prestataire_id: i32,  // Prestataire propriétaire du service

    // Rating
    pub rating: i32,             // 1-5 étoiles
    pub comment: Option<String>, // Commentaire texte

    // Détails par catégorie (optionnel)
    pub quality_rating: Option<i32>,       // Qualité du service (1-5)
    pub punctuality_rating: Option<i32>,   // Ponctualité (1-5)
    pub price_rating: Option<i32>,         // Rapport qualité/prix (1-5)
    pub communication_rating: Option<i32>, // Communication (1-5)

    // Métadonnées
    pub reservation_id: Option<i32>, // Lien vers réservation si applicable
    pub is_verified: bool,           // Avis vérifié (client a utilisé le service)
    pub helpful_count: i32,          // Nombre de "utile" reçus
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Statistiques de ratings pour un service
#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceRatingStats {
    pub service_id: i32,
    pub average_rating: f64, // Moyenne globale
    pub total_ratings: i32,
    pub rating_distribution: serde_json::Value, // {1: 5, 2: 3, 3: 10, 4: 20, 5: 62}
    pub average_quality: Option<f64>,
    pub average_punctuality: Option<f64>,
    pub average_price: Option<f64>,
    pub average_communication: Option<f64>,
}
