// ?? src/services/creer_service.rs

use crate::core::types::AppError;
use crate::utils::embedding_client::AddEmbeddingPineconeRequest;
use sqlx::{PgPool, Row};
use log::info;
use chrono::Utc;
use base64::{Engine, engine::general_purpose::STANDARD};

// ✅ NOUVEAU 2025-11-01 : Configuration des coûts de création de services et produits
mod service_costs {
    /// Coût de création du premier produit (basé sur tokens IA)
    pub const COST_PER_TOKEN_XAF: f64 = 0.004;
    pub const MULTIPLIER_FIRST_PRODUCT: f64 = 100.0;
    
    /// ✅ Coût fixe d'ajout d'un nouveau produit dupliqué (modifié)
    pub const COST_NEW_PRODUCT_DUPLICATE_XAF: i64 = 3000;
    
    /// Coût minimum de création d'un service sans produits
    #[allow(dead_code)]
    pub const COST_SERVICE_MINIMUM_XAF: i64 = 500;
    
    /// Calculer le coût de création d'un service selon le contexte
    pub fn calculate_service_creation_cost(tokens_ia_externe: i64, is_first_product: bool) -> i64 {
        if is_first_product {
            // Premier produit : coût basé sur tokens IA
            let cost = (tokens_ia_externe as f64) * COST_PER_TOKEN_XAF * MULTIPLIER_FIRST_PRODUCT;
            cost.round() as i64
        } else {
            // Produits suivants : coût fixe
            COST_NEW_PRODUCT_DUPLICATE_XAF
        }
    }
}

// ?? Imports pour la génération de signatures d'images (conditionnels)
#[cfg(feature = "image_search")]
use md5;

/// Structure pour tracker les tokens consomm?s lors de la cr?ation de service
#[derive(Debug, Clone)]
pub struct ServiceCreationTokens {
    pub validation_tokens: i64,
    pub embedding_tokens: i64,
    pub translation_tokens: i64,
    pub ocr_tokens: i64,
    pub enrichment_tokens: i64,
    pub total_tokens: i64,
}

impl ServiceCreationTokens {
    pub fn new() -> Self {
        Self {
            validation_tokens: 0,
            embedding_tokens: 0,
            translation_tokens: 0,
            ocr_tokens: 0,
            enrichment_tokens: 0,
            total_tokens: 0,
        }
    }
    
    pub fn add_validation(&mut self, complexity: i64) {
        self.validation_tokens += complexity;
        self.total_tokens += complexity;
    }
    
    pub fn add_embedding(&mut self, fields_count: usize) {
        let tokens = (fields_count as i64).max(1);
        self.embedding_tokens += tokens;
        self.total_tokens += tokens;
    }
    
    pub fn add_translation(&mut self, text_length: usize) {
        let tokens = (text_length / 100).max(1) as i64; // 1 token per 100 chars
        self.translation_tokens += tokens;
        self.total_tokens += tokens;
    }
    
    pub fn add_ocr(&mut self, image_size_estimate: usize) {
        let tokens = (image_size_estimate / 1000).max(2) as i64; // 2 tokens minimum for OCR
        self.ocr_tokens += tokens;
        self.total_tokens += tokens;
    }
    
    pub fn add_enrichment(&mut self, complexity: i64) {
        self.enrichment_tokens += complexity;
        self.total_tokens += complexity;
    }
}

// Validation commune du JSON de service (structure, champs, intention)
pub fn valider_service_json(data: &serde_json::Value) -> Result<serde_json::Value, AppError> {
    // DEBUG: Affichage du JSON re?u pour debug maximal
    println!("[DEBUG][valider_service_json] JSON re?u : {}", data);
    
    // Si data n'est pas un objet, tenter d'extraire le premier objet JSON du texte (robustesse IA)
    let mut data_obj = if !data.is_object() {
        if let Some(s) = data.as_str() {
            if let Some(start) = s.find('{') {
                if let Some(end) = s.rfind('}') {
                    let json_str = &s[start..=end];
                    match serde_json::from_str::<serde_json::Value>(json_str) {
                        Ok(val) => val,
                        Err(_) => return Err(AppError::BadRequest("La sortie de l'IA doit contenir un objet JSON valide. Aucun JSON exploitable trouv?.".to_string())),
                    }
                } else {
                    return Err(AppError::BadRequest("La sortie de l'IA ne contient pas de JSON complet (accolade fermante manquante).".to_string()));
                }
            } else {
                return Err(AppError::BadRequest("La sortie de l'IA ne contient pas d'objet JSON (accolade ouvrante manquante).".to_string()));
            }
        } else {
            return Err(AppError::BadRequest("La sortie de l'IA doit ?tre un objet JSON strict, ou contenir un objet JSON exploitable.".to_string()));
        }
    } else {
        data.clone()
    };
    
    // ? OPTIMISATION : Nettoyage automatique des champs probl?matiques
    if let Some(map) = data_obj.as_object_mut() {
        // Supprimer tous les champs *_type et *_options restants
        let keys_to_remove: Vec<String> = map.keys()
            .filter(|k| k.ends_with("_type") || k.ends_with("_options"))
            .cloned()
            .collect();
        for k in keys_to_remove {
            map.remove(&k);
        }
        
        // ? OPTIMISATION : Normaliser le champ produits s'il est un tableau direct
        if let Some(produits) = map.get("produits") {
            if produits.is_array() {
                // Convertir le tableau direct en format objet attendu par le sch?ma
                let produits_array = produits.as_array().unwrap();
                let produits_obj = serde_json::json!({
                    "type_donnee": "listeproduit",
                    "valeur": produits_array,
                    "origine_champs": "ia"
                });
                map.insert("produits".to_string(), produits_obj);
                log::info!("[valider_service_json] Normalisation du champ produits: tableau -> objet");
            }
        }
        
        // ? OPTIMISATION : Normaliser le champ gps_fixe s'il manque la propri?t? valeur
        if let Some(gps_fixe) = map.get("gps_fixe") {
            if let Some(gps_obj) = gps_fixe.as_object() {
                if !gps_obj.contains_key("valeur") {
                    log::info!("[valider_service_json] Normalisation du champ gps_fixe: ajout valeur manquante");
                    let mut gps_fixe_normalized = gps_obj.clone();
                    gps_fixe_normalized.insert("valeur".to_string(), serde_json::Value::String("".to_string()));
                    map.insert("gps_fixe".to_string(), serde_json::Value::Object(gps_fixe_normalized));
                }
            }
        }
        
        // ? OPTIMISATION : Ajouter automatiquement origine_champs manquants
        for (key, value) in map.iter_mut() {
            if let Some(obj) = value.as_object_mut() {
                if !obj.contains_key("origine_champs") && obj.contains_key("type_donnee") && obj.contains_key("valeur") {
                    // D?terminer l'origine automatiquement
                    let origine = if key == "titre_service" || key == "description" {
                        "texte_libre"
                    } else {
                        "ia"
                    };
                    obj.insert("origine_champs".to_string(), serde_json::Value::String(origine.to_string()));
                    log::info!("[valider_service_json] Ajout automatique origine_champs='{}' pour champ '{}'", origine, key);
                }
            }
        }
        
        // ✅ NOUVEAU : Validation spécifique des nouveaux types (autocomplete, price_variant, date, location)
        for (key, value) in map.iter() {
            if let Some(obj) = value.as_object() {
                if let Some(type_donnee) = obj.get("type_donnee").and_then(|v| v.as_str()) {
                    match type_donnee {
                        "autocomplete" => {
                            // Valider structure autocomplete
                            if !obj.contains_key("valeur") || !obj.get("valeur").and_then(|v| v.as_array()).is_some() {
                                return Err(AppError::BadRequest(format!("Champ '{}': autocomplete doit avoir 'valeur' (array)", key)));
                            }
                            if !obj.contains_key("separateur") {
                                return Err(AppError::BadRequest(format!("Champ '{}': autocomplete doit avoir 'separateur'", key)));
                            }
                            if !obj.contains_key("sous_caracteristiques") {
                                return Err(AppError::BadRequest(format!("Champ '{}': autocomplete doit avoir 'sous_caracteristiques'", key)));
                            }
                            if !obj.contains_key("identifiant_base") {
                                return Err(AppError::BadRequest(format!("Champ '{}': autocomplete doit avoir 'identifiant_base'", key)));
                            }
                            log::info!("[valider_service_json] ✅ Champ '{}' autocomplete validé", key);
                        },
                        "price_variant" => {
                            // Valider structure price_variant
                            if !obj.contains_key("variable") {
                                return Err(AppError::BadRequest(format!("Champ '{}': price_variant doit avoir 'variable'", key)));
                            }
                            if !obj.contains_key("modalites") {
                                return Err(AppError::BadRequest(format!("Champ '{}': price_variant doit avoir 'modalites'", key)));
                            }
                            if let Some(modalites) = obj.get("modalites").and_then(|v| v.as_array()) {
                                for (idx, modalite) in modalites.iter().enumerate() {
                                    if let Some(mod_obj) = modalite.as_object() {
                                        // Vérifier que prix est un nombre (jamais string)
                                        if let Some(prix_val) = mod_obj.get("prix") {
                                            if !prix_val.is_number() {
                                                return Err(AppError::BadRequest(format!(
                                                    "Champ '{}': modalite[{}].prix doit être un nombre (jamais string)", 
                                                    key, idx
                                                )));
                                            }
                                        } else {
                                            return Err(AppError::BadRequest(format!(
                                                "Champ '{}': modalite[{}] doit avoir 'prix' (number)", 
                                                key, idx
                                            )));
                                        }
                                        if !mod_obj.contains_key("valeur") {
                                            return Err(AppError::BadRequest(format!(
                                                "Champ '{}': modalite[{}] doit avoir 'valeur'", 
                                                key, idx
                                            )));
                                        }
                                        if !mod_obj.contains_key("devise") {
                                            return Err(AppError::BadRequest(format!(
                                                "Champ '{}': modalite[{}] doit avoir 'devise'", 
                                                key, idx
                                            )));
                                        }
                                    } else {
                                        return Err(AppError::BadRequest(format!(
                                            "Champ '{}': modalite[{}] doit être un objet", 
                                            key, idx
                                        )));
                                    }
                                }
                            } else {
                                return Err(AppError::BadRequest(format!("Champ '{}': price_variant.modalites doit être un array", key)));
                            }
                            log::info!("[valider_service_json] ✅ Champ '{}' price_variant validé", key);
                        },
                        "date" => {
                            // Valider structure date
                            if let Some(valeur) = obj.get("valeur").and_then(|v| v.as_str()) {
                                // Valider format ISO (YYYY-MM-DD) avec regex simple
                                let parts: Vec<&str> = valeur.split('-').collect();
                                if parts.len() != 3 
                                    || parts[0].len() != 4 
                                    || parts[1].len() != 2 
                                    || parts[2].len() != 2
                                    || !parts[0].chars().all(|c| c.is_ascii_digit())
                                    || !parts[1].chars().all(|c| c.is_ascii_digit())
                                    || !parts[2].chars().all(|c| c.is_ascii_digit()) {
                                    return Err(AppError::BadRequest(format!(
                                        "Champ '{}': date.valeur doit être au format YYYY-MM-DD (ex: 2024-12-25)", 
                                        key
                                    )));
                                }
                            } else {
                                return Err(AppError::BadRequest(format!("Champ '{}': date doit avoir 'valeur' (string format YYYY-MM-DD)", key)));
                            }
                            log::info!("[valider_service_json] ✅ Champ '{}' date validé", key);
                        },
                        "location" => {
                            // Valider structure location
                            if !obj.contains_key("valeur") {
                                return Err(AppError::BadRequest(format!("Champ '{}': location doit avoir 'valeur'", key)));
                            }
                            log::info!("[valider_service_json] ✅ Champ '{}' location validé", key);
                        },
                        _ => {}
                    }
                }
            }
        }
    }
    
    // ? OPTIMISATION : Validation sch?ma simplifi?e
    // Chargement du sch?ma JSON depuis le fichier centralis?
    let schema_str = match std::fs::read_to_string("src/schemas/service_schema.json") {
        Ok(s) => {
            log::info!("[valider_service_json] ? Sch?ma JSON charg? avec succ?s ({} bytes)", s.len());
            s
        },
        Err(e) => {
            log::warn!("[valider_service_json] ? Sch?ma JSON non trouv?: {}", e);
            // Validation simplifi?e si le sch?ma n'est pas trouv?
            if data_obj.get("titre_service").is_some() && 
               data_obj.get("category").is_some() && 
               data_obj.get("description").is_some() {
                info!("[valider_service_json] Validation simplifi?e r?ussie");
                return Ok(data_obj);
            } else {
                return Err(AppError::BadRequest("Champs obligatoires manquants (titre_service, category, description)".to_string()));
            }
        }
    };
    
    let schema_json: serde_json::Value = serde_json::from_str(&schema_str)
        .map_err(|e| AppError::Internal(format!("Erreur parsing sch?ma JSON: {e}")))?;
    
    log::info!("[valider_service_json] ?? Validation du sch?ma pour data_obj...");
    log::info!("[valider_service_json] ?? Sch?ma charg?: {}", serde_json::to_string_pretty(&schema_json).unwrap_or_default());
    
    // Validation sch?ma sur data_obj (qui contient seulement les donn?es du service)
    if !jsonschema::is_valid(&schema_json, &data_obj) {
        log::error!("[valider_service_json] ? Sch?ma non valide pour data_obj: {:#?}", data_obj);
        
        // Debug: afficher les erreurs de validation sp?cifiques
        let instance = jsonschema::JSONSchema::compile(&schema_json)
            .map_err(|e| AppError::Internal(format!("Erreur compilation sch?ma JSON: {e}")))?;
        
        let validation_result = instance.validate(&data_obj);
        if let Err(errors) = validation_result {
            for error in errors {
                log::error!("[valider_service_json] ? Erreur validation: {} ? {}", error, error.instance_path);
            }
        }
        
        return Err(AppError::BadRequest("Donn?es non conformes au sch?ma".to_string()));
    }
    
    info!("[valider_service_json] Sch?ma JSON valid? avec succ?s");
    Ok(data_obj)
}











/// ? Crée un service et active l'utilisateur en tant que provider, avec validation et caching
pub async fn creer_service(
    pool: &PgPool,
    user_id: i32,
    data: &serde_json::Value,
    _redis_client: &redis::Client, // Ajout de Redis pour le caching (désactivé)
) -> Result<(serde_json::Value, u32), AppError> {
    // Initialiser le tracking des tokens
    let mut token_tracker = ServiceCreationTokens::new();
    
    // ?? Déballage automatique du champ 'data' à la racine pour compatibilité nouvelle structure IA
    let mut data_processed = data.clone();
    crate::services::orchestration_ia::deballer_champ_data_a_racine(&mut data_processed);
    log::info!("[creer_service] Données après déballage: {}", data_processed);
    
    // ?? Extraction des tokens consommés par l'IA depuis les données
    // Chercher d'abord tokens_ia_externe (nouveau format), puis tokens_consumed (ancien format)
    let ia_tokens_consumed = data_processed.get("tokens_ia_externe")
        .and_then(|v| v.as_u64())
        .or_else(|| data_processed.get("tokens_consumed").and_then(|v| v.as_u64()))
        .unwrap_or(0) as i64;
    
    // ✅ CRITIQUE 2025-11-02 : VALIDER D'ABORD AVANT DE DÉBITER (éviter perte argent)
    let mut data_obj = valider_service_json(&data_processed)?;
    log::info!("[creer_service] ✅ Validation JSON réussie AVANT débit");
    
    // ✅ NOUVEAU 2025-11-01 : Déterminer si c'est le premier produit ou un produit dupliqué
    // Si tokens_ia_externe > 0 : c'est le premier produit (analysé par IA)
    // Si tokens_ia_externe = 0 : c'est un produit dupliqué (pas d'analyse IA)
    let is_first_product = ia_tokens_consumed > 0;
    
    // ✅ NOUVEAU 2025-11-01 : Calculer le coût réel avec le système configurable
    let cout_reel_xaf = service_costs::calculate_service_creation_cost(ia_tokens_consumed, is_first_product);
    
    log::info!("[creer_service] 💰 Coût calculé: {} FCFA (tokens IA: {}, premier produit: {})", 
        cout_reel_xaf, ia_tokens_consumed, is_first_product);
    
    // ✅ NOUVEAU 2025-11-01 : Vérifier et débiter le solde APRÈS validation
    let current_balance_result = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await;
    
    let current_balance = match current_balance_result {
        Ok(row) => row.try_get::<i64, _>("tokens_balance").unwrap_or(0),
        Err(e) => {
            log::error!("[creer_service] ❌ Impossible de récupérer le solde utilisateur {}: {}", user_id, e);
            return Err(AppError::Internal(format!("Erreur récupération solde: {}", e)));
        }
    };
    
    // Vérifier solde suffisant
    if current_balance < cout_reel_xaf {
        log::error!("[creer_service] ❌ Solde insuffisant pour user {}: {} FCFA < {} FCFA requis", 
            user_id, current_balance, cout_reel_xaf);
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant: {} FCFA disponible, {} FCFA requis",
            current_balance, cout_reel_xaf
        )));
    }
    
    // ✅ Débiter le solde
    let debit_result = sqlx::query(
        "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 RETURNING tokens_balance"
    )
    .bind(cout_reel_xaf)
    .bind(user_id)
    .fetch_one(pool)
    .await;
    
    let new_balance = match debit_result {
        Ok(row) => row.try_get::<i64, _>("tokens_balance").unwrap_or(0),
        Err(e) => {
            log::error!("[creer_service] ❌ Échec débit solde pour user {}: {}", user_id, e);
            return Err(AppError::Internal(format!("Erreur débit solde: {}", e)));
        }
    };
    
    log::info!("[creer_service] ✅ Solde débité : {} FCFA (ancien: {}, nouveau: {})", 
        cout_reel_xaf, current_balance, new_balance);
    
    // Ajouter les tokens au tracker pour cohérence (même si déjà débités)
    if ia_tokens_consumed > 0 {
        token_tracker.add_enrichment(ia_tokens_consumed);
        log::info!("[creer_service] Tokens IA externe extraits depuis les données: {}", ia_tokens_consumed);
    } else {
        // Token tracking pour stats (pas pour facturation, déjà facturé ci-dessus)
        let min_cost_tokens = cout_reel_xaf / 10; // Conversion approximative pour stats
        token_tracker.add_enrichment(min_cost_tokens);
        log::info!("[creer_service] ✅ Tokens équivalents pour stats: {} (coût fixe: {} FCFA)", 
            min_cost_tokens, cout_reel_xaf);
    }
    // Ajouter tokens de validation
    token_tracker.add_validation(2);
    
    // ✅ NOUVEAU: Limiter la taille du JSON pour éviter l'erreur d'index PostgreSQL
    // Supprimer les images base64 du champ produits avant insertion (elles sont déjà dans media)
    if let Some(produits) = data_obj.get_mut("produits") {
        if let Some(produits_obj) = produits.as_object_mut() {
            if let Some(valeur) = produits_obj.get_mut("valeur") {
                if let Some(produits_array) = valeur.as_array_mut() {
                    for produit in produits_array.iter_mut() {
                        if let Some(produit_obj) = produit.as_object_mut() {
                            // Supprimer les champs volumineux (images base64, vidéos, etc.)
                            produit_obj.remove("images_base64");
                            produit_obj.remove("image_base64");
                            produit_obj.remove("video_base64");
                            produit_obj.remove("audio_base64");
                            produit_obj.remove("doc_base64");
                            produit_obj.remove("excel_base64");
                            
                            // Limiter la taille des descriptions trop longues (max 5000 caractères)
                            if let Some(description) = produit_obj.get_mut("description") {
                                if let Some(desc_str) = description.as_str() {
                                    let desc_len = desc_str.len();
                                    if desc_len > 5000 {
                                        *description = serde_json::Value::String(desc_str.chars().take(5000).collect::<String>() + "...");
                                        log::warn!("[creer_service] Description produit tronquée (trop longue: {} chars)", desc_len);
                                    }
                                }
                            }
                        }
                    }
                    log::info!("[creer_service] ✅ Nettoyage des données volumineuses dans produits (images base64 supprimées)");
                }
            }
        }
    }
    
    log::info!("[creer_service] Token tracker après ajout validation: {:?}", token_tracker);

    // Enrichissement multimodal : remplacement des références par les vraies données (optimisé)
    let _data_obj = data_obj.clone();
    let enriched_data = tokio::task::spawn_blocking(move || {
        let enriched = _data_obj;
        // enrichir_multimodalites(&mut enriched, "data/uploads"); // This line was commented out
        enriched
    }).await.unwrap_or_else(|e| {
        log::error!("[creer_service] Erreur enrichissement multimodal: {:?}", e);
        data_obj.clone()
    });
    data_obj = enriched_data;

    // Extraction du titre selon la structure (ancienne ou nouvelle)
    let titre = if let Some(titre_obj) = data_obj.get("titre") {
        titre_obj.as_object().and_then(|obj| obj.get("valeur")).and_then(|v| v.as_str()).map(|s| s.to_string())
    } else if let Some(titre_service_obj) = data_obj.get("titre_service") {
        titre_service_obj.as_object().and_then(|obj| obj.get("valeur")).and_then(|v| v.as_str()).map(|s| s.to_string())
    } else {
        None
    };
    
    // Extraction de la description (optionnelle dans la nouvelle structure)
    let description = if let Some(desc_obj) = data_obj.get("description") {
        desc_obj.as_object().and_then(|obj| obj.get("valeur")).and_then(|v| v.as_str()).map(|s| s.to_string())
    } else {
        None
    };
    let is_tarissable = data_obj.get("is_tarissable").and_then(|v| v.as_bool()).unwrap_or(false);
    let gps = data_obj.get("gps").and_then(|v| v.as_bool());
    // Correction?: la colonne gps est TEXT en base, il faut passer "true"/"false" (string)
    let gps_str = gps.map(|b| if b { "true" } else { "false" }).unwrap_or("false");
    // Correction?: forcer la valeur de gps dans data_obj à être une string (pour cohérence JSON stocké)
    if let Some(gps_val) = data_obj.get_mut("gps") {
        *gps_val = serde_json::Value::String(gps_str.to_string());
    }
    let active_days = if is_tarissable {
        data_obj.get("active_days").and_then(|d| d.as_i64()).unwrap_or(7).min(30)
    } else {
        data_obj.get("active_days").and_then(|d| d.as_i64()).unwrap_or(7)
    };
    let auto_deactivate_at = chrono::Utc::now() + chrono::Duration::days(active_days);

    let _cache_key = format!("creation_service:{}:{}:{}", user_id, titre.as_deref().unwrap_or(""), description.as_deref().unwrap_or(""));

    // let mut redis_con = redis_client.get_multiplexed_async_connection().await.map_err(|e| {
    //     AppError::Internal(format!("Erreur de connexion Redis : {}", e))
    // })?;

    // // Vérifier si un service similaire existe déjà dans le cache
    // if let Ok(cached_result) = redis_con.get::<_, String>(&cache_key).await {
    //     return Ok(serde_json::from_str(&cached_result)?);
    // }

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Échec début transaction: {}", e)))?;

    // Ajout des champs dans la transaction SQL
    // Étape 1 : INSERT dans services et récupérer l'id
    let row = sqlx::query(
        r#"
        INSERT INTO services (user_id, data, is_tarissable, gps, auto_deactivate_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id AS service_id
        "#
    )
    .bind(user_id)
    .bind(&data_obj)
    .bind(is_tarissable)
    .bind(gps_str)
    .bind(auto_deactivate_at)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        log::error!("[creer_service] Erreur SQL lors de l'insertion: {} | user_id={} | data_obj={:?}", e, user_id, data_obj);
        AppError::Internal(format!("Échec insertion service: {}", e))
    })?;

    let service_id: i32 = row
        .try_get("service_id")
        .map_err(|e| AppError::Internal(format!("Échec lecture service_id: {}", e)))?;

    // Étape 2 : UPDATE users pour activer le provider (pas bloquant si déjà TRUE)
    let _ = sqlx::query(
        r#"
        UPDATE users
           SET is_provider = TRUE
         WHERE id = $1 AND is_provider = FALSE
        "#
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await;

    // ✅ NOUVEAU : Sauvegarder tous les types de fichiers dans la table media
    let mut files_saved = 0;
    
    // ✅ AMÉLIORATION : Sauvegarder les images PAR PRODUIT (avec product_index)
    // ✅ PHASE 10: Extraire d'abord les images du service pour les ajouter au premier produit
    let service_images: Vec<String> = data_processed.get("base64_image")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    
    // D'abord, extraire les produits du data_obj
    if let Some(produits_array) = data_obj.get_mut("produits").and_then(|v| v.as_array_mut()) {
        log::info!("[creer_service] 📦 Sauvegarde médias pour {} produits", produits_array.len());
        
        #[cfg(feature = "image_search")]
        let image_service = crate::services::image_search_service::ImageSearchService::new(pool.clone());
        
        // ✅ CORRECTION: Collecter les chemins des images sauvegardées pour mettre à jour le JSON
        let mut saved_image_paths_by_product: Vec<Vec<String>> = vec![];
        
        for (product_index, produit) in produits_array.iter().enumerate() {
            let product_id = produit.get("id")
                .and_then(|v| v.as_str())
                .unwrap_or(&format!("prod_{}", product_index))
                .to_string();
            
            log::info!("[creer_service] 📦 Produit {} (index {}): {}", 
                product_id, product_index, 
                produit.get("nom").and_then(|v| v.as_str()).unwrap_or("Sans nom"));
            
            // ✅ PHASE 10: Si c'est le premier produit et qu'il y a des images du service, les ajouter en premier
            let mut images_to_process: Vec<String> = vec![];
            if product_index == 0 && !service_images.is_empty() {
                log::info!("[creer_service] 🖼️ PHASE 10: Ajout de {} image(s) du service comme première(s) image(s) du premier produit", service_images.len());
                images_to_process.extend(service_images.clone());
            }
            
            // ✅ Images du produit spécifique
            if let Some(product_images) = produit.get("images").and_then(|v| v.as_array()) {
                let product_image_strings: Vec<String> = product_images
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect();
                images_to_process.extend(product_image_strings);
            }
            
            // ✅ CORRECTION: Collecter les chemins des images sauvegardées pour ce produit
            let mut saved_paths_for_product: Vec<String> = vec![];
            
            // Traiter toutes les images (service + produit)
            if !images_to_process.is_empty() {
                for (image_index, img_url) in images_to_process.iter().enumerate() {
                    let image_path = img_url.as_str();
                    if !image_path.is_empty() {
                        // ✅ PHASE 10: La première image (image du service si présente) est toujours principale
                        let is_main = image_index == 0;
                        
                        log::info!("[creer_service] 🖼️ Image {} de produit {} (main: {}): {}", 
                            image_index, product_index, is_main, &image_path[..image_path.len().min(50)]);
                        
                        // Décoder si c'est du base64, sinon utiliser l'URL directement
                        let (file_path, _image_bytes) = if image_path.starts_with("http") {
                            // URL Cloudinary déjà uploadée
                            (image_path.to_string(), vec![])
                        } else {
                            // Base64 à décoder
                            let path = format!("image_{}_{}.jpg", service_id, uuid::Uuid::new_v4());
                            let bytes = match STANDARD.decode(image_path.as_bytes()) {
                                Ok(b) => b,
                                Err(e) => {
                                    log::error!("[creer_service] Erreur décodage image: {}", e);
                                    continue;
                                }
                            };
                            (path, bytes)
                        };
                        
                        // Générer signature si feature activée et si c'est du base64
                        #[cfg(feature = "image_search")]
                        let (image_signature, image_hash, image_metadata) = if !_image_bytes.is_empty() {
                            match image_service.generate_image_signature(&_image_bytes).await {
                                Ok(signature) => {
                                    let metadata = image_service.extract_image_metadata(&_image_bytes).await
                                        .unwrap_or_else(|_| crate::services::image_search_service::ImageMetadata {
                                            width: 0, height: 0, format: "jpeg".to_string(),
                                            file_size: _image_bytes.len(), dominant_colors: vec![],
                                            color_histogram: vec![], edge_density: 0.0,
                                            brightness: 0.0, contrast: 0.0,
                                        });
                                    let hash = format!("{:x}", md5::compute(&_image_bytes));
                                    (serde_json::to_value(&signature).unwrap_or_default(), 
                                     hash, 
                                     serde_json::to_value(&metadata).unwrap_or_default())
                                },
                                Err(e) => {
                                    log::warn!("[creer_service] Erreur signature: {}", e);
                                    (serde_json::Value::Null, String::new(), serde_json::Value::Null)
                                }
                            }
                        } else {
                            (serde_json::Value::Null, String::new(), serde_json::Value::Null)
                        };
                        
                        #[cfg(not(feature = "image_search"))]
                        let (image_signature, image_hash, image_metadata) = (serde_json::Value::Null, String::new(), serde_json::Value::Null);
                        
                        // ✅ NOUVEAU : Insérer avec product_index, product_id, is_main_image, display_order
                        if let Err(e) = sqlx::query(
                            r#"
                            INSERT INTO media (
                                service_id, product_id, product_index, type, path, 
                                is_main_image, display_order, uploaded_at, 
                                image_signature, image_hash, image_metadata
                            ) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                            "#
                        )
                        .bind(service_id)
                        .bind(&product_id) // ✅ NOUVEAU
                        .bind(product_index as i32) // ✅ NOUVEAU
                        .bind("image")
                        .bind(&file_path)
                        .bind(is_main) // ✅ NOUVEAU
                        .bind(image_index as i32) // ✅ NOUVEAU (display_order)
                        .bind(Utc::now().naive_utc())
                        .bind(image_signature)
                        .bind(image_hash)
                        .bind(image_metadata)
                        .execute(&mut *tx)
                        .await {
                            log::error!("[creer_service] Erreur insertion media: {}", e);
                            continue;
                        }
                        
                        // ✅ CORRECTION RECHERCHE IMAGE: Cataloguer automatiquement l'image avec les données du produit
                        // Extraire les données du produit pour remplir media.ai_* et cataloguer dans image_analyses
                        let product_name = produit.get("nom").and_then(|v| v.as_str()).unwrap_or("");
                        let product_description = produit.get("description").and_then(|v| v.as_str()).unwrap_or("");
                        let product_marque = produit.get("marque").and_then(|v| v.as_str());
                        let product_category = produit.get("categorie").or_else(|| produit.get("category")).and_then(|v| v.as_str());
                        let product_couleurs: Vec<String> = produit.get("couleurs")
                            .and_then(|v| v.as_array())
                            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                            .unwrap_or_default();
                        
                        // Construire une description IA complète à partir des données du produit
                        let ai_description = if !product_description.is_empty() {
                            product_description.to_string()
                        } else if !product_name.is_empty() {
                            format!("{} - {}", product_name, 
                                produit.get("prix").and_then(|v| v.as_str()).unwrap_or(""))
                        } else {
                            String::new()
                        };
                        
                        // Construire les tags IA à partir des données du produit
                        let mut ai_tags: Vec<String> = vec![];
                        if !product_name.is_empty() {
                            ai_tags.push(product_name.to_string());
                        }
                        if let Some(marque) = product_marque {
                            ai_tags.push(marque.to_string());
                        }
                        ai_tags.extend(product_couleurs.clone());
                        if let Some(cat) = product_category {
                            ai_tags.push(cat.to_string());
                        }
                        
                        // Construire les métadonnées IA
                        let mut ai_metadata = serde_json::json!({});
                        if let Some(marque) = product_marque {
                            ai_metadata["marque"] = serde_json::json!(marque);
                        }
                        if !product_couleurs.is_empty() {
                            ai_metadata["couleurs"] = serde_json::json!(product_couleurs);
                        }
                        if let Some(prix) = produit.get("prix").and_then(|v| v.as_str()) {
                            ai_metadata["prix"] = serde_json::json!(prix);
                        }
                        
                        // ✅ Mettre à jour media.ai_* avec les données du produit
                        if !ai_description.is_empty() || !ai_tags.is_empty() {
                            if let Err(e) = sqlx::query(
                                r#"
                                UPDATE media 
                                SET ai_description = $1,
                                    ai_tags = $2,
                                    ai_category = $3,
                                    ai_metadata = $4,
                                    ai_analyzed_at = $5,
                                    ai_confidence = 0.95
                                WHERE service_id = $6 AND path = $7
                                "#
                            )
                            .bind(if ai_description.is_empty() { None::<String> } else { Some(ai_description.clone()) })
                            .bind(if ai_tags.is_empty() { None::<Vec<String>> } else { Some(ai_tags.clone()) })
                            .bind(product_category)
                            .bind(if ai_metadata.is_null() { None::<serde_json::Value> } else { Some(ai_metadata.clone()) })
                            .bind(Utc::now().naive_utc())
                            .bind(service_id)
                            .bind(&file_path)
                            .execute(&mut *tx)
                            .await {
                                log::warn!("[creer_service] ⚠️ Erreur mise à jour media.ai_*: {}", e);
                            } else {
                                log::info!("[creer_service] ✅ Image cataloguée avec données produit ({} tags)", ai_tags.len());
                            }
                        }
                        
                        files_saved += 1;
                        // ✅ CORRECTION: Ajouter le chemin à la liste des chemins sauvegardés pour ce produit
                        saved_paths_for_product.push(file_path.clone());
                        log::info!("[creer_service] ✅ Image {}/{} du produit {} sauvegardée (main: {})", 
                            image_index + 1, images_to_process.len(), product_index, is_main);
                    }
                }
            }
            
            // ✅ CORRECTION: Stocker les chemins sauvegardés pour ce produit
            saved_image_paths_by_product.push(saved_paths_for_product);
            
            // ✅ Vidéos du produit spécifique
            if let Some(product_videos) = produit.get("videos").and_then(|v| v.as_array()) {
                for (video_index, vid_url) in product_videos.iter().enumerate() {
                    if let Some(video_path) = vid_url.as_str() {
                        let file_path = if video_path.starts_with("http") {
                            video_path.to_string()
                        } else {
                            format!("video_{}_{}.mp4", service_id, uuid::Uuid::new_v4())
                        };
                        
                        if let Err(e) = sqlx::query(
                            r#"
                            INSERT INTO media (
                                service_id, product_id, product_index, type, path, 
                                is_main_image, display_order, uploaded_at
                            ) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                            "#
                        )
                        .bind(service_id)
                        .bind(&product_id)
                        .bind(product_index as i32)
                        .bind("video")
                        .bind(&file_path)
                        .bind(video_index == 0) // Première vidéo = principale
                        .bind(video_index as i32)
                        .bind(Utc::now().naive_utc())
                        .execute(&mut *tx)
                        .await {
                            log::error!("[creer_service] Erreur insertion media video: {}", e);
                            continue;
                        }
                        
                        files_saved += 1;
                        log::info!("[creer_service] ✅ Vidéo {}/{} du produit {} sauvegardée", 
                            video_index + 1, product_videos.len(), product_index);
                    }
                }
            }
        }
        
        // ✅ CORRECTION: Mettre à jour le champ images du premier produit avec les chemins sauvegardés
        // Les images du service doivent être en premier
        if let Some(first_product) = produits_array.get_mut(0) {
            if let Some(first_product_obj) = first_product.as_object_mut() {
                if !saved_image_paths_by_product.is_empty() && !saved_image_paths_by_product[0].is_empty() {
                    let image_paths_json: Vec<serde_json::Value> = saved_image_paths_by_product[0]
                        .iter()
                        .map(|path| serde_json::Value::String(path.clone()))
                        .collect();
                    
                    first_product_obj.insert("images".to_string(), serde_json::Value::Array(image_paths_json));
                    
                    log::info!("[creer_service] ✅ CORRECTION: Champ 'images' du premier produit mis à jour avec {} chemin(s), images du service en premier", 
                        saved_image_paths_by_product[0].len());
                }
            }
        }
    }
    
    // ✅ FALLBACK : Si pas de produits, sauvegarder les images globales du service
    // ✅ PHASE 10: Ne sauvegarder les images globales que si elles n'ont pas déjà été ajoutées au premier produit
    if let Some(images) = data_processed.get("base64_image").and_then(|v| v.as_array()) {
        let has_products = data_obj.get("produits").and_then(|v| v.as_array()).map(|arr| !arr.is_empty()).unwrap_or(false);
        // Vérifier qu'on n'a pas déjà sauvegardé des images de produits ET que les images du service n'ont pas été utilisées
        if files_saved == 0 || (!has_products && service_images.is_empty()) {
            let image_strings: Vec<String> = images
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
            
            if !image_strings.is_empty() {
                log::info!("[creer_service] 🖼️ Sauvegarde de {} images GLOBALES du service {}", image_strings.len(), service_id);
                
                #[cfg(feature = "image_search")]
                let image_service = crate::services::image_search_service::ImageSearchService::new(pool.clone());
                
                for (i, _image_data) in image_strings.iter().enumerate() {
                    let file_path = format!("image_{}_{}.jpg", service_id, uuid::Uuid::new_v4());
                    
                    #[cfg(feature = "image_search")]
                    let image_bytes = match STANDARD.decode(_image_data.as_bytes()) {
                        Ok(bytes) => bytes,
                        Err(e) => {
                            log::error!("[creer_service] Erreur décodage base64 image {}: {}", i, e);
                            continue;
                        }
                    };
                    
                    #[cfg(feature = "image_search")]
                    let (image_signature, image_hash, image_metadata) = {
                        match image_service.generate_image_signature(&image_bytes).await {
                            Ok(signature) => {
                                let metadata = image_service.extract_image_metadata(&image_bytes).await
                                    .unwrap_or_else(|_| crate::services::image_search_service::ImageMetadata {
                                        width: 0, height: 0, format: "jpeg".to_string(),
                                        file_size: image_bytes.len(), dominant_colors: vec![],
                                        color_histogram: vec![], edge_density: 0.0,
                                        brightness: 0.0, contrast: 0.0,
                                    });
                                let hash = format!("{:x}", md5::compute(&image_bytes));
                                (serde_json::to_value(&signature).unwrap_or_default(), hash, serde_json::to_value(&metadata).unwrap_or_default())
                            }
                            Err(e) => {
                                log::warn!("[creer_service] Erreur signature image {}: {}", i, e);
                                (serde_json::Value::Null, String::new(), serde_json::Value::Null)
                            }
                        }
                    };
                    
                    #[cfg(not(feature = "image_search"))]
                    let (image_signature, image_hash, image_metadata) = (serde_json::Value::Null, String::new(), serde_json::Value::Null);
                    
                    // Insérer sans product_index (image globale du service)
                    if let Err(e) = sqlx::query(
                        r#"
                        INSERT INTO media (service_id, type, path, uploaded_at, image_signature, image_hash, image_metadata) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        "#
                    )
                    .bind(service_id)
                    .bind("image")
                    .bind(file_path)
                    .bind(Utc::now().naive_utc())
                    .bind(image_signature)
                    .bind(image_hash)
                    .bind(image_metadata)
                    .execute(&mut *tx)
                    .await {
                        log::error!("[creer_service] Erreur insertion media image globale: {}", e);
                        continue;
                    }
                    files_saved += 1;
                    log::info!("[creer_service] Image globale {} du service {} sauvegardée", i + 1, service_id);
                }
            }
        } else {
            log::info!("[creer_service] ⏭️ Images déjà sauvegardées par produit, skip images globales");
        }
    }
    
    // Audios
    if let Some(audios) = data_processed.get("audio_base64").and_then(|v| v.as_array()) {
        let audio_strings: Vec<String> = audios
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();
        
        if !audio_strings.is_empty() {
            log::info!("[creer_service] Sauvegarde de {} audios pour le service {}", audio_strings.len(), service_id);
            
            // Sauvegarder les audios directement dans la transaction
            for _audio_data in &audio_strings {
                let file_path = format!("audio_{}_{}.mp3", service_id, uuid::Uuid::new_v4());
                
                if let Err(e) = sqlx::query(
                    "INSERT INTO media (service_id, type, path, uploaded_at) VALUES ($1, $2, $3, $4)"
                )
                .bind(service_id)
                .bind("audio")
                .bind(file_path)
                .bind(Utc::now().naive_utc())
                .execute(&mut *tx)
                .await {
                    log::error!("[creer_service] Erreur insertion media audio: {}", e);
                    continue;
                }
                files_saved += 1;
            }
        }
    }
    
    // Vidéos
    if let Some(videos) = data_processed.get("video_base64").and_then(|v| v.as_array()) {
        let video_strings: Vec<String> = videos
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();
        
        if !video_strings.is_empty() {
            log::info!("[creer_service] Sauvegarde de {} vidéos pour le service {}", video_strings.len(), service_id);
            
            // Sauvegarder les vidéos directement dans la transaction
            for _video_data in &video_strings {
                let file_path = format!("video_{}_{}.mp4", service_id, uuid::Uuid::new_v4());
                
                if let Err(e) = sqlx::query(
                    "INSERT INTO media (service_id, type, path, uploaded_at) VALUES ($1, $2, $3, $4)"
                )
                .bind(service_id)
                .bind("video")
                .bind(file_path)
                .bind(Utc::now().naive_utc())
                .execute(&mut *tx)
                .await {
                    log::error!("[creer_service] Erreur insertion media video: {}", e);
                    continue;
                }
                files_saved += 1;
            }
        }
    }
    
    // Documents
    if let Some(docs) = data_processed.get("doc_base64").and_then(|v| v.as_array()) {
        let doc_strings: Vec<String> = docs
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();
        
        if !doc_strings.is_empty() {
            log::info!("[creer_service] Sauvegarde de {} documents pour le service {}", doc_strings.len(), service_id);
            
            // Sauvegarder les documents directement dans la transaction
            for _doc_data in &doc_strings {
                let file_path = format!("document_{}_{}.pdf", service_id, uuid::Uuid::new_v4());
                
                if let Err(e) = sqlx::query(
                    "INSERT INTO media (service_id, type, path, uploaded_at) VALUES ($1, $2, $3, $4)"
                )
                .bind(service_id)
                .bind("document")
                .bind(file_path)
                .bind(Utc::now().naive_utc())
                .execute(&mut *tx)
                .await {
                    log::error!("[creer_service] Erreur insertion media document: {}", e);
                    continue;
                }
                files_saved += 1;
            }
        }
    }
    
    // Excel
    if let Some(excels) = data_processed.get("excel_base64").and_then(|v| v.as_array()) {
        let excel_strings: Vec<String> = excels
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();
        
        if !excel_strings.is_empty() {
            log::info!("[creer_service] Sauvegarde de {} fichiers excel pour le service {}", excel_strings.len(), service_id);
            
            // Sauvegarder les fichiers excel directement dans la transaction
            for _excel_data in &excel_strings {
                let file_path = format!("excel_{}_{}.xlsx", service_id, uuid::Uuid::new_v4());
                
                if let Err(e) = sqlx::query(
                    "INSERT INTO media (service_id, type, path, uploaded_at) VALUES ($1, $2, $3, $4)"
                )
                .bind(service_id)
                .bind("excel")
                .bind(file_path)
                .bind(Utc::now().naive_utc())
                .execute(&mut *tx)
                .await {
                    log::error!("[creer_service] Erreur insertion media excel: {}", e);
                    continue;
                }
                files_saved += 1;
            }
        }
    }
    
    if files_saved > 0 {
        log::info!("[creer_service] Total de {} fichiers sauvegardés pour le service {}", files_saved, service_id);
    }

    // Initialisation du client d'embedding pour Pinecone
    log::info!("[EMBEDDING_DEBUG] ?? Initialisation du client d'embedding...");
    let embedding_client = crate::utils::embedding_client::EmbeddingClient::new("", "");
    log::info!("[EMBEDDING_DEBUG] ? Client d'embedding initialisé");
    // Calcul GPS optimal (service ou fallback prestataire)
    let (_gps_lat, _gps_lon) = {
        // 1. Nouveau format : gps avec lat/lon directement
        if let Some(gps_obj) = data_obj.get("gps").and_then(|v| v.as_object()) {
            if let (Some(lat), Some(lon)) = (
                gps_obj.get("lat").and_then(|v| v.as_f64()),
                gps_obj.get("lon").and_then(|v| v.as_f64())
            ) {
                (Some(lat), Some(lon))
            } else {
                // 2. Si gps=true, on attend gps_coords (string lat,lon)
                let gps_bool = data_obj.get("gps").and_then(|v| v.as_bool()).unwrap_or(false);
                if gps_bool {
                    if let Some(gps_coords) = data_obj.get("gps_coords").and_then(|v| v.as_str()) {
                        let parts: Vec<&str> = gps_coords.split(',').map(|s| s.trim()).collect();
                        if parts.len() == 2 {
                            let lat = parts[0].parse::<f64>();
                            let lon = parts[1].parse::<f64>();
                            match (lat, lon) {
                                (Ok(lat), Ok(lon)) => (Some(lat), Some(lon)),
                                _ => (None, None)
                            }
                        } else {
                            (None, None)
                        }
                    } else {
                        (None, None)
                    }
                } else if let Some(gps_str) = data_obj.get("gps").and_then(|v| v.as_str()) {
                    // 3. Fallback : gps (string lat,lon)
                    let parts: Vec<&str> = gps_str.split(',').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        let lat = parts[0].parse::<f64>();
                        let lon = parts[1].parse::<f64>();
                        match (lat, lon) {
                            (Ok(lat), Ok(lon)) => (Some(lat), Some(lon)),
                            _ => (None, None)
                        }
                    } else {
                        (None, None)
                    }
                } else {
                    // 4. Fallback : GPS du prestataire
                    match get_user_gps(pool, user_id).await {
                        Ok((lon, lat)) => (Some(lat), Some(lon)),
                        Err(_) => (None, None)
                    }
                }
            }
        } else {
            // 2. Si gps=true, on attend gps_coords (string lat,lon)
            let gps_bool = data_obj.get("gps").and_then(|v| v.as_bool()).unwrap_or(false);
            if gps_bool {
                if let Some(gps_coords) = data_obj.get("gps_coords").and_then(|v| v.as_str()) {
                    let parts: Vec<&str> = gps_coords.split(',').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        let lat = parts[0].parse::<f64>();
                        let lon = parts[1].parse::<f64>();
                        match (lat, lon) {
                            (Ok(lat), Ok(lon)) => (Some(lat), Some(lon)),
                            _ => (None, None)
                        }
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                }
            } else if let Some(gps_str) = data_obj.get("gps").and_then(|v| v.as_str()) {
                // 3. Fallback : gps (string lat,lon)
                let parts: Vec<&str> = gps_str.split(',').map(|s| s.trim()).collect();
                if parts.len() == 2 {
                    let lat = parts[0].parse::<f64>();
                    let lon = parts[1].parse::<f64>();
                    match (lat, lon) {
                        (Ok(lat), Ok(lon)) => (Some(lat), Some(lon)),
                        _ => (None, None)
                    }
                } else {
                    (None, None)
                }
            } else {
                // 4. Fallback : GPS du prestataire
                match get_user_gps(pool, user_id).await {
                    Ok((lon, lat)) => (Some(lat), Some(lon)),
                    Err(_) => (None, None)
                }
            }
        }
    };
    // Utilisation directe de gps_lat et gps_lon dans la boucle, plus besoin de gps_lat_fallback/gps_lon_fallback
    // Génération et insertion des embeddings pour chaque champ du service
    let mut embedding_tasks = Vec::new();

    // Préparation des données d'embedding en parallèle
    let map = if let Some(obj) = data_obj.as_object() {
        obj.clone() // Clonage de la map pour qu'elle vive assez longtemps
    } else {
        serde_json::Map::new()
    };

    log::info!("[EMBEDDING_DEBUG] ?? Données ? traiter pour embedding: {:?}", map.keys().collect::<Vec<_>>());

    for (k, valeur) in map {
        // Ne jamais vectoriser le champ 'intention'
        if k == "intention" {
            log::info!("[EMBEDDING_DEBUG] ??  Champ 'intention' ignoré");
            continue;
        }
        let type_donnee_raw = if let Some(obj) = valeur.as_object() {
            obj.get("type_donnee").and_then(|v| v.as_str()).unwrap_or("texte")
        } else {
            "texte"
        };
        let type_donnee = map_type_for_pinecone(type_donnee_raw);
        let value_str = if let Some(obj) = valeur.as_object() {
            obj.get("valeur").map(|v| v.to_string()).unwrap_or_else(|| valeur.to_string())
        } else {
            valeur.to_string()
        };
        log::info!("[PINECONE][SERVICE] Préparation embedding: champ='{}', type_donnee='{}', extrait='{}', service_id={}", k, type_donnee, &value_str.chars().take(80).collect::<String>(), service_id);
        
        // Créer une tâche asynchrone pour chaque embedding
        let embedding_task = {
            let embedding_client = embedding_client.clone();
            let k = k.clone();
            let value_str = value_str.clone();
            let type_donnee = type_donnee.to_string();
            let service_id = service_id;
            let mut token_tracker = token_tracker.clone();
            let valeur = valeur.clone();
            
            tokio::spawn(async move {
                let mut value_for_embedding = value_str.clone();
                let mut meta_lang: Option<String> = None;
                let mut meta_unite: Option<String> = None;
                let mut meta_devise: Option<String> = None;
                
                let _lang = if type_donnee == "texte" {
                    let detected = detect_lang(&value_str);
                    meta_lang = Some(detected.clone());
                    value_for_embedding = translate_to_en(&value_str, &detected).await;
                    // Tracker la traduction
                    token_tracker.add_translation(value_str.len());
                    detected
                } else {
                    "und".to_string()
                };
                
                // Extraction unit?/devise pour numériques
                if ["int", "float", "nombre", "prix", "montant"].contains(&type_donnee.as_str()) {
                    if let Some(obj) = valeur.as_object() {
                        if let Some(u) = obj.get("unite").and_then(|v| v.as_str()) {
                            meta_unite = Some(u.to_string());
                        }
                        if let Some(d) = obj.get("devise").and_then(|v| v.as_str()) {
                            meta_devise = Some(d.to_string());
                        }
                    }
                }
                
                // Utilisation de AddEmbeddingPineconeRequest réactivée
                let embedding_request = AddEmbeddingPineconeRequest {
                    value: value_for_embedding,
                    type_donnee: type_donnee.clone(),
                    service_id,
                    gps_lat: None,
                    gps_lon: None,
                    langue: Some(meta_lang.unwrap_or_else(|| "und".to_string())),
                    active: Some(true),
                    type_metier: Some("service".to_string()),
                    unite: meta_unite,
                    devise: meta_devise,
                };
                
                log::info!("[PINECONE][SERVICE] Appel add_embedding_pinecone ({}): {:?}", type_donnee, embedding_request);
                
                match embedding_client.add_embedding_pinecone(&embedding_request).await {
                    Ok(result) => {
                        log::info!("[PINECONE][SERVICE] Embedding {} ajouté?: champ='{}', service_id={}, retour={:?}", type_donnee, k, service_id, result);
                        Ok(result)
                    }
                    Err(e) => {
                        log::error!("[PINECONE][SERVICE] Erreur embedding {}: champ='{}', service_id={}, erreur={:?}", type_donnee, k, service_id, e);
                        Err(e)
                    }
                }
            })
        };
        
        embedding_tasks.push((k.clone(), embedding_task));
    }

    // Plus besoin de vérifier l'intention

    // ? OPTIMISATION : Réponse immédiate au frontend après création en base
    // Les embeddings continuent en arrière-plan
    let service_creation_result = serde_json::json!({
        "message":        "? Service cr?? avec succ?s",
        "service_id":     service_id,
        "user_id":        user_id,
        "donnees_envoyees": data_obj.clone(),
        "tokens_consumed": token_tracker.total_tokens,
        "token_breakdown": {
            "validation_tokens": token_tracker.validation_tokens,
            "embedding_tokens": token_tracker.embedding_tokens,
            "translation_tokens": token_tracker.translation_tokens,
            "ocr_tokens": token_tracker.ocr_tokens,
            "enrichment_tokens": token_tracker.enrichment_tokens
        },
        "embedding_status": "processing", // Indique que les embeddings sont en cours
        "estimated_embedding_time": "5-10 seconds"
    });
    
    log::info!("[creer_service] Réponse JSON construite avec tokens_consumed: {}", token_tracker.total_tokens);
    log::info!("[creer_service] Réponse complète: {}", serde_json::to_string_pretty(&service_creation_result).unwrap_or_default());

    // Lancer les embeddings en arrière-plan sans bloquer la réponse
    let _background_embedding_task = {
        let embedding_tasks = embedding_tasks;
        let service_id = service_id;
        let _data_obj = data_obj.clone();
        
        tokio::spawn(async move {
            log::info!("[PINECONE][BACKGROUND] ?? Démarrage embeddings en arrière-plan pour service {}", service_id);
            
            // Attendre et traiter tous les résultats d'embedding en parallèle
            let mut _successful_embeddings = 0;
            let mut _failed_embeddings = 0;
            
            // Utiliser join_all pour traiter toutes les tâches en parallèle avec timeout
            let task_futures: Vec<_> = embedding_tasks.into_iter().map(|(field_name, task): (String, tokio::task::JoinHandle<Result<serde_json::Value, reqwest::Error>>)| async move {
                let result = tokio::time::timeout(
                    std::time::Duration::from_secs(60), // Augmenté de 30s à 60s pour les embeddings
                    task
                ).await;
                
                match result {
                    Ok(task_result) => {
                        match task_result {
                            Ok(Ok(_)) => {
                                _successful_embeddings += 1;
                                log::info!("[PINECONE][BACKGROUND] ? Embedding réussi pour champ '{}'", field_name);
                            },
                            Ok(Err(e)) => {
                                _failed_embeddings += 1;
                                log::error!("[PINECONE][BACKGROUND] ? Erreur embedding pour champ '{}': {:?}", field_name, e);
                            },
                            Err(e) => {
                                _failed_embeddings += 1;
                                log::error!("[PINECONE][BACKGROUND] ? Erreur dans la tâche d'embedding pour champ '{}': {:?}", field_name, e);
                            }
                        }
                    },
                    Err(_) => {
                        _failed_embeddings += 1;
                        log::error!("[PINECONE][BACKGROUND] ? Timeout embedding pour champ '{}' (30s)", field_name);
                    }
                }
            }).collect();
            
            // Exécuter toutes les tâches en parallèle
            let start_time = std::time::Instant::now();
            futures::future::join_all(task_futures).await;
            let embedding_duration = start_time.elapsed();
            
            log::info!("[PINECONE][BACKGROUND] ? Embeddings terminés en {:?}: {} succès, {} échecs pour service {}", 
                       embedding_duration, _successful_embeddings, _failed_embeddings, service_id);
            
            // Optionnel : mettre à jour le statut du service une fois les embeddings terminés
            // (peut être implémenté plus tard si nécessaire)
        })
    };

    // Ne pas attendre la fin des embeddings, retourner immédiatement
    log::info!("[CREER_SERVICE] ? Réponse immédiate au frontend, embeddings en arrière-plan");

    // ✅ NOUVEAU : Historiser automatiquement les champs autocomplete avant le commit
    // Cela enrichit l'historique même si l'IA externe a oublié certaines combinaisons
    if let Some(map) = data_obj.as_object() {
        for (_key, value) in map.iter() {
            if let Some(obj) = value.as_object() {
                if let Some(type_donnee) = obj.get("type_donnee").and_then(|v| v.as_str()) {
                    if type_donnee == "autocomplete" {
                        // Extraire les données autocomplete
                        if let (Some(valeur_array), Some(separateur), Some(sous_caracs), Some(identifiant_base)) = (
                            obj.get("valeur").and_then(|v| v.as_array()),
                            obj.get("separateur").and_then(|v| v.as_str()),
                            obj.get("sous_caracteristiques"),
                            obj.get("identifiant_base").and_then(|v| v.as_str())
                        ) {
                            // Convertir valeurs en Vec<String>
                            let valeurs: Vec<String> = valeur_array
                                .iter()
                                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                .collect();
                            
                            // Déterminer origine_champs
                            let origine_champs = obj.get("origine_champs")
                                .and_then(|v| v.as_str())
                                .unwrap_or("ia");
                            
                            // Historiser le champ autocomplete (en arrière-plan, ne bloque pas)
                            let pool_clone = pool.clone();
                            let identifiant_base_clone = identifiant_base.to_string();
                            let separateur_clone = separateur.to_string();
                            let sous_caracs_clone = sous_caracs.clone();
                            let user_id_clone = user_id;
                            let service_id_clone = service_id;
                            let origine_champs_clone = origine_champs.to_string();
                            
                            tokio::spawn(async move {
                                match crate::services::autocomplete_history_service::historize_autocomplete_field(
                                    &pool_clone,
                                    &identifiant_base_clone,
                                    &valeurs,
                                    &separateur_clone,
                                    &sous_caracs_clone,
                                    &origine_champs_clone,
                                    Some(user_id_clone),
                                    Some(service_id_clone),
                                ).await {
                                    Ok(ids) => {
                                        log::info!(
                                            "[CREER_SERVICE] ✅ {} caractéristiques autocomplete historisées pour champ '{}'",
                                            ids.len(),
                                            identifiant_base_clone
                                        );
                                    }
                                    Err(e) => {
                                        log::warn!(
                                            "[CREER_SERVICE] ⚠️ Erreur historisation autocomplete pour '{}': {}",
                                            identifiant_base_clone,
                                            e
                                        );
                                    }
                                }
                            });
                        }
                    }
                }
            }
        }
    }

    // Commit de la transaction AVANT la réponse
    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("?chec commit: {}", e)))?;

    log::info!("[CREER_SERVICE] ? Transaction commitée avec succès - Service ID: {} maintenant visible en base", service_id);
    log::info!("[CREER_SERVICE] Tokens consommés pour utilisateur {}: {:?}", user_id, token_tracker);
    log::info!("[CREER_SERVICE] Total tokens retournés: {} (type: u32)", token_tracker.total_tokens);
    
    // ✅ NOUVEAU 2025-11-04: Sauvegarder d'abord les combinaisons IA (avec vérification doublon)
    if let Some(produits_field) = data_obj.get("produits") {
        let session_id = data_obj.get("session_id")
            .and_then(|v| v.as_str());
        
        if let Err(e) = save_ia_combinations_to_db(pool, produits_field, session_id).await {
            log::warn!("[CREER_SERVICE] Erreur sauvegarde combinaisons IA: {} (non bloquant)", e);
        } else {
            log::info!("[CREER_SERVICE] ✅ Combinaisons IA sauvegardées (doublons évités)");
        }
    }
    
    // ✅ NOUVEAU 2025-11-04: Sauvegarder le VRAI produit choisi par le prestataire
    if let Err(e) = save_autocomplete_combination(pool, service_id, &data_obj).await {
        log::warn!("[CREER_SERVICE] Erreur sauvegarde produit réel: {} (non bloquant)", e);
    } else {
        log::info!("[CREER_SERVICE] ✅ Produit réel sauvegardé (autocomplete_characteristics + autocomplete_combinations)");
    }
    
    // ✅ NOUVEAU: Créer une notification de création de service
    let service_title = data_obj.get("titre_service")
        .or_else(|| data_obj.get("titre"))
        .and_then(|v| {
            if let Some(obj) = v.as_object() {
                obj.get("valeur").and_then(|val| val.as_str())
            } else {
                v.as_str()
            }
        })
        .unwrap_or("Votre service");
    
    let notification_data = serde_json::json!({
        "service_id": service_id,
        "service_title": service_title,
        "tokens_consumed": token_tracker.total_tokens
    });
    
    // Créer la notification (ne pas bloquer si ça échoue)
    if let Err(e) = crate::services::notification_service::create_notification(
        pool,
        user_id,
        crate::services::notification_service::NotificationType::ServiceCreated,
        "🎉 Service créé avec succès !".to_string(),
        format!("Votre service '{}' a été créé et est maintenant visible par tous les utilisateurs.", service_title),
        Some(notification_data),
    ).await {
        log::warn!("[CREER_SERVICE] Impossible de créer la notification: {}", e);
    } else {
        log::info!("[CREER_SERVICE] ✅ Notification de création envoyée");
    }
    
    Ok((service_creation_result, token_tracker.total_tokens as u32))
}

/// Valide un brouillon de service sans insertion en base ni cache
pub async fn brouillon_service(
    data: &serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    let data_obj = valider_service_json(data)?;

    // Pas d'insertion ni de cache, juste retour du JSON valid?
    Ok(data_obj)
}

/// Sauvegarde les combinaisons IA dans autocomplete_combinations (avec vérification doublon)
/// Utilisé lors de la réception du JSON IA pour construire la liste de suggestions
async fn save_ia_combinations_to_db(
    pool: &PgPool,
    produits_field: &serde_json::Value,
    session_id: Option<&str>,
) -> Result<(), AppError> {
    log::info!("[save_ia_combinations_to_db] Début sauvegarde combinaisons IA");
    
    // Extraire les combinaisons depuis produits.valeur
    let valeurs = if let Some(valeur_array) = produits_field.get("valeur").and_then(|v| v.as_array()) {
        valeur_array.iter()
            .filter_map(|v| v.as_str())
            .collect::<Vec<_>>()
    } else {
        log::warn!("[save_ia_combinations_to_db] Pas de valeur array");
        return Ok(());
    };
    
    let separateur = produits_field.get("separateur")
        .and_then(|v| v.as_str())
        .unwrap_or(",");
    
    let ai_preferred_index = produits_field.get("ai_preferred_index")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as usize;
    
    // Traiter chaque combinaison
    for (index, valeur_str) in valeurs.iter().enumerate() {
        let product_vector: Vec<String> = valeur_str
            .split(separateur)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        
        if product_vector.is_empty() {
            continue;
        }
        
        // ✅ VÉRIFICATION DOUBLON : Ne PAS insérer si existe déjà (éviter bruit)
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT product_combination_exists($1)"
        )
        .bind(&product_vector)
        .fetch_one(pool)
        .await
        .unwrap_or(false);
        
        if exists {
            log::info!("[save_ia_combinations_to_db] ⚠️ Combinaison {} existe déjà, ignorée (éviter bruit)", index);
            continue;
        }
        
        // Extraire les labels des sous-caractéristiques (dimensions)
        let product_labels: Vec<String> = if let Some(sous_caracs) = produits_field.get("sous_caracteristiques").and_then(|v| v.as_object()) {
            sous_caracs.keys().map(|k| k.to_string()).collect()
        } else {
            vec![]
        };
        
        // Insérer dans autocomplete_combinations (SANS lieu)
        let is_ai_preferred = index == ai_preferred_index;
        
        let result = sqlx::query(
            r#"INSERT INTO autocomplete_combinations 
               (service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
                session_id, is_ai_preferred, ai_confidence, usage_count)
               VALUES (NULL, $1, $2, '{}', '{}', $1, $3, $4, 0.7, 1)"#
        )
        .bind(&product_vector)
        .bind(&product_labels)
        .bind(session_id)
        .bind(is_ai_preferred)
        .execute(pool).await;
        
        if let Err(e) = result {
            log::error!("[save_ia_combinations_to_db] Erreur sauvegarde combinaison {}: {}", index, e);
        } else {
            log::info!("[save_ia_combinations_to_db] ✅ Combinaison {} sauvegardée (IA)", index);
        }
    }
    
    log::info!("[save_ia_combinations_to_db] Fin sauvegarde combinaisons IA");
    Ok(())
}

/// Sauvegarde les combinaisons autocomplete avec vecteurs produit et localisation
/// LOGIQUE:
/// - autocomplete_combinations : Toutes les combinaisons possibles (IA) pour aider prestataire
/// - autocomplete_characteristics : VRAIS produits validés par prestataires (avec lieu bidirectionnel)
async fn save_autocomplete_combination(
    pool: &PgPool,
    service_id: i32,
    data_obj: &serde_json::Value,
) -> Result<(), AppError> {
    use crate::services::geonames_service::{build_location_vector, extract_country_from_lieu, get_geoname_id};
    
    log::info!("[save_autocomplete_combination] Début sauvegarde pour service {} (VRAIS produits)", service_id);
    
    // 1. Extraire vecteur produit depuis champ produits
    let produits_field = match data_obj.get("produits") {
        Some(p) => p,
        None => {
            log::warn!("[save_autocomplete_combination] Pas de champ produits");
            return Ok(());
        }
    };
    
    // Vecteur produit depuis autocomplete
    let product_vector: Vec<String> = if let Some(valeur_str) = produits_field.get("valeur").and_then(|v| v.as_str()) {
        valeur_str.split(',').map(|s| s.trim().to_string()).collect()
    } else if let Some(valeur_array) = produits_field.get("valeur").and_then(|v| v.as_array()) {
        valeur_array.iter()
            .filter_map(|v| v.as_str())
            .map(|s| s.to_string())
            .collect()
    } else {
        log::warn!("[save_autocomplete_combination] Format valeur produits non reconnu");
        return Ok(());
    };
    
    if product_vector.is_empty() {
        log::warn!("[save_autocomplete_combination] Vecteur produit vide");
        return Ok(());
    }
    
    log::info!("[save_autocomplete_combination] Vecteur produit: {:?}", product_vector);
    
    // 2. Extraire lieu (plusieurs champs possibles)
    let lieu_field = data_obj.get("lieu_produit")
        .or_else(|| data_obj.get("localisation"))
        .or_else(|| data_obj.get("ville"))
        .or_else(|| data_obj.get("lieu"));
    
    let (location_vector, chosen_location, geoname_id) = if let Some(lieu) = lieu_field {
        let lieu_str = lieu.get("valeur")
            .and_then(|v| v.as_str())
            .or_else(|| lieu.as_str())
            .unwrap_or("");
        
        if !lieu_str.is_empty() {
            let country = extract_country_from_lieu(lieu_str);
            
            // Construire vecteur lieu avec GeoNames
            let loc_vector = build_location_vector(pool, lieu_str, country.as_deref())
                .await
                .unwrap_or_else(|e| {
                    log::warn!("[save_autocomplete_combination] Erreur enrichissement lieu '{}': {}", lieu_str, e);
                    vec![lieu_str.to_string()]
                });
            
            let geoname_id_val = get_geoname_id(pool, lieu_str)
                .await
                .unwrap_or(None);
            
            log::info!("[save_autocomplete_combination] Vecteur lieu: {:?}", loc_vector);
            
            (loc_vector, Some(lieu_str.to_string()), geoname_id_val)
        } else {
            (vec![], None, None)
        }
    } else {
        log::warn!("[save_autocomplete_combination] Pas de champ lieu trouvé");
        (vec![], None, None)
    };
    
    // 3. Vecteur complet = produit + location (UNIQUEMENT pour autocomplete_characteristics)
    let mut full_vector = product_vector.clone();
    full_vector.extend(location_vector.clone());
    
    log::info!("[save_autocomplete_combination] Vecteur produit ({}): {:?}", product_vector.len(), product_vector);
    log::info!("[save_autocomplete_combination] Vecteur lieu ({}): {:?}", location_vector.len(), location_vector);
    log::info!("[save_autocomplete_combination] Vecteur complet ({}): {:?}", full_vector.len(), full_vector);
    
    // 4. Extraire les labels des sous-caractéristiques (dimensions)
    let product_labels: Vec<String> = if let Some(sous_caracs) = produits_field.get("sous_caracteristiques").and_then(|v| v.as_object()) {
        sous_caracs.keys().map(|k| k.to_string()).collect()
    } else {
        vec![]
    };
    
    // 5. Générer product_id (format: "serviceId_productIndex")
    let product_id = format!("{}_0", service_id);  // Index 0 pour produit principal
    
    // 5. Gérer variations prix si existe
    let variation_prix = produits_field.get("variation_prix");
    
    if let Some(variation) = variation_prix {
        let variant_dimension = variation.get("variable")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        
        let modalites = variation.get("modalites")
            .and_then(|v| v.as_array());
        
        if let Some(modalites_array) = modalites {
            log::info!("[save_autocomplete_combination] {} variations prix trouvées (dimension: {})", modalites_array.len(), variant_dimension);
            
            for (variant_index, modalite) in modalites_array.iter().enumerate() {
                let variant_value = modalite.get("valeur").and_then(|v| v.as_str()).unwrap_or("");
                let prix = modalite.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let stock = modalite.get("stock").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let devise = modalite.get("devise").and_then(|v| v.as_str()).unwrap_or("XAF");
                
                // Vecteur produit avec variation (sans lieu)
                let mut variant_product_vector = product_vector.clone();
                variant_product_vector.push(variant_value.to_string());
                
                // Vecteur complet (produit + variation + lieu)
                let mut variant_full_vector = variant_product_vector.clone();
                variant_full_vector.extend(location_vector.clone());
                
                let variant_product_id = format!("{}_{}", service_id, variant_index);
                
                // ✅ NOUVEAU: Sauvegarder dans autocomplete_characteristics (VRAI produit prestataire)
                let result_char = sqlx::query(
                    r#"INSERT INTO autocomplete_characteristics 
                       (identifiant_base, service_id, product_id, 
                        characteristic_vector, product_labels, location_vector, full_vector,
                        chosen_location, chosen_location_geoname_id,
                        is_real_product, origine_champs, usage_count,
                        sous_caracteristique, valeur)
                       VALUES ('produits', $1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'formulaire', 1, 'vector', $9)"#
                )
                .bind(service_id)
                .bind(&variant_product_id)
                .bind(&variant_product_vector)
                .bind(&product_labels)  // ✅ AJOUT product_labels
                .bind(&location_vector)
                .bind(&variant_full_vector)
                .bind(chosen_location.as_deref())
                .bind(geoname_id)
                .bind(variant_value)  // Premier élément comme valeur legacy
                .execute(pool).await;
                
                if let Err(e) = result_char {
                    log::error!("[save_autocomplete_combination] Erreur sauvegarde autocomplete_characteristics variation '{}': {}", variant_value, e);
                } else {
                    log::info!("[save_autocomplete_combination] ✅ Sauvegardé dans autocomplete_characteristics variation: {}", variant_value);
                }
                
                // ✅ AUSSI sauvegarder dans autocomplete_combinations (POPULARITÉ - doublons OK)
                let result_comb = sqlx::query(
                    r#"INSERT INTO autocomplete_combinations 
                       (service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
                        has_variant, variant_dimension, variant_value, prix, devise, stock, usage_count)
                       VALUES ($1, $2, $3, '{}', '{}', $2, true, $4, $5, $6, $7, $8, 1)
                       ON CONFLICT (product_vector)
                       DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1"#
                )
                .bind(service_id)
                .bind(&variant_product_vector)  // SANS lieu
                .bind(&product_labels)
                .bind(variant_dimension)
                .bind(variant_value)
                .bind(prix)
                .bind(devise)
                .bind(stock)
                .execute(pool).await;
                
                if let Err(e) = result_comb {
                    log::error!("[save_autocomplete_combination] Erreur sauvegarde autocomplete_combinations variation '{}': {}", variant_value, e);
                } else {
                    log::info!("[save_autocomplete_combination] ✅ Sauvegardé dans autocomplete_combinations variation: {}", variant_value);
                }
            }
        }
    } else {
        // Pas de variation : sauvegarder une seule combinaison
        let prix = produits_field.get("prix")
            .and_then(|p| p.get("valeur"))
            .or_else(|| produits_field.get("prix"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        
        // ✅ NOUVEAU: Sauvegarder dans autocomplete_characteristics (VRAI produit prestataire)
        let result_char = sqlx::query(
            r#"INSERT INTO autocomplete_characteristics 
               (identifiant_base, service_id, product_id,
                characteristic_vector, product_labels, location_vector, full_vector,
                chosen_location, chosen_location_geoname_id,
                is_real_product, origine_champs, usage_count,
                sous_caracteristique, valeur)
               VALUES ('produits', $1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'formulaire', 1, 'vector', $9)"#
        )
        .bind(service_id)
        .bind(&product_id)
        .bind(&product_vector)
        .bind(&product_labels)  // ✅ AJOUT product_labels
        .bind(&location_vector)
        .bind(&full_vector)
        .bind(chosen_location.as_deref())
        .bind(geoname_id)
        .bind(product_vector.get(0).unwrap_or(&String::new()))  // Premier élément comme valeur legacy
        .execute(pool).await;
        
        if let Err(e) = result_char {
            log::error!("[save_autocomplete_combination] Erreur sauvegarde autocomplete_characteristics: {}", e);
        } else {
            log::info!("[save_autocomplete_combination] ✅ Sauvegardé dans autocomplete_characteristics (VRAI produit)");
        }
        
        // ✅ AUSSI sauvegarder dans autocomplete_combinations (POPULARITÉ - doublons OK)
        let result_comb = sqlx::query(
            r#"INSERT INTO autocomplete_combinations 
               (service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
                has_variant, prix, usage_count)
               VALUES ($1, $2, $3, '{}', '{}', $2, false, $4, 1)
               ON CONFLICT (product_vector)
               DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1"#
        )
        .bind(service_id)
        .bind(&product_vector)  // SANS lieu
        .bind(&product_labels)
        .bind(prix)
        .execute(pool).await;
        
        if let Err(e) = result_comb {
            log::error!("[save_autocomplete_combination] Erreur sauvegarde autocomplete_combinations: {}", e);
        } else {
            log::info!("[save_autocomplete_combination] ✅ Sauvegardé dans autocomplete_combinations (POPULARITÉ)");
        }
    }
    
    // ✅ NOUVEAU 2025-11-04: Sauvegarder le vecteur AUSSI dans service.data->produits pour compatibilité recherche
    log::info!("[save_autocomplete_combination] Mise à jour vecteur dans service.data->produits...");
    
    // Récupérer le JSON actuel du service
    let current_data_row = sqlx::query("SELECT data FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération service data: {}", e)))?;
    
    if let Some(row) = current_data_row {
        let mut service_data: serde_json::Value = row.try_get("data")
            .map_err(|e| AppError::Internal(format!("Erreur parsing service data: {}", e)))?;
        
        // ✅ CORRECTION 2025-11-04: Ajouter le vecteur COMPLET (produit + lieu) au champ produits
        if let Some(produits_obj) = service_data.get_mut("produits").and_then(|p| p.as_object_mut()) {
            // Ajouter TOUS les vecteurs au champ produits
            produits_obj.insert("characteristic_vector".to_string(), serde_json::json!(product_vector));
            produits_obj.insert("product_labels".to_string(), serde_json::json!(product_labels));
            produits_obj.insert("location_vector".to_string(), serde_json::json!(location_vector));
            produits_obj.insert("full_vector".to_string(), serde_json::json!(full_vector));  // ✅ Vecteur COMPLET
            produits_obj.insert("chosen_location".to_string(), serde_json::json!(chosen_location));
            
            // Mettre à jour dans la base
            let _ = sqlx::query("UPDATE services SET data = $1 WHERE id = $2")
                .bind(&service_data)
                .bind(service_id)
                .execute(pool)
                .await
                .map_err(|e| {
                    log::error!("[save_autocomplete_combination] Erreur UPDATE service data: {}", e);
                    e
                });
            
            log::info!("[save_autocomplete_combination] ✅ Vecteur ajouté à service.data->produits");
        }
    }
    
    log::info!("[save_autocomplete_combination] Fin sauvegarde pour service {}", service_id);
    
    Ok(())
}

/// Fonction utilitaire pour r?cup?rer le GPS dynamique du prestataire
#[allow(dead_code)]
async fn get_user_gps(pool: &PgPool, user_id: i32) -> Result<(f64, f64), AppError> {
    let row = sqlx::query!("SELECT gps FROM users WHERE id = $1", user_id)
        .fetch_optional(pool).await.map_err(|e| AppError::Internal(format!("Erreur lecture GPS user: {}", e)))?;
    if let Some(r) = row {
        if let Some(coords) = r.gps {
            let parts: Vec<&str> = coords.split(',').collect();
            if parts.len() == 2 {
                let lon = parts[0].trim().parse().unwrap_or(0.0);
                let lat = parts[1].trim().parse().unwrap_or(0.0);
                return Ok((lon, lat));
            }
        }
    }
    Err(AppError::BadRequest("GPS prestataire non disponible".to_string()))
}

/// D?tecte la langue d'un texte (retourne code ISO ou "und")
pub fn detect_lang(text: &str) -> String {
    whatlang::detect(text).map(|info| info.lang().code()).unwrap_or("und").to_string()
}

pub async fn translate_to_en(text: &str, lang: &str) -> String {
    if lang == "eng" || lang == "und" {
        return text.to_string();
    }
    let api_key = std::env::var("GOOGLE_TRANSLATE_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        log::warn!("[TRANSLATE] GOOGLE_TRANSLATE_API_KEY absente, retour texte original.");
        return text.to_string();
    }
    let url = format!("https://translation.googleapis.com/language/translate/v2?key={}", api_key);
    let client = reqwest::Client::new();
    let params = serde_json::json!({
        "q": text,
        "source": lang,
        "target": "en",
        "format": "text"
    });
    let resp = client.post(&url).json(&params).send().await;
    if let Ok(r) = resp {
        if let Ok(json) = r.json::<serde_json::Value>().await {
            if let Some(translated) = json["data"]["translations"][0]["translatedText"].as_str() {
                return translated.to_string();
            } else {
                log::warn!("[TRANSLATE] Champ 'translatedText' absent dans la réponse Google, retour texte original. Réponse: {:?}", json);
            }
        } else {
            log::warn!("[TRANSLATE] Impossible de parser la réponse JSON de Google, retour texte original.");
        }
    } else {
        log::warn!("[TRANSLATE] Erreur HTTP lors de l'appel Google Translate, retour texte original.");
    }
    text.to_string() // fallback
}

/// Mapping des types pour Pinecone : conversion des types non support?s en "texte"
pub fn map_type_for_pinecone(type_donnee: &str) -> &str {
    match type_donnee {
        "string" | "text" | "texte" => "texte",
        "boolean" | "bool" => "texte", // Conversion boolean ? texte
        "gps" | "geolocation" => "texte", // Conversion gps ? texte
        "int" | "float" | "nombre" | "prix" | "montant" => "texte", // Conversion numérique ? texte
        _ => "texte", // Par défaut, tout en texte pour éviter les erreurs
    }
}

// Toute la fonction build_add_embedding_pinecone_json et toute déclaration embedding_task sont commentées temporairement pour compilation.
