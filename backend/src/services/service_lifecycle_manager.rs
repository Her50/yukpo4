use sqlx::PgPool;
use chrono::Utc;
use crate::core::types::AppError;

/// ?? V?rifie les services ? d?sactiver et journalise les actions
pub async fn check_and_update_service_status(pool: &PgPool) -> Result<(), AppError> {
    // Correction des types pour correspondre aux attentes
    let now: chrono::DateTime<Utc> = Utc::now();

    // 1. R?cup?rer les services expir?s ? d?sactiver
    let expired_services = sqlx::query!(
        r#"
        SELECT id, user_id
        FROM services
        WHERE is_active = TRUE
          AND auto_deactivate_at IS NOT NULL
          AND auto_deactivate_at < $1
          -- OPTIONNEL : filtrer par type ou cat?gorie
          -- AND category = 'premium'
        "#,
        now
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    // 2. Mettre ? jour les statuts
    let affected = sqlx::query!(
        r#"
        UPDATE services
        SET is_active = FALSE
        WHERE is_active = TRUE
          AND auto_deactivate_at IS NOT NULL
          AND auto_deactivate_at < $1
        "#,
        now
    )
    .execute(pool)
    .await
    .map_err(AppError::from)?
    .rows_affected();

    println!("? {} service(s) d?sactiv?(s) automatiquement.", affected);

    // 3. Logger chaque d?sactivation
    for service in expired_services {
        sqlx::query!(
            r#"
            INSERT INTO service_logs (service_id, user_id, action, reason)
            VALUES ($1, $2, 'auto_deactivation', 'Expiration de la p?riode active')
            "#,
            service.id,
            service.user_id
        )
        .execute(pool)
        .await
        .map_err(AppError::from)?;
    }

    Ok(())
}

/// ?? Enregistre les modifications des services dans les logs
pub async fn enregistrer_modification_service(
    service_id: i32,
    user_id: i32,
    modification: &str,
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO service_logs (service_id, user_id, modification, created_at) VALUES ($1, $2, $3, $4)",
        service_id,
        user_id,
        modification,
        Utc::now().naive_utc()
    )
    .execute(pool)
    .await?;

    Ok(())
}
