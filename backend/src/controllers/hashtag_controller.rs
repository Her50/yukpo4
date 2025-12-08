/**
 * Contrôleur pour gestion des hashtags
 * Extraction, recherche, tendances, découverte
 */
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use log;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;

/// ✅ Helper: Construit URL média avec fallback pour anciens médias locaux
fn build_media_url_with_fallback(state: &Arc<AppState>, path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        return path.to_string();
    }

    if state.media_storage.is_remote() {
        state.media_storage.build_public_url(path)
    } else {
        let api_base_url = std::env::var("PUBLIC_BASE_URL")
            .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
            .unwrap_or_else(|_| "https://yukpomnang.onrender.com".to_string());
        let clean_path = path.trim_start_matches('/');
        format!(
            "{}/api/media/files/{}",
            api_base_url.trim_end_matches('/'),
            clean_path
        )
    }
}

#[derive(Debug, Deserialize)]
pub struct HashtagSearchQuery {
    pub q: Option<String>,
    pub limit: Option<i32>,
    pub trending: Option<bool>, // Si true, retourner seulement les tendances
}

#[derive(Debug, Serialize)]
pub struct HashtagInfo {
    pub tag: String,
    pub video_count: i64,
    pub view_count: i64,
    pub like_count: i64,
    pub trend_score: f64,
    pub is_trending: bool,
}

#[derive(Debug, Serialize)]
pub struct HashtagSearchResponse {
    pub success: bool,
    pub data: Vec<HashtagInfo>,
}

#[derive(Debug, Deserialize)]
pub struct VideosByHashtagQuery {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
    pub sort: Option<String>, // 'recent', 'popular', 'trending'
}

#[derive(Debug, Serialize)]
pub struct VideoByHashtag {
    pub id: String,
    pub content_id: String,
    pub titre: String,
    pub video_url: String,
    pub thumbnail: Option<String>,
    pub service_id: Option<i32>,
    pub likes: i64,
    pub saves: i64,
    pub views: i64,
    pub created_at: String,
    pub hashtags: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct VideosByHashtagResponse {
    pub success: bool,
    pub data: Vec<VideoByHashtag>,
    pub total: i64,
}

/// Rechercher des hashtags (autocomplete, suggestions)
pub async fn search_hashtags(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashtagSearchQuery>,
) -> Result<Json<HashtagSearchResponse>, StatusCode> {
    let pool = &state.pg;
    let query = params.q.unwrap_or_default().to_lowercase();
    // ✅ SCALABILITÉ: Limiter à 50 max pour éviter surcharge
    let limit = params.limit.unwrap_or(20).min(50);
    let trending_only = params.trending.unwrap_or(false);

    log::info!(
        "🏷️ [Hashtags] Recherche: '{}', trending_only: {}",
        query,
        trending_only
    );

    // ✅ SCALABILITÉ: Utiliser fonction SQL optimisée avec vue matérialisée
    // Vérifier si la fonction optimisée existe, sinon fallback sur requête directe
    let use_optimized = true; // TODO: Vérifier existence fonction

    if use_optimized {
        // Utiliser fonction SQL optimisée avec vue matérialisée
        let sql = r#"
        SELECT * FROM search_hashtags_optimized($1, $2, $3)
        "#;

        let result = sqlx::query(sql)
            .bind(&query)
            .bind(limit)
            .bind(trending_only)
            .fetch_all(pool)
            .await;

        match result {
            Ok(rows) => {
                let hashtags: Vec<HashtagInfo> = rows
                    .iter()
                    .map(|row| HashtagInfo {
                        tag: row.get::<Option<String>, _>("tag").unwrap_or_default(),
                        video_count: row.get::<Option<i64>, _>("video_count").unwrap_or(0),
                        view_count: row.get::<Option<i64>, _>("view_count").unwrap_or(0),
                        like_count: row.get::<Option<i64>, _>("like_count").unwrap_or(0),
                        trend_score: row.get::<Option<f64>, _>("trend_score").unwrap_or(0.0),
                        is_trending: row.get::<Option<bool>, _>("is_trending").unwrap_or(false),
                    })
                    .collect();

                return Ok(Json(HashtagSearchResponse {
                    success: true,
                    data: hashtags,
                }));
            }
            Err(_) => {
                // Fallback sur requête directe si fonction n'existe pas
                log::warn!(
                    "⚠️ [Hashtags] Fonction optimisée non disponible, fallback sur requête directe"
                );
            }
        }
    }

    // ✅ Fallback: Utiliser table media existante (temporaire jusqu'à migration videos)
    let sql = if trending_only {
        r#"
        SELECT 
            tag,
            COUNT(DISTINCT m.id) as video_count,
            SUM(COALESCE(ce.views, 0)) as view_count,
            SUM(COALESCE(ce.likes, 0)) as like_count,
            (
                SUM(COALESCE(ce.likes, 0) * 2 + COALESCE(ce.saves, 0) * 1.5 + COALESCE(ce.views, 0) * 0.1) 
                / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(m.uploaded_at))) / 3600, 1)
            ) as trend_score
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        CROSS JOIN LATERAL unnest(COALESCE(m.ai_tags, ARRAY[]::text[])) tag
        LEFT JOIN (
            SELECT content_id, 
                COUNT(*) as views,
                SUM(CASE WHEN liked = TRUE THEN 1 ELSE 0 END) as likes,
                SUM(CASE WHEN saved = TRUE THEN 1 ELSE 0 END) as saves
            FROM content_engagement
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY content_id
        ) ce ON ce.content_id = COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id)
        WHERE m.type = 'video'
        AND m.path IS NOT NULL
        AND s.is_active = TRUE
        AND m.uploaded_at > NOW() - INTERVAL '30 days'
        GROUP BY tag
        HAVING COUNT(DISTINCT m.id) >= 3
        ORDER BY trend_score DESC
        LIMIT $1
        "#
    } else if !query.is_empty() {
        r#"
        SELECT 
            tag,
            COUNT(DISTINCT m.id) as video_count,
            SUM(COALESCE(ce.views, 0)) as view_count,
            SUM(COALESCE(ce.likes, 0)) as like_count,
            (
                SUM(COALESCE(ce.likes, 0) * 2 + COALESCE(ce.saves, 0) * 1.5 + COALESCE(ce.views, 0) * 0.1) 
                / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(m.uploaded_at))) / 3600, 1)
            ) as trend_score
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        CROSS JOIN LATERAL unnest(COALESCE(m.ai_tags, ARRAY[]::text[])) tag
        LEFT JOIN (
            SELECT content_id, 
                COUNT(*) as views,
                SUM(CASE WHEN liked = TRUE THEN 1 ELSE 0 END) as likes,
                SUM(CASE WHEN saved = TRUE THEN 1 ELSE 0 END) as saves
            FROM content_engagement
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY content_id
        ) ce ON ce.content_id = COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id)
        WHERE m.type = 'video'
        AND m.path IS NOT NULL
        AND s.is_active = TRUE
        AND LOWER(tag) LIKE $1
        GROUP BY tag
        ORDER BY video_count DESC, trend_score DESC
        LIMIT $2
        "#
    } else {
        r#"
        SELECT 
            tag,
            COUNT(DISTINCT m.id) as video_count,
            SUM(COALESCE(ce.views, 0)) as view_count,
            SUM(COALESCE(ce.likes, 0)) as like_count,
            (
                SUM(COALESCE(ce.likes, 0) * 2 + COALESCE(ce.saves, 0) * 1.5 + COALESCE(ce.views, 0) * 0.1) 
                / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(m.uploaded_at))) / 3600, 1)
            ) as trend_score
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        CROSS JOIN LATERAL unnest(COALESCE(m.ai_tags, ARRAY[]::text[])) tag
        LEFT JOIN (
            SELECT content_id, 
                COUNT(*) as views,
                SUM(CASE WHEN liked = TRUE THEN 1 ELSE 0 END) as likes,
                SUM(CASE WHEN saved = TRUE THEN 1 ELSE 0 END) as saves
            FROM content_engagement
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY content_id
        ) ce ON ce.content_id = COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id)
        WHERE m.type = 'video'
        AND m.path IS NOT NULL
        AND s.is_active = TRUE
        GROUP BY tag
        ORDER BY video_count DESC
        LIMIT $1
        "#
    };

    let result = if !query.is_empty() && !trending_only {
        sqlx::query(sql)
            .bind(format!("%{}%", query))
            .bind(limit)
            .fetch_all(pool)
            .await
    } else {
        sqlx::query(sql).bind(limit).fetch_all(pool).await
    };

    match result {
        Ok(rows) => {
            let hashtags: Vec<HashtagInfo> = rows
                .iter()
                .map(|row| {
                    let trend_score: f64 = row.get::<Option<f64>, _>("trend_score").unwrap_or(0.0);
                    let is_trending = trend_score > 10.0; // Seuil pour trending

                    HashtagInfo {
                        tag: row.get::<Option<String>, _>("tag").unwrap_or_default(),
                        video_count: row.get::<Option<i64>, _>("video_count").unwrap_or(0),
                        view_count: row.get::<Option<i64>, _>("view_count").unwrap_or(0),
                        like_count: row.get::<Option<i64>, _>("like_count").unwrap_or(0),
                        trend_score,
                        is_trending,
                    }
                })
                .collect();

            Ok(Json(HashtagSearchResponse {
                success: true,
                data: hashtags,
            }))
        }
        Err(e) => {
            log::error!("❌ [Hashtags] Erreur recherche: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Obtenir les vidéos par hashtag
pub async fn get_videos_by_hashtag(
    State(state): State<Arc<AppState>>,
    Path(hashtag): Path<String>,
    Query(params): Query<VideosByHashtagQuery>,
) -> Result<Json<VideosByHashtagResponse>, StatusCode> {
    let pool = &state.pg;
    // ✅ SCALABILITÉ: Limiter à 50 max, offset max 10k pour éviter surcharge
    let limit = params.limit.unwrap_or(25).min(50);
    let offset = params.offset.unwrap_or(0).min(10_000);
    let sort = params.sort.as_deref().unwrap_or("recent");

    log::info!(
        "📹 [Hashtags] Vidéos pour hashtag: '{}', sort: {}",
        hashtag,
        sort
    );

    let order_by = match sort {
        "popular" => "ORDER BY (COALESCE(ce.likes, 0) * 2 + COALESCE(ce.saves, 0) * 1.5 + COALESCE(ce.views, 0) * 0.1) DESC",
        "trending" => "ORDER BY (COALESCE(ce.likes, 0) * 2 + COALESCE(ce.saves, 0) * 1.5) / GREATEST(EXTRACT(EPOCH FROM (NOW() - v.created_at)) / 3600, 1) DESC",
        _ => "ORDER BY v.created_at DESC",
    };

    // ✅ SCALABILITÉ: Utiliser fonction SQL optimisée si disponible
    let use_optimized = true; // TODO: Vérifier existence fonction

    if use_optimized {
        let sql = r#"
        SELECT * FROM get_videos_by_hashtag_optimized($1, $2, $3, $4)
        "#;

        let count_sql = r#"
        SELECT COUNT(DISTINCT v.id)
        FROM videos v
        WHERE v.is_active = TRUE
        AND EXISTS (
            SELECT 1 FROM unnest(v.hashtags) tag WHERE LOWER(tag) = LOWER($1)
        )
        "#;

        let count_result = sqlx::query_scalar::<_, i64>(count_sql)
            .bind(&hashtag)
            .fetch_one(pool)
            .await;

        let total = count_result.unwrap_or(0);

        let result = sqlx::query(sql)
            .bind(&hashtag)
            .bind(&sort)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await;

        match result {
            Ok(rows) => {
                let videos: Vec<VideoByHashtag> = rows
                    .iter()
                    .map(|row| VideoByHashtag {
                        id: row.get::<Option<String>, _>("id").unwrap_or_default(),
                        content_id: row
                            .get::<Option<String>, _>("content_id")
                            .unwrap_or_default(),
                        titre: row.get::<Option<String>, _>("titre").unwrap_or_default(),
                        video_url: row
                            .get::<Option<String>, _>("video_url")
                            .unwrap_or_default(),
                        thumbnail: row.get::<Option<String>, _>("thumbnail"),
                        service_id: row.get::<Option<i32>, _>("service_id"),
                        likes: row.get::<Option<i64>, _>("likes").unwrap_or(0),
                        saves: row.get::<Option<i64>, _>("saves").unwrap_or(0),
                        views: row.get::<Option<i64>, _>("views").unwrap_or(0),
                        created_at: row
                            .get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at")
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default(),
                        hashtags: row
                            .get::<Option<Vec<String>>, _>("hashtags")
                            .unwrap_or_default(),
                    })
                    .collect();

                return Ok(Json(VideosByHashtagResponse {
                    success: true,
                    data: videos,
                    total,
                }));
            }
            Err(_) => {
                // Fallback sur requête directe
                log::warn!(
                    "⚠️ [Hashtags] Fonction optimisée non disponible, fallback sur requête directe"
                );
            }
        }
    }

    // ✅ Fallback: Utiliser table media existante
    let sql = format!(
        r#"
        SELECT 
            m.id::text as id,
            COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id) as content_id,
            COALESCE(s.data->>'titre_service'->>'valeur', s.data->>'titre', 'Vidéo') as titre,
            m.path as video_url_raw,
            (SELECT path FROM media m2 WHERE m2.service_id = m.service_id AND m2.type = 'image' LIMIT 1) as thumbnail_raw,
            m.service_id,
            COALESCE(ce.likes, 0) as likes,
            COALESCE(ce.saves, 0) as saves,
            COALESCE(ce.views, 0) as views,
            m.uploaded_at as created_at,
            COALESCE(m.ai_tags, ARRAY[]::text[]) as hashtags
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        CROSS JOIN LATERAL unnest(COALESCE(m.ai_tags, ARRAY[]::text[])) tag
        LEFT JOIN (
            SELECT content_id, 
                COUNT(*) as views,
                SUM(CASE WHEN liked = TRUE THEN 1 ELSE 0 END) as likes,
                SUM(CASE WHEN saved = TRUE THEN 1 ELSE 0 END) as saves
            FROM content_engagement
            GROUP BY content_id
        ) ce ON ce.content_id = COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id)
        WHERE m.type = 'video'
        AND m.path IS NOT NULL
        AND s.is_active = TRUE
        AND LOWER(tag) = LOWER($1)
        GROUP BY m.id, m.service_id, s.data, m.path, m.uploaded_at, m.ai_tags, ce.likes, ce.saves, ce.views
        {}
        LIMIT $2 OFFSET $3
        "#,
        order_by
    );

    let count_result = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT m.id)
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        CROSS JOIN LATERAL unnest(COALESCE(m.ai_tags, ARRAY[]::text[])) tag
        WHERE m.type = 'video'
        AND m.path IS NOT NULL
        AND s.is_active = TRUE
        AND LOWER(tag) = LOWER($1)
        "#,
    )
    .bind(&hashtag)
    .fetch_one(pool)
    .await;

    let total = count_result.unwrap_or(0);

    let result = sqlx::query(&sql)
        .bind(&hashtag)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await;

    match result {
        Ok(rows) => {
            // ✅ CORRIGÉ: Transformer paths en URLs S3/Wasabi avec fallback
            let videos: Vec<VideoByHashtag> = rows
                .iter()
                .map(|row| {
                    let video_url_raw: String = row
                        .get::<Option<String>, _>("video_url_raw")
                        .unwrap_or_default();
                    let thumbnail_raw: Option<String> =
                        row.get::<Option<String>, _>("thumbnail_raw");

                    let video_url = build_media_url_with_fallback(&state, &video_url_raw);
                    let thumbnail = thumbnail_raw
                        .as_ref()
                        .map(|t| build_media_url_with_fallback(&state, t));

                    VideoByHashtag {
                        id: row.get::<Option<String>, _>("id").unwrap_or_default(),
                        content_id: row
                            .get::<Option<String>, _>("content_id")
                            .unwrap_or_default(),
                        titre: row.get::<Option<String>, _>("titre").unwrap_or_default(),
                        video_url,
                        thumbnail,
                        service_id: row.get::<Option<i32>, _>("service_id"),
                        likes: row.get::<Option<i64>, _>("likes").unwrap_or(0),
                        saves: row.get::<Option<i64>, _>("saves").unwrap_or(0),
                        views: row.get::<Option<i64>, _>("views").unwrap_or(0),
                        created_at: row
                            .get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at")
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default(),
                        hashtags: row
                            .get::<Option<Vec<String>>, _>("hashtags")
                            .unwrap_or_default(),
                    }
                })
                .collect();

            Ok(Json(VideosByHashtagResponse {
                success: true,
                data: videos,
                total,
            }))
        }
        Err(e) => {
            log::error!("❌ [Hashtags] Erreur récupération vidéos: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
