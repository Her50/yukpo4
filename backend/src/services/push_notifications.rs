use crate::core::types::AppResult;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushSubscription {
    pub id: i32,
    pub user_id: i32,
    pub endpoint: String,
    pub p256dh: String,
    pub auth: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushMessage {
    pub title: String,
    pub body: String,
    pub icon: Option<String>,
    pub badge: Option<String>,
    pub data: Option<serde_json::Value>,
    pub actions: Option<Vec<PushAction>>,
    pub tag: Option<String>,
    pub require_interaction: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushAction {
    pub action: String,
    pub title: String,
    pub icon: Option<String>,
}

pub struct PushNotificationService {
    pool: PgPool,
    subscriptions: Arc<RwLock<HashMap<i32, PushSubscription>>>,
}

impl PushNotificationService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Enregistrer une nouvelle subscription push
    pub async fn register_subscription(
        &self,
        user_id: i32,
        endpoint: String,
        p256dh: String,
        auth: String,
    ) -> AppResult<PushSubscription> {
        let subscription = sqlx::query_as!(
            PushSubscription,
            r#"
            INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, endpoint, p256dh, auth, created_at
            "#,
            user_id,
            endpoint,
            p256dh,
            auth
        )
        .fetch_one(&self.pool)
        .await?;

        // Mettre en cache
        {
            let mut subs = self.subscriptions.write().await;
            subs.insert(user_id, subscription.clone());
        }

        Ok(subscription)
    }

    /// Envoyer une notification push
    pub async fn send_notification(
        &self,
        user_id: i32,
        message: PushMessage,
    ) -> AppResult<()> {
        // Récupérer la subscription
        let subscription = {
            let subs = self.subscriptions.read().await;
            subs.get(&user_id).cloned()
        };

        let subscription = match subscription {
            Some(sub) => sub,
            None => {
                // Récupérer depuis la base de données
                let sub = sqlx::query_as!(
                    PushSubscription,
                    "SELECT id, user_id, endpoint, p256dh, auth, created_at FROM push_subscriptions WHERE user_id = $1",
                    user_id
                )
                .fetch_one(&self.pool)
                .await?;
                
                // Mettre en cache
                {
                    let mut subs = self.subscriptions.write().await;
                    subs.insert(user_id, sub.clone());
                }
                
                sub
            }
        };

        // Envoyer la notification via le service push
        self.send_push_notification(&subscription, &message).await?;

        Ok(())
    }

    /// Envoyer une notification push à plusieurs utilisateurs
    pub async fn send_bulk_notification(
        &self,
        user_ids: Vec<i32>,
        message: PushMessage,
    ) -> AppResult<()> {
        for user_id in user_ids {
            if let Err(e) = self.send_notification(user_id, message.clone()).await {
                log::error!("Erreur envoi notification push à l'utilisateur {}: {}", user_id, e);
            }
        }
        Ok(())
    }

    /// Envoyer la notification push via le service web
    async fn send_push_notification(
        &self,
        subscription: &PushSubscription,
        message: &PushMessage,
    ) -> AppResult<()> {
        // Créer le payload de la notification
        let payload = serde_json::json!({
            "title": message.title,
            "body": message.body,
            "icon": message.icon,
            "badge": message.badge,
            "data": message.data,
            "actions": message.actions,
            "tag": message.tag,
            "require_interaction": message.require_interaction,
        });

        // Envoyer via le service push (à implémenter selon vos besoins)
        // Pour l'instant, on simule l'envoi
        log::info!(
            "Notification push envoyée à l'utilisateur {}: {}",
            subscription.user_id,
            message.title
        );

        Ok(())
    }

    /// Supprimer une subscription
    pub async fn remove_subscription(&self, user_id: i32) -> AppResult<()> {
        sqlx::query!("DELETE FROM push_subscriptions WHERE user_id = $1", user_id)
            .execute(&self.pool)
            .await?;

        // Retirer du cache
        {
            let mut subs = self.subscriptions.write().await;
            subs.remove(&user_id);
        }

        Ok(())
    }
} 