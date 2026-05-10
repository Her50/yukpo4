// ✅ Contrôleur Équipe Établissement
// Date : 2026-05-10
//
// Permet au responsable d'un établissement d'inviter des membres pour gérer la
// page (rôle manager, editor ou viewer). Pattern calqué sur l'équipe Librairie
// (libraire_team_invitations) — token UUID + lien WhatsApp partageable.
//
// Endpoints :
//   POST /api/v2/admin/etablissement/{id}/team/invitations    (create)
//   GET  /api/v2/admin/etablissement/{id}/team/invitations    (list)
//
// La page publique d'acceptation est mutualisée : preview_invitation et
// accept_team_invitation (etablissement_pages_controller) cherchent dans les
// deux tables et orientent ensuite l'utilisateur vers le bon dashboard.

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

// Rôles autorisés pour les membres d'équipe d'un établissement.
const ALLOWED_ROLES: [&str; 3] = ["manager", "editor", "viewer"];

async fn require_etab_admin(state: &AppState, user_id: i32, etab_id: i32) -> AppResult<()> {
    let ok: bool = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM etablissements_scolaires
            WHERE id = $1 AND (gerant_user_id = $2 OR user_id = $2)
        )
        "#,
    )
    .bind(etab_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("require_etab_admin: {}", e)))?;
    if !ok {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas administrateur de cet établissement".into(),
        ));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct CreateTeamInvitationPayload {
    pub role: String,
    pub telephone: Option<String>,
    pub nom_affiche: Option<String>,
}

/// POST /api/v2/admin/etablissement/{id}/team/invitations
pub async fn create_invitation(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateTeamInvitationPayload>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    let role = payload.role.trim().to_lowercase();
    if !ALLOWED_ROLES.contains(&role.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Rôle invalide: '{}'. Attendu: {:?}",
            role, ALLOWED_ROLES
        )));
    }

    let token = uuid::Uuid::new_v4().to_string();
    let invitation_id: i32 = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO etablissement_team_invitations
            (etablissement_id, invitation_token, role, telephone, nom_affiche, invited_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
    )
    .bind(etab_id)
    .bind(&token)
    .bind(&role)
    .bind(payload.telephone.as_deref())
    .bind(payload.nom_affiche.as_deref())
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("create_invitation: {}", e)))?;

    let etab_nom: String = sqlx::query_scalar::<_, String>(
        "SELECT nom_etablissement FROM etablissements_scolaires WHERE id = $1",
    )
    .bind(etab_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("create_invitation: nom: {}", e)))?;

    let role_label = match role.as_str() {
        "manager" => "Gestionnaire",
        "editor" => "Éditeur de contenu",
        "viewer" => "Consultation",
        _ => role.as_str(),
    };
    let invitation_path = format!("/team/accept?token={}", token);
    let whatsapp_msg = format!(
        "Bonjour ! Vous êtes invité(e) à rejoindre l'équipe de {} sur Yukpo en tant que {}. \
         Cliquez ici pour accepter : https://bourse.yukpomnang.com{}",
        etab_nom, role_label, invitation_path
    );
    let phone_clean = payload.telephone.unwrap_or_default().replace(['+', ' '], "");
    let whatsapp_url = format!(
        "https://wa.me/{}?text={}",
        phone_clean,
        whatsapp_msg
            .chars()
            .map(|c| match c {
                ' ' => "%20".to_string(),
                c if c.is_ascii_alphanumeric() || ":/?=&._-".contains(c) => c.to_string(),
                c => format!("%{:02X}", c as u32),
            })
            .collect::<String>()
    );

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "invitation_id": invitation_id,
            "token": token,
            "invitation_path": invitation_path,
            "whatsapp_url": whatsapp_url,
            "whatsapp_message": whatsapp_msg,
        })),
    ))
}

/// GET /api/v2/admin/etablissement/{id}/team/invitations
pub async fn list_invitations(
    State(state): State<Arc<AppState>>,
    Path(etab_id): Path<i32>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    require_etab_admin(&state, user_id, etab_id).await?;

    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT i.id, i.invitation_token, i.role, i.telephone, i.nom_affiche,
               i.opened_at, i.accepted_at, i.accepted_user_id, i.expires_at, i.created_at,
               u.email AS accepted_email
        FROM etablissement_team_invitations i
        LEFT JOIN users u ON u.id = i.accepted_user_id
        WHERE i.etablissement_id = $1
        ORDER BY i.created_at DESC
        LIMIT 100
        "#,
    )
    .bind(etab_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("list_invitations: {}", e)))?;

    let invitations: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let token: String = r.try_get("invitation_token").unwrap_or_default();
            let opened: Option<chrono::DateTime<chrono::Utc>> =
                r.try_get("opened_at").ok().flatten();
            let accepted: Option<chrono::DateTime<chrono::Utc>> =
                r.try_get("accepted_at").ok().flatten();
            let status = if accepted.is_some() {
                "accepted"
            } else if opened.is_some() {
                "opened"
            } else {
                "pending"
            };
            json!({
                "id": r.try_get::<i32, _>("id").unwrap_or(0),
                "token": &token,
                "invitation_path": format!("/team/accept?token={}", token),
                "role": r.try_get::<Option<String>, _>("role").unwrap_or(None),
                "telephone": r.try_get::<Option<String>, _>("telephone").unwrap_or(None),
                "nom_affiche": r.try_get::<Option<String>, _>("nom_affiche").unwrap_or(None),
                "status": status,
                "opened_at": opened.map(|t| t.to_rfc3339()),
                "accepted_at": accepted.map(|t| t.to_rfc3339()),
                "accepted_email": r.try_get::<Option<String>, _>("accepted_email").unwrap_or(None),
                "expires_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("expires_at").ok().map(|t| t.to_rfc3339()),
                "created_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok().map(|t| t.to_rfc3339()),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "invitations": invitations })),
    ))
}
