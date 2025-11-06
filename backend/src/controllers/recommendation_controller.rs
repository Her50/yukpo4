use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use log;
use crate::state::AppState;

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
    let session_id = params.session_id.unwrap_or_else(|| format!("session_{}", chrono::Utc::now().timestamp()));
    let limit = params.limit.unwrap_or(15);
    
    // Parser les catégories
    let categories: Vec<String> = params.categories
        .map(|c| c.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_default();
    
    log::info!("📦 [Recommandations] Récupération produits pour user_id: {}, categories: {:?}", user_id, categories);
    
    // Utiliser la fonction SQL pour obtenir les produits éligibles
    let result = sqlx::query(
        "SELECT * FROM get_eligible_organic_products($1, $2, $3, $4)"
    )
    .bind(user_id)
    .bind(&session_id)
    .bind(&categories)
    .bind(limit)
    .fetch_all(pool)
    .await;
    
    match result {
        Ok(rows) => {
            let products: Vec<serde_json::Value> = rows.iter().map(|row| {
                let product_data: serde_json::Value = row.try_get("product_data").unwrap_or(serde_json::json!({}));
                let relevance_score: f64 = row.try_get::<sqlx::types::BigDecimal, _>("relevance_score")
                    .map(|d| d.to_string().parse().unwrap_or(0.0))
                    .unwrap_or(0.0);
                
                let mut data = product_data.as_object().cloned().unwrap_or_default();
                data.insert("relevance_score".to_string(), serde_json::json!(relevance_score));
                
                serde_json::Value::Object(data)
            }).collect();
            
            log::info!("✅ [Recommandations] {} produits trouvés", products.len());
            
            Ok(Json(serde_json::json!({
                "success": true,
                "data": products,
                "count": products.len()
            })))
        },
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
    let session_id = params.session_id.unwrap_or_else(|| format!("session_{}", chrono::Utc::now().timestamp()));
    let limit = params.limit.unwrap_or(15);
    
    log::info!("🎯 [MixedContent] Génération feed mixte pour user_id: {} (limit: {})", user_id, limit);
    
    // ✅ NOUVEAU: Version simplifiée sans dépendre des fonctions SQL complexes
    // Charger produits organiques directement depuis services
    let organic_result = sqlx::query!(
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
        ORDER BY s.created_at DESC
        LIMIT $1
        "#,
        limit as i64
    )
    .fetch_all(pool)
    .await;
    
    // Charger publicités actives
    // ✅ CORRECTION 2025-11-06: Utiliser sqlx::query() pour compatibilité offline mode
    let paid_result = sqlx::query(
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
        "#
    )
    .fetch_all(pool)
    .await;
    
    // Traiter les résultats
    let mut organic_products: Vec<serde_json::Value> = vec![];
    if let Ok(rows) = organic_result {
        for row in rows {
            // Extraire les produits du service
            if let Some(produits) = row.data.get("produits") {
                if let Some(produits_array) = produits.as_object().and_then(|p| p.get("valeur")).and_then(|v| v.as_array()) {
                    for (index, product) in produits_array.iter().enumerate() {
                        organic_products.push(serde_json::json!({
                            "type": "organic",
                            "is_paid": false,
                            "data": {
                                "id": format!("{}_{}", row.id, index),
                                "service_id": row.id,
                                "nom": product.get("nom").and_then(|v| v.as_str()).unwrap_or("Produit"),
                                "description": product.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                                "prix": product.get("prix").and_then(|v| v.as_str()).unwrap_or("0"),
                                "devise": product.get("devise").and_then(|v| v.as_str()).unwrap_or("XAF"),
                                "images": product.get("images").cloned().unwrap_or(serde_json::json!([])),
                                "videos": product.get("videos").cloned().unwrap_or(serde_json::json!([])),
                                "category": row.category,
                                "service": {
                                    "id": row.id,
                                    "data": row.data
                                }
                            }
                        }));
                    }
                } else {
                    // Produits sous forme d'array direct
                    if let Some(produits_array) = produits.as_array() {
                        for (index, product) in produits_array.iter().enumerate() {
                            organic_products.push(serde_json::json!({
                                "type": "organic",
                                "is_paid": false,
                                "data": {
                                    "id": format!("{}_{}", row.id, index),
                                    "service_id": row.id,
                                    "nom": product.get("nom").and_then(|v| v.as_str()).unwrap_or("Produit"),
                                    "description": product.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                                    "prix": product.get("prix").and_then(|v| v.as_str()).unwrap_or("0"),
                                    "devise": product.get("devise").and_then(|v| v.as_str()).unwrap_or("XAF"),
                                    "images": product.get("images").cloned().unwrap_or(serde_json::json!([])),
                                    "videos": product.get("videos").cloned().unwrap_or(serde_json::json!([])),
                                    "category": row.category,
                                    "service": {
                                        "id": row.id,
                                        "data": row.data
                                    }
                                }
                            }));
                        }
                    }
                }
            }
        }
    }
    
    let mut paid_ads: Vec<serde_json::Value> = vec![];
    if let Ok(rows) = paid_result {
        for row in rows {
            // ✅ CORRECTION 2025-11-06: Extraction manuelle des colonnes pour compatibilité offline
            let id: i32 = row.try_get("id").unwrap_or(0);
            let titre: String = row.try_get("titre").unwrap_or_default();
            let description: Option<String> = row.try_get("description").ok();
            let videos: Vec<String> = row.try_get::<Vec<String>, _>("videos").unwrap_or_default();
            let thumbnails: Vec<String> = row.try_get::<Vec<String>, _>("thumbnails").unwrap_or_default();
            let boost_level: Option<String> = row.try_get("boost_level").ok();
            let frequency_ratio: Option<f64> = row.try_get("frequency_ratio").ok();
            let produits_indexes: Vec<String> = row.try_get::<Vec<String>, _>("produits_indexes").unwrap_or_default();
            
            paid_ads.push(serde_json::json!({
                "type": "paid",
                "is_paid": true,
                "data": {
                    "id": id,
                    "titre": titre,
                    "description": description,
                    "videos": videos,
                    "thumbnails": thumbnails,
                    "produits_indexes": produits_indexes
                },
                "boost_level": boost_level.unwrap_or("basic".to_string()),
                "frequency_ratio": frequency_ratio.unwrap_or(0.2)
            }));
        }
    }
    
    // ✅ Mélanger intelligemment selon les règles de fréquence
    let mixed = mix_content_intelligently(&paid_ads, &organic_products);
    
    log::info!("✅ [MixedContent] Feed généré: {} items total ({} organiques, {} publicités)", 
        mixed.len(), organic_products.len(), paid_ads.len());
    
    Ok(Json(serde_json::json!({
        "success": true,
        "data": mixed,
        "count": mixed.len()
    })))
}

/// Mélanger intelligemment publicités et produits organiques
fn mix_content_intelligently(
    paid_ads: &Vec<serde_json::Value>,
    organic_products: &Vec<serde_json::Value>
) -> Vec<serde_json::Value> {
    let mut result: Vec<serde_json::Value> = vec![];
    let mut organic_index = 0;
    
    // Grouper les publicités par niveau de boost
    let mut ultra_ads: Vec<_> = paid_ads.iter().filter(|ad| 
        ad.get("boost_level").and_then(|v| v.as_str()) == Some("ultra")
    ).cloned().collect();
    
    let mut premium_ads: Vec<_> = paid_ads.iter().filter(|ad| 
        ad.get("boost_level").and_then(|v| v.as_str()) == Some("premium")
    ).cloned().collect();
    
    let mut basic_ads: Vec<_> = paid_ads.iter().filter(|ad| 
        ad.get("boost_level").and_then(|v| v.as_str()) == Some("basic")
    ).cloned().collect();
    
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
        if organic_index < organic_products.len() {
            result.push(organic_products[organic_index].clone());
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

/// Tracker la visibilité d'un contenu
pub async fn track_visibility(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<TrackVisibilityRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;
    
    log::info!("👁️ [Visibility] Tracking {} {} pour user {}", 
        payload.content_type, payload.content_id, payload.user_id);
    
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
                    "UPDATE publicites SET impressions = impressions + 1 WHERE id = $1"
                )
                .bind(payload.content_id.parse::<i32>().unwrap_or(0))
                .execute(pool)
                .await;
            }
            
            // Si cliqué, incrémenter le compteur de clics
            if payload.clicked.unwrap_or(false) {
                if payload.content_type == "paid" {
                    let _ = sqlx::query(
                        "UPDATE publicites SET clics = clics + 1 WHERE id = $1"
                    )
                    .bind(payload.content_id.parse::<i32>().unwrap_or(0))
                    .execute(pool)
                    .await;
                }
            }
            
            Ok(Json(serde_json::json!({
                "success": true,
                "message": "Visibilité trackée"
            })))
        },
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
    
    let result = sqlx::query(
        "SELECT * FROM visibility_fairness_stats ORDER BY content_type"
    )
    .fetch_all(pool)
    .await;
    
    match result {
        Ok(rows) => {
            let stats: Vec<serde_json::Value> = rows.iter().map(|row| {
                serde_json::json!({
                    "content_type": row.try_get::<String, _>("content_type").unwrap_or_default(),
                    "unique_items": row.try_get::<i64, _>("unique_items").unwrap_or(0),
                    "total_appearances": row.try_get::<i64, _>("total_appearances").unwrap_or(0),
                    "avg_view_duration": row.try_get::<Option<f64>, _>("avg_view_duration").unwrap_or(None),
                    "click_through_rate": row.try_get::<Option<f64>, _>("click_through_rate").unwrap_or(None),
                    "avg_appearances_per_item": row.try_get::<Option<i64>, _>("avg_appearances_per_item").unwrap_or(None)
                })
            }).collect();
            
            // Calculer le ratio d'équité
            let organic_avg = stats.iter()
                .find(|s| s["content_type"] == "organic")
                .and_then(|s| s["avg_appearances_per_item"].as_i64())
                .unwrap_or(0) as f64;
            
            let paid_avg = stats.iter()
                .find(|s| s["content_type"] == "paid")
                .and_then(|s| s["avg_appearances_per_item"].as_i64())
                .unwrap_or(1) as f64;
            
            let fairness_ratio = if paid_avg > 0.0 { organic_avg / paid_avg } else { 0.0 };
            
            Ok(Json(serde_json::json!({
                "success": true,
                "data": stats,
                "fairness_ratio": fairness_ratio,
                "is_fair": fairness_ratio <= 0.5 // Organiques doivent avoir max 50% de visibilité des payants
            })))
        },
        Err(e) => {
            log::error!("❌ [Fairness] Erreur: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

