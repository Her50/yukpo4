// Contrôleur pour la gestion d'équipe des services
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid; // ✅ Import nécessaire pour .try_get()

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

    let members = if let Some(sid) = service_id {
        sqlx::query(
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
        )
        .bind(sid)
        .fetch_all(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query(
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
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let team_members: Result<Vec<ServiceTeamMember>, StatusCode> = members
        .into_iter()
        .map(|row| {
            Ok(ServiceTeamMember {
                id: row
                    .try_get::<Uuid, _>("id")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .to_string(),
                service_id: row.try_get("service_id").ok(),
                user_id: row
                    .try_get("user_id")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                username: row
                    .try_get("username")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                email: row
                    .try_get("email")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                avatar_url: row.try_get("avatar_url").ok(),
                role: ServiceTeamRole {
                    id: row
                        .try_get("role_id")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                    name: row
                        .try_get("role_name")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                    description: row
                        .try_get("role_description")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                    level: row
                        .try_get("role_level")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                    color: row
                        .try_get("role_color")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                    icon: row
                        .try_get("role_icon")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                },
                added_by: row.try_get("added_by").ok(),
                added_by_username: row.try_get("added_by_username").ok(),
                added_at: row
                    .try_get::<chrono::DateTime<chrono::Utc>, _>("added_at")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .to_rfc3339(),
                is_active: row
                    .try_get("is_active")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
            })
        })
        .collect();

    let team_members = team_members?;

    // Obtenir les invitations
    let invitations = if let Some(sid) = service_id {
        sqlx::query(
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
        )
        .bind(sid)
        .fetch_all(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query(
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
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let team_invitations: Result<Vec<ServiceTeamInvitation>, StatusCode> = invitations
        .into_iter()
        .map(|row| {
            Ok(ServiceTeamInvitation {
                id: row
                    .try_get::<Uuid, _>("id")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .to_string(),
                service_id: row.try_get("service_id").ok(),
                email: row
                    .try_get("email")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                role: ServiceTeamRole {
                    id: row
                        .try_get("role_id")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                    name: row
                        .try_get("role_name")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                    description: row
                        .try_get("role_description")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                    level: row
                        .try_get("role_level")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                    color: row
                        .try_get("role_color")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                    icon: row
                        .try_get("role_icon")
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                },
                invited_by: row.try_get("invited_by").ok(),
                invited_by_username: row.try_get("invited_by_username").ok(),
                invited_at: row
                    .try_get::<chrono::DateTime<chrono::Utc>, _>("invited_at")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .to_rfc3339(),
                expires_at: row
                    .try_get::<chrono::DateTime<chrono::Utc>, _>("expires_at")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .to_rfc3339(),
                status: row
                    .try_get("status")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                token: row
                    .try_get("token")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                accepted_at: row
                    .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("accepted_at")
                    .ok()
                    .flatten()
                    .map(|t| t.to_rfc3339()),
            })
        })
        .collect();

    let team_invitations = team_invitations?;

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
    let user =
        sqlx::query("SELECT id, username, email FROM users WHERE email = $1 OR username = $1")
            .bind(&request.email)
            .fetch_optional(&state.pg)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(user) = user {
        // L'utilisateur existe, l'ajouter directement à l'équipe
        let member_id = Uuid::new_v4();
        let user_id = user
            .try_get::<i32, _>("id")
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let username = user
            .try_get::<String, _>("username")
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        sqlx::query(
            r#"
            INSERT INTO service_team_members (id, service_id, user_id, role_id, added_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (service_id, user_id) DO UPDATE SET
                role_id = EXCLUDED.role_id,
                is_active = TRUE
            "#,
        )
        .bind(member_id)
        .bind(request.service_id)
        .bind(user_id)
        .bind(&request.role)
        .bind(1) // TODO: Récupérer l'ID de l'utilisateur connecté
        .execute(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        Ok(Json(serde_json::json!({
            "success": true,
            "message": "Membre ajouté à l'équipe avec succès",
            "data": {
                "member_id": member_id,
                "user_id": user_id,
                "username": username
            }
        })))
    } else {
        // L'utilisateur n'existe pas, créer une invitation
        let invitation_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO service_team_invitations (id, service_id, email, role_id, invited_by, token)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (service_id, email) DO UPDATE SET
                role_id = EXCLUDED.role_id,
                token = EXCLUDED.token,
                expires_at = NOW() + INTERVAL '7 days',
                status = 'pending'
            "#,
        )
        .bind(invitation_id)
        .bind(request.service_id)
        .bind(&request.email)
        .bind(&request.role)
        .bind(1) // TODO: Récupérer l'ID de l'utilisateur connecté
        .bind(&invitation_token)
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
    let member_uuid = Uuid::parse_str(&member_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query(
        r#"
        UPDATE service_team_members 
        SET role_id = $1
        WHERE id = $2
        "#,
    )
    .bind(&request.role)
    .bind(member_uuid)
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
    let member_uuid = Uuid::parse_str(&member_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query("UPDATE service_team_members SET is_active = FALSE WHERE id = $1")
        .bind(member_uuid)
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
    let roles = sqlx::query(
        "SELECT id, name, description, level, color, icon FROM service_team_roles ORDER BY level ASC"
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let team_roles: Result<Vec<ServiceTeamRole>, StatusCode> = roles
        .into_iter()
        .map(|row| {
            Ok(ServiceTeamRole {
                id: row
                    .try_get("id")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                name: row
                    .try_get("name")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                description: row
                    .try_get("description")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                level: row
                    .try_get("level")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                color: row
                    .try_get("color")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                icon: row
                    .try_get("icon")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
            })
        })
        .collect();

    let team_roles = team_roles?;

    Ok(Json(serde_json::json!({
        "success": true,
        "data": team_roles
    })))
}

/// Obtenir les permissions disponibles
pub async fn get_available_permissions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let permissions = sqlx::query(
        "SELECT id, name, description, category FROM service_permissions ORDER BY category, name",
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let team_permissions: Result<Vec<ServicePermission>, StatusCode> = permissions
        .into_iter()
        .map(|row| {
            Ok(ServicePermission {
                id: row
                    .try_get("id")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                name: row
                    .try_get("name")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                description: row
                    .try_get("description")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                category: row
                    .try_get("category")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
            })
        })
        .collect();

    let team_permissions = team_permissions?;

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
    let stats_row = if let Some(sid) = service_id {
        sqlx::query(
            r#"
            SELECT 
                (SELECT COUNT(*) FROM service_team_members WHERE service_id = $1 AND is_active = TRUE) as total_members,
                (SELECT COUNT(*) FROM service_team_invitations WHERE service_id = $1 AND status = 'pending') as pending_invitations,
                (SELECT COUNT(*) FROM services WHERE id = $1 AND is_active = TRUE) as active_services
            "#
        )
        .bind(sid)
        .fetch_one(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query(
            r#"
            SELECT 
                (SELECT COUNT(*) FROM service_team_members WHERE is_active = TRUE) as total_members,
                (SELECT COUNT(*) FROM service_team_invitations WHERE status = 'pending') as pending_invitations,
                (SELECT COUNT(*) FROM services WHERE is_active = TRUE) as active_services
            "#
        )
        .fetch_one(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let team_stats = TeamStats {
        total_members: stats_row.try_get::<i64, _>("total_members").unwrap_or(0),
        pending_invitations: stats_row
            .try_get::<i64, _>("pending_invitations")
            .unwrap_or(0),
        active_services: stats_row.try_get::<i64, _>("active_services").unwrap_or(0),
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
    let invitation = sqlx::query(
        r#"
        SELECT id, service_id, email, role_id, expires_at, status
        FROM service_team_invitations
        WHERE token = $1
        "#,
    )
    .bind(&token)
    .fetch_optional(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let invitation = match invitation {
        Some(inv) => inv,
        None => {
            return Ok(Json(serde_json::json!({
                "success": false,
                "message": "Invitation non trouvée"
            })))
        }
    };

    let invitation_id = invitation
        .try_get::<Uuid, _>("id")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let service_id = invitation
        .try_get::<Option<i32>, _>("service_id")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let role_id = invitation
        .try_get::<String, _>("role_id")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let status = invitation
        .try_get::<String, _>("status")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let expires_at = invitation
        .try_get::<chrono::DateTime<chrono::Utc>, _>("expires_at")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if status != "pending" {
        return Ok(Json(serde_json::json!({
            "success": false,
            "message": "Invitation déjà traitée"
        })));
    }

    if expires_at < chrono::Utc::now() {
        return Ok(Json(serde_json::json!({
            "success": false,
            "message": "Invitation expirée"
        })));
    }

    // TODO: Récupérer l'ID de l'utilisateur connecté
    let user_id = 1; // Placeholder

    // Ajouter l'utilisateur à l'équipe
    let member_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO service_team_members (id, service_id, user_id, role_id, added_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (service_id, user_id) DO UPDATE SET
            role_id = EXCLUDED.role_id,
            is_active = TRUE
        "#,
    )
    .bind(member_id)
    .bind(service_id)
    .bind(user_id)
    .bind(&role_id)
    .bind(user_id)
    .execute(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Marquer l'invitation comme acceptée
    sqlx::query(
        r#"
        UPDATE service_team_invitations 
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(invitation_id)
    .execute(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Invitation acceptée avec succès"
    })))
}
