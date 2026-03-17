// @generated - Service de paiements agrégés
use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension, Json,
};
use log::info;
use serde::Deserialize;
use uuid::Uuid;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::paiement_agrege_model::MethodePaiement;
use crate::services::paiement_agrege_service::DemandePaiement;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreerDemandePaiementRequest {
    pub montant_total: f64,
    pub devise: Option<String>,
    pub methode_paiement: MethodePaiement,
    pub commande_id: Option<Uuid>,
    pub description: String,
    pub metadata: Option<serde_json::Value>,
    pub callback_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PaiementTransactionsQuery {
    pub statut: Option<String>,
    pub methode_paiement: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct PaiementCrediterWalletRequest {
    pub user_id: Uuid,
    pub montant: f64,
    pub motif: String,
}

#[derive(Debug, Deserialize)]
pub struct PaiementSoldeWalletQuery {
    pub user_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct DemandeRemboursementRequest {
    pub transaction_id: Uuid,
    pub motif: String,
}

#[derive(Debug, Deserialize)]
pub struct WalletHistoriqueQuery {
    pub type_transaction: Option<String>,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn creer_demande_paiement(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreerDemandePaiementRequest>,
) -> AppResult<impl IntoResponse> {
    let user_uuid = Uuid::from_u128(user.id as u128);
    info!(
        "[creer_demande_paiement] User: {}, Montant: {}",
        user.id, payload.montant_total
    );

    if payload.montant_total <= 0.0 {
        return Err(AppError::BadRequest(
            "Le montant doit être supérieur à 0".to_string(),
        ));
    }

    let demande = DemandePaiement {
        transaction_id: Uuid::new_v4(),
        montant_total: payload.montant_total,
        devise: payload.devise.unwrap_or_else(|| "XAF".to_string()),
        methode_paiement: payload.methode_paiement,
        user_id: user_uuid,
        commande_id: payload.commande_id,
        description: payload.description,
        metadata: payload.metadata.unwrap_or(serde_json::Value::Null),
        callback_url: payload.callback_url,
        expires_at: chrono::Utc::now() + chrono::Duration::hours(24),
    };

    let reponse = state.paiement_service.creer_demande_paiement(demande, &state.pg).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "paiement": reponse
    })))
}

pub async fn get_transaction_details(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(transaction_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let user_uuid = Uuid::from_u128(user.id as u128);
    let transaction = state
        .paiement_service
        .get_transaction_details(transaction_id, user_uuid, &state.pg)
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "transaction": transaction
    })))
}

pub async fn get_user_transactions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<PaiementTransactionsQuery>,
) -> AppResult<impl IntoResponse> {
    let user_uuid = Uuid::from_u128(user.id as u128);
    let limit = params.limit.unwrap_or(20);
    let offset = params.offset.unwrap_or(0);

    let transactions = state
        .paiement_service
        .get_user_transactions(user_uuid, limit, offset, &state.pg)
        .await?;

    let count = transactions.len();
    Ok(Json(serde_json::json!({
        "success": true,
        "transactions": transactions,
        "total": count,
        "limit": limit,
        "offset": offset
    })))
}

pub async fn get_solde_wallet(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<PaiementSoldeWalletQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let user_uuid = Uuid::from_u128(user.id as u128);
    let target = params.user_id.unwrap_or(user_uuid);

    if target != user_uuid {
        return Err(AppError::Forbidden("Accès non autorisé".to_string()));
    }

    let solde = state.paiement_service.get_solde_wallet(target, &state.pg).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "solde": solde,
        "devise": "XAF"
    })))
}

pub async fn crediter_wallet(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<PaiementCrediterWalletRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if payload.montant <= 0.0 {
        return Err(AppError::BadRequest(
            "Le montant doit être supérieur à 0".to_string(),
        ));
    }

    state
        .paiement_service
        .crediter_wallet(payload.user_id, payload.montant, &payload.motif, &state.pg)
        .await?;

    let nouveau_solde = state.paiement_service.get_solde_wallet(payload.user_id, &state.pg).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Wallet crédité avec succès",
        "montant_credite": payload.montant,
        "nouveau_solde": nouveau_solde
    })))
}

pub async fn demander_remboursement(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<DemandeRemboursementRequest>,
) -> AppResult<impl IntoResponse> {
    let user_uuid = Uuid::from_u128(user.id as u128);
    info!(
        "[demander_remboursement] User: {}, Transaction: {}",
        user.id, payload.transaction_id
    );

    let transaction = state
        .paiement_service
        .get_transaction_details(payload.transaction_id, user_uuid, &state.pg)
        .await?;

    let delai = chrono::Duration::hours(72);
    if chrono::Utc::now() > transaction.created_at + delai {
        return Err(AppError::BadRequest(
            "Délai de remboursement expiré (72h)".to_string(),
        ));
    }

    sqlx::query(
        "INSERT INTO demandes_remboursement (transaction_id, user_id, motif, montant, statut, created_at) VALUES ($1, $2, $3, $4, 'en_attente', NOW())"
    )
    .bind(payload.transaction_id)
    .bind(user_uuid)
    .bind(&payload.motif)
    .bind(transaction.montant_total)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création demande: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Demande de remboursement soumise",
        "montant": transaction.montant_total,
        "delai_traitement": "24-48h"
    })))
}

pub async fn get_wallet_historique(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<WalletHistoriqueQuery>,
) -> AppResult<impl IntoResponse> {
    let user_uuid = Uuid::from_u128(user.id as u128);
    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    #[derive(sqlx::FromRow, serde::Serialize)]
    struct WalletTxRow {
        montant: Option<f64>,
        type_transaction: Option<String>,
        motif: Option<String>,
        created_at: Option<chrono::DateTime<chrono::Utc>>,
    }

    let historique = sqlx::query_as::<_, WalletTxRow>(
        "SELECT montant, type_transaction, motif, created_at FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
    )
    .bind(user_uuid)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "historique": historique,
        "limit": limit,
        "offset": offset
    })))
}
