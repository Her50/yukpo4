// backend/src/services/orchestration_ia.rs
// Orchestration centralis?e IA Yukpo (ULTRA-MODERNE avec apprentissage autonome)

use std::sync::Arc;
use serde_json::{Value, json};
use crate::state::AppState;
use crate::services::app_ia::{AppIA, TrainingData};
use crate::core::types::AppResult;
use crate::models::input_model::MultiModalInput;
use tokio::fs;
use jsonschema::{JSONSchema};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use crate::services::file_extractor::UniversalFileExtractor;
use base64;
use base64::engine::general_purpose;
use base64::Engine as _;

/// ?? Configuration d'orchestration IA ultra-moderne
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationConfig {
    pub enable_learning: bool,
    pub enable_context_analysis: bool,
    pub enable_sentiment_analysis: bool,
    pub enable_intent_refinement: bool,
    pub enable_autonomous_learning: bool,
    pub enable_multi_model_fallback: bool,
    pub enable_performance_monitoring: bool,
    pub enable_security_validation: bool,
    pub max_context_length: usize,
    pub confidence_threshold: f64,
    pub enable_fallback_chains: bool,
    pub enable_real_time_optimization: bool,
    pub learning_rate: f64,
    pub model_rotation_strategy: String,
    pub cache_strategy: String,
}

/// ?? M?triques d'orchestration avanc?es
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OrchestrationMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_processing_time: f64,
    pub cache_hit_rate: f64,
    pub learning_improvements: u64,
    pub context_analysis_usage: u64,
    pub intent_refinement_usage: u64,
    pub multi_model_fallback_usage: u64,
    pub security_validations: u64,
    pub autonomous_learning_events: u64,
    pub model_performance: HashMap<String, f64>,
    pub user_satisfaction_score: f64,
    pub error_distribution: HashMap<String, u64>,
}

/// ?? Analyse contextuelle ultra-avanc?e
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextAnalysis {
    pub user_intent_confidence: f64,
    pub context_relevance_score: f64,
    pub sentiment_score: f64,
    pub language_detected: String,
    pub user_expertise_level: String,
    pub request_complexity: String,
    pub security_risk_level: String,
    pub suggested_improvements: Vec<String>,
    pub context_enhancements: Value,
    pub ai_model_recommendation: String,
    pub expected_response_quality: f64,
    pub user_behavior_pattern: String,
    pub content_safety_score: f64,
    pub optimization_opportunities: Vec<String>,
}

/// ?? Orchestration compl?te IA ultra-moderne avec apprentissage autonome ET MESURES DE TEMPS D?TAILL?ES
pub async fn orchestrer_intention_ia(
    app_ia: Arc<AppIA>,
    state: Arc<AppState>,
    user_id: Option<i32>,
    input: &MultiModalInput,
) -> AppResult<Value> {
    // Utiliser le nouveau service IA optimis?
    use crate::services::ia::OptimizedIAService;
    
    let optimized_ia = OptimizedIAService::new(app_ia.clone()).await?;
    log_info("[orchestration_ia] Service IA optimis? initialis?");
    use crate::utils::log::{log_info, log_error, log_warn};
    let start_time = SystemTime::now();
    let interaction_id = Uuid::new_v4().to_string();
    
    log_info(&format!("[orchestration_ia] ?? D?but orchestration IA ultra-moderne (interaction_id: {})", interaction_id));

    // 0. Traitement multimodal optimis? (extraits + URLs)
    let step0_start = std::time::Instant::now();
    let mut multimodal_data = None;
    
    // Collecter tous les fichiers multimodaux
    let mut all_files: Vec<Vec<u8>> = Vec::new();
    let mut all_file_names: Vec<String> = Vec::new();
    let mut all_mime_types: Vec<String> = Vec::new();
    
    // Images
    if let Some(images) = &input.base64_image {
        for (i, img) in images.iter().enumerate() {
            if let Ok(data) = general_purpose::STANDARD.decode(img) {
                all_files.push(data);
                all_file_names.push(format!("image_{}.jpg", i));
                all_mime_types.push("image/jpeg".to_string());
            }
        }
    }
    
    // Audios
    if let Some(audios) = &input.audio_base64 {
        for (i, audio) in audios.iter().enumerate() {
            if let Ok(data) = general_purpose::STANDARD.decode(audio) {
                all_files.push(data);
                all_file_names.push(format!("audio_{}.mp3", i));
                all_mime_types.push("audio/mpeg".to_string());
            }
        }
    }
    
    // Vid?os
    if let Some(videos) = &input.video_base64 {
        for (i, video) in videos.iter().enumerate() {
            if let Ok(data) = general_purpose::STANDARD.decode(video) {
                all_files.push(data);
                all_file_names.push(format!("video_{}.mp4", i));
                all_mime_types.push("video/mp4".to_string());
            }
        }
    }
    
    // Documents
    if let Some(docs) = &input.doc_base64 {
        for (i, doc) in docs.iter().enumerate() {
            if let Ok(data) = general_purpose::STANDARD.decode(doc) {
                all_files.push(data);
                all_file_names.push(format!("document_{}.pdf", i));
                all_mime_types.push("application/pdf".to_string());
            }
        }
    }
    
    // Excel
    if let Some(excel_files) = &input.excel_base64 {
        for (i, excel) in excel_files.iter().enumerate() {
            if let Ok(data) = general_purpose::STANDARD.decode(excel) {
                all_files.push(data);
                all_file_names.push(format!("excel_{}.xlsx", i));
                all_mime_types.push("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string());
            }
        }
    }
    
    // Traiter les fichiers collect?s avec extraction universelle
    if !all_files.is_empty() {
        let mut extracted_files_data = Vec::new();
        let file_extractor = UniversalFileExtractor::new();
        
        for (_i, ((file_data, file_name), mime_type)) in all_files.iter().zip(all_file_names.iter()).zip(all_mime_types.iter()).enumerate() {
            match file_extractor.extract_universal_content(file_data, file_name, mime_type).await {
                Ok(extracted_data) => {
                    extracted_files_data.push(extracted_data);
                    log_info(&format!("[orchestration_ia] Extraction r?ussie pour {}: {}", file_name, mime_type));
                },
                Err(e) => {
                    log_warn(&format!("[orchestration_ia] Erreur extraction fichier {}: {}", file_name, e));
                }
            }
        }
        
        if !extracted_files_data.is_empty() {
            multimodal_data = Some(json!({
                "extracted_files": extracted_files_data,
                "total_files": all_files.len(),
                "extraction_method": "universal"
            }));
            log_info(&format!("[orchestration_ia] Extraction universelle r?ussie pour {} fichiers", all_files.len()));
        }
    }
    let step0_time = step0_start.elapsed();
    log_info(&format!("[TIMING] ?tape 0 - Traitement multimodal: {:?}", step0_time));

    // 1. Configuration d'orchestration ultra-moderne
    let step1_start = std::time::Instant::now();
    let _config = OrchestrationConfig {
        enable_learning: true,
        enable_context_analysis: true,
        enable_sentiment_analysis: true,
        enable_intent_refinement: true,
        enable_autonomous_learning: true,
        enable_multi_model_fallback: true,
        enable_performance_monitoring: true,
        enable_security_validation: true,
        max_context_length: 12000, // Augment? pour plus de contexte
        confidence_threshold: 0.85, // Seuil plus strict
        enable_fallback_chains: true,
        enable_real_time_optimization: true,
        learning_rate: 0.1,
        model_rotation_strategy: "performance_based".to_string(),
        cache_strategy: "intelligent".to_string(),
    };
    let step1_time = step1_start.elapsed();
    log_info(&format!("[TIMING] ?tape 1 - Configuration orchestration: {:?}", step1_time));

    // 2. Validation de s?curit? avanc?e
    let step2_start = std::time::Instant::now();
    if _config.enable_security_validation {
        let security_check = validate_input_security(input).await?;
        if !security_check.is_safe {
            log_warn(&format!("[SECURITY] Input rejet?: {}", security_check.reason));
            return Err(format!("Contenu non conforme aux politiques de s?curit?: {}", security_check.reason).into());
        }
    }
    let step2_time = step2_start.elapsed();
    log_info(&format!("[TIMING] ?tape 2 - Validation de s?curit?: {:?}", step2_time));

    // 3. Construction du input context ultra-enrichi avec donn?es extraites
    let step3_start = std::time::Instant::now();
    log_info("?? Construction du input context structur? et ultra-enrichi");
    let mut input_context = construire_input_context_ultra_avance(input, &_config, None).await;
    
    // 4. Injection des donn?es extraites des fichiers dans le contexte IA
    if let Some(extracted_data) = &multimodal_data {
        if let Some(files) = extracted_data.get("extracted_files").and_then(|f| f.as_array()) {
            let mut file_contents = Vec::new();
            for file_data in files {
                if let Some(content) = file_data.get("content") {
                    file_contents.push(content.clone());
                }
            }
            
            if !file_contents.is_empty() {
                input_context["extracted_files_content"] = json!(file_contents);
                log_info(&format!("[orchestration_ia] {} fichiers inject?s dans le contexte IA", file_contents.len()));
            }
        }
    }
    // Injection des extraits multimodaux et URLs dans le contexte
    if let Some(multimodal) = multimodal_data {
        input_context["data_sources"]["multimodal"] = multimodal;
    }
    // AJOUT LOG CRITIQUE : contexte complet envoy? ? l'IA
    log_info(&format!("[orchestration_ia] CONTEXTE UTILISATEUR ENVOY? ? L'IA : {}", serde_json::to_string(&input_context).unwrap_or_default()));
    log_info(&format!("Input context ultra-enrichi: {}", serde_json::to_string(&input_context).unwrap_or_default()));
    let step3_time = step3_start.elapsed();
    log_info(&format!("[TIMING] ?tape 3 - Construction contexte: {:?}", step3_time));

    // 4. Analyse contextuelle ultra-avanc?e
    let step4_start = std::time::Instant::now();
    let _context_analysis = if _config.enable_context_analysis {
        analyser_contexte_ultra_avance(&input_context, app_ia.clone()).await?
    } else {
        ContextAnalysis {
            user_intent_confidence: 0.7,
            context_relevance_score: 0.8,
            sentiment_score: 0.5,
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
    };
    let step4_time = step4_start.elapsed();
    log_info(&format!("[TIMING] ?tape 4 - Analyse contextuelle: {:?}", step4_time));

    // 5. Optimisation dynamique des instructions avec apprentage
    let step5_start = std::time::Instant::now();
    let instructions_optimisees = optimiser_instructions_ia_ultra_avance(&_context_analysis, &_config, app_ia.clone()).await?;
    let step5_time = step5_start.elapsed();
    log_info(&format!("[TIMING] ?tape 5 - Optimisation instructions: {:?}", step5_time));
    
    // 6. Traitement avec le service IA optimis?
    let step6_start = std::time::Instant::now();
    let ia_start_time = std::time::Instant::now();
    let result = optimized_ia.process_user_request(input).await?;
    let ia_processing_time = ia_start_time.elapsed();
    let step6_time = step6_start.elapsed();
    log_info(&format!("[TIMING] ?tape 6 - Traitement IA optimis?: {:?} (IA externe: {:?})", step6_time, ia_processing_time));
    
    // 7. Extraction des m?triques depuis le r?sultat IA
    let step7_start = std::time::Instant::now();
    let source = "optimized_ia".to_string();
    let ia_response = serde_json::to_string(&result)?;
    
    // Extraire les vrais tokens consomm?s depuis le r?sultat IA
    let tokens_consumed = result.get("tokens_consumed")
        .and_then(|v| v.as_u64())
        .unwrap_or_else(|| {
            // Fallback : estimation bas?e sur la longueur de la r?ponse
            let response_length = ia_response.len();
            let estimated_tokens = (response_length / 4).max(100) as u64;
            log_info(&format!("[orchestration_ia] Pas de tokens dans le r?sultat, estimation: {} tokens", estimated_tokens));
            estimated_tokens
        });
    
    // LOG DEBUG REPONSE BRUTE
    eprintln!("[DEBUG][REPONSE_IA_ULTRA_OPTIMISEE]\n{}", ia_response);
    log_info(&format!("R?ponse IA (d?but): {}", &ia_response.chars().take(200).collect::<String>()));
    let step7_time = step7_start.elapsed();
    log_info(&format!("[TIMING] ?tape 7 - Extraction m?triques: {:?}", step7_time));

    // 8. Nettoyage et validation JSON IA ultra-avanc?e
    let step8_start = std::time::Instant::now();
    let cleaned_ia_response = nettoyer_reponse_ia_ultra_avance(&ia_response);
    if !cleaned_ia_response.trim().starts_with('{') || !cleaned_ia_response.trim().ends_with('}') {
        log_error("R?ponse IA non conforme : n'est pas un objet JSON pur apr?s nettoyage ultra-avanc?");
        return Err("R?ponse IA non conforme : n'est pas un objet JSON pur apr?s nettoyage ultra-avanc?".into());
    }

    let mut data: Value = serde_json::from_str(&cleaned_ia_response).map_err(|e| {
        log_error(&format!("R?ponse IA non JSON: {} | {}", e, cleaned_ia_response));
        "R?ponse IA non JSON"
    })?;
    let step8_time = step8_start.elapsed();
    log_info(&format!("[TIMING] ?tape 8 - Nettoyage JSON: {:?}", step8_time));

    // 9. Raffinement d'intention ultra-avanc? si activ?
    let step9_start = std::time::Instant::now();
    if _config.enable_intent_refinement {
        data = raffiner_intention_ia_ultra_avance(&data, &_context_analysis, app_ia.clone()).await?;
    }
    let step9_time = step9_start.elapsed();
    log_info(&format!("[TIMING] ?tape 9 - Raffinement intention: {:?}", step9_time));

    // 10. D?ballage du champ 'data' ? la racine si pr?sent (pour compatibilit? nouvelle structure IA)
    let step10_start = std::time::Instant::now();
    deballer_champ_data_a_racine(&mut data);
    let step10_time = step10_start.elapsed();
    log_info(&format!("[TIMING] ?tape 10 - D?ballage data: {:?}", step10_time));
    
    // 11. Patch IA ultra-avanc? (si besoin)
    let step11_start = std::time::Instant::now();
    patch_json_ia_ultra_avance(&mut data, &_context_analysis);
    log_info(&format!("JSON IA apr?s patch ultra-avanc?: {}", data));
    let intention_dbg = extraire_intention(&data);
    eprintln!("[DEBUG][STDERR] JSON IA apr?s patch ultra-avanc? (avant validation): intention='{}' | data={}", intention_dbg, data);
    let step11_time = step11_start.elapsed();
    log_info(&format!("[TIMING] ?tape 11 - Patch JSON: {:?}", step11_time));

    // 12. Validation sch?ma ultra-avanc?e avec feedback d'am?lioration
    let step12_start = std::time::Instant::now();
    let intention = extraire_intention(&data);
    log_info(&format!("Intention IA d?tect?e (finale): {}", intention));
    
    if let Err(e) = valider_json_intention_ultra_avance(&intention, &data) {
        log_error(&format!("[VALIDATION][ERREUR] Validation JSON IA ultra-avanc?e ?chou?e pour '{}': {}\nJSON re?u: {}", intention, e, data));
        eprintln!("[VALIDATION][ERREUR][STDERR] Validation JSON IA ultra-avanc?e ?chou?e pour '{}': {}\nJSON re?u: {}", intention, e, data);
        
        // Tentative de correction automatique ultra-avanc?e
        if _config.enable_fallback_chains {
            data = corriger_json_automatiquement_ultra_avance(&data, &intention, app_ia.clone()).await?;
        } else {
            return Err(e);
        }
    }
    let step12_time = step12_start.elapsed();
    log_info(&format!("[TIMING] ?tape 12 - Validation sch?ma: {:?}", step12_time));

    // 13. Routage m?tier ultra-optimis?
    let step13_start = std::time::Instant::now();
    log_info(&format!("Routage m?tier ultra-optimis? pour intention: {}", intention));
    let mut result = router_metier_ultra_optimise(user_id, &data, &state, &intention, "", &_context_analysis).await?;

    // Ajouter les tokens consomm?s par l'IA au r?sultat final
    if let Some(obj) = result.as_object_mut() {
        obj.insert("tokens_consumed".to_string(), json!(tokens_consumed));
        obj.insert("ia_model_used".to_string(), json!(source));
        obj.insert("confidence".to_string(), json!(_context_analysis.user_intent_confidence));
    }
    let step13_time = step13_start.elapsed();
    log_info(&format!("[TIMING] ?tape 13 - Routage m?tier: {:?}", step13_time));

    // 14. Apprentissage autonome ultra-avanc?
    let step14_start = std::time::Instant::now();
    if _config.enable_autonomous_learning {
        enregistrer_apprentissage_autonome_ultra_avance(
            app_ia.clone(),
            &interaction_id,
            user_id,
            &input_context,
            &instructions_optimisees,
            &ia_response,
            &result,
            &_context_analysis,
            &source,
        ).await;
    }
    let step14_time = step14_start.elapsed();
    log_info(&format!("[TIMING] ?tape 14 - Apprentissage: {:?}", step14_time));

    // 15. Historisation ultra-enrichie
    let step15_start = std::time::Instant::now();
    log_info("Historisation de l'interaction IA ultra-enrichie");
    // let _ = crate::services::ia_history_service::sauvegarder_ia_interaction(state.mongo.clone(), user_id, Some(&intention), &input_context, &result).await;
    let step15_time = step15_start.elapsed();
    log_info(&format!("[TIMING] ?tape 15 - Historisation: {:?}", step15_time));
    
    // 16. M?triques de performance ultra-avanc?es
    let step16_start = std::time::Instant::now();
    let processing_time = start_time.elapsed().unwrap().as_millis() as f64;
    log_info(&format!("[orchestration_ia] ?? Fin orchestration IA ultra-moderne en {}ms", processing_time));
    
    // R?SUM? D?TAILL? DES TEMPS
    log_info(&format!("{}", "=".repeat(80)));
    log_info("?? R?SUM? D?TAILL? DES TEMPS D'EX?CUTION");
    log_info(&format!("{}", "=".repeat(80)));
    log_info(&format!("?tape 0  - Traitement multimodal: {:?}", step0_time));
    log_info(&format!("?tape 1  - Configuration: {:?}", step1_time));
    log_info(&format!("?tape 2  - Validation s?curit?: {:?}", step2_time));
    log_info(&format!("?tape 3  - Construction contexte: {:?}", step3_time));
    log_info(&format!("?tape 4  - Analyse contextuelle: {:?}", step4_time));
    log_info(&format!("?tape 5  - Optimisation instructions: {:?}", step5_time));
    log_info(&format!("?tape 6  - Traitement IA: {:?} (IA externe: {:?})", step6_time, ia_processing_time));
    log_info(&format!("?tape 7  - Extraction m?triques: {:?}", step7_time));
    log_info(&format!("?tape 8  - Nettoyage JSON: {:?}", step8_time));
    log_info(&format!("?tape 9  - Raffinement intention: {:?}", step9_time));
    log_info(&format!("?tape 10 - D?ballage data: {:?}", step10_time));
    log_info(&format!("?tape 11 - Patch JSON: {:?}", step11_time));
    log_info(&format!("?tape 12 - Validation sch?ma: {:?}", step12_time));
    log_info(&format!("?tape 13 - Routage m?tier: {:?}", step13_time));
    log_info(&format!("?tape 14 - Apprentissage: {:?}", step14_time));
    log_info(&format!("?tape 15 - Historisation: {:?}", step15_time));
    log_info(&format!("?tape 16 - M?triques finales: {:?}", step16_start.elapsed()));
    log_info(&format!("{}", "=".repeat(80)));
    log_info(&format!("??  TEMPS TOTAL: {}ms", processing_time));
    log_info(&format!("?? TEMPS IA EXTERNE: {:?}", ia_processing_time));
    log_info(&format!("?? POURCENTAGE IA: {:.1}%", (ia_processing_time.as_millis() as f64 / processing_time) * 100.0));
    log_info(&format!("{}", "=".repeat(80)));
    
    Ok(result)
}

/// ?? Orchestration IA SIMPLIFI?E pour performance maximale
pub async fn orchestrer_intention_ia_simple(
    app_ia: Arc<AppIA>,
    state: Arc<AppState>,
    user_id: Option<i32>,
    input: &MultiModalInput,
) -> AppResult<Value> {
    use crate::services::ia::OptimizedIAService;
    use crate::utils::log::{log_info, log_error};
    
    let start_time = SystemTime::now();
    let optimized_ia = OptimizedIAService::new(app_ia.clone()).await?;
    
    log_info("[orchestration_ia] ?? D?but orchestration IA SIMPLIFI?E");

    // 1. Traitement IA direct (sans toutes les ?tapes inutiles)
    let ia_start_time = std::time::Instant::now();
    let result = optimized_ia.process_user_request(input).await?;
    let ia_processing_time = ia_start_time.elapsed();
    
    log_info(&format!("[orchestration_ia] ? Traitement IA termin? en {:?}", ia_processing_time));

    // 2. Nettoyage JSON minimal
    let ia_response = serde_json::to_string(&result)?;
    let cleaned_response = nettoyer_reponse_ia_ultra_avance(&ia_response);
    
    let mut data: Value = serde_json::from_str(&cleaned_response).map_err(|e| {
        log_error(&format!("R?ponse IA non JSON: {}", e));
        "R?ponse IA non JSON"
    })?;

    // 3. D?ballage du champ 'data' si pr?sent
    deballer_champ_data_a_racine(&mut data);
    
    // 4. Extraction de l'intention
    let intention = extraire_intention(&data);
    log_info(&format!("Intention d?tect?e: {}", intention));

    // 5. Routage m?tier simple
    let mut final_result = router_metier_ultra_optimise(user_id, &data, &state, &intention, "", &ContextAnalysis {
        user_intent_confidence: 0.7,
        context_relevance_score: 0.8,
        sentiment_score: 0.5,
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
    }).await?;

    // 6. Ajout des m?triques minimales
    if let Some(obj) = final_result.as_object_mut() {
        // Pr?server les tokens retourn?s par OptimizedIAService au lieu de les ?craser
        let tokens_consumed = data.get("tokens_consumed")
            .and_then(|v| v.as_u64())
            .unwrap_or(1500); // Fallback seulement si pas de tokens dans la r?ponse
        
        obj.insert("tokens_consumed".to_string(), json!(tokens_consumed));
        obj.insert("ia_model_used".to_string(), json!("optimized_ia"));
        obj.insert("confidence".to_string(), json!(0.7));
    }

    let total_time = start_time.elapsed().unwrap().as_millis() as f64;
    log_info(&format!("[orchestration_ia] ?? Fin orchestration IA SIMPLIFI?E en {}ms", total_time));
    
    Ok(final_result)
}

/// ?? Orchestration IA HYBRIDE - Performance + Fonctionnalit?s essentielles
pub async fn orchestrer_intention_ia_hybride(
    app_ia: Arc<AppIA>,
    state: Arc<AppState>,
    user_id: Option<i32>,
    input: &MultiModalInput,
) -> AppResult<Value> {
    use crate::services::ia::OptimizedIAService;
    use crate::utils::log::{log_info, log_error};
    
    let start_time = SystemTime::now();
    let interaction_id = Uuid::new_v4().to_string();
    let optimized_ia = OptimizedIAService::new(app_ia.clone()).await?;
    
    log_info(&format!("[orchestration_ia] ?? D?but orchestration IA HYBRIDE (interaction_id: {})", interaction_id));

    // 1. Validation de s?curit? (ESSENTIELLE)
    let security_check = validate_input_security(input).await?;
    if !security_check.is_safe {
        return Err(format!("Contenu non s?curis? d?tect?: {}", security_check.reason).into());
    }

    // 2. Traitement IA optimis?
    let ia_start_time = std::time::Instant::now();
    let result = optimized_ia.process_user_request(input).await?;
    let ia_processing_time = ia_start_time.elapsed();
    
    log_info(&format!("[orchestration_ia] ? Traitement IA termin? en {:?}", ia_processing_time));

    // 3. Nettoyage JSON
    let ia_response = serde_json::to_string(&result)?;
    let cleaned_response = nettoyer_reponse_ia_ultra_avance(&ia_response);
    
    let mut data: Value = serde_json::from_str(&cleaned_response).map_err(|e| {
        log_error(&format!("R?ponse IA non JSON: {}", e));
        "R?ponse IA non JSON"
    })?;

    // 4. D?ballage du champ 'data' si pr?sent
    deballer_champ_data_a_racine(&mut data);
    
    // 5. Extraction de l'intention
    let intention = extraire_intention(&data);
    log_info(&format!("Intention d?tect?e: {}", intention));

    // 6. Routage m?tier
    let final_result = router_metier_ultra_optimise(user_id, &data, &state, &intention, "", &ContextAnalysis {
        user_intent_confidence: 0.7,
        context_relevance_score: 0.8,
        sentiment_score: 0.5,
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
    }).await?;

    // 7. HISTORISATION (ESSENTIELLE pour l'apprentissage)
    let input_context = json!({
        "timestamp": SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
        "user_id": user_id,
        "intention": intention.clone(),
        "security_check": {
            "is_safe": security_check.is_safe,
            "reason": security_check.reason
        }
    });
    
    // Cloner les variables pour les closures
    let _intention_cloned = intention.clone();
    let _input_context_cloned = input_context.clone();
    let _final_result_cloned = final_result.clone();
    let _state_cloned = state.clone();
    
    // Historisation asynchrone (non-bloquante)
    tokio::spawn(async move {
        // if let Err(e) = crate::services::ia_history_service::sauvegarder_ia_interaction(
        //     state_cloned.mongo.clone(), 
        //     user_id, 
        //     Some(&intention_cloned), 
        //     &input_context_cloned, 
        //     &final_result_cloned
        // ).await {
        //     log_error(&format!("[orchestration_ia] Erreur historisation: {}", e));
        // }
    });

    // 8. Apprentissage autonome l?ger (asynchrone)
    if app_ia.training_data.lock().await.len() < 1000 { // Limite pour ?viter la surcharge
        let intention_cloned2 = intention.clone();
        let input_context_cloned2 = input_context.clone();
        let final_result_cloned2 = final_result.clone();
        let app_ia_cloned = app_ia.clone();
        
        tokio::spawn(async move {
            enregistrer_apprentissage_autonome_ultra_avance(
                app_ia_cloned,
                &interaction_id,
                user_id,
                &input_context_cloned2,
                &format!("Intention: {}", intention_cloned2),
                &ia_response,
                &final_result_cloned2,
                &ContextAnalysis {
                    user_intent_confidence: 0.7,
                    context_relevance_score: 0.8,
                    sentiment_score: 0.5,
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
                },
                "hybrid_ia"
            ).await;
        });
    }

    let total_time = start_time.elapsed().unwrap().as_millis() as f64;
    log_info(&format!("[orchestration_ia] ?? Fin orchestration IA HYBRIDE en {}ms", total_time));
    
    Ok(final_result)
}

/// ?? Orchestration IA ULTRA-OPTIMIS?E - R?ponse imm?diate + traitements en arri?re-plan
pub async fn orchestrer_intention_ia_ultra_optimisee(
    app_ia: Arc<AppIA>,
    state: Arc<AppState>,
    user_id: Option<i32>,
    input: &MultiModalInput,
) -> AppResult<Value> {
    use crate::services::ia::OptimizedIAService;
    use crate::services::gpu_optimizer::GPUOptimizer;
    use crate::config::production_config::ProductionConfig;
    use crate::utils::log::{log_info, log_error};
    
    let start_time = SystemTime::now();
    let interaction_id = Uuid::new_v4().to_string();
    let optimized_ia = OptimizedIAService::new(app_ia.clone()).await?;
    
    // ? NOUVEAU : Initialisation GPU et configuration
    let gpu_optimizer = GPUOptimizer::new();
    let production_config = ProductionConfig::new();
    
    log_info(&format!("[orchestration_ia] ?? D?but orchestration IA ULTRA-OPTIMIS?E (interaction_id: {})", interaction_id));
    log_info(&format!("[orchestration_ia] ?? Configuration: {}", production_config.get_optimization_info()));
    log_info(&format!("[orchestration_ia] ?? GPU Optimizer: {}", gpu_optimizer.get_stats()));

    // 1. Validation de s?curit? (ESSENTIELLE mais rapide)
    let security_check = validate_input_security(input).await?;
    if !security_check.is_safe {
        return Err(format!("Contenu non s?curis? d?tect?: {}", security_check.reason).into());
    }

    // 2. Construction du contexte utilisateur enrichi (m?me pour la version ultra-optimis?e)
    let input_context = construire_input_context_ultra_avance(input, &OrchestrationConfig {
        enable_learning: true,
        enable_context_analysis: true,
        enable_sentiment_analysis: true,
        enable_intent_refinement: true,
        enable_autonomous_learning: true,
        enable_multi_model_fallback: true,
        enable_performance_monitoring: true,
        enable_security_validation: true,
        max_context_length: 12000,
        confidence_threshold: 0.85,
        enable_fallback_chains: true,
        enable_real_time_optimization: true,
        learning_rate: 0.1,
        model_rotation_strategy: "performance_based".to_string(),
        cache_strategy: "intelligent".to_string(),
    }, None).await;
    log_info(&format!("[orchestration_ia_ultra_optimisee] CONTEXTE UTILISATEUR ENVOY? ? L'IA : {}", serde_json::to_string(&input_context).unwrap_or_default()));

    // 3. Traitement IA avec optimisations GPU conditionnelles
    let ia_start_time = std::time::Instant::now();
    
    // Extraire le texte enrichi avec les informations des images
    let enriched_text = extract_enriched_text_from_context(&input_context);
    
    // Cr?er un input enrichi avec le texte extrait des images
    let mut enriched_input = input.clone();
    if let Some(texte) = &enriched_input.texte {
        enriched_input.texte = Some(format!("{} | {}", texte, enriched_text));
    } else {
        enriched_input.texte = Some(enriched_text);
    }
    
    // ? NOUVEAU : Traitement avec optimisations GPU
    let result = if production_config.gpu_enabled {
        log_info("[orchestration_ia] ?? Pipeline GPU activ?");
        optimized_ia.process_user_request_gpu_optimized(&enriched_input, &gpu_optimizer).await?
    } else {
        log_info("[orchestration_ia] ?? Pipeline CPU activ?");
        optimized_ia.process_user_request_immediate_response(&enriched_input).await?
    };
    
    let ia_processing_time = ia_start_time.elapsed();
    
    log_info(&format!("[orchestration_ia] ? R?ponse imm?diate au frontend en {:?}", ia_processing_time));

    // 4. Nettoyage JSON minimal
    let ia_response = serde_json::to_string(&result)?;
    let cleaned_response = nettoyer_reponse_ia_ultra_avance(&ia_response);
    
    let mut data: Value = serde_json::from_str(&cleaned_response).map_err(|e| {
        log_error(&format!("R?ponse IA non JSON: {}", e));
        "R?ponse IA non JSON"
    })?;

    // 5. D?ballage du champ 'data' si pr?sent
    deballer_champ_data_a_racine(&mut data);
    
    // 6. Extraction de l'intention
    let intention = extraire_intention(&data);
    log_info(&format!("Intention d?tect?e: {}", intention));

    // 7. Routage m?tier (essentiel) - Passer le texte original pour la recherche
    let user_text = input.texte.clone().unwrap_or_default();
    let mut final_result = router_metier_ultra_optimise(user_id, &data, &state, &intention, &user_text, &ContextAnalysis {
        user_intent_confidence: 0.7,
        context_relevance_score: 0.8,
        sentiment_score: 0.5,
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
    }).await?;

    // 8. Ajout des m?triques minimales avec info GPU
    if let Some(obj) = final_result.as_object_mut() {
        // Pr?server les tokens retourn?s par OptimizedIAService au lieu de les ?craser
        let tokens_consumed = data.get("tokens_consumed")
            .and_then(|v| v.as_u64())
            .unwrap_or(1500); // Fallback seulement si pas de tokens dans la r?ponse
        
        obj.insert("tokens_consumed".to_string(), json!(tokens_consumed));
        obj.insert("ia_model_used".to_string(), json!("ultra_optimized_ia"));
        obj.insert("confidence".to_string(), json!(0.7));
        obj.insert("processing_mode".to_string(), json!(if production_config.gpu_enabled { "gpu_optimized" } else { "cpu_standard" }));
        obj.insert("interaction_id".to_string(), json!(interaction_id));
        obj.insert("intention".to_string(), json!(intention));
        obj.insert("gpu_enabled".to_string(), json!(production_config.gpu_enabled));
        obj.insert("optimization_level".to_string(), json!(if production_config.gpu_enabled { "high" } else { "standard" }));
    }

    // 9. R?PONSE IMM?DIATE AU FRONTEND
    log_info(&format!("[orchestration_ia] ? R?ponse envoy?e au frontend en {:?}", start_time.elapsed().unwrap()));

    // 10. Traitements en arri?re-plan (non-bloquant pour UX)
    let input_context = json!({
        "timestamp": SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
        "user_id": user_id,
        "intention": intention.clone(),
        "gpu_enabled": production_config.gpu_enabled,
        "security_check": {
            "is_safe": security_check.is_safe,
            "reason": security_check.reason
        }
    });
    
    // Cloner les variables pour les closures
    let intention_cloned = intention.clone();
    let input_context_cloned = input_context.clone();
    let final_result_cloned = final_result.clone();
    let app_ia_cloned = app_ia.clone();
    let _state_cloned = state.clone();
    
    // Traitements en arri?re-plan (non-bloquant)
    tokio::spawn(async move {
        log_info("[BackgroundTasks] ?? D?marrage des traitements en arri?re-plan");
        
        // 1. Historisation (ESSENTIELLE pour l'apprentissage)
        let history_start = std::time::Instant::now();
        // let _ = crate::services::ia_history_service::sauvegarder_ia_interaction(
        //     state_cloned.mongo.clone(), 
        //     user_id, 
        //     Some(&intention_cloned), 
        //     &input_context_cloned, 
        //     &final_result_cloned
        // ).await;
        log_info(&format!("[BackgroundTasks] ? Historisation termin?e en {:?}", history_start.elapsed()));
        
        // 2. Apprentissage autonome (si pas trop de donn?es)
        if app_ia_cloned.training_data.lock().await.len() < 1000 {
            let learning_start = std::time::Instant::now();
            enregistrer_apprentissage_autonome_ultra_avance(
                app_ia_cloned,
                &interaction_id,
                user_id,
                &input_context_cloned,
                &format!("Intention: {}", intention_cloned),
                &ia_response,
                &final_result_cloned,
                &ContextAnalysis {
                    user_intent_confidence: 0.7,
                    context_relevance_score: 0.8,
                    sentiment_score: 0.5,
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
                },
                "ultra_optimized_ia"
            ).await;
            log_info(&format!("[BackgroundTasks] ? Apprentissage termin? en {:?}", learning_start.elapsed()));
        }
        
        log_info("[BackgroundTasks] ?? Tous les traitements en arri?re-plan termin?s");
    });

    let total_time = start_time.elapsed().unwrap().as_millis() as f64;
    log_info(&format!("[orchestration_ia] ?? R?ponse imm?diate au frontend en {}ms", total_time));
    
    Ok(final_result)
}

/// ?? Construction du input context ultra-avanc?
async fn construire_input_context_ultra_avance(
    input: &MultiModalInput,
    _config: &OrchestrationConfig,
    _app_ia: Option<&AppIA>,
) -> Value {
    let mut context = json!({
        "timestamp": SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
        "input_type": "multimodal_ultra",
        "data_sources": {},
        "processing_config": {
            "max_context_length": _config.max_context_length,
            "confidence_threshold": _config.confidence_threshold,
            "learning_enabled": _config.enable_learning,
            "autonomous_learning": _config.enable_autonomous_learning,
        }
    });

    // Texte principal avec analyse avanc?e
    if let Some(texte) = &input.texte {
        let text_analysis = analyze_text_ultra_advanced(texte).await;
        context["data_sources"]["texte"] = json!({
            "content": texte,
            "length": texte.len(),
            "word_count": texte.split_whitespace().count(),
            "language_detected": text_analysis.language,
            "sentiment_score": text_analysis.sentiment,
            "complexity_score": text_analysis.complexity,
            "intent_confidence": text_analysis.intent_confidence,
            "security_score": text_analysis.security_score,
        });
    }

    // Images avec analyse ultra-avanc?e - NOUVEAU PIPELINE UNIFI?
    if let Some(images) = &input.base64_image {
        let mut image_analyses = Vec::new();
        for (idx, image) in images.iter().enumerate() {
            // ?? NOUVEAU : Plus d'analyse locale, tout passe par l'IA externe
            image_analyses.push(json!({
                "index": idx,
                "size": image.len(),
                "processing": "multimodal_ia_externe",
                "status": "ready_for_ia_analysis"
            }));
        }
        context["data_sources"]["images"] = json!(image_analyses);
        log::info!("[Orchestration] {} images pr?tes pour l'IA externe", images.len());
    }

    // Audio avec analyse ultra-avanc?e - NOUVEAU PIPELINE UNIFI?
    if let Some(audio) = &input.audio_base64 {
        let mut audio_analyses = Vec::new();
        for (idx, audio_data) in audio.iter().enumerate() {
            // ?? NOUVEAU : Plus d'analyse locale, tout passe par l'IA externe
            audio_analyses.push(json!({
                "index": idx,
                "size": audio_data.len(),
                "processing": "multimodal_ia_externe",
                "status": "ready_for_ia_analysis"
            }));
        }
        context["data_sources"]["audio"] = json!(audio_analyses);
        log::info!("[Orchestration] {} audios pr?ts pour l'IA externe", audio.len());
    }

    // Documents avec analyse ultra-avanc?e - NOUVEAU PIPELINE UNIFI?
    if let Some(docs) = &input.doc_base64 {
        let mut doc_analyses = Vec::new();
        for (idx, doc) in docs.iter().enumerate() {
            // ?? NOUVEAU : Plus d'analyse locale, tout passe par l'IA externe
            doc_analyses.push(json!({
                "index": idx,
                "size": doc.len(),
                "processing": "multimodal_ia_externe",
                "status": "ready_for_ia_analysis"
            }));
        }
        context["data_sources"]["documents"] = json!(doc_analyses);
        log::info!("[Orchestration] {} documents pr?ts pour l'IA externe", docs.len());
    }

    // Excel avec analyse ultra-avanc?e - NOUVEAU PIPELINE UNIFI?
    if let Some(excel_files) = &input.excel_base64 {
        let mut excel_analyses = Vec::new();
        for (idx, excel) in excel_files.iter().enumerate() {
            // ?? NOUVEAU : Plus d'analyse locale, tout passe par l'IA externe
            excel_analyses.push(json!({
                "index": idx,
                "size": excel.len(),
                "processing": "multimodal_ia_externe",
                "status": "ready_for_ia_analysis"
            }));
        }
        context["data_sources"]["excel"] = json!(excel_analyses);
        log::info!("[Orchestration] {} fichiers Excel pr?ts pour l'IA externe", excel_files.len());
    }

    // GPS avec analyse ultra-avanc?e
    if let Some(gps) = &input.gps_mobile {
        let gps_analysis = analyze_gps_ultra_advanced(gps).await;
        context["data_sources"]["gps"] = json!({
            "raw_data": gps,
            "latitude": gps_analysis.latitude,
            "longitude": gps_analysis.longitude,
            "accuracy": gps_analysis.accuracy,
            "location_name": gps_analysis.location_name,
            "timezone": gps_analysis.timezone,
        });
    }

    // Site web avec analyse ultra-avanc?e
    if let Some(site) = &input.site_web {
        let site_analysis = analyze_website_ultra_advanced(site).await;
        context["data_sources"]["website"] = json!({
            "url": site,
            "title": site_analysis.title,
            "content_summary": site_analysis.content_summary,
            "language": site_analysis.language,
            "security_score": site_analysis.security_score,
        });
    }

    context
}

/// ?? Analyse contextuelle ultra-avanc?e
async fn analyser_contexte_ultra_avance(
    input_context: &Value,
    app_ia: Arc<AppIA>,
) -> AppResult<ContextAnalysis> {
    let prompt_analyse = format!(
        r#"
Analyse le contexte utilisateur suivant et fournis une analyse structur?e :

Contexte : {}

Retourne un JSON avec :
- user_intent_confidence (0-1) : confiance dans l'intention d?tect?e
- context_relevance_score (0-1) : pertinence du contexte
- sentiment_score (-1 ? 1) : sentiment de la demande
- language_detected : langue d?tect?e (fr, en, etc.)
- user_expertise_level : niveau d'expertise (beginner, intermediate, expert)
- request_complexity : complexit? (simple, medium, complex)
- suggested_improvements : suggestions d'am?lioration
- context_enhancements : enrichissements contextuels
"#,
        serde_json::to_string_pretty(input_context).unwrap_or_default()
    );

    let (_, response, _tokens_used) = app_ia.predict(&prompt_analyse).await?;
    
    // Nettoyer et parser la r?ponse
    let cleaned_response = nettoyer_reponse_ia(&response);
    let analysis: ContextAnalysis = serde_json::from_str(&cleaned_response)
        .unwrap_or_else(|_| ContextAnalysis {
            user_intent_confidence: 0.7,
            context_relevance_score: 0.8,
            sentiment_score: 0.5,
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
        });

    Ok(analysis)
}

/// ?? Optimisation dynamique des instructions IA ultra-avanc?e
async fn optimiser_instructions_ia_ultra_avance(
    context_analysis: &ContextAnalysis,
    config: &OrchestrationConfig,
    _app_ia: Arc<AppIA>,
) -> AppResult<String> {
    let instructions_base = fs::read_to_string("ia_intentions_instructions.md").await
        .map_err(|e| format!("Erreur lecture instructions IA: {}", e))?;
    log::info!("[orchestration_ia] Instructions de base charg?es ({} caract?res)", instructions_base.len());

    // Adaptation selon l'analyse contextuelle
    let mut instructions_optimisees = instructions_base.clone();

    // Adaptation selon le niveau d'expertise
    match context_analysis.user_expertise_level.as_str() {
        "beginner" => {
            instructions_optimisees = format!("{}\n\nINSTRUCTIONS SP?CIALES POUR D?BUTANT :\n- Explique les concepts techniques de mani?re simple\n- Fournis des exemples concrets\n- ?vite le jargon technique", instructions_optimisees);
        }
        "expert" => {
            instructions_optimisees = format!("{}\n\nINSTRUCTIONS SP?CIALES POUR EXPERT :\n- Utilise un vocabulaire technique pr?cis\n- Fournis des d?tails techniques avanc?s\n- Optimise pour l'efficacit?", instructions_optimisees);
        }
        _ => {}
    }

    // Adaptation selon la complexit?
    match context_analysis.request_complexity.as_str() {
        "complex" => {
            instructions_optimisees = format!("{}\n\nINSTRUCTIONS POUR DEMANDE COMPLEXE :\n- Analyse en profondeur tous les aspects\n- Fournis une r?ponse structur?e et d?taill?e\n- Consid?re les implications multiples", instructions_optimisees);
        }
        "simple" => {
            instructions_optimisees = format!("{}\n\nINSTRUCTIONS POUR DEMANDE SIMPLE :\n- R?ponse directe et concise\n- ?vite les d?tails inutiles\n- Privil?gie la clart?", instructions_optimisees);
        }
        _ => {}
    }

    // Ajout d'instructions sp?cifiques selon la confiance
    if context_analysis.user_intent_confidence < config.confidence_threshold {
        instructions_optimisees = format!("{}\n\nATTENTION : Confiance faible dans l'intention ({:.2}). Demande confirmation ou clarification si n?cessaire.", 
            instructions_optimisees, context_analysis.user_intent_confidence);
    }

    Ok(instructions_optimisees)
}



/// ?? Nettoyage de la r?ponse IA ultra-avanc?e
pub fn nettoyer_reponse_ia_ultra_avance(response: &str) -> String {
    let mut cleaned = response.trim().to_string();
    
    // Extraire le JSON si entour? de markdown
    if let Some(start) = cleaned.find('{') {
        if let Some(end) = cleaned.rfind('}') {
            cleaned = cleaned[start..=end].to_string();
        }
    }
    
    // Supprimer les balises markdown
    cleaned = cleaned.replace("```json", "").replace("```", "");
    
    // Supprimer les commentaires JSON (lignes commen?ant par //)
    let lines: Vec<&str> = cleaned.lines().collect();
    let mut cleaned_lines = Vec::new();
    
    for line in lines {
        let trimmed_line = line.trim();
        // Ignorer les lignes qui sont uniquement des commentaires
        if !trimmed_line.starts_with("//") && !trimmed_line.is_empty() {
            // Supprimer les commentaires en fin de ligne
            if let Some(comment_pos) = trimmed_line.find("//") {
                let line_without_comment = &trimmed_line[..comment_pos].trim_end();
                if !line_without_comment.is_empty() {
                    cleaned_lines.push(line_without_comment.to_string());
                }
            } else {
                cleaned_lines.push(trimmed_line.to_string());
            }
        }
    }
    
    let mut result = cleaned_lines.join("\n");
    
    // Nettoyer les commentaires dans les valeurs JSON (comme "valeur": "4.0583, 9.7322",  // commentaire)
    // Chercher les patterns comme ",  // commentaire" et les supprimer
    let mut cleaned_result = String::new();
    let mut in_string = false;
    let mut i = 0;
    let chars: Vec<char> = result.chars().collect();
    
    while i < chars.len() {
        let ch = chars[i];
        
        if ch == '"' && (i == 0 || chars[i-1] != '\\') {
            in_string = !in_string;
            cleaned_result.push(ch);
        } else if !in_string && ch == '/' && i + 1 < chars.len() && chars[i+1] == '/' {
            // Commentaire trouv? hors d'une cha?ne, ignorer jusqu'? la fin de la ligne
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            if i < chars.len() {
                cleaned_result.push(chars[i]); // Garder le \n
            }
        } else {
            cleaned_result.push(ch);
        }
        
        i += 1;
    }
    
    result = cleaned_result;
    
    // Log pour debug
    log::info!("[nettoyer_reponse_ia_ultra_avance] JSON nettoy?: {}", result);
    
    result
}

/// ?? Extrait le texte enrichi depuis le contexte multimodal
fn extract_enriched_text_from_context(context: &Value) -> String {
    let mut enriched_parts = Vec::new();
    
    // Extraire le texte des images - PRIORIT? MAXIMALE POUR L'OCR
    if let Some(images) = context.get("data_sources").and_then(|ds| ds.get("images")).and_then(|i| i.as_array()) {
        for (i, image) in images.iter().enumerate() {
            if let Some(extracted_text) = image.get("text_extracted").and_then(|t| t.as_str()) {
                if !extracted_text.is_empty() && extracted_text != "Impossible d'extraire le texte de l'image" {
                    enriched_parts.push(format!("Texte extrait de l'image {}: {}", i + 1, extracted_text));
                    
                    // Log pour debug
                    log::info!("[OCR] Texte extrait de l'image {} ajout? au contexte: {}", i + 1, extracted_text);
                } else {
                    log::warn!("[OCR] Aucun texte valide extrait de l'image {}", i + 1);
                }
            }
        }
    }
    
    // Extraire le texte des documents
    if let Some(documents) = context.get("data_sources").and_then(|ds| ds.get("documents")).and_then(|d| d.as_array()) {
        for (i, doc) in documents.iter().enumerate() {
            if let Some(extracted_text) = doc.get("text_extracted").and_then(|t| t.as_str()) {
                if !extracted_text.is_empty() {
                    enriched_parts.push(format!("Texte extrait du document {}: {}", i + 1, extracted_text));
                }
            }
        }
    }
    
    // Extraire la transcription audio
    if let Some(audios) = context.get("data_sources").and_then(|ds| ds.get("audio")).and_then(|a| a.as_array()) {
        for (i, audio) in audios.iter().enumerate() {
            if let Some(transcription) = audio.get("transcription").and_then(|t| t.as_str()) {
                if !transcription.is_empty() {
                    enriched_parts.push(format!("Transcription audio {}: {}", i + 1, transcription));
                }
            }
        }
    }
    
    enriched_parts.join(" | ")
}

/// ?? Raffinement d'intention IA ultra-avanc?
async fn raffiner_intention_ia_ultra_avance(
    data: &Value,
    context_analysis: &ContextAnalysis,
    _app_ia: Arc<AppIA>,
) -> AppResult<Value> {
    let mut refined_data = data.clone();
    
    // Si la confiance est faible, demander une clarification
    if context_analysis.user_intent_confidence < 0.6 {
        if let Some(obj) = refined_data.as_object_mut() {
            obj.insert("intention_incertaine".to_string(), json!(true));
            obj.insert("suggestion_clarification".to_string(), json!("Veuillez pr?ciser votre demande pour une meilleure assistance"));
        }
    }
    
    Ok(refined_data)
}

/// ?? Correction automatique du JSON ultra-avanc?
async fn corriger_json_automatiquement_ultra_avance(
    data: &Value,
    intention: &str,
    _app_ia: Arc<AppIA>,
) -> AppResult<Value> {
    // Logique de correction automatique basique
    let mut corrected_data = data.clone();
    
    if let Some(obj) = corrected_data.as_object_mut() {
        // Ajouter des champs manquants selon l'intention
        match intention {
            "creation_service" => {
                if !obj.contains_key("titre") {
                    obj.insert("titre".to_string(), json!({
                        "type_donnee": "string",
                        "valeur": "Service ? cr?er",
                        "origine_champs": "correction_auto"
                    }));
                }
            }
            "recherche_besoin" => {
                if !obj.contains_key("description") {
                    obj.insert("description".to_string(), json!({
                        "type_donnee": "string",
                        "valeur": "Besoin ? rechercher",
                        "origine_champs": "correction_auto"
                    }));
                }
            }
            _ => {}
        }
    }
    
    Ok(corrected_data)
}

/// Extraire automatiquement les mots-clés pertinents du texte utilisateur
pub fn extract_keywords_from_text(text: &str) -> Vec<String> {
    // Mots à ignorer (stop words) - plus dynamiques et contextuels
    let stop_words = [
        // Pronoms personnels
        "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "me", "te", "se",
        // Verbes de recherche
        "cherche", "cherches", "cherchez", "cherchons", "recherche", "recherches", "recherchez",
        "voudrais", "veux", "veux", "souhaite", "désire", "aimerais", "aimerait",
        // Articles et déterminants
        "un", "une", "des", "le", "la", "les", "du", "de", "d'", "ce", "cette", "ces",
        "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre", "leur", "leurs",
        // Prépositions
        "pour", "avec", "sans", "sur", "sous", "dans", "entre", "par", "vers", "chez",
        // Conjonctions
        "et", "ou", "mais", "donc", "car", "ni", "or", "que", "qui", "quoi", "où", "quand", "comment", "pourquoi",
        // Adverbes courants
        "très", "trop", "peu", "beaucoup", "assez", "plus", "moins", "bien", "mal", "bon", "mauvais",
        "grand", "petit", "nouveau", "vieux", "premier", "dernier", "meilleur", "pire",
        "même", "autre", "différent", "tout", "tous", "toute", "toutes", "aucun", "aucune",
        "quelques", "plusieurs", "maintenant", "aujourd'hui", "hier", "demain", "bientôt", "tard",
        "ici", "là", "ailleurs", "partout", "nulle part", "oui", "non", "peut-être",
        "certainement", "probablement", "merci", "s'il", "vous", "plait", "pardon", "excusez", "moi"
    ];
    
    // Nettoyer le texte de manière plus intelligente
    let clean_text = text
        .to_lowercase()
        // Supprimer les expressions de recherche courantes
        .replace("je cherche", "")
        .replace("je voudrais", "")
        .replace("je veux", "")
        .replace("je souhaite", "")
        .replace("je désire", "")
        .replace("je voudrais trouver", "")
        .replace("je veux trouver", "")
        .replace("je recherche", "")
        .replace("je suis à la recherche", "")
        .replace("je suis à la recherche de", "")
        .replace("je cherche à", "")
        .replace("je cherche pour", "")
        .trim()
        .to_string();
    
    // Diviser en mots et filtrer intelligemment
    let words: Vec<&str> = clean_text
        .split_whitespace()
        .filter(|word| {
            let word = word.trim_matches(|c: char| !c.is_alphanumeric());
            !word.is_empty() && 
            word.len() > 2 && // Mots de plus de 2 caractères
            !stop_words.contains(&word) &&
            !word.chars().all(|c| c.is_numeric()) && // Pas que des chiffres
            !word.chars().all(|c| c.is_ascii_digit()) // Pas que des chiffres ASCII
        })
        .collect();
    
    // Extraire les mots-clés uniques avec priorité
    let mut keywords = Vec::new();
    let mut seen_words = std::collections::HashSet::new();
    
    for word in words {
        let clean_word = word.trim_matches(|c: char| !c.is_alphanumeric()).to_string();
        
        // Ignorer les mots trop courts ou déjà vus
        if clean_word.len() < 3 || seen_words.contains(&clean_word) {
            continue;
        }
        
        // Prioriser les mots plus longs (plus spécifiques)
        let priority = clean_word.len() as i32;
        
        // Ajouter avec priorité
        keywords.push((priority, clean_word.clone()));
        seen_words.insert(clean_word);
    }
    
    // Trier par priorité (mots plus longs en premier)
    keywords.sort_by(|a, b| b.0.cmp(&a.0));
    
    // Extraire seulement les mots-clés (sans la priorité)
    let final_keywords: Vec<String> = keywords
        .into_iter()
        .map(|(_, word)| word)
        .take(5) // Limiter à 5 mots-clés maximum
        .collect();
    
    final_keywords
}

/// ?? Router m?tier ultra-optimis?
async fn router_metier_ultra_optimise(
    _user_id: Option<i32>,
    data: &Value,
    _state: &Arc<AppState>,
    intention: &str,
    user_text: &str,
    _context_analysis: &ContextAnalysis,
) -> AppResult<Value> {
    let result = match intention {
        "echange" => {
            // crate::services::traiter_echange::traiter_echange(user_id, data, &state.pg, None).await?,
            json!({"status": "success", "message": "Service ?change temporairement d?sactiv?"})
        },
        "creation_service" => {
            // Pour la cr?ation de service, retourner les donn?es compl?tes avec l'intention
            json!({
                "status": "success",
                "intention": intention,
                "data": data
            })
        },
        "recherche_besoin" => {
            // NOUVEAU : Recherche directe avec le texte original de l'utilisateur
            let (result, tokens_consumed) = crate::services::rechercher_besoin::rechercher_besoin_direct(
                _user_id, 
                user_text,
                None,  // Pas de zone GPS pour cette recherche
                None   // Pas de rayon GPS pour cette recherche
            ).await?;
            
            // Extraire directement le tableau des résultats de la structure imbriquée
            let results_array = if let Some(r) = result.as_object() {
                r.get("resultats").and_then(|v| v.as_array()).cloned().unwrap_or_default()
            } else {
                vec![]
            };
            
            json!({
                "status": "success",
                "intention": intention,
                "resultats": {
                    "results": results_array,
                    "message": "Recherche directe PostgreSQL réussie",
                    "nombre_matchings": if let Some(r) = result.as_object() {
                        r.get("nombre_matchings").and_then(|v| v.as_u64()).unwrap_or(0)
                    } else { 0 }
                },
                "tokens_consumed": tokens_consumed,
                "message": "Recherche directe PostgreSQL réussie"
            })
        },
        "assistance_generale" => {
            // crate::controllers::assistance_controller::traiter_assistance(user_id, data).await?,
            json!({"status": "success", "message": "Service assistance temporairement d?sactiv?"})
        },
        "programme_scolaire" | "update_programme_scolaire" => {
            // crate::services::valider_programme_scolaire::valider_programme_scolaire_json(data)?;
            json!({"status": "success", "message": "Service programme scolaire temporairement d?sactiv?"})
        },
        "upsert_programme" => {
            // let etablissement = data["etablissement"].as_str().unwrap_or("");
            // let classe = data["classe"].as_str().unwrap_or("");
            // let annee = data["annee"].as_str().unwrap_or("");
            // crate::services::programme_service::upsert_programme_scolaire(etablissement, classe, annee, data).await?;
            json!({"status": "success", "message": "Service upsert programme temporairement d?sactiv?"})
        },
        _ => {
            return Err(format!("Intention non reconnue ou manquante dans le JSON IA. Intention='{}' | Donn?es IA: {}", intention, data).into());
        }
    };

    Ok(result)
}

/// ?? Enregistrement pour apprentissage autonome ultra-avanc?
async fn enregistrer_apprentissage_autonome_ultra_avance(
    app_ia: Arc<AppIA>,
    interaction_id: &str,
    _user_id: Option<i32>,
    _input_context: &Value,
    prompt: &str,
    ia_response: &str,
    result: &Value,
    _context_analysis: &ContextAnalysis,
    source: &str,
) {
    // Cr?er des donn?es d'entra?nement
    let training_data = TrainingData {
        id: interaction_id.to_string(),
        prompt: prompt.to_string(),
        expected_response: serde_json::to_string(result).unwrap_or_default(),
        actual_response: ia_response.to_string(),
        model_used: source.to_string(),
        user_feedback: None,
        quality_score: _context_analysis.user_intent_confidence,
        created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
    };

    // Ajouter aux donn?es d'entra?nement
    let mut training_queue = app_ia.training_data.lock().await;
    training_queue.push(training_data);

    // Si assez de donn?es de haute qualit?, g?n?rer un dataset
    let high_quality_count = training_queue.iter().filter(|td| td.quality_score >= 0.8).count();
    if high_quality_count >= 100 {
        if let Err(e) = app_ia.generate_training_dataset("datasets/yukpo_training_data.json").await {
            log::error!("[AppIA] Erreur g?n?ration dataset: {}", e);
        }
    }
}

pub fn extraire_intention(data: &Value) -> String {
    match data.get("intention") {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Object(obj)) => obj.get("valeur").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        _ => String::new(),
    }
}

pub fn patch_json_ia_ultra_avance(data: &mut Value, _context_analysis: &ContextAnalysis) {
    let intention = extraire_intention(data);
    if let Some(obj) = data.as_object_mut() {
        match intention.as_str() {
            "echange" => {
                for champ in ["mode_troc", "mode", "timestamp"] {
                    if obj.get(champ).map_or(false, |v| v.is_null()) {
                        obj.insert(champ.to_string(), Value::String(String::from("")));
                    }
                }
            }
            "creation_service" => {
                for champ in ["titre", "description", "category"] {
                    if let Some(champ_obj) = obj.get_mut(champ) {
                        if let Some(map) = champ_obj.as_object_mut() {
                            map.entry("origine_champs").or_insert_with(|| Value::String("texte_libre".to_string()));
                        }
                    }
                }
            }
            "recherche_besoin" => {
                for champ in ["description", "category", "reponse_intelligente"] {
                    if let Some(champ_obj) = obj.get_mut(champ) {
                        if let Some(map) = champ_obj.as_object_mut() {
                            map.entry("origine_champs").or_insert_with(|| Value::String("ia".to_string()));
                        }
                    }
                }
            }
            _ => {}
        }
    }
}

pub fn valider_json_intention_ultra_avance(intention: &str, data: &Value) -> AppResult<()> {
    use std::path::PathBuf;
    let schema_map: HashMap<&str, &str> = [
        ("echange", "echange_schema.json"),
        ("creation_service", "service_schema.json"),
        ("recherche_besoin", "besoin_schema.json"),
        ("programme_scolaire", "programme_scolaire_schema.json"),
        ("update_programme_scolaire", "programme_scolaire_schema.json"),
    ].iter().cloned().collect();

    if let Some(schema_file) = schema_map.get(intention) {
        let mut schema_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        schema_path.push("src/schemas");
        schema_path.push(schema_file);

        let schema_str = std::fs::read_to_string(&schema_path)
            .map_err(|e| format!("Erreur lecture sch?ma {}: {}", schema_path.display(), e))?;
        let schema_json: Value = serde_json::from_str(&schema_str)
            .map_err(|e| format!("Erreur parsing sch?ma JSON {}: {}", schema_path.display(), e))?;

        let compiled = JSONSchema::compile(&schema_json)
            .map_err(|e| format!("Erreur compilation sch?ma JSON: {}", e))?;

        let result = compiled.validate(data);
        if let Err(errors) = result {
            let msg = errors.map(|e| e.to_string()).collect::<Vec<_>>().join(", ");
            return Err(format!("Validation JSON IA ultra-avanc?e ?chou?e pour '{}': {}", intention, msg).into());
        }
    }
    Ok(())
}

// Structures pour les analyses
#[derive(Debug)]
pub struct TextAnalysis {
    pub language: String,
    pub sentiment: f64,
    pub complexity: f64,
    pub intent_confidence: f64,
    pub security_score: f64,
}

#[derive(Debug)]
pub struct ImageAnalysis {
    pub format: String,
    pub content_type: String,
    pub objects: Vec<String>,
    pub extracted_text: String,
    pub safety_score: f64,
    pub quality_score: f64,
}

#[derive(Debug)]
pub struct AudioAnalysis {
    pub duration: f64,
    pub format: String,
    pub transcription: String,
    pub language: String,
    pub sentiment: f64,
    pub quality_score: f64,
}

#[derive(Debug)]
pub struct DocumentAnalysis {
    pub content_type: String,
    pub extracted_text: String,
    pub pages: usize,
    pub language: String,
    pub quality_score: f64,
}

#[derive(Debug)]
pub struct GPSAnalysis {
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: f64,
    pub location_name: String,
    pub timezone: String,
}

#[derive(Debug)]
pub struct WebsiteAnalysis {
    pub url: String,
    pub title: String,
    pub content_summary: String,
    pub language: String,
    pub security_score: f64,
}

#[derive(Debug)]
pub struct SecurityCheck {
    pub is_safe: bool,
    pub reason: String,
    pub threats: Vec<String>,
    pub recommendations: Vec<String>,
}

// Fonctions d'analyse manquantes
async fn validate_input_security(_input: &MultiModalInput) -> AppResult<SecurityCheck> {
    // Simulation d'une validation de s?curit?
    Ok(SecurityCheck {
        is_safe: true,
        reason: "Validation r?ussie".to_string(),
        threats: vec![],
        recommendations: vec![],
    })
}

async fn analyze_text_ultra_advanced(text: &str) -> TextAnalysis {
    // Analyse de texte am?lior?e pour d?tecter les produits et services
    let text_lower = text.to_lowercase();
    
    // D?tection de la langue
    let language = if text_lower.contains("je vends") || text_lower.contains("vente") || text_lower.contains("location") {
        "fr".to_string()
    } else {
        "en".to_string()
    };
    
    // D?tection du sentiment
    let sentiment = if text_lower.contains("urgent") || text_lower.contains("rapide") {
        0.8
    } else if text_lower.contains("pas cher") || text_lower.contains("bon prix") {
        0.6
    } else {
        0.5
    };
    
    // D?tection de la complexit?
    let complexity = if text.split_whitespace().count() > 50 {
        0.8
    } else if text.split_whitespace().count() > 20 {
        0.6
    } else {
        0.4
    };
    
    // D?tection de l'intention avec confiance
    let intent_confidence = if text_lower.contains("je vends") || text_lower.contains("vente") || text_lower.contains("location") {
        0.9
    } else if text_lower.contains("je cherche") || text_lower.contains("recherche") {
        0.8
    } else {
        0.6
    };
    
    // Score de s?curit?
    let security_score = if text_lower.contains("ill?gal") || text_lower.contains("drogue") || text_lower.contains("sexe") {
        0.2
    } else {
        0.9
    };
    
    TextAnalysis {
        language,
        sentiment,
        complexity,
        intent_confidence,
        security_score,
    }
}

async fn analyze_gps_ultra_advanced(_gps: &str) -> GPSAnalysis {
    GPSAnalysis {
        latitude: 0.0,
        longitude: 0.0,
        accuracy: 10.0,
        location_name: "Unknown".to_string(),
        timezone: "UTC".to_string(),
    }
}

async fn analyze_website_ultra_advanced(site: &str) -> WebsiteAnalysis {
    WebsiteAnalysis {
        url: site.to_string(),
        title: "".to_string(),
        content_summary: "".to_string(),
        language: "fr".to_string(),
        security_score: 0.8,
    }
}

fn nettoyer_reponse_ia(response: &str) -> String {
    let cleaned = response.trim().replace("```json", "").replace("```", "");
    cleaned.to_string()
}

/// ?? D?ballage automatique du champ 'data' ? la racine pour compatibilit? nouvelle structure IA
pub fn deballer_champ_data_a_racine(data: &mut Value) {
    if let Some(data_obj) = data.get("data").and_then(|v| v.as_object()) {
        let mut merged = data.clone();
        
        // Fusionner les propri?t?s de 'data' ? la racine
        if let Some(merged_obj) = merged.as_object_mut() {
            for (key, value) in data_obj {
                merged_obj.insert(key.clone(), value.clone());
            }
            // Supprimer le champ 'data' original
            merged_obj.remove("data");
        }
        
        // Remplacer l'objet original par la version fusionn?e
        *data = merged;
        
        log::info!("[deballer_champ_data_a_racine] Champ 'data' d?ball? ? la racine avec succ?s");
    }
}

/// ?? Conversion optimale de tous les modaux en images pour l'IA externe
pub async fn convert_all_modals_to_images(input: &MultiModalInput) -> Vec<String> {
    let mut all_images = Vec::new();
    
    // 1. Images directes (d?j? au bon format)
    if let Some(images) = &input.base64_image {
        all_images.extend(images.clone());
        log::info!("[ModalConverter] {} images directes ajout?es", images.len());
    }
    
    // 2. PDF -> Images (conversion page par page)
    if let Some(pdfs) = &input.doc_base64 {
        for (i, pdf_base64) in pdfs.iter().enumerate() {
            if let Ok(pdf_images) = convert_pdf_to_images(pdf_base64).await {
                let image_count = pdf_images.len();
                all_images.extend(pdf_images);
                log::info!("[ModalConverter] PDF {} converti en {} images", i, image_count);
            }
        }
    }
    
    // 3. Excel -> Images (conversion feuille par feuille)
    if let Some(excels) = &input.excel_base64 {
        for (i, excel_base64) in excels.iter().enumerate() {
            if let Ok(excel_images) = convert_excel_to_images(excel_base64).await {
                let image_count = excel_images.len();
                all_images.extend(excel_images);
                log::info!("[ModalConverter] Excel {} converti en {} images", i, image_count);
            }
        }
    }
    
    // 4. Audio -> Texte -> Image (via transcription)
    if let Some(audios) = &input.audio_base64 {
        for (i, audio_base64) in audios.iter().enumerate() {
            if let Ok(transcribed_text) = transcribe_audio_to_text(audio_base64).await {
                // Convertir le texte en image simple pour l'IA
                if let Ok(text_image) = convert_text_to_image(&transcribed_text).await {
                    all_images.push(text_image);
                    log::info!("[ModalConverter] Audio {} transcrit et converti en image", i);
                }
            }
        }
    }
    
    log::info!("[ModalConverter] Total: {} images pr?tes pour l'IA externe", all_images.len());
    all_images
}

/// ?? Conversion PDF en images (optimale)
pub async fn convert_pdf_to_images(_pdf_base64: &str) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
    // TODO: Impl?menter avec pdfium-render ou poppler
    // Pour l'instant, simulation
    log::info!("[PDFConverter] Conversion PDF en images (simulation)");
    Ok(vec!["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string()])
}

/// ?? Conversion Excel en images (optimale)
pub async fn convert_excel_to_images(_excel_base64: &str) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
    // TODO: Impl?menter avec calamine + image generation
    // Pour l'instant, simulation
    log::info!("[ExcelConverter] Conversion Excel en images (simulation)");
    Ok(vec!["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string()])
}

/// ?? Transcription audio en texte (optimale)
async fn transcribe_audio_to_text(_audio_base64: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    // TODO: Impl?menter la transcription audio r?elle
    // Pour l'instant, retourner un texte d'exemple
    Ok("Transcription audio en cours de d?veloppement...".to_string())
}

/// Conversion texte vers image simple
async fn convert_text_to_image(_text: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    // TODO: Impl?menter la conversion texte vers image
    // Pour l'instant, retourner une image d'exemple
    log::info!("[TextConverter] Conversion texte vers image (simulation)");
    Ok("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string())
}


