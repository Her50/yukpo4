use std::sync::Arc;
use tokio::sync::Mutex;

use dotenvy::dotenv;
use mongodb::Client as MongoClient;
use sqlx::PgPool;
use std::env;

use crate::config::broll_config::BrollConfig;
use crate::config::feature_flags::FeatureFlagService;
use crate::config::live_streaming::LiveStreamingConfig;
use crate::config::premium_audio::PremiumAudioConfig;
use crate::config::storage::MediaStorageConfig;
use crate::config::video_renderer::VideoRendererConfig;
use crate::controllers::ia_status_controller::IAStats;
use crate::services::app_ia::AppIA;
use crate::services::mongo_history_service::MongoHistoryService;
use crate::websocket::delivery_tracking::DeliveryTrackingManager;
// Imports d'optimisation
use crate::services::cache_service::CacheService; // ✅ Phase 10 - Service de cache générique
use crate::services::commerce_connector_service::CommerceConnectorService;
use crate::services::geocoding_service::GeocodingService; // ✅ Phase 10 - Pour matching géographique
use crate::services::inventory_service::InventoryService;
use crate::services::media_storage_service::MediaStorageService;
use crate::services::prompt_optimizer_pro::PromptOptimizerPro;
use crate::services::semantic_cache_pro::SemanticCachePro;
use crate::services::story_template_service::StoryTemplateService;
use crate::services::studio_service::StudioService;
use crate::services::video_job_service::VideoGenerationJobService;
use crate::services::video_renderer::VideoRenderDispatcher;
use crate::services::voice_profile_service::VoiceProfileService;

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
    pub media_storage: Arc<MediaStorageService>,
    pub video_renderer: Option<Arc<VideoRenderDispatcher>>,
    pub audio_mastering:
        Option<Arc<crate::services::audio_mastering_service::AudioMasteringService>>,
    pub cost_service: Arc<crate::services::cost_service::CostEstimator>,
    pub broll_service: Option<Arc<crate::services::broll_service::BrollService>>,
    pub video_jobs: Arc<VideoGenerationJobService>,
    pub voice_profiles: Arc<VoiceProfileService>,
    pub commerce_connector: Arc<CommerceConnectorService>,
    pub story_templates: Arc<StoryTemplateService>,
    pub studio_service: Arc<StudioService>,
    pub inventory: Arc<InventoryService>,
    /// Service centralisé de feature flags (GPU, connecteurs, etc.).
    pub feature_flags: Arc<FeatureFlagService>,
    /// ✅ Phase 10 - Service de cache générique pour Redis
    pub cache_service: Arc<CacheService>,
    /// ✅ Phase 10 - Service de matching géographique pour optimiser les calculs de distance
    pub geographic_matching: Option<Arc<crate::services::geographic_matching_service::GeographicMatchingService>>,
}

impl AppState {
    /// ? Constructeur explicite pour AppState
    pub fn new(
        pg: PgPool,
        mongo: MongoClient,
        ia: Arc<AppIA>,
        ia_stats: Arc<Mutex<IAStats>>,
        redis_client: redis::Client,
        redis_available_for_ws: bool,
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
        let delivery_ws_manager = Arc::new(DeliveryTrackingManager::new(
            64,
            if redis_available_for_ws {
                Some(redis_client.clone())
            } else {
                None
            },
        ));
        
        // ✅ Phase 10 - Initialiser le cache service d'abord
        let cache_service = Arc::new(CacheService::new(Some(redis_client.clone())));
        
        // ✅ Phase 10 - Initialiser le service de matching géographique
        let geocoding_service = GeocodingService::with_cache(Some(redis_client.clone()));
        let geographic_matching_service = Arc::new(
            crate::services::geographic_matching_service::GeographicMatchingService::new(
                pg.clone(),
                cache_service.clone(),
                geocoding_service,
            ),
        );
        
        let delivery_service = Arc::new(
            crate::services::delivery_service::DeliveryService::with_geographic_matching(
                delivery_repo.clone(),
                delivery_ws_manager.clone(),
                geographic_matching_service.clone(),
            ),
        );

        let renderer_config = VideoRendererConfig::from_env();
        let storage_config = MediaStorageConfig::from_env();
        let media_storage = Arc::new(MediaStorageService::new(storage_config.clone()));

        let remotion_renderer = renderer_config.as_ref().and_then(|cfg| {
            match crate::services::remotion_renderer_service::RemotionRendererService::new(
                cfg.clone(),
            ) {
                Ok(service) => Some(Arc::new(service)),
                Err(err) => {
                    log::warn!("[AppState] Remotion renderer inactif: {err:?}");
                    None
                }
            }
        });

        let video_renderer = renderer_config.as_ref().and_then(|cfg| {
            VideoRenderDispatcher::from_state_config(cfg.clone(), remotion_renderer.clone())
                .map(Arc::new)
        });

        let audio_mastering = match PremiumAudioConfig::from_env() {
            Some(cfg) => {
                match crate::services::audio_mastering_service::AudioMasteringService::new(
                    cfg,
                    pg.clone(),
                    media_storage.clone(),
                ) {
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
        let voice_profiles = Arc::new(VoiceProfileService::new(pg.clone(), media_storage.clone()));
        let commerce_connector = Arc::new(CommerceConnectorService::new(pg.clone()));
        let story_templates = Arc::new(StoryTemplateService::new());
        let inventory = Arc::new(InventoryService::new(pg.clone()));
        let studio_service = Arc::new(StudioService::new(
            pg.clone(),
            media_storage.clone(),
            video_renderer.clone(),
        ));

        let feature_flags = Arc::new(FeatureFlagService::from_env());
        let cache_service = Arc::new(CacheService::new(Some(redis_client.clone())));

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
            live_streaming: {
                let config = LiveStreamingConfig::from_env();
                if let Err(e) = config.validate() {
                    log::warn!("⚠️ LiveKit: Configuration incohérente - {}", e);
                    log::info!("ℹ️ LiveKit sera désactivé. Pour l'activer, configurez toutes les variables: LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET");
                } else if config.is_livekit_enabled() {
                    log::info!("✅ LiveKit configuré et activé");
                } else {
                    log::debug!("ℹ️ LiveKit non configuré (service optionnel)");
                }
                Arc::new(config)
            },
            delivery_ws_manager,
            delivery_service,
            remotion_renderer,
            media_storage,
            video_renderer,
            audio_mastering,
            cost_service,
            broll_service,
            video_jobs,
            voice_profiles,
            commerce_connector,
            story_templates: story_templates.clone(),
            studio_service,
            inventory,
            feature_flags,
            cache_service,
            geographic_matching: Some(geographic_matching_service),
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
        // Pour les tests, on essaie d'utiliser Redis si disponible, sinon None
        let redis_available_for_ws = redis_client.get_multiplexed_async_connection().await.is_ok();
        let delivery_ws_manager = Arc::new(DeliveryTrackingManager::new(
            16,
            if redis_available_for_ws {
                Some(redis_client.clone())
            } else {
                None
            },
        ));
        let delivery_service = Arc::new(crate::services::delivery_service::DeliveryService::new(
            delivery_repo.clone(),
            delivery_ws_manager.clone(),
        ));

        let cost_pg = pg.clone();
        let video_pg = pg.clone();

        let media_storage = Arc::new(MediaStorageService::new(MediaStorageConfig::from_env()));
        let voice_profiles = Arc::new(VoiceProfileService::new(pg.clone(), media_storage.clone()));
        let commerce_connector = Arc::new(CommerceConnectorService::new(pg.clone()));
        let story_templates = Arc::new(StoryTemplateService::new());
        let inventory = Arc::new(InventoryService::new(pg.clone()));
        let studio_service = Arc::new(StudioService::new(pg.clone(), media_storage.clone(), None));
        let feature_flags = Arc::new(FeatureFlagService::from_env());
        let cache_service = Arc::new(CacheService::new(Some(redis_client.clone())));
        
        // ✅ Phase 10 - Initialiser le service de matching géographique pour les tests
        let geocoding_service = GeocodingService::with_cache(Some(redis_client.clone()));
        let geographic_matching_service = Arc::new(
            crate::services::geographic_matching_service::GeographicMatchingService::new(
                pg.clone(),
                cache_service.clone(),
                geocoding_service,
            ),
        );

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
            live_streaming: {
                let config = LiveStreamingConfig::from_env();
                // Validation silencieuse pour les tests
                if let Err(_) = config.validate() {
                    // Pas de log en mode test
                }
                Arc::new(config)
            },
            delivery_ws_manager,
            delivery_service,
            remotion_renderer: None,
            media_storage,
            video_renderer: None,
            audio_mastering: None,
            cost_service: Arc::new(crate::services::cost_service::CostEstimator::new(cost_pg)),
            broll_service: None,
            video_jobs: Arc::new(VideoGenerationJobService::new(video_pg)),
            voice_profiles,
            commerce_connector,
            story_templates,
            studio_service,
            inventory,
            feature_flags,
            cache_service,
            geographic_matching: Some(geographic_matching_service),
        }
    }
}

/// Alias pratique pour l'?tat partag?
pub type SharedState = Arc<AppState>;
pub type AppStateShared = Arc<AppState>;
