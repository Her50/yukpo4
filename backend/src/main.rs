use std::{env, fs, net::SocketAddr, path::Path, sync::Arc};

use dotenvy::dotenv;
use mongodb::Client as MongoClient;
use redis::Client as RedisClient;
use sqlx::postgres::PgPoolOptions;
use tokio::sync::Mutex;

use axum::serve;
use yukpomnang_backend::{
    build_app, controllers::ia_status_controller::IAStats, services::app_ia::AppIA, state::AppState,
};

use sqlx::PgPool;
use yukpomnang_backend::services::blood_stock_monitor::BloodStockMonitor;
use yukpomnang_backend::services::gpu_optimizer::GPUOptimizer;
use yukpomnang_backend::services::massive_load_handler::MassiveLoadHandler;
use yukpomnang_backend::services::social_distribution_service;
use yukpomnang_backend::services::specialized_notifications::check_and_notify_pharmacies_on_duty;
use yukpomnang_backend::services::specialized_services_optimizer::start_optimization_task;
use yukpomnang_backend::tasks;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Installer un panic hook pour capturer les panics et les logger proprement
    std::panic::set_hook(Box::new(|panic_info| {
        let location = panic_info
            .location()
            .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()))
            .unwrap_or_else(|| "unknown location".to_string());

        let message = panic_info
            .payload()
            .downcast_ref::<&str>()
            .copied()
            .or_else(|| {
                panic_info
                    .payload()
                    .downcast_ref::<String>()
                    .map(|s| s.as_str())
            })
            .unwrap_or("unknown panic message");

        log::error!("🚨 PANIC détecté à {}: {}", location, message);
        eprintln!("🚨 PANIC: {} ({})", message, location);
    }));

    dotenv().ok();
    yukpomnang_backend::init_logging();

    let db_url = env::var("DATABASE_URL").map_err(|e| {
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

    // ✅ Phase 1 - Optimisation Pool DB pour millions de livraisons simultanées
    // ✅ OPTIMISÉ 2025-01-27: Pool augmenté pour scalabilité critique
    // Pour gérer des millions de livraisons: 200-500 connexions par instance
    // et déployer 4-8 instances avec load balancer
    let max_connections: u32 = env::var("DB_POOL_SIZE")
        .unwrap_or_else(|_| "200".to_string()) // ✅ Phase 1: Augmenté à 200 (était 100)
        .parse()
        .unwrap_or(200);

    let min_connections: u32 = env::var("DB_POOL_MIN_SIZE")
        .unwrap_or_else(|_| "20".to_string()) // ✅ Phase 1: Augmenté à 20 (était 10)
        .parse()
        .unwrap_or(20);

    let acquire_timeout_secs: u64 = env::var("DB_ACQUIRE_TIMEOUT_SECS")
        .unwrap_or_else(|_| "30".to_string()) // ✅ Phase 1: Augmenté à 30s (était 15s)
        .parse()
        .unwrap_or(30);

    // ✅ NOUVEAU 2025-12-02: Créer le pool PostgreSQL master (écritures)
    let pg_pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .min_connections(min_connections) // ✅ Maintenir un minimum de connexions
        .acquire_timeout(std::time::Duration::from_secs(acquire_timeout_secs))
        .idle_timeout(Some(std::time::Duration::from_secs(300))) // ✅ CORRIGÉ: Réduit de 600s à 300s (5 min) pour éviter les connexions mortes
        .max_lifetime(Some(std::time::Duration::from_secs(1800))) // 30 minutes max par connexion
        .test_before_acquire(true) // ✅ Tester la connexion avant utilisation
        // ✅ CORRIGÉ 2025-11-27: Amélioration de la gestion des connexions PostgreSQL
        // - test_before_acquire permet de détecter les connexions mortes avant utilisation
        // - idle_timeout réduit pour éviter les connexions mortes qui causent "crash of another server process"
        // - Les erreurs TLS "close_notify" sont gérées par retry_query dans les contrôleurs
        // - Le pool se reconnecte automatiquement si une connexion est fermée
        // ✅ OPTIMISÉ 2025-11-28: Pool augmenté pour réduire les temps d'acquisition (30 max, 10 min)
        // - Acquisition timeout augmenté à 15s pour gérer les pics de charge
        // - min_connections à 10 pour maintenir des connexions prêtes et réduire les latences
        .connect(&db_url)
        .await
        .map_err(|e| {
            log::error!("❌ Impossible de se connecter à PostgreSQL: {}", e);
            log::error!(
                "   URL utilisée: {}...",
                db_url.chars().take(30).collect::<String>()
            );
            log::error!(
                "   Configuration pool: max={}, min={}, acquire_timeout={}s",
                max_connections,
                min_connections,
                acquire_timeout_secs
            );
            e
        })?;

    log::info!(
        "✅ Connexion PostgreSQL établie (pool: max={}, min={}, acquire_timeout={}s)",
        max_connections,
        min_connections,
        acquire_timeout_secs
    );

    // ✅ NOUVEAU 2025-12-02: Créer le pool PostgreSQL read replica (lectures) si configuré
    let pg_read_pool = env::var("DATABASE_READ_REPLICA_URL")
        .ok()
        .and_then(|read_url| {
            log::info!("✅ Read replica PostgreSQL configuré - Scaling horizontal activé");
            Some(
                PgPoolOptions::new()
                    .max_connections(30) // Plus de connexions pour lectures
                    .min_connections(5)
                    .acquire_timeout(std::time::Duration::from_secs(30))
                    .idle_timeout(Some(std::time::Duration::from_secs(600)))
                    .max_lifetime(Some(std::time::Duration::from_secs(1800)))
                    .test_before_acquire(true)
                    .connect_lazy(&read_url)
                    .expect("❌ Échec de connexion à PostgreSQL read replica"),
            )
        });

    if pg_read_pool.is_none() {
        log::info!("ℹ️ Read replica PostgreSQL non configuré (DATABASE_READ_REPLICA_URL) - Utilisation du master pour toutes les opérations");
    }

    // ✅ NOUVEAU 2025-11-27: Pré-chauffer le pool pour avoir des connexions prêtes
    log::info!("🔥 Pré-chauffage du pool de connexions...");
    let warmup_pool = pg_pool.clone();
    let warmup_min = min_connections;
    tokio::spawn(async move {
        let mut success_count = 0;
        for i in 0..warmup_min {
            match tokio::time::timeout(
                std::time::Duration::from_secs(5),
                sqlx::query("SELECT 1").execute(&warmup_pool),
            )
            .await
            {
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
        log::info!(
            "✅ Pool pré-chauffé: {}/{} connexions prêtes",
            success_count,
            warmup_min
        );
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
            log::error!(
                "❌ Erreur lors de l'application des migrations SQLx standard: {}",
                e
            );
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
    let mongo_client = MongoClient::with_uri_str(&mongo_url).await.map_err(|e| {
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
        log::info!(
            "✅ Redis: URL corrigée automatiquement pour Upstash TLS (redis:// → rediss://)"
        );
        log::info!(
            "   Avant: {}...",
            original_url.chars().take(50).collect::<String>()
        );
        log::info!(
            "   Après: {}...",
            redis_url.chars().take(50).collect::<String>()
        );
    }

    // ✅ NOUVEAU: Normaliser l'URL Redis pour ajouter le numéro de base de données si absent
    // Format attendu: rediss://[user]:[password]@[host]:[port]/[db]
    // Upstash utilise généralement la base 0 par défaut
    if !redis_url.contains("/")
        || (!redis_url.ends_with("/0")
            && !redis_url.ends_with("/1")
            && !redis_url.ends_with("/2")
            && !redis_url.ends_with("/3")
            && !redis_url.ends_with("/4")
            && !redis_url.ends_with("/5")
            && !redis_url.ends_with("/6")
            && !redis_url.ends_with("/7")
            && !redis_url.ends_with("/8")
            && !redis_url.ends_with("/9"))
    {
        // Si l'URL se termine par un port sans base de données, ajouter /0
        if redis_url.matches(':').count() >= 2 && !redis_url.contains("/") {
            redis_url.push_str("/0");
            log::info!("✅ Redis: Numéro de base de données ajouté (/0)");
        } else if redis_url.ends_with('/') {
            redis_url.push_str("0");
            log::info!("✅ Redis: Numéro de base de données ajouté (0)");
        }
    }

    // ✅ CORRECTION: Si l'URL utilise déjà rediss:// mais la connexion échoue,
    // le problème est probablement la feature TLS (native-tls vs rustls-tls)
    // Nous utilisons maintenant native-tls dans Cargo.toml (redis 0.26 nécessite native-tls)

    // Valider le format de l'URL Redis
    let redis_url_valid = validate_redis_url(&redis_url);
    if !redis_url_valid {
        log::warn!("⚠️ Redis: Format d'URL suspect détecté. Format attendu: redis://[user]:[password]@[host]:[port]/[db] ou rediss:// pour TLS");
        log::warn!(
            "   URL fournie: {}...",
            redis_url.chars().take(50).collect::<String>()
        );
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
            let protocol = if redis_url.starts_with("rediss://") {
                "rediss://"
            } else {
                "redis://"
            };
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

    // Créer un client Redis et tester la connexion avec retry
    let (redis_client, redis_available_for_ws) = match RedisClient::open(redis_url.clone()) {
        Ok(client) => {
            // ✅ CORRIGÉ: Utiliser le helper Redis avec retry pour tester la connexion
            use yukpomnang_backend::utils::redis_helper;

            // Tester la connexion avec retry (3 tentatives, 1 seconde entre chaque)
            let (is_available, error_detail) = redis_helper::check_redis_health_with_error(&client).await;
            match is_available {
                true => {
                    log::info!("✅ Connexion Redis établie avec succès");
                    println!("✅ Connexion Redis établie - Backend v2.1.4");
                    (client, true)
                }
                false => {
                    log::warn!(
                        "⚠️ Redis: Échec de connexion après retry - URL: {}...",
                        redis_url_display
                    );
                    if let Some(ref err) = error_detail {
                        log::warn!("   🔍 Détails de l'erreur: {}", err);
                        // Analyser l'erreur pour donner des suggestions
                        if err.contains("TLS") || err.contains("tls") || err.contains("certificate") {
                            log::warn!("   💡 Problème TLS détecté - Vérifiez que l'URL utilise 'rediss://' (avec double 's')");
                        } else if err.contains("connection") || err.contains("Connection") || err.contains("refused") {
                            log::warn!("   💡 Problème de connexion réseau - Vérifiez:");
                            log::warn!("      - Que le serveur Redis est accessible");
                            log::warn!("      - Les credentials (username/password)");
                            log::warn!("      - Les paramètres de firewall");
                        } else if err.contains("timeout") || err.contains("Timeout") {
                            log::warn!("   💡 Timeout de connexion - Le serveur Redis peut être lent ou inaccessible");
                        }
                    }
                    log::warn!("   💡 Redis sera désactivé pour le WebSocket mais les services utiliseront retry automatique");
                    log::info!("ℹ️ Redis non disponible au démarrage (service optionnel). Les services réessayeront automatiquement.");
                    // ✅ CORRIGÉ: Utiliser le vrai client même si la connexion échoue au démarrage
                    // Le helper Redis réessayera automatiquement lors des opérations
                    (client, false)
                }
            }
        }
        Err(e) => {
            let err_msg = format!("{}", e);
            log::error!(
                "❌ Redis: Impossible de créer le client - URL: {}... Erreur: {}",
                redis_url_display,
                e
            );
            if err_msg.contains("TLS")
                || err_msg.contains("tls")
                || err_msg.contains("feature is not enabled")
            {
                log::warn!(
                    "   💡 Erreur TLS: Pour Upstash, utilisez 'rediss://' (avec double 's')"
                );
                log::warn!("      Format: rediss://default:[password]@[endpoint].upstash.io:6379");
                log::warn!("      La feature native-tls-comp est activée dans Cargo.toml pour le support TLS.");
            } else {
                log::warn!("⚠️ Erreur création client Redis: {}. Redis sera désactivé pour le WebSocket de livraison.", e);
            }
            // Créer un client factice pour les autres services
            let dummy_client =
                RedisClient::open("redis://invalid-host:6379/0").unwrap_or_else(|_| {
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

    // ✅ Cloner redis_client pour le healthcheck avant de le déplacer dans AppState
    let redis_client_healthcheck = redis_client.clone();

    let app_state = Arc::new(AppState::new(
        pg_pool,
        pg_read_pool, // ✅ NOUVEAU 2025-12-02: Read replica pour scaling horizontal
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

    // ✅ NOUVEAU 2025-01-28: Lancer la tâche de notifications pour nouveaux matchings emploi (toutes les 6 heures)
    let pool_clone_matching = Arc::new(app_state.pg.clone());
    tokio::spawn(async move {
        yukpomnang_backend::tasks::matching_emploi_notifications::start_matching_notifications_task(
            pool_clone_matching,
        )
        .await;
    });

    // ✅ Lancer le nettoyage périodique des rooms/ingress LiveKit/SRS
    tasks::livekit_cleanup::start_livekit_cleanup_task(app_state.clone());
    // ✅ Lancer la synchronisation des analytics LiveKit
    tasks::live_analytics::start_live_analytics_task(app_state.clone());
    // ✅ Scheduler pour les ventes flash live
    tasks::live_flash_sale_scheduler::start_flash_sale_scheduler(app_state.clone());

    // ✅ NOUVEAU: Worker de traitement des réservations Flash Sales
    if let (Some(flash_sale_cache), Some(_flash_sale_queue)) = (
        app_state.flash_sale_cache.clone(),
        app_state.flash_sale_queue.clone(),
    ) {
        // Créer une nouvelle instance de FlashSaleCache pour le worker
        use yukpomnang_backend::services::flash_sale_cache::FlashSaleCache;
        let redis_client_arc = Arc::new(app_state.redis_client.clone());
        let cache_for_worker = FlashSaleCache::new(
            redis_client_arc.clone()
        );
        let worker = tasks::flash_sale_queue_worker::FlashSaleQueueWorker::new(
            redis_client_arc.clone(),
            Arc::new(app_state.pg.clone()),
            cache_for_worker,
        );
        tokio::spawn(async move {
            if let Err(e) = worker.start().await {
                log::error!("❌ Flash Sale Queue Worker error: {:?}", e);
            }
        });
        log::info!("✅ Flash Sale Queue Worker démarré");
    } else {
        log::warn!("⚠️ Flash Sale Queue Worker non démarré (cache ou queue non disponible)");
    }

    // ✅ NOUVEAU: Worker de traitement des notifications asynchrones
    if let Some(_notification_queue) = app_state.notification_queue.clone() {
        let redis_client_arc = Arc::new(app_state.redis_client.clone());
        let worker = tasks::notification_queue_worker::NotificationQueueWorker::new(
            redis_client_arc,
            Arc::new(app_state.pg.clone()),
        );
        tokio::spawn(async move {
            if let Err(e) = worker.start().await {
                log::error!("❌ Notification Queue Worker error: {:?}", e);
            }
        });
        log::info!("✅ Notification Queue Worker démarré");
    } else {
        log::warn!("⚠️ Notification Queue Worker non démarré (queue non disponible)");
    }

    // ✅ Phase 6.1: Cron job pour vérifier et notifier les pharmacies de garde
    // Vérifie toutes les heures si des pharmacies sont de garde
    let pharmacy_pool = Arc::new(app_state.pg.clone());
    tokio::spawn(async move {
        use tokio::time::{interval, Duration};
        let mut interval = interval(Duration::from_secs(3600)); // 1 heure

        // Exécuter immédiatement au démarrage
        if let Err(e) = check_and_notify_pharmacies_on_duty(pharmacy_pool.clone()).await {
            log::error!("[Main] Erreur vérification pharmacies de garde: {}", e);
        }

        loop {
            interval.tick().await;
            log::info!("[Main] 🔔 Vérification pharmacies de garde...");
            if let Err(e) = check_and_notify_pharmacies_on_duty(pharmacy_pool.clone()).await {
                log::error!("[Main] Erreur vérification pharmacies de garde: {}", e);
            }
        }
    });

    // ✅ Phase 7: Tâche d'optimisation périodique
    start_optimization_task(Arc::new(app_state.pg.clone()), app_state.clone());
    // ✅ Scheduler pour les campagnes promos globales (Black Friday, etc.)
    tasks::global_promo_scheduler::start_global_promo_scheduler(app_state.clone());
    // ✅ Worker pipeline health (alerting interne)
    tasks::pipeline_health_worker::start_pipeline_health_worker(app_state.clone());
    // ✅ Matching temps réel
    tasks::delivery_matching_worker::start_delivery_matching_worker(app_state.clone());
    // ✅ Surveillance SLA
    tasks::delivery_sla_monitor::start_delivery_sla_monitor(app_state.clone());
    // ✅ Monitor des timeouts de validation d'étapes
    tokio::spawn(
        tasks::delivery_timeout_monitor::start_delivery_timeout_monitor(app_state.clone()),
    );
    // ✅ Monitor des timeouts de validation de commandes
    tokio::spawn(tasks::order_timeout_monitor::start_order_timeout_monitor(
        app_state.clone(),
    ));
    // ✅ Phase 2 : Archivage automatique des livraisons complétées
    tasks::delivery_archive_worker::start_delivery_archive_worker(app_state.clone());

    // ✅ NOUVEAU: Healthcheck périodique Redis pour détecter les changements d'état
    // ✅ CORRIGÉ: Réduit la fréquence à toutes les 5 minutes (au lieu de chaque minute)
    // Le cache interne de check_redis_health gère déjà les logs de changement d'état
    tokio::spawn(async move {
        use yukpomnang_backend::utils::redis_helper;
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // Toutes les 5 minutes

        loop {
            interval.tick().await;
            // La fonction check_redis_health gère déjà les logs de changement d'état
            let _ = redis_helper::check_redis_health(&redis_client_healthcheck).await;
        }
    });

    // ✅ Tâches de recalcul périodique des statistiques (Phase 6)
    let pool_clone_category_stats = Arc::new(app_state.pg.clone());
    tokio::spawn(async move {
        tasks::stats_recalculation::start_category_stats_recalculation_task(
            pool_clone_category_stats,
        )
        .await;
    });

    let pool_clone_cancellation_stats = Arc::new(app_state.pg.clone());
    tokio::spawn(async move {
        tasks::stats_recalculation::start_product_cancellation_stats_recalculation_task(
            pool_clone_cancellation_stats,
        )
        .await;
    });

    // ✅ NOUVEAU 2025-12-02: Refresh automatique de la vue matérialisée de recherche
    tasks::search_cache_refresh::start_search_cache_refresh_task(app_state.pg.clone());

    // ✅ NOUVEAU: Refresh automatique de la vue matérialisée Black Friday (toutes les 30 secondes)
    let pool_clone_blackfriday = Arc::new(app_state.pg.clone());
    tokio::spawn(async move {
        use tokio::time::{interval, Duration};
        let mut interval_blackfriday = interval(Duration::from_secs(30)); // Toutes les 30 secondes

        loop {
            interval_blackfriday.tick().await;
            log::debug!("🔄 Refresh de global_promo_catalog_cache...");
            if let Err(e) = sqlx::query(
                "REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS global_promo_catalog_cache",
            )
            .execute(&*pool_clone_blackfriday)
            .await
            {
                log::warn!("⚠️ Erreur refresh global_promo_catalog_cache: {}", e);
            } else {
                log::debug!("✅ global_promo_catalog_cache refreshed");
            }
        }
    });

    // ✅ NOUVEAU 2025-12-01: Refresh automatique des vues matérialisées de scalabilité
    let pool_clone_matviews = Arc::new(app_state.pg.clone());
    tokio::spawn(async move {
        use std::sync::atomic::{AtomicU64, Ordering};
        use tokio::time::{interval, Duration};

        let mut interval_services = interval(Duration::from_secs(300)); // Toutes les 5 minutes pour services_search_cache
        let mut interval_products = interval(Duration::from_secs(600)); // Toutes les 10 minutes pour active_products_cache

        loop {
            tokio::select! {
                _ = interval_services.tick() => {
                    log::info!("🔄 Refresh de services_search_cache...");
                    if let Err(e) = sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS services_search_cache")
                        .execute(&*pool_clone_matviews)
                        .await
                    {
                        log::warn!("⚠️ Erreur refresh services_search_cache: {}", e);
                    } else {
                        log::info!("✅ services_search_cache refreshed");
                    }
                }
                _ = interval_products.tick() => {
                    log::info!("🔄 Refresh de active_products_cache...");
                    if let Err(e) = sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS active_products_cache")
                        .execute(&*pool_clone_matviews)
                        .await
                    {
                        log::warn!("⚠️ Erreur refresh active_products_cache: {}", e);
                    } else {
                        log::info!("✅ active_products_cache refreshed");
                    }
                }
            }
        }
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
        "#,
    )
    .fetch_optional(pool)
    .await
    {
        Ok(Some(Some(def))) => {
            // Vérifier si l'index contient "INCLUDE (data" (ancienne version problématique)
            if def.contains("INCLUDE (data") {
                log::warn!("⚠️ [MIGRATION] idx_services_search_optimized contient encore INCLUDE (data) - La migration 20251125 n'a peut-être pas été appliquée");
                log::warn!(
                    "   Index actuel: {}",
                    def.chars().take(150).collect::<String>()
                );
            } else if def.contains("INCLUDE (user_id)") && !def.contains("INCLUDE (data") {
                log::info!("✅ [MIGRATION] idx_services_search_optimized correctement migré (sans INCLUDE data)");
                log::debug!("   Index: {}", def.chars().take(150).collect::<String>());
            } else {
                log::info!(
                    "ℹ️ [MIGRATION] idx_services_search_optimized existe mais structure inattendue"
                );
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
