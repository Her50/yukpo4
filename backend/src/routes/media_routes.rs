// ?? src/routes/media_routes.rs

use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

use crate::controllers::{
    ia_controller::{
        generate_distribution_plan, generate_video_brief, generate_video_style,
        generate_video_timeline,
    },
    media_controller::{
        delete_media, get_effect, get_effects_by_category, get_template, get_templates_by_industry,
        list_effects, list_templates, serve_example_video, upload_media,
    },
    product_video_controller::{
        estimate_video_cost_for_product, generate_video_for_product,
        get_video_generation_job_status,
    },
};
use crate::middlewares::jwt::jwt_auth;
use crate::state::AppState;

pub fn media_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/media/upload/{service_id}", post(upload_media))
        // ✅ Alias pour compatibilité avec frontend (utilisé par CreationService.tsx)
        .route("/api/prestataire/upload/{service_id}", post(upload_media))
        .route("/media/delete/{media_id}", delete(delete_media))
        // ✅ PHASE 2: Endpoint pour servir la vidéo exemple (publique, pas d'auth)
        .route(
            "/api/media/examples/video-creation-demo.mp4",
            get(serve_example_video),
        )
        // ✅ NOUVEAU 2025-11-28: Routes pour génération vidéo IA (protégées par JWT)
        .route(
            "/api/media/generate-video-brief",
            post(generate_video_brief),
        )
        .route(
            "/api/media/generate-video-style",
            post(generate_video_style),
        )
        .route(
            "/api/media/generate-distribution-plan",
            post(generate_distribution_plan),
        )
        // ✅ NOUVEAU 2025-11-29: Route pour génération de timeline de montage vidéo
        .route(
            "/api/media/generate-video-timeline",
            post(generate_video_timeline),
        )
        // ✅ NOUVEAU 2025-01-27: Route pour preview temps réel (retourne paramètres d'effets)
        // .route(
        //     "/api/video/preview/realtime",
        //     post(get_realtime_preview_params), // TODO: À implémenter
        // )
        // ✅ NOUVEAU 2025-01-27: Routes pour bibliothèque d'effets étendue
        .route("/api/effects", get(list_effects))
        .route("/api/effects/{name}", get(get_effect))
        .route(
            "/api/effects/category/{category}",
            get(get_effects_by_category),
        )
        // ✅ NOUVEAU 2025-01-27: Routes pour bibliothèque de templates par industrie
        .route("/api/templates", get(list_templates))
        .route("/api/templates/{name}", get(get_template))
        .route(
            "/api/templates/industry/{industry}",
            get(get_templates_by_industry),
        )
        // ✅ NOUVEAU: Routes pour génération vidéo produit
        .route(
            "/api/media/product/{service_id}/{product_index}/generate-video",
            post(generate_video_for_product),
        )
        .route(
            "/api/media/product/{service_id}/{product_index}/estimate-video",
            post(estimate_video_cost_for_product),
        )
        // ✅ CORRIGÉ 2026-01-02: Route pour récupérer le statut d'un job de génération vidéo
        // IMPORTANT: Cette route doit être AVANT la route générique /api/media/{*file_path}
        .route(
            "/api/media/jobs/{job_id}",
            get(get_video_generation_job_status),
        )
        .layer(axum::middleware::from_fn(jwt_auth))
        // Les layers globaux CORS/TraceLayer sont appliqués dans lib.rs uniquement
        .with_state(state)
}
