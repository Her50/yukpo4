use std::sync::Arc;
use axum::{
    extract::{Extension, State, Path},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use log::{info, error};

use crate::{
    core::types::AppResult,
    middlewares::jwt::AuthenticatedUser,
    models::user_model::User,
};
use crate::state::AppState;

#[derive(Serialize)]
pub struct BalanceResponse {
    pub tokens_balance: i64,
}

/// ? GET /users/balance ? renvoie le solde de tokens
pub async fn get_user_balance(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<BalanceResponse>> {
    info!("Appel get_user_balance pour user_id={}", user.id);
    let row = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.pg)
        .await;
    let row = match row {
        Ok(r) => r,
        Err(e) => {
            error!("[get_user_balance] DB error: {e:?}");
            return Err(e.into());
        }
    };
    let tokens_balance: i64 = match row.try_get("tokens_balance") {
        Ok(t) => t,
        Err(e) => {
            error!("[get_user_balance] try_get error: {e:?}");
            return Err(e.into());
        }
    };
    Ok(Json(BalanceResponse { tokens_balance }))
}

#[derive(Deserialize)]
pub struct PurchaseRequest {
    pub pack_id: i32,
}

#[derive(Deserialize)]
pub struct DeductBalanceRequest {
    pub amount: i64,
    pub reason: String,
}

#[derive(Serialize)]
pub struct PurchaseResponse {
    pub new_balance: i64,
}

#[derive(Serialize)]
pub struct DeductBalanceResponse {
    pub new_balance: i64,
    pub amount_deducted: i64,
}

/// ? POST /users/purchase_pack ? crédite un pack de tokens
pub async fn purchase_pack(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<PurchaseRequest>,
) -> AppResult<Json<PurchaseResponse>> {
    info!("Appel purchase_pack pour user_id={}, pack_id={}", user.id, req.pack_id);
    let row = sqlx::query("SELECT tokens FROM token_packs WHERE id = $1")
        .bind(req.pack_id)
        .fetch_one(&state.pg)
        .await;
    let row = match row {
        Ok(r) => r,
        Err(e) => {
            error!("[purchase_pack] DB error (token_packs): {e:?}");
            return Err(e.into());
        }
    };
    let tokens: i64 = match row.try_get("tokens") {
        Ok(t) => t,
        Err(e) => {
            error!("[purchase_pack] DB error (try_get tokens): {e:?}");
            return Err(e.into());
        }
    };
    let result = sqlx::query("UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2 RETURNING tokens_balance")
        .bind(tokens)
        .bind(user.id)
        .fetch_one(&state.pg)
        .await;
    let result = match result {
        Ok(r) => r,
        Err(e) => {
            error!("[purchase_pack] DB error (update users): {e:?}");
            return Err(e.into());
        }
    };
    let new_balance: i64 = match result.try_get("tokens_balance") {
        Ok(nb) => nb,
        Err(e) => {
            error!("[purchase_pack] DB error (try_get new_balance): {e:?}");
            return Err(e.into());
        }
    };
    Ok(Json(PurchaseResponse { new_balance }))
}

/// ? POST /users/deduct-balance ? déduit un montant du solde
pub async fn deduct_balance(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<DeductBalanceRequest>,
) -> AppResult<Json<DeductBalanceResponse>> {
    info!("Appel deduct_balance pour user_id={}, amount={}, reason={}", user.id, req.amount, req.reason);
    
    // Vérifier le solde actuel
    let current_balance_result = sqlx::query!("SELECT tokens_balance FROM users WHERE id = $1", user.id)
        .fetch_one(&state.pg)
        .await;
    
    let current_balance = match current_balance_result {
        Ok(row) => row.tokens_balance,
        Err(e) => {
            error!("[deduct_balance] Erreur récupération solde: {e:?}");
            return Err(e.into());
        }
    };
    
    // Vérifier si le solde est suffisant
    if current_balance < req.amount {
        error!("[deduct_balance] Solde insuffisant: {} < {}", current_balance, req.amount);
        return Err(crate::core::types::AppError::BadRequest(format!("Solde insuffisant: {} < {}", current_balance, req.amount)));
    }
    
    // Calculer le nouveau solde
    let new_balance = current_balance - req.amount;
    
    // Mettre à jour le solde
    let update_result = sqlx::query!(
        "UPDATE users SET tokens_balance = $1 WHERE id = $2 RETURNING tokens_balance",
        new_balance,
        user.id
    )
    .fetch_one(&state.pg)
    .await;
    
    match update_result {
        Ok(row) => {
            info!("[deduct_balance] Solde mis à jour pour user_id={}: {} -> {} (déduction: {})", 
                user.id, current_balance, row.tokens_balance, req.amount);
            Ok(Json(DeductBalanceResponse { 
                new_balance: row.tokens_balance, 
                amount_deducted: req.amount 
            }))
        },
        Err(e) => {
            error!("[deduct_balance] Erreur mise à jour solde: {e:?}");
            Err(e.into())
        }
    }
}

/// ? GET /user/me ? profil complet
pub async fn get_user_profile(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<User>> {
    info!("Appel get_user_profile pour user_id={}", user.id);
    let result = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, role, is_provider, tokens_balance,
               token_price_user, token_price_provider, commission_pct,
               preferred_lang, created_at, updated_at, gps, gps_consent,
               nom, prenom, nom_complet, photo_profil, avatar_url
        FROM users WHERE id = $1
        "#
    )
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;

    match result {
        Ok(profile) => Ok(Json(profile)),
        Err(e) => {
            error!("[get_user_profile] DB error: {e:?}");
            Err(crate::core::types::AppError::Database(format!("DB error: {e}")))
        }
    }
}

#[derive(Deserialize)]
pub struct UpdateProfileInput {
    pub preferred_lang: Option<String>,
}

/// ? PUT /user/me ? mise à jour du profil
pub async fn update_user_profile(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(input): Json<UpdateProfileInput>,
) -> AppResult<Json<User>> {
    info!("Appel update_user_profile pour user_id={}", user.id);
    let updated = sqlx::query_as::<_, User>(
        r#"
        UPDATE users
        SET preferred_lang = COALESCE($1, preferred_lang),
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, password_hash, role, is_provider, tokens_balance,
                  token_price_user, token_price_provider, commission_pct,
                  preferred_lang, created_at, updated_at, gps, gps_consent,
                  nom, prenom, nom_complet, photo_profil, avatar_url
        "#
    )
    .bind(input.preferred_lang.as_deref())
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;
    let updated = match updated {
        Ok(u) => u,
        Err(e) => {
            error!("[update_user_profile] DB error: {e:?}");
            return Err(e.into());
        }
    };
    Ok(Json(updated))
}

#[derive(Deserialize)]
pub struct UpdateGpsConsentRequest {
    pub gps_consent: bool,
}

/// ? PATCH /user/me/gps_consent ? mise à jour du consentement GPS
pub async fn update_gps_consent(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<UpdateGpsConsentRequest>,
) -> AppResult<Json<User>> {
    info!("Appel update_gps_consent pour user_id={}", user.id);
    let updated = sqlx::query_as::<_, User>(
        r#"
        UPDATE users
        SET gps_consent = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, password_hash, role, is_provider, tokens_balance,
                  token_price_user, token_price_provider, commission_pct,
                  preferred_lang, created_at, updated_at, gps, gps_consent
        "#
    )
    .bind(req.gps_consent)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;
    let updated = match updated {
        Ok(u) => u,
        Err(e) => {
            error!("[update_gps_consent] DB error: {e:?}");
            return Err(e.into());
        }
    };
    Ok(Json(updated))
}

/// Requête pour mettre à jour la position GPS
#[derive(Debug, Deserialize)]
pub struct UpdateGpsLocationRequest {
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: Option<f64>,
}

/// PATCH /user/me/gps_location - mise à jour de la position GPS
pub async fn update_gps_location(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<UpdateGpsLocationRequest>,
) -> AppResult<Json<User>> {
    info!("Appel update_gps_location pour user_id={}", user.id);
    
    // Vérifier que l'utilisateur a donné son consentement GPS
    let current_user = sqlx::query_as::<_, User>(
        r#"
        SELECT * FROM users WHERE id = $1
        "#
    )
    .bind(user.id)
    .fetch_one(&state.pg)
    .await?;
    
    if !current_user.gps_consent {
        return Err(crate::core::types::AppError::BadRequest(
            "Consentement GPS requis pour mettre à jour la position".to_string()
        ));
    }
    
    // Formater les coordonnées GPS
    let gps_coords = format!("{:.6},{:.6}", req.longitude, req.latitude);
    
    let updated = sqlx::query_as::<_, User>(
        r#"
        UPDATE users
        SET gps = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, password_hash, role, is_provider, tokens_balance,
                  token_price_user, token_price_provider, commission_pct,
                  preferred_lang, created_at, updated_at, gps, gps_consent
        "#
    )
    .bind(&gps_coords)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;
    
    let updated = match updated {
        Ok(u) => u,
        Err(e) => {
            error!("[update_gps_location] DB error: {e:?}");
            return Err(e.into());
        }
    };
    
    info!("Position GPS mise à jour pour user_id={}: {}", user.id, gps_coords);
    Ok(Json(updated))
}

/// RGPD : Export des données utilisateur
pub async fn export_user_data(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    let row = sqlx::query!("SELECT id, email, created_at, gps_consent FROM users WHERE id = $1", user.id)
        .fetch_one(&state.pg)
        .await?;
    let user_json = serde_json::json!({
        "id": row.id,
        "email": row.email,
        "created_at": row.created_at,
        "gps_consent": row.gps_consent
    });
    Ok(Json(user_json))
}

/// RGPD : Suppression des données utilisateur
pub async fn delete_user_data(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    let res = sqlx::query!("DELETE FROM users WHERE id = $1", user.id)
        .execute(&state.pg)
        .await?;
    if res.rows_affected() == 0 {
        return Ok(Json(serde_json::json!({"deleted": false, "reason": "not found"})));
    }
    Ok(Json(serde_json::json!({"deleted": true})))
}

/// GET /users/{id} - Récupère les informations publiques d'un utilisateur
pub async fn get_user_by_id(
    Path(user_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    info!("Appel get_user_by_id pour user_id={}", user_id);
    
    let result = sqlx::query!(
        r#"
        SELECT id, email, role, is_provider, gps, gps_consent,
               nom, prenom, nom_complet, photo_profil, avatar_url, created_at
        FROM users WHERE id = $1
        "#,
        user_id
    )
    .fetch_optional(&state.pg)
    .await;

    match result {
        Ok(Some(user_data)) => {
            let response = serde_json::json!({
                "id": user_data.id,
                "nom_complet": user_data.nom_complet,
                "photo_profil": user_data.photo_profil,
                "avatar_url": user_data.avatar_url,
                "gps": user_data.gps,
                "is_provider": user_data.is_provider,
                "created_at": user_data.created_at
            });
            Ok(Json(response))
        },
        Ok(None) => {
            Err(crate::core::types::AppError::NotFound("Utilisateur non trouvé".to_string()))
        },
        Err(e) => {
            error!("[get_user_by_id] DB error: {e:?}");
            Err(crate::core::types::AppError::Database(format!("DB error: {e}")))
        }
    }
}

