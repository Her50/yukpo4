use crate::core::types::AppResult;
use sqlx::{FromRow, Row};

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

    // Recherche SQL avec LIKE pour chaque terme
    let mut all_results = Vec::new();

    for term in search_terms {
        let search_pattern = format!("%{}%", term);
        let services: Vec<ServiceSearchRow> = sqlx::query_as(
            r#"
            SELECT s.id,
                   s.user_id,
                   s.data,
                   s.is_active,
                   s.created_at
            FROM services s
            WHERE s.is_active = true
            AND (
                s.data::text ILIKE $1
                OR s.data->>'titre_service' ILIKE $1
                OR s.data->>'description_service' ILIKE $1
                OR s.data->>'category' ILIKE $1
                OR s.category ILIKE $1
                OR EXISTS (
                    SELECT 1 
                    FROM jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(s.data->'produits') = 'array' 
                            THEN s.data->'produits'
                            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                            THEN s.data->'produits'->'valeur'
                            ELSE '[]'::jsonb
                        END
                    ) AS product
                    WHERE 
                        product->>'name' ILIKE $1
                        OR product->>'nom' ILIKE $1
                        OR product->>'description' ILIKE $1
                        OR product->>'type' ILIKE $1
                        OR product->>'marque' ILIKE $1
                        OR product->>'modele' ILIKE $1
                        OR product->>'titre' ILIKE $1
                        OR product->>'quartier' ILIKE $1
                        OR product->>'ville' ILIKE $1
                        OR product->>'categorieQuincaillerie' ILIKE $1
                        OR product->>'categorieElectromenager' ILIKE $1
                        OR product->>'matiere' ILIKE $1
                        OR product->>'couleur' ILIKE $1
                )
            )
            ORDER BY s.created_at DESC
            "#
        )
        .bind(&search_pattern)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            crate::core::types::AppError::Internal(format!("Erreur recherche SQL: {}", e))
        })?;

        for service in services {
            let data: Value = service.data;

            // Calculer un score simple basé sur la correspondance
            let mut score = 0.0;
            let data_str = data.to_string().to_lowercase();

            if data_str.contains(&term) {
                score += 0.5;
            }

            // Bonus pour correspondance exacte dans le titre
            if let Some(titre) = data.get("titre_service") {
                if let Some(titre_str) = titre.as_str() {
                    if titre_str.to_lowercase().contains(&term) {
                        score += 0.3;
                    }
                }
            }

            // Bonus pour correspondance dans la catégorie
            if let Some(cat) = data.get("category") {
                if let Some(cat_str) = cat.as_str() {
                    if cat_str.to_lowercase().contains(&term) {
                        score += 0.2;
                    }
                }
            }

            // Bonus pour correspondance dans les produits
            if let Some(produits) = data.get("produits") {
                if let Some(produits_array) = produits.as_array() {
                    for product in produits_array {
                        // Nom du produit (poids élevé)
                        if let Some(nom) = product.get("nom").and_then(|v| v.as_str()) {
                            if nom.to_lowercase().contains(&term) {
                                score += 0.4;
                            }
                        }
                        // Description du produit
                        if let Some(desc) = product.get("description").and_then(|v| v.as_str()) {
                            if desc.to_lowercase().contains(&term) {
                                score += 0.25;
                            }
                        }
                        // Type de produit
                        if let Some(ptype) = product.get("type").and_then(|v| v.as_str()) {
                            if ptype.to_lowercase().contains(&term) {
                                score += 0.3;
                            }
                        }
                        // Marque
                        if let Some(marque) = product.get("marque").and_then(|v| v.as_str()) {
                            if marque.to_lowercase().contains(&term) {
                                score += 0.25;
                            }
                        }
                        // Modèle
                        if let Some(modele) = product.get("modele").and_then(|v| v.as_str()) {
                            if modele.to_lowercase().contains(&term) {
                                score += 0.25;
                            }
                        }
                    }
                }
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
    user_id: Option<i32>,
    user_text: &str,
    gps_zone: Option<&str>,        // Nouveau paramètre GPS
    search_radius_km: Option<i32>, // Nouveau paramètre rayon
) -> AppResult<(Value, u32)> {
    use crate::services::orchestration_ia::extract_keywords_from_text;
    use crate::utils::log::log_info;

    log_info(&format!("[RECHERCHE_DIRECTE] Recherche directe avec texte utilisateur: '{}' (GPS: {:?}, Rayon: {:?}km)", 
        user_text, gps_zone, search_radius_km));

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

    // Utiliser le premier mot-clé comme terme de recherche principal
    let primary_keyword = &keywords[0];
    log_info(&format!(
        "[RECHERCHE_DIRECTE] Mot-clé principal: '{}'",
        primary_keyword
    ));

    let pool = sqlx::PgPool::connect(
        &std::env::var("DATABASE_URL").expect("DATABASE_URL doit être défini"),
    )
    .await
    .map_err(|e| crate::core::types::AppError::Internal(format!("Erreur connexion base: {}", e)))?;

    // ✅ Phase 10 - Initialiser le service de matching géographique pour enrichir les distances
    use crate::services::cache_service::CacheService;
    use crate::services::geocoding_service::GeocodingService;
    use std::sync::Arc;
    
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());
    let redis_client = redis::Client::open(redis_url).ok();
    let cache_service = Arc::new(CacheService::new(redis_client.clone()));
    let geocoding_service = GeocodingService::with_cache(redis_client.clone());
    let geographic_matching = Arc::new(
        crate::services::geographic_matching_service::GeographicMatchingService::new(
            pool.clone(),
            cache_service,
            geocoding_service,
        ),
    );
    
    // Configuration de la recherche native avec service de matching géographique
    let native_search = NativeSearchService::with_geographic_matching(
        pool.clone(),
        geographic_matching,
    );

    // ✅ NOUVEAU 2025-11-04 : PRÉ-FILTRE INTELLIGENT PAR LIEU BIDIRECTIONNEL
    // Passer l'INPUT COMPLET (pas un lieu détecté) pour matching flexible
    // Le SQL vérifiera si UN ÉLÉMENT du location_vector de chaque produit est dans l'input
    log_info(&format!(
        "[RECHERCHE_DIRECTE] 🗺️ PRÉ-FILTRE lieu bidirectionnel avec input complet: '{}'",
        user_text
    ));

    // Recherche native intelligente avec le mot-clé principal ET filtrage GPS + LIEU
    let native_results = match native_search
        .intelligent_search_with_location_prefilter(
            primary_keyword,
            user_text, // ✅ INPUT COMPLET pour pré-filtre lieu
            None,      // Pas de filtre de catégorie
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
                search_services_direct_fallback(&pool, primary_keyword, &keywords).await?;
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

    // ✅ ENRICHIR les résultats avec les informations utilisateur, produit et localisation
    let mut enriched_results = Vec::new();
    for matched_service in matches {
        let service_id = matched_service.service_id;
        
        // Récupérer les informations de l'utilisateur depuis la table users
        let user_info: Option<(i32, Option<String>, Option<String>)> = sqlx::query_as::<_, (i32, Option<String>, Option<String>)>(
            r#"
            SELECT u.id, u.nom_complet, u.avatar_url
            FROM services s
            INNER JOIN users u ON u.id = s.user_id
            WHERE s.id = $1
            "#
        )
        .bind(service_id)
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten();

        // Récupérer les informations de produit depuis autocomplete_characteristics
        let product_info: Option<(Option<Vec<String>>, Option<Vec<String>>, Option<Vec<String>>, Option<String>, Option<i64>)> = sqlx::query_as::<_, (Option<Vec<String>>, Option<Vec<String>>, Option<Vec<String>>, Option<String>, Option<i64>)>(
            r#"
            SELECT 
                ac.characteristic_vector as product_vector,
                ac.product_labels,
                ac.location_vector,
                ac.chosen_location,
                ac.usage_count
            FROM autocomplete_characteristics ac
            WHERE ac.service_id = $1
            AND ac.is_real_product = TRUE
            AND ac.identifiant_base = 'produits'
            ORDER BY ac.usage_count DESC NULLS LAST
            LIMIT 1
            "#
        )
        .bind(service_id)
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten();

        // Construire l'objet utilisateur
        let user_obj = if let Some((user_id, nom_complet, avatar_url)) = user_info {
            json!({
                "id": user_id,
                "nom_complet": nom_complet,
                "avatar_url": avatar_url
            })
        } else {
            json!(null)
        };

        // Construire l'objet prestataire
        let prestataire_obj = if let Some((user_id, nom_complet, avatar_url)) = user_info {
            json!({
                "user_id": user_id,
                "nom": nom_complet.unwrap_or_else(|| "Prestataire".to_string()),
                "nom_complet": nom_complet,
                "avatar_url": avatar_url
            })
        } else {
            json!({
                "nom": "Prestataire"
            })
        };

        // Extraire les informations de produit
        let (product_vector, product_labels, location_vector, chosen_location, usage_count) = 
            product_info.unwrap_or((None, None, None, None, None));

        // Construire le résultat enrichi
        let mut enriched_result = json!({
            "service_id": service_id,
            "data": matched_service.data,
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

        enriched_results.push(enriched_result);
    }

    // Convertir en format de réponse
    let results_array: Vec<Value> = enriched_results;

    log_info(&format!(
        "[RECHERCHE_DIRECTE] {} résultats convertis",
        results_array.len()
    ));

    let final_result = json!({
        "resultats": results_array,
        "nombre_matchings": results_array.len(),
        "message": "Recherche directe PostgreSQL réussie"
    });

    Ok((final_result, 1)) // 1 token pour la recherche directe
}

/// Recherche SQL directe de fallback avec mots-clés
async fn search_services_direct_fallback(
    pool: &sqlx::PgPool,
    _primary_keyword: &str,
    all_keywords: &[String],
) -> Result<Vec<serde_json::Value>, crate::core::types::AppError> {
    // Construire la requête SQL avec tous les mots-clés
    let mut conditions = Vec::new();
    let mut params = Vec::new();

    for (i, keyword) in all_keywords.iter().enumerate() {
        let param_name = format!("${}", i + 1);
        conditions.push(format!(
            "(s.data->'titre_service'->>'valeur' ILIKE {} OR s.data->'description'->>'valeur' ILIKE {} OR s.data->'category'->>'valeur' ILIKE {})",
            param_name, param_name, param_name
        ));
        params.push(format!("%{}%", keyword));
    }

    let where_clause = if conditions.is_empty() {
        "s.is_active = true".to_string()
    } else {
        format!("s.is_active = true AND ({})", conditions.join(" OR "))
    };

    let query = format!(
        r#"
        SELECT s.id, s.user_id, s.data, s.is_active, s.created_at
        FROM services s
        WHERE {}
        ORDER BY s.created_at DESC
        "#,
        where_clause
    );

    // Exécuter la requête avec les paramètres
    let mut query_builder = sqlx::query(&query);
    for param in &params {
        query_builder = query_builder.bind(param);
    }

    let services = query_builder.fetch_all(pool).await.map_err(|e| {
        crate::core::types::AppError::Internal(format!("Erreur recherche SQL directe: {}", e))
    })?;

    let mut results = Vec::new();
    for row in services {
        // Extraire les données de la ligne
        let service_id: i32 = row.try_get("id")?;
        let _user_id: i32 = row.try_get("user_id")?;
        let data: Value = row.try_get("data")?;
        let _is_active: bool = row.try_get("is_active")?;
        let created_at: chrono::DateTime<chrono::Utc> = row.try_get("created_at")?;

        // Calculer un score basé sur tous les mots-clés
        let mut score = 0.0;
        let data_str = data.to_string().to_lowercase();

        // Score pour chaque mot-clé trouvé
        for (i, keyword) in all_keywords.iter().enumerate() {
            let keyword_lower = keyword.to_lowercase();

            // Score de base pour présence du mot-clé
            if data_str.contains(&keyword_lower) {
                score += 0.3;
            }

            // Bonus pour correspondance exacte dans le titre (poids plus élevé pour le mot-clé principal)
            if let Some(titre) = data.get("titre_service") {
                if let Some(titre_str) = titre.as_str() {
                    if titre_str.to_lowercase().contains(&keyword_lower) {
                        score += if i == 0 { 0.4 } else { 0.2 }; // Plus de poids pour le mot-clé principal
                    }
                }
            }

            // Bonus pour correspondance dans la catégorie
            if let Some(cat) = data.get("category") {
                if let Some(cat_str) = cat.as_str() {
                    if cat_str.to_lowercase().contains(&keyword_lower) {
                        score += if i == 0 { 0.3 } else { 0.1 }; // Plus de poids pour le mot-clé principal
                    }
                }
            }
        }

        // Bonus pour services récents
        let days_old = chrono::Utc::now()
            .signed_duration_since(created_at)
            .num_days();
        if days_old <= 7 {
            score += 0.1;
        }

        let result = serde_json::json!({
            "service_id": service_id,
            "data": data,
            "score": score,
            "semantic_score": score,
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
    
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379/0".to_string());
    let redis_client = redis::Client::open(redis_url).ok();
    let cache_service = Arc::new(CacheService::new(redis_client.clone()));
    let geocoding_service = GeocodingService::with_cache(redis_client.clone());
    let geographic_matching = Arc::new(
        crate::services::geographic_matching_service::GeographicMatchingService::new(
            pool.clone(),
            cache_service,
            geocoding_service,
        ),
    );
    
    // Configuration de la recherche native avec service de matching géographique
    let native_search = NativeSearchService::with_geographic_matching(
        pool.clone(),
        geographic_matching,
    );

    // Recherche native intelligente
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
            let service_exists: Option<ServiceIdRow> = sqlx::query_as(
                "SELECT id FROM services WHERE id = $1 AND is_active = true"
            )
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
