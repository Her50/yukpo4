use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreerEchangeRequest {
    pub user_id: i32,
    pub offre: serde_json::Value,
    pub besoin: serde_json::Value,
    pub quantite_offerte: Option<f64>,
    pub quantite_requise: Option<f64>,
    pub lot_id: Option<i32>,
    pub disponibilite: Option<serde_json::Value>,
    pub contraintes: Option<serde_json::Value>,
    pub gps_fixe_lat: Option<f64>,
    pub gps_fixe_lon: Option<f64>,
    pub mode: Option<String>,
    pub mode_troc: Option<String>,
    pub gps: Option<serde_json::Value>,
}
