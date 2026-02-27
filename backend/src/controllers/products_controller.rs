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
    response::{Html, IntoResponse},
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
        .map(|p| {
            let mut product_data = p.product_data.clone();

            // Récupérer les médias pour ce product_index
            let (product_images, product_videos) = product_media_map
                .get(&Some(p.product_index))
                .or_else(|| product_media_map.get(&None)) // Fallback vers médias globaux du service
                .cloned()
                .unwrap_or_else(|| (Vec::new(), Vec::new()));

            // ✅ Enrichir product_data avec les médias (fusionner avec existants)
            if let Some(obj) = product_data.as_object_mut() {
                // ✅ CORRIGÉ 2026-02-27: Helper pour extraire les URLs depuis un champ média
                // Gère: tableau simple ["url1","url2"], objet {valeur: ["url1","url2"]}, string "url1"
                fn extract_media_urls(val: &serde_json::Value) -> Vec<String> {
                    match val {
                        serde_json::Value::Array(arr) => {
                            arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
                        }
                        serde_json::Value::Object(obj) => {
                            // Format {valeur: [...]} du formulaire dynamique
                            obj.get("valeur")
                                .and_then(|v| v.as_array())
                                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                                .unwrap_or_default()
                        }
                        serde_json::Value::String(s) if !s.is_empty() => vec![s.clone()],
                        _ => Vec::new(),
                    }
                }

                // Fusionner les images
                let existing_images: Vec<String> = obj
                    .get("images")
                    .map(|v| extract_media_urls(v))
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
                    .map(|v| extract_media_urls(v))
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

                // ✅ NOUVEAU 2026-01-XX: Enrichir avec variants si variation_prix existe
                // Si has_variant/variants n'existent pas mais variation_prix existe
                if !obj.contains_key("has_variant") && !obj.contains_key("variants") {
                    // Extraire les valeurs nécessaires avant de faire les insertions pour éviter les conflits d'emprunt
                    let variation_prix = obj.get("variation_prix")
                        .or_else(|| obj.get("variabilite_prix"))
                        .or_else(|| obj.get("price_variant"))
                        .cloned();

                    if let Some(variation_prix_val) = variation_prix {
                        // Transformer variation_prix → has_variant + variants
                        if let Some(variation_obj) = variation_prix_val.as_object() {
                            if let Some(modalites) = variation_obj.get("modalites").and_then(|v| v.as_array()) {
                                if !modalites.is_empty() {
                                    let variants: Vec<serde_json::Value> = modalites
                                        .iter()
                                        .filter_map(|m| {
                                            if let Some(modalite_obj) = m.as_object() {
                                                Some(json!({
                                                    "value": modalite_obj.get("valeur").or_else(|| modalite_obj.get("value")),
                                                    "valeur": modalite_obj.get("valeur").or_else(|| modalite_obj.get("value")),
                                                    "prix": modalite_obj.get("prix").or_else(|| modalite_obj.get("price")),
                                                    "devise": modalite_obj.get("devise").or_else(|| modalite_obj.get("currency")).unwrap_or(&json!("XAF")),
                                                    "stock": modalite_obj.get("stock").or_else(|| modalite_obj.get("quantite")),
                                                    "image": modalite_obj.get("image"),
                                                }))
                                            } else {
                                                None
                                            }
                                        })
                                        .collect();

                                    if !variants.is_empty() {
                                        // Extraire variant_dimension avant les insertions
                                        let variant_dimension = variation_obj.get("variable").cloned();

                                        obj.insert("has_variant".to_string(), json!(true));
                                        obj.insert("variants".to_string(), json!(variants));

                                        // Ajouter variant_dimension si disponible
                                        if let Some(variable) = variant_dimension {
                                            obj.insert("variant_dimension".to_string(), variable);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            ProductResponse {
                id: p.id,
                service_id: p.service_id,
                product_index: p.product_index,
                product_data, // ✅ product_data enrichi avec les médias CDN et variants
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

/// GET /api/products/user/{user_id} - Alias pour compatibilité mobile
/// Wrapper qui extrait user_id du path au lieu de query params
pub async fn get_products_by_user_path(
    Path(user_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Vec<ProductResponse>>> {
    get_products_by_user(
        Query(GetProductsByUserQuery { user_id }),
        State(state),
        Extension(user),
    )
    .await
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

    // ✅ CORRIGÉ 2026-02-27: Ne PLUS rediriger mobile vers yukpomnang:// (les navigateurs bloquent les custom schemes)
    // Au lieu de ça, toujours servir la page HTML qui gère intelligemment la redirection
    // via intent:// (Android Chrome) et Universal Links (iOS)
    let is_mobile = is_mobile_user_agent(user_agent);

    log::info!(
        "🔗 [share_product_redirect] product_id={}, service_id={}, mobile={}, UA={}",
        product_id,
        service_id,
        is_mobile,
        &user_agent[..user_agent.len().min(80)]
    );

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

    // ✅ Récupérer toutes les images du produit depuis la table media
    let product_images_db: Vec<String> = sqlx::query_scalar::<_, Option<String>>(
        r#"
        SELECT path
        FROM media
        WHERE service_id = $1
        AND (product_index = $2 OR product_index IS NULL)
        AND (type = 'image' OR media_type = 'image')
        ORDER BY 
            CASE WHEN product_index = $2 THEN 0 ELSE 1 END,
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

    // ✅ CORRIGÉ 2026-02-27: Extraire images depuis product_data (format tableau OU {valeur: [...]})
    let product_images_from_data: Vec<String> = {
        let images_val = product_data.as_object().and_then(|obj| obj.get("images"));
        match images_val {
            Some(v) if v.is_array() => v
                .as_array()
                .unwrap()
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect(),
            Some(v) if v.is_object() => {
                // Format {valeur: [...]} du formulaire dynamique
                v.as_object()
                    .unwrap()
                    .get("valeur")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
                    })
                    .unwrap_or_default()
            }
            _ => Vec::new(),
        }
    };

    // Fusionner les images (DB en priorité, puis product_data)
    let mut all_product_images = product_images_db;
    for img in product_images_from_data {
        if !img.is_empty() && !all_product_images.contains(&img) {
            all_product_images.push(img);
        }
    }

    log::info!(
        "🖼️ [share_product_redirect] {} images trouvées pour produit {}",
        all_product_images.len(),
        product_id
    );

    // ✅ CORRIGÉ 2026-02-27: Utiliser SHARE_BASE_URL (URL du backend) au lieu de PUBLIC_BASE_URL (bucket GCS)
    let share_base_url = std::env::var("SHARE_BASE_URL")
        .or_else(|_| std::env::var("BACKEND_URL"))
        .unwrap_or_else(|_| "https://yukpo-backend-376093909298.europe-west1.run.app".to_string());

    // Image principale (première de la liste ou logo par défaut)
    let product_image_url = all_product_images
        .first()
        .cloned()
        .unwrap_or_else(|| format!("{}/logo.png", &share_base_url));

    // Construire la galerie HTML d'images
    let images_gallery_html = if all_product_images.is_empty() {
        String::new()
    } else if all_product_images.len() == 1 {
        format!(
            r#"<div class="product-image"><img src="{}" alt="{}" /></div>"#,
            all_product_images[0], product_name
        )
    } else {
        let thumbs: String = all_product_images.iter().enumerate().map(|(idx, url)| {
            let active = if idx == 0 { " active" } else { "" };
            format!(
                r#"<img src="{}" alt="{} - Image {}" class="gallery-thumb{}" onclick="showImage({})" />"#,
                url, product_name, idx + 1, active, idx
            )
        }).collect::<Vec<_>>().join("\n            ");

        format!(
            r#"<div class="gallery-container">
            <div class="gallery-main"><img id="main-image" src="{}" alt="{}" /></div>
            <div class="gallery-thumbs">{}</div>
        </div>"#,
            all_product_images[0], product_name, thumbs
        )
    };

    // Construire le tableau JS des images
    let images_js_array = format!(
        "[{}]",
        all_product_images
            .iter()
            .map(|url| format!("\"{}\"", url.replace('"', "\\\"")))
            .collect::<Vec<_>>()
            .join(", ")
    );

    let share_url = format!(
        "{}/product/{}?serviceId={}",
        &share_base_url, product_id, service_id
    );

    // Description enrichie
    let product_description = product_data
        .as_object()
        .and_then(|obj| {
            obj.get("description")
                .and_then(|v| v.as_str().map(|s| s.to_string()))
                .or_else(|| {
                    // Format {valeur: "..."} du formulaire dynamique
                    obj.get("description")
                        .and_then(|v| v.as_object())
                        .and_then(|o| o.get("valeur"))
                        .and_then(|v| v.as_str().map(|s| s.to_string()))
                })
        })
        .unwrap_or_else(|| "Découvrez ce produit exceptionnel sur Yukpomnang".to_string())
        .chars()
        .take(200)
        .collect::<String>();

    let price_amount =
        product.product_price.as_ref().and_then(|p| p.to_string().parse::<f64>().ok());
    let price_currency = "XAF";

    let deep_link = generate_deep_link(&product_id, service_id);

    // ✅ CORRIGÉ 2026-02-27: Utiliser intent:// pour Android Chrome (fonctionne contrairement à yukpomnang://)
    let android_intent_url = format!(
        "intent://product/{}?serviceId={}#Intent;scheme=yukpomnang;package=com.yukpomnang.mobile;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.yukpomnang.mobile;end",
        product_id, service_id
    );

    // Prix HTML
    let price_html = product_price
        .as_ref()
        .map(|p| format!(r#"<div class="price">{} XAF</div>"#, p))
        .unwrap_or_default();

    // Prix OG meta tags
    let price_og_html = price_amount
        .map(|p| {
            format!(
                r#"<meta property="product:price:amount" content="{}" />
    <meta property="product:price:currency" content="{}" />
    <meta property="product:availability" content="in stock" />"#,
                p, price_currency
            )
        })
        .unwrap_or_default();

    let price_schema = price_amount.map(|p| p.to_string()).unwrap_or_else(|| "0".to_string());

    // ✅ CORRIGÉ 2026-02-27: Construire le HTML par concaténation au lieu de format!()
    // Cela évite les conflits entre {{}} de Rust et {} de JavaScript
    let mut html = String::with_capacity(8000);
    html.push_str(
        r#"<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>"#,
    );
    html.push_str(product_name);
    html.push_str(
        r#" - Yukpomnang</title>
    <meta name="description" content=""#,
    );
    html.push_str(&product_description);
    html.push_str(
        r#"" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content=""#,
    );
    html.push_str(product_name);
    html.push_str(
        r#"" />
    <meta property="og:description" content=""#,
    );
    html.push_str(&product_description);
    html.push_str(
        r#"" />
    <meta property="og:image" content=""#,
    );
    html.push_str(&product_image_url);
    html.push_str(
        r#"" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content=""#,
    );
    html.push_str(product_name);
    html.push_str(
        r#"" />
    <meta property="og:url" content=""#,
    );
    html.push_str(&share_url);
    html.push_str(
        r#"" />
    <meta property="og:site_name" content="Yukpomnang" />
    <meta property="og:locale" content="fr_FR" />
    "#,
    );
    html.push_str(&price_og_html);
    html.push_str(
        r#"
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content=""#,
    );
    html.push_str(product_name);
    html.push_str(
        r#"" />
    <meta name="twitter:description" content=""#,
    );
    html.push_str(&product_description);
    html.push_str(
        r#"" />
    <meta name="twitter:image" content=""#,
    );
    html.push_str(&product_image_url);
    html.push_str(
        r#"" />
    <meta name="twitter:image:alt" content=""#,
    );
    html.push_str(product_name);
    html.push_str(
        r#"" />
    <meta name="twitter:site" content="@yukpomnang" />
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": ""#,
    );
    html.push_str(product_name);
    html.push_str(
        r#"",
        "description": ""#,
    );
    html.push_str(&product_description);
    html.push_str(
        r#"",
        "image": ""#,
    );
    html.push_str(&product_image_url);
    html.push_str(
        r#"",
        "offers": {
            "@type": "Offer",
            "price": ""#,
    );
    html.push_str(&price_schema);
    html.push_str(
        r#"",
            "priceCurrency": ""#,
    );
    html.push_str(price_currency);
    html.push_str(
        r#"",
            "availability": "https://schema.org/InStock",
            "url": ""#,
    );
    html.push_str(&share_url);
    html.push_str(
        r#""
        },
        "brand": { "@type": "Brand", "name": "Yukpomnang" }
    }
    </script>
    <meta name="google-play-app" content="app-id=com.yukpomnang.mobile">
    <meta property="al:android:url" content=""#,
    );
    html.push_str(&deep_link);
    html.push_str(r#"" />
    <meta property="al:android:package" content="com.yukpomnang.mobile" />
    <meta property="al:android:app_name" content="Yukpomnang" />
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container {
            background: white; border-radius: 16px; padding: 32px;
            max-width: 600px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #1f2937; margin: 0 0 16px 0; font-size: 28px; }
        .price { font-size: 24px; font-weight: bold; color: #10b981; margin: 16px 0; }
        .description { color: #6b7280; line-height: 1.6; margin: 16px 0; }
        .button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; border: none; padding: 16px 32px; border-radius: 8px;
            font-size: 16px; font-weight: 600; cursor: pointer; width: 100%;
            margin-top: 16px; transition: transform 0.2s; display: block; text-align: center;
            text-decoration: none;
        }
        .button:hover { transform: translateY(-2px); }
        .button-secondary {
            background: #10b981; margin-top: 8px;
        }
        .product-image { margin: 20px 0; text-align: center; }
        .product-image img { max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .gallery-container { margin: 20px 0; }
        .gallery-main { margin-bottom: 16px; text-align: center; }
        .gallery-main img { max-width: 100%; height: auto; max-height: 500px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); object-fit: contain; }
        .gallery-thumbs { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
        .gallery-thumb { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; opacity: 0.7; }
        .gallery-thumb:hover { opacity: 1; border-color: #667eea; transform: scale(1.05); }
        .gallery-thumb.active { opacity: 1; border-color: #667eea; }
        .store-badges { display: flex; gap: 12px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }
        .store-badge { height: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>"#);
    html.push_str(product_name);
    html.push_str(
        r#"</h1>
        "#,
    );
    html.push_str(&price_html);
    html.push_str(&images_gallery_html);
    html.push_str(
        r#"
        <div class="description">"#,
    );
    html.push_str(&product_description);
    html.push_str("</div>\n");
    html.push_str("        <a id=\"open-app-btn\" class=\"button\" href=\"#\">\u{1F4F1} Ouvrir dans l'app Yukpomnang</a>\n");
    html.push_str("        <a class=\"button button-secondary\" href=\"https://play.google.com/store/apps/details?id=com.yukpomnang.mobile\" target=\"_blank\">\u{1F4E5} T\u{00E9}l\u{00E9}charger l'app</a>\n");
    html.push_str("    </div>\n");
    html.push_str("    <script>\n");
    html.push_str("        var DEEP_LINK = '");
    html.push_str(&deep_link);
    html.push_str("';\n");
    html.push_str("        var INTENT_URL = '");
    html.push_str(&android_intent_url);
    html.push_str("';\n");
    html.push_str("        var PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.yukpomnang.mobile';\n");
    html.push_str("        var APP_STORE = 'https://apps.apple.com/app/yukpomnang';\n");
    html.push_str("        var productImages = ");
    html.push_str(&images_js_array);
    html.push_str(r#";

        // Galerie d'images
        function showImage(index) {
            var mainImg = document.getElementById('main-image');
            if (mainImg && productImages[index]) {
                mainImg.src = productImages[index];
                var thumbs = document.querySelectorAll('.gallery-thumb');
                for (var i = 0; i < thumbs.length; i++) {
                    thumbs[i].className = thumbs[i].className.replace(' active', '');
                    if (i === index) thumbs[i].className += ' active';
                }
            }
        }

        // Détection plateforme
        var ua = navigator.userAgent || '';
        var isAndroid = /Android/i.test(ua);
        var isIOS = /iPhone|iPad|iPod/i.test(ua);
        var isMobile = isAndroid || isIOS;

        // Configurer le bouton "Ouvrir dans l'app"
        var openBtn = document.getElementById('open-app-btn');
        if (openBtn) {
            if (isAndroid) {
                // Android: utiliser intent:// qui fonctionne dans Chrome et redirige vers le Play Store si l'app n'est pas installée
                openBtn.href = INTENT_URL;
            } else if (isIOS) {
                // iOS: essayer le custom scheme, fallback vers App Store
                openBtn.href = DEEP_LINK;
                openBtn.onclick = function() {
                    setTimeout(function() { window.location.href = APP_STORE; }, 1500);
                };
            } else {
                // Desktop: cacher le bouton "Ouvrir dans l'app", garder le téléchargement
                openBtn.style.display = 'none';
            }
        }

        // Sur mobile, tenter l'ouverture automatique de l'app après un court délai
        if (isMobile) {
            setTimeout(function() {
                if (isAndroid) {
                    // intent:// URL gère automatiquement le fallback vers le Play Store
                    window.location.href = INTENT_URL;
                } else if (isIOS) {
                    window.location.href = DEEP_LINK;
                    setTimeout(function() { window.location.href = APP_STORE; }, 1500);
                }
            }, 800);
        }
    </script>
</body>
</html>"#);

    log::info!(
        "🌐 [share_product_redirect] Page HTML générée: product={}, images={}, mobile={}",
        product_id,
        all_product_images.len(),
        is_mobile
    );

    Ok(Html(html).into_response())
}
