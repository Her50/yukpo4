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
        .with_state(state)
}

