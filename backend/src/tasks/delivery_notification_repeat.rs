/// ✅ NOUVEAU : Tâche périodique pour répéter les notifications de livraison
/// Répète les notifications toutes les 30 secondes pour les livraisons en attente d'acceptation
use crate::services::push_notification_service;
use crate::state::AppState;
use log::{error, info, warn};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use uuid::Uuid;

/// Démarrer la tâche de répétition des notifications de livraison
pub async fn start_delivery_notification_repeat_task(state: Arc<AppState>) {
    info!("🔄 [DeliveryNotifications] Démarrage de la tâche de répétition des notifications");

    let mut interval_timer = interval(Duration::from_secs(30)); // Répéter toutes les 30 secondes

    loop {
        interval_timer.tick().await;

        match repeat_pending_delivery_notifications(&state).await {
            Ok(count) => {
                if count > 0 {
                    info!("✅ [DeliveryNotifications] {} notification(s) répétée(s)", count);
                }
            }
            Err(e) => {
                error!("❌ [DeliveryNotifications] Erreur lors de la répétition: {:?}", e);
            }
        }
    }
}

/// Répéter les notifications pour les livraisons en attente d'acceptation
async fn repeat_pending_delivery_notifications(state: &Arc<AppState>) -> Result<usize, Box<dyn std::error::Error>> {
    let service = state.delivery_service.clone();
    
    // Récupérer les livraisons en attente d'acceptation avec notifications actives
    // ✅ Utiliser sqlx::query avec extraction manuelle car query_as ne fonctionne pas bien avec JSONB
    let rows = sqlx::query(
        r#"
        SELECT id, metadata
        FROM deliveries
        WHERE status = 'awaiting_courier_confirmation'
        AND metadata->>'notifications_stopped' IS NULL
        AND metadata->>'notified_user_ids' IS NOT NULL
        AND metadata->>'notification_sent_at' IS NOT NULL
        AND (metadata->>'notification_repeat_interval_seconds')::int = 30
        AND NOW() - (metadata->>'notification_sent_at')::timestamp < INTERVAL '5 minutes'
        ORDER BY created_at DESC
        LIMIT 50
        "#
    )
    .fetch_all(&state.pg)
    .await?;
    
    let pending_deliveries: Vec<(Uuid, serde_json::Value)> = rows
        .into_iter()
        .filter_map(|row| {
            let id: Result<Uuid, _> = row.try_get("id");
            let metadata: Result<serde_json::Value, _> = row.try_get("metadata");
            match (id, metadata) {
                (Ok(id), Ok(metadata)) => Some((id, metadata)),
                _ => None,
            }
        })
        .collect();
    
    let mut repeated_count = 0;
    
    for (delivery_id, metadata) in pending_deliveries {
        // Récupérer les user_ids notifiés
        let notified_user_ids: Vec<i32> = metadata
            .get("notified_user_ids")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_i64().map(|i| i as i32))
                    .collect()
            })
            .unwrap_or_default();
        
        if notified_user_ids.is_empty() {
            continue;
        }
        
        // Récupérer le résumé de la livraison
        let summary = match service.get_delivery_summary(delivery_id).await {
            Ok(s) => s,
            Err(e) => {
                warn!("[DeliveryNotifications] Erreur récupération livraison {}: {:?}", delivery_id, e);
                continue;
            }
        };
        
        // Vérifier que la livraison est toujours en attente
        if summary.status != crate::models::delivery_model::DeliveryStatus::AwaitingCourierConfirmation {
            continue;
        }
        
        // Répéter la notification pour chaque coursier notifié
        for user_id in &notified_user_ids {
            let notification_title = "📦 Course disponible".to_string();
            let notification_message = format!(
                "Course #{}. Appuyez pour accepter.",
                delivery_id.to_string()[..8].to_uppercase()
            );
            
            let notification_data = json!({
                "type": "delivery_available",
                "delivery_id": delivery_id.to_string(),
                "is_repeat": true,
                "repeat_count": metadata.get("notification_repeat_count").and_then(|v| v.as_u64()).unwrap_or(0) + 1,
            });
            
            let _ = push_notification_service::send_persistent_delivery_notification(
                &state.pg,
                *user_id,
                notification_title,
                notification_message,
                Some(notification_data),
            )
            .await;
            
            repeated_count += 1;
        }
        
        // Mettre à jour le compteur de répétitions dans les métadonnées
        let mut updated_metadata = metadata.clone();
        let repeat_count = updated_metadata
            .get("notification_repeat_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) + 1;
        updated_metadata["notification_repeat_count"] = json!(repeat_count);
        updated_metadata["last_notification_repeat_at"] = json!(chrono::Utc::now().to_rfc3339());
        
        sqlx::query(
            "UPDATE deliveries SET metadata = $1, updated_at = NOW() WHERE id = $2"
        )
        .bind(&updated_metadata)
        .bind(delivery_id)
        .execute(&state.pg)
        .await?;
    }
    
    Ok(repeated_count)
}

