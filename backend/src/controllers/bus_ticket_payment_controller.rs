// Contrôleur pour le paiement complet des tickets bus avec commission
// Gère la création du paiement, calcul de commission, reversement et génération PDF

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

// ============================================================================
// STRUCTURES DE REQUÊTE/RÉPONSE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ProcessTicketPaymentRequest {
    pub product_id: String,
    pub reservation_ids: Vec<String>, // IDs des réservations à payer
    pub ticket_price: i32,
    pub number_of_tickets: i32,
    pub booking_fee: Option<i32>, // Optionnel, défaut 500
    pub currency: Option<String>, // Optionnel, défaut XAF
    // ✅ NOUVEAU: Informations retour pour tickets aller-retour
    pub return_date: Option<String>, // Date de retour (format DD/MM/YYYY)
    pub return_time: Option<String>, // Heure de retour (format HH:MM)
    pub is_round_trip: Option<bool>, // Indique si c'est un aller-retour
}

#[derive(Debug, Serialize)]
pub struct TicketPaymentResponse {
    pub success: bool,
    pub payment_id: Option<String>,
    pub subtotal: Option<i32>,
    pub yukpo_commission: Option<i32>,
    pub agency_payout: Option<i32>,
    pub total_amount: Option<i32>,
    pub booking_fee: Option<i32>,
    pub payout_status: Option<String>,
    pub ticket_pdf_url: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserTicket {
    pub payment_id: String,
    pub product_id: String,
    pub product_name: String,
    pub bus_number: Option<String>,
    pub departure_city: String,
    pub arrival_city: String,
    pub departure_date: String,
    pub departure_time: String,
    // ✅ NOUVEAU: Informations retour
    pub return_date: Option<String>,
    pub return_time: Option<String>,
    pub is_round_trip: Option<bool>,
    pub ticket_price: i32,
    pub number_of_tickets: i32,
    pub total_amount: i32,
    pub currency: String,
    pub payment_status: String,
    pub ticket_pdf_url: Option<String>,
    pub reservation_ids: Vec<String>,
    pub created_at: String,
}

// ============================================================================
// TRAITER PAIEMENT COMPLET
// ============================================================================

/// Traiter le paiement complet d'un ticket bus avec commission
pub async fn process_ticket_payment(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<ProcessTicketPaymentRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[process_ticket_payment] User ID: {}, Product ID: {}, Tickets: {}",
        user_id, payload.product_id, payload.number_of_tickets
    );

    // Vérifier que le produit existe et récupérer les informations
    let product_row = sqlx::query(
        r#"
        SELECT 
            p.id,
            p.name,
            p.service_id,
            p.numero_bus,
            p.metadata,
            s.user_id as agency_user_id
        FROM products p
        JOIN services s ON s.id = p.service_id
        WHERE p.id::text = $1
            AND p.type = 'ticket_voyage'
        "#
    )
    .bind(&payload.product_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[process_ticket_payment] Erreur récupération produit: {}", e);
        AppError::Internal(format!("Erreur récupération produit: {}", e))
    })?;

    let (_product_name, agency_user_id, bus_number, metadata) = match product_row {
        Some(row) => (
            row.try_get::<String, _>("name").unwrap_or_default(),
            row.try_get::<i32, _>("agency_user_id").unwrap_or(0),
            row.try_get::<Option<String>, _>("numero_bus").ok().flatten(),
            row.try_get::<Option<Value>, _>("metadata").ok().flatten().unwrap_or(json!({})),
        ),
        None => {
            return Err(AppError::NotFound("Produit non trouvé".to_string()));
        }
    };

    if agency_user_id == 0 {
        return Err(AppError::Internal("Agence non trouvée pour ce produit".to_string()));
    }

    // Vérifier que les réservations existent et appartiennent à l'utilisateur
    let reservations_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM bus_reservations
        WHERE id = ANY($1)
            AND user_id = $2
            AND status IN ('pending', 'confirmed')
        "#
    )
    .bind(&payload.reservation_ids)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[process_ticket_payment] Erreur vérification réservations: {}", e);
        AppError::Internal(format!("Erreur vérification réservations: {}", e))
    })?;

    if reservations_count != payload.reservation_ids.len() as i64 {
        return Err(AppError::BadRequest(
            "Certaines réservations n'existent pas ou ne vous appartiennent pas".to_string(),
        ));
    }

    // Récupérer les informations de voyage depuis le produit metadata ou les réservations
    let departure_city = metadata
        .get("departure_city")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "".to_string());
    let arrival_city = metadata
        .get("arrival_city")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "".to_string());
    let departure_date = metadata
        .get("departure_date")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| chrono::Utc::now().format("%d/%m/%Y").to_string());
    let departure_time = metadata
        .get("departure_time")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "08:00".to_string());

    // Créer le paiement
    let payment_id = Uuid::new_v4().to_string();
    let booking_fee = payload.booking_fee.unwrap_or(500);
    let currency = payload.currency.unwrap_or_else(|| "XAF".to_string());

    // ✅ NOUVEAU: Récupérer les informations de retour si c'est un aller-retour
    let return_date = payload.return_date.clone();
    let return_time = payload.return_time.clone();
    let _is_round_trip = payload.is_round_trip.unwrap_or(false);

    sqlx::query(
        r#"
        INSERT INTO bus_ticket_payments (
            id,
            user_id,
            agency_user_id,
            product_id,
            reservation_ids,
            ticket_price,
            number_of_tickets,
            subtotal,
            booking_fee,
            total_amount,
            currency,
            bus_number,
            departure_city,
            arrival_city,
            departure_date,
            departure_time,
            return_date,
            return_time,
            payment_status,
            created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'completed', NOW())
        "#
    )
    .bind(&payment_id)
    .bind(user_id)
    .bind(agency_user_id)
    .bind(&payload.product_id)
    .bind(&payload.reservation_ids)
    .bind(payload.ticket_price)
    .bind(payload.number_of_tickets)
    .bind(payload.ticket_price * payload.number_of_tickets) // subtotal temporaire
    .bind(booking_fee)
    .bind(payload.ticket_price * payload.number_of_tickets + booking_fee) // total_amount temporaire
    .bind(&currency)
    .bind(&bus_number)
    .bind(&departure_city)
    .bind(&arrival_city)
    .bind(&departure_date)
    .bind(&departure_time)
    .bind(&return_date)
    .bind(&return_time)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[process_ticket_payment] Erreur création paiement: {}", e);
        AppError::Internal(format!("Erreur création paiement: {}", e))
    })?;

    // Appeler la fonction SQL pour calculer commission et reverser
    let commission_result: Value = sqlx::query_scalar(
        "SELECT process_bus_ticket_payment_with_commission($1, $2, $3, $4)"
    )
    .bind(&payment_id)
    .bind(payload.ticket_price)
    .bind(payload.number_of_tickets)
    .bind(booking_fee)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[process_ticket_payment] Erreur calcul commission: {}", e);
        AppError::Internal(format!("Erreur calcul commission: {}", e))
    })?;

    let success = commission_result
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !success {
        let error_msg = commission_result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Erreur calcul commission");
        return Err(AppError::Internal(error_msg.to_string()));
    }

    // Récupérer les montants calculés
    let subtotal = commission_result
        .get("subtotal")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(0);
    let yukpo_commission = commission_result
        .get("yukpo_commission")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(0);
    let agency_payout = commission_result
        .get("agency_payout")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(0);
    let total_amount = commission_result
        .get("total_amount")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(0);

    // TODO: Générer le PDF du ticket
    // Pour l'instant, on laisse ticket_pdf_url à NULL
    // Il sera généré par un service séparé ou via webhook
    let ticket_pdf_url: Option<String> = None;

    // Confirmer les réservations
    sqlx::query(
        r#"
        UPDATE bus_reservations
        SET 
            status = 'confirmed',
            payment_status = 'fully_paid',
            total_price = $1,
            confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = ANY($2)
            AND user_id = $3
        "#
    )
    .bind(total_amount)
    .bind(&payload.reservation_ids)
    .bind(user_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[process_ticket_payment] Erreur confirmation réservations: {}", e);
        AppError::Internal(format!("Erreur confirmation réservations: {}", e))
    })?;

    let response = TicketPaymentResponse {
        success: true,
        payment_id: Some(payment_id),
        subtotal: Some(subtotal),
        yukpo_commission: Some(yukpo_commission),
        agency_payout: Some(agency_payout),
        total_amount: Some(total_amount),
        booking_fee: Some(booking_fee),
        payout_status: Some("completed".to_string()),
        ticket_pdf_url,
        error: None,
    };

    Ok((StatusCode::OK, Json(json!(response))))
}

// ============================================================================
// RÉCUPÉRER TICKETS UTILISATEUR
// ============================================================================

/// Récupérer tous les tickets d'un utilisateur
pub async fn get_user_tickets(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_user_tickets] User ID: {}", user_id);

    let rows = sqlx::query(
        r#"
        SELECT 
            btp.id as payment_id,
            btp.product_id,
            p.name as product_name,
            btp.bus_number,
            btp.departure_city,
            btp.arrival_city,
            btp.departure_date,
            btp.departure_time,
            btp.return_date,
            btp.return_time,
            btp.ticket_price,
            btp.number_of_tickets,
            btp.total_amount,
            btp.currency,
            btp.payment_status,
            btp.ticket_pdf_url,
            btp.reservation_ids,
            btp.created_at
        FROM bus_ticket_payments btp
        JOIN products p ON p.id::text = btp.product_id
        WHERE btp.user_id = $1
        ORDER BY btp.created_at DESC
        "#
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_user_tickets] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération tickets: {}", e))
    })?;

    let mut tickets = Vec::new();
    for row in rows {
        let reservation_ids: Vec<String> = row
            .try_get::<Vec<String>, _>("reservation_ids")
            .unwrap_or_default();

        let return_date: Option<String> = row.try_get::<Option<String>, _>("return_date").ok().flatten();
        let return_time: Option<String> = row.try_get::<Option<String>, _>("return_time").ok().flatten();
        let is_round_trip = return_date.is_some() || return_time.is_some();

        let ticket = UserTicket {
            payment_id: row.get::<String, _>("payment_id"),
            product_id: row.get::<String, _>("product_id"),
            product_name: row.get::<String, _>("product_name"),
            bus_number: row.get::<Option<String>, _>("bus_number"),
            departure_city: row.get::<String, _>("departure_city"),
            arrival_city: row.get::<String, _>("arrival_city"),
            departure_date: row.get::<String, _>("departure_date"),
            departure_time: row.get::<String, _>("departure_time"),
            return_date,
            return_time,
            is_round_trip: Some(is_round_trip),
            ticket_price: row.get::<i32, _>("ticket_price"),
            number_of_tickets: row.get::<i32, _>("number_of_tickets"),
            total_amount: row.get::<i32, _>("total_amount"),
            currency: row.get::<Option<String>, _>("currency").unwrap_or_else(|| "XAF".to_string()),
            payment_status: row.get::<String, _>("payment_status"),
            ticket_pdf_url: row.get::<Option<String>, _>("ticket_pdf_url"),
            reservation_ids,
            created_at: row
                .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .to_rfc3339(),
        };
        tickets.push(ticket);
    }

    Ok((StatusCode::OK, Json(json!({ "success": true, "tickets": tickets }))))
}

// ============================================================================
// RÉCUPÉRER DÉTAILS TICKET
// ============================================================================

/// Récupérer les détails d'un ticket spécifique
pub async fn get_ticket_details(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(payment_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!("[get_ticket_details] User ID: {}, Payment ID: {}", user_id, payment_id);

    let row = sqlx::query(
        r#"
        SELECT 
            btp.id as payment_id,
            btp.product_id,
            p.name as product_name,
            btp.bus_number,
            btp.departure_city,
            btp.arrival_city,
            btp.departure_date,
            btp.departure_time,
            btp.return_date,
            btp.return_time,
            btp.ticket_price,
            btp.number_of_tickets,
            btp.subtotal,
            btp.yukpo_commission,
            btp.agency_payout,
            btp.total_amount,
            btp.booking_fee,
            btp.currency,
            btp.payment_status,
            btp.ticket_pdf_url,
            btp.reservation_ids,
            btp.created_at,
            -- Récupérer les détails des réservations (places)
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'reservation_id', br.id,
                        'seat_id', br.seat_id,
                        'seat_number', br.seat_number,
                        'passenger_name', br.passenger_name
                    )
                )
                FROM bus_reservations br
                WHERE br.id = ANY(btp.reservation_ids)
            ) as reservations_details
        FROM bus_ticket_payments btp
        JOIN products p ON p.id::text = btp.product_id
        WHERE btp.id = $1
            AND btp.user_id = $2
        "#
    )
    .bind(&payment_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_ticket_details] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération détails ticket: {}", e))
    })?;

    match row {
        Some(row) => {
            let reservation_ids: Vec<String> = row
                .get::<Vec<String>, _>("reservation_ids");
            let reservations_details: Option<Value> = row.get::<Option<Value>, _>("reservations_details");

            let return_date: Option<String> = row.try_get::<Option<String>, _>("return_date").ok().flatten();
            let return_time: Option<String> = row.try_get::<Option<String>, _>("return_time").ok().flatten();
            let is_round_trip = return_date.is_some() || return_time.is_some();

            let ticket_details = json!({
                "success": true,
                "ticket": {
                    "payment_id": row.try_get::<String, _>("payment_id").unwrap_or_default(),
                    "product_id": row.try_get::<String, _>("product_id").unwrap_or_default(),
                    "product_name": row.try_get::<String, _>("product_name").unwrap_or_default(),
                    "bus_number": row.get::<Option<String>, _>("bus_number"),
                    "departure_city": row.get::<String, _>("departure_city"),
                    "arrival_city": row.get::<String, _>("arrival_city"),
                    "departure_date": row.get::<String, _>("departure_date"),
                    "departure_time": row.get::<String, _>("departure_time"),
                    "return_date": return_date,
                    "return_time": return_time,
                    "is_round_trip": is_round_trip,
                    "ticket_price": row.get::<i32, _>("ticket_price"),
                    "number_of_tickets": row.get::<i32, _>("number_of_tickets"),
                    "subtotal": row.get::<i32, _>("subtotal"),
                    "yukpo_commission": row.get::<Option<i32>, _>("yukpo_commission"),
                    "agency_payout": row.get::<Option<i32>, _>("agency_payout"),
                    "total_amount": row.get::<i32, _>("total_amount"),
                    "booking_fee": row.get::<i32, _>("booking_fee"),
                    "currency": row.get::<Option<String>, _>("currency").unwrap_or_else(|| "XAF".to_string()),
                    "payment_status": row.get::<String, _>("payment_status"),
                    "ticket_pdf_url": row.get::<Option<String>, _>("ticket_pdf_url"),
                    "reservation_ids": reservation_ids,
                    "reservations_details": reservations_details,
                    "created_at": row
                        .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                        .unwrap_or_default()
                        .to_rfc3339(),
                }
            });

            Ok((StatusCode::OK, Json(ticket_details)))
        }
        None => Err(AppError::NotFound("Ticket non trouvé".to_string())),
    }
}

