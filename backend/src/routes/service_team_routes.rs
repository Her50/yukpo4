// Routes pour la gestion d'équipe des services
use crate::controllers::service_team_controller::{
    accept_invitation, get_available_permissions, get_available_roles, get_my_team_memberships,
    get_team_members, get_team_stats, invite_member, reject_invitation, remove_member,
    update_member_role,
};
use crate::state::AppState;
use axum::{
    routing::{delete, get, patch, post},
    Router,
};
use std::sync::Arc;

pub fn service_team_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Gestion des membres d'équipe
        .route("/api/services/{service_id}/team", get(get_team_members))
        .route("/api/user/services/team", get(get_team_members))
        .route("/api/services/team/invite", post(invite_member))
        .route(
            "/api/services/team/members/{member_id}",
            patch(update_member_role),
        )
        .route(
            "/api/services/team/members/{member_id}",
            delete(remove_member),
        )
        // Rôles et permissions
        .route("/api/services/team/roles", get(get_available_roles))
        .route(
            "/api/services/team/permissions",
            get(get_available_permissions),
        )
        // Statistiques
        .route("/api/services/{service_id}/team/stats", get(get_team_stats))
        .route("/api/user/services/team/stats", get(get_team_stats))
        // Invitations
        .route(
            "/api/services/team/invitations/{token}/accept",
            post(accept_invitation),
        )
        .route(
            "/api/services/team/invitations/{token}/reject",
            post(reject_invitation),
        )
        // Mes appartenances d'équipe (pour le HomeScreen)
        .route(
            "/api/user/my-team-memberships",
            get(get_my_team_memberships),
        )
        .with_state(state)
}
