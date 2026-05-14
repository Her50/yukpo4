//! Phase B Piste 4 — Worker qui consomme yukposhop_distribution_requests.
//!
//! Polle la queue toutes les 30 secondes, picknt jusqu'à 10 jobs en
//! status='pending', les marque 'processing', tente la publication via
//! les credentials social_accounts du user, et marque 'done' ou 'failed'.
//!
//! Implémentation v0 :
//!   - Audit + transition d'état ('pending' -> 'processing' -> 'done'/'failed')
//!   - Post Facebook minimal via Meta Graph API (caption + photo + lien
//!     retour storefront). Pour Instagram/WhatsApp/TikTok : marqué
//!     'skipped' avec note "platform pas encore wired Phase B v0".
//!   - Retry simple : 3 attempts cumulés avant abandon final.
//!
//! Lancement : `tokio::spawn(spawn_worker(state))` dans main.rs au boot.

use crate::state::AppState;
use log::{info, warn};
use serde_json::Value;
use sqlx::Row;
use std::sync::Arc;
use std::time::Duration;

const POLL_INTERVAL_S: u64 = 30;
const BATCH_SIZE: i32 = 10;
const MAX_ATTEMPTS: i32 = 3;
const META_GRAPH_BASE: &str = "https://graph.facebook.com/v19.0";


pub fn spawn_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        info!("[yukposhop-dist-worker] démarrage (poll {}s)", POLL_INTERVAL_S);
        // Petit délai initial pour laisser les autres systèmes démarrer
        tokio::time::sleep(Duration::from_secs(15)).await;
        loop {
            match run_one_batch(&*state).await {
                Ok(n) if n > 0 => info!("[yukposhop-dist-worker] batch processed: {}", n),
                Ok(_) => {}
                Err(e) => warn!("[yukposhop-dist-worker] batch error: {}", e),
            }
            tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_S)).await;
        }
    });
}


async fn run_one_batch(state: &AppState) -> Result<u32, sqlx::Error> {
    // 1. Pick + lock un batch (status='pending' OR status='retry')
    //    En SELECT FOR UPDATE SKIP LOCKED pour éviter qu'un autre worker
    //    (futur replica) reprenne les mêmes lignes.
    let rows = sqlx::query(
        "SELECT id, rust_service_id, rust_user_id, external_id, platform, \
                message_template, attempts \
         FROM yukposhop_distribution_requests \
         WHERE status IN ('pending', 'retry') AND attempts < $1 \
         ORDER BY created_at ASC \
         LIMIT $2 \
         FOR UPDATE SKIP LOCKED",
    )
    .bind(MAX_ATTEMPTS)
    .bind(BATCH_SIZE as i64)
    .fetch_all(&state.pg)
    .await?;

    if rows.is_empty() {
        return Ok(0);
    }

    let mut processed = 0u32;
    for row in rows {
        let job_id: i64 = row.get("id");
        let service_id: i32 = row.get("rust_service_id");
        let user_id: i32 = row.get("rust_user_id");
        let _ext_id: String = row.get("external_id");
        let platform: String = row.get("platform");
        let msg_template: Option<String> = row.try_get("message_template").ok();
        let attempts: i32 = row.get("attempts");

        // Mark 'processing' + increment attempts (atomique)
        let _ = sqlx::query(
            "UPDATE yukposhop_distribution_requests \
             SET status = 'processing', attempts = $1, updated_at = NOW() \
             WHERE id = $2",
        )
        .bind(attempts + 1)
        .bind(job_id)
        .execute(&state.pg)
        .await;

        // Tente la publication
        let outcome = process_one(state, service_id, user_id, &platform, msg_template.as_deref()).await;

        let (new_status, err_msg): (&str, Option<String>) = match outcome {
            Ok(()) => ("done", None),
            Err(e) => {
                let msg = e.to_string();
                if attempts + 1 >= MAX_ATTEMPTS {
                    ("failed", Some(msg))
                } else {
                    ("retry", Some(msg))
                }
            }
        };

        let _ = sqlx::query(
            "UPDATE yukposhop_distribution_requests \
             SET status = $1, last_error = $2, \
                 processed_at = CASE WHEN $1 = 'done' THEN NOW() ELSE processed_at END, \
                 updated_at = NOW() \
             WHERE id = $3",
        )
        .bind(new_status)
        .bind(&err_msg)
        .bind(job_id)
        .execute(&state.pg)
        .await;

        processed += 1;
        info!(
            "[yukposhop-dist-worker] job={} svc={} platform={} -> {} (attempt {})",
            job_id, service_id, platform, new_status, attempts + 1
        );
    }
    Ok(processed)
}


/// Tente la publication d'UN job sur UNE plateforme.
async fn process_one(
    state: &AppState,
    service_id: i32,
    user_id: i32,
    platform: &str,
    msg_template: Option<&str>,
) -> Result<(), String> {
    // 1. Récupère le service.data (titre, photos, prix, boutique_url, etc.)
    let svc_row = sqlx::query("SELECT data FROM services WHERE id = $1 LIMIT 1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| format!("lookup service: {e}"))?;
    let data: Value = match svc_row {
        Some(r) => r.try_get("data").map_err(|e| format!("get data: {e}"))?,
        None => return Err(format!("service {service_id} introuvable")),
    };
    let titre = data.get("titre").and_then(|v| v.as_str()).unwrap_or("Produit");
    let prix = data.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let devise = data.get("devise").and_then(|v| v.as_str()).unwrap_or("XAF");
    let boutique_url = data.get("boutique_url").and_then(|v| v.as_str()).unwrap_or("");
    let photo_url = data
        .get("photos_urls")
        .and_then(|v| v.as_array())
        .and_then(|a| a.first())
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let default_caption = format!(
        "🛍 {titre}\n💰 {} {devise}\n{}",
        prix as i64,
        if boutique_url.is_empty() { "" } else { boutique_url }
    );
    let caption = msg_template.unwrap_or(&default_caption);

    // 2. Récupère credentials selon plateforme
    let acc_row = sqlx::query(
        "SELECT account_id, access_token FROM social_accounts \
         WHERE user_id = $1 AND platform = $2 AND is_active = TRUE \
         ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(user_id)
    .bind(platform)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| format!("lookup social_account: {e}"))?;
    let acc = match acc_row {
        Some(r) => r,
        None => return Err(format!("compte {platform} non connecté pour user {user_id}")),
    };
    let account_id: String = acc.try_get("account_id").map_err(|e| format!("acc id: {e}"))?;
    let access_token: String = acc.try_get("access_token").map_err(|e| format!("acc tok: {e}"))?;

    match platform {
        "facebook" => post_facebook(&account_id, &access_token, caption, photo_url, boutique_url).await,
        // Phase B v0 : autres plateformes pas encore wired
        "instagram" | "whatsapp" | "tiktok" | "youtube" | "google_shopping" => {
            Err(format!("platform={platform} non implémentée en Phase B v0 (TODO: brancher logique existante via social_distribution_routes)"))
        }
        other => Err(format!("platform inconnue : {other}")),
    }
}


async fn post_facebook(
    page_id: &str,
    access_token: &str,
    caption: &str,
    photo_url: &str,
    link_url: &str,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("http client: {e}"))?;

    // Si on a une photo URL publique, on poste une photo. Sinon, post simple lien.
    let endpoint = if !photo_url.is_empty() {
        format!("{META_GRAPH_BASE}/{page_id}/photos")
    } else {
        format!("{META_GRAPH_BASE}/{page_id}/feed")
    };

    let mut params: Vec<(String, String)> = vec![
        ("access_token".into(), access_token.to_string()),
        ("message".into(), caption.to_string()),
    ];
    if !photo_url.is_empty() {
        params.push(("url".into(), photo_url.to_string()));
    } else if !link_url.is_empty() {
        params.push(("link".into(), link_url.to_string()));
    }

    let resp = client
        .post(&endpoint)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("fb http: {e}"))?;
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("fb HTTP {} : {}", status.as_u16(), body.chars().take(200).collect::<String>()));
    }
    info!("[yukposhop-dist-worker] FB post OK page={} body[..80]={}", page_id, body.chars().take(80).collect::<String>());
    Ok(())
}
