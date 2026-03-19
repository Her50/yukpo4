// src/test_utils.rs
// Test helpers for integration and unit tests
use crate::utils::jwt_manager;
use std::env;

#[cfg(test)]
use crate::{
    config::{live_streaming::LiveStreamingConfig, storage::MediaStorageConfig},
    controllers::ia_status_controller::IAStats,
    migrations::auto_migrate::run_auto_migrations,
    services::{
        app_ia::AppIA, commerce_connector_service::CommerceConnectorService,
        cost_service::CostEstimator, delivery_repository::DeliveryRepository,
        delivery_service::DeliveryService, inventory_service::InventoryService,
        media_storage_service::MediaStorageService, mongo_history_service::MongoHistoryService,
        story_template_service::StoryTemplateService, studio_service::StudioService,
        video_job_service::VideoGenerationJobService, voice_profile_service::VoiceProfileService,
    },
    state::AppState,
    websocket::delivery_tracking::DeliveryTrackingManager,
};
#[cfg(test)]
use log::error;
#[cfg(test)]
use redis::Client as RedisClient;
#[cfg(test)]
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
#[cfg(test)]
use std::sync::{Arc, OnceLock};
#[cfg(test)]
use tokio::sync::Mutex;

/// Generate a JWT for tests (user or admin)
pub fn gen_jwt(role: &str, user_id: i32) -> String {
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "dev_secret".to_string());
    jwt_manager::generate_jwt(
        user_id,
        role,
        &format!("test{}@example.com", user_id),
        Some(format!("Test User {}", user_id)), // ✅ NOUVEAU: nom de test
        100,
        &secret,
        None, // partner_type
    )
    .unwrap()
}

#[cfg(test)]
pub struct BackendTestContext {
    pub state: Arc<AppState>,
    pub pool: PgPool,
    pub user_id: i32,
}

#[cfg(test)]
pub async fn backend_test_db_lock() -> tokio::sync::MutexGuard<'static, ()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(())).lock().await
}

#[cfg(test)]
pub async fn setup_backend_test_context() -> Option<BackendTestContext> {
    let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgres://postgres:Hernandez87@localhost/yukpomnang_test".to_string()
    });

    let pool = match PgPoolOptions::new().max_connections(5).connect(&database_url).await {
        Ok(pool) => pool,
        Err(err) => {
            eprintln!(
                "[tests] ❌ Impossible de se connecter à PostgreSQL ({database_url}): {err:?}"
            );
            return None;
        }
    };

    run_auto_migrations(&pool).await;

    if let Err(err) = sqlx::query(
        "TRUNCATE TABLE media_distribution, media_engagement, media, services, token_usage_logs, users RESTART IDENTITY CASCADE",
    )
    .execute(&pool)
    .await
    {
        error!("[tests] ❌ Impossible de nettoyer la base de tests: {:?}", err);
        return None;
    }

    let user_row = match sqlx::query(
        r#"
        INSERT INTO users (
            email,
            password_hash,
            role,
            is_provider,
            tokens_balance,
            preferred_lang,
            token_price_user,
            token_price_provider,
            commission_pct,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind("test-user@example.com")
    .bind("test-hash")
    .bind("user")
    .bind(false)
    .bind(1_000_000_i64)
    .bind("fr")
    .bind(1.0_f64)
    .bind(1.0_f64)
    .bind(0.0_f32)
    .fetch_one(&pool)
    .await
    {
        Ok(row) => row,
        Err(err) => {
            error!(
                "[tests] ❌ Impossible d'insérer l'utilisateur de test: {:?}",
                err
            );
            return None;
        }
    };

    let user_id: i32 = user_row.get::<i32, _>("id");

    let redis_uri =
        std::env::var("TEST_REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
    let redis_client = match RedisClient::open(redis_uri.clone()) {
        Ok(client) => client,
        Err(err) => {
            eprintln!("[tests] ❌ Impossible de créer le client Redis ({redis_uri}): {err:?}");
            return None;
        }
    };

    let ia_stats = Arc::new(Mutex::new(IAStats::default()));
    let app_ia = Arc::new(AppIA::new(
        redis_client.clone(),
        ia_stats.clone(),
        pool.clone(),
    ));

    // ✅ 2026-03-16: MongoHistoryService utilise PostgreSQL maintenant
    let mongo_history = Arc::new(MongoHistoryService::new(Arc::new(pool.clone())));

    let delivery_repo = Arc::new(DeliveryRepository::new(pool.clone()));
    let delivery_ws_manager =
        Arc::new(DeliveryTrackingManager::new(16, Some(redis_client.clone())));
    let delivery_service = Arc::new(DeliveryService::new(
        delivery_repo.clone(),
        delivery_ws_manager.clone(),
    ));

    let cost_service = Arc::new(CostEstimator::new(pool.clone()));

    let media_storage = Arc::new(MediaStorageService::new(MediaStorageConfig::from_env()));
    let voice_profiles = Arc::new(VoiceProfileService::new(
        pool.clone(),
        media_storage.clone(),
    ));
    let commerce_connector = Arc::new(CommerceConnectorService::new(pool.clone()));
    let story_templates = Arc::new(StoryTemplateService::new());
    let inventory = Arc::new(InventoryService::new(pool.clone()));
    let studio_service = Arc::new(StudioService::new(
        pool.clone(),
        media_storage.clone(),
        None,
    ));

    let cache_service = Arc::new(crate::services::cache_service::CacheService::new(Some(
        redis_client.clone(),
    )));
    let products_pool = Arc::new(pool.clone());

    let state = Arc::new(AppState {
        pg: pool.clone(),
        pg_read: None,
        mongo_history,
        ia: app_ia,
        ia_stats,
        database_url,
        optimizations_enabled: false,
        redis_client,
        redis_pool: None,
        redis_cluster_nodes: vec![],
        semantic_cache: None,
        prompt_optimizer: None,
        live_streaming: Arc::new(LiveStreamingConfig::from_env()),
        delivery_ws_manager,
        delivery_service,
        media_storage,
        remotion_renderer: None,
        video_renderer: None,
        audio_mastering: None,
        cost_service,
        broll_service: None,
        video_jobs: Arc::new(VideoGenerationJobService::new(pool.clone())),
        voice_profiles,
        commerce_connector,
        story_templates,
        studio_service,
        inventory,
        feature_flags: Arc::new(crate::config::feature_flags::FeatureFlagService::from_env()),
        cache_service: cache_service.clone(),
        geographic_matching: None,
        search_metrics: Arc::new(crate::services::search_metrics::SearchMetricsService::new()),
        global_cache: Arc::new(
            crate::services::global_cache_service::GlobalCacheService::new(Some(
                cache_service.clone(),
            )),
        ),
        global_metrics: Arc::new(
            crate::services::global_metrics_service::GlobalMetricsService::new(),
        ),
        scalability: Arc::new(
            crate::services::scalability_service::ScalabilityService::new(Some(
                cache_service.clone(),
            )),
        ),
        search_cache: Arc::new(
            crate::services::search_cache_service::SearchCacheService::new(Some(
                cache_service.clone(),
            )),
        ),
        global_rate_limiter: Arc::new(crate::middlewares::rate_limit::GlobalRateLimiter::new(100)),
        user_rate_limiter: Arc::new(crate::middlewares::rate_limit::UserRateLimiter::new(60)),
        delivery_state_sharing: None,
        chat_ws_manager: None,
        delivery_chat_ws_manager: None,
        flash_sale_cache: None,
        flash_sale_queue: None,
        global_promo_cache: None,
        notification_queue: None,
        spotify_service: None,
        youtube_audio_service: None,
        products_service: Arc::new(crate::services::products_service::ProductsService::new(
            products_pool.clone(),
        )),
        gpu_service: None,
        redis_scaling_service: None,
        video_transcoding: None,
        trending_music: None,
        generative_video: None,
        multilingue_service: Arc::new(
            crate::services::multilingue_service::MultilingueService::new(),
        ),
        paiement_service: Arc::new(
            crate::services::paiement_agrege_service::PaiementAgregeService::new(products_pool),
        ),
    });

    Some(BackendTestContext {
        state,
        pool,
        user_id,
    })
}
