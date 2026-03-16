// ✅ Phase 5 - Matching Intelligent des Modes de Paiement
// Intégration réelle: wallet interne (user_wallets) + disbursement via agrégateur CinetPay/NotchPay
use crate::core::types::{AppError, AppResult};
use crate::services::payment_aggregator::PaymentAggregator;
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Row};

#[derive(FromRow)]
struct UserPaymentMethodsRow {
    payment_methods: Option<Value>,
}

#[derive(FromRow)]
struct PaymentMethodRow {
    payment_method: Option<Value>,
}

/// Mode de reversement déterminé par le matching
#[derive(Debug, Clone)]
pub enum PayoutMethod {
    MtnMoney { phone: String, verified: bool },
    OrangeMoney { phone: String, verified: bool },
    WalletInternal, // Fallback vers wallet interne
}

/// Modes de paiement configurés par un prestataire
#[derive(Debug, Clone)]
pub struct MerchantPaymentMethods {
    pub mtn_money: Option<MtnMoneyConfig>,
    pub orange_money: Option<OrangeMoneyConfig>,
}

#[derive(Debug, Clone)]
pub struct MtnMoneyConfig {
    pub phone: String,
    pub verified: bool,
}

#[derive(Debug, Clone)]
pub struct OrangeMoneyConfig {
    pub phone: String,
    pub verified: bool,
}

/// Service de matching intelligent des modes de paiement
pub struct PaymentMatchingService {
    pool: PgPool,
}

impl PaymentMatchingService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// ✅ Détermine le mode de paiement optimal pour le reversement
    ///
    /// Algorithme:
    /// 1. Si client a payé MTN Money ET prestataire a MTN Money vérifié → Transfert MTN Money
    /// 2. Si client a payé Orange Money ET prestataire a Orange Money vérifié → Transfert Orange Money
    /// 3. Sinon → Wallet interne (fallback)
    pub async fn determine_payout_method(
        &self,
        client_payment_method: &Value,
        merchant_user_id: i32,
    ) -> AppResult<PayoutMethod> {
        let merchant_methods = self.get_merchant_payment_methods(merchant_user_id).await?;

        let client_type =
            client_payment_method.get("type").and_then(|v| v.as_str()).unwrap_or("wallet");

        match client_type {
            "mtn_money" | "mtn" => {
                if let Some(mtn_config) = merchant_methods.mtn_money {
                    if mtn_config.verified {
                        return Ok(PayoutMethod::MtnMoney {
                            phone: mtn_config.phone,
                            verified: true,
                        });
                    } else {
                        log::warn!(
                            "Prestataire {} a MTN Money configuré mais non vérifié, fallback wallet",
                            merchant_user_id
                        );
                    }
                }
                Ok(PayoutMethod::WalletInternal)
            }
            "orange_money" | "orange" => {
                if let Some(orange_config) = merchant_methods.orange_money {
                    if orange_config.verified {
                        return Ok(PayoutMethod::OrangeMoney {
                            phone: orange_config.phone,
                            verified: true,
                        });
                    } else {
                        log::warn!(
                            "Prestataire {} a Orange Money configuré mais non vérifié, fallback wallet",
                            merchant_user_id
                        );
                    }
                }
                Ok(PayoutMethod::WalletInternal)
            }
            _ => Ok(PayoutMethod::WalletInternal),
        }
    }

    /// ✅ Récupère les modes de paiement configurés par un prestataire
    pub async fn get_merchant_payment_methods(
        &self,
        merchant_user_id: i32,
    ) -> AppResult<MerchantPaymentMethods> {
        let row: Option<UserPaymentMethodsRow> =
            sqlx::query_as("SELECT payment_methods FROM users WHERE id = $1")
                .bind(merchant_user_id)
                .fetch_optional(&self.pool)
                .await?;

        let payment_methods_json = row.and_then(|r| r.payment_methods).unwrap_or_else(|| json!({}));

        let mtn_money = payment_methods_json.get("mtn_money").and_then(|v| {
            Some(MtnMoneyConfig {
                phone: v.get("phone")?.as_str()?.to_string(),
                verified: v.get("verified")?.as_bool().unwrap_or(false),
            })
        });

        let orange_money = payment_methods_json.get("orange_money").and_then(|v| {
            Some(OrangeMoneyConfig {
                phone: v.get("phone")?.as_str()?.to_string(),
                verified: v.get("verified")?.as_bool().unwrap_or(false),
            })
        });

        Ok(MerchantPaymentMethods {
            mtn_money,
            orange_money,
        })
    }

    /// ✅ Effectue le reversement selon le mode déterminé
    ///
    /// Stratégie:
    /// 1. MTN/Orange vérifié → tenter disbursement via agrégateur (CinetPay/NotchPay)
    ///    - Si échec → fallback wallet interne + enregistrer disbursement_request en échec
    /// 2. WalletInternal → créditer directement le wallet interne
    pub async fn execute_payout(
        &self,
        merchant_user_id: i32,
        amount_cents: i64,
        payout_method: PayoutMethod,
        delivery_id: uuid::Uuid,
    ) -> AppResult<String> {
        match payout_method {
            PayoutMethod::MtnMoney {
                ref phone,
                verified,
            } => {
                if verified {
                    match self
                        .try_aggregator_disbursement(
                            merchant_user_id,
                            amount_cents,
                            phone,
                            "mtn_money",
                            delivery_id,
                        )
                        .await
                    {
                        Ok(ref_id) => {
                            log::info!(
                                "✅ Disbursement MTN Money réussi pour user {} : {} cents, ref={}",
                                merchant_user_id,
                                amount_cents,
                                ref_id
                            );
                            Ok("mtn_money_aggregator".to_string())
                        }
                        Err(e) => {
                            log::warn!(
                                "⚠️ Disbursement MTN Money échoué pour user {}, fallback wallet: {}",
                                merchant_user_id, e
                            );
                            self.credit_wallet_internal(
                                merchant_user_id,
                                amount_cents,
                                delivery_id,
                                Some(format!(
                                    "Reversement (MTN Money échoué: {}, crédité wallet)",
                                    e
                                )),
                            )
                            .await?;
                            Ok("wallet_internal_fallback".to_string())
                        }
                    }
                } else {
                    self.credit_wallet_internal(
                        merchant_user_id,
                        amount_cents,
                        delivery_id,
                        Some("Reversement (MTN Money non vérifié)".to_string()),
                    )
                    .await?;
                    Ok("wallet_internal".to_string())
                }
            }
            PayoutMethod::OrangeMoney {
                ref phone,
                verified,
            } => {
                if verified {
                    match self
                        .try_aggregator_disbursement(
                            merchant_user_id,
                            amount_cents,
                            phone,
                            "orange_money",
                            delivery_id,
                        )
                        .await
                    {
                        Ok(ref_id) => {
                            log::info!(
                                "✅ Disbursement Orange Money réussi pour user {} : {} cents, ref={}",
                                merchant_user_id, amount_cents, ref_id
                            );
                            Ok("orange_money_aggregator".to_string())
                        }
                        Err(e) => {
                            log::warn!(
                                "⚠️ Disbursement Orange Money échoué pour user {}, fallback wallet: {}",
                                merchant_user_id, e
                            );
                            self.credit_wallet_internal(
                                merchant_user_id,
                                amount_cents,
                                delivery_id,
                                Some(format!(
                                    "Reversement (Orange Money échoué: {}, crédité wallet)",
                                    e
                                )),
                            )
                            .await?;
                            Ok("wallet_internal_fallback".to_string())
                        }
                    }
                } else {
                    self.credit_wallet_internal(
                        merchant_user_id,
                        amount_cents,
                        delivery_id,
                        Some("Reversement (Orange Money non vérifié)".to_string()),
                    )
                    .await?;
                    Ok("wallet_internal".to_string())
                }
            }
            PayoutMethod::WalletInternal => {
                self.credit_wallet_internal(
                    merchant_user_id,
                    amount_cents,
                    delivery_id,
                    Some("Reversement livraison".to_string()),
                )
                .await?;
                Ok("wallet_internal".to_string())
            }
        }
    }

    /// ✅ Crédite le wallet interne d'un utilisateur (IMPLÉMENTATION RÉELLE)
    /// Utilise les tables user_wallets et wallet_transactions
    async fn credit_wallet_internal(
        &self,
        user_id: i32,
        amount_cents: i64,
        delivery_id: uuid::Uuid,
        reason: Option<String>,
    ) -> AppResult<()> {
        if amount_cents <= 0 {
            return Ok(());
        }

        // Upsert user_wallets: créer si inexistant, sinon récupérer le solde actuel
        let balance_before: i64 = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT balance_cents FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten()
        .unwrap_or(0);

        // Insérer ou mettre à jour le wallet
        sqlx::query(
            r#"
            INSERT INTO user_wallets (user_id, balance_cents, currency, updated_at)
            VALUES ($1, $2, 'XAF', NOW())
            ON CONFLICT (user_id, currency)
            DO UPDATE SET
                balance_cents = user_wallets.balance_cents + $2,
                updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(amount_cents)
        .execute(&self.pool)
        .await?;

        let balance_after = balance_before + amount_cents;

        // Enregistrer la transaction
        sqlx::query(
            r#"
            INSERT INTO wallet_transactions (
                user_id, transaction_type, amount_cents,
                balance_before_cents, balance_after_cents, currency,
                reference_type, reference_id, delivery_id, description
            )
            VALUES ($1, 'credit_payout', $2, $3, $4, 'XAF', 'delivery', $5, $6, $7)
            "#,
        )
        .bind(user_id)
        .bind(amount_cents)
        .bind(balance_before)
        .bind(balance_after)
        .bind(delivery_id.to_string())
        .bind(delivery_id)
        .bind(reason.as_deref().unwrap_or("Reversement livraison"))
        .execute(&self.pool)
        .await?;

        log::info!(
            "[Wallet] ✅ Crédit {} cents pour user {} (before={}, after={}): {}",
            amount_cents,
            user_id,
            balance_before,
            balance_after,
            reason.unwrap_or_default()
        );

        Ok(())
    }

    /// ✅ Débite le wallet interne d'un utilisateur (IMPLÉMENTATION RÉELLE)
    pub async fn debit_wallet_internal(
        &self,
        user_id: i32,
        amount_cents: i64,
        delivery_id: uuid::Uuid,
        reason: Option<String>,
    ) -> AppResult<()> {
        if amount_cents <= 0 {
            return Ok(());
        }

        let balance_before: i64 = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT balance_cents FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten()
        .unwrap_or(0);

        if balance_before < amount_cents {
            return Err(AppError::BadRequest(format!(
                "Solde insuffisant. Solde: {} FCFA, Requis: {} FCFA",
                balance_before / 100,
                amount_cents / 100
            )));
        }

        sqlx::query(
            r#"
            UPDATE user_wallets
            SET balance_cents = balance_cents - $2, updated_at = NOW()
            WHERE user_id = $1 AND currency = 'XAF' AND balance_cents >= $2
            "#,
        )
        .bind(user_id)
        .bind(amount_cents)
        .execute(&self.pool)
        .await?;

        let balance_after = balance_before - amount_cents;

        sqlx::query(
            r#"
            INSERT INTO wallet_transactions (
                user_id, transaction_type, amount_cents,
                balance_before_cents, balance_after_cents, currency,
                reference_type, reference_id, delivery_id, description
            )
            VALUES ($1, 'debit_delivery', $2, $3, $4, 'XAF', 'delivery', $5, $6, $7)
            "#,
        )
        .bind(user_id)
        .bind(amount_cents)
        .bind(balance_before)
        .bind(balance_after)
        .bind(delivery_id.to_string())
        .bind(delivery_id)
        .bind(reason.as_deref().unwrap_or("Débit livraison"))
        .execute(&self.pool)
        .await?;

        log::info!(
            "[Wallet] ✅ Débit {} cents pour user {} (before={}, after={}): {}",
            amount_cents,
            user_id,
            balance_before,
            balance_after,
            reason.unwrap_or_default()
        );

        Ok(())
    }

    /// ✅ Rembourse le wallet interne d'un utilisateur (IMPLÉMENTATION RÉELLE)
    pub async fn refund_wallet_internal(
        &self,
        user_id: i32,
        amount_cents: i64,
        delivery_id: uuid::Uuid,
        reason: Option<String>,
    ) -> AppResult<()> {
        if amount_cents <= 0 {
            return Ok(());
        }

        let balance_before: i64 = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT balance_cents FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten()
        .unwrap_or(0);

        sqlx::query(
            r#"
            INSERT INTO user_wallets (user_id, balance_cents, currency, updated_at)
            VALUES ($1, $2, 'XAF', NOW())
            ON CONFLICT (user_id, currency)
            DO UPDATE SET
                balance_cents = user_wallets.balance_cents + $2,
                updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(amount_cents)
        .execute(&self.pool)
        .await?;

        let balance_after = balance_before + amount_cents;

        sqlx::query(
            r#"
            INSERT INTO wallet_transactions (
                user_id, transaction_type, amount_cents,
                balance_before_cents, balance_after_cents, currency,
                reference_type, reference_id, delivery_id, description
            )
            VALUES ($1, 'refund_delivery', $2, $3, $4, 'XAF', 'delivery', $5, $6, $7)
            "#,
        )
        .bind(user_id)
        .bind(amount_cents)
        .bind(balance_before)
        .bind(balance_after)
        .bind(delivery_id.to_string())
        .bind(delivery_id)
        .bind(reason.as_deref().unwrap_or("Remboursement livraison"))
        .execute(&self.pool)
        .await?;

        log::info!(
            "[Wallet] ✅ Remboursement {} cents pour user {} (before={}, after={}): {}",
            amount_cents,
            user_id,
            balance_before,
            balance_after,
            reason.unwrap_or_default()
        );

        Ok(())
    }

    /// ✅ Récupère le solde wallet d'un utilisateur
    pub async fn get_wallet_balance(&self, user_id: i32) -> AppResult<i64> {
        let balance: i64 = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT balance_cents FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten()
        .unwrap_or(0);
        Ok(balance)
    }

    /// ✅ Tente un transfert sortant via l'agrégateur (CinetPay transfer API ou NotchPay transfer API)
    /// Enregistre la demande dans disbursement_requests dans tous les cas
    async fn try_aggregator_disbursement(
        &self,
        recipient_user_id: i32,
        amount_cents: i64,
        phone: &str,
        method: &str, // "mtn_money" ou "orange_money"
        delivery_id: uuid::Uuid,
    ) -> Result<String, String> {
        let aggregator = PaymentAggregator::new();

        // Enregistrer la demande de disbursement
        let disb_id: i64 = sqlx::query_scalar::<_, i64>(
            r#"
            INSERT INTO disbursement_requests (
                recipient_user_id, amount_cents, currency,
                recipient_phone, recipient_method, status, delivery_id, reason
            )
            VALUES ($1, $2, 'XAF', $3, $4, 'processing', $5, 'Reversement livraison automatique')
            RETURNING id
            "#,
        )
        .bind(recipient_user_id)
        .bind(amount_cents)
        .bind(phone)
        .bind(method)
        .bind(delivery_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Erreur DB disbursement: {}", e))?;

        // Appeler l'agrégateur pour le transfert sortant
        let result = aggregator
            .initiate_disbursement(
                phone,
                amount_cents,
                method,
                &format!("yukpo_disb_{}", disb_id),
            )
            .await;

        match result {
            Ok(ref_id) => {
                // Mettre à jour le disbursement avec le provider reference
                let provider_name = aggregator
                    .active_provider()
                    .map(|p| p.to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                let _ = sqlx::query(
                    r#"
                    UPDATE disbursement_requests
                    SET status = 'completed', provider = $1, provider_reference = $2,
                        processed_at = NOW(), completed_at = NOW(), attempts = attempts + 1
                    WHERE id = $3
                    "#,
                )
                .bind(&provider_name)
                .bind(&ref_id)
                .bind(disb_id)
                .execute(&self.pool)
                .await;

                Ok(ref_id)
            }
            Err(e) => {
                // Marquer comme échoué
                let _ = sqlx::query(
                    r#"
                    UPDATE disbursement_requests
                    SET status = 'failed', error_message = $1,
                        processed_at = NOW(), attempts = attempts + 1
                    WHERE id = $2
                    "#,
                )
                .bind(&e)
                .bind(disb_id)
                .execute(&self.pool)
                .await;

                Err(e)
            }
        }
    }

    /// ✅ Récupère le mode de paiement utilisé par le client depuis payment_transactions
    pub async fn get_client_payment_method(&self, delivery_id: uuid::Uuid) -> AppResult<Value> {
        // Chercher d'abord dans delivery_payment_reservations (client_payment_method)
        let row: Option<sqlx::postgres::PgRow> = sqlx::query(
            r#"
            SELECT client_payment_method
            FROM delivery_payment_reservations
            WHERE delivery_id = $1
            LIMIT 1
            "#,
        )
        .bind(delivery_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            let pm: Option<Value> = row.get::<Option<Value>, _>("client_payment_method");
            if let Some(ref v) = pm {
                if !v.is_null() {
                    return Ok(v.clone());
                }
            }
        }

        // Fallback: payment_transactions
        let row2: Option<PaymentMethodRow> = sqlx::query_as(
            r#"
            SELECT payment_method
            FROM payment_transactions pt
            JOIN delivery_payment_reservations dpr ON pt.user_id = dpr.user_id
            WHERE dpr.delivery_id = $1
            ORDER BY pt.created_at DESC
            LIMIT 1
            "#,
        )
        .bind(delivery_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(record) = row2 {
            if let Some(ref pm) = record.payment_method {
                if !pm.is_null() {
                    return Ok(pm.clone());
                }
            }
        }

        Ok(json!({"type": "wallet"}))
    }
}
