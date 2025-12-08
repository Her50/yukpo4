use crate::utils::log::{log_error, log_warn};
use axum::{
    body::Body,
    extract::{Extension, Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Redirect, Response},
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use log::{error, info, warn};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::fs::File;
use tokio::io::AsyncReadExt;

use crate::models::input_model::MultiModalInput;
use crate::{
    controllers::{
        audio_library_controller,
        ia_controller,
        intelligent_service_controller::{
            get_services_pending_processing, process_services_intelligently,
            reactivate_service_intelligent,
        },
        interaction_controller::{
            get_service_interactions, get_service_reviews, get_service_score, get_service_stats,
            post_audio, post_call, post_message, post_review, post_review_helpful, post_share,
        },
        inventory_controller,
        media_analytics_controller,
        places_controller, // ✅ NOUVEAU 2025-11-02
        product_addition_controller::add_product_to_service, // ✅ NOUVEAU 2025-11-01
        product_comments_controller::{
            create_product_comment, delete_product_comment, get_product_comments,
            toggle_product_comment_reaction, update_product_comment,
        },
        product_lifecycle_controller::{deactivate_product, reactivate_product}, // ✅ NOUVEAU 2025-11-01
        product_video_controller,
        service_controller::{
            get_my_services, get_service_by_id, get_services_for_prestataire, modifier_service,
            supprimer_service, toggle_service_status,
        },
        social_connector_controller,
        studio_controller,
    },
    core::types::{AppError, AppResult},
    middlewares::{
        audit_log,
        check_tokens::check_tokens,
        hide_headers,
        jwt::{jwt_auth, optional_jwt_auth},
        monitoring, rate_limit, request_size_limit,
        service_interaction::track_service_interaction,
    },
    routers::router_modalities,
    routes::products_management::{delete_product, toggle_product_status, update_product},
    routes::{
        media_upload_routes::{serve_proof_media_file, upload_proof_media_file},
        places_routes::{autocomplete_places, fetch_place_photo},
    },
    services::creer_service,
    state::AppState,
};

#[axum::debug_handler]
async fn handle_feature_flags(State(state): State<Arc<AppState>>) -> Json<Value> {
    let flags = &state.feature_flags;

    let known = json!({
        "gpu_worker": flags.is_enabled(crate::config::feature_flags::KnownFlag::GpuWorker),
        "connectors_livekit": flags.is_enabled(crate::config::feature_flags::KnownFlag::ConnectorsLivekit),
        "delivery_v2": flags.is_enabled(crate::config::feature_flags::KnownFlag::DeliveryV2),
        "global_promos": flags.is_enabled(crate::config::feature_flags::KnownFlag::GlobalPromos),
    });

    Json(json!({
        "success": true,
        "data": {
            "known": known
        }
    }))
}

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
        .route(
            "/",
            get(|| async { "Yukpomnang Backend API - Service actif" }),
        )
        .route("/api/test/ping", get(handle_ping))
        .route("/api/health", get(handle_health_check)) // ✅ NOUVEAU 2025-12-01: Health check pour monitoring
        .route("/api/meta/feature-flags", get(handle_feature_flags))
        .route("/api/geocoding/reverse", post(handle_reverse_geocode))
        .route("/api/places/autocomplete", get(autocomplete_places))
        .route(
            "/api/places/enrich",
            get(places_controller::enrich_location),
        )
        .route("/api/places/photo", get(fetch_place_photo))
        .layer(axum::middleware::from_fn(monitoring::monitoring))
        .layer(axum::middleware::from_fn(audit_log::audit_log))
        // ✅ SÉCURITÉ: Rate limiting avec State pour accéder à Redis
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
            post(handle_yukpo)
                .layer(axum::extract::DefaultBodyLimit::max(200_000_000)) // ✅ 200 MB - pour permettre images/vidéos base64
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    check_tokens,
                )),
        )
        .route(
            "/api/ia/creation-service",
            post(handle_creation_service_direct)
                .layer(axum::extract::DefaultBodyLimit::max(200_000_000)) // ✅ 200 MB - pour permettre images/vidéos/documents base64
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    check_tokens,
                )),
        )
        .route(
            "/api/ia/generate-subtitles",
            post(ia_controller::generate_video_subtitles)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/ia/tts",
            post(ia_controller::generate_tts_voice)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/ia/video-brief",
            post(ia_controller::generate_video_brief)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/ia/video-style",
            post(ia_controller::generate_video_style)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/ia/media-analysis",
            post(ia_controller::analyze_media_tags)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/ia/distribution-plan",
            post(ia_controller::generate_distribution_plan)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .layer(axum::middleware::from_fn(jwt_auth))
        .route(
            "/api/search/direct",
            post(handle_direct_search)
                .layer(axum::extract::DefaultBodyLimit::max(200_000_000)) // ✅ 200 MB - pour permettre recherche avec images base64
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    check_tokens,
                )),
        )
        // ✅ NOUVEAU 2025-12-02: Recherche paginée avec cursor-based pagination
        .route(
            "/api/search/paginated",
            post(handle_paginated_search).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                check_tokens,
            )),
        )
        // Nouveau endpoint pour consulter les m?triques d'optimisation
        .route("/api/ia/metrics", get(handle_optimization_metrics))
        // ✅ NOUVEAU 2025-12-01: Métriques de recherche pour monitoring
        .route("/api/metrics/search", get(handle_search_metrics))
        // ✅ NOUVEAU 2025-12-01: Métriques globales pour toutes les fonctionnalités
        .route("/api/metrics/global", get(handle_global_metrics))
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
            "/api/services/{id}/comments",
            get(get_product_comments)
                .post(create_product_comment)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/comments/{id}",
            patch(update_product_comment)
                .delete(delete_product_comment)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/comments/{id}/reactions",
            post(toggle_product_comment_reaction)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        // ✅ FINALISÉ: Route pour upload médias dans commentaires
        .route(
            "/api/comments/{id}/media",
            post(crate::routes::comment_media_routes::upload_comment_media).layer(
                axum::middleware::from_fn_with_state(state.clone(), jwt_auth),
            ),
        )
        .route("/api/services/{id}/score", get(get_service_score))
        .route("/api/services/{id}/stats", get(get_service_stats))
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
        .route("/api/services/create", post(handle_creer_service))
        // Route pour r?cup?rer tous les services du prestataire connect?
        .route(
            "/api/prestataire/services",
            get(get_services_for_prestataire),
        )
        // ✅ NOUVEAU 2025-11-06: Alias mobile pour récupérer mes services
        .route("/api/services/my-services", get(get_my_services))
        // Route pour activer/d?sactiver un service
        .route(
            "/api/services/{service_id}/toggle-status",
            patch(toggle_service_status),
        )
        // Route pour modifier un service
        .route("/api/services/{service_id}/update", put(modifier_service))
        // Route pour supprimer un service
        .route(
            "/api/services/{service_id}/delete",
            delete(supprimer_service),
        )
        // ✅ NOUVEAU: Route pour modifier un produit spécifique (avec historique)
        .route("/api/products/{product_id}/update", patch(update_product))
        // ✅ NOUVEAU 2025-11-01: Route pour ajouter un produit incrémental (coût fixe 2000 FCFA)
        // ✅ CORRIGÉ 2025-12-01: Ajout DefaultBodyLimit pour éviter erreur 413 (Payload Too Large)
        .route(
            "/api/services/{service_id}/products",
            post(add_product_to_service).layer(
                axum::extract::DefaultBodyLimit::max(200_000_000), // ✅ 200 MB - pour permettre images/vidéos base64 volumineuses
            ),
        )
        // ✅ NOUVEAU 2025-11-01: Routes pour cycle de vie produits (désactivation/réactivation)
        .route(
            "/api/services/{service_id}/products/{product_index}/deactivate",
            post(deactivate_product),
        )
        .route(
            "/api/services/{service_id}/products/{product_index}/reactivate",
            post(reactivate_product),
        )
        .route("/api/products/{product_id}", delete(delete_product))
        .route(
            "/api/products/{product_id}/toggle-status",
            patch(toggle_product_status).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/media/{media_id}/track-view",
            post(media_analytics_controller::track_view)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/media/{media_id}/track-share",
            post(media_analytics_controller::track_share)
                .layer(axum::middleware::from_fn(optional_jwt_auth)),
        )
        .route(
            "/api/media/{media_id}/distribution/{target}",
            patch(media_analytics_controller::update_distribution)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/media/quality",
            get(media_analytics_controller::list_quality_scores)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/media/analytics/overview",
            get(media_analytics_controller::video_overview)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/audio-library",
            get(audio_library_controller::get_audio_library),
        )
        .route(
            "/api/audio-library/{loop_id}/attach/{service_id}",
            post(audio_library_controller::attach_audio_loop)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/audio-library/voice-profiles",
            get(audio_library_controller::list_voice_profiles)
                .post(audio_library_controller::create_voice_profile)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/audio-library/voice-profiles/{profile_id}",
            delete(audio_library_controller::delete_voice_profile)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions",
            get(studio_controller::list_sessions)
                .post(studio_controller::create_session)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}",
            get(studio_controller::get_session)
                .put(studio_controller::update_session)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}/timeline",
            put(studio_controller::save_timeline).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}/assets",
            post(studio_controller::attach_asset).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}/preview",
            post(studio_controller::trigger_preview).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}/preview-short",
            post(studio_controller::trigger_short_preview)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        // ✅ Phase 9 - Amélioration 31 : Routes pour chaînage vidéos
        .route(
            "/api/studio/sessions/{session_id}/dependencies",
            post(studio_controller::set_dependencies)
                .get(studio_controller::get_dependencies)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}/next",
            get(studio_controller::get_next_video).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}/previews",
            get(studio_controller::list_preview_events).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}/preview-metrics",
            get(studio_controller::preview_metrics).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}/publish",
            post(studio_controller::publish_session).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}/template-recommendations",
            post(studio_controller::recommend_templates).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/sessions/{session_id}/storyboard",
            post(studio_controller::generate_storyboard).layer(axum::middleware::from_fn(jwt_auth)),
        )
        // ✅ Phase 7 - Amélioration 22 : Endpoint suggestions IA
        .route(
            "/api/studio/sessions/{session_id}/suggestions",
            post(studio_controller::generate_suggestions)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/templates",
            get(studio_controller::list_templates).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/studio/services/{service_id}/products/{product_index}/stock",
            get(inventory_controller::get_stock_status)
                .post(inventory_controller::sync_stock)
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/media/product/{service_id}/{product_index}/generate-video",
            post(product_video_controller::generate_video_for_product),
        )
        .route(
            "/api/media/product/{service_id}/{product_index}/estimate-video",
            post(product_video_controller::estimate_video_cost_for_product),
        )
        .route(
            "/api/media/jobs/{job_id}",
            get(product_video_controller::get_video_generation_job_status),
        )
        // Route pour r?cup?rer un service par ID (public)
        .route("/api/services/{service_id}", get(get_service_by_id))
        // Route pour récupérer les médias d'un service
        .route(
            "/api/services/{service_id}/media",
            get(crate::controllers::media_controller::get_service_media),
        )
        // ✅ Routes pour liste et services récents
        .route(
            "/api/services",
            get(crate::controllers::service_controller::get_services_list),
        )
        .route(
            "/api/services/recent",
            get(crate::controllers::service_controller::get_services_recent),
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
        // ✅ SÉCURITÉ: Rate limiting avec State pour accéder à Redis
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            rate_limit,
        ))
        .layer(axum::middleware::from_fn(hide_headers::hide_headers))
        .layer(axum::middleware::from_fn(
            request_size_limit::request_size_limit,
        ));

    let _social = Router::new()
        .route(
            "/api/social/accounts",
            get(social_connector_controller::get_accounts),
        )
        .route(
            "/api/social/accounts",
            post(social_connector_controller::connect_account),
        )
        .route(
            "/api/social/youtube/authorize",
            get(social_connector_controller::youtube_authorize),
        )
        .route(
            "/api/social/youtube/callback",
            get(social_connector_controller::youtube_callback),
        )
        .route(
            "/api/social/instagram/authorize",
            get(social_connector_controller::instagram_authorize),
        )
        .route(
            "/api/social/instagram/callback",
            get(social_connector_controller::instagram_callback),
        )
        .layer(axum::middleware::from_fn(jwt_auth));

    let app = Router::new();
    // ⚠️ Routes supprimées car déjà mergées dans lib.rs :
    // - weather_routes, nearby_services_routes, ai_chat_routes, health_structure_routes
    // - vehicle_model_routes, appliance_model_routes, phone_model_routes
    // - popular_products_routes, product_reactions_routes, diagnostic_routes
    // Ces routes sont mergées explicitement dans lib.rs pour éviter les conflits

    // ✅ NOUVEAU: Routes pour système de publicité (intégrées directement)
    
    
    
    use crate::controllers::media_product_controller;
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
            "/api/publicites/analytics/advanced",
            get(publicite_controller::get_advanced_analytics),
        )
        .route(
            "/api/publicites/optimization/suggestions",
            get(publicite_controller::get_optimization_suggestions),
        )
        .route(
            "/api/publicites/{id}/optimize",
            get(publicite_controller::analyze_campaign),
        )
        .route(
            "/api/publicites/alerts",
            get(publicite_controller::get_publicite_alerts),
        )
        .route(
            "/api/publicites/alerts/check",
            post(publicite_controller::trigger_alert_check),
        )
        .route(
            "/api/publicites/{id}/export",
            get(publicite_controller::export_campaign),
        )
        .route(
            "/api/publicites/export/all",
            get(publicite_controller::export_all_campaigns),
        )
        .route(
            "/api/publicites/export/excel",
            post(publicite_controller::export_excel_campaigns),
        )
        .route(
            "/api/publicites/import",
            post(publicite_controller::import_campaign),
        )
        .route(
            "/api/publicites/{id}/versions",
            get(publicite_controller::get_publicite_versions),
        )
        .route(
            "/api/publicites/{id}/versions/{version_number}",
            get(publicite_controller::get_publicite_version),
        )
        .route(
            "/api/publicites/{id}/versions/{version_number}/restore",
            post(publicite_controller::restore_publicite_version),
        )
        .route(
            "/api/publicites/{id}/versions/{v1}/compare/{v2}",
            get(publicite_controller::compare_publicite_versions),
        )
        .route(
            "/api/publicites/track-click",
            post(publicite_controller::track_publicite_click),
        )
        .route(
            "/api/publicites/track-view",
            post(publicite_controller::track_publicite_view),
        )
        // ✅ NOUVEAU: Routes pour médias par produit spécifique
        .route(
            "/api/media/product/{service_id}/{product_index}",
            get(media_product_controller::get_product_media),
        )
        .route(
            "/api/media/product/{service_id}/{product_index}/images",
            get(media_product_controller::get_product_images),
        )
        .route(
            "/api/media/product/{service_id}/{product_index}/videos",
            get(media_product_controller::get_product_videos),
        )
        .route(
            "/api/media/set-main/{media_id}",
            post(media_product_controller::set_main_image),
        )
        // ✅ Phase 9 - Amélioration : Routes pour upload de médias de preuve de livraison
        .route(
            "/api/media/upload-proof",
            post(upload_proof_media_file)
                .layer(axum::extract::DefaultBodyLimit::max(100_000_000)) // ✅ 100 MB - pour upload de médias de preuve
                .layer(axum::middleware::from_fn(jwt_auth)),
        )
        .route("/api/media/proof/{*filename}", get(serve_proof_media_file));
    // Routes pour product_modalities (modalités réutilisables)
    let modality_routes = router_modalities::modality_routes(state.clone());

    // ⚠️ Route générique wildcard - DOIT être mergée EN DERNIER pour éviter les conflits
    let media_fallback_route =
        Router::new().route("/api/media/files/{*file_path}", get(serve_media_file));

    // ⚠️ Routes supprimées car déjà mergées dans lib.rs :
    // - recommendation_routes, token_stats_routes
    // Ces routes sont mergées explicitement dans lib.rs pour éviter les conflits

    // Combinaison des routes
    public_routes
        .merge(protected_routes)
        .merge(app)
        .merge(publicite_routes_inline)
        .merge(modality_routes)
        .merge(media_fallback_route) // ⚠️ Route wildcard en dernier
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

    // Extraire specialized_type depuis l'input (pour recherche spécialisée dédiée)
    let specialized_type = input.specialized_type.as_deref();

    log_info(&format!(
        "[DIRECT_SEARCH] Recherche directe pour utilisateur {} (GPS: {:?}, specialized_type: {:?})",
        user.id, input.gps_mobile, specialized_type
    ));

    // Extraire le texte de l'input
    let mut user_text = input.texte.clone().unwrap_or_default();
    let has_text = !user_text.trim().is_empty();
    let has_images = input
        .base64_image
        .as_ref()
        .map(|imgs| !imgs.is_empty())
        .unwrap_or(false);
    let has_audio = input
        .audio_base64
        .as_ref()
        .map(|audios| !audios.is_empty())
        .unwrap_or(false);

    log_info(&format!(
        "[DIRECT_SEARCH] Contenu: texte={}, images={}, audio={}",
        has_text, has_images, has_audio
    ));

    // ✅ NOUVELLE LOGIQUE 2025-11-28: Si audio présent, transcrire PUIS combiner avec texte
    if has_audio {
        use crate::services::audio_transcription_service::AudioTranscriptionService;

        log_info("[DIRECT_SEARCH] 🎤 Audio détecté - Transcription en cours...");

        if let Some(audios) = &input.audio_base64 {
            if let Some(first_audio) = audios.first() {
                match AudioTranscriptionService::transcribe_audio_base64(first_audio).await {
                    Ok(transcription) => {
                        log_info(&format!(
                            "[DIRECT_SEARCH] ✅ Audio transcrit: '{}' (langue: {:?}, confiance: {:?})",
                            transcription.text.chars().take(100).collect::<String>(),
                            transcription.language,
                            transcription.confidence
                        ));

                        // Combiner le texte existant avec la transcription
                        if user_text.trim().is_empty() {
                            user_text = transcription.text;
                        } else {
                            user_text = format!("{} {}", user_text.trim(), transcription.text);
                        }

                        log_info(&format!(
                            "[DIRECT_SEARCH] 📝 Texte combiné après transcription: '{}'",
                            user_text.chars().take(150).collect::<String>()
                        ));
                    }
                    Err(e) => {
                        log_error(&format!(
                            "[DIRECT_SEARCH] ❌ Erreur transcription audio: {}",
                            e
                        ));
                        // Continuer avec le texte existant (peut être vide)
                        // Si pas de texte et transcription échoue, la recherche échouera mais c'est mieux que de crasher
                    }
                }
            }
        }
    }

    // ✅ NOUVELLE LOGIQUE 2025-11-04: Si image présente, analyser PUIS combiner avec texte pour recherche globale
    if has_images {
        use crate::services::intelligent_image_analysis_service::IntelligentImageAnalysisService;

        log_info("[DIRECT_SEARCH] 🖼️ Image détectée - Analyse IA puis recherche globale");

        let images = input.base64_image.as_ref().unwrap();
        let first_image = &images[0];

        // ✅ Préparation image : Accepte URL, data URI ou base64 pur
        let image_base64 =
            if first_image.starts_with("http://") || first_image.starts_with("https://") {
                // URL directe (ex: Cloudinary)
                log_info(&format!(
                    "[DIRECT_SEARCH] URL d'image détectée: {}",
                    &first_image[..first_image.len().min(60)]
                ));
                first_image.clone()
            } else if first_image.contains("base64,") {
                // Data URI - extraire le base64 pur
                first_image
                    .split("base64,")
                    .nth(1)
                    .unwrap_or(first_image)
                    .to_string()
            } else {
                // Base64 pur
                first_image.clone()
            };

        // ✅ ÉTAPE 1: Analyser l'image pour extraire le vecteur de caractéristiques
        log_info("[DIRECT_SEARCH] 📸 Étape 1/2: Analyse IA de l'image...");

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
                    "[DIRECT_SEARCH] ✅ Analyse réussie: {} (confiance: {:.2})",
                    &analysis.description.chars().take(50).collect::<String>(),
                    analysis.confiance
                ));

                // ✅ ÉTAPE 2: Combiner vecteur + titre + catégorie + description + texte utilisateur
                log_info("[DIRECT_SEARCH] 🔗 Étape 2/2: Combinaison vecteur + texte pour recherche globale...");

                // Construire l'input combiné pour recherche globale
                let combined_search_text = if has_text {
                    // Texte utilisateur + Catégorie + Nom + Description + Tags
                    format!(
                        "{} {} {} {} {}",
                        user_text.trim(),
                        analysis.category_detected,
                        analysis.search_query_exact,
                        analysis.description.chars().take(100).collect::<String>(),
                        analysis.tags.join(" ")
                    )
                } else {
                    // Seulement analyse image : Catégorie + Nom + Description + Tags
                    format!(
                        "{} {} {} {}",
                        analysis.category_detected,
                        analysis.search_query_exact,
                        analysis.description,
                        analysis.tags.join(" ")
                    )
                };

                log_info(&format!(
                    "[DIRECT_SEARCH] 🎯 Input combiné ({}+ caractères): '{}'",
                    combined_search_text.len(),
                    &combined_search_text.chars().take(150).collect::<String>()
                ));

                // Extraire GPS
                let gps_zone = input.gps_mobile.as_deref();
                let search_radius_km = Some(50);

                // ✅ APPELER RECHERCHE avec l'input combiné
                let (mut result, tokens_consumed_search) = rechercher_besoin_direct(
                    &_state.pg,                          // ✅ CORRIGÉ: Utiliser le pool existant
                    Some(_state.cache_service.clone()),  // ✅ CORRIGÉ: Réutiliser le cache service
                    _state.geographic_matching.clone(), // ✅ CORRIGÉ: Réutiliser le matching géographique (déjà Option)
                    Some(_state.search_metrics.clone()), // ✅ NOUVEAU 2025-12-01: Service de métriques singleton
                    Some(_state.scalability.clone()), // ✅ NOUVEAU 2025-12-01: Service de scalabilité pour cache optimisé
                    Some(user.id),
                    &combined_search_text,
                    gps_zone,
                    search_radius_km,
                    specialized_type, // ✅ Transmettre specialized_type
                )
                .await?;

                let results_count = result
                    .get("resultats")
                    .and_then(|r| r.as_array())
                    .map(|arr| arr.len())
                    .unwrap_or(0);

                log_info(&format!(
                    "[DIRECT_SEARCH] ✅ Recherche globale réussie: {} résultats trouvés",
                    results_count
                ));
                log_info(&format!(
                    "[DIRECT_SEARCH] 📊 Analyse image: '{}' (confiance: {:.2}, tokens: {})",
                    &analysis.description.chars().take(50).collect::<String>(),
                    analysis.confiance,
                    ai_cost.total_tokens
                ));
                log_info(&format!(
                    "[DIRECT_SEARCH] 🎯 Vecteur: {} caractéristiques extraites",
                    analysis.tags.len()
                ));

                // ✅ FACTURATION ANNULÉE - Recherche par image GRATUITE
                let billing_info = serde_json::json!({
                    "charged": false,
                    "amount": 0,
                    "message": "Recherche par image gratuite",
                    "ai_cost_usd": ai_cost.cost_usd,
                    "ai_tokens": ai_cost.total_tokens,
                    "results_found": results_count
                });

                log_info(&format!(
                    "[DIRECT_SEARCH] 🆓 Recherche par image GRATUITE pour user {} ({} résultats)",
                    user.id, results_count
                ));

                // ✅ Enrichir résultats avec publicités
                if let Some(resultats) = result.get_mut("resultats").and_then(|r| r.as_array_mut())
                {
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

                    // ✅ OPTIMISÉ: Utiliser le cache pour les publicités
                    let publicite_service =
                        crate::services::publicite_search_service::PubliciteSearchService::new(
                            Some(_state.cache_service.clone()),
                        );
                    if let Err(e) = publicite_service
                        .enrich_search_results_with_promotion(&_state.pg, resultats, user_coords)
                        .await
                    {
                        log_error(&format!(
                            "[DIRECT_SEARCH] Erreur enrichissement promotion: {}",
                            e
                        ));
                    }

                    // Re-trier par score
                    resultats.sort_by(|a, b| {
                        let score_a = a.get("score").and_then(|s| s.as_f64()).unwrap_or(0.0);
                        let score_b = b.get("score").and_then(|s| s.as_f64()).unwrap_or(0.0);
                        score_b
                            .partial_cmp(&score_a)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });
                }

                // ✅ OPTIMISÉ 2025-11-30: Extraire l'objet prestataires depuis le résultat
                let prestataires = result.get("prestataires").cloned();

                // Construire la réponse avec résultats de recherche globale + méta-données analyse image
                let response = serde_json::json!({
                    "status": "success",
                    "intention": "recherche_besoin",
                    "resultats": result.get("resultats"),
                    "prestataires": prestataires.unwrap_or(json!({})), // ✅ NOUVEAU: Objet prestataires regroupé
                    "tokens_consumed": ai_cost.total_tokens + tokens_consumed_search,
                    "message": format!("Recherche par image + texte: {} résultats", results_count),
                    "search_method": if has_audio { "image_analysis_audio_then_global_search" } else { "image_analysis_then_global_search" },
                    "image_analysis": {
                        "description": analysis.description,
                        "tags": analysis.tags,
                        "category": analysis.category_detected,
                        "marque": analysis.marque,
                        "couleurs": analysis.couleurs,
                        "confiance": analysis.confiance,
                        "search_query_exact": analysis.search_query_exact,
                        "search_query_broad": analysis.search_query_broad,
                        "search_query_semantic": analysis.search_query_semantic,
                        "model_used": ai_cost.model_used,
                        "vecteur_caracteristiques": analysis.tags.clone()
                    },
                    "user_text_provided": has_text,
                    "audio_transcribed": has_audio,
                    "combined_search_used": true,
                    "billing": billing_info,
                    "gps_filtered": gps_zone.is_some(),
                    "search_radius_km": search_radius_km
                });

                return Ok(Json(response));
            }
            Err(e) => {
                log_error(&format!(
                    "[DIRECT_SEARCH] ❌ Erreur analyse IA image: {:?}",
                    e
                ));

                // ✅ FALLBACK: Si analyse échoue mais il y a du texte, utiliser juste le texte
                if has_text {
                    log_warn("[DIRECT_SEARCH] ⚠️ Analyse image échouée - Fallback vers recherche textuelle");

                    let gps_zone = input.gps_mobile.as_deref();
                    let search_radius_km = Some(50);

                    let (result, tokens_consumed) = rechercher_besoin_direct(
                        &_state.pg,                          // ✅ CORRIGÉ: Utiliser le pool existant
                        Some(_state.cache_service.clone()), // ✅ CORRIGÉ: Réutiliser le cache service
                        _state.geographic_matching.clone(), // ✅ CORRIGÉ: Réutiliser le matching géographique (déjà Option)
                        Some(_state.search_metrics.clone()), // ✅ NOUVEAU 2025-12-01: Service de métriques singleton
                        Some(_state.scalability.clone()), // ✅ NOUVEAU 2025-12-01: Service de scalabilité pour cache optimisé
                        Some(user.id),
                        &user_text,
                        gps_zone,
                        search_radius_km,
                        specialized_type, // ✅ Transmettre specialized_type
                    )
                    .await?;

                    // ✅ OPTIMISÉ 2025-11-30: Extraire l'objet prestataires depuis le résultat
                    let prestataires = result.get("prestataires").cloned();

                    let response = serde_json::json!({
                        "status": "success",
                        "intention": "recherche_besoin",
                        "resultats": result,
                        "prestataires": prestataires.unwrap_or(json!({})), // ✅ NOUVEAU: Objet prestataires regroupé
                        "tokens_consumed": tokens_consumed,
                        "message": "Recherche textuelle (analyse image échouée)",
                        "search_method": "text_fallback",
                        "image_analysis_error": format!("{}", e)
                    });

                    return Ok(Json(response));
                } else {
                    log_warn("[DIRECT_SEARCH] ⚠️ Analyse IA échouée sans texte - Fallback vers recherche générique");

                    // Recherche générique avec tous les produits récents
                    let fallback_result = sqlx::query_as::<_, (i32, Value, Option<String>)>(
                        r#"
                                SELECT id, data, gps
                                FROM services
                                WHERE is_active = true
                                AND data IS NOT NULL
                                ORDER BY created_at DESC
                                LIMIT 20
                                "#,
                    )
                    .fetch_all(&_state.pg)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur recherche fallback: {}", e)))?;

                    let fallback_json: Vec<Value> = fallback_result
                        .iter()
                        .map(|(id, data, gps)| {
                            json!({
                                "service_id": id,
                                "data": data,
                                "gps": gps,
                                "score": 0.5,
                                "match_reason": "Fallback - recherche générique"
                            })
                        })
                        .collect();

                    let response = json!({
                        "status": "success",
                        "intention": "recherche_besoin",
                        "resultats": fallback_json,
                        "tokens_consumed": 0,
                        "message": format!("Recherche générique (analyse image échouée): {} résultats", fallback_json.len()),
                        "search_method": "fallback_generic",
                        "image_analysis_error": format!("{}", e)
                    });

                    return Ok(Json(response));
                }
            }
        }
    }

    // ✅ Recherche textuelle normale ou fallback
    let gps_zone = input.gps_mobile.as_deref();
    let search_radius_km = Some(50); // Rayon par défaut de 50km

    log_info(&format!(
        "[DIRECT_SEARCH] Paramètres GPS extraits: zone={:?}, rayon={:?}km",
        gps_zone, search_radius_km
    ));

    // Recherche directe sans détection d'intention, avec filtrage GPS
    let (mut result, tokens_consumed) = rechercher_besoin_direct(
        &_state.pg,                          // ✅ CORRIGÉ: Utiliser le pool existant
        Some(_state.cache_service.clone()),  // ✅ CORRIGÉ: Réutiliser le cache service
        _state.geographic_matching.clone(), // ✅ CORRIGÉ: Réutiliser le matching géographique (déjà Option)
        Some(_state.search_metrics.clone()), // ✅ NOUVEAU 2025-12-01: Service de métriques singleton
        Some(_state.scalability.clone()), // ✅ NOUVEAU 2025-12-01: Service de scalabilité pour cache optimisé
        Some(user.id),
        &user_text,
        gps_zone,
        search_radius_km,
        specialized_type,
    )
    .await?;

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

        // ✅ OPTIMISÉ: Utiliser le cache pour les publicités
        let publicite_service =
            crate::services::publicite_search_service::PubliciteSearchService::new(Some(
                _state.cache_service.clone(),
            ));
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
            score_b
                .partial_cmp(&score_a)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    // Construire la réponse
    let search_method = if has_audio && !user_text.trim().is_empty() {
        "audio_transcribed"
    } else {
        "text"
    };

    // ✅ OPTIMISÉ 2025-11-30: Extraire l'objet prestataires depuis le résultat (s'il existe)
    let prestataires = result.get("prestataires").cloned();

    let response = serde_json::json!({
        "status": "success",
        "intention": "recherche_besoin",
        "resultats": result,
        "prestataires": prestataires.unwrap_or(json!({})), // ✅ NOUVEAU: Objet prestataires regroupé pour éviter fetchPrestatairesBatch
        "tokens_consumed": tokens_consumed,
        "message": if has_audio { "Recherche directe réussie (audio transcrit)" } else { "Recherche directe réussie" },
        "search_method": search_method,
        "audio_transcribed": has_audio,
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
            let tokens_consumed = result
                .get("tokens_consumed")
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

/// ✅ NOUVEAU 2025-12-01: Health check endpoint pour monitoring et load balancer
/// Compatible avec Kubernetes, Docker Swarm, et autres orchestrateurs
#[axum::debug_handler]
async fn handle_health_check(
    State(state): State<Arc<AppState>>,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    use chrono::Utc;

    // Vérifier la connexion DB (critique)
    let db_healthy = state.pg.acquire().await.is_ok();

    // ✅ OPTIMISÉ 2025-12-01: Vérifier Redis via connexion directe (plus fiable)
    let redis_healthy = state
        .redis_client
        .get_multiplexed_async_connection()
        .await
        .is_ok();

    // Statut global
    let status = if db_healthy {
        if redis_healthy {
            "healthy"
        } else {
            "degraded" // DB OK mais Redis down (acceptable)
        }
    } else {
        "unhealthy" // DB down = critique
    };

    // Informations sur le pool de connexions
    let pool_size = state.pg.size();
    let idle_connections = state.pg.num_idle();
    let active_connections = pool_size.saturating_sub(idle_connections as u32);

    // ✅ OPTIMISÉ 2025-12-01: Retourner HTTP 503 si unhealthy (pour load balancer)
    let http_status = if status == "unhealthy" {
        axum::http::StatusCode::SERVICE_UNAVAILABLE
    } else {
        axum::http::StatusCode::OK
    };

    let response = axum::response::Response::builder()
        .status(http_status)
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_string(&json!({
                "status": status,
                "timestamp": Utc::now().to_rfc3339(),
                "version": env!("CARGO_PKG_VERSION"),
                "services": {
                    "database": {
                        "status": if db_healthy { "ok" } else { "down" },
                        "pool": {
                            "size": pool_size,
                            "active": active_connections,
                            "idle": idle_connections,
                        }
                    },
                    "redis": {
                        "status": if redis_healthy { "ok" } else { "down" },
                    }
                },
                "uptime_seconds": std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            }))
            .unwrap_or_default(),
        ))
        .unwrap();

    Ok(response)
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
    Json(payload): Json<Value>,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    let user_id = user.id;

    // ?? LOGS DE D?BOGAGE
    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] ?? REQU?TE RE?UE SUR /api/services/create");
    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] User ID: {}", user_id);
    eprintln!(
        "[DEBUG][HANDLE_CREER_SERVICE] Payload re?u: {}",
        serde_json::to_string(&payload).unwrap_or_default()
    );
    info!("[handle_creer_service] ?? ==== Requ?te re?ue sur /api/services/create ====");
    info!("[handle_creer_service] User ID: {}", user_id);
    info!(
        "[handle_creer_service] Payload re?u: {}",
        serde_json::to_string(&payload).unwrap_or_default()
    );

    // ?? CORRECTION : Extraire le champ 'data' du payload pour ?viter le double embo?tement
    // Le frontend envoie { user_id, data: {...} }
    // On extrait data pour le passer au contr?leur
    let data = payload.get("data").cloned().unwrap_or(payload.clone());

    eprintln!(
        "[DEBUG][HANDLE_CREER_SERVICE] Donn?es extraites: {}",
        serde_json::to_string(&data).unwrap_or_default()
    );
    info!(
        "[handle_creer_service] Donn?es extraites: {}",
        serde_json::to_string(&data).unwrap_or_default()
    );

    // Cr?er la structure attendue par creer_service
    let service_request =
        crate::controllers::service_controller::NewServiceRequest { user_id, data };

    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] Appel du contr?leur creer_service...");
    info!("[handle_creer_service] Appel du contr?leur creer_service...");

    let response_result =
        crate::controllers::service_controller::creer_service(State(state), Json(service_request))
            .await;

    eprintln!("[DEBUG][HANDLE_CREER_SERVICE] R?ponse du contr?leur re?ue");
    info!("[handle_creer_service] R?ponse du contr?leur re?ue");

    match response_result {
        response if response.status().is_success() => {
            eprintln!("[DEBUG][HANDLE_CREER_SERVICE] ? SUCC?S - Service cr??");
            info!("[handle_creer_service] ? Service cr?? avec succ?s");
            Ok(response)
        }
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

    log::info!(
        "[handle_creation_service_direct] ?? ==== Requête reçue sur /api/ia/creation-service ===="
    );
    log::info!("[handle_creation_service_direct] User ID: {}", user_id);
    log::info!("[handle_creation_service_direct] Input: {:?}", input);

    // ?? NOUVEAU : Vérifier s'il y a des fichiers à traiter
    let has_images = input
        .base64_image
        .as_ref()
        .map_or(false, |images| !images.is_empty());
    let has_audios = input
        .audio_base64
        .as_ref()
        .map_or(false, |audios| !audios.is_empty());
    let has_videos = input
        .video_base64
        .as_ref()
        .map_or(false, |videos| !videos.is_empty());
    let has_docs = input
        .doc_base64
        .as_ref()
        .map_or(false, |docs| !docs.is_empty());
    let has_excels = input
        .excel_base64
        .as_ref()
        .map_or(false, |excels| !excels.is_empty());

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

    // ?? NOUVEAU : Transcrire l'audio si présent
    let mut user_text = input.texte.clone().unwrap_or_default();

    if has_audios {
        log::info!("[handle_creation_service_direct] 🎤 Transcription audio en cours...");
        if let Some(audios) = &input.audio_base64 {
            if let Some(first_audio) = audios.first() {
                match crate::services::audio_transcription_service::AudioTranscriptionService::transcribe_audio_base64(first_audio).await {
                    Ok(transcription) => {
                        log::info!(
                            "[handle_creation_service_direct] ✅ Audio transcrit: '{}'",
                            transcription.text.chars().take(100).collect::<String>()
                        );
                        // Combiner le texte existant avec la transcription
                        if user_text.is_empty() {
                            user_text = transcription.text;
                        } else {
                            user_text = format!("{} {}", user_text, transcription.text);
                        }
                    }
                    Err(e) => {
                        log::error!(
                            "[handle_creation_service_direct] ❌ Erreur transcription audio: {}",
                            e
                        );
                        // Continuer avec le texte existant (peut être vide)
                    }
                }
            }
        }
    }

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
    // ?? CORRECTION : L'ordre de retour est (model_name, response, tokens)
    let (model_name, response, tokens_consumed) = if has_images {
        log::info!(
            "[handle_creation_service_direct] Appel multimodal avec {} image(s)",
            input.base64_image.as_ref().map_or(0, |v| v.len())
        );
        app_ia
            .predict_multimodal(&prompt, input.base64_image.clone())
            .await?
    } else {
        if has_audios {
            log::info!(
                "[handle_creation_service_direct] Appel texte avec audio transcrit (pas d'images)"
            );
        } else {
            log::info!("[handle_creation_service_direct] Appel texte uniquement (pas d'images)");
        }
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

    log::info!(
        "[handle_creation_service_direct] Réponse brute: {}",
        response
    );
    log::info!(
        "[handle_creation_service_direct] JSON extrait: {}",
        json_response
    );

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
        format!("Erreur parsing JSON: {}", e)
    })?;

    log::info!(
        "[handle_creation_service_direct] JSON parsé avec succès: {}",
        data
    );

    // ✅ NOUVEAU 2025-11-03: Génération progressive de combinaisons
    let session_id = uuid::Uuid::new_v4().to_string();
    let mut combination_info = json!({
        "status": "no_combinations",
        "seeds_count": 0,
        "estimated_total": 0,
        "estimated_time_seconds": 0,
        "progress_endpoint": format!("/api/combinations/progress/{}", session_id)
    });

    // Vérifier si type_offre = "produit" OU "prestation" et si produits.type_donnee = "autocomplete"
    if let Some(type_offre) = data
        .get("data")
        .and_then(|d| d.get("type_offre"))
        .and_then(|t| t.get("valeur"))
        .and_then(|v| v.as_str())
    {
        if type_offre == "produit" || type_offre == "prestation" {
            if let Some(produits) = data.get("data").and_then(|d| d.get("produits")) {
                if produits.get("type_donnee").and_then(|t| t.as_str()) == Some("autocomplete") {
                    // Extraire et sauvegarder les SEEDS immédiatement
                    match crate::services::autocomplete_combinations_service::extract_combinations_from_ai_response(&data) {
                        Ok(seeds) => {
                            log::info!("[handle_creation_service_direct] ✅ {} seeds extraits", seeds.len());

                            // ✅ NOUVEAU 2025-11-28 : Extraire les sous_caracteristiques depuis les seeds pour inclusion immédiate
                            let mut seeds_sous_caracs = serde_json::Map::new();
                            let mut seeds_product_vector: Vec<String> = Vec::new();
                            let mut seeds_product_labels: Vec<String> = Vec::new();
                            
                            if let Some(preferred_seed) = seeds.first() {
                                // Extraire product_vector et product_labels de la combinaison préférée
                                seeds_product_vector = preferred_seed.product_vector.clone();
                                seeds_product_labels = preferred_seed.product_labels.clone();
                                
                                // Convertir product_vector + product_labels en format sous_caracteristiques
                                // ✅ CRITIQUE: La valeur préférée de l'IA doit être en PREMIÈRE position dans chaque dimension
                                // Chaque label correspond à une dimension, chaque valeur du vector correspond à la valeur choisie
                                for (index, label) in preferred_seed.product_labels.iter().enumerate() {
                                    if let Some(value) = preferred_seed.product_vector.get(index) {
                                        // ✅ CORRIGÉ: Toujours créer un nouveau tableau avec la valeur préférée en PREMIÈRE position
                                        // Cela garantit que la valeur préférée par l'IA sera toujours affichée en premier dans le formulaire
                                        let mut values_array = vec![serde_json::Value::String(value.clone())];
                                        
                                        // Si d'autres valeurs existent déjà (depuis d'autres sources), les ajouter après
                                        if let Some(existing_arr) = seeds_sous_caracs.get(label) {
                                            if let Some(existing_vals) = existing_arr.as_array() {
                                                for existing_val in existing_vals {
                                                    if let Some(existing_str) = existing_val.as_str() {
                                                        // Ne pas dupliquer la valeur préférée
                                                        if existing_str != value {
                                                            values_array.push(existing_val.clone());
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        
                                        // Insérer avec la valeur préférée en première position
                                        seeds_sous_caracs.insert(label.clone(), serde_json::Value::Array(values_array));
                                    }
                                }
                                
                                log::info!("[handle_creation_service_direct] ✅ Sous-caractéristiques extraites depuis seeds: {} dimensions", seeds_sous_caracs.len());
                            }

                            // Sauvegarder les seeds immédiatement
                            match crate::services::autocomplete_combinations_service::save_ai_combinations_batch(
                                &state.pg,
                                seeds.clone(),
                                &session_id,
                            ).await {
                                Ok(_) => {
                                    log::info!("[handle_creation_service_direct] ✅ Seeds sauvegardés en DB");
                                }
                                Err(e) => {
                                    log::warn!("[handle_creation_service_direct] Erreur sauvegarde seeds: {}", e);
                                }
                            }
                            
                            // ✅ NOUVEAU 2025-11-28 : Stocker les seeds pour inclusion dans la réponse
                            combination_info = json!({
                                "status": "in_progress",
                                "seeds_count": seeds.len(),
                                "seeds_available": true,
                                "sous_caracteristiques": seeds_sous_caracs,
                                "product_vector": seeds_product_vector,
                                "product_labels": seeds_product_labels,
                            });

                            // Estimer le nombre total de combinaisons
                            match crate::services::exhaustive_combination_generator::ExhaustiveCombinationGenerator::from_ia_response(&data) {
                                Ok(generator) => {
                                    let estimated_total = generator.estimate_total_combinations();
                                    let estimated_time = crate::services::background_combination_generator::estimate_generation_time(estimated_total);

                                    log::info!(
                                        "[handle_creation_service_direct] Estimation: {} combinaisons (~{} secondes)",
                                        estimated_total,
                                        estimated_time
                                    );

                                    // ✅ CORRIGÉ 2025-11-28 : Fusionner avec les données seeds existantes au lieu de remplacer
                                    if let Some(info_obj) = combination_info.as_object_mut() {
                                        info_obj.insert("estimated_total".to_string(), json!(estimated_total));
                                        info_obj.insert("estimated_time_seconds".to_string(), json!(estimated_time));
                                        info_obj.insert("progress_endpoint".to_string(), json!(format!("/api/combinations/progress/{}", session_id)));
                                    } else {
                                        combination_info = json!({
                                            "status": "in_progress",
                                            "seeds_count": seeds.len(),
                                            "seeds_available": true,
                                            "sous_caracteristiques": seeds_sous_caracs,
                                            "product_vector": seeds_product_vector,
                                            "product_labels": seeds_product_labels,
                                            "estimated_total": estimated_total,
                                            "estimated_time_seconds": estimated_time,
                                            "progress_endpoint": format!("/api/combinations/progress/{}", session_id)
                                        });
                                    }

                                    // 🚀 LANCER LA GÉNÉRATION EN BACKGROUND (non-bloquant)
                                    let state_clone = state.clone();
                                    let data_clone = data.clone();
                                    let session_id_clone = session_id.clone();

                                    tokio::spawn(async move {
                                        log::info!("[Background] 🚀 Task de génération lancée pour session {}", session_id_clone);

                                        if let Err(e) = crate::services::background_combination_generator::generate_all_combinations_background(
                                            state_clone,
                                            data_clone,
                                            session_id_clone.clone(),
                                        ).await {
                                            log::error!("[Background] ❌ Erreur génération session {}: {}", session_id_clone, e);
                                        } else {
                                            log::info!("[Background] ✅ Génération terminée pour session {}", session_id_clone);
                                        }
                                    });

                                    log::info!("[handle_creation_service_direct] 🚀 Génération background lancée");
                                }
                                Err(e) => {
                                    log::warn!("[handle_creation_service_direct] Impossible d'estimer combinaisons: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            log::warn!("[handle_creation_service_direct] Impossible d'extraire seeds: {}", e);
                        }
                    }
                }
            }
        }
    }

    // ?? NOUVEAU : Extraire les données du service sans les créer dans la base
    let service_data = data.get("data").unwrap_or(&data);

    // ?? NOUVEAU : Préparer les données pour le formulaire (sans création en base)
    let service_request_data = json!({
        "data": service_data,
        "base64_image": json!([]),  // Ne pas renvoyer les images (déjà traitées)
        "audio_base64": json!([]),  // Ne pas renvoyer les audios
        "video_base64": json!([]),  // Ne pas renvoyer les vidéos
        "doc_base64": json!([]),    // Ne pas renvoyer les documents
        "excel_base64": json!([]),  // Ne pas renvoyer les fichiers Excel
        "tokens_consumed": tokens_consumed,
        "ia_model_used": model_name
    });

    log::info!("[handle_creation_service_direct] Données préparées pour le formulaire avec {} types de fichiers...", total_files);

    // ?? IMPORTANT : NE PAS créer le service ici, juste préparer les données
    // Le service sera créé par le formulaire via /api/services/create

    // ✅ NOUVEAU 2025-11-06 : Extraire les valeurs une seule fois (clonées pour éviter lifetime issues)
    let titre_value = service_data
        .get("titre_service")
        .and_then(|v| v.get("valeur"))
        .cloned()
        .unwrap_or(json!(""));
    let category_value = service_data
        .get("category")
        .and_then(|v| v.get("valeur"))
        .cloned()
        .unwrap_or(json!(""));
    let description_value = service_data
        .get("description")
        .and_then(|v| v.get("valeur"))
        .cloned()
        .unwrap_or(json!(""));

    // ✅ NOUVEAU 2025-11-28 : Extraire les données des seeds depuis combination_info
    let mut data_obj = serde_json::Map::new();

    // Ajouter les champs de base
    data_obj.insert(
        "titre_service".to_string(),
        json!({
            "type_donnee": "string",
            "valeur": titre_value,
            "origine_champs": "ia"
        }),
    );
    data_obj.insert(
        "category".to_string(),
        json!({
            "type_donnee": "string",
            "valeur": category_value,
            "origine_champs": "ia"
        }),
    );
    data_obj.insert(
        "description".to_string(),
        json!({
            "type_donnee": "string",
            "valeur": description_value,
            "origine_champs": "ia"
        }),
    );

    // Champs PRODUIT
    data_obj.insert(
        "nom_produit".to_string(),
        json!({
            "type_donnee": "string",
            "valeur": service_data.get("nom_produit")
                .and_then(|v| v.get("valeur"))
                .cloned()
                .unwrap_or(titre_value.clone()),
            "origine_champs": "ia"
        }),
    );
    data_obj.insert(
        "categorie_produit".to_string(),
        json!({
            "type_donnee": "string",
            "valeur": service_data.get("categorie_produit")
                .and_then(|v| v.get("valeur"))
                .cloned()
                .unwrap_or(category_value.clone()),
            "origine_champs": "ia"
        }),
    );
    data_obj.insert(
        "description_produit".to_string(),
        json!({
            "type_donnee": "string",
            "valeur": service_data.get("description_produit")
                .and_then(|v| v.get("valeur"))
                .cloned()
                .unwrap_or(description_value.clone()),
            "origine_champs": "ia"
        }),
    );
    data_obj.insert(
        "is_tarissable".to_string(),
        json!({
            "type_donnee": "boolean",
            "valeur": service_data.get("is_tarissable")
                .and_then(|v| v.get("valeur"))
                .cloned()
                .unwrap_or(json!(false)),
            "origine_champs": "ia"
        }),
    );

    // ✅ NOUVEAU 2025-11-28 : Ajouter les données produits avec sous_caracteristiques depuis seeds
    if let Some(seeds_available) = combination_info
        .get("seeds_available")
        .and_then(|v| v.as_bool())
    {
        if seeds_available {
            let sous_caracs = combination_info
                .get("sous_caracteristiques")
                .cloned()
                .unwrap_or(json!({}));
            let product_vector = combination_info
                .get("product_vector")
                .cloned()
                .unwrap_or(json!([]));
            let product_labels = combination_info
                .get("product_labels")
                .cloned()
                .unwrap_or(json!([]));

            data_obj.insert(
                "produits".to_string(),
                json!({
                    "type_donnee": "autocomplete",
                    "valeur": [],
                    "sous_caracteristiques": sous_caracs,
                    "product_vector": product_vector,
                    "product_labels": product_labels,
                    "origine_champs": "ia"
                }),
            );

            log::info!("[handle_creation_service_direct] ✅ Données produits avec sous_caracteristiques ajoutées à la réponse");
        }
    }

    // Construire la réponse finale avec la structure attendue par le frontend
    let final_response = json!({
        "status": "success",
        "intention": "creation_service",
        "session_id": session_id,  // ✅ NOUVEAU : Session ID pour tracking
        "data": serde_json::Value::Object(data_obj),
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
        "combination_generation": combination_info,  // ✅ NOUVEAU : Info génération progressive
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

    #[derive(sqlx::FromRow)]
    struct UserBalanceRow {
        tokens_balance: i64,
    }

    // R?cup?rer le solde actuel de l'utilisateur
    let solde_result: Result<UserBalanceRow, _> =
        sqlx::query_as("SELECT tokens_balance FROM users WHERE id = $1")
            .bind(user_id)
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

/// ✅ NOUVEAU 2025-12-02: Handler pour recherche paginée avec cursor
#[axum::debug_handler]
async fn handle_paginated_search(
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(request): Json<crate::services::native_search_service::PaginatedSearchRequest>,
) -> AppResult<impl IntoResponse> {
    
    use crate::utils::log::log_info;

    let start_time = std::time::Instant::now();

    log_info(&format!(
        "[PAGINATED_SEARCH] Recherche paginée pour utilisateur {}: '{}' (cursor: {:?}, page_size: {:?})",
        user.id,
        request.query,
        request.cursor.as_ref().map(|c| c.chars().take(20).collect::<String>()),
        request.page_size
    ));

    // Appeler le service de recherche paginée
    // Créer une instance de NativeSearchService avec le pool de lecture si disponible
    let search_service =
        crate::services::native_search_service::NativeSearchService::new_with_read_replica(
            state.pg.clone(),
            state.pg_read.clone(),
        );
    // Cloner les valeurs nécessaires avant le move
    let query_clone = request.query.clone();
    let specialized_type_clone = request.specialized_type.clone();
    let category_filter_clone = request.category_filter.clone();
    
    let response = search_service.intelligent_search_paginated(request).await?;

    let duration = start_time.elapsed();

    // Enregistrer les métriques
    state.search_metrics
            .record_search(
                &query_clone,
                specialized_type_clone.as_deref(),
                category_filter_clone.as_deref(),
                duration,
                Duration::from_millis(0), // DB time non mesuré pour l'instant
                false,                    // Cache hit sera déterminé par le service
            )
            .await;

    log_info(&format!(
        "[PAGINATED_SEARCH] ✅ Recherche paginée terminée en {:?}: {} résultats (has_more: {})",
        duration,
        response.results.len(),
        response.has_more
    ));

    Ok(Json(serde_json::json!({
        "success": true,
        "data": response,
        "duration_ms": duration.as_millis(),
    })))
}

async fn handle_search_metrics(State(state): State<Arc<AppState>>) -> Json<Value> {
    // ✅ CORRIGÉ 2025-12-01: Utiliser le service singleton depuis AppState
    let metrics_service = &state.search_metrics;

    // Mettre à jour les infos du pool
    let pool_size = state.pg.size() as u32;
    let idle = state.pg.num_idle() as u32;
    metrics_service
        .update_pool_info(pool_size.saturating_sub(idle), idle)
        .await;

    let metrics = metrics_service.get_metrics().await;
    let cache_hit_rate = metrics_service.cache_hit_rate().await;

    Json(json!({
        "status": "ok",
        "metrics": {
            "total_searches": metrics.total_searches,
            "successful_searches": metrics.successful_searches,
            "failed_searches": metrics.failed_searches,
            "cache_hits": metrics.cache_hits,
            "cache_misses": metrics.cache_misses,
            "cache_hit_rate_percent": cache_hit_rate,
            "average_response_time_ms": metrics.average_response_time_ms,
            "average_db_time_ms": metrics.average_db_time_ms,
            "searches_by_type": metrics.searches_by_type,
            "searches_by_category": metrics.searches_by_category,
            "top_queries": metrics.top_queries,
            "last_24h_searches": metrics.last_24h_searches,
            "last_hour_searches": metrics.last_hour_searches,
            "pool_connections": {
                "active": metrics.pool_connections_active,
                "idle": metrics.pool_connections_idle,
                "total": metrics.pool_connections_active + metrics.pool_connections_idle,
            }
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// ✅ NOUVEAU 2025-12-01: Endpoint métriques globales pour toutes les fonctionnalités
#[axum::debug_handler]
async fn handle_global_metrics(State(state): State<Arc<AppState>>) -> Json<Value> {
    // ✅ Utiliser le service singleton depuis AppState
    let metrics_service = &state.global_metrics;

    // Mettre à jour les infos des pools
    let db_pool_size = state.pg.size();
    let db_idle = state.pg.num_idle();
    let db_active = db_pool_size.saturating_sub(db_idle as u32);
    let db_idle_u32 = db_idle as u32;

    // Note: deadpool-redis Pool n'a pas de méthode status() avec size/idle
    // Utiliser les champs disponibles: max_size, size, available, waiting
    let redis_status = state
        .redis_pool
        .as_ref()
        .map(|p| {
            let status = p.status();
            (status.size, status.available)
        })
        .unwrap_or((0, 0));
    let redis_active = redis_status.0.saturating_sub(redis_status.1) as u32;
    let redis_idle = redis_status.1 as u32;

    metrics_service
        .update_pool_info(db_active, db_idle_u32, redis_active, redis_idle)
        .await;

    let metrics = metrics_service.get_metrics().await;
    let cache_hit_rate = metrics_service.cache_hit_rate().await;

    Json(json!({
        "status": "ok",
        "metrics": {
            "global": {
                "total_requests": metrics.total_requests,
                "total_successful": metrics.total_successful,
                "total_failed": metrics.total_failed,
                "average_response_time_ms": metrics.average_response_time_ms,
                "cache_hit_rate_percent": cache_hit_rate,
            },
            "by_function": {
                "search": {
                    "total": metrics.searches.total,
                    "successful": metrics.searches.successful,
                    "failed": metrics.searches.failed,
                    "cache_hits": metrics.searches.cache_hits,
                    "cache_misses": metrics.searches.cache_misses,
                    "average_time_ms": metrics.searches.average_time_ms,
                    "last_24h": metrics.searches.last_24h,
                    "last_hour": metrics.searches.last_hour,
                },
                "product_creation": {
                    "total": metrics.product_creation.total,
                    "successful": metrics.product_creation.successful,
                    "failed": metrics.product_creation.failed,
                    "cache_hits": metrics.product_creation.cache_hits,
                    "cache_misses": metrics.product_creation.cache_misses,
                    "average_time_ms": metrics.product_creation.average_time_ms,
                    "last_24h": metrics.product_creation.last_24h,
                    "last_hour": metrics.product_creation.last_hour,
                },
                "video_creation": {
                    "total": metrics.video_creation.total,
                    "successful": metrics.video_creation.successful,
                    "failed": metrics.video_creation.failed,
                    "cache_hits": metrics.video_creation.cache_hits,
                    "cache_misses": metrics.video_creation.cache_misses,
                    "average_time_ms": metrics.video_creation.average_time_ms,
                    "last_24h": metrics.video_creation.last_24h,
                    "last_hour": metrics.video_creation.last_hour,
                },
                "delivery_ordering": {
                    "total": metrics.delivery_ordering.total,
                    "successful": metrics.delivery_ordering.successful,
                    "failed": metrics.delivery_ordering.failed,
                    "cache_hits": metrics.delivery_ordering.cache_hits,
                    "cache_misses": metrics.delivery_ordering.cache_misses,
                    "average_time_ms": metrics.delivery_ordering.average_time_ms,
                    "last_24h": metrics.delivery_ordering.last_24h,
                    "last_hour": metrics.delivery_ordering.last_hour,
                },
                "other_operations": {
                    "total": metrics.other_operations.total,
                    "successful": metrics.other_operations.successful,
                    "failed": metrics.other_operations.failed,
                    "cache_hits": metrics.other_operations.cache_hits,
                    "cache_misses": metrics.other_operations.cache_misses,
                    "average_time_ms": metrics.other_operations.average_time_ms,
                    "last_24h": metrics.other_operations.last_24h,
                    "last_hour": metrics.other_operations.last_hour,
                },
            },
            "pools": {
                "database": {
                    "active": metrics.db_pool_active,
                    "idle": metrics.db_pool_idle,
                    "total": metrics.db_pool_active + metrics.db_pool_idle,
                },
                "redis": {
                    "active": metrics.redis_pool_active,
                    "idle": metrics.redis_pool_idle,
                    "total": metrics.redis_pool_active + metrics.redis_pool_idle,
                }
            }
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// Handler pour le géocodage inverse (coordonnées GPS vers adresse)
#[axum::debug_handler]
async fn handle_reverse_geocode(
    State(state): State<Arc<AppState>>,
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

    // Créer le service de géocodage (avec cache Redis) et effectuer la requête
    let geocoding_service = GeocodingService::with_cache(Some(state.redis_client.clone()));
    let result = geocoding_service.reverse_geocode(lat, lng).await?;

    Ok(Json(result))
}

/// Servir les fichiers média
/// ✅ CORRIGÉ: Rediriger vers S3/Wasabi si configuré, sinon fallback local
async fn serve_media_file(
    Path(file_path): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Response<Body>, StatusCode> {
    info!("[serve_media_file] Demande fichier: {}", file_path);

    // Sécurité : vérifier que le chemin ne contient pas de traversée de répertoire
    if file_path.contains("..") || file_path.contains("~") {
        warn!(
            "[serve_media_file] Tentative de traversée de répertoire: {}",
            file_path
        );
        return Err(StatusCode::BAD_REQUEST);
    }

    // ✅ CORRIGÉ: Si S3/Wasabi configuré, rediriger vers URL publique
    if state.media_storage.is_remote() {
        let public_url = state.media_storage.build_public_url(&file_path);
        info!(
            "[serve_media_file] Redirection vers S3/Wasabi: {}",
            public_url
        );

        // Redirection permanente vers URL S3/Wasabi
        return Ok(Redirect::permanent(&public_url).into_response());
    }

    // ✅ Fallback: Servir depuis stockage local (anciens médias, migration)
    let full_path = if file_path.starts_with("uploads/services/") {
        file_path.clone()
    } else if file_path.starts_with("uploads/") {
        file_path.clone()
    } else {
        format!("uploads/services/{}", file_path)
    };
    info!(
        "[serve_media_file] Fallback local - Chemin complet: {}",
        full_path
    );

    // Lire le fichier depuis disque local
    match File::open(&full_path).await {
        Ok(mut file) => {
            let mut contents = Vec::new();
            match file.read_to_end(&mut contents).await {
                Ok(_) => {
                    // Déterminer le type MIME
                    let content_type =
                        if file_path.ends_with(".jpg") || file_path.ends_with(".jpeg") {
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
                    headers.insert(
                        "cache-control",
                        HeaderValue::from_str("public, max-age=3600").unwrap(),
                    );

                    let file_size = contents.len();
                    let response = Response::builder()
                        .status(StatusCode::OK)
                        .body(Body::from(contents))
                        .unwrap();

                    info!(
                        "[serve_media_file] Fichier servi: {} ({} bytes)",
                        file_path, file_size
                    );
                    Ok(response)
                }
                Err(e) => {
                    error!(
                        "[serve_media_file] Erreur lecture fichier {}: {:?}",
                        full_path, e
                    );
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
        Err(_) => {
            // ✅ Réduire le logging : logger seulement les fichiers manquants une fois par minute max
            // pour éviter de spammer les logs avec des fichiers qui n'existent plus
            use std::sync::OnceLock;

            static LAST_MISSING_FILE_WARNING: OnceLock<Mutex<HashMap<String, Instant>>> =
                OnceLock::new();
            let warning_map = LAST_MISSING_FILE_WARNING.get_or_init(|| Mutex::new(HashMap::new()));

            let should_log = {
                let mut last_warnings = warning_map.lock().unwrap();
                let now = Instant::now();
                let file_key = full_path.clone();

                let should_log = last_warnings
                    .get(&file_key)
                    .map(|last| now.duration_since(*last) > Duration::from_secs(60))
                    .unwrap_or(true);

                if should_log {
                    last_warnings.insert(file_key, now);
                    // Nettoyer les entrées anciennes (> 5 minutes)
                    last_warnings
                        .retain(|_, time| now.duration_since(*time) < Duration::from_secs(300));
                }
                should_log
            };

            if should_log {
                warn!("[serve_media_file] Fichier non trouvé: {} (prochain warning pour ce fichier dans 1min)", full_path);
            }
            Err(StatusCode::NOT_FOUND)
        }
    }
}
