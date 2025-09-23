// Configuration de recherche
use serde::{Deserialize, Serialize};
use crate::config::production_config::ProductionConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConfig {
    pub max_results: i32,
    pub default_language: String,
    pub title_boost: f32,
    pub default_radius_km: f64,
    pub default_lat: f64,
    pub default_lon: f64,
    pub priority_categories: Vec<String>,
    pub priority_locations: Vec<String>,
    pub recency_days: i64,
    pub recency_boost: f32,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            max_results: 1000, // Augmenté pour afficher tous les services correspondants
            default_language: "fr".to_string(),
            title_boost: 2.0,
            default_radius_km: 20.0,
            default_lat: 4.0,
            default_lon: 9.7,
            priority_categories: vec![
                "coiffure".to_string(),
                "mecanique".to_string(),
                "electronique".to_string(),
            ],
            priority_locations: vec![
                "Douala".to_string(),
                "Yaounde".to_string(),
            ],
            recency_days: 30,
            recency_boost: 1.5,
        }
    }
}

pub fn create_production_config() -> ProductionConfig {
    ProductionConfig::default()
} 