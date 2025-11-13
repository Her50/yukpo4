use std::sync::Arc;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};

use crate::{
    controllers::live_controller::{
        configure_flash_sales, create_flash_sale_commentary, get_join_information,
        get_live_session, get_lives_analytics, list_flash_sale_commentaries,
        list_flash_sale_reservations, list_flash_sales, list_upcoming_sessions, register_replay,
        reserve_flash_sale, start_live_session,
    },
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn live_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    let secured = Router::new()
        .route("/api/live/start", post(start_live_session))
        .route("/api/live/{id}/replay", post(register_replay))
        .route("/api/live/{id}/flash-sales", post(configure_flash_sales))
        .route(
            "/api/live/flash-sales/{flash_sale_id}/reservations",
            get(list_flash_sale_reservations).post(reserve_flash_sale),
        )
        .route(
            "/api/live/flash-sales/{flash_sale_id}/commentaries",
            post(create_flash_sale_commentary),
        )
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state.clone());

    let public = Router::new()
        .route("/api/live/upcoming", get(list_upcoming_sessions))
        .route("/api/live/{id}", get(get_live_session))
        .route("/api/live/{id}/join", get(get_join_information))
        .route("/api/live/{id}/flash-sales", get(list_flash_sales))
        .route(
            "/api/live/flash-sales/{flash_sale_id}/commentaries",
            get(list_flash_sale_commentaries),
        )
        .route("/api/live/analytics", get(get_lives_analytics))
        .with_state(state);

    public.merge(secured)
}
