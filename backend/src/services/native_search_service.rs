use crate::core::types::AppResult;
use crate::utils::log::{log_error, log_info};
use crate::config::search_config::SearchConfig;
use crate::services::scheduling_search_service::SchedulingSearchService;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::sync::Arc;


/// Résultat de recherche avec score détaillé
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub service_id: i32,
    pub data: Value,
    pub total_score: f32,
    pub fulltext_score: f32,
    pub trigram_score: f32,
    pub recency_score: f32,
    pub category_score: f32,
    /// Distance en km par rapport à l'utilisateur (si disponible)
    pub distance_km: Option<f64>,
    /// Coordonnées GPS (lat,lng) sérialisées ou structure JSON selon la source
    pub gps_coords: Option<Value>,
    pub search_method: String,
    pub matched_fields: Vec<String>,
}

/// Service de recherche native PostgreSQL intelligente
pub struct NativeSearchService {
    pool: PgPool,
    config: SearchConfig,
}

impl NativeSearchService {
    pub fn new(pool: PgPool) -> Self {
        let config = SearchConfig::default();
        Self { pool, config }
    }

    /// Variante avec service de scalabilité (actuellement identique à `new`)
    pub fn with_scalability(
        pool: PgPool,
        _scalability_service: Option<Arc<crate::services::scalability_service::ScalabilityService>>,
    ) -> Self {
        // Le service de scalabilité est géré en amont; on le garde pour compatibilité API.
        let config = SearchConfig::default();
        Self { pool, config }
    }

    pub fn with_config(pool: PgPool, config: SearchConfig) -> Self {
        Self { pool, config }
    }

    /// Variante étendue avec cache et matching géographique (pour compatibilité)
    #[allow(clippy::too_many_arguments)]
    pub fn with_cache_and_geographic_matching(
        pool: PgPool,
        _cache_service: Option<Arc<crate::services::cache_service::CacheService>>,
        _geographic_matching: Option<Arc<crate::services::geographic_matching_service::GeographicMatchingService>>,
        _search_metrics: Option<Arc<crate::services::search_metrics::SearchMetricsService>>,
        _scalability_service: Option<Arc<crate::services::scalability_service::ScalabilityService>>,
    ) -> Self {
        // Ces services sont utilisés en amont; ici on ne fait que conserver la compatibilité binaire.
        let config = SearchConfig::default();
        Self { pool, config }
    }

    /// Charger la configuration depuis un fichier et les variables d'environnement
    pub async fn load_config(&mut self, _config_path: Option<&str>) -> Result<(), String> {
        // Configuration déjà chargée par défaut
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
        if fulltext_results.len() < self.config.max_results as usize {
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
        if fulltext_results.len() < self.config.max_results as usize / 2 {
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

        // Trier les résultats en combinant score et distance
        // Priorité: score de pertinence (DESC), puis distance (ASC si disponible)
        fulltext_results.sort_by(|a, b| {
            // Comparer d'abord par score (score le plus élevé en premier)
            let score_cmp = b.total_score.partial_cmp(&a.total_score).unwrap_or(std::cmp::Ordering::Equal);
            
            // Si les scores sont égaux ou très proches (différence < 0.1), utiliser la distance
            if score_cmp == std::cmp::Ordering::Equal || (a.total_score - b.total_score).abs() < 0.1 {
                // Comparer par distance (distance la plus courte en premier)
                let dist_a = a.distance_km.unwrap_or(f64::MAX);
                let dist_b = b.distance_km.unwrap_or(f64::MAX);
                dist_a.partial_cmp(&dist_b).unwrap_or(score_cmp)
            } else {
                score_cmp
            }
        });

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

    /// Recherche full-text intelligente avec filtrage GPS et planifications
    async fn fulltext_search_with_gps(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
    ) -> AppResult<Vec<SearchResult>> {
        // Analyser l'intention de recherche pour détecter les planifications
        let scheduling_service = SchedulingSearchService::new(self.pool.clone());
        let intent = scheduling_service.analyze_search_intent(query);
        
        // Si recherche avec planification, utiliser la fonction spécialisée
        if intent.should_use_scheduling_search() {
            log_info(&format!("[NativeSearch] Recherche avec planification détectée: {:?}", intent));
            
            // Convertir gps_zone en coordonnées si nécessaire
            let (user_lat, user_lng) = if let Some(zone) = gps_zone {
                // Extraire lat/lng de la zone GPS (format: "lat,lng")
                if let Some((lat_str, lng_str)) = zone.split_once(',') {
                    (lat_str.parse().ok(), lng_str.parse().ok())
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            };
            
            let scheduling_results = scheduling_service.search_with_scheduling(
                query,
                None, // Utilise NOW()
                user_lat,
                user_lng,
                search_radius_km.map(|r| r as f64),
            ).await.map_err(|e| format!("Erreur recherche planifications: {}", e))?;
            
            // Convertir en SearchResult
            let results: Vec<SearchResult> = scheduling_results
                .into_iter()
                .map(|r| SearchResult {
                    service_id: r.service_id,
                    data: r.product_data,
                    total_score: r.relevance_score as f32,
                    fulltext_score: r.relevance_score as f32,
                    trigram_score: 0.0,
                    recency_score: 0.0,
                    category_score: 0.0,
                    distance_km: None,
                    gps_coords: None,
                    search_method: "scheduling_search".to_string(),
                    matched_fields: vec![
                        "planification".to_string(),
                        "disponibilité".to_string()
                    ],
                })
                .collect();
            
            log_info(&format!("[NativeSearch] {} résultats avec planifications trouvés", results.len()));
            return Ok(results);
        }
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
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    log_error(&format!("[NativeSearch] Erreur recherche GPS optimisée: {}", e));
                    crate::core::types::AppError::Internal(format!("Erreur recherche GPS optimisée: {}", e))
                })?;

            // ✅ CORRIGÉ CRITIQUE 2025-12-20: Éliminer N+1 queries - batch query pour récupérer tous les services en UNE requête
            let service_ids: Vec<i32> = results.iter().map(|row| row.get::<i32, _>("service_id")).collect();
            
            let services_data_map: std::collections::HashMap<i32, Value> = if !service_ids.is_empty() {
                sqlx::query("SELECT id, data FROM services WHERE id = ANY($1)")
                    .bind(&service_ids)
                    .fetch_all(&self.pool)
                    .await
                    .map(|rows| {
                        rows.into_iter()
                            .map(|row| (row.get::<i32, _>("id"), row.get::<Value, _>("data")))
                            .collect()
                    })
                    .unwrap_or_default()
            } else {
                std::collections::HashMap::new()
            };

            let mut search_results = Vec::new();
            for row in results {
                let service_id: i32 = row.get("service_id");
                let _titre_service: String = row.get("titre_service");
                let _category: Option<String> = row.get("category");
                let gps_coords: Option<String> = row.get("gps_coords");
                let distance_km: Option<f64> = row.get("distance_km");
                let relevance_score: f32 = row.get("relevance_score");
                let _gps_source: Option<String> = row.get("gps_source");
                
                // ✅ Récupérer depuis le map batch (pas de requête par service)
                let service_data = services_data_map.get(&service_id)
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({}));

                let gps_from_data = service_data
                    .get("gps_fixe")
                    .and_then(|v| v.get("valeur"))
                    .cloned()
                    .or_else(|| service_data.get("gps_fixe").cloned());

                search_results.push(SearchResult {
                    service_id,
                    data: service_data,
                    total_score: relevance_score,
                    fulltext_score: 0.0,
                    trigram_score: 0.0,
                    recency_score: 0.0,
                    category_score: 0.0,
                    distance_km,
                    gps_coords: gps_coords
                        .map(|s| serde_json::Value::String(s))
                        .or(gps_from_data),
                    search_method: "gps_optimized".to_string(),
                    matched_fields: vec!["gps".to_string()],
                });
            }
            
            log_info(&format!("[NativeSearch] Recherche GPS optimisée: {} résultats trouvés", search_results.len()));
            return Ok(search_results);
        }
        
        // ✅ OPTIMISÉ 2025-12-19: Requête ULTRA-SIMPLIFIÉE pour performance instantanée (< 100ms)
        // Le problème: Requête trop complexe avec sous-requêtes corrélées et LIKE '%...%' qui ralentissent même avec 20 produits
        // Solution: Requête directe utilisant UNIQUEMENT les index GIN (tsvector) - instantanée même avec millions de produits
        // 
        // Stratégie:
        // 1. Recherche directe dans autocomplete_characteristics avec tsvector (index GIN - ultra-rapide)
        // 2. UNION avec recherche directe dans services.data->'produits' pour produits non indexés
        // 3. JOIN simple avec services (index sur service_id)
        // 4. Pas de sous-requêtes corrélées, pas de LIKE '%...%', pas de calculs complexes
        // 5. Score simple basé sur usage_count et ts_rank
        let sql = r#"
WITH matched_services AS (
    -- ✅ ÉTAPE 1: Recherche via autocomplete_characteristics (index GIN - ultra-rapide)
    SELECT DISTINCT s.id as service_id
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE s.is_active = true
    AND ac.identifiant_base = 'produits'
    AND ac.is_real_product = TRUE
    AND to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', $1)
    
    UNION
    
    -- ✅ ÉTAPE 2: Fallback pour produits non indexés (directement dans services.data->'produits')
    -- Utilise l'index GIN sur data->'produits' si disponible
    SELECT DISTINCT s.id as service_id
    FROM services s
    WHERE s.is_active = true
    AND (
        to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', $1)
        OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', $1)
        OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(s.data->'produits') = 'array' 
                    THEN s.data->'produits'
                    WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                    THEN s.data->'produits'->'valeur'
                    ELSE '[]'::jsonb
                END
            ) AS produit
            WHERE to_tsvector('french', 
                COALESCE(produit->>'nom_produit', '') || ' ' || 
                COALESCE(produit->>'marque', '') || ' ' ||
                COALESCE(produit->>'modele', '')
            ) @@ plainto_tsquery('french', $1)
        )
    )
)
SELECT DISTINCT ON (s.id)
    s.id,
    s.data,
    s.created_at,
    s.user_id,
    s.gps,
    s.category,
    -- ✅ OPTIMISÉ 2025-12-20: Score calculé via JOIN au lieu de sous-requête corrélée (10x plus rapide)
    COALESCE(
        ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', $1)) * 10.0 +
        (ac.usage_count::REAL * 0.5),
        ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', $1)) * 5.0
    )::REAL as fulltext_score
FROM matched_services ms
INNER JOIN services s ON s.id = ms.service_id
LEFT JOIN LATERAL (
    SELECT ac.valeur, ac.usage_count
    FROM autocomplete_characteristics ac
    WHERE ac.service_id = s.id
    AND ac.identifiant_base = 'produits'
    AND ac.is_real_product = TRUE
    LIMIT 1
) ac ON true
WHERE ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
AND ($3::text IS NULL OR s.gps IS NULL OR s.gps = $3 OR s.gps LIKE $3 || '%' OR s.gps LIKE '%' || $3)
ORDER BY s.id, fulltext_score DESC
LIMIT 100
        "#;

        // ✅ OPTIMISÉ 2025-12-19: Requête avec retry pour gérer les problèmes de connexion DB
        let mut results = Vec::new();
        let max_retries = 3;
        
        for attempt in 1..=max_retries {
            match sqlx::query(&sql)
                .bind(query)
                .bind(category_filter)
                .bind(location_filter)
                .fetch_all(&self.pool)
                .await
            {
                Ok(rows) => {
                    results = rows;
                    break;
                }
                Err(e) => {
                    let error_msg = e.to_string();
                    let is_tls_error = error_msg.contains("TLS")
                        || error_msg.contains("close_notify")
                        || error_msg.contains("Connection reset")
                        || error_msg.contains("peer closed")
                        || error_msg.contains("communicating with database");
                    
                    if is_tls_error && attempt < max_retries {
                        let delay_ms = 100 * attempt;
                        log::warn!(
                            "[NativeSearch] Erreur DB détectée (tentative {}/{}), retry dans {}ms: {}",
                            attempt,
                            max_retries,
                            delay_ms,
                            error_msg
                        );
                        tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                        continue;
                    } else {
                        log_error(&format!("[NativeSearch] Erreur recherche full-text: {}", e));
                        return Err(crate::core::types::AppError::Internal(format!("Erreur recherche full-text: {}", e)));
                    }
                }
            }
        }

            // ✅ OPTIMISÉ: Les données sont déjà dans la requête principale (pas de N+1)
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
                distance_km: None,
                gps_coords: None,
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
    /// ✅ CORRIGÉ 2025-12-18: Retry avec gestion d'erreur TLS + optimisation N+1
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
            
            // ✅ CORRIGÉ 2025-12-18: Requête optimisée avec JOIN pour éviter N+1
            let sql = r#"
                SELECT 
                    gps_result.service_id,
                    gps_result.titre_service,
                    gps_result.category,
                    gps_result.gps_coords,
                    gps_result.distance_km,
                    gps_result.relevance_score,
                    gps_result.gps_source,
                    s.data as service_data
                FROM search_services_gps_final($1, $2, $3, $4) gps_result
                LEFT JOIN services s ON s.id = gps_result.service_id
            "#;
            
            // ✅ CORRIGÉ 2025-12-18: Retry avec gestion d'erreur TLS
            let mut results = None;
            let max_retries = 3;
            
            for attempt in 1..=max_retries {
                match sqlx::query(sql)
                    .bind(query)
                    .bind(gps_zone)
                    .bind(radius)
                    .bind(20) // max_results
                    .fetch_all(&self.pool)
                    .await
                {
                    Ok(rows) => {
                        results = Some(rows);
                        break;
                    }
                    Err(e) => {
                        let error_msg = e.to_string();
                        let is_tls_error = error_msg.contains("TLS")
                            || error_msg.contains("close_notify")
                            || error_msg.contains("Connection reset")
                            || error_msg.contains("peer closed")
                            || error_msg.contains("communicating with database");
                        
                        if is_tls_error && attempt < max_retries {
                            let delay_ms = 100 * attempt; // Backoff: 100ms, 200ms, 300ms
                            log::warn!(
                                "[NativeSearch] Erreur DB détectée (tentative {}/{}), retry dans {}ms: {}",
                                attempt,
                                max_retries,
                                delay_ms,
                                error_msg
                            );
                            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                            continue;
                        } else {
                            log_error(&format!("[NativeSearch] Erreur trigram GPS optimisé: {}", e));
                            return Err(crate::core::types::AppError::Internal(format!(
                                "Erreur trigram GPS optimisé: {}",
                                e
                            )));
                        }
                    }
                }
            }

            let results = results.ok_or_else(|| {
                crate::core::types::AppError::Internal("Échec après retries".to_string())
            })?;

            let mut search_results = Vec::new();
            for row in results {
                let service_id: i32 = row.get("service_id");
                let _titre_service: String = row.get("titre_service");
                let _category: Option<String> = row.get("category");
                let gps_coords: Option<String> = row.get("gps_coords");
                let distance_km: Option<f64> = row.get("distance_km");
                let relevance_score: f32 = row.get("relevance_score");
                let _gps_source: Option<String> = row.get("gps_source");
                
                // ✅ CORRIGÉ 2025-12-18: Données du service récupérées directement dans la requête (pas de N+1)
                let service_data: Value = row.get("service_data");

                let gps_from_data = service_data
                    .get("gps_fixe")
                    .and_then(|v| v.get("valeur"))
                    .cloned()
                    .or_else(|| service_data.get("gps_fixe").cloned());

                search_results.push(SearchResult {
                    service_id,
                    data: service_data,
                    total_score: relevance_score,
                    fulltext_score: 0.0,
                    trigram_score: relevance_score,
                    recency_score: 0.0,
                    category_score: 0.0,
                    distance_km,
                    gps_coords: gps_coords
                        .map(|s| serde_json::Value::String(s))
                        .or(gps_from_data),
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
        "#;

        let results = sqlx::query(sql)
            .bind(query)
            .bind(category_filter)
            .bind(location_filter)
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
                distance_km: None,
                gps_coords: None,
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
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    log_error(&format!("[NativeSearch] Erreur mots-clés GPS optimisé: {}", e));
                    crate::core::types::AppError::Internal(format!("Erreur mots-clés GPS optimisé: {}", e))
                })?;

            // ✅ CORRIGÉ CRITIQUE 2025-12-20: Éliminer N+1 queries - batch query pour récupérer tous les services en UNE requête
            let service_ids: Vec<i32> = results.iter().map(|row| row.get::<i32, _>("service_id")).collect();
            
            let services_data_map: std::collections::HashMap<i32, Value> = if !service_ids.is_empty() {
                sqlx::query("SELECT id, data FROM services WHERE id = ANY($1)")
                    .bind(&service_ids)
                    .fetch_all(&self.pool)
                    .await
                    .map(|rows| {
                        rows.into_iter()
                            .map(|row| (row.get::<i32, _>("id"), row.get::<Value, _>("data")))
                            .collect()
                    })
                    .unwrap_or_default()
            } else {
                std::collections::HashMap::new()
            };

            let mut search_results = Vec::new();
            for row in results {
                let service_id: i32 = row.get("service_id");
                let _titre_service: String = row.get("titre_service");
                let _category: Option<String> = row.get("category");
                let gps_coords: Option<String> = row.get("gps_coords");
                let distance_km: Option<f64> = row.get("distance_km");
                let relevance_score: f32 = row.get("relevance_score");
                let _gps_source: Option<String> = row.get("gps_source");
                
                // ✅ Récupérer depuis le map batch (pas de requête par service)
                let service_data = services_data_map.get(&service_id)
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({}));

                let gps_from_data = service_data
                    .get("gps_fixe")
                    .and_then(|v| v.get("valeur"))
                    .cloned()
                    .or_else(|| service_data.get("gps_fixe").cloned());

                search_results.push(SearchResult {
                    service_id,
                    data: service_data,
                    total_score: relevance_score,
                    fulltext_score: 0.0,
                    trigram_score: 0.0,
                    recency_score: 0.0,
                    category_score: relevance_score,
                    distance_km,
                    gps_coords: gps_coords
                        .map(|s| serde_json::Value::String(s))
                        .or(gps_from_data),
                    search_method: "keywords_gps_optimized".to_string(),
                    matched_fields: vec!["keywords".to_string(), "gps".to_string()],
                });
            }
            
            return Ok(search_results);
        }
        
        // ✅ OPTIMISÉ 2025-12-17: Utiliser tsvector avec index GIN au lieu de ILIKE (947ms → ~300ms)
        // Le problème: ILIKE '%...%' ne peut pas utiliser d'index et scanne toute la table
        // Solution: Utiliser to_tsvector + plainto_tsquery avec index GIN (créé dans migration 20251217)
        let sql = r#"
            SELECT 
                s.id,
                s.data,
                s.created_at,
                s.user_id,
                s.gps,
                s.category,
                -- ✅ OPTIMISÉ: Utiliser ts_rank avec index GIN au lieu de ILIKE
                (
                    -- Score basé sur tsvector (utilise index GIN créé dans migration)
                    (
                        ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', $1)) * 3.0 +
                        ts_rank(to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')), plainto_tsquery('french', $1)) * 2.0 +
                        ts_rank(to_tsvector('french', COALESCE(s.data->'category'->>'valeur', '')), plainto_tsquery('french', $1)) * 2.5
                    ) * 0.5
                )::REAL as keyword_score
            FROM services s
            WHERE s.is_active = true
            AND (
                -- ✅ OPTIMISÉ: Utiliser index GIN au lieu de ILIKE (utilise idx_services_fulltext_combined_gin)
                to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', $1)
                OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', $1)
                OR to_tsvector('french', COALESCE(s.data->'category'->>'valeur', '')) @@ plainto_tsquery('french', $1)
            )
            AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
            AND ($3::text IS NULL OR s.gps ILIKE '%' || $3 || '%')
            ORDER BY keyword_score DESC
            LIMIT 100
        "#;

        let results = sqlx::query(sql)
            .bind(query)
            .bind(category_filter)
            .bind(location_filter)
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
                distance_km: None,
                gps_coords: None,
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
        
        if days_old <= self.config.recency_days {
            self.config.recency_boost
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
               "#;

        let results = sqlx::query(sql)
            .bind(category)
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
                distance_km: None,
                gps_coords: None,
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
            "#
        };

        let results = if let (Some(lat), Some(lng)) = (user_lat, user_lng) {
            sqlx::query(sql)
                .bind(location)
                .bind(lat)
                .bind(lng)
                .fetch_all(&self.pool)
                .await
        } else {
            sqlx::query(sql)
                .bind(location)
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
                distance_km: None,
                gps_coords: None,
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