// Service m?tier pour la gestion des alertes persistantes et relances
// ? compl?ter avec la logique d'alerte, relance, notification sonore/mail, etc.

use crate::models::alert_model::Alert;
use sqlx::PgPool;
use chrono::Utc;

pub async fn create_alert(pool: &PgPool, user_id: i32, service_id: i32, client_id: i32, alert_type: &str) -> Result<Alert, sqlx::Error> {
    let rec = sqlx::query_as!(Alert,
        r#"INSERT INTO alerts (user_id, service_id, client_id, alert_type, is_read, created_at)
           VALUES ($1, $2, $3, $4, FALSE, $5)
           RETURNING id, user_id, service_id, client_id, alert_type, is_read, created_at as "created_at: chrono::NaiveDateTime""#,
        user_id, service_id, client_id, alert_type, Utc::now()
    )
    .fetch_one(pool)
    .await?;
    Ok(rec)
}

pub async fn get_alerts(pool: &PgPool, user_id: i32) -> Result<Vec<Alert>, sqlx::Error> {
    let recs = sqlx::query_as!(Alert,
        r#"SELECT id, user_id, service_id, client_id, alert_type, is_read, created_at as "created_at: chrono::NaiveDateTime" FROM alerts WHERE user_id = $1 ORDER BY created_at DESC"#,
        user_id
    )
    .fetch_all(pool)
    .await?;
    Ok(recs)
}

pub async fn mark_alert_read(pool: &PgPool, alert_id: i32) -> Result<(), sqlx::Error> {
    sqlx::query!("UPDATE alerts SET is_read = TRUE WHERE id = $1", alert_id)
        .execute(pool)
        .await?;
    Ok(())
}
