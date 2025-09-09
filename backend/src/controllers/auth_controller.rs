use std::sync::Arc;
use axum::{extract::State, response::{IntoResponse, Json}};
use bcrypt::{hash, verify, DEFAULT_COST};
use serde::Deserialize;
use reqwest::Client;
use log::{info, error};

use crate::{
    core::types::{AppError, AppResult},
    utils::jwt_manager::generate_jwt,
};

use crate::state::AppState;

const INITIAL_TOKENS: i64 = 2000;

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
    info!("Appel login_handler pour email={}", payload.email);
    let db = &state.pg;
    let user = sqlx::query!(
        r#"
        SELECT id, email, password_hash, role, tokens_balance
        FROM users
        WHERE email = $1
        "#,
        payload.email
    )
    .fetch_optional(db)
    .await;
    let user = match user {
        Ok(Some(u)) => u,
        Ok(None) => {
            error!("[login_handler] Email introuvable: {}", payload.email);
            return Err(AppError::Unauthorized("Email introuvable".into()));
        }
        Err(e) => {
            error!("[login_handler] DB error: {e:?}");
            return Err(e.into());
        }
    };
    if !verify(&payload.password, &user.password_hash)? {
        error!("[login_handler] Mot de passe incorrect pour email={}", payload.email);
        return Err(AppError::Unauthorized("Mot de passe incorrect".into()));
    }
    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| AppError::Internal("JWT_SECRET manquant".into()))?;
    let jwt = generate_jwt(
        user.id,
        &user.role,
        &user.email,
        user.tokens_balance,
        &secret,
    )?;
    Ok(Json(serde_json::json!({
        "token": jwt,
        "tokens_balance": user.tokens_balance
    })))
}

#[derive(Deserialize)]
pub struct RegisterInput {
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub email: String,
    pub password: String,
    pub lang: Option<String>,
}

/// ? Inscription manuelle
pub async fn register_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterInput>,
) -> impl IntoResponse {
    info!("Appel register_user pour email={}", payload.email);
    let db = &state.pg;
    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)",
        payload.email
    )
    .fetch_one(db)
    .await;
    let exists = match exists {
        Ok(val) => val,
        Err(e) => {
            error!("[register_user] DB error (check exists): {e:?}");
            return Err(e.into());
        }
    };
    if exists.unwrap_or(false) {
        error!("[register_user] Email déjà utilisé: {}", payload.email);
        return Err(AppError::Conflict("Email déjà utilisé".into()));
    }
    let password_hash = hash(&payload.password, DEFAULT_COST)?;
    // Valeurs par défaut pour les nouveaux utilisateurs
    let default_token_price_user = 1.0_f64;
    let default_token_price_provider = 1.0_f64;
    let default_commission_pct = 0.0_f32;
    
    // Calculer le nom_complet à partir de nom et prenom
    let nom_complet = match (&payload.nom, &payload.prenom) {
        (Some(n), Some(p)) if !n.trim().is_empty() && !p.trim().is_empty() => 
            Some(format!("{} {}", n.trim(), p.trim())),
        (Some(n), _) if !n.trim().is_empty() => Some(n.trim().to_string()),
        (_, Some(p)) if !p.trim().is_empty() => Some(p.trim().to_string()),
        _ => None,
    };
    
    // Créer l'avatar_url si on a un nom
    let avatar_url = nom_complet.as_ref().map(|name| 
        format!("https://ui-avatars.com/api/?name={}&background=random&color=fff&size=200", 
                urlencoding::encode(name))
    );
    
    let new = sqlx::query!(
        r#"
        INSERT INTO users (
            email, password_hash, role, tokens_balance, preferred_lang,
            token_price_user, token_price_provider, commission_pct,
            nom, prenom, nom_complet, avatar_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, tokens_balance
        "#,
        payload.email,
        password_hash,
        "user",
        INITIAL_TOKENS,
        payload.lang.unwrap_or_else(|| "fr".to_string()),
        default_token_price_user,
        default_token_price_provider,
        default_commission_pct,
        payload.nom.as_deref(),
        payload.prenom.as_deref(),
        nom_complet.as_deref(),
        avatar_url.as_deref(),
    )
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
    // Retourne explicitement 201 Created
    return Ok((axum::http::StatusCode::CREATED, Json(serde_json::json!({
        "id": new.id,
        "tokens_balance": new.tokens_balance,
        "message": "Utilisateur inscrit avec succès"
    }))).into_response());
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
    info!("Appel oauth_login_handler pour provider={}", payload.provider);
    let client = Client::new();
    let user_info_url = match payload.provider.as_str() {
        "google" => format!(
            "https://www.googleapis.com/oauth2/v3/tokeninfo?id_token={}",
            payload.token_id
        ),
        "facebook" => format!(
            "https://graph.facebook.com/me?fields=id,name,email&access_token={}",
            payload.token_id
        ),
        _ => {
            error!("[oauth_login_handler] Fournisseur OAuth non supporté: {}", payload.provider);
            return Err(AppError::BadRequest("Fournisseur OAuth non supporté".into()));
        }
    };
    let user_res = client
        .get(&user_info_url)
        .send()
        .await;
    let user_res = match user_res {
        Ok(resp) => resp,
        Err(e) => {
            error!("[oauth_login_handler] Erreur requ?te HTTP: {e:?}");
            return Err(e.into());
        }
    };
    let user_res = user_res.json::<serde_json::Value>().await;
    let user_res = match user_res {
        Ok(val) => val,
        Err(e) => {
            error!("[oauth_login_handler] Erreur parsing JSON: {e:?}");
            return Err(e.into());
        }
    };
    let email = user_res
        .get("email")
        .and_then(|v| v.as_str());
    let email = match email {
        Some(e) => e,
        None => {
            error!("[oauth_login_handler] Impossible de rÃ©cupÃ©rer lÃ©email dans la rÃ©ponse: {user_res:?}");
            return Err(AppError::Unauthorized("Impossible de rÃ©cupÃ©rer lÃ©email".into()));
        }
    };
    let db = &state.pg;
    let row = sqlx::query!(
        r#"
        SELECT id, role, tokens_balance
        FROM users
        WHERE email = $1
        "#,
        email
    )
    .fetch_optional(db)
    .await;
    let (user_id, role, balance) = match row {
        Ok(Some(u)) => (u.id, u.role, u.tokens_balance),
        Ok(None) => {
            let new = sqlx::query!(
                r#"
                INSERT INTO users (email, role, tokens_balance)
                VALUES ($1, $2, $3)
                RETURNING id, tokens_balance
                "#,
                email,
                "user",
                INITIAL_TOKENS
            )
            .fetch_one(db)
            .await;
            match new {
                Ok(n) => (n.id, "user".to_string(), n.tokens_balance),
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
        balance,
        &secret,
    )?;
    Ok(Json(serde_json::json!({
        "token": jwt,
        "tokens_balance": balance
    })))
}

