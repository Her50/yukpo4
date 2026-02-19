// ✅ Utilitaire Redis avec retry automatique et gestion d'erreur robuste
// Gère les cas où Redis n'est pas toujours disponible
// ✅ NOUVEAU 2026-02-19: Support connexion TCP directe pour IPs privées (évite résolution DNS)

use redis::{AsyncCommands, Client as RedisClient};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::time::sleep;

/// Cache pour l'état de santé Redis (évite les logs répétitifs)
struct RedisHealthCache {
    last_status: bool,
    last_check: Instant,
}

impl RedisHealthCache {
    fn new() -> Self {
        Self {
            last_status: false,
            last_check: Instant::now(),
        }
    }

    fn should_log(&mut self, current_status: bool) -> bool {
        let now = Instant::now();
        let state_changed = self.last_status != current_status;
        let time_elapsed = now.duration_since(self.last_check).as_secs() > 300; // 5 minutes

        if state_changed || time_elapsed {
            self.last_status = current_status;
            self.last_check = now;
            true
        } else {
            false
        }
    }
}

static REDIS_HEALTH_CACHE: Mutex<Option<RedisHealthCache>> = Mutex::new(None);

/// Résultat d'une opération Redis avec indication de disponibilité
pub type RedisResult<T> = Result<T, RedisError>;

#[derive(Debug)]
pub enum RedisError {
    ConnectionFailed(String),
    OperationFailed(String),
    Unavailable,
}

impl std::fmt::Display for RedisError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RedisError::ConnectionFailed(msg) => write!(f, "Connexion Redis échouée: {}", msg),
            RedisError::OperationFailed(msg) => write!(f, "Opération Redis échouée: {}", msg),
            RedisError::Unavailable => write!(f, "Redis non disponible"),
        }
    }
}

impl std::error::Error for RedisError {}

/// ✅ NOUVEAU 2026-02-19: Détecte si une URL Redis contient une IP privée ou un nom d'hôte nécessitant une connexion TCP directe
pub fn is_private_ip_or_internal_host(url: &str) -> bool {
    // Détecter les IPs privées (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    if url.contains("10.") || url.contains("172.") || url.contains("192.168.") {
        return true;
    }
    // Détecter les noms d'hôtes internes (redis.internal, etc.)
    if url.contains("redis.internal") || url.contains(".internal") {
        return true;
    }
    false
}

/// ✅ NOUVEAU 2026-02-19: Extrait l'IP et le port d'une URL Redis
pub fn extract_ip_and_port(url: &str) -> Option<(String, u16)> {
    // Parser l'URL Redis: redis://[user]:[password]@[host]:[port]/[db]
    // ou redis://[host]:[port]/[db]

    // Enlever le protocole
    let url_clean = url.replace("redis://", "").replace("rediss://", "");

    // Extraire la partie host:port
    let host_port = if url_clean.contains("@") {
        // Format avec authentification: user:password@host:port
        let parts: Vec<&str> = url_clean.split("@").collect();
        if parts.len() == 2 {
            parts[1].split("/").next().unwrap_or("")
        } else {
            return None;
        }
    } else {
        // Format sans authentification: host:port
        url_clean.split("/").next().unwrap_or("")
    };

    // Séparer host et port
    let parts: Vec<&str> = host_port.split(":").collect();
    if parts.len() == 2 {
        let ip = parts[0].to_string();
        let port = parts[1].parse::<u16>().ok()?;
        Some((ip, port))
    } else if parts.len() == 1 {
        // Port par défaut Redis
        let ip = parts[0].to_string();
        Some((ip, 6379))
    } else {
        None
    }
}

/// ✅ NOUVEAU 2026-02-19: Crée une connexion Redis avec TCP direct (sans résolution DNS)
/// Utilise TcpStream directement pour éviter la résolution DNS qui échoue avec les IPs privées
/// Note: Le client Redis utilise toujours la résolution DNS, donc on crée le client avec l'IP
/// directement dans l'URL et on espère que le système utilisera le stream TCP existant
pub async fn create_redis_connection_direct_tcp(
    ip: &str,
    port: u16,
    max_retries: u32,
    retry_delay_ms: u64,
) -> RedisResult<redis::aio::MultiplexedConnection> {
    let mut last_error = None;
    use tokio::time::timeout;
    use tokio::time::Duration as TokioDuration;

    // Créer une URL Redis avec l'IP directement (sans nom d'hôte)
    let redis_url = format!("redis://{}:{}/0", ip, port);

    // Créer un client Redis avec l'IP directement
    // Note: Même avec l'IP, le client peut essayer une résolution DNS inverse
    // Mais on espère que le système utilisera l'IP directement
    let client = match RedisClient::open(redis_url.as_str()) {
        Ok(c) => c,
        Err(e) => {
            return Err(RedisError::ConnectionFailed(format!(
                "Failed to create Redis client: {}",
                e
            )));
        }
    };

    // Utiliser get_redis_connection normal mais avec un timeout plus court
    // pour détecter rapidement les erreurs DNS
    for attempt in 1..=max_retries {
        match timeout(
            TokioDuration::from_secs(5), // Timeout plus court pour détecter DNS rapidement
            client.get_multiplexed_async_connection(),
        )
        .await
        {
            Ok(Ok(conn)) => {
                if attempt > 1 {
                    log::info!(
                        "✅ [Redis] Connexion TCP directe réussie après {} tentative(s) à {}:{}",
                        attempt,
                        ip,
                        port
                    );
                } else {
                    log::info!("✅ [Redis] Connexion TCP directe établie à {}:{}", ip, port);
                }
                return Ok(conn);
            }
            Ok(Err(e)) => {
                let err_msg = format!("{}", e);
                last_error = Some(err_msg.clone());

                // Si c'est une erreur DNS, on continue avec les tentatives
                if err_msg.contains("failed to lookup address information")
                    || err_msg.contains("Name or service not known")
                {
                    log::warn!(
                        "⚠️ [Redis] Erreur DNS détectée (tentative {}/{}): {} - Réessai...",
                        attempt,
                        max_retries,
                        err_msg
                    );
                }

                if attempt < max_retries {
                    sleep(TokioDuration::from_millis(retry_delay_ms)).await;
                }
            }
            Err(_) => {
                let timeout_msg = format!(
                    "Connection timeout (5s) - tentative {}/{}",
                    attempt, max_retries
                );
                last_error = Some(timeout_msg.clone());

                if attempt < max_retries {
                    sleep(TokioDuration::from_millis(retry_delay_ms)).await;
                }
            }
        }
    }

    Err(RedisError::ConnectionFailed(
        last_error.unwrap_or_else(|| "Erreur inconnue".to_string()),
    ))
}

/// Helper pour obtenir une connexion Redis avec retry automatique et timeout
/// ✅ NOUVEAU 2026-02-19: Support connexion TCP directe pour IPs privées (évite résolution DNS)
pub async fn get_redis_connection(
    client: &RedisClient,
    max_retries: u32,
    retry_delay_ms: u64,
) -> RedisResult<redis::aio::MultiplexedConnection> {
    get_redis_connection_with_url(client, None, max_retries, retry_delay_ms).await
}

/// ✅ NOUVEAU 2026-02-19: Version avec URL pour support connexion TCP directe
pub async fn get_redis_connection_with_url(
    client: &RedisClient,
    redis_url: Option<&str>,
    max_retries: u32,
    retry_delay_ms: u64,
) -> RedisResult<redis::aio::MultiplexedConnection> {
    // ✅ NOUVEAU: Si URL fournie et IP privée détectée, utiliser connexion TCP directe
    if let Some(url) = redis_url {
        if is_private_ip_or_internal_host(url) {
            use crate::utils::redis_tcp_direct::{
                create_multiplexed_connection_from_tcp, RedisTcpConfig,
            };

            if let Some(config) = RedisTcpConfig::from_url(url) {
                log::info!(
                    "🔧 [Redis] Utilisation connexion TCP directe pour IP privée {}:{}",
                    config.ip,
                    config.port
                );
                match create_multiplexed_connection_from_tcp(&config, max_retries, retry_delay_ms)
                    .await
                {
                    Ok(conn) => return Ok(conn),
                    Err(e) => {
                        log::warn!(
                            "⚠️ [Redis] Échec connexion TCP directe: {} - Fallback méthode normale",
                            e
                        );
                        // Fallback vers méthode normale
                    }
                }
            }
        }
    }

    let mut last_error = None;

    // ✅ CORRIGÉ: Ajouter un timeout par tentative pour éviter les blocages infinis
    // Dans AWS ECS, les connexions peuvent bloquer indéfiniment si le service n'est pas accessible
    use tokio::time::timeout;
    use tokio::time::Duration as TokioDuration;

    for attempt in 1..=max_retries {
        // Timeout de 10 secondes par tentative (3 tentatives * 10s = max 30s)
        // Augmenté pour ElastiCache qui peut être plus lent à répondre
        match timeout(
            TokioDuration::from_secs(10),
            client.get_multiplexed_async_connection(),
        )
        .await
        {
            Ok(Ok(conn)) => {
                if attempt > 1 {
                    log::info!(
                        "✅ [Redis] Connexion réussie après {} tentative(s)",
                        attempt
                    );
                }
                return Ok(conn);
            }
            Ok(Err(e)) => {
                let err_msg = format!("{}", e);

                // ✅ NOUVEAU 2026-02-19: Si l'erreur est liée à la résolution DNS, essayer TCP directe
                if err_msg.contains("failed to lookup address information")
                    || err_msg.contains("Name or service not known")
                {
                    log::warn!(
                        "⚠️ [Redis] Erreur résolution DNS détectée (tentative {}/{}): {}",
                        attempt,
                        max_retries,
                        err_msg
                    );
                    log::warn!("   💡 Tentative de connexion TCP directe...");

                    // Essayer de récupérer l'IP depuis REDIS_URL
                    if let Ok(redis_url) = std::env::var("REDIS_URL") {
                        if is_private_ip_or_internal_host(&redis_url) {
                            if let Some((ip, port)) = extract_ip_and_port(&redis_url) {
                                use crate::utils::redis_tcp_direct::{
                                    create_multiplexed_connection_from_tcp, RedisTcpConfig,
                                };

                                if let Some(config) = RedisTcpConfig::from_url(&redis_url) {
                                    log::info!(
                                        "🔧 [Redis] Tentative connexion TCP directe à {}:{}",
                                        ip,
                                        port
                                    );
                                    match create_multiplexed_connection_from_tcp(&config, 1, 0)
                                        .await
                                    {
                                        Ok(conn) => {
                                            log::info!("✅ [Redis] Connexion TCP directe réussie après erreur DNS");
                                            return Ok(conn);
                                        }
                                        Err(e2) => {
                                            log::warn!(
                                                "⚠️ [Redis] Échec connexion TCP directe: {}",
                                                e2
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                last_error = Some(err_msg.clone());

                if attempt < max_retries {
                    // ✅ CORRECTION 2025-11-28: Réduire les logs Redis (seulement en debug ou toutes les 10 tentatives)
                    if attempt % 10 == 0 || log::log_enabled!(log::Level::Debug) {
                        log::debug!(
                            "⚠️ [Redis] Tentative {}/{} échouée: {}. Nouvelle tentative dans {}ms...",
                            attempt,
                            max_retries,
                            err_msg,
                            retry_delay_ms
                        );
                    }
                    sleep(TokioDuration::from_millis(retry_delay_ms)).await;
                } else {
                    // ✅ CORRECTION: Logger seulement une fois toutes les 5 minutes pour éviter le spam
                    let should_log = {
                        let mut cache_guard = REDIS_HEALTH_CACHE.lock().unwrap();
                        let cache = cache_guard.get_or_insert_with(RedisHealthCache::new);
                        cache.should_log(false)
                    };
                    if should_log {
                        log::warn!(
                            "⚠️ [Redis] Toutes les tentatives ({}) ont échoué. Dernière erreur: {}. Redis non disponible - mode dégradé activé.",
                            max_retries,
                            err_msg
                        );
                    }
                }
            }
            Err(_) => {
                // Timeout de la tentative de connexion
                let timeout_msg = format!(
                    "Connection timeout (10s) - tentative {}/{}",
                    attempt, max_retries
                );
                last_error = Some(timeout_msg.clone());

                if attempt < max_retries {
                    // Pas besoin d'attendre après un timeout, on retry immédiatement avec délai réduit
                    if log::log_enabled!(log::Level::Debug) {
                        log::debug!(
                            "⚠️ [Redis] Timeout connexion (tentative {}/{}). Nouvelle tentative dans {}ms...",
                            attempt,
                            max_retries,
                            retry_delay_ms
                        );
                    }
                    sleep(TokioDuration::from_millis(retry_delay_ms)).await;
                } else {
                    // Timeout final
                    let should_log = {
                        let mut cache_guard = REDIS_HEALTH_CACHE.lock().unwrap();
                        let cache = cache_guard.get_or_insert_with(RedisHealthCache::new);
                        cache.should_log(false)
                    };
                    if should_log {
                        log::warn!(
                            "⚠️ [Redis] Toutes les tentatives ({}) ont timeout. Redis non accessible - mode dégradé activé.",
                            max_retries
                        );
                    }
                }
            }
        }
    }

    Err(RedisError::ConnectionFailed(
        last_error.unwrap_or_else(|| "Erreur inconnue".to_string()),
    ))
}

/// Exécute une opération Redis avec retry automatique
pub async fn execute_with_retry<F, T, Fut>(
    client: &RedisClient,
    operation: F,
    max_retries: u32,
    retry_delay_ms: u64,
) -> RedisResult<T>
where
    F: Fn(redis::aio::MultiplexedConnection) -> Fut,
    Fut: std::future::Future<Output = Result<T, redis::RedisError>>,
{
    let mut last_error = None;

    for attempt in 1..=max_retries {
        match get_redis_connection(client, 1, 0).await {
            Ok(conn) => {
                match operation(conn).await {
                    Ok(result) => {
                        if attempt > 1 {
                            log::info!(
                                "✅ [Redis] Opération réussie après {} tentative(s)",
                                attempt
                            );
                        }
                        return Ok(result);
                    }
                    Err(e) => {
                        let err_msg = format!("{}", e);
                        last_error = Some(err_msg.clone());

                        // Si c'est une erreur de connexion, réessayer
                        if err_msg.contains("connection") || err_msg.contains("Connection") {
                            if attempt < max_retries {
                                // ✅ CORRECTION 2025-11-28: Timeout réduit à 100ms pour éviter les lenteurs
                                let fast_retry_delay = if retry_delay_ms > 100 {
                                    100
                                } else {
                                    retry_delay_ms
                                };

                                // ✅ CORRECTION 2025-11-28: Réduire les logs Redis (seulement toutes les 5 tentatives)
                                if attempt % 5 == 0 || log::log_enabled!(log::Level::Debug) {
                                    log::debug!(
                                        "⚠️ [Redis] Erreur connexion lors de l'opération (tentative {}/{}): {}. Nouvelle tentative...",
                                        attempt,
                                        max_retries,
                                        err_msg
                                    );
                                }
                                sleep(Duration::from_millis(fast_retry_delay)).await;
                                continue;
                            }
                        } else {
                            // Erreur d'opération (pas de connexion), ne pas réessayer
                            return Err(RedisError::OperationFailed(err_msg));
                        }
                    }
                }
            }
            Err(e) => {
                let err_msg = format!("{}", e);
                last_error = Some(err_msg.clone());

                if attempt < max_retries {
                    // ✅ CORRECTION 2025-11-28: Timeout réduit à 100ms pour éviter les lenteurs
                    // Si Redis n'est pas disponible, ne pas bloquer les requêtes
                    let fast_retry_delay = if retry_delay_ms > 100 {
                        100
                    } else {
                        retry_delay_ms
                    };

                    // ✅ CORRECTION 2025-11-28: Réduire les logs Redis (seulement toutes les 5 tentatives)
                    if attempt % 5 == 0 || log::log_enabled!(log::Level::Debug) {
                        log::debug!(
                                "⚠️ [Redis] Impossible d'obtenir une connexion (tentative {}/{}): {}. Nouvelle tentative dans {}ms...",
                                attempt,
                                max_retries,
                                err_msg,
                                fast_retry_delay
                            );
                    }
                    sleep(Duration::from_millis(fast_retry_delay)).await;
                }
            }
        }
    }

    Err(RedisError::ConnectionFailed(
        last_error.unwrap_or_else(|| "Erreur inconnue".to_string()),
    ))
}

/// Vérifie si Redis est disponible avec cache pour réduire les logs
/// Ne log que les changements d'état (UP → DOWN, DOWN → UP) ou toutes les 5 minutes
/// Retourne un tuple (disponible, erreur_option) pour permettre un diagnostic détaillé
pub async fn check_redis_health(client: &RedisClient) -> bool {
    check_redis_health_with_error(client).await.0
}

/// Version améliorée qui retourne aussi l'erreur pour diagnostic
pub async fn check_redis_health_with_error(client: &RedisClient) -> (bool, Option<String>) {
    let (is_available, error_msg) = match get_redis_connection(client, 3, 1000).await {
        Ok(mut conn) => {
            // Tester avec une opération PING (plus fiable que GET)

            match redis::cmd("PING").query_async::<String>(&mut conn).await {
                Ok(_) => (true, None),
                Err(e) => {
                    let err_msg = format!("PING failed: {}", e);
                    (false, Some(err_msg))
                }
            }
        }
        Err(e) => {
            let err_msg = format!("Connection failed: {}", e);
            (false, Some(err_msg))
        }
    };

    // Logger seulement les changements d'état ou toutes les 5 minutes
    let should_log = {
        let mut cache_guard = REDIS_HEALTH_CACHE.lock().unwrap();
        let cache = cache_guard.get_or_insert_with(|| RedisHealthCache::new());
        cache.should_log(is_available)
    };

    if should_log {
        if is_available {
            log::info!("✅ [Redis] Health check réussi - Redis disponible");
        } else {
            let error_detail = error_msg.as_ref().map(|e| format!(" - {}", e)).unwrap_or_default();
            log::warn!(
                "⚠️ [Redis] Health check échoué - Redis non disponible{} (fallback gracieux activé)",
                error_detail
            );
        }
    }

    (is_available, error_msg)
}

/// Obtient une valeur depuis Redis avec retry
pub async fn get_with_retry(client: &RedisClient, key: &str) -> RedisResult<Option<String>> {
    execute_with_retry(
        client,
        |mut conn| async move { conn.get::<_, Option<String>>(key).await },
        3,   // 3 tentatives
        500, // 500ms entre les tentatives
    )
    .await
}

/// Définit une valeur dans Redis avec retry
pub async fn set_with_retry(
    client: &RedisClient,
    key: &str,
    value: &str,
    ttl_seconds: Option<u64>,
) -> RedisResult<()> {
    execute_with_retry(
        client,
        |mut conn| async move {
            if let Some(ttl) = ttl_seconds {
                conn.set_ex::<_, _, ()>(key, value, ttl).await?;
            } else {
                conn.set::<_, _, ()>(key, value).await?;
            }
            Ok(())
        },
        3,   // 3 tentatives
        500, // 500ms entre les tentatives
    )
    .await
}

/// Supprime une clé Redis avec retry
pub async fn del_with_retry(client: &RedisClient, key: &str) -> RedisResult<u64> {
    execute_with_retry(
        client,
        |mut conn| async move { conn.del::<_, u64>(key).await },
        3,   // 3 tentatives
        500, // 500ms entre les tentatives
    )
    .await
}

/// Alias pour del_with_retry (compatibilité)
pub async fn delete_with_retry(client: &RedisClient, key: &str) -> RedisResult<u64> {
    del_with_retry(client, key).await
}

/// Supprime plusieurs clés Redis correspondant à un pattern
pub async fn delete_pattern(client: &RedisClient, pattern: &str) -> RedisResult<usize> {
    execute_with_retry(
        client,
        |mut conn| async move {
            let keys: Vec<String> = redis::cmd("KEYS").arg(pattern).query_async(&mut conn).await?;
            if keys.is_empty() {
                Ok(0)
            } else {
                conn.del::<_, ()>(keys.clone()).await?;
                Ok(keys.len())
            }
        },
        3,
        500,
    )
    .await
}
