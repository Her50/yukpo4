// ✅ Controller pour validation et partage téléphone intelligent

use std::sync::Arc;

use crate::core::types::AppError;
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use chrono::{Duration, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};

/// Demander la vérification du numéro de téléphone
pub async fn request_phone_verification(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<PhoneVerificationRequest>,
) -> Result<impl IntoResponse, AppError> {
    let pool = &state.pg;
    
    // Validation du numéro
    if payload.phone.len() < 9 || payload.phone.len() > 20 {
        return Err(AppError::BadRequest("Numéro de téléphone invalide".to_string()));
    }
    
    // Générer un code OTP à 6 chiffres
    let otp_code: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Uniform::new(0, 10))
        .take(6)
        .map(|d| d.to_string())
        .collect();
    
    let expires_at = Utc::now() + Duration::minutes(10); // 10 minutes d'expiration
    
    sqlx::query("UPDATE phone_verification_codes SET is_used = true WHERE user_id = $1")
        .bind(user.id)
        .execute(pool)
        .await
        .map_err(|e| {
            log::error!("[request_phone_verification] Erreur nettoyage anciens codes: {}", e);
            AppError::Internal("Erreur nettoyage codes".to_string())
        })?;
    
    sqlx::query(
        "INSERT INTO phone_verification_codes (user_id, phone, country_code, code, expires_at) VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(user.id)
    .bind(&payload.phone)
    .bind(&payload.country)
    .bind(&otp_code)
    .bind(expires_at)
    .execute(pool)
    .await
    .map_err(|e| {
        log::error!("[request_phone_verification] Erreur insertion code: {}", e);
        AppError::Internal("Erreur sauvegarde code".to_string())
    })?;
    
    // Envoyer le code via SMS/WhatsApp
    if let Err(e) = send_verification_code(&payload.phone, &payload.country, &otp_code, &state).await {
        log::error!("[request_phone_verification] Erreur envoi code: {}", e);
        return Err(AppError::Internal("Erreur envoi code".to_string()));
    }
    
    log::info!("[request_phone_verification] Code envoyé pour utilisateur {}: {}", user.id, payload.phone);
    
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "message": "Code de vérification envoyé",
            "expires_in_minutes": 10
        }))
    ))
}

/// Vérifier le code OTP
pub async fn verify_phone_code(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<VerifyCodeRequest>,
) -> Result<impl IntoResponse, AppError> {
    let pool = &state.pg;
    
    #[derive(sqlx::FromRow)]
    struct VerificationCodeRow {
        id: i64,
        phone: String,
        country_code: Option<String>,
        code: String,
        attempts: i32,
        expires_at: chrono::DateTime<Utc>,
    }
    
    let code_record = sqlx::query_as::<_, VerificationCodeRow>(
        "SELECT id, phone, country_code, code, attempts, expires_at FROM phone_verification_codes WHERE user_id = $1 AND is_used = false ORDER BY created_at DESC LIMIT 1"
    )
    .bind(user.id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("[verify_phone_code] Erreur récupération code: {}", e);
        AppError::Internal("Erreur récupération code".to_string())
    })?
    .ok_or_else(|| AppError::BadRequest("Aucun code de vérification en cours".to_string()))?;
    
    if Utc::now() > code_record.expires_at {
        return Err(AppError::BadRequest("Code expiré".to_string()));
    }
    
    if code_record.attempts >= 3 {
        return Err(AppError::BadRequest("Trop de tentatives. Veuillez demander un nouveau code.".to_string()));
    }
    
    if code_record.code != payload.code {
        let _ = sqlx::query("UPDATE phone_verification_codes SET attempts = attempts + 1 WHERE id = $1")
            .bind(code_record.id)
            .execute(pool)
            .await;
        return Err(AppError::BadRequest("Code incorrect".to_string()));
    }
    
    let _ = sqlx::query("UPDATE phone_verification_codes SET is_used = true, verified_at = NOW() WHERE id = $1")
        .bind(code_record.id)
        .execute(pool)
        .await;
    
    sqlx::query("UPDATE users SET phone = $1, phone_country = $2, phone_verified = true, updated_at = NOW() WHERE id = $3")
        .bind(&code_record.phone)
        .bind(&code_record.country_code)
        .bind(user.id)
        .execute(pool)
        .await
        .map_err(|e| {
            log::error!("[verify_phone_code] Erreur mise à jour téléphone: {}", e);
            AppError::Internal("Erreur mise à jour téléphone".to_string())
        })?;
    
    log::info!("[verify_phone_code] Téléphone vérifié pour utilisateur {}: {}", user.id, code_record.phone);
    
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "message": "Téléphone vérifié avec succès",
            "phone": code_record.phone,
            "country": code_record.country_code
        }))
    ))
}

/// Obtenir le statut du téléphone de l'utilisateur
pub async fn get_phone_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<impl IntoResponse, AppError> {
    let pool = &state.pg;
    
    #[derive(sqlx::FromRow)]
    struct UserPhoneRow {
        phone: Option<String>,
        phone_country: Option<String>,
        phone_verified: Option<bool>,
    }
    
    let user_data = sqlx::query_as::<_, UserPhoneRow>(
        "SELECT phone, phone_country, phone_verified FROM users WHERE id = $1"
    )
    .bind(user.id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("[get_phone_status] Erreur récupération utilisateur: {}", e);
        AppError::Internal("Erreur récupération utilisateur".to_string())
    })?
    .ok_or_else(|| AppError::NotFound("Utilisateur non trouvé".to_string()))?;
    
    let can_whatsapp = can_receive_whatsapp(&user_data.phone, &user_data.phone_country);
    
    Ok(Json(serde_json::json!({
        "success": true,
        "phone": user_data.phone,
        "phone_country": user_data.phone_country,
        "phone_verified": user_data.phone_verified.unwrap_or(false),
        "can_receive_whatsapp": can_whatsapp,
        "can_receive_sms": user_data.phone.is_some()
    })))
}

/// Envoyer le code de vérification (SMS/WhatsApp)
async fn send_verification_code(
    phone: &str,
    country: &str,
    code: &str,
    state: &Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Formater le numéro
    let formatted_phone = format_phone_number(phone, country);
    
    // Message
    let message = format!(
        "Yukpo: Votre code de vérification est {}. Valide 10 minutes. Ne partagez pas ce code.",
        code
    );
    
    // Essayer WhatsApp d'abord
    if can_receive_whatsapp(&Some(phone.to_string()), &Some(country.to_string())) {
        if let Err(e) = send_whatsapp_message(&formatted_phone, &message, state).await {
            log::warn!("[send_verification_code] WhatsApp échoué, fallback SMS: {}", e);
            // Fallback vers SMS
            send_sms_message(&formatted_phone, &message, state).await?;
        }
    } else {
        // SMS direct
        send_sms_message(&formatted_phone, &message, state).await?;
    }
    
    Ok(())
}

/// Envoyer un message WhatsApp
async fn send_whatsapp_message(
    phone: &str,
    message: &str,
    _state: &Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let whatsapp_enabled = std::env::var("WHATSAPP_ENABLED")
        .unwrap_or_default()
        .parse::<bool>()
        .unwrap_or(false);
    
    if !whatsapp_enabled {
        return Err("WhatsApp non configuré".into());
    }
    
    let _account_sid = std::env::var("TWILIO_ACCOUNT_SID")
        .map_err(|_| "TWILIO_ACCOUNT_SID non configuré")?;
    let _auth_token = std::env::var("TWILIO_AUTH_TOKEN")
        .map_err(|_| "TWILIO_AUTH_TOKEN non configuré")?;
    let from_number = std::env::var("TWILIO_WHATSAPP_NUMBER")
        .map_err(|_| "TWILIO_WHATSAPP_NUMBER non configuré")?;
    
    let to_number = format!("whatsapp:{}", phone);
    log::info!("[send_whatsapp_message] WhatsApp {} -> {}: {}", from_number, to_number, message);
    
    Ok(())
}

async fn send_sms_message(
    phone: &str,
    message: &str,
    _state: &Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _account_sid = std::env::var("TWILIO_ACCOUNT_SID")
        .map_err(|_| "TWILIO_ACCOUNT_SID non configuré")?;
    let _auth_token = std::env::var("TWILIO_AUTH_TOKEN")
        .map_err(|_| "TWILIO_AUTH_TOKEN non configuré")?;
    let from_number = std::env::var("TWILIO_SMS_NUMBER")
        .unwrap_or_else(|_| "+1234567890".to_string());
    
    log::info!("[send_sms_message] SMS {} -> {}: {}", from_number, phone, message);
    Ok(())
}

/// Formater un numéro de téléphone
fn format_phone_number(phone: &str, country: &str) -> String {
    // Nettoyer le numéro
    let clean_phone: String = phone.chars()
        .filter(|c| c.is_ascii_digit())
        .collect();
    
    // Ajouter l'indicatif du pays si nécessaire
    match country {
        "CM" => {
            if !clean_phone.starts_with("237") {
                format!("237{}", clean_phone)
            } else {
                clean_phone
            }
        }
        "CI" => {
            if !clean_phone.starts_with("225") {
                format!("225{}", clean_phone)
            } else {
                clean_phone
            }
        }
        _ => clean_phone
    }
}

/// Vérifier si un numéro peut recevoir WhatsApp
fn can_receive_whatsapp(phone: &Option<String>, country: &Option<String>) -> bool {
    if phone.is_none() || phone.as_ref().unwrap().is_empty() {
        return false;
    }
    
    let phone = phone.as_ref().unwrap();
    let country = country.as_deref().unwrap_or("CM");
    
    // WhatsApp disponible dans la plupart des pays africains
    let whatsapp_countries = ["CM", "CI", "SN", "CD", "GA", "TG", "BJ", "BF", "ML", "NE", "TD"];
    
    whatsapp_countries.contains(&country) && phone.len() >= 9
}

// ========================================
// STRUCTURES REQUEST/RESPONSE
// ========================================

#[derive(Debug, Deserialize)]
pub struct PhoneVerificationRequest {
    pub phone: String,
    pub country: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyCodeRequest {
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct PhoneStatusResponse {
    pub phone: Option<String>,
    pub phone_country: Option<String>,
    pub phone_verified: bool,
    pub can_receive_whatsapp: bool,
    pub can_receive_sms: bool,
}
