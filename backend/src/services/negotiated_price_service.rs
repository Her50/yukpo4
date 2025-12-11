use chrono::{Duration, Utc};
use log::info;
use serde::Serialize;
use sqlx::{FromRow, PgPool, Row};

use crate::core::types::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct NegotiatedPriceOffer {
    pub id: i32,
    pub conversation_id: String,
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
    _pool: PgPool,
}

impl NegotiatedPriceService {
    pub fn new(pool: PgPool) -> Self {
        Self { _pool: pool }
    }

    /// Crée une offre de prix négocié
    pub async fn create_negotiated_price(
        &self,
        conversation_id: String,
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
        let expires_at = expires_in_hours.map(|hours| Utc::now() + Duration::hours(hours as i64));

        // ✅ CORRIGÉ: Annuler toute offre en attente existante pour cette conversation/service/produit
        sqlx::query(
            r#"
            UPDATE negotiated_prices
            SET status = 'rejected'
            WHERE conversation_id = $1
            AND service_id = $2
            AND (product_index = $3 OR ($3 IS NULL AND product_index IS NULL))
            AND client_user_id = $4
            AND status = 'pending'
            "#,
        )
        .bind(&conversation_id)
        .bind(service_id)
        .bind(product_index)
        .bind(client_user_id)
        .execute(&self._pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur annulation offres précédentes: {}", e)))?;

        // ✅ CORRIGÉ: Insérer la nouvelle offre dans la base de données
        let row = sqlx::query(
            r#"
            INSERT INTO negotiated_prices (
                conversation_id, service_id, product_index,
                merchant_user_id, client_user_id,
                original_price_cents, negotiated_price_cents,
                status, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
            RETURNING id
            "#,
        )
        .bind(&conversation_id)
        .bind(service_id)
        .bind(product_index)
        .bind(merchant_user_id)
        .bind(client_user_id)
        .bind(original_price_cents)
        .bind(negotiated_price_cents)
        .bind(expires_at)
        .fetch_one(&self._pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création offre: {}", e)))?;

        let id: i32 = row.get::<i32, _>("id");

        info!(
            "✅ Offre de prix négocié créée: id={}, conversation={}, service={}, produit={:?}, prix={} -> {}",
            id, conversation_id, service_id, product_index, original_price_cents, negotiated_price_cents
        );

        Ok(id)
    }

    /// Récupère le prix négocié actif pour une conversation/service/produit
    pub async fn get_active_negotiated_price(
        &self,
        conversation_id: String,
        service_id: i32,
        product_index: Option<i32>,
        client_user_id: i32,
    ) -> AppResult<Option<i64>> {
        // ✅ CORRIGÉ: Récupérer le prix négocié accepté depuis la base de données
        let row = sqlx::query(
            r#"
            SELECT negotiated_price_cents
            FROM negotiated_prices
            WHERE conversation_id = $1
            AND service_id = $2
            AND (product_index = $3 OR ($3 IS NULL AND product_index IS NULL))
            AND client_user_id = $4
            AND status = 'accepted'
            ORDER BY accepted_at DESC
            LIMIT 1
            "#,
        )
        .bind(&conversation_id)
        .bind(service_id)
        .bind(product_index)
        .bind(client_user_id)
        .fetch_optional(&self._pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération prix négocié: {}", e)))?;

        if let Some(row) = row {
            let price_cents: i64 = row.get::<i64, _>("negotiated_price_cents");
            Ok(Some(price_cents))
        } else {
            Ok(None)
        }
    }

    /// Récupère l'offre en attente pour une conversation/service/produit
    pub async fn get_pending_offer(
        &self,
        conversation_id: String,
        service_id: i32,
        product_index: Option<i32>,
        client_user_id: i32,
    ) -> AppResult<Option<NegotiatedPriceOffer>> {
        // ✅ CORRIGÉ: Récupérer l'offre en attente depuis la base de données
        let offer = sqlx::query_as::<_, NegotiatedPriceOffer>(
            r#"
            SELECT id, conversation_id, service_id, product_index,
                   merchant_user_id, client_user_id,
                   original_price_cents, negotiated_price_cents,
                   status, expires_at, created_at
            FROM negotiated_prices
            WHERE conversation_id = $1
            AND service_id = $2
            AND (product_index = $3 OR ($3 IS NULL AND product_index IS NULL))
            AND client_user_id = $4
            AND status = 'pending'
            AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(&conversation_id)
        .bind(service_id)
        .bind(product_index)
        .bind(client_user_id)
        .fetch_optional(&self._pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération offre: {}", e)))?;

        Ok(offer)
    }

    /// Accepte une offre de prix négocié
    pub async fn accept_offer(&self, offer_id: i32, user_id: i32) -> AppResult<()> {
        // ✅ CORRIGÉ: Vérifier que l'offre existe et que l'utilisateur est autorisé
        let offer = sqlx::query(
            r#"
            SELECT merchant_user_id, client_user_id, status, expires_at
            FROM negotiated_prices
            WHERE id = $1
            "#,
        )
        .bind(offer_id)
        .fetch_optional(&self._pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification offre: {}", e)))?;

        let offer_row = offer.ok_or_else(|| AppError::NotFound("Offre introuvable".into()))?;

        let merchant_id: i32 = offer_row.get::<i32, _>("merchant_user_id");
        let _client_user_id: i32 = offer_row.get::<i32, _>("client_user_id");
        let status: String = offer_row.get::<String, _>("status");
        let expires_at: Option<chrono::DateTime<Utc>> =
            offer_row.get::<Option<chrono::DateTime<Utc>>, _>("expires_at");

        // Vérifier que l'utilisateur est le prestataire (seul le prestataire peut accepter)
        if user_id != merchant_id {
            return Err(AppError::Forbidden(
                "Seul le prestataire peut accepter une offre".into(),
            ));
        }

        // Vérifier que l'offre est en attente
        if status != "pending" {
            return Err(AppError::BadRequest(
                format!("L'offre n'est plus en attente (status: {})", status).into(),
            ));
        }

        // Vérifier que l'offre n'est pas expirée
        if let Some(expires) = expires_at {
            if expires < Utc::now() {
                // Marquer comme expirée
                sqlx::query("UPDATE negotiated_prices SET status = 'expired' WHERE id = $1")
                    .bind(offer_id)
                    .execute(&self._pool)
                    .await
                    .ok();
                return Err(AppError::BadRequest("L'offre a expiré".into()));
            }
        }

        // ✅ CORRIGÉ: Accepter l'offre
        let rows_affected = sqlx::query(
            r#"
            UPDATE negotiated_prices
            SET status = 'accepted', accepted_at = NOW()
            WHERE id = $1 AND status = 'pending'
            "#,
        )
        .bind(offer_id)
        .execute(&self._pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur acceptation offre: {}", e)))?;

        if rows_affected.rows_affected() == 0 {
            return Err(AppError::NotFound(
                "Offre introuvable ou déjà traitée".into(),
            ));
        }

        info!("✅ Offre de prix négocié acceptée: id={}", offer_id);
        Ok(())
    }

    /// Rejette une offre de prix négocié
    pub async fn reject_offer(&self, offer_id: i32, user_id: i32) -> AppResult<()> {
        // ✅ CORRIGÉ: Vérifier que l'offre existe et que l'utilisateur est autorisé
        let offer = sqlx::query(
            r#"
            SELECT merchant_user_id, client_user_id, status
            FROM negotiated_prices
            WHERE id = $1
            "#,
        )
        .bind(offer_id)
        .fetch_optional(&self._pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification offre: {}", e)))?;

        let offer_row = offer.ok_or_else(|| AppError::NotFound("Offre introuvable".into()))?;

        let merchant_id: i32 = offer_row.get::<i32, _>("merchant_user_id");
        let _client_id: i32 = offer_row.get::<i32, _>("client_user_id");
        let status: String = offer_row.get::<String, _>("status");

        // Vérifier que l'utilisateur est le prestataire (seul le prestataire peut rejeter)
        if user_id != merchant_id {
            return Err(AppError::Forbidden(
                "Seul le prestataire peut rejeter une offre".into(),
            ));
        }

        // Vérifier que l'offre est en attente
        if status != "pending" {
            return Err(AppError::BadRequest(
                format!("L'offre n'est plus en attente (status: {})", status).into(),
            ));
        }

        // ✅ CORRIGÉ: Rejeter l'offre
        let rows_affected = sqlx::query(
            r#"
            UPDATE negotiated_prices
            SET status = 'rejected'
            WHERE id = $1 AND status = 'pending'
            "#,
        )
        .bind(offer_id)
        .execute(&self._pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur rejet offre: {}", e)))?;

        if rows_affected.rows_affected() == 0 {
            return Err(AppError::NotFound(
                "Offre introuvable ou déjà traitée".into(),
            ));
        }

        info!("✅ Offre de prix négocié rejetée: id={}", offer_id);
        Ok(())
    }

    /// ✅ NOUVEAU: Annule une offre de prix négocié (pour le client)
    pub async fn cancel_offer(&self, offer_id: i32, user_id: i32) -> AppResult<()> {
        // Vérifier que l'offre existe et que l'utilisateur est le client
        let offer = sqlx::query(
            r#"
            SELECT client_user_id, status
            FROM negotiated_prices
            WHERE id = $1
            "#,
        )
        .bind(offer_id)
        .fetch_optional(&self._pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification offre: {}", e)))?;

        let offer_row = offer.ok_or_else(|| AppError::NotFound("Offre introuvable".into()))?;

        let client_id: i32 = offer_row.get::<i32, _>("client_user_id");
        let status: String = offer_row.get::<String, _>("status");

        // Vérifier que l'utilisateur est le client
        if user_id != client_id {
            return Err(AppError::Forbidden(
                "Seul le client peut annuler sa propre offre".into(),
            ));
        }

        // Vérifier que l'offre est en attente
        if status != "pending" {
            return Err(AppError::BadRequest(
                format!("L'offre n'est plus en attente (status: {})", status).into(),
            ));
        }

        // Annuler l'offre
        let rows_affected = sqlx::query(
            r#"
            UPDATE negotiated_prices
            SET status = 'rejected'
            WHERE id = $1 AND status = 'pending'
            "#,
        )
        .bind(offer_id)
        .execute(&self._pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur annulation offre: {}", e)))?;

        if rows_affected.rows_affected() == 0 {
            return Err(AppError::NotFound(
                "Offre introuvable ou déjà traitée".into(),
            ));
        }

        info!("✅ Offre de prix négocié annulée: id={}", offer_id);
        Ok(())
    }
}
