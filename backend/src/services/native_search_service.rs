use crate::config::search_config::SearchConfig;
use crate::core::types::AppResult;
use crate::services::cache_service::CacheService;
use crate::services::scheduling_search_service::SchedulingSearchService;
use crate::services::search_cache_service::SearchCacheService;
use crate::utils::db_retry::retry_query;
use crate::utils::log::{log_error, log_info};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use std::time::Duration;

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
    pub search_method: String,
    pub matched_fields: Vec<String>,
    /// ✅ Phase 10 - Distance en km (calculée avec PostgreSQL ST_Distance ou enrichie avec Google Maps)
    pub distance_km: Option<f64>,
    /// ✅ Phase 10 - Coordonnées GPS du service (pour enrichissement Google Maps)
    pub gps_coords: Option<(f64, f64)>,
}

/// Service de recherche native PostgreSQL intelligente
pub struct NativeSearchService {
    pool: PgPool,              // Master pour écritures
    pool_read: Option<PgPool>, // ✅ NOUVEAU 2025-12-02: Read replica pour scaling horizontal (lectures)
    config: SearchConfig,
    /// ✅ Phase 10 - Service de matching géographique pour enrichir les distances
    /// ⚠️ OPTIMISÉ 2025-11-28: Désactivé par défaut (trop lent), peut être réactivé via with_geographic_matching()
    #[allow(dead_code)]
    geographic_matching:
        Option<Arc<crate::services::geographic_matching_service::GeographicMatchingService>>,
    /// ✅ OPTIMISÉ 2025-11-28 - Service de cache Redis pour les résultats de recherche
    cache_service: Option<Arc<CacheService>>,
    /// ✅ OPTIMISÉ 2025-12-01 - Cache en mémoire pour check_if_location_in_input (TTL 5 min)
    #[allow(dead_code)]
    location_check_cache:
        Arc<tokio::sync::Mutex<std::collections::HashMap<String, (bool, std::time::Instant)>>>,
    /// ✅ NOUVEAU 2025-12-01 - Service de scalabilité pour cache multi-niveaux optimisé
    scalability_service: Option<Arc<crate::services::scalability_service::ScalabilityService>>,
    /// ✅ NOUVEAU 2025-01-XX - Service de cache multi-niveaux pour recherches (L1+L2+L4)
    search_cache_service: Option<Arc<SearchCacheService>>,
}

impl NativeSearchService {
    pub fn new(pool: PgPool) -> Self {
        Self::new_with_read_replica(pool, None)
    }

    /// ✅ NOUVEAU 2025-12-02: Constructeur avec support read replica pour scaling horizontal
    pub fn new_with_read_replica(pool: PgPool, pool_read: Option<PgPool>) -> Self {
        let config = SearchConfig::default();
        if pool_read.is_some() {
            log::info!(
                "✅ NativeSearchService: Read replica configuré - Scaling horizontal activé"
            );
        }
        Self {
            pool,
            pool_read, // ✅ NOUVEAU 2025-12-02: Read replica pour lectures
            config,
            geographic_matching: None,
            cache_service: None,
            location_check_cache: Arc::new(tokio::sync::Mutex::new(
                std::collections::HashMap::new(),
            )),
            scalability_service: None,
            search_cache_service: None,
        }
    }

    /// ✅ NOUVEAU 2025-12-02: Helper pour choisir le bon pool (read replica pour lectures, master pour écritures)
    fn get_read_pool(&self) -> &PgPool {
        self.pool_read.as_ref().unwrap_or(&self.pool)
    }

    pub fn with_config(pool: PgPool, config: SearchConfig) -> Self {
        Self {
            pool,
            pool_read: None,
            config,
            geographic_matching: None,
            cache_service: None,
            location_check_cache: Arc::new(tokio::sync::Mutex::new(
                std::collections::HashMap::new(),
            )),
            scalability_service: None,
            search_cache_service: None,
        }
    }

    /// ✅ Phase 10 - Constructeur avec service de matching géographique
    pub fn with_geographic_matching(
        pool: PgPool,
        geographic_matching: Arc<
            crate::services::geographic_matching_service::GeographicMatchingService,
        >,
    ) -> Self {
        let config = SearchConfig::default();
        Self {
            pool,
            pool_read: None,
            config,
            geographic_matching: Some(geographic_matching),
            cache_service: None,
            location_check_cache: Arc::new(tokio::sync::Mutex::new(
                std::collections::HashMap::new(),
            )),
            scalability_service: None,
            search_cache_service: None,
        }
    }

    /// ✅ OPTIMISÉ 2025-11-28 - Constructeur avec cache Redis et matching géographique
    pub fn with_cache_and_geographic_matching(
        pool: PgPool,
        cache_service: Option<Arc<CacheService>>,
        geographic_matching: Option<
            Arc<crate::services::geographic_matching_service::GeographicMatchingService>,
        >,
    ) -> Self {
        let config = SearchConfig::default();
        Self {
            pool,
            pool_read: None,
            config,
            geographic_matching,
            cache_service,
            location_check_cache: Arc::new(tokio::sync::Mutex::new(
                std::collections::HashMap::new(),
            )),
            scalability_service: None,
            search_cache_service: None,
        }
    }

    /// ✅ NOUVEAU 2025-12-01 - Constructeur avec service de scalabilité pour cache optimisé
    pub fn with_scalability(
        pool: PgPool,
        scalability_service: Option<Arc<crate::services::scalability_service::ScalabilityService>>,
    ) -> Self {
        let config = SearchConfig::default();
        Self {
            pool,
            pool_read: None,
            config,
            geographic_matching: None,
            cache_service: None,
            location_check_cache: Arc::new(tokio::sync::Mutex::new(
                std::collections::HashMap::new(),
            )),
            scalability_service,
            search_cache_service: None,
        }
    }

    /// ✅ NOUVEAU 2025-01-XX - Constructeur avec cache multi-niveaux pour recherches
    pub fn with_search_cache(
        pool: PgPool,
        search_cache_service: Option<Arc<SearchCacheService>>,
    ) -> Self {
        let config = SearchConfig::default();
        Self {
            pool,
            pool_read: None,
            config,
            geographic_matching: None,
            cache_service: None,
            location_check_cache: Arc::new(tokio::sync::Mutex::new(
                std::collections::HashMap::new(),
            )),
            scalability_service: None,
            search_cache_service,
        }
    }

    /// ✅ NOUVEAU 2025-01-XX - Constructeur complet avec tous les services optimisés
    pub fn with_all_optimizations(
        pool: PgPool,
        cache_service: Option<Arc<CacheService>>,
        scalability_service: Option<Arc<crate::services::scalability_service::ScalabilityService>>,
        search_cache_service: Option<Arc<SearchCacheService>>,
    ) -> Self {
        let config = SearchConfig::default();
        Self {
            pool,
            pool_read: None,
            config,
            geographic_matching: None,
            cache_service,
            location_check_cache: Arc::new(tokio::sync::Mutex::new(
                std::collections::HashMap::new(),
            )),
            scalability_service,
            search_cache_service,
        }
    }

    /// ✅ OPTIMISÉ 2025-11-28 - Constructeur avec uniquement le cache Redis
    pub fn with_cache(pool: PgPool, cache_service: Arc<CacheService>) -> Self {
        let config = SearchConfig::default();
        Self {
            pool,
            pool_read: None,
            config,
            geographic_matching: None,
            cache_service: Some(cache_service),
            location_check_cache: Arc::new(tokio::sync::Mutex::new(
                std::collections::HashMap::new(),
            )),
            scalability_service: None,
            search_cache_service: None,
        }
    }

    /// Charger la configuration depuis un fichier et les variables d'environnement
    pub async fn load_config(&mut self, _config_path: Option<&str>) -> Result<(), String> {
        // Configuration déjà chargée par défaut
        Ok(())
    }

    /// ✅ NOUVEAU 2025-11-04 : Vérifier si un lieu est mentionné dans l'input
    /// Utilise l'opérateur && (overlap) pour tester intersection entre arrays
    /// Retourne TRUE si au moins UN produit a un lieu qui matche
    /// Retourne FALSE si aucun lieu ne matche → Utiliser TOUTE la base
    /// ✅ CORRIGÉ 2025-12-01 : Optimisation profonde - utilise l'index GIN efficacement
    async fn check_if_location_in_input(&self, user_input: &str) -> AppResult<bool> {
        // Découper l'input en mots pour créer un array
        let words: Vec<String> = user_input
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        if words.is_empty() {
            return Ok(false);
        }

        // ✅ OPTIMISATION PROFONDE 2025-12-01 : Utiliser l'index GIN directement avec && (overlap)
        // Au lieu de unnest + array_agg pour chaque ligne, on utilise directement l'opérateur &&
        // qui peut utiliser l'index GIN idx_autocomplete_location_vector_partial
        // On évite aussi similarity() qui est très lent
        let query_future = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS (
                SELECT 1 
                FROM autocomplete_characteristics ac
                WHERE ac.is_real_product = TRUE
                AND ac.location_vector IS NOT NULL
                AND array_length(ac.location_vector, 1) > 0
                -- ✅ OPTIMISÉ : Utiliser directement && avec l'index GIN (beaucoup plus rapide)
                -- L'index idx_autocomplete_location_vector_partial peut être utilisé ici
                AND ac.location_vector && $1::TEXT[]
            )
            LIMIT 1
            "#,
        )
        .bind(&words)
        .fetch_one(&self.pool);

        // ✅ Timeout réduit à 500ms car la requête optimisée devrait être très rapide
        let result = tokio::time::timeout(Duration::from_millis(500), query_future).await;

        let has_location = match result {
            Ok(Ok(val)) => val,
            Ok(Err(e)) => {
                log::warn!(
                    "[NativeSearch] Erreur vérification lieu (continue sans pré-filtre): {}",
                    e
                );
                false // En cas d'erreur, continuer sans pré-filtre lieu
            }
            Err(_) => {
                log::warn!(
                    "[NativeSearch] Timeout vérification lieu après 500ms (continue sans pré-filtre): input '{}'",
                    user_input
                );
                false // En cas de timeout, continuer sans pré-filtre lieu
            }
        };

        log::info!(
            "[NativeSearch] Lieu dans input ? {} (input: '{}', words: {:?})",
            has_location,
            user_input,
            words
        );

        Ok(has_location)
    }

    /// ✅ NOUVEAU 2025-11-04 : Recherche avec PRÉ-FILTRE lieu bidirectionnel intelligent
    /// Vérifie si UN élément du location_vector de chaque produit est dans l'input utilisateur
    pub async fn intelligent_search_with_location_prefilter(
        &self,
        search_query: &str,    // Mot-clé principal : "Nike"
        user_input_full: &str, // Input COMPLET : "Nike Air Douala"
        category_filter: Option<&str>,
        _user_id: Option<i32>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        specialized_type: Option<&str>, // ✅ NOUVEAU : Paramètre pour recherche spécialisée dédiée
    ) -> AppResult<Vec<SearchResult>> {
        let _start_time = std::time::Instant::now();
        log_info(&format!(
            "[NativeSearch] Recherche avec pré-filtre lieu: '{}' (input complet: '{}', specialized_type: {:?})",
            search_query, user_input_full, specialized_type
        ));

        // ✅ NOUVELLE LOGIQUE : Vérifier si l'input contient un lieu
        // En vérifiant si UN élément du location_vector de n'importe quel produit matche
        let has_location_in_input = self.check_if_location_in_input(user_input_full).await?;

        // ✅ IMPORTANT : Si AUCUN lieu ne matche → Passer NULL pour utiliser TOUTE la base
        let location_filter = if has_location_in_input {
            log_info("[NativeSearch] 🗺️ Lieu détecté dans input → PRÉ-FILTRE activé");
            Some(user_input_full) // Passer input complet pour filtrage
        } else {
            log_info(
                "[NativeSearch] ⚠️ AUCUN lieu détecté → Recherche dans TOUTE la base de données",
            );
            None // ✅ NULL → Pas de filtre lieu → TOUTE la base
        };

        // Appel à la recherche intelligente existante avec filtre conditionnel
        self.intelligent_search_internal(
            search_query,
            category_filter,
            location_filter, // ✅ NULL si aucun lieu, Some(input) si lieu détecté
            _user_id,
            gps_zone,
            search_radius_km,
            specialized_type, // ✅ Transmettre specialized_type
        )
        .await
    }

    /// Recherche intelligente combinant full-text et trigram
    pub async fn intelligent_search(
        &self,
        search_query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        _user_id: Option<i32>,
        gps_zone: Option<&str>,         // Nouveau paramètre GPS
        search_radius_km: Option<i32>,  // Nouveau paramètre rayon
        specialized_type: Option<&str>, // ✅ NOUVEAU : Paramètre pour recherche spécialisée dédiée
    ) -> AppResult<Vec<SearchResult>> {
        // Appel à la version interne
        self.intelligent_search_internal(
            search_query,
            category_filter,
            location_filter,
            _user_id,
            gps_zone,
            search_radius_km,
            specialized_type, // ✅ Transmettre specialized_type
        )
        .await
    }

    /// Fonction interne de recherche
    async fn intelligent_search_internal(
        &self,
        search_query: &str,
        category_filter: Option<&str>,
        location_or_input_filter: Option<&str>, // Peut être lieu OU input complet
        _user_id: Option<i32>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        specialized_type: Option<&str>, // ✅ NOUVEAU : Paramètre pour recherche spécialisée dédiée
    ) -> AppResult<Vec<SearchResult>> {
        let _start_time = std::time::Instant::now();
        log_info(&format!(
            "[NativeSearch] Début recherche: '{}' (GPS: {:?}, Rayon: {:?}km, specialized_type: {:?})",
            search_query, gps_zone, search_radius_km, specialized_type
        ));

        // ✅ NOUVEAU 2025-01-XX: Vérifier le cache multi-niveaux (L1+L2+L4) avant recherche DB
        // Priorité: SearchCacheService (nouveau) > ScalabilityService (ancien)
        if let Some(ref search_cache) = self.search_cache_service {
            let cache_key = search_cache.generate_cache_key(
                search_query,
                category_filter,
                location_or_input_filter,
                gps_zone,
                search_radius_km,
                specialized_type,
            );

            if let Ok(Some(cached_results)) = search_cache
                .get_cached_results(&cache_key, search_query)
                .await
            {
                log_info(&format!(
                    "[NativeSearch] ✅ Cache multi-niveaux hit pour '{}' - Retour immédiat ({} résultats)",
                    search_query,
                    cached_results.len()
                ));
                return Ok(cached_results);
            }
        }

        // ✅ Fallback: Ancien cache via ScalabilityService
        if let Some(scalability) = &self.scalability_service {
            let filters = serde_json::json!({
                "category": category_filter,
                "location": location_or_input_filter,
                "gps_zone": gps_zone,
                "search_radius_km": search_radius_km,
                "specialized_type": specialized_type,
            });
            let cache_key = scalability.generate_search_cache_key(search_query, &filters);

            if let Ok(Some(cached)) = scalability.get_cached_search_results(&cache_key).await {
                log_info(&format!(
                    "[NativeSearch] ✅ Cache ScalabilityService hit pour '{}' - Retour immédiat",
                    search_query
                ));
                // Convertir le JSON caché en Vec<SearchResult>
                if let Ok(results) = serde_json::from_value::<Vec<SearchResult>>(cached) {
                    return Ok(results);
                }
            }
        }

        // Normaliser la requête
        let normalized_query = self.normalize_query_advanced(search_query);

        // ✅ NOUVEAU 2025-11-30: Enrichir la requête avec les variations (plombier → plomberie)
        // Cela permet au full-text search de matcher les variations
        let expanded_query = self.expand_search_query_with_variations(&normalized_query);
        if expanded_query != normalized_query {
            log_info(&format!(
                "[NativeSearch] Requête enrichie avec variations: '{}' → '{}'",
                normalized_query, expanded_query
            ));
        }

        // ✅ NOUVEAU 2025-11-29: Détecter la catégorie probable à partir de la requête
        // Exemple: "électricien" → "électricité"
        let detected_category = self.detect_category_from_query(&normalized_query);
        let effective_category_filter = category_filter.or(detected_category.as_deref());
        if detected_category.is_some() {
            log_info(&format!(
                "[NativeSearch] Catégorie détectée depuis requête: '{}' → '{}'",
                search_query,
                detected_category.as_ref().unwrap()
            ));
        }

        // Recherche full-text principale avec filtrage GPS (utilise la requête enrichie)
        let mut fulltext_results = self
            .fulltext_search_with_gps(
                &expanded_query, // ✅ NOUVEAU: Utiliser la requête enrichie avec variations
                effective_category_filter,
                location_or_input_filter, // ✅ Input complet pour pré-filtre lieu
                gps_zone,
                search_radius_km,
                specialized_type, // ✅ Transmettre specialized_type (None pour recherche générale)
            )
            .await?;

        // Recherche trigram de fallback si pas assez de résultats
        if fulltext_results.len() < self.config.max_results as usize {
            let trigram_results = self
                .trigram_search_with_gps(
                    &normalized_query,
                    effective_category_filter,
                    location_or_input_filter, // ✅ Input complet pour pré-filtre lieu
                    gps_zone,
                    search_radius_km,
                )
                .await?;

            // Fusionner les résultats en évitant les doublons
            for result in trigram_results {
                if !fulltext_results
                    .iter()
                    .any(|r| r.service_id == result.service_id)
                {
                    fulltext_results.push(result);
                }
            }
        }

        // Recherche par mots clés individuels si encore pas assez de résultats
        if fulltext_results.len() < self.config.max_results as usize / 2 {
            let keyword_results = self
                .keyword_search_with_gps(
                    &normalized_query,
                    effective_category_filter,
                    location_or_input_filter, // ✅ Input complet pour pré-filtre lieu
                    gps_zone,
                    search_radius_km,
                )
                .await?;

            // Fusionner les résultats en évitant les doublons
            for result in keyword_results {
                if !fulltext_results
                    .iter()
                    .any(|r| r.service_id == result.service_id)
                {
                    fulltext_results.push(result);
                }
            }
        }

        // ✅ OPTIMISÉ 2025-12-01: Enrichissement Google Places désactivé par défaut (trop lent: 100-500ms par service)
        // Utiliser enrich_search_results_batch() en batch au lieu de enrich_service_with_google_places_data() séquentiel
        // if fulltext_results.len() <= 10 {
        //     use futures::future::join_all;
        //     let service_ids: Vec<i32> = fulltext_results.iter().map(|r| r.service_id).collect();
        //     let enrichment_results: Vec<_> = join_all(service_ids.iter().map(|&service_id| {
        //         let pool = &self.pool;
        //         async move {
        //             let mut data = serde_json::json!({});
        //             let result = crate::services::enrich_google_places::enrich_service_with_google_places_data(
        //                 pool,
        //                 service_id,
        //                 &mut data
        //             ).await;
        //             (service_id, result.map(|_| data))
        //         }
        //     })).await;
        //
        //     // Appliquer les enrichissements aux résultats
        //     for (service_id, enriched_data_result) in enrichment_results {
        //         if let Ok(enriched_data) = enriched_data_result {
        //             if let Some(result) = fulltext_results.iter_mut().find(|r| r.service_id == service_id) {
        //                 // Fusionner les données enrichies avec les données existantes
        //                 if let Some(obj) = enriched_data.as_object() {
        //                     for (key, value) in obj {
        //                         result.data[key] = value.clone();
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // }

        // Trier les résultats (pas de limite)
        fulltext_results.sort_by(|a, b| {
            b.total_score
                .partial_cmp(&a.total_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let duration = _start_time.elapsed();
        log_info(&format!(
            "[NativeSearch] Recherche terminée en {:?}: {} résultats (avec filtrage GPS: {})",
            duration,
            fulltext_results.len(),
            gps_zone.is_some()
        ));

        // ✅ NOUVEAU 2025-01-XX: Mettre en cache les résultats avec cache multi-niveaux (L1+L2+L4)
        // Priorité: SearchCacheService (nouveau) > ScalabilityService (ancien)
        let is_popular_search = fulltext_results.len() > 0 && duration.as_secs() < 1; // Recherche rapide = potentiellement populaire

        if let Some(ref search_cache) = self.search_cache_service {
            let cache_key = search_cache.generate_cache_key(
                search_query,
                category_filter,
                location_or_input_filter,
                gps_zone,
                search_radius_km,
                specialized_type,
            );

            // Mettre en cache avec TTL adaptatif (1h pour recherches populaires, 5min sinon)
            let ttl = if is_popular_search {
                Duration::from_secs(3600) // 1h pour recherches populaires
            } else {
                Duration::from_secs(300) // 5min pour recherches normales
            };

            if let Err(e) = search_cache
                .cache_results(&cache_key, fulltext_results.clone(), ttl, is_popular_search)
                .await
            {
                log::warn!(
                    "[NativeSearch] ⚠️ Erreur mise en cache multi-niveaux: {}",
                    e
                );
            } else {
                log::debug!("[NativeSearch] 💾 Résultats mis en cache multi-niveaux: {} (TTL: {:?}, populaire: {})", 
                    cache_key, ttl, is_popular_search);
            }
        }

        // ✅ Fallback: Ancien cache via ScalabilityService
        if let Some(scalability) = &self.scalability_service {
            let filters = serde_json::json!({
                "category": category_filter,
                "location": location_or_input_filter,
                "gps_zone": gps_zone,
                "search_radius_km": search_radius_km,
                "specialized_type": specialized_type,
            });
            let cache_key = scalability.generate_search_cache_key(search_query, &filters);

            // Mettre en cache avec TTL de 5 minutes
            if let Ok(results_json) = serde_json::to_value(&fulltext_results) {
                if let Err(e) = scalability
                    .cache_search_results(&cache_key, &results_json, Duration::from_secs(300))
                    .await
                {
                    log::warn!(
                        "[NativeSearch] ⚠️ Erreur mise en cache ScalabilityService: {}",
                        e
                    );
                } else {
                    log::debug!(
                        "[NativeSearch] 💾 Résultats mis en cache ScalabilityService: {}",
                        cache_key
                    );
                }
            }
        }

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
        // ✅ NETTOYÉ : Pas de specialized_type dans la recherche générale
        self.fulltext_search_with_gps(query, category_filter, location_filter, None, None, None)
            .await
    }

    /// Recherche full-text intelligente avec filtrage GPS
    /// ✅ NETTOYÉ 2025-11-27 : Recherche 100% générale - Plus de détection/redirection vers services spécialisés
    /// Les services spécialisés sont accessibles UNIQUEMENT via la page dédiée (menu spécialisé)
    /// Paramètre specialized_type: uniquement pour recherche spécialisée dédiée (hors recherche générale)
    async fn fulltext_search_with_gps(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        specialized_type: Option<&str>, // ✅ Utilisé uniquement pour recherche spécialisée dédiée (hors recherche générale)
    ) -> AppResult<Vec<SearchResult>> {
        // ✅ NETTOYÉ 2025-11-27 : Si specialized_type fourni → Recherche spécialisée dédiée (hors recherche générale)
        // Sinon → Recherche générale pure (sans aucune détection spécialisée)
        if let Some(ref st) = specialized_type {
            log_info(&format!(
                "[NativeSearch] 🔷 Recherche spécialisée dédiée: '{}'",
                st
            ));

            // Mapper specialized_type vers SearchIntent pour recherche spécialisée
            let intent = match *st {
                "pharmacie" => crate::services::scheduling_search_service::SearchIntent::SpecializedPharmacy,
                "hopital_clinique" => crate::services::scheduling_search_service::SearchIntent::SpecializedHospital,
                "laboratoire_imagerie" => crate::services::scheduling_search_service::SearchIntent::SpecializedLaboratory,
                "agence_voyage" => crate::services::scheduling_search_service::SearchIntent::SpecializedTravelAgency,
                "covoiturage" => crate::services::scheduling_search_service::SearchIntent::SpecializedCovoiturage,
                "taxi_ville" => crate::services::scheduling_search_service::SearchIntent::SpecializedTaxi,
                "banque_sang" => crate::services::scheduling_search_service::SearchIntent::SpecializedBloodBank,
                _ => {
                    return Err(crate::core::types::AppError::BadRequest(format!(
                        "Type spécialisé non reconnu: '{}'",
                        st
                    )));
                }
            };

            // ✅ RECHERCHE SPÉCIALISÉE avec planification et moment intégrés
            let _scheduling_service = SchedulingSearchService::new(self.pool.clone());
            let radius = search_radius_km.unwrap_or(50);
            let mut specialized_results: Vec<SearchResult> = Vec::new();

            log_info(&format!(
                "[NativeSearch] 🔷 Recherche spécialisée dédiée avec planification/moment: {:?}",
                intent
            ));

            match intent {
                crate::services::scheduling_search_service::SearchIntent::SpecializedPharmacy => {
                    let sql = r#"
                        SELECT 
                            pharmacy_id as id,
                            service_id,
                            nom,
                            adresse,
                            quartier,
                            ville,
                            gps,
                            telephone,
                            whatsapp,
                            is_on_duty_now,
                            distance_km,
                            relevance_score
                        FROM search_pharmacies_with_moment($1, $2, $3, FALSE)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche pharmacies: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get::<i32, _>("service_id");
                        let nom: String = row.get::<String, _>("nom");
                        let is_on_duty: bool = row.get::<bool, _>("is_on_duty_now");
                        let distance: Option<f64> = row.get::<Option<f64>, _>("distance_km");
                        let score: f64 = row.get::<f64, _>("relevance_score");

                        // Construire data JSONB
                        let data = serde_json::json!({
                            "titre_service": {"valeur": nom},
                            "type": "pharmacie",
                            "is_on_duty_now": is_on_duty,
                            "adresse": row.get::<Option<String>, _>("adresse"),
                            "quartier": row.get::<Option<String>, _>("quartier"),
                            "ville": row.get::<Option<String>, _>("ville"),
                            "telephone": row.get::<Option<String>, _>("telephone"),
                            "whatsapp": row.get::<Option<String>, _>("whatsapp"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_pharmacy".to_string(),
                            matched_fields: vec!["nom".to_string(), "is_on_duty_now".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedHospital => {
                    let sql = r#"
                        SELECT 
                            hospital_id as id,
                            service_id,
                            nom,
                            type_etablissement,
                            adresse,
                            quartier,
                            ville,
                            gps,
                            telephone,
                            whatsapp,
                            is_available_now,
                            distance_km,
                            relevance_score
                        FROM search_hospitals_with_moment($1, $2, $3, FALSE)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche hôpitaux: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get::<i32, _>("service_id");
                        let nom: String = row.get::<String, _>("nom");
                        let is_available: bool = row.get::<bool, _>("is_available_now");
                        let distance: Option<f64> = row.get::<Option<f64>, _>("distance_km");
                        let score: f64 = row.get::<f64, _>("relevance_score");

                        let data = serde_json::json!({
                            "titre_service": {"valeur": nom},
                            "type": "hopital_clinique",
                            "is_available_now": is_available,
                            "type_etablissement": row.get::<Option<String>, _>("type_etablissement"),
                            "adresse": row.get::<Option<String>, _>("adresse"),
                            "telephone": row.get::<Option<String>, _>("telephone"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_hospital".to_string(),
                            matched_fields: vec!["nom".to_string(), "is_available_now".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedLaboratory => {
                    let sql = r#"
                        SELECT 
                            laboratory_id as id,
                            service_id,
                            nom,
                            type_laboratoire,
                            adresse,
                            quartier,
                            ville,
                            gps,
                            telephone,
                            whatsapp,
                            is_available_now,
                            distance_km,
                            relevance_score
                        FROM search_laboratories_with_moment($1, $2, $3)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche laboratoires: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get::<i32, _>("service_id");
                        let nom: String = row.get::<String, _>("nom");
                        let distance: Option<f64> = row.get::<Option<f64>, _>("distance_km");
                        let score: f64 = row.get::<f64, _>("relevance_score");

                        let data = serde_json::json!({
                            "titre_service": {"valeur": nom},
                            "type": "laboratoire_imagerie",
                            "type_laboratoire": row.get::<Option<String>, _>("type_laboratoire"),
                            "adresse": row.get::<Option<String>, _>("adresse"),
                            "telephone": row.get::<Option<String>, _>("telephone"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_laboratory".to_string(),
                            matched_fields: vec!["nom".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedTravelAgency => {
                    let sql = r#"
                        SELECT 
                            agency_id as id,
                            service_id,
                            nom_agence,
                            adresse,
                            quartier,
                            ville,
                            gps,
                            telephone,
                            whatsapp,
                            peut_emettre_tickets_bus,
                            distance_km,
                            relevance_score
                        FROM search_travel_agencies_with_moment($1, $2, $3)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche agences: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get::<i32, _>("service_id");
                        let nom: String = row.get::<String, _>("nom_agence");
                        let distance: Option<f64> = row.get::<Option<f64>, _>("distance_km");
                        let score: f64 = row.get::<f64, _>("relevance_score");

                        let data = serde_json::json!({
                            "titre_service": {"valeur": nom},
                            "type": "agence_voyage",
                            "peut_emettre_tickets_bus": row.get::<bool, _>("peut_emettre_tickets_bus"),
                            "adresse": row.get::<Option<String>, _>("adresse"),
                            "telephone": row.get::<Option<String>, _>("telephone"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_travel_agency".to_string(),
                            matched_fields: vec!["nom_agence".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedCovoiturage => {
                    let sql = r#"
                        SELECT 
                            covoiturage_id as id,
                            service_id,
                            depart,
                            destination,
                            gps_depart,
                            date_depart,
                            heure_depart,
                            nombre_places,
                            places_disponibles,
                            prix_par_place,
                            devise,
                            distance_km,
                            relevance_score
                        FROM search_covoiturages_with_moment($1, $2, $3, NULL)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche covoiturages: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get::<i32, _>("service_id");
                        let depart: String = row.get::<String, _>("depart");
                        let destination: String = row.get::<String, _>("destination");
                        let distance: Option<f64> = row.get::<Option<f64>, _>("distance_km");
                        let score: f64 = row.get::<f64, _>("relevance_score");

                        let data = serde_json::json!({
                            "titre_service": {"valeur": format!("{} → {}", depart, destination)},
                            "type": "covoiturage",
                            "depart": depart,
                            "destination": destination,
                            "date_depart": row.get::<chrono::DateTime<chrono::Utc>, _>("date_depart").to_rfc3339(),
                            "places_disponibles": row.get::<i32, _>("places_disponibles"),
                            "prix_par_place": row.get::<i32, _>("prix_par_place"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_covoiturage".to_string(),
                            matched_fields: vec!["depart".to_string(), "destination".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedTaxi => {
                    let sql = r#"
                        SELECT 
                            taxi_id as id,
                            service_id,
                            nom_chauffeur,
                            telephone,
                            whatsapp,
                            zone_intervention,
                            gps_actuel,
                            is_available_now,
                            is_on_duty,
                            distance_km,
                            relevance_score
                        FROM search_taxis_with_moment($1, $2, $3, TRUE)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche taxis: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get::<i32, _>("service_id");
                        let nom: Option<String> = row.get::<Option<String>, _>("nom_chauffeur");
                        let telephone: String = row.get::<String, _>("telephone");
                        let distance: Option<f64> = row.get::<Option<f64>, _>("distance_km");
                        let score: f64 = row.get::<f64, _>("relevance_score");

                        let data = serde_json::json!({
                            "titre_service": {"valeur": nom.clone().unwrap_or_else(|| format!("Taxi {}", telephone))},
                            "type": "taxi_ville",
                            "telephone": telephone,
                            "is_available_now": row.get::<bool, _>("is_available_now"),
                            "zone_intervention": row.get::<Option<Vec<String>>, _>("zone_intervention"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_taxi".to_string(),
                            matched_fields: vec!["telephone".to_string(), "is_available_now".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedBloodBank => {
                    // Utiliser la fonction du service scheduling
                    let scheduling_service = SchedulingSearchService::new(self.pool.clone());
                    let (user_lat, user_lng) = if let Some(zone) = gps_zone {
                        if let Some((lat_str, lng_str)) = zone.split_once(',') {
                            (lat_str.parse().ok(), lng_str.parse().ok())
                        } else {
                            (None, None)
                        }
                    } else {
                        (None, None)
                    };

                    let blood_bank_results = scheduling_service
                        .search_banques_sang_with_moment(query, user_lat, user_lng, Some(radius as f64))
                        .await
                        .map_err(|e| format!("Erreur recherche banques de sang: {}", e))?;

                    for r in blood_bank_results {
                        specialized_results.push(SearchResult {
                            service_id: r.service_id,
                            data: r.product_data,
                            total_score: r.relevance_score as f32,
                            fulltext_score: r.relevance_score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_blood_bank".to_string(),
                            matched_fields: vec!["nom".to_string(), "stocks_groupes_sanguins".to_string()],
                            distance_km: r.distance_km,
                            gps_coords: None,
                        });
                    }
                }
                _ => {
                    // Ne devrait pas arriver ici
                    log::warn!("[NativeSearch] Intent spécialisé non géré: {:?}", intent);
                }
            }

            // ✅ OPTIMISÉ 2025-11-28: Enrichir tous les résultats spécialisés avec Google Places en BATCH (1 requête SQL)
            // ✅ OPTIMISÉ 2025-12-01: Enrichissement Google Places batch désactivé par défaut (trop lent)
            // if let Err(e) = crate::services::enrich_google_places::enrich_search_results_batch(
            //     &self.pool,
            //     &mut specialized_results
            // ).await {
            //     log::warn!(
            //         "[NativeSearch] Erreur enrichissement batch Google Places: {}",
            //         e
            //     );
            // }

            // ✅ OPTIMISÉ 2025-11-28: Désactivé enrichissement Google Maps par défaut (trop lent: 5s par appel)
            // La distance est déjà calculée par PostgreSQL dans search_*_with_moment() et retournée dans distance_km
            // ProductCard peut calculer la distance côté client si nécessaire
            // if let Some(gps_zone_val) = gps_zone {
            //     if let Some((lat_str, lng_str)) = gps_zone_val.split_once(',') {
            //         if let (Ok(user_lat), Ok(user_lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
            //             SearchResult::enrich_with_google_maps(
            //                 &mut specialized_results,
            //                 Some((user_lat, user_lng)),
            //                 self.geographic_matching.as_ref(),
            //             ).await;
            //         }
            //     }
            // }

            log_info(&format!(
                "[NativeSearch] ✅ {} résultats spécialisés trouvés avec planification/moment",
                specialized_results.len()
            ));

            // ✅ Recherche spécialisée dédiée : retourner directement les résultats (pas de fallback)
            return Ok(specialized_results);
        }

        // ✅ RECHERCHE GÉNÉRALE : Avec planification (ex: "pharmacie de garde") mais SANS vérifier existence services spécialisés
        log_info(&format!(
            "[NativeSearch] 🔍 Recherche générale pure (sans vérification services spécialisés)"
        ));

        let scheduling_service = SchedulingSearchService::new(self.pool.clone());

        // ✅ NETTOYÉ 2025-11-27 : Analyser UNIQUEMENT les intentions de planification (pas de détection de services spécialisés)
        // Utiliser analyze_scheduling_intent_only() pour éviter de détecter SpecializedPharmacy, etc.
        let intent = scheduling_service.analyze_scheduling_intent_only(query);

        // Si recherche avec planification, utiliser la fonction spécialisée (dans la recherche générale)
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
                    search_method: "scheduling_search".to_string(),
                    matched_fields: vec!["planification".to_string(), "disponibilité".to_string()],
                    distance_km: r.distance_km,
                    gps_coords: None, // Sera enrichi si nécessaire
                })
                .collect();

            // ✅ OPTIMISÉ 2025-11-28: Enrichir tous les résultats avec Google Places en BATCH (1 requête SQL)
            // ✅ OPTIMISÉ 2025-12-01: Enrichissement Google Places batch désactivé par défaut (trop lent)
            // if let Err(e) = crate::services::enrich_google_places::enrich_search_results_batch(
            //     &self.pool,
            //     &mut results
            // ).await {
            //     log::warn!(
            //         "[NativeSearch] Erreur enrichissement batch Google Places: {}",
            //         e
            //     );
            // }

            // ✅ OPTIMISÉ 2025-11-28: Désactivé enrichissement Google Maps par défaut (trop lent: 5s par appel)
            // La distance est déjà calculée par PostgreSQL et retournée dans distance_km
            // ProductCard peut calculer la distance côté client si nécessaire
            // if let Some(gps_zone) = gps_zone {
            //     if let Some((lat_str, lng_str)) = gps_zone.split_once(',') {
            //         if let (Ok(user_lat), Ok(user_lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
            //             SearchResult::enrich_with_google_maps(
            //                 &mut results,
            //                 Some((user_lat, user_lng)),
            //                 self.geographic_matching.as_ref(),
            //             ).await;
            //         }
            //     }
            // }

            log_info(&format!(
                "[NativeSearch] {} résultats avec planifications trouvés",
                results.len()
            ));
            return Ok(results);
        }
        // Utiliser notre fonction PostgreSQL optimisée si GPS est fourni
        if let Some(gps_zone_val) = gps_zone {
            let radius = search_radius_km.unwrap_or(50);

            log_info(&format!("[NativeSearch] Utilisation de search_services_gps_final avec GPS: {} et rayon: {}km", gps_zone_val, radius));

            // ✅ NOUVEAU 2025-11-30: Enrichir la requête avec les variations avant d'appeler la fonction SQL
            let expanded_query = self.expand_search_query_with_variations(query);
            if expanded_query != query {
                log_info(&format!(
                    "[NativeSearch] Requête enrichie pour search_services_gps_final (fulltext): '{}' → '{}'",
                    query, expanded_query
                ));
            }

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

            // ✅ CORRECTION 2025-11-27 : Utiliser retry_query pour cohérence et meilleure gestion d'erreurs
            let query_clone = expanded_query.clone(); // ✅ NOUVEAU 2025-11-30: Utiliser la requête enrichie
            let gps_zone_val_clone = gps_zone_val.to_string();
            let pool_clone = self.pool.clone();
            let sql_static = sql.to_string();
            let radius_clone = radius;
            let results = retry_query(
                &self.pool,
                move || {
                    let query = query_clone.clone();
                    let gps_zone_val = gps_zone_val_clone.clone();
                    let pool = pool_clone.clone();
                    let sql = sql_static.clone();
                    let radius = radius_clone;
                    Box::pin(async move {
                        sqlx::query(sql.as_str())
                            .bind(query.as_str())
                            .bind(gps_zone_val.as_str())
                            .bind(radius)
                            .bind(100i32) // ✅ CORRIGÉ: max_results (4ème paramètre requis)
                            .fetch_all(&pool)
                            .await
                    })
                },
                3, // max_retries
            )
            .await;

            // ✅ CORRIGÉ: Si la recherche GPS échoue, fallback vers recherche sans GPS
            // L'erreur "structure of query does not match function result type" peut survenir
            // si la fonction SQL a été modifiée ou si la base de données n'est pas à jour
            match results {
                Ok(rows) if !rows.is_empty() => {
                    // ✅ CORRIGÉ: Traiter les résultats GPS si disponibles
                    let mut search_results = Vec::new();
                    let service_ids: Vec<i32> =
                        rows.iter().map(|r| r.get::<i32, _>("service_id")).collect();

                    // ✅ OPTIMISÉ 2025-12-01 : Batch query pour éviter N+1 - récupérer toutes les données en une seule requête
                    let service_data_map: std::collections::HashMap<i32, Value> =
                        if !service_ids.is_empty() {
                            sqlx::query("SELECT id, data FROM services WHERE id = ANY($1)")
                                .bind(&service_ids)
                                .fetch_all(&self.pool)
                                .await
                                .map(|rows| {
                                    rows.into_iter()
                                        .map(|row| {
                                            (row.get::<i32, _>("id"), row.get::<Value, _>("data"))
                                        })
                                        .collect()
                                })
                                .unwrap_or_default()
                        } else {
                            std::collections::HashMap::new()
                        };

                    for row in rows {
                        let service_id: i32 = row.get::<i32, _>("service_id");
                        let _titre_service: String = row.get::<String, _>("titre_service");
                        let _category: Option<String> = row.get::<Option<String>, _>("category");
                        let _gps_coords: Option<String> =
                            row.get::<Option<String>, _>("gps_coords");
                        let _distance_km: Option<f64> = row.get::<Option<f64>, _>("distance_km");
                        let relevance_score: f32 = row.get::<f32, _>("relevance_score");
                        let _gps_source: Option<String> =
                            row.get::<Option<String>, _>("gps_source");

                        // ✅ OPTIMISÉ 2025-12-01 : Récupérer depuis le batch query au lieu de requête individuelle
                        let service_data = service_data_map
                            .get(&service_id)
                            .cloned()
                            .unwrap_or_else(|| serde_json::json!({}));

                        // ✅ OPTIMISÉ 2025-12-01: Enrichissement Google Places désactivé par défaut (trop lent: 100-500ms par service)
                        // Utiliser enrich_search_results_batch() en batch au lieu de enrich_service_with_google_places_data() séquentiel
                        // if let Err(e) = crate::services::enrich_google_places::enrich_service_with_google_places_data(
                        //     &self.pool,
                        //     service_id,
                        //     &mut service_data
                        // ).await {
                        //     log::warn!(
                        //         "[NativeSearch] Erreur enrichissement Google Places pour service {}: {}",
                        //         service_id,
                        //         e
                        //     );
                        // }

                        // ✅ Phase 10 - Extraire les coordonnées GPS pour enrichissement Google Maps
                        let gps_coords = _gps_coords.as_ref().and_then(|coords| {
                            coords
                                .split(',')
                                .map(|s| s.trim().parse::<f64>().ok())
                                .collect::<Option<Vec<_>>>()
                                .and_then(|v| {
                                    if v.len() == 2 {
                                        Some((v[0], v[1]))
                                    } else {
                                        None
                                    }
                                })
                        });

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
                            distance_km: _distance_km,
                            gps_coords,
                        });

                        log_info(&format!(
                            "[NativeSearch] Service {} trouvé à {:.2}km (source: {})",
                            service_id,
                            _distance_km.unwrap_or(0.0),
                            _gps_source.unwrap_or_else(|| "unknown".to_string())
                        ));
                    }

                    log_info(&format!(
                        "[NativeSearch] Recherche GPS optimisée: {} résultats trouvés",
                        search_results.len()
                    ));

                    // ✅ OPTIMISÉ 2025-12-01: Enrichissement Google Places batch désactivé par défaut (trop lent: 100-500ms par service)
                    // La distance est déjà calculée par PostgreSQL dans search_services_gps_final() et retournée dans distance_km
                    // if let Err(e) = crate::services::enrich_google_places::enrich_search_results_batch(
                    //     &self.pool,
                    //     &mut search_results
                    // ).await {
                    //     log::warn!(
                    //         "[NativeSearch] Erreur enrichissement batch Google Places: {}",
                    //         e
                    //     );
                    // }

                    // ✅ OPTIMISÉ 2025-12-01: Enrichissement Google Places désactivé par défaut (trop lent: 100-500ms par service)
                    // La distance est déjà calculée par PostgreSQL dans search_services_gps_final() et retournée dans distance_km
                    // ProductCard peut calculer la distance côté client si nécessaire
                    // Pour réactiver: décommenter le code ci-dessous et utiliser enrich_service_with_google_places_data en batch
                    // if let Some((lat_str, lng_str)) = gps_zone_val.split_once(',') {
                    //     if let (Ok(user_lat), Ok(user_lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
                    //         SearchResult::enrich_with_google_maps(
                    //             &mut search_results,
                    //             Some((user_lat, user_lng)),
                    //             self.geographic_matching.as_ref(),
                    //         ).await;
                    //     }
                    // }

                    return Ok(search_results);
                }
                Ok(_) => {
                    // Résultats vides, continuer avec fallback
                    log_info("[NativeSearch] Recherche GPS retournée vide, fallback vers recherche sans GPS");
                }
                Err(e) => {
                    let error_msg = e.to_string();

                    // Vérifier si c'est une erreur de structure de requête
                    if error_msg.contains("structure of query does not match function result type")
                    {
                        log::warn!(
                            "[NativeSearch] ⚠️ Erreur structure requête GPS - Fallback vers recherche sans GPS. Erreur: {}",
                            error_msg
                        );
                    } else {
                        log_error(&format!(
                            "[NativeSearch] Échec recherche GPS après retry: {}",
                            error_msg
                        ));
                    }
                    // ✅ CORRIGÉ: Le code continue naturellement avec la recherche sans GPS ci-dessous
                }
            }
        }

        // ✅ OPTIMISÉ 2025-11-28: Vérifier le cache Redis avant d'exécuter la requête SQL
        let cache_key =
            self.build_search_cache_key(query, category_filter, location_filter, gps_zone);
        if let Some(ref cache) = self.cache_service {
            if let Ok(Some(cached_results)) = cache.get::<Vec<SearchResult>>(&cache_key).await {
                log_info(&format!(
                    "[NativeSearch] ✅ Résultats récupérés du cache pour: '{}' ({} résultats)",
                    query,
                    cached_results.len()
                ));
                return Ok(cached_results);
            }
        }

        // ✅ NETTOYÉ 2025-11-27 : Recherche générale pure (sans fusion avec résultats spécialisés)
        // Fallback vers l'ancienne méthode si pas de GPS ou si recherche GPS a échoué
        // ✅ OPTIMISÉ 2025-11-28 : Requête SQL optimisée avec CTE pour réduire les calculs répétés
        // - Utilise des CTE (Common Table Expressions) pour éviter les calculs répétés de jsonb_array_elements
        // - Réduit de ~4-5 passes sur les produits à 1 seule passe
        // - Recommandation: Ajouter index GIN sur services.data pour améliorer les performances JSONB:
        //   CREATE INDEX IF NOT EXISTS idx_services_data_gin ON services USING GIN (data);
        //   CREATE INDEX IF NOT EXISTS idx_services_data_text ON services USING GIN (to_tsvector('french', COALESCE(data->>'titre_service'->>'valeur', '')));
        //   CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_service_id ON autocomplete_characteristics(service_id) WHERE is_real_product = TRUE;
        // ✅ NOUVEAU 2025-11-30: Enrichir la requête avec les variations
        let expanded_query = self.expand_search_query_with_variations(query);
        if expanded_query != query {
            log_info(&format!(
                "[NativeSearch] Requête enrichie pour recherche full-text: '{}' → '{}'",
                query, expanded_query
            ));
        }

        let partial_conditions = self.create_partial_match_conditions(query, "ape");

        // ✅ NOUVEAU 2025-11-30: Utiliser la requête enrichie dans la requête SQL
        let query_to_use = expanded_query; // Utiliser la requête enrichie

        let sql = format!(
            r#"
WITH all_products_extracted AS (
    -- ✅ CORRIGÉ 2025-12-12: Extraire TOUS les produits de TOUS les services actifs
    -- Inclut les services depuis services.data->'produits' ET depuis autocomplete_characteristics
    -- pour garantir que tous les produits sont trouvés, même si services.data->'produits' est vide
    SELECT DISTINCT
        s.id as service_id,
        s.data,
        s.created_at,
        s.user_id,
        s.gps,
        s.category,
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END as products_array
    FROM services s
    WHERE s.is_active = true
    AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
    
    UNION
    
    -- ✅ NOUVEAU 2025-12-12: Inclure les services depuis autocomplete_characteristics
    -- même s'ils n'ont pas de produits dans services.data->'produits'
    -- Cela garantit que tous les produits indexés dans autocomplete_characteristics sont trouvables
    SELECT DISTINCT
        s.id as service_id,
        s.data,
        s.created_at,
        s.user_id,
        s.gps,
        s.category,
        '[]'::jsonb as products_array  -- Produits dans autocomplete_characteristics, pas dans services.data
    FROM services s
    INNER JOIN autocomplete_characteristics ac ON ac.service_id = s.id
    WHERE s.is_active = true
    AND ac.is_real_product = TRUE
    AND ac.identifiant_base = 'produits'
    AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
),
products_extracted AS (
    -- ✅ CORRIGÉ 2025-12-XX: Filtrer sur les PRODUITS qui matchent
    -- Utilise extract_all_product_text ET autocomplete_characteristics.full_vector
    SELECT DISTINCT
        ape.service_id,
        ape.data,
        ape.created_at,
        ape.user_id,
        ape.gps,
        ape.category,
        ape.products_array
    FROM all_products_extracted ape
    WHERE (
        -- ✅ Recherche dans les PRODUITS (GÉNÉRIQUE - tous champs via extract_all_product_text)
        EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(ape.products_array) AS product
            WHERE (
                -- ✅ GÉNÉRIQUE : Recherche dans TOUS les champs du produit
                extract_all_product_text(product) ILIKE '%' || $1 || '%'
                -- ✅ OU recherche dans les champs principaux (pour performance)
                OR product->>'nom' ILIKE '%' || $1 || '%'
                OR product->>'nom_produit' ILIKE '%' || $1 || '%'  -- ✅ NOUVEAU: Support nom_produit
                OR product->>'categorie' ILIKE '%' || $1 || '%'
                OR product->>'description' ILIKE '%' || $1 || '%'
            )
        )
        -- ✅ NOUVEAU 2025-12-XX: Recherche dans autocomplete_characteristics.full_vector
        -- Car certaines descriptions sont uniquement dans autocomplete_characteristics, pas dans services.data->'produits'
        OR EXISTS (
            SELECT 1 
            FROM autocomplete_characteristics ac
            WHERE ac.service_id = ape.service_id
            AND ac.is_real_product = TRUE
            AND ac.identifiant_base = 'produits'
            AND EXISTS (
                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                WHERE LOWER(vec_val) LIKE '%' || LOWER($1) || '%'
            )
        )
        -- ✅ OU recherche dans les champs service (pour services sans produits)
        -- ✅ CORRIGÉ 2025-12-01: Utiliser ILIKE ET similarité pour trouver les variations (plombier/plomberie, photographe/photographie)
        OR COALESCE(ape.data->>'titre_service', ape.data->'titre_service'->>'valeur', '') ILIKE '%' || $1 || '%'
        OR COALESCE(ape.data->>'description', ape.data->'description'->>'valeur', '') ILIKE '%' || $1 || '%'
        OR COALESCE(ape.data->>'category', ape.data->'category'->>'valeur', ape.category, '') ILIKE '%' || $1 || '%'
        -- ✅ CORRIGÉ 2025-12-01: Utiliser word_similarity() au lieu de similarity() pour trouver un mot dans une phrase
        -- word_similarity() cherche le meilleur match dans la chaîne (ex: "plombier" dans "plomberie" = 0.556)
        -- Seuil 0.6 pour éliminer au maximum les faux positifs
        OR word_similarity(LOWER($1), LOWER(COALESCE(ape.data->'titre_service'->>'valeur', ape.data->>'titre_service', ''))) > 0.6
        OR word_similarity(LOWER($1), LOWER(COALESCE(ape.data->'description'->>'valeur', ape.data->>'description', ''))) > 0.6
        OR word_similarity(LOWER($1), LOWER(COALESCE(ape.data->'category'->>'valeur', ape.data->>'category', ape.category, ''))) > 0.6
        -- ✅ Conditions partielles pour correspondances avec accents
        OR ({})
    )
),
products_scored AS (
    -- ✅ OPTIMISÉ 2025-11-29: Calculer tous les scores produits en une seule passe (GÉNÉRIQUE)
    SELECT 
        pe.service_id,
        COALESCE(SUM(
            CASE 
                -- ✅ GÉNÉRIQUE : Prioriser correspondances dans extract_all_product_text (tous champs)
                WHEN LOWER(extract_all_product_text(product)) = LOWER($1) THEN 25.0
                WHEN LOWER(extract_all_product_text(product)) LIKE LOWER($1) || '%' THEN 18.0
                -- Correspondances dans champs principaux (pour performance)
                WHEN LOWER(COALESCE(product->>'nom', '')) = LOWER($1) THEN 20.0
                WHEN product->>'nom' ILIKE '%' || $1 || '%' THEN 12.0
                WHEN product->>'categorie' ILIKE '%' || $1 || '%' THEN 10.0
                WHEN product->>'description' ILIKE '%' || $1 || '%' THEN 8.0
                -- ✅ GÉNÉRIQUE : Correspondance dans tout le texte extrait (tous champs)
                WHEN extract_all_product_text(product) ILIKE '%' || $1 || '%' THEN 6.0
                ELSE 0.0
            END +
            CASE 
                -- ✅ CORRIGÉ : Utiliser unaccent_immutable() pour utiliser les index
                WHEN unaccent_immutable(COALESCE(product->>'nom', '')) ILIKE '%' || unaccent_immutable($1) || '%' THEN 12.0
                WHEN unaccent_immutable(COALESCE(product->>'categorie', '')) ILIKE '%' || unaccent_immutable($1) || '%' THEN 10.0
                WHEN unaccent_immutable(COALESCE(product->>'description', '')) ILIKE '%' || unaccent_immutable($1) || '%' THEN 8.0
                -- ✅ GÉNÉRIQUE : Recherche avec unaccent_immutable dans tout le texte
                WHEN unaccent_immutable(extract_all_product_text(product)) ILIKE '%' || unaccent_immutable($1) || '%' THEN 6.0
                ELSE 0.0
            END +
            -- ✅ GÉNÉRIQUE : Full-text search sur tout le texte du produit (avec requête enrichie)
            ts_rank(to_tsvector('french', extract_all_product_text(product)), plainto_tsquery('french', $1)) * 10.0 +
            -- ✅ CORRIGÉ 2025-12-01: Utiliser word_similarity() au lieu de similarity() pour trouver un mot dans une phrase
            -- Seuil 0.6 pour éliminer au maximum les faux positifs
            CASE 
                WHEN word_similarity(LOWER($1), LOWER(extract_all_product_text(product))) > 0.6 THEN 
                    word_similarity(LOWER($1), LOWER(extract_all_product_text(product))) * 8.0
                ELSE 0.0
            END
        ), 0.0) as product_score,
        COALESCE(SUM(
            CASE 
                WHEN product->>'nom' ILIKE '%' || word || '%' THEN 8.0
                WHEN product->>'categorie' ILIKE '%' || word || '%' THEN 6.0
                WHEN product->>'description' ILIKE '%' || word || '%' THEN 5.0
                -- ✅ GÉNÉRIQUE : Recherche par mot dans tout le texte
                WHEN extract_all_product_text(product) ILIKE '%' || word || '%' THEN 4.0
                ELSE 0.0
            END
        ), 0.0) as product_word_score
    FROM products_extracted pe,
        jsonb_array_elements(pe.products_array) AS product,
        unnest(string_to_array($1, ' ')) AS word
    GROUP BY pe.service_id
),
autocomplete_scored AS (
    -- ✅ CORRIGÉ 2025-12-XX: Calculer les scores autocomplete en incluant full_vector
    -- full_vector contient souvent plus d'informations que characteristic_vector
    SELECT 
        ac.service_id,
        SUM(
            -- Score basé sur characteristic_vector
            8.0 * (
                SELECT COUNT(*)::REAL FROM unnest(ac.characteristic_vector) AS vec_val
                WHERE vec_val ILIKE '%' || $1 || '%'
            ) * LEAST(3.0, 1.0 + (ac.usage_count::REAL / 10.0)) +
            -- ✅ NOUVEAU: Score basé sur full_vector (priorité plus élevée car contient descriptions complètes)
            12.0 * (
                SELECT COUNT(*)::REAL FROM unnest(ac.full_vector) AS vec_val
                WHERE LOWER(vec_val) LIKE '%' || LOWER($1) || '%'
            ) * LEAST(3.0, 1.0 + (ac.usage_count::REAL / 10.0))
        ) as autocomplete_score
    FROM autocomplete_characteristics ac
    WHERE ac.identifiant_base LIKE 'produit%'
    AND ac.is_real_product = TRUE
    AND (
        EXISTS (
            SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
            WHERE vec_val ILIKE '%' || $1 || '%'
        )
        OR EXISTS (
            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
            WHERE LOWER(vec_val) LIKE '%' || LOWER($1) || '%'
        )
    )
    GROUP BY ac.service_id
)
SELECT DISTINCT
    pe.service_id as id,
    pe.data,
    pe.created_at,
    pe.user_id,
    pe.gps,
    pe.category,
    (
        -- Score SERVICE (réduit) - avec requête enrichie et trigram
        (
            ts_rank(to_tsvector('french', COALESCE(pe.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', $1)) * 1.5 +
            ts_rank(to_tsvector('french', COALESCE(pe.data->'description'->>'valeur', '')), plainto_tsquery('french', $1)) * 1.0 +
            ts_rank(to_tsvector('french', COALESCE(pe.data->'category'->>'valeur', '')), plainto_tsquery('french', $1)) * 1.0 +
            -- ✅ CORRIGÉ 2025-12-01: Utiliser word_similarity() au lieu de similarity() pour trouver un mot dans une phrase
            -- word_similarity() cherche le meilleur match dans la chaîne (ex: "plombier" dans "plomberie" = 0.556)
            -- Seuil 0.6 pour éliminer au maximum les faux positifs
            CASE 
                WHEN word_similarity(LOWER($1), LOWER(COALESCE(pe.data->'category'->>'valeur', pe.category, ''))) > 0.6 THEN 
                    word_similarity(LOWER($1), LOWER(COALESCE(pe.data->'category'->>'valeur', pe.category, ''))) * 9.0
                ELSE 0.0
            END +
            CASE 
                WHEN word_similarity(LOWER($1), LOWER(COALESCE(pe.data->'titre_service'->>'valeur', ''))) > 0.6 THEN 
                    word_similarity(LOWER($1), LOWER(COALESCE(pe.data->'titre_service'->>'valeur', ''))) * 8.0
                ELSE 0.0
            END
        ) +
        (
            -- ✅ CORRIGÉ : Utiliser unaccent_immutable() pour utiliser les index full-text
            ts_rank(to_tsvector('french', unaccent_immutable(COALESCE(pe.data->'titre_service'->>'valeur', ''))), plainto_tsquery('french', unaccent_immutable($1))) * 2.0 +
            ts_rank(to_tsvector('french', unaccent_immutable(COALESCE(pe.data->'description'->>'valeur', ''))), plainto_tsquery('french', unaccent_immutable($1))) * 1.0 +
            ts_rank(to_tsvector('french', unaccent_immutable(COALESCE(pe.data->'category'->>'valeur', ''))), plainto_tsquery('french', unaccent_immutable($1))) * 1.5
        ) +
        -- ✅ OPTIMISÉ 2025-11-29: Prioriser correspondances exactes (bonus élevé)
        CASE 
            WHEN LOWER(pe.data->'titre_service'->>'valeur') = LOWER($1) THEN 20.0
            WHEN LOWER(pe.data->'titre_service'->>'valeur') LIKE LOWER($1) || '%' THEN 10.0
            WHEN pe.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' THEN 5.0
            WHEN LOWER(pe.data->'category'->>'valeur') = LOWER($1) THEN 15.0
            WHEN LOWER(pe.data->'category'->>'valeur') LIKE LOWER($1) || '%' THEN 8.0
            WHEN pe.data->'category'->>'valeur' ILIKE '%' || $1 || '%' THEN 4.0
            WHEN pe.data->'description'->>'valeur' ILIKE '%' || $1 || '%' THEN 2.0
            ELSE 0.0
        END +
        CASE 
            -- ✅ CORRIGÉ : Utiliser unaccent_immutable() pour utiliser les index trigram
            WHEN unaccent_immutable(pe.data->'titre_service'->>'valeur') ILIKE '%' || unaccent_immutable($1) || '%' THEN 2.5
            WHEN unaccent_immutable(pe.data->'description'->>'valeur') ILIKE '%' || unaccent_immutable($1) || '%' THEN 1.5
            WHEN unaccent_immutable(pe.data->'category'->>'valeur') ILIKE '%' || unaccent_immutable($1) || '%' THEN 2.0
            ELSE 0.0
        END +
        (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN pe.data->'titre_service'->>'valeur' ILIKE '%' || word || '%' THEN 2.0
                    WHEN pe.data->'description'->>'valeur' ILIKE '%' || word || '%' THEN 1.0
                    WHEN pe.data->'category'->>'valeur' ILIKE '%' || word || '%' THEN 1.5
                    ELSE 0.0
                END
            ), 0.0)
            FROM unnest(string_to_array($1, ' ')) AS word
        ) +
        -- Score PRODUITS (utilise les CTE) - PRIORITÉ ÉLEVÉE car on cherche dans les produits
        COALESCE(ps.product_score, 0.0) * 2.0 +
        COALESCE(ps.product_word_score, 0.0) +
        COALESCE(acs.autocomplete_score, 0.0) +
        CASE 
            WHEN pe.data->'produits'->'characteristic_vector' IS NOT NULL THEN
                (
                    SELECT COUNT(*)::REAL * 8.0
                    FROM jsonb_array_elements_text(pe.data->'produits'->'characteristic_vector') AS vec_val
                    WHERE vec_val ILIKE '%' || $1 || '%'
                )
            ELSE 0.0
        END
    )::REAL as fulltext_score
FROM products_extracted pe
LEFT JOIN products_scored ps ON ps.service_id = pe.service_id
LEFT JOIN autocomplete_scored acs ON acs.service_id = pe.service_id
WHERE ($2::text IS NULL OR pe.category = $2 OR pe.data->'category'->>'valeur' = $2)
AND (
    $3::text IS NULL
    OR (
        pe.gps ILIKE '%' || $3 || '%'
        OR EXISTS (
            SELECT 1 FROM autocomplete_characteristics ac
            WHERE ac.service_id = pe.service_id
            AND ac.is_real_product = TRUE
            AND ac.location_vector IS NOT NULL
            AND array_length(ac.location_vector, 1) > 0
            -- ✅ OPTIMISÉ 2025-12-01 : Utiliser directement && avec l'index GIN (beaucoup plus rapide)
            AND ac.location_vector && string_to_array(LOWER($3), ' ')
        )
    )
)
ORDER BY fulltext_score DESC
LIMIT 100
        "#,
            partial_conditions
        );

        // ✅ CORRECTION 2025-11-27 : Utiliser retry_query pour cohérence et meilleure gestion d'erreurs
        let query_clone = query_to_use.clone(); // ✅ NOUVEAU 2025-11-30: Utiliser la requête enrichie
        let category_filter_clone = category_filter.map(|s| s.to_string());
        let location_filter_clone = location_filter.map(|s| s.to_string());
        let sql_clone = sql.clone();
        let pool_clone = self.pool.clone();

        let results = retry_query(
            &self.pool,
            move || {
                let query = query_clone.clone(); // ✅ NOUVEAU: Contient déjà la requête enrichie
                let category_filter = category_filter_clone.clone();
                let location_filter = location_filter_clone.clone();
                let sql = sql_clone.clone();
                let pool = pool_clone.clone();
                Box::pin(async move {
                    // ✅ CORRIGÉ: Utiliser les String directement pour éviter les problèmes de lifetime
                    // sqlx accepte String et Option<String> pour .bind()
                    sqlx::query(sql.as_str())
                        .bind(query) // ✅ NOUVEAU: Contient la requête enrichie avec variations
                        .bind(category_filter)
                        .bind(location_filter)
                        .fetch_all(&pool)
                        .await
                })
            },
            3, // max_retries
        )
        .await
        .map_err(|e| {
            log_error(&format!(
                "[NativeSearch] Erreur recherche full-text après retry: {}",
                e
            ));
            crate::core::types::AppError::Internal(format!("Erreur recherche full-text: {}", e))
        })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get::<i32, _>("id");
            let data: Value = row.get::<Value, _>("data");
            let _created_at: chrono::DateTime<chrono::Utc> =
                row.get::<chrono::DateTime<chrono::Utc>, _>("created_at");
            let _user_id: i32 = row.get::<i32, _>("user_id");
            let _gps: Option<String> = row.get::<Option<String>, _>("gps");
            let _category: Option<String> = row.get::<Option<String>, _>("category");
            // Gérer le cas où fulltext_score peut être NULL
            let fulltext_score: f32 = row.get::<f32, _>("fulltext_score");

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
                distance_km: None,
                gps_coords: None,
            });
        }

        // ✅ NETTOYÉ 2025-11-27 : Recherche générale pure (pas de fusion avec résultats spécialisés)

        // Trier par score total
        search_results.sort_by(|a, b| {
            b.total_score
                .partial_cmp(&a.total_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // ✅ OPTIMISÉ 2025-12-01: Mettre en cache les résultats (TTL 10 minutes pour réduire charge DB)
        if let Some(ref cache) = self.cache_service {
            // TTL configurable via env, défaut 10 minutes (600s) au lieu de 5 minutes
            let cache_ttl_secs: u64 = std::env::var("CACHE_TTL_SEARCH")
                .unwrap_or_else(|_| "600".to_string())
                .parse()
                .unwrap_or(600);
            let cache_ttl = Duration::from_secs(cache_ttl_secs);
            if let Err(e) = cache
                .set_with_ttl(&cache_key, &search_results, cache_ttl)
                .await
            {
                log::warn!(
                    "[NativeSearch] ⚠️ Erreur mise en cache des résultats pour '{}': {}",
                    query,
                    e
                );
            } else {
                log_info(&format!(
                    "[NativeSearch] 💾 Résultats mis en cache pour: '{}' (TTL: {}s)",
                    query,
                    cache_ttl.as_secs()
                ));
            }
        }

        Ok(search_results)
    }

    /// ✅ OPTIMISÉ 2025-11-28 - Construit une clé de cache unique pour une recherche
    fn build_search_cache_key(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
    ) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        query.hash(&mut hasher);
        category_filter.hash(&mut hasher);
        location_filter.hash(&mut hasher);
        gps_zone.hash(&mut hasher);
        let hash = hasher.finish();

        format!("search:fulltext:{}", hash)
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
    async fn trigram_search_with_gps(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
    ) -> AppResult<Vec<SearchResult>> {
        // Utiliser notre fonction PostgreSQL optimisée si GPS est fourni
        if let Some(gps_zone_val) = gps_zone {
            let radius = search_radius_km.unwrap_or(50);

            log_info(&format!(
                "[NativeSearch] Trigram avec GPS optimisé: {} et rayon: {}km",
                gps_zone_val, radius
            ));

            // ✅ NOUVEAU 2025-11-30: Enrichir la requête avec les variations
            let expanded_query = self.expand_search_query_with_variations(query);
            if expanded_query != query {
                log_info(&format!(
                    "[NativeSearch] Requête enrichie pour search_services_gps_final (trigram): '{}' → '{}'",
                    query, expanded_query
                ));
            }

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
                .bind(&expanded_query) // ✅ NOUVEAU 2025-11-30: Utiliser la requête enrichie
                .bind(gps_zone_val)
                .bind(radius)
                .bind(100i32) // ✅ CORRIGÉ: max_results (4ème paramètre requis)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    log_error(&format!(
                        "[NativeSearch] Erreur trigram GPS optimisé: {}",
                        e
                    ));
                    crate::core::types::AppError::Internal(format!(
                        "Erreur trigram GPS optimisé: {}",
                        e
                    ))
                })?;

            // ✅ OPTIMISÉ 2025-12-01 : Batch query pour éviter N+1
            let service_ids: Vec<i32> = results
                .iter()
                .map(|r| r.get::<i32, _>("service_id"))
                .collect();
            let service_data_map: std::collections::HashMap<i32, Value> = if !service_ids.is_empty()
            {
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
                let service_id: i32 = row.get::<i32, _>("service_id");
                let _titre_service: String = row.get::<String, _>("titre_service");
                let _category: Option<String> = row.get::<Option<String>, _>("category");
                let _gps_coords: Option<String> = row.get::<Option<String>, _>("gps_coords");
                let _distance_km: Option<f64> = row.get::<Option<f64>, _>("distance_km");
                let relevance_score: f32 = row.get::<f32, _>("relevance_score");
                let _gps_source: Option<String> = row.get::<Option<String>, _>("gps_source");

                // ✅ OPTIMISÉ 2025-12-01 : Récupérer depuis le batch query
                let service_data = service_data_map
                    .get(&service_id)
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({}));

                // ✅ OPTIMISÉ 2025-12-01: Enrichissement Google Places désactivé par défaut (trop lent: 100-500ms par service)
                // Utiliser enrich_search_results_batch() en batch au lieu de enrich_service_with_google_places_data() séquentiel
                // if let Err(e) = crate::services::enrich_google_places::enrich_service_with_google_places_data(
                //     &self.pool,
                //     service_id,
                //     &mut service_data
                // ).await {
                //     log::warn!(
                //         "[NativeSearch] Erreur enrichissement Google Places pour service {}: {}",
                //         service_id,
                //         e
                //     );
                // }

                // ✅ Phase 10 - Extraire les coordonnées GPS
                let gps_coords = _gps_coords.as_ref().and_then(|coords| {
                    coords
                        .split(',')
                        .map(|s| s.trim().parse::<f64>().ok())
                        .collect::<Option<Vec<_>>>()
                        .and_then(|v| {
                            if v.len() == 2 {
                                Some((v[0], v[1]))
                            } else {
                                None
                            }
                        })
                });

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
                    distance_km: _distance_km,
                    gps_coords,
                });
            }

            // ✅ OPTIMISÉ 2025-12-01: Enrichissement Google Places batch désactivé par défaut (trop lent)
            // if let Err(e) = crate::services::enrich_google_places::enrich_search_results_batch(
            //     &self.pool,
            //     &mut search_results
            // ).await {
            //     log::warn!(
            //         "[NativeSearch] Erreur enrichissement batch Google Places: {}",
            //         e
            //     );
            // }

            // ✅ OPTIMISÉ 2025-11-28: Désactivé enrichissement Google Maps par défaut (trop lent: 5s par appel)
            // La distance est déjà calculée par PostgreSQL dans search_services_gps_final() et retournée dans distance_km
            // ProductCard peut calculer la distance côté client si nécessaire
            // if let Some((lat_str, lng_str)) = gps_zone_val.split_once(',') {
            //     if let (Ok(user_lat), Ok(user_lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
            //         SearchResult::enrich_with_google_maps(
            //             &mut search_results,
            //             Some((user_lat, user_lng)),
            //             self.geographic_matching.as_ref(),
            //         ).await;
            //     }
            // }

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
            AND (
                $3::text IS NULL
                OR (
                    s.gps ILIKE '%' || $3 || '%'
                    OR EXISTS (
                        SELECT 1 FROM autocomplete_characteristics ac
                        WHERE ac.service_id = s.id
                        AND ac.is_real_product = TRUE
                        AND (
                            -- ✅ OPTIMISÉ 2025-12-01 : Utiliser directement && avec l'index GIN (beaucoup plus rapide)
                            ac.location_vector IS NOT NULL
                            AND array_length(ac.location_vector, 1) > 0
                            AND ac.location_vector && string_to_array(LOWER($3), ' ')
                        )
                    )
                )
            )
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
            let service_id: i32 = row.get::<i32, _>("id");
            let data: Value = row.get::<Value, _>("data");
            let _created_at: chrono::DateTime<chrono::Utc> =
                row.get::<chrono::DateTime<chrono::Utc>, _>("created_at");
            let _user_id: i32 = row.get::<i32, _>("user_id");
            let _gps: Option<String> = row.get::<Option<String>, _>("gps");
            let _category: Option<String> = row.get::<Option<String>, _>("category");
            // Gérer le cas où trigram_score peut être NULL
            let trigram_score: f32 = row.get::<f32, _>("trigram_score");

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
                distance_km: None,
                gps_coords: None,
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
        if let Some(gps_zone_val) = gps_zone {
            let radius = search_radius_km.unwrap_or(50);

            log_info(&format!(
                "[NativeSearch] Mots-clés avec GPS optimisé: {} et rayon: {}km",
                gps_zone_val, radius
            ));

            // ✅ NOUVEAU 2025-11-30: Enrichir la requête avec les variations
            let expanded_query = self.expand_search_query_with_variations(query);
            if expanded_query != query {
                log_info(&format!(
                    "[NativeSearch] Requête enrichie pour search_services_gps_final (keyword): '{}' → '{}'",
                    query, expanded_query
                ));
            }

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
                .bind(&expanded_query) // ✅ NOUVEAU 2025-11-30: Utiliser la requête enrichie
                .bind(gps_zone_val)
                .bind(radius)
                .bind(100i32) // ✅ CORRIGÉ: max_results (4ème paramètre requis)
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

            // ✅ OPTIMISÉ 2025-12-01 : Batch query pour éviter N+1
            let service_ids: Vec<i32> = results
                .iter()
                .map(|r| r.get::<i32, _>("service_id"))
                .collect();
            let service_data_map: std::collections::HashMap<i32, Value> = if !service_ids.is_empty()
            {
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
                let service_id: i32 = row.get::<i32, _>("service_id");
                let _titre_service: String = row.get::<String, _>("titre_service");
                let _category: Option<String> = row.get::<Option<String>, _>("category");
                let _gps_coords: Option<String> = row.get::<Option<String>, _>("gps_coords");
                let _distance_km: Option<f64> = row.get::<Option<f64>, _>("distance_km");
                let relevance_score: f32 = row.get::<f32, _>("relevance_score");
                let _gps_source: Option<String> = row.get::<Option<String>, _>("gps_source");

                // ✅ OPTIMISÉ 2025-12-01 : Récupérer depuis le batch query
                let service_data = service_data_map
                    .get(&service_id)
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({}));

                // ✅ OPTIMISÉ 2025-12-01: Enrichissement Google Places désactivé par défaut (trop lent: 100-500ms par service)
                // Utiliser enrich_search_results_batch() en batch au lieu de enrich_service_with_google_places_data() séquentiel
                // if let Err(e) = crate::services::enrich_google_places::enrich_service_with_google_places_data(
                //     &self.pool,
                //     service_id,
                //     &mut service_data
                // ).await {
                //     log::warn!(
                //         "[NativeSearch] Erreur enrichissement Google Places pour service {}: {}",
                //         service_id,
                //         e
                //     );
                // }

                // ✅ Phase 10 - Extraire les coordonnées GPS pour enrichissement Google Maps
                let gps_coords = _gps_coords.as_ref().and_then(|coords| {
                    coords
                        .split(',')
                        .map(|s| s.trim().parse::<f64>().ok())
                        .collect::<Option<Vec<_>>>()
                        .and_then(|v| {
                            if v.len() == 2 {
                                Some((v[0], v[1]))
                            } else {
                                None
                            }
                        })
                });

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
                    distance_km: _distance_km,
                    gps_coords,
                });
            }

            // ✅ OPTIMISÉ 2025-12-01: Enrichissement Google Places batch désactivé par défaut (trop lent)
            // if let Err(e) = crate::services::enrich_google_places::enrich_search_results_batch(
            //     &self.pool,
            //     &mut search_results
            // ).await {
            //     log::warn!(
            //         "[NativeSearch] Erreur enrichissement batch Google Places: {}",
            //         e
            //     );
            // }

            // ✅ OPTIMISÉ 2025-11-28: Désactivé enrichissement Google Maps par défaut (trop lent: 5s par appel)
            // La distance est déjà calculée par PostgreSQL dans search_services_gps_final() et retournée dans distance_km
            // ProductCard peut calculer la distance côté client si nécessaire
            // if let Some((lat_str, lng_str)) = gps_zone_val.split_once(',') {
            //     if let (Ok(user_lat), Ok(user_lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
            //         SearchResult::enrich_with_google_maps(
            //             &mut search_results,
            //             Some((user_lat, user_lng)),
            //             self.geographic_matching.as_ref(),
            //         ).await;
            //     }
            // }

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

        let sql = format!(
            r#"
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
            AND (
                $3::text IS NULL
                OR (
                    s.gps ILIKE '%' || $3 || '%'
                    OR EXISTS (
                        SELECT 1 FROM autocomplete_characteristics ac
                        WHERE ac.service_id = s.id
                        AND ac.is_real_product = TRUE
                        AND (
                            -- ✅ OPTIMISÉ 2025-12-01 : Utiliser directement && avec l'index GIN (beaucoup plus rapide)
                            ac.location_vector IS NOT NULL
                            AND array_length(ac.location_vector, 1) > 0
                            AND ac.location_vector && string_to_array(LOWER($3), ' ')
                        )
                    )
                )
            )
            ORDER BY keyword_score DESC
        "#,
            conditions.join(" OR ")
        );

        let results = sqlx::query(&sql)
            .bind(query)
            .bind(category_filter)
            .bind(location_filter)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                log_error(&format!(
                    "[NativeSearch] Erreur recherche par mots clés: {}",
                    e
                ));
                crate::core::types::AppError::Internal(format!(
                    "Erreur recherche par mots clés: {}",
                    e
                ))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get::<i32, _>("id");
            let data: Value = row.get::<Value, _>("data");
            let _created_at: chrono::DateTime<chrono::Utc> =
                row.get::<chrono::DateTime<chrono::Utc>, _>("created_at");
            let _user_id: i32 = row.get::<i32, _>("user_id");
            let _gps: Option<String> = row.get::<Option<String>, _>("gps");
            let _category: Option<String> = row.get::<Option<String>, _>("category");
            // Gérer le cas où keyword_score peut être NULL
            let keyword_score: f32 = row.get::<f32, _>("keyword_score");

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
                distance_km: None,
                gps_coords: None,
            });
        }

        Ok(search_results)
    }

    /// ✅ NOUVEAU 2025-11-30: Enrichir la requête avec les variations (profession ↔ activité)
    /// Exemple: "plombier" → "plombier | plomberie"
    /// Permet au full-text search de matcher les variations
    fn expand_search_query_with_variations(&self, query: &str) -> String {
        let query_lowercase = query.to_lowercase();
        let query_lower = query_lowercase.trim();
        let mut expanded_terms = vec![query_lower.to_string()];

        // Mapping bidirectionnel : profession ↔ activité
        let variations = vec![
            ("plombier", "plomberie"),
            ("plomberie", "plombier"),
            ("électricien", "électricité"),
            ("électricité", "électricien"),
            ("electricien", "électricité"), // Sans accent
            ("menuisier", "menuiserie"),
            ("menuiserie", "menuisier"),
            ("maçon", "maçonnerie"),
            ("maçonnerie", "maçon"),
            ("macon", "maçonnerie"), // Sans accent
            ("peintre", "peinture"),
            ("peinture", "peintre"),
            ("couvreur", "couverture"),
            ("couverture", "couvreur"),
            ("chauffeur", "transport"),
            ("taxi", "transport"),
            ("livreur", "livraison"),
            ("livraison", "livreur"),
            ("restaurant", "restauration"),
            ("restauration", "restaurant"),
            ("coiffeur", "coiffure"),
            ("coiffure", "coiffeur"),
            ("médecin", "santé"),
            ("medecin", "santé"),
            ("pharmacie", "santé"),
            ("hôpital", "santé"),
            ("hopital", "santé"),
        ];

        // Pour chaque mot de la requête, chercher des variations
        let words: Vec<&str> = query_lower.split_whitespace().collect();
        for word in &words {
            for (from, to) in &variations {
                // Si le mot correspond exactement ou contient la variation
                if word == from || word.contains(from) {
                    // Remplacer dans la requête
                    let expanded_word = word.replace(from, to);
                    if expanded_word != *word {
                        expanded_terms.push(expanded_word.clone());
                    }
                    // Ajouter aussi le terme de variation seul
                    if !expanded_terms.contains(&to.to_string()) {
                        expanded_terms.push(to.to_string());
                    }
                    // Si le mot contient la variation, ajouter aussi la version avec remplacement partiel
                    if word.contains(from) {
                        let replaced_query = query_lower.replace(from, to);
                        if replaced_query != query_lower {
                            expanded_terms.push(replaced_query);
                        }
                    }
                }
            }
        }

        // Créer une requête enrichie avec OR pour full-text search PostgreSQL
        // Format: "plombier | plomberie" (utilise l'opérateur | de tsquery)
        // Dédupliquer et joindre avec |
        use std::collections::HashSet;
        let unique_terms: Vec<String> = expanded_terms
            .into_iter()
            .collect::<HashSet<String>>()
            .into_iter()
            .collect();

        if unique_terms.len() > 1 {
            unique_terms.join(" | ") // Format: "plombier | plomberie" pour plainto_tsquery()
        } else {
            query.to_string() // Si pas de variations trouvées, retourner la requête originale
        }
    }

    /// Normalisation avancée avec gestion des accents et variantes
    /// ✅ NOUVEAU 2025-11-29: Détecter la catégorie probable à partir de la requête
    /// Exemple: "électricien" → "électricité", "plombier" → "plomberie"
    fn detect_category_from_query(&self, query: &str) -> Option<String> {
        let query_lower = query.to_lowercase();

        // Mapping profession → catégorie
        let category_mappings = vec![
            ("électricien", "électricité"),
            ("electricien", "électricité"),
            ("plombier", "plomberie"),
            ("plomberie", "plomberie"),
            ("menuisier", "menuiserie"),
            ("menuiserie", "menuiserie"),
            ("maçon", "maçonnerie"),
            ("maçonnerie", "maçonnerie"),
            ("peintre", "peinture"),
            ("peinture", "peinture"),
            ("couvreur", "couverture"),
            ("couverture", "couverture"),
            ("chauffeur", "transport"),
            ("taxi", "transport"),
            ("livreur", "livraison"),
            ("livraison", "livraison"),
            ("restaurant", "restauration"),
            ("restauration", "restauration"),
            ("coiffeur", "coiffure"),
            ("coiffure", "coiffure"),
            ("médecin", "santé"),
            ("medecin", "santé"),
            ("pharmacie", "santé"),
            ("hôpital", "santé"),
            ("hopital", "santé"),
        ];

        for (profession, category) in category_mappings {
            if query_lower.contains(profession) {
                return Some(category.to_string());
            }
        }

        None
    }

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
    fn create_partial_match_conditions(&self, query: &str, table_alias: &str) -> String {
        let words: Vec<&str> = query.split_whitespace().collect();
        let mut conditions = Vec::new();

        for word in words {
            // Correspondances exactes
            conditions.push(format!(
                "{}.data->'titre_service'->>'valeur' ILIKE '%{}%' OR {}.data->'description'->>'valeur' ILIKE '%{}%' OR {}.data->'category'->>'valeur' ILIKE '%{}%'",
                table_alias, word, table_alias, word, table_alias, word
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
                    "unaccent_immutable({}.data->'titre_service'->>'valeur') ILIKE '%{}%' OR unaccent_immutable({}.data->'description'->>'valeur') ILIKE '%{}%' OR unaccent_immutable({}.data->'category'->>'valeur') ILIKE '%{}%'",
                    table_alias, without_accents, table_alias, without_accents, table_alias, without_accents
                ));
            }

            // Correspondances bidirectionnelles : mot sans accents dans base avec accents
            conditions.push(format!(
                "unaccent({}.data->'titre_service'->>'valeur') ILIKE '%{}%' OR unaccent({}.data->'description'->>'valeur') ILIKE '%{}%' OR unaccent({}.data->'category'->>'valeur') ILIKE '%{}%'",
                table_alias, word, table_alias, word, table_alias, word
            ));

            // Correspondances partielles pour mots longs (ex: "gestionnaire" -> "gestion")
            let chars: Vec<char> = word.chars().collect();
            if chars.len() > 4 {
                // Prendre seulement les 4 premiers caractères pour éviter trop de correspondances
                let substring: String = chars[..4].iter().collect();
                conditions.push(format!(
                    "{}.data->'titre_service'->>'valeur' ILIKE '%{}%' OR {}.data->'description'->>'valeur' ILIKE '%{}%' OR {}.data->'category'->>'valeur' ILIKE '%{}%'",
                    table_alias, substring, table_alias, substring, table_alias, substring
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
               "#;

        let results = sqlx::query(sql)
            .bind(category)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                log_error(&format!(
                    "[NativeSearch] Erreur recherche par catégorie: {}",
                    e
                ));
                crate::core::types::AppError::Internal(format!(
                    "Erreur recherche par catégorie: {}",
                    e
                ))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get::<i32, _>("id");
            let data: Value = row.get::<Value, _>("data");
            let created_at: chrono::DateTime<chrono::Utc> =
                row.get::<chrono::DateTime<chrono::Utc>, _>("created_at");
            let _user_id: i32 = row.get::<i32, _>("user_id");
            let _gps: Option<String> = row.get::<Option<String>, _>("gps");
            let _category: Option<String> = row.get::<Option<String>, _>("category");

            let recency_score = self.calculate_recency_score(&created_at);

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
                distance_km: None,
                gps_coords: None,
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
            sqlx::query(sql)
                .bind(location)
                .bind(lat)
                .bind(lng)
                .fetch_all(&self.pool)
                .await
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
            let service_id: i32 = row.get::<i32, _>("id");
            let data: Value = row.get::<Value, _>("data");
            let created_at: chrono::DateTime<chrono::Utc> =
                row.get::<chrono::DateTime<chrono::Utc>, _>("created_at");
            let _user_id: i32 = row.get::<i32, _>("user_id");
            let _gps: Option<String> = row.get::<Option<String>, _>("gps");
            let _category: Option<String> = row.get::<Option<String>, _>("category");
            let location_score: f32 = row.get::<f32, _>("location_score");

            let recency_score = self.calculate_recency_score(&created_at);

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
                distance_km: None,
                gps_coords: None,
            });
        }

        Ok(search_results)
    }
}

/// Conversion des résultats de recherche en format JSON pour l'API
impl SearchResult {
    /// ✅ Phase 10 - Enrichit les distances avec Google Maps si disponible, fallback Haversine
    pub async fn enrich_with_google_maps(
        results: &mut [SearchResult],
        user_location: Option<(f64, f64)>,
        geographic_matching: Option<
            &Arc<crate::services::geographic_matching_service::GeographicMatchingService>,
        >,
    ) {
        if let (Some(user_loc), Some(geo_service)) = (user_location, geographic_matching) {
            for result in results.iter_mut() {
                // Enrichir seulement si on a des coordonnées GPS
                if let Some(service_coords) = result.gps_coords {
                    // Enrichir si pas de distance ou si c'est une recherche GPS (pour améliorer la précision)
                    if result.distance_km.is_none() || result.search_method.contains("gps") {
                        // calculate_distance utilise Google Maps avec fallback Haversine automatique
                        match geo_service
                            .calculate_distance(user_loc, service_coords)
                            .await
                        {
                            Ok(distance_result) => {
                                let distance_km = distance_result.distance_meters / 1000.0;

                                // Prioriser Google Maps si disponible, sinon utiliser Haversine
                                match distance_result.source {
                                    crate::services::geographic_matching_service::DistanceSource::GoogleMaps => {
                                        // Toujours utiliser Google Maps (meilleure précision)
                                        result.distance_km = Some(distance_km);
                                        log::debug!(
                                            "[NativeSearch] ✅ Distance enrichie Google Maps pour service {}: {:.2}km",
                                            result.service_id,
                                            distance_km
                                        );
                                    }
                                    crate::services::geographic_matching_service::DistanceSource::Haversine => {
                                        // Utiliser Haversine seulement si on n'a pas déjà de distance PostgreSQL
                                        // (PostgreSQL ST_Distance est généralement plus précis que Haversine simple)
                                        if result.distance_km.is_none() {
                                            result.distance_km = Some(distance_km);
                                            log::debug!(
                                                "[NativeSearch] ⚠️ Distance calculée Haversine (fallback) pour service {}: {:.2}km",
                                                result.service_id,
                                                distance_km
                                            );
                                        } else {
                                            // Garder la distance PostgreSQL existante (plus précise que Haversine)
                                            log::debug!(
                                                "[NativeSearch] ℹ️ Distance PostgreSQL conservée pour service {}: {:.2}km (Google Maps indisponible)",
                                                result.service_id,
                                                result.distance_km.unwrap()
                                            );
                                        }
                                    }
                                    crate::services::geographic_matching_service::DistanceSource::Cache => {
                                        // Le cache retourne le résultat original avec sa source (GoogleMaps ou Haversine)
                                        // Ce cas ne devrait normalement pas être atteint, mais on le gère pour sécurité
                                        if result.distance_km.is_none() {
                                            result.distance_km = Some(distance_km);
                                            log::debug!(
                                                "[NativeSearch] ℹ️ Distance depuis cache pour service {}: {:.2}km",
                                                result.service_id,
                                                distance_km
                                            );
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                // En cas d'erreur, garder la distance PostgreSQL existante ou utiliser Haversine local
                                if result.distance_km.is_none() {
                                    // Fallback ultime : calcul Haversine local
                                    use crate::services::delivery_service::haversine_distance;
                                    let haversine_km = haversine_distance(user_loc, service_coords);
                                    result.distance_km = Some(haversine_km);
                                    log::warn!(
                                        "[NativeSearch] ⚠️ Erreur calcul distance pour service {}: {:?}, utilisation Haversine local: {:.2}km",
                                        result.service_id,
                                        e,
                                        haversine_km
                                    );
                                } else {
                                    log::warn!(
                                        "[NativeSearch] ⚠️ Erreur enrichissement distance pour service {}: {:?}, conservation distance PostgreSQL: {:.2}km",
                                        result.service_id,
                                        e,
                                        result.distance_km.unwrap()
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn to_json(&self) -> Value {
        serde_json::json!({
            "service_id": self.service_id,
            "data": self.data,
            "score": self.total_score,
            "semantic_score": self.total_score, // Compatibilité avec l'ancien format
            "interaction_score": 0.0,
            "gps": self.data.get("gps").and_then(|v| v.as_str()),
            "distance_km": self.distance_km, // ✅ Phase 10 - Distance enrichie
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

/// ✅ NOUVEAU 2025-12-02: Requête de recherche paginée avec cursor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedSearchRequest {
    pub query: String,
    pub category_filter: Option<String>,
    pub location_filter: Option<String>,
    pub gps_zone: Option<String>,
    pub search_radius_km: Option<i32>,
    pub cursor: Option<String>, // Cursor pour pagination (base64 encodé)
    pub page_size: Option<u32>, // Taille de page (max 100, défaut 20)
    pub specialized_type: Option<String>, // Type spécialisé si recherche dédiée
}

/// ✅ NOUVEAU 2025-12-02: Réponse de recherche paginée
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedSearchResponse {
    pub results: Vec<SearchResult>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
    pub total_estimated: Option<u64>, // Estimation (pas de COUNT exact pour performance)
}

impl NativeSearchService {
    /// ✅ NOUVEAU 2025-12-02: Recherche paginée avec cursor-based pagination
    /// Permet de gérer des millions de résultats sans charger tout en mémoire
    pub async fn intelligent_search_paginated(
        &self,
        request: PaginatedSearchRequest,
    ) -> AppResult<PaginatedSearchResponse> {
        let start_time = std::time::Instant::now();
        let page_size = request.page_size.unwrap_or(20).min(100); // Max 100 par page

        log_info(&format!(
            "[NativeSearch] 🔄 Recherche paginée: '{}' (page_size: {}, cursor: {:?})",
            request.query,
            page_size,
            request
                .cursor
                .as_ref()
                .map(|c| c.chars().take(20).collect::<String>())
        ));

        // Décoder le cursor (contient last_service_id + last_score)
        let (last_service_id, last_score) = if let Some(cursor) = &request.cursor {
            match self.decode_cursor(cursor) {
                Ok((sid, score)) => (sid, score),
                Err(e) => {
                    log::warn!(
                        "[NativeSearch] ⚠️ Erreur décodage cursor: {}, recherche sans cursor",
                        e
                    );
                    (None, None)
                }
            }
        } else {
            (None, None)
        };

        // Vérifier le cache multi-niveaux
        if let Some(ref search_cache) = self.search_cache_service {
            let cache_key = search_cache.generate_cache_key(
                &request.query,
                request.category_filter.as_deref(),
                request.location_filter.as_deref(),
                request.gps_zone.as_deref(),
                request.search_radius_km,
                request.specialized_type.as_deref(),
            );

            // Pour la pagination, on ne met en cache que la première page (cursor=None)
            if request.cursor.is_none() {
                if let Ok(Some(cached_results)) = search_cache
                    .get_cached_results(&cache_key, &request.query)
                    .await
                {
                    log_info(&format!(
                        "[NativeSearch] ✅ Cache hit pour recherche paginée: '{}' ({} résultats)",
                        request.query,
                        cached_results.len()
                    ));

                    // Limiter aux page_size premiers résultats
                    let cached_len = cached_results.len();
                    let results: Vec<SearchResult> = cached_results
                        .into_iter()
                        .take(page_size as usize)
                        .collect();

                    let has_more = cached_len > page_size as usize;
                    let next_cursor = if has_more && !results.is_empty() {
                        if let Some(last) = results.last() {
                            self.encode_cursor(last.service_id, last.total_score).ok()
                        } else {
                            None
                        }
                    } else {
                        None
                    };

                    return Ok(PaginatedSearchResponse {
                        results,
                        next_cursor,
                        has_more,
                        total_estimated: None,
                    });
                }
            }
        }

        // Utiliser la vue matérialisée si disponible pour performance optimale
        let use_materialized_view = true; // Toujours utiliser la vue si disponible

        let sql = if use_materialized_view {
            // Requête optimisée avec vue matérialisée
            format!(
                r#"
                WITH search_results AS (
                    SELECT 
                        sso.service_id as id,
                        sso.data,
                        sso.created_at,
                        sso.user_id,
                        sso.gps,
                        sso.category,
                        -- Score calculé rapidement depuis vue matérialisée
                        (
                            ts_rank(sso.search_vector, plainto_tsquery('french', $1)) * 2.0 +
                            ts_rank(sso.products_vector, plainto_tsquery('french', $1)) * 3.0
                        )::FLOAT as total_score
                    FROM services_search_optimized sso
                    WHERE sso.is_active = TRUE
                    AND ($2::text IS NULL OR sso.category = $2)
                    -- Filtre cursor pour pagination (score DESC, puis id DESC)
                    AND (
                        $3::int IS NULL OR
                        (
                            (ts_rank(sso.search_vector, plainto_tsquery('french', $1)) * 2.0 +
                             ts_rank(sso.products_vector, plainto_tsquery('french', $1)) * 3.0) < $4::FLOAT
                            OR (
                                (ts_rank(sso.search_vector, plainto_tsquery('french', $1)) * 2.0 +
                                 ts_rank(sso.products_vector, plainto_tsquery('french', $1)) * 3.0) = $4::FLOAT
                                AND sso.service_id < $3
                            )
                        )
                    )
                    -- Recherche full-text
                    AND (
                        sso.search_vector @@ plainto_tsquery('french', $1)
                        OR sso.products_vector @@ plainto_tsquery('french', $1)
                    )
                    ORDER BY total_score DESC, sso.service_id DESC
                    LIMIT $5
                )
                SELECT * FROM search_results
                "#
            )
        } else {
            // Fallback vers recherche normale (sans vue matérialisée)
            format!(
                r#"
                WITH search_results AS (
                    SELECT 
                        s.id,
                        s.data,
                        s.created_at,
                        s.user_id,
                        s.gps,
                        s.category,
                        -- Score calculé
                        (
                            ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), 
                                    plainto_tsquery('french', $1)) * 2.0 +
                            COALESCE((
                                SELECT SUM(
                                    CASE 
                                        WHEN extract_all_product_text(product) ILIKE '%' || $1 || '%' THEN 6.0
                                        WHEN product->>'nom' ILIKE '%' || $1 || '%' THEN 12.0
                                        ELSE 0.0
                                    END
                                )
                                FROM jsonb_array_elements(
                                    CASE 
                                        WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                        THEN s.data->'produits'
                                        ELSE '[]'::jsonb
                                    END
                                ) AS product
                            ), 0.0) * 2.0
                        )::FLOAT as total_score
                    FROM services s
                    WHERE s.is_active = true
                    AND ($2::text IS NULL OR s.category = $2)
                    -- Filtre cursor pour pagination
                    AND (
                        $3::int IS NULL OR
                        (
                            (ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), 
                                    plainto_tsquery('french', $1)) * 2.0 +
                             COALESCE((
                                SELECT SUM(
                                    CASE 
                                        WHEN extract_all_product_text(product) ILIKE '%' || $1 || '%' THEN 6.0
                                        WHEN product->>'nom' ILIKE '%' || $1 || '%' THEN 12.0
                                        ELSE 0.0
                                    END
                                )
                                FROM jsonb_array_elements(
                                    CASE 
                                        WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                        THEN s.data->'produits'
                                        ELSE '[]'::jsonb
                                    END
                                ) AS product
                            ), 0.0) * 2.0) < $4::FLOAT
                            OR (
                                (ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), 
                                        plainto_tsquery('french', $1)) * 2.0 +
                                 COALESCE((
                                    SELECT SUM(
                                        CASE 
                                            WHEN extract_all_product_text(product) ILIKE '%' || $1 || '%' THEN 6.0
                                            WHEN product->>'nom' ILIKE '%' || $1 || '%' THEN 12.0
                                            ELSE 0.0
                                        END
                                    )
                                    FROM jsonb_array_elements(
                                        CASE 
                                            WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                            THEN s.data->'produits'
                                            ELSE '[]'::jsonb
                                        END
                                    ) AS product
                                ), 0.0) * 2.0) = $4::FLOAT
                                AND s.id < $3
                            )
                        )
                    )
                    -- Recherche full-text
                    AND (
                        to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) 
                        @@ plainto_tsquery('french', $1)
                        OR EXISTS (
                            SELECT 1 FROM jsonb_array_elements(
                                CASE 
                                    WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                    THEN s.data->'produits'
                                    ELSE '[]'::jsonb
                                END
                            ) AS product
                            WHERE extract_all_product_text(product) ILIKE '%' || $1 || '%'
                        )
                    )
                    ORDER BY total_score DESC, s.id DESC
                    LIMIT $5
                )
                SELECT * FROM search_results
                "#
            )
        };

        // ✅ NOUVEAU 2025-12-02: Utiliser read replica pour lectures (scaling horizontal)
        let read_pool = self.get_read_pool();
        let rows = sqlx::query(&sql)
            .bind(&request.query)
            .bind(&request.category_filter)
            .bind(last_service_id)
            .bind(last_score.unwrap_or(0.0))
            .bind(page_size as i32 + 1) // +1 pour vérifier has_more
            .fetch_all(read_pool)
            .await?;

        let has_more = rows.len() > page_size as usize;
        let mut results: Vec<SearchResult> = Vec::new();

        for row in rows.iter().take(page_size as usize) {
            let service_id: i32 = row.get::<i32, _>("id");
            let data: Value = row.get::<Value, _>("data");
            let total_score: f32 = row.get::<f32, _>("total_score");
            let created_at: chrono::DateTime<chrono::Utc> =
                row.get::<chrono::DateTime<chrono::Utc>, _>("created_at");
            let _user_id: i32 = row.get::<i32, _>("user_id");
            let gps: Option<String> = row.get::<Option<String>, _>("gps");
            let category: Option<String> = row.get::<Option<String>, _>("category");

            results.push(SearchResult {
                service_id,
                data,
                total_score,
                fulltext_score: total_score * 0.6, // Estimation
                trigram_score: 0.0,
                recency_score: self.calculate_recency_score(&created_at),
                category_score: if category
                    .as_ref()
                    .map(|c| c == request.category_filter.as_deref().unwrap_or(""))
                    .unwrap_or(false)
                {
                    5.0
                } else {
                    0.0
                },
                search_method: "paginated".to_string(),
                matched_fields: vec!["titre_service".to_string(), "produits".to_string()],
                distance_km: None,
                gps_coords: gps.and_then(|g| {
                    g.split_once(',')
                        .and_then(|(lat, lng)| Some((lat.parse().ok()?, lng.parse().ok()?)))
                }),
            });
        }

        // Générer next_cursor
        let next_cursor = if has_more {
            if let Some(last) = results.last() {
                self.encode_cursor(last.service_id, last.total_score).ok()
            } else {
                None
            }
        } else {
            None
        };

        // Mettre en cache la première page (cursor=None)
        if request.cursor.is_none() {
            if let Some(ref search_cache) = self.search_cache_service {
                let cache_key = search_cache.generate_cache_key(
                    &request.query,
                    request.category_filter.as_deref(),
                    request.location_filter.as_deref(),
                    request.gps_zone.as_deref(),
                    request.search_radius_km,
                    request.specialized_type.as_deref(),
                );

                let _ = search_cache
                    .cache_results(
                        &cache_key,
                        results.clone(),
                        Duration::from_secs(300), // 5 minutes
                        false,                    // Pas populaire par défaut
                    )
                    .await;
            }
        }

        let duration = start_time.elapsed();
        log_info(&format!(
            "[NativeSearch] ✅ Recherche paginée terminée en {:?}: {} résultats (has_more: {})",
            duration,
            results.len(),
            has_more
        ));

        // ✅ NOUVEAU 2025-12-02: Enregistrer les métriques (si service disponible)
        // Note: Les métriques seront enregistrées via le service de métriques global

        Ok(PaginatedSearchResponse {
            results,
            next_cursor,
            has_more,
            total_estimated: None, // Pas de COUNT pour performance
        })
    }

    /// Encode un cursor à partir de service_id et score
    fn encode_cursor(&self, service_id: i32, score: f32) -> AppResult<String> {
        use base64::{engine::general_purpose, Engine as _};
        let data = format!("{}:{}", service_id, score);
        Ok(general_purpose::STANDARD.encode(data.as_bytes()))
    }

    /// Décode un cursor en service_id et score
    fn decode_cursor(&self, cursor: &str) -> AppResult<(Option<i32>, Option<f32>)> {
        use base64::{engine::general_purpose, Engine as _};
        let decoded = general_purpose::STANDARD.decode(cursor).map_err(|e| {
            crate::core::types::AppError::BadRequest(format!("Cursor invalide: {}", e))
        })?;
        let data = String::from_utf8(decoded).map_err(|e| {
            crate::core::types::AppError::BadRequest(format!("Cursor UTF-8 invalide: {}", e))
        })?;
        let parts: Vec<&str> = data.split(':').collect();
        if parts.len() == 2 {
            let service_id = parts[0].parse::<i32>().map_err(|e| {
                crate::core::types::AppError::BadRequest(format!("Service ID invalide: {}", e))
            })?;
            let score = parts[1].parse::<f32>().map_err(|e| {
                crate::core::types::AppError::BadRequest(format!("Score invalide: {}", e))
            })?;
            Ok((Some(service_id), Some(score)))
        } else {
            Err(crate::core::types::AppError::BadRequest(
                "Format cursor invalide".into(),
            ))
        }
    }

    /// Calcule le score de récence
    fn calculate_recency_score(&self, created_at: &chrono::DateTime<chrono::Utc>) -> f32 {
        let now = chrono::Utc::now();
        let age_days = (now - *created_at).num_days();

        if age_days < 7 {
            3.0
        } else if age_days < 30 {
            2.0
        } else if age_days < 90 {
            1.0
        } else {
            0.0
        }
    }
}
