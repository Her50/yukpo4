use crate::state::AppState;
use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    services::mobile_money_service::{
        MobileMoneyPaymentRequest, MobileMoneyProvider, MobileMoneyService,
        PaymentStatus as MobileMoneyStatus,
    },
    services::phone_validation_service::{PhoneValidationRequest, PhoneValidationService},
};
use axum::{
    extract::{Extension, Query, State},
    response::Json as JsonResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use std::sync::Arc;

#[derive(FromRow)]
struct PaymentAttemptRow {
    _id: i32,
    _payment_id: String,
    _user_id: i32,
    amount_xaf: i64,
    _currency: String,
    _payment_method: String,
    _phone_number: Option<String>,
    status: String,
    _transaction_id: Option<String>,
    _created_at: DateTime<Utc>,
    _confirmed_at: Option<DateTime<Utc>>,
}

#[derive(FromRow)]
struct PaymentHistoryRow {
    id: i32,
    amount_xaf: i64,
    currency: String,
    payment_method: String,
    status: String,
    created_at: DateTime<Utc>,
    tokens_purchased: i64,
}

#[derive(Deserialize)]
pub struct InitiatePaymentRequest {
    pub amount_xaf: i64,              // Montant en XAF (tokens)
    pub payment_method: String,       // orange_money, mtn_momo, visa, etc.
    pub currency: String,             // XAF, USD, EUR, etc.
    pub phone_number: Option<String>, // Pour mobile money
}

#[derive(Serialize)]
pub struct InitiatePaymentResponse {
    pub payment_id: String,
    pub payment_url: Option<String>,
    pub instructions: String,
    pub status: String,
    pub provider_used: Option<String>,
}

#[derive(Deserialize)]
pub struct ConfirmPaymentRequest {
    pub payment_id: String,
    pub transaction_id: Option<String>, // ID de transaction du provider
    pub status: String,                 // success, failed, pending
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

#[derive(Deserialize)]
pub struct ValidatePhoneRequest {
    pub phone_number: String,
    pub country: Option<String>,
}

#[derive(Serialize)]
pub struct ValidatePhoneResponse {
    pub is_valid: bool,
    pub formatted_number: Option<String>,
    pub country_code: Option<String>,
    pub carrier: Option<String>,
    pub error_message: Option<String>,
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
        return Err(AppError::BadRequest(
            "Montant minimum: 100 tokens".to_string(),
        ));
    }

    // Valider le numéro de téléphone si fourni (pour mobile money)
    if let Some(phone_number) = &req.phone_number {
        let phone_service = PhoneValidationService::new();
        let phone_validation = phone_service.validate_phone_number(PhoneValidationRequest {
            phone_number: phone_number.clone(),
            country: None, // Détection automatique
        });

        if !phone_validation.is_valid {
            return Err(AppError::BadRequest(
                phone_validation
                    .error_message
                    .unwrap_or("Numéro de téléphone invalide".to_string()),
            ));
        }

        log::info!(
            "[initiate_payment] Numéro validé: {} - Pays: {:?} - Opérateur: {:?}",
            phone_number,
            phone_validation.country_code,
            phone_validation.carrier
        );
    }

    // G?n?rer un ID de paiement unique
    let payment_id = format!("pay_{}_{}", user_id, chrono::Utc::now().timestamp());

    // Détection automatique de la devise selon le pays du numéro de téléphone
    let detected_country = req
        .phone_number
        .as_deref()
        .map(crate::services::payment_aggregator::detect_country_from_phone)
        .unwrap_or("cm");
    let actual_currency =
        crate::services::payment_aggregator::currency_for_country(detected_country).to_string();

    // Convertir le montant en XAF-équivalent pour le stockage interne
    let amount_xaf_equivalent = crate::services::payment_aggregator::convert_to_xaf(
        req.amount_xaf as f64,
        &actual_currency,
    );

    log::info!(
        "[initiate_payment] Devise détectée: {} (pays: {}), montant local: {} {}, équivalent XAF: {}",
        actual_currency, detected_country, req.amount_xaf, actual_currency, amount_xaf_equivalent
    );

    // Enregistrer la tentative de paiement en base (avec devise réelle ET équivalent XAF)
    let payment_method = req.payment_method.clone();
    let phone_number = req.phone_number.clone();
    let result = sqlx::query(
        r#"
        INSERT INTO payment_attempts 
        (payment_id, user_id, amount_xaf, currency, payment_method, phone_number, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
        "#
    )
    .bind(&payment_id)
    .bind(user_id)
    .bind(amount_xaf_equivalent) // Stocker l'équivalent XAF (pour le crédit tokens)
    .bind(&actual_currency)      // Stocker la devise RÉELLE (pas celle du mobile)
    .bind(&payment_method)
    .bind(phone_number.as_deref())
    .execute(&state.pg)
    .await;

    if let Err(e) = result {
        log::error!("[initiate_payment] Erreur insertion en base: {}", e);
        return Err(AppError::Internal(
            "Erreur lors de l'enregistrement du paiement".to_string(),
        ));
    }

    // Logique selon le moyen de paiement — via agrégateur (CinetPay/NotchPay/Flutterwave)
    let (payment_url, instructions, provider_used) = match req.payment_method.as_str() {
        "orange_money" | "mtn_momo" => {
            let phone = req.phone_number.clone().unwrap_or_default();
            if phone.is_empty() {
                return Err(AppError::BadRequest(
                    "Numéro requis pour Orange Money / MTN MoMo".to_string(),
                ));
            }

            let mobile_service = MobileMoneyService::new();
            let direct_provider = if req.payment_method == "mtn_momo" {
                MobileMoneyProvider::MTN
            } else {
                MobileMoneyProvider::Orange
            };

            let direct_available = mobile_service.is_provider_available(&direct_provider);

            if direct_available {
                let callback_base = std::env::var("WEBHOOK_BASE_URL")
                    .or_else(|_| std::env::var("BACKEND_URL"))
                    .unwrap_or_else(|_| "https://yukpo-backend-376093909298.europe-west1.run.app".to_string());
                let callback_url = if req.payment_method == "mtn_momo" {
                    format!("{}/webhook/mtn", callback_base)
                } else {
                    format!("{}/webhook/orange", callback_base)
                };

                let direct_request = MobileMoneyPaymentRequest {
                    provider: direct_provider.clone(),
                    phone_number: phone.clone(),
                    amount: req.amount_xaf as f64,
                    currency: actual_currency.clone(),
                    transaction_reference: payment_id.clone(),
                    description: Some(format!("Recharge Yukpo {} {}", req.amount_xaf, actual_currency)),
                    callback_url: Some(callback_url),
                };

                match mobile_service.initiate_payment(direct_request).await {
                    Ok(direct_response) if direct_response.success => {
                        let provider_label = match direct_provider {
                            MobileMoneyProvider::MTN => "mtn_direct",
                            MobileMoneyProvider::Orange => "orange_direct",
                        };
                        let direct_status = match direct_response.status {
                            MobileMoneyStatus::Completed => "success",
                            MobileMoneyStatus::Processing => "processing",
                            MobileMoneyStatus::Cancelled => "cancelled",
                            MobileMoneyStatus::Failed => "failed",
                            MobileMoneyStatus::Pending => "pending",
                        };

                        let _ = sqlx::query(
                            "UPDATE payment_attempts SET status = $1, transaction_id = $2, aggregator_provider = $3, aggregator_ref = $4, payment_url = $5 WHERE payment_id = $6"
                        )
                        .bind(direct_status)
                        .bind(direct_response.provider_transaction_id.as_deref().unwrap_or(&payment_id))
                        .bind(provider_label)
                        .bind(direct_response.provider_transaction_id.as_deref().unwrap_or(&payment_id))
                        .bind(Option::<String>::None)
                        .bind(&payment_id)
                        .execute(&state.pg)
                        .await;

                        let instr = direct_response.instructions.unwrap_or_else(|| {
                            "Confirmez le paiement sur votre téléphone.".to_string()
                        });
                        (None, instr, Some(provider_label.to_string()))
                    }
                    Ok(direct_response) => {
                        log::warn!(
                            "[initiate_payment] API directe {} indisponible/échouée, fallback agrégateur: {:?}",
                            req.payment_method,
                            direct_response.error
                        );
                        initiate_via_aggregator(
                            &state,
                            &payment_id,
                            user_id,
                            &req,
                            &actual_currency,
                            "fallback_after_direct",
                        )
                        .await?
                    }
                    Err(e) => {
                        log::warn!(
                            "[initiate_payment] API directe {} erreur, fallback agrégateur: {}",
                            req.payment_method,
                            e
                        );
                        initiate_via_aggregator(
                            &state,
                            &payment_id,
                            user_id,
                            &req,
                            &actual_currency,
                            "fallback_after_direct_error",
                        )
                        .await?
                    }
                }
            } else {
                initiate_via_aggregator(
                    &state,
                    &payment_id,
                    user_id,
                    &req,
                    &actual_currency,
                    "aggregator_only",
                )
                .await?
            }
        }
        "visa" | "mastercard" | "mobile_money" | "wave" | "moov_money" | "airtel_money"
        | "mpesa" | "vodafone_cash" | "free_money" | "tigo_pesa" | "ecocash" => {
            use crate::services::payment_aggregator::*;

            let aggregator = PaymentAggregator::new();
            let channel = match req.payment_method.as_str() {
                "orange_money" => PayChannel::OrangeMoney,
                "mtn_momo" => PayChannel::MtnMoney,
                "wave" => PayChannel::Wave,
                "moov_money" => PayChannel::MoovMoney,
                "airtel_money" => PayChannel::AirtelMoney,
                "mpesa" => PayChannel::Mpesa,
                "vodafone_cash" => PayChannel::VodafoneCash,
                "free_money" => PayChannel::FreeMoney,
                "tigo_pesa" => PayChannel::TigoPesa,
                "ecocash" => PayChannel::EcoCash,
                "visa" | "mastercard" => PayChannel::Visa,
                _ => PayChannel::AllMobileMoney,
            };

            // Réutiliser la devise déjà détectée plus haut (actual_currency)
            let agg_request = InitPaymentRequest {
                user_id,
                amount: req.amount_xaf, // Montant dans la devise locale de l'utilisateur
                currency: actual_currency.clone(),
                channel,
                phone_number: req.phone_number.clone(),
                description: format!("Recharge Yukpo {} {}", req.amount_xaf, actual_currency),
                customer_email: None,
                customer_name: None,
                metadata: Some(serde_json::json!({"payment_id": &payment_id, "user_id": user_id})),
            };

            match aggregator.initiate_payment(agg_request).await {
                Ok(response) => {
                    // Sauvegarder la référence agrégateur et l'URL de paiement
                    let _ = sqlx::query(
                        "UPDATE payment_attempts SET transaction_id = $1, aggregator_provider = $2, aggregator_ref = $3, payment_url = $4 WHERE payment_id = $5"
                    )
                    .bind(&response.provider_reference)
                    .bind(&response.provider.to_string())
                    .bind(&response.provider_reference)
                    .bind(&response.payment_url)
                    .bind(&payment_id)
                    .execute(&state.pg)
                    .await;

                    let instr = response.instructions.unwrap_or_else(|| {
                        if response.payment_url.is_some() {
                            "Validez le paiement via la page sécurisée.".to_string()
                        } else {
                            "Confirmez le paiement sur votre téléphone.".to_string()
                        }
                    });
                    (response.payment_url, instr, Some(response.provider.to_string()))
                }
                Err(e) => {
                    log::error!("[initiate_payment] Erreur agrégateur: {}", e);
                    return Err(AppError::Internal(format!("Erreur paiement: {}", e)));
                }
            }
        }
        "stripe" | "stripe_card" | "apple_pay" | "google_pay" | "amex" => {
            use crate::services::stripe_payment_service::*;

            if !StripeConfig::is_configured() {
                return Err(AppError::BadRequest(
                    "Stripe non configuré. Contactez le support.".to_string(),
                ));
            }

            let stripe_service = StripePaymentService::new()
                .map_err(|e| AppError::Internal(format!("Erreur init Stripe: {}", e)))?;

            let stripe_currency = StripeCurrency::from_str(&req.currency);
            let amount_cents = if stripe_currency.is_zero_decimal() {
                req.amount_xaf
            } else {
                req.amount_xaf * 100
            };

            let mut metadata = std::collections::HashMap::new();
            metadata.insert("payment_id".to_string(), payment_id.clone());
            metadata.insert("user_id".to_string(), user_id.to_string());
            metadata.insert("platform".to_string(), "yukpo".to_string());

            let stripe_request = StripePaymentRequest {
                amount_cents,
                currency: stripe_currency,
                payment_method_types: vec!["card".to_string()],
                description: format!("Recharge Yukpo {} {}", req.amount_xaf, req.currency),
                customer_email: None,
                customer_name: None,
                metadata,
            };

            match stripe_service.create_payment_intent(stripe_request).await {
                Ok(response) => {
                    let _ = sqlx::query(
                        "UPDATE payment_attempts SET transaction_id = $1, aggregator_provider = 'stripe', payment_url = $2 WHERE payment_id = $3"
                    )
                    .bind(&response.payment_intent_id)
                    .bind(&response.client_secret)
                    .bind(&payment_id)
                    .execute(&state.pg)
                    .await;

                    (
                        Some(response.client_secret),
                        format!(
                            "Paiement sécurisé via Stripe. Publishable key: {}",
                            response.publishable_key
                        ),
                        Some("stripe".to_string()),
                    )
                }
                Err(e) => {
                    log::error!("[initiate_payment] Erreur Stripe: {}", e);
                    return Err(AppError::Internal(format!("Erreur Stripe: {}", e)));
                }
            }
        }
        "paypal" => {
            use crate::services::paypal_payment_service::*;

            if !PayPalConfig::is_configured() {
                return Err(AppError::BadRequest(
                    "PayPal non configuré. Contactez le support.".to_string(),
                ));
            }

            let paypal_service = PayPalPaymentService::new()
                .map_err(|e| AppError::Internal(format!("Erreur init PayPal: {}", e)))?;

            let paypal_currency = PayPalCurrency::from_str(&req.currency);

            let paypal_request = PayPalOrderRequest {
                amount: req.amount_xaf as f64,
                currency: paypal_currency,
                description: format!("Recharge Yukpo {} {}", req.amount_xaf, req.currency),
                reference_id: payment_id.clone(),
                payer_email: None,
                custom_id: Some(format!("user_{}", user_id)),
            };

            match paypal_service.create_order(paypal_request).await {
                Ok(response) => {
                    let _ = sqlx::query(
                        "UPDATE payment_attempts SET transaction_id = $1, aggregator_provider = 'paypal', payment_url = $2 WHERE payment_id = $3"
                    )
                    .bind(&response.order_id)
                    .bind(&response.approval_url)
                    .bind(&payment_id)
                    .execute(&state.pg)
                    .await;

                    (
                        response.approval_url,
                        "Redirection vers PayPal pour finaliser le paiement.".to_string(),
                        Some("paypal".to_string()),
                    )
                }
                Err(e) => {
                    log::error!("[initiate_payment] Erreur PayPal: {}", e);
                    return Err(AppError::Internal(format!("Erreur PayPal: {}", e)));
                }
            }
        }
        "bank_transfer" => {
            (
                None,
                "Effectuez un virement bancaire vers le compte Yukpo. Les tokens seront crédités après réception.".to_string(),
                Some("bank_transfer".to_string()),
            )
        }
        _ => {
            return Err(AppError::BadRequest(
                "Moyen de paiement non supporté. Utilisez: orange_money, mtn_momo, visa, mastercard, stripe, paypal, apple_pay, google_pay, bank_transfer".to_string(),
            ));
        }
    };

    log::info!(
        "[initiate_payment] Paiement initi? pour utilisateur {}: {} XAF via {}",
        user_id,
        req.amount_xaf,
        req.payment_method
    );

    Ok(Json(InitiatePaymentResponse {
        payment_id,
        payment_url,
        instructions,
        status: "pending".to_string(),
        provider_used,
    }))
}

async fn initiate_via_aggregator(
    state: &Arc<AppState>,
    payment_id: &str,
    user_id: i32,
    req: &InitiatePaymentRequest,
    actual_currency: &str,
    reason: &str,
) -> AppResult<(Option<String>, String, Option<String>)> {
    use crate::services::payment_aggregator::*;

    let aggregator = PaymentAggregator::new();
    let channel = match req.payment_method.as_str() {
        "orange_money" => PayChannel::OrangeMoney,
        "mtn_momo" => PayChannel::MtnMoney,
        "wave" => PayChannel::Wave,
        "moov_money" => PayChannel::MoovMoney,
        "airtel_money" => PayChannel::AirtelMoney,
        "mpesa" => PayChannel::Mpesa,
        "vodafone_cash" => PayChannel::VodafoneCash,
        "free_money" => PayChannel::FreeMoney,
        "tigo_pesa" => PayChannel::TigoPesa,
        "ecocash" => PayChannel::EcoCash,
        "visa" | "mastercard" => PayChannel::Visa,
        _ => PayChannel::AllMobileMoney,
    };

    let agg_request = InitPaymentRequest {
        user_id,
        amount: req.amount_xaf,
        currency: actual_currency.to_string(),
        channel,
        phone_number: req.phone_number.clone(),
        description: format!("Recharge Yukpo {} {}", req.amount_xaf, actual_currency),
        customer_email: None,
        customer_name: None,
        metadata: Some(serde_json::json!({
            "payment_id": payment_id,
            "user_id": user_id,
            "routing_reason": reason
        })),
    };

    match aggregator.initiate_payment(agg_request).await {
        Ok(response) => {
            let _ = sqlx::query(
                "UPDATE payment_attempts SET transaction_id = $1, aggregator_provider = $2, aggregator_ref = $3, payment_url = $4 WHERE payment_id = $5"
            )
            .bind(&response.provider_reference)
            .bind(&response.provider.to_string())
            .bind(&response.provider_reference)
            .bind(&response.payment_url)
            .bind(payment_id)
            .execute(&state.pg)
            .await;

            let instr = response.instructions.unwrap_or_else(|| {
                if response.payment_url.is_some() {
                    "Validez le paiement via la page sécurisée.".to_string()
                } else {
                    "Confirmez le paiement sur votre téléphone.".to_string()
                }
            });

            Ok((
                response.payment_url,
                instr,
                Some(response.provider.to_string()),
            ))
        }
        Err(e) => {
            log::error!("[initiate_payment] Erreur agrégateur: {}", e);
            Err(AppError::Internal(format!("Erreur paiement: {}", e)))
        }
    }
}

/// Confirmer un paiement (webhook ou manuel) / Vérifier le statut
pub async fn confirm_payment(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(req): Json<ConfirmPaymentRequest>,
) -> AppResult<JsonResponse<Value>> {
    let user_id = user.id;

    // Récupérer les détails du paiement
    let payment: Option<PaymentAttemptRow> =
        sqlx::query_as("SELECT * FROM payment_attempts WHERE payment_id = $1 AND user_id = $2")
            .bind(&req.payment_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur DB: {}", e)))?;

    let payment = payment.ok_or_else(|| AppError::NotFound("Paiement non trouvé".to_string()))?;

    // Mode "check" — le frontend vérifie simplement le statut actuel
    if req.status == "check" {
        let is_success = payment.status == "success" || payment.status == "completed";
        let tokens_added = if is_success { payment.amount_xaf } else { 0 };
        return Ok(Json(serde_json::json!({
            "success": is_success,
            "status": payment.status,
            "tokens_added": tokens_added,
            "payment_id": req.payment_id
        })));
    }

    // Ne pas re-traiter un paiement déjà finalisé
    if payment.status == "success" || payment.status == "completed" {
        return Ok(Json(serde_json::json!({
            "success": true,
            "message": "Paiement déjà crédité",
            "tokens_added": payment.amount_xaf
        })));
    }

    if payment.status == "failed" || payment.status == "cancelled" || payment.status == "expired" {
        return Ok(Json(serde_json::json!({
            "success": false,
            "status": payment.status,
            "message": "Paiement échoué ou annulé"
        })));
    }

    // ⛔ SÉCURITÉ: Le client NE PEUT PAS confirmer un paiement lui-même.
    // Seuls les webhooks (CinetPay/NotchPay/Flutterwave/Stripe/PayPal) peuvent créditer des tokens.
    // Le client peut uniquement vérifier le statut via status="check" (traité plus haut).
    if req.status == "success" || req.status == "completed" {
        log::warn!(
            "[confirm_payment] ⛔ TENTATIVE DE SELF-CONFIRM BLOQUÉE: user={}, payment_id={}, status={}",
            user_id, req.payment_id, req.status
        );
        return Err(AppError::Forbidden(
            "La confirmation de paiement se fait automatiquement via le fournisseur. Utilisez status='check' pour vérifier.".to_string(),
        ));
    }

    // Mettre à jour le statut du paiement (uniquement pour les statuts d'échec côté client)
    let transaction_id = req.transaction_id.as_deref();
    let allowed_client_statuses = ["failed", "cancelled", "expired"];
    if !allowed_client_statuses.contains(&req.status.as_str()) {
        return Err(AppError::BadRequest(
            "Statut invalide. Utilisez 'check' pour vérifier ou 'cancelled' pour annuler."
                .to_string(),
        ));
    }

    sqlx::query(
        r#"
        UPDATE payment_attempts 
        SET status = $1, transaction_id = COALESCE($2, transaction_id), confirmed_at = NOW()
        WHERE payment_id = $3
        "#,
    )
    .bind(&req.status)
    .bind(transaction_id)
    .bind(&req.payment_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise à jour paiement: {}", e)))?;

    log::info!(
        "[confirm_payment] Paiement {} marqué comme {} par utilisateur {}",
        req.payment_id,
        req.status,
        user_id
    );
    Ok(Json(serde_json::json!({
        "success": false,
        "message": "Paiement marqué comme échoué/annulé",
        "status": req.status
    })))
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

    let payments: Vec<PaymentHistoryRow> = sqlx::query_as(
        r#"
        SELECT id, amount_xaf, currency, payment_method, status, created_at, amount_xaf as tokens_purchased
        FROM payment_attempts 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
        "#
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération historique: {}", e)))?;

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

/// Valider un numéro de téléphone
pub async fn validate_phone_number(
    Json(req): Json<ValidatePhoneRequest>,
) -> AppResult<JsonResponse<ValidatePhoneResponse>> {
    let phone_service = PhoneValidationService::new();
    let validation_result = phone_service.validate_phone_number(PhoneValidationRequest {
        phone_number: req.phone_number,
        country: req.country,
    });

    Ok(Json(ValidatePhoneResponse {
        is_valid: validation_result.is_valid,
        formatted_number: validation_result.formatted_number,
        country_code: validation_result.country_code,
        carrier: validation_result.carrier,
        error_message: validation_result.error_message,
    }))
}
