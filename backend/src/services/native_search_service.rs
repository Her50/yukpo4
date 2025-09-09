use crate::core::types::AppResult;
use crate::utils::log::{log_info, log_error};
use crate::config::search_config::{SearchConfig, ConfigManager};
use serde_json::Value;
use sqlx::{PgPool, Row};




/// Résultat de recherche avec score détaillé
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub service_id: i32,
    pub data: Value,
    pub total_score: f32,
    pub fulltext_score: f32,
    pub trigram_score: f32,
    pub recency_score: f32,
    pub category_score: f32,
    pub search_method: String,
    pub matched_fields: Vec<String>,
}

/// Service de recherche native PostgreSQL intelligente
pub struct NativeSearchService {
    pool: PgPool,
    config: SearchConfig,
    config_manager: ConfigManager,
}

impl NativeSearchService {
    pub fn new(pool: PgPool) -> Self {
        let config_manager = ConfigManager::new();
        let config = config_manager.get_config().clone();
        
        Self {
            pool,
            config,
            config_manager,
        }
    }

    pub fn with_config(pool: PgPool, config: SearchConfig) -> Self {
        let config_manager = ConfigManager::new();
        Self { pool, config, config_manager }
    }

    /// Charger la configuration depuis un fichier et les variables d'environnement
    pub async fn load_config(&mut self, config_path: Option<&str>) -> Result<(), String> {
        self.config_manager.load_config(config_path).await?;
        self.config = self.config_manager.get_config().clone();
        Ok(())
    }

    /// Recherche intelligente combinant full-text et trigram
    pub async fn intelligent_search(
        &self,
        search_query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        _user_id: Option<i32>,
        gps_zone: Option<&str>,  // Nouveau paramètre GPS
        search_radius_km: Option<i32>,  // Nouveau paramètre rayon
    ) -> AppResult<Vec<SearchResult>> {
        let start_time = std::time::Instant::now();
        log_info(&format!("[NativeSearch] Début recherche: '{}' (GPS: {:?}, Rayon: {:?}km)", 
            search_query, gps_zone, search_radius_km));

        // Normaliser la requête
        let normalized_query = self.normalize_query_advanced(search_query);
        
        // Recherche full-text principale avec filtrage GPS
        let mut fulltext_results = self.fulltext_search_with_gps(
            &normalized_query, 
            category_filter, 
            location_filter,
            gps_zone,
            search_radius_km
        ).await?;
        
        // Recherche trigram de fallback si pas assez de résultats
        if fulltext_results.len() < self.config.general.max_results as usize {
            let trigram_results = self.trigram_search_with_gps(
                &normalized_query, 
                category_filter, 
                location_filter,
                gps_zone,
                search_radius_km
            ).await?;
            
            // Fusionner les résultats en évitant les doublons
            for result in trigram_results {
                if !fulltext_results.iter().any(|r| r.service_id == result.service_id) {
                    fulltext_results.push(result);
                }
            }
        }

        // Recherche par mots clés individuels si encore pas assez de résultats
        if fulltext_results.len() < self.config.general.max_results as usize / 2 {
            let keyword_results = self.keyword_search_with_gps(
                &normalized_query, 
                category_filter, 
                location_filter,
                gps_zone,
                search_radius_km
            ).await?;
            
            // Fusionner les résultats en évitant les doublons
            for result in keyword_results {
                if !fulltext_results.iter().any(|r| r.service_id == result.service_id) {
                    fulltext_results.push(result);
                }
            }
        }

        // Trier et limiter les résultats
        fulltext_results.sort_by(|a, b| b.total_score.partial_cmp(&a.total_score).unwrap_or(std::cmp::Ordering::Equal));
        fulltext_results.truncate(self.config.general.max_results as usize);

        let duration = start_time.elapsed();
        log_info(&format!(
            "[NativeSearch] Recherche terminée en {:?}: {} résultats (avec filtrage GPS: {})",
            duration, fulltext_results.len(), gps_zone.is_some()
        ));

        Ok(fulltext_results)
    }

    /// Recherche fulltext pour fallback
    #[allow(dead_code)]
    async fn fulltext_search(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
    ) -> AppResult<Vec<SearchResult>> {
        // Appeler la nouvelle méthode avec GPS désactivé
        self.fulltext_search_with_gps(query, category_filter, location_filter, None, None).await
    }

    /// Recherche full-text intelligente avec filtrage GPS
    async fn fulltext_search_with_gps(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
    ) -> AppResult<Vec<SearchResult>> {
        // Utiliser notre fonction PostgreSQL optimisée si GPS est fourni
        if let Some(gps_zone) = gps_zone {
            let radius = search_radius_km.unwrap_or(50);
            
            log_info(&format!("[NativeSearch] Utilisation de search_services_gps_final avec GPS: {} et rayon: {}km", gps_zone, radius));
            
            // Appeler notre fonction PostgreSQL optimisée
            let sql = r#"
                SELECT 
                    service_id,
                    titre_service,
                    category,
                    gps_coords,
                    distance_km,
                    relevance_score,
                    gps_source
                FROM search_services_gps_final($1, $2, $3, $4)
            "#;
            
            let results = sqlx::query(sql)
                .bind(query)
                .bind(gps_zone)
                .bind(radius)
                .bind(self.config.general.max_results)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    log_error(&format!("[NativeSearch] Erreur recherche GPS optimisée: {}", e));
                    crate::core::types::AppError::Internal(format!("Erreur recherche GPS optimisée: {}", e))
                })?;

            let mut search_results = Vec::new();
            for row in results {
                let service_id: i32 = row.get("service_id");
                let _titre_service: String = row.get("titre_service");
                let _category: Option<String> = row.get("category");
                let _gps_coords: Option<String> = row.get("gps_coords");
                let _distance_km: Option<f64> = row.get("distance_km");
                let relevance_score: f32 = row.get("relevance_score");
                let _gps_source: Option<String> = row.get("gps_source");
                
                // Récupérer les données complètes du service
                let service_data = sqlx::query("SELECT data FROM services WHERE id = $1")
                    .bind(service_id)
                    .fetch_one(&self.pool)
                    .await
                    .map(|row| row.get::<Value, _>("data"))
                    .unwrap_or_else(|_| serde_json::json!({}));

                search_results.push(SearchResult {
                    service_id,
                    data: service_data,
                    total_score: relevance_score,
                    fulltext_score: 0.0,
                    trigram_score: 0.0,
                    recency_score: 0.0,
                    category_score: 0.0,
                    search_method: "gps_optimized".to_string(),
                    matched_fields: vec!["gps".to_string()],
                });
                
                log_info(&format!("[NativeSearch] Service {} trouvé à {:.2}km (source: {})", 
                    service_id, 
                    _distance_km.unwrap_or(0.0), 
                    _gps_source.unwrap_or_else(|| "unknown".to_string())));
            }
            
            log_info(&format!("[NativeSearch] Recherche GPS optimisée: {} résultats trouvés", search_results.len()));
            return Ok(search_results);
        }
        
        // Fallback vers l'ancienne méthode si pas de GPS
        let partial_conditions = self.create_partial_match_conditions(query);
        
        let sql = format!(r#"
SELECT DISTINCT
                s.id,
                s.data,
                s.created_at,
                s.user_id,
                s.gps,
                s.category,
                (
                    -- Score principal basé sur ts_rank avec pondération équilibrée
                    (
                        ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', $1)) * 6.0 +
                        ts_rank(to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')), plainto_tsquery('french', $1)) * 3.0 +
                        ts_rank(to_tsvector('french', COALESCE(s.data->'category'->>'valeur', '')), plainto_tsquery('french', $1)) * 4.0
                    ) +
                    -- Score avec unaccent pour gestion des accents
                    (
                        ts_rank(to_tsvector('french', unaccent(COALESCE(s.data->'titre_service'->>'valeur', ''))), plainto_tsquery('french', unaccent($1))) * 5.0 +
                        ts_rank(to_tsvector('french', unaccent(COALESCE(s.data->'description'->>'valeur', ''))), plainto_tsquery('french', unaccent($1))) * 2.5 +
                        ts_rank(to_tsvector('french', unaccent(COALESCE(s.data->'category'->>'valeur', ''))), plainto_tsquery('french', unaccent($1))) * 3.5
                    ) +
                    -- Bonus pour correspondances exactes avec priorité titre
                    CASE 
                        WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' THEN 8.0
                        WHEN s.data->'description'->>'valeur' ILIKE '%' || $1 || '%' THEN 4.0
                        WHEN s.data->'category'->>'valeur' ILIKE '%' || $1 || '%' THEN 5.0
                        ELSE 0.0
                    END +
                    -- Bonus pour correspondances sans accents
                    CASE 
                        WHEN unaccent(s.data->'titre_service'->>'valeur') ILIKE '%' || unaccent($1) || '%' THEN 6.0
                        WHEN unaccent(s.data->'description'->>'valeur') ILIKE '%' || unaccent($1) || '%' THEN 3.0
                        WHEN unaccent(s.data->'category'->>'valeur') ILIKE '%' || unaccent($1) || '%' THEN 4.0
                    END +
                    -- Bonus pour correspondances partielles intelligentes
                    CASE 
                        WHEN ({}) THEN 2.0
                        ELSE 0.0
                    END +
                    -- Bonus pour correspondance de mots individuels avec priorité titre
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || word || '%' THEN 4.0
                                WHEN s.data->'description'->>'valeur' ILIKE '%' || word || '%' THEN 2.0
                                WHEN s.data->'category'->>'valeur' ILIKE '%' || word || '%' THEN 3.0
                                ELSE 0.0
                            END
                        ), 0.0)
                        FROM unnest(string_to_array($1, ' ')) AS word
                    ) +
                    -- Bonus pour correspondances multiples (titre + description)
                    CASE 
                        WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' 
                             AND s.data->'description'->>'valeur' ILIKE '%' || $1 || '%'
                        THEN 3.0
                        WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' 
                             AND s.data->'category'->>'valeur' ILIKE '%' || $1 || '%'
                        THEN 2.0
                        ELSE 0.0
                    END +
                    -- Bonus pour correspondances dans plusieurs champs (pertinence élevée)
                    CASE 
                        WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' 
                             AND s.data->'description'->>'valeur' ILIKE '%' || $1 || '%'
                             AND s.data->'category'->>'valeur' ILIKE '%' || $1 || '%'
                        THEN 5.0
                        ELSE 0.0
                    END +
                    -- Pénalité pour correspondances uniquement dans la description (moins pertinent)
                    CASE 
                        WHEN s.data->'titre_service'->>'valeur' NOT ILIKE '%' || $1 || '%' 
                             AND s.data->'description'->>'valeur' ILIKE '%' || $1 || '%'
                             AND s.data->'category'->>'valeur' NOT ILIKE '%' || $1 || '%'
                        THEN -1.0
                        ELSE 0.0
                    END +
                    -- Logique de scoring simplifiée et efficace
                    CASE 
                        -- Bonus pour correspondance exacte dans le titre (le plus important)
                        WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%'
                        THEN 2.0
                        ELSE 0.0
                    END
                )::REAL as fulltext_score
            FROM services s
            WHERE s.is_active = true
            AND ({})
            AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
            AND ($3::text IS NULL OR s.gps ILIKE '%' || $3 || '%')
            ORDER BY fulltext_score DESC
            LIMIT $4
        "#, partial_conditions, partial_conditions);

        let results = sqlx::query(&sql)
            .bind(query)
            .bind(category_filter)
            .bind(location_filter)
            .bind(self.config.general.max_results)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                log_error(&format!("[NativeSearch] Erreur recherche full-text: {}", e));
                crate::core::types::AppError::Internal(format!("Erreur recherche full-text: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get("id");
            let data: Value = row.get("data");
            let _created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let _user_id: i32 = row.get("user_id");
            let _gps: Option<String> = row.get("gps");
            let _category: Option<String> = row.get("category");
            // Gérer le cas où fulltext_score peut être NULL
            let fulltext_score: f32 = row.try_get("fulltext_score").unwrap_or(0.0);

            search_results.push(SearchResult {
                service_id,
                data,
                total_score: fulltext_score,
                fulltext_score,
                trigram_score: 0.0,
                recency_score: 0.0,
                category_score: 0.0,
                search_method: "fulltext".to_string(),
                matched_fields: vec!["fulltext".to_string()],
            });
        }

        Ok(search_results)
    }

    /// Recherche trigram pour fallback et fautes de frappe
    #[allow(dead_code)]
    async fn trigram_search(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
    ) -> AppResult<Vec<SearchResult>> {
        // Appeler la nouvelle méthode avec GPS désactivé
        self.trigram_search_with_gps(query, category_filter, location_filter, None, None).await
    }

    /// Recherche trigram avec filtrage GPS
    async fn trigram_search_with_gps(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
    ) -> AppResult<Vec<SearchResult>> {
        // Utiliser notre fonction PostgreSQL optimisée si GPS est fourni
        if let Some(gps_zone) = gps_zone {
            let radius = search_radius_km.unwrap_or(50);
            
            log_info(&format!("[NativeSearch] Trigram avec GPS optimisé: {} et rayon: {}km", gps_zone, radius));
            
            // Appeler notre fonction PostgreSQL optimisée
            let sql = r#"
                SELECT 
                    service_id,
                    titre_service,
                    category,
                    gps_coords,
                    distance_km,
                    relevance_score,
                    gps_source
                FROM search_services_gps_final($1, $2, $3, $4)
            "#;
            
            let results = sqlx::query(sql)
                .bind(query)
                .bind(gps_zone)
                .bind(radius)
                .bind(self.config.general.max_results)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    log_error(&format!("[NativeSearch] Erreur trigram GPS optimisé: {}", e));
                    crate::core::types::AppError::Internal(format!("Erreur trigram GPS optimisé: {}", e))
                })?;

            let mut search_results = Vec::new();
            for row in results {
                let service_id: i32 = row.get("service_id");
                let _titre_service: String = row.get("titre_service");
                let _category: Option<String> = row.get("category");
                let _gps_coords: Option<String> = row.get("gps_coords");
                let _distance_km: Option<f64> = row.get("distance_km");
                let relevance_score: f32 = row.get("relevance_score");
                let _gps_source: Option<String> = row.get("gps_source");
                
                // Récupérer les données complètes du service
                let service_data = sqlx::query("SELECT data FROM services WHERE id = $1")
                    .bind(service_id)
                    .fetch_one(&self.pool)
                    .await
                    .map(|row| row.get::<Value, _>("data"))
                    .unwrap_or_else(|_| serde_json::json!({}));

                search_results.push(SearchResult {
                    service_id,
                    data: service_data,
                    total_score: relevance_score,
                    fulltext_score: 0.0,
                    trigram_score: relevance_score,
                    recency_score: 0.0,
                    category_score: 0.0,
                    search_method: "trigram_gps_optimized".to_string(),
                    matched_fields: vec!["trigram".to_string(), "gps".to_string()],
                });
            }
            
            return Ok(search_results);
        }
        
        // Fallback vers l'ancienne méthode si pas de GPS
        let sql = r#"
            SELECT DISTINCT
                s.id,
                s.data,
                s.created_at,
                s.user_id,
                s.gps,
                s.category,
                GREATEST(
                    similarity(COALESCE(s.data->'titre_service'->>'valeur', ''), $1),
                    similarity(COALESCE(s.data->'description'->>'valeur', ''), $1),
                    similarity(COALESCE(s.data->'category'->>'valeur', ''), $1)
                )::REAL as trigram_score
            FROM services s
            WHERE s.is_active = true
            AND (
                similarity(COALESCE(s.data->'titre_service'->>'valeur', ''), $1) > 0.1
                OR similarity(COALESCE(s.data->'description'->>'valeur', ''), $1) > 0.1
                OR similarity(COALESCE(s.data->'category'->>'valeur', ''), $1) > 0.1
            )
            AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
            AND ($3::text IS NULL OR s.gps ILIKE '%' || $3 || '%')
            ORDER BY trigram_score DESC
            LIMIT $4
        "#;

        let results = sqlx::query(sql)
            .bind(query)
            .bind(category_filter)
            .bind(location_filter)
            .bind(self.config.general.max_results)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                log_error(&format!("[NativeSearch] Erreur recherche trigram: {}", e));
                crate::core::types::AppError::Internal(format!("Erreur recherche trigram: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get("id");
            let data: Value = row.get("data");
            let _created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let _user_id: i32 = row.get("user_id");
            let _gps: Option<String> = row.get("gps");
            let _category: Option<String> = row.get("category");
            // Gérer le cas où trigram_score peut être NULL
            let trigram_score: f32 = row.try_get("trigram_score").unwrap_or(0.0);

            search_results.push(SearchResult {
                service_id,
                data,
                total_score: trigram_score,
                fulltext_score: 0.0,
                trigram_score,
                recency_score: 0.0,
                category_score: 0.0,
                search_method: "trigram".to_string(),
                matched_fields: vec!["trigram".to_string()],
            });
        }

        Ok(search_results)
    }

    /// Recherche par mots clés individuels pour fallback
    #[allow(dead_code)]
    async fn keyword_search(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
    ) -> AppResult<Vec<SearchResult>> {
        // Appeler la nouvelle méthode avec GPS désactivé
        self.keyword_search_with_gps(query, category_filter, location_filter, None, None).await
    }

    /// Recherche par mots clés individuels avec filtrage GPS
    async fn keyword_search_with_gps(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
    ) -> AppResult<Vec<SearchResult>> {
        // Utiliser notre fonction PostgreSQL optimisée si GPS est fourni
        if let Some(gps_zone) = gps_zone {
            let radius = search_radius_km.unwrap_or(50);
            
            log_info(&format!("[NativeSearch] Mots-clés avec GPS optimisé: {} et rayon: {}km", gps_zone, radius));
            
            // Appeler notre fonction PostgreSQL optimisée
            let sql = r#"
                SELECT 
                    service_id,
                    titre_service,
                    category,
                    gps_coords,
                    distance_km,
                    relevance_score,
                    gps_source
                FROM search_services_gps_final($1, $2, $3, $4)
            "#;
            
            let results = sqlx::query(sql)
                .bind(query)
                .bind(gps_zone)
                .bind(radius)
                .bind(self.config.general.max_results / 2)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    log_error(&format!("[NativeSearch] Erreur mots-clés GPS optimisé: {}", e));
                    crate::core::types::AppError::Internal(format!("Erreur mots-clés GPS optimisé: {}", e))
                })?;

            let mut search_results = Vec::new();
            for row in results {
                let service_id: i32 = row.get("service_id");
                let _titre_service: String = row.get("titre_service");
                let _category: Option<String> = row.get("category");
                let _gps_coords: Option<String> = row.get("gps_coords");
                let _distance_km: Option<f64> = row.get("distance_km");
                let relevance_score: f32 = row.get("relevance_score");
                let _gps_source: Option<String> = row.get("gps_source");
                
                // Récupérer les données complètes du service
                let service_data = sqlx::query("SELECT data FROM services WHERE id = $1")
                    .bind(service_id)
                    .fetch_one(&self.pool)
                    .await
                    .map(|row| row.get::<Value, _>("data"))
                    .unwrap_or_else(|_| serde_json::json!({}));

                search_results.push(SearchResult {
                    service_id,
                    data: service_data,
                    total_score: relevance_score,
                    fulltext_score: 0.0,
                    trigram_score: 0.0,
                    recency_score: 0.0,
                    category_score: relevance_score,
                    search_method: "keywords_gps_optimized".to_string(),
                    matched_fields: vec!["keywords".to_string(), "gps".to_string()],
                });
            }
            
            return Ok(search_results);
        }
        
        // Fallback vers l'ancienne méthode si pas de GPS
        let words: Vec<&str> = query.split_whitespace().collect();
        if words.is_empty() {
            return Ok(Vec::new());
        }

        // Créer une requête qui matche au moins un mot clé
        let mut conditions = Vec::new();
        for word in words {
            conditions.push(format!(
                "s.data->'titre_service'->>'valeur' ILIKE '%{}%' OR s.data->'description'->>'valeur' ILIKE '%{}%' OR s.data->'category'->>'valeur' ILIKE '%{}%'",
                word, word, word
            ));
            
            // Ajouter variantes sans accents
            let without_accents = word
                .chars()
                .map(|c| match c {
                    'à' | 'â' | 'ä' => 'a',
                    'é' | 'è' | 'ê' | 'ë' => 'e',
                    'î' | 'ï' => 'i',
                    'ô' | 'ö' => 'o',
                    'ù' | 'û' | 'ü' => 'u',
                    'ÿ' => 'y',
                    'ç' => 'c',
                    _ => c,
                })
                .collect::<String>();
            
            if without_accents != word {
                conditions.push(format!(
                    "s.data->'titre_service'->>'valeur' ILIKE '%{}%' OR s.data->'description'->>'valeur' ILIKE '%{}%' OR s.data->'category'->>'valeur' ILIKE '%{}%'",
                    without_accents, without_accents, without_accents
                ));
            }
        }

        let sql = format!(r#"
            SELECT 
                s.id,
                s.data,
                s.created_at,
                s.user_id,
                s.gps,
                s.category,
                (
                    -- Score basé sur le nombre de mots clés trouvés
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || word || '%' THEN 3.0
                                WHEN s.data->'description'->>'valeur' ILIKE '%' || word || '%' THEN 2.0
                                WHEN s.data->'category'->>'valeur' ILIKE '%' || word || '%' THEN 2.5
                                ELSE 0.0
                            END
                        ), 0.0)
                        FROM unnest(string_to_array($1, ' ')) AS word
                    ) * 0.5
                )::REAL as keyword_score
            FROM services s
            WHERE s.is_active = true
            AND ({})
            AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
            AND ($3::text IS NULL OR s.gps ILIKE '%' || $3 || '%')
            ORDER BY keyword_score DESC
            LIMIT $4
        "#, conditions.join(" OR "));

        let results = sqlx::query(&sql)
            .bind(query)
            .bind(category_filter)
            .bind(location_filter)
            .bind(self.config.general.max_results / 2)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                log_error(&format!("[NativeSearch] Erreur recherche par mots clés: {}", e));
                crate::core::types::AppError::Internal(format!("Erreur recherche par mots clés: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get("id");
            let data: Value = row.get("data");
            let _created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let _user_id: i32 = row.get("user_id");
            let _gps: Option<String> = row.get("gps");
            let _category: Option<String> = row.get("category");
            // Gérer le cas où keyword_score peut être NULL
            let keyword_score: f32 = row.try_get("keyword_score").unwrap_or(0.0);

            search_results.push(SearchResult {
                service_id,
                data,
                total_score: keyword_score,
                fulltext_score: 0.0,
                trigram_score: 0.0,
                recency_score: 0.0,
                category_score: keyword_score,
                search_method: "keywords".to_string(),
                matched_fields: vec!["keywords".to_string()],
            });
        }

        Ok(search_results)
    }

    /// Calcul du score de récence
    fn calculate_recency_score(&self, created_at: chrono::DateTime<chrono::Utc>) -> f32 {
        let now = chrono::Utc::now();
        let days_old = now.signed_duration_since(created_at).num_days();
        
        if days_old <= self.config.scoring.recency_days {
            self.config.scoring.recency_boost
        } else {
            0.0
        }
    }

    /// Normalisation avancée avec gestion des accents et variantes
    fn normalize_query_advanced(&self, query: &str) -> String {
        // Normalisation de base
        let normalized = query
            .to_lowercase()
            .trim()
            .replace(|c: char| !c.is_alphanumeric() && c != ' ', " ");
        
        // Créer des variantes avec et sans accents
        let words: Vec<String> = normalized
            .split_whitespace()
            .flat_map(|word| self.create_word_variants(word))
            .collect();
        
        words.join(" ")
    }

    /// Créer des variantes de mots avec et sans accents
    fn create_word_variants(&self, word: &str) -> Vec<String> {
        let mut variants = vec![word.to_string()];
        
        // Variantes sans accents
        let without_accents = word
            .chars()
            .map(|c| match c {
                'à' | 'â' | 'ä' => 'a',
                'é' | 'è' | 'ê' | 'ë' => 'e',
                'î' | 'ï' => 'i',
                'ô' | 'ö' => 'o',
                'ù' | 'û' | 'ü' => 'u',
                'ÿ' => 'y',
                'ç' => 'c',
                _ => c,
            })
            .collect::<String>();
        
        if without_accents != word {
            variants.push(without_accents);
        }
        
        // Variantes avec accents (pour les mots sans accents)
        if !word.chars().any(|c| "àâäéèêëîïôöùûüÿç".contains(c)) {
            let with_accents = word
                .replace("a", "aàâä")
                .replace("e", "eéèêë")
                .replace("i", "iîï")
                .replace("o", "oôö")
                .replace("u", "uùûü")
                .replace("y", "yÿ")
                .replace("c", "cç");
            
            // Ajouter seulement si le mot original n'a pas d'accents
            if with_accents != word {
                variants.push(with_accents);
            }
        }
        
        variants
    }

    /// Créer une requête SQL avec correspondances partielles intelligentes
    fn create_partial_match_conditions(&self, query: &str) -> String {
        let words: Vec<&str> = query.split_whitespace().collect();
        let mut conditions = Vec::new();
        
        for word in words {
            // Correspondances exactes
            conditions.push(format!(
                "s.data->'titre_service'->>'valeur' ILIKE '%{}%' OR s.data->'description'->>'valeur' ILIKE '%{}%' OR s.data->'category'->>'valeur' ILIKE '%{}%'",
                word, word, word
            ));
            
            // Correspondances sans accents (uniquement si le mot a des accents)
            let without_accents = word
                .chars()
                .map(|c| match c {
                    'à' | 'â' | 'ä' => 'a',
                    'é' | 'è' | 'ê' | 'ë' => 'e',
                    'î' | 'ï' => 'i',
                    'ô' | 'ö' => 'o',
                    'ù' | 'û' | 'ü' => 'u',
                    'ÿ' => 'y',
                    'ç' => 'c',
                    _ => c,
                })
                .collect::<String>();
            
            if without_accents != word {
                conditions.push(format!(
                    "unaccent(s.data->'titre_service'->>'valeur') ILIKE '%{}%' OR unaccent(s.data->'description'->>'valeur') ILIKE '%{}%' OR unaccent(s.data->'category'->>'valeur') ILIKE '%{}%'",
                    without_accents, without_accents, without_accents
                ));
            }
            
            // Correspondances bidirectionnelles : mot sans accents dans base avec accents
            conditions.push(format!(
                "unaccent(s.data->'titre_service'->>'valeur') ILIKE '%{}%' OR unaccent(s.data->'description'->>'valeur') ILIKE '%{}%' OR unaccent(s.data->'category'->>'valeur') ILIKE '%{}%'",
                word, word, word
            ));
            
            // Correspondances partielles pour mots longs (ex: "gestionnaire" -> "gestion")
            let chars: Vec<char> = word.chars().collect();
            if chars.len() > 4 {
                // Prendre seulement les 4 premiers caractères pour éviter trop de correspondances
                let substring: String = chars[..4].iter().collect();
                conditions.push(format!(
                    "s.data->'titre_service'->>'valeur' ILIKE '%{}%' OR s.data->'description'->>'valeur' ILIKE '%{}%' OR s.data->'category'->>'valeur' ILIKE '%{}%'",
                    substring, substring, substring
                ));
            }
        }
        
        conditions.join(" OR ")
    }

    /// Recherche par catégorie spécifique
    pub async fn search_by_category(&self, category: &str) -> AppResult<Vec<SearchResult>> {
                       let sql = r#"
                   SELECT 
                       s.id,
                       s.data,
                       s.created_at,
                       s.user_id,
                       s.gps,
                       s.category
                   FROM services s
                   WHERE s.is_active = true
                   AND (
                       s.category = $1 
                       OR s.data->'category'->>'valeur' = $1
                   )
                   ORDER BY s.created_at DESC
                   LIMIT $2
               "#;

        let results = sqlx::query(sql)
            .bind(category)
            .bind(self.config.general.max_results)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                log_error(&format!("[NativeSearch] Erreur recherche par catégorie: {}", e));
                crate::core::types::AppError::Internal(format!("Erreur recherche par catégorie: {}", e))
            })?;

        let mut search_results = Vec::new();
                       for row in results {
                   let service_id: i32 = row.get("id");
                   let data: Value = row.get("data");
                   let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
                   let _user_id: i32 = row.get("user_id");
                   let _gps: Option<String> = row.get("gps");
                   let _category: Option<String> = row.get("category");
                   
                   let recency_score = self.calculate_recency_score(created_at);
                   
                   search_results.push(SearchResult {
                       service_id,
                       data,
                       total_score: 1.0 + recency_score,
                       fulltext_score: 0.0,
                       trigram_score: 0.0,
                       recency_score,
                       category_score: 1.0,
                       search_method: "category".to_string(),
                       matched_fields: vec!["category".to_string()],
                   });
               }

        Ok(search_results)
    }

    /// Recherche géospatiale intelligente avec calcul de distance
    pub async fn search_by_location(
        &self, 
        location: &str,
        user_lat: Option<f64>,
        user_lng: Option<f64>
    ) -> AppResult<Vec<SearchResult>> {
        let sql = if let (Some(_lat), Some(_lng)) = (user_lat, user_lng) {
            // Recherche avec calcul de distance géographique
            r#"
                SELECT 
                    s.id,
                    s.data,
                    s.created_at,
                    s.user_id,
                    s.gps,
                    s.category,
                    CASE 
                        WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN
                            -- Utilise gps_fixe si disponible
                            similarity(s.data->>'gps_fixe', $1) * 2.0 +
                            CASE 
                                WHEN s.data->>'gps_fixe' ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                    -- Calcul de distance si coordonnées valides
                                    GREATEST(0, 10 - (
                                        SQRT(
                                            POW(CAST(SPLIT_PART(s.data->>'gps_fixe', ',', 1) AS DECIMAL) - $2, 2) +
                                            POW(CAST(SPLIT_PART(s.data->>'gps_fixe', ',', 2) AS DECIMAL) - $3, 2)
                                        ) * 111000
                                    ))
                                ELSE 0
                            END
                        ELSE
                            -- Utilise la localisation du prestataire (gps)
                            similarity(s.gps, $1) * 1.5 +
                            CASE 
                                WHEN s.gps ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                    -- Calcul de distance si coordonnées valides
                                    GREATEST(0, 10 - (
                                        SQRT(
                                            POW(CAST(SPLIT_PART(s.gps, ',', 1) AS DECIMAL) - $2, 2) +
                                            POW(CAST(SPLIT_PART(s.gps, ',', 2) AS DECIMAL) - $3, 2)
                                        ) * 111000
                                    ))
                                ELSE 0
                            END
                    END::REAL as location_score
                FROM services s
                WHERE s.is_active = true
                AND (
                    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
                    (s.gps IS NOT NULL AND s.gps != '')
                )
                AND (
                    s.data->>'gps_fixe' % $1 OR s.gps % $1 OR
                    s.data->>'gps_fixe' ILIKE '%' || $1 || '%' OR s.gps ILIKE '%' || $1 || '%'
                )
                ORDER BY location_score DESC, s.created_at DESC
                LIMIT $4
            "#
        } else {
            // Recherche simple sans coordonnées
            r#"
                SELECT 
                    s.id,
                    s.data,
                    s.created_at,
                    s.user_id,
                    s.gps,
                    s.category,
                    GREATEST(
                        similarity(COALESCE(s.data->>'gps_fixe', ''), $1),
                        similarity(COALESCE(s.gps, ''), $1)
                    )::REAL as location_score
                FROM services s
                WHERE s.is_active = true
                AND (
                    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
                    (s.gps IS NOT NULL AND s.gps != '')
                )
                AND (
                    s.data->>'gps_fixe' % $1 OR s.gps % $1 OR
                    s.data->>'gps_fixe' ILIKE '%' || $1 || '%' OR s.gps ILIKE '%' || $1 || '%'
                )
                ORDER BY location_score DESC, s.created_at DESC
                LIMIT $2
            "#
        };

        let results = if let (Some(lat), Some(lng)) = (user_lat, user_lng) {
            sqlx::query(sql)
                .bind(location)
                .bind(lat)
                .bind(lng)
                .bind(self.config.general.max_results)
                .fetch_all(&self.pool)
                .await
        } else {
            sqlx::query(sql)
                .bind(location)
                .bind(self.config.general.max_results)
                .fetch_all(&self.pool)
                .await
        }.map_err(|e| {
            log_error(&format!("[NativeSearch] Erreur recherche géospatiale: {}", e));
            crate::core::types::AppError::Internal(format!("Erreur recherche géospatiale: {}", e))
        })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get("id");
            let data: Value = row.get("data");
            let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let _user_id: i32 = row.get("user_id");
            let _gps: Option<String> = row.get("gps");
            let _category: Option<String> = row.get("category");
            let location_score: f32 = row.get("location_score");
            
            let recency_score = self.calculate_recency_score(created_at);
            
            search_results.push(SearchResult {
                service_id,
                data,
                total_score: location_score + recency_score,
                fulltext_score: 0.0,
                trigram_score: location_score,
                recency_score,
                category_score: 0.0,
                search_method: "geospatial".to_string(),
                matched_fields: vec!["geospatial".to_string()],
            });
        }

        Ok(search_results)
    }
}

/// Conversion des résultats de recherche en format JSON pour l'API
impl SearchResult {
    pub fn to_json(&self) -> Value {
        serde_json::json!({
            "service_id": self.service_id,
            "data": self.data,
            "score": self.total_score,
            "semantic_score": self.total_score, // Compatibilité avec l'ancien format
            "interaction_score": 0.0,
            "gps": self.data.get("gps").and_then(|v| v.as_str()),
            "search_metadata": {
                "method": self.search_method,
                "fulltext_score": self.fulltext_score,
                "trigram_score": self.trigram_score,
                "recency_score": self.recency_score,
                "category_score": self.category_score,
                "matched_fields": self.matched_fields
            }
        })
    }
} 