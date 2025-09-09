use sqlx::PgPool;
use chrono::{Utc, Duration};
use crate::core::types::AppError;
use serde_json::Value;

pub async fn reactivate_service(
    pool: &PgPool,
    service_id: i32,
    user_id: i32,
    extra_duration: Duration, // e.g. Duration::hours(24)
) -> Result<Value, AppError> {
    // R?cup?rer si le service est tarissable
    let service = sqlx::query!(
        "SELECT is_tarissable FROM services WHERE id = $1 AND user_id = $2",
        service_id,
        user_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::internal_server_error(e.to_string()))?;

    // Limitation ? 30 jours si tarissable
    let mut days = extra_duration.num_days();
    if service.is_tarissable.unwrap_or(false) && days > 30 {
        days = 30;
    }
    let new_off = Utc::now() + Duration::days(days);

    let updated = sqlx::query!(
        r#"
        UPDATE services
           SET is_active = TRUE,
               last_reactivated_at = NOW(),
               active_days = $4,
               auto_deactivate_at = $3
         WHERE id = $1
           AND user_id = $2
         RETURNING id, auto_deactivate_at
        "#,
        service_id,
        user_id,
        new_off,
        days as i32
    )
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::internal_server_error(e.to_string()))?;

    // R?indexation Pinecone : r?cup?rer les donn?es du service
    let rec = sqlx::query!("SELECT data, gps FROM services WHERE id = $1", service_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::internal_server_error(e.to_string()))?;
    let _data_obj: serde_json::Value = serde_json::from_value(rec.data).unwrap_or_default();
    let gps = rec.gps.as_ref().and_then(|s| {
        let parts: Vec<&str> = s.split(',').collect();
        if parts.len() == 2 {
            Some((parts[0].trim().parse().unwrap_or(0.0), parts[1].trim().parse().unwrap_or(0.0)))
        } else { None }
    });
    let (_gps_lat, _gps_lon) = gps.map_or((None, None), |(lon, lat)| (Some(lat), Some(lon)));
    // Comment? ou supprim? : embedding_client, AddEmbeddingPineconeRequest, et les appels associ?s
    /*
    let embedding_client = EmbeddingClient::new("", "");
    if let Some(obj) = data_obj.as_object() {
        for (champ, valeur) in obj {
            let value_str = valeur.to_string();
            let _ = embedding_client.add_embedding_pinecone(&AddEmbeddingPineconeRequest {
                value: value_str,
                type_donnee: "texte".to_string(),
                service_id,
                gps_lat,
                gps_lon,
            }).await;
        }
    }
    */
    Ok(serde_json::json!({
        "message": "? Service r?activ?",
        "service_id": updated.id,
        "next_auto_deactivate": updated.auto_deactivate_at,
    }))
}
