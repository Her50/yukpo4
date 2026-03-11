use axum::{
    extract::{Extension, Path, State},
    Json,
};
use bcrypt;
use log::{error, info};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::sync::Arc;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::user_model::User;
use crate::state::AppState;
use crate::utils::normalize_name::{build_full_name, normalize_full_name};

#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Serialize)]
pub struct ChangePasswordResponse {
    pub success: bool,
    pub message: String,
}

/// POST /api/users/change-password - Change le mot de passe de l'utilisateur
pub async fn change_password(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<ChangePasswordRequest>,
) -> AppResult<Json<ChangePasswordResponse>> {
    use crate::utils::validation::validate_password_strength;
    use bcrypt::verify;

    info!("Appel change_password pour user_id={}", user.id);

    // Valider le nouveau mot de passe
    validate_password_strength(&req.new_password)?;

    // Récupérer le hash actuel du mot de passe
    #[derive(FromRow)]
    struct PasswordHashRow {
        password_hash: String,
    }

    let current_hash =
        sqlx::query_as::<_, PasswordHashRow>("SELECT password_hash FROM users WHERE id = $1")
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| {
                error!("[change_password] Erreur récupération hash: {e:?}");
                AppError::Internal("Erreur récupération utilisateur".into())
            })?;

    // Vérifier le mot de passe actuel
    if !verify(&req.current_password, &current_hash.password_hash)? {
        error!(
            "[change_password] Mot de passe actuel incorrect pour user_id={}",
            user.id
        );
        return Err(AppError::Unauthorized(
            "Mot de passe actuel incorrect".into(),
        ));
    }

    // Hasher le nouveau mot de passe
    const BCRYPT_COST: u32 = 12;
    let new_password_hash = bcrypt::hash(&req.new_password, BCRYPT_COST).map_err(|e| {
        error!("[change_password] Erreur hachage nouveau mot de passe: {e:?}");
        AppError::Internal("Erreur lors du hachage du mot de passe".into())
    })?;

    // Mettre à jour le mot de passe
    sqlx::query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2")
        .bind(&new_password_hash)
        .bind(user.id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[change_password] Erreur mise à jour mot de passe: {e:?}");
            AppError::Internal("Erreur mise à jour mot de passe".into())
        })?;

    info!(
        "[change_password] ✅ Mot de passe mis à jour pour user_id={}",
        user.id
    );

    Ok(Json(ChangePasswordResponse {
        success: true,
        message: "Mot de passe mis à jour avec succès".into(),
    }))
}

// Placeholder functions pour les autres routes - à implémenter si nécessaire
pub async fn get_user_profile(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<User>> {
    let user_data = sqlx::query_as::<_, User>(
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
    .await
    .map_err(|e| {
        error!("[get_user_profile] Erreur: {e:?}");
        AppError::Internal("Erreur récupération profil".into())
    })?;
    Ok(Json(user_data))
}

#[derive(Deserialize)]
pub struct UpdateProfileInput {
    pub preferred_lang: Option<String>,
    pub avatar_url: Option<String>,
    pub photo_profil: Option<String>,
    pub nom: Option<String>,
    pub prenom: Option<String>,
    pub nom_complet: Option<String>,
    // ✅ NOUVEAU 2026-03-11: Modes de paiement prestataire (MTN Money, Orange Money, etc.)
    // Format attendu: { "mtn_money": { "phone": "...", "verified": false }, "orange_money": { ... } }
    pub payment_methods: Option<serde_json::Value>,
}

pub async fn update_user_profile(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(input): Json<UpdateProfileInput>,
) -> AppResult<Json<User>> {
    info!("Appel update_user_profile pour user_id={}", user.id);

    // ✅ CORRIGÉ 2026-02-16: Normaliser le nom_complet pour éviter les duplications
    // Si nom ou prenom sont fournis, reconstruire nom_complet à partir d'eux
    // Sinon, utiliser nom_complet fourni (après normalisation)
    let nom_complet_normalized = if input.nom.is_some() || input.prenom.is_some() {
        // Reconstruire à partir de nom et prenom (priorité)
        build_full_name(
            input.nom.as_deref(),
            input.prenom.as_deref(),
            input.nom_complet.as_deref(),
        )
    } else if let Some(ref nc) = input.nom_complet {
        // Normaliser le nom_complet fourni directement
        Some(normalize_full_name(nc))
    } else {
        None
    };

    // ✅ NOUVEAU 2026-03-11: Sauvegarder les modes de paiement si fournis
    if let Some(ref pm) = input.payment_methods {
        info!(
            "[update_user_profile] Mise à jour payment_methods pour user_id={}: {:?}",
            user.id, pm
        );
        let _ =
            sqlx::query("UPDATE users SET payment_methods = $1, updated_at = NOW() WHERE id = $2")
                .bind(pm)
                .bind(user.id)
                .execute(&state.pg)
                .await
                .map_err(|e| {
                    error!("[update_user_profile] Erreur mise à jour payment_methods: {e:?}");
                });
    }

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
    .bind(nom_complet_normalized.as_deref())
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

#[derive(Serialize)]
pub struct UserBalanceResponse {
    pub tokens_balance: i64,
}

pub async fn get_user_balance(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<UserBalanceResponse>> {
    #[derive(FromRow)]
    struct BalanceRow {
        tokens_balance: i64,
    }
    let balance = sqlx::query_as::<_, BalanceRow>("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_user_balance] Erreur: {e:?}");
            AppError::Internal("Erreur récupération solde".into())
        })?;
    Ok(Json(UserBalanceResponse {
        tokens_balance: balance.tokens_balance,
    }))
}

/// Coût fixe pour ajouter un produit (aligné avec product_addition_controller)
const COST_ADD_PRODUCT_XAF: i64 = 2000;

#[derive(Serialize)]
pub struct ProductAddCostResponse {
    /// Coût effectif en FCFA (0 si phase de lancement ou 1er produit)
    pub cost: i64,
    /// true si création gratuite (LAUNCH_PHASE_START_DATE / 1er produit)
    pub is_free: bool,
}

/// GET /api/users/product-add-cost - Coût effectif pour ajouter un produit (phase de lancement = 0)
pub async fn get_product_add_cost(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<ProductAddCostResponse>> {
    let is_free =
        crate::services::launch_phase_service::can_create_product_free(&state.pg, user.id)
            .await
            .unwrap_or(false);
    let cost = if is_free { 0 } else { COST_ADD_PRODUCT_XAF };
    Ok(Json(ProductAddCostResponse { cost, is_free }))
}

// Placeholder functions - à implémenter selon les besoins
pub async fn deduct_balance(
    Extension(_user): Extension<AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
    Json(_req): Json<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    Err(AppError::NotImplemented("Fonction à implémenter".into()))
}

pub async fn export_user_data(
    Extension(_user): Extension<AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    Err(AppError::NotImplemented("Fonction à implémenter".into()))
}

pub async fn delete_user_data(
    Extension(_user): Extension<AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    Err(AppError::NotImplemented("Fonction à implémenter".into()))
}

pub async fn get_consumption_history(
    Extension(_user): Extension<AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    Err(AppError::NotImplemented("Fonction à implémenter".into()))
}

pub async fn get_payment_history(
    Extension(_user): Extension<AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    Err(AppError::NotImplemented("Fonction à implémenter".into()))
}

pub async fn purchase_pack(
    Extension(_user): Extension<AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
    Json(_req): Json<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    Err(AppError::NotImplemented("Fonction à implémenter".into()))
}

#[derive(Deserialize)]
pub struct RechargeTokensRequest {
    pub amount: f64,
    pub payment_method: serde_json::Value,
    pub description: Option<String>,
}

pub async fn recharge_tokens(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<RechargeTokensRequest>,
) -> AppResult<Json<serde_json::Value>> {
    use crate::services::payment_service::{PaymentRequest, PaymentService};

    info!(
        "Recharge tokens pour user_id={}, amount={} XAF",
        user.id, req.amount
    );

    // Valider le montant minimum (100 XAF minimum)
    if req.amount < 100.0 {
        return Err(AppError::BadRequest(
            "Le montant minimum de recharge est de 100 XAF".into(),
        ));
    }

    // Valider le montant maximum (1 000 000 XAF maximum)
    if req.amount > 1_000_000.0 {
        return Err(AppError::BadRequest(
            "Le montant maximum de recharge est de 1 000 000 XAF".into(),
        ));
    }

    // Créer la requête de paiement
    let payment_request = PaymentRequest {
        user_id: user.id,
        amount: req.amount,
        currency: "XAF".to_string(),
        payment_method: serde_json::from_value(req.payment_method)
            .map_err(|e| AppError::BadRequest(format!("Méthode de paiement invalide: {}", e)))?,
        description: req.description.or_else(|| Some(format!("Recharge de {} XAF", req.amount))),
    };

    // Traiter le paiement
    let payment_service = PaymentService::new(state.pg.clone());
    let payment_response = payment_service
        .process_payment(payment_request)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur lors du traitement du paiement: {}", e)))?;

    // Retourner la réponse avec les détails de la transaction
    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Recharge de {} XAF initiée avec succès", req.amount),
        "transaction_id": payment_response.transaction_id,
        "status": payment_response.status,
        "amount": payment_response.amount,
        "currency": payment_response.currency,
        "payment_method": payment_response.payment_method,
        "created_at": payment_response.created_at,
        "reference": payment_response.reference,
        "gateway_response": payment_response.gateway_response
    })))
}

#[derive(Deserialize)]
pub struct UpdateGpsConsentRequest {
    pub gps_consent: bool,
}

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
                  preferred_lang, created_at, updated_at, gps, gps_consent,
                  nom, prenom, nom_complet, photo_profil, avatar_url
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

#[derive(Debug, Deserialize)]
pub struct UpdateGpsLocationRequest {
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: Option<f64>,
}

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
        return Err(AppError::BadRequest(
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

pub async fn get_user_by_id(
    Path(user_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<User>> {
    let user_data = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, role, is_provider, tokens_balance,
               token_price_user, token_price_provider, commission_pct,
               preferred_lang, created_at, updated_at, gps, gps_consent,
               nom, prenom, nom_complet, photo_profil, avatar_url
        FROM users WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_user_by_id] Erreur: {e:?}");
        AppError::Internal("Erreur récupération utilisateur".into())
    })?;
    Ok(Json(user_data))
}

pub async fn get_user_conversations(
    Extension(_user): Extension<AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    Err(AppError::NotImplemented("Fonction à implémenter".into()))
}
