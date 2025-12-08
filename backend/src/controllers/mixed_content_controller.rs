// 🎯 Contrôleur pour le contenu mixte (publicités + produits organiques)
// Priorise les publicités payantes et personnalise selon le comportement utilisateur

use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::sync::Arc;

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use crate::utils::log::{log_error, log_info};

#[derive(Debug, Deserialize)]
pub struct MixedContentQuery {
    /// ID utilisateur (optionnel)
    pub user_id: Option<String>,
    /// Catégories préférées (séparées par virgules)
    pub categories: Option<String>,
    /// ID de session pour le tracking
    pub session_id: Option<String>,
    /// Nombre max de résultats
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_limit() -> i32 {
    20
}

#[derive(Debug, Serialize)]
pub struct ContentItem {
    /// Type: "organic" ou "paid"
    #[serde(rename = "type")]
    pub content_type: String,
    /// Indique si c'est payant
    pub is_paid: bool,
    /// Données du service/produit
    pub data: Value,
    /// Niveau de boost (si payant)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub boost_level: Option<String>,
    /// Ratio de fréquence (pour priorisation)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_ratio: Option<f32>,
}

/// Récupérer le contenu mixte (publicités + produits organiques)
pub async fn get_mixed_content(
    State(state): State<Arc<AppState>>,
    Query(params): Query<MixedContentQuery>,
) -> AppResult<impl IntoResponse> {
    log_info(&format!(
        "[MixedContent] Requête contenu mixte - User: {:?}, Categories: {:?}, Session: {:?}",
        params.user_id, params.categories, params.session_id
    ));

    let pool = &state.pg;

    // 1️⃣ Récupérer les publicités actives (PRIORITAIRES)
    let paid_content = fetch_paid_content(pool, params.limit / 2).await?;
    log_info(&format!(
        "[MixedContent] 💰 {} publicités récupérées",
        paid_content.len()
    ));

    // 2️⃣ Récupérer les produits organiques selon comportement
    // ✅ NOUVEAU: Utiliser recommandations ML personnalisées si user_id fourni
    let categories: Vec<String> = params
        .categories
        .unwrap_or_default()
        .split(',')
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().to_string())
        .collect();

    let organic_content = if let Some(user_id_str) = &params.user_id {
        // ✅ Utiliser recommandations ML personnalisées
        if let Ok(user_id) = user_id_str.parse::<i32>() {
            match fetch_ml_recommended_content(pool, user_id, &categories, params.limit).await {
                Ok(ml_content) => {
                    log_info(&format!(
                        "[MixedContent] 🤖 {} recommandations ML récupérées pour user {}",
                        ml_content.len(),
                        user_id
                    ));
                    ml_content
                }
                Err(e) => {
                    log_error(&format!(
                        "[MixedContent] Erreur recommandations ML, fallback organique: {}",
                        e
                    ));
                    fetch_organic_content(pool, &categories, params.limit).await?
                }
            }
        } else {
            fetch_organic_content(pool, &categories, params.limit).await?
        }
    } else {
        // Pas de user_id, utiliser contenu organique classique
        fetch_organic_content(pool, &categories, params.limit).await?
    };
    log_info(&format!(
        "[MixedContent] 📦 {} produits organiques récupérés",
        organic_content.len()
    ));

    // 3️⃣ Mélanger le contenu avec priorisation des publicités
    let mixed_content = mix_content(paid_content, organic_content, 3); // 1 pub toutes les 3 cartes
    log_info(&format!(
        "[MixedContent] ✅ {} éléments mixés au total",
        mixed_content.len()
    ));

    Ok(Json(json!({
        "success": true,
        "data": mixed_content,
        "count": mixed_content.len()
    })))
}

/// Récupérer les publicités actives (services avec publicite_config)
async fn fetch_paid_content(pool: &PgPool, limit: i32) -> AppResult<Vec<ContentItem>> {
    let rows = sqlx::query(
        r#"
        SELECT 
            s.id,
            s.data,
            s.created_at,
            s.user_id,
            s.category,
            s.publicite_config
        FROM services s
        WHERE s.is_active = true
          AND s.publicite_config IS NOT NULL
          AND s.publicite_config->>'is_active' = 'true'
        ORDER BY 
            -- Prioriser selon le niveau de boost
            CASE 
                WHEN s.publicite_config->>'boost_level' = 'premium' THEN 3
                WHEN s.publicite_config->>'boost_level' = 'standard' THEN 2
                WHEN s.publicite_config->>'boost_level' = 'basic' THEN 1
                ELSE 0
            END DESC,
            RANDOM() -- Aléatoire pour équité dans chaque niveau
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log_error(&format!("[MixedContent] Erreur fetch paid: {}", e));
        AppError::Internal(format!("Erreur fetch paid: {}", e))
    })?;

    let mut content = Vec::new();

    for row in rows {
        let service_id: i32 = row.try_get("id")?;
        let data: Value = row.get::<Option<_>, _>("data").unwrap_or(json!({}));
        let publicite_config: Value = row
            .get::<Option<_>, _>("publicite_config")
            .unwrap_or(json!({}));

        // Extraire le boost level
        let boost_level = publicite_config
            .get("boost_level")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Calculer le ratio de fréquence
        let frequency_ratio = match boost_level.as_deref() {
            Some("premium") => 3.0,
            Some("standard") => 2.0,
            Some("basic") => 1.5,
            _ => 1.0,
        };

        // Extraire les produits du service
        if let Some(produits) = data.get("produits").and_then(|p| p.as_array()) {
            for produit in produits {
                content.push(ContentItem {
                    content_type: "paid".to_string(),
                    is_paid: true,
                    data: json!({
                        "id": produit.get("id"),
                        "service_id": service_id,
                        "nom": produit.get("nom"),
                        "description": produit.get("description"),
                        "prix": produit.get("prix"),
                        "devise": produit.get("devise"),
                        "images": produit.get("images"),
                        "videos": produit.get("videos"),
                        "category": data.get("category"),
                        "titre": data.get("titre_service"),
                    }),
                    boost_level: boost_level.clone(),
                    frequency_ratio: Some(frequency_ratio),
                });
            }
        } else {
            // Si pas de produits, ajouter le service comme un produit
            content.push(ContentItem {
                content_type: "paid".to_string(),
                is_paid: true,
                data: json!({
                    "id": service_id,
                    "service_id": service_id,
                    "nom": data.get("titre_service").and_then(|v| v.get("valeur")).or(data.get("titre")),
                    "description": data.get("description").and_then(|v| v.get("valeur")).or(data.get("description")),
                    "prix": data.get("prix"),
                    "devise": data.get("devise"),
                    "images": data.get("images"),
                    "videos": data.get("videos"),
                    "category": data.get("category"),
                }),
                boost_level: boost_level.clone(),
                frequency_ratio: Some(frequency_ratio),
            });
        }
    }

    Ok(content)
}

/// Récupérer les produits organiques selon les catégories de comportement
async fn fetch_organic_content(
    pool: &PgPool,
    categories: &[String],
    limit: i32,
) -> AppResult<Vec<ContentItem>> {
    // Construire la clause WHERE pour les catégories
    let category_filter = if categories.is_empty() {
        "TRUE".to_string()
    } else {
        let categories_str = categories
            .iter()
            .map(|c| format!("'{}'", c.replace("'", "''")))
            .collect::<Vec<_>>()
            .join(",");
        format!("s.category IN ({})", categories_str)
    };

    let sql = format!(
        r#"
        SELECT 
            s.id,
            s.data,
            s.created_at,
            s.user_id,
            s.category
        FROM services s
        WHERE s.is_active = true
          AND (s.publicite_config IS NULL OR s.publicite_config->>'is_active' != 'true')
          AND {}
        ORDER BY 
            -- Prioriser les services récents des catégories préférées
            CASE WHEN {} THEN 1 ELSE 2 END,
            s.created_at DESC
        LIMIT $1
        "#,
        category_filter, category_filter
    );

    let rows = sqlx::query(&sql)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            log_error(&format!("[MixedContent] Erreur fetch organic: {}", e));
            AppError::Internal(format!("Erreur fetch organic: {}", e))
        })?;

    let mut content = Vec::new();

    for row in rows {
        let service_id: i32 = row.try_get("id")?;
        let data: Value = row.get::<Option<_>, _>("data").unwrap_or(json!({}));

        // Extraire les produits du service
        if let Some(produits) = data.get("produits").and_then(|p| p.as_array()) {
            for produit in produits {
                content.push(ContentItem {
                    content_type: "organic".to_string(),
                    is_paid: false,
                    data: json!({
                        "id": produit.get("id"),
                        "service_id": service_id,
                        "nom": produit.get("nom"),
                        "description": produit.get("description"),
                        "prix": produit.get("prix"),
                        "devise": produit.get("devise"),
                        "images": produit.get("images"),
                        "videos": produit.get("videos"),
                        "category": data.get("category"),
                        "titre": data.get("titre_service"),
                    }),
                    boost_level: None,
                    frequency_ratio: None,
                });
            }
        } else {
            // Si pas de produits, ajouter le service comme un produit
            content.push(ContentItem {
                content_type: "organic".to_string(),
                is_paid: false,
                data: json!({
                    "id": service_id,
                    "service_id": service_id,
                    "nom": data.get("titre_service").and_then(|v| v.get("valeur")).or(data.get("titre")),
                    "description": data.get("description").and_then(|v| v.get("valeur")).or(data.get("description")),
                    "prix": data.get("prix"),
                    "devise": data.get("devise"),
                    "images": data.get("images"),
                    "videos": data.get("videos"),
                    "category": data.get("category"),
                }),
                boost_level: None,
                frequency_ratio: None,
            });
        }
    }

    Ok(content)
}

/// ✅ NOUVEAU: Récupérer contenu via recommandations ML personnalisées
async fn fetch_ml_recommended_content(
    pool: &PgPool,
    user_id: i32,
    categories: &[String],
    limit: i32,
) -> AppResult<Vec<ContentItem>> {
    use crate::controllers::video_ml_controller::get_enhanced_recommendations;

    // Appeler la fonction de recommandations ML améliorée
    let ml_videos = get_enhanced_recommendations(pool, None, user_id, limit, categories, &[]).await;

    // Convertir les MLRecommendedVideo en ContentItem
    let mut content = Vec::new();
    for video in ml_videos {
        // Récupérer les détails du service si service_id disponible
        let service_data = if let Some(service_id) = video.service_id {
            sqlx::query(
                r#"
                SELECT data, category
                FROM services
                WHERE id = $1
                "#,
            )
            .bind(service_id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
        } else {
            None
        };

        let (_service_json, category) = if let Some(row) = service_data {
            let data: Value = row.get::<Option<_>, _>("data").unwrap_or(json!({}));
            let cat: Option<String> = row.get::<Option<_>, _>("category");
            (data, cat)
        } else {
            (json!({}), None)
        };

        content.push(ContentItem {
            content_type: "organic".to_string(),
            is_paid: false,
            data: json!({
                "id": video.service_id,
                "service_id": video.service_id,
                "content_id": video.content_id,
                "nom": video.titre,
                "titre": video.titre,
                "description": video.description,
                "videos": vec![video.video_url],
                "images": if let Some(thumb) = video.thumbnail {
                    vec![thumb]
                } else {
                    vec![]
                },
                "category": category,
                "hashtags": video.hashtags,
                "ml_score": video.total_score,
                "engagement_score": video.engagement_score,
            }),
            boost_level: None,
            frequency_ratio: None,
        });
    }

    Ok(content)
}

/// Mélanger le contenu avec priorisation des publicités
/// frequency: 1 publicité toutes les X cartes organiques
fn mix_content(
    mut paid: Vec<ContentItem>,
    mut organic: Vec<ContentItem>,
    frequency: usize,
) -> Vec<ContentItem> {
    let mut mixed = Vec::new();
    let mut organic_count = 0;

    // Alterner entre paid et organic selon la fréquence
    while !paid.is_empty() || !organic.is_empty() {
        // Ajouter une publicité si disponible et si c'est le moment
        if !paid.is_empty() && (organic_count == 0 || organic_count % frequency == 0) {
            mixed.push(paid.remove(0));
        }

        // Ajouter des produits organiques
        for _ in 0..frequency {
            if organic.is_empty() {
                break;
            }
            mixed.push(organic.remove(0));
            organic_count += 1;
        }
    }

    mixed
}
