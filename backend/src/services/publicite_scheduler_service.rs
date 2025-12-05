use log;
use sqlx::PgPool;

/// Service pour gérer la planification des publicités
pub struct PubliciteSchedulerService;

impl PubliciteSchedulerService {
    /// Activer les publicités programmées qui doivent démarrer
    pub async fn activate_scheduled_publicites(pool: &PgPool) -> Result<usize, sqlx::Error> {
        let count = sqlx::query(
            r#"
            UPDATE publicites
            SET status = 'active'
            WHERE status = 'pending'
            AND schedule IS NOT NULL
            AND (schedule->>'start_date')::timestamptz <= NOW()
            AND is_publicite_scheduled_active(id)
            "#,
        )
        .execute(pool)
        .await?;

        log::info!(
            "✅ [Scheduler] {} publicités activées",
            count.rows_affected()
        );
        Ok(count.rows_affected() as usize)
    }

    /// Désactiver les publicités programmées qui doivent se terminer
    pub async fn deactivate_expired_scheduled_publicites(
        pool: &PgPool,
    ) -> Result<usize, sqlx::Error> {
        let count = sqlx::query(
            r#"
            UPDATE publicites
            SET status = 'expired'
            WHERE status = 'active'
            AND (
                date_fin < NOW()
                OR (schedule IS NOT NULL AND NOT is_publicite_scheduled_active(id))
            )
            "#,
        )
        .execute(pool)
        .await?;

        log::info!(
            "✅ [Scheduler] {} publicités désactivées",
            count.rows_affected()
        );
        Ok(count.rows_affected() as usize)
    }

    /// Mettre en pause les publicités pendant les weekends si configuré
    pub async fn pause_weekend_publicites(pool: &PgPool) -> Result<usize, sqlx::Error> {
        let count = sqlx::query(
            r#"
            UPDATE publicites
            SET status = 'paused'
            WHERE status = 'active'
            AND schedule->>'pause_on_weekends' = 'true'
            AND EXTRACT(DOW FROM NOW()) IN (0, 6)
            "#,
        )
        .execute(pool)
        .await?;

        if count.rows_affected() > 0 {
            log::info!(
                "✅ [Scheduler] {} publicités mises en pause (weekend)",
                count.rows_affected()
            );
        }
        Ok(count.rows_affected() as usize)
    }

    /// Reprendre les publicités après le weekend
    pub async fn resume_weekend_publicites(pool: &PgPool) -> Result<usize, sqlx::Error> {
        let count = sqlx::query(
            r#"
            UPDATE publicites
            SET status = 'active'
            WHERE status = 'paused'
            AND schedule->>'pause_on_weekends' = 'true'
            AND EXTRACT(DOW FROM NOW()) NOT IN (0, 6)
            AND is_publicite_scheduled_active(id)
            "#,
        )
        .execute(pool)
        .await?;

        if count.rows_affected() > 0 {
            log::info!(
                "✅ [Scheduler] {} publicités reprises après weekend",
                count.rows_affected()
            );
        }
        Ok(count.rows_affected() as usize)
    }
}
