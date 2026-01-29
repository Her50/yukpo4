// ✅ NOUVEAU 2025-11-01: Gestion complète du cycle de vie des produits
// Désactivation manuelle, auto (30j), réactivation avec coût variable

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use crate::utils::log::log_warn;
use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct DeactivateProductRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProductLifecycleResponse {
    pub success: bool,
    pub message: String,
    pub cost: Option<i64>,
    pub new_balance: Option<i64>,
}

/// Coûts de réactivation configurables
mod reactivation_costs {
    /// Coût fixe après 30 jours de désactivation ou désactivation automatique
    pub const COST_REACTIVATION_30DAYS_XAF: i64 = 1000;

    /// Coût minimum (prorata)
    pub const COST_REACTIVATION_MIN_XAF: i64 = 100;

    /// Calculer le coût de réactivation selon la durée et le type
    pub fn calculate_reactivation_cost(days_inactive: i64, deactivation_type: &str) -> i64 {
        if deactivation_type == "auto" || days_inactive >= 30 {
            // Coût fixe après 30 jours ou désactivation automatique
            COST_REACTIVATION_30DAYS_XAF
        } else {
            // Prorata si désactivation manuelle avant 30j
            // Formule: (jours_inactifs / 30) * 1000
            let prorata =
                ((days_inactive as f64 / 30.0) * COST_REACTIVATION_30DAYS_XAF as f64).ceil() as i64;
            prorata.max(COST_REACTIVATION_MIN_XAF) // Minimum 100 FCFA
        }
    }
}

/// Désactiver un produit manuellement
/// Route : POST /api/services/{service_id}/products/{product_index}/deactivate
#[axum::debug_handler]
pub async fn deactivate_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, usize)>,
    Json(request): Json<DeactivateProductRequest>,
) -> AppResult<Json<ProductLifecycleResponse>> {
    use crate::utils::log::log_info;

    log_info(&format!(
        "[deactivate_product] 🔴 Désactivation produit {} du service {}",
        product_index, service_id
    ));

    // ✅ PHASE 5: Utiliser service_products table au lieu de JSONB
    // Vérifier propriétaire du service
    let owner_id: i32 = sqlx::query_scalar("SELECT user_id FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?
        .ok_or_else(|| AppError::NotFound(format!("Service {} introuvable", service_id)))?;

    if owner_id != user.id {
        log_warn(&format!(
            "[deactivate_product] User {} n'est pas propriétaire du service {}",
            user.id, service_id
        ));
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le propriétaire de ce service".to_string(),
        ));
    }

    // Récupérer le produit actuel pour vérifier s'il est déjà désactivé et obtenir le nom
    let products_service = &state.products_service;
    let current_product = products_service
        .get_product(service_id, product_index as i32)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Produit {} introuvable", product_index)))?;

    if !current_product.is_active {
        return Err(AppError::BadRequest(
            "Le produit est déjà désactivé".to_string(),
        ));
    }

    // Nom du produit pour la notification
    let product_name = current_product
        .product_data
        .get("nom")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("Produit #{}", product_index + 1));

    // Préparer les données de désactivation
    let mut deactivation_data = json!({
        "deactivated_at": Utc::now().to_rfc3339(),
        "deactivation_type": "manual"
    });
    if let Some(reason) = request.reason {
        deactivation_data
            .as_object_mut()
            .unwrap()
            .insert("deactivation_reason".to_string(), json!(reason));
    }

    // Désactiver via ProductsService
    products_service
        .set_product_active(
            service_id,
            product_index as i32,
            false,
            Some(deactivation_data),
        )
        .await?;

    let _ = crate::services::notification_service::create_notification(
        &state.pg,
        user.id,
        crate::services::notification_service::NotificationType::SystemAlert,
        "🔴 Produit désactivé".to_string(),
        format!("Votre produit '{}' a été désactivé avec succès. Vous pouvez le réactiver à tout moment.", product_name),
        Some(json!({
            "service_id": service_id,
            "product_index": product_index,
            "product_name": product_name
        }))
    ).await;

    log_info(&format!(
        "[deactivate_product] ✅ Produit {} désactivé avec succès",
        product_index
    ));

    Ok(Json(ProductLifecycleResponse {
        success: true,
        message: format!("Produit '{}' désactivé avec succès", product_name),
        cost: None,
        new_balance: None,
    }))
}

/// Réactiver un produit (avec coût variable)
/// Route : POST /api/services/{service_id}/products/{product_index}/reactivate
#[axum::debug_handler]
pub async fn reactivate_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, usize)>,
) -> AppResult<Json<ProductLifecycleResponse>> {
    use crate::utils::log::{log_error, log_info};

    log_info(&format!(
        "[reactivate_product] 🟢 Réactivation produit {} du service {}",
        product_index, service_id
    ));

    // ✅ PHASE 5: Utiliser service_products table au lieu de JSONB
    // Vérifier propriétaire du service
    let owner_id: i32 = sqlx::query_scalar("SELECT user_id FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?
        .ok_or_else(|| AppError::NotFound(format!("Service {} introuvable", service_id)))?;

    if owner_id != user.id {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le propriétaire de ce service".to_string(),
        ));
    }

    // Récupérer le produit actuel
    let products_service = &state.products_service;
    let current_product = products_service
        .get_product(service_id, product_index as i32)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Produit {} introuvable", product_index)))?;

    // Vérifier si déjà actif
    if current_product.is_active {
        return Err(AppError::BadRequest(
            "Le produit est déjà actif".to_string(),
        ));
    }

    // Calculer le coût de réactivation à partir de product_data
    let product_data = &current_product.product_data;
    let deactivated_at_str = product_data
        .get("deactivated_at")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Internal("Date de désactivation manquante".to_string()))?;

    let deactivated_at = chrono::DateTime::parse_from_rfc3339(deactivated_at_str)
        .map_err(|e| AppError::Internal(format!("Date invalide: {}", e)))?
        .naive_utc();

    let deactivation_type = product_data
        .get("deactivation_type")
        .and_then(|v| v.as_str())
        .unwrap_or("manual");

    let now = Utc::now().naive_utc();
    let days_inactive = (now - deactivated_at).num_days();
    let cost = reactivation_costs::calculate_reactivation_cost(days_inactive, deactivation_type);

    // Nom du produit pour les notifications
    let product_name: String = product_data
        .get("nom")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("Produit #{}", product_index + 1));

    log_info(&format!(
        "[reactivate_product] 💰 Coût calculé: {} FCFA ({} jours)",
        cost, days_inactive
    ));

    // Vérifier le solde
    let current_balance = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération solde: {}", e)))?
        .try_get::<i64, _>("tokens_balance")
        .unwrap_or(0);

    if current_balance < cost {
        log_error(&format!(
            "[reactivate_product] Solde insuffisant: {} < {}",
            current_balance, cost
        ));
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant: {} FCFA disponible, {} FCFA requis pour réactiver ce produit",
            current_balance, cost
        )));
    }

    // Débiter le solde
    let new_balance = sqlx::query(
        "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 RETURNING tokens_balance"
    )
    .bind(cost)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur débit solde: {}", e)))?
    .try_get::<i64, _>("tokens_balance")
    .unwrap_or(0);

    log_info(&format!(
        "[reactivate_product] ✅ Solde débité: {} FCFA (nouveau: {})",
        cost, new_balance
    ));

    // Réactiver via ProductsService (pas d'écriture JSONB)
    products_service
        .set_product_active(service_id, product_index as i32, true, None)
        .await?;

    let _ = crate::services::notification_service::create_notification(
        &state.pg,
        user.id,
        crate::services::notification_service::NotificationType::SystemAlert,
        "🟢 Produit réactivé".to_string(),
        format!(
            "Votre produit '{}' a été réactivé avec succès. Coût: {} FCFA.",
            product_name, cost
        ),
        Some(json!({
            "service_id": service_id,
            "product_index": product_index,
            "product_name": product_name,
            "cost": cost,
            "days_inactive": days_inactive
        })),
    )
    .await;

    log_info(&format!(
        "[reactivate_product] ✅ Produit {} réactivé (coût: {} FCFA)",
        product_index, cost
    ));

    Ok(Json(ProductLifecycleResponse {
        success: true,
        message: format!("Produit '{}' réactivé avec succès", product_name),
        cost: Some(cost),
        new_balance: Some(new_balance),
    }))
}

/// Désactivation automatique des produits après 30 jours (CRON JOB)
/// À appeler quotidiennement via un job scheduler
/// ✅ PHASE 6: Utilise service_products table au lieu de JSONB
pub async fn auto_deactivate_expired_products(pool: &sqlx::PgPool) -> Result<usize, String> {
    use crate::utils::log::log_info;

    log_info("[auto_deactivate] 🤖 Démarrage du job de désactivation automatique...");

    // ✅ PHASE 6: Utiliser ProductsService au lieu de JSONB
    let products_service =
        crate::services::products_service::ProductsService::new(Arc::new(pool.clone()));
    let threshold_date = Utc::now() - chrono::Duration::days(30);
    let mut products_deactivated = 0;

    // Récupérer tous les services actifs (seulement id et user_id, plus besoin de data)
    let services = sqlx::query("SELECT id, user_id FROM services WHERE is_active = true")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Erreur récupération services: {}", e))?;

    for service_row in services {
        let service_id: i32 = service_row
            .try_get("id")
            .map_err(|e| format!("Erreur récupération service_id: {}", e))?;
        let user_id: i32 = service_row
            .try_get("user_id")
            .map_err(|e| format!("Erreur récupération user_id: {}", e))?;

        // ✅ PHASE 6: Récupérer les produits depuis service_products au lieu de JSONB
        let products = match products_service.get_products_by_service(service_id).await {
            Ok(products) => products,
            Err(e) => {
                log_info(&format!(
                    "[auto_deactivate] ⚠️ Erreur récupération produits service {}: {}",
                    service_id, e
                ));
                continue;
            }
        };

        // Traiter chaque produit
        for product in products {
            // Vérifier si le produit est actif et créé il y a plus de 30 jours
            if product.is_active && product.created_at < threshold_date {
                // ✅ PHASE 6: Désactiver via ProductsService (plus d'écriture JSONB)
                let deactivation_data = json!({
                    "deactivated_at": Utc::now().to_rfc3339(),
                    "deactivation_type": "auto",
                    "deactivation_reason": "Désactivation automatique après 30 jours d'inactivité"
                });

                match products_service
                    .set_product_active(
                        service_id,
                        product.product_index,
                        false,
                        Some(deactivation_data),
                    )
                    .await
                {
                    Ok(_) => {
                        products_deactivated += 1;

                        log_info(&format!(
                            "[auto_deactivate] ✅ Produit {} (index {}) du service {} désactivé automatiquement",
                            product.product_name, product.product_index, service_id
                        ));

                        // Notification
                        let product_name = product.product_name.clone();
                        let _ = crate::services::notification_service::create_notification(
                            pool,
                            user_id,
                            crate::services::notification_service::NotificationType::SystemAlert,
                            "⏰ Produit désactivé automatiquement".to_string(),
                            format!(
                                "Votre produit '{}' a été désactivé automatiquement après 30 jours d'inactivité.\n\n\
                                💰 Coût de réactivation: 1000 FCFA (fixe)\n\
                                📱 Accédez à 'Mes Produits' pour le réactiver.",
                                product_name
                            ),
                            Some(json!({
                                "service_id": service_id,
                                "product_index": product.product_index,
                                "product_name": product_name,
                                "reactivation_cost": 1000
                            }))
                        ).await;
                    }
                    Err(e) => {
                        log_info(&format!(
                            "[auto_deactivate] ⚠️ Erreur désactivation produit {} (service {}, index {}): {}",
                            product.product_name, service_id, product.product_index, e
                        ));
                    }
                }
            }
        }
    }

    log_info(&format!(
        "[auto_deactivate] ✅ Job terminé: {} produits désactivés",
        products_deactivated
    ));

    Ok(products_deactivated)
}

#[cfg(test)]
mod tests {
    use super::reactivation_costs::*;

    #[test]
    fn test_reactivation_cost_manual_10days() {
        // 10 jours, désactivation manuelle
        let cost = calculate_reactivation_cost(10, "manual");
        // (10/30) * 1000 = 333.33 → 334 FCFA
        assert_eq!(cost, 334);
    }

    #[test]
    fn test_reactivation_cost_manual_30days() {
        // 30 jours, désactivation manuelle
        let cost = calculate_reactivation_cost(30, "manual");
        // 1000 FCFA fixe
        assert_eq!(cost, 1000);
    }

    #[test]
    fn test_reactivation_cost_auto() {
        // N'importe quel nombre de jours, désactivation auto
        let cost = calculate_reactivation_cost(5, "auto");
        // 1000 FCFA fixe
        assert_eq!(cost, 1000);
    }

    #[test]
    fn test_reactivation_cost_minimum() {
        // 1 jour, désactivation manuelle
        let cost = calculate_reactivation_cost(1, "manual");
        // Minimum 100 FCFA
        assert!(cost >= 100);
    }
}
