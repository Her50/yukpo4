use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// Structures pour mapper les résultats des requêtes dynamiques
#[derive(Debug, sqlx::FromRow)]
struct PaymentRecord {
    #[allow(dead_code)]
    id: i32,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct PaymentHistoryRow {
    transaction_id: String,
    user_id: i32,
    amount: f64, // Utiliser f64 au lieu de rust_decimal::Decimal
    currency: String,
    payment_method: String,
    status: String,
    created_at: chrono::DateTime<chrono::Utc>,
    gateway_response: Option<serde_json::Value>,
    tokens_added: Option<i32>,
    bonus_tokens: Option<i32>,
    total_tokens: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentRequest {
    pub user_id: i32,
    pub amount: f64,
    pub currency: String,
    pub payment_method: PaymentMethod,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum PaymentMethod {
    OrangeMoney {
        phone_number: String,
        country_code: String,
    },
    MTNMoney {
        phone_number: String,
        country_code: String,
    },
    Visa {
        card_number: String,
        expiry_date: String,
        cvv: String,
        cardholder_name: String,
    },
    PayPal {
        email: String,
    },
    BankTransfer {
        account_number: String,
        bank_code: String,
        account_name: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentResponse {
    pub transaction_id: String,
    pub status: PaymentStatus,
    pub amount: f64,
    pub currency: String,
    pub payment_method: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub reference: Option<String>,
    pub gateway_response: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum PaymentStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Cancelled,
    Refunded,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentReceipt {
    pub transaction_id: String,
    pub user_id: i32,
    pub amount: f64,
    pub currency: String,
    pub payment_method: String,
    pub status: PaymentStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub tokens_added: i32,
    pub bonus_tokens: i32,
    pub total_tokens: i32,
    pub reference: Option<String>,
}

pub struct PaymentService {
    pool: PgPool,
}

impl PaymentService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Traiter un paiement
    pub async fn process_payment(
        &self,
        request: PaymentRequest,
    ) -> Result<PaymentResponse, String> {
        let transaction_id = Uuid::new_v4().to_string();

        // Enregistrer la transaction en base
        let payment_record = sqlx::query_as::<_, PaymentRecord>(
            r#"
            INSERT INTO payment_transactions 
            (transaction_id, user_id, amount, currency, payment_method, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, created_at
            "#,
        )
        .bind(&transaction_id)
        .bind(request.user_id)
        .bind(request.amount)
        .bind(&request.currency)
        .bind(serde_json::to_string(&request.payment_method).unwrap())
        .bind("pending")
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Erreur base de données: {}", e))?;

        // Traiter selon la méthode de paiement
        let (status, gateway_response) = match &request.payment_method {
            PaymentMethod::OrangeMoney {
                phone_number,
                country_code,
            } => {
                self.process_orange_money_payment(
                    &transaction_id,
                    phone_number,
                    country_code,
                    request.amount,
                )
                .await?
            }
            PaymentMethod::MTNMoney {
                phone_number,
                country_code,
            } => {
                self.process_mtn_money_payment(
                    &transaction_id,
                    phone_number,
                    country_code,
                    request.amount,
                )
                .await?
            }
            PaymentMethod::Visa {
                card_number,
                expiry_date,
                cvv,
                cardholder_name,
            } => {
                self.process_visa_payment(
                    &transaction_id,
                    card_number,
                    expiry_date,
                    cvv,
                    cardholder_name,
                    request.amount,
                )
                .await?
            }
            PaymentMethod::PayPal { email } => {
                self.process_paypal_payment(&transaction_id, email, request.amount).await?
            }
            PaymentMethod::BankTransfer {
                account_number,
                bank_code,
                account_name,
            } => {
                self.process_bank_transfer(
                    &transaction_id,
                    account_number,
                    bank_code,
                    account_name,
                    request.amount,
                )
                .await?
            }
        };

        // Mettre à jour le statut
        sqlx::query(
            "UPDATE payment_transactions SET status = $1, gateway_response = $2 WHERE transaction_id = $3"
        )
        .bind(serde_json::to_string(&status).unwrap())
        .bind(&gateway_response)
        .bind(&transaction_id)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Erreur mise à jour: {}", e))?;

        // Si le paiement est réussi, ajouter les tokens
        if matches!(status, PaymentStatus::Completed) {
            self.add_tokens_to_user(request.user_id, request.amount).await?;
        }

        Ok(PaymentResponse {
            transaction_id,
            status,
            amount: request.amount,
            currency: request.currency,
            payment_method: format!("{:?}", request.payment_method),
            created_at: payment_record.created_at,
            reference: None,
            gateway_response,
        })
    }

    /// Traiter un paiement Orange Money
    async fn process_orange_money_payment(
        &self,
        transaction_id: &str,
        phone_number: &str,
        country_code: &str,
        amount: f64,
    ) -> Result<(PaymentStatus, Option<serde_json::Value>), String> {
        // ✅ Phase 10 - Utiliser le service Mobile Money
        use crate::services::mobile_money_service::{
            MobileMoneyPaymentRequest, MobileMoneyProvider, MobileMoneyService,
        };

        let mobile_money_service = MobileMoneyService::new();

        let request = MobileMoneyPaymentRequest {
            provider: MobileMoneyProvider::Orange,
            phone_number: format!("{}{}", country_code, phone_number),
            amount,
            currency: "XAF".to_string(),
            transaction_reference: transaction_id.to_string(),
            description: Some("Paiement Yukpo".to_string()),
            callback_url: None,
        };

        match mobile_money_service.initiate_payment(request).await {
            Ok(response) => {
                let gateway_response = serde_json::json!({
                    "provider": "orange_money",
                    "transaction_reference": format!("OM_{}", transaction_id),
                    "provider_transaction_id": response.provider_transaction_id,
                    "status": format!("{:?}", response.status),
                    "phone_number": phone_number,
                    "country_code": country_code,
                    "amount": amount,
                    "instructions": response.instructions,
                    "timestamp": chrono::Utc::now()
                });

                let status = match response.status {
                    crate::services::mobile_money_service::PaymentStatus::Completed => {
                        PaymentStatus::Completed
                    }
                    crate::services::mobile_money_service::PaymentStatus::Pending => {
                        PaymentStatus::Pending
                    }
                    crate::services::mobile_money_service::PaymentStatus::Processing => {
                        PaymentStatus::Processing
                    }
                    crate::services::mobile_money_service::PaymentStatus::Failed => {
                        PaymentStatus::Failed
                    }
                    crate::services::mobile_money_service::PaymentStatus::Cancelled => {
                        PaymentStatus::Cancelled
                    }
                };

                Ok((status, Some(gateway_response)))
            }
            Err(e) => {
                log::error!("[PaymentService] Erreur Orange Money: {}", e);
                // Fallback: simulation
                let gateway_response = serde_json::json!({
                    "provider": "orange_money",
                    "transaction_reference": format!("OM_{}", transaction_id),
                    "status": "pending",
                    "phone_number": phone_number,
                    "country_code": country_code,
                    "amount": amount,
                    "error": e.to_string(),
                    "timestamp": chrono::Utc::now()
                });
                Ok((PaymentStatus::Pending, Some(gateway_response)))
            }
        }
    }

    /// Traiter un paiement MTN Money
    async fn process_mtn_money_payment(
        &self,
        transaction_id: &str,
        phone_number: &str,
        country_code: &str,
        amount: f64,
    ) -> Result<(PaymentStatus, Option<serde_json::Value>), String> {
        // ✅ Phase 10 - Utiliser le service Mobile Money
        use crate::services::mobile_money_service::{
            MobileMoneyPaymentRequest, MobileMoneyProvider, MobileMoneyService,
        };

        let mobile_money_service = MobileMoneyService::new();

        let request = MobileMoneyPaymentRequest {
            provider: MobileMoneyProvider::MTN,
            phone_number: format!("{}{}", country_code, phone_number),
            amount,
            currency: "XAF".to_string(),
            transaction_reference: transaction_id.to_string(),
            description: Some("Paiement Yukpo".to_string()),
            callback_url: None,
        };

        match mobile_money_service.initiate_payment(request).await {
            Ok(response) => {
                let gateway_response = serde_json::json!({
                    "provider": "mtn_money",
                    "transaction_reference": format!("MTN_{}", transaction_id),
                    "provider_transaction_id": response.provider_transaction_id,
                    "status": format!("{:?}", response.status),
                    "phone_number": phone_number,
                    "country_code": country_code,
                    "amount": amount,
                    "instructions": response.instructions,
                    "timestamp": chrono::Utc::now()
                });

                let status = match response.status {
                    crate::services::mobile_money_service::PaymentStatus::Completed => {
                        PaymentStatus::Completed
                    }
                    crate::services::mobile_money_service::PaymentStatus::Pending => {
                        PaymentStatus::Pending
                    }
                    crate::services::mobile_money_service::PaymentStatus::Processing => {
                        PaymentStatus::Processing
                    }
                    crate::services::mobile_money_service::PaymentStatus::Failed => {
                        PaymentStatus::Failed
                    }
                    crate::services::mobile_money_service::PaymentStatus::Cancelled => {
                        PaymentStatus::Cancelled
                    }
                };

                Ok((status, Some(gateway_response)))
            }
            Err(e) => {
                log::error!("[PaymentService] Erreur MTN Money: {}", e);
                // Fallback: simulation
                let gateway_response = serde_json::json!({
                    "provider": "mtn_money",
                    "transaction_reference": format!("MTN_{}", transaction_id),
                    "status": "pending",
                    "phone_number": phone_number,
                    "country_code": country_code,
                    "amount": amount,
                    "error": e.to_string(),
                    "timestamp": chrono::Utc::now()
                });
                Ok((PaymentStatus::Pending, Some(gateway_response)))
            }
        }
    }

    /// Traiter un paiement Visa/Mastercard via Stripe (temporairement désactivé)
    async fn process_visa_payment(
        &self,
        transaction_id: &str,
        card_number: &str,
        _expiry_date: &str,
        _cvv: &str,
        cardholder_name: &str,
        amount: f64,
    ) -> Result<(PaymentStatus, Option<serde_json::Value>), String> {
        // TODO: Réactiver l'intégration Stripe une fois les dépendances corrigées
        // Pour l'instant, on simule un paiement réussi
        let gateway_response = serde_json::json!({
            "transaction_id": transaction_id,
            "payment_method": "visa",
            "status": "succeeded",
            "card_last_four": &card_number[card_number.len()-4..],
            "cardholder_name": cardholder_name,
            "amount": amount,
            "currency": "XAF",
            "timestamp": chrono::Utc::now(),
            "note": "Simulation - intégration Stripe temporairement désactivée"
        });

        Ok((PaymentStatus::Completed, Some(gateway_response)))
    }

    /// Traiter un paiement PayPal via PayPal API
    async fn process_paypal_payment(
        &self,
        transaction_id: &str,
        email: &str,
        amount: f64,
    ) -> Result<(PaymentStatus, Option<serde_json::Value>), String> {
        // Intégration PayPal API v2
        let client_id = std::env::var("PAYPAL_CLIENT_ID")
            .unwrap_or_else(|_| "AQRUN1tXj3nXO9JLxX9mXfYfYfYfYfYfYfYfYf".to_string());
        let client_secret = std::env::var("PAYPAL_CLIENT_SECRET")
            .unwrap_or_else(|_| "EHOaP8N8P8N8P8N8P8N8P8N8P8N8P8N8P8N8P8N".to_string());
        let base_url = if client_id.starts_with("AQRUN") {
            "https://api-m.sandbox.paypal.com"
        } else {
            "https://api-m.paypal.com"
        };

        // 1. Obtenir le token d'accès PayPal
        let auth_response = reqwest::Client::new()
            .post(&format!("{}/v1/oauth2/token", base_url))
            .basic_auth(&client_id, Some(&client_secret))
            .form(&[("grant_type", "client_credentials")])
            .send()
            .await
            .map_err(|e| format!("Erreur auth PayPal: {}", e))?;

        let auth_data: serde_json::Value = auth_response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing auth PayPal: {}", e))?;

        let access_token = auth_data
            .get("access_token")
            .and_then(|t| t.as_str())
            .ok_or("Token d'accès PayPal non trouvé")?;

        // 2. Créer l'ordre PayPal
        let order_payload = serde_json::json!({
            "intent": "CAPTURE",
            "purchase_units": [{
                "reference_id": transaction_id,
                "description": format!("Recharge Yukpo Tokens - {}", email),
                "amount": {
                    "currency_code": "XAF",
                    "value": amount.to_string()
                },
                "custom_id": email
            }]
        });

        let order_response = reqwest::Client::new()
            .post(&format!("{}/v2/checkout/orders", base_url))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .json(&order_payload)
            .send()
            .await
            .map_err(|e| format!("Erreur création ordre PayPal: {}", e))?;

        let order_data: serde_json::Value = order_response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing ordre PayPal: {}", e))?;

        let order_id = order_data
            .get("id")
            .and_then(|id| id.as_str())
            .ok_or("ID ordre PayPal non trouvé")?;

        // 3. Capturer le paiement (en production, il faudrait attendre l'approbation utilisateur)
        // Pour la recharge, nous capturons directement
        let capture_response = reqwest::Client::new()
            .post(&format!(
                "{}/v2/checkout/orders/{}/capture",
                base_url, order_id
            ))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({}))
            .send()
            .await
            .map_err(|e| format!("Erreur capture paiement PayPal: {}", e))?;

        let capture_data: serde_json::Value = capture_response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing capture PayPal: {}", e))?;

        let status = capture_data.get("status").and_then(|s| s.as_str()).unwrap_or("FAILED");

        let gateway_response = serde_json::json!({
            "provider": "paypal",
            "transaction_reference": format!("PP_{}", transaction_id),
            "paypal_order_id": order_id,
            "status": status,
            "email": email,
            "amount": amount,
            "currency": "XAF",
            "timestamp": chrono::Utc::now(),
            "capture_data": capture_data
        });

        let payment_status = match status {
            "COMPLETED" => PaymentStatus::Completed,
            "APPROVED" => PaymentStatus::Processing,
            "PENDING" => PaymentStatus::Pending,
            "FAILED" | "VOIDED" => PaymentStatus::Failed,
            _ => PaymentStatus::Failed,
        };

        Ok((payment_status, Some(gateway_response)))
    }

    /// Traiter un virement bancaire
    async fn process_bank_transfer(
        &self,
        transaction_id: &str,
        account_number: &str,
        bank_code: &str,
        account_name: &str,
        amount: f64,
    ) -> Result<(PaymentStatus, Option<serde_json::Value>), String> {
        // Les virements bancaires sont généralement en attente
        let gateway_response = serde_json::json!({
            "provider": "bank_transfer",
            "transaction_reference": format!("BANK_{}", transaction_id),
            "status": "pending",
            "account_number": account_number,
            "bank_code": bank_code,
            "account_name": account_name,
            "amount": amount,
            "timestamp": chrono::Utc::now()
        });

        Ok((PaymentStatus::Pending, Some(gateway_response)))
    }

    /// Ajouter des tokens à un utilisateur
    pub async fn add_tokens_to_user(&self, user_id: i32, amount: f64) -> Result<(), String> {
        // Calculer les tokens (1 XAF = 1 token)
        let tokens = amount as i32;
        let bonus = if amount >= 10000.0 {
            (amount * 0.2) as i32
        } else if amount >= 5000.0 {
            (amount * 0.1) as i32
        } else if amount >= 2000.0 {
            (amount * 0.05) as i32
        } else {
            0
        };

        let total_tokens = tokens + bonus;

        // Mettre à jour le solde de l'utilisateur (requête dynamique pour éviter les problèmes de compilation)
        sqlx::query("UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2")
            .bind(total_tokens as i64)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("Erreur mise à jour solde: {}", e))?;

        // Enregistrer la transaction de tokens
        sqlx::query(
            r#"
            INSERT INTO token_transactions 
            (user_id, amount, bonus, total, transaction_type, description, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            "#,
        )
        .bind(user_id)
        .bind(tokens as i32)
        .bind(bonus as i32)
        .bind(total_tokens as i32)
        .bind("recharge")
        .bind(format!("Recharge de {} XAF", amount))
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Erreur enregistrement transaction: {}", e))?;

        Ok(())
    }

    /// Obtenir l'historique des paiements d'un utilisateur
    pub async fn get_payment_history(
        &self,
        user_id: i32,
        limit: i32,
        offset: i32,
    ) -> Result<Vec<PaymentReceipt>, String> {
        let payments = sqlx::query_as::<_, PaymentHistoryRow>(
            r#"
            SELECT 
                pt.transaction_id,
                pt.user_id,
                pt.amount,
                pt.currency,
                pt.payment_method,
                pt.status,
                pt.created_at,
                pt.gateway_response,
                tt.amount as tokens_added,
                tt.bonus as bonus_tokens,
                tt.total as total_tokens
            FROM payment_transactions pt
            LEFT JOIN token_transactions tt ON pt.transaction_id = tt.transaction_id
            WHERE pt.user_id = $1
            ORDER BY pt.created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Erreur récupération historique: {}", e))?;

        let receipts = payments
            .into_iter()
            .map(|payment| PaymentReceipt {
                transaction_id: payment.transaction_id,
                user_id: payment.user_id,
                amount: payment.amount,
                currency: payment.currency,
                payment_method: payment.payment_method,
                status: serde_json::from_str(&payment.status).unwrap_or(PaymentStatus::Pending),
                created_at: payment.created_at,
                tokens_added: payment.tokens_added.unwrap_or(0),
                bonus_tokens: payment.bonus_tokens.unwrap_or(0),
                total_tokens: payment.total_tokens.unwrap_or(0),
                reference: payment.gateway_response.and_then(|gr| {
                    serde_json::from_value::<serde_json::Value>(gr).ok().and_then(|v| {
                        v.get("transaction_reference")
                            .and_then(|r| r.as_str().map(|s| s.to_string()))
                    })
                }),
            })
            .collect();

        Ok(receipts)
    }

    /// Obtenir un reçu de paiement
    pub async fn get_payment_receipt(
        &self,
        transaction_id: &str,
    ) -> Result<Option<PaymentReceipt>, String> {
        let payment = sqlx::query_as::<_, PaymentHistoryRow>(
            r#"
            SELECT 
                pt.transaction_id,
                pt.user_id,
                pt.amount,
                pt.currency,
                pt.payment_method,
                pt.status,
                pt.created_at,
                pt.gateway_response,
                tt.amount as tokens_added,
                tt.bonus as bonus_tokens,
                tt.total as total_tokens
            FROM payment_transactions pt
            LEFT JOIN token_transactions tt ON pt.transaction_id = tt.transaction_id
            WHERE pt.transaction_id = $1
            "#,
        )
        .bind(transaction_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("Erreur récupération reçu: {}", e))?;

        if let Some(payment) = payment {
            Ok(Some(PaymentReceipt {
                transaction_id: payment.transaction_id,
                user_id: payment.user_id,
                amount: payment.amount,
                currency: payment.currency,
                payment_method: payment.payment_method,
                status: serde_json::from_str(&payment.status).unwrap_or(PaymentStatus::Pending),
                created_at: payment.created_at,
                tokens_added: payment.tokens_added.unwrap_or(0),
                bonus_tokens: payment.bonus_tokens.unwrap_or(0),
                total_tokens: payment.total_tokens.unwrap_or(0),
                reference: payment.gateway_response.and_then(|gr| {
                    serde_json::from_value::<serde_json::Value>(gr).ok().and_then(|v| {
                        v.get("transaction_reference")
                            .and_then(|r| r.as_str().map(|s| s.to_string()))
                    })
                }),
            }))
        } else {
            Ok(None)
        }
    }
}
