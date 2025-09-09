use std::sync::Arc;
use tokio::sync::Mutex;

use sqlx::PgPool;
use mongodb::Client as MongoClient;
use dotenvy::dotenv;
use std::env;

use crate::controllers::ia_status_controller::IAStats;
use crate::services::app_ia::AppIA;
use crate::services::mongo_history_service::MongoHistoryService;

// ✨ NOUVELLES IMPORTATIONS - Optimisations Professionnelles
use crate::services::semantic_cache_pro::{SemanticCachePro, SemanticCacheFactory};
use crate::services::prompt_optimizer_pro::PromptOptimizerPro;

/// 🌐 État partagé global de l'application
#[derive(Clone)]
pub struct AppState {
    /// Connexion PostgreSQL
    pub pg: PgPool,

    /// Connexion MongoDB
    pub mongo: MongoClient,

    /// Service d'historisation MongoDB
    pub mongo_history: Arc<MongoHistoryService>,

    /// Moteur IA (prédictions, fallback, cache)
    pub ia: Arc<AppIA>,

    /// Statistiques sur l'utilisation des moteurs IA
    pub ia_stats: Arc<Mutex<IAStats>>,

    /// Chaîne de connexion à la base de données
    pub database_url: String,

    // ✨ NOUVEAUX SERVICES - Optimisations Professionnelles ✨
    /// Cache sémantique intelligent (style Copilot)
    pub semantic_cache: Arc<SemanticCachePro>,
    
    /// Optimiseur de prompts professionnel (style Cursor)  
    pub prompt_optimizer: Arc<PromptOptimizerPro>,

    /// Flag d'activation des optimisations (pour rollback facile)
    pub optimizations_enabled: bool,
}

impl AppState {
    /// ✅ Constructeur explicite pour AppState avec optimisations
    pub async fn new(pg: PgPool, mongo: MongoClient, ia: Arc<AppIA>, ia_stats: Arc<Mutex<IAStats>>) -> Result<Self, Box<dyn std::error::Error>> {
        dotenv().ok(); // Charge les variables d'environnement depuis .env
        let database_url = env::var("DATABASE_URL").expect("DATABASE_URL doit être défini dans .env");
        
        // Initialiser le service d'historisation MongoDB
        let mongo_history = Arc::new(MongoHistoryService::new(
            Arc::new(mongo.clone()),
            "yukpo_history".to_string(),
        ));

        // ✨ INITIALISER LES NOUVEAUX SERVICES D'OPTIMISATION ✨
        
        // 1. Cache sémantique professionnel
        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
        let redis_client = redis::Client::open(redis_url)?;
        
        let semantic_cache = Arc::new(
            if env::var("RUST_ENV").unwrap_or_default() == "production" {
                SemanticCacheFactory::create_production_cache(redis_client)
            } else {
                SemanticCacheFactory::create_development_cache(redis_client)
            }
        );

        // 2. Optimiseur de prompts professionnel
        let prompt_optimizer = Arc::new(PromptOptimizerPro::new());

        // 3. Flag d'activation (peut être désactivé via env var)
        let optimizations_enabled = env::var("ENABLE_AI_OPTIMIZATIONS")
            .unwrap_or_else(|_| "true".to_string()) == "true";

        log::info!("[AppState] Optimisations IA {} (cache sémantique + prompt optimizer)", 
            if optimizations_enabled { "ACTIVÉES" } else { "DÉSACTIVÉES" });

        Ok(AppState {
            pg,
            mongo,
            mongo_history,
            ia,
            ia_stats,
            database_url,
            // Nouveaux services
            semantic_cache,
            prompt_optimizer,
            optimizations_enabled,
        })
    }

    /// Public async mock constructor for integration tests
    pub async fn mock_for_tests() -> Self {
        use crate::services::app_ia::AppIA;
        use crate::controllers::ia_status_controller::IAStats;
        use mongodb::Client as MongoClient;
        use sqlx::postgres::PgPoolOptions;
        use std::sync::Arc;
        use tokio::sync::Mutex;
        use dotenvy::dotenv;
        use std::env;
        use redis::Client as RedisClient;

        dotenv().ok();
        let database_url = env::var("TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres:Hernandez87@localhost/yukpomnang_test".to_string());
        let pg = PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await
            .expect("Failed to connect to test Postgres");
        let mongo_url = env::var("MONGODB_URL").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
        let mongo = MongoClient::with_uri_str(&mongo_url).await.expect("Failed to connect to test MongoDB");
        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
        let redis_client = RedisClient::open(redis_url).expect("Failed to create test Redis client");
        let ia_stats = Arc::new(Mutex::new(IAStats::default()));
        let app_ia = Arc::new(AppIA::new(redis_client.clone(), ia_stats.clone()));
        
        // Initialiser le service d'historisation MongoDB pour les tests
        let mongo_history = Arc::new(MongoHistoryService::new(
            Arc::new(mongo.clone()),
            "yukpo_history_test".to_string(),
        ));

        // ✨ Services d'optimisation pour tests
        let semantic_cache = Arc::new(SemanticCacheFactory::create_development_cache(redis_client));
        let prompt_optimizer = Arc::new(PromptOptimizerPro::new());
        
        AppState {
            pg,
            mongo,
            mongo_history,
            ia: app_ia,
            ia_stats,
            database_url,
            semantic_cache,
            prompt_optimizer,
            optimizations_enabled: true, // Activé pour tests
        }
    }

    /// ✨ Méthode utilitaire pour vérifier si les optimisations sont actives
    pub fn are_optimizations_enabled(&self) -> bool {
        self.optimizations_enabled
    }

    /// ✨ Méthode pour obtenir les métriques du cache
    pub async fn get_cache_metrics(&self) -> serde_json::Value {
        if !self.optimizations_enabled {
            return serde_json::json!({"status": "disabled"});
        }

        let metrics = self.semantic_cache.get_performance_metrics().await;
        let efficiency = self.semantic_cache.get_cache_efficiency().await;
        
        serde_json::json!({
            "cache_efficiency": efficiency,
            "total_requests": metrics.total_requests,
            "cache_hits": metrics.cache_hits,
            "semantic_hits": metrics.semantic_hits,
            "avg_similarity_threshold": metrics.avg_similarity_threshold,
            "precompute_success": metrics.precompute_success
        })
    }
}

/// Alias pratique pour l'état partagé
pub type SharedState = Arc<AppState>; 