// ✅ Phase 10 - Service d'analytics pour prestataires
// Fournit des statistiques et métriques pour les prestataires

use crate::core::types::AppError;
use crate::core::types::AppResult;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::sync::Arc;

/// Statistiques de livraisons pour un prestataire
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryStats {
    pub total_deliveries: i64,
    pub completed_deliveries: i64,
    pub cancelled_deliveries: i64,
    pub pending_deliveries: i64,
    pub success_rate: f64,
    pub avg_delivery_time_minutes: Option<f64>,
    pub total_revenue: f64,
    pub avg_revenue_per_delivery: f64,
}

/// Statistiques de services pour un prestataire
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStats {
    pub total_services: i64,
    pub active_services: i64,
    pub total_views: i64,
    pub total_interactions: i64,
    pub avg_rating: Option<f64>,
    pub total_reviews: i64,
}

/// Statistiques de revenus pour un prestataire
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueStats {
    pub total_revenue: f64,
    pub revenue_this_month: f64,
    pub revenue_last_month: f64,
    pub revenue_growth: f64, // Pourcentage de croissance
    pub avg_revenue_per_delivery: f64,
    pub total_commissions: f64,
}

/// Top produit/service par nombre de commandes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopProduct {
    pub service_id: i32,
    pub product_index: Option<i32>,
    pub product_name: String,
    pub order_count: i64,
    pub total_revenue: f64,
}

/// Zone de livraison la plus fréquente
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopDeliveryZone {
    pub zone_id: Option<String>,
    pub zone_name: Option<String>,
    pub delivery_count: i64,
    pub avg_distance_km: Option<f64>,
}

/// Données de performance sur une période
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceDataPoint {
    pub date: String, // Format YYYY-MM-DD
    pub deliveries: i64,
    pub revenue: f64,
    pub success_rate: f64,
}

/// Tableau de bord analytics complet pour un prestataire
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAnalytics {
    pub delivery_stats: DeliveryStats,
    pub service_stats: ServiceStats,
    pub revenue_stats: RevenueStats,
    pub top_products: Vec<TopProduct>,
    pub top_delivery_zones: Vec<TopDeliveryZone>,
    pub performance_over_time: Vec<PerformanceDataPoint>,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
}

pub struct AnalyticsService {
    pool: PgPool,
}

impl AnalyticsService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Récupère les analytics complètes pour un prestataire
    pub async fn get_provider_analytics(
        &self,
        provider_user_id: i32,
        days: Option<i32>,
    ) -> AppResult<ProviderAnalytics> {
        let days = days.unwrap_or(30); // Par défaut 30 jours
        let period_start = Utc::now() - Duration::days(days as i64);
        let period_end = Utc::now();

        let delivery_stats = self
            .get_delivery_stats(provider_user_id, period_start, period_end)
            .await?;
        let service_stats = self
            .get_service_stats(provider_user_id, period_start, period_end)
            .await?;
        let revenue_stats = self
            .get_revenue_stats(provider_user_id, period_start, period_end)
            .await?;
        let top_products = self
            .get_top_products(provider_user_id, period_start, period_end, 10)
            .await?;
        let top_delivery_zones = self
            .get_top_delivery_zones(provider_user_id, period_start, period_end, 10)
            .await?;
        let performance_over_time = self
            .get_performance_over_time(provider_user_id, period_start, period_end)
            .await?;

        Ok(ProviderAnalytics {
            delivery_stats,
            service_stats,
            revenue_stats,
            top_products,
            top_delivery_zones,
            performance_over_time,
            period_start,
            period_end,
        })
    }

    /// Récupère les statistiques de livraisons
    pub async fn get_delivery_stats(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AppResult<DeliveryStats> {
        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_deliveries,
                COUNT(*) FILTER (WHERE status = 'delivered') as completed_deliveries,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_deliveries,
                COUNT(*) FILTER (WHERE status IN ('pending', 'assigned', 'picked_up', 'in_transit')) as pending_deliveries,
                AVG(EXTRACT(EPOCH FROM (delivered_at - picked_up_at)) / 60.0) 
                    FILTER (WHERE status = 'delivered' AND delivered_at IS NOT NULL AND picked_up_at IS NOT NULL) 
                    as avg_delivery_time_minutes,
                COALESCE(SUM(total_cost), 0.0) as total_revenue
            FROM deliveries
            WHERE merchant_user_id = $1
              AND created_at >= $2
              AND created_at <= $3
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération stats livraisons: {}", e)))?;

        let total = stats.total_deliveries.unwrap_or(0) as f64;
        let completed = stats.completed_deliveries.unwrap_or(0) as f64;
        let success_rate = if total > 0.0 {
            (completed / total * 100.0).round() / 100.0
        } else {
            0.0
        };

        let avg_revenue_per_delivery = if completed > 0.0 {
            (stats.total_revenue.unwrap_or(0.0) as f64) / completed
        } else {
            0.0
        };

        Ok(DeliveryStats {
            total_deliveries: stats.total_deliveries.unwrap_or(0),
            completed_deliveries: stats.completed_deliveries.unwrap_or(0),
            cancelled_deliveries: stats.cancelled_deliveries.unwrap_or(0),
            pending_deliveries: stats.pending_deliveries.unwrap_or(0),
            success_rate,
            avg_delivery_time_minutes: stats.avg_delivery_time_minutes.map(|t| t as f64),
            total_revenue: stats.total_revenue.unwrap_or(0.0) as f64,
            avg_revenue_per_delivery,
        })
    }

    /// Récupère les statistiques de services
    async fn get_service_stats(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AppResult<ServiceStats> {
        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_services,
                COUNT(*) FILTER (WHERE is_active = TRUE) as active_services
            FROM services
            WHERE user_id = $1
              AND created_at >= $2
              AND created_at <= $3
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération stats services: {}", e)))?;

        // Récupérer les vues et interactions depuis MongoDB (simplifié ici)
        // TODO: Intégrer avec mongo_history_service pour les vraies stats
        let total_views = 0i64;
        let total_interactions = 0i64;
        let avg_rating = None::<f64>;
        let total_reviews = 0i64;

        Ok(ServiceStats {
            total_services: stats.total_services.unwrap_or(0),
            active_services: stats.active_services.unwrap_or(0),
            total_views,
            total_interactions,
            avg_rating,
            total_reviews,
        })
    }

    /// Récupère les statistiques de revenus
    pub async fn get_revenue_stats(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AppResult<RevenueStats> {
        // Revenus de la période actuelle
        let current_revenue = sqlx::query!(
            r#"
            SELECT COALESCE(SUM(total_cost), 0.0) as total_revenue
            FROM deliveries
            WHERE merchant_user_id = $1
              AND status = 'delivered'
              AND created_at >= $2
              AND created_at <= $3
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération revenus: {}", e)))?;

        // Revenus du mois précédent
        let last_month_start = period_start - Duration::days(30);
        let last_month_revenue = sqlx::query!(
            r#"
            SELECT COALESCE(SUM(total_cost), 0.0) as total_revenue
            FROM deliveries
            WHERE merchant_user_id = $1
              AND status = 'delivered'
              AND created_at >= $2
              AND created_at < $3
            "#,
            provider_user_id,
            last_month_start,
            period_start
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération revenus mois précédent: {}", e)))?;

        let revenue_this_month = current_revenue.total_revenue.unwrap_or(0.0) as f64;
        let revenue_last_month = last_month_revenue.total_revenue.unwrap_or(0.0) as f64;
        let revenue_growth = if revenue_last_month > 0.0 {
            ((revenue_this_month - revenue_last_month) / revenue_last_month * 100.0).round() / 100.0
        } else {
            0.0
        };

        // Revenus totaux (toutes périodes)
        let total_revenue_result = sqlx::query!(
            r#"
            SELECT COALESCE(SUM(total_cost), 0.0) as total_revenue,
                   COUNT(*) as delivery_count
            FROM deliveries
            WHERE merchant_user_id = $1
              AND status = 'delivered'
            "#,
            provider_user_id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération revenus totaux: {}", e)))?;

        let total_revenue = total_revenue_result.total_revenue.unwrap_or(0.0) as f64;
        let delivery_count = total_revenue_result.delivery_count.unwrap_or(0) as f64;
        let avg_revenue_per_delivery = if delivery_count > 0.0 {
            total_revenue / delivery_count
        } else {
            0.0
        };

        Ok(RevenueStats {
            total_revenue,
            revenue_this_month: revenue_this_month,
            revenue_last_month: revenue_last_month,
            revenue_growth,
            avg_revenue_per_delivery,
            total_commissions: 0.0, // TODO: Calculer les commissions réelles
        })
    }

    /// Récupère les top produits/services
    pub async fn get_top_products(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
        limit: i64,
    ) -> AppResult<Vec<TopProduct>> {
        let products = sqlx::query!(
            r#"
            SELECT 
                d.service_id,
                d.product_index,
                COUNT(*) as order_count,
                COALESCE(SUM(d.total_cost), 0.0) as total_revenue
            FROM deliveries d
            JOIN services s ON s.id = d.service_id
            WHERE s.user_id = $1
              AND d.created_at >= $2
              AND d.created_at <= $3
              AND d.status = 'delivered'
            GROUP BY d.service_id, d.product_index
            ORDER BY order_count DESC
            LIMIT $4
            "#,
            provider_user_id,
            period_start,
            period_end,
            limit
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération top produits: {}", e)))?;

        let mut top_products = Vec::new();
        for row in products {
            // Récupérer le nom du produit depuis le JSON du service
            let service_data = sqlx::query!(
                r#"
                SELECT data
                FROM services
                WHERE id = $1
                "#,
                row.service_id
            )
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;

            let product_name = if let Some(service) = service_data {
                if let Some(product_index) = row.product_index {
                    service
                        .data
                        .get("produits")
                        .and_then(|p| p.as_array())
                        .and_then(|arr| arr.get(product_index as usize))
                        .and_then(|prod| prod.get("nom"))
                        .and_then(|n| n.as_str())
                        .unwrap_or("Produit inconnu")
                        .to_string()
                } else {
                    service
                        .data
                        .get("titre_service")
                        .and_then(|t| t.as_str())
                        .unwrap_or("Service")
                        .to_string()
                }
            } else {
                "Service inconnu".to_string()
            };

            top_products.push(TopProduct {
                service_id: row.service_id,
                product_index: row.product_index,
                product_name,
                order_count: row.order_count.unwrap_or(0),
                total_revenue: row.total_revenue.unwrap_or(0.0) as f64,
            });
        }

        Ok(top_products)
    }

    /// Récupère les top zones de livraison
    pub async fn get_top_delivery_zones(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
        limit: i64,
    ) -> AppResult<Vec<TopDeliveryZone>> {
        // Récupérer les zones depuis merchant_storage_locations
        let zones = sqlx::query!(
            r#"
            SELECT 
                msl.zone_id,
                dz.display_name as zone_name,
                COUNT(d.id) as delivery_count,
                AVG(
                    ST_Distance(
                        d.pickup_location::geography,
                        d.dropoff_location::geography
                    ) / 1000.0
                ) as avg_distance_km
            FROM deliveries d
            JOIN services s ON s.id = d.service_id
            LEFT JOIN merchant_storage_locations msl ON msl.id = d.storage_location_id
            LEFT JOIN delivery_zones dz ON dz.id = msl.zone_id
            WHERE s.user_id = $1
              AND d.created_at >= $2
              AND d.created_at <= $3
              AND d.status = 'delivered'
            GROUP BY msl.zone_id, dz.display_name
            ORDER BY delivery_count DESC
            LIMIT $4
            "#,
            provider_user_id,
            period_start,
            period_end,
            limit
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération top zones: {}", e)))?;

        Ok(zones
            .into_iter()
            .map(|row| TopDeliveryZone {
                zone_id: row.zone_id.map(|id| id.to_string()),
                zone_name: row.zone_name,
                delivery_count: row.delivery_count.unwrap_or(0),
                avg_distance_km: row.avg_distance_km.map(|d| d as f64),
            })
            .collect())
    }

    /// Récupère les données de performance sur le temps (par jour)
    pub async fn get_performance_over_time(
        &self,
        provider_user_id: i32,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AppResult<Vec<PerformanceDataPoint>> {
        let data = sqlx::query!(
            r#"
            SELECT 
                DATE(d.created_at) as date,
                COUNT(*) as deliveries,
                COALESCE(SUM(d.total_cost), 0.0) as revenue,
                COUNT(*) FILTER (WHERE d.status = 'delivered')::float / NULLIF(COUNT(*), 0) * 100.0 as success_rate
            FROM deliveries d
            JOIN services s ON s.id = d.service_id
            WHERE s.user_id = $1
              AND d.created_at >= $2
              AND d.created_at <= $3
            GROUP BY DATE(d.created_at)
            ORDER BY date ASC
            "#,
            provider_user_id,
            period_start,
            period_end
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération performance: {}", e)))?;

        Ok(data
            .into_iter()
            .map(|row| PerformanceDataPoint {
                date: row.date.format("%Y-%m-%d").to_string(),
                deliveries: row.deliveries.unwrap_or(0),
                revenue: row.revenue.unwrap_or(0.0) as f64,
                success_rate: (row.success_rate.unwrap_or(0.0) as f64).round() / 100.0,
            })
            .collect())
    }
}

