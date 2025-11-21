use crate::core::types::{AppError, AppResult};
use crate::services::notification_service::{create_notification, NotificationType};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};

#[derive(FromRow)]
struct ServiceDataRow {
    data: Value,
}

#[derive(FromRow)]
struct DeliveryConfigRow {
    is_configured: Option<bool>,
}

#[derive(FromRow)]
struct ServiceInfoRow {
    user_id: i32,
    data: Value,
}

#[derive(FromRow)]
struct NotificationIdRow {
    id: i32,
}

/// Résultat de la validation d'un produit pour activation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub missing_fields: Vec<String>,
}

/// Valide qu'un produit peut être activé (vérifie nom, prix, et configuration livraison)
pub async fn validate_product_for_activation(
    pool: &PgPool,
    service_id: i32,
    product_index: i32,
) -> AppResult<ProductValidationResult> {
    // 1. Vérifier existence produit
    let service: Option<ServiceDataRow> = sqlx::query_as(
        "SELECT data FROM services WHERE id = $1"
    )
    .bind(service_id)
    .fetch_optional(pool)
    .await?;
    
    let service_data = service.ok_or_else(|| {
        AppError::NotFound("Service non trouvé".into())
    })?;
    
    let products = service_data.data
        .get("produits")
        .and_then(|p| p.get("valeur"))
        .and_then(|v| v.as_array());
    
    let product = products
        .and_then(|arr| arr.get(product_index as usize))
        .ok_or_else(|| {
            AppError::BadRequest("Produit non trouvé".into())
        })?;
    
    // 2. Vérifier configuration livraison
    let delivery_config: Option<DeliveryConfigRow> = sqlx::query_as(
        "SELECT is_configured FROM product_delivery_config 
         WHERE service_id = $1 AND product_index = $2"
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_optional(pool)
    .await?;
    
    let is_delivery_configured = delivery_config
        .and_then(|c| c.is_configured)
        .unwrap_or(false);
    
    // 3. Vérifier autres champs obligatoires
    let has_name = product.get("nom")
        .and_then(|v| v.as_str())
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    
    let has_price = product.get("prix")
        .and_then(|v| v.as_str())
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    
    let errors: Vec<String> = vec![
        (!has_name, "Nom du produit requis".into()),
        (!has_price, "Prix du produit requis".into()),
        (!is_delivery_configured, "Configuration livraison requise".into()),
    ]
    .into_iter()
    .filter(|(condition, _)| *condition)
    .map(|(_, msg)| msg)
    .collect();
    
    let is_valid = errors.is_empty();
    
    Ok(ProductValidationResult {
        is_valid,
        errors: errors.clone(),
        missing_fields: vec![
            (!has_name, "nom".into()),
            (!has_price, "prix".into()),
            (!is_delivery_configured, "delivery_config".into()),
        ]
        .into_iter()
        .filter(|(condition, _)| *condition)
        .map(|(_, field)| field)
        .collect(),
    })
}

/// Active un produit si toutes les validations passent
pub async fn activate_product_if_valid(
    pool: &PgPool,
    service_id: i32,
    product_index: i32,
) -> AppResult<bool> {
    let validation = validate_product_for_activation(pool, service_id, product_index).await?;
    
    if !validation.is_valid {
        return Ok(false);  // Produit non validé, ne pas activer
    }
    
    // Marquer le produit comme actif dans products_lifecycle
    let result = sqlx::query(
        r#"
        UPDATE products_lifecycle
        SET is_active = TRUE,
            updated_at = NOW()
        WHERE service_id = $1 AND product_index = $2
        "#
    )
    .bind(service_id)
    .bind(product_index)
    .execute(pool)
    .await?;
    
    // Si aucune ligne n'a été mise à jour, le produit n'existe pas dans products_lifecycle
    // On peut soit créer l'entrée, soit retourner false
    if result.rows_affected() == 0 {
        // Optionnel : créer l'entrée si elle n'existe pas
        // Pour l'instant, on retourne false
        return Ok(false);
    }
    
    Ok(true)
}

/// Vérifie si un produit a une configuration de livraison complète
pub async fn has_delivery_config(
    pool: &PgPool,
    service_id: i32,
    product_index: i32,
) -> AppResult<bool> {
    let config: Option<DeliveryConfigRow> = sqlx::query_as(
        "SELECT is_configured FROM product_delivery_config 
         WHERE service_id = $1 AND product_index = $2"
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_optional(pool)
    .await?;
    
    Ok(config.and_then(|c| c.is_configured).unwrap_or(false))
}

/// ✅ Phase 2 - Amélioration 6 : Envoie une notification au prestataire si la configuration livraison est incomplète
pub async fn notify_missing_delivery_config(
    pool: &PgPool,
    service_id: i32,
    product_index: i32,
) -> AppResult<()> {
    // Récupérer les infos du service et du produit
    let service_info: Option<ServiceInfoRow> = sqlx::query_as(
        r#"
        SELECT s.user_id, s.data
        FROM services s
        WHERE s.id = $1
        "#
    )
    .bind(service_id)
    .fetch_optional(pool)
    .await?;

    let service_data = service_info.ok_or_else(|| {
        AppError::NotFound("Service non trouvé".into())
    })?;

    let products = service_data.data
        .get("produits")
        .and_then(|p| p.get("valeur"))
        .and_then(|v| v.as_array());

    let product = products
        .and_then(|arr| arr.get(product_index as usize))
        .ok_or_else(|| {
            AppError::BadRequest("Produit non trouvé".into())
        })?;

    let product_name = product
        .get("nom")
        .and_then(|v| v.as_str())
        .unwrap_or("Produit");

    // Vérifier si une notification a déjà été envoyée récemment (dans les dernières 24h)
    let recent_notification: Option<NotificationIdRow> = sqlx::query_as(
        r#"
        SELECT id FROM notifications
        WHERE user_id = $1
          AND notification_type = 'product_delivery_config_missing'
          AND data->>'service_id' = $2::text
          AND data->>'product_index' = $3::text
          AND created_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
        "#
    )
    .bind(service_data.user_id)
    .bind(service_id.to_string())
    .bind(product_index.to_string())
    .fetch_optional(pool)
    .await?;

    // Si une notification récente existe, ne pas en envoyer une nouvelle
    if recent_notification.is_some() {
        return Ok(());
    }

    // Vérifier si la configuration est vraiment manquante
    let validation = validate_product_for_activation(pool, service_id, product_index).await?;
    
    if validation.is_valid {
        // Configuration complète, pas besoin de notification
        return Ok(());
    }

    // Envoyer la notification
    let _notification_id = create_notification(
        pool,
        service_data.user_id,
        NotificationType::ProductDeliveryConfigMissing,
        format!("⚠️ Configuration livraison incomplète : {}", product_name),
        format!(
            "Votre produit '{}' ne peut pas être activé car la configuration de livraison est incomplète. Veuillez compléter : {}",
            product_name,
            validation.missing_fields.join(", ")
        ),
        Some(serde_json::json!({
            "service_id": service_id,
            "product_index": product_index,
            "product_name": product_name,
            "missing_fields": validation.missing_fields,
            "errors": validation.errors,
            "type": "product_delivery_config_missing"
        })),
    )
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création notification: {}", e)))?;

    Ok(())
}

