use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;

use crate::core::types::{AppError, AppResult};

pub const INVENTORY_STALE_THRESHOLD_HOURS: i64 = 72;

#[derive(Clone)]
pub struct InventoryService {
    pool: PgPool,
}

#[derive(Debug, Clone)]
pub struct StockSignal {
    pub service_id: i32,
    pub product_index: i32,
    pub stock_level: i32,
    pub source: Option<String>,
    pub note: Option<String>,
    pub last_synced_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

impl StockSignal {
    pub fn is_stale(&self, threshold_hours: i64) -> bool {
        let threshold = Duration::hours(threshold_hours);
        Utc::now()
            .signed_duration_since(self.last_synced_at)
            .gt(&threshold)
            || self
                .expires_at
                .map(|expires| expires < Utc::now())
                .unwrap_or(false)
    }
}

impl InventoryService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn ensure_service_owner(&self, user_id: i32, service_id: i32) -> AppResult<()> {
        let record = sqlx::query!("SELECT user_id FROM services WHERE id = $1", service_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(AppError::from)?;

        let Some(row) = record else {
            return Err(AppError::NotFound("Service introuvable.".into()));
        };

        if row.user_id != user_id {
            return Err(AppError::Forbidden(
                "Vous ne pouvez modifier que vos propres services.".into(),
            ));
        }

        Ok(())
    }

    pub async fn upsert_override(
        &self,
        service_id: i32,
        product_index: i32,
        stock_level: i32,
        source: Option<String>,
        note: Option<String>,
        expires_at: Option<DateTime<Utc>>,
    ) -> AppResult<StockSignal> {
        let record = sqlx::query_as!(
            StockSignalRow,
            r#"
            INSERT INTO service_inventory_overrides (
                service_id,
                product_index,
                stock_level,
                source,
                note,
                expires_at,
                last_synced_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (service_id, product_index)
            DO UPDATE SET
                stock_level = EXCLUDED.stock_level,
                source = EXCLUDED.source,
                note = EXCLUDED.note,
                expires_at = EXCLUDED.expires_at,
                last_synced_at = NOW()
            RETURNING service_id, product_index, stock_level, source, note, last_synced_at, expires_at
            "#,
            service_id,
            product_index,
            stock_level,
            source,
            note,
            expires_at
        )
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)?;

        Ok(record.into())
    }

    pub async fn latest_signal(
        &self,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<Option<StockSignal>> {
        let record = sqlx::query_as!(
            StockSignalRow,
            r#"
            SELECT
                service_id,
                product_index,
                stock_level,
                source,
                note,
                last_synced_at,
                expires_at
            FROM service_inventory_overrides
            WHERE service_id = $1
              AND product_index = $2
            "#,
            service_id,
            product_index
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)?;

        Ok(record.map(Into::into))
    }
}

#[derive(sqlx::FromRow)]
struct StockSignalRow {
    service_id: i32,
    product_index: i32,
    stock_level: i32,
    source: Option<String>,
    note: Option<String>,
    last_synced_at: DateTime<Utc>,
    expires_at: Option<DateTime<Utc>>,
}

impl From<StockSignalRow> for StockSignal {
    fn from(value: StockSignalRow) -> Self {
        StockSignal {
            service_id: value.service_id,
            product_index: value.product_index,
            stock_level: value.stock_level,
            source: value.source,
            note: value.note,
            last_synced_at: value.last_synced_at,
            expires_at: value.expires_at,
        }
    }
}
