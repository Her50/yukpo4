// ?? src/services/creer_service.rs

use crate::core::types::AppError;
use crate::utils::embedding_client::AddEmbeddingPineconeRequest;
use sqlx::{PgPool, Row};
use log::info;
use chrono::Utc;

// ?? Imports pour la génération de signatures d'images (conditionnels)
#[cfg(feature = "image_search")]
use base64::{Engine, engine::general_purpose::STANDARD};
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
    
    if ia_tokens_consumed > 0 {
        token_tracker.add_enrichment(ia_tokens_consumed);
        log::info!("[creer_service] Tokens IA externe extraits depuis les données: {}", ia_tokens_consumed);
    } else {
        log::warn!("[creer_service] Aucun token IA trouvé dans les données (ni tokens_ia_externe ni tokens_consumed)");
    }
    
    let mut data_obj = valider_service_json(&data_processed)?;
    // Ajouter tokens de validation
    token_tracker.add_validation(2);
    
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

    // ?? NOUVEAU : Sauvegarder tous les types de fichiers dans la table media
    let mut files_saved = 0;
    
    // Images
    if let Some(images) = data_processed.get("base64_image").and_then(|v| v.as_array()) {
        let image_strings: Vec<String> = images
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();
        
        if !image_strings.is_empty() {
            log::info!("[creer_service] Sauvegarde de {} images pour le service {}", image_strings.len(), service_id);
            
            // ?? NOUVEAU : Créer le service de recherche d'images pour générer les signatures
            #[cfg(feature = "image_search")]
            let image_service = crate::services::image_search_service::ImageSearchService::new(pool.clone());
            
            // Sauvegarder les images directement dans la transaction
            for (i, _image_data) in image_strings.iter().enumerate() {
                let file_path = format!("image_{}_{}.jpg", service_id, uuid::Uuid::new_v4());
                
                // ?? NOUVEAU : Décoder l'image base64 pour générer la signature
                #[cfg(feature = "image_search")]
                let image_bytes = match STANDARD.decode(_image_data.as_bytes()) {
                    Ok(bytes) => bytes,
                    Err(e) => {
                        log::error!("[creer_service] Erreur décodage base64 image {}: {}", i, e);
                        continue;
                    }
                };
                
                // ?? NOUVEAU : Générer la signature et les métadonnées de l'image
                #[cfg(feature = "image_search")]
                let (image_signature, image_hash, image_metadata) = {
                    match image_service.generate_image_signature(&image_bytes).await {
                        Ok(signature) => {
                            let metadata = match image_service.extract_image_metadata(&image_bytes).await {
                                Ok(meta) => meta,
                                Err(e) => {
                                    log::warn!("[creer_service] Erreur métadonnées image {}: {}", i, e);
                                    // Créer des métadonnées par défaut
                                    crate::services::image_search_service::ImageMetadata {
                                        width: 0,
                                        height: 0,
                                        format: "jpeg".to_string(),
                                        file_size: image_bytes.len(),
                                        dominant_colors: vec![],
                                        color_histogram: vec![],
                                        edge_density: 0.0,
                                        brightness: 0.0,
                                        contrast: 0.0,
                                    }
                                }
                            };
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
                
                // ?? NOUVEAU : Insérer avec signature et métadonnées
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
                    log::error!("[creer_service] Erreur insertion media image: {}", e);
                    continue;
                }
                files_saved += 1;
                log::info!("[creer_service] Image {} du service {} sauvegardée avec signature", i + 1, service_id);
            }
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

    // Commit de la transaction AVANT la réponse
    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("?chec commit: {}", e)))?;

    log::info!("[CREER_SERVICE] ? Transaction commitée avec succès - Service ID: {} maintenant visible en base", service_id);
    log::info!("[CREER_SERVICE] Tokens consommés pour utilisateur {}: {:?}", user_id, token_tracker);
    log::info!("[CREER_SERVICE] Total tokens retournés: {} (type: u32)", token_tracker.total_tokens);
    
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
