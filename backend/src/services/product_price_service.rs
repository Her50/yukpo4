use chrono::Utc;
use log::debug;
use serde_json::Value;
use sqlx::PgPool;

use crate::core::types::{AppError, AppResult};
use crate::services::global_promo_service::GlobalPromoService;
use crate::services::negotiated_price_service::NegotiatedPriceService;

/// Service pour calculer le prix réel d'un produit en tenant compte de toutes les promotions
pub struct ProductPriceService;

impl ProductPriceService {
    /// Récupère le prix réel d'un produit en tenant compte de :
    /// 1. Prix négocié (si conversation_id fourni)
    /// 2. Promotions produit (dans le JSON du produit/service)
    /// 3. Promotions globales (global_promo_entries)
    /// 
    /// Priorité : Prix négocié > Promotion produit > Promotion globale > Prix de base
    pub async fn get_real_product_price(
        pool: &PgPool,
        service_id: i32,
        product: &Value,
        product_index: Option<i32>,
        conversation_id: Option<i32>,
        client_user_id: Option<i32>,
    ) -> AppResult<f64> {
        // 1. Récupérer le prix de base
        let base_price = product
            .get("price")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        if base_price <= 0.0 {
            return Ok(0.0);
        }

        // 1. Vérifier s'il y a un prix négocié actif (priorité absolue)
        if let (Some(conv_id), Some(client_id)) = (conversation_id, client_user_id) {
            let negotiated_service = NegotiatedPriceService::new(pool.clone());
            if let Ok(Some(negotiated_price_cents)) = negotiated_service
                .get_active_negotiated_price(conv_id, service_id, product_index, client_id)
                .await
            {
                let negotiated_price = (negotiated_price_cents as f64) / 100.0;
                debug!(
                    "[ProductPriceService] Prix négocié trouvé pour conversation {}: {} FCFA (base: {} FCFA)",
                    conv_id, negotiated_price, base_price
                );
                return Ok(negotiated_price);
            }
        }

        // 2. Vérifier les promotions produit (dans le JSON du produit)
        if let Some(product_promo_price) = Self::get_product_promotion_price(product) {
            debug!(
                "[ProductPriceService] Promotion produit trouvée pour service {}: {} FCFA (base: {} FCFA)",
                service_id, product_promo_price, base_price
            );
            return Ok(product_promo_price);
        }

        // 3. Vérifier les promotions globales (global_promo_entries)
        if let Ok(global_promo_price) = GlobalPromoService::get_real_product_price(
            pool,
            service_id,
            product_index,
            base_price,
        )
        .await
        {
            if (global_promo_price - base_price).abs() > 0.01 {
                debug!(
                    "[ProductPriceService] Promotion globale trouvée pour service {}: {} FCFA (base: {} FCFA)",
                    service_id, global_promo_price, base_price
                );
                return Ok(global_promo_price);
            }
        }

        // 4. Pas de promotion : retourner le prix de base
        Ok(base_price)
    }

    /// Récupère le prix réel en centimes
    pub async fn get_real_product_price_cents(
        pool: &PgPool,
        service_id: i32,
        product: &Value,
        product_index: Option<i32>,
        conversation_id: Option<i32>,
        client_user_id: Option<i32>,
    ) -> AppResult<i64> {
        let real_price = Self::get_real_product_price(
            pool,
            service_id,
            product,
            product_index,
            conversation_id,
            client_user_id,
        )
        .await?;
        Ok((real_price * 100.0) as i64)
    }

    /// Vérifie si un produit a une promotion active dans son JSON
    /// Format attendu :
    /// {
    ///   "promotionActive": true,
    ///   "promotionValeur": "20%" ou "-5000" ou "5000",
    ///   "promotionDateFin": "2025-01-31T23:59:59Z" (optionnel)
    /// }
    fn get_product_promotion_price(product: &Value) -> Option<f64> {
        // Vérifier si la promotion est active
        let promotion_active = product
            .get("promotionActive")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if !promotion_active {
            return None;
        }

        // Vérifier la date de fin (si fournie)
        if let Some(end_date_str) = product.get("promotionDateFin").and_then(|v| v.as_str()) {
            if let Ok(end_date) = chrono::DateTime::parse_from_rfc3339(end_date_str) {
                let now = Utc::now();
                let end_date_utc = end_date.with_timezone(&Utc);
                if now > end_date_utc {
                    // Promotion expirée
                    return None;
                }
            }
        }

        // Récupérer le prix de base
        let base_price = product
            .get("price")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        if base_price <= 0.0 {
            return None;
        }

        // Récupérer la valeur de promotion
        let promotion_valeur_str = product
            .get("promotionValeur")
            .and_then(|v| {
                if let Some(s) = v.as_str() {
                    Some(s.to_string())
                } else if let Some(f) = v.as_f64() {
                    Some(f.to_string())
                } else {
                    None
                }
            });

        if let Some(valeur_str) = promotion_valeur_str {
            // Parser la valeur de promotion
            let valeur_str = valeur_str.trim();

            // Cas 1 : Pourcentage (ex: "20%", "20 %")
            if valeur_str.ends_with('%') {
                if let Ok(percentage) = valeur_str
                    .trim_end_matches('%')
                    .trim()
                    .parse::<f64>()
                {
                    let discounted = base_price * (1.0 - percentage / 100.0);
                    return Some(discounted.max(0.0));
                }
            }

            // Cas 2 : Réduction fixe (ex: "-5000", "-5000 FCFA")
            if valeur_str.starts_with('-') {
                if let Ok(reduction) = valeur_str
                    .trim_start_matches('-')
                    .trim()
                    .split_whitespace()
                    .next()
                    .and_then(|s| s.parse::<f64>().ok())
                {
                    let discounted = base_price - reduction;
                    return Some(discounted.max(0.0));
                }
            }

            // Cas 3 : Prix fixe (ex: "5000", "5000 FCFA")
            if let Ok(fixed_price) = valeur_str
                .split_whitespace()
                .next()
                .and_then(|s| s.parse::<f64>().ok())
            {
                // Si le prix fixe est inférieur au prix de base, c'est une promotion
                if fixed_price < base_price {
                    return Some(fixed_price);
                }
            }
        }

        // Vérifier aussi les champs alternatifs (pour compatibilité)
        if let Some(promo_price) = product.get("promo_price").and_then(|v| v.as_f64()) {
            if promo_price < base_price && promo_price > 0.0 {
                return Some(promo_price);
            }
        }

        if let Some(discounted_price) = product.get("discounted_price").and_then(|v| v.as_f64()) {
            if discounted_price < base_price && discounted_price > 0.0 {
                return Some(discounted_price);
            }
        }

        None
    }

    /// Vérifie si un produit a une promotion active (produit ou globale)
    pub async fn has_active_promotion(
        pool: &PgPool,
        service_id: i32,
        product: &Value,
        product_index: Option<i32>,
    ) -> AppResult<bool> {
        // Vérifier promotion produit
        if Self::get_product_promotion_price(product).is_some() {
            return Ok(true);
        }

        // Vérifier promotion globale
        let base_price = product
            .get("price")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        if base_price <= 0.0 {
            return Ok(false);
        }

        match GlobalPromoService::get_real_product_price(
            pool,
            service_id,
            product_index,
            base_price,
        )
        .await
        {
            Ok(real_price) => Ok((real_price - base_price).abs() > 0.01),
            Err(_) => Ok(false),
        }
    }
}

