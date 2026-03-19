// Contrôleur pour la gestion d'équipe des services
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::middlewares::jwt::AuthenticatedUser;
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
                COALESCE(u.nom_complet, CONCAT(u.prenom, ' ', u.nom), u.email) as username,
                u.email,
                u.avatar_url,
                stm.role_id,
                str.name as role_name,
                str.description as role_description,
                str.level as role_level,
                str.color as role_color,
                str.icon as role_icon,
                stm.added_by,
                COALESCE(added_by_user.nom_complet, CONCAT(added_by_user.prenom, ' ', added_by_user.nom), added_by_user.email) as added_by_username,
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
                COALESCE(u.nom_complet, CONCAT(u.prenom, ' ', u.nom), u.email) as username,
                u.email,
                u.avatar_url,
                stm.role_id,
                str.name as role_name,
                str.description as role_description,
                str.level as role_level,
                str.color as role_color,
                str.icon as role_icon,
                stm.added_by,
                COALESCE(added_by_user.nom_complet, CONCAT(added_by_user.prenom, ' ', added_by_user.nom), added_by_user.email) as added_by_username,
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
                id: row.get::<Uuid, _>("id").to_string(),
                service_id: row.get::<Option<_>, _>("service_id"),
                user_id: row.try_get("user_id").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                username: row.try_get("username").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                email: row.try_get("email").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                avatar_url: row.get::<Option<_>, _>("avatar_url"),
                role: ServiceTeamRole {
                    id: row.try_get("role_id").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
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
                added_by: row.get::<Option<_>, _>("added_by"),
                added_by_username: row.get::<Option<_>, _>("added_by_username"),
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
                COALESCE(u.nom_complet, CONCAT(u.prenom, ' ', u.nom), u.email) as invited_by_username,
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
                COALESCE(u.nom_complet, CONCAT(u.prenom, ' ', u.nom), u.email) as invited_by_username,
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
                id: row.get::<Uuid, _>("id").to_string(),
                service_id: row.get::<Option<_>, _>("service_id"),
                email: row.try_get("email").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                role: ServiceTeamRole {
                    id: row.try_get("role_id").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
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
                invited_by: row.get::<Option<_>, _>("invited_by"),
                invited_by_username: row.get::<Option<_>, _>("invited_by_username"),
                invited_at: row
                    .try_get::<chrono::DateTime<chrono::Utc>, _>("invited_at")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .to_rfc3339(),
                expires_at: row
                    .try_get::<chrono::DateTime<chrono::Utc>, _>("expires_at")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .to_rfc3339(),
                status: row.try_get("status").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                token: row.try_get("token").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
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
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(request): Json<InviteMemberRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // ✅ Vérifier que l'utilisateur connecté est propriétaire du service
    if let Some(sid) = request.service_id {
        let owner_id: Option<i32> =
            sqlx::query_scalar("SELECT user_id FROM services WHERE id = $1")
                .bind(sid)
                .fetch_optional(&state.pg)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                .flatten();
        if owner_id != Some(auth_user.id) {
            // Vérifier si l'utilisateur est admin de l'équipe (level <= 2)
            let is_admin: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM service_team_members stm JOIN service_team_roles str ON stm.role_id = str.id WHERE stm.service_id = $1 AND stm.user_id = $2 AND stm.is_active = TRUE AND str.level <= 2)"
            )
            .bind(sid)
            .bind(auth_user.id)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(false);
            if !is_admin {
                return Ok(Json(serde_json::json!({
                    "success": false,
                    "message": "Seul le propriétaire ou un administrateur peut inviter des membres"
                })));
            }
        }
    }

    let invitation_token = Uuid::new_v4().to_string();

    // Vérifier si l'utilisateur existe
    let target_user =
        sqlx::query("SELECT id, COALESCE(nom_complet, CONCAT(prenom, ' ', nom)) as username, email FROM users WHERE email = $1 OR nom_complet = $1 OR CONCAT(prenom, ' ', nom) = $1")
            .bind(&request.email)
            .fetch_optional(&state.pg)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(found_user) = target_user {
        let member_id = Uuid::new_v4();
        let target_user_id = found_user.get::<i32, _>("id");
        let username: String = found_user.get::<Option<String>, _>("username").unwrap_or_default();

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
        .bind(target_user_id)
        .bind(&request.role)
        .bind(auth_user.id)
        .execute(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        // ✅ Créer une notification pour l'utilisateur invité
        let service_name: String = if let Some(sid) = request.service_id {
            sqlx::query_scalar::<_, Option<serde_json::Value>>(
                "SELECT data FROM services WHERE id = $1",
            )
            .bind(sid)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten()
            .flatten()
            .and_then(|d| {
                d.get("titre_service").and_then(|t| {
                    t.get("valeur")
                        .and_then(|v| v.as_str().map(String::from))
                        .or_else(|| t.as_str().map(String::from))
                })
            })
            .unwrap_or_else(|| "un service".to_string())
        } else {
            "un service".to_string()
        };
        let _ = sqlx::query(
            "INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1, 'team_invitation', $2, $3, $4)"
        )
        .bind(target_user_id)
        .bind(format!("👥 Invitation à gérer {}", service_name))
        .bind(format!("Vous avez été ajouté(e) comme membre d'équipe pour gérer '{}' par un administrateur.", service_name))
        .bind(serde_json::json!({
            "service_id": request.service_id,
            "role": request.role,
            "invited_by": auth_user.id
        }))
        .execute(&state.pg)
        .await;

        Ok(Json(serde_json::json!({
            "success": true,
            "message": "Membre ajouté à l'équipe avec succès",
            "data": {
                "member_id": member_id,
                "user_id": target_user_id,
                "username": username
            }
        })))
    } else {
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
        .bind(auth_user.id)
        .bind(&invitation_token)
        .execute(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

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
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(request): Json<UpdateMemberRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let member_uuid = Uuid::parse_str(&member_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    // ✅ Vérifier que l'utilisateur connecté est propriétaire du service ou admin
    let member_service = sqlx::query("SELECT service_id FROM service_team_members WHERE id = $1")
        .bind(member_uuid)
        .fetch_optional(&state.pg)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(row) = member_service {
        let sid: Option<i32> = row.get("service_id");
        if let Some(service_id) = sid {
            let owner_id: Option<i32> =
                sqlx::query_scalar("SELECT user_id FROM services WHERE id = $1")
                    .bind(service_id)
                    .fetch_optional(&state.pg)
                    .await
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .flatten();
            if owner_id != Some(auth_user.id) {
                return Ok(Json(serde_json::json!({
                    "success": false,
                    "message": "Seul le propriétaire du service peut modifier les rôles"
                })));
            }
        }
    }

    // ✅ Empêcher d'attribuer le rôle 'owner' (level 0) à quelqu'un d'autre
    if request.role == "owner" {
        return Ok(Json(serde_json::json!({
            "success": false,
            "message": "Le rôle propriétaire ne peut pas être attribué manuellement"
        })));
    }

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
    Extension(auth_user): Extension<AuthenticatedUser>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let member_uuid = Uuid::parse_str(&member_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    // ✅ Vérifier que l'utilisateur connecté est propriétaire du service
    let member_row =
        sqlx::query("SELECT service_id, user_id FROM service_team_members WHERE id = $1")
            .bind(member_uuid)
            .fetch_optional(&state.pg)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(row) = &member_row {
        let sid: Option<i32> = row.get("service_id");
        let target_user_id: i32 = row.get("user_id");

        // Un membre peut se retirer lui-même
        if target_user_id != auth_user.id {
            // Sinon, seul le propriétaire peut retirer
            if let Some(service_id) = sid {
                let owner_id: Option<i32> =
                    sqlx::query_scalar("SELECT user_id FROM services WHERE id = $1")
                        .bind(service_id)
                        .fetch_optional(&state.pg)
                        .await
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                        .flatten();
                if owner_id != Some(auth_user.id) {
                    return Ok(Json(serde_json::json!({
                        "success": false,
                        "message": "Seul le propriétaire du service peut retirer des membres"
                    })));
                }
            }
        }
    }

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
                id: row.try_get("id").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                name: row.try_get("name").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                description: row
                    .try_get("description")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                level: row.try_get("level").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                color: row.try_get("color").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                icon: row.try_get("icon").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
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
                id: row.try_get("id").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                name: row.try_get("name").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                description: row
                    .try_get("description")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                category: row.try_get("category").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
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
        total_members: stats_row.get::<Option<i64>, _>("total_members").unwrap_or(0),
        pending_invitations: stats_row.get::<Option<i64>, _>("pending_invitations").unwrap_or(0),
        active_services: stats_row.get::<Option<i64>, _>("active_services").unwrap_or(0),
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
    Extension(auth_user): Extension<AuthenticatedUser>,
) -> Result<Json<serde_json::Value>, StatusCode> {
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

    let invitation_id = invitation.get::<Uuid, _>("id");
    let service_id = invitation
        .try_get::<Option<i32>, _>("service_id")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let role_id = invitation.get::<String, _>("role_id");
    let status = invitation.get::<String, _>("status");
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

    // ✅ CORRIGÉ: Utiliser l'utilisateur connecté au lieu du placeholder
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
    .bind(auth_user.id)
    .bind(&role_id)
    .bind(auth_user.id)
    .execute(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

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

/// ✅ NOUVEAU: Rejeter une invitation
pub async fn reject_invitation(
    Path(token): Path<String>,
    State(state): State<Arc<AppState>>,
    Extension(_auth_user): Extension<AuthenticatedUser>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let result = sqlx::query(
        "UPDATE service_team_invitations SET status = 'rejected' WHERE token = $1 AND status = 'pending'"
    )
    .bind(&token)
    .execute(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Ok(Json(serde_json::json!({
            "success": false,
            "message": "Invitation non trouvée ou déjà traitée"
        })));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Invitation rejetée"
    })))
}

/// ✅ NOUVEAU: Obtenir les services où l'utilisateur est membre d'équipe (pour afficher dans HomeScreen)
pub async fn get_my_team_memberships(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Récupérer les services où l'utilisateur est membre actif (mais PAS propriétaire)
    let memberships = sqlx::query(
        r#"
        SELECT 
            stm.id as membership_id,
            stm.service_id,
            stm.role_id,
            str.name as role_name,
            str.description as role_description,
            str.level as role_level,
            str.color as role_color,
            str.icon as role_icon,
            stm.added_at,
            s.category,
            s.data as service_data,
            s.user_id as owner_id,
            COALESCE(owner.nom_complet, CONCAT(owner.prenom, ' ', owner.nom), owner.email) as owner_name
        FROM service_team_members stm
        JOIN service_team_roles str ON stm.role_id = str.id
        JOIN services s ON stm.service_id = s.id
        JOIN users owner ON s.user_id = owner.id
        WHERE stm.user_id = $1 AND stm.is_active = TRUE AND s.user_id != $1
        ORDER BY stm.added_at DESC
        "#,
    )
    .bind(auth_user.id)
    .fetch_all(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<serde_json::Value> = memberships.iter().map(|row| {
        let service_data: Option<serde_json::Value> = row.get("service_data");
        let service_name = service_data.as_ref()
            .and_then(|d| d.get("titre_service").and_then(|t| t.get("valeur").and_then(|v| v.as_str()).or_else(|| t.as_str())))
            .unwrap_or("Service");
        let category: Option<String> = row.get("category");

        serde_json::json!({
            "membership_id": row.get::<Uuid, _>("membership_id").to_string(),
            "service_id": row.get::<Option<i32>, _>("service_id"),
            "service_name": service_name,
            "category": category,
            "role": {
                "id": row.get::<String, _>("role_id"),
                "name": row.get::<String, _>("role_name"),
                "description": row.get::<String, _>("role_description"),
                "level": row.get::<i32, _>("role_level"),
                "color": row.get::<String, _>("role_color"),
                "icon": row.get::<String, _>("role_icon")
            },
            "owner_id": row.get::<i32, _>("owner_id"),
            "owner_name": row.get::<Option<String>, _>("owner_name"),
            "added_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("added_at").ok().map(|t| t.to_rfc3339())
        })
    }).collect();

    // Récupérer aussi les invitations en attente pour cet utilisateur
    let pending_invitations = sqlx::query(
        r#"
        SELECT 
            sti.id, sti.service_id, sti.role_id, sti.token, sti.invited_at,
            str.name as role_name, str.color as role_color, str.icon as role_icon,
            s.data as service_data, s.category,
            COALESCE(inv_by.nom_complet, CONCAT(inv_by.prenom, ' ', inv_by.nom), inv_by.email) as invited_by_name
        FROM service_team_invitations sti
        JOIN service_team_roles str ON sti.role_id = str.id
        LEFT JOIN services s ON sti.service_id = s.id
        LEFT JOIN users inv_by ON sti.invited_by = inv_by.id
        JOIN users u ON u.email = sti.email OR u.nom_complet = sti.email
        WHERE u.id = $1 AND sti.status = 'pending' AND sti.expires_at > NOW()
        ORDER BY sti.invited_at DESC
        "#,
    )
    .bind(auth_user.id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let invitations: Vec<serde_json::Value> = pending_invitations.iter().map(|row| {
        let service_data: Option<serde_json::Value> = row.get("service_data");
        let service_name = service_data.as_ref()
            .and_then(|d| d.get("titre_service").and_then(|t| t.get("valeur").and_then(|v| v.as_str()).or_else(|| t.as_str())))
            .unwrap_or("Service");

        serde_json::json!({
            "id": row.get::<Uuid, _>("id").to_string(),
            "service_id": row.get::<Option<i32>, _>("service_id"),
            "service_name": service_name,
            "category": row.get::<Option<String>, _>("category"),
            "token": row.get::<String, _>("token"),
            "role_name": row.get::<String, _>("role_name"),
            "role_color": row.get::<String, _>("role_color"),
            "role_icon": row.get::<String, _>("role_icon"),
            "invited_by_name": row.get::<Option<String>, _>("invited_by_name"),
            "invited_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("invited_at").ok().map(|t| t.to_rfc3339())
        })
    }).collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "data": {
            "memberships": result,
            "pending_invitations": invitations,
            "total": result.len() + invitations.len()
        }
    })))
}
