/**
 * Tâches périodiques pour recalculer les statistiques
 * - Recalcul des stats de préparation par catégorie (toutes les 24h)
 * - Recalcul des stats d'annulation par produit (toutes les 24h)
 */

use crate::core::types::AppResult;
use crate::services::dynamic_preparation_time_service::DynamicPreparationTimeService;
use crate::services::provider_analytics_service::ProviderAnalyticsService;
use chrono::{Timelike, Utc};
use log::{error, info, warn};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::time::{interval, Duration};

/// Démarre la tâche de recalcul des statistiques de préparation par catégorie
/// S'exécute toutes les 24 heures (à minuit)
pub async fn start_category_stats_recalculation_task(pool: Arc<PgPool>) {
    info!("📊 [StatsRecalculation] Démarrage de la tâche de recalcul des stats de catégories");

    // Attendre jusqu'à la prochaine heure pile (pour commencer à minuit)
    let now = chrono::Utc::now();
    let _next_hour = (now.hour() + 1) as u64;
    let seconds_until_next_hour = (3600 - (now.minute() * 60 + now.second()) as u64) % 3600;
    
    if seconds_until_next_hour > 0 {
        info!(
            "⏰ [StatsRecalculation] Attente de {} secondes avant le premier recalcul",
            seconds_until_next_hour
        );
        tokio::time::sleep(Duration::from_secs(seconds_until_next_hour)).await;
    }

    let mut interval_timer = interval(Duration::from_secs(86400)); // 24 heures

    loop {
        interval_timer.tick().await;

        info!("🔄 [StatsRecalculation] Recalcul des statistiques de préparation par catégorie...");

        let service = DynamicPreparationTimeService::new((*pool).clone());
        match service.recalculate_all_category_stats().await {
            Ok(count) => {
                info!(
                    "✅ [StatsRecalculation] {} catégorie(s) mise(s) à jour",
                    count
                );
            }
            Err(e) => {
                error!(
                    "❌ [StatsRecalculation] Erreur lors du recalcul des stats de catégories: {:?}",
                    e
                );
            }
        }
    }
}

/// Recalcule les statistiques d'annulation pour tous les produits
async fn recalculate_all_product_cancellation_stats(pool: &PgPool) -> AppResult<usize> {
    info!("🔄 [StatsRecalculation] Recalcul des statistiques d'annulation par produit...");

    // Récupérer tous les produits avec des commandes
    let products = sqlx::query!(
        r#"
        SELECT DISTINCT 
            po.service_id,
            po.product_index
        FROM product_orders po
        WHERE po.created_at >= NOW() - INTERVAL '90 days'
        ORDER BY po.service_id, po.product_index
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut updated_count = 0;

    for row in products {
        match recalculate_product_cancellation_stats(
            pool,
            row.service_id,
            row.product_index,
        )
        .await
        {
            Ok(_) => {
                updated_count += 1;
            }
            Err(e) => {
                warn!(
                    "⚠️ [StatsRecalculation] Erreur calcul stats annulation pour produit {} (service {}): {}",
                    row.product_index,
                    row.service_id,
                    e
                );
            }
        }
    }

    info!(
        "✅ [StatsRecalculation] {} produit(s) mis à jour pour les stats d'annulation",
        updated_count
    );

    Ok(updated_count)
}

/// Recalcule les statistiques d'annulation pour un produit spécifique
async fn recalculate_product_cancellation_stats(
    pool: &PgPool,
    service_id: i32,
    product_index: i32,
) -> AppResult<()> {
    // Calculer les stats depuis les 90 derniers jours
    let period_start = Utc::now() - chrono::Duration::days(90);

    // Compter les commandes totales
    let total_orders = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM product_orders
        WHERE service_id = $1
        AND product_index = $2
        AND created_at >= $3
        "#,
        service_id,
        product_index,
        period_start
    )
    .fetch_one(pool)
    .await?
    .count
    .unwrap_or(0) as i32;

    if total_orders == 0 {
        // Pas de commandes, ne pas créer d'entrée
        return Ok(());
    }

    // Compter les annulations par type
    let timeout_cancellations = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM order_cancellations
        WHERE order_id IN (
            SELECT id FROM product_orders
            WHERE service_id = $1 AND product_index = $2
        )
        AND cancellation_type = 'timeout'
        AND cancelled_at >= $3
        "#,
        service_id,
        product_index,
        period_start
    )
    .fetch_one(pool)
    .await?
    .count
    .unwrap_or(0) as i32;

    let rejected_cancellations = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM order_cancellations
        WHERE order_id IN (
            SELECT id FROM product_orders
            WHERE service_id = $1 AND product_index = $2
        )
        AND cancellation_type = 'rejected'
        AND cancelled_at >= $3
        "#,
        service_id,
        product_index,
        period_start
    )
    .fetch_one(pool)
    .await?
    .count
    .unwrap_or(0) as i32;

    let total_cancellations = timeout_cancellations + rejected_cancellations;

    // Calculer le taux d'annulation (en pourcentage)
    let cancellation_rate = if total_orders > 0 {
        (total_cancellations as f64 / total_orders as f64) * 100.0
    } else {
        0.0
    };

    // Mettre à jour ou insérer les stats
    sqlx::query!(
        r#"
        INSERT INTO product_cancellation_stats (
            service_id,
            product_index,
            total_orders,
            total_cancellations,
            cancellation_rate,
            timeout_cancellations,
            rejected_cancellations,
            last_calculated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (service_id, product_index)
        DO UPDATE SET
            total_orders = EXCLUDED.total_orders,
            total_cancellations = EXCLUDED.total_cancellations,
            cancellation_rate = EXCLUDED.cancellation_rate,
            timeout_cancellations = EXCLUDED.timeout_cancellations,
            rejected_cancellations = EXCLUDED.rejected_cancellations,
            last_calculated_at = EXCLUDED.last_calculated_at
        "#,
        service_id,
        product_index,
        total_orders,
        total_cancellations,
        cancellation_rate,
        timeout_cancellations,
        rejected_cancellations
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Démarre la tâche de recalcul des statistiques d'annulation par produit
/// S'exécute toutes les 24 heures (à minuit + 30 minutes)
pub async fn start_product_cancellation_stats_recalculation_task(pool: Arc<PgPool>) {
    info!("📊 [StatsRecalculation] Démarrage de la tâche de recalcul des stats d'annulation");

    // Attendre jusqu'à minuit + 30 minutes (pour éviter la collision avec la tâche de catégories)
    let now = chrono::Utc::now();
    let seconds_until_next_30min = {
        let current_minutes = now.minute();
        let minutes_until_30 = if current_minutes < 30 {
            30 - current_minutes
        } else {
            90 - current_minutes
        };
        (minutes_until_30 * 60 - now.second()) as u64
    };

    if seconds_until_next_30min > 0 {
        info!(
            "⏰ [StatsRecalculation] Attente de {} secondes avant le premier recalcul",
            seconds_until_next_30min
        );
        tokio::time::sleep(Duration::from_secs(seconds_until_next_30min)).await;
    }

    let mut interval_timer = interval(Duration::from_secs(86400)); // 24 heures

    loop {
        interval_timer.tick().await;

        info!("🔄 [StatsRecalculation] Recalcul des statistiques d'annulation par produit...");

        match recalculate_all_product_cancellation_stats(&pool).await {
            Ok(count) => {
                info!(
                    "✅ [StatsRecalculation] {} produit(s) mis à jour pour les stats d'annulation",
                    count
                );
            }
            Err(e) => {
                error!(
                    "❌ [StatsRecalculation] Erreur lors du recalcul des stats d'annulation: {:?}",
                    e
                );
            }
        }
    }
}

