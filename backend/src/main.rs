use std::{env, fs, net::SocketAddr, path::Path, sync::Arc};

use dotenvy::dotenv;
use mongodb::Client as MongoClient;
use redis::Client as RedisClient;
use sqlx::postgres::PgPoolOptions;
use tokio::sync::Mutex;

use axum::serve;
use yukpomnang_backend::{
    build_app, config::timeouts::TimeoutConfig, controllers::ia_status_controller::IAStats,
    services::app_ia::AppIA, state::AppState,
};

use yukpomnang_backend::services::gpu_optimizer::GPUOptimizer;
use yukpomnang_backend::services::massive_load_handler::MassiveLoadHandler;
use yukpomnang_backend::services::social_distribution_service;
use yukpomnang_backend::tasks;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    yukpomnang_backend::init_logging();

    let db_url = env::var("DATABASE_URL")?;
    let timeout_config = TimeoutConfig::from_env();

    let upload_storage_path =
        env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "/var/data/uploads".to_string());
    if let Err(err) = fs::create_dir_all(&upload_storage_path) {
        eprintln!("⚠️ Impossible de créer le dossier des uploads ({upload_storage_path}): {err}");
    }
    if let Err(err) = fs::create_dir_all(Path::new(&upload_storage_path).join("tmp")) {
        eprintln!("⚠️ Impossible de créer le dossier temporaire des uploads: {err}");
    }

    let pg_pool = PgPoolOptions::new()
        .max_connections(10) // Augmenté de 5 à 10 pour de meilleures performances
        .acquire_timeout(timeout_config.get_database_timeout())
        .idle_timeout(Some(std::time::Duration::from_secs(600))) // 10 minutes
        .max_lifetime(Some(std::time::Duration::from_secs(1800))) // 30 minutes
        .connect(&db_url)
        .await?;

    // 🔄 Exécuter les migrations SQLx standard au démarrage
    log::info!("🚀 Application des migrations SQLx standard...");
    match sqlx::migrate!("./migrations").run(&pg_pool).await {
        Ok(_) => log::info!("✅ Migrations SQLx standard appliquées avec succès"),
        Err(e) => {
            log::error!("❌ Erreur lors de l'application des migrations SQLx standard: {}", e);
            // On continue quand même, certaines migrations peuvent déjà être appliquées
            log::warn!("⚠️ Continuation du démarrage malgré l'erreur de migration");
        }
    }

    // 🔄 Exécuter les migrations automatiques au démarrage
    yukpomnang_backend::migrations::auto_migrate::run_auto_migrations(&pg_pool).await;

    let mongo_url =
        env::var("MONGODB_URL").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let mongo_client = MongoClient::with_uri_str(&mongo_url).await?;

    // Configuration Redis avec test de connexion
    let redis_url =
        env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());

    // Créer un client Redis et tester la connexion
    let (redis_client, redis_available_for_ws) = match RedisClient::open(redis_url.clone()) {
        Ok(client) => {
            // Tester la connexion réelle avec un timeout
            let test_conn = tokio::time::timeout(
                std::time::Duration::from_secs(2),
                client.get_multiplexed_async_connection(),
            )
            .await;
            
            match test_conn {
                Ok(Ok(_)) => {
                    println!("✅ Connexion Redis établie - Backend v2.1.4");
                    (client, true)
                }
                Ok(Err(e)) => {
                    // Ne logger qu'en INFO pour les erreurs de connexion Redis (service optionnel)
                    let err_msg = format!("{}", e);
                    if err_msg.contains("Name or service not known") || err_msg.contains("Connection refused") {
                        log::info!("ℹ️ Redis non disponible (service optionnel). WebSocket de livraison fonctionnera sans Redis.");
                    } else {
                        log::warn!("⚠️ Redis URL configurée mais connexion impossible: {}. Redis sera désactivé pour le WebSocket de livraison.", e);
                    }
                    // Créer un client factice pour les autres services qui peuvent gérer l'absence de Redis
                    let dummy_client = RedisClient::open("redis://invalid-host:6379/0").unwrap_or_else(|_| {
                        RedisClient::open("redis://localhost:9999/0")
                            .expect("Impossible de créer un client Redis factice")
                    });
                    (dummy_client, false)
                }
                Err(e) => {
                    log::info!("ℹ️ Redis timeout de connexion (service optionnel). WebSocket de livraison fonctionnera sans Redis.");
                    // Créer un client factice pour les autres services qui peuvent gérer l'absence de Redis
                    let dummy_client = RedisClient::open("redis://invalid-host:6379/0").unwrap_or_else(|_| {
                        RedisClient::open("redis://localhost:9999/0")
                            .expect("Impossible de créer un client Redis factice")
                    });
                    (dummy_client, false)
                }
            }
        }
        Err(e) => {
            log::warn!("⚠️ Erreur création client Redis: {}. Redis sera désactivé pour le WebSocket de livraison.", e);
            // Créer un client factice pour les autres services
            let dummy_client = RedisClient::open("redis://invalid-host:6379/0").unwrap_or_else(|_| {
                RedisClient::open("redis://localhost:9999/0")
                    .expect("Impossible de créer un client Redis factice")
            });
            (dummy_client, false)
        }
    };

    let ia_stats = Arc::new(Mutex::new(IAStats::default()));
    let app_ia = Arc::new(AppIA::new(
        redis_client.clone(),
        ia_stats.clone(),
        pg_pool.clone(),
    ));

    let app_state = Arc::new(AppState::new(
        pg_pool,
        mongo_client,
        app_ia,
        ia_stats,
        redis_client,
        redis_available_for_ws,
    ));

    social_distribution_service::start_distribution_worker(app_state.clone());

    // ?? Initialiser l'architecture cloud massive
    let massive_load_handler = MassiveLoadHandler::new();
    let gpu_optimizer = GPUOptimizer::new();

    log::info!("?? Architecture cloud massive initialis?e");
    log::info!("? {}", massive_load_handler.get_stats().await);
    log::info!("?? {}", gpu_optimizer.get_stats());

    // ✅ Lancer la désactivation automatique des produits (tous les jours à minuit)
    let state_clone_products = app_state.clone();
    tokio::spawn(async move {
        use tokio::time::{interval, Duration};
        let mut interval = interval(Duration::from_secs(86400)); // 24 heures

        loop {
            interval.tick().await;
            log::info!("🔄 Démarrage de la désactivation automatique des produits...");

            match yukpomnang_backend::tasks::product_deactivation::deactivate_expired_products(
                &state_clone_products.pg,
            )
            .await
            {
                Ok(count) => log::info!("✅ {} produits désactivés automatiquement", count),
                Err(e) => log::error!("❌ Erreur désactivation produits: {}", e),
            }
        }
    });

    // ✅ Lancer la tâche de désactivation des publicités expirées (toutes les heures)
    let pool_clone_pub = Arc::new(app_state.pg.clone());
    tokio::spawn(async move {
        yukpomnang_backend::tasks::publicite_expiration::start_publicite_expiration_task(
            pool_clone_pub,
        )
        .await;
    });

    // ✅ Lancer le nettoyage périodique des rooms/ingress LiveKit/SRS
    tasks::livekit_cleanup::start_livekit_cleanup_task(app_state.clone());
    // ✅ Lancer la synchronisation des analytics LiveKit
    tasks::live_analytics::start_live_analytics_task(app_state.clone());
    // ✅ Scheduler pour les ventes flash live
    tasks::live_flash_sale_scheduler::start_flash_sale_scheduler(app_state.clone());
    // ✅ Scheduler pour les campagnes promos globales (Black Friday, etc.)
    tasks::global_promo_scheduler::start_global_promo_scheduler(app_state.clone());
    // ✅ Worker pipeline health (alerting interne)
    tasks::pipeline_health_worker::start_pipeline_health_worker(app_state.clone());
    // ✅ Matching temps réel
    tasks::delivery_matching_worker::start_delivery_matching_worker(app_state.clone());
    // ✅ Surveillance SLA
    tasks::delivery_sla_monitor::start_delivery_sla_monitor(app_state.clone());
    // ✅ Monitor des timeouts de validation d'étapes
    tokio::spawn(tasks::delivery_timeout_monitor::start_delivery_timeout_monitor(app_state.clone()));
    // ✅ Monitor des timeouts de validation de commandes
    tokio::spawn(tasks::order_timeout_monitor::start_order_timeout_monitor(app_state.clone()));

    // ✅ Tâches de recalcul périodique des statistiques (Phase 6)
    let pool_clone_category_stats = Arc::new(app_state.pg.clone());
    tokio::spawn(async move {
        tasks::stats_recalculation::start_category_stats_recalculation_task(pool_clone_category_stats).await;
    });

    let pool_clone_cancellation_stats = Arc::new(app_state.pg.clone());
    tokio::spawn(async move {
        tasks::stats_recalculation::start_product_cancellation_stats_recalculation_task(pool_clone_cancellation_stats).await;
    });

    // Construction de l'application avec Extension
    let app = build_app(app_state.clone())
        //.merge(yukpomnang_backend::openapi::swagger_router()) // Swagger d?sactiv? temporairement
        .with_state(app_state.clone());

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    println!("?? Serveur lanc? sur http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    serve(listener, app).await?;

    Ok(())
}
