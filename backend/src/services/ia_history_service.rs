use crate::services::mongo_history_service::MongoHistoryService;
use serde_json::Value;
use sqlx::Row;
use std::sync::Arc;

/// Historise une interaction IA (requête utilisateur, intention, réponse IA)
pub async fn sauvegarder_ia_interaction(
    mongo_history: Arc<MongoHistoryService>,
    user_id: Option<i32>,
    intention: Option<&str>,
    user_input: &Value,
    ia_response: &Value,
) -> Result<(), String> {
    let interaction_id = format!(
        "ia_{}_{}",
        user_id.unwrap_or(0),
        chrono::Utc::now().timestamp_millis()
    );

    mongo_history
        .log_ia_interaction(
            user_id,
            &interaction_id,
            &serde_json::to_string(user_input).unwrap_or_default(),
            &serde_json::to_string(ia_response).unwrap_or_default(),
            "yukpo_ai",
            Some(serde_json::json!({
                "intention": intention,
                "user_input_raw": user_input,
                "ia_response_raw": ia_response,
            })),
        )
        .await
        .map_err(|e| format!("Erreur sauvegarde interaction IA: {}", e))
}

/// Récupère l'historique des interactions IA d'un utilisateur
pub async fn get_ia_interaction_history(
    mongo_history: Arc<MongoHistoryService>,
    user_id: i32,
    limit: Option<i64>,
) -> Result<Vec<Value>, String> {
    let events = mongo_history
        .get_ia_interaction_history(user_id, limit)
        .await
        .map_err(|e| format!("Erreur récupération historique IA: {}", e))?;

    let history: Vec<Value> = events
        .into_iter()
        .map(|event| {
            serde_json::json!({
                "interaction_id": event.interaction_id,
                "user_id": event.user_id,
                "timestamp": event.timestamp,
                "intention": event.data.get("intention").and_then(|v| v.as_str()),
                "user_input": event.data.get("user_input_raw"),
                "ia_response": event.data.get("ia_response_raw"),
                "model_used": event.data.get("model_used").and_then(|v| v.as_str()),
            })
        })
        .collect();

    Ok(history)
}

/// Récupère les statistiques des interactions IA (PostgreSQL)
pub async fn get_ia_interaction_stats(
    mongo_history: Arc<MongoHistoryService>,
    user_id: Option<i32>,
    days: Option<i64>,
) -> Result<Value, String> {
    let pool = mongo_history.pg_pool();

    // Build query dynamically based on filters
    let row = match (user_id, days) {
        (Some(uid), Some(d)) => {
            sqlx::query(
                "SELECT COUNT(*) as total_interactions,
                        COUNT(DISTINCT user_id) as unique_users
                 FROM history_events
                 WHERE event_type = 'IAInteraction'
                   AND user_id = $1
                   AND timestamp >= NOW() - ($2 || ' days')::interval",
            )
            .bind(uid)
            .bind(d.to_string())
            .fetch_one(pool)
            .await
        }
        (Some(uid), None) => {
            sqlx::query(
                "SELECT COUNT(*) as total_interactions,
                        COUNT(DISTINCT user_id) as unique_users
                 FROM history_events
                 WHERE event_type = 'IAInteraction' AND user_id = $1",
            )
            .bind(uid)
            .fetch_one(pool)
            .await
        }
        (None, Some(d)) => {
            sqlx::query(
                "SELECT COUNT(*) as total_interactions,
                        COUNT(DISTINCT user_id) as unique_users
                 FROM history_events
                 WHERE event_type = 'IAInteraction'
                   AND timestamp >= NOW() - ($1 || ' days')::interval",
            )
            .bind(d.to_string())
            .fetch_one(pool)
            .await
        }
        (None, None) => {
            sqlx::query(
                "SELECT COUNT(*) as total_interactions,
                        COUNT(DISTINCT user_id) as unique_users
                 FROM history_events
                 WHERE event_type = 'IAInteraction'",
            )
            .fetch_one(pool)
            .await
        }
    }
    .map_err(|e| format!("Erreur agrégation stats IA: {}", e))?;

    Ok(serde_json::json!({
        "total_interactions": row.get::<i64, _>("total_interactions"),
        "unique_users": row.get::<i64, _>("unique_users"),
    }))
}
