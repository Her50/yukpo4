// ✅ Utilitaire Redis avec retry automatique et gestion d'erreur robuste
// Gère les cas où Redis n'est pas toujours disponible

use redis::{AsyncCommands, Client as RedisClient};
use std::time::Duration;
use tokio::time::sleep;

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
                    log::info!("✅ [Redis] Connexion réussie après {} tentative(s)", attempt);
                }
                return Ok(conn);
            }
            Err(e) => {
                let err_msg = format!("{}", e);
                last_error = Some(err_msg.clone());
                
                if attempt < max_retries {
                    log::warn!(
                        "⚠️ [Redis] Tentative {}/{} échouée: {}. Nouvelle tentative dans {}ms...",
                        attempt,
                        max_retries,
                        err_msg,
                        retry_delay_ms
                    );
                    sleep(Duration::from_millis(retry_delay_ms)).await;
                } else {
                    log::warn!(
                        "⚠️ [Redis] Toutes les tentatives ({}) ont échoué. Dernière erreur: {}",
                        max_retries,
                        err_msg
                    );
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
                            log::info!("✅ [Redis] Opération réussie après {} tentative(s)", attempt);
                        }
                        return Ok(result);
                    }
                    Err(e) => {
                        let err_msg = format!("{}", e);
                        last_error = Some(err_msg.clone());
                        
                        // Si c'est une erreur de connexion, réessayer
                        if err_msg.contains("connection") || err_msg.contains("Connection") {
                            if attempt < max_retries {
                                log::warn!(
                                    "⚠️ [Redis] Erreur connexion lors de l'opération (tentative {}/{}): {}. Nouvelle tentative...",
                                    attempt,
                                    max_retries,
                                    err_msg
                                );
                                sleep(Duration::from_millis(retry_delay_ms)).await;
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
                    log::warn!(
                        "⚠️ [Redis] Impossible d'obtenir une connexion (tentative {}/{}): {}. Nouvelle tentative dans {}ms...",
                        attempt,
                        max_retries,
                        err_msg,
                        retry_delay_ms
                    );
                    sleep(Duration::from_millis(retry_delay_ms)).await;
                }
            }
        }
    }

    Err(RedisError::ConnectionFailed(
        last_error.unwrap_or_else(|| "Erreur inconnue".to_string()),
    ))
}

/// Vérifie si Redis est disponible
pub async fn check_redis_health(client: &RedisClient) -> bool {
    match get_redis_connection(client, 1, 0).await {
        Ok(mut conn) => {
            // Tester avec une opération simple (GET sur une clé inexistante)
            match conn.get::<&str, Option<String>>("__health_check__").await {
                Ok(_) => true,
                Err(e) => {
                    log::warn!("⚠️ [Redis] Health check échoué: {}", e);
                    false
                }
            }
        }
        Err(e) => {
            log::debug!("⚠️ [Redis] Health check échoué: {}", e);
            false
        }
    }
}

/// Obtient une valeur depuis Redis avec retry
pub async fn get_with_retry(
    client: &RedisClient,
    key: &str,
) -> RedisResult<Option<String>> {
    execute_with_retry(
        client,
        |mut conn| async move { conn.get::<_, Option<String>>(key).await },
        3, // 3 tentatives
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
        3, // 3 tentatives
        500, // 500ms entre les tentatives
    )
    .await
}

/// Supprime une clé Redis avec retry
pub async fn del_with_retry(client: &RedisClient, key: &str) -> RedisResult<u64> {
    execute_with_retry(
        client,
        |mut conn| async move { conn.del::<_, u64>(key).await },
        3, // 3 tentatives
        500, // 500ms entre les tentatives
    )
    .await
}

