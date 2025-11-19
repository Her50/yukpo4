use chrono::{Duration, Utc};
use log::{error, info, warn};
use serde::Serialize;
use serde_json::Value;
use sqlx::{FromRow, PgPool, Row};
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

        // Note: negotiated_prices table n'existe pas encore dans les migrations
        // TODO: Créer la migration pour cette table
        // Pour l'instant, cette fonction est un placeholder

        // Note: negotiated_prices table n'existe pas encore dans les migrations
        // TODO: Créer la migration pour cette table
        // Pour l'instant, retourner un ID placeholder
        let id = 0;

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
        // Note: negotiated_prices table n'existe pas encore dans les migrations
        // TODO: Créer la migration pour cette table
        // Pour l'instant, retourner None
        Ok(None)
    }

    /// Récupère l'offre en attente pour une conversation/service/produit
    pub async fn get_pending_offer(
        &self,
        conversation_id: i32,
        service_id: i32,
        product_index: Option<i32>,
        client_user_id: i32,
    ) -> AppResult<Option<NegotiatedPriceOffer>> {
        // Note: negotiated_prices table n'existe pas encore dans les migrations
        // TODO: Créer la migration pour cette table
        // Pour l'instant, retourner None
        Ok(None)
    }

    /// Accepte une offre de prix négocié
    pub async fn accept_offer(&self, offer_id: i32, client_user_id: i32) -> AppResult<()> {
        // Note: negotiated_prices table n'existe pas encore dans les migrations
        // TODO: Créer la migration pour cette table
        // Pour l'instant, retourner une erreur
        Err(AppError::NotFound("Offre introuvable ou expirée".into()))
    }

    /// Rejette une offre de prix négocié
    pub async fn reject_offer(&self, offer_id: i32, client_user_id: i32) -> AppResult<()> {
        // Note: negotiated_prices table n'existe pas encore dans les migrations
        // TODO: Créer la migration pour cette table
        // Pour l'instant, retourner une erreur
        Err(AppError::NotFound("Offre introuvable".into()))
    }
}


