// ✅ NOUVEAU: Service de paiement intégré pour services spécialisés
// Utilise le système de paiement existant mais avec contexte spécialisé

use crate::core::types::{AppError, AppResult};
use crate::services::payment_service::{PaymentMethod, PaymentRequest, PaymentService};
use sqlx::PgPool;
use std::sync::Arc;

pub struct SpecializedPaymentService {
    payment_service: PaymentService,
    pool: Arc<PgPool>,
}

impl SpecializedPaymentService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self {
            payment_service: PaymentService::new(pool.as_ref().clone()),
            pool,
        }
    }

    /// Traiter un paiement pour une réservation
    /// ✅ FIX 2026-03-19: Débite tokens_balance AVANT de confirmer la réservation
    /// Utilisé par: covoiturage, immobilier, pharmacie, hôpital, laboratoire
    pub async fn process_reservation_payment(
        &self,
        reservation_id: i32,
        user_id: i32,
        amount: f64,
        currency: &str,
        payment_method: PaymentMethod,
        description: Option<String>,
    ) -> AppResult<String> {
        // Vérifier que la réservation existe et appartient à l'utilisateur
        let reservation: (i32, Option<rust_decimal::Decimal>, Option<String>) = sqlx::query_as(
            r#"
            SELECT id, amount, currency
            FROM specialized_reservations
            WHERE id = $1 AND user_id = $2 AND payment_status != 'paid'
            "#,
        )
        .bind(reservation_id)
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Réservation non trouvée ou déjà payée".to_string()))?;

        // Vérifier que le montant correspond
        if let Some(expected_amount) = reservation.1 {
            let expected = expected_amount.to_string().parse::<f64>().unwrap_or(0.0);
            if (amount - expected).abs() > 0.01 {
                return Err(AppError::BadRequest(format!(
                    "Montant incorrect. Attendu: {}, Reçu: {}",
                    expected, amount
                )));
            }
        }

        let amount_xaf = amount.round() as i64;
        let payment_method_str = format!("{:?}", payment_method);
        let transaction_id = uuid::Uuid::new_v4().to_string();

        // ✅ FIX 2026-03-19: DÉBITER LE WALLET UTILISATEUR
        if amount_xaf > 0 {
            // Vérifier le solde
            let balance: i64 =
                sqlx::query_scalar("SELECT COALESCE(tokens_balance, 0) FROM users WHERE id = $1")
                    .bind(user_id)
                    .fetch_one(&*self.pool)
                    .await
                    .map_err(|e| {
                        log::error!(
                            "[process_reservation_payment] Erreur lecture solde user_id={}: {}",
                            user_id,
                            e
                        );
                        AppError::Internal(format!("Erreur lecture solde: {}", e))
                    })?;

            if balance < amount_xaf {
                log::warn!(
                    "[process_reservation_payment] Solde insuffisant user_id={}, solde={}, requis={}, reservation_id={}",
                    user_id, balance, amount_xaf, reservation_id
                );
                return Err(AppError::BadRequest(format!(
                    "Solde insuffisant. Disponible: {} XAF, Requis: {} XAF. Rechargez votre compte.",
                    balance, amount_xaf
                )));
            }

            // Débiter atomiquement
            let new_balance: Option<i64> = sqlx::query_scalar(
                "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 AND tokens_balance >= $1 RETURNING tokens_balance"
            )
            .bind(amount_xaf)
            .bind(user_id)
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| {
                log::error!("[process_reservation_payment] Erreur débit user_id={}: {}", user_id, e);
                AppError::Internal(format!("Erreur débit: {}", e))
            })?;

            if new_balance.is_none() {
                return Err(AppError::BadRequest(
                    "Solde insuffisant (concurrence)".to_string(),
                ));
            }

            // Sync user_wallets (best effort)
            let _ = sqlx::query(
                "INSERT INTO user_wallets (user_id, balance_cents, currency, created_at, updated_at) VALUES ($1, 0, 'XAF', NOW(), NOW()) ON CONFLICT (user_id, currency) DO UPDATE SET balance_cents = GREATEST(0, user_wallets.balance_cents - $2), updated_at = NOW()"
            )
            .bind(user_id)
            .bind(amount_xaf * 100)
            .execute(&*self.pool)
            .await;

            // Log transaction wallet
            let _ = sqlx::query(
                "INSERT INTO wallet_transactions (user_id, amount_cents, direction, description, created_at) VALUES ($1, $2, 'debit', $3, NOW())"
            )
            .bind(user_id)
            .bind(amount_xaf * 100)
            .bind(description.clone().unwrap_or_else(|| format!("Paiement réservation #{}", reservation_id)))
            .execute(&*self.pool)
            .await;

            log::info!(
                "[process_reservation_payment] ✅ Wallet débité: user_id={}, amount={} XAF, new_balance={:?}, reservation_id={}",
                user_id, amount_xaf, new_balance, reservation_id
            );
        }

        // Enregistrer la transaction de paiement
        let _ = sqlx::query(
            "INSERT INTO payment_transactions (transaction_id, user_id, amount, currency, payment_method, status, created_at) VALUES ($1, $2, $3, $4, $5, 'completed', NOW())"
        )
        .bind(&transaction_id)
        .bind(user_id)
        .bind(amount)
        .bind(currency)
        .bind(&payment_method_str)
        .execute(&*self.pool)
        .await;

        // Mettre à jour le statut de paiement de la réservation
        sqlx::query(
            r#"
            UPDATE specialized_reservations
            SET payment_status = 'paid',
                payment_method = $1,
                updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(&payment_method_str)
        .bind(reservation_id)
        .execute(&*self.pool)
        .await?;

        log::info!(
            "[process_reservation_payment] ✅ Réservation #{} payée: {} {} par {}, user_id={}",
            reservation_id,
            amount,
            currency,
            payment_method_str,
            user_id
        );

        Ok(transaction_id)
    }

    /// Rembourser un paiement pour une réservation annulée
    /// ✅ FIX 2026-03-19: Crédite tokens_balance lors du remboursement
    pub async fn refund_reservation_payment(
        &self,
        reservation_id: i32,
        reason: Option<String>,
    ) -> AppResult<()> {
        // Récupérer les infos de paiement + user_id
        let payment_info: Option<(i32, Option<rust_decimal::Decimal>, Option<String>)> =
            sqlx::query_as(
                r#"
            SELECT user_id, amount, currency
            FROM specialized_reservations
            WHERE id = $1 AND payment_status = 'paid'
            "#,
            )
            .bind(reservation_id)
            .fetch_optional(&*self.pool)
            .await?;

        if let Some((user_id, amount_opt, _currency)) = payment_info {
            let amount_xaf = amount_opt
                .map(|a| a.to_string().parse::<f64>().unwrap_or(0.0).round() as i64)
                .unwrap_or(0);

            // ✅ Créditer le wallet utilisateur
            if amount_xaf > 0 {
                sqlx::query(
                    "UPDATE users SET tokens_balance = COALESCE(tokens_balance, 0) + $1 WHERE id = $2"
                )
                .bind(amount_xaf)
                .bind(user_id)
                .execute(&*self.pool)
                .await
                .map_err(|e| {
                    log::error!("[refund_reservation_payment] Erreur crédit user_id={}: {}", user_id, e);
                    AppError::Internal(format!("Erreur remboursement: {}", e))
                })?;

                // Sync user_wallets
                let _ = sqlx::query(
                    "INSERT INTO user_wallets (user_id, balance_cents, currency, created_at, updated_at) VALUES ($1, $2, 'XAF', NOW(), NOW()) ON CONFLICT (user_id, currency) DO UPDATE SET balance_cents = user_wallets.balance_cents + $2, updated_at = NOW()"
                )
                .bind(user_id)
                .bind(amount_xaf * 100)
                .execute(&*self.pool)
                .await;

                // Log transaction
                let _ = sqlx::query(
                    "INSERT INTO wallet_transactions (user_id, amount_cents, direction, description, created_at) VALUES ($1, $2, 'credit', $3, NOW())"
                )
                .bind(user_id)
                .bind(amount_xaf * 100)
                .bind(format!("Remboursement réservation #{}: {}", reservation_id, reason.as_deref().unwrap_or("annulation")))
                .execute(&*self.pool)
                .await;

                log::info!(
                    "[refund_reservation_payment] ✅ Wallet crédité: user_id={}, amount={} XAF, reservation_id={}",
                    user_id, amount_xaf, reservation_id
                );
            }

            // Marquer la réservation comme remboursée
            sqlx::query(
                r#"
                UPDATE specialized_reservations
                SET payment_status = 'refunded',
                    notes = COALESCE(notes || ' | ', '') || COALESCE($1, 'Remboursé'),
                    updated_at = NOW()
                WHERE id = $2
                "#,
            )
            .bind(&reason)
            .bind(reservation_id)
            .execute(&*self.pool)
            .await?;
        }

        Ok(())
    }
}
