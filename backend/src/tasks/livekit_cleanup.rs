use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use reqwest::{Client, StatusCode};
use serde_json::json;

use crate::{
    config::live_streaming::LiveStreamingConfig, state::AppState,
    utils::livekit::generate_server_access_token,
};

const CLEANUP_INTERVAL_MINUTES: u64 = 15;
const FALLBACK_IDLE_THRESHOLD_SECS: i64 = 30 * 60; // 30 minutes

/// Lance une tâche périodique qui nettoie les rooms et ingress LiveKit / SRS inactifs.
pub fn start_livekit_cleanup_task(state: Arc<AppState>) {
    // Exécuter une première fois immédiatement
    let immediate_state = state.clone();
    tokio::spawn(async move {
        // Flag partagé pour limiter la verbosité des logs de connexion
        let connection_error_logged = Arc::new(AtomicBool::new(false));
        let connection_error_logged_first = connection_error_logged.clone();
        
        if let Err(err) = cleanup_once(immediate_state.clone()).await {
            // Logger une seule fois si c'est une erreur de connexion (service non disponible)
            let err_str = format!("{err:?}").to_lowercase();
            if err_str.contains("connection refused") 
                || err_str.contains("connexion refusée")
                || err_str.contains("tcp connect error")
                || err_str.contains("service non disponible") {
                if !connection_error_logged_first.swap(true, Ordering::Relaxed) {
                    log::info!("ℹ️ LiveKit non disponible (service optionnel). Nettoyage automatique désactivé.");
                }
            } else {
                log::warn!("LiveKit cleanup initial failed: {err:?}");
            }
        }

        let mut ticker = tokio::time::interval(Duration::from_secs(CLEANUP_INTERVAL_MINUTES * 60));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            ticker.tick().await;
            if let Err(err) = cleanup_once(immediate_state.clone()).await {
                // Ne plus logger les erreurs de connexion répétées
                let err_str = format!("{err:?}").to_lowercase();
                if err_str.contains("connection refused") 
                    || err_str.contains("connexion refusée")
                    || err_str.contains("tcp connect error")
                    || err_str.contains("service non disponible") {
                    // Ignorer les erreurs de connexion répétées (déjà loggé une fois)
                    continue;
                } else {
                    log::warn!("LiveKit cleanup failed: {err:?}");
                }
            } else {
                // Si la connexion réussit après une erreur, réinitialiser le flag
                if connection_error_logged.swap(false, Ordering::Relaxed) {
                    log::info!("✅ LiveKit disponible. Nettoyage automatique activé.");
                }
            }
        }
    });
}

async fn cleanup_once(state: Arc<AppState>) -> Result<()> {
    let config = state.live_streaming.clone();
    if !config.is_livekit_enabled() {
        // Rien à faire si LiveKit est désactivé
        return Ok(());
    }

    let client = Client::new();
    cleanup_rooms(&client, &config).await?;
    cleanup_ingress(&client, &config).await?;

    Ok(())
}

async fn cleanup_rooms(client: &Client, config: &LiveStreamingConfig) -> Result<()> {
    let base_url = config
        .livekit_api_url
        .as_ref()
        .map(|url| url.trim_end_matches('/').to_string())
        .context("LIVEKIT_API_URL manquant")?;
    let api_key = config
        .livekit_api_key
        .as_ref()
        .context("LIVEKIT_API_KEY manquant")?;
    let api_secret = config
        .livekit_api_secret
        .as_ref()
        .context("LIVEKIT_API_SECRET manquant")?;

    let list_endpoint = format!("{}/twirp/livekit.RoomService/ListRooms", base_url);
    let token = generate_server_access_token(api_key, api_secret).map_err(|err| anyhow!(err))?;
    let response = client
        .post(&list_endpoint)
        .bearer_auth(token)
        .json(&json!({}))
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| {
            // Améliorer le message d'erreur pour les connexions refusées
            let err_msg = format!("{}", e);
            if err_msg.contains("Connection refused") || err_msg.contains("tcp connect error") {
                anyhow!("LiveKit service non disponible: connexion refusée")
            } else {
                anyhow!(e).context("appel ListRooms")
            }
        })?;

    let status = response.status();
    if status == StatusCode::UNAUTHORIZED {
        log::info!(
            "LiveKit ListRooms a renvoyé 401 Unauthorized. Vérifiez les identifiants LiveKit."
        );
        return Ok(());
    }

    if !status.is_success() {
        log::warn!("LiveKit ListRooms renvoie un statut inattendu: {}", status);
        return Ok(());
    }

    let payload: serde_json::Value = response.json().await.context("parse ListRooms")?;
    let rooms = payload
        .get("rooms")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let now_ts = Utc::now().timestamp();
    let ttl = config.default_room_ttl_seconds as i64;
    let threshold = if ttl > 0 {
        ttl
    } else {
        FALLBACK_IDLE_THRESHOLD_SECS
    };

    for room in rooms {
        let name = room
            .get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let num_participants = room
            .get("num_participants")
            .and_then(|v| v.as_i64())
            .unwrap_or_default();
        let empty_since = room
            .get("empty_since")
            .and_then(|v| v.as_i64())
            .or_else(|| room.get("creation_time").and_then(|v| v.as_i64()))
            .unwrap_or(now_ts);

        let Some(room_name) = name else {
            continue;
        };

        if num_participants == 0 && now_ts - empty_since > threshold {
            delete_room(client, &base_url, api_key, api_secret, &room_name).await?;
        }
    }

    Ok(())
}

async fn delete_room(
    client: &Client,
    base_url: &str,
    api_key: &str,
    api_secret: &str,
    room_name: &str,
) -> Result<()> {
    let endpoint = format!("{}/twirp/livekit.RoomService/DeleteRoom", base_url);
    let token = generate_server_access_token(api_key, api_secret).map_err(|err| anyhow!(err))?;
    let response = client
        .post(endpoint)
        .bearer_auth(token)
        .json(&json!({ "room": room_name }))
        .send()
        .await
        .with_context(|| format!("suppression room {room_name}"))?;

    if response.status().is_success() {
        log::info!("✅ LiveKit: salle \"{room_name}\" supprimée (inactive)");
    } else {
        log::warn!(
            "LiveKit: échec suppression salle \"{room_name}\" (status {})",
            response.status()
        );
    }

    Ok(())
}

async fn cleanup_ingress(client: &Client, config: &LiveStreamingConfig) -> Result<()> {
    let base_url = config
        .livekit_api_url
        .as_ref()
        .map(|url| url.trim_end_matches('/').to_string())
        .context("LIVEKIT_API_URL manquant")?;
    let api_key = config
        .livekit_api_key
        .as_ref()
        .context("LIVEKIT_API_KEY manquant")?;
    let api_secret = config
        .livekit_api_secret
        .as_ref()
        .context("LIVEKIT_API_SECRET manquant")?;

    let list_endpoint = format!("{}/twirp/livekit.Ingress/ListIngress", base_url);
    let token = generate_server_access_token(api_key, api_secret).map_err(|err| anyhow!(err))?;
    let response = client
        .post(list_endpoint)
        .bearer_auth(token)
        .json(&json!({}))
        .send()
        .await
        .context("appel ListIngress")?;

    let status = response.status();
    if status == StatusCode::UNAUTHORIZED {
        log::info!(
            "LiveKit ListIngress a renvoyé 401 Unauthorized. Vérifiez les identifiants LiveKit."
        );
        return Ok(());
    }

    if !status.is_success() {
        log::warn!(
            "LiveKit ListIngress renvoie un statut inattendu: {}",
            status
        );
        return Ok(());
    }

    let payload: serde_json::Value = response.json().await.context("parse ListIngress")?;
    let ingress_list = payload
        .get("items")
        .or_else(|| payload.get("ingress"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    for ingress in ingress_list {
        let ingress_id = ingress
            .get("ingress_id")
            .or_else(|| ingress.get("ingressId"))
            .and_then(|v| v.as_str());
        let active = ingress
            .get("state")
            .and_then(|state| state.get("active"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let associated_room = ingress
            .get("room_name")
            .or_else(|| ingress.get("roomName"))
            .and_then(|v| v.as_str());

        let Some(ingress_id) = ingress_id else {
            continue;
        };

        if !active || associated_room.is_none() {
            delete_ingress(client, &base_url, api_key, api_secret, ingress_id).await?;
        }
    }

    Ok(())
}

async fn delete_ingress(
    client: &Client,
    base_url: &str,
    api_key: &str,
    api_secret: &str,
    ingress_id: &str,
) -> Result<()> {
    let endpoint = format!("{}/twirp/livekit.Ingress/DeleteIngress", base_url);
    let token = generate_server_access_token(api_key, api_secret).map_err(|err| anyhow!(err))?;
    let response = client
        .post(endpoint)
        .bearer_auth(token)
        .json(&json!({ "ingress_id": ingress_id }))
        .send()
        .await
        .with_context(|| format!("suppression ingress {ingress_id}"))?;

    if response.status().is_success() {
        log::info!("✅ LiveKit: ingress \"{ingress_id}\" supprimé (inactive)");
    } else {
        log::warn!(
            "LiveKit: échec suppression ingress \"{ingress_id}\" (status {})",
            response.status()
        );
    }

    Ok(())
}
