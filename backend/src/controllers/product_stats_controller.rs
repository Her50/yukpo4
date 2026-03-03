// ✅ NOUVEAU 2026-03-03: Contrôleur pour statistiques produit (dashboard prestataire)
// Fournit: stats globales, timeline temporelle, profils visiteurs

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::sync::Arc;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;

// ═══════════════════════════════════════════════════════════════════════
// Types de réponse
// ═══════════════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct ProductStatsResponse {
    pub success: bool,
    pub product_id: i32,
    pub service_id: i32,
    pub product_name: Option<String>,
    pub stats: ProductStats,
}

#[derive(Debug, Serialize, Default)]
pub struct ProductStats {
    pub views: i64,
    pub shares: i64,
    pub saves: i64,
    pub clicks: i64,
    pub comments: i64,
    pub reactions: i64,
    pub avg_rating: Option<f64>,
    pub media_count: i64,
}

#[derive(Debug, Serialize)]
pub struct TimelineResponse {
    pub success: bool,
    pub period: String,
    pub data_points: Vec<TimelineDataPoint>,
}

#[derive(Debug, Serialize)]
pub struct TimelineDataPoint {
    pub date: String,
    pub views: i64,
    pub shares: i64,
    pub clicks: i64,
    pub saves: i64,
}

#[derive(Debug, Serialize)]
pub struct VisitorsResponse {
    pub success: bool,
    pub total_unique_visitors: i64,
    pub visitor_cities: Vec<CityVisitorInfo>,
    pub search_sources: Vec<SearchSourceInfo>,
    pub recent_visitors: Vec<VisitorInfo>,
}

#[derive(Debug, Serialize)]
pub struct CityVisitorInfo {
    pub city: String,
    pub count: i64,
    pub percentage: f64,
}

#[derive(Debug, Serialize)]
pub struct SearchSourceInfo {
    pub source: String,
    pub count: i64,
    pub percentage: f64,
}

#[derive(Debug, Serialize)]
pub struct VisitorInfo {
    pub user_id: i32,
    pub display_name: String,
    pub visited_at: String,
    pub interaction_type: String,
}

#[derive(Debug, Deserialize)]
pub struct StatsQueryParams {
    pub period: Option<String>, // "7d", "30d", "90d"
}

// ═══════════════════════════════════════════════════════════════════════
// Helper: vérifier que le prestataire possède ce produit
// ═══════════════════════════════════════════════════════════════════════

#[derive(FromRow)]
struct ProductOwnerRow {
    _id: i32,
    service_id: i32,
    product_name: Option<String>,
    owner_user_id: i32,
}

async fn verify_product_ownership(
    pool: &sqlx::PgPool,
    product_id: i32,
    user_id: i32,
) -> Result<ProductOwnerRow, StatusCode> {
    let row: Option<ProductOwnerRow> = sqlx::query_as(
        r#"
        SELECT 
            p.id,
            p.service_id,
            p.product_name,
            s.user_id as owner_user_id
        FROM service_products p
        INNER JOIN services s ON s.id = p.service_id
        WHERE p.id = $1
        "#,
    )
    .bind(product_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!(
            "[ProductStats] ❌ Erreur DB vérification ownership: {:?}",
            e
        );
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match row {
        Some(r) if r.owner_user_id == user_id => Ok(r),
        Some(_) => {
            log::warn!(
                "[ProductStats] ⚠️ User {} tente d'accéder aux stats du produit {} (pas le propriétaire)",
                user_id, product_id
            );
            Err(StatusCode::FORBIDDEN)
        }
        None => {
            log::warn!("[ProductStats] ⚠️ Produit {} non trouvé", product_id);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

fn period_to_interval(period: &str) -> &str {
    match period {
        "7d" => "7 days",
        "30d" => "30 days",
        "90d" => "90 days",
        "365d" => "365 days",
        _ => "30 days",
    }
}

// ═══════════════════════════════════════════════════════════════════════
// GET /api/products/{product_id}/stats?period=30d
// Stats globales d'un produit: vues, partages, sauvegardes, clics
// ═══════════════════════════════════════════════════════════════════════

pub async fn get_product_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(product_id): Path<i32>,
    Query(params): Query<StatsQueryParams>,
) -> Result<Json<ProductStatsResponse>, StatusCode> {
    let pool = &state.pg;
    let product = verify_product_ownership(pool, product_id, user.id).await?;
    let period = params.period.as_deref().unwrap_or("30d");
    let interval = period_to_interval(period);

    log::info!(
        "[ProductStats] 📊 Stats produit {} (service {}) période {}",
        product_id,
        product.service_id,
        period
    );

    // Récupérer le product_index pour ce produit
    #[derive(FromRow)]
    struct ProdIndexRow {
        product_index: i32,
    }
    let prod_idx: Option<ProdIndexRow> =
        sqlx::query_as("SELECT product_index FROM service_products WHERE id = $1")
            .bind(product_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let product_index = prod_idx.map(|r| r.product_index).unwrap_or(0);

    // ── Vues: depuis service_interactions_tracking (type='view' pour ce service)
    #[derive(FromRow)]
    struct CountRow {
        count: Option<i64>,
    }

    let views: i64 = sqlx::query_as::<_, CountRow>(&format!(
        r#"
        SELECT COUNT(*)::bigint as count
        FROM service_interactions_tracking
        WHERE service_id = $1 AND interaction_type = 'view'
        AND created_at > NOW() - INTERVAL '{}'
        "#,
        interval
    ))
    .bind(product.service_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.count)
    .unwrap_or(0);

    // ── Clics: depuis service_interactions_tracking (type='click' ou 'contact')
    let clicks: i64 = sqlx::query_as::<_, CountRow>(&format!(
        r#"
        SELECT COUNT(*)::bigint as count
        FROM service_interactions_tracking
        WHERE service_id = $1 AND interaction_type IN ('click', 'contact')
        AND created_at > NOW() - INTERVAL '{}'
        "#,
        interval
    ))
    .bind(product.service_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.count)
    .unwrap_or(0);

    // ── Partages: depuis media table (shares_count) pour ce produit
    let shares: i64 = sqlx::query_as::<_, CountRow>(&format!(
        r#"
        SELECT COALESCE(SUM(
            CASE WHEN shares_count IS NOT NULL THEN shares_count ELSE 0 END
        ), 0)::bigint as count
        FROM media
        WHERE service_id = $1 AND product_index = $2
        AND created_at > NOW() - INTERVAL '{}'
        "#,
        interval
    ))
    .bind(product.service_id)
    .bind(product_index)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.count)
    .unwrap_or(0);

    // ── Sauvegardes (favoris): tentative depuis user_favorites si la table existe
    let saves: i64 = sqlx::query_as::<_, CountRow>(&format!(
        r#"
        SELECT COUNT(*)::bigint as count
        FROM user_favorites
        WHERE service_id = $1
        AND created_at > NOW() - INTERVAL '{}'
        "#,
        interval
    ))
    .bind(product.service_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.count)
    .unwrap_or(0);

    // ── Commentaires
    let comments: i64 = sqlx::query_as::<_, CountRow>(&format!(
        r#"
        SELECT COUNT(*)::bigint as count
        FROM product_comments
        WHERE service_id = $1 AND product_index = $2 AND is_deleted = false
        AND created_at > NOW() - INTERVAL '{}'
        "#,
        interval
    ))
    .bind(product.service_id)
    .bind(product_index)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.count)
    .unwrap_or(0);

    // ── Réactions
    let reactions: i64 = sqlx::query_as::<_, CountRow>(&format!(
        r#"
        SELECT COUNT(*)::bigint as count
        FROM product_reactions
        WHERE service_id = $1 AND product_index = $2
        AND created_at > NOW() - INTERVAL '{}'
        "#,
        interval
    ))
    .bind(product.service_id)
    .bind(product_index)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.count)
    .unwrap_or(0);

    // ── Note moyenne (depuis product_comments avec rating)
    #[derive(FromRow)]
    struct AvgRow {
        avg_rating: Option<f64>,
    }
    let avg_rating: Option<f64> = sqlx::query_as::<_, AvgRow>(
        r#"
        SELECT AVG(rating)::float8 as avg_rating
        FROM product_comments
        WHERE service_id = $1 AND product_index = $2 AND is_deleted = false AND rating > 0
        "#,
    )
    .bind(product.service_id)
    .bind(product_index)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.avg_rating);

    // ── Nombre de médias
    let media_count: i64 = sqlx::query_as::<_, CountRow>(
        r#"
        SELECT COUNT(*)::bigint as count
        FROM media
        WHERE service_id = $1 AND product_index = $2
        "#,
    )
    .bind(product.service_id)
    .bind(product_index)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.count)
    .unwrap_or(0);

    Ok(Json(ProductStatsResponse {
        success: true,
        product_id,
        service_id: product.service_id,
        product_name: product.product_name,
        stats: ProductStats {
            views,
            shares,
            saves,
            clicks,
            comments,
            reactions,
            avg_rating,
            media_count,
        },
    }))
}

// ═══════════════════════════════════════════════════════════════════════
// GET /api/products/{product_id}/stats/timeline?period=30d
// Données temporelles pour graphique (vues/partages par jour)
// ═══════════════════════════════════════════════════════════════════════

pub async fn get_product_stats_timeline(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(product_id): Path<i32>,
    Query(params): Query<StatsQueryParams>,
) -> Result<Json<TimelineResponse>, StatusCode> {
    let pool = &state.pg;
    let product = verify_product_ownership(pool, product_id, user.id).await?;
    let period = params.period.as_deref().unwrap_or("30d");
    let interval = period_to_interval(period);

    log::info!(
        "[ProductStats] 📈 Timeline produit {} période {}",
        product_id,
        period
    );

    // Générer les data points par jour depuis service_interactions_tracking
    #[derive(FromRow)]
    struct DailyRow {
        day: Option<String>,
        views: Option<i64>,
        clicks: Option<i64>,
    }

    let daily_data: Vec<DailyRow> = sqlx::query_as(&format!(
        r#"
        SELECT 
            TO_CHAR(created_at::date, 'YYYY-MM-DD') as day,
            COUNT(*) FILTER (WHERE interaction_type = 'view')::bigint as views,
            COUNT(*) FILTER (WHERE interaction_type IN ('click', 'contact'))::bigint as clicks
        FROM service_interactions_tracking
        WHERE service_id = $1
        AND created_at > NOW() - INTERVAL '{}'
        GROUP BY created_at::date
        ORDER BY created_at::date ASC
        "#,
        interval
    ))
    .bind(product.service_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let data_points: Vec<TimelineDataPoint> = daily_data
        .into_iter()
        .map(|row| TimelineDataPoint {
            date: row.day.unwrap_or_default(),
            views: row.views.unwrap_or(0),
            shares: 0, // Partages pas trackés par jour dans service_interactions_tracking
            clicks: row.clicks.unwrap_or(0),
            saves: 0,
        })
        .collect();

    Ok(Json(TimelineResponse {
        success: true,
        period: period.to_string(),
        data_points,
    }))
}

// ═══════════════════════════════════════════════════════════════════════
// GET /api/products/{product_id}/stats/visitors?period=30d
// Profils des visiteurs (ville, type de recherche, visiteurs récents)
// ═══════════════════════════════════════════════════════════════════════

pub async fn get_product_stats_visitors(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(product_id): Path<i32>,
    Query(params): Query<StatsQueryParams>,
) -> Result<Json<VisitorsResponse>, StatusCode> {
    let pool = &state.pg;
    let product = verify_product_ownership(pool, product_id, user.id).await?;
    let period = params.period.as_deref().unwrap_or("30d");
    let interval = period_to_interval(period);

    log::info!(
        "[ProductStats] 👥 Visiteurs produit {} période {}",
        product_id,
        period
    );

    // ── Total visiteurs uniques
    #[derive(FromRow)]
    struct CountRow {
        count: Option<i64>,
    }

    let total_unique: i64 = sqlx::query_as::<_, CountRow>(&format!(
        r#"
        SELECT COUNT(DISTINCT user_id)::bigint as count
        FROM service_interactions_tracking
        WHERE service_id = $1
        AND created_at > NOW() - INTERVAL '{}'
        "#,
        interval
    ))
    .bind(product.service_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.count)
    .unwrap_or(0);

    // ── Villes des visiteurs (depuis users.ville ou localisation_ville)
    #[derive(FromRow)]
    struct CityRow {
        city: Option<String>,
        visitor_count: Option<i64>,
    }

    let city_data: Vec<CityRow> = sqlx::query_as(&format!(
        r#"
        SELECT 
            COALESCE(u.ville, u.localisation_ville, 'Inconnue') as city,
            COUNT(DISTINCT sit.user_id)::bigint as visitor_count
        FROM service_interactions_tracking sit
        INNER JOIN users u ON u.id = sit.user_id
        WHERE sit.service_id = $1
        AND sit.created_at > NOW() - INTERVAL '{}'
        GROUP BY COALESCE(u.ville, u.localisation_ville, 'Inconnue')
        ORDER BY visitor_count DESC
        LIMIT 10
        "#,
        interval
    ))
    .bind(product.service_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let total_for_pct = if total_unique > 0 {
        total_unique as f64
    } else {
        1.0
    };
    let visitor_cities: Vec<CityVisitorInfo> = city_data
        .into_iter()
        .map(|row| {
            let count = row.visitor_count.unwrap_or(0);
            CityVisitorInfo {
                city: row.city.unwrap_or_else(|| "Inconnue".to_string()),
                count,
                percentage: (count as f64 / total_for_pct * 100.0).round(),
            }
        })
        .collect();

    // ── Sources de recherche (types d'interactions)
    #[derive(FromRow)]
    struct SourceRow {
        interaction_type: String,
        source_count: Option<i64>,
    }

    let source_data: Vec<SourceRow> = sqlx::query_as(&format!(
        r#"
        SELECT 
            interaction_type,
            COUNT(*)::bigint as source_count
        FROM service_interactions_tracking
        WHERE service_id = $1
        AND created_at > NOW() - INTERVAL '{}'
        GROUP BY interaction_type
        ORDER BY source_count DESC
        "#,
        interval
    ))
    .bind(product.service_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let total_interactions: i64 = source_data.iter().filter_map(|r| r.source_count).sum();
    let total_interactions_pct = if total_interactions > 0 {
        total_interactions as f64
    } else {
        1.0
    };
    let search_sources: Vec<SearchSourceInfo> = source_data
        .into_iter()
        .map(|row| {
            let count = row.source_count.unwrap_or(0);
            let source_label = match row.interaction_type.as_str() {
                "view" => "Vues directes".to_string(),
                "click" => "Clics".to_string(),
                "contact" => "Contacts".to_string(),
                "search" => "Recherche".to_string(),
                "share" => "Partages".to_string(),
                other => other.to_string(),
            };
            SearchSourceInfo {
                source: source_label,
                count,
                percentage: (count as f64 / total_interactions_pct * 100.0).round(),
            }
        })
        .collect();

    // ── Visiteurs récents (derniers 20)
    #[derive(FromRow)]
    struct RecentVisitorRow {
        user_id: i32,
        display_name: Option<String>,
        visited_at: Option<String>,
        interaction_type: String,
    }

    let recent_data: Vec<RecentVisitorRow> = sqlx::query_as(&format!(
        r#"
        SELECT 
            sit.user_id,
            COALESCE(u.nom_complet, u.email, CONCAT('Utilisateur #', sit.user_id::text)) as display_name,
            TO_CHAR(sit.created_at, 'YYYY-MM-DD HH24:MI') as visited_at,
            sit.interaction_type
        FROM service_interactions_tracking sit
        INNER JOIN users u ON u.id = sit.user_id
        WHERE sit.service_id = $1
        AND sit.created_at > NOW() - INTERVAL '{}'
        ORDER BY sit.created_at DESC
        LIMIT 20
        "#,
        interval
    ))
    .bind(product.service_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let recent_visitors: Vec<VisitorInfo> = recent_data
        .into_iter()
        .map(|row| VisitorInfo {
            user_id: row.user_id,
            display_name: row
                .display_name
                .unwrap_or_else(|| format!("Utilisateur #{}", row.user_id)),
            visited_at: row.visited_at.unwrap_or_default(),
            interaction_type: row.interaction_type,
        })
        .collect();

    Ok(Json(VisitorsResponse {
        success: true,
        total_unique_visitors: total_unique,
        visitor_cities,
        search_sources,
        recent_visitors,
    }))
}

// ═══════════════════════════════════════════════════════════════════════
// GET /api/products/all-stats?period=30d
// Stats agrégées pour TOUS les produits du prestataire (dashboard global)
// ═══════════════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct AllProductsStatsResponse {
    pub success: bool,
    pub period: String,
    pub total_products: i64,
    pub aggregate: ProductStats,
    pub products: Vec<ProductStatsSummary>,
}

#[derive(Debug, Serialize)]
pub struct ProductStatsSummary {
    pub product_id: i32,
    pub service_id: i32,
    pub product_name: String,
    pub product_index: i32,
    pub views: i64,
    pub shares: i64,
    pub clicks: i64,
    pub comments: i64,
    pub media_count: i64,
}

pub async fn get_all_products_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<StatsQueryParams>,
) -> Result<Json<AllProductsStatsResponse>, StatusCode> {
    let pool = &state.pg;
    let period = params.period.as_deref().unwrap_or("30d");
    let interval = period_to_interval(period);

    log::info!(
        "[ProductStats] 📊 Dashboard global pour user {} période {}",
        user.id,
        period
    );

    // Récupérer tous les produits du prestataire
    #[derive(FromRow)]
    struct UserProductRow {
        id: i32,
        service_id: i32,
        product_index: i32,
        product_name: Option<String>,
    }

    let user_products: Vec<UserProductRow> = sqlx::query_as(
        r#"
        SELECT p.id, p.service_id, p.product_index, p.product_name
        FROM service_products p
        INNER JOIN services s ON s.id = p.service_id
        WHERE s.user_id = $1 AND p.is_active = true AND s.is_active = true
        ORDER BY p.created_at DESC
        "#,
    )
    .bind(user.id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let total_products = user_products.len() as i64;

    // Récupérer les service_ids uniques
    let service_ids: Vec<i32> = user_products
        .iter()
        .map(|p| p.service_id)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    // Stats agrégées par service depuis service_interactions_tracking
    #[derive(FromRow)]
    struct ServiceStatsRow {
        service_id: i32,
        views: Option<i64>,
        clicks: Option<i64>,
    }

    let mut service_stats_map: std::collections::HashMap<i32, (i64, i64)> =
        std::collections::HashMap::new();

    if !service_ids.is_empty() {
        // Construire la liste de placeholders pour IN clause
        let placeholders: Vec<String> =
            service_ids.iter().enumerate().map(|(i, _)| format!("${}", i + 1)).collect();
        let placeholders_str = placeholders.join(", ");

        let query_str = format!(
            r#"
            SELECT 
                service_id,
                COUNT(*) FILTER (WHERE interaction_type = 'view')::bigint as views,
                COUNT(*) FILTER (WHERE interaction_type IN ('click', 'contact'))::bigint as clicks
            FROM service_interactions_tracking
            WHERE service_id IN ({})
            AND created_at > NOW() - INTERVAL '{}'
            GROUP BY service_id
            "#,
            placeholders_str, interval
        );

        let mut query = sqlx::query_as::<_, ServiceStatsRow>(&query_str);
        for id in &service_ids {
            query = query.bind(id);
        }

        if let Ok(rows) = query.fetch_all(pool).await {
            for row in rows {
                service_stats_map.insert(
                    row.service_id,
                    (row.views.unwrap_or(0), row.clicks.unwrap_or(0)),
                );
            }
        }
    }

    // Construire les stats par produit
    let mut total_views: i64 = 0;
    let total_shares: i64 = 0;
    let mut total_clicks: i64 = 0;
    let mut total_comments: i64 = 0;
    let mut total_media: i64 = 0;

    let mut products_stats: Vec<ProductStatsSummary> = Vec::new();

    for product in &user_products {
        let (views, clicks) = service_stats_map.get(&product.service_id).copied().unwrap_or((0, 0));

        // Commentaires pour ce produit
        #[derive(FromRow)]
        struct CountRow {
            count: Option<i64>,
        }

        let comments: i64 = sqlx::query_as::<_, CountRow>(&format!(
            r#"
            SELECT COUNT(*)::bigint as count
            FROM product_comments
            WHERE service_id = $1 AND product_index = $2 AND is_deleted = false
            AND created_at > NOW() - INTERVAL '{}'
            "#,
            interval
        ))
        .bind(product.service_id)
        .bind(product.product_index)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.count)
        .unwrap_or(0);

        // Médias pour ce produit
        let media_count: i64 = sqlx::query_as::<_, CountRow>(
            "SELECT COUNT(*)::bigint as count FROM media WHERE service_id = $1 AND product_index = $2",
        )
        .bind(product.service_id)
        .bind(product.product_index)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.count)
        .unwrap_or(0);

        total_views += views;
        total_clicks += clicks;
        total_comments += comments;
        total_media += media_count;

        products_stats.push(ProductStatsSummary {
            product_id: product.id,
            service_id: product.service_id,
            product_name: product
                .product_name
                .clone()
                .unwrap_or_else(|| "Produit sans nom".to_string()),
            product_index: product.product_index,
            views,
            shares: 0,
            clicks,
            comments,
            media_count,
        });
    }

    // Trier par vues décroissantes
    products_stats.sort_by(|a, b| b.views.cmp(&a.views));

    Ok(Json(AllProductsStatsResponse {
        success: true,
        period: period.to_string(),
        total_products,
        aggregate: ProductStats {
            views: total_views,
            shares: total_shares,
            saves: 0,
            clicks: total_clicks,
            comments: total_comments,
            reactions: 0,
            avg_rating: None,
            media_count: total_media,
        },
        products: products_stats,
    }))
}
