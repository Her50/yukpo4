use log;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::collections::HashMap;

/// Service de tracking avancé (comme Facebook Pixel)
pub struct PublicitePixelService;

#[derive(Debug, Serialize, Deserialize)]
pub struct PixelEvent {
    pub event_name: String, // 'PageView', 'ViewContent', 'AddToCart', 'Purchase', etc.
    pub user_id: Option<i32>,
    pub event_id: Option<String>,   // ID unique pour déduplication
    pub event_time: Option<i64>,    // Timestamp Unix
    pub action_source: String,      // 'website', 'app', 'email', etc.
    pub custom_data: Option<Value>, // Données personnalisées
    pub user_data: Option<Value>,   // Données utilisateur (email, phone, etc.)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PixelResponse {
    pub events_received: i32,
    pub messages: Vec<String>,
    pub fbtrace_id: Option<String>,
}

impl PublicitePixelService {
    /// Enregistrer un événement pixel
    pub async fn track_event(
        pool: &PgPool,
        event: PixelEvent,
    ) -> Result<PixelResponse, sqlx::Error> {
        let event_id = event.event_id.unwrap_or_else(|| {
            format!(
                "{}_{}",
                event.event_name,
                chrono::Utc::now().timestamp_millis()
            )
        });
        let event_time = event
            .event_time
            .unwrap_or_else(|| chrono::Utc::now().timestamp());

        // Enregistrer dans la table pixel_events
        sqlx::query(
            r#"
            INSERT INTO pixel_events (
                event_name, user_id, event_id, event_time, action_source, custom_data, user_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (event_id) DO NOTHING
            "#,
        )
        .bind(&event.event_name)
        .bind(event.user_id)
        .bind(&event_id)
        .bind(event_time)
        .bind(&event.action_source)
        .bind(event.custom_data.unwrap_or_else(|| serde_json::json!({})))
        .bind(event.user_data.unwrap_or_else(|| serde_json::json!({})))
        .execute(pool)
        .await?;

        log::debug!(
            "[Pixel] Événement enregistré: {} pour user_id={:?}",
            event.event_name,
            event.user_id
        );

        Ok(PixelResponse {
            events_received: 1,
            messages: vec![],
            fbtrace_id: Some(event_id),
        })
    }

    /// Enregistrer plusieurs événements (batch)
    pub async fn track_events_batch(
        pool: &PgPool,
        events: Vec<PixelEvent>,
    ) -> Result<PixelResponse, sqlx::Error> {
        let mut events_received = 0;
        let mut messages = Vec::new();

        for event in events {
            match Self::track_event(pool, event).await {
                Ok(_) => events_received += 1,
                Err(e) => {
                    messages.push(format!("Erreur: {}", e));
                }
            }
        }

        Ok(PixelResponse {
            events_received,
            messages,
            fbtrace_id: None,
        })
    }

    /// Obtenir les événements d'un utilisateur
    pub async fn get_user_events(
        pool: &PgPool,
        user_id: i32,
        event_name: Option<&str>,
        limit: Option<i32>,
    ) -> Result<Vec<Value>, sqlx::Error> {
        let limit = limit.unwrap_or(100);

        let query = if let Some(event_name) = event_name {
            sqlx::query_scalar::<_, Value>(
                r#"
                SELECT jsonb_build_object(
                    'event_name', event_name,
                    'event_id', event_id,
                    'event_time', event_time,
                    'action_source', action_source,
                    'custom_data', custom_data
                )
                FROM pixel_events
                WHERE user_id = $1 AND event_name = $2
                ORDER BY event_time DESC
                LIMIT $3
                "#,
            )
            .bind(user_id)
            .bind(event_name)
            .bind(limit)
        } else {
            sqlx::query_scalar::<_, Value>(
                r#"
                SELECT jsonb_build_object(
                    'event_name', event_name,
                    'event_id', event_id,
                    'event_time', event_time,
                    'action_source', action_source,
                    'custom_data', custom_data
                )
                FROM pixel_events
                WHERE user_id = $1
                ORDER BY event_time DESC
                LIMIT $2
                "#,
            )
            .bind(user_id)
            .bind(limit)
        };

        let events = query.fetch_all(pool).await?;
        Ok(events)
    }

    /// Créer une audience lookalike basée sur les événements
    pub async fn create_lookalike_audience(
        pool: &PgPool,
        source_audience_id: i32,
        similarity: f64,   // 0.01 à 1.0
        size: Option<i32>, // Taille de l'audience
    ) -> Result<i32, sqlx::Error> {
        // Récupérer les caractéristiques de l'audience source
        let source_events = sqlx::query(
            r#"
            SELECT DISTINCT user_id, event_name, custom_data
            FROM pixel_events
            WHERE user_id IN (
                SELECT user_id FROM publicite_audiences WHERE id = $1
            )
            "#,
        )
        .bind(source_audience_id)
        .fetch_all(pool)
        .await?;

        // Analyser les patterns (simplifié)
        let mut patterns: HashMap<String, i32> = HashMap::new();
        for row in source_events {
            let event_name: String = row.get("event_name");
            *patterns.entry(event_name).or_insert(0) += 1;
        }

        // Trouver des utilisateurs similaires (simplifié)
        // En production, utiliser ML pour trouver des utilisateurs similaires
        let lookalike_size = size.unwrap_or(1000);

        // Créer l'audience lookalike
        let audience_id: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO publicite_audiences (
                user_id, name, type, source_audience_id, similarity, user_ids
            )
            VALUES ($1, $2, 'lookalike', $3, $4, $5)
            RETURNING id
            "#,
        )
        .bind(0) // System user
        .bind(format!("Lookalike de l'audience {}", source_audience_id))
        .bind(source_audience_id)
        .bind(similarity)
        .bind(serde_json::json!([])) // À remplir avec les user_ids similaires
        .fetch_one(pool)
        .await?;

        log::info!(
            "[Pixel] Audience lookalike créée: {} (similarité: {})",
            audience_id,
            similarity
        );

        Ok(audience_id)
    }
}
