// ✅ NOUVEAU: Contrôleur pour paiement services spécialisés

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::payment_service::PaymentMethod;
use crate::services::specialized_payment_service::SpecializedPaymentService;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    response::IntoResponse,
    Json,
};
use log::info;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ProcessReservationPaymentRequest {
    pub reservation_id: i32,
    pub amount: f64,
    pub currency: String,
    pub payment_method: PaymentMethod,
    pub description: Option<String>,
}

/// POST /api/specialized-services/reservations/:id/payment
/// Traiter un paiement pour une réservation
pub async fn process_reservation_payment(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
    Json(payload): Json<ProcessReservationPaymentRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[process_reservation_payment] user_id={}, reservation_id={}, amount={}",
        user_id, reservation_id, payload.amount
    );

    let payment_service = SpecializedPaymentService::new(Arc::new(state.pg.clone()));
    let transaction_id = payment_service
        .process_reservation_payment(
            reservation_id,
            user_id,
            payload.amount,
            &payload.currency,
            payload.payment_method,
            payload.description,
        )
        .await?;

    Ok(Json(json!({
        "success": true,
        "transaction_id": transaction_id,
        "message": "Paiement traité avec succès"
    })))
}

/// POST /api/specialized-services/reservations/:id/refund
/// Rembourser un paiement pour une réservation annulée
pub async fn refund_reservation_payment(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let reason = payload.get("reason").and_then(|v| v.as_str()).map(|s| s.to_string());

    // Vérifier que la réservation appartient à l'utilisateur
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM specialized_reservations
            WHERE id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(reservation_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await?;

    if !exists {
        return Err(AppError::NotFound("Réservation non trouvée".to_string()));
    }

    let payment_service = SpecializedPaymentService::new(Arc::new(state.pg.clone()));
    payment_service.refund_reservation_payment(reservation_id, reason).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Remboursement initié"
    })))
}
