use axum::{
    extract::{Extension, Path, Query, State},
    routing::{get, post, put, delete},
    Json, Router,
};
use http::StatusCode;
use serde_json::Value;
use std::sync::Arc;

use crate::controllers::product_comments_controller::{
    create_product_comment, delete_product_comment, get_product_comments,
    toggle_product_comment_reaction, update_product_comment,
};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;

pub fn product_comments_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // GET /api/services/{id}/comments - Récupérer les commentaires d'un service
        .route(
            "/api/services/{id}/comments",
            get(get_product_comments_handler)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    crate::middlewares::jwt::jwt_auth,
                )),
        )
        // POST /api/services/{id}/comments - Créer un commentaire
        .route(
            "/api/services/{id}/comments",
            post(create_product_comment_handler)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    crate::middlewares::jwt::jwt_auth,
                )),
        )
        // PUT /api/comments/{id} - Mettre à jour un commentaire
        .route(
            "/api/comments/{id}",
            put(update_product_comment_handler)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    crate::middlewares::jwt::jwt_auth,
                )),
        )
        // DELETE /api/comments/{id} - Supprimer un commentaire
        .route(
            "/api/comments/{id}",
            delete(delete_product_comment_handler)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    crate::middlewares::jwt::jwt_auth,
                )),
        )
        // POST /api/comments/{id}/reactions - Toggle réaction sur un commentaire
        .route(
            "/api/comments/{id}/reactions",
            post(toggle_product_comment_reaction_handler)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    crate::middlewares::jwt::jwt_auth,
                )),
        )
        .with_state(state)
}

// Wrappers pour convertir les StatusCode en réponse Axum appropriée
async fn get_product_comments_handler(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Query(query): Query<crate::controllers::product_comments_controller::CommentsQuery>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
) -> Result<Json<crate::controllers::product_comments_controller::CommentsPayload>, StatusCode> {
    get_product_comments(Path(service_id), State(state), Query(query), maybe_user).await
}

async fn create_product_comment_handler(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
    Json(payload): Json<crate::controllers::product_comments_controller::CreateCommentRequest>,
) -> Result<Json<Value>, StatusCode> {
    create_product_comment(Path(service_id), State(state), maybe_user, Json(payload)).await
}

async fn update_product_comment_handler(
    Path(comment_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
    Json(payload): Json<crate::controllers::product_comments_controller::UpdateCommentRequest>,
) -> Result<Json<Value>, StatusCode> {
    update_product_comment(Path(comment_id), State(state), maybe_user, Json(payload)).await
}

async fn delete_product_comment_handler(
    Path(comment_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
) -> Result<Json<Value>, StatusCode> {
    delete_product_comment(Path(comment_id), State(state), maybe_user).await
}

async fn toggle_product_comment_reaction_handler(
    Path(comment_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
    Json(payload): Json<crate::controllers::product_comments_controller::ReactionRequest>,
) -> Result<Json<Value>, StatusCode> {
    toggle_product_comment_reaction(Path(comment_id), State(state), maybe_user, Json(payload)).await
}

