//! ✅ Phase 2 - Middleware de Rate Limiting
//! Protection contre la surcharge et les attaques DDoS

use axum::middleware::Next;
use axum::{extract::Request, http::StatusCode, response::Response};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tokio::sync::RwLock;

// ✅ Phase 3: Métriques rate limiting
static RATE_LIMIT_BLOCKED_TOTAL: AtomicU64 = AtomicU64::new(0);
static RATE_LIMIT_BLOCKED_BY_IP_TOTAL: AtomicU64 = AtomicU64::new(0);
static RATE_LIMIT_BLOCKED_BY_USER_TOTAL: AtomicU64 = AtomicU64::new(0);

pub fn get_rate_limit_metrics() -> (u64, u64, u64) {
    (
        RATE_LIMIT_BLOCKED_TOTAL.load(Ordering::Relaxed),
        RATE_LIMIT_BLOCKED_BY_IP_TOTAL.load(Ordering::Relaxed),
        RATE_LIMIT_BLOCKED_BY_USER_TOTAL.load(Ordering::Relaxed),
    )
}

/// Limiteur de taux simple par clé (IP, user_id, etc.)
#[derive(Clone)]
pub struct RateLimiter {
    #[allow(dead_code)]
    limits: Arc<RwLock<HashMap<String, RateLimitEntry>>>,
    max_requests: u32,
    window_seconds: u64,
    #[allow(dead_code)]
    cleanup_interval: Duration,
}

struct RateLimitEntry {
    count: u32,
    reset_at: Instant,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_seconds: u64) -> Self {
        Self {
            limits: Arc::new(RwLock::new(HashMap::new())),
            max_requests,
            window_seconds,
            cleanup_interval: Duration::from_secs(300), // Nettoyage toutes les 5 min
        }
    }

    /// Vérifie si une requête est autorisée pour une clé donnée
    pub async fn check_limit(&self, key: &str) -> bool {
        let mut limits = self.limits.write().await;
        let now = Instant::now();

        // Nettoyer les entrées expirées périodiquement
        if limits.len() > 10000 {
            limits.retain(|_, entry| entry.reset_at > now);
        }

        let entry = limits
            .entry(key.to_string())
            .or_insert_with(|| RateLimitEntry {
                count: 0,
                reset_at: now + Duration::from_secs(self.window_seconds),
            });

        // Réinitialiser si la fenêtre est expirée
        if now >= entry.reset_at {
            entry.count = 0;
            entry.reset_at = now + Duration::from_secs(self.window_seconds);
        }

        // Vérifier la limite
        if entry.count >= self.max_requests {
            return false;
        }

        entry.count += 1;
        true
    }

    /// Obtient le nombre de requêtes restantes pour une clé
    pub async fn remaining(&self, key: &str) -> u32 {
        let limits = self.limits.read().await;
        let now = Instant::now();

        if let Some(entry) = limits.get(key) {
            if now >= entry.reset_at {
                return self.max_requests;
            }
            self.max_requests.saturating_sub(entry.count)
        } else {
            self.max_requests
        }
    }
}

/// Limiteur global pour toutes les requêtes
pub struct GlobalRateLimiter {
    limiter: RateLimiter,
}

impl GlobalRateLimiter {
    pub fn new(max_requests_per_second: u32) -> Self {
        Self {
            limiter: RateLimiter::new(max_requests_per_second, 1),
        }
    }

    pub async fn check(&self, key: &str) -> bool {
        self.limiter.check_limit(key).await
    }
}

/// Limiteur par utilisateur
pub struct UserRateLimiter {
    limiter: RateLimiter,
}

impl UserRateLimiter {
    pub fn new(max_requests_per_minute: u32) -> Self {
        Self {
            limiter: RateLimiter::new(max_requests_per_minute, 60),
        }
    }

    pub async fn check(&self, user_id: i32) -> bool {
        self.limiter.check_limit(&format!("user:{}", user_id)).await
    }

    pub async fn remaining(&self, user_id: i32) -> u32 {
        self.limiter.remaining(&format!("user:{}", user_id)).await
    }
}

/// Extrait l'IP réelle depuis les headers (support proxy/load balancer)
fn extract_client_ip(headers: &axum::http::HeaderMap) -> String {
    // Vérifier les headers de proxy courants
    if let Some(forwarded_for) = headers.get("x-forwarded-for") {
        if let Ok(ip_str) = forwarded_for.to_str() {
            // Prendre la première IP (client réel)
            if let Some(first_ip) = ip_str.split(',').next() {
                return first_ip.trim().to_string();
            }
        }
    }

    if let Some(real_ip) = headers.get("x-real-ip") {
        if let Ok(ip_str) = real_ip.to_str() {
            return ip_str.to_string();
        }
    }

    // Fallback
    "unknown".to_string()
}

/// Middleware Axum pour rate limiting global (par IP)
pub async fn rate_limit_middleware(
    axum::extract::State(state): axum::extract::State<std::sync::Arc<crate::state::AppState>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extraire l'IP réelle
    let ip = extract_client_ip(request.headers());
    let key = format!("ip:{}", ip);

    // Vérifier le rate limit
    if !state.global_rate_limiter.check(&key).await {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(request).await)
}

/// Middleware pour rate limiting par utilisateur
pub async fn user_rate_limit_middleware(
    axum::extract::State(state): axum::extract::State<std::sync::Arc<crate::state::AppState>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    use crate::middlewares::jwt::AuthenticatedUser;

    // Extraire user_id depuis le token JWT (si authentifié)
    let user_id = request
        .extensions()
        .get::<AuthenticatedUser>()
        .map(|user| user.id)
        .unwrap_or(0);

    // Si non authentifié, utiliser l'IP comme fallback
    if user_id == 0 {
        let ip = extract_client_ip(request.headers());
        let key = format!("ip:{}", ip);

        if !state.global_rate_limiter.check(&key).await {
            RATE_LIMIT_BLOCKED_TOTAL.fetch_add(1, Ordering::Relaxed);
            RATE_LIMIT_BLOCKED_BY_IP_TOTAL.fetch_add(1, Ordering::Relaxed);
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    } else {
        // Utilisateur authentifié: rate limiting par user_id
        if !state.user_rate_limiter.check(user_id).await {
            RATE_LIMIT_BLOCKED_TOTAL.fetch_add(1, Ordering::Relaxed);
            RATE_LIMIT_BLOCKED_BY_USER_TOTAL.fetch_add(1, Ordering::Relaxed);
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }

    Ok(next.run(request).await)
}
