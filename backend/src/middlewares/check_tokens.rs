use axum::{
    body::Body,
    http::Request,
    middleware::Next,
    response::Response,
    extract::State,
    Extension,
    http::StatusCode,
    http::header::HeaderValue,
};
use crate::state::AppState;
use crate::middlewares::jwt::AuthenticatedUser;
use std::sync::Arc;
use std::convert::Infallible;
use log::{info, warn, error, debug};
use sqlx;
use serde_json::Value;
use std::time::Instant;
use crate::utils::jwt_manager::generate_jwt;

/// ?? Conversion tokens IA vers co?t en XAF selon l'intention (tarification diff?renci?e)
/// L'application facture en multipliant la valeur FCFA du token OpenAI selon l'intention
fn calculer_cout_xaf(tokens_ia_consommes: i64, intention: &str) -> i64 {
    // Co?t r?el d'un token OpenAI en FCFA
    let cout_token_openai_fcfa: f64 = 0.004;
    
    let cout_base_fcfa = (tokens_ia_consommes as f64) * cout_token_openai_fcfa;
    
    match intention {
        "creation_service" => (cout_base_fcfa * 100.0) as i64,  // Multiplier par 100 pour cr?ation de service
        "recherche_besoin" => 0, // Recherche entièrement gratuite
        "demande_echange" | "assistance_generale" => (cout_base_fcfa * 10.0) as i64, // Multiplier par 10 pour autres intentions
        _ => (cout_base_fcfa * 10.0) as i64, // Multiplier par 10 par d?faut
    }
}

/// Convertit le co?t XAF en tokens équivalents pour la déduction du solde
/// Cette fonction assure la cohérence entre l'affichage frontend et la déduction du solde
fn convertir_cout_xaf_en_tokens(cout_xaf: i64) -> i64 {
    // Équivalence 1:1 pour maintenir la cohérence
    // 1 XAF = 1 token dans le système de balance
    cout_xaf
}

/// ?? Mettre ? jour le JWT avec le nouveau solde
pub async fn update_jwt_with_new_balance(
    user_id: i32,
    new_balance: i64,
    state: &Arc<AppState>
) -> Result<String, Box<dyn std::error::Error>> {
    // R?cup?rer les informations utilisateur
    let user_data = sqlx::query!(
        "SELECT email, role FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&state.pg)
    .await?;

    // G?n?rer un nouveau JWT avec le solde mis ? jour
    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| "JWT_SECRET manquant")?;
    
    let new_jwt = generate_jwt(
        user_id,
        &user_data.role,
        &user_data.email,
        new_balance,
        &secret,
    )?;

    Ok(new_jwt)
}

/// Structure pour une r?ponse du cache ou optimis?e
#[derive(Debug)]
struct OptimizedResponse {
    content: Value,
    _tokens_consumed: i64,
    _source: ResponseSource,
    processing_time_ms: u64,
}

#[derive(Debug)]
enum ResponseSource {
    _Cache,           // R?ponse vient du cache s?mantique
    _OptimizedPrompt, // Prompt optimis? avant appel IA
    _External,        // Appel IA externe classique
}

/// Tenter d'utiliser le cache s?mantique avant l'appel IA externe
async fn try_semantic_cache(
    state: &Arc<AppState>,
    _request_content: &Value,
    intention: &str,
) -> Option<OptimizedResponse> {
    debug!("[check_tokens] V?rification cache s?mantique pour intention: {}", intention);
    
    // V?rifier si les optimisations sont activ?es
    if !state.optimizations_enabled {
        debug!("[check_tokens] Optimisations d?sactiv?es, pas de cache");
        return None;
    }

    // Simuler la v?rification du cache s?mantique
    // TODO: Impl?menter la vraie logique du cache quand les modules seront r?activ?s
    debug!("[check_tokens] Cache simul?: pas de r?ponse trouv?e pour intention {}", intention);
    None
}

/// Optimiser le prompt avant l'appel IA externe
async fn optimize_prompt_if_enabled(
    state: &Arc<AppState>,
    _request_content: &mut Value,
    intention: &str,
) -> bool {
    debug!("[check_tokens] Optimisation de prompt pour intention: {}", intention);
    
    if !state.optimizations_enabled {
        return false;
    }

    // Simuler l'optimisation de prompt
    debug!("[check_tokens] Optimisation simul?e: prompt optimis? pour intention {}", intention);
    true // Simuler une optimisation r?ussie
}

/// Sauvegarder la r?ponse dans le cache s?mantique pour utilisation future
async fn save_to_cache_if_enabled(
    state: Arc<AppState>,
    _request_content: Value,
    _response_content: Value,
    intention: String,
    _tokens_consumed: i64,
) {
    if !state.optimizations_enabled {
        return;
    }

    debug!("[check_tokens] Cache simul?: r?ponse sauvegard?e pour intention {}", intention);
}

/// Extraire les tokens consomm?s depuis la r?ponse de l'IA
fn extraire_tokens_consommes_depuis_reponse(response: &Response) -> Option<i64> {
    // 1. V?rifier le header personnalis? x-tokens-consumed
    if let Some(tokens_header) = response.headers().get("x-tokens-consumed") {
        if let Ok(tokens_str) = tokens_header.to_str() {
            if let Ok(tokens) = tokens_str.parse::<i64>() {
                return Some(tokens);
            }
        }
    }
    
    // 2. Estimation bas?e sur la taille de la r?ponse et le type de contenu
    let content_length = response.headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(500);
    
    let content_type = response.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/json");
    
    // Estimation intelligente selon le type de contenu
    let estimated_tokens = if content_type.contains("json") {
        // Pour JSON, estimation bas?e sur la complexit? suppos?e
        match content_length {
            0..=500 => 15,     // R?ponse simple (cr?ation de service basique)
            501..=2000 => 25,  // R?ponse moyenne (service avec plusieurs champs)
            2001..=5000 => 40, // R?ponse complexe (service d?taill?)
            _ => 60,           // R?ponse tr?s complexe
        }
    } else {
        // Pour autres types, estimation plus conservatrice
        (content_length / 100).max(10) as i64
    };
    
    Some(estimated_tokens)
}

pub async fn check_tokens(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, Infallible> {
    let start_time = Instant::now();
    let user_id = user.id;
    
    // Extraire l'intention depuis le body de la requ?te
    let (parts, body) = req.into_parts();
    let body_bytes = match axum::body::to_bytes(body, usize::MAX).await {
        Ok(bytes) => bytes,
        Err(e) => {
            error!("[check_tokens] Erreur lecture body: {}", e);
            let response = Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"error":"Erreur lecture requ?te"}"#))
                .unwrap();
            return Ok(response);
        }
    };
    
    // Parser le JSON pour extraire l'intention et le contenu
    let mut request_json = match serde_json::from_slice::<Value>(&body_bytes) {
        Ok(json) => json,
        Err(_) => {
            error!("[check_tokens] JSON invalide");
            let response = Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"error":"JSON invalide"}"#))
                .unwrap();
            return Ok(response);
        }
    };
    
    // ?? D?tecter l'intention rapidement avant l'appel IA
    // Chercher d'abord à la racine, puis dans data.intention pour compatibilité
    let intention = request_json.get("intention")
        .and_then(|v| v.as_str())
        .or_else(|| {
            request_json.get("data")
                .and_then(|data| data.get("intention"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or("assistance_generale")
        .to_string();
    
    info!("[check_tokens] ?? Traitement requ?te pour utilisateur {} (intention: {})", user_id, intention);
    
    // V?rifier le solde avant traitement
    let solde_result = sqlx::query!("SELECT tokens_balance FROM users WHERE id = $1", user_id)
        .fetch_one(&state.pg)
        .await;
    
    match solde_result {
        Ok(user_data) => {
            let solde_actuel = user_data.tokens_balance;
            
            // Estimation minimale pour v?rifier si l'utilisateur peut payer
            let estimation_minimale = calculer_cout_xaf(1, &intention);
            
            // Permettre la recherche même avec un solde insuffisant
            // Le coût sera déduit après traitement si le solde le permet
            if solde_actuel < estimation_minimale {
                warn!("[check_tokens] Solde insuffisant pour utilisateur {} (intention: {}): {} < {}, mais recherche autorisée", user_id, intention, solde_actuel, estimation_minimale);
            }
            
            // ?? ?TAPE 1 : V?rifier le cache s?mantique en premier
            if let Some(cached_response) = try_semantic_cache(&state, &request_json, &intention).await {
                info!("[check_tokens] ? R?ponse depuis cache (GRATUIT) en {}ms", cached_response.processing_time_ms);
                
                let response = Response::builder()
                    .status(StatusCode::OK)
                    .header("content-type", "application/json")
                    .header("x-tokens-consumed", "0")
                    .header("x-tokens-remaining", solde_actuel.to_string())
                    .header("x-response-source", "cache")
                    .header("x-processing-time-ms", cached_response.processing_time_ms.to_string())
                    .body(Body::from(serde_json::to_string(&cached_response.content).unwrap_or_default()))
                    .unwrap();
                
                return Ok(response);
            }
            
            // ?? ?TAPE 2 : Optimiser le prompt avant l'appel IA externe
            let prompt_optimized = optimize_prompt_if_enabled(&state, &mut request_json, &intention).await;
            
            // Reconstituer la requ?te avec le contenu potentiellement optimis?
            let optimized_body = serde_json::to_vec(&request_json).unwrap_or(body_bytes.to_vec());
            let mut req = Request::from_parts(parts, Body::from(optimized_body));
            req.extensions_mut().insert(user.clone());

            if prompt_optimized {
                info!("[check_tokens] ? Prompt optimis? avant appel IA externe");
            }
            
            // ?? ?TAPE 3 : Appel IA externe (classique ou optimis?)
            let mut response = next.run(req).await;
            
            // Extraire les tokens consomm?s depuis la r?ponse
            let tokens_consommes = extraire_tokens_consommes_depuis_reponse(&response).unwrap_or(25);
            
            // Utiliser les tokens r?els sans r?duction d'optimisation
            let tokens_finaux = tokens_consommes;
            
            // Calculer le co?t r?el en XAF
            let cout_reel_xaf = calculer_cout_xaf(tokens_finaux, &intention);
            
            // Convertir le co?t XAF en tokens équivalents pour la déduction
            // Cette conversion assure la cohérence entre l'affichage frontend et la déduction du solde
            let cout_en_tokens = convertir_cout_xaf_en_tokens(cout_reel_xaf);
            
            // V?rifier ? nouveau le solde avec le co?t en tokens
            let solde_final_result = sqlx::query!("SELECT tokens_balance FROM users WHERE id = $1", user_id)
                .fetch_one(&state.pg)
                .await;
                
            if let Ok(user_final) = solde_final_result {
                if user_final.tokens_balance >= cout_en_tokens {
                    // D?duire le co?t en tokens (pas en XAF)
                    let nouveau_solde = user_final.tokens_balance - cout_en_tokens;
                    let update_result = sqlx::query!(
                        "UPDATE users SET tokens_balance = $1 WHERE id = $2", 
                        nouveau_solde, 
                        user_id
                    ).execute(&state.pg).await;
                        
                    match update_result {
                        Ok(_) => {
                            let processing_time = start_time.elapsed().as_millis() as u64;
                            
                            info!("[check_tokens] ? {} tokens IA consommés ({} XAF = {} tokens) déduits pour utilisateur {}: {} -> {} (intention: {}, durée: {}ms)",
                                tokens_finaux, cout_reel_xaf, cout_en_tokens, user_id, user_final.tokens_balance, nouveau_solde, intention, processing_time);
                            
                            // ?? Mettre ? jour le JWT avec le nouveau solde
                            if let Ok(new_jwt) = update_jwt_with_new_balance(user_id, nouveau_solde, &state).await {
                                response.headers_mut().insert(
                                    "x-new-jwt",
                                    HeaderValue::from_str(&new_jwt).unwrap()
                                );
                                info!("[check_tokens] ?? JWT mis ? jour avec le nouveau solde: {}", nouveau_solde);
                            } else {
                                warn!("[check_tokens] ?? Impossible de mettre ? jour le JWT, mais le d?bit a ?t? effectu?");
                            }
                            
                            // ?? ?TAPE 4 : Sauvegarder en cache pour usage futur (asynchrone)
                            let state_clone = state.clone();
                            let request_clone = request_json.clone();
                            let intention_clone = intention.clone();
                            
                            tokio::spawn(async move {
                                save_to_cache_if_enabled(
                                    state_clone,
                                    request_clone,
                                    serde_json::json!({"simulated": "response"}), // Simul?
                                    intention_clone,
                                    tokens_finaux
                                ).await;
                            });
                            
                            // Ajouter headers informatifs
                            response.headers_mut().insert(
                                "x-tokens-remaining",
                                HeaderValue::from_str(&nouveau_solde.to_string()).unwrap()
                            );
                            response.headers_mut().insert(
                                "x-tokens-consumed",
                                HeaderValue::from_str(&tokens_finaux.to_string()).unwrap()
                            );
                            response.headers_mut().insert(
                                "x-response-source",
                                HeaderValue::from_str(if prompt_optimized { "optimized" } else { "external" }).unwrap()
                            );
                            response.headers_mut().insert(
                                "x-processing-time-ms",
                                HeaderValue::from_str(&processing_time.to_string()).unwrap()
                            );
                            response.headers_mut().insert(
                                "x-tokens-cost-xaf",
                                HeaderValue::from_str(&cout_reel_xaf.to_string()).unwrap()
                            );
                        },
                        Err(e) => {
                            error!("[check_tokens] Erreur lors de la d?duction de tokens pour utilisateur {}: {}", user_id, e);
                            let response = Response::builder()
                                .status(StatusCode::INTERNAL_SERVER_ERROR)
                                .header("content-type", "application/json")
                                .header("x-tokens-deduction-error", "1")
                                .body(Body::from(r#"{"error":"Erreur lors de la d?duction des tokens. Aucun co?t n'a ?t? d?bit?, veuillez r?essayer."}"#))
                                .unwrap();
                            return Ok(response);
                        }
                    }
                } else {
                    // Solde insuffisant après traitement, mais la recherche a été effectuée
                    warn!("[check_tokens] Solde insuffisant apr?s traitement pour utilisateur {}: {} < {} (recherche effectuée sans d?bit)", user_id, user_final.tokens_balance, cout_en_tokens);
                    // Ajouter headers informatifs sans débit
                    response.headers_mut().insert(
                        "x-tokens-remaining",
                        HeaderValue::from_str(&user_final.tokens_balance.to_string()).unwrap()
                    );
                    response.headers_mut().insert(
                        "x-tokens-consumed",
                        HeaderValue::from_str(&tokens_finaux.to_string()).unwrap()
                    );
                    response.headers_mut().insert(
                        "x-response-source",
                        HeaderValue::from_str(if prompt_optimized { "optimized" } else { "external" }).unwrap()
                    );
                    response.headers_mut().insert(
                        "x-processing-time-ms",
                        HeaderValue::from_str(&start_time.elapsed().as_millis().to_string()).unwrap()
                    );
                    response.headers_mut().insert(
                        "x-tokens-cost-xaf",
                        HeaderValue::from_str("0").unwrap() // Pas de débit
                    );
                    response.headers_mut().insert(
                        "x-payment-warning",
                        HeaderValue::from_str("Solde insuffisant, recherche effectuée gratuitement").unwrap()
                    );
                }
            }
            
            return Ok(response);
        },
        Err(e) => {
            error!("[check_tokens] Erreur lors de la r?cup?ration du solde pour utilisateur {}: {}", user_id, e);
            let response = Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"error":"Erreur lors de la v?rification du solde"}"#))
                .unwrap();
            Ok(response)
        }
    }
} 
