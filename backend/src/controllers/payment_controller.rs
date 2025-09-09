use axum::{
    extract::{Extension, State, Query},
    Json,
    response::Json as JsonResponse,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use crate::{
    core::types::{AppResult, AppError},
    middlewares::jwt::AuthenticatedUser,
};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct InitiatePaymentRequest {
    pub amount_xaf: i64,        // Montant en XAF (tokens)
    pub payment_method: String, // orange_money, mtn_momo, visa, etc.
    pub currency: String,       // XAF, USD, EUR, etc.
    pub phone_number: Option<String>, // Pour mobile money
}

#[derive(Serialize)]
pub struct InitiatePaymentResponse {
    pub payment_id: String,
    pub payment_url: Option<String>,
    pub instructions: String,
    pub status: String,
}

#[derive(Deserialize)]
pub struct ConfirmPaymentRequest {
    pub payment_id: String,
    pub transaction_id: Option<String>, // ID de transaction du provider
    pub status: String, // success, failed, pending
}

#[derive(Serialize)]
pub struct PaymentHistoryItem {
    pub id: i32,
    pub amount_xaf: i64,
    pub currency: String,
    pub payment_method: String,
    pub status: String,
    pub created_at: String,
    pub tokens_purchased: i64,
}

#[derive(Deserialize)]
pub struct PaymentHistoryQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Initier un paiement
pub async fn initiate_payment(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(req): Json<InitiatePaymentRequest>,
) -> AppResult<JsonResponse<InitiatePaymentResponse>> {
    let user_id = user.id;
    
    // Validation des donn?es
    if req.amount_xaf <= 0 {
        return Err(AppError::BadRequest("Montant invalide".to_string()));
    }
    
    if req.amount_xaf < 100 {
        return Err(AppError::BadRequest("Montant minimum: 100 tokens".to_string()));
    }
    
    // G?n?rer un ID de paiement unique
    let payment_id = format!("pay_{}_{}", user_id, chrono::Utc::now().timestamp());
    
    // Enregistrer la tentative de paiement en base
    let result = sqlx::query!(
        r#"
        INSERT INTO payment_attempts 
        (payment_id, user_id, amount_xaf, currency, payment_method, phone_number, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
        "#,
        payment_id,
        user_id,
        req.amount_xaf,
        req.currency.clone(), // Cloner pour utilisation ult?rieure
        req.payment_method.clone(), // Cloner pour utilisation ult?rieure
        req.phone_number.clone() // Cloner pour utilisation ult?rieure
    )
    .execute(&state.pg)
    .await;
    
    if let Err(e) = result {
        log::error!("[initiate_payment] Erreur insertion en base: {}", e);
        return Err(AppError::Internal("Erreur lors de l'enregistrement du paiement".to_string()));
    }
    
    // Logique selon le moyen de paiement
    let (payment_url, instructions) = match req.payment_method.as_str() {
        "orange_money" => {
            // Int?gration Orange Money API
            let instructions = format!(
                "Composez #144*4*4*{}*{}# et suivez les instructions",
                req.amount_xaf,
                req.phone_number.as_deref().unwrap_or("VOTRE_NUMERO")
            );
            (None, instructions)
        },
        "mtn_momo" => {
            // Int?gration MTN Mobile Money API
            let instructions = format!(
                "Composez *126# > Envoyer de l'argent > Marchand > Code: YUKPO > Montant: {}",
                req.amount_xaf
            );
            (None, instructions)
        },
        "visa" | "mastercard" => {
            // Redirection vers une page de paiement s?curis?e
            let payment_url = format!("https://payment.yukpo.com/secure/{}", payment_id);
            (Some(payment_url), "Vous allez ?tre redirig? vers la page de paiement s?curis?e".to_string())
        },
        "paypal" => {
            let payment_url = format!("https://www.paypal.com/checkout?token={}", payment_id);
            (Some(payment_url), "Redirection vers PayPal".to_string())
        },
        _ => {
            return Err(AppError::BadRequest("Moyen de paiement non support?".to_string()));
        }
    };
    
    log::info!("[initiate_payment] Paiement initi? pour utilisateur {}: {} XAF via {}", 
        user_id, req.amount_xaf, req.payment_method);
    
    Ok(Json(InitiatePaymentResponse {
        payment_id,
        payment_url,
        instructions,
        status: "pending".to_string(),
    }))
}

/// Confirmer un paiement (webhook ou manuel)
pub async fn confirm_payment(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(req): Json<ConfirmPaymentRequest>,
) -> AppResult<JsonResponse<Value>> {
    let user_id = user.id;
    
    // R?cup?rer les d?tails du paiement
    let payment = sqlx::query!(
        "SELECT * FROM payment_attempts WHERE payment_id = $1 AND user_id = $2",
        req.payment_id,
        user_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur DB: {}", e)))?;
    
    let payment = payment.ok_or_else(|| AppError::NotFound("Paiement non trouv?".to_string()))?;
    
    if payment.status != "pending" {
        return Err(AppError::BadRequest("Paiement d?j? trait?".to_string()));
    }
    
    // Mettre ? jour le statut du paiement
    sqlx::query!(
        r#"
        UPDATE payment_attempts 
        SET status = $1, transaction_id = $2, confirmed_at = NOW()
        WHERE payment_id = $3
        "#,
        req.status,
        req.transaction_id,
        req.payment_id
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise ? jour paiement: {}", e)))?;
    
    // Si le paiement est r?ussi, cr?diter les tokens
    if req.status == "success" {
        let tokens_to_add = payment.amount_xaf; // 1 token = 1 XAF
        
        sqlx::query!(
            "UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2",
            tokens_to_add,
            user_id
        )
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur cr?dit tokens: {}", e)))?;
        
        log::info!("[confirm_payment] {} tokens cr?dit?s pour utilisateur {}", tokens_to_add, user_id);
        
        Ok(Json(serde_json::json!({
            "success": true,
            "message": format!("{} tokens cr?dit?s avec succ?s", tokens_to_add),
            "tokens_added": tokens_to_add
        })))
    } else {
        log::warn!("[confirm_payment] Paiement ?chou? pour utilisateur {}: {}", user_id, req.status);
        Ok(Json(serde_json::json!({
            "success": false,
            "message": "Paiement ?chou?",
            "status": req.status
        })))
    }
}

/// Historique des paiements de l'utilisateur
pub async fn get_payment_history(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<PaymentHistoryQuery>,
) -> AppResult<JsonResponse<Vec<PaymentHistoryItem>>> {
    let user_id = user.id;
    let limit = params.limit.unwrap_or(20);
    let offset = params.offset.unwrap_or(0);
    
    let payments = sqlx::query!(
        r#"
        SELECT id, amount_xaf, currency, payment_method, status, created_at, amount_xaf as tokens_purchased
        FROM payment_attempts 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
        "#,
        user_id,
        limit,
        offset
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur r?cup?ration historique: {}", e)))?;
    
    let history: Vec<PaymentHistoryItem> = payments
        .into_iter()
        .map(|p| PaymentHistoryItem {
            id: p.id,
            amount_xaf: p.amount_xaf,
            currency: p.currency,
            payment_method: p.payment_method,
            status: p.status,
            created_at: p.created_at.to_string(),
            tokens_purchased: p.tokens_purchased,
        })
        .collect();
    
    Ok(Json(history))
}
