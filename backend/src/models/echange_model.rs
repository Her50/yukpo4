// Rust: Mod?le Echange enrichi pour Yukpo
use serde::{Deserialize, Serialize};
use chrono::NaiveDateTime;

#[derive(Debug, Serialize, Deserialize)]
pub struct Echange {
    pub id: i32,
    pub user_id: i32,
    pub offre: serde_json::Value,
    pub besoin: serde_json::Value,
    pub statut: String,
    pub matched_with: Option<i32>,
    pub quantite_offerte: Option<f64>,
    pub quantite_requise: Option<f64>,
    pub lot_id: Option<i32>,
    pub disponibilite: Option<serde_json::Value>, // ex: jours, heures, r?currence
    pub contraintes: Option<serde_json::Value>,   // contraintes personnalis?es
    pub reputation: Option<f64>,                  // score de r?putation utilisateur
    pub gps_fixe_lat: Option<f64>,               // latitude GPS fixe
    pub gps_fixe_lon: Option<f64>,               // longitude GPS fixe
    pub don: bool,                               // true si don, false sinon
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
