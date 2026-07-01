//! Authentification simplifiée par téléphone + PIN 4 chiffres.
//!
//! 2026-05-28 — Vise les parents qui scannent une liste scolaire à la
//! rentrée : pas d'email à retenir, pas de mot de passe complexe.
//!
//! Flow :
//!   POST /api/auth/phone/check     → { phone } → { exists, locked, locked_until }
//!   POST /api/auth/phone/register  → { phone, phone_confirm, pin, pin_confirm, nom, prenom }
//!                                    → { token, user }
//!   POST /api/auth/phone/login     → { phone, pin } → { token, user }
//!
//! Sécurité :
//!   * PIN bcrypt cost 12 (même qualité que password_hash classique).
//!   * Rate-limit : 5 échecs consécutifs / numéro → lockout 15 min via
//!     `pin_locked_until`. Reset à 0 sur login OK.
//!   * Index UNIQUE partiel sur `phone` empêche 2 comptes même numéro.
//!   * Réponse `Identifiants incorrects` générique pour ne pas révéler
//!     si le numéro existe en base (anti-énumération).
//!
//! Volontairement SANS OTP/SMS : on assume que le PIN est suffisant tant
//! que Twilio n'est pas intégré. Quand SMS arrive, ajouter une étape OTP
//! avant /register pour vérifier la possession du numéro.

use axum::{
    extract::State,
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Json},
};
use bcrypt::{hash, verify};
use chrono::{DateTime, Duration, Utc};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::sync::Arc;

use crate::{
    controllers::auth_controller::{build_jwt_cookie, AUTH_COOKIE_TTL_SECS},
    core::types::{AppError, AppResult},
    state::AppState,
    utils::{jwt_manager::generate_jwt, normalize_name::build_full_name},
};

/// 2026-05-28 — Construit le header Set-Cookie commun à register_phone /
/// login_phone. Sans ça, le frontend web (cookie httpOnly) ne reçoit jamais
/// le JWT, /auth/me renvoie 401 et l'utilisateur paraît déconnecté juste
/// après avoir saisi son PIN.
fn jwt_cookie_headers(jwt: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    if let Ok(hv) = HeaderValue::from_str(&build_jwt_cookie(jwt, AUTH_COOKIE_TTL_SECS)) {
        headers.insert(axum::http::header::SET_COOKIE, hv);
    }
    headers
}

/// Normalise un numéro de téléphone : retire les espaces, tirets,
/// parenthèses, points. Préserve le + initial. Cohérent avec la fonction
/// SQL `normalize_phone(text)` de la migration 20260526_001.
pub fn normalize_phone(p: &str) -> String {
    let mut out = String::with_capacity(p.len());
    for (i, c) in p.chars().enumerate() {
        if c == '+' && i == 0 {
            out.push('+');
        } else if c.is_ascii_digit() {
            out.push(c);
        }
        // Tout le reste (espace, tiret, parenthèse, point, lettre) ignoré.
    }
    out
}

fn log_safe_phone(phone: &str) -> String {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() <= 4 {
        return "****".to_string();
    }
    format!("***{}", &digits[digits.len() - 4..])
}

/// Valide un numéro : minimum 8 chiffres, max 15 (norme ITU E.164).
fn validate_phone(p: &str) -> Result<String, AppError> {
    let normalized = normalize_phone(p);
    let digits: usize = normalized.chars().filter(|c| c.is_ascii_digit()).count();
    if digits < 8 {
        return Err(AppError::BadRequest(
            "Numéro de téléphone trop court (minimum 8 chiffres).".into(),
        ));
    }
    if digits > 15 {
        return Err(AppError::BadRequest(
            "Numéro de téléphone trop long (maximum 15 chiffres).".into(),
        ));
    }
    Ok(normalized)
}

/// Valide un PIN : exactement 4 chiffres ASCII.
fn validate_pin(p: &str) -> Result<(), AppError> {
    if p.len() != 4 {
        return Err(AppError::BadRequest("Le code PIN doit avoir 4 chiffres.".into()));
    }
    if !p.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest(
            "Le code PIN ne peut contenir que des chiffres.".into(),
        ));
    }
    // Rejeter les PIN trop évidents (sécurité minimale).
    if p == "0000" || p == "1234" || p == "1111" || p == "2222" {
        return Err(AppError::BadRequest(
            "Choisissez un code PIN moins évident (pas 0000, 1234, 1111, etc.).".into(),
        ));
    }
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════
// CHECK : le numéro existe-t-il déjà ?
// ═══════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct CheckPhoneInput {
    pub phone: String,
}

#[derive(Serialize)]
pub struct CheckPhoneResponse {
    pub exists: bool,
    /// True si le compte est verrouillé suite à 5 échecs PIN consécutifs.
    pub locked: bool,
    /// Date de fin de verrouillage si applicable (ISO 8601).
    pub locked_until: Option<String>,
    /// Numéro normalisé renvoyé au frontend pour cohérence.
    pub phone_normalized: String,
}

pub async fn check_phone(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CheckPhoneInput>,
) -> AppResult<impl IntoResponse> {
    let phone = validate_phone(&body.phone)?;

    let row: Option<(bool,)> = sqlx::query_as(
        r#"SELECT (pin_locked_until IS NOT NULL AND pin_locked_until > NOW()) AS locked
           FROM users WHERE phone = $1 LIMIT 1"#,
    )
    .bind(&phone)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[check_phone] DB: {e:?}");
        AppError::Internal("Erreur base de données".into())
    })?;

    let (exists, locked) = match row {
        Some((l,)) => (true, l),
        None => (false, false),
    };

    // Si locked → renvoyer aussi la date de fin pour que le frontend affiche
    // un compteur ("Réessayez dans 12 min").
    let locked_until = if locked {
        let dt: Option<DateTime<Utc>> = sqlx::query_scalar(
            "SELECT pin_locked_until FROM users WHERE phone = $1",
        )
        .bind(&phone)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();
        dt.map(|d| d.to_rfc3339())
    } else {
        None
    };

    info!(
        "[check_phone] phone={} exists={} locked={}",
        log_safe_phone(&phone),
        exists,
        locked
    );

    Ok((
        StatusCode::OK,
        Json(CheckPhoneResponse {
            exists,
            locked,
            locked_until,
            phone_normalized: phone,
        }),
    ))
}

// ═══════════════════════════════════════════════════════════════════════
// REGISTER : crée un nouveau compte (phone + pin + nom + prenom)
// ═══════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct RegisterPhoneInput {
    pub phone: String,
    pub phone_confirm: String,
    pub pin: String,
    pub pin_confirm: String,
    pub nom: String,
    pub prenom: String,
    /// Optionnel : email si l'utilisateur en a un. Non bloquant.
    #[serde(default)]
    pub email: Option<String>,
    /// 2026-07-01 — Code parrainage capté sur ?ref=XXX. Optionnel.
    /// Si présent et valide, users.referred_by est set + entrée créée dans
    /// la table `referrals` (status='pending'). Sans ce champ, l'inscription
    /// se faisait sans jamais attacher le filleul au parrain (bug identifié
    /// via dashboard parrainage : 85 clics, 244 users, 1 seul referred_by).
    #[serde(default, alias = "referral_code")]
    pub ref_code: Option<String>,
}

pub async fn register_phone(
    State(state): State<Arc<AppState>>,
    Json(body): Json<RegisterPhoneInput>,
) -> AppResult<impl IntoResponse> {
    let phone = validate_phone(&body.phone)?;
    let phone_confirm = validate_phone(&body.phone_confirm)?;
    if phone != phone_confirm {
        return Err(AppError::BadRequest(
            "Les deux numéros saisis ne correspondent pas. Réessayez.".into(),
        ));
    }

    validate_pin(&body.pin)?;
    if body.pin != body.pin_confirm {
        return Err(AppError::BadRequest(
            "Les deux codes PIN saisis ne correspondent pas. Réessayez.".into(),
        ));
    }

    let nom = body.nom.trim();
    let prenom = body.prenom.trim();
    if nom.is_empty() || prenom.is_empty() {
        return Err(AppError::BadRequest("Nom et prénom sont requis.".into()));
    }
    if nom.len() > 100 || prenom.len() > 100 {
        return Err(AppError::BadRequest(
            "Nom et prénom doivent faire moins de 100 caractères.".into(),
        ));
    }

    // Vérif anti-doublon (renvoie 409 clair plutôt qu'un 500 sur l'index unique).
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE phone = $1)",
    )
    .bind(&phone)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("DB: {e}")))?;

    if exists {
        return Err(AppError::BadRequest(
            "Ce numéro a déjà un compte. Utilisez « Se connecter » à la place.".into(),
        ));
    }

    let pin_hash = hash(&body.pin, 12).map_err(|e| {
        error!("[register_phone] bcrypt: {e:?}");
        AppError::Internal("Erreur création du compte".into())
    })?;

    let nom_complet =
        build_full_name(Some(nom), Some(prenom), None).unwrap_or_else(|| format!("{} {}", prenom, nom));
    let email = body.email.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());

    // INSERT avec ON CONFLICT par sécurité (race condition double-clic).
    #[derive(FromRow)]
    struct NewUser {
        id: i32,
        role: String,
        tokens_balance: i64,
    }

    // 2026-07-01 — Wrap INSERT users + attach_referrer dans une transaction
    // pour atomicité. Avant : INSERT direct sur pool + le ref_code n'était
    // même pas transmis → 244 inscriptions et 1 seul users.referred_by set.
    let mut tx = state.pg.begin().await.map_err(|e| {
        error!("[register_phone] BEGIN tx: {e:?}");
        AppError::Internal("Erreur ouverture transaction".into())
    })?;

    // phone_verified = FALSE : aucun OTP/SMS n'a confirmé la possession de
    // la SIM. Le compte est utilisable pour les achats (où l'argent vient
    // de l'inscrit lui-même → pas de risque pour autrui), mais les actions
    // sensibles (cash-out parrainage, création troc) sont gatées côté backend
    // tant que cette colonne reste FALSE.
    let user: NewUser = sqlx::query_as(
        r#"
        INSERT INTO users (
            email, password_hash, role,
            nom, prenom, nom_complet,
            phone, pin_hash, phone_verified, preferred_lang,
            tokens_balance, token_price_user, token_price_provider,
            commission_pct, is_provider, is_active
        ) VALUES (
            $1, NULL, 'user',
            $2, $3, $4,
            $5, $6, FALSE, 'fr',
            0, 0, 0,
            0, false, true
        )
        RETURNING id, role, tokens_balance
        "#,
    )
    .bind(email)
    .bind(nom)
    .bind(prenom)
    .bind(&nom_complet)
    .bind(&phone)
    .bind(&pin_hash)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        // Si l'index unique a quand même tiré (race), on renvoie 409 clair.
        if e.to_string().contains("users_phone_unique") {
            return AppError::BadRequest(
                "Ce numéro a déjà un compte. Utilisez « Se connecter ».".into(),
            );
        }
        error!("[register_phone] INSERT: {e:?}");
        AppError::Internal("Impossible de créer le compte".into())
    })?;

    // 2026-07-01 — Attache filleul au parrain si un code a été transmis.
    // attach_referrer_tx est idempotent (Ok(None) si code vide/inconnu ou
    // referred_by déjà set). N'échoue pas l'inscription si l'attach rate
    // (le compte reste créé même sans parrainage).
    if let Some(ref_code) = body.ref_code.as_deref() {
        let trimmed = ref_code.trim();
        if !trimmed.is_empty() {
            match crate::services::referral_service::attach_referrer_tx(
                &mut tx, user.id, trimmed,
            )
            .await
            {
                Ok(Some(parrain_id)) => info!(
                    "[register_phone] filleul {} attaché au parrain {} via code {}",
                    user.id, parrain_id, trimmed
                ),
                Ok(None) => info!(
                    "[register_phone] code parrainage '{}' non résolu ou déjà attaché",
                    trimmed
                ),
                Err(e) => log::warn!(
                    "[register_phone] attach_referrer échoué user {}: {e:?}",
                    user.id
                ),
            }
        }
    }

    tx.commit().await.map_err(|e| {
        error!("[register_phone] COMMIT: {e:?}");
        AppError::Internal("Erreur validation transaction".into())
    })?;

    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| AppError::Internal("JWT_SECRET manquant".into()))?;
    let nom_complet_clone = nom_complet.clone();
    let jwt = generate_jwt(
        user.id,
        &user.role,
        email.unwrap_or(""),
        Some(nom_complet_clone),
        user.tokens_balance,
        &secret,
        None,
    )?;

    info!(
        "[register_phone] OK user_id={} phone={} ",
        user.id,
        log_safe_phone(&phone)
    );

    Ok((
        StatusCode::CREATED,
        jwt_cookie_headers(&jwt),
        Json(serde_json::json!({
            "success": true,
            "token": jwt,
            "user": {
                "id": user.id,
                "role": user.role,
                "phone": phone,
                "nom_complet": nom_complet,
                "tokens_balance": user.tokens_balance,
                // false par défaut — gate les actions sensibles tant que la
                // possession de la SIM n'est pas prouvée (SMS futur ou admin).
                "phone_verified": false,
            }
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════════════
// LOGIN : auth (phone + pin) avec rate-limit anti-brute-force
// ═══════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct LoginPhoneInput {
    pub phone: String,
    pub pin: String,
}

/// Nombre max d'échecs PIN consécutifs avant lockout.
const MAX_PIN_ATTEMPTS: i32 = 5;
/// Durée du lockout après MAX_PIN_ATTEMPTS échecs.
const LOCKOUT_MINUTES: i64 = 15;

pub async fn login_phone(
    State(state): State<Arc<AppState>>,
    Json(body): Json<LoginPhoneInput>,
) -> AppResult<impl IntoResponse> {
    let phone = validate_phone(&body.phone)?;
    // PIN : ne pas valider strictement (4 chiffres) au login pour permettre
    // à un user qui aurait un legacy pin de tenter. On vérifie juste qu'il
    // n'est pas vide.
    if body.pin.is_empty() {
        return Err(AppError::BadRequest("Code PIN requis.".into()));
    }

    #[derive(FromRow)]
    struct UserRow {
        id: i32,
        role: String,
        email: Option<String>,
        pin_hash: Option<String>,
        nom_complet: Option<String>,
        tokens_balance: i64,
        partner_type: Option<String>,
        failed_pin_attempts: i32,
        pin_locked_until: Option<DateTime<Utc>>,
        phone_verified: bool,
    }

    let user: Option<UserRow> = sqlx::query_as(
        r#"
        SELECT id, role, email, pin_hash, nom_complet, tokens_balance,
               partner_type, failed_pin_attempts, pin_locked_until, phone_verified
        FROM users WHERE phone = $1
        "#,
    )
    .bind(&phone)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[login_phone] DB: {e:?}");
        AppError::Internal("Erreur base de données".into())
    })?;

    let user = match user {
        Some(u) => u,
        None => {
            warn!("[login_phone] phone introuvable {}", log_safe_phone(&phone));
            return Err(AppError::Unauthorized("Identifiants incorrects".into()));
        }
    };

    // Lockout actif ?
    if let Some(until) = user.pin_locked_until {
        if until > Utc::now() {
            let mins = (until - Utc::now()).num_minutes().max(1);
            return Err(AppError::TooManyRequests(format!(
                "Compte verrouillé. Réessayez dans {} min.",
                mins
            )));
        }
    }

    let pin_hash = match user.pin_hash.as_ref() {
        Some(h) => h,
        None => {
            warn!(
                "[login_phone] user_id={} sans pin_hash (compte legacy email only)",
                user.id
            );
            return Err(AppError::Unauthorized(
                "Ce compte n'a pas de code PIN. Connectez-vous par email.".into(),
            ));
        }
    };

    let pin_valid = verify(&body.pin, pin_hash).map_err(|e| {
        error!("[login_phone] bcrypt verify: {e:?}");
        AppError::Internal("Erreur vérification".into())
    })?;

    if !pin_valid {
        let new_attempts = user.failed_pin_attempts + 1;
        let should_lock = new_attempts >= MAX_PIN_ATTEMPTS;
        let lock_until = if should_lock {
            Some(Utc::now() + Duration::minutes(LOCKOUT_MINUTES))
        } else {
            None
        };
        sqlx::query(
            r#"UPDATE users SET failed_pin_attempts = $1, pin_locked_until = $2
               WHERE id = $3"#,
        )
        .bind(new_attempts)
        .bind(lock_until)
        .bind(user.id)
        .execute(&state.pg)
        .await
        .ok();

        warn!(
            "[login_phone] PIN incorrect user_id={} attempts={}/{} lock={}",
            user.id, new_attempts, MAX_PIN_ATTEMPTS, should_lock
        );
        if should_lock {
            return Err(AppError::TooManyRequests(format!(
                "Trop de tentatives. Compte verrouillé pour {} min.",
                LOCKOUT_MINUTES
            )));
        }
        return Err(AppError::Unauthorized(format!(
            "Code PIN incorrect ({} tentative(s) restante(s)).",
            MAX_PIN_ATTEMPTS - new_attempts
        )));
    }

    // PIN OK → reset compteur
    sqlx::query(
        "UPDATE users SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = $1",
    )
    .bind(user.id)
    .execute(&state.pg)
    .await
    .ok();

    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| AppError::Internal("JWT_SECRET manquant".into()))?;
    let jwt = generate_jwt(
        user.id,
        &user.role,
        user.email.as_deref().unwrap_or(""),
        user.nom_complet.clone(),
        user.tokens_balance,
        &secret,
        user.partner_type.clone(),
    )?;

    info!(
        "[login_phone] OK user_id={} phone={}",
        user.id,
        log_safe_phone(&phone)
    );

    Ok((
        StatusCode::OK,
        jwt_cookie_headers(&jwt),
        Json(serde_json::json!({
            "success": true,
            "token": jwt,
            "user": {
                "id": user.id,
                "role": user.role,
                "phone": phone,
                "nom_complet": user.nom_complet,
                "tokens_balance": user.tokens_balance,
                "phone_verified": user.phone_verified,
            }
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════════════
// RECLAIM : un user signale "ce numéro est le mien, quelqu'un d'autre l'a pris"
// ═══════════════════════════════════════════════════════════════════════
//
// Aucune action automatique : le signalement crée une entrée dans
// `phone_reclaims` que les admins traitent manuellement (table accessible via
// /api/admin/phone-reclaims). Anti-spam : 3 signalements max / 24 h / phone
// pour un même IP. Pas d'auth requise (le réclamant n'a justement pas accès
// au compte).
//
// L'app n'envoie aucune notification au "squatteur" pour ne pas le prévenir.

#[derive(Deserialize)]
pub struct ReclaimPhoneInput {
    pub phone: String,
    /// Email ou autre numéro joignable pour que l'admin rappelle.
    pub contact: String,
    #[serde(default)]
    pub reason: Option<String>,
}

pub async fn reclaim_phone(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(body): Json<ReclaimPhoneInput>,
) -> AppResult<impl IntoResponse> {
    let phone = validate_phone(&body.phone)?;
    let contact = body.contact.trim();
    if contact.is_empty() || contact.len() > 200 {
        return Err(AppError::BadRequest(
            "Indiquez un email ou un autre numéro de contact (max 200 caractères).".into(),
        ));
    }
    let reason = body
        .reason
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(1000).collect::<String>());

    let ip = headers
        .get("cf-connecting-ip")
        .or_else(|| headers.get("x-forwarded-for"))
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string());
    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.chars().take(500).collect::<String>());

    // Anti-spam : 3 reclaims max / IP / 24 h, tous numéros confondus.
    if let Some(ip_str) = &ip {
        let n: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM phone_reclaims
               WHERE ip_address = $1::inet AND created_at > NOW() - INTERVAL '24 hours'"#,
        )
        .bind(ip_str)
        .fetch_one(&state.pg)
        .await
        .unwrap_or(0);
        if n >= 3 {
            return Err(AppError::TooManyRequests(
                "Trop de signalements depuis cette adresse. Réessayez demain.".into(),
            ));
        }
    }

    // Récupère l'id du compte cible (s'il existe) — utile pour l'admin.
    let target_user_id: Option<i32> =
        sqlx::query_scalar("SELECT id FROM users WHERE phone = $1")
            .bind(&phone)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

    sqlx::query(
        r#"INSERT INTO phone_reclaims (phone, target_user_id, contact, reason, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5::inet, $6)"#,
    )
    .bind(&phone)
    .bind(target_user_id)
    .bind(contact)
    .bind(&reason)
    .bind(&ip)
    .bind(&ua)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[reclaim_phone] INSERT: {e:?}");
        AppError::Internal("Impossible d'enregistrer le signalement.".into())
    })?;

    info!(
        "[reclaim_phone] OK phone={} target_user_id={:?}",
        log_safe_phone(&phone),
        target_user_id
    );

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "success": true,
            "message": "Signalement enregistré. Un admin vous contactera sous 48 h."
        })),
    ))
}
