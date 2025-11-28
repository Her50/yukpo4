use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
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
            diagnostic.suggestions.push("Vérifiez que LIVEKIT_API_URL est au format http://host:port ou https://host:port".to_string());
            return diagnostic;
        }
    };

    // Test de connexion TCP
    match tokio::net::TcpStream::connect(format!("{}:{}", host, port)).await {
        Ok(_) => {
            diagnostic.server_reachable = true;
            diagnostic.connection_time_ms = Some(start.elapsed().as_millis());
        }
        Err(e) => {
            diagnostic.error_message = Some(format!("Connexion TCP refusée: {}", e));
            diagnostic.suggestions.push(format!(
                "Le serveur LiveKit n'est pas accessible sur {}:{}. Vérifiez que:",
                host, port
            ));
            diagnostic.suggestions.push("  - Le serveur LiveKit est démarré".to_string());
            diagnostic.suggestions.push("  - Le port est ouvert dans le firewall".to_string());
            diagnostic.suggestions.push("  - L'IP/Port sont corrects".to_string());
            diagnostic.suggestions.push("  - Le serveur n'est pas sur un réseau privé".to_string());
            return diagnostic;
        }
    }

    // 3. Tester l'endpoint API avec authentification
    let client = reqwest::Client::new();
    let list_endpoint = format!("{}/twirp/livekit.RoomService/ListRooms", base_url);
    
    let token = match generate_server_access_token(api_key.unwrap(), api_secret.unwrap()) {
        Ok(t) => t,
        Err(e) => {
            diagnostic.error_message = Some(format!("Erreur génération token: {}", e));
            diagnostic.suggestions.push("Vérifiez que LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont corrects".to_string());
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
                diagnostic.error_message = Some("Authentification échouée (401 Unauthorized)".to_string());
                diagnostic.suggestions.push("Vérifiez que LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont corrects".to_string());
                diagnostic.suggestions.push("Vérifiez que les identifiants correspondent au serveur LiveKit".to_string());
            } else if status.is_success() {
                diagnostic.authentication_working = true;
            } else {
                diagnostic.error_message = Some(format!("Réponse inattendue du serveur: {}", status));
                diagnostic.suggestions.push(format!("Le serveur a répondu avec le statut {}. Vérifiez les logs du serveur LiveKit", status));
            }
        }
        Err(e) => {
            let err_msg = format!("{}", e);
            diagnostic.error_message = Some(format!("Erreur requête API: {}", err_msg));
            
            if err_msg.contains("Connection refused") || err_msg.contains("tcp connect error") {
                diagnostic.suggestions.push("Connexion refusée - le serveur LiveKit n'est peut-être pas démarré".to_string());
            } else if err_msg.contains("timeout") {
                diagnostic.suggestions.push("Timeout - le serveur LiveKit ne répond pas dans les 10 secondes".to_string());
                diagnostic.suggestions.push("Vérifiez la connectivité réseau et la charge du serveur".to_string());
            } else if err_msg.contains("certificate") || err_msg.contains("TLS") {
                diagnostic.suggestions.push("Erreur TLS - essayez https:// au lieu de http:// si disponible".to_string());
            } else {
                diagnostic.suggestions.push(format!("Erreur inconnue: {}", err_msg));
            }
        }
    }

    // 4. Suggestions finales
    if diagnostic.authentication_working {
        diagnostic.suggestions.push("✅ LiveKit est opérationnel et accessible".to_string());
    } else if diagnostic.server_reachable && !diagnostic.api_endpoint_accessible {
        diagnostic.suggestions.push("Le serveur est accessible mais l'API ne répond pas correctement".to_string());
        diagnostic.suggestions.push(format!("Test manuel: curl -v -H 'Authorization: Bearer <token>' {}", list_endpoint));
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
