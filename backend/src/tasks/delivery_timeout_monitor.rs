use chrono::{DateTime, Utc};
use log::{error, info, warn};
use sqlx::{FromRow, PgPool};
use std::sync::Arc;
use tokio::time::{interval, Duration as TokioDuration};
use uuid::Uuid;

use crate::core::types::AppResult;
use crate::models::delivery_model::DeliveryStatus;
use crate::services::delivery_service::DeliveryService;
use crate::services::push_notification_service;
use crate::state::AppState;

#[derive(Debug, FromRow)]
struct ExpiredSuggestion {
    delivery_id: Uuid,
    suggested_status: String,
    _created_at: DateTime<Utc>,
    auto_confirm_after_seconds: Option<i32>,
}

#[derive(Debug, FromRow)]
struct PendingDelivery {
    id: Uuid,
    status: String,
    _updated_at: DateTime<Utc>,
    creator_id: Option<i32>,
    recipient_user_id: Option<i32>,
    courier_user_id: Option<i32>,
}

/// ✅ NOUVEAU : Tâche périodique pour monitorer les timeouts de validation d'étapes
/// Vérifie toutes les minutes les livraisons en attente de confirmation
pub async fn start_delivery_timeout_monitor(state: Arc<AppState>) {
    info!("🚀 Démarrage du monitor de timeout pour les livraisons...");

    let mut interval_timer = interval(TokioDuration::from_secs(60)); // Vérifier toutes les minutes

    loop {
        interval_timer.tick().await;

        if let Err(e) = check_delivery_timeouts(state.clone()).await {
            error!("❌ Erreur lors de la vérification des timeouts de livraison: {}", e);
        }
    }
}

/// Vérifie les livraisons en attente de confirmation et auto-confirme si nécessaire
async fn check_delivery_timeouts(state: Arc<AppState>) -> AppResult<()> {
    let pool = &state.pg;
    let service = state.delivery_service.clone();

    // ✅ 1. Vérifier les suggestions de proximité expirées (auto-confirmation)
    check_expired_proximity_suggestions(pool, &service).await?;

    // ✅ 2. Vérifier les livraisons en attente de confirmation depuis trop longtemps
    check_pending_confirmations(pool, &service).await?;

    Ok(())
}

/// Vérifie les suggestions de proximité expirées et auto-confirme
async fn check_expired_proximity_suggestions(
    pool: &PgPool,
    service: &DeliveryService,
) -> AppResult<()> {
    // Récupérer les suggestions actives avec auto_confirm_after_seconds
    let expired_suggestions = sqlx::query_as::<_, ExpiredSuggestion>(
        r#"
        SELECT 
            delivery_id,
            suggested_status,
            created_at,
            auto_confirm_after_seconds
        FROM delivery_proximity_suggestions
        WHERE 
            status = 'pending'
            AND auto_confirm_after_seconds IS NOT NULL
            AND created_at + (auto_confirm_after_seconds || ' seconds')::interval <= NOW()
        LIMIT 50
        "#,
    )
    .fetch_all(pool)
    .await?;

    for suggestion in expired_suggestions {
        info!(
            "⏰ Auto-confirmation de la suggestion pour livraison {} (expirée après {} secondes)",
            suggestion.delivery_id,
            suggestion.auto_confirm_after_seconds.unwrap_or(0)
        );

        // Auto-confirmer le changement de statut
        let suggested_status_str = suggestion.suggested_status;
        // Parser le statut suggéré
        let suggested_status = match suggested_status_str.as_str() {
            "arrival_pickup" => DeliveryStatus::ArrivalPickup,
            "arrival_destination" => DeliveryStatus::ArrivalDestination,
            "picked_up" => DeliveryStatus::PickedUp,
            _ => {
                warn!("Statut suggéré inconnu: {}", suggested_status_str);
                continue;
            }
        };

        // Utiliser le service pour mettre à jour le statut
        if let Err(e) = service
            .update_delivery_status(
                suggestion.delivery_id,
                suggested_status,
                None,
                None,
                Some(serde_json::json!({
                    "auto_confirmed": true,
                    "auto_confirm_reason": "Timeout auto-confirmation proximité"
                })),
            )
            .await
        {
                error!(
                    "❌ Erreur auto-confirmation pour livraison {}: {:?}",
                    suggestion.delivery_id, e
                );
            } else {
                // Marquer la suggestion comme confirmée
                sqlx::query(
                    "UPDATE delivery_proximity_suggestions SET status = 'auto_confirmed', confirmed_at = NOW() WHERE delivery_id = $1"
                )
                .bind(suggestion.delivery_id)
                .execute(pool)
                .await?;

                info!("✅ Auto-confirmation réussie pour livraison {}", suggestion.delivery_id);
            }
    }

    Ok(())
}

/// Vérifie les livraisons en attente de confirmation depuis trop longtemps
async fn check_pending_confirmations(
    pool: &PgPool,
    _service: &DeliveryService,
) -> AppResult<()> {
    // Statuts qui nécessitent une confirmation rapide
    let statuses_requiring_confirmation = vec![
        "arrival_pickup",
        "arrival_destination",
        "picked_up",
    ];

    // Délai maximum avant alerte (2 minutes)
    let max_delay_minutes = 2;

    for status_str in statuses_requiring_confirmation {
        let deliveries = sqlx::query_as::<_, PendingDelivery>(
            r#"
            SELECT 
                d.id,
                d.status::text as status,
                d.updated_at,
                d.creator_id,
                d.recipient_user_id,
                c.user_id as courier_user_id
            FROM deliveries d
            LEFT JOIN couriers c ON c.id = d.courier_id
            WHERE 
                d.status::text = $1
                AND d.updated_at < NOW() - ($2 || ' minutes')::interval
                AND d.status::text != 'delivered'
                AND d.status::text != 'cancelled'
                AND d.status::text != 'completed'
            LIMIT 20
            "#,
        )
        .bind(status_str)
        .bind(max_delay_minutes)
        .fetch_all(pool)
        .await?;

        for delivery in deliveries {
            info!(
                "⚠️ Livraison {} en statut {} depuis plus de {} minutes - Envoi notification d'alerte",
                delivery.id,
                delivery.status,
                max_delay_minutes
            );

            // Envoyer notification au coursier
            if let Some(courier_id) = delivery.courier_user_id {
                let _ = push_notification_service::send_push_notification(
                    pool,
                    courier_id,
                    "⏰ Action requise".to_string(),
                    format!(
                        "Veuillez confirmer l'étape de livraison #{}",
                        delivery.id.to_string()[..8].to_uppercase()
                    ),
                    Some(serde_json::json!({
                        "delivery_id": delivery.id.to_string(),
                        "type": "delivery_timeout_alert",
                        "status": delivery.status
                    })),
                    Some("default".to_string()),
                )
                .await;
            }

            // Envoyer notification au client
            if let Some(client_id) = delivery.recipient_user_id {
                let _ = push_notification_service::send_push_notification(
                    pool,
                    client_id,
                    "⏰ Mise à jour de livraison".to_string(),
                    format!(
                        "Votre livraison #{} est en cours. Le coursier devrait confirmer l'étape prochainement.",
                        delivery.id.to_string()[..8].to_uppercase()
                    ),
                    Some(serde_json::json!({
                        "delivery_id": delivery.id.to_string(),
                        "type": "delivery_status_update"
                    })),
                    Some("default".to_string()),
                )
                .await;
            }

            // Envoyer notification au prestataire
            if let Some(merchant_id) = delivery.creator_id {
                let _ = push_notification_service::send_push_notification(
                    pool,
                    merchant_id,
                    "⏰ Suivi de livraison".to_string(),
                    format!(
                        "La livraison #{} nécessite une confirmation du coursier.",
                        delivery.id.to_string()[..8].to_uppercase()
                    ),
                    Some(serde_json::json!({
                        "delivery_id": delivery.id.to_string(),
                        "type": "delivery_timeout_alert"
                    })),
                    Some("default".to_string()),
                )
                .await;
            }
        }
    }

    Ok(())
}

