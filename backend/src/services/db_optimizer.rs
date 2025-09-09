use sqlx::{PgPool, Row};
use redis::AsyncCommands;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Serialize, Deserialize};
use log::{info, warn};

lazy_static::lazy_static! {
    static ref QUERY_CACHE: Arc<RwLock<HashMap<String, (Vec<u8>, u64)>>> = Arc::new(RwLock::new(HashMap::new()));
}

const CACHE_TTL: u64 = 300; // 5 minutes
const MAX_CACHE_SIZE: usize = 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceSummary {
    pub id: i32,
    pub user_id: i32,
    pub category: Option<String>,
    pub is_active: bool,
    pub gps: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Service optimis? pour les requ?tes de base de donn?es
pub struct DbOptimizer {
    pool: PgPool,
    redis_client: Option<redis::Client>,
}

impl DbOptimizer {
    pub fn new(pool: PgPool, redis_client: Option<redis::Client>) -> Self {
        Self { pool, redis_client }
    }

    /// R?cup?re les services avec cache et pagination optimis?e
    pub async fn get_services_optimized(
        &self,
        limit: i64,
        offset: i64,
        category: Option<&str>,
        active_only: bool,
    ) -> Result<Vec<ServiceSummary>, sqlx::Error> {
        let cache_key = format!("services:{}:{}:{}:{}", limit, offset, category.unwrap_or("all"), active_only);

        // V?rifier le cache Redis
        if let Some(_redis) = &self.redis_client {
            if let Ok(cached) = self.get_from_redis_cache(&cache_key).await {
                return Ok(cached);
            }
        }

        // V?rifier le cache m?moire
        if let Some(cached) = self.get_from_memory_cache(&cache_key).await {
            return Ok(cached);
        }

        // Construire la requ?te dynamiquement
        let mut query = String::from(
            "SELECT id, user_id, data->>'category' as category, is_active, gps, created_at 
             FROM services WHERE 1=1"
        );

        let mut params: Vec<String> = vec![];
        let mut param_count = 0;

        if let Some(cat) = category {
            param_count += 1;
            query.push_str(&format!(" AND data->>'category' = ${}", param_count));
            params.push(cat.to_string());
        }

        if active_only {
            param_count += 1;
            query.push_str(&format!(" AND is_active = ${}", param_count));
            params.push("true".to_string());
        }

        query.push_str(" ORDER BY created_at DESC");
        param_count += 1;
        query.push_str(&format!(" LIMIT ${}", param_count));
        params.push(limit.to_string());

        param_count += 1;
        query.push_str(&format!(" OFFSET ${}", param_count));
        params.push(offset.to_string());

        // Ex?cuter la requ?te avec les param?tres
        let mut sql_query = sqlx::query(&query);
        
        // Binder les param?tres de mani?re appropri?e
        for (i, param) in params.iter().enumerate() {
            match i {
                0 if category.is_some() => sql_query = sql_query.bind(param),
                1 if category.is_some() && active_only => sql_query = sql_query.bind(param == "true"),
                0 if category.is_none() && active_only => sql_query = sql_query.bind(param == "true"),
                _ => {
                    if param.parse::<i64>().is_ok() {
                        sql_query = sql_query.bind(param.parse::<i64>().unwrap());
                    } else {
                        sql_query = sql_query.bind(param);
                    }
                }
            }
        }

        let rows = sql_query.fetch_all(&self.pool).await?;
        
        let services: Vec<ServiceSummary> = rows
            .into_iter()
            .map(|row| ServiceSummary {
                id: row.get("id"),
                user_id: row.get("user_id"),
                category: row.get("category"),
                is_active: row.get("is_active"),
                gps: row.get("gps"),
                created_at: row.get("created_at"),
            })
            .collect();

        // Mettre en cache
        self.cache_results(&cache_key, &services).await;

        Ok(services)
    }

    /// R?cup?re les statistiques utilisateur avec cache
    pub async fn get_user_stats_cached(&self, user_id: i32) -> Result<UserStats, sqlx::Error> {        let cache_key = format!("user_stats:{}", user_id);

        // V?rifier le cache Redis
        if let Some(_redis) = &self.redis_client {
            if let Ok(cached) = self.get_from_redis_cache(&cache_key).await {
                return Ok(cached);
            }
        }

        // Requ?te optimis?e avec jointures (sans service_reviews, maintenant g?r? par MongoDB)
        let stats = sqlx::query_as!(
            UserStats,
            r#"
            SELECT 
                u.id,
                u.tokens_balance,
                COUNT(s.id) as services_count,
                COUNT(CASE WHEN s.is_active THEN 1 END) as active_services_count,
                NULL::BIGINT as reviews_count,
                NULL::DOUBLE PRECISION as avg_rating
            FROM users u
            LEFT JOIN services s ON u.id = s.user_id
            WHERE u.id = $1
            GROUP BY u.id, u.tokens_balance
            "#,
            user_id
        )
        .fetch_one(&self.pool)
        .await?;

        // Mettre en cache
        self.cache_results(&cache_key, &stats).await;

        Ok(stats)
    }

    /// Recherche de services avec index full-text et cache
    pub async fn search_services_optimized(
        &self,
        query: &str,
        limit: i64,
        category: Option<&str>,
    ) -> Result<Vec<ServiceSummary>, sqlx::Error> {        let cache_key = format!("search:{}:{}:{}", query, limit, category.unwrap_or("all"));

        // V?rifier le cache Redis
        if let Some(_redis) = &self.redis_client {
            if let Ok(cached) = self.get_from_redis_cache(&cache_key).await {
                return Ok(cached);
            }
        }

        // Requ?te avec recherche full-text PostgreSQL
        let mut sql_query = String::from(
            "SELECT id, user_id, data->>'category' as category, is_active, gps, created_at,
                    ts_rank(to_tsvector('french', data::text), plainto_tsquery('french', $1)) as rank
             FROM services 
             WHERE to_tsvector('french', data::text) @@ plainto_tsquery('french', $1)"
        );

        if category.is_some() {
            sql_query.push_str(" AND data->>'category' = $2");
        }

        sql_query.push_str(" AND is_active = true ORDER BY rank DESC, created_at DESC LIMIT $");
        sql_query.push_str(&if category.is_some() { "3" } else { "2" });

        let mut query_builder = sqlx::query(&sql_query).bind(query);

        if let Some(cat) = category {
            query_builder = query_builder.bind(cat);
        }

        query_builder = query_builder.bind(limit);

        let rows = query_builder.fetch_all(&self.pool).await?;
        
        let services: Vec<ServiceSummary> = rows
            .into_iter()
            .map(|row| ServiceSummary {
                id: row.get("id"),
                user_id: row.get("user_id"),
                category: row.get("category"),
                is_active: row.get("is_active"),
                gps: row.get("gps"),
                created_at: row.get("created_at"),
            })
            .collect();

        // Mettre en cache
        self.cache_results(&cache_key, &services).await;

        Ok(services)
    }

    /// Optimise les requ?tes de matching d'?changes
    pub async fn get_matching_candidates_optimized(
        &self,
        echange_id: i32,
        mode: &str,
        limit: i64,
    ) -> Result<Vec<MatchingCandidate>, sqlx::Error> {
        let cache_key = format!("matching:{}:{}:{}", echange_id, mode, limit);

        // V?rifier le cache Redis
        if let Some(_redis) = &self.redis_client {
            if let Ok(cached) = self.get_from_redis_cache(&cache_key).await {
                return Ok(cached);
            }
        }

        // Requ?te optimis?e avec index sur statut et created_at
        let candidates = sqlx::query_as!(
            MatchingCandidate,
            r#"
            SELECT id, user_id, offre, besoin, quantite_offerte, quantite_requise, 
                   gps_fixe_lat, gps_fixe_lon, don, created_at
            FROM echanges 
            WHERE statut = 'en_attente' 
              AND id != $1
              AND created_at > NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC 
            LIMIT $2
            "#,
            echange_id,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        // Mettre en cache
        self.cache_results(&cache_key, &candidates).await;

        Ok(candidates)
    }

    /// Cache les r?sultats dans Redis et m?moire
    async fn cache_results<T: Serialize>(&self, key: &str, data: &T) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Cache Redis
        if let Some(redis) = &self.redis_client {
            if let Ok(serialized) = bincode::serialize(data) {
                if let Ok(mut conn) = redis.get_multiplexed_async_connection().await {
                    if let Err(e) = conn.set_ex::<&str, Vec<u8>, ()>(key, serialized, CACHE_TTL as u64).await {
                        warn!("Erreur cache Redis: {}", e);
                    }
                }
            }
        }

        // Cache m?moire
        if let Ok(serialized) = bincode::serialize(data) {
            let mut cache = QUERY_CACHE.write().await;
            
            // Nettoyer le cache si trop plein
            if cache.len() >= MAX_CACHE_SIZE {
                let mut to_remove: Vec<String> = vec![];
                for (k, (_, timestamp)) in cache.iter() {
                    if now - timestamp > CACHE_TTL {
                        to_remove.push(k.clone());
                    }
                }
                for k in to_remove {
                    cache.remove(&k);
                }
            }

            cache.insert(key.to_string(), (serialized, now));
        }
    }

    /// R?cup?re depuis le cache Redis
    async fn get_from_redis_cache<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Result<T, Box<dyn std::error::Error>> {
        if let Some(redis) = &self.redis_client {
            let mut conn = redis.get_multiplexed_async_connection().await?;
            let data: Vec<u8> = conn.get(key).await?;
            let result: T = bincode::deserialize(&data)?;
            Ok(result)
        } else {
            Err("Redis non disponible".into())
        }
    }

    /// R?cup?re depuis le cache m?moire
    async fn get_from_memory_cache<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Option<T> {
        let cache = QUERY_CACHE.read().await;
        if let Some((data, timestamp)) = cache.get(key) {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            if now - timestamp < CACHE_TTL {
                if let Ok(result) = bincode::deserialize::<T>(data) {
                    return Some(result);
                }
            }
        }
        None
    }

    /// Nettoie les caches expir?s
    pub async fn cleanup_expired_cache(&self) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Nettoyer le cache m?moire
        {
            let mut cache = QUERY_CACHE.write().await;
            let mut to_remove: Vec<String> = vec![];
            for (k, (_, timestamp)) in cache.iter() {
                if now - timestamp > CACHE_TTL {
                    to_remove.push(k.clone());
                }
            }
            for k in to_remove {
                cache.remove(&k);
            }
        }

        // Nettoyer le cache Redis (optionnel)
        if let Some(redis) = &self.redis_client {
            if let Ok(_conn) = redis.get_multiplexed_async_connection().await {
                // Redis g?re automatiquement l'expiration
                info!("Cache cleanup termin?");
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserStats {
    pub id: i32,
    pub tokens_balance: i64,
    pub services_count: Option<i64>,
    pub active_services_count: Option<i64>,
    pub reviews_count: Option<i64>,
    pub avg_rating: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingCandidate {
    pub id: i32,
    pub user_id: i32,
    pub offre: serde_json::Value,
    pub besoin: serde_json::Value,
    pub quantite_offerte: Option<f64>,
    pub quantite_requise: Option<f64>,
    pub gps_fixe_lat: Option<f64>,
    pub gps_fixe_lon: Option<f64>,
    pub don: Option<bool>,
    pub created_at: chrono::NaiveDateTime,
}
