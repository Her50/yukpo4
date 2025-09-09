pub mod prompt_manager;
pub mod intention_detector;

use std::sync::Arc;
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::RwLock;
use serde_json::{Value, json};
use crate::core::types::{AppResult};
use crate::models::input_model::MultiModalInput;
// use crate::models::service_model::Service;
// use crate::models::user_model::User;
use crate::services::app_ia::AppIA;
use crate::services::orchestration_ia::convert_all_modals_to_images;
use crate::services::semantic_cache::SemanticCache;
// use crate::utils::embedding_client::EmbeddingClient;
// use crate::state::AppState;

use self::intention_detector::IntentionDetector;
use self::prompt_manager::PromptManager;

/// Cache simple en m?moire pour les r?ponses IA
#[derive(Debug, Clone)]
struct CachedResponse {
    data: Value,
    timestamp: std::time::Instant,
    ttl: Duration,
}

impl CachedResponse {
    fn new(data: Value, ttl_seconds: u64) -> Self {
        Self {
            data,
            timestamp: std::time::Instant::now(),
            ttl: Duration::from_secs(ttl_seconds),
        }
    }

    fn is_expired(&self) -> bool {
        self.timestamp.elapsed() > self.ttl
    }
}

/// Service IA optimis? pour Yukpo
pub struct OptimizedIAService {
    app_ia: Arc<AppIA>,
    intention_detector: IntentionDetector,
    prompt_manager: PromptManager,
    // ? Cache simple en m?moire pour ?viter les appels r?p?t?s
    response_cache: Arc<RwLock<HashMap<String, CachedResponse>>>,
    // ?? Cache s?mantique pour les requ?tes similaires
    semantic_cache: Arc<SemanticCache>,
}

impl OptimizedIAService {
    /// Cr?e un nouveau service IA optimis?
    pub async fn new(app_ia: Arc<AppIA>) -> AppResult<Self> {
        let intention_detector = IntentionDetector::new(app_ia.clone()).await?;
        let prompt_manager = PromptManager::new().await?;
        let semantic_cache = SemanticCache::new_default();
        
        Ok(Self {
            app_ia,
            intention_detector,
            prompt_manager,
            response_cache: Arc::new(RwLock::new(HashMap::new())),
            semantic_cache: Arc::new(semantic_cache),
        })
    }
    
    /// Traite une demande utilisateur avec l'architecture optimis?e ET MESURES DE TEMPS D?TAILL?ES
    pub async fn process_user_request(&self, input: &MultiModalInput) -> AppResult<Value> {
        let start_time = std::time::Instant::now();
        
        // 1. Extraire le texte de la demande
        let step1_start = std::time::Instant::now();
        let user_text = self.extract_user_text(input);
        let step1_time = step1_start.elapsed();
        log::info!("[OptimizedIAService][TIMING] ?tape 1 - Extraction texte: {:?}", step1_time);
        
        // 2. D?tecter l'intention (PREMIER APPEL IA)
        let step2_start = std::time::Instant::now();
        let (intention, tokens_detection_reels) = self.intention_detector.detect_intention(&user_text).await?;
        let step2_time = step2_start.elapsed();
        log::info!("[OptimizedIAService][TIMING] ?tape 2 - D?tection intention: {:?} -> {}", step2_time, intention);
        
        // ? OPTIMISATION : V?rifier le cache exact en premier
        let step3_start = std::time::Instant::now();
        let cache_key = format!("{}:{}", user_text, intention);
        if let Some(cached) = self.get_cached_response(&cache_key).await {
            let step3_time = step3_start.elapsed();
            log::info!("[OptimizedIAService] ? Cache exact hit en {:?}!", step3_time);
            return Ok(cached);
        }
        let step3_time = step3_start.elapsed();
        log::info!("[OptimizedIAService][TIMING] ?tape 3 - V?rification cache exact: {:?} (miss)", step3_time);
        
        // 3. V?rification cache s?mantique avec timeout ?quilibr?
        let step4_start = std::time::Instant::now();
        let semantic_result = tokio::time::timeout(
            Duration::from_millis(1500), // Timeout ?quilibr? : 1.5s pour la pr?cision
            self.semantic_cache.get_semantic_cache(&user_text, &intention)
        ).await;
        let step4_time = step4_start.elapsed();
        log::info!("[OptimizedIAService][TIMING] ?tape 4 - V?rification cache s?mantique: {:?}", step4_time);
        
        // 4. Si cache s?mantique trouv? rapidement, l'utiliser
        if let Ok(Ok(Some(cached_response))) = semantic_result {
            log::info!("[OptimizedIAService] ? Cache s?mantique hit - r?ponse rapide!");
            
            let parsed_json = serde_json::from_str(&cached_response)?;
            
            // Mise en cache en arri?re-plan (non-bloquant)
            let _cache_key_cloned = cache_key.clone();
            let semantic_cache_cloned = self.semantic_cache.clone();
            let user_text_cloned = user_text.clone();
            let intention_cloned = intention.clone();
            
            tokio::spawn(async move {
                let _ = semantic_cache_cloned.store_semantic_cache(&user_text_cloned, &intention_cloned, &cached_response).await;
            });
            
            return Ok(parsed_json);
        }
        
        // 5. G?n?ration prompt optimis?
        let step5_start = std::time::Instant::now();
        let enriched_prompt = self.prompt_manager.get_optimized_prompt(&intention, &user_text).await;
        let step5_time = step5_start.elapsed();
        log::info!("[OptimizedIAService][TIMING] ?tape 5 - G?n?ration prompt: {:?}", step5_time);
        
        // 6. Appel IA externe (DEUXI?ME APPEL IA) - Multimodal si images présentes
        let step6_start = std::time::Instant::now();
        let (json_response, model_name, tokens_used) = if input.base64_image.is_some() && !input.base64_image.as_ref().unwrap().is_empty() {
            log::info!("[OptimizedIAService] Images détectées, utilisation de predict_multimodal");
            self.app_ia.predict_multimodal(&enriched_prompt, input.base64_image.clone()).await?
        } else {
            log::info!("[OptimizedIAService] Aucune image, utilisation de predict standard");
            self.app_ia.predict(&enriched_prompt).await?
        };
        let step6_time = step6_start.elapsed();
        log::info!("[OptimizedIAService][TIMING] ?tape 6 - Appel IA externe: {:?} ({} tokens)", step6_time, tokens_used);
        
        // 7. Nettoyage et parsing
        let step7_start = std::time::Instant::now();
        let cleaned_json = json_response
            .replace("```json", "")
            .replace("```", "")
            .trim()
            .to_string();
        
        let parsed_json: Value = serde_json::from_str(&cleaned_json)
            .map_err(|e| format!("Erreur parsing JSON: {}", e))?;
        let step7_time = step7_start.elapsed();
        log::info!("[OptimizedIAService][TIMING] ?tape 7 - Nettoyage et parsing: {:?}", step7_time);
        
        // 8. Mise en cache en arri?re-plan (non-bloquant pour UX)
        let cache_key_cloned = cache_key.clone();
        let parsed_json_cloned = parsed_json.clone();
        let semantic_cache_cloned = self.semantic_cache.clone();
        let user_text_cloned = user_text.clone();
        let intention_cloned = intention.clone();
        let cleaned_json_cloned = cleaned_json.clone();
        let response_cache_cloned = self.response_cache.clone();

        tokio::spawn(async move {
            // Cache exact
            let mut cache = response_cache_cloned.write().await;
            cache.insert(cache_key_cloned, CachedResponse::new(parsed_json_cloned, 3600));

            // Cache s?mantique en arri?re-plan
            let semantic_start = std::time::Instant::now();
            let user_text_owned = user_text_cloned.clone();
            let intention_owned = intention_cloned.clone();
            let cleaned_json_owned = cleaned_json_cloned.clone();
            match tokio::time::timeout(
                Duration::from_secs(2),
                semantic_cache_cloned.store_semantic_cache(&user_text_owned, &intention_owned, &cleaned_json_owned)
            ).await {
                Ok(Ok(())) => {
                    log::info!("[BackgroundTasks] ? Cache s?mantique mis ? jour en {:?}", semantic_start.elapsed());
                },
                Ok(Err(e)) => {
                    log::warn!("[BackgroundTasks] ?? Erreur cache s?mantique: {}", e);
                },
                Err(_) => {
                    log::warn!("[BackgroundTasks] ? Timeout cache s?mantique (2s)");
                }
            }
        });
        
        let total_time = start_time.elapsed();
        log::info!("[OptimizedIAService] ? Traitement parall?le termin? en {:?}", total_time);
        
        // ?? R?cup?rer l'intention finale depuis la r?ponse IA (peut ?tre diff?rente de l'intention d?tect?e)
        let intention_finale = parsed_json.get("intention")
            .and_then(|v| v.as_str())
            .unwrap_or(&intention)
            .to_string();
        
        // ?? Calculer les tokens totaux (d?tection d'intention + g?n?ration de r?ponse)
        let tokens_totaux = tokens_detection_reels + tokens_used;
        
        log::info!("[OptimizedIAService] ?? Tokens totaux: {} (d?tection: {} + g?n?ration: {})", 
                  tokens_totaux, tokens_detection_reels, tokens_used);
        log::info!("[OptimizedIAService] ?? Intention finale: {} (d?tect?e: {})", intention_finale, intention);
        
        // Ajouter les tokens consomm?s au r?sultat
        let mut final_result = parsed_json;
        if let Some(obj) = final_result.as_object_mut() {
            obj.insert("tokens_consumed".to_string(), json!(tokens_totaux));
            obj.insert("tokens_breakdown".to_string(), json!({
                "detection": tokens_detection_reels,
                "generation": tokens_used,
                "total": tokens_totaux
            }));
            obj.insert("intention".to_string(), json!(intention_finale));
            obj.insert("model_used".to_string(), json!(model_name));
            obj.insert("processing_time_ms".to_string(), json!(total_time.as_millis()));
        }
        
        Ok(final_result)
    }
    
    /// Traite une demande utilisateur avec r?ponse imm?diate au frontend + traitements en arri?re-plan
    pub async fn process_user_request_immediate_response(&self, input: &MultiModalInput) -> AppResult<Value> {
        let start_time = std::time::Instant::now();
        
        // 1. Extraction texte (rapide)
        let user_text = self.extract_user_text(input);
        
        // 2. D?tection intention (rapide) - PREMIER APPEL IA
        let (intention, tokens_detection_reels) = self.intention_detector.detect_intention(&user_text).await?;
        
        // 3. V?rification cache exact (tr?s rapide)
        let cache_key = format!("{}:{}", user_text, intention);
        if let Some(cached) = self.get_cached_response(&cache_key).await {
            log::info!("[OptimizedIAService] ? Cache exact hit - r?ponse imm?diate!");
            
            // Traitements en arri?re-plan (non-bloquant)
            self.spawn_background_tasks(&cache_key, &user_text, &intention, &cached).await;
            
            return Ok(cached);
        }
        
        // 4. V?rification cache s?mantique avec timeout ?quilibr?
        let semantic_result = tokio::time::timeout(
            Duration::from_millis(1500),
            self.semantic_cache.get_semantic_cache(&user_text, &intention)
        ).await;
        
        // 5. Si cache s?mantique trouv? rapidement, l'utiliser
        if let Ok(Ok(Some(cached_response))) = semantic_result {
            log::info!("[OptimizedIAService] ? Cache s?mantique hit - r?ponse rapide!");
            
            let parsed_json = serde_json::from_str(&cached_response)?;
            
            // Traitements en arri?re-plan (non-bloquant)
            self.spawn_background_tasks(&cache_key, &user_text, &intention, &parsed_json).await;
            
            return Ok(parsed_json);
        }
        
        // 6. G?n?ration prompt
        let enriched_prompt = self.prompt_manager.get_optimized_prompt(&intention, &user_text).await;
        
        // 7. Appel IA externe (le plus long) - Support multimodal UNIFI? - DEUXI?ME APPEL IA
        let (json_response, model_name, tokens_used) = {
            // ?? APPROCHE OPTIMALE : Convertir tous les modaux en images + un seul appel IA
            let all_images = convert_all_modals_to_images(input).await;
            
            if !all_images.is_empty() {
                log::info!("[OptimizedIAService] ??? Pipeline multimodal unifi? avec {} images", all_images.len());
                
                // Prompt optimis? pour extraction structur?e de tous les modaux
                let multimodal_prompt = format!(
                    r#"
                    Tu es un expert en analyse multimodale pour la plateforme Yukpo.
                    
                    G?N?RE UN JSON STRICTEMENT CONFORME pour la cr?ation d'un service :
                    
                    **STRUCTURE OBLIGATOIRE :**
                    ```json
                    {{
                      "intention": "creation_service",
                      "titre_service": {{
                        "type_donnee": "string",
                        "valeur": "<titre du service bas? sur l'image>",
                        "origine_champs": "image"
                      }},
                      "category": {{
                        "type_donnee": "string",
                        "valeur": "<cat?gorie du service>",
                        "origine_champs": "image"
                      }},
                      "description": {{
                        "type_donnee": "string",
                        "valeur": "<description d?taill?e du service>",
                        "origine_champs": "image"
                      }},
                      "is_tarissable": {{
                        "type_donnee": "boolean",
                        "valeur": true,
                        "origine_champs": "image"
                      }},
                      "produits": {{
                        "type_donnee": "listeproduit",
                        "valeur": [
                          {{
                            "nom": "<nom exact du produit visible>",
                            "quantite": <quantit? exacte visible>,
                            "prix": <prix exact visible>,
                            "marque": "<marque exacte visible>",
                            "categorie": "<cat?gorie d?duite>"
                          }}
                        ],
                        "origine_champs": "image"
                      }}
                    }}
                    ```
                    
                    R?GLES STRICTES CRITIQUES :
                    - **EXTRACTION EXACTE** : Extrais UNIQUEMENT les produits/services visibles dans l'image
                    - **PRIX EXACTS** : Utilise les prix exacts affich?s dans l'image (en XAF)
                    - **NOMS EXACTS** : Utilise les noms exacts des produits visibles
                    - **QUANTIT?S EXACTES** : Utilise les quantit?s exactes affich?es
                    - **MARQUES EXACTES** : Utilise les marques exactes visibles
                    - **INTERDICTION TOTALE** : Ne cr?e JAMAIS de produits qui ne sont pas visibles dans l'image
                    - **FID?LIT? TOTALE** : Reproduis fid?lement ce que tu observes, sans extrapolation
                    - **COMPL?TUDE** : Liste TOUS les produits visibles dans l'image, un par un
                    
                    CONTENU ? ANALYSER :
                    {user_text}
                    
                    R?PONSE UNIQUEMENT EN JSON VALIDE (pas de texte avant/apr?s).
                    "#
                );
                
                self.app_ia.predict_multimodal(&multimodal_prompt, Some(all_images)).await?
            } else {
                // Fallback : appel textuel classique
                self.app_ia.predict(&enriched_prompt).await?
            }
        };
        
        // 8. Nettoyage et parsing
        let cleaned_json = json_response
            .replace("```json", "")
            .replace("```", "")
            .trim()
            .to_string();
        
        let parsed_json: Value = serde_json::from_str(&cleaned_json)
            .map_err(|e| format!("Erreur parsing JSON: {}", e))?;
        
        // 9. R?PONSE IMM?DIATE AU FRONTEND
        log::info!("[OptimizedIAService] ? R?ponse imm?diate au frontend en {:?}", start_time.elapsed());
        
        // ?? R?cup?rer l'intention finale depuis la r?ponse IA (peut ?tre diff?rente de l'intention d?tect?e)
        let intention_finale = parsed_json.get("intention")
            .and_then(|v| v.as_str())
            .unwrap_or(&intention)
            .to_string();
        
        // ?? Calculer les tokens totaux (d?tection d'intention + g?n?ration de r?ponse)
        let tokens_totaux = tokens_detection_reels + tokens_used;
        
        log::info!("[OptimizedIAService] ?? Tokens totaux: {} (d?tection: {} + g?n?ration: {})", 
                  tokens_totaux, tokens_detection_reels, tokens_used);
        log::info!("[OptimizedIAService] ?? Intention finale: {} (d?tect?e: {})", intention_finale, intention);
        
        // Ajouter les tokens consomm?s au r?sultat
        let mut final_result = parsed_json;
        if let Some(obj) = final_result.as_object_mut() {
            obj.insert("tokens_consumed".to_string(), json!(tokens_totaux));
            obj.insert("tokens_breakdown".to_string(), json!({
                "detection": tokens_detection_reels,
                "generation": tokens_used,
                "total": tokens_totaux
            }));
            obj.insert("intention".to_string(), json!(intention_finale));
            obj.insert("model_used".to_string(), json!(model_name));
            obj.insert("processing_time_ms".to_string(), json!(start_time.elapsed().as_millis()));
        }
        
        // 10. Traitements en arri?re-plan (non-bloquant pour UX)
        self.spawn_background_tasks(&cache_key, &user_text, &intention, &final_result).await;
        
        Ok(final_result)
    }
    
    /// ?? Traitement utilisateur avec optimisations GPU
    pub async fn process_user_request_gpu_optimized(&self, input: &MultiModalInput, gpu_optimizer: &crate::services::gpu_optimizer::GPUOptimizer) -> AppResult<Value> {
        let start_time = std::time::Instant::now();
        
        // 1. Extraction texte (rapide)
        let user_text = self.extract_user_text(input);
        
        // 2. D?tection intention (rapide) - PREMIER APPEL IA
        let (intention, tokens_detection_reels) = self.intention_detector.detect_intention(&user_text).await?;
        
        // 3. V?rification cache exact (tr?s rapide)
        let cache_key = format!("{}:{}", user_text, intention);
        if let Some(cached) = self.get_cached_response(&cache_key).await {
            log::info!("[OptimizedIAService] ? Cache exact hit - r?ponse imm?diate!");
            
            // Traitements en arri?re-plan (non-bloquant)
            self.spawn_background_tasks(&cache_key, &user_text, &intention, &cached).await;
            
            return Ok(cached);
        }
        
        // 4. V?rification cache s?mantique avec timeout ?quilibr?
        let semantic_result = tokio::time::timeout(
            Duration::from_millis(1500),
            self.semantic_cache.get_semantic_cache(&user_text, &intention)
        ).await;
        
        // 5. Si cache s?mantique trouv? rapidement, l'utiliser
        if let Ok(Ok(Some(cached_response))) = semantic_result {
            log::info!("[OptimizedIAService] ? Cache s?mantique hit - r?ponse rapide!");
            
            let parsed_json = serde_json::from_str(&cached_response)?;
            
            // Traitements en arri?re-plan (non-bloquant)
            self.spawn_background_tasks(&cache_key, &user_text, &intention, &parsed_json).await;
            
            return Ok(parsed_json);
        }
        
        // 6. G?n?ration prompt
        let enriched_prompt = self.prompt_manager.get_optimized_prompt(&intention, &user_text).await;
        
        // 7. Appel IA externe avec optimisations GPU - Support multimodal UNIFI? - DEUXI?ME APPEL IA
        let (json_response, model_name, tokens_used) = {
            // ?? APPROCHE OPTIMALE GPU : Convertir tous les modaux en images optimis?es + un seul appel IA
            let all_images = gpu_optimizer.convert_all_modals_to_images_optimized(input).await;
            
            if !all_images.is_empty() {
                log::info!("[OptimizedIAService] ??? Pipeline multimodal GPU unifi? avec {} images", all_images.len());
                
                // Prompt optimis? pour extraction structur?e de tous les modaux
                let multimodal_prompt = format!(
                    r#"
                    Tu es un expert en analyse multimodale pour la plateforme Yukpo.
                    
                    G?N?RE UN JSON STRICTEMENT CONFORME pour la cr?ation d'un service :
                    
                    **STRUCTURE OBLIGATOIRE :**
                    ```json
                    {{
                      "intention": "creation_service",
                      "titre_service": {{
                        "type_donnee": "string",
                        "valeur": "<titre du service bas? sur l'image>",
                        "origine_champs": "image"
                      }},
                      "category": {{
                        "type_donnee": "string",
                        "valeur": "<cat?gorie du service>",
                        "origine_champs": "image"
                      }},
                      "description": {{
                        "type_donnee": "string",
                        "valeur": "<description d?taill?e du service>",
                        "origine_champs": "image"
                      }},
                      "is_tarissable": {{
                        "type_donnee": "boolean",
                        "valeur": true,
                        "origine_champs": "image"
                      }},
                      "produits": {{
                        "type_donnee": "listeproduit",
                        "valeur": [
                          {{
                            "nom": "<nom exact du produit visible>",
                            "quantite": <quantit? exacte visible>,
                            "prix": <prix exact visible>,
                            "marque": "<marque exacte visible>",
                            "categorie": "<cat?gorie d?duite>"
                          }}
                        ],
                        "origine_champs": "image"
                      }}
                    }}
                    ```
                    
                    R?GLES STRICTES CRITIQUES :
                    - **EXTRACTION EXACTE** : Extrais UNIQUEMENT les produits/services visibles dans l'image
                    - **PRIX EXACTS** : Utilise les prix exacts affich?s dans l'image (en XAF)
                    - **NOMS EXACTS** : Utilise les noms exacts des produits visibles
                    - **QUANTIT?S EXACTES** : Utilise les quantit?s exactes affich?es
                    - **MARQUES EXACTES** : Utilise les marques exactes visibles
                    - **INTERDICTION TOTALE** : Ne cr?e JAMAIS de produits qui ne sont pas visibles dans l'image
                    - **FID?LIT? TOTALE** : Reproduis fid?lement ce que tu observes, sans extrapolation
                    - **COMPL?TUDE** : Liste TOUS les produits visibles dans l'image, un par un
                    
                    CONTENU ? ANALYSER :
                    {user_text}
                    
                    R?PONSE UNIQUEMENT EN JSON VALIDE (pas de texte avant/apr?s).
                    "#
                );
                
                self.app_ia.predict_multimodal(&multimodal_prompt, Some(all_images)).await?
            } else {
                // Fallback : appel textuel classique
                self.app_ia.predict(&enriched_prompt).await?
            }
        };
        
        // 8. Nettoyage et parsing
        let cleaned_json = json_response
            .replace("```json", "")
            .replace("```", "")
            .trim()
            .to_string();
        
        let parsed_json: Value = serde_json::from_str(&cleaned_json)
            .map_err(|e| format!("Erreur parsing JSON: {}", e))?;
        
        // 9. R?PONSE IMM?DIATE AU FRONTEND
        log::info!("[OptimizedIAService] ? R?ponse GPU imm?diate au frontend en {:?}", start_time.elapsed());
        
        // ?? R?cup?rer l'intention finale depuis la r?ponse IA (peut ?tre diff?rente de l'intention d?tect?e)
        let intention_finale = parsed_json.get("intention")
            .and_then(|v| v.as_str())
            .unwrap_or(&intention)
            .to_string();
        
        // ?? Calculer les tokens totaux (d?tection d'intention + g?n?ration de r?ponse)
        let tokens_totaux = tokens_detection_reels + tokens_used;
        
        log::info!("[OptimizedIAService] ?? Tokens totaux GPU: {} (d?tection: {} + g?n?ration: {})", 
                  tokens_totaux, tokens_detection_reels, tokens_used);
        log::info!("[OptimizedIAService] ?? Intention finale: {} (d?tect?e: {})", intention_finale, intention);
        
        // Ajouter les tokens consomm?s au r?sultat
        let mut final_result = parsed_json;
        if let Some(obj) = final_result.as_object_mut() {
            obj.insert("tokens_consumed".to_string(), json!(tokens_totaux));
            obj.insert("tokens_breakdown".to_string(), json!({
                "detection": tokens_detection_reels,
                "generation": tokens_used,
                "total": tokens_totaux
            }));
            obj.insert("intention".to_string(), json!(intention_finale));
            obj.insert("model_used".to_string(), json!(model_name));
            obj.insert("processing_time_ms".to_string(), json!(start_time.elapsed().as_millis()));
            obj.insert("gpu_optimized".to_string(), json!(true));
            obj.insert("optimization_level".to_string(), json!("high"));
        }
        
        // 10. Traitements en arri?re-plan (non-bloquant pour UX)
        self.spawn_background_tasks(&cache_key, &user_text, &intention, &final_result).await;
        
        Ok(final_result)
    }
    
    /// ?? NOUVEAU : Traite du texte brut pour générer un JSON de service structuré
    pub async fn process_text_to_service_json(&self, user_text: &str) -> AppResult<Value> {
        log::info!("[OptimizedIAService] ?? Traitement du texte brut: {}", user_text);
        
        // 1. Détecter l'intention (rapide)
        let (intention, _tokens_detection) = self.intention_detector.detect_intention(user_text).await?;
        log::info!("[OptimizedIAService] ?? Intention détectée: {}", intention);
        
        // 2. Vérifier si c'est bien une création de service
        if intention != "creation_service" {
            return Err(crate::core::types::AppError::BadRequest(
                format!("Le texte '{}' ne correspond pas à une création de service. Intention détectée: {}", user_text, intention)
            ));
        }
        
        // 3. Générer le prompt de création de service
        let enriched_prompt = self.prompt_manager.get_optimized_prompt(&intention, user_text).await;
        log::info!("[OptimizedIAService] ?? Prompt généré pour création de service");
        
        // 4. Appeler l'IA pour générer le JSON structuré
        let (json_response, model_name, tokens_used) = self.app_ia.predict(&enriched_prompt).await?;
        log::info!("[OptimizedIAService] ?? Réponse IA reçue ({} tokens, modèle: {})", tokens_used, model_name);
        
        // 5. Extraire le JSON des backticks si présent
        let json_response_clean = if json_response.contains("```json") {
            let start = json_response.find("```json").unwrap_or(0) + 7;
            let end = json_response.rfind("```").unwrap_or(json_response.len());
            json_response[start..end].trim()
        } else if json_response.contains("```") {
            let start = json_response.find("```").unwrap_or(0) + 3;
            let end = json_response.rfind("```").unwrap_or(json_response.len());
            json_response[start..end].trim()
        } else {
            json_response.trim()
        };
        
        log::info!("[OptimizedIAService] ?? JSON extrait: {}", json_response_clean);
        
        // 6. Parser la réponse JSON
        let parsed_json: Value = serde_json::from_str(json_response_clean).map_err(|e| {
            log::error!("[OptimizedIAService] ?? Erreur parsing JSON: {}", e);
            log::error!("[OptimizedIAService] ?? JSON reçu: {}", json_response_clean);
            crate::core::types::AppError::BadRequest(format!("Réponse IA invalide: {}", e))
        })?;
        
        // 7. Ajouter les tokens consommés pour tracking
        let mut final_json = parsed_json.clone();
        if let Some(obj) = final_json.as_object_mut() {
            obj.insert("tokens_consumed".to_string(), Value::Number(tokens_used.into()));
        }
        
        log::info!("[OptimizedIAService] ?? JSON final généré avec succès");
        Ok(final_json)
    }
    
    /// Lance les traitements en arri?re-plan (non-bloquant)
    async fn spawn_background_tasks(&self, cache_key: &str, user_text: &str, intention: &str, result: &Value) {
        let cache_key = cache_key.to_string();
        let _user_text = user_text.to_string();
        let _intention = intention.to_string();
        let result_cloned = result.clone();
        let semantic_cache = self.semantic_cache.clone();
        let response_cache = self.response_cache.clone();
        
        tokio::spawn(async move {
            log::info!("[BackgroundTasks] ?? D?marrage des traitements en arri?re-plan");
            
            // 1. Mise en cache exact
            let cache_start = std::time::Instant::now();
            {
                let mut cache = response_cache.write().await;
                let cached_response = CachedResponse::new(result_cloned.clone(), 3600); // 1 heure
                cache.insert(cache_key.clone(), cached_response);
            }
            log::info!("[BackgroundTasks] ? Cache exact mis ? jour en {:?}", cache_start.elapsed());
            
            // 2. Mise en cache s?mantique (avec timeout ?quilibr?)
            let semantic_start = std::time::Instant::now();
            let user_text_owned = _user_text.clone();
            let intention_owned = _intention.clone();
            let cleaned_json_owned = serde_json::to_string(&result_cloned).unwrap_or_default();
            match tokio::time::timeout(
                Duration::from_secs(2), // Timeout ?quilibr? pour la pr?cision
                semantic_cache.store_semantic_cache(&user_text_owned, &intention_owned, &cleaned_json_owned)
            ).await {
                Ok(Ok(())) => {
                    log::info!("[BackgroundTasks] ? Cache s?mantique mis ? jour en {:?}", semantic_start.elapsed());
                },
                Ok(Err(e)) => {
                    log::warn!("[BackgroundTasks] ?? Erreur cache s?mantique: {}", e);
                },
                Err(_) => {
                    log::warn!("[BackgroundTasks] ? Timeout cache s?mantique (2s)");
                }
            }
            
            log::info!("[BackgroundTasks] ?? Tous les traitements en arri?re-plan termin?s");
        });
    }
    
    /// Extrait le texte de la demande utilisateur
    fn extract_user_text(&self, input: &MultiModalInput) -> String {
        let mut text_parts = Vec::new();
        
        // Texte principal
        if let Some(texte) = &input.texte {
            text_parts.push(texte.clone());
        }
        
        // Informations GPS si disponibles
        if let Some(gps) = &input.gps_mobile {
            text_parts.push(format!("Localisation: {}", gps));
        }
        
        // Informations sur les fichiers
        if let Some(images) = &input.base64_image {
            if !images.is_empty() {
                log::info!("[OptimizedIAService] Images d?tect?es dans l'input: {} images", images.len());
                text_parts.push(format!("Images jointes: {}", images.len()));
                
                // Log d?taill? des images
                for (i, img) in images.iter().enumerate() {
                    log::info!("[OptimizedIAService] Image {}: taille {} bytes, d?but: {}...", 
                              i, img.len(), &img[..std::cmp::min(50, img.len())]);
                }
            }
        } else {
            log::info!("[OptimizedIAService] Aucune image dans l'input");
        }
        
        if let Some(audios) = &input.audio_base64 {
            if !audios.is_empty() {
                text_parts.push(format!("Audio joint: {}", audios.len()));
            }
        }
        
        if let Some(docs) = &input.doc_base64 {
            if !docs.is_empty() {
                text_parts.push(format!("Documents joints: {}", docs.len()));
            }
        }
        
        if let Some(excel) = &input.excel_base64 {
            if !excel.is_empty() {
                text_parts.push(format!("Fichiers Excel joints: {}", excel.len()));
            }
        }
        
        if let Some(site) = &input.site_web {
            text_parts.push(format!("Site web: {}", site));
        }
        
        text_parts.join(" | ")
    }
    

    
    /// ? R?cup?re une r?ponse du cache
    async fn get_cached_response(&self, cache_key: &str) -> Option<Value> {
        let cache = self.response_cache.read().await;
        if let Some(cached) = cache.get(cache_key) {
            if !cached.is_expired() {
                return Some(cached.data.clone());
            }
        }
        None
    }
    
    /// ? Met en cache une r?ponse
    #[allow(dead_code)]
    async fn cache_response(&self, cache_key: &str, response: &Value) {
        let cached = CachedResponse::new(response.clone(), 3600); // Cache 1 heure
        
        let mut cache = self.response_cache.write().await;
        cache.insert(cache_key.to_string(), cached);
        
        // Nettoyer le cache si trop volumineux
        if cache.len() > 1000 {
            cache.retain(|_, v| !v.is_expired());
        }
    }
    
    /// Obtient les statistiques de performance
    pub async fn get_performance_stats(&self) -> Value {
        let semantic_stats = self.semantic_cache.get_stats().await;
        
        serde_json::json!({
            "architecture": "optimized_with_semantic_cache",
            "prompts_count": self.prompt_manager.get_supported_intentions().len(),
            "cache_enabled": true,
            "cache_types": {
                "exact_cache": "en m?moire, TTL 1h",
                "semantic_cache": "Pinecone, similarit? > 0.92"
            },
            "estimated_response_time": "0.1s (cache) / 5s (IA)",
            "semantic_cache_stats": semantic_stats
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::input_model::MultiModalInput;
    
    #[tokio::test]
    async fn test_optimized_ia_service_creation() {
        // Note: Ce test n?cessite une configuration compl?te
        // let app_ia = Arc::new(AppIA::new().unwrap());
        // let service = OptimizedIAService::new(app_ia).await;
        // assert!(service.is_ok());
    }
    
    #[tokio::test]
    async fn test_extract_user_text() {
        // Test de la fonction d'extraction de texte
        let input = MultiModalInput {
            texte: Some("Je vends des v?tements".to_string()),
            base64_image: None,
            audio_base64: None,
            video_base64: None,
            doc_base64: None,
            excel_base64: None,
            site_web: None,
            gps_mobile: None,
        };
        
        // Note: Ce test n?cessite une instance du service
        // let service = OptimizedIAService::new(...).await.unwrap();
        // let text = service.extract_user_text(&input);
        // assert!(text.contains("Je vends des v?tements"));
    }
} 
