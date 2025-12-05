// ✅ Utilitaire Redis avec retry automatique et gestion d'erreur robuste
// Gère les cas où Redis n'est pas toujours disponible

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

/// Helper pour obtenir une connexion Redis avec retry automatique
pub async fn get_redis_connection(
    client: &RedisClient,
    max_retries: u32,
    retry_delay_ms: u64,
) -> RedisResult<redis::aio::MultiplexedConnection> {
    let mut last_error = None;

    for attempt in 1..=max_retries {
        match client.get_multiplexed_async_connection().await {
            Ok(conn) => {
                if attempt > 1 {
                    log::info!(
                        "✅ [Redis] Connexion réussie après {} tentative(s)",
                        attempt
                    );
                }
                return Ok(conn);
            }
            Err(e) => {
                let err_msg = format!("{}", e);
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
                    sleep(Duration::from_millis(retry_delay_ms)).await;
                } else {
                    // ✅ CORRECTION: Logger seulement une fois toutes les 5 minutes pour éviter le spam
                    let should_log = {
                        let mut cache_guard = REDIS_HEALTH_CACHE.lock().unwrap();
                        let cache = cache_guard.get_or_insert_with(|| RedisHealthCache::new());
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
            match conn.ping::<String>().await {
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
            let keys: Vec<String> = redis::cmd("KEYS")
                .arg(pattern)
                .query_async(&mut conn)
                .await?;
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
