use crate::core::types::{AppError, AppResult};
use crate::services::push_notification_service;
use crate::services::similar_products_service::SimilarProductsService;
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// Service pour envoyer des notifications intelligentes avec redirection automatique
pub struct SmartNotificationService {
    pool: PgPool,
    similar_products_service: SimilarProductsService,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRedirect {
    pub screen: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlternativeProduct {
    pub service_id: i32,
    pub product_index: i32,
    pub product_id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub price: Option<f64>,
    pub similarity_score: f64,
    pub is_available: bool,
    pub is_immediately_available: bool,
    pub preparation_time_minutes: Option<i32>,
    pub pickup_address: Option<String>,
}

impl SmartNotificationService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            similar_products_service: SimilarProductsService::new(pool),
        }
    }

    /// Notifie le client qu'une commande a été rejetée avec alternatives
    pub async fn notify_client_order_rejected_with_alternatives(
        &self,
        client_user_id: i32,
        order_id: Uuid,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<()> {
        info!(
            "[SmartNotification] Recherche produits similaires pour order_id={}, service_id={}, product_index={}",
            order_id, service_id, product_index
        );

        // Rechercher des produits similaires
        let similar_products = self
            .similar_products_service
            .find_similar_products(service_id, product_index, 5)
            .await?;

        // Convertir en AlternativeProduct
        let alternatives: Vec<AlternativeProduct> = similar_products
            .into_iter()
            .map(|p| AlternativeProduct {
                service_id: p.service_id,
                product_index: p.product_index,
                product_id: p.product_id,
                name: p.name,
                description: p.description,
                category: p.category,
                price: p.price,
                similarity_score: p.similarity_score,
                is_available: p.is_available,
                is_immediately_available: p.is_immediately_available,
                preparation_time_minutes: p.preparation_time_minutes,
                pickup_address: p.pickup_address,
            })
            .collect();

        if alternatives.is_empty() {
            // Pas de produits similaires, envoyer notification simple
            return self
                .notify_client_order_rejected(client_user_id, order_id, None)
                .await;
        }

        // Construire le payload de notification avec produits préchargés
        let search_query = alternatives
            .first()
            .map(|p| p.name.clone())
            .unwrap_or_default();

        let notification_data = json!({
            "type": "order_rejected_with_alternatives",
            "order_id": order_id,
            "alternatives": alternatives,
            "redirect": {
                "screen": "ResultatBesoin",
                "params": {
                    "results": alternatives,
                    "searchQuery": search_query,
                    "type": "similar_products",
                    "title": "Produits similaires disponibles"
                }
            }
        });

        // Envoyer notification push
        push_notification_service::send_push_notification(
            &self.pool,
            client_user_id,
            "🔄 Produit non disponible".to_string(),
            "Voici des alternatives disponibles".to_string(),
            Some(notification_data),
            Some("default".to_string()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("Erreur envoi notification: {}", e)))?;

        info!(
            "[SmartNotification] Notification envoyée avec {} alternatives pour order_id={}",
            alternatives.len(),
            order_id
        );

        Ok(())
    }

    /// Notifie le client qu'une commande a été rejetée (sans alternatives)
    pub async fn notify_client_order_rejected(
        &self,
        client_user_id: i32,
        order_id: Uuid,
        reason: Option<String>,
    ) -> AppResult<()> {
        let notification_data = json!({
            "type": "order_rejected",
            "order_id": order_id,
            "reason": reason
        });

        push_notification_service::send_push_notification(
            &self.pool,
            client_user_id,
            "❌ Commande rejetée".to_string(),
            reason.unwrap_or_else(|| "Le prestataire a rejeté votre commande".to_string()),
            Some(notification_data),
            Some("default".to_string()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("Erreur envoi notification: {}", e)))?;

        Ok(())
    }

    /// Notifie le client qu'une commande a été annulée (timeout)
    pub async fn notify_client_order_timeout_with_alternatives(
        &self,
        client_user_id: i32,
        order_id: Uuid,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<()> {
        info!(
            "[SmartNotification] Commande timeout, recherche alternatives: order_id={}",
            order_id
        );

        // Rechercher des produits similaires
        let similar_products = self
            .similar_products_service
            .find_similar_products(service_id, product_index, 5)
            .await?;

        let alternatives: Vec<AlternativeProduct> = similar_products
            .into_iter()
            .map(|p| AlternativeProduct {
                service_id: p.service_id,
                product_index: p.product_index,
                product_id: p.product_id,
                name: p.name,
                description: p.description,
                category: p.category,
                price: p.price,
                similarity_score: p.similarity_score,
                is_available: p.is_available,
                is_immediately_available: p.is_immediately_available,
                preparation_time_minutes: p.preparation_time_minutes,
                pickup_address: p.pickup_address,
            })
            .collect();

        let search_query = alternatives
            .first()
            .map(|p| p.name.clone())
            .unwrap_or_default();

        let notification_data = json!({
            "type": "order_timeout_with_alternatives",
            "order_id": order_id,
            "alternatives": alternatives,
            "redirect": {
                "screen": "ResultatBesoin",
                "params": {
                    "results": alternatives,
                    "searchQuery": search_query,
                    "type": "similar_products",
                    "title": "Produits similaires disponibles"
                }
            }
        });

        push_notification_service::send_push_notification(
            &self.pool,
            client_user_id,
            "⏱️ Commande expirée".to_string(),
            "Le prestataire n'a pas répondu à temps. Voici des alternatives".to_string(),
            Some(notification_data),
            Some("default".to_string()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("Erreur envoi notification: {}", e)))?;

        Ok(())
    }

    /// Notifie le prestataire d'une nouvelle commande
    pub async fn notify_provider_new_order(
        &self,
        provider_user_id: i32,
        order_id: Uuid,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<()> {
        let notification_data = json!({
            "type": "new_order",
            "order_id": order_id,
            "service_id": service_id,
            "product_index": product_index,
            "redirect": {
                "screen": "ProviderOrderManagement",
                "params": {
                    "order_id": order_id
                }
            }
        });

        push_notification_service::send_push_notification(
            &self.pool,
            provider_user_id,
            "🆕 Nouvelle commande".to_string(),
            "Vous avez reçu une nouvelle commande".to_string(),
            Some(notification_data),
            Some("order_notification".to_string()), // Son spécial pour nouvelles commandes
        )
        .await
        .map_err(|e| AppError::Internal(format!("Erreur envoi notification: {}", e)))?;

        Ok(())
    }

    /// Notifie le client qu'une commande est prête
    pub async fn notify_client_order_ready(
        &self,
        client_user_id: i32,
        order_id: Uuid,
    ) -> AppResult<()> {
        let notification_data = json!({
            "type": "order_ready",
            "order_id": order_id,
            "redirect": {
                "screen": "OrderStatus",
                "params": {
                    "order_id": order_id
                }
            }
        });

        push_notification_service::send_push_notification(
            &self.pool,
            client_user_id,
            "✅ Commande prête".to_string(),
            "Votre commande est prête pour la livraison".to_string(),
            Some(notification_data),
            Some("order_ready".to_string()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("Erreur envoi notification: {}", e)))?;

        Ok(())
    }

    /// Notifie le client qu'un coursier a été assigné
    pub async fn notify_client_courier_assigned(
        &self,
        client_user_id: i32,
        order_id: Uuid,
        courier_name: Option<String>,
    ) -> AppResult<()> {
        let notification_data = json!({
            "type": "courier_assigned",
            "order_id": order_id,
            "courier_name": courier_name,
            "redirect": {
                "screen": "OrderStatus",
                "params": {
                    "order_id": order_id
                }
            }
        });

        let body = if let Some(name) = courier_name {
            format!("Le coursier {} a été assigné à votre commande", name)
        } else {
            "Un coursier a été assigné à votre commande".to_string()
        };

        push_notification_service::send_push_notification(
            &self.pool,
            client_user_id,
            "🚚 Coursier assigné".to_string(),
            body,
            Some(notification_data),
            Some("courier_assigned".to_string()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("Erreur envoi notification: {}", e)))?;

        Ok(())
    }
}
