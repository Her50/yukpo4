// Contrôleur pour la gestion d'équipe des services
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::{collections::HashMap, sync::Arc};
use uuid::Uuid;

use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceTeamMember {
    pub id: String,
    pub service_id: Option<i32>,
    pub user_id: i32,
    pub username: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub role: ServiceTeamRole,
    pub added_by: Option<i32>,
    pub added_by_username: Option<String>,
    pub added_at: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceTeamRole {
    pub id: String,
    pub name: String,
    pub description: String,
    pub level: i32,
    pub color: String,
    pub icon: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServicePermission {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceTeamInvitation {
    pub id: String,
    pub service_id: Option<i32>,
    pub email: String,
    pub role: ServiceTeamRole,
    pub invited_by: Option<i32>,
    pub invited_by_username: Option<String>,
    pub invited_at: String,
    pub expires_at: String,
    pub status: String,
    pub token: String,
    pub accepted_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InviteMemberRequest {
    pub service_id: Option<i32>,
    pub email: String,
    pub role: String,
    pub permissions: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMemberRequest {
    pub role: String,
    pub permissions: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct TeamStats {
    pub total_members: i64,
    pub pending_invitations: i64,
    pub active_services: i64,
}

/// Obtenir les membres d'équipe d'un service ou globalement
pub async fn get_team_members(
    Path(service_id): Path<Option<i32>>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;
    let query = if let Some(service_id) = service_id {
        sqlx::query!(
            r#"
            SELECT 
                stm.id,
                stm.service_id,
                stm.user_id,
                u.username,
                u.email,
                u.avatar_url,
                stm.role_id,
                str.name as role_name,
                str.description as role_description,
                str.level as role_level,
                str.color as role_color,
                str.icon as role_icon,
                stm.added_by,
                added_by_user.username as added_by_username,
                stm.added_at,
                stm.is_active
            FROM service_team_members stm
            JOIN users u ON stm.user_id = u.id
            JOIN service_team_roles str ON stm.role_id = str.id
            LEFT JOIN users added_by_user ON stm.added_by = added_by_user.id
            WHERE stm.service_id = $1 AND stm.is_active = TRUE
            ORDER BY str.level ASC, stm.added_at ASC
            "#,
            service_id
        )
    } else {
        sqlx::query!(
            r#"
            SELECT 
                stm.id,
                stm.service_id,
                stm.user_id,
                u.username,
                u.email,
                u.avatar_url,
                stm.role_id,
                str.name as role_name,
                str.description as role_description,
                str.level as role_level,
                str.color as role_color,
                str.icon as role_icon,
                stm.added_by,
                added_by_user.username as added_by_username,
                stm.added_at,
                stm.is_active
            FROM service_team_members stm
            JOIN users u ON stm.user_id = u.id
            JOIN service_team_roles str ON stm.role_id = str.id
            LEFT JOIN users added_by_user ON stm.added_by = added_by_user.id
            WHERE stm.is_active = TRUE
            ORDER BY str.level ASC, stm.added_at ASC
            "#
        )
    };

    let members = query
        .fetch_all(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let team_members: Vec<ServiceTeamMember> = members
        .into_iter()
        .map(|row| ServiceTeamMember {
            id: row.id.to_string(),
            service_id: row.service_id,
            user_id: row.user_id,
            username: row.username,
            email: row.email,
            avatar_url: row.avatar_url,
            role: ServiceTeamRole {
                id: row.role_id,
                name: row.role_name,
                description: row.role_description,
                level: row.role_level,
                color: row.role_color,
                icon: row.role_icon,
            },
            added_by: row.added_by,
            added_by_username: row.added_by_username,
            added_at: row.added_at.to_rfc3339(),
            is_active: row.is_active,
        })
        .collect();

    // Obtenir les invitations
    let invitations_query = if let Some(service_id) = service_id {
        sqlx::query!(
            r#"
            SELECT 
                sti.id,
                sti.service_id,
                sti.email,
                sti.role_id,
                str.name as role_name,
                str.description as role_description,
                str.level as role_level,
                str.color as role_color,
                str.icon as role_icon,
                sti.invited_by,
                u.username as invited_by_username,
                sti.invited_at,
                sti.expires_at,
                sti.status,
                sti.token,
                sti.accepted_at
            FROM service_team_invitations sti
            JOIN service_team_roles str ON sti.role_id = str.id
            LEFT JOIN users u ON sti.invited_by = u.id
            WHERE sti.service_id = $1 AND sti.status = 'pending'
            ORDER BY sti.invited_at DESC
            "#,
            service_id
        )
    } else {
        sqlx::query!(
            r#"
            SELECT 
                sti.id,
                sti.service_id,
                sti.email,
                sti.role_id,
                str.name as role_name,
                str.description as role_description,
                str.level as role_level,
                str.color as role_color,
                str.icon as role_icon,
                sti.invited_by,
                u.username as invited_by_username,
                sti.invited_at,
                sti.expires_at,
                sti.status,
                sti.token,
                sti.accepted_at
            FROM service_team_invitations sti
            JOIN service_team_roles str ON sti.role_id = str.id
            LEFT JOIN users u ON sti.invited_by = u.id
            WHERE sti.status = 'pending'
            ORDER BY sti.invited_at DESC
            "#
        )
    };

    let invitations = invitations_query
        .fetch_all(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let team_invitations: Vec<ServiceTeamInvitation> = invitations
        .into_iter()
        .map(|row| ServiceTeamInvitation {
            id: row.id.to_string(),
            service_id: row.service_id,
            email: row.email,
            role: ServiceTeamRole {
                id: row.role_id,
                name: row.role_name,
                description: row.role_description,
                level: row.role_level,
                color: row.role_color,
                icon: row.role_icon,
            },
            invited_by: row.invited_by,
            invited_by_username: row.invited_by_username,
            invited_at: row.invited_at.to_rfc3339(),
            expires_at: row.expires_at.to_rfc3339(),
            status: row.status,
            token: row.token,
            accepted_at: row.accepted_at.map(|t| t.to_rfc3339()),
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "data": {
            "members": team_members,
            "invitations": team_invitations
        }
    })))
}

/// Inviter un membre à rejoindre l'équipe
pub async fn invite_member(
    State(state): State<Arc<AppState>>,
    Json(request): Json<InviteMemberRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Générer un token d'invitation
    let invitation_token = Uuid::new_v4().to_string();

    // Vérifier si l'utilisateur existe
    let user = sqlx::query!(
        "SELECT id, username, email FROM users WHERE email = $1 OR username = $1",
        request.email
    )
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(user) = user {
        // L'utilisateur existe, l'ajouter directement à l'équipe
        let member_id = Uuid::new_v4();
        
        sqlx::query!(
            r#"
            INSERT INTO service_team_members (id, service_id, user_id, role_id, added_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (service_id, user_id) DO UPDATE SET
                role_id = EXCLUDED.role_id,
                is_active = TRUE
            "#,
            member_id,
            request.service_id,
            user.id,
            request.role,
            1 // TODO: Récupérer l'ID de l'utilisateur connecté
        )
        .execute(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        Ok(Json(serde_json::json!({
            "success": true,
            "message": "Membre ajouté à l'équipe avec succès",
            "data": {
                "member_id": member_id,
                "user_id": user.id,
                "username": user.username
            }
        })))
    } else {
        // L'utilisateur n'existe pas, créer une invitation
        let invitation_id = Uuid::new_v4();
        
        sqlx::query!(
            r#"
            INSERT INTO service_team_invitations (id, service_id, email, role_id, invited_by, token)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (service_id, email) DO UPDATE SET
                role_id = EXCLUDED.role_id,
                token = EXCLUDED.token,
                expires_at = NOW() + INTERVAL '7 days',
                status = 'pending'
            "#,
            invitation_id,
            request.service_id,
            request.email,
            request.role,
            1, // TODO: Récupérer l'ID de l'utilisateur connecté
            invitation_token
        )
        .execute(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        // TODO: Envoyer un email d'invitation

        Ok(Json(serde_json::json!({
            "success": true,
            "message": "Invitation envoyée avec succès",
            "data": {
                "invitation_id": invitation_id,
                "token": invitation_token
            }
        })))
    }
}

/// Mettre à jour le rôle d'un membre
pub async fn update_member_role(
    Path(member_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(request): Json<UpdateMemberRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let member_uuid = Uuid::parse_str(&member_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query!(
        r#"
        UPDATE service_team_members 
        SET role_id = $1
        WHERE id = $2
        "#,
        request.role,
        member_uuid
    )
    .execute(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Rôle mis à jour avec succès"
    })))
}

/// Retirer un membre de l'équipe
pub async fn remove_member(
    Path(member_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let member_uuid = Uuid::parse_str(&member_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query!(
        "UPDATE service_team_members SET is_active = FALSE WHERE id = $1",
        member_uuid
    )
    .execute(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Membre retiré de l'équipe avec succès"
    })))
}

/// Obtenir les rôles disponibles
pub async fn get_available_roles(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let roles = sqlx::query!(
        "SELECT id, name, description, level, color, icon FROM service_team_roles ORDER BY level ASC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let team_roles: Vec<ServiceTeamRole> = roles
        .into_iter()
        .map(|row| ServiceTeamRole {
            id: row.id,
            name: row.name,
            description: row.description,
            level: row.level,
            color: row.color,
            icon: row.icon,
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "data": team_roles
    })))
}

/// Obtenir les permissions disponibles
pub async fn get_available_permissions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let permissions = sqlx::query!(
        "SELECT id, name, description, category FROM service_permissions ORDER BY category, name"
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let team_permissions: Vec<ServicePermission> = permissions
        .into_iter()
        .map(|row| ServicePermission {
            id: row.id,
            name: row.name,
            description: row.description,
            category: row.category,
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "data": team_permissions
    })))
}

/// Obtenir les statistiques de l'équipe
pub async fn get_team_stats(
    Path(service_id): Path<Option<i32>>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let stats = if let Some(service_id) = service_id {
        sqlx::query!(
            r#"
            SELECT 
                (SELECT COUNT(*) FROM service_team_members WHERE service_id = $1 AND is_active = TRUE) as total_members,
                (SELECT COUNT(*) FROM service_team_invitations WHERE service_id = $1 AND status = 'pending') as pending_invitations,
                (SELECT COUNT(*) FROM services WHERE id = $1 AND is_active = TRUE) as active_services
            "#,
            service_id
        )
    } else {
        sqlx::query!(
            r#"
            SELECT 
                (SELECT COUNT(*) FROM service_team_members WHERE is_active = TRUE) as total_members,
                (SELECT COUNT(*) FROM service_team_invitations WHERE status = 'pending') as pending_invitations,
                (SELECT COUNT(*) FROM services WHERE is_active = TRUE) as active_services
            "#
        )
    };

    let stats_row = stats
        .fetch_one(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let team_stats = TeamStats {
        total_members: stats_row.total_members.unwrap_or(0),
        pending_invitations: stats_row.pending_invitations.unwrap_or(0),
        active_services: stats_row.active_services.unwrap_or(0),
    };

    Ok(Json(serde_json::json!({
        "success": true,
        "data": team_stats
    })))
}

/// Accepter une invitation
pub async fn accept_invitation(
    Path(token): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Vérifier l'invitation
    let invitation = sqlx::query!(
        r#"
        SELECT id, service_id, email, role_id, expires_at, status
        FROM service_team_invitations
        WHERE token = $1
        "#,
        token
    )
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let invitation = match invitation {
        Some(inv) => inv,
        None => return Ok(Json(serde_json::json!({
            "success": false,
            "message": "Invitation non trouvée"
        }))),
    };

    if invitation.status != "pending" {
        return Ok(Json(serde_json::json!({
            "success": false,
            "message": "Invitation déjà traitée"
        })));
    }

    if invitation.expires_at < chrono::Utc::now() {
        return Ok(Json(serde_json::json!({
            "success": false,
            "message": "Invitation expirée"
        })));
    }

    // TODO: Récupérer l'ID de l'utilisateur connecté
    let user_id = 1; // Placeholder

    // Ajouter l'utilisateur à l'équipe
    let member_id = Uuid::new_v4();
    
    sqlx::query!(
        r#"
        INSERT INTO service_team_members (id, service_id, user_id, role_id, added_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (service_id, user_id) DO UPDATE SET
            role_id = EXCLUDED.role_id,
            is_active = TRUE
        "#,
        member_id,
        invitation.service_id,
        user_id,
        invitation.role_id,
        user_id
    )
    .execute(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Marquer l'invitation comme acceptée
    sqlx::query!(
        r#"
        UPDATE service_team_invitations 
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = $1
        "#,
        invitation.id
    )
    .execute(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Invitation acceptée avec succès"
    })))
}
