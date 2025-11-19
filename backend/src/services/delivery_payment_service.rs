// ✅ Phase 5 - Améliorations 10-15 : Service de gestion financière avancée pour livraisons
use crate::core::types::{AppError, AppResult};
use crate::services::delivery_service::DeliveryService;
use crate::services::payment_matching_service::PaymentMatchingService;
use chrono::Utc;
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

/// Statut d'une réservation de paiement
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReservationStatus {
    Reserved,  // Fonds réservés
    Debited,   // Débit définitif effectué
    Released,  // Réservation libérée (coursier refuse)
    Refunded,  // Remboursement effectué
}

impl ReservationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ReservationStatus::Reserved => "reserved",
            ReservationStatus::Debited => "debited",
            ReservationStatus::Released => "released",
            ReservationStatus::Refunded => "refunded",
        }
    }
}

/// Réservation de paiement pour une livraison
#[derive(Debug, Clone)]
pub struct DeliveryPaymentReservation {
    pub id: i32,
    pub delivery_id: Uuid,
    pub user_id: i32,
    pub product_price_cents: i64,
    pub delivery_cost_cents: i64,
    pub total_amount_cents: i64,
    pub billing_mode: String,
    pub merchant_pays_delivery: bool,
    pub reservation_status: String,
    pub reserved_at: chrono::DateTime<Utc>,
    pub debited_at: Option<chrono::DateTime<Utc>>,
    pub released_at: Option<chrono::DateTime<Utc>>,
    pub refunded_at: Option<chrono::DateTime<Utc>>,
    pub merchant_payout_cents: Option<i64>,
    pub commission_cents: Option<i64>,
    pub commission_rate: Decimal,
    pub merchant_paid_at: Option<chrono::DateTime<Utc>>,
    pub metadata: Value,
}

/// Service de gestion des paiements pour livraisons
pub struct DeliveryPaymentService {
    pool: PgPool,
    delivery_service: Option<Arc<DeliveryService>>,
}

impl DeliveryPaymentService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            delivery_service: None,
        }
    }

    pub fn with_delivery_service(mut self, delivery_service: Arc<DeliveryService>) -> Self {
        self.delivery_service = Some(delivery_service);
        self
    }

    /// ✅ Phase 5 - Amélioration 10 : Vérifie le solde et crée une réservation
    pub async fn reserve_payment(
        &self,
        delivery_id: Uuid,
        user_id: i32,
        product_price_cents: i64,
        delivery_cost_cents: i64,
        billing_mode: &str,
        client_payment_method: Option<Value>, // ✅ NOUVEAU: Mode de paiement utilisé par le client
    ) -> AppResult<DeliveryPaymentReservation> {
        let merchant_pays_delivery = billing_mode.eq_ignore_ascii_case("merchant_inclusive");
        
        // Calculer le montant total à débiter
        let total_amount_cents = if merchant_pays_delivery {
            // Si prestataire paie la livraison, client paie seulement le produit
            product_price_cents
        } else {
            // Client paie produit + livraison
            product_price_cents + delivery_cost_cents
        };

        // ✅ Vérifier le solde du client
        let balance = if let Some(ref delivery_service) = self.delivery_service {
            delivery_service.get_wallet_balance(user_id).await?
        } else {
            // Fallback: utiliser query directe
            let balance = sqlx::query_scalar::<_, Option<i64>>(
                "SELECT balance_cents FROM user_wallets WHERE user_id = $1"
            )
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?;
            balance.unwrap_or(0)
        };

        if balance < total_amount_cents {
            return Err(AppError::BadRequest(format!(
                "Solde insuffisant. Solde actuel: {} FCFA, Montant requis: {} FCFA",
                balance / 100,
                total_amount_cents / 100
            )));
        }

        // ✅ Créer la réservation avec mode de paiement client
        let reservation = sqlx::query!(
            r#"
            INSERT INTO delivery_payment_reservations (
                delivery_id, user_id,
                product_price_cents, delivery_cost_cents, total_amount_cents,
                billing_mode, merchant_pays_delivery,
                reservation_status, client_payment_method
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'reserved', $8)
            RETURNING id, delivery_id, user_id,
                      product_price_cents, delivery_cost_cents, total_amount_cents,
                      billing_mode, merchant_pays_delivery, reservation_status,
                      reserved_at, debited_at, released_at, refunded_at,
                      merchant_payout_cents, commission_cents, commission_rate,
                      merchant_paid_at, metadata
            "#,
            delivery_id,
            user_id,
            product_price_cents,
            delivery_cost_cents,
            total_amount_cents,
            billing_mode,
            merchant_pays_delivery,
            client_payment_method.unwrap_or_else(|| json!({"type": "wallet"}))
        )
        .fetch_one(&self.pool)
        .await?;

        // ✅ Débiter immédiatement (réservation = débit immédiat pour garantir les fonds)
        // Note: On pourrait aussi faire un vrai "hold" mais pour simplifier, on débite directement
        // et on remboursera si le coursier refuse
        if let Some(ref delivery_service) = self.delivery_service {
            delivery_service.debit_wallet_for_delivery(
                user_id,
                delivery_id,
                total_amount_cents,
                Some("Réservation paiement livraison".to_string())
            ).await?;
        } else {
            self.debit_user_wallet(user_id, delivery_id, total_amount_cents, Some("Réservation paiement livraison".to_string())).await?;
        }

        Ok(DeliveryPaymentReservation {
            id: reservation.id,
            delivery_id: reservation.delivery_id,
            user_id: reservation.user_id,
            product_price_cents: reservation.product_price_cents,
            delivery_cost_cents: reservation.delivery_cost_cents,
            total_amount_cents: reservation.total_amount_cents,
            billing_mode: reservation.billing_mode,
            merchant_pays_delivery: reservation.merchant_pays_delivery,
            reservation_status: reservation.reservation_status,
            reserved_at: reservation.reserved_at,
            debited_at: reservation.debited_at,
            released_at: reservation.released_at,
            refunded_at: reservation.refunded_at,
            merchant_payout_cents: reservation.merchant_payout_cents,
            commission_cents: reservation.commission_cents,
            commission_rate: reservation.commission_rate,
            merchant_paid_at: reservation.merchant_paid_at,
            metadata: reservation.metadata,
        })
    }

    /// ✅ Phase 5 - Amélioration 11 : Débit définitif (quand coursier accepte)
    pub async fn confirm_payment(
        &self,
        delivery_id: Uuid,
    ) -> AppResult<()> {
        // La réservation a déjà été débitée, on marque juste comme "debited"
        sqlx::query!(
            r#"
            UPDATE delivery_payment_reservations
            SET
                reservation_status = 'debited',
                debited_at = NOW(),
                updated_at = NOW()
            WHERE delivery_id = $1 AND reservation_status = 'reserved'
            "#,
            delivery_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// ✅ Phase 5 - Amélioration 11 : Libère la réservation (si coursier refuse)
    pub async fn release_reservation(
        &self,
        delivery_id: Uuid,
    ) -> AppResult<()> {
        let reservation = sqlx::query!(
            r#"
            SELECT user_id, total_amount_cents, reservation_status
            FROM delivery_payment_reservations
            WHERE delivery_id = $1
            "#,
            delivery_id
        )
        .fetch_optional(&self.pool)
        .await?;

        let res = reservation.ok_or_else(|| {
            AppError::NotFound("Réservation non trouvée".into())
        })?;

        if res.reservation_status != "reserved" {
            return Err(AppError::BadRequest(
                "La réservation ne peut pas être libérée (statut invalide)".into()
            ));
        }

        // ✅ Rembourser le client
        if let Some(ref delivery_service) = self.delivery_service {
            delivery_service.refund_wallet_for_delivery(
                res.user_id,
                delivery_id,
                res.total_amount_cents,
                Some("Remboursement: coursier a refusé la livraison".to_string())
            ).await?;
        } else {
            self.refund_user_wallet(
                res.user_id,
                delivery_id,
                res.total_amount_cents,
                Some("Remboursement: coursier a refusé la livraison".to_string())
            ).await?;
        }

        // ✅ Marquer comme libérée
        sqlx::query!(
            r#"
            UPDATE delivery_payment_reservations
            SET
                reservation_status = 'released',
                released_at = NOW(),
                updated_at = NOW()
            WHERE delivery_id = $1
            "#,
            delivery_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// ✅ Phase 5 - Amélioration 14 : Reversement au prestataire (après validation livraison)
    pub async fn payout_merchant(
        &self,
        delivery_id: Uuid,
        merchant_user_id: i32,
    ) -> AppResult<()> {
        // Récupérer la réservation
        let reservation = sqlx::query!(
            r#"
            SELECT product_price_cents, commission_rate
            FROM delivery_payment_reservations
            WHERE delivery_id = $1
            "#,
            delivery_id
        )
        .fetch_optional(&self.pool)
        .await?;

        let res = reservation.ok_or_else(|| {
            AppError::NotFound("Réservation non trouvée".into())
        })?;

        // ✅ Calculer commission (variable d'environnement ou 5% par défaut)
        let commission_rate = std::env::var("YUKPO_COMMISSION_RATE")
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.05); // 5% par défaut

        let commission_cents = (res.product_price_cents as f64 * commission_rate) as i64;
        let merchant_payout_cents = res.product_price_cents - commission_cents;

        // ✅ Phase 5 - Matching Intelligent : Déterminer le mode de paiement optimal
        let matching_service = PaymentMatchingService::new(self.pool.clone());
        
        // Récupérer le mode de paiement utilisé par le client
        let client_payment_method = matching_service
            .get_client_payment_method(delivery_id)
            .await
            .unwrap_or_else(|_| json!({"type": "wallet"})); // Fallback si erreur
        
        // Déterminer le mode de reversement optimal
        let payout_method = matching_service
            .determine_payout_method(&client_payment_method, merchant_user_id)
            .await?;
        
        // Effectuer le reversement selon le mode déterminé
        let payout_method_used = matching_service
            .execute_payout(merchant_user_id, merchant_payout_cents, payout_method.clone(), delivery_id)
            .await?;
        
        // Préparer les métadonnées pour stockage
        let merchant_payment_method_json = match payout_method {
            crate::services::payment_matching_service::PayoutMethod::MtnMoney { phone, verified } => {
                json!({
                    "type": "mtn_money",
                    "phone": phone,
                    "verified": verified
                })
            }
            crate::services::payment_matching_service::PayoutMethod::OrangeMoney { phone, verified } => {
                json!({
                    "type": "orange_money",
                    "phone": phone,
                    "verified": verified
                })
            }
            crate::services::payment_matching_service::PayoutMethod::WalletInternal => {
                json!({
                    "type": "wallet_internal"
                })
            }
        };

        // ✅ Mettre à jour la réservation avec les informations de matching
        let commission_rate_decimal = Decimal::try_from(commission_rate).unwrap_or_else(|_| Decimal::new(5, 2)); // 0.05
        sqlx::query!(
            r#"
            UPDATE delivery_payment_reservations
            SET
                merchant_payout_cents = $1,
                commission_cents = $2,
                commission_rate = $3,
                merchant_paid_at = NOW(),
                client_payment_method = $4,
                merchant_payment_method = $5,
                payout_method_used = $6,
                updated_at = NOW()
            WHERE delivery_id = $7
            "#,
            merchant_payout_cents,
            commission_cents,
            commission_rate_decimal,
            client_payment_method,
            merchant_payment_method_json,
            payout_method_used,
            delivery_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// ✅ Phase 5 - Amélioration 13 : Gestion rejet produit
    pub async fn handle_product_rejection(
        &self,
        delivery_id: Uuid,
        client_user_id: i32,
    ) -> AppResult<()> {
        let reservation = sqlx::query!(
            r#"
            SELECT product_price_cents, delivery_cost_cents, billing_mode, merchant_pays_delivery
            FROM delivery_payment_reservations
            WHERE delivery_id = $1
            "#,
            delivery_id
        )
        .fetch_optional(&self.pool)
        .await?;

        let res = reservation.ok_or_else(|| {
            AppError::NotFound("Réservation non trouvée".into())
        })?;

        // ✅ 1. Rembourser le prix du produit au client
        if let Some(ref delivery_service) = self.delivery_service {
            delivery_service.refund_wallet_for_delivery(
                client_user_id,
                delivery_id,
                res.product_price_cents,
                Some("Remboursement: produit rejeté par le client".to_string())
            ).await?;

            // ✅ 2. Gestion du coût de livraison selon billing_mode
            if res.merchant_pays_delivery {
                // Si prestataire avait offert la livraison, on prélève le coût chez le client
                // (pas de pénalité pour le prestataire, mais le client assume les frais de transport)
                delivery_service.debit_wallet_for_delivery(
                    client_user_id,
                    delivery_id,
                    res.delivery_cost_cents,
                    Some("Frais de livraison (produit rejeté, livraison non remboursable)".to_string())
                ).await?;
            } else {
                // Si client payait la livraison, le coût reste débité (non remboursable)
                // Rien à faire, le montant reste débité
            }
        } else {
            self.refund_user_wallet(
                client_user_id,
                delivery_id,
                res.product_price_cents,
                Some("Remboursement: produit rejeté par le client".to_string())
            ).await?;

            if res.merchant_pays_delivery {
                self.debit_user_wallet(
                    client_user_id,
                    delivery_id,
                    res.delivery_cost_cents,
                    Some("Frais de livraison (produit rejeté, livraison non remboursable)".to_string())
                ).await?;
            }
        }

        // ✅ 3. Marquer comme remboursé partiellement
        sqlx::query!(
            r#"
            UPDATE delivery_payment_reservations
            SET
                reservation_status = 'refunded',
                refunded_at = NOW(),
                updated_at = NOW()
            WHERE delivery_id = $1
            "#,
            delivery_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }


    /// Débite le wallet d'un utilisateur
    async fn debit_user_wallet(
        &self,
        user_id: i32,
        delivery_id: Uuid,
        amount_cents: i64,
        reason: Option<String>,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO wallet_transactions (
                user_id, delivery_id, amount_cents, direction, reason, created_at
            )
            VALUES ($1, $2, $3, 'debit', $4, NOW())
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
            VALUES ($1, -$2, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
                balance_cents = user_wallets.balance_cents - $2,
                updated_at = NOW()
            "#,
            user_id,
            amount_cents
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Rembourse le wallet d'un utilisateur
    async fn refund_user_wallet(
        &self,
        user_id: i32,
        delivery_id: Uuid,
        amount_cents: i64,
        reason: Option<String>,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO wallet_transactions (
                user_id, delivery_id, amount_cents, direction, reason, created_at
            )
            VALUES ($1, $2, $3, 'refund', $4, NOW())
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

    /// Crédite le wallet d'un utilisateur (pour reversement prestataire)
    async fn credit_user_wallet(
        &self,
        user_id: i32,
        delivery_id: Uuid,
        amount_cents: i64,
        reason: Option<String>,
    ) -> AppResult<()> {
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

}

