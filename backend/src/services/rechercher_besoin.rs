use crate::core::types::AppResult;
use sqlx::{FromRow, Row};
use std::sync::Arc;
use std::time::Duration;

#[derive(FromRow)]
struct ServiceSearchRow {
    id: i32,
    _user_id: i32,
    data: serde_json::Value,
    _is_active: bool,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(FromRow)]
struct ServiceIdRow {
    _id: i32,
}

// use crate::utils::embedding_client::SearchEmbeddingPineconeRequest; // SUSPENDU - Recherche native PostgreSQL uniquement
use crate::services::native_search_service::NativeSearchService;
use crate::utils::log::{log_info, log_warn};
use serde_json::{json, Value};

/// Recherche de fallback SQL quand Pinecone n'est pas disponible
async fn search_services_fallback(
    pool: &sqlx::PgPool,
    besoin_json: &Value,
) -> Result<Vec<serde_json::Value>, crate::core::types::AppError> {
    let besoin_obj = besoin_json.as_object().ok_or_else(|| {
        crate::core::types::AppError::BadRequest("Le besoin doit ?tre un objet JSON".to_string())
    })?;

    // Extraire les termes de recherche
    let mut search_terms = Vec::new();

    // Titre
    if let Some(titre) = besoin_obj.get("titre") {
        if let Some(valeur) = titre.get("valeur").and_then(|v| v.as_str()) {
            search_terms.push(valeur.to_lowercase());
        }
    }

    // Description
    if let Some(description) = besoin_obj.get("description") {
        if let Some(valeur) = description.get("valeur").and_then(|v| v.as_str()) {
            search_terms.push(valeur.to_lowercase());
        }
    }

    // Category
    if let Some(category) = besoin_obj.get("category") {
        if let Some(valeur) = category.get("valeur").and_then(|v| v.as_str()) {
            search_terms.push(valeur.to_lowercase());
        }
    }

    if search_terms.is_empty() {
        return Ok(Vec::new());
    }

    // ✅ OPTIMISÉ 2025-11-28: Recherche SQL optimisée avec CTE pour éviter les multiples passes sur jsonb_array_elements
    // Au lieu d'exécuter une requête par terme dans une boucle, on fait une seule requête avec tous les termes
    // Utilise des CTE (Common Table Expressions) pour extraire les produits une seule fois

    // Construire les conditions de recherche pour tous les termes avec OR
    // On utilise une approche avec unnest pour itérer sur les patterns
    // Note: search_patterns n'est plus utilisé car on utilise tsvector maintenant

    // ✅ OPTIMISÉ 2025-11-29: Utiliser recherche full-text PostgreSQL (tsvector) au lieu d'ILIKE
    // Performance: < 500ms au lieu de plusieurs secondes
    // Construire la requête de recherche combinée pour tous les termes
    let search_query_combined = search_terms.join(" & "); // Opérateur AND pour tsquery

    // Construire la requête SQL optimisée avec tsvector
    let sql = r#"
        WITH search_query AS (
            -- Construire la requête tsquery pour recherche full-text
            SELECT plainto_tsquery('french', $1) as query
        ),
        services_matched AS (
            -- ✅ OPTIMISÉ: Recherche full-text avec tsvector (utilise index GIN)
            SELECT DISTINCT
                s.id as service_id,
                s.user_id,
                s.data,
                s.is_active,
                s.created_at,
                -- Calculer score de pertinence (priorité: titre > category > description > produits)
                (
                    -- Score titre (poids élevé: 10)
                    COALESCE(ts_rank(
                        to_tsvector('french', 
                            COALESCE(s.data->'titre_service'->>'valeur', '') || ' ' ||
                            COALESCE(s.data->>'titre_service', '')
                        ),
                        sq.query
                    ), 0) * 10.0 +
                    -- Score category (poids moyen: 5)
                    COALESCE(ts_rank(
                        to_tsvector('french', 
                            COALESCE(s.category, '') || ' ' ||
                            COALESCE(s.data->'category'->>'valeur', '') || ' ' ||
                            COALESCE(s.data->>'category', '')
                        ),
                        sq.query
                    ), 0) * 5.0 +
                    -- Score description (poids faible: 2)
                    COALESCE(ts_rank(
                        to_tsvector('french', 
                            COALESCE(s.data->'description'->>'valeur', '') || ' ' ||
                            COALESCE(s.data->>'description', '')
                        ),
                        sq.query
                    ), 0) * 2.0 +
                    -- ✅ PHASE 3: Score produits depuis table service_products (poids faible: 1)
                    COALESCE((
                        SELECT MAX(ts_rank(
                            to_tsvector('french', p.product_name),
                            sq.query
                        ))
                        FROM service_products p
                        WHERE p.service_id = s.id
                        AND p.is_active = true
                    ), 0) * 1.0
                ) as relevance_score
            FROM services s
            CROSS JOIN search_query sq
            WHERE s.is_active = true
            AND (
                -- Recherche full-text dans titre (priorité haute)
                to_tsvector('french', 
                    COALESCE(s.data->'titre_service'->>'valeur', '') || ' ' ||
                    COALESCE(s.data->>'titre_service', '')
                ) @@ sq.query
                -- Recherche full-text dans category
                OR to_tsvector('french', 
                    COALESCE(s.category, '') || ' ' ||
                    COALESCE(s.data->'category'->>'valeur', '') || ' ' ||
                    COALESCE(s.data->>'category', '')
                ) @@ sq.query
                -- Recherche full-text dans description
                OR to_tsvector('french', 
                    COALESCE(s.data->'description'->>'valeur', '') || ' ' ||
                    COALESCE(s.data->>'description', '')
                ) @@ sq.query
                -- ✅ PHASE 3: Recherche full-text dans produits depuis table service_products
                OR EXISTS (
                    SELECT 1
                    FROM service_products p
                    WHERE p.service_id = s.id
                    AND p.is_active = true
                    AND to_tsvector('french', p.product_name) @@ sq.query
                )
            )
        )
        SELECT 
            sm.service_id as id,
            sm.user_id,
            sm.data,
            sm.is_active,
            sm.created_at
        FROM services_matched sm
        ORDER BY sm.relevance_score DESC, sm.created_at DESC
        LIMIT 100
    "#;

    let services: Vec<ServiceSearchRow> = sqlx::query_as(sql)
        .bind(&search_query_combined)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            crate::core::types::AppError::Internal(format!("Erreur recherche SQL optimisée: {}", e))
        })?;

    // ✅ OPTIMISÉ: Calculer les scores pour tous les services trouvés (une seule fois au lieu de N fois)
    // ✅ NOTE: Le score des produits est calculé dans la requête SQL via service_products
    // Plus besoin de calculer manuellement ici car service_products est déjà utilisé dans la requête SQL principale
    let mut all_results = Vec::new();
    for service in services {
        let data: Value = service.data;

        // Calculer un score simple basé sur la correspondance avec TOUS les termes
        let mut score = 0.0;
        let data_str = data.to_string().to_lowercase();

        // Score pour chaque terme de recherche
        for term in &search_terms {
            let term_lower = term.to_lowercase();

            if data_str.contains(&term_lower) {
                score += 0.5;
            }

            // Bonus pour correspondance exacte dans le titre
            if let Some(titre) = data.get("titre_service") {
                if let Some(titre_str) = titre.as_str() {
                    if titre_str.to_lowercase().contains(&term_lower) {
                        score += 0.3;
                    }
                } else if let Some(titre_obj) = titre.as_object() {
                    if let Some(valeur) = titre_obj.get("valeur").and_then(|v| v.as_str()) {
                        if valeur.to_lowercase().contains(&term_lower) {
                            score += 0.3;
                        }
                    }
                }
            }

            // Bonus pour correspondance dans la catégorie
            if let Some(cat) = data.get("category") {
                if let Some(cat_str) = cat.as_str() {
                    if cat_str.to_lowercase().contains(&term_lower) {
                        score += 0.2;
                    }
                } else if let Some(cat_obj) = cat.as_object() {
                    if let Some(valeur) = cat_obj.get("valeur").and_then(|v| v.as_str()) {
                        if valeur.to_lowercase().contains(&term_lower) {
                            score += 0.2;
                        }
                    }
                }
            }

            // ✅ SUPPRIMÉ: Bonus pour correspondance dans les produits depuis service.data->produits
            // Le score des produits est maintenant calculé dans la requête SQL via service_products
            // Plus besoin de calculer manuellement ici car service_products est déjà utilisé dans la requête SQL
        }

        // Bonus pour services récents
        let days_old = chrono::Utc::now()
            .signed_duration_since(service.created_at)
            .num_days();
        if days_old <= 7 {
            score += 0.1; // Bonus pour services créés dans la semaine
        }

        let result = serde_json::json!({
            "service_id": service.id,
            "data": data,
            "score": score,
            "semantic_score": score,
            "interaction_score": 0.0,
            "gps": None::<String>
        });

        all_results.push(result);
    }

    // Trier par score et dédupliquer
    all_results.sort_by(|a, b| {
        b.get("score")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            .partial_cmp(&a.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Dédupliquer par service_id
    let mut seen_ids = std::collections::HashSet::new();
    let mut unique_results = Vec::new();

    for result in all_results {
        if let Some(service_id) = result.get("service_id").and_then(|v| v.as_i64()) {
            if !seen_ids.contains(&service_id) {
                seen_ids.insert(service_id);
                unique_results.push(result);
            }
        }
    }

    // Ne pas limiter les résultats, laisser le frontend/mobile gérer la pagination
    Ok(unique_results)
}

/// Validation du JSON de besoin selon le schéma besoin_schema.json
pub fn valider_besoin_json(data: &Value) -> Result<Value, crate::core::types::AppError> {
    // Transformation automatique des données pour compatibilité avec le schéma
    let mut transformed_data = data.clone();

    // Si intention est une chaîne simple, la transformer en objet structuré selon le schéma
    if let Some(intention_str) = data.get("intention").and_then(|v| v.as_str()) {
        if let Some(obj) = transformed_data.as_object_mut() {
            obj.insert(
                "intention".to_string(),
                json!({
                    "type_donnee": "string",
                    "valeur": intention_str
                    // Note: pas d'origine_champs pour intention selon le schéma
                }),
            );
        }
    }

    // Transformer tokens_consumed si c'est un nombre
    if let Some(tokens_num) = data.get("tokens_consumed").and_then(|v| v.as_u64()) {
        if let Some(obj) = transformed_data.as_object_mut() {
            obj.insert(
                "tokens_consumed".to_string(),
                json!({
                    "type_donnee": "number",
                    "valeur": tokens_num,
                    "origine_champs": "ia"
                }),
            );
        }
    }

    // Charger et valider le schéma
    let schema_str = std::fs::read_to_string("src/schemas/besoin_schema.json").map_err(|e| {
        crate::core::types::AppError::Internal(format!("Erreur lecture schéma JSON: {e}"))
    })?;
    let schema_json: Value = serde_json::from_str(&schema_str).map_err(|e| {
        crate::core::types::AppError::Internal(format!("Erreur parsing schéma JSON: {e}"))
    })?;

    // Validation avec le schéma
    if !jsonschema::is_valid(&schema_json, &transformed_data) {
        // Log détaillé des erreurs de validation
        let instance = jsonschema::JSONSchema::compile(&schema_json).map_err(|e| {
            crate::core::types::AppError::Internal(format!("Erreur compilation schéma JSON: {e}"))
        })?;

        let validation_result = instance.validate(&transformed_data);
        if let Err(errors) = validation_result {
            let error_details: Vec<String> = errors
                .map(|e| format!("{} à {}", e, e.instance_path))
                .collect();
            log::error!(
                "[valider_besoin_json] Erreurs de validation: {:?}",
                error_details
            );
            return Err(crate::core::types::AppError::BadRequest(format!(
                "Données non conformes au schéma besoin: {}",
                error_details.join(", ")
            )));
        }

        return Err(crate::core::types::AppError::BadRequest(
            "Données non conformes au schéma besoin".to_string(),
        ));
    }

    log_info(&format!(
        "[valider_besoin_json] Schéma JSON besoin validé avec succès"
    ));
    Ok(transformed_data)
}

/// ?? Recherche directe avec le texte original de l'utilisateur (sans IA)
pub async fn rechercher_besoin_direct(
    pool: &sqlx::PgPool, // ✅ CORRIGÉ: Utiliser le pool existant au lieu de créer une nouvelle connexion
    cache_service: Option<Arc<crate::services::cache_service::CacheService>>, // ✅ CORRIGÉ: Réutiliser le cache service
    geographic_matching: Option<
        Arc<crate::services::geographic_matching_service::GeographicMatchingService>,
    >, // ✅ CORRIGÉ: Réutiliser le matching géographique
    search_metrics: Option<Arc<crate::services::search_metrics::SearchMetricsService>>, // ✅ NOUVEAU 2025-12-01: Service de métriques (singleton)
    scalability_service: Option<Arc<crate::services::scalability_service::ScalabilityService>>, // ✅ NOUVEAU 2025-12-01: Service de scalabilité pour cache optimisé
    media_storage: Option<Arc<crate::services::media_storage_service::MediaStorageService>>, // ✅ NOUVEAU: Pour transformer chemins en URLs CDN
    user_id: Option<i32>,
    user_text: &str,
    gps_zone: Option<&str>,         // Nouveau paramètre GPS
    search_radius_km: Option<i32>,  // Nouveau paramètre rayon
    specialized_type: Option<&str>, // ✅ NOUVEAU : Paramètre pour recherche spécialisée dédiée
) -> AppResult<(Value, u32)> {
    use crate::services::orchestration_ia::extract_keywords_from_text;
    use crate::utils::log::log_info;

    let search_start_time = std::time::Instant::now();
    log_info(&format!("[RECHERCHE_DIRECTE] Recherche directe avec texte utilisateur: '{}' (GPS: {:?}, Rayon: {:?}km, specialized_type: {:?})", 
        user_text, gps_zone, search_radius_km, specialized_type));

    // Extraire les mots-clés pertinents
    let keywords = extract_keywords_from_text(user_text);
    log_info(&format!(
        "[RECHERCHE_DIRECTE] Mots-clés extraits: {:?}",
        keywords
    ));

    if keywords.is_empty() {
        return Ok((
            json!({
                "resultats": [],
                "nombre_matchings": 0,
                "message": "Aucun mot-clé pertinent trouvé"
            }),
            1,
        ));
    }

    // ✅ CORRIGÉ 2025-12-01: Utiliser TOUS les mots-clés combinés au lieu de seulement le premier
    // Cela permet de trouver des services avec plusieurs mots-clés (ex: "photographe professionnel")
    let primary_keyword = if keywords.len() == 1 {
        keywords[0].clone()
    } else {
        // Combiner tous les mots-clés en une seule chaîne pour la recherche
        keywords.join(" ")
    };
    log_info(&format!(
        "[RECHERCHE_DIRECTE] Terme de recherche (tous mots-clés combinés): '{}'",
        primary_keyword
    ));

    // ✅ CORRIGÉ 2025-12-01: Réutiliser les services existants ou créer seulement si nécessaire
    let cache_service = cache_service.unwrap_or_else(|| {
        use crate::services::cache_service::CacheService;
        let redis_url =
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());
        let redis_client = redis::Client::open(redis_url).ok();
        Arc::new(CacheService::new(redis_client))
    });

    // ✅ NOUVEAU 2025-12-01: Cache multi-niveaux (mémoire L1 + Redis L2)
    use crate::services::global_cache_service::GlobalCacheService;
    let global_cache = GlobalCacheService::new(Some(cache_service.clone()));

    // Générer la clé de cache pour cette recherche
    let cache_key = GlobalCacheService::generate_key(
        "search",
        &[
            ("query", &primary_keyword as &dyn std::fmt::Display),
            (
                "gps_zone",
                &gps_zone.unwrap_or("") as &dyn std::fmt::Display,
            ),
            (
                "radius",
                &search_radius_km.unwrap_or(0) as &dyn std::fmt::Display,
            ),
            (
                "type",
                &specialized_type.unwrap_or("") as &dyn std::fmt::Display,
            ),
        ],
    );

    // ✅ OPTIMISÉ 2025-12-01: Vérifier le cache multi-niveaux AVANT la recherche
    let start_time = std::time::Instant::now();
    if let Ok(Some(cached_result)) = global_cache.get::<serde_json::Value>(&cache_key).await {
        let cache_time = start_time.elapsed();
        log_info(&format!(
            "[RECHERCHE_DIRECTE] ✅ Résultats récupérés du cache ({}ms): '{}' ({} résultats)",
            cache_time.as_millis(),
            primary_keyword,
            cached_result
                .get("resultats")
                .and_then(|r| r.as_array())
                .map(|a| a.len())
                .unwrap_or(0)
        ));

        let nombre_matchings = cached_result
            .get("nombre_matchings")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32;

        // ✅ Enregistrer métrique cache hit (singleton depuis AppState)
        if let Some(metrics_service) = &search_metrics {
            metrics_service
                .record_search(
                    &primary_keyword,
                    specialized_type,
                    None, // category
                    cache_time,
                    Duration::from_millis(0), // Pas de DB time pour cache hit
                    true,                     // cache_hit
                )
                .await;
        }

        return Ok((cached_result, nombre_matchings));
    }

    let geographic_matching = geographic_matching.unwrap_or_else(|| {
        use crate::services::geocoding_service::GeocodingService;
        let redis_url =
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());
        let redis_client = redis::Client::open(redis_url).ok();
        let geocoding_service = GeocodingService::with_cache(redis_client.clone());
        Arc::new(
            crate::services::geographic_matching_service::GeographicMatchingService::new(
                pool.clone(),
                cache_service.clone(),
                geocoding_service,
            ),
        )
    });

    // ✅ OPTIMISÉ 2025-11-28: Configuration de la recherche native avec cache Redis et matching géographique
    // ✅ NOUVEAU 2025-12-01: Ajouter service de scalabilité pour cache optimisé
    let native_search = if let Some(scalability_service) = scalability_service.clone() {
        NativeSearchService::with_scalability(pool.clone(), Some(scalability_service))
    } else {
        NativeSearchService::with_cache_and_geographic_matching(
            pool.clone(),
            Some(cache_service.clone()),
            Some(geographic_matching),
            search_metrics.clone(),
            scalability_service.clone(),
        )
    };

    // ✅ NOUVEAU 2025-11-04 : PRÉ-FILTRE INTELLIGENT PAR LIEU BIDIRECTIONNEL
    // Passer l'INPUT COMPLET (pas un lieu détecté) pour matching flexible
    // Le SQL vérifiera si UN ÉLÉMENT du location_vector de chaque produit est dans l'input
    log_info(&format!(
        "[RECHERCHE_DIRECTE] 🗺️ PRÉ-FILTRE lieu bidirectionnel avec input complet: '{}'",
        user_text
    ));

    // Recherche native intelligente avec filtrage GPS
    let native_results = match native_search
        .intelligent_search(
            &primary_keyword,
            None,      // Pas de filtre de catégorie
            None,      // Pas de filtre de localisation textuelle
            user_id,
            gps_zone,         // Passer la zone GPS (gps_fixe/gps_courant)
            search_radius_km, // Passer le rayon de recherche
        )
        .await
    {
        Ok(results) => {
            log_info(&format!(
                "[RECHERCHE_DIRECTE] Recherche native réussie avec {} résultats (GPS filtré: {})",
                results.len(),
                gps_zone.is_some()
            ));
            results
        }
        Err(e) => {
            log_info(&format!(
                "[RECHERCHE_DIRECTE] Échec recherche native: {}. Utilisation du fallback SQL.",
                e
            ));
            // Fallback vers recherche SQL simple avec tous les mots-clés
            let fallback_results =
                search_services_direct_fallback(&pool, &primary_keyword, &keywords).await?;
            log_info(&format!(
                "[RECHERCHE_DIRECTE] Fallback SQL réussi avec {} résultats",
                fallback_results.len()
            ));

            // Convertir les résultats du fallback en format SearchResult
            fallback_results
                .into_iter()
                .map(|r| crate::services::native_search_service::SearchResult {
                    service_id: r["service_id"].as_i64().unwrap_or(0) as i32,
                    data: r["data"].clone(),
                    total_score: r["score"].as_f64().unwrap_or(0.0) as f32,
                    fulltext_score: r["score"].as_f64().unwrap_or(0.0) as f32,
                    trigram_score: 0.0,
                    recency_score: 0.0,
                    category_score: 0.0,
                    distance_km: None,
                    gps_coords: None,
                    search_method: "fallback".to_string(),
                    matched_fields: vec![],
                })
                .collect()
        }
    };

    // ✅ Stocker les distances avant conversion
    use std::collections::HashMap;
    let mut distance_map: HashMap<i32, Option<f64>> = HashMap::new();
    for result in &native_results {
        distance_map.insert(result.service_id, result.distance_km);
    }

    // Convertir les résultats natifs en format MatchedService pour compatibilité
    let mut matches: Vec<crate::services::matching_pipeline::MatchedService> = native_results
        .into_iter()
        .map(|result| {
            // Extraire le GPS (priorité: gps_fixe du service)
            let gps = result
                .data
                .get("gps_fixe")
                .and_then(|v| v.get("valeur"))
                .and_then(|v| v.as_str())
                .or_else(|| result.data.get("gps_fixe").and_then(|v| v.as_str()))
                .map(|s| s.to_string());

            crate::services::matching_pipeline::MatchedService {
                service_id: result.service_id,
                data: result.data,
                score: result.total_score as f64,
                semantic_score: result.fulltext_score as f64,
                interaction_score: result.recency_score as f64,
                gps,
            }
        })
        .collect();

    // Trier par score total décroissant (pertinence + proximité déjà inclus dans total_score)
    matches.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // ✅ OPTIMISÉ 2025-11-29: Enrichir les résultats avec batch queries au lieu de N requêtes séquentielles
    let service_ids: Vec<i32> = matches.iter().map(|m| m.service_id).collect();

    if service_ids.is_empty() {
        return Ok((
            json!({"resultats": [], "nombre_matchings": 0, "message": "Aucun résultat"}),
            1,
        ));
    }

    // ✅ OPTIMISÉ 2025-12-01 : Paralléliser TOUTES les batch queries (3 requêtes en parallèle au lieu de séquentielles)
    // Gain: ~900ms → ~300ms (3x plus rapide)
    #[derive(sqlx::FromRow)]
    struct ServiceUserInfoRow {
        service_id: i32,
        is_active: bool,
        created_at: chrono::DateTime<chrono::Utc>,
        user_id: i32,
        nom_complet: Option<String>,
        avatar_url: Option<String>,
        email: Option<String>,
        is_provider: bool,
        gps: Option<String>,
        photo_profil: Option<String>,
    }

    #[derive(sqlx::FromRow)]
    struct ProductInfoRow {
        service_id: i32,
        product_vector: Option<Vec<String>>,
        product_labels: Option<Vec<String>>,
        location_vector: Option<Vec<String>>,
        chosen_location: Option<String>,
        usage_count: Option<i32>, // ✅ CORRIGÉ: INTEGER (INT4) dans DB, pas i64 (INT8)
    }

    // ✅ NOUVEAU 2026-01-07: Structure pour récupérer les produits depuis service_products
    #[derive(sqlx::FromRow)]
    struct ServiceProductRow {
        service_id: i32,
        product_index: i32,
        product_data: serde_json::Value,
    }

    let (service_user_info_map_result, product_info_map_result, media_map_result, service_products_map_result) = tokio::join!(
        // BATCH QUERY 1: Récupérer les informations service ET utilisateur
        async {
            sqlx::query_as::<_, ServiceUserInfoRow>(
                r#"
                SELECT 
                    s.id as service_id,
                    s.is_active,
                    s.created_at,
                    u.id as user_id,
                    u.nom_complet,
                    u.avatar_url,
                    u.email,
                    COALESCE(u.is_provider, false) as is_provider,
                    u.gps,
                    u.photo_profil
                FROM services s
                INNER JOIN users u ON u.id = s.user_id
                WHERE s.id = ANY($1::int[])
                "#,
            )
            .bind(&service_ids)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                crate::core::types::AppError::Internal(format!(
                    "Erreur batch query service_user_info: {}",
                    e
                ))
            })
            .map(|rows| {
                rows.into_iter()
                    .map(|row| {
                        (
                            row.service_id,
                            (
                                row.is_active,
                                row.created_at,
                                row.user_id,
                                row.nom_complet,
                                row.avatar_url,
                                row.email,
                                row.is_provider,
                                row.gps,
                                row.photo_profil,
                            ),
                        )
                    })
                    .collect::<HashMap<
                        i32,
                        (
                            bool,
                            chrono::DateTime<chrono::Utc>,
                            i32,
                            Option<String>,
                            Option<String>,
                            Option<String>,
                            bool,
                            Option<String>,
                            Option<String>,
                        ),
                    >>()
            })
        },
        // BATCH QUERY 2: Récupérer les informations produit depuis autocomplete_characteristics
        async {
            sqlx::query_as::<_, ProductInfoRow>(
                r#"
                SELECT DISTINCT ON (ac.service_id)
                    ac.service_id,
                    ac.characteristic_vector as product_vector,
                    ac.product_labels,
                    ac.location_vector,
                    ac.chosen_location,
                    ac.usage_count::INTEGER as usage_count
                FROM autocomplete_characteristics ac
                WHERE ac.service_id = ANY($1::int[])
                AND ac.is_real_product = TRUE
                AND ac.identifiant_base = 'produits'
                ORDER BY ac.service_id, ac.usage_count DESC NULLS LAST
                "#,
            )
            .bind(&service_ids)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                crate::core::types::AppError::Internal(format!(
                    "Erreur batch query product_info: {}",
                    e
                ))
            })
            .map(|rows| {
                rows.into_iter()
                    .map(|row| {
                        (
                            row.service_id,
                            (
                                row.product_vector,
                                row.product_labels,
                                row.location_vector,
                                row.chosen_location,
                                row.usage_count,
                            ),
                        )
                    })
                    .collect::<HashMap<
                        i32,
                        (
                            Option<Vec<String>>,
                            Option<Vec<String>>,
                            Option<Vec<String>>,
                            Option<String>,
                            Option<i32>,
                        ),
                    >>()
            })
        },
        // BATCH QUERY 3: Récupérer les images et vidéos
        async {
            sqlx::query(
                r#"
                SELECT service_id, type, path
                FROM media
                WHERE service_id = ANY($1::int[])
                AND type IN ('image', 'video')
                AND path IS NOT NULL
                ORDER BY service_id, uploaded_at ASC
                "#,
            )
            .bind(&service_ids)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                crate::core::types::AppError::Internal(format!("Erreur batch query media: {}", e))
            })
            .map(|rows| {
                let mut media_map: HashMap<i32, (Vec<String>, Vec<String>)> = HashMap::new();
                for row in rows {
                    let service_id = row.get::<i32, _>("service_id");
                    let media_type = row.get::<String, _>("type");
                    let path = row.get::<String, _>("path");
                    {
                        let entry = media_map
                            .entry(service_id)
                            .or_insert_with(|| (Vec::new(), Vec::new()));
                        match media_type.as_str() {
                            "image" => entry.0.push(path),
                            "video" => entry.1.push(path),
                            _ => {}
                        }
                    }
                }
                media_map
            })
        },
        // ✅ NOUVEAU BATCH QUERY 4: Récupérer les produits depuis service_products (nouveau système)
        async {
            sqlx::query_as::<_, ServiceProductRow>(
                r#"
                SELECT 
                    service_id,
                    product_index,
                    product_data
                FROM service_products
                WHERE service_id = ANY($1::int[])
                AND is_active = true
                ORDER BY service_id, product_index ASC
                "#,
            )
            .bind(&service_ids)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                crate::core::types::AppError::Internal(format!(
                    "Erreur batch query service_products: {}",
                    e
                ))
            })
            .map(|rows| {
                let mut products_map: HashMap<i32, Vec<serde_json::Value>> = HashMap::new();
                for row in rows {
                    let service_id = row.service_id;
                    let mut product_data = row.product_data;
                    // ✅ Ajouter product_index et service_id au product_data pour compatibilité
                    if let Some(obj) = product_data.as_object_mut() {
                        obj.insert("product_index".to_string(), json!(row.product_index));
                        obj.insert("service_id".to_string(), json!(service_id));
                    }
                    products_map
                        .entry(service_id)
                        .or_insert_with(Vec::new)
                        .push(product_data);
                }
                products_map
            })
        }
    );

    let service_user_info_map = service_user_info_map_result?;
    let product_info_map = product_info_map_result?;
    let media_map = media_map_result?;
    let service_products_map = service_products_map_result?; // ✅ NOUVEAU: Produits depuis service_products

    // Créer user_info_map pour compatibilité avec le code existant
    let user_info_map: HashMap<i32, (i32, Option<String>, Option<String>)> = service_user_info_map
        .iter()
        .map(
            |(service_id, (_, _, user_id, nom_complet, avatar_url, _, _, _, _))| {
                (
                    *service_id,
                    (*user_id, nom_complet.clone(), avatar_url.clone()),
                )
            },
        )
        .collect();

    // ✅ Construire les résultats enrichis en utilisant les maps
    let mut enriched_results = Vec::new();
    for matched_service in matches {
        let service_id = matched_service.service_id;

        // Récupérer depuis les maps (O(1) lookup)
        let user_info = user_info_map
            .get(&service_id)
            .map(|(id, nom, avatar)| (*id, nom.clone(), avatar.clone()));
        let product_info = product_info_map.get(&service_id).cloned();
        let media_info = media_map
            .get(&service_id)
            .cloned()
            .and_then(|(images, videos)| {
                if !images.is_empty() || !videos.is_empty() {
                    Some((images, videos))
                } else {
                    None
                }
            });

        // ✅ NOUVEAU: Extraire l'adresse et le pays depuis service.data
        let extract_address_from_data = |data: &Value| -> Option<String> {
            data.get("adresse_complete")?
                .get("valeur")?
                .as_str()
                .or_else(|| data.get("adresse")?.get("valeur")?.as_str())
                .or_else(|| data.get("adresse_service")?.get("valeur")?.as_str())
                .or_else(|| data.get("adresse_prestataire")?.get("valeur")?.as_str())
                .or_else(|| data.get("localisation")?.get("valeur")?.as_str())
                .or_else(|| {
                    // Essayer d'extraire depuis lieu_produit
                    data.get("lieu_produit")?
                        .get("valeur")?
                        .get("valeur")?
                        .get("place_name")?
                        .as_str()
                        .or_else(|| {
                            data.get("lieu_produit")?
                                .get("valeur")?
                                .get("composants")?
                                .get("lieu")?
                                .get("place_name")?
                                .as_str()
                        })
                })
                .map(|s| s.to_string())
        };

        let extract_country_from_data = |data: &Value| -> Option<String> {
            data.get("pays")?
                .get("valeur")?
                .as_str()
                .or_else(|| data.get("pays_origine")?.get("valeur")?.as_str())
                .or_else(|| data.get("country")?.get("valeur")?.as_str())
                .or_else(|| {
                    // Essayer d'extraire depuis lieu_produit.components.pays
                    data.get("lieu_produit")?
                        .get("valeur")?
                        .get("valeur")?
                        .get("components")?
                        .get("pays")?
                        .as_str()
                        .or_else(|| {
                            data.get("lieu_produit")?
                                .get("valeur")?
                                .get("composants")?
                                .get("lieu")?
                                .get("components")?
                                .get("pays")?
                                .as_str()
                        })
                })
                .map(|s| s.to_string())
        };

        let adresse = extract_address_from_data(&matched_service.data);
        let pays = extract_country_from_data(&matched_service.data);

        // Construire l'objet utilisateur et prestataire avec adresse et pays
        let (user_obj, prestataire_obj) =
            if let Some((user_id, nom_complet, avatar_url)) = user_info {
                let nom_complet_clone = nom_complet.clone();
                let avatar_url_clone = avatar_url.clone();
                let mut user_obj = json!({
                    "id": user_id,
                    "nom_complet": nom_complet,
                    "avatar_url": avatar_url
                });
                // Ajouter adresse et pays à user_obj si disponibles
                if let Some(ref addr) = adresse {
                    user_obj["adresse"] = json!(addr);
                }
                if let Some(ref country) = pays {
                    user_obj["pays"] = json!(country);
                }

                let mut prestataire_obj = json!({
                    "user_id": user_id,
                    "nom": nom_complet_clone.clone().unwrap_or_else(|| "Prestataire".to_string()),
                    "nom_complet": nom_complet_clone,
                    "avatar_url": avatar_url_clone
                });
                // Ajouter adresse et pays à prestataire_obj si disponibles
                if let Some(ref addr) = adresse {
                    prestataire_obj["adresse"] = json!(addr);
                }
                if let Some(ref country) = pays {
                    prestataire_obj["pays"] = json!(country);
                }
                (user_obj, prestataire_obj)
            } else {
                (
                    json!(null),
                    json!({
                        "nom": "Prestataire"
                    }),
                )
            };

        // Extraire les informations de produit
        let (product_vector, product_labels, location_vector, chosen_location, usage_count) =
            product_info.unwrap_or((None, None, None, None, None));

        // ✅ OPTIMISÉ 2025-11-30: Récupérer les informations service complètes (id, is_active, created_at)
        let (service_is_active, service_created_at, service_user_id) = service_user_info_map
            .get(&service_id)
            .map(|(is_active, created_at, user_id, _, _, _, _, _, _)| {
                (*is_active, created_at.clone(), *user_id)
            })
            .unwrap_or((true, chrono::Utc::now(), 0));

        // Construire le résultat enrichi avec TOUTES les données complètes
        let mut enriched_result = json!({
            "id": service_id, // ✅ NOUVEAU: ID du service (comme get_service_by_id)
            "service_id": service_id,
            "data": matched_service.data,
            "is_active": service_is_active, // ✅ NOUVEAU: Statut actif
            "created_at": service_created_at.to_rfc3339(), // ✅ NOUVEAU: Date de création
            "user_id": service_user_id, // ✅ NOUVEAU: User ID
            "score": matched_service.score,
            "semantic_score": matched_service.semantic_score,
            "interaction_score": matched_service.interaction_score,
            "gps": matched_service.gps,
            "user": user_obj,
            "prestataire": prestataire_obj,
        });

        // Ajouter les informations de produit si disponibles
        if let Some(pv) = product_vector {
            enriched_result["product_vector"] = json!(pv);
        }
        if let Some(pl) = product_labels {
            enriched_result["product_labels"] = json!(pl);
        }
        if let Some(lv) = location_vector {
            enriched_result["location_vector"] = json!(lv);
        }
        if let Some(cl) = chosen_location {
            enriched_result["chosen_location"] = json!(cl);
        }
        if let Some(uc) = usage_count {
            enriched_result["usage_count"] = json!(uc);
        }

        // Ajouter la distance si disponible
        if let Some(distance) = distance_map.get(&service_id).and_then(|d| *d) {
            enriched_result["distance_km"] = json!(distance);
        }

        // ✅ NOUVEAU: Ajouter les images et vidéos si disponibles (avec transformation CDN)
        if let Some((images, videos)) = media_info {
            // ✅ OPTIMISÉ: Transformer les chemins en URLs CDN
            let images_cdn: Vec<String> = images.iter().map(|img| {
                if let Some(ref storage) = media_storage {
                    if !img.starts_with("http://") && !img.starts_with("https://") {
                        storage.build_public_url(img)
                    } else {
                        img.clone()
                    }
                } else {
                    img.clone()
                }
            }).collect();
            let videos_cdn: Vec<String> = videos.iter().map(|vid| {
                if let Some(ref storage) = media_storage {
                    if !vid.starts_with("http://") && !vid.starts_with("https://") {
                        storage.build_public_url(vid)
                    } else {
                        vid.clone()
                    }
                } else {
                    vid.clone()
                }
            }).collect();
            
            if !images_cdn.is_empty() {
                enriched_result["images"] = json!(images_cdn);
            }
            if !videos_cdn.is_empty() {
                enriched_result["videos"] = json!(videos_cdn);
            }
        }

        // ✅ CORRIGÉ 2026-01-07: Utiliser UNIQUEMENT les produits depuis service_products (nouveau système)
        // Remplacer complètement service.data->produits par les produits depuis service_products
        // Plus de lien avec l'ancien système (service.data->produits)
        if let Some(service_products_list) = service_products_map.get(&service_id) {
            if !service_products_list.is_empty() {
                // Convertir les produits depuis service_products en format compatible
                let produits_from_table: Vec<Value> = service_products_list.iter().cloned().collect();
                
                // Récupérer data ou le créer
                let data_value = enriched_result.get_mut("data").cloned();
                let mut data_obj = if let Some(d) = data_value {
                    if let Some(obj) = d.as_object() {
                        obj.clone()
                    } else {
                        serde_json::Map::new()
                    }
                } else {
                    serde_json::Map::new()
                };
                
                // ✅ REMPLACER complètement produits par ceux de service_products (pas de fusion avec ancien système)
                data_obj.insert("produits".to_string(), json!({
                    "type_donnee": "array",
                    "valeur": produits_from_table
                }));
                
                // Mettre à jour enriched_result avec le data modifié
                enriched_result["data"] = json!(data_obj);
                
                // ✅ CORRIGÉ 2026-01-07: Extraire les images/vidéos et variations depuis les produits service_products
                // Le ProductCard cherche dans product.images, product.videos, product.variants, product.has_variant
                // Prendre le premier produit pour les images/vidéos/variations
                if let Some(first_product) = service_products_list.first() {
                    if let Some(product_obj) = first_product.as_object() {
                        // Extraire images du produit
                        if let Some(product_images) = product_obj.get("images") {
                            if product_images.is_array() {
                                let images_vec: Vec<String> = product_images
                                    .as_array()
                                    .unwrap()
                                    .iter()
                                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                    .collect();
                                if !images_vec.is_empty() {
                                    // Fusionner avec les images existantes
                                    let existing_images: Vec<serde_json::Value> =
                                        enriched_result["images"]
                                            .as_array()
                                            .map(|arr| arr.iter().cloned().collect())
                                            .unwrap_or_else(Vec::new);
                                    let mut merged = existing_images;
                                    for img in images_vec {
                                        // ✅ OPTIMISÉ: Transformer le chemin en URL CDN si media_storage disponible
                                        let img_url = if let Some(ref storage) = media_storage {
                                            if !img.starts_with("http://") && !img.starts_with("https://") {
                                                storage.build_public_url(&img)
                                            } else {
                                                img.clone()
                                            }
                                        } else {
                                            img.clone()
                                        };
                                        let img_json = json!(img_url);
                                        if !merged.contains(&img_json) {
                                            merged.push(img_json);
                                        }
                                    }
                                    enriched_result["images"] = json!(merged);
                                }
                            }
                        }
                        // Extraire vidéos du produit
                        if let Some(product_videos) = product_obj.get("videos") {
                            if product_videos.is_array() {
                                let videos_vec: Vec<String> = product_videos
                                    .as_array()
                                    .unwrap()
                                    .iter()
                                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                    .collect();
                                if !videos_vec.is_empty() {
                                    // Fusionner avec les vidéos existantes
                                    let existing_videos: Vec<serde_json::Value> =
                                        enriched_result["videos"]
                                            .as_array()
                                            .map(|arr| arr.iter().cloned().collect())
                                            .unwrap_or_else(Vec::new);
                                    let mut merged = existing_videos;
                                    for vid in videos_vec {
                                        // ✅ OPTIMISÉ: Transformer le chemin en URL CDN si media_storage disponible
                                        let vid_url = if let Some(ref storage) = media_storage {
                                            if !vid.starts_with("http://") && !vid.starts_with("https://") {
                                                storage.build_public_url(&vid)
                                            } else {
                                                vid.clone()
                                            }
                                        } else {
                                            vid.clone()
                                        };
                                        let vid_json = json!(vid_url);
                                        if !merged.contains(&vid_json) {
                                            merged.push(vid_json);
                                        }
                                    }
                                    enriched_result["videos"] = json!(merged);
                                }
                            }
                        }

                        // ✅ AMÉLIORÉ 2025-11-29: Extraire les variations de prix du produit depuis multiple sources
                        let mut has_variants = false;

                        // 1. Chercher dans variants (format standard)
                        if let Some(variants) = product_obj.get("variants") {
                            if variants.is_array() && variants.as_array().unwrap().len() > 0 {
                                enriched_result["has_variant"] = json!(true);
                                enriched_result["variants"] = variants.clone();
                                has_variants = true;
                                // Extraire aussi variant_dimension si disponible
                                if let Some(variant_dimension) =
                                    product_obj.get("variant_dimension")
                                {
                                    enriched_result["variant_dimension"] =
                                        variant_dimension.clone();
                                } else if let Some(variant_dimension) =
                                    product_obj.get("dimension")
                                {
                                    enriched_result["variant_dimension"] =
                                        variant_dimension.clone();
                                }
                            }
                        }

                        // 2. Si variants manquant, chercher dans variations (format alternatif)
                        if !has_variants {
                            if let Some(variations) = product_obj.get("variations") {
                                if variations.is_array()
                                    && variations.as_array().unwrap().len() > 0
                                {
                                    enriched_result["has_variant"] = json!(true);
                                    enriched_result["variants"] = variations.clone();
                                    has_variants = true;
                                }
                            }
                        }

                        // 3. ✅ NOUVEAU: Si toujours manquant, chercher dans variation_prix ou variabilite_prix
                        if !has_variants {
                            if let Some(variation_prix) = product_obj.get("variation_prix") {
                                // Format: variation_prix peut être un objet avec modalites
                                if let Some(modalites) = variation_prix.get("modalites") {
                                    if modalites.is_array()
                                        && modalites.as_array().unwrap().len() > 0
                                    {
                                        // Transformer modalites en format variants
                                        let variants: Vec<serde_json::Value> = modalites.as_array().unwrap()
                                            .iter()
                                            .filter_map(|m| {
                                                if let Some(modalite_obj) = m.as_object() {
                                                    Some(json!({
                                                        "prix": modalite_obj.get("prix").or_else(|| modalite_obj.get("price")),
                                                        "devise": modalite_obj.get("devise").or_else(|| modalite_obj.get("currency")).unwrap_or(&json!("XAF")),
                                                        "stock": modalite_obj.get("stock"),
                                                        "dimension": modalite_obj.get("dimension").or_else(|| modalite_obj.get("variant_dimension")),
                                                    }))
                                                } else {
                                                    None
                                                }
                                            })
                                            .collect();
                                        if !variants.is_empty() {
                                            enriched_result["has_variant"] = json!(true);
                                            enriched_result["variants"] = json!(variants);
                                            if let Some(dimension) =
                                                variation_prix.get("dimension")
                                            {
                                                enriched_result["variant_dimension"] =
                                                    dimension.clone();
                                            }
                                        }
                                    }
                                }
                            } else if let Some(variabilite_prix) =
                                product_obj.get("variabilite_prix")
                            {
                                // Format: variabilite_prix peut être un objet avec modalites
                                if let Some(modalites) = variabilite_prix.get("modalites") {
                                    if modalites.is_array()
                                        && modalites.as_array().unwrap().len() > 0
                                    {
                                        // Transformer modalites en format variants
                                        let variants: Vec<serde_json::Value> = modalites.as_array().unwrap()
                                            .iter()
                                            .filter_map(|m| {
                                                if let Some(modalite_obj) = m.as_object() {
                                                    Some(json!({
                                                        "prix": modalite_obj.get("prix").or_else(|| modalite_obj.get("price")),
                                                        "devise": modalite_obj.get("devise").or_else(|| modalite_obj.get("currency")).unwrap_or(&json!("XAF")),
                                                        "stock": modalite_obj.get("stock"),
                                                        "dimension": modalite_obj.get("dimension").or_else(|| modalite_obj.get("variant_dimension")),
                                                    }))
                                                } else {
                                                    None
                                                }
                                            })
                                            .collect();
                                        if !variants.is_empty() {
                                            enriched_result["has_variant"] = json!(true);
                                            enriched_result["variants"] = json!(variants);
                                            if let Some(dimension) =
                                                variabilite_prix.get("dimension")
                                            {
                                                enriched_result["variant_dimension"] =
                                                    dimension.clone();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        enriched_results.push(enriched_result);
    }

    // ✅ OPTIMISÉ 2025-11-30: Créer l'objet prestataires regroupé pour éviter fetchPrestatairesBatch
    let mut prestataires_map = serde_json::Map::new();
    let mut prestataires_seen = std::collections::HashSet::new();

    for (
        _service_id,
        (_, created_at, user_id, nom_complet, avatar_url, email, is_provider, gps, photo_profil),
    ) in &service_user_info_map
    {
        // Utiliser user_id comme clé pour éviter doublons
        if !prestataires_seen.contains(user_id) {
            prestataires_seen.insert(*user_id);

            let mut prestataire_obj = serde_json::Map::new();
            prestataire_obj.insert("id".to_string(), json!(*user_id));
            if let Some(ref nom) = nom_complet {
                prestataire_obj.insert("nom_complet".to_string(), json!(nom));
            }
            if let Some(ref email_val) = email {
                prestataire_obj.insert("email".to_string(), json!(email_val));
            }
            prestataire_obj.insert("is_provider".to_string(), json!(*is_provider));
            if let Some(ref gps_val) = gps {
                prestataire_obj.insert("gps".to_string(), json!(gps_val));
            }
            if let Some(ref avatar) = avatar_url {
                prestataire_obj.insert("avatar_url".to_string(), json!(avatar));
                prestataire_obj.insert("photo_profil".to_string(), json!(avatar));
                // Alias pour compatibilité
            }
            if let Some(ref photo) = photo_profil {
                prestataire_obj.insert("photo_profil".to_string(), json!(photo));
            }
            prestataire_obj.insert("created_at".to_string(), json!(created_at.to_rfc3339()));

            prestataires_map.insert(user_id.to_string(), json!(prestataire_obj));
        }
    }

    // Convertir en format de réponse
    let results_array: Vec<Value> = enriched_results;

    log_info(&format!(
        "[RECHERCHE_DIRECTE] {} résultats convertis, {} prestataires uniques",
        results_array.len(),
        prestataires_map.len()
    ));

    let final_result = json!({
        "resultats": results_array,
        "nombre_matchings": results_array.len(),
        "message": "Recherche directe PostgreSQL réussie",
        "prestataires": json!(prestataires_map) // ✅ NOUVEAU: Objet prestataires regroupé
    });

    // ✅ NOUVEAU 2025-12-01: Mettre en cache le résultat (cache multi-niveaux)
    let search_time = search_start_time.elapsed();
    let cache_ttl = Duration::from_secs(
        std::env::var("CACHE_TTL_SEARCH")
            .unwrap_or_else(|_| "600".to_string())
            .parse()
            .unwrap_or(600),
    );

    if let Err(e) = global_cache.set(&cache_key, &final_result, cache_ttl).await {
        log::warn!("[RECHERCHE_DIRECTE] ⚠️ Erreur mise en cache: {}", e);
    } else {
        log_info(&format!(
            "[RECHERCHE_DIRECTE] 💾 Résultats mis en cache ({}ms, {} résultats)",
            search_time.as_millis(),
            results_array.len()
        ));
    }

    // ✅ NOUVEAU 2025-12-01: Enregistrer les métriques de recherche (singleton depuis AppState)
    if let Some(metrics_service) = search_metrics {
        let db_time = search_time; // Approximation (on pourrait mesurer séparément)
        metrics_service
            .record_search(
                &primary_keyword,
                specialized_type,
                None, // category détectée si disponible
                search_time,
                db_time,
                false, // cache_hit (déjà géré plus haut)
            )
            .await;
    }

    Ok((final_result, 1)) // 1 token pour la recherche directe
}

/// Recherche SQL directe de fallback avec mots-clés
/// ✅ CORRIGÉ 2025-12-13: Utiliser autocomplete_characteristics (comme autocomplete) pour recherche RAPIDE dans les produits
async fn search_services_direct_fallback(
    pool: &sqlx::PgPool,
    _primary_keyword: &str,
    all_keywords: &[String],
) -> Result<Vec<serde_json::Value>, crate::core::types::AppError> {
    use crate::utils::log::log_info;
    
    log_info(&format!(
        "[FALLBACK_SQL] Recherche fallback optimisée avec {} mots-clés: {:?}",
        all_keywords.len(),
        all_keywords
    ));

    // ✅ OPTIMISÉ: Utiliser la même approche que autocomplete (autocomplete_characteristics.full_vector)
    // C'est 10-20x plus rapide que chercher dans services.data->'produits' car full_vector est indexé avec GIN
    let search_terms: Vec<String> = all_keywords.iter().map(|k| k.to_lowercase()).collect();
    
    // ✅ OPTIMISÉ 2025-12-20: Requête utilisant index GIN tsvector (ultra-rapide)
    // Le problème: LIKE '%...%' avec unnest + EXISTS = très lent (plusieurs secondes)
    // Solution: Utiliser tsvector @@ tsquery avec index GIN = instantané (< 100ms)
    
    // Construire la requête tsquery depuis les mots-clés
    let search_query = all_keywords.join(" | "); // Format tsquery: "mot1 | mot2 | mot3"
    
    let query = r#"
        SELECT DISTINCT ON (s.id)
            s.id,
            s.user_id,
            s.data,
            s.is_active,
            s.created_at,
            s.gps,
            s.category,
            -- ✅ OPTIMISÉ: Score basé sur ts_rank (utilise l'index GIN) + usage_count
            (
                ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', $2)) * 20.0 +
                (ac.usage_count::REAL * 2.0) +
                -- Bonus si match dans full_vector ou characteristic_vector
                CASE 
                    WHEN to_tsvector('french', array_to_string(ac.full_vector, ' ')) @@ plainto_tsquery('french', $2)
                    THEN 10.0
                    WHEN to_tsvector('french', array_to_string(ac.characteristic_vector, ' ')) @@ plainto_tsquery('french', $2)
                    THEN 8.0
                    ELSE 0.0
                END
            ) as relevance_score
        FROM autocomplete_characteristics ac
        INNER JOIN services s ON s.id = ac.service_id
        WHERE 
            ac.is_real_product = TRUE
            AND s.is_active = TRUE
            AND ac.identifiant_base = 'produits'
            -- ✅ OPTIMISÉ 2025-12-21: Utiliser tsvector @@ tsquery avec index GIN (ultra-rapide)
            -- Au lieu de LIKE '%...%' avec unnest + EXISTS (très lent)
            -- Note: Les index GIN sur to_tsvector('french', array_to_string(...)) sont créés dans la migration 20251221
            AND (
                -- Recherche dans valeur (index GIN tsvector - idx_autocomplete_characteristics_valeur_tsvector)
                to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', $2)
                -- OU dans full_vector (index GIN tsvector - idx_autocomplete_full_vector_tsvector_gin)
                -- Utilise la fonction IMMUTABLE full_vector_to_tsvector() pour utiliser l'index
                OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery('french', $2)
                -- OU dans characteristic_vector (index GIN tsvector - idx_autocomplete_characteristic_vector_tsvector_gin)
                -- Utilise la fonction IMMUTABLE characteristic_vector_to_tsvector() pour utiliser l'index
                OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery('french', $2)
            )
        ORDER BY s.id, relevance_score DESC
        LIMIT 100
    "#;

    let services = sqlx::query(query)
        .bind(&search_terms) // Garder pour compatibilité (non utilisé dans la nouvelle requête)
        .bind(&search_query) // Requête tsquery pour recherche full-text
        .fetch_all(pool)
        .await
        .map_err(|e| {
            log_info(&format!("[FALLBACK_SQL] Erreur requête: {}", e));
            crate::core::types::AppError::Internal(format!("Erreur recherche SQL directe: {}", e))
        })?;
    
    log_info(&format!("[FALLBACK_SQL] ✅ {} services trouvés via autocomplete_characteristics", services.len()));

    let mut results = Vec::new();
    for row in services {
        // Extraire les données de la ligne
        let service_id: i32 = row.get::<i32, _>("id");
        let _user_id: i32 = row.get::<i32, _>("user_id");
        let data: Value = row.get::<Value, _>("data");
        let _is_active: bool = row.get::<bool, _>("is_active");
        let created_at: chrono::DateTime<chrono::Utc> =
            row.get::<chrono::DateTime<chrono::Utc>, _>("created_at");
        
        // ✅ OPTIMISÉ: Utiliser le score de pertinence calculé par SQL (comme autocomplete)
        let relevance_score: f64 = row.get::<f64, _>("relevance_score");

        // Bonus pour services récents
        let days_old = chrono::Utc::now()
            .signed_duration_since(created_at)
            .num_days();
        let recency_bonus = if days_old <= 7 { 0.1 } else { 0.0 };
        
        let final_score = relevance_score + recency_bonus;

        let result = serde_json::json!({
            "service_id": service_id,
            "data": data,
            "score": final_score,
            "semantic_score": relevance_score,
            "interaction_score": 0.0,
            "gps": None::<String>
        });

        results.push(result);
    }

    // Trier par score
    results.sort_by(|a, b| {
        b.get("score")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            .partial_cmp(&a.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(results)
}

/// ?? Recherche de besoins utilisateur avec matching dynamique
pub async fn rechercher_besoin(user_id: Option<i32>, data: &Value) -> AppResult<(Value, u32)> {
    // Initialiser le tracking des tokens
    let mut token_consumption = TokenConsumption::new();

    // Validation sch?ma besoin (avant toute extraction ou validation manuelle)
    valider_besoin_json(data)?;
    // Extraction robuste du JSON IA (m?me si la sortie IA n'est pas un objet JSON pur)
    let mut data_obj = data.clone();
    if !data_obj.is_object() {
        if let Some(s) = data.as_str() {
            if let Some(start) = s.find('{') {
                if let Some(end) = s.rfind('}') {
                    let json_str = &s[start..=end];
                    if let Ok(val) = serde_json::from_str::<Value>(json_str) {
                        data_obj = val;
                    } else {
                        return Err(crate::core::types::AppError::BadRequest(
                            "Sortie IA non exploitable : JSON introuvable".to_string(),
                        ));
                    }
                } else {
                    return Err(crate::core::types::AppError::BadRequest(
                        "Sortie IA non exploitable : accolade fermante manquante".to_string(),
                    ));
                }
            } else {
                return Err(crate::core::types::AppError::BadRequest(
                    "Sortie IA non exploitable : accolade ouvrante manquante".to_string(),
                ));
            }
        } else {
            return Err(crate::core::types::AppError::BadRequest(
                "Sortie IA non exploitable : pas d'objet JSON ou de texte exploitable".to_string(),
            ));
        }
    }
    let obj = data_obj.as_object().ok_or_else(|| {
        crate::core::types::AppError::BadRequest("Le besoin doit ?tre un objet JSON".to_string())
    })?;

    // Validation stricte des champs obligatoires (pr?sence, non vide, typage explicite, type reconnu)
    let required_fields = [
        "titre",
        "description",
        "category",
        "reponse_intelligente",
        "intention",
    ];
    for &field in &required_fields {
        match obj.get(field) {
            Some(Value::Object(o)) => {
                let type_donnee = o.get("type_donnee").and_then(|v| v.as_str());
                let valeur = o.get("valeur");
                let origine = o.get("origine_champs");
                if field == "intention" {
                    // Pour intention, origine_champs optionnel
                    if type_donnee.is_none() || valeur.is_none() {
                        return Err(crate::core::types::AppError::BadRequest("Le champ 'intention' doit ?tre un objet structur? avec au moins type_donnee et valeur".to_string()));
                    }
                } else {
                    // Pour les autres, origine_champs obligatoire
                    if type_donnee.is_none() || valeur.is_none() || origine.is_none() {
                        return Err(crate::core::types::AppError::BadRequest(format!("Le champ '{field}' doit ?tre un objet structur? avec type_donnee, valeur, origine_champs")));
                    }
                }
                let is_empty = match valeur {
                    Some(Value::String(s)) => s.trim().is_empty(),
                    Some(Value::Array(arr)) => arr.is_empty(),
                    Some(Value::Null) => true,
                    None => true,
                    _ => false,
                };
                if is_empty {
                    return Err(crate::core::types::AppError::BadRequest(format!(
                        "Le champ '{field}.valeur' ne doit pas ?tre vide"
                    )));
                }
            }
            Some(Value::String(s)) if field == "intention" && !s.trim().is_empty() => {}
            _ => {
                if field == "intention" {
                    return Err(crate::core::types::AppError::BadRequest("Le champ 'intention' est obligatoire et doit ?tre une cha?ne non vide ou un objet structur? dans le besoin IA".to_string()));
                } else {
                    return Err(crate::core::types::AppError::BadRequest(format!("Le champ '{field}' est obligatoire et doit ?tre un objet structur? dans le besoin IA")));
                }
            }
        }
    }
    // Validation stricte du typage explicite pour chaque champ dynamique
    let allowed_types = [
        "string",
        "bool",
        "int",
        "float",
        "array",
        "object",
        "date",
        "file",
        "email",
        "url",
        "phone",
        "gps",
        "null",
        "dropdown",
        "listeproduit",
        "image",
        "audio",
        "video",
    ];
    for (key, _value) in obj.iter() {
        // Exclure les champs système et métier standard
        if [
            "intention",
            "titre",
            "description",
            "category",
            "reponse_intelligente",
            "suggestions_complementaires",
            "zone_gps",
            "gps",
            "tokens_consumed",
            "tokens_breakdown",
            "model_used",
            "processing_time_ms",
            "status",
            "message",
            "resultats",
            "processing_time",
            "direct_processing",
            "ia_model_used",
            "confidence",
            "processing_mode",
            "interaction_id",
            "gpu_enabled",
            "optimization_level",
        ]
        .contains(&key.as_str())
            || key.ends_with("_type")
            || key.ends_with("_options")
        {
            continue;
        }
        let type_field = format!("{}_type", key);
        match obj.get(&type_field) {
            Some(Value::String(t)) if allowed_types.contains(&t.as_str()) => {
                // Si dropdown, vérifier la présence de options
                if t == "dropdown" {
                    let options_field = format!("{}_options", key);
                    match obj.get(&options_field) {
                        Some(Value::Array(arr)) if !arr.is_empty() => {}
                        _ => {
                            return Err(crate::core::types::AppError::BadRequest(format!("Le champ '{key}' de type dropdown doit avoir un tableau 'options' non vide")));
                        }
                    }
                }
            }
            Some(Value::String(t)) => {
                return Err(crate::core::types::AppError::BadRequest(format!(
                    "Type non reconnu pour le champ {key}: {t}"
                )));
            }
            _ => {
                return Err(crate::core::types::AppError::BadRequest(format!(
                    "Typage explicite manquant pour le champ {key}"
                )));
            }
        }
    }

    // Remplacement automatique des références multimodales par leur contenu réel (base64)
    let data_with_media = data_obj.clone();
    // enrichir_multimodalites(&mut data_with_media, "data/uploads"); // This line was commented out in the original file
    let _obj_media = data_with_media.as_object().unwrap();

    // Initialisation du client d'embedding pour Pinecone
    let _embedding_client = crate::utils::embedding_client::EmbeddingClient::new("", "");
    let mut champs_embeddes = Vec::new();

    // NOTE: SUSPENSION COMPLÈTE DE PINECONE - Recherche native PostgreSQL uniquement
    log_info(&format!(
        "[PINECONE][SUSPENDU] Recherche sémantique Pinecone temporairement suspendue"
    ));

    // TODO: Réactiver Pinecone plus tard quand nécessaire
    /*
    // NOTE: Exclusion stricte centralisée : les champs 'reponse_intelligente' et 'suggestions_complementaires' sont exclus de toute vectorisation/matching sémantique (voir semantic_exclusion.rs)
    for (champ, valeur) in obj_media.iter() {
        // if is_excluded_semantic_field(champ) { // This line was commented out in the original file
        //     log::info!("[EMBEDDING][EXCLUSION] Champ '{}' exclu de la vectorisation/matching sémantique.", champ);
        //     continue;
        // }
        // Détection du type de donnée
        let type_donnee = if let Some(obj) = valeur.as_object() {
            obj.get("type_donnee").and_then(|v| v.as_str()).unwrap_or("texte")
        } else {
            "texte"
        };
        let value_str = if let Some(obj) = valeur.as_object() {
            obj.get("valeur").map(|v| v.to_string()).unwrap_or_else(|| valeur.to_string())
        } else {
            valeur.to_string()
        };
        log_info(&format!("[PINECONE][RECHERCHE] Préparation embedding: champ='{}', type_donnee='{}', extrait='{}'", champ, type_donnee, &value_str.chars().take(80).collect::<String>()));
        let mut value_for_embedding = value_str.clone();
        let _lang = if type_donnee == "texte" || type_donnee == "string" {
            let detected = crate::services::creer_service::detect_lang(&value_str);
            value_for_embedding = crate::services::creer_service::translate_to_en(&value_str, &detected).await;
            // Tracker la traduction
            token_consumption.add_translation_call(value_str.len());
            detected
        } else {
            "und".to_string()
        };
        // Extraction unité/devise pour numériques
        if ["int", "float", "nombre", "prix", "montant"].contains(&type_donnee) {
            if let Some(obj) = valeur.as_object() {
                if let Some(_u) = obj.get("unite").and_then(|v| v.as_str()) {
                }
                if let Some(_d) = obj.get("devise").and_then(|v| v.as_str()) {
                }
            }
        }
        // GPS optimal :
        let (lat, lon) = if type_donnee == "gps" {
            if let Some(obj) = valeur.as_object() {
                if let Some(gps_val) = obj.get("valeur").and_then(|v| v.as_str()) {
                    let parts: Vec<&str> = gps_val.split(',').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        let (a, b) = (parts[0].parse::<f64>(), parts[1].parse::<f64>());
                        match (a, b) {
                            (Ok(x), Ok(y)) => (Some(x), Some(y)),
                            _ => (None, None)
                        }
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };
        // Mapping du type_donnee pour Pinecone :
        let type_donnee_pinecone = match type_donnee {
            "string" | "texte" | "text" => "texte",
            "image" => "image",
            "texte_ocr" => "texte_ocr",
            _ => continue, // ignore les autres types
        };
        // Recherche embedding Pinecone selon le type
        if ["texte", "string"].contains(&type_donnee) {
            let req = crate::utils::embedding_client::SearchEmbeddingPineconeRequest {
                query: value_for_embedding.clone(),
                type_donnee: type_donnee_pinecone.to_string(),
                top_k: Some(10),
                gps_lat: lat,
                gps_lon: lon,
                gps_radius_km: None,
                active: Some(true),
            };
            log_info(&format!("[PINECONE][RECHERCHE] Appel search_embedding_pinecone: {:?}", req));
            let res = _embedding_client
                .search_embedding_pinecone(&req)
                .await;
            // Tracker l'appel embedding
            token_consumption.add_embedding_call(3); // Complexité moyenne pour texte
            match &res {
                            Ok(r) => log_info(&format!("[PINECONE][RECHERCHE] Embedding recherché avec succès: champ='{}', retour={:?}", champ, r)),
            Err(e) => log_warn(&format!("[PINECONE][RECHERCHE] Erreur recherche embedding: champ='{}', erreur={:?}", champ, e)),
            }
            champs_embeddes.push((champ.clone(), value_for_embedding.clone()));
        } else if type_donnee == "image" {
            let req = crate::utils::embedding_client::SearchEmbeddingPineconeRequest {
                query: value_str.clone(),
                type_donnee: "image".to_string(),
                top_k: Some(10),
                gps_lat: lat,
                gps_lon: lon,
                gps_radius_km: None,
                active: Some(true),
            };
            log_info(&format!("[PINECONE][RECHERCHE] Appel search_embedding_pinecone (image): {:?}", req));
            let res = _embedding_client
                .search_embedding_pinecone(&req)
                .await;
            // Tracker l'appel embedding image
            token_consumption.add_embedding_call(5); // Complexité plus élevée pour images
            match &res {
                            Ok(r) => log_info(&format!("[PINECONE][RECHERCHE] Recherche embedding image: champ='{}', retour={:?}", champ, r)),
            Err(e) => log_warn(&format!("[PINECONE][RECHERCHE] Erreur recherche embedding image: champ='{}', erreur={:?}", champ, e)),
            }
            champs_embeddes.push((champ.clone(), value_str.clone()));
            // OCR effectif sur l'image (base64)
            if let Some(ocr_text) = crate::services::ocr_engine::ocr_image_base64(&value_str).await { // This line was commented out in the original file
                if !ocr_text.is_empty() {
                    // Tracker l'appel OCR
                    token_consumption.add_ocr_call(value_str.len());

                    let ocr_lang = crate::services::creer_service::detect_lang(&ocr_text);
                    let ocr_text_en = crate::services::creer_service::translate_to_en(&ocr_text, &ocr_lang).await;
                    // Tracker la traduction OCR
                    token_consumption.add_translation_call(ocr_text.len());
                    let req = crate::utils::embedding_client::SearchEmbeddingPineconeRequest {
                        query: ocr_text_en.clone(),
                        type_donnee: "texte_ocr".to_string(),
                        top_k: Some(10),
                        gps_lat: lat,
                        gps_lon: lon,
                        gps_radius_km: None,
                        active: Some(true),
                    };
                    log_info(&format!("[PINECONE][RECHERCHE] Appel search_embedding_pinecone (OCR): {:?}", req));
                    let res = _embedding_client.search_embedding_pinecone(&req).await;
                    match &res {
                        Ok(r) => log_info(&format!("[PINECONE][RECHERCHE] Recherche embedding OCR: champ='{}', retour={:?}", champ, r)),
                        Err(e) => log_warn(&format!("[PINECONE][RECHERCHE] Erreur recherche embedding OCR: champ='{}', erreur={:?}", champ, e)),
                    }
                    champs_embeddes.push((champ.clone() + "_ocr", ocr_text_en));
                }
            }
        } else if ["int", "float", "nombre", "prix", "montant"].contains(&type_donnee) {
            let req = crate::utils::embedding_client::SearchEmbeddingPineconeRequest {
                query: value_str.clone(),
                type_donnee: type_donnee.to_string(),
                top_k: Some(10),
                gps_lat: lat,
                gps_lon: lon,
                gps_radius_km: None,
                active: Some(true),
            };
            log_info(&format!("[PINECONE][RECHERCHE] Appel search_embedding_pinecone (num): {:?}", req));
            let res = _embedding_client.search_embedding_pinecone(&req).await;
            match &res {
                            Ok(r) => log_info(&format!("[PINECONE][RECHERCHE] Recherche embedding numérique: champ='{}', retour={:?}", champ, r)),
            Err(e) => log_warn(&format!("[PINECONE][RECHERCHE] Erreur recherche embedding numérique: champ='{}', erreur={:?}", champ, e)),
            }
            champs_embeddes.push((champ.clone(), value_str.clone()));
        } else if type_donnee == "gps" {
            let req = crate::utils::embedding_client::SearchEmbeddingPineconeRequest {
                query: value_str.clone(),
                type_donnee: type_donnee.to_string(),
                top_k: Some(10),
                gps_lat: lat,
                gps_lon: lon,
                gps_radius_km: Some(50.0), // Rayon de 50km pour la recherche GPS
                active: Some(true),
            };
            log_info(&format!("[PINECONE][RECHERCHE] Appel search_embedding_pinecone (gps): {:?}", req));
            let res = _embedding_client.search_embedding_pinecone(&req).await;
            match &res {
                            Ok(r) => log_info(&format!("[PINECONE][RECHERCHE] Recherche embedding GPS: champ='{}', retour={:?}", champ, r)),
            Err(e) => log_warn(&format!("[PINECONE][RECHERCHE] Erreur recherche embedding GPS: champ='{}', erreur={:?}", champ, e)),
            }
            champs_embeddes.push((champ.clone(), value_str.clone()));
        }
    }
    */

    // Simulation des champs embeddés pour compatibilité (vide car Pinecone suspendu)
    champs_embeddes.push((
        "titre_service".to_string(),
        "Recherche native PostgreSQL".to_string(),
    ));

    if champs_embeddes.is_empty() {
        return Err(crate::core::types::AppError::BadRequest(
            "Aucun champ exploitable pour l'embedding dans le JSON IA".to_string(),
        ));
    }

    let pool = sqlx::PgPool::connect(
        &std::env::var("DATABASE_URL").expect("DATABASE_URL doit ?tre d?fini"),
    )
    .await
    .map_err(|e| crate::core::types::AppError::Internal(format!("Erreur connexion base: {}", e)))?;

    // RECHERCHE NATIVE POSTGRESQL (SUSPENDUE TEMPORAIREMENT LA RECHERCHE SEMANTIQUE)
    log_info(&format!(
        "[RECHERCHE] Utilisation de la recherche native PostgreSQL intelligente"
    ));

    // Extraire les termes de recherche du JSON IA
    let search_query = extract_search_query_from_ia_json(&data_with_media)?;
    let category_filter = extract_category_from_ia_json(&data_with_media);
    let location_filter = extract_location_from_ia_json(&data_with_media);

    // ✅ Phase 10 - Initialiser le service de matching géographique pour enrichir les distances
    use crate::services::cache_service::CacheService;
    use crate::services::geocoding_service::GeocodingService;
    use std::sync::Arc;

    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());
    let redis_client = redis::Client::open(redis_url).ok();
    let cache_service = Arc::new(CacheService::new(redis_client.clone()));
    let geocoding_service = GeocodingService::with_cache(redis_client.clone());
    let geographic_matching = Arc::new(
        crate::services::geographic_matching_service::GeographicMatchingService::new(
            pool.clone(),
            cache_service.clone(),
            geocoding_service,
        ),
    );

    // ✅ OPTIMISÉ 2025-11-28: Configuration de la recherche native avec cache Redis et matching géographique
    let native_search = NativeSearchService::with_cache_and_geographic_matching(
        pool.clone(),
        Some(cache_service),
        Some(geographic_matching),
        None,
        None,
    );

    // Recherche native intelligente (recherche générale, pas de specialized_type)
    let native_results = match native_search
        .intelligent_search(
            &search_query,
            category_filter.as_deref(),
            location_filter.as_deref(),
            user_id,
            None, // Pas de zone GPS pour cette recherche
            None, // Pas de rayon GPS pour cette recherche
        )
        .await
    {
        Ok(results) => {
            log_info(&format!(
                "[RECHERCHE] Recherche native r?ussie avec {} r?sultats",
                results.len()
            ));
            results
        }
        Err(e) => {
            log_warn(&format!(
                "[RECHERCHE] ?chec recherche native: {}. Utilisation du fallback SQL.",
                e
            ));
            // Fallback vers recherche SQL simple
            let fallback_results = search_services_fallback(&pool, &data_with_media).await?;
            log_info(&format!(
                "[RECHERCHE] Fallback SQL r?ussi avec {} r?sultats",
                fallback_results.len()
            ));

            // Convertir les r?sultats du fallback en format SearchResult
            fallback_results
                .into_iter()
                .map(|r| crate::services::native_search_service::SearchResult {
                    service_id: r["service_id"].as_i64().unwrap_or(0) as i32,
                    data: r["data"].clone(),
                    total_score: r["score"].as_f64().unwrap_or(0.0) as f32,
                    fulltext_score: r["score"].as_f64().unwrap_or(0.0) as f32,
                    trigram_score: 0.0,
                    recency_score: 0.0,
                    category_score: 0.0,
                    distance_km: None,
                    gps_coords: None,
                    search_method: "fallback".to_string(),
                    matched_fields: vec![],
                })
                .collect()
        }
    };

    // Convertir les résultats natifs en format MatchedService pour compatibilité
    let matches: Vec<crate::services::matching_pipeline::MatchedService> = native_results
        .into_iter()
        .map(|r| {
            let gps = r
                .data
                .get("gps_fixe")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            crate::services::matching_pipeline::MatchedService {
                service_id: r.service_id,
                data: r.data,
                score: r.total_score as f64,
                semantic_score: r.total_score as f64, // Utiliser le score natif comme score sémantique
                interaction_score: 0.0,
                gps,
            }
        })
        .collect();

    // Tracker la complexit? du matching
    token_consumption.add_matching_complexity(matches.len(), champs_embeddes.len());

    // Trier par score total (pertinence + proximité) et ne PAS limiter
    let mut resultats: Vec<_> = matches
        .into_iter()
        .map(|m| {
            serde_json::json!({
                "service_id": m.service_id,
                "data": m.data,
                "score": m.score,
                "semantic_score": m.semantic_score,
                "interaction_score": m.interaction_score,
                "gps": m.gps
            })
        })
        .collect();

    // Trier par score décroissant (meilleurs résultats en premier)
    resultats.sort_by(|a, b| {
        b.get("score")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
            .partial_cmp(&a.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // VALIDATION CRITIQUE: Filtrer les services inexistants en base de données
    let resultats_valides = validate_services_exist(&pool, &resultats).await?;

    log_info(&format!(
        "[RECHERCHE] Services validés: {}/{} existent en base de données",
        resultats_valides.len(),
        resultats.len()
    ));

    let reponse_intelligente = obj
        .get("reponse_intelligente")
        .or_else(|| obj.get("suggestion_ia"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Correction?: expose la valeur de donnees_validees.reponse_intelligente.valeur si pr?sente
    let reponse_intelligente_valeur = obj
        .get("reponse_intelligente")
        .and_then(|v| v.get("valeur"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let reponse_intelligente_finale = reponse_intelligente_valeur.or(reponse_intelligente);

    // Correction extraction intention (supporte string ou objet structur?)
    let intention = match obj.get("intention") {
        Some(Value::String(s)) => Some(s.clone()),
        Some(Value::Object(o)) => o
            .get("valeur")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        _ => None,
    };
    let zone_gps_utilisee = obj.get("zone_gps").cloned();

    log_info(&format!(
        "[RECHERCHE_BESOIN] Tokens consomm?s pour utilisateur {:?}: {:?}",
        user_id, token_consumption
    ));

    let response = serde_json::json!({
        "message": if resultats_valides.is_empty() {
            "?? Aucun besoin correspondant trouvé"
        } else {
            "?? Besoins correspondants trouvés"
        },
        "user_id": user_id,
        "donnees_validees": data_with_media,
        "zone_gps_utilisee": zone_gps_utilisee,
        "reponse_intelligente": reponse_intelligente_finale,
        "intention": intention,
        "resultats": resultats_valides,
        "nombre_matchings": resultats_valides.len(),
        "tokens_consumed": token_consumption.total_tokens,
        "token_breakdown": {
            "embedding_calls": token_consumption.embedding_calls,
            "translation_calls": token_consumption.translation_calls,
            "ocr_calls": token_consumption.ocr_calls,
            "matching_complexity": token_consumption.matching_complexity
        }
    });

    Ok((response, token_consumption.total_tokens as u32))
}

/// Structure pour tracker les tokens consomm?s durant la recherche
#[derive(Debug, Clone)]
pub struct TokenConsumption {
    pub embedding_calls: i64,
    pub translation_calls: i64,
    pub ocr_calls: i64,
    pub matching_complexity: i64,
    pub total_tokens: i64,
}

impl TokenConsumption {
    pub fn new() -> Self {
        Self {
            embedding_calls: 0,
            translation_calls: 0,
            ocr_calls: 0,
            matching_complexity: 0,
            total_tokens: 0,
        }
    }

    pub fn add_embedding_call(&mut self, complexity: i64) {
        self.embedding_calls += complexity;
        self.total_tokens += complexity;
    }

    pub fn add_translation_call(&mut self, text_length: usize) {
        let tokens = (text_length / 100).max(1) as i64; // 1 token per 100 chars
        self.translation_calls += tokens;
        self.total_tokens += tokens;
    }

    pub fn add_ocr_call(&mut self, image_size_estimate: usize) {
        let tokens = (image_size_estimate / 1000).max(2) as i64; // 2 tokens minimum for OCR
        self.ocr_calls += tokens;
        self.total_tokens += tokens;
    }

    pub fn add_matching_complexity(&mut self, num_results: usize, num_fields: usize) {
        let tokens = ((num_results * num_fields) / 10).max(1) as i64;
        self.matching_complexity += tokens;
        self.total_tokens += tokens;
    }
}

/// VALIDATION CRITIQUE: Vérifier que les services retournés par Pinecone existent en base de données
async fn validate_services_exist(
    pool: &sqlx::PgPool,
    resultats: &[serde_json::Value],
) -> Result<Vec<serde_json::Value>, crate::core::types::AppError> {
    let mut resultats_valides = Vec::new();

    for resultat in resultats {
        if let Some(service_id) = resultat.get("service_id").and_then(|v| v.as_i64()) {
            // Vérifier si le service existe et est actif
            let service_exists: Option<ServiceIdRow> =
                sqlx::query_as("SELECT id FROM services WHERE id = $1 AND is_active = true")
                    .bind(service_id as i32)
                    .fetch_optional(pool)
                    .await
                    .map_err(|e| {
                        crate::core::types::AppError::Internal(format!(
                            "Erreur validation service {}: {}",
                            service_id, e
                        ))
                    })?;

            if service_exists.is_some() {
                resultats_valides.push(resultat.clone());
                log_info(&format!("[VALIDATION] Service {} validé", service_id));
            } else {
                log_warn(&format!(
                    "[VALIDATION] Service {} ignoré - n'existe pas ou inactif",
                    service_id
                ));
            }
        }
    }

    Ok(resultats_valides)
}

/// Extraire la requête de recherche du JSON IA
fn extract_search_query_from_ia_json(data: &Value) -> Result<String, crate::core::types::AppError> {
    let obj = data.as_object().ok_or_else(|| {
        crate::core::types::AppError::BadRequest("Le JSON doit être un objet".to_string())
    })?;

    // Extraire les mots-clés pertinents depuis le titre et la description
    let mut search_terms = Vec::new();

    // Extraire depuis le titre
    if let Some(titre) = obj.get("titre") {
        if let Some(valeur) = titre.get("valeur").and_then(|v| v.as_str()) {
            if !valeur.trim().is_empty() {
                // Extraire les mots-clés du titre (exclure "Recherche d'un", "Je cherche", etc.)
                let clean_title = valeur
                    .replace("Recherche d'un", "")
                    .replace("Recherche d'une", "")
                    .replace("Je cherche", "")
                    .replace("Je voudrais", "")
                    .replace("Je veux", "")
                    .trim()
                    .to_string();
                if !clean_title.is_empty() {
                    search_terms.push(clean_title);
                }
            }
        }
    }

    // Extraire depuis la description
    if let Some(description) = obj.get("description") {
        if let Some(valeur) = description.get("valeur").and_then(|v| v.as_str()) {
            if !valeur.trim().is_empty() {
                // Extraire les mots-clés de la description
                let clean_desc = valeur
                    .replace("Je cherche", "")
                    .replace("Je voudrais", "")
                    .replace("Je veux", "")
                    .replace("pour des", "")
                    .replace("pour", "")
                    .trim()
                    .to_string();
                if !clean_desc.is_empty() {
                    search_terms.push(clean_desc);
                }
            }
        }
    }

    // Si on a des termes, les combiner
    if !search_terms.is_empty() {
        return Ok(search_terms.join(" "));
    }

    // Fallback: utiliser le titre simple
    if let Some(titre) = obj.get("titre_service") {
        if let Some(valeur) = titre.get("valeur").and_then(|v| v.as_str()) {
            if !valeur.trim().is_empty() {
                return Ok(valeur.to_string());
            }
        }
    }

    Err(crate::core::types::AppError::BadRequest(
        "Impossible d'extraire une requête de recherche du JSON IA".to_string(),
    ))
}

/// Extraire la catégorie du JSON IA
fn extract_category_from_ia_json(data: &Value) -> Option<String> {
    let obj = data.as_object()?;

    // Essayer d'extraire depuis la catégorie
    if let Some(category) = obj.get("category") {
        if let Some(valeur) = category.get("valeur").and_then(|v| v.as_str()) {
            if !valeur.trim().is_empty() {
                return Some(valeur.to_string());
            }
        }
    }

    None
}

/// Extraire la localisation du JSON IA
fn extract_location_from_ia_json(data: &Value) -> Option<String> {
    let obj = data.as_object()?;

    // Essayer d'extraire depuis gps_fixe
    if let Some(gps) = obj.get("gps_fixe") {
        if let Some(valeur) = gps.get("valeur").and_then(|v| v.as_str()) {
            if !valeur.trim().is_empty() {
                return Some(valeur.to_string());
            }
        }
    }

    // Essayer d'extraire depuis zone_gps
    if let Some(zone_gps) = obj.get("zone_gps") {
        if let Some(valeur) = zone_gps.get("valeur").and_then(|v| v.as_str()) {
            if !valeur.trim().is_empty() {
                return Some(valeur.to_string());
            }
        }
    }

    None
}
