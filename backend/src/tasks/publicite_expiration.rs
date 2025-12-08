use log;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::time::{interval, Duration};

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
    let result = sqlx::query(
        r#"
        UPDATE publicites
        SET status = 'expired'
        WHERE status = 'active'
        AND date_fin < NOW()
        "#,
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Notifie les utilisateurs dont les publicités expirent bientôt
async fn check_expiring_soon_publicites(pool: &PgPool) -> Result<usize, sqlx::Error> {
    let expiring_publicites = sqlx::query(
        r#"
        SELECT id, user_id, titre, date_fin,
               EXTRACT(DAY FROM (date_fin - NOW()))::integer as jours_restants
        FROM publicites
        WHERE status = 'active'
        AND date_fin > NOW()
        AND date_fin < NOW() + INTERVAL '7 days'
        AND (
            NOT EXISTS (
                SELECT 1 FROM notifications 
                WHERE user_id = publicites.user_id 
                AND notification_type = 'publicite_expiring'
                AND created_at > NOW() - INTERVAL '24 hours'
            )
        )
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut notifications_sent = 0;

    for pub_row in expiring_publicites {
        let user_id: i32 = pub_row.get::<Option<_>, _>("user_id").unwrap_or(0);
        let titre: String = pub_row.get::<Option<_>, _>("titre").unwrap_or_default();
        let jours_restants: i32 = pub_row.get::<Option<_>, _>("jours_restants").unwrap_or(0);

        let message = format!(
            "⚠️ Votre publicité '{}' expire dans {} jour(s). Pensez à la renouveler.",
            titre, jours_restants
        );

        let metadata = serde_json::json!({
            "publicite_id": pub_row.get::<i32, _>("id"),
            "jours_restants": jours_restants,
            "titre": titre
        });

        // Créer une notification (si la table existe)
        match sqlx::query(
            r#"
            INSERT INTO notifications (user_id, notification_type, message, metadata)
            VALUES ($1, 'publicite_expiring', $2, $3)
            "#,
        )
        .bind(user_id)
        .bind(&message)
        .bind(metadata)
        .execute(pool)
        .await
        {
            Ok(_) => {
                log::info!(
                    "📧 Notification envoyée à l'utilisateur {} pour publicité '{}'",
                    user_id,
                    titre
                );
                notifications_sent += 1;
            }
            Err(e) => {
                log::warn!("Erreur création notification: {:?}", e);
            }
        }
    }

    Ok(notifications_sent)
}

/// Fonction publique pour désactivation manuelle (API)
pub async fn deactivate_expired_publicites_now(pool: &PgPool) -> Result<u64, sqlx::Error> {
    log::info!("🔧 [Manual] Désactivation manuelle des publicités expirées");
    check_and_deactivate_expired_publicites(pool).await
}
