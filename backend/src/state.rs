use std::sync::Arc;
use tokio::sync::Mutex;

use dotenvy::dotenv;
use mongodb::Client as MongoClient;
use sqlx::PgPool;
use std::env;

use crate::config::broll_config::BrollConfig;
use crate::config::live_streaming::LiveStreamingConfig;
use crate::config::premium_audio::PremiumAudioConfig;
use crate::config::video_renderer::VideoRendererConfig;
use crate::controllers::ia_status_controller::IAStats;
use crate::services::app_ia::AppIA;
use crate::services::mongo_history_service::MongoHistoryService;
use crate::websocket::delivery_tracking::DeliveryTrackingManager;
// Imports d'optimisation
use crate::services::prompt_optimizer_pro::PromptOptimizerPro;
use crate::services::semantic_cache_pro::SemanticCachePro;
use crate::services::video_job_service::VideoGenerationJobService;

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
    /// Configuration live streaming (LiveKit + SRS)
    pub live_streaming: Arc<LiveStreamingConfig>,
    pub delivery_ws_manager: Arc<DeliveryTrackingManager>,
    pub delivery_service: Arc<crate::services::delivery_service::DeliveryService>,
    pub remotion_renderer:
        Option<Arc<crate::services::remotion_renderer_service::RemotionRendererService>>,
    pub audio_mastering:
        Option<Arc<crate::services::audio_mastering_service::AudioMasteringService>>,
    pub cost_service: Arc<crate::services::cost_service::CostEstimator>,
    pub broll_service: Option<Arc<crate::services::broll_service::BrollService>>,
    pub video_jobs: Arc<VideoGenerationJobService>,
}

impl AppState {
    /// ? Constructeur explicite pour AppState
    pub fn new(
        pg: PgPool,
        mongo: MongoClient,
        ia: Arc<AppIA>,
        ia_stats: Arc<Mutex<IAStats>>,
        redis_client: redis::Client,
    ) -> Self {
        dotenv().ok(); // Charge les variables d'environnement depuis .env
        let database_url =
            env::var("DATABASE_URL").expect("DATABASE_URL doit ?tre d?fini dans .env");

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

        let delivery_repo =
            Arc::new(crate::services::delivery_repository::DeliveryRepository::new(pg.clone()));
        let delivery_ws_manager = Arc::new(DeliveryTrackingManager::new(64));
        let delivery_service = Arc::new(crate::services::delivery_service::DeliveryService::new(
            delivery_repo.clone(),
            delivery_ws_manager.clone(),
        ));

        let remotion_renderer = match VideoRendererConfig::from_env() {
            Some(cfg) => {
                match crate::services::remotion_renderer_service::RemotionRendererService::new(cfg)
                {
                    Ok(service) => Some(Arc::new(service)),
                    Err(err) => {
                        log::warn!("[AppState] Remotion renderer inactif: {err:?}");
                        None
                    }
                }
            }
            None => None,
        };

        let audio_mastering = match PremiumAudioConfig::from_env() {
            Some(cfg) => {
                match crate::services::audio_mastering_service::AudioMasteringService::new(cfg) {
                    Ok(service) => Some(Arc::new(service)),
                    Err(err) => {
                        log::warn!("[AppState] Audio mastering premium désactivé: {err:?}");
                        None
                    }
                }
            }
            None => None,
        };

        let broll_config = BrollConfig::from_env();
        let broll_service = Some(Arc::new(crate::services::broll_service::BrollService::new(
            redis_client.clone(),
            broll_config,
        )));

        let cost_service = Arc::new(crate::services::cost_service::CostEstimator::new(
            pg.clone(),
        ));

        let video_jobs = Arc::new(VideoGenerationJobService::new(pg.clone()));

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
            live_streaming: Arc::new(LiveStreamingConfig::from_env()),
            delivery_ws_manager,
            delivery_service,
            remotion_renderer,
            audio_mastering,
            cost_service,
            broll_service,
            video_jobs,
        }
    }

    /// Public async mock constructor for integration tests
    pub async fn mock_for_tests() -> Self {
        use crate::controllers::ia_status_controller::IAStats;
        use crate::services::app_ia::AppIA;
        use dotenvy::dotenv;
        use mongodb::Client as MongoClient;
        use redis::Client as RedisClient;
        use sqlx::postgres::PgPoolOptions;
        use std::env;
        use std::sync::Arc;
        use tokio::sync::Mutex;

        dotenv().ok();
        let database_url = env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            "postgres://postgres:Hernandez87@localhost/yukpomnang_test".to_string()
        });
        let pg = PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await
            .expect("Failed to connect to test Postgres");
        let mongo_url =
            env::var("MONGODB_URL").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
        let mongo = MongoClient::with_uri_str(&mongo_url)
            .await
            .expect("Failed to connect to test MongoDB");
        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
        let redis_client =
            RedisClient::open(redis_url).expect("Failed to create test Redis client");
        let ia_stats = Arc::new(Mutex::new(IAStats::default()));
        let app_ia = Arc::new(AppIA::new(
            redis_client.clone(),
            ia_stats.clone(),
            pg.clone(),
        ));

        // Initialiser le service d'historisation MongoDB pour les tests
        let mongo_history = Arc::new(MongoHistoryService::new(
            Arc::new(mongo.clone()),
            "yukpo_history_test".to_string(),
        ));

        let delivery_repo =
            Arc::new(crate::services::delivery_repository::DeliveryRepository::new(pg.clone()));
        let delivery_ws_manager = Arc::new(DeliveryTrackingManager::new(16));
        let delivery_service = Arc::new(crate::services::delivery_service::DeliveryService::new(
            delivery_repo.clone(),
            delivery_ws_manager.clone(),
        ));

        let cost_pg = pg.clone();
        let video_pg = pg.clone();

        AppState {
            pg,
            mongo,
            mongo_history,
            ia: app_ia,
            ia_stats,
            database_url,
            optimizations_enabled: false, // Désactivé pour les tests
            redis_client,
            semantic_cache: None,
            prompt_optimizer: None,
            live_streaming: Arc::new(LiveStreamingConfig::from_env()),
            delivery_ws_manager,
            delivery_service,
            remotion_renderer: None,
            audio_mastering: None,
            cost_service: Arc::new(crate::services::cost_service::CostEstimator::new(cost_pg)),
            broll_service: None,
            video_jobs: Arc::new(VideoGenerationJobService::new(video_pg)),
        }
    }
}

/// Alias pratique pour l'?tat partag?
pub type SharedState = Arc<AppState>;
pub type AppStateShared = Arc<AppState>;
