use std::{env, net::SocketAddr, sync::Arc};

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

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    yukpomnang_backend::init_logging();

    let db_url = env::var("DATABASE_URL")?;
    let timeout_config = TimeoutConfig::from_env();

    let pg_pool = PgPoolOptions::new()
        .max_connections(10) // Augmenté de 5 à 10 pour de meilleures performances
        .acquire_timeout(timeout_config.get_database_timeout())
        .idle_timeout(Some(std::time::Duration::from_secs(600))) // 10 minutes
        .max_lifetime(Some(std::time::Duration::from_secs(1800))) // 30 minutes
        .connect(&db_url)
        .await?;

    // 🔄 Exécuter les migrations automatiques au démarrage
    yukpomnang_backend::migrations::auto_migrate::run_auto_migrations(&pg_pool).await;

    let mongo_url =
        env::var("MONGODB_URL").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let mongo_client = MongoClient::with_uri_str(&mongo_url).await?;

    // Configuration Redis temporaire - utiliser une URL factice pour ?viter les erreurs
    let redis_url =
        env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());

    // Cr?er un client Redis avec gestion d'erreur
    let redis_client = match RedisClient::open(redis_url) {
        Ok(client) => {
            println!("✅ Connexion Redis établie - Backend v2.1.4");
            client
        }
        Err(e) => {
            println!("??  Erreur Redis: {}. Utilisation d'un client factice.", e);
            // Cr?er un client factice qui ne se connectera jamais
            RedisClient::open("redis://invalid-host:6379/0").unwrap_or_else(|_| {
                // Si m?me ?a ?choue, on utilise une URL qui ne fonctionnera jamais
                RedisClient::open("redis://localhost:9999/0")
                    .expect("Impossible de cr?er un client Redis factice")
            })
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
    ));

    // ?? Initialiser l'architecture cloud massive
    let massive_load_handler = MassiveLoadHandler::new();
    let gpu_optimizer = GPUOptimizer::new();

    log::info!("?? Architecture cloud massive initialis?e");
    log::info!("? {}", massive_load_handler.get_stats().await);
    log::info!("?? {}", gpu_optimizer.get_stats());

    // Lancer la relance automatique du matching des ?changes (t?che asynchrone)
    let state_clone = app_state.clone();
    tokio::spawn(async move {
        yukpomnang_backend::tasks::matching_echange_cron::relance_matching_echanges(state_clone)
            .await;
    });

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
