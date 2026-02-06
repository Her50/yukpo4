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
    response::{Html, Redirect},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
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
pub async fn get_products_by_service(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<Vec<ProductResponse>>> {
    let products_service = &state.products_service;

    let products = products_service.get_active_products_by_service(service_id).await?;

    let response: Vec<ProductResponse> = products
        .into_iter()
        .map(|p| ProductResponse {
            id: p.id,
            service_id: p.service_id,
            product_index: p.product_index,
            product_data: p.product_data,
            product_name: p.product_name,
            product_type: p.product_type,
            product_price: p.product_price,
            is_active: p.is_active,
            created_at: p.created_at,
            updated_at: p.updated_at,
            auto_deactivate_at: p.auto_deactivate_at,
        })
        .collect();

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

    // Générer la page HTML
    let html = format!(
        r#"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{} - Yukpomnang</title>
    <meta property="og:title" content="{}" />
    <meta property="og:description" content="Découvrez ce produit sur Yukpomnang" />
    <meta property="og:type" content="product" />
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
    </style>
</head>
<body>
    <div class="container">
        <h1>{}</h1>
        {}
        <div class="description">
            Découvrez ce produit et bien plus sur Yukpomnang
        </div>
        <button class="button" onclick="openApp()">
            📱 Ouvrir dans l'app Yukpomnang
        </button>
    </div>
    <script>
        function openApp() {{
            const deepLink = 'yukpomnang://product/{}?serviceId={}';
            const appStoreUrl = 'https://apps.apple.com/app/yukpomnang';
            const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.yukpomnang.app';
            
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
    </script>
</body>
</html>
"#,
        product_name,
        product_name,
        product_name,
        product_price
            .map(|p| format!(r#"<div class="price">{} XAF</div>"#, p))
            .unwrap_or_else(|| "".to_string()),
        product_id,
        service_id
    );

    log::info!(
        "🌐 Affichage page web produit: {} (User-Agent: {})",
        product_id,
        user_agent
    );

    Ok(Html(html).into_response())
}
