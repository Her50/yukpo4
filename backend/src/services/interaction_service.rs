// Service m?tier pour la gestion des interactions (messages, audio, appels, avis, notes)
// ? compl?ter avec la logique de sauvegarde, r?cup?ration, etc.

use crate::services::mongo_history_service::MongoHistoryService;
use chrono::Utc;
use serde_json::Value;
use std::sync::Arc;
use serde_json::json;
use futures::TryStreamExt;

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
        .map_err(|e| format!("Erreur MongoDB: {e}"))?;
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
    let collection = mongo_history.get_collection("history").await;
    let mut filter = mongodb::bson::doc! {
        "event_type": "UserAction",
        "service_id": service_id,
    };
    if let Some(uid) = user_id {
        filter.insert("user_id", uid);
    }
    let mut cursor = collection
        .find(filter, None)
        .await
        .map_err(|e| format!("Erreur MongoDB: {e}"))?;
    let mut results = Vec::new();
    while let Some(doc) = cursor.try_next().await.map_err(|e| format!("Erreur it?ration: {e}"))? {
        let v: Value = mongodb::bson::from_document(doc).map_err(|e| format!("Erreur conversion: {e}"))?;
        results.push(v);
    }
    if let Some(lim) = limit {
        results.truncate(lim as usize);
    }
    Ok(results)
}

pub async fn save_review(
    mongo_history: Arc<MongoHistoryService>,
    user_id: i32,
    service_id: i32,
    rating: i32,
    comment: Option<&str>,
) -> Result<Value, String> {
    let data = json!({
        "rating": rating,
        "comment": comment,
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
        .map_err(|e| format!("Erreur MongoDB: {e}"))?;
    Ok(json!({
        "user_id": user_id,
        "service_id": service_id,
        "rating": rating,
        "comment": comment,
        "created_at": Utc::now(),
    }))
}

pub async fn get_reviews(
    mongo_history: Arc<MongoHistoryService>,
    service_id: i32,
    limit: Option<i64>,
) -> Result<Vec<Value>, String> {
    let collection = mongo_history.get_collection("history").await;
    let filter = mongodb::bson::doc! {
        "event_type": "UserAction",
        "service_id": service_id,
        "data.interaction_type": "review"
    };
    let mut cursor = collection
        .find(filter, None)
        .await
        .map_err(|e| format!("Erreur MongoDB: {e}"))?;
    let mut results = Vec::new();
    while let Some(doc) = cursor.try_next().await.map_err(|e| format!("Erreur it?ration: {e}"))? {
        let v: Value = mongodb::bson::from_document(doc).map_err(|e| format!("Erreur conversion: {e}"))?;
        results.push(v);
    }
    if let Some(lim) = limit {
        results.truncate(lim as usize);
    }
    Ok(results)
}
