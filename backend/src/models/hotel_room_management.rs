// ✅ NOUVEAU: Modèles pour gestion complète des chambres/unités hôtels et meublés
// Date: 2026-01-27

use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Unité (chambre/studio/appartement) d'un bien hôtel/meublé
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct HotelMeubleUnit {
    pub id: i32,
    pub property_id: i32,
    pub unit_number: String,
    pub unit_type: String, // "chambre", "studio", "appartement", "suite", "villa"
    pub standing: Option<String>, // "standard", "superior", "deluxe", "premium", "luxury"
    pub capacite_max_adultes: i32,
    pub capacite_max_enfants: Option<i32>,
    pub capacite_max_total: i32,
    pub superficie_m2: Option<rust_decimal::Decimal>,
    pub equipements: serde_json::Value,
    pub photos: Option<Vec<String>>,
    pub prix_nuitee: Option<rust_decimal::Decimal>,
    pub prix_heure: Option<rust_decimal::Decimal>,
    pub is_active: bool,
    pub is_available: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Blocage d'unité (maintenance, nettoyage, occupation manuelle, etc.)
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct HotelUnitBlockage {
    pub id: i32,
    pub unit_id: i32,
    pub property_id: i32,
    pub date_debut: NaiveDate,
    pub date_fin: NaiveDate,
    pub heure_debut: Option<NaiveTime>,
    pub heure_fin: Option<NaiveTime>,
    pub raison: String, // "maintenance", "nettoyage", "renovation", "occupation_manuelle", "reservation_hors_app", "autre"
    pub description: Option<String>,
    // ✅ NOUVEAU: Pour occupation manuelle (hors système)
    pub is_manual_occupation: bool,
    pub client_name: Option<String>,
    pub client_phone: Option<String>,
    pub notes_occupation: Option<String>,
    pub created_by: Option<i32>,
    pub created_at: DateTime<Utc>,
}

/// Groupe de propriétés (multi-biens)
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct HotelPropertyGroup {
    pub id: i32,
    pub partner_id: i32,
    pub group_name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub company_name: Option<String>,
    pub tax_id: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Membre d'un groupe de propriétés
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct HotelPropertyGroupMember {
    pub id: i32,
    pub group_id: i32,
    pub property_id: i32,
    pub location_name: Option<String>,
    pub location_address: Option<String>,
    pub location_gps: Option<String>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
}

/// Configuration formulaire client personnalisé
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct HotelClientFormConfig {
    pub id: i32,
    pub property_id: Option<i32>,
    pub group_id: Option<i32>,
    pub form_fields: serde_json::Value,
    pub required_fields: Option<Vec<String>>,
    pub default_values: serde_json::Value,
    pub logo_url: Option<String>,
    pub header_text: Option<String>,
    pub footer_text: Option<String>,
    pub company_info: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Profil client sauvegardé (pré-remplissage)
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct HotelClientProfile {
    pub id: i32,
    pub user_id: i32,
    pub nom_complet: Option<String>,
    pub prenom: Option<String>,
    pub nom_famille: Option<String>,
    pub date_naissance: Option<NaiveDate>,
    pub lieu_naissance: Option<String>,
    pub nationalite: Option<String>,
    pub type_piece_identite: Option<String>, // "CNI", "Passeport", "Permis", etc.
    pub numero_piece_identite: Option<String>,
    pub date_expiration_piece: Option<NaiveDate>,
    pub telephone: Option<String>,
    pub email: Option<String>,
    pub adresse: Option<String>,
    pub ville: Option<String>,
    pub pays: Option<String>,
    pub preferences: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Requête pour créer une unité
#[derive(Debug, Deserialize, Clone)]
pub struct CreateUnitRequest {
    pub property_id: i32,
    pub unit_number: String,
    pub unit_type: String,
    pub standing: Option<String>,
    pub capacite_max_adultes: i32,
    pub capacite_max_enfants: Option<i32>,
    pub superficie_m2: Option<rust_decimal::Decimal>,
    pub equipements: Option<serde_json::Value>,
    pub photos: Option<Vec<String>>,
    pub prix_nuitee: Option<rust_decimal::Decimal>,
    pub prix_heure: Option<rust_decimal::Decimal>,
    pub notes: Option<String>,
}

/// Requête pour créer un blocage
#[derive(Debug, Deserialize, Clone)]
pub struct CreateBlockageRequest {
    pub unit_id: i32,
    pub property_id: i32,
    pub date_debut: NaiveDate,
    pub date_fin: NaiveDate,
    pub heure_debut: Option<NaiveTime>,
    pub heure_fin: Option<NaiveTime>,
    pub raison: String, // "maintenance", "nettoyage", "renovation", "occupation_manuelle", "reservation_hors_app", "autre"
    pub description: Option<String>,
    // ✅ NOUVEAU: Pour occupation manuelle
    pub is_manual_occupation: Option<bool>,
    pub client_name: Option<String>,
    pub client_phone: Option<String>,
    pub notes_occupation: Option<String>,
}

/// Requête pour créer un groupe de propriétés
#[derive(Debug, Deserialize, Clone)]
pub struct CreatePropertyGroupRequest {
    pub group_name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub company_name: Option<String>,
    pub tax_id: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

/// Requête pour scanner QR code
#[derive(Debug, Deserialize, Clone)]
pub struct ScanQRCodeRequest {
    pub qr_code: String,
}

/// Réponse après scan QR code
#[derive(Debug, Serialize, Clone)]
pub struct QRCodeScanResponse {
    pub reservation_id: i32,
    pub property_id: i32,
    pub property_name: String,
    /// Numéro d'unité/chambre si déjà assignée
    pub unit_number: Option<String>,
    pub client_name: String,
    pub date_arrivee: NaiveDate,
    pub date_depart: NaiveDate,
    pub payment_status: String,
    pub montant_avance: rust_decimal::Decimal,
    pub montant_total: rust_decimal::Decimal,
    pub montant_restant: rust_decimal::Decimal,
    pub status: String,
    pub can_check_in: bool,
    pub can_check_out: bool,
    /// Type de QR scanné : "main" (titulaire) ou "guest"
    pub qr_type: String,
    /// Label libre éventuel pour l'invité / co-chambrier
    pub guest_label: Option<String>,
}

/// Requête pour assigner une unité à une réservation
#[derive(Debug, Deserialize, Clone)]
pub struct AssignUnitRequest {
    pub reservation_id: i32,
    pub unit_id: Option<i32>, // Si NULL, assignation automatique
    pub unit_type: Option<String>,
    pub standing: Option<String>,
}

/// Requête pour configuration formulaire client
#[derive(Debug, Deserialize, Clone)]
pub struct UpdateFormConfigRequest {
    pub form_fields: Option<serde_json::Value>,
    pub required_fields: Option<Vec<String>>,
    pub default_values: Option<serde_json::Value>,
    pub logo_url: Option<String>,
    pub header_text: Option<String>,
    pub footer_text: Option<String>,
    pub company_info: Option<serde_json::Value>,
}

/// Requête pour créer réservation manuelle (par gérant)
#[derive(Debug, Deserialize, Clone)]
pub struct CreateManualReservationRequest {
    pub property_id: i32,
    pub unit_id: Option<i32>,        // Si NULL, assignation automatique
    pub unit_number: Option<String>, // Si unit_id NULL mais unit_number fourni
    pub date_arrivee: NaiveDate,
    pub date_depart: NaiveDate,
    pub nombre_adultes: i32,
    pub nombre_enfants: Option<i32>,
    pub nombre_chambres: i32,
    pub nom_client: String,
    pub telephone_client: String,
    pub email_client: Option<String>,
    pub prix_nuitee: rust_decimal::Decimal,
    pub prix_total: rust_decimal::Decimal,
    pub montant_total: rust_decimal::Decimal,
    pub montant_avance: Option<rust_decimal::Decimal>, // Si paiement partiel reçu
    pub payment_status: Option<String>,                // "pending", "advance_paid", "fully_paid"
    pub payment_method: Option<String>, // "cash", "mobile_money", "card", "bank_transfer"
    pub manual_reservation_source: String, // "telephone", "en_personne", "autre_plateforme", "autre"
    pub notes: Option<String>,
    pub notes_proprietaire: Option<String>,
}

/// Requête pour sauvegarder profil client
#[derive(Debug, Deserialize, Clone)]
pub struct SaveClientProfileRequest {
    pub nom_complet: Option<String>,
    pub prenom: Option<String>,
    pub nom_famille: Option<String>,
    pub date_naissance: Option<NaiveDate>,
    pub lieu_naissance: Option<String>,
    pub nationalite: Option<String>,
    pub type_piece_identite: Option<String>,
    pub numero_piece_identite: Option<String>,
    pub date_expiration_piece: Option<NaiveDate>,
    pub telephone: Option<String>,
    pub email: Option<String>,
    pub adresse: Option<String>,
    pub ville: Option<String>,
    pub pays: Option<String>,
    pub preferences: Option<serde_json::Value>,
}
