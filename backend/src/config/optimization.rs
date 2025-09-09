use std::time::Duration;
use serde::{Deserialize, Serialize};

/// Configuration des optimisations de performance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationConfig {
    /// Configuration du cache Redis
    pub cache: CacheConfig,
    /// Configuration de la base de donn?es
    pub database: DatabaseConfig,
    /// Configuration du matching d'?changes
    pub matching: MatchingConfig,
    /// Configuration des requ?tes API
    pub api: ApiConfig,
    /// Configuration des t?ches en arri?re-plan
    pub background: BackgroundConfig,
}

/// Configuration du cache Redis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    /// TTL par d?faut en secondes
    pub default_ttl: u64,
    /// TTL pour les services en secondes
    pub services_ttl: u64,
    /// TTL pour les utilisateurs en secondes
    pub users_ttl: u64,
    /// TTL pour les ?changes en secondes
    pub exchanges_ttl: u64,
    /// Taille maximale du cache en m?moire
    pub max_memory_size: usize,
    /// Nombre maximum d'entr?es en cache
    pub max_entries: usize,
}

/// Configuration de la base de donn?es
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    /// Taille du pool de connexions
    pub pool_size: u32,
    /// Timeout de connexion
    pub connect_timeout: Duration,
    /// Timeout d'acquittement
    pub acquire_timeout: Duration,
    /// Timeout d'idle
    pub idle_timeout: Duration,
    /// Taille maximale des requ?tes
    pub max_query_size: usize,
    /// Activer les requ?tes pr?par?es
    pub enable_prepared_statements: bool,
    /// Activer le monitoring des requ?tes lentes
    pub enable_slow_query_log: bool,
    /// Seuil pour les requ?tes lentes en millisecondes
    pub slow_query_threshold: u64,
}

/// Configuration du matching d'?changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingConfig {
    /// Seuil de score minimum pour un match
    pub min_score_threshold: f64,
    /// Seuil de score pour arr?t anticip?
    pub early_stop_threshold: f64,
    /// Taille du batch pour le traitement
    pub batch_size: usize,
    /// Limite maximale de candidats ? traiter
    pub max_candidates: usize,
    /// D?lai de protection contre les doublons en secondes
    pub duplicate_protection_delay: u64,
    /// Activer le cache de r?putation
    pub enable_reputation_cache: bool,
    /// TTL du cache de r?putation en secondes
    pub reputation_cache_ttl: u64,
}

/// Configuration des requ?tes API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    /// Limite de rate limiting par minute
    pub rate_limit_per_minute: u32,
    /// Limite de taille de payload en bytes
    pub max_payload_size: usize,
    /// Timeout de requ?te en secondes
    pub request_timeout: Duration,
    /// Activer la compression
    pub enable_compression: bool,
    /// Activer le cache des r?ponses
    pub enable_response_cache: bool,
    /// TTL du cache de r?ponse en secondes
    pub response_cache_ttl: u64,
}

/// Configuration des t?ches en arri?re-plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundConfig {
    /// Intervalle de nettoyage du cache en secondes
    pub cache_cleanup_interval: u64,
    /// Intervalle de d?sactivation des services en secondes
    pub service_deactivation_interval: u64,
    /// Intervalle de mise ? jour des scores en secondes
    pub score_update_interval: u64,
    /// Nombre de workers pour les t?ches
    pub worker_count: usize,
    /// Taille de la queue des t?ches
    pub task_queue_size: usize,
}

impl Default for OptimizationConfig {
    fn default() -> Self {
        Self {
            cache: CacheConfig::default(),
            database: DatabaseConfig::default(),
            matching: MatchingConfig::default(),
            api: ApiConfig::default(),
            background: BackgroundConfig::default(),
        }
    }
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            default_ttl: 300, // 5 minutes
            services_ttl: 600, // 10 minutes
            users_ttl: 1800,   // 30 minutes
            exchanges_ttl: 300, // 5 minutes
            max_memory_size: 100 * 1024 * 1024, // 100MB
            max_entries: 10000,
        }
    }
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            pool_size: 10,
            connect_timeout: Duration::from_secs(30),
            acquire_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(600),
            max_query_size: 1024 * 1024, // 1MB
            enable_prepared_statements: true,
            enable_slow_query_log: true,
            slow_query_threshold: 1000, // 1 seconde
        }
    }
}

impl Default for MatchingConfig {
    fn default() -> Self {
        let min_score_threshold = std::env::var("MATCHING_MIN_SCORE_THRESHOLD")
            .unwrap_or_else(|_| "0.70".to_string())
            .parse::<f64>()
            .unwrap_or(0.70);
            
        Self {
            min_score_threshold, // Seuil configurable via variable d'environnement
            early_stop_threshold: 0.9,
            batch_size: 50,
            max_candidates: 1000,
            duplicate_protection_delay: 600, // 10 minutes
            enable_reputation_cache: true,
            reputation_cache_ttl: 3600, // 1 heure
        }
    }
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            rate_limit_per_minute: 100,
            max_payload_size: 500 * 1024 * 1024, // 500MB (augment? de 200MB)
            request_timeout: Duration::from_secs(30),
            enable_compression: true,
            enable_response_cache: true,
            response_cache_ttl: 300, // 5 minutes
        }
    }
}

impl Default for BackgroundConfig {
    fn default() -> Self {
        Self {
            cache_cleanup_interval: 300, // 5 minutes
            service_deactivation_interval: 3600, // 1 heure
            score_update_interval: 1800, // 30 minutes
            worker_count: 4,
            task_queue_size: 1000,
        }
    }
}

/// Gestionnaire de configuration d'optimisation
pub struct OptimizationManager {
    config: OptimizationConfig,
}

impl OptimizationManager {
    pub fn new(config: OptimizationConfig) -> Self {
        Self { config }
    }

    pub fn from_env() -> Self {
        let config = OptimizationConfig {
            cache: CacheConfig {
                default_ttl: std::env::var("CACHE_DEFAULT_TTL")
                    .unwrap_or_else(|_| "300".to_string())
                    .parse()
                    .unwrap_or(300),
                services_ttl: std::env::var("CACHE_SERVICES_TTL")
                    .unwrap_or_else(|_| "600".to_string())
                    .parse()
                    .unwrap_or(600),
                users_ttl: std::env::var("CACHE_USERS_TTL")
                    .unwrap_or_else(|_| "1800".to_string())
                    .parse()
                    .unwrap_or(1800),
                exchanges_ttl: std::env::var("CACHE_EXCHANGES_TTL")
                    .unwrap_or_else(|_| "300".to_string())
                    .parse()
                    .unwrap_or(300),
                max_memory_size: std::env::var("CACHE_MAX_MEMORY_SIZE")
                    .unwrap_or_else(|_| "104857600".to_string()) // 100MB
                    .parse()
                    .unwrap_or(100 * 1024 * 1024),
                max_entries: std::env::var("CACHE_MAX_ENTRIES")
                    .unwrap_or_else(|_| "10000".to_string())
                    .parse()
                    .unwrap_or(10000),
            },
            database: DatabaseConfig {
                pool_size: std::env::var("DB_POOL_SIZE")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()
                    .unwrap_or(10),
                connect_timeout: Duration::from_secs(
                    std::env::var("DB_CONNECT_TIMEOUT")
                        .unwrap_or_else(|_| "30".to_string())
                        .parse()
                        .unwrap_or(30)
                ),
                acquire_timeout: Duration::from_secs(
                    std::env::var("DB_ACQUIRE_TIMEOUT")
                        .unwrap_or_else(|_| "30".to_string())
                        .parse()
                        .unwrap_or(30)
                ),
                idle_timeout: Duration::from_secs(
                    std::env::var("DB_IDLE_TIMEOUT")
                        .unwrap_or_else(|_| "600".to_string())
                        .parse()
                        .unwrap_or(600)
                ),
                max_query_size: std::env::var("DB_MAX_QUERY_SIZE")
                    .unwrap_or_else(|_| "1048576".to_string()) // 1MB
                    .parse()
                    .unwrap_or(1024 * 1024),
                enable_prepared_statements: std::env::var("DB_ENABLE_PREPARED_STATEMENTS")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .unwrap_or(true),
                enable_slow_query_log: std::env::var("DB_ENABLE_SLOW_QUERY_LOG")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .unwrap_or(true),
                slow_query_threshold: std::env::var("DB_SLOW_QUERY_THRESHOLD")
                    .unwrap_or_else(|_| "1000".to_string())
                    .parse()
                    .unwrap_or(1000),
            },
            matching: MatchingConfig {
                min_score_threshold: std::env::var("MATCHING_MIN_SCORE_THRESHOLD")
                    .unwrap_or_else(|_| "0.70".to_string())
                    .parse()
                    .unwrap_or(0.70),
                early_stop_threshold: std::env::var("MATCHING_EARLY_STOP_THRESHOLD")
                    .unwrap_or_else(|_| "0.9".to_string())
                    .parse()
                    .unwrap_or(0.9),
                batch_size: std::env::var("MATCHING_BATCH_SIZE")
                    .unwrap_or_else(|_| "50".to_string())
                    .parse()
                    .unwrap_or(50),
                max_candidates: std::env::var("MATCHING_MAX_CANDIDATES")
                    .unwrap_or_else(|_| "1000".to_string())
                    .parse()
                    .unwrap_or(1000),
                duplicate_protection_delay: std::env::var("MATCHING_DUPLICATE_PROTECTION_DELAY")
                    .unwrap_or_else(|_| "600".to_string())
                    .parse()
                    .unwrap_or(600),
                enable_reputation_cache: std::env::var("MATCHING_ENABLE_REPUTATION_CACHE")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .unwrap_or(true),
                reputation_cache_ttl: std::env::var("MATCHING_REPUTATION_CACHE_TTL")
                    .unwrap_or_else(|_| "3600".to_string())
                    .parse()
                    .unwrap_or(3600),
            },
            api: ApiConfig {
                rate_limit_per_minute: std::env::var("API_RATE_LIMIT_PER_MINUTE")
                    .unwrap_or_else(|_| "100".to_string())
                    .parse()
                    .unwrap_or(100),
                max_payload_size: std::env::var("API_MAX_PAYLOAD_SIZE")
                    .unwrap_or_else(|_| "209715200".to_string()) // 200MB
                    .parse()
                    .unwrap_or(200 * 1024 * 1024),
                request_timeout: Duration::from_secs(
                    std::env::var("API_REQUEST_TIMEOUT")
                        .unwrap_or_else(|_| "30".to_string())
                        .parse()
                        .unwrap_or(30)
                ),
                enable_compression: std::env::var("API_ENABLE_COMPRESSION")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .unwrap_or(true),
                enable_response_cache: std::env::var("API_ENABLE_RESPONSE_CACHE")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .unwrap_or(true),
                response_cache_ttl: std::env::var("API_RESPONSE_CACHE_TTL")
                    .unwrap_or_else(|_| "300".to_string())
                    .parse()
                    .unwrap_or(300),
            },
            background: BackgroundConfig {
                cache_cleanup_interval: std::env::var("BACKGROUND_CACHE_CLEANUP_INTERVAL")
                    .unwrap_or_else(|_| "300".to_string())
                    .parse()
                    .unwrap_or(300),
                service_deactivation_interval: std::env::var("BACKGROUND_SERVICE_DEACTIVATION_INTERVAL")
                    .unwrap_or_else(|_| "3600".to_string())
                    .parse()
                    .unwrap_or(3600),
                score_update_interval: std::env::var("BACKGROUND_SCORE_UPDATE_INTERVAL")
                    .unwrap_or_else(|_| "1800".to_string())
                    .parse()
                    .unwrap_or(1800),
                worker_count: std::env::var("BACKGROUND_WORKER_COUNT")
                    .unwrap_or_else(|_| "4".to_string())
                    .parse()
                    .unwrap_or(4),
                task_queue_size: std::env::var("BACKGROUND_TASK_QUEUE_SIZE")
                    .unwrap_or_else(|_| "1000".to_string())
                    .parse()
                    .unwrap_or(1000),
            },
        };

        Self::new(config)
    }

    pub fn config(&self) -> &OptimizationConfig {
        &self.config
    }

    pub fn config_mut(&mut self) -> &mut OptimizationConfig {
        &mut self.config
    }
} 
