use axum::{
    extract::{Path, State},
    response::Json,
    routing::{get, post},
    Extension, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    core::types::AppError,
    middlewares::jwt::AuthenticatedUser,
    services::{
        order_preparation_service::{CreateOrderRequest, OrderPreparationService, RejectOrderRequest, ValidateOrderRequest},
        product_availability_service::ProductAvailabilityService,
        similar_products_service::SimilarProductsService,
        smart_notification_service::SmartNotificationService,
    },
    state::AppState,
};

pub fn order_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/delivery/orders", post(create_order))
        .route("/api/delivery/orders/:order_id/validate", post(validate_order))
        .route("/api/delivery/orders/:order_id/reject", post(reject_order))
        .route("/api/delivery/orders/:order_id/similar", get(get_similar_products))
        .route("/api/delivery/orders/:order_id", get(get_order))
        .route("/api/delivery/orders/provider/pending", get(get_provider_pending_orders))
        .route("/api/delivery/orders/client/my-orders", get(get_client_orders))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
struct CreateOrderPayload {
    pub delivery_id: Option<Uuid>,
    pub service_id: i32,
    pub product_index: i32,
    pub client_user_id: i32,
    pub provider_user_id: i32,
    pub validation_timeout_minutes: Option<i32>,
    /// ✅ NOUVEAU : Coordonnées GPS du client pour recherche de proximité
    pub client_latitude: Option<f64>,
    pub client_longitude: Option<f64>,
}

/// POST /api/delivery/orders - Créer une nouvelle commande
/// Vérifie la disponibilité avant création
async fn create_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateOrderPayload>,
) -> Result<Json<Value>, AppError> {
    // Vérifier que l'utilisateur est le client
    if user.id != payload.client_user_id {
        return Err(AppError::Unauthorized(
            "Vous ne pouvez créer une commande que pour vous-même".to_string(),
        ));
    }

    let availability_service = ProductAvailabilityService::new(state.pg.clone());
    
    // Vérifier la disponibilité du produit
    let availability = availability_service
        .check_availability(
            payload.service_id,
            payload.product_index,
            None, // Maintenant
        )
        .await?;

    if !availability.is_available {
        // Produit non disponible, retourner produits similaires avec proximité
        // ✅ AMÉLIORATION : Utiliser GeographicMatchingService si disponible (Google Maps priorité + fallback local)
        let similar_service = if let Some(geo_service) = state.geographic_matching.as_ref() {
            SimilarProductsService::with_geographic_matching(
                state.pg.clone(),
                geo_service.clone(),
            )
        } else {
            SimilarProductsService::new(state.pg.clone())
        };
        
        let similar_products = similar_service
            .find_similar_products_with_location(
                payload.service_id, 
                payload.product_index, 
                5,
                payload.client_latitude,
                payload.client_longitude,
            )
            .await?;

        return Ok(Json(json!({
            "success": false,
            "available": false,
            "reason": availability.reason,
            "similar_products": similar_products,
            "message": "Produit non disponible. Voici des alternatives."
        })));
    }

    // Créer la commande
    let order_service = OrderPreparationService::new(state.pg.clone());
    let order = order_service
        .create_order(CreateOrderRequest {
            delivery_id: payload.delivery_id,
            service_id: payload.service_id,
            product_index: payload.product_index,
            client_user_id: payload.client_user_id,
            provider_user_id: payload.provider_user_id,
            validation_timeout_minutes: payload.validation_timeout_minutes,
        })
        .await?;

    // Notifier le prestataire
    let notification_service = SmartNotificationService::new(state.pg.clone());
    notification_service
        .notify_provider_new_order(
            payload.provider_user_id,
            order.id,
            payload.service_id,
            payload.product_index,
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "order": order,
        "message": "Commande créée avec succès"
    })))
}

/// POST /api/delivery/orders/:order_id/validate - Prestataire valide une commande
async fn validate_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<ValidateOrderRequest>,
) -> Result<Json<Value>, AppError> {
    // Vérifier que l'utilisateur est le prestataire
    let provider_user_id: Option<i32> = sqlx::query(
        "SELECT provider_user_id FROM product_orders WHERE id = $1",
    )
    .bind(order_id)
    .map(|row: sqlx::postgres::PgRow| row.get::<i32, _>("provider_user_id"))
    .fetch_optional(&state.pg)
    .await?;

    let provider_user_id = provider_user_id.ok_or_else(|| AppError::NotFound("Commande non trouvée".to_string()))?;

    if provider_user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le prestataire de cette commande".to_string(),
        ));
    }

    let order_service = OrderPreparationService::new(state.pg.clone());
    let updated_order = order_service
        .validate_order(order_id, user.id, payload)
        .await?;

    // ✅ NOUVEAU : Si la commande est "ready" (is_immediately_available = TRUE), démarrer le matching immédiatement
    if updated_order.status == "ready" {
        // Récupérer la livraison associée
        if let Some(delivery_id) = updated_order.delivery_id {
            // Utiliser le delivery_service depuis l'état
            if let Ok(summary) = state.delivery_service.get_delivery_summary(delivery_id).await {
                // Démarrer le matching immédiatement
                if let Err(e) = state.delivery_service.enqueue_delivery_matching(&summary).await {
                    log::warn!(
                        "[OrderRoutes] Erreur démarrage matching pour delivery_id={}: {}",
                        delivery_id, e
                    );
                    // Ne pas faire échouer la validation si le matching échoue
                } else {
                    log::info!(
                        "[OrderRoutes] ✅ Matching démarré immédiatement pour delivery_id={} (commande ready)",
                        delivery_id
                    );
                }
            }
        }
    }

    // Notifier le client
    let notification_service = SmartNotificationService::new(state.pg.clone());
    notification_service
        .notify_client_order_ready(updated_order.client_user_id, order_id)
        .await?;

    Ok(Json(json!({
        "success": true,
        "order": updated_order,
        "message": "Commande validée avec succès"
    })))
}

/// POST /api/delivery/orders/:order_id/reject - Prestataire rejette une commande
async fn reject_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<RejectOrderRequest>,
) -> Result<Json<Value>, AppError> {
    // Vérifier que l'utilisateur est le prestataire
    struct OrderInfo {
        provider_user_id: i32,
        service_id: i32,
        product_index: i32,
        client_user_id: i32,
    }
    
    let order: Option<OrderInfo> = sqlx::query(
        "SELECT provider_user_id, service_id, product_index, client_user_id FROM product_orders WHERE id = $1",
    )
    .bind(order_id)
    .map(|row: sqlx::postgres::PgRow| OrderInfo {
        provider_user_id: row.get::<i32, _>("provider_user_id"),
        service_id: row.get::<i32, _>("service_id"),
        product_index: row.get::<i32, _>("product_index"),
        client_user_id: row.get::<i32, _>("client_user_id"),
    })
    .fetch_optional(&state.pg)
    .await?;

    let order = order.ok_or_else(|| AppError::NotFound("Commande non trouvée".to_string()))?;

    if order.provider_user_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le prestataire de cette commande".to_string(),
        ));
    }

    let order_service = OrderPreparationService::new(state.pg.clone());
    let updated_order = order_service
        .reject_order(order_id, order.provider_user_id, payload)
        .await?;

    // Notifier le client avec produits similaires
    let notification_service = SmartNotificationService::new(state.pg.clone());
    notification_service
        .notify_client_order_rejected_with_alternatives(
            order.client_user_id,
            order_id,
            order.service_id,
            order.product_index,
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "order": updated_order,
        "message": "Commande rejetée"
    })))
}

/// GET /api/delivery/orders/:order_id/similar - Récupérer produits similaires
async fn get_similar_products(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    // Récupérer les infos de la commande
    struct OrderBasicInfo {
        service_id: i32,
        product_index: i32,
        client_user_id: i32,
    }
    
    let order: Option<OrderBasicInfo> = sqlx::query(
        "SELECT service_id, product_index, client_user_id FROM product_orders WHERE id = $1",
    )
    .bind(order_id)
    .map(|row: sqlx::postgres::PgRow| OrderBasicInfo {
        service_id: row.get::<i32, _>("service_id"),
        product_index: row.get::<i32, _>("product_index"),
        client_user_id: row.get::<i32, _>("client_user_id"),
    })
    .fetch_optional(&state.pg)
    .await?;

    let order = order.ok_or_else(|| AppError::NotFound("Commande non trouvée".to_string()))?;

    // ✅ AMÉLIORATION : Récupérer les coordonnées GPS du client si disponibles
    // Note: users table n'a pas de colonnes latitude/longitude, utiliser gps ou autre
    let client_gps: Option<(f64, f64)> = sqlx::query(
        "SELECT gps FROM users WHERE id = $1",
    )
    .bind(order.client_user_id)
    .map(|row: sqlx::postgres::PgRow| {
        let gps_str: Option<String> = row.try_get("gps").ok();
        // Parser le GPS si nécessaire (format "lat,lng")
        gps_str.and_then(|gps| {
            let parts: Vec<&str> = gps.split(',').collect();
            if parts.len() == 2 {
                parts[0].parse::<f64>().ok().and_then(|lat| {
                    parts[1].parse::<f64>().ok().map(|lng| (lat, lng))
                })
            } else {
                None
            }
        })
    })
    .fetch_optional(&state.pg)
    .await?;

    let (client_lat, client_lng) = if let Some(gps) = client_gps {
        (gps.latitude, gps.longitude)
    } else {
        (None, None)
    };

    // ✅ AMÉLIORATION : Utiliser GeographicMatchingService si disponible (Google Maps priorité + fallback local)
    let similar_service = if let Some(geo_service) = state.geographic_matching.as_ref() {
        SimilarProductsService::with_geographic_matching(
            state.pg.clone(),
            geo_service.clone(),
        )
    } else {
        SimilarProductsService::new(state.pg.clone())
    };
    
    let similar_products = similar_service
        .find_similar_products_with_location(
            order.service_id, 
            order.product_index, 
            10,
            client_lat,
            client_lng,
        )
        .await?;

    Ok(Json(json!({
        "similar_products": similar_products
    })))
}

/// GET /api/delivery/orders/:order_id - Récupérer une commande
async fn get_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    // Utiliser sqlx::query pour éviter les problèmes d'inférence de type en mode offline
    let order: Option<Value> = sqlx::query(
        r#"
        SELECT 
            id,
            delivery_id,
            service_id,
            product_index,
            client_user_id,
            provider_user_id,
            status,
            preparation_time_minutes,
            estimated_ready_at,
            validated_at,
            validated_by,
            rejected_at,
            rejection_reason,
            validation_deadline,
            created_at,
            updated_at,
            metadata
        FROM product_orders
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .map(|row: sqlx::postgres::PgRow| {
        json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "delivery_id": row.try_get::<Option<uuid::Uuid>, _>("delivery_id").ok(),
            "service_id": row.get::<i32, _>("service_id"),
            "product_index": row.get::<i32, _>("product_index"),
            "client_user_id": row.get::<i32, _>("client_user_id"),
            "provider_user_id": row.get::<i32, _>("provider_user_id"),
            "status": row.get::<String, _>("status"),
            "preparation_time_minutes": row.try_get::<Option<i32>, _>("preparation_time_minutes").ok(),
            "estimated_ready_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("estimated_ready_at").ok(),
            "validated_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("validated_at").ok(),
            "validated_by": row.try_get::<Option<i32>, _>("validated_by").ok(),
            "rejected_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("rejected_at").ok(),
            "rejection_reason": row.try_get::<Option<String>, _>("rejection_reason").ok(),
            "validation_deadline": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("validation_deadline").ok(),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "updated_at": row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            "metadata": row.try_get::<Value, _>("metadata").unwrap_or_else(|_| json!({})),
        })
    })
    .fetch_optional(&state.pg)
    .await?;

    let order_value = order.ok_or_else(|| AppError::NotFound("Commande non trouvée".to_string()))?;
    
    let client_user_id = order_value.get("client_user_id").and_then(|v| v.as_i64()).map(|v| v as i32);
    let provider_user_id = order_value.get("provider_user_id").and_then(|v| v.as_i64()).map(|v| v as i32);

    // Vérifier que l'utilisateur est le client ou le prestataire
    if let (Some(client_id), Some(provider_id)) = (client_user_id, provider_user_id) {
        if user.id != client_id && user.id != provider_id {
            return Err(AppError::Unauthorized(
                "Vous n'avez pas accès à cette commande".to_string(),
            ));
        }
    } else {
        return Err(AppError::Internal("Données de commande invalides".to_string()));
    }

    Ok(Json(json!({
        "order": order_value
    })))
}

/// GET /api/delivery/orders/provider/pending - Liste des commandes en attente pour le prestataire
async fn get_provider_pending_orders(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, AppError> {
    // Utiliser sqlx::query pour éviter les problèmes d'inférence de type en mode offline
    let orders: Vec<Value> = sqlx::query(
        r#"
        SELECT 
            id,
            delivery_id,
            service_id,
            product_index,
            client_user_id,
            provider_user_id,
            status,
            preparation_time_minutes,
            estimated_ready_at,
            validated_at,
            validated_by,
            rejected_at,
            rejection_reason,
            validation_deadline,
            created_at,
            updated_at,
            metadata
        FROM product_orders
        WHERE provider_user_id = $1
        AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(user.id)
    .map(|row: sqlx::postgres::PgRow| {
        json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "delivery_id": row.try_get::<Option<uuid::Uuid>, _>("delivery_id").ok(),
            "service_id": row.get::<i32, _>("service_id"),
            "product_index": row.get::<i32, _>("product_index"),
            "client_user_id": row.get::<i32, _>("client_user_id"),
            "provider_user_id": row.get::<i32, _>("provider_user_id"),
            "status": row.get::<String, _>("status"),
            "preparation_time_minutes": row.try_get::<Option<i32>, _>("preparation_time_minutes").ok(),
            "estimated_ready_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("estimated_ready_at").ok(),
            "validated_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("validated_at").ok(),
            "validated_by": row.try_get::<Option<i32>, _>("validated_by").ok(),
            "rejected_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("rejected_at").ok(),
            "rejection_reason": row.try_get::<Option<String>, _>("rejection_reason").ok(),
            "validation_deadline": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("validation_deadline").ok(),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "updated_at": row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            "metadata": row.try_get::<Value, _>("metadata").unwrap_or_else(|_| json!({})),
        })
    })
    .fetch_all(&state.pg)
    .await?;

    Ok(Json(json!({
        "orders": orders
    })))
}

/// GET /api/delivery/orders/client/my-orders - Liste des commandes du client
async fn get_client_orders(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, AppError> {
    // Utiliser sqlx::query pour éviter les problèmes d'inférence de type en mode offline
    let orders: Vec<Value> = sqlx::query(
        r#"
        SELECT 
            id,
            delivery_id,
            service_id,
            product_index,
            client_user_id,
            provider_user_id,
            status,
            preparation_time_minutes,
            estimated_ready_at,
            validated_at,
            validated_by,
            rejected_at,
            rejection_reason,
            validation_deadline,
            created_at,
            updated_at,
            metadata
        FROM product_orders
        WHERE client_user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(user.id)
    .map(|row: sqlx::postgres::PgRow| {
        json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "delivery_id": row.try_get::<Option<uuid::Uuid>, _>("delivery_id").ok(),
            "service_id": row.get::<i32, _>("service_id"),
            "product_index": row.get::<i32, _>("product_index"),
            "client_user_id": row.get::<i32, _>("client_user_id"),
            "provider_user_id": row.get::<i32, _>("provider_user_id"),
            "status": row.get::<String, _>("status"),
            "preparation_time_minutes": row.try_get::<Option<i32>, _>("preparation_time_minutes").ok(),
            "estimated_ready_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("estimated_ready_at").ok(),
            "validated_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("validated_at").ok(),
            "validated_by": row.try_get::<Option<i32>, _>("validated_by").ok(),
            "rejected_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("rejected_at").ok(),
            "rejection_reason": row.try_get::<Option<String>, _>("rejection_reason").ok(),
            "validation_deadline": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("validation_deadline").ok(),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "updated_at": row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            "metadata": row.try_get::<Value, _>("metadata").unwrap_or_else(|_| json!({})),
        })
    })
    .fetch_all(&state.pg)
    .await?;

    Ok(Json(json!({
        "orders": orders
    })))
}

