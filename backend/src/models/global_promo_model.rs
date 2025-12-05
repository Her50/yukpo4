use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{postgres::PgRow, FromRow, Row};
use uuid::Uuid;

fn empty_json() -> Value {
    json!({})
}

fn empty_metadata() -> Value {
    json!({})
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct GlobalPromoEvent {
    pub id: Uuid,
    pub slug: String,
    pub theme: String,
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recurrence_rule: Option<String>,
    pub status: String,
    #[serde(default = "empty_json")]
    pub config: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by_user_id: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateGlobalPromoEventRequest {
    pub slug: String,
    pub theme: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    #[serde(default)]
    pub recurrence_rule: Option<String>,
    #[serde(default = "empty_json")]
    pub config: Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGlobalPromoEventRequest {
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub starts_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub ends_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub recurrence_rule: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub config: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertGlobalPromoEntryRequest {
    pub service_id: i32,
    #[serde(default)]
    pub live_session_id: Option<Uuid>,
    #[serde(default)]
    pub discount_percentage: Option<f64>,
    #[serde(default)]
    pub promo_price_cfa: Option<f64>,
    #[serde(default)]
    pub stock_cap: Option<i32>,
    #[serde(default = "default_availability")]
    pub availability: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default = "empty_metadata")]
    pub metadata: Value,
    #[serde(default)]
    pub highlighted: Option<bool>,
    #[serde(default)]
    pub priority_score: Option<i32>,
    #[serde(default)]
    pub snapshot: Option<Value>,
}

fn default_availability() -> String {
    "online".to_string()
}

#[derive(Debug, Serialize, Clone)]
pub struct GlobalPromoEntry {
    pub id: Uuid,
    pub event_id: Uuid,
    pub service_id: i32,
    pub live_session_id: Option<Uuid>,
    pub submitted_by_user_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub discount_percentage: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub promo_price_cfa: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stock_cap: Option<i32>,
    pub availability: String,
    pub status: String,
    #[serde(default = "empty_metadata")]
    pub metadata: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub published_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GlobalPromoCatalogItem {
    pub event: GlobalPromoEvent,
    pub entry: GlobalPromoEntry,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product: Option<GlobalPromoProductSnapshot>,
    #[serde(default)]
    pub badges: GlobalPromoCatalogBadges,
}

#[derive(Debug, Serialize, Clone, Default)]
pub struct GlobalPromoCatalogBadges {
    pub event_is_live: bool,
    pub event_is_imminent: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GlobalPromoCatalogPage {
    pub items: Vec<GlobalPromoCatalogItem>,
    pub page: i64,
    pub page_size: i64,
    pub total: i64,
    pub has_more: bool,
}

#[derive(Debug, Deserialize, Hash, PartialEq, Eq)]
pub struct GlobalPromoCatalogQuery {
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub page_size: Option<i64>,
    #[serde(default)]
    pub highlighted_only: Option<bool>,
    #[serde(default)]
    pub event_slug: Option<String>,
    #[serde(default)]
    pub availability: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub sort: Option<String>,
    #[serde(default)]
    pub starts_within_minutes: Option<i64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GlobalPromoProductSnapshot {
    pub id: Uuid,
    pub promo_entry_id: Uuid,
    pub availability: String,
    #[serde(default = "empty_json")]
    pub snapshot: Value,
    pub priority_score: i32,
    pub highlighted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl<'r> FromRow<'r, PgRow> for GlobalPromoEntry {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        use bigdecimal::ToPrimitive;

        let discount = row
            .try_get::<Option<bigdecimal::BigDecimal>, _>("discount_percentage")?
            .and_then(|value| value.to_f64());
        let promo_price = row
            .try_get::<Option<bigdecimal::BigDecimal>, _>("promo_price_cfa")?
            .and_then(|value| value.to_f64());

        Ok(Self {
            id: row.try_get("id")?,
            event_id: row.try_get("event_id")?,
            service_id: row.try_get("service_id")?,
            live_session_id: row.try_get("live_session_id")?,
            submitted_by_user_id: row.try_get("submitted_by_user_id")?,
            discount_percentage: discount,
            promo_price_cfa: promo_price,
            stock_cap: row.try_get("stock_cap")?,
            availability: row.try_get("availability")?,
            status: row.try_get("status")?,
            metadata: row.try_get("metadata")?,
            published_at: row.try_get("published_at")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

#[derive(Debug, Deserialize)]
pub struct ReviewGlobalPromoEntryRequest {
    pub status: String,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub highlighted: Option<bool>,
    #[serde(default)]
    pub priority_score: Option<i32>,
    #[serde(default)]
    pub metadata_patch: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct BulkReviewGlobalPromoEntryRequest {
    pub entry_ids: Vec<Uuid>,
    pub status: String,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub highlighted: Option<bool>,
    #[serde(default)]
    pub priority_score: Option<i32>,
    #[serde(default)]
    pub metadata_patch: Option<Value>,
}
