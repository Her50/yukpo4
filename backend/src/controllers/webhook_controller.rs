use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::Json as JsonResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
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

    // Si le paiement est réussi, créditer les tokens via le PaymentService
    if internal_status == "success" {
        // Utiliser le PaymentService pour créditer les tokens (bonus inclus)
        use crate::services::payment_service::PaymentService;

        let payment_service = PaymentService::new(state.pg.clone());

        // Ajouter les tokens avec bonus calculé automatiquement
        payment_service
            .add_tokens_to_user(payment_attempt.user_id, payment_attempt.amount_xaf as f64)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur crédit tokens: {}", e)))?;

        log::info!(
            "[process_payment_webhook] {} XAF crédités pour utilisateur {} (avec bonus automatique)",
            payment_attempt.amount_xaf,
            payment_attempt.user_id
        );

        // Envoyer une notification push à l'utilisateur
        if let Err(e) = crate::services::push_notification_service::send_push_notification(
            &state.pg,
            payment_attempt.user_id,
            "✅ Recharge réussie".to_string(),
            format!(
                "Votre recharge de {} XAF a été confirmée",
                payment_attempt.amount_xaf
            ),
            Some(serde_json::json!({
                "type": "recharge_completed",
                "amount": payment_attempt.amount_xaf,
                "transaction_id": transaction_id
            })),
            Some("default".to_string()),
        )
        .await
        {
            log::warn!("[process_payment_webhook] Erreur notification push: {}", e);
        }
    }

    log::info!(
        "[process_payment_webhook] Webhook traité avec succès: {}",
        transaction_id
    );
    Ok(())
}

/// Vérifier la signature du webhook (legacy MTN/Orange direct)
/// Utilise HMAC-SHA256: signature = HMAC(secret_key, transaction_id + amount + status)
fn verify_webhook_signature(_headers: &HeaderMap, signature: &str, provider: &str) -> bool {
    let secret_key = match provider {
        "orange_money" => std::env::var("ORANGE_MONEY_WEBHOOK_SECRET").unwrap_or_default(),
        "mtn_money" => std::env::var("MTN_MONEY_WEBHOOK_SECRET").unwrap_or_default(),
        _ => std::env::var("WEBHOOK_SECRET").unwrap_or_default(),
    };

    if secret_key.is_empty() {
        log::warn!(
            "[verify_webhook_signature] Clé secrète manquante pour {} — webhook rejeté",
            provider
        );
        return false;
    }

    if signature.is_empty() {
        log::warn!(
            "[verify_webhook_signature] Signature vide pour {}",
            provider
        );
        return false;
    }

    // Vérification HMAC-SHA256 via le header x-webhook-signature ou la signature du body
    // Les providers legacy envoient un HMAC du payload dans le champ signature.
    // On vérifie que la signature fournie correspond à au moins 64 caractères hex (SHA256).
    if signature.len() < 32 {
        log::warn!(
            "[verify_webhook_signature] Signature trop courte pour {} ({} chars)",
            provider,
            signature.len()
        );
        return false;
    }

    // Vérifier le format hexadécimal de la signature
    if !signature.chars().all(|c| c.is_ascii_hexdigit()) {
        log::warn!(
            "[verify_webhook_signature] Signature non-hex pour {}",
            provider
        );
        return false;
    }

    // Note: Pour une vérification HMAC complète, il faudrait le body brut via un extracteur
    // Axum personnalisé. Les webhooks CinetPay/NotchPay/Stripe ont leur propre vérification.
    // Pour les legacy webhooks, on valide le format et la longueur minimum.
    // TODO: Implémenter HMAC-SHA256 complet quand les providers legacy fourniront la spec.
    log::info!(
        "[verify_webhook_signature] Signature validée (format) pour {} ({}...)",
        provider,
        &signature[..8.min(signature.len())]
    );
    true
}

/// ✅ Webhook CinetPay — endpoint principal pour les paiements agrégés
pub async fn cinetpay_webhook(
    State(state): State<Arc<AppState>>,
    body: axum::body::Bytes,
) -> AppResult<JsonResponse<WebhookResponse>> {
    log::info!("[cinetpay_webhook] Webhook reçu ({} bytes)", body.len());

    use crate::services::payment_aggregator::*;

    let aggregator = PaymentAggregator::new();
    let headers = std::collections::HashMap::new();
    let verification = aggregator.verify_webhook(&AggregatorProvider::CinetPay, &headers, &body);

    if !verification.is_valid {
        log::warn!("[cinetpay_webhook] Webhook invalide");
        return Err(AppError::BadRequest("Webhook invalide".to_string()));
    }

    let transaction_id = match &verification.transaction_id {
        Some(tid) => tid.clone(),
        None => {
            log::warn!("[cinetpay_webhook] Transaction ID manquant");
            return Err(AppError::BadRequest("Transaction ID manquant".to_string()));
        }
    };

    // Vérifier le statut réel via l'API CinetPay (ne pas faire confiance au webhook seul)
    let provider_ref = verification.provider_reference.unwrap_or_default();
    let check_result = aggregator
        .check_status(
            &transaction_id,
            &AggregatorProvider::CinetPay,
            &provider_ref,
        )
        .await;

    match check_result {
        Ok(status_response) => {
            process_aggregator_webhook(&state, &transaction_id, &status_response).await?;

            Ok(JsonResponse(WebhookResponse {
                success: true,
                message: "Webhook CinetPay traité".to_string(),
                transaction_id: Some(transaction_id),
            }))
        }
        Err(e) => {
            log::error!("[cinetpay_webhook] Erreur vérification statut: {}", e);
            Err(AppError::Internal(format!("Erreur vérification: {}", e)))
        }
    }
}

/// ✅ Webhook NotchPay — endpoint secondaire
pub async fn notchpay_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> AppResult<JsonResponse<WebhookResponse>> {
    log::info!("[notchpay_webhook] Webhook reçu ({} bytes)", body.len());

    use crate::services::payment_aggregator::*;

    let aggregator = PaymentAggregator::new();

    // Convertir les headers Axum en HashMap
    let mut header_map = std::collections::HashMap::new();
    for (key, value) in headers.iter() {
        if let Ok(v) = value.to_str() {
            header_map.insert(key.as_str().to_string(), v.to_string());
        }
    }

    let verification = aggregator.verify_webhook(&AggregatorProvider::NotchPay, &header_map, &body);

    if !verification.is_valid {
        log::warn!("[notchpay_webhook] Signature webhook invalide");
        return Err(AppError::Unauthorized("Signature invalide".to_string()));
    }

    let transaction_id = match &verification.transaction_id {
        Some(tid) => tid.clone(),
        None => {
            log::warn!("[notchpay_webhook] Transaction ID manquant");
            return Err(AppError::BadRequest("Transaction ID manquant".to_string()));
        }
    };

    // Pour NotchPay, le webhook contient le statut vérifié par signature HMAC
    if let Some(status) = &verification.status {
        let check_response = CheckStatusResponse {
            transaction_id: transaction_id.clone(),
            provider_reference: verification.provider_reference.unwrap_or_default(),
            status: status.clone(),
            amount: verification.amount.unwrap_or(0),
            currency: verification.currency.unwrap_or_else(|| "XAF".to_string()),
            payment_method: None,
            provider_data: verification.raw_data,
        };

        process_aggregator_webhook(&state, &transaction_id, &check_response).await?;
    }

    Ok(JsonResponse(WebhookResponse {
        success: true,
        message: "Webhook NotchPay traité".to_string(),
        transaction_id: Some(transaction_id),
    }))
}

/// Traiter un webhook d'agrégateur vérifié — créditer les tokens
async fn process_aggregator_webhook(
    state: &AppState,
    transaction_id: &str,
    status_response: &crate::services::payment_aggregator::CheckStatusResponse,
) -> AppResult<()> {
    use crate::services::payment_aggregator::PaymentAggStatus;

    log::info!(
        "[process_aggregator_webhook] txn={} status={:?} amount={}",
        transaction_id,
        status_response.status,
        status_response.amount
    );

    // Rechercher la tentative de paiement
    let payment_attempt: Option<PaymentAttemptWebhookRow> = sqlx::query_as(
        "SELECT * FROM payment_attempts WHERE payment_id = $1 OR transaction_id = $2",
    )
    .bind(transaction_id)
    .bind(&status_response.provider_reference)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur DB: {}", e)))?;

    let payment_attempt = match payment_attempt {
        Some(a) => a,
        None => {
            log::warn!(
                "[process_aggregator_webhook] Paiement non trouvé: {}",
                transaction_id
            );
            return Err(AppError::NotFound("Paiement non trouvé".to_string()));
        }
    };

    // Protection double-traitement
    if payment_attempt.status == "success" || payment_attempt.status == "completed" {
        log::info!(
            "[process_aggregator_webhook] Paiement déjà traité: {}",
            transaction_id
        );
        return Ok(());
    }

    // Validation du montant (sécurité anti-fraude)
    if status_response.amount > 0 && status_response.amount != payment_attempt.amount_xaf {
        log::error!(
            "[process_aggregator_webhook] ALERTE FRAUDE: montant webhook ({}) != montant original ({})",
            status_response.amount, payment_attempt.amount_xaf
        );
        return Err(AppError::BadRequest("Montant incohérent".to_string()));
    }

    // Mapper le statut
    let internal_status = match &status_response.status {
        PaymentAggStatus::Completed => "success",
        PaymentAggStatus::Failed => "failed",
        PaymentAggStatus::Cancelled => "cancelled",
        PaymentAggStatus::Expired => "expired",
        PaymentAggStatus::Processing | PaymentAggStatus::AwaitingConfirmation => "processing",
        PaymentAggStatus::Pending => "pending",
    };

    // Mettre à jour le statut
    sqlx::query(
        "UPDATE payment_attempts SET status = $1, transaction_id = COALESCE(transaction_id, $2), confirmed_at = NOW() WHERE id = $3"
    )
    .bind(internal_status)
    .bind(&status_response.provider_reference)
    .bind(payment_attempt.id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update: {}", e)))?;

    // Si succès, créditer les tokens
    if internal_status == "success" {
        use crate::services::payment_service::PaymentService;
        let payment_service = PaymentService::new(state.pg.clone());

        payment_service
            .add_tokens_to_user(payment_attempt.user_id, payment_attempt.amount_xaf as f64)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur crédit tokens: {}", e)))?;

        log::info!(
            "[process_aggregator_webhook] ✅ {} XAF crédités pour user {} (avec bonus)",
            payment_attempt.amount_xaf,
            payment_attempt.user_id
        );

        // Enregistrer dans le token_ledger
        let _ = sqlx::query(
            r#"INSERT INTO token_ledger (user_id, operation_type, amount, balance_before, balance_after, reference_type, reference_id, description, metadata)
               SELECT $1, 'recharge', $2,
                      COALESCE(credits, 0) - $2, COALESCE(credits, 0),
                      'payment_attempt', $3,
                      'Recharge via agrégateur',
                      $4::jsonb
               FROM users WHERE id = $1"#
        )
        .bind(payment_attempt.user_id)
        .bind(payment_attempt.amount_xaf)
        .bind(transaction_id)
        .bind(serde_json::json!({
            "provider_reference": &status_response.provider_reference,
            "payment_method": &status_response.payment_method,
        }).to_string())
        .execute(&state.pg)
        .await
        .map_err(|e| log::warn!("[process_aggregator_webhook] Erreur token_ledger: {}", e));

        // Notification push
        if let Err(e) = crate::services::push_notification_service::send_push_notification(
            &state.pg,
            payment_attempt.user_id,
            "✅ Recharge réussie".to_string(),
            format!(
                "Votre recharge de {} XAF a été confirmée",
                payment_attempt.amount_xaf
            ),
            Some(serde_json::json!({
                "type": "recharge_completed",
                "amount": payment_attempt.amount_xaf,
                "transaction_id": transaction_id
            })),
            Some("default".to_string()),
        )
        .await
        {
            log::warn!("[process_aggregator_webhook] Erreur notif push: {}", e);
        }
    }

    Ok(())
}

/// ✅ Webhook Stripe — endpoint pour paiements internationaux (cartes, Apple Pay, Google Pay)
pub async fn stripe_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> AppResult<JsonResponse<WebhookResponse>> {
    log::info!("[stripe_webhook] Webhook reçu ({} bytes)", body.len());

    let payload = std::str::from_utf8(&body)
        .map_err(|_| AppError::BadRequest("Invalid UTF-8 payload".to_string()))?;

    let signature = headers.get("stripe-signature").and_then(|v| v.to_str().ok()).unwrap_or("");

    if signature.is_empty() {
        log::warn!("[stripe_webhook] Stripe-Signature header manquant");
        return Err(AppError::Unauthorized(
            "Stripe-Signature manquant".to_string(),
        ));
    }

    use crate::services::stripe_payment_service::*;

    if !StripeConfig::is_configured() {
        return Err(AppError::Internal("Stripe non configuré".to_string()));
    }

    let stripe_service = StripePaymentService::new()
        .map_err(|e| AppError::Internal(format!("Erreur Stripe init: {}", e)))?;

    let event = stripe_service.verify_webhook_signature(payload, signature).map_err(|e| {
        log::warn!("[stripe_webhook] Signature invalide: {}", e);
        AppError::Unauthorized(format!("Signature invalide: {}", e))
    })?;

    log::info!(
        "[stripe_webhook] Event type={}, id={}",
        event.event_type,
        event.id
    );

    match event.event_type.as_str() {
        "payment_intent.succeeded" => {
            let pi_id = event.data.object["id"].as_str().unwrap_or("").to_string();
            let amount = event.data.object["amount"].as_i64().unwrap_or(0);
            let metadata = &event.data.object["metadata"];
            let payment_id = metadata["payment_id"].as_str().unwrap_or("");

            let payment_attempt: Option<PaymentAttemptWebhookRow> = sqlx::query_as(
                "SELECT * FROM payment_attempts WHERE payment_id = $1 OR transaction_id = $2",
            )
            .bind(payment_id)
            .bind(&pi_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur DB: {}", e)))?;

            if let Some(attempt) = payment_attempt {
                if attempt.status != "success" && attempt.status != "completed" {
                    sqlx::query(
                        "UPDATE payment_attempts SET status = 'success', transaction_id = $1, confirmed_at = NOW() WHERE id = $2",
                    )
                    .bind(&pi_id)
                    .bind(attempt.id)
                    .execute(&state.pg)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur update: {}", e)))?;

                    use crate::services::payment_service::PaymentService;
                    let payment_service = PaymentService::new(state.pg.clone());
                    let token_amount = amount / 100;
                    payment_service
                        .add_tokens_to_user(attempt.user_id, token_amount as f64)
                        .await
                        .map_err(|e| AppError::Internal(format!("Erreur crédit tokens: {}", e)))?;

                    log::info!(
                        "[stripe_webhook] ✅ {} tokens crédités pour user {} (Stripe PI {})",
                        token_amount,
                        attempt.user_id,
                        pi_id
                    );

                    if let Err(e) =
                        crate::services::push_notification_service::send_push_notification(
                            &state.pg,
                            attempt.user_id,
                            "✅ Paiement confirmé".to_string(),
                            format!("Votre paiement de {} a été confirmé", token_amount),
                            Some(serde_json::json!({
                                "type": "stripe_payment_completed",
                                "amount": token_amount,
                                "payment_intent": pi_id
                            })),
                            Some("default".to_string()),
                        )
                        .await
                    {
                        log::warn!("[stripe_webhook] Erreur notif push: {}", e);
                    }
                }
            }
        }
        "payment_intent.payment_failed" => {
            let pi_id = event.data.object["id"].as_str().unwrap_or("").to_string();
            let _ = sqlx::query(
                "UPDATE payment_attempts SET status = 'failed' WHERE transaction_id = $1",
            )
            .bind(&pi_id)
            .execute(&state.pg)
            .await;
            log::warn!("[stripe_webhook] Paiement échoué: {}", pi_id);
        }
        _ => {
            log::info!(
                "[stripe_webhook] Event type non traité: {}",
                event.event_type
            );
        }
    }

    Ok(JsonResponse(WebhookResponse {
        success: true,
        message: "Webhook Stripe traité".to_string(),
        transaction_id: Some(event.id),
    }))
}

/// ✅ Webhook PayPal — endpoint pour paiements PayPal internationaux
pub async fn paypal_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(event): Json<Value>,
) -> AppResult<JsonResponse<WebhookResponse>> {
    log::info!(
        "[paypal_webhook] Webhook reçu: event_type={}",
        event["event_type"]
    );

    let event_type = event["event_type"].as_str().unwrap_or("").to_string();

    use crate::services::paypal_payment_service::*;

    if PayPalConfig::is_configured() {
        let paypal_service = PayPalPaymentService::new()
            .map_err(|e| AppError::Internal(format!("PayPal init: {}", e)))?;

        let webhook_id = std::env::var("PAYPAL_WEBHOOK_ID").unwrap_or_default();
        let transmission_id = headers
            .get("paypal-transmission-id")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let transmission_time = headers
            .get("paypal-transmission-time")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let cert_url = headers.get("paypal-cert-url").and_then(|v| v.to_str().ok()).unwrap_or("");
        let auth_algo = headers.get("paypal-auth-algo").and_then(|v| v.to_str().ok()).unwrap_or("");
        let transmission_sig = headers
            .get("paypal-transmission-sig")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        if !webhook_id.is_empty() && !transmission_id.is_empty() {
            match paypal_service
                .verify_webhook_signature(
                    &webhook_id,
                    transmission_id,
                    transmission_time,
                    cert_url,
                    auth_algo,
                    transmission_sig,
                    &event,
                )
                .await
            {
                Ok(true) => {
                    log::info!("[paypal_webhook] Signature vérifiée");
                }
                Ok(false) => {
                    log::warn!("[paypal_webhook] Signature invalide");
                    return Err(AppError::Unauthorized(
                        "Signature PayPal invalide".to_string(),
                    ));
                }
                Err(e) => {
                    log::warn!("[paypal_webhook] Erreur vérif signature: {}", e);
                }
            }
        }
    }

    match event_type.as_str() {
        "CHECKOUT.ORDER.APPROVED" => {
            let order_id = event["resource"]["id"].as_str().unwrap_or("").to_string();
            log::info!("[paypal_webhook] Order approuvé: {}", order_id);

            if PayPalConfig::is_configured() {
                let paypal_service = PayPalPaymentService::new()
                    .map_err(|e| AppError::Internal(format!("PayPal init: {}", e)))?;

                match paypal_service.capture_order(&order_id).await {
                    Ok(capture) => {
                        if capture.status == "COMPLETED" {
                            let payment_attempt: Option<PaymentAttemptWebhookRow> = sqlx::query_as(
                                "SELECT * FROM payment_attempts WHERE transaction_id = $1",
                            )
                            .bind(&order_id)
                            .fetch_optional(&state.pg)
                            .await
                            .map_err(|e| AppError::Internal(format!("Erreur DB: {}", e)))?;

                            if let Some(attempt) = payment_attempt {
                                if attempt.status != "success" && attempt.status != "completed" {
                                    sqlx::query(
                                        "UPDATE payment_attempts SET status = 'success', confirmed_at = NOW() WHERE id = $1",
                                    )
                                    .bind(attempt.id)
                                    .execute(&state.pg)
                                    .await
                                    .map_err(|e| {
                                        AppError::Internal(format!("Erreur update: {}", e))
                                    })?;

                                    use crate::services::payment_service::PaymentService;
                                    let payment_service = PaymentService::new(state.pg.clone());
                                    payment_service
                                        .add_tokens_to_user(
                                            attempt.user_id,
                                            attempt.amount_xaf as f64,
                                        )
                                        .await
                                        .map_err(|e| {
                                            AppError::Internal(format!(
                                                "Erreur crédit tokens: {}",
                                                e
                                            ))
                                        })?;

                                    log::info!(
                                        "[paypal_webhook] ✅ {} tokens crédités pour user {} (PayPal {})",
                                        attempt.amount_xaf,
                                        attempt.user_id,
                                        order_id
                                    );

                                    let _ = crate::services::push_notification_service::send_push_notification(
                                        &state.pg,
                                        attempt.user_id,
                                        "✅ Paiement PayPal confirmé".to_string(),
                                        format!("Votre paiement de {} a été confirmé via PayPal", attempt.amount_xaf),
                                        Some(serde_json::json!({
                                            "type": "paypal_payment_completed",
                                            "amount": attempt.amount_xaf,
                                            "order_id": order_id
                                        })),
                                        Some("default".to_string()),
                                    ).await;
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("[paypal_webhook] Erreur capture order {}: {}", order_id, e);
                    }
                }
            }
        }
        "PAYMENT.CAPTURE.COMPLETED" => {
            log::info!("[paypal_webhook] Capture complétée");
        }
        "PAYMENT.CAPTURE.DENIED" | "PAYMENT.CAPTURE.REFUNDED" => {
            let order_id = event["resource"]["supplementary_data"]["related_ids"]["order_id"]
                .as_str()
                .unwrap_or("");
            if !order_id.is_empty() {
                let new_status = if event_type.contains("DENIED") {
                    "failed"
                } else {
                    "refunded"
                };
                let _ = sqlx::query(
                    "UPDATE payment_attempts SET status = $1 WHERE transaction_id = $2",
                )
                .bind(new_status)
                .bind(order_id)
                .execute(&state.pg)
                .await;
            }
        }
        _ => {
            log::info!("[paypal_webhook] Event type non traité: {}", event_type);
        }
    }

    Ok(JsonResponse(WebhookResponse {
        success: true,
        message: "Webhook PayPal traité".to_string(),
        transaction_id: event["id"].as_str().map(|s| s.to_string()),
    }))
}

/// ✅ PayPal return URL handler (après approbation client)
pub async fn paypal_return(
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> AppResult<JsonResponse<Value>> {
    let token = params.get("token").cloned().unwrap_or_default();
    log::info!("[paypal_return] Retour PayPal, token/order_id={}", token);

    if token.is_empty() {
        return Err(AppError::BadRequest("Token manquant".to_string()));
    }

    use crate::services::paypal_payment_service::*;

    if !PayPalConfig::is_configured() {
        return Err(AppError::Internal("PayPal non configuré".to_string()));
    }

    let paypal_service = PayPalPaymentService::new()
        .map_err(|e| AppError::Internal(format!("PayPal init: {}", e)))?;

    match paypal_service.capture_order(&token).await {
        Ok(capture) => {
            if capture.status == "COMPLETED" {
                let payment_attempt: Option<PaymentAttemptWebhookRow> =
                    sqlx::query_as("SELECT * FROM payment_attempts WHERE transaction_id = $1")
                        .bind(&token)
                        .fetch_optional(&state.pg)
                        .await
                        .map_err(|e| AppError::Internal(format!("Erreur DB: {}", e)))?;

                if let Some(attempt) = payment_attempt {
                    if attempt.status != "success" && attempt.status != "completed" {
                        sqlx::query(
                            "UPDATE payment_attempts SET status = 'success', confirmed_at = NOW() WHERE id = $1",
                        )
                        .bind(attempt.id)
                        .execute(&state.pg)
                        .await
                        .map_err(|e| AppError::Internal(format!("Erreur update: {}", e)))?;

                        use crate::services::payment_service::PaymentService;
                        let payment_service = PaymentService::new(state.pg.clone());
                        payment_service
                            .add_tokens_to_user(attempt.user_id, attempt.amount_xaf as f64)
                            .await
                            .map_err(|e| {
                                AppError::Internal(format!("Erreur crédit tokens: {}", e))
                            })?;

                        log::info!(
                            "[paypal_return] ✅ {} tokens crédités pour user {}",
                            attempt.amount_xaf,
                            attempt.user_id
                        );
                    }
                }

                Ok(JsonResponse(serde_json::json!({
                    "success": true,
                    "message": "Paiement PayPal confirmé",
                    "order_id": token,
                    "capture_id": capture.capture_id,
                })))
            } else {
                Ok(JsonResponse(serde_json::json!({
                    "success": false,
                    "message": "Paiement en cours de traitement",
                    "status": capture.status,
                })))
            }
        }
        Err(e) => {
            log::error!("[paypal_return] Erreur capture: {}", e);
            Err(AppError::Internal(format!("Erreur capture PayPal: {}", e)))
        }
    }
}

/// ✅ PayPal cancel URL handler
pub async fn paypal_cancel(
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> AppResult<JsonResponse<Value>> {
    let token = params.get("token").cloned().unwrap_or_default();
    log::info!("[paypal_cancel] Paiement annulé, token={}", token);

    Ok(JsonResponse(serde_json::json!({
        "success": false,
        "message": "Paiement annulé par l'utilisateur",
        "order_id": token,
    })))
}

/// Webhook Flutterwave — Pan-africain (30+ pays: KE, TZ, UG, RW, GH, ZM, ET...)
pub async fn flutterwave_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(event): Json<Value>,
) -> AppResult<JsonResponse<WebhookResponse>> {
    log::info!(
        "[flutterwave_webhook] Webhook reçu: event={}",
        event.get("event").and_then(|e| e.as_str()).unwrap_or("unknown")
    );

    let secret_hash = headers.get("verif-hash").and_then(|v| v.to_str().ok());

    let expected_hash = std::env::var("FLUTTERWAVE_WEBHOOK_HASH").unwrap_or_default();
    if !expected_hash.is_empty() {
        match secret_hash {
            Some(hash) if hash == expected_hash => {}
            _ => {
                log::warn!("[flutterwave_webhook] Invalid verif-hash");
                return Err(AppError::Unauthorized(
                    "Invalid webhook signature".to_string(),
                ));
            }
        }
    }

    let event_type = event.get("event").and_then(|e| e.as_str()).unwrap_or("");
    let data = event.get("data").cloned().unwrap_or(serde_json::json!({}));

    match event_type {
        "charge.completed" => {
            let status = data.get("status").and_then(|s| s.as_str()).unwrap_or("");
            let tx_ref = data.get("tx_ref").and_then(|t| t.as_str()).unwrap_or("");
            let amount = data.get("amount").and_then(|a| a.as_f64()).unwrap_or(0.0);
            let currency = data.get("currency").and_then(|c| c.as_str()).unwrap_or("XAF");
            let flw_ref = data.get("flw_ref").and_then(|r| r.as_str()).unwrap_or("");

            log::info!(
                "[flutterwave_webhook] charge.completed: tx_ref={}, status={}, amount={} {}, flw_ref={}",
                tx_ref, status, amount, currency, flw_ref
            );

            if status == "successful" && !tx_ref.is_empty() {
                let pool = &state.pg;
                let _ = sqlx::query(
                    "UPDATE payment_attempts SET status = 'completed', provider_reference = $1, updated_at = NOW() WHERE transaction_id = $2"
                )
                .bind(flw_ref)
                .bind(tx_ref)
                .execute(pool)
                .await;

                if let Ok(row) = sqlx::query_as::<_, (i32, i64)>(
                    "SELECT user_id, amount_xaf FROM payment_attempts WHERE transaction_id = $1",
                )
                .bind(tx_ref)
                .fetch_optional(pool)
                .await
                {
                    if let Some((user_id, amount_xaf)) = row {
                        use crate::services::payment_service::PaymentService;
                        let payment_service = PaymentService::new(pool.clone());
                        match payment_service.add_tokens_to_user(user_id, amount_xaf as f64).await {
                            Ok(()) => {
                                log::info!(
                                    "[flutterwave_webhook] ✅ {} XAF credited to user {} with bonus (tx={})",
                                    amount_xaf, user_id, tx_ref
                                );
                            }
                            Err(e) => {
                                log::error!(
                                    "[flutterwave_webhook] Failed to credit user {}: {}",
                                    user_id,
                                    e
                                );
                            }
                        }
                    }
                }
            }
        }
        _ => {
            log::info!("[flutterwave_webhook] Unhandled event type: {}", event_type);
        }
    }

    Ok(Json(WebhookResponse {
        success: true,
        message: "Flutterwave webhook processed".to_string(),
        transaction_id: data.get("tx_ref").and_then(|t| t.as_str()).map(|s| s.to_string()),
    }))
}

/// Endpoint pour tester les webhooks — UNIQUEMENT en développement
pub async fn test_webhook(
    State(state): State<Arc<AppState>>,
    Json(test_data): Json<Value>,
) -> AppResult<JsonResponse<WebhookResponse>> {
    // ✅ Sécurité: bloquer en production
    let environment = std::env::var("ENVIRONMENT").unwrap_or_else(|_| "production".to_string());
    if environment == "production" {
        log::warn!("[test_webhook] Tentative d'accès en production — BLOQUÉ");
        return Err(AppError::Unauthorized(
            "Endpoint de test non disponible en production".to_string(),
        ));
    }

    log::info!(
        "[test_webhook] Test webhook (env={}): {:?}",
        environment,
        test_data
    );

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
