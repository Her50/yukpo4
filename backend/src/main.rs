use std::{env, net::SocketAddr, sync::Arc};

use dotenvy::dotenv;
use mongodb::Client as MongoClient;
use redis::Client as RedisClient;
use sqlx::postgres::PgPoolOptions;
use tokio::sync::Mutex;

use yukpomnang_backend::{
    build_app,
    state::AppState,
    services::app_ia::AppIA,
    controllers::ia_status_controller::IAStats,
};
use axum::serve;

use yukpomnang_backend::services::massive_load_handler::MassiveLoadHandler;
use yukpomnang_backend::services::gpu_optimizer::GPUOptimizer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    yukpomnang_backend::init_logging();

    let db_url = env::var("DATABASE_URL")?;
    let pg_pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    let mongo_url = env::var("MONGODB_URL")
        .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let mongo_client = MongoClient::with_uri_str(&mongo_url).await?;

    // Configuration Redis temporaire - utiliser une URL factice pour ?viter les erreurs
    let redis_url = env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());
    
    // Cr?er un client Redis avec gestion d'erreur
    let redis_client = match RedisClient::open(redis_url) {
        Ok(client) => {
            println!("? Connexion Redis ?tablie");
            client
        }
        Err(e) => {
            println!("??  Erreur Redis: {}. Utilisation d'un client factice.", e);
            // Cr?er un client factice qui ne se connectera jamais
            RedisClient::open("redis://invalid-host:6379/0").unwrap_or_else(|_| {
                // Si m?me ?a ?choue, on utilise une URL qui ne fonctionnera jamais
                RedisClient::open("redis://localhost:9999/0").expect("Impossible de cr?er un client Redis factice")
            })
        }
    };

    let ia_stats = Arc::new(Mutex::new(IAStats::default()));
    let app_ia = Arc::new(AppIA::new(redis_client.clone(), ia_stats.clone(), pg_pool.clone()));

    let app_state = Arc::new(AppState::new(pg_pool, mongo_client, app_ia, ia_stats, redis_client));

    // ?? Initialiser l'architecture cloud massive
    let massive_load_handler = MassiveLoadHandler::new();
    let gpu_optimizer = GPUOptimizer::new();

    log::info!("?? Architecture cloud massive initialis?e");
    log::info!("? {}", massive_load_handler.get_stats().await);
    log::info!("?? {}", gpu_optimizer.get_stats());

    // Lancer la relance automatique du matching des ?changes (t?che asynchrone)
    let state_clone = app_state.clone();
    tokio::spawn(async move {
        yukpomnang_backend::tasks::matching_echange_cron::relance_matching_echanges(state_clone).await;
    });

    // Construction de l'application avec Extension
    let app = build_app(app_state.clone())
        //.merge(yukpomnang_backend::openapi::swagger_router()) // Swagger d?sactiv? temporairement
        .with_state(app_state.clone());

    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    println!("?? Serveur lanc? sur http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    serve(listener, app).await?;

    Ok(())
}
