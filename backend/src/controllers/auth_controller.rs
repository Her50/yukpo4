use axum::{
    extract::State,
    response::{IntoResponse, Json},
};
use bcrypt::{hash, verify};
use log::{error, info};
use reqwest::Client;
use serde::Deserialize;
use sqlx::FromRow;
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    utils::{
        jwt_manager::generate_jwt,
        sanitize_logs::log_safe_email,
        validation::{validate_email, validate_name, validate_password_strength},
    },
};

use crate::state::AppState;

const INITIAL_TOKENS: i64 = 100000;

#[derive(Deserialize)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

/// ? Connexion avec email/mot de passe
pub async fn login_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginInput>,
) -> AppResult<Json<serde_json::Value>> {
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
    if !verify(&payload.password, &user.password_hash)? {
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
                    "Votre compte partenaire est en attente de validation par un administrateur".into()
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
    let mut response_data = serde_json::json!({
        "token": jwt,
        "tokens_balance": user.tokens_balance
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
    Ok(Json(response_data))
}

#[derive(Deserialize)]
pub struct RegisterInput {
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub name: Option<String>, // Support pour le champ 'name' du frontend
    pub email: String,
    pub password: String,
    pub lang: Option<String>,
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
}

/// ? Inscription manuelle
pub async fn register_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterInput>,
) -> impl IntoResponse {
    // ✅ SÉCURITÉ: Valider les entrées
    validate_email(&payload.email)?;
    validate_password_strength(&payload.password)?;

    // Valider les noms si fournis
    if let Some(ref nom) = payload.nom {
        validate_name(nom, "Nom")?;
    }
    if let Some(ref prenom) = payload.prenom {
        validate_name(prenom, "Prénom")?;
    }
    if let Some(ref name) = payload.name {
        validate_name(name, "Nom complet")?;
    }

    // ✅ NOUVEAU: Déterminer le rôle
    let user_role = if payload.is_partner.unwrap_or(false) {
        "partenaire"
    } else {
        "user"
    };
    
    // ✅ RENFORCÉ: Validation stricte du partner_type - OBLIGATOIRE pour un partenaire
    if user_role == "partenaire" {
        let valid_types = ["livraison", "livraison_courses_marche", "pharmacie", "hopital", "laboratoire", "agence de voyage", 
                          "demenagement", "transport", "assureur", "supermarche", "telecom",
                          "etablissementscolaire", "banquesang", "chauffeur"];
        
        // ✅ CORRIGÉ: Ajouter des logs de debug pour identifier le problème
        info!("[register_user] Validation partenaire - partner_type: {:?}, partner_name: {:?}", 
              payload.partner_type, payload.partner_name.as_ref().map(|s| if s.len() > 50 { format!("{}...", &s[..50]) } else { s.clone() }));
        
        // ✅ Validation stricte: partner_type doit être présent et non vide
        match &payload.partner_type {
            Some(pt) if !pt.trim().is_empty() => {
                let pt_trimmed = pt.trim();
                if !valid_types.iter().any(|&vt| vt == pt_trimmed) {
                    error!("[register_user] ❌ Type de partenaire invalide: '{}'. Types valides: {}", 
                           pt_trimmed, valid_types.join(", "));
                    return Err(AppError::BadRequest(
                        format!("Type de partenaire invalide: '{}'. Types valides: {}", 
                               pt_trimmed, valid_types.join(", "))
                    ));
                }
            }
            _ => {
                error!("[register_user] ❌ partner_type manquant ou vide pour inscription partenaire");
                return Err(AppError::BadRequest(
                    "Le type d'établissement est obligatoire pour créer un compte partenaire. Veuillez sélectionner un type d'établissement.".into()
                ));
            }
        }
        
        if payload.partner_name.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
            error!("[register_user] ❌ partner_name manquant ou vide pour inscription partenaire");
            return Err(AppError::BadRequest("partner_name est requis pour un partenaire".into()));
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
        error!(
            "[register_user] Email déjà utilisé: {}",
            log_safe_email(&payload.email)
        );
        // ✅ AMÉLIORÉ: Message d'erreur plus informatif pour les partenaires
        let error_message = if payload.role.as_deref() == Some("partenaire") {
            "Cet email est déjà utilisé. Veuillez vous connecter avec cet email ou contacter le support pour obtenir le statut partenaire.".to_string()
        } else {
            "Cet email est déjà utilisé. Veuillez vous connecter ou utiliser un autre email.".to_string()
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

    // Calculer le nom_complet a partir de nom, prenom ou name
    let nom_complet = match (&payload.nom, &payload.prenom, &payload.name) {
        (Some(n), Some(p), _) if !n.trim().is_empty() && !p.trim().is_empty() => {
            Some(format!("{} {}", n.trim(), p.trim()))
        }
        (Some(n), _, _) if !n.trim().is_empty() => Some(n.trim().to_string()),
        (_, Some(p), _) if !p.trim().is_empty() => Some(p.trim().to_string()),
        (_, _, Some(name)) if !name.trim().is_empty() => Some(name.trim().to_string()),
        _ => None,
    };

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
    .bind(INITIAL_TOKENS)
    .bind(payload.lang.as_deref().unwrap_or("fr"))
    .bind(default_token_price_user)
    .bind(default_token_price_provider)
    .bind(default_commission_pct)
    .bind(payload.nom.as_deref())
    .bind(payload.prenom.as_deref())
    .bind(nom_complet.as_deref())
    .bind(avatar_url.as_deref())
    .bind(payload.partner_type.as_deref())
    .bind(if user_role == "partenaire" { Some("pending") } else { None::<&str> })
    .fetch_one(db)
    .await;
    let new = match new {
        Ok(n) => n,
        Err(e) => {
            error!("[register_user] DB error (insert): {e:?}");
            return Err(e.into());
        }
    };
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
                let decoded = STANDARD.decode(base64_data)
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
                let storage_key = format!("partners/{}/logo_{}.{}", new.id, Uuid::new_v4(), mime_type.1);
                
                // Uploader vers S3/Wasabi ou stockage local
                match state.media_storage.store_bytes(&decoded, &storage_key, Some(mime_type.0)).await {
                    Ok(location) => {
                        logo_url = Some(location.storage_path);
                        info!("[register_user] ✅ Logo partenaire uploadé: {}", logo_url.as_ref().unwrap());
                    }
                    Err(e) => {
                        error!("[register_user] ⚠️ Erreur upload logo partenaire: {}. Le partenaire sera créé sans logo.", e);
                        // Ne pas bloquer l'inscription si l'upload du logo échoue
                    }
                }
            }
        }
        
        // ✅ NOUVEAU: Créer l'enregistrement dans delivery_partners
        let partner_name = payload.partner_name.as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::BadRequest("partner_name est requis pour un partenaire".into()))?;
        
        // ✅ CORRIGÉ: Utiliser la valeur par défaut de la base de données si country est vide
        let partner_country = payload.partner_country.as_deref()
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
                        'assureur', 'supermarche', 'telecom', 'chauffeur'
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
        
        // ✅ Vérifier si un partenaire existe déjà pour cet utilisateur
        let existing_partner: Option<i32> = match sqlx::query_scalar(
            "SELECT id FROM delivery_partners WHERE created_by = $1 LIMIT 1"
        )
        .bind(new.id)
        .fetch_optional(db)
        .await {
            Ok(result) => result,
            Err(e) => {
                error!("[register_user] ❌ Erreur lors de la vérification du partenaire existant: {}", e);
                return Err(AppError::Internal(format!("Erreur lors de la vérification du partenaire: {}", e)));
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
                "#
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
                info!("[register_user] ✅ Partenaire créé dans delivery_partners pour user_id={}", new.id);
            }
            Err(e) => {
                error!("[register_user] ❌ Erreur création partenaire dans delivery_partners: {}", e);
                // ✅ CORRIGÉ: Retourner une erreur 500 si la création du partenaire échoue
                // car l'utilisateur a été créé mais le partenaire est requis pour un compte partenaire
                return Err(AppError::Internal(format!(
                    "Erreur lors de la création du partenaire: {}. Veuillez réessayer ou contacter le support.",
                    e
                )));
            }
        }
        } // Fin du bloc de création du partenaire
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

    // Retourne explicitement 201 Created avec le token
    return Ok((
        axum::http::StatusCode::CREATED,
        Json(serde_json::json!({
            "id": new.id,
            "tokens_balance": new.tokens_balance,
            "token": jwt,
            "message": "utiliseateur inscrit avec succès"
        })),
    )
        .into_response());
}

async fn send_verification_email(email: &str) -> AppResult<()> {
    println!("Envoi d'un email de vérification à {}", email);
    Ok(())
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

            // ✅ SÉCURITÉ: Vérifier l'audience (optionnel si GOOGLE_CLIENT_ID est défini)
            if let Ok(expected_aud) = std::env::var("GOOGLE_CLIENT_ID") {
                if let Some(actual_aud) = user_data.get("aud").and_then(|v| v.as_str()) {
                    if actual_aud != expected_aud {
                        error!(
                            "[oauth_login_handler] Audience Google invalide: attendu {}, reçu {}",
                            expected_aud, actual_aud
                        );
                        return Err(AppError::Unauthorized(
                            "Token Google pour une autre application".into(),
                        ));
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
            if let Some(is_valid) = debug_data
                .get("data")
                .and_then(|d| d.get("is_valid"))
                .and_then(|v| v.as_bool())
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
    let oauth_name = user_res
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

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
            .bind(INITIAL_TOKENS)
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
    let partner_type: Option<String> = sqlx::query_scalar(
        "SELECT partner_type FROM users WHERE id = $1"
    )
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
