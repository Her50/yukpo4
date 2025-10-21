use sqlx::PgPool;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use log;

/// Tâche périodique pour désactiver les publicités expirées
/// S'exécute toutes les heures
pub async fn start_publicite_expiration_task(pool: Arc<PgPool>) {
    log::info!("🕐 [Cron] Démarrage de la tâche de désactivation des publicités expirées");

    let mut interval_timer = interval(Duration::from_secs(3600)); // Toutes les heures

    loop {
        interval_timer.tick().await;

        log::info!("⏰ [Cron] Vérification des publicités expirées...");

        match check_and_deactivate_expired_publicites(&pool).await {
            Ok(count) => {
                if count > 0 {
                    log::info!("✅ [Cron] {} publicité(s) expirée(s) désactivée(s)", count);
                } else {
                    log::debug!("✓ [Cron] Aucune publicité expirée trouvée");
                }
            }
            Err(e) => {
                log::error!("❌ [Cron] Erreur lors de la désactivation: {:?}", e);
            }
        }

        // Vérifier aussi les publicités qui expirent dans 7 jours pour notifications
        match check_expiring_soon_publicites(&pool).await {
            Ok(count) => {
                if count > 0 {
                    log::info!("📧 [Cron] {} notification(s) envoyée(s) pour publicités proches expiration", count);
                }
            }
            Err(e) => {
                log::error!("❌ [Cron] Erreur notifications expiration: {:?}", e);
            }
        }
    }
}

/// Désactive les publicités expirées
async fn check_and_deactivate_expired_publicites(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        UPDATE publicites
        SET status = 'expired'
        WHERE status = 'active'
        AND date_fin < NOW()
        "#
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Vérifie les publicités qui expirent bientôt et envoie des notifications
async fn check_expiring_soon_publicites(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let expiring_publicites = sqlx::query!(
        r#"
        SELECT id, user_id, titre, date_fin,
               EXTRACT(DAY FROM (date_fin - NOW()))::integer as jours_restants
        FROM publicites
        WHERE status = 'active'
        AND date_fin > NOW()
        AND date_fin < NOW() + INTERVAL '7 days'
        AND NOT EXISTS (
            SELECT 1 FROM notifications
            WHERE user_id = publicites.user_id
            AND notification_type = 'publicite_expiring'
            AND metadata->>'publicite_id' = publicites.id::text
            AND created_at > NOW() - INTERVAL '7 days'
        )
        "#
    )
    .fetch_all(pool)
    .await?;

    let mut notification_count = 0;

    for pub_record in expiring_publicites {
        let jours_restants = pub_record.jours_restants.unwrap_or(0);

        // Créer une notification
        let message = format!(
            "⚠️ Votre publicité '{}' expire dans {} jour(s). Pensez à la relancer!",
            pub_record.titre,
            jours_restants
        );

        let metadata = serde_json::json!({
            "publicite_id": pub_record.id,
            "titre": pub_record.titre,
            "jours_restants": jours_restants,
            "date_fin": pub_record.date_fin
        });

        match sqlx::query!(
            r#"
            INSERT INTO notifications (user_id, notification_type, message, metadata)
            VALUES ($1, 'publicite_expiring', $2, $3)
            "#,
            pub_record.user_id,
            message,
            metadata
        )
        .execute(pool)
        .await
        {
            Ok(_) => {
                notification_count += 1;
                log::info!(
                    "📧 Notification envoyée pour publicité {} (user {})",
                    pub_record.id,
                    pub_record.user_id
                );
            }
            Err(e) => {
                log::warn!("Erreur création notification: {:?}", e);
            }
        }
    }

    Ok(notification_count)
}

/// Fonction manuelle pour désactiver les publicités expirées
/// Peut être appelée via un endpoint admin ou un script
pub async fn manual_deactivate_expired_publicites(pool: &PgPool) -> Result<u64, sqlx::Error> {
    log::info!("🔧 [Manual] Désactivation manuelle des publicités expirées");
    check_and_deactivate_expired_publicites(pool).await
}


