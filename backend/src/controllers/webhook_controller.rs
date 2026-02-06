use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::Json as JsonResponse,
    Json,
};
use hex;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::Sha256;
use std::sync::Arc;

use crate::state::AppState;
use crate::{
    core::types::{AppError, AppResult},
    services::{
        audio_mastering_service::AudioPremiumWebhookPayload,
        phone_validation_service::{PhoneValidationRequest, PhoneValidationService},
    },
};
use chrono::{DateTime, Utc};
use sqlx::FromRow;

#[derive(FromRow)]
struct PaymentAttemptWebhookRow {
    id: i32,
    _payment_id: String,
    user_id: i32,
    amount_xaf: i64,
    _currency: String,
    _payment_method: String,
    _phone_number: Option<String>,
    status: String,
    _transaction_id: Option<String>,
    _created_at: DateTime<Utc>,
    _confirmed_at: Option<DateTime<Utc>>,
}

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Deserialize)]
pub struct OrangeMoneyWebhook {
    pub transaction_id: String,
    pub amount: i64,
    pub currency: String,
    pub phone_number: String,
    pub status: String, // SUCCESS, FAILED, PENDING
    pub timestamp: String,
    pub signature: String,
    pub reference: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MTNMoneyWebhook {
    pub transaction_id: String,
    pub amount: i64,
    pub currency: String,
    pub phone_number: String,
    pub status: String, // SUCCESS, FAILED, PENDING
    pub timestamp: String,
    pub signature: String,
    pub reference: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GenericWebhook {
    pub transaction_id: String,
    pub amount: i64,
    pub currency: String,
    pub phone_number: Option<String>,
    pub status: String,
    pub timestamp: String,
    pub signature: Option<String>,
    pub reference: Option<String>,
    pub payment_method: String,
}

#[derive(Serialize)]
pub struct WebhookResponse {
    pub success: bool,
    pub message: String,
    pub transaction_id: Option<String>,
}

/// Traiter un webhook Orange Money
pub async fn orange_money_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(webhook): Json<OrangeMoneyWebhook>,
) -> AppResult<JsonResponse<WebhookResponse>> {
    log::info!("[orange_money_webhook] Reçu webhook: {:?}", webhook);

    // Vérifier la signature du webhook
    if !verify_webhook_signature(&headers, &webhook.signature, "orange_money") {
        log::warn!("[orange_money_webhook] Signature invalide");
        return Err(AppError::Unauthorized("Signature invalide".to_string()));
    }

    // Valider le numéro de téléphone
    let phone_service = PhoneValidationService::new();
    let phone_validation = phone_service.validate_phone_number(PhoneValidationRequest {
        phone_number: webhook.phone_number.clone(),
        country: Some("CM".to_string()), // Orange Money Cameroun
    });

    if !phone_validation.is_valid {
        log::warn!(
            "[orange_money_webhook] Numéro de téléphone invalide: {}",
            webhook.phone_number
        );
        return Err(AppError::BadRequest(
            "Numéro de téléphone invalide".to_string(),
        ));
    }

    // Traiter le webhook
    let _result = process_payment_webhook(
        &state,
        &webhook.transaction_id,
        &webhook.status,
        &webhook.amount,
        &webhook.currency,
        &webhook.phone_number,
        "orange_money",
        &webhook.reference,
    )
    .await?;

    Ok(Json(WebhookResponse {
        success: true,
        message: "Webhook traité avec succès".to_string(),
        transaction_id: Some(webhook.transaction_id),
    }))
}

/// Traiter un webhook MTN Money
pub async fn mtn_money_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(webhook): Json<MTNMoneyWebhook>,
) -> AppResult<JsonResponse<WebhookResponse>> {
    log::info!("[mtn_money_webhook] Reçu webhook: {:?}", webhook);

    // Vérifier la signature du webhook
    if !verify_webhook_signature(&headers, &webhook.signature, "mtn_money") {
        log::warn!("[mtn_money_webhook] Signature invalide");
        return Err(AppError::Unauthorized("Signature invalide".to_string()));
    }

    // Valider le numéro de téléphone
    let phone_service = PhoneValidationService::new();
    let phone_validation = phone_service.validate_phone_number(PhoneValidationRequest {
        phone_number: webhook.phone_number.clone(),
        country: Some("CM".to_string()), // MTN Money Cameroun
    });

    if !phone_validation.is_valid {
        log::warn!(
            "[mtn_money_webhook] Numéro de téléphone invalide: {}",
            webhook.phone_number
        );
        return Err(AppError::BadRequest(
            "Numéro de téléphone invalide".to_string(),
        ));
    }

    // Traiter le webhook
    let _result = process_payment_webhook(
        &state,
        &webhook.transaction_id,
        &webhook.status,
        &webhook.amount,
        &webhook.currency,
        &webhook.phone_number,
        "mtn_money",
        &webhook.reference,
    )
    .await?;

    Ok(Json(WebhookResponse {
        success: true,
        message: "Webhook traité avec succès".to_string(),
        transaction_id: Some(webhook.transaction_id),
    }))
}

/// Traiter un webhook générique
pub async fn generic_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(webhook): Json<GenericWebhook>,
) -> AppResult<JsonResponse<WebhookResponse>> {
    log::info!("[generic_webhook] Reçu webhook: {:?}", webhook);

    // Vérifier la signature du webhook si fournie
    if let Some(signature) = &webhook.signature {
        if !verify_webhook_signature(&headers, signature, &webhook.payment_method) {
            log::warn!("[generic_webhook] Signature invalide");
            return Err(AppError::Unauthorized("Signature invalide".to_string()));
        }
    }

    // Valider le numéro de téléphone si fourni
    if let Some(phone_number) = &webhook.phone_number {
        let phone_service = PhoneValidationService::new();
        let phone_validation = phone_service.validate_phone_number(PhoneValidationRequest {
            phone_number: phone_number.clone(),
            country: None, // Détection automatique
        });

        if !phone_validation.is_valid {
            log::warn!(
                "[generic_webhook] Numéro de téléphone invalide: {}",
                phone_number
            );
            return Err(AppError::BadRequest(
                "Numéro de téléphone invalide".to_string(),
            ));
        }
    }

    // Traiter le webhook
    let _result = process_payment_webhook(
        &state,
        &webhook.transaction_id,
        &webhook.status,
        &webhook.amount,
        &webhook.currency,
        webhook.phone_number.as_deref().unwrap_or(""),
        &webhook.payment_method,
        &webhook.reference,
    )
    .await?;

    Ok(Json(WebhookResponse {
        success: true,
        message: "Webhook traité avec succès".to_string(),
        transaction_id: Some(webhook.transaction_id),
    }))
}

pub async fn audio_premium_webhook(
    State(state): State<Arc<AppState>>,
    Path(provider): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<AudioPremiumWebhookPayload>,
) -> AppResult<JsonResponse<WebhookResponse>> {
    log::info!(
        "[audio_premium_webhook] provider={} payload={:?}",
        provider,
        payload
    );

    let service = state.audio_mastering.clone().ok_or_else(|| {
        AppError::Internal(
            "Service de mastering audio premium non configuré sur ce backend".to_string(),
        )
    })?;

    if let Some(secret) = service.webhook_secret() {
        if secret.is_empty() {
            log::warn!(
                "[audio_premium_webhook] Secret de webhook vide, aucune vérification appliquée"
            );
        } else {
            if headers.get("x-signature").is_none() {
                log::warn!(
                    "[audio_premium_webhook] Signature absente alors qu'un secret est configuré"
                );
            }
            // TODO: implémenter la vérification HMAC (nécessite accès au body brut)
        }
    }

    service.process_webhook(&provider, payload).await?;

    Ok(Json(WebhookResponse {
        success: true,
        message: "Webhook audio premium traité".to_string(),
        transaction_id: None,
    }))
}

/// Traiter un webhook de paiement
async fn process_payment_webhook(
    state: &AppState,
    transaction_id: &str,
    status: &str,
    amount: &i64,
    _currency: &str,
    _phone_number: &str,
    _payment_method: &str,
    reference: &Option<String>,
) -> AppResult<()> {
    log::info!(
        "[process_payment_webhook] Traitement: {} - {} - {}",
        transaction_id,
        status,
        amount
    );

    // Rechercher la tentative de paiement correspondante
    let reference_str = reference.as_deref().unwrap_or("");
    let payment_attempt: Option<PaymentAttemptWebhookRow> = sqlx::query_as(
        "SELECT * FROM payment_attempts WHERE transaction_id = $1 OR payment_id = $2",
    )
    .bind(transaction_id)
    .bind(reference_str)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur DB: {}", e)))?;

    let payment_attempt = match payment_attempt {
        Some(attempt) => attempt,
        None => {
            log::warn!(
                "[process_payment_webhook] Tentative de paiement non trouvée: {}",
                transaction_id
            );
            return Err(AppError::NotFound(
                "Tentative de paiement non trouvée".to_string(),
            ));
        }
    };

    // Vérifier si le paiement n'est pas déjà traité
    if payment_attempt.status != "pending" {
        log::warn!(
            "[process_payment_webhook] Paiement déjà traité: {}",
            transaction_id
        );
        return Ok(()); // Retourner OK car le webhook a déjà été traité
    }

    // Mapper le statut du provider vers notre statut interne
    let internal_status = match status.to_uppercase().as_str() {
        "SUCCESS" | "COMPLETED" | "SUCCESSFUL" => "success",
        "FAILED" | "ERROR" | "CANCELLED" => "failed",
        "PENDING" | "PROCESSING" => "pending",
        _ => {
            log::warn!("[process_payment_webhook] Statut inconnu: {}", status);
            "failed"
        }
    };

    // Mettre à jour le statut du paiement
    sqlx::query(
        r#"
        UPDATE payment_attempts 
        SET status = $1, transaction_id = $2, confirmed_at = NOW()
        WHERE id = $3
        "#,
    )
    .bind(&internal_status)
    .bind(transaction_id)
    .bind(payment_attempt.id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise à jour paiement: {}", e)))?;

    // Si le paiement est réussi, créditer les tokens
    if internal_status == "success" {
        let tokens_to_add = payment_attempt.amount_xaf;

        sqlx::query("UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2")
            .bind(tokens_to_add)
            .bind(payment_attempt.user_id)
            .execute(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur crédit tokens: {}", e)))?;

        log::info!(
            "[process_payment_webhook] {} tokens crédités pour utilisateur {}",
            tokens_to_add,
            payment_attempt.user_id
        );

        // Envoyer une notification à l'utilisateur (optionnel)
        // TODO: Implémenter le système de notifications
    }

    log::info!(
        "[process_payment_webhook] Webhook traité avec succès: {}",
        transaction_id
    );
    Ok(())
}

/// Vérifier la signature du webhook
fn verify_webhook_signature(_headers: &HeaderMap, signature: &str, provider: &str) -> bool {
    // Récupérer la clé secrète du provider
    let secret_key = match provider {
        "orange_money" => std::env::var("ORANGE_MONEY_WEBHOOK_SECRET").unwrap_or_default(),
        "mtn_money" => std::env::var("MTN_MONEY_WEBHOOK_SECRET").unwrap_or_default(),
        _ => std::env::var("WEBHOOK_SECRET").unwrap_or_default(),
    };

    if secret_key.is_empty() {
        log::warn!(
            "[verify_webhook_signature] Clé secrète manquante pour {}",
            provider
        );
        return false;
    }

    // Récupérer le body du webhook (dans un vrai cas, il faudrait le récupérer du body)
    // Pour l'instant, on simule la vérification
    let body = "webhook_body"; // En réalité, il faudrait récupérer le body complet

    // Calculer la signature HMAC
    let mut mac = HmacSha256::new_from_slice(secret_key.as_bytes())
        .expect("HMAC peut être créé avec n'importe quelle taille de clé");
    mac.update(body.as_bytes());
    let expected_signature = hex::encode(mac.finalize().into_bytes());

    // Comparer les signatures
    let is_valid = signature == expected_signature;

    if !is_valid {
        log::warn!(
            "[verify_webhook_signature] Signature invalide pour {}",
            provider
        );
    }

    is_valid
}

/// Endpoint pour tester les webhooks
pub async fn test_webhook(
    State(state): State<Arc<AppState>>,
    Json(test_data): Json<Value>,
) -> AppResult<JsonResponse<WebhookResponse>> {
    log::info!("[test_webhook] Test webhook: {:?}", test_data);

    // Simuler un webhook de test
    let transaction_id = test_data
        .get("transaction_id")
        .and_then(|v| v.as_str())
        .unwrap_or("test_txn_123");

    let status = test_data.get("status").and_then(|v| v.as_str()).unwrap_or("SUCCESS");

    let amount = test_data.get("amount").and_then(|v| v.as_i64()).unwrap_or(1000);

    let currency = test_data.get("currency").and_then(|v| v.as_str()).unwrap_or("XAF");

    let phone_number =
        test_data.get("phone_number").and_then(|v| v.as_str()).unwrap_or("675123456");

    let payment_method = test_data
        .get("payment_method")
        .and_then(|v| v.as_str())
        .unwrap_or("orange_money");

    // Traiter le webhook de test
    let _result = process_payment_webhook(
        &state,
        transaction_id,
        status,
        &amount,
        currency,
        phone_number,
        payment_method,
        &None,
    )
    .await?;

    Ok(Json(WebhookResponse {
        success: true,
        message: "Webhook de test traité avec succès".to_string(),
        transaction_id: Some(transaction_id.to_string()),
    }))
}
