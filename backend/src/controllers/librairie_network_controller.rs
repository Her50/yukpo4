//! Réseau librairies — commandes mixtes, QR, paiements agrégés.
//!
//! **Multi-paniers / multi-librairies** : la commande d’un parent (utilisateur) n’est pas
//! supposée être entièrement traitée par une seule librairie. Plusieurs partenaires peuvent
//! chacun valider un sous-ensemble de lignes (neufs) ; les lignes restantes restent disponibles
//! pour d’autres librairies jusqu’à couverture complète ou indisponibilité explicite.

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
        ChaineLivraisonUnifiee, CommandeLivreNeuf, CommandeLivreOccasion, CommandeMixte,
        CommandeStatut, CommandeValidation, DestinationQR, LibrairiePartner, LivreQRReference,
        MethodePaiement, PointPassage, ValidationStatut,
    },
    models::librairie_network_model::{
        CreateLibrairieRequest, LibrairieLieuIn, NotificationLibrairie, QRCodeCoursier,
        TransactionAgregee,
    },
    services::librairie_prix_bornes_service,
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
    pub livre_scolaire_id: i32, // livres_scolaires.id est INTEGER
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
    /// Lignes neufs que **cette** librairie fournit (les autres lignes `en_attente` restent pour d’autres partenaires).
    pub livres_valides: Vec<Uuid>,
    /// Lignes que cette librairie ne peut pas fournir — uniquement celles-ci passent en `indisponible`.
    #[serde(default)]
    pub livres_indisponibles: Vec<Uuid>,
    pub notes_validation: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PatchLigneNeufPrixBody {
    pub prix_final: f64,
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

#[derive(Debug, Deserialize)]
pub struct GetLibrairieCommandesMixtesQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
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
        let livre_row = sqlx::query(
            "SELECT prix_detecte, valeur_calculee FROM livres_scolaires WHERE id = $1 AND is_active = true",
        )
        .bind(livre_req.livre_scolaire_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Livre d'occasion non trouvé".to_string()))?;

        let valeur_calculee: Option<String> = livre_row.try_get("valeur_calculee").unwrap_or(None);
        let prix_detecte: Option<String> = livre_row.try_get("prix_detecte").unwrap_or(None);
        let prix = valeur_calculee
            .and_then(|v| v.parse::<f64>().ok())
            .or_else(|| prix_detecte.and_then(|p| p.parse::<f64>().ok()))
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

    let devise = payload.devise.unwrap_or_else(|| "XAF".to_string());
    let mode_livraison = payload.mode_livraison.unwrap_or_else(|| "coursier".to_string());
    let commande = sqlx::query_as::<_, CommandeMixte>(
        r#"
        INSERT INTO commandes_mixtes (
            user_id, budget_total, devise, statut, mode_livraison,
            adresse_livraison, gps_livraison, notes_client,
            commission_app, montant_net_libraires
        )
        VALUES ($1, $2, $3, 'edition', $4, $5, $6, $7, $8, $9)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(payload.budget_total)
    .bind(&devise)
    .bind(&mode_livraison)
    .bind(&payload.adresse_livraison)
    .bind(&payload.gps_livraison)
    .bind(&payload.notes_client)
    .bind(commission_app)
    .bind(montant_net_libraires)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création commande: {}", e)))?;

    // Insérer livres neufs
    for livre_req in payload.livres_neufs {
        sqlx::query(
            r#"
            INSERT INTO commande_livres_neufs (
                commande_id, programme_scolaire_id, titre, auteur, editeur, isbn,
                classe, matiere, niveau, prix_officiel, prix_final, quantite, est_au_programme,
                prix_officiel_verrouille
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            "#,
        )
        .bind(commande.id)
        .bind(livre_req.programme_scolaire_id)
        .bind(&livre_req.titre)
        .bind(&livre_req.auteur)
        .bind(&livre_req.editeur)
        .bind(&livre_req.isbn)
        .bind(&livre_req.classe)
        .bind(&livre_req.matiere)
        .bind(&livre_req.niveau)
        .bind(livre_req.prix_officiel)
        .bind(livre_req.prix_officiel)
        .bind(livre_req.quantite)
        .bind(livre_req.est_au_programme)
        .bind(librairie_prix_bornes_service::est_prix_officiel_verrouille(
            livre_req.prix_officiel,
        ))
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur insertion livre neuf: {}", e)))?;
    }

    // Insérer livres occasion
    for livre_req in payload.livres_occasion {
        // Récupérer infos livre
        let livre_row = sqlx::query(
            "SELECT titre, auteur, classe, matiere, etat_livre, prix_detecte, valeur_calculee, user_id FROM livres_scolaires WHERE id = $1",
        )
        .bind(livre_req.livre_scolaire_id)
        .fetch_one(&mut *tx)
        .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération livre: {}", e)))?;

        let l_valeur_calculee: Option<String> =
            livre_row.try_get("valeur_calculee").unwrap_or(None);
        let l_prix_detecte: Option<String> = livre_row.try_get("prix_detecte").unwrap_or(None);
        let l_titre: Option<String> = livre_row.try_get("titre").unwrap_or(None);
        let l_auteur: Option<String> = livre_row.try_get("auteur").unwrap_or(None);
        let l_classe: Option<String> = livre_row.try_get("classe").unwrap_or(None);
        let l_matiere: Option<String> = livre_row.try_get("matiere").unwrap_or(None);
        let l_etat_livre: Option<String> = livre_row.try_get("etat_livre").unwrap_or(None);
        let l_user_id: Option<Uuid> = livre_row.try_get("user_id").unwrap_or(None);

        let prix = l_valeur_calculee
            .and_then(|v| v.parse::<f64>().ok())
            .or_else(|| l_prix_detecte.and_then(|p| p.parse::<f64>().ok()))
            .unwrap_or(0.0);

        sqlx::query(
            r#"
            INSERT INTO commande_livres_occasion (
                commande_id, livre_scolaire_id, titre, auteur, classe, matiere,
                etat_livre, prix, vendeur_id, quantite
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
        )
        .bind(commande.id)
        .bind(livre_req.livre_scolaire_id)
        .bind(&l_titre)
        .bind(&l_auteur)
        .bind(&l_classe)
        .bind(&l_matiere)
        .bind(&l_etat_livre)
        .bind(prix)
        .bind(l_user_id)
        .bind(livre_req.quantite)
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
    let _commande = sqlx::query_as::<_, CommandeMixte>(
        "SELECT * FROM commandes_mixtes WHERE id = $1 AND user_id = $2 AND statut = 'edition'",
    )
    .bind(commande_id)
    .bind(user_id)
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
        sqlx::query("UPDATE commandes_mixtes SET budget_total = $1 WHERE id = $2")
            .bind(budget)
            .bind(commande_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update budget: {}", e)))?;
    }

    if let Some(mode) = payload.mode_livraison {
        sqlx::query("UPDATE commandes_mixtes SET mode_livraison = $1 WHERE id = $2")
            .bind(&mode)
            .bind(commande_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update livraison: {}", e)))?;
    }

    // Ajouter livres neufs
    if let Some(livres) = payload.ajouter_livres_neufs {
        for livre_req in livres {
            sqlx::query(
                r#"
                INSERT INTO commande_livres_neufs (
                    commande_id, programme_scolaire_id, titre, auteur, editeur, isbn,
                    classe, matiere, niveau, prix_officiel, prix_final, quantite, est_au_programme,
                    prix_officiel_verrouille
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                "#,
            )
            .bind(commande_id)
            .bind(livre_req.programme_scolaire_id)
            .bind(&livre_req.titre)
            .bind(&livre_req.auteur)
            .bind(&livre_req.editeur)
            .bind(&livre_req.isbn)
            .bind(&livre_req.classe)
            .bind(&livre_req.matiere)
            .bind(&livre_req.niveau)
            .bind(livre_req.prix_officiel)
            .bind(livre_req.prix_officiel)
            .bind(livre_req.quantite)
            .bind(livre_req.est_au_programme)
            .bind(librairie_prix_bornes_service::est_prix_officiel_verrouille(
                livre_req.prix_officiel,
            ))
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur ajout livre neuf: {}", e)))?;
        }
    }

    // Supprimer livres neufs
    if let Some(livre_ids) = payload.supprimer_livres_neufs {
        for livre_id in livre_ids {
            sqlx::query("DELETE FROM commande_livres_neufs WHERE id = $1 AND commande_id = $2")
                .bind(livre_id)
                .bind(commande_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur suppression livre neuf: {}", e)))?;
        }
    }

    // Ajouter livres occasion (même logique)
    if let Some(livres) = payload.ajouter_livres_occasion {
        for livre_req in livres {
            let lr = sqlx::query(
                "SELECT titre, auteur, classe, matiere, etat_livre, prix_detecte, valeur_calculee, user_id FROM livres_scolaires WHERE id = $1",
            )
            .bind(livre_req.livre_scolaire_id)
            .fetch_one(&mut *tx)
            .await
                .map_err(|e| AppError::Internal(format!("Erreur récupération livre: {}", e)))?;

            let lr_vc: Option<String> = lr.try_get("valeur_calculee").unwrap_or(None);
            let lr_pd: Option<String> = lr.try_get("prix_detecte").unwrap_or(None);
            let prix = lr_vc
                .and_then(|v| v.parse::<f64>().ok())
                .or_else(|| lr_pd.and_then(|p| p.parse::<f64>().ok()))
                .unwrap_or(0.0);

            sqlx::query(
                r#"
                INSERT INTO commande_livres_occasion (
                    commande_id, livre_scolaire_id, titre, auteur, classe, matiere,
                    etat_livre, prix, vendeur_id, quantite
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                "#,
            )
            .bind(commande_id)
            .bind(livre_req.livre_scolaire_id)
            .bind(lr.try_get::<Option<String>, _>("titre").unwrap_or(None))
            .bind(lr.try_get::<Option<String>, _>("auteur").unwrap_or(None))
            .bind(lr.try_get::<Option<String>, _>("classe").unwrap_or(None))
            .bind(lr.try_get::<Option<String>, _>("matiere").unwrap_or(None))
            .bind(lr.try_get::<Option<String>, _>("etat_livre").unwrap_or(None))
            .bind(prix)
            .bind(lr.try_get::<Option<Uuid>, _>("user_id").unwrap_or(None))
            .bind(livre_req.quantite)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur ajout livre occasion: {}", e)))?;
        }
    }

    // Supprimer livres occasion
    if let Some(livre_ids) = payload.supprimer_livres_occasion {
        for livre_id in livre_ids {
            sqlx::query("DELETE FROM commande_livres_occasion WHERE id = $1 AND commande_id = $2")
                .bind(livre_id)
                .bind(commande_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    AppError::Internal(format!("Erreur suppression livre occasion: {}", e))
                })?;
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
    let commande = sqlx::query_as::<_, CommandeMixte>(
        "SELECT * FROM commandes_mixtes WHERE id = $1 AND user_id = $2 AND statut = 'edition'",
    )
    .bind(payload.commande_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Commande non trouvée ou non valide".to_string()))?;

    // Calculer totaux actuels
    let totaux = calculer_totaux_commande(&mut tx, payload.commande_id).await?;

    if totaux.total_commande > commande.budget_total {
        return Err(AppError::BadRequest(format!(
            "Le total des livres ({}) dépasse le budget ({})",
            totaux.total_commande, commande.budget_total
        )));
    }

    // Mettre à jour les montants
    let commission_app = totaux.total_commande * ConfigurationSysteme::COMMISSION_APP;
    let montant_net_libraires = totaux.total_commande - commission_app;

    sqlx::query(
        r#"
        UPDATE commandes_mixtes 
        SET statut = 'validation_budget',
            commission_app = $1,
            montant_net_libraires = $2,
            updated_at = NOW()
        WHERE id = $3
        "#,
    )
    .bind(commission_app)
    .bind(montant_net_libraires)
    .bind(payload.commande_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update statut: {}", e)))?;

    // Créer transaction agrégée
    let reference_paiement = generate_reference("PAY");
    sqlx::query_as::<_, TransactionAgregee>(
        r#"
        INSERT INTO transactions_agregees (
            commande_id, user_id, montant_total, devise, methode_paiement,
            statut, reference_paiement, commission_app, montant_net
        )
        VALUES ($1, $2, $3, 'XAF', $4, 'en_attente', $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(payload.commande_id)
    .bind(user_id)
    .bind(totaux.total_commande)
    .bind(&payload.methode_paiement)
    .bind(&reference_paiement)
    .bind(commission_app)
    .bind(montant_net_libraires)
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

/// Diffuser la commande — route d'abord vers YukpoLibrairie (super libraire),
/// puis vers les librairies proches si le super libraire passe la main ou expire.
pub async fn broadcast_commande_librairies(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<BroadcastCommandeRequest>,
) -> AppResult<axum::response::Response> {
    info!(
        "[broadcast_commande_librairies] User: {}, Commande: {}",
        user_id, payload.commande_id
    );

    // Récupérer commande avec GPS
    let commande_row = sqlx::query(
        r#"
        SELECT cm.*,
               STRING_AGG(DISTINCT cln.classe, ', ') as classes_neuf,
               STRING_AGG(DISTINCT clo.classe, ', ') as classes_occasion,
               COUNT(DISTINCT cln.id) as nb_neufs,
               COUNT(DISTINCT clo.id) as nb_occasion
        FROM commandes_mixtes cm
        LEFT JOIN commande_livres_neufs cln ON cm.id = cln.commande_id
        LEFT JOIN commande_livres_occasion clo ON cm.id = clo.commande_id
        WHERE cm.id = $1 AND cm.user_id = $2
          AND cm.statut IN ('validation_budget', 'envoyee_super_librairie')
        GROUP BY cm.id
        "#,
    )
    .bind(payload.commande_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Commande non trouvée ou non prête".to_string()))?;

    let cmd_gps_livraison: Option<String> = commande_row.try_get("gps_livraison").unwrap_or(None);
    let cmd_reference_commande: String = commande_row
        .try_get::<Option<String>, _>("reference_commande")
        .unwrap_or(None)
        .unwrap_or_default();
    let cmd_classes_neuf: String = commande_row
        .try_get::<Option<String>, _>("classes_neuf")
        .unwrap_or(None)
        .unwrap_or_else(|| "—".to_string());
    let cmd_nb_neufs: i64 = commande_row.try_get("nb_neufs").unwrap_or(0);
    let cmd_nb_occasion: i64 = commande_row.try_get("nb_occasion").unwrap_or(0);
    let cmd_statut: String = commande_row.try_get("statut").unwrap_or_default();

    let gps_livraison = cmd_gps_livraison.as_deref().unwrap_or("");
    if gps_livraison.is_empty() {
        return Err(AppError::BadRequest(
            "GPS de livraison requis pour diffusion".to_string(),
        ));
    }

    // ====================================================================
    // CAS 1 : La commande est déjà chez le super libraire
    //          → forcer le fallback immédiat vers les librairies proches
    // ====================================================================
    if cmd_statut == "envoyee_super_librairie" {
        return broadcast_vers_librairies_proches(
            &state,
            payload.commande_id,
            gps_livraison,
            &cmd_reference_commande,
            cmd_nb_neufs,
            cmd_nb_occasion,
            payload.rayon_recherche_km,
        )
        .await
        .map(|r| r.into_response());
    }

    // ====================================================================
    // CAS 2 : Commande en validation_budget
    //         → chercher le super libraire actif
    // ====================================================================

    // Chercher YukpoLibrairie (super libraire actif unique)
    let super_librairie = sqlx::query(
        r#"
        SELECT id, user_id, delai_validation_super_librairie_s
        FROM librairie_partners
        WHERE est_super_librairie = true
          AND est_actif = true
          AND statut = 'actif'
        LIMIT 1
        "#,
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur recherche super librairie: {}", e)))?;

    if let Some(sl) = super_librairie {
        use sqlx::Row as _;
        // ----------------------------------------------------------------
        // Routage vers YukpoLibrairie
        // ----------------------------------------------------------------
        let sl_id: uuid::Uuid = sl.get("id");
        let sl_user_id: i32 = sl.get("user_id");
        let delai_s: i32 =
            sl.get::<Option<i32>, _>("delai_validation_super_librairie_s").unwrap_or(300);
        let delai_s = delai_s as i64;
        let timeout_at = Utc::now() + chrono::Duration::seconds(delai_s);

        let mut tx = state
            .pg
            .begin()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

        // Passer la commande en statut super librairie
        sqlx::query(
            r#"
            UPDATE commandes_mixtes
            SET statut                   = 'envoyee_super_librairie',
                super_librairie_id       = $1,
                super_librairie_timeout_at = $2,
                updated_at               = NOW()
            WHERE id = $3
            "#,
        )
        .bind(sl_id)
        .bind(timeout_at)
        .bind(payload.commande_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update statut: {}", e)))?;

        // Créer une entrée de validation pour le super libraire
        sqlx::query(
            r#"
            INSERT INTO commande_validations (commande_id, librairie_id, statut, verrou_exclusif)
            VALUES ($1, $2, 'en_cours', false)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(payload.commande_id)
        .bind(sl_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur validation super librairie: {}", e)))?;

        // Notification interne à YukpoLibrairie
        let message = format!(
            "Commande {} — {} livres neufs, {} livres occasion. GPS livraison: {}",
            cmd_reference_commande, cmd_nb_neufs, cmd_nb_occasion, gps_livraison
        );
        sqlx::query(
            r#"
            INSERT INTO notifications_librairie (
                librairie_id, commande_id, type_notification, message, statut
            )
            VALUES ($1, $2, 'nouvelle_commande', $3, 'envoyee')
            "#,
        )
        .bind(sl_id)
        .bind(payload.commande_id)
        .bind(&message)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur notification: {}", e)))?;

        // Log audit
        sqlx::query(
            r#"
            INSERT INTO super_librairie_audit_log (commande_id, evenement, details)
            VALUES ($1, 'routee', $2)
            "#,
        )
        .bind(payload.commande_id)
        .bind(serde_json::json!({
            "gps_livraison": gps_livraison,
            "delai_s": delai_s,
            "timeout_at": timeout_at.to_rfc3339(),
        }))
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur audit log: {}", e)))?;

        tx.commit()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

        // Notification push à YukpoLibrairie
        let _ = send_notification(
            &state,
            sl_user_id,
            "Nouvelle commande prioritaire",
            &message,
            Some(serde_json::json!({
                "type": "super_librairie_commande",
                "commande_id": payload.commande_id.to_string(),
                "gps_livraison": gps_livraison,
                "timeout_at": timeout_at.to_rfc3339(),
            })),
        )
        .await;

        info!(
            "[broadcast_commande_librairies] Commande {} routée vers YukpoLibrairie — timeout dans {}s",
            payload.commande_id, delai_s
        );

        return Ok(Json(serde_json::json!({
            "success": true,
            "mode": "super_librairie",
            "message": "Commande reçue par YukpoLibrairie en priorité",
            "timeout_at": timeout_at.to_rfc3339(),
            "delai_validation_s": delai_s,
            "note": "Si YukpoLibrairie ne valide pas dans le délai, la commande sera automatiquement diffusée aux librairies proches."
        })).into_response());
    }

    // ====================================================================
    // CAS 3 : Pas de super libraire actif → broadcast direct (comportement original)
    // ====================================================================
    broadcast_vers_librairies_proches(
        &state,
        payload.commande_id,
        gps_livraison,
        &cmd_reference_commande,
        cmd_nb_neufs,
        cmd_nb_occasion,
        payload.rayon_recherche_km,
    )
    .await
    .map(|r| r.into_response())
}

/// Broadcast interne vers les librairies géolocalisées proches.
/// Utilisé comme fallback ou directement si pas de super libraire.
async fn broadcast_vers_librairies_proches(
    state: &Arc<AppState>,
    commande_id: Uuid,
    gps_livraison: &str,
    reference_commande: &str,
    nb_neufs: i64,
    nb_occasion: i64,
    rayon_override: Option<i32>,
) -> AppResult<impl IntoResponse> {
    let (lat, lng) = parse_gps(gps_livraison)?;
    let rayon = rayon_override.unwrap_or(ConfigurationSysteme::RAYON_RECHERCHE_LIBRAIRIE as i32);

    let librairies = sqlx::query_as::<_, LibrairiePartner>(
        r#"
        SELECT * FROM librairie_partners lp
        WHERE lp.est_actif = true
          AND lp.statut = 'actif'
          AND lp.est_super_librairie = false
          AND distance_gps($1, $2,
                           SPLIT_PART(lp.gps, ',', 1)::FLOAT,
                           SPLIT_PART(lp.gps, ',', 2)::FLOAT) <= $3
        ORDER BY distance_gps($1, $2,
                             SPLIT_PART(lp.gps, ',', 1)::FLOAT,
                             SPLIT_PART(lp.gps, ',', 2)::FLOAT)
        LIMIT 20
        "#,
    )
    .bind(lat)
    .bind(lng)
    .bind(rayon as f64)
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

    sqlx::query(
        r#"
        UPDATE commandes_mixtes
        SET statut = 'envoyee_librairies',
            super_librairie_fallback_at = COALESCE(super_librairie_fallback_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(commande_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update statut: {}", e)))?;

    let message = format!(
        "Commande {} disponible — {} livres neufs, {} livres occasion",
        reference_commande, nb_neufs, nb_occasion
    );

    let mut notifications_created = Vec::new();
    for librairie in &librairies {
        sqlx::query(
            r#"
            INSERT INTO commande_validations (commande_id, librairie_id, statut, verrou_exclusif)
            VALUES ($1, $2, 'en_cours', false)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(commande_id)
        .bind(librairie.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur validation: {}", e)))?;

        let notification = sqlx::query_as::<_, NotificationLibrairie>(
            r#"
            INSERT INTO notifications_librairie (
                librairie_id, commande_id, type_notification, message, statut
            )
            VALUES ($1, $2, 'nouvelle_commande', $3, 'envoyee')
            RETURNING *
            "#,
        )
        .bind(librairie.id)
        .bind(commande_id)
        .bind(&message)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur notification: {}", e)))?;

        notifications_created.push((librairie.user_id, notification));
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    for (lib_user_id, notification) in &notifications_created {
        let _ = send_notification(
            state,
            *lib_user_id,
            "Nouvelle commande à valider",
            &notification.message,
            Some(serde_json::json!({
                "type": "librairie_commande_mixte",
                "commande_id": commande_id.to_string(),
                "notification_id": notification.id.to_string(),
            })),
        )
        .await;
    }

    info!(
        "[broadcast_vers_librairies_proches] Commande {} diffusée à {} librairies",
        commande_id,
        librairies.len()
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "mode": "librairies_proches",
        "message": "Commande diffusée aux librairies proches",
        "librairies_notifiees": librairies.len(),
        "rayon_recherche": rayon,
        "delai_validation": ConfigurationSysteme::DELAI_VALIDATION_MAX,
        "note_multi_paniers": "Plusieurs librairies peuvent valider des sous-ensembles de lignes."
    })))
}

// ============================================================================
// SUPER LIBRAIRIE — Endpoints dédiés
// ============================================================================

/// GET /api/librairie-network/super-librairie/commandes
/// Dashboard YukpoLibrairie : toutes les commandes, toutes zones, triées par timeout
pub async fn super_librairie_dashboard(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
    Query(params): Query<GetCommandesQuery>,
) -> AppResult<impl IntoResponse> {
    // Admins/superadmins accèdent directement ; le super libraire accède via son user_id
    let is_admin = role == "admin" || role == "super_admin";
    let sl_row = if is_admin {
        sqlx::query(
            "SELECT id FROM librairie_partners WHERE est_super_librairie = true AND est_actif = true LIMIT 1",
        )
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Aucun super libraire actif".to_string()))?
    } else {
        sqlx::query(
            r#"
            SELECT id FROM librairie_partners
            WHERE user_id = $1 AND est_super_librairie = true AND est_actif = true
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| {
            AppError::Forbidden(
                "Accès réservé au super libraire ou aux administrateurs".to_string(),
            )
        })?
    };
    use sqlx::Row as _;
    let sl_id: uuid::Uuid = sl_row.get("id");

    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    // Toutes les commandes visibles pour le super libraire (pas de filtre géo)
    let commandes = sqlx::query(
        r#"
        SELECT
            cm.*,
            cv.statut AS validation_statut,
            COUNT(DISTINCT cln.id) AS nb_neufs,
            COUNT(DISTINCT clo.id) AS nb_occasion,
            CASE
                WHEN cm.super_librairie_timeout_at IS NOT NULL AND cm.super_librairie_fallback_at IS NULL
                THEN EXTRACT(EPOCH FROM (cm.super_librairie_timeout_at - NOW()))::INTEGER
                ELSE NULL
            END AS secondes_restantes
        FROM commandes_mixtes cm
        LEFT JOIN commande_validations cv
            ON cv.commande_id = cm.id AND cv.librairie_id = $1
        LEFT JOIN commande_livres_neufs cln ON cm.id = cln.commande_id
        LEFT JOIN commande_livres_occasion clo ON cm.id = clo.commande_id
        WHERE cm.statut IN (
            'envoyee_super_librairie',
            'envoyee_librairies',
            'en_validation',
            'validee_partielle',
            'validee_complete'
        )
        GROUP BY cm.id, cv.statut
        ORDER BY
            -- Commandes chez nous en priorité, par timeout croissant
            CASE WHEN cm.statut = 'envoyee_super_librairie' THEN 0 ELSE 1 END ASC,
            cm.super_librairie_timeout_at ASC NULLS LAST,
            cm.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(sl_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur dashboard: {}", e)))?;

    use sqlx::Row;
    let result: Vec<serde_json::Value> = commandes
        .into_iter()
        .map(|row| {
            serde_json::json!({
                "id": row.try_get::<uuid::Uuid, _>("id").ok().map(|u| u.to_string()),
                "reference_commande": row.try_get::<Option<String>, _>("reference_commande").unwrap_or(None),
                "statut": row.try_get::<Option<String>, _>("statut").unwrap_or(None),
                "validation_statut": row.try_get::<Option<String>, _>("validation_statut").unwrap_or(None),
                "budget_total": row.try_get::<Option<f64>, _>("budget_total").unwrap_or(None),
                "devise": row.try_get::<Option<String>, _>("devise").unwrap_or(None),
                "adresse_livraison": row.try_get::<Option<String>, _>("adresse_livraison").unwrap_or(None),
                "gps_livraison": row.try_get::<Option<String>, _>("gps_livraison").unwrap_or(None),
                "nb_neufs": row.try_get::<i64, _>("nb_neufs").unwrap_or(0),
                "nb_occasion": row.try_get::<i64, _>("nb_occasion").unwrap_or(0),
                "super_librairie_timeout_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("super_librairie_timeout_at")
                    .unwrap_or(None)
                    .map(|t| t.to_rfc3339()),
                "secondes_restantes": row.try_get::<Option<i32>, _>("secondes_restantes").unwrap_or(None),
                "super_librairie_fallback_at": row.try_get::<Option<chrono::DateTime<Utc>>, _>("super_librairie_fallback_at")
                    .unwrap_or(None)
                    .map(|t| t.to_rfc3339()),
                "created_at": row.try_get::<chrono::DateTime<Utc>, _>("created_at").ok().map(|t| t.to_rfc3339()),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "commandes": result,
        "total": result.len()
    })))
}

/// POST /api/librairie-network/super-librairie/liberer/{commande_id}
/// YukpoLibrairie libère manuellement une commande vers les librairies proches
/// (avant expiration du timeout — prise de décision explicite).
pub async fn super_librairie_liberer_commande(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(commande_id): Path<Uuid>,
    Json(payload): Json<LibererCommandePayload>,
) -> AppResult<impl IntoResponse> {
    // Vérifier super libraire
    let sl_row = sqlx::query(
        r#"
        SELECT id FROM librairie_partners
        WHERE user_id = $1 AND est_super_librairie = true AND est_actif = true
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::Forbidden("Accès réservé au super libraire".to_string()))?;

    use sqlx::Row as _;
    let sl_id: uuid::Uuid = sl_row.get("id");

    // Vérifier que la commande est bien chez le super libraire
    let commande_row = sqlx::query(
        r#"
        SELECT id, gps_livraison, reference_commande,
               COUNT(cln.id) OVER() AS nb_neufs,
               COUNT(clo.id) OVER() AS nb_occasion
        FROM commandes_mixtes cm
        LEFT JOIN commande_livres_neufs cln ON cm.id = cln.commande_id
        LEFT JOIN commande_livres_occasion clo ON cm.id = clo.commande_id
        WHERE cm.id = $1
          AND cm.statut = 'envoyee_super_librairie'
          AND cm.super_librairie_fallback_at IS NULL
        LIMIT 1
        "#,
    )
    .bind(commande_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Commande non trouvée ou déjà libérée".to_string()))?;

    let gps: String = commande_row.get::<Option<String>, _>("gps_livraison").unwrap_or_default();
    let reference: String =
        commande_row.get::<Option<String>, _>("reference_commande").unwrap_or_default();
    let nb_neufs: i64 = commande_row.get::<Option<i64>, _>("nb_neufs").unwrap_or(0);
    let nb_occasion: i64 = commande_row.get::<Option<i64>, _>("nb_occasion").unwrap_or(0);

    // Log audit avant de transférer
    sqlx::query(
        r#"
        INSERT INTO super_librairie_audit_log (commande_id, evenement, details)
        VALUES ($1, 'liberation_manuelle', $2)
        "#,
    )
    .bind(commande_id)
    .bind(serde_json::json!({
        "motif": payload.motif,
        "libere_par": user_id,
        "super_librairie_id": sl_id.to_string(),
    }))
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur audit: {}", e)))?;

    // Déclencher le broadcast vers librairies proches
    broadcast_vers_librairies_proches(
        &state,
        commande_id,
        &gps,
        &reference,
        nb_neufs,
        nb_occasion,
        payload.rayon_km.map(|r| r as i32),
    )
    .await
}

#[derive(Debug, serde::Deserialize)]
pub struct LibererCommandePayload {
    pub motif: Option<String>,
    pub rayon_km: Option<f64>,
}

// ============================================================================
// SUPER LIBRAIRIE — GESTION ÉQUIPE
// ============================================================================

#[derive(Debug, serde::Deserialize)]
pub struct SuperLibraireInviteTeamPayload {
    pub telephone: String,
    pub role: String, // 'manager' | 'preparer' | 'cashier'
    pub nom: Option<String>,
}

/// GET /api/librairie-network/super-librairie/team
/// Liste les membres de l'équipe YukpoLibrairie (admin + super libraire)
pub async fn super_librairie_list_team(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let is_admin = role == "admin" || role == "super_admin";
    let sl_id: uuid::Uuid = if is_admin {
        sqlx::query_scalar(
            "SELECT id FROM librairie_partners WHERE est_super_librairie = true AND est_actif = true LIMIT 1"
        )
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Aucun super libraire actif".to_string()))?
    } else {
        sqlx::query_scalar(
            "SELECT id FROM librairie_partners WHERE user_id = $1 AND est_super_librairie = true AND est_actif = true LIMIT 1"
        )
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::Forbidden("Accès réservé au super libraire ou aux administrateurs".to_string()))?
    };

    let members = sqlx::query(
        r#"
        SELECT ltm.id, ltm.user_id, ltm.role, ltm.nom_affiche, ltm.telephone,
               ltm.is_active, ltm.created_at,
               u.email, u.nom AS user_nom, u.photo_profil
        FROM libraire_team_members ltm
        LEFT JOIN users u ON u.id = ltm.user_id
        WHERE ltm.librairie_id = $1
        ORDER BY ltm.created_at ASC
        "#,
    )
    .bind(sl_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur liste équipe: {}", e)))?;

    use sqlx::Row;
    let result: Vec<serde_json::Value> = members.iter().map(|r| {
        serde_json::json!({
            "id": r.try_get::<i32, _>("id").unwrap_or(0),
            "user_id": r.try_get::<Option<i32>, _>("user_id").unwrap_or(None),
            "role": r.try_get::<Option<String>, _>("role").unwrap_or(None),
            "nom_affiche": r.try_get::<Option<String>, _>("nom_affiche").unwrap_or(None),
            "telephone": r.try_get::<Option<String>, _>("telephone").unwrap_or(None),
            "is_active": r.try_get::<bool, _>("is_active").unwrap_or(false),
            "email": r.try_get::<Option<String>, _>("email").unwrap_or(None),
            "user_nom": r.try_get::<Option<String>, _>("user_nom").unwrap_or(None),
            "photo_profil": r.try_get::<Option<String>, _>("photo_profil").unwrap_or(None),
            "created_at": r.try_get::<chrono::DateTime<Utc>, _>("created_at").ok().map(|t| t.to_rfc3339()),
        })
    }).collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "librairie_id": sl_id.to_string(),
        "members": result,
        "total": result.len()
    })))
}

/// POST /api/librairie-network/super-librairie/team/invite
/// Inviter un membre dans l'équipe YukpoLibrairie (admin + super libraire)
pub async fn super_librairie_invite_team(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
    Json(payload): Json<SuperLibraireInviteTeamPayload>,
) -> AppResult<impl IntoResponse> {
    let is_admin = role == "admin" || role == "super_admin";
    let sl_id: uuid::Uuid = if is_admin {
        sqlx::query_scalar(
            "SELECT id FROM librairie_partners WHERE est_super_librairie = true AND est_actif = true LIMIT 1"
        )
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Aucun super libraire actif".to_string()))?
    } else {
        sqlx::query_scalar(
            "SELECT id FROM librairie_partners WHERE user_id = $1 AND est_super_librairie = true AND est_actif = true LIMIT 1"
        )
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::Forbidden("Accès réservé au super libraire ou aux administrateurs".to_string()))?
    };

    let allowed_roles = ["manager", "preparer", "cashier"];
    if !allowed_roles.contains(&payload.role.as_str()) {
        return Err(AppError::BadRequest(
            "Rôle invalide. Valeurs acceptées: manager, preparer, cashier".to_string(),
        ));
    }

    // Trouver l'utilisateur par téléphone
    let target_user_id: i32 = sqlx::query_scalar("SELECT id FROM users WHERE phone = $1 LIMIT 1")
        .bind(&payload.telephone)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Aucun utilisateur avec le téléphone {}",
                payload.telephone
            ))
        })?;

    // Upsert membre
    let member_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO libraire_team_members (librairie_id, user_id, role, nom_affiche, telephone, invited_by, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (librairie_id, user_id)
            DO UPDATE SET role = $3, is_active = true,
                          nom_affiche = COALESCE($4, libraire_team_members.nom_affiche),
                          updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(sl_id)
    .bind(target_user_id)
    .bind(&payload.role)
    .bind(&payload.nom)
    .bind(&payload.telephone)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur invitation: {}", e)))?;

    let _ = crate::utils::send_notification(
        &state,
        target_user_id,
        "YukpoLibrairie — Invitation équipe",
        &format!(
            "Vous avez été ajouté à l'équipe YukpoLibrairie en tant que {}.",
            payload.role
        ),
        Some(serde_json::json!({
            "type": "super_librairie_team_invite",
            "librairie_id": sl_id.to_string(),
            "role": payload.role,
        })),
    )
    .await;

    Ok(Json(serde_json::json!({
        "success": true,
        "member_id": member_id,
        "user_id": target_user_id,
        "role": payload.role
    })))
}

/// DELETE /api/librairie-network/super-librairie/team/{member_id}
/// Retirer un membre de l'équipe YukpoLibrairie (admin + super libraire)
pub async fn super_librairie_remove_team(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
    Path(member_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let is_admin = role == "admin" || role == "super_admin";
    let sl_id: uuid::Uuid = if is_admin {
        sqlx::query_scalar(
            "SELECT id FROM librairie_partners WHERE est_super_librairie = true AND est_actif = true LIMIT 1"
        )
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Aucun super libraire actif".to_string()))?
    } else {
        sqlx::query_scalar(
            "SELECT id FROM librairie_partners WHERE user_id = $1 AND est_super_librairie = true AND est_actif = true LIMIT 1"
        )
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::Forbidden("Accès réservé au super libraire ou aux administrateurs".to_string()))?
    };

    let rows = sqlx::query(
        "UPDATE libraire_team_members SET is_active = false, updated_at = NOW() WHERE id = $1 AND librairie_id = $2"
    )
    .bind(member_id)
    .bind(sl_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur retrait: {}", e)))?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Membre introuvable".to_string()));
    }

    Ok(Json(serde_json::json!({ "success": true })))
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
    let librairie = sqlx::query_as::<_, LibrairiePartner>(
        "SELECT * FROM librairie_partners WHERE user_id = $1 AND est_actif = true AND statut = 'actif'",
    )
    .bind(librairie_user_id)
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
    let validation = sqlx::query_as::<_, CommandeValidation>(
        r#"
        SELECT * FROM commande_validations 
        WHERE commande_id = $1 AND librairie_id = $2 
        FOR UPDATE
        "#,
    )
    .bind(payload.commande_id)
    .bind(librairie.id)
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
    sqlx::query(
        r#"
        UPDATE commande_validations 
        SET verrou_exclusif = true, 
            timestamp_debut = NOW(),
            notes_validation = $1
        WHERE id = $2
        "#,
    )
    .bind(&payload.notes_validation)
    .bind(validation.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur prise verrou: {}", e)))?;

    // Marquer les livres comme validés
    let mut livres_valides_count = 0;
    for livre_id in &payload.livres_valides {
        let result = sqlx::query(
            r#"
            UPDATE commande_livres_neufs 
            SET statut_validation = 'valide', 
                librairie_validateur_id = $1
            WHERE id = $2 AND commande_id = $3 AND statut_validation = 'en_attente'
            RETURNING id
            "#,
        )
        .bind(librairie.id)
        .bind(livre_id)
        .bind(payload.commande_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur validation livre: {}", e)))?;

        if result.is_some() {
            livres_valides_count += 1;
        }
    }

    // Indisponibilité **explicite** uniquement : les autres lignes restent `en_attente` pour d'autres librairies.
    for lid in &payload.livres_indisponibles {
        if payload.livres_valides.contains(lid) {
            continue;
        }
        sqlx::query(
            r#"
            UPDATE commande_livres_neufs 
            SET statut_validation = 'indisponible'
            WHERE id = $1 AND commande_id = $2 AND statut_validation = 'en_attente'
            "#,
        )
        .bind(lid)
        .bind(payload.commande_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur marquage indisponible: {}", e)))?;
    }

    // Déterminer le statut de validation
    let total_livres_neufs: i64 = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT COUNT(*) FROM commande_livres_neufs WHERE commande_id = $1",
    )
    .bind(payload.commande_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur comptage: {}", e)))?
    .unwrap_or(0);

    let livres_valides_total: i64 = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT COUNT(*) FROM commande_livres_neufs WHERE commande_id = $1 AND statut_validation = 'valide'",
    )
    .bind(payload.commande_id)
    .fetch_one(&mut *tx)
    .await
        .map_err(|e| AppError::Internal(format!("Erreur comptage validés: {}", e)))?
        .unwrap_or(0);

    let statut_validation = if livres_valides_total == total_livres_neufs {
        ValidationStatut::ValideComplet
    } else if livres_valides_total > 0 {
        ValidationStatut::ValidePartiel
    } else {
        ValidationStatut::Abandonne
    };

    // Mettre à jour la validation
    sqlx::query(
        r#"
        UPDATE commande_validations 
        SET statut = $1, 
            livres_valides = $2,
            timestamp_fin = NOW(),
            verrou_exclusif = false
        WHERE id = $3
        "#,
    )
    .bind(&statut_validation)
    .bind(serde_json::to_value(&payload.livres_valides).unwrap_or(serde_json::Value::Array(vec![])))
    .bind(validation.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update validation: {}", e)))?;

    // Mettre à jour le statut de la commande
    match statut_validation {
        ValidationStatut::ValideComplet => {
            sqlx::query(
                "UPDATE commandes_mixtes SET statut = 'validee_complete', updated_at = NOW() WHERE id = $1",
            )
            .bind(payload.commande_id)
            .execute(&mut *tx)
            .await
                .map_err(|e| AppError::Internal(format!("Erreur update commande: {}", e)))?;
        }
        ValidationStatut::ValidePartiel => {
            sqlx::query(
                "UPDATE commandes_mixtes SET statut = 'validee_partielle', updated_at = NOW() WHERE id = $1",
            )
            .bind(payload.commande_id)
            .execute(&mut *tx)
            .await
                .map_err(|e| AppError::Internal(format!("Erreur update commande: {}", e)))?;
        }
        _ => {
            sqlx::query(
                "UPDATE commandes_mixtes SET statut = 'en_validation', updated_at = NOW() WHERE id = $1",
            )
            .bind(payload.commande_id)
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
            ValidationStatut::ValidePartiel => "Validation partielle. D'autres librairies peuvent constituer leurs paniers sur les lignes encore en attente.",
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
    let _commande = sqlx::query_as::<_, CommandeMixte>(
        "SELECT * FROM commandes_mixtes WHERE id = $1 AND user_id = $2 AND statut IN ('validee_complete', 'validee_partielle')",
    )
    .bind(payload.commande_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Commande non trouvée ou non finalisable".to_string()))?;

    // Calculer totaux finaux
    let totaux = calculer_totaux_commande(&mut tx, payload.commande_id).await?;

    // Traiter le paiement
    let reference_paiement = format!("PAY-{}", generate_reference(""));

    // TODO: Intégration avec système de paiement agrégé
    // Pour l'instant, on simule un paiement réussi

    sqlx::query(
        r#"
        UPDATE transactions_agregees 
        SET statut = 'succes', 
            provider_transaction_id = $1,
            updated_at = NOW()
        WHERE commande_id = $2 AND user_id = $3
        "#,
    )
    .bind(&reference_paiement)
    .bind(payload.commande_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update transaction: {}", e)))?;

    // Mettre à jour statut commande
    sqlx::query(
        "UPDATE commandes_mixtes SET statut = 'en_preparation', updated_at = NOW() WHERE id = $1",
    )
    .bind(payload.commande_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update commande: {}", e)))?;

    // Créer la chaîne de livraison unifiée
    let chaine = creer_chaine_livraison(&mut tx, payload.commande_id).await?;

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
    let paquet_id = payload
        .commande_id
        .ok_or_else(|| AppError::BadRequest("commande_id (paquet) requis".to_string()))?;

    info!(
        "[generer_qr_code_coursier] Coursier: {}, Paquet: {}",
        coursier_id, paquet_id
    );

    // Vérifier que c'est un coursier actif
    // TODO: Vérifier rôle coursier dans la table users

    // Récupérer détails du paquet
    let paquet_row = sqlx::query(
        r#"
        SELECT dp.*, 
               cm.reference_commande,
               cm.user_id as commande_user_id
        FROM delivery_packages dp
        JOIN chaines_livraison_unifiees clu ON dp.chaine_id = clu.id
        JOIN commandes_mixtes cm ON clu.commande_id = cm.id
        WHERE dp.id = $1
        "#,
    )
    .bind(paquet_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Paquet non trouvé".to_string()))?;

    let paquet_reference: Option<String> = paquet_row.try_get("reference_commande").unwrap_or(None);

    // Générer code secret
    let code_secret = format!("QR-{}", generate_reference(""));

    // Préparer données QR
    let qr_data = serde_json::json!({
        "paquet_id": paquet_id,
        "coursier_id": coursier_id,
        "code_secret": code_secret,
        "timestamp": Utc::now().to_rfc3339(),
        "reference_commande": paquet_reference
    });

    let qr_code_data = generate_qr_code(&qr_data.to_string())?;

    // Récupérer livres attendus et destinations
    let (livres_attendus, destinations) = preparer_donnees_qr(&state.pg, paquet_id).await?;

    let qr_code = sqlx::query_as::<_, QRCodeCoursier>(
        r#"
        INSERT INTO qr_codes_coursier (
            paquet_id, coursier_id, code_secret, qr_code_data,
            livres_attendus, destinations
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(paquet_id)
    .bind(coursier_id)
    .bind(&code_secret)
    .bind(&qr_code_data)
    .bind(serde_json::to_value(&livres_attendus).unwrap_or(serde_json::Value::Array(vec![])))
    .bind(serde_json::to_value(&destinations).unwrap_or(serde_json::Value::Array(vec![])))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création QR code: {}", e)))?;

    info!(
        "[generer_qr_code_coursier] QR code {} généré pour paquet {}",
        qr_code.id, paquet_id
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
    let qr_code = sqlx::query_as::<_, QRCodeCoursier>(
        r#"
        SELECT * FROM qr_codes_coursier 
        WHERE code_secret = $1 AND coursier_id = $2 AND statut = 'genere'
        FOR UPDATE
        "#,
    )
    .bind(&payload.code_secret)
    .bind(coursier_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("QR code non trouvé ou déjà utilisé".to_string()))?;

    // Vérifier expiration (24h)
    let expiration_time = qr_code.timestamp_generation
        + chrono::Duration::seconds(ConfigurationSysteme::DELAI_EXPIRATION_QR as i64);
    if Utc::now() > expiration_time {
        sqlx::query("UPDATE qr_codes_coursier SET statut = 'expire' WHERE id = $1")
            .bind(qr_code.id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur update statut: {}", e)))?;

        return Err(AppError::BadRequest("QR code expiré".to_string()));
    }

    // Marquer comme scanné
    sqlx::query(
        r#"
        UPDATE qr_codes_coursier 
        SET statut = 'scanne', 
            timestamp_scan = NOW()
        WHERE id = $1
        "#,
    )
    .bind(qr_code.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update scan: {}", e)))?;

    // TODO: Intégrer validation biométrique ou code PIN coursier

    // Marquer comme validé
    sqlx::query(
        r#"
        UPDATE qr_codes_coursier 
        SET statut = 'valide', 
            timestamp_validation = NOW()
        WHERE id = $1
        "#,
    )
    .bind(qr_code.id)
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
    let chaine = sqlx::query_as::<_, ChaineLivraisonUnifiee>(
        "SELECT * FROM chaines_livraison_unifiees WHERE commande_id = $1",
    )
    .bind(payload.commande_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Chaîne de livraison non trouvée".to_string()))?;

    // Optimiser l'itinéraire (algorithme nearest neighbor TSP)
    let points_optimises = optimiser_itineraire(&mut tx, payload.commande_id).await?;

    // Calculer distance et durée estimées
    let (distance_totale, duree_estimee) = calculer_metrics_itineraire(&points_optimises);

    // Mettre à jour la chaîne
    sqlx::query(
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
    )
    .bind(serde_json::to_value(&points_optimises).unwrap_or(serde_json::Value::Array(vec![])))
    .bind(distance_totale)
    .bind(duree_estimee)
    .bind(payload.coursier_id)
    .bind(chaine.id)
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
        query.push_str(&format!(" AND cm.statut = '{}'", statut.as_db_str()));
    }

    query.push_str(" GROUP BY cm.id ORDER BY cm.created_at DESC LIMIT $2 OFFSET $3");

    let commandes_rows = sqlx::query(&query)
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let commandes: Vec<serde_json::Value> = commandes_rows.iter().map(|row| {
        serde_json::json!({
            "id": row.try_get::<Uuid, _>("id").ok(),
            "user_id": row.try_get::<i32, _>("user_id").ok(),
            "budget_total": row.try_get::<f64, _>("budget_total").ok(),
            "statut": row.try_get::<String, _>("statut").ok(),
            "mode_livraison": row.try_get::<Option<String>, _>("mode_livraison").unwrap_or(None),
            "nb_livres_neufs": row.try_get::<Option<i64>, _>("nb_livres_neufs").unwrap_or(None),
            "nb_livres_occasion": row.try_get::<Option<i64>, _>("nb_livres_occasion").unwrap_or(None),
            "created_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at").unwrap_or(None),
        })
    }).collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "commandes": commandes,
        "total": commandes.len()
    })))
}

/// Commandes mixtes où cette librairie a une entrée `commande_validations` (sans coller l’UUID).
pub async fn get_librairie_mes_commandes_mixtes(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<GetLibrairieCommandesMixtesQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_librairie_mes_commandes_mixtes] User: {}", user_id);

    let limit = params.limit.unwrap_or(30).min(100);
    let offset = params.offset.unwrap_or(0);

    let rows = sqlx::query(
        r#"
        SELECT cm.id,
               cm.reference_commande,
               cm.statut::text AS statut,
               cm.budget_total,
               cm.created_at
        FROM commandes_mixtes cm
        WHERE EXISTS (
            SELECT 1
            FROM commande_validations cv
            INNER JOIN librairie_partners lp ON lp.id = cv.librairie_id
            WHERE cv.commande_id = cm.id
              AND lp.user_id = $1
        )
        ORDER BY cm.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur liste commandes librairie: {}", e)))?;

    let commandes: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.try_get::<Uuid, _>("id").ok(),
                "reference_commande": row.try_get::<String, _>("reference_commande").ok(),
                "statut": row.try_get::<String, _>("statut").ok(),
                "budget_total": row.try_get::<f64, _>("budget_total").ok(),
                "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok(),
            })
        })
        .collect();

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

    let bind_count = 4;

    if let Some(ville) = &params.ville {
        query.push_str(&format!(" AND lp.ville ILIKE '%{}%'", ville));
    }

    if let (Some(_lat), Some(_lng)) = (params.gps_lat, params.gps_lng) {
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

    let librairies_rows = query_builder
        .bind(limit)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let librairies: Vec<serde_json::Value> = librairies_rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.try_get::<Uuid, _>("id").ok(),
                "nom": row.try_get::<String, _>("nom").ok(),
                "ville": row.try_get::<Option<String>, _>("ville").unwrap_or(None),
                "gps": row.try_get::<Option<String>, _>("gps").unwrap_or(None),
                "rating": row.try_get::<Option<f64>, _>("rating").unwrap_or(None),
                "distance_km": row.try_get::<Option<f64>, _>("distance_km").unwrap_or(None),
                "est_actif": row.try_get::<Option<bool>, _>("est_actif").unwrap_or(None),
            })
        })
        .collect();

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

    let allowed = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM commandes_mixtes WHERE id = $1 AND user_id = $2)",
    )
    .bind(commande_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur auth commande: {}", e)))?;
    if !allowed {
        return Err(AppError::Forbidden("Accès non autorisé".to_string()));
    }

    let details = fetch_commande_details(&state.pg, commande_id).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "details": details
    })))
}

/// GET bornes / état prix pour chaque ligne neuf (client propriétaire ou librairie liée à la commande).
pub async fn get_lignes_neufs_bornes_commande(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(commande_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_lignes_neufs_bornes_commande] User: {}, Commande: {}",
        user_id, commande_id
    );

    if !user_peut_acceder_bornes_commande(&state.pg, commande_id, user_id).await? {
        return Err(AppError::Forbidden(
            "Accès non autorisé à cette commande".to_string(),
        ));
    }

    let lignes = sqlx::query_as::<_, CommandeLivreNeuf>(
        "SELECT * FROM commande_livres_neufs WHERE commande_id = $1 ORDER BY created_at",
    )
    .bind(commande_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur lignes neufs: {}", e)))?;

    let mut lignes_bornes: Vec<librairie_prix_bornes_service::BornesPrixLigne> =
        Vec::with_capacity(lignes.len());

    for ligne in &lignes {
        let verrou =
            librairie_prix_bornes_service::est_prix_officiel_verrouille(ligne.prix_officiel)
                || ligne.prix_officiel_verrouille;
        let b = librairie_prix_bornes_service::assurer_bornes_persistees(
            &state.pg,
            ligne.id,
            commande_id,
            ligne.prix_officiel,
            &ligne.classe,
            &ligne.matiere,
            &ligne.titre,
            ligne.quantite,
            verrou,
        )
        .await
        .map_err(|e| AppError::Internal(format!("Erreur bornes: {}", e)))?;
        lignes_bornes.push(b);
    }

    let lignes_out: Vec<serde_json::Value> = lignes
        .iter()
        .zip(lignes_bornes.iter())
        .map(|(ligne, b)| {
            let mut v = serde_json::to_value(b).unwrap_or(serde_json::json!({}));
            if let Some(obj) = v.as_object_mut() {
                obj.insert(
                    "statut_validation".into(),
                    serde_json::json!(ligne.statut_validation.as_api_str()),
                );
                obj.insert("classe".into(), serde_json::json!(ligne.classe));
                obj.insert("matiere".into(), serde_json::json!(ligne.matiere));
            }
            v
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "commande_id": commande_id,
        "lignes": lignes_out
    })))
}

/// PATCH `prix_final` pour une ligne neuf — réservé aux librairies associées à la commande (validation).
pub async fn patch_ligne_neuf_prix(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path((commande_id, ligne_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<PatchLigneNeufPrixBody>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[patch_ligne_neuf_prix] User: {}, Commande: {}, Ligne: {}",
        user_id, commande_id, ligne_id
    );

    if !user_est_librairie_avec_validation_commande(&state.pg, commande_id, user_id).await? {
        return Err(AppError::Forbidden(
            "Seule une librairie associée à cette commande peut modifier le prix.".to_string(),
        ));
    }

    let ligne = sqlx::query_as::<_, CommandeLivreNeuf>(
        "SELECT * FROM commande_livres_neufs WHERE id = $1 AND commande_id = $2",
    )
    .bind(ligne_id)
    .bind(commande_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur ligne: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Ligne neuf introuvable".to_string()))?;

    let verrou = librairie_prix_bornes_service::est_prix_officiel_verrouille(ligne.prix_officiel)
        || ligne.prix_officiel_verrouille;

    let bornes = librairie_prix_bornes_service::assurer_bornes_persistees(
        &state.pg,
        ligne.id,
        commande_id,
        ligne.prix_officiel,
        &ligne.classe,
        &ligne.matiere,
        &ligne.titre,
        ligne.quantite,
        verrou,
    )
    .await
    .map_err(|e| AppError::Internal(format!("Erreur bornes: {}", e)))?;

    librairie_prix_bornes_service::valider_prix_final_contre_bornes(
        bornes.prix_officiel_verrouille,
        ligne.prix_officiel,
        bornes.prix_plancher,
        bornes.prix_plafond,
        body.prix_final,
    )
    .map_err(AppError::BadRequest)?;

    sqlx::query(
        "UPDATE commande_livres_neufs SET prix_final = $1 WHERE id = $2 AND commande_id = $3",
    )
    .bind(body.prix_final)
    .bind(ligne_id)
    .bind(commande_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise à jour prix: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "ligne_id": ligne_id,
        "prix_final": body.prix_final
    })))
}

async fn user_peut_acceder_bornes_commande(
    pg: &sqlx::PgPool,
    commande_id: Uuid,
    user_id: i32,
) -> Result<bool, AppError> {
    let owner: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM commandes_mixtes WHERE id = $1 AND user_id = $2)",
    )
    .bind(commande_id)
    .bind(user_id)
    .fetch_one(pg)
    .await
    .map_err(|e| AppError::Internal(format!("Auth commande: {}", e)))?;

    if owner {
        return Ok(true);
    }

    sqlx::query_scalar(
        r#"SELECT EXISTS(
            SELECT 1 FROM commande_validations cv
            INNER JOIN librairie_partners lp ON lp.id = cv.librairie_id
            WHERE cv.commande_id = $1 AND lp.user_id = $2
        )"#,
    )
    .bind(commande_id)
    .bind(user_id)
    .fetch_one(pg)
    .await
    .map_err(|e| AppError::Internal(format!("Auth librairie: {}", e)))
}

async fn user_est_librairie_avec_validation_commande(
    pg: &sqlx::PgPool,
    commande_id: Uuid,
    user_id: i32,
) -> Result<bool, AppError> {
    sqlx::query_scalar(
        r#"SELECT EXISTS(
            SELECT 1 FROM commande_validations cv
            INNER JOIN librairie_partners lp ON lp.id = cv.librairie_id
            WHERE cv.commande_id = $1 AND lp.user_id = $2
        )"#,
    )
    .bind(commande_id)
    .bind(user_id)
    .fetch_one(pg)
    .await
    .map_err(|e| AppError::Internal(format!("Auth librairie validation: {}", e)))
}

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

async fn fetch_commande_details(
    pg: &sqlx::PgPool,
    commande_id: Uuid,
) -> Result<CommandeDetail, AppError> {
    let commande =
        sqlx::query_as::<_, CommandeMixte>("SELECT * FROM commandes_mixtes WHERE id = $1")
            .bind(commande_id)
            .fetch_one(pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let livres_neufs = sqlx::query_as::<_, CommandeLivreNeuf>(
        "SELECT * FROM commande_livres_neufs WHERE commande_id = $1",
    )
    .bind(commande_id)
    .fetch_all(pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let livres_occasion = sqlx::query_as::<_, CommandeLivreOccasion>(
        "SELECT * FROM commande_livres_occasion WHERE commande_id = $1",
    )
    .bind(commande_id)
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
    let total_neufs: f64 = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT COALESCE(SUM(prix_final * quantite), 0) FROM commande_livres_neufs WHERE commande_id = $1",
    )
    .bind(commande_id)
    .fetch_one(&mut **tx)
    .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .unwrap_or(0.0);

    let total_occasion: f64 = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT COALESCE(SUM(prix * quantite), 0) FROM commande_livres_occasion WHERE commande_id = $1",
    )
    .bind(commande_id)
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
    let points_passage: Vec<PointPassage> = vec![];

    let chaine = sqlx::query_as::<_, ChaineLivraisonUnifiee>(
        r#"
        INSERT INTO chaines_livraison_unifiees (
            commande_id, points_passage, distance_totale_km, duree_estimee_minutes
        )
        VALUES ($1, $2, 0, 0)
        RETURNING *
        "#,
    )
    .bind(commande_id)
    .bind(serde_json::to_value(&points_passage).unwrap_or(serde_json::Value::Array(vec![])))
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création chaîne: {}", e)))?;

    Ok(chaine)
}

async fn preparer_donnees_qr(
    _pg: &sqlx::PgPool,
    _paquet_id: Uuid,
) -> Result<(Vec<LivreQRReference>, Vec<DestinationQR>), AppError> {
    // TODO: Implémenter la préparation des données QR
    Ok((vec![], vec![]))
}

async fn optimiser_itineraire(
    _tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    _commande_id: Uuid,
) -> Result<Vec<PointPassage>, AppError> {
    // TODO: Implémenter l'algorithme d'optimisation TSP
    Ok(vec![])
}

fn calculer_metrics_itineraire(_points: &[PointPassage]) -> (f64, i32) {
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

    // Points de vente / succursales (carte Yukpo) — notifications géo multi-sites
    let lieux_to_save: Vec<LibrairieLieuIn> = match &payload.lieux {
        Some(ll) if !ll.is_empty() => {
            for l in ll {
                if l.gps.trim().is_empty() {
                    return Err(AppError::BadRequest(
                        "Chaque point de vente doit avoir une localisation GPS".to_string(),
                    ));
                }
            }
            ll.clone()
        }
        _ => {
            vec![LibrairieLieuIn {
                libelle: Some("Siège principal".to_string()),
                gps: payload.gps.clone().unwrap_or_default().trim().to_string(),
                ville: Some(payload.ville.clone()),
                pays: Some(payload.pays.clone()),
                adresse: Some(payload.adresse.clone()),
            }]
        }
    };

    for (i, l) in lieux_to_save.iter().enumerate() {
        let lab = l
            .libelle
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| format!("Point {}", i + 1));
        sqlx::query(
            r#"
            INSERT INTO librairie_lieux (
                librairie_partner_id, libelle, gps, ville, pays, adresse, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(librairie_id)
        .bind(&lab)
        .bind(l.gps.trim())
        .bind(l.ville.as_deref())
        .bind(l.pays.as_deref())
        .bind(l.adresse.as_deref())
        .bind(i as i32)
        .execute(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[register_librairie_publique] librairie_lieux insert: {}",
                e
            );
            AppError::Internal("Erreur enregistrement des points de vente".to_string())
        })?;
    }

    log::info!(
        "[register_librairie_publique] Librairie {} enregistrée avec succès ({} point(s) GPS)",
        payload.nom,
        lieux_to_save.len()
    );

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "success": true,
            "message": "Votre demande d'inscription a été soumise avec succès",
            "librairie_id": librairie_id,
            "commission_app": commission_app,
            "statut": "en_attente",
            "points_vente": lieux_to_save.len()
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
    .bind(user_id)
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
    let qr_row = sqlx::query(
        r#"
        SELECT id, commande_id, delivery_id, qr_code_data, statut, 
               date_generation, date_scan, partageable, valide_jusqua
        FROM qr_code_coursier 
        WHERE id = $1 AND partageable = true
        "#,
    )
    .bind(qr_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("[scan_shareable_qrcode] Erreur récupération QR: {}", e);
        AppError::Internal("Erreur récupération QR code".to_string())
    })?;

    let qr = qr_row.ok_or_else(|| AppError::NotFound("QR code non trouvé".to_string()))?;

    let qr_statut: Option<String> = qr.try_get("statut").unwrap_or(None);
    let qr_valide_jusqua: Option<chrono::DateTime<chrono::Utc>> =
        qr.try_get("valide_jusqua").unwrap_or(None);
    let qr_date_scan: Option<chrono::DateTime<chrono::Utc>> =
        qr.try_get("date_scan").unwrap_or(None);
    let qr_commande_id: Option<Uuid> = qr.try_get("commande_id").unwrap_or(None);
    let qr_delivery_id: Option<Uuid> = qr.try_get("delivery_id").unwrap_or(None);

    // Vérifier la validité
    let now = Utc::now();
    if qr_valide_jusqua.is_some() && qr_valide_jusqua < Some(now) {
        return Err(AppError::BadRequest("QR code expiré".to_string()));
    }

    if qr_statut.as_deref() == Some("scanne") || qr_date_scan.is_some() {
        return Err(AppError::BadRequest("QR code déjà scanné".to_string()));
    }

    // Mettre à jour le statut
    sqlx::query(
        r#"
        UPDATE qr_code_coursier 
        SET statut = 'scanne', date_scan = $1, location_scan = $2, scan_par = $3
        WHERE id = $4
        "#,
    )
    .bind(now)
    .bind(&payload.location_scan)
    .bind(&payload.scan_par)
    .bind(qr_id)
    .execute(pool)
    .await
    .map_err(|e| {
        log::error!("[scan_shareable_qrcode] Erreur mise à jour QR: {}", e);
        AppError::Internal("Erreur mise à jour QR code".to_string())
    })?;

    // Traiter selon le type de QR code
    let result = if let Some(commande_id) = qr_commande_id {
        // QR pour commande librairie
        sqlx::query(
            r#"
            UPDATE commandes_mixtes 
            SET statut = 'livraison_en_cours', date_scan_qr = $1
            WHERE id = $2
            "#,
        )
        .bind(now)
        .bind(commande_id)
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
    } else if let Some(delivery_id) = qr_delivery_id {
        // QR pour livraison standard
        sqlx::query(
            r#"
            UPDATE deliveries 
            SET status = 'delivered', delivered_at = $1, delivery_proof_type = 'qr_code_scan'
            WHERE id = $2
            "#,
        )
        .bind(now)
        .bind(delivery_id)
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
        sqlx::query(
            r#"
            INSERT INTO delivery_proof_media (
                delivery_id, media_type, media_url, proof_type, uploaded_by, metadata
            ) VALUES ($1, 'image', $2, 'delivery', $3, $4)
            "#,
        )
        .bind(qr_delivery_id)
        .bind(&proof_url)
        .bind(&payload.scan_par)
        .bind(serde_json::json!({"qr_scan": true, "qr_id": qr_id}))
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

    let qr_row = sqlx::query(
        r#"
        SELECT id, commande_id, delivery_id, statut, date_generation, 
               date_scan, partageable, valide_jusqua, location_scan
        FROM qr_code_coursier 
        WHERE id = $1 AND partageable = true
        "#,
    )
    .bind(qr_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("[get_qrcode_status] Erreur récupération QR: {}", e);
        AppError::Internal("Erreur récupération QR code".to_string())
    })?;

    let qr = qr_row.ok_or_else(|| AppError::NotFound("QR code non trouvé".to_string()))?;

    let qr_id_val: Option<Uuid> = qr.try_get("id").unwrap_or(None);
    let qr_statut: Option<String> = qr.try_get("statut").unwrap_or(None);
    let qr_date_generation: Option<chrono::DateTime<chrono::Utc>> =
        qr.try_get("date_generation").unwrap_or(None);
    let qr_date_scan: Option<chrono::DateTime<chrono::Utc>> =
        qr.try_get("date_scan").unwrap_or(None);
    let qr_valide_jusqua: Option<chrono::DateTime<chrono::Utc>> =
        qr.try_get("valide_jusqua").unwrap_or(None);
    let qr_location_scan: Option<String> = qr.try_get("location_scan").unwrap_or(None);
    let qr_partageable: Option<bool> = qr.try_get("partageable").unwrap_or(None);

    let now = Utc::now();
    let is_expired = qr_valide_jusqua.is_some() && qr_valide_jusqua < Some(now);

    Ok(Json(serde_json::json!({
        "success": true,
        "qr_id": qr_id_val,
        "statut": qr_statut,
        "date_generation": qr_date_generation,
        "date_scan": qr_date_scan,
        "valide_jusqua": qr_valide_jusqua,
        "is_expired": is_expired,
        "location_scan": qr_location_scan,
        "partageable": qr_partageable
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
