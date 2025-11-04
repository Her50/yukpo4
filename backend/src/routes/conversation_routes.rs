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
        check_private_conversation,  // ✅ NOUVEAU
        create_private_conversation, // ✅ NOUVEAU
    },
    middlewares::jwt::jwt_auth,
    state::AppState,
};

pub fn conversation_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Gestion des participants
        .route("/api/conversations/:conversation_id/participants", get(get_conversation_participants))
        .route("/api/conversations/:conversation_id/invite", post(invite_user_to_conversation))
        .route("/api/conversations/:conversation_id/participants/:user_id", delete(remove_participant_from_conversation))
        
        // Recherche et historique
        .route("/api/conversations/search-users", get(search_users_for_invitation))
        .route("/api/conversations/tag-history", get(get_tag_history))
        
        // ✅ NOUVEAU : Conversations privées 1-to-1
        .route("/api/conversations/private/:target_user_id", get(check_private_conversation))
        .route("/api/conversations/create-private", post(create_private_conversation))
        
        // Toutes les routes nécessitent l'authentification
        .layer(middleware::from_fn(jwt_auth))
        .with_state(state)
}


