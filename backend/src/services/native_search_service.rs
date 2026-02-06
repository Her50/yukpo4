use crate::config::search_config::SearchConfig;
use crate::core::types::AppResult;
use crate::services::creer_service::detect_lang;
use crate::services::orchestration_ia::extract_keywords_from_text;
use crate::services::scheduling_search_service::SchedulingSearchService;
use crate::utils::log::{log_error, log_info};
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
        _geographic_matching: Option<
            Arc<crate::services::geographic_matching_service::GeographicMatchingService>,
        >,
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
        user_id: Option<i32>,
        gps_zone: Option<&str>,        // Nouveau paramètre GPS
        search_radius_km: Option<i32>, // Nouveau paramètre rayon
    ) -> AppResult<Vec<SearchResult>> {
        let start_time = std::time::Instant::now();
        log_info(&format!(
            "[NativeSearch] Début recherche: '{}' (GPS: {:?}, Rayon: {:?}km, User: {:?})",
            search_query, gps_zone, search_radius_km, user_id
        ));

        // ✅ AMÉLIORÉ 2025-12-24: Combiner user.preferred_lang avec détection automatique
        let user_preferred_lang: Option<String> = if let Some(uid) = user_id {
            // Récupérer preferred_lang depuis la base de données
            match sqlx::query_scalar::<_, Option<String>>(
                "SELECT preferred_lang FROM users WHERE id = $1",
            )
            .bind(uid)
            .fetch_optional(&self.pool)
            .await
            {
                Ok(Some(Some(lang))) if !lang.is_empty() && lang != "auto" => Some(lang),
                Ok(Some(None)) | Ok(None) => None,
                Err(_) => None,
                _ => None,
            }
        } else {
            None
        };

        // Détecter la langue de la requête
        let detected_lang = detect_lang(search_query);

        // Combiner: préférence utilisateur > détection automatique > fallback "simple"
        let final_lang = user_preferred_lang.as_deref().unwrap_or(&detected_lang);

        let pg_lang = self.map_language_to_postgres(final_lang);
        log_info(&format!(
            "[NativeSearch] Langue: user_pref={:?}, detected={}, final={} -> PostgreSQL: '{}'",
            user_preferred_lang, detected_lang, final_lang, pg_lang
        ));

        // ✅ AMÉLIORÉ 2025-12-24: Extraire les mots-clés pour filtrer les stop words
        let keywords = extract_keywords_from_text(search_query);
        let query_with_keywords = if keywords.is_empty() {
            search_query.to_string()
        } else {
            keywords.join(" ")
        };
        log_info(&format!(
            "[NativeSearch] Mots-clés extraits: '{}' -> '{}'",
            search_query, query_with_keywords
        ));

        // Normaliser la requête (variantes accents, gestion mots tronqués)
        let (normalized_query, has_wildcards) = self.normalize_query_advanced(&query_with_keywords);
        log_info(&format!(
            "[NativeSearch] Requête normalisée: '{}' -> '{}' (wildcards: {})",
            query_with_keywords, normalized_query, has_wildcards
        ));

        // ✅ CORRIGÉ 2026-01-22: Utiliser la requête originale (sans variantes) pour la recherche SQL
        // PostgreSQL unaccent() gère déjà les accents, pas besoin de variantes dans la requête SQL
        // Les variantes sont utiles pour le matching vectoriel mais pas pour ILIKE/unaccent()
        let query_for_sql = query_with_keywords.trim().to_lowercase();

        // ✅ OPTIMISÉ 2025-01-01: Utiliser keyword_search_with_gps en PRIORITÉ (fonction la plus pertinente)
        // - keyword_search_with_gps: 4.46s → 3 résultats (PERTINENTE, optimisée à ~0.3s) - PRIORITÉ
        // - fulltext_search_with_gps: 12.4ms → 0 résultats (fallback si pas assez de résultats)
        // - trigram_search_with_gps: 788ms → 0 résultats (fallback si toujours pas assez)
        //
        // Stratégie: Appeler keyword_search_with_gps en premier, puis fallback si nécessaire
        let mut fulltext_results = self
            .keyword_search_with_gps(
                &query_for_sql,
                category_filter,
                location_filter,
                gps_zone,
                search_radius_km,
            )
            .await?;

        log_info(&format!(
            "[NativeSearch] keyword_search_with_gps: {} résultats trouvés",
            fulltext_results.len()
        ));

        // ✅ FALLBACK 1: fulltext_search_with_gps si aucun résultat
        if fulltext_results.is_empty() {
            log_info(&format!(
                "[NativeSearch] Fallback fulltext_search_with_gps (0 résultats trouvés)"
            ));
            let fulltext_fallback_results = self
                .fulltext_search_with_gps_and_lang(
                    &query_for_sql,
                    category_filter,
                    location_filter,
                    gps_zone,
                    search_radius_km,
                    &pg_lang,
                    has_wildcards,
                )
                .await?;

            // Fusionner les résultats en évitant les doublons
            for result in fulltext_fallback_results {
                if !fulltext_results.iter().any(|r| r.service_id == result.service_id) {
                    fulltext_results.push(result);
                }
            }
            log_info(&format!(
                "[NativeSearch] Après fallback fulltext: {} résultats totaux",
                fulltext_results.len()
            ));
        }

        // ✅ FALLBACK 2: trigram_search_with_gps si toujours aucun résultat
        if fulltext_results.is_empty() {
            log_info(&format!(
                "[NativeSearch] Fallback trigram_search_with_gps (0 résultats trouvés)"
            ));
            let trigram_results = self
                .trigram_search_with_gps(
                    &query_for_sql,
                    category_filter,
                    location_filter,
                    gps_zone,
                    search_radius_km,
                )
                .await?;

            // Fusionner les résultats en évitant les doublons
            for result in trigram_results {
                if !fulltext_results.iter().any(|r| r.service_id == result.service_id) {
                    fulltext_results.push(result);
                }
            }
            log_info(&format!(
                "[NativeSearch] Après fallback trigram: {} résultats totaux",
                fulltext_results.len()
            ));
        }

        // Trier les résultats en combinant score et distance
        // Priorité: score de pertinence (DESC), puis distance (ASC si disponible)
        fulltext_results.sort_by(|a, b| {
            // Comparer d'abord par score (score le plus élevé en premier)
            let score_cmp =
                b.total_score.partial_cmp(&a.total_score).unwrap_or(std::cmp::Ordering::Equal);

            // Si les scores sont égaux ou très proches (différence < 0.1), utiliser la distance
            if score_cmp == std::cmp::Ordering::Equal || (a.total_score - b.total_score).abs() < 0.1
            {
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
            duration,
            fulltext_results.len(),
            gps_zone.is_some()
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
        // Appeler la nouvelle méthode avec GPS désactivé, langue par défaut, et pas de wildcards
        let (normalized, has_wildcards) = self.normalize_query_advanced(query);
        self.fulltext_search_with_gps(
            &normalized,
            category_filter,
            location_filter,
            None,
            None,
            "french",
            has_wildcards,
        )
        .await
    }

    /// ✅ NOUVEAU 2025-12-24: Recherche full-text avec langue détectée
    async fn fulltext_search_with_gps_and_lang(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        pg_lang: &str,
        has_wildcards: bool,
    ) -> AppResult<Vec<SearchResult>> {
        // ✅ CORRIGÉ 2025-12-24: Passer la langue détectée et les wildcards à la méthode de recherche
        self.fulltext_search_with_gps(
            query,
            category_filter,
            location_filter,
            gps_zone,
            search_radius_km,
            pg_lang,
            has_wildcards,
        )
        .await
    }

    /// Recherche full-text intelligente avec filtrage GPS et planifications
    async fn fulltext_search_with_gps(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        pg_lang: &str,
        has_wildcards: bool,
    ) -> AppResult<Vec<SearchResult>> {
        // Analyser l'intention de recherche pour détecter les planifications
        let scheduling_service = SchedulingSearchService::new(self.pool.clone());
        let intent = scheduling_service.analyze_search_intent(query);

        // Si recherche avec planification, utiliser la fonction spécialisée
        if intent.should_use_scheduling_search() {
            log_info(&format!(
                "[NativeSearch] Recherche avec planification détectée: {:?}",
                intent
            ));

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

            let scheduling_results = scheduling_service
                .search_with_scheduling(
                    query,
                    None, // Utilise NOW()
                    user_lat,
                    user_lng,
                    search_radius_km.map(|r| r as f64),
                )
                .await
                .map_err(|e| format!("Erreur recherche planifications: {}", e))?;

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
                    matched_fields: vec!["planification".to_string(), "disponibilité".to_string()],
                })
                .collect();

            log_info(&format!(
                "[NativeSearch] {} résultats avec planifications trouvés",
                results.len()
            ));
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
                    log_error(&format!(
                        "[NativeSearch] Erreur recherche GPS optimisée: {}",
                        e
                    ));
                    crate::core::types::AppError::Internal(format!(
                        "Erreur recherche GPS optimisée: {}",
                        e
                    ))
                })?;

            // ✅ CORRIGÉ CRITIQUE 2025-12-20: Éliminer N+1 queries - batch query pour récupérer tous les services en UNE requête
            let service_ids: Vec<i32> =
                results.iter().map(|row| row.get::<i32, _>("service_id")).collect();

            let services_data_map: std::collections::HashMap<i32, Value> =
                if !service_ids.is_empty() {
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
                let service_data = services_data_map
                    .get(&service_id)
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
                    gps_coords: gps_coords.map(|s| serde_json::Value::String(s)).or(gps_from_data),
                    search_method: "gps_optimized".to_string(),
                    matched_fields: vec!["gps".to_string()],
                });
            }

            log_info(&format!(
                "[NativeSearch] Recherche GPS optimisée: {} résultats trouvés",
                search_results.len()
            ));
            return Ok(search_results);
        }

        // ✅ OPTIMISÉ 2025-12-23: Requête ULTRA-OPTIMISÉE pour performance instantanée (< 100ms)
        // ✅ AMÉLIORÉ 2025-12-24: Support multi-langue (détection automatique)
        // Problèmes identifiés dans les logs:
        // 1. LEFT JOIN LATERAL cause 1.27s de latence (SUPPRIMÉ - remplacé par CTE)
        // 2. plainto_tsquery peut ne pas matcher les mots avec accents (AJOUT fallback ILIKE)
        // 3. Pool de connexions saturé (requête optimisée pour libérer connexions plus vite)
        // 4. Langue codée en dur 'french' (✅ CORRIGÉ 2025-12-24 - utilise langue détectée)
        //
        // Stratégie:
        // 1. Pré-calculer les données autocomplete dans une CTE (évite LEFT JOIN LATERAL)
        // 2. Ajouter fallback ILIKE pour correspondances exactes (gère les accents)
        // 3. Utiliser les index GIN tsvector créés dans les migrations
        // 4. Scoring amélioré avec bonus pour matches exacts et usage_count
        // 5. Détection automatique de langue pour to_tsvector/plainto_tsquery
        //
        // ✅ AMÉLIORÉ 2026-01-13: Matching vectoriel avec test vectoriel unique (équivalent %in% en R)
        // Utiliser extract_keywords_from_text pour filtrer les stop words de manière générique
        let keywords = extract_keywords_from_text(query);
        let search_keywords_normalized: Vec<String> =
            keywords.iter().map(|w| self.normalize_word_for_vector_matching(w)).collect();

        log_info(&format!(
            "[NativeSearch] Mots-clés extraits (après filtrage stop words): {:?} -> normalisés: {:?}", 
            keywords, search_keywords_normalized
        ));

        // ✅ OPTIMISÉ 2025-12-30: Requête ULTRA-SIMPLIFIÉE pour performance < 2s
        // Réduit de 5 CTE à 2 CTE, utilise calculate_best_vector_match_score (une seule passe)
        let sql = if !search_keywords_normalized.is_empty() {
            // Requête optimisée avec matching vectoriel simplifié
            format!(
                r#"
WITH autocomplete_matches AS (
    -- ✅ ÉTAPE 1: Filtrage rapide + calcul score en UNE SEULE PASSE (évite CROSS JOIN)
    SELECT 
        ac.service_id,
        ac.valeur,
        ac.usage_count,
        -- ✅ CALCUL SCORE EN UNE SEULE PASSE : Fonction optimisée calcule les deux scores
        calculate_best_vector_match_score(
            ac.normalized_characteristic_vector,
            ac.normalized_full_vector,
            $1::TEXT[]
        ) + (ac.usage_count::REAL * 0.5) as final_score
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    INNER JOIN service_products p ON p.id = ac.product_id::INTEGER AND p.service_id = ac.service_id
    WHERE s.is_active = true
      AND p.is_active = true
      AND ac.identifiant_base = 'produits'
      AND ac.is_real_product = TRUE
      -- ✅ FILTRE RAPIDE : && utilise index GIN sur colonnes normalisées
      AND (
          ac.normalized_characteristic_vector && $1::TEXT[]
          OR ac.normalized_full_vector && $1::TEXT[]
      )
    -- ✅ LIMIT pour éviter de traiter trop de lignes
    LIMIT 500
),
best_autocomplete_per_service AS (
    -- ✅ ÉTAPE 2: Sélectionner le meilleur match par service
    SELECT DISTINCT ON (service_id)
        service_id,
        valeur,
        final_score
    FROM autocomplete_matches
    WHERE final_score > 0
    ORDER BY service_id, final_score DESC, usage_count DESC NULLS LAST
    -- ✅ LIMIT pour éviter trop de résultats
    LIMIT 100
)
SELECT 
    s.id,
    s.data,
    s.created_at,
    s.user_id,
    s.gps,
    s.category,
    -- ✅ SCORE FINAL : Priorité au score vectoriel, puis titre/description
    GREATEST(
        -- Score depuis matching vectoriel optimisé (priorité haute)
        COALESCE(ac.final_score, 0.0),
        -- Score depuis titre/description service (priorité basse) - seulement si pas de match vectoriel
        CASE 
            WHEN ac.final_score IS NULL THEN
                COALESCE(
                    CASE WHEN LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')) = LOWER($2) THEN 50.0 ELSE 0.0 END +
                    CASE WHEN COALESCE(s.data->'titre_service'->>'valeur', '') ILIKE $2 || '%' THEN 35.0 ELSE 0.0 END +
                    CASE WHEN COALESCE(s.data->'titre_service'->>'valeur', '') ILIKE '%' || $2 || '%' THEN 25.0 ELSE 0.0 END +
                    CASE WHEN COALESCE(s.data->'description'->>'valeur', '') ILIKE '%' || $2 || '%' THEN 15.0 ELSE 0.0 END +
                    ts_rank(to_tsvector('{}', COALESCE(s.data->'titre_service'->>'valeur', '')), plainto_tsquery('{}', $2)) * 10.0 +
                    ts_rank(to_tsvector('{}', COALESCE(s.data->'description'->>'valeur', '')), plainto_tsquery('{}', $2)) * 5.0,
                    0.0
                )
            ELSE 0.0
        END
    )::REAL as fulltext_score
FROM best_autocomplete_per_service ac
INNER JOIN services s ON s.id = ac.service_id
WHERE ($3::text IS NULL OR s.category = $3 OR s.data->'category'->>'valeur' = $3)
  AND ($4::text IS NULL OR s.gps IS NULL OR s.gps = $4 OR s.gps LIKE $4 || '%' OR s.gps LIKE '%' || $4)
ORDER BY ac.final_score DESC
LIMIT 100
            "#,
                pg_lang,
                pg_lang, // ts_rank pour titre et description
                pg_lang,
                pg_lang // ts_rank pour titre et description
            )
        } else {
            // Fallback vers l'ancienne méthode si pas de mots-clés valides
            log_info("[NativeSearch] Aucun mot-clé valide, utilisation de l'ancienne méthode");
            let words: Vec<&str> = query.split_whitespace().filter(|w| w.len() >= 2).collect();
            let word_like_pattern = if words.len() > 1 {
                format!("%{}%", words.join("%"))
            } else {
                String::new()
            };

            let word_like_score = if !word_like_pattern.is_empty() {
                format!(
                    "CASE WHEN ac.valeur ILIKE '{}' THEN 50.0 ELSE 0.0 END",
                    word_like_pattern
                )
            } else {
                "0.0".to_string()
            };

            let word_like_condition_sql = if !word_like_pattern.is_empty() {
                format!("OR ac.valeur ILIKE '{}'", word_like_pattern)
            } else {
                String::new()
            };

            let wildcard_like_score = if has_wildcards {
                format!(
                    "CASE WHEN ac.valeur LIKE '{}' THEN 50.0 ELSE 0.0 END",
                    query.replace('*', "%")
                )
            } else {
                "0.0".to_string()
            };

            let wildcard_like_condition = if has_wildcards {
                format!("OR ac.valeur LIKE '{}'", query.replace('*', "%"))
            } else {
                String::new()
            };

            format!(
                r#"
WITH autocomplete_matches AS (
    -- ✅ ÉTAPE 1: Pré-calculer les matches autocomplete avec scoring (évite LEFT JOIN LATERAL)
    SELECT 
        ac.service_id,
        ac.valeur,
        ac.usage_count,
        ac.characteristic_vector,
        ac.full_vector,
        -- Score combiné pour ce match autocomplete
        (
            -- ✅ CRITIQUE 2025-12-24: PRIORISER ILIKE pour gérer accents (générique, pas spécifique)
            -- ✅ AMÉLIORÉ 2025-12-30: Scores augmentés pour recherches à un seul mot (meilleure pertinence)
            CASE WHEN LOWER(ac.valeur) = LOWER($1) THEN 100.0 ELSE 0.0 END +
            CASE WHEN ac.valeur ILIKE $1 || '%' THEN 80.0 ELSE 0.0 END +
            CASE WHEN ac.valeur ILIKE '%' || $1 || '%' THEN 60.0 ELSE 0.0 END +
            -- ✅ NOUVEAU 2025-12-30: Recherche par mots individuels (gère mots manquants comme "en")
            {} +
            -- ✅ NOUVEAU 2025-12-24: Support wildcards * avec LIKE (générique)
            {} +
            -- Recherche full-text (moins prioritaire car peut rater les accents)
            -- ✅ AMÉLIORÉ 2025-12-24: Utiliser langue détectée au lieu de 'french' en dur
            -- ✅ AMÉLIORÉ 2025-12-30: Multiplicateurs augmentés pour meilleure pertinence
            ts_rank(to_tsvector('{}', ac.valeur), plainto_tsquery('{}', $1)) * 25.0 +
            COALESCE(ts_rank(characteristic_vector_to_tsvector(ac.characteristic_vector), plainto_tsquery('{}', $1)), 0.0) * 15.0 +
            COALESCE(ts_rank(full_vector_to_tsvector(ac.full_vector), plainto_tsquery('{}', $1)), 0.0) * 12.0 +
            (ac.usage_count::REAL * 2.0)
        )::REAL as ac_score
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    INNER JOIN service_products p ON p.id = ac.product_id::INTEGER AND p.service_id = ac.service_id
    WHERE s.is_active = true
    AND p.is_active = true
    AND ac.identifiant_base = 'produits'
    AND ac.is_real_product = TRUE
    AND (
        -- ✅ CRITIQUE 2025-12-24: PRIORISER ILIKE pour gérer accents (générique, pas spécifique)
        LOWER(ac.valeur) = LOWER($1)
        OR ac.valeur ILIKE $1 || '%'
        OR ac.valeur ILIKE '%' || $1 || '%'
        -- ✅ NOUVEAU 2025-12-30: Recherche par mots individuels (gère mots manquants comme "en")
        {}
        -- ✅ NOUVEAU 2025-12-24: Support wildcards * avec LIKE (générique)
        {}
        -- Recherche full-text (fallback si ILIKE ne trouve rien)
        -- ✅ AMÉLIORÉ 2025-12-24: Utiliser langue détectée
        OR to_tsvector('{}', ac.valeur) @@ plainto_tsquery('{}', $1)
        OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery('{}', $1)
        OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery('{}', $1)
    )
),
best_autocomplete_per_service AS (
    -- ✅ ÉTAPE 2: Sélectionner le meilleur match autocomplete par service (évite LEFT JOIN LATERAL)
    SELECT DISTINCT ON (service_id)
        service_id,
        valeur,
        usage_count,
        characteristic_vector,
        full_vector,
        ac_score
    FROM autocomplete_matches
    ORDER BY service_id, ac_score DESC, usage_count DESC NULLS LAST
),
matched_services AS (
    -- ✅ ÉTAPE 3: Liste des services matchés (depuis autocomplete)
    SELECT DISTINCT service_id FROM best_autocomplete_per_service
    
    UNION
    
    -- ✅ ÉTAPE 4: Fallback pour titre/description service + recherche directe dans produits
    SELECT DISTINCT s.id as service_id
    FROM services s
    WHERE s.is_active = true
    AND (
        -- Recherche full-text dans titre/description
        -- ✅ AMÉLIORÉ 2025-12-24: Utiliser langue détectée
        to_tsvector('{}', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('{}', $1)
        OR to_tsvector('{}', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('{}', $1)
        -- ✅ CRITIQUE 2025-12-24: Fallback ILIKE PRIORITAIRE pour correspondances exactes (gère accents)
        OR COALESCE(s.data->'titre_service'->>'valeur', '') ILIKE '%' || $1 || '%'
        OR COALESCE(s.data->'description'->>'valeur', '') ILIKE '%' || $1 || '%'
        -- ✅ PHASE 3: Recherche directe dans produits via table service_products
        OR EXISTS (
            SELECT 1
            FROM service_products p
            WHERE p.service_id = s.id
            AND p.is_active = true
            AND (
                -- Recherche dans product_name (priorité haute)
                p.product_name ILIKE '%' || $1 || '%'
                OR p.product_name ILIKE $1 || '%'
                OR LOWER(p.product_name) = LOWER($1)
                -- Recherche dans description_produit depuis product_data
                OR COALESCE(p.product_data->>'description_produit', p.product_data->>'description', '') ILIKE '%' || $1 || '%'
                -- ✅ NOUVEAU 2026-01-XX: Recherche dans sous_caracteristiques (product_data->'sous_caracteristiques')
                -- Recherche dans le JSONB complet des sous-caractéristiques (fallback rapide)
                OR (p.product_data->'sous_caracteristiques')::text ILIKE '%' || $1 || '%'
                -- Recherche détaillée dans les sous-caractéristiques (si le JSONB existe)
                OR (
                    p.product_data ? 'sous_caracteristiques'
                    AND EXISTS (
                        SELECT 1
                        FROM jsonb_each(p.product_data->'sous_caracteristiques') AS sc
                        WHERE (
                            -- Recherche dans les clés (dimensions)
                            sc.key ILIKE '%' || $1 || '%'
                            OR LOWER(sc.key) = LOWER($1)
                            -- Recherche dans les valeurs (tableaux JSONB)
                            OR (
                                jsonb_typeof(sc.value) = 'array'
                                AND EXISTS (
                                    SELECT 1
                                    FROM jsonb_array_elements_text(sc.value) AS val
                                    WHERE val ILIKE '%' || $1 || '%'
                                    OR LOWER(val) = LOWER($1)
                                )
                            )
                            -- Recherche dans les valeurs (chaînes simples)
                            OR (
                                jsonb_typeof(sc.value) = 'string'
                                AND (
                                    sc.value::text ILIKE '%' || $1 || '%'
                                    OR LOWER(sc.value::text) = LOWER($1)
                                )
                            )
                        )
                    )
                )
                -- Recherche full-text dans product_name
                -- ✅ AMÉLIORÉ 2025-12-24: Utiliser langue détectée
                OR to_tsvector('{}', p.product_name) @@ plainto_tsquery('{}', $1)
            )
        )
    )
    LIMIT 100  -- Augmenté pour inclure plus de résultats produits
)
SELECT 
    ranked.id,
    ranked.data,
    ranked.created_at,
    ranked.user_id,
    ranked.gps,
    ranked.category,
    ranked.fulltext_score
FROM (
    SELECT DISTINCT ON (s.id)
        s.id,
        s.data,
        s.created_at,
        s.user_id,
        s.gps,
        s.category,
        -- ✅ OPTIMISÉ 2025-12-23: Score combiné depuis CTE (évite LEFT JOIN LATERAL)
        -- ✅ AMÉLIORÉ 2025-12-30: Utiliser directement ac_score sans normalisation excessive
        -- ✅ CORRIGÉ 2026-01-13: Pénaliser les services dont le titre matche mais les produits ne matchent pas
        (
            CASE 
                -- Si les produits matchent (priorité haute), utiliser ce score
                WHEN COALESCE(ac.ac_score, 0.0) > 0.0 THEN ac.ac_score
                -- Si seulement le titre matche mais pas les produits, réduire le score de 70% pour pénaliser
                ELSE COALESCE(
                    -- ✅ CRITIQUE 2025-12-24: PRIORISER ILIKE pour gérer accents
                    -- ✅ AMÉLIORÉ 2025-12-30: Scores augmentés pour meilleure pertinence
                    -- ✅ CORRIGÉ 2026-01-13: Réduire de 70% si pas de match produit
                    (CASE WHEN LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')) = LOWER($1) THEN 50.0 ELSE 0.0 END +
                    CASE WHEN COALESCE(s.data->'titre_service'->>'valeur', '') ILIKE $1 || '%' THEN 35.0 ELSE 0.0 END +
                    CASE WHEN COALESCE(s.data->'titre_service'->>'valeur', '') ILIKE '%' || $1 || '%' THEN 25.0 ELSE 0.0 END +
                    CASE WHEN COALESCE(s.data->'description'->>'valeur', '') ILIKE '%' || $1 || '%' THEN 15.0 ELSE 0.0 END +
                    -- Recherche full-text (fallback)
                    -- ✅ AMÉLIORÉ 2025-12-24: Utiliser langue détectée
                    -- ✅ AMÉLIORÉ 2025-12-30: Multiplicateurs augmentés
                    ts_rank(to_tsvector('{}', COALESCE(s.data->'titre_service'->>'valeur', '')), plainto_tsquery('{}', $1)) * 10.0 +
                    ts_rank(to_tsvector('{}', COALESCE(s.data->'description'->>'valeur', '')), plainto_tsquery('{}', $1)) * 5.0) * 0.3,  -- ✅ Réduction de 70% (multiplier par 0.3)
                    0.0
                )
            END
        )::REAL as fulltext_score
    FROM matched_services ms
    INNER JOIN services s ON s.id = ms.service_id
    LEFT JOIN best_autocomplete_per_service ac ON ac.service_id = s.id
    WHERE ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
    AND ($3::text IS NULL OR s.gps IS NULL OR s.gps = $3 OR s.gps LIKE $3 || '%' OR s.gps LIKE '%' || $3)
    ORDER BY s.id, fulltext_score DESC  -- DISTINCT ON nécessite s.id en premier
) ranked
ORDER BY ranked.fulltext_score DESC
LIMIT 100
        "#,
                word_like_score, // ligne 451: word LIKE score (recherche par mots individuels)
                wildcard_like_score, // ligne 452: wildcard LIKE score
                pg_lang,
                pg_lang, // ligne 455: ts_rank to_tsvector + plainto_tsquery (2)
                pg_lang, // ligne 456: plainto_tsquery seulement (1)
                pg_lang, // ligne 457: plainto_tsquery seulement (1)
                word_like_condition_sql, // ligne 470: word LIKE condition (recherche par mots individuels)
                wildcard_like_condition, // ligne 471: wildcard LIKE condition
                pg_lang,
                pg_lang, // ligne 474: to_tsvector + plainto_tsquery (2)
                pg_lang, // ligne 475: plainto_tsquery seulement (1)
                pg_lang, // ligne 476: plainto_tsquery seulement (1)
                pg_lang,
                pg_lang, // ligne 503: titre_service (2)
                pg_lang,
                pg_lang, // ligne 504: description (2)
                pg_lang,
                pg_lang, // ligne 529: nom_produit (2)
                pg_lang,
                pg_lang, // ligne 564: titre_service ts_rank (2)
                pg_lang,
                pg_lang // ligne 565: description ts_rank (2)
            )
        };

        // ✅ OPTIMISÉ 2025-12-19: Requête avec retry pour gérer les problèmes de connexion DB
        let mut results = Vec::new();
        let max_retries = 3;

        for attempt in 1..=max_retries {
            let query_result = if !search_keywords_normalized.is_empty() {
                // ✅ NOUVEAU 2025-12-30: Requête optimisée avec matching vectoriel
                // Passer tableau de mots-clés normalisés comme premier paramètre
                sqlx::query(&sql)
                    .bind(&search_keywords_normalized[..]) // $1: tableau de mots-clés normalisés
                    .bind(query) // $2: requête originale pour fallback
                    .bind(category_filter) // $3: filtre catégorie
                    .bind(location_filter) // $4: filtre localisation
                    .fetch_all(&self.pool)
                    .await
            } else {
                // Requête de fallback : paramètres classiques
                sqlx::query(&sql)
                    .bind(query) // $1: requête
                    .bind(category_filter) // $2: filtre catégorie
                    .bind(location_filter) // $3: filtre localisation
                    .fetch_all(&self.pool)
                    .await
            };

            match query_result {
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
                        return Err(crate::core::types::AppError::Internal(format!(
                            "Erreur recherche full-text: {}",
                            e
                        )));
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
        self.trigram_search_with_gps(query, category_filter, location_filter, None, None)
            .await
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

            log_info(&format!(
                "[NativeSearch] Trigram avec GPS optimisé: {} et rayon: {}km",
                gps_zone, radius
            ));

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
                            log_error(&format!(
                                "[NativeSearch] Erreur trigram GPS optimisé: {}",
                                e
                            ));
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
                    gps_coords: gps_coords.map(|s| serde_json::Value::String(s)).or(gps_from_data),
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
        self.keyword_search_with_gps(query, category_filter, location_filter, None, None)
            .await
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

            log_info(&format!(
                "[NativeSearch] Mots-clés avec GPS optimisé: {} et rayon: {}km",
                gps_zone, radius
            ));

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
                    log_error(&format!(
                        "[NativeSearch] Erreur mots-clés GPS optimisé: {}",
                        e
                    ));
                    crate::core::types::AppError::Internal(format!(
                        "Erreur mots-clés GPS optimisé: {}",
                        e
                    ))
                })?;

            // ✅ CORRIGÉ CRITIQUE 2025-12-20: Éliminer N+1 queries - batch query pour récupérer tous les services en UNE requête
            let service_ids: Vec<i32> =
                results.iter().map(|row| row.get::<i32, _>("service_id")).collect();

            let services_data_map: std::collections::HashMap<i32, Value> =
                if !service_ids.is_empty() {
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
                let service_data = services_data_map
                    .get(&service_id)
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
                    gps_coords: gps_coords.map(|s| serde_json::Value::String(s)).or(gps_from_data),
                    search_method: "keywords_gps_optimized".to_string(),
                    matched_fields: vec!["keywords".to_string(), "gps".to_string()],
                });
            }

            return Ok(search_results);
        }

        // ✅ OPTIMISÉ 2025-12-17: Utiliser tsvector avec index GIN au lieu de ILIKE (947ms → ~300ms)
        // Le problème: ILIKE '%...%' ne peut pas utiliser d'index et scanne toute la table
        // Solution: Utiliser to_tsvector + plainto_tsquery avec index GIN (créé dans migration 20251217)
        // ✅ OPTIMISÉ 2025-01-01: Version optimisée sans nouveaux index
        // - Pré-calcule scores produits dans CTE (UNE SEULE FOIS au lieu de 14)
        // - Inclut sous-caractéristiques via extract_all_product_text()
        // - Pré-filtre services avant scoring
        // - Simplifie scoring (14 → 4 priorités)
        // - ✅ NOUVEAU: Gère accents (unaccent), erreurs de saisie (similarity), troncature (ILIKE patterns)
        // Gain estimé: 4.46s → ~0.3s (15x plus rapide)
        let sql = r#"
            WITH autocomplete_matches AS (
                -- ✅ ÉTAPE 1: Matches depuis autocomplete_characteristics (rapide, indexé)
                -- ✅ Gère accents, erreurs de saisie, troncature
                SELECT 
                    ac.service_id,
                    ac.valeur,
                    ac.usage_count,
                    (
                        -- Score exact (100) - gère accents avec unaccent
                        CASE WHEN LOWER(unaccent(ac.valeur)) = LOWER(unaccent($1)) THEN 100.0 ELSE 0.0 END +
                        -- Score début (80) - gère accents et troncature
                        CASE WHEN unaccent(ac.valeur) ILIKE unaccent($1) || '%' THEN 80.0 ELSE 0.0 END +
                        -- Score partiel (60) - gère accents et troncature
                        CASE WHEN unaccent(ac.valeur) ILIKE '%' || unaccent($1) || '%' THEN 60.0 ELSE 0.0 END +
                        -- Score full-text (20) - gère accents via to_tsvector('french')
                        ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', $1)) * 20.0 +
                        -- ✅ NOUVEAU: Score similarité trigram (15) - gère erreurs de saisie
                        CASE WHEN similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER($1))) > 0.3 THEN 
                            similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER($1))) * 15.0 
                        ELSE 0.0 END +
                        (ac.usage_count::REAL * 0.5)
                    )::REAL as ac_score
                FROM autocomplete_characteristics ac
                INNER JOIN services s ON s.id = ac.service_id
                INNER JOIN service_products p ON p.id = ac.product_id::INTEGER AND p.service_id = ac.service_id
                WHERE s.is_active = true
                AND p.is_active = true
                AND ac.identifiant_base = 'produits'
                AND ac.is_real_product = TRUE
                AND (
                    -- Match exact (gère accents)
                    LOWER(unaccent(ac.valeur)) = LOWER(unaccent($1))
                    -- Match début (gère accents et troncature)
                    OR unaccent(ac.valeur) ILIKE unaccent($1) || '%'
                    -- Match partiel (gère accents et troncature)
                    OR unaccent(ac.valeur) ILIKE '%' || unaccent($1) || '%'
                    -- Full-text (gère accents via to_tsvector)
                    OR to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', $1)
                    -- ✅ NOUVEAU: Similarité trigram (gère erreurs de saisie)
                    OR similarity(unaccent(LOWER(ac.valeur)), unaccent(LOWER($1))) > 0.3
                )
                LIMIT 200
            ),
            best_autocomplete_per_service AS (
                SELECT DISTINCT ON (service_id)
                    service_id,
                    ac_score
                FROM autocomplete_matches
                ORDER BY service_id, ac_score DESC, usage_count DESC NULLS LAST
                LIMIT 100
            ),
            prefiltered_services_for_products AS (
                -- ✅ ÉTAPE 2A: Pré-filtrer services AVANT de décomposer produits (utilise index existants)
                -- ✅ CORRIGÉ 2026-01-22: NE PAS filtrer par titre/description service - recherche UNIQUEMENT dans produits
                -- ✅ CORRIGÉ 2026-01-22: Supprimer la limite de 200 services - elle excluait des services pertinents
                -- ✅ OPTIMISÉ: Pré-filtrer seulement les services qui ont des produits actifs (évite de traiter tous les services)
                SELECT DISTINCT s.id
                FROM services s
                INNER JOIN service_products p ON p.service_id = s.id AND p.is_active = true
                WHERE s.is_active = true
                -- ✅ SUPPRIMÉ 2026-01-22: Ne plus filtrer par titre/description service
                -- La recherche se concentre UNIQUEMENT sur les produits et leurs caractéristiques
                -- ✅ SUPPRIMÉ 2026-01-22: Ne plus limiter à 200 services - la limite sera appliquée après la recherche (LIMIT 50)
            ),
            product_scores AS (
                -- ✅ PHASE 3: Pré-calculer scores produits SEULEMENT pour services pré-filtrés depuis table service_products
                -- ✅ Gère accents (unaccent), erreurs de saisie (similarity), troncature (ILIKE patterns)
                -- ✅ SCALABLE: Évalue seulement ~1000 produits (200 services × 5 produits) au lieu de millions
            SELECT 
                    p.service_id,
                GREATEST(
                        -- ✅ PRIORITÉ MAXIMALE 2026-01-23: NOM PRODUIT (200-220) - PRIORITÉ ABSOLUE pour recherche exacte
                        -- ✅ CORRIGÉ 2026-01-23: Le nom du produit doit avoir la priorité la plus haute pour une recherche directe
                        CASE WHEN LOWER(unaccent(p.product_name)) = LOWER(unaccent($1)) THEN 220.0 ELSE 0.0 END,
                        CASE WHEN unaccent(p.product_name) ILIKE unaccent($1) || '%' THEN 200.0 ELSE 0.0 END,
                        CASE WHEN unaccent(p.product_name) ILIKE '%' || unaccent($1) || '%' THEN 180.0 ELSE 0.0 END,
                        -- ✅ PRIORITÉ TRÈS HAUTE 2026-01-23: SOUS-CARACTÉRISTIQUES (150-170) - PRIORITÉ HAUTE
                        -- Recherche directe dans les valeurs des sous-caractéristiques (exact)
                        CASE WHEN EXISTS (
                            SELECT 1 FROM jsonb_each(p.product_data->'sous_caracteristiques') AS sc
                            WHERE jsonb_typeof(sc.value) = 'array'
                            AND EXISTS (
                                SELECT 1 FROM jsonb_array_elements_text(sc.value) AS val
                                WHERE LOWER(unaccent(val)) = LOWER(unaccent($1))
                            )
                        ) THEN 170.0 ELSE 0.0 END,
                        -- Recherche directe dans les valeurs des sous-caractéristiques (début)
                        CASE WHEN EXISTS (
                            SELECT 1 FROM jsonb_each(p.product_data->'sous_caracteristiques') AS sc
                            WHERE jsonb_typeof(sc.value) = 'array'
                            AND EXISTS (
                                SELECT 1 FROM jsonb_array_elements_text(sc.value) AS val
                                WHERE unaccent(val) ILIKE unaccent($1) || '%'
                            )
                        ) THEN 160.0 ELSE 0.0 END,
                        -- Recherche directe dans les valeurs des sous-caractéristiques (partiel)
                        CASE WHEN EXISTS (
                            SELECT 1 FROM jsonb_each(p.product_data->'sous_caracteristiques') AS sc
                            WHERE (
                                (jsonb_typeof(sc.value) = 'array' AND EXISTS (
                                    SELECT 1 FROM jsonb_array_elements_text(sc.value) AS val
                                    WHERE unaccent(val) ILIKE '%' || unaccent($1) || '%'
                                ))
                                OR (jsonb_typeof(sc.value) = 'string' AND unaccent(sc.value::text) ILIKE '%' || unaccent($1) || '%')
                                OR unaccent(sc.key) ILIKE '%' || unaccent($1) || '%'
                            )
                        ) THEN 150.0 ELSE 0.0 END,
                        -- ✅ PRIORITÉ HAUTE 2026-01-23: DESCRIPTION PRODUIT (120-140) - PRIORITÉ MOYENNE
                        CASE WHEN LOWER(unaccent(COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', ''))) = LOWER(unaccent($1)) THEN 140.0 ELSE 0.0 END,
                        CASE WHEN unaccent(COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', '')) ILIKE unaccent($1) || '%' THEN 130.0 ELSE 0.0 END,
                        CASE WHEN unaccent(COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', '')) ILIKE '%' || unaccent($1) || '%' THEN 120.0 ELSE 0.0 END,
                        -- ✅ PRIORITÉ BASSE 2026-01-22: CATÉGORIE PRODUIT (40-60) - MOINS IMPORTANTE
                        CASE WHEN LOWER(unaccent(COALESCE(p.product_data->>'categorie_produit', ''))) = LOWER(unaccent($1)) THEN 60.0 ELSE 0.0 END,
                        CASE WHEN unaccent(COALESCE(p.product_data->>'categorie_produit', '')) ILIKE unaccent($1) || '%' THEN 55.0 ELSE 0.0 END,
                        CASE WHEN unaccent(COALESCE(p.product_data->>'categorie_produit', '')) ILIKE '%' || unaccent($1) || '%' THEN 50.0 ELSE 0.0 END,
                        -- ✅ Full-text scores (fallback) - ordre de priorité maintenu
                        CASE WHEN EXISTS (
                            SELECT 1 FROM jsonb_each(p.product_data->'sous_caracteristiques') AS sc
                            WHERE to_tsvector('french', COALESCE(sc.value::text, '')) @@ plainto_tsquery('french', $1)
                        ) THEN 35.0 ELSE 0.0 END,
                        CASE WHEN to_tsvector('french', COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', '')) @@ plainto_tsquery('french', $1) THEN 30.0 ELSE 0.0 END,
                        CASE WHEN to_tsvector('french', p.product_name) @@ plainto_tsquery('french', $1) THEN 25.0 ELSE 0.0 END,
                        CASE WHEN to_tsvector('french', COALESCE(p.product_data->>'categorie_produit', '')) @@ plainto_tsquery('french', $1) THEN 22.0 ELSE 0.0 END,
                        -- ✅ Similarité trigram (fallback) - ordre de priorité maintenu
                        CASE WHEN EXISTS (
                            SELECT 1 FROM jsonb_each(p.product_data->'sous_caracteristiques') AS sc
                            WHERE jsonb_typeof(sc.value) = 'array'
                            AND EXISTS (
                                SELECT 1 FROM jsonb_array_elements_text(sc.value) AS val
                                WHERE similarity(unaccent(LOWER(val)), unaccent(LOWER($1))) > 0.3
                            )
                        ) THEN 18.0 ELSE 0.0 END,
                        CASE WHEN similarity(unaccent(LOWER(COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', ''))), unaccent(LOWER($1))) > 0.3 THEN 
                            similarity(unaccent(LOWER(COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', ''))), unaccent(LOWER($1))) * 15.0 
                        ELSE 0.0 END,
                        CASE WHEN similarity(unaccent(LOWER(p.product_name)), unaccent(LOWER($1))) > 0.3 THEN 
                            similarity(unaccent(LOWER(p.product_name)), unaccent(LOWER($1))) * 12.0 
                        ELSE 0.0 END,
                        CASE WHEN similarity(unaccent(LOWER(COALESCE(p.product_data->>'categorie_produit', ''))), unaccent(LOWER($1))) > 0.3 THEN 
                            similarity(unaccent(LOWER(COALESCE(p.product_data->>'categorie_produit', ''))), unaccent(LOWER($1))) * 11.0 
                        ELSE 0.0 END
                    )::REAL as product_score
                FROM prefiltered_services_for_products pf
                INNER JOIN service_products p ON p.service_id = pf.id AND p.is_active = true
                -- ✅ PHASE 3: Pré-filtrer: seulement les produits qui matchent (gère accents, erreurs, troncature)
                -- ✅ CORRIGÉ 2026-01-22: PRIORISER sous-caractéristiques et description produit
                WHERE (
                    -- ✅ PRIORITÉ 1: Recherche dans SOUS-CARACTÉRISTIQUES (priorité maximale)
                    EXISTS (
                        SELECT 1 FROM jsonb_each(p.product_data->'sous_caracteristiques') AS sc
                        WHERE (
                            (jsonb_typeof(sc.value) = 'array' AND EXISTS (
                                SELECT 1 FROM jsonb_array_elements_text(sc.value) AS val
                                WHERE unaccent(val) ILIKE '%' || unaccent($1) || '%'
                                OR LOWER(unaccent(val)) = LOWER(unaccent($1))
                            ))
                            OR (jsonb_typeof(sc.value) = 'string' AND (
                                unaccent(sc.value::text) ILIKE '%' || unaccent($1) || '%'
                                OR LOWER(unaccent(sc.value::text)) = LOWER(unaccent($1))
                            ))
                            OR unaccent(sc.key) ILIKE '%' || unaccent($1) || '%'
                            OR LOWER(unaccent(sc.key)) = LOWER(unaccent($1))
                        )
                    )
                    -- ✅ PRIORITÉ 2: Recherche dans DESCRIPTION PRODUIT (priorité haute)
                    OR unaccent(COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', '')) ILIKE '%' || unaccent($1) || '%'
                    -- ✅ PRIORITÉ 3: Recherche dans NOM PRODUIT (priorité moyenne)
                    OR unaccent(p.product_name) ILIKE '%' || unaccent($1) || '%'
                    -- ✅ PRIORITÉ 4: Recherche dans CATÉGORIE PRODUIT (priorité basse)
                    OR unaccent(COALESCE(p.product_data->>'categorie_produit', '')) ILIKE '%' || unaccent($1) || '%'
                    -- Full-text (fallback) - ordre de priorité maintenu
                    OR EXISTS (
                        SELECT 1 FROM jsonb_each(p.product_data->'sous_caracteristiques') AS sc
                        WHERE to_tsvector('french', COALESCE(sc.value::text, '')) @@ plainto_tsquery('french', $1)
                    )
                    OR to_tsvector('french', COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', '')) @@ plainto_tsquery('french', $1)
                    OR to_tsvector('french', p.product_name) @@ plainto_tsquery('french', $1)
                    OR to_tsvector('french', COALESCE(p.product_data->>'categorie_produit', '')) @@ plainto_tsquery('french', $1)
                    -- Similarité trigram (fallback) - ordre de priorité maintenu
                    OR EXISTS (
                        SELECT 1 FROM jsonb_each(p.product_data->'sous_caracteristiques') AS sc
                        WHERE jsonb_typeof(sc.value) = 'array'
                        AND EXISTS (
                            SELECT 1 FROM jsonb_array_elements_text(sc.value) AS val
                            WHERE similarity(unaccent(LOWER(val)), unaccent(LOWER($1))) > 0.3
                        )
                    )
                    OR similarity(unaccent(LOWER(COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', ''))), unaccent(LOWER($1))) > 0.3
                    OR similarity(unaccent(LOWER(p.product_name)), unaccent(LOWER($1))) > 0.3
                    OR similarity(unaccent(LOWER(COALESCE(p.product_data->>'categorie_produit', ''))), unaccent(LOWER($1))) > 0.3
                )
                LIMIT 500
            ),
            best_product_per_service AS (
                -- ✅ ÉTAPE 3: Sélectionner le meilleur produit par service
                SELECT DISTINCT ON (service_id)
                    service_id,
                    MAX(product_score) as max_product_score
                FROM product_scores
                GROUP BY service_id
                ORDER BY service_id, max_product_score DESC
                LIMIT 100
            ),
            quick_filter AS (
                -- ✅ ÉTAPE 4: Pré-filtrer les services (rapide, utilise index existants)
                -- ✅ CORRIGÉ 2026-01-22: Recherche UNIQUEMENT dans produits - NE PAS filtrer par titre/description service
                -- ✅ SCALABLE: Utilise index GIN et trigram existants (rapide même avec millions)
                SELECT DISTINCT s.id
            FROM services s
            LEFT JOIN best_autocomplete_per_service ac ON ac.service_id = s.id
                LEFT JOIN best_product_per_service bp ON bp.service_id = s.id
            WHERE s.is_active = true
            AND (
                -- ✅ PRIORITÉ: Seulement les services avec matches produits (autocomplete ou produits directs)
                ac.service_id IS NOT NULL
                    OR bp.service_id IS NOT NULL
                -- ✅ SUPPRIMÉ 2026-01-22: Ne plus filtrer par titre/description service
                -- La recherche se concentre UNIQUEMENT sur les produits et leurs caractéristiques
                )
                LIMIT 100
            )
            SELECT 
                s.id,
                s.data,
                s.created_at,
                s.user_id,
                s.gps,
                s.category,
                -- ✅ ÉTAPE 5: Scoring simplifié - UNIQUEMENT produits (sous-caractéristiques, description, nom, catégorie)
                -- ✅ CORRIGÉ 2026-01-22: Recherche UNIQUEMENT dans produits - NE PAS utiliser titre/description service
                GREATEST(
                    -- PRIORITÉ 0: Score depuis autocomplete_characteristics (caractéristiques produits)
                    COALESCE(ac.ac_score, 0.0),
                    -- PRIORITÉ 1: Score depuis produits (pré-calculé) + sous-caractéristiques - PRIORITÉ MAXIMALE
                    -- ✅ CORRIGÉ 2026-01-22: Les produits ont TOUJOURS priorité - titre/description service IGNORÉS
                    COALESCE(bp.max_product_score, 0.0)
                    -- ✅ SUPPRIMÉ 2026-01-22: Ne plus scorer titre/description/category du service
                    -- La recherche se concentre UNIQUEMENT sur les produits et leurs caractéristiques
                )::REAL as keyword_score
            FROM quick_filter qf
            INNER JOIN services s ON s.id = qf.id
            LEFT JOIN best_autocomplete_per_service ac ON ac.service_id = s.id
            LEFT JOIN best_product_per_service bp ON bp.service_id = s.id
            WHERE ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
            AND ($3::text IS NULL OR s.gps IS NULL OR s.gps ILIKE '%' || $3 || '%')
            ORDER BY keyword_score DESC
            LIMIT 50
        "#;

        // ✅ CORRIGÉ 2025-12-28: Retry avec gestion d'erreur TLS et timeout
        let mut results = None;
        let max_retries = 3;
        let query_timeout = std::time::Duration::from_secs(12); // Timeout de 12s pour éviter dépassement TLS

        for attempt in 1..=max_retries {
            match tokio::time::timeout(
                query_timeout,
                sqlx::query(sql)
                    .bind(query)
                    .bind(category_filter)
                    .bind(location_filter)
                    .fetch_all(&self.pool),
            )
            .await
            {
                Ok(Ok(rows)) => {
                    results = Some(rows);
                    break;
                }
                Ok(Err(e)) => {
                    let error_msg = e.to_string();
                    let is_tls_error = error_msg.contains("TLS")
                        || error_msg.contains("close_notify")
                        || error_msg.contains("Connection reset")
                        || error_msg.contains("peer closed")
                        || error_msg.contains("communicating with database");

                    if is_tls_error && attempt < max_retries {
                        let delay_ms = 200 * attempt; // Backoff: 200ms, 400ms, 600ms
                        log::warn!(
                            "[NativeSearch] Erreur DB TLS détectée (tentative {}/{}), retry dans {}ms: {}",
                            attempt,
                            max_retries,
                            delay_ms,
                            error_msg
                        );
                        tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                        continue;
                    } else {
                        log_error(&format!(
                            "[NativeSearch] Erreur recherche par mots clés: {}",
                            e
                        ));
                        if attempt == max_retries {
                            return Err(crate::core::types::AppError::Internal(format!(
                                "Erreur recherche par mots clés après {} tentatives: {}",
                                max_retries, e
                            )));
                        }
                    }
                }
                Err(_) => {
                    // Timeout
                    log_error(&format!(
                        "[NativeSearch] Timeout recherche par mots clés ({}s dépassé)",
                        query_timeout.as_secs()
                    ));
                    if attempt < max_retries {
                        let delay_ms = 200 * attempt;
                        log::warn!(
                            "[NativeSearch] Retry après timeout (tentative {}/{}) dans {}ms",
                            attempt,
                            max_retries,
                            delay_ms
                        );
                        tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                        continue;
                    } else {
                        return Err(crate::core::types::AppError::Internal(format!(
                            "Timeout recherche par mots clés après {} tentatives ({}s)",
                            max_retries,
                            query_timeout.as_secs()
                        )));
                    }
                }
            }
        }

        let results = results.ok_or_else(|| {
            crate::core::types::AppError::Internal(
                "Échec recherche par mots clés après retries".to_string(),
            )
        })?;

        // ✅ CORRIGÉ: Stocker la longueur avant de déplacer results dans la boucle
        let total_results_count = results.len();

        let mut search_results = Vec::new();
        // ✅ CORRIGÉ 2026-01-13: Seuil adaptatif selon le nombre de mots dans la requête
        // Pour un seul mot (ex: "chaussures"), réduire le seuil pour permettre plus de résultats
        // Pour plusieurs mots (ex: "chaussures nike"), garder un seuil plus élevé pour la pertinence
        // ✅ AMÉLIORÉ 2026-01-13: Seuil plus élevé pour mots très courts (3-4 caractères) pour éviter résultats peu pertinents
        let query_words: Vec<&str> = query.split_whitespace().filter(|w| w.len() >= 2).collect();
        let is_single_word_search = query_words.len() <= 1;
        let is_very_short_word = query_words.len() == 1 && query_words[0].len() <= 4;
        let min_relevance_score = if is_single_word_search {
            if is_very_short_word {
                15.0 // ✅ Seuil élevé pour mots très courts (3-4 caractères) pour éviter résultats peu pertinents
            } else {
                3.0 // ✅ Seuil réduit pour recherches à un seul mot long (permet correspondances partielles)
            }
        } else {
            8.0 // ✅ Seuil normal pour recherches à plusieurs mots (meilleure pertinence)
        };

        log_info(&format!(
            "[NativeSearch] Seuil de pertinence adaptatif: {} (recherche {} mot(s), mot court: {})",
            min_relevance_score,
            query_words.len(),
            is_very_short_word
        ));

        for row in results {
            let service_id: i32 = row.get("id");
            let data: Value = row.get("data");
            let _created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let _user_id: i32 = row.get("user_id");
            let _gps: Option<String> = row.get("gps");
            let _category: Option<String> = row.get("category");
            // Gérer le cas où keyword_score peut être NULL
            let keyword_score: f32 = row.try_get("keyword_score").unwrap_or(0.0);

            // Filtrer les résultats avec score trop faible (correspondances non pertinentes)
            if keyword_score < min_relevance_score {
                log::debug!(
                    "[NativeSearch] Résultat filtré (score {} < {}): service_id={}",
                    keyword_score,
                    min_relevance_score,
                    service_id
                );
                continue;
            }

            // ✅ NOUVEAU: Calculer distance GPS même si GPS utilisateur n'est pas fourni
            // On extrait le GPS du service et on peut calculer la distance si on a un GPS de référence
            let (distance_km, gps_coords) = if let Some(service_gps_str) = &_gps {
                // Extraire les coordonnées GPS du service
                let service_gps_parsed = if let Some((lat_str, lng_str)) =
                    service_gps_str.split_once(',')
                {
                    if let (Ok(lat), Ok(lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
                        Some((lat, lng))
                    } else {
                        None
                    }
                } else {
                    None
                };

                // Si on a un GPS utilisateur (même si pas passé explicitement), calculer la distance
                let calculated_distance = if let Some(gps_zone) = gps_zone {
                    if let Some((user_lat_str, user_lng_str)) = gps_zone.split_once(',') {
                        if let (Ok(user_lat), Ok(user_lng)) =
                            (user_lat_str.parse::<f64>(), user_lng_str.parse::<f64>())
                        {
                            if let Some((service_lat, service_lng)) = service_gps_parsed {
                                // Calculer distance avec formule Haversine
                                let distance = crate::services::gps_matching::calculate_distance_km(
                                    user_lat,
                                    user_lng,
                                    service_lat,
                                    service_lng,
                                );
                                Some(distance)
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                };

                (
                    calculated_distance,
                    service_gps_parsed.map(|(lat, lng)| {
                        serde_json::json!({
                            "lat": lat,
                            "lng": lng,
                            "source": "service"
                        })
                    }),
                )
            } else {
                // Essayer d'extraire GPS depuis data->gps_fixe
                let gps_from_data = data
                    .get("gps_fixe")
                    .and_then(|v| v.get("valeur"))
                    .and_then(|v| v.as_str())
                    .or_else(|| data.get("gps_fixe").and_then(|v| v.as_str()));

                if let Some(gps_str) = gps_from_data {
                    if let Some((lat_str, lng_str)) = gps_str.split_once(',') {
                        if let (Ok(lat), Ok(lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>())
                        {
                            // Calculer distance si GPS utilisateur disponible
                            let calculated_distance = if let Some(gps_zone) = gps_zone {
                                if let Some((user_lat_str, user_lng_str)) = gps_zone.split_once(',')
                                {
                                    if let (Ok(user_lat), Ok(user_lng)) =
                                        (user_lat_str.parse::<f64>(), user_lng_str.parse::<f64>())
                                    {
                                        Some(crate::services::gps_matching::calculate_distance_km(
                                            user_lat, user_lng, lat, lng,
                                        ))
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                }
                            } else {
                                None
                            };

                            (
                                calculated_distance,
                                Some(serde_json::json!({
                                    "lat": lat,
                                    "lng": lng,
                                    "source": "data"
                                })),
                            )
                        } else {
                            (None, None)
                        }
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                }
            };

            search_results.push(SearchResult {
                service_id,
                data,
                total_score: keyword_score,
                fulltext_score: 0.0,
                trigram_score: 0.0,
                recency_score: 0.0,
                category_score: keyword_score,
                distance_km,
                gps_coords,
                search_method: "keywords".to_string(),
                matched_fields: vec!["keywords".to_string()],
            });
        }

        log_info(&format!(
            "[NativeSearch] Recherche par mots-clés terminée: {} résultats pertinents (score >= {}) sur {} résultats bruts",
            search_results.len(),
            min_relevance_score,
            total_results_count
        ));

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
    /// ✅ NOUVEAU 2025-12-24: Mapper code langue (fr, en, etc.) vers nom PostgreSQL (french, english, simple)
    fn map_language_to_postgres(&self, lang_code: &str) -> String {
        match lang_code.to_lowercase().as_str() {
            "fra" | "fr" => "french",
            "eng" | "en" => "english",
            "por" | "pt" => "portuguese",
            "ara" | "ar" => "arabic",
            "ful" | "ff" => "simple", // Fula n'a pas de config spécifique, utiliser simple
            _ => "simple", // Langue inconnue ou non supportée -> utiliser 'simple' (langue neutre)
        }
        .to_string()
    }

    /// ✅ AMÉLIORÉ 2025-12-24: Normalisation avancée avec gestion mots tronqués
    /// Retourne (query_normalized, has_wildcards) pour permettre l'utilisation de LIKE dans SQL
    fn normalize_query_advanced(&self, query: &str) -> (String, bool) {
        // Normalisation de base
        let normalized = query
            .to_lowercase()
            .trim()
            .replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '*', " ");

        // ✅ AMÉLIORÉ 2025-12-24: Détecter les wildcards * (générique, pas spécifique à un mot)
        let has_wildcards = normalized.contains('*');

        // Traiter les mots tronqués (ex: "gate*" -> "gate")
        let words: Vec<String> = normalized
            .split_whitespace()
            .flat_map(|word| {
                // Si le mot se termine par *, c'est un mot tronqué
                let word_clean = word.trim_end_matches('*');
                if word_clean.len() >= 2 {
                    // Créer variantes avec/sans accents pour le mot tronqué
                    self.create_word_variants(word_clean)
                } else {
                    vec![word.to_string()]
                }
            })
            .collect();

        (words.join(" "), has_wildcards)
    }

    /// Normaliser un mot (supprimer accents, minuscules) - pour matching vectoriel optimisé
    /// ✅ GÉNÉRIQUE 2026-01-13: Seulement normalisation accents (pas de règles spécifiques par langue)
    /// Les stop words sont filtrés par extract_keywords_from_text avant d'arriver ici
    fn normalize_word_for_vector_matching(&self, word: &str) -> String {
        // ✅ GÉNÉRIQUE: Seulement normalisation accents (fonctionne pour toutes les langues)
        word.to_lowercase()
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
            .collect::<String>()
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

        let results = sqlx::query(sql).bind(category).fetch_all(&self.pool).await.map_err(|e| {
            log_error(&format!(
                "[NativeSearch] Erreur recherche par catégorie: {}",
                e
            ));
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
        user_lng: Option<f64>,
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
            sqlx::query(sql).bind(location).bind(lat).bind(lng).fetch_all(&self.pool).await
        } else {
            sqlx::query(sql).bind(location).fetch_all(&self.pool).await
        }
        .map_err(|e| {
            log_error(&format!(
                "[NativeSearch] Erreur recherche géospatiale: {}",
                e
            ));
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
