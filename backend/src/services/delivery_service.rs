use crate::{
    core::types::{AppError, AppResult},
    models::delivery_model::{
        Courier, CourierApplication, CourierAsset, CourierMatchingCandidate, DeliveryCancelReason,
        DeliveryMatchingStatus, DeliveryPricing, DeliveryRecipient, DeliveryRecipientUpdate,
        DeliveryStatus, DeliveryStatusEvent, DeliverySummary, GeoPoint, ParcelType,
        ShoppingItemStatus, ShoppingOrder, ShoppingOrderItem, ShoppingStatus,
    },
    services::{
        delivery_repository::{
            DeliveryRepository, DeliveryTimestampField, NewClientRating, NewCourierApplication,
            NewCourierAsset, NewCourierProfile, NewCourierRating, NewDeliveryMatchingEvent,
            NewDeliveryMatchingQueueItem, NewDeliveryPricing, NewDeliveryRecipient,
            NewDeliveryRequest, NewShoppingOrder, NewShoppingOrderItem, NewStatusEvent,
            NewTrackingPoint, ShoppingEstimateItem, ShoppingEstimateResult, WalletEventDirection,
        },
        phone_validation_service::{PhoneValidationRequest, PhoneValidationService},
        push_notification_service,
    },
    websocket::delivery_tracking::{DeliveryTrackingManager, DeliveryWsEvent},
};
use bigdecimal::BigDecimal;
use chrono::{DateTime, Duration, Utc};
use rust_decimal::{
    prelude::{FromPrimitive, ToPrimitive},
    Decimal,
};
use serde::Serialize;
use serde_json::{json, Value};
use std::str::FromStr;
use std::sync::{
    atomic::{AtomicI64, AtomicU64, Ordering},
    Arc,
};
use std::{cmp::Ordering as CmpOrdering, env};
use uuid::Uuid;

/// ✅ RECOMMANDATION 2: Calculer la distance entre deux points GPS (formule de Haversine)
fn haversine_distance(pos1: (f64, f64), pos2: (f64, f64)) -> f64 {
    const EARTH_RADIUS_KM: f64 = 6371.0;
    let (lat1, lon1) = (pos1.0.to_radians(), pos1.1.to_radians());
    let (lat2, lon2) = (pos2.0.to_radians(), pos2.1.to_radians());

    let dlat = lat2 - lat1;
    let dlon = lon2 - lon1;

    let a = (dlat / 2.0).sin().powi(2)
        + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();

    EARTH_RADIUS_KM * c * 1000.0 // Retourne en mètres
}

// Extension trait pour to_radians si nécessaire
trait ToRadians {
    fn to_radians(self) -> f64;
}

impl ToRadians for f64 {
    fn to_radians(self) -> f64 {
        self * std::f64::consts::PI / 180.0
    }
}

/// Paramètres pour créer une demande de livraison
#[derive(Debug, Clone)]
pub struct CreateDeliveryParams {
    pub creator_id: i32,
    pub parcel: NewDeliveryParcelInput,
    pub pickup: LocationInput,
    pub dropoff: LocationInput,
    pub recipient: Option<DeliveryRecipientInput>,
    pub distance_meters: Option<i32>,
    pub estimated_duration_seconds: Option<i32>,
    pub metadata: Value,
    pub initial_event_payload: Value,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDeliverySummary {
    pub id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order_id: Option<Uuid>,
    pub kind: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eta_iso: Option<String>,
    pub checkpoints: Vec<FrontendDeliveryCheckpoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pricing: Option<FrontendDeliveryPricing>,
    pub pickup: FrontendDeliveryLocation,
    pub dropoff: FrontendDeliveryLocation,
    pub client_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub courier: Option<FrontendDeliveryParticipant>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient: Option<FrontendDeliveryParticipant>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shopping: Option<FrontendShoppingSummary>,
    pub metadata: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_event_at: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDeliveryLocation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<FrontendLocationPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instructions: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendLocationPoint {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDeliveryParticipant {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rating: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vehicle_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eta_minutes: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_online: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_tracking: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_contact: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub consent_granted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preferred_language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_location: Option<FrontendLocationPoint>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDeliveryCheckpoint {
    pub status: String,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<FrontendCheckpointLocation>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendCheckpointLocation {
    pub lat: f64,
    pub lng: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accuracy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub heading: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDeliveryPricing {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated: Option<f64>,
    pub currency: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_fee: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub distance_fee: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shopping_advance: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_fee: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tax: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tips: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub final_total: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refund_total: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendShoppingSummary {
    pub items: Vec<FrontendShoppingItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimate: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub budget_check: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendShoppingItem {
    pub id: String,
    pub label: String,
    pub quantity: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_total: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_total: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_substitution: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendRecipientUpdate {
    pub latitude: f64,
    pub longitude: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    pub timestamp_iso: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct DropoffShareInfo {
    pub delivery_id: Uuid,
    pub tracking_token: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub share_url: Option<String>,
    pub dropoff_pending: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct PublicDropoffSnapshot {
    pub delivery_id: Uuid,
    pub pickup: FrontendDeliveryLocation,
    pub dropoff: FrontendDeliveryLocation,
    pub dropoff_pending: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_pickup_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vehicle_type_id: Option<i64>,
}

impl From<DeliveryRecipientUpdate> for FrontendRecipientUpdate {
    fn from(value: DeliveryRecipientUpdate) -> Self {
        Self {
            latitude: value.latitude,
            longitude: value.longitude,
            address: value.address,
            timestamp_iso: value.created_at.to_rfc3339(),
        }
    }
}

impl FrontendShoppingSummary {
    fn from_order(order: ShoppingOrder, items: Vec<ShoppingOrderItem>) -> Self {
        let mapped_items = items
            .into_iter()
            .map(|item| {
                let metadata = item.metadata;
                FrontendShoppingItem {
                    id: item.id.to_string(),
                    label: item.product_name,
                    quantity: item.quantity.to_f64().unwrap_or_default(),
                    unit: Some(item.unit),
                    estimated_price: Some(cents_to_units(item.estimated_price_cents)),
                    estimated_total: Some(cents_to_units(item.estimated_price_cents)),
                    actual_price: item.actual_price_cents.map(|value| cents_to_units(value)),
                    actual_total: item.actual_price_cents.map(|value| cents_to_units(value)),
                    note: extract_string(&metadata, "note"),
                    is_substitution: metadata.get("is_substitution").and_then(|v| v.as_bool()),
                    image_url: metadata
                        .get("image_url")
                        .and_then(|v| v.as_str())
                        .map(ToString::to_string),
                }
            })
            .collect::<Vec<_>>();

        Self {
            items: mapped_items,
            estimate: None,
            budget_check: None,
            comment: order.notes,
        }
    }
}

impl From<DeliveryPricing> for FrontendDeliveryPricing {
    fn from(value: DeliveryPricing) -> Self {
        let estimated = value.base_price_cents + value.distance_price_cents + value.surcharge_cents
            - value.discount_cents
            + value.shopping_cost_cents
            - value.shopping_discount_cents;

        Self {
            estimated: Some(cents_to_units(estimated)),
            currency: value.currency.clone(),
            base_fee: Some(cents_to_units(value.base_price_cents)),
            distance_fee: Some(cents_to_units(value.distance_price_cents)),
            shopping_advance: Some(cents_to_units(value.shopping_cost_cents)),
            service_fee: extract_amount(&value.details, "service_fee_cents"),
            tax: extract_amount(&value.details, "tax_cents"),
            tips: extract_amount(&value.details, "tips_cents"),
            final_total: value
                .details
                .get("final_total_cents")
                .and_then(|v| v.as_i64())
                .map(cents_to_units),
            refund_total: value
                .details
                .get("refund_cents")
                .and_then(|v| v.as_i64())
                .map(cents_to_units),
        }
    }
}

fn cents_to_units<T>(value: T) -> f64
where
    T: Into<i64>,
{
    let cents: i64 = value.into();
    (cents as f64) / 100.0
}

fn extract_amount(details: &Value, key: &str) -> Option<f64> {
    details
        .get(key)
        .and_then(|v| v.as_i64())
        .map(cents_to_units)
}

fn extract_string(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|v| v.as_str())
        .map(ToString::to_string)
}

fn build_pickup_location(
    summary: &DeliverySummary,
    shopping_order: Option<&ShoppingOrder>,
) -> FrontendDeliveryLocation {
    let label = summary
        .store_name
        .clone()
        .or_else(|| shopping_order.and_then(|order| order.store_name.clone()))
        .or_else(|| {
            summary
                .metadata
                .get("shopping")
                .and_then(|meta| meta.get("store_name"))
                .and_then(|s| s.as_str())
                .map(ToString::to_string)
        });

    let instructions = summary
        .metadata
        .get("shopping")
        .and_then(|meta| meta.get("instructions"))
        .and_then(|s| s.as_str())
        .map(ToString::to_string);

    let location_point = summary
        .store_location
        .clone()
        .unwrap_or(summary.pickup.clone());

    FrontendDeliveryLocation {
        label: Some(label.unwrap_or_else(|| "Point de retrait".to_string())),
        address: summary
            .metadata
            .get("shopping")
            .and_then(|meta| meta.get("store_address"))
            .and_then(|s| s.as_str())
            .map(ToString::to_string),
        location: Some(FrontendLocationPoint {
            lat: location_point.latitude,
            lng: location_point.longitude,
        }),
        instructions,
    }
}

fn build_dropoff_location(summary: &DeliverySummary) -> FrontendDeliveryLocation {
    let (lat, lng) = summary
        .recipient
        .as_ref()
        .and_then(|recipient| recipient.dropoff_override.clone())
        .map(|point| (point.latitude, point.longitude))
        .unwrap_or((summary.dropoff.latitude, summary.dropoff.longitude));

    FrontendDeliveryLocation {
        label: summary
            .recipient
            .as_ref()
            .and_then(|recipient| recipient.contact_name.clone()),
        address: summary
            .recipient
            .as_ref()
            .and_then(|recipient| recipient.dropoff_address.clone())
            .or_else(|| summary.dropoff_address.clone()),
        location: Some(FrontendLocationPoint { lat, lng }),
        instructions: summary
            .recipient
            .as_ref()
            .and_then(|recipient| recipient.notes.clone()),
    }
}

fn build_frontend_checkpoints(
    summary: &DeliverySummary,
    events: &[DeliveryStatusEvent],
) -> Vec<FrontendDeliveryCheckpoint> {
    let mut checkpoints: Vec<FrontendDeliveryCheckpoint> = events
        .iter()
        .map(|event| FrontendDeliveryCheckpoint {
            status: map_delivery_status(event.status).to_string(),
            timestamp: event.occurred_at.to_rfc3339(),
            note: event
                .payload
                .get("note")
                .and_then(|v| v.as_str())
                .map(ToString::to_string),
            actor: event
                .payload
                .get("actor")
                .and_then(|v| v.as_str())
                .and_then(map_checkpoint_actor),
            location: build_checkpoint_location(&event.payload),
        })
        .collect();

    if checkpoints.is_empty() {
        checkpoints.push(FrontendDeliveryCheckpoint {
            status: "pending".to_string(),
            timestamp: summary.requested_at.to_rfc3339(),
            note: None,
            actor: Some("system".to_string()),
            location: None,
        });
    }

    if checkpoints.last().map(|last| last.status.as_str())
        != Some(map_delivery_status(summary.status))
    {
        checkpoints.push(FrontendDeliveryCheckpoint {
            status: map_delivery_status(summary.status).to_string(),
            timestamp: summary
                .delivered_at
                .unwrap_or(summary.requested_at)
                .to_rfc3339(),
            note: None,
            actor: Some("system".to_string()),
            location: None,
        });
    }

    checkpoints
}

fn build_checkpoint_location(payload: &Value) -> Option<FrontendCheckpointLocation> {
    let location = payload.get("location")?;
    let lat = location.get("latitude")?.as_f64()?;
    let lng = location.get("longitude")?.as_f64()?;

    Some(FrontendCheckpointLocation {
        lat,
        lng,
        accuracy: location.get("accuracy").and_then(|v| v.as_f64()),
        heading: location.get("heading").and_then(|v| v.as_f64()),
        speed: location.get("speed").and_then(|v| v.as_f64()),
        source: location
            .get("source")
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
    })
}

fn map_checkpoint_actor(actor: &str) -> Option<String> {
    match actor {
        "client" | "courier" | "recipient" | "system" => Some(actor.to_string()),
        _ => None,
    }
}

fn map_delivery_status(status: DeliveryStatus) -> &'static str {
    match status {
        DeliveryStatus::Requested => "pending",
        DeliveryStatus::AwaitingCourierConfirmation => "awaiting_courier",
        DeliveryStatus::Accepted => "assigned",
        DeliveryStatus::EnRoutePickup => "en_route_pickup",
        DeliveryStatus::ArrivalPickup => "shopping_pending",
        DeliveryStatus::PickedUp => "en_route_delivery",
        DeliveryStatus::ShoppingInProgress => "shopping_in_progress",
        DeliveryStatus::ShoppingCompleted => "shopping_completed",
        DeliveryStatus::EnRouteDelivery => "en_route_delivery",
        DeliveryStatus::ArrivalDestination => "en_route_delivery",
        DeliveryStatus::Delivered => "delivered",
        DeliveryStatus::Completed => "delivered",
        DeliveryStatus::Cancelled => "cancelled",
    }
}

fn compute_eta_iso(summary: &DeliverySummary) -> Option<String> {
    summary
        .estimated_duration_seconds
        .map(|seconds| summary.requested_at + Duration::seconds(seconds.into()))
        .map(|eta| eta.to_rfc3339())
}

fn decimal_to_bigdecimal(value: Decimal) -> BigDecimal {
    BigDecimal::from_str(&value.to_string()).unwrap_or_else(|_| BigDecimal::from(0))
}

fn decimal_opt_to_bigdecimal(value: Option<Decimal>) -> Option<BigDecimal> {
    value.map(decimal_to_bigdecimal)
}

/// Payload colis (coté service)
#[derive(Debug, Clone)]
pub struct NewDeliveryParcelInput {
    pub type_id: Option<i32>,
    pub weight_kg: Option<Decimal>,
    pub volume_cm3: Option<Decimal>,
    pub declared_value: Option<Decimal>,
    pub notes: Option<String>,
    pub photos: Value,
    pub constraints: Value,
}

/// Localisation simple
#[derive(Debug, Clone)]
pub struct LocationInput {
    pub latitude: f64,
    pub longitude: f64,
    pub address: Option<String>,
}

/// Informations fournies pour identifier le destinataire du colis
#[derive(Debug, Clone)]
pub struct DeliveryRecipientInput {
    pub user_id: Option<i32>,
    pub contact_name: Option<String>,
    pub contact_phone: Option<String>,
    pub notes: Option<String>,
    pub chat_thread_id: Option<Uuid>,
    pub dropoff_override: Option<LocationInput>,
    pub dropoff_address: Option<String>,
    pub country_code: Option<String>,
    pub allow_tracking: Option<bool>,
    pub allow_contact: Option<bool>,
    pub consent_granted: Option<bool>,
    pub preferred_language: Option<String>,
}

/// Informations pour enregistrer un tracking
#[derive(Debug, Clone)]
pub struct TrackingInput {
    pub delivery_id: Uuid,
    pub courier_id: Uuid,
    pub latitude: f64,
    pub longitude: f64,
    pub captured_at: DateTime<Utc>,
    pub speed_kmh: Option<Decimal>,
    pub bearing: Option<Decimal>,
    pub accuracy_meters: Option<Decimal>,
}

/// Paramètres de pricing
#[derive(Debug, Clone)]
pub struct PricingInput {
    pub delivery_id: Uuid,
    pub base_price_cents: i32,
    pub distance_price_cents: i32,
    pub surcharge_cents: i32,
    pub discount_cents: i32,
    pub currency: String,
    pub details: Value,
    pub shopping_cost_cents: i32,
    pub shopping_discount_cents: i32,
}

#[derive(Debug, Clone)]
pub struct ShoppingBasketItemInput {
    pub product_id: Option<Uuid>,
    pub product_name: String,
    pub characteristics: Value,
    pub quantity: f64,
    pub unit: String,
    pub estimated_price_cents: Option<i32>,
}

#[derive(Debug, Clone)]
pub struct ShoppingEstimateInput {
    pub items: Vec<ShoppingBasketItemInput>,
    pub currency: String,
}

#[derive(Debug, Clone)]
pub struct ShoppingStoreInput {
    pub name: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub address: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CreateShoppingOrderParams {
    pub creator_id: i32,
    pub items: Vec<ShoppingBasketItemInput>,
    pub store: ShoppingStoreInput,
    pub dropoff: LocationInput,
    pub recipient: Option<DeliveryRecipientInput>,
    pub estimated_total_cents: i32,
    pub currency: String,
    pub delivery_base_price_cents: i32,
    pub delivery_distance_price_cents: i32,
    pub delivery_surcharge_cents: i32,
    pub delivery_discount_cents: i32,
    pub delivery_details: Value,
    pub distance_meters: Option<i32>,
    pub estimated_duration_seconds: Option<i32>,
    pub notes: Option<String>,
    pub metadata: Value,
}

#[derive(Debug, Clone)]
pub struct ShoppingItemUpdateInput {
    pub order_id: Uuid,
    pub item_id: Uuid,
    pub status: ShoppingItemStatus,
    pub actual_price_cents: Option<i32>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct ShoppingStatusUpdateInput {
    pub order_id: Uuid,
    pub status: ShoppingStatus,
}

#[derive(Debug, Clone)]
pub struct ShoppingCheckoutInput {
    pub order_id: Uuid,
    pub actual_total_cents: i32,
    pub payload: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct CreateShoppingOrderResult {
    pub delivery: DeliverySummary,
    pub shopping_order: ShoppingOrder,
    pub items: Vec<ShoppingOrderItem>,
    pub estimated_total_cents: i32,
    pub margin_cents: i32,
    pub balance_remaining: i64,
}

impl ShoppingStoreInput {
    pub fn to_location_input(&self) -> LocationInput {
        LocationInput {
            latitude: self.latitude,
            longitude: self.longitude,
            address: self.address.clone(),
        }
    }

    pub fn to_geo_point(&self) -> GeoPoint {
        GeoPoint {
            latitude: self.latitude,
            longitude: self.longitude,
        }
    }
}

const SHOPPING_MARGIN_RATE: f64 = 0.15;
const MATCHING_MAX_DISTANCE_METERS: f64 = 8_000.0;
const MATCHING_SEARCH_RETRY_MINUTES: i64 = 2;
const MATCHING_DEFAULT_PRIORITY: i16 = 100;

fn compute_margin_cents(total_cents: i32) -> i32 {
    ((total_cents as f64) * SHOPPING_MARGIN_RATE).ceil() as i32
}

fn merge_json(base: Value, overlay: Value) -> Value {
    match (base, overlay) {
        (Value::Object(mut base_map), Value::Object(overlay_map)) => {
            for (key, value) in overlay_map {
                let merged = match base_map.remove(&key) {
                    Some(existing) => merge_json(existing, value),
                    None => value,
                };
                base_map.insert(key, merged);
            }
            Value::Object(base_map)
        }
        (_, overlay) => overlay,
    }
}

/// Paramètres candidatures coursier
#[derive(Debug, Clone)]
pub struct CourierApplicationInput {
    pub user_id: i32,
    pub profile_data: Value,
    pub documents: Value,
    pub submitted: bool,
}

/// Paramètres profil coursier validé
#[derive(Debug, Clone)]
pub struct CourierProfileInput {
    pub user_id: i32,
    pub application_id: Option<Uuid>,
    pub bio: Option<String>,
}

/// Paramètres engin/equipment
#[derive(Debug, Clone)]
pub struct CourierAssetInput {
    pub courier_id: Uuid,
    pub engine_type: crate::models::delivery_model::DeliveryEngineType,
    pub max_weight_kg: Option<Decimal>,
    pub max_volume_cm3: Option<Decimal>,
    pub equipments: Value,
    pub available: bool,
    pub availability_schedule: Option<Value>,
    pub documents: Option<Value>,
}

#[derive(Clone)]
pub struct DeliveryService {
    repository: Arc<DeliveryRepository>,
    tracking_manager: Arc<DeliveryTrackingManager>,
}

static RECIPIENT_DROPOFF_EVENTS: AtomicU64 = AtomicU64::new(0);
static WALLET_DEBIT_EVENTS: AtomicU64 = AtomicU64::new(0);
static WALLET_REFUND_EVENTS: AtomicU64 = AtomicU64::new(0);
static TOTAL_WALLET_DEBIT_CENTS: AtomicI64 = AtomicI64::new(0);
static TOTAL_WALLET_REFUND_CENTS: AtomicI64 = AtomicI64::new(0);

// Métriques matching (worker + auto-matching).
static DELIVERY_MATCHING_STARTED_TOTAL: AtomicU64 = AtomicU64::new(0);
static DELIVERY_MATCHING_SUCCESS_TOTAL: AtomicU64 = AtomicU64::new(0);
static DELIVERY_MATCHING_FAILED_TOTAL: AtomicU64 = AtomicU64::new(0);
static DELIVERY_MATCHING_LATENCY_TOTAL_MS: AtomicI64 = AtomicI64::new(0);
static DELIVERY_MATCHING_LATENCY_COUNT: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, Default)]
pub struct DeliveryMetricsSnapshot {
    pub recipient_dropoff_events: u64,
    pub wallet_debit_events: u64,
    pub wallet_refund_events: u64,
    pub total_wallet_debit_cents: i64,
    pub total_wallet_refund_cents: i64,
    pub matching_started_total: u64,
    pub matching_success_total: u64,
    pub matching_failed_total: u64,
    pub matching_latency_total_ms: i64,
    pub matching_latency_count: u64,
}

fn record_recipient_dropoff_metric() {
    RECIPIENT_DROPOFF_EVENTS.fetch_add(1, Ordering::Relaxed);
}

fn record_wallet_debit_metric(amount_cents: i64) {
    WALLET_DEBIT_EVENTS.fetch_add(1, Ordering::Relaxed);
    TOTAL_WALLET_DEBIT_CENTS.fetch_add(amount_cents, Ordering::Relaxed);
}

fn record_wallet_refund_metric(amount_cents: i64) {
    WALLET_REFUND_EVENTS.fetch_add(1, Ordering::Relaxed);
    TOTAL_WALLET_REFUND_CENTS.fetch_add(amount_cents, Ordering::Relaxed);
}

pub fn get_delivery_metrics_snapshot() -> DeliveryMetricsSnapshot {
    DeliveryMetricsSnapshot {
        recipient_dropoff_events: RECIPIENT_DROPOFF_EVENTS.load(Ordering::Relaxed),
        wallet_debit_events: WALLET_DEBIT_EVENTS.load(Ordering::Relaxed),
        wallet_refund_events: WALLET_REFUND_EVENTS.load(Ordering::Relaxed),
        total_wallet_debit_cents: TOTAL_WALLET_DEBIT_CENTS.load(Ordering::Relaxed),
        total_wallet_refund_cents: TOTAL_WALLET_REFUND_CENTS.load(Ordering::Relaxed),
        matching_started_total: DELIVERY_MATCHING_STARTED_TOTAL.load(Ordering::Relaxed),
        matching_success_total: DELIVERY_MATCHING_SUCCESS_TOTAL.load(Ordering::Relaxed),
        matching_failed_total: DELIVERY_MATCHING_FAILED_TOTAL.load(Ordering::Relaxed),
        matching_latency_total_ms: DELIVERY_MATCHING_LATENCY_TOTAL_MS.load(Ordering::Relaxed),
        matching_latency_count: DELIVERY_MATCHING_LATENCY_COUNT.load(Ordering::Relaxed),
    }
}

#[cfg(test)]
pub(crate) fn reset_delivery_metrics_for_tests() {
    RECIPIENT_DROPOFF_EVENTS.store(0, Ordering::Relaxed);
    WALLET_DEBIT_EVENTS.store(0, Ordering::Relaxed);
    WALLET_REFUND_EVENTS.store(0, Ordering::Relaxed);
    TOTAL_WALLET_DEBIT_CENTS.store(0, Ordering::Relaxed);
    TOTAL_WALLET_REFUND_CENTS.store(0, Ordering::Relaxed);
}

impl DeliveryService {
    pub fn new(
        repository: Arc<DeliveryRepository>,
        tracking_manager: Arc<DeliveryTrackingManager>,
    ) -> Self {
        Self {
            repository,
            tracking_manager,
        }
    }

    pub fn repository(&self) -> &DeliveryRepository {
        &self.repository
    }

    pub async fn get_wallet_balance(&self, user_id: i32) -> AppResult<i64> {
        self.repository.get_user_balance(user_id).await
    }

    pub async fn debit_wallet_for_delivery(
        &self,
        user_id: i32,
        delivery_id: Uuid,
        amount_cents: i64,
        reason: Option<String>,
    ) -> AppResult<i64> {
        if amount_cents <= 0 {
            return Err(AppError::BadRequest(
                "Le montant à débiter doit être positif.".into(),
            ));
        }

        let summary = self.get_delivery_summary(delivery_id).await?;
        if summary.creator_id != user_id {
            return Err(AppError::Forbidden(
                "Seul le créateur de la livraison peut débiter son portefeuille.".into(),
            ));
        }

        let merchant_inclusive = summary
            .metadata
            .get("billing_mode")
            .and_then(|v| v.as_str())
            .map(|mode| mode.eq_ignore_ascii_case("merchant_inclusive"))
            .or_else(|| {
                summary
                    .metadata
                    .get("billing_inclusive")
                    .and_then(|v| v.as_bool())
            })
            .unwrap_or(false);

        if merchant_inclusive {
            return Err(AppError::BadRequest(
                "Cette livraison est facturée au marchand (billing_mode=merchant_inclusive). Aucun débit client requis."
                    .into(),
            ));
        }

        let balance = self
            .repository
            .apply_wallet_mutation(
                user_id,
                delivery_id,
                amount_cents,
                WalletEventDirection::Debit,
                reason.clone(),
                None,
            )
            .await?;

        log::info!(
            "[DeliveryWallet] Débit {}¢ sur livraison {} (raison: {:?})",
            amount_cents,
            delivery_id,
            reason
        );

        self.tracking_manager
            .broadcast_event(
                delivery_id,
                DeliveryWsEvent::WalletUpdate {
                    balance_cents: balance,
                    reason: reason.clone(),
                },
            )
            .await;
        record_wallet_debit_metric(amount_cents);
        log::info!(
            "[DeliveryService] Wallet debit effectué (delivery {}, user {}, amount_cents {}, balance {}, reason {:?})",
            delivery_id,
            user_id,
            amount_cents,
            balance,
            reason
        );

        Ok(balance)
    }

    pub async fn refund_wallet_for_delivery(
        &self,
        user_id: i32,
        delivery_id: Uuid,
        amount_cents: i64,
        reason: Option<String>,
    ) -> AppResult<i64> {
        if amount_cents <= 0 {
            return Err(AppError::BadRequest(
                "Le montant du remboursement doit être positif.".into(),
            ));
        }

        let summary = self.get_delivery_summary(delivery_id).await?;
        if summary.creator_id != user_id {
            return Err(AppError::Forbidden(
                "Seul le créateur de la livraison peut recevoir un remboursement.".into(),
            ));
        }

        let balance = self
            .repository
            .apply_wallet_mutation(
                user_id,
                delivery_id,
                amount_cents,
                WalletEventDirection::Refund,
                reason.clone(),
                None,
            )
            .await?;

        log::info!(
            "[DeliveryWallet] Remboursement {}¢ sur livraison {} (raison: {:?})",
            amount_cents,
            delivery_id,
            reason
        );

        self.tracking_manager
            .broadcast_event(
                delivery_id,
                DeliveryWsEvent::WalletUpdate {
                    balance_cents: balance,
                    reason: reason.clone(),
                },
            )
            .await;
        record_wallet_refund_metric(amount_cents);
        log::info!(
            "[DeliveryService] Wallet refund effectué (delivery {}, user {}, amount_cents {}, balance {}, reason {:?})",
            delivery_id,
            user_id,
            amount_cents,
            balance,
            reason
        );

        Ok(balance)
    }

    /// Liste les livraisons actives pour un utilisateur (vue frontend)
    pub async fn list_user_active_deliveries_frontend(
        &self,
        user_id: i32,
    ) -> AppResult<Vec<FrontendDeliverySummary>> {
        let delivery_ids = self
            .repository
            .list_delivery_ids_for_user(user_id, 25)
            .await?;

        let mut output = Vec::with_capacity(delivery_ids.len());
        for delivery_id in delivery_ids {
            let summary = self
                .repository
                .get_delivery_summary(delivery_id)
                .await?
                .ok_or_else(|| AppError::NotFound("Livraison introuvable".into()))?;
            self.ensure_delivery_access(&summary, user_id).await?;
            output.push(self.compose_frontend_summary(summary).await?);
        }

        Ok(output)
    }

    /// Récupère une livraison détaillée pour la vue frontend
    pub async fn get_frontend_delivery_summary(
        &self,
        delivery_id: Uuid,
        user_id: i32,
    ) -> AppResult<FrontendDeliverySummary> {
        let summary = self
            .repository
            .get_delivery_summary(delivery_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Livraison introuvable".into()))?;

        self.ensure_delivery_access(&summary, user_id).await?;

        self.compose_frontend_summary(summary).await
    }

    /// Historique des positions partagées par le destinataire (front)
    pub async fn list_frontend_recipient_updates(
        &self,
        delivery_id: Uuid,
        user_id: i32,
        limit: i64,
    ) -> AppResult<Vec<FrontendRecipientUpdate>> {
        let summary = self
            .repository
            .get_delivery_summary(delivery_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Livraison introuvable".into()))?;
        self.ensure_delivery_access(&summary, user_id).await?;

        let updates = self
            .repository
            .list_recipient_updates(delivery_id, limit.max(1))
            .await?;

        Ok(updates
            .into_iter()
            .map(FrontendRecipientUpdate::from)
            .collect())
    }

    /// Liste les types de colis disponibles
    pub async fn list_parcel_types(&self) -> AppResult<Vec<ParcelType>> {
        self.repository.list_parcel_types().await
    }

    /// Crée ou met à jour une candidature coursier
    pub async fn submit_courier_application(
        &self,
        input: CourierApplicationInput,
    ) -> AppResult<CourierApplication> {
        let existing = self
            .repository
            .find_courier_application_by_user(input.user_id)
            .await?;

        if let Some(app) = existing {
            if app.status == crate::models::delivery_model::DeliveryApplicationStatus::Approved {
                return Err(AppError::Conflict(
                    "Un profil coursier est déjà approuvé pour cet utilisateur".into(),
                ));
            }

            let status = if input.submitted {
                crate::models::delivery_model::DeliveryApplicationStatus::Submitted
            } else {
                crate::models::delivery_model::DeliveryApplicationStatus::Draft
            };

            let updated = self
                .repository
                .update_courier_application_status(app.id, status, None, None)
                .await?;

            return Ok(updated);
        }

        let status = if input.submitted {
            crate::models::delivery_model::DeliveryApplicationStatus::Submitted
        } else {
            crate::models::delivery_model::DeliveryApplicationStatus::Draft
        };

        let new_app = self
            .repository
            .create_courier_application(NewCourierApplication {
                user_id: input.user_id,
                status,
                submitted_at: if input.submitted {
                    Some(Utc::now())
                } else {
                    None
                },
                profile_data: input.profile_data,
                documents: input.documents,
                notes: None,
            })
            .await?;

        Ok(new_app)
    }

    /// Valide une candidature (backoffice)
    pub async fn approve_courier_application(
        &self,
        application_id: Uuid,
        reviewer_id: i32,
        approve: bool,
        rejection_reason: Option<String>,
        profile_input: CourierProfileInput,
        asset_input: Option<CourierAssetInput>,
    ) -> AppResult<(CourierApplication, Courier, Option<CourierAsset>)> {
        let status = if approve {
            crate::models::delivery_model::DeliveryApplicationStatus::Approved
        } else {
            crate::models::delivery_model::DeliveryApplicationStatus::Rejected
        };

        let updated_app = self
            .repository
            .update_courier_application_status(
                application_id,
                status,
                Some(reviewer_id),
                rejection_reason.clone(),
            )
            .await?;

        if !approve {
            return Ok((updated_app, build_rejected_courier(), None));
        }

        let courier = self
            .repository
            .create_courier_profile(NewCourierProfile {
                user_id: profile_input.user_id,
                application_id: profile_input.application_id,
                bio: profile_input.bio,
            })
            .await?;

        let asset = if let Some(asset_input) = asset_input {
            let inserted = self
                .repository
                .upsert_courier_asset(NewCourierAsset {
                    courier_id: courier.id,
                    engine_type: asset_input.engine_type,
                    is_primary: true,
                    max_weight_kg: decimal_opt_to_bigdecimal(asset_input.max_weight_kg),
                    max_volume_cm3: decimal_opt_to_bigdecimal(asset_input.max_volume_cm3),
                    equipments: asset_input.equipments.clone(),
                    available: asset_input.available,
                    availability_schedule: asset_input.availability_schedule.clone(),
                    documents: asset_input.documents.clone(),
                })
                .await?;
            Some(inserted)
        } else {
            None
        };

        Ok((updated_app, courier, asset))
    }

    /// Crée une nouvelle course
    pub async fn create_delivery_request(
        &self,
        params: CreateDeliveryParams,
    ) -> AppResult<DeliverySummary> {
        let CreateDeliveryParams {
            creator_id,
            parcel,
            pickup,
            dropoff,
            recipient,
            distance_meters,
            estimated_duration_seconds,
            metadata,
            initial_event_payload,
        } = params;

        // Validations de base
        if let Some(distance) = distance_meters {
            if distance <= 0 {
                return Err(AppError::BadRequest(
                    "La distance estimée doit être positive".into(),
                ));
            }
        }

        if let Some(duration) = estimated_duration_seconds {
            if duration <= 0 {
                return Err(AppError::BadRequest(
                    "La durée estimée doit être positive".into(),
                ));
            }
        }

        let pickup_address = pickup.address.clone();
        let dropoff_address = dropoff.address.clone();

        let mut request = NewDeliveryRequest {
            creator_id,
            courier_id: None,
            parcel: parcel.into(),
            pickup: pickup.clone().into(),
            pickup_address,
            dropoff: dropoff.clone().into(),
            dropoff_address,
            recipient: recipient.as_ref().map(|recipient| NewDeliveryRecipient {
                user_id: recipient.user_id,
                contact_name: recipient.contact_name.clone(),
                contact_phone: recipient.contact_phone.clone(),
                notes: recipient.notes.clone(),
                chat_thread_id: recipient.chat_thread_id,
                dropoff_override: recipient.dropoff_override.as_ref().map(|loc| GeoPoint {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                }),
                dropoff_address: recipient.dropoff_address.clone(),
                country_code: recipient.country_code.clone(),
                allow_tracking: recipient.allow_tracking,
                allow_contact: recipient.allow_contact,
                consent_granted: recipient.consent_granted,
                preferred_language: recipient.preferred_language.clone(),
            }),
            distance_meters,
            estimated_duration_seconds,
            metadata,
            initial_status: DeliveryStatus::Requested,
            initial_event_payload,
            initial_status_author: Some(creator_id),
        };

        if let Some(recipient) = &request.recipient {
            let extras_overlay = json!({
                "recipient_extras": {
                    "country_code": recipient.country_code,
                    "allow_tracking": recipient.allow_tracking,
                    "allow_contact": recipient.allow_contact,
                    "consent_granted": recipient.consent_granted,
                    "preferred_language": recipient.preferred_language,
                }
            });
            request.metadata = merge_json(request.metadata, extras_overlay);
        }

        let summary = self.repository.create_delivery_request(request).await?;
        self.broadcast_status_update(summary.id, DeliveryStatus::Requested, None)
            .await;

        if let Err(err) = self.enqueue_delivery_matching(&summary).await {
            log::error!(
                "[DeliveryMatching] Enfilement impossible pour la livraison {}: {:?}",
                summary.id,
                err
            );
        }

        Ok(summary)
    }

    /// Attribue ou met à jour le destinataire de la livraison
    pub async fn assign_delivery_recipient(
        &self,
        delivery_id: Uuid,
        mut recipient: DeliveryRecipientInput,
    ) -> AppResult<DeliveryRecipient> {
        recipient.contact_name = recipient
            .contact_name
            .map(|name| name.trim().to_string())
            .filter(|name| !name.is_empty());
        recipient.contact_phone = recipient
            .contact_phone
            .map(|phone| phone.trim().to_string())
            .filter(|phone| !phone.is_empty());
        recipient.notes = recipient
            .notes
            .map(|note| note.trim().to_string())
            .filter(|note| !note.is_empty());
        recipient.country_code = recipient
            .country_code
            .map(|code| code.trim().to_uppercase())
            .filter(|code| !code.is_empty());
        recipient.preferred_language = recipient
            .preferred_language
            .map(|lang| lang.trim().to_lowercase())
            .filter(|lang| !lang.is_empty());

        if recipient.user_id.is_none()
            && recipient.contact_name.is_none()
            && recipient.contact_phone.is_none()
        {
            return Err(AppError::BadRequest(
                "Fournissez au moins un identifiant, un nom ou un numéro pour le destinataire"
                    .into(),
            ));
        }

        if recipient.allow_contact == Some(true) && recipient.contact_phone.is_none() {
            return Err(AppError::BadRequest(
                "Un numéro valide est requis pour autoriser le contact du destinataire.".into(),
            ));
        }

        if recipient.allow_tracking == Some(true) && recipient.consent_granted != Some(true) {
            return Err(AppError::BadRequest(
                "Le partage de position nécessite le consentement explicite du destinataire."
                    .into(),
            ));
        }

        if let Some(phone) = recipient.contact_phone.as_mut() {
            let phone_service = PhoneValidationService::new();
            let validation = phone_service.validate_phone_number(PhoneValidationRequest {
                phone_number: phone.clone(),
                country: recipient.country_code.clone(),
            });

            if !validation.is_valid {
                let error_opt = validation.error_message.clone();
                let message = error_opt
                    .clone()
                    .unwrap_or_else(|| "Numéro de téléphone invalide.".to_string());
                log::warn!(
                    "[DeliveryService] assign_delivery_recipient invalid phone number (delivery {}, user {:?}): {}",
                    delivery_id,
                    recipient.user_id,
                    message
                );

                return Err(AppError::BadRequest(error_opt.unwrap_or(message)));
            }

            if let Some(formatted) = validation.formatted_number {
                *phone = formatted;
            }

            if recipient.country_code.is_none() {
                recipient.country_code = validation.country_code;
            }
        }

        let repository_payload = NewDeliveryRecipient {
            user_id: recipient.user_id,
            contact_name: recipient.contact_name.clone(),
            contact_phone: recipient.contact_phone.clone(),
            notes: recipient.notes.clone(),
            chat_thread_id: recipient.chat_thread_id,
            dropoff_override: recipient
                .dropoff_override
                .as_ref()
                .map(|loc| loc.clone().into()),
            dropoff_address: recipient.dropoff_address.clone(),
            country_code: recipient.country_code.clone(),
            allow_tracking: recipient.allow_tracking,
            allow_contact: recipient.allow_contact,
            consent_granted: recipient.consent_granted,
            preferred_language: recipient.preferred_language.clone(),
        };

        let updated = self
            .repository
            .update_delivery_recipient(delivery_id, repository_payload)
            .await?;

        if let Some(point) = &updated.dropoff_override {
            self.tracking_manager
                .broadcast_event(
                    delivery_id,
                    DeliveryWsEvent::RecipientDropoff {
                        latitude: point.latitude,
                        longitude: point.longitude,
                        address: updated.dropoff_address.clone(),
                    },
                )
                .await;
            record_recipient_dropoff_metric();
            log::info!(
                "[DeliveryService] Recipient dropoff refreshed ({}, lat: {}, lng: {})",
                delivery_id,
                point.latitude,
                point.longitude
            );
        } else {
            log::debug!(
                "[DeliveryService] Recipient dropoff cleared for {} (no override provided)",
                delivery_id
            );
        }

        Ok(updated)
    }

    /// Met à jour en temps réel la position communiquée par le destinataire
    pub async fn update_recipient_dropoff(
        &self,
        delivery_id: Uuid,
        point: LocationInput,
        address: Option<String>,
        submitted_by: Option<i32>,
    ) -> AppResult<DeliveryRecipient> {
        let updated = self
            .repository
            .update_recipient_dropoff(
                delivery_id,
                point.clone().into(),
                address.clone(),
                submitted_by,
            )
            .await?;

        if let Some(point) = &updated.dropoff_override {
            self.tracking_manager
                .broadcast_event(
                    delivery_id,
                    DeliveryWsEvent::RecipientDropoff {
                        latitude: point.latitude,
                        longitude: point.longitude,
                        address: updated.dropoff_address.clone(),
                    },
                )
                .await;
        }

        Ok(updated)
    }

    pub async fn share_dropoff_link(
        &self,
        delivery_id: Uuid,
        user_id: i32,
    ) -> AppResult<DropoffShareInfo> {
        let summary = self.get_delivery_summary(delivery_id).await?;
        self.ensure_delivery_access(&summary, user_id).await?;

        let tracking_token = self
            .repository
            .ensure_recipient_tracking_token(delivery_id)
            .await?;

        let now = Utc::now().to_rfc3339();
        self.repository
            .merge_delivery_metadata(
                delivery_id,
                &json!({
                    "dropoff_pending": true,
                    "dropoff_pending_at": now,
                    "dropoff_share_token": tracking_token,
                    "dropoff_pending_reason": "customer_selection"
                }),
            )
            .await?;

        let _ = self
            .repository
            .update_matching_queue_status(
                delivery_id,
                DeliveryMatchingStatus::Searching,
                Some(Utc::now() + Duration::hours(6)),
                Some(json!({ "reason": "awaiting_dropoff_confirmation" })),
                false,
            )
            .await;

        let share_url = env::var("PUBLIC_TRACKING_BASE_URL")
            .or_else(|_| env::var("PUBLIC_BASE_URL"))
            .ok()
            .map(|base| {
                format!(
                    "{}/delivery/dropoff/{}",
                    base.trim_end_matches('/'),
                    tracking_token
                )
            });

        Ok(DropoffShareInfo {
            delivery_id,
            tracking_token,
            share_url,
            dropoff_pending: true,
        })
    }

    pub async fn get_public_dropoff_snapshot(
        &self,
        token: Uuid,
    ) -> AppResult<PublicDropoffSnapshot> {
        let delivery_id = self
            .repository
            .find_delivery_id_by_recipient_token(token)
            .await?
            .ok_or_else(|| AppError::NotFound("Lien de livraison invalide ou expiré.".into()))?;

        let summary = self.get_delivery_summary(delivery_id).await?;
        let dropoff_pending = summary
            .metadata
            .get("dropoff_pending")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let scheduled_pickup_at = summary
            .metadata
            .get("scheduled_pickup_at")
            .and_then(|v| v.as_str())
            .map(ToString::to_string);
        let service_hint = summary
            .metadata
            .get("studio_brief_excerpt")
            .and_then(|v| v.as_str())
            .map(ToString::to_string);
        let vehicle_type_id = summary
            .metadata
            .get("vehicle_type_id")
            .and_then(|v| v.as_i64());

        Ok(PublicDropoffSnapshot {
            delivery_id,
            pickup: build_pickup_location(&summary, None),
            dropoff: build_dropoff_location(&summary),
            dropoff_pending,
            scheduled_pickup_at,
            service_hint,
            vehicle_type_id,
        })
    }

    pub async fn submit_public_dropoff(
        &self,
        token: Uuid,
        point: LocationInput,
        address: Option<String>,
        instructions: Option<String>,
    ) -> AppResult<DeliverySummary> {
        let delivery_id = self
            .repository
            .find_delivery_id_by_recipient_token(token)
            .await?
            .ok_or_else(|| AppError::NotFound("Lien de livraison invalide ou expiré.".into()))?;

        self.update_recipient_dropoff(delivery_id, point, address, None)
            .await?;

        let now = Utc::now().to_rfc3339();
        self.repository
            .merge_delivery_metadata(
                delivery_id,
                &json!({
                    "dropoff_pending": false,
                    "dropoff_confirmed_at": now,
                    "dropoff_confirmed_source": "customer_link",
                    "dropoff_client_instructions": instructions,
                }),
            )
            .await?;

        let summary = self.get_delivery_summary(delivery_id).await?;
        self.enqueue_delivery_matching(&summary).await?;

        Ok(summary)
    }

    pub async fn estimate_shopping_order(
        &self,
        input: ShoppingEstimateInput,
    ) -> AppResult<ShoppingEstimateResult> {
        if input.items.is_empty() {
            return Err(AppError::BadRequest(
                "Ajoutez au moins un produit au panier".into(),
            ));
        }

        let currency = if input.currency.is_empty() {
            "XAF".to_string()
        } else {
            input.currency.clone()
        };

        let mut estimated_items: Vec<ShoppingEstimateItem> = Vec::with_capacity(input.items.len());
        let mut total_cents = 0;

        for item in input.items {
            let quantity_decimal = Decimal::from_f64(item.quantity).ok_or_else(|| {
                AppError::BadRequest(format!(
                    "Quantité invalide pour le produit {}",
                    item.product_name
                ))
            })?;
            if quantity_decimal <= Decimal::ZERO {
                return Err(AppError::BadRequest(format!(
                    "Quantité invalide pour le produit {}",
                    item.product_name
                )));
            }
            let estimated_price = item.estimated_price_cents.unwrap_or(0).max(0);

            estimated_items.push(ShoppingEstimateItem {
                product_name: item.product_name,
                quantity: decimal_to_bigdecimal(quantity_decimal),
                unit: item.unit,
                estimated_price_cents: estimated_price,
            });
            total_cents += estimated_price;
        }

        // TODO: remplacer par intégration API supermarché temps réel dès disponibilité

        // Temps estimé : 3 minutes par produit (borné)
        let estimated_time = (estimated_items.len() as i32 * 3).clamp(5, 180);

        Ok(ShoppingEstimateResult {
            items: estimated_items,
            estimated_total_cents: total_cents,
            estimated_shopping_time_minutes: estimated_time,
            currency,
        })
    }

    pub async fn create_shopping_order(
        &self,
        mut params: CreateShoppingOrderParams,
    ) -> AppResult<CreateShoppingOrderResult> {
        if params.items.is_empty() {
            return Err(AppError::BadRequest(
                "Le panier supermarché est vide.".into(),
            ));
        }

        // Calcul estimation officielle
        let estimate = self
            .estimate_shopping_order(ShoppingEstimateInput {
                items: params.items.clone(),
                currency: params.currency.clone(),
            })
            .await?;

        let margin_cents = compute_margin_cents(estimate.estimated_total_cents);
        let delivery_cost_cents = (params.delivery_base_price_cents
            + params.delivery_distance_price_cents
            + params.delivery_surcharge_cents
            - params.delivery_discount_cents)
            .max(0);
        let total_required = estimate.estimated_total_cents + margin_cents + delivery_cost_cents;

        let balance = self.repository.get_user_balance(params.creator_id).await?;
        let total_required_i64 = total_required as i64;
        if balance < total_required_i64 {
            return Err(AppError::BadRequest(format!(
                "Solde insuffisant. Montant requis: {}",
                total_required
            )));
        }

        // Fusion metadata
        let shopping_meta = json!({
            "shopping": {
                "store_name": params.store.name,
                "items_count": params.items.len(),
                "estimated_total_cents": estimate.estimated_total_cents
            }
        });
        params.metadata = merge_json(params.metadata, shopping_meta);

        let delivery_summary = self
            .create_delivery_request(CreateDeliveryParams {
                creator_id: params.creator_id,
                parcel: NewDeliveryParcelInput {
                    type_id: None,
                    weight_kg: None,
                    volume_cm3: None,
                    declared_value: None,
                    notes: Some("Commande supermarché".to_string()),
                    photos: Value::Array(vec![]),
                    constraints: Value::Object(Default::default()),
                },
                pickup: params.store.to_location_input(),
                dropoff: params.dropoff.clone(),
                recipient: params.recipient.clone(),
                distance_meters: params.distance_meters,
                estimated_duration_seconds: params.estimated_duration_seconds,
                metadata: params.metadata.clone(),
                initial_event_payload: json!({
                    "shopping": {
                        "status": ShoppingStatus::Pending
                    }
                }),
            })
            .await?;

        let balance_after = self
            .repository
            .apply_wallet_mutation(
                params.creator_id,
                delivery_summary.id,
                total_required_i64,
                WalletEventDirection::Debit,
                Some("shopping_reservation".to_string()),
                None,
            )
            .await?;
        record_wallet_debit_metric(total_required_i64);
        log::info!(
            "[DeliveryService] Réservation wallet pour shopping (delivery {}, user {}, amount {}, balance {})",
            delivery_summary.id,
            params.creator_id,
            total_required_i64,
            balance_after
        );

        self.repository
            .set_delivery_shopping_flags(
                delivery_summary.id,
                Some(params.store.to_geo_point()),
                params.store.name.clone(),
            )
            .await?;

        let order_payload = json!({
            "reserved_cents": total_required_i64,
            "delivery_cost_cents": delivery_cost_cents,
            "margin_cents": margin_cents
        });

        // Préparer items
        let items_payload: Vec<NewShoppingOrderItem> = params
            .items
            .iter()
            .map(|item| {
                let quantity_decimal = Decimal::from_f64(item.quantity).ok_or_else(|| {
                    AppError::BadRequest(format!(
                        "Quantité invalide pour le produit {}",
                        item.product_name
                    ))
                })?;
                if quantity_decimal <= Decimal::ZERO {
                    return Err(AppError::BadRequest(format!(
                        "Quantité invalide pour le produit {}",
                        item.product_name
                    )));
                }
                let quantity = decimal_to_bigdecimal(quantity_decimal);

                Ok(NewShoppingOrderItem {
                    product_id: item.product_id,
                    product_name: item.product_name.clone(),
                    characteristics: item.characteristics.clone(),
                    quantity,
                    unit: item.unit.clone(),
                    estimated_price_cents: item.estimated_price_cents.unwrap_or(0),
                    status: ShoppingItemStatus::Pending,
                    metadata: Value::Object(Default::default()),
                })
            })
            .collect::<Result<Vec<_>, AppError>>()?;

        let (order, items) = self
            .repository
            .insert_shopping_order(NewShoppingOrder {
                delivery_id: delivery_summary.id,
                status: ShoppingStatus::Pending,
                estimated_total_cents: estimate.estimated_total_cents,
                currency: &params.currency,
                store_name: params.store.name.as_deref(),
                store_location: Some(params.store.to_geo_point()),
                notes: params.notes.as_deref(),
                requires_balance_top_up: false,
                payload: order_payload.clone(),
                items: &items_payload,
            })
            .await?;

        // Pricing
        let pricing = self
            .repository
            .upsert_pricing(NewDeliveryPricing {
                delivery_id: delivery_summary.id,
                base_price_cents: params.delivery_base_price_cents,
                distance_price_cents: params.delivery_distance_price_cents,
                surcharge_cents: params.delivery_surcharge_cents,
                discount_cents: params.delivery_discount_cents,
                currency: params.currency.clone(),
                details: params.delivery_details,
                shopping_cost_cents: estimate.estimated_total_cents,
                shopping_discount_cents: 0,
            })
            .await?;

        self.broadcast_pricing_update(&pricing).await;

        Ok(CreateShoppingOrderResult {
            delivery: delivery_summary,
            shopping_order: order,
            items,
            estimated_total_cents: estimate.estimated_total_cents,
            margin_cents,
            balance_remaining: balance_after,
        })
    }

    /// Affecte un statut à une livraison
    pub async fn update_delivery_status(
        &self,
        delivery_id: Uuid,
        status: DeliveryStatus,
        cancel_reason: Option<DeliveryCancelReason>,
        recorded_by: Option<i32>,
        payload: Option<Value>,
    ) -> AppResult<()> {
        let timestamp_field = match status {
            DeliveryStatus::AwaitingCourierConfirmation => {
                Some(DeliveryTimestampField::ConfirmedAt)
            }
            DeliveryStatus::Accepted => Some(DeliveryTimestampField::AcceptedAt),
            DeliveryStatus::PickedUp => Some(DeliveryTimestampField::PickedUpAt),
            DeliveryStatus::Delivered => Some(DeliveryTimestampField::DeliveredAt),
            DeliveryStatus::Completed => Some(DeliveryTimestampField::CompletedAt),
            DeliveryStatus::Cancelled => Some(DeliveryTimestampField::CancelledAt),
            _ => None,
        };

        self.repository
            .update_delivery_status(delivery_id, status, cancel_reason, timestamp_field)
            .await?;

        self.repository
            .add_status_event(NewStatusEvent {
                delivery_id,
                status,
                payload,
                recorded_by,
            })
            .await?;

        self.broadcast_status_update(delivery_id, status, cancel_reason)
            .await;

        // ✅ RECOMMANDATION 1: Envoyer notification push au créateur et au destinataire
        self.send_delivery_status_notifications(delivery_id, status, cancel_reason)
            .await;

        Ok(())
    }

    /// ✅ RECOMMANDATION 1: Envoyer des notifications push pour les changements de statut importants
    async fn send_delivery_status_notifications(
        &self,
        delivery_id: Uuid,
        status: DeliveryStatus,
        cancel_reason: Option<DeliveryCancelReason>,
    ) {
        // Récupérer les informations de la livraison
        let summary = match self.get_delivery_summary(delivery_id).await {
            Ok(s) => s,
            Err(e) => {
                log::warn!(
                    "[DeliveryService] Impossible de récupérer la livraison pour notifications: {}",
                    e
                );
                return;
            }
        };

        // Déterminer le message selon le statut
        let (title, body) = match status {
            DeliveryStatus::Accepted => (
                "📦 Coursier assigné",
                format!(
                    "Un coursier a été assigné à votre livraison #{}",
                    delivery_id.to_string()[..8].to_uppercase()
                ),
            ),
            DeliveryStatus::EnRoutePickup => (
                "🚚 Coursier en route",
                format!(
                    "Le coursier est en route vers le point de collecte pour la livraison #{}",
                    delivery_id.to_string()[..8].to_uppercase()
                ),
            ),
            DeliveryStatus::PickedUp => (
                "✅ Colis récupéré",
                format!(
                    "Le coursier a récupéré votre colis. Livraison #{}",
                    delivery_id.to_string()[..8].to_uppercase()
                ),
            ),
            DeliveryStatus::EnRouteDelivery => (
                "🚚 En route vers vous",
                format!(
                    "Le coursier est en route vers vous. Livraison #{}",
                    delivery_id.to_string()[..8].to_uppercase()
                ),
            ),
            DeliveryStatus::ArrivalDestination => (
                "📍 Arrivé dans votre quartier",
                format!(
                    "Le coursier arrive dans votre quartier. Livraison #{}",
                    delivery_id.to_string()[..8].to_uppercase()
                ),
            ),
            DeliveryStatus::Delivered => (
                "✅ Livraison effectuée",
                format!(
                    "Votre livraison #{} a été livrée avec succès !",
                    delivery_id.to_string()[..8].to_uppercase()
                ),
            ),
            DeliveryStatus::Cancelled => {
                let reason = match cancel_reason {
                    Some(DeliveryCancelReason::ClientCancelled) => "annulée par le client",
                    Some(DeliveryCancelReason::CourierCancelled) => "annulée par le coursier",
                    Some(DeliveryCancelReason::SystemCancelled) => "annulée par le système",
                    None => "annulée",
                };
                (
                    "❌ Livraison annulée",
                    format!(
                        "La livraison #{} a été {}",
                        delivery_id.to_string()[..8].to_uppercase(),
                        reason
                    ),
                )
            }
            _ => return, // Ne pas envoyer de notification pour les autres statuts
        };

        let notification_data = json!({
            "delivery_id": delivery_id.to_string(),
            "status": format!("{:?}", status),
            "type": "delivery_status_update"
        });

        // Envoyer au créateur (client qui a créé la livraison)
        if let Some(creator_id) = summary.creator_id {
            let pool = self.repository().pool();
            let _ = push_notification_service::send_push_notification(
                pool,
                creator_id,
                title.clone(),
                body.clone(),
                Some(notification_data.clone()),
                Some("default".to_string()),
            )
            .await;
        }

        // Envoyer au destinataire (si différent du créateur et si enregistré)
        if let Some(recipient) = &summary.recipient {
            if let Some(recipient_id) = recipient.id {
                // Ne pas envoyer si c'est le même utilisateur que le créateur
                if Some(recipient_id) != summary.creator_id {
                    let pool = self.repository().pool();
                    let _ = push_notification_service::send_push_notification(
                        pool,
                        recipient_id,
                        title.clone(),
                        body.clone(),
                        Some(notification_data.clone()),
                        Some("default".to_string()),
                    )
                    .await;
                }
            }

            // ✅ RECOMMANDATION 3: Envoyer SMS/Email pour les destinataires sans compte (lien dropoff)
            // Si le destinataire n'a pas de compte (pas de recipient_id) mais a un téléphone/email
            if recipient.id.is_none() {
                let pool = self.repository().pool();
                let delivery_id_str = delivery_id.to_string();
                let status_str = format!("{:?}", status);
                let _ = crate::services::delivery_notification_service::notify_delivery_status_change(
                    pool,
                    &delivery_id_str,
                    &status_str,
                    recipient.phone.as_deref(),
                    recipient.email.as_deref(),
                    recipient.contact_name.as_deref(),
                )
                .await;
            }
        }
    }

    /// Enregistre un point de tracking
    pub async fn record_tracking_point(&self, input: TrackingInput) -> AppResult<()> {
        self.repository
            .insert_tracking_point(NewTrackingPoint {
                delivery_id: input.delivery_id,
                courier_id: input.courier_id,
                position: crate::models::delivery_model::GeoPoint {
                    latitude: input.latitude,
                    longitude: input.longitude,
                },
                captured_at: input.captured_at,
                speed_kmh: decimal_opt_to_bigdecimal(input.speed_kmh.clone()),
                bearing: decimal_opt_to_bigdecimal(input.bearing.clone()),
                accuracy_meters: decimal_opt_to_bigdecimal(input.accuracy_meters.clone()),
            })
            .await?;

        self.broadcast_location_update(&input).await;

        // ✅ RECOMMANDATION 2: Détecter automatiquement la proximité avec pickup/dropoff
        self.check_proximity_and_suggest_status_update(input).await;

        Ok(())
    }

    /// ✅ RECOMMANDATION 2: Détecter automatiquement quand le coursier est proche du pickup/dropoff
    async fn check_proximity_and_suggest_status_update(&self, input: TrackingInput) {
        const PROXIMITY_THRESHOLD_METERS: f64 = 50.0; // 50 mètres de rayon

        // Récupérer les informations de la livraison
        let summary = match self.get_delivery_summary(input.delivery_id).await {
            Ok(s) => s,
            Err(_) => return,
        };

        let courier_pos = (input.latitude, input.longitude);

        // Vérifier la proximité avec le point de pickup
        let pickup_pos = (summary.pickup.latitude, summary.pickup.longitude);
        let distance_to_pickup = haversine_distance(courier_pos, pickup_pos);

        // Vérifier la proximité avec le point de dropoff
        let dropoff_pos = (summary.dropoff.latitude, summary.dropoff.longitude);
        let distance_to_dropoff = haversine_distance(courier_pos, dropoff_pos);

        // Vérifier si on doit suggérer un changement de statut
        match summary.status {
            DeliveryStatus::EnRoutePickup | DeliveryStatus::AwaitingCourierConfirmation => {
                if distance_to_pickup <= PROXIMITY_THRESHOLD_METERS {
                    log::info!(
                        "[DeliveryService] 📍 Coursier proche du pickup ({}m) pour livraison {}",
                        distance_to_pickup as i32,
                        input.delivery_id
                    );
                    // Note: On pourrait créer un événement spécial "proximity_pickup" 
                    // qui serait envoyé via WebSocket pour suggérer au coursier de changer le statut
                    // Pour l'instant, on log juste l'information
                }
            }
            DeliveryStatus::EnRouteDelivery | DeliveryStatus::PickedUp => {
                if distance_to_dropoff <= PROXIMITY_THRESHOLD_METERS {
                    log::info!(
                        "[DeliveryService] 📍 Coursier proche du dropoff ({}m) pour livraison {}",
                        distance_to_dropoff as i32,
                        input.delivery_id
                    );
                    // Note: On pourrait créer un événement spécial "proximity_dropoff"
                    // qui serait envoyé via WebSocket pour suggérer au coursier de changer le statut
                }
            }
            _ => {}
        }
    }

    /// Met à jour le pricing
    pub async fn upsert_pricing(&self, input: PricingInput) -> AppResult<()> {
        let pricing = self
            .repository
            .upsert_pricing(NewDeliveryPricing {
                delivery_id: input.delivery_id,
                base_price_cents: input.base_price_cents,
                distance_price_cents: input.distance_price_cents,
                surcharge_cents: input.surcharge_cents,
                discount_cents: input.discount_cents,
                currency: input.currency,
                details: input.details,
                shopping_cost_cents: input.shopping_cost_cents,
                shopping_discount_cents: input.shopping_discount_cents,
            })
            .await?;
        self.broadcast_pricing_update(&pricing).await;
        Ok(())
    }

    pub async fn update_shopping_item(
        &self,
        user_id: i32,
        input: ShoppingItemUpdateInput,
    ) -> AppResult<()> {
        let (_, delivery) = self.load_shopping_context(input.order_id).await?;
        self.ensure_courier_for_delivery(&delivery, user_id).await?;

        self.repository
            .update_shopping_item(
                input.item_id,
                input.status,
                input.actual_price_cents,
                input.metadata,
            )
            .await?;

        // Optionnel: diffuser statut panier si tous achetés
        Ok(())
    }

    pub async fn update_shopping_status(
        &self,
        user_id: i32,
        input: ShoppingStatusUpdateInput,
    ) -> AppResult<()> {
        let (order, delivery) = self.load_shopping_context(input.order_id).await?;

        match input.status {
            ShoppingStatus::Pending | ShoppingStatus::AwaitingPurchase => {
                if delivery.creator_id != user_id {
                    return Err(AppError::Forbidden(
                        "Seul le client peut remettre la commande en attende.".into(),
                    ));
                }
            }
            ShoppingStatus::Cancelled => {
                if delivery.creator_id != user_id {
                    // Coursier peut annuler pour indisponibilité
                    self.ensure_courier_for_delivery(&delivery, user_id).await?;
                }
            }
            _ => {
                self.ensure_courier_for_delivery(&delivery, user_id).await?;
            }
        };

        self.repository
            .update_shopping_status(order.delivery_id, input.status)
            .await?;

        let mapped_status = match input.status {
            ShoppingStatus::ShoppingInProgress => Some(DeliveryStatus::ShoppingInProgress),
            ShoppingStatus::ShoppingCompleted | ShoppingStatus::CheckoutSubmitted => {
                Some(DeliveryStatus::ShoppingCompleted)
            }
            ShoppingStatus::Cancelled => Some(DeliveryStatus::Cancelled),
            ShoppingStatus::AwaitingPurchase => Some(DeliveryStatus::AwaitingCourierConfirmation),
            ShoppingStatus::Pending => Some(DeliveryStatus::Requested),
        };

        if let Some(status) = mapped_status {
            let cancel_reason = if status == DeliveryStatus::Cancelled {
                if delivery.creator_id == user_id {
                    Some(DeliveryCancelReason::ClientCancelled)
                } else {
                    Some(DeliveryCancelReason::CourierCancelled)
                }
            } else {
                None
            };

            self.update_delivery_status(
                order.delivery_id,
                status,
                cancel_reason,
                Some(user_id),
                None,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn submit_shopping_checkout(
        &self,
        user_id: i32,
        input: ShoppingCheckoutInput,
    ) -> AppResult<DeliveryPricing> {
        let (order, delivery) = self.load_shopping_context(input.order_id).await?;
        self.ensure_courier_for_delivery(&delivery, user_id).await?;

        let existing = self
            .repository
            .get_pricing_by_delivery(order.delivery_id)
            .await?;

        let pricing_snapshot = existing.unwrap_or(DeliveryPricing {
            id: Uuid::nil(),
            delivery_id: order.delivery_id,
            base_price_cents: 0,
            distance_price_cents: 0,
            surcharge_cents: 0,
            discount_cents: 0,
            currency: "XAF".to_string(),
            calculated_at: Utc::now(),
            details: Value::Object(Default::default()),
            shopping_cost_cents: 0,
            shopping_discount_cents: 0,
        });

        let reserved_cents = order
            .payload
            .get("reserved_cents")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let delivery_cost_cents = (pricing_snapshot.base_price_cents
            + pricing_snapshot.distance_price_cents
            + pricing_snapshot.surcharge_cents
            - pricing_snapshot.discount_cents)
            .max(0);
        let total_due_cents = (input.actual_total_cents + delivery_cost_cents).max(0) as i64;

        if total_due_cents > reserved_cents {
            let diff = total_due_cents - reserved_cents;
            let new_balance = self
                .repository
                .apply_wallet_mutation(
                    delivery.creator_id,
                    order.delivery_id,
                    diff,
                    WalletEventDirection::Debit,
                    Some("shopping_adjustment".to_string()),
                    None,
                )
                .await?;
            record_wallet_debit_metric(diff);
            log::info!(
                "[DeliveryService] Ajustement wallet additionnel (delivery {}, user {}, diff {}, balance {})",
                order.delivery_id,
                delivery.creator_id,
                diff,
                new_balance
            );
        } else if reserved_cents > total_due_cents {
            let refund = reserved_cents - total_due_cents;
            let new_balance = self
                .repository
                .apply_wallet_mutation(
                    delivery.creator_id,
                    order.delivery_id,
                    refund,
                    WalletEventDirection::Refund,
                    Some("shopping_adjustment_refund".to_string()),
                    None,
                )
                .await?;
            record_wallet_refund_metric(refund);
            log::info!(
                "[DeliveryService] Ajustement wallet remboursement (delivery {}, user {}, refund {}, balance {})",
                order.delivery_id,
                delivery.creator_id,
                refund,
                new_balance
            );
        }

        let checkout_payload = merge_json(
            order.payload.clone(),
            merge_json(
                input.payload.unwrap_or(Value::Object(Default::default())),
                json!({
                    "reserved_cents": total_due_cents,
                    "actual_total_cents": input.actual_total_cents,
                    "checkout_at": Utc::now()
                }),
            ),
        );

        self.repository
            .update_shopping_checkout(
                order.delivery_id,
                input.actual_total_cents,
                Some(checkout_payload),
            )
            .await?;

        self.repository
            .update_shopping_status(order.delivery_id, ShoppingStatus::CheckoutSubmitted)
            .await?;

        self.update_delivery_status(
            order.delivery_id,
            DeliveryStatus::ShoppingCompleted,
            None,
            Some(user_id),
            None,
        )
        .await?;

        let pricing = self
            .repository
            .upsert_pricing(NewDeliveryPricing {
                delivery_id: order.delivery_id,
                base_price_cents: pricing_snapshot.base_price_cents,
                distance_price_cents: pricing_snapshot.distance_price_cents,
                surcharge_cents: pricing_snapshot.surcharge_cents,
                discount_cents: pricing_snapshot.discount_cents,
                currency: pricing_snapshot.currency.clone(),
                details: pricing_snapshot.details.clone(),
                shopping_cost_cents: input.actual_total_cents,
                shopping_discount_cents: pricing_snapshot.shopping_discount_cents,
            })
            .await?;

        self.broadcast_pricing_update(&pricing).await;
        Ok(pricing)
    }

    /// Note un coursier (client -> coursier)
    pub async fn rate_courier(
        &self,
        delivery_id: Uuid,
        client_user_id: i32,
        courier_id: Uuid,
        score_small: i32,
        tags: Option<Vec<String>>,
        comment: Option<String>,
    ) -> AppResult<()> {
        if !(1..=5).contains(&score_small) {
            return Err(AppError::BadRequest("Score invalide (1..5)".into()));
        }

        self.repository
            .upsert_courier_rating(NewCourierRating {
                delivery_id,
                courier_id,
                rater_id: client_user_id,
                score_small,
                tags,
                comment,
            })
            .await?;

        Ok(())
    }

    /// Note un client (coursier -> client)
    pub async fn rate_client(
        &self,
        delivery_id: Uuid,
        courier_user_id: i32,
        client_user_id: i32,
        courier_id: Uuid,
        score_small: i32,
        tags: Option<Vec<String>>,
        comment: Option<String>,
    ) -> AppResult<()> {
        if !(1..=5).contains(&score_small) {
            return Err(AppError::BadRequest("Score invalide (1..5)".into()));
        }

        if let Some(courier) = self
            .repository
            .find_courier_by_user(courier_user_id)
            .await?
        {
            if courier.id != courier_id {
                return Err(AppError::Forbidden(
                    "Ce coursier ne correspond pas à la livraison".into(),
                ));
            }
        } else {
            return Err(AppError::Forbidden(
                "Coursier introuvable pour cet utilisateur".into(),
            ));
        }

        self.repository
            .upsert_client_rating(NewClientRating {
                delivery_id,
                client_id: client_user_id,
                courier_id,
                score_small,
                tags,
                comment,
            })
            .await?;

        Ok(())
    }

    /// Récupère un résumé de livraison
    pub async fn get_delivery_summary(&self, delivery_id: Uuid) -> AppResult<DeliverySummary> {
        let delivery = self
            .repository
            .get_delivery_summary(delivery_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Livraison introuvable".into()))?;

        Ok(delivery)
    }

    /// Déclare / met à jour l'engin et équipements du coursier
    pub async fn upsert_courier_asset(&self, input: CourierAssetInput) -> AppResult<CourierAsset> {
        let asset = self
            .repository
            .upsert_courier_asset(NewCourierAsset {
                courier_id: input.courier_id,
                engine_type: input.engine_type,
                is_primary: true,
                max_weight_kg: decimal_opt_to_bigdecimal(input.max_weight_kg),
                max_volume_cm3: decimal_opt_to_bigdecimal(input.max_volume_cm3),
                equipments: input.equipments.clone(),
                available: input.available,
                availability_schedule: input.availability_schedule.clone(),
                documents: input.documents.clone(),
            })
            .await?;

        Ok(asset)
    }

    /// Traite les éléments en file d'attente (cron/worker)
    pub async fn process_matching_backlog(&self, batch_size: usize) -> AppResult<usize> {
        let queue_items = self
            .repository
            .fetch_matching_queue_batch(batch_size as i64)
            .await?;

        let mut processed = 0usize;
        for item in queue_items {
            let Some(summary) = self
                .repository
                .get_delivery_summary(item.delivery_id)
                .await?
            else {
                log::warn!(
                    "[DeliveryMatching] Impossible de recharger la livraison {} (supprimée?)",
                    item.delivery_id
                );
                self.repository
                    .update_matching_queue_status(
                        item.delivery_id,
                        DeliveryMatchingStatus::Failed,
                        None,
                        Some(json!({ "reason": "delivery_missing" })),
                        false,
                    )
                    .await?;
                continue;
            };

            let dropoff_pending = summary
                .metadata
                .get("dropoff_pending")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if dropoff_pending {
                self.repository
                    .update_matching_queue_status(
                        summary.id,
                        DeliveryMatchingStatus::Queued,
                        Some(Utc::now() + Duration::minutes(MATCHING_SEARCH_RETRY_MINUTES)),
                        Some(json!({ "reason": "awaiting_dropoff_confirmation" })),
                        false,
                    )
                    .await?;
                continue;
            }

            let attempt_start = std::time::Instant::now();
            DELIVERY_MATCHING_STARTED_TOTAL.fetch_add(1, Ordering::Relaxed);

            if let Err(err) = self.attempt_auto_matching(&summary, item.zone_id).await {
                log::warn!(
                    "[DeliveryMatching] Tentative échouée pour {}: {}",
                    summary.id,
                    err
                );
                self.repository
                    .update_matching_queue_status(
                        summary.id,
                        DeliveryMatchingStatus::Searching,
                        Some(Utc::now() + Duration::minutes(MATCHING_SEARCH_RETRY_MINUTES)),
                        Some(json!({ "error": err.to_string() })),
                        true,
                    )
                    .await?;

                DELIVERY_MATCHING_FAILED_TOTAL.fetch_add(1, Ordering::Relaxed);
            } else {
                processed += 1;
                DELIVERY_MATCHING_SUCCESS_TOTAL.fetch_add(1, Ordering::Relaxed);
            }

            let duration_ms = attempt_start.elapsed().as_millis() as i64;
            if duration_ms > 0 {
                DELIVERY_MATCHING_LATENCY_TOTAL_MS
                    .fetch_add(duration_ms, Ordering::Relaxed);
                DELIVERY_MATCHING_LATENCY_COUNT.fetch_add(1, Ordering::Relaxed);
            }
        }

        Ok(processed)
    }

    async fn load_shopping_context(
        &self,
        order_id: Uuid,
    ) -> AppResult<(ShoppingOrder, DeliverySummary)> {
        let order = self
            .repository
            .get_shopping_order_by_id(order_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Commande supermarché introuvable".into()))?;

        let delivery = self
            .repository
            .get_delivery_summary(order.delivery_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Livraison introuvable".into()))?;

        Ok((order, delivery))
    }

    async fn ensure_courier_for_delivery(
        &self,
        delivery: &DeliverySummary,
        user_id: i32,
    ) -> AppResult<Uuid> {
        let courier = self
            .repository
            .find_courier_by_user(user_id)
            .await?
            .ok_or_else(|| {
                AppError::Forbidden("Utilisateur non enregistré comme coursier Yukpo.".into())
            })?;

        if delivery.courier_id != Some(courier.id) {
            return Err(AppError::Forbidden(
                "Vous n'êtes pas le coursier assigné à cette livraison.".into(),
            ));
        }

        Ok(courier.id)
    }

    async fn broadcast_status_update(
        &self,
        delivery_id: Uuid,
        status: DeliveryStatus,
        cancel_reason: Option<DeliveryCancelReason>,
    ) {
        self.tracking_manager
            .broadcast_event(
                delivery_id,
                DeliveryWsEvent::Status {
                    status,
                    cancel_reason,
                },
            )
            .await;
    }

    async fn broadcast_location_update(&self, input: &TrackingInput) {
        self.tracking_manager
            .broadcast_event(
                input.delivery_id,
                DeliveryWsEvent::Location {
                    latitude: input.latitude,
                    longitude: input.longitude,
                    speed_kmh: input.speed_kmh.and_then(|d| d.to_f64()),
                    bearing: input.bearing.and_then(|d| d.to_f64()),
                    accuracy_meters: input.accuracy_meters.and_then(|d| d.to_f64()),
                },
            )
            .await;
    }

    async fn broadcast_pricing_update(&self, pricing: &DeliveryPricing) {
        self.tracking_manager
            .broadcast_event(
                pricing.delivery_id,
                DeliveryWsEvent::Pricing {
                    base_price_cents: pricing.base_price_cents,
                    distance_price_cents: pricing.distance_price_cents,
                    surcharge_cents: pricing.surcharge_cents,
                    discount_cents: pricing.discount_cents,
                    currency: pricing.currency.clone(),
                    shopping_cost_cents: pricing.shopping_cost_cents,
                    shopping_discount_cents: pricing.shopping_discount_cents,
                },
            )
            .await;
    }

    async fn ensure_delivery_access(
        &self,
        summary: &DeliverySummary,
        user_id: i32,
    ) -> AppResult<()> {
        if summary.creator_id == user_id
            || summary
                .recipient
                .as_ref()
                .and_then(|recipient| recipient.user_id)
                == Some(user_id)
        {
            return Ok(());
        }

        if let Some(courier_id) = summary.courier_id {
            let courier = self.repository.find_courier_by_user(user_id).await?;
            if courier.map(|c| c.id) == Some(courier_id) {
                return Ok(());
            }
        }

        Err(AppError::Forbidden(
            "Accès réservé au client, destinataire identifié ou coursier assigné.".into(),
        ))
    }

    async fn compose_frontend_summary(
        &self,
        summary: DeliverySummary,
    ) -> AppResult<FrontendDeliverySummary> {
        let pricing = self.repository.get_pricing_by_delivery(summary.id).await?;
        let shopping_order = self.repository.get_shopping_order(summary.id).await?;
        let shopping_items = if let Some(order) = &shopping_order {
            self.repository.list_shopping_items(order.id).await?
        } else {
            Vec::new()
        };
        let status_events = self.repository.list_status_events(summary.id, 50).await?;

        let courier_preview = if let Some(courier_id) = summary.courier_id {
            if let Some(courier) = self.repository.find_courier_by_id(courier_id).await? {
                self.repository
                    .get_user_preview(courier.user_id)
                    .await?
                    .map(|user| FrontendDeliveryParticipant {
                        id: Some(courier.user_id.to_string()),
                        name: user.nom_complet.or(user.prenom).or(user.nom),
                        phone: None,
                        avatar_url: user.avatar_url,
                        rating: courier.rating_average.to_f64(),
                        notes: courier.bio,
                        vehicle_type: None,
                        eta_minutes: None,
                        is_online: None,
                        allow_tracking: None,
                        allow_contact: None,
                        consent_granted: None,
                        country_code: None,
                        preferred_language: None,
                        current_location: None,
                    })
            } else {
                None
            }
        } else {
            None
        };

        let recipient_participant =
            summary
                .recipient
                .as_ref()
                .map(|recipient| FrontendDeliveryParticipant {
                    id: recipient.user_id.map(|id| id.to_string()),
                    name: recipient.contact_name.clone(),
                    phone: recipient.contact_phone.clone(),
                    avatar_url: None,
                    rating: None,
                    notes: recipient.notes.clone(),
                    vehicle_type: None,
                    eta_minutes: None,
                    is_online: None,
                    allow_tracking: recipient.allow_tracking,
                    allow_contact: recipient.allow_contact,
                    consent_granted: recipient.consent_granted,
                    country_code: recipient.country_code.clone(),
                    preferred_language: recipient.preferred_language.clone(),
                    current_location: None,
                });

        let checkpoints = build_frontend_checkpoints(&summary, &status_events);
        let last_event_at = checkpoints
            .last()
            .map(|checkpoint| checkpoint.timestamp.clone());

        let pricing_view = pricing.map(FrontendDeliveryPricing::from);
        let shopping_view = shopping_order.as_ref().map(|order| {
            FrontendShoppingSummary::from_order(order.clone(), shopping_items.clone())
        });

        let metadata = summary.metadata.clone();

        Ok(FrontendDeliverySummary {
            id: summary.id,
            order_id: shopping_order.as_ref().map(|order| order.id),
            kind: if summary.shopping_required || shopping_view.is_some() {
                "shopping".to_string()
            } else {
                "parcel".to_string()
            },
            status: map_delivery_status(summary.status).to_string(),
            eta_iso: compute_eta_iso(&summary),
            checkpoints,
            pricing: pricing_view,
            pickup: build_pickup_location(&summary, shopping_order.as_ref()),
            dropoff: build_dropoff_location(&summary),
            client_id: summary.creator_id.to_string(),
            courier: courier_preview,
            recipient: recipient_participant,
            shopping: shopping_view,
            metadata,
            last_event_at,
        })
    }

    /// Enfile immédiatement la livraison dans la file de matching et tente un dispatch express
    async fn enqueue_delivery_matching(&self, summary: &DeliverySummary) -> AppResult<()> {
        let zone_id = Self::extract_zone_from_metadata(&summary.metadata);
        let scheduled_pickup_at = summary
            .metadata
            .get("scheduled_pickup_at")
            .and_then(|value| value.as_str())
            .and_then(|raw| DateTime::parse_from_rfc3339(raw).ok())
            .map(|dt| dt.with_timezone(&Utc));
        let should_delay_matching = scheduled_pickup_at
            .map(|ts| ts > Utc::now() + Duration::minutes(2))
            .unwrap_or(false);
        let dropoff_pending = summary
            .metadata
            .get("dropoff_pending")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let should_delay_matching = should_delay_matching || dropoff_pending;
        let scheduled_pickup_value = scheduled_pickup_at.map(|ts| ts.to_rfc3339());
        let payload = json!({
            "pickup": {
                "lat": summary.pickup.latitude,
                "lng": summary.pickup.longitude,
            },
            "dropoff": {
                "lat": summary.dropoff.latitude,
                "lng": summary.dropoff.longitude,
            },
            "shopping_required": summary.shopping_required,
            "distance_meters": summary.distance_meters,
            "metadata": summary.metadata,
            "scheduled_pickup_at": scheduled_pickup_value,
            "dropoff_pending": dropoff_pending,
        });

        self.repository
            .enqueue_delivery_matching(NewDeliveryMatchingQueueItem {
                delivery_id: summary.id,
                zone_id,
                priority: Self::compute_matching_priority(summary),
                payload: payload.clone(),
                next_attempt_at: scheduled_pickup_at,
            })
            .await?;

        self.repository
            .insert_matching_event(NewDeliveryMatchingEvent {
                delivery_id: summary.id,
                courier_id: None,
                status: DeliveryMatchingStatus::Queued,
                score: None,
                reason: Some(
                    if should_delay_matching {
                        "scheduled_pickup"
                    } else {
                        "auto_enqueue"
                    }
                    .to_string(),
                ),
                metadata: payload,
            })
            .await?;

        if should_delay_matching {
            // Attendre la fenêtre programmée avant de chercher un coursier.
            return Ok(());
        }

        self.attempt_auto_matching(summary, zone_id).await?;
        Ok(())
    }

    /// Essaie de trouver immédiatement un coursier basé sur les snapshots récents
    async fn attempt_auto_matching(
        &self,
        summary: &DeliverySummary,
        zone_id: Option<Uuid>,
    ) -> AppResult<()> {
        let passenger_mode = summary
            .metadata
            .get("requested_delivery_mode")
            .and_then(|mode| mode.as_str())
            .map(|mode| mode.eq_ignore_ascii_case("passenger"))
            .unwrap_or(false);
        let vehicle_type_id = summary
            .metadata
            .get("vehicle_type_id")
            .and_then(|value| value.as_i64());

        let max_distance = if passenger_mode {
            (MATCHING_MAX_DISTANCE_METERS * 0.6).max(1_500.0)
        } else {
            MATCHING_MAX_DISTANCE_METERS
        };

        let candidates = self
            .repository
            .list_matching_candidates(
                summary.pickup.clone(),
                zone_id,
                6,
                Some(max_distance),
                passenger_mode,
            )
            .await?;

        if candidates.is_empty() {
            self.repository
                .update_matching_queue_status(
                    summary.id,
                    DeliveryMatchingStatus::Searching,
                    Some(Utc::now() + Duration::minutes(MATCHING_SEARCH_RETRY_MINUTES)),
                    Some(json!({
                        "reason": "no_candidates",
                        "passenger_mode": passenger_mode,
                        "vehicle_type_id": vehicle_type_id,
                    })),
                    true,
                )
                .await?;
            return Ok(());
        }

        let best = candidates
            .into_iter()
            .map(|candidate| {
                let score = Self::compute_candidate_score(&candidate, passenger_mode);
                (candidate, score)
            })
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(CmpOrdering::Equal));

        let Some((best_candidate, score)) = best else {
            return Ok(());
        };

        self.repository
            .assign_delivery_courier(summary.id, best_candidate.courier_id)
            .await?;

        let queue_metadata = json!({
            "courier_id": best_candidate.courier_id,
            "score": score,
            "distance_meters": best_candidate.distance_meters,
        });

        self.repository
            .update_matching_queue_status(
                summary.id,
                DeliveryMatchingStatus::Assigned,
                None,
                Some(queue_metadata),
                false,
            )
            .await?;

        self.repository
            .insert_matching_event(NewDeliveryMatchingEvent {
                delivery_id: summary.id,
                courier_id: Some(best_candidate.courier_id),
                status: DeliveryMatchingStatus::Assigned,
                score: rust_decimal::Decimal::from_f64(score).map(decimal_to_bigdecimal),
                reason: Some("auto_dispatch".into()),
                metadata: json!({
                    "distance_meters": best_candidate.distance_meters,
                    "load_factor": best_candidate.load_factor,
                    "passenger_mode": passenger_mode,
                    "vehicle_type_id": vehicle_type_id,
                }),
            })
            .await?;

        self.update_delivery_status(
            summary.id,
            DeliveryStatus::AwaitingCourierConfirmation,
            None,
            None,
            Some(json!({
                "matching": {
                    "courier_id": best_candidate.courier_id,
                    "auto": true,
                    "score": score
                }
            })),
        )
        .await?;

        Ok(())
    }

    fn compute_matching_priority(summary: &DeliverySummary) -> i16 {
        summary
            .metadata
            .get("logistics")
            .and_then(|meta| meta.get("priority"))
            .and_then(|value| value.as_i64())
            .map(|value| value.clamp(1, 999) as i16)
            .unwrap_or_else(|| {
                if summary.shopping_required {
                    60
                } else {
                    MATCHING_DEFAULT_PRIORITY
                }
            })
    }

    fn compute_candidate_score(candidate: &CourierMatchingCandidate, passenger_mode: bool) -> f64 {
        let distance = candidate
            .distance_meters
            .unwrap_or(MATCHING_MAX_DISTANCE_METERS * 2.0);
        let distance_ratio = (distance / MATCHING_MAX_DISTANCE_METERS).min(2.0);
        let distance_component = (1.0 - distance_ratio).max(-0.5);

        let load_factor = candidate
            .load_factor
            .to_f64()
            .unwrap_or_default()
            .clamp(0.0, 2.0);
        let load_component = 1.0 - load_factor.min(1.0);

        let available_capacity =
            (candidate.max_capacity - candidate.active_deliveries).max(0) as f64;
        let capacity_component = available_capacity / candidate.max_capacity.max(1) as f64;

        let primary_bonus = if candidate.is_primary { 0.1 } else { 0.0 };
        let weight_bonus = (candidate.capacity_weight as f64) * 0.02;

        let priority_boost = if passenger_mode {
            // Passager : on veut un coursier rapide (distance faible) + capacité poids élevée (voiture/van).
            let distance_bonus = distance_component.max(0.0) * 0.2;
            let capacity_bonus = weight_bonus * 1.5;
            distance_bonus + capacity_bonus
        } else {
            0.0
        };

        distance_component * 0.6
            + load_component * 0.2
            + capacity_component * 0.1
            + primary_bonus
            + weight_bonus
            + priority_boost
    }

    fn extract_zone_from_metadata(metadata: &Value) -> Option<Uuid> {
        metadata
            .get("logistics")
            .and_then(|meta| meta.get("zone_id"))
            .or_else(|| metadata.get("zone_id"))
            .and_then(|value| value.as_str())
            .and_then(|raw| Uuid::parse_str(raw).ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::{get_delivery_metrics_snapshot, reset_delivery_metrics_for_tests};
    use crate::test_utils::{backend_test_db_lock, setup_backend_test_context};
    use tokio::time::{timeout, Duration};

    fn sample_parcel() -> NewDeliveryParcelInput {
        NewDeliveryParcelInput {
            type_id: None,
            weight_kg: None,
            volume_cm3: None,
            declared_value: None,
            notes: Some("Test parcel".to_string()),
            photos: Value::Array(vec![]),
            constraints: Value::Object(Default::default()),
        }
    }

    fn sample_location(label: &str, latitude: f64, longitude: f64) -> LocationInput {
        LocationInput {
            latitude,
            longitude,
            address: Some(label.to_string()),
        }
    }

    async fn create_test_delivery(
        service: Arc<DeliveryService>,
        creator_id: i32,
    ) -> DeliverySummary {
        service
            .create_delivery_request(CreateDeliveryParams {
                creator_id,
                parcel: sample_parcel(),
                pickup: sample_location("Pickup", 4.050_0, 9.700_0),
                dropoff: sample_location("Dropoff", 4.051_0, 9.702_0),
                recipient: None,
                distance_meters: Some(1_500),
                estimated_duration_seconds: Some(900),
                metadata: Value::Object(Default::default()),
                initial_event_payload: Value::Object(Default::default()),
            })
            .await
            .expect("create_delivery_request should succeed")
    }

    #[tokio::test]
    async fn assign_delivery_recipient_formats_phone_and_stores_extras() {
        let _lock = backend_test_db_lock().await;
        reset_delivery_metrics_for_tests();
        let Some(context) = setup_backend_test_context().await else {
            return;
        };
        let service = context.state.delivery_service.clone();

        let delivery = create_test_delivery(service.clone(), context.user_id).await;

        let recipient = DeliveryRecipientInput {
            user_id: None,
            contact_name: Some("Jean Client".into()),
            contact_phone: Some("675123456".into()),
            notes: Some("Buzzer 42".into()),
            chat_thread_id: None,
            dropoff_override: Some(LocationInput {
                latitude: 4.0525,
                longitude: 9.7042,
                address: Some("Entrée latérale".into()),
            }),
            dropoff_address: Some("Immeuble Akwa".into()),
            country_code: None,
            allow_tracking: Some(true),
            allow_contact: Some(true),
            consent_granted: Some(true),
            preferred_language: Some("fr".into()),
        };

        let updated = service
            .assign_delivery_recipient(delivery.id, recipient)
            .await
            .expect("assign_delivery_recipient should succeed");

        assert_eq!(updated.contact_name.as_deref(), Some("Jean Client"));
        assert_eq!(updated.contact_phone.as_deref(), Some("+237675123456"));
        assert_eq!(updated.country_code.as_deref(), Some("CM"));
        assert_eq!(updated.allow_tracking, Some(true));
        assert_eq!(updated.allow_contact, Some(true));
        assert_eq!(updated.consent_granted, Some(true));
        assert_eq!(updated.preferred_language.as_deref(), Some("fr"));

        let metrics = get_delivery_metrics_snapshot();
        assert_eq!(metrics.recipient_dropoff_events, 1);
    }

    #[tokio::test]
    async fn update_recipient_dropoff_broadcasts_event() {
        let _lock = backend_test_db_lock().await;
        reset_delivery_metrics_for_tests();
        let Some(context) = setup_backend_test_context().await else {
            return;
        };
        let service = context.state.delivery_service.clone();
        let manager = context.state.delivery_ws_manager.clone();

        let delivery = create_test_delivery(service.clone(), context.user_id).await;

        // Pré-initialiser un destinataire pour éviter les payloads incomplets
        service
            .assign_delivery_recipient(
                delivery.id,
                DeliveryRecipientInput {
                    user_id: None,
                    contact_name: Some("Client Test".into()),
                    contact_phone: Some("675000000".into()),
                    notes: None,
                    chat_thread_id: None,
                    dropoff_override: None,
                    dropoff_address: None,
                    country_code: Some("CM".into()),
                    allow_tracking: Some(true),
                    allow_contact: Some(true),
                    consent_granted: Some(true),
                    preferred_language: None,
                },
            )
            .await
            .expect("assign_delivery_recipient should succeed");

        let mut subscriber = manager.subscribe(delivery.id).await;

        let _ = service
            .update_recipient_dropoff(
                delivery.id,
                LocationInput {
                    latitude: 4.053,
                    longitude: 9.705,
                    address: Some("Nouvelle adresse".into()),
                },
                Some("Nouvelle adresse".into()),
                Some(context.user_id),
            )
            .await
            .expect("update_recipient_dropoff should succeed");

        let message = timeout(Duration::from_secs(1), subscriber.recv())
            .await
            .expect("Should receive broadcast event")
            .expect("Broadcast channel open");

        match message.event {
            DeliveryWsEvent::RecipientDropoff {
                latitude,
                longitude,
                address,
            } => {
                assert!((latitude - 4.053).abs() < f64::EPSILON);
                assert!((longitude - 9.705).abs() < f64::EPSILON);
                assert_eq!(address.as_deref(), Some("Nouvelle adresse"));
            }
            _ => panic!("Unexpected WS event: {:?}", message.event),
        }

        let metrics = get_delivery_metrics_snapshot();
        assert_eq!(metrics.recipient_dropoff_events, 1);
    }

    #[tokio::test]
    async fn debit_wallet_for_delivery_updates_balance_and_broadcasts() {
        let _lock = backend_test_db_lock().await;
        reset_delivery_metrics_for_tests();
        let Some(context) = setup_backend_test_context().await else {
            return;
        };
        let service = context.state.delivery_service.clone();
        let manager = context.state.delivery_ws_manager.clone();

        let delivery = create_test_delivery(service.clone(), context.user_id).await;

        let initial_balance = service
            .get_wallet_balance(context.user_id)
            .await
            .expect("get_wallet_balance should succeed");
        assert_eq!(initial_balance, 1_000_000);

        let mut subscriber = manager.subscribe(delivery.id).await;

        let debit_amount = 50_000_i64;
        let debit_reason = Some("Test debit".to_string());

        let new_balance = service
            .debit_wallet_for_delivery(
                context.user_id,
                delivery.id,
                debit_amount,
                debit_reason.clone(),
            )
            .await
            .expect("debit_wallet_for_delivery should succeed");

        assert_eq!(new_balance, initial_balance - debit_amount);

        let message = timeout(Duration::from_secs(1), subscriber.recv())
            .await
            .expect("Should receive broadcast event")
            .expect("Broadcast channel open");

        match message.event {
            DeliveryWsEvent::WalletUpdate {
                balance_cents,
                reason,
            } => {
                assert_eq!(balance_cents, new_balance);
                assert_eq!(reason, debit_reason);
            }
            _ => panic!("Unexpected WS event: {:?}", message.event),
        }

        let metrics = get_delivery_metrics_snapshot();
        assert_eq!(metrics.wallet_debit_events, 1_u64);
        assert_eq!(metrics.total_wallet_debit_cents, debit_amount);
        assert_eq!(metrics.wallet_refund_events, 0_u64);
    }

    #[tokio::test]
    async fn refund_wallet_for_delivery_updates_balance_and_broadcasts() {
        let _lock = backend_test_db_lock().await;
        reset_delivery_metrics_for_tests();
        let Some(context) = setup_backend_test_context().await else {
            return;
        };
        let service = context.state.delivery_service.clone();
        let manager = context.state.delivery_ws_manager.clone();

        let delivery = create_test_delivery(service.clone(), context.user_id).await;

        let initial_balance = service
            .get_wallet_balance(context.user_id)
            .await
            .expect("get_wallet_balance should succeed");
        assert_eq!(initial_balance, 1_000_000);

        let mut subscriber = manager.subscribe(delivery.id).await;

        let refund_amount = 20_000_i64;
        let refund_reason = Some("Test refund".to_string());

        let new_balance = service
            .refund_wallet_for_delivery(
                context.user_id,
                delivery.id,
                refund_amount,
                refund_reason.clone(),
            )
            .await
            .expect("refund_wallet_for_delivery should succeed");

        assert_eq!(new_balance, initial_balance + refund_amount);

        let message = timeout(Duration::from_secs(1), subscriber.recv())
            .await
            .expect("Should receive refund broadcast")
            .expect("Broadcast channel open");

        match message.event {
            DeliveryWsEvent::WalletUpdate {
                balance_cents,
                reason,
            } => {
                assert_eq!(balance_cents, new_balance);
                assert_eq!(reason, refund_reason);
            }
            _ => panic!("Unexpected WS event: {:?}", message.event),
        }

        let metrics = get_delivery_metrics_snapshot();
        assert_eq!(metrics.wallet_refund_events, 1_u64);
        assert_eq!(metrics.total_wallet_refund_cents, refund_amount);
        assert_eq!(metrics.wallet_debit_events, 0_u64);
    }
}

impl From<NewDeliveryParcelInput> for crate::services::delivery_repository::NewDeliveryParcel {
    fn from(value: NewDeliveryParcelInput) -> Self {
        Self {
            type_id: value.type_id,
            weight_kg: decimal_opt_to_bigdecimal(value.weight_kg),
            volume_cm3: decimal_opt_to_bigdecimal(value.volume_cm3),
            declared_value: decimal_opt_to_bigdecimal(value.declared_value),
            notes: value.notes,
            photos: value.photos,
            constraints: value.constraints,
        }
    }
}

impl From<LocationInput> for crate::models::delivery_model::GeoPoint {
    fn from(value: LocationInput) -> Self {
        Self {
            latitude: value.latitude,
            longitude: value.longitude,
        }
    }
}

fn build_rejected_courier() -> Courier {
    Courier {
        id: Uuid::nil(),
        user_id: 0,
        application_id: None,
        status: crate::models::delivery_model::DeliveryCourierStatus::Rejected,
        rating_average: decimal_to_bigdecimal(Decimal::ZERO),
        rating_count: 0,
        bio: None,
        hired_at: None,
        suspended_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}
