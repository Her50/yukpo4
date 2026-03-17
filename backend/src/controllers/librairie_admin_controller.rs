// ✅ CONTROLLER ADMINISTRATION RÉSEAU LIBRAIRIES
// Gestion librairies partenaires, fournisseurs paiement, statistiques

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
    models::librairie_network::*,
    state::AppState,
};

// ========================================
// PAYLOADS REQUEST/RESPONSE
// ========================================

#[derive(Debug, Deserialize)]
pub struct CreateLibrairiePartnerRequest {
    pub user_id: Uuid,
    pub nom: String,
    pub email: String,
    pub telephone: Option<String>,
    pub gps: String,
    pub ville: String,
    pub quartier: Option<String>,
    pub rayon_service_km: Option<i32>,
    pub horaires_ouverture: Option<String>,
    pub commission_app: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLibrairiePartnerRequest {
    pub nom: Option<String>,
    pub email: Option<String>,
    pub telephone: Option<String>,
    pub gps: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub rayon_service_km: Option<i32>,
    pub statut: Option<LibrairieStatut>,
    pub est_actif: Option<bool>,
    pub horaires_ouverture: Option<String>,
    pub commission_app: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct GetLibrairiesAdminQuery {
    pub statut: Option<LibrairieStatut>,
    pub ville: Option<String>,
    pub est_actif: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub search: Option<String>,
}

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
pub struct GetTransactionsAdminQuery {
    pub statut: Option<TransactionStatut>,
    pub methode_paiement: Option<MethodePaiement>,
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
    pub user_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct GetStatistiquesQuery {
    pub periode: Option<String>, // "jour", "semaine", "mois", "annee"
    pub date_debut: Option<String>,
    pub date_fin: Option<String>,
    pub ville: Option<String>,
}

// ========================================
// ENDPOINTS ADMINISTRATION
// ========================================

/// Créer un partenaire librairie
pub async fn create_librairie_partner(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateLibrairiePartnerRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_librairie_partner] Admin: {}, Librairie: {}",
        admin_id, payload.nom
    );

    // TODO: Vérifier que c'est un admin

    // Vérifier que l'utilisateur existe et n'est pas déjà librairie
    let existing = sqlx::query_scalar!(
        "SELECT id FROM librairie_partners WHERE user_id = $1",
        payload.user_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification: {}", e)))?;

    if existing.is_some() {
        return Err(AppError::BadRequest(
            "Cet utilisateur est déjà un partenaire librairie".to_string(),
        ));
    }

    // Vérifier que l'email n'est pas déjà utilisé
    let email_existing = sqlx::query_scalar!(
        "SELECT id FROM librairie_partners WHERE email = $1",
        payload.email
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérification email: {}", e)))?;

    if email_existing.is_some() {
        return Err(AppError::BadRequest(
            "Cet email est déjà utilisé par une librairie".to_string(),
        ));
    }

    // Valider le format GPS
    if !payload.gps.contains(',') {
        return Err(AppError::BadRequest(
            "Format GPS invalide. Utilisez: latitude,longitude".to_string(),
        ));
    }

    // Créer le partenaire librairie
    let librairie = sqlx::query_as!(
        LibrairiePartner,
        r#"
        INSERT INTO librairie_partners (
            user_id, nom, email, telephone, gps, ville, quartier,
            rayon_service_km, statut, est_actif, rating, temps_moyen_validation,
            commission_app, horaires_ouverture
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'en_validation', true, 0.0, 5, $9, $10)
        RETURNING *
        "#,
        payload.user_id,
        payload.nom,
        payload.email,
        payload.telephone,
        payload.gps,
        payload.ville,
        payload.quartier,
        payload.rayon_service_km.unwrap_or(50),
        payload.commission_app.unwrap_or(0.05),
        payload.horaires_ouverture
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création librairie: {}", e)))?;

    // Mettre à jour le rôle de l'utilisateur vers "librairie"
    sqlx::query!(
        "UPDATE users SET role = 'librairie', updated_at = NOW() WHERE id = $1",
        payload.user_id
    )
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise à jour rôle: {}", e)))?;

    // Envoyer notification au nouveau partenaire
    let mut variables = std::collections::HashMap::new();
    variables.insert("nom_librairie".to_string(), payload.nom.clone());
    variables.insert("ville".to_string(), payload.ville.clone());

    if let Err(e) = crate::services::multilingue_service::envoyer_notification_multilingue(
        &state,
        payload.user_id,
        "librairie.compte_en_validation",
        variables,
        Some(serde_json::json!({
            "type": "librairie_validation",
            "librairie_id": librairie.id
        })),
    )
    .await
    {
        warn!("[create_librairie_partner] Erreur notification: {}", e);
    }

    info!(
        "[create_librairie_partner] Librairie {} créée",
        librairie.id
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "librairie": librairie,
        "message": "Partenaire librairie créé et en attente de validation"
    })))
}

/// Lister les librairies (admin)
pub async fn get_librairies_admin(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<GetLibrairiesAdminQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_librairies_admin] Admin: {}", admin_id);

    // TODO: Vérifier que c'est un admin

    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    let mut query = "
        SELECT lp.*, 
               u.nom as user_nom, u.prenom as user_prenom, u.email as user_email,
               COUNT(DISTINCT cv.id) as nb_validations,
               COUNT(DISTINCT CASE WHEN cv.statut = 'valide_complet' THEN cv.id END) as nb_validations_completees,
               AVG(EXTRACT(EPOCH FROM (cv.timestamp_fin - cv.timestamp_debut))/60) as temps_moyen_validation
        FROM librairie_partners lp
        LEFT JOIN users u ON lp.user_id = u.id
        LEFT JOIN commande_validations cv ON lp.id = cv.librairie_id
    ".to_string();

    let mut bind_count = 1;

    if let Some(statut) = &params.statut {
        query.push_str(&format!(" WHERE lp.statut = '${:?}'", statut));
        bind_count += 1;
    }

    if let Some(ville) = &params.ville {
        if bind_count == 1 {
            query.push_str(" WHERE");
        } else {
            query.push_str(" AND");
        }
        query.push_str(&format!(" lp.ville ILIKE '%{}%'", ville));
        bind_count += 1;
    }

    if let Some(est_actif) = params.est_actif {
        if bind_count == 1 {
            query.push_str(" WHERE");
        } else {
            query.push_str(" AND");
        }
        query.push_str(&format!(" lp.est_actif = {}", est_actif));
        bind_count += 1;
    }

    if let Some(search) = &params.search {
        if bind_count == 1 {
            query.push_str(" WHERE");
        } else {
            query.push_str(" AND");
        }
        query.push_str(&format!(
            " (lp.nom ILIKE '%{}%' OR lp.email ILIKE '%{}%' OR lp.ville ILIKE '%{}%')",
            search, search, search
        ));
    }

    query.push_str(" GROUP BY lp.id, u.nom, u.prenom, u.email ORDER BY lp.created_at DESC");

    let librairies = sqlx::query(&query)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    // Compter le total
    let total = librairies.len();

    Ok(Json(serde_json::json!({
        "success": true,
        "librairies": librairies,
        "total": total,
        "limit": limit,
        "offset": offset
    })))
}

/// Mettre à jour un partenaire librairie
pub async fn update_librairie_partner(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Path(librairie_id): Path<Uuid>,
    Json(payload): Json<UpdateLibrairiePartnerRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_librairie_partner] Admin: {}, Librairie: {}",
        admin_id, librairie_id
    );

    // TODO: Vérifier que c'est un admin

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Vérifier que la librairie existe
    let librairie = sqlx::query_as!(
        LibrairiePartner,
        "SELECT * FROM librairie_partners WHERE id = $1",
        librairie_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Librairie non trouvée".to_string()))?;

    // Mettre à jour les champs
    if let Some(nom) = payload.nom {
        sqlx::query!(
            "UPDATE librairie_partners SET nom = $1 WHERE id = $2",
            nom,
            librairie_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update nom: {}", e)))?;
    }

    if let Some(email) = payload.email {
        // Vérifier que l'email n'est pas déjà utilisé par une autre librairie
        let email_existing = sqlx::query_scalar!(
            "SELECT id FROM librairie_partners WHERE email = $1 AND id != $2",
            email,
            librairie_id
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification email: {}", e)))?;

        if email_existing.is_some() {
            return Err(AppError::BadRequest(
                "Cet email est déjà utilisé".to_string(),
            ));
        }

        sqlx::query!(
            "UPDATE librairie_partners SET email = $1 WHERE id = $2",
            email,
            librairie_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update email: {}", e)))?;
    }

    if let Some(gps) = payload.gps {
        if !gps.contains(',') {
            return Err(AppError::BadRequest("Format GPS invalide".to_string()));
        }
        sqlx::query!(
            "UPDATE librairie_partners SET gps = $1 WHERE id = $2",
            gps,
            librairie_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update gps: {}", e)))?;
    }

    if let Some(ville) = payload.ville {
        sqlx::query!(
            "UPDATE librairie_partners SET ville = $1 WHERE id = $2",
            ville,
            librairie_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update ville: {}", e)))?;
    }

    if let Some(statut) = payload.statut {
        sqlx::query!(
            "UPDATE librairie_partners SET statut = $1 WHERE id = $2",
            statut as LibrairieStatut,
            librairie_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update statut: {}", e)))?;

        // Mettre à jour le rôle utilisateur si nécessaire
        if statut == LibrairieStatut::Actif {
            sqlx::query!(
                "UPDATE users SET role = 'librairie' WHERE id = $1",
                librairie.user_id
            )
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update rôle: {}", e)))?;
        }
    }

    if let Some(est_actif) = payload.est_actif {
        sqlx::query!(
            "UPDATE librairie_partners SET est_actif = $1 WHERE id = $2",
            est_actif,
            librairie_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update actif: {}", e)))?;
    }

    if let Some(commission) = payload.commission_app {
        sqlx::query!(
            "UPDATE librairie_partners SET commission_app = $1 WHERE id = $2",
            commission,
            librairie_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update commission: {}", e)))?;
    }

    // Mettre à jour le timestamp
    sqlx::query!(
        "UPDATE librairie_partners SET updated_at = NOW() WHERE id = $1",
        librairie_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update timestamp: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    // Récupérer la librairie mise à jour
    let librairie_update = sqlx::query_as!(
        LibrairiePartner,
        "SELECT * FROM librairie_partners WHERE id = $1",
        librairie_id
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération: {}", e)))?;

    info!(
        "[update_librairie_partner] Librairie {} mise à jour",
        librairie_id
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "librairie": librairie_update,
        "message": "Partenaire librairie mis à jour avec succès"
    })))
}

/// Obtenir les statistiques du réseau
pub async fn get_statistiques_reseau(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<GetStatistiquesQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_statistiques_reseau] Admin: {}", admin_id);

    // TODO: Vérifier que c'est un admin

    // Statistiques librairies
    let stats_librairies = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as total_librairies,
            COUNT(CASE WHEN statut = 'actif' THEN 1 END) as librairies_actives,
            COUNT(CASE WHEN statut = 'en_validation' THEN 1 END) as librairies_en_validation,
            COUNT(CASE WHEN est_actif = false THEN 1 END) as librairies_inactives,
            AVG(rating) as rating_moyen,
            AVG(temps_moyen_validation) as temps_moyen_validation
        FROM librairie_partners
        "#
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur stats librairies: {}", e)))?;

    // Statistiques commandes
    let mut commandes_query = "
        SELECT 
            COUNT(*) as total_commandes,
            COUNT(CASE WHEN statut = 'validee_complete' THEN 1 END) as commandes_validees,
            COUNT(CASE WHEN statut = 'en_livraison' THEN 1 END) as commandes_en_livraison,
            COUNT(CASE WHEN statut = 'livree' THEN 1 END) as commandes_livrees,
            AVG(budget_total) as budget_moyen,
            SUM(budget_total) as chiffre_affaires
        FROM commandes_mixtes
    "
    .to_string();

    if let Some(date_debut) = &params.date_debut {
        commandes_query.push_str(&format!(" WHERE created_at >= '{}'", date_debut));
    }

    let stats_commandes = sqlx::query(&commandes_query)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur stats commandes: {}", e)))?;

    // Statistiques paiements
    let stats_paiements = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN statut = 'succes' THEN 1 END) as transactions_succes,
            COUNT(CASE WHEN methode_paiement = 'wallet' THEN 1 END) as paiements_wallet,
            COUNT(CASE WHEN methode_paiement = 'mobile_money' THEN 1 END) as paiements_mobile_money,
            COUNT(CASE WHEN methode_paiement = 'carte_bancaire' THEN 1 END) as paiements_carte,
            SUM(montant_total) as volume_total,
            SUM(commission_app) as commission_totale
        FROM transactions_agregees
        "#
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur stats paiements: {}", e)))?;

    // Top villes par nombre de librairies
    let top_villes = sqlx::query!(
        r#"
        SELECT ville, COUNT(*) as nb_librairies
        FROM librairie_partners
        WHERE est_actif = true AND statut = 'actif'
        GROUP BY ville
        ORDER BY nb_librairies DESC
        LIMIT 10
        "#
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur top villes: {}", e)))?;

    // Évolution des commandes (30 derniers jours)
    let evolution_commandes = sqlx::query!(
        r#"
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as nb_commandes,
            SUM(budget_total) as chiffre_affaires_jour
        FROM commandes_mixtes
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        "#
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur évolution: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "statistiques": {
            "librairies": stats_librairies,
            "commandes": stats_commandes,
            "paiements": stats_paiements,
            "top_villes": top_villes,
            "evolution_commandes": evolution_commandes
        }
    })))
}

/// Valider/Rejeter un partenaire librairie
pub async fn valider_librairie_partner(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Path(librairie_id): Path<Uuid>,
    Json(payload): Json<ValidationLibrairieRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[valider_librairie_partner] Admin: {}, Librairie: {}, Action: {}",
        admin_id, librairie_id, payload.action
    );

    // TODO: Vérifier que c'est un admin

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Récupérer la librairie
    let librairie = sqlx::query_as!(
        LibrairiePartner,
        "SELECT * FROM librairie_partners WHERE id = $1",
        librairie_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Librairie non trouvée".to_string()))?;

    match payload.action.as_str() {
        "valider" => {
            // Valider la librairie
            sqlx::query!(
                r#"
                UPDATE librairie_partners 
                SET statut = 'actif', updated_at = NOW()
                WHERE id = $1
                "#,
                librairie_id
            )
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur validation: {}", e)))?;

            // Mettre à jour le rôle utilisateur
            sqlx::query!(
                "UPDATE users SET role = 'librairie', updated_at = NOW() WHERE id = $1",
                librairie.user_id
            )
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update rôle: {}", e)))?;

            // Envoyer notification de validation
            let mut variables = std::collections::HashMap::new();
            variables.insert("nom_librairie".to_string(), librairie.nom.clone());

            if let Err(e) = crate::services::multilingue_service::envoyer_notification_multilingue(
                &state,
                librairie.user_id,
                "librairie.compte_valide",
                variables,
                Some(serde_json::json!({
                    "type": "librairie_validation",
                    "librairie_id": librairie_id,
                    "action": "valide"
                })),
            )
            .await
            {
                warn!("[valider_librairie_partner] Erreur notification: {}", e);
            }

            info!(
                "[valider_librairie_partner] Librairie {} validée",
                librairie_id
            );
        }
        "rejeter" => {
            // Rejeter la librairie
            sqlx::query!(
                r#"
                UPDATE librairie_partners 
                SET statut = 'suspendu', est_actif = false, updated_at = NOW()
                WHERE id = $1
                "#,
                librairie_id
            )
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur rejet: {}", e)))?;

            // Envoyer notification de rejet
            let mut variables = std::collections::HashMap::new();
            variables.insert(
                "motif".to_string(),
                payload.motif.clone().unwrap_or_default(),
            );

            if let Err(e) = crate::services::multilingue_service::envoyer_notification_multilingue(
                &state,
                librairie.user_id,
                "librairie.compte_rejete",
                variables,
                Some(serde_json::json!({
                    "type": "librairie_validation",
                    "librairie_id": librairie_id,
                    "action": "rejete",
                    "motif": payload.motif
                })),
            )
            .await
            {
                warn!("[valider_librairie_partner] Erreur notification: {}", e);
            }

            info!(
                "[valider_librairie_partner] Librairie {} rejetée",
                librairie_id
            );
        }
        _ => {
            return Err(AppError::BadRequest(
                "Action invalide. Utilisez 'valider' ou 'rejeter'".to_string(),
            ));
        }
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Librairie {} avec succès", payload.action),
        "librairie_id": librairie_id
    })))
}

// ========================================
// STRUCTURES SUPPORT
// ========================================

#[derive(Debug, Deserialize)]
pub struct ValidationLibrairieRequest {
    pub action: String, // "valider" ou "rejeter"
    pub motif: Option<String>,
}
