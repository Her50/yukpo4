use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::time::Instant;

use crate::core::types::AppError;

const DEFAULT_SERVER_TOKEN_TTL_SECS: i64 = 60;

#[derive(Debug, Serialize)]
struct LiveKitServerClaims<'a> {
    iss: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    sub: Option<&'a str>,
    exp: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    nbf: Option<usize>,
    video: LiveKitServerVideoGrant,
}

#[derive(Debug, Serialize)]
struct LiveKitServerVideoGrant {
    #[serde(rename = "roomAdmin")]
    room_admin: bool,
    #[serde(rename = "roomCreate")]
    room_create: bool,
    #[serde(rename = "roomList")]
    room_list: bool,
    #[serde(rename = "roomJoin")]
    room_join: bool,
    #[serde(rename = "ingressAdmin")]
    ingress_admin: bool,
}

impl Default for LiveKitServerVideoGrant {
    fn default() -> Self {
        Self {
            room_admin: true,
            room_create: true,
            room_list: true,
            room_join: true,
            ingress_admin: true,
        }
    }
}

pub fn generate_server_access_token(api_key: &str, api_secret: &str) -> Result<String, AppError> {
    generate_server_access_token_with_ttl(api_key, api_secret, DEFAULT_SERVER_TOKEN_TTL_SECS)
}

pub fn generate_server_access_token_with_ttl(
    api_key: &str,
    api_secret: &str,
    ttl_seconds: i64,
) -> Result<String, AppError> {
    let now = Utc::now();
    let exp_ts = (now + Duration::seconds(ttl_seconds)).timestamp() as usize;
    let nbf_ts = now.timestamp().max(0) as usize;

    let claims = LiveKitServerClaims {
        iss: api_key,
        sub: Some("yukpo-backend"),
        exp: exp_ts,
        nbf: Some(nbf_ts),
        video: LiveKitServerVideoGrant::default(),
    };

    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(api_secret.as_bytes()),
    )?;

    Ok(token)
}

/// Résultat du diagnostic LiveKit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveKitDiagnostic {
    pub server_reachable: bool,
    pub api_endpoint_accessible: bool,
    pub authentication_working: bool,
    pub server_url: String,
    pub api_key_configured: bool,
    pub api_secret_configured: bool,
    pub connection_time_ms: Option<u128>,
    pub error_message: Option<String>,
    pub suggestions: Vec<String>,
    // ✅ NOUVEAU: Vérifications automatiques
    pub ip_is_public: Option<bool>,
    pub ip_address: Option<String>,
    pub firewall_check: Option<String>,
    pub server_status: Option<String>,
}

/// Effectue un diagnostic complet de la connexion LiveKit
pub async fn diagnose_livekit_connection(
    api_url: &str,
    api_key: Option<&str>,
    api_secret: Option<&str>,
) -> LiveKitDiagnostic {
    let mut diagnostic = LiveKitDiagnostic {
        server_reachable: false,
        api_endpoint_accessible: false,
        authentication_working: false,
        server_url: api_url.to_string(),
        api_key_configured: api_key.is_some(),
        api_secret_configured: api_secret.is_some(),
        connection_time_ms: None,
        error_message: None,
        suggestions: Vec::new(),
        // ✅ NOUVEAU: Vérifications automatiques
        ip_is_public: None,
        ip_address: None,
        firewall_check: None,
        server_status: None,
    };

    // 1. Vérifier la configuration
    if !diagnostic.api_key_configured {
        diagnostic.suggestions.push(
            "LIVEKIT_API_KEY n'est pas configuré. Vérifiez les variables d'environnement sur Render.com".to_string(),
        );
    }
    if !diagnostic.api_secret_configured {
        diagnostic.suggestions.push(
            "LIVEKIT_API_SECRET n'est pas configuré. Vérifiez les variables d'environnement sur Render.com".to_string(),
        );
    }

    if !diagnostic.api_key_configured || !diagnostic.api_secret_configured {
        diagnostic.error_message = Some("Configuration LiveKit incomplète".to_string());
        return diagnostic;
    }

    // 2. Tester la connexion TCP au serveur
    let start = Instant::now();
    let base_url = api_url.trim_end_matches('/');

    // Extraire l'host et le port de l'URL
    let (host, port) = match extract_host_port(base_url) {
        Some((h, p)) => (h, p),
        None => {
            diagnostic.error_message = Some(format!("URL LiveKit invalide: {}", base_url));
            diagnostic.suggestions.push(
                "Vérifiez que LIVEKIT_API_URL est au format http://host:port ou https://host:port"
                    .to_string(),
            );
            return diagnostic;
        }
    };

    diagnostic.ip_address = Some(host.clone());

    // ✅ VÉRIFICATION AUTOMATIQUE 1: Vérifier si l'IP est publique ou privée
    let is_public_ip = check_if_public_ip(&host);
    diagnostic.ip_is_public = Some(is_public_ip);

    if !is_public_ip {
        diagnostic.suggestions.push(format!(
            "⚠️ IP privée détectée ({}) - Le serveur doit être accessible depuis Internet",
            host
        ));
        diagnostic.suggestions.push("  Solutions possibles:".to_string());
        diagnostic.suggestions.push("    - Utiliser une IP publique".to_string());
        diagnostic
            .suggestions
            .push("    - Configurer un tunnel (ngrok, cloudflare tunnel, etc.)".to_string());
        diagnostic
            .suggestions
            .push("    - Utiliser un service LiveKit cloud (livekit.cloud)".to_string());
    } else {
        diagnostic.suggestions.push(format!("✅ IP publique détectée ({})", host));
    }

    // ✅ VÉRIFICATION AUTOMATIQUE 2: Vérifier le statut du serveur (ping/connectivité)
    let server_status_result = check_server_status(&host, port).await;
    diagnostic.server_status = Some(server_status_result.clone());

    match server_status_result.as_str() {
        s if s.contains("accessible") => {
            diagnostic.suggestions.push(format!("✅ Serveur: {}", s));
        }
        s if s.contains("timeout") => {
            diagnostic
                .suggestions
                .push(format!("⚠️ Serveur: {} - Le serveur ne répond pas", s));
            diagnostic
                .suggestions
                .push("  - Vérifiez que le serveur LiveKit est démarré".to_string());
            diagnostic
                .suggestions
                .push("  - Vérifiez les logs du serveur LiveKit".to_string());
        }
        s if s.contains("refusée") => {
            diagnostic.suggestions.push(format!("❌ Serveur: {} - Connexion refusée", s));
            diagnostic
                .suggestions
                .push("  - Le serveur LiveKit n'est probablement pas démarré".to_string());
            diagnostic.suggestions.push(
                "  - Vérifiez: systemctl status livekit (ou docker ps | grep livekit)".to_string(),
            );
        }
        _ => {}
    }

    // ✅ VÉRIFICATION AUTOMATIQUE 3: Vérifier le firewall (test de connexion sur plusieurs ports)
    let firewall_check_result = check_firewall(&host, port).await;
    diagnostic.firewall_check = Some(firewall_check_result.clone());

    if firewall_check_result.contains("bloqué") || firewall_check_result.contains("fermé") {
        diagnostic.suggestions.push(format!("⚠️ Firewall: {}", firewall_check_result));
        diagnostic
            .suggestions
            .push(format!("  - Ouvrir le port {} dans le firewall", port));
        diagnostic
            .suggestions
            .push(format!("  - Commande Linux: sudo ufw allow {}/tcp", port));
        diagnostic.suggestions.push(format!(
            "  - Commande iptables: sudo iptables -A INPUT -p tcp --dport {} -j ACCEPT",
            port
        ));
    } else if firewall_check_result.contains("accessible") {
        diagnostic.suggestions.push(format!("✅ Firewall: {}", firewall_check_result));
    }

    // ✅ AMÉLIORATION: Test de connexion TCP avec timeout et retry
    let mut tcp_connected = false;
    let mut tcp_error = None;

    for attempt in 1..=3 {
        match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            tokio::net::TcpStream::connect(format!("{}:{}", host, port)),
        )
        .await
        {
            Ok(Ok(_)) => {
                diagnostic.server_reachable = true;
                diagnostic.connection_time_ms = Some(start.elapsed().as_millis());
                tcp_connected = true;
                break;
            }
            Ok(Err(e)) => {
                tcp_error = Some(e);
                if attempt < 3 {
                    // Attendre avant de réessayer
                    tokio::time::sleep(std::time::Duration::from_millis(500 * attempt as u64))
                        .await;
                }
            }
            Err(_) => {
                tcp_error = Some(std::io::Error::new(
                    std::io::ErrorKind::TimedOut,
                    "Timeout de connexion TCP (5s)",
                ));
            }
        }
    }

    if !tcp_connected {
        let err_msg = tcp_error
            .map(|e| format!("{}", e))
            .unwrap_or_else(|| "Erreur inconnue".to_string());

        diagnostic.error_message = Some(format!(
            "Connexion TCP refusée après 3 tentatives: {}",
            err_msg
        ));
        diagnostic.suggestions.push(format!(
            "Le serveur LiveKit n'est pas accessible sur {}:{}. Vérifiez que:",
            host, port
        ));
        diagnostic.suggestions.push("  - Le serveur LiveKit est démarré".to_string());
        diagnostic
            .suggestions
            .push("  - Le port est ouvert dans le firewall".to_string());
        diagnostic.suggestions.push("  - L'IP/Port sont corrects".to_string());
        diagnostic
            .suggestions
            .push("  - Le serveur n'est pas sur un réseau privé".to_string());
        diagnostic.suggestions.push(format!(
            "  - Test manuel: telnet {} {} (ou nc -zv {} {})",
            host, port, host, port
        ));
        diagnostic
            .suggestions
            .push(format!("  - Test HTTP: curl -v http://{}:{}/", host, port));

        // Note: La vérification d'IP privée est déjà faite plus haut

        return diagnostic;
    }

    // 3. Tester l'endpoint API avec authentification
    let client = reqwest::Client::new();
    let list_endpoint = format!("{}/twirp/livekit.RoomService/ListRooms", base_url);

    let token = match generate_server_access_token(api_key.unwrap(), api_secret.unwrap()) {
        Ok(t) => t,
        Err(e) => {
            diagnostic.error_message = Some(format!("Erreur génération token: {}", e));
            diagnostic.suggestions.push(
                "Vérifiez que LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont corrects".to_string(),
            );
            return diagnostic;
        }
    };

    let api_start = Instant::now();
    match client
        .post(&list_endpoint)
        .bearer_auth(&token)
        .json(&serde_json::json!({}))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            diagnostic.api_endpoint_accessible = true;
            diagnostic.connection_time_ms = Some(api_start.elapsed().as_millis());

            if status == reqwest::StatusCode::UNAUTHORIZED {
                diagnostic.error_message =
                    Some("Authentification échouée (401 Unauthorized)".to_string());
                diagnostic.suggestions.push(
                    "Vérifiez que LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont corrects".to_string(),
                );
                diagnostic.suggestions.push(
                    "Vérifiez que les identifiants correspondent au serveur LiveKit".to_string(),
                );
            } else if status.is_success() {
                diagnostic.authentication_working = true;
            } else {
                diagnostic.error_message =
                    Some(format!("Réponse inattendue du serveur: {}", status));
                diagnostic.suggestions.push(format!(
                    "Le serveur a répondu avec le statut {}. Vérifiez les logs du serveur LiveKit",
                    status
                ));
            }
        }
        Err(e) => {
            let err_msg = format!("{}", e);
            diagnostic.error_message = Some(format!("Erreur requête API: {}", err_msg));

            if err_msg.contains("Connection refused") || err_msg.contains("tcp connect error") {
                diagnostic.suggestions.push(
                    "Connexion refusée - le serveur LiveKit n'est peut-être pas démarré"
                        .to_string(),
                );
            } else if err_msg.contains("timeout") {
                diagnostic.suggestions.push(
                    "Timeout - le serveur LiveKit ne répond pas dans les 10 secondes".to_string(),
                );
                diagnostic
                    .suggestions
                    .push("Vérifiez la connectivité réseau et la charge du serveur".to_string());
            } else if err_msg.contains("certificate") || err_msg.contains("TLS") {
                diagnostic.suggestions.push(
                    "Erreur TLS - essayez https:// au lieu de http:// si disponible".to_string(),
                );
            } else {
                diagnostic.suggestions.push(format!("Erreur inconnue: {}", err_msg));
            }
        }
    }

    // 4. Suggestions finales
    if diagnostic.authentication_working {
        diagnostic
            .suggestions
            .push("✅ LiveKit est opérationnel et accessible".to_string());
    } else if diagnostic.server_reachable && !diagnostic.api_endpoint_accessible {
        diagnostic
            .suggestions
            .push("Le serveur est accessible mais l'API ne répond pas correctement".to_string());
        diagnostic.suggestions.push(format!(
            "Test manuel: curl -v -H 'Authorization: Bearer <token>' {}",
            list_endpoint
        ));
    }

    diagnostic
}

/// Extrait l'host et le port d'une URL
fn extract_host_port(url: &str) -> Option<(String, u16)> {
    // Enlever le protocole
    let without_proto = url
        .strip_prefix("http://")
        .or_else(|| url.strip_prefix("https://"))
        .unwrap_or(url);

    // Séparer host:port
    let parts: Vec<&str> = without_proto.split('/').next()?.split(':').collect();

    if parts.len() == 2 {
        let host = parts[0].to_string();
        let port = parts[1].parse().ok()?;
        Some((host, port))
    } else if parts.len() == 1 {
        // Port par défaut selon le protocole
        let port = if url.starts_with("https://") { 443 } else { 80 };
        Some((parts[0].to_string(), port))
    } else {
        None
    }
}

/// ✅ Vérifie si une IP est publique ou privée
fn check_if_public_ip(host: &str) -> bool {
    // Essayer de parser comme IP
    if let Ok(ip) = host.parse::<IpAddr>() {
        match ip {
            IpAddr::V4(ipv4) => {
                let octets = ipv4.octets();
                // IPs privées:
                // 10.0.0.0/8
                // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
                // 192.168.0.0/16
                // 127.0.0.0/8 (localhost)
                !(
                    octets[0] == 10
                        || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
                        || (octets[0] == 192 && octets[1] == 168)
                        || (octets[0] == 127)
                        || (octets[0] == 169 && octets[1] == 254)
                    // Link-local
                )
            }
            IpAddr::V6(_) => {
                // Pour IPv6, on considère que les adresses commençant par fe80:: sont link-local (privées)
                !host.starts_with("fe80::") && !host.starts_with("::1")
            }
        }
    } else {
        // Si ce n'est pas une IP, c'est probablement un hostname
        // On considère que les hostnames sont publics (sauf localhost)
        !host.eq_ignore_ascii_case("localhost")
            && !host.ends_with(".local")
            && !host.starts_with("127.")
            && !host.starts_with("192.168.")
            && !host.starts_with("10.")
    }
}

/// ✅ Vérifie le statut du serveur (ping/connectivité)
async fn check_server_status(host: &str, port: u16) -> String {
    // Test de connexion TCP avec timeout court
    match tokio::time::timeout(
        std::time::Duration::from_secs(3),
        tokio::net::TcpStream::connect(format!("{}:{}", host, port)),
    )
    .await
    {
        Ok(Ok(_)) => {
            format!("Serveur accessible sur {}:{}", host, port)
        }
        Ok(Err(e)) => {
            let err_str = format!("{}", e);
            if err_str.contains("Connection refused") {
                format!("Connexion refusée - Le serveur LiveKit n'est probablement pas démarré sur {}:{}", host, port)
            } else if err_str.contains("No route to host")
                || err_str.contains("Network unreachable")
            {
                format!(
                    "Réseau inaccessible - Vérifiez la connectivité réseau vers {}:{}",
                    host, port
                )
            } else {
                format!("Erreur de connexion: {}", e)
            }
        }
        Err(_) => {
            format!(
                "Timeout de connexion (3s) - Le serveur {}:{} ne répond pas",
                host, port
            )
        }
    }
}

/// ✅ Vérifie le firewall (test de connexion sur le port)
async fn check_firewall(host: &str, port: u16) -> String {
    // Test de connexion avec timeout
    match tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(format!("{}:{}", host, port)),
    )
    .await
    {
        Ok(Ok(_)) => {
            format!("Port {} accessible - Le firewall semble ouvert", port)
        }
        Ok(Err(e)) => {
            let err_str = format!("{}", e);
            if err_str.contains("Connection refused") {
                // Connection refused peut signifier soit serveur non démarré, soit firewall
                format!(
                    "Port {} - Connexion refusée (serveur non démarré ou firewall bloquant)",
                    port
                )
            } else if err_str.contains("No route to host") {
                format!(
                    "Port {} - Route inaccessible (firewall ou réseau bloquant)",
                    port
                )
            } else if err_str.contains("Connection timed out") {
                format!("Port {} - Timeout (probablement bloqué par firewall)", port)
            } else {
                format!("Port {} - Erreur: {}", port, e)
            }
        }
        Err(_) => {
            format!("Port {} - Timeout (probablement bloqué par firewall)", port)
        }
    }
}
