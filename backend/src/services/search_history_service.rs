// Service pour gérer l'historique des recherches utilisateurs
use crate::core::types::AppError;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHistoryEntry {
    pub id: i32,
    pub user_id: Option<i32>,
    pub query_text: String,
    pub query_type: String,
    pub category: Option<String>,
    pub filters: Option<serde_json::Value>,
    pub location_lat: Option<f64>,
    pub location_lon: Option<f64>,
    pub results_count: i32,
    pub clicked_result_id: Option<i32>,
    pub clicked_at: Option<chrono::DateTime<chrono::Utc>>,
    pub session_id: Option<String>,
    pub device_type: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PopularSearch {
    pub query_text: String,
    pub search_count: i64,
    pub last_searched: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSuggestion {
    pub query_text: String,
    pub search_count: i64,
}

/// Enregistrer une recherche dans l'historique
pub async fn record_search(
    pool: &PgPool,
    user_id: Option<i32>,
    query_text: &str,
    query_type: &str,
    category: Option<&str>,
    filters: Option<&serde_json::Value>,
    location_lat: Option<f64>,
    location_lon: Option<f64>,
    results_count: i32,
    session_id: Option<&str>,
    device_type: Option<&str>,
) -> Result<i32, AppError> {
    log::info!(
        "[SearchHistoryService] Enregistrement recherche: '{}' (type: {}, user: {:?})",
        query_text,
        query_type,
        user_id
    );

    let row = sqlx::query(
        r#"
        INSERT INTO search_history (
            user_id, query_text, query_type, category, filters,
            location_lat, location_lon, results_count, session_id, device_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(query_text)
    .bind(query_type)
    .bind(category)
    .bind(filters)
    .bind(location_lat)
    .bind(location_lon)
    .bind(results_count)
    .bind(session_id)
    .bind(device_type)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur enregistrement recherche: {}", e)))?;

    let id: i32 = row.get::<i32, _>("id");
    log::info!("[SearchHistoryService] ✅ Recherche enregistrée: {}", id);

    Ok(id)
}

/// Enregistrer un clic sur un résultat de recherche
pub async fn record_search_click(
    pool: &PgPool,
    search_id: i32,
    result_id: i32,
) -> Result<bool, AppError> {
    let result = sqlx::query(
        r#"
        UPDATE search_history
        SET clicked_result_id = $1, clicked_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(result_id)
    .bind(search_id)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur enregistrement clic: {}", e)))?;

    Ok(result.rows_affected() > 0)
}

/// Récupérer les recherches populaires
pub async fn get_popular_searches(
    pool: &PgPool,
    limit: i64,
    category: Option<&str>,
    days: i32,
) -> Result<Vec<PopularSearch>, AppError> {
    let rows = if let Some(cat) = category {
        sqlx::query(
            r#"
            SELECT query_text, COUNT(*) as search_count, MAX(created_at) as last_searched
            FROM search_history
            WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
            AND category = $2
            GROUP BY query_text
            ORDER BY search_count DESC, last_searched DESC
            LIMIT $3
            "#,
        )
        .bind(days)
        .bind(cat)
        .bind(limit)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query(
            r#"
            SELECT query_text, COUNT(*) as search_count, MAX(created_at) as last_searched
            FROM search_history
            WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
            GROUP BY query_text
            ORDER BY search_count DESC, last_searched DESC
            LIMIT $2
            "#,
        )
        .bind(days)
        .bind(limit)
        .fetch_all(pool)
        .await
    }
    .map_err(|e| AppError::Internal(format!("Erreur récupération recherches populaires: {}", e)))?;

    let popular = rows
        .iter()
        .map(|row| PopularSearch {
            query_text: row.get::<String, _>("query_text"),
            search_count: row.get::<i64, _>("search_count"),
            last_searched: row.get::<chrono::DateTime<chrono::Utc>, _>("last_searched"),
        })
        .collect();

    Ok(popular)
}

/// Récupérer les suggestions de recherche pour un utilisateur
pub async fn get_search_suggestions(
    pool: &PgPool,
    user_id: Option<i32>,
    prefix: Option<&str>,
    limit: i64,
) -> Result<Vec<SearchSuggestion>, AppError> {
    let rows = if let Some(prefix) = prefix {
        if let Some(uid) = user_id {
            // Recherche avec prefix et user_id
            sqlx::query(
                r#"
                SELECT query_text, COUNT(*) as search_count
                FROM search_history
                WHERE (user_id = $1 OR user_id IS NULL)
                AND LOWER(query_text) LIKE LOWER($2 || '%')
                AND created_at >= NOW() - INTERVAL '90 days'
                GROUP BY query_text
                ORDER BY 
                    CASE WHEN user_id = $1 THEN 1 ELSE 2 END,
                    search_count DESC,
                    MAX(created_at) DESC
                LIMIT $3
                "#,
            )
            .bind(uid)
            .bind(prefix)
            .bind(limit)
            .fetch_all(pool)
            .await
        } else {
            // Recherche avec prefix seulement
            sqlx::query(
                r#"
                SELECT query_text, COUNT(*) as search_count
                FROM search_history
                WHERE LOWER(query_text) LIKE LOWER($1 || '%')
                AND created_at >= NOW() - INTERVAL '90 days'
                GROUP BY query_text
                ORDER BY search_count DESC, MAX(created_at) DESC
                LIMIT $2
                "#,
            )
            .bind(prefix)
            .bind(limit)
            .fetch_all(pool)
            .await
        }
    } else if let Some(uid) = user_id {
        // Recherche sans prefix mais avec user_id
        sqlx::query(
            r#"
            SELECT query_text, COUNT(*) as search_count
            FROM search_history
            WHERE (user_id = $1 OR user_id IS NULL)
            AND created_at >= NOW() - INTERVAL '90 days'
            GROUP BY query_text
            ORDER BY 
                CASE WHEN user_id = $1 THEN 1 ELSE 2 END,
                search_count DESC,
                MAX(created_at) DESC
            LIMIT $2
            "#,
        )
        .bind(uid)
        .bind(limit)
        .fetch_all(pool)
        .await
    } else {
        // Recherche sans prefix ni user_id
        sqlx::query(
            r#"
            SELECT query_text, COUNT(*) as search_count
            FROM search_history
            WHERE created_at >= NOW() - INTERVAL '90 days'
            GROUP BY query_text
            ORDER BY search_count DESC, MAX(created_at) DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }
    .map_err(|e| AppError::Internal(format!("Erreur récupération suggestions: {}", e)))?;

    let suggestions = rows
        .iter()
        .map(|row| SearchSuggestion {
            query_text: row.get::<String, _>("query_text"),
            search_count: row.get::<i64, _>("search_count"),
        })
        .collect();

    Ok(suggestions)
}

/// Récupérer l'historique de recherche d'un utilisateur
pub async fn get_user_search_history(
    pool: &PgPool,
    user_id: i32,
    limit: i64,
) -> Result<Vec<SearchHistoryEntry>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT id, user_id, query_text, query_type, category, filters,
               location_lat, location_lon, results_count, clicked_result_id,
               clicked_at, session_id, device_type, created_at
        FROM search_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération historique: {}", e)))?;

    let history = rows
        .iter()
        .map(|row| SearchHistoryEntry {
            id: row.get::<i32, _>("id"),
            user_id: row.get::<Option<i32>, _>("user_id"),
            query_text: row.get::<String, _>("query_text"),
            query_type: row.get::<String, _>("query_type"),
            category: row.get::<Option<String>, _>("category"),
            filters: row.get::<Option<serde_json::Value>, _>("filters"),
            location_lat: row.get::<Option<f64>, _>("location_lat"),
            location_lon: row.get::<Option<f64>, _>("location_lon"),
            results_count: row.get::<i32, _>("results_count"),
            clicked_result_id: row.get::<Option<i32>, _>("clicked_result_id"),
            clicked_at: row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("clicked_at"),
            session_id: row.get::<Option<String>, _>("session_id"),
            device_type: row.get::<Option<String>, _>("device_type"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        })
        .collect();

    Ok(history)
}

/// Nettoyer les anciennes recherches
pub async fn cleanup_old_search_history(pool: &PgPool, days_to_keep: i32) -> Result<i64, AppError> {
    log::info!(
        "[SearchHistoryService] Nettoyage recherches > {} jours",
        days_to_keep
    );

    let row = sqlx::query(
        r#"
        SELECT cleanup_old_search_history($1) as deleted_count
        "#,
    )
    .bind(days_to_keep)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur nettoyage historique: {}", e)))?;

    let deleted_count: i64 = row.get::<i64, _>("deleted_count");
    log::info!(
        "[SearchHistoryService] ✅ {} recherches supprimées",
        deleted_count
    );

    Ok(deleted_count)
}
