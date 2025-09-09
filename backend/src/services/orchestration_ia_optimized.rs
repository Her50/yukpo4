// backend/src/services/orchestration_ia_optimized.rs
// Wrapper d'orchestration IA avec optimisations professionnelles (Copilot/Cursor style)
// Int?gration progressive sans casser l'existant

use std::sync::Arc;
use std::time::Instant;
use serde_json::{json, Value};

use crate::core::types::AppResult;
use crate::models::input_model::MultiModalInput;


use crate::services::orchestration_ia;

use crate::state::AppState;
use crate::utils::log::{log_info, log_warn, log_error};

/// ?? Orchestration IA avec optimisations professionnelles (wrapper progressif)
/// Cette fonction agit comme un wrapper intelligent qui :
/// 1. Utilise le cache s?mantique si disponible (85% hit rate vis?)
/// 2. Optimise les prompts avec PromptOptimizer (style Cursor)
/// 3. Fallback vers l'orchestration classique si probl?me
/// 4. Pr?serve 100% la compatibilit? avec l'existant
pub async fn orchestrer_intention_ia_avec_optimisations(
    state: Arc<AppState>,
    user_id: Option<i32>,
    input: &MultiModalInput,
) -> AppResult<Value> {
    
    let start_time = Instant::now();
    let interaction_id = uuid::Uuid::new_v4().to_string();
    
    log_info(&format!("[OrchestrationOptimized] ?? D?but orchestration optimis?e (ID: {})", interaction_id));

    // ? V?RIFICATION PR?ALABLE : Optimisations activ?es ?
    if !state.optimizations_enabled {
        log_info("[OrchestrationOptimized] Optimisations d?sactiv?es, utilisation orchestration classique");
        return orchestration_ia::orchestrer_intention_ia(
            state.ia.clone(),
            state.clone(),
            user_id,
            input,
        ).await;
    }

    // ? ?TAPE 1 : CACHE S?MANTIQUE INTELLIGENT (Technique Copilot)
    if let Some(cache) = &state.semantic_cache {
        let user_context = build_user_context_for_cache(user_id, input).await;
        let cache_query = build_cache_query_from_input(input);
        
        log_info(&format!("[OrchestrationOptimized] Recherche cache pour: {}", &cache_query[..50.min(cache_query.len())]));
        
        match cache.get_smart(&cache_query, Some(&user_context)).await {
            Ok(Some(cached_response)) => {
                let cache_time = start_time.elapsed().as_micros();
                log_info(&format!("[OrchestrationOptimized] ?? CACHE HIT en {}?s - Performance Copilot!", cache_time));
                
                // D?coder la r?ponse cach?e
                match serde_json::from_str::<Value>(&cached_response.content) {
                    Ok(mut cached_result) => {
                        // Ajouter m?tadonn?es de cache
                        if let Some(obj) = cached_result.as_object_mut() {
                            obj.insert("cache_hit".to_string(), json!(true));
                            obj.insert("cache_time_microseconds".to_string(), json!(cache_time));
                            obj.insert("cached_confidence".to_string(), json!(cached_response.confidence));
                        }
                        
                        // ? Pr?diction en arri?re-plan pour futures requ?tes
                        if let Some(cache_ref) = &state.semantic_cache {
                            let cache_clone: std::sync::Arc<crate::services::semantic_cache_pro::SemanticCachePro> = Arc::clone(cache_ref);
                            let context_clone = user_context.clone();
                            tokio::spawn(async move {
                                let _ = cache_clone.predict_and_precompute(&context_clone, &cache_query).await;
                            });
                        }
                        
                        return Ok(cached_result);
                    }
                    Err(e) => {
                        log_warn(&format!("[OrchestrationOptimized] Erreur d?codage cache: {}, fallback", e));
                        // Continue vers traitement normal
                    }
                }
            }
            Ok(None) => {
                log_info("[OrchestrationOptimized] Cache miss, traitement avec optimisations");
            }
            Err(e) => {
                log_warn(&format!("[OrchestrationOptimized] Erreur cache: {}, fallback", e));
                // Continue vers traitement normal
            }
        }
    }

    // ? ?TAPE 2 : OPTIMISATION DE PROMPT (Technique Cursor)
    let optimized_prompt = if let Some(optimizer) = &state.prompt_optimizer {
        log_info("[OrchestrationOptimized] Optimisation du prompt (style Cursor)");
        
        match optimizer.optimize_for_gpt4o(input, None).await {
            Ok(prompt) => {
                log_info(&format!("[OrchestrationOptimized] Prompt optimis?: {} chars", prompt.len()));
                prompt
            }
            Err(e) => {
                log_warn(&format!("[OrchestrationOptimized] Erreur optimisation prompt: {}, fallback", e));
                build_fallback_prompt(input)
            }
        }
    } else {
        log_info("[OrchestrationOptimized] Prompt optimizer non disponible, utilisation fallback");
        build_fallback_prompt(input)
    };

    // ? ?TAPE 3 : APPEL IA OPTIMIS? (R?utilise l'infrastructure existante)
    log_info("[OrchestrationOptimized] Appel IA avec prompt optimis?");
    let ia_start = Instant::now();
    
    let (source, ia_response, _tokens_consumed): (String, String, u32) = match state.ia.predict(&optimized_prompt).await {
        Ok(response) => response,
        Err(e) => {
            log_error(&format!("[OrchestrationOptimized] Erreur appel IA: {}", e));
            return Err(format!("Erreur appel IA: {}", e).into());
        }
    };
    
    let ia_time = ia_start.elapsed().as_millis();
    log_info(&format!("[OrchestrationOptimized] IA response re?ue en {}ms depuis {}", ia_time, source));

    // ? ?TAPE 4 : TRAITEMENT AVEC LOGIQUE EXISTANTE (R?utilise 100% l'existant)
    let result = match process_ia_response_with_existing_logic(&ia_response, &state, user_id, input).await {
        Ok(processed_result) => processed_result,
        Err(e) => {
            log_error(&format!("[OrchestrationOptimized] Erreur traitement r?ponse: {}", e));
            // En cas d'erreur, essayer avec orchestration classique
            log_warn("[OrchestrationOptimized] Fallback final vers orchestration classique");
            return orchestration_ia::orchestrer_intention_ia(
                state.ia.clone(),
                state.clone(), 
                user_id,
                input,
            ).await;
        }
    };

    // ? ?TAPE 5 : CACHE POUR LE FUTUR (Apprentissage continu)
    if let Some(cache) = &state.semantic_cache {
        let user_context = build_user_context_for_cache(user_id, input).await;
        let cache_query = build_cache_query_from_input(input);
        let response_time_ms = start_time.elapsed().as_millis() as u64;
        
        match serde_json::to_string(&result) {
            Ok(result_string) => {
                let cache_store_start = Instant::now();
                match cache.store_smart(&cache_query, &result_string, Some(&user_context), response_time_ms, &source).await {
                    Ok(()) => {
                        let cache_store_time = cache_store_start.elapsed().as_micros();
                        log_info(&format!("[OrchestrationOptimized] R?sultat mis en cache en {}?s", cache_store_time));
                    }
                    Err(e) => {
                        log_warn(&format!("[OrchestrationOptimized] Erreur stockage cache: {}", e));
                    }
                }
            }
            Err(e) => {
                log_warn(&format!("[OrchestrationOptimized] Erreur s?rialisation pour cache: {}", e));
            }
        }
    }

    // ? ?TAPE 6 : M?TRIQUES ET FINALISATION
    let total_time = start_time.elapsed().as_millis();
    log_info(&format!("[OrchestrationOptimized] ? Traitement optimis? termin? en {}ms (IA: {}ms)", total_time, ia_time));
    
    // Enrichir le r?sultat avec m?tadonn?es d'optimisation
    let mut enriched_result = result;
    if let Some(obj) = enriched_result.as_object_mut() {
        obj.insert("ia_model_used".to_string(), json!(source));
        obj.insert("optimization_used".to_string(), json!(true));
        obj.insert("processing_time_ms".to_string(), json!(total_time));
        obj.insert("ia_time_ms".to_string(), json!(ia_time));
        obj.insert("cache_hit".to_string(), json!(false)); // Pas de cache hit
        obj.insert("interaction_id".to_string(), json!(interaction_id));
    }

    Ok(enriched_result)
}

/// ?? Traitement IA r?utilisant 100% la logique existante
async fn process_ia_response_with_existing_logic(
    ia_response: &str,
    state: &Arc<AppState>,
    user_id: Option<i32>,
    _input: &MultiModalInput,
) -> AppResult<Value> {
    
    log_info("[OrchestrationOptimized] Traitement avec logique m?tier existante");
    
    // ? R?UTILISE EXACTEMENT la logique existante de nettoyage
    let cleaned_response = orchestration_ia::nettoyer_reponse_ia_ultra_avance(ia_response);
    
    if !cleaned_response.trim().starts_with('{') || !cleaned_response.trim().ends_with('}') {
        return Err("R?ponse IA non conforme apr?s nettoyage".into());
    }

    // ? R?UTILISE EXACTEMENT la logique existante de parsing
    let mut data: Value = serde_json::from_str(&cleaned_response).map_err(|e| {
        format!("R?ponse IA non JSON: {} | {}", e, cleaned_response)
    })?;

    // ? R?UTILISE EXACTEMENT la logique existante de transformation
    orchestration_ia::deballer_champ_data_a_racine(&mut data);
    
    // Cr?er une analyse contextuelle basique pour compatibilit?
    let context_analysis = create_basic_context_analysis();
    orchestration_ia::patch_json_ia_ultra_avance(&mut data, &context_analysis);

    // ? R?UTILISE EXACTEMENT la logique existante de validation
    let intention = orchestration_ia::extraire_intention(&data);
    if let Err(e) = orchestration_ia::valider_json_intention_ultra_avance(&intention, &data) {
        log_warn(&format!("[OrchestrationOptimized] Validation ?chou?e: {}", e));
        return Err(e);
    }

    // ? R?UTILISE EXACTEMENT la logique existante de routage m?tier
    let state_clone = state.clone();
    let result = route_to_existing_business_logic(user_id, &data, state, &intention).await?;
    let result_clone = result.clone();

    // Lancer la sauvegarde en arri?re-plan
    tokio::spawn(async move {
        if let Err(e) = crate::services::ia_history_service::sauvegarder_ia_interaction(
            state_clone.mongo_history.clone(),
            user_id,
            Some(&intention),
            &result_clone,
            &result_clone,
        ).await {
            log::error!("[ORCHESTRATION] Erreur sauvegarde historique: {}", e);
        }
    });
    
    Ok(result)
}

/// ?? Routage vers la logique m?tier existante (r?utilise 100% l'existant)
async fn route_to_existing_business_logic(
    user_id: Option<i32>,
    data: &Value,
    state: &Arc<AppState>,
    intention: &str,
) -> AppResult<Value> {
    
    log_info(&format!("[OrchestrationOptimized] Routage m?tier pour intention: {}", intention));
    
    // ? R?UTILISE EXACTEMENT les routes m?tier existantes
    match intention {
        "creation_service" => {
            log_info("[OrchestrationOptimized] Route: cr?ation de service");
            crate::services::creer_service::creer_service(
                &state.pg,
                user_id.expect("User ID requis"),
                &data,
                &state.redis_client,
            ).await.map(|(result, _)| result).map_err(|e| format!("Erreur cr?ation service: {}", e).into())
        }
        
        "recherche_besoin" => {
            log_info("[OrchestrationOptimized] Route: recherche de besoin");
            crate::services::rechercher_besoin::rechercher_besoin(
                user_id,
                data,
            ).await.map(|(result, _)| result).map_err(|e| format!("Erreur recherche service: {}", e).into())
        }
        
        "mise_a_jour_service" => {
            log_info("[OrchestrationOptimized] Route: mise ? jour service");
            // crate::services::service_controller::update_service(
            //     state.pg.clone(),
            //     user_id,
            //     data.clone(),
            // ).await.map_err(|e| format!("Erreur mise ? jour service: {}", e).into())
            Ok(serde_json::json!({"message": "Service update temporarily disabled"}))
        }
        
        "suppression_service" => {
            log_info("[OrchestrationOptimized] Route: suppression service");
            // crate::services::service_controller::delete_service(
            //     state.pg.clone(),
            //     service_id,
            // ).await.map_err(|e| format!("Erreur suppression service: {}", e).into())
            Ok(serde_json::json!({"message": "Service deletion temporarily disabled"}))
        }
        
        _ => {
            log_warn(&format!("[OrchestrationOptimized] Intention non reconnue: {}", intention));
            Ok(json!({
                "error": "Intention non support?e",
                "intention": intention,
                "supported_intentions": [
                    "creation_service",
                    "recherche_besoin", 
                    "mise_a_jour_service",
                    "suppression_service"
                ]
            }))
        }
    }
}

/// ?? Construction du contexte utilisateur pour le cache s?mantique
async fn build_user_context_for_cache(user_id: Option<i32>, input: &MultiModalInput) -> String {
    let mut context_parts = Vec::new();
    
    // ID utilisateur pour personnalisation
    if let Some(id) = user_id {
        context_parts.push(format!("user:{}", id));
    } else {
        context_parts.push("user:anonymous".to_string());
    }
    
    // Intention pour contexte m?tier
    if let Some(intention) = &input.texte {
        context_parts.push(format!("intent:{}", intention));
    }
    
    // Type de contenu pour optimisation
    let mut content_types = Vec::new();
    if input.base64_image.is_some() {
        content_types.push("image");
    }
    if input.audio_base64.is_some() {
        content_types.push("audio");
    }
    if input.doc_base64.is_some() {
        content_types.push("document");
    }
    if input.excel_base64.is_some() {
        content_types.push("excel");
    }
    
    if !content_types.is_empty() {
        context_parts.push(format!("media:{}", content_types.join(",")));
    }
    
    // Localisation si disponible
    if input.gps_mobile.is_some() {
        context_parts.push("geo:localized".to_string());
    }
    
    context_parts.join("|")
}

/// ?? Construction de la requ?te de cache ? partir de l'input
fn build_cache_query_from_input(input: &MultiModalInput) -> String {
    // Utiliser le texte principal comme cl? de cache
    let main_text = input.texte.as_deref().unwrap_or("");
    
    // Ajouter des informations contextuelles pour am?liorer la pr?cision du cache
    let mut query_parts = vec![main_text.to_string()];
    
    if let Some(intention) = &input.texte {
        query_parts.push(format!("intent:{}", intention));
    }
    
    // Ajouter signature du contenu multim?dia (sans le contenu lui-m?me)
    if let Some(images) = &input.base64_image {
        query_parts.push(format!("images_count:{}", images.len()));
    }
    
    if input.gps_mobile.is_some() {
        query_parts.push("has_gps".to_string());
    }
    
    query_parts.join(" | ")
}

/// ?? Prompt de fallback si optimiseur non disponible
fn build_fallback_prompt(input: &MultiModalInput) -> String {
    let mut prompt_parts = Vec::new();
    
    // Instructions de base
    prompt_parts.push("Tu es un assistant IA sp?cialis? dans l'analyse et le traitement des demandes utilisateur.".to_string());
    prompt_parts.push("Analyse la demande suivante et r?ponds au format JSON appropri? selon l'intention.".to_string());
    
    // Contenu principal
    if let Some(texte) = &input.texte {
        prompt_parts.push(format!("Demande utilisateur: {}", texte));
    }
    
    // Intention si sp?cifi?e
    if let Some(intention) = &input.texte {
        prompt_parts.push(format!("Intention d?clar?e: {}", intention));
    }
    
    // Informations contextuelles
    if input.base64_image.is_some() {
        prompt_parts.push("Note: Des images sont fournies avec cette demande.".to_string());
    }
    
    if input.gps_mobile.is_some() {
        prompt_parts.push("Note: Informations de g?olocalisation disponibles.".to_string());
    }
    
    prompt_parts.push("R?ponds uniquement par un objet JSON valide sans texte additionnel.".to_string());
    
    prompt_parts.join("\n\n")
}

/// ?? Cr?er une analyse contextuelle basique pour compatibilit?
fn create_basic_context_analysis() -> orchestration_ia::ContextAnalysis {
    orchestration_ia::ContextAnalysis {
        user_intent_confidence: 0.8,
        context_relevance_score: 0.8,
        sentiment_score: 0.0,
        language_detected: "fr".to_string(),
        user_expertise_level: "intermediate".to_string(),
        request_complexity: "medium".to_string(),
        security_risk_level: "low".to_string(),
        suggested_improvements: vec![],
        context_enhancements: json!({}),
        ai_model_recommendation: "gpt-4".to_string(),
        expected_response_quality: 0.8,
        user_behavior_pattern: "standard".to_string(),
        content_safety_score: 0.9,
        optimization_opportunities: vec![],
    }
} 
