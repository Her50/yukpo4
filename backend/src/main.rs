use std::{env, fs, net::SocketAddr, path::Path, sync::Arc};

use dotenvy::dotenv;
use mongodb::Client as MongoClient;
use redis::Client as RedisClient;
use sqlx::postgres::PgPoolOptions;
use tokio::sync::Mutex;

use axum::serve;
use yukpomnang_backend::{
    build_app, controllers::ia_status_controller::IAStats,
    services::app_ia::AppIA, state::AppState,
};

use yukpomnang_backend::services::gpu_optimizer::GPUOptimizer;
use yukpomnang_backend::services::massive_load_handler::MassiveLoadHandler;
use yukpomnang_backend::services::social_distribution_service;
use yukpomnang_backend::tasks;
use sqlx::PgPool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Installer un panic hook pour capturer les panics et les logger proprement
    std::panic::set_hook(Box::new(|panic_info| {
        let location = panic_info.location()
            .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()))
            .unwrap_or_else(|| "unknown location".to_string());
        
        let message = panic_info.payload()
            .downcast_ref::<&str>()
            .copied()
            .or_else(|| panic_info.payload().downcast_ref::<String>().map(|s| s.as_str()))
            .unwrap_or("unknown panic message");
        
        log::error!(
            "🚨 PANIC détecté à {}: {}",
            location,
            message
        );
        eprintln!("🚨 PANIC: {} ({})", message, location);
    }));
    
    dotenv().ok();
    yukpomnang_backend::init_logging();

    let db_url = env::var("DATABASE_URL")
        .map_err(|e| {
            log::error!("❌ DATABASE_URL manquante ou invalide: {}", e);
            e
        })?;

    let upload_storage_path =
        env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "/var/data/uploads".to_string());
    if let Err(err) = fs::create_dir_all(&upload_storage_path) {
        log::warn!("⚠️ Impossible de créer le dossier des uploads ({upload_storage_path}): {err}");
        eprintln!("⚠️ Impossible de créer le dossier des uploads ({upload_storage_path}): {err}");
    }
    if let Err(err) = fs::create_dir_all(Path::new(&upload_storage_path).join("tmp")) {
        log::warn!("⚠️ Impossible de créer le dossier temporaire des uploads: {err}");
        eprintln!("⚠️ Impossible de créer le dossier temporaire des uploads: {err}");
    }

    log::info!("🔌 Connexion à la base de données PostgreSQL...");
    
    // ✅ Optimisation du pool de connexions selon le plan de correction
    // Lecture des variables d'environnement avec valeurs par défaut optimisées
    // ✅ CORRIGÉ 2025-11-27: Augmenté pour réduire les temps d'acquisition
    let max_connections: u32 = env::var("DB_POOL_SIZE")
        .unwrap_or_else(|_| "30".to_string())
        .parse()
        .unwrap_or(30);  // ✅ Augmenté de 20 à 30 pour gérer la charge
    
    let min_connections: u32 = env::var("DB_POOL_MIN_SIZE")
        .unwrap_or_else(|_| "10".to_string())
        .parse()
        .unwrap_or(10);  // ✅ Augmenté de 5 à 10 pour maintenir plus de connexions actives
    
    let acquire_timeout_secs: u64 = env::var("DB_ACQUIRE_TIMEOUT_SECS")
        .unwrap_or_else(|_| "15".to_string())
        .parse()
        .unwrap_or(15);  // ✅ Augmenté de 10s à 15s pour éviter les timeouts
    
    let pg_pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .min_connections(min_connections)  // ✅ Maintenir un minimum de connexions
        .acquire_timeout(std::time::Duration::from_secs(acquire_timeout_secs))
        .idle_timeout(Some(std::time::Duration::from_secs(300))) // ✅ CORRIGÉ: Réduit de 600s à 300s (5 min) pour éviter les connexions mortes
        .max_lifetime(Some(std::time::Duration::from_secs(1800))) // 30 minutes max par connexion
        .test_before_acquire(true)  // ✅ Tester la connexion avant utilisation
        // ✅ CORRIGÉ 2025-11-27: Amélioration de la gestion des connexions PostgreSQL
        // - test_before_acquire permet de détecter les connexions mortes avant utilisation
        // - idle_timeout réduit pour éviter les connexions mortes qui causent "crash of another server process"
        // - Les erreurs TLS "close_notify" sont gérées par retry_query dans les contrôleurs
        // - Le pool se reconnecte automatiquement si une connexion est fermée
        .connect(&db_url)
        .await
        .map_err(|e| {
            log::error!("❌ Impossible de se connecter à PostgreSQL: {}", e);
            log::error!("   URL utilisée: {}...", db_url.chars().take(30).collect::<String>());
            log::error!("   Configuration pool: max={}, min={}, acquire_timeout={}s", 
                max_connections, min_connections, acquire_timeout_secs);
            e
        })?;
    
    log::info!(
        "✅ Connexion PostgreSQL établie (pool: max={}, min={}, acquire_timeout={}s)",
        max_connections, min_connections, acquire_timeout_secs
    );

    // ✅ NOUVEAU 2025-11-27: Pré-chauffer le pool pour avoir des connexions prêtes
    log::info!("🔥 Pré-chauffage du pool de connexions...");
    let warmup_pool = pg_pool.clone();
    let warmup_min = min_connections;
    tokio::spawn(async move {
        let mut success_count = 0;
        for i in 0..warmup_min {
            match tokio::time::timeout(
                std::time::Duration::from_secs(5),
                sqlx::query("SELECT 1").execute(&warmup_pool)
            ).await {
                Ok(Ok(_)) => {
                    success_count += 1;
                    log::debug!("[Pool Warmup] Connexion {} pré-chauffée", i + 1);
                }
                Ok(Err(e)) => {
                    log::warn!("[Pool Warmup] Erreur connexion {}: {}", i + 1, e);
                }
                Err(_) => {
                    log::warn!("[Pool Warmup] Timeout connexion {}", i + 1);
                }
            }
        }
        log::info!("✅ Pool pré-chauffé: {}/{} connexions prêtes", success_count, warmup_min);
    });

    // 🔄 Exécuter les migrations SQLx standard au démarrage
    log::info!("🚀 Application des migrations SQLx standard...");
    match sqlx::migrate!("./migrations").run(&pg_pool).await {
        Ok(_) => {
            log::info!("✅ Migrations SQLx standard appliquées avec succès");
            
            // Vérifier si la migration 20251125_fix_idx_services_search_optimized a été appliquée
            check_index_migration(&pg_pool).await;
        }
        Err(e) => {
            log::error!("❌ Erreur lors de l'application des migrations SQLx standard: {}", e);
            // On continue quand même, certaines migrations peuvent déjà être appliquées
            log::warn!("⚠️ Continuation du démarrage malgré l'erreur de migration");
        }
    }

    // 🔄 Exécuter les migrations automatiques au démarrage
    yukpomnang_backend::migrations::auto_migrate::run_auto_migrations(&pg_pool).await;

    // ✅ NOUVEAU 2025-11-27: Démarrer le monitoring de santé du pool
    yukpomnang_backend::utils::db_monitor::start_db_health_monitor(pg_pool.clone()).await;

    let mongo_url =
        env::var("MONGODB_URL").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    log::info!("🔌 Connexion à MongoDB...");
    let mongo_client = MongoClient::with_uri_str(&mongo_url)
        .await
        .map_err(|e| {
            log::error!("❌ Impossible de créer le client MongoDB: {}", e);
            e
        })?;
    log::info!("✅ Client MongoDB initialisé");

    // Configuration Redis avec test de connexion
    let mut redis_url =
        env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());

    // ✅ CORRECTION: Convertir automatiquement redis:// en rediss:// pour Upstash avec TLS
    // Note: Si l'URL a déjà rediss://, cette conversion ne fait rien
    let original_url = redis_url.clone();
    if redis_url.contains("upstash.io") && redis_url.starts_with("redis://") {
        redis_url = redis_url.replace("redis://", "rediss://");
        log::info!("✅ Redis: URL corrigée automatiquement pour Upstash TLS (redis:// → rediss://)");
        log::info!("   Avant: {}...", original_url.chars().take(50).collect::<String>());
        log::info!("   Après: {}...", redis_url.chars().take(50).collect::<String>());
    }
    
    // ✅ CORRECTION: Si l'URL utilise déjà rediss:// mais la connexion échoue,
    // le problème est probablement la feature TLS (native-tls vs rustls-tls)
    // Nous utilisons maintenant native-tls dans Cargo.toml (redis 0.26 nécessite native-tls)

    // Valider le format de l'URL Redis
    let redis_url_valid = validate_redis_url(&redis_url);
    if !redis_url_valid {
        log::warn!("⚠️ Redis: Format d'URL suspect détecté. Format attendu: redis://[user]:[password]@[host]:[port]/[db] ou rediss:// pour TLS");
        log::warn!("   URL fournie: {}...", redis_url.chars().take(50).collect::<String>());
    }
    
    // Détecter si Upstash utilise redis:// au lieu de rediss://
    if redis_url.contains("upstash.io") && redis_url.starts_with("redis://") {
        log::warn!("⚠️ Redis: Upstash détecté mais URL utilise 'redis://' au lieu de 'rediss://'");
        log::warn!("   💡 Upstash nécessite TLS. Corrigez REDIS_URL sur Render.com:");
        log::warn!("      ❌ Actuel: redis://...");
        log::warn!("      ✅ Attendu: rediss://... (avec deux 's')");
    }

    // Logger l'URL Redis utilisée (masquer le mot de passe)
    // ✅ CORRECTION: Utiliser l'URL corrigée (rediss://) pour l'affichage
    let redis_url_display = if redis_url.contains("@") {
        let parts: Vec<&str> = redis_url.split("@").collect();
        if parts.len() == 2 {
            let auth_part = parts[0].replace("redis://", "").replace("rediss://", "");
            let protocol = if redis_url.starts_with("rediss://") { "rediss://" } else { "redis://" };
            if auth_part.contains(":") {
                let user_pass: Vec<&str> = auth_part.split(":").collect();
                if user_pass.len() == 2 {
                    format!("{}{}:***@{}", protocol, user_pass[0], parts[1])
                } else {
                    format!("{}***@{}", protocol, parts[1])
                }
            } else {
                format!("{}***@{}", protocol, parts[1])
            }
        } else {
            redis_url.chars().take(50).collect::<String>()
        }
    } else {
        redis_url.chars().take(50).collect::<String>()
    };
    
    log::info!("🔍 Tentative de connexion Redis: {}...", redis_url_display);
    
    // ✅ VÉRIFICATION: Afficher un avertissement si l'URL n'a pas été convertie mais devrait l'être
    if redis_url.contains("upstash.io") && !redis_url.starts_with("rediss://") {
        log::warn!("⚠️ Redis: URL Upstash détectée mais n'utilise pas rediss:// - Conversion automatique devrait avoir eu lieu");
    }

    // Créer un client Redis et tester la connexion
    let (redis_client, redis_available_for_ws) = match RedisClient::open(redis_url.clone()) {
        Ok(client) => {
            // Tester la connexion réelle avec un timeout
            let test_conn = tokio::time::timeout(
                std::time::Duration::from_secs(5), // Augmenté à 5 secondes
                client.get_multiplexed_async_connection(),
            )
            .await;
            
            match test_conn {
                Ok(Ok(_)) => {
                    log::info!("✅ Connexion Redis établie avec succès");
                    println!("✅ Connexion Redis établie - Backend v2.1.4");
                    (client, true)
                }
                Ok(Err(e)) => {
                    let err_msg = format!("{}", e);
                    log::warn!("⚠️ Redis: Échec de connexion - URL: {}... Erreur: {}", redis_url_display, err_msg);
                    if err_msg.contains("TLS") || err_msg.contains("tls") || err_msg.contains("feature is not enabled") {
                        log::warn!("   💡 Erreur TLS détectée. Pour Upstash, utilisez 'rediss://' (avec double 's')");
                        log::warn!("      Format attendu: rediss://default:[password]@[endpoint].upstash.io:6379");
                        log::warn!("      La feature TLS a été activée dans Cargo.toml. Vérifiez votre URL Redis.");
                        log::info!("ℹ️ Redis non disponible (service optionnel). WebSocket fonctionnera sans Redis.");
                    } else if err_msg.contains("Name or service not known") || err_msg.contains("failed to lookup address") {
                        log::warn!("   💡 Problème DNS détecté. Vérifiez:");
                        log::warn!("      - Que l'endpoint Redis est correct (ex: [instance].upstash.io)");
                        log::warn!("      - Que l'URL utilise 'rediss://' (avec 's') pour Upstash avec TLS");
                        log::warn!("      - Format attendu: rediss://default:[password]@[endpoint].upstash.io:6379");
                        log::info!("ℹ️ Redis non disponible (service optionnel). WebSocket fonctionnera sans Redis.");
                    } else if err_msg.contains("Connection refused") {
                        log::warn!("   💡 Connexion refusée. Vérifiez que le serveur Redis est accessible.");
                        log::info!("ℹ️ Redis non disponible (service optionnel). WebSocket fonctionnera sans Redis.");
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
                Err(_e) => {
                    log::warn!("⚠️ Redis: Timeout de connexion (5s) - URL: {}... Vérifiez que le serveur Redis est accessible.", redis_url_display);
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
            let err_msg = format!("{}", e);
            log::error!("❌ Redis: Impossible de créer le client - URL: {}... Erreur: {}", redis_url_display, e);
            if err_msg.contains("TLS") || err_msg.contains("tls") || err_msg.contains("feature is not enabled") {
                log::warn!("   💡 Erreur TLS: Pour Upstash, utilisez 'rediss://' (avec double 's')");
                log::warn!("      Format: rediss://default:[password]@[endpoint].upstash.io:6379");
                log::warn!("      La feature TLS est maintenant activée dans Cargo.toml.");
            } else {
                log::warn!("⚠️ Erreur création client Redis: {}. Redis sera désactivé pour le WebSocket de livraison.", e);
            }
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
    log::info!("✅ Serveur lance sur http://{}", addr);
    println!("✅ Serveur lance sur http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    serve(listener, app).await?;

    Ok(())
}

/// Valide le format d'une URL Redis
fn validate_redis_url(url: &str) -> bool {
    // Vérifier que l'URL commence par redis:// ou rediss://
    if !url.starts_with("redis://") && !url.starts_with("rediss://") {
        return false;
    }
    
    // Vérifier qu'il y a au moins un ':' après le protocole
    let after_proto = if url.starts_with("rediss://") {
        &url[9..]
    } else {
        &url[8..]
    };
    
    if !after_proto.contains(':') {
        return false;
    }
    
    true
}

/// Vérifie si la migration 20251125_fix_idx_services_search_optimized a été appliquée
/// en vérifiant que l'index existe et n'inclut pas la colonne data
async fn check_index_migration(pool: &PgPool) {
    log::info!("🔍 Vérification de la migration idx_services_search_optimized...");
    
    // Vérifier si l'index existe et récupérer sa définition
    match sqlx::query_scalar::<_, Option<String>>(
        r#"
        SELECT indexdef 
        FROM pg_indexes 
        WHERE indexname = 'idx_services_search_optimized'
        LIMIT 1
        "#
    )
    .fetch_optional(pool)
    .await
    {
        Ok(Some(Some(def))) => {
            // Vérifier si l'index contient "INCLUDE (data" (ancienne version problématique)
            if def.contains("INCLUDE (data") {
                log::warn!("⚠️ [MIGRATION] idx_services_search_optimized contient encore INCLUDE (data) - La migration 20251125 n'a peut-être pas été appliquée");
                log::warn!("   Index actuel: {}", def.chars().take(150).collect::<String>());
            } else if def.contains("INCLUDE (user_id)") && !def.contains("INCLUDE (data") {
                log::info!("✅ [MIGRATION] idx_services_search_optimized correctement migré (sans INCLUDE data)");
                log::debug!("   Index: {}", def.chars().take(150).collect::<String>());
            } else {
                log::info!("ℹ️ [MIGRATION] idx_services_search_optimized existe mais structure inattendue");
                log::debug!("   Index: {}", def.chars().take(150).collect::<String>());
            }
        }
        Ok(Some(None)) | Ok(None) => {
            log::warn!("⚠️ [MIGRATION] idx_services_search_optimized n'existe pas encore");
        }
        Err(e) => {
            log::warn!("⚠️ [MIGRATION] Erreur lors de la vérification de idx_services_search_optimized: {}", e);
        }
    }
}
