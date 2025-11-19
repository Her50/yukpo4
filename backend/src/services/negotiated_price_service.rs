use chrono::{Duration, Utc};
use log::{error, info, warn};
use serde::Serialize;
use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::core::types::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct NegotiatedPriceOffer {
    pub id: i32,
    pub conversation_id: i32,
    pub service_id: i32,
    pub product_index: Option<i32>,
    pub merchant_user_id: i32,
    pub client_user_id: i32,
    pub original_price_cents: i64,
    pub negotiated_price_cents: i64,
    pub status: String,
    pub expires_at: Option<chrono::DateTime<Utc>>,
    pub created_at: chrono::DateTime<Utc>,
}

/// ✅ NOUVEAU : Service pour gérer les prix négociés entre prestataire et client
pub struct NegotiatedPriceService {
    pool: PgPool,
}

impl NegotiatedPriceService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Crée une offre de prix négocié
    pub async fn create_negotiated_price(
        &self,
        conversation_id: i32,
        service_id: i32,
        product_index: Option<i32>,
        merchant_user_id: i32,
        client_user_id: i32,
        original_price_cents: i64,
        negotiated_price_cents: i64,
        expires_in_hours: Option<i32>,
    ) -> AppResult<i32> {
        // Vérifier que le prix négocié est inférieur au prix original
        if negotiated_price_cents > original_price_cents {
            return Err(AppError::BadRequest(
                "Le prix négocié ne peut pas être supérieur au prix original".into(),
            ));
        }

        // Calculer la date d'expiration
        let expires_at = expires_in_hours.map(|hours| {
            Utc::now() + Duration::hours(hours as i64)
        });

        // Annuler les offres précédentes en attente pour cette combinaison
        sqlx::query!(
            r#"
            UPDATE negotiated_prices
            SET status = 'expired'
            WHERE conversation_id = $1
                AND service_id = $2
                AND (product_index = $3 OR (product_index IS NULL AND $3 IS NULL))
                AND client_user_id = $4
                AND status = 'pending'
            "#,
            conversation_id,
            service_id,
            product_index,
            client_user_id
        )
        .execute(&self.pool)
        .await?;

        // Créer la nouvelle offre
        let id = sqlx::query!(
            r#"
            INSERT INTO negotiated_prices (
                conversation_id,
                service_id,
                product_index,
                merchant_user_id,
                client_user_id,
                original_price_cents,
                negotiated_price_cents,
                status,
                expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
            RETURNING id
            "#,
            conversation_id,
            service_id,
            product_index,
            merchant_user_id,
            client_user_id,
            original_price_cents,
            negotiated_price_cents,
            expires_at
        )
        .fetch_one(&self.pool)
        .await?
        .id;

        info!(
            "✅ Offre de prix négocié créée: conversation={}, service={}, produit={:?}, prix={} -> {}",
            conversation_id, service_id, product_index, original_price_cents, negotiated_price_cents
        );

        Ok(id)
    }

    /// Récupère le prix négocié actif pour une conversation/service/produit
    pub async fn get_active_negotiated_price(
        &self,
        conversation_id: i32,
        service_id: i32,
        product_index: Option<i32>,
        client_user_id: i32,
    ) -> AppResult<Option<i64>> {
        let result = sqlx::query!(
            r#"
            SELECT negotiated_price_cents
            FROM negotiated_prices
            WHERE conversation_id = $1
                AND service_id = $2
                AND (product_index = $3 OR (product_index IS NULL AND $3 IS NULL))
                AND client_user_id = $4
                AND status = 'accepted'
                AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
            LIMIT 1
            "#,
            conversation_id,
            service_id,
            product_index,
            client_user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.map(|r| r.negotiated_price_cents))
    }

    /// Récupère l'offre en attente pour une conversation/service/produit
    pub async fn get_pending_offer(
        &self,
        conversation_id: i32,
        service_id: i32,
        product_index: Option<i32>,
        client_user_id: i32,
    ) -> AppResult<Option<NegotiatedPriceOffer>> {
        let result = sqlx::query_as::<_, NegotiatedPriceOffer>(
            r#"
            SELECT 
                id,
                conversation_id,
                service_id,
                product_index,
                merchant_user_id,
                client_user_id,
                original_price_cents,
                negotiated_price_cents,
                status,
                expires_at,
                created_at
            FROM negotiated_prices
            WHERE conversation_id = $1
                AND service_id = $2
                AND (product_index = $3 OR (product_index IS NULL AND $3 IS NULL))
                AND client_user_id = $4
                AND status = 'pending'
                AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(conversation_id)
        .bind(service_id)
        .bind(product_index)
        .bind(client_user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result)
    }

    /// Accepte une offre de prix négocié
    pub async fn accept_offer(&self, offer_id: i32, client_user_id: i32) -> AppResult<()> {
        let result = sqlx::query!(
            r#"
            UPDATE negotiated_prices
            SET 
                status = 'accepted',
                accepted_at = NOW()
            WHERE id = $1
                AND client_user_id = $2
                AND status = 'pending'
                AND (expires_at IS NULL OR expires_at > NOW())
            RETURNING id
            "#,
            offer_id,
            client_user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if result.is_none() {
            return Err(AppError::NotFound("Offre introuvable ou expirée".into()));
        }

        info!("✅ Offre de prix négocié acceptée: {}", offer_id);
        Ok(())
    }

    /// Rejette une offre de prix négocié
    pub async fn reject_offer(&self, offer_id: i32, client_user_id: i32) -> AppResult<()> {
        let result = sqlx::query!(
            r#"
            UPDATE negotiated_prices
            SET status = 'rejected'
            WHERE id = $1
                AND client_user_id = $2
                AND status = 'pending'
            RETURNING id
            "#,
            offer_id,
            client_user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if result.is_none() {
            return Err(AppError::NotFound("Offre introuvable".into()));
        }

        info!("❌ Offre de prix négocié rejetée: {}", offer_id);
        Ok(())
    }
}


