// ✅ NOUVEAU: Contrôleur pour réservations services spécialisés

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::specialized_reservation_service::SpecializedReservationService;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CreateReservationRequest {
    pub service_id: i32,
    pub service_type: String, // "hopital", "laboratoire", "covoiturage", "taxi", "agence_voyage"
    pub reservation_type: String, // "rdv", "place", "course", "ticket"
    pub requested_date: Option<DateTime<Utc>>,
    pub details: serde_json::Value,
    pub amount: Option<rust_decimal::Decimal>,
    pub currency: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReservationResponse {
    pub reservation: crate::models::specialized_reservation::SpecializedReservation,
    pub payment_required: bool,
    pub payment_url: Option<String>, // URL pour rediriger vers paiement si nécessaire
}

/// POST /api/specialized-services/reservations
/// Créer une réservation
pub async fn create_reservation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateReservationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_reservation] user_id={}, service_id={}, type={}",
        user_id, payload.service_id, payload.service_type
    );

    // Récupérer le prestataire_id depuis le service
    let prestataire_id: i32 = sqlx::query_scalar(
        r#"
        SELECT user_id FROM services
        WHERE id = $1 AND specialized_type = $2
        "#,
    )
    .bind(payload.service_id)
    .bind(&payload.service_type)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::NotFound("Service non trouvé".to_string()))?;

    let reservation_service = SpecializedReservationService::new(Arc::new(state.pg.clone()));

    let reservation = reservation_service
        .create_reservation(
            payload.service_id,
            &payload.service_type,
            user_id,
            prestataire_id,
            &payload.reservation_type,
            payload.requested_date,
            payload.details,
            payload.amount,
            payload.currency,
        )
        .await?;

    // Si paiement requis, générer URL de paiement
    let payment_required = reservation.amount.is_some();
    let payment_url = if payment_required {
        // TODO: Intégrer avec le système de paiement existant
        Some(format!(
            "/payment/checkout?reservation_id={}",
            reservation.id
        ))
    } else {
        None
    };

    Ok((
        StatusCode::CREATED,
        Json(ReservationResponse {
            reservation,
            payment_required,
            payment_url,
        }),
    ))
}

/// GET /api/specialized-services/reservations
/// Lister les réservations de l'utilisateur
pub async fn list_user_reservations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    let status_filter = params.get("status").map(|s| s.as_str());

    let reservation_service = SpecializedReservationService::new(Arc::new(state.pg.clone()));
    let reservations = reservation_service.list_user_reservations(user_id, status_filter).await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "reservations": reservations })),
    ))
}

/// GET /api/specialized-services/reservations/prestataire
/// Lister les réservations d'un prestataire
pub async fn list_prestataire_reservations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: prestataire_id, ..
    }): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    let status_filter = params.get("status").map(|s| s.as_str());

    let reservation_service = SpecializedReservationService::new(Arc::new(state.pg.clone()));
    let reservations = reservation_service
        .list_prestataire_reservations(prestataire_id, status_filter)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "reservations": reservations })),
    ))
}

/// PATCH /api/specialized-services/reservations/:id/confirm
/// Confirmer une réservation (prestataire)
pub async fn confirm_reservation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: prestataire_id, ..
    }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let confirmed_date = payload
        .get("confirmed_date")
        .and_then(|v| v.as_str())
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let reservation_service = SpecializedReservationService::new(Arc::new(state.pg.clone()));
    let reservation = reservation_service
        .confirm_reservation(reservation_id, prestataire_id, confirmed_date)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "reservation": reservation })),
    ))
}

/// PATCH /api/specialized-services/reservations/:id/cancel
/// Annuler une réservation (client)
pub async fn cancel_reservation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let reason = payload.get("reason").and_then(|v| v.as_str()).map(|s| s.to_string());

    let reservation_service = SpecializedReservationService::new(Arc::new(state.pg.clone()));
    let reservation =
        reservation_service.cancel_reservation(reservation_id, user_id, reason).await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "reservation": reservation })),
    ))
}
