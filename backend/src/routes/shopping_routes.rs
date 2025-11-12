use std::sync::Arc;

use axum::{
    extract::{Extension, Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    models::delivery_model::{ShoppingItemStatus, ShoppingStatus},
    services::delivery_service::{
        CreateShoppingOrderParams, DeliveryRecipientInput, LocationInput, ShoppingBasketItemInput,
        ShoppingCheckoutInput, ShoppingEstimateInput, ShoppingItemUpdateInput,
        ShoppingStatusUpdateInput, ShoppingStoreInput,
    },
    state::AppState,
};

pub fn shopping_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/shopping/orders/estimate", post(estimate_shopping_order))
        .route("/shopping/orders", post(create_shopping_order))
        .route(
            "/shopping/orders/:order_id/items/:item_id",
            post(update_shopping_item),
        )
        .route(
            "/shopping/orders/:order_id/status",
            post(update_shopping_status),
        )
        .route(
            "/shopping/orders/:order_id/checkout",
            post(submit_shopping_checkout),
        )
        .route("/shopping/wallet/balance", get(get_wallet_balance))
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
struct ShoppingEstimatePayload {
    items: Vec<ShoppingItemPayload>,
    #[serde(default = "default_currency")]
    currency: String,
}

#[derive(Debug, Deserialize)]
struct ShoppingItemPayload {
    #[serde(rename = "product_id")]
    product_id: Option<Uuid>,
    #[serde(rename = "product_name")]
    product_name: String,
    #[serde(default)]
    characteristics: Value,
    quantity: f64,
    #[serde(default = "default_unit")]
    unit: String,
    #[serde(rename = "estimated_price_cents")]
    estimated_price_cents: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct StorePayload {
    name: Option<String>,
    latitude: f64,
    longitude: f64,
    address: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateShoppingPayload {
    items: Vec<ShoppingItemPayload>,
    store: StorePayload,
    dropoff: LocationPayload,
    #[serde(default)]
    recipient: Option<RecipientPayload>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default = "default_currency")]
    currency: String,
    #[serde(default)]
    metadata: Value,
    estimated_total_cents: i32,
    delivery_base_price_cents: i32,
    delivery_distance_price_cents: i32,
    delivery_surcharge_cents: i32,
    delivery_discount_cents: i32,
    #[serde(default)]
    delivery_details: Value,
    #[serde(default)]
    distance_meters: Option<i32>,
    #[serde(default)]
    estimated_duration_seconds: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct RecipientPayload {
    #[serde(default)]
    user_id: Option<i32>,
    #[serde(default)]
    contact_name: Option<String>,
    #[serde(default)]
    contact_phone: Option<String>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    chat_thread_id: Option<Uuid>,
    #[serde(default)]
    dropoff_override: Option<LocationPayload>,
    #[serde(default)]
    dropoff_address: Option<String>,
    #[serde(default)]
    country_code: Option<String>,
    #[serde(default)]
    allow_tracking: Option<bool>,
    #[serde(default)]
    allow_contact: Option<bool>,
    #[serde(default)]
    consent_granted: Option<bool>,
    #[serde(default)]
    preferred_language: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LocationPayload {
    latitude: f64,
    longitude: f64,
    address: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ShoppingItemUpdatePayload {
    status: String,
    #[serde(default)]
    actual_price_cents: Option<i32>,
    #[serde(default)]
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct ShoppingStatusPayload {
    status: String,
}

#[derive(Debug, Deserialize)]
struct ShoppingCheckoutPayload {
    actual_total_cents: i32,
    #[serde(default)]
    payload: Option<Value>,
}

#[derive(Debug, Serialize)]
struct ShoppingEstimateResponse {
    estimate: crate::services::delivery_repository::ShoppingEstimateResult,
}

#[derive(Debug, Serialize)]
struct ShoppingOrderResponse {
    delivery: crate::models::delivery_model::DeliverySummary,
    shopping_order: crate::models::delivery_model::ShoppingOrder,
    items: Vec<crate::models::delivery_model::ShoppingOrderItem>,
    estimated_total_cents: i32,
    margin_cents: i32,
    balance_remaining: i64,
}

async fn estimate_shopping_order(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<ShoppingEstimatePayload>,
) -> AppResult<Json<ShoppingEstimateResponse>> {
    let service = state.delivery_service.clone();
    let result = service
        .estimate_shopping_order(ShoppingEstimateInput {
            items: payload
                .items
                .into_iter()
                .map(ShoppingBasketItemInput::from)
                .collect(),
            currency: payload.currency,
        })
        .await?;

    Ok(Json(ShoppingEstimateResponse { estimate: result }))
}

async fn create_shopping_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateShoppingPayload>,
) -> AppResult<Json<ShoppingOrderResponse>> {
    let service = state.delivery_service.clone();
    let result = service
        .create_shopping_order(CreateShoppingOrderParams {
            creator_id: user.id,
            items: payload
                .items
                .into_iter()
                .map(ShoppingBasketItemInput::from)
                .collect(),
            store: ShoppingStoreInput {
                name: payload.store.name,
                latitude: payload.store.latitude,
                longitude: payload.store.longitude,
                address: payload.store.address,
            },
            dropoff: payload.dropoff.into(),
            recipient: payload.recipient.as_ref().map(DeliveryRecipientInput::from),
            estimated_total_cents: payload.estimated_total_cents,
            currency: payload.currency,
            delivery_base_price_cents: payload.delivery_base_price_cents,
            delivery_distance_price_cents: payload.delivery_distance_price_cents,
            delivery_surcharge_cents: payload.delivery_surcharge_cents,
            delivery_discount_cents: payload.delivery_discount_cents,
            delivery_details: if payload.delivery_details.is_null() {
                Value::Object(Default::default())
            } else {
                payload.delivery_details
            },
            distance_meters: payload.distance_meters,
            estimated_duration_seconds: payload.estimated_duration_seconds,
            notes: payload.notes,
            metadata: payload.metadata,
        })
        .await?;

    Ok(Json(ShoppingOrderResponse {
        delivery: result.delivery,
        shopping_order: result.shopping_order,
        items: result.items,
        estimated_total_cents: result.estimated_total_cents,
        margin_cents: result.margin_cents,
        balance_remaining: result.balance_remaining,
    }))
}

async fn get_wallet_balance(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    let service = state.delivery_service.clone();
    let balance = service.get_wallet_balance(user.id).await?;
    Ok(Json(json!({ "balance": balance })))
}

async fn update_shopping_item(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((order_id, item_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ShoppingItemUpdatePayload>,
) -> AppResult<Json<Value>> {
    let service = state.delivery_service.clone();
    let status = serde_json::from_str::<ShoppingItemStatus>(&format!("\"{}\"", payload.status))
        .map_err(|_| AppError::BadRequest("Statut article invalide".into()))?;

    service
        .update_shopping_item(
            user.id,
            ShoppingItemUpdateInput {
                order_id,
                item_id,
                status,
                actual_price_cents: payload.actual_price_cents,
                metadata: payload.metadata,
            },
        )
        .await?;

    Ok(Json(json!({ "status": "ok" })))
}

async fn update_shopping_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<ShoppingStatusPayload>,
) -> AppResult<Json<Value>> {
    let service = state.delivery_service.clone();
    let status = serde_json::from_str::<ShoppingStatus>(&format!("\"{}\"", payload.status))
        .map_err(|_| AppError::BadRequest("Statut commande invalide".into()))?;

    service
        .update_shopping_status(user.id, ShoppingStatusUpdateInput { order_id, status })
        .await?;

    Ok(Json(json!({ "status": "ok" })))
}

async fn submit_shopping_checkout(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<ShoppingCheckoutPayload>,
) -> AppResult<Json<Value>> {
    let service = state.delivery_service.clone();
    let pricing = service
        .submit_shopping_checkout(
            user.id,
            ShoppingCheckoutInput {
                order_id,
                actual_total_cents: payload.actual_total_cents,
                payload: payload.payload,
            },
        )
        .await?;

    Ok(Json(json!({
        "status": "ok",
        "pricing": {
            "base_price_cents": pricing.base_price_cents,
            "distance_price_cents": pricing.distance_price_cents,
            "surcharge_cents": pricing.surcharge_cents,
            "discount_cents": pricing.discount_cents,
            "shopping_cost_cents": pricing.shopping_cost_cents,
            "shopping_discount_cents": pricing.shopping_discount_cents,
            "currency": pricing.currency
        }
    })))
}

fn default_unit() -> String {
    "unite".to_string()
}

fn default_currency() -> String {
    "XAF".to_string()
}

impl From<ShoppingItemPayload> for ShoppingBasketItemInput {
    fn from(value: ShoppingItemPayload) -> Self {
        ShoppingBasketItemInput {
            product_id: value.product_id,
            product_name: value.product_name,
            characteristics: if value.characteristics.is_null() {
                Value::Array(vec![])
            } else {
                value.characteristics
            },
            quantity: value.quantity,
            unit: value.unit,
            estimated_price_cents: value.estimated_price_cents,
        }
    }
}

impl From<LocationPayload> for LocationInput {
    fn from(value: LocationPayload) -> Self {
        LocationInput {
            latitude: value.latitude,
            longitude: value.longitude,
            address: value.address,
        }
    }
}

impl From<&RecipientPayload> for DeliveryRecipientInput {
    fn from(value: &RecipientPayload) -> Self {
        DeliveryRecipientInput {
            user_id: value.user_id,
            contact_name: value.contact_name.clone(),
            contact_phone: value.contact_phone.clone(),
            notes: value.notes.clone(),
            chat_thread_id: value.chat_thread_id,
            dropoff_override: value.dropoff_override.as_ref().map(|loc| LocationInput {
                latitude: loc.latitude,
                longitude: loc.longitude,
                address: loc.address.clone(),
            }),
            dropoff_address: value.dropoff_address.clone(),
            country_code: value.country_code.clone(),
            allow_tracking: value.allow_tracking,
            allow_contact: value.allow_contact,
            consent_granted: value.consent_granted,
            preferred_language: value.preferred_language.clone(),
        }
    }
}
