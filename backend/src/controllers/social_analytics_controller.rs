// Social Analytics Controller — Yukpo
// Dashboard analytics cross-plateformes, synchro insights Meta, A/B test auto

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::social_analytics_service;
use crate::state::AppState;

// ─── GET /api/social-ai/analytics/:service_id ─────────────────────────────────

#[derive(Deserialize)]
pub struct DashboardQuery {
    pub days: Option<i32>,
}

pub async fn get_dashboard(
    auth: AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
    Query(q): Query<DashboardQuery>,
) -> impl IntoResponse {
    let period_days = q.days.unwrap_or(30);

    // get_social_dashboard returns SocialDashboardSummary (not Result)
    let dashboard =
        social_analytics_service::get_social_dashboard(&state.pg, auth.id, service_id, period_days)
            .await;

    (
        axum::http::StatusCode::OK,
        Json(serde_json::json!(dashboard)),
    )
}

// ─── POST /api/social-ai/analytics/:service_id/sync ──────────────────────────

#[derive(Deserialize)]
pub struct SyncInsightsRequest {
    pub post_id: i32,
    pub external_post_id: String,
    pub platform: String,
    pub access_token: String,
}

pub async fn sync_insights(
    auth: AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
    Json(body): Json<SyncInsightsRequest>,
) -> impl IntoResponse {
    match social_analytics_service::sync_meta_post_insights(
        &state.pg,
        body.post_id,
        &body.external_post_id,
        &body.platform,
        &body.access_token,
        auth.id,
        service_id,
    )
    .await
    {
        Ok(_) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({ "synced": true })),
        ),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e })),
        ),
    }
}

// ─── GET /api/social-ai/analytics/:service_id/ab-test ────────────────────────

#[derive(Deserialize)]
pub struct AbTestQuery {
    pub post_id_a: i32,
    pub post_id_b: i32,
}

pub async fn evaluate_ab_test(
    _auth: AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(_service_id): Path<i32>,
    Query(q): Query<AbTestQuery>,
) -> impl IntoResponse {
    match social_analytics_service::evaluate_ab_test(&state.pg, q.post_id_a, q.post_id_b).await {
        Some(result) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({
                "winner_variant": result.winner_variant,
                "winner_caption": result.winner_caption,
                "winner_score": result.winner_score,
                "loser_score": result.loser_score,
                "confidence": result.confidence,
                "reason": result.reason,
            })),
        ),
        None => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({
                "winner_variant": null,
                "message": "Données insuffisantes — au moins 100 impressions par post requises"
            })),
        ),
    }
}

// ─── POST /api/social-ai/analytics/recompute-weekly ──────────────────────────

pub async fn recompute_weekly(
    _auth: AuthenticatedUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    match social_analytics_service::recompute_weekly_aggregates(&state.pg).await {
        Ok(_) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({ "recomputed": true })),
        ),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e })),
        ),
    }
}

// ─── GET /api/social-ai/analytics/:service_id/best-hours ─────────────────────

pub async fn get_best_posting_hours(
    auth: AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
) -> impl IntoResponse {
    use sqlx::Row;

    let rows = sqlx::query(
        r#"
        SELECT
            EXTRACT(HOUR FROM published_at)::int AS hour,
            platform,
            COUNT(*)::bigint AS posts,
            AVG(engagement_rate)::float8 AS avg_engagement
        FROM social_post_analytics
        WHERE user_id = $1 AND service_id = $2
          AND published_at IS NOT NULL
          AND engagement_rate IS NOT NULL
        GROUP BY 1, 2
        ORDER BY avg_engagement DESC
        LIMIT 48
        "#,
    )
    .bind(auth.id)
    .bind(service_id)
    .fetch_all(&state.pg)
    .await;

    match rows {
        Ok(data) => {
            let json: Vec<serde_json::Value> = data
                .into_iter()
                .map(|r| {
                    serde_json::json!({
                        "hour": r.try_get::<i32, _>("hour").unwrap_or(0),
                        "platform": r.try_get::<String, _>("platform").unwrap_or_default(),
                        "posts": r.try_get::<i64, _>("posts").unwrap_or(0),
                        "avg_engagement_rate": r.try_get::<f64, _>("avg_engagement").unwrap_or(0.0),
                    })
                })
                .collect();
            (
                axum::http::StatusCode::OK,
                Json(serde_json::json!({ "best_hours": json })),
            )
        }
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ),
    }
}
