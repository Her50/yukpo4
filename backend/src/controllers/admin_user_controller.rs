// Contrôleur pour la gestion des utilisateurs par les administrateurs
use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::sync::Arc;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use crate::utils::role_helpers::ensure_admin_role_str;

#[derive(Deserialize)]
pub struct ListUsersQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub role: Option<String>,
    pub search: Option<String>,
}

#[derive(Serialize, FromRow)]
pub struct UserListItem {
    pub id: i32,
    pub email: String,
    pub role: String,
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub nom_complet: Option<String>,
    pub is_provider: bool,
    pub tokens_balance: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
pub struct ListUsersResponse {
    pub users: Vec<UserListItem>,
    pub total: i64,
    pub page: u32,
    pub limit: u32,
    pub total_pages: u32,
}

/// GET /api/admin/users - Liste tous les utilisateurs (admin seulement)
pub async fn list_users(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListUsersQuery>,
) -> AppResult<Json<ListUsersResponse>> {
    // Vérifier que l'utilisateur est admin
    let user_role: String = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[list_users] Erreur vérification rôle: {e:?}");
            AppError::Internal("Erreur vérification permissions".into())
        })?;

    // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
    ensure_admin_role_str(&user_role).map_err(|e| {
        warn!(
            "[list_users] Tentative d'accès non autorisée par user_id={}, role={}",
            user.id, user_role
        );
        e
    })?;

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);
    let offset = (page - 1) * limit;

    // Construire la requête selon les filtres
    let (count_sql, select_sql) = match (&query.role, &query.search) {
        (Some(_role), Some(_search)) if !_search.is_empty() => {
            let _search_pattern = format!("%{}%", _search);
            (
                "SELECT COUNT(*) FROM users WHERE role = $1 AND (email ILIKE $2 OR nom_complet ILIKE $2 OR nom ILIKE $2 OR prenom ILIKE $2)",
                "SELECT id, email, role, nom, prenom, nom_complet, is_provider, tokens_balance, created_at, updated_at FROM users WHERE role = $1 AND (email ILIKE $2 OR nom_complet ILIKE $2 OR nom ILIKE $2 OR prenom ILIKE $2) ORDER BY created_at DESC LIMIT $3 OFFSET $4",
            )
        }
        (Some(_role), _) => {
            (
                "SELECT COUNT(*) FROM users WHERE role = $1",
                "SELECT id, email, role, nom, prenom, nom_complet, is_provider, tokens_balance, created_at, updated_at FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            )
        }
        (_, Some(_search)) if !_search.is_empty() => {
            let _search_pattern = format!("%{}%", _search);
            (
                "SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR nom_complet ILIKE $1 OR nom ILIKE $1 OR prenom ILIKE $1",
                "SELECT id, email, role, nom, prenom, nom_complet, is_provider, tokens_balance, created_at, updated_at FROM users WHERE email ILIKE $1 OR nom_complet ILIKE $1 OR nom ILIKE $1 OR prenom ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            )
        }
        _ => {
            (
                "SELECT COUNT(*) FROM users",
                "SELECT id, email, role, nom, prenom, nom_complet, is_provider, tokens_balance, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            )
        }
    };

    // Compter le total
    let total: i64 = match (&query.role, &query.search) {
        (Some(role), Some(search)) if !search.is_empty() => {
            let search_pattern = format!("%{}%", search);
            sqlx::query_scalar(count_sql)
                .bind(role)
                .bind(&search_pattern)
                .fetch_one(&state.pg)
                .await
        }
        (Some(role), _) => sqlx::query_scalar(count_sql).bind(role).fetch_one(&state.pg).await,
        (_, Some(search)) if !search.is_empty() => {
            let search_pattern = format!("%{}%", search);
            sqlx::query_scalar(count_sql).bind(&search_pattern).fetch_one(&state.pg).await
        }
        _ => sqlx::query_scalar(count_sql).fetch_one(&state.pg).await,
    }
    .map_err(|e| {
        error!("[list_users] Erreur comptage: {e:?}");
        AppError::Internal("Erreur comptage utilisateurs".into())
    })?;

    // Récupérer les utilisateurs avec pagination
    let users: Vec<UserListItem> = match (&query.role, &query.search) {
        (Some(role), Some(search)) if !search.is_empty() => {
            let search_pattern = format!("%{}%", search);
            sqlx::query_as(select_sql)
                .bind(role)
                .bind(&search_pattern)
                .bind(limit as i64)
                .bind(offset as i64)
                .fetch_all(&state.pg)
                .await
        }
        (Some(role), _) => {
            sqlx::query_as(select_sql)
                .bind(role)
                .bind(limit as i64)
                .bind(offset as i64)
                .fetch_all(&state.pg)
                .await
        }
        (_, Some(search)) if !search.is_empty() => {
            let search_pattern = format!("%{}%", search);
            sqlx::query_as(select_sql)
                .bind(&search_pattern)
                .bind(limit as i64)
                .bind(offset as i64)
                .fetch_all(&state.pg)
                .await
        }
        _ => {
            sqlx::query_as(select_sql)
                .bind(limit as i64)
                .bind(offset as i64)
                .fetch_all(&state.pg)
                .await
        }
    }
    .map_err(|e| {
        error!("[list_users] Erreur récupération utilisateurs: {e:?}");
        AppError::Internal("Erreur récupération utilisateurs".into())
    })?;

    let total_pages = (total as f64 / limit as f64).ceil() as u32;

    info!(
        "[list_users] ✅ Récupération de {} utilisateurs (page {}/{})",
        users.len(),
        page,
        total_pages
    );

    Ok(Json(ListUsersResponse {
        users,
        total,
        page,
        limit,
        total_pages,
    }))
}

#[derive(Deserialize)]
pub struct UpdateUserRoleRequest {
    pub role: String,
}

#[derive(Serialize)]
pub struct UpdateUserRoleResponse {
    pub success: bool,
    pub message: String,
    pub user: UserListItem,
}

/// PATCH /api/admin/users/{user_id}/role - Met à jour le rôle d'un utilisateur (admin seulement)
pub async fn update_user_role(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<i32>,
    Json(request): Json<UpdateUserRoleRequest>,
) -> AppResult<Json<UpdateUserRoleResponse>> {
    // Vérifier que l'utilisateur est admin
    let user_role: String = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[update_user_role] Erreur vérification rôle: {e:?}");
            AppError::Internal("Erreur vérification permissions".into())
        })?;

    // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
    ensure_admin_role_str(&user_role).map_err(|e| {
        warn!(
            "[update_user_role] Tentative d'accès non autorisée par user_id={}, role={}",
            user.id, user_role
        );
        e
    })?;

    // Valider le rôle
    let valid_roles = vec!["user", "admin", "client", "prestataire"];
    if !valid_roles.contains(&request.role.as_str()) {
        return Err(AppError::BadRequest(
            format!("Rôle invalide. Rôles autorisés: {}", valid_roles.join(", ")).into(),
        ));
    }

    // Vérifier que l'utilisateur existe
    let user_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)")
        .bind(user_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[update_user_role] Erreur vérification utilisateur: {e:?}");
            AppError::Internal("Erreur vérification utilisateur".into())
        })?;

    if !user_exists {
        return Err(AppError::NotFound("Utilisateur non trouvé".into()));
    }

    // Mettre à jour le rôle
    sqlx::query("UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2")
        .bind(&request.role)
        .bind(user_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[update_user_role] Erreur mise à jour rôle: {e:?}");
            AppError::Internal("Erreur mise à jour rôle".into())
        })?;

    // Récupérer l'utilisateur mis à jour
    let updated_user: UserListItem = sqlx::query_as(
        "SELECT id, email, role, nom, prenom, nom_complet, is_provider, tokens_balance, created_at, updated_at FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[update_user_role] Erreur récupération utilisateur: {e:?}");
        AppError::Internal("Erreur récupération utilisateur".into())
    })?;

    info!(
        "[update_user_role] ✅ Rôle mis à jour: user_id={}, nouveau_role={}",
        user_id, request.role
    );

    Ok(Json(UpdateUserRoleResponse {
        success: true,
        message: format!("Rôle mis à jour avec succès: {}", request.role),
        user: updated_user,
    }))
}
