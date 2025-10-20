// Routes pour la gestion d'équipe des services
use axum::{
    routing::{get, post, patch, delete},
    Router,
};
use crate::controllers::service_team_controller::{
    get_team_members,
    invite_member,
    update_member_role,
    remove_member,
    get_available_roles,
    get_available_permissions,
    get_team_stats,
    accept_invitation,
};
use crate::state::AppState;
use std::sync::Arc;

pub fn service_team_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Gestion des membres d'équipe
        .route("/api/services/{service_id}/team", get(get_team_members))
        .route("/api/user/services/team", get(get_team_members))
        .route("/api/services/team/invite", post(invite_member))
        .route("/api/services/team/members/{member_id}", patch(update_member_role))
        .route("/api/services/team/members/{member_id}", delete(remove_member))
        
        // Rôles et permissions
        .route("/api/services/team/roles", get(get_available_roles))
        .route("/api/services/team/permissions", get(get_available_permissions))
        
        // Statistiques
        .route("/api/services/{service_id}/team/stats", get(get_team_stats))
        .route("/api/user/services/team/stats", get(get_team_stats))
        
        // Invitations
        .route("/api/services/team/invitations/{token}/accept", post(accept_invitation))
        .with_state(state)
}

