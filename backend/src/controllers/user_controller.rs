use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;

use crate::state::AppState;
use crate::{
    core::types::AppResult, middlewares::jwt::AuthenticatedUser, models::user_model::User,
};
use sqlx::FromRow;
use chrono::{DateTime, Utc};

#[derive(FromRow)]
struct UserTokensBalanceRow {
    tokens_balance: i64,
}

#[derive(FromRow)]
struct UserBalanceUpdateRow {
    tokens_balance: i64,
}

#[derive(FromRow)]
struct UserProfileRow {
    id: i32,
    email: String,
    created_at: DateTime<Utc>,
    gps_consent: Option<bool>,
}

#[derive(FromRow)]
struct UserDetailsRow {
    id: i32,
    #[allow(dead_code)] // Champ récupéré de la DB mais non utilisé dans la réponse JSON
    email: String,
    #[allow(dead_code)] // Champ récupéré de la DB mais non utilisé dans la réponse JSON
    role: String,
    is_provider: Option<bool>,
    gps: Option<String>,
    #[allow(dead_code)] // Champ récupéré de la DB mais non utilisé dans la réponse JSON
    gps_consent: Option<bool>,
    #[allow(dead_code)] // Champ récupéré de la DB mais non utilisé dans la réponse JSON
    nom: Option<String>,
    #[allow(dead_code)] // Champ récupéré de la DB mais non utilisé dans la réponse JSON
    prenom: Option<String>,
    nom_complet: Option<String>,
    photo_profil: Option<String>,
    avatar_url: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct UserFullProfileRow {
    id: i32,
    email: String,
    role: String,
    nom: Option<String>,
    prenom: Option<String>,
    nom_complet: Option<String>,
    photo_profil: Option<String>,
    avatar_url: Option<String>,
    preferred_lang: Option<String>,
    tokens_balance: i64,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct UserProfileResponse {
    pub id: i32,
    pub email: String,
    pub role: String,
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub nom_complet: Option<String>,
    pub photo_profil: Option<String>,
    pub avatar_url: Option<String>,
    pub preferred_lang: Option<String>,
    pub tokens_balance: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

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
    info!(
        "Appel purchase_pack pour user_id={}, pack_id={}",
        user.id, req.pack_id
    );
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
    info!(
        "Appel deduct_balance pour user_id={}, amount={}, reason={}",
        user.id, req.amount, req.reason
    );

    // Vérifier le solde actuel
    let current_balance_result: Result<UserTokensBalanceRow, _> =
        sqlx::query_as("SELECT tokens_balance FROM users WHERE id = $1")
            .bind(user.id)
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
        error!(
            "[deduct_balance] Solde insuffisant: {} < {}",
            current_balance, req.amount
        );
        return Err(crate::core::types::AppError::BadRequest(format!(
            "Solde insuffisant: {} < {}",
            current_balance, req.amount
        )));
    }

    // Calculer le nouveau solde
    let new_balance = current_balance - req.amount;

    // Mettre à jour le solde
    let update_result: Result<UserBalanceUpdateRow, _> = sqlx::query_as(
        "UPDATE users SET tokens_balance = $1 WHERE id = $2 RETURNING tokens_balance"
    )
    .bind(new_balance)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;

    match update_result {
        Ok(row) => {
            info!(
                "[deduct_balance] Solde mis à jour pour user_id={}: {} -> {} (déduction: {})",
                user.id, current_balance, row.tokens_balance, req.amount
            );
            Ok(Json(DeductBalanceResponse {
                new_balance: row.tokens_balance,
                amount_deducted: req.amount,
            }))
        }
        Err(e) => {
            error!("[deduct_balance] Erreur mise à jour solde: {e:?}");
            Err(e.into())
        }
    }
}

#[derive(Deserialize)]
pub struct UpdateProfileInput {
    pub preferred_lang: Option<String>,
    pub avatar_url: Option<String>,
    pub photo_profil: Option<String>,
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub nom_complet: Option<String>,
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
            avatar_url = COALESCE($2, avatar_url),
            photo_profil = COALESCE($3, photo_profil),
            nom = COALESCE($4, nom),
            prenom = COALESCE($5, prenom),
            nom_complet = COALESCE($6, nom_complet),
            updated_at = NOW()
        WHERE id = $7
        RETURNING id, email, password_hash, role, is_provider, tokens_balance,
                  token_price_user, token_price_provider, commission_pct,
                  preferred_lang, created_at, updated_at, gps, gps_consent,
                  nom, prenom, nom_complet, photo_profil, avatar_url
        "#,
    )
    .bind(input.preferred_lang.as_deref())
    .bind(input.avatar_url.as_deref())
    .bind(input.photo_profil.as_deref())
    .bind(input.nom.as_deref())
    .bind(input.prenom.as_deref())
    .bind(input.nom_complet.as_deref())
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
        "#,
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
        SELECT id, email, password_hash, role, is_provider, tokens_balance,
               token_price_user, token_price_provider, commission_pct,
               preferred_lang, created_at, updated_at, gps, gps_consent,
               nom, prenom, nom_complet, photo_profil, avatar_url
        FROM users WHERE id = $1
        "#,
    )
    .bind(user.id)
    .fetch_one(&state.pg)
    .await?;

    if !current_user.gps_consent {
        return Err(crate::core::types::AppError::BadRequest(
            "Consentement GPS requis pour mettre à jour la position".to_string(),
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
                  preferred_lang, created_at, updated_at, gps, gps_consent,
                  nom, prenom, nom_complet, photo_profil, avatar_url
        "#,
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

    info!(
        "Position GPS mise à jour pour user_id={}: {}",
        user.id, gps_coords
    );
    Ok(Json(updated))
}

/// RGPD : Export des données utilisateur
pub async fn export_user_data(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    let row: UserProfileRow = sqlx::query_as(
        "SELECT id, email, created_at, gps_consent FROM users WHERE id = $1"
    )
    .bind(user.id)
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
    let res = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user.id)
        .execute(&state.pg)
        .await?;
    if res.rows_affected() == 0 {
        return Ok(Json(
            serde_json::json!({"deleted": false, "reason": "not found"}),
        ));
    }
    Ok(Json(serde_json::json!({"deleted": true})))
}

/// GET /users/{id} - Récupère les informations publiques d'un utilisateur
pub async fn get_user_by_id(
    Path(user_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    info!("Appel get_user_by_id pour user_id={}", user_id);

    let result: Result<Option<UserDetailsRow>, _> = sqlx::query_as(
        r#"
        SELECT id, email, role, is_provider, gps, gps_consent,
               nom, prenom, nom_complet, photo_profil, avatar_url, created_at
        FROM users WHERE id = $1
        "#
    )
    .bind(user_id)
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
        }
        Ok(None) => Err(crate::core::types::AppError::NotFound(
            "Utilisateur non trouvé".to_string(),
        )),
        Err(e) => {
            error!("[get_user_by_id] DB error: {e:?}");
            Err(crate::core::types::AppError::Database(format!(
                "DB error: {e}"
            )))
        }
    }
}

#[derive(Serialize)]
pub struct ConsumptionHistoryItem {
    pub id: String,
    pub date: String,
    pub service: String,
    pub amount: i64,
    pub r#type: String, // "consumption" ou "recharge"
    pub description: String,
}

#[derive(Serialize)]
pub struct ConsumptionHistoryResponse {
    pub history: Vec<ConsumptionHistoryItem>,
}

/// GET /users/consumption-history - Récupère l'historique des consommations de tokens
pub async fn get_consumption_history(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<ConsumptionHistoryResponse>> {
    info!("Appel get_consumption_history pour user_id={}", user.id);

    // ✅ Calculer la date de début selon la période demandée
    let period = params.get("period").map(|s| s.as_str()).unwrap_or("30d");
    let days_ago = match period {
        "7d" => 7,
        "30d" => 30,
        "90d" => 90,
        "all" => 365 * 10, // 10 ans pour "tout"
        _ => 30,
    };

    // Récupérer l'historique des consommations depuis la table token_consumption_logs
    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            created_at,
            service_name,
            amount_consumed,
            'consumption' as type,
            description
        FROM token_consumption_logs 
        WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '1 day' * $2
        ORDER BY created_at DESC 
        LIMIT 200
        "#,
    )
    .bind(user.id)
    .bind(days_ago)
    .fetch_all(&state.pg)
    .await;

    let mut history = Vec::new();

    match rows {
        Ok(rows) => {
            for row in rows {
                let id: String = row.try_get("id").unwrap_or_else(|_| "unknown".to_string());
                let created_at: chrono::DateTime<chrono::Utc> = row
                    .try_get("created_at")
                    .unwrap_or_else(|_| chrono::Utc::now());
                let service_name: String = row
                    .try_get("service_name")
                    .unwrap_or_else(|_| "Service inconnu".to_string());
                let amount_consumed: i64 = row.try_get("amount_consumed").unwrap_or(0);
                let description: String = row
                    .try_get("description")
                    .unwrap_or_else(|_| "Consommation de tokens".to_string());

                history.push(ConsumptionHistoryItem {
                    id,
                    date: created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                    service: service_name,
                    amount: amount_consumed,
                    r#type: "consumption".to_string(),
                    description,
                });
            }
        }
        Err(e) => {
            error!("[get_consumption_history] DB error: {e:?}");
            // Ne pas retourner d'erreur, juste un historique vide
        }
    }

    // Récupérer aussi l'historique des recharges depuis la table purchase_history
    let recharge_rows = sqlx::query(
        r#"
        SELECT 
            id,
            created_at,
            'Recharge de tokens' as service_name,
            amount_paid,
            'recharge' as type,
            CONCAT('Recharge de ', amount_paid, ' FCFA') as description
        FROM purchase_history 
        WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '1 day' * $2
        ORDER BY created_at DESC 
        LIMIT 100
        "#,
    )
    .bind(user.id)
    .bind(days_ago)
    .fetch_all(&state.pg)
    .await;

    match recharge_rows {
        Ok(rows) => {
            for row in rows {
                let id: String = row.try_get("id").unwrap_or_else(|_| "unknown".to_string());
                let created_at: chrono::DateTime<chrono::Utc> = row
                    .try_get("created_at")
                    .unwrap_or_else(|_| chrono::Utc::now());
                let service_name: String = row
                    .try_get("service_name")
                    .unwrap_or_else(|_| "Recharge".to_string());
                let amount_paid: i64 = row.try_get("amount_paid").unwrap_or(0);
                let description: String = row
                    .try_get("description")
                    .unwrap_or_else(|_| "Recharge de tokens".to_string());

                history.push(ConsumptionHistoryItem {
                    id,
                    date: created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                    service: service_name,
                    amount: amount_paid,
                    r#type: "recharge".to_string(),
                    description,
                });
            }
        }
        Err(e) => {
            error!("[get_consumption_history] DB error for recharges: {e:?}");
            // Ne pas retourner d'erreur, juste continuer
        }
    }

    // Trier par date décroissante
    history.sort_by(|a, b| b.date.cmp(&a.date));

    Ok(Json(ConsumptionHistoryResponse { history }))
}

#[derive(Serialize)]
pub struct PaymentHistoryItem {
    pub id: String,
    pub date: String,
    pub amount: i64,
    pub payment_method: String,
    pub status: String, // "completed", "pending", "failed"
    pub transaction_id: Option<String>,
    pub description: String,
}

#[derive(Serialize)]
pub struct PaymentHistoryResponse {
    pub payments: Vec<PaymentHistoryItem>,
}

/// GET /users/payment-history - Récupère l'historique des paiements
pub async fn get_payment_history(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<PaymentHistoryResponse>> {
    info!("Appel get_payment_history pour user_id={}", user.id);

    // ✅ Calculer la date de début selon la période demandée
    let period = params.get("period").map(|s| s.as_str()).unwrap_or("30d");
    let days_ago = match period {
        "7d" => 7,
        "30d" => 30,
        "90d" => 90,
        "all" => 365 * 10, // 10 ans pour "tout"
        _ => 30,
    };

    // Récupérer l'historique des paiements depuis la table purchase_history
    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            created_at,
            amount_paid,
            payment_method,
            status,
            transaction_id,
            CONCAT('Recharge de ', amount_paid, ' FCFA') as description
        FROM purchase_history 
        WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '1 day' * $2
        ORDER BY created_at DESC 
        LIMIT 200
        "#,
    )
    .bind(user.id)
    .bind(days_ago)
    .fetch_all(&state.pg)
    .await;

    let mut payments = Vec::new();

    match rows {
        Ok(rows) => {
            for row in rows {
                let id: String = row.try_get("id").unwrap_or_else(|_| "unknown".to_string());
                let created_at: chrono::DateTime<chrono::Utc> = row
                    .try_get("created_at")
                    .unwrap_or_else(|_| chrono::Utc::now());
                let amount_paid: i64 = row.try_get("amount_paid").unwrap_or(0);
                let payment_method: String = row
                    .try_get("payment_method")
                    .unwrap_or_else(|_| "Inconnu".to_string());
                let status: String = row
                    .try_get("status")
                    .unwrap_or_else(|_| "completed".to_string());
                let transaction_id: Option<String> = row.try_get("transaction_id").ok();
                let description: String = row
                    .try_get("description")
                    .unwrap_or_else(|_| "Paiement".to_string());

                payments.push(PaymentHistoryItem {
                    id,
                    date: created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
                    amount: amount_paid,
                    payment_method,
                    status,
                    transaction_id,
                    description,
                });
            }
        }
        Err(e) => {
            error!("[get_payment_history] DB error: {e:?}");
            // Ne pas retourner d'erreur, juste un historique vide
        }
    }

    Ok(Json(PaymentHistoryResponse { payments }))
}

#[derive(Deserialize)]
pub struct RechargeRequest {
    pub amount: i64,
    pub tokens: i64,
    pub payment_method: String,
    pub payment_method_name: String,
    pub fees: i64,
    pub user_id: i64,
}

#[derive(Serialize)]
pub struct RechargeResponse {
    pub success: bool,
    pub message: String,
    pub transaction_id: String,
    pub new_balance: i64,
}

/// POST /tokens/recharge - Recharge des tokens
pub async fn recharge_tokens(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RechargeRequest>,
) -> AppResult<Json<RechargeResponse>> {
    info!(
        "Appel recharge_tokens pour user_id={}, amount={}",
        user.id, payload.amount
    );

    // Validation du montant minimum
    if payload.amount < 2000 {
        return Err(crate::core::types::AppError::BadRequest(
            "Le montant minimum de recharge est de 2000 FCFA".to_string(),
        ));
    }

    // Générer un ID de transaction unique
    let transaction_id = format!("TXN_{}_{}", user.id, chrono::Utc::now().timestamp());

    // Commencer une transaction
    let mut tx = state.pg.begin().await.map_err(|e| {
        error!("[recharge_tokens] Erreur début transaction: {e:?}");
        crate::core::types::AppError::Database(format!("Erreur base de données: {e}"))
    })?;

    // Récupérer le solde actuel
    let current_balance_row = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            error!("[recharge_tokens] Erreur récupération solde: {e:?}");
            crate::core::types::AppError::Database(format!("Erreur récupération solde: {e}"))
        })?;

    let current_balance: i64 = current_balance_row.try_get("tokens_balance").map_err(|e| {
        error!("[recharge_tokens] Erreur parsing solde: {e:?}");
        crate::core::types::AppError::Database(format!("Erreur parsing solde: {e}"))
    })?;

    // Calculer le nouveau solde (ajouter les tokens)
    let new_balance = current_balance + payload.tokens;

    // Mettre à jour le solde de l'utilisateur
    sqlx::query("UPDATE users SET tokens_balance = $1 WHERE id = $2")
        .bind(new_balance)
        .bind(user.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!("[recharge_tokens] Erreur mise à jour solde: {e:?}");
            crate::core::types::AppError::Database(format!("Erreur mise à jour solde: {e}"))
        })?;

    // Enregistrer l'historique de paiement
    sqlx::query(
        r#"
        INSERT INTO purchase_history (user_id, amount_paid, tokens_received, payment_method, status, transaction_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#
    )
    .bind(user.id)
    .bind(payload.amount)
    .bind(payload.tokens)
    .bind(&payload.payment_method)
    .bind("completed")
    .bind(&transaction_id)
    .bind(chrono::Utc::now())
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("[recharge_tokens] Erreur enregistrement historique: {e:?}");
        crate::core::types::AppError::Database(format!("Erreur enregistrement historique: {e}"))
    })?;

    // Valider la transaction
    tx.commit().await.map_err(|e| {
        error!("[recharge_tokens] Erreur commit transaction: {e:?}");
        crate::core::types::AppError::Database(format!("Erreur commit transaction: {e}"))
    })?;

    info!(
        "[recharge_tokens] Recharge réussie pour user_id={}, nouveau solde={}",
        user.id, new_balance
    );

    Ok(Json(RechargeResponse {
        success: true,
        message: format!("Recharge de {} tokens réussie", payload.tokens),
        transaction_id,
        new_balance,
    }))
}

/// Récupère le profil complet de l'utilisateur
pub async fn get_user_profile(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<UserProfileResponse>> {
    info!(
        "[get_user_profile] Récupération profil pour user_id={}",
        user.id
    );

    let row: UserFullProfileRow = sqlx::query_as(
        r#"
        SELECT 
            id, email, role, nom, prenom, nom_complet, 
            photo_profil, avatar_url, preferred_lang, 
            tokens_balance, created_at
        FROM users 
        WHERE id = $1
        "#
    )
    .bind(user.id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_user_profile] Erreur requête SQL: {e:?}");
        crate::core::types::AppError::Database(format!("Erreur récupération profil: {e}"))
    })?;

    let profile = UserProfileResponse {
        id: row.id,
        email: row.email,
        role: row.role,
        nom: row.nom,
        prenom: row.prenom,
        nom_complet: row.nom_complet,
        photo_profil: row.photo_profil,
        avatar_url: row.avatar_url,
        preferred_lang: row.preferred_lang,
        tokens_balance: row.tokens_balance,
        created_at: row.created_at,
    };

    info!(
        "[get_user_profile] Profil récupéré avec succès pour user_id={}",
        user.id
    );
    Ok(Json(profile))
}

/// ✅ NOUVEAU : Récupère la liste des conversations de l'utilisateur
#[derive(Serialize)]
pub struct ConversationItem {
    pub service_id: i32,
    pub service_title: String,
    pub prestataire_id: i32,
    pub prestataire_name: String,
    pub last_interaction_at: chrono::DateTime<chrono::Utc>,
    pub interaction_count: i64,
}

#[derive(Serialize)]
pub struct ConversationsResponse {
    pub conversations: Vec<ConversationItem>,
}

pub async fn get_user_conversations(
    Extension(user): Extension<AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
) -> AppResult<Json<ConversationsResponse>> {
    info!(
        "[get_user_conversations] Récupération conversations pour user_id={}",
        user.id
    );

    // Cette fonction nécessite MongoDB car les interactions sont stockées là
    // Pour l'instant, retourner une liste vide
    // TODO: Implémenter avec MongoDB quand disponible

    info!("[get_user_conversations] Retour liste vide (MongoDB non disponible)");
    Ok(Json(ConversationsResponse {
        conversations: vec![],
    }))
}
