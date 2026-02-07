// ✅ PHASE 3: Controller pour gestion des produits via table service_products
// Date: 2026-01-03
// Objectif: Endpoints API pour lire/modifier les produits depuis la table service_products

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::sharing_service::{generate_deep_link, is_mobile_user_agent};
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::{Html, IntoResponse, Redirect},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

/// Structure de réponse pour un produit
#[derive(Debug, Serialize, Deserialize)]
pub struct ProductResponse {
    pub id: i32,
    pub service_id: i32,
    pub product_index: i32,
    pub product_data: Value,
    pub product_name: String,
    pub product_type: String,
    pub product_price: Option<rust_decimal::Decimal>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub auto_deactivate_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// GET /api/services/{service_id}/products
/// Retourne tous les produits d'un service (depuis table service_products)
/// ✅ CORRIGÉ: Enrichit les produits avec les médias depuis la table media (CDN)
pub async fn get_products_by_service(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<Vec<ProductResponse>>> {
    use crate::utils::log::log_info;
    use std::collections::HashMap;

    let products_service = &state.products_service;

    let products = products_service.get_active_products_by_service(service_id).await?;

    // ✅ NOUVEAU: Charger les médias depuis la table media pour enrichir les produits
    // Structure: HashMap<product_index, (images, videos)>
    // product_index = None pour les médias globaux du service
    let mut product_media_map: HashMap<Option<i32>, (Vec<String>, Vec<String>)> = HashMap::new();

    let media_rows = sqlx::query(
        r#"
        SELECT product_index, type, path
        FROM media
        WHERE service_id = $1
        AND type IN ('image', 'video')
        AND path IS NOT NULL
        ORDER BY COALESCE(product_index, -1), uploaded_at ASC
        "#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        AppError::Internal(format!(
            "Erreur récupération médias pour service {}: {}",
            service_id, e
        ))
    })?;

    log_info(&format!(
        "[get_products_by_service] {} médias trouvés pour service {}",
        media_rows.len(),
        service_id
    ));

    // Grouper les médias par product_index
    for row in media_rows {
        let product_index: Option<i32> = row.try_get("product_index").ok().flatten();
        let media_type: String = row.get("type");
        let path: String = row.get("path");

        let entry = product_media_map
            .entry(product_index)
            .or_insert_with(|| (Vec::new(), Vec::new()));

        // Transformer le chemin en URL CDN si nécessaire
        let media_url = if !path.starts_with("http://") && !path.starts_with("https://") {
            state.media_storage.build_public_url(&path)
        } else {
            path
        };

        match media_type.as_str() {
            "image" => entry.0.push(media_url),
            "video" => entry.1.push(media_url),
            _ => {}
        }
    }

    // ✅ Enrichir chaque produit avec ses médias
    let response: Vec<ProductResponse> = products
        .into_iter()
        .map(|mut p| {
            let mut product_data = p.product_data.clone();

            // Récupérer les médias pour ce product_index
            let (product_images, product_videos) = product_media_map
                .get(&Some(p.product_index))
                .or_else(|| product_media_map.get(&None)) // Fallback vers médias globaux du service
                .cloned()
                .unwrap_or_else(|| (Vec::new(), Vec::new()));

            // ✅ Enrichir product_data avec les médias (fusionner avec existants)
            if let Some(obj) = product_data.as_object_mut() {
                // Fusionner les images
                let existing_images: Vec<String> = obj
                    .get("images")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
                    })
                    .unwrap_or_default();

                let mut merged_images = existing_images;
                for img in product_images {
                    if !merged_images.contains(&img) {
                        merged_images.push(img);
                    }
                }

                if !merged_images.is_empty() {
                    obj.insert("images".to_string(), json!(merged_images));
                }

                // Fusionner les vidéos
                let existing_videos: Vec<String> = obj
                    .get("videos")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
                    })
                    .unwrap_or_default();

                let mut merged_videos = existing_videos;
                for vid in product_videos {
                    if !merged_videos.contains(&vid) {
                        merged_videos.push(vid);
                    }
                }

                if !merged_videos.is_empty() {
                    obj.insert("videos".to_string(), json!(merged_videos));
                }
            }

            ProductResponse {
                id: p.id,
                service_id: p.service_id,
                product_index: p.product_index,
                product_data, // ✅ product_data enrichi avec les médias CDN
                product_name: p.product_name,
                product_type: p.product_type,
                product_price: p.product_price,
                is_active: p.is_active,
                created_at: p.created_at,
                updated_at: p.updated_at,
                auto_deactivate_at: p.auto_deactivate_at,
            }
        })
        .collect();

    log_info(&format!(
        "[get_products_by_service] {} produits enrichis avec médias pour service {}",
        response.len(),
        service_id
    ));

    Ok(Json(response))
}

/// GET /api/services/{service_id}/products/{product_index}
/// Retourne un produit spécifique (depuis table service_products)
pub async fn get_product(
    Path((service_id, product_index)): Path<(i32, i32)>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<ProductResponse>> {
    let products_service = &state.products_service;

    let product =
        products_service.get_product(service_id, product_index).await?.ok_or_else(|| {
            AppError::NotFound(format!(
                "Produit non trouvé (service_id: {}, product_index: {})",
                service_id, product_index
            ))
        })?;

    let response = ProductResponse {
        id: product.id,
        service_id: product.service_id,
        product_index: product.product_index,
        product_data: product.product_data,
        product_name: product.product_name,
        product_type: product.product_type,
        product_price: product.product_price,
        is_active: product.is_active,
        created_at: product.created_at,
        updated_at: product.updated_at,
        auto_deactivate_at: product.auto_deactivate_at,
    };

    Ok(Json(response))
}

/// Structure pour la mise à jour d'un produit
#[derive(Debug, Deserialize)]
pub struct UpdateProductRequest {
    pub product_data: Value,
}

/// PATCH /api/services/{service_id}/products/{product_index}
/// Met à jour un produit (table service_products uniquement)
pub async fn update_product(
    Path((service_id, product_index)): Path<(i32, i32)>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<UpdateProductRequest>,
) -> AppResult<Json<ProductResponse>> {
    // Vérifier que l'utilisateur est propriétaire du service
    let owner: Option<i32> =
        sqlx::query_scalar!("SELECT user_id FROM services WHERE id = $1", service_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification propriétaire: {}", e)))?;

    if owner != Some(user.id) {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas propriétaire de ce service".to_string(),
        ));
    }

    let products_service = &state.products_service;

    // ✅ PHASE 5: Mise à jour uniquement dans la table service_products (plus d'écriture JSONB)
    let product = products_service
        .update_product(service_id, product_index, &payload.product_data)
        .await?;

    let response = ProductResponse {
        id: product.id,
        service_id: product.service_id,
        product_index: product.product_index,
        product_data: product.product_data,
        product_name: product.product_name,
        product_type: product.product_type,
        product_price: product.product_price,
        is_active: product.is_active,
        created_at: product.created_at,
        updated_at: product.updated_at,
        auto_deactivate_at: product.auto_deactivate_at,
    };

    Ok(Json(response))
}

/// DELETE /api/services/{service_id}/products/{product_index}
/// Supprime un produit (table service_products uniquement)
pub async fn delete_product(
    Path((service_id, product_index)): Path<(i32, i32)>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur est propriétaire du service
    let owner: Option<i32> =
        sqlx::query_scalar!("SELECT user_id FROM services WHERE id = $1", service_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification propriétaire: {}", e)))?;

    if owner != Some(user.id) {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas propriétaire de ce service".to_string(),
        ));
    }

    let products_service = &state.products_service;

    // ✅ PHASE 5: Suppression uniquement dans la table service_products (plus d'écriture JSONB)
    products_service.delete_product(service_id, product_index).await?;

    // Réindexer les produits restants
    products_service.reindex_products(service_id).await?;

    Ok(Json(json!({
        "message": "Produit supprimé avec succès",
        "service_id": service_id,
        "product_index": product_index
    })))
}

/// Structure pour les paramètres de requête
#[derive(Debug, Deserialize)]
pub struct GetProductsByUserQuery {
    pub user_id: i32,
}

/// GET /api/products?user_id={user_id}
/// Retourne tous les produits d'un utilisateur (pour MesProduits)
pub async fn get_products_by_user(
    Query(params): Query<GetProductsByUserQuery>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Vec<ProductResponse>>> {
    // Vérifier que l'utilisateur demande ses propres produits
    if params.user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous ne pouvez récupérer que vos propres produits".to_string(),
        ));
    }

    // Récupérer tous les produits de l'utilisateur via ses services
    let products = sqlx::query_as::<_, crate::services::products_service::Product>(
        r#"
        SELECT 
            p.id,
            p.service_id,
            p.product_index,
            p.product_data,
            p.product_name,
            p.product_type,
            p.product_price,
            p.is_active,
            p.created_at,
            p.updated_at,
            p.auto_deactivate_at
        FROM service_products p
        INNER JOIN services s ON s.id = p.service_id
        WHERE s.user_id = $1
        AND p.is_active = true
        AND s.is_active = true
        ORDER BY p.created_at DESC
        "#,
    )
    .bind(params.user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        AppError::Internal(format!(
            "Erreur lors de la récupération des produits utilisateur: {}",
            e
        ))
    })?;

    // ✅ CORRIGÉ À LA RACINE: Valider que tous les produits ont un product_index valide
    let response: Vec<ProductResponse> = products
        .into_iter()
        .map(|p| {
            // ✅ Validation: product_index doit être >= 0 (garanti NOT NULL par la DB)
            if p.product_index < 0 {
                log::warn!(
                    "⚠️ [get_products_by_user] product_index invalide (négatif) pour produit id={}, service_id={}, product_index={}",
                    p.id, p.service_id, p.product_index
                );
            }
            ProductResponse {
                id: p.id,
                service_id: p.service_id,
                product_index: p.product_index, // ✅ Garanti NOT NULL par la DB
                product_data: p.product_data,
                product_name: p.product_name,
                product_type: p.product_type,
                product_price: p.product_price,
                is_active: p.is_active,
                created_at: p.created_at,
                updated_at: p.updated_at,
                auto_deactivate_at: p.auto_deactivate_at,
            }
        })
        .collect();

    Ok(Json(response))
}

/// POST /api/services/{service_id}/products/{product_index}/duplicate
/// Duplique un produit (crée une copie avec un nouvel index)
pub async fn duplicate_product(
    Path((service_id, product_index)): Path<(i32, i32)>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<ProductResponse>> {
    // Vérifier que l'utilisateur est propriétaire du service
    let owner: Option<i32> =
        sqlx::query_scalar!("SELECT user_id FROM services WHERE id = $1", service_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification propriétaire: {}", e)))?;

    if owner != Some(user.id) {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas propriétaire de ce service".to_string(),
        ));
    }

    let products_service = &state.products_service;

    // Dupliquer le produit
    let new_product = products_service.duplicate_product(service_id, product_index).await?;

    let response = ProductResponse {
        id: new_product.id,
        service_id: new_product.service_id,
        product_index: new_product.product_index,
        product_data: new_product.product_data,
        product_name: new_product.product_name,
        product_type: new_product.product_type,
        product_price: new_product.product_price,
        is_active: new_product.is_active,
        created_at: new_product.created_at,
        updated_at: new_product.updated_at,
        auto_deactivate_at: new_product.auto_deactivate_at,
    };

    Ok(Json(response))
}

/// Structure pour les paramètres de requête de partage
#[derive(Debug, Deserialize)]
pub struct ShareQueryParams {
    pub service_id: Option<i32>,
}

/// GET /product/:product_id?serviceId=:service_id
/// Route publique pour le partage intelligent de produits
/// Détecte le User-Agent et redirige vers l'app si mobile, ou affiche la page web si desktop
pub async fn share_product_redirect(
    Path(product_id): Path<String>,
    Query(params): Query<ShareQueryParams>,
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<axum::response::Response> {
    let service_id = params.service_id.ok_or_else(|| {
        AppError::BadRequest("serviceId est requis dans les paramètres de requête".to_string())
    })?;

    // Récupérer le User-Agent
    let user_agent = headers.get("user-agent").and_then(|h| h.to_str().ok()).unwrap_or("");

    // Vérifier si c'est un appareil mobile
    if is_mobile_user_agent(user_agent) {
        // Rediriger vers le deep link de l'app
        let deep_link = generate_deep_link(&product_id, service_id);
        log::info!(
            "📱 Redirection mobile vers deep link: {} (User-Agent: {})",
            deep_link,
            user_agent
        );
        return Ok(Redirect::temporary(&deep_link).into_response());
    }

    // Sinon, afficher la page web du produit
    // Récupérer les informations du produit
    let products_service = &state.products_service;

    // Parser product_id (format: service_id_product_index ou juste product_index)
    let (parsed_service_id, product_index) = if let Some(underscore_pos) = product_id.find('_') {
        let service_id_str = &product_id[..underscore_pos];
        let index_str = &product_id[underscore_pos + 1..];
        (
            service_id_str.parse::<i32>().ok(),
            index_str.parse::<i32>().ok(),
        )
    } else {
        (Some(service_id), product_id.parse::<i32>().ok())
    };

    let final_service_id = parsed_service_id.unwrap_or(service_id);
    let final_product_index = product_index.unwrap_or(0);

    // Récupérer le produit
    let product = products_service
        .get_product(final_service_id, final_product_index)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Produit non trouvé (product_id: {}, service_id: {})",
                product_id, service_id
            ))
        })?;

    let product_data = &product.product_data;
    let product_name = &product.product_name;
    let product_price = product.product_price.as_ref().map(|p| p.to_string());

    // ✅ NOUVEAU: Récupérer toutes les images du produit depuis la table media
    let product_images_db: Vec<String> = sqlx::query_scalar::<_, Option<String>>(
        r#"
        SELECT path
        FROM media
        WHERE service_id = $1
        AND product_index = $2
        AND (type = 'image' OR media_type = 'image')
        ORDER BY 
            COALESCE(is_main_image, FALSE) DESC,
            COALESCE(display_order, 0) ASC, 
            id ASC
        "#,
    )
    .bind(final_service_id)
    .bind(final_product_index)
    .fetch_all(&state.pg)
    .await
    .ok()
    .unwrap_or_default()
    .into_iter()
    .flatten()
    .map(|path| {
        if path.starts_with("http://") || path.starts_with("https://") {
            path
        } else {
            state.media_storage.build_public_url(&path)
        }
    })
    .collect();

    // Récupérer aussi les images depuis product_data
    let product_images_from_data: Vec<String> = product_data
        .as_object()
        .and_then(|obj| obj.get("images"))
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    // Fusionner les images (DB en priorité, puis product_data)
    let mut all_product_images = product_images_db;
    for img in product_images_from_data {
        if !all_product_images.contains(&img) {
            all_product_images.push(img);
        }
    }

    // Image principale (première de la liste)
    let product_image_url = all_product_images.first().cloned().unwrap_or_else(|| {
        // Fallback final: logo Yukpomnang
        std::env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| "https://yukpomnang.com".to_string())
            + "/logo.png"
    });

    // Générer le HTML pour la galerie d'images
    let (images_gallery_html, images_js_array) = if all_product_images.len() > 1 {
        let gallery_items: String = all_product_images
            .iter()
            .enumerate()
            .map(|(idx, img_url)| {
                let active_class = if idx == 0 { " active" } else { "" };
                format!(
                    r#"<img src="{}" alt="{} - Image {}" class="gallery-thumb{}" onclick="showImage({})" />"#,
                    img_url,
                    product_name,
                    idx + 1,
                    active_class,
                    idx
                )
            })
            .collect::<Vec<_>>()
            .join("\n            ");

        // Générer le tableau JavaScript des images
        let images_js = format!(
            "[{}]",
            all_product_images
                .iter()
                .map(|url| format!("\"{}\"", url.replace('"', "\\\"")))
                .collect::<Vec<_>>()
                .join(", ")
        );

        let html = format!(
            r#"
        <div class="gallery-container">
            <div class="gallery-main">
                <img id="main-image" src="{}" alt="{}" />
            </div>
            <div class="gallery-thumbs">
                {}
            </div>
        </div>"#,
            all_product_images[0], product_name, gallery_items
        );
        (html, images_js)
    } else {
        let html = format!(
            r#"<div class="product-image">
            <img src="{}" alt="{}" />
        </div>"#,
            product_image_url, product_name
        );
        (html, "[]".to_string())
    };

    // ✅ NOUVEAU: Construire l'URL complète de partage
    let share_url = format!(
        "{}/product/{}?serviceId={}",
        std::env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| "https://yukpomnang.com".to_string()),
        product_id,
        service_id
    );

    // ✅ NOUVEAU: Description enrichie
    let product_description = product_data
        .as_object()
        .and_then(|obj| obj.get("description"))
        .and_then(|v| v.as_str())
        .unwrap_or("Découvrez ce produit exceptionnel sur Yukpomnang")
        .chars()
        .take(200)
        .collect::<String>();

    // ✅ NOUVEAU: Prix formaté pour Open Graph
    let price_amount =
        product.product_price.as_ref().and_then(|p| p.to_string().parse::<f64>().ok());
    let price_currency = "XAF";

    // Générer le deep link pour le fallback JavaScript
    let deep_link = generate_deep_link(&product_id, service_id);

    // ✅ AMÉLIORATION: Générer la page HTML avec tous les meta tags standards
    let html = format!(
        r#"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- ✅ TITRE ET DESCRIPTION DE BASE -->
    <title>{} - Yukpomnang</title>
    <meta name="description" content="{}" />
    
    <!-- ✅ OPEN GRAPH (Facebook, LinkedIn, WhatsApp, etc.) -->
    <meta property="og:type" content="product" />
    <meta property="og:title" content="{}" />
    <meta property="og:description" content="{}" />
    <meta property="og:image" content="{}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="{}" />
    <meta property="og:url" content="{}" />
    <meta property="og:site_name" content="Yukpomnang" />
    <meta property="og:locale" content="fr_FR" />
    <meta property="og:locale:alternate" content="en_US" />
    
    <!-- ✅ OPEN GRAPH PRODUCT (Prix, devise, disponibilité) -->
    {}
    
    <!-- ✅ TWITTER CARDS -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{}" />
    <meta name="twitter:description" content="{}" />
    <meta name="twitter:image" content="{}" />
    <meta name="twitter:image:alt" content="{}" />
    <meta name="twitter:site" content="@yukpomnang" />
    <meta name="twitter:creator" content="@yukpomnang" />
    
    <!-- ✅ SCHEMA.ORG JSON-LD (Google, Rich Snippets) -->
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "{}",
        "description": "{}",
        "image": "{}",
        "offers": {{
            "@type": "Offer",
            "price": "{}",
            "priceCurrency": "{}",
            "availability": "https://schema.org/InStock",
            "url": "{}"
        }},
        "brand": {{
            "@type": "Brand",
            "name": "Yukpomnang"
        }}
    }}
    </script>
    
    <!-- ✅ APP LINKS (Deep Linking Mobile) -->
    <meta name="apple-itunes-app" content="app-id=YOUR_APP_ID, app-argument={}">
    <meta name="google-play-app" content="app-id=com.yukpomnang.mobile">
    <meta property="al:ios:url" content="{}" />
    <meta property="al:ios:app_store_id" content="YOUR_APP_ID" />
    <meta property="al:android:url" content="{}" />
    <meta property="al:android:package" content="com.yukpomnang.mobile" />
    <meta property="al:android:app_name" content="Yukpomnang" />
    
    <!-- ✅ FAVICON -->
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .container {{
            background: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }}
        h1 {{
            color: #1f2937;
            margin: 0 0 16px 0;
            font-size: 28px;
        }}
        .price {{
            font-size: 24px;
            font-weight: bold;
            color: #10b981;
            margin: 16px 0;
        }}
        .description {{
            color: #6b7280;
            line-height: 1.6;
            margin: 16px 0;
        }}
        .button {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-top: 24px;
            transition: transform 0.2s;
        }}
        .button:hover {{
            transform: translateY(-2px);
        }}
        .button:active {{
            transform: translateY(0);
        }}
        /* ✅ GALERIE D'IMAGES */
        .product-image {{
            margin: 20px 0;
            text-align: center;
        }}
        .product-image img {{
            max-width: 100%;
            height: auto;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }}
        .gallery-container {{
            margin: 20px 0;
        }}
        .gallery-main {{
            margin-bottom: 16px;
            text-align: center;
        }}
        .gallery-main img {{
            max-width: 100%;
            height: auto;
            max-height: 500px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            object-fit: contain;
        }}
        .gallery-thumbs {{
            display: flex;
            gap: 8px;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 12px;
        }}
        .gallery-thumb {{
            width: 80px;
            height: 80px;
            object-fit: cover;
            border-radius: 8px;
            cursor: pointer;
            border: 2px solid transparent;
            transition: all 0.2s;
            opacity: 0.7;
        }}
        .gallery-thumb:hover {{
            opacity: 1;
            border-color: #667eea;
            transform: scale(1.05);
        }}
        .gallery-thumb.active {{
            opacity: 1;
            border-color: #667eea;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{}</h1>
        {}
        {}
        <div class="description">
            Découvrez ce produit et bien plus sur Yukpomnang
        </div>
        <button class="button" onclick="openApp()">
            📱 Ouvrir dans l'app Yukpomnang
        </button>
    </div>
    <script>
        // ✅ CORRECTION CRITIQUE: Redirection automatique vers l'app sur mobile
        (function() {{
            const deepLink = 'yukpomnang://product/{}?serviceId={}';
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // Sur mobile, essayer d'ouvrir l'app automatiquement
            if (isMobile) {{
                // Essayer d'ouvrir l'app immédiatement
                window.location.href = deepLink;
                
                // Fallback: Si l'app n'est pas installée, rediriger vers le store après 2.5s
                setTimeout(() => {{
                    const appStoreUrl = 'https://apps.apple.com/app/yukpomnang';
                    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.yukpomnang.mobile';
                    
                    if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {{
                        window.location.href = appStoreUrl;
                    }} else {{
                        window.location.href = playStoreUrl;
                    }}
                }}, 2500);
            }}
        }})();
        
        function openApp() {{
            const deepLink = 'yukpomnang://product/{}?serviceId={}';
            const appStoreUrl = 'https://apps.apple.com/app/yukpomnang';
            const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.yukpomnang.mobile';
            
            // Essayer d'ouvrir l'app
            window.location.href = deepLink;
            
            // Si l'app n'est pas installée, redirect après 2s
            setTimeout(() => {{
                if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {{
                    window.location.href = appStoreUrl;
                }} else {{
                    window.location.href = playStoreUrl;
                }}
            }}, 2000);
        }}
        
        // ✅ GALERIE D'IMAGES
        const productImages = {};
        function showImage(index) {{
            const mainImg = document.getElementById('main-image');
            if (mainImg && productImages[index]) {{
                mainImg.src = productImages[index];
                // Mettre à jour les miniatures actives
                document.querySelectorAll('.gallery-thumb').forEach((thumb, idx) => {{
                    if (idx === index) {{
                        thumb.classList.add('active');
                    }} else {{
                        thumb.classList.remove('active');
                    }}
                }});
            }}
        }}
        // Initialiser le tableau d'images et la galerie
        (function() {{
            const images = {images_array};
            // Copier les images dans productImages depuis le tableau
            if (Array.isArray(images) && images.length > 0) {{
                images.forEach((img, idx) => {{
                    productImages[idx] = img;
                }});
            }}
            const thumbs = document.querySelectorAll('.gallery-thumb');
            if (thumbs.length > 0) {{
                thumbs[0].classList.add('active');
            }}
        }})();
    </script>
</body>
</html>
"#,
        // Titre et description
        product_name,
        &product_description,
        // Open Graph
        product_name,
        &product_description,
        &product_image_url,
        product_name,
        &share_url,
        // Open Graph Product (prix)
        price_amount
            .map(|p| format!(
                r#"<meta property="product:price:amount" content="{}" />
    <meta property="product:price:currency" content="{}" />
    <meta property="product:availability" content="in stock" />"#,
                p, price_currency
            ))
            .unwrap_or_else(|| "".to_string()),
        // Twitter Cards
        product_name,
        &product_description,
        &product_image_url,
        product_name,
        // Schema.org JSON-LD
        product_name,
        &product_description,
        &product_image_url,
        price_amount.map(|p| p.to_string()).unwrap_or_else(|| "0".to_string()),
        price_currency,
        &share_url,
        // App Links
        &deep_link,
        &deep_link,
        &deep_link,
        // Body content
        product_name,
        product_price
            .map(|p| format!(r#"<div class="price">{} XAF</div>"#, p))
            .unwrap_or_else(|| "".to_string()),
        &images_gallery_html,
        product_id,
        service_id,
        product_id,
        service_id
    );

    // Remplacer le placeholder du tableau d'images dans le JavaScript
    let html = html.replace("{images_array}", &images_js_array);

    log::info!(
        "🌐 Affichage page web produit: {} (User-Agent: {})",
        product_id,
        user_agent
    );

    Ok(Html(html).into_response())
}
