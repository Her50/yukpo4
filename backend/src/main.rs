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

    let mut db_url = env::var("DATABASE_URL").map_err(|e| {
        log::error!("❌ DATABASE_URL manquante ou invalide: {}", e);
        e
    })?;

    // ✅ CORRIGÉ RACINE 2025-12-11: Ajouter sslmode=require pour Render PostgreSQL
    // Render PostgreSQL nécessite SSL/TLS pour toutes les connexions
    // Le vrai problème: Render ferme les connexions idle après ~5 minutes
    // Solution: Réduire max_lifetime à 4 minutes pour renouveler avant fermeture
    if !db_url.contains("sslmode=") {
        let separator = if db_url.contains('?') { "&" } else { "?" };
        db_url.push_str(&format!("{}sslmode=require", separator));
        log::info!(
            "🔧 Paramètre sslmode=require ajouté à DATABASE_URL (requis pour Render PostgreSQL)"
        );
    }

    // ✅ CRITIQUE RACINE: Render ferme les connexions idle après ~5 minutes
    // Les keepalives TCP dans l'URL ne fonctionnent pas avec sqlx/tokio-postgres
    // La vraie solution: Renouveler les connexions AVANT que Render ne les ferme
    // On configure max_lifetime à 4 minutes (240s) pour renouveler avant la fermeture Render

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

    // ✅ CORRIGÉ RACINE 2025-12-11: Pool réduit pour éviter surcharge PostgreSQL
    // Le problème: 300 connexions max surcharge Render PostgreSQL et cause des crashes
    // Render PostgreSQL a une limite de ~50-100 connexions selon le plan
    // Solution: Réduire à 50 max pour éviter les crashes "terminating connection because of crash"
    let max_connections: u32 = env::var("DB_POOL_SIZE")
        .unwrap_or_else(|_| "50".to_string()) // ✅ CORRIGÉ RACINE: Réduit de 300 à 50 pour éviter surcharge PostgreSQL
        .parse()
        .unwrap_or(50);

    let min_connections: u32 = env::var("DB_POOL_MIN_SIZE")
        .unwrap_or_else(|_| "5".to_string()) // ✅ CORRIGÉ RACINE: Réduit de 20 à 5 pour éviter surcharge au démarrage
        .parse()
        .unwrap_or(5);

    let acquire_timeout_secs: u64 = env::var("DB_ACQUIRE_TIMEOUT_SECS")
        .unwrap_or_else(|_| "30".to_string()) // ✅ Phase 1: Augmenté à 30s (était 15s)
        .parse()
        .unwrap_or(30);

    // ✅ NOUVEAU 2025-12-02: Créer le pool PostgreSQL master (écritures)
    // ✅ AMÉLIORÉ 2025-12-11: Configuration optimisée pour prévenir les erreurs TLS
    // ✅ CORRIGÉ RACINE 2025-12-11: Configuration robuste pour gérer les crashes PostgreSQL et fermetures brutales
    // ✅ CORRIGÉ RACINE 2025-12-11: Retry logic pour connexion initiale (gère les crashes PostgreSQL temporaires)
    let pg_pool = {
        let mut last_error = None;
        let mut connected = false;
        let mut pool_opt = None;
        
        // Retry jusqu'à 3 fois avec backoff exponentiel
        for attempt in 1..=3 {
            match PgPoolOptions::new()
                .max_connections(max_connections)
                .min_connections(min_connections)
                .acquire_timeout(std::time::Duration::from_secs(acquire_timeout_secs))
                .idle_timeout(Some(std::time::Duration::from_secs(180)))
                .max_lifetime(Some(std::time::Duration::from_secs(240)))
                .test_before_acquire(true)
                .after_connect(|conn, _meta| {
                    Box::pin(async move {
                        if let Err(e) = sqlx::query("SET statement_timeout = 0")
                            .execute(&mut *conn)
                            .await {
                            let error_msg = e.to_string();
                            if error_msg.contains("TLS") 
                                || error_msg.contains("close_notify")
                                || error_msg.contains("Connection reset")
                                || error_msg.contains("peer closed") {
                                log::debug!(
                                    "⚠️ Configuration statement_timeout échouée (connexion sera testée avant utilisation): {}",
                                    error_msg
                                );
                            }
                        }
                        let _ = sqlx::query("SET idle_in_transaction_session_timeout = '600s'")
                            .execute(&mut *conn)
                            .await;
                        Ok(())
                    })
                })
                .connect(&db_url)
                .await
            {
                Ok(pool) => {
                    log::info!("✅ Connexion PostgreSQL établie (tentative {}/3)", attempt);
                    pool_opt = Some(pool);
                    connected = true;
                    break;
                }
                Err(e) => {
                    last_error = Some(e);
                    if attempt < 3 {
                        let delay_secs = 2_u64.pow(attempt); // 2s, 4s, 8s
                        log::warn!(
                            "⚠️ Échec connexion PostgreSQL (tentative {}/3), retry dans {}s...",
                            attempt,
                            delay_secs
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(delay_secs)).await;
                    }
                }
            }
        }
        
        if !connected {
            let e = last_error.unwrap();
            log::error!("❌ Impossible de se connecter à PostgreSQL après 3 tentatives: {}", e);
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
            return Err(Box::new(e) as Box<dyn std::error::Error>);
        }
        
        pool_opt.unwrap()
    };

    log::info!(
        "✅ Connexion PostgreSQL établie (pool: max={}, min={}, acquire_timeout={}s)",
        max_connections,
        min_connections,
        acquire_timeout_secs
    );

    // ✅ CORRIGÉ 2025-12-11: Créer TOUJOURS un pool séparé pour les opérations longues
    // Même si DATABASE_URL_LONG_OPS n'est pas défini, on crée un pool séparé avec la même URL
    // Cela évite que les REFRESH MATERIALIZED VIEW bloquent le pool principal
    let long_ops_url = env::var("DATABASE_URL_LONG_OPS").unwrap_or_else(|_| db_url.clone());
    // ✅ CORRIGÉ RACINE 2025-12-11: Pool séparé pour opérations longues (REFRESH MATERIALIZED VIEW)
    // ✅ CORRIGÉ RACINE: Réduit à 5 max pour éviter surcharge PostgreSQL (les refreshes doivent être sérialisés)
    // Le problème: Plusieurs REFRESH MATERIALIZED VIEW simultanés surchargent PostgreSQL et causent des crashes
    // Solution: Limiter à 5 connexions max et utiliser un mutex global pour sérialiser les refreshes
    let pg_pool_long_ops = match PgPoolOptions::new()
        .max_connections(5) // ✅ CORRIGÉ RACINE: Réduit de 20 à 5 pour éviter surcharge (refreshes doivent être sérialisés)
        .min_connections(2) // ✅ CORRIGÉ RACINE: Réduit de 5 à 2 pour éviter surcharge au démarrage
        .acquire_timeout(std::time::Duration::from_secs(120)) // ✅ Timeout plus long pour opérations longues
        .idle_timeout(Some(std::time::Duration::from_secs(300))) // ✅ CORRIGÉ: 5 min (réduit de 10 min) pour détecter tôt les connexions mortes
        .max_lifetime(Some(std::time::Duration::from_secs(240))) // ✅ CORRIGÉ: 4 min (réduit de 1h) pour renouveler AVANT que Render ne ferme (~5 min)
        .test_before_acquire(true) // ✅ CORRIGÉ: OBLIGATOIRE pour détecter les connexions mortes (crashes PostgreSQL)
        .after_connect(|conn, _meta| {
            // ✅ CORRIGÉ RACINE 2025-12-11: Configuration tolérante aux erreurs (comme pool principal)
            // Le VRAI problème: Si after_connect échoue, la connexion n'est PAS ajoutée au pool
            // → Le pool se vide → timeouts d'acquisition → erreurs de connexion
            // Solution: Ne jamais faire échouer after_connect, même si la config partielle échoue
            Box::pin(async move {
                // ✅ CRITIQUE: Configuration tolérante - on essaie de configurer mais on n'échoue JAMAIS
                // Même si la configuration échoue, la connexion est valide et sera ajoutée au pool
                
                // ✅ Configuration 1: statement_timeout (optionnel - si échoue, on continue)
                if let Err(e) = sqlx::query("SET statement_timeout = 0")
                    .execute(&mut *conn)
                    .await {
                    let error_msg = e.to_string();
                    if error_msg.contains("TLS") 
                        || error_msg.contains("close_notify")
                        || error_msg.contains("Connection reset")
                        || error_msg.contains("peer closed") {
                        log::debug!(
                            "⚠️ Configuration statement_timeout échouée pour pool long_ops (connexion sera testée avant utilisation): {}",
                            error_msg
                        );
                    }
                }
                
                // ✅ Configuration 2: idle_in_transaction_session_timeout (optionnel)
                let _ = sqlx::query("SET idle_in_transaction_session_timeout = '1800s'")
                    .execute(&mut *conn)
                    .await;
                
                // ✅ CRITIQUE: Toujours retourner Ok() pour que la connexion soit ajoutée au pool
                Ok(())
            })
        })
        .connect(&long_ops_url)
        .await
    {
        Ok(pool) => {
            log::info!("✅ Pool PostgreSQL longues opérations créé (max=10, min=2)");
            Some(pool)
        }
        Err(e) => {
            log::warn!("⚠️ Impossible de créer le pool longues opérations: {}, utilisation du pool principal", e);
            None
        }
    };

    // ✅ NOUVEAU 2025-12-02: Créer le pool PostgreSQL read replica (lectures) si configuré
    let pg_read_pool = env::var("DATABASE_READ_REPLICA_URL")
        .ok()
        .and_then(|read_url| {
            // ✅ CORRIGÉ: Valider l'URL avant de créer le pool
            if read_url.trim().is_empty() {
                log::debug!("ℹ️ DATABASE_READ_REPLICA_URL est vide - Read replica désactivé");
                return None;
            }

            // Vérifier que l'URL est absolue (commence par postgresql:// ou postgres://)
            if !read_url.starts_with("postgresql://") && !read_url.starts_with("postgres://") {
                log::error!("❌ DATABASE_READ_REPLICA_URL invalide: URL doit commencer par 'postgresql://' ou 'postgres://'");
                log::error!("   URL fournie: {}...", read_url.chars().take(50).collect::<String>());
                return None;
            }

            log::info!("✅ Read replica PostgreSQL configuré - Scaling horizontal activé");

            // ✅ CORRIGÉ: Utiliser connect_lazy avec gestion d'erreur au lieu de expect
            match PgPoolOptions::new()
                .max_connections(30) // Plus de connexions pour lectures
                .min_connections(5)
                .acquire_timeout(std::time::Duration::from_secs(30))
                .idle_timeout(Some(std::time::Duration::from_secs(600)))
                .max_lifetime(Some(std::time::Duration::from_secs(1800)))
                .test_before_acquire(true)
                .connect_lazy(&read_url)
            {
                Ok(pool) => Some(pool),
                Err(e) => {
                    log::error!("❌ Échec de connexion à PostgreSQL read replica: {}", e);
                    log::error!("   URL utilisée: {}...", read_url.chars().take(50).collect::<String>());
                    log::warn!("⚠️ Read replica désactivé - Utilisation du master pour toutes les opérations");
                    None
                }
            }
        });

    if pg_read_pool.is_none() {
        log::info!("ℹ️ Read replica PostgreSQL non configuré (DATABASE_READ_REPLICA_URL) - Utilisation du master pour toutes les opérations");
    }

    // ✅ NOUVEAU 2025-11-27: Pré-chauffer le pool pour avoir des connexions prêtes
    log::info!("🔥 Pré-chauffage du pool de connexions...");
    let warmup_pool = pg_pool.clone();
    let warmup_min = min_connections;
    let _ = tokio::spawn(async move {
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
            let error_str = e.to_string();
            // Ignorer l'erreur de checksum mismatch pour la migration 0 (fichier modifié)
            if error_str.contains("migration 0 was previously applied but has been modified") {
                log::debug!("ℹ️ Migration 0 modifiée détectée (ignorée) - Si nécessaire, supprimez l'entrée de _sqlx_migrations pour la migration 0");
            } else {
                log::error!(
                    "❌ Erreur lors de l'application des migrations SQLx standard: {}",
                    e
                );
            }
            // On continue quand même, certaines migrations peuvent déjà être appliquées
            log::debug!("ℹ️ Continuation du démarrage malgré l'erreur de migration");
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
            let (is_available, error_detail) =
                redis_helper::check_redis_health_with_error(&client).await;
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
                        if err.contains("TLS") || err.contains("tls") || err.contains("certificate")
                        {
                            log::warn!("   💡 Problème TLS détecté - Vérifiez que l'URL utilise 'rediss://' (avec double 's')");
                        } else if err.contains("connection")
                            || err.contains("Connection")
                            || err.contains("refused")
                        {
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
    let _ = tokio::spawn(async move {
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
    let _ = tokio::spawn(async move {
        yukpomnang_backend::tasks::publicite_expiration::start_publicite_expiration_task(
            pool_clone_pub,
        )
        .await;
    });

    // ✅ NOUVEAU 2025-01-28: Lancer la tâche de notifications pour nouveaux matchings emploi (toutes les 6 heures)
    let pool_clone_matching = Arc::new(app_state.pg.clone());
    let _ = tokio::spawn(async move {
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
    if let (Some(_flash_sale_cache), Some(_flash_sale_queue)) = (
        app_state.flash_sale_cache.clone(),
        app_state.flash_sale_queue.clone(),
    ) {
        // Créer une nouvelle instance de FlashSaleCache pour le worker
        use yukpomnang_backend::services::flash_sale_cache::FlashSaleCache;
        let redis_client_arc = Arc::new(app_state.redis_client.clone());
        let cache_for_worker = FlashSaleCache::new(redis_client_arc.clone());
        let worker = tasks::flash_sale_queue_worker::FlashSaleQueueWorker::new(
            redis_client_arc.clone(),
            Arc::new(app_state.pg.clone()),
            cache_for_worker,
        );
        let _ = tokio::spawn(async move {
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
        let _ = tokio::spawn(async move {
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
    let _ = tokio::spawn(async move {
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
    let pool_clone_optimization = Arc::new(app_state.pg.clone());
    let app_state_clone_optimization = app_state.clone();
    let _ = tokio::spawn(async move {
        start_optimization_task(pool_clone_optimization, app_state_clone_optimization).await;
    });
    // ✅ Scheduler pour les campagnes promos globales (Black Friday, etc.)
    tasks::global_promo_scheduler::start_global_promo_scheduler(app_state.clone());
    // ✅ Worker pipeline health (alerting interne)
    tasks::pipeline_health_worker::start_pipeline_health_worker(app_state.clone());
    // ✅ Matching temps réel
    tasks::delivery_matching_worker::start_delivery_matching_worker(app_state.clone());
    // ✅ Surveillance SLA
    tasks::delivery_sla_monitor::start_delivery_sla_monitor(app_state.clone());
    // ✅ Monitor des timeouts de validation d'étapes
    let _ = tokio::spawn(
        tasks::delivery_timeout_monitor::start_delivery_timeout_monitor(app_state.clone()),
    );
    // ✅ Monitor des timeouts de validation de commandes
    let _ = tokio::spawn(tasks::order_timeout_monitor::start_order_timeout_monitor(
        app_state.clone(),
    ));
    // ✅ Phase 2 : Archivage automatique des livraisons complétées
    tasks::delivery_archive_worker::start_delivery_archive_worker(app_state.clone());

    // ✅ NOUVEAU: Healthcheck périodique Redis pour détecter les changements d'état
    // ✅ CORRIGÉ: Réduit la fréquence à toutes les 5 minutes (au lieu de chaque minute)
    // Le cache interne de check_redis_health gère déjà les logs de changement d'état
    let _ = tokio::spawn(async move {
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
    let _ = tokio::spawn(async move {
        tasks::stats_recalculation::start_category_stats_recalculation_task(
            pool_clone_category_stats,
        )
        .await;
    });

    let pool_clone_cancellation_stats = Arc::new(app_state.pg.clone());
    let _ = tokio::spawn(async move {
        tasks::stats_recalculation::start_product_cancellation_stats_recalculation_task(
            pool_clone_cancellation_stats,
        )
        .await;
    });

    // ✅ CORRIGÉ RACINE 2025-12-11: Mutex GLOBAL pour sérialiser TOUS les REFRESH MATERIALIZED VIEW
    // Le problème: Plusieurs REFRESH simultanés surchargent PostgreSQL et causent des crashes
    // Solution: Un seul mutex global pour sérialiser tous les refreshes (un à la fois)
    let refresh_lock_global = Arc::new(Mutex::new(()));

    // ✅ CORRIGÉ RACINE 2025-12-11: Refresh automatique de la vue matérialisée de recherche
    // Utilise le pool séparé pour éviter de bloquer le pool principal (refresh prend 8-13s)
    let pool_clone_search_cache = app_state.pg.clone();
    let pool_long_ops_search_cache = pg_pool_long_ops.as_ref().map(|p| Arc::new(p.clone()));
    let refresh_lock_search = refresh_lock_global.clone();
    let _ = tokio::spawn(async move {
        tasks::search_cache_refresh::start_search_cache_refresh_task(
            pool_long_ops_search_cache,
            pool_clone_search_cache,
            refresh_lock_search, // ✅ Passer le mutex global pour sérialiser
        ).await;
    });

    // ✅ CORRIGÉ RACINE 2025-12-11: Refresh automatique de la vue matérialisée Black Friday
    // Utilise le pool séparé pour éviter de bloquer le pool principal
    // Intervalle augmenté à 5 minutes (était 60s) pour réduire la charge
    let pool_clone_blackfriday = Arc::new(app_state.pg.clone());
    let pool_long_ops_blackfriday = pg_pool_long_ops.clone();
    let refresh_lock_blackfriday = refresh_lock_global.clone(); // ✅ Utiliser le mutex global
    let _ = tokio::spawn(async move {
        use tokio::time::{interval, Duration};

        // ✅ CORRIGÉ RACINE 2025-12-11: Intervalle augmenté à 5 minutes (était 60s)
        // Configurable via variable d'environnement (défaut: 300s = 5 min)
        let refresh_interval_secs: u64 = std::env::var("GLOBAL_PROMO_CACHE_REFRESH_INTERVAL_SECS")
            .unwrap_or_else(|_| "300".to_string())
            .parse()
            .unwrap_or(300);

        // ✅ CORRIGÉ RACINE: Utiliser le pool séparé pour opérations longues
        let pool_for_refresh = if let Some(ref long_ops_pool) = pool_long_ops_blackfriday {
            Arc::new(long_ops_pool.clone())
        } else {
            pool_clone_blackfriday.clone()
        };

        let mut interval_blackfriday = interval(Duration::from_secs(refresh_interval_secs));
        log::info!(
            "🔄 Refresh global_promo_catalog_cache configuré: intervalle = {}s (5 min) - Utilise pool séparé",
            refresh_interval_secs
        );

        loop {
            interval_blackfriday.tick().await;
            // ✅ CRITIQUE: Acquérir le mutex global AVANT le refresh pour sérialiser
            let _lock = refresh_lock_blackfriday.lock().await;
            log::debug!("🔄 Refresh de global_promo_catalog_cache...");
            // PostgreSQL ne supporte pas IF EXISTS avec REFRESH MATERIALIZED VIEW CONCURRENTLY
            // Vérifier d'abord si la vue existe (utilise pool principal pour cette requête rapide)
            let view_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'global_promo_catalog_cache')"
            )
            .fetch_one(&*pool_clone_blackfriday)
            .await
            .unwrap_or(false);

            if view_exists {
                // ✅ CRITIQUE RACINE 2025-12-11: Vérifier que l'index unique existe AVANT d'exécuter REFRESH CONCURRENTLY
                // Le problème: REFRESH CONCURRENTLY sans index unique peut causer des crashes PostgreSQL
                let has_unique_index = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS (
                        SELECT 1 FROM pg_indexes 
                        WHERE tablename = 'global_promo_catalog_cache' 
                        AND indexname = 'idx_global_promo_catalog_cache_entry_id'
                    )"
                )
                .fetch_one(&*pool_clone_blackfriday)
                .await
                .unwrap_or(false);

                if !has_unique_index {
                    log::warn!("⚠️ global_promo_catalog_cache n'a pas d'index unique - REFRESH CONCURRENTLY ignoré (peut causer crash PostgreSQL)");
                } else {
                    let start_time = std::time::Instant::now();
                    // ✅ CORRIGÉ RACINE: Utiliser pool séparé pour REFRESH (opération longue)
                    if let Err(e) =
                        sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY global_promo_catalog_cache")
                            .execute(&*pool_for_refresh)
                            .await
                    {
                        let error_str = e.to_string().to_lowercase();
                        // ✅ CORRECTION: Ignorer silencieusement les erreurs attendues
                        if error_str.contains("cannot refresh materialized view concurrently") {
                            log::debug!("ℹ️ global_promo_catalog_cache déjà en cours de refresh");
                        } else if error_str.contains("does not have a unique index") {
                            log::warn!("⚠️ global_promo_catalog_cache nécessite un index unique pour REFRESH CONCURRENTLY");
                        } else {
                            log::warn!("⚠️ Erreur refresh global_promo_catalog_cache: {}", e);
                        }
                } else {
                    let elapsed = start_time.elapsed();
                    log::debug!("✅ global_promo_catalog_cache refreshed en {:?}", elapsed);
                    // ✅ OPTIMISÉ: Logger un debug si le refresh prend plus de 1 seconde (pas un warning)
                    if elapsed.as_millis() > 1000 {
                        log::debug!(
                            "ℹ️ Refresh global_promo_catalog_cache lent: {:?} (> 1s)",
                            elapsed
                        );
                    }
                }
            } else {
                log::debug!("⚠️ Vue global_promo_catalog_cache n'existe pas encore");
            }
        }
    });

    // ✅ CORRECTION RACINE: Refresh automatique des vues matérialisées avec mutex GLOBAL pour éviter refresh concurrents
    // ✅ CRITIQUE: Utiliser le mutex global créé plus haut pour sérialiser TOUS les refreshes
    let pool_clone_matviews = Arc::new(app_state.pg.clone());
    let pool_long_ops_for_refresh = pg_pool_long_ops.clone();
    let refresh_lock_services = refresh_lock_global.clone(); // Réutiliser le mutex global
    let refresh_lock_products = refresh_lock_global.clone(); // Réutiliser le mutex global
    let _ = tokio::spawn(async move {
        use tokio::time::{interval, Duration};

        // ✅ OPTIMISÉ 2025-12-10: Utiliser un pool séparé pour les opérations longues si disponible
        let pool_for_refresh = if let Some(ref long_ops_pool) = pool_long_ops_for_refresh {
            Arc::new(long_ops_pool.clone())
        } else {
            pool_clone_matviews.clone()
        };

        let mut interval_services = interval(Duration::from_secs(300)); // Toutes les 5 minutes pour services_search_cache
        let mut interval_products = interval(Duration::from_secs(600)); // Toutes les 10 minutes pour active_products_cache

        loop {
            tokio::select! {
                _ = interval_services.tick() => {
                    // ✅ CORRECTION RACINE: Utiliser mutex pour éviter refresh concurrents
                    let _lock = refresh_lock_services.lock().await;
                    log::info!("🔄 Refresh de services_search_cache...");
                    // PostgreSQL ne supporte pas IF EXISTS avec REFRESH MATERIALIZED VIEW CONCURRENTLY
                    let view_exists = sqlx::query_scalar::<_, bool>(
                        "SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_cache')"
                    )
                    .fetch_one(&*pool_clone_matviews)
                    .await
                    .unwrap_or(false);

                    if view_exists {
                        // ✅ CRITIQUE RACINE 2025-12-11: Vérifier que l'index unique existe AVANT d'exécuter REFRESH CONCURRENTLY
                        // Le problème: REFRESH CONCURRENTLY sans index unique peut causer des crashes PostgreSQL
                        let has_unique_index = sqlx::query_scalar::<_, bool>(
                            "SELECT EXISTS (
                                SELECT 1 FROM pg_indexes 
                                WHERE tablename = 'services_search_cache' 
                                AND indexname = 'idx_services_search_cache_id_unique'
                            )"
                        )
                        .fetch_one(&*pool_clone_matviews)
                        .await
                        .unwrap_or(false);

                        if !has_unique_index {
                            log::warn!("⚠️ services_search_cache n'a pas d'index unique - REFRESH CONCURRENTLY ignoré (peut causer crash PostgreSQL)");
                        } else {
                            // ✅ OPTIMISÉ 2025-12-10: Utiliser pool séparé pour opérations longues
                            if let Err(e) = sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_cache")
                                .execute(&*pool_for_refresh)
                                .await
                            {
                                let error_str = e.to_string().to_lowercase();
                                // ✅ CORRECTION: Ignorer silencieusement les erreurs attendues
                                if error_str.contains("cannot refresh materialized view concurrently") {
                                    log::debug!("ℹ️ services_search_cache déjà en cours de refresh");
                                } else if error_str.contains("does not have a unique index") {
                                    log::warn!("⚠️ services_search_cache nécessite un index unique pour REFRESH CONCURRENTLY");
                                } else if error_str.contains("peer closed connection")
                                    || error_str.contains("connection reset by peer")
                                    || error_str.contains("broken pipe")
                                    || error_str.contains("tls close_notify")
                                {
                                    // ✅ OPTIMISATION: Logger en debug pour les erreurs de connexion DB attendues
                                    log::debug!("⚠️ Erreur connexion DB (ignorée) refresh services_search_cache: {}", e);
                                } else {
                                    log::warn!("⚠️ Erreur refresh services_search_cache: {}", e);
                                }
                            } else {
                                log::debug!("✅ services_search_cache refreshed");
                            }
                        }
                    } else {
                        log::debug!("⚠️ Vue services_search_cache n'existe pas encore");
                    }
                }
                _ = interval_products.tick() => {
                    // ✅ CORRECTION RACINE: Utiliser mutex pour éviter refresh concurrents
                    let _lock = refresh_lock_products.lock().await;
                    log::info!("🔄 Refresh de active_products_cache...");
                    // PostgreSQL ne supporte pas IF EXISTS avec REFRESH MATERIALIZED VIEW CONCURRENTLY
                    let view_exists = sqlx::query_scalar::<_, bool>(
                        "SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'active_products_cache')"
                    )
                    .fetch_one(&*pool_clone_matviews)
                    .await
                    .unwrap_or(false);

                    if view_exists {
                        // ✅ CRITIQUE RACINE 2025-12-11: Vérifier que l'index unique existe AVANT d'exécuter REFRESH CONCURRENTLY
                        // Le problème: REFRESH CONCURRENTLY sans index unique peut causer des crashes PostgreSQL
                        let has_unique_index = sqlx::query_scalar::<_, bool>(
                            "SELECT EXISTS (
                                SELECT 1 FROM pg_indexes 
                                WHERE tablename = 'active_products_cache' 
                                AND indexname = 'idx_active_products_cache_id_unique'
                            )"
                        )
                        .fetch_one(&*pool_clone_matviews)
                        .await
                        .unwrap_or(false);

                        if !has_unique_index {
                            log::warn!("⚠️ active_products_cache n'a pas d'index unique - REFRESH CONCURRENTLY ignoré (peut causer crash PostgreSQL)");
                        } else {
                            // ✅ OPTIMISÉ 2025-12-10: Utiliser pool séparé pour opérations longues
                            if let Err(e) = sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY active_products_cache")
                                .execute(&*pool_for_refresh)
                                .await
                            {
                                let error_str = e.to_string().to_lowercase();
                                // ✅ CORRECTION: Ignorer silencieusement les erreurs attendues
                                if error_str.contains("cannot refresh materialized view concurrently") {
                                    log::debug!("ℹ️ active_products_cache déjà en cours de refresh");
                                } else if error_str.contains("does not have a unique index") {
                                    log::warn!("⚠️ active_products_cache nécessite un index unique pour REFRESH CONCURRENTLY");
                                } else if error_str.contains("peer closed connection")
                                    || error_str.contains("connection reset by peer")
                                    || error_str.contains("broken pipe")
                                    || error_str.contains("tls close_notify")
                                {
                                    // ✅ OPTIMISATION: Logger en debug pour les erreurs de connexion DB attendues
                                    log::debug!("⚠️ Erreur connexion DB (ignorée) refresh active_products_cache: {}", e);
                                } else {
                                    log::warn!("⚠️ Erreur refresh active_products_cache: {}", e);
                                }
                            } else {
                                log::debug!("✅ active_products_cache refreshed");
                            }
                        }
                    } else {
                        log::debug!("⚠️ Vue active_products_cache n'existe pas encore");
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
