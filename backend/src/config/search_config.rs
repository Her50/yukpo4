use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::path::Path;
use tokio::fs;
use crate::utils::log::log_info;

/// Configuration de recherche native PostgreSQL pour production
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConfig {
    /// Configuration générale de la recherche
    pub general: GeneralSearchConfig,
    /// Configuration des scores et boosts
    pub scoring: ScoringConfig,
    /// Configuration des filtres
    pub filters: FilterConfig,
    /// Configuration géospatiale
    pub geospatial: GeospatialConfig,
    /// Configuration des performances
    pub performance: PerformanceConfig,
}

/// Configuration générale de la recherche
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralSearchConfig {
    /// Nombre maximum de résultats par défaut
    pub max_results: i32,
    /// Nombre de résultats pour le tri initial
    pub initial_results: i32,
    /// Seuil de score minimum pour inclure un résultat
    pub min_score_threshold: f32,
    /// Activer la recherche hybride (full-text + trigram)
    pub enable_hybrid_search: bool,
    /// Activer la recherche géospatiale
    pub enable_geospatial: bool,
    /// Langue par défaut pour la recherche full-text
    pub default_language: String,
}

/// Configuration des scores et boosts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringConfig {
    /// Boost pour le titre du service
    pub title_boost: f32,
    /// Boost pour la description
    pub description_boost: f32,
    /// Boost pour la catégorie
    pub category_boost: f32,
    /// Boost pour la localisation
    pub location_boost: f32,
    /// Boost pour les services récents
    pub recency_boost: f32,
    /// Nombre de jours pour le bonus de récence
    pub recency_days: i64,
    /// Boost pour les services populaires
    pub popularity_boost: f32,
    /// Boost pour les services vérifiés
    pub verified_boost: f32,
    /// Score minimum pour la recherche full-text
    pub min_fulltext_score: f32,
    /// Score minimum pour la similarité trigram
    pub min_trigram_similarity: f32,
}

/// Configuration des filtres
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterConfig {
    /// Activer le filtrage par catégorie
    pub enable_category_filter: bool,
    /// Activer le filtrage par localisation
    pub enable_location_filter: bool,
    /// Activer le filtrage par prix
    pub enable_price_filter: bool,
    /// Activer le filtrage par disponibilité
    pub enable_availability_filter: bool,
    /// Activer le filtrage par évaluation
    pub enable_rating_filter: bool,
    /// Catégories prioritaires (configurables via env)
    pub priority_categories: Vec<String>,
    /// Localisations prioritaires (configurables via env)
    pub priority_locations: Vec<String>,
}

/// Configuration géospatiale
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeospatialConfig {
    /// Rayon de recherche par défaut (en km)
    pub default_search_radius_km: f64,
    /// Rayon maximum de recherche (en km)
    pub max_search_radius_km: f64,
    /// Utiliser PostGIS pour les calculs géospatiaux
    pub use_postgis: bool,
    /// Boost pour la proximité géographique
    pub proximity_boost: f32,
    /// Facteur de décroissance de la distance
    pub distance_decay_factor: f32,
    /// Coordonnées par défaut (configurables via env)
    pub default_coordinates: Option<Vec<f64>>,
}

/// Configuration des performances
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    /// Taille du cache des requêtes fréquentes
    pub query_cache_size: usize,
    /// Durée de vie du cache (en secondes)
    pub cache_ttl_seconds: u64,
    /// Activer le cache Redis
    pub enable_redis_cache: bool,
    /// Timeout des requêtes (en millisecondes)
    pub query_timeout_ms: u64,
    /// Nombre maximum de tentatives en cas d'échec
    pub max_retries: u32,
    /// Activer la compression des résultats
    pub enable_compression: bool,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            general: GeneralSearchConfig::default(),
            scoring: ScoringConfig::default(),
            filters: FilterConfig::default(),
            geospatial: GeospatialConfig::default(),
            performance: PerformanceConfig::default(),
        }
    }
}

impl Default for GeneralSearchConfig {
    fn default() -> Self {
        Self {
            max_results: 20,
            initial_results: 50,
            min_score_threshold: 0.05,
            enable_hybrid_search: true,
            enable_geospatial: true,
            default_language: "french".to_string(),
        }
    }
}

impl Default for ScoringConfig {
    fn default() -> Self {
        Self {
            title_boost: 2.0,
            description_boost: 1.0,
            category_boost: 1.5,
            location_boost: 1.3,
            recency_boost: 0.2,
            recency_days: 14,
            popularity_boost: 0.3,
            verified_boost: 0.5,
            min_fulltext_score: 0.08,
            min_trigram_similarity: 0.25,
        }
    }
}

impl Default for FilterConfig {
    fn default() -> Self {
        Self {
            enable_category_filter: true,
            enable_location_filter: true,
            enable_price_filter: true,
            enable_availability_filter: true,
            enable_rating_filter: true,
            priority_categories: Vec::new(), // Vide par défaut
            priority_locations: Vec::new(),  // Vide par défaut
        }
    }
}

impl Default for GeospatialConfig {
    fn default() -> Self {
        Self {
            default_search_radius_km: 25.0,
            max_search_radius_km: 100.0,
            use_postgis: true,
            proximity_boost: 0.4,
            distance_decay_factor: 0.1,
            default_coordinates: None, // Aucune coordonnée par défaut
        }
    }
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            query_cache_size: 1000,
            cache_ttl_seconds: 300,
            enable_redis_cache: false,
            query_timeout_ms: 5000,
            max_retries: 2,
            enable_compression: true,
        }
    }
}

/// Gestionnaire de configuration avec chargement depuis TOML et variables d'environnement
pub struct ConfigManager {
    config: SearchConfig,
    cache: HashMap<String, serde_json::Value>,
}

impl ConfigManager {
    /// Créer un nouveau gestionnaire de configuration
    pub fn new() -> Self {
        Self {
            config: SearchConfig::default(),
            cache: HashMap::new(),
        }
    }

    /// Charger la configuration depuis un fichier TOML et les variables d'environnement
    pub async fn load_config(&mut self, config_path: Option<&str>) -> Result<(), String> {
        // 1. Charger depuis le fichier TOML s'il existe
        if let Some(path) = config_path {
            if Path::new(path).exists() {
                self.load_from_toml(path).await?;
                log_info(&format!("[ConfigManager] Configuration chargée depuis {}", path));
            }
        }

        // 2. Surcharger avec les variables d'environnement
        self.override_with_env_vars()?;
        log_info("[ConfigManager] Configuration enrichie avec les variables d'environnement");

        // 3. Validation finale
        self.validate_config()?;
        log_info("[ConfigManager] Configuration validée avec succès");

        Ok(())
    }

    /// Charger la configuration depuis un fichier TOML
    async fn load_from_toml(&mut self, path: &str) -> Result<(), String> {
        let content = fs::read_to_string(path)
            .await
            .map_err(|e| format!("Erreur lecture fichier TOML: {}", e))?;
        
        let config: SearchConfig = toml::from_str(&content)
            .map_err(|e| format!("Erreur parsing TOML: {}", e))?;
        
        self.config = config;
        Ok(())
    }

    /// Surcharger la configuration avec les variables d'environnement
    fn override_with_env_vars(&mut self) -> Result<(), String> {
        // Configuration générale
        if let Ok(val) = env::var("SEARCH_MAX_RESULTS") {
            self.config.general.max_results = val.parse()
                .map_err(|_| "SEARCH_MAX_RESULTS doit être un entier".to_string())?;
        }

        if let Ok(val) = env::var("SEARCH_DEFAULT_LANGUAGE") {
            self.config.general.default_language = val;
        }

        // Configuration des scores
        if let Ok(val) = env::var("SEARCH_TITLE_BOOST") {
            self.config.scoring.title_boost = val.parse()
                .map_err(|_| "SEARCH_TITLE_BOOST doit être un nombre".to_string())?;
        }

        if let Ok(val) = env::var("SEARCH_MIN_FULLTEXT_SCORE") {
            self.config.scoring.min_fulltext_score = val.parse()
                .map_err(|_| "SEARCH_MIN_FULLTEXT_SCORE doit être un nombre".to_string())?;
        }

        // Configuration géospatiale
        if let Ok(val) = env::var("SEARCH_DEFAULT_RADIUS_KM") {
            self.config.geospatial.default_search_radius_km = val.parse()
                .map_err(|_| "SEARCH_DEFAULT_RADIUS_KM doit être un nombre".to_string())?;
        }

        // Coordonnées par défaut
        if let (Ok(lat), Ok(lon)) = (env::var("SEARCH_DEFAULT_LAT"), env::var("SEARCH_DEFAULT_LON")) {
            let lat: f64 = lat.parse()
                .map_err(|_| "SEARCH_DEFAULT_LAT doit être un nombre".to_string())?;
            let lon: f64 = lon.parse()
                .map_err(|_| "SEARCH_DEFAULT_LON doit être un nombre".to_string())?;
            self.config.geospatial.default_coordinates = Some(vec![lat, lon]);
        }

        // Catégories prioritaires
        if let Ok(val) = env::var("SEARCH_PRIORITY_CATEGORIES") {
            self.config.filters.priority_categories = val
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }

        // Localisations prioritaires
        if let Ok(val) = env::var("SEARCH_PRIORITY_LOCATIONS") {
            self.config.filters.priority_locations = val
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }

        // Profil de configuration
        if let Ok(profile) = env::var("SEARCH_PROFILE") {
            self.apply_profile(&profile)?;
        }

        Ok(())
    }

    /// Appliquer un profil de configuration prédéfini
    fn apply_profile(&mut self, profile: &str) -> Result<(), String> {
        match profile.to_lowercase().as_str() {
            "production" => {
                self.config.general.max_results = 20;
                self.config.performance.enable_redis_cache = true;
                self.config.performance.query_cache_size = 5000;
                self.config.performance.cache_ttl_seconds = 600;
                self.config.scoring.min_fulltext_score = 0.1;
                log_info("[ConfigManager] Profil production appliqué");
            }
            "development" => {
                self.config.general.max_results = 50;
                self.config.performance.enable_redis_cache = false;
                self.config.performance.query_cache_size = 100;
                self.config.scoring.min_fulltext_score = 0.05;
                log_info("[ConfigManager] Profil development appliqué");
            }
            "testing" => {
                self.config.general.max_results = 10;
                self.config.performance.query_timeout_ms = 1000;
                self.config.performance.max_retries = 1;
                log_info("[ConfigManager] Profil testing appliqué");
            }
            _ => {
                log_info(&format!("[ConfigManager] Profil '{}' inconnu, utilisation des valeurs par défaut", profile));
            }
        }
        Ok(())
    }

    /// Valider la configuration
    fn validate_config(&self) -> Result<(), String> {
        if self.config.general.max_results <= 0 {
            return Err("max_results doit être positif".to_string());
        }
        if self.config.scoring.min_fulltext_score < 0.0 || self.config.scoring.min_fulltext_score > 1.0 {
            return Err("min_fulltext_score doit être entre 0.0 et 1.0".to_string());
        }
        if self.config.scoring.min_trigram_similarity < 0.0 || self.config.scoring.min_trigram_similarity > 1.0 {
            return Err("min_trigram_similarity doit être entre 0.0 et 1.0".to_string());
        }
        if self.config.geospatial.default_search_radius_km <= 0.0 {
            return Err("default_search_radius_km doit être positif".to_string());
        }
        Ok(())
    }

    /// Obtenir la configuration actuelle
    pub fn get_config(&self) -> &SearchConfig {
        &self.config
    }

    /// Mettre à jour la configuration
    pub fn update_config(&mut self, new_config: SearchConfig) -> Result<(), String> {
        self.validate_config()?;
        self.config = new_config;
        self.cache.clear();
        Ok(())
    }

    /// Sauvegarder la configuration dans un fichier TOML
    pub async fn save_to_toml(&self, path: &str) -> Result<(), String> {
        let content = toml::to_string_pretty(&self.config)
            .map_err(|e| format!("Erreur sérialisation TOML: {}", e))?;
        
        fs::write(path, content)
            .await
            .map_err(|e| format!("Erreur écriture fichier: {}", e))?;
        
        log_info(&format!("[ConfigManager] Configuration sauvegardée dans {}", path));
        Ok(())
    }

    /// Obtenir une valeur de configuration avec fallback
    pub fn get_value<T: Clone + 'static>(&self, _key: &str, default: T) -> T {
        // Ici on pourrait implémenter un système de cache plus sophistiqué
        // Pour l'instant, on retourne la valeur par défaut
        default
    }
}

/// Fonction utilitaire pour créer une configuration par défaut
pub fn create_default_config() -> SearchConfig {
    SearchConfig::default()
}

/// Fonction utilitaire pour créer une configuration de production
pub fn create_production_config() -> SearchConfig {
    let mut config = SearchConfig::default();
    config.general.max_results = 20;
    config.performance.enable_redis_cache = true;
    config.performance.query_cache_size = 5000;
    config.performance.cache_ttl_seconds = 600;
    config.scoring.min_fulltext_score = 0.1;
    config
}

/// Fonction utilitaire pour créer une configuration de développement
pub fn create_development_config() -> SearchConfig {
    let mut config = SearchConfig::default();
    config.general.max_results = 50;
    config.performance.enable_redis_cache = false;
    config.performance.query_cache_size = 100;
    config.scoring.min_fulltext_score = 0.05;
    config
} 