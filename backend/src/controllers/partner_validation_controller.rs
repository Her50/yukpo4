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
    services::email_service::EmailService,
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
            // ✅ CORRIGÉ: Utiliser une valeur par défaut au lieu de NULL pour éviter les problèmes avec la contrainte UNIQUE
            // En PostgreSQL, NULL != NULL, donc l'ON CONFLICT ne fonctionne pas correctement avec NULL
            let country = user_country.unwrap_or_else(|| "Non spécifié".to_string());
            if user_country.is_none() {
                warn!("[validate_partner] Impossible de déterminer le pays pour user_id={}, utilisation de 'Non spécifié'", user_id);
            }
            
            // Note: Les autres infos (phone, address, etc.) ne sont pas stockées dans users
            // Elles seront complétées lors de la configuration du service spécialisé
            let partner_id_result = sqlx::query_scalar::<_, i32>(
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
            .bind(&country)
            .fetch_optional(&state.pg)
            .await?;
            
            if let Some(partner_id) = partner_id_result {
                log::info!("[validate_partner] ✅ Partenaire créé/mis à jour dans delivery_partners: id={}, country={}", partner_id, country);
            } else {
                warn!("[validate_partner] ⚠️ Échec création partenaire dans delivery_partners pour user_id={}", user_id);
            }
        }
        
        // ✅ NOUVEAU: Envoyer une notification à l'utilisateur pour l'informer de l'approbation
        let notification_data = serde_json::json!({
            "user_id": user_id,
            "partner_type": partner_info.partner_type,
            "status": "approved"
        });

        // Créer la notification en base de données
        if let Err(e) = crate::services::notification_service::create_notification(
            &state.pg,
            user_id,
            crate::services::notification_service::NotificationType::PartnerApplicationApproved,
            "✅ Inscription partenaire approuvée".to_string(),
            format!(
                "Félicitations {} ! Votre inscription en tant que partenaire a été approuvée. Vous pouvez maintenant accéder à votre espace partenaire et commencer à utiliser les fonctionnalités dédiées.",
                partner_info.nom_complet.as_ref().unwrap_or(&partner_info.email)
            ),
            Some(notification_data.clone()),
        ).await {
            warn!("[validate_partner] ⚠️ Impossible de créer la notification: {}", e);
        } else {
            log::info!("[validate_partner] ✅ Notification d'approbation créée");
        }

        // Envoyer une push notification
        if let Err(e) = crate::services::push_notification_service::send_push_notification(
            &state.pg,
            user_id,
            "✅ Inscription partenaire approuvée".to_string(),
            format!(
                "Félicitations {} ! Votre inscription en tant que partenaire a été approuvée. Vous pouvez maintenant accéder à votre espace partenaire.",
                partner_info.nom_complet.as_ref().unwrap_or(&partner_info.email)
            ),
            Some(notification_data.clone()),
            None,
        ).await {
            warn!("[validate_partner] ⚠️ Impossible d'envoyer la push notification: {}", e);
        } else {
            log::info!("[validate_partner] ✅ Push notification envoyée");
        }

        // ✅ NOUVEAU: Envoyer un email au partenaire
        let email_service = EmailService::new();
        if email_service.is_available() {
            let email_subject = "✅ Votre inscription partenaire a été approuvée - Yukpo";
            let email_body = format!(
                "Bonjour {},\n\n\
                Félicitations ! Votre inscription en tant que partenaire sur Yukpo a été approuvée par nos administrateurs.\n\n\
                Vous pouvez maintenant :\n\
                - Accéder à votre espace partenaire\n\
                - Configurer vos services spécialisés\n\
                - Commencer à utiliser les fonctionnalités dédiées aux partenaires\n\n\
                Connectez-vous à votre compte pour commencer.\n\n\
                Cordialement,\n\
                L'équipe Yukpo",
                partner_info.nom_complet.as_ref().unwrap_or(&partner_info.email)
            );

            match email_service.send_simple_email(
                &partner_info.email,
                email_subject,
                &email_body,
            ).await {
                Ok(result) => {
                    if result.success {
                        log::info!("[validate_partner] ✅ Email d'approbation envoyé à {}", partner_info.email);
                    } else {
                        warn!("[validate_partner] ⚠️ Échec envoi email: {:?}", result.error);
                    }
                }
                Err(e) => {
                    warn!("[validate_partner] ⚠️ Erreur envoi email: {}", e);
                }
            }
        } else {
            log::debug!("[validate_partner] Email service non disponible (non configuré)");
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
        
        // ✅ NOUVEAU: Envoyer une notification à l'utilisateur pour l'informer du rejet
        let rejection_message = if let Some(reason) = &payload.reason {
            format!(
                "Votre inscription en tant que partenaire a été rejetée. Raison : {}. Veuillez contacter le support pour plus d'informations.",
                reason
            )
        } else {
            format!(
                "Votre inscription en tant que partenaire a été rejetée. Veuillez contacter le support pour plus d'informations."
            )
        };

        let notification_data = serde_json::json!({
            "user_id": user_id,
            "partner_type": partner_info.partner_type,
            "status": "rejected",
            "rejection_reason": payload.reason
        });

        // Créer la notification en base de données
        if let Err(e) = crate::services::notification_service::create_notification(
            &state.pg,
            user_id,
            crate::services::notification_service::NotificationType::PartnerApplicationRejected,
            "❌ Inscription partenaire rejetée".to_string(),
            rejection_message.clone(),
            Some(notification_data.clone()),
        ).await {
            warn!("[validate_partner] ⚠️ Impossible de créer la notification: {}", e);
        } else {
            log::info!("[validate_partner] ✅ Notification de rejet créée");
        }

        // Envoyer une push notification
        if let Err(e) = crate::services::push_notification_service::send_push_notification(
            &state.pg,
            user_id,
            "❌ Inscription partenaire rejetée".to_string(),
            rejection_message.clone(),
            Some(notification_data.clone()),
            None,
        ).await {
            warn!("[validate_partner] ⚠️ Impossible d'envoyer la push notification: {}", e);
        } else {
            log::info!("[validate_partner] ✅ Push notification envoyée");
        }

        // ✅ NOUVEAU: Envoyer un email au partenaire
        let email_service = EmailService::new();
        if email_service.is_available() {
            let email_subject = "❌ Votre inscription partenaire - Yukpo";
            let email_body = format!(
                "Bonjour {},\n\n\
                Nous avons le regret de vous informer que votre inscription en tant que partenaire sur Yukpo a été rejetée.\n\n\
                {}\n\n\
                Si vous avez des questions ou souhaitez plus d'informations, n'hésitez pas à contacter notre support.\n\n\
                Cordialement,\n\
                L'équipe Yukpo",
                partner_info.nom_complet.as_ref().unwrap_or(&partner_info.email),
                rejection_message
            );

            match email_service.send_simple_email(
                &partner_info.email,
                email_subject,
                &email_body,
            ).await {
                Ok(result) => {
                    if result.success {
                        log::info!("[validate_partner] ✅ Email de rejet envoyé à {}", partner_info.email);
                    } else {
                        warn!("[validate_partner] ⚠️ Échec envoi email: {:?}", result.error);
                    }
                }
                Err(e) => {
                    warn!("[validate_partner] ⚠️ Erreur envoi email: {}", e);
                }
            }
        } else {
            log::debug!("[validate_partner] Email service non disponible (non configuré)");
        }
        
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

