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
            
            // ✅ Récupérer dynamiquement le pays de l'utilisateur depuis GPS
            let user_country = get_user_country(&state, user_id).await;
            if user_country.is_none() {
                warn!("[validate_partner] Impossible de déterminer le pays pour user_id={}, utilisation de NULL", user_id);
            }
            
            // Note: Les autres infos (phone, address, etc.) ne sont pas stockées dans users
            // Elles seront complétées lors de la configuration du service spécialisé
            let _partner_id = sqlx::query_scalar::<_, i32>(
                r#"
                INSERT INTO delivery_partners 
                (name, partner_type, contact_email, user_id, is_active, created_by, country)
                VALUES ($1, $2::delivery_partner_type, $3, $4, TRUE, $4, $5)
                ON CONFLICT (name, country) DO UPDATE 
                SET user_id = $4, is_active = TRUE
                RETURNING id
                "#
            )
            .bind(partner_name)
            .bind(partner_type)
            .bind(&partner_info.email)
            .bind(user_id)
            .bind(user_country.as_deref())
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

/// ✅ Récupère le pays de l'utilisateur depuis ses coordonnées GPS
async fn get_user_country(state: &AppState, user_id: i32) -> Option<String> {
    // Récupérer GPS utilisateur
    let user_gps: Option<String> = sqlx::query_scalar(
        "SELECT gps FROM users WHERE id = $1 AND gps IS NOT NULL AND gps != ''"
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten()?;

    // Parser coordonnées GPS (format: "lat,lng")
    if let Some(gps_str) = user_gps {
        if let Some((lat_str, lng_str)) = gps_str.split_once(',') {
        if let (Ok(lat), Ok(lng)) = (lat_str.trim().parse::<f64>(), lng_str.trim().parse::<f64>()) {
            // Utiliser le service de géocodage inverse
            let geocoding_service = GeocodingService::new();
            match geocoding_service.reverse_geocode(lat, lng).await {
                Ok(result) => {
                    return result.country;
                }
                Err(e) => {
                    warn!("[get_user_country] Erreur géocodage inverse pour user_id={}: {}", user_id, e);
                }
            }
        }
    }
    }

    None
}

