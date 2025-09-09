use chrono::NaiveDateTime;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Alert {
    pub id: i32,
    pub user_id: i32, // prestataire
    pub service_id: i32,
    pub client_id: i32,
    pub alert_type: String, // "click", "message"
    pub is_read: bool,
    pub created_at: NaiveDateTime,
}
