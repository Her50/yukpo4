// ✅ NOUVEAU 2026-02-25: Routes pour vérification de numéro de téléphone par OTP (SMS/WhatsApp)

use axum::{extract::State, middleware, response::Json, routing::post, Router};
use log::{error, info, warn};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::sync::Arc;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::{jwt_auth, AuthenticatedUser};
use crate::services::sms_service::{SmsResult, SmsService};
use crate::state::AppState;
use axum::extract::Extension;

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SendOtpRequest {
    pub phone: String,
    pub country_code: String, // "CM", "CI", "SN", "CD", "GA", "BF", etc.
}

#[derive(Serialize)]
pub struct SendOtpResponse {
    pub success: bool,
    pub message: String,
    pub phone_masked: String,
    pub expires_in_seconds: i64,
}

#[derive(Deserialize)]
pub struct VerifyOtpRequest {
    pub phone: String,
    pub code: String,
}

#[derive(Serialize)]
pub struct VerifyOtpResponse {
    pub success: bool,
    pub message: String,
    pub phone_verified: bool,
}

#[derive(Deserialize)]
pub struct SendOtpPublicRequest {
    pub phone: String,
    pub country_code: String,
    pub user_id: i32,
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn generate_otp_code() -> String {
    let mut rng = rand::thread_rng();
    let code: u32 = rng.gen_range(100000..999999);
    code.to_string()
}

fn normalize_phone(phone: &str, country_code: &str) -> String {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();

    let prefix = match country_code.to_uppercase().as_str() {
        "CM" => "237",
        "CI" => "225",
        "SN" => "221",
        "CD" => "243",
        "GA" => "241",
        "BF" => "226",
        "ML" => "223",
        "NE" => "227",
        "TG" => "228",
        "BJ" => "229",
        "GN" => "224",
        "TD" => "235",
        "CF" => "236",
        "CG" => "242",
        "GQ" => "240",
        "MG" => "261",
        "FR" => "33",
        "BE" => "32",
        "CH" => "41",
        "CA" => "1",
        _ => "237", // Cameroun par défaut
    };

    // Si le numéro commence déjà par le préfixe, ne pas le doubler
    if digits.starts_with(prefix) {
        format!("+{}", digits)
    } else if digits.starts_with('0') {
        // Retirer le 0 initial et ajouter le préfixe
        format!("+{}{}", prefix, &digits[1..])
    } else {
        format!("+{}{}", prefix, digits)
    }
}

fn mask_phone(phone: &str) -> String {
    if phone.len() <= 6 {
        return "***".to_string();
    }
    let start = &phone[..4];
    let end = &phone[phone.len() - 2..];
    format!("{}****{}", start, end)
}

// ── Envoi OTP (authentifié - pour utilisateurs connectés) ──────────────────

async fn send_otp_authenticated(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<SendOtpRequest>,
) -> AppResult<Json<SendOtpResponse>> {
    let user_id = user.id;
    send_otp_for_user(&state, user_id, &payload.phone, &payload.country_code).await
}

// ── Envoi OTP (public - juste après inscription, avec user_id) ─────────────

async fn send_otp_public(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SendOtpPublicRequest>,
) -> AppResult<Json<SendOtpResponse>> {
    send_otp_for_user(
        &state,
        payload.user_id,
        &payload.phone,
        &payload.country_code,
    )
    .await
}

// ── Logique commune d'envoi OTP ────────────────────────────────────────────

async fn send_otp_for_user(
    state: &Arc<AppState>,
    user_id: i32,
    phone: &str,
    country_code: &str,
) -> AppResult<Json<SendOtpResponse>> {
    let db = &state.pg;
    let normalized_phone = normalize_phone(phone, country_code);

    info!(
        "[send_otp] Envoi OTP pour user_id={}, phone={}",
        user_id,
        mask_phone(&normalized_phone)
    );

    // Vérifier le rate-limiting : max 3 OTP par heure par utilisateur
    #[derive(FromRow)]
    struct CountRow {
        count: Option<i64>,
    }
    let recent_count = sqlx::query_as::<_, CountRow>(
        r#"
        SELECT COUNT(*)::bigint as count FROM phone_verification_codes
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
        "#,
    )
    .bind(user_id)
    .fetch_one(db)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur DB rate-limit: {}", e)))?;

    if recent_count.count.unwrap_or(0) >= 3 {
        return Err(AppError::TooManyRequests(
            "Trop de tentatives. Réessayez dans 1 heure.".into(),
        ));
    }

    // Générer le code OTP
    let otp_code = generate_otp_code();
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(10);

    // Invalider les anciens codes pour cet utilisateur
    sqlx::query(
        "UPDATE phone_verification_codes SET is_used = TRUE WHERE user_id = $1 AND is_used = FALSE",
    )
    .bind(user_id)
    .execute(db)
    .await
    .ok();

    // Sauvegarder le code en DB
    sqlx::query(
        r#"
        INSERT INTO phone_verification_codes (user_id, phone, country_code, code, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(user_id)
    .bind(&normalized_phone)
    .bind(country_code)
    .bind(&otp_code)
    .bind(expires_at)
    .execute(db)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur sauvegarde OTP: {}", e)))?;

    // Mettre à jour le téléphone de l'utilisateur
    sqlx::query("UPDATE users SET phone = $1, phone_country = $2 WHERE id = $3")
        .bind(&normalized_phone)
        .bind(country_code)
        .bind(user_id)
        .execute(db)
        .await
        .ok();

    // ── Envoi du SMS/WhatsApp via Twilio ────────────────────────────────
    let send_result = send_otp_via_provider(&normalized_phone, &otp_code).await;

    match send_result {
        Ok(_) => {
            info!(
                "[send_otp] ✅ OTP envoyé avec succès à {}",
                mask_phone(&normalized_phone)
            );
        }
        Err(e) => {
            // Log mais ne pas bloquer — en dev/staging, on log le code
            warn!(
                "[send_otp] ⚠️ Échec envoi SMS (le code est en DB): {}. Code: {}",
                e, otp_code
            );
        }
    }

    Ok(Json(SendOtpResponse {
        success: true,
        message: "Code de vérification envoyé par SMS".to_string(),
        phone_masked: mask_phone(&normalized_phone),
        expires_in_seconds: 600, // 10 minutes
    }))
}

// ── Vérification OTP (authentifié) ─────────────────────────────────────────

async fn verify_otp_authenticated(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<VerifyOtpRequest>,
) -> AppResult<Json<VerifyOtpResponse>> {
    let user_id = user.id;
    verify_otp_for_user(&state, user_id, &payload.phone, &payload.code).await
}

// ── Vérification OTP (public) ──────────────────────────────────────────────

#[derive(Deserialize)]
pub struct VerifyOtpPublicRequest {
    pub phone: String,
    pub code: String,
    pub user_id: i32,
}

async fn verify_otp_public(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VerifyOtpPublicRequest>,
) -> AppResult<Json<VerifyOtpResponse>> {
    verify_otp_for_user(&state, payload.user_id, &payload.phone, &payload.code).await
}

// ── Logique commune de vérification OTP ────────────────────────────────────

async fn verify_otp_for_user(
    state: &Arc<AppState>,
    user_id: i32,
    phone: &str,
    code: &str,
) -> AppResult<Json<VerifyOtpResponse>> {
    let db = &state.pg;

    info!(
        "[verify_otp] Vérification OTP pour user_id={}, code={}***",
        user_id,
        &code[..2.min(code.len())]
    );

    // Validation du code (6 chiffres)
    if code.len() != 6 || !code.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest(
            "Le code doit contenir exactement 6 chiffres".into(),
        ));
    }

    // Chercher le code valide le plus récent
    #[derive(FromRow)]
    struct OtpRow {
        id: i32,
        code: String,
        attempts: i32,
    }
    let otp = sqlx::query_as::<_, OtpRow>(
        r#"
        SELECT id, code, attempts FROM phone_verification_codes
        WHERE user_id = $1 AND is_used = FALSE AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur DB vérification OTP: {}", e)))?;

    let otp = match otp {
        Some(o) => o,
        None => {
            return Err(AppError::BadRequest(
                "Code expiré ou invalide. Veuillez demander un nouveau code.".into(),
            ));
        }
    };

    // Vérifier le nombre de tentatives (max 5)
    if otp.attempts >= 5 {
        // Invalider le code
        sqlx::query("UPDATE phone_verification_codes SET is_used = TRUE WHERE id = $1")
            .bind(otp.id)
            .execute(db)
            .await
            .ok();
        return Err(AppError::TooManyRequests(
            "Trop de tentatives incorrectes. Veuillez demander un nouveau code.".into(),
        ));
    }

    // Incrémenter les tentatives
    sqlx::query("UPDATE phone_verification_codes SET attempts = attempts + 1 WHERE id = $1")
        .bind(otp.id)
        .execute(db)
        .await
        .ok();

    // Vérifier le code
    if otp.code != code {
        let remaining = 5 - otp.attempts - 1;
        return Err(AppError::BadRequest(format!(
            "Code incorrect. {} tentative(s) restante(s).",
            remaining.max(0)
        )));
    }

    // ✅ Code correct — marquer comme utilisé
    sqlx::query(
        "UPDATE phone_verification_codes SET is_used = TRUE, verified_at = NOW() WHERE id = $1",
    )
    .bind(otp.id)
    .execute(db)
    .await
    .ok();

    // ✅ Marquer le téléphone comme vérifié dans la table users
    sqlx::query("UPDATE users SET phone_verified = TRUE WHERE id = $1")
        .bind(user_id)
        .execute(db)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mise à jour phone_verified: {}", e)))?;

    info!(
        "[verify_otp] ✅ Téléphone vérifié avec succès pour user_id={}",
        user_id
    );

    Ok(Json(VerifyOtpResponse {
        success: true,
        message: "Numéro de téléphone vérifié avec succès !".to_string(),
        phone_verified: true,
    }))
}

// ── Envoi SMS/WhatsApp via SmsService (utilise le service existant) ─────────────

async fn send_otp_via_provider(phone: &str, code: &str) -> Result<(), String> {
    let sms_service = SmsService::new();

    // Vérifier si le service SMS est configuré
    if !sms_service.is_available() {
        warn!(
            "[send_otp] ⚠️ Service SMS non configuré. Le code OTP a été enregistré en base de données."
        );
        return Err(
            "Service SMS non configuré. Vérifiez SMS_ENABLED et les credentials Twilio."
                .to_string(),
        );
    }

    let message_body = format!(
        "Yukpo - Votre code de vérification est : {}. Il expire dans 10 minutes. Ne partagez ce code avec personne.",
        code
    );

    // Utiliser SmsService pour envoyer le SMS
    match sms_service.send_sms(phone, &message_body).await {
        Ok(SmsResult {
            success: true,
            message_id,
            error: None,
        }) => {
            info!(
                "[send_otp] ✅ OTP envoyé via SMS à {} (Message ID: {:?})",
                mask_phone(phone),
                message_id
            );
            Ok(())
        }
        Ok(SmsResult {
            success: false,
            message_id,
            error: Some(error_msg),
        }) => {
            error!(
                "[send_otp] ❌ Échec envoi SMS à {} (Message ID: {:?}): {}",
                mask_phone(phone),
                message_id,
                error_msg
            );
            Err(format!("Échec envoi SMS: {}", error_msg))
        }
        Err(e) => {
            error!(
                "[send_otp] ❌ Erreur service SMS pour {}: {}",
                mask_phone(phone),
                e
            );
            Err(format!("Erreur service SMS: {}", e))
        }
    }
}

// ── Resend OTP ─────────────────────────────────────────────────────────────

async fn resend_otp_public(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SendOtpPublicRequest>,
) -> AppResult<Json<SendOtpResponse>> {
    send_otp_for_user(
        &state,
        payload.user_id,
        &payload.phone,
        &payload.country_code,
    )
    .await
}

// ── Routes ─────────────────────────────────────────────────────────────────

pub fn phone_verification_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Endpoints publics (juste après inscription, avec user_id dans le body)
        .route("/api/auth/send-otp", post(send_otp_public))
        .route("/api/auth/verify-otp", post(verify_otp_public))
        .route("/api/auth/resend-otp", post(resend_otp_public))
        // Endpoints authentifiés (pour changer de numéro plus tard)
        .route(
            "/api/phone/send-otp",
            post(send_otp_authenticated).layer(middleware::from_fn(jwt_auth)),
        )
        .route(
            "/api/phone/verify-otp",
            post(verify_otp_authenticated).layer(middleware::from_fn(jwt_auth)),
        )
        .with_state(state)
}
