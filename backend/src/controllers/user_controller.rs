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

/// POST /api/users/deduct-balance
/// Débite le solde tokens_balance de l'utilisateur (micro-paiements navigation, etc.)
/// Body: { "amount": i64, "reason": string, "feature": string }
pub async fn deduct_balance(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    let amount = req.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
    let reason = req.get("reason").and_then(|v| v.as_str()).unwrap_or("debit");
    let feature = req.get("feature").and_then(|v| v.as_str()).unwrap_or("unknown");

    if amount <= 0 {
        return Ok(Json(serde_json::json!({
            "success": true,
            "new_balance": 0,
            "message": "Montant nul — aucun débit"
        })));
    }

    // Vérifier le solde actuel
    let current_balance: i64 =
        sqlx::query_scalar("SELECT COALESCE(tokens_balance, 0) FROM users WHERE id = $1")
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| {
                log::error!(
                    "[deduct_balance] Erreur lecture solde user_id={}: {}",
                    user.id,
                    e
                );
                AppError::Internal("Erreur lecture solde".into())
            })?;

    if current_balance < amount {
        log::warn!(
            "[deduct_balance] Solde insuffisant user_id={}, solde={}, requis={}, feature={}",
            user.id,
            current_balance,
            amount,
            feature
        );
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant. Disponible: {} XAF, Requis: {} XAF",
            current_balance, amount
        )));
    }

    // Débiter atomiquement avec RETURNING
    let new_balance: i64 = sqlx::query_scalar(
        "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 AND tokens_balance >= $1 RETURNING tokens_balance"
    )
    .bind(amount)
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[deduct_balance] Erreur débit user_id={}: {}", user.id, e);
        AppError::Internal("Erreur débit solde".into())
    })?
    .ok_or_else(|| {
        log::warn!("[deduct_balance] Race condition — solde insuffisant après vérification, user_id={}", user.id);
        AppError::BadRequest("Solde insuffisant (concurrence)".into())
    })?;

    // Sync user_wallets.balance_cents (best effort)
    let _ = sqlx::query(
        r#"
        INSERT INTO user_wallets (user_id, balance_cents, currency, created_at, updated_at)
        VALUES ($1, $2 * 100, 'XAF', NOW(), NOW())
        ON CONFLICT (user_id, currency) DO UPDATE
        SET balance_cents = GREATEST(0, user_wallets.balance_cents - $3 * 100), updated_at = NOW()
        "#,
    )
    .bind(user.id)
    .bind(new_balance)
    .bind(amount)
    .execute(&state.pg)
    .await;

    // Log pour traçabilité — reference_type = clé « profil » stable pour filtres (consumption-history)
    let feature_key = feature.chars().take(50).collect::<String>();
    let _ = sqlx::query(
        r#"
        INSERT INTO wallet_transactions (user_id, amount_cents, direction, description, reference_type, created_at)
        VALUES ($1, $2, 'debit', $3, $4, NOW())
        "#,
    )
    .bind(user.id)
    .bind(amount * 100)
    .bind(format!("[{}] {}", feature, reason))
    .bind(feature_key)
    .execute(&state.pg)
    .await;

    log::info!(
        "[deduct_balance] ✅ user_id={}, amount={} XAF, feature={}, new_balance={} XAF, reason={}",
        user.id,
        amount,
        feature,
        new_balance,
        reason
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "new_balance": new_balance,
        "amount_debited": amount,
        "feature": feature
    })))
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

/// GET /api/users/consumption-history?period=30d
/// Historique des débits (consommation services, navigation, livraison, réservations)
pub async fn get_consumption_history(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    let period_str = params.get("period").cloned().unwrap_or_else(|| "30d".to_string());
    let days: i64 = period_str.trim_end_matches('d').parse().unwrap_or(30).min(365);

    // Requête wallet_transactions pour les débits
    let rows = sqlx::query_as::<
        _,
        (
            i64,
            i64,
            String,
            Option<String>,
            Option<String>,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        r#"
        SELECT id, amount_cents, COALESCE(direction, 'debit') as direction,
               description, reference_type,
               created_at
        FROM wallet_transactions
        WHERE user_id = $1
          AND (direction = 'debit' OR transaction_type LIKE '%debit%')
          AND created_at >= NOW() - make_interval(days => $2)
        ORDER BY created_at DESC
        LIMIT 200
        "#,
    )
    .bind(user.id)
    .bind(days as i32)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let history: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.0,
                "amount_cents": r.1,
                "direction": r.2,
                "description": r.3,
                "service_type": r.4,
                "created_at": r.5.to_rfc3339(),
            })
        })
        .collect();

    // Totaux
    let total_debits: i64 = rows.iter().map(|r| r.1).sum();

    Ok(Json(serde_json::json!({
        "success": true,
        "history": history,
        "total_debits_cents": total_debits,
        "period_days": days,
        "count": history.len()
    })))
}

/// GET /api/users/payment-history?period=30d
/// Historique des crédits (recharges, remboursements, reversements prestataire)
pub async fn get_payment_history(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    let period_str = params.get("period").cloned().unwrap_or_else(|| "30d".to_string());
    let days: i64 = period_str.trim_end_matches('d').parse().unwrap_or(30).min(365);

    // 1. Wallet credits (remboursements, reversements prestataire)
    let wallet_credits = sqlx::query_as::<_, (i64, i64, String, Option<String>, Option<String>, chrono::DateTime<chrono::Utc>)>(
        r#"
        SELECT id, amount_cents, COALESCE(direction, 'credit') as direction,
               description, reference_type,
               created_at
        FROM wallet_transactions
        WHERE user_id = $1
          AND (direction = 'credit' OR transaction_type LIKE '%credit%' OR transaction_type LIKE '%refund%' OR transaction_type LIKE '%payout%')
          AND created_at >= NOW() - make_interval(days => $2)
        ORDER BY created_at DESC
        LIMIT 100
        "#,
    )
    .bind(user.id)
    .bind(days as i32)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    // 2. Payment transactions (recharges externes: CinetPay, NotchPay, etc.)
    let payment_txns = sqlx::query_as::<
        _,
        (
            String,
            f64,
            String,
            String,
            String,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        r#"
        SELECT transaction_id, amount, currency, COALESCE(payment_method, 'unknown'),
               COALESCE(status, 'unknown'),
               created_at
        FROM payment_transactions
        WHERE user_id = $1
          AND created_at >= NOW() - make_interval(days => $2)
        ORDER BY created_at DESC
        LIMIT 100
        "#,
    )
    .bind(user.id)
    .bind(days as i32)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let mut history: Vec<serde_json::Value> = Vec::new();

    // Wallet credits
    for r in &wallet_credits {
        history.push(serde_json::json!({
            "id": r.0,
            "amount_cents": r.1,
            "direction": r.2,
            "description": r.3,
            "payment_method": r.4,
            "source": "wallet",
            "created_at": r.5.to_rfc3339(),
        }));
    }

    // External payment transactions
    for r in &payment_txns {
        history.push(serde_json::json!({
            "payment_id": r.0,
            "amount_cents": (r.1 * 100.0) as i64,
            "currency": r.2,
            "payment_method": r.3,
            "status": r.4,
            "direction": "credit",
            "description": format!("Recharge {} {} via {}", r.1 as i64, r.2, r.3),
            "source": "external",
            "created_at": r.5.to_rfc3339(),
        }));
    }

    // Sort by date desc
    history.sort_by(|a, b| {
        let da = a.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
        let db = b.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
        db.cmp(da)
    });

    let total_credits: i64 = history
        .iter()
        .filter_map(|h| h.get("amount_cents").and_then(|v| v.as_i64()))
        .sum();

    Ok(Json(serde_json::json!({
        "success": true,
        "history": history,
        "total_credits_cents": total_credits,
        "period_days": days,
        "count": history.len()
    })))
}

pub async fn purchase_pack(
    Extension(_user): Extension<AuthenticatedUser>,
    State(_state): State<Arc<AppState>>,
    Json(_req): Json<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    Err(AppError::NotImplemented("Fonction à implémenter".into()))
}

/// GET /api/users/partner-financial-summary?period=30d
/// Synthèse financière complète pour prestataires:
/// - Revenus totaux (ventes produits + livraisons + réservations)
/// - Commissions Yukpo prélevées
/// - Reversements reçus (payouts)
/// - Transactions détaillées récentes
pub async fn get_partner_financial_summary(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    let period_str = params.get("period").cloned().unwrap_or_else(|| "30d".to_string());
    let days: i64 = period_str.trim_end_matches('d').parse().unwrap_or(30).min(365);

    // Vérifier que l'utilisateur est bien un partenaire
    let user_role: Option<String> = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let role = user_role.unwrap_or_default();
    if role != "partenaire" && role != "partner" && role != "admin" {
        return Err(AppError::BadRequest(
            "Accès réservé aux prestataires".into(),
        ));
    }

    // 1. Solde actuel
    let balance: i64 =
        sqlx::query_scalar("SELECT COALESCE(tokens_balance, 0) FROM users WHERE id = $1")
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(0);

    // 2. Revenus livraison (merchant_payout_cents depuis delivery_payment_reservations)
    let delivery_revenue =
        sqlx::query_as::<_, (Option<i64>, Option<i64>, Option<i64>, Option<i64>)>(
            r#"
        SELECT 
            COALESCE(SUM(product_price_cents), 0),
            COALESCE(SUM(commission_cents), 0),
            COALESCE(SUM(merchant_payout_cents), 0),
            COUNT(*)::bigint
        FROM delivery_payment_reservations dpr
        JOIN deliveries d ON d.id = dpr.delivery_id
        JOIN services s ON s.id = (d.metadata->>'service_id')::int
        WHERE s.user_id = $1
          AND dpr.reserved_at >= NOW() - make_interval(days => $2)
          AND dpr.reservation_status IN ('confirmed', 'released', 'reserved')
        "#,
        )
        .bind(user.id)
        .bind(days as i32)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten()
        .unwrap_or((Some(0), Some(0), Some(0), Some(0)));

    // 3. Revenus réservations spécialisées (covoiturage, hôtel, taxi, etc.)
    let reservation_revenue = sqlx::query_as::<_, (Option<i64>, Option<i64>)>(
        r#"
        SELECT 
            COALESCE(SUM(CAST(amount * 100 AS bigint)), 0),
            COUNT(*)::bigint
        FROM specialized_reservations
        WHERE service_id IN (SELECT id FROM services WHERE user_id = $1)
          AND payment_status = 'paid'
          AND created_at >= NOW() - make_interval(days => $2)
        "#,
    )
    .bind(user.id)
    .bind(days as i32)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten()
    .unwrap_or((Some(0), Some(0)));

    // 4. Revenus bus tickets
    let bus_revenue = sqlx::query_as::<_, (Option<i64>, Option<i64>)>(
        r#"
        SELECT 
            COALESCE(SUM(total_amount), 0),
            COUNT(*)::bigint
        FROM bus_ticket_payments
        WHERE product_id IN (
            SELECT id::text FROM service_products sp
            JOIN services s ON s.id = sp.service_id
            WHERE s.user_id = $1
        )
        AND status = 'completed'
        AND created_at >= NOW() - make_interval(days => $2)
        "#,
    )
    .bind(user.id)
    .bind(days as i32)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten()
    .unwrap_or((Some(0), Some(0)));

    // 5. Wallet transactions récentes (crédits = reversements/payouts reçus)
    let recent_credits = sqlx::query_as::<_, (i64, i64, String, Option<String>, chrono::DateTime<chrono::Utc>)>(
        r#"
        SELECT id, amount_cents, COALESCE(direction, 'credit'),
               description, created_at
        FROM wallet_transactions
        WHERE user_id = $1
          AND (direction = 'credit' OR transaction_type LIKE '%credit%' OR transaction_type LIKE '%payout%')
          AND created_at >= NOW() - make_interval(days => $2)
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(user.id)
    .bind(days as i32)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    // 6. Wallet transactions récentes (débits = commissions, frais)
    let recent_debits = sqlx::query_as::<
        _,
        (
            i64,
            i64,
            String,
            Option<String>,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        r#"
        SELECT id, amount_cents, COALESCE(direction, 'debit'),
               description, created_at
        FROM wallet_transactions
        WHERE user_id = $1
          AND (direction = 'debit' OR transaction_type LIKE '%debit%')
          AND created_at >= NOW() - make_interval(days => $2)
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(user.id)
    .bind(days as i32)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    // Construire les transactions récentes
    let mut recent_transactions: Vec<serde_json::Value> = Vec::new();
    for r in &recent_credits {
        recent_transactions.push(serde_json::json!({
            "id": r.0, "amount_cents": r.1, "direction": r.2,
            "description": r.3, "created_at": r.4.to_rfc3339(),
        }));
    }
    for r in &recent_debits {
        recent_transactions.push(serde_json::json!({
            "id": r.0, "amount_cents": r.1, "direction": r.2,
            "description": r.3, "created_at": r.4.to_rfc3339(),
        }));
    }
    recent_transactions.sort_by(|a, b| {
        let da = a.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
        let db = b.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
        db.cmp(da)
    });

    let total_gross_revenue = delivery_revenue.0.unwrap_or(0)
        + reservation_revenue.0.unwrap_or(0)
        + bus_revenue.0.unwrap_or(0);
    let total_commissions = delivery_revenue.1.unwrap_or(0);
    let total_payouts = delivery_revenue.2.unwrap_or(0);
    let total_orders = delivery_revenue.3.unwrap_or(0)
        + reservation_revenue.1.unwrap_or(0)
        + bus_revenue.1.unwrap_or(0);

    let total_wallet_credits: i64 = recent_credits.iter().map(|r| r.1).sum();
    let total_wallet_debits: i64 = recent_debits.iter().map(|r| r.1).sum();

    Ok(Json(serde_json::json!({
        "success": true,
        "balance_xaf": balance,
        "period_days": days,
        "summary": {
            "total_gross_revenue_cents": total_gross_revenue,
            "total_commissions_yukpo_cents": total_commissions,
            "total_payouts_received_cents": total_payouts,
            "total_orders": total_orders,
            "net_revenue_cents": total_gross_revenue - total_commissions,
            "wallet_credits_period_cents": total_wallet_credits,
            "wallet_debits_period_cents": total_wallet_debits,
        },
        "breakdown": {
            "delivery": {
                "gross_revenue_cents": delivery_revenue.0.unwrap_or(0),
                "commissions_cents": delivery_revenue.1.unwrap_or(0),
                "payouts_cents": delivery_revenue.2.unwrap_or(0),
                "order_count": delivery_revenue.3.unwrap_or(0),
            },
            "reservations": {
                "revenue_cents": reservation_revenue.0.unwrap_or(0),
                "count": reservation_revenue.1.unwrap_or(0),
            },
            "bus_tickets": {
                "revenue_cents": bus_revenue.0.unwrap_or(0),
                "count": bus_revenue.1.unwrap_or(0),
            },
        },
        "recent_transactions": recent_transactions,
        "transaction_count": recent_transactions.len(),
    })))
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

    // Valider le montant minimum (1000 XAF minimum)
    if req.amount < 1000.0 {
        return Err(AppError::BadRequest(
            "Le montant minimum de recharge est de 1000 XAF".into(),
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

/// GET /api/user/payment-methods - Récupère les moyens de paiement sauvegardés
pub async fn get_user_payment_methods(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    let row: Option<(Option<serde_json::Value>,)> =
        sqlx::query_as("SELECT payment_methods FROM users WHERE id = $1")
            .bind(user.id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[get_user_payment_methods] Erreur: {e:?}");
                AppError::Internal("Erreur récupération moyens de paiement".into())
            })?;

    let payment_methods = row.and_then(|r| r.0).unwrap_or_else(|| serde_json::json!({}));

    // Déterminer si l'utilisateur a au moins un moyen de paiement configuré
    let has_mtn = payment_methods
        .get("mtn_money")
        .and_then(|v| v.get("phone"))
        .and_then(|v| v.as_str())
        .map(|s| !s.is_empty())
        .unwrap_or(false);
    let has_orange = payment_methods
        .get("orange_money")
        .and_then(|v| v.get("phone"))
        .and_then(|v| v.as_str())
        .map(|s| !s.is_empty())
        .unwrap_or(false);
    let has_card = payment_methods
        .get("carte_bancaire")
        .and_then(|v| v.get("cardNumber"))
        .and_then(|v| v.as_str())
        .map(|s| !s.is_empty())
        .unwrap_or(false);
    let has_any = has_mtn || has_orange || has_card;

    Ok(Json(serde_json::json!({
        "success": true,
        "payment_methods": payment_methods,
        "has_payment_method": has_any,
        "has_mtn_money": has_mtn,
        "has_orange_money": has_orange,
        "has_bank_card": has_card,
    })))
}

/// PUT /api/user/payment-methods - Sauvegarde les moyens de paiement
pub async fn save_user_payment_methods(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<AppState>>,
    Json(input): Json<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    info!(
        "[save_user_payment_methods] Mise à jour pour user_id={}",
        user.id
    );

    // Valider la structure minimale
    let payment_methods = if let Some(pm) = input.get("payment_methods") {
        pm.clone()
    } else {
        input.clone()
    };

    sqlx::query("UPDATE users SET payment_methods = $1, updated_at = NOW() WHERE id = $2")
        .bind(&payment_methods)
        .bind(user.id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[save_user_payment_methods] Erreur: {e:?}");
            AppError::Internal("Erreur sauvegarde moyens de paiement".into())
        })?;

    info!(
        "[save_user_payment_methods] Moyens de paiement mis à jour pour user_id={}",
        user.id
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Moyens de paiement sauvegardés",
    })))
}
