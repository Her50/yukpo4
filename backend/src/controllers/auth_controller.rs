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
    }

    let user = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT id, email, password_hash, role, tokens_balance, nom_complet
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
    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| AppError::Internal("JWT_SECRET manquant".into()))?;
    let jwt = generate_jwt(
        user.id,
        &user.role,
        &user.email,
        user.nom_complet.clone(), // ✅ NOUVEAU: passer le nom de l'utilisateur
        user.tokens_balance,
        &secret,
    )?;
    let response_data = serde_json::json!({
        "token": jwt,
        "tokens_balance": user.tokens_balance
    });
    info!(
        "[login_handler] ✅ Réponse login générée: token présent={}, tokens_balance={}",
        !response_data["token"].as_str().unwrap_or("").is_empty(),
        response_data["tokens_balance"]
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

    // ✅ SÉCURITÉ: Logger l'email masqué
    info!(
        "Appel register_user pour email={}",
        log_safe_email(&payload.email)
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
        return Err(AppError::Conflict("Email déjà utilisé".into()));
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
            nom, prenom, nom_complet, avatar_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, tokens_balance
        "#,
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .bind("user")
    .bind(INITIAL_TOKENS)
    .bind(payload.lang.as_deref().unwrap_or("fr"))
    .bind(default_token_price_user)
    .bind(default_token_price_provider)
    .bind(default_commission_pct)
    .bind(payload.nom.as_deref())
    .bind(payload.prenom.as_deref())
    .bind(nom_complet.as_deref())
    .bind(avatar_url.as_deref())
    .fetch_one(db)
    .await;
    let new = match new {
        Ok(n) => n,
        Err(e) => {
            error!("[register_user] DB error (insert): {e:?}");
            return Err(e.into());
        }
    };
    if let Err(e) = send_verification_email(&payload.email).await {
        error!("[register_user] Erreur envoi email: {e:?}");
    }
    // Générer un JWT pour l'utiliseateur nouvellement inscrit
    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| AppError::Internal("JWT_SECRET manquant".into()))?;
    let jwt = generate_jwt(
        new.id,
        "user",
        &payload.email,
        nom_complet.clone(), // ✅ NOUVEAU: passer le nom de l'utilisateur
        new.tokens_balance,
        &secret,
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
    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| AppError::Internal("JWT_SECRET manquant".into()))?;
    let jwt = generate_jwt(
        user_id,
        &role,
        email,
        nom_complet, // ✅ NOUVEAU: passer le nom de l'utilisateur
        balance,
        &secret,
    )?;
    Ok(Json(serde_json::json!({
        "token": jwt,
        "tokens_balance": balance
    })))
}
