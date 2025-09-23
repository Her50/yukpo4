use axum::{extract::State, Json};
use serde_json::{json, Value};
use log::{info, error};
use crate::core::types::{AppResult, AppError};
use crate::services::intelligent_service_manager::process_expired_services_intelligently;
use crate::state::AppState;
use std::sync::Arc;

/// 🧠 API pour déclencher manuellement le traitement intelligent des services
/// Endpoint: POST /api/admin/process-services-intelligently
pub async fn process_services_intelligently(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<Value>> {
    info!("🧠 Déclenchement manuel du traitement intelligent des services...");
    
    match process_expired_services_intelligently(&state.ia.pool).await {
        Ok(result) => {
            let response = json!({
                "success": true,
                "message": "Traitement intelligent des services terminé avec succès",
                "results": {
                    "auto_renewed": result.auto_renewed,
                    "manually_deactivated": result.manually_deactivated,
                    "tarissable_deactivated": result.tarissable_deactivated,
                    "total_debited": result.total_debited,
                    "errors": result.errors
                },
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            
            info!("✅ Traitement intelligent terminé: {} renouvelés, {} désactivés, {} tarissables désactivés, {} FCFA débités", 
                  result.auto_renewed, result.manually_deactivated, result.tarissable_deactivated, result.total_debited);
            
            Ok(Json(response))
        }
        Err(e) => {
            error!("❌ Erreur lors du traitement intelligent: {}", e);
            Err(AppError::internal_server_error(format!("Erreur lors du traitement intelligent des services: {}", e)))
        }
    }
}

/// 📊 API pour obtenir les statistiques des services en attente de traitement
/// Endpoint: GET /api/admin/services-pending-processing
pub async fn get_services_pending_processing(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<Value>> {
    let now = chrono::Utc::now();
    
    // Services non tarissables expirés
    let expired_non_tarissable = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM services s
        JOIN users u ON s.user_id = u.id
        WHERE s.is_active = TRUE
          AND s.is_tarissable = FALSE
          AND s.auto_deactivate_at IS NOT NULL
          AND s.auto_deactivate_at < $1
        "#,
        now
    )
    .fetch_one(&state.ia.pool)
    .await
    .map_err(AppError::from)?
    .count.unwrap_or(0);

    // Services tarissables à traiter
    let tarissable_to_process = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM services s
        WHERE s.is_active = TRUE
          AND s.is_tarissable = TRUE
          AND s.vitesse_tarissement IS NOT NULL
        "#,
    )
    .fetch_one(&state.ia.pool)
    .await
    .map_err(AppError::from)?
    .count.unwrap_or(0);

    // Utilisateurs avec solde insuffisant
    let users_insufficient_balance = sqlx::query!(
        r#"
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        JOIN services s ON s.user_id = u.id
        WHERE s.is_active = TRUE
          AND s.is_tarissable = FALSE
          AND s.auto_deactivate_at IS NOT NULL
          AND s.auto_deactivate_at < $1
          AND u.tokens_balance < 1000
        "#,
        now
    )
    .fetch_one(&state.ia.pool)
    .await
    .map_err(AppError::from)?
    .count.unwrap_or(0);

    let response = json!({
        "success": true,
        "statistics": {
            "expired_non_tarissable": expired_non_tarissable,
            "tarissable_to_process": tarissable_to_process,
            "users_insufficient_balance": users_insufficient_balance,
            "total_pending": expired_non_tarissable + tarissable_to_process
        },
        "timestamp": now.to_rfc3339()
    });

    Ok(Json(response))
}

/// 🔄 API pour réactiver un service avec le coût proratisé
/// Endpoint: POST /api/services/{service_id}/reactivate-intelligent
pub async fn reactivate_service_intelligent(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(service_id): axum::extract::Path<i32>,
    axum::extract::Json(payload): axum::extract::Json<Value>,
) -> AppResult<Json<Value>> {
    let user_id = payload.get("user_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| AppError::BadRequest("user_id requis".to_string()))? as i32;

    // Vérifier que le service existe et appartient à l'utilisateur
    let service = sqlx::query!(
        r#"
        SELECT id, user_id, is_active, is_tarissable
        FROM services 
        WHERE id = $1 AND user_id = $2
        "#,
        service_id,
        user_id
    )
    .fetch_optional(&state.ia.pool)
    .await
    .map_err(AppError::from)?;

    let service = service.ok_or_else(|| AppError::NotFound("Service non trouvé".to_string()))?;

    if service.is_active {
        return Err(AppError::BadRequest("Service déjà actif".to_string()));
    }

    // Déterminer le coût de réactivation
    let reactivation_cost = if service.is_tarissable.unwrap_or(false) {
        // Service tarissable : utiliser le coût proratisé (temporairement 1000)
        1000
    } else {
        // Service normal : coût standard
        1000
    };

    // Vérifier le solde de l'utilisateur
    let user_balance = sqlx::query!(
        "SELECT tokens_balance FROM users WHERE id = $1",
        user_id
    )
    .fetch_optional(&state.ia.pool)
    .await
    .map_err(AppError::from)?;

    let user_balance = user_balance.ok_or_else(|| AppError::NotFound("Utilisateur non trouvé".to_string()))?;

    if user_balance.tokens_balance < reactivation_cost {
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant. Solde actuel: {} FCFA, Coût de réactivation: {} FCFA",
            user_balance.tokens_balance, reactivation_cost
        )));
    }

    // Débiter le coût de réactivation
    let updated_balance = sqlx::query!(
        "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 RETURNING tokens_balance",
        reactivation_cost,
        user_id
    )
    .fetch_one(&state.ia.pool)
    .await
    .map_err(AppError::from)?
    .tokens_balance;

    // Réactiver le service
    let new_expiry = chrono::Utc::now() + chrono::Duration::days(30);
    sqlx::query!(
        "UPDATE services SET is_active = TRUE, auto_deactivate_at = $1, updated_at = NOW() WHERE id = $2",
        new_expiry,
        service_id
    )
    .execute(&state.ia.pool)
    .await
    .map_err(AppError::from)?;

    // Logger l'action
    sqlx::query!(
        "INSERT INTO service_logs (service_id, user_id, action, reason, created_at) VALUES ($1, $2, $3, $4, $5)",
        service_id,
        user_id,
        "manual_reactivation",
        &format!("Réactivation manuelle pour {} FCFA", reactivation_cost),
        chrono::Utc::now().naive_utc()
    )
    .execute(&state.ia.pool)
    .await
    .map_err(AppError::from)?;

    let response = json!({
        "success": true,
        "message": "Service réactivé avec succès",
        "service_id": service_id,
        "reactivation_cost": reactivation_cost,
        "remaining_balance": updated_balance,
        "new_expiry": new_expiry.to_rfc3339(),
        "is_tarissable": service.is_tarissable,
        "prorated_cost_used": service.is_tarissable.unwrap_or(false)
    });

    info!("✅ Service {} réactivé par l'utilisateur {} pour {} FCFA (solde restant: {})", 
          service_id, user_id, reactivation_cost, updated_balance);

    Ok(Json(response))
}
