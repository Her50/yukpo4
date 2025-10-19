use std::sync::Arc;
use axum::{
    extract::{State, Path, Query},
    response::Json,
};
use serde::{Deserialize, Serialize};
use crate::core::types::{AppError, AppResult};
use crate::tasks::product_deactivation::{
    get_inactive_products_for_user,
    reactivate_single_product,
    reactivate_multiple_products,
};
use crate::middlewares::auth::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ReactivateProductRequest {
    pub service_id: i32,
    pub product_index: i32,
}

#[derive(Debug, Deserialize)]
pub struct ReactivateMultipleProductsRequest {
    pub service_id: i32,
    pub product_indices: Vec<i32>,
}

#[derive(Debug, Serialize)]
pub struct ProductLifecycleResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ReactivationCostQuery {
    pub count: Option<i32>,
}

/// GET /api/products/inactive - Récupère les produits désactivés du prestataire
pub async fn get_inactive_products(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    // Extraire le user_id depuis le token JWT
    let user_id: i32 = auth.user_id.parse()
        .map_err(|_| AppError::BadRequest("Invalid user_id format".to_string()))?;
    
    // Récupérer les produits désactivés
    let inactive_products = get_inactive_products_for_user(&state.pg, user_id)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération produits inactifs: {}", e)))?;
    
    Ok(Json(serde_json::json!({
        "success": true,
        "products": inactive_products,
        "count": inactive_products.len(),
        "total_reactivation_cost": inactive_products.len() * 1000, // 1000 FCFA par produit
    })))
}

/// GET /api/products/:service_id/status - Statut des produits d'un service
pub async fn get_products_status(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(service_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id: i32 = auth.user_id.parse()
        .map_err(|_| AppError::BadRequest("Invalid user_id format".to_string()))?;
    
    // Vérifier que le service appartient à l'utilisateur
    use sqlx::Row;
    let service = sqlx::query("SELECT user_id FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur DB: {}", e)))?;
    
    match service {
        Some(row) => {
            let owner_id: i32 = row.try_get("user_id")
                .map_err(|e| AppError::Internal(format!("Erreur lecture user_id: {}", e)))?;
            
            if owner_id != user_id {
                return Err(AppError::Forbidden("Accès refusé à ce service".to_string()));
            }
            
            // Récupérer le statut des produits
            let rows = sqlx::query("SELECT * FROM get_service_products_status($1)")
                .bind(service_id)
                .fetch_all(&state.pg)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur récupération statut: {}", e)))?;
            
            let mut products = Vec::new();
            for row in rows {
                products.push(serde_json::json!({
                    "product_index": row.try_get::<i32, _>("product_index").ok(),
                    "product_nom": row.try_get::<String, _>("product_nom").ok(),
                    "product_type": row.try_get::<String, _>("product_type").ok(),
                    "is_active": row.try_get::<bool, _>("is_active").ok(),
                    "days_until_deactivation": row.try_get::<i32, _>("days_until_deactivation").ok(),
                    "reactivation_cost": row.try_get::<i32, _>("reactivation_cost").ok(),
                }));
            }
            
            Ok(Json(serde_json::json!({
                "success": true,
                "service_id": service_id,
                "products": products,
                "total_products": products.len(),
            })))
        },
        None => Err(AppError::NotFound("Service non trouvé".to_string())),
    }
}

/// POST /api/products/reactivate - Réactive un produit
pub async fn reactivate_product(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<ReactivateProductRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id: i32 = auth.user_id.parse()
        .map_err(|_| AppError::BadRequest("Invalid user_id format".to_string()))?;
    
    // Appeler la fonction de réactivation
    let result = reactivate_single_product(
        &state.pg,
        body.service_id,
        body.product_index,
        user_id,
    )
    .await
    .map_err(|e| AppError::Internal(e))?;
    
    Ok(Json(serde_json::to_value(result).unwrap_or_else(|_| serde_json::json!({
        "success": false,
        "error": "Erreur de sérialisation"
    }))))
}

/// POST /api/products/reactivate-multiple - Réactive plusieurs produits
pub async fn reactivate_multiple(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<ReactivateMultipleProductsRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id: i32 = auth.user_id.parse()
        .map_err(|_| AppError::BadRequest("Invalid user_id format".to_string()))?;
    
    // Vérifier que l'utilisateur a des produits à réactiver
    if body.product_indices.is_empty() {
        return Err(AppError::BadRequest("Aucun produit spécifié".to_string()));
    }
    
    // Appeler la fonction de réactivation multiple
    let result = reactivate_multiple_products(
        &state.pg,
        body.service_id,
        body.product_indices.clone(),
        user_id,
    )
    .await
    .map_err(|e| AppError::Internal(e))?;
    
    Ok(Json(serde_json::to_value(result).unwrap_or_else(|_| serde_json::json!({
        "success": false,
        "error": "Erreur de sérialisation"
    }))))
}

/// GET /api/products/reactivation-cost - Obtient le coût de réactivation
pub async fn get_reactivation_cost(
    _auth: AuthUser,
    Query(query): Query<ReactivationCostQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let product_count = query.count.unwrap_or(1);
    let cost_per_product = 1000; // 1000 FCFA
    let total_cost = cost_per_product * product_count;
    
    Ok(Json(serde_json::json!({
        "success": true,
        "cost_per_product": cost_per_product,
        "product_count": product_count,
        "total_cost": total_cost,
        "currency": "FCFA"
    })))
}
