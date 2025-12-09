use base64::{engine::general_purpose::STANDARD, Engine};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

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
    #[allow(dead_code)]
    pool: PgPool,
    #[allow(dead_code)]
    redis_client: Option<redis::Client>,
}

impl DbOptimizer {
    pub fn new(pool: PgPool, redis_client: Option<redis::Client>) -> Self {
        Self { pool, redis_client }
    }

    /// ✅ NOUVEAU : Mappe une catégorie vers un type spécialisé si applicable
    /// Retourne None si c'est une catégorie générique
    fn map_category_to_specialized_type(category: &str) -> Option<&'static str> {
        let cat_lower = category.to_lowercase();
        match cat_lower.as_str() {
            "pharmacie" | "pharmacy" => Some("pharmacie"),
            "hopital" | "hôpital" | "clinique" | "hospital" | "clinic" => Some("hopital_clinique"),
            "laboratoire" | "laboratory" | "imagerie" | "imaging" => Some("laboratoire_imagerie"),
            "agence de voyage" | "agence_voyage" | "travel agency" => Some("agence_voyage"),
            "covoiturage" | "carpooling" | "covoit" => Some("covoiturage"),
            "taxi" | "taxi_ville" => Some("taxi_ville"),
            "banque de sang" | "banque_sang" | "blood bank" => Some("banque_sang"),
            _ => None,
        }
    }

    /// R?cup?re les services avec cache et pagination optimis?e
    pub async fn get_services_optimized(
        &self,
        limit: i64,
        offset: i64,
        category: Option<&str>,
        active_only: bool,
    ) -> Result<Vec<ServiceSummary>, sqlx::Error> {
        let cache_key = format!(
            "services:{}:{}:{}:{}",
            limit,
            offset,
            category.unwrap_or("all"),
            active_only
        );

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
            "SELECT id, user_id, data->>'category' as category, specialized_type, is_active, gps, created_at 
             FROM services WHERE 1=1",
        );

        let mut params: Vec<String> = vec![];
        let mut param_count = 0;

        if let Some(cat) = category {
            // ✅ NOUVEAU : Si la catégorie correspond à un type spécialisé, utiliser specialized_type
            let specialized_type = Self::map_category_to_specialized_type(cat);
            if let Some(st) = specialized_type {
                param_count += 1;
                query.push_str(&format!(" AND specialized_type = ${}", param_count));
                params.push(st.to_string());
            } else {
                // Service générique : utiliser category
                param_count += 1;
                query.push_str(&format!(
                    " AND (data->>'category' = ${} OR category = ${}) AND specialized_type IS NULL",
                    param_count, param_count
                ));
                params.push(cat.to_string());
            }
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
                1 if category.is_some() && active_only => {
                    sql_query = sql_query.bind(param == "true")
                }
                0 if category.is_none() && active_only => {
                    sql_query = sql_query.bind(param == "true")
                }
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
                id: row.get::<i32, _>("id"),
                user_id: row.get::<i32, _>("user_id"),
                category: row.get::<Option<String>, _>("category"),
                is_active: row.get::<bool, _>("is_active"),
                gps: row.get::<Option<String>, _>("gps"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            })
            .collect();

        // Mettre en cache
        self.cache_results(&cache_key, &services).await;

        Ok(services)
    }

    /// R?cup?re les statistiques utilisateur avec cache
    pub async fn get_user_stats_cached(&self, user_id: i32) -> Result<UserStats, sqlx::Error> {
        let cache_key = format!("user_stats:{}", user_id);

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
    ) -> Result<Vec<ServiceSummary>, sqlx::Error> {
        let cache_key = format!("search:{}:{}:{}", query, limit, category.unwrap_or("all"));

        // V?rifier le cache Redis
        if let Some(_redis) = &self.redis_client {
            if let Ok(cached) = self.get_from_redis_cache(&cache_key).await {
                return Ok(cached);
            }
        }

        // Requ?te avec recherche full-text PostgreSQL
        let mut sql_query = String::from(
            "SELECT id, user_id, data->>'category' as category, specialized_type, is_active, gps, created_at,
                    ts_rank(to_tsvector('french', data::text), plainto_tsquery('french', $1)) as rank
             FROM services 
             WHERE to_tsvector('french', data::text) @@ plainto_tsquery('french', $1)"
        );

        let mut bind_value: Option<&str> = None;

        if let Some(cat) = category {
            // ✅ NOUVEAU : Si la catégorie correspond à un type spécialisé, utiliser specialized_type
            let specialized_type = Self::map_category_to_specialized_type(cat);
            if let Some(st) = specialized_type {
                sql_query.push_str(" AND specialized_type = $2");
                bind_value = Some(st);
            } else {
                // Service générique : utiliser category
                sql_query.push_str(
                    " AND (data->>'category' = $2 OR category = $2) AND specialized_type IS NULL",
                );
                bind_value = Some(cat);
            }
        }

        sql_query.push_str(" AND is_active = true ORDER BY rank DESC, created_at DESC LIMIT $");
        sql_query.push_str(&if category.is_some() { "3" } else { "2" });

        let mut query_builder = sqlx::query(&sql_query).bind(query);

        if let Some(value) = bind_value {
            query_builder = query_builder.bind(value);
        }

        query_builder = query_builder.bind(limit);

        let rows = query_builder.fetch_all(&self.pool).await?;

        let services: Vec<ServiceSummary> = rows
            .into_iter()
            .map(|row| ServiceSummary {
                id: row.get::<i32, _>("id"),
                user_id: row.get::<i32, _>("user_id"),
                category: row.get::<Option<String>, _>("category"),
                is_active: row.get::<bool, _>("is_active"),
                gps: row.get::<Option<String>, _>("gps"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
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
                // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
                use crate::utils::redis_helper;

                // Convertir Vec<u8> en String pour le helper
                let serialized_str = STANDARD.encode(&serialized);
                if let Err(e) = redis_helper::set_with_retry(
                    redis,
                    key,
                    &serialized_str,
                    Some(CACHE_TTL as u64),
                )
                .await
                {
                    warn!("[DBOptimizer] Redis indisponible pour cache {}: {}. L'opération continue sans cache.", key, e);
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
    async fn get_from_redis_cache<T: for<'de> Deserialize<'de>>(
        &self,
        key: &str,
    ) -> Result<T, Box<dyn std::error::Error>> {
        if let Some(redis) = &self.redis_client {
            // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
            use crate::utils::redis_helper;

            match redis_helper::get_with_retry(redis, key).await {
                Ok(Some(serialized_str)) => {
                    // Décoder depuis base64
                    let data = STANDARD
                        .decode(&serialized_str)
                        .map_err(|e| format!("Erreur décodage base64: {}", e))?;
                    let result: T = bincode::deserialize(&data)?;
                    Ok(result)
                }
                Ok(None) => Err("Clé non trouvée dans le cache".into()),
                Err(e) => Err(format!("Redis indisponible: {}", e).into()),
            }
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
            // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
            use crate::utils::redis_helper;

            // Vérifier simplement que Redis est disponible (cleanup automatique via TTL)
            if redis_helper::check_redis_health(redis).await {
                info!("Cache cleanup terminé (Redis disponible)");
            } else {
                log::debug!(
                    "Cache cleanup terminé (Redis non disponible, cleanup mémoire uniquement)"
                );
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
