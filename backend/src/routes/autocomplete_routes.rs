use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use crate::state::AppState;
use crate::controllers::autocomplete_controller::{
    get_autocomplete_suggestions,
    get_sub_characteristics,
    get_all_values,
    upsert_autocomplete_characteristic,
    historize_autocomplete_field,
    search_combinations, // ✅ NOUVEAU 2025-11-02: Recherche vectorielle multi-filtres
    save_ai_combinations,
    get_combinations_by_session,
    link_combinations_to_service,
};

/// Routes pour la gestion de l'autocomplete
pub fn autocomplete_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // GET /api/autocomplete/suggestions?identifiant_base=...&sous_caracteristique=...&prefix=...&limit=...
        .route("/api/autocomplete/suggestions", get(get_autocomplete_suggestions))
        // GET /api/autocomplete/sub-characteristics/{identifiant_base}
        .route("/api/autocomplete/sub-characteristics/{identifiant_base}", get(get_sub_characteristics))
        // GET /api/autocomplete/values/{identifiant_base}/{sous_caracteristique}
        .route("/api/autocomplete/values/{identifiant_base}/{sous_caracteristique}", get(get_all_values))
        // POST /api/autocomplete/upsert
        .route("/api/autocomplete/upsert", post(upsert_autocomplete_characteristic))
        // POST /api/autocomplete/historize
        .route("/api/autocomplete/historize", post(historize_autocomplete_field))
        // POST /api/autocomplete/search-combinations (✅ NOUVEAU 2025-11-02)
        .route("/api/autocomplete/search-combinations", post(search_combinations))
        // POST /api/autocomplete/save-ai-combinations (✅ NOUVEAU 2025-11-02)
        .route("/api/autocomplete/save-ai-combinations", post(save_ai_combinations))
        // GET /api/autocomplete/combinations/session/:session_id (✅ NOUVEAU 2025-11-02)
        .route("/api/autocomplete/combinations/session/:session_id", get(get_combinations_by_session))
        // POST /api/autocomplete/combinations/link-to-service (✅ NOUVEAU 2025-11-02)
        .route("/api/autocomplete/combinations/link-to-service", post(link_combinations_to_service))
        .with_state(state)
}

