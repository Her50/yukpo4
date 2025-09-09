use chrono::NaiveDateTime;
use serde::{Serialize, Deserialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ServiceReview {
    pub id: i32,
    pub user_id: i32,
    pub service_id: i32,
    pub rating: i32, // 1-5
    pub comment: Option<String>,
    pub created_at: NaiveDateTime,
}
