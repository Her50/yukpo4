use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LiveSession {
    pub id: Uuid,
    pub host_user_id: i32,
    pub service_id: Option<i32>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub start_at: DateTime<Utc>,
    pub end_at: Option<DateTime<Utc>>,
    pub livekit_room_name: Option<String>,
    pub livekit_participant_identity: Option<String>,
    pub livekit_ingress_id: Option<String>,
    pub livekit_ingress_url: Option<String>,
    pub stream_key: Option<String>,
    pub webrtc_url: Option<String>,
    pub hls_url: Option<String>,
    pub fallback_rtmp_url: Option<String>,
    pub fallback_hls_url: Option<String>,
    pub current_viewers: i32,
    pub peak_viewers: i32,
    pub total_watch_time_seconds: i64,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LiveReplay {
    pub id: Uuid,
    pub live_session_id: Uuid,
    pub replay_url: String,
    pub storage_provider: Option<String>,
    pub format: Option<String>,
    pub duration_seconds: Option<i32>,
    pub size_bytes: Option<i64>,
    pub available_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LiveSessionAnalytics {
    pub live_session_id: Uuid,
    pub total_viewers: i32,
    pub hls_viewers: i32,
    pub webrtc_viewers: i32,
    pub total_watch_time_seconds: i64,
    pub average_watch_time_seconds: Option<f64>,
    pub conversions: i32,
    pub revenue_cfa: Option<f64>,
    pub last_synced_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLiveSessionRequest {
    pub title: String,
    pub description: Option<String>,
    pub host_user_id: i32,
    pub service_id: Option<i32>,
    #[serde(default)]
    pub linked_service_ids: Vec<i32>,
    pub scheduled_start: DateTime<Utc>,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

#[derive(Debug, Serialize, Clone)]
pub struct LiveLinkedService {
    pub id: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_media: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub gallery: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LiveFlashSaleInput {
    pub service_id: i32,
    pub promo_price_cfa: f64,
    pub stock_target: i32,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    #[serde(default = "default_commentary_mode")]
    pub commentary_mode: String,
    #[serde(default = "default_commentary_interval")]
    pub commentary_interval_seconds: i32,
    #[serde(default)]
    pub ai_voice_profile: Option<String>,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct ConfigureFlashSalesRequest {
    #[serde(default)]
    pub items: Vec<LiveFlashSaleInput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LiveFlashSaleSummary {
    pub id: Uuid,
    pub live_session_id: Uuid,
    pub service_id: i32,
    pub promo_price_cfa: f64,
    pub stock_target: i32,
    pub reserved_quantity: i64,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    pub status: String,
    pub commentary_mode: String,
    pub commentary_interval_seconds: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_voice_profile: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_commentary_sent_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub metadata: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_service: Option<LiveLinkedService>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recent_commentaries: Vec<LiveFlashSaleCommentary>,
}

#[derive(Debug, Serialize, Clone)]
pub struct LiveFlashSaleReservationView {
    pub user_id: i32,
    pub quantity: i32,
    pub reserved_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_name: Option<String>,
}

#[derive(Debug, Serialize, Clone, FromRow)]
pub struct LiveFlashSaleCommentary {
    pub id: Uuid,
    pub flash_sale_id: Uuid,
    pub created_by: String,
    pub message: String,
    #[serde(default)]
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct LiveSessionResponse {
    pub session: LiveSession,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replay: Option<LiveReplay>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub analytics: Option<LiveSessionAnalytics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_services: Option<Vec<LiveLinkedService>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flash_sales: Option<Vec<LiveFlashSaleSummary>>,
}

#[derive(Debug, Serialize)]
pub struct LiveJoinInformation {
    pub session_id: Uuid,
    pub title: String,
    pub status: String,
    pub start_at: DateTime<Utc>,
    pub host_identity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webrtc_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webrtc_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hls_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallback_rtmp_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallback_hls_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_services: Option<Vec<LiveLinkedService>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flash_sales: Option<Vec<LiveFlashSaleSummary>>,
}

fn default_commentary_mode() -> String {
    "host".to_string()
}

fn default_commentary_interval() -> i32 {
    60
}

#[derive(Debug, Deserialize)]
pub struct SaveReplayRequest {
    pub replay_url: String,
    pub storage_provider: Option<String>,
    pub duration_seconds: Option<i32>,
    pub size_bytes: Option<i64>,
    pub format: Option<String>,
}
