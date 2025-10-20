// src/routes/conversation_routes.rs
// Routes pour la gestion des conversations multi-participants et @mentions

use axum::{
    middleware,
    routing::{get, post, delete},
    Router,
};
use std::sync::Arc;

use crate::{
    controllers::conversation_controller::{
        invite_user_to_conversation,
        remove_participant_from_conversation,
        get_conversation_participants,
        search_users_for_invitation,
        get_tag_history,
    },
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn conversation_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Gestion des participants
        .route("/conversations/{conversation_id}/participants", get(get_conversation_participants))
        .route("/conversations/{conversation_id}/invite", post(invite_user_to_conversation))
        .route("/conversations/{conversation_id}/participants/{user_id}", delete(remove_participant_from_conversation))
        
        // Recherche et historique
        .route("/conversations/search-users", get(search_users_for_invitation))
        .route("/conversations/tag-history", get(get_tag_history))
        
        // Toutes les routes nécessitent l'authentification
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}

