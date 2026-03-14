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
use futures::future::join_all;
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
    // ✅ CORRIGÉ 2026-03-01: Utiliser des URLs pré-signées au lieu de build_public_url
    // car le bucket GCS n'est pas public (les URLs publiques retournent 404)
    for row in media_rows {
        let product_index: Option<i32> = row.try_get("product_index").ok().flatten();
        let media_type: String = row.get("type");
        let path: String = row.get("path");

        let entry = product_media_map
            .entry(product_index)
            .or_insert_with(|| (Vec::new(), Vec::new()));

        // Transformer le chemin en URL accessible
        let media_url = if path.starts_with("http://") || path.starts_with("https://") {
            path
        } else if state.media_storage.is_remote() {
            // ✅ CORRIGÉ: Générer une URL pré-signée (7 jours) au lieu d'une URL publique
            match state.media_storage.generate_presigned_url(&path, 7 * 24 * 3600).await {
                Ok(presigned) => presigned,
                Err(e) => {
                    log_info(&format!(
                        "[get_products_by_service] ⚠️ Erreur URL pré-signée pour {}: {}, fallback build_public_url",
                        path, e
                    ));
                    state.media_storage.build_public_url(&path)
                }
            }
        } else {
            state.media_storage.build_public_url(&path)
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
            // ✅ CORRIGÉ 2026-03-01: Combiner médias spécifiques au produit ET médias globaux du service
            // Au lieu de faire un fallback OR, on fusionne les deux sources
            let specific_media = product_media_map.get(&Some(p.product_index));
            let global_media = product_media_map.get(&None);

            let (product_images, product_videos) = match (specific_media, global_media) {
                (Some((si, sv)), Some((gi, gv))) => {
                    // Combiner spécifiques + globaux (spécifiques en premier)
                    let mut imgs = si.clone();
                    for g in gi {
                        if !imgs.contains(g) { imgs.push(g.clone()); }
                    }
                    let mut vids = sv.clone();
                    for g in gv {
                        if !vids.contains(g) { vids.push(g.clone()); }
                    }
                    (imgs, vids)
                }
                (Some(specific), None) => specific.clone(),
                (None, Some(global)) => global.clone(),
                (None, None) => (Vec::new(), Vec::new()),
            };

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

/// ✅ CORRIGÉ 2026-03-08: Échapper les caractères spéciaux pour les attributs HTML
/// CRITIQUE pour les URLs pré-signées qui contiennent & dans les query params
/// Sans cet échappement, og:image est tronqué par les crawlers sociaux (WhatsApp, Facebook, Twitter)
fn html_attr_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Structure pour les paramètres de requête de partage
#[derive(Debug, Deserialize)]
pub struct ShareQueryParams {
    /// ✅ CORRIGÉ 2026-03-04: Accepter à la fois "serviceId" (camelCase du mobile) et "service_id" (snake_case)
    #[serde(alias = "serviceId")]
    pub service_id: Option<i32>,
}

/// Helper: construit la galerie HTML + JS pour vidéos + images (vidéos en premier)
/// Retourne (gallery_html, media_js_array, first_video_url)
fn build_media_gallery(
    videos: &[String],
    images: &[String],
    item_name: &str,
) -> (String, String, Option<String>) {
    let mut all_media: Vec<(&str, bool)> = Vec::new();
    for v in videos {
        all_media.push((v.as_str(), true));
    }
    for i in images {
        all_media.push((i.as_str(), false));
    }

    // ✅ CORRIGÉ 2026-03-08: Échapper les URLs et textes dans les attributs HTML
    // Les URLs pré-signées contiennent & qui doit être &amp; dans les attributs src/alt
    let escaped_name = html_attr_escape(item_name);

    let gallery_html = if all_media.is_empty() {
        String::new()
    } else if all_media.len() == 1 {
        let (url, is_vid) = all_media[0];
        let escaped_url = html_attr_escape(url);
        if is_vid {
            format!(
                r#"<div class="media-hero"><video src="{}" autoplay muted loop playsinline></video></div>"#,
                escaped_url
            )
        } else {
            format!(
                r#"<div class="media-hero"><img src="{}" alt="{}" /></div>"#,
                escaped_url, escaped_name
            )
        }
    } else {
        let (first_url, first_is_vid) = all_media[0];
        let vid_style = if first_is_vid {
            ""
        } else {
            " style=\"display:none\""
        };
        let img_style = if first_is_vid {
            " style=\"display:none\""
        } else {
            ""
        };
        let vid_src = if first_is_vid {
            html_attr_escape(first_url)
        } else {
            String::new()
        };
        let img_src = if first_is_vid {
            String::new()
        } else {
            html_attr_escape(first_url)
        };

        // ✅ AMÉLIORÉ 2026-03-11: Ajout flèches prev/next + compteur + dots (comme ProductCard)
        let main_html = format!(
            r#"<div class="gallery-main"><button class="gallery-nav prev" onclick="prevMedia()">&#10094;</button><video id="main-video" src="{}" autoplay muted loop playsinline{}></video><img id="main-image" src="{}" alt="{}"{} /><button class="gallery-nav next" onclick="nextMedia()">&#10095;</button></div>"#,
            vid_src, vid_style, img_src, escaped_name, img_style
        );

        let counter_html = format!(
            r#"<div class="gallery-counter" id="gallery-counter">1 / {}</div>"#,
            all_media.len()
        );

        let dots: String = all_media
            .iter()
            .enumerate()
            .map(|(idx, _)| {
                let active = if idx == 0 { " active" } else { "" };
                format!(
                    r#"<span class="gallery-dot{}" onclick="showMedia({})"></span>"#,
                    active, idx
                )
            })
            .collect::<Vec<_>>()
            .join("");
        let dots_html = format!(r#"<div class="gallery-dots">{}</div>"#, dots);

        let thumbs: String = all_media.iter().enumerate().map(|(idx, (url, is_vid))| {
            let active = if idx == 0 { " active" } else { "" };
            let escaped_url = html_attr_escape(url);
            if *is_vid {
                format!(
                    r#"<div class="thumb-wrap{}" onclick="showMedia({})"><video src="{}" class="thumb-media" muted preload="metadata"></video><div class="play-badge">&#9654;</div></div>"#,
                    active, idx, escaped_url
                )
            } else {
                format!(
                    r#"<div class="thumb-wrap{}" onclick="showMedia({})"><img src="{}" alt="{}" class="thumb-media" /></div>"#,
                    active, idx, escaped_url, escaped_name
                )
            }
        }).collect::<Vec<_>>().join("\n            ");

        format!(
            r#"<div class="gallery-container">{}{}{}<div class="gallery-thumbs">{}</div></div>"#,
            main_html, counter_html, dots_html, thumbs
        )
    };

    let media_js_array = format!(
        "[{}]",
        all_media
            .iter()
            .map(|(url, is_vid)| {
                format!(r#"{{"u":"{}","v":{}}}"#, url.replace('"', "\\\""), is_vid)
            })
            .collect::<Vec<_>>()
            .join(",")
    );

    let first_video = videos.first().cloned();
    (gallery_html, media_js_array, first_video)
}

/// CSS commun pour la galerie média (vidéos + images) + prix_variation
fn media_gallery_css() -> &'static str {
    r#"
        .media-hero { margin: 20px 0; text-align: center; }
        .media-hero img, .media-hero video { max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .gallery-container { margin: 20px 0; }
        .gallery-main { margin-bottom: 12px; text-align: center; position: relative; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
        .gallery-main video, .gallery-main img { max-width: 100%; height: auto; max-height: 500px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); object-fit: contain; pointer-events: none; }
        .gallery-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.45); color: #fff; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 18px; cursor: pointer; z-index: 2; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
        .gallery-nav:hover { background: rgba(0,0,0,0.7); }
        .gallery-nav.prev { left: 8px; }
        .gallery-nav.next { right: 8px; }
        .gallery-counter { text-align: center; font-size: 13px; color: #6b7280; margin-bottom: 8px; font-weight: 500; }
        .gallery-dots { display: flex; gap: 6px; justify-content: center; margin-bottom: 10px; }
        .gallery-dot { width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; transition: all 0.2s; cursor: pointer; }
        .gallery-dot.active { background: #667eea; transform: scale(1.3); }
        .gallery-thumbs { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 4px; }
        .thumb-wrap { position: relative; display: inline-flex; cursor: pointer; border: 2px solid transparent; border-radius: 8px; overflow: hidden; transition: all 0.2s; opacity: 0.7; width: 72px; height: 72px; }
        .thumb-wrap:hover { opacity: 1; border-color: #667eea; transform: scale(1.05); }
        .thumb-wrap.active { opacity: 1; border-color: #667eea; }
        .thumb-media { width: 100%; height: 100%; object-fit: cover; display: block; }
        .play-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #fff; font-size: 16px; background: rgba(0,0,0,0.5); border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; pointer-events: none; }
        .price-variants { margin: 20px 0; }
        .price-variants-title { font-size: 15px; font-weight: 700; color: #374151; margin-bottom: 10px; }
        .price-variants-scroll { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; }
        .price-variants-scroll::-webkit-scrollbar { height: 4px; }
        .price-variants-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
        .price-variant-card { flex: 0 0 auto; min-width: 130px; max-width: 200px; background: #f9fafb; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; scroll-snap-align: start; transition: border-color 0.2s; }
        .price-variant-card:hover { border-color: #667eea; }
        .pv-name { font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pv-price { font-size: 16px; font-weight: 700; color: #10b981; }
        .pv-desc { font-size: 12px; color: #9ca3af; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    "#
}

/// JS commun pour la galerie média (swipe + arrows + counter)
fn media_gallery_js() -> &'static str {
    r#"
        var currentMediaIndex = 0;
        function showMedia(index) {
            if (index < 0 || index >= mediaItems.length) return;
            currentMediaIndex = index;
            var item = mediaItems[index];
            if (!item) return;
            var vid = document.getElementById('main-video');
            var img = document.getElementById('main-image');
            if (item.v) {
                if (vid) { vid.src = item.u; vid.style.display = ''; vid.play(); }
                if (img) img.style.display = 'none';
            } else {
                if (img) { img.src = item.u; img.style.display = ''; }
                if (vid) { vid.style.display = 'none'; vid.pause(); }
            }
            var wraps = document.querySelectorAll('.thumb-wrap');
            for (var i = 0; i < wraps.length; i++) {
                wraps[i].className = wraps[i].className.replace(' active', '');
                if (i === index) wraps[i].className += ' active';
            }
            var dots = document.querySelectorAll('.gallery-dot');
            for (var j = 0; j < dots.length; j++) {
                dots[j].className = dots[j].className.replace(' active', '');
                if (j === index) dots[j].className += ' active';
            }
            var counter = document.getElementById('gallery-counter');
            if (counter) counter.textContent = (index + 1) + ' / ' + mediaItems.length;
        }
        function prevMedia() { showMedia(currentMediaIndex > 0 ? currentMediaIndex - 1 : mediaItems.length - 1); }
        function nextMedia() { showMedia(currentMediaIndex < mediaItems.length - 1 ? currentMediaIndex + 1 : 0); }
        // Touch swipe support
        (function() {
            var gm = document.querySelector('.gallery-main');
            if (!gm) return;
            var startX = 0, startY = 0, distX = 0, swiping = false;
            gm.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; swiping = true; distX = 0; }, {passive: true});
            gm.addEventListener('touchmove', function(e) { if (!swiping) return; distX = e.touches[0].clientX - startX; var distY = e.touches[0].clientY - startY; if (Math.abs(distY) > Math.abs(distX)) { swiping = false; } }, {passive: true});
            gm.addEventListener('touchend', function() { if (!swiping) return; swiping = false; if (Math.abs(distX) > 40) { if (distX < 0) nextMedia(); else prevMedia(); } });
        })();
    "#
}

/// ✅ NOUVEAU 2026-03-11: Extraire les prix_variation en texte pour og:description
/// Ex: "Taille S: 3000 XAF | M: 5000 XAF | L: 7000 XAF"
fn extract_price_variants_text(product_data: &Value) -> String {
    let variation_val = product_data
        .get("variation_prix")
        .or_else(|| product_data.get("variabilite_prix"))
        .or_else(|| product_data.get("price_variant"));

    let variation_val = match variation_val {
        Some(v) => v,
        None => return String::new(),
    };

    // Dé-wrapper récursivement
    let mut unwrapped = variation_val;
    for _ in 0..5 {
        if let Some(obj) = unwrapped.as_object() {
            if obj.contains_key("modalites") {
                break;
            }
            if let Some(inner) = obj.get("valeur") {
                if inner.is_object() || inner.is_array() {
                    unwrapped = inner;
                    continue;
                }
            }
        }
        break;
    }

    let modalites = if let Some(arr) = unwrapped.as_array() {
        arr.clone()
    } else if let Some(obj) = unwrapped.as_object() {
        obj.get("modalites").and_then(|m| m.as_array()).cloned().unwrap_or_default()
    } else {
        return String::new();
    };

    if modalites.is_empty() {
        return String::new();
    }

    let parts: Vec<String> = modalites
        .iter()
        .filter_map(|m| {
            let obj = m.as_object()?;
            let name = obj.get("valeur").or_else(|| obj.get("value")).and_then(|v| v.as_str())?;
            let price = obj.get("prix").or_else(|| obj.get("price")).and_then(|v| {
                if let Some(n) = v.as_f64() {
                    Some(n)
                } else if let Some(s) = v.as_str() {
                    s.parse::<f64>().ok()
                } else {
                    None
                }
            });
            let devise = obj
                .get("devise")
                .or_else(|| obj.get("currency"))
                .and_then(|v| v.as_str())
                .unwrap_or("XAF");
            match price {
                Some(p) => Some(format!("{}: {} {}", name, p as i64, devise)),
                None => Some(name.to_string()),
            }
        })
        .collect();

    parts.join(" | ")
}

/// ✅ NOUVEAU 2026-03-11: Extraire et rendre les prix_variation depuis product_data
/// Formats supportés (comme ProductCard mobile):
///   1. { origine_champs, valeur: { variable, modalites: [...] }, type_donnee }
///   2. { valeur: { variable, modalites: [...] } }
///   3. { variable, modalites: [...] }
///   4. [ { valeur, prix }, ... ]
fn build_price_variants_html(product_data: &Value) -> String {
    // Chercher dans les clés possibles
    let variation_val = product_data
        .get("variation_prix")
        .or_else(|| product_data.get("variabilite_prix"))
        .or_else(|| product_data.get("price_variant"));

    let variation_val = match variation_val {
        Some(v) => v,
        None => return String::new(),
    };

    // Dé-wrapper récursivement les couches { valeur: ... } jusqu'au contenu réel
    let mut unwrapped = variation_val;
    for _ in 0..5 {
        if let Some(obj) = unwrapped.as_object() {
            // S'arrêter si on a déjà les modalites
            if obj.contains_key("modalites") {
                break;
            }
            if let Some(inner) = obj.get("valeur") {
                if inner.is_object() || inner.is_array() {
                    unwrapped = inner;
                    continue;
                }
            }
        }
        break;
    }

    // Extraire la variable (dimension) et les modalités
    let variable = unwrapped
        .as_object()
        .and_then(|o| o.get("variable"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let modalites = if let Some(arr) = unwrapped.as_array() {
        // Format tableau direct: [{ valeur, prix }, ...]
        arr.clone()
    } else if let Some(obj) = unwrapped.as_object() {
        obj.get("modalites").and_then(|m| m.as_array()).cloned().unwrap_or_default()
    } else {
        return String::new();
    };

    if modalites.is_empty() {
        return String::new();
    }

    let title = if variable.is_empty() {
        "Variations de prix".to_string()
    } else {
        format!("Prix par {}", variable)
    };

    let cards: String = modalites
        .iter()
        .filter_map(|m| {
            let obj = m.as_object()?;
            let name = obj
                .get("valeur")
                .or_else(|| obj.get("value"))
                .and_then(|v| v.as_str())
                .unwrap_or("—");
            let price = obj.get("prix").or_else(|| obj.get("price")).and_then(|v| {
                if let Some(n) = v.as_f64() {
                    Some(n)
                } else if let Some(s) = v.as_str() {
                    s.parse::<f64>().ok()
                } else {
                    None
                }
            });
            let desc = obj.get("description").and_then(|v| v.as_str()).unwrap_or("");
            let devise = obj
                .get("devise")
                .or_else(|| obj.get("currency"))
                .and_then(|v| v.as_str())
                .unwrap_or("XAF");

            let price_html = match price {
                Some(p) => format!(
                    r#"<div class="pv-price">{} {}</div>"#,
                    p as i64,
                    html_attr_escape(devise)
                ),
                None => String::new(),
            };
            let desc_html = if desc.is_empty() {
                String::new()
            } else {
                format!(r#"<div class="pv-desc">{}</div>"#, html_attr_escape(desc))
            };
            Some(format!(
                r#"<div class="price-variant-card"><div class="pv-name">{}</div>{}{}</div>"#,
                html_attr_escape(name),
                price_html,
                desc_html
            ))
        })
        .collect::<Vec<_>>()
        .join("\n            ");

    if cards.is_empty() {
        return String::new();
    }

    format!(
        r#"<div class="price-variants"><div class="price-variants-title">{}</div><div class="price-variants-scroll">{}</div></div>"#,
        html_attr_escape(&title),
        cards
    )
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
    // ✅ CORRIGÉ 2026-03-04: Ne plus exiger serviceId — le dériver du product_id path ou de la DB
    // Le mobile envoie ?serviceId=X (camelCase), mais l'ancien struct attendait ?service_id=X (snake_case)
    // De plus, certains liens de partage n'incluent pas serviceId du tout

    // Récupérer le User-Agent
    let user_agent = headers.get("user-agent").and_then(|h| h.to_str().ok()).unwrap_or("");
    let is_mobile = is_mobile_user_agent(user_agent);

    // Parser product_id (format: service_id_product_index ou juste product_index)
    let (parsed_service_id, product_index) = if let Some(underscore_pos) = product_id.find('_') {
        let service_id_str = &product_id[..underscore_pos];
        let index_str = &product_id[underscore_pos + 1..];
        (
            service_id_str.parse::<i32>().ok(),
            index_str.parse::<i32>().ok(),
        )
    } else {
        (None, product_id.parse::<i32>().ok())
    };

    // ✅ CORRIGÉ 2026-03-04: Résoudre service_id depuis 3 sources (priorité décroissante)
    // 1. Query param ?serviceId=X
    // 2. Extrait du path /product/serviceId_productIndex
    // 3. Lookup dans la DB via service_products.product_index
    let service_id = if let Some(sid) = params.service_id.or(parsed_service_id) {
        sid
    } else if let Some(pidx) = product_index {
        // Chercher le service_id dans la base de données
        sqlx::query_scalar::<_, i32>(
            "SELECT service_id FROM service_products WHERE product_index = $1 AND is_active = true LIMIT 1"
        )
        .bind(pidx)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten()
        .ok_or_else(|| {
            AppError::NotFound(format!("Produit non trouvé pour product_id: {}", product_id))
        })?
    } else {
        return Err(AppError::BadRequest(
            "Impossible de déterminer le service: utilisez /product/serviceId_productIndex ou ?serviceId=X".to_string()
        ));
    };

    log::info!(
        "🔗 [share_product_redirect] product_id={}, service_id={}, mobile={}, UA={}",
        product_id,
        service_id,
        is_mobile,
        &user_agent[..user_agent.len().min(80)]
    );

    // Récupérer les informations du produit
    let products_service = &state.products_service;

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

    // ✅ OPTIMISÉ 2026-03-11: URLs pré-signées longue durée pour les crawlers sociaux
    let video_expiry_seconds: u64 = 30 * 24 * 3600; // 30 jours
    let image_expiry_seconds: u64 = 7 * 24 * 3600; // 7 jours

    // ✅ FIX 2026-03-11: Requête SQL DÉFENSIVE — requête simple d'abord (colonnes de base),
    // puis requête enrichie si les colonnes existent. Évite les échecs silencieux
    // quand product_index/is_main_image/display_order n'existent pas dans l'ancienne table media.
    let query_media_paths = |pool: &sqlx::PgPool,
                             sid: i32,
                             pidx: i32,
                             media_type_filter: &str,
                             limit: i32| {
        let media_type_filter = media_type_filter.to_string();
        let pool = pool.clone();
        async move {
            // Requête enrichie (avec product_index, is_main_image, display_order)
            let enriched_result = sqlx::query_scalar::<_, Option<String>>(&format!(
                r#"SELECT path FROM media
                    WHERE service_id = $1
                    AND (product_index = $2 OR product_index IS NULL)
                    AND (type = '{}' OR media_type = '{}')
                    ORDER BY CASE WHEN product_index = $2 THEN 0 ELSE 1 END,
                        COALESCE(is_main_image, FALSE) DESC,
                        COALESCE(display_order, 0) ASC, id ASC
                    LIMIT {}"#,
                media_type_filter, media_type_filter, limit
            ))
            .bind(sid)
            .bind(pidx)
            .fetch_all(&pool)
            .await;

            match enriched_result {
                Ok(rows) => {
                    let paths: Vec<String> = rows.into_iter().flatten().collect();
                    log::info!(
                        "🖼️ [share] SQL enrichie OK: {} {} pour service={} product_index={}",
                        paths.len(),
                        media_type_filter,
                        sid,
                        pidx
                    );
                    paths
                }
                Err(e) => {
                    log::warn!(
                        "⚠️ [share] SQL enrichie échouée (colonnes manquantes?): {} — fallback simple",
                        e
                    );
                    // Fallback: requête simple sans colonnes potentiellement manquantes
                    match sqlx::query_scalar::<_, Option<String>>(
                        &format!(
                            "SELECT path FROM media WHERE service_id = $1 AND type = '{}' ORDER BY id ASC LIMIT {}",
                            media_type_filter, limit
                        ),
                    )
                    .bind(sid)
                    .fetch_all(&pool)
                    .await
                    {
                        Ok(rows) => {
                            let paths: Vec<String> = rows.into_iter().flatten().collect();
                            log::info!(
                                "🖼️ [share] SQL simple OK: {} {} pour service={}",
                                paths.len(), media_type_filter, sid
                            );
                            paths
                        }
                        Err(e2) => {
                            log::error!("❌ [share] SQL simple aussi échouée: {}", e2);
                            Vec::new()
                        }
                    }
                }
            }
        }
    };

    let (product_image_paths, product_video_paths) = tokio::join!(
        query_media_paths(&state.pg, final_service_id, final_product_index, "image", 6),
        query_media_paths(&state.pg, final_service_id, final_product_index, "video", 3)
    );

    // ✅ FIX 2026-03-11: Extraire images/vidéos depuis product_data — PLUS ROBUSTE
    // Gère les formats: tableau direct, {valeur: [...]}, {type_donnee: ..., valeur: [...]}, string unique
    let extract_media_paths = |keys: &[&str]| -> Vec<String> {
        let obj = match product_data.as_object() {
            Some(o) => o,
            None => return Vec::new(),
        };
        let mut paths = Vec::new();
        for key in keys {
            let val = match obj.get(*key) {
                Some(v) => v,
                None => continue,
            };
            // Format: ["path1", "path2"]
            if let Some(arr) = val.as_array() {
                for item in arr {
                    if let Some(s) = item.as_str() {
                        if !s.is_empty() && !s.starts_with("data:") {
                            paths.push(s.to_string());
                        }
                    }
                }
            }
            // Format: {valeur: ["path1", ...]} ou {type_donnee: ..., valeur: ["path1", ...]}
            else if let Some(inner_obj) = val.as_object() {
                if let Some(valeur) = inner_obj.get("valeur") {
                    if let Some(arr) = valeur.as_array() {
                        for item in arr {
                            if let Some(s) = item.as_str() {
                                if !s.is_empty() && !s.starts_with("data:") {
                                    paths.push(s.to_string());
                                }
                            }
                        }
                    } else if let Some(s) = valeur.as_str() {
                        if !s.is_empty() && !s.starts_with("data:") {
                            paths.push(s.to_string());
                        }
                    }
                }
            }
            // Format: "path_unique"
            else if let Some(s) = val.as_str() {
                if !s.is_empty() && !s.starts_with("data:") {
                    paths.push(s.to_string());
                }
            }
        }
        paths
    };

    // Fusionner chemins uniques (DB prioritaire, puis product_data)
    let mut all_image_paths = product_image_paths;
    for img in extract_media_paths(&[
        "images",
        "image",
        "photos",
        "photo",
        "image_produit",
        "images_produit",
    ]) {
        if !img.is_empty() && !all_image_paths.contains(&img) {
            all_image_paths.push(img);
        }
    }
    let mut all_video_paths = product_video_paths;
    for vid in extract_media_paths(&["videos", "video", "video_produit", "videos_produit"]) {
        if !vid.is_empty() && !all_video_paths.contains(&vid) {
            all_video_paths.push(vid);
        }
    }

    log::info!(
        "📊 [share] Avant presign: {} images + {} vidéos (service={}, product_index={})",
        all_image_paths.len(),
        all_video_paths.len(),
        final_service_id,
        final_product_index
    );
    if all_image_paths.is_empty() && all_video_paths.is_empty() {
        log::warn!(
            "⚠️ [share] AUCUN média trouvé pour service={} product_index={}! product_data keys: {:?}",
            final_service_id, final_product_index,
            product_data.as_object().map(|o| o.keys().collect::<Vec<_>>())
        );
    }

    // ✅ OPTIMISÉ 2026-03-11: Résoudre TOUTES les URLs pré-signées EN PARALLÈLE
    // Avant: séquentiel → chaque generate_presigned_url = ~100-500ms → 10 fichiers = 1-5s
    // Après: parallèle → 10 fichiers = ~100-500ms total (vitesse d'UN seul appel S3)
    let (all_product_images, all_product_videos) = tokio::join!(
        join_all(all_image_paths.iter().map(|path| {
            let ms = &state.media_storage;
            let exp = image_expiry_seconds;
            async move {
                if path.starts_with("http://") || path.starts_with("https://") {
                    path.clone()
                } else if ms.is_remote() {
                    match ms.generate_presigned_url(path, exp).await {
                        Ok(presigned) => presigned,
                        Err(e) => {
                            log::warn!(
                                "⚠️ [share_product] Échec presigned image '{}': {}",
                                path,
                                e
                            );
                            ms.build_public_url(path)
                        }
                    }
                } else {
                    ms.build_public_url(path)
                }
            }
        })),
        join_all(all_video_paths.iter().map(|path| {
            let ms = &state.media_storage;
            let exp = video_expiry_seconds;
            async move {
                if path.starts_with("http://") || path.starts_with("https://") {
                    path.clone()
                } else if ms.is_remote() {
                    match ms.generate_presigned_url(path, exp).await {
                        Ok(presigned) => presigned,
                        Err(e) => {
                            log::warn!(
                                "⚠️ [share_product] Échec presigned vidéo '{}': {}",
                                path,
                                e
                            );
                            ms.build_public_url(path)
                        }
                    }
                } else {
                    ms.build_public_url(path)
                }
            }
        }))
    );

    log::info!(
        "🖼️ [share_product_redirect] {} vidéos + {} images pour produit {} (parallèle)",
        all_product_videos.len(),
        all_product_images.len(),
        product_id
    );

    // ✅ CORRIGÉ 2026-02-27: Utiliser SHARE_BASE_URL (URL du backend) au lieu de PUBLIC_BASE_URL (bucket GCS)
    let share_base_url = std::env::var("SHARE_BASE_URL")
        .or_else(|_| std::env::var("BACKEND_URL"))
        .unwrap_or_else(|_| "https://yukpo-backend-376093909298.europe-west1.run.app".to_string());

    // ✅ AMÉLIORÉ 2026-03-11: Image OG enrichie avec nom + prix + variations de prix (PNG)
    // Si le produit a une photo → on l'utilise comme og:image principale
    // Sinon → on utilise l'endpoint /api/og-product-image/:id qui génère un PNG dynamique
    // avec nom du produit, prix, et variations de prix visibles dans l'aperçu WhatsApp/Facebook
    let og_product_image_url = format!(
        "{}/api/og-product-image/{}?serviceId={}",
        &share_base_url, product_id, service_id
    );
    let og_image_url: Option<String> =
        Some(all_product_images.first().cloned().unwrap_or(og_product_image_url.clone()));
    let display_image_url = all_product_images.first().cloned().unwrap_or_else(|| {
        format!(
            "{}/api/og-placeholder?name={}",
            &share_base_url,
            urlencoding::encode(product_name)
        )
    });

    // ✅ Construire la galerie HTML avec vidéos + images (vidéos EN PREMIER)
    let (media_gallery_html, media_js_array, first_video_url) =
        build_media_gallery(&all_product_videos, &all_product_images, product_name);

    let share_url = format!(
        "{}/product/{}?serviceId={}",
        &share_base_url, product_id, service_id
    );

    // Description enrichie
    let raw_description = product_data
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
        .take(180)
        .collect::<String>();

    let price_amount =
        product.product_price.as_ref().and_then(|p| p.to_string().parse::<f64>().ok());
    let price_currency = "XAF";

    // ✅ AMÉLIORÉ 2026-03-11: og:description enrichie avec prix + variations de prix
    // WhatsApp/Facebook affichent ~200 caractères de description dans l'aperçu du lien
    let price_variants_text = extract_price_variants_text(product_data);
    let product_description = {
        let mut desc = raw_description.clone();
        if let Some(price) = price_amount {
            desc = format!("{} — Prix: {} {}", desc, price as i64, price_currency);
        }
        if !price_variants_text.is_empty() {
            // Ajouter les variations en respectant la limite ~300 chars pour og:description
            let remaining = 300_usize.saturating_sub(desc.chars().count());
            if remaining > 20 {
                let variants_truncated: String =
                    price_variants_text.chars().take(remaining.saturating_sub(3)).collect();
                desc = format!("{} | {}", desc, variants_truncated);
            }
        }
        desc
    };

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
    // ✅ CORRIGÉ 2026-03-08: Échapper TOUS les textes et URLs dans les attributs HTML
    // CRITIQUE: Les URLs pré-signées contiennent & qui tronque og:image pour les crawlers sociaux
    let escaped_product_name = html_attr_escape(product_name);
    let escaped_product_description = html_attr_escape(&product_description);
    html.push_str(&escaped_product_name);
    html.push_str(
        r#" - Yukpomnang</title>
    <meta name="description" content=""#,
    );
    html.push_str(&escaped_product_description);
    html.push_str(
        r#"" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content=""#,
    );
    html.push_str(&escaped_product_name);
    html.push_str(
        r#"" />
    <meta property="og:description" content=""#,
    );
    html.push_str(&escaped_product_description);
    html.push_str(r#"" />"#);
    // ✅ CORRIGÉ 2026-03-03: og:image uniquement si une vraie image existe (pas SVG placeholder)
    // ✅ CORRIGÉ 2026-03-08: html_attr_escape pour que & devienne &amp; dans les URLs pré-signées
    if let Some(ref og_img) = og_image_url {
        let escaped_og_img = html_attr_escape(og_img);
        html.push_str("\n    <meta property=\"og:image\" content=\"");
        html.push_str(&escaped_og_img);
        html.push_str("\" />\n    <meta property=\"og:image:width\" content=\"1200\" />\n    <meta property=\"og:image:height\" content=\"630\" />\n    <meta property=\"og:image:alt\" content=\"");
        html.push_str(&escaped_product_name);
        html.push_str("\" />");
    }
    // ✅ AJOUTÉ: og:video pour les crawlers sociaux (WhatsApp, Facebook, Twitter)
    if let Some(ref vid_url) = first_video_url {
        let escaped_vid_url = html_attr_escape(vid_url);
        html.push_str("\n    <meta property=\"og:video\" content=\"");
        html.push_str(&escaped_vid_url);
        html.push_str("\" />\n    <meta property=\"og:video:type\" content=\"video/mp4\" />\n    <meta property=\"og:video:width\" content=\"1280\" />\n    <meta property=\"og:video:height\" content=\"720\" />");
    }
    html.push_str(
        r#"
    <meta property="og:url" content=""#,
    );
    html.push_str(&html_attr_escape(&share_url));
    html.push_str(
        r#"" />
    <meta property="og:site_name" content="Yukpomnang" />
    <meta property="og:locale" content="fr_FR" />
    "#,
    );
    html.push_str(&price_og_html);
    html.push_str("\n    <meta name=\"twitter:card\" content=\"summary_large_image\" />\n    <meta name=\"twitter:title\" content=\"");
    html.push_str(&escaped_product_name);
    html.push_str("\" />\n    <meta name=\"twitter:description\" content=\"");
    html.push_str(&escaped_product_description);
    html.push_str("\" />");
    if let Some(ref og_img) = og_image_url {
        let escaped_og_img = html_attr_escape(og_img);
        html.push_str("\n    <meta name=\"twitter:image\" content=\"");
        html.push_str(&escaped_og_img);
        html.push_str("\" />\n    <meta name=\"twitter:image:alt\" content=\"");
        html.push_str(&escaped_product_name);
        html.push_str("\" />");
    }
    html.push_str("\n    <meta name=\"twitter:site\" content=\"@yukpomnang\" />");
    html.push_str(
        r#"
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": ""#,
    );
    // ✅ CORRIGÉ 2026-03-08: Échapper les guillemets dans JSON-LD
    html.push_str(&product_name.replace('\\', "\\\\").replace('"', "\\\""));
    html.push_str(
        r#"",
        "description": ""#,
    );
    html.push_str(&product_description.replace('\\', "\\\\").replace('"', "\\\""));
    html.push_str(
        r#"",
        "image": ""#,
    );
    html.push_str(&display_image_url.replace('\\', "\\\\").replace('"', "\\\""));
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
            margin: 0; padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container {
            background: white; border-radius: 16px; padding: 32px;
            max-width: 600px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            margin: 20px;
            text-align: left;
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
        .store-badges { display: flex; gap: 12px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }
        .store-badge { height: 40px; }"#);
    html.push_str(media_gallery_css());
    html.push_str(
        r#"
    </style>
</head>
<body>
    <div class="container">
        <h1>"#,
    );
    html.push_str(&escaped_product_name);
    html.push_str(
        r#"</h1>
        "#,
    );
    html.push_str(&price_html);
    html.push_str(&media_gallery_html);
    // ✅ NOUVEAU 2026-03-11: Afficher les variations de prix (scrollables horizontalement)
    let price_variants_html = build_price_variants_html(product_data);
    html.push_str(&price_variants_html);
    html.push_str(
        r#"
        <div class="description">"#,
    );
    html.push_str(&escaped_product_description);
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
    html.push_str("        var mediaItems = ");
    html.push_str(&media_js_array);
    html.push_str(";");
    html.push_str(media_gallery_js());
    html.push_str(
        r#"
        // Détection plateforme
        var ua = navigator.userAgent || '';
        var isAndroid = /Android/i.test(ua);
        var isIOS = /iPhone|iPad|iPod/i.test(ua);
        var isMobile = isAndroid || isIOS;

        // Configurer le bouton "Ouvrir dans l'app"
        var openBtn = document.getElementById('open-app-btn');
        if (openBtn) {
            if (isAndroid) {
                openBtn.href = INTENT_URL;
            } else if (isIOS) {
                openBtn.href = DEEP_LINK;
                openBtn.onclick = function() {
                    setTimeout(function() { window.location.href = APP_STORE; }, 1500);
                };
            } else {
                openBtn.style.display = 'none';
            }
        }

        if (isMobile) {
            setTimeout(function() {
                if (isAndroid) {
                    window.location.href = INTENT_URL;
                } else if (isIOS) {
                    window.location.href = DEEP_LINK;
                    setTimeout(function() { window.location.href = APP_STORE; }, 1500);
                }
            }, 800);
        }
    </script>
</body>
</html>"#,
    );

    log::info!(
        "🌐 [share_product_redirect] Page HTML générée: product={}, images={}, mobile={}",
        product_id,
        all_product_images.len(),
        is_mobile
    );

    Ok(Html(html).into_response())
}

/// GET /service/:service_id
/// Route publique pour le partage intelligent de services
/// Détecte le User-Agent et redirige vers l'app si mobile, ou affiche la page web si desktop
pub async fn share_service_redirect(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<axum::response::Response> {
    let user_agent = headers.get("user-agent").and_then(|h| h.to_str().ok()).unwrap_or("");
    let is_mobile = is_mobile_user_agent(user_agent);

    log::info!(
        "🔗 [share_service_redirect] service_id={}, mobile={}, UA={}",
        service_id,
        is_mobile,
        &user_agent[..user_agent.len().min(80)]
    );

    // ✅ CORRIGÉ 2026-03-04: Retirer les colonnes inexistantes (titre, description, categorie, prix, devise)
    // Ces informations sont stockées dans la colonne JSON 'data', pas comme colonnes séparées
    let service_row = sqlx::query(
        r#"SELECT id, data, user_id, category
           FROM services WHERE id = $1"#,
    )
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur DB service: {}", e)))?
    .ok_or_else(|| AppError::NotFound(format!("Service {} non trouvé", service_id)))?;

    // ✅ CORRIGÉ 2026-03-04: Extraire toutes les infos depuis la colonne JSON 'data'
    // Les colonnes titre, description, prix, devise n'existent PAS dans la table services
    let service_data: Value =
        service_row.get::<Option<Value>, _>("data").unwrap_or(serde_json::json!({}));

    let service_titre: String = service_data
        .get("titre_service")
        .and_then(|v| v.get("valeur").and_then(|v2| v2.as_str()).or(v.as_str()))
        .or_else(|| service_data.get("titre").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Service Yukpomnang".to_string());

    let raw_service_description: String = service_data
        .get("description")
        .and_then(|v| v.get("valeur").and_then(|v2| v2.as_str()).or(v.as_str()))
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Découvrez ce service sur Yukpomnang".to_string())
        .chars()
        .take(180)
        .collect::<String>();

    let service_prix: Option<String> = service_data.get("prix").and_then(|v| {
        // Cas 1: {valeur: "5000"} ou {valeur: 5000}
        if let Some(inner) = v.get("valeur") {
            inner
                .as_str()
                .map(|s| s.to_string())
                .or_else(|| inner.as_f64().map(|f| format!("{}", f as i64)))
                .or_else(|| inner.as_i64().map(|i| i.to_string()))
        }
        // Cas 2: "5000"
        else if let Some(s) = v.as_str() {
            Some(s.to_string())
        }
        // Cas 3: 5000 (nombre direct)
        else if let Some(f) = v.as_f64() {
            Some(format!("{}", f as i64))
        } else {
            None
        }
    });

    let service_devise: String = service_data
        .get("devise")
        .and_then(|v| v.get("valeur").and_then(|v2| v2.as_str()).or(v.as_str()))
        .map(|s| s.to_string())
        .unwrap_or_else(|| "XAF".to_string());

    // ✅ CORRIGÉ: og:description inclut le prix pour que les previews sociales l'affichent
    let service_description = if let Some(ref prix) = service_prix {
        format!(
            "{} — Prix: {} {}",
            raw_service_description, prix, service_devise
        )
    } else {
        raw_service_description
    };

    // ✅ FIX 2026-03-11: Requêtes SQL DÉFENSIVES avec fallback (mêmes que share_product_redirect)
    let image_expiry: u64 = 7 * 24 * 3600;
    let video_expiry: u64 = 7 * 24 * 3600;

    let query_service_media = |pool: &sqlx::PgPool,
                               sid: i32,
                               media_type_filter: &str,
                               limit: i32| {
        let media_type_filter = media_type_filter.to_string();
        let pool = pool.clone();
        async move {
            // Requête enrichie (avec is_main_image, display_order, media_type)
            let enriched = sqlx::query_scalar::<_, Option<String>>(
                &format!(
                    r#"SELECT path FROM media
                       WHERE service_id = $1 AND (type = '{}' OR media_type = '{}')
                       ORDER BY COALESCE(is_main_image, FALSE) DESC, COALESCE(display_order, 0) ASC, id ASC
                       LIMIT {}"#,
                    media_type_filter, media_type_filter, limit
                ),
            )
            .bind(sid)
            .fetch_all(&pool)
            .await;

            match enriched {
                Ok(rows) => {
                    let paths: Vec<String> = rows.into_iter().flatten().collect();
                    log::info!(
                        "🖼️ [share_service] SQL enrichie: {} {} pour service={}",
                        paths.len(),
                        media_type_filter,
                        sid
                    );
                    paths
                }
                Err(e) => {
                    log::warn!("⚠️ [share_service] SQL enrichie échouée: {} — fallback", e);
                    match sqlx::query_scalar::<_, Option<String>>(
                        &format!(
                            "SELECT path FROM media WHERE service_id = $1 AND type = '{}' ORDER BY id ASC LIMIT {}",
                            media_type_filter, limit
                        ),
                    )
                    .bind(sid)
                    .fetch_all(&pool)
                    .await
                    {
                        Ok(rows) => rows.into_iter().flatten().collect(),
                        Err(e2) => {
                            log::error!("❌ [share_service] SQL simple échouée: {}", e2);
                            Vec::new()
                        }
                    }
                }
            }
        }
    };

    let (service_image_paths, service_video_paths) = tokio::join!(
        query_service_media(&state.pg, service_id, "image", 6),
        query_service_media(&state.pg, service_id, "video", 3)
    );

    // Collecter les chemins images (DB + fallback depuis service_data si DB vide)
    let mut all_image_paths = service_image_paths;
    if all_image_paths.is_empty() {
        let extract_paths = |val: Option<&Value>| -> Vec<String> {
            match val {
                Some(v) if v.is_array() => v
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect(),
                Some(v) if v.is_object() => v
                    .get("valeur")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
                    })
                    .unwrap_or_default(),
                Some(v) if v.is_string() => vec![v.as_str().unwrap().to_string()],
                _ => Vec::new(),
            }
        };
        all_image_paths.extend(extract_paths(service_data.get("images")));
        all_image_paths.extend(extract_paths(service_data.get("logo")));
        all_image_paths.extend(extract_paths(service_data.get("banniere")));
        all_image_paths.extend(extract_paths(service_data.get("banner")));
        all_image_paths.extend(extract_paths(service_data.get("images_realisations")));
        if let Some(produits) = service_data.get("produits") {
            let produits_arr = if produits.is_array() {
                produits.as_array().cloned()
            } else if let Some(inner) = produits.get("valeur").and_then(|v| v.as_array()) {
                Some(inner.clone())
            } else {
                None
            };
            if let Some(arr) = produits_arr {
                for prod in &arr {
                    all_image_paths.extend(extract_paths(prod.get("images")));
                }
            }
        }
        // Dédupliquer et limiter
        all_image_paths.dedup();
        all_image_paths.truncate(6);
    }

    // Collecter les chemins vidéos (DB + fallback depuis service_data si DB vide)
    let mut all_video_paths = service_video_paths;
    if all_video_paths.is_empty() {
        let extract_paths = |val: Option<&Value>| -> Vec<String> {
            match val {
                Some(v) if v.is_array() => v
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect(),
                Some(v) if v.is_object() => v
                    .get("valeur")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
                    })
                    .unwrap_or_default(),
                Some(v) if v.is_string() => vec![v.as_str().unwrap().to_string()],
                _ => Vec::new(),
            }
        };
        let mut video_fallback = extract_paths(service_data.get("videos"));
        if let Some(produits) = service_data.get("produits") {
            let produits_arr = if produits.is_array() {
                produits.as_array().cloned()
            } else if let Some(inner) = produits.get("valeur").and_then(|v| v.as_array()) {
                Some(inner.clone())
            } else {
                None
            };
            if let Some(arr) = produits_arr {
                for prod in &arr {
                    video_fallback.extend(extract_paths(prod.get("videos")));
                }
            }
        }
        for vid in video_fallback {
            if !vid.is_empty() && !all_video_paths.contains(&vid) {
                all_video_paths.push(vid);
            }
        }
        all_video_paths.truncate(3);
    }

    // ✅ OPTIMISÉ 2026-03-11: Résoudre TOUTES les URLs pré-signées EN PARALLÈLE
    let (all_service_images, all_service_videos) = tokio::join!(
        join_all(all_image_paths.iter().map(|path| {
            let ms = &state.media_storage;
            let exp = image_expiry;
            async move {
                if path.starts_with("http://") || path.starts_with("https://") {
                    path.clone()
                } else if ms.is_remote() {
                    match ms.generate_presigned_url(path, exp).await {
                        Ok(presigned) => presigned,
                        Err(e) => {
                            log::warn!(
                                "⚠️ [share_service] Échec presigned image '{}': {}",
                                path,
                                e
                            );
                            ms.build_public_url(path)
                        }
                    }
                } else {
                    ms.build_public_url(path)
                }
            }
        })),
        join_all(all_video_paths.iter().map(|path| {
            let ms = &state.media_storage;
            let exp = video_expiry;
            async move {
                if path.starts_with("http://") || path.starts_with("https://") {
                    path.clone()
                } else if ms.is_remote() {
                    match ms.generate_presigned_url(path, exp).await {
                        Ok(presigned) => presigned,
                        Err(e) => {
                            log::warn!(
                                "⚠️ [share_service] Échec presigned vidéo '{}': {}",
                                path,
                                e
                            );
                            ms.build_public_url(path)
                        }
                    }
                } else {
                    ms.build_public_url(path)
                }
            }
        }))
    );

    log::info!(
        "🖼️ [share_service_redirect] {} vidéos + {} images pour service {} (parallèle)",
        all_service_videos.len(),
        all_service_images.len(),
        service_id
    );

    let share_base_url = std::env::var("SHARE_BASE_URL")
        .or_else(|_| std::env::var("BACKEND_URL"))
        .unwrap_or_else(|_| "https://yukpo-backend-376093909298.europe-west1.run.app".to_string());

    // ✅ CORRIGÉ: og:image uniquement si une vraie image existe (pas SVG placeholder)
    let og_image_url: Option<String> = all_service_images.first().cloned();
    let _display_image_url = all_service_images.first().cloned().unwrap_or_else(|| {
        format!(
            "{}/api/og-placeholder?name={}",
            &share_base_url,
            urlencoding::encode(&service_titre)
        )
    });
    let share_url = format!("{}/service/{}", &share_base_url, service_id);
    let deep_link = format!("yukpomnang://service/{}", service_id);
    let android_intent_url = format!(
        "intent://service/{}#Intent;scheme=yukpomnang;package=com.yukpomnang.mobile;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.yukpomnang.mobile;end",
        service_id
    );

    let price_html = service_prix
        .as_ref()
        .map(|p| format!(r#"<div class="price">{} {}</div>"#, p, service_devise))
        .unwrap_or_default();

    // ✅ Construire la galerie HTML avec vidéos + images (vidéos EN PREMIER)
    let (media_gallery_html, media_js_array, first_video_url) =
        build_media_gallery(&all_service_videos, &all_service_images, &service_titre);

    // Prix OG meta tags
    let price_og_html = service_prix
        .as_ref()
        .and_then(|p| p.parse::<f64>().ok())
        .map(|p| {
            format!(
                r#"<meta property="product:price:amount" content="{}" />
    <meta property="product:price:currency" content="{}" />"#,
                p, service_devise
            )
        })
        .unwrap_or_default();

    // Construire le HTML
    let mut html = String::with_capacity(8000);
    html.push_str(
        r#"<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>"#,
    );
    // ✅ CORRIGÉ 2026-03-08: Échapper TOUS les textes et URLs dans les attributs HTML
    let escaped_service_titre = html_attr_escape(&service_titre);
    let escaped_service_description = html_attr_escape(&service_description);
    html.push_str(&escaped_service_titre);
    html.push_str(
        r#" - Yukpomnang</title>
    <meta name="description" content=""#,
    );
    html.push_str(&escaped_service_description);
    html.push_str(
        r#"" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content=""#,
    );
    html.push_str(&escaped_service_titre);
    html.push_str(
        r#"" />
    <meta property="og:description" content=""#,
    );
    html.push_str(&escaped_service_description);
    html.push_str("\" />");
    // ✅ CORRIGÉ 2026-03-08: html_attr_escape pour que & devienne &amp; dans les URLs pré-signées
    if let Some(ref og_img) = og_image_url {
        let escaped_og_img = html_attr_escape(og_img);
        html.push_str("\n    <meta property=\"og:image\" content=\"");
        html.push_str(&escaped_og_img);
        html.push_str("\" />\n    <meta property=\"og:image:width\" content=\"1200\" />\n    <meta property=\"og:image:height\" content=\"630\" />\n    <meta property=\"og:image:alt\" content=\"");
        html.push_str(&escaped_service_titre);
        html.push_str("\" />");
    }
    // ✅ AJOUTÉ: og:video pour les crawlers sociaux avec meta tags enrichis (services)
    if let Some(ref vid_url) = first_video_url {
        let escaped_vid_url = html_attr_escape(vid_url);
        html.push_str("\n    <meta property=\"og:video\" content=\"");
        html.push_str(&escaped_vid_url);
        html.push_str("\" />\n    <meta property=\"og:video:type\" content=\"video/mp4\" />\n    <meta property=\"og:video:width\" content=\"1280\" />\n    <meta property=\"og:video:height\" content=\"720\" />");

        // ✅ AJOUTÉ: Meta tags supplémentaires pour Facebook
        html.push_str("\n    <meta property=\"og:video:secure_url\" content=\"");
        html.push_str(&escaped_vid_url);
        html.push_str("\" />\n    <meta property=\"og:video:duration\" content=\"30\" />");

        // ✅ AJOUTÉ: Twitter video player
        html.push_str("\n    <meta name=\"twitter:player\" content=\"");
        html.push_str(&escaped_vid_url);
        html.push_str("\" />\n    <meta name=\"twitter:player:width\" content=\"1280\" />\n    <meta name=\"twitter:player:height\" content=\"720\" />\n    <meta name=\"twitter:stream\" content=\"");
        html.push_str(&escaped_vid_url);
        html.push_str(
            "\" />\n    <meta name=\"twitter:stream:content_type\" content=\"video/mp4\" />",
        );
    }
    html.push_str("\n    <meta property=\"og:url\" content=\"");
    html.push_str(&html_attr_escape(&share_url));
    html.push_str(
        r#"" />
    <meta property="og:site_name" content="Yukpomnang" />
    <meta property="og:locale" content="fr_FR" />
    "#,
    );
    html.push_str(&price_og_html);
    html.push_str("\n    <meta name=\"twitter:card\" content=\"summary_large_image\" />\n    <meta name=\"twitter:title\" content=\"");
    html.push_str(&escaped_service_titre);
    html.push_str("\" />\n    <meta name=\"twitter:description\" content=\"");
    html.push_str(&escaped_service_description);
    html.push_str("\" />");
    if let Some(ref og_img) = og_image_url {
        let escaped_og_img = html_attr_escape(og_img);
        html.push_str("\n    <meta name=\"twitter:image\" content=\"");
        html.push_str(&escaped_og_img);
        html.push_str("\" />\n    <meta name=\"twitter:image:alt\" content=\"");
        html.push_str(&escaped_service_titre);
        html.push_str("\" />");
    }
    html.push_str("\n    <meta name=\"twitter:site\" content=\"@yukpomnang\" />");
    html.push_str("\n    <meta name=\"google-play-app\" content=\"app-id=com.yukpomnang.mobile\">");
    html.push_str("\n    <meta property=\"al:android:url\" content=\"");
    html.push_str(&deep_link);
    html.push_str(r#"" />
    <meta property="al:android:package" content="com.yukpomnang.mobile" />
    <meta property="al:android:app_name" content="Yukpomnang" />
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container {
            background: white; border-radius: 16px; padding: 32px;
            max-width: 600px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            margin: 20px;
            text-align: left;
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
        .button-secondary { background: #10b981; margin-top: 8px; }
        .store-badges { display: flex; gap: 12px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }"#);
    html.push_str(media_gallery_css());
    html.push_str(
        r#"
    </style>
</head>
<body>
    <div class="container">
        <h1>"#,
    );
    html.push_str(&html_attr_escape(&service_titre));
    html.push_str("</h1>\n");
    html.push_str(&price_html);
    html.push_str(&media_gallery_html);
    html.push_str(
        r#"
        <div class="description">"#,
    );
    html.push_str(&html_attr_escape(&service_description));
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
    html.push_str("        var mediaItems = ");
    html.push_str(&media_js_array);
    html.push_str(";");
    html.push_str(media_gallery_js());
    html.push_str(
        r#"
        var ua = navigator.userAgent || '';
        var isAndroid = /Android/i.test(ua);
        var isIOS = /iPhone|iPad|iPod/i.test(ua);
        var isMobile = isAndroid || isIOS;

        var openBtn = document.getElementById('open-app-btn');
        if (openBtn) {
            if (isAndroid) {
                openBtn.href = INTENT_URL;
            } else if (isIOS) {
                openBtn.href = DEEP_LINK;
                openBtn.onclick = function() {
                    setTimeout(function() { window.location.href = APP_STORE; }, 1500);
                };
            } else {
                openBtn.style.display = 'none';
            }
        }

        if (isMobile) {
            setTimeout(function() {
                if (isAndroid) {
                    window.location.href = INTENT_URL;
                } else if (isIOS) {
                    window.location.href = DEEP_LINK;
                    setTimeout(function() { window.location.href = APP_STORE; }, 1500);
                }
            }, 800);
        }
    </script>
</body>
</html>"#,
    );

    log::info!(
        "🌐 [share_service_redirect] Page HTML générée: service={}, vidéos={}, images={}, mobile={}",
        service_id,
        all_service_videos.len(),
        all_service_images.len(),
        is_mobile
    );

    Ok(Html(html).into_response())
}

/// GET /track/:delivery_id
/// Route publique pour le partage de suivi de livraison
/// Affiche une page avec le statut de la livraison et un bouton pour ouvrir l'app
pub async fn share_tracking_redirect(
    Path(delivery_id): Path<String>,
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> AppResult<axum::response::Response> {
    let user_agent = headers.get("user-agent").and_then(|h| h.to_str().ok()).unwrap_or("");
    let is_mobile = is_mobile_user_agent(user_agent);

    log::info!(
        "🔗 [share_tracking_redirect] delivery_id={}, mobile={}, UA={}",
        delivery_id,
        is_mobile,
        &user_agent[..user_agent.len().min(80)]
    );

    // Essayer de récupérer les infos de la livraison
    let delivery_info = sqlx::query(
        r#"SELECT id, status, pickup_address, dropoff_address, metadata
           FROM deliveries WHERE id::text = $1 OR tracking_token = $1
           LIMIT 1"#,
    )
    .bind(&delivery_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let (title, description, status_text) = if let Some(row) = &delivery_info {
        let status: String = row
            .try_get::<Option<String>, _>("status")
            .ok()
            .flatten()
            .unwrap_or_else(|| "en cours".to_string());
        let pickup: String = row
            .try_get::<Option<String>, _>("pickup_address")
            .ok()
            .flatten()
            .unwrap_or_else(|| "Non spécifié".to_string());
        let dropoff: String = row
            .try_get::<Option<String>, _>("dropoff_address")
            .ok()
            .flatten()
            .unwrap_or_else(|| "Non spécifié".to_string());
        (
            format!("Suivi livraison - {}", &status),
            format!("De {} vers {}", pickup, dropoff),
            status,
        )
    } else {
        (
            "Suivi de livraison Yukpomnang".to_string(),
            "Suivez votre livraison en temps réel sur Yukpomnang".to_string(),
            "inconnu".to_string(),
        )
    };

    let share_base_url = std::env::var("SHARE_BASE_URL")
        .or_else(|_| std::env::var("BACKEND_URL"))
        .unwrap_or_else(|_| "https://yukpo-backend-376093909298.europe-west1.run.app".to_string());

    let share_url = format!("{}/track/{}", &share_base_url, delivery_id);
    let deep_link = format!("yukpomnang://track/{}", delivery_id);
    let android_intent_url = format!(
        "intent://track/{}#Intent;scheme=yukpomnang;package=com.yukpomnang.mobile;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.yukpomnang.mobile;end",
        delivery_id
    );

    let status_color = match status_text.as_str() {
        "delivered" | "completed" => "#10b981",
        "cancelled" | "failed" => "#ef4444",
        "in_transit" | "en_route_pickup" | "en_route_dropoff" => "#3b82f6",
        _ => "#f59e0b",
    };

    let mut html = String::with_capacity(3000);
    html.push_str(
        r#"<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>"#,
    );
    html.push_str(&title);
    html.push_str(
        r#" - Yukpomnang</title>
    <meta name="description" content=""#,
    );
    html.push_str(&description);
    html.push_str(
        r#"" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content=""#,
    );
    html.push_str(&title);
    html.push_str(
        r#"" />
    <meta property="og:description" content=""#,
    );
    html.push_str(&description);
    html.push_str(
        r#"" />
    <meta property="og:url" content=""#,
    );
    html.push_str(&share_url);
    html.push_str(
        r#"" />
    <meta property="og:site_name" content="Yukpomnang" />
    <meta name="google-play-app" content="app-id=com.yukpomnang.mobile">
    <meta property="al:android:url" content=""#,
    );
    html.push_str(&deep_link);
    html.push_str(
        r#"" />
    <meta property="al:android:package" content="com.yukpomnang.mobile" />
    <meta property="al:android:app_name" content="Yukpomnang" />
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container {
            background: white; border-radius: 16px; padding: 32px;
            max-width: 600px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            margin: 20px;
            text-align: left;
        }
        h1 { color: #1f2937; margin: 0 0 16px 0; font-size: 24px; }
        .status-badge {
            display: inline-block; padding: 8px 16px; border-radius: 20px;
            font-weight: 600; font-size: 14px; color: white; margin: 12px 0;
        }
        .description { color: #6b7280; line-height: 1.6; margin: 16px 0; }
        .tracking-icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
        .button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; border: none; padding: 16px 32px; border-radius: 8px;
            font-size: 16px; font-weight: 600; cursor: pointer; width: 100%;
            margin-top: 16px; transition: transform 0.2s; display: block; text-align: center;
            text-decoration: none;
        }
        .button:hover { transform: translateY(-2px); }
        .button-secondary { background: #10b981; margin-top: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="tracking-icon">"#,
    );
    html.push_str("\u{1F4E6}");
    html.push_str(
        r#"</div>
        <h1>"#,
    );
    html.push_str(&title);
    html.push_str("</h1>\n");
    html.push_str("        <div class=\"status-badge\" style=\"background: ");
    html.push_str(status_color);
    html.push_str("\">");
    html.push_str(&status_text);
    html.push_str("</div>\n");
    html.push_str(r#"        <div class="description">"#);
    html.push_str(&description);
    html.push_str("</div>\n");
    html.push_str("        <a id=\"open-app-btn\" class=\"button\" href=\"#\">\u{1F4F1} Suivre dans l'app Yukpomnang</a>\n");
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
    html.push_str(
        r#"
        var ua = navigator.userAgent || '';
        var isAndroid = /Android/i.test(ua);
        var isIOS = /iPhone|iPad|iPod/i.test(ua);
        var isMobile = isAndroid || isIOS;

        var openBtn = document.getElementById('open-app-btn');
        if (openBtn) {
            if (isAndroid) {
                openBtn.href = INTENT_URL;
            } else if (isIOS) {
                openBtn.href = DEEP_LINK;
                openBtn.onclick = function() {
                    setTimeout(function() { window.location.href = APP_STORE; }, 1500);
                };
            } else {
                openBtn.style.display = 'none';
            }
        }

        if (isMobile) {
            setTimeout(function() {
                if (isAndroid) {
                    window.location.href = INTENT_URL;
                } else if (isIOS) {
                    window.location.href = DEEP_LINK;
                    setTimeout(function() { window.location.href = APP_STORE; }, 1500);
                }
            }, 800);
        }
    </script>
</body>
</html>"#,
    );

    log::info!(
        "🌐 [share_tracking_redirect] Page HTML générée: delivery={}, status={}, mobile={}",
        delivery_id,
        status_text,
        is_mobile
    );

    Ok(Html(html).into_response())
}

/// Query params pour l'image OG enrichie d'un produit
#[derive(Debug, Deserialize)]
pub struct OgProductImageParams {
    #[serde(alias = "serviceId")]
    pub service_id: Option<i32>,
}

/// GET /api/og-product-image/:product_id?serviceId=:service_id
/// Génère une image PNG dynamique 1200x630 pour og:image
/// Affiche : nom du produit, prix principal, variations de prix, branding Yukpomnang
/// WhatsApp/Facebook/Twitter utilisent cette image dans l'aperçu du lien partagé
pub async fn og_product_image(
    Path(product_id): Path<String>,
    Query(params): Query<OgProductImageParams>,
    State(state): State<Arc<AppState>>,
) -> axum::response::Response {
    // Résoudre service_id et product_index
    let (parsed_service_id, product_index) = if let Some(pos) = product_id.find('_') {
        (
            product_id[..pos].parse::<i32>().ok(),
            product_id[pos + 1..].parse::<i32>().ok(),
        )
    } else {
        (None, product_id.parse::<i32>().ok())
    };
    let service_id = match params.service_id.or(parsed_service_id) {
        Some(sid) => sid,
        None => {
            if let Some(pidx) = product_index {
                sqlx::query_scalar::<_, i32>("SELECT service_id FROM service_products WHERE product_index = $1 AND is_active = true LIMIT 1")
                    .bind(pidx).fetch_optional(&state.pg).await.ok().flatten().unwrap_or(0)
            } else {
                0
            }
        }
    };

    // Récupérer le produit
    let product = state
        .products_service
        .get_product(
            parsed_service_id.unwrap_or(service_id),
            product_index.unwrap_or(0),
        )
        .await
        .ok()
        .flatten();

    let (product_name, price_text, variants_lines) = match product {
        Some(ref p) => {
            let name = p.product_name.clone();
            let price =
                p.product_price.as_ref().map(|pr| format!("{} XAF", pr)).unwrap_or_default();
            let variants_text = extract_price_variants_text(&p.product_data);
            let lines: Vec<String> = if variants_text.is_empty() {
                vec![]
            } else {
                variants_text.split(" | ").map(|s| s.to_string()).collect()
            };
            (name, price, lines)
        }
        None => ("Produit Yukpomnang".to_string(), String::new(), vec![]),
    };

    // Construire le SVG 1200x630
    let svg = build_og_product_svg(&product_name, &price_text, &variants_lines);

    // Convertir SVG → PNG avec resvg
    match render_svg_to_png(&svg) {
        Some(png_data) => axum::response::Response::builder()
            .status(200)
            .header("Content-Type", "image/png")
            .header("Cache-Control", "public, max-age=3600")
            .body(axum::body::Body::from(png_data))
            .unwrap_or_else(|_| {
                axum::response::Response::builder()
                    .status(500)
                    .body(axum::body::Body::empty())
                    .unwrap()
            }),
        None => {
            // Fallback: retourner le SVG brut (mieux que rien)
            log::warn!("[og_product_image] resvg render failed, returning SVG fallback");
            axum::response::Response::builder()
                .status(200)
                .header("Content-Type", "image/svg+xml")
                .header("Cache-Control", "public, max-age=3600")
                .body(axum::body::Body::from(svg))
                .unwrap_or_else(|_| {
                    axum::response::Response::builder()
                        .status(500)
                        .body(axum::body::Body::empty())
                        .unwrap()
                })
        }
    }
}

/// Construit le SVG 1200x630 pour l'image OG d'un produit
fn build_og_product_svg(product_name: &str, price_text: &str, variants: &[String]) -> String {
    let safe = |s: &str| -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
    };

    // Tronquer le nom si trop long
    let display_name: String = if product_name.chars().count() > 50 {
        format!("{}...", product_name.chars().take(47).collect::<String>())
    } else {
        product_name.to_string()
    };

    // Construire les lignes de variants (max 6)
    let mut variant_svg = String::new();
    let variant_start_y: i32 = if price_text.is_empty() { 360 } else { 400 };
    for (i, variant) in variants.iter().take(6).enumerate() {
        let display_var: String = if variant.chars().count() > 35 {
            format!("{}...", variant.chars().take(32).collect::<String>())
        } else {
            variant.clone()
        };
        // Disposer en 2 colonnes si > 3 variants
        let (x, y): (i32, i32) = if variants.len() > 3 {
            let col = (i % 2) as i32;
            let row = (i / 2) as i32;
            (200 + col * 400, variant_start_y + row * 42)
        } else {
            (600, variant_start_y + (i as i32) * 44)
        };
        variant_svg.push_str(&format!(
            r#"  <rect x="{}" y="{}" width="{}" height="34" rx="8" fill="rgba(255,255,255,0.15)"/>
  <text x="{}" y="{}" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="white" text-anchor="{}" opacity="0.95">{}</text>
"#,
            if variants.len() > 3 { x - 150 } else { 200 },
            y - 24,
            if variants.len() > 3 { 360 } else { 800 },
            x,
            y,
            if variants.len() > 3 { "middle" } else { "middle" },
            safe(&display_var)
        ));
    }

    // Prix badge
    let price_svg = if price_text.is_empty() {
        String::new()
    } else {
        let price_w = (price_text.chars().count() as i32) * 16 + 60;
        format!(
            r##"  <rect x="{}" y="310" width="{}" height="50" rx="25" fill="#10b981"/>
  <text x="600" y="343" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="bold" fill="white" text-anchor="middle">{}</text>
"##,
            600 - price_w / 2,
            price_w,
            safe(price_text)
        )
    };

    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="600" y="120" font-family="Arial, Helvetica, sans-serif" font-size="100" font-weight="bold" fill="white" text-anchor="middle" opacity="0.15">Y</text>
  <text x="600" y="240" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">{name}</text>
  <text x="600" y="280" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="white" text-anchor="middle" opacity="0.5">━━━━━━━━━━━━━━━━━━</text>
{price}{variants}  <text x="600" y="590" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="white" text-anchor="middle" opacity="0.4">yukpomnang.com</text>
</svg>"#,
        name = safe(&display_name),
        price = price_svg,
        variants = variant_svg,
    )
}

/// Convertit un SVG en PNG via resvg
fn render_svg_to_png(svg_data: &str) -> Option<Vec<u8>> {
    use resvg::usvg::{self, TreeParsing};

    let opt = usvg::Options::default();
    let utree = usvg::Tree::from_str(svg_data, &opt).ok()?;
    let rtree = resvg::Tree::from_usvg(&utree);
    let size = rtree.size;
    let width = size.width() as u32;
    let height = size.height() as u32;

    let mut pixmap = tiny_skia::Pixmap::new(width, height)?;
    rtree.render(tiny_skia::Transform::default(), &mut pixmap.as_mut());

    Some(pixmap.encode_png().ok()?)
}

/// Query params pour le placeholder OG
#[derive(Debug, Deserialize)]
pub struct OgPlaceholderParams {
    pub name: Option<String>,
}

/// GET /api/og-placeholder?name=...
/// Génère une image SVG dynamique comme placeholder pour og:image
/// quand aucune image produit/service n'existe
pub async fn og_placeholder_image(
    Query(params): Query<OgPlaceholderParams>,
) -> axum::response::Response {
    let name = params.name.unwrap_or_else(|| "Yukpomnang".to_string());
    let display_name: String = if name.chars().count() > 40 {
        format!("{}...", name.chars().take(37).collect::<String>())
    } else {
        name
    };
    let safe_name = display_name
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");

    let svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="600" y="240" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="bold" fill="white" text-anchor="middle" opacity="0.9">Y</text>
  <text x="600" y="340" font-family="Arial, Helvetica, sans-serif" font-size="36" fill="white" text-anchor="middle" opacity="0.8">{}</text>
  <text x="600" y="520" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="white" text-anchor="middle" opacity="0.6">yukpomnang.com</text>
</svg>"#,
        safe_name
    );

    axum::response::Response::builder()
        .status(200)
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "public, max-age=86400")
        .body(axum::body::Body::from(svg))
        .unwrap_or_else(|_| {
            axum::response::Response::builder()
                .status(500)
                .body(axum::body::Body::empty())
                .unwrap()
        })
}

// =====================================================================
// ✅ NOUVEAU 2026-03-14: Partage interne de produits entre utilisateurs
// =====================================================================

#[derive(Debug, Deserialize)]
pub struct InternalShareRequest {
    pub service_id: Option<i32>,
    pub product_index: Option<i32>,
    pub recipient_ids: Vec<i32>,
    pub message: Option<String>,
    /// Type de contenu partagé: product, video, menu, health_stats, navigation_stats
    pub content_type: Option<String>,
    /// Données supplémentaires (titre, description, url, etc.)
    pub content_data: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct InternalShareResponse {
    pub success: bool,
    pub shares_created: i32,
    pub notifications_sent: i32,
}

/// POST /api/products/share-internal
/// Partage un produit ou service en interne à un ou plusieurs utilisateurs
/// Crée une entrée dans internal_shares + envoie une notification à chaque destinataire
pub async fn share_product_internal(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(req): Json<InternalShareRequest>,
) -> AppResult<Json<InternalShareResponse>> {
    let content_type = req.content_type.clone().unwrap_or_else(|| "product".to_string());
    log::info!(
        "[InternalShare] User {} partage type={} service_id={:?} product_index={:?} à {} destinataires",
        auth_user.id, content_type, req.service_id, req.product_index, req.recipient_ids.len()
    );

    if req.recipient_ids.is_empty() {
        return Err(AppError::BadRequest(
            "Au moins un destinataire est requis".to_string(),
        ));
    }

    if req.recipient_ids.len() > 20 {
        return Err(AppError::BadRequest(
            "Maximum 20 destinataires par partage".to_string(),
        ));
    }

    // Récupérer le nom de l'expéditeur
    let sender_name: String = sqlx::query_scalar(
        "SELECT COALESCE(nom_complet, CONCAT(prenom, ' ', nom), email, 'Utilisateur') FROM users WHERE id = $1"
    )
    .bind(auth_user.id)
    .fetch_optional(&state.pg)
    .await?
    .unwrap_or_else(|| "Utilisateur".to_string());

    // Récupérer le nom du contenu partagé
    let content_title: String = if let Some(ref cd) = req.content_data {
        cd.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string()
    } else {
        String::new()
    };

    let product_name: String = if !content_title.is_empty() {
        content_title.clone()
    } else if let Some(pi) = req.product_index {
        if let Some(sid) = req.service_id {
            sqlx::query_scalar(
                "SELECT COALESCE(product_name, 'Produit') FROM service_products WHERE service_id = $1 AND product_index = $2"
            )
            .bind(sid)
            .bind(pi)
            .fetch_optional(&state.pg)
            .await?
            .unwrap_or_else(|| "Produit".to_string())
        } else {
            "Contenu".to_string()
        }
    } else if let Some(sid) = req.service_id {
        let row = sqlx::query("SELECT data FROM services WHERE id = $1")
            .bind(sid)
            .fetch_optional(&state.pg)
            .await?;
        if let Some(r) = row {
            let data: Option<Value> = r.get("data");
            if let Some(d) = data {
                d.get("titre_service")
                    .and_then(|v| v.get("valeur").and_then(|vv| vv.as_str()).or_else(|| v.as_str()))
                    .unwrap_or("Service")
                    .to_string()
            } else {
                "Service".to_string()
            }
        } else {
            "Service".to_string()
        }
    } else {
        match content_type.as_str() {
            "video" => "Vidéo".to_string(),
            "menu" => "Menu alimentaire".to_string(),
            "health_stats" => "Statistiques santé".to_string(),
            "navigation_stats" => "Performances navigation".to_string(),
            _ => "Contenu".to_string(),
        }
    };

    let mut shares_created = 0i32;
    let mut notifications_sent = 0i32;
    let share_message = req.message.clone().unwrap_or_default();

    for recipient_id in &req.recipient_ids {
        // Ne pas partager à soi-même
        if *recipient_id == auth_user.id {
            continue;
        }

        // Insérer dans internal_shares
        let insert_result = sqlx::query(
            r#"
            INSERT INTO internal_shares (sender_id, recipient_id, service_id, product_index, content_type, content_data, message)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(auth_user.id)
        .bind(recipient_id)
        .bind(req.service_id)
        .bind(req.product_index)
        .bind(&content_type)
        .bind(req.content_data.as_ref().unwrap_or(&json!({})))
        .bind(&share_message)
        .execute(&state.pg)
        .await;

        match insert_result {
            Ok(_) => shares_created += 1,
            Err(e) => {
                log::warn!(
                    "[InternalShare] Erreur insertion share pour user {}: {}",
                    recipient_id,
                    e
                );
                continue;
            }
        }

        // Créer la notification
        let type_emoji = match content_type.as_str() {
            "video" => "🎬",
            "menu" => "🍽️",
            "health_stats" => "🫀",
            "navigation_stats" => "🗺️",
            _ => "📦",
        };
        let notif_title = format!(
            "{} {} vous a partagé « {} »",
            type_emoji, sender_name, product_name
        );
        let notif_message = if share_message.is_empty() {
            format!("Appuyez pour voir le produit partagé par {}", sender_name)
        } else {
            format!("💬 \"{}\"", share_message)
        };

        let notif_data = json!({
            "service_id": req.service_id,
            "product_index": req.product_index,
            "sender_id": auth_user.id,
            "sender_name": sender_name,
            "product_name": product_name,
            "content_type": content_type,
            "content_data": req.content_data,
            "share_type": format!("internal_{}", content_type)
        });

        match crate::services::notification_service::create_notification(
            &state.pg,
            *recipient_id,
            crate::services::notification_service::NotificationType::ProductShared,
            notif_title,
            notif_message,
            Some(notif_data),
        )
        .await
        {
            Ok(_) => notifications_sent += 1,
            Err(e) => log::warn!(
                "[InternalShare] Erreur notification pour user {}: {}",
                recipient_id,
                e
            ),
        }
    }

    log::info!(
        "[InternalShare] ✅ {} partages créés, {} notifications envoyées",
        shares_created,
        notifications_sent
    );

    Ok(Json(InternalShareResponse {
        success: true,
        shares_created,
        notifications_sent,
    }))
}

/// GET /api/products/shared-with-me
/// Retourne les produits partagés avec l'utilisateur connecté
pub async fn get_shared_with_me(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<Value>> {
    let limit: i64 = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(30);

    let rows = sqlx::query(
        r#"
        SELECT
            s.id as share_id,
            s.sender_id,
            s.service_id,
            s.product_index,
            s.message,
            s.is_read,
            s.created_at,
            u.nom_complet as sender_name,
            u.avatar_url as sender_avatar,
            COALESCE(sp.product_name, 'Produit') as product_name,
            sp.product_data
        FROM internal_shares s
        JOIN users u ON s.sender_id = u.id
        LEFT JOIN service_products sp ON sp.service_id = s.service_id AND sp.product_index = s.product_index
        WHERE s.recipient_id = $1
        ORDER BY s.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(auth_user.id)
    .bind(limit)
    .fetch_all(&state.pg)
    .await?;

    let shares: Vec<Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<i32, _>("share_id"),
                "sender_id": row.get::<i32, _>("sender_id"),
                "sender_name": row.get::<Option<String>, _>("sender_name").unwrap_or_default(),
                "sender_avatar": row.get::<Option<String>, _>("sender_avatar"),
                "service_id": row.get::<i32, _>("service_id"),
                "product_index": row.get::<Option<i32>, _>("product_index"),
                "product_name": row.get::<String, _>("product_name"),
                "product_data": row.get::<Option<Value>, _>("product_data"),
                "message": row.get::<Option<String>, _>("message"),
                "is_read": row.get::<bool, _>("is_read"),
                "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            })
        })
        .collect();

    // Marquer comme lus
    let _ = sqlx::query(
        "UPDATE internal_shares SET is_read = TRUE WHERE recipient_id = $1 AND is_read = FALSE",
    )
    .bind(auth_user.id)
    .execute(&state.pg)
    .await;

    Ok(Json(json!({
        "success": true,
        "data": shares,
        "count": shares.len()
    })))
}
