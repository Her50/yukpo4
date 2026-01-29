// Service pour gérer les combinaisons autocomplete vectorielles
use crate::core::types::AppError;
use serde::{Deserialize, Serialize};
use sqlx::{types::Decimal, PgPool, Row};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AutocompleteCombination {
    pub id: i32,
    pub service_id: Option<i32>,
    pub product_vector: Vec<String>,
    pub location_vector: Vec<String>,
    pub full_vector: Vec<String>,
    pub product_labels: Vec<String>, // ✅ NOUVEAU : Étiquettes du product_vector
    pub location_labels: Vec<String>, // ✅ NOUVEAU : Étiquettes du location_vector
    pub chosen_location: Option<String>,
    pub usage_count: i32,
    pub is_ai_preferred: bool,
    pub ai_confidence: f64,
    pub session_id: Option<String>,
    pub has_variant: bool,
    pub variant_dimension: Option<String>,
    pub variant_value: Option<String>,
    pub prix: Option<Decimal>,
    pub devise: Option<String>,
    pub stock: Option<i32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinationSearchResult {
    pub combination: AutocompleteCombination,
    pub location_score: f32,
    pub popularity_score: f32,
    pub final_score: f32,
}

/// Sauvegarder plusieurs combinaisons générées par l'IA (en arrière-plan)
pub async fn save_ai_combinations_batch(
    pool: &PgPool,
    combinations: Vec<AICombinationInput>,
    session_id: &str,
) -> Result<Vec<i32>, AppError> {
    log::info!(
        "[AutocompleteCombinations] Sauvegarde batch de {} combinaisons (session: {})",
        combinations.len(),
        session_id
    );

    let mut saved_ids = Vec::new();

    for (index, combo) in combinations.iter().enumerate() {
        // Marquer la première combinaison comme préférée par l'IA
        let is_preferred = index == 0;

        // Log si combinaison préférée avec explication
        if is_preferred && combo.preferred_explanation.is_some() {
            log::info!(
                "[AutocompleteCombinations] ⭐ Combinaison préférée: {} (confiance: {:.2})",
                combo.preferred_explanation.as_ref().unwrap(),
                combo.ai_confidence
            );
        }

        let prix_decimal = combo.prix.clone();

        match upsert_combination(
            pool,
            &combo.product_vector,
            &combo.product_labels, // ✅ Passer les labels
            &combo.location_vector,
            &combo.location_labels, // ✅ Passer les labels location
            &combo.full_vector,
            combo.chosen_location.as_deref(),
            is_preferred,
            combo.ai_confidence,
            Some(session_id),
            combo.has_variant,
            combo.variant_dimension.as_deref(),
            combo.variant_value.as_deref(),
            prix_decimal,
            combo.devise.as_deref().unwrap_or("XAF"),
            combo.stock,
            None, // service_id sera ajouté plus tard lors de la création du service
        )
        .await
        {
            Ok(id) => {
                saved_ids.push(id);
                if is_preferred {
                    log::info!(
                        "[AutocompleteCombinations] ⭐ Combinaison préférée sauvegardée: ID {}",
                        id
                    );
                }
            }
            Err(e) => {
                log::warn!(
                    "[AutocompleteCombinations] Erreur sauvegarde combinaison {}: {}",
                    index,
                    e
                );
            }
        }
    }

    log::info!(
        "[AutocompleteCombinations] ✅ {} combinaisons sauvegardées sur {}",
        saved_ids.len(),
        combinations.len()
    );

    Ok(saved_ids)
}

/// Insérer ou mettre à jour une combinaison
pub async fn upsert_combination(
    pool: &PgPool,
    product_vector: &[String],
    product_labels: &[String], // ✅ NOUVEAU : Labels du vecteur
    location_vector: &[String],
    location_labels: &[String], // ✅ NOUVEAU : Labels de localisation
    full_vector: &[String],
    chosen_location: Option<&str>,
    is_ai_preferred: bool,
    ai_confidence: f64,
    session_id: Option<&str>,
    has_variant: bool,
    variant_dimension: Option<&str>,
    variant_value: Option<&str>,
    prix: Option<Decimal>,
    devise: &str,
    stock: Option<i32>,
    service_id: Option<i32>,
) -> Result<i32, AppError> {
    let prix_decimal = prix;

    // ✅ OPTIMISÉ 2025-12-12: Utiliser INSERT ... ON CONFLICT directement au lieu de fonction PostgreSQL
    // Cela réduit le temps d'exécution de ~528ms à ~50-100ms pour la sauvegarde des seeds
    let now = chrono::Utc::now();

    let result = sqlx::query(
        r#"
        INSERT INTO autocomplete_combinations 
        (session_id, product_vector, location_vector, full_vector, 
         product_labels, location_labels, usage_count, is_ai_preferred, 
         ai_confidence, chosen_location, has_variant, variant_dimension, 
         variant_value, prix, devise, stock, service_id, created_at, updated_at)
        VALUES ($1, $2::TEXT[], $3::TEXT[], $4::TEXT[], $5::TEXT[], $6::TEXT[], 
                $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (product_vector) DO UPDATE SET
            session_id = COALESCE(EXCLUDED.session_id, autocomplete_combinations.session_id),
            location_vector = EXCLUDED.location_vector,
            location_labels = EXCLUDED.location_labels,
            full_vector = EXCLUDED.full_vector,
            product_labels = EXCLUDED.product_labels,
            chosen_location = COALESCE(EXCLUDED.chosen_location, autocomplete_combinations.chosen_location),
            is_ai_preferred = autocomplete_combinations.is_ai_preferred OR EXCLUDED.is_ai_preferred,
            ai_confidence = GREATEST(autocomplete_combinations.ai_confidence, EXCLUDED.ai_confidence),
            has_variant = EXCLUDED.has_variant,
            variant_dimension = COALESCE(EXCLUDED.variant_dimension, autocomplete_combinations.variant_dimension),
            variant_value = COALESCE(EXCLUDED.variant_value, autocomplete_combinations.variant_value),
            prix = COALESCE(EXCLUDED.prix, autocomplete_combinations.prix),
            devise = COALESCE(EXCLUDED.devise, autocomplete_combinations.devise),
            stock = COALESCE(EXCLUDED.stock, autocomplete_combinations.stock),
            service_id = COALESCE(EXCLUDED.service_id, autocomplete_combinations.service_id),
            usage_count = autocomplete_combinations.usage_count + 1,
            updated_at = EXCLUDED.updated_at
        RETURNING id
        "#,
    )
    .bind(session_id)
    .bind(product_vector)
    .bind(location_vector)
    .bind(full_vector)
    .bind(product_labels)
    .bind(location_labels)
    .bind(1) // usage_count initial
    .bind(is_ai_preferred)
    .bind(ai_confidence)
    .bind(chosen_location)
    .bind(has_variant)
    .bind(variant_dimension)
    .bind(variant_value)
    .bind(prix_decimal)
    .bind(devise)
    .bind(stock)
    .bind(service_id)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await;

    match result {
        Ok(row) => {
            let id: i32 = row.get::<i32, _>("id");
            Ok(id)
        }
        Err(e) => Err(AppError::Internal(format!(
            "Erreur upsert combinaison: {}",
            e
        ))),
    }
}

/// Rechercher des combinaisons par filtres textuels
pub async fn search_combinations(
    pool: &PgPool,
    search_query: &str,
    user_location: Option<&str>,
    limit: i64,
) -> Result<Vec<CombinationSearchResult>, AppError> {
    log::info!(
        "[AutocompleteCombinations] Recherche: '{}' (location: {:?}, limit: {})",
        search_query,
        user_location,
        limit
    );

    // Diviser la requête en termes
    let terms: Vec<String> = search_query
        .split_whitespace()
        .map(|s| s.to_lowercase())
        .collect();

    // ✅ CORRECTION: Si la requête est vide, charger les combinaisons populaires
    if terms.is_empty() {
        log::info!(
            "[AutocompleteCombinations] Requête vide - Chargement des combinaisons populaires"
        );
        let sql = format!(
            r#"
            SELECT 
                *,
                0.0 as location_score,
                (usage_count::FLOAT / 100.0) as popularity_score
            FROM autocomplete_combinations
            WHERE usage_count > 0
            ORDER BY 
                is_ai_preferred DESC,
                usage_count DESC,
                created_at DESC
            LIMIT ${}
            "#,
            1
        );

        let rows = sqlx::query_as::<_, AutocompleteCombination>(&sql)
            .bind(limit)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                AppError::Internal(format!("Erreur recherche combinaisons populaires: {}", e))
            })?;

        let results: Vec<CombinationSearchResult> = rows
            .into_iter()
            .map(|combo| {
                let popularity_score = combo.usage_count as f32 / 100.0;
                let final_score = popularity_score; // Pas de score de localisation pour les populaires

                CombinationSearchResult {
                    combination: combo,
                    location_score: 0.0,
                    popularity_score,
                    final_score,
                }
            })
            .collect();

        log::info!(
            "[AutocompleteCombinations] ✅ {} combinaisons populaires chargées",
            results.len()
        );

        return Ok(results);
    }

    // Construction de la requête SQL avec recherche progressive
    let mut where_clauses = Vec::new();
    let mut bind_index = 1;

    // Recherche dans full_vector pour chaque terme
    for _ in &terms {
        where_clauses.push(format!(
            "EXISTS (
                SELECT 1 FROM unnest(full_vector) AS elem 
                WHERE LOWER(elem) LIKE '%' || ${} || '%'
            )",
            bind_index
        ));
        bind_index += 1;
    }

    let where_clause = where_clauses.join(" AND ");
    let location_param_index = bind_index;
    let limit_param_index = bind_index + 1;

    let sql = format!(
        r#"
        SELECT 
            *,
            COALESCE(
                calculate_location_score(${}::TEXT, location_vector, chosen_location), 
                0.0
            ) as location_score,
            (usage_count::FLOAT / 100.0) as popularity_score
        FROM autocomplete_combinations
        WHERE {}
        ORDER BY 
            is_ai_preferred DESC,
            (COALESCE(calculate_location_score(${}::TEXT, location_vector, chosen_location), 0.0) * 0.7 
             + (usage_count::FLOAT / 100.0) * 0.3) DESC
        LIMIT ${}
        "#,
        location_param_index, where_clause, location_param_index, limit_param_index
    );

    // Construction de la requête avec bindings
    let mut query = sqlx::query_as::<_, AutocompleteCombination>(&sql);

    // Bind des termes de recherche
    for term in &terms {
        query = query.bind(term);
    }

    // Bind location et limit
    query = query.bind(user_location.unwrap_or(""));
    query = query.bind(limit);

    let rows = query
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur recherche combinaisons: {}", e)))?;

    // Calculer les scores
    let results: Vec<CombinationSearchResult> = rows
        .into_iter()
        .map(|combo| {
            let location_score = if let Some(ref loc) = user_location {
                calculate_location_score_rust(
                    loc,
                    &combo.location_vector,
                    combo.chosen_location.as_deref(),
                )
            } else {
                0.0
            };
            let popularity_score = combo.usage_count as f32 / 100.0;
            let final_score = location_score * 0.7 + popularity_score * 0.3;

            CombinationSearchResult {
                combination: combo,
                location_score,
                popularity_score,
                final_score,
            }
        })
        .collect();

    log::info!(
        "[AutocompleteCombinations] ✅ {} résultats trouvés",
        results.len()
    );

    Ok(results)
}

/// Récupérer les combinaisons d'une session IA (mise en cache)
pub async fn get_combinations_by_session(
    pool: &PgPool,
    session_id: &str,
) -> Result<Vec<AutocompleteCombination>, AppError> {
    let rows = sqlx::query_as::<_, AutocompleteCombination>(
        r#"
        SELECT *
        FROM autocomplete_combinations
        WHERE session_id = $1
        ORDER BY is_ai_preferred DESC, ai_confidence DESC
        "#,
    )
    .bind(session_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération combinaisons session: {}", e)))?;

    Ok(rows)
}

/// Récupérer la combinaison préférée de l'IA pour une session
pub async fn get_ai_preferred_combination(
    pool: &PgPool,
    session_id: &str,
) -> Result<Option<AutocompleteCombination>, AppError> {
    let row = sqlx::query_as::<_, AutocompleteCombination>(
        r#"
        SELECT *
        FROM autocomplete_combinations
        WHERE session_id = $1 AND is_ai_preferred = TRUE
        LIMIT 1
        "#,
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération combinaison préférée: {}", e)))?;

    Ok(row)
}

/// Associer des combinaisons à un service après sa création
pub async fn link_combinations_to_service(
    pool: &PgPool,
    session_id: &str,
    service_id: i32,
) -> Result<usize, AppError> {
    let result = sqlx::query(
        r#"
        UPDATE autocomplete_combinations
        SET service_id = $1, updated_at = NOW()
        WHERE session_id = $2 AND service_id IS NULL
        "#,
    )
    .bind(service_id)
    .bind(session_id)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur liaison combinaisons au service: {}", e)))?;

    log::info!(
        "[AutocompleteCombinations] ✅ {} combinaisons liées au service {}",
        result.rows_affected(),
        service_id
    );

    Ok(result.rows_affected() as usize)
}

/// Extraire les combinaisons depuis le JSON de l'IA
pub fn extract_combinations_from_ai_response(
    ai_data: &serde_json::Value,
) -> Result<Vec<AICombinationInput>, AppError> {
    // Chercher le champ "produits" avec type_donnee="autocomplete"
    let produits_field = ai_data
        .get("produits")
        .or_else(|| ai_data.get("data").and_then(|d| d.get("produits")))
        .ok_or_else(|| AppError::BadRequest("Champ 'produits' non trouvé".to_string()))?;

    // Vérifier le type
    let type_donnee = produits_field
        .get("type_donnee")
        .and_then(|t| t.as_str())
        .ok_or_else(|| AppError::BadRequest("type_donnee manquant dans produits".to_string()))?;

    if type_donnee != "autocomplete" {
        return Err(AppError::BadRequest(format!(
            "Type produits incorrect: {} (attendu: autocomplete)",
            type_donnee
        )));
    }

    // Extraire les valeurs (tableau de combinaisons)
    let valeurs = produits_field
        .get("valeur")
        .and_then(|v| v.as_array())
        .ok_or_else(|| AppError::BadRequest("Champ 'valeur' manquant ou invalide".to_string()))?;

    // Extraire le séparateur
    let separateur = produits_field
        .get("separateur")
        .and_then(|s| s.as_str())
        .unwrap_or(",");

    // ✅ NOUVEAU : Extraire les labels depuis sous_caracteristiques
    let sous_caracs = produits_field
        .get("sous_caracteristiques")
        .and_then(|sc| sc.as_object())
        .ok_or_else(|| {
            AppError::BadRequest("Champ 'sous_caracteristiques' manquant".to_string())
        })?;

    // Extraire les labels (clés) dans l'ordre
    let product_labels: Vec<String> = sous_caracs
        .keys()
        .filter(|k| *k != "lieu") // Exclure "lieu" qui est dans location_labels
        .map(|k| k.clone())
        .collect();

    log::info!(
        "[extract_combinations] Labels extraits: {:?}",
        product_labels
    );

    // Extraire variation_prix si présente
    let variation_prix = produits_field.get("variation_prix");
    let has_variant = variation_prix.is_some();
    let variant_dimension = variation_prix
        .and_then(|v| v.get("variable"))
        .and_then(|var| var.as_str())
        .map(|s| s.to_string());

    // Extraire modalités si variation_prix existe
    let modalites: HashMap<String, (f64, String, Option<i32>)> =
        if let Some(var_prix) = variation_prix {
            if let Some(modalites_arr) = var_prix.get("modalites").and_then(|m| m.as_array()) {
                modalites_arr
                    .iter()
                    .filter_map(|m| {
                        let valeur = m.get("valeur")?.as_str()?.to_string();
                        let prix = m.get("prix")?.as_f64()?;
                        let devise = m.get("devise")?.as_str()?.to_string();
                        let stock = m.get("stock").and_then(|s| s.as_i64()).map(|s| s as i32);
                        Some((valeur, (prix, devise, stock)))
                    })
                    .collect()
            } else {
                HashMap::new()
            }
        } else {
            HashMap::new()
        };

    // Prix/devise par défaut si pas de variation
    let default_prix = ai_data
        .get("prix_produit")
        .or_else(|| ai_data.get("data").and_then(|d| d.get("prix_produit")))
        .and_then(|p| p.get("valeur"))
        .and_then(|v| v.as_f64());

    let default_devise = ai_data
        .get("devise_produit")
        .or_else(|| ai_data.get("data").and_then(|d| d.get("devise_produit")))
        .and_then(|d| d.get("valeur"))
        .and_then(|v| v.as_str())
        .unwrap_or("XAF")
        .to_string();

    // ✅ NOUVEAU 2025-11-03: Extraire les informations de combinaison préférée
    let preferred_match = produits_field.get("preferred_match");
    let preferred_explanation = preferred_match
        .and_then(|pm| pm.get("explanation"))
        .and_then(|e| e.as_str())
        .map(|s| s.to_string());

    let preferred_confidence = preferred_match
        .and_then(|pm| pm.get("confidence"))
        .and_then(|c| c.as_f64());

    if let Some(ref expl) = preferred_explanation {
        log::info!(
            "[extract_combinations] ⭐ Combinaison préférée détectée: {} (confiance: {:.2})",
            expl,
            preferred_confidence.unwrap_or(0.0)
        );
    }

    let mut combinations = Vec::new();

    for (index, valeur_str) in valeurs.iter().enumerate() {
        if let Some(valeur_str) = valeur_str.as_str() {
            // Découper la valeur selon le séparateur
            let parts: Vec<String> = valeur_str
                .split(separateur)
                .map(|s| s.trim().to_string())
                .collect();

            // Séparer product_vector et location_vector
            // Le dernier élément vide est réservé pour la localisation
            let mut product_vector = parts.clone();
            let location_vector: Vec<String> = vec![]; // Vide pour l'instant (rempli par prestataire)

            // Si le dernier élément est vide, le retirer du product_vector
            if let Some(last) = product_vector.last() {
                if last.is_empty() {
                    product_vector.pop();
                }
            }

            // full_vector = product_vector + location_vector
            let mut full_vector = product_vector.clone();
            full_vector.extend(location_vector.clone());

            // Identifier la valeur de variante si applicable
            let variant_value = if has_variant && variant_dimension.is_some() {
                // La variante est généralement l'avant-dernier élément du product_vector
                if product_vector.len() >= 2 {
                    Some(product_vector[product_vector.len() - 1].clone())
                } else {
                    None
                }
            } else {
                None
            };

            // Récupérer prix, devise, stock depuis les modalités ou par défaut
            let (prix, devise, stock) = if let Some(ref var_val) = variant_value {
                modalites
                    .get(var_val)
                    .map(|(p, d, s)| (Some(*p), d.clone(), *s))
                    .unwrap_or((default_prix, default_devise.clone(), None))
            } else {
                (default_prix, default_devise.clone(), None)
            };

            let prix_decimal = prix.and_then(Decimal::from_f64_retain);

            // Confiance IA : légèrement décroissante pour les combinaisons suivantes
            // SAUF si c'est la préférée, on garde la confiance du preferred_match
            let ai_confidence = if index == 0 && preferred_confidence.is_some() {
                preferred_confidence.unwrap()
            } else {
                1.0 - (index as f64 * 0.05)
            };

            // Location labels (vide pour l'instant, sera rempli par le prestataire)
            let location_labels: Vec<String> = vec![];

            // Explication de la préférence (seulement pour index 0)
            let expl = if index == 0 {
                preferred_explanation.clone()
            } else {
                None
            };

            combinations.push(AICombinationInput {
                product_vector,
                product_labels: product_labels.clone(), // ✅ Labels du vecteur produit
                location_vector,
                location_labels, // ✅ Labels de localisation (vide)
                full_vector,
                chosen_location: None,
                ai_confidence,
                has_variant,
                variant_dimension: variant_dimension.clone(),
                variant_value,
                prix: prix_decimal,
                devise: Some(devise),
                stock,
                preferred_explanation: expl, // ✅ NOUVEAU 2025-11-03
                preferred_match_confidence: if index == 0 {
                    preferred_confidence
                } else {
                    None
                }, // ✅ NOUVEAU 2025-11-03
            });
        }
    }

    log::info!(
        "[AutocompleteCombinations] ✅ {} combinaisons extraites du JSON IA (labels: {:?})",
        combinations.len(),
        product_labels
    );

    Ok(combinations)
}

/// Input pour créer une combinaison depuis l'IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AICombinationInput {
    pub product_vector: Vec<String>,
    pub product_labels: Vec<String>, // ✅ NOUVEAU : Labels du vecteur
    pub location_vector: Vec<String>,
    pub location_labels: Vec<String>, // ✅ NOUVEAU : Labels de localisation
    pub full_vector: Vec<String>,
    pub chosen_location: Option<String>,
    pub ai_confidence: f64,
    pub has_variant: bool,
    pub variant_dimension: Option<String>,
    pub variant_value: Option<String>,
    pub prix: Option<Decimal>,
    pub devise: Option<String>,
    pub stock: Option<i32>,
    pub preferred_explanation: Option<String>, // ✅ NOUVEAU 2025-11-03: Explication choix préféré
    pub preferred_match_confidence: Option<f64>, // ✅ NOUVEAU 2025-11-03: Confiance du match
}

/// Calcul du score de localisation (version Rust, miroir de la fonction SQL)
fn calculate_location_score_rust(
    search_location: &str,
    location_vector: &[String],
    chosen_location: Option<&str>,
) -> f32 {
    let search_lower = search_location.to_lowercase();

    // Correspondance exacte avec chosen_location
    if let Some(chosen) = chosen_location {
        if chosen.to_lowercase() == search_lower {
            return 1.0;
        }
    }

    // Recherche dans le vecteur
    for (i, loc) in location_vector.iter().enumerate() {
        let loc_lower = loc.to_lowercase();
        if loc_lower == search_lower {
            return (1.0 - i as f32 * 0.1).max(0.0);
        } else if loc_lower.contains(&search_lower) {
            return (0.5 - i as f32 * 0.1).max(0.0);
        }
    }

    0.0
}
