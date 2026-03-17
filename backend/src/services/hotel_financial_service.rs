// ✅ NOUVEAU: Service financier pour les partenaires hôtel/meublé
// Date: 2026-03-17
// Description: Service pour le suivi financier, commissions, revenus, et analyses

use crate::core::types::AppError;
use rust_decimal::Decimal;
use serde_json::json;
use sqlx::{PgPool, Row};
use chrono::{DateTime, Utc, NaiveDate};

/// Service financier pour les partenaires hôtel/meublé
pub struct HotelFinancialService;

impl HotelFinancialService {
    /// Récupère le tableau de bord financier d'un partenaire
    pub async fn get_financial_dashboard(
        pool: &PgPool,
        user_id: i32,
        property_id: Option<i32>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
    ) -> Result<serde_json::Value, AppError> {
        // Vérifier que l'utilisateur a des propriétés hôtel/meublé
        let has_properties: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM real_estate_properties rep
                INNER JOIN services s ON s.id = rep.service_id
                WHERE s.user_id = $1 AND rep.type_bien IN ('hotel', 'meuble')
                AND ($2::int IS NULL OR rep.id = $2)
            )
            "#,
        )
        .bind(user_id)
        .bind(property_id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!("[get_financial_dashboard] Erreur vérification propriétés: {}", e);
            AppError::Internal("Erreur vérification propriétés".to_string())
        })?;

        if !has_properties {
            return Err(AppError::Forbidden("Aucune propriété hôtel/meublé trouvée".to_string()));
        }

        // Revenus totaux (réservations confirmées et payées)
        let total_revenue: Option<Decimal> = sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(r.montant_total), 0)
            FROM hotel_meuble_reservations r
            INNER JOIN real_estate_properties p ON p.id = r.property_id
            INNER JOIN services s ON s.id = p.service_id
            WHERE s.user_id = $1
            AND ($2::int IS NULL OR p.id = $2)
            AND r.status IN ('confirmed', 'checked_in', 'checked_out', 'completed')
            AND r.payment_status = 'fully_paid'
            AND ($3::date IS NULL OR r.date_arrivee >= $3)
            AND ($4::date IS NULL OR r.date_arrivee <= $4)
            "#,
        )
        .bind(user_id)
        .bind(property_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!("[get_financial_dashboard] Erreur calcul revenus: {}", e);
            AppError::Internal("Erreur calcul revenus".to_string())
        })?;

        // Montants des avances reçues
        let total_advances: Option<Decimal> = sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(r.montant_avance), 0)
            FROM hotel_meuble_reservations r
            INNER JOIN real_estate_properties p ON p.id = r.property_id
            INNER JOIN services s ON s.id = p.service_id
            WHERE s.user_id = $1
            AND ($2::int IS NULL OR p.id = $2)
            AND r.status NOT IN ('cancelled')
            AND r.payment_status IN ('advance_paid', 'fully_paid')
            AND ($3::date IS NULL OR r.date_arrivee >= $3)
            AND ($4::date IS NULL OR r.date_arrivee <= $4)
            "#,
        )
        .bind(user_id)
        .bind(property_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!("[get_financial_dashboard] Erreur calcul avances: {}", e);
            AppError::Internal("Erreur calcul avances".to_string())
        })?;

        // Commissions (10% standard)
        let commission_rate = Decimal::from_f64_retain(0.10).unwrap_or(Decimal::ZERO);
        let total_commissions = total_revenue.unwrap_or(Decimal::ZERO) * commission_rate;
        let net_revenue = total_revenue.unwrap_or(Decimal::ZERO) - total_commissions;

        // Nombre de réservations
        let total_reservations: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM hotel_meuble_reservations r
            INNER JOIN real_estate_properties p ON p.id = r.property_id
            INNER JOIN services s ON s.id = p.service_id
            WHERE s.user_id = $1
            AND ($2::int IS NULL OR p.id = $2)
            AND ($3::date IS NULL OR r.date_arrivee >= $3)
            AND ($4::date IS NULL OR r.date_arrivee <= $4)
            "#,
        )
        .bind(user_id)
        .bind(property_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!("[get_financial_dashboard] Erreur comptage réservations: {}", e);
            AppError::Internal("Erreur comptage réservations".to_string())
        })?;

        // Réservations par statut
        #[derive(sqlx::FromRow)]
        struct ReservationStatus {
            status: String,
            count: i64,
            total_amount: Option<Decimal>,
        }

        let reservations_by_status = sqlx::query_as::<_, ReservationStatus>(
            r#"
            SELECT 
                r.status,
                COUNT(*) as count,
                COALESCE(SUM(r.montant_total), 0) as total_amount
            FROM hotel_meuble_reservations r
            INNER JOIN real_estate_properties p ON p.id = r.property_id
            INNER JOIN services s ON s.id = p.service_id
            WHERE s.user_id = $1
            AND ($2::int IS NULL OR p.id = $2)
            AND ($3::date IS NULL OR r.date_arrivee >= $3)
            AND ($4::date IS NULL OR r.date_arrivee <= $4)
            GROUP BY r.status
            ORDER BY count DESC
            "#,
        )
        .bind(user_id)
        .bind(property_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            log::error!("[get_financial_dashboard] Erreur statuts réservations: {}", e);
            AppError::Internal("Erreur statuts réservations".to_string())
        })?;

        // Revenus mensuels (derniers 12 mois)
        let monthly_revenue = sqlx::query(
            r#"
            SELECT 
                DATE_TRUNC('month', r.date_arrivee) as month,
                COALESCE(SUM(r.montant_total), 0) as revenue,
                COUNT(*) as reservations_count
            FROM hotel_meuble_reservations r
            INNER JOIN real_estate_properties p ON p.id = r.property_id
            INNER JOIN services s ON s.id = p.service_id
            WHERE s.user_id = $1
            AND ($2::int IS NULL OR p.id = $2)
            AND r.date_arrivee >= NOW() - INTERVAL '12 months'
            AND r.status IN ('confirmed', 'checked_in', 'checked_out', 'completed')
            AND r.payment_status = 'fully_paid'
            GROUP BY DATE_TRUNC('month', r.date_arrivee)
            ORDER BY month DESC
            "#,
        )
        .bind(user_id)
        .bind(property_id)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            log::error!("[get_financial_dashboard] Erreur revenus mensuels: {}", e);
            AppError::Internal("Erreur revenus mensuels".to_string())
        })?;

        // Top propriétés par revenus
        let top_properties = sqlx::query(
            r#"
            SELECT 
                p.id,
                p.titre,
                p.ville,
                COUNT(r.id) as reservations_count,
                COALESCE(SUM(r.montant_total), 0) as revenue
            FROM real_estate_properties p
            LEFT JOIN hotel_meuble_reservations r ON r.property_id = p.id
            INNER JOIN services s ON s.id = p.service_id
            WHERE s.user_id = $1
            AND p.type_bien IN ('hotel', 'meuble')
            AND ($2::int IS NULL OR p.id = $2)
            AND r.status IN ('confirmed', 'checked_in', 'checked_out', 'completed')
            AND r.payment_status = 'fully_paid'
            AND ($3::date IS NULL OR r.date_arrivee >= $3)
            AND ($4::date IS NULL OR r.date_arrivee <= $4)
            GROUP BY p.id, p.titre, p.ville
            HAVING COUNT(r.id) > 0
            ORDER BY revenue DESC
            LIMIT 10
            "#,
        )
        .bind(user_id)
        .bind(property_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            log::error!("[get_financial_dashboard] Erreur top propriétés: {}", e);
            AppError::Internal("Erreur top propriétés".to_string())
        })?;

        // Taux d'occupation (approximatif)
        let occupancy_stats = sqlx::query(
            r#"
            WITH calendar_days AS (
                SELECT generate_series(
                    COALESCE($3, CURRENT_DATE - INTERVAL '30 days'),
                    COALESCE($4, CURRENT_DATE),
                    '1 day'::interval
                )::date as day
            ),
            occupied_days AS (
                SELECT 
                    p.id as property_id,
                    cd.day,
                    COUNT(r.id) as occupied_units
                FROM calendar_days cd
                CROSS JOIN real_estate_properties p
                INNER JOIN services s ON s.id = p.service_id
                LEFT JOIN hotel_meuble_reservations r ON r.property_id = p.id
                    AND cd.day BETWEEN r.date_arrivee AND r.date_depart - INTERVAL '1 day'
                    AND r.status IN ('confirmed', 'checked_in', 'checked_out', 'completed')
                WHERE s.user_id = $1
                AND ($2::int IS NULL OR p.id = $2)
                GROUP BY p.id, cd.day
            )
            SELECT 
                COUNT(*) as total_days,
                SUM(CASE WHEN occupied_units > 0 THEN 1 ELSE 0 END) as occupied_days
            FROM occupied_days
            "#,
        )
        .bind(user_id)
        .bind(property_id)
        .bind(start_date.unwrap_or_else(|| Utc::now().date_naive() - chrono::Duration::days(30)))
        .bind(end_date.unwrap_or_else(|| Utc::now().date_naive()))
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!("[get_financial_dashboard] Erreur taux occupation: {}", e);
            AppError::Internal("Erreur taux occupation".to_string())
        })?;

        let total_days: i64 = occupancy_stats.try_get("total_days").unwrap_or(0);
        let occupied_days: i64 = occupancy_stats.try_get("occupied_days").unwrap_or(0);
        let occupancy_rate = if total_days > 0 {
            (occupied_days as f64 / total_days as f64) * 100.0
        } else {
            0.0
        };

        Ok(json!({
            "summary": {
                "total_revenue": total_revenue.unwrap_or(Decimal::ZERO).to_string().parse::<f64>().unwrap_or(0.0),
                "total_advances": total_advances.unwrap_or(Decimal::ZERO).to_string().parse::<f64>().unwrap_or(0.0),
                "total_commissions": total_commissions.to_string().parse::<f64>().unwrap_or(0.0),
                "net_revenue": net_revenue.to_string().parse::<f64>().unwrap_or(0.0),
                "total_reservations": total_reservations,
                "occupancy_rate": occupancy_rate,
                "commission_rate": 0.10
            },
            "reservations_by_status": reservations_by_status.into_iter().map(|r| json!({
                "status": r.status,
                "count": r.count,
                "total_amount": r.total_amount.unwrap_or(Decimal::ZERO).to_string().parse::<f64>().unwrap_or(0.0)
            })).collect::<Vec<_>>(),
            "monthly_revenue": monthly_revenue.into_iter().map(|row| json!({
                "month": row.try_get::<DateTime<Utc>, _>("month").ok().map(|d| d.format("%Y-%m").to_string()),
                "revenue": row.try_get::<Decimal, _>("revenue").unwrap_or(Decimal::ZERO).to_string().parse::<f64>().unwrap_or(0.0),
                "reservations_count": row.try_get::<i64, _>("reservations_count").unwrap_or(0)
            })).collect::<Vec<_>>(),
            "top_properties": top_properties.into_iter().map(|row| json!({
                "property_id": row.try_get::<i32, _>("id").unwrap_or(0),
                "title": row.try_get::<Option<String>, _>("titre").unwrap_or(None),
                "city": row.try_get::<Option<String>, _>("ville").unwrap_or(None),
                "reservations_count": row.try_get::<i64, _>("reservations_count").unwrap_or(0),
                "revenue": row.try_get::<Decimal, _>("revenue").unwrap_or(Decimal::ZERO).to_string().parse::<f64>().unwrap_or(0.0)
            })).collect::<Vec<_>>(),
            "filters": {
                "property_id": property_id,
                "start_date": start_date.map(|d| d.to_string()),
                "end_date": end_date.map(|d| d.to_string())
            }
        }))
    }

    /// Récupère les transactions détaillées
    pub async fn get_transaction_history(
        pool: &PgPool,
        user_id: i32,
        property_id: Option<i32>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<serde_json::Value>, AppError> {
        let query = r#"
        SELECT 
            r.id as reservation_id,
            r.property_id,
            p.titre as property_name,
            r.nom_client,
            r.date_arrivee,
            r.date_depart,
            r.montant_total,
            r.montant_avance,
            r.payment_status,
            r.payment_method,
            r.status,
            r.created_at,
            r.updated_at,
            CASE 
                WHEN r.status = 'cancelled' THEN 'cancellation'
                WHEN r.payment_status = 'fully_paid' THEN 'payment_completed'
                WHEN r.payment_status = 'advance_paid' THEN 'advance_payment'
                ELSE 'reservation'
            END as transaction_type
        FROM hotel_meuble_reservations r
        INNER JOIN real_estate_properties p ON p.id = r.property_id
        INNER JOIN services s ON s.id = p.service_id
        WHERE s.user_id = $1
        AND ($2::int IS NULL OR p.id = $2)
        AND ($3::date IS NULL OR r.date_arrivee >= $3)
        AND ($4::date IS NULL OR r.date_arrivee <= $4)
        ORDER BY r.created_at DESC
        LIMIT $5 OFFSET $6
        "#;

        let rows = sqlx::query(query)
            .bind(user_id)
            .bind(property_id)
            .bind(start_date)
            .bind(end_date)
            .bind(limit.unwrap_or(50))
            .bind(offset.unwrap_or(0))
            .fetch_all(pool)
            .await
            .map_err(|e| {
                log::error!("[get_transaction_history] Erreur: {}", e);
                AppError::Internal("Erreur récupération transactions".to_string())
            })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(json!({
                "reservation_id": row.try_get::<i32, _>("reservation_id").unwrap_or(0),
                "property_id": row.try_get::<i32, _>("property_id").unwrap_or(0),
                "property_name": row.try_get::<Option<String>, _>("property_name").unwrap_or(None),
                "client_name": row.try_get::<Option<String>, _>("nom_client").unwrap_or(None),
                "date_arrivee": row.try_get::<Option<NaiveDate>, _>("date_arrivee").ok().flatten().map(|d| d.to_string()),
                "date_depart": row.try_get::<Option<NaiveDate>, _>("date_depart").ok().flatten().map(|d| d.to_string()),
                "total_amount": row.try_get::<Option<Decimal>, _>("montant_total").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
                "advance_amount": row.try_get::<Option<Decimal>, _>("montant_avance").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
                "payment_status": row.try_get::<Option<String>, _>("payment_status").unwrap_or(None),
                "payment_method": row.try_get::<Option<String>, _>("payment_method").unwrap_or(None),
                "status": row.try_get::<Option<String>, _>("status").unwrap_or(None),
                "transaction_type": row.try_get::<String, _>("transaction_type").unwrap_or_else(|_| "reservation".to_string()),
                "created_at": row.try_get::<Option<DateTime<Utc>>, _>("created_at").ok().flatten().map(|d| d.to_rfc3339()),
                "updated_at": row.try_get::<Option<DateTime<Utc>>, _>("updated_at").ok().flatten().map(|d| d.to_rfc3339()),
            }));
        }

        Ok(result)
    }

    /// Exporte les données financières en CSV
    pub async fn export_financial_data(
        pool: &PgPool,
        user_id: i32,
        property_id: Option<i32>,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
    ) -> Result<String, AppError> {
        let transactions = Self::get_transaction_history(
            pool,
            user_id,
            property_id,
            start_date,
            end_date,
            Some(10000), // Limite haute pour export
            Some(0),
        ).await?;

        let mut csv = String::new();
        csv.push_str("ID Réservation,Propriété,Client,Date Arrivée,Date Départ,Montant Total,Avance,Statut Paiement,Méthode Paiement,Statut,Type Transaction,Date Création\n");

        for tx in transactions {
            let row = format!(
                "{},{},{},{},{},{},{},{},{},{},{},{}\n",
                tx.get("reservation_id").unwrap_or(&json!(null)),
                tx.get("property_name").unwrap_or(&json!(null)),
                tx.get("client_name").unwrap_or(&json!(null)),
                tx.get("date_arrivee").unwrap_or(&json!(null)),
                tx.get("date_depart").unwrap_or(&json!(null)),
                tx.get("total_amount").unwrap_or(&json!(null)),
                tx.get("advance_amount").unwrap_or(&json!(null)),
                tx.get("payment_status").unwrap_or(&json!(null)),
                tx.get("payment_method").unwrap_or(&json!(null)),
                tx.get("status").unwrap_or(&json!(null)),
                tx.get("transaction_type").unwrap_or(&json!(null)),
                tx.get("created_at").unwrap_or(&json!(null))
            );
            csv.push_str(&row);
        }

        Ok(csv)
    }
}
