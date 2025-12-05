use crate::core::types::AppResult;
use sqlx::{FromRow, PgPool};

#[derive(FromRow)]
struct EngagementRow {
    liked: Option<bool>,
    saved: Option<bool>,
}

#[derive(FromRow)]
struct EngagementCountsRow {
    likes: i64,
    saves: i64,
}

#[derive(FromRow)]
struct BulkEngagementCountsRow {
    content_id: String,
    likes: i64,
    saves: i64,
}

#[derive(FromRow)]
struct UserEngagementRow {
    content_id: String,
    liked: Option<bool>,
    saved: Option<bool>,
}

pub struct ContentEngagementService;

impl ContentEngagementService {
    pub async fn upsert_engagement(
        pool: &PgPool,
        user_id: i32,
        content_id: &str,
        liked: Option<bool>,
        saved: Option<bool>,
    ) -> AppResult<()> {
        let existing: Option<EngagementRow> = sqlx::query_as(
            r#"
            SELECT liked, saved
            FROM content_engagement
            WHERE user_id = $1 AND content_id = $2
            "#,
        )
        .bind(user_id)
        .bind(content_id)
        .fetch_optional(pool)
        .await?;

        let (current_liked, current_saved) = existing
            .map(|row| (row.liked.unwrap_or(false), row.saved.unwrap_or(false)))
            .unwrap_or((false, false));

        let next_liked = liked.unwrap_or(current_liked);
        let next_saved = saved.unwrap_or(current_saved);

        sqlx::query(
            r#"
            INSERT INTO content_engagement (user_id, content_id, liked, saved)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, content_id)
            DO UPDATE SET liked = EXCLUDED.liked,
                          saved = EXCLUDED.saved,
                          updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(content_id)
        .bind(next_liked)
        .bind(next_saved)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn get_counts(pool: &PgPool, content_id: &str) -> AppResult<(i64, i64)> {
        let row: EngagementCountsRow = sqlx::query_as(
            r#"
            SELECT 
                COALESCE(SUM(CASE WHEN liked THEN 1 ELSE 0 END)::BIGINT, 0) AS likes,
                COALESCE(SUM(CASE WHEN saved THEN 1 ELSE 0 END)::BIGINT, 0) AS saves
            FROM content_engagement
            WHERE content_id = $1
            "#,
        )
        .bind(content_id)
        .fetch_one(pool)
        .await?;

        Ok((row.likes, row.saves))
    }

    pub async fn get_bulk_status(
        pool: &PgPool,
        user_id: Option<i32>,
        content_ids: &[String],
    ) -> AppResult<Vec<serde_json::Value>> {
        if content_ids.is_empty() {
            return Ok(vec![]);
        }

        let counts: Vec<BulkEngagementCountsRow> = sqlx::query_as(
            r#"
            SELECT 
                content_id,
                COALESCE(SUM(CASE WHEN liked THEN 1 ELSE 0 END)::BIGINT, 0) AS likes,
                COALESCE(SUM(CASE WHEN saved THEN 1 ELSE 0 END)::BIGINT, 0) AS saves
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
            .map(|row| (row.content_id, (row.likes, row.saves)))
            .collect::<std::collections::HashMap<_, _>>();

        let mut user_map: std::collections::HashMap<String, (bool, bool)> =
            std::collections::HashMap::new();
        if let Some(uid) = user_id {
            let rows: Vec<UserEngagementRow> = sqlx::query_as(
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
                user_map.insert(
                    row.content_id,
                    (row.liked.unwrap_or(false), row.saved.unwrap_or(false)),
                );
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
