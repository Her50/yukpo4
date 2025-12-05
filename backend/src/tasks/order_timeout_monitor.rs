use chrono::Utc;
use log::{error, info};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::time::{interval, Duration as TokioDuration};
use uuid::Uuid;

use crate::core::types::AppResult;
use crate::services::smart_notification_service::SmartNotificationService;
use crate::state::AppState;

/// ✅ NOUVEAU : Tâche périodique pour monitorer les timeouts de validation de commandes
/// Vérifie toutes les minutes les commandes avec validation_deadline expirée (configurable via ORDER_TIMEOUT_MONITOR_INTERVAL_SECS)
pub async fn start_order_timeout_monitor(state: Arc<AppState>) {
    info!("🚀 Démarrage du monitor de timeout pour les commandes...");

    // Intervalle configurable via variable d'environnement (défaut: 60s)
    let interval_secs: u64 = std::env::var("ORDER_TIMEOUT_MONITOR_INTERVAL_SECS")
        .unwrap_or_else(|_| "60".to_string())
        .parse()
        .unwrap_or(60);

    let mut interval_timer = interval(TokioDuration::from_secs(interval_secs));

    loop {
        interval_timer.tick().await;

        if let Err(e) = check_order_timeouts(state.clone()).await {
            error!(
                "❌ Erreur lors de la vérification des timeouts de commandes: {}",
                e
            );
        }
    }
}

/// Vérifie les commandes en attente de validation expirées
async fn check_order_timeouts(state: Arc<AppState>) -> AppResult<()> {
    let pool = &state.pg;
    let now = Utc::now();

    // Récupérer les commandes avec validation_deadline expirée
    struct ExpiredOrder {
        id: Uuid,
        service_id: i32,
        product_index: i32,
        client_user_id: i32,
        provider_user_id: i32,
    }

    let expired_orders: Vec<ExpiredOrder> = sqlx::query(
        r#"
        SELECT 
            id,
            service_id,
            product_index,
            client_user_id,
            provider_user_id
        FROM product_orders
        WHERE 
            status = 'pending'
            AND validation_deadline IS NOT NULL
            AND validation_deadline <= $1
        LIMIT 50
        "#,
    )
    .bind(now)
    .map(|row: sqlx::postgres::PgRow| ExpiredOrder {
        id: row.get::<Uuid, _>("id"),
        service_id: row.get::<i32, _>("service_id"),
        product_index: row.get::<i32, _>("product_index"),
        client_user_id: row.get::<i32, _>("client_user_id"),
        provider_user_id: row.get::<i32, _>("provider_user_id"),
    })
    .fetch_all(pool)
    .await?;

    if expired_orders.is_empty() {
        return Ok(());
    }

    info!(
        "[OrderTimeoutMonitor] {} commandes expirées trouvées",
        expired_orders.len()
    );

    let notification_service = SmartNotificationService::new(pool.clone());

    for order in expired_orders {
        if let Err(e) = handle_validation_timeout(
            pool,
            &notification_service,
            order.id,
            order.service_id,
            order.product_index,
            order.client_user_id,
            order.provider_user_id,
        )
        .await
        {
            error!(
                "[OrderTimeoutMonitor] ❌ Erreur traitement timeout order_id={}: {}",
                order.id, e
            );
        }
    }

    Ok(())
}

/// Traite une commande expirée (timeout de validation)
async fn handle_validation_timeout(
    pool: &PgPool,
    notification_service: &SmartNotificationService,
    order_id: Uuid,
    service_id: i32,
    product_index: i32,
    client_user_id: i32,
    provider_user_id: i32,
) -> AppResult<()> {
    info!(
        "[OrderTimeoutMonitor] Traitement timeout: order_id={}, service_id={}, product_index={}",
        order_id, service_id, product_index
    );

    // Marquer la commande comme annulée (timeout)
    sqlx::query(
        r#"
        UPDATE product_orders
        SET 
            status = 'cancelled',
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .execute(pool)
    .await?;

    // Enregistrer l'annulation
    sqlx::query(
        r#"
        INSERT INTO order_cancellations (
            order_id,
            provider_user_id,
            service_id,
            product_index,
            cancellation_type,
            reason
        )
        VALUES ($1, $2, $3, $4, 'timeout', 'Délai de validation expiré')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(order_id)
    .bind(provider_user_id)
    .bind(service_id)
    .bind(product_index)
    .execute(pool)
    .await?;

    // Notifier le client avec produits similaires
    notification_service
        .notify_client_order_timeout_with_alternatives(
            client_user_id,
            order_id,
            service_id,
            product_index,
        )
        .await?;

    info!(
        "[OrderTimeoutMonitor] ✅ Commande annulée (timeout): order_id={}",
        order_id
    );

    Ok(())
}
