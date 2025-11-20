use crate::core::types::AppError;
use chrono::{DateTime, Duration, Utc};
use serde_json::Value;
use sqlx::{FromRow, PgPool};

pub async fn reactivate_service(
    pool: &PgPool,
    service_id: i32,
    user_id: i32,
    extra_duration: Duration, // e.g. Duration::hours(24)
) -> Result<Value, AppError> {
    #[derive(FromRow)]
    struct ServiceTarissableRow {
        is_tarissable: Option<bool>,
    }

    // Récupérer si le service est tarissable
    let service: ServiceTarissableRow = sqlx::query_as(
        "SELECT is_tarissable FROM services WHERE id = $1 AND user_id = $2"
    )
    .bind(service_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::internal_server_error(e.to_string()))?;

    // Limitation à 30 jours si tarissable
    let mut days = extra_duration.num_days();
    let is_tarissable = service.is_tarissable.unwrap_or(false);
    if is_tarissable && days > 30 {
        days = 30;
    }
    let new_off = Utc::now() + Duration::days(days);

    #[derive(FromRow)]
    struct UpdatedServiceRow {
        id: i32,
        auto_deactivate_at: Option<DateTime<Utc>>,
    }

    let updated: UpdatedServiceRow = sqlx::query_as(
        r#"
        UPDATE services
           SET is_active = TRUE,
               last_reactivated_at = NOW(),
               active_days = $4,
               auto_deactivate_at = $3
         WHERE id = $1
           AND user_id = $2
         RETURNING id, auto_deactivate_at
        "#
    )
    .bind(service_id)
    .bind(user_id)
    .bind(new_off)
    .bind(days as i32)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::internal_server_error(e.to_string()))?;

    #[derive(FromRow)]
    struct ServiceDataRow {
        data: Value,
        gps: Option<String>,
    }

    // Réindexation Pinecone : récupérer les données du service
    let rec: ServiceDataRow = sqlx::query_as(
        "SELECT data, gps FROM services WHERE id = $1"
    )
    .bind(service_id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::internal_server_error(e.to_string()))?;
    let _data_obj: serde_json::Value = serde_json::from_value(rec.data).unwrap_or_default();
    let gps = rec.gps.and_then(|s| {
        let parts: Vec<&str> = s.split(',').collect();
        if parts.len() == 2 {
            Some((
                parts[0].trim().parse().unwrap_or(0.0),
                parts[1].trim().parse().unwrap_or(0.0),
            ))
        } else {
            None
        }
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
        "message": "Service réactivé",
        "service_id": updated.id,
        "next_auto_deactivate": updated.auto_deactivate_at,
    }))
}
