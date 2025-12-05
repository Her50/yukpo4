use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use log;
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgRow, PgPool, Row};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

#[derive(Clone, Copy, Default)]
struct EngagementStats {
    score: f64,
    clicks: i64,
    impressions: i64,
    likes: i64,
    saves: i64,
}

#[derive(Debug, Deserialize)]
pub struct GetRecommendationsQuery {
    pub user_id: Option<i32>,
    pub session_id: Option<String>,
    pub categories: Option<String>,
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct RecommendedProduct {
    pub id: String,
    pub titre: String,
    pub description: Option<String>,
    pub prix: Option<String>,
    pub devise: Option<String>,
    pub images: Vec<String>,
    pub videos: Vec<String>,
    pub type_produit: Option<String>,
    pub relevance_score: f64,
    pub is_promotion: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct TrackVisibilityRequest {
    pub user_id: i32,
    pub session_id: String,
    pub content_id: String,
    pub content_type: String, // 'organic' ou 'paid'
    pub position_in_feed: i32,
    pub viewed: Option<bool>,
    pub view_duration_ms: Option<i32>,
    pub clicked: Option<bool>,
}

/// Obtenir les produits organiques recommandés
pub async fn get_recommended_products(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetRecommendationsQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    let user_id = params.user_id.unwrap_or(0);
    let session_id = params
        .session_id
        .unwrap_or_else(|| format!("session_{}", chrono::Utc::now().timestamp()));
    let limit = params.limit.unwrap_or(15);

    // Parser les catégories
    let categories: Vec<String> = params
        .categories
        .map(|c| c.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_default();

    log::info!(
        "📦 [Recommandations] Récupération produits pour user_id: {}, categories: {:?}",
        user_id,
        categories
    );

    // Utiliser la fonction SQL pour obtenir les produits éligibles
    let result = sqlx::query("SELECT * FROM get_eligible_organic_products($1, $2, $3, $4)")
        .bind(user_id)
        .bind(&session_id)
        .bind(&categories)
        .bind(limit)
        .fetch_all(pool)
        .await;

    match result {
        Ok(rows) => {
            let products: Vec<serde_json::Value> = rows
                .iter()
                .map(|row| {
                    let product_data: serde_json::Value = row
                        .get::<Option<_>, _>("product_data")
                        .unwrap_or(serde_json::json!({}));
                    let relevance_score: f64 = row
                        .get::<Option<sqlx::types::BigDecimal>, _>("relevance_score")
                        .and_then(|d| d.to_string().parse::<f64>().ok())
                        .unwrap_or(0.0);

                    let mut data = product_data.as_object().cloned().unwrap_or_default();
                    data.insert(
                        "relevance_score".to_string(),
                        serde_json::json!(relevance_score),
                    );

                    serde_json::Value::Object(data)
                })
                .collect();

            log::info!("✅ [Recommandations] {} produits trouvés", products.len());

            Ok(Json(serde_json::json!({
                "success": true,
                "data": products,
                "count": products.len()
            })))
        }
        Err(e) => {
            log::error!("❌ [Recommandations] Erreur: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Obtenir le contenu mixte (publicités + produits)
pub async fn get_mixed_content(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetRecommendationsQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    let user_id = params.user_id.unwrap_or(0);
    let _session_id = params
        .session_id
        .unwrap_or_else(|| format!("session_{}", chrono::Utc::now().timestamp()));
    let limit = params.limit.unwrap_or(15);
    let categories: Vec<String> = params
        .categories
        .as_ref()
        .map(|c| {
            c.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();
    let categories_lower: HashSet<String> = categories.iter().map(|c| c.to_lowercase()).collect();

    log::info!(
        "🎯 [MixedContent] Génération feed mixte pour user_id: {} (limit: {}, categories: {:?})",
        user_id,
        limit,
        categories
    );

    // ✅ Charger produits organiques récents avec priorité sur les catégories utilisateur
    let organic_rows = match fetch_recent_services(
        pool,
        limit as i64,
        if categories_lower.is_empty() {
            None
        } else {
            Some(&categories)
        },
    )
    .await
    {
        Ok(rows) if !rows.is_empty() || categories_lower.is_empty() => rows,
        Ok(_) => {
            log::info!(
                "ℹ️ [MixedContent] Aucun service correspondant aux catégories {:?}, bascule sur fallback global",
                categories
            );
            fetch_recent_services(pool, limit as i64, None)
                .await
                .unwrap_or_default()
        }
        Err(e) => {
            log::error!(
                "❌ [MixedContent] Erreur chargement services ciblés: {:?}",
                e
            );
            vec![]
        }
    };

    // ✅ Charger publicités actives (filtrage par catégories appliqué plus bas)
    let paid_rows = match fetch_active_publicites(pool).await {
        Ok(rows) => rows,
        Err(e) => {
            log::error!(
                "❌ [MixedContent] Erreur chargement publicités actives: {:?}",
                e
            );
            vec![]
        }
    };

    // Récupérer les statistiques d'engagement
    let visibility_rows = sqlx::query(
        r#"
        SELECT 
            content_id,
            SUM(CASE WHEN clicked THEN 1 ELSE 0 END)::BIGINT AS clicks,
            COUNT(*)::BIGINT AS impressions
        FROM content_visibility_tracking
        GROUP BY content_id
        "#,
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut engagement_map: HashMap<String, EngagementStats> = HashMap::new();
    for row in visibility_rows {
        let content_id = row.get::<String, _>("content_id");
        let clicks: i64 = row.get::<Option<_>, _>("clicks").unwrap_or(0);
        let impressions: i64 = row.get::<Option<_>, _>("impressions").unwrap_or(0);
        let ctr = if impressions > 0 {
            clicks as f64 / impressions as f64
        } else {
            0.0
        };
        let score = ctr + (clicks as f64 * 0.05);
        engagement_map.insert(
            content_id,
            EngagementStats {
                score,
                clicks,
                impressions,
                ..Default::default()
            },
        );
    }

    let engagement_counts_rows = sqlx::query(
        r#"
        SELECT 
            content_id,
            SUM(CASE WHEN liked THEN 1 ELSE 0 END)::BIGINT AS likes,
            SUM(CASE WHEN saved THEN 1 ELSE 0 END)::BIGINT AS saves
        FROM content_engagement
        GROUP BY content_id
        "#,
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for row in engagement_counts_rows {
        let content_id = row.get::<String, _>("content_id");
        let likes: i64 = row
            .try_get::<Option<i64>, _>("likes")
            .unwrap_or(Some(0))
            .unwrap_or(0);
        let saves: i64 = row
            .try_get::<Option<i64>, _>("saves")
            .unwrap_or(Some(0))
            .unwrap_or(0);
        let entry = engagement_map
            .entry(content_id.clone())
            .or_insert_with(EngagementStats::default);
        entry.likes = likes;
        entry.saves = saves;
    }

    // Traiter les résultats
    let mut organic_products: Vec<serde_json::Value> = vec![];
    for row in organic_rows {
        let row_id: i32 = row.get::<Option<_>, _>("id").unwrap_or_default();
        let row_data: serde_json::Value = row.get::<Option<_>, _>("data").unwrap_or_default();
        let row_category: Option<String> = row.get::<Option<_>, _>("category");

        if let Some(produits) = row_data.get("produits") {
            if let Some(produits_array) = produits
                .as_object()
                .and_then(|p| p.get("valeur"))
                .and_then(|v| v.as_array())
            {
                for (index, product) in produits_array.iter().enumerate() {
                    let content_id = format!("service_{}_{}", row_id, index);
                    let stats = engagement_map
                        .get(&content_id)
                        .copied()
                        .or_else(|| engagement_map.get(&format!("service_{}", row_id)).copied());
                    organic_products.push(build_organic_product_json(
                        row_id,
                        &content_id,
                        index,
                        product,
                        row_category.clone(),
                        &row_data,
                        stats,
                    ));
                }
            } else if let Some(produits_array) = produits.as_array() {
                for (index, product) in produits_array.iter().enumerate() {
                    let content_id = format!("service_{}_{}", row_id, index);
                    let stats = engagement_map
                        .get(&content_id)
                        .copied()
                        .or_else(|| engagement_map.get(&format!("service_{}", row_id)).copied());
                    organic_products.push(build_organic_product_json(
                        row_id,
                        &content_id,
                        index,
                        product,
                        row_category.clone(),
                        &row_data,
                        stats,
                    ));
                }
            }
        }
    }

    if !categories_lower.is_empty() {
        organic_products.sort_by(|a, b| {
            let score_b = compute_category_score(b, &categories_lower);
            let score_a = compute_category_score(a, &categories_lower);
            score_b.cmp(&score_a)
        });
    }

    let mut paid_ads: Vec<serde_json::Value> = vec![];
    let mut produit_service_ids: HashSet<i32> = HashSet::new();
    for row in paid_rows {
        let id: i32 = row.get::<Option<_>, _>("id").unwrap_or(0);
        let titre: String = row.get::<Option<_>, _>("titre").unwrap_or_default();
        let description: Option<String> = row.get::<Option<_>, _>("description");
        let videos: Vec<String> = row.try_get::<Vec<String>, _>("videos").unwrap_or_default();
        let thumbnails: Vec<String> = row
            .try_get::<Vec<String>, _>("thumbnails")
            .unwrap_or_default();
        let boost_level: Option<String> = row.get::<Option<_>, _>("boost_level");
        let frequency_ratio: Option<f64> = row.get::<Option<_>, _>("frequency_ratio");
        let produits_indexes: Vec<String> = row
            .try_get::<Vec<String>, _>("produits_indexes")
            .unwrap_or_default();
        let content_id = format!("paid-{}", id);
        let stats = engagement_map.get(&content_id).copied().unwrap_or_default();

        for service_id in produits_indexes
            .iter()
            .filter_map(|idx| extract_service_id(idx))
        {
            produit_service_ids.insert(service_id);
        }

        paid_ads.push(serde_json::json!({
            "type": "paid",
            "is_paid": true,
            "content_id": content_id,
            "data": {
                "id": id,
                "titre": titre,
                "description": description,
                "videos": videos,
                "thumbnails": thumbnails,
                "produits_indexes": produits_indexes
            },
            "boost_level": boost_level.unwrap_or_else(|| "basic".to_string()),
            "frequency_ratio": adjust_frequency_ratio(
                frequency_ratio.unwrap_or(0.3),
                stats
            ),
            "engagement": {
                "score": stats.score,
                "clicks": stats.clicks,
                "impressions": stats.impressions,
                "likes": stats.likes,
                "saves": stats.saves
            }
        }));
    }

    let service_category_map = if !categories_lower.is_empty() && !produit_service_ids.is_empty() {
        fetch_service_categories(pool, &produit_service_ids)
            .await
            .unwrap_or_default()
    } else {
        HashMap::new()
    };

    if !categories_lower.is_empty() {
        paid_ads.retain(|ad| {
            if let Some(produits_indexes) = ad
                .get("data")
                .and_then(|data| data.get("produits_indexes"))
                .and_then(|v| v.as_array())
            {
                produits_indexes.iter().any(|idx| {
                    idx.as_str()
                        .and_then(|s| extract_service_id(s))
                        .map(|service_id| {
                            service_category_map
                                .get(&service_id)
                                .and_then(|cat| cat.as_ref())
                                .map(|cat| categories_lower.contains(&cat.to_lowercase()))
                                .unwrap_or(false)
                        })
                        .unwrap_or(false)
                })
            } else {
                false
            }
        });

        if paid_ads.is_empty() {
            log::info!(
                "ℹ️ [MixedContent] Aucune publicité pertinente pour les catégories {:?}, fallback complet",
                categories
            );
            paid_ads = match fetch_active_publicites(pool).await {
                Ok(rows) => rows
                    .into_iter()
                    .map(|row| {
                        let id: i32 = row.get::<Option<_>, _>("id").unwrap_or(0);
                        let titre: String = row.get::<Option<_>, _>("titre").unwrap_or_default();
                        let description: Option<String> = row.get::<Option<_>, _>("description");
                        let videos: Vec<String> =
                            row.try_get::<Vec<String>, _>("videos").unwrap_or_default();
                        let thumbnails: Vec<String> = row
                            .try_get::<Vec<String>, _>("thumbnails")
                            .unwrap_or_default();
                        let boost_level: Option<String> = row.get::<Option<_>, _>("boost_level");
                        let frequency_ratio: Option<f64> =
                            row.get::<Option<_>, _>("frequency_ratio");
                        let produits_indexes: Vec<String> = row
                            .try_get::<Vec<String>, _>("produits_indexes")
                            .unwrap_or_default();
                        let content_id = format!("paid-{}", id);
                        let stats = engagement_map.get(&content_id).copied().unwrap_or_default();

                        serde_json::json!({
                            "type": "paid",
                            "is_paid": true,
                            "content_id": content_id,
                            "data": {
                                "id": id,
                                "titre": titre,
                                "description": description,
                                "videos": videos,
                                "thumbnails": thumbnails,
                                "produits_indexes": produits_indexes
                            },
                            "boost_level": boost_level.unwrap_or_else(|| "basic".to_string()),
                            "frequency_ratio": adjust_frequency_ratio(
                                frequency_ratio.unwrap_or(0.3),
                                stats
                            ),
                            "engagement": {
                                "score": stats.score,
                                "clicks": stats.clicks,
                                "impressions": stats.impressions,
                                "likes": stats.likes,
                                "saves": stats.saves
                            }
                        })
                    })
                    .collect(),
                Err(_) => vec![],
            };
        }
    }

    // ✅ Mélanger intelligemment selon les règles de fréquence
    let mixed = mix_content_intelligently(&paid_ads, &organic_products, &engagement_map);

    log::info!(
        "✅ [MixedContent] Feed généré: {} items total ({} organiques, {} publicités)",
        mixed.len(),
        organic_products.len(),
        paid_ads.len()
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "data": mixed,
        "count": mixed.len()
    })))
}

async fn fetch_recent_services(
    pool: &PgPool,
    limit: i64,
    categories: Option<&[String]>,
) -> Result<Vec<PgRow>, sqlx::Error> {
    let mut base_query = String::from(
        r#"
        SELECT 
            s.id,
            s.data,
            s.created_at,
            s.user_id,
            s.gps,
            s.category
        FROM services s
        WHERE s.is_active = TRUE
        AND s.created_at >= NOW() - INTERVAL '30 days'
    "#,
    );

    let use_categories = categories.map(|cats| !cats.is_empty()).unwrap_or(false);

    if use_categories {
        base_query.push_str(" AND s.category = ANY($2)");
    }

    base_query.push_str(" ORDER BY s.created_at DESC LIMIT $1");

    if use_categories {
        let cats = categories.unwrap();
        let cat_refs: Vec<&str> = cats.iter().map(|c| c.as_str()).collect();
        sqlx::query(&base_query)
            .bind(limit)
            .bind(cat_refs)
            .fetch_all(pool)
            .await
    } else {
        sqlx::query(&base_query).bind(limit).fetch_all(pool).await
    }
}

async fn fetch_active_publicites(pool: &PgPool) -> Result<Vec<PgRow>, sqlx::Error> {
    sqlx::query(
        r#"
        SELECT 
            id,
            titre,
            description,
            videos,
            thumbnails,
            boost_level,
            frequency_ratio,
            produits_indexes
        FROM publicites
        WHERE status = 'active'
        AND date_fin > NOW()
        ORDER BY 
            CASE boost_level
                WHEN 'ultra' THEN 1
                WHEN 'premium' THEN 2
                WHEN 'basic' THEN 3
                ELSE 4
            END,
            vues ASC
        LIMIT 10
        "#,
    )
    .fetch_all(pool)
    .await
}

fn build_organic_product_json(
    service_id: i32,
    content_id: &str,
    product_index: usize,
    product: &serde_json::Value,
    category: Option<String>,
    service_data: &serde_json::Value,
    engagement: Option<EngagementStats>,
) -> serde_json::Value {
    let mut value = serde_json::json!({
        "type": "organic",
        "is_paid": false,
        "content_id": content_id,
        "data": {
            "id": format!("{}_{}", service_id, product_index),
            "service_id": service_id,
            "nom": product.get("nom").and_then(|v| v.as_str()).unwrap_or("Produit"),
            "description": product.get("description").and_then(|v| v.as_str()).unwrap_or(""),
            "prix": product.get("prix").and_then(|v| v.as_str()).unwrap_or("0"),
            "devise": product.get("devise").and_then(|v| v.as_str()).unwrap_or("XAF"),
            "images": product.get("images").cloned().unwrap_or(serde_json::json!([])),
            "videos": product.get("videos").cloned().unwrap_or(serde_json::json!([])),
            "category": category,
            "service": {
                "id": service_id,
                "data": service_data.clone()
            }
        }
    });

    if let Some(stats) = engagement {
        if let Some(obj) = value.as_object_mut() {
            obj.insert(
                "engagement".to_string(),
                serde_json::json!({
                    "score": stats.score,
                    "clicks": stats.clicks,
                    "impressions": stats.impressions,
                    "likes": stats.likes,
                    "saves": stats.saves
                }),
            );
        }
    }

    value
}

fn compute_category_score(item: &serde_json::Value, categories: &HashSet<String>) -> i32 {
    let category = item
        .get("data")
        .and_then(|data| data.get("category"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    if category.is_empty() {
        0
    } else if categories.contains(&category) {
        2
    } else if let Some(parent) = category.split('_').next() {
        let parent_lower = parent.to_lowercase();
        if categories.contains(&parent_lower) {
            1
        } else {
            0
        }
    } else {
        0
    }
}

fn extract_service_id(index: &str) -> Option<i32> {
    index
        .split('_')
        .next()
        .and_then(|id_part| id_part.parse::<i32>().ok())
}

async fn fetch_service_categories(
    pool: &PgPool,
    service_ids: &HashSet<i32>,
) -> Result<HashMap<i32, Option<String>>, sqlx::Error> {
    if service_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let ids: Vec<i32> = service_ids.iter().copied().collect();
    let rows = sqlx::query(
        r#"
        SELECT id, category
        FROM services
        WHERE id = ANY($1)
        "#,
    )
    .bind(ids)
    .fetch_all(pool)
    .await?;

    let mut map = HashMap::new();
    for row in rows {
        let id: i32 = row.try_get("id")?;
        let category: Option<String> = row.get::<Option<_>, _>("category");
        map.insert(id, category);
    }

    Ok(map)
}

/// Mélanger intelligemment publicités et produits organiques
fn mix_content_intelligently(
    paid_ads: &Vec<serde_json::Value>,
    organic_products: &Vec<serde_json::Value>,
    engagement: &HashMap<String, EngagementStats>,
) -> Vec<serde_json::Value> {
    let mut result: Vec<serde_json::Value> = vec![];
    let mut organic_index = 0;
    let mut organic_sorted = organic_products.clone();

    organic_sorted.sort_by(|a, b| {
        let key = |item: &serde_json::Value| -> f64 {
            item.get("content_id")
                .and_then(|v| v.as_str())
                .and_then(|cid| engagement.get(cid))
                .map(|stats| stats.score)
                .unwrap_or(0.0)
        };
        key(b)
            .partial_cmp(&key(a))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Grouper les publicités par niveau de boost
    let mut ultra_ads: Vec<_> = paid_ads
        .iter()
        .filter(|ad| ad.get("boost_level").and_then(|v| v.as_str()) == Some("ultra"))
        .cloned()
        .collect();

    let mut premium_ads: Vec<_> = paid_ads
        .iter()
        .filter(|ad| ad.get("boost_level").and_then(|v| v.as_str()) == Some("premium"))
        .cloned()
        .collect();

    let mut basic_ads: Vec<_> = paid_ads
        .iter()
        .filter(|ad| ad.get("boost_level").and_then(|v| v.as_str()) == Some("basic"))
        .cloned()
        .collect();

    let mut position = 0;

    // Générer 20 cartes
    for _ in 0..20 {
        position += 1;

        // ✅ Ultra: 1 toutes les 1 carte (50% du feed)
        if position % 2 == 0 && !ultra_ads.is_empty() {
            result.push(ultra_ads.remove(0));
            continue;
        }

        // ✅ Premium: 1 toutes les 2 cartes (après ultra)
        if position % 2 == 0 && !premium_ads.is_empty() {
            result.push(premium_ads.remove(0));
            continue;
        }

        // ✅ Basic: 1 toutes les 3 cartes
        if position % 3 == 0 && !basic_ads.is_empty() {
            result.push(basic_ads.remove(0));
            continue;
        }

        // ✅ Sinon, produit organique
        if organic_index < organic_sorted.len() {
            result.push(organic_sorted[organic_index].clone());
            organic_index += 1;
        } else {
            // Plus de produits organiques, remplir avec publicités restantes
            if !basic_ads.is_empty() {
                result.push(basic_ads.remove(0));
            } else if !premium_ads.is_empty() {
                result.push(premium_ads.remove(0));
            } else if !ultra_ads.is_empty() {
                result.push(ultra_ads.remove(0));
            }
        }
    }

    result
}

fn adjust_frequency_ratio(base_ratio: f64, stats: EngagementStats) -> f64 {
    let impressions = stats.impressions;
    if impressions == 0 {
        return base_ratio.clamp(0.1, 0.8);
    }

    let ctr = stats.clicks as f64 / impressions as f64;
    let adjusted = if ctr < 0.05 {
        base_ratio + 0.1
    } else if ctr > 0.15 {
        base_ratio - 0.05
    } else {
        base_ratio + (stats.score * 0.02)
    };

    adjusted.clamp(0.1, 0.8)
}

/// Tracker la visibilité d'un contenu
pub async fn track_visibility(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<TrackVisibilityRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    log::info!(
        "👁️ [Visibility] Tracking {} {} pour user {}",
        payload.content_type,
        payload.content_id,
        payload.user_id
    );

    // Insérer dans content_visibility_tracking
    let result = sqlx::query(
        r#"
        INSERT INTO content_visibility_tracking 
            (user_id, content_id, content_type, session_id, position_in_feed, viewed, view_duration_ms, clicked)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        "#
    )
    .bind(payload.user_id)
    .bind(&payload.content_id)
    .bind(&payload.content_type)
    .bind(&payload.session_id)
    .bind(payload.position_in_feed)
    .bind(payload.viewed.unwrap_or(false))
    .bind(payload.view_duration_ms)
    .bind(payload.clicked.unwrap_or(false))
    .execute(pool)
    .await;

    match result {
        Ok(_) => {
            // Si c'est une publicité et qu'elle a été vue, incrémenter le compteur
            if payload.content_type == "paid" && payload.viewed.unwrap_or(false) {
                let _ = sqlx::query(
                    "UPDATE publicites SET impressions = impressions + 1 WHERE id = $1",
                )
                .bind(payload.content_id.parse::<i32>().unwrap_or(0))
                .execute(pool)
                .await;
            }

            // Si cliqué, incrémenter le compteur de clics
            if payload.clicked.unwrap_or(false) {
                if payload.content_type == "paid" {
                    let _ = sqlx::query("UPDATE publicites SET clics = clics + 1 WHERE id = $1")
                        .bind(payload.content_id.parse::<i32>().unwrap_or(0))
                        .execute(pool)
                        .await;
                }
            }

            Ok(Json(serde_json::json!({
                "success": true,
                "message": "Visibilité trackée"
            })))
        }
        Err(e) => {
            log::error!("❌ [Visibility] Erreur tracking: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Obtenir les stats d'équité (organiques vs payants)
pub async fn get_fairness_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    log::info!("📊 [Fairness] Récupération stats d'équité");

    let result = sqlx::query("SELECT * FROM visibility_fairness_stats ORDER BY content_type")
        .fetch_all(pool)
        .await;

    match result {
        Ok(rows) => {
            let stats: Vec<serde_json::Value> = rows.iter().map(|row| {
                serde_json::json!({
                    "content_type": row.get::<String, _>("content_type"),
                    "unique_items": row.get::<Option<i64>, _>("unique_items").unwrap_or(0),
                    "total_appearances": row.get::<Option<i64>, _>("total_appearances").unwrap_or(0),
                    "avg_view_duration": row.try_get::<Option<f64>, _>("avg_view_duration").unwrap_or(None),
                    "click_through_rate": row.try_get::<Option<f64>, _>("click_through_rate").unwrap_or(None),
                    "avg_appearances_per_item": row.try_get::<Option<i64>, _>("avg_appearances_per_item").unwrap_or(None)
                })
            }).collect();

            // Calculer le ratio d'équité
            let organic_avg = stats
                .iter()
                .find(|s| s["content_type"] == "organic")
                .and_then(|s| s["avg_appearances_per_item"].as_i64())
                .unwrap_or(0) as f64;

            let paid_avg = stats
                .iter()
                .find(|s| s["content_type"] == "paid")
                .and_then(|s| s["avg_appearances_per_item"].as_i64())
                .unwrap_or(1) as f64;

            let fairness_ratio = if paid_avg > 0.0 {
                organic_avg / paid_avg
            } else {
                0.0
            };

            Ok(Json(serde_json::json!({
                "success": true,
                "data": stats,
                "fairness_ratio": fairness_ratio,
                "is_fair": fairness_ratio <= 0.5 // Organiques doivent avoir max 50% de visibilité des payants
            })))
        }
        Err(e) => {
            log::error!("❌ [Fairness] Erreur: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
