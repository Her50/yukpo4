// TrendPulse B2B Controller — Yukpo
// API publique monétisée pour accès aux tendances (entreprises extérieures).
// Authentification par API Key dans le header X-API-Key.

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use sqlx::Row;
use std::sync::Arc;

use crate::state::AppState;

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn unauthorized(msg: &str) -> (axum::http::StatusCode, Json<serde_json::Value>) {
    (
        axum::http::StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({ "error": msg })),
    )
}
fn forbidden(msg: &str) -> (axum::http::StatusCode, Json<serde_json::Value>) {
    (
        axum::http::StatusCode::FORBIDDEN,
        Json(serde_json::json!({ "error": msg })),
    )
}
fn internal(msg: String) -> (axum::http::StatusCode, Json<serde_json::Value>) {
    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": msg })),
    )
}

fn extract_api_key(headers: &axum::http::HeaderMap) -> Option<String> {
    headers.get("X-API-Key")?.to_str().ok().map(|s| s.to_string())
}

// ─── GET /api/b2b/trends/:region ──────────────────────────────────────────────

#[derive(Deserialize)]
pub struct TrendQuery {
    pub category: Option<String>,
    pub limit: Option<i64>,
}

pub async fn get_trends(
    State(state): State<Arc<AppState>>,
    Path(region): Path<String>,
    Query(q): Query<TrendQuery>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    let api_key = match extract_api_key(&headers) {
        Some(k) => k,
        None => return unauthorized("X-API-Key manquante"),
    };

    // Vérifier l'abonnement
    let sub_row = sqlx::query(
        "SELECT id, plan, requests_per_month, requests_used, \
         regions_allowed, categories_allowed, is_active, expires_at \
         FROM trendpulse_b2b_subscriptions WHERE api_key = $1",
    )
    .bind(&api_key)
    .fetch_optional(&state.pg)
    .await;

    let sub_row = match sub_row {
        Ok(Some(r)) => r,
        Ok(None) => return unauthorized("Clé API invalide"),
        Err(e) => return internal(e.to_string()),
    };

    let is_active: bool = sub_row.try_get("is_active").unwrap_or(false);
    let expires_at: Option<chrono::DateTime<chrono::Utc>> =
        sub_row.try_get("expires_at").ok().flatten();
    let requests_used: i32 = sub_row.try_get("requests_used").unwrap_or(0);
    let requests_per_month: i32 = sub_row.try_get("requests_per_month").unwrap_or(0);
    let regions_allowed: Vec<String> = sub_row.try_get("regions_allowed").unwrap_or_default();
    let categories_allowed: Vec<String> = sub_row.try_get("categories_allowed").unwrap_or_default();
    let sub_id: i32 = sub_row.try_get("id").unwrap_or(0);

    if !is_active {
        return forbidden("Abonnement inactif");
    }
    if let Some(exp) = expires_at {
        if exp < chrono::Utc::now() {
            return forbidden("Abonnement expiré");
        }
    }
    if requests_used >= requests_per_month {
        return (
            axum::http::StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({
                "error": "Quota mensuel atteint",
                "requests_used": requests_used,
                "requests_per_month": requests_per_month,
            })),
        );
    }

    let region_upper = region.to_uppercase();
    if !regions_allowed.is_empty() && !regions_allowed.contains(&region_upper) {
        return forbidden("Région non autorisée dans votre plan");
    }
    if let Some(ref cat) = q.category {
        if !categories_allowed.is_empty() && !categories_allowed.contains(cat) {
            return forbidden("Catégorie non autorisée dans votre plan");
        }
    }

    let limit = q.limit.unwrap_or(20).min(100);

    // Récupérer les tendances
    let trends = if let Some(ref cat) = q.category {
        sqlx::query(
            "SELECT ts.topic, ts.region, ts.source, ts.score, \
             ts.trend_direction, ts.snapshot_at, \
             tf.forecast_day3, tf.confidence \
             FROM trend_snapshots ts \
             LEFT JOIN trend_forecasts tf ON tf.region = ts.region AND tf.topic = LOWER(ts.topic) \
             WHERE ts.region = $1 \
               AND ts.categories @> ARRAY[$2]::text[] \
               AND ts.snapshot_at >= NOW() - INTERVAL '6 hours' \
             ORDER BY ts.score DESC LIMIT $3",
        )
        .bind(&region_upper)
        .bind(cat)
        .bind(limit)
        .fetch_all(&state.pg)
        .await
    } else {
        sqlx::query(
            "SELECT ts.topic, ts.region, ts.source, ts.score, \
             ts.trend_direction, ts.snapshot_at, \
             tf.forecast_day3, tf.confidence \
             FROM trend_snapshots ts \
             LEFT JOIN trend_forecasts tf ON tf.region = ts.region AND tf.topic = LOWER(ts.topic) \
             WHERE ts.region = $1 \
               AND ts.snapshot_at >= NOW() - INTERVAL '6 hours' \
             ORDER BY ts.score DESC LIMIT $2",
        )
        .bind(&region_upper)
        .bind(limit)
        .fetch_all(&state.pg)
        .await
    };

    // Incrémenter le compteur d'utilisation (best-effort)
    let _ = sqlx::query(
        "UPDATE trendpulse_b2b_subscriptions \
         SET requests_used = requests_used + 1, last_request_at = NOW() \
         WHERE id = $1",
    )
    .bind(sub_id)
    .execute(&state.pg)
    .await;

    match trends {
        Ok(rows) => {
            let json: Vec<serde_json::Value> = rows
                .into_iter()
                .map(|r| {
                    serde_json::json!({
                        "topic": r.try_get::<String, _>("topic").unwrap_or_default(),
                        "region": r.try_get::<String, _>("region").unwrap_or_default(),
                        "source": r.try_get::<String, _>("source").unwrap_or_default(),
                        "score": r.try_get::<f64, _>("score").unwrap_or(0.0),
                        "trend_direction": r.try_get::<String, _>("trend_direction").unwrap_or_default(),
                        "snapshot_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("snapshot_at").ok(),
                        "forecast_day3": r.try_get::<Option<f64>, _>("forecast_day3").ok().flatten(),
                        "confidence": r.try_get::<Option<f64>, _>("confidence").ok().flatten(),
                    })
                })
                .collect();
            (
                axum::http::StatusCode::OK,
                Json(serde_json::json!({
                    "region": region_upper,
                    "count": json.len(),
                    "trends": json,
                    "quota": {
                        "used": requests_used + 1,
                        "limit": requests_per_month,
                    }
                })),
            )
        }
        Err(e) => internal(e.to_string()),
    }
}

// ─── GET /api/b2b/trends/:region/forecast ────────────────────────────────────

pub async fn get_forecast(
    State(state): State<Arc<AppState>>,
    Path(region): Path<String>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    let api_key = match extract_api_key(&headers) {
        Some(k) => k,
        None => return unauthorized("X-API-Key manquante"),
    };

    let sub_row = sqlx::query(
        "SELECT id, plan, requests_per_month, requests_used, is_active \
         FROM trendpulse_b2b_subscriptions WHERE api_key = $1",
    )
    .bind(&api_key)
    .fetch_optional(&state.pg)
    .await;

    let sub_row = match sub_row {
        Ok(Some(r)) => r,
        Ok(None) => return unauthorized("Clé API invalide"),
        Err(e) => return internal(e.to_string()),
    };

    let is_active: bool = sub_row.try_get("is_active").unwrap_or(false);
    if !is_active {
        return forbidden("Abonnement inactif");
    }

    let plan: String = sub_row.try_get("plan").unwrap_or_default();
    if plan == "starter" {
        return forbidden("Accès forecasts réservé plans Professional/Enterprise");
    }

    let sub_id: i32 = sub_row.try_get("id").unwrap_or(0);
    let region_upper = region.to_uppercase();

    let forecasts = sqlx::query(
        "SELECT topic, region, forecast_day3, forecast_day7, forecast_day14, \
         trend_direction, confidence, computed_at \
         FROM trend_forecasts \
         WHERE region = $1 \
           AND computed_at >= NOW() - INTERVAL '12 hours' \
         ORDER BY forecast_day3 DESC LIMIT 50",
    )
    .bind(&region_upper)
    .fetch_all(&state.pg)
    .await;

    let _ = sqlx::query(
        "UPDATE trendpulse_b2b_subscriptions \
         SET requests_used = requests_used + 1, last_request_at = NOW() \
         WHERE id = $1",
    )
    .bind(sub_id)
    .execute(&state.pg)
    .await;

    match forecasts {
        Ok(rows) => {
            let json: Vec<serde_json::Value> = rows
                .into_iter()
                .map(|r| {
                    serde_json::json!({
                        "topic": r.try_get::<String, _>("topic").unwrap_or_default(),
                        "region": r.try_get::<String, _>("region").unwrap_or_default(),
                        "forecast_day3": r.try_get::<Option<f64>, _>("forecast_day3").ok().flatten(),
                        "forecast_day7": r.try_get::<Option<f64>, _>("forecast_day7").ok().flatten(),
                        "forecast_day14": r.try_get::<Option<f64>, _>("forecast_day14").ok().flatten(),
                        "trend_direction": r.try_get::<String, _>("trend_direction").unwrap_or_default(),
                        "confidence": r.try_get::<Option<f64>, _>("confidence").ok().flatten(),
                        "computed_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("computed_at").ok(),
                    })
                })
                .collect();
            (
                axum::http::StatusCode::OK,
                Json(serde_json::json!({ "region": region_upper, "forecasts": json })),
            )
        }
        Err(e) => internal(e.to_string()),
    }
}

// ─── GET /api/b2b/quota ───────────────────────────────────────────────────────

pub async fn get_quota(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    let api_key = match extract_api_key(&headers) {
        Some(k) => k,
        None => return unauthorized("X-API-Key manquante"),
    };

    let sub_row = sqlx::query(
        "SELECT subscriber_name, plan, requests_per_month, requests_used, \
         regions_allowed, categories_allowed, is_active, expires_at, last_request_at \
         FROM trendpulse_b2b_subscriptions WHERE api_key = $1",
    )
    .bind(&api_key)
    .fetch_optional(&state.pg)
    .await;

    match sub_row {
        Ok(Some(s)) => {
            let requests_used: i32 = s.try_get("requests_used").unwrap_or(0);
            let requests_per_month: i32 = s.try_get("requests_per_month").unwrap_or(0);
            (
                axum::http::StatusCode::OK,
                Json(serde_json::json!({
                    "subscriber": s.try_get::<String, _>("subscriber_name").unwrap_or_default(),
                    "plan": s.try_get::<String, _>("plan").unwrap_or_default(),
                    "is_active": s.try_get::<bool, _>("is_active").unwrap_or(false),
                    "expires_at": s.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("expires_at").ok().flatten(),
                    "quota": {
                        "used": requests_used,
                        "limit": requests_per_month,
                        "remaining": requests_per_month - requests_used,
                    },
                    "regions_allowed": s.try_get::<Vec<String>, _>("regions_allowed").unwrap_or_default(),
                    "categories_allowed": s.try_get::<Vec<String>, _>("categories_allowed").unwrap_or_default(),
                    "last_request_at": s.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_request_at").ok().flatten(),
                })),
            )
        }
        Ok(None) => unauthorized("Clé API invalide"),
        Err(e) => internal(e.to_string()),
    }
}
