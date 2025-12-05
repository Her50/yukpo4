// Rust: Structure pour l'insertion et le matching d'embeddings dans Yukpo
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceEmbedding {
    pub id: i32,
    pub service_id: i32,
    pub champ: String,
    pub type_donnee: String,
    pub embedding_nom: Vec<f32>,
    pub embedding_contenu: Vec<f32>,
    pub gps_prestataire: Option<(f64, f64)>, // (longitude, latitude)
    pub gps_fixe: Option<(f64, f64)>,        // (longitude, latitude)
}

// Note: Ce modèle n'est plus utilisé (pgvector non disponible)
// Les embeddings sont stockés en TEXT dans la table videos si nécessaire
// Note: Ces champs correspondent à geometry(Point,4326) dans PostGIS. Utiliser sqlx::types::GeoPoint ou un tuple (f64, f64) selon le driver.
