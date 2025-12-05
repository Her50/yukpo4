// ✅ NOUVEAU: Modèle pour livres scolaires

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LivreScolaire {
    pub id: i32,
    pub service_id: Option<i32>,
    pub user_id: i32,

    // Informations livre
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe_actuelle: String, // Classe actuelle de l'élève (ex: "6ème", "5ème")
    pub classe_souhaitee: String, // Classe souhaitée (ex: "5ème", "4ème")
    pub matiere: String,         // "Mathématiques", "Français", etc.
    pub niveau: Option<String>,  // "Primaire", "Collège", "Lycée"

    // État et médias
    pub etat_livre: String, // "Neuf", "Très bon", "Bon", "Acceptable"
    pub description_etat: Option<String>,
    #[sqlx(default)]
    pub images_urls: Vec<String>, // URLs des images du livre
    pub video_url: Option<String>, // URL vidéo d'appréciation de l'état

    // Géolocalisation
    pub gps: Option<String>, // Format: "lat,lng"
    pub ville: Option<String>,
    pub quartier: Option<String>,

    // Disponibilité
    pub is_available: bool,
    pub is_active: bool,

    // Métadonnées
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateLivreScolaireRequest {
    pub service_id: Option<i32>,
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe_actuelle: String,
    pub classe_souhaitee: String,
    pub matiere: String,
    pub niveau: Option<String>,
    pub etat_livre: String,
    pub description_etat: Option<String>,
    pub images_urls: Option<Vec<String>>,
    pub video_url: Option<String>,
    pub gps: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateLivreScolaireRequest {
    pub titre: Option<String>,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe_actuelle: Option<String>,
    pub classe_souhaitee: Option<String>,
    pub matiere: Option<String>,
    pub niveau: Option<String>,
    pub etat_livre: Option<String>,
    pub description_etat: Option<String>,
    pub images_urls: Option<Vec<String>>,
    pub video_url: Option<String>,
    pub gps: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub is_available: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchLivresScolairesRequest {
    pub classe_actuelle: Option<String>,
    pub classe_souhaitee: Option<String>,
    pub matiere: Option<String>,
    pub niveau: Option<String>,
    pub etat_livre: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub gps_lat: Option<f64>, // Pour recherche de proximité
    pub gps_lon: Option<f64>,
    pub rayon_km: Option<f64>, // Rayon de recherche en km (défaut: 10 km)
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LivreScolaireWithDistance {
    #[serde(flatten)]
    pub livre: LivreScolaire,
    pub distance_km: Option<f64>,
}
