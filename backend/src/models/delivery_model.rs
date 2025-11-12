use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{types::BigDecimal, FromRow};
use uuid::Uuid;

/// Statut d'une course de livraison
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "delivery_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeliveryStatus {
    Requested,
    AwaitingCourierConfirmation,
    Accepted,
    EnRoutePickup,
    ArrivalPickup,
    PickedUp,
    ShoppingInProgress,
    ShoppingCompleted,
    EnRouteDelivery,
    ArrivalDestination,
    Delivered,
    Completed,
    Cancelled,
}

/// Motif d'annulation d'une course
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "delivery_cancel_reason", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeliveryCancelReason {
    ClientCancelled,
    CourierCancelled,
    NoCourierAvailable,
    ParcelIssue,
    SystemFailure,
}

/// Type d'engin disponible pour un coursier
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "delivery_engine_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeliveryEngineType {
    Moto,
    Scooter,
    Voiture,
    Camionnette,
    VeloCargo,
    Pieton,
    CamionLeger,
    Autre,
}

/// Statut d'un coursier
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "delivery_courier_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeliveryCourierStatus {
    PendingReview,
    Approved,
    Rejected,
    Suspended,
}

/// Niveau de difficulte terrain
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "delivery_terrain_difficulty", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeliveryTerrainDifficulty {
    Smooth,
    Moderate,
    Rough,
    Blocked,
}

/// Statut d'une candidature de coursier
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "delivery_application_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeliveryApplicationStatus {
    Draft,
    Submitted,
    UnderReview,
    Approved,
    Rejected,
}

/// Typologie de colis disponible
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ParcelType {
    pub id: i32,
    pub slug: String,
    pub display_name: String,
    pub description: Option<String>,
    pub max_weight_kg: Option<BigDecimal>,
    pub max_volume_cm3: Option<BigDecimal>,
    pub requires_isothermal: bool,
    pub requires_fragile_handling: bool,
    pub requires_secure_box: bool,
    pub requires_document_protection: bool,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Representation d'une candidature coursier
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CourierApplication {
    pub id: Uuid,
    pub user_id: i32,
    pub status: DeliveryApplicationStatus,
    pub submitted_at: Option<DateTime<Utc>>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewer_id: Option<i32>,
    pub rejection_reason: Option<String>,
    pub profile_data: serde_json::Value,
    pub documents: serde_json::Value,
    pub notes: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Profil coursier
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Courier {
    pub id: Uuid,
    pub user_id: i32,
    pub application_id: Option<Uuid>,
    pub status: DeliveryCourierStatus,
    pub rating_average: BigDecimal,
    pub rating_count: i32,
    pub bio: Option<String>,
    pub hired_at: Option<DateTime<Utc>>,
    pub suspended_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Engin et equipements d'un coursier
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CourierAsset {
    pub id: Uuid,
    pub courier_id: Uuid,
    pub engine_type: DeliveryEngineType,
    pub is_primary: bool,
    pub max_weight_kg: Option<BigDecimal>,
    pub max_volume_cm3: Option<BigDecimal>,
    pub equipments: serde_json::Value,
    pub available: bool,
    pub availability_schedule: Option<serde_json::Value>,
    pub documents: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Informations colis liees a une course
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliveryParcel {
    pub id: Uuid,
    pub type_id: Option<i32>,
    pub weight_kg: Option<BigDecimal>,
    pub volume_cm3: Option<BigDecimal>,
    pub declared_value: Option<BigDecimal>,
    pub notes: Option<String>,
    pub photos: serde_json::Value,
    pub constraints: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Tarif calcule pour une course
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliveryPricing {
    pub id: Uuid,
    pub delivery_id: Uuid,
    pub base_price_cents: i32,
    pub distance_price_cents: i32,
    pub surcharge_cents: i32,
    pub discount_cents: i32,
    pub currency: String,
    pub calculated_at: DateTime<Utc>,
    pub details: serde_json::Value,
    pub shopping_cost_cents: i32,
    pub shopping_discount_cents: i32,
}

/// Evenement de statut dans la timeline
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliveryStatusEvent {
    pub id: i64,
    pub delivery_id: Uuid,
    pub status: DeliveryStatus,
    pub occurred_at: DateTime<Utc>,
    pub payload: serde_json::Value,
    pub recorded_by: Option<i32>,
}

/// Mise à jour de position fournie par le destinataire
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliveryRecipientUpdate {
    pub id: i64,
    pub delivery_id: Uuid,
    pub submitted_by: Option<i32>,
    pub latitude: f64,
    pub longitude: f64,
    pub address: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Point de tracking GPS
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliveryTrackingPoint {
    pub id: i64,
    pub delivery_id: Uuid,
    pub courier_id: Uuid,
    pub captured_at: DateTime<Utc>,
    pub speed_kmh: Option<BigDecimal>,
    pub bearing: Option<BigDecimal>,
    pub accuracy_meters: Option<BigDecimal>,
    pub latitude: f64,
    pub longitude: f64,
}

/// Note client -> coursier
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CourierRating {
    pub id: i64,
    pub delivery_id: Uuid,
    pub courier_id: Uuid,
    pub rater_id: i32,
    pub score_small: i32,
    pub tags: Option<Vec<String>>,
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Note coursier -> client
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ClientRating {
    pub id: i64,
    pub delivery_id: Uuid,
    pub client_id: i32,
    pub courier_id: Uuid,
    pub score_small: i32,
    pub tags: Option<Vec<String>>,
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Representation d'un point GPS simplifie
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoPoint {
    pub latitude: f64,
    pub longitude: f64,
}

/// Informations détaillées sur le destinataire (client final)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRecipient {
    pub user_id: Option<i32>,
    pub contact_name: Option<String>,
    pub contact_phone: Option<String>,
    pub notes: Option<String>,
    pub tracking_token: Uuid,
    pub dropoff_override: Option<GeoPoint>,
    pub dropoff_address: Option<String>,
    pub dropoff_updated_at: Option<DateTime<Utc>>,
    pub chat_thread_id: Option<Uuid>,
    pub country_code: Option<String>,
    pub allow_tracking: Option<bool>,
    pub allow_contact: Option<bool>,
    pub consent_granted: Option<bool>,
    pub preferred_language: Option<String>,
}

/// Resume d'une livraison pour l'affichage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySummary {
    pub id: Uuid,
    pub status: DeliveryStatus,
    pub creator_id: i32,
    pub courier_id: Option<Uuid>,
    pub pickup: GeoPoint,
    pub dropoff: GeoPoint,
    pub dropoff_address: Option<String>,
    pub distance_meters: Option<i32>,
    pub estimated_duration_seconds: Option<i32>,
    pub actual_duration_seconds: Option<i32>,
    pub requested_at: DateTime<Utc>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub tracking_token: Uuid,
    pub recipient: Option<DeliveryRecipient>,
    pub store_name: Option<String>,
    pub store_location: Option<GeoPoint>,
    pub shopping_required: bool,
    pub metadata: Value,
}

/// Statut commande supermarché
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "shopping_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ShoppingStatus {
    Pending,
    AwaitingPurchase,
    ShoppingInProgress,
    ShoppingCompleted,
    CheckoutSubmitted,
    Cancelled,
}

/// Statut item panier supermarché
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "shopping_item_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ShoppingItemStatus {
    Pending,
    Purchased,
    Missing,
    Replaced,
}

/// Commande supermarché associée à une livraison
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShoppingOrder {
    pub id: Uuid,
    pub delivery_id: Uuid,
    pub status: ShoppingStatus,
    pub estimated_total_cents: i32,
    pub actual_total_cents: Option<i32>,
    pub currency: String,
    pub store_name: Option<String>,
    pub store_location: Option<GeoPoint>,
    pub notes: Option<String>,
    pub requires_balance_top_up: bool,
    pub payload: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Item d'une commande supermarché
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShoppingOrderItem {
    pub id: Uuid,
    pub shopping_order_id: Uuid,
    pub product_id: Option<Uuid>,
    pub product_name: String,
    pub characteristics: serde_json::Value,
    pub quantity: BigDecimal,
    pub unit: String,
    pub estimated_price_cents: i32,
    pub actual_price_cents: Option<i32>,
    pub status: ShoppingItemStatus,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
