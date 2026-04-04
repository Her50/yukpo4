// Social Analytics Service — Yukpo
// Dashboard unifié cross-plateformes : engagement, portée, ROAS social,
// best time to post, meilleurs posts, croissance followers, A/B testing.

use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;

// ─── Types ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocialDashboardSummary {
    pub service_id: i32,
    pub period_days: i32,
    pub total_posts: i32,
    pub total_impressions: i64,
    pub total_reach: i64,
    pub total_engagement: i64,
    pub avg_engagement_rate: f64,
    pub total_orders_attributed: i32,
    pub total_revenue_attributed: i64,
    pub by_platform: Vec<PlatformStats>,
    pub top_posts: Vec<TopPost>,
    pub best_hours: Vec<BestHour>,
    pub weekly_trend: Vec<WeeklyStat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformStats {
    pub platform: String,
    pub posts: i32,
    pub impressions: i64,
    pub reach: i64,
    pub engagement: i64,
    pub engagement_rate: f64,
    pub orders: i32,
    pub revenue: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopPost {
    pub post_id: Option<i32>,
    pub platform: String,
    pub caption_preview: String,
    pub impressions: i64,
    pub engagement_rate: f64,
    pub orders_attributed: i32,
    pub effectiveness_score: f64,
    pub published_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BestHour {
    pub hour: i32, // 0-23
    pub avg_engagement_rate: f64,
    pub post_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyStat {
    pub week_start: String,
    pub posts: i32,
    pub reach: i64,
    pub engagement: i64,
    pub orders: i32,
}

// ─── Chargement dashboard principal ──────────────────────────────────────────

pub async fn get_social_dashboard(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
    period_days: i32,
) -> SocialDashboardSummary {
    use sqlx::Row;

    let since = format!("{} days", period_days);

    // Agrégats globaux
    let global = sqlx::query(
        r#"SELECT
               COUNT(*)::int as total_posts,
               COALESCE(SUM(impressions), 0)::bigint as total_impressions,
               COALESCE(SUM(reach), 0)::bigint as total_reach,
               COALESCE(SUM(likes + comments + shares), 0)::bigint as total_engagement,
               COALESCE(AVG(engagement_rate), 0)::float8 as avg_engagement_rate,
               COALESCE(SUM(orders_attributed), 0)::int as total_orders,
               COALESCE(SUM(revenue_attributed), 0)::bigint as total_revenue
           FROM social_post_analytics
           WHERE user_id = $1 AND service_id = $2
             AND published_at >= NOW() - $3::interval"#,
    )
    .bind(user_id)
    .bind(service_id)
    .bind(&since)
    .fetch_optional(pg)
    .await
    .ok()
    .flatten();

    let total_posts = global
        .as_ref()
        .and_then(|r| r.try_get::<i32, _>("total_posts").ok())
        .unwrap_or(0);
    let total_impressions = global
        .as_ref()
        .and_then(|r| r.try_get::<i64, _>("total_impressions").ok())
        .unwrap_or(0);
    let total_reach = global
        .as_ref()
        .and_then(|r| r.try_get::<i64, _>("total_reach").ok())
        .unwrap_or(0);
    let total_engagement = global
        .as_ref()
        .and_then(|r| r.try_get::<i64, _>("total_engagement").ok())
        .unwrap_or(0);
    let avg_engagement_rate = global
        .as_ref()
        .and_then(|r| r.try_get::<f64, _>("avg_engagement_rate").ok())
        .unwrap_or(0.0);
    let total_orders = global
        .as_ref()
        .and_then(|r| r.try_get::<i32, _>("total_orders").ok())
        .unwrap_or(0);
    let total_revenue = global
        .as_ref()
        .and_then(|r| r.try_get::<i64, _>("total_revenue").ok())
        .unwrap_or(0);

    // Par plateforme
    let platform_rows = sqlx::query(
        r#"SELECT platform,
               COUNT(*)::int as posts,
               COALESCE(SUM(impressions), 0)::bigint as impressions,
               COALESCE(SUM(reach), 0)::bigint as reach,
               COALESCE(SUM(likes + comments + shares), 0)::bigint as engagement,
               COALESCE(AVG(engagement_rate), 0)::float8 as engagement_rate,
               COALESCE(SUM(orders_attributed), 0)::int as orders,
               COALESCE(SUM(revenue_attributed), 0)::bigint as revenue
           FROM social_post_analytics
           WHERE user_id = $1 AND service_id = $2
             AND published_at >= NOW() - $3::interval
           GROUP BY platform
           ORDER BY impressions DESC"#,
    )
    .bind(user_id)
    .bind(service_id)
    .bind(&since)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    let by_platform: Vec<PlatformStats> = platform_rows
        .iter()
        .map(|r| PlatformStats {
            platform: r.try_get("platform").unwrap_or_default(),
            posts: r.try_get("posts").unwrap_or(0),
            impressions: r.try_get("impressions").unwrap_or(0),
            reach: r.try_get("reach").unwrap_or(0),
            engagement: r.try_get("engagement").unwrap_or(0),
            engagement_rate: r.try_get("engagement_rate").unwrap_or(0.0),
            orders: r.try_get("orders").unwrap_or(0),
            revenue: r.try_get("revenue").unwrap_or(0),
        })
        .collect();

    // Top 5 posts
    let top_rows = sqlx::query(
        r#"SELECT spa.post_id, spa.platform, spa.impressions,
               COALESCE(spa.engagement_rate, 0)::float8,
               COALESCE(spa.orders_attributed, 0)::int,
               COALESCE(spa.effectiveness_score, 0)::float8,
               spa.published_at,
               SUBSTRING(COALESCE(p.caption, ''), 1, 120) as caption_preview
           FROM social_post_analytics spa
           LEFT JOIN social_ai_posts p ON p.id = spa.post_id
           WHERE spa.user_id = $1 AND spa.service_id = $2
             AND spa.published_at >= NOW() - $3::interval
           ORDER BY spa.effectiveness_score DESC NULLS LAST
           LIMIT 5"#,
    )
    .bind(user_id)
    .bind(service_id)
    .bind(&since)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    let top_posts: Vec<TopPost> = top_rows
        .iter()
        .map(|r| TopPost {
            post_id: r.try_get("post_id").ok().flatten(),
            platform: r.try_get("platform").unwrap_or_default(),
            caption_preview: r.try_get("caption_preview").unwrap_or_default(),
            impressions: r.try_get("impressions").unwrap_or(0),
            engagement_rate: r.try_get("engagement_rate").unwrap_or(0.0),
            orders_attributed: r.try_get("orders_attributed").unwrap_or(0),
            effectiveness_score: r.try_get("effectiveness_score").unwrap_or(0.0),
            published_at: r
                .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("published_at")
                .ok()
                .flatten()
                .map(|d| d.to_rfc3339()),
        })
        .collect();

    // Meilleurs créneaux horaires
    let hour_rows = sqlx::query(
        r#"SELECT EXTRACT(HOUR FROM published_at)::int as hour,
               AVG(engagement_rate)::float8 as avg_rate,
               COUNT(*)::int as post_count
           FROM social_post_analytics
           WHERE user_id = $1 AND service_id = $2
             AND published_at >= NOW() - $3::interval
             AND engagement_rate IS NOT NULL
           GROUP BY 1
           ORDER BY avg_rate DESC
           LIMIT 5"#,
    )
    .bind(user_id)
    .bind(service_id)
    .bind(&since)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    let best_hours: Vec<BestHour> = hour_rows
        .iter()
        .map(|r| BestHour {
            hour: r.try_get("hour").unwrap_or(0),
            avg_engagement_rate: r.try_get("avg_rate").unwrap_or(0.0),
            post_count: r.try_get("post_count").unwrap_or(0),
        })
        .collect();

    // Tendance hebdomadaire
    let weekly_rows = sqlx::query(
        r#"SELECT DATE_TRUNC('week', published_at)::date::text as week_start,
               COUNT(*)::int as posts,
               COALESCE(SUM(reach), 0)::bigint as reach,
               COALESCE(SUM(likes + comments + shares), 0)::bigint as engagement,
               COALESCE(SUM(orders_attributed), 0)::int as orders
           FROM social_post_analytics
           WHERE user_id = $1 AND service_id = $2
             AND published_at >= NOW() - INTERVAL '12 weeks'
           GROUP BY 1
           ORDER BY 1 DESC
           LIMIT 12"#,
    )
    .bind(user_id)
    .bind(service_id)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    let weekly_trend: Vec<WeeklyStat> = weekly_rows
        .iter()
        .map(|r| WeeklyStat {
            week_start: r.try_get("week_start").unwrap_or_default(),
            posts: r.try_get("posts").unwrap_or(0),
            reach: r.try_get("reach").unwrap_or(0),
            engagement: r.try_get("engagement").unwrap_or(0),
            orders: r.try_get("orders").unwrap_or(0),
        })
        .collect();

    SocialDashboardSummary {
        service_id,
        period_days,
        total_posts,
        total_impressions,
        total_reach,
        total_engagement,
        avg_engagement_rate,
        total_orders_attributed: total_orders,
        total_revenue_attributed: total_revenue,
        by_platform,
        top_posts,
        best_hours,
        weekly_trend,
    }
}

// ─── Sync métriques depuis Meta Graph API ────────────────────────────────────

/// Récupère les insights d'un post Meta (Facebook/Instagram) et les persiste.
pub async fn sync_meta_post_insights(
    pg: &PgPool,
    post_id: i32,
    external_post_id: &str,
    platform: &str,
    access_token: &str,
    user_id: i32,
    service_id: i32,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    let metrics = if platform == "instagram" {
        "impressions,reach,likes,comments,shares,saved,profile_visits"
    } else {
        "impressions,reach,post_impressions_unique,post_engaged_users,post_clicks"
    };

    let url = format!(
        "https://graph.facebook.com/v19.0/{}/insights",
        external_post_id
    );

    let resp = client
        .get(&url)
        .query(&[("metric", metrics), ("access_token", access_token)])
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Meta insights erreur: {}", resp.status()));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let mut impressions: i64 = 0;
    let mut reach: i64 = 0;
    let mut likes: i64 = 0;
    let mut comments: i64 = 0;
    let mut shares: i64 = 0;
    let mut saves: i64 = 0;
    let mut clicks: i64 = 0;

    if let Some(items) = data["data"].as_array() {
        for item in items {
            let name = item["name"].as_str().unwrap_or("");
            let val = item["values"][0]["value"].as_i64().unwrap_or(0);
            match name {
                "impressions" | "post_impressions" => impressions = val,
                "reach" | "post_impressions_unique" => reach = val,
                "likes" => likes = val,
                "comments" => comments = val,
                "shares" => shares = val,
                "saved" => saves = val,
                "post_clicks" | "post_engaged_users" => clicks = val,
                _ => {}
            }
        }
    }

    let total_eng = likes + comments + shares;
    let engagement_rate = if reach > 0 {
        (total_eng as f64 / reach as f64) * 100.0
    } else {
        0.0
    };

    // Effectiveness score = engagement_rate * 0.4 + impressions_normalized * 0.3 + saves * 0.3
    let effectiveness = (engagement_rate * 0.4
        + (impressions as f64 / 1000.0).min(100.0) * 0.3
        + (saves as f64).min(100.0) * 0.3)
        .min(100.0);

    sqlx::query(
        r#"INSERT INTO social_post_analytics
               (user_id, service_id, post_id, platform, external_post_id,
                impressions, reach, likes, comments, shares, saves, clicks,
                engagement_rate, effectiveness_score, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
           ON CONFLICT (post_id, platform) DO UPDATE SET
               impressions = EXCLUDED.impressions,
               reach = EXCLUDED.reach,
               likes = EXCLUDED.likes,
               comments = EXCLUDED.comments,
               shares = EXCLUDED.shares,
               saves = EXCLUDED.saves,
               clicks = EXCLUDED.clicks,
               engagement_rate = EXCLUDED.engagement_rate,
               effectiveness_score = EXCLUDED.effectiveness_score,
               synced_at = NOW()"#,
    )
    .bind(user_id)
    .bind(service_id)
    .bind(post_id)
    .bind(platform)
    .bind(external_post_id)
    .bind(impressions)
    .bind(reach)
    .bind(likes)
    .bind(comments)
    .bind(shares)
    .bind(saves)
    .bind(clicks)
    .bind(engagement_rate)
    .bind(effectiveness)
    .execute(pg)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ─── A/B Testing — sélection automatique gagnant ─────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbTestResult {
    pub winner_variant: String, // "A" | "B"
    pub winner_caption: String,
    pub winner_score: f64,
    pub loser_score: f64,
    pub confidence: f64, // % de confiance statistique
    pub reason: String,
}

/// Compare les métriques de deux variantes d'un post A/B test
/// et choisit automatiquement le gagnant si la confiance est > 80%.
pub async fn evaluate_ab_test(pg: &PgPool, post_id_a: i32, post_id_b: i32) -> Option<AbTestResult> {
    use sqlx::Row;

    let fetch = |pid: i32| {
        let pg = pg.clone();
        async move {
            sqlx::query(
                "SELECT effectiveness_score, engagement_rate, impressions, reach FROM social_post_analytics WHERE post_id = $1 LIMIT 1"
            )
            .bind(pid)
            .fetch_optional(&pg)
            .await
            .ok()
            .flatten()
        }
    };

    let (row_a, row_b) = tokio::join!(fetch(post_id_a), fetch(post_id_b));

    let row_a = row_a?;
    let row_b = row_b?;

    let score_a: f64 = row_a.try_get("effectiveness_score").unwrap_or(0.0);
    let score_b: f64 = row_b.try_get("effectiveness_score").unwrap_or(0.0);

    // Minimum 100 impressions pour décider
    let imp_a: i64 = row_a.try_get("impressions").unwrap_or(0);
    let imp_b: i64 = row_b.try_get("impressions").unwrap_or(0);
    if imp_a < 100 || imp_b < 100 {
        return None;
    }

    let delta = (score_a - score_b).abs();
    let confidence = (delta / (score_a + score_b + 0.001) * 200.0).min(99.0);

    if confidence < 80.0 {
        return None; // Pas encore assez de différence pour décider
    }

    let (winner, winner_score, loser_score) = if score_a > score_b {
        ("A", score_a, score_b)
    } else {
        ("B", score_b, score_a)
    };

    // Récupérer le caption du gagnant
    let caption_row = sqlx::query("SELECT caption FROM social_ai_posts WHERE id = $1")
        .bind(if winner == "A" { post_id_a } else { post_id_b })
        .fetch_optional(pg)
        .await
        .ok()
        .flatten();

    let winner_caption = caption_row
        .and_then(|r| r.try_get::<Option<String>, _>("caption").ok().flatten())
        .unwrap_or_default();

    Some(AbTestResult {
        winner_variant: winner.to_string(),
        winner_caption,
        winner_score,
        loser_score,
        confidence,
        reason: format!(
            "Variante {} gagne avec un score d'efficacité de {:.1} vs {:.1} ({:.0}% de confiance)",
            winner, winner_score, loser_score, confidence
        ),
    })
}

// ─── Recalcul weekly aggregats ────────────────────────────────────────────────

/// Recalcule et persiste les agrégats hebdomadaires pour tous les partenaires actifs.
/// Appelé par un cron hebdomadaire.
pub async fn recompute_weekly_aggregates(pg: &PgPool) {
    let _ = sqlx::query(
        r#"INSERT INTO social_analytics_weekly
               (user_id, service_id, week_start, platform,
                posts_published, total_impressions, total_reach,
                total_engagement, avg_engagement_rate,
                orders_attributed, revenue_attributed, computed_at)
           SELECT
               user_id, service_id,
               DATE_TRUNC('week', published_at)::date as week_start,
               platform,
               COUNT(*)::int,
               COALESCE(SUM(impressions), 0)::bigint,
               COALESCE(SUM(reach), 0)::bigint,
               COALESCE(SUM(likes + comments + shares), 0)::bigint,
               COALESCE(AVG(engagement_rate), 0),
               COALESCE(SUM(orders_attributed), 0)::int,
               COALESCE(SUM(revenue_attributed), 0)::bigint,
               NOW()
           FROM social_post_analytics
           WHERE published_at >= NOW() - INTERVAL '2 weeks'
           GROUP BY user_id, service_id, week_start, platform
           ON CONFLICT (user_id, service_id, week_start, platform) DO UPDATE SET
               posts_published = EXCLUDED.posts_published,
               total_impressions = EXCLUDED.total_impressions,
               total_reach = EXCLUDED.total_reach,
               total_engagement = EXCLUDED.total_engagement,
               avg_engagement_rate = EXCLUDED.avg_engagement_rate,
               orders_attributed = EXCLUDED.orders_attributed,
               revenue_attributed = EXCLUDED.revenue_attributed,
               computed_at = NOW()"#,
    )
    .execute(pg)
    .await;

    log::info!("[SocialAnalytics] ✅ Agrégats hebdomadaires recalculés");
}
