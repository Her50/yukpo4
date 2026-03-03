use crate::utils::log::{log_error, log_warn};
use axum::{
    body::Body,
    extract::{Extension, Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::Response,
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use log::{error, info, warn};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::fs::File;
use tokio::io::AsyncReadExt;
use uuid::Uuid;

use crate::models::input_model::MultiModalInput;
use crate::{
    controllers::{
        intelligent_service_controller::{
            get_services_pending_processing, process_services_intelligently,
            reactivate_service_intelligent,
        },
        interaction_controller::{
            get_service_interactions, get_service_reviews, get_service_score, get_service_stats,
            get_services_reviews_batch_endpoint, get_services_stats_batch_endpoint, post_audio,
            post_call, post_message, post_review, post_review_helpful, post_share,
        },
        service_controller::{
            get_service_by_id, get_services_for_prestataire, modifier_service, supprimer_service,
            toggle_service_status,
        },
    },
    core::types::{AppError, AppResult},
    middlewares::{
        audit_log, check_tokens::check_tokens, hide_headers, jwt::jwt_auth, monitoring, rate_limit,
        request_size_limit, service_interaction::track_service_interaction,
    },
    routes::{
        ai_chat_routes::ai_chat_routes, nearby_services_routes::nearby_services_routes,
        weather_routes::weather_routes,
    },
    services::creer_service,
    state::AppState,
};
use axum::response::IntoResponse;
use sqlx::Row;

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
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            rate_limit,
        ))
        .layer(axum::middleware::from_fn(hide_headers::hide_headers))
        .layer(axum::middleware::from_fn(
            request_size_limit::request_size_limit,
        ));

    // Routes prot?g?es avec middleware JWT
    let protected_routes = Router::new()
        .route(
            "/api/ia/auto",
            post(handle_yukpo).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                check_tokens,
            )),
        )
        .route(
            "/api/ia/creation-service",
            post(handle_creation_service_direct).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                check_tokens,
            )),
        )
        .route(
            "/api/ia/creation-offre-emploi",
            post(handle_creation_offre_emploi_direct).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                check_tokens,
            )),
        )
        .route(
            "/api/search/direct",
            post(handle_direct_search).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                check_tokens,
            )),
        )
        // Nouveau endpoint pour consulter les m?triques d'optimisation
        .route("/api/ia/metrics", get(handle_optimization_metrics))
        // Routes d'interaction sur services avec middleware de tracking et d?bit prestataire
        .route(
            "/api/services/{id}/message",
            post(post_message)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                ))
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    track_service_interaction,
                )),
        )
        .route(
            "/api/services/{id}/reviews",
            post(post_review)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                ))
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    track_service_interaction,
                )),
        )
        .route(
            "/api/services/{id}/interactions",
            get(get_service_interactions),
        )
        .route("/api/services/{id}/reviews", get(get_service_reviews))
        .route(
            "/api/services/batch/reviews",
            get(get_services_reviews_batch_endpoint),
        )
        .route("/api/services/{id}/score", get(get_service_score))
        .route("/api/services/{id}/stats", get(get_service_stats))
        .route(
            "/api/services/batch/stats",
            get(get_services_stats_batch_endpoint),
        )
        .route(
            "/api/services/{id}/audio",
            post(post_audio)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                ))
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    track_service_interaction,
                )),
        )
        .route(
            "/api/services/{id}/call",
            post(post_call)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                ))
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    track_service_interaction,
                )),
        )
        .route(
            "/api/services/{id}/share",
            post(post_share)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                ))
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    track_service_interaction,
                )),
        )
        .route(
            "/api/reviews/{id}/helpful",
            post(post_review_helpful).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                jwt_auth,
            )),
        )
        // Routes de cr?ation de service (gestion des tokens dans le contrôleur)
        .route("/api/services/draft", post(handle_brouillon_service))
        .route(
            "/api/services/create",
            post(handle_creer_service).layer(axum::extract::DefaultBodyLimit::max(200_000_000)), // ✅ 200 MB - pour supporter médias base64 volumineux
        )
        // Route pour r?cup?rer tous les services du prestataire connect?
        .route(
            "/api/prestataire/services",
            get(get_services_for_prestataire),
        )
        // Route pour activer/d?sactiver un service
        .route(
            "/api/services/{service_id}/toggle-status",
            patch(toggle_service_status),
        )
        // Route pour modifier un service
        .route(
            "/api/services/{service_id}/update",
            put(modifier_service).post(modifier_service),
        )
        // Route pour supprimer un service
        .route(
            "/api/services/{service_id}/delete",
            delete(supprimer_service),
        )
        // Route pour r?cup?rer un service par ID (public)
        .route("/api/services/{service_id}", get(get_service_by_id))
        // Route pour récupérer les médias d'un service
        .route(
            "/api/services/{service_id}/media",
            get(crate::controllers::media_controller::get_service_media),
        )
        // Route pour ajouter un produit à un service existant
        // ✅ CORRECTION 2025-12-30: Ajouter DefaultBodyLimit pour supporter les images base64 volumineuses
        .route(
            "/api/services/{service_id}/products",
            post(crate::controllers::product_addition_controller::add_product_to_service)
                .layer(axum::extract::DefaultBodyLimit::max(200_000_000)), // 200 MB
        )
        // ✅ NOUVEAU 2026-01-02: Route pour vérifier le statut d'un job de création de produit
        .route(
            "/api/services/{service_id}/products/queue/{job_id}",
            get(crate::controllers::product_addition_controller::get_product_creation_status),
        )
        // Route pour récupérer les informations d'un utilisateur par ID
        .route(
            "/api/users/{user_id}",
            get(crate::controllers::user_controller::get_user_by_id),
        )
        // Route pour récupérer le dernier service (pour préremplissage contact)
        .route(
            "/api/services/last",
            get(crate::controllers::service_controller::get_last_service_for_user),
        )
        // Routes pour le système intelligent de gestion des services
        .route(
            "/api/admin/process-services-intelligently",
            post(process_services_intelligently),
        )
        .route(
            "/api/admin/services-pending-processing",
            get(get_services_pending_processing),
        )
        .route(
            "/api/services/{service_id}/reactivate-intelligent",
            post(reactivate_service_intelligent),
        )
        .layer(axum::middleware::from_fn(jwt_auth))
        .layer(axum::middleware::from_fn(monitoring::monitoring))
        .layer(axum::middleware::from_fn(audit_log::audit_log))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            rate_limit,
        ))
        .layer(axum::middleware::from_fn(hide_headers::hide_headers))
        .layer(axum::middleware::from_fn(
            request_size_limit::request_size_limit,
        ));

    // Routes publiques pour les APIs mobiles
    let mobile_routes = Router::<Arc<AppState>>::new()
        .merge(weather_routes(state.clone()))
        .merge(nearby_services_routes(state.clone()))
        .merge(ai_chat_routes(state.clone()))
        // ✅ NOUVEAU 2026-02-10: Routes pour Google Places (autocomplete et détails business)
        .merge(crate::routes::places_routes::places_routes(state.clone()));

    // ✅ NOUVEAU: Routes pour @mentions et multi-participants conversations
    let conversation_routes_merged =
        crate::routes::conversation_routes::conversation_routes(state.clone());

    // ✅ NOUVEAU: Routes pour signalements
    let signalement_routes_merged =
        crate::routes::signalement_routes::signalement_routes(state.clone());

    // ✅ NOUVEAU: Routes pour validation des partenaires (admin)
    let partner_validation_routes_merged =
        crate::routes::partner_validation_routes::partner_validation_routes(state.clone());

    // ✅ NOUVEAU: Routes pour recherche avec planifications
    let scheduling_search_routes_merged =
        crate::routes::scheduling_search_routes::scheduling_search_routes(state.clone());

    // ✅ NOUVEAU: Routes pour gestion d'équipe des services
    let service_team_routes_merged =
        crate::routes::service_team_routes::service_team_routes(state.clone());

    // ✅ NOUVEAU: Routes pour recherche par image
    let image_search_routes_merged =
        crate::routes::image_search_routes::image_search_routes(state.clone());

    // ✅ NOUVEAU: Routes pour système de publicité (intégrées directement)
    use crate::controllers::publicite_controller;
    let publicite_routes_inline = Router::new()
        .route(
            "/api/publicites/create",
            post(publicite_controller::create_publicite),
        )
        .route(
            "/api/publicites/{id}/update",
            post(publicite_controller::update_publicite),
        )
        .route(
            "/api/publicites/{id}",
            get(publicite_controller::get_publicite_by_id),
        )
        .route(
            "/api/publicites/actives",
            get(publicite_controller::get_active_publicites),
        )
        .route(
            "/api/publicites/dashboard",
            get(publicite_controller::get_publicite_dashboard),
        )
        .route(
            "/api/publicites/track-click",
            post(publicite_controller::track_publicite_click),
        )
        .route(
            "/api/publicites/track-view",
            post(publicite_controller::track_publicite_view),
        );

    // Combinaison des routes
    public_routes
        .merge(protected_routes)
        .merge(mobile_routes)
        .merge(conversation_routes_merged)
        .merge(signalement_routes_merged)
        .merge(partner_validation_routes_merged)
        .merge(scheduling_search_routes_merged)
        .merge(service_team_routes_merged)
        .merge(image_search_routes_merged)
        .merge(publicite_routes_inline)
        .with_state(state)
}

/// 🖼️ Handler pour la recherche directe (sans détection d'intention)
/// Supporte la recherche par texte ET par image
#[axum::debug_handler]
async fn handle_direct_search(
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
    Json(input): Json<MultiModalInput>,
) -> AppResult<impl IntoResponse> {
    use crate::services::rechercher_besoin::rechercher_besoin_direct;
    use crate::utils::log::log_info;

    log_info(&format!(
        "[DIRECT_SEARCH] Recherche directe pour utilisateur {} (GPS: {:?})",
        user.id, input.gps_mobile
    ));

    // Extraire le texte de l'input
    let mut user_text = input.texte.clone().unwrap_or_default();
    let has_text = !user_text.trim().is_empty();
    let has_images = input.base64_image.as_ref().map(|imgs| !imgs.is_empty()).unwrap_or(false);
    let has_audio = input.audio_base64.as_ref().map(|audios| !audios.is_empty()).unwrap_or(false);

    log_info(&format!(
        "[DIRECT_SEARCH] Contenu: texte={}, images={}, audio={}",
        has_text, has_images, has_audio
    ));

    // ✅ NOUVEAU 2025-01-01: Si audio présent, transcrire et utiliser pour la recherche
    // ✅ CORRIGÉ 2026-01-30: Gestion améliorée des erreurs de transcription
    if has_audio {
        use crate::services::audio_transcription_service::AudioTranscriptionService;
        use crate::utils::log::log_error;

        log_info("[DIRECT_SEARCH] 🎤 Audio détecté - Transcription activée");

        let audios = input.audio_base64.as_ref().unwrap();
        let first_audio = &audios[0];

        // Transcrire l'audio avec cache
        match AudioTranscriptionService::transcribe_audio_base64_with_cache(&_state.pg, first_audio)
            .await
        {
            Ok(transcription) => {
                let transcribed_text = transcription.text.trim();
                log_info(&format!(
                    "[DIRECT_SEARCH] ✅ Audio transcrit: '{}' (langue: {:?}, confiance: {:?})",
                    &transcribed_text.chars().take(100).collect::<String>(),
                    transcription.language,
                    transcription.confidence
                ));

                // ✅ CORRIGÉ: Vérifier si la transcription est valide (pas un message d'erreur)
                let is_error_message = transcribed_text.starts_with("[Audio non transcrit")
                    || transcribed_text.starts_with("[Erreur transcription")
                    || transcribed_text.is_empty();

                if !is_error_message {
                    // ✅ Transcription valide : utiliser pour la recherche
                    if has_text {
                        // Combiner texte existant + transcription
                        user_text = format!("{} {}", user_text, transcribed_text);
                        log_info(
                            "[DIRECT_SEARCH] Texte combiné (texte original + transcription audio)",
                        );
                    } else {
                        // Utiliser uniquement la transcription
                        user_text = transcribed_text.to_string();
                        log_info("[DIRECT_SEARCH] Utilisation de la transcription audio comme texte de recherche");
                    }
                } else {
                    // ✅ CORRIGÉ: Si transcription échouée et pas de texte, retourner une erreur claire
                    log_error(&format!(
                        "[DIRECT_SEARCH] ⚠️ Transcription audio échouée: '{}'",
                        transcribed_text
                    ));

                    if !has_text {
                        // Pas de texte et transcription échouée : retourner erreur explicite
                        let error_message = if transcribed_text.contains("API non configurée") {
                            "La transcription audio n'est pas configurée. Veuillez configurer OPENAI_API_KEY ou utiliser la recherche par texte."
                        } else if transcribed_text.starts_with("[Erreur transcription") {
                            "Erreur lors de la transcription audio. Veuillez réessayer ou utiliser la recherche par texte."
                        } else {
                            "Impossible de transcrire l'audio. Veuillez utiliser la recherche par texte."
                        };

                        let response = serde_json::json!({
                            "status": "error",
                            "message": error_message,
                            "error": "audio_transcription_failed",
                            "resultats": [],
                            "nombre_matchings": 0
                        });
                        return Ok(Json(response));
                    } else {
                        // Il y a du texte : continuer avec le texte uniquement
                        log_info("[DIRECT_SEARCH] Transcription audio échouée, utilisation du texte original uniquement");
                    }
                }
            }
            Err(e) => {
                log_error(&format!(
                    "[DIRECT_SEARCH] ❌ Erreur transcription audio: {:?}",
                    e
                ));
                // ✅ CORRIGÉ: Si pas de texte et erreur de transcription, retourner erreur claire
                if !has_text {
                    let response = serde_json::json!({
                        "status": "error",
                        "message": format!("Erreur lors de la transcription audio: {}. Veuillez utiliser la recherche par texte.", e),
                        "error": "audio_transcription_failed",
                        "resultats": [],
                        "nombre_matchings": 0
                    });
                    return Ok(Json(response));
                } else {
                    // Il y a du texte : continuer avec le texte uniquement
                    log_info("[DIRECT_SEARCH] Erreur transcription audio, utilisation du texte original uniquement");
                }
            }
        }
    }

    // ✅ NOUVELLE LOGIQUE: Si image présente (avec ou sans texte), utiliser analyse IA
    if has_images {
        use crate::services::intelligent_image_analysis_service::IntelligentImageAnalysisService;

        log_info("[DIRECT_SEARCH] 🖼️ Image détectée - Analyse IA activée");

        let images = input.base64_image.as_ref().unwrap();
        let first_image = &images[0];

        // Extraire le base64 pur
        let image_base64 = if first_image.contains("base64,") {
            first_image.split("base64,").nth(1).unwrap_or(first_image).to_string()
        } else {
            first_image.clone()
        };

        // ✅ RECHERCHE PAR IMAGE GRATUITE - Plus de vérification de solde ni facturation
        log_info("[DIRECT_SEARCH] 🆓 Recherche par image gratuite activée");

        // 1️⃣ Analyser l'image avec IA multi-modèles
        log_info("[DIRECT_SEARCH] Analyse IA de l'image...");

        let analysis_result = IntelligentImageAnalysisService::analyze_image_multimodel(
            &_state.ia,
            &image_base64,
            None, // Catégorie auto-détectée
            true, // Mode recherche
        )
        .await;

        match analysis_result {
            Ok((analysis, ai_cost)) => {
                log_info(&format!(
                    "[DIRECT_SEARCH] ✅ Analyse IA réussie: '{}' (confiance: {}, tokens: {})",
                    &analysis.description.chars().take(50).collect::<String>(),
                    analysis.confiance,
                    ai_cost.total_tokens
                ));

                // ✅ NOUVEAU: Extraire TOUS les mots-clés du JSON IA et construire une requête de recherche textuelle
                // (comme pour la transcription audio - réutiliser le même circuit de recherche)
                let mut image_keywords = Vec::new();

                // 1. Ajouter search_query (déjà optimisé par l'IA)
                if !analysis.search_query.is_empty() {
                    image_keywords.push(analysis.search_query.clone());
                }

                // 2. Ajouter description (mots-clés supplémentaires)
                if !analysis.description.is_empty() {
                    // Extraire les mots importants de la description
                    let desc_words: Vec<&str> = analysis
                        .description
                        .split_whitespace()
                        .filter(|w| w.len() > 3) // Ignorer mots trop courts
                        .take(10) // Limiter à 10 mots les plus importants
                        .collect();
                    image_keywords.extend(desc_words.iter().map(|s| s.to_string()));
                }

                // 3. Ajouter tous les tags
                image_keywords.extend(analysis.tags.iter().cloned());

                // 4. Ajouter catégorie
                if !analysis.category_detected.is_empty() {
                    image_keywords.push(analysis.category_detected.clone());
                }

                // 5. Ajouter marque si présente
                if let Some(marque) = &analysis.marque {
                    if !marque.is_empty() {
                        image_keywords.push(marque.clone());
                    }
                }

                // 6. Ajouter toutes les couleurs
                image_keywords.extend(analysis.couleurs.iter().cloned());

                // 7. Ajouter toutes les valeurs de caracteristiques_cles (générique - sans hardcoder)
                for (key, value) in &analysis.caracteristiques_cles {
                    if !key.is_empty() {
                        image_keywords.push(key.clone());
                    }
                    if !value.is_empty() {
                        // Si la valeur contient plusieurs mots, les ajouter séparément
                        let value_words: Vec<&str> = value.split_whitespace().collect();
                        if value_words.len() == 1 {
                            image_keywords.push(value.clone());
                        } else {
                            // Plusieurs mots, ajouter les plus importants
                            image_keywords.extend(
                                value_words
                                    .iter()
                                    .filter(|w| w.len() > 3)
                                    .take(3)
                                    .map(|s| s.to_string()),
                            );
                        }
                    }
                }

                // Construire la requête de recherche textuelle à partir de tous les mots-clés
                let image_search_query = image_keywords.join(" ");

                log_info(&format!(
                    "[DIRECT_SEARCH] Mots-clés extraits du JSON IA: {} ({} mots-clés)",
                    &image_search_query.chars().take(100).collect::<String>(),
                    image_keywords.len()
                ));

                // ✅ Utiliser le même circuit que la transcription audio : ajouter à user_text
                if has_text {
                    // Combiner texte existant + mots-clés de l'image
                    user_text = format!("{} {}", user_text, image_search_query);
                    log_info("[DIRECT_SEARCH] Texte combiné (texte original + mots-clés image IA)");
                } else {
                    // Utiliser uniquement les mots-clés de l'image
                    user_text = image_search_query;
                    log_info("[DIRECT_SEARCH] Utilisation des mots-clés image IA comme texte de recherche");
                }

                // Continuer vers recherche textuelle normale (comme pour audio)
                // Ne pas retourner ici, laisser le code continuer vers la recherche textuelle
            }
            Err(e) => {
                log_error(&format!("[DIRECT_SEARCH] ❌ Erreur analyse IA: {:?}", e));

                // Continuer avec le texte original si disponible (comme pour audio)
                if !has_text {
                    log_warn("[DIRECT_SEARCH] ⚠️ Analyse image échouée et pas de texte, recherche impossible");
                    let response = serde_json::json!({
                        "status": "error",
                        "message": format!("Erreur analyse d'image: {}", e),
                        "error": "image_analysis_failed"
                    });
                    return Ok(Json(response));
                }
                // Sinon, continuer vers recherche textuelle avec le texte existant
                log_info("[DIRECT_SEARCH] Analyse image échouée, utilisation du texte original pour recherche");
            }
        }
    }

    // ✅ Recherche textuelle normale ou fallback
    let gps_zone = input.gps_mobile.as_deref();
    let search_radius_km = Some(50); // Rayon par défaut de 50km

    // ✅ NOUVEAU: Log détaillé du texte final utilisé pour la recherche
    log_info(&format!(
        "[DIRECT_SEARCH] 📝 Texte final utilisé pour la recherche: '{}' (longueur: {} caractères)",
        &user_text.chars().take(200).collect::<String>(),
        user_text.len()
    ));

    log_info(&format!(
        "[DIRECT_SEARCH] Paramètres GPS extraits: zone={:?}, rayon={:?}km",
        gps_zone, search_radius_km
    ));

    // ✅ NOUVEAU: Vérifier que le texte n'est pas vide avant la recherche
    if user_text.trim().is_empty() {
        log_error(
            "[DIRECT_SEARCH] ❌ ERREUR: Texte de recherche vide après traitement audio/image",
        );
        let response = serde_json::json!({
            "status": "error",
            "message": "Aucun texte de recherche disponible. Veuillez fournir du texte, de l'audio ou une image.",
            "error": "empty_search_text",
            "resultats": [],
            "nombre_matchings": 0
        });
        return Ok(Json(response));
    }

    // Recherche directe sans détection d'intention, avec filtrage GPS
    log_info("[DIRECT_SEARCH] 🔍 Démarrage de la recherche textuelle...");
    let (mut result, tokens_consumed) = rechercher_besoin_direct(
        &_state.pg,
        Some(_state.cache_service.clone()),
        _state.geographic_matching.clone(),
        Some(_state.search_metrics.clone()),
        Some(_state.scalability.clone()),
        Some(_state.media_storage.clone()),
        Some(user.id),
        &user_text,
        gps_zone,
        search_radius_km,
        None, // Pas de specialized_type pour cette recherche
    )
    .await?;

    // ✅ NOUVEAU: Log du nombre de résultats trouvés
    let nombre_resultats = result
        .get("resultats")
        .and_then(|r| r.as_array())
        .map(|arr| arr.len())
        .unwrap_or(0);
    log_info(&format!(
        "[DIRECT_SEARCH] ✅ Recherche terminée: {} résultat(s) trouvé(s)",
        nombre_resultats
    ));

    // ✅ ENRICHIR avec données de publicité et booster scores
    if let Some(resultats) = result.get_mut("resultats").and_then(|r| r.as_array_mut()) {
        let user_coords = gps_zone.and_then(|gps_str| {
            let coords: Vec<&str> = gps_str.split(',').collect();
            if coords.len() == 2 {
                Some((
                    coords[0].trim().parse::<f64>().ok()?,
                    coords[1].trim().parse::<f64>().ok()?,
                ))
            } else {
                None
            }
        });

        let publicite_service =
            crate::services::publicite_search_service::PubliciteSearchService::new(None);
        if let Err(e) = publicite_service
            .enrich_search_results_with_promotion(&_state.pg, resultats, user_coords)
            .await
        {
            log_error(&format!(
                "[DIRECT_SEARCH] Erreur enrichissement promotion: {}",
                e
            ));
            // Continuer même si erreur
        }

        // Re-trier les résultats après enrichissement (produits en promo d'abord)
        resultats.sort_by(|a, b| {
            let score_a = a.get("score").and_then(|s| s.as_f64()).unwrap_or(0.0);
            let score_b = b.get("score").and_then(|s| s.as_f64()).unwrap_or(0.0);
            score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    // ✅ AMÉLIORÉ: S'assurer que resultats est toujours un array dans la réponse
    let resultats_array =
        result.get("resultats").and_then(|r| r.as_array()).cloned().unwrap_or_else(|| {
            log::warn!("[DIRECT_SEARCH] ⚠️ resultats n'est pas un array, conversion en array vide");
            Vec::new()
        });

    // Construire la réponse avec format cohérent
    let response = serde_json::json!({
        "status": "success",
        "intention": "recherche_besoin",
        "resultats": resultats_array, // ✅ Toujours un array
        "tokens_consumed": tokens_consumed,
        "message": format!("Recherche directe réussie: {} résultats", resultats_array.len()),
        "search_method": "text",
        "gps_filtered": gps_zone.is_some(),
        "search_radius_km": search_radius_km
    });

    log::info!(
        "[DIRECT_SEARCH] ✅ Réponse construite avec {} résultats",
        resultats_array.len()
    );
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
    info!(
        "[handle_yukpo] ?? ==== Requ?te re?ue sur /api/ia/auto ====\nBody JSON re?u: {}",
        json_value
    );

    // Parser JSON en MultiModalInput
    eprintln!("[DEBUG] TENTATIVE DE PARSING JSON EN MULTIMODALINPUT");
    let input: MultiModalInput = match serde_json::from_value(json_value.clone()) {
        Ok(val) => {
            eprintln!("[DEBUG] PARSING JSON OK");
            val
        }
        Err(e) => {
            eprintln!("[DEBUG] ERREUR PARSING JSON: {}", e);
            error!(
                "[handle_yukpo] Erreur parsing JSON en MultiModalInput: {} | Body: {}",
                e, json_value
            );
            warn!("[handle_yukpo] JSON re?u non conforme, retour BAD_REQUEST");
            return (
                axum::http::StatusCode::BAD_REQUEST,
                format!("Erreur parsing JSON: {}", e),
            )
                .into_response();
        }
    };
    // Debug: afficher le contenu de MultiModalInput
    eprintln!("[DEBUG][HANDLE_YUKPO] MultiModalInput: {:?}", input);
    info!("[handle_yukpo] Contenu MultiModalInput: {:?}", input);

    // Debug sp?cifique pour les images
    if let Some(images) = &input.base64_image {
        eprintln!(
            "[DEBUG][HANDLE_YUKPO] Images re?ues: {} images",
            images.len()
        );
        info!("[handle_yukpo] Images re?ues: {} images", images.len());
        for (i, img) in images.iter().enumerate() {
            eprintln!(
                "[DEBUG][HANDLE_YUKPO] Image {}: taille {} bytes",
                i,
                img.len()
            );
            info!("[handle_yukpo] Image {}: taille {} bytes", i, img.len());
        }
    } else {
        eprintln!("[DEBUG][HANDLE_YUKPO] Aucune image re?ue");
        info!("[handle_yukpo] Aucune image re?ue");
    }

    eprintln!("[DEBUG] APPEL ORCHESTRATION IA...");
    info!("[handle_yukpo] Parsing JSON -> MultiModalInput OK. Appel orchestration IA...");
    info!(
        "[handle_yukpo] Lancement de l'orchestration IA avec input JSON: {}",
        serde_json::to_string(&input).unwrap_or_default()
    );

    // ?? UTILISER L'ORCHESTRATION ULTRA-OPTIMIS?E POUR PERFORMANCE MAXIMALE
    let orchestration_result: Result<serde_json::Value, axum::http::StatusCode> =
        match crate::services::orchestration_ia::orchestrer_intention_ia_ultra_optimisee(
            _state.ia.clone(),
            _state.clone(),
            Some(user.id),
            &input,
        )
        .await
        {
            Ok(result) => Ok(result),
            Err(e) => {
                error!(
                    "[handle_yukpo] Erreur orchestration IA ultra-optimis?e: {}",
                    e
                );
                Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
            }
        };

    match orchestration_result {
        Ok(result) => {
            eprintln!("[DEBUG] ORCHESTRATION IA OK");
            info!(
                "[handle_yukpo] Orchestration IA termin?e avec succ?s. R?sultat: {:?}",
                result
            );

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

            log::info!(
                "[handle_yukpo] Donn?es extraites pour validation: {}",
                serde_json::to_string(&data_for_validation).unwrap_or_default()
            );

            // Validation et normalisation du JSON avec le schéma approprié
            let validated_and_normalized_data =
                match creer_service::valider_service_json(&data_for_validation) {
                    Ok(normalized_data) => {
                        log::info!("[handle_yukpo] Données normalisées avec succès");
                        normalized_data
                    }
                    Err(e) => {
                        log::error!("[handle_yukpo] Erreur validation: {}", e);
                        return (
                            axum::http::StatusCode::BAD_REQUEST,
                            format!("Erreur validation: {}", e),
                        )
                            .into_response();
                    }
                };

            // Extraire les tokens consomm?s depuis le r?sultat si disponible
            let tokens_consumed =
                result.get("tokens_consumed").and_then(|v| v.as_i64()).unwrap_or(5); // D?faut conservateur

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
                    .unwrap_or(axum::http::HeaderValue::from_static("5")),
            );

            response
        }
        Err(e) => {
            eprintln!("[DEBUG] ERREUR ORCHESTRATION IA: {}", e);
            error!("[handle_yukpo] Erreur orchestration IA: {}", e);
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!("Erreur orchestration IA: {}", e),
            )
                .into_response()
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
) -> axum::response::Response {
    let user_id = user.id;

    // ?? LOGS DE D?BOGAGE
    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] ?? REQU?TE RE?UE SUR /api/services/create");
    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] User ID: {}", user_id);
    eprintln!(
        "[DEBUG][HANDLE_CREER_SERVICE] Donn?es re?ues: {}",
        serde_json::to_string(&data).unwrap_or_default()
    );
    info!("[handle_creer_service] ?? ==== Requ?te re?ue sur /api/services/create ====");
    info!("[handle_creer_service] User ID: {}", user_id);
    info!(
        "[handle_creer_service] Donn?es re?ues: {}",
        serde_json::to_string(&data).unwrap_or_default()
    );

    // Cr?er la structure attendue par creer_service
    let service_request =
        crate::controllers::service_controller::NewServiceRequest { user_id, data };

    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] Appel du contr?leur creer_service...");
    info!("[handle_creer_service] Appel du contr?leur creer_service...");

    let response =
        crate::controllers::service_controller::creer_service(State(state), Json(service_request))
            .await;

    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] R?ponse du contr?leur re?ue");
    info!("[handle_creer_service] R?ponse du contr?leur re?ue");

    if response.status().is_success() {
        eprintln!("[DEBUG][HANDLE_CREER_SERVICE] ? SUCC?S - Service cr??");
        info!("[handle_creer_service] ? Service cr?? avec succ?s");
    } else {
        eprintln!(
            "[DEBUG][HANDLE_CREER_SERVICE] ? ERREUR - ?chec cr?ation service (status: {})",
            response.status()
        );
        error!(
            "[handle_creer_service] ? Erreur cr?ation service (status: {})",
            response.status()
        );
    }

    // ✅ CORRIGÉ: Retourner la réponse complète (avec le JSON d'erreur si erreur)
    // Le contrôleur creer_service retourne déjà une réponse avec le JSON d'erreur approprié
    response
}

/// Endpoint pour création de service directe (sans détection d'intention)
async fn handle_creation_service_direct(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    Json(input): Json<MultiModalInput>,
) -> AppResult<Json<Value>> {
    let user_id = user.id;

    log::info!(
        "[handle_creation_service_direct] ?? ==== Requête reçue sur /api/ia/creation-service ===="
    );
    log::info!("[handle_creation_service_direct] User ID: {}", user_id);
    log::info!("[handle_creation_service_direct] Input: {:?}", input);

    // ?? NOUVEAU : Vérifier s'il y a des fichiers à traiter
    let has_images = input.base64_image.as_ref().map_or(false, |images| !images.is_empty());
    let has_audios = input.audio_base64.as_ref().map_or(false, |audios| !audios.is_empty());
    let has_videos = input.video_base64.as_ref().map_or(false, |videos| !videos.is_empty());
    let has_docs = input.doc_base64.as_ref().map_or(false, |docs| !docs.is_empty());
    let has_excels = input.excel_base64.as_ref().map_or(false, |excels| !excels.is_empty());

    let total_files = (has_images as usize)
        + (has_audios as usize)
        + (has_videos as usize)
        + (has_docs as usize)
        + (has_excels as usize);

    log::info!("[handle_creation_service_direct] Fichiers détectés: images={}, audios={}, vidéos={}, docs={}, excels={}", 
        has_images, has_audios, has_videos, has_docs, has_excels);

    // ?? NOUVEAU : Log détaillé des images pour debugging
    if has_images {
        if let Some(images) = &input.base64_image {
            log::info!(
                "[handle_creation_service_direct] Images détectées: {} image(s)",
                images.len()
            );
            for (i, img) in images.iter().enumerate() {
                log::info!(
                    "[handle_creation_service_direct] Image {}: {} bytes",
                    i + 1,
                    img.len()
                );
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
            log::error!(
                "[handle_creation_service_direct] Erreur lecture prompt: {}",
                e
            );
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
    // ?? CORRECTION : L'ordre de retour est (model_name, response, tokens_consumed)
    let (model_name, response, tokens_consumed) = if has_images {
        log::info!(
            "[handle_creation_service_direct] Appel multimodal avec {} image(s)",
            input.base64_image.as_ref().map_or(0, |v| v.len())
        );
        app_ia.predict_multimodal(&prompt, input.base64_image.clone()).await?
    } else {
        log::info!("[handle_creation_service_direct] Appel texte uniquement (pas d'images)");
        app_ia.predict(&prompt).await?
    };

    log::info!(
        "[handle_creation_service_direct] Model name: {}",
        model_name
    );
    log::info!(
        "[handle_creation_service_direct] Response length: {}",
        response.len()
    );
    log::info!(
        "[handle_creation_service_direct] Response preview: {}",
        &response[0..response.len().min(200)]
    );

    // ✅ CORRECTION: Extraire le JSON des backticks si présent, avec validation
    let json_response = if response.contains("```json") {
        let start = response.find("```json").unwrap_or(0) + 7;
        let end = response.rfind("```").unwrap_or(response.len());
        let extracted = response[start..end].trim();
        // Vérifier que ce n'est pas juste le nom du modèle
        if extracted == model_name || extracted.len() < 10 {
            log::warn!("[handle_creation_service_direct] JSON extrait semble invalide (nom modèle?), utiliser réponse complète");
            response.trim()
        } else {
            extracted
        }
    } else if response.contains("```") {
        let start = response.find("```").unwrap_or(0) + 3;
        let end = response.rfind("```").unwrap_or(response.len());
        let extracted = response[start..end].trim();
        // Vérifier que ce n'est pas juste le nom du modèle
        if extracted == model_name || extracted.len() < 10 {
            log::warn!("[handle_creation_service_direct] JSON extrait semble invalide (nom modèle?), utiliser réponse complète");
            response.trim()
        } else {
            extracted
        }
    } else {
        response.trim()
    };

    // ✅ CORRECTION: Chercher un objet JSON valide dans la réponse si nécessaire
    let json_response = if json_response == model_name
        || (!json_response.starts_with('{') && !json_response.starts_with('['))
    {
        log::warn!("[handle_creation_service_direct] JSON extrait invalide, chercher objet JSON dans réponse");
        // Chercher le premier { ou [ dans la réponse
        if let Some(start) = response.find('{') {
            if let Some(end) = response.rfind('}') {
                if end > start {
                    let candidate = response[start..=end].trim();
                    log::info!(
                        "[handle_creation_service_direct] JSON candidat trouvé: {}",
                        &candidate[0..candidate.len().min(200)]
                    );
                    candidate
                } else {
                    json_response
                }
            } else {
                json_response
            }
        } else if let Some(start) = response.find('[') {
            if let Some(end) = response.rfind(']') {
                if end > start {
                    response[start..=end].trim()
                } else {
                    json_response
                }
            } else {
                json_response
            }
        } else {
            log::error!("[handle_creation_service_direct] Aucun JSON trouvé dans la réponse");
            json_response
        }
    } else {
        json_response
    };

    log::info!(
        "[handle_creation_service_direct] Réponse brute: {}",
        response
    );
    log::info!(
        "[handle_creation_service_direct] JSON extrait: {}",
        json_response
    );

    // ✅ CORRECTION: Vérifier que json_response n'est pas vide ou juste le nom du modèle
    if json_response.is_empty() || json_response == model_name {
        log::error!(
            "[handle_creation_service_direct] JSON extrait invalide: '{}' (nom modèle: '{}')",
            json_response,
            model_name
        );
        log::error!(
            "[handle_creation_service_direct] Réponse complète: {}",
            response
        );
        return Err(AppError::Internal(format!(
            "Réponse IA invalide: le JSON extrait est vide ou correspond au nom du modèle '{}'. Réponse complète: {}",
            model_name,
            &response[0..response.len().min(500)]
        )));
    }

    // Parser la réponse JSON
    let data: Value = serde_json::from_str(json_response).map_err(|e| {
        log::error!(
            "[handle_creation_service_direct] Erreur parsing JSON: {}",
            e
        );
        log::error!(
            "[handle_creation_service_direct] JSON reçu: {}",
            json_response
        );
        log::error!(
            "[handle_creation_service_direct] Réponse complète: {}",
            response
        );
        format!(
            "Erreur parsing JSON: {} - Réponse IA invalide ou mal formatée",
            e
        )
    })?;

    log::info!(
        "[handle_creation_service_direct] JSON parsé avec succès: {}",
        data
    );

    // ✅ NOUVEAU: Générer un session_id unique pour cette session de création
    // Ce session_id sera utilisé pour récupérer les combinaisons préférées par l'IA
    let session_id = Uuid::new_v4().to_string();
    log::info!(
        "[handle_creation_service_direct] Session ID généré: {}",
        session_id
    );

    // ?? NOUVEAU : Extraire les données du service sans les créer dans la base
    let service_data = data.get("data").unwrap_or(&data);

    // ✅ NOUVEAU: Sauvegarder les combinaisons IA si présentes dans les données
    // Cela permet de les récupérer plus tard via /api/combinations/session/{session_id}
    if let Some(produits_field) = service_data.get("produits") {
        // Créer un objet temporaire avec session_id pour la sauvegarde
        let mut produits_with_session = produits_field.clone();
        if let Some(produits_obj) = produits_with_session.as_object_mut() {
            produits_obj.insert("session_id".to_string(), json!(session_id));
        }

        // Sauvegarder les combinaisons avec le session_id
        if let Err(e) = creer_service::save_ia_combinations_to_db(
            &state.pg,
            &produits_with_session,
            Some(&session_id),
        )
        .await
        {
            log::warn!("[handle_creation_service_direct] ⚠️ Erreur sauvegarde combinaisons IA: {} (non bloquant)", e);
        } else {
            log::info!("[handle_creation_service_direct] ✅ Combinaisons IA sauvegardées avec session_id: {}", session_id);
        }
    }

    // ?? NOUVEAU : Préparer les données pour le formulaire (sans création en base)
    let service_request_data = json!({
        "data": service_data,
        "base64_image": input.base64_image, // Images
        "audio_base64": input.audio_base64, // Audios
        "video_base64": input.video_base64, // Vidéos
        "doc_base64": input.doc_base64, // Documents
        "excel_base64": input.excel_base64, // Excel
        "tokens_consumed": tokens_consumed,
        "ia_model_used": model_name,
        "session_id": session_id // ✅ NOUVEAU: Inclure session_id dans service_data
    });

    log::info!("[handle_creation_service_direct] Données préparées pour le formulaire avec {} types de fichiers...", total_files);

    // ?? IMPORTANT : NE PAS créer le service ici, juste préparer les données
    // Le service sera créé par le formulaire via /api/services/create

    // Construire la réponse finale avec la structure attendue par le frontend
    let final_response = json!({
        "status": "success",
        "intention": "creation_service",
        "session_id": session_id, // ✅ NOUVEAU: Inclure session_id dans la réponse
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

    log::info!(
        "[handle_creation_service_direct] Réponse finale construite: {}",
        final_response
    );
    log::info!("[handle_creation_service_direct] Réponse générée avec succès");

    Ok(Json(final_response))
}

/// Endpoint pour consulter les m?triques d'optimisation IA
async fn handle_optimization_metrics(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    let user_id = user.id;

    info!(
        "[optimization_metrics] Consultation des m?triques pour utilisateur {}",
        user_id
    );

    // R?cup?rer le solde actuel de l'utilisateur
    let solde_result = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.pg)
        .await;

    let solde_actuel = match solde_result {
        Ok(row) => row.get::<i32, _>("tokens_balance"),
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
        return Err(AppError::BadRequest(
            "Coordonnées GPS invalides".to_string(),
        ));
    }

    // Créer le service de géocodage et effectuer la requête
    let geocoding_service = GeocodingService::new();
    let result = geocoding_service.reverse_geocode(lat, lng).await?;

    Ok(Json(result))
}

/// Servir les fichiers média
async fn serve_media_file(Path(file_path): Path<String>) -> Result<Response<Body>, StatusCode> {
    info!("[serve_media_file] Demande fichier: {}", file_path);

    // Sécurité : vérifier que le chemin ne contient pas de traversée de répertoire
    if file_path.contains("..") || file_path.contains("~") {
        warn!(
            "[serve_media_file] Tentative de traversée de répertoire: {}",
            file_path
        );
        return Err(StatusCode::BAD_REQUEST);
    }

    // ✅ CORRECTION RACINE: Normaliser le chemin pour éviter les duplications
    // Le file_path peut être:
    // - "files/uploads/services/158/videos/video.mp4" (avec préfixe)
    // - "uploads/services/158/videos/video.mp4" (déjà avec uploads)
    // - "158/videos/video.mp4" (juste le chemin relatif)
    let normalized_path = if file_path.starts_with("http://") || file_path.starts_with("https://") {
        // URL complète (CDN/S3) - ne pas servir localement
        warn!(
            "[serve_media_file] URL complète fournie (CDN/S3), redirection nécessaire: {}",
            file_path
        );
        return Err(StatusCode::BAD_REQUEST);
    } else if file_path.starts_with("uploads/services/") {
        // Déjà avec le préfixe complet
        file_path
    } else if file_path.starts_with("files/uploads/services/") {
        // Préfixe "files/" à retirer
        file_path.strip_prefix("files/").unwrap_or(&file_path).to_string()
    } else if file_path.starts_with("uploads/") {
        // Déjà avec uploads/
        file_path
    } else {
        // Chemin relatif simple, ajouter le préfixe
        format!("uploads/services/{}", file_path)
    };

    info!("[serve_media_file] Chemin normalisé: {}", normalized_path);

    // Lire le fichier
    match File::open(&normalized_path).await {
        Ok(mut file) => {
            let mut contents = Vec::new();
            match file.read_to_end(&mut contents).await {
                Ok(_) => {
                    // Déterminer le type MIME
                    let content_type = if normalized_path.ends_with(".jpg")
                        || normalized_path.ends_with(".jpeg")
                    {
                        "image/jpeg"
                    } else if normalized_path.ends_with(".png") {
                        "image/png"
                    } else if normalized_path.ends_with(".gif") {
                        "image/gif"
                    } else if normalized_path.ends_with(".mp4") {
                        "video/mp4"
                    } else if normalized_path.ends_with(".webm") {
                        "video/webm"
                    } else if normalized_path.ends_with(".wav") {
                        "audio/wav"
                    } else if normalized_path.ends_with(".mp3") {
                        "audio/mpeg"
                    } else if normalized_path.ends_with(".pdf") {
                        "application/pdf"
                    } else {
                        "application/octet-stream"
                    };

                    let file_size = contents.len();
                    let response = Response::builder()
                        .status(StatusCode::OK)
                        .header("content-type", content_type)
                        .header("cache-control", "public, max-age=3600")
                        .body(Body::from(contents))
                        .unwrap();

                    info!(
                        "[serve_media_file] Fichier servi: {} ({} bytes)",
                        normalized_path, file_size
                    );
                    Ok(response)
                }
                Err(e) => {
                    error!(
                        "[serve_media_file] Erreur lecture fichier {}: {:?}",
                        normalized_path, e
                    );
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
        Err(_) => {
            warn!("[serve_media_file] Fichier non trouvé: {}", normalized_path);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// ✅ NOUVEAU: Endpoint pour création d'offre d'emploi directe via IA
/// Utilise le système d'orchestration IA complet avec prompts réels et appels IA véritables
async fn handle_creation_offre_emploi_direct(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    Json(input): Json<MultiModalInput>,
) -> AppResult<Json<Value>> {
    let user_id = user.id;

    log::info!(
        "[handle_creation_offre_emploi_direct] 📝 ==== Requête création offre d'emploi via IA ===="
    );
    log::info!("[handle_creation_offre_emploi_direct] User ID: {}", user_id);

    let user_text = input.texte.clone().unwrap_or_default();

    if user_text.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Le texte de description est requis".to_string(),
        ));
    }

    // ✅ UTILISER LE SYSTÈME D'ORCHESTRATION IA COMPLET
    use crate::services::ia::OptimizedIAService;

    let app_ia = state.ia.clone();
    let _optimized_ia = OptimizedIAService::new(app_ia.clone()).await?;

    // ✅ UTILISER LE PROMPT MANAGER POUR CHARGER LE PROMPT SPÉCIFIQUE
    use crate::services::ia::prompt_manager::PromptManager;
    let prompt_manager = PromptManager::new().await?;

    // Obtenir le prompt spécifique pour création d'offre d'emploi
    let prompt = prompt_manager
        .get_intention_prompt("creation_offre_emploi", &user_text)
        .unwrap_or_else(|| {
            log::warn!("[handle_creation_offre_emploi_direct] Prompt creation_offre_emploi non trouvé, utilisation fallback");
            // Fallback si le prompt n'est pas chargé
            format!(
                r#"Tu es un assistant spécialisé dans la création d'offres d'emploi pour la plateforme Yukpo.

Analyse la demande utilisateur et génère un JSON avec ces champs :
- titre_poste (obligatoire)
- description (obligatoire)
- type_contrat (obligatoire: CDI, CDD, Stage, Freelance, Temps partiel, Alternance)
- lieu_travail (obligatoire)
- secteur (obligatoire: Informatique, Commerce, Santé, Éducation, Finance, Marketing, Ressources Humaines, Ingénierie, Design, Autre)
- competences_requises (array)
- salaire_min, salaire_max (en XAF)
- remote (boolean)
- niveau_etude, experience_min

Demande utilisateur : {}

Format JSON attendu :
{{
  "intention": "creation_offre_emploi",
  "data": {{
    "titre_poste": {{"type_donnee": "string", "valeur": "...", "origine_champs": "ia"}},
    "description": {{"type_donnee": "string", "valeur": "...", "origine_champs": "ia"}},
    "type_contrat": {{"type_donnee": "string", "valeur": "CDI", "origine_champs": "ia"}},
    "lieu_travail": {{"type_donnee": "string", "valeur": "...", "origine_champs": "ia"}},
    "secteur": {{"type_donnee": "string", "valeur": "...", "origine_champs": "ia"}},
    "competences_requises": {{"type_donnee": "array", "valeur": ["...", "..."], "origine_champs": "ia"}}
  }}
}}

RÉPONSE UNIQUEMENT EN JSON VALIDE."#,
                user_text
            )
        });

    // ✅ UTILISER LE SYSTÈME IA RÉEL avec appels véritables
    let has_images = input.base64_image.as_ref().map_or(false, |imgs| !imgs.is_empty());

    log::info!(
        "[handle_creation_offre_emploi_direct] Appel IA avec prompt spécifique (images: {})",
        has_images
    );

    // Appel IA réel via le système existant
    let (model_name, response, tokens_consumed) = if has_images {
        log::info!(
            "[handle_creation_offre_emploi_direct] Appel multimodal avec {} image(s)",
            input.base64_image.as_ref().map_or(0, |v| v.len())
        );
        app_ia.predict_multimodal(&prompt, input.base64_image.clone()).await?
    } else {
        log::info!("[handle_creation_offre_emploi_direct] Appel texte uniquement");
        app_ia.predict(&prompt).await?
    };

    log::info!(
        "[handle_creation_offre_emploi_direct] ✅ Modèle IA utilisé: {}",
        model_name
    );
    log::info!(
        "[handle_creation_offre_emploi_direct] ✅ Tokens consommés: {}",
        tokens_consumed
    );
    log::info!(
        "[handle_creation_offre_emploi_direct] Réponse longueur: {} caractères",
        response.len()
    );

    // Extraire le JSON de la réponse IA
    let json_response = if response.contains("```json") {
        let start = response.find("```json").unwrap_or(0) + 7;
        let end = response.rfind("```").unwrap_or(response.len());
        let extracted = response[start..end].trim();
        if extracted == model_name || extracted.len() < 10 {
            log::warn!("[handle_creation_offre_emploi_direct] JSON extrait invalide, utiliser réponse complète");
            response.trim()
        } else {
            extracted
        }
    } else if response.contains("```") {
        let start = response.find("```").unwrap_or(0) + 3;
        let end = response.rfind("```").unwrap_or(response.len());
        let extracted = response[start..end].trim();
        if extracted == model_name || extracted.len() < 10 {
            log::warn!("[handle_creation_offre_emploi_direct] JSON extrait invalide, utiliser réponse complète");
            response.trim()
        } else {
            extracted
        }
    } else {
        response.trim()
    };

    // Chercher un objet JSON valide si nécessaire
    let json_response = if json_response == model_name
        || (!json_response.starts_with('{') && !json_response.starts_with('['))
    {
        log::warn!("[handle_creation_offre_emploi_direct] Chercher objet JSON dans réponse");
        if let Some(start) = response.find('{') {
            if let Some(end) = response.rfind('}') {
                if end > start {
                    response[start..=end].trim()
                } else {
                    json_response
                }
            } else {
                json_response
            }
        } else {
            log::error!("[handle_creation_offre_emploi_direct] Aucun JSON trouvé dans la réponse");
            return Err(AppError::Internal(
                "Réponse IA invalide: aucun JSON trouvé".to_string(),
            ));
        }
    } else {
        json_response
    };

    if json_response.is_empty() || json_response == model_name {
        log::error!(
            "[handle_creation_offre_emploi_direct] JSON extrait invalide: '{}'",
            json_response
        );
        return Err(AppError::Internal(format!(
            "Réponse IA invalide: le JSON extrait est vide ou correspond au nom du modèle '{}'",
            model_name
        )));
    }

    // Parser le JSON
    let parsed_json: Value = serde_json::from_str(json_response).map_err(|e| {
        log::error!(
            "[handle_creation_offre_emploi_direct] Erreur parsing JSON: {}",
            e
        );
        log::error!(
            "[handle_creation_offre_emploi_direct] JSON reçu: {}",
            json_response
        );
        AppError::Internal(format!("Erreur parsing JSON IA: {}", e))
    })?;

    log::info!("[handle_creation_offre_emploi_direct] ✅ JSON parsé avec succès");

    // Construire la réponse avec la structure attendue par le frontend
    let result = json!({
        "success": true,
        "data": parsed_json,
        "tokens_consumed": tokens_consumed,
        "model_used": model_name,
    });

    Ok(Json(result))
}
