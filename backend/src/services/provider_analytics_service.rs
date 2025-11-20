use crate::core::types::{AppError, AppResult};
use chrono::{DateTime, Utc};
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

/// Service pour calculer les analytics des prestataires
pub struct ProviderAnalyticsService {
    pool: PgPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderOrderStats {
    pub provider_user_id: i32,
    pub total_orders: i64,
    pub pending_orders: i64,
    pub validated_orders: i64,
    pub rejected_orders: i64,
    pub cancelled_orders: i64,
    pub ready_orders: i64,
    pub delivered_orders: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPreparationTimeStats {
    pub provider_user_id: i32,
    pub avg_preparation_minutes: Option<f64>,
    pub median_preparation_minutes: Option<f64>,
    pub min_preparation_minutes: Option<i32>,
    pub max_preparation_minutes: Option<i32>,
    pub total_orders_with_preparation: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRejectionStats {
    pub provider_user_id: i32,
    pub total_rejections: i64,
    pub rejection_rate: f64, // Pourcentage
    pub common_rejection_reasons: Vec<RejectionReasonCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectionReasonCount {
    pub reason: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCancellationStats {
    pub provider_user_id: i32,
    pub total_cancellations: i64,
    pub cancellation_rate: f64, // Pourcentage
    pub timeout_cancellations: i64,
    pub rejected_cancellations: i64,
    pub provider_cancelled: i64,
    pub courier_unavailable: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPenaltyStats {
    pub provider_user_id: i32,
    pub total_penalties: i64,
    pub total_penalty_amount: Option<f64>,
    pub penalty_reasons: Vec<PenaltyReasonCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PenaltyReasonCount {
    pub reason: String,
    pub count: i64,
    pub total_amount: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAnalytics {
    pub provider_user_id: i32,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub order_stats: ProviderOrderStats,
    pub preparation_time_stats: ProviderPreparationTimeStats,
    pub rejection_stats: ProviderRejectionStats,
    pub cancellation_stats: ProviderCancellationStats,
    pub penalty_stats: Option<ProviderPenaltyStats>,
}

impl ProviderAnalyticsService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Récupère les analytics complètes d'un prestataire pour une période
    pub async fn get_provider_analytics(
        &self,
        provider_user_id: i32,
        period_start: Option<DateTime<Utc>>,
        period_end: Option<DateTime<Utc>>,
    ) -> AppResult<ProviderAnalytics> {
        let period_start = period_start.unwrap_or_else(|| Utc::now() - chrono::Duration::days(30));
        let period_end = period_end.unwrap_or_else(Utc::now);

        info!(
            "[ProviderAnalytics] Calcul analytics pour provider_user_id={}, période: {:?} - {:?}",
            provider_user_id, period_start, period_end
        );

        let order_stats = self
            .get_order_stats(provider_user_id, period_start, period_end)
            .await?;
        let preparation_time_stats = self
            .get_preparation_time_stats(provider_user_id, period_start, period_end)
            .await?;
        let rejection_stats = self
            .get_rejection_stats(provider_user_id, period_start, period_end)
            .await?;
        let cancellation_stats = self
            .get_cancellation_stats(provider_user_id, period_start, period_end)
            .await?;
        let penalty_stats = self
            .get_penalty_stats(provider_user_id, period_start, period_end)
            .await?;

        Ok(ProviderAnalytics {
            provider_user_id,
            period_start,
            period_end,
            order_stats,
            preparation_time_stats,
            rejection_stats,
            cancellation_stats,
            penalty_stats,
        })
    }

    /// Récupère les statistiques de commandes
    async fn get_order_stats(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AppResult<ProviderOrderStats> {
        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_orders,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
                COUNT(*) FILTER (WHERE status = 'validated') as validated_orders,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected_orders,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
                COUNT(*) FILTER (WHERE status = 'ready') as ready_orders,
                COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders
            FROM product_orders
            WHERE provider_user_id = $1
            AND created_at >= $2
            AND created_at <= $3
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(ProviderOrderStats {
            provider_user_id,
            total_orders: stats.total_orders.unwrap_or(0),
            pending_orders: stats.pending_orders.unwrap_or(0),
            validated_orders: stats.validated_orders.unwrap_or(0),
            rejected_orders: stats.rejected_orders.unwrap_or(0),
            cancelled_orders: stats.cancelled_orders.unwrap_or(0),
            ready_orders: stats.ready_orders.unwrap_or(0),
            delivered_orders: stats.delivered_orders.unwrap_or(0),
        })
    }

    /// Récupère les statistiques de temps de préparation
    async fn get_preparation_time_stats(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AppResult<ProviderPreparationTimeStats> {
        let stats = sqlx::query!(
            r#"
            SELECT 
                AVG(preparation_time_minutes) as avg_preparation_minutes,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY preparation_time_minutes) as median_preparation_minutes,
                MIN(preparation_time_minutes) as min_preparation_minutes,
                MAX(preparation_time_minutes) as max_preparation_minutes,
                COUNT(*) FILTER (WHERE preparation_time_minutes IS NOT NULL) as total_orders_with_preparation
            FROM product_orders
            WHERE provider_user_id = $1
            AND created_at >= $2
            AND created_at <= $3
            AND status IN ('ready', 'delivered', 'picked_up')
            AND preparation_time_minutes IS NOT NULL
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(ProviderPreparationTimeStats {
            provider_user_id,
            avg_preparation_minutes: stats.avg_preparation_minutes.and_then(|v| {
                use rust_decimal::prelude::ToPrimitive;
                v.to_f64()
            }),
            median_preparation_minutes: stats.median_preparation_minutes.and_then(|v| {
                use rust_decimal::prelude::ToPrimitive;
                v.to_f64()
            }),
            min_preparation_minutes: stats.min_preparation_minutes,
            max_preparation_minutes: stats.max_preparation_minutes,
            total_orders_with_preparation: stats.total_orders_with_preparation.unwrap_or(0),
        })
    }

    /// Récupère les statistiques de rejets
    async fn get_rejection_stats(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AppResult<ProviderRejectionStats> {
        let total_orders = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::BIGINT
            FROM product_orders
            WHERE provider_user_id = $1
            AND created_at >= $2
            AND created_at <= $3
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let rejection_count = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::BIGINT
            FROM product_orders
            WHERE provider_user_id = $1
            AND created_at >= $2
            AND created_at <= $3
            AND status = 'rejected'
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let rejection_rate = if total_orders > 0 {
            (rejection_count as f64 / total_orders as f64) * 100.0
        } else {
            0.0
        };

        // Récupérer les raisons de rejet les plus fréquentes
        let common_reasons = sqlx::query!(
            r#"
            SELECT 
                rejection_reason as reason,
                COUNT(*)::BIGINT as count
            FROM product_orders
            WHERE provider_user_id = $1
            AND created_at >= $2
            AND created_at <= $3
            AND status = 'rejected'
            AND rejection_reason IS NOT NULL
            GROUP BY rejection_reason
            ORDER BY count DESC
            LIMIT 10
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|r| RejectionReasonCount {
            reason: r.reason.unwrap_or_default(),
            count: r.count.unwrap_or(0),
        })
        .collect();

        Ok(ProviderRejectionStats {
            provider_user_id,
            total_rejections: rejection_count,
            rejection_rate,
            common_rejection_reasons: common_reasons,
        })
    }

    /// Récupère les statistiques d'annulation
    async fn get_cancellation_stats(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AppResult<ProviderCancellationStats> {
        let total_orders = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::BIGINT
            FROM product_orders
            WHERE provider_user_id = $1
            AND created_at >= $2
            AND created_at <= $3
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*)::BIGINT as total_cancellations,
                COUNT(*) FILTER (WHERE cancellation_type = 'timeout')::BIGINT as timeout_cancellations,
                COUNT(*) FILTER (WHERE cancellation_type = 'rejected')::BIGINT as rejected_cancellations,
                COUNT(*) FILTER (WHERE cancellation_type = 'provider_cancelled')::BIGINT as provider_cancelled,
                COUNT(*) FILTER (WHERE cancellation_type = 'courier_unavailable')::BIGINT as courier_unavailable
            FROM order_cancellations
            WHERE provider_user_id = $1
            AND cancelled_at >= $2
            AND cancelled_at <= $3
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_one(&self.pool)
        .await?;

        let total_cancellations = stats.total_cancellations.unwrap_or(0);
        let cancellation_rate = if total_orders > 0 {
            (total_cancellations as f64 / total_orders as f64) * 100.0
        } else {
            0.0
        };

        Ok(ProviderCancellationStats {
            provider_user_id,
            total_cancellations,
            cancellation_rate,
            timeout_cancellations: stats.timeout_cancellations.unwrap_or(0),
            rejected_cancellations: stats.rejected_cancellations.unwrap_or(0),
            provider_cancelled: stats.provider_cancelled.unwrap_or(0),
            courier_unavailable: stats.courier_unavailable.unwrap_or(0),
        })
    }

    /// Récupère les statistiques de pénalités (si système de pénalités implémenté)
    async fn get_penalty_stats(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AppResult<Option<ProviderPenaltyStats>> {
        // TODO: Implémenter quand le système de pénalités sera créé
        // Pour l'instant, retourner None
        Ok(None)
    }

    /// Récupère les statistiques d'annulation par produit
    pub async fn get_product_cancellation_stats(
        &self,
        provider_user_id: i32,
        service_id: Option<i32>,
        period_start: Option<DateTime<Utc>>,
        period_end: Option<DateTime<Utc>>,
    ) -> AppResult<Vec<ProductCancellationStats>> {
        let period_start = period_start.unwrap_or_else(|| Utc::now() - chrono::Duration::days(30));
        let period_end = period_end.unwrap_or_else(Utc::now);

        let query = if let Some(service_id) = service_id {
            sqlx::query!(
                r#"
                SELECT 
                    service_id,
                    product_index,
                    total_orders,
                    total_cancellations,
                    cancellation_rate,
                    timeout_cancellations,
                    rejected_cancellations
                FROM product_cancellation_stats
                WHERE service_id = $1
                AND last_calculated_at >= $2
                AND last_calculated_at <= $3
                ORDER BY cancellation_rate DESC
                "#,
                service_id,
                period_start,
                period_end
            )
            .fetch_all(&self.pool)
            .await?
        } else {
            // Récupérer pour tous les services du prestataire
            sqlx::query!(
                r#"
                SELECT 
                    pcs.service_id,
                    pcs.product_index,
                    pcs.total_orders,
                    pcs.total_cancellations,
                    pcs.cancellation_rate,
                    pcs.timeout_cancellations,
                    pcs.rejected_cancellations
                FROM product_cancellation_stats pcs
                INNER JOIN services s ON s.id = pcs.service_id
                WHERE s.user_id = $1
                AND pcs.last_calculated_at >= $2
                AND pcs.last_calculated_at <= $3
                ORDER BY pcs.cancellation_rate DESC
                "#,
                provider_user_id,
                period_start,
                period_end
            )
            .fetch_all(&self.pool)
            .await?
        };

        Ok(query
            .into_iter()
            .map(|r| ProductCancellationStats {
                service_id: r.service_id,
                product_index: r.product_index,
                total_orders: r.total_orders,
                total_cancellations: r.total_cancellations,
                cancellation_rate: {
                    use rust_decimal::prelude::ToPrimitive;
                    r.cancellation_rate.to_f64().unwrap_or(0.0)
                },
                timeout_cancellations: r.timeout_cancellations,
                rejected_cancellations: r.rejected_cancellations,
            })
            .collect())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductCancellationStats {
    pub service_id: i32,
    pub product_index: i32,
    pub total_orders: i32,
    pub total_cancellations: i32,
    pub cancellation_rate: f64,
    pub timeout_cancellations: i32,
    pub rejected_cancellations: i32,
}

