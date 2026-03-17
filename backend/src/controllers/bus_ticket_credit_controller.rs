// Contrôleur pour le système de crédits et report de tickets bus
// Gère le report de tickets non-validés, l'utilisation de crédits pour nouveaux voyages,
// et le reversement automatique avec pénalité

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

// ============================================================================
// STRUCTURES DE REQUÊTE/RÉPONSE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct DeferTicketRequest {
    pub payment_id: String,
    pub reason: Option<String>, // 'no_show', 'user_request', 'cancelled_trip'
}

#[derive(Debug, Deserialize)]
pub struct ApplyCreditRequest {
    pub credit_id: String,
    pub new_payment_id: String,
    pub new_ticket_price: i32,
    pub number_of_tickets: i32,
    pub booking_fee: Option<i32>,
    pub product_id: String,
    pub reservation_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct GetWalletTransactionsRequest {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
    pub transaction_type: Option<String>,
    pub date_from: Option<String>, // ISO 8601
    pub date_to: Option<String>,   // ISO 8601
}

#[derive(Debug, Serialize)]
pub struct WalletTransaction {
    pub id: String,
    pub transaction_type: String,
    pub amount: i32,
    pub currency: String,
    pub reference_type: Option<String>,
    pub reference_id: Option<String>,
    pub description: String,
    pub balance_before: i64,
    pub balance_after: i64,
    pub metadata: Option<Value>,
    pub created_at: String, // ISO 8601
    pub processed_at: String, // ISO 8601
}

#[derive(Debug, Serialize)]
pub struct TicketCredit {
    pub credit_id: String,
    pub original_payment_id: String,
    pub net_credit_amount: i32,
    pub penalty_amount: i32,
    pub penalty_percentage: f64,
    pub original_amount: i32,
    pub original_departure_city: String,
    pub original_arrival_city: String,
    pub original_departure_date: String,
    pub original_departure_time: String,
    pub original_ticket_price: i32,
    pub original_number_of_tickets: i32,
    pub status: String,
    pub reason: String,
    pub expires_at: String,
    pub days_until_expiry: i32,
    pub created_at: String,
}

// ============================================================================
// REPORTER UN TICKET (DEFER) — Crée un crédit avec pénalité
// ============================================================================

/// POST /api/bus-tickets/defer
/// Reporter un ticket non-validé. Applique une pénalité de 10% reversée à l'agence.
/// Le montant net est conservé en crédit pour un futur voyage.
pub async fn defer_ticket(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<DeferTicketRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[defer_ticket] User ID: {}, Payment ID: {}",
        user_id, payload.payment_id
    );

    let reason = payload.reason.unwrap_or_else(|| "user_request".to_string());
    let penalty_pct: f64 = 10.0; // 10% de pénalité

    // Appeler la fonction SQL defer_bus_ticket
    let result: Value = sqlx::query_scalar("SELECT defer_bus_ticket($1, $2, $3, $4)")
        .bind(&payload.payment_id)
        .bind(user_id)
        .bind(penalty_pct)
        .bind(&reason)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[defer_ticket] Erreur: {}", e);
            AppError::Internal(format!("Erreur report ticket: {}", e))
        })?;

    let success = result
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !success {
        let error_msg = result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Erreur inconnue");
        return Err(AppError::BadRequest(error_msg.to_string()));
    }

    Ok((StatusCode::OK, Json(json!({
        "success": true,
        "data": result,
        "message": result.get("message").and_then(|v| v.as_str()).unwrap_or("Ticket reporté avec succès")
    }))))
}

// ============================================================================
// UTILISER UN CRÉDIT POUR UN NOUVEAU VOYAGE
// ============================================================================

/// POST /api/bus-tickets/apply-credit
/// Utiliser un crédit de ticket reporté pour payer un nouveau voyage.
/// Si le crédit est supérieur au nouveau prix → excédent restitué.
/// Si le crédit est inférieur → supplément débité du solde tokens (recharge auto).
pub async fn apply_credit(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<ApplyCreditRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[apply_credit] User ID: {}, Credit ID: {}, New ticket price: {}",
        user_id, payload.credit_id, payload.new_ticket_price
    );

    let booking_fee = payload.booking_fee.unwrap_or(500);
    let new_total_price = payload.new_ticket_price * payload.number_of_tickets;

    // 1. Créer le nouveau paiement d'abord
    let new_payment_id = uuid::Uuid::new_v4().to_string();

    // Récupérer le credit pour avoir l'agency_user_id du nouveau voyage
    // (on prend l'agence du nouveau produit, pas l'ancienne)
    let product_row = sqlx::query(
        r#"
        SELECT p.id, p.name, p.service_id, p.numero_bus, p.metadata,
               s.user_id as agency_user_id
        FROM products p
        JOIN services s ON s.id = p.service_id
        WHERE p.id::text = $1 AND p.type = 'ticket_voyage'
        "#,
    )
    .bind(&payload.product_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[apply_credit] Erreur récupération produit: {}", e);
        AppError::Internal(format!("Erreur récupération produit: {}", e))
    })?;

    let (product_name, agency_user_id, bus_number, metadata) = match product_row {
        Some(row) => (
            row.get::<String, _>("name"),
            row.get::<Option<i32>, _>("agency_user_id").unwrap_or(0),
            row.get::<Option<String>, _>("numero_bus"),
            row.get::<Option<Value>, _>("metadata").unwrap_or(json!({})),
        ),
        None => {
            return Err(AppError::NotFound("Produit non trouvé".to_string()));
        }
    };

    if agency_user_id == 0 {
        return Err(AppError::Internal(
            "Agence non trouvée pour ce produit".to_string(),
        ));
    }

    let departure_city = metadata
        .get("departure_city")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let arrival_city = metadata
        .get("arrival_city")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let departure_date = metadata
        .get("departure_date")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let departure_time = metadata
        .get("departure_time")
        .and_then(|v| v.as_str())
        .unwrap_or("08:00")
        .to_string();

    // 2. Appliquer le crédit via la fonction SQL
    let credit_result: Value =
        sqlx::query_scalar("SELECT apply_ticket_credit($1, $2, $3, $4)")
            .bind(&payload.credit_id)
            .bind(user_id)
            .bind(&new_payment_id)
            .bind(new_total_price)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| {
                error!("[apply_credit] Erreur application crédit: {}", e);
                AppError::Internal(format!("Erreur application crédit: {}", e))
            })?;

    let credit_success = credit_result
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !credit_success {
        let needs_recharge = credit_result
            .get("needs_recharge")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if needs_recharge {
            let shortfall = credit_result
                .get("shortfall")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            return Ok((
                StatusCode::PAYMENT_REQUIRED,
                Json(json!({
                    "success": false,
                    "needs_recharge": true,
                    "shortfall": shortfall,
                    "supplement_required": credit_result.get("supplement_required"),
                    "current_balance": credit_result.get("current_balance"),
                    "message": format!("Solde insuffisant. Rechargez {} XAF pour continuer.", shortfall)
                })),
            ));
        }

        let error_msg = credit_result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Erreur application crédit");
        return Err(AppError::BadRequest(error_msg.to_string()));
    }

    // 3. Créer le nouveau paiement dans bus_ticket_payments
    let commission = (new_total_price as f64 * 0.05) as i32;
    let agency_payout = new_total_price - commission;

    sqlx::query(
        r#"
        INSERT INTO bus_ticket_payments (
            id, user_id, agency_user_id, product_id, reservation_ids,
            ticket_price, number_of_tickets, subtotal, booking_fee, total_amount,
            yukpo_commission, agency_payout,
            currency, bus_number, departure_city, arrival_city,
            departure_date, departure_time,
            payment_status, payout_status, escrow_status,
            created_at
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12,
            'XAF', $13, $14, $15,
            $16, $17,
            'completed', 'pending', 'held',
            NOW()
        )
        "#,
    )
    .bind(&new_payment_id)
    .bind(user_id)
    .bind(agency_user_id)
    .bind(&payload.product_id)
    .bind(&payload.reservation_ids)
    .bind(payload.new_ticket_price)
    .bind(payload.number_of_tickets)
    .bind(new_total_price)
    .bind(booking_fee)
    .bind(new_total_price + booking_fee)
    .bind(commission)
    .bind(agency_payout)
    .bind(&bus_number)
    .bind(&departure_city)
    .bind(&arrival_city)
    .bind(&departure_date)
    .bind(&departure_time)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[apply_credit] Erreur création paiement: {}", e);
        AppError::Internal(format!("Erreur création paiement: {}", e))
    })?;

    // 4. Confirmer les réservations
    sqlx::query(
        r#"
        UPDATE bus_reservations
        SET status = 'confirmed',
            payment_status = 'fully_paid',
            total_price = $1,
            confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = ANY($2) AND user_id = $3
        "#,
    )
    .bind(new_total_price + booking_fee)
    .bind(&payload.reservation_ids)
    .bind(user_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[apply_credit] Erreur confirmation réservations: {}", e);
        AppError::Internal(format!("Erreur confirmation réservations: {}", e))
    })?;

    let supplement = credit_result
        .get("supplement_paid")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;
    let refund = credit_result
        .get("refund_amount")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "payment_id": new_payment_id,
            "product_name": product_name,
            "credit_applied": credit_result.get("credit_amount"),
            "new_ticket_price": new_total_price,
            "supplement_paid": supplement,
            "refund_amount": refund,
            "total_amount": new_total_price + booking_fee,
            "agency_payout": agency_payout,
            "yukpo_commission": commission,
            "escrow_status": "held",
            "message": credit_result.get("message").and_then(|v| v.as_str()).unwrap_or("Crédit appliqué avec succès")
        })),
    ))
}

// ============================================================================
// RÉCUPÉRER LES CRÉDITS DE L'UTILISATEUR
// ============================================================================

/// GET /api/bus-tickets/credits
/// Récupérer tous les crédits de tickets bus d'un utilisateur
pub async fn get_user_credits(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_user_credits] User ID: {}", user_id);

    let rows = sqlx::query(
        r#"
        SELECT 
            btc.id as credit_id,
            btc.original_payment_id,
            btc.net_credit_amount,
            btc.penalty_amount,
            btc.penalty_percentage,
            btc.original_amount,
            btc.original_departure_city,
            btc.original_arrival_city,
            btc.original_departure_date,
            btc.original_departure_time,
            btc.original_ticket_price,
            btc.original_number_of_tickets,
            btc.status,
            btc.reason,
            btc.expires_at,
            btc.created_at,
            btc.supplement_amount,
            btc.refund_amount,
            btc.used_for_payment_id,
            btc.used_at
        FROM bus_ticket_credits btc
        WHERE btc.user_id = $1
        ORDER BY btc.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_user_credits] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération crédits: {}", e))
    })?;

    let mut credits = Vec::new();
    let mut active_total: i32 = 0;

    for row in rows {
        let status: String = row.get("status");
        let net_credit: i32 = row.get("net_credit_amount");
        let expires_at: chrono::DateTime<chrono::Utc> = row.get("expires_at");
        let days_until_expiry = (expires_at - chrono::Utc::now()).num_days() as i32;

        if status == "active" {
            active_total += net_credit;
        }

        credits.push(json!({
            "credit_id": row.get::<String, _>("credit_id"),
            "original_payment_id": row.get::<String, _>("original_payment_id"),
            "net_credit_amount": net_credit,
            "penalty_amount": row.get::<i32, _>("penalty_amount"),
            "penalty_percentage": row.get::<rust_decimal::Decimal, _>("penalty_percentage").to_string(),
            "original_amount": row.get::<i32, _>("original_amount"),
            "original_departure_city": row.get::<String, _>("original_departure_city"),
            "original_arrival_city": row.get::<String, _>("original_arrival_city"),
            "original_departure_date": row.get::<String, _>("original_departure_date"),
            "original_departure_time": row.get::<String, _>("original_departure_time"),
            "original_ticket_price": row.get::<i32, _>("original_ticket_price"),
            "original_number_of_tickets": row.get::<i32, _>("original_number_of_tickets"),
            "status": status,
            "reason": row.get::<Option<String>, _>("reason").unwrap_or_default(),
            "expires_at": expires_at.to_rfc3339(),
            "days_until_expiry": days_until_expiry,
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            "supplement_amount": row.get::<Option<i32>, _>("supplement_amount").unwrap_or(0),
            "refund_amount": row.get::<Option<i32>, _>("refund_amount").unwrap_or(0),
            "used_for_payment_id": row.get::<Option<String>, _>("used_for_payment_id"),
            "used_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("used_at").map(|d| d.to_rfc3339()),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "credits": credits,
            "active_total": active_total,
            "count": credits.len()
        })),
    ))
}

// ============================================================================
// RÉCUPÉRER UN CRÉDIT SPÉCIFIQUE
// ============================================================================

/// GET /api/bus-tickets/credits/{credit_id}
pub async fn get_credit_details(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(credit_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_credit_details] User ID: {}, Credit ID: {}",
        user_id, credit_id
    );

    let row = sqlx::query(
        r#"
        SELECT 
            btc.*,
            au.nom_complet as agency_name
        FROM bus_ticket_credits btc
        JOIN users au ON au.id = btc.original_agency_user_id
        WHERE btc.id = $1 AND btc.user_id = $2
        "#,
    )
    .bind(&credit_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_credit_details] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération crédit: {}", e))
    })?;

    match row {
        Some(row) => {
            let expires_at: chrono::DateTime<chrono::Utc> = row.get("expires_at");
            let days_until_expiry = (expires_at - chrono::Utc::now()).num_days() as i32;

            Ok((
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "credit": {
                        "credit_id": row.get::<String, _>("id"),
                        "original_payment_id": row.get::<String, _>("original_payment_id"),
                        "agency_name": row.get::<String, _>("agency_name"),
                        "net_credit_amount": row.get::<i32, _>("net_credit_amount"),
                        "penalty_amount": row.get::<i32, _>("penalty_amount"),
                        "penalty_percentage": row.get::<rust_decimal::Decimal, _>("penalty_percentage").to_string(),
                        "original_amount": row.get::<i32, _>("original_amount"),
                        "original_departure_city": row.get::<String, _>("original_departure_city"),
                        "original_arrival_city": row.get::<String, _>("original_arrival_city"),
                        "original_departure_date": row.get::<String, _>("original_departure_date"),
                        "original_departure_time": row.get::<String, _>("original_departure_time"),
                        "original_ticket_price": row.get::<i32, _>("original_ticket_price"),
                        "original_number_of_tickets": row.get::<i32, _>("original_number_of_tickets"),
                        "status": row.get::<String, _>("status"),
                        "reason": row.get::<Option<String>, _>("reason"),
                        "expires_at": expires_at.to_rfc3339(),
                        "days_until_expiry": days_until_expiry,
                        "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
                    }
                })),
            ))
        }
        None => Err(AppError::NotFound("Crédit non trouvé".to_string())),
    }
}

/// GET /api/bus-tickets/wallet/transactions
/// Récupère l'historique des transactions wallet de l'utilisateur
pub async fn get_wallet_transactions(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<GetWalletTransactionsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_wallet_transactions] User ID: {}, Limit: {:?}, Offset: {:?}, Type: {:?}",
        user_id, payload.limit, payload.offset, payload.transaction_type
    );

    let limit = payload.limit.unwrap_or(50).min(100); // Max 100
    let offset = payload.offset.unwrap_or(0);

    let rows = sqlx::query!(
        r#"
        SELECT 
            id,
            transaction_type,
            amount,
            currency,
            reference_type,
            reference_id,
            description,
            balance_before,
            balance_after,
            metadata,
            created_at,
            processed_at
        FROM get_wallet_transactions($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .bind(payload.transaction_type)
    .bind(payload.date_from)
    .bind(payload.date_to)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_wallet_transactions] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération transactions: {}", e))
    })?;

    let mut transactions = Vec::new();

    for row in rows {
        transactions.push(json!({
            "id": row.id,
            "transaction_type": row.transaction_type,
            "amount": row.amount,
            "currency": row.currency,
            "reference_type": row.reference_type,
            "reference_id": row.reference_id,
            "description": row.description,
            "balance_before": row.balance_before,
            "balance_after": row.balance_after,
            "metadata": row.metadata,
            "created_at": row.created_at,
            "processed_at": row.processed_at
        }));
    }

    // Récupérer les statistiques résumées
    let summary_rows = sqlx::query!(
        r#"
        SELECT 
            transaction_type,
            COUNT(*) as transaction_count,
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_credits,
            COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_debits,
            COALESCE(SUM(amount), 0) as net_amount
        FROM wallet_transaction_summary
        WHERE user_id = $1
        GROUP BY transaction_type
        ORDER BY transaction_type
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_wallet_transactions] Erreur résumé: {}", e);
        AppError::Internal(format!("Erreur résumé transactions: {}", e))
    })?;

    let mut summary = Vec::new();
    for row in summary_rows {
        summary.push(json!({
            "transaction_type": row.transaction_type,
            "transaction_count": row.transaction_count,
            "total_credits": row.total_credits,
            "total_debits": row.total_debits,
            "net_amount": row.net_amount
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": {
                "transactions": transactions,
                "summary": summary,
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "has_more": transactions.len() == limit as usize
                }
            }
        })),
    ))
}
