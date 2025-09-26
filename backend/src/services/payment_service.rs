use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

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
    pub async fn process_payment(&self, request: PaymentRequest) -> Result<PaymentResponse, String> {
        let transaction_id = Uuid::new_v4().to_string();
        
        // Enregistrer la transaction en base
        let payment_record = sqlx::query!(
            r#"
            INSERT INTO payment_transactions 
            (transaction_id, user_id, amount, currency, payment_method, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, created_at
            "#,
            transaction_id,
            request.user_id,
            request.amount,
            request.currency,
            serde_json::to_string(&request.payment_method).unwrap(),
            "pending"
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Erreur base de données: {}", e))?;

        // Traiter selon la méthode de paiement
        let (status, gateway_response) = match request.payment_method {
            PaymentMethod::OrangeMoney { phone_number, country_code } => {
                self.process_orange_money_payment(&transaction_id, &phone_number, &country_code, request.amount).await?
            },
            PaymentMethod::MTNMoney { phone_number, country_code } => {
                self.process_mtn_money_payment(&transaction_id, &phone_number, &country_code, request.amount).await?
            },
            PaymentMethod::Visa { card_number, expiry_date, cvv, cardholder_name } => {
                self.process_visa_payment(&transaction_id, &card_number, &expiry_date, &cvv, &cardholder_name, request.amount).await?
            },
            PaymentMethod::PayPal { email } => {
                self.process_paypal_payment(&transaction_id, &email, request.amount).await?
            },
            PaymentMethod::BankTransfer { account_number, bank_code, account_name } => {
                self.process_bank_transfer(&transaction_id, &account_number, &bank_code, &account_name, request.amount).await?
            },
        };

        // Mettre à jour le statut
        sqlx::query!(
            "UPDATE payment_transactions SET status = $1, gateway_response = $2 WHERE transaction_id = $3",
            serde_json::to_string(&status).unwrap(),
            gateway_response,
            transaction_id
        )
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
        // TODO: Intégration avec l'API Orange Money
        // Pour l'instant, simulation
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        
        // Simuler une réponse de l'API Orange Money
        let gateway_response = serde_json::json!({
            "provider": "orange_money",
            "transaction_reference": format!("OM_{}", transaction_id),
            "status": "success",
            "phone_number": phone_number,
            "country_code": country_code,
            "amount": amount,
            "timestamp": chrono::Utc::now()
        });

        Ok((PaymentStatus::Completed, Some(gateway_response)))
    }

    /// Traiter un paiement MTN Money
    async fn process_mtn_money_payment(
        &self,
        transaction_id: &str,
        phone_number: &str,
        country_code: &str,
        amount: f64,
    ) -> Result<(PaymentStatus, Option<serde_json::Value>), String> {
        // TODO: Intégration avec l'API MTN Money
        // Pour l'instant, simulation
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        
        // Simuler une réponse de l'API MTN Money
        let gateway_response = serde_json::json!({
            "provider": "mtn_money",
            "transaction_reference": format!("MTN_{}", transaction_id),
            "status": "success",
            "phone_number": phone_number,
            "country_code": country_code,
            "amount": amount,
            "timestamp": chrono::Utc::now()
        });

        Ok((PaymentStatus::Completed, Some(gateway_response)))
    }

    /// Traiter un paiement Visa
    async fn process_visa_payment(
        &self,
        transaction_id: &str,
        card_number: &str,
        expiry_date: &str,
        cvv: &str,
        cardholder_name: &str,
        amount: f64,
    ) -> Result<(PaymentStatus, Option<serde_json::Value>), String> {
        // TODO: Intégration avec l'API Visa/Mastercard
        // Pour l'instant, simulation
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        
        // Simuler une réponse de l'API Visa
        let gateway_response = serde_json::json!({
            "provider": "visa",
            "transaction_reference": format!("VISA_{}", transaction_id),
            "status": "success",
            "card_last_four": &card_number[card_number.len()-4..],
            "cardholder_name": cardholder_name,
            "amount": amount,
            "timestamp": chrono::Utc::now()
        });

        Ok((PaymentStatus::Completed, Some(gateway_response)))
    }

    /// Traiter un paiement PayPal
    async fn process_paypal_payment(
        &self,
        transaction_id: &str,
        email: &str,
        amount: f64,
    ) -> Result<(PaymentStatus, Option<serde_json::Value>), String> {
        // TODO: Intégration avec l'API PayPal
        // Pour l'instant, simulation
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        
        // Simuler une réponse de l'API PayPal
        let gateway_response = serde_json::json!({
            "provider": "paypal",
            "transaction_reference": format!("PP_{}", transaction_id),
            "status": "success",
            "email": email,
            "amount": amount,
            "timestamp": chrono::Utc::now()
        });

        Ok((PaymentStatus::Completed, Some(gateway_response)))
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
    async fn add_tokens_to_user(&self, user_id: i32, amount: f64) -> Result<(), String> {
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

        // Mettre à jour le solde de l'utilisateur
        sqlx::query!(
            "UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2",
            total_tokens,
            user_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Erreur mise à jour solde: {}", e))?;

        // Enregistrer la transaction de tokens
        sqlx::query!(
            r#"
            INSERT INTO token_transactions 
            (user_id, amount, bonus, total, transaction_type, description, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            "#,
            user_id,
            tokens,
            bonus,
            total_tokens,
            "recharge",
            format!("Recharge de {} XAF", amount)
        )
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Erreur enregistrement transaction: {}", e))?;

        Ok(())
    }

    /// Obtenir l'historique des paiements d'un utilisateur
    pub async fn get_payment_history(&self, user_id: i32, limit: i32, offset: i32) -> Result<Vec<PaymentReceipt>, String> {
        let payments = sqlx::query!(
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
            user_id,
            limit,
            offset
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Erreur récupération historique: {}", e))?;

        let receipts = payments.into_iter().map(|payment| {
            PaymentReceipt {
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
                    serde_json::from_value::<serde_json::Value>(gr)
                        .ok()
                        .and_then(|v| v.get("transaction_reference").and_then(|r| r.as_str().map(|s| s.to_string())))
                }),
            }
        }).collect();

        Ok(receipts)
    }

    /// Obtenir un reçu de paiement
    pub async fn get_payment_receipt(&self, transaction_id: &str) -> Result<Option<PaymentReceipt>, String> {
        let payment = sqlx::query!(
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
            transaction_id
        )
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
                    serde_json::from_value::<serde_json::Value>(gr)
                        .ok()
                        .and_then(|v| v.get("transaction_reference").and_then(|r| r.as_str().map(|s| s.to_string())))
                }),
            }))
        } else {
            Ok(None)
        }
    }
}

