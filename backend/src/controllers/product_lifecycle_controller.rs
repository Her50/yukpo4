// ✅ NOUVEAU 2025-11-01: Gestion complète du cycle de vie des produits
// Désactivation manuelle, auto (30j), réactivation avec coût variable

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
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
    use crate::utils::log::{log_info, log_warn};

    log_info(&format!(
        "[deactivate_product] 🔴 Désactivation produit {} du service {}",
        product_index, service_id
    ));

    // Récupérer le service
    let service_row = sqlx::query("SELECT user_id, data FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;

    let (owner_id, mut service_data): (i32, Value) = match service_row {
        Some(row) => (
            row.try_get("user_id")
                .map_err(|e| AppError::Internal(e.to_string()))?,
            row.try_get("data")
                .map_err(|e| AppError::Internal(e.to_string()))?,
        ),
        None => {
            return Err(AppError::NotFound(format!(
                "Service {} introuvable",
                service_id
            )))
        }
    };

    // Vérifier propriétaire
    if owner_id != user.id {
        log_warn(&format!(
            "[deactivate_product] User {} n'est pas propriétaire du service {}",
            user.id, service_id
        ));
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le propriétaire de ce service".to_string(),
        ));
    }

    // Marquer le produit comme désactivé
    let produits_array = service_data
        .get_mut("produits")
        .and_then(|p| p.as_object_mut())
        .and_then(|obj| obj.get_mut("valeur"))
        .and_then(|v| v.as_array_mut())
        .ok_or_else(|| AppError::NotFound("Produits introuvables".to_string()))?;

    let produit = produits_array
        .get_mut(product_index)
        .ok_or_else(|| AppError::NotFound(format!("Produit {} introuvable", product_index)))?;

    let produit_obj = produit
        .as_object_mut()
        .ok_or_else(|| AppError::Internal("Produit invalide".to_string()))?;

    // Vérifier si déjà désactivé
    let is_active = produit_obj
        .get("is_active")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    if !is_active {
        return Err(AppError::BadRequest(
            "Le produit est déjà désactivé".to_string(),
        ));
    }

    // Désactiver
    produit_obj.insert("is_active".to_string(), json!(false));
    produit_obj.insert("deactivated_at".to_string(), json!(Utc::now().to_rfc3339()));
    produit_obj.insert("deactivation_type".to_string(), json!("manual"));
    if let Some(reason) = request.reason {
        produit_obj.insert("deactivation_reason".to_string(), json!(reason));
    }

    // Extraire le nom du produit et le copier pour éviter les problèmes de borrow
    let product_name = produit_obj
        .get("nom")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("Produit #{}", product_index + 1));

    // Mettre à jour le service - Cloner pour éviter E0502
    let service_data_json = serde_json::to_value(service_data.clone())
        .map_err(|e| AppError::Internal(format!("Erreur sérialisation: {}", e)))?;

    sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
        .bind(&service_data_json)
        .bind(service_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mise à jour: {}", e)))?;

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

    // Récupérer le service
    let service_row = sqlx::query("SELECT user_id, data FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;

    let (owner_id, mut service_data): (i32, Value) = match service_row {
        Some(row) => (
            row.try_get("user_id")
                .map_err(|e| AppError::Internal(e.to_string()))?,
            row.try_get("data")
                .map_err(|e| AppError::Internal(e.to_string()))?,
        ),
        None => {
            return Err(AppError::NotFound(format!(
                "Service {} introuvable",
                service_id
            )))
        }
    };

    // Vérifier propriétaire
    if owner_id != user.id {
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le propriétaire de ce service".to_string(),
        ));
    }

    // Récupérer le produit
    let produits_array = service_data
        .get_mut("produits")
        .and_then(|p| p.as_object_mut())
        .and_then(|obj| obj.get_mut("valeur"))
        .and_then(|v| v.as_array_mut())
        .ok_or_else(|| AppError::NotFound("Produits introuvables".to_string()))?;

    let produit = produits_array
        .get_mut(product_index)
        .ok_or_else(|| AppError::NotFound(format!("Produit {} introuvable", product_index)))?;

    let produit_obj = produit
        .as_object_mut()
        .ok_or_else(|| AppError::Internal("Produit invalide".to_string()))?;

    // Vérifier si désactivé
    let is_active = produit_obj
        .get("is_active")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    if is_active {
        return Err(AppError::BadRequest(
            "Le produit est déjà actif".to_string(),
        ));
    }

    // Calculer le coût de réactivation
    let deactivated_at_str = produit_obj
        .get("deactivated_at")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Internal("Date de désactivation manquante".to_string()))?;

    let deactivated_at = chrono::DateTime::parse_from_rfc3339(deactivated_at_str)
        .map_err(|e| AppError::Internal(format!("Date invalide: {}", e)))?
        .naive_utc();

    let deactivation_type = produit_obj
        .get("deactivation_type")
        .and_then(|v| v.as_str())
        .unwrap_or("manual");

    let now = Utc::now().naive_utc();
    let days_inactive = (now - deactivated_at).num_days();

    let cost = reactivation_costs::calculate_reactivation_cost(days_inactive, deactivation_type);

    log_info(&format!(
        "[reactivate_product] 💰 Coût calculé: {} FCFA ({} jours, type: {})",
        cost, days_inactive, deactivation_type
    ));

    // Vérifier le solde
    let current_balance = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération solde: {}", e)))?
        .get::<Option<i64>, _>("tokens_balance")
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
    .get::<Option<i64>, _>("tokens_balance")
    .unwrap_or(0);

    log_info(&format!(
        "[reactivate_product] ✅ Solde débité: {} FCFA (nouveau: {})",
        cost, new_balance
    ));

    // Réactiver le produit
    produit_obj.insert("is_active".to_string(), json!(true));
    produit_obj.insert("reactivated_at".to_string(), json!(Utc::now().to_rfc3339()));
    produit_obj.remove("deactivated_at");
    produit_obj.remove("deactivation_type");
    produit_obj.remove("deactivation_reason");

    // Extraire le nom du produit et le copier pour éviter les problèmes de borrow
    let product_name = produit_obj
        .get("nom")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("Produit #{}", product_index + 1));

    // Mettre à jour le service - Cloner pour éviter E0502
    let service_data_json = serde_json::to_value(service_data.clone())
        .map_err(|e| AppError::Internal(format!("Erreur sérialisation: {}", e)))?;

    sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
        .bind(&service_data_json)
        .bind(service_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mise à jour: {}", e)))?;

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
            "product_name": product_name.clone(),
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
pub async fn auto_deactivate_expired_products(pool: &sqlx::PgPool) -> Result<usize, String> {
    use crate::utils::log::log_info;

    log_info("[auto_deactivate] 🤖 Démarrage du job de désactivation automatique...");

    // Récupérer tous les services actifs
    let services =
        sqlx::query("SELECT id, user_id, data, created_at FROM services WHERE is_active = true")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Erreur récupération services: {}", e))?;

    let mut products_deactivated = 0;
    let threshold_date = Utc::now() - chrono::Duration::days(30);

    for service_row in services {
        let service_id: i32 = service_row.try_get("id").unwrap();
        let user_id: i32 = service_row.try_get("user_id").unwrap();
        let mut service_data: Value = service_row.try_get("data").unwrap();
        let created_at: chrono::NaiveDateTime = service_row.try_get("created_at").unwrap();
        let mut service_modified = false;

        // Vérifier si le service a plus de 30 jours
        if created_at.and_utc() > threshold_date {
            continue; // Service trop récent, skip
        }

        if let Some(produits_array) = service_data
            .get_mut("produits")
            .and_then(|p| p.as_object_mut())
            .and_then(|obj| obj.get_mut("valeur"))
            .and_then(|v| v.as_array_mut())
        {
            for (index, produit) in produits_array.iter_mut().enumerate() {
                if let Some(produit_obj) = produit.as_object_mut() {
                    let is_active = produit_obj
                        .get("is_active")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true);

                    if is_active {
                        // Désactiver automatiquement
                        produit_obj.insert("is_active".to_string(), json!(false));
                        produit_obj
                            .insert("deactivated_at".to_string(), json!(Utc::now().to_rfc3339()));
                        produit_obj.insert("deactivation_type".to_string(), json!("auto"));
                        produit_obj.insert(
                            "deactivation_reason".to_string(),
                            json!("Désactivation automatique après 30 jours d'inactivité"),
                        );

                        products_deactivated += 1;
                        service_modified = true;

                        log_info(&format!(
                            "[auto_deactivate] Produit {} du service {} désactivé automatiquement",
                            index, service_id
                        ));

                        // Notification - Extraire le nom du produit
                        let default_name = format!("Produit #{}", index + 1);
                        let product_name = produit_obj
                            .get("nom")
                            .and_then(|v| v.as_str())
                            .unwrap_or(&default_name);

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
                                "product_index": index,
                                "product_name": product_name,
                                "reactivation_cost": 1000
                            }))
                        ).await;
                    }
                }
            }
        }

        // Mettre à jour le service si modifié
        if service_modified {
            let _ = sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
                .bind(&service_data)
                .bind(service_id)
                .execute(pool)
                .await;
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
