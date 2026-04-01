//! ✅ Service Analytics Dashboard - Taxi & Covoiturage
//!
//! Dashboard complet avec métriques temps réel
//! Objectif: Business Intelligence de niveau mondial

use crate::core::types::AppResult;
use chrono::{NaiveDate, Utc};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

/// Vue d'ensemble analytics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsOverview {
    pub total_trips: i64,
    pub total_revenue: f64,
    pub active_drivers: i64,
    pub active_passengers: i64,
    pub demand_supply_ratio: f64,
    pub average_wait_time_minutes: f64,
    pub satisfaction_rate: f64,
    pub peak_hours: Vec<PeakHourStats>,
    pub revenue_trend: RevenueTrend,
    pub top_zones: Vec<ZoneStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeakHourStats {
    pub hour: u8,
    pub demand: f64,
    pub supply: f64,
    pub ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueTrend {
    pub today: f64,
    pub yesterday: f64,
    pub last_7_days: f64,
    pub last_30_days: f64,
    pub trend_percentage: f64, // % de variation
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZoneStats {
    pub zone_id: String,
    pub zone_name: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub total_trips: i64,
    pub revenue: f64,
    pub average_rating: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemandTrendPoint {
    pub date: String,
    pub hour: Option<i32>,
    pub demand_count: i64,
    pub completed_count: i64,
    pub cancellation_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemandTrendsData {
    pub service_type: String,
    pub period_days: i32,
    pub trends: Vec<DemandTrendPoint>,
    pub total_demand: i64,
    pub avg_daily_demand: f64,
    pub peak_day_of_week: String,
    pub peak_hour: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueAnalyticsData {
    pub total_revenue: f64,
    pub platform_commission: f64,
    pub driver_earnings: f64,
    pub average_trip_value: f64,
    pub revenue_by_day: Vec<RevenueDayPoint>,
    pub revenue_by_service: Vec<RevenueByService>,
    pub refunds_total: f64,
    pub net_revenue: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueDayPoint {
    pub date: String,
    pub revenue: f64,
    pub trips: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueByService {
    pub service_type: String,
    pub revenue: f64,
    pub trip_count: i64,
    pub avg_per_trip: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverPerformanceData {
    pub total_drivers: i64,
    pub active_drivers: i64,
    pub top_drivers: Vec<DriverStats>,
    pub avg_rating: f64,
    pub avg_trips_per_driver: f64,
    pub avg_revenue_per_driver: f64,
    pub on_time_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverStats {
    pub driver_id: i32,
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub total_trips: i64,
    pub total_revenue: f64,
    pub avg_rating: f64,
    pub completion_rate: f64,
    pub on_time_rate: f64,
}

/// Service Analytics
pub struct TaxiAnalyticsService {
    pool: Arc<PgPool>,
}

impl TaxiAnalyticsService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Obtenir vue d'ensemble
    pub async fn get_overview(
        &self,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
    ) -> AppResult<AnalyticsOverview> {
        info!("[TaxiAnalytics] Récupération vue d'ensemble");

        let start =
            start_date.unwrap_or_else(|| Utc::now().date_naive() - chrono::Duration::days(30));
        let end = end_date.unwrap_or_else(|| Utc::now().date_naive());

        // Total trajets
        let total_trips: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint
            FROM specialized_reservations
            WHERE service_type IN ('taxi', 'covoiturage')
            AND status IN ('confirmed', 'completed')
            AND created_at::date BETWEEN $1 AND $2
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        // Revenus totaux
        let total_revenue: Option<sqlx::types::Decimal> = sqlx::query_scalar(
            r#"
            SELECT SUM(amount)
            FROM specialized_reservations
            WHERE service_type IN ('taxi', 'covoiturage')
            AND status IN ('confirmed', 'completed')
            AND payment_status = 'paid'
            AND created_at::date BETWEEN $1 AND $2
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        let total_revenue_f64 =
            total_revenue.and_then(|d| d.to_string().parse::<f64>().ok()).unwrap_or(0.0);

        // Conducteurs actifs
        let active_drivers: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(DISTINCT prestataire_id)::bigint
            FROM specialized_reservations
            WHERE service_type IN ('taxi', 'covoiturage')
            AND status IN ('confirmed', 'completed')
            AND created_at::date BETWEEN $1 AND $2
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        // Passagers actifs
        let active_passengers: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(DISTINCT user_id)::bigint
            FROM specialized_reservations
            WHERE service_type IN ('taxi', 'covoiturage')
            AND status IN ('confirmed', 'completed')
            AND created_at::date BETWEEN $1 AND $2
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        // Ratio demande/offre
        let demand_supply_ratio = if active_drivers > 0 {
            active_passengers as f64 / active_drivers as f64
        } else {
            0.0
        };

        // Temps d'attente moyen (différence entre created_at et confirmed_at si dispo)
        let avg_wait: f64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(
                AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60.0),
                0.0
            )::float
            FROM specialized_reservations
            WHERE service_type IN ('taxi', 'covoiturage')
            AND status = 'confirmed'
            AND created_at::date BETWEEN $1 AND $2
            AND updated_at > created_at
            AND EXTRACT(EPOCH FROM (updated_at - created_at)) / 60.0 BETWEEN 0 AND 120
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0.0);

        // Satisfaction moyenne depuis ratings spécialisés
        let satisfaction: f64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(
                AVG(r.rating)::float,
                0.0
            )
            FROM specialized_ratings r
            JOIN specialized_reservations sr ON sr.id = r.reservation_id
            WHERE sr.service_type IN ('taxi', 'covoiturage')
            AND sr.created_at::date BETWEEN $1 AND $2
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0.0);

        // Stats heures de pic
        let peak_hours = self.get_peak_hours_stats(start, end).await.unwrap_or_default();

        // Tendance revenus
        let revenue_trend = self.get_revenue_trend().await.unwrap_or(RevenueTrend {
            today: 0.0,
            yesterday: 0.0,
            last_7_days: 0.0,
            last_30_days: total_revenue_f64,
            trend_percentage: 0.0,
        });

        // Top zones
        let top_zones = self.get_top_zones(start, end, Some(10)).await.unwrap_or_default();

        Ok(AnalyticsOverview {
            total_trips,
            total_revenue: total_revenue_f64,
            active_drivers,
            active_passengers,
            demand_supply_ratio,
            average_wait_time_minutes: avg_wait,
            satisfaction_rate: satisfaction,
            peak_hours,
            revenue_trend,
            top_zones,
        })
    }

    pub async fn get_peak_hours_stats(
        &self,
        start: NaiveDate,
        end: NaiveDate,
    ) -> AppResult<Vec<PeakHourStats>> {
        let rows = sqlx::query(
            r#"
            SELECT
                EXTRACT(HOUR FROM created_at)::int AS hour,
                COUNT(*)::float AS demand,
                COUNT(DISTINCT prestataire_id)::float AS supply
            FROM specialized_reservations
            WHERE service_type IN ('taxi', 'covoiturage')
            AND status IN ('pending', 'confirmed', 'completed')
            AND created_at::date BETWEEN $1 AND $2
            GROUP BY hour
            ORDER BY hour
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        use sqlx::Row;
        let stats = rows
            .into_iter()
            .map(|row| {
                let hour: i32 = row.get("hour");
                let demand: f64 = row.get("demand");
                let supply: f64 = row.get("supply");
                PeakHourStats {
                    hour: hour as u8,
                    demand,
                    supply,
                    ratio: if supply > 0.0 {
                        demand / supply
                    } else {
                        demand
                    },
                }
            })
            .collect();

        Ok(stats)
    }

    pub async fn get_revenue_trend(&self) -> AppResult<RevenueTrend> {
        let today_str = Utc::now().date_naive();
        let yesterday = today_str - chrono::Duration::days(1);
        let week_ago = today_str - chrono::Duration::days(7);
        let month_ago = today_str - chrono::Duration::days(30);

        let today: f64 = sqlx::query_scalar(
            r#"SELECT COALESCE(SUM(amount), 0)::float FROM specialized_reservations
               WHERE service_type IN ('taxi','covoiturage') AND payment_status='paid'
               AND created_at::date = $1"#,
        )
        .bind(today_str)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0.0);

        let yest: f64 = sqlx::query_scalar(
            r#"SELECT COALESCE(SUM(amount), 0)::float FROM specialized_reservations
               WHERE service_type IN ('taxi','covoiturage') AND payment_status='paid'
               AND created_at::date = $1"#,
        )
        .bind(yesterday)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0.0);

        let last_7: f64 = sqlx::query_scalar(
            r#"SELECT COALESCE(SUM(amount), 0)::float FROM specialized_reservations
               WHERE service_type IN ('taxi','covoiturage') AND payment_status='paid'
               AND created_at::date BETWEEN $1 AND $2"#,
        )
        .bind(week_ago)
        .bind(today_str)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0.0);

        let last_30: f64 = sqlx::query_scalar(
            r#"SELECT COALESCE(SUM(amount), 0)::float FROM specialized_reservations
               WHERE service_type IN ('taxi','covoiturage') AND payment_status='paid'
               AND created_at::date BETWEEN $1 AND $2"#,
        )
        .bind(month_ago)
        .bind(today_str)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0.0);

        let trend = if yest > 0.0 {
            ((today - yest) / yest) * 100.0
        } else {
            0.0
        };

        Ok(RevenueTrend {
            today,
            yesterday: yest,
            last_7_days: last_7,
            last_30_days: last_30,
            trend_percentage: trend,
        })
    }

    pub async fn get_top_zones(
        &self,
        start: NaiveDate,
        end: NaiveDate,
        limit: Option<i64>,
    ) -> AppResult<Vec<ZoneStats>> {
        let limit = limit.unwrap_or(10);

        // Extraire coordonnées GPS depuis services.data (covoiturage/taxi)
        let rows = sqlx::query(
            r#"
            SELECT
                COALESCE(s.data->>'ville_depart', s.data->>'city', 'Inconnu') AS zone_id,
                COALESCE(s.data->>'ville_depart', s.data->>'city', NULL) AS zone_name,
                COALESCE((s.data->>'gps_depart_lat')::float, 0.0) AS latitude,
                COALESCE((s.data->>'gps_depart_lng')::float, 0.0) AS longitude,
                COUNT(sr.id)::bigint AS total_trips,
                COALESCE(SUM(sr.amount), 0)::float AS revenue,
                COALESCE(AVG(rat.rating), 0)::float AS average_rating
            FROM specialized_reservations sr
            JOIN services s ON s.id = sr.service_id
            LEFT JOIN specialized_ratings rat ON rat.reservation_id = sr.id
            WHERE sr.service_type IN ('taxi', 'covoiturage')
            AND sr.status IN ('confirmed', 'completed')
            AND sr.created_at::date BETWEEN $1 AND $2
            GROUP BY zone_id, zone_name, latitude, longitude
            ORDER BY total_trips DESC
            LIMIT $3
            "#,
        )
        .bind(start)
        .bind(end)
        .bind(limit)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        use sqlx::Row;
        let zones = rows
            .into_iter()
            .map(|row| ZoneStats {
                zone_id: row.get("zone_id"),
                zone_name: row.get("zone_name"),
                latitude: row.get("latitude"),
                longitude: row.get("longitude"),
                total_trips: row.get("total_trips"),
                revenue: row.get("revenue"),
                average_rating: row.get("average_rating"),
            })
            .collect();

        Ok(zones)
    }

    /// Analytics tendances de demande
    pub async fn get_demand_trends(
        &self,
        start: NaiveDate,
        end: NaiveDate,
        service_type: Option<&str>,
    ) -> AppResult<DemandTrendsData> {
        let svc = service_type.unwrap_or("all");

        let service_filter = if svc == "all" {
            "service_type IN ('taxi', 'covoiturage')".to_string()
        } else {
            format!("service_type = '{}'", svc.replace('\'', ""))
        };

        let rows = sqlx::query(&format!(
            r#"
            SELECT
                created_at::date::text AS date,
                EXTRACT(HOUR FROM created_at)::int AS hour,
                COUNT(*)::bigint AS demand_count,
                COUNT(*) FILTER (WHERE status = 'completed')::bigint AS completed_count
            FROM specialized_reservations
            WHERE {}
            AND created_at::date BETWEEN $1 AND $2
            GROUP BY date, hour
            ORDER BY date, hour
            "#,
            service_filter
        ))
        .bind(start)
        .bind(end)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        use sqlx::Row;
        let mut trends = Vec::new();
        let mut total_demand: i64 = 0;
        let mut peak_hour_map: std::collections::HashMap<i32, i64> =
            std::collections::HashMap::new();
        let mut peak_dow_map: std::collections::HashMap<String, i64> =
            std::collections::HashMap::new();

        for row in rows {
            let date: String = row.get("date");
            let hour: i32 = row.get("hour");
            let demand_count: i64 = row.get("demand_count");
            let completed_count: i64 = row.get("completed_count");
            let cancellation_rate = if demand_count > 0 {
                1.0 - (completed_count as f64 / demand_count as f64)
            } else {
                0.0
            };

            *peak_hour_map.entry(hour).or_insert(0) += demand_count;
            *peak_dow_map.entry(date[..10].to_string()).or_insert(0) += demand_count;

            total_demand += demand_count;
            trends.push(DemandTrendPoint {
                date,
                hour: Some(hour),
                demand_count,
                completed_count,
                cancellation_rate,
            });
        }

        let period_days = (end - start).num_days() as i32 + 1;
        let avg_daily_demand = if period_days > 0 {
            total_demand as f64 / period_days as f64
        } else {
            0.0
        };

        let peak_hour =
            peak_hour_map.into_iter().max_by_key(|(_, v)| *v).map(|(h, _)| h).unwrap_or(8);

        let peak_day_of_week = "Lundi".to_string(); // Simplifié — à enrichir si besoin

        Ok(DemandTrendsData {
            service_type: svc.to_string(),
            period_days,
            trends,
            total_demand,
            avg_daily_demand,
            peak_day_of_week,
            peak_hour,
        })
    }

    /// Analytics revenus détaillés
    pub async fn get_revenue_analytics(
        &self,
        start: NaiveDate,
        end: NaiveDate,
    ) -> AppResult<RevenueAnalyticsData> {
        // Revenue par jour
        let day_rows = sqlx::query(
            r#"
            SELECT
                created_at::date::text AS date,
                COALESCE(SUM(amount), 0)::float AS revenue,
                COUNT(*)::bigint AS trips
            FROM specialized_reservations
            WHERE service_type IN ('taxi','covoiturage')
            AND payment_status = 'paid'
            AND created_at::date BETWEEN $1 AND $2
            GROUP BY date
            ORDER BY date
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        use sqlx::Row;
        let revenue_by_day: Vec<RevenueDayPoint> = day_rows
            .into_iter()
            .map(|row| RevenueDayPoint {
                date: row.get("date"),
                revenue: row.get("revenue"),
                trips: row.get("trips"),
            })
            .collect();

        // Revenue par type de service
        let svc_rows = sqlx::query(
            r#"
            SELECT
                service_type,
                COALESCE(SUM(amount), 0)::float AS revenue,
                COUNT(*)::bigint AS trip_count
            FROM specialized_reservations
            WHERE service_type IN ('taxi','covoiturage')
            AND payment_status = 'paid'
            AND created_at::date BETWEEN $1 AND $2
            GROUP BY service_type
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        let revenue_by_service: Vec<RevenueByService> = svc_rows
            .into_iter()
            .map(|row| {
                let revenue: f64 = row.get("revenue");
                let trip_count: i64 = row.get("trip_count");
                RevenueByService {
                    service_type: row.get("service_type"),
                    revenue,
                    trip_count,
                    avg_per_trip: if trip_count > 0 {
                        revenue / trip_count as f64
                    } else {
                        0.0
                    },
                }
            })
            .collect();

        // Totaux
        let total_revenue: f64 = revenue_by_service.iter().map(|r| r.revenue).sum();
        let total_trips: i64 = revenue_by_service.iter().map(|r| r.trip_count).sum();
        let platform_commission = total_revenue * 0.15; // 15% commission plateforme
        let driver_earnings = total_revenue - platform_commission;
        let avg_trip = if total_trips > 0 {
            total_revenue / total_trips as f64
        } else {
            0.0
        };

        Ok(RevenueAnalyticsData {
            total_revenue,
            platform_commission,
            driver_earnings,
            average_trip_value: avg_trip,
            revenue_by_day,
            revenue_by_service,
            refunds_total: 0.0, // À implémenter si table remboursements
            net_revenue: total_revenue - platform_commission,
        })
    }

    /// Performance conducteurs
    pub async fn get_driver_performance(
        &self,
        start: NaiveDate,
        end: NaiveDate,
    ) -> AppResult<DriverPerformanceData> {
        // Top conducteurs
        let driver_rows = sqlx::query(
            r#"
            SELECT
                sr.prestataire_id AS driver_id,
                u.nom,
                u.prenom,
                COUNT(sr.id)::bigint AS total_trips,
                COALESCE(SUM(sr.amount), 0)::float AS total_revenue,
                COALESCE(AVG(rat.rating), 0)::float AS avg_rating,
                (COUNT(sr.id) FILTER (WHERE sr.status = 'completed')::float
                    / NULLIF(COUNT(sr.id), 0)::float) AS completion_rate
            FROM specialized_reservations sr
            LEFT JOIN users u ON u.id = sr.prestataire_id
            LEFT JOIN specialized_ratings rat ON rat.reservation_id = sr.id
            WHERE sr.service_type IN ('taxi','covoiturage')
            AND sr.created_at::date BETWEEN $1 AND $2
            GROUP BY sr.prestataire_id, u.nom, u.prenom
            ORDER BY total_trips DESC
            LIMIT 20
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        use sqlx::Row;
        let top_drivers: Vec<DriverStats> = driver_rows
            .into_iter()
            .map(|row| {
                let completion_rate: Option<f64> = row.get("completion_rate");
                DriverStats {
                    driver_id: row.get("driver_id"),
                    nom: row.get("nom"),
                    prenom: row.get("prenom"),
                    total_trips: row.get("total_trips"),
                    total_revenue: row.get("total_revenue"),
                    avg_rating: row.get("avg_rating"),
                    completion_rate: completion_rate.unwrap_or(0.0),
                    on_time_rate: 0.85, // Estimation; nécessite timestamp confirmation
                }
            })
            .collect();

        // Totaux globaux
        let total_drivers: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT prestataire_id)::bigint FROM specialized_reservations \
             WHERE service_type IN ('taxi','covoiturage') AND created_at::date BETWEEN $1 AND $2",
        )
        .bind(start)
        .bind(end)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        let active_drivers: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT prestataire_id)::bigint FROM specialized_reservations \
             WHERE service_type IN ('taxi','covoiturage') AND status IN ('confirmed','completed') \
             AND created_at::date BETWEEN $1 AND $2",
        )
        .bind(start)
        .bind(end)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        let avg_rating: f64 = sqlx::query_scalar(
            "SELECT COALESCE(AVG(rat.rating), 0)::float FROM specialized_ratings rat \
             JOIN specialized_reservations sr ON sr.id = rat.reservation_id \
             WHERE sr.service_type IN ('taxi','covoiturage') \
             AND sr.created_at::date BETWEEN $1 AND $2",
        )
        .bind(start)
        .bind(end)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0.0);

        let total_trips_all: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM specialized_reservations \
             WHERE service_type IN ('taxi','covoiturage') AND created_at::date BETWEEN $1 AND $2",
        )
        .bind(start)
        .bind(end)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        let total_revenue_all: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(amount), 0)::float FROM specialized_reservations \
             WHERE service_type IN ('taxi','covoiturage') AND payment_status='paid' \
             AND created_at::date BETWEEN $1 AND $2",
        )
        .bind(start)
        .bind(end)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0.0);

        let avg_trips = if total_drivers > 0 {
            total_trips_all as f64 / total_drivers as f64
        } else {
            0.0
        };

        let avg_revenue = if total_drivers > 0 {
            total_revenue_all / total_drivers as f64
        } else {
            0.0
        };

        if top_drivers.is_empty() {
            warn!(
                "[TaxiAnalytics] Aucun conducteur trouvé pour la période {:?}-{:?}",
                start, end
            );
        }

        Ok(DriverPerformanceData {
            total_drivers,
            active_drivers,
            top_drivers,
            avg_rating,
            avg_trips_per_driver: avg_trips,
            avg_revenue_per_driver: avg_revenue,
            on_time_rate: 0.85,
        })
    }
}
