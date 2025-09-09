use std::sync::Arc;
use tokio::sync::Mutex;

use sqlx::PgPool;
use mongodb::Client as MongoClient;
use dotenvy::dotenv;
use std::env;

use crate::controllers::ia_status_controller::IAStats;
use crate::services::app_ia::AppIA;
use crate::services::mongo_history_service::MongoHistoryService;
// Imports d'optimisation
use crate::services::semantic_cache_pro::SemanticCachePro;
use crate::services::prompt_optimizer_pro::PromptOptimizerPro;

/// ?? ?tat partag? global de l'application
#[derive(Clone)]
pub struct AppState {
    /// Connexion PostgreSQL
    pub pg: PgPool,
    /// Connexion MongoDB
    pub mongo: MongoClient,
    /// Service d'historisation MongoDB
    pub mongo_history: Arc<MongoHistoryService>,
    /// Moteur IA (pr?dictions, fallback, cache)
    pub ia: Arc<AppIA>,
    /// Statistiques sur l'utilisation des moteurs IA
    pub ia_stats: Arc<Mutex<IAStats>>,
    /// Flag pour activer/d?sactiver les optimisations IA
    pub optimizations_enabled: bool,
    /// Cha?ne de connexion ? la base de donn?es
    pub database_url: String,
    /// Client Redis partag?
    pub redis_client: redis::Client,
    /// Cache s?mantique pour optimiser les requ?tes IA
    pub semantic_cache: Option<Arc<SemanticCachePro>>,
    /// Optimiseur de prompts pour am?liorer les performances IA
    pub prompt_optimizer: Option<Arc<PromptOptimizerPro>>,
}

impl AppState {
    /// ? Constructeur explicite pour AppState
    pub fn new(pg: PgPool, mongo: MongoClient, ia: Arc<AppIA>, ia_stats: Arc<Mutex<IAStats>>, redis_client: redis::Client) -> Self {
        dotenv().ok(); // Charge les variables d'environnement depuis .env
        let database_url = env::var("DATABASE_URL").expect("DATABASE_URL doit ?tre d?fini dans .env");
        
        // Initialiser le service d'historisation MongoDB
        let mongo_history = Arc::new(MongoHistoryService::new(
            Arc::new(mongo.clone()),
            "yukpo_history".to_string(),
        ));

        // V?rifier si les optimisations IA sont activ?es
        let optimizations_enabled = env::var("ENABLE_AI_OPTIMIZATIONS")
            .unwrap_or_else(|_| "false".to_string())
            .parse::<bool>()
            .unwrap_or(false);

        AppState {
            pg,
            mongo,
            mongo_history,
            ia,
            ia_stats,
            database_url,
            optimizations_enabled,
            redis_client,
            semantic_cache: None,
            prompt_optimizer: None,
        }
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
        let app_ia = Arc::new(AppIA::new(redis_client.clone(), ia_stats.clone(), pg.clone()));
        
        // Initialiser le service d'historisation MongoDB pour les tests
        let mongo_history = Arc::new(MongoHistoryService::new(
            Arc::new(mongo.clone()),
            "yukpo_history_test".to_string(),
        ));
        
        AppState {
            pg,
            mongo,
            mongo_history,
            ia: app_ia,
            ia_stats,
            database_url,
            optimizations_enabled: false, // D?sactiv? pour les tests
            redis_client,
            semantic_cache: None,
            prompt_optimizer: None,
        }
    }
}

/// Alias pratique pour l'?tat partag?
pub type SharedState = Arc<AppState>;
pub type AppStateShared = Arc<AppState>;
