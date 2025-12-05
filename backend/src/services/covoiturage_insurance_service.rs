// ✅ Service assurance passagers pour covoiturage
// Date: 2025-01-29

use crate::core::types::{AppError, AppResult};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InsuranceConfig {
    pub coverage_type: CoverageType,
    pub coverage_amount: Decimal,
    pub provider: InsuranceProvider,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum CoverageType {
    Basic,   // Couverture de base (ex: 50,000 XAF)
    Premium, // Couverture premium (ex: 200,000 XAF)
    Full,    // Couverture complète (ex: 500,000 XAF)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum InsuranceProvider {
    Internal, // Assurance interne Yukpo
    External, // Assurance externe (partenaire)
    Partner,  // Assurance partenaire
}

pub struct CovoiturageInsuranceService {
    pool: PgPool,
}

impl CovoiturageInsuranceService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Crée une assurance pour un passager
    pub async fn create_insurance(
        &self,
        reservation_id: i32,
        passenger_user_id: i32,
        coverage_type: CoverageType,
        trip_start_date: chrono::DateTime<chrono::Utc>,
        trip_end_date: chrono::DateTime<chrono::Utc>,
    ) -> AppResult<i32> {
        info!(
            "[CovoiturageInsurance] Création assurance pour reservation_id={}, passenger_id={}",
            reservation_id, passenger_user_id
        );

        let coverage_amount = match coverage_type {
            CoverageType::Basic => Decimal::from(50000), // 50,000 XAF
            CoverageType::Premium => Decimal::from(200000), // 200,000 XAF
            CoverageType::Full => Decimal::from(500000), // 500,000 XAF
        };

        let insurance_id: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO covoiturage_insurance (
                reservation_id, passenger_user_id, insurance_provider,
                coverage_amount, coverage_type, status,
                start_date, end_date
            )
            VALUES ($1, $2, 'internal', $3, $4, 'active', $5, $6)
            RETURNING id
            "#,
        )
        .bind(reservation_id)
        .bind(passenger_user_id)
        .bind(coverage_amount)
        .bind(format!("{:?}", coverage_type).to_lowercase())
        .bind(trip_start_date)
        .bind(trip_end_date)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            error!("[CovoiturageInsurance] Erreur création: {}", e);
            AppError::Internal(format!("Erreur création assurance: {}", e))
        })?;

        // Mettre à jour réservation
        sqlx::query(
            "UPDATE reservations SET insurance_included = true, insurance_coverage_amount = $1 WHERE id = $2"
        )
        .bind(coverage_amount)
        .bind(reservation_id)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!("[CovoiturageInsurance] Erreur mise à jour réservation: {}", e);
            AppError::Internal(format!("Erreur mise à jour réservation: {}", e))
        })?;

        info!(
            "[CovoiturageInsurance] ✅ Assurance créée ID={}",
            insurance_id
        );
        Ok(insurance_id)
    }

    /// Récupère l'assurance d'une réservation
    pub async fn get_reservation_insurance(
        &self,
        reservation_id: i32,
    ) -> AppResult<Option<InsuranceInfo>> {
        let insurance = sqlx::query_as!(
            InsuranceInfo,
            r#"
            SELECT 
                id,
                reservation_id,
                passenger_user_id,
                insurance_provider,
                policy_number,
                coverage_amount,
                coverage_type,
                status,
                start_date,
                end_date
            FROM covoiturage_insurance
            WHERE reservation_id = $1 AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
            "#
        )
        .bind(reservation_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("[CovoiturageInsurance] Erreur récupération: {}", e);
            AppError::Internal(format!("Erreur récupération assurance: {}", e))
        })?;

        Ok(insurance)
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InsuranceInfo {
    pub id: i32,
    pub reservation_id: i32,
    pub passenger_user_id: i32,
    pub insurance_provider: Option<String>,
    pub policy_number: Option<String>,
    pub coverage_amount: rust_decimal::Decimal,
    pub coverage_type: String,
    pub status: String,
    pub start_date: chrono::DateTime<chrono::Utc>,
    pub end_date: chrono::DateTime<chrono::Utc>,
}

use log::{error, info};
