//! Métriques YukpoIA par **route** et par **tenant** (`user_id`) — utile pour tableaux de bord.
//! Stockage **en mémoire** par instance (compléter par Prometheus / logs infra en multi-instance).

use serde::Serialize;
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::Duration;

#[derive(Debug, Clone, Default, Serialize)]
pub struct RouteAgg {
    pub requests: u64,
    pub errors: u64,
    pub total_latency_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TenantRouteAgg {
    pub route: String,
    pub user_id: i32,
    pub requests: u64,
    pub errors: u64,
    pub total_latency_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct YukpoIaMetricsSnapshot {
    pub by_route: HashMap<String, RouteAgg>,
    pub by_tenant: Vec<TenantRouteAgg>,
    pub worker_jobs_completed: u64,
    pub worker_jobs_failed: u64,
}

pub struct YukpoIaMetricsService {
    by_route: RwLock<HashMap<String, RouteAgg>>,
    /// Clé `route|user_id` — plafonné pour éviter explosion mémoire.
    by_tenant: RwLock<HashMap<String, TenantRouteAgg>>,
    max_tenant_keys: usize,
    worker_completed: std::sync::atomic::AtomicU64,
    worker_failed: std::sync::atomic::AtomicU64,
}

impl YukpoIaMetricsService {
    pub fn new() -> Self {
        Self {
            by_route: RwLock::new(HashMap::new()),
            by_tenant: RwLock::new(HashMap::new()),
            max_tenant_keys: 10_000,
            worker_completed: std::sync::atomic::AtomicU64::new(0),
            worker_failed: std::sync::atomic::AtomicU64::new(0),
        }
    }

    /// `route` ex. `POST /ai/chat`, `yukpo_ia.worker.chat_job`
    pub fn record(&self, route: &str, user_id: i32, duration: Duration, ok: bool) {
        let ms = duration.as_millis() as u64;
        if let Ok(mut m) = self.by_route.write() {
            let e = m.entry(route.to_string()).or_default();
            e.requests += 1;
            if !ok {
                e.errors += 1;
            }
            e.total_latency_ms += ms;
        }

        let tk = format!("{}|{}", route, user_id);
        if let Ok(mut tm) = self.by_tenant.write() {
            if tm.len() < self.max_tenant_keys || tm.contains_key(&tk) {
                let e = tm.entry(tk).or_insert_with(|| TenantRouteAgg {
                    route: route.to_string(),
                    user_id,
                    requests: 0,
                    errors: 0,
                    total_latency_ms: 0,
                });
                e.requests += 1;
                if !ok {
                    e.errors += 1;
                }
                e.total_latency_ms += ms;
            }
        }
    }

    pub fn record_worker_job(&self, ok: bool) {
        if ok {
            self.worker_completed.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        } else {
            self.worker_failed.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
    }

    pub fn snapshot(&self) -> YukpoIaMetricsSnapshot {
        let by_route = self.by_route.read().map(|g| g.clone()).unwrap_or_default();
        let mut by_tenant: Vec<TenantRouteAgg> =
            self.by_tenant.read().map(|g| g.values().cloned().collect()).unwrap_or_default();
        by_tenant.sort_by(|a, b| b.requests.cmp(&a.requests));
        YukpoIaMetricsSnapshot {
            by_route,
            by_tenant,
            worker_jobs_completed: self.worker_completed.load(std::sync::atomic::Ordering::Relaxed),
            worker_jobs_failed: self.worker_failed.load(std::sync::atomic::Ordering::Relaxed),
        }
    }

    /// Métriques agrégées par route pour un utilisateur (tableau de bord « tenant »).
    pub fn snapshot_for_user(&self, user_id: i32) -> Vec<TenantRouteAgg> {
        self.by_tenant
            .read()
            .map(|g| g.values().filter(|t| t.user_id == user_id).cloned().collect())
            .unwrap_or_default()
    }
}

impl Default for YukpoIaMetricsService {
    fn default() -> Self {
        Self::new()
    }
}
