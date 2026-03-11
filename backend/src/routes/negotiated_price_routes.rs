use axum::{
    extract::{Extension, Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Row;
use std::sync::Arc;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::negotiated_price_service::{NegotiatedPriceOffer, NegotiatedPriceService};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct CreateNegotiatedPriceRequest {
    conversation_id: String,
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
    conversation_id: String,
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
    // ✅ CORRIGÉ: Vérifier que le service existe
    let service_row = sqlx::query("SELECT user_id FROM services WHERE id = $1")
        .bind(payload.service_id)
        .fetch_optional(&state.pg)
        .await?;

    let service_owner_id: i32 = service_row
        .ok_or_else(|| AppError::NotFound("Service introuvable".into()))?
        .try_get("user_id")?;

    // Récupérer le client de la conversation
    // ✅ FIX 2026-03-11: Le mobile envoie souvent le service_id au lieu du vrai UUID de conversation
    // On essaie d'abord par ID direct, puis par service_id + user_id
    let conversation_row =
        sqlx::query("SELECT id, client_id, prestataire_id FROM conversations WHERE id = $1")
            .bind(&payload.conversation_id)
            .fetch_optional(&state.pg)
            .await?;

    let (real_conversation_id, client_id, prestataire_id) = if let Some(conv_row) = conversation_row
    {
        let cid: String = conv_row.try_get("id")?;
        let cli: i32 = conv_row.try_get("client_id")?;
        let pre: i32 = conv_row.try_get("prestataire_id")?;
        (cid, cli, pre)
    } else {
        // Fallback: le mobile a envoyé le service_id comme conversation_id
        // Chercher la conversation par service_id + participant
        log::warn!(
            "[negotiated_price] conversation_id='{}' non trouvé par UUID, fallback par service_id + user_id={}",
            payload.conversation_id, user.id
        );
        let fallback_row = sqlx::query(
            "SELECT id, client_id, prestataire_id FROM conversations WHERE service_id = $1 AND (client_id = $2 OR prestataire_id = $2) ORDER BY last_message_at DESC NULLS LAST LIMIT 1"
        )
            .bind(payload.service_id)
            .bind(user.id)
            .fetch_optional(&state.pg)
            .await?;

        let conv_row = fallback_row.ok_or_else(|| {
            log::error!(
                "[negotiated_price] Aucune conversation trouvée pour service_id={} user_id={}",
                payload.service_id,
                user.id
            );
            AppError::NotFound("Conversation introuvable pour ce service".into())
        })?;
        let cid: String = conv_row.try_get("id")?;
        let cli: i32 = conv_row.try_get("client_id")?;
        let pre: i32 = conv_row.try_get("prestataire_id")?;
        (cid, cli, pre)
    };

    // ✅ CORRIGÉ: Déterminer qui est le client et qui est le prestataire
    let (merchant_user_id, client_user_id) = if prestataire_id == user.id {
        // L'utilisateur actuel est le prestataire
        (prestataire_id, client_id)
    } else if client_id == user.id {
        // L'utilisateur actuel est le client - il peut créer une offre
        (prestataire_id, client_id)
    } else {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas participant à cette conversation".into(),
        ));
    };

    // ✅ CORRIGÉ: Vérifier que le prestataire correspond au propriétaire du service
    if merchant_user_id != service_owner_id {
        return Err(AppError::BadRequest(
            "Le prestataire de la conversation ne correspond pas au propriétaire du service".into(),
        ));
    }

    let service = NegotiatedPriceService::new(state.pg.clone());
    // ✅ FIX: Utiliser le vrai UUID de conversation (pas le service_id envoyé par le mobile)
    let id = service
        .create_negotiated_price(
            real_conversation_id,
            payload.service_id,
            payload.product_index,
            merchant_user_id,
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
    // ✅ FIX 2026-03-11: Même fallback que create — le mobile envoie le service_id au lieu du UUID
    let conversation_id = params.conversation_id.clone();
    let conversation_row =
        sqlx::query("SELECT id, client_id, prestataire_id FROM conversations WHERE id = $1")
            .bind(&conversation_id)
            .fetch_optional(&state.pg)
            .await?;

    let (real_conversation_id, client_id, prestataire_id) = if let Some(conv_row) = conversation_row
    {
        let cid: String = conv_row.try_get("id")?;
        let cli: i32 = conv_row.try_get("client_id")?;
        let pre: i32 = conv_row.try_get("prestataire_id")?;
        (cid, cli, pre)
    } else {
        log::warn!(
            "[negotiated_price] get_pending: conversation_id='{}' non trouvé, fallback par service_id={} + user_id={}",
            conversation_id, params.service_id, user.id
        );
        let fallback_row = sqlx::query(
            "SELECT id, client_id, prestataire_id FROM conversations WHERE service_id = $1 AND (client_id = $2 OR prestataire_id = $2) ORDER BY last_message_at DESC NULLS LAST LIMIT 1"
        )
            .bind(params.service_id)
            .bind(user.id)
            .fetch_optional(&state.pg)
            .await?;

        match fallback_row {
            Some(conv_row) => {
                let cid: String = conv_row.try_get("id")?;
                let cli: i32 = conv_row.try_get("client_id")?;
                let pre: i32 = conv_row.try_get("prestataire_id")?;
                (cid, cli, pre)
            }
            None => {
                // Pas de conversation = pas d'offre en attente, retourner None
                return Ok(Json(None));
            }
        }
    };

    if prestataire_id != user.id && client_id != user.id {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas participant à cette conversation".into(),
        ));
    }

    // ✅ CORRIGÉ: Le client_user_id est toujours client_id (celui qui n'est pas le prestataire)
    let client_user_id = client_id;

    let service = NegotiatedPriceService::new(state.pg.clone());
    let offer = service
        .get_pending_offer(
            real_conversation_id,
            params.service_id,
            params.product_index,
            client_user_id,
        )
        .await?;

    Ok(Json(offer))
}

/// ✅ NOUVEAU : POST /api/negotiated-prices/{id}/accept
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

/// ✅ NOUVEAU : POST /api/negotiated-prices/{id}/reject
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

/// ✅ NOUVEAU : POST /api/negotiated-prices/{id}/cancel
/// Annule une offre de prix négocié (pour le client)
async fn cancel_offer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(offer_id): Path<i32>,
) -> AppResult<Json<Value>> {
    let service = NegotiatedPriceService::new(state.pg.clone());
    service.cancel_offer(offer_id, user.id).await?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "message": "Offre annulée avec succès"
    })))
}

pub fn negotiated_price_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // ✅ CORRIGÉ 2026-03-02: Ajout préfixe /api/ (le mobile appelle /api/negotiated-prices)
    // ✅ CORRIGÉ 2026-03-02: Ajout middleware JWT (sans ça, Extension<AuthenticatedUser> est vide → erreur)
    let jwt_layer =
        axum::middleware::from_fn_with_state(state.clone(), crate::middlewares::jwt::jwt_auth);

    Router::new()
        .route(
            "/api/negotiated-prices",
            post(create_negotiated_price).layer(jwt_layer.clone()),
        )
        .route(
            "/api/negotiated-prices/pending",
            get(get_pending_offer).layer(jwt_layer.clone()),
        )
        .route(
            "/api/negotiated-prices/{id}/accept",
            post(accept_offer).layer(jwt_layer.clone()),
        )
        .route(
            "/api/negotiated-prices/{id}/reject",
            post(reject_offer).layer(jwt_layer.clone()),
        )
        .route(
            "/api/negotiated-prices/{id}/cancel",
            post(cancel_offer).layer(jwt_layer.clone()),
        )
        .with_state(state)
}
