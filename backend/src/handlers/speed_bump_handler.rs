// Endpoint pour vérifier et nettoyer les speed_bump
use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::json;
use sqlx::PgPool;

pub async fn check_speed_bumps(
    State(pool): State<PgPool>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match sqlx::query!(
        r#"
        SELECT 
            id, 
            checkpoint_type, 
            latitude, 
            longitude, 
            description, 
            created_at, 
            expires_at 
        FROM navigation_checkpoints 
        WHERE checkpoint_type = 'speed_bump' 
        ORDER BY created_at DESC 
        LIMIT 10
        "#
    )
    .fetch_all(&pool)
    .await
    {
        Ok(speed_bumps) => {
            let count = speed_bumps.len();
            let response = json!({
                "success": true,
                "count": count,
                "message": format!("{} speed_bump(s) trouvées", count),
                "speed_bumps": speed_bumps.iter().map(|row| {
                    json!({
                        "id": row.id,
                        "checkpoint_type": row.checkpoint_type,
                        "latitude": row.latitude,
                        "longitude": row.longitude,
                        "description": row.description,
                        "created_at": row.created_at,
                        "expires_at": row.expires_at
                    })
                }).collect::<Vec<_>>(),
                "note": "Les speed_bump sont filtrées dans l'interface mobile mais conservées pour l'alerte sonore"
            });

            Ok(Json(response))
        }
        Err(e) => {
            eprintln!("Erreur lors de la vérification des speed_bump: {}", e);
            let error_response = json!({
                "success": false,
                "error": "Erreur lors de la vérification des speed_bump"
            });
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn delete_speed_bumps(
    State(pool): State<PgPool>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match sqlx::query!("DELETE FROM navigation_checkpoints WHERE checkpoint_type = 'speed_bump'")
        .execute(&pool)
        .await
    {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            let response = json!({
                "success": true,
                "deleted_count": deleted_count,
                "message": format!("{} speed_bump(s) supprimées", deleted_count)
            });

            Ok(Json(response))
        }
        Err(e) => {
            eprintln!("Erreur lors de la suppression des speed_bump: {}", e);
            let error_response = json!({
                "success": false,
                "error": "Erreur lors de la suppression des speed_bump"
            });
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
