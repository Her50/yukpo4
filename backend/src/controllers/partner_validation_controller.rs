use axum::{
    extract::{Path, State},
    response::Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::FromRow;
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    services::geocoding_service::GeocodingService,
    state::AppState,
};
use log::warn;

#[derive(Debug, Serialize, FromRow)]
pub struct PendingPartner {
    pub id: i32,
    pub email: String,
    pub nom_complet: Option<String>,
    pub partner_type: Option<String>,
    pub partner_status: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// GET /api/admin/partners/pending - Lister les partenaires en attente
pub async fn list_pending_partners(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    if user.role != "admin" {
        return Err(AppError::Forbidden("Accès réservé aux administrateurs".into()));
    }
    
    let partners: Vec<PendingPartner> = sqlx::query_as(
        r#"
        SELECT id, email, nom_complet, partner_type, partner_status, created_at
        FROM users
        WHERE role = 'partenaire' AND (partner_status = 'pending' OR partner_status IS NULL)
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(&state.pg)
    .await?;
    
    Ok(Json(json!({
        "success": true,
        "partners": partners,
        "total": partners.len()
    })))
}

#[derive(Debug, Deserialize)]
pub struct ApproveRejectPartnerRequest {
    pub action: String, // "approve" ou "reject"
    pub reason: Option<String>, // Raison du rejet (optionnel)
}

/// POST /api/admin/partners/{user_id}/validate - Approuver ou rejeter un partenaire
pub async fn validate_partner(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(user_id): Path<i32>,
    Json(payload): Json<ApproveRejectPartnerRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if user.role != "admin" {
        return Err(AppError::Forbidden("Accès réservé aux administrateurs".into()));
    }
    
    let action = payload.action.as_str();
    if action != "approve" && action != "reject" {
        return Err(AppError::BadRequest("action doit être 'approve' ou 'reject'".into()));
    }
    
    // Récupérer les infos du partenaire
    #[derive(FromRow)]
    struct PartnerInfo {
        partner_type: Option<String>,
        email: String,
        nom_complet: Option<String>,
    }
    
    let partner_info: Option<PartnerInfo> = sqlx::query_as(
        r#"
        SELECT partner_type, email, nom_complet
        FROM users
        WHERE id = $1 AND role = 'partenaire'
        "#
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await?;
    
    let partner_info = partner_info.ok_or_else(|| {
        AppError::NotFound("Partenaire non trouvé".into())
    })?;
    
    if action == "approve" {
        // Mettre à jour le statut
        sqlx::query(
            "UPDATE users SET partner_status = 'approved' WHERE id = $1"
        )
        .bind(user_id)
        .execute(&state.pg)
        .await?;
        
        // ✅ CRÉER AUTOMATIQUEMENT l'entrée dans delivery_partners
        if let Some(ref partner_type) = partner_info.partner_type {
            let partner_name = partner_info.nom_complet
                .as_ref()
                .map(|s| s.as_str())
                .unwrap_or(&partner_info.email);
            
            // Note: Les autres infos (phone, address, etc.) ne sont pas stockées dans users
            // Elles seront complétées lors de la configuration du service spécialisé
            let _partner_id = sqlx::query_scalar::<_, i32>(
                r#"
                INSERT INTO delivery_partners 
                (name, partner_type, contact_email, user_id, is_active, created_by, country)
                VALUES ($1, $2::delivery_partner_type, $3, $4, TRUE, $4, 'Cameroun')
                ON CONFLICT (name, country) DO UPDATE 
                SET user_id = $4, is_active = TRUE
                RETURNING id
                "#
            )
            .bind(partner_name)
            .bind(partner_type)
            .bind(&partner_info.email)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await?;
        }
        
        Ok(Json(json!({
            "success": true,
            "message": "Partenaire approuvé avec succès"
        })))
    } else {
        // Rejeter
        sqlx::query(
            "UPDATE users SET partner_status = 'rejected' WHERE id = $1"
        )
        .bind(user_id)
        .execute(&state.pg)
        .await?;
        
        Ok(Json(json!({
            "success": true,
            "message": "Partenaire rejeté"
        })))
    }
}

