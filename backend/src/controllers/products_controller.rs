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

    let gallery_html = if all_media.is_empty() {
        String::new()
    } else if all_media.len() == 1 {
        let (url, is_vid) = all_media[0];
        if is_vid {
            format!(
                r#"<div class="media-hero"><video src="{}" autoplay muted loop playsinline></video></div>"#,
                url
            )
        } else {
            format!(
                r#"<div class="media-hero"><img src="{}" alt="{}" /></div>"#,
                url, item_name
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
        let vid_src = if first_is_vid { first_url } else { "" };
        let img_src = if first_is_vid { "" } else { first_url };

        let main_html = format!(
            r#"<div class="gallery-main"><video id="main-video" src="{}" autoplay muted loop playsinline{}></video><img id="main-image" src="{}" alt="{}"{} /></div>"#,
            vid_src, vid_style, img_src, item_name, img_style
        );

        let thumbs: String = all_media.iter().enumerate().map(|(idx, (url, is_vid))| {
            let active = if idx == 0 { " active" } else { "" };
            if *is_vid {
                format!(
                    r#"<div class="thumb-wrap{}" onclick="showMedia({})"><video src="{}" class="thumb-media" muted preload="metadata"></video><div class="play-badge">&#9654;</div></div>"#,
                    active, idx, url
                )
            } else {
                format!(
                    r#"<div class="thumb-wrap{}" onclick="showMedia({})"><img src="{}" alt="{}" class="thumb-media" /></div>"#,
                    active, idx, url, item_name
                )
            }
        }).collect::<Vec<_>>().join("\n            ");

        format!(
            r#"<div class="gallery-container">{}<div class="gallery-thumbs">{}</div></div>"#,
            main_html, thumbs
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

/// CSS commun pour la galerie média (vidéos + images)
fn media_gallery_css() -> &'static str {
    r#"
        .media-hero { margin: 20px 0; text-align: center; }
        .media-hero img, .media-hero video { max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .gallery-container { margin: 20px 0; }
        .gallery-main { margin-bottom: 16px; text-align: center; position: relative; }
        .gallery-main video, .gallery-main img { max-width: 100%; height: auto; max-height: 500px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); object-fit: contain; }
        .gallery-thumbs { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
        .thumb-wrap { position: relative; display: inline-flex; cursor: pointer; border: 2px solid transparent; border-radius: 8px; overflow: hidden; transition: all 0.2s; opacity: 0.7; width: 80px; height: 80px; }
        .thumb-wrap:hover { opacity: 1; border-color: #667eea; transform: scale(1.05); }
        .thumb-wrap.active { opacity: 1; border-color: #667eea; }
        .thumb-media { width: 100%; height: 100%; object-fit: cover; display: block; }
        .play-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #fff; font-size: 16px; background: rgba(0,0,0,0.5); border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    "#
}

/// JS commun pour la galerie média
fn media_gallery_js() -> &'static str {
    r#"
        function showMedia(index) {
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
        }
    "#
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

    // ✅ CORRIGÉ 2026-03-03: Récupérer toutes les images du produit depuis la table media
    // Utiliser des URLs pré-signées car le bucket GCS n'est PAS public (build_public_url retourne des 404)
    let product_image_paths: Vec<String> = sqlx::query_scalar::<_, Option<String>>(
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
    .collect();

    let mut product_images_db: Vec<String> = Vec::with_capacity(product_image_paths.len());
    for path in &product_image_paths {
        let url = if path.starts_with("http://") || path.starts_with("https://") {
            path.clone()
        } else if state.media_storage.is_remote() {
            // ✅ URL pré-signée (7 jours) — les crawlers sociaux mettent en cache l'image
            match state.media_storage.generate_presigned_url(path, 7 * 24 * 3600).await {
                Ok(presigned) => presigned,
                Err(_) => state.media_storage.build_public_url(path),
            }
        } else {
            state.media_storage.build_public_url(path)
        };
        product_images_db.push(url);
    }

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
    // ✅ CORRIGÉ: Convertir les chemins relatifs de product_data en URLs pré-signées
    let mut all_product_images = product_images_db;
    for img in product_images_from_data {
        if img.is_empty() || all_product_images.contains(&img) {
            continue;
        }
        let resolved_url = if img.starts_with("http://")
            || img.starts_with("https://")
            || img.starts_with("data:")
        {
            img
        } else if state.media_storage.is_remote() {
            match state.media_storage.generate_presigned_url(&img, 7 * 24 * 3600).await {
                Ok(presigned) => presigned,
                Err(_) => state.media_storage.build_public_url(&img),
            }
        } else {
            state.media_storage.build_public_url(&img)
        };
        all_product_images.push(resolved_url);
    }

    // ✅ AJOUTÉ: Récupérer les VIDÉOS du produit depuis la table media
    let product_video_paths: Vec<String> = sqlx::query_scalar::<_, Option<String>>(
        r#"
        SELECT path FROM media
        WHERE service_id = $1
        AND (product_index = $2 OR product_index IS NULL)
        AND (type = 'video' OR media_type = 'video')
        ORDER BY CASE WHEN product_index = $2 THEN 0 ELSE 1 END,
            COALESCE(display_order, 0) ASC, id ASC
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
    .collect();

    let mut all_product_videos: Vec<String> = Vec::new();
    for path in &product_video_paths {
        let url = if path.starts_with("http://") || path.starts_with("https://") {
            path.clone()
        } else if state.media_storage.is_remote() {
            match state.media_storage.generate_presigned_url(path, 7 * 24 * 3600).await {
                Ok(presigned) => presigned,
                Err(_) => state.media_storage.build_public_url(path),
            }
        } else {
            state.media_storage.build_public_url(path)
        };
        all_product_videos.push(url);
    }

    // Extraire vidéos depuis product_data.videos
    let product_videos_from_data: Vec<String> = {
        let videos_val = product_data.as_object().and_then(|obj| obj.get("videos"));
        match videos_val {
            Some(v) if v.is_array() => v
                .as_array()
                .unwrap()
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect(),
            Some(v) if v.is_object() => v
                .get("valeur")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default(),
            _ => Vec::new(),
        }
    };
    for vid in product_videos_from_data {
        if vid.is_empty() || all_product_videos.contains(&vid) {
            continue;
        }
        let resolved_url = if vid.starts_with("http://")
            || vid.starts_with("https://")
            || vid.starts_with("data:")
        {
            vid
        } else if state.media_storage.is_remote() {
            match state.media_storage.generate_presigned_url(&vid, 7 * 24 * 3600).await {
                Ok(presigned) => presigned,
                Err(_) => state.media_storage.build_public_url(&vid),
            }
        } else {
            state.media_storage.build_public_url(&vid)
        };
        all_product_videos.push(resolved_url);
    }

    log::info!(
        "🖼️ [share_product_redirect] {} vidéos + {} images pour produit {}",
        all_product_videos.len(),
        all_product_images.len(),
        product_id
    );

    // ✅ CORRIGÉ 2026-02-27: Utiliser SHARE_BASE_URL (URL du backend) au lieu de PUBLIC_BASE_URL (bucket GCS)
    let share_base_url = std::env::var("SHARE_BASE_URL")
        .or_else(|_| std::env::var("BACKEND_URL"))
        .unwrap_or_else(|_| "https://yukpo-backend-376093909298.europe-west1.run.app".to_string());

    // ✅ CORRIGÉ 2026-03-03: Séparer og:image (crawlers sociaux) et image HTML (affichage)
    // Les crawlers sociaux (Facebook, WhatsApp, Twitter) ne supportent PAS le SVG pour og:image
    // og_image_url: uniquement de vraies images (presigned URLs) — None si aucune image
    // display_image_url: SVG placeholder si aucune image (pour l'affichage HTML uniquement)
    let og_image_url: Option<String> = all_product_images.first().cloned();
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

    // ✅ CORRIGÉ: og:description inclut le prix pour que les previews sociales l'affichent
    let product_description = if let Some(price) = price_amount {
        format!(
            "{} — Prix: {} {}",
            raw_description, price as i64, price_currency
        )
    } else {
        raw_description
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
    html.push_str(r#"" />"#);
    // ✅ CORRIGÉ 2026-03-03: og:image uniquement si une vraie image existe (pas SVG placeholder)
    // Les crawlers sociaux (Facebook, WhatsApp, Twitter) ne supportent PAS SVG
    if let Some(ref og_img) = og_image_url {
        html.push_str("\n    <meta property=\"og:image\" content=\"");
        html.push_str(og_img);
        html.push_str("\" />\n    <meta property=\"og:image:width\" content=\"1200\" />\n    <meta property=\"og:image:height\" content=\"630\" />\n    <meta property=\"og:image:alt\" content=\"");
        html.push_str(product_name);
        html.push_str("\" />");
    }
    // ✅ AJOUTÉ: og:video pour les crawlers sociaux (WhatsApp, Facebook, Twitter)
    if let Some(ref vid_url) = first_video_url {
        html.push_str("\n    <meta property=\"og:video\" content=\"");
        html.push_str(vid_url);
        html.push_str("\" />\n    <meta property=\"og:video:type\" content=\"video/mp4\" />\n    <meta property=\"og:video:width\" content=\"1280\" />\n    <meta property=\"og:video:height\" content=\"720\" />");
    }
    html.push_str(
        r#"
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
    html.push_str("\n    <meta name=\"twitter:card\" content=\"summary_large_image\" />\n    <meta name=\"twitter:title\" content=\"");
    html.push_str(product_name);
    html.push_str("\" />\n    <meta name=\"twitter:description\" content=\"");
    html.push_str(&product_description);
    html.push_str("\" />");
    if let Some(ref og_img) = og_image_url {
        html.push_str("\n    <meta name=\"twitter:image\" content=\"");
        html.push_str(og_img);
        html.push_str("\" />\n    <meta name=\"twitter:image:alt\" content=\"");
        html.push_str(product_name);
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
    html.push_str(&display_image_url);
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
    html.push_str(product_name);
    html.push_str(
        r#"</h1>
        "#,
    );
    html.push_str(&price_html);
    html.push_str(&media_gallery_html);
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

    // ✅ CORRIGÉ: Récupérer TOUTES les images du service (pas LIMIT 1)
    let service_image_paths: Vec<String> = sqlx::query_scalar::<_, Option<String>>(
        r#"SELECT path FROM media
           WHERE service_id = $1 AND (type = 'image' OR media_type = 'image')
           ORDER BY COALESCE(is_main_image, FALSE) DESC, COALESCE(display_order, 0) ASC, id ASC"#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .ok()
    .unwrap_or_default()
    .into_iter()
    .flatten()
    .collect();

    let mut all_service_images: Vec<String> = Vec::with_capacity(service_image_paths.len());
    for path in &service_image_paths {
        let url = if path.starts_with("http://") || path.starts_with("https://") {
            path.clone()
        } else if state.media_storage.is_remote() {
            match state.media_storage.generate_presigned_url(path, 7 * 24 * 3600).await {
                Ok(presigned) => presigned,
                Err(_) => state.media_storage.build_public_url(path),
            }
        } else {
            state.media_storage.build_public_url(path)
        };
        all_service_images.push(url);
    }

    // ✅ CORRIGÉ: Fallback — si aucune image dans la table media, extraire depuis service_data
    // Les images peuvent être dans data.images, data.produits[].images, data.logo, data.banniere
    if all_service_images.is_empty() {
        let mut fallback_paths: Vec<String> = Vec::new();

        // Extraire images depuis data.images (format tableau ou {valeur: [...]})
        let extract_image_paths = |val: Option<&Value>| -> Vec<String> {
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

        // Service-level images
        fallback_paths.extend(extract_image_paths(service_data.get("images")));
        fallback_paths.extend(extract_image_paths(service_data.get("logo")));
        fallback_paths.extend(extract_image_paths(service_data.get("banniere")));
        fallback_paths.extend(extract_image_paths(service_data.get("banner")));
        fallback_paths.extend(extract_image_paths(service_data.get("images_realisations")));

        // Product-level images (from data.produits)
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
                    fallback_paths.extend(extract_image_paths(prod.get("images")));
                }
            }
        }

        // Convert fallback paths to presigned URLs
        for img in fallback_paths {
            if img.is_empty() || all_service_images.contains(&img) {
                continue;
            }
            let resolved_url = if img.starts_with("http://")
                || img.starts_with("https://")
                || img.starts_with("data:")
            {
                img
            } else if state.media_storage.is_remote() {
                match state.media_storage.generate_presigned_url(&img, 7 * 24 * 3600).await {
                    Ok(presigned) => presigned,
                    Err(_) => state.media_storage.build_public_url(&img),
                }
            } else {
                state.media_storage.build_public_url(&img)
            };
            all_service_images.push(resolved_url);
        }
    }

    // ✅ AJOUTÉ: Récupérer les VIDÉOS du service depuis la table media
    let service_video_paths: Vec<String> = sqlx::query_scalar::<_, Option<String>>(
        r#"SELECT path FROM media
           WHERE service_id = $1 AND (type = 'video' OR media_type = 'video')
           ORDER BY COALESCE(display_order, 0) ASC, id ASC"#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .ok()
    .unwrap_or_default()
    .into_iter()
    .flatten()
    .collect();

    let mut all_service_videos: Vec<String> = Vec::new();
    for path in &service_video_paths {
        let url = if path.starts_with("http://") || path.starts_with("https://") {
            path.clone()
        } else if state.media_storage.is_remote() {
            match state.media_storage.generate_presigned_url(path, 7 * 24 * 3600).await {
                Ok(presigned) => presigned,
                Err(_) => state.media_storage.build_public_url(path),
            }
        } else {
            state.media_storage.build_public_url(path)
        };
        all_service_videos.push(url);
    }

    // Extraire vidéos depuis service_data.videos (fallback)
    if all_service_videos.is_empty() {
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
        // Videos from products
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
            if vid.is_empty() || all_service_videos.contains(&vid) {
                continue;
            }
            let resolved_url = if vid.starts_with("http://")
                || vid.starts_with("https://")
                || vid.starts_with("data:")
            {
                vid
            } else if state.media_storage.is_remote() {
                match state.media_storage.generate_presigned_url(&vid, 7 * 24 * 3600).await {
                    Ok(presigned) => presigned,
                    Err(_) => state.media_storage.build_public_url(&vid),
                }
            } else {
                state.media_storage.build_public_url(&vid)
            };
            all_service_videos.push(resolved_url);
        }
    }

    log::info!(
        "🖼️ [share_service_redirect] {} vidéos + {} images pour service {}",
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
    html.push_str(&service_titre);
    html.push_str(
        r#" - Yukpomnang</title>
    <meta name="description" content=""#,
    );
    html.push_str(&service_description);
    html.push_str(
        r#"" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content=""#,
    );
    html.push_str(&service_titre);
    html.push_str(
        r#"" />
    <meta property="og:description" content=""#,
    );
    html.push_str(&service_description);
    html.push_str("\" />");
    if let Some(ref og_img) = og_image_url {
        html.push_str("\n    <meta property=\"og:image\" content=\"");
        html.push_str(og_img);
        html.push_str("\" />\n    <meta property=\"og:image:width\" content=\"1200\" />\n    <meta property=\"og:image:height\" content=\"630\" />\n    <meta property=\"og:image:alt\" content=\"");
        html.push_str(&service_titre);
        html.push_str("\" />");
    }
    // ✅ AJOUTÉ: og:video pour les crawlers sociaux
    if let Some(ref vid_url) = first_video_url {
        html.push_str("\n    <meta property=\"og:video\" content=\"");
        html.push_str(vid_url);
        html.push_str("\" />\n    <meta property=\"og:video:type\" content=\"video/mp4\" />\n    <meta property=\"og:video:width\" content=\"1280\" />\n    <meta property=\"og:video:height\" content=\"720\" />");
    }
    html.push_str("\n    <meta property=\"og:url\" content=\"");
    html.push_str(&share_url);
    html.push_str(
        r#"" />
    <meta property="og:site_name" content="Yukpomnang" />
    <meta property="og:locale" content="fr_FR" />
    "#,
    );
    html.push_str(&price_og_html);
    html.push_str("\n    <meta name=\"twitter:card\" content=\"summary_large_image\" />\n    <meta name=\"twitter:title\" content=\"");
    html.push_str(&service_titre);
    html.push_str("\" />\n    <meta name=\"twitter:description\" content=\"");
    html.push_str(&service_description);
    html.push_str("\" />");
    if let Some(ref og_img) = og_image_url {
        html.push_str("\n    <meta name=\"twitter:image\" content=\"");
        html.push_str(og_img);
        html.push_str("\" />\n    <meta name=\"twitter:image:alt\" content=\"");
        html.push_str(&service_titre);
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
    html.push_str(&service_titre);
    html.push_str("</h1>\n");
    html.push_str(&price_html);
    html.push_str(&media_gallery_html);
    html.push_str(
        r#"
        <div class="description">"#,
    );
    html.push_str(&service_description);
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
            margin: 0; padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container {
            background: white; border-radius: 16px; padding: 32px;
            max-width: 600px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
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
