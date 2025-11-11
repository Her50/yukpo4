use crate::core::types::AppResult;
use sqlx::{PgPool, Row};

pub struct ContentEngagementService;

impl ContentEngagementService {
    pub async fn upsert_engagement(
        pool: &PgPool,
        user_id: i32,
        content_id: &str,
        liked: Option<bool>,
        saved: Option<bool>,
    ) -> AppResult<()> {
        let existing = sqlx::query!(
            r#"
            SELECT liked, saved
            FROM content_engagement
            WHERE user_id = $1 AND content_id = $2
            "#,
            user_id,
            content_id
        )
        .fetch_optional(pool)
        .await?;

        let current_liked = existing.as_ref().and_then(|row| row.liked).unwrap_or(false);
        let current_saved = existing.as_ref().and_then(|row| row.saved).unwrap_or(false);

        let next_liked = liked.unwrap_or(current_liked);
        let next_saved = saved.unwrap_or(current_saved);

        sqlx::query!(
            r#"
            INSERT INTO content_engagement (user_id, content_id, liked, saved)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, content_id)
            DO UPDATE SET liked = EXCLUDED.liked,
                          saved = EXCLUDED.saved,
                          updated_at = NOW()
            "#,
            user_id,
            content_id,
            next_liked,
            next_saved
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn get_counts(pool: &PgPool, content_id: &str) -> AppResult<(i64, i64)> {
        let row = sqlx::query(
            r#"
            SELECT 
                SUM(CASE WHEN liked THEN 1 ELSE 0 END)::BIGINT AS likes,
                SUM(CASE WHEN saved THEN 1 ELSE 0 END)::BIGINT AS saves
            FROM content_engagement
            WHERE content_id = $1
            "#,
        )
        .bind(content_id)
        .fetch_one(pool)
        .await?;

        let likes = row
            .try_get::<Option<i64>, _>("likes")
            .unwrap_or(Some(0))
            .unwrap_or(0);
        let saves = row
            .try_get::<Option<i64>, _>("saves")
            .unwrap_or(Some(0))
            .unwrap_or(0);
        Ok((likes, saves))
    }

    pub async fn get_bulk_status(
        pool: &PgPool,
        user_id: Option<i32>,
        content_ids: &[String],
    ) -> AppResult<Vec<serde_json::Value>> {
        if content_ids.is_empty() {
            return Ok(vec![]);
        }

        let counts = sqlx::query(
            r#"
            SELECT 
                content_id,
                SUM(CASE WHEN liked THEN 1 ELSE 0 END)::BIGINT AS likes,
                SUM(CASE WHEN saved THEN 1 ELSE 0 END)::BIGINT AS saves
            FROM content_engagement
            WHERE content_id = ANY($1)
            GROUP BY content_id
            "#,
        )
        .bind(content_ids)
        .fetch_all(pool)
        .await?;

        let mut map = counts
            .into_iter()
            .filter_map(|row| {
                let content_id = row.try_get::<String, _>("content_id").ok()?;
                let likes = row
                    .try_get::<Option<i64>, _>("likes")
                    .unwrap_or(Some(0))
                    .unwrap_or(0);
                let saves = row
                    .try_get::<Option<i64>, _>("saves")
                    .unwrap_or(Some(0))
                    .unwrap_or(0);
                Some((content_id, (likes, saves)))
            })
            .collect::<std::collections::HashMap<_, _>>();

        let mut user_map: std::collections::HashMap<String, (bool, bool)> =
            std::collections::HashMap::new();
        if let Some(uid) = user_id {
            let rows = sqlx::query(
                r#"
                SELECT content_id, liked, saved
                FROM content_engagement
                WHERE user_id = $1 AND content_id = ANY($2)
                "#,
            )
            .bind(uid)
            .bind(content_ids)
            .fetch_all(pool)
            .await?;

            for row in rows {
                let cid = row.try_get::<String, _>("content_id").unwrap_or_default();
                let liked = row
                    .try_get::<Option<bool>, _>("liked")
                    .unwrap_or(Some(false))
                    .unwrap_or(false);
                let saved = row
                    .try_get::<Option<bool>, _>("saved")
                    .unwrap_or(Some(false))
                    .unwrap_or(false);
                user_map.insert(cid, (liked, saved));
            }
        }

        let payload = content_ids
            .iter()
            .map(|cid| {
                let (likes, saves) = map.remove(cid).unwrap_or((0, 0));
                let (liked, saved) = user_map.get(cid).copied().unwrap_or((false, false));
                serde_json::json!({
                    "content_id": cid,
                    "likes": likes,
                    "saves": saves,
                    "liked": liked,
                    "saved": saved
                })
            })
            .collect();

        Ok(payload)
    }
}
