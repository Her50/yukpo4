// ✅ CONTROLLER RÉSEAU LIBRAIRIES - Système intelligent de distribution
// Gestion des commandes mixtes, validation compétitive, QR codes, paiements agrégés

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    Extension,
};
use chrono::Utc;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    models::librairie_network::{
        CommandeLivreNeuf, CommandeLivreOccasion, DestinationQR, LivreQRReference, PointPassage,
        ValidationStatut,
    },
    models::librairie_network_model::*,
    state::AppState,
    utils::{generate_qr_code, generate_reference, send_notification},
};

pub struct ConfigurationSysteme;
impl ConfigurationSysteme {
    pub const COMMISSION_APP: f64 = 0.05;
    pub const RAYON_RECHERCHE_LIBRAIRIE: f64 = 20.0;
    pub const DELAI_VALIDATION_MAX: i64 = 3600;
    pub const DELAI_EXPIRATION_QR: i64 = 86400;
}

// ========================================
// PAYLOADS REQUEST/RESPONSE
// ========================================

#[derive(Debug, Deserialize)]
pub struct GenerateQRCodeRequest {
    pub commande_id: Option<Uuid>,
    pub delivery_id: Option<Uuid>,
    pub coursier_id: Option<i32>,
    pub destinataire_id: Option<i32>,
    pub expediteur_nom: Option<String>,
    pub valide_jusqua: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct ScanQRCodeRequest {
    pub scan_par: i32,
    pub location_scan: Option<String>,
    pub proof_photo_url: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommandeMixteRequest {
    pub budget_total: f64,
    pub devise: Option<String>,
    pub mode_livraison: Option<String>,
    pub adresse_livraison: Option<String>,
    pub gps_livraison: Option<String>,
    pub notes_client: Option<String>,
    pub livres_neufs: Vec<LivreNeufRequest>,
    pub livres_occasion: Vec<LivreOccasionRequest>,
}

#[derive(Debug, Deserialize)]
pub struct LivreNeufRequest {
    pub programme_scolaire_id: Option<Uuid>,
    pub titre: String,
    pub auteur: Option<String>,
    pub editeur: Option<String>,
    pub isbn: Option<String>,
    pub classe: String,
    pub matiere: String,
    pub niveau: Option<String>,
    pub prix_officiel: f64,
    pub quantite: i32,
    pub est_au_programme: bool,
}

#[derive(Debug, Deserialize)]
pub struct LivreOccasionRequest {
    pub livre_scolaire_id: Uuid,
    pub quantite: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommandeRequest {
    pub budget_total: Option<f64>,
    pub mode_livraison: Option<String>,
    pub adresse_livraison: Option<String>,
    pub gps_livraison: Option<String>,
    pub notes_client: Option<String>,
    pub ajouter_livres_neufs: Option<Vec<LivreNeufRequest>>,
    pub supprimer_livres_neufs: Option<Vec<Uuid>>,
    pub ajouter_livres_occasion: Option<Vec<LivreOccasionRequest>>,
    pub supprimer_livres_occasion: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct ValiderBudgetRequest {
    pub commande_id: Uuid,
    pub methode_paiement: MethodePaiement,
}

#[derive(Debug, Deserialize)]
pub struct BroadcastCommandeRequest {
    pub commande_id: Uuid,
    pub rayon_recherche_km: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ValidationLibrairieRequest {
    pub commande_id: Uuid,
    pub livres_valides: Vec<Uuid>, // IDs des livres_neufs validés
    pub notes_validation: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FinaliserCommandeRequest {
    pub commande_id: Uuid,
    pub methode_paiement: MethodePaiement,
}

#[derive(Debug, Deserialize)]
pub struct GenerateQRCodeCoursierRequest {
    pub paquet_id: Uuid,
    pub coursier_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct ValidateQRCodeRequest {
    pub code_secret: String,
    pub coursier_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct OptimiserChaineRequest {
    pub commande_id: Uuid,
    pub coursier_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct GetCommandesQuery {
    pub statut: Option<CommandeStatut>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct GetLibrairiesQuery {
    pub ville: Option<String>,
    pub rayon_km: Option<f64>,
    pub gps_lat: Option<f64>,
    pub gps_lng: Option<f64>,
    pub limit: Option<i64>,
}

// ========================================
// ENDPOINTS PRINCIPAUX
// ========================================

/// Créer une commande mixte (neufs + occasion)
pub async fn create_commande_mixte(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateCommandeMixteRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_commande_mixte] User: {}, Budget: {}",
        user_id, payload.budget_total
    );

    // Validation budget
    if payload.budget_total <= 0.0 {
        return Err(AppError::BadRequest(
            "Le budget doit être supérieur à 0".to_string(),
        ));
    }

    // Calcul total livres neufs
    let total_neufs: f64 =
        payload.livres_neufs.iter().map(|l| l.prix_officiel * l.quantite as f64).sum();

    // Récupérer prix livres occasion
    let mut total_occasion = 0.0;
    for livre_req in &payload.livres_occasion {
        let livre = sqlx::query!(
            "SELECT prix_detecte, valeur_calculee FROM livres_scolaires WHERE id = $1 AND is_active = true",
            livre_req.livre_scolaire_id
        )
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Livre d'occasion non trouvé".to_string()))?;

        let prix = livre
            .valeur_calculee
            .and_then(|v| v.parse::<f64>().ok())
            .or_else(|| livre.prix_detecte.and_then(|p| p.parse::<f64>().ok()))
            .unwrap_or(0.0);

        total_occasion += prix * livre_req.quantite as f64;
    }

    let total_commande = total_neufs + total_occasion;

    if total_commande > payload.budget_total {
        return Err(AppError::BadRequest(format!(
            "Le total des livres ({}) dépasse le budget ({})",
            total_commande, payload.budget_total
        )));
    }

    // Créer la commande
    let commission_app = total_commande * ConfigurationSysteme::COMMISSION_APP;
    let montant_net_libraires = total_commande - commission_app;

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    let commande = sqlx::query_as!(
        CommandeMixte,
        r#"
        INSERT INTO commandes_mixtes (
            user_id, budget_total, devise, statut, mode_livraison,
            adresse_livraison, gps_livraison, notes_client,
            commission_app, montant_net_libraires
        )
        VALUES ($1, $2, $3, 'edition', $4, $5, $6, $7, $8, $9)
        RETURNING *
        "#,
        user_id,
        payload.budget_total,
        payload.devise.unwrap_or_else(|| "XAF".to_string()),
        payload.mode_livraison.unwrap_or_else(|| "coursier".to_string()),
        payload.adresse_livraison,
        payload.gps_livraison,
        payload.notes_client,
        commission_app,
        montant_net_libraires
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création commande: {}", e)))?;

    // Insérer livres neufs
    for livre_req in payload.livres_neufs {
        sqlx::query!(
            r#"
            INSERT INTO commande_livres_neufs (
                commande_id, programme_scolaire_id, titre, auteur, editeur, isbn,
                classe, matiere, niveau, prix_officiel, prix_final, quantite, est_au_programme
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            "#,
            commande.id,
            livre_req.programme_scolaire_id,
            livre_req.titre,
            livre_req.auteur,
            livre_req.editeur,
            livre_req.isbn,
            livre_req.classe,
            livre_req.matiere,
            livre_req.niveau,
            livre_req.prix_officiel,
            livre_req.prix_officiel, // Prix final = prix officiel (ne change pas)
            livre_req.quantite,
            livre_req.est_au_programme
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur insertion livre neuf: {}", e)))?;
    }

    // Insérer livres occasion
    for livre_req in payload.livres_occasion {
        // Récupérer infos livre
        let livre = sqlx::query!(
            "SELECT titre, auteur, classe, matiere, etat_livre, prix_detecte, valeur_calculee, user_id FROM livres_scolaires WHERE id = $1",
            livre_req.livre_scolaire_id
        )
        .fetch_one(&mut *tx)
        .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération livre: {}", e)))?;

        let prix = livre
            .valeur_calculee
            .and_then(|v| v.parse::<f64>().ok())
            .or_else(|| livre.prix_detecte.and_then(|p| p.parse::<f64>().ok()))
            .unwrap_or(0.0);

        sqlx::query!(
            r#"
            INSERT INTO commande_livres_occasion (
                commande_id, livre_scolaire_id, titre, auteur, classe, matiere,
                etat_livre, prix, vendeur_id, quantite
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
            commande.id,
            livre_req.livre_scolaire_id,
            livre.titre,
            livre.auteur,
            livre.classe,
            livre.matiere,
            livre.etat_livre,
            prix,
            livre.user_id,
            livre_req.quantite
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur insertion livre occasion: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    info!(
        "[create_commande_mixte] Commande {} créée avec succès",
        commande.id
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "commande": commande,
        "total_neufs": total_neufs,
        "total_occasion": total_occasion,
        "total_commande": total_commande,
        "commission_app": commission_app,
        "montant_net_libraires": montant_net_libraires
    })))
}

/// Mettre à jour une commande (phase édition)
pub async fn update_commande_mixte(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(commande_id): Path<Uuid>,
    Json(payload): Json<UpdateCommandeRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_commande_mixte] User: {}, Commande: {}",
        user_id, commande_id
    );

    // Vérifier que la commande appartient à l'utilisateur et est en édition
    let commande = sqlx::query_as!(
        CommandeMixte,
        "SELECT * FROM commandes_mixtes WHERE id = $1 AND user_id = $2 AND statut = 'edition'",
        commande_id,
        user_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Commande non trouvée ou non modifiable".to_string()))?;

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Mettre à jour les champs de la commande
    if let Some(budget) = payload.budget_total {
        sqlx::query!(
            "UPDATE commandes_mixtes SET budget_total = $1 WHERE id = $2",
            budget,
            commande_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update budget: {}", e)))?;
    }

    if let Some(mode) = payload.mode_livraison {
        sqlx::query!(
            "UPDATE commandes_mixtes SET mode_livraison = $1 WHERE id = $2",
            mode,
            commande_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update livraison: {}", e)))?;
    }

    // Ajouter livres neufs
    if let Some(livres) = payload.ajouter_livres_neufs {
        for livre_req in livres {
            sqlx::query!(
                r#"
                INSERT INTO commande_livres_neufs (
                    commande_id, programme_scolaire_id, titre, auteur, editeur, isbn,
                    classe, matiere, niveau, prix_officiel, prix_final, quantite, est_au_programme
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                "#,
                commande_id,
                livre_req.programme_scolaire_id,
                livre_req.titre,
                livre_req.auteur,
                livre_req.editeur,
                livre_req.isbn,
                livre_req.classe,
                livre_req.matiere,
                livre_req.niveau,
                livre_req.prix_officiel,
                livre_req.prix_officiel,
                livre_req.quantite,
                livre_req.est_au_programme
            )
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur ajout livre neuf: {}", e)))?;
        }
    }

    // Supprimer livres neufs
    if let Some(livre_ids) = payload.supprimer_livres_neufs {
        for livre_id in livre_ids {
            sqlx::query!(
                "DELETE FROM commande_livres_neufs WHERE id = $1 AND commande_id = $2",
                livre_id,
                commande_id
            )
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur suppression livre neuf: {}", e)))?;
        }
    }

    // Ajouter livres occasion (même logique)
    if let Some(livres) = payload.ajouter_livres_occasion {
        for livre_req in livres {
            let livre = sqlx::query!(
                "SELECT titre, auteur, classe, matiere, etat_livre, prix_detecte, valeur_calculee, user_id FROM livres_scolaires WHERE id = $1",
                livre_req.livre_scolaire_id
            )
            .fetch_one(&mut *tx)
            .await
                .map_err(|e| AppError::Internal(format!("Erreur récupération livre: {}", e)))?;

            let prix = livre
                .valeur_calculee
                .and_then(|v| v.parse::<f64>().ok())
                .or_else(|| livre.prix_detecte.and_then(|p| p.parse::<f64>().ok()))
                .unwrap_or(0.0);

            sqlx::query!(
                r#"
                INSERT INTO commande_livres_occasion (
                    commande_id, livre_scolaire_id, titre, auteur, classe, matiere,
                    etat_livre, prix, vendeur_id, quantite
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                "#,
                commande_id,
                livre_req.livre_scolaire_id,
                livre.titre,
                livre.auteur,
                livre.classe,
                livre.matiere,
                livre.etat_livre,
                prix,
                livre.user_id,
                livre_req.quantite
            )
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur ajout livre occasion: {}", e)))?;
        }
    }

    // Supprimer livres occasion
    if let Some(livre_ids) = payload.supprimer_livres_occasion {
        for livre_id in livre_ids {
            sqlx::query!(
                "DELETE FROM commande_livres_occasion WHERE id = $1 AND commande_id = $2",
                livre_id,
                commande_id
            )
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur suppression livre occasion: {}", e)))?;
        }
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    // Récupérer la commande mise à jour avec détails
    let commande_detail = fetch_commande_details(&state.pg, commande_id).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "commande": commande_detail
    })))
}

/// Valider le budget et passer en attente de validation librairie
pub async fn valider_budget_commande(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<ValiderBudgetRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[valider_budget_commande] User: {}, Commande: {}",
        user_id, payload.commande_id
    );

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Vérifier commande et calculer totaux
    let commande = sqlx::query_as!(
        CommandeMixte,
        "SELECT * FROM commandes_mixtes WHERE id = $1 AND user_id = $2 AND statut = 'edition'",
        payload.commande_id,
        user_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Commande non trouvée ou non valide".to_string()))?;

    // Calculer totaux actuels
    let totaux = calculer_totaux_commande(&mut *tx, payload.commande_id).await?;

    if totaux.total_commande > commande.budget_total {
        return Err(AppError::BadRequest(format!(
            "Le total des livres ({}) dépasse le budget ({})",
            totaux.total_commande, commande.budget_total
        )));
    }

    // Mettre à jour les montants
    let commission_app = totaux.total_commande * ConfigurationSysteme::COMMISSION_APP;
    let montant_net_libraires = totaux.total_commande - commission_app;

    sqlx::query!(
        r#"
        UPDATE commandes_mixtes 
        SET statut = 'validation_budget',
            commission_app = $1,
            montant_net_libraires = $2,
            updated_at = NOW()
        WHERE id = $3
        "#,
        commission_app,
        montant_net_libraires,
        payload.commande_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update statut: {}", e)))?;

    // Créer transaction agrégée
    let reference_paiement = generate_reference("PAY");
    sqlx::query_as!(
        TransactionAgregee,
        r#"
        INSERT INTO transactions_agregees (
            commande_id, user_id, montant_total, devise, methode_paiement,
            statut, reference_paiement, commission_app, montant_net
        )
        VALUES ($1, $2, $3, 'XAF', $4, 'en_attente', $5, $6, $7)
        RETURNING *
        "#,
        payload.commande_id,
        user_id,
        totaux.total_commande,
        payload.methode_paiement as MethodePaiement,
        reference_paiement,
        commission_app,
        montant_net_libraires
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création transaction: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    info!(
        "[valider_budget_commande] Budget validé pour commande {}",
        payload.commande_id
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Budget validé. Prêt pour envoi aux librairies.",
        "totaux": totaux,
        "commission_app": commission_app,
        "montant_net_libraires": montant_net_libraires
    })))
}

/// Diffuser la commande aux librairies proches
pub async fn broadcast_commande_librairies(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<BroadcastCommandeRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[broadcast_commande_librairies] User: {}, Commande: {}",
        user_id, payload.commande_id
    );

    // Récupérer commande avec GPS
    let commande = sqlx::query!(
        r#"
        SELECT cm.*, 
               STRING_AGG(DISTINCT cln.classe, ', ') as classes_neuf,
               STRING_AGG(DISTINCT clo.classe, ', ') as classes_occasion
        FROM commandes_mixtes cm
        LEFT JOIN commande_livres_neufs cln ON cm.id = cln.commande_id
        LEFT JOIN commande_livres_occasion clo ON cm.id = clo.commande_id
        WHERE cm.id = $1 AND cm.user_id = $2 AND cm.statut = 'validation_budget'
        GROUP BY cm.id
        "#,
        payload.commande_id,
        user_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Commande non trouvée ou non prête".to_string()))?;

    let gps_livraison = commande.gps_livraison.as_deref().unwrap_or("");
    if gps_livraison.is_empty() {
        return Err(AppError::BadRequest(
            "GPS de livraison requis pour diffusion".to_string(),
        ));
    }

    // Parser GPS
    let (lat, lng) = parse_gps(gps_livraison)?;

    let rayon = payload
        .rayon_recherche_km
        .unwrap_or(ConfigurationSysteme::RAYON_RECHERCHE_LIBRAIRIE);

    // Récupérer librairies proches
    let librairies = sqlx::query_as!(
        LibrairiePartner,
        r#"
        SELECT * FROM librairie_partners lp
        WHERE lp.est_actif = true 
          AND lp.statut = 'actif'
          AND distance_gps($1, $2, 
                           SPLIT_PART(lp.gps, ',', 1)::FLOAT, 
                           SPLIT_PART(lp.gps, ',', 2)::FLOAT) <= $3
        ORDER BY distance_gps($1, $2, 
                             SPLIT_PART(lp.gps, ',', 1)::FLOAT, 
                             SPLIT_PART(lp.gps, ',', 2)::FLOAT)
        LIMIT 20
        "#,
        lat,
        lng,
        rayon as f64
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur recherche librairies: {}", e)))?;

    if librairies.is_empty() {
        return Err(AppError::NotFound(
            "Aucune librairie active trouvée dans votre zone".to_string(),
        ));
    }

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Mettre à jour statut commande
    sqlx::query!(
        "UPDATE commandes_mixtes SET statut = 'envoyee_librairies', updated_at = NOW() WHERE id = $1",
        payload.commande_id
    )
    .execute(&mut *tx)
    .await
        .map_err(|e| AppError::Internal(format!("Erreur update statut: {}", e)))?;

    // Créer validations pour chaque librairie
    let mut notifications_created = Vec::new();
    for librairie in &librairies {
        // Créer entrée validation
        let validation = sqlx::query_as!(
            CommandeValidation,
            r#"
            INSERT INTO commande_validations (commande_id, librairie_id, statut, verrou_exclusif)
            VALUES ($1, $2, 'en_cours', false)
            RETURNING *
            "#,
            payload.commande_id,
            librairie.id
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création validation: {}", e)))?;

        // Créer notification
        let message = format!(
            "Nouvelle commande {} à valider ({} livres neufs, {} livres occasion)",
            commande.reference_commande,
            commande.classes_neuf.as_deref().unwrap_or("0"),
            commande.classes_occasion.as_deref().unwrap_or("0")
        );

        let notification = sqlx::query_as!(
            NotificationLibrairie,
            r#"
            INSERT INTO notifications_librairie (
                librairie_id, commande_id, type_notification, message, statut
            )
            VALUES ($1, $2, 'nouvelle_commande', $3, 'envoyee')
            RETURNING *
            "#,
            librairie.id,
            payload.commande_id,
            message
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création notification: {}", e)))?;

        notifications_created.push((librairie.clone(), validation, notification));
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    // Envoyer notifications push (async)
    for (librairie, _, notification) in &notifications_created {
        if let Err(e) = send_notification(
            &state,
            librairie.user_id,
            "Nouvelle commande à valider",
            &notification.message,
            Some(serde_json::json!({
                "type": "nouvelle_commande",
                "commande_id": payload.commande_id,
                "notification_id": notification.id
            })),
        )
        .await
        {
            warn!(
                "[broadcast_commande_librairies] Erreur notification {}: {}",
                librairie.id, e
            );
        }
    }

    info!(
        "[broadcast_commande_librairies] Diffusée à {} librairies",
        librairies.len()
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Commande diffusée aux librairies proches",
        "librairies_notifiees": librairies.len(),
        "rayon_recherche": rayon,
        "delai_validation": ConfigurationSysteme::DELAI_VALIDATION_MAX
    })))
}

/// Librairie: Valider des livres dans une commande
pub async fn valider_livres_commande(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: librairie_user_id,
        ..
    }): Extension<AuthenticatedUser>,
    Json(payload): Json<ValidationLibrairieRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[valider_livres_commande] Librairie: {}, Commande: {}",
        librairie_user_id, payload.commande_id
    );

    // Vérifier que c'est un librairie
    let librairie = sqlx::query_as!(
        LibrairiePartner,
        "SELECT * FROM librairie_partners WHERE user_id = $1 AND est_actif = true AND statut = 'actif'",
        librairie_user_id
    )
    .fetch_optional(&state.pg)
    .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::Forbidden("Accès réservé aux librairies actives".to_string()))?;

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Vérifier validation existante
    let mut validation = sqlx::query_as!(
        CommandeValidation,
        r#"
        SELECT * FROM commande_validations 
        WHERE commande_id = $1 AND librairie_id = $2 
        FOR UPDATE
        "#,
        payload.commande_id,
        librairie.id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Validation non trouvée".to_string()))?;

    // Vérifier qu'une autre librairie n'a pas déjà pris le verrou
    if validation.verrou_exclusif && validation.statut != ValidationStatut::EnCours {
        return Err(AppError::Conflict(
            "Une autre librairie est déjà en train de valider cette commande".to_string(),
        ));
    }

    // Prendre le verrou exclusif
    sqlx::query!(
        r#"
        UPDATE commande_validations 
        SET verrou_exclusif = true, 
            timestamp_debut = NOW(),
            notes_validation = $1
        WHERE id = $2
        "#,
        payload.notes_validation,
        validation.id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur prise verrou: {}", e)))?;

    // Marquer les livres comme validés
    let mut livres_valides_count = 0;
    for livre_id in &payload.livres_valides {
        let result = sqlx::query!(
            r#"
            UPDATE commande_livres_neufs 
            SET statut_validation = 'valide', 
                librairie_validateur_id = $1
            WHERE id = $2 AND commande_id = $3 AND statut_validation = 'en_attente'
            RETURNING id
            "#,
            librairie.id,
            livre_id,
            payload.commande_id
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur validation livre: {}", e)))?;

        if result.is_some() {
            livres_valides_count += 1;
        }
    }

    // Marquer les livres non validés comme indisponibles
    sqlx::query!(
        r#"
        UPDATE commande_livres_neufs 
        SET statut_validation = 'indisponible'
        WHERE commande_id = $1 
          AND statut_validation = 'en_attente'
          AND id != ALL($2)
        "#,
        payload.commande_id,
        &payload.livres_valides
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur marquage indisponibles: {}", e)))?;

    // Déterminer le statut de validation
    let total_livres_neufs: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM commande_livres_neufs WHERE commande_id = $1",
        payload.commande_id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur comptage: {}", e)))?
    .unwrap_or(0);

    let livres_valides_total: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM commande_livres_neufs WHERE commande_id = $1 AND statut_validation = 'valide'",
        payload.commande_id
    )
    .fetch_one(&mut *tx)
    .await
        .map_err(|e| AppError::Internal(format!("Erreur comptage validés: {}", e)))?
        .unwrap_or(0);

    let statut_validation = if livres_valides_total as i64 == total_livres_neufs {
        ValidationStatut::ValideComplet
    } else if livres_valides_total > 0 {
        ValidationStatut::ValidePartiel
    } else {
        ValidationStatut::Abandonne
    };

    // Mettre à jour la validation
    sqlx::query!(
        r#"
        UPDATE commande_validations 
        SET statut = $1, 
            livres_valides = $2,
            timestamp_fin = NOW(),
            verrou_exclusif = false
        WHERE id = $3
        "#,
        statut_validation as ValidationStatut,
        serde_json::to_value(&payload.livres_valides).unwrap_or(serde_json::Value::Array(vec![])),
        validation.id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update validation: {}", e)))?;

    // Mettre à jour le statut de la commande
    match statut_validation {
        ValidationStatut::ValideComplet => {
            sqlx::query!(
                "UPDATE commandes_mixtes SET statut = 'validee_complete', updated_at = NOW() WHERE id = $1",
                payload.commande_id
            )
            .execute(&mut *tx)
            .await
                .map_err(|e| AppError::Internal(format!("Erreur update commande: {}", e)))?;
        }
        ValidationStatut::ValidePartiel => {
            sqlx::query!(
                "UPDATE commandes_mixtes SET statut = 'validee_partielle', updated_at = NOW() WHERE id = $1",
                payload.commande_id
            )
            .execute(&mut *tx)
            .await
                .map_err(|e| AppError::Internal(format!("Erreur update commande: {}", e)))?;

            // Libérer les autres librairies pour les livres restants
            sqlx::query!(
                r#"
                UPDATE commande_validations 
                SET statut = 'abandonne', verrou_exclusif = false
                WHERE commande_id = $1 AND librairie_id != $2 AND statut = 'en_cours'
                "#,
                payload.commande_id,
                librairie.id
            )
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur libération autres: {}", e)))?;
        }
        _ => {
            sqlx::query!(
                "UPDATE commandes_mixtes SET statut = 'en_validation', updated_at = NOW() WHERE id = $1",
                payload.commande_id
            )
            .execute(&mut *tx)
            .await
                .map_err(|e| AppError::Internal(format!("Erreur update commande: {}", e)))?;
        }
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    info!(
        "[valider_livres_commande] {} livres validés par librairie {}",
        livres_valides_count, librairie.id
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "livres_valides": livres_valides_count,
        "statut_validation": format!("{:?}", statut_validation),
        "message": match statut_validation {
            ValidationStatut::ValideComplet => "Tous les livres validés. Commande prête pour paiement.",
            ValidationStatut::ValidePartiel => "Validation partielle. Les autres librairies peuvent valider les livres restants.",
            _ => "Aucun livre validé. Commande reste en attente."
        }
    })))
}

/// Finaliser la commande et créer la chaîne de livraison
pub async fn finaliser_commande(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<FinaliserCommandeRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[finaliser_commande] User: {}, Commande: {}",
        user_id, payload.commande_id
    );

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Vérifier commande
    let commande = sqlx::query_as!(
        CommandeMixte,
        "SELECT * FROM commandes_mixtes WHERE id = $1 AND user_id = $2 AND statut IN ('validee_complete', 'validee_partielle')",
        payload.commande_id,
        user_id
    )
    .fetch_optional(&mut *tx)
    .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Commande non trouvée ou non finalisable".to_string()))?;

    // Calculer totaux finaux
    let totaux = calculer_totaux_commande(&mut *tx, payload.commande_id).await?;

    // Traiter le paiement
    let reference_paiement = format!("PAY-{}", generate_reference(""));

    // TODO: Intégration avec système de paiement agrégé
    // Pour l'instant, on simule un paiement réussi

    sqlx::query!(
        r#"
        UPDATE transactions_agregees 
        SET statut = 'succes', 
            provider_transaction_id = $1,
            updated_at = NOW()
        WHERE commande_id = $2 AND user_id = $3
        "#,
        reference_paiement,
        payload.commande_id,
        user_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update transaction: {}", e)))?;

    // Mettre à jour statut commande
    sqlx::query!(
        "UPDATE commandes_mixtes SET statut = 'en_preparation', updated_at = NOW() WHERE id = $1",
        payload.commande_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update commande: {}", e)))?;

    // Créer la chaîne de livraison unifiée
    let chaine = creer_chaine_livraison(&mut *tx, payload.commande_id).await?;

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    info!(
        "[finaliser_commande] Commande {} finalisée, chaîne {} créée",
        payload.commande_id, chaine.id
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Commande finalisée avec succès",
        "reference_paiement": reference_paiement,
        "chaine_livraison": chaine,
        "totaux": totaux
    })))
}

/// Générer QR code pour coursier
pub async fn generer_qr_code_coursier(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: coursier_id, ..
    }): Extension<AuthenticatedUser>,
    Json(payload): Json<GenerateQRCodeRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[generer_qr_code_coursier] Coursier: {}, Paquet: {}",
        coursier_id, payload.paquet_id
    );

    // Vérifier que c'est un coursier actif
    // TODO: Vérifier rôle coursier dans la table users

    // Récupérer détails du paquet
    let paquet = sqlx::query!(
        r#"
        SELECT dp.*, 
               cm.reference_commande,
               cm.user_id as commande_user_id
        FROM delivery_packages dp
        JOIN chaines_livraison_unifiees clu ON dp.chaine_id = clu.id
        JOIN commandes_mixtes cm ON clu.commande_id = cm.id
        WHERE dp.id = $1
        "#,
        payload.paquet_id
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Paquet non trouvé".to_string()))?;

    // Générer code secret
    let code_secret = format!("QR-{}", generate_reference(""));

    // Préparer données QR
    let qr_data = serde_json::json!({
        "paquet_id": payload.paquet_id,
        "coursier_id": coursier_id,
        "code_secret": code_secret,
        "timestamp": Utc::now().to_rfc3339(),
        "reference_commande": paquet.reference_commande
    });

    let qr_code_data = generate_qr_code(&qr_data.to_string())?;

    // Récupérer livres attendus et destinations
    let (livres_attendus, destinations) = preparer_donnees_qr(&state.pg, payload.paquet_id).await?;

    let qr_code = sqlx::query_as!(
        QRCodeCoursier,
        r#"
        INSERT INTO qr_codes_coursier (
            paquet_id, coursier_id, code_secret, qr_code_data,
            livres_attendus, destinations
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
        payload.paquet_id,
        coursier_id,
        code_secret,
        qr_code_data,
        serde_json::to_value(&livres_attendus).unwrap_or(serde_json::Value::Array(vec![])),
        serde_json::to_value(&destinations).unwrap_or(serde_json::Value::Array(vec![]))
    )
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création QR code: {}", e)))?;

    info!(
        "[generer_qr_code_coursier] QR code {} généré pour paquet {}",
        qr_code.id, payload.paquet_id
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "qr_code": qr_code,
        "code_secret": code_secret,
        "livres_attendus": livres_attendus,
        "destinations": destinations
    })))
}

/// Valider QR code par coursier
pub async fn valider_qr_code_coursier(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: coursier_id, ..
    }): Extension<AuthenticatedUser>,
    Json(payload): Json<ValidateQRCodeRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[valider_qr_code_coursier] Coursier: {}, Code: {}",
        coursier_id, payload.code_secret
    );

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Récupérer QR code
    let mut qr_code = sqlx::query_as!(
        QRCodeCoursier,
        r#"
        SELECT * FROM qr_codes_coursier 
        WHERE code_secret = $1 AND coursier_id = $2 AND statut = 'genere'
        FOR UPDATE
        "#,
        payload.code_secret,
        coursier_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("QR code non trouvé ou déjà utilisé".to_string()))?;

    // Vérifier expiration (24h)
    let expiration_time = qr_code.timestamp_generation
        + chrono::Duration::seconds(ConfigurationSysteme::DELAI_EXPIRATION_QR as i64);
    if Utc::now() > expiration_time {
        sqlx::query!(
            "UPDATE qr_codes_coursier SET statut = 'expire' WHERE id = $1",
            qr_code.id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update statut: {}", e)))?;

        return Err(AppError::BadRequest("QR code expiré".to_string()));
    }

    // Marquer comme scanné
    sqlx::query!(
        r#"
        UPDATE qr_codes_coursier 
        SET statut = 'scanne', 
            timestamp_scan = NOW()
        WHERE id = $1
        "#,
        qr_code.id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update scan: {}", e)))?;

    // TODO: Intégrer validation biométrique ou code PIN coursier

    // Marquer comme validé
    sqlx::query!(
        r#"
        UPDATE qr_codes_coursier 
        SET statut = 'valide', 
            timestamp_validation = NOW()
        WHERE id = $1
        "#,
        qr_code.id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update validation: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    info!("[valider_qr_code_coursier] QR code {} validé", qr_code.id);

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "QR code validé avec succès",
        "paquet_id": qr_code.paquet_id,
        "livres_attendus": qr_code.livres_attendus,
        "destinations": qr_code.destinations
    })))
}

/// Optimiser chaîne de livraison
pub async fn optimiser_chaine_livraison(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<OptimiserChaineRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[optimiser_chaine_livraison] User: {}, Commande: {}",
        user_id, payload.commande_id
    );

    // TODO: Vérifier que l'utilisateur est autorisé (coursier ou admin)

    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

    // Récupérer chaîne existante
    let mut chaine = sqlx::query_as!(
        ChaineLivraisonUnifiee,
        "SELECT * FROM chaines_livraison_unifiees WHERE commande_id = $1",
        payload.commande_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Chaîne de livraison non trouvée".to_string()))?;

    // Optimiser l'itinéraire (algorithme nearest neighbor TSP)
    let points_optimises = optimiser_itineraire(&mut *tx, payload.commande_id).await?;

    // Calculer distance et durée estimées
    let (distance_totale, duree_estimee) = calculer_metrics_itineraire(&points_optimises);

    // Mettre à jour la chaîne
    sqlx::query!(
        r#"
        UPDATE chaines_livraison_unifiees 
        SET points_passage = $1,
            distance_totale_km = $2,
            duree_estimee_minutes = $3,
            statut = 'optimisee',
            coursier_id = $4,
            updated_at = NOW()
        WHERE id = $5
        "#,
        serde_json::to_value(&points_optimises).unwrap_or(serde_json::Value::Array(vec![])),
        distance_totale,
        duree_estimee,
        payload.coursier_id,
        chaine.id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update chaîne: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    info!(
        "[optimiser_chaine_livraison] Chaîne {} optimisée",
        chaine.id
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "chaine": {
            "id": chaine.id,
            "reference_chaine": chaine.reference_chaine,
            "distance_totale_km": distance_totale,
            "duree_estimee_minutes": duree_estimee,
            "points_passage": points_optimises
        }
    })))
}

/// Lister les commandes d'un utilisateur
pub async fn get_mes_commandes(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<GetCommandesQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_mes_commandes] User: {}", user_id);

    let limit = params.limit.unwrap_or(20);
    let offset = params.offset.unwrap_or(0);

    let mut query = "
        SELECT cm.*, 
               COUNT(DISTINCT cln.id) as nb_livres_neufs,
               COUNT(DISTINCT clo.id) as nb_livres_occasion
        FROM commandes_mixtes cm
        LEFT JOIN commande_livres_neufs cln ON cm.id = cln.commande_id
        LEFT JOIN commande_livres_occasion clo ON cm.id = clo.commande_id
        WHERE cm.user_id = $1
    "
    .to_string();

    if let Some(statut) = params.statut {
        query.push_str(&format!(" AND cm.statut = '{}'", statut));
    }

    query.push_str(" GROUP BY cm.id ORDER BY cm.created_at DESC LIMIT $2 OFFSET $3");

    let commandes = sqlx::query(&query)
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "commandes": commandes,
        "total": commandes.len()
    })))
}

/// Lister les librairies proches
pub async fn get_librairies_proches(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetLibrairiesQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_librairies_proches] Recherche librairies");

    let limit = params.limit.unwrap_or(20);

    let mut query = "
        SELECT lp.*,
               CASE 
                   WHEN $2 IS NOT NULL AND $3 IS NOT NULL 
                   THEN distance_gps($2, $3, 
                                     SPLIT_PART(lp.gps, ',', 1)::FLOAT, 
                                     SPLIT_PART(lp.gps, ',', 2)::FLOAT)
                   ELSE NULL 
               END as distance_km
        FROM librairie_partners lp
        WHERE lp.est_actif = true AND lp.statut = 'actif'
    "
    .to_string();

    let mut bind_count = 4;

    if let Some(ville) = &params.ville {
        query.push_str(&format!(" AND lp.ville ILIKE '%{}%'", ville));
    }

    if let (Some(lat), Some(lng)) = (params.gps_lat, params.gps_lng) {
        if let Some(rayon) = params.rayon_km {
            query.push_str(&format!(
                " AND distance_gps($1, $2, SPLIT_PART(lp.gps, ',', 1)::FLOAT, SPLIT_PART(lp.gps, ',', 2)::FLOAT) <= {}",
                rayon
            ));
        }
    }

    query.push_str(" ORDER BY distance_km NULLS LAST, lp.rating DESC LIMIT $");
    query.push_str(&bind_count.to_string());

    let mut query_builder = sqlx::query(&query);
    query_builder = query_builder.bind(params.gps_lat.unwrap_or(0.0));
    query_builder = query_builder.bind(params.gps_lng.unwrap_or(0.0));

    if let Some(ville) = &params.ville {
        query_builder = query_builder.bind(ville);
    }

    let librairies = query_builder
        .bind(limit)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "librairies": librairies,
        "total": librairies.len()
    })))
}

/// Get détails complets d'une commande
pub async fn get_commande_details(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(commande_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_commande_details] User: {}, Commande: {}",
        user_id, commande_id
    );

    let details = fetch_commande_details(&state.pg, commande_id).await?;

    // Vérifier autorisation
    if details.commande.user_id != user_id {
        return Err(AppError::Forbidden("Accès non autorisé".to_string()));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "details": details
    })))
}

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

async fn fetch_commande_details(
    pg: &sqlx::PgPool,
    commande_id: Uuid,
) -> Result<CommandeDetail, AppError> {
    let commande = sqlx::query_as!(
        CommandeMixte,
        "SELECT * FROM commandes_mixtes WHERE id = $1",
        commande_id
    )
    .fetch_one(pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let livres_neufs = sqlx::query_as!(
        CommandeLivreNeuf,
        "SELECT * FROM commande_livres_neufs WHERE commande_id = $1",
        commande_id
    )
    .fetch_all(pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let livres_occasion = sqlx::query_as!(
        CommandeLivreOccasion,
        "SELECT * FROM commande_livres_occasion WHERE commande_id = $1",
        commande_id
    )
    .fetch_all(pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    Ok(CommandeDetail {
        commande,
        livres_neufs,
        livres_occasion,
    })
}

async fn calculer_totaux_commande(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    commande_id: Uuid,
) -> Result<TotauxCommande, AppError> {
    let total_neufs: f64 = sqlx::query_scalar!(
        "SELECT COALESCE(SUM(prix_final * quantite), 0) FROM commande_livres_neufs WHERE commande_id = $1",
        commande_id
    )
    .fetch_one(&mut **tx)
    .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .unwrap_or(0.0);

    let total_occasion: f64 = sqlx::query_scalar!(
        "SELECT COALESCE(SUM(prix * quantite), 0) FROM commande_livres_occasion WHERE commande_id = $1",
        commande_id
    )
    .fetch_one(&mut **tx)
    .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .unwrap_or(0.0);

    let total_commande = total_neufs + total_occasion;
    let commission_app = total_commande * ConfigurationSysteme::COMMISSION_APP;
    let montant_net_libraires = total_commande - commission_app;

    Ok(TotauxCommande {
        total_neufs,
        total_occasion,
        total_commande,
        commission_app,
        montant_net_libraires,
    })
}

fn parse_gps(gps: &str) -> Result<(f64, f64), AppError> {
    let parts: Vec<&str> = gps.split(',').collect();
    if parts.len() != 2 {
        return Err(AppError::BadRequest("Format GPS invalide".to_string()));
    }

    let lat = parts[0]
        .trim()
        .parse::<f64>()
        .map_err(|_| AppError::BadRequest("Latitude invalide".to_string()))?;
    let lng = parts[1]
        .trim()
        .parse::<f64>()
        .map_err(|_| AppError::BadRequest("Longitude invalide".to_string()))?;

    Ok((lat, lng))
}

async fn creer_chaine_livraison(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    commande_id: Uuid,
) -> Result<ChaineLivraisonUnifiee, AppError> {
    // Récupérer tous les points de passage nécessaires
    let points_passage = vec![
        // TODO: Construire les points (librairies, vendeurs, acheteurs)
    ];

    let chaine = sqlx::query_as!(
        ChaineLivraisonUnifiee,
        r#"
        INSERT INTO chaines_livraison_unifiees (
            commande_id, points_passage, distance_totale_km, duree_estimee_minutes
        )
        VALUES ($1, $2, 0, 0)
        RETURNING *
        "#,
        commande_id,
        serde_json::to_value(&points_passage).unwrap_or(serde_json::Value::Array(vec![]))
    )
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création chaîne: {}", e)))?;

    Ok(chaine)
}

async fn preparer_donnees_qr(
    pg: &sqlx::PgPool,
    paquet_id: Uuid,
) -> Result<(Vec<LivreQRReference>, Vec<DestinationQR>), AppError> {
    // TODO: Implémenter la préparation des données QR
    Ok((vec![], vec![]))
}

async fn optimiser_itineraire(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    commande_id: Uuid,
) -> Result<Vec<PointPassage>, AppError> {
    // TODO: Implémenter l'algorithme d'optimisation TSP
    Ok(vec![])
}

fn calculer_metrics_itineraire(points: &[PointPassage]) -> (f64, i32) {
    // TODO: Calculer distance totale et durée estimée
    (0.0, 0)
}

/// POST /api/librairie-network/register
/// Enregistrement public pour les librairies partenaires
pub async fn register_librairie_publique(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateLibrairieRequest>,
) -> Result<impl IntoResponse, AppError> {
    let pool = &state.pg;

    // Validation des données
    if payload.nom.trim().is_empty() {
        return Err(AppError::BadRequest("Le nom est requis".to_string()));
    }

    if payload.email.trim().is_empty() {
        return Err(AppError::BadRequest("L'email est requis".to_string()));
    }

    if payload.telephone.trim().is_empty() {
        return Err(AppError::BadRequest("Le téléphone est requis".to_string()));
    }

    if payload.gps.is_none() || payload.gps.as_ref().unwrap().trim().is_empty() {
        return Err(AppError::BadRequest(
            "La localisation GPS est requise".to_string(),
        ));
    }

    // Vérifier si l'email existe déjà
    let existing_email: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM librairie_partners WHERE email = $1)")
            .bind(&payload.email)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                log::error!(
                    "[register_librairie_publique] Erreur vérification email: {}",
                    e
                );
                AppError::Internal("Erreur vérification email".to_string())
            })?;

    if existing_email {
        return Err(AppError::BadRequest(
            "Cet email est déjà utilisé".to_string(),
        ));
    }

    // Créer le partenaire librairie
    let librairie_id = Uuid::new_v4();
    let commission_app = 5.0; // 5% de commission par défaut

    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO librairie_partners (
            id, user_id, nom, email, telephone, adresse, ville, pays,
            statut, type_fournisseur, commission_app, date_creation,
            gps, actif
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14
        )
        "#,
    )
    .bind(librairie_id)
    .bind(Uuid::new_v4()) // user_id temporaire
    .bind(&payload.nom)
    .bind(&payload.email)
    .bind(&payload.telephone)
    .bind(&payload.adresse)
    .bind(&payload.ville)
    .bind(&payload.pays)
    .bind("en_attente") // statut
    .bind(&payload.type_fournisseur)
    .bind(commission_app)
    .bind(now)
    .bind(&payload.gps)
    .bind(true) // actif
    .execute(pool)
    .await
    .map_err(|e| {
        log::error!(
            "[register_librairie_publique] Erreur création librairie: {}",
            e
        );
        AppError::Internal("Erreur création librairie".to_string())
    })?;

    // Envoyer une notification interne aux administrateurs
    let mut variables = HashMap::new();
    variables.insert("librairie_nom".to_string(), payload.nom.clone());
    variables.insert("librairie_email".to_string(), payload.email.clone());
    variables.insert("librairie_ville".to_string(), payload.ville.clone());
    variables.insert("commission_app".to_string(), format!("{}%", commission_app));

    if let Err(e) = state
        .multilingue_service
        .send_notification(
            "librairie.compte_rejete", // Clé de notification (à adapter)
            variables,
            None, // Pas d'utilisateur spécifique pour les admins
        )
        .await
    {
        log::warn!(
            "[register_librairie_publique] Erreur notification admin: {}",
            e
        );
    }

    log::info!(
        "[register_librairie_publique] Librairie {} enregistrée avec succès",
        payload.nom
    );

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "success": true,
            "message": "Votre demande d'inscription a été soumise avec succès",
            "librairie_id": librairie_id,
            "commission_app": commission_app,
            "statut": "en_attente"
        })),
    ))
}

/// POST /api/librairie-network/qrcode/share
/// Générer un QR code partageable pour une livraison
pub async fn generate_shareable_qrcode(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<GenerateQRCodeRequest>,
) -> Result<impl IntoResponse, AppError> {
    let pool = &state.pg;

    // Validation
    if payload.commande_id.is_none() && payload.delivery_id.is_none() {
        return Err(AppError::BadRequest(
            "commande_id ou delivery_id est requis".to_string(),
        ));
    }

    let qr_id = Uuid::new_v4();
    let now = Utc::now();

    // Générer les données du QR code
    let qr_data = if let Some(commande_id) = payload.commande_id {
        format!("LIBRAIRIE_CMD:{}:{}", commande_id, qr_id)
    } else if let Some(delivery_id) = payload.delivery_id {
        format!("DELIVERY:{}:{}", delivery_id, qr_id)
    } else {
        return Err(AppError::BadRequest("ID requis".to_string()));
    };

    // Générer le QR code image
    let qr_code_image = generate_qr_code(&qr_data).map_err(|e| {
        log::error!("[generate_shareable_qrcode] Erreur génération QR: {}", e);
        AppError::Internal("Erreur génération QR code".to_string())
    })?;

    // Sauvegarder en base
    sqlx::query(
        r#"
        INSERT INTO qr_code_coursier (
            id, commande_id, delivery_id, coursier_id, qr_code_data, 
            statut, date_generation, qr_code_image, partageable, 
            genere_par, valide_jusqua
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#,
    )
    .bind(qr_id)
    .bind(payload.commande_id)
    .bind(payload.delivery_id)
    .bind(payload.coursier_id)
    .bind(&qr_data)
    .bind("genere") // QRStatut::Genere
    .bind(now)
    .bind(&qr_code_image)
    .bind(true) // partageable
    .bind(user_id as i32)
    .bind(payload.valide_jusqua.unwrap_or_else(|| now + chrono::Duration::hours(24)))
    .execute(pool)
    .await
    .map_err(|e| {
        log::error!("[generate_shareable_qrcode] Erreur sauvegarde QR: {}", e);
        AppError::Internal("Erreur sauvegarde QR code".to_string())
    })?;

    // Envoyer notification au destinataire si spécifié
    if let Some(destinataire_id) = payload.destinataire_id {
        let mut variables = HashMap::new();
        variables.insert(
            "qr_code_url".to_string(),
            format!("https://yukpo.app/qr/{}", qr_id),
        );
        variables.insert(
            "expediteur".to_string(),
            payload.expediteur_nom.unwrap_or_default(),
        );

        if let Err(e) = state
            .multilingue_service
            .send_notification("livraison.qrcode_partage", variables, Some(destinataire_id))
            .await
        {
            log::warn!("[generate_shareable_qrcode] Erreur notification: {}", e);
        }
    }

    log::info!(
        "[generate_shareable_qrcode] QR partageable généré: {}",
        qr_id
    );

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "success": true,
            "qr_id": qr_id,
            "qr_data": qr_data,
            "qr_code_image": qr_code_image,
            "share_url": format!("https://yukpo.app/qr/{}", qr_id),
            "valide_jusqua": payload.valide_jusqua.unwrap_or_else(|| now + chrono::Duration::hours(24)),
            "partageable": true
        })),
    ))
}

/// POST /api/librairie-network/qrcode/:qr_id/scan
/// Scanner et valider un QR code partageable
pub async fn scan_shareable_qrcode(
    State(state): State<Arc<AppState>>,
    Path(qr_id): Path<Uuid>,
    Json(payload): Json<ScanQRCodeRequest>,
) -> Result<impl IntoResponse, AppError> {
    let pool = &state.pg;

    // Récupérer le QR code
    let qr_row = sqlx::query!(
        r#"
        SELECT id, commande_id, delivery_id, qr_code_data, statut, 
               date_generation, date_scan, partageable, valide_jusqua
        FROM qr_code_coursier 
        WHERE id = $1 AND partageable = true
        "#,
        qr_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("[scan_shareable_qrcode] Erreur récupération QR: {}", e);
        AppError::Internal("Erreur récupération QR code".to_string())
    })?;

    let qr = qr_row.ok_or_else(|| AppError::NotFound("QR code non trouvé".to_string()))?;

    // Vérifier la validité
    let now = Utc::now();
    if qr.valide_jusqua.is_some() && qr.valide_jusqua < Some(now) {
        return Err(AppError::BadRequest("QR code expiré".to_string()));
    }

    if qr.statut == "scanne" || qr.date_scan.is_some() {
        return Err(AppError::BadRequest("QR code déjà scanné".to_string()));
    }

    // Mettre à jour le statut
    sqlx::query!(
        r#"
        UPDATE qr_code_coursier 
        SET statut = 'scanne', date_scan = $1, location_scan = $2, scan_par = $3
        WHERE id = $4
        "#,
        now,
        payload.location_scan,
        payload.scan_par,
        qr_id
    )
    .execute(pool)
    .await
    .map_err(|e| {
        log::error!("[scan_shareable_qrcode] Erreur mise à jour QR: {}", e);
        AppError::Internal("Erreur mise à jour QR code".to_string())
    })?;

    // Traiter selon le type de QR code
    let result = if let Some(commande_id) = qr.commande_id {
        // QR pour commande librairie
        sqlx::query!(
            r#"
            UPDATE commandes_mixtes 
            SET statut = 'livraison_en_cours', date_scan_qr = $1
            WHERE id = $2
            "#,
            now,
            commande_id
        )
        .execute(pool)
        .await
        .map_err(|e| {
            log::error!("[scan_shareable_qrcode] Erreur mise à jour commande: {}", e);
            AppError::Internal("Erreur mise à jour commande".to_string())
        })?;

        serde_json::json!({
            "type": "commande",
            "commande_id": commande_id,
            "action": "livraison_en_cours"
        })
    } else if let Some(delivery_id) = qr.delivery_id {
        // QR pour livraison standard
        sqlx::query!(
            r#"
            UPDATE deliveries 
            SET status = 'delivered', delivered_at = $1, delivery_proof_type = 'qr_code_scan'
            WHERE id = $2
            "#,
            now,
            delivery_id
        )
        .execute(pool)
        .await
        .map_err(|e| {
            log::error!("[scan_shareable_qrcode] Erreur mise à jour delivery: {}", e);
            AppError::Internal("Erreur mise à jour livraison".to_string())
        })?;

        serde_json::json!({
            "type": "delivery",
            "delivery_id": delivery_id,
            "action": "delivered"
        })
    } else {
        return Err(AppError::BadRequest("Type de QR code invalide".to_string()));
    };

    // Envoyer la preuve de livraison
    if let Some(proof_url) = payload.proof_photo_url {
        sqlx::query!(
            r#"
            INSERT INTO delivery_proof_media (
                delivery_id, media_type, media_url, proof_type, uploaded_by, metadata
            ) VALUES ($1, 'image', $2, 'delivery', $3, $4)
            "#,
            qr.delivery_id,
            proof_url,
            payload.scan_par,
            serde_json::json!({"qr_scan": true, "qr_id": qr_id})
        )
        .execute(pool)
        .await
        .map_err(|e| {
            log::warn!("[scan_shareable_qrcode] Erreur sauvegarde preuve: {}", e);
            AppError::Internal("Erreur sauvegarde preuve".to_string())
        })?;
    }

    log::info!(
        "[scan_shareable_qrcode] QR {} scanné par {}",
        qr_id,
        payload.scan_par
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "QR code validé avec succès",
        "qr_data": result,
        "scan_time": now
    })))
}

/// GET /api/librairie-network/qrcode/:qr_id/status
/// Vérifier le statut d'un QR code partageable
pub async fn get_qrcode_status(
    State(state): State<Arc<AppState>>,
    Path(qr_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let pool = &state.pg;

    let qr = sqlx::query!(
        r#"
        SELECT id, commande_id, delivery_id, statut, date_generation, 
               date_scan, partageable, valide_jusqua, location_scan
        FROM qr_code_coursier 
        WHERE id = $1 AND partageable = true
        "#,
        qr_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("[get_qrcode_status] Erreur récupération QR: {}", e);
        AppError::Internal("Erreur récupération QR code".to_string())
    })?;

    let qr = qr.ok_or_else(|| AppError::NotFound("QR code non trouvé".to_string()))?;

    let now = Utc::now();
    let is_expired = qr.valide_jusqua.is_some() && qr.valide_jusqua < Some(now);

    Ok(Json(serde_json::json!({
        "success": true,
        "qr_id": qr.id,
        "statut": qr.statut,
        "date_generation": qr.date_generation,
        "date_scan": qr.date_scan,
        "valide_jusqua": qr.valide_jusqua,
        "is_expired": is_expired,
        "location_scan": qr.location_scan,
        "partageable": qr.partageable
    })))
}

// ========================================
// STRUCTURES RÉPONSE
// ========================================

#[derive(Debug, Serialize)]
pub struct CommandeDetail {
    pub commande: CommandeMixte,
    pub livres_neufs: Vec<CommandeLivreNeuf>,
    pub livres_occasion: Vec<CommandeLivreOccasion>,
}

#[derive(Debug, Serialize)]
pub struct TotauxCommande {
    pub total_neufs: f64,
    pub total_occasion: f64,
    pub total_commande: f64,
    pub commission_app: f64,
    pub montant_net_libraires: f64,
}
