// ✅ Phase 5 - Matching Intelligent des Modes de Paiement
// Structure prête pour intégration APIs mobile money (MTN/Orange)
use crate::core::types::{AppError, AppResult};
use serde_json::{json, Value};
use sqlx::PgPool;

/// Mode de reversement déterminé par le matching
#[derive(Debug, Clone)]
pub enum PayoutMethod {
    MtnMoney {
        phone: String,
        verified: bool,
    },
    OrangeMoney {
        phone: String,
        verified: bool,
    },
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
    /// 1. Si client a payé MTN Money ET prestataire a MTN Money → Transfert MTN Money
    /// 2. Si client a payé Orange Money ET prestataire a Orange Money → Transfert Orange Money
    /// 3. Sinon → Wallet interne (fallback)
    pub async fn determine_payout_method(
        &self,
        client_payment_method: &Value,
        merchant_user_id: i32,
    ) -> AppResult<PayoutMethod> {
        // 1. Récupérer modes de paiement prestataire
        let merchant_methods = self.get_merchant_payment_methods(merchant_user_id).await?;

        // 2. Extraire type de paiement client
        let client_type = client_payment_method
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("wallet");

        // 3. Matching intelligent
        match client_type {
            "mtn_money" | "mtn" => {
                if let Some(mtn_config) = merchant_methods.mtn_money {
                    if mtn_config.verified {
                        return Ok(PayoutMethod::MtnMoney {
                            phone: mtn_config.phone,
                            verified: true,
                        });
                    } else {
                        // Numéro non vérifié → fallback wallet
                        log::warn!(
                            "Prestataire {} a MTN Money configuré mais non vérifié, fallback wallet",
                            merchant_user_id
                        );
                    }
                }
                // Pas de MTN Money configuré → fallback wallet
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
                        // Numéro non vérifié → fallback wallet
                        log::warn!(
                            "Prestataire {} a Orange Money configuré mais non vérifié, fallback wallet",
                            merchant_user_id
                        );
                    }
                }
                // Pas d'Orange Money configuré → fallback wallet
                Ok(PayoutMethod::WalletInternal)
            }
            _ => {
                // Wallet interne, espèces, ou autre → fallback wallet
                Ok(PayoutMethod::WalletInternal)
            }
        }
    }

    /// ✅ Récupère les modes de paiement configurés par un prestataire
    pub async fn get_merchant_payment_methods(
        &self,
        merchant_user_id: i32,
    ) -> AppResult<MerchantPaymentMethods> {
        let row = sqlx::query!(
            "SELECT payment_methods FROM users WHERE id = $1",
            merchant_user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        let payment_methods_json = row
            .and_then(|r| r.payment_methods)
            .unwrap_or_else(|| json!({}));

        let mtn_money = payment_methods_json
            .get("mtn_money")
            .and_then(|v| {
                Some(MtnMoneyConfig {
                    phone: v.get("phone")?.as_str()?.to_string(),
                    verified: v.get("verified")?.as_bool().unwrap_or(false),
                })
            });

        let orange_money = payment_methods_json
            .get("orange_money")
            .and_then(|v| {
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
    /// Note: Les APIs mobile money ne sont pas encore disponibles,
    /// donc pour l'instant on utilise toujours le wallet interne.
    /// La structure est prête pour intégrer les APIs plus tard.
    pub async fn execute_payout(
        &self,
        merchant_user_id: i32,
        amount_cents: i64,
        payout_method: PayoutMethod,
        delivery_id: uuid::Uuid,
    ) -> AppResult<String> {
        match payout_method {
            PayoutMethod::MtnMoney { phone, verified } => {
                if verified {
                    // TODO: Intégrer API MTN Money quand disponible
                    // Pour l'instant, fallback vers wallet interne
                    log::info!(
                        "⚠️ API MTN Money non disponible, fallback wallet pour prestataire {} (phone: {})",
                        merchant_user_id,
                        phone
                    );
                    self.credit_wallet_internal(merchant_user_id, amount_cents, delivery_id, Some("Reversement (MTN Money non disponible, crédité wallet)".to_string())).await?;
                    Ok("wallet_internal".to_string())
                } else {
                    // Numéro non vérifié → wallet interne
                    self.credit_wallet_internal(merchant_user_id, amount_cents, delivery_id, Some("Reversement (MTN Money non vérifié)".to_string())).await?;
                    Ok("wallet_internal".to_string())
                }
            }
            PayoutMethod::OrangeMoney { phone, verified } => {
                if verified {
                    // TODO: Intégrer API Orange Money quand disponible
                    // Pour l'instant, fallback vers wallet interne
                    log::info!(
                        "⚠️ API Orange Money non disponible, fallback wallet pour prestataire {} (phone: {})",
                        merchant_user_id,
                        phone
                    );
                    self.credit_wallet_internal(merchant_user_id, amount_cents, delivery_id, Some("Reversement (Orange Money non disponible, crédité wallet)".to_string())).await?;
                    Ok("wallet_internal".to_string())
                } else {
                    // Numéro non vérifié → wallet interne
                    self.credit_wallet_internal(merchant_user_id, amount_cents, delivery_id, Some("Reversement (Orange Money non vérifié)".to_string())).await?;
                    Ok("wallet_internal".to_string())
                }
            }
            PayoutMethod::WalletInternal => {
                // Wallet interne (comportement normal)
                self.credit_wallet_internal(merchant_user_id, amount_cents, delivery_id, Some("Reversement livraison".to_string())).await?;
                Ok("wallet_internal".to_string())
            }
        }
    }

    /// ✅ Crédite le wallet interne (fallback)
    async fn credit_wallet_internal(
        &self,
        user_id: i32,
        amount_cents: i64,
        delivery_id: uuid::Uuid,
        reason: Option<String>,
    ) -> AppResult<()> {
        // Insérer transaction wallet
        sqlx::query!(
            r#"
            INSERT INTO wallet_transactions (
                user_id, delivery_id, amount_cents, direction, reason, created_at
            )
            VALUES ($1, $2, $3, 'credit', $4, NOW())
            "#,
            user_id,
            delivery_id,
            amount_cents,
            reason
        )
        .execute(&self.pool)
        .await?;

        // Mettre à jour le solde
        sqlx::query!(
            r#"
            INSERT INTO user_wallets (user_id, balance_cents, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
                balance_cents = user_wallets.balance_cents + $2,
                updated_at = NOW()
            "#,
            user_id,
            amount_cents
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// 🔮 TODO: Intégrer API MTN Money (à implémenter quand API disponible)
    /// 
    /// Cette fonction sera appelée quand l'API MTN Money sera disponible.
    /// Pour l'instant, elle n'est pas utilisée (fallback wallet).
    #[allow(dead_code)]
    async fn transfer_mtn_money(
        &self,
        phone: &str,
        amount_cents: i64,
    ) -> AppResult<String> {
        // TODO: Implémenter appel API MTN Money
        // Exemple de structure:
        /*
        let client = reqwest::Client::new();
        let api_key = std::env::var("MTN_MONEY_API_KEY")?;
        let api_url = std::env::var("MTN_MONEY_API_URL")?;
        
        let response = client
            .post(&format!("{}/transfer", api_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&json!({
                "phone": phone,
                "amount": amount_cents / 100, // Convertir en FCFA
                "currency": "XAF"
            }))
            .send()
            .await?;
        
        let result: Value = response.json().await?;
        let transaction_id = result.get("transaction_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Internal("MTN Money API: transaction_id manquant".into()))?;
        
        Ok(transaction_id.to_string())
        */
        
        // Pour l'instant, retourner une erreur (ne devrait pas être appelé)
        Err(AppError::Internal(
            "API MTN Money non encore implémentée".into(),
        ))
    }

    /// 🔮 TODO: Intégrer API Orange Money (à implémenter quand API disponible)
    /// 
    /// Cette fonction sera appelée quand l'API Orange Money sera disponible.
    /// Pour l'instant, elle n'est pas utilisée (fallback wallet).
    #[allow(dead_code)]
    async fn transfer_orange_money(
        &self,
        phone: &str,
        amount_cents: i64,
    ) -> AppResult<String> {
        // TODO: Implémenter appel API Orange Money
        // Exemple de structure:
        /*
        let client = reqwest::Client::new();
        let api_key = std::env::var("ORANGE_MONEY_API_KEY")?;
        let api_url = std::env::var("ORANGE_MONEY_API_URL")?;
        
        let response = client
            .post(&format!("{}/transfer", api_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&json!({
                "phone": phone,
                "amount": amount_cents / 100, // Convertir en FCFA
                "currency": "XAF"
            }))
            .send()
            .await?;
        
        let result: Value = response.json().await?;
        let transaction_id = result.get("transaction_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Internal("Orange Money API: transaction_id manquant".into()))?;
        
        Ok(transaction_id.to_string())
        */
        
        // Pour l'instant, retourner une erreur (ne devrait pas être appelé)
        Err(AppError::Internal(
            "API Orange Money non encore implémentée".into(),
        ))
    }

    /// ✅ Récupère le mode de paiement utilisé par le client depuis payment_transactions
    pub async fn get_client_payment_method(
        &self,
        delivery_id: uuid::Uuid,
    ) -> AppResult<Value> {
        // Chercher la transaction de paiement associée à cette livraison
        let row = sqlx::query!(
            r#"
            SELECT payment_method
            FROM payment_transactions pt
            JOIN delivery_payment_reservations dpr ON pt.user_id = dpr.user_id
            WHERE dpr.delivery_id = $1
            ORDER BY pt.created_at DESC
            LIMIT 1
            "#,
            delivery_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(record) = row {
            Ok(record.payment_method.unwrap_or_else(|| json!({"type": "wallet"})))
        } else {
            // Pas de transaction trouvée → par défaut wallet
            Ok(json!({"type": "wallet"}))
        }
    }
}

