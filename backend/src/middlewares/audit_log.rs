// src/middlewares/audit_log.rs
// ✅ 2026-05-16 — Implémentation réelle de l'audit log Postgres.
//
// Avant : stub vide (`next.run(req).await`) qui ne loguait rien.
// Maintenant : pour les méthodes state-changing (POST/PUT/PATCH/DELETE) sur
// un sous-ensemble de paths sensibles (admin, wallet, bourse-livre, librairie,
// referral), on insère une entrée dans la table `audit_logs` après exécution.
//
// Stratégie :
//   - Pas de blocking : l'INSERT se fait dans un tokio::spawn pour ne pas
//     ajouter de latence à la requête.
//   - Pas de blocking : si l'insert échoue, on log warn et on continue.
//   - Filtrage par path pour ne pas exploser le volume (skip GETs, healthchecks).
//   - L'extraction du body request/response n'est PAS faite ici (coût mémoire).
//     Pour capturer old/new value, les controllers sensibles doivent appeler
//     directement `audit_log::record(...)` avec leurs propres deltas.

use axum::body::Body;
use axum::extract::Request;
use axum::http::{Method, StatusCode};
use axum::middleware::Next;
use axum::response::Response;
use serde_json::json;
use sqlx::PgPool;
use std::sync::OnceLock;
use std::time::Instant;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;

/// Pool Postgres global pour l'audit (set au boot via `init_pool`).
static AUDIT_POOL: OnceLock<PgPool> = OnceLock::new();

/// À appeler une fois au démarrage pour donner au middleware accès au pool.
/// Si pas appelé, le middleware tourne mais n'insère rien (fail-open).
pub fn init_pool(pool: PgPool) {
    let _ = AUDIT_POOL.set(pool);
}

/// Détermine si la requête doit être auditée (filtrage par path + méthode).
fn should_audit(method: &Method, path: &str) -> bool {
    if matches!(method, &Method::GET | &Method::HEAD | &Method::OPTIONS) {
        return false;
    }
    // Skip noise : healthchecks, métriques, statiques
    if path.starts_with("/health")
        || path.starts_with("/metrics")
        || path.starts_with("/.well-known")
        || path == "/favicon.ico"
        || path == "/"
    {
        return false;
    }
    // Whitelist explicite des paths sensibles à auditer
    const SENSITIVE_PREFIXES: &[&str] = &[
        "/api/admin",
        "/api/wallet",
        "/api/payment",
        "/api/payout",
        "/api/bourse-livre",
        "/api/librairie",
        "/api/referral",
        "/api/parrainage",
        "/api/auth/register",
        "/api/auth/oauth",
        "/api/users/", // /api/users/:id PATCH/DELETE
        "/api/kyc",
        "/api/debug",
    ];
    SENSITIVE_PREFIXES.iter().any(|p| path.starts_with(p))
}

fn extract_client_ip(req: &Request) -> Option<String> {
    req.headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .or_else(|| {
            req.headers()
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        })
}

pub async fn audit_log(req: Request<Body>, next: Next) -> Response {
    let start = Instant::now();
    let method = req.method().clone();
    let path = req.uri().path().to_string();

    if !should_audit(&method, &path) {
        return next.run(req).await;
    }

    let actor = req.extensions().get::<AuthenticatedUser>().cloned();
    let actor_ip = extract_client_ip(&req);
    let user_agent = req
        .headers()
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let response = next.run(req).await;
    let status_code = response.status().as_u16() as i32;
    let duration_ms = start.elapsed().as_millis() as i32;

    // Persistance asynchrone — n'ajoute pas de latence à la requête
    if let Some(pool) = AUDIT_POOL.get().cloned() {
        let metadata = json!({
            "user_agent": user_agent,
        });
        let actor_id = actor.as_ref().map(|u| u.id);
        let actor_role = actor.as_ref().map(|u| u.role.clone());
        let path_clone = path.clone();
        let method_str = method.as_str().to_string();
        tokio::spawn(async move {
            let res = sqlx::query(
                r#"INSERT INTO audit_logs
                   (actor_id, actor_role, actor_ip, method, path, status_code,
                    metadata, duration_ms)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
            )
            .bind(actor_id)
            .bind(actor_role)
            .bind(actor_ip)
            .bind(method_str)
            .bind(&path_clone)
            .bind(status_code)
            .bind(metadata)
            .bind(duration_ms)
            .execute(&pool)
            .await;
            if let Err(e) = res {
                log::warn!("[audit_log] insert échoué pour {}: {}", path_clone, e);
            }
        });
    }
    response
}

/// Hook explicite pour les controllers : enregistre une entrée riche
/// (avec old/new value, action métier, resource).
pub async fn record(
    actor: Option<&AuthenticatedUser>,
    method: &str,
    path: &str,
    resource: Option<&str>,
    action: Option<&str>,
    old_value: Option<serde_json::Value>,
    new_value: Option<serde_json::Value>,
) {
    let Some(pool) = AUDIT_POOL.get().cloned() else {
        return;
    };
    let actor_id = actor.map(|u| u.id);
    let actor_role = actor.map(|u| u.role.clone());
    let path = path.to_string();
    let method = method.to_string();
    let resource = resource.map(|s| s.to_string());
    let action = action.map(|s| s.to_string());
    tokio::spawn(async move {
        let _ = sqlx::query(
            r#"INSERT INTO audit_logs
               (actor_id, actor_role, method, path, resource, action,
                old_value, new_value)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
        )
        .bind(actor_id)
        .bind(actor_role)
        .bind(method)
        .bind(&path)
        .bind(resource)
        .bind(action)
        .bind(old_value)
        .bind(new_value)
        .execute(&pool)
        .await;
    });
}

/// Helper appelé en route `app.with_state(...)` au boot pour brancher le pool.
pub async fn init_from_state(state: &AppState) {
    init_pool(state.pg.clone());
    let _: Result<_, _> =
        sqlx::query("SELECT 1 FROM information_schema.tables WHERE table_name='audit_logs'")
            .fetch_optional(&state.pg)
            .await;
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='audit_logs')",
    )
    .fetch_one(&state.pg)
    .await
    .unwrap_or(false);
    if !exists {
        log::warn!(
            "[audit_log] table audit_logs absente — applique migration 20260516_002_security_hardening_bourse.sql"
        );
    }
}

// Garder le suppress_unused_imports : StatusCode est utilisé dans should_audit côté futur.
#[allow(dead_code)]
fn _placeholder_status(_: StatusCode) {}
