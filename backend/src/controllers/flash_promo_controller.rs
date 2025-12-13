use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::product_enrichment_service::ProductEnrichmentService;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::Json,
};
use chrono::Utc;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CreateFlashPromoRequest {
    pub service_id: i32,
    pub product_indexes: Vec<i32>, // ✅ NOUVEAU: Liste des index de produits (peut être vide pour tous)
    pub discount_type: String,      // "percentage" | "fixed" | "free"
    pub discount_value: Option<f64>, // Pourcentage ou montant fixe
    pub title: String,
    pub description: Option<String>,
    pub starts_at: chrono::DateTime<Utc>,
    pub ends_at: chrono::DateTime<Utc>,
    pub conditions: Option<String>,
    pub availability: Option<String>, // ✅ NOUVEAU: "online" | "live" | "both" (défaut: "online")
    pub live_session_id: Option<uuid::Uuid>, // ✅ NOUVEAU: ID de session live si availability inclut "live"
    pub stock_cap: Option<i32>, // ✅ NOUVEAU: Limite de stock pour la promotion
}

#[derive(Debug, Serialize, FromRow)]
pub struct FlashPromoResponse {
    pub id: i32,
    pub service_id: i32,
    pub product_indexes: Vec<i32>, // ✅ NOUVEAU: Liste de produits
    pub discount_type: String,
    pub discount_value: Option<f64>,
    pub title: String,
    pub description: Option<String>,
    pub starts_at: chrono::DateTime<Utc>,
    pub ends_at: chrono::DateTime<Utc>,
    pub conditions: Option<String>,
    pub availability: String, // ✅ NOUVEAU: online, live, both
    pub live_session_id: Option<String>, // ✅ NOUVEAU: Session live optionnelle
    pub stock_cap: Option<i32>, // ✅ NOUVEAU: Limite de stock
    pub is_active: bool,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(FromRow)]
struct ServiceOwnerRow {
    user_id: i32,
    data: Value,
}

#[derive(FromRow)]
struct ServiceWithPromosRow {
    id: i32,
    user_id: i32,
    data: Value,
    #[sqlx(default)]
    title: String,
}

/// Créer un flash promotionnel pour un produit (GRATUIT)
pub async fn create_flash_promo(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateFlashPromoRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    info!(
        "[FlashPromo] Création flash promo pour service {} par user {}",
        payload.service_id, user.id
    );

    // Vérifier que l'utilisateur est propriétaire du service
    let service_owner: Option<ServiceOwnerRow> = sqlx::query_as(
        "SELECT user_id, data FROM services WHERE id = $1",
    )
    .bind(payload.service_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("[FlashPromo] Erreur vérification service: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let service_owner = match service_owner {
        Some(owner) => owner,
        None => {
            warn!("[FlashPromo] Service {} introuvable", payload.service_id);
            return Err(StatusCode::NOT_FOUND);
        }
    };

    if service_owner.user_id != user.id {
        warn!(
            "[FlashPromo] User {} n'est pas propriétaire du service {}",
            user.id, payload.service_id
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Valider les dates
    if payload.ends_at <= payload.starts_at {
        return Err(StatusCode::BAD_REQUEST);
    }

    if payload.ends_at < Utc::now() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Valider le type de réduction
    if !["percentage", "fixed", "free"].contains(&payload.discount_type.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Si c'est un pourcentage, vérifier que la valeur est entre 0 et 100
    if payload.discount_type == "percentage" {
        if let Some(value) = payload.discount_value {
            if value < 0.0 || value > 100.0 {
                return Err(StatusCode::BAD_REQUEST);
            }
        } else {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    // Si c'est un montant fixe, vérifier que la valeur est positive
    if payload.discount_type == "fixed" {
        if let Some(value) = payload.discount_value {
            if value < 0.0 {
                return Err(StatusCode::BAD_REQUEST);
            }
        } else {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    // ✅ NOUVEAU: Valider les produits sélectionnés
    let produits = service_owner
        .data
        .get("produits")
        .and_then(|p| p.get("valeur"))
        .and_then(|v| v.as_array());

    let produits_array = match produits {
        Some(arr) => arr,
        None => {
            warn!("[FlashPromo] Aucun produit trouvé dans le service");
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    // ✅ Si product_indexes est vide, cela signifie "tous les produits"
    // Si des produits spécifiques sont sélectionnés, vérifier qu'ils existent
    let final_product_indexes = if payload.product_indexes.is_empty() {
        // Si vide, inclure tous les produits
        (0..produits_array.len() as i32).collect::<Vec<i32>>()
    } else {
        // Sinon, valider les index sélectionnés
        for &product_index in &payload.product_indexes {
            if product_index < 0 || (product_index as usize) >= produits_array.len() {
                warn!(
                    "[FlashPromo] Index produit {} invalide (total: {})",
                    product_index,
                    produits_array.len()
                );
                return Err(StatusCode::BAD_REQUEST);
            }
        }
        payload.product_indexes.clone()
    };

    // ✅ NOUVEAU: Valider availability
    let availability = payload.availability.as_deref().unwrap_or("online");
    if !["online", "live", "both"].contains(&availability) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // ✅ NOUVEAU: Si availability inclut "live", vérifier que live_session_id est fourni
    if (availability == "live" || availability == "both") && payload.live_session_id.is_none() {
        warn!("[FlashPromo] live_session_id requis pour availability={}", availability);
        // Ne pas bloquer, mais avertir - l'utilisateur peut ajouter la session plus tard
    }

    // Créer le flash promotionnel dans le champ promotion du service
    let mut service_data = service_owner.data.clone();
    
    // Initialiser le champ promotion s'il n'existe pas
    if !service_data.get("promotion").is_some() {
        service_data["promotion"] = json!({
            "flash_promos": []
        });
    }

    let flash_promo = json!({
        "id": format!("{}_{}", payload.service_id, Utc::now().timestamp()),
        "service_id": payload.service_id,
        "product_indexes": final_product_indexes, // ✅ NOUVEAU: Liste de produits (ou tous si vide)
        "discount_type": payload.discount_type,
        "discount_value": payload.discount_value,
        "title": payload.title,
        "description": payload.description,
        "starts_at": payload.starts_at.to_rfc3339(),
        "ends_at": payload.ends_at.to_rfc3339(),
        "conditions": payload.conditions,
        "availability": availability, // ✅ NOUVEAU: online, live, both
        "live_session_id": payload.live_session_id.map(|id| id.to_string()), // ✅ NOUVEAU: Session live optionnelle
        "stock_cap": payload.stock_cap, // ✅ NOUVEAU: Limite de stock
        "is_active": true,
        "created_at": Utc::now().to_rfc3339(),
    });

    // Ajouter le flash promo à la liste
    if let Some(promotion) = service_data.get_mut("promotion") {
        if let Some(flash_promos) = promotion.get_mut("flash_promos") {
            if let Some(arr) = flash_promos.as_array_mut() {
                arr.push(flash_promo.clone());
            }
        } else {
            promotion["flash_promos"] = json!([flash_promo.clone()]);
        }
    }

    // Mettre à jour le service
    sqlx::query(
        "UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(&service_data)
    .bind(payload.service_id)
    .execute(pool)
    .await
    .map_err(|e| {
        error!("[FlashPromo] Erreur mise à jour service: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("[FlashPromo] Flash promo créé avec succès (GRATUIT)");

    Ok(Json(json!({
        "success": true,
        "message": "Flash promotionnel créé avec succès (gratuit)",
        "data": flash_promo
    })))
}

/// Lister les flash promotionnels d'un service
pub async fn list_flash_promos(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    // Vérifier que l'utilisateur est propriétaire du service
    let service_owner: Option<ServiceOwnerRow> = sqlx::query_as(
        "SELECT user_id, data FROM services WHERE id = $1",
    )
    .bind(service_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("[FlashPromo] Erreur vérification service: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let service_owner = match service_owner {
        Some(owner) => owner,
        None => {
            return Err(StatusCode::NOT_FOUND);
        }
    };

    if service_owner.user_id != user.id {
        return Err(StatusCode::FORBIDDEN);
    }

    // Extraire les flash promos
    let flash_promos = service_owner
        .data
        .get("promotion")
        .and_then(|p| p.get("flash_promos"))
        .and_then(|fp| fp.as_array())
        .cloned()
        .unwrap_or_else(Vec::new);

    Ok(Json(json!({
        "success": true,
        "data": flash_promos
    })))
}

/// Supprimer un flash promotionnel
pub async fn delete_flash_promo(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, promo_id)): Path<(i32, String)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    // Vérifier que l'utilisateur est propriétaire du service
    let service_owner: Option<ServiceOwnerRow> = sqlx::query_as(
        "SELECT user_id, data FROM services WHERE id = $1",
    )
    .bind(service_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("[FlashPromo] Erreur vérification service: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut service_data = match service_owner {
        Some(owner) => {
            if owner.user_id != user.id {
                return Err(StatusCode::FORBIDDEN);
            }
            owner.data
        }
        None => {
            return Err(StatusCode::NOT_FOUND);
        }
    };

    // Supprimer le flash promo de la liste
    if let Some(promotion) = service_data.get_mut("promotion") {
        if let Some(flash_promos) = promotion.get_mut("flash_promos") {
            if let Some(arr) = flash_promos.as_array_mut() {
                arr.retain(|fp| {
                    fp.get("id")
                        .and_then(|id| id.as_str())
                        .map(|id| id != promo_id)
                        .unwrap_or(true)
                });
            }
        }
    }

    // Mettre à jour le service
    sqlx::query(
        "UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(&service_data)
    .bind(service_id)
    .execute(pool)
    .await
    .map_err(|e| {
        error!("[FlashPromo] Erreur mise à jour service: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("[FlashPromo] Flash promo {} supprimé", promo_id);

    Ok(Json(json!({
        "success": true,
        "message": "Flash promotionnel supprimé avec succès"
    })))
}

/// ✅ NOUVEAU: Récupérer tous les flash promotionnels actifs (pour les utilisateurs)
/// Route: GET /api/flash-promos/active
pub async fn get_active_flash_promos(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    info!("[FlashPromo] Récupération flash promos actifs");

    // Récupérer tous les services avec des flash promos actifs
    let services_rows = sqlx::query_as::<_, (i32, i32, Value)>(
        r#"
        SELECT id, user_id, data
        FROM services
        WHERE data->'promotion'->'flash_promos' IS NOT NULL
        AND data->'promotion'->'flash_promos' != '[]'::jsonb
        AND is_active = TRUE
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| {
        error!("[FlashPromo] Erreur récupération services: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Convertir en ServiceWithPromosRow en extrayant le titre depuis le JSON
    let services: Vec<ServiceWithPromosRow> = services_rows
        .into_iter()
        .map(|(id, user_id, data)| {
            let title = data
                .get("titre_service")
                .and_then(|v| v.as_str())
                .or_else(|| {
                    data.get("titre_service")
                        .and_then(|v| v.get("valeur"))
                        .and_then(|v| v.as_str())
                })
                .or_else(|| data.get("titre").and_then(|v| v.as_str()))
                .or_else(|| data.get("nom").and_then(|v| v.as_str()))
                .unwrap_or("Service")
                .to_string();
            ServiceWithPromosRow {
                id,
                user_id,
                data,
                title,
            }
        })
        .collect();

    let now = Utc::now();
    let mut active_promos: Vec<Value> = Vec::new();

    for service in services {
        let flash_promos = service
            .data
            .get("promotion")
            .and_then(|p| p.get("flash_promos"))
            .and_then(|fp| fp.as_array())
            .cloned()
            .unwrap_or_else(Vec::new);

        for promo in flash_promos {
                // Vérifier si la promo est active
                let is_active = promo
                    .get("is_active")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);

                if !is_active {
                    continue;
                }

                // Vérifier les dates
                let starts_at_str = promo
                    .get("starts_at")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let ends_at_str = promo
                    .get("ends_at")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                let starts_at = chrono::DateTime::parse_from_rfc3339(starts_at_str)
                    .ok()
                    .map(|dt| dt.with_timezone(&Utc));
                let ends_at = chrono::DateTime::parse_from_rfc3339(ends_at_str)
                    .ok()
                    .map(|dt| dt.with_timezone(&Utc));

                let is_currently_active = match (starts_at, ends_at) {
                    (Some(start), Some(end)) => now >= start && now <= end,
                    _ => false,
                };

                if is_currently_active {
                    // Enrichir avec les infos du service
                    let mut enriched_promo = promo.clone();
                    enriched_promo["service_id"] = json!(service.id);
                    enriched_promo["service_owner_id"] = json!(service.user_id);

                    // Récupérer les produits concernés
                    let product_indexes_value = promo
                        .get("product_indexes")
                        .cloned()
                        .unwrap_or_else(|| Value::Array(Vec::new()));
                    
                    let product_indexes_array = product_indexes_value
                        .as_array()
                        .cloned()
                        .unwrap_or_else(Vec::new);

                    let produits_value = service
                        .data
                        .get("produits")
                        .and_then(|p| p.get("valeur"))
                        .cloned()
                        .unwrap_or_else(|| Value::Array(Vec::new()));
                    
                    let produits_array = produits_value
                        .as_array()
                        .cloned()
                        .unwrap_or_else(Vec::new);

                    // ✅ NOUVEAU: Service d'enrichissement pour la livraison
                    let enrichment_service = ProductEnrichmentService::new(pool.clone());
                    
                    let mut promo_products: Vec<Value> = Vec::new();
                    for index_value in product_indexes_array {
                        if let Some(index) = index_value.as_i64() {
                            let idx = index as usize;
                            if idx < produits_array.len() {
                                let mut product = produits_array[idx].clone();
                                // ✅ NOUVEAU: Ajouter les infos nécessaires pour l'achat direct
                                if let Some(product_obj) = product.as_object_mut() {
                                    product_obj.insert("_service_id".to_string(), json!(service.id));
                                    product_obj.insert("_product_index".to_string(), json!(idx));
                                    product_obj.insert("_service_title".to_string(), json!(service.title));
                                    
                                    // ✅ NOUVEAU: Enrichir avec la configuration de livraison
                                    if let Err(e) = enrichment_service
                                        .enrich_product(service.id, idx as i32, &mut product)
                                        .await
                                    {
                                        warn!(
                                            "[FlashPromo] Erreur enrichissement livraison pour service {} produit {}: {:?}",
                                            service.id, idx, e
                                        );
                                        // Continuer même en cas d'erreur
                                    }
                                }
                                promo_products.push(product);
                            }
                        }
                    }

                    // ✅ NOUVEAU: Déterminer le titre intelligent
                    // Si un seul produit : utiliser son nom, sinon le titre du service
                    let display_title = if promo_products.len() == 1 {
                        // Un seul produit : utiliser son nom
                        promo_products[0]
                            .get("nom_produit")
                            .and_then(|v| v.as_str())
                            .or_else(|| {
                                promo_products[0]
                                    .get("nom_produit")
                                    .and_then(|v| v.get("valeur"))
                                    .and_then(|v| v.as_str())
                            })
                            .or_else(|| promo_products[0].get("nom").and_then(|v| v.as_str()))
                            .unwrap_or("Produit en promotion")
                            .to_string()
                    } else {
                        // Plusieurs produits : utiliser le titre du service
                        service.title.clone()
                    };

                    enriched_promo["display_title"] = json!(display_title);
                    enriched_promo["service_title"] = json!(service.title);
                    enriched_promo["products"] = json!(promo_products);
                    enriched_promo["product_count"] = json!(promo_products.len());
                    
                    // ✅ NOUVEAU: Ajouter les informations nécessaires pour l'achat direct
                    // Les produits sont déjà dans "products" avec toutes leurs infos
                    // Ajouter aussi les index pour référence rapide
                    enriched_promo["product_indexes"] = json!(product_indexes_array);
                    
                    active_promos.push(enriched_promo);
                }
            }
        }

    // Trier par date de fin (les plus urgentes en premier)
    active_promos.sort_by(|a, b| {
        let a_end = a
            .get("ends_at")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc));
        let b_end = b
            .get("ends_at")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc));

        match (a_end, b_end) {
            (Some(a_dt), Some(b_dt)) => a_dt.cmp(&b_dt),
            _ => std::cmp::Ordering::Equal,
        }
    });

    info!("[FlashPromo] {} flash promos actifs trouvés", active_promos.len());

    Ok(Json(json!({
        "success": true,
        "data": active_promos,
        "count": active_promos.len()
    })))
}

