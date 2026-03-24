// Endpoint pour vérifier et nettoyer les speed_bump
use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

use crate::state::AppState;

pub async fn check_speed_bumps(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match sqlx::query(
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
        "#,
    )
    .fetch_all(&state.pg)
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
                        "id": row.try_get::<i64, _>("id").ok(),
                        "checkpoint_type": row.try_get::<String, _>("checkpoint_type").ok(),
                        "latitude": row.try_get::<f64, _>("latitude").ok(),
                        "longitude": row.try_get::<f64, _>("longitude").ok(),
                        "description": row.try_get::<Option<String>, _>("description").ok().flatten(),
                        "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok(),
                        "expires_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("expires_at").ok().flatten()
                    })
                }).collect::<Vec<_>>(),
                "note": "Les speed_bump sont filtrées dans l'interface mobile mais conservées pour l'alerte sonore"
            });

            Ok(Json(response))
        }
        Err(e) => {
            eprintln!("Erreur lors de la vérification des speed_bump: {}", e);
            let _error_response = json!({
                "success": false,
                "error": "Erreur lors de la vérification des speed_bump"
            });
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn delete_speed_bumps(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match sqlx::query("DELETE FROM navigation_checkpoints WHERE checkpoint_type = 'speed_bump'")
        .execute(&state.pg)
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
            let _error_response = json!({
                "success": false,
                "error": "Erreur lors de la suppression des speed_bump"
            });
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
