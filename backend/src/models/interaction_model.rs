use chrono::NaiveDateTime;
use serde::{Serialize, Deserialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Interaction {
    pub id: i32,
    pub user_id: i32,
    pub service_id: i32,
    pub interaction_type: String, // "message", "audio", "call", "review", "note"
    pub content: Option<String>,  // texte, url audio, etc.
    pub created_at: NaiveDateTime,
}
