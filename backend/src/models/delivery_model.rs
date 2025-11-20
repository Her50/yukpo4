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

/// Statut métier utilisé pour tracer la file de matching
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "delivery_matching_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeliveryMatchingStatus {
    Queued,
    Searching,
    Assigned,
    Rejected,
    Failed,
    Timeout,
    Cancelled,
    Fallback,
    NoCourier,
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

/// ✅ Phase 9 - Amélioration : Raisons de refus d'un colis/produit par le client
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "parcel_rejection_reason", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ParcelRejectionReason {
    Damaged,              // Produit endommagé
    WrongItem,            // Mauvais produit
    Expired,              // Produit périmé
    WrongQuantity,        // Mauvaise quantité
    WrongSize,            // Mauvaise taille
    WrongColor,           // Mauvaise couleur
    QualityIssue,         // Problème de qualité
    NotOrdered,           // Non commandé
    Duplicate,            // Doublon
    Other,                // Autre raison
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preferred_courier_id: Option<Uuid>, // ✅ Phase 9 - Amélioration 28
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

/// Zone opérationnelle (polygone ou centre + rayon)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliveryZone {
    pub id: Uuid,
    pub slug: String,
    pub display_name: String,
    pub description: Option<String>,
    pub region: Option<serde_json::Value>,
    pub center: Option<serde_json::Value>,
    pub max_active_couriers: i32,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Attribution d'un coursier à une zone
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CourierZoneAssignment {
    pub id: i64,
    pub courier_id: Uuid,
    pub zone_id: Uuid,
    pub capacity_weight: i16,
    pub is_primary: bool,
    pub is_active: bool,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Instantané de disponibilité coursier
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CourierAvailabilitySnapshot {
    pub id: i64,
    pub courier_id: Uuid,
    pub zone_id: Option<Uuid>,
    pub captured_at: DateTime<Utc>,
    pub is_online: bool,
    pub active_deliveries: i16,
    pub max_capacity: i16,
    pub load_factor: BigDecimal,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub battery_level: Option<i16>,
    pub metadata: serde_json::Value,
}

/// Candidat retourné par le moteur de matching
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CourierMatchingCandidate {
    pub courier_id: Uuid,
    pub zone_id: Option<Uuid>,
    pub active_deliveries: i16,
    pub max_capacity: i16,
    pub load_factor: BigDecimal,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub captured_at: DateTime<Utc>,
    pub capacity_weight: i16,
    pub is_primary: bool,
    pub distance_meters: Option<f64>,
    pub metadata: serde_json::Value,
}

/// File d'attente interne de matching
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliveryMatchingQueueItem {
    pub id: i64,
    pub delivery_id: Uuid,
    pub zone_id: Option<Uuid>,
    pub status: DeliveryMatchingStatus,
    pub priority: i16,
    pub attempt_count: i32,
    pub payload: serde_json::Value,
    pub next_attempt_at: DateTime<Utc>,
    pub enqueued_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Événement audit du matching
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliveryMatchingEvent {
    pub id: i64,
    pub delivery_id: Uuid,
    pub courier_id: Option<Uuid>,
    pub status: DeliveryMatchingStatus,
    pub score: Option<BigDecimal>,
    pub reason: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
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
    Rejected,
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
    // ✅ Phase 9 - Amélioration : Raison de refus du produit
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejection_reason: Option<ParcelRejectionReason>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Configuration de livraison pour un produit
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProductDeliveryConfig {
    pub id: i32,
    pub service_id: i32,
    pub product_index: i32,
    
    // Pickup (obligatoire)
    pub pickup_address: String,
    pub pickup_latitude: f64,
    pub pickup_longitude: f64,
    
    // ✅ Phase 9 - Amélioration 32 : Référence vers un lieu de stock
    pub storage_location_id: Option<i32>,
    
    // Type véhicule (obligatoire)
    pub required_vehicle_type_id: i32,
    pub weight_kg: Option<f64>,
    pub volume_cm3: Option<f64>,
    pub requires_isothermal: bool,
    pub requires_fragile_handling: bool,
    
    // Plages horaires de récupération (obligatoire)
    pub pickup_availability_schedule: Value,
    
    // Informations additionnelles
    pub pickup_instructions: Option<String>,
    pub billing_mode: String,
    pub billing_partner_label: Option<String>,
    
    // Statut
    pub is_configured: bool,
    pub configured_at: Option<DateTime<Utc>>,
    pub configured_by: Option<i32>,
    
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Input pour créer/mettre à jour une configuration de livraison produit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductDeliveryConfigInput {
    pub service_id: i32,
    pub product_index: i32,
    
    // Pickup
    pub pickup_address: String,
    pub pickup_latitude: f64,
    pub pickup_longitude: f64,
    
    // ✅ Phase 9 - Amélioration 32 : Référence vers un lieu de stock
    pub storage_location_id: Option<i32>,
    
    // Type véhicule
    pub required_vehicle_type_id: i32,
    // ✅ NOUVEAU : Type de véhicule requis (aligné avec formulaire de commande)
    // 'bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking'
    pub required_vehicle_type: Option<String>,
    pub weight_kg: Option<f64>,
    pub volume_cm3: Option<f64>,
    pub requires_isothermal: Option<bool>,
    pub requires_fragile_handling: Option<bool>,
    
    // Plages horaires
    pub pickup_availability_schedule: Value,
    
    // Informations additionnelles
    pub pickup_instructions: Option<String>,
    pub billing_mode: Option<String>,
    pub billing_partner_label: Option<String>,
}

/// ✅ Phase 9 - Amélioration 32 : Lieu de stock d'un marchand
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MerchantStorageLocation {
    pub id: i32,
    pub merchant_user_id: i32,
    pub name: String,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    // ✅ Phase 9 - Amélioration : Zone géographique associée (optionnel)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zone_id: Option<Uuid>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// ✅ Phase 9 - Amélioration 32 : Input pour créer/modifier un lieu de stock
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerchantStorageLocationInput {
    pub name: String,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    // ✅ Phase 9 - Amélioration : Zone géographique associée (optionnel)
    pub zone_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

/// ✅ Phase 9 - Amélioration : Média de preuve de livraison (pickup ou delivery)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeliveryProofMedia {
    pub id: i32,
    pub delivery_id: Uuid,
    pub media_type: String, // 'image' ou 'video'
    pub media_url: String,
    pub proof_type: String, // 'pickup' ou 'delivery'
    pub uploaded_by: i32,
    pub uploaded_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// ✅ Phase 9 - Amélioration : Input pour uploader un média de preuve
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryProofMediaInput {
    pub media_type: String, // 'image' ou 'video'
    pub media_url: String,
    pub proof_type: String, // 'pickup' ou 'delivery'
    pub metadata: Option<serde_json::Value>,
}

/// ✅ Phase 3 - Amélioration 7 : Préférences de livraison du client
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ClientDeliveryPreferences {
    pub id: i32,
    pub user_id: i32,
    pub delivery_id: Option<Uuid>,
    
    // Préférences de livraison
    pub preferred_delivery_date: Option<chrono::NaiveDate>,
    pub preferred_delivery_time_start: Option<chrono::NaiveTime>,
    pub preferred_delivery_time_end: Option<chrono::NaiveTime>,
    pub preferred_delivery_window_hours: i32,
    
    // Contraintes
    pub avoid_days: Option<Vec<i32>>,  // Jours à éviter (1=Lundi, 7=Dimanche)
    pub urgency_level: String,  // 'standard', 'urgent', 'scheduled'
    
    // Flexibilité
    pub is_flexible: bool,
    pub flexibility_window_days: i32,
    
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Input pour créer/mettre à jour les préférences de livraison client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientDeliveryPreferencesInput {
    pub delivery_id: Option<Uuid>,
    pub preferred_delivery_date: Option<String>,  // Format: "YYYY-MM-DD"
    pub preferred_delivery_time_start: Option<String>,  // Format: "HH:MM"
    pub preferred_delivery_time_end: Option<String>,  // Format: "HH:MM"
    pub preferred_delivery_window_hours: Option<i32>,
    pub avoid_days: Option<Vec<i32>>,
    pub urgency_level: Option<String>,
    pub is_flexible: Option<bool>,
    pub flexibility_window_days: Option<i32>,
}

/// ✅ Phase 4 - Amélioration 8 : Prestataire externe (WhatsApp, Facebook, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ExternalDeliveryProvider {
    pub id: i32,
    pub provider_name: String,
    pub api_key: String,
    pub api_secret: String,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub webhook_url: Option<String>,
    pub allowed_ips: Option<Vec<String>>,
    pub rate_limit_per_hour: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub total_deliveries: i32,
    pub metadata: Value,
}

/// Input pour créer un prestataire externe
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalDeliveryProviderInput {
    pub provider_name: String,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub webhook_url: Option<String>,
    pub allowed_ips: Option<Vec<String>>,
    pub rate_limit_per_hour: Option<i32>,
}

/// Input pour requête de livraison externe
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalDeliveryRequest {
    pub api_key: String,
    pub service_name: String,
    pub pickup: crate::services::delivery_service::LocationInput,
    pub dropoff: crate::services::delivery_service::LocationInput,
    pub parcel: ExternalParcelInput,
    pub client_info: ExternalClientInfo,
    pub preferences: Option<ExternalDeliveryPreferences>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalParcelInput {
    pub vehicle_type: String,  // "moto", "tricycle", "fourgonnette", etc.
    pub weight_kg: Option<f64>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalClientInfo {
    pub name: String,
    pub phone: String,
    pub email: Option<String>,
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalDeliveryPreferences {
    pub preferred_delivery_date: Option<String>,
    pub preferred_delivery_time_start: Option<String>,
    pub preferred_delivery_time_end: Option<String>,
    pub urgency: Option<String>,
}
