// 🎯 Contrôleur pour le contenu mixte (publicités + produits organiques)
// Priorise les publicités payantes et personnalise selon le comportement utilisateur

use axum::{
    extract::{Query, State},
    http::StatusCode,
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
    log_info(&format!("[MixedContent] 💰 {} publicités récupérées", paid_content.len()));

    // 2️⃣ Récupérer les produits organiques selon comportement
    let categories: Vec<String> = params
        .categories
        .unwrap_or_default()
        .split(',')
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().to_string())
        .collect();

    let organic_content = fetch_organic_content(pool, &categories, params.limit).await?;
    log_info(&format!(
        "[MixedContent] 📦 {} produits organiques récupérés",
        organic_content.len()
    ));

    // 3️⃣ Mélanger le contenu avec priorisation des publicités
    let mixed_content = mix_content(paid_content, organic_content, 3); // 1 pub toutes les 3 cartes
    log_info(&format!("[MixedContent] ✅ {} éléments mixés au total", mixed_content.len()));

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
        "#
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
        let data: Value = row.try_get("data").unwrap_or(json!({}));
        let publicite_config: Value = row.try_get("publicite_config").unwrap_or(json!({}));

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
        let data: Value = row.try_get("data").unwrap_or(json!({}));

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

