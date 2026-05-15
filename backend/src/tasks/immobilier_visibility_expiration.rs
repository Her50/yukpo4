// ✅ NOUVEAU 2026-01-26: Job quotidien pour expiration automatique visibilité immobilier
// Désactive les biens expirés et envoie notifications

use crate::core::types::AppResult;
use crate::services::notification_service::NotificationService;
use log::{error, info, warn};
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;

pub struct ImmobilierVisibilityExpirationTask {
    pool: Arc<PgPool>,
}

impl ImmobilierVisibilityExpirationTask {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Désactive les biens dont la visibilité a expiré
    pub async fn deactivate_expired_properties(&self) -> AppResult<usize> {
        info!("[ImmobilierVisibilityExpiration] 🔍 Vérification biens expirés...");

        // Désactiver biens expirés
        let deactivated_count: i64 = sqlx::query_scalar(
            r#"
            WITH expired_properties AS (
                SELECT DISTINCT p.id, p.service_id, s.user_id
                FROM real_estate_properties p
                INNER JOIN services s ON s.id = p.service_id
                WHERE p.is_visible_in_search = TRUE
                AND p.visibility_expires_at IS NOT NULL
                AND p.visibility_expires_at <= NOW()
            )
            UPDATE real_estate_properties p
            SET 
                is_visible_in_search = FALSE,
                updated_at = NOW()
            FROM expired_properties ep
            WHERE p.id = ep.id
            RETURNING p.id
            "#
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            error!("[ImmobilierVisibilityExpiration] Erreur désactivation: {}", e);
            e
        })?
        .len() as i64;

        // Mettre à jour statut abonnements expirés
        let _ = sqlx::query(
            r#"
            UPDATE immobilier_visibility_subscriptions
            SET 
                status = 'expired',
                is_active = FALSE,
                expired_at = NOW(),
                updated_at = NOW()
            WHERE status = 'active'
            AND is_active = TRUE
            AND date_fin <= NOW()
            "#
        )
        .execute(&*self.pool)
        .await
        .ok();

        // Envoyer notifications aux propriétaires
        let notification_service = NotificationService::new(self.pool.clone());
        let expired_properties: Vec<(i32, i32)> = sqlx::query_as(
            r#"
            SELECT DISTINCT p.id, s.user_id
            FROM real_estate_properties p
            INNER JOIN services s ON s.id = p.service_id
            WHERE p.is_visible_in_search = FALSE
            AND p.visibility_expires_at IS NOT NULL
            AND p.visibility_expires_at <= NOW()
            AND p.visibility_expires_at >= NOW() - INTERVAL '1 day'
            "#
        )
        .fetch_all(&*self.pool)
        .await
        .ok()
        .unwrap_or_default();

        for (property_id, user_id) in expired_properties {
            let _ = notification_service
                .send_notification(
                    user_id,
                    "Visibilité expirée",
                    "La visibilité de votre bien immobilier a expiré. Réactivez-le pour qu'il soit visible dans les recherches.",
                    Some(json!({
                        "type": "immobilier_visibility_expired",
                        "property_id": property_id,
                        "action": "reactivate"
                    })),
                )
                .await;
        }

        info!(
            "[ImmobilierVisibilityExpiration] ✅ {} biens désactivés",
            deactivated_count
        );

        Ok(deactivated_count as usize)
    }

    /// Envoie notifications 3 jours avant expiration
    pub async fn send_expiration_warnings(&self) -> AppResult<usize> {
        info!("[ImmobilierVisibilityExpiration] 🔔 Envoi alertes expiration...");

        let properties_expiring: Vec<(i32, i32, i32)> = sqlx::query_as(
            r#"
            SELECT DISTINCT p.id, s.user_id, 
                EXTRACT(DAY FROM (p.visibility_expires_at - NOW()))::INTEGER as days_remaining
            FROM real_estate_properties p
            INNER JOIN services s ON s.id = p.service_id
            WHERE p.is_visible_in_search = TRUE
            AND p.visibility_expires_at IS NOT NULL
            AND p.visibility_expires_at > NOW()
            AND p.visibility_expires_at <= NOW() + INTERVAL '3 days'
            AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.user_id = s.user_id
                AND n.data->>'type' = 'immobilier_visibility_warning'
                AND n.data->>'property_id' = p.id::TEXT
                AND n.created_at > NOW() - INTERVAL '1 day'
            )
            "#
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            error!("[ImmobilierVisibilityExpiration] Erreur récupération biens expirant: {}", e);
            e
        })?;

        let notification_service = NotificationService::new(self.pool.clone());
        let mut notified_count = 0;

        for (property_id, user_id, days_remaining) in properties_expiring {
            let message = if days_remaining == 1 {
                "La visibilité de votre bien immobilier expire demain. Réactivez-le pour continuer à être visible."
            } else {
                format!("La visibilité de votre bien immobilier expire dans {} jours. Réactivez-le pour continuer à être visible.", days_remaining)
            };

            let _ = notification_service
                .send_notification(
                    user_id,
                    "Alerte expiration visibilité",
                    &message,
                    Some(json!({
                        "type": "immobilier_visibility_warning",
                        "property_id": property_id,
                        "days_remaining": days_remaining,
                        "action": "reactivate"
                    })),
                )
                .await;

            notified_count += 1;
        }

        info!(
            "[ImmobilierVisibilityExpiration] ✅ {} notifications envoyées",
            notified_count
        );

        Ok(notified_count)
    }

    /// Exécute toutes les tâches d'expiration
    pub async fn run_all(&self) -> AppResult<()> {
        info!("[ImmobilierVisibilityExpiration] 🚀 Démarrage tâches expiration...");

        // 1. Envoyer alertes 3 jours avant
        if let Err(e) = self.send_expiration_warnings().await {
            warn!("[ImmobilierVisibilityExpiration] Erreur envoi alertes: {}", e);
        }

        // 2. Désactiver biens expirés
        if let Err(e) = self.deactivate_expired_properties().await {
            error!("[ImmobilierVisibilityExpiration] Erreur désactivation: {}", e);
            return Err(e);
        }

        info!("[ImmobilierVisibilityExpiration] ✅ Toutes les tâches terminées");

        Ok(())
    }
}

/// Démarre le job quotidien d'expiration visibilité
pub fn start_immobilier_visibility_expiration_task(pool: Arc<PgPool>) {
    let task = ImmobilierVisibilityExpirationTask::new(pool);
    
    tokio::spawn(async move {
        use tokio::time::{interval, Duration};
        let mut interval = interval(Duration::from_secs(3600)); // Toutes les heures
        
        // Exécuter immédiatement au démarrage
        if let Err(e) = task.run_all().await {
            error!("[ImmobilierVisibilityExpiration] Erreur exécution initiale: {}", e);
        }
        
        loop {
            interval.tick().await;
            info!("[ImmobilierVisibilityExpiration] 🔄 Exécution tâche expiration...");
            if let Err(e) = task.run_all().await {
                error!("[ImmobilierVisibilityExpiration] Erreur exécution: {}", e);
            }
        }
    });
}

