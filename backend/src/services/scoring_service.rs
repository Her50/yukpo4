// Service m?tier pour le scoring intelligent des services
// Utilise MongoDB pour l'historisation et le calcul des scores

use crate::services::mongo_history_service::MongoHistoryService;
use serde_json::{Value, json};
use std::sync::Arc;
use chrono::Utc;
use futures::TryStreamExt;

/// Structure pour les scores de service (en m?moire)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ServiceScore {
    pub service_id: i32,
    pub score: f64,
    pub last_computed_at: chrono::DateTime<Utc>,
}

/// Calcule le score d'un service en fonction des avis et interactions MongoDB
pub async fn compute_score(
    mongo_history: Arc<MongoHistoryService>,
    service_id: i32,
) -> Result<ServiceScore, String> {
    let collection = mongo_history.get_collection("history").await;
    
    // Calculer la moyenne des notes depuis MongoDB
    let pipeline = vec![
        mongodb::bson::doc! {
            "$match": {
                "event_type": "UserAction",
                "service_id": service_id,
                "data.interaction_type": "review"
            }
        },
        mongodb::bson::doc! {
            "$group": {
                "_id": null,
                "avg_rating": { "$avg": "$data.rating" },
                "total_reviews": { "$sum": 1 }
            }
        }
    ];

    let mut cursor = collection
        .aggregate(pipeline, None)
        .await
        .map_err(|e| format!("Erreur agr?gation MongoDB: {}", e))?;

    let mut avg_rating = 0.0;
    let mut total_reviews = 0;

    if let Some(doc) = cursor.try_next().await
        .map_err(|e| format!("Erreur it?ration MongoDB: {}", e))? {
        if let Ok(bson) = mongodb::bson::to_bson(&doc) {
            if let Ok(json) = serde_json::to_value(bson) {
                avg_rating = json.get("avg_rating").and_then(|v| v.as_f64()).unwrap_or(0.0);
                total_reviews = json.get("total_reviews").and_then(|v| v.as_u64()).unwrap_or(0) as i32;
            }
        }
    }

    // Calculer la promptitude (d?lai moyen de r?ponse)
    let promptitude_pipeline = vec![
        mongodb::bson::doc! {
            "$match": {
                "event_type": "UserAction",
                "service_id": service_id,
                "data.interaction_type": { "$in": ["message", "audio", "call"] }
            }
        },
        mongodb::bson::doc! {
            "$sort": { "timestamp": 1 }
        },
        mongodb::bson::doc! {
            "$group": {
                "_id": "$user_id",
                "first_interaction": { "$first": "$timestamp" },
                "last_interaction": { "$last": "$timestamp" }
            }
        },
        mongodb::bson::doc! {
            "$group": {
                "_id": null,
                "avg_response_time": {
                    "$avg": {
                        "$subtract": ["$last_interaction", "$first_interaction"]
                    }
                }
            }
        }
    ];

    let mut cursor = collection
        .aggregate(promptitude_pipeline, None)
        .await
        .map_err(|e| format!("Erreur agr?gation promptitude: {}", e))?;

    let mut promptitude_score = 0.0;
    if let Some(doc) = cursor.try_next().await
        .map_err(|e| format!("Erreur it?ration promptitude: {}", e))? {
        if let Ok(bson) = mongodb::bson::to_bson(&doc) {
            if let Ok(json) = serde_json::to_value(bson) {
                if let Some(avg_time) = json.get("avg_response_time").and_then(|v| v.as_f64()) {
                    // Convertir en score (plus le temps est court, meilleur c'est)
                    promptitude_score = if avg_time > 0.0 { 1.0 / avg_time } else { 0.0 };
                }
            }
        }
    }

    // Calcul du score final avec pond?ration
    let score = (avg_rating * 0.7) + (promptitude_score * 0.3);
    let score_final = score.max(0.0).min(5.0); // Limiter entre 0 et 5

    let service_score = ServiceScore {
        service_id,
        score: score_final,
        last_computed_at: Utc::now(),
    };

    // Stocker le score calcul? dans MongoDB pour cache
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

/// R?cup?re le score d'un service depuis MongoDB
pub async fn get_score(
    mongo_history: Arc<MongoHistoryService>,
    service_id: i32,
) -> Result<ServiceScore, String> {
    let collection = mongo_history.get_collection("history").await;
    
    let filter = mongodb::bson::doc! {
        "event_type": "UserAction",
        "service_id": service_id,
        "data.interaction_type": "score_computation"
    };

    let mut cursor = collection
        .find(filter, None)
        .await
        .map_err(|e| format!("Erreur r?cup?ration score: {}", e))?;

    // Prendre le score le plus r?cent
    let mut latest_score: Option<ServiceScore> = None;
    let mut latest_timestamp = chrono::DateTime::<Utc>::MIN_UTC;

    while let Some(doc) = cursor.try_next().await
        .map_err(|e| format!("Erreur it?ration score: {}", e))? {
        if let Ok(bson) = mongodb::bson::to_bson(&doc) {
            if let Ok(json) = serde_json::to_value(bson) {
                if let Some(timestamp) = json.get("timestamp").and_then(|v| v.as_str()) {
                    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(timestamp) {
                        if dt > latest_timestamp {
                            latest_timestamp = dt.with_timezone(&Utc);
                            if let Some(score_data) = json.get("data") {
                                if let Ok(score) = serde_json::from_value::<ServiceScore>(score_data.clone()) {
                                    latest_score = Some(score);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    latest_score.ok_or_else(|| "Aucun score trouv? pour ce service".to_string())
}

/// R?cup?re les statistiques de scoring globales
pub async fn get_scoring_stats(
    mongo_history: Arc<MongoHistoryService>,
) -> Result<Value, String> {
    let collection = mongo_history.get_collection("history").await;
    
    let pipeline = vec![
        mongodb::bson::doc! {
            "$match": {
                "event_type": "UserAction",
                "data.interaction_type": "score_computation"
            }
        },
        mongodb::bson::doc! {
            "$group": {
                "_id": null,
                "total_services_scored": { "$sum": 1 },
                "avg_score": { "$avg": "$data.score" },
                "min_score": { "$min": "$data.score" },
                "max_score": { "$max": "$data.score" }
            }
        }
    ];

    let mut cursor = collection
        .aggregate(pipeline, None)
        .await
        .map_err(|e| format!("Erreur agr?gation stats: {}", e))?;

    let mut stats = serde_json::Map::new();
    if let Some(doc) = cursor.try_next().await
        .map_err(|e| format!("Erreur it?ration stats: {}", e))? {
        if let Ok(bson) = mongodb::bson::to_bson(&doc) {
            if let Ok(json) = serde_json::to_value(bson) {
                stats = json.as_object().unwrap().clone();
            }
        }
    }

    Ok(serde_json::Value::Object(stats))
}
