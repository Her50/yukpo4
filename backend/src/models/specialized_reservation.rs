// ✅ NOUVEAU: Modèle de réservation pour services spécialisés

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Réservation pour un service spécialisé
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct SpecializedReservation {
    pub id: i32,
    #[allow(dead_code)]
    pub service_id: i32, // ID du service spécialisé (pharmacie, hopital, etc.)
    pub service_type: String, // "pharmacie", "hopital", "laboratoire", "covoiturage", "taxi", "agence_voyage"
    #[allow(dead_code)]
    pub user_id: i32, // Client qui fait la réservation
    pub prestataire_id: i32,  // Prestataire propriétaire du service

    // Détails de la réservation
    pub reservation_type: String, // "rdv", "place", "course", "ticket"
    pub status: String,           // "pending", "confirmed", "completed", "cancelled"

    // Dates
    pub requested_date: Option<DateTime<Utc>>, // Date/heure demandée
    pub confirmed_date: Option<DateTime<Utc>>, // Date/heure confirmée
    pub completed_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,

    // Détails spécifiques selon le type
    pub details: serde_json::Value, // JSON avec détails spécifiques

    // Paiement
    pub amount: Option<rust_decimal::Decimal>, // Montant à payer
    pub currency: Option<String>,              // Devise
    pub payment_status: Option<String>,        // "pending", "paid", "refunded"
    pub payment_method: Option<String>,        // "mobile_money", "card", "cash"

    // Métadonnées
    pub notes: Option<String>,             // Notes du client
    pub prestataire_notes: Option<String>, // Notes du prestataire
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Détails spécifiques pour réservation hôpital/laboratoire
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MedicalReservationDetails {
    pub service_type: String,    // Type de service médical
    pub urgency: Option<String>, // "urgent", "normal"
    pub patient_name: Option<String>,
    pub patient_age: Option<i32>,
    pub reason: Option<String>, // Raison du RDV
}

/// Détails spécifiques pour réservation covoiturage
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CarpoolReservationDetails {
    pub nombre_places: i32,
    pub passagers: Vec<serde_json::Value>, // Liste des passagers
    pub pickup_location: Option<String>,
    pub dropoff_location: Option<String>,
}

/// Détails spécifiques pour réservation taxi
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaxiReservationDetails {
    pub pickup_address: String,
    pub dropoff_address: Option<String>,
    pub pickup_lat: Option<f64>,
    pub pickup_lng: Option<f64>,
    pub dropoff_lat: Option<f64>,
    pub dropoff_lng: Option<f64>,
    pub estimated_distance_km: Option<f64>,
    pub estimated_duration_min: Option<i32>,
}

/// Détails spécifiques pour réservation agence (ticket bus)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgencyReservationDetails {
    pub destination: String,
    pub departure_date: DateTime<Utc>,
    pub number_of_tickets: i32,
    pub passenger_names: Vec<String>,
}
