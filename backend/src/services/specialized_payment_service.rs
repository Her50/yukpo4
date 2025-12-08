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

        // Traiter le paiement via le service existant
        let payment_request = PaymentRequest {
            user_id,
            amount,
            currency: currency.to_string(),
            payment_method,
            description: description
                .or_else(|| Some(format!("Paiement réservation #{}", reservation_id))),
        };

        // Cloner payment_method avant de déplacer payment_request
        let payment_method_str = format!("{:?}", payment_request.payment_method);
        
        let payment_response = self
            .payment_service
            .process_payment(payment_request)
            .await?;

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
        .bind(payment_method_str)
        .bind(reservation_id)
        .execute(&*self.pool)
        .await?;

        Ok(payment_response.transaction_id)
    }

    /// Rembourser un paiement pour une réservation annulée
    pub async fn refund_reservation_payment(
        &self,
        reservation_id: i32,
        reason: Option<String>,
    ) -> AppResult<()> {
        // Récupérer les infos de paiement
        let payment_info: Option<(String, f64, String)> = sqlx::query_as(
            r#"
            SELECT payment_method, amount, currency
            FROM specialized_reservations
            WHERE id = $1 AND payment_status = 'paid'
            "#,
        )
        .bind(reservation_id)
        .fetch_optional(&*self.pool)
        .await?;

        if let Some((_payment_method, _amount, _currency)) = payment_info {
            // TODO: Implémenter le remboursement via le service de paiement
            // Pour l'instant, on marque juste comme remboursé
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
