use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use crate::core::types::AppError;
use crate::tasks::product_deactivation::{
    get_inactive_products_for_user,
    reactivate_single_product,
    reactivate_multiple_products,
    InactiveProduct,
};
use crate::utils::auth::get_user_id_from_request;

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

/// GET /api/products/inactive - Récupère les produits désactivés du prestataire
pub async fn get_inactive_products(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    // Extraire le user_id depuis le token JWT
    let user_id = get_user_id_from_request(&req)?;
    
    // Récupérer les produits désactivés
    let inactive_products = get_inactive_products_for_user(&pool, user_id)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération produits inactifs: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "products": inactive_products,
        "count": inactive_products.len(),
        "total_reactivation_cost": inactive_products.len() * 1000, // 1000 FCFA par produit
    })))
}

/// GET /api/products/:service_id/status - Statut des produits d'un service
pub async fn get_products_status(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    path: web::Path<i32>,
) -> Result<HttpResponse, AppError> {
    let service_id = path.into_inner();
    let user_id = get_user_id_from_request(&req)?;
    
    // Vérifier que le service appartient à l'utilisateur
    let service = sqlx::query!(
        "SELECT user_id FROM services WHERE id = $1",
        service_id
    )
    .fetch_optional(pool.get_ref())
    .await
    .map_err(|e| AppError::Internal(format!("Erreur DB: {}", e)))?;
    
    match service {
        Some(s) if s.user_id == user_id => {
            // Récupérer le statut des produits
            let products_status = sqlx::query!(
                r#"
                SELECT * FROM get_service_products_status($1)
                "#,
                service_id
            )
            .fetch_all(pool.get_ref())
            .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération statut: {}", e)))?;
            
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "service_id": service_id,
                "products": products_status,
                "total_products": products_status.len(),
                "active_products": products_status.iter().filter(|p| p.is_active.unwrap_or(false)).count(),
                "inactive_products": products_status.iter().filter(|p| !p.is_active.unwrap_or(true)).count(),
            })))
        },
        Some(_) => Err(AppError::Forbidden("Accès refusé à ce service".to_string())),
        None => Err(AppError::NotFound("Service non trouvé".to_string())),
    }
}

/// POST /api/products/reactivate - Réactive un produit
pub async fn reactivate_product(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    body: web::Json<ReactivateProductRequest>,
) -> Result<HttpResponse, AppError> {
    let user_id = get_user_id_from_request(&req)?;
    
    // Appeler la fonction de réactivation
    let result = reactivate_single_product(
        pool.get_ref(),
        body.service_id,
        body.product_index,
        user_id,
    )
    .await
    .map_err(|e| AppError::Internal(e))?;
    
    if result.success {
        Ok(HttpResponse::Ok().json(result))
    } else {
        Ok(HttpResponse::BadRequest().json(result))
    }
}

/// POST /api/products/reactivate-multiple - Réactive plusieurs produits
pub async fn reactivate_multiple(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    body: web::Json<ReactivateMultipleProductsRequest>,
) -> Result<HttpResponse, AppError> {
    let user_id = get_user_id_from_request(&req)?;
    
    // Vérifier que l'utilisateur a des produits à réactiver
    if body.product_indices.is_empty() {
        return Err(AppError::BadRequest("Aucun produit spécifié".to_string()));
    }
    
    // Appeler la fonction de réactivation multiple
    let result = reactivate_multiple_products(
        pool.get_ref(),
        body.service_id,
        body.product_indices.clone(),
        user_id,
    )
    .await
    .map_err(|e| AppError::Internal(e))?;
    
    if result.success {
        Ok(HttpResponse::Ok().json(result))
    } else {
        Ok(HttpResponse::BadRequest().json(result))
    }
}

/// GET /api/products/reactivation-cost - Obtient le coût de réactivation
pub async fn get_reactivation_cost(
    req: HttpRequest,
    query: web::Query<ReactivationCostQuery>,
) -> Result<HttpResponse, AppError> {
    let _user_id = get_user_id_from_request(&req)?;
    
    let product_count = query.count.unwrap_or(1);
    let cost_per_product = 1000; // 1000 FCFA
    let total_cost = cost_per_product * product_count;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "cost_per_product": cost_per_product,
        "product_count": product_count,
        "total_cost": total_cost,
        "currency": "FCFA"
    })))
}

#[derive(Debug, Deserialize)]
pub struct ReactivationCostQuery {
    pub count: Option<i32>,
}

