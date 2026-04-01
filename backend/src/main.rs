// Mise à jour: 2026-02-14 - Configuration GCP complète (Artifact Registry, Cloud Run, permissions)
// Note: Build trigger test - 2026-03-12
use std::error::Error;
use std::{env, fs, net::SocketAddr, path::Path, sync::Arc, thread};

use axum::extract::Request;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, Router};
use dotenvy::dotenv;
use redis::Client as RedisClient;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions, PgSslMode};
use tokio::sync::Mutex;
use tower::Service;

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

/// URL du pool factice en mode dégradé (aucune connexion réelle requise tant que l’API renvoie 503).
const DUMMY_POSTGRES_URL: &str = "postgresql://user:pass@localhost:5432/db";

// ✅ CRITIQUE 2026-02-17: Gérer --version AVANT tokio::main
// Le wrapper teste --version pour vérifier que le binaire fonctionne
// Si --version n'est pas géré, le binaire essaie de démarrer normalement et peut crash
fn main() {
    // Gérer --version AVANT tokio::main pour éviter un crash silencieux
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1] == "--version" {
        println!("yukpomnang_backend {}", env!("CARGO_PKG_VERSION"));
        std::process::exit(0);
    }

    // ✅ CRITIQUE Cloud Run : bind TCP *synchrone* AVANT tokio::Runtime::new().
    // Sinon l’init du runtime + charge peut dépasser le délai avant que le port soit en écoute.
    use std::io::Write;
    let _ = std::io::stderr().flush();
    eprintln!("[MAIN] 🚀 Application Rust démarre - Point d'entrée atteint");
    let _ = std::io::stderr().flush();
    eprintln!("[MAIN] 🔍 bind précoce sur PORT (avant tokio::Runtime) — sonde Cloud Run");
    let _ = std::io::stderr().flush();

    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    let mut std_listener = None;
    let mut retries = 0u32;
    const MAX_BIND_RETRIES: u32 = 10;
    while std_listener.is_none() && retries < MAX_BIND_RETRIES {
        match std::net::TcpListener::bind(addr) {
            Ok(l) => {
                eprintln!(
                    "[MAIN] ✅ Bind std sur {}:{} (tentative {}) — socket LISTEN pour la plateforme",
                    "0.0.0.0",
                    port,
                    retries + 1
                );
                std_listener = Some(l);
            }
            Err(e) => {
                if retries < MAX_BIND_RETRIES - 1 {
                    eprintln!(
                        "[MAIN] ⏳ Port {} occupé (tentative {}), réessai dans 1s... {}",
                        port,
                        retries + 1,
                        e
                    );
                    thread::sleep(std::time::Duration::from_secs(1));
                    retries += 1;
                } else {
                    eprintln!(
                        "[MAIN] ❌ ERREUR CRITIQUE: Impossible de bind sur {}:{} après {} tentatives - {}",
                        "0.0.0.0",
                        port,
                        MAX_BIND_RETRIES,
                        e
                    );
                    std::process::exit(1);
                }
            }
        }
    }
    let std_listener = std_listener.expect("listener bound");
    if let Err(e) = std_listener.set_nonblocking(true) {
        eprintln!("[MAIN] ❌ set_nonblocking: {}", e);
        std::process::exit(1);
    }

    let rt = tokio::runtime::Runtime::new().unwrap();
    if let Err(e) = rt.block_on(async_main(std_listener)) {
        eprintln!("[MAIN] ❌ Erreur fatale: {}", e);
        std::process::exit(1);
    }
}

async fn async_main(std_listener: std::net::TcpListener) -> Result<(), Box<dyn std::error::Error>> {
    // ✅ CRITIQUE: Logs IMMÉDIATS sur stderr AVANT toute initialisation
    // Ces logs apparaîtront même si le logging n'est pas initialisé
    // ✅ 2026-02-17: Ajout log de diagnostic pour vérifier que Rust démarre
    // ✅ CRITIQUE 2026-02-17: Forcer le flush immédiat pour Cloud Run
    use std::io::Write;
    let _ = std::io::stderr().flush();
    eprintln!("[MAIN] 🔍 Vérification des variables d'environnement critiques...");
    let _ = std::io::stderr().flush();

    // Vérifier les variables critiques AVANT toute autre opération
    let db_url_ok = std::env::var("DATABASE_URL").is_ok();
    let redis_url_ok = std::env::var("REDIS_URL").is_ok();
    let jwt_secret_ok = std::env::var("JWT_SECRET").is_ok();

    eprintln!(
        "[MAIN] DATABASE_URL: {}",
        if db_url_ok {
            "✅ Présente"
        } else {
            "❌ MANQUANTE"
        }
    );
    eprintln!(
        "[MAIN] REDIS_URL: {}",
        if redis_url_ok {
            "✅ Présente"
        } else {
            "❌ MANQUANTE"
        }
    );
    eprintln!(
        "[MAIN] JWT_SECRET: {}",
        if jwt_secret_ok {
            "✅ Présente"
        } else {
            "❌ MANQUANTE"
        }
    );

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
            .or_else(|| panic_info.payload().downcast_ref::<String>().map(|s| s.as_str()))
            .unwrap_or("unknown panic message");

        log::error!("🚨 PANIC détecté à {}: {}", location, message);
        eprintln!("🚨 PANIC: {} ({})", message, location);
    }));

    let is_cloud_run = env::var("CLOUD_RUN").unwrap_or_default() == "true";
    eprintln!("[MAIN] 🔍 CLOUD_RUN détecté: {}", is_cloud_run);

    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .unwrap_or(8080);
    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    eprintln!("[MAIN] 🔍 Port configuré: {}", port);

    // Un seul TcpListener pour toute la vie du processus : /health répond tout de suite ;
    // l'API complète est injectée après init (pas de rebind → pas de TIME_WAIT / crash Cloud Run).
    // build_app() finit par .with_state → Router (alias Router<()>) : seul ce type impl Service<Request> dans axum 0.8.
    let app_router_holder: Arc<tokio::sync::RwLock<Option<Router>>> =
        Arc::new(tokio::sync::RwLock::new(None));
    let holder_for_fallback = app_router_holder.clone();

    let shell_router = Router::new()
        .route(
            "/health",
            get(|| async {
                eprintln!("[HEALTH] ✅ Requête /health reçue");
                (StatusCode::OK, "OK")
            }),
        )
        .route(
            "/healthz",
            get(|| async {
                eprintln!("[HEALTH] ✅ Requête /healthz reçue");
                (StatusCode::OK, "OK")
            }),
        )
        // Si Cloud Run retombe sur une sonde HTTP (path /), le fallback renvoyait 503 — la révision échouait.
        .route("/", get(|| async { (StatusCode::OK, "OK") }))
        .fallback(move |req: Request| {
            let holder = holder_for_fallback.clone();
            async move {
                let guard = holder.read().await;
                if let Some(full) = guard.as_ref() {
                    let mut r = full.clone();
                    Service::call(&mut r, req).await.unwrap_or_else(|e| match e {})
                } else {
                    (StatusCode::SERVICE_UNAVAILABLE, "starting").into_response()
                }
            }
        });

    eprintln!("[MAIN] 🔍 Conversion listener std → tokio (bind déjà fait dans main())");
    let listener = tokio::net::TcpListener::from_std(std_listener)?;

    eprintln!(
        "[MAIN] 🚀 axum::serve (shell) sur :{} — accept immédiat",
        port
    );
    let serve_task = tokio::spawn(async move { serve(listener, shell_router).await });
    tokio::task::yield_now().await;

    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // Vérifier que le serve task n'a pas crashé prématurément
    if serve_task.is_finished() {
        eprintln!("[MAIN] ❌ ERREUR CRITIQUE: Le serve task s'est terminé en <500ms!");
        match serve_task.await {
            Ok(Ok(())) => eprintln!("[MAIN]   → serve a retourné Ok(()) (inattendu)"),
            Ok(Err(e)) => eprintln!("[MAIN]   → serve a retourné Err: {}", e),
            Err(e) => eprintln!("[MAIN]   → serve task paniquée: {}", e),
        }
        return Err("serve task terminated prematurely".into());
    }
    eprintln!("[MAIN] ✅ serve task toujours actif après 500ms");
    // Pas de reqwest vers localhost ici : sous Cloud Run, évite toute contention / deadlock
    // au démarrage ; la sonde (TCP ou HTTP) valide le port.

    // Maintenant initialiser dotenv et logging (APRÈS le serveur minimal)
    eprintln!("[MAIN] 🔧 Initialisation dotenv...");
    dotenv().ok();
    eprintln!("[MAIN] 🔧 Initialisation du logging...");
    yukpomnang_backend::init_logging();
    eprintln!("[MAIN] ✅ Logging initialisé");
    if is_cloud_run {
        log::info!("🔍 CLOUD_RUN détecté: {}", is_cloud_run);
        log::info!("🔍 Port configuré: {}", port);
    }

    // ✅ NOUVEAU 2026-01-29: Logs de diagnostic très tôt pour confirmer que le code s'exécute
    log::info!(
        "🔍 [STARTUP] Démarrage application - Version: {}",
        env!("CARGO_PKG_VERSION")
    );
    log::info!(
        "🔍 [STARTUP] Current working directory: {:?}",
        env::current_dir()
    );
    log::info!(
        "🔍 [STARTUP] SQLX_OFFLINE au runtime: {:?}",
        env::var("SQLX_OFFLINE").ok()
    );

    eprintln!("[MAIN] 🔍 Récupération de DATABASE_URL...");

    let mut degraded_mode = false;

    // En Cloud Run, DATABASE_URL vient du secret injecté en env ; parfois absent au tout premier tick.
    // Ne jamais quitter le processus tout de suite : le serveur minimal tient le port 8080 pour la startup probe TCP.
    let mut db_url = if is_cloud_run {
        const RETRY_SECS: u64 = 2;
        const MAX_ATTEMPTS: u32 = 300; // 300 × 2s = 10 min max
        let mut attempt = 0u32;
        loop {
            attempt += 1;
            let maybe = env::var("DATABASE_URL")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .or_else(|| {
                    std::fs::read_to_string("/secrets/database-url/DATABASE_URL")
                        .ok()
                        .filter(|s| !s.trim().is_empty())
                })
                .or_else(|| {
                    std::fs::read_to_string("/secrets/database-url/value")
                        .ok()
                        .filter(|s| !s.trim().is_empty())
                });
            match maybe {
                Some(url) => break url,
                None => {
                    eprintln!(
                        "[MAIN] ⏳ DATABASE_URL indisponible (tentative {}/{}) — réessai dans {}s (sonde TCP sur :8080 toujours active)",
                        attempt,
                        MAX_ATTEMPTS,
                        RETRY_SECS
                    );
                    log::warn!(
                        "⏳ DATABASE_URL absent au démarrage Cloud Run (tentative {}/{})",
                        attempt,
                        MAX_ATTEMPTS
                    );
                    if attempt >= MAX_ATTEMPTS {
                        let err = "DATABASE_URL toujours absent après 10 minutes (Cloud Run)";
                        eprintln!("[MAIN] ❌ {}", err);
                        log::error!("❌ {}", err);
                        eprintln!("[MAIN] 🚨 CRITIQUE: Le serveur HTTP continue de tourner sur le port 8080 (/health répond)");
                        eprintln!("[MAIN] 📝 L'application fonctionnera sans base de données (mode dégradé)");
                        // ✅ CORRIGÉ 2026-03-23: NE PLUS QUITTER — continuer sans DB pour que /health reste disponible
                        // Le serveur shell répond déjà sur /health, /healthz, / — la startup probe peut réussir
                        // Les routes API renverront 503 (Service Unavailable) via le fallback
                        log::error!("⚠️ DATABASE_URL non disponible après timeout — Application continue en mode dégradé (API désactivée)");
                        degraded_mode = true;
                        break DUMMY_POSTGRES_URL.to_string();
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(RETRY_SECS)).await;
                }
            }
        }
    } else if let Ok(url) = env::var("DATABASE_URL") {
        url
    } else if let Ok(content) = std::fs::read_to_string("/secrets/database-url/DATABASE_URL") {
        content
    } else if let Ok(content) = std::fs::read_to_string("/secrets/database-url/value") {
        content
    } else {
        let err = "DATABASE_URL non trouvé (ni env var ni secret Cloud Run)";
        eprintln!("[MAIN] ❌ ERREUR CRITIQUE: {}", err);
        log::error!("❌ {}", err);
        eprintln!("[MAIN] 🚨 CRITIQUE: Le serveur HTTP continue de tourner sur le port 8080 (/health répond)");
        eprintln!("[MAIN] 📝 L'application fonctionnera sans base de données (mode dégradé)");
        // ✅ CORRIGÉ 2026-03-23: NE PLUS QUITTER — continuer sans DB pour que /health reste disponible
        // Le serveur shell répond déjà sur /health, /healthz, / — la startup probe peut réussir
        // Les routes API renverront 503 (Service Unavailable) via le fallback
        log::error!("⚠️ DATABASE_URL non disponible — Application continue en mode dégradé (API désactivée)");
        degraded_mode = true;
        DUMMY_POSTGRES_URL.to_string()
    };

    // Nettoyer les retours à la ligne qui cassent le parsing

    // ✅ CRITIQUE 2026-02-17: Nettoyer les retours à la ligne qui cassent le parsing
    // Les retours à la ligne dans DATABASE_URL causent "error with configuration: empty host"
    let original_len = db_url.len();
    db_url = db_url.trim().to_string(); // Supprime les espaces et retours à la ligne en début/fin
    db_url = db_url.replace("\r\n", "").replace("\n", "").replace("\r", "");
    if db_url.len() != original_len {
        eprintln!(
            "[MAIN] ⚠️ ATTENTION: DATABASE_URL nettoyée (retours à la ligne supprimés: {} -> {} caractères)",
            original_len,
            db_url.len()
        );
        log::warn!(
            "⚠️ DATABASE_URL nettoyée (retours à la ligne supprimés: {} -> {} caractères)",
            original_len,
            db_url.len()
        );
    }

    eprintln!(
        "[MAIN] ✅ DATABASE_URL récupérée et nettoyée (longueur: {})",
        db_url.len()
    );

    // ✅ CORRIGÉ RACINE 2025-12-11: Ajouter sslmode=require pour Render PostgreSQL
    // Render PostgreSQL nécessite SSL/TLS pour toutes les connexions
    // Le vrai problème: Render ferme les connexions idle après ~5 minutes
    // Solution: Réduire max_lifetime à 4 minutes pour renouveler avant fermeture
    // ✅ CORRIGÉ 2026-02-15: Ne pas ajouter sslmode=require pour Cloud SQL Unix socket
    // Cloud SQL avec Unix socket (/cloudsql/) n'utilise pas SSL/TLS réseau
    if !db_url.contains("sslmode=") && !db_url.contains("/cloudsql/") {
        let separator = if db_url.contains('?') { "&" } else { "?" };
        db_url.push_str(&format!("{}sslmode=require", separator));
        log::info!(
            "🔧 Paramètre sslmode=require ajouté à DATABASE_URL (requis pour Render PostgreSQL)"
        );
    } else if db_url.contains("/cloudsql/") {
        log::info!(
            "🔧 Cloud SQL Unix socket détecté - sslmode=require non ajouté (non nécessaire)"
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

    eprintln!("[MAIN] 🔌 Début de la connexion à PostgreSQL...");
    log::info!("🔌 Connexion à la base de données PostgreSQL...");

    // ✅ OPTIMISÉ 2026-01-04: Pool augmenté pour résoudre les warnings "time to acquire exceeded"
    // Le problème: Acquisition de connexions prend >2s (pool saturé)
    // Solution: Augmenter à 100 max (Render PostgreSQL supporte jusqu'à 100 sur plan Standard)
    // Avec les optimisations SQL, les requêtes seront plus rapides et libéreront les connexions plus vite
    let max_connections: u32 = env::var("DB_POOL_SIZE")
        .unwrap_or_else(|_| "100".to_string()) // ✅ OPTIMISÉ 2026-01-04: Augmenté de 50 à 100 pour résoudre les warnings
        .parse()
        .unwrap_or(100);

    let min_connections: u32 = env::var("DB_POOL_MIN_SIZE")
        .unwrap_or_else(|_| "20".to_string()) // ✅ OPTIMISÉ 2026-01-04: Augmenté de 10 à 20 pour réduire latence d'acquisition
        .parse()
        .unwrap_or(20);

    let acquire_timeout_secs: u64 = env::var("DB_ACQUIRE_TIMEOUT_SECS")
        .unwrap_or_else(|_| "30".to_string()) // ✅ Phase 1: Augmenté à 30s (était 15s)
        .parse()
        .unwrap_or(30);

    // ✅ NOUVEAU 2025-12-02: Créer le pool PostgreSQL master (écritures)
    // ✅ AMÉLIORÉ 2025-12-11: Configuration optimisée pour prévenir les erreurs TLS
    // ✅ CORRIGÉ RACINE 2025-12-11: Configuration robuste pour gérer les crashes PostgreSQL et fermetures brutales
    // ✅ CORRIGÉ RACINE 2025-12-11: Retry logic pour connexion initiale (gère les crashes PostgreSQL temporaires)
    // ✅ OPTIMISÉ 2026-02-14: Pour Cloud Run, utiliser connect_lazy pour démarrage rapide
    // ✅ CORRIGÉ 2026-02-14: Pool augmenté pour Cloud Run (50 max au lieu de 100 pour éviter saturation)
    // ✅ SOLUTION DÉFINITIVE 2026-02-15: Utiliser PgConnectOptions pour Cloud SQL Unix socket
    let pg_pool: PgPool = if is_cloud_run {
        // Pour Cloud Run: utiliser connect_lazy pour démarrage immédiat (connexion en arrière-plan)
        // ✅ CORRIGÉ 2026-02-15: min_connections=0 pour éviter blocage si DB non accessible
        eprintln!("[MAIN] 🚀 Cloud Run: Utilisation de connect_lazy pour démarrage rapide");
        log::info!("🚀 Cloud Run: Utilisation de connect_lazy pour démarrage rapide");
        // ✅ CORRIGÉ 2026-02-18: Pool configuré pour Cloud Run
        // ✅ CRITIQUE 2026-02-18: Réduit à 10 pour éviter saturation Cloud SQL
        // Cloud SQL a une limite de connexions (généralement 100), mais avec plusieurs instances Cloud Run,
        // il faut limiter le pool par instance pour éviter la saturation
        let cloud_run_max = env::var("DB_POOL_SIZE")
            .unwrap_or_else(|_| "10".to_string()) // ✅ CORRIGÉ: Réduit de 20 à 10
            .parse()
            .unwrap_or(10);
        let cloud_run_min = 0; // ✅ CORRIGÉ: 0 pour démarrage rapide même si DB non accessible
        log::info!(
            "🔧 Cloud Run: Pool configuré (max={}, min={}) - Démarrage non-bloquant",
            cloud_run_max,
            cloud_run_min
        );
        eprintln!(
            "[MAIN] 🔧 Cloud Run: Pool configuré (max={}, min={})",
            cloud_run_max, cloud_run_min
        );

        // ✅ SOLUTION DÉFINITIVE 2026-02-15: Détecter format Cloud SQL Unix socket et utiliser PgConnectOptions
        let pool_options = PgPoolOptions::new()
            .max_connections(cloud_run_max)
            .min_connections(cloud_run_min)
            .acquire_timeout(std::time::Duration::from_secs(acquire_timeout_secs))
            .idle_timeout(Some(std::time::Duration::from_secs(60))) // ✅ CORRIGÉ: Réduit de 120 à 60 pour libérer plus vite
            .max_lifetime(Some(std::time::Duration::from_secs(120))) // ✅ CORRIGÉ: Réduit de 180 à 120 pour libérer plus vite
            .test_before_acquire(true)
            .after_release(|conn, _meta| {
                Box::pin(async move {
                    match sqlx::query("SELECT 1").execute(&mut *conn).await {
                        Ok(_) => Ok(true),
                        Err(e) => {
                            let error_msg = e.to_string();
                            if error_msg.contains("TLS")
                                || error_msg.contains("close_notify")
                                || error_msg.contains("Connection reset")
                                || error_msg.contains("peer closed")
                            {
                                log::debug!(
                                    "⚠️ Connexion invalide détectée après libération: {}",
                                    error_msg
                                );
                                Ok(false)
                            } else {
                                Ok(true)
                            }
                        }
                    }
                })
            })
            .after_connect(|conn, _meta| {
                Box::pin(async move {
                    if let Err(e) =
                        sqlx::query("SET statement_timeout = 0").execute(&mut *conn).await
                    {
                        let error_msg = e.to_string();
                        if error_msg.contains("TLS")
                            || error_msg.contains("close_notify")
                            || error_msg.contains("Connection reset")
                            || error_msg.contains("peer closed")
                        {
                            log::debug!(
                                "⚠️ Configuration statement_timeout échouée: {}",
                                error_msg
                            );
                        }
                    }
                    let _ = sqlx::query("SET idle_in_transaction_session_timeout = '180s'")
                        .execute(&mut *conn)
                        .await;
                    Ok(())
                })
            });

        // ✅ SOLUTION DÉFINITIVE: Utiliser PgConnectOptions pour Cloud SQL Unix socket
        if db_url.contains("/cloudsql/") {
            log::info!("🔧 Format Cloud SQL Unix socket détecté - Utilisation de PgConnectOptions");

            let url_parts: Vec<&str> = db_url.split("://").collect();
            if url_parts.len() != 2 {
                eprintln!(
                    "[MAIN] ❌ Format DATABASE_URL invalide pour Cloud SQL: {}",
                    db_url
                );
                eprintln!("[MAIN] 🚨 CRITIQUE: Le serveur HTTP continue de tourner sur le port 8080 (/health répond)");
                eprintln!(
                    "[MAIN] 📝 L'application fonctionnera sans base de données (mode dégradé)"
                );
                log::error!("⚠️ Format DATABASE_URL invalide — Application continue en mode dégradé (API désactivée)");
                degraded_mode = true;
                PgPoolOptions::new()
                    .max_connections(1)
                    .min_connections(0)
                    .connect_lazy(DUMMY_POSTGRES_URL)
                    .unwrap_or_else(|_| {
                        log::error!(
                            "❌ Impossible de créer un pool factice — Continuation sans pool"
                        );
                        panic!("Pool factice requis pour mode dégradé");
                    })
            } else {
                let auth_and_path = url_parts[1];
                let (auth, query) = auth_and_path.split_once('?').unwrap_or((auth_and_path, ""));

                let (user_pass, db_name) = auth.split_once("@/").ok_or_else(|| {
                    format!("Format DATABASE_URL Cloud SQL invalide: pas de @/ trouvé")
                })?;
                let (user, password) = user_pass.split_once(':').unwrap_or((user_pass, ""));

                eprintln!("[MAIN] 🔍 Debug parsing URL Cloud SQL:");
                eprintln!("[MAIN]   auth_and_path: {}", auth_and_path);
                eprintln!("[MAIN]   query: '{}'", query);
                eprintln!("[MAIN]   query length: {}", query.len());

                let query_clean =
                    query.trim().replace("\r\n", "").replace("\n", "").replace("\r", "");
                eprintln!("[MAIN]   query_clean: '{}'", query_clean);

                let socket_path = query_clean
                    .split('&')
                    .find(|p| p.trim().starts_with("host=/cloudsql/"))
                    .and_then(|p| p.trim().strip_prefix("host="))
                    .map(|p| p.trim())
                    .ok_or_else(|| {
                        eprintln!(
                            "[MAIN] ❌ ERREUR: Socket path non trouvé dans query: '{}'",
                            query_clean
                        );
                        format!(
                            "Socket path Cloud SQL non trouvé dans DATABASE_URL (query: '{}')",
                            query_clean
                        )
                    })?;

                eprintln!("[MAIN] ✅ Socket path extrait: '{}'", socket_path);
                eprintln!("[MAIN]   Socket path length: {}", socket_path.len());

                if socket_path.is_empty() {
                    eprintln!(
                        "[MAIN] ❌ Socket path Cloud SQL est vide après extraction (query: '{}')",
                        query_clean
                    );
                    eprintln!("[MAIN] 🚨 CRITIQUE: Le serveur HTTP continue de tourner sur le port 8080 (/health répond)");
                    eprintln!(
                        "[MAIN] 📝 L'application fonctionnera sans base de données (mode dégradé)"
                    );
                    log::error!("⚠️ Socket path Cloud SQL vide — Application continue en mode dégradé (API désactivée)");
                    degraded_mode = true;
                    PgPoolOptions::new()
                        .max_connections(1)
                        .min_connections(0)
                        .connect_lazy(DUMMY_POSTGRES_URL)
                        .unwrap_or_else(|_| {
                            log::error!(
                                "❌ Impossible de créer un pool factice — Continuation sans pool"
                            );
                            panic!("Pool factice requis pour mode dégradé");
                        })
                } else {
                    eprintln!(
                        "[MAIN] 🔍 Attente du socket Unix Cloud SQL: {}",
                        socket_path
                    );
                    let mut socket_ready = false;
                    for attempt in 1..=90 {
                        if Path::new(socket_path).exists() {
                            socket_ready = true;
                            eprintln!(
                                "[MAIN] ✅ Socket Unix disponible après {} tentative(s)",
                                attempt
                            );
                            break;
                        }
                        eprintln!(
                            "[MAIN] ⏳ Socket pas encore monté ({}/90), nouvel essai dans 2s...",
                            attempt
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    }
                    if !socket_ready {
                        eprintln!(
                            "[MAIN] ⚠️ ATTENTION: Le socket Unix Cloud SQL n'existe pas après 180s: {}",
                            socket_path
                        );
                        eprintln!("[MAIN] 🔍 Vérification du répertoire /cloudsql/...");
                        if let Ok(entries) = fs::read_dir("/cloudsql") {
                            eprintln!("[MAIN] 📂 Contenu de /cloudsql/:");
                            for entry in entries.flatten() {
                                eprintln!("[MAIN]   - {}", entry.path().display());
                            }
                        } else {
                            eprintln!("[MAIN] ❌ Le répertoire /cloudsql/ n'existe pas !");
                            eprintln!(
                                "[MAIN] ⚠️ Cloud SQL Unix socket n'est pas monté dans le conteneur"
                            );
                        }
                        eprintln!("[MAIN] 🚨 CRITIQUE: Le serveur HTTP continue de tourner sur le port 8080 (/health répond)");
                        eprintln!(
                            "[MAIN] 📝 L'application fonctionnera sans base de données (mode dégradé)"
                        );
                        eprintln!("[MAIN] 🔧 ACTION REQUISE: Vérifiez --set-cloudsql-instances et les permissions IAM");
                        log::error!("⚠️ Cloud SQL socket non disponible — Application continue en mode dégradé (API désactivée)");
                        degraded_mode = true;
                        PgPoolOptions::new()
                            .max_connections(1)
                            .min_connections(0)
                            .connect_lazy(DUMMY_POSTGRES_URL)
                            .unwrap_or_else(|_| {
                                log::error!(
                                    "❌ Impossible de créer un pool factice — Continuation sans pool"
                                );
                                panic!("Pool factice requis pour mode dégradé");
                            })
                    } else {
                        eprintln!("[MAIN] ✅ Socket Unix prêt: {}", socket_path);

                        log::info!(
                            "🔧 Configuration Cloud SQL: user={}, db={}, socket={}",
                            user,
                            db_name,
                            socket_path
                        );

                        log::info!(
                            "🔧 Construction de PgConnectOptions pour Cloud SQL Unix socket"
                        );

                        eprintln!("[MAIN] 🔍 Construction PgConnectOptions:");
                        eprintln!("[MAIN]   user: {}", user);
                        eprintln!("[MAIN]   db_name: {}", db_name);
                        eprintln!("[MAIN]   socket_path: {}", socket_path);

                        let mut connect_options = PgConnectOptions::new()
                            .host(socket_path)
                            .username(user)
                            .database(db_name);

                        if !password.is_empty() {
                            let password_decoded = urlencoding::decode(password)
                                .map_err(|e| format!("Erreur décodage mot de passe URL: {}", e))?
                                .to_string();

                            eprintln!(
                                "[MAIN] 🔍 Mot de passe décodé (longueur: {})",
                                password_decoded.len()
                            );
                            log::debug!("Mot de passe décodé pour user: {}", user);

                            connect_options = connect_options.password(&password_decoded);
                        }

                        connect_options = connect_options.ssl_mode(PgSslMode::Disable);

                        log::info!(
                            "🔧 PgConnectOptions configuré: socket={}, user={}, db={}",
                            socket_path,
                            user,
                            db_name
                        );

                        let pool = pool_options.connect_lazy_with(connect_options);

                        log::info!(
                            "✅ Pool PostgreSQL créé avec connect_lazy (max={}, min={})",
                            cloud_run_max,
                            cloud_run_min
                        );
                        eprintln!(
                            "[MAIN] ✅ Pool PostgreSQL créé (max={}, min={}) - Le pool se connectera en arrière-plan",
                            cloud_run_max,
                            cloud_run_min
                        );

                        pool
                    }
                }
            }
        } else {
            log::info!(
                "🔧 Cloud Run: DATABASE_URL sans socket Unix /cloudsql/ — connect_lazy (TCP)"
            );
            match pool_options.connect_lazy(&db_url) {
                Ok(p) => p,
                Err(e) => {
                    log::error!("❌ connect_lazy (Cloud Run TCP): {}", e);
                    degraded_mode = true;
                    PgPoolOptions::new()
                        .max_connections(1)
                        .min_connections(0)
                        .connect_lazy(DUMMY_POSTGRES_URL)
                        .unwrap_or_else(|_| {
                            log::error!(
                                "❌ Impossible de créer un pool factice — Continuation sans pool"
                            );
                            panic!("Pool factice requis pour mode dégradé");
                        })
                }
            }
        }
    } else {
        // Pour autres environnements: connexion bloquante avec retry
        let mut last_error = None;
        let mut connected = false;
        let mut pool_opt = None;

        let max_retries = if is_cloud_run { 5 } else { 3 };
        for attempt in 1..=max_retries {
            match PgPoolOptions::new()
                .max_connections(max_connections)
                .min_connections(min_connections)
                .acquire_timeout(std::time::Duration::from_secs(acquire_timeout_secs))
                .idle_timeout(Some(std::time::Duration::from_secs(120)))
                .max_lifetime(Some(std::time::Duration::from_secs(180)))
                .test_before_acquire(true)
                .after_release(|conn, _meta| {
                    Box::pin(async move {
                        match sqlx::query("SELECT 1").execute(&mut *conn).await {
                            Ok(_) => Ok(true),
                            Err(e) => {
                                let error_msg = e.to_string();
                                if error_msg.contains("TLS")
                                    || error_msg.contains("close_notify")
                                    || error_msg.contains("Connection reset")
                                    || error_msg.contains("peer closed")
                                {
                                    log::debug!(
                                        "⚠️ Connexion invalide détectée après libération: {}",
                                        error_msg
                                    );
                                    Ok(false)
                                } else {
                                    Ok(true)
                                }
                            }
                        }
                    })
                })
                .after_connect(|conn, _meta| {
                    Box::pin(async move {
                        if let Err(e) =
                            sqlx::query("SET statement_timeout = 0").execute(&mut *conn).await
                        {
                            let error_msg = e.to_string();
                            if error_msg.contains("TLS")
                                || error_msg.contains("close_notify")
                                || error_msg.contains("Connection reset")
                                || error_msg.contains("peer closed")
                            {
                                log::debug!(
                                    "⚠️ Configuration statement_timeout échouée: {}",
                                    error_msg
                                );
                            }
                        }
                        let _ = sqlx::query("SET idle_in_transaction_session_timeout = '180s'")
                            .execute(&mut *conn)
                            .await;
                        Ok(())
                    })
                })
                .connect(&db_url)
                .await
            {
                Ok(pool) => {
                    eprintln!(
                        "[MAIN] ✅ Connexion PostgreSQL établie (tentative {}/{})",
                        attempt, max_retries
                    );
                    log::info!(
                        "✅ Connexion PostgreSQL établie (tentative {}/{})",
                        attempt,
                        max_retries
                    );
                    pool_opt = Some(pool);
                    connected = true;
                    break;
                }
                Err(e) => {
                    last_error = Some(e);
                    if attempt < max_retries {
                        let delay_secs = 2_u64.pow(attempt); // 2s, 4s, 8s
                        log::warn!(
                            "⚠️ Échec connexion PostgreSQL (tentative {}/{}), retry dans {}s...",
                            attempt,
                            max_retries,
                            delay_secs
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(delay_secs)).await;
                    }
                }
            }
        }

        if !connected {
            let e = last_error.unwrap();
            eprintln!("[MAIN] ❌ ERREUR CRITIQUE: Impossible de se connecter à PostgreSQL après {} tentatives", max_retries);
            eprintln!("[MAIN] ❌ Erreur: {}", e);
            log::error!(
                "❌ Impossible de se connecter à PostgreSQL après {} tentatives: {}",
                max_retries,
                e
            );
            eprintln!("[MAIN] 🚨 CRITIQUE: Le serveur HTTP continue de tourner sur le port 8080 (/health répond)");
            eprintln!("[MAIN] 📝 L'application fonctionnera sans base de données (mode dégradé)");
            // ✅ CORRIGÉ 2026-03-23: NE PLUS QUITTER — continuer sans DB pour que /health reste disponible
            // Le serveur shell répond déjà sur /health, /healthz, / — la startup probe peut réussir
            // Les routes API renverront 503 (Service Unavailable) via le fallback
            log::error!("⚠️ Connexion PostgreSQL impossible — Application continue en mode dégradé (API désactivée)");
            // Créer un pool factice pour éviter les panics dans le reste du code
            let dummy_pool = PgPoolOptions::new()
                .max_connections(1)
                .min_connections(0)
                .connect_lazy(DUMMY_POSTGRES_URL)
                .unwrap_or_else(|_| {
                    // Si même le pool factice échoue, on continue sans pool
                    log::error!("❌ Impossible de créer un pool factice — Continuation sans pool");
                    panic!("Pool factice requis pour mode dégradé");
                });
            degraded_mode = true;
            dummy_pool
        } else {
            pool_opt.unwrap()
        }
    };

    eprintln!("[MAIN] ✅ Pool PostgreSQL créé avec succès");
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
        .connect_lazy(&long_ops_url)
    {
        Ok(pool) => {
            log::info!("✅ Pool PostgreSQL longues opérations créé (lazy, max=5, min=2)");
            Some(pool)
        }
        Err(e) => {
            log::warn!("⚠️ Impossible de créer le pool longues opérations: {}, utilisation du pool principal", e);
            None
        }
    };

    // ✅ NOUVEAU 2025-12-02: Créer le pool PostgreSQL read replica (lectures) si configuré
    let pg_read_pool: Option<PgPool> = env::var("DATABASE_READ_REPLICA_URL")
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

            // ✅ CORRIGÉ 2026-02-17: connect_lazy() peut retourner un Result dans certaines versions
            // ✅ CORRIGÉ 2026-02-18: Réduit de 30 à 10 pour éviter saturation Cloud SQL
            match PgPoolOptions::new()
                .max_connections(10) // ✅ CORRIGÉ 2026-02-18: Réduit de 30 à 10 pour éviter saturation
                .min_connections(2) // ✅ CORRIGÉ 2026-02-18: Réduit de 5 à 2
                .acquire_timeout(std::time::Duration::from_secs(30))
                .idle_timeout(Some(std::time::Duration::from_secs(600)))
                .max_lifetime(Some(std::time::Duration::from_secs(1800)))
                .test_before_acquire(true)
                .connect_lazy(&read_url)
            {
                Ok(pool) => Some(pool),
                Err(e) => {
                    log::error!("❌ Erreur création pool read replica: {}", e);
                    None
                }
            }
        });

    if pg_read_pool.is_none() {
        log::info!("ℹ️ Read replica PostgreSQL non configuré (DATABASE_READ_REPLICA_URL) - Utilisation du master pour toutes les opérations");
    }

    // ✅ NOUVEAU 2025-11-27: Pré-chauffer le pool pour avoir des connexions prêtes
    // ✅ CORRIGÉ 2026-02-15: Pour Cloud Run avec min_connections=0, sauter le warmup (non-bloquant)
    // Le warmup peut bloquer si la DB n'est pas accessible
    let actual_min_connections = if is_cloud_run { 0 } else { min_connections };

    // ✅ CRITIQUE 2026-02-18: Log la taille réelle du pool après création
    let initial_pool_size = pg_pool.size();
    log::info!(
        "📊 Pool PostgreSQL initial - Size: {}, Configuré max: {}, min: {}",
        initial_pool_size,
        if is_cloud_run {
            env::var("DB_POOL_SIZE")
                .unwrap_or_else(|_| "20".to_string())
                .parse()
                .unwrap_or(20)
        } else {
            max_connections
        },
        actual_min_connections
    );
    eprintln!(
        "[MAIN] 📊 Pool PostgreSQL initial - Size: {}, Configuré max: {}",
        initial_pool_size,
        if is_cloud_run {
            env::var("DB_POOL_SIZE")
                .unwrap_or_else(|_| "20".to_string())
                .parse()
                .unwrap_or(20)
        } else {
            max_connections
        }
    );

    if actual_min_connections > 0 {
        log::info!("🔥 Pré-chauffage du pool de connexions...");
        let warmup_pool = pg_pool.clone();
        let warmup_min = actual_min_connections;
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
            if warmup_min > 0 {
                log::info!(
                    "✅ Pool pré-chauffé: {}/{} connexions prêtes",
                    success_count,
                    warmup_min
                );
            }
        });
    } else {
        log::info!("🚀 Cloud Run: Warmup pool sauté (min_connections=0, démarrage non-bloquant)");
    }

    // 🔄 Exécuter les migrations SQLx standard au démarrage
    // ✅ CORRIGÉ 2026-01-28: Les migrations SQLx standard sont OBLIGATOIRES pour créer les tables de base
    // ✅ OPTIMISÉ Cloud Run 2026-02-14: Pour Cloud Run, les migrations sont lancées en arrière-plan après démarrage serveur
    let is_cloud_run = env::var("CLOUD_RUN").unwrap_or_default() == "true";

    // ✅ OPTIMISÉ Cloud Run: Pour Cloud Run, on saute toutes les migrations SQLx ici
    // Elles seront lancées en arrière-plan après la création de l'AppState
    // ✅ NOUVEAU 2026-02-15: Permettre l'exécution des migrations SQLx sur Cloud Run via variable d'environnement
    let enable_sqlx_migrations = env::var("ENABLE_SQLX_MIGRATIONS")
        .unwrap_or_else(|_| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);

    let should_run_sqlx_migrations = !is_cloud_run || enable_sqlx_migrations;

    if should_run_sqlx_migrations {
        if is_cloud_run && enable_sqlx_migrations {
            log::info!("🚀 Cloud Run: Application des migrations SQLx standard (ENABLE_SQLX_MIGRATIONS=true)...");
        } else {
            log::info!("🚀 Application des migrations SQLx standard...");
        }
        log::info!(
            "🔍 [DIAGNOSTIC] SQLX_OFFLINE au runtime: {:?}",
            env::var("SQLX_OFFLINE").ok()
        );
        log::info!(
            "🔍 [DIAGNOSTIC] Current working directory: {:?}",
            env::current_dir()
        );
        log::info!("🔍 [DIAGNOSTIC] Pool de connexions créé avec succès");

        // ✅ NOUVEAU 2026-01-29: Vérifier que le dossier migrations existe
        // Note: sqlx::migrate!() nécessite un chemin littéral, donc on vérifie juste que le dossier existe
        let _migrations_path = Path::new("./migrations");
        if let Ok(current_dir) = env::current_dir() {
            let migrations_dir = current_dir.join("migrations");
            if migrations_dir.exists() {
                log::info!("📁 Dossier migrations trouvé: {}", migrations_dir.display());
            } else {
                let backend_migrations = current_dir.join("backend").join("migrations");
                if backend_migrations.exists() {
                    log::info!(
                        "📁 Dossier migrations trouvé: {}",
                        backend_migrations.display()
                    );
                } else {
                    log::warn!(
                        "⚠️ Dossier migrations non trouvé dans {} ou {}/backend/migrations",
                        migrations_dir.display(),
                        current_dir.display()
                    );
                }
            }
        }

        // ✅ NOUVEAU 2026-01-29: Vérifier l'état des migrations avant exécution
        let migrations_table_exists: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
            "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '_sqlx_migrations'
        )",
        )
        .fetch_one(&pg_pool)
        .await
        .unwrap_or(false);

        // ✅ NOUVEAU 2026-01-29: CORRECTION PRÉVENTIVE - Corriger la migration 0 AVANT que SQLx n'essaie d'appliquer les migrations
        if migrations_table_exists {
            if let Ok(Some((_, desc, _, _))) = sqlx::query_as::<_, (i64, String, String, bool)>(
                "SELECT version, description, encode(checksum, 'hex') as checksum_hex, success 
             FROM _sqlx_migrations 
             WHERE version = 0",
            )
            .fetch_optional(&pg_pool)
            .await
            {
                if desc == "add delivery engine pricing" {
                    log::warn!(
                    "⚠️ PROBLÈME DÉTECTÉ: Migration 0 incorrecte détectée AVANT application SQLx"
                );
                    log::warn!(
                        "   Description en base: '{}' (devrait être 'create all tables')",
                        desc
                    );
                    log::warn!("🔧 CORRECTION AUTOMATIQUE: Suppression de l'entrée incorrecte de migration 0...");

                    match sqlx::query("DELETE FROM _sqlx_migrations WHERE version = 0")
                        .execute(&pg_pool)
                        .await
                    {
                        Ok(result) => {
                            let rows_affected: u64 = result.rows_affected();
                            if rows_affected > 0 {
                                log::info!(
                                    "✅ Migration 0 incorrecte supprimée ({} ligne(s))",
                                    rows_affected
                                );
                                log::info!("✅ La migration 0 correcte (create all tables) sera réappliquée par SQLx");
                            } else {
                                log::warn!(
                                "⚠️ Aucune ligne supprimée (migration 0 n'existe peut-être plus)"
                            );
                            }
                        }
                        Err(e) => {
                            log::error!(
                                "❌ Erreur lors de la suppression de la migration 0 incorrecte: {}",
                                e
                            );
                            log::error!("   La migration de correction 20260129_fix_migration_0_checksum.sql sera appliquée par SQLx");
                        }
                    }
                } else if desc != "create all tables" {
                    log::warn!("⚠️ Migration 0 a une description inattendue: '{}' (attendu: 'create all tables')", desc);
                } else {
                    log::debug!("✅ Migration 0 a la bonne description: '{}'", desc);
                }
            }

            let applied_count: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
                "SELECT COUNT(*) FROM _sqlx_migrations WHERE success = true",
            )
            .fetch_one(&pg_pool)
            .await
            .unwrap_or(0);
            log::info!("📊 Migrations déjà appliquées: {}", applied_count);
        } else {
            log::info!("📊 Aucune migration appliquée précédemment (première exécution)");
        }

        log::info!("🔍 [DIAGNOSTIC] Avant application des migrations - Chemin: ./migrations");
        log::info!("🔍 [DIAGNOSTIC] Vérification existence dossier migrations...");
        let migrations_check = Path::new("./migrations").exists();
        log::info!(
            "🔍 [DIAGNOSTIC] Dossier ./migrations existe: {}",
            migrations_check
        );
        if !migrations_check {
            log::error!("❌ [DIAGNOSTIC] CRITIQUE: Dossier ./migrations n'existe pas !");
            log::error!("❌ [DIAGNOSTIC] Current dir: {:?}", env::current_dir());
            log::error!(
                "❌ [DIAGNOSTIC] Contenu /app: {:?}",
                fs::read_dir("/app").ok().map(|d| d.collect::<Vec<_>>())
            );
        }

        // ✅ AMÉLIORÉ 2026-02-01: Fonction helper pour exécuter des migrations SQL
        // Utilise la même logique que execute_migration_sql_safe dans auto_migrate.rs
        async fn execute_migration_sql(pool: &PgPool, sql: &str) -> Result<(), sqlx::Error> {
            // Utiliser la fonction publique de auto_migrate.rs pour cohérence
            yukpomnang_backend::migrations::auto_migrate::execute_migration_sql_safe(pool, sql)
                .await
        }

        // ✅ CORRECTION CRITIQUE 2026-01-30: Exécuter les migrations de correction AVANT la migration 0
        // pour préparer l'environnement et éviter les erreurs pendant l'exécution de la migration 0
        // Ordre d'exécution: 20260130_002 (corrections critiques) puis 20260130_003 (corrections supplémentaires) puis 20260130_004 (correction finale)
        log::info!("🔄 [MIGRATIONS CORRECTION] Application FORCÉE des migrations de correction AVANT la migration 0...");
        log::info!("💡 Cette approche garantit que les corrections sont en place avant que la migration 0 ne crée des objets");

        // Migration 20260130_002: Corrections critiques (vue, types, tables manquantes, etc.)
        let migration_fix_1_sql =
            include_str!("../migrations/00000071_002_fix_critical_migration_errors.sql");
        log::info!(
            "🔍 [MIGRATION CORRECTION 002] Fichier chargé, taille: {} caractères",
            migration_fix_1_sql.len()
        );
        match execute_migration_sql(&pg_pool, migration_fix_1_sql).await {
            Ok(_) => {
                log::info!(
                    "✅ [MIGRATION CORRECTION 002] Migration de correction appliquée avec succès"
                );
            }
            Err(e) => {
                log::error!(
                    "❌ [MIGRATION CORRECTION 002] Erreur lors de l'application: {}",
                    e
                );
                // Ne pas arrêter l'application, continuer
            }
        }

        // Migration 20260130_003: Corrections supplémentaires (fonctions, index, colonnes, etc.)
        let migration_fix_2_sql =
            include_str!("../migrations/00000072_003_fix_additional_migration_errors.sql");
        log::info!(
            "🔍 [MIGRATION CORRECTION 003] Fichier chargé, taille: {} caractères",
            migration_fix_2_sql.len()
        );
        match execute_migration_sql(&pg_pool, migration_fix_2_sql).await {
            Ok(_) => {
                log::info!(
                    "✅ [MIGRATION CORRECTION 003] Migration de correction appliquée avec succès"
                );
            }
            Err(e) => {
                log::error!(
                    "❌ [MIGRATION CORRECTION 003] Erreur lors de l'application: {}",
                    e
                );
                // Ne pas arrêter l'application, continuer
            }
        }

        // Migration 20260130_004: Correction FINALE de toutes les erreurs
        let migration_fix_3_sql =
            include_str!("../migrations/00000073_004_fix_all_migration_errors_final.sql");
        log::info!(
            "🔍 [MIGRATION CORRECTION 004] Fichier chargé, taille: {} caractères",
            migration_fix_3_sql.len()
        );
        match execute_migration_sql(&pg_pool, migration_fix_3_sql).await {
            Ok(_) => {
                log::info!("✅ [MIGRATION CORRECTION 004] Migration de correction FINALE appliquée avec succès");
            }
            Err(e) => {
                log::error!(
                    "❌ [MIGRATION CORRECTION 004] Erreur lors de l'application: {}",
                    e
                );
                // Ne pas arrêter l'application, continuer
            }
        }

        // Migration 20260130_005: Correction des erreurs restantes (log 10)
        let migration_fix_4_sql =
            include_str!("../migrations/00000074_005_fix_remaining_migration_errors.sql");
        log::info!(
            "🔍 [MIGRATION CORRECTION 005] Fichier chargé, taille: {} caractères",
            migration_fix_4_sql.len()
        );
        match execute_migration_sql(&pg_pool, migration_fix_4_sql).await {
            Ok(_) => {
                log::info!("✅ [MIGRATION CORRECTION 005] Migration de correction des erreurs restantes appliquée avec succès");
            }
            Err(e) => {
                log::error!(
                    "❌ [MIGRATION CORRECTION 005] Erreur lors de l'application: {}",
                    e
                );
                // Ne pas arrêter l'application, continuer
            }
        }

        // Migration 20260130_006: Ajout colonnes partner_type et partner_status à users (CRITIQUE pour inscription)
        let migration_fix_5_sql =
            include_str!("../migrations/00000075_006_add_partner_columns_to_users.sql");
        log::info!(
            "🔍 [MIGRATION CORRECTION 006] Fichier chargé, taille: {} caractères",
            migration_fix_5_sql.len()
        );
        match execute_migration_sql(&pg_pool, migration_fix_5_sql).await {
            Ok(_) => {
                log::info!("✅ [MIGRATION CORRECTION 006] Colonnes partner_type et partner_status ajoutées à users");
            }
            Err(e) => {
                log::error!(
                    "❌ [MIGRATION CORRECTION 006] Erreur lors de l'application: {}",
                    e
                );
                // Ne pas arrêter l'application, continuer
            }
        }

        // Migration 20260130_007: CRITIQUE - Garantir que la table users existe (AVANT migration 0)
        let migration_fix_6_sql =
            include_str!("../migrations/00000076_007_ensure_users_table_exists.sql");
        log::info!(
            "🔍 [MIGRATION CORRECTION 007] Fichier chargé, taille: {} caractères",
            migration_fix_6_sql.len()
        );
        match execute_migration_sql(&pg_pool, migration_fix_6_sql).await {
            Ok(_) => {
                log::info!("✅ [MIGRATION CORRECTION 007] Table users garantie d'exister");
                // Vérifier que la table existe maintenant
                let users_exists_after: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);
                if users_exists_after {
                    log::info!(
                        "✅ [MIGRATION CORRECTION 007] Vérification: Table users existe bien"
                    );
                } else {
                    log::error!("❌ [MIGRATION CORRECTION 007] ERREUR CRITIQUE: Table users n'existe toujours pas après la migration!");
                }
            }
            Err(e) => {
                log::error!("❌ [MIGRATION CORRECTION 007] ERREUR CRITIQUE lors de la création de la table users: {}", e);
                log::error!("❌ [MIGRATION CORRECTION 007] L'application ne pourra pas fonctionner sans la table users!");
                // Ne pas arrêter l'application, mais c'est très grave
            }
        }

        // Migration 20260130_008: CRITIQUE - Garantir que les tables services et media existent (APRÈS users)
        let migration_fix_7_sql =
            include_str!("../migrations/00000077_008_ensure_services_and_media_tables.sql");
        log::info!(
            "🔍 [MIGRATION CORRECTION 008] Fichier chargé, taille: {} caractères",
            migration_fix_7_sql.len()
        );
        match execute_migration_sql(&pg_pool, migration_fix_7_sql).await {
            Ok(_) => {
                log::info!(
                    "✅ [MIGRATION CORRECTION 008] Tables services et media garanties d'exister"
                );
                // Vérifier que les tables existent maintenant
                let services_exists_after: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'services'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);
                let media_exists_after: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'media'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);
                if services_exists_after && media_exists_after {
                    log::info!("✅ [MIGRATION CORRECTION 008] Vérification: Tables services et media existent bien");
                } else {
                    log::error!(
                        "❌ [MIGRATION CORRECTION 008] ERREUR: services={}, media={}",
                        services_exists_after,
                        media_exists_after
                    );
                }
            }
            Err(e) => {
                log::error!("❌ [MIGRATION CORRECTION 008] Erreur lors de la création des tables services/media: {}", e);
                // Ne pas arrêter l'application, mais c'est grave
            }
        }

        // ✅ CORRECTION 2026-02-06: Migration de correction COMPLÈTE de toutes les erreurs critiques
        // Cette migration corrige:
        // - Vue matérialisée services_search_optimized_v2 (index unique)
        // - Vue product_comments_view (FROM-clause)
        // - Colonnes manquantes (retry_at, expiry_time, etc.)
        // - Trigger duplicate
        // - Erreurs de syntaxe SQL
        // Exécutée AVANT sqlx::migrate!() pour corriger les problèmes avant les autres migrations
        let migration_fix_all_critical_sql =
            include_str!("../migrations/20260206_fix_all_critical_errors_complete.sql");
        log::info!(
            "🔍 [MIGRATION CORRECTION 20260206] Fichier chargé, taille: {} caractères",
            migration_fix_all_critical_sql.len()
        );
        match execute_migration_sql(&pg_pool, migration_fix_all_critical_sql).await {
            Ok(_) => {
                log::info!("✅ [MIGRATION CORRECTION 20260206] Migration de correction COMPLÈTE appliquée avec succès");
            }
            Err(e) => {
                log::error!(
                    "❌ [MIGRATION CORRECTION 20260206] Erreur lors de l'application: {}",
                    e
                );
                // Ne pas arrêter l'application, continuer
            }
        }

        // ✅ SOLUTION CAUSE RACINE 2026-01-29: Utiliser execute_multiple_sql_commands() pour la migration 0
        // au lieu de sqlx::migrate!() qui exécute tout dans une transaction unique (timeout dans AWS)
        // Cette approche était utilisée dans Render et fonctionnait car chaque commande est exécutée individuellement
        //
        // IMPORTANT: On applique la migration 0 APRÈS les corrections pour éviter les erreurs
        // puis on laisse sqlx::migrate!() calculer le checksum correct et l'insérer dans _sqlx_migrations
        // Si la migration 0 existe déjà avec un mauvais checksum, sqlx::migrate!() va échouer,
        // donc on la supprime d'abord si nécessaire (déjà fait plus haut)
        // ✅ NOUVEAU 2026-01-31: Utiliser uniquement sqlx::migrate!() pour toutes les migrations
        // ✅ 2026-02-01: Corrections migrations - parsing amélioré, erreurs critiques corrigées
        // SQLx gère automatiquement les fichiers SQL complets, les blocs DO $$, les fonctions, etc.
        // Plus besoin de run_individual_migrations ou execute_multiple_sql_commands
        log::info!("🔄 [MIGRATIONS SQLX] Application de toutes les migrations SQLx standard...");

        // ✅ NOUVEAU 2026-02-08: Vérifier si _sqlx_migrations est vide avant d'appliquer
        let migration_count: i64 =
            sqlx::query_scalar::<sqlx::Postgres, i64>("SELECT COUNT(*) FROM _sqlx_migrations")
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(0);

        if migration_count == 0 {
            log::warn!("⚠️ [MIGRATIONS] Table _sqlx_migrations est vide - Toutes les migrations seront appliquées");
        } else {
            log::info!(
                "📊 [MIGRATIONS] {} migrations déjà enregistrées dans _sqlx_migrations",
                migration_count
            );
        }

        match sqlx::migrate!("./migrations").run(&pg_pool).await {
            Ok(_) => {
                log::info!("✅ Migrations SQLx standard appliquées avec succès");

                // ✅ NOUVEAU 2026-02-08: Vérifier quelles migrations ont été appliquées
                let applied_migrations: Vec<String> = sqlx::query_scalar::<sqlx::Postgres, String>(
                "SELECT version::text || ' - ' || description FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 10"
            )
            .fetch_all(&pg_pool)
            .await
            .unwrap_or_default();

                if !applied_migrations.is_empty() {
                    log::info!("📋 [MIGRATIONS] Dernières migrations appliquées:");
                    for migration in &applied_migrations {
                        log::info!("   - {}", migration);
                    }
                }

                log::info!("🔍 [MIGRATION CONSOLIDÉE] Vérification des tables critiques après migrations SQLx...");

                // Vérifier si la migration 20251125_fix_idx_services_search_optimized a été appliquée
                check_index_migration(&pg_pool).await;

                // ✅ NOUVEAU 2026-01-28: Vérifier que les tables de base ont été créées
                let users_exists: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);

                let services_exists: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'services'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);

                // ✅ NOUVEAU 2026-01-29: Vérifier d'autres tables critiques
                let deliveries_exists: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'deliveries'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);

                let product_creation_queue_exists: bool =
                    sqlx::query_scalar::<sqlx::Postgres, bool>(
                        "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'product_creation_queue'
                )",
                    )
                    .fetch_one(&pg_pool)
                    .await
                    .unwrap_or(false);

                let publicites_exists: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'publicites'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);

                log::info!(
                    "🔍 Vérification users: {}, services: {}",
                    users_exists,
                    services_exists
                );

                if !users_exists || !services_exists {
                    log::error!("❌ ERREUR CRITIQUE: Les tables de base n'ont pas été créées par les migrations SQLx standard");
                    log::error!(
                        "❌ users existe: {}, services existe: {}",
                        users_exists,
                        services_exists
                    );
                    log::error!(
                        "❌ Les migrations automatiques ne pourront pas s'exécuter correctement"
                    );

                    // ✅ NOUVEAU 2026-01-31: Utilisation de sqlx::migrate!() pour toutes les migrations
                    // SQLx gère automatiquement les fichiers SQL complets sans division
                    log::warn!("⚠️ [MIGRATIONS] Tables de base manquantes. Vérifiez que les migrations SQLx ont été exécutées.");

                    // Vérifier à nouveau (sans migration consolidée)
                    let users_exists_after: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                        "SELECT EXISTS (
                                SELECT FROM information_schema.tables 
                                WHERE table_schema = 'public' 
                                AND table_name = 'users'
                            )",
                    )
                    .fetch_one(&pg_pool)
                    .await
                    .unwrap_or(false);

                    let services_exists_after: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                        "SELECT EXISTS (
                                SELECT FROM information_schema.tables 
                                WHERE table_schema = 'public' 
                                AND table_name = 'services'
                            )",
                    )
                    .fetch_one(&pg_pool)
                    .await
                    .unwrap_or(false);

                    if users_exists_after && services_exists_after {
                        log::info!("✅ Tables de base créées par la migration consolidée");
                    } else {
                        log::error!(
                        "❌ Migration consolidée appliquée mais tables de base toujours manquantes"
                    );
                    }
                } else {
                    log::info!(
                        "✅ Tables de base (users, services) vérifiées après migrations SQLx"
                    );
                }

                // ✅ NOUVEAU 2026-02-08: Vérifier les nouvelles tables critiques créées récemment
                let user_saved_addresses_exists: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'user_saved_addresses'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);

                let courier_profiles_exists: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'courier_profiles'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);

                let delivery_requests_view_exists: bool =
                    sqlx::query_scalar::<sqlx::Postgres, bool>(
                        "SELECT EXISTS (
                    SELECT FROM pg_views 
                    WHERE schemaname = 'public' 
                    AND viewname = 'delivery_requests'
                )",
                    )
                    .fetch_one(&pg_pool)
                    .await
                    .unwrap_or(false);

                // ✅ NOUVEAU 2026-02-08: Vérifier les fonctions critiques
                let calculate_best_vector_match_score_exists: bool =
                    sqlx::query_scalar::<sqlx::Postgres, bool>(
                        "SELECT EXISTS (
                    SELECT FROM pg_proc p
                    LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public'
                    AND p.proname = 'calculate_best_vector_match_score'
                )",
                    )
                    .fetch_one(&pg_pool)
                    .await
                    .unwrap_or(false);

                let product_combination_exists_func: bool =
                    sqlx::query_scalar::<sqlx::Postgres, bool>(
                        "SELECT EXISTS (
                    SELECT FROM pg_proc p
                    LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public'
                    AND p.proname = 'product_combination_exists'
                )",
                    )
                    .fetch_one(&pg_pool)
                    .await
                    .unwrap_or(false);

                log::info!(
                "🔍 [MIGRATIONS] Vérification tables/fonctions critiques récentes: user_saved_addresses={}, courier_profiles={}, delivery_requests={}, calculate_best_vector_match_score={}, product_combination_exists={}",
                user_saved_addresses_exists,
                courier_profiles_exists,
                delivery_requests_view_exists,
                calculate_best_vector_match_score_exists,
                product_combination_exists_func
            );

                // ✅ NOUVEAU 2026-02-08: Alerter si tables/fonctions critiques manquantes
                let mut missing_critical_items = Vec::new();
                if !user_saved_addresses_exists {
                    missing_critical_items.push("user_saved_addresses");
                }
                if !courier_profiles_exists {
                    missing_critical_items.push("courier_profiles");
                }
                if !delivery_requests_view_exists {
                    missing_critical_items.push("delivery_requests (vue)");
                }
                if !calculate_best_vector_match_score_exists {
                    missing_critical_items.push("calculate_best_vector_match_score (fonction)");
                }
                if !product_combination_exists_func {
                    missing_critical_items.push("product_combination_exists (fonction)");
                }

                if !missing_critical_items.is_empty() {
                    log::warn!(
                        "⚠️ [MIGRATIONS] Éléments critiques manquants: {:?}",
                        missing_critical_items
                    );
                    log::warn!(
                        "⚠️ [MIGRATIONS] Ces éléments devraient être créés par les migrations SQLx"
                    );
                    log::warn!(
                        "⚠️ [MIGRATIONS] Vérifiez que les migrations 20260207_* ont été appliquées"
                    );

                    // En production, on peut choisir d'arrêter l'application
                    let app_env = env::var("APP_ENV").unwrap_or_default();
                    if app_env == "production" {
                        log::error!("❌ [MIGRATIONS] PRODUCTION: Éléments critiques manquants - Application peut ne pas fonctionner correctement");
                        // Note: On ne panique pas car les migrations peuvent être appliquées manuellement
                    }
                } else {
                    log::info!(
                    "✅ [MIGRATIONS] Toutes les tables/fonctions critiques récentes sont présentes"
                );
                }

                // ✅ NOUVEAU 2026-01-29: Vérifier toutes les tables critiques manquantes dans les logs AWS
                let critical_tables = vec![
                    ("deliveries", deliveries_exists),
                    ("product_creation_queue", product_creation_queue_exists),
                    ("user_saved_addresses", user_saved_addresses_exists),
                    ("courier_profiles", courier_profiles_exists),
                    (
                        "delivery_matching_queue",
                        sqlx::query_scalar::<sqlx::Postgres, bool>(
                            "SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'delivery_matching_queue'
                    )",
                        )
                        .fetch_one(&pg_pool)
                        .await
                        .unwrap_or(false),
                    ),
                    (
                        "global_promo_events",
                        sqlx::query_scalar::<sqlx::Postgres, bool>(
                            "SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'global_promo_events'
                    )",
                        )
                        .fetch_one(&pg_pool)
                        .await
                        .unwrap_or(false),
                    ),
                    (
                        "live_flash_sales",
                        sqlx::query_scalar::<sqlx::Postgres, bool>(
                            "SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'live_flash_sales'
                    )",
                        )
                        .fetch_one(&pg_pool)
                        .await
                        .unwrap_or(false),
                    ),
                    (
                        "product_orders",
                        sqlx::query_scalar::<sqlx::Postgres, bool>(
                            "SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'product_orders'
                    )",
                        )
                        .fetch_one(&pg_pool)
                        .await
                        .unwrap_or(false),
                    ),
                    (
                        "social_publication_jobs",
                        sqlx::query_scalar::<sqlx::Postgres, bool>(
                            "SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'social_publication_jobs'
                    )",
                        )
                        .fetch_one(&pg_pool)
                        .await
                        .unwrap_or(false),
                    ),
                    (
                        "video_generation_jobs",
                        sqlx::query_scalar::<sqlx::Postgres, bool>(
                            "SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'video_generation_jobs'
                    )",
                        )
                        .fetch_one(&pg_pool)
                        .await
                        .unwrap_or(false),
                    ),
                    (
                        "delivery_proximity_suggestions",
                        sqlx::query_scalar::<sqlx::Postgres, bool>(
                            "SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'delivery_proximity_suggestions'
                    )",
                        )
                        .fetch_one(&pg_pool)
                        .await
                        .unwrap_or(false),
                    ),
                    ("publicites", publicites_exists),
                ];

                let missing_tables: Vec<&str> = critical_tables
                    .iter()
                    .filter_map(|(name, exists)| if !exists { Some(*name) } else { None })
                    .collect();

                log::info!("📊 État des tables critiques: deliveries={}, product_creation_queue={}, delivery_matching_queue={}, global_promo_events={}, live_flash_sales={}, product_orders={}, social_publication_jobs={}, video_generation_jobs={}, delivery_proximity_suggestions={}, publicites={}",
                deliveries_exists, product_creation_queue_exists,
                critical_tables[2].1, critical_tables[3].1, critical_tables[4].1,
                critical_tables[5].1, critical_tables[6].1, critical_tables[7].1,
                critical_tables[8].1, publicites_exists);

                if !missing_tables.is_empty() {
                    log::error!("❌ ERREUR CRITIQUE: {} table(s) critique(s) manquante(s) après les migrations:", missing_tables.len());
                    for table in &missing_tables {
                        log::error!("   - {}", table);
                    }
                    log::error!(
                        "❌ Les workers et services dépendant de ces tables ne fonctionneront pas"
                    );
                    log::error!(
                        "❌ CAUSE PROBABLE: Les migrations n'ont pas été appliquées correctement"
                    );

                    // ✅ NOUVEAU 2026-01-31: Utilisation de sqlx::migrate!() pour toutes les migrations
                    log::warn!("⚠️ [MIGRATIONS] Tables manquantes: {:?}", missing_tables);
                    log::warn!("⚠️ [MIGRATIONS] Vérifiez que les migrations SQLx ont été exécutées correctement.");

                    // ✅ 2026-03-23: Tables critiques manquantes → mode dégradé (pas d’arrêt du processus)
                    if !missing_tables.is_empty() {
                        log::error!("❌ ERREUR CRITIQUE: {} table(s) critique(s) toujours manquante(s) après toutes les tentatives de migration:", missing_tables.len());
                        for table in &missing_tables {
                            log::error!("   - {}", table);
                        }

                        // ✅ CORRIGÉ 2026-03-23: NE PLUS QUITTER même en production — continuer en mode dégradé
                        // Le serveur shell répond déjà sur /health, /healthz, / — la startup probe peut réussir
                        // Les routes API renverront 503 (Service Unavailable) via le fallback
                        log::error!("❌ Tables critiques manquantes — Application continue en mode dégradé (API désactivée)");
                        eprintln!("[MAIN] 🚨 CRITIQUE: Le serveur HTTP continue de tourner sur le port 8080 (/health répond)");
                        eprintln!("[MAIN] 📝 L'application fonctionnera sans les tables critiques (mode dégradé)");
                        eprintln!("[MAIN] 🔧 ACTION REQUISE: Exécuter les migrations manuellement");
                        // Marquer comme mode dégradé pour que les routes API renvoient 503
                        degraded_mode = true;
                        log::warn!("⚠️ Continuation avec fonctionnalités limitées (mode dégradé)");
                    }
                } else {
                    log::info!("✅ Toutes les tables critiques existent");
                }

                // ✅ CORRECTION 2026-02-02: Corriger l'index unique de services_search_optimized_v2
                // Cette migration doit être exécutée APRÈS les migrations SQLx car la vue matérialisée
                // doit exister avant de créer l'index unique
                let migration_fix_index_sql =
                    include_str!("../migrations/00000142_fix_materialized_view_index.sql");
                log::info!(
                "🔍 [MIGRATION CORRECTION INDEX] Application de la correction de l'index unique pour services_search_optimized_v2..."
            );
                match execute_migration_sql(&pg_pool, migration_fix_index_sql).await {
                    Ok(_) => {
                        log::info!(
                        "✅ [MIGRATION CORRECTION INDEX] Index unique pour services_search_optimized_v2 vérifié/créé"
                    );
                    }
                    Err(e) => {
                        log::warn!(
                        "⚠️ [MIGRATION CORRECTION INDEX] Erreur lors de la création de l'index unique (non bloquant): {}",
                        e
                    );
                    }
                }

                // ✅ CORRECTION 2026-02-02: Forcer la mise à jour de refresh_services_search_optimized()
                // Cette migration doit être exécutée APRÈS la création de l'index pour s'assurer que
                // la fonction a la logique de création automatique de l'index
                let migration_fix_function_sql = include_str!(
                    "../migrations/20260202_fix_refresh_services_search_optimized_function.sql"
                );
                log::info!(
                "🔍 [MIGRATION CORRECTION FUNCTION] Application de la correction de refresh_services_search_optimized()..."
            );
                match execute_migration_sql(&pg_pool, migration_fix_function_sql).await {
                    Ok(_) => {
                        log::info!(
                        "✅ [MIGRATION CORRECTION FUNCTION] Fonction refresh_services_search_optimized() mise à jour avec création automatique de l'index"
                    );
                    }
                    Err(e) => {
                        log::warn!(
                        "⚠️ [MIGRATION CORRECTION FUNCTION] Erreur lors de la mise à jour de la fonction (non bloquant): {}",
                        e
                    );
                    }
                }
            }
            Err(e) => {
                let error_str = e.to_string();
                log::error!(
                    "❌ ERREUR DÉTAILLÉE lors de l'application des migrations SQLx standard:"
                );
                log::error!("   Type: {:?}", e);
                log::error!("   Message: {}", error_str);

                // ✅ NOUVEAU 2026-01-29: Logs supplémentaires pour diagnostic
                if let Some(source) = e.source() {
                    log::error!("   Source: {}", source);
                }

                // ✅ NOUVEAU 2026-02-08: Vérifier l'état de _sqlx_migrations après erreur
                let migration_count_after_error: i64 = sqlx::query_scalar::<sqlx::Postgres, i64>(
                    "SELECT COUNT(*) FROM _sqlx_migrations",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(0);

                log::error!(
                    "❌ [MIGRATIONS] Nombre de migrations enregistrées après erreur: {}",
                    migration_count_after_error
                );

                // ✅ NOUVEAU 2026-02-08: Vérifier les tables critiques même après erreur
                let users_exists_after_error: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);

                if !users_exists_after_error {
                    log::error!(
                    "❌ [MIGRATIONS] CRITIQUE: Table 'users' manquante après échec des migrations"
                );
                    let app_env = env::var("APP_ENV").unwrap_or_default();
                    if app_env == "production" {
                        log::error!("❌ [MIGRATIONS] PRODUCTION: Application ne peut pas démarrer sans table 'users'");
                        // On continue quand même pour permettre l'application manuelle des migrations
                    }
                }

                // ✅ SUPPRIMÉ 2026-01-31: Migration consolidée redondante supprimée
                // ✅ NOUVEAU 2026-01-31: Utilisation de sqlx::migrate!() pour toutes les migrations
                log::warn!(
                "⚠️ [MIGRATIONS] SQLx a échoué. Vérifiez les logs ci-dessus pour plus de détails."
            );
                log::warn!("⚠️ [MIGRATIONS] Les migrations individuelles doivent être appliquées avant sqlx::migrate!()");
                log::warn!("⚠️ [MIGRATIONS] Action recommandée: Appliquer les migrations manuellement via psql ou script PowerShell");

                // Ignorer l'erreur de checksum mismatch pour la migration 0 (fichier modifié)
                if error_str.contains("migration 0 was previously applied but has been modified") {
                    log::warn!("⚠️ Migration 0 modifiée détectée (ignorée)");
                    log::error!("🔍 DIAGNOSTIC DÉTAILLÉ Migration 0:");

                    // ✅ NOUVEAU 2026-01-29: Afficher les détails de la migration 0
                    if migrations_table_exists {
                        if let Ok(Some((version, desc, checksum_hex, success))) = sqlx::query_as::<_, (i64, String, String, bool)>(
                        "SELECT version, description, encode(checksum, 'hex') as checksum_hex, success 
                         FROM _sqlx_migrations 
                         WHERE version = 0"
                    )
                    .fetch_optional(&pg_pool)
                    .await
                    {
                            log::error!("   Version: {}", version);
                            log::error!("   Description (en base): {}", desc);
                            log::error!("   Checksum actuel (en base): {}", checksum_hex);
                            log::error!("   Succès: {}", success);

                            // ✅ NOUVEAU 2026-01-29: Vérifier si la description correspond au fichier attendu
                            if desc != "create all tables" && desc != "add delivery engine pricing" {
                                log::error!("   ⚠️ ATTENTION: La description ne correspond à aucun fichier 0000 connu");
                            } else if desc == "add delivery engine pricing" {
                                log::error!("   ⚠️ PROBLÈME DÉTECTÉ: La migration 0 en base est 'add delivery engine pricing'");
                                log::error!("   ⚠️ Mais SQLx attend 'create all tables' comme migration 0");
                                log::error!("   ⚠️ CAUSE: Il y avait deux fichiers commençant par '0000' dans migrations/");
                                log::error!("   ✅ CORRIGÉ: Le fichier conflictuel 0000_add_delivery_engine_pricing.sql a été supprimé");
                                log::error!("   ✅ CORRIGÉ: Une migration de correction existe: 20260129_fix_migration_0_checksum.sql");
                                log::error!("   💡 SOLUTION: La migration de correction sera appliquée automatiquement au prochain démarrage");
                                log::error!("   💡 Elle supprimera l'entrée incorrecte de migration 0 pour permettre la réapplication correcte");
                            } else {
                                log::error!("   ⚠️ Le checksum d'une migration a changé depuis l'application");
                        }
                    }

                        // Lister toutes les migrations appliquées
                        if let Ok(applied_migrations) = sqlx::query_as::<_, (i64, String, bool)>(
                            "SELECT version, description, success 
                         FROM _sqlx_migrations 
                         ORDER BY version",
                        )
                        .fetch_all(&pg_pool)
                        .await
                        {
                            let successful: Vec<&(i64, String, bool)> = applied_migrations
                                .iter()
                                .filter(|(_, _, success)| *success)
                                .collect();
                            let failed: Vec<_> = applied_migrations
                                .iter()
                                .filter(|(_, _, success)| !*success)
                                .collect();

                            log::error!(
                                "   📊 Migrations en base: {} réussies, {} échouées",
                                successful.len(),
                                failed.len()
                            );

                            if !successful.is_empty() && successful.len() <= 10 {
                                log::error!("   ✅ Migrations réussies:");
                                for (version, desc, _) in successful.iter().take(10) {
                                    log::error!("      - Version {}: {}", version, desc);
                                }
                            }

                            if !failed.is_empty() {
                                log::error!("   ⚠️ Migrations échouées:");
                                for (version, desc, _) in failed {
                                    log::error!("      - Version {}: {}", version, desc);
                                }
                            }

                            // ✅ NOUVEAU 2026-01-29: Avertissement si seulement 1 migration appliquée
                            if successful.len() == 1 {
                                log::error!("   ⚠️ ATTENTION: Seulement 1 migration appliquée - La migration 0 devrait créer toutes les tables de base");
                                log::error!("   ⚠️ Si les tables (users, services) n'existent pas, la migration 0 n'a pas créé les bonnes tables");
                            }
                        }
                    }

                    // ✅ NOUVEAU 2026-01-29: Solution adaptée selon le problème détecté
                    if migrations_table_exists {
                        if let Ok(Some((_, desc, _, _))) = sqlx::query_as::<_, (i64, String, String, bool)>(
                        "SELECT version, description, encode(checksum, 'hex') as checksum_hex, success 
                         FROM _sqlx_migrations 
                         WHERE version = 0"
                    )
                    .fetch_optional(&pg_pool)
                    .await
                    {
                        if desc == "add delivery engine pricing" {
                            log::error!("🔧 SOLUTION SPÉCIFIQUE - Migration 0 incorrecte:");
                            log::error!("   ✅ CORRIGÉ: Le fichier conflictuel a été supprimé");
                            log::error!("   ✅ CORRIGÉ: Une migration de correction existe: 20260129_fix_migration_0_checksum.sql");
                            log::error!("   💡 La migration de correction sera appliquée automatiquement");
                            log::error!("   💡 Elle supprimera l'entrée incorrecte et permettra la réapplication de la migration 0 correcte");
                            log::error!("   💡 Si la migration de correction n'est pas appliquée automatiquement:");
                            log::error!("      1. Exécuter manuellement: DELETE FROM _sqlx_migrations WHERE version = 0;");
                            log::error!("      2. Relancer l'application pour appliquer la bonne migration 0 (create all tables)");
                        } else {
                            log::error!("🔧 SOLUTION: Pour corriger le checksum de la migration 0:");
                            log::error!("   1. Vérifier les migrations individuelles dans backend/migrations/");
                            log::error!("   2. Exécuter: UPDATE _sqlx_migrations SET checksum = decode('NOUVEAU_CHECKSUM_HEX', 'hex') WHERE version = 0;");
                            log::error!("   3. Relancer l'application pour appliquer les migrations en attente");
                        }
                    } else {
                        log::error!("🔧 SOLUTION: Pour corriger le checksum de la migration 0:");
                        log::error!("   1. Vérifier les migrations individuelles dans backend/migrations/");
                        log::error!("   2. Exécuter: UPDATE _sqlx_migrations SET checksum = decode('NOUVEAU_CHECKSUM_HEX', 'hex') WHERE version = 0;");
                        log::error!("   3. Relancer l'application pour appliquer les migrations en attente");
                    }
                    } else {
                        log::error!("🔧 SOLUTION: Pour corriger le checksum de la migration 0:");
                        log::error!("   1. Calculer le nouveau checksum du fichier migrations/0000_create_all_tables.sql");
                        log::error!("   2. Exécuter: UPDATE _sqlx_migrations SET checksum = decode('NOUVEAU_CHECKSUM_HEX', 'hex') WHERE version = 0;");
                        log::error!(
                            "   3. Relancer l'application pour appliquer les migrations en attente"
                        );
                    }
                    log::warn!(
                    "⚠️ Continuation du démarrage, mais les migrations ne seront pas appliquées"
                );
                    log::info!(
                        "ℹ️ Continuation du démarrage malgré l'avertissement de migration modifiée"
                    );
                } else {
                    log::error!(
                        "❌ ERREUR CRITIQUE lors de l'application des migrations SQLx standard: {}",
                        e
                    );
                    log::error!("❌ Les migrations SQLx standard sont OBLIGATOIRES pour créer les tables de base (users, services)");
                    log::error!("❌ Les migrations automatiques ne pourront pas s'exécuter correctement sans ces tables");

                    // ✅ NOUVEAU 2026-01-29: Diagnostic complet des tables manquantes
                    log::error!("🔍 DIAGNOSTIC COMPLET:");
                    let critical_tables = vec![
                        "users",
                        "services",
                        "deliveries",
                        "product_creation_queue",
                        "publicites",
                        "pharmacies",
                        "matching_offres_candidats",
                        "live_flash_sales",
                        "global_promo_events",
                        "delivery_matching_queue",
                        "video_generation_jobs",
                        "delivery_proximity_suggestions",
                        "product_orders",
                        "social_publication_jobs",
                    ];

                    let mut missing_tables: Vec<&str> = Vec::new();
                    for table in &critical_tables {
                        let exists: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(&format!(
                            "SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = '{}'
                        )",
                            table
                        ))
                        .fetch_one(&pg_pool)
                        .await
                        .unwrap_or(false);

                        if !exists {
                            missing_tables.push(*table);
                        }
                    }

                    if !missing_tables.is_empty() {
                        log::error!(
                            "   📋 Tables manquantes ({}/{}):",
                            missing_tables.len(),
                            critical_tables.len()
                        );
                        for table in &missing_tables {
                            log::error!("      - {}", table);
                        }
                    }

                    log::error!("🔍 VÉRIFICATIONS:");
                    log::error!(
                        "   1. Que le dossier 'migrations' existe et contient des fichiers .sql"
                    );
                    log::error!("   2. Que la connexion à la base de données fonctionne");
                    log::error!(
                        "   3. Que l'utilisateur PostgreSQL a les permissions CREATE TABLE"
                    );
                    log::error!("   4. Que la migration 0 n'a pas été modifiée après application");
                    log::error!("   5. Les logs PostgreSQL pour plus de détails");
                    log::error!("🔧 SOLUTION: Exécuter manuellement les migrations:");
                    log::error!("   cd backend && sqlx migrate run");

                    // ✅ 2026-03-23: Échec SQLx + tables manquantes → mode dégradé (pas d’arrêt du processus)
                    if !missing_tables.is_empty() {
                        log::error!("❌ ERREUR CRITIQUE: {} table(s) critique(s) manquante(s) après échec SQLx:", missing_tables.len());
                        for table in &missing_tables {
                            log::error!("   - {}", table);
                        }

                        // ✅ CORRIGÉ 2026-03-23: NE PLUS QUITTER même en production — continuer en mode dégradé
                        // Le serveur shell répond déjà sur /health, /healthz, / — la startup probe peut réussir
                        // Les routes API renverront 503 (Service Unavailable) via le fallback
                        log::error!("❌ Tables critiques manquantes après échec SQLx — Application continue en mode dégradé (API désactivée)");
                        eprintln!("[MAIN] 🚨 CRITIQUE: Le serveur HTTP continue de tourner sur le port 8080 (/health répond)");
                        eprintln!("[MAIN] 📝 L'application fonctionnera sans les tables critiques (mode dégradé)");
                        eprintln!("[MAIN] 🔧 ACTION REQUISE: Exécuter les migrations manuellement");
                        // Marquer comme mode dégradé pour que les routes API renvoient 503
                        degraded_mode = true;
                        log::warn!("⚠️ Continuation avec fonctionnalités limitées (mode dégradé)");
                    } else {
                        log::warn!("⚠️ Continuation du démarrage, mais certaines fonctionnalités peuvent être indisponibles");
                    }
                }
            }
        }

        // 🔄 Exécuter les migrations automatiques au démarrage (optionnel)
        // ✅ CORRIGÉ RACINE 2025-12-12: Désactiver auto_migrations par défaut en production
        // Le problème: Les blocs DO $$ lourds dans auto_migrations causent des crashes PostgreSQL
        // Solution: Les rendre optionnelles via variable d'environnement (désactivées par défaut)
        let enable_auto_migrations_raw =
            env::var("ENABLE_AUTO_MIGRATIONS").unwrap_or_else(|_| "false".to_string());

        // Parser de manière tolérante (trim, lowercase, accepte "true", "1", "yes", etc.)
        let enable_auto_migrations = {
            let trimmed = enable_auto_migrations_raw.trim().to_lowercase();
            trimmed == "true" || trimmed == "1" || trimmed == "yes" || trimmed == "on"
        };

        log::info!(
            "🔍 ENABLE_AUTO_MIGRATIONS: raw='{}', parsed={}",
            enable_auto_migrations_raw,
            enable_auto_migrations
        );

        if enable_auto_migrations {
            if is_cloud_run {
                // Pour Cloud Run: lancer les migrations en arrière-plan (non-bloquant)
                log::info!("🚀 Cloud Run: Migrations automatiques lancées en arrière-plan");
                eprintln!("[MAIN] 🚀 Cloud Run: Migrations automatiques lancées en arrière-plan");
                let pool_for_migrations = pg_pool.clone();
                tokio::spawn(async move {
                    // Attendre un peu que la connexion DB soit prête
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

                    log::info!(
                        "🔍 Vérification des tables de base avant migrations automatiques..."
                    );
                    let users_exists: bool = match tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        sqlx::query_scalar::<sqlx::Postgres, bool>(
                            "SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = 'users'
                        )",
                        )
                        .fetch_one(&pool_for_migrations),
                    )
                    .await
                    {
                        Ok(Ok(exists)) => exists,
                        _ => false,
                    };

                    let services_exists: bool = match tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        sqlx::query_scalar::<sqlx::Postgres, bool>(
                            "SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = 'services'
                        )",
                        )
                        .fetch_one(&pool_for_migrations),
                    )
                    .await
                    {
                        Ok(Ok(exists)) => exists,
                        _ => false,
                    };

                    if !users_exists || !services_exists {
                        log::warn!(
                            "⚠️ Cloud Run: Tables de base manquantes: users={}, services={}",
                            users_exists,
                            services_exists
                        );
                        log::warn!("⚠️ Les migrations automatiques seront réessayées plus tard");
                    } else {
                        log::info!("✅ Tables de base (users, services) vérifiées - Exécution des migrations automatiques...");
                        yukpomnang_backend::migrations::auto_migrate::run_auto_migrations(
                            &pool_for_migrations,
                        )
                        .await;
                    }
                });
            } else {
                // Pour autres environnements: migrations bloquantes (comportement normal)
                log::info!("🔍 Vérification des tables de base avant migrations automatiques...");

                let users_exists: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);

                let services_exists: bool = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'services'
                )",
                )
                .fetch_one(&pg_pool)
                .await
                .unwrap_or(false);

                if !users_exists || !services_exists {
                    log::error!(
                        "❌ ERREUR CRITIQUE: Impossible d'exécuter les migrations automatiques"
                    );
                    log::error!(
                        "❌ Tables de base manquantes: users={}, services={}",
                        users_exists,
                        services_exists
                    );
                    log::error!("❌ Les migrations SQLx standard doivent être appliquées AVANT les migrations automatiques");
                    log::error!("❌ Vérifiez que:");
                    log::error!("   1. Les migrations SQLx standard ont été exécutées avec succès");
                    log::error!(
                    "   2. La table _sqlx_migrations existe et contient les migrations appliquées"
                );
                    log::error!(
                        "   3. Les fichiers de migration dans backend/migrations/ sont corrects"
                    );
                    log::error!(
                    "❌ Les migrations automatiques sont ANNULÉES pour éviter des erreurs en cascade"
                );
                } else {
                    log::info!("✅ Tables de base (users, services) vérifiées - Exécution des migrations automatiques...");
                    yukpomnang_backend::migrations::auto_migrate::run_auto_migrations(&pg_pool)
                        .await;
                }
            }
        } else {
            log::info!("⏭️ Migrations automatiques désactivées (ENABLE_AUTO_MIGRATIONS={}) - Pour activer: ENABLE_AUTO_MIGRATIONS=true", enable_auto_migrations_raw);
        }
    } else {
        if is_cloud_run {
            log::info!("⏭️ Cloud Run: Migrations SQLx désactivées (ENABLE_SQLX_MIGRATIONS=false ou non défini)");
            log::info!("ℹ️ Pour activer les migrations SQLx sur Cloud Run, définissez ENABLE_SQLX_MIGRATIONS=true");
            log::info!("ℹ️ Note: Les migrations SQLx doivent être exécutées au moins une fois pour créer les tables de base");
        }
    } // Fin du bloc if should_run_sqlx_migrations pour les migrations SQLx

    // ✅ NOUVEAU 2025-11-27: Démarrer le monitoring de santé du pool
    yukpomnang_backend::utils::db_monitor::start_db_health_monitor(pg_pool.clone()).await;

    // ✅ 2026-03-16: MongoDB supprimé, tout est dans PostgreSQL (table history_events)
    log::info!("✅ MongoDB supprimé - Historisation via PostgreSQL (history_events)");

    // Configuration Redis avec test de connexion
    let mut redis_url =
        env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());

    // ✅ CRITIQUE 2026-02-18: Détecter et rejeter les placeholders
    if redis_url.contains("PLACEHOLDER")
        || redis_url.contains("REMPLACER")
        || redis_url.contains("VRAIE_VALEUR")
    {
        log::error!(
            "❌ ERREUR CRITIQUE: REDIS_URL contient un placeholder au lieu d'une vraie URL !"
        );
        log::error!("   Valeur actuelle: {}", redis_url);
        log::error!("   Veuillez mettre à jour le secret redis-url dans Secret Manager avec une vraie URL Redis.");
        log::warn!("⚠️ Redis sera désactivé jusqu'à ce que le secret soit corrigé.");
        // Utiliser une URL invalide mais qui ne causera pas de crash immédiat
        redis_url = "redis://invalid-placeholder:6379/0".to_string();
    }

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
            redis_url.push('0');
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

    // ✅ NOUVEAU 2026-02-19: Détecter si c'est une IP privée et utiliser connexion TCP directe
    use yukpomnang_backend::utils::redis_helper;
    let use_direct_tcp = redis_helper::is_private_ip_or_internal_host(&redis_url);

    if use_direct_tcp {
        log::info!("🔧 Redis: IP privée ou hôte interne détecté - Utilisation connexion TCP directe (sans résolution DNS)");

        // Extraire l'IP et le port
        if let Some((ip, port)) = redis_helper::extract_ip_and_port(&redis_url) {
            log::info!("   IP: {}, Port: {}", ip, port);

            // Créer le client avec l'IP directement dans l'URL (sans nom d'hôte)
            let redis_url_direct = format!("redis://{}:{}/0", ip, port);

            // Créer un client Redis avec l'URL directe
            match RedisClient::open(redis_url_direct.as_str()) {
                Ok(client) => {
                    // Tester la connexion avec retry
                    use tokio::time::{timeout, Duration};

                    let timeout_secs = if is_cloud_run { 2 } else { 10 };
                    let (is_available, error_detail) = match timeout(
                        Duration::from_secs(timeout_secs),
                        redis_helper::check_redis_health_with_error(&client),
                    )
                    .await
                    {
                        Ok(result) => result,
                        Err(_) => {
                            log::warn!(
                                "⚠️ Redis: Timeout de connexion ({}s) - Redis non accessible",
                                timeout_secs
                            );
                            (
                                false,
                                Some(format!("Connection timeout after {} seconds", timeout_secs)),
                            )
                        }
                    };

                    if is_available {
                        log::info!("✅ Connexion Redis TCP directe établie avec succès");
                        println!("✅ Connexion Redis TCP directe établie - Backend v2.1.4");
                        // Continuer avec le client normal
                        // Le client utilisera l'IP directement, mais peut encore essayer la résolution DNS
                        // On doit modifier get_redis_connection pour utiliser TCP direct
                    } else {
                        log::warn!(
                            "⚠️ Redis: Échec de connexion TCP directe - URL: {}...",
                            redis_url_display
                        );
                        if let Some(ref err) = error_detail {
                            log::warn!("   🔍 Détails de l'erreur: {}", err);
                        }
                    }
                }
                Err(e) => {
                    log::warn!(
                        "⚠️ Redis: Impossible de créer le client avec IP directe: {}",
                        e
                    );
                }
            }
        } else {
            log::warn!("⚠️ Redis: Impossible d'extraire l'IP et le port de l'URL");
        }
    }

    // Créer un client Redis et tester la connexion avec retry
    let (redis_client, redis_available_for_ws) = match RedisClient::open(redis_url.clone()) {
        Ok(client) => {
            // ✅ CORRIGÉ: Utiliser le helper Redis avec retry pour tester la connexion
            use tokio::time::{timeout, Duration};
            use yukpomnang_backend::utils::redis_helper;

            // ✅ CORRIGÉ: Ajouter un timeout de 10 secondes pour éviter que l'application bloque indéfiniment
            // get_redis_connection a maintenant un timeout de 10s par tentative (3 tentatives = max 30s)
            // Ce timeout de 10s est une sécurité supplémentaire
            // ✅ OPTIMISÉ Cloud Run: Réduire timeout à 2s pour démarrage rapide
            let timeout_secs = if is_cloud_run { 2 } else { 10 };
            let (is_available, error_detail) = match timeout(
                Duration::from_secs(timeout_secs),
                redis_helper::check_redis_health_with_error(&client),
            )
            .await
            {
                Ok(result) => result,
                Err(_) => {
                    log::warn!(
                        "⚠️ Redis: Timeout de connexion ({}s) - Redis non accessible",
                        timeout_secs
                    );
                    (
                        false,
                        Some(format!("Connection timeout after {} seconds", timeout_secs)),
                    )
                }
            };
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

    // ✅ DIAGNOSTIC 2026-02-19: Vérifier OPENAI_API_KEY avant initialisation AppIA
    let openai_key_check = std::env::var("OPENAI_API_KEY");
    match &openai_key_check {
        Ok(key) => {
            log::info!(
                "[MAIN] ✅ OPENAI_API_KEY détectée avant initialisation AppIA (longueur: {}, préfixe: {}...)",
                key.len(),
                &key[..std::cmp::min(20, key.len())]
            );
            eprintln!(
                "[MAIN] ✅ OPENAI_API_KEY détectée avant initialisation AppIA (longueur: {})",
                key.len()
            );
        }
        Err(e) => {
            log::error!(
                "[MAIN] ❌ OPENAI_API_KEY NON TROUVÉE avant initialisation AppIA: {}",
                e
            );
            eprintln!(
                "[MAIN] ❌ OPENAI_API_KEY NON TROUVÉE avant initialisation AppIA: {}",
                e
            );
        }
    }

    let app_ia = Arc::new(AppIA::new(
        redis_client.clone(),
        ia_stats.clone(),
        pg_pool.clone(),
    ));

    // ✅ DIAGNOSTIC 2026-02-19: Vérifier combien de modèles ont été initialisés
    let models_count = app_ia.models.read().await.len();
    log::info!(
        "[MAIN] ✅ AppIA initialisé avec {} modèle(s) IA",
        models_count
    );
    eprintln!(
        "[MAIN] ✅ AppIA initialisé avec {} modèle(s) IA",
        models_count
    );

    if models_count == 0 {
        log::warn!(
            "[MAIN] ⚠️ ATTENTION: Aucun modèle IA initialisé - Le système utilisera uniquement le fallback"
        );
        eprintln!(
            "[MAIN] ⚠️ ATTENTION: Aucun modèle IA initialisé - Le système utilisera uniquement le fallback"
        );
    }

    // ✅ Cloner redis_client pour le healthcheck avant de le déplacer dans AppState
    let redis_client_healthcheck = redis_client.clone();

    let app_state = Arc::new(AppState::new(
        pg_pool.clone(),
        pg_read_pool, // ✅ NOUVEAU 2025-12-02: Read replica pour scaling horizontal
        app_ia,
        ia_stats,
        redis_client,
        redis_available_for_ws,
        degraded_mode, // ✅ CORRIGÉ 2026-03-23: Passer le flag de mode dégradé
    ));

    // ✅ OPTIMISÉ Cloud Run 2026-02-14: Lancer toutes les migrations SQLx en arrière-plan pour Cloud Run
    // ✅ CORRIGÉ 2026-04-01: Réutiliser pg_pool (déjà configuré avec PgConnectOptions + attente socket)
    //    au lieu de créer un nouveau pool avec connect_lazy(URL) qui échoue pour les Unix sockets Cloud SQL
    if is_cloud_run {
        let pg_for_migrations = pg_pool.clone();

        log::info!("✅ Cloud Run: Migrations SQLx utiliseront le pool principal (déjà connecté via Unix socket)");

        tokio::spawn(async move {
            log::info!("🚀 Cloud Run: Démarrage des migrations SQLx en arrière-plan...");
            // Attendre que le pool principal ait établi au moins une connexion
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;

            // Exécuter sqlx::migrate!() en arrière-plan avec le pool principal
            log::info!("🔄 [MIGRATIONS SQLX Cloud Run] Application de toutes les migrations SQLx standard en arrière-plan...");
            match sqlx::migrate!("./migrations").run(&pg_for_migrations).await {
                Ok(_) => {
                    log::info!("✅ [MIGRATIONS SQLX Cloud Run] Migrations SQLx standard appliquées avec succès");
                }
                Err(e) => {
                    log::error!("❌ [MIGRATIONS SQLX Cloud Run] Erreur lors de l'application des migrations: {}", e);
                }
            }
        });
        log::info!(
            "✅ Cloud Run: Migrations SQLx lancées en arrière-plan avec pool principal, serveur démarre immédiatement"
        );
    }

    // ✅ 2025-12-30: Créer les index MongoDB pour optimiser les requêtes /api/services/{id}/stats et /api/services/{id}/reviews
    // ✅ NOUVEAU 2026-01-02: Optimisation critique add_product_to_service_jsonb_v2
    // ✅ OPTIMISÉ Cloud Run: Lancer en arrière-plan pour démarrage rapide
    if is_cloud_run {
        let pg_for_opt = app_state.pg.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            match yukpomnang_backend::migrations::auto_migrate::ensure_add_product_optimization(
                &pg_for_opt,
            )
            .await
            {
                Ok(_) => log::info!("✅ Optimisation add_product_to_service_jsonb_v2 appliquée"),
                Err(e) => log::warn!(
                    "⚠️ Erreur optimisation add_product_to_service_jsonb_v2: {}",
                    e
                ),
            }
        });
    } else {
        match yukpomnang_backend::migrations::auto_migrate::ensure_add_product_optimization(
            &app_state.pg,
        )
        .await
        {
            Ok(_) => log::info!("✅ Optimisation add_product_to_service_jsonb_v2 appliquée"),
            Err(e) => log::warn!(
                "⚠️ Erreur optimisation add_product_to_service_jsonb_v2: {}",
                e
            ),
        }
    }

    // ✅ NOUVEAU 2026-01-02: Création de la queue asynchrone pour création de produits
    // ✅ OPTIMISÉ Cloud Run: Lancer en arrière-plan
    if is_cloud_run {
        let pg_for_queue = app_state.pg.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            match yukpomnang_backend::migrations::auto_migrate::ensure_product_creation_queue(
                &pg_for_queue,
            )
            .await
            {
                Ok(_) => log::info!("✅ Table product_creation_queue créée/appliquée"),
                Err(e) => log::warn!("⚠️ Erreur création product_creation_queue: {}", e),
            }
        });
    } else {
        match yukpomnang_backend::migrations::auto_migrate::ensure_product_creation_queue(
            &app_state.pg,
        )
        .await
        {
            Ok(_) => log::info!("✅ Table product_creation_queue créée/appliquée"),
            Err(e) => log::warn!("⚠️ Erreur création product_creation_queue: {}", e),
        }
    }

    // ✅ NOUVEAU 2026-01-02: Création de la table de cache PostgreSQL
    // ✅ OPTIMISÉ Cloud Run: Lancer en arrière-plan
    if is_cloud_run {
        let pg_for_cache = app_state.pg.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            match yukpomnang_backend::migrations::auto_migrate::ensure_cache_table(&pg_for_cache)
                .await
            {
                Ok(_) => log::info!("✅ Table cache_table créée/appliquée"),
                Err(e) => log::warn!("⚠️ Erreur création cache_table: {}", e),
            }
        });
    } else {
        match yukpomnang_backend::migrations::auto_migrate::ensure_cache_table(&app_state.pg).await
        {
            Ok(_) => log::info!("✅ Table cache_table créée/appliquée"),
            Err(e) => log::warn!("⚠️ Erreur création cache_table: {}", e),
        }
    }

    // ✅ NOUVEAU 2026-02-08: Création de la table navigation_saved_destinations pour destinations favorites
    // ✅ OPTIMISÉ Cloud Run: Lancer en arrière-plan
    if is_cloud_run {
        let pg_for_nav = app_state.pg.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            match yukpomnang_backend::migrations::auto_migrate::ensure_navigation_saved_destinations_table(&pg_for_nav).await {
                Ok(_) => log::info!("✅ Table navigation_saved_destinations créée/appliquée"),
                Err(e) => log::warn!("⚠️ Erreur création navigation_saved_destinations: {}", e),
            }
        });
    } else {
        match yukpomnang_backend::migrations::auto_migrate::ensure_navigation_saved_destinations_table(&app_state.pg).await {
            Ok(_) => log::info!("✅ Table navigation_saved_destinations créée/appliquée"),
            Err(e) => log::warn!("⚠️ Erreur création navigation_saved_destinations: {}", e),
        }
    }

    // ✅ NOUVEAU 2026-02-08: Création de la table navigation_trips pour navigation intelligente
    // ✅ OPTIMISÉ Cloud Run: Lancer en arrière-plan
    if is_cloud_run {
        let pg_for_trips = app_state.pg.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            match yukpomnang_backend::migrations::auto_migrate::ensure_navigation_trips_table(
                &pg_for_trips,
            )
            .await
            {
                Ok(_) => log::info!("✅ Table navigation_trips créée/appliquée"),
                Err(e) => log::warn!("⚠️ Erreur création navigation_trips: {}", e),
            }
        });
    } else {
        match yukpomnang_backend::migrations::auto_migrate::ensure_navigation_trips_table(
            &app_state.pg,
        )
        .await
        {
            Ok(_) => log::info!("✅ Table navigation_trips créée/appliquée"),
            Err(e) => log::warn!("⚠️ Erreur création navigation_trips: {}", e),
        }
    }

    // ✅ NOUVEAU 2026-03-05: Tables navigation_checkpoints (radars, contrôles)
    if is_cloud_run {
        let pg_for_checkpoints = app_state.pg.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_navigation_checkpoints_table(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création navigation_checkpoints: {}", e);
            }
            if let Err(e) = yukpomnang_backend::migrations::auto_migrate::ensure_navigation_checkpoint_votes_table(&pg_for_checkpoints).await {
                log::warn!("⚠️ Erreur création navigation_checkpoint_votes: {}", e);
            }
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_navigation_activity_log_table(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création navigation_activity_log: {}", e);
            }
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_navigation_achievements_table(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création navigation_achievements: {}", e);
            }
            if let Err(e) = yukpomnang_backend::migrations::auto_migrate::ensure_navigation_poi_daily_usage_table(
                &pg_for_checkpoints,
            )
            .await
            {
                log::warn!("⚠️ Erreur création navigation_poi_daily_usage: {}", e);
            }
            if let Err(e) = yukpomnang_backend::migrations::auto_migrate::ensure_push_tokens_table(
                &pg_for_checkpoints,
            )
            .await
            {
                log::warn!("⚠️ Erreur création push_tokens: {}", e);
            }
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_geo_regional_config_table(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création geo_regional_config: {}", e);
            }
            log::info!("✅ Tables navigation (checkpoints + activity_log + achievements + push_tokens + geo_regional_config) créées/vérifiées");

            // ✅ CORRIGÉ 2026-03-19: Ces tables manquaient dans le bloc Cloud Run
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_video_transcoding_table(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création video_transcoding: {}", e);
            }
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_video_analytics_tables(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création video_analytics: {}", e);
            }
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_internal_shares_table(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création internal_shares: {}", e);
            }
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_service_team_management_table(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création service_team_management: {}", e);
            }
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_exchange_rate_cache_table(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création exchange_rate_cache: {}", e);
            }
            // ✅ CORRIGÉ 2026-03-19: Tables critiques manquantes (history_events, wallets)
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_history_events_table(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création history_events: {}", e);
            }
            if let Err(e) = yukpomnang_backend::migrations::auto_migrate::ensure_wallet_tables(
                &pg_for_checkpoints,
            )
            .await
            {
                log::warn!("⚠️ Erreur création wallet_tables: {}", e);
            }
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_chat_mentions_and_participants(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!(
                    "⚠️ Erreur création chat_mentions/conversation_participants/tag_history: {}",
                    e
                );
            }
            // ✅ 2026-03-21: Tables YukpoIA (quota journalier + sessions/messages)
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_yukpo_ia_daily_usage_table(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création yukpo_ia_daily_usage: {}", e);
            }
            if let Err(e) =
                yukpomnang_backend::migrations::auto_migrate::ensure_yukpo_ia_sessions_tables(
                    &pg_for_checkpoints,
                )
                .await
            {
                log::warn!("⚠️ Erreur création yukpo_ia_sessions/messages: {}", e);
            }
            log::info!("✅ Tables supplémentaires (video, shares, team, exchange_rate, history, wallets, chat_mentions, yukpo_ia) créées/vérifiées");
        });
    } else {
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_navigation_checkpoints_table(
            &app_state.pg,
        )
        .await;
        let _ =
            yukpomnang_backend::migrations::auto_migrate::ensure_navigation_checkpoint_votes_table(
                &app_state.pg,
            )
            .await;
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_navigation_activity_log_table(
            &app_state.pg,
        )
        .await;
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_navigation_achievements_table(
            &app_state.pg,
        )
        .await;
        let _ =
            yukpomnang_backend::migrations::auto_migrate::ensure_navigation_poi_daily_usage_table(
                &app_state.pg,
            )
            .await;
        let _ =
            yukpomnang_backend::migrations::auto_migrate::ensure_push_tokens_table(&app_state.pg)
                .await;
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_geo_regional_config_table(
            &app_state.pg,
        )
        .await;

        // ✅ NOUVEAU 2026-03-05: Tables pour transcodage vidéo HLS/DASH et analytics avancés
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_video_transcoding_table(
            &app_state.pg,
        )
        .await;
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_video_analytics_tables(
            &app_state.pg,
        )
        .await;

        // ✅ NOUVEAU 2026-03-14: Table pour partage interne de produits
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_internal_shares_table(
            &app_state.pg,
        )
        .await;

        // ✅ NOUVEAU 2026-03-14: Tables gestion d'équipe (rôles, permissions, membres, invitations)
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_service_team_management_table(
            &app_state.pg,
        )
        .await;

        // ✅ 2026-03-18: Table cache taux de change
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_exchange_rate_cache_table(
            &app_state.pg,
        )
        .await;

        // ✅ NOUVEAU 2026-03-21: Table quota journalier YukpoIA (facturation chat intelligent)
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_yukpo_ia_daily_usage_table(
            &app_state.pg,
        )
        .await;

        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_yukpo_ia_sessions_tables(
            &app_state.pg,
        )
        .await;

        // ✅ CORRIGÉ 2026-03-19: Tables critiques manquantes
        let _ = yukpomnang_backend::migrations::auto_migrate::ensure_history_events_table(
            &app_state.pg,
        )
        .await;
        let _ =
            yukpomnang_backend::migrations::auto_migrate::ensure_wallet_tables(&app_state.pg).await;

        // ✅ CORRIGÉ 2026-03-19: Tables mentions/participants/tag_history pour @mention système
        let _ =
            yukpomnang_backend::migrations::auto_migrate::ensure_chat_mentions_and_participants(
                &app_state.pg,
            )
            .await;
    }

    // ✅ 2026-03-16: Index MongoDB supprimés - index PostgreSQL créés via ensure_history_events_table

    social_distribution_service::start_distribution_worker(app_state.clone());

    // ?? Initialiser l'architecture cloud massive
    let massive_load_handler = MassiveLoadHandler::new();
    let gpu_optimizer = GPUOptimizer::new();

    log::info!("?? Architecture cloud massive initialis?e");
    log::info!("? {}", massive_load_handler.get_stats().await);
    log::info!("?? {}", gpu_optimizer.get_stats());

    // ✅ PHASE 6: Lancer la désactivation automatique des produits (tous les jours à minuit)
    // Utilise maintenant service_products au lieu de JSONB
    let state_clone_products = app_state.clone();
    std::mem::drop(tokio::spawn(async move {
        use tokio::time::{interval, Duration};
        let mut interval = interval(Duration::from_secs(86400)); // 24 heures

        loop {
            interval.tick().await;
            log::info!("🔄 Démarrage de la désactivation automatique des produits...");

            match yukpomnang_backend::controllers::product_lifecycle_controller::auto_deactivate_expired_products(
                &state_clone_products.pg,
            )
            .await
            {
                Ok(count) => log::info!("✅ {} produits désactivés automatiquement", count),
                Err(e) => log::error!("❌ Erreur désactivation produits: {}", e),
            }
        }
    }));

    // ✅ Lancer la tâche de désactivation des publicités expirées (toutes les heures)
    let pool_clone_pub = Arc::new(app_state.pg.clone());
    std::mem::drop(tokio::spawn(async move {
        yukpomnang_backend::tasks::publicite_expiration::start_publicite_expiration_task(
            pool_clone_pub,
        )
        .await;
    }));

    // ✅ NOUVEAU 2025-01-28: Lancer la tâche de notifications pour nouveaux matchings emploi (toutes les 6 heures)
    let pool_clone_matching = Arc::new(app_state.pg.clone());
    std::mem::drop(tokio::spawn(async move {
        yukpomnang_backend::tasks::matching_emploi_notifications::start_matching_notifications_task(
            pool_clone_matching,
        )
        .await;
    }));

    // ✅ NOUVEAU 2025-12-30: Nettoyage automatique du cache audio (tous les jours)
    let pool_clone_audio = Arc::new(app_state.pg.clone());
    std::mem::drop(tokio::spawn(async move {
        yukpomnang_backend::tasks::audio_cache_cleanup::start_audio_cache_cleanup_task(
            pool_clone_audio,
        )
        .await;
    }));

    // ✅ NOUVEAU 2026-01-02: Démarrer le worker de la queue de création de produits
    use yukpomnang_backend::services::product_creation_queue::ProductCreationQueueService;
    let queue_service = Arc::new(ProductCreationQueueService::new(Arc::new(
        app_state.pg.clone(),
    )));
    queue_service.clone().start_worker();
    log::info!("✅ Worker de création de produits démarré");

    // ✅ Lancer le nettoyage périodique des rooms/ingress LiveKit/SRS
    tasks::livekit_cleanup::start_livekit_cleanup_task(app_state.clone());
    // ✅ Lancer la synchronisation des analytics LiveKit
    tasks::live_analytics::start_live_analytics_task(app_state.clone());
    // ✅ Scheduler pour les ventes flash live
    tasks::live_flash_sale_scheduler::start_flash_sale_scheduler(app_state.clone());
    // ✅ NOUVEAU : Démarrer la tâche de répétition des notifications de livraison
    let app_state_notifications = app_state.clone();
    tokio::spawn(async move {
        tasks::delivery_notification_repeat::start_delivery_notification_repeat_task(
            app_state_notifications,
        )
        .await;
    });

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
        std::mem::drop(tokio::spawn(async move {
            if let Err(e) = worker.start().await {
                log::error!("❌ Flash Sale Queue Worker error: {:?}", e);
            }
        }));
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
        std::mem::drop(tokio::spawn(async move {
            if let Err(e) = worker.start().await {
                log::error!("❌ Notification Queue Worker error: {:?}", e);
            }
        }));
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
    std::mem::drop(tokio::spawn(async move {
        start_optimization_task(pool_clone_optimization, app_state_clone_optimization).await;
    }));
    // ✅ Scheduler pour les campagnes promos globales (Black Friday, etc.)
    tasks::global_promo_scheduler::start_global_promo_scheduler(app_state.clone());
    // ✅ Worker pipeline health (alerting interne)
    tasks::pipeline_health_worker::start_pipeline_health_worker(app_state.clone());
    // ✅ Matching temps réel
    tasks::delivery_matching_worker::start_delivery_matching_worker(app_state.clone());
    // ✅ Surveillance SLA
    tasks::delivery_sla_monitor::start_delivery_sla_monitor(app_state.clone());
    // ✅ Monitor des timeouts de validation d'étapes
    std::mem::drop(tokio::spawn(
        tasks::delivery_timeout_monitor::start_delivery_timeout_monitor(app_state.clone()),
    ));
    // ✅ Monitor des timeouts de validation de commandes
    std::mem::drop(tokio::spawn(
        tasks::order_timeout_monitor::start_order_timeout_monitor(app_state.clone()),
    ));
    // Expiration automatique des trocs en attente (72h TTL)
    std::mem::drop(tokio::spawn(
        tasks::troc_expiration_monitor::start_troc_expiration_monitor(app_state.clone()),
    ));

    // ✅ NOUVEAU 2026-02-14: Démarrer le monitoring GPU si configuré
    if let Some(gpu_service) = &app_state.gpu_service {
        log::info!("🚀 Démarrage du monitoring GPU automatisé...");
        gpu_service.clone().start_monitoring().await;
        log::info!("✅ Monitoring GPU démarré (scaling automatique activé)");
    } else {
        log::info!("ℹ️ Service GPU non configuré - Monitoring désactivé");
    }

    // ✅ NOUVEAU 2026-02-15: Démarrer le monitoring Redis scaling si configuré
    if let Some(redis_scaling_service) = &app_state.redis_scaling_service {
        log::info!("🚀 Démarrage du monitoring Redis scaling automatisé...");
        redis_scaling_service.clone().start_monitoring().await;
        log::info!("✅ Monitoring Redis scaling démarré (scaling automatique activé)");
    } else {
        log::info!("ℹ️ Service Redis scaling non configuré - Monitoring désactivé");
    }
    // ✅ Phase 2 : Archivage automatique des livraisons complétées
    tasks::delivery_archive_worker::start_delivery_archive_worker(app_state.clone());

    // ✅ YukpoIA : worker file Redis (chat async)
    tasks::yukpo_ia_queue_worker::start_yukpo_ia_queue_worker(app_state.clone());

    // ✅ 2026-04-01: Génération automatique produits ticket_voyage depuis les horaires agences (cron 6h)
    tasks::bus_schedule_product_generator::start_bus_schedule_product_generator(app_state.clone());

    // ✅ Bourse du livre : reversements automatiques vendeurs
    {
        let pool_reversement = Arc::new(app_state.pg.clone());
        let config_reversement =
            tasks::book_reversement_worker::BookReversementWorkerConfig::default();
        let _ = tokio::spawn(async move {
            tasks::book_reversement_worker::run_book_reversement_worker(
                pool_reversement,
                config_reversement,
            )
            .await;
        });
    }

    // ✅ Bourse du livre : timeout super libraire → fallback broadcast librairies proches
    tasks::super_librairie_timeout_worker::start_super_librairie_timeout_worker(app_state.clone());

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
        )
        .await;
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
            let view_exists = sqlx::query_scalar::<sqlx::Postgres, bool>(
                "SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'global_promo_catalog_cache')"
            )
            .fetch_one(&*pool_clone_blackfriday)
            .await
            .unwrap_or(false);

            if view_exists {
                // ✅ CRITIQUE RACINE 2025-12-11: Vérifier que l'index unique existe AVANT d'exécuter REFRESH CONCURRENTLY
                // Le problème: REFRESH CONCURRENTLY sans index unique peut causer des crashes PostgreSQL
                let has_unique_index = sqlx::query_scalar::<sqlx::Postgres, bool>(
                    "SELECT EXISTS (
                        SELECT 1 FROM pg_indexes 
                        WHERE tablename = 'global_promo_catalog_cache' 
                        AND indexname = 'idx_global_promo_catalog_cache_entry_id'
                    )",
                )
                .fetch_one(&*pool_clone_blackfriday)
                .await
                .unwrap_or(false);

                if !has_unique_index {
                    log::warn!("⚠️ global_promo_catalog_cache n'a pas d'index unique - REFRESH CONCURRENTLY ignoré (peut causer crash PostgreSQL)");
                } else {
                    let start_time = std::time::Instant::now();
                    // ✅ CORRIGÉ RACINE: Utiliser pool séparé pour REFRESH (opération longue)
                    if let Err(e) = sqlx::query(
                        "REFRESH MATERIALIZED VIEW CONCURRENTLY global_promo_catalog_cache",
                    )
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

        // ✅ OPTIMISÉ 2025-12-16: Augmenter l'intervalle de refresh pour réduire la charge
        // Le problème: REFRESH MATERIALIZED VIEW prend 5-10 secondes et bloque les connexions
        // Solution: Augmenter l'intervalle à 15 minutes (était 5 min) pour réduire la fréquence
        let refresh_interval_secs: u64 = std::env::var("MATERIALIZED_VIEW_REFRESH_INTERVAL_SECS")
            .unwrap_or_else(|_| "900".to_string()) // 15 minutes par défaut
            .parse()
            .unwrap_or(900);
        let mut interval_services = interval(Duration::from_secs(refresh_interval_secs));
        let mut interval_products = interval(Duration::from_secs(refresh_interval_secs * 2)); // 30 minutes pour products

        loop {
            tokio::select! {
                _ = interval_services.tick() => {
                    // ✅ CORRECTION RACINE: Utiliser mutex pour éviter refresh concurrents
                    let _lock = refresh_lock_services.lock().await;
                    log::info!("🔄 Refresh de services_search_cache...");
                    // PostgreSQL ne supporte pas IF EXISTS avec REFRESH MATERIALIZED VIEW CONCURRENTLY
                    let view_exists = sqlx::query_scalar::<sqlx::Postgres, bool>(
                        "SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_cache')"
                    )
                    .fetch_one(&*pool_clone_matviews)
                    .await
                    .unwrap_or(false);

                    if view_exists {
                        // ✅ CRITIQUE RACINE 2025-12-11: Vérifier que l'index unique existe AVANT d'exécuter REFRESH CONCURRENTLY
                        // Le problème: REFRESH CONCURRENTLY sans index unique peut causer des crashes PostgreSQL
                        let has_unique_index = sqlx::query_scalar::<sqlx::Postgres, bool>(
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
                    let view_exists = sqlx::query_scalar::<sqlx::Postgres, bool>(
                        "SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'active_products_cache')"
                    )
                    .fetch_one(&*pool_clone_matviews)
                    .await
                    .unwrap_or(false);

                    if view_exists {
                        // ✅ CRITIQUE RACINE 2025-12-11: Vérifier que l'index unique existe AVANT d'exécuter REFRESH CONCURRENTLY
                        // Le problème: REFRESH CONCURRENTLY sans index unique peut causer des crashes PostgreSQL
                        let has_unique_index = sqlx::query_scalar::<sqlx::Postgres, bool>(
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

    // Injection de l'app complète (même socket TCP, pas de rebind — évite TIME_WAIT / crash Cloud Run).
    {
        let app = build_app(app_state.clone());
        let mut w = app_router_holder.write().await;
        *w = Some(app);
    }
    eprintln!("[MAIN] ✅ Router complet chargé (API disponible sur le même port)");
    log::info!("✅ Router complet chargé — API disponible");

    // Diagnostic des services externes (le serveur accepte déjà /health en parallèle)
    {
        let has_google_maps =
            std::env::var("GOOGLE_MAPS_API_KEY").ok().filter(|k| !k.is_empty()).is_some();
        let has_openweather =
            std::env::var("OPENWEATHERMAP_API_KEY").ok().filter(|k| !k.is_empty()).is_some();
        let has_twilio_sid =
            std::env::var("TWILIO_ACCOUNT_SID").ok().filter(|k| !k.is_empty()).is_some();
        let has_sendgrid =
            std::env::var("SENDGRID_API_KEY").ok().filter(|k| !k.is_empty()).is_some();
        let has_ml_dir = std::path::Path::new(
            &std::env::var("ML_MODELS_DIR").unwrap_or_else(|_| "models".to_string()),
        )
        .exists();

        log::info!("╔══════════════════════════════════════════════════╗");
        log::info!("║        DIAGNOSTIC SERVICES EXTERNES              ║");
        log::info!("╠══════════════════════════════════════════════════╣");
        log::info!(
            "║ Google Maps API    : {}",
            if has_google_maps {
                "✅ Configuré"
            } else {
                "⚠️  Non configuré (fallback Haversine)"
            }
        );
        log::info!(
            "║ OpenWeatherMap API : {}",
            if has_openweather {
                "✅ Configuré"
            } else {
                "⚠️  Non configuré (fallback météo normale)"
            }
        );
        log::info!(
            "║ Twilio SMS         : {}",
            if has_twilio_sid {
                "✅ Configuré"
            } else {
                "⚠️  Non configuré (SMS désactivé)"
            }
        );
        log::info!(
            "║ SendGrid Email     : {}",
            if has_sendgrid {
                "✅ Configuré"
            } else {
                "⚠️  Non configuré (Email désactivé)"
            }
        );
        log::info!(
            "║ ML Models Dir      : {}",
            if has_ml_dir {
                "✅ Répertoire trouvé"
            } else {
                "⚠️  Non trouvé (formules optimisées)"
            }
        );
        log::info!("╚══════════════════════════════════════════════════╝");
    }

    log::info!("✅ Serveur lance sur http://{}:{}", host, port);
    println!("✅ Serveur lance sur http://{}:{}", host, port);

    match serve_task.await {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => {
            eprintln!("[MAIN] ❌ ERREUR CRITIQUE: Le serveur HTTP a échoué: {}", e);
            Err(e.into())
        }
        Err(e) => Err(format!("serve task paniquée ou annulée: {}", e).into()),
    }
}

/// Valide le format d'une URL Redis
fn validate_redis_url(url: &str) -> bool {
    // Vérifier que l'URL commence par redis:// ou rediss://
    if !url.starts_with("redis://") && !url.starts_with("rediss://") {
        return false;
    }

    // Vérifier qu'il y a au moins un ':' après le protocole
    let after_proto = if let Some(stripped) = url.strip_prefix("rediss://") {
        stripped
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
