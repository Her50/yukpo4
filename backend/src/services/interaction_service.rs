// Service métier pour la gestion des interactions (messages, audio, appels, avis, notes)
// ✅ 2026-03-16: Migré de MongoDB vers PostgreSQL (table history_events)

use crate::services::mongo_history_service::MongoHistoryService;
use chrono::Utc;
use serde_json::json;
use serde_json::Value;
use sqlx::Row;
use std::sync::Arc;

pub async fn save_interaction(
    mongo_history: Arc<MongoHistoryService>,
    user_id: i32,
    service_id: i32,
    interaction_type: &str,
    content: Option<&str>,
) -> Result<Value, String> {
    let metadata = None;
    mongo_history
        .log_user_interaction(
            user_id,
            Some(service_id),
            interaction_type,
            content.unwrap_or(""),
            metadata,
        )
        .await
        .map_err(|e| format!("Erreur insertion: {e}"))?;
    Ok(json!({
        "user_id": user_id,
        "service_id": service_id,
        "interaction_type": interaction_type,
        "content": content,
        "created_at": Utc::now(),
    }))
}

pub async fn get_interactions(
    mongo_history: Arc<MongoHistoryService>,
    service_id: i32,
    user_id: Option<i32>,
    limit: Option<i64>,
) -> Result<Vec<Value>, String> {
    let pool = mongo_history.pg_pool();
    let effective_limit = limit.unwrap_or(100);

    let rows = if let Some(uid) = user_id {
        sqlx::query(
            "SELECT event_type, user_id, service_id, interaction_id, timestamp, data, metadata
             FROM history_events
             WHERE event_type = 'UserAction' AND service_id = $1 AND user_id = $2
             ORDER BY timestamp DESC
             LIMIT $3",
        )
        .bind(service_id)
        .bind(uid)
        .bind(effective_limit)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query(
            "SELECT event_type, user_id, service_id, interaction_id, timestamp, data, metadata
             FROM history_events
             WHERE event_type = 'UserAction' AND service_id = $1
             ORDER BY timestamp DESC
             LIMIT $2",
        )
        .bind(service_id)
        .bind(effective_limit)
        .fetch_all(pool)
        .await
    }
    .map_err(|e| format!("Erreur SQL: {e}"))?;

    let results: Vec<Value> = rows
        .iter()
        .map(|row| {
            json!({
                "event_type": row.get::<String, _>("event_type"),
                "user_id": row.get::<Option<i32>, _>("user_id"),
                "service_id": row.get::<Option<i32>, _>("service_id"),
                "interaction_id": row.get::<Option<String>, _>("interaction_id"),
                "timestamp": row.get::<chrono::DateTime<Utc>, _>("timestamp").to_rfc3339(),
                "data": row.get::<Value, _>("data"),
                "metadata": row.get::<Option<Value>, _>("metadata"),
            })
        })
        .collect();

    Ok(results)
}

pub async fn save_review(
    mongo_history: Arc<MongoHistoryService>,
    user_id: i32,
    service_id: i32,
    rating: i32,
    comment: Option<&str>,
    mentions: Option<&[i32]>,
) -> Result<Value, String> {
    let data = json!({
        "rating": rating,
        "comment": comment,
        "mentions": mentions.unwrap_or(&[]),
    });
    let metadata = None;
    mongo_history
        .log_user_interaction(
            user_id,
            Some(service_id),
            "review",
            &data.to_string(),
            metadata,
        )
        .await
        .map_err(|e| format!("Erreur insertion: {e}"))?;
    Ok(json!({
        "user_id": user_id,
        "service_id": service_id,
        "rating": rating,
        "comment": comment,
        "mentions": mentions.unwrap_or(&[]),
        "created_at": Utc::now(),
    }))
}

pub async fn get_reviews(
    mongo_history: Arc<MongoHistoryService>,
    service_id: i32,
    limit: Option<i64>,
) -> Result<Vec<Value>, String> {
    let pool = mongo_history.pg_pool();
    let effective_limit = limit.unwrap_or(20);

    let rows = sqlx::query(
        "SELECT user_id, timestamp, data
         FROM history_events
         WHERE event_type = 'UserAction' AND service_id = $1 AND data->>'interaction_type' = 'review'
         ORDER BY timestamp DESC
         LIMIT $2",
    )
    .bind(service_id)
    .bind(effective_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Erreur SQL: {e}"))?;

    let results: Vec<Value> = rows
        .iter()
        .map(|row| {
            let data: Value = row.get("data");
            json!({
                "user_id": row.get::<Option<i32>, _>("user_id"),
                "timestamp": row.get::<chrono::DateTime<Utc>, _>("timestamp").to_rfc3339(),
                "data": data,
            })
        })
        .collect();

    Ok(results)
}

/// ✅ 2026-03-16: Récupère les statistiques d'un service via agrégation SQL (ex-MongoDB)
pub async fn get_service_stats_optimized(
    mongo_history: Arc<MongoHistoryService>,
    service_id: i32,
) -> Result<Value, String> {
    let pool = mongo_history.pg_pool();

    // Compter les interactions par type en une seule requête SQL
    let rows = sqlx::query(
        "SELECT data->>'interaction_type' as interaction_type, COUNT(*) as count
         FROM history_events
         WHERE event_type = 'UserAction' AND service_id = $1
         GROUP BY data->>'interaction_type'",
    )
    .bind(service_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Erreur agrégation stats: {e}"))?;

    let mut views = 0i32;
    let mut contacts = 0i32;
    let mut messages = 0i32;
    let mut shares = 0i32;
    let mut likes = 0i32;

    for row in &rows {
        let interaction_type: Option<String> = row.get("interaction_type");
        let count: i64 = row.get("count");
        match interaction_type.as_deref() {
            Some("view") => views = count as i32,
            Some("contact") => contacts = count as i32,
            Some("message") => messages = count as i32,
            Some("share") => shares = count as i32,
            Some("like") => likes = count as i32,
            _ => {}
        }
    }

    // Calculer la note moyenne des avis
    let review_row = sqlx::query(
        "SELECT COUNT(*) as total_reviews, AVG((data->>'rating')::float) as average_rating
         FROM history_events
         WHERE event_type = 'UserAction' AND service_id = $1 AND data->>'interaction_type' = 'review'",
    )
    .bind(service_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Erreur agrégation reviews: {e}"))?;

    let total_reviews: i64 = review_row.get("total_reviews");
    let average_rating: Option<f64> = review_row.get("average_rating");

    Ok(json!({
        "views": views,
        "contacts": contacts,
        "messages": messages,
        "shares": shares,
        "likes": likes,
        "average_rating": average_rating.unwrap_or(0.0),
        "total_ratings": total_reviews
    }))
}

/// ✅ 2026-03-16: Récupère les avis pour plusieurs services en batch via SQL
pub async fn get_services_reviews_batch(
    mongo_history: Arc<MongoHistoryService>,
    service_ids: Vec<i32>,
    limit_per_service: Option<i64>,
) -> Result<serde_json::Value, String> {
    let pool = mongo_history.pg_pool();
    let effective_limit = limit_per_service.unwrap_or(20);

    // Utiliser une window function pour limiter par service
    let rows = sqlx::query(
        "SELECT service_id, user_id, timestamp, data
         FROM (
             SELECT service_id, user_id, timestamp, data,
                    ROW_NUMBER() OVER (PARTITION BY service_id ORDER BY timestamp DESC) as rn
             FROM history_events
             WHERE event_type = 'UserAction'
               AND service_id = ANY($1)
               AND data->>'interaction_type' = 'review'
         ) sub
         WHERE rn <= $2
         ORDER BY service_id, timestamp DESC",
    )
    .bind(&service_ids)
    .bind(effective_limit)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Erreur SQL batch reviews: {e}"))?;

    let mut results_map = serde_json::Map::new();

    for row in &rows {
        let service_id: i32 = row.get("service_id");
        let review = json!({
            "user_id": row.get::<Option<i32>, _>("user_id"),
            "timestamp": row.get::<chrono::DateTime<Utc>, _>("timestamp").to_rfc3339(),
            "rating": row.get::<Value, _>("data").get("rating"),
            "comment": row.get::<Value, _>("data").get("comment"),
            "mentions": row.get::<Value, _>("data").get("mentions"),
        });

        results_map
            .entry(service_id.to_string())
            .or_insert_with(|| serde_json::Value::Array(vec![]))
            .as_array_mut()
            .unwrap()
            .push(review);
    }

    // S'assurer que tous les service_ids ont une entrée (même vide)
    for service_id in &service_ids {
        if !results_map.contains_key(&service_id.to_string()) {
            results_map.insert(service_id.to_string(), serde_json::Value::Array(vec![]));
        }
    }

    Ok(serde_json::Value::Object(results_map))
}

/// ✅ 2026-03-16: Récupère les statistiques pour plusieurs services en batch via SQL
pub async fn get_services_stats_batch(
    mongo_history: Arc<MongoHistoryService>,
    service_ids: Vec<i32>,
) -> Result<serde_json::Value, String> {
    let pool = mongo_history.pg_pool();

    // Compter les interactions par type et par service en une seule requête
    let rows = sqlx::query(
        "SELECT service_id, data->>'interaction_type' as interaction_type, COUNT(*) as count
         FROM history_events
         WHERE event_type = 'UserAction' AND service_id = ANY($1)
         GROUP BY service_id, data->>'interaction_type'",
    )
    .bind(&service_ids)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Erreur SQL batch stats: {e}"))?;

    let mut results_map = serde_json::Map::new();

    for row in &rows {
        let service_id: i32 = row.get("service_id");
        let interaction_type: Option<String> = row.get("interaction_type");
        let count: i64 = row.get("count");

        let entry = results_map.entry(service_id.to_string()).or_insert_with(|| {
            json!({
                "views": 0, "contacts": 0, "messages": 0,
                "shares": 0, "likes": 0,
                "average_rating": 0.0, "total_ratings": 0
            })
        });

        if let Some(obj) = entry.as_object_mut() {
            match interaction_type.as_deref() {
                Some("view") => {
                    obj.insert("views".to_string(), json!(count));
                }
                Some("contact") => {
                    obj.insert("contacts".to_string(), json!(count));
                }
                Some("message") => {
                    obj.insert("messages".to_string(), json!(count));
                }
                Some("share") => {
                    obj.insert("shares".to_string(), json!(count));
                }
                Some("like") => {
                    obj.insert("likes".to_string(), json!(count));
                }
                _ => {}
            }
        }
    }

    // Calculer les notes moyennes pour tous les services en une requête
    let review_rows = sqlx::query(
        "SELECT service_id, COUNT(*) as total_reviews, AVG((data->>'rating')::float) as average_rating
         FROM history_events
         WHERE event_type = 'UserAction' AND service_id = ANY($1) AND data->>'interaction_type' = 'review'
         GROUP BY service_id",
    )
    .bind(&service_ids)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Erreur SQL batch reviews stats: {e}"))?;

    for row in &review_rows {
        let service_id: i32 = row.get("service_id");
        let total_reviews: i64 = row.get("total_reviews");
        let average_rating: Option<f64> = row.get("average_rating");

        if let Some(stats_obj) = results_map.get_mut(&service_id.to_string()) {
            if let Some(stats_map) = stats_obj.as_object_mut() {
                stats_map.insert(
                    "average_rating".to_string(),
                    json!(average_rating.unwrap_or(0.0)),
                );
                stats_map.insert("total_ratings".to_string(), json!(total_reviews));
            }
        }
    }

    // S'assurer que tous les service_ids ont une entrée
    for service_id in &service_ids {
        if !results_map.contains_key(&service_id.to_string()) {
            results_map.insert(
                service_id.to_string(),
                json!({
                    "views": 0, "contacts": 0, "messages": 0,
                    "shares": 0, "likes": 0,
                    "average_rating": 0.0, "total_ratings": 0
                }),
            );
        }
    }

    Ok(serde_json::Value::Object(results_map))
}
