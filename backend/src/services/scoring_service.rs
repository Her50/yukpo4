// Service métier pour le scoring intelligent des services
// ✅ 2026-03-16: Migré de MongoDB vers PostgreSQL (table history_events)

use crate::services::mongo_history_service::MongoHistoryService;
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

/// Structure pour les scores de service (en mémoire)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ServiceScore {
    pub service_id: i32,
    pub score: f64,
    pub last_computed_at: chrono::DateTime<Utc>,
}

/// Calcule le score d'un service en fonction des avis et interactions (PostgreSQL)
pub async fn compute_score(
    mongo_history: Arc<MongoHistoryService>,
    service_id: i32,
) -> Result<ServiceScore, String> {
    let pool = mongo_history.pg_pool();

    // Calculer la moyenne des notes depuis PostgreSQL
    let review_row = sqlx::query(
        "SELECT AVG((data->>'rating')::float) as avg_rating, COUNT(*) as total_reviews
         FROM history_events
         WHERE event_type = 'UserAction' AND service_id = $1 AND data->>'interaction_type' = 'review'",
    )
    .bind(service_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Erreur agrégation reviews: {}", e))?;

    let avg_rating: f64 = review_row.get::<Option<f64>, _>("avg_rating").unwrap_or(0.0);
    let total_reviews: i64 = review_row.get("total_reviews");

    // Calculer la promptitude (délai moyen de réponse)
    let promptitude_row = sqlx::query(
        "SELECT AVG(response_time) as avg_response_time FROM (
             SELECT user_id,
                    EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) as response_time
             FROM history_events
             WHERE event_type = 'UserAction' AND service_id = $1
               AND data->>'interaction_type' IN ('message', 'audio', 'call')
             GROUP BY user_id
             HAVING COUNT(*) > 1
         ) sub",
    )
    .bind(service_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Erreur agrégation promptitude: {}", e))?;

    let avg_response_time: f64 =
        promptitude_row.get::<Option<f64>, _>("avg_response_time").unwrap_or(0.0);
    let promptitude_score = if avg_response_time > 0.0 {
        1.0 / avg_response_time
    } else {
        0.0
    };

    // Calcul du score final avec pondération
    let score = (avg_rating * 0.7) + (promptitude_score * 0.3);
    let score_final = score.clamp(0.0, 5.0);

    let service_score = ServiceScore {
        service_id,
        score: score_final,
        last_computed_at: Utc::now(),
    };

    // Stocker le score calculé pour cache
    let score_data = json!({
        "service_id": service_id,
        "score": score_final,
        "last_computed_at": service_score.last_computed_at,
        "total_reviews": total_reviews,
        "avg_rating": avg_rating,
        "promptitude_score": promptitude_score
    });

    let _ = mongo_history
        .log_user_interaction(
            0, // System user
            Some(service_id),
            "score_computation",
            &score_data.to_string(),
            None,
        )
        .await;

    Ok(service_score)
}

/// Récupère le score d'un service depuis PostgreSQL
pub async fn get_score(
    mongo_history: Arc<MongoHistoryService>,
    service_id: i32,
) -> Result<ServiceScore, String> {
    let pool = mongo_history.pg_pool();

    let row = sqlx::query(
        "SELECT data, timestamp
         FROM history_events
         WHERE event_type = 'UserAction' AND service_id = $1 AND data->>'interaction_type' = 'score_computation'
         ORDER BY timestamp DESC
         LIMIT 1",
    )
    .bind(service_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Erreur récupération score: {}", e))?;

    match row {
        Some(row) => {
            let data: Value = row.get("data");
            let score = data.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let timestamp: chrono::DateTime<Utc> = row.get("timestamp");

            Ok(ServiceScore {
                service_id,
                score,
                last_computed_at: timestamp,
            })
        }
        None => Err("Aucun score trouvé pour ce service".to_string()),
    }
}

/// Récupère les statistiques de scoring globales
pub async fn get_scoring_stats(mongo_history: Arc<MongoHistoryService>) -> Result<Value, String> {
    let pool = mongo_history.pg_pool();

    let row = sqlx::query(
        "SELECT COUNT(*) as total_services_scored,
                AVG((data->>'score')::float) as avg_score,
                MIN((data->>'score')::float) as min_score,
                MAX((data->>'score')::float) as max_score
         FROM history_events
         WHERE event_type = 'UserAction' AND data->>'interaction_type' = 'score_computation'",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Erreur agrégation stats: {}", e))?;

    Ok(json!({
        "total_services_scored": row.get::<i64, _>("total_services_scored"),
        "avg_score": row.get::<Option<f64>, _>("avg_score").unwrap_or(0.0),
        "min_score": row.get::<Option<f64>, _>("min_score").unwrap_or(0.0),
        "max_score": row.get::<Option<f64>, _>("max_score").unwrap_or(0.0),
    }))
}
