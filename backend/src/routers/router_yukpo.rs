use std::sync::Arc;
use axum::{
    extract::{Extension, State, Path},
    routing::{post, get, patch, put, delete},
    Json, Router,
    response::Response,
    http::{StatusCode, HeaderMap, HeaderValue},
    body::Body,
};
use serde_json::{json, Value};
use log::{info, error, warn};
use tokio::fs::File;
use tokio::io::AsyncReadExt;

use crate::{
    controllers::{
        // interaction_controller::{post_message, post_review, get_service_interactions, get_service_reviews, get_service_score, post_audio, post_call, post_share},
        service_controller::{get_services_for_prestataire, toggle_service_status, modifier_service, supprimer_service, get_service_by_id},
    },
    core::types::{AppResult, AppError},
    services::creer_service,
    state::AppState,
    middlewares::{request_size_limit, hide_headers, rate_limit, monitoring, audit_log, jwt::jwt_auth, check_tokens::check_tokens},
};
use crate::models::input_model::MultiModalInput;
use axum::response::IntoResponse;

// Routes temporairement comment?es pour ?viter les warnings
// use crate::routes::{
//     ia_routes,
//     // ia_routes_optimized, // Temporairement d?sactiv?
//     // matching_routes,
//     user_routes,
//     service_routes,
//     echange_routes,
//     // echanges_routes,
//     // demandes_routes,
//     // demandes_echange_routes,
//     // multimodal_routes,
//     // search_routes,
//     // orchestration_ia_optimized, // Comment? temporairement
//     // ia_chat_routes,
// };

/// ?? Fonction de route globale ? exposer dans main.rs
pub fn router_yukpo(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes publiques sans middleware
    let public_routes = Router::new()
        .route("/api/test/ping", get(handle_ping))
        .route("/api/geocoding/reverse", post(handle_reverse_geocode))
        // Route pour servir les fichiers média
        .route("/api/media/{*file_path}", get(serve_media_file))
        .layer(axum::middleware::from_fn(monitoring::monitoring))
        .layer(axum::middleware::from_fn(audit_log::audit_log))
        .layer(axum::middleware::from_fn(rate_limit::rate_limit))
        .layer(axum::middleware::from_fn(hide_headers::hide_headers))
        .layer(axum::middleware::from_fn(request_size_limit::request_size_limit));
    
    // Routes prot?g?es avec middleware JWT
    let protected_routes = Router::new()
        .route(
            "/api/ia/auto",
            post(handle_yukpo)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(), check_tokens
                ))
        )
        .route(
            "/api/ia/creation-service",
            post(handle_creation_service_direct)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(), check_tokens
                ))
        )
        .route(
            "/api/search/direct",
            post(handle_direct_search)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(), check_tokens
                ))
        )
        // Nouveau endpoint pour consulter les m?triques d'optimisation
        .route("/api/ia/metrics", get(handle_optimization_metrics))
        // Routes d'interaction sur services avec middleware de tracking et d?bit prestataire
        // .route("/services/{id}/message", post(post_message)
        //     .layer(axum::middleware::from_fn_with_state(state.clone(), track_service_interaction)))
        // .route("/services/{id}/review", post(post_review)
        //     .layer(axum::middleware::from_fn_with_state(state.clone(), track_service_interaction)))
        // .route("/services/{id}/interactions", get(get_service_interactions))
        // .route("/services/{id}/reviews", get(get_service_reviews))
        // .route("/services/{id}/score", get(get_service_score))
        // .route("/services/{id}/audio", post(post_audio)
        //     .layer(axum::middleware::from_fn_with_state(state.clone(), track_service_interaction)))
        // .route("/services/{id}/call", post(post_call)
        //     .layer(axum::middleware::from_fn_with_state(state.clone(), track_service_interaction)))
        // .route("/services/{id}/share", post(post_share)
        //     .layer(axum::middleware::from_fn_with_state(state.clone(), track_service_interaction)))
        // Routes de cr?ation de service (gestion des tokens dans le contrôleur)
        .route("/api/services/draft", post(handle_brouillon_service))
        .route("/api/services/create", post(handle_creer_service))
        // Route pour r?cup?rer tous les services du prestataire connect?
        .route("/api/prestataire/services", get(get_services_for_prestataire))
        // Route pour activer/d?sactiver un service
        .route("/api/services/{service_id}/toggle-status", patch(toggle_service_status))
        // Route pour modifier un service
        .route("/api/services/{service_id}/update", put(modifier_service))
        // Route pour supprimer un service
        .route("/api/services/{service_id}/delete", delete(supprimer_service))
        // Route pour r?cup?rer un service par ID (public)
        .route("/api/services/{service_id}", get(get_service_by_id))
        // Route pour récupérer les médias d'un service
        .route("/api/services/{service_id}/media", get(crate::controllers::media_controller::get_service_media))
        // Route pour récupérer les informations d'un utilisateur par ID
        .route("/api/users/{user_id}", get(crate::controllers::user_controller::get_user_by_id))
        .layer(axum::middleware::from_fn(jwt_auth))
        .layer(axum::middleware::from_fn(monitoring::monitoring))
        .layer(axum::middleware::from_fn(audit_log::audit_log))
        .layer(axum::middleware::from_fn(rate_limit::rate_limit))
        .layer(axum::middleware::from_fn(hide_headers::hide_headers))
        .layer(axum::middleware::from_fn(request_size_limit::request_size_limit));
    
    // Combinaison des routes
    public_routes.merge(protected_routes).with_state(state)
}

/// ?? Handler pour la recherche directe (sans détection d'intention)
#[axum::debug_handler]
async fn handle_direct_search(
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
    Json(input): Json<MultiModalInput>,
) -> AppResult<impl IntoResponse> {
    use crate::services::rechercher_besoin::rechercher_besoin_direct;
    use crate::utils::log::log_info;
    
    log_info(&format!("[DIRECT_SEARCH] Recherche directe pour utilisateur {} (GPS: {:?})", 
        user.id, input.gps_mobile));
    
    // Extraire le texte de l'input
    let user_text = input.texte.unwrap_or_default();
    
    // Extraire les paramètres GPS
    let gps_zone = input.gps_mobile.as_deref();
    let search_radius_km = Some(50); // Rayon par défaut de 50km
    
    log_info(&format!("[DIRECT_SEARCH] Paramètres GPS extraits: zone={:?}, rayon={:?}km", 
        gps_zone, search_radius_km));
    
    // Recherche directe sans détection d'intention, avec filtrage GPS
    let (result, tokens_consumed) = rechercher_besoin_direct(
        Some(user.id), 
        &user_text,
        gps_zone,
        search_radius_km
    ).await?;
    
    // Construire la réponse
    let response = serde_json::json!({
        "status": "success",
        "intention": "recherche_besoin",
        "resultats": result,
        "tokens_consumed": tokens_consumed,
        "message": "Recherche directe réussie",
        "search_method": "direct",
        "gps_filtered": gps_zone.is_some(),
        "search_radius_km": search_radius_km
    });
    
    Ok(Json(response))
}

#[axum::debug_handler]
async fn handle_yukpo(
    State(_state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    Json(json_value): Json<serde_json::Value>,
) -> axum::response::Response {
    // Debug: afficher le JSON brut re?u
    eprintln!("[DEBUG][HANDLE_YUKPO] JSON brut: {}", json_value);
    eprintln!("[DEBUG] ?? ENTREE DANS HANDLE_YUKPO - USER ID: {}", user.id);
    info!("[handle_yukpo] ?? ==== Requ?te re?ue sur /api/ia/auto ====\nBody JSON re?u: {}", json_value);

    // Parser JSON en MultiModalInput
    eprintln!("[DEBUG] TENTATIVE DE PARSING JSON EN MULTIMODALINPUT");
    let input: MultiModalInput = match serde_json::from_value(json_value.clone()) {
        Ok(val) => {
            eprintln!("[DEBUG] PARSING JSON OK");
            val
        },
        Err(e) => {
            eprintln!("[DEBUG] ERREUR PARSING JSON: {}", e);
            error!("[handle_yukpo] Erreur parsing JSON en MultiModalInput: {} | Body: {}", e, json_value);
            warn!("[handle_yukpo] JSON re?u non conforme, retour BAD_REQUEST");
            return (axum::http::StatusCode::BAD_REQUEST, format!("Erreur parsing JSON: {}", e)).into_response();
        }
    };
    // Debug: afficher le contenu de MultiModalInput
    eprintln!("[DEBUG][HANDLE_YUKPO] MultiModalInput: {:?}", input);
    info!("[handle_yukpo] Contenu MultiModalInput: {:?}", input);
    
    // Debug sp?cifique pour les images
    if let Some(images) = &input.base64_image {
        eprintln!("[DEBUG][HANDLE_YUKPO] Images re?ues: {} images", images.len());
        info!("[handle_yukpo] Images re?ues: {} images", images.len());
        for (i, img) in images.iter().enumerate() {
            eprintln!("[DEBUG][HANDLE_YUKPO] Image {}: taille {} bytes", i, img.len());
            info!("[handle_yukpo] Image {}: taille {} bytes", i, img.len());
        }
    } else {
        eprintln!("[DEBUG][HANDLE_YUKPO] Aucune image re?ue");
        info!("[handle_yukpo] Aucune image re?ue");
    }
    
    eprintln!("[DEBUG] APPEL ORCHESTRATION IA...");
    info!("[handle_yukpo] Parsing JSON -> MultiModalInput OK. Appel orchestration IA...");
    info!("[handle_yukpo] Lancement de l'orchestration IA avec input JSON: {}", serde_json::to_string(&input).unwrap_or_default());
    
    // ?? UTILISER L'ORCHESTRATION ULTRA-OPTIMIS?E POUR PERFORMANCE MAXIMALE
    let orchestration_result: Result<serde_json::Value, axum::http::StatusCode> = match crate::services::orchestration_ia::orchestrer_intention_ia_ultra_optimisee(
        _state.ia.clone(),
        _state.clone(),
        Some(user.id),
        &input,
    ).await {
        Ok(result) => Ok(result),
        Err(e) => {
            error!("[handle_yukpo] Erreur orchestration IA ultra-optimis?e: {}", e);
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    };
    
    match orchestration_result {
        Ok(result) => {
            eprintln!("[DEBUG] ORCHESTRATION IA OK");
            info!("[handle_yukpo] Orchestration IA termin?e avec succ?s. R?sultat: {:?}", result);
            
            // Extraction du champ 'data' pour validation
            let data_for_validation = if let Some(data_field) = result.get("data") {
                data_field.clone()
            } else {
                // Si pas de champ 'data', utiliser le r?sultat complet mais nettoyer les m?tadonn?es
                let mut cleaned_result = result.clone();
                // Supprimer les champs de m?tadonn?es qui ne sont pas dans le sch?ma
                if let Some(obj) = cleaned_result.as_object_mut() {
                    obj.remove("status");
                    obj.remove("tokens_consumed");
                    obj.remove("ia_model_used");
                    obj.remove("confidence");
                    obj.remove("actif");
                }
                cleaned_result
            };

            log::info!("[handle_yukpo] Donn?es extraites pour validation: {}", serde_json::to_string(&data_for_validation).unwrap_or_default());

            // Validation et normalisation du JSON avec le schéma approprié
            let validated_and_normalized_data = match creer_service::valider_service_json(&data_for_validation) {
                Ok(normalized_data) => {
                    log::info!("[handle_yukpo] Données normalisées avec succès");
                    normalized_data
                },
                Err(e) => {
                    log::error!("[handle_yukpo] Erreur validation: {}", e);
                    return (axum::http::StatusCode::BAD_REQUEST, format!("Erreur validation: {}", e)).into_response();
                }
            };
            
            // Extraire les tokens consomm?s depuis le r?sultat si disponible
            let tokens_consumed = result.get("tokens_consumed")
                .and_then(|v| v.as_i64())
                .unwrap_or(5); // D?faut conservateur
            
            // Construire la r?ponse avec les donn?es normalis?es et headers personnalis?s
            let mut final_result = result.clone();
            
            // Remplacer les données par les données normalisées
            if let Some(obj) = final_result.as_object_mut() {
                obj.insert("data".to_string(), validated_and_normalized_data);
                log::info!("[handle_yukpo] Données normalisées insérées dans la réponse");
            }
            
            let mut response = axum::Json(final_result).into_response();
            
            // Ajouter le header pour le middleware check_tokens
            response.headers_mut().insert(
                "x-tokens-consumed",
                axum::http::HeaderValue::from_str(&tokens_consumed.to_string())
                    .unwrap_or(axum::http::HeaderValue::from_static("5"))
            );
            
            response
        },
        Err(e) => {
            eprintln!("[DEBUG] ERREUR ORCHESTRATION IA: {}", e);
            error!("[handle_yukpo] Erreur orchestration IA: {}", e);
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Erreur orchestration IA: {}", e)).into_response()
        }
    }
}

/// Endpoint de test simple sans middleware
async fn handle_ping() -> Result<axum::response::Response, axum::http::StatusCode> {
    eprintln!("[DEBUG] ?? PING ENDPOINT APPELE - PAS DE JWT REQUIS");
    log::info!("[handle_ping] ?? Endpoint ping appel? sans JWT");
    let response = serde_json::json!({
        "status": "ok",
        "message": "Backend Yukpo fonctionne",
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    Ok(axum::Json(response).into_response())
}

/// Endpoint pour valider un brouillon de service sans insertion en base
async fn handle_brouillon_service(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    Json(data): Json<Value>,
) -> AppResult<Json<Value>> {
    let validated = creer_service::brouillon_service(&data).await?;
    Ok(Json(validated))
}

/// Endpoint pour cr?er un service (insertion en base)
async fn handle_creer_service(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    Json(data): Json<Value>,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    let user_id = user.id;
    
    // ?? LOGS DE D?BOGAGE
    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] ?? REQU?TE RE?UE SUR /api/services/create");
    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] User ID: {}", user_id);
    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] Donn?es re?ues: {}", serde_json::to_string(&data).unwrap_or_default());
    info!("[handle_creer_service] ?? ==== Requ?te re?ue sur /api/services/create ====");
    info!("[handle_creer_service] User ID: {}", user_id);
    info!("[handle_creer_service] Donn?es re?ues: {}", serde_json::to_string(&data).unwrap_or_default());
    
    // Cr?er la structure attendue par creer_service
    let service_request = crate::controllers::service_controller::NewServiceRequest {
        user_id,
        data,
    };
    
    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] Appel du contr?leur creer_service...");
    info!("[handle_creer_service] Appel du contr?leur creer_service...");
    
    let response_result = crate::controllers::service_controller::creer_service(
        State(state),
        Json(service_request)
    ).await;
    
    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] R?ponse du contr?leur re?ue");
    info!("[handle_creer_service] R?ponse du contr?leur re?ue");
    
    match response_result {
        response if response.status().is_success() => {
            eprintln!("[DEBUG][HANDLE_CREER_SERVICE] ? SUCC?S - Service cr??");
            info!("[handle_creer_service] ? Service cr?? avec succ?s");
            Ok(response)
        },
        _ => {
            eprintln!("[DEBUG][HANDLE_CREER_SERVICE] ? ERREUR - ?chec cr?ation service");
            error!("[handle_creer_service] ? Erreur cr?ation service");
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Endpoint pour création de service directe (sans détection d'intention)
async fn handle_creation_service_direct(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    Json(input): Json<MultiModalInput>,
) -> AppResult<Json<Value>> {
    let user_id = user.id;
    
    log::info!("[handle_creation_service_direct] ?? ==== Requête reçue sur /api/ia/creation-service ====");
    log::info!("[handle_creation_service_direct] User ID: {}", user_id);
    log::info!("[handle_creation_service_direct] Input: {:?}", input);
    
    // ?? NOUVEAU : Vérifier s'il y a des fichiers à traiter
    let has_images = input.base64_image.as_ref().map_or(false, |images| !images.is_empty());
    let has_audios = input.audio_base64.as_ref().map_or(false, |audios| !audios.is_empty());
    let has_videos = input.video_base64.as_ref().map_or(false, |videos| !videos.is_empty());
    let has_docs = input.doc_base64.as_ref().map_or(false, |docs| !docs.is_empty());
    let has_excels = input.excel_base64.as_ref().map_or(false, |excels| !excels.is_empty());
    
    let total_files = (has_images as usize) + (has_audios as usize) + (has_videos as usize) + (has_docs as usize) + (has_excels as usize);
    
    log::info!("[handle_creation_service_direct] Fichiers détectés: images={}, audios={}, vidéos={}, docs={}, excels={}", 
        has_images, has_audios, has_videos, has_docs, has_excels);
    
    // ?? NOUVEAU : Log détaillé des images pour debugging
    if has_images {
        if let Some(images) = &input.base64_image {
            log::info!("[handle_creation_service_direct] Images détectées: {} image(s)", images.len());
            for (i, img) in images.iter().enumerate() {
                log::info!("[handle_creation_service_direct] Image {}: {} bytes", i + 1, img.len());
            }
        }
    }
    
    // Utiliser directement le prompt de création de service sans détection d'intention
    let app_ia = state.ia.clone();
    
    // Construire le prompt de création de service
    let user_text = input.texte.clone().unwrap_or_default();
    
    // ?? UTILISER LE PROMPT SPÉCIFIQUE EXISTANT depuis le fichier .md
    let prompt_content = match std::fs::read_to_string("ia_prompts/creation_service_prompt.md") {
        Ok(content) => content,
        Err(e) => {
            log::error!("[handle_creation_service_direct] Erreur lecture prompt: {}", e);
            // Fallback : prompt simple en cas d'erreur
            format!(
                r#"Tu es un assistant spécialisé dans la création de services pour la plateforme Yukpo.

Génère un JSON strictement conforme avec ces champs obligatoires :
- titre_service (obligatoire)
- category (obligatoire) 
- description (obligatoire)
- is_tarissable (OBLIGATOIRE - boolean)

Demande utilisateur : {}

Format JSON attendu :
{{
  "intention": "creation_service",
  "data": {{
    "titre_service": {{
      "type_donnee": "string",
      "valeur": "Titre du service",
      "origine_champs": "texte_libre"
    }},
    "category": {{
      "type_donnee": "string",
      "valeur": "Catégorie métier",
      "origine_champs": "ia"
    }},
    "description": {{
      "type_donnee": "string",
      "valeur": "Description détaillée du service",
      "origine_champs": "texte_libre"
    }},
    "is_tarissable": {{
      "type_donnee": "boolean",
      "valeur": true,
      "origine_champs": "ia"
    }}
  }}
}}"#,
                user_text
            )
        }
    };
    
    // Remplacer le placeholder {user_input} par le texte réel de l'utilisateur
    let prompt = prompt_content.replace("{user_input}", &user_text);
    
    // Appeler l'IA avec le prompt de création de service
    // ?? CORRECTION : Utiliser predict_multimodal pour analyser les images
    let (response, model_name, tokens_consumed) = if has_images {
        log::info!("[handle_creation_service_direct] Appel multimodal avec {} image(s)", 
            input.base64_image.as_ref().map_or(0, |v| v.len()));
        app_ia.predict_multimodal(&prompt, input.base64_image.clone()).await?
    } else {
        log::info!("[handle_creation_service_direct] Appel texte uniquement (pas d'images)");
        app_ia.predict(&prompt).await?
    };
    
    log::info!("[handle_creation_service_direct] Model name: {}", model_name);
    log::info!("[handle_creation_service_direct] Response length: {}", response.len());
    log::info!("[handle_creation_service_direct] Response preview: {}", &response[0..response.len().min(200)]);
    
    // Extraire le JSON des backticks si présent
    let json_response = if response.contains("```json") {
        let start = response.find("```json").unwrap_or(0) + 7;
        let end = response.rfind("```").unwrap_or(response.len());
        response[start..end].trim()
    } else if response.contains("```") {
        let start = response.find("```").unwrap_or(0) + 3;
        let end = response.rfind("```").unwrap_or(response.len());
        response[start..end].trim()
    } else {
        response.trim()
    };
    
    log::info!("[handle_creation_service_direct] Réponse brute: {}", response);
    log::info!("[handle_creation_service_direct] JSON extrait: {}", json_response);
    
    // Parser la réponse JSON
    let data: Value = serde_json::from_str(json_response).map_err(|e| {
        log::error!("[handle_creation_service_direct] Erreur parsing JSON: {}", e);
        log::error!("[handle_creation_service_direct] JSON reçu: {}", json_response);
        format!("Erreur parsing JSON: {}", e)
    })?;
    
    log::info!("[handle_creation_service_direct] JSON parsé avec succès: {}", data);
    
    // ?? NOUVEAU : Extraire les données du service sans les créer dans la base
    let service_data = data.get("data").unwrap_or(&data);
    
    // ?? NOUVEAU : Préparer les données pour le formulaire (sans création en base)
    let service_request_data = json!({
        "data": service_data,
        "base64_image": input.base64_image, // Images
        "audio_base64": input.audio_base64, // Audios
        "video_base64": input.video_base64, // Vidéos
        "doc_base64": input.doc_base64, // Documents
        "excel_base64": input.excel_base64, // Excel
        "tokens_consumed": tokens_consumed,
        "ia_model_used": model_name
    });
    
    log::info!("[handle_creation_service_direct] Données préparées pour le formulaire avec {} types de fichiers...", total_files);
    
    // ?? IMPORTANT : NE PAS créer le service ici, juste préparer les données
    // Le service sera créé par le formulaire via /api/services/create
    
    // Construire la réponse finale avec la structure attendue par le frontend
    let final_response = json!({
        "status": "success",
        "intention": "creation_service",
        "data": {
            "titre_service": {
                "type_donnee": "string",
                "valeur": service_data.get("titre_service").and_then(|v| v.get("valeur")).unwrap_or(&json!("")),
                "origine_champs": "ia"
            },
            "category": {
                "type_donnee": "string",
                "valeur": service_data.get("category").and_then(|v| v.get("valeur")).unwrap_or(&json!("")),
                "origine_champs": "ia"
            },
            "description": {
                "type_donnee": "string",
                "valeur": service_data.get("description").and_then(|v| v.get("valeur")).unwrap_or(&json!("")),
                "origine_champs": "ia"
            },
            "is_tarissable": {
                "type_donnee": "boolean",
                "valeur": service_data.get("is_tarissable").and_then(|v| v.get("valeur")).unwrap_or(&json!(false)),
                "origine_champs": "ia"
            }
        },
        "tokens_consumed": tokens_consumed,
        "ia_model_used": model_name,
        "confidence": 1.0,
        "processing_mode": "preparation_formulaire",
        "interaction_id": "prep-form-".to_string() + &std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis().to_string(),
        "gpu_enabled": false,
        "optimization_level": "direct",
        "files_prepared": {
            "images": has_images,
            "audios": has_audios,
            "videos": has_videos,
            "documents": has_docs,
            "excel": has_excels,
            "total_types": total_files
        },
        "service_data": service_request_data,
        "note": "Le service sera créé par le formulaire via /api/services/create"
    });
    
    log::info!("[handle_creation_service_direct] Réponse finale construite: {}", final_response);
    log::info!("[handle_creation_service_direct] Réponse générée avec succès");
    
    Ok(Json(final_response))
}

/// Endpoint pour consulter les m?triques d'optimisation IA
async fn handle_optimization_metrics(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    let user_id = user.id;
    
    info!("[optimization_metrics] Consultation des m?triques pour utilisateur {}", user_id);
    
    // R?cup?rer le solde actuel de l'utilisateur
    let solde_result = sqlx::query!("SELECT tokens_balance FROM users WHERE id = $1", user_id)
        .fetch_one(&state.pg)
        .await;
    
    let solde_actuel = match solde_result {
        Ok(user_data) => user_data.tokens_balance,
        Err(_) => 0,
    };
    
    // M?triques d'optimisation simul?es
    let metrics = serde_json::json!({
        "user_id": user_id,
        "current_balance": solde_actuel,
        "optimizations": {
            "enabled": state.optimizations_enabled,
            "semantic_cache": {
                "available": state.optimizations_enabled,
                "estimated_hit_rate": "85%",
                "cost_savings": "R?ponses en cache = GRATUITES"
            },
            "prompt_optimizer": {
                "available": state.optimizations_enabled,
                "estimated_reduction": "30-70% des tokens",
                "cost_savings": "40% de r?duction moyenne sur les co?ts"
            }
        },
        "pricing": {
            "assistance_generale": {
                "cost_per_token": "0.1 XAF",
                "with_optimization": "0.06 XAF (r?duction de 40%)"
            },
            "recherche_besoin": {
                "cost_per_token": "0.1 XAF", 
                "with_optimization": "0.06 XAF (r?duction de 40%)"
            },
            "creation_service": {
                "cost_per_token": "1.0 XAF",
                "with_optimization": "0.6 XAF (r?duction de 40%)"
            }
        },
        "tips": [
            "?? Les r?ponses en cache sont GRATUITES - m?me question = 0 co?t",
            "?? L'optimisation de prompts r?duit automatiquement vos co?ts de 30-70%",
            "? Les r?ponses optimis?es sont 10x plus rapides",
            "?? Consultez les headers x-response-source pour voir l'origine de vos r?ponses"
        ],
        "status": if state.optimizations_enabled { "ACTIVE" } else { "DISABLED" }
    });
    
    Ok(axum::Json(metrics).into_response())
}

/// Handler pour le géocodage inverse (coordonnées GPS vers adresse)
#[axum::debug_handler]
async fn handle_reverse_geocode(
    Json(payload): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    use crate::services::geocoding_service::GeocodingService;
    
    // Extraire les coordonnées
    let lat = payload["latitude"]
        .as_f64()
        .ok_or_else(|| AppError::BadRequest("latitude manquante ou invalide".to_string()))?;
    
    let lng = payload["longitude"]
        .as_f64()
        .ok_or_else(|| AppError::BadRequest("longitude manquante ou invalide".to_string()))?;
    
    // Valider les coordonnées
    if lat < -90.0 || lat > 90.0 || lng < -180.0 || lng > 180.0 {
        return Err(AppError::BadRequest("Coordonnées GPS invalides".to_string()));
    }
    
    // Créer le service de géocodage et effectuer la requête
    let geocoding_service = GeocodingService::new();
    let result = geocoding_service.reverse_geocode(lat, lng).await?;
    
    Ok(Json(result))
}

/// Servir les fichiers média
async fn serve_media_file(
    Path(file_path): Path<String>,
) -> Result<Response<Body>, StatusCode> {
    info!("[serve_media_file] Demande fichier: {}", file_path);
    
    // Sécurité : vérifier que le chemin ne contient pas de traversée de répertoire
    if file_path.contains("..") || file_path.contains("~") {
        warn!("[serve_media_file] Tentative de traversée de répertoire: {}", file_path);
        return Err(StatusCode::BAD_REQUEST);
    }
    
    // Construire le chemin complet
    let full_path = format!("uploads/services/{}", file_path);
    info!("[serve_media_file] Chemin complet: {}", full_path);
    
    // Lire le fichier
    match File::open(&full_path).await {
        Ok(mut file) => {
            let mut contents = Vec::new();
            match file.read_to_end(&mut contents).await {
                Ok(_) => {
                    // Déterminer le type MIME
                    let content_type = if file_path.ends_with(".jpg") || file_path.ends_with(".jpeg") {
                        "image/jpeg"
                    } else if file_path.ends_with(".png") {
                        "image/png"
                    } else if file_path.ends_with(".gif") {
                        "image/gif"
                    } else if file_path.ends_with(".mp4") {
                        "video/mp4"
                    } else if file_path.ends_with(".webm") {
                        "video/webm"
                    } else if file_path.ends_with(".wav") {
                        "audio/wav"
                    } else if file_path.ends_with(".mp3") {
                        "audio/mpeg"
                    } else if file_path.ends_with(".pdf") {
                        "application/pdf"
                    } else {
                        "application/octet-stream"
                    };
                    
                    let mut headers = HeaderMap::new();
                    headers.insert("content-type", HeaderValue::from_str(content_type).unwrap());
                    headers.insert("cache-control", HeaderValue::from_str("public, max-age=3600").unwrap());
                    
                    let file_size = contents.len();
                    let response = Response::builder()
                        .status(StatusCode::OK)
                        .body(Body::from(contents))
                        .unwrap();
                        
                    info!("[serve_media_file] Fichier servi: {} ({} bytes)", file_path, file_size);
                    Ok(response)
                },
                Err(e) => {
                    error!("[serve_media_file] Erreur lecture fichier {}: {:?}", full_path, e);
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        },
        Err(_) => {
            warn!("[serve_media_file] Fichier non trouvé: {}", full_path);
            Err(StatusCode::NOT_FOUND)
        }
    }
}
