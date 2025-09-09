
use crate::services::mongo_history_service::MongoHistoryService;
use serde_json::Value;
use std::sync::Arc;
use mongodb::bson::doc;
use futures::TryStreamExt;

/// Historise une interaction IA (requ?te utilisateur, intention, r?ponse IA)
pub async fn sauvegarder_ia_interaction(
    mongo_history: Arc<MongoHistoryService>,
    user_id: Option<i32>,
    intention: Option<&str>,
    user_input: &Value,
    ia_response: &Value,
) -> Result<(), String> {
    let interaction_id = format!("ia_{}_{}", 
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
            }))
        )
        .await
        .map_err(|e| format!("Erreur sauvegarde interaction IA: {}", e))
}

/// R?cup?re l'historique des interactions IA d'un utilisateur
pub async fn get_ia_interaction_history(
    mongo_history: Arc<MongoHistoryService>,
    user_id: i32,
    limit: Option<i64>,
) -> Result<Vec<Value>, String> {
    let events = mongo_history
        .get_ia_interaction_history(user_id, limit)
        .await
        .map_err(|e| format!("Erreur r?cup?ration historique IA: {}", e))?;

    let history: Vec<Value> = events
        .into_iter()
        .map(|event| {
            serde_json::json!({
                "interaction_id": event.interaction_id,
                "user_id": event.user_id,
                "timestamp": chrono::DateTime::<chrono::Utc>::from(event.timestamp.to_system_time()),
                "intention": event.data.get("intention").and_then(|v| v.as_str()),
                "user_input": event.data.get("user_input_raw"),
                "ia_response": event.data.get("ia_response_raw"),
                "model_used": event.data.get("model_used").and_then(|v| v.as_str()),
            })
        })
        .collect();

    Ok(history)
}

/// R?cup?re les statistiques des interactions IA
pub async fn get_ia_interaction_stats(
    mongo_history: Arc<MongoHistoryService>,
    user_id: Option<i32>,
    days: Option<i64>,
) -> Result<Value, String> {
    let collection = mongo_history.get_collection("history").await;
    
    let mut pipeline = vec![
        doc! { "$match": { "event_type": "IAInteraction" } },
        doc! {
            "$group": {
                "_id": null,
                "total_interactions": { "$sum": 1 },
                "unique_users": { "$addToSet": "$user_id" },
                "avg_response_time": { "$avg": "$data.response_time" },
                "intentions": { "$addToSet": "$data.intention" }
            }
        }
    ];

    if let Some(uid) = user_id {
        pipeline[0] = doc! { 
            "$match": { 
                "event_type": "IAInteraction",
                "user_id": uid
            } 
        };
    }

    if let Some(days) = days {
        let cutoff_date = mongodb::bson::DateTime::from_system_time(
            std::time::SystemTime::now() - std::time::Duration::from_secs((days * 24 * 60 * 60) as u64)
        );
        let match_stage = pipeline[0].clone();
        pipeline[0] = doc! {
            "$match": {
                "$and": [
                    match_stage,
                    { "timestamp": { "$gte": cutoff_date } }
                ]
            }
        };
    }

    let mut cursor = collection
        .aggregate(pipeline, None)
        .await
        .map_err(|e| format!("Erreur agr?gation stats IA: {}", e))?;

    let mut stats = serde_json::Map::new();
    if let Some(doc) = cursor.try_next().await
        .map_err(|e| format!("Erreur it?ration stats IA: {}", e))? {
        if let Ok(bson) = mongodb::bson::to_bson(&doc) {
            if let Ok(json) = serde_json::to_value(bson) {
                stats = json.as_object().unwrap().clone();
            }
        }
    }

    Ok(serde_json::Value::Object(stats))
}
