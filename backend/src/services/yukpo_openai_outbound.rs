//! Résilience des appels **OpenAI** (YukpoIA) : client HTTP partagé, plafond de concurrence
//! **par instance**, retries avec backoff sur **429 / 503**, et sélection optionnelle parmi
//! plusieurs clés (`OPENAI_API_KEYS`).
//!
//! À combiner avec : autoscaling + load balancer, files (Redis/SQS) pour travaux longs,
//! quotas côté fournisseur.

use log::warn;
use once_cell::sync::Lazy;
use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

static OPENAI_HTTP: Lazy<Client> = Lazy::new(|| {
    match Client::builder()
        .pool_max_idle_per_host(64)
        .timeout(Duration::from_secs(180))
        .connect_timeout(Duration::from_secs(25))
        .build()
    {
        Ok(c) => {
            log::info!("[YukpoOpenAI] Client HTTP partagé (pool idle/host≤64)");
            c
        }
        Err(e) => {
            log::warn!(
                "[YukpoOpenAI] reqwest::Client::builder échoué ({}), fallback",
                e
            );
            Client::new()
        }
    }
});

/// Limite le nombre d’appels OpenAI **simultanés** sur ce processus (complément au LB / autoscaling).
/// `YUKPO_IA_OPENAI_MAX_CONCURRENT` : entier > 0 ; absent ou 0 = pas de limite locale.
static OPENAI_CONCURRENCY: Lazy<Option<Arc<Semaphore>>> = Lazy::new(|| {
    std::env::var("YUKPO_IA_OPENAI_MAX_CONCURRENT")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .filter(|&n| n > 0)
        .map(|n| {
            log::info!(
                "[YukpoOpenAI] Concurrence sortante OpenAI plafonnée à {} / instance",
                n
            );
            Arc::new(Semaphore::new(n))
        })
});

/// Clé API : `OPENAI_API_KEYS` (virgules, **une clé choisie au hasard** par appel) ou `OPENAI_API_KEY`.
pub fn resolve_openai_api_key() -> Option<String> {
    if let Ok(keys) = std::env::var("OPENAI_API_KEYS") {
        let list: Vec<String> = keys
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        match list.len() {
            0 => {}
            1 => return Some(list[0].clone()),
            _ => {
                use rand::seq::SliceRandom;
                return list.choose(&mut rand::thread_rng()).cloned();
            }
        }
    }
    std::env::var("OPENAI_API_KEY").ok()
}

pub fn http_client() -> &'static Client {
    &OPENAI_HTTP
}

/// Borne les appels simultanés vers OpenAI sur **cette** instance (Semaphore).
pub async fn acquire_concurrency_permit() -> Option<OwnedSemaphorePermit> {
    let sem = OPENAI_CONCURRENCY.as_ref()?.clone();
    sem.acquire_owned().await.ok()
}

fn max_retries() -> u32 {
    std::env::var("YUKPO_IA_OPENAI_MAX_RETRIES")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(4)
        .max(1)
}

fn retry_base_ms() -> u64 {
    std::env::var("YUKPO_IA_OPENAI_RETRY_BASE_MS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(500)
}

fn compute_backoff_ms(headers: &reqwest::header::HeaderMap, attempt: u32) -> u64 {
    const MAX_MS: u64 = 60_000;
    if let Some(v) = headers.get("retry-after") {
        if let Ok(s) = v.to_str() {
            if let Ok(secs) = s.parse::<u64>() {
                return (secs.saturating_mul(1000)).min(MAX_MS);
            }
        }
    }
    let base = retry_base_ms();
    let pow = 2u64.saturating_pow(attempt);
    base.saturating_mul(pow).min(MAX_MS)
}

/// POST JSON avec backoff sur **429 / 503** — le builder est recréé à chaque tentative
/// (utilisé par **AppIA** multi-provider et par les routes YukpoIA directes).
pub async fn send_request_with_retry<F>(
    label: &str,
    mut build: F,
) -> Result<reqwest::Response, String>
where
    F: FnMut() -> reqwest::RequestBuilder,
{
    let max = max_retries();
    let mut attempt: u32 = 0;

    loop {
        let resp = build().send().await.map_err(|e| format!("network: {}", e))?;

        let status = resp.status();
        let retryable = status == 429 || status == 503;

        if retryable && attempt + 1 < max {
            let headers = resp.headers().clone();
            let snippet = resp.text().await.unwrap_or_default();
            warn!(
                "[YukpoOpenAI] {} HTTP {} — retry {}/{} — {}",
                label,
                status.as_u16(),
                attempt + 1,
                max,
                snippet.chars().take(200).collect::<String>()
            );
            let delay = compute_backoff_ms(&headers, attempt);
            tokio::time::sleep(Duration::from_millis(delay)).await;
            attempt += 1;
            continue;
        }

        if retryable {
            warn!(
                "[YukpoOpenAI] {} HTTP {} — retries épuisés ({})",
                label,
                status.as_u16(),
                max
            );
        }

        return Ok(resp);
    }
}

/// POST `/v1/chat/completions` — backoff sur 429 / 503 (réseau : `Err`).
pub async fn post_chat_completions(
    api_key: &str,
    body: &serde_json::Value,
) -> Result<reqwest::Response, String> {
    let client = http_client();
    let url = "https://api.openai.com/v1/chat/completions";
    let body = body.clone();
    let api_key = api_key.to_string();
    send_request_with_retry("chat", || {
        client
            .post(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
    })
    .await
}

/// POST `/v1/audio/transcriptions` — même logique de retry (le `Form` est reconstruit à chaque essai).
pub async fn post_audio_transcriptions<F>(
    api_key: &str,
    mut build_form: F,
) -> Result<reqwest::Response, String>
where
    F: FnMut() -> reqwest::multipart::Form,
{
    let client = http_client();
    let url = "https://api.openai.com/v1/audio/transcriptions";
    let max = max_retries();
    let mut attempt: u32 = 0;

    loop {
        let form = build_form();
        let resp = client
            .post(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("network: {}", e))?;

        let status = resp.status();
        let retryable = status == 429 || status == 503;

        if retryable && attempt + 1 < max {
            let headers = resp.headers().clone();
            let snippet = resp.text().await.unwrap_or_default();
            warn!(
                "[YukpoOpenAI] whisper HTTP {} — retry {}/{} — {}",
                status,
                attempt + 1,
                max,
                snippet.chars().take(200).collect::<String>()
            );
            let delay = compute_backoff_ms(&headers, attempt);
            tokio::time::sleep(Duration::from_millis(delay)).await;
            attempt += 1;
            continue;
        }

        if retryable {
            warn!(
                "[YukpoOpenAI] whisper HTTP {} — retries épuisés ({})",
                status.as_u16(),
                max
            );
        }

        return Ok(resp);
    }
}
