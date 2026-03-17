use crate::core::types::{AppError, AppResult};
use chrono::Utc;
use log::error;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;

/// Types d'événements historisés
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HistoryEventType {
    IAInteraction,
    UserAction,
    Feedback,
    ServiceCreation,
    ServiceUpdate,
    Error,
    SecurityEvent,
}

impl HistoryEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            HistoryEventType::IAInteraction => "IAInteraction",
            HistoryEventType::UserAction => "UserAction",
            HistoryEventType::Feedback => "Feedback",
            HistoryEventType::ServiceCreation => "ServiceCreation",
            HistoryEventType::ServiceUpdate => "ServiceUpdate",
            HistoryEventType::Error => "Error",
            HistoryEventType::SecurityEvent => "SecurityEvent",
        }
    }
}

/// Structure pour un événement d'historisation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEvent {
    pub event_type: HistoryEventType,
    pub user_id: Option<i32>,
    pub service_id: Option<i32>,
    pub interaction_id: Option<String>,
    #[serde(with = "chrono::serde::ts_milliseconds_option", default)]
    pub timestamp: Option<chrono::DateTime<Utc>>,
    pub data: Value,
    pub metadata: Option<Value>,
}

/// ✅ 2026-03-16: Service d'historisation PostgreSQL (ex-MongoDB)
/// Toutes les données sont stockées dans la table history_events (PostgreSQL JSONB)
pub struct MongoHistoryService {
    pg: Arc<PgPool>,
}

impl MongoHistoryService {
    pub fn new(pg: Arc<PgPool>) -> Self {
        Self { pg }
    }

    /// Obtenir une référence au pool PostgreSQL (pour les services qui font des requêtes directes)
    pub fn pg_pool(&self) -> &PgPool {
        &self.pg
    }

    /// Enregistrer un événement d'interaction IA
    pub async fn log_ia_interaction(
        &self,
        user_id: Option<i32>,
        interaction_id: &str,
        prompt: &str,
        response: &str,
        model_used: &str,
        context: Option<Value>,
    ) -> AppResult<()> {
        let data = serde_json::json!({
            "prompt": prompt,
            "response": response,
            "model_used": model_used,
            "context": context,
        });

        self.insert_event(
            "IAInteraction",
            user_id,
            None,
            Some(interaction_id),
            &data,
            None,
        )
        .await
    }

    /// Enregistrer un feedback utilisateur
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
        let data = serde_json::json!({
            "prompt": prompt,
            "response": response,
            "model_used": model_used,
            "rating": rating,
            "feedback_text": feedback_text,
            "context": context,
        });

        self.insert_event(
            "Feedback",
            Some(user_id),
            None,
            Some(interaction_id),
            &data,
            None,
        )
        .await
    }

    /// Enregistrer une interaction utilisateur
    pub async fn log_user_interaction(
        &self,
        user_id: i32,
        service_id: Option<i32>,
        interaction_type: &str,
        content: &str,
        metadata: Option<Value>,
    ) -> AppResult<()> {
        let data = serde_json::json!({
            "interaction_type": interaction_type,
            "content": content,
        });

        self.insert_event(
            "UserAction",
            Some(user_id),
            service_id,
            None,
            &data,
            metadata.as_ref(),
        )
        .await
    }

    /// Enregistrer un événement de sécurité
    pub async fn log_security_event(
        &self,
        user_id: Option<i32>,
        event_type: &str,
        details: Value,
        threat_level: &str,
    ) -> AppResult<()> {
        let data = serde_json::json!({
            "security_event_type": event_type,
            "details": details,
            "threat_level": threat_level,
        });

        self.insert_event("SecurityEvent", user_id, None, None, &data, None).await
    }

    /// Récupérer l'historique des interactions IA d'un utilisateur
    pub async fn get_ia_interaction_history(
        &self,
        user_id: i32,
        limit: Option<i64>,
    ) -> AppResult<Vec<HistoryEvent>> {
        let effective_limit = limit.unwrap_or(100);

        let rows = sqlx::query_as::<_, HistoryEventRow>(
            "SELECT event_type, user_id, service_id, interaction_id, timestamp, data, metadata
             FROM history_events
             WHERE event_type = 'IAInteraction' AND user_id = $1
             ORDER BY timestamp DESC
             LIMIT $2",
        )
        .bind(user_id)
        .bind(effective_limit)
        .fetch_all(self.pg.as_ref())
        .await
        .map_err(|e| {
            error!(
                "[HistoryService] Erreur récupération historique IA (user_id={}): {}",
                user_id, e
            );
            format!("Erreur récupération historique IA: {}", e)
        })?;

        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    /// Récupérer les statistiques de feedback
    pub async fn get_feedback_stats(&self, model_used: Option<&str>) -> AppResult<Value> {
        let rows = if let Some(model) = model_used {
            sqlx::query_as::<_, FeedbackStatRow>(
                "SELECT data->>'model_used' as model,
                        COUNT(*) as total_feedback,
                        AVG((data->>'rating')::float) as avg_rating,
                        SUM(CASE WHEN (data->>'rating')::int >= 4 THEN 1 ELSE 0 END) as positive_feedback,
                        SUM(CASE WHEN (data->>'rating')::int <= 2 THEN 1 ELSE 0 END) as negative_feedback
                 FROM history_events
                 WHERE event_type = 'Feedback' AND data->>'model_used' = $1
                 GROUP BY data->>'model_used'",
            )
            .bind(model)
            .fetch_all(self.pg.as_ref())
            .await
        } else {
            sqlx::query_as::<_, FeedbackStatRow>(
                "SELECT data->>'model_used' as model,
                        COUNT(*) as total_feedback,
                        AVG((data->>'rating')::float) as avg_rating,
                        SUM(CASE WHEN (data->>'rating')::int >= 4 THEN 1 ELSE 0 END) as positive_feedback,
                        SUM(CASE WHEN (data->>'rating')::int <= 2 THEN 1 ELSE 0 END) as negative_feedback
                 FROM history_events
                 WHERE event_type = 'Feedback'
                 GROUP BY data->>'model_used'",
            )
            .fetch_all(self.pg.as_ref())
            .await
        }
        .map_err(|e| {
            error!("[HistoryService] Erreur agrégation feedback: {}", e);
            format!("Erreur agrégation feedback: {}", e)
        })?;

        let mut stats = serde_json::Map::new();
        for row in rows {
            if let Some(model) = &row.model {
                stats.insert(
                    model.clone(),
                    serde_json::json!({
                        "_id": model,
                        "total_feedback": row.total_feedback,
                        "avg_rating": row.avg_rating,
                        "positive_feedback": row.positive_feedback,
                        "negative_feedback": row.negative_feedback,
                    }),
                );
            }
        }

        Ok(serde_json::Value::Object(stats))
    }

    /// Nettoyer les anciens événements
    pub async fn cleanup_old_events(&self, days_old: i64) -> AppResult<u64> {
        let result = sqlx::query(
            "DELETE FROM history_events WHERE timestamp < NOW() - ($1 || ' days')::interval",
        )
        .bind(days_old.to_string())
        .execute(self.pg.as_ref())
        .await
        .map_err(|e| {
            error!(
                "[HistoryService] Erreur nettoyage historique (days_old={}): {}",
                days_old, e
            );
            format!("Erreur nettoyage historique: {}", e)
        })?;

        Ok(result.rows_affected())
    }

    /// Les index sont créés par ensure_history_events_table dans auto_migrate.rs
    pub async fn ensure_indexes(&self) -> AppResult<()> {
        Ok(())
    }

    /// Insérer un événement dans la table history_events
    async fn insert_event(
        &self,
        event_type: &str,
        user_id: Option<i32>,
        service_id: Option<i32>,
        interaction_id: Option<&str>,
        data: &Value,
        metadata: Option<&Value>,
    ) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO history_events (event_type, user_id, service_id, interaction_id, timestamp, data, metadata)
             VALUES ($1, $2, $3, $4, NOW(), $5, $6)",
        )
        .bind(event_type)
        .bind(user_id)
        .bind(service_id)
        .bind(interaction_id)
        .bind(data)
        .bind(metadata)
        .execute(self.pg.as_ref())
        .await
        .map_err(|e| {
            error!(
                "[HistoryService] Erreur insertion historique (event_type={}, user_id={:?}, service_id={:?}): {}",
                event_type, user_id, service_id, e
            );
            format!("Erreur insertion historique: {}", e)
        })?;

        Ok(())
    }

    /// Enregistrer une consultation de service
    pub async fn log_service_consultation(
        &self,
        user_id: i32,
        service_id: i32,
        consultation_data: Value,
        metadata: Option<Value>,
    ) -> AppResult<()> {
        let mut metadata_map = serde_json::Map::new();
        metadata_map.insert(
            "action_type".to_string(),
            serde_json::Value::String("service_consultation".to_string()),
        );
        metadata_map.insert(
            "timestamp".to_string(),
            serde_json::Value::String(Utc::now().to_rfc3339()),
        );

        if let Some(Value::Object(extra)) = metadata {
            for (key, value) in extra {
                metadata_map.insert(key, value);
            }
        }

        let mut metadata_value = Value::Object(metadata_map);
        sanitize_metadata_value(&mut metadata_value, 512);

        self.insert_event(
            "UserAction",
            Some(user_id),
            Some(service_id),
            None,
            &consultation_data,
            Some(&metadata_value),
        )
        .await
    }

    pub async fn ping(&self) -> AppResult<()> {
        sqlx::query("SELECT 1").execute(self.pg.as_ref()).await.map_err(|e| {
            error!("[HistoryService] Ping échoué: {}", e);
            AppError::Internal(format!("HistoryService ping failed: {}", e))
        })?;
        Ok(())
    }

    /// Récupérer les consultations d'un utilisateur
    pub async fn get_service_consultations(
        &self,
        user_id: i32,
        limit: Option<i64>,
    ) -> AppResult<Vec<HistoryEvent>> {
        let effective_limit = limit.unwrap_or(5);

        let rows = sqlx::query_as::<_, HistoryEventRow>(
            "SELECT event_type, user_id, service_id, interaction_id, timestamp, data, metadata
             FROM history_events
             WHERE event_type = 'UserAction' AND user_id = $1 AND metadata->>'action_type' = 'service_consultation'
             ORDER BY timestamp DESC
             LIMIT $2",
        )
        .bind(user_id)
        .bind(effective_limit)
        .fetch_all(self.pg.as_ref())
        .await
        .map_err(|e| {
            error!(
                "[HistoryService] Erreur récupération consultations utilisateur (user_id={}): {}",
                user_id, e
            );
            format!("Erreur récupération consultations: {}", e)
        })?;

        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    /// Récupérer les consultations d'un service spécifique
    pub async fn get_service_consultations_by_service(
        &self,
        service_id: i32,
        limit: Option<i64>,
    ) -> AppResult<Vec<HistoryEvent>> {
        let effective_limit = limit.unwrap_or(100);

        let rows = sqlx::query_as::<_, HistoryEventRow>(
            "SELECT event_type, user_id, service_id, interaction_id, timestamp, data, metadata
             FROM history_events
             WHERE event_type = 'UserAction' AND service_id = $1 AND metadata->>'action_type' = 'service_consultation'
             ORDER BY timestamp DESC
             LIMIT $2",
        )
        .bind(service_id)
        .bind(effective_limit)
        .fetch_all(self.pg.as_ref())
        .await
        .map_err(|e| {
            error!(
                "[HistoryService] Erreur récupération consultations service (service_id={}): {}",
                service_id, e
            );
            format!("Erreur récupération consultations service: {}", e)
        })?;

        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    /// Récupérer les statistiques globales de consultations
    pub async fn get_global_consultation_stats(&self, days: Option<i64>) -> AppResult<Value> {
        let row = if let Some(days) = days {
            sqlx::query_as::<_, GlobalConsultationStatRow>(
                "SELECT
                    COUNT(*) as total_consultations,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT service_id) as unique_services,
                    COALESCE(SUM(CASE WHEN (data->>'debit_applied')::boolean = true THEN (data->>'token_cost')::float ELSE 0 END), 0) as total_debits
                 FROM history_events
                 WHERE event_type = 'UserAction'
                   AND metadata->>'action_type' = 'service_consultation'
                   AND timestamp >= NOW() - ($1 || ' days')::interval",
            )
            .bind(days.to_string())
            .fetch_optional(self.pg.as_ref())
            .await
        } else {
            sqlx::query_as::<_, GlobalConsultationStatRow>(
                "SELECT
                    COUNT(*) as total_consultations,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT service_id) as unique_services,
                    COALESCE(SUM(CASE WHEN (data->>'debit_applied')::boolean = true THEN (data->>'token_cost')::float ELSE 0 END), 0) as total_debits
                 FROM history_events
                 WHERE event_type = 'UserAction'
                   AND metadata->>'action_type' = 'service_consultation'",
            )
            .fetch_optional(self.pg.as_ref())
            .await
        }
        .map_err(|e| {
            error!(
                "[HistoryService] Erreur agrégation stats globales (days={:?}): {}",
                days, e
            );
            format!("Erreur agrégation stats globales: {}", e)
        })?;

        if let Some(row) = row {
            Ok(serde_json::json!({
                "total_consultations": row.total_consultations,
                "unique_users": row.unique_users,
                "unique_services": row.unique_services,
                "total_debits": row.total_debits,
            }))
        } else {
            Ok(serde_json::json!({
                "total_consultations": 0,
                "unique_users": 0,
                "unique_services": 0,
                "total_debits": 0,
            }))
        }
    }
}

// ---- Row types for sqlx ----

#[derive(sqlx::FromRow)]
struct HistoryEventRow {
    event_type: String,
    user_id: Option<i32>,
    service_id: Option<i32>,
    interaction_id: Option<String>,
    timestamp: chrono::DateTime<Utc>,
    data: Value,
    metadata: Option<Value>,
}

impl From<HistoryEventRow> for HistoryEvent {
    fn from(row: HistoryEventRow) -> Self {
        let event_type = match row.event_type.as_str() {
            "IAInteraction" => HistoryEventType::IAInteraction,
            "Feedback" => HistoryEventType::Feedback,
            "ServiceCreation" => HistoryEventType::ServiceCreation,
            "ServiceUpdate" => HistoryEventType::ServiceUpdate,
            "Error" => HistoryEventType::Error,
            "SecurityEvent" => HistoryEventType::SecurityEvent,
            _ => HistoryEventType::UserAction,
        };
        HistoryEvent {
            event_type,
            user_id: row.user_id,
            service_id: row.service_id,
            interaction_id: row.interaction_id,
            timestamp: Some(row.timestamp),
            data: row.data,
            metadata: row.metadata,
        }
    }
}

#[derive(sqlx::FromRow)]
struct FeedbackStatRow {
    model: Option<String>,
    total_feedback: i64,
    avg_rating: Option<f64>,
    positive_feedback: i64,
    negative_feedback: i64,
}

#[derive(sqlx::FromRow)]
struct GlobalConsultationStatRow {
    total_consultations: i64,
    unique_users: i64,
    unique_services: i64,
    total_debits: f64,
}

fn sanitize_metadata_value(value: &mut Value, max_len: usize) {
    match value {
        Value::String(s) if s.len() > max_len => {
            s.truncate(max_len.saturating_sub(3));
            s.push_str("...");
        }
        Value::Array(arr) => {
            for item in arr {
                sanitize_metadata_value(item, max_len);
            }
        }
        Value::Object(map) => {
            for val in map.values_mut() {
                sanitize_metadata_value(val, max_len);
            }
        }
        _ => {}
    }
}
