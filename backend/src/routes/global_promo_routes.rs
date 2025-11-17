use std::sync::Arc;

use axum::{
    middleware,
    routing::{get, post, put},
    Router,
};

use crate::{
    controllers::global_promo_controller::{
        create_global_promo_event, get_global_promo_event, list_global_promo_catalog,
        list_global_promo_entries, list_global_promo_events, list_my_global_promo_entries,
        list_my_global_promo_events, regenerate_global_promo_snapshot,
        review_global_promo_entries_bulk, review_global_promo_entry, submit_my_global_promo_entry,
        update_global_promo_event, upsert_global_promo_entry,
    },
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn global_promo_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    let secured = Router::new()
        .route("/api/global-promos/events", post(create_global_promo_event))
        .route(
            "/api/global-promos/events/{event_id}",
            put(update_global_promo_event),
        )
        .route(
            "/api/global-promos/events/{event_id}/entries",
            post(upsert_global_promo_entry),
        )
        .route(
            "/api/global-promos/entries/{entry_id}/snapshot",
            post(regenerate_global_promo_snapshot),
        )
        .route(
            "/api/global-promos/entries/{entry_id}/review",
            post(review_global_promo_entry),
        )
        .route(
            "/api/global-promos/entries/bulk-review",
            post(review_global_promo_entries_bulk),
        )
        .route(
            "/api/me/global-promos/events",
            get(list_my_global_promo_events),
        )
        .route(
            "/api/me/global-promos/entries",
            get(list_my_global_promo_entries),
        )
        .route(
            "/api/me/global-promos/events/{event_id}/entries",
            post(submit_my_global_promo_entry),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state.clone());

    let public = Router::new()
        .route("/api/global-promos/events", get(list_global_promo_events))
        .route(
            "/api/global-promos/events/{event_id}",
            get(get_global_promo_event),
        )
        .route(
            "/api/global-promos/events/{event_id}/entries",
            get(list_global_promo_entries),
        )
        .route("/api/global-promos/catalog", get(list_global_promo_catalog))
        .with_state(state);

    public.merge(secured)
}
