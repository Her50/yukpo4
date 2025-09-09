use mongodb::{Client as MongoClient, bson::{doc, DateTime}, Collection};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::sync::Arc;
use chrono::Utc;
use crate::core::types::AppResult;
use futures::TryStreamExt;

/// ??? Types d'?v?nements historis?s
#[derive(Debug, Serialize, Deserialize)]
pub enum HistoryEventType {
    IAInteraction,
    UserAction,
    Feedback,
    ServiceCreation,
    ServiceUpdate,
    Error,
    SecurityEvent,
}

/// ?? Structure pour un ?v?nement d'historisation
#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryEvent {
    pub event_type: HistoryEventType,
    pub user_id: Option<i32>,
    pub service_id: Option<i32>,
    pub interaction_id: Option<String>,
    pub timestamp: DateTime,
    pub data: Value,
    pub metadata: Option<Value>,
}

/// ??? Service d'historisation MongoDB
pub struct MongoHistoryService {
    client: Arc<MongoClient>,
    database_name: String,
}

impl MongoHistoryService {
    pub fn new(client: Arc<MongoClient>, database_name: String) -> Self {
        Self {
            client,
            database_name,
        }
    }

    /// ?? Enregistrer un ?v?nement d'interaction IA
    pub async fn log_ia_interaction(
        &self,
        user_id: Option<i32>,
        interaction_id: &str,
        prompt: &str,
        response: &str,
        model_used: &str,
        context: Option<Value>,
    ) -> AppResult<()> {
        let event = HistoryEvent {
            event_type: HistoryEventType::IAInteraction,
            user_id,
            service_id: None,
            interaction_id: Some(interaction_id.to_string()),
            timestamp: DateTime::now(),
            data: serde_json::json!({
                "prompt": prompt,
                "response": response,
                "model_used": model_used,
                "context": context,
            }),
            metadata: None,
        };

        self.insert_event(event).await
    }

    /// ? Enregistrer un feedback utilisateur
    pub async fn log_feedback(
        &self,
        user_id: i32,
        interaction_id: &str,
        prompt: &str,
        response: &str,
        model_used: &str,
        rating: u8,
        feedback_text: Option<&str>,
        context: Option<Value>,
    ) -> AppResult<()> {
        let event = HistoryEvent {
            event_type: HistoryEventType::Feedback,
            user_id: Some(user_id),
            service_id: None,
            interaction_id: Some(interaction_id.to_string()),
            timestamp: DateTime::now(),
            data: serde_json::json!({
                "prompt": prompt,
                "response": response,
                "model_used": model_used,
                "rating": rating,
                "feedback_text": feedback_text,
                "context": context,
            }),
            metadata: None,
        };

        self.insert_event(event).await
    }

    /// ?? Enregistrer une interaction utilisateur
    pub async fn log_user_interaction(
        &self,
        user_id: i32,
        service_id: Option<i32>,
        interaction_type: &str,
        content: &str,
        metadata: Option<Value>,
    ) -> AppResult<()> {
        let event = HistoryEvent {
            event_type: HistoryEventType::UserAction,
            user_id: Some(user_id),
            service_id,
            interaction_id: None,
            timestamp: DateTime::now(),
            data: serde_json::json!({
                "interaction_type": interaction_type,
                "content": content,
            }),
            metadata,
        };

        self.insert_event(event).await
    }

    /// ??? Enregistrer un ?v?nement de s?curit?
    pub async fn log_security_event(
        &self,
        user_id: Option<i32>,
        event_type: &str,
        details: Value,
        threat_level: &str,
    ) -> AppResult<()> {
        let event = HistoryEvent {
            event_type: HistoryEventType::SecurityEvent,
            user_id,
            service_id: None,
            interaction_id: None,
            timestamp: DateTime::now(),
            data: serde_json::json!({
                "security_event_type": event_type,
                "details": details,
                "threat_level": threat_level,
            }),
            metadata: None,
        };

        self.insert_event(event).await
    }

    /// ?? R?cup?rer l'historique des interactions IA d'un utilisateur
    pub async fn get_ia_interaction_history(
        &self,
        user_id: i32,
        limit: Option<i64>,
    ) -> AppResult<Vec<HistoryEvent>> {
        let collection = self.get_collection("history").await;
        
        let filter = doc! {
            "event_type": "IAInteraction",
            "user_id": user_id,
        };

        let mut cursor = collection
            .find(filter, None)
            .await
            .map_err(|e| format!("Erreur r?cup?ration historique IA: {}", e))?;

        let mut events = Vec::new();
        while let Some(doc) = cursor.try_next().await
            .map_err(|e| format!("Erreur it?ration historique: {}", e))? {
            if let Ok(event) = mongodb::bson::from_document::<HistoryEvent>(doc) {
                events.push(event);
            }
        }

        // Trier par timestamp d?croissant et limiter
        events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        if let Some(limit) = limit {
            events.truncate(limit as usize);
        }

        Ok(events)
    }

    /// ?? R?cup?rer les statistiques de feedback
    pub async fn get_feedback_stats(&self, model_used: Option<&str>) -> AppResult<Value> {
        let collection = self.get_collection("history").await;
        
        let mut pipeline = vec![
            doc! { "$match": { "event_type": "Feedback" } },
            doc! {
                "$group": {
                    "_id": "$data.model_used",
                    "total_feedback": { "$sum": 1 },
                    "avg_rating": { "$avg": "$data.rating" },
                    "positive_feedback": {
                        "$sum": { "$cond": [{ "$gte": ["$data.rating", 4] }, 1, 0] }
                    },
                    "negative_feedback": {
                        "$sum": { "$cond": [{ "$lte": ["$data.rating", 2] }, 1, 0] }
                    }
                }
            }
        ];

        if let Some(model) = model_used {
            pipeline[0] = doc! {
                "$match": {
                    "event_type": "Feedback",
                    "data.model_used": model
                }
            };
        }

        let mut cursor = collection
            .aggregate(pipeline, None)
            .await
            .map_err(|e| format!("Erreur agr?gation feedback: {}", e))?;

        let mut stats = serde_json::Map::new();
        while let Some(doc) = cursor.try_next().await
            .map_err(|e| format!("Erreur it?ration stats: {}", e))? {
            if let Ok(bson) = mongodb::bson::to_bson(&doc) {
                if let Ok(json) = serde_json::to_value(bson) {
                    if let Some(model) = json["_id"].as_str() {
                        stats.insert(model.to_string(), json);
                    }
                }
            }
        }

        Ok(serde_json::Value::Object(stats))
    }

    /// ?? Nettoyer les anciens ?v?nements
    pub async fn cleanup_old_events(&self, days_old: i64) -> AppResult<u64> {
        let collection = self.get_collection("history").await;
        
        let cutoff_date = DateTime::from_system_time(
            std::time::SystemTime::now() - std::time::Duration::from_secs((days_old * 24 * 60 * 60) as u64)
        );
        
        let filter = doc! {
            "timestamp": { "$lt": cutoff_date }
        };

        let result = collection
            .delete_many(filter, None)
            .await
            .map_err(|e| format!("Erreur nettoyage historique: {}", e))?;

        Ok(result.deleted_count)
    }

    /// ?? Ins?rer un ?v?nement dans la collection
    async fn insert_event(&self, event: HistoryEvent) -> AppResult<()> {
        let collection = self.get_collection("history").await;
        
        let doc = mongodb::bson::to_document(&event)
            .map_err(|e| format!("Erreur s?rialisation ?v?nement: {}", e))?;

        collection
            .insert_one(doc, None)
            .await
            .map_err(|e| format!("Erreur insertion historique: {}", e))?;

        Ok(())
    }

    /// ??? Obtenir la collection history
    pub async fn get_collection(&self, collection_name: &str) -> Collection<mongodb::bson::Document> {
        self.client
            .database(&self.database_name)
            .collection::<mongodb::bson::Document>(collection_name)
    }

    /// ?? Enregistrer une consultation de service
    pub async fn log_service_consultation(
        &self,
        user_id: i32,
        service_id: i32,
        consultation_data: Value,
    ) -> AppResult<()> {
        let event = HistoryEvent {
            event_type: HistoryEventType::UserAction,
            user_id: Some(user_id),
            service_id: Some(service_id),
            interaction_id: None,
            timestamp: DateTime::now(),
            data: consultation_data,
            metadata: Some(json!({
                "action_type": "service_consultation",
                "timestamp": Utc::now(),
            })),
        };

        self.insert_event(event).await
    }

    /// ?? R?cup?rer les consultations d'un utilisateur
    pub async fn get_service_consultations(
        &self,
        user_id: i32,
        limit: Option<i64>,
    ) -> AppResult<Vec<HistoryEvent>> {
        let collection = self.get_collection("history").await;
        
        let filter = doc! {
            "event_type": "UserAction",
            "user_id": user_id,
            "metadata.action_type": "service_consultation",
        };

        let mut cursor = collection
            .find(filter, None)
            .await
            .map_err(|e| format!("Erreur r?cup?ration consultations: {}", e))?;

        let mut events = Vec::new();
        while let Some(doc) = cursor.try_next().await
            .map_err(|e| format!("Erreur it?ration consultations: {}", e))? {
            if let Ok(event) = mongodb::bson::from_document::<HistoryEvent>(doc) {
                events.push(event);
            }
        }

        // Trier par timestamp d?croissant et limiter
        events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        if let Some(limit) = limit {
            events.truncate(limit as usize);
        }

        Ok(events)
    }

    /// ?? R?cup?rer les consultations d'un service sp?cifique
    pub async fn get_service_consultations_by_service(
        &self,
        service_id: i32,
        limit: Option<i64>,
    ) -> AppResult<Vec<HistoryEvent>> {
        let collection = self.get_collection("history").await;
        
        let filter = doc! {
            "event_type": "UserAction",
            "service_id": service_id,
            "metadata.action_type": "service_consultation",
        };

        let mut cursor = collection
            .find(filter, None)
            .await
            .map_err(|e| format!("Erreur r?cup?ration consultations service: {}", e))?;

        let mut events = Vec::new();
        while let Some(doc) = cursor.try_next().await
            .map_err(|e| format!("Erreur it?ration consultations service: {}", e))? {
            if let Ok(event) = mongodb::bson::from_document::<HistoryEvent>(doc) {
                events.push(event);
            }
        }

        // Trier par timestamp d?croissant et limiter
        events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        if let Some(limit) = limit {
            events.truncate(limit as usize);
        }

        Ok(events)
    }

    /// ?? R?cup?rer les statistiques globales de consultations
    pub async fn get_global_consultation_stats(&self, days: Option<i64>) -> AppResult<Value> {
        let collection = self.get_collection("history").await;
        
        let mut pipeline = vec![
            doc! { 
                "$match": { 
                    "event_type": "UserAction",
                    "metadata.action_type": "service_consultation"
                } 
            },
            doc! {
                "$group": {
                    "_id": null,
                    "total_consultations": { "$sum": 1 },
                    "unique_users": { "$addToSet": "$user_id" },
                    "unique_services": { "$addToSet": "$service_id" },
                    "total_debits": {
                        "$sum": {
                            "$cond": [
                                { "$eq": ["$data.debit_applied", true] },
                                "$data.token_cost",
                                0
                            ]
                        }
                    }
                }
            },
            doc! {
                "$project": {
                    "_id": 0,
                    "total_consultations": 1,
                    "unique_users": { "$size": "$unique_users" },
                    "unique_services": { "$size": "$unique_services" },
                    "total_debits": 1
                }
            }
        ];

        if let Some(days) = days {
            let cutoff_date = DateTime::from_system_time(
                std::time::SystemTime::now() - std::time::Duration::from_secs((days * 24 * 60 * 60) as u64)
            );
            pipeline[0] = doc! {
                "$match": {
                    "event_type": "UserAction",
                    "metadata.action_type": "service_consultation",
                    "timestamp": { "$gte": cutoff_date }
                }
            };
        }

        let mut cursor = collection
            .aggregate(pipeline, None)
            .await
            .map_err(|e| format!("Erreur agr?gation stats globales: {}", e))?;

        let mut stats = serde_json::Map::new();
        if let Some(doc) = cursor.try_next().await
            .map_err(|e| format!("Erreur it?ration stats globales: {}", e))? {
            if let Ok(bson) = mongodb::bson::to_bson(&doc) {
                if let Ok(json) = serde_json::to_value(bson) {
                    stats = json.as_object().unwrap().clone();
                }
            }
        }

        Ok(serde_json::Value::Object(stats))
    }
} 
