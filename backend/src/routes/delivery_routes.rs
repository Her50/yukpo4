use std::sync::Arc;

use axum::middleware;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, Path, Query, State,
    },
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use futures::{SinkExt, StreamExt};
use rust_decimal::{prelude::FromPrimitive, Decimal};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    services::delivery_service::{
        CourierApplicationInput, CourierAssetInput, CreateDeliveryParams, DeliveryRecipientInput,
        DeliveryService, LocationInput, NewDeliveryParcelInput, PricingInput,
        PublicDropoffSnapshot, TrackingInput,
    },
    state::AppState,
    websocket::delivery_tracking::DeliveryTrackingManager,
};

#[derive(Deserialize)]
struct CreateDeliveryPayload {
    parcel: ParcelPayload,
    pickup: LocationPayload,
    dropoff: LocationPayload,
    distance_meters: Option<i32>,
    estimated_duration_seconds: Option<i32>,
    metadata: Value,
    initial_event_payload: Value,
    #[serde(default)]
    recipient: Option<RecipientPayload>,
}

#[derive(Deserialize)]
struct ParcelPayload {
    type_id: Option<i32>,
    weight_kg: Option<f64>,
    volume_cm3: Option<f64>,
    declared_value: Option<f64>,
    notes: Option<String>,
    photos: Value,
    constraints: Value,
}

#[derive(Deserialize)]
struct LocationPayload {
    latitude: f64,
    longitude: f64,
    address: Option<String>,
}

#[derive(Deserialize)]
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

#[derive(Deserialize)]
struct PublicDropoffPayload {
    latitude: f64,
    longitude: f64,
    address: Option<String>,
    instructions: Option<String>,
}

#[derive(Serialize)]
struct PublicDropoffResponse<T> {
    data: T,
}

pub fn delivery_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/delivery/parcel-types", get(list_parcel_types))
        .route("/delivery", post(create_delivery))
        .route("/delivery/{id}", get(get_delivery_summary))
        .route("/delivery/{id}/status", post(update_delivery_status))
        .route("/delivery/{id}/pricing", post(upsert_pricing))
        .route("/delivery/{id}/tracking", post(add_tracking_point))
        .route("/delivery/{id}/rate-courier", post(rate_courier))
        .route("/delivery/{id}/rate-client", post(rate_client))
        .route("/delivery/{id}/ws", get(delivery_tracking_ws))
        .route(
            "/delivery/{id}/recipient",
            get(get_delivery_recipient).post(assign_delivery_recipient),
        )
        .route(
            "/delivery/{id}/recipient/location",
            post(update_recipient_location),
        )
        .route("/delivery/{id}/share-dropoff", post(share_dropoff_link))
        .route("/deliveries/active", get(list_frontend_deliveries))
        .route("/deliveries/{id}", get(get_frontend_delivery))
        .route(
            "/deliveries/{id}/recipient/updates",
            get(get_frontend_recipient_updates),
        )
        .route("/wallet/debit", post(debit_wallet_for_delivery))
        .route("/wallet/refund", post(refund_wallet_for_delivery))
        .route("/courier/applications", post(submit_courier_application))
        .route("/courier/{id}/assets", post(upsert_courier_asset))
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}

pub fn delivery_public_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/delivery/public/{token}", get(get_public_dropoff_snapshot))
        .route(
            "/delivery/public/{token}/dropoff",
            post(submit_public_dropoff),
        )
        .with_state(state)
}

async fn list_parcel_types(State(state): State<Arc<AppState>>) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let types = service.list_parcel_types().await?;
    Ok(Json(serde_json::json!({ "parcel_types": types })))
}

async fn create_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateDeliveryPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;

    let params = CreateDeliveryParams {
        creator_id: user.id,
        parcel: NewDeliveryParcelInput {
            type_id: payload.parcel.type_id,
            weight_kg: payload.parcel.weight_kg.map(dec),
            volume_cm3: payload.parcel.volume_cm3.map(dec),
            declared_value: payload.parcel.declared_value.map(dec),
            notes: payload.parcel.notes,
            photos: payload.parcel.photos,
            constraints: payload.parcel.constraints,
        },
        pickup: LocationInput {
            latitude: payload.pickup.latitude,
            longitude: payload.pickup.longitude,
            address: payload.pickup.address,
        },
        dropoff: LocationInput {
            latitude: payload.dropoff.latitude,
            longitude: payload.dropoff.longitude,
            address: payload.dropoff.address,
        },
        recipient: payload.recipient.as_ref().map(DeliveryRecipientInput::from),
        distance_meters: payload.distance_meters,
        estimated_duration_seconds: payload.estimated_duration_seconds,
        metadata: payload.metadata,
        initial_event_payload: payload.initial_event_payload,
    };

    let summary = service.create_delivery_request(params).await?;
    Ok(Json(serde_json::json!({ "delivery": summary })))
}

async fn assign_delivery_recipient(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<RecipientPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    let recipient = DeliveryRecipientInput::from(&payload);
    let updated = service
        .assign_delivery_recipient(delivery_id, recipient)
        .await?;

    Ok(Json(json!({ "recipient": updated })))
}

async fn get_delivery_recipient(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    Ok(Json(json!({ "recipient": summary.recipient })))
}

#[derive(Deserialize)]
struct RecipientLocationPayload {
    latitude: f64,
    longitude: f64,
    address: Option<String>,
}

#[derive(Deserialize)]
struct WalletMutationPayload {
    delivery_id: Uuid,
    amount_cents: i64,
    #[serde(default)]
    currency: Option<String>,
    #[serde(default)]
    reason: Option<String>,
}

#[derive(Deserialize)]
struct RecipientUpdatesQuery {
    #[serde(default)]
    limit: Option<i64>,
}

async fn update_recipient_location(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<RecipientLocationPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    let updated = service
        .update_recipient_dropoff(
            delivery_id,
            LocationInput {
                latitude: payload.latitude,
                longitude: payload.longitude,
                address: payload.address.clone(),
            },
            payload.address,
            Some(user.id),
        )
        .await?;

    Ok(Json(json!({ "recipient": updated })))
}

async fn share_dropoff_link(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let info = service.share_dropoff_link(delivery_id, user.id).await?;

    Ok(Json(json!({
        "tracking_token": info.tracking_token,
        "share_url": info.share_url,
        "dropoff_pending": info.dropoff_pending,
    })))
}

async fn list_frontend_deliveries(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let deliveries = service
        .list_user_active_deliveries_frontend(user.id)
        .await?;
    Ok(Json(json!({ "deliveries": deliveries })))
}

async fn get_frontend_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let delivery = service
        .get_frontend_delivery_summary(delivery_id, user.id)
        .await?;
    Ok(Json(json!({ "delivery": delivery })))
}

async fn get_frontend_recipient_updates(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Query(query): Query<RecipientUpdatesQuery>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let updates = service
        .list_frontend_recipient_updates(delivery_id, user.id, limit)
        .await?;
    Ok(Json(json!({ "updates": updates })))
}

async fn debit_wallet_for_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<WalletMutationPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let currency = payload.currency.as_deref().unwrap_or("XAF");
    if currency != "XAF" {
        return Err(AppError::BadRequest(
            "Devise non supportée pour les opérations de portefeuille.".into(),
        ));
    }
    let balance = service
        .debit_wallet_for_delivery(
            user.id,
            payload.delivery_id,
            payload.amount_cents,
            payload.reason,
        )
        .await?;
    Ok(Json(json!({ "balance": balance })))
}

async fn refund_wallet_for_delivery(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<WalletMutationPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let currency = payload.currency.as_deref().unwrap_or("XAF");
    if currency != "XAF" {
        return Err(AppError::BadRequest(
            "Devise non supportée pour les opérations de portefeuille.".into(),
        ));
    }
    let balance = service
        .refund_wallet_for_delivery(
            user.id,
            payload.delivery_id,
            payload.amount_cents,
            payload.reason,
        )
        .await?;
    Ok(Json(json!({ "balance": balance })))
}

async fn get_public_dropoff_snapshot(
    State(state): State<Arc<AppState>>,
    Path(token): Path<Uuid>,
) -> AppResult<Json<PublicDropoffResponse<PublicDropoffSnapshot>>> {
    let service = delivery_service(&state)?;
    let snapshot = service.get_public_dropoff_snapshot(token).await?;
    Ok(Json(PublicDropoffResponse { data: snapshot }))
}

async fn submit_public_dropoff(
    State(state): State<Arc<AppState>>,
    Path(token): Path<Uuid>,
    Json(payload): Json<PublicDropoffPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let point = LocationInput {
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address.clone(),
    };
    let summary = service
        .submit_public_dropoff(
            token,
            point,
            payload.address.clone(),
            payload.instructions.clone(),
        )
        .await?;
    Ok(Json(json!({ "delivery_id": summary.id })))
}

#[derive(Deserialize)]
struct UpdateStatusPayload {
    status: String,
    cancel_reason: Option<String>,
    payload: Option<Value>,
}

async fn update_delivery_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<UpdateStatusPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let status =
        serde_json::from_str::<crate::models::delivery_model::DeliveryStatus>(&payload.status)
            .map_err(|_| AppError::BadRequest("Statut invalide".into()))?;

    let cancel_reason = if let Some(reason) = &payload.cancel_reason {
        Some(
            serde_json::from_str::<crate::models::delivery_model::DeliveryCancelReason>(reason)
                .map_err(|_| AppError::BadRequest("Motif d'annulation invalide".into()))?,
        )
    } else {
        None
    };

    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    service
        .update_delivery_status(
            delivery_id,
            status,
            cancel_reason,
            Some(user.id),
            payload.payload,
        )
        .await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Deserialize)]
struct PricingPayload {
    base_price_cents: i32,
    distance_price_cents: i32,
    surcharge_cents: i32,
    discount_cents: i32,
    currency: String,
    details: Value,
    #[serde(default)]
    shopping_cost_cents: i32,
    #[serde(default)]
    shopping_discount_cents: i32,
}

async fn upsert_pricing(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<PricingPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;

    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;

    service
        .upsert_pricing(PricingInput {
            delivery_id,
            base_price_cents: payload.base_price_cents,
            distance_price_cents: payload.distance_price_cents,
            surcharge_cents: payload.surcharge_cents,
            discount_cents: payload.discount_cents,
            currency: payload.currency,
            details: payload.details,
            shopping_cost_cents: payload.shopping_cost_cents,
            shopping_discount_cents: payload.shopping_discount_cents,
        })
        .await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Deserialize)]
struct TrackingPayload {
    latitude: f64,
    longitude: f64,
    captured_at: DateTimeWrapper,
    speed_kmh: Option<f64>,
    bearing: Option<f64>,
    accuracy_meters: Option<f64>,
}

#[derive(Deserialize)]
struct DateTimeWrapper(#[serde(with = "chrono::serde::ts_seconds")] DateTime<Utc>);

async fn add_tracking_point(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<TrackingPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;

    let summary = service.get_delivery_summary(delivery_id).await?;
    let courier = service
        .repository()
        .find_courier_by_user(user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Coursier introuvable pour cet utilisateur".into()))?;

    if summary.courier_id != Some(courier.id) {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le coursier assigné à cette livraison".into(),
        ));
    }

    service
        .record_tracking_point(TrackingInput {
            delivery_id,
            courier_id: courier.id,
            latitude: payload.latitude,
            longitude: payload.longitude,
            captured_at: payload.captured_at.0,
            speed_kmh: payload.speed_kmh.map(dec),
            bearing: payload.bearing.map(dec),
            accuracy_meters: payload.accuracy_meters.map(dec),
        })
        .await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Deserialize)]
struct RatingPayload {
    score_small: i32,
    tags: Option<Vec<String>>,
    comment: Option<String>,
}

async fn rate_courier(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<RatingPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let delivery = service.get_delivery_summary(delivery_id).await?;

    if delivery.creator_id != user.id {
        return Err(AppError::Forbidden(
            "Vous ne pouvez noter que vos propres livraisons".into(),
        ));
    }

    let courier_id = delivery
        .courier_id
        .ok_or_else(|| AppError::BadRequest("Aucun coursier affecté".into()))?;

    service
        .rate_courier(
            delivery_id,
            user.id,
            courier_id,
            payload.score_small,
            payload.tags,
            payload.comment,
        )
        .await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn rate_client(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<RatingPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let delivery = service.get_delivery_summary(delivery_id).await?;

    let courier_id = delivery
        .courier_id
        .ok_or_else(|| AppError::BadRequest("Aucun coursier affecté".into()))?;

    service
        .rate_client(
            delivery_id,
            user.id,
            delivery.creator_id,
            courier_id,
            payload.score_small,
            payload.tags,
            payload.comment,
        )
        .await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Deserialize)]
struct CourierApplicationPayload {
    profile_data: Value,
    documents: Value,
    submitted: bool,
}

async fn submit_courier_application(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CourierApplicationPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let application = service
        .submit_courier_application(CourierApplicationInput {
            user_id: user.id,
            profile_data: payload.profile_data,
            documents: payload.documents,
            submitted: payload.submitted,
        })
        .await?;

    Ok(Json(serde_json::json!({ "application": application })))
}

#[derive(Deserialize)]
struct CourierAssetPayload {
    engine_type: crate::models::delivery_model::DeliveryEngineType,
    max_weight_kg: Option<f64>,
    max_volume_cm3: Option<f64>,
    equipments: Value,
    available: bool,
    availability_schedule: Option<Value>,
    documents: Option<Value>,
}

async fn upsert_courier_asset(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(courier_id): Path<Uuid>,
    Json(payload): Json<CourierAssetPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;

    let courier = service
        .repository()
        .find_courier_by_user(user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Coursier introuvable pour cet utilisateur".into()))?;

    if courier.id != courier_id {
        return Err(AppError::Forbidden(
            "Vous ne pouvez modifier que vos propres équipements".into(),
        ));
    }

    let asset = service
        .upsert_courier_asset(CourierAssetInput {
            courier_id,
            engine_type: payload.engine_type,
            max_weight_kg: payload.max_weight_kg.map(dec),
            max_volume_cm3: payload.max_volume_cm3.map(dec),
            equipments: payload.equipments,
            available: payload.available,
            availability_schedule: payload.availability_schedule,
            documents: payload.documents,
        })
        .await?;

    Ok(Json(serde_json::json!({ "asset": asset })))
}

async fn get_delivery_summary(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;

    if summary.creator_id != user.id {
        let courier = service.repository().find_courier_by_user(user.id).await?;
        let courier_id = courier.map(|c| c.id);
        if courier_id != summary.courier_id {
            return Err(AppError::Forbidden(
                "Accès réservé au client ou au coursier assigné".into(),
            ));
        }
    }

    Ok(Json(serde_json::json!({ "delivery": summary })))
}

async fn delivery_tracking_ws(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    ws: WebSocketUpgrade,
) -> AppResult<impl IntoResponse> {
    let service = delivery_service(&state)?;
    let summary = service.get_delivery_summary(delivery_id).await?;
    enforce_delivery_access(&service, &summary, user.id).await?;
    let manager = state.delivery_ws_manager.clone();

    Ok(ws.on_upgrade(move |socket| async move {
        handle_delivery_tracking_ws(socket, delivery_id, user.id, manager).await;
    }))
}

async fn handle_delivery_tracking_ws(
    socket: WebSocket,
    delivery_id: Uuid,
    user_id: i32,
    manager: Arc<DeliveryTrackingManager>,
) {
    let (mut sender, mut receiver) = socket.split();
    let mut subscription = manager.subscribe(delivery_id).await;

    let connected = serde_json::json!({
        "event": "connected",
        "delivery_id": delivery_id,
        "user_id": user_id,
        "timestamp": Utc::now()
    });

    if sender
        .send(Message::Text(connected.to_string().into()))
        .await
        .is_err()
    {
        manager.cleanup(delivery_id).await;
        return;
    }

    let mut forward_task = tokio::spawn(async move {
        while let Ok(message) = subscription.recv().await {
            match serde_json::to_string(&message) {
                Ok(payload) => {
                    if sender.send(Message::Text(payload.into())).await.is_err() {
                        break;
                    }
                }
                Err(err) => {
                    log::error!(
                        "[DeliveryWS] Erreur sérialisation message livraison {}: {}",
                        message.delivery_id,
                        err
                    );
                }
            }
        }
    });

    let mut receive_task = tokio::spawn(async move {
        while let Some(Ok(message)) = receiver.next().await {
            match message {
                Message::Text(text) => {
                    if text.eq_ignore_ascii_case("ping") {
                        continue;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = (&mut forward_task) => (),
        _ = (&mut receive_task) => (),
    }

    manager.cleanup(delivery_id).await;
    log::info!(
        "[DeliveryWS] Connexion fermée pour utilisateur {} (livraison {})",
        user_id,
        delivery_id
    );
}

impl From<LocationPayload> for LocationInput {
    fn from(value: LocationPayload) -> Self {
        Self {
            latitude: value.latitude,
            longitude: value.longitude,
            address: value.address,
        }
    }
}

impl From<&RecipientPayload> for DeliveryRecipientInput {
    fn from(value: &RecipientPayload) -> Self {
        Self {
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

fn delivery_service(state: &AppState) -> AppResult<Arc<DeliveryService>> {
    Ok(state.delivery_service.clone())
}

async fn enforce_delivery_access(
    service: &DeliveryService,
    summary: &crate::models::delivery_model::DeliverySummary,
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

    let courier = service.repository().find_courier_by_user(user_id).await?;
    let courier_id = courier.map(|c| c.id);
    if courier_id == summary.courier_id {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "Accès réservé au client ou au coursier assigné".into(),
        ))
    }
}

fn dec(value: f64) -> Decimal {
    Decimal::from_f64(value).unwrap_or(Decimal::ZERO)
}
