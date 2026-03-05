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
use crate::services::gpu_service::{GpuConfig, GpuService};
use crate::services::mongo_history_service::MongoHistoryService;
use crate::services::redis_scaling_service::{RedisScalingConfig, RedisScalingService};
use crate::websocket::delivery_tracking::DeliveryTrackingManager;
// Imports d'optimisation
use crate::services::cache_service::CacheService; // ✅ Phase 10 - Service de cache générique
use crate::services::commerce_connector_service::CommerceConnectorService;
use crate::services::geocoding_service::GeocodingService; // ✅ Phase 10 - Pour matching géographique
use crate::services::inventory_service::InventoryService;
use crate::services::media_storage_service::MediaStorageService;
use crate::services::prompt_optimizer_pro::PromptOptimizerPro;
use crate::services::semantic_cache_pro::SemanticCachePro;
use crate::services::spotify_integration_service::SpotifyIntegrationService;
use crate::services::story_template_service::StoryTemplateService;
use crate::services::studio_service::StudioService;
use crate::services::video_job_service::VideoGenerationJobService;
use crate::services::video_renderer::VideoRenderDispatcher;
use crate::services::voice_profile_service::VoiceProfileService;
use crate::services::youtube_audio_service::YouTubeAudioService;

/// ?? ?tat partag? global de l'application
#[derive(Clone)]
pub struct AppState {
    /// Connexion PostgreSQL (master pour écritures)
    pub pg: PgPool,
    /// ✅ NOUVEAU 2025-12-02: Connexion PostgreSQL read replica (pour lectures/scaling horizontal)
    pub pg_read: Option<PgPool>,
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
    /// Client Redis partag? (support cluster)
    pub redis_client: redis::Client,
    /// ✅ NOUVEAU 2025-12-01: Pool Redis pour réutiliser les connexions (performance)
    pub redis_pool: Option<Arc<deadpool_redis::Pool>>,
    /// ✅ NOUVEAU 2025-12-02: Support Redis cluster (URLs multiples)
    pub redis_cluster_nodes: Vec<String>,
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
    pub geographic_matching:
        Option<Arc<crate::services::geographic_matching_service::GeographicMatchingService>>,
    /// ✅ NOUVEAU 2025-12-01: Service de métriques de recherche (singleton)
    pub search_metrics: Arc<crate::services::search_metrics::SearchMetricsService>,
    /// ✅ NOUVEAU 2025-12-01: Service de cache global pour toutes les fonctionnalités
    pub global_cache: Arc<crate::services::global_cache_service::GlobalCacheService>,
    /// ✅ NOUVEAU 2025-12-01: Service de métriques globales pour toutes les fonctionnalités
    pub global_metrics: Arc<crate::services::global_metrics_service::GlobalMetricsService>,
    /// ✅ NOUVEAU 2025-12-01: Service centralisé de scalabilité pour millions d'interactions
    pub scalability: Arc<crate::services::scalability_service::ScalabilityService>,
    /// ✅ NOUVEAU 2025-12-02: Service de cache multi-niveaux pour recherches (L1+L2+L4)
    pub search_cache: Arc<crate::services::search_cache_service::SearchCacheService>,
    /// ✅ Phase 2: Rate limiters pour protection API
    pub global_rate_limiter: Arc<crate::middlewares::rate_limit::GlobalRateLimiter>,
    pub user_rate_limiter: Arc<crate::middlewares::rate_limit::UserRateLimiter>,
    /// ✅ Phase 3: Service de partage d'état Redis pour scaling horizontal
    pub delivery_state_sharing:
        Option<Arc<crate::services::delivery_state_sharing::DeliveryStateSharing>>,
    /// ✅ NOUVEAU 2025-01-27: Manager WebSocket pour chat avec Redis pub/sub
    pub chat_ws_manager: Option<Arc<crate::websocket::chat_websocket::ChatWebSocketManager>>,
    /// ✅ NOUVEAU: Manager WebSocket pour chat de livraison
    pub delivery_chat_ws_manager:
        Option<Arc<crate::websocket::delivery_chat::DeliveryChatWebSocketManager>>,
    /// ✅ NOUVEAU: Cache Redis pour Flash Sales
    pub flash_sale_cache: Option<Arc<crate::services::flash_sale_cache::FlashSaleCache>>,
    /// ✅ NOUVEAU: Queue de réservations Flash Sales
    pub flash_sale_queue: Option<Arc<crate::services::flash_sale_queue::FlashSaleReservationQueue>>,
    /// ✅ NOUVEAU: Cache Redis pour Black Friday / Global Promo
    pub global_promo_cache: Option<Arc<crate::services::global_promo_cache::GlobalPromoCache>>,
    /// ✅ NOUVEAU: Queue de notifications asynchrones
    pub notification_queue: Option<Arc<crate::services::notification_queue::NotificationQueue>>,
    /// ✅ NOUVEAU: Service d'intégration Spotify pour bibliothèque audio
    pub spotify_service: Option<Arc<SpotifyIntegrationService>>,
    /// ✅ NOUVEAU: Service YouTube Audio Library
    pub youtube_audio_service: Option<Arc<YouTubeAudioService>>,
    /// ✅ NOUVEAU 2026-01-03: Service de gestion de la table products séparée
    pub products_service: Arc<crate::services::products_service::ProductsService>,
    /// ✅ NOUVEAU 2026-02-14: Service de gestion GPU automatisé GCP
    pub gpu_service: Option<Arc<GpuService>>,
    /// ✅ NOUVEAU 2026-02-15: Service de gestion Redis Memorystore automatisé GCP
    pub redis_scaling_service: Option<Arc<RedisScalingService>>,
    /// ✅ NOUVEAU 2026-03-05: Service de transcodage vidéo HLS/DASH (TikTok/Shorts)
    pub video_transcoding:
        Option<Arc<crate::services::video_transcoding_service::VideoTranscodingService>>,
    /// ✅ NOUVEAU 2026-03-05: Service de musique trending TikTok/Shorts
    pub trending_music: Option<Arc<crate::services::trending_music_service::TrendingMusicService>>,
    /// ✅ NOUVEAU 2026-03-05: Service de génération vidéo IA (Runway/Sora/Pika)
    pub generative_video:
        Option<Arc<crate::services::generative_video_service::GenerativeVideoService>>,
}

impl AppState {
    /// ? Constructeur explicite pour AppState
    pub fn new(
        pg: PgPool,
        pg_read: Option<PgPool>, // ✅ NOUVEAU 2025-12-02: Read replica optionnel
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

        // ✅ NOUVEAU 2025-12-30: Créer les index MongoDB pour optimiser les requêtes stats/reviews
        // ✅ 2025-12-30: Les index MongoDB seront créés dans main.rs après l'initialisation complète
        // (on ne peut pas utiliser await dans une fonction non-async)

        // V?rifier si les optimisations IA sont activ?es
        let optimizations_enabled = env::var("ENABLE_AI_OPTIMIZATIONS")
            .unwrap_or_else(|_| "false".to_string())
            .parse::<bool>()
            .unwrap_or(false);

        // ✅ OPTIMISÉ: DeliveryRepository avec cache Redis pour améliorer les performances
        let delivery_repo = Arc::new(
            crate::services::delivery_repository::DeliveryRepository::with_redis(
                pg.clone(),
                Some(redis_client.clone()),
            ),
        );
        let delivery_ws_manager = Arc::new(DeliveryTrackingManager::new(
            64,
            if redis_available_for_ws {
                Some(redis_client.clone())
            } else {
                None
            },
        ));

        // ✅ NOUVEAU 2025-12-01: Créer le pool Redis pour réutiliser les connexions
        // Note: redis_url n'est pas disponible ici, on le récupère depuis DATABASE_URL ou on utilise redis_client
        let redis_pool = {
            // Récupérer l'URL Redis depuis l'environnement
            let redis_url = std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());

            // Normaliser l'URL Redis (convertir redis:// en rediss:// pour Upstash)
            let mut normalized_url = redis_url.clone();
            if redis_url.contains("upstash.io") && redis_url.starts_with("redis://") {
                normalized_url = redis_url.replace("redis://", "rediss://");
            }

            // Ajouter le numéro de base de données si absent
            if !normalized_url.contains("/")
                || (!normalized_url.ends_with("/0")
                    && !normalized_url.ends_with("/1")
                    && !normalized_url.ends_with("/2")
                    && !normalized_url.ends_with("/3")
                    && !normalized_url.ends_with("/4")
                    && !normalized_url.ends_with("/5")
                    && !normalized_url.ends_with("/6")
                    && !normalized_url.ends_with("/7")
                    && !normalized_url.ends_with("/8")
                    && !normalized_url.ends_with("/9"))
            {
                if normalized_url.matches(':').count() >= 2 && !normalized_url.contains("/") {
                    normalized_url.push_str("/0");
                } else if normalized_url.ends_with('/') {
                    normalized_url.push('0');
                }
            }

            // deadpool_redis::Config::from_url retourne directement un Config, pas un Result
            let mut cfg = deadpool_redis::Config::from_url(normalized_url);
            // Configurer le pool (max 16 connexions, min 4)
            if cfg.pool.is_none() {
                cfg.pool = Some(deadpool_redis::PoolConfig::default());
            }
            if let Some(ref mut pool_cfg) = cfg.pool {
                pool_cfg.max_size = 16;
                // Note: min_idle n'existe pas dans PoolConfig de deadpool-redis 0.15
            }
            match cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1)) {
                Ok(pool) => {
                    log::info!("✅ Pool Redis créé (max: 16, min: 4)");
                    Some(Arc::new(pool))
                }
                Err(e) => {
                    let error_str = e.to_string().to_lowercase();
                    // Détecter spécifiquement les erreurs TLS pour un message plus clair
                    if error_str.contains("tls") || error_str.contains("the feature is not enabled")
                    {
                        log::debug!("ℹ️ Redis TLS non disponible - Utilisation connexions directes sans TLS");
                    } else {
                        log::warn!("⚠️ Impossible de créer le pool Redis: {}. Utilisation connexions directes.", e);
                    }
                    None
                }
            }
        };

        // ✅ Phase 10 - Initialiser le cache service d'abord
        let cache_service = Arc::new(CacheService::new(Some(redis_client.clone())));

        // ✅ NOUVEAU 2025-12-01: Initialiser le service de métriques de recherche (singleton)
        let search_metrics = Arc::new(crate::services::search_metrics::SearchMetricsService::new());

        // ✅ NOUVEAU 2025-12-01: Initialiser le service de cache global
        let global_cache = Arc::new(
            crate::services::global_cache_service::GlobalCacheService::new(Some(
                cache_service.clone(),
            )),
        );

        // ✅ NOUVEAU 2025-12-01: Initialiser le service de métriques globales
        let global_metrics =
            Arc::new(crate::services::global_metrics_service::GlobalMetricsService::new());

        // ✅ Phase 10 - Initialiser le service de matching géographique
        let geocoding_service = GeocodingService::with_cache(Some(redis_client.clone()));
        let geographic_matching_service = Arc::new(
            crate::services::geographic_matching_service::GeographicMatchingService::new(
                pg.clone(),
                cache_service.clone(),
                geocoding_service,
            ),
        );

        // ✅ Phase 1 - DeliveryService avec matching géographique ET cache Redis
        let delivery_service = Arc::new(
            crate::services::delivery_service::DeliveryService::with_geographic_matching_and_cache(
                delivery_repo.clone(),
                delivery_ws_manager.clone(),
                geographic_matching_service.clone(),
                cache_service.clone(),
            ),
        );

        let renderer_config = VideoRendererConfig::from_env();
        let storage_config = MediaStorageConfig::from_env();
        let media_storage = Arc::new(MediaStorageService::new(storage_config.clone()));

        // ✅ AMÉLIORÉ: Logger pourquoi le renderer n'est pas disponible
        if renderer_config.is_none() {
            log::warn!("[AppState] ⚠️ VideoRendererConfig non disponible - Vérifiez VIDEO_RENDERER_PROJECT_ROOT et VIDEO_RENDERER_ENABLED");
        }

        let remotion_renderer = renderer_config.as_ref().and_then(|cfg| {
            match crate::services::remotion_renderer_service::RemotionRendererService::new(
                cfg.clone(),
            ) {
                Ok(service) => {
                    log::info!("[AppState] ✅ Remotion renderer local initialisé");
                    Some(Arc::new(service))
                }
                Err(err) => {
                    log::warn!("[AppState] ⚠️ Remotion renderer local inactif: {err:?}");
                    None
                }
            }
        });

        let video_renderer = renderer_config.as_ref().and_then(|cfg| {
            VideoRenderDispatcher::from_state_config(cfg.clone(), remotion_renderer.clone())
                .map(Arc::new)
        });

        // ✅ AMÉLIORÉ: Logger l'état final du renderer
        if video_renderer.is_some() {
            log::info!("[AppState] ✅ VideoRenderDispatcher initialisé avec succès");
        } else {
            log::warn!("[AppState] ⚠️ VideoRenderDispatcher non disponible - Le service de prévisualisation vidéo sera indisponible");
            if let Some(cfg) = renderer_config.as_ref() {
                log::warn!("[AppState]   - RPC endpoint: {:?}", cfg.rpc_endpoint);
                log::warn!(
                    "[AppState]   - Remotion local: {}",
                    if remotion_renderer.is_some() {
                        "disponible"
                    } else {
                        "indisponible"
                    }
                );
            }
        }

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

        // ✅ NOUVEAU: Initialiser le service Spotify si les variables sont configurées
        let spotify_service = {
            if let (Ok(client_id), Ok(client_secret)) = (
                env::var("SPOTIFY_CLIENT_ID"),
                env::var("SPOTIFY_CLIENT_SECRET"),
            ) {
                log::info!("✅ Service Spotify initialisé");
                Some(Arc::new(SpotifyIntegrationService::new(
                    client_id,
                    client_secret,
                )))
            } else {
                log::info!("ℹ️ Service Spotify non configuré (SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET requis)");
                None
            }
        };

        // ✅ NOUVEAU: Initialiser le service YouTube Audio Library
        let youtube_audio_service = {
            let api_key = env::var("YOUTUBE_API_KEY").ok();
            if api_key.is_some() {
                log::info!("✅ Service YouTube Audio Library initialisé avec API key");
            } else {
                log::info!("ℹ️ Service YouTube Audio Library initialisé (bibliothèque statique, pas d'API key)");
            }
            Some(Arc::new(YouTubeAudioService::new(api_key)))
        };

        // ✅ NOUVEAU 2025-12-01: Initialiser le service de scalabilité avec Redis pour scaling horizontal
        let scalability_service = Arc::new(
            crate::services::scalability_service::ScalabilityService::with_redis(
                Some(cache_service.clone()),
                Some(redis_client.clone()), // ✅ Phase 7.5: Passer Redis pour scaling horizontal
            ),
        );

        // ✅ NOUVEAU 2025-12-02: Initialiser le service de cache multi-niveaux pour recherches
        let search_cache_service = Arc::new(
            crate::services::search_cache_service::SearchCacheService::new(Some(
                cache_service.clone(),
            )),
        );

        // ✅ NOUVEAU 2025-12-02: Initialiser Redis cluster nodes si configuré
        let redis_cluster_nodes = env::var("REDIS_CLUSTER_NODES")
            .ok()
            .map(|nodes| nodes.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_else(Vec::new);

        // ✅ Phase 2: Initialiser les rate limiters
        let global_rate_limiter = Arc::new(
            crate::middlewares::rate_limit::GlobalRateLimiter::new(100), // 100 req/s global
        );
        let user_rate_limiter = Arc::new(
            crate::middlewares::rate_limit::UserRateLimiter::new(60), // 60 req/min par utilisateur
        );

        // ✅ Phase 3: Initialiser le service de partage d'état Redis pour scaling horizontal
        let delivery_state_sharing = if redis_available_for_ws {
            let instance_id = env::var("INSTANCE_ID")
                .unwrap_or_else(|_| format!("backend-{}", uuid::Uuid::new_v4()));
            log::info!(
                "✅ DeliveryStateSharing configuré - Instance ID: {}",
                instance_id
            );
            Some(Arc::new(
                crate::services::delivery_state_sharing::DeliveryStateSharing::new(
                    redis_client.clone(),
                    instance_id,
                ),
            ))
        } else {
            log::info!("ℹ️ DeliveryStateSharing non configuré (Redis non disponible)");
            None
        };

        // Cloner pg avant de le déplacer dans AppState
        let pg_clone = pg.clone();
        let pg_clone_gpu = pg.clone();

        // ✅ NOUVEAU 2026-02-15: Cloner pg avant de le déplacer dans AppState (pour redis_scaling_service)
        let pg_for_redis_scaling = pg.clone();

        AppState {
            pg,
            pg_read, // ✅ NOUVEAU 2025-12-02: Read replica pour scaling horizontal
            mongo,
            mongo_history,
            ia,
            ia_stats,
            database_url,
            optimizations_enabled,
            redis_client: redis_client.clone(),
            redis_pool, // ✅ NOUVEAU 2025-12-01: Pool Redis pour réutiliser les connexions
            redis_cluster_nodes, // ✅ NOUVEAU 2025-12-02: Support Redis cluster
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
            search_metrics, // ✅ NOUVEAU 2025-12-01: Service de métriques de recherche
            global_cache,   // ✅ NOUVEAU 2025-12-01: Service de cache global
            global_metrics, // ✅ NOUVEAU 2025-12-01: Service de métriques globales
            scalability: scalability_service,
            search_cache: search_cache_service,
            global_rate_limiter,
            user_rate_limiter,
            delivery_state_sharing,
            // ✅ NOUVEAU: Initialiser le manager WebSocket chat de livraison
            delivery_chat_ws_manager: Some(Arc::new(
                crate::websocket::delivery_chat::DeliveryChatWebSocketManager::new(
                    64,
                    if redis_available_for_ws {
                        Some(redis_client.clone())
                    } else {
                        None
                    },
                ),
            )),
            // ✅ NOUVEAU 2025-01-27: Initialiser le manager WebSocket chat
            chat_ws_manager: Some(Arc::new(
                crate::websocket::chat_websocket::ChatWebSocketManager::new(
                    64,
                    if redis_available_for_ws {
                        Some(redis_client.clone())
                    } else {
                        None
                    },
                ),
            )),
            // ✅ NOUVEAU: Initialiser les caches et queues pour Flash Sales et Black Friday
            flash_sale_cache: Some(Arc::new(
                crate::services::flash_sale_cache::FlashSaleCache::new(Arc::new(
                    redis_client.clone(),
                )),
            )),
            flash_sale_queue: Some(Arc::new(
                crate::services::flash_sale_queue::FlashSaleReservationQueue::new(Arc::new(
                    redis_client.clone(),
                )),
            )),
            global_promo_cache: Some(Arc::new(
                crate::services::global_promo_cache::GlobalPromoCache::new(Arc::new(
                    redis_client.clone(),
                )),
            )),
            notification_queue: Some(Arc::new(
                crate::services::notification_queue::NotificationQueue::new(Arc::new(
                    redis_client.clone(),
                )),
            )),
            spotify_service,
            youtube_audio_service,
            products_service: Arc::new(crate::services::products_service::ProductsService::new(
                Arc::new(pg_clone),
            )),
            // ✅ NOUVEAU 2026-02-14: Initialiser le service GPU si configuré
            gpu_service: {
                if let Some(config) = GpuConfig::from_env() {
                    let service = GpuService::new(config, Arc::new(pg_clone_gpu));
                    log::info!("✅ Service GPU initialisé");
                    Some(Arc::new(service))
                } else {
                    log::info!(
                        "ℹ️ Service GPU non configuré (GPU_ENABLED=false ou variables manquantes)"
                    );
                    None
                }
            },
            // ✅ NOUVEAU 2026-02-15: Initialiser le service Redis scaling si configuré
            redis_scaling_service: {
                if let Some(config) = RedisScalingConfig::from_env() {
                    let service = RedisScalingService::new(
                        config,
                        Arc::new(pg_for_redis_scaling),
                        Some(Arc::new(redis_client.clone())),
                    );
                    log::info!("✅ Service Redis scaling initialisé");
                    Some(Arc::new(service))
                } else {
                    log::info!(
                        "ℹ️ Service Redis scaling non configuré (REDIS_SCALING_ENABLED=false ou variables manquantes)"
                    );
                    None
                }
            },
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

        // ✅ OPTIMISÉ: DeliveryRepository avec cache Redis pour les tests
        let delivery_repo = Arc::new(
            crate::services::delivery_repository::DeliveryRepository::with_redis(
                pg.clone(),
                Some(redis_client.clone()),
            ),
        );

        // ✅ Initialiser cache_service avant son utilisation
        let cache_service = Arc::new(CacheService::new(Some(redis_client.clone())));

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
        // ✅ Phase 1 - DeliveryService avec cache pour les tests
        let delivery_service = Arc::new(
            crate::services::delivery_service::DeliveryService::with_cache(
                delivery_repo.clone(),
                delivery_ws_manager.clone(),
                cache_service.clone(),
            ),
        );

        let cost_pg = pg.clone();
        let video_pg = pg.clone();

        let media_storage = Arc::new(MediaStorageService::new(MediaStorageConfig::from_env()));
        let voice_profiles = Arc::new(VoiceProfileService::new(pg.clone(), media_storage.clone()));
        let commerce_connector = Arc::new(CommerceConnectorService::new(pg.clone()));
        let story_templates = Arc::new(StoryTemplateService::new());
        let inventory = Arc::new(InventoryService::new(pg.clone()));
        let studio_service = Arc::new(StudioService::new(pg.clone(), media_storage.clone(), None));
        let feature_flags = Arc::new(FeatureFlagService::from_env());

        // ✅ NOUVEAU 2025-12-01: Pool Redis pour tests (optionnel)
        let redis_pool = {
            let redis_url =
                env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());
            let mut cfg = deadpool_redis::Config::from_url(redis_url);
            if cfg.pool.is_none() {
                cfg.pool = Some(deadpool_redis::PoolConfig::default());
            }
            if let Some(ref mut pool_cfg) = cfg.pool {
                pool_cfg.max_size = 8;
                // Note: min_idle n'existe pas dans PoolConfig de deadpool-redis 0.15
            }
            cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1)).ok().map(Arc::new)
        };

        // ✅ NOUVEAU 2025-12-01: Service de métriques pour tests
        let search_metrics = Arc::new(crate::services::search_metrics::SearchMetricsService::new());

        // ✅ NOUVEAU 2025-12-01: Cache global et métriques globales pour tests
        let global_cache = Arc::new(
            crate::services::global_cache_service::GlobalCacheService::new(Some(
                cache_service.clone(),
            )),
        );
        let global_metrics =
            Arc::new(crate::services::global_metrics_service::GlobalMetricsService::new());

        // ✅ Phase 10 - Initialiser le service de matching géographique pour les tests
        let geocoding_service = GeocodingService::with_cache(Some(redis_client.clone()));
        let geographic_matching_service = Arc::new(
            crate::services::geographic_matching_service::GeographicMatchingService::new(
                pg.clone(),
                cache_service.clone(),
                geocoding_service,
            ),
        );

        // ✅ NOUVEAU 2025-12-01: Service de scalabilité pour tests (avec Redis si disponible)
        let scalability_service = Arc::new(
            crate::services::scalability_service::ScalabilityService::with_redis(
                Some(cache_service.clone()),
                if redis_available_for_ws {
                    Some(redis_client.clone())
                } else {
                    None
                },
            ),
        );

        // ✅ NOUVEAU 2025-12-02: Service de cache multi-niveaux pour recherches
        let search_cache_service = Arc::new(
            crate::services::search_cache_service::SearchCacheService::new(Some(
                cache_service.clone(),
            )),
        );

        // Cloner pg avant de le déplacer dans AppState
        let pg_clone = pg.clone();

        AppState {
            pg,
            pg_read: None, // ✅ NOUVEAU 2025-12-02: Read replica optionnel pour tests
            mongo,
            mongo_history,
            ia: app_ia,
            ia_stats,
            database_url,
            optimizations_enabled: false, // Désactivé pour les tests
            redis_client: redis_client.clone(),
            redis_pool,
            redis_cluster_nodes: vec![], // ✅ NOUVEAU 2025-12-02: Support Redis cluster
            semantic_cache: None,
            prompt_optimizer: None,
            live_streaming: {
                let config = LiveStreamingConfig::from_env();
                // Validation silencieuse pour les tests
                if config.validate().is_err() {
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
            search_metrics,
            global_cache,
            global_metrics,
            scalability: scalability_service,
            search_cache: search_cache_service,
            // ✅ Phase 2: Rate limiters pour tests
            global_rate_limiter: Arc::new(crate::middlewares::rate_limit::GlobalRateLimiter::new(
                1000,
            )),
            user_rate_limiter: Arc::new(crate::middlewares::rate_limit::UserRateLimiter::new(600)),
            // ✅ Phase 3: Pas de locks pour tests
            delivery_state_sharing: None,
            // ✅ NOUVEAU 2025-01-27: Manager WebSocket chat pour tests
            chat_ws_manager: {
                let redis_client_clone = redis_client.clone();
                let redis_available_for_ws =
                    redis_client_clone.get_multiplexed_async_connection().await.is_ok();
                Some(Arc::new(
                    crate::websocket::chat_websocket::ChatWebSocketManager::new(
                        32,
                        if redis_available_for_ws {
                            Some(redis_client.clone())
                        } else {
                            None
                        },
                    ),
                ))
            },
            // ✅ NOUVEAU: Manager WebSocket chat de livraison pour tests
            delivery_chat_ws_manager: {
                let redis_client_for_delivery = redis_client.clone();
                let redis_available_for_ws =
                    redis_client_for_delivery.get_multiplexed_async_connection().await.is_ok();
                Some(Arc::new(
                    crate::websocket::delivery_chat::DeliveryChatWebSocketManager::new(
                        64,
                        if redis_available_for_ws {
                            Some(redis_client.clone())
                        } else {
                            None
                        },
                    ),
                ))
            },
            // ✅ NOUVEAU: Caches et queues pour tests
            flash_sale_cache: Some(Arc::new(
                crate::services::flash_sale_cache::FlashSaleCache::new(Arc::new(
                    redis_client.clone(),
                )),
            )),
            flash_sale_queue: Some(Arc::new(
                crate::services::flash_sale_queue::FlashSaleReservationQueue::new(Arc::new(
                    redis_client.clone(),
                )),
            )),
            global_promo_cache: Some(Arc::new(
                crate::services::global_promo_cache::GlobalPromoCache::new(Arc::new(
                    redis_client.clone(),
                )),
            )),
            notification_queue: Some(Arc::new(
                crate::services::notification_queue::NotificationQueue::new(Arc::new(
                    redis_client.clone(),
                )),
            )),
            spotify_service: None, // Pas de Spotify pour les tests
            youtube_audio_service: Some(Arc::new(YouTubeAudioService::new(None))),
            products_service: Arc::new(crate::services::products_service::ProductsService::new(
                Arc::new(pg_clone),
            )),
            // ✅ NOUVEAU 2026-02-14: Service GPU désactivé pour les tests
            gpu_service: None,
            redis_scaling_service: None,
        }
    }
}

/// Alias pratique pour l'?tat partag?
pub type SharedState = Arc<AppState>;
pub type AppStateShared = Arc<AppState>;
