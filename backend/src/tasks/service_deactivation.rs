use chrono::Utc;
use sqlx::PgPool;
use log::{info};

/// ?? D?sactive automatiquement les services tarissables en fonction de leur vitesse de tarissement
pub async fn desactiver_services_tarissables(pool: &PgPool) -> Result<(), sqlx::Error> {
    let maintenant = Utc::now();
    let il_y_a_7_jours = maintenant - chrono::Duration::days(7);
    let il_y_a_14_jours = maintenant - chrono::Duration::days(14);
    let il_y_a_30_jours = maintenant - chrono::Duration::days(30);

    // D?sactivation des services ? tarissement rapide (1 semaine)
    sqlx::query!(
        "UPDATE services SET is_active = FALSE WHERE is_tarissable = TRUE AND vitesse_tarissement = 'rapide' AND updated_at < $1",
        il_y_a_7_jours
    )
    .execute(pool)
    .await?;

    // D?sactivation des services ? tarissement moyen (2 semaines)
    sqlx::query!(
        "UPDATE services SET is_active = FALSE WHERE is_tarissable = TRUE AND vitesse_tarissement = 'moyenne' AND updated_at < $1",
        il_y_a_14_jours
    )
    .execute(pool)
    .await?;

    // D?sactivation des services ? tarissement lent (1 mois)
    sqlx::query!(
        "UPDATE services SET is_active = FALSE WHERE is_tarissable = TRUE AND vitesse_tarissement = 'lente' AND updated_at < $1",
        il_y_a_30_jours
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ?? Envoie des alertes aux prestataires pour les services d?sactiv?s
pub async fn envoyer_alertes_prestataires(pool: &PgPool) -> Result<(), sqlx::Error> {
    let maintenant = Utc::now();
    let il_y_a_24_heures = (maintenant - chrono::Duration::hours(24)).naive_utc();

    // R?cup?rer les services d?sactiv?s sans alerte r?cente
    let services = sqlx::query!(
        r#"
        SELECT id, user_id, last_alert_sent_at
        FROM services
        WHERE is_active = FALSE
          AND is_tarissable = TRUE
          AND (last_alert_sent_at IS NULL OR last_alert_sent_at < $1)
        "#,
        il_y_a_24_heures
    )
    .fetch_all(pool)
    .await?;

    for service in services {
        // Envoyer une alerte au prestataire (par email ou notification)
        info!("Envoi d'une alerte pour le service {} au prestataire {}", service.id, service.user_id);

        // Correction pour convertir `maintenant` en NaiveDateTime
        let maintenant_naive = maintenant.naive_utc();

        // Mettre ? jour la date de la derni?re alerte
        sqlx::query!(
            "UPDATE services SET last_alert_sent_at = $1 WHERE id = $2",
            maintenant_naive,
            service.id
        )
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// ?? Permet au prestataire de confirmer la d?sactivation d'un service
pub async fn confirmer_desactivation(
    pool: &PgPool,
    service_id: i32,
    user_id: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE services SET is_active = FALSE WHERE id = $1 AND user_id = $2",
        service_id,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(())
}





