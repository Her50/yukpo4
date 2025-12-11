// ✅ NOUVEAU Phase 2: Service pour gérer les timelines multi-pistes avancées

use crate::core::types::{AppError, AppResult};
use crate::models::advanced_timeline_model::{AdvancedTimelineRequest, AdvancedTimelineRow};
use log::{info, warn};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

pub struct AdvancedTimelineService {
    pool: PgPool,
}

impl AdvancedTimelineService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Crée une nouvelle timeline avancée
    pub async fn create_timeline(
        &self,
        user_id: i32,
        request: AdvancedTimelineRequest,
    ) -> AppResult<AdvancedTimelineRow> {
        let timeline_id = Uuid::new_v4().to_string();
        let timeline_data = json!(request.timeline);

        let row = sqlx::query_as::<_, AdvancedTimelineRow>(
            r#"
            INSERT INTO advanced_timelines (
                timeline_id, user_id, name, timeline_data, duration,
                fps, resolution_width, resolution_height, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING *
            "#,
        )
        .bind(&timeline_id)
        .bind(user_id)
        .bind(&request.name)
        .bind(timeline_data)
        .bind(request.timeline.duration)
        .bind(request.timeline.fps.map(|f| f as i32))
        .bind(request.timeline.resolution.as_ref().map(|r| r.width as i32))
        .bind(
            request
                .timeline
                .resolution
                .as_ref()
                .map(|r| r.height as i32),
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            warn!("[AdvancedTimelineService] Erreur création timeline: {}", e);
            AppError::Database(format!("Erreur création timeline: {}", e))
        })?;

        info!(
            "[AdvancedTimelineService] ✅ Timeline créée: {} (id: {})",
            timeline_id, row.id
        );

        Ok(row)
    }

    /// Récupère une timeline par ID
    pub async fn get_timeline(
        &self,
        timeline_id: &str,
        user_id: Option<i32>,
    ) -> AppResult<Option<AdvancedTimelineRow>> {
        let query = if let Some(uid) = user_id {
            sqlx::query_as::<_, AdvancedTimelineRow>(
                r#"
                SELECT * FROM advanced_timelines
                WHERE timeline_id = $1 AND user_id = $2
                "#,
            )
            .bind(timeline_id)
            .bind(uid)
        } else {
            sqlx::query_as::<_, AdvancedTimelineRow>(
                r#"
                SELECT * FROM advanced_timelines
                WHERE timeline_id = $1
                "#,
            )
            .bind(timeline_id)
        };

        let result = query.fetch_optional(&self.pool).await.map_err(|e| {
            warn!(
                "[AdvancedTimelineService] Erreur récupération timeline: {}",
                e
            );
            AppError::Database(format!("Erreur récupération timeline: {}", e))
        })?;

        Ok(result)
    }

    /// Liste les timelines d'un utilisateur
    pub async fn list_timelines(
        &self,
        user_id: i32,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> AppResult<(Vec<AdvancedTimelineRow>, i64)> {
        let limit = limit.unwrap_or(50);
        let offset = offset.unwrap_or(0);

        // Compter le total
        let total: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM advanced_timelines WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            warn!("[AdvancedTimelineService] Erreur comptage timelines: {}", e);
            AppError::Database(format!("Erreur comptage timelines: {}", e))
        })?;

        // Récupérer les timelines
        let timelines = sqlx::query_as::<_, AdvancedTimelineRow>(
            r#"
            SELECT * FROM advanced_timelines
            WHERE user_id = $1
            ORDER BY updated_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            warn!("[AdvancedTimelineService] Erreur liste timelines: {}", e);
            AppError::Database(format!("Erreur liste timelines: {}", e))
        })?;

        Ok((timelines, total.0))
    }

    /// Met à jour une timeline
    pub async fn update_timeline(
        &self,
        timeline_id: &str,
        user_id: i32,
        request: AdvancedTimelineRequest,
    ) -> AppResult<AdvancedTimelineRow> {
        let timeline_data = json!(request.timeline);

        let row = sqlx::query_as::<_, AdvancedTimelineRow>(
            r#"
            UPDATE advanced_timelines
            SET name = $1, timeline_data = $2, duration = $3,
                fps = $4, resolution_width = $5, resolution_height = $6,
                updated_at = NOW()
            WHERE timeline_id = $7 AND user_id = $8
            RETURNING *
            "#,
        )
        .bind(&request.name)
        .bind(timeline_data)
        .bind(request.timeline.duration)
        .bind(request.timeline.fps.map(|f| f as i32))
        .bind(request.timeline.resolution.as_ref().map(|r| r.width as i32))
        .bind(
            request
                .timeline
                .resolution
                .as_ref()
                .map(|r| r.height as i32),
        )
        .bind(timeline_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            warn!(
                "[AdvancedTimelineService] Erreur mise à jour timeline: {}",
                e
            );
            AppError::Database(format!("Erreur mise à jour timeline: {}", e))
        })?;

        match row {
            Some(r) => {
                info!(
                    "[AdvancedTimelineService] ✅ Timeline mise à jour: {}",
                    timeline_id
                );
                Ok(r)
            }
            None => Err(AppError::NotFound(format!(
                "Timeline '{}' non trouvée",
                timeline_id
            ))),
        }
    }

    /// Supprime une timeline
    pub async fn delete_timeline(&self, timeline_id: &str, user_id: i32) -> AppResult<bool> {
        let result = sqlx::query(
            r#"
            DELETE FROM advanced_timelines
            WHERE timeline_id = $1 AND user_id = $2
            "#,
        )
        .bind(timeline_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            warn!(
                "[AdvancedTimelineService] Erreur suppression timeline: {}",
                e
            );
            AppError::Database(format!("Erreur suppression timeline: {}", e))
        })?;

        if result.rows_affected() > 0 {
            info!(
                "[AdvancedTimelineService] ✅ Timeline supprimée: {}",
                timeline_id
            );
            Ok(true)
        } else {
            Ok(false)
        }
    }
}
