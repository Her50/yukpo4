use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::ia_controller::{
        analyze_behavior, analyze_media_tags, analyze_text_input, enrichir_contexte_ia,
        get_available_effects, get_effect_metrics, handle_audio_suggestions, handle_audio_sync,
        handle_auto_captions, handle_auto_cut, handle_color_grade, handle_effect_preview,
        handle_quick_preview, handle_timeline_variants, predict_ia,
    },
    controllers::ia_status_controller::get_ia_status,
    middlewares::jwt::jwt_auth,
    state::AppState,
};

/// ?? Routes centralis?es pour toutes les fonctionnalit?s IA
pub fn ia_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Routes IA prot?g?es par JWT
    Router::<Arc<AppState>>::new()
        // ?? Analyse comportementale (IP, path, fr?quence)
        .route("/api/ia/score", post(analyze_behavior))
        // ?? Pr?diction texte simple via moteur IA
        .route("/api/ia/predict", post(predict_ia))
        // ?? Enrichissement du contexte
        .route("/api/ia/context", post(enrichir_contexte_ia))
        // ?? Statistiques d'usage des moteurs IA
        .route("/api/ia/status", get(get_ia_status))
        // ?? Analyse de texte pour le frontend (ChatInputPanel)
        .route("/api/ia/analyze", post(analyze_text_input))
        // ✅ CORRIGÉ 2025-12-18: Analyse média (couleurs dominantes, objets détectés, angles marketing)
        .route("/api/ia/media-analysis", post(analyze_media_tags))
        // ✅ NOUVEAU: Auto-cut intelligent
        .route("/api/ia/video/auto-cut", post(handle_auto_cut))
        // ✅ NOUVEAU: Synchronisation audio-vidéo
        .route("/api/ia/video/audio-sync", post(handle_audio_sync))
        // ✅ NOUVEAU: Color grading automatique
        .route("/api/ia/media/color-grade", post(handle_color_grade))
        // ✅ NOUVEAU: Génération automatique de sous-titres
        .route("/api/ia/video/auto-captions", post(handle_auto_captions))
        // ✅ NOUVEAU: Génération de previews d'effets
        .route(
            "/api/ia/effects/preview",
            post(handle_effect_preview).layer(
                axum::extract::DefaultBodyLimit::max(100_000_000), // ✅ 100 MB pour vidéos d'effets
            ),
        )
        // ✅ NOUVEAU: Génération de variantes de timeline
        .route(
            "/api/ia/video/timeline-variants",
            post(handle_timeline_variants),
        )
        // ✅ NOUVEAU: Suggestions audio contextuelles
        .route("/api/ia/audio/suggestions", post(handle_audio_suggestions))
        // ✅ NOUVEAU: Génération de preview rapide
        .route("/api/ia/video/quick-preview", post(handle_quick_preview))
        // ✅ NOUVEAU 2026-01-04: Liste des effets disponibles (public)
        .route("/api/video/effects", get(get_available_effects))
        // ✅ NOUVEAU 2026-01-04: Métriques des effets (protégé)
        .route(
            "/api/video/effects/metrics",
            get(get_effect_metrics).layer(axum::middleware::from_fn(jwt_auth)),
        )
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}
