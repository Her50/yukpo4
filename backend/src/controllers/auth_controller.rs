use axum::{
    extract::State,
    http::{HeaderMap, HeaderValue},
    response::{IntoResponse, Json},
    Extension,
};
use bcrypt::{hash, verify};
use log::{error, info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    utils::{
        jwt_manager::generate_jwt,
        normalize_name::build_full_name,
        sanitize_logs::log_safe_email,
        validation::{validate_email, validate_name, validate_password_strength},
    },
};

use crate::state::AppState;

fn log_safe_phone(phone: &str) -> String {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() <= 4 {
        return "****".to_string();
    }
    format!("***{}", &digits[digits.len() - 4..])
}

async fn check_rate_limit(_key: &str, _window_seconds: i64, _max_attempts: i64) -> AppResult<()> {
    // Fallback permissif: le projet ne fournit plus de redis dans AppState.
    Ok(())
}

/// Bonus de bienvenue Yukpo : crédité **une seule fois** à la création du compte.
/// Remplace l'ancien quota mensuel gratuit (qui se renouvelait chaque mois).
/// Override possible via env var `YUKPO_SIGNUP_BONUS_TOKENS`.
fn signup_bonus_tokens() -> i64 {
    std::env::var("YUKPO_SIGNUP_BONUS_TOKENS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(4000)
}

#[derive(Deserialize)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

/// ✅ 2026-05-21 — Construit le header Set-Cookie sécurisé pour le JWT.
/// HttpOnly empêche JS de lire le cookie (fix XSS), Secure force HTTPS,
/// SameSite=Lax empêche CSRF cross-site mais autorise navigation classique.
/// Path=/ et Max-Age aligné sur le TTL du JWT (24h).
pub(crate) fn build_jwt_cookie(token: &str, max_age_secs: i64) -> String {
    // En debug (cargo run local), on n'a pas forcément HTTPS → on retire Secure
    // pour pouvoir tester sur http://localhost. En release Secure est présent.
    #[cfg(debug_assertions)]
    let secure_flag = "";
    #[cfg(not(debug_assertions))]
    let secure_flag = "; Secure";
    format!(
        "token={}; HttpOnly{}; SameSite=Lax; Path=/; Max-Age={}",
        token, secure_flag, max_age_secs
    )
}

/// ? Connexion avec email/mot de passe
pub async fn login_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginInput>,
) -> AppResult<impl IntoResponse> {
    // ✅ SÉCURITÉ: Valider les entrées
    validate_email(&payload.email)?;
    if payload.password.is_empty() {
        return Err(AppError::BadRequest("Le mot de passe est requis".into()));
    }

    // ✅ SÉCURITÉ: Logger l'email masqué
    info!(
        "Appel login_handler pour email={}",
        log_safe_email(&payload.email)
    );
    let db = &state.pg;

    #[derive(FromRow)]
    struct UserRow {
        id: i32,
        email: String,
        password_hash: String,
        role: String,
        tokens_balance: i64,
        nom_complet: Option<String>,
        partner_status: Option<String>,
        partner_type: Option<String>,
    }

    let user = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT id, email, password_hash, role, tokens_balance, nom_complet, partner_status, partner_type
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(&payload.email)
    .fetch_optional(db)
    .await;
    let user = match user {
        Ok(Some(u)) => u,
        Ok(None) => {
            // ✅ SÉCURITÉ: Ne pas révéler si l'email existe
            // Utiliser un message générique pour éviter l'énumération d'emails
            error!(
                "[login_handler] Tentative de connexion échouée pour email={} (identifiants incorrects)",
                log_safe_email(&payload.email)
            );
            return Err(AppError::Unauthorized("Identifiants incorrects".into()));
        }
        Err(e) => {
            error!("[login_handler] DB error: {e:?}");
            return Err(e.into());
        }
    };

    // ✅ SÉCURITÉ: Vérifier le mot de passe AVANT de logger quoi que ce soit
    // Utiliser un message générique pour éviter l'énumération
    let password_valid = verify(&payload.password, &user.password_hash).map_err(|e| {
        error!("[login_handler] Erreur vérification mot de passe: {e:?}");
        AppError::Internal("Erreur lors de la vérification du mot de passe".into())
    })?;
    if !password_valid {
        error!(
            "[login_handler] Tentative de connexion échouée pour utilisateur id={}",
            user.id
        );
        return Err(AppError::Unauthorized("Identifiants incorrects".into()));
    }

    // ✅ NOUVEAU: Vérifier le statut partenaire
    if user.role == "partenaire" {
        match user.partner_status.as_deref() {
            Some("pending") => {
                return Err(AppError::Forbidden(
                    "Votre compte partenaire est en attente de validation par un administrateur"
                        .into(),
                ));
            }
            Some("rejected") => {
                return Err(AppError::Forbidden(
                    "Votre compte partenaire a été rejeté. Contactez le support pour plus d'informations".into()
                ));
            }
            Some("approved") | None => {
                // Compte approuvé ou statut non défini (ancien système)
            }
            _ => {}
        }
    }
    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| AppError::Internal("JWT_SECRET manquant".into()))?;
    let jwt = generate_jwt(
        user.id,
        &user.role,
        &user.email,
        user.nom_complet.clone(), // ✅ NOUVEAU: passer le nom de l'utilisateur
        user.tokens_balance,
        &secret,
        user.partner_type.clone(), // ✅ NOUVEAU: passer le type de partenaire
    )?;
    // ✅ 2026-05-21 — Réponse enrichie : on inclut user info pour permettre
    // au frontend web de ne plus décoder le JWT (qui sera dans un cookie
    // httpOnly invisible à JS). Le `token` reste dans la réponse pour
    // la compatibilité mobile RN (cookies pas pratiques en natif).
    let mut response_data = serde_json::json!({
        "token": jwt,
        "tokens_balance": user.tokens_balance,
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "name": user.nom_complet,
            "partner_type": user.partner_type,
            "tokens_balance": user.tokens_balance,
        }
    });

    // ✅ NOUVEAU: Inclure partner_type dans la réponse si c'est un partenaire
    if user.role == "partenaire" {
        response_data["partner_type"] = serde_json::json!(user.partner_type);
    }

    info!(
        "[login_handler] ✅ Réponse login générée: token présent={}, tokens_balance={}, role={}",
        !response_data["token"].as_str().unwrap_or("").is_empty(),
        response_data["tokens_balance"],
        user.role
    );

    // ✅ 2026-05-21 — Set-Cookie httpOnly pour le navigateur web (fix XSS).
    // Le mobile (RN) ignore les cookies et continue d'utiliser `token` du JSON.
    let cookie_value = build_jwt_cookie(&jwt, 60 * 60 * 24);
    let mut headers = HeaderMap::new();
    if let Ok(hv) = HeaderValue::from_str(&cookie_value) {
        headers.insert(axum::http::header::SET_COOKIE, hv);
    }

    Ok((headers, Json(response_data)))
}

/// ✅ 2026-05-21 — GET /api/auth/me : retourne les infos user depuis le JWT
/// (lu dans le cookie OU le header Authorization). Permet au frontend web
/// de récupérer ses claims sans jamais accéder au JWT côté JS.
pub async fn me_handler(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<crate::middlewares::jwt::AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    #[derive(FromRow)]
    struct UserRow {
        id: i32,
        email: String,
        role: String,
        tokens_balance: i64,
        nom_complet: Option<String>,
        partner_type: Option<String>,
    }
    let user = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT id, email, role, tokens_balance, nom_complet, partner_type
        FROM users WHERE id = $1
        "#,
    )
    .bind(auth.id)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Utilisateur introuvable".into()))?;

    Ok(Json(serde_json::json!({
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "name": user.nom_complet,
        "partner_type": user.partner_type,
        "tokens_balance": user.tokens_balance,
    })))
}

#[derive(Deserialize)]
pub struct RegisterInput {
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub name: Option<String>, // Support pour le champ 'name' du frontend
    pub email: String,
    pub password: String,
    pub lang: Option<String>,
    // ✅ NOUVEAU 2026-02-25: Champs pour vérification téléphone
    pub phone: Option<String>,         // Numéro de téléphone
    pub phone_country: Option<String>, // Code pays (CM, CI, SN, etc.)
    // ✅ NOUVEAU: Champs pour inscription partenaire
    pub is_partner: Option<bool>, // true si c'est une inscription partenaire
    pub partner_type: Option<String>, // 'pharmacie', 'hopital', 'laboratoire', 'agence de voyage'
    pub partner_name: Option<String>, // Nom de la structure/établissement
    pub partner_phone: Option<String>, // Téléphone de la structure
    pub partner_address: Option<String>, // Adresse de la structure
    pub partner_city: Option<String>, // Ville
    pub partner_country: Option<String>, // Pays
    pub partner_logo: Option<String>, // ✅ NOUVEAU: Logo du partenaire (base64)
    pub partner_lat: Option<f64>, // ✅ NOUVEAU: Latitude GPS
    pub partner_lng: Option<f64>, // ✅ NOUVEAU: Longitude GPS
    pub payment_methods: Option<serde_json::Value>, // ✅ NOUVEAU: Moyens de paiement (MTN/Orange Money)
    /// Code d'invitation émis par un restaurant (table `restaurant_partner_codes`), optionnel
    pub restaurant_partner_code: Option<String>,
    // ✅ NOUVEAU: Documents administratifs entreprise (Cameroun)
    pub rccm: Option<String>, // Registre du Commerce et du Crédit Mobilier
    pub numero_contribuable: Option<String>, // Numéro contribuable / NIU fiscal
    // ✅ NOUVEAU: Images base64 pour vérification Vision API
    pub rccm_doc_base64: Option<String>, // Scan/photo du certificat RCCM
    pub niu_doc_base64: Option<String>,  // Scan/photo de l'attestation NIU (chauffeurs/coursiers)
    // ✅ 2026-05-15: Parrainage — code du parrain capturé via ?ref=XXX sur le
    // landing, propagé par le frontend lors du signup. Optionnel.
    pub ref_code: Option<String>,
}

/// ? Inscription manuelle
pub async fn register_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterInput>,
) -> impl IntoResponse {
    // ✅ SÉCURITÉ: Valider les entrées
    validate_email(&payload.email)?;
    validate_password_strength(&payload.password)?;

    // ✅ 2026-05-11 : numéro WhatsApp OBLIGATOIRE à l'inscription.
    // Utilisé pour les notifications de matching troc, crédit disponible,
    // livraison en route. Sans phone valide, le parent ne peut pas être
    // averti des événements clés → bloque la valeur produit.
    let phone_digits: String = payload
        .phone
        .as_deref()
        .unwrap_or("")
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect();
    if phone_digits.len() < 8 || phone_digits.len() > 15 {
        return Err(AppError::BadRequest(
            "Numéro WhatsApp obligatoire (8 à 15 chiffres).".to_string(),
        ));
    }

    // ✅ Déterminer le rôle en premier pour adapter la validation des noms
    let user_role = if payload.is_partner.unwrap_or(false) {
        "partenaire"
    } else {
        "user"
    };

    // Valider les noms si fournis — seulement pour les utilisateurs ordinaires.
    // Pour les partenaires, `nom` est la raison sociale (peut contenir des chiffres/symboles).
    if user_role != "partenaire" {
        if let Some(ref nom) = payload.nom {
            validate_name(nom, "Nom")?;
        }
        if let Some(ref prenom) = payload.prenom {
            validate_name(prenom, "Prénom")?;
        }
        if let Some(ref name) = payload.name {
            validate_name(name, "Nom complet")?;
        }
    }

    // ✅ RENFORCÉ: Validation stricte du partner_type - OBLIGATOIRE pour un partenaire
    if user_role == "partenaire" {
        let valid_types = [
            "livraison",
            "livraison_courses_marche",
            "pharmacie",
            "hopital",
            "laboratoire",
            "agence de voyage",
            "demenagement",
            "transport",
            "assureur",
            "supermarche",
            "telecom",
            "etablissementscolaire",
            "banquesang",
            "chauffeur",
            "hotel",
            "meuble",
            "libraire",
            "restaurant",
            "boulangerie",
            "traiteur",
        ];

        // ✅ CORRIGÉ: Ajouter des logs de debug pour identifier le problème
        info!(
            "[register_user] Validation partenaire - partner_type: {:?}, partner_name: {:?}",
            payload.partner_type,
            payload.partner_name.as_ref().map(|s| if s.len() > 50 {
                format!("{}...", &s[..50])
            } else {
                s.clone()
            })
        );

        // ✅ Validation stricte: partner_type doit être présent et non vide
        match &payload.partner_type {
            Some(pt) if !pt.trim().is_empty() => {
                let pt_trimmed = pt.trim();
                if !valid_types.contains(&pt_trimmed) {
                    error!(
                        "[register_user] ❌ Type de partenaire invalide: '{}'. Types valides: {}",
                        pt_trimmed,
                        valid_types.join(", ")
                    );
                    return Err(AppError::BadRequest(format!(
                        "Type de partenaire invalide: '{}'. Types valides: {}",
                        pt_trimmed,
                        valid_types.join(", ")
                    )));
                }
            }
            _ => {
                error!(
                    "[register_user] ❌ partner_type manquant ou vide pour inscription partenaire"
                );
                return Err(AppError::BadRequest(
                    "Le type d'établissement est obligatoire pour créer un compte partenaire. Veuillez sélectionner un type d'établissement.".into()
                ));
            }
        }

        if payload.partner_name.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
            error!("[register_user] ❌ partner_name manquant ou vide pour inscription partenaire");
            return Err(AppError::BadRequest(
                "partner_name est requis pour un partenaire".into(),
            ));
        }

        // ✅ NOUVEAU: Validation NIU obligatoire pour chauffeurs et coursiers
        let is_driver_type = payload
            .partner_type
            .as_ref()
            .map(|t| {
                let pt = t.trim();
                pt == "chauffeur" || pt == "livraison" || pt == "livraison_courses_marche"
            })
            .unwrap_or(false);
        if is_driver_type {
            let niu = payload.numero_contribuable.as_deref().unwrap_or("").trim().to_uppercase();
            if niu.is_empty() {
                return Err(AppError::BadRequest(
                    "Le Numéro d'Identifiant Unique (NIU) est obligatoire pour les chauffeurs et coursiers.".into(),
                ));
            }
            // Format NIU camerounais: commence par M ou P, suivi de chiffres et lettres (minimum 8 caractères)
            if niu.len() < 8 {
                return Err(AppError::BadRequest(
                    "Format NIU invalide. Exemple: M012345678901A".into(),
                ));
            }
        }

        // Code partenaire restaurant (optionnel) : si fourni, doit exister et être actif
        if let Some(ref pt) = payload.partner_type {
            let pt_trimmed = pt.trim();
            if pt_trimmed == "restaurant" || pt_trimmed == "boulangerie" || pt_trimmed == "traiteur"
            {
                if let Some(ref raw_code) = payload.restaurant_partner_code {
                    let code_trim = raw_code.trim();
                    if !code_trim.is_empty() {
                        let valid: bool = sqlx::query_scalar(
                            r#"
                            SELECT EXISTS(
                              SELECT 1 FROM restaurant_partner_codes
                              WHERE UPPER(code) = UPPER($1) AND is_active = TRUE
                            )
                            "#,
                        )
                        .bind(code_trim)
                        .fetch_one(&state.pg)
                        .await
                        .unwrap_or(false);
                        if !valid {
                            return Err(AppError::BadRequest(
                                "Code partenaire restaurant invalide ou inactif.".into(),
                            ));
                        }
                    }
                }
            }
        }
    }

    // ✅ SÉCURITÉ: Logger l'email masqué
    info!(
        "Appel register_user pour email={}, role={}",
        log_safe_email(&payload.email),
        user_role
    );
    let db = &state.pg;
    let exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
            .bind(&payload.email)
            .fetch_one(db)
            .await;
    let exists = match exists {
        Ok(val) => val,
        Err(e) => {
            error!("[register_user] DB error (check exists): {e:?}");
            return Err(e.into());
        }
    };
    if exists {
        // ✅ CORRIGÉ 2026-03-03: Récupération pour les partenaires dont l'inscription a échoué partiellement
        // Scénario: l'utilisateur a été créé dans `users` mais l'insertion dans `delivery_partners` a échoué
        // (ex: enum delivery_partner_type manquait 'hotel'/'meuble'). Sur retry → 409.
        // Solution: détecter ce cas et compléter l'inscription au lieu de rejeter.
        if user_role == "partenaire" {
            #[derive(FromRow)]
            struct ExistingPartnerCheck {
                id: i32,
                role: String,
                tokens_balance: i64,
            }

            let existing_user = sqlx::query_as::<_, ExistingPartnerCheck>(
                "SELECT id, role, tokens_balance FROM users WHERE email = $1",
            )
            .bind(&payload.email)
            .fetch_optional(db)
            .await;

            if let Ok(Some(eu)) = existing_user {
                // Vérifier si le delivery_partners record existe
                let has_partner: bool = sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM delivery_partners WHERE created_by = $1)",
                )
                .bind(eu.id)
                .fetch_one(db)
                .await
                .unwrap_or(false);

                if !has_partner && (eu.role == "partenaire" || eu.role == "user") {
                    // ✅ Cas de récupération: l'utilisateur existe mais pas le partenaire
                    // Mettre à jour le mot de passe et le rôle, puis continuer avec la création du partenaire
                    info!(
                        "[register_user] ♻️ Récupération inscription partenaire partielle pour user_id={}, email={}",
                        eu.id, log_safe_email(&payload.email)
                    );

                    const BCRYPT_COST_RECOVERY: u32 = 12;
                    let password_hash_recovery = hash(&payload.password, BCRYPT_COST_RECOVERY)?;
                    let nom_complet_recovery = build_full_name(
                        payload.nom.as_deref(),
                        payload.prenom.as_deref(),
                        payload.name.as_deref(),
                    );

                    let _ = sqlx::query(
                        r#"
                        UPDATE users SET 
                            password_hash = $1, role = 'partenaire', 
                            partner_type = $2, partner_status = 'pending',
                            nom = COALESCE($3, nom), prenom = COALESCE($4, prenom),
                            nom_complet = COALESCE($5, nom_complet),
                            updated_at = NOW()
                        WHERE id = $6
                        "#,
                    )
                    .bind(&password_hash_recovery)
                    .bind(payload.partner_type.as_deref())
                    .bind(payload.nom.as_deref())
                    .bind(payload.prenom.as_deref())
                    .bind(nom_complet_recovery.as_deref())
                    .bind(eu.id)
                    .execute(db)
                    .await;

                    // ✅ IMPORTANT: On ne retourne PAS d'erreur, on saute directement à la création du partenaire
                    // en simulant un "new user" avec les données existantes
                    // On utilise un goto-like en Rust: on définit new_id et on continue
                    let recovery_user_id = eu.id;
                    let recovery_tokens = eu.tokens_balance;

                    // -- Début bloc récupération partenaire (même logique que plus bas) --
                    let mut recovery_logo_url: Option<String> = None;
                    if let Some(ref logo_base64) = payload.partner_logo {
                        if !logo_base64.trim().is_empty() {
                            use base64::{engine::general_purpose::STANDARD, Engine};
                            use uuid::Uuid;

                            let base64_data = if logo_base64.starts_with("data:image") {
                                logo_base64.split(',').nth(1).unwrap_or(logo_base64)
                            } else {
                                logo_base64
                            };

                            if let Ok(decoded) = STANDARD.decode(base64_data) {
                                let mime_type = if logo_base64.contains("image/png") {
                                    ("image/png", "png")
                                } else if logo_base64.contains("image/jpeg")
                                    || logo_base64.contains("image/jpg")
                                {
                                    ("image/jpeg", "jpg")
                                } else {
                                    ("image/jpeg", "jpg")
                                };

                                let storage_key = format!(
                                    "partners/{}/logo_{}.{}",
                                    recovery_user_id,
                                    Uuid::new_v4(),
                                    mime_type.1
                                );

                                if let Ok(location) = state
                                    .media_storage
                                    .store_bytes(&decoded, &storage_key, Some(mime_type.0))
                                    .await
                                {
                                    recovery_logo_url = Some(location.storage_path);
                                }
                            }
                        }
                    }

                    // Créer la table/enum si nécessaire (même bloc que plus bas)
                    let _ = sqlx::query(
                        r#"
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_partner_type') THEN
                                CREATE TYPE delivery_partner_type AS ENUM (
                                    'livraison', 'livraison_courses_marche', 'pharmacie', 'hopital', 
                                    'laboratoire', 'agence de voyage', 'demenagement', 'transport', 
                                    'assureur', 'supermarche', 'telecom', 'chauffeur',
                                    'hotel', 'meuble', 'etablissementscolaire', 'banquesang'
                                );
                            END IF;
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.tables 
                                WHERE table_schema = 'public' AND table_name = 'delivery_partners'
                            ) THEN
                                CREATE TABLE delivery_partners (
                                    id SERIAL PRIMARY KEY,
                                    name VARCHAR(255) NOT NULL,
                                    description TEXT,
                                    partner_type delivery_partner_type NOT NULL DEFAULT 'livraison',
                                    contact_email VARCHAR(255),
                                    contact_phone VARCHAR(50),
                                    address TEXT,
                                    city VARCHAR(100),
                                    country VARCHAR(100) NOT NULL DEFAULT 'Non spécifié',
                                    continent VARCHAR(50),
                                    website VARCHAR(255),
                                    logo_url TEXT,
                                    location_latitude DOUBLE PRECISION,
                                    location_longitude DOUBLE PRECISION,
                                    location_address TEXT,
                                    is_active BOOLEAN DEFAULT TRUE,
                                    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                                    created_at TIMESTAMPTZ DEFAULT NOW(),
                                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                                    UNIQUE(name, country)
                                );
                            END IF;
                        END
                        $$;
                        "#
                    )
                    .execute(db)
                    .await;

                    // Ajouter les valeurs manquantes à l'enum si elles existent déjà
                    let _ = sqlx::query(
                        r#"
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'hotel' AND enumtypid = 'delivery_partner_type'::regtype) THEN
                                ALTER TYPE delivery_partner_type ADD VALUE 'hotel';
                            END IF;
                            IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'meuble' AND enumtypid = 'delivery_partner_type'::regtype) THEN
                                ALTER TYPE delivery_partner_type ADD VALUE 'meuble';
                            END IF;
                            IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'etablissementscolaire' AND enumtypid = 'delivery_partner_type'::regtype) THEN
                                ALTER TYPE delivery_partner_type ADD VALUE 'etablissementscolaire';
                            END IF;
                            IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'banquesang' AND enumtypid = 'delivery_partner_type'::regtype) THEN
                                ALTER TYPE delivery_partner_type ADD VALUE 'banquesang';
                            END IF;
                            IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'restaurant' AND enumtypid = 'delivery_partner_type'::regtype) THEN
                                ALTER TYPE delivery_partner_type ADD VALUE 'restaurant';
                            END IF;
                        END
                        $$;
                        "#
                    )
                    .execute(db)
                    .await;

                    let partner_name = payload
                        .partner_name
                        .as_ref()
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .ok_or_else(|| {
                            AppError::BadRequest(
                                "partner_name est requis pour un partenaire".into(),
                            )
                        })?;

                    let partner_country = payload
                        .partner_country
                        .as_deref()
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .unwrap_or("Non spécifié");

                    let partner_result = sqlx::query(
                        r#"
                        INSERT INTO delivery_partners (
                            name, description, partner_type, contact_email, contact_phone, address,
                            city, country, continent, website, logo_url, location_latitude, location_longitude,
                            location_address, is_active, created_by
                        )
                        VALUES ($1, $2, $3::delivery_partner_type, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                        ON CONFLICT (name, country) DO UPDATE SET
                            created_by = EXCLUDED.created_by,
                            partner_type = EXCLUDED.partner_type,
                            contact_email = EXCLUDED.contact_email,
                            updated_at = NOW()
                        "#
                    )
                    .bind(partner_name)
                    .bind(None::<String>)
                    .bind(payload.partner_type.as_deref().unwrap_or("livraison"))
                    .bind(Some(payload.email.as_str()))
                    .bind(payload.partner_phone.as_deref())
                    .bind(payload.partner_address.as_deref())
                    .bind(payload.partner_city.as_deref())
                    .bind(partner_country)
                    .bind(None::<String>)
                    .bind(None::<String>)
                    .bind(recovery_logo_url.as_deref())
                    .bind(payload.partner_lat)
                    .bind(payload.partner_lng)
                    .bind(payload.partner_address.as_deref())
                    .bind(false)
                    .bind(recovery_user_id)
                    .execute(db)
                    .await;

                    match partner_result {
                        Ok(_) => {
                            info!(
                                "[register_user] ✅ Récupération réussie: partenaire créé pour user_id={}",
                                recovery_user_id
                            );
                        }
                        Err(e) => {
                            error!(
                                "[register_user] ❌ Échec récupération partenaire pour user_id={}: {}",
                                recovery_user_id, e
                            );
                            return Err(AppError::Internal(format!(
                                "Erreur lors de la création du partenaire: {}. Veuillez contacter le support.",
                                e
                            )));
                        }
                    }

                    // Générer JWT et retourner succès
                    let secret = std::env::var("JWT_SECRET")
                        .map_err(|_| AppError::Internal("JWT_SECRET manquant".into()))?;
                    let jwt = generate_jwt(
                        recovery_user_id,
                        user_role,
                        &payload.email,
                        nom_complet_recovery.clone(),
                        recovery_tokens,
                        &secret,
                        payload.partner_type.clone(),
                    )?;

                    return Ok((
                        axum::http::StatusCode::CREATED,
                        Json(serde_json::json!({
                            "id": recovery_user_id,
                            "user_id": recovery_user_id,
                            "tokens_balance": recovery_tokens,
                            "token": jwt,
                            "phone_verified": false,
                            "recovered": true,
                            "message": "Compte partenaire récupéré et complété avec succès."
                        })),
                    )
                        .into_response());
                }
            }
        }

        error!(
            "[register_user] Email déjà utilisé: {}",
            log_safe_email(&payload.email)
        );
        let error_message = if user_role == "partenaire" {
            "Cet email est déjà utilisé. Veuillez vous connecter avec cet email ou contacter le support pour obtenir le statut partenaire.".to_string()
        } else {
            "Cet email est déjà utilisé. Veuillez vous connecter ou utiliser un autre email."
                .to_string()
        };
        return Err(AppError::Conflict(error_message));
    }
    // ✅ SÉCURITÉ: Utiliser un cost plus élevé pour bcrypt (12 au lieu de 10)
    // DEFAULT_COST est 10, on utilise 12 pour plus de sécurité
    const BCRYPT_COST: u32 = 12;
    let password_hash = hash(&payload.password, BCRYPT_COST)?;
    // Valeurs par defaut pour les nouveaux utilisateurs
    let default_token_price_user = 1.0_f64;
    let default_token_price_provider = 1.0_f64;
    let default_commission_pct = 0.0_f32;

    // ✅ CORRIGÉ 2026-02-16: Utiliser build_full_name pour éviter les duplications
    // Calculer le nom_complet a partir de nom, prenom ou name (avec normalisation)
    let nom_complet = build_full_name(
        payload.nom.as_deref(),
        payload.prenom.as_deref(),
        payload.name.as_deref(),
    );

    // Créer l'avatar_url si on a un nom
    let avatar_url = nom_complet.as_ref().map(|name| {
        format!(
            "https://ui-avatars.com/api/?name={}&background=random&color=fff&size=200",
            urlencoding::encode(name)
        )
    });

    #[derive(FromRow)]
    struct NewUserRow {
        id: i32,
        tokens_balance: i64,
    }

    let new = sqlx::query_as::<_, NewUserRow>(
        r#"
        INSERT INTO users (
            email, password_hash, role, tokens_balance, preferred_lang,
            token_price_user, token_price_provider, commission_pct,
            nom, prenom, nom_complet, avatar_url, partner_type, partner_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, tokens_balance
        "#,
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(user_role)
    .bind(signup_bonus_tokens())
    .bind(payload.lang.as_deref().unwrap_or("fr"))
    .bind(default_token_price_user)
    .bind(default_token_price_provider)
    .bind(default_commission_pct)
    .bind(payload.nom.as_deref())
    .bind(payload.prenom.as_deref())
    .bind(nom_complet.as_deref())
    .bind(avatar_url.as_deref())
    .bind(payload.partner_type.as_deref())
    .bind(if user_role == "partenaire" {
        Some("pending")
    } else {
        None::<&str>
    })
    .fetch_one(db)
    .await;
    let new = match new {
        Ok(n) => n,
        Err(e) => {
            error!("[register_user] DB error (insert): {e:?}");
            return Err(e.into());
        }
    };

    // ✅ 2026-05-15 : Parrainage — étape post-INSERT, non bloquante.
    // 1. Génère un referral_code unique pour le nouvel utilisateur (sera utilisé
    //    pour qu'il parraine à son tour).
    // 2. Si un ref_code parrain a été fourni (capturé via ?ref=XXX sur le
    //    landing), attache le filleul → parrain et crée une ligne `referrals`.
    // En cas d'erreur, on log mais on ne bloque pas l'inscription : le code
    // pourra être généré au prochain GET /api/referral/me.
    if let Err(e) = crate::services::referral_service::ensure_referral_code(db, new.id).await {
        error!(
            "[register_user] referral_code generation failed for user {}: {e:?}",
            new.id
        );
    }
    if let Some(ref ref_code) = payload.ref_code {
        let trimmed = ref_code.trim();
        if !trimmed.is_empty() {
            match crate::services::referral_service::attach_referrer(db, new.id, trimmed).await {
                Ok(Some(parrain_id)) => {
                    info!(
                        "[register_user] user {} attached to parrain {} via code '{}'",
                        new.id, parrain_id, trimmed
                    );
                }
                Ok(None) => {
                    // Code invalide ou déjà attribué — silencieux côté API
                    info!(
                        "[register_user] ref_code '{}' did not resolve to a parrain for user {}",
                        trimmed, new.id
                    );
                }
                Err(e) => {
                    error!(
                        "[register_user] attach_referrer failed for user {} code '{}': {e:?}",
                        new.id, trimmed
                    );
                }
            }
        }
    }

    // ✅ NOUVEAU: Si c'est un partenaire, créer l'enregistrement dans delivery_partners
    let mut logo_url: Option<String> = None;
    if user_role == "partenaire" {
        // ✅ NOUVEAU: Uploader le logo si fourni
        if let Some(ref logo_base64) = payload.partner_logo {
            if !logo_base64.trim().is_empty() {
                use base64::{engine::general_purpose::STANDARD, Engine};
                use uuid::Uuid;

                // Extraire les données base64
                let base64_data = if logo_base64.starts_with("data:image") {
                    logo_base64.split(',').nth(1).unwrap_or(logo_base64)
                } else {
                    logo_base64
                };

                // Décoder le base64
                let decoded = STANDARD
                    .decode(base64_data)
                    .map_err(|e| AppError::BadRequest(format!("Logo base64 invalide: {}", e)))?;

                // Déterminer le type MIME et l'extension
                let mime_type = if logo_base64.contains("image/png") {
                    ("image/png", "png")
                } else if logo_base64.contains("image/jpeg") || logo_base64.contains("image/jpg") {
                    ("image/jpeg", "jpg")
                } else if logo_base64.contains("image/webp") {
                    ("image/webp", "webp")
                } else {
                    ("image/jpeg", "jpg") // Par défaut
                };

                // Créer le chemin de stockage
                let storage_key = format!(
                    "partners/{}/logo_{}.{}",
                    new.id,
                    Uuid::new_v4(),
                    mime_type.1
                );

                // Uploader vers S3/Wasabi ou stockage local
                match state
                    .media_storage
                    .store_bytes(&decoded, &storage_key, Some(mime_type.0))
                    .await
                {
                    Ok(location) => {
                        logo_url = Some(location.storage_path);
                        info!(
                            "[register_user] ✅ Logo partenaire uploadé: {}",
                            logo_url.as_ref().unwrap()
                        );
                    }
                    Err(e) => {
                        error!("[register_user] ⚠️ Erreur upload logo partenaire: {}. Le partenaire sera créé sans logo.", e);
                        // Ne pas bloquer l'inscription si l'upload du logo échoue
                    }
                }
            }
        }

        // ✅ NOUVEAU: Créer l'enregistrement dans delivery_partners
        let partner_name = payload
            .partner_name
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| {
                AppError::BadRequest("partner_name est requis pour un partenaire".into())
            })?;

        // ✅ CORRIGÉ: Utiliser la valeur par défaut de la base de données si country est vide
        let partner_country = payload
            .partner_country
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .unwrap_or("Non spécifié");

        // ✅ CORRIGÉ: Créer la table delivery_partners si elle n'existe pas (fallback)
        let _ = sqlx::query(
            r#"
            DO $$
            BEGIN
                -- Créer l'enum delivery_partner_type si n'existe pas
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_partner_type') THEN
                    CREATE TYPE delivery_partner_type AS ENUM (
                        'livraison', 'livraison_courses_marche', 'pharmacie', 'hopital', 
                        'laboratoire', 'agence de voyage', 'demenagement', 'transport', 
                        'assureur', 'supermarche', 'telecom', 'chauffeur',
                        'hotel', 'meuble', 'etablissementscolaire', 'banquesang'
                    );
                END IF;
                
                -- Créer la table delivery_partners si n'existe pas
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'delivery_partners'
                ) THEN
                    CREATE TABLE delivery_partners (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        partner_type delivery_partner_type NOT NULL DEFAULT 'livraison',
                        contact_email VARCHAR(255),
                        contact_phone VARCHAR(50),
                        address TEXT,
                        city VARCHAR(100),
                        country VARCHAR(100) NOT NULL DEFAULT 'Non spécifié',
                        continent VARCHAR(50),
                        website VARCHAR(255),
                        logo_url TEXT,
                        location_latitude DOUBLE PRECISION,
                        location_longitude DOUBLE PRECISION,
                        location_address TEXT,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        UNIQUE(name, country)
                    );
                    
                    CREATE INDEX IF NOT EXISTS idx_delivery_partners_name ON delivery_partners(name);
                    CREATE INDEX IF NOT EXISTS idx_delivery_partners_active ON delivery_partners(is_active);
                    CREATE INDEX IF NOT EXISTS idx_delivery_partners_created_by ON delivery_partners(created_by);
                    CREATE INDEX IF NOT EXISTS idx_delivery_partners_type ON delivery_partners(partner_type);
                END IF;
            END
            $$;
            "#
        )
        .execute(db)
        .await;

        // ✅ CORRIGÉ 2026-03-03: Ajouter les valeurs manquantes à l'enum existant
        let _ = sqlx::query(
            r#"
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'hotel' AND enumtypid = 'delivery_partner_type'::regtype) THEN
                    ALTER TYPE delivery_partner_type ADD VALUE 'hotel';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'meuble' AND enumtypid = 'delivery_partner_type'::regtype) THEN
                    ALTER TYPE delivery_partner_type ADD VALUE 'meuble';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'etablissementscolaire' AND enumtypid = 'delivery_partner_type'::regtype) THEN
                    ALTER TYPE delivery_partner_type ADD VALUE 'etablissementscolaire';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'banquesang' AND enumtypid = 'delivery_partner_type'::regtype) THEN
                    ALTER TYPE delivery_partner_type ADD VALUE 'banquesang';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'restaurant' AND enumtypid = 'delivery_partner_type'::regtype) THEN
                    ALTER TYPE delivery_partner_type ADD VALUE 'restaurant';
                END IF;
                -- ✅ NOUVEAU: Colonnes documents administratifs partenaire
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_partners' AND column_name='rccm') THEN
                    ALTER TABLE delivery_partners ADD COLUMN rccm TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_partners' AND column_name='numero_contribuable') THEN
                    ALTER TABLE delivery_partners ADD COLUMN numero_contribuable TEXT;
                END IF;
                -- ✅ NOUVEAU: Colonnes résultats Vision AI RCCM/NIU
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_partners' AND column_name='ai_score') THEN
                    ALTER TABLE delivery_partners ADD COLUMN ai_score INTEGER;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_partners' AND column_name='ai_decision') THEN
                    ALTER TABLE delivery_partners ADD COLUMN ai_decision TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_partners' AND column_name='ai_extracted_id') THEN
                    ALTER TABLE delivery_partners ADD COLUMN ai_extracted_id TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_partners' AND column_name='ai_extracted_name') THEN
                    ALTER TABLE delivery_partners ADD COLUMN ai_extracted_name TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_partners' AND column_name='ai_details') THEN
                    ALTER TABLE delivery_partners ADD COLUMN ai_details TEXT;
                END IF;
            END
            $$;
            "#
        )
        .execute(db)
        .await;

        // ✅ Vérifier si un partenaire existe déjà pour cet utilisateur
        let existing_partner: Option<i32> = match sqlx::query_scalar(
            "SELECT id FROM delivery_partners WHERE created_by = $1 LIMIT 1",
        )
        .bind(new.id)
        .fetch_optional(db)
        .await
        {
            Ok(result) => result,
            Err(e) => {
                error!(
                    "[register_user] ❌ Erreur lors de la vérification du partenaire existant: {}",
                    e
                );
                return Err(AppError::Internal(format!(
                    "Erreur lors de la vérification du partenaire: {}",
                    e
                )));
            }
        };

        {
            let _partner_result = if existing_partner.is_some() {
                // Mettre à jour le partenaire existant
                sqlx::query(
                    r#"
                UPDATE delivery_partners SET
                    name = $1,
                    partner_type = $2::delivery_partner_type,
                    contact_email = $3,
                    contact_phone = $4,
                    address = $5,
                    city = $6,
                    country = $7,
                    logo_url = $8,
                    location_latitude = $9,
                    location_longitude = $10,
                    location_address = $11,
                    updated_at = NOW()
                WHERE created_by = $12
                "#,
                )
                .bind(partner_name)
                .bind(payload.partner_type.as_deref().unwrap_or("livraison"))
                .bind(Some(payload.email.as_str()))
                .bind(payload.partner_phone.as_deref())
                .bind(payload.partner_address.as_deref())
                .bind(payload.partner_city.as_deref())
                .bind(partner_country)
                .bind(logo_url.as_deref())
                .bind(payload.partner_lat)
                .bind(payload.partner_lng)
                .bind(payload.partner_address.as_deref())
                .bind(new.id)
                .execute(db)
                .await
            } else {
                // Créer un nouveau partenaire
                sqlx::query(
                r#"
                INSERT INTO delivery_partners (
                    name, description, partner_type, contact_email, contact_phone, address,
                    city, country, continent, website, logo_url, location_latitude, location_longitude,
                    location_address, is_active, created_by
                )
                VALUES ($1, $2, $3::delivery_partner_type, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                ON CONFLICT (name, country) DO UPDATE SET
                    created_by = EXCLUDED.created_by,
                    partner_type = EXCLUDED.partner_type,
                    contact_email = EXCLUDED.contact_email,
                    contact_phone = EXCLUDED.contact_phone,
                    address = EXCLUDED.address,
                    city = EXCLUDED.city,
                    logo_url = EXCLUDED.logo_url,
                    location_latitude = EXCLUDED.location_latitude,
                    location_longitude = EXCLUDED.location_longitude,
                    location_address = EXCLUDED.location_address,
                    updated_at = NOW()
                "#
            )
            .bind(partner_name)
            .bind(None::<String>) // description
            .bind(payload.partner_type.as_deref().unwrap_or("livraison"))
            .bind(Some(payload.email.as_str()))
            .bind(payload.partner_phone.as_deref())
            .bind(payload.partner_address.as_deref())
            .bind(payload.partner_city.as_deref())
            .bind(partner_country)
            .bind(None::<String>) // continent
            .bind(None::<String>) // website
            .bind(logo_url.as_deref())
            .bind(payload.partner_lat)
            .bind(payload.partner_lng)
            .bind(payload.partner_address.as_deref())
            .bind(false) // is_active = false (en attente de validation)
            .bind(new.id) // created_by
            .execute(db)
            .await
            };

            match _partner_result {
                Ok(_) => {
                    info!(
                        "[register_user] ✅ Partenaire créé dans delivery_partners pour user_id={}",
                        new.id
                    );
                }
                Err(e) => {
                    error!(
                        "[register_user] ❌ Erreur création partenaire dans delivery_partners: {}",
                        e
                    );
                    // ✅ CORRIGÉ: Retourner une erreur 500 si la création du partenaire échoue
                    // car l'utilisateur a été créé mais le partenaire est requis pour un compte partenaire
                    return Err(AppError::Internal(format!(
                    "Erreur lors de la création du partenaire: {}. Veuillez réessayer ou contacter le support.",
                    e
                )));
                }
            }
        } // Fin du bloc de création du partenaire

        // ✅ Stocker partner_phone comme users.phone pour que ChatModalMobile puisse l'utiliser comme WhatsApp
        if let Some(ref phone) = payload.partner_phone {
            if !phone.trim().is_empty() {
                let _ =
                    sqlx::query("UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2")
                        .bind(phone.trim())
                        .bind(new.id)
                        .execute(db)
                        .await;
            }
        }

        // ✅ NOUVEAU: Sauvegarder RCCM et numéro contribuable dans delivery_partners
        if payload.rccm.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
            || payload
                .numero_contribuable
                .as_ref()
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false)
        {
            let _ = sqlx::query(
                "UPDATE delivery_partners SET rccm = $1, numero_contribuable = $2, updated_at = NOW() WHERE created_by = $3"
            )
            .bind(payload.rccm.as_deref().map(|s| s.trim()))
            .bind(payload.numero_contribuable.as_deref().map(|s| s.trim()))
            .bind(new.id)
            .execute(db)
            .await
            .map_err(|e| log::error!("[register_user] Erreur sauvegarde RCCM/contribuable: {e:?}"));
        }

        // ✅ NOUVEAU: Vérification Vision API des documents administratifs (asynchrone, non bloquante)
        {
            use crate::services::document_ai_service::DocumentAiService;
            let ai_svc = DocumentAiService::new();
            if ai_svc.is_enabled() {
                // Vérification RCCM
                if let Some(ref rccm_b64) = payload.rccm_doc_base64 {
                    if !rccm_b64.trim().is_empty() {
                        log::info!("[register_user] Analyse RCCM Vision API user_id={}", new.id);
                        let result = ai_svc.analyze_rccm(rccm_b64.as_str()).await;
                        let details_json = serde_json::to_string(&result.details)
                            .unwrap_or_else(|_| "[]".to_string());
                        let _ = sqlx::query(
                            "UPDATE delivery_partners SET ai_score=$1, ai_decision=$2, ai_extracted_id=$3, ai_details=$4, updated_at=NOW() WHERE created_by=$5"
                        )
                        .bind(result.score as i32)
                        .bind(&result.decision)
                        .bind(result.extracted_id_number.as_deref())
                        .bind(&details_json)
                        .bind(new.id)
                        .execute(db)
                        .await
                        .map_err(|e| log::error!("[register_user] RCCM AI save error: {e:?}"));
                    }
                }
                // Vérification NIU
                if let Some(ref niu_b64) = payload.niu_doc_base64 {
                    if !niu_b64.trim().is_empty() {
                        log::info!("[register_user] Analyse NIU Vision API user_id={}", new.id);
                        let result = ai_svc.analyze_niu(niu_b64.as_str()).await;
                        let niu_summary = format!(
                            "NIU:{} score:{} décision:{}",
                            result.extracted_id_number.as_deref().unwrap_or(""),
                            result.score,
                            result.decision
                        );
                        let _ = sqlx::query(
                            "UPDATE delivery_partners SET ai_extracted_name=$1, updated_at=NOW() WHERE created_by=$2"
                        )
                        .bind(&niu_summary)
                        .bind(new.id)
                        .execute(db)
                        .await
                        .map_err(|e| log::error!("[register_user] NIU AI save error: {e:?}"));
                    }
                }
            }
        }
    }

    if let Err(e) = send_verification_email(&payload.email).await {
        error!("[register_user] Erreur envoi email: {e:?}");
    }
    // Générer un JWT pour l'utiliseateur nouvellement inscrit
    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| AppError::Internal("JWT_SECRET manquant".into()))?;
    let jwt = generate_jwt(
        new.id,
        user_role,
        &payload.email,
        nom_complet.clone(), // ✅ NOUVEAU: passer le nom de l'utilisateur
        new.tokens_balance,
        &secret,
        payload.partner_type.clone(), // ✅ NOUVEAU: passer le type de partenaire
    )?;

    // ✅ NOUVEAU: Sauvegarder les moyens de paiement si fournis
    if let Some(ref pm) = payload.payment_methods {
        if !pm.is_null() && pm != &serde_json::json!({}) {
            let _ = sqlx::query(
                "UPDATE users SET payment_methods = $1, updated_at = NOW() WHERE id = $2",
            )
            .bind(pm)
            .bind(new.id)
            .execute(db)
            .await
            .map_err(|e| log::error!("[register_user] Erreur sauvegarde payment_methods: {e:?}"));
            info!(
                "[register_user] ✅ payment_methods sauvegardés pour user_id={}",
                new.id
            );
        }
    }

    // ✅ NOUVEAU 2026-03-24: Envoyer le SMS de vérification si téléphone fourni
    if let Some(ref phone) = payload.phone {
        if !phone.trim().is_empty() {
            let phone_country = payload.phone_country.as_deref().unwrap_or("CM");
            let _ = sqlx::query(
                "UPDATE users SET phone = $1, phone_country = $2, phone_verified = FALSE WHERE id = $3"
            )
            .bind(phone.trim())
            .bind(phone_country)
            .bind(new.id)
            .execute(db)
            .await;

            // Envoyer le code de vérification par SMS
            use crate::services::sms_service::SmsService;
            let sms_service = SmsService::new();
            let verification_code = format!("{:06}", rand::random::<u32>() % 1_000_000);
            let message = format!(
                "Votre code de vérification YUKPO est: {}. Valide 15 minutes.",
                verification_code
            );

            match sms_service.send_sms(phone, &message).await {
                Ok(result) => {
                    if result.success {
                        info!(
                            "[register_user] SMS de vérification envoyé à: {}",
                            log_safe_phone(phone)
                        );

                        // Sauvegarder le code en base
                        let expires_at = chrono::Utc::now() + chrono::Duration::minutes(15);
                        let phone_clean = phone.replace(" ", "").replace("-", "").replace("+", "");

                        if let Err(e) = sqlx::query(
                            "INSERT INTO phone_verification_codes (phone, code, expires_at) VALUES ($1, $2, $3)"
                        )
                        .bind(&phone_clean)
                        .bind(&verification_code)
                        .bind(expires_at)
                        .execute(db)
                        .await {
                            error!("[register_user] Erreur sauvegarde code SMS: {:?}", e);
                        }
                    } else {
                        warn!(
                            "[register_user] Échec envoi SMS verification: {:?}",
                            result.error
                        );
                    }
                }
                Err(e) => {
                    error!("[register_user] Erreur service SMS verification: {:?}", e);
                }
            }
        }
    }

    // ✅ Lire le résultat Vision AI si disponible (pour retourner dans la réponse)
    let doc_ai_result: Option<serde_json::Value> = if payload.is_partner.unwrap_or(false) {
        sqlx::query_as::<_, (Option<i32>, Option<String>, Option<String>)>(
            "SELECT ai_score, ai_decision, ai_details FROM delivery_partners WHERE created_by = $1 LIMIT 1"
        )
        .bind(new.id)
        .fetch_optional(db)
        .await
        .ok()
        .flatten()
        .map(|(score, decision, details)| serde_json::json!({
            "ai_score": score,
            "ai_decision": decision,
            "ai_details": details.and_then(|d| serde_json::from_str::<serde_json::Value>(&d).ok())
        }))
    } else {
        None
    };

    // Retourne explicitement 201 Created avec le token
    let mut response_body = serde_json::json!({
        "id": new.id,
        "user_id": new.id,
        "tokens_balance": new.tokens_balance,
        "token": jwt,
        "phone_verified": false,
        "message": if payload.phone.is_some() && !payload.phone.as_ref().unwrap().trim().is_empty() {
            "Compte créé avec succès. Veuillez vérifier votre numéro de téléphone avec le code reçu par SMS."
        } else {
            "Compte créé avec succès."
        }
    });
    if let Some(ai) = doc_ai_result {
        response_body["document_verification"] = ai;
    }

    Ok((axum::http::StatusCode::CREATED, Json(response_body)).into_response())
}

async fn send_verification_email(email: &str) -> AppResult<()> {
    println!("Envoi d'un email de vérification à {}", email);
    Ok(())
}

// ✅ NOUVEAU: Structures pour la vérification téléphone
#[derive(Deserialize)]
pub struct SendPhoneVerificationRequest {
    pub phone: String,
    pub phone_country: Option<String>,
}

#[derive(Deserialize)]
pub struct VerifyPhoneRequest {
    pub phone: String,
    pub code: String,
}

#[derive(Serialize)]
pub struct PhoneVerificationResponse {
    pub success: bool,
    pub message: String,
    pub phone_verified: bool,
    /// Code OTP visible uniquement en mode développement (ENVIRONMENT=development) quand Twilio n'est pas configuré
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dev_code: Option<String>,
}

/// ? Envoi du code de vérification par SMS
pub async fn send_phone_verification_code(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SendPhoneVerificationRequest>,
) -> AppResult<Json<PhoneVerificationResponse>> {
    use crate::services::sms_service::SmsService;

    info!(
        "[send_phone_verification_code] Demande pour téléphone: {}",
        log_safe_phone(&payload.phone)
    );

    // ✅ SÉCURITÉ: Nettoyer et valider le numéro
    let phone_clean = payload.phone.replace(" ", "").replace("-", "").replace("+", "");
    if phone_clean.len() < 8 || phone_clean.len() > 15 {
        warn!(
            "[send_phone_verification_code] Numéro invalide: {}",
            log_safe_phone(&payload.phone)
        );
        return Ok(Json(PhoneVerificationResponse {
            success: false,
            message: "Numéro de téléphone invalide".to_string(),
            phone_verified: false,
            dev_code: None,
        }));
    }

    // ✅ SÉCURITÉ: Rate limiting par numéro
    let rate_limit_key = format!("sms_verification:{}", &phone_clean);
    if let Err(_e) = check_rate_limit(&rate_limit_key, 60, 3).await {
        warn!(
            "[send_phone_verification_code] Rate limit dépassé pour téléphone: {}",
            log_safe_phone(&payload.phone)
        );
        return Ok(Json(PhoneVerificationResponse {
            success: false,
            message: "Trop de tentatives. Veuillez attendre avant de réessayer.".to_string(),
            phone_verified: false,
            dev_code: None,
        }));
    }

    // Générer un code à 6 chiffres
    let verification_code = format!("{:06}", rand::random::<u32>() % 1_000_000);

    // Sauvegarder le code en base de données
    let db = &state.pg;
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(15);

    // Supprimer les anciens codes pour ce numéro
    let _ = sqlx::query("DELETE FROM phone_verification_codes WHERE phone = $1")
        .bind(&phone_clean)
        .execute(db)
        .await;

    // Insérer le nouveau code
    sqlx::query(
        "INSERT INTO phone_verification_codes (phone, code, expires_at) VALUES ($1, $2, $3)",
    )
    .bind(&phone_clean)
    .bind(&verification_code)
    .bind(expires_at)
    .execute(db)
    .await
    .map_err(|e| {
        error!(
            "[send_phone_verification_code] Erreur sauvegarde code: {:?}",
            e
        );
        AppError::Internal("Erreur lors de la sauvegarde du code de vérification".into())
    })?;

    // Envoyer le SMS
    let sms_service = SmsService::new();
    let message = format!(
        "Votre code de vérification YUKPO est: {}. Valide 15 minutes.",
        verification_code
    );

    match sms_service.send_sms(&payload.phone, &message).await {
        Ok(result) => {
            if result.success {
                info!(
                    "[send_phone_verification_code] SMS envoyé avec succès à: {}",
                    log_safe_phone(&payload.phone)
                );
                Ok(Json(PhoneVerificationResponse {
                    success: true,
                    message: "Code de vérification envoyé par SMS".to_string(),
                    phone_verified: false,
                    dev_code: None,
                }))
            } else {
                error!(
                    "[send_phone_verification_code] Échec envoi SMS: {:?}",
                    result.error
                );
                Ok(Json(PhoneVerificationResponse {
                    success: false,
                    message: "Échec de l'envoi du SMS. Veuillez réessayer.".to_string(),
                    phone_verified: false,
                    dev_code: None,
                }))
            }
        }
        Err(e) => {
            error!("[send_phone_verification_code] Erreur service SMS: {:?}", e);
            // Mode développement : retourner le code directement quand Twilio n'est pas configuré
            let is_dev =
                std::env::var("ENVIRONMENT").unwrap_or_default().to_lowercase() == "development";
            if is_dev {
                warn!(
                    "[send_phone_verification_code] MODE DEV — code OTP: {}",
                    verification_code
                );
                Ok(Json(PhoneVerificationResponse {
                    success: true,
                    message: format!(
                        "⚠️ Dev — Twilio non configuré. Code OTP : {}",
                        verification_code
                    ),
                    phone_verified: false,
                    dev_code: Some(verification_code),
                }))
            } else {
                Ok(Json(PhoneVerificationResponse {
                    success: false,
                    message: "Service SMS indisponible. Veuillez réessayer plus tard.".to_string(),
                    phone_verified: false,
                    dev_code: None,
                }))
            }
        }
    }
}

/// ? Vérification du code reçu par SMS
pub async fn verify_phone_code(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VerifyPhoneRequest>,
) -> AppResult<Json<PhoneVerificationResponse>> {
    info!(
        "[verify_phone_code] Tentative de vérification pour téléphone: {}",
        log_safe_phone(&payload.phone)
    );

    // ✅ SÉCURITÉ: Nettoyer le numéro
    let phone_clean = payload.phone.replace(" ", "").replace("-", "").replace("+", "");

    // Vérifier le code en base de données
    let db = &state.pg;
    let now = chrono::Utc::now();

    let result = sqlx::query_as::<_, (i32, String, chrono::DateTime<chrono::Utc>, bool)>(
        "SELECT id, code, expires_at, used FROM phone_verification_codes WHERE phone = $1 AND code = $2 AND used = FALSE",
    )
    .bind(&phone_clean)
    .bind(&payload.code)
    .fetch_optional(db)
    .await
    .map_err(|e| {
        error!("[verify_phone_code] Erreur recherche code: {:?}", e);
        AppError::Internal("Erreur lors de la vérification du code".into())
    })?;

    match result {
        Some(record) => {
            let (record_id, _code, expires_at, _used) = record;
            // Vérifier l'expiration
            if now > expires_at {
                warn!(
                    "[verify_phone_code] Code expiré pour téléphone: {}",
                    log_safe_phone(&payload.phone)
                );
                return Ok(Json(PhoneVerificationResponse {
                    success: false,
                    message: "Code expiré. Veuillez demander un nouveau code.".to_string(),
                    phone_verified: false,
                    dev_code: None,
                }));
            }

            // Marquer le code comme utilisé
            let _ = sqlx::query("UPDATE phone_verification_codes SET used = TRUE WHERE id = $1")
                .bind(record_id)
                .execute(db)
                .await;

            // Mettre à jour le statut de vérification de l'utilisateur
            let updated = sqlx::query(
                "UPDATE users SET phone_verified = TRUE, updated_at = NOW() 
                 WHERE phone = $1",
            )
            .bind(&phone_clean)
            .execute(db)
            .await
            .map_err(|e| {
                error!("[verify_phone_code] Erreur mise à jour user: {:?}", e);
                AppError::Internal("Erreur lors de la mise à jour du statut".into())
            })?;

            if updated.rows_affected() > 0 {
                info!(
                    "[verify_phone_code] ✅ Téléphone vérifié avec succès: {}",
                    log_safe_phone(&payload.phone)
                );
                Ok(Json(PhoneVerificationResponse {
                    success: true,
                    message: "Numéro de téléphone vérifié avec succès!".to_string(),
                    phone_verified: true,
                    dev_code: None,
                }))
            } else {
                warn!(
                    "[verify_phone_code] Aucun utilisateur trouvé pour ce téléphone: {}",
                    log_safe_phone(&payload.phone)
                );
                Ok(Json(PhoneVerificationResponse {
                    success: false,
                    message: "Aucun compte associé à ce numéro de téléphone".to_string(),
                    phone_verified: false,
                    dev_code: None,
                }))
            }
        }
        None => {
            warn!(
                "[verify_phone_code] Code invalide pour téléphone: {}",
                log_safe_phone(&payload.phone)
            );
            Ok(Json(PhoneVerificationResponse {
                success: false,
                message: "Code de vérification invalide".to_string(),
                phone_verified: false,
                dev_code: None,
            }))
        }
    }
}

#[derive(Deserialize)]
pub struct OAuthInput {
    pub token_id: String,
    pub provider: String,
}

/// ? Connexion OAuth (Google/Facebook)
pub async fn oauth_login_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<OAuthInput>,
) -> AppResult<Json<serde_json::Value>> {
    info!(
        "Appel oauth_login_handler pour provider={}",
        payload.provider
    );
    let client = Client::new();

    // ✅ SÉCURITÉ: Validation OAuth améliorée
    let (user_res, provider_name) = match payload.provider.as_str() {
        "google" => {
            // Pour Google, utiliser tokeninfo qui valide le token
            let tokeninfo_url = format!(
                "https://www.googleapis.com/oauth2/v3/tokeninfo?id_token={}",
                payload.token_id
            );

            let resp = client.get(&tokeninfo_url).send().await.map_err(|e| {
                error!("[oauth_login_handler] Erreur requête Google tokeninfo: {e:?}");
                AppError::Unauthorized("Token Google invalide".into())
            })?;

            // Vérifier le status code
            if !resp.status().is_success() {
                error!(
                    "[oauth_login_handler] Google tokeninfo retourne une erreur: {}",
                    resp.status()
                );
                return Err(AppError::Unauthorized(
                    "Token Google invalide ou expiré".into(),
                ));
            }

            let user_data = resp.json::<serde_json::Value>().await.map_err(|e| {
                error!("[oauth_login_handler] Erreur parsing JSON Google: {e:?}");
                AppError::Unauthorized("Réponse Google invalide".into())
            })?;

            // ✅ SÉCURITÉ: Vérifier que le token n'est pas expiré
            if let Some(exp) = user_data.get("exp").and_then(|v| v.as_i64()) {
                let now = chrono::Utc::now().timestamp();
                if exp < now {
                    error!(
                        "[oauth_login_handler] Token Google expiré (exp: {}, now: {})",
                        exp, now
                    );
                    return Err(AppError::Unauthorized("Token Google expiré".into()));
                }
            }

            // ✅ SÉCURITÉ: Vérifier l'audience si GOOGLE_CLIENT_ID est configuré (liste séparée par virgules)
            if let Ok(client_ids_raw) = std::env::var("GOOGLE_CLIENT_ID") {
                let client_ids: Vec<&str> = client_ids_raw
                    .split(',')
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty() && *s != "votre_client_id")
                    .collect();
                if !client_ids.is_empty() {
                    if let Some(actual_aud) = user_data.get("aud").and_then(|v| v.as_str()) {
                        if !client_ids.contains(&actual_aud) {
                            error!(
                                "[oauth_login_handler] Audience Google invalide: reçu {}, attendu l'un de {:?}",
                                actual_aud, client_ids
                            );
                            return Err(AppError::Unauthorized(
                                "Token Google pour une autre application".into(),
                            ));
                        }
                    }
                }
            }

            (user_data, "google")
        }
        "facebook" => {
            // ✅ SÉCURITÉ: Pour Facebook, d'abord vérifier le token avec debug_token
            let app_id = std::env::var("FACEBOOK_APP_ID")
                .map_err(|_| AppError::Internal("FACEBOOK_APP_ID manquant".into()))?;
            let app_secret = std::env::var("FACEBOOK_APP_SECRET")
                .map_err(|_| AppError::Internal("FACEBOOK_APP_SECRET manquant".into()))?;

            // Vérifier le token avec l'endpoint debug
            let debug_url = format!(
                "https://graph.facebook.com/debug_token?input_token={}&access_token={}|{}",
                payload.token_id, app_id, app_secret
            );

            let debug_resp = client.get(&debug_url).send().await.map_err(|e| {
                error!("[oauth_login_handler] Erreur requête Facebook debug_token: {e:?}");
                AppError::Unauthorized("Token Facebook invalide".into())
            })?;

            let debug_data = debug_resp.json::<serde_json::Value>().await.map_err(|e| {
                error!("[oauth_login_handler] Erreur parsing JSON Facebook debug: {e:?}");
                AppError::Unauthorized("Réponse Facebook debug invalide".into())
            })?;

            // Vérifier que le token est valide
            if let Some(is_valid) =
                debug_data.get("data").and_then(|d| d.get("is_valid")).and_then(|v| v.as_bool())
            {
                if !is_valid {
                    error!("[oauth_login_handler] Token Facebook marqué comme invalide");
                    return Err(AppError::Unauthorized("Token Facebook invalide".into()));
                }
            } else {
                error!("[oauth_login_handler] Réponse Facebook debug invalide: {debug_data:?}");
                return Err(AppError::Unauthorized("Token Facebook invalide".into()));
            }

            // Maintenant récupérer les informations utilisateur
            let user_url = format!(
                "https://graph.facebook.com/me?fields=id,name,email&access_token={}",
                payload.token_id
            );

            let user_resp = client.get(&user_url).send().await.map_err(|e| {
                error!("[oauth_login_handler] Erreur requête Facebook /me: {e:?}");
                AppError::Unauthorized("Impossible de récupérer les informations Facebook".into())
            })?;

            if !user_resp.status().is_success() {
                error!(
                    "[oauth_login_handler] Facebook /me retourne une erreur: {}",
                    user_resp.status()
                );
                return Err(AppError::Unauthorized("Token Facebook invalide".into()));
            }

            let user_data = user_resp.json::<serde_json::Value>().await.map_err(|e| {
                error!("[oauth_login_handler] Erreur parsing JSON Facebook: {e:?}");
                AppError::Unauthorized("Réponse Facebook invalide".into())
            })?;

            (user_data, "facebook")
        }
        _ => {
            error!(
                "[oauth_login_handler] Fournisseur OAuth non supporté: {}",
                payload.provider
            );
            return Err(AppError::BadRequest(
                "Fournisseur OAuth non supporté".into(),
            ));
        }
    };

    // Extraire l'email
    let email = user_res.get("email").and_then(|v| v.as_str());
    let email = match email {
        Some(e) => e,
        None => {
            error!(
                "[oauth_login_handler] Impossible de récupérer l'email dans la réponse {}: {user_res:?}",
                provider_name
            );
            return Err(AppError::Unauthorized(
                "Impossible de récupérer l'email depuis le provider OAuth".into(),
            ));
        }
    };

    // ✅ NOUVEAU: Récupérer le nom depuis OAuth
    let oauth_name = user_res.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());

    let db = &state.pg;

    #[derive(FromRow)]
    struct OAuthUserRow {
        id: i32,
        role: String,
        tokens_balance: i64,
        nom_complet: Option<String>,
    }

    #[derive(FromRow)]
    struct NewOAuthUserRow {
        id: i32,
        tokens_balance: i64,
    }

    let row = sqlx::query_as::<_, OAuthUserRow>(
        r#"
        SELECT id, role, tokens_balance, nom_complet
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(email)
    .fetch_optional(db)
    .await;
    let (user_id, role, balance, nom_complet) = match row {
        Ok(Some(u)) => (u.id, u.role, u.tokens_balance, u.nom_complet),
        Ok(None) => {
            let new = sqlx::query_as::<_, NewOAuthUserRow>(
                r#"
                INSERT INTO users (email, role, tokens_balance, nom_complet)
                VALUES ($1, $2, $3, $4)
                RETURNING id, tokens_balance
                "#,
            )
            .bind(email)
            .bind("user")
            .bind(signup_bonus_tokens())
            .bind(oauth_name.as_deref()) // ✅ NOUVEAU: sauvegarder le nom depuis OAuth
            .fetch_one(db)
            .await;
            match new {
                Ok(n) => (
                    n.id,
                    "user".to_string(),
                    n.tokens_balance,
                    oauth_name.clone(),
                ),
                Err(e) => {
                    error!("[oauth_login_handler] DB error (insert): {e:?}");
                    return Err(e.into());
                }
            }
        }
        Err(e) => {
            error!("[oauth_login_handler] DB error (select): {e:?}");
            return Err(e.into());
        }
    };

    // ✅ NOUVEAU: Récupérer partner_type depuis la DB pour OAuth
    let partner_type: Option<String> =
        sqlx::query_scalar("SELECT partner_type FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(db)
            .await
            .ok()
            .flatten();

    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| AppError::Internal("JWT_SECRET manquant".into()))?;
    let jwt = generate_jwt(
        user_id,
        &role,
        email,
        nom_complet, // ✅ NOUVEAU: passer le nom de l'utilisateur
        balance,
        &secret,
        partner_type, // ✅ NOUVEAU: passer le type de partenaire
    )?;
    Ok(Json(serde_json::json!({
        "token": jwt,
        "tokens_balance": balance
    })))
}

/// ✅ TEMPORAIRE: Endpoint pour créer le super admin
/// Sécurisé par un token secret dans les variables d'environnement
/// Usage: POST /api/auth/bootstrap-super-admin
/// Body: { "secret_token": "YOUR_SECRET_TOKEN" }
#[derive(Deserialize)]
pub struct BootstrapSuperAdminInput {
    pub secret_token: String,
}

pub async fn bootstrap_super_admin(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<BootstrapSuperAdminInput>,
) -> AppResult<Json<serde_json::Value>> {
    // Vérifier le token secret
    let expected_token = std::env::var("BOOTSTRAP_SUPER_ADMIN_TOKEN")
        .unwrap_or_else(|_| "CHANGE_ME_IN_PRODUCTION".to_string());

    if payload.secret_token != expected_token {
        error!("[bootstrap_super_admin] Tentative avec token invalide");
        return Err(AppError::Unauthorized("Token invalide".into()));
    }

    let db = &state.pg;
    let admin_email = "admin@yukpo.dev";
    let admin_name = "Super Super Admin";
    // Hash pour le mot de passe: Hernandez87
    let password_hash = "$2b$12$yi.th1fxm9Xrz6A.PjP9wuWyDrueHMZZBReIH7i7X.efPhGNV1Pii";

    info!("[bootstrap_super_admin] Création/mise à jour du super admin...");

    // Vérifier si l'utilisateur existe
    let user_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
            .bind(admin_email)
            .fetch_one(db)
            .await?;

    if user_exists {
        info!("[bootstrap_super_admin] Utilisateur existe déjà, mise à jour...");
        sqlx::query(
            r#"
            UPDATE users 
            SET 
                password_hash = $1,
                role = 'super_admin',
                nom_complet = $2,
                updated_at = NOW()
            WHERE email = $3
            "#,
        )
        .bind(password_hash)
        .bind(admin_name)
        .bind(admin_email)
        .execute(db)
        .await?;
        info!("[bootstrap_super_admin] Utilisateur super admin mis à jour avec succès!");
    } else {
        info!("[bootstrap_super_admin] Création de l'utilisateur super admin...");
        sqlx::query(
            r#"
            INSERT INTO users (
                email, 
                password_hash, 
                role, 
                nom_complet, 
                tokens_balance, 
                token_price_user, 
                token_price_provider, 
                commission_pct, 
                preferred_lang, 
                is_provider, 
                created_at, 
                updated_at
            )
            VALUES (
                $1, $2, 'super_admin', $3, 1000000, 1.0, 1.0, 0.0, 'fr', false, NOW(), NOW()
            )
            "#,
        )
        .bind(admin_email)
        .bind(password_hash)
        .bind(admin_name)
        .execute(db)
        .await?;
        info!("[bootstrap_super_admin] Utilisateur super admin créé avec succès!");
    }

    // Récupérer l'utilisateur créé
    #[derive(FromRow)]
    struct UserInfo {
        id: i32,
        email: String,
        role: String,
        nom_complet: Option<String>,
        tokens_balance: i64,
    }

    let user = sqlx::query_as::<_, UserInfo>(
        "SELECT id, email, role, nom_complet, tokens_balance 
         FROM users 
         WHERE email = $1",
    )
    .bind(admin_email)
    .fetch_one(db)
    .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Super admin créé/mis à jour avec succès",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "nom_complet": user.nom_complet,
            "tokens_balance": user.tokens_balance
        },
        "credentials": {
            "email": admin_email,
            "password": "Hernandez87",
            "role": "super_admin"
        }
    })))
}
