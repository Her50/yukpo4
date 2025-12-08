/**
 * Contrôleur pour analytics créateurs
 * Fournit des statistiques détaillées sur les performances des vidéos
 */
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use chrono::{DateTime, Utc};
use log;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;

#[derive(Debug, Serialize)]
pub struct VideoAnalytics {
    pub video_id: String,
    pub title: String,
    pub views: i64,
    pub likes: i64,
    pub saves: i64,
    pub shares: i64,
    pub comments: i64,
    pub avg_watch_duration_ms: i64,
    pub completion_rate: f64,
    pub engagement_rate: f64,
    pub reach: i64,
    pub impressions: i64,
    pub ctr: f64, // Click-through rate
    pub created_at: String,
    pub last_updated: String,
}

#[derive(Debug, Serialize)]
pub struct CreatorAnalyticsOverview {
    pub total_videos: i64,
    pub total_views: i64,
    pub total_likes: i64,
    pub total_saves: i64,
    pub total_shares: i64,
    pub total_comments: i64,
    pub avg_views_per_video: f64,
    pub avg_engagement_rate: f64,
    pub total_followers: i64,
    pub total_reach: i64,
    pub period_start: String,
    pub period_end: String,
}

#[derive(Debug, Serialize)]
pub struct VideoPerformanceComparison {
    pub video_id: String,
    pub title: String,
    pub views: i64,
    pub engagement_rate: f64,
    pub vs_average: f64, // Pourcentage vs moyenne
    pub trend: String,   // "up", "down", "stable"
}

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct CreatorAnalyticsResponse {
    pub success: bool,
    pub overview: CreatorAnalyticsOverview,
    pub videos: Vec<VideoAnalytics>,
    pub top_performers: Vec<VideoPerformanceComparison>,
    pub insights: Vec<String>,
}

/// Obtenir les analytics d'un créateur
pub async fn get_creator_analytics(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<i32>,
    Query(params): Query<AnalyticsQuery>,
) -> Result<Json<CreatorAnalyticsResponse>, StatusCode> {
    let pool = &state.pg;

    log::info!(
        "📊 [CreatorAnalytics] Récupération analytics pour user_id={}",
        user_id
    );

    // Dates par défaut (30 derniers jours)
    let end_date = params
        .end_date
        .and_then(|d| DateTime::parse_from_rfc3339(&d).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    let start_date = params
        .start_date
        .and_then(|d| DateTime::parse_from_rfc3339(&d).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|| end_date - chrono::Duration::days(30));

    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    // Récupérer les vidéos du créateur avec analytics
    let videos_rows = sqlx::query(
        r#"
        SELECT 
            m.id::text as video_id,
            COALESCE(s.data->'titre_service'->>'valeur', 'Sans titre') as title,
            COALESCE(ce.views, 0) as views,
            COALESCE(ce.likes, 0) as likes,
            COALESCE(ce.saves, 0) as saves,
            COALESCE(ce.shares, 0) as shares,
            COALESCE(comment_counts.comments, 0) as comments,
            COALESCE(ce.avg_watch_duration_ms, 0) as avg_watch_duration_ms,
            COALESCE(
                CASE 
                    WHEN ce.video_duration_ms > 0 
                    THEN (ce.avg_watch_duration_ms::float / ce.video_duration_ms::float) * 100
                    ELSE 0
                END,
                0.0
            ) as completion_rate,
            COALESCE(
                CASE 
                    WHEN ce.views > 0 
                    THEN ((ce.likes + ce.saves + ce.shares + COALESCE(comment_counts.comments, 0))::float / ce.views::float) * 100
                    ELSE 0
                END,
                0.0
            ) as engagement_rate,
            COALESCE(ce.views, 0) as reach,
            COALESCE(ce.views, 0) as impressions,
            COALESCE(
                CASE 
                    WHEN ce.impressions > 0 
                    THEN (ce.clicks::float / ce.impressions::float) * 100
                    ELSE 0
                END,
                0.0
            ) as ctr,
            m.uploaded_at::text as created_at,
            COALESCE(MAX(ce.updated_at)::text, m.uploaded_at::text) as last_updated
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        LEFT JOIN (
            SELECT 
                content_id,
                COUNT(*) as views,
                SUM(CASE WHEN liked = TRUE THEN 1 ELSE 0 END) as likes,
                SUM(CASE WHEN saved = TRUE THEN 1 ELSE 0 END) as saves,
                SUM(CASE WHEN shared = TRUE THEN 1 ELSE 0 END) as shares,
                AVG(watch_duration_ms) as avg_watch_duration_ms,
                MAX(video_duration_ms) as video_duration_ms,
                COUNT(DISTINCT user_id) as impressions,
                COUNT(*) as clicks,
                MAX(updated_at) as updated_at
            FROM content_engagement
            WHERE created_at >= $1 AND created_at <= $2
            GROUP BY content_id
        ) ce ON ce.content_id = m.id::text
        LEFT JOIN (
            SELECT 
                service_id,
                COUNT(*) as comments
            FROM product_comments
            GROUP BY service_id
        ) comment_counts ON comment_counts.service_id = m.service_id
        WHERE m.type = 'video'
        AND s.user_id = $3
        AND m.uploaded_at >= $1
        AND m.uploaded_at <= $2
        GROUP BY m.id, s.data, ce.views, ce.likes, ce.saves, ce.shares, 
                 comment_counts.comments, ce.avg_watch_duration_ms, 
                 ce.video_duration_ms, ce.impressions, ce.clicks, m.uploaded_at
        ORDER BY ce.views DESC NULLS LAST
        LIMIT $4 OFFSET $5
        "#
    )
    .bind(start_date)
    .bind(end_date)
    .bind(user_id)
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(pool)
    .await;

    let videos: Vec<VideoAnalytics> = match videos_rows {
        Ok(rows) => {
            rows.into_iter().map(|row| {
                VideoAnalytics {
                    video_id: row.get::<String, _>("video_id"),
                    title: row.get::<String, _>("title"),
                    views: row.get::<i64, _>("views"),
                    likes: row.get::<i64, _>("likes"),
                    saves: row.get::<i64, _>("saves"),
                    shares: row.get::<i64, _>("shares"),
                    comments: row.get::<i64, _>("comments"),
                    avg_watch_duration_ms: row.get::<i64, _>("avg_watch_duration_ms"),
                    completion_rate: row.get::<f64, _>("completion_rate"),
                    engagement_rate: row.get::<f64, _>("engagement_rate"),
                    reach: row.get::<i64, _>("reach"),
                    impressions: row.get::<i64, _>("impressions"),
                    ctr: row.get::<f64, _>("ctr"),
                    created_at: row.get::<String, _>("created_at"),
                    last_updated: row.get::<String, _>("last_updated"),
                }
            }).collect()
        },
        Err(e) => {
            log::error!("❌ [CreatorAnalytics] Erreur récupération vidéos: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Calculer l'overview
    let total_videos = videos.len() as i64;
    let total_views: i64 = videos.iter().map(|v| v.views).sum();
    let total_likes: i64 = videos.iter().map(|v| v.likes).sum();
    let total_saves: i64 = videos.iter().map(|v| v.saves).sum();
    let total_shares: i64 = videos.iter().map(|v| v.shares).sum();
    let total_comments: i64 = videos.iter().map(|v| v.comments).sum();

    let avg_views_per_video = if total_videos > 0 {
        total_views as f64 / total_videos as f64
    } else {
        0.0
    };

    let total_engagement = total_likes + total_saves + total_shares + total_comments;
    let avg_engagement_rate = if total_views > 0 {
        (total_engagement as f64 / total_views as f64) * 100.0
    } else {
        0.0
    };

    // Récupérer le nombre de followers (table peut ne pas exister, utiliser 0 si erreur)
    let followers_result = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM user_follows
        WHERE following_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None)
    .unwrap_or(0);

    // Top performers
    let top_performers: Vec<VideoPerformanceComparison> = videos
        .iter()
        .take(10)
        .map(|v| {
            let vs_average = if avg_views_per_video > 0.0 {
                ((v.views as f64 - avg_views_per_video) / avg_views_per_video) * 100.0
            } else {
                0.0
            };

            let trend = if vs_average > 10.0 {
                "up"
            } else if vs_average < -10.0 {
                "down"
            } else {
                "stable"
            };

            VideoPerformanceComparison {
                video_id: v.video_id.clone(),
                title: v.title.clone(),
                views: v.views,
                engagement_rate: v.engagement_rate,
                vs_average,
                trend: trend.to_string(),
            }
        })
        .collect();

    // Générer des insights
    let mut insights = Vec::new();

    if avg_engagement_rate > 5.0 {
        insights.push("Vos vidéos ont un excellent taux d'engagement !".to_string());
    } else if avg_engagement_rate < 2.0 {
        insights.push(
            "Essayez d'améliorer votre taux d'engagement avec des appels à l'action.".to_string(),
        );
    }

    if avg_views_per_video > 1000.0 {
        insights.push("Vos vidéos atteignent un large public.".to_string());
    }

    let best_video = videos.iter().max_by_key(|v| v.views);
    if let Some(best) = best_video {
        insights.push(format!(
            "Votre meilleure vidéo a {} vues. Analysez ce qui a fonctionné !",
            best.views
        ));
    }

    let overview = CreatorAnalyticsOverview {
        total_videos,
        total_views,
        total_likes,
        total_saves,
        total_shares,
        total_comments,
        avg_views_per_video,
        avg_engagement_rate,
        total_followers: followers_result,
        total_reach: total_views,
        period_start: start_date.to_rfc3339(),
        period_end: end_date.to_rfc3339(),
    };

    Ok(Json(CreatorAnalyticsResponse {
        success: true,
        overview,
        videos,
        top_performers,
        insights,
    }))
}

/// Obtenir les analytics d'une vidéo spécifique
pub async fn get_video_analytics(
    State(state): State<Arc<AppState>>,
    Path(video_id): Path<String>,
) -> Result<Json<VideoAnalytics>, StatusCode> {
    let pool = &state.pg;

    log::info!(
        "📊 [CreatorAnalytics] Récupération analytics pour video_id={}",
        video_id
    );

    let video_row = sqlx::query(
        r#"
        SELECT 
            m.id::text as video_id,
            COALESCE(s.data->'titre_service'->>'valeur', 'Sans titre') as title,
            COALESCE(ce.views, 0) as views,
            COALESCE(ce.likes, 0) as likes,
            COALESCE(ce.saves, 0) as saves,
            COALESCE(ce.shares, 0) as shares,
            COALESCE(comment_counts.comments, 0) as comments,
            COALESCE(ce.avg_watch_duration_ms, 0) as avg_watch_duration_ms,
            COALESCE(
                CASE 
                    WHEN ce.video_duration_ms > 0 
                    THEN (ce.avg_watch_duration_ms::float / ce.video_duration_ms::float) * 100
                    ELSE 0
                END,
                0.0
            ) as completion_rate,
            COALESCE(
                CASE 
                    WHEN ce.views > 0 
                    THEN ((ce.likes + ce.saves + ce.shares + COALESCE(comment_counts.comments, 0))::float / ce.views::float) * 100
                    ELSE 0
                END,
                0.0
            ) as engagement_rate,
            COALESCE(ce.views, 0) as reach,
            COALESCE(ce.views, 0) as impressions,
            COALESCE(
                CASE 
                    WHEN ce.impressions > 0 
                    THEN (ce.clicks::float / ce.impressions::float) * 100
                    ELSE 0
                END,
                0.0
            ) as ctr,
            m.uploaded_at::text as created_at,
            COALESCE(MAX(ce.updated_at)::text, m.uploaded_at::text) as last_updated
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        LEFT JOIN (
            SELECT 
                content_id,
                COUNT(*) as views,
                SUM(CASE WHEN liked = TRUE THEN 1 ELSE 0 END) as likes,
                SUM(CASE WHEN saved = TRUE THEN 1 ELSE 0 END) as saves,
                SUM(CASE WHEN shared = TRUE THEN 1 ELSE 0 END) as shares,
                AVG(watch_duration_ms) as avg_watch_duration_ms,
                MAX(video_duration_ms) as video_duration_ms,
                COUNT(DISTINCT user_id) as impressions,
                COUNT(*) as clicks,
                MAX(updated_at) as updated_at
            FROM content_engagement
            GROUP BY content_id
        ) ce ON ce.content_id = m.id::text
        LEFT JOIN (
            SELECT 
                service_id,
                COUNT(*) as comments
            FROM product_comments
            GROUP BY service_id
        ) comment_counts ON comment_counts.service_id = m.service_id
        WHERE m.id::text = $1
        GROUP BY m.id, s.data, ce.views, ce.likes, ce.saves, ce.shares, 
                 comment_counts.comments, ce.avg_watch_duration_ms, 
                 ce.video_duration_ms, ce.impressions, ce.clicks, m.uploaded_at
        LIMIT 1
        "#
    )
    .bind(video_id)
    .fetch_optional(pool)
    .await;

    match video_row {
        Ok(Some(row)) => {
            let analytics = VideoAnalytics {
                video_id: row.get::<String, _>("video_id"),
                title: row.get::<String, _>("title"),
                views: row.get::<i64, _>("views"),
                likes: row.get::<i64, _>("likes"),
                saves: row.get::<i64, _>("saves"),
                shares: row.get::<i64, _>("shares"),
                comments: row.get::<i64, _>("comments"),
                avg_watch_duration_ms: row.get::<i64, _>("avg_watch_duration_ms"),
                completion_rate: row.get::<f64, _>("completion_rate"),
                engagement_rate: row.get::<f64, _>("engagement_rate"),
                reach: row.get::<i64, _>("reach"),
                impressions: row.get::<i64, _>("impressions"),
                ctr: row.get::<f64, _>("ctr"),
                created_at: row.get::<String, _>("created_at"),
                last_updated: row.get::<String, _>("last_updated"),
            };
            Ok(Json(analytics))
        },
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            log::error!("❌ [CreatorAnalytics] Erreur: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
