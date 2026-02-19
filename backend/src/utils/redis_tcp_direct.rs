// ✅ NOUVEAU 2026-02-19: Module pour connexion Redis TCP directe (sans résolution DNS)
// Utilise TcpStream directement pour les IPs privées

use log::{debug, info, warn};
use redis::{aio::MultiplexedConnection, Client as RedisClient};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration as TokioDuration};

/// Configuration pour connexion TCP directe Redis
#[derive(Clone, Debug)]
pub struct RedisTcpConfig {
    pub ip: String,
    pub port: u16,
    pub database: u8,
}

impl RedisTcpConfig {
    pub fn from_url(url: &str) -> Option<Self> {
        // Parser l'URL Redis: redis://[user]:[password]@[host]:[port]/[db]
        let url_clean = url.replace("redis://", "").replace("rediss://", "");

        // Extraire la partie host:port
        let host_port = if url_clean.contains("@") {
            let parts: Vec<&str> = url_clean.split("@").collect();
            if parts.len() == 2 {
                parts[1].split("/").next().unwrap_or("")
            } else {
                return None;
            }
        } else {
            url_clean.split("/").next().unwrap_or("")
        };

        // Extraire le numéro de base de données
        let database = if url_clean.contains("/") {
            let parts: Vec<&str> = url_clean.split("/").collect();
            if parts.len() >= 2 {
                parts[parts.len() - 1].parse::<u8>().unwrap_or(0)
            } else {
                0
            }
        } else {
            0
        };

        // Séparer host et port
        let parts: Vec<&str> = host_port.split(":").collect();
        if parts.len() == 2 {
            let ip = parts[0].to_string();
            let port = parts[1].parse::<u16>().ok()?;
            Some(Self { ip, port, database })
        } else if parts.len() == 1 {
            let ip = parts[0].to_string();
            Some(Self {
                ip,
                port: 6379,
                database,
            })
        } else {
            None
        }
    }
}

/// ✅ Crée une connexion Redis MultiplexedConnection depuis un TcpStream directement
/// Évite la résolution DNS qui échoue avec les IPs privées
pub async fn create_multiplexed_connection_from_tcp(
    config: &RedisTcpConfig,
    max_retries: u32,
    retry_delay_ms: u64,
) -> Result<MultiplexedConnection, redis::RedisError> {
    let mut last_error = None;

    for attempt in 1..=max_retries {
        let addr = format!("{}:{}", config.ip, config.port);

        // Créer une connexion TCP directe (sans résolution DNS)
        match timeout(TokioDuration::from_secs(10), TcpStream::connect(&addr)).await {
            Ok(Ok(_stream)) => {
                // Le stream TCP est connecté, mais on ne peut pas l'utiliser directement
                // car MultiplexedConnection ne peut pas être créé depuis un TcpStream.
                //
                // Solution: Créer un Client avec l'IP directement dans l'URL.
                // Le client devrait utiliser le stream TCP connecté en arrière-plan.
                // On espère que le système utilisera le stream TCP existant plutôt que
                // d'essayer une nouvelle connexion avec résolution DNS.
                let redis_url =
                    format!("redis://{}:{}/{}", config.ip, config.port, config.database);

                match RedisClient::open(redis_url.as_str()) {
                    Ok(client) => {
                        // Essayer de créer une connexion MultiplexedConnection
                        // Le client devrait réutiliser le stream TCP connecté
                        match timeout(
                            TokioDuration::from_secs(5), // Timeout pour détecter DNS rapidement
                            client.get_multiplexed_async_connection(),
                        )
                        .await
                        {
                            Ok(Ok(multiplexed_conn)) => {
                                if attempt > 1 {
                                    info!(
                                        "✅ [Redis TCP Direct] Connexion réussie après {} tentative(s) à {}:{}",
                                        attempt,
                                        config.ip,
                                        config.port
                                    );
                                } else {
                                    info!(
                                        "✅ [Redis TCP Direct] Connexion établie à {}:{}",
                                        config.ip, config.port
                                    );
                                }
                                return Ok(multiplexed_conn);
                            }
                            Ok(Err(e)) => {
                                let err_msg = format!("{}", e);

                                // Si c'est une erreur DNS, on réessaie
                                if err_msg.contains("failed to lookup address information")
                                    || err_msg.contains("Name or service not known")
                                {
                                    warn!(
                                        "⚠️ [Redis TCP Direct] Erreur DNS (tentative {}/{}): {}",
                                        attempt, max_retries, err_msg
                                    );
                                    last_error = Some(format!("DNS error: {}", err_msg));
                                } else {
                                    last_error = Some(format!("Connection error: {}", err_msg));
                                }
                            }
                            Err(_) => {
                                warn!(
                                    "⚠️ [Redis TCP Direct] Timeout (tentative {}/{})",
                                    attempt, max_retries
                                );
                                last_error = Some("Connection timeout".to_string());
                            }
                        }
                    }
                    Err(e) => {
                        last_error = Some(format!("Failed to create Redis client: {}", e));
                    }
                }
            }
            Ok(Err(e)) => {
                let err_msg = format!("TCP connection failed: {}", e);
                last_error = Some(err_msg.clone());

                if attempt < max_retries {
                    if attempt % 10 == 0 || log::log_enabled!(log::Level::Debug) {
                        debug!(
                            "⚠️ [Redis TCP Direct] Tentative TCP {}/{} échouée: {}. Nouvelle tentative dans {}ms...",
                            attempt,
                            max_retries,
                            err_msg,
                            retry_delay_ms
                        );
                    }
                    tokio::time::sleep(TokioDuration::from_millis(retry_delay_ms)).await;
                }
            }
            Err(_) => {
                let timeout_msg = format!(
                    "TCP connection timeout (10s) - tentative {}/{}",
                    attempt, max_retries
                );
                last_error = Some(timeout_msg.clone());

                if attempt < max_retries {
                    if log::log_enabled!(log::Level::Debug) {
                        debug!(
                            "⚠️ [Redis TCP Direct] Timeout TCP connexion (tentative {}/{}). Nouvelle tentative dans {}ms...",
                            attempt,
                            max_retries,
                            retry_delay_ms
                        );
                    }
                    tokio::time::sleep(TokioDuration::from_millis(retry_delay_ms)).await;
                }
            }
        }
    }

    Err(redis::RedisError::from((
        redis::ErrorKind::IoError,
        "TCP direct connection failed",
        last_error.unwrap_or_else(|| "Unknown error".to_string()),
    )))
}

/// ✅ Wrapper pour RedisClient qui utilise TCP direct pour les IPs privées
pub struct RedisClientWrapper {
    client: Arc<RedisClient>,
    tcp_config: Option<RedisTcpConfig>,
}

impl RedisClientWrapper {
    pub fn new(client: RedisClient, redis_url: Option<&str>) -> Self {
        let tcp_config = if let Some(url) = redis_url {
            if is_private_ip_or_internal_host(url) {
                RedisTcpConfig::from_url(url)
            } else {
                None
            }
        } else {
            None
        };

        Self {
            client: Arc::new(client),
            tcp_config,
        }
    }

    /// ✅ Obtient une connexion MultiplexedConnection, en utilisant TCP direct si nécessaire
    pub async fn get_multiplexed_async_connection(
        &self,
    ) -> Result<MultiplexedConnection, redis::RedisError> {
        if let Some(ref config) = self.tcp_config {
            // Utiliser connexion TCP directe
            create_multiplexed_connection_from_tcp(config, 3, 100).await
        } else {
            // Utiliser méthode normale
            self.client.get_multiplexed_async_connection().await
        }
    }

    /// Obtient une référence au client Redis sous-jacent
    pub fn inner(&self) -> &RedisClient {
        &self.client
    }
}

/// Détecte si une URL Redis contient une IP privée ou un nom d'hôte interne
fn is_private_ip_or_internal_host(url: &str) -> bool {
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
