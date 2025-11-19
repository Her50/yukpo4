use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::negotiated_price_service::{NegotiatedPriceService, NegotiatedPriceOffer};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct CreateNegotiatedPriceRequest {
    conversation_id: i32,
    service_id: i32,
    product_index: Option<i32>,
    original_price_cents: i64,
    negotiated_price_cents: i64,
    expires_in_hours: Option<i32>,
}

#[derive(Debug, Serialize)]
struct CreateNegotiatedPriceResponse {
    id: i32,
    message: String,
}

#[derive(Debug, Deserialize)]
struct GetPendingOfferQuery {
    conversation_id: i32,
    service_id: i32,
    product_index: Option<i32>,
}

/// ✅ NOUVEAU : POST /api/negotiated-prices
/// Crée une offre de prix négocié
async fn create_negotiated_price(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateNegotiatedPriceRequest>,
) -> AppResult<Json<CreateNegotiatedPriceResponse>> {
    // Vérifier que l'utilisateur est le prestataire du service
    let service = sqlx::query!(
        "SELECT creator_id FROM services WHERE id = $1",
        payload.service_id
    )
    .fetch_optional(&state.pg)
    .await?;

    let service_row = service.ok_or_else(|| AppError::NotFound("Service introuvable".into()))?;
    
    if service_row.creator_id != user.id {
        return Err(AppError::Forbidden(
            "Seul le prestataire peut créer une offre de prix négocié".into(),
        ));
    }

    // Récupérer le client de la conversation
    let conversation = sqlx::query!(
        "SELECT user1_id, user2_id FROM conversations WHERE id = $1",
        payload.conversation_id
    )
    .fetch_optional(&state.pg)
    .await?;

    let conv = conversation.ok_or_else(|| AppError::NotFound("Conversation introuvable".into()))?;
    
    let client_user_id = if conv.user1_id == user.id {
        conv.user2_id
    } else if conv.user2_id == user.id {
        conv.user1_id
    } else {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas participant à cette conversation".into(),
        ));
    };

    let service = NegotiatedPriceService::new(state.pg.clone());
    let id = service
        .create_negotiated_price(
            payload.conversation_id,
            payload.service_id,
            payload.product_index,
            user.id,
            client_user_id,
            payload.original_price_cents,
            payload.negotiated_price_cents,
            payload.expires_in_hours,
        )
        .await?;

    Ok(Json(CreateNegotiatedPriceResponse {
        id,
        message: "Offre de prix négocié créée avec succès".to_string(),
    }))
}

/// ✅ NOUVEAU : GET /api/negotiated-prices/pending
/// Récupère l'offre en attente pour une conversation/service/produit
async fn get_pending_offer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<GetPendingOfferQuery>,
) -> AppResult<Json<Option<NegotiatedPriceOffer>>> {
    // Vérifier que l'utilisateur participe à la conversation
    let conversation = sqlx::query!(
        "SELECT user1_id, user2_id FROM conversations WHERE id = $1",
        params.conversation_id
    )
    .fetch_optional(&state.pg)
    .await?;

    let conv = conversation.ok_or_else(|| AppError::NotFound("Conversation introuvable".into()))?;
    
    if conv.user1_id != user.id && conv.user2_id != user.id {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas participant à cette conversation".into(),
        ));
    }

    let client_user_id = if conv.user1_id == user.id {
        conv.user2_id
    } else {
        conv.user1_id
    };

    let service = NegotiatedPriceService::new(state.pg.clone());
    let offer = service
        .get_pending_offer(
            params.conversation_id,
            params.service_id,
            params.product_index,
            client_user_id,
        )
        .await?;

    Ok(Json(offer))
}

/// ✅ NOUVEAU : POST /api/negotiated-prices/:id/accept
/// Accepte une offre de prix négocié
async fn accept_offer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(offer_id): Path<i32>,
) -> AppResult<Json<Value>> {
    let service = NegotiatedPriceService::new(state.pg.clone());
    service.accept_offer(offer_id, user.id).await?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "message": "Offre acceptée avec succès"
    })))
}

/// ✅ NOUVEAU : POST /api/negotiated-prices/:id/reject
/// Rejette une offre de prix négocié
async fn reject_offer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(offer_id): Path<i32>,
) -> AppResult<Json<Value>> {
    let service = NegotiatedPriceService::new(state.pg.clone());
    service.reject_offer(offer_id, user.id).await?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "message": "Offre rejetée"
    })))
}

pub fn negotiated_price_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/negotiated-prices", post(create_negotiated_price))
        .route("/negotiated-prices/pending", get(get_pending_offer))
        .route("/negotiated-prices/:id/accept", post(accept_offer))
        .route("/negotiated-prices/:id/reject", post(reject_offer))
        .with_state(state)
}

