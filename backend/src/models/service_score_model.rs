use chrono::NaiveDateTime;
use serde::{Serialize, Deserialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ServiceScore {
    pub service_id: i32,
    pub score: f64,
    pub last_computed_at: NaiveDateTime,
}
