// ✅ CONTROLLER ADMINISTRATION PAIEMENTS - Gestion fournisseurs, transactions, remboursements

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Json},
    Extension,
};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    models::paiement_agrege_model::{MethodePaiement, TransactionStatut},
    services::paiement_agrege_service::{FournisseurPaiement, TypeFournisseur},
    state::AppState,
};

// ========================================
// PAYLOADS REQUEST/RESPONSE
// ========================================

#[derive(Debug, Deserialize)]
pub struct CreateFournisseurPaiementRequest {
    pub nom: String,
    pub code: String,
    pub type_fournisseur: TypeFournisseur,
    pub pays: String,
    pub devise: String,
    pub commission_fournisseur: f64,
    pub configuration: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFournisseurPaiementRequest {
    pub nom: Option<String>,
    pub commission_fournisseur: Option<f64>,
    pub configuration: Option<serde_json::Value>,
    pub est_actif: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct GetFournisseursQuery {
    pub type_fournisseur: Option<TypeFournisseur>,
    pub pays: Option<String>,
    pub est_actif: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct TraiterRemboursementRequest {
    pub remboursement_id: Uuid,
    pub action: String, // "approuver" ou "rejeter"
    pub motif: Option<String>,
    pub montant_rembourse: Option<f64>, // Pour remboursements partiels
}

#[derive(Debug, Deserialize)]
pub struct GetTransactionsAdminQuery {
    pub statut: Option<TransactionStatut>,
    pub methode_paiement: Option<MethodePaiement>,
    pub fournisseur: Option<String>,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
    pub user_id: Option<Uuid>,
    pub min_montant: Option<f64>,
    pub max_montant: Option<f64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct GetRemboursementsQuery {
    pub statut: Option<String>,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
    pub user_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct GetStatistiquesQuery {
    pub periode: Option<String>,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
    pub ville: Option<String>,
}

// ========================================
// ENDPOINTS ADMINISTRATION PAIEMENTS
// ========================================

/// Créer un fournisseur de paiement
pub async fn create_fournisseur_paiement(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateFournisseurPaiementRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_fournisseur_paiement] Admin: {}, Fournisseur: {}",
        admin_id, payload.nom
    );

    // TODO: Vérifier que c'est un admin

    // Vérifier que le code n'existe pas déjà
    let existing =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM fournisseurs_paiement WHERE code = $1")
            .bind(&payload.code)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification code: {}", e)))?;

    if existing.is_some() {
        return Err(AppError::BadRequest(
            "Ce code fournisseur existe déjà".to_string(),
        ));
    }

    // Valider la configuration
    if !payload.configuration.is_object() {
        return Err(AppError::BadRequest(
            "La configuration doit être un objet JSON".to_string(),
        ));
    }

    // Créer le fournisseur
    let fournisseur = sqlx::query_as::<_, FournisseurPaiement>(
        r#"
        INSERT INTO fournisseurs_paiement (
            nom, code, type_fournisseur, pays, devise,
            commission_fournisseur, configuration, est_actif
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING *
        "#,
    )
    .bind(&payload.nom)
    .bind(&payload.code)
    .bind(&payload.type_fournisseur)
    .bind(&payload.pays)
    .bind(&payload.devise)
    .bind(payload.commission_fournisseur)
    .bind(&payload.configuration)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création fournisseur: {}", e)))?;

    info!("[create_fournisseur_paiement] Fournisseur {} créé (redémarrage requis pour recharger le cache fournisseurs)", fournisseur.id);

    Ok(Json(serde_json::json!({
        "success": true,
        "fournisseur": fournisseur,
        "message": "Fournisseur de paiement créé avec succès"
    })))
}

/// Lister les fournisseurs de paiement
pub async fn get_fournisseurs_paiement(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<GetFournisseursQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_fournisseurs_paiement] Admin: {}", admin_id);

    // TODO: Vérifier que c'est un admin

    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    let mut query = "SELECT * FROM fournisseurs_paiement WHERE 1=1".to_string();

    if let Some(type_fournisseur) = &params.type_fournisseur {
        query.push_str(&format!(" AND type_fournisseur = '{:?}'", type_fournisseur));
    }

    if let Some(pays) = &params.pays {
        query.push_str(&format!(" AND pays = '{}'", pays));
    }

    if let Some(est_actif) = params.est_actif {
        query.push_str(&format!(" AND est_actif = {}", est_actif));
    }

    query.push_str(" ORDER BY created_at DESC");

    let fournisseurs = sqlx::query_as::<_, FournisseurPaiement>(&query)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "fournisseurs": fournisseurs,
        "total": fournisseurs.len(),
        "limit": limit,
        "offset": offset
    })))
}

/// Mettre à jour un fournisseur de paiement
pub async fn update_fournisseur_paiement(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Path(fournisseur_id): Path<Uuid>,
    Json(payload): Json<UpdateFournisseurPaiementRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_fournisseur_paiement] Admin: {}, Fournisseur: {}",
        admin_id, fournisseur_id
    );

    // TODO: Vérifier que c'est un admin

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Vérifier que le fournisseur existe
    let _fournisseur = sqlx::query_as::<_, FournisseurPaiement>(
        "SELECT * FROM fournisseurs_paiement WHERE id = $1",
    )
    .bind(fournisseur_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Fournisseur non trouvé".to_string()))?;

    // Mettre à jour les champs
    if let Some(nom) = payload.nom {
        sqlx::query("UPDATE fournisseurs_paiement SET nom = $1 WHERE id = $2")
            .bind(&nom)
            .bind(fournisseur_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update nom: {}", e)))?;
    }

    if let Some(commission) = payload.commission_fournisseur {
        sqlx::query("UPDATE fournisseurs_paiement SET commission_fournisseur = $1 WHERE id = $2")
            .bind(commission)
            .bind(fournisseur_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update commission: {}", e)))?;
    }

    if let Some(configuration) = payload.configuration {
        sqlx::query("UPDATE fournisseurs_paiement SET configuration = $1 WHERE id = $2")
            .bind(&configuration)
            .bind(fournisseur_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update configuration: {}", e)))?;
    }

    if let Some(est_actif) = payload.est_actif {
        sqlx::query("UPDATE fournisseurs_paiement SET est_actif = $1 WHERE id = $2")
            .bind(est_actif)
            .bind(fournisseur_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update actif: {}", e)))?;
    }

    // Mettre à jour le timestamp
    sqlx::query("UPDATE fournisseurs_paiement SET updated_at = NOW() WHERE id = $1")
        .bind(fournisseur_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update timestamp: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    // Récupérer le fournisseur mis à jour
    let fournisseur_update = sqlx::query_as::<_, FournisseurPaiement>(
        "SELECT * FROM fournisseurs_paiement WHERE id = $1",
    )
    .bind(fournisseur_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération: {}", e)))?;

    info!(
        "[update_fournisseur_paiement] Fournisseur {} mis à jour",
        fournisseur_id
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "fournisseur": fournisseur_update,
        "message": "Fournisseur de paiement mis à jour avec succès"
    })))
}

/// Lister toutes les transactions (admin)
pub async fn get_all_transactions(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<GetTransactionsAdminQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_all_transactions] Admin: {}", admin_id);

    // TODO: Vérifier que c'est un admin

    let limit = params.limit.unwrap_or(100);
    let offset = params.offset.unwrap_or(0);

    let mut query = "
        SELECT ta.*, 
               u.nom as user_nom, u.prenom as user_prenom, u.email as user_email,
               cm.reference_commande
        FROM transactions_agregees ta
        LEFT JOIN users u ON ta.user_id = u.id
        LEFT JOIN commandes_mixtes cm ON ta.commande_id = cm.id
        WHERE 1=1
    "
    .to_string();

    if let Some(statut) = &params.statut {
        query.push_str(&format!(" AND ta.statut = '{:?}'", statut));
    }

    if let Some(methode) = &params.methode_paiement {
        query.push_str(&format!(" AND ta.methode_paiement = '{:?}'", methode));
    }

    if let Some(user_id) = params.user_id {
        query.push_str(&format!(" AND ta.user_id = '{}'", user_id));
    }

    if let Some(min_montant) = params.min_montant {
        query.push_str(&format!(" AND ta.montant_total >= {}", min_montant));
    }

    if let Some(max_montant) = params.max_montant {
        query.push_str(&format!(" AND ta.montant_total <= {}", max_montant));
    }

    if let Some(date_debut) = &params.date_debut {
        query.push_str(&format!(" AND ta.created_at >= '{}'", date_debut));
    }

    if let Some(date_fin) = &params.date_fin {
        query.push_str(&format!(" AND ta.created_at <= '{}'", date_fin));
    }

    query.push_str(" ORDER BY ta.created_at DESC");

    let transactions_rows = sqlx::query(&query)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let transactions: Vec<serde_json::Value> = transactions_rows.iter().map(|row| {
        use sqlx::Row;
        serde_json::json!({
            "id": row.try_get::<Uuid, _>("id").ok(),
            "user_id": row.try_get::<Uuid, _>("user_id").ok(),
            "montant_total": row.try_get::<f64, _>("montant_total").ok(),
            "devise": row.try_get::<String, _>("devise").ok(),
            "statut": row.try_get::<String, _>("statut").ok(),
            "methode_paiement": row.try_get::<String, _>("methode_paiement").ok(),
            "reference_paiement": row.try_get::<String, _>("reference_paiement").ok(),
            "user_nom": row.try_get::<Option<String>, _>("user_nom").unwrap_or(None),
            "user_prenom": row.try_get::<Option<String>, _>("user_prenom").unwrap_or(None),
            "user_email": row.try_get::<Option<String>, _>("user_email").unwrap_or(None),
            "reference_commande": row.try_get::<Option<String>, _>("reference_commande").unwrap_or(None),
            "created_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at").unwrap_or(None),
        })
    }).collect();

    // Calculer les totaux
    let totaux_row = sqlx::query(
        r#"
        SELECT 
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN statut = 'succes' THEN 1 END) as transactions_succes,
            COUNT(CASE WHEN statut = 'echec' THEN 1 END) as transactions_echec,
            SUM(montant_total) as volume_total,
            SUM(commission_app) as commission_totale,
            AVG(montant_total) as montant_moyen
        FROM transactions_agregees
        "#,
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur totaux: {}", e)))?;
    let totaux = {
        use sqlx::Row;
        serde_json::json!({
            "total_transactions": totaux_row.try_get::<Option<i64>, _>("total_transactions").unwrap_or(None),
            "transactions_succes": totaux_row.try_get::<Option<i64>, _>("transactions_succes").unwrap_or(None),
            "transactions_echec": totaux_row.try_get::<Option<i64>, _>("transactions_echec").unwrap_or(None),
            "volume_total": totaux_row.try_get::<Option<f64>, _>("volume_total").unwrap_or(None),
            "commission_totale": totaux_row.try_get::<Option<f64>, _>("commission_totale").unwrap_or(None),
            "montant_moyen": totaux_row.try_get::<Option<f64>, _>("montant_moyen").unwrap_or(None),
        })
    };

    Ok(Json(serde_json::json!({
        "success": true,
        "transactions": transactions,
        "totaux": totaux,
        "limit": limit,
        "offset": offset
    })))
}

/// Traiter une demande de remboursement
pub async fn traiter_remboursement(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<TraiterRemboursementRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[traiter_remboursement] Admin: {}, Remboursement: {}, Action: {}",
        admin_id, payload.remboursement_id, payload.action
    );

    // TODO: Vérifier que c'est un admin

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Récupérer la demande de remboursement
    let remboursement_row = sqlx::query(
        r#"
        SELECT dr.*, ta.montant_total, ta.user_id, ta.reference_paiement
        FROM demandes_remboursement dr
        JOIN transactions_agregees ta ON dr.transaction_id = ta.id
        WHERE dr.id = $1
        "#,
    )
    .bind(payload.remboursement_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Demande de remboursement non trouvée".to_string()))?;

    let remboursement_statut: String = {
        use sqlx::Row;
        remboursement_row.try_get("statut").unwrap_or_default()
    };
    let remboursement_montant_total: f64 = {
        use sqlx::Row;
        remboursement_row.try_get("montant_total").unwrap_or(0.0)
    };
    let remboursement_user_id: Uuid = {
        use sqlx::Row;
        remboursement_row.try_get("user_id").unwrap_or_default()
    };
    let remboursement_reference_paiement: String = {
        use sqlx::Row;
        remboursement_row.try_get("reference_paiement").unwrap_or_default()
    };

    if remboursement_statut != "en_attente" {
        return Err(AppError::BadRequest(
            "Cette demande a déjà été traitée".to_string(),
        ));
    }

    match payload.action.as_str() {
        "approuver" => {
            let montant_rembourse =
                payload.montant_rembourse.unwrap_or(remboursement_montant_total);

            if montant_rembourse > remboursement_montant_total {
                return Err(AppError::BadRequest(
                    "Le montant remboursé ne peut pas dépasser le montant total".to_string(),
                ));
            }

            // Mettre à jour le statut de la demande
            sqlx::query(
                r#"
                UPDATE demandes_remboursement 
                SET statut = 'approuve', 
                    montant_rembourse = $1,
                    admin_id = $2,
                    date_traitement = NOW(),
                    updated_at = NOW()
                WHERE id = $3
                "#,
            )
            .bind(montant_rembourse)
            .bind(admin_id)
            .bind(payload.remboursement_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update demande: {}", e)))?;

            // Rembourser le wallet de l'utilisateur
            sqlx::query(
                r#"
                INSERT INTO user_wallets (user_id, solde, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    solde = user_wallets.solde + $2,
                    updated_at = NOW()
                "#,
            )
            .bind(remboursement_user_id)
            .bind(montant_rembourse)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur crédit wallet: {}", e)))?;

            // Historique du remboursement
            sqlx::query(
                r#"
                INSERT INTO wallet_transactions (user_id, montant, type_transaction, motif, reference_paiement, created_at)
                VALUES ($1, $2, 'credit', $3, $4, NOW())
                "#,
            )
            .bind(remboursement_user_id)
            .bind(montant_rembourse)
            .bind(format!("Remboursement {}", remboursement_reference_paiement))
            .bind(&remboursement_reference_paiement)
            .execute(&mut *tx)
            .await
                .map_err(|e| AppError::Internal(format!("Erreur historique: {}", e)))?;

            // Envoyer notification à l'utilisateur
            let mut variables = std::collections::HashMap::new();
            variables.insert("montant".to_string(), montant_rembourse.to_string());
            variables.insert(
                "reference_paiement".to_string(),
                remboursement_reference_paiement.clone(),
            );

            if let Err(e) = crate::services::multilingue_service::envoyer_notification_multilingue(
                &state,
                remboursement_user_id,
                "remboursement.approuve",
                variables,
                Some(serde_json::json!({
                    "type": "remboursement",
                    "remboursement_id": payload.remboursement_id,
                    "montant": montant_rembourse
                })),
            )
            .await
            {
                warn!("[traiter_remboursement] Erreur notification: {}", e);
            }

            info!(
                "[traiter_remboursement] Remboursement {} approuvé de {}",
                payload.remboursement_id, montant_rembourse
            );
        }
        "rejeter" => {
            // Mettre à jour le statut de la demande
            sqlx::query(
                r#"
                UPDATE demandes_remboursement 
                SET statut = 'rejete', 
                    admin_id = $1,
                    motif_rejet = $2,
                    date_traitement = NOW(),
                    updated_at = NOW()
                WHERE id = $3
                "#,
            )
            .bind(admin_id)
            .bind(&payload.motif)
            .bind(payload.remboursement_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update demande: {}", e)))?;

            // Envoyer notification à l'utilisateur
            let mut variables = std::collections::HashMap::new();
            variables.insert(
                "motif".to_string(),
                payload.motif.clone().unwrap_or_default(),
            );

            if let Err(e) = crate::services::multilingue_service::envoyer_notification_multilingue(
                &state,
                remboursement_user_id,
                "remboursement.rejete",
                variables,
                Some(serde_json::json!({
                    "type": "remboursement",
                    "remboursement_id": payload.remboursement_id,
                    "motif": payload.motif
                })),
            )
            .await
            {
                warn!("[traiter_remboursement] Erreur notification: {}", e);
            }

            info!(
                "[traiter_remboursement] Remboursement {} rejeté",
                payload.remboursement_id
            );
        }
        _ => {
            return Err(AppError::BadRequest(
                "Action invalide. Utilisez 'approuver' ou 'rejeter'".to_string(),
            ));
        }
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Demande de remboursement {} avec succès", payload.action),
        "remboursement_id": payload.remboursement_id
    })))
}

/// Lister les demandes de remboursement
pub async fn get_remboursements(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<GetRemboursementsQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_remboursements] Admin: {}", admin_id);

    // TODO: Vérifier que c'est un admin

    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    let mut query = "
        SELECT dr.*, 
               u.nom as user_nom, u.prenom as user_prenom, u.email as user_email,
               ta.montant_total, ta.reference_paiement,
               admin.nom as admin_nom, admin.prenom as admin_prenom
        FROM demandes_remboursement dr
        LEFT JOIN users u ON dr.user_id = u.id
        LEFT JOIN transactions_agregees ta ON dr.transaction_id = ta.id
        LEFT JOIN users admin ON dr.admin_id = admin.id
        WHERE 1=1
    "
    .to_string();

    if let Some(statut) = &params.statut {
        query.push_str(&format!(" AND dr.statut = '{}'", statut));
    }

    if let Some(user_id) = params.user_id {
        query.push_str(&format!(" AND dr.user_id = '{}'", user_id));
    }

    if let Some(date_debut) = &params.date_debut {
        query.push_str(&format!(" AND dr.created_at >= '{}'", date_debut));
    }

    if let Some(date_fin) = &params.date_fin {
        query.push_str(&format!(" AND dr.created_at <= '{}'", date_fin));
    }

    query.push_str(" ORDER BY dr.created_at DESC");

    let remboursements_rows = sqlx::query(&query)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let remboursements: Vec<serde_json::Value> = remboursements_rows.iter().map(|row| {
        use sqlx::Row;
        serde_json::json!({
            "id": row.try_get::<Uuid, _>("id").ok(),
            "transaction_id": row.try_get::<Option<Uuid>, _>("transaction_id").unwrap_or(None),
            "user_id": row.try_get::<Option<Uuid>, _>("user_id").unwrap_or(None),
            "statut": row.try_get::<Option<String>, _>("statut").unwrap_or(None),
            "montant_total": row.try_get::<Option<f64>, _>("montant_total").unwrap_or(None),
            "reference_paiement": row.try_get::<Option<String>, _>("reference_paiement").unwrap_or(None),
            "user_nom": row.try_get::<Option<String>, _>("user_nom").unwrap_or(None),
            "user_prenom": row.try_get::<Option<String>, _>("user_prenom").unwrap_or(None),
            "user_email": row.try_get::<Option<String>, _>("user_email").unwrap_or(None),
            "admin_nom": row.try_get::<Option<String>, _>("admin_nom").unwrap_or(None),
            "admin_prenom": row.try_get::<Option<String>, _>("admin_prenom").unwrap_or(None),
            "created_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at").unwrap_or(None),
        })
    }).collect();

    // Calculer les totaux
    let totaux_row = sqlx::query(
        r#"
        SELECT 
            COUNT(*) as total_remboursements,
            COUNT(CASE WHEN statut = 'approuve' THEN 1 END) as remboursements_approuves,
            COUNT(CASE WHEN statut = 'rejete' THEN 1 END) as remboursements_rejetes,
            COUNT(CASE WHEN statut = 'en_attente' THEN 1 END) as remboursements_en_attente,
            SUM(montant_rembourse) FILTER (WHERE statut = 'approuve') as total_rembourse
        FROM demandes_remboursement
        "#,
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur totaux: {}", e)))?;
    let totaux = {
        use sqlx::Row;
        serde_json::json!({
            "total_remboursements": totaux_row.try_get::<Option<i64>, _>("total_remboursements").unwrap_or(None),
            "remboursements_approuves": totaux_row.try_get::<Option<i64>, _>("remboursements_approuves").unwrap_or(None),
            "remboursements_rejetes": totaux_row.try_get::<Option<i64>, _>("remboursements_rejetes").unwrap_or(None),
            "remboursements_en_attente": totaux_row.try_get::<Option<i64>, _>("remboursements_en_attente").unwrap_or(None),
            "total_rembourse": totaux_row.try_get::<Option<f64>, _>("total_rembourse").unwrap_or(None),
        })
    };

    Ok(Json(serde_json::json!({
        "success": true,
        "remboursements": remboursements,
        "totaux": totaux,
        "limit": limit,
        "offset": offset
    })))
}

/// Obtenir les statistiques des paiements
pub async fn get_statistiques_paiements(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<GetStatistiquesQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_statistiques_paiements] Admin: {}", admin_id);

    // TODO: Vérifier que c'est un admin

    // Statistiques par méthode de paiement
    let stats_methodes_rows = sqlx::query(
        r#"
        SELECT 
            methode_paiement,
            COUNT(*) as nb_transactions,
            COUNT(CASE WHEN statut = 'succes' THEN 1 END) as nb_succes,
            SUM(montant_total) as volume_total,
            SUM(commission_app) as commission_totale,
            AVG(montant_total) as montant_moyen
        FROM transactions_agregees
        GROUP BY methode_paiement
        ORDER BY volume_total DESC
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur stats méthodes: {}", e)))?;
    let stats_methodes: Vec<serde_json::Value> = stats_methodes_rows.iter().map(|row| {
        use sqlx::Row;
        serde_json::json!({
            "methode_paiement": row.try_get::<String, _>("methode_paiement").ok(),
            "nb_transactions": row.try_get::<Option<i64>, _>("nb_transactions").unwrap_or(None),
            "nb_succes": row.try_get::<Option<i64>, _>("nb_succes").unwrap_or(None),
            "volume_total": row.try_get::<Option<f64>, _>("volume_total").unwrap_or(None),
            "commission_totale": row.try_get::<Option<f64>, _>("commission_totale").unwrap_or(None),
            "montant_moyen": row.try_get::<Option<f64>, _>("montant_moyen").unwrap_or(None),
        })
    }).collect();

    // Évolution des transactions (30 derniers jours)
    let evolution_rows = sqlx::query(
        r#"
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as nb_transactions,
            SUM(montant_total) as volume_jour,
            SUM(commission_app) as commission_jour,
            COUNT(CASE WHEN statut = 'succes' THEN 1 END) as nb_succes
        FROM transactions_agregees
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur évolution: {}", e)))?;
    let evolution: Vec<serde_json::Value> = evolution_rows.iter().map(|row| {
        use sqlx::Row;
        serde_json::json!({
            "date": row.try_get::<Option<chrono::NaiveDate>, _>("date").unwrap_or(None).map(|d| d.to_string()),
            "nb_transactions": row.try_get::<Option<i64>, _>("nb_transactions").unwrap_or(None),
            "volume_jour": row.try_get::<Option<f64>, _>("volume_jour").unwrap_or(None),
            "commission_jour": row.try_get::<Option<f64>, _>("commission_jour").unwrap_or(None),
            "nb_succes": row.try_get::<Option<i64>, _>("nb_succes").unwrap_or(None),
        })
    }).collect();

    // Top utilisateurs par volume
    let top_utilisateurs_rows = sqlx::query(
        r#"
        SELECT 
            u.id, u.nom, u.prenom, u.email,
            COUNT(ta.id) as nb_transactions,
            SUM(ta.montant_total) as volume_total
        FROM users u
        JOIN transactions_agregees ta ON u.id = ta.user_id
        WHERE ta.statut = 'succes'
        GROUP BY u.id, u.nom, u.prenom, u.email
        ORDER BY volume_total DESC
        LIMIT 10
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur top utilisateurs: {}", e)))?;
    let top_utilisateurs: Vec<serde_json::Value> = top_utilisateurs_rows
        .iter()
        .map(|row| {
            use sqlx::Row;
            serde_json::json!({
                "id": row.try_get::<Uuid, _>("id").ok(),
                "nom": row.try_get::<Option<String>, _>("nom").unwrap_or(None),
                "prenom": row.try_get::<Option<String>, _>("prenom").unwrap_or(None),
                "email": row.try_get::<Option<String>, _>("email").unwrap_or(None),
                "nb_transactions": row.try_get::<Option<i64>, _>("nb_transactions").unwrap_or(None),
                "volume_total": row.try_get::<Option<f64>, _>("volume_total").unwrap_or(None),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "statistiques": {
            "par_methode": stats_methodes,
            "evolution": evolution,
            "top_utilisateurs": top_utilisateurs
        }
    })))
}
