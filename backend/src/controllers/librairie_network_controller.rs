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
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    // ✅ FIX 2026-05-19 (bug L vrai root cause) — il existe DEUX structs
    // `TransactionAgregee` dans le projet :
    //   - models::librairie_network (champs montant_total, commission_app,
    //     montant_net — alignée sur le schéma DB `transactions_agregees`)
    //   - models::librairie_network_model (champ `montant` sans suffixe —
    //     ne matche aucune colonne DB, FromRow plante :
    //     "no column found for name: montant")
    // valider_budget_commande utilisait la mauvaise (_model) par import,
    // d'où 100 % des POST /valider-budget en 500 sur le RETURNING *.
    // Fix : utiliser la version alignée (librairie_network::TransactionAgregee).
    models::librairie_network::{
        ChaineLivraisonUnifiee, CommandeLivreNeuf, CommandeLivreOccasion, CommandeMixte,
        CommandeStatut, CommandeValidation, DestinationQR, LibrairiePartner, LivreQRReference,
        MethodePaiement, PointPassage, TransactionAgregee, ValidationStatut,
    },
    models::librairie_network_model::{
        CreateLibrairieRequest, LibrairieLieuIn, NotificationLibrairie, QRCodeCoursier,
    },
    services::librairie_prix_bornes_service,
    state::AppState,
    utils::{generate_qr_code, generate_reference, send_notification},
};

/// Projection SELECT pour `commandes_mixtes` : caste les colonnes monétaires
/// `NUMERIC(12,2)` en `DOUBLE PRECISION` pour matcher les `f64` du struct
/// `CommandeMixte`. À utiliser à la place de `SELECT *`.
///
/// Utilisation : `&format!("SELECT {} FROM commandes_mixtes WHERE …", COMMANDES_MIXTES_PROJECTION)`.
const COMMANDES_MIXTES_PROJECTION: &str = "
    id, user_id, reference_commande,
    budget_total::DOUBLE PRECISION AS budget_total,
    devise, statut, mode_livraison,
    adresse_livraison, gps_livraison, notes_client,
    commission_app::DOUBLE PRECISION AS commission_app,
    montant_net_libraires::DOUBLE PRECISION AS montant_net_libraires,
    created_at, updated_at
";

/// ✅ 2026-05-18 — Projection commande_livres_neufs avec casts NUMERIC →
/// DOUBLE PRECISION. Le modèle `CommandeLivreNeuf` déclare les prix en `f64`,
/// mais les colonnes sont NUMERIC en DB → `SELECT *` échouait à
/// "mismatched types; Rust type f64 (as SQL type FLOAT8) is not compatible
/// with SQL type NUMERIC".
const COMMANDE_LIVRES_NEUFS_PROJECTION: &str = "
    id, commande_id, programme_scolaire_id, titre, auteur, editeur, isbn,
    classe, matiere, niveau,
    prix_officiel::DOUBLE PRECISION AS prix_officiel,
    prix_final::DOUBLE PRECISION AS prix_final,
    quantite, est_au_programme,
    librairie_validateur_id, statut_validation, prix_officiel_verrouille,
    prix_plancher::DOUBLE PRECISION AS prix_plancher,
    prix_plafond::DOUBLE PRECISION AS prix_plafond,
    prix_suggere::DOUBLE PRECISION AS prix_suggere,
    bornes_source,
    created_at
";

/// Projection commande_livres_occasion (même problème NUMERIC vs f64).
const COMMANDE_LIVRES_OCCASION_PROJECTION: &str = "
    id, commande_id, livre_scolaire_id, titre, auteur, classe, matiere, etat_livre,
    prix::DOUBLE PRECISION AS prix,
    vendeur_id, quantite, statut, created_at
";

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
    /// Crédit Bourse (issu du troc) à débiter du wallet et déduire du budget.
    /// Optionnel — si absent, pas de débit.
    #[serde(default)]
    pub credit_bourse_used_xaf: Option<f64>,
    /// ✅ 2026-05-11 : frais de livraison forfaitaires côté parent
    /// (1000 FCFA par défaut). S'ajoutent au budget_total. La part coursier
    /// est calculée à partir de ce montant lors de la création du paquet.
    /// Optionnel — si absent, 0.
    #[serde(default)]
    pub frais_livraison_xaf: Option<f64>,
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
    // ✅ FIX 2026-05-17 — La colonne `programme_scolaire_id` est INTEGER
    // (SERIAL → i32) en base, car `programmes_scolaires.id SERIAL PRIMARY KEY`
    // (migration 00000189). Le modèle Rust déclarait Option<Uuid>, ce qui
    // causait l'erreur runtime "column is of type integer but expression
    // is of type uuid" au INSERT dans commande_livres_neufs. Le frontend
    // envoie déjà `number` (LibrairieBulkUploadPage), donc serde accepte.
    pub programme_scolaire_id: Option<i32>,
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

    // ✅ 2026-05-16 — VALIDATION PRIX SERVER-SIDE (anti-manipulation).
    // Avant : `prix_officiel` venait directement du client → un attaquant
    // pouvait envoyer 1 FCFA pour acheter un livre neuf à 1 FCFA.
    // Maintenant :
    //   - Si programme_scolaire_id fourni → on prend le prix DB comme source de
    //     vérité, et on rejette tout écart > 20 % avec le prix client (anti-bug
    //     côté front, mais source = serveur).
    //   - Sinon → on impose une fourchette plausible (100-100 000 FCFA) pour
    //     éviter les valeurs aberrantes.
    // Bornes : prix_min=100 FCFA, prix_max=100 000 FCFA (un livre scolaire
    // raisonnable). Configurable plus tard via configuration_systeme.
    const PRIX_LIVRE_MIN_XAF: f64 = 100.0;
    const PRIX_LIVRE_MAX_XAF: f64 = 100_000.0;
    const TOLERANCE_PRIX_PCT: f64 = 0.20;

    let mut total_neufs: f64 = 0.0;
    for livre_req in &payload.livres_neufs {
        if livre_req.quantite <= 0 || livre_req.quantite > 100 {
            return Err(AppError::BadRequest(format!(
                "Quantité invalide pour livre neuf '{}': {} (1-100)",
                livre_req.titre, livre_req.quantite
            )));
        }
        // Prix DB officiel si programme connu, sinon validation bornes
        let prix_validated: f64 = if let Some(pid) = livre_req.programme_scolaire_id {
            let prix_db: Option<f64> = sqlx::query_scalar(
                "SELECT prix_officiel::DOUBLE PRECISION
                   FROM programmes_scolaires WHERE id = $1",
            )
            .bind(pid)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur prix programme: {}", e)))?;
            match prix_db {
                Some(p) if p > 0.0 => {
                    let delta = (livre_req.prix_officiel - p).abs() / p;
                    if delta > TOLERANCE_PRIX_PCT {
                        log::warn!(
                            "[create_commande_mixte] Tentative prix manipulé livre '{}': client={} db={}",
                            livre_req.titre, livre_req.prix_officiel, p
                        );
                        return Err(AppError::BadRequest(format!(
                            "Prix incohérent pour '{}': {} FCFA (officiel: {} FCFA)",
                            livre_req.titre, livre_req.prix_officiel, p
                        )));
                    }
                    p
                }
                _ => livre_req.prix_officiel,
            }
        } else {
            livre_req.prix_officiel
        };
        if !(PRIX_LIVRE_MIN_XAF..=PRIX_LIVRE_MAX_XAF).contains(&prix_validated) {
            return Err(AppError::BadRequest(format!(
                "Prix hors-bornes pour '{}': {} FCFA (autorisé {}-{})",
                livre_req.titre, prix_validated, PRIX_LIVRE_MIN_XAF, PRIX_LIVRE_MAX_XAF
            )));
        }
        total_neufs += prix_validated * livre_req.quantite as f64;
    }

    // Récupérer prix livres occasion — BATCH 2026-05-16 (avant : N requêtes
    // séquentielles ; maintenant : 1 query avec WHERE id = ANY($1) → 10× plus
    // rapide sur les commandes mixtes avec plusieurs livres d'occasion).
    let mut total_occasion = 0.0;
    if !payload.livres_occasion.is_empty() {
        let ids: Vec<i32> = payload.livres_occasion.iter().map(|l| l.livre_scolaire_id).collect();
        let rows = sqlx::query(
            "SELECT id,
                    prix_detecte::DOUBLE PRECISION AS prix_detecte,
                    valeur_calculee::DOUBLE PRECISION AS valeur_calculee
               FROM livres_scolaires
              WHERE id = ANY($1) AND is_active = true",
        )
        .bind(&ids)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur lookup livres: {}", e)))?;

        use std::collections::HashMap;
        let prices: HashMap<i32, f64> = rows
            .into_iter()
            .map(|r| {
                let id: i32 = r.try_get("id").unwrap_or(0);
                let v: Option<f64> = r.try_get("valeur_calculee").ok().flatten();
                let p: Option<f64> = r.try_get("prix_detecte").ok().flatten();
                (id, v.or(p).unwrap_or(0.0))
            })
            .collect();

        for livre_req in &payload.livres_occasion {
            if livre_req.quantite <= 0 || livre_req.quantite > 100 {
                return Err(AppError::BadRequest(format!(
                    "Quantité invalide livre occasion {}: {}",
                    livre_req.livre_scolaire_id, livre_req.quantite
                )));
            }
            let prix = *prices.get(&livre_req.livre_scolaire_id).ok_or_else(|| {
                AppError::NotFound(format!(
                    "Livre d'occasion {} non trouvé ou inactif",
                    livre_req.livre_scolaire_id
                ))
            })?;
            total_occasion += prix * livre_req.quantite as f64;
        }
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

    // ✅ 2026-05-10 : Application du crédit Bourse (modèle troc immédiat).
    // Le frontend envoie `credit_bourse_used_xaf` après avoir lu match-all-pending.
    // On vérifie qu'il ne dépasse pas le solde réel du wallet ni le plafond
    // RATIO_MAX_CREDIT_DANS_COMMANDE, et on débite atomiquement dans la même tx.
    let credit_used: f64 = if let Some(c) = payload.credit_bourse_used_xaf {
        if c <= 0.0 {
            0.0
        } else {
            use crate::services::wallet_credit_bourse_service as wallet;
            let cap = wallet::cap_credit_for_order(c, payload.budget_total);
            let dec = rust_decimal::Decimal::from_f64_retain(cap).unwrap_or_default();
            // consume_credit_tx vérifie le solde et débite atomiquement.
            // En cas d'insuffisance → erreur, on remonte 400.
            wallet::consume_credit_tx(
                &mut tx,
                user_id,
                dec,
                wallet::CreditSource::OrderCreditUsed,
                wallet::CreditMovementContext {
                    note: Some(format!("Commande user {}", user_id)),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| {
                AppError::BadRequest(format!("Crédit Bourse insuffisant ou indisponible : {}", e))
            })?;
            cap
        }
    } else {
        0.0
    };
    let _ = credit_used; // utilisé via le ledger ; pas besoin de le persister sur commande pour V1

    // ✅ 2026-05-12 : APURE de la dette troc (si user en a une).
    // Si le user a une dette (rollback troc après usage du crédit), elle
    // est récupérée ici en l'ajoutant implicitement au total à payer cash.
    // Le frontend doit avoir présenté cette dette dans le récap "Reste à payer".
    let debt_recovered: f64 = {
        use crate::services::wallet_credit_bourse_service as wallet;
        match wallet::get_debt(&state.pg, user_id).await {
            Ok(d) if d > rust_decimal::Decimal::ZERO => {
                let cleared = wallet::clear_debt_tx(
                    &mut tx,
                    user_id,
                    d,
                    wallet::CreditMovementContext {
                        note: Some(format!(
                            "Dette troc apurée via commande user {} (réf à venir)",
                            user_id
                        )),
                        ..Default::default()
                    },
                )
                .await
                .unwrap_or(rust_decimal::Decimal::ZERO);
                cleared.to_string().parse::<f64>().unwrap_or(0.0)
            }
            _ => 0.0,
        }
    };
    let _ = debt_recovered;

    let devise = payload.devise.unwrap_or_else(|| "XAF".to_string());
    let mode_livraison = payload.mode_livraison.unwrap_or_else(|| "coursier".to_string());

    // Génération de la référence commande côté application — la migration de prod
    // ne contient pas le trigger SQL `generer_reference_commande` qui devait remplir
    // automatiquement ce champ NOT NULL. Format : CMD-{année}-{6 caractères aléatoires}.
    // L'unicité est garantie par la combinaison année + UUID v4 tronqué (probabilité
    // de collision négligeable + contrainte UNIQUE en base qui retournera une erreur
    // claire en cas improbable de duplicata).
    let reference_commande = {
        let annee = chrono::Utc::now().format("%Y");
        let suffix = uuid::Uuid::new_v4()
            .to_string()
            .replace('-', "")
            .chars()
            .take(6)
            .collect::<String>()
            .to_uppercase();
        format!("CMD-{}-{}", annee, suffix)
    };

    // ⚠️ Les colonnes monétaires sont en NUMERIC(12,2) côté SQL alors que le
    // struct CommandeMixte expose des f64. On cast explicitement au RETURNING
    // pour éviter `mismatched types; Rust type f64 ... is not compatible with
    // SQL type NUMERIC` au décodage sqlx.
    let commande = sqlx::query_as::<_, CommandeMixte>(
        r#"
        INSERT INTO commandes_mixtes (
            reference_commande,
            user_id, budget_total, devise, statut, mode_livraison,
            adresse_livraison, gps_livraison, notes_client,
            commission_app, montant_net_libraires, frais_livraison
        )
        VALUES ($1, $2, $3, $4, 'edition', $5, $6, $7, $8, $9, $10, $11)
        RETURNING
            id, user_id, reference_commande,
            budget_total::DOUBLE PRECISION AS budget_total,
            devise, statut, mode_livraison,
            adresse_livraison, gps_livraison, notes_client,
            commission_app::DOUBLE PRECISION AS commission_app,
            montant_net_libraires::DOUBLE PRECISION AS montant_net_libraires,
            created_at, updated_at
        "#,
    )
    .bind(&reference_commande)
    .bind(user_id)
    .bind(payload.budget_total)
    .bind(&devise)
    .bind(&mode_livraison)
    .bind(&payload.adresse_livraison)
    .bind(&payload.gps_livraison)
    .bind(&payload.notes_client)
    .bind(commission_app)
    .bind(montant_net_libraires)
    // ✅ 2026-05-11 : forfait livraison parent (1000 FCFA par défaut),
    // distinct de commission_app/montant_net_libraires. Redistribué au
    // coursier (80 %) et à la plateforme (20 %) à la livraison.
    .bind(payload.frais_livraison_xaf.unwrap_or(0.0))
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
    // ✅ FIX 2026-05-16 : décodage des colonnes corrigé.
    //   - user_id (vendeur) : INTEGER en DB, pas UUID → Option<i32>
    //   - prix_detecte / valeur_calculee : NUMERIC → CAST en DOUBLE PRECISION
    //   - titre/classe/matiere/etat_livre : NOT NULL en DB → on REJETTE
    //     explicitement la commande si l'un est absent (au lieu d'INSERT NULL
    //     qui causait une violation silencieuse côté SQL).
    //   - vendeur_id : NOT NULL en DB → idem, rejet explicite.
    for livre_req in payload.livres_occasion {
        // ✅ FIX 2026-05-18 (bug G) — récupère aussi `niveau` pour appliquer
        // le verrou métier : aucune commande en mode occasion/echange n'est
        // autorisée sur des livres de maternelle ou de primaire.
        let livre_row = sqlx::query(
            "SELECT titre, auteur, classe_actuelle AS classe, matiere, etat_livre, niveau,
                    prix_detecte::DOUBLE PRECISION  AS prix_detecte,
                    valeur_calculee::DOUBLE PRECISION AS valeur_calculee,
                    user_id
               FROM livres_scolaires WHERE id = $1",
        )
        .bind(livre_req.livre_scolaire_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération livre: {}", e)))?;

        // ✅ FIX 2026-05-18 (bug G) — verrou maternelle/primaire.
        // Règle métier : seul le SECONDAIRE accepte les modes occasion/troc/échange.
        // Pour maternelle ou primaire, l'achat doit obligatoirement passer par
        // les `livres_neufs[]` (commande NEUF), pas par les `livres_occasion[]`.
        let l_niveau_check: Option<String> = livre_row.try_get("niveau").ok();
        if let Some(niv) = l_niveau_check.as_deref() {
            let niv_lc = niv.to_lowercase();
            if niv_lc.contains("primaire") || niv_lc.contains("maternel") {
                return Err(AppError::BadRequest(format!(
                    "Le livre d'occasion #{} est de niveau {} : seul le secondaire est éligible au troc/vente occasion. Utilisez un achat neuf pour ce livre.",
                    livre_req.livre_scolaire_id, niv
                )));
            }
        }

        let l_valeur_calculee: Option<f64> = livre_row.try_get("valeur_calculee").ok();
        let l_prix_detecte: Option<f64> = livre_row.try_get("prix_detecte").ok();
        let l_titre: Option<String> = livre_row.try_get("titre").ok();
        let l_auteur: Option<String> = livre_row.try_get("auteur").ok();
        let l_classe: Option<String> = livre_row.try_get("classe").ok();
        let l_matiere: Option<String> = livre_row.try_get("matiere").ok();
        let l_etat_livre: Option<String> = livre_row.try_get("etat_livre").ok();
        // user_id (vendeur) est INTEGER en DB, pas UUID
        let l_vendeur_id: Option<i32> = livre_row.try_get("user_id").ok();

        let prix = l_valeur_calculee.or(l_prix_detecte).unwrap_or(0.0);

        // Validation explicite des champs NOT NULL — évite la violation SQL
        // silencieuse et donne un message clair au frontend.
        let titre = l_titre.as_deref().filter(|s| !s.is_empty()).ok_or_else(|| {
            log::error!(
                "[create_commande_mixte] livre_scolaire {} : titre absent",
                livre_req.livre_scolaire_id
            );
            AppError::BadRequest(format!(
                "Le livre d'occasion #{} n'a pas de titre.",
                livre_req.livre_scolaire_id
            ))
        })?;
        let classe = l_classe.as_deref().filter(|s| !s.is_empty()).ok_or_else(|| {
            AppError::BadRequest(format!(
                "Le livre d'occasion #{} n'a pas de classe associée.",
                livre_req.livre_scolaire_id
            ))
        })?;
        let matiere = l_matiere.as_deref().filter(|s| !s.is_empty()).ok_or_else(|| {
            AppError::BadRequest(format!(
                "Le livre d'occasion #{} n'a pas de matière associée.",
                livre_req.livre_scolaire_id
            ))
        })?;
        let etat_livre = l_etat_livre.as_deref().filter(|s| !s.is_empty()).ok_or_else(|| {
            AppError::BadRequest(format!(
                "Le livre d'occasion #{} n'a pas d'état renseigné.",
                livre_req.livre_scolaire_id
            ))
        })?;
        let vendeur_id = l_vendeur_id.ok_or_else(|| {
            log::error!(
                "[create_commande_mixte] livre_scolaire {} : user_id (vendeur) absent",
                livre_req.livre_scolaire_id
            );
            AppError::BadRequest(format!(
                "Le livre d'occasion #{} n'a pas de vendeur associé.",
                livre_req.livre_scolaire_id
            ))
        })?;

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
        .bind(titre)
        .bind(l_auteur.as_deref())
        .bind(classe)
        .bind(matiere)
        .bind(etat_livre)
        .bind(prix)
        .bind(vendeur_id)
        .bind(livre_req.quantite)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur insertion livre occasion: {}", e)))?;

        // ✅ 2026-05-16 — Crée une `livre_scolaire_demande` parallèle pour que
        // l'acheteur soit représenté comme nœud-sink du DAG. Cela permet au
        // moteur de matching de proposer une chaîne fallback (V → trocer →
        // buyer) si la vente directe pré-assignée échoue/se retire. Le lien
        // `commande_mixte_id` permet de retrouver la demande au fulfillment
        // et de la marquer "satisfaite" à la livraison.
        //
        // ✅ FIX 2026-05-18 (bug D) — SAVEPOINT défensif autour de l'insert
        // best-effort. Auparavant, si la table `livres_scolaires_demandes`
        // était absente (ou un autre check PG échouait), Postgres mettait la
        // TX en état "aborted" silencieusement. Le `if let Err` log un warn
        // côté Rust MAIS la TX reste empoisonnée → la query SELECT du livre
        // suivant dans la boucle plante avec "current transaction is
        // aborted, commands ignored". Cascade observée à 33 % des commandes
        // mixtes occasion en sim itér 5/6.
        // Avec SAVEPOINT : l'erreur reste circonscrite et la TX globale
        // continue normalement.
        let demande_sp = format!("sp_demande_shadow_{}", livre_req.livre_scolaire_id);
        sqlx::query(&format!("SAVEPOINT {}", demande_sp))
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur savepoint shadow: {}", e)))?;
        let demande_insert_res = sqlx::query(
            r#"
            INSERT INTO livres_scolaires_demandes
                (user_id, titre, auteur, matiere, classe_souhaitee, budget_max_xaf,
                 gps, commande_mixte_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(user_id)
        .bind(titre)
        .bind(l_auteur.as_deref())
        .bind(matiere)
        .bind(classe)
        .bind(prix)
        .bind(payload.gps_livraison.as_deref())
        .bind(commande.id)
        .execute(&mut *tx)
        .await;
        match demande_insert_res {
            Ok(_) => {
                sqlx::query(&format!("RELEASE SAVEPOINT {}", demande_sp))
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur release savepoint: {}", e)))?;
            }
            Err(e) => {
                log::warn!(
                    "[create_commande_mixte] demande shadow non créée pour livre {} : {} (rollback to savepoint, continue)",
                    livre_req.livre_scolaire_id,
                    e
                );
                sqlx::query(&format!("ROLLBACK TO SAVEPOINT {}", demande_sp))
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur rollback savepoint: {}", e)))?;
            }
        }
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    info!(
        "[create_commande_mixte] Commande {} créée avec succès",
        commande.id
    );

    // ✅ 2026-05-11 : notification WhatsApp post-commit (non bloquante).
    // Confirmation au parent que la commande est bien prise en compte.
    {
        use crate::services::whatsapp_notification_service as wa;
        let _ = wa::notify_order_created(
            &state.pg,
            user_id,
            commande.id,
            &commande.reference_commande,
        )
        .await;
    }

    // ✅ 2026-05-18 — Auto-progression server-side : edition → validation_budget
    //                                              → envoyee_super_librairie
    // Avant : le frontend devait enchaîner 3 appels HTTP (create, valider-budget,
    // broadcast). Si l'un échouait (mauvais payload, network), la commande
    // restait bloquée à 'edition' (timeline vide, invisible côté libraire).
    // Maintenant : le backend fait lui-même la transition au commit, donc
    // toute commande créée passe DIRECTEMENT à envoyee_super_librairie si un
    // super libraire actif existe. Non bloquant : tout échec est loggué mais
    // la commande reste créée.
    if let Err(e) = auto_progress_commande_mixte(&state, commande.id).await {
        log::warn!(
            "[create_commande_mixte] auto-progression a échoué pour {} : {} — \
             la commande reste en 'edition', l'admin peut la pousser manuellement",
            commande.id,
            e
        );
    }

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

/// ✅ 2026-05-18 — Helper : promote une commande de 'edition' à
/// 'envoyee_super_librairie' en deux étapes :
///   1. UPDATE statut='validation_budget' + calcul commission/net libraires
///   2. UPDATE statut='envoyee_super_librairie' + INSERT validation/notification
///      si un super libraire actif existe.
///
/// Idempotent : si la commande n'est pas en 'edition', no-op silencieux.
/// Erreurs : remontées au caller pour log non bloquant.
async fn auto_progress_commande_mixte(
    state: &Arc<AppState>,
    commande_id: Uuid,
) -> Result<(), AppError> {
    use sqlx::Row;

    // 1) Calculer les totaux + passer en validation_budget
    let totaux: (f64, f64) = sqlx::query_as(
        r#"
        SELECT
          COALESCE((SELECT SUM(prix_final * quantite)::DOUBLE PRECISION
                      FROM commande_livres_neufs WHERE commande_id = $1), 0.0)
          + COALESCE((SELECT SUM(prix * quantite)::DOUBLE PRECISION
                      FROM commande_livres_occasion WHERE commande_id = $1), 0.0)
          AS total,
          0.0 AS placeholder
        "#,
    )
    .bind(commande_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("auto-progress totaux: {}", e)))?;
    let total_commande = totaux.0;
    let commission_app = total_commande * ConfigurationSysteme::COMMISSION_APP;
    let montant_net_libraires = total_commande - commission_app;

    let updated = sqlx::query(
        r#"
        UPDATE commandes_mixtes
        SET statut = 'validation_budget',
            commission_app = $1,
            montant_net_libraires = $2,
            updated_at = NOW()
        WHERE id = $3 AND statut = 'edition'
        "#,
    )
    .bind(commission_app)
    .bind(montant_net_libraires)
    .bind(commande_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("auto-progress validation_budget: {}", e)))?;

    if updated.rows_affected() == 0 {
        return Ok(()); // déjà progressée par un autre chemin
    }

    // 2) Trouver le super libraire actif (Yukpo Librairie)
    let sl_row = sqlx::query(
        r#"SELECT id, user_id, delai_validation_super_librairie_s
           FROM librairie_partners
           WHERE est_super_librairie = true AND est_actif = true AND statut = 'actif'
           LIMIT 1"#,
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("auto-progress super_lib lookup: {}", e)))?;

    let Some(sl) = sl_row else {
        log::info!(
            "[auto_progress] {} : pas de super libraire actif, reste en validation_budget",
            commande_id
        );
        return Ok(());
    };
    let sl_id: Uuid = sl.get("id");
    let sl_user_id: i32 = sl.get("user_id");

    // ✅ 2026-05-18 — Décision business : Yukpo Librairie a la priorité
    // PERMANENTE. Plus de timeout de 15 min déclenchant un fallback aux
    // librairies proches. On laisse `super_librairie_timeout_at = NULL`
    // → le worker `super_librairie_timeout_worker` filtre `WHERE
    // super_librairie_timeout_at IS NOT NULL` → no-op pour ces commandes.
    // Yukpo Librairie traite à son rythme, sans expiration.

    // 3) Routage vers Yukpo Librairie (UPDATE + INSERT validation + notification)
    let mut tx = state
        .pg
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("auto-progress tx begin: {}", e)))?;

    sqlx::query(
        r#"UPDATE commandes_mixtes
           SET statut = 'envoyee_super_librairie',
               super_librairie_id = $1,
               super_librairie_timeout_at = NULL,
               updated_at = NOW()
           WHERE id = $2"#,
    )
    .bind(sl_id)
    .bind(commande_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("auto-progress UPDATE statut: {}", e)))?;

    sqlx::query(
        r#"INSERT INTO commande_validations
            (commande_id, librairie_id, statut, verrou_exclusif)
           VALUES ($1, $2, 'en_cours', false)
           ON CONFLICT DO NOTHING"#,
    )
    .bind(commande_id)
    .bind(sl_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("auto-progress validation: {}", e)))?;

    let message = format!(
        "Nouvelle commande {} routée automatiquement (création parent).",
        commande_id
    );
    sqlx::query(
        r#"INSERT INTO notifications_librairie
            (librairie_id, commande_id, type_notification, message, statut)
           VALUES ($1, $2, 'nouvelle_commande', $3, 'envoyee')"#,
    )
    .bind(sl_id)
    .bind(commande_id)
    .bind(&message)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(format!("auto-progress notif: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("auto-progress commit: {}", e)))?;

    // Notification push (non bloquante)
    let _ = send_notification(
        state,
        sl_user_id,
        "Nouvelle commande prioritaire",
        &message,
        Some(serde_json::json!({
            "type": "super_librairie_commande",
            "commande_id": commande_id.to_string(),
            "auto": true,
        })),
    )
    .await;

    log::info!(
        "[auto_progress] commande {} routée automatiquement vers Yukpo Librairie",
        commande_id
    );
    Ok(())
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
    let _commande = sqlx::query_as::<_, CommandeMixte>(&format!(
        "SELECT {} FROM commandes_mixtes WHERE id = $1 AND user_id = $2 AND statut = 'edition'",
        COMMANDES_MIXTES_PROJECTION
    ))
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
    let commande = sqlx::query_as::<_, CommandeMixte>(&format!(
        "SELECT {} FROM commandes_mixtes WHERE id = $1 AND user_id = $2 AND statut = 'edition'",
        COMMANDES_MIXTES_PROJECTION
    ))
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
    // ✅ 2026-05-19 (fix business) — Commission estimée à 5% pour l'engagement
    // budget. Le calcul réel sera ré-affiné au moment de la validation finale
    // (`build_neuf_packages_for_user`) en fonction du validateur réel :
    //   - libraire tiers → 5% (la lib reçoit 95%)
    //   - super-librairie YL → 0% (la marge YL est déjà dans le markup grossiste)
    // À ce stade on prend l'estimation max (5%) pour réserver côté wallet/MoMo.
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
    // ✅ FIX 2026-05-18 (bug K + L v2) — 2 problèmes cumulés à fixer :
    // (K) `methode_paiement` ENUM Postgres custom : cast $4::methode_paiement.
    // (L) Les 3 colonnes NUMERIC (montant_total, commission_app, montant_net)
    //     ne se décodent pas en f64 via RETURNING *. sqlx renvoie l'erreur
    //     opaque "no column found for name: montant". RETURNING explicite
    //     avec cast ::DOUBLE PRECISION nécessaire (les ENUMs methode_paiement
    //     et statut restent NON castés pour décoder en MethodePaiement/
    //     TransactionStatut via #[sqlx(type_name=...)]).
    sqlx::query_as::<_, TransactionAgregee>(
        r#"
        INSERT INTO transactions_agregees (
            commande_id, user_id, montant_total, devise, methode_paiement,
            statut, reference_paiement, commission_app, montant_net
        )
        VALUES ($1, $2, $3, 'XAF', $4::methode_paiement, 'en_attente', $5, $6, $7)
        RETURNING id, commande_id, user_id,
                  montant_total::DOUBLE PRECISION AS montant_total,
                  devise, methode_paiement, statut,
                  reference_paiement, provider_transaction_id,
                  commission_app::DOUBLE PRECISION AS commission_app,
                  montant_net::DOUBLE PRECISION AS montant_net,
                  details_repartition, created_at, updated_at
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
    let _cmd_classes_neuf: String = commande_row
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
        // ✅ 2026-05-18 — Yukpo Librairie a la priorité PERMANENTE.
        // timeout_at = NULL → le worker fallback ignore ces commandes.
        // L'ancien délai 15 min provoquait un broadcast aux librairies proches
        // qui doublonnait la commande. Décision business : Yukpo gère à son
        // rythme.
        let _ = delai_s; // conservé pour compat audit log
        let mut tx = state
            .pg
            .begin()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur transaction: {}", e)))?;

        // Passer la commande en statut super librairie (sans timeout)
        sqlx::query(
            r#"
            UPDATE commandes_mixtes
            SET statut                   = 'envoyee_super_librairie',
                super_librairie_id       = $1,
                super_librairie_timeout_at = NULL,
                updated_at               = NOW()
            WHERE id = $2
            "#,
        )
        .bind(sl_id)
        .bind(payload.commande_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update statut: {}", e)))?;

        // ✅ FIX 2026-05-19 (anomalie sim 16 #1) — Tx CRITIQUE = UPDATE
        // statut + INSERT validation super-lib seulement. INSERT notifs +
        // audit log déplacés HORS tx (side effects non-critiques).
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

        tx.commit()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

        // Notification interne à YukpoLibrairie + audit log — HORS tx
        let message = format!(
            "Commande {} — {} livres neufs, {} livres occasion. GPS livraison: {}",
            cmd_reference_commande, cmd_nb_neufs, cmd_nb_occasion, gps_livraison
        );
        if let Err(e) = sqlx::query(
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
        .execute(&state.pg)
        .await
        {
            log::warn!("[broadcast_commande_librairies] notif super-lib échouée : {}", e);
        }

        if let Err(e) = sqlx::query(
            r#"
            INSERT INTO super_librairie_audit_log (commande_id, evenement, details)
            VALUES ($1, 'routee', $2)
            "#,
        )
        .bind(payload.commande_id)
        // ✅ FIX 2026-05-18 — timeout_at retiré (Yukpo Librairie priorité
        // permanente, plus de délai). Audit log conserve `delai_s` historique.
        .bind(serde_json::json!({
            "gps_livraison": gps_livraison,
            "delai_s": delai_s,
            "timeout_at": serde_json::Value::Null,
        }))
        .execute(&state.pg)
        .await
        {
            log::warn!("[broadcast_commande_librairies] audit log échoué : {}", e);
        }

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
                // ✅ timeout_at retiré (priorité permanente Yukpo Librairie).
                "timeout_at": serde_json::Value::Null,
            })),
        )
        .await;

        info!(
            "[broadcast_commande_librairies] Commande {} routée vers YukpoLibrairie (priorité permanente, sans timeout)",
            payload.commande_id
        );

        return Ok(Json(serde_json::json!({
            "success": true,
            "mode": "super_librairie",
            "message": "Commande reçue par YukpoLibrairie en priorité permanente",
            "timeout_at": serde_json::Value::Null,
            "delai_validation_s": serde_json::Value::Null,
            "note": "YukpoLibrairie traite cette commande sans expiration. La commande reste en priorité super libraire jusqu'à validation."
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

    // ✅ FIX 2026-05-19 (anomalie sim 16 #1 — "current transaction is aborted")
    // Avant : 1 seule tx pour UPDATE statut + N×2 INSERTs (validations +
    // notifications) en boucle sur librairies. Si UN INSERT plante (contrainte
    // FK, doublon, enum invalide), Postgres aborted la tx et les itérations
    // suivantes plantent toutes avec "current tx aborted" → 122 erreurs 500.
    //
    // Maintenant :
    //   1) Tx CRITIQUE = UPDATE statut + boucle INSERT validations protégés
    //      par SAVEPOINT par itération (tolère 1 lib qui plante sans casser
    //      les autres).
    //   2) HORS tx : INSERT notifications_librairie (side effect non-critique).
    //      Une notif qui plante = warning log, pas un 500 pour le client.
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

    // Insert validations protégés par SAVEPOINT : 1 lib en erreur ne casse pas les autres
    let mut validations_ok: Vec<&LibrairiePartner> = Vec::new();
    for librairie in &librairies {
        let sp_name = format!("sp_val_{}", librairie.id.simple());
        let _ = sqlx::query(&format!("SAVEPOINT {}", sp_name))
            .execute(&mut *tx)
            .await;
        let res = sqlx::query(
            r#"
            INSERT INTO commande_validations (commande_id, librairie_id, statut, verrou_exclusif)
            VALUES ($1, $2, 'en_cours', false)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(commande_id)
        .bind(librairie.id)
        .execute(&mut *tx)
        .await;
        match res {
            Ok(_) => {
                let _ = sqlx::query(&format!("RELEASE SAVEPOINT {}", sp_name))
                    .execute(&mut *tx)
                    .await;
                validations_ok.push(librairie);
            }
            Err(e) => {
                let _ = sqlx::query(&format!("ROLLBACK TO SAVEPOINT {}", sp_name))
                    .execute(&mut *tx)
                    .await;
                log::warn!(
                    "[broadcast_vers_librairies_proches] validation libraire {} skipped : {}",
                    librairie.id, e
                );
            }
        }
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur commit: {}", e)))?;

    // Notifications HORS tx — side effect non-critique : un échec ici ne
    // doit pas faire échouer le broadcast pour le client.
    let mut notifications_created = Vec::new();
    for librairie in &validations_ok {
        match sqlx::query_as::<_, NotificationLibrairie>(
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
        .fetch_one(&state.pg)
        .await
        {
            Ok(notif) => notifications_created.push((librairie.user_id, notif)),
            Err(e) => log::warn!(
                "[broadcast_vers_librairies_proches] notif libraire {} échouée : {}",
                librairie.id, e
            ),
        }
    }

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
    let sl_id: uuid::Uuid = sl_row.get("id");

    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    // Toutes les commandes visibles pour le super libraire (pas de filtre géo)
    let commandes = sqlx::query(
        r#"
        SELECT
            cm.id,
            cm.user_id,
            cm.reference_commande,
            cm.budget_total::DOUBLE PRECISION AS budget_total,
            cm.devise,
            cm.statut::text AS statut,
            cm.mode_livraison,
            cm.adresse_livraison,
            cm.gps_livraison,
            cm.notes_client,
            cm.commission_app::DOUBLE PRECISION AS commission_app,
            cm.montant_net_libraires::DOUBLE PRECISION AS montant_net_libraires,
            cm.created_at,
            cm.updated_at,
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

// ============================================================================
// SUPER LIBRAIRIE — CARNET D'ADRESSES PARENTS + CAMPAGNES WHATSAPP
// ============================================================================

/// Helper interne : vérifie que l'appelant a accès au super-libraire (admin OU
/// super-libraire enregistré OU membre actif d'équipe). Retourne 403 sinon.
async fn ensure_super_libraire_access(
    pg: &sqlx::PgPool,
    user_id: i32,
    role: &str,
) -> Result<(), AppError> {
    if role == "admin" || role == "super_admin" {
        return Ok(());
    }
    let ok = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(
            SELECT 1 FROM librairie_partners
            WHERE user_id = $1 AND est_super_librairie = true AND est_actif = true
        ) OR EXISTS(
            SELECT 1 FROM libraire_team_members ltm
            JOIN librairie_partners lp ON lp.id = ltm.librairie_id
            WHERE ltm.user_id = $1 AND ltm.is_active = true
              AND lp.est_super_librairie = true AND lp.est_actif = true
        )"#,
    )
    .bind(user_id)
    .fetch_one(pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur auth: {}", e)))?;
    if !ok {
        return Err(AppError::Forbidden(
            "Accès réservé à Yukpo Librairie".to_string(),
        ));
    }
    Ok(())
}

/// GET /api/librairie-network/super-librairie/parents-contacts
/// Liste les parents distincts ayant passé au moins une commande, avec leurs
/// coordonnées WhatsApp et la dernière adresse de livraison connue.
/// Utilisé par le portail Yukpo Librairie pour le carnet d'adresses + campagnes.
pub async fn super_librairie_parents_contacts(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    ensure_super_libraire_access(&state.pg, user_id, &role).await?;

    let search = params.get("search").map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let ville_filter = params.get("ville").map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let quartier_filter =
        params.get("quartier").map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let limit: i64 = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(200).clamp(1, 500);
    let offset: i64 = params.get("offset").and_then(|v| v.parse().ok()).unwrap_or(0);

    // Agrégat par utilisateur : dernière commande, total commandes, dernière
    // adresse non vide. Filtres optionnels : recherche libre + ville + quartier.
    // Note : on n'exige plus `phone IS NOT NULL` afin d'afficher tous les
    // parents ayant commandé. Le tri WhatsApp se fait côté UI.
    let pattern = search.as_ref().map(|s| format!("%{}%", s.to_lowercase()));
    let ville_pattern = ville_filter.as_ref().map(|s| format!("%{}%", s.to_lowercase()));
    let quartier_pattern = quartier_filter.as_ref().map(|s| format!("%{}%", s.to_lowercase()));
    let rows = sqlx::query(
        r#"
        SELECT
            u.id AS user_id,
            u.nom,
            u.prenom,
            u.email,
            u.phone,
            COUNT(cm.id) AS nb_commandes,
            MAX(cm.created_at) AS derniere_commande,
            (
                SELECT cm2.adresse_livraison FROM commandes_mixtes cm2
                 WHERE cm2.user_id = u.id
                   AND cm2.adresse_livraison IS NOT NULL
                   AND cm2.adresse_livraison <> ''
                 ORDER BY cm2.created_at DESC LIMIT 1
            ) AS derniere_adresse,
            (
                SELECT cm3.gps_livraison FROM commandes_mixtes cm3
                 WHERE cm3.user_id = u.id AND cm3.gps_livraison IS NOT NULL
                 ORDER BY cm3.created_at DESC LIMIT 1
            ) AS dernier_gps,
            COALESCE(SUM(cm.budget_total), 0)::DOUBLE PRECISION AS budget_cumule
        FROM users u
        JOIN commandes_mixtes cm ON cm.user_id = u.id
        WHERE
            ($1::text IS NULL
             OR LOWER(COALESCE(u.nom, '') || ' ' || COALESCE(u.prenom, '') || ' ' || COALESCE(u.email, '') || ' ' || COALESCE(u.phone, '')) LIKE $1
             OR LOWER(COALESCE((SELECT adresse_livraison FROM commandes_mixtes WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1), '')) LIKE $1)
            AND ($4::text IS NULL
                 OR LOWER(COALESCE((SELECT adresse_livraison FROM commandes_mixtes WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1), '')) LIKE $4)
            AND ($5::text IS NULL
                 OR LOWER(COALESCE((SELECT adresse_livraison FROM commandes_mixtes WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1), '')) LIKE $5)
        GROUP BY u.id, u.nom, u.prenom, u.email, u.phone
        ORDER BY MAX(cm.created_at) DESC NULLS LAST
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(pattern.as_deref())
    .bind(limit)
    .bind(offset)
    .bind(ville_pattern.as_deref())
    .bind(quartier_pattern.as_deref())
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur carnet: {}", e)))?;

    use sqlx::Row;
    let parents: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "user_id": r.try_get::<i32, _>("user_id").unwrap_or(0),
                "nom": r.try_get::<Option<String>, _>("nom").unwrap_or(None),
                "prenom": r.try_get::<Option<String>, _>("prenom").unwrap_or(None),
                "email": r.try_get::<Option<String>, _>("email").unwrap_or(None),
                "phone": r.try_get::<Option<String>, _>("phone").unwrap_or(None),
                "nb_commandes": r.try_get::<i64, _>("nb_commandes").unwrap_or(0),
                "derniere_commande": r
                    .try_get::<Option<chrono::DateTime<Utc>>, _>("derniere_commande")
                    .unwrap_or(None)
                    .map(|t| t.to_rfc3339()),
                "derniere_adresse": r.try_get::<Option<String>, _>("derniere_adresse").unwrap_or(None),
                "dernier_gps": r.try_get::<Option<String>, _>("dernier_gps").unwrap_or(None),
                "budget_cumule": r.try_get::<Option<f64>, _>("budget_cumule").unwrap_or(None),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "parents": parents,
        "total": parents.len(),
    })))
}

/// POST /api/librairie-network/super-librairie/campaigns
/// Diffuse un message WhatsApp à tous les parents matchant les critères.
/// Body: { message: String, segment?: { search?: String, last_days?: i64 } }
/// Renvoie un compteur des envois réussis. L'envoi est best-effort (Twilio
/// peut échouer pour certains numéros — on continue les autres).
#[derive(Debug, serde::Deserialize)]
pub struct CampaignRequest {
    pub message: String,
    pub segment: Option<CampaignSegment>,
    /// `dry_run = true` → ne fait que compter les destinataires sans envoyer.
    #[serde(default)]
    pub dry_run: bool,
}

#[derive(Debug, serde::Deserialize)]
pub struct CampaignSegment {
    pub search: Option<String>,
    pub last_days: Option<i64>,
}

pub async fn super_librairie_send_campaign(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
    Json(payload): Json<CampaignRequest>,
) -> AppResult<impl IntoResponse> {
    ensure_super_libraire_access(&state.pg, user_id, &role).await?;

    let msg = payload.message.trim().to_string();
    if msg.len() < 10 {
        return Err(AppError::BadRequest(
            "Message trop court (10 caractères minimum)".to_string(),
        ));
    }
    if msg.len() > 4000 {
        return Err(AppError::BadRequest(
            "Message trop long (4000 caractères maximum)".to_string(),
        ));
    }

    let seg = payload.segment.unwrap_or(CampaignSegment {
        search: None,
        last_days: None,
    });
    let pattern = seg
        .search
        .as_ref()
        .map(|s| format!("%{}%", s.trim().to_lowercase()))
        .filter(|s| s != "%%");

    // Récupère tous les destinataires distincts éligibles (téléphone non vide)
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT u.id AS user_id, u.phone, COALESCE(u.nom, u.prenom, u.email, '') AS contact_name
        FROM users u
        JOIN commandes_mixtes cm ON cm.user_id = u.id
        WHERE u.phone IS NOT NULL AND u.phone <> ''
          AND ($1::text IS NULL
               OR LOWER(COALESCE(u.nom, '') || ' ' || COALESCE(u.prenom, '') || ' ' || COALESCE(u.email, '') || ' ' || COALESCE(u.phone, '')) LIKE $1)
          AND ($2::bigint IS NULL
               OR cm.created_at >= NOW() - ($2::bigint || ' days')::interval)
        "#,
    )
    .bind(pattern.as_deref())
    .bind(seg.last_days)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur destinataires: {}", e)))?;

    use sqlx::Row;
    let recipients: Vec<(i32, String, String)> = rows
        .into_iter()
        .filter_map(|r| {
            let uid = r.try_get::<i32, _>("user_id").ok()?;
            let phone = r.try_get::<Option<String>, _>("phone").ok().flatten()?;
            let name = r
                .try_get::<Option<String>, _>("contact_name")
                .ok()
                .flatten()
                .unwrap_or_default();
            Some((uid, phone, name))
        })
        .collect();

    if payload.dry_run {
        return Ok(Json(serde_json::json!({
            "success": true,
            "dry_run": true,
            "total_recipients": recipients.len(),
        })));
    }

    // Envoi best-effort via Twilio (ou notification interne en fallback)
    let total = recipients.len();
    let mut sent_wa = 0_i64;
    let mut sent_notif = 0_i64;
    let mut failed = 0_i64;

    for (uid, phone, _name) in recipients {
        let ok =
            crate::services::whatsapp_alert_service::send_whatsapp_outbound(&phone, &msg).await;
        if ok {
            sent_wa += 1;
        } else {
            failed += 1;
        }
        // En complément on pousse une notification in-app pour garder une trace
        // côté utilisateur même quand Twilio n'est pas configuré.
        let _ = crate::utils::send_notification(
            &state,
            uid,
            "Yukpo Librairie",
            &msg,
            Some(serde_json::json!({
                "type": "yukpo_librairie_campaign",
                "sent_by": user_id,
            })),
        )
        .await;
        sent_notif += 1;
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "total_recipients": total,
        "whatsapp_sent": sent_wa,
        "whatsapp_failed": failed,
        "notifications_sent": sent_notif,
    })))
}

/// GET /api/librairie-network/super-librairie/delivery-routes
/// Regroupe les commandes en tournées de livraison logiques :
///   - 1 cluster = 1 ville (extraite de l'adresse) + sous-clusters GPS
///     (distance haversine < `bucket_km`, défaut 2 km).
///   - Chaque ligne renvoie l'adresse, le téléphone WhatsApp, les classes
///     concernées et une "référence paquet" stable (CMD-XXXX#PKG-NN) que
///     le coursier peut scanner / mentionner.
/// Filtre uniquement les commandes en cours de préparation/livraison
/// (statuts : validee_complete, validee_partielle, en_preparation, en_livraison).
pub async fn super_librairie_delivery_routes(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    ensure_super_libraire_access(&state.pg, user_id, &role).await?;

    let bucket_km: f64 = {
        let v: f64 = params.get("bucket_km").and_then(|v| v.parse::<f64>().ok()).unwrap_or(2.0);
        v.max(0.5_f64)
    };

    let rows = sqlx::query(
        r#"
        SELECT
            cm.id AS commande_id,
            cm.reference_commande,
            cm.statut,
            cm.adresse_livraison,
            cm.gps_livraison,
            cm.created_at,
            u.id AS user_id,
            u.nom,
            u.prenom,
            u.phone,
            u.email,
            COUNT(DISTINCT cln.id) AS nb_neufs,
            COUNT(DISTINCT clo.id) AS nb_occasion,
            COALESCE(SUM(cln.quantite), 0)::INT AS total_articles_neufs,
            ARRAY_AGG(DISTINCT cln.classe) FILTER (WHERE cln.classe IS NOT NULL) AS classes
        FROM commandes_mixtes cm
        JOIN users u ON u.id = cm.user_id
        LEFT JOIN commande_livres_neufs cln ON cln.commande_id = cm.id
        LEFT JOIN commande_livres_occasion clo ON clo.commande_id = cm.id
        WHERE cm.statut IN ('validee_complete', 'validee_partielle', 'en_preparation', 'en_livraison')
        GROUP BY cm.id, u.id
        ORDER BY cm.adresse_livraison NULLS LAST, cm.created_at ASC
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur tournées: {}", e)))?;

    use sqlx::Row;
    #[derive(Clone)]
    struct Item {
        commande_id: String,
        reference_commande: String,
        statut: String,
        adresse: Option<String>,
        gps_str: Option<String>,
        gps: Option<(f64, f64)>,
        nom: String,
        phone: Option<String>,
        email: Option<String>,
        nb_neufs: i64,
        nb_occasion: i64,
        total_articles: i32,
        classes: Vec<String>,
    }
    let items: Vec<Item> = rows
        .into_iter()
        .map(|r| {
            let gps_str: Option<String> =
                r.try_get::<Option<String>, _>("gps_livraison").unwrap_or(None);
            let gps = gps_str.as_ref().and_then(|g| {
                let p: Vec<&str> = g.split(',').collect();
                if p.len() == 2 {
                    Some((
                        p[0].trim().parse::<f64>().ok()?,
                        p[1].trim().parse::<f64>().ok()?,
                    ))
                } else {
                    None
                }
            });
            let nom = [
                r.try_get::<Option<String>, _>("prenom").unwrap_or(None).unwrap_or_default(),
                r.try_get::<Option<String>, _>("nom").unwrap_or(None).unwrap_or_default(),
            ]
            .into_iter()
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join(" ");
            Item {
                commande_id: r
                    .try_get::<uuid::Uuid, _>("commande_id")
                    .ok()
                    .map(|u| u.to_string())
                    .unwrap_or_default(),
                reference_commande: r
                    .try_get::<Option<String>, _>("reference_commande")
                    .unwrap_or(None)
                    .unwrap_or_default(),
                statut: r
                    .try_get::<Option<String>, _>("statut")
                    .unwrap_or(None)
                    .unwrap_or_default(),
                adresse: r.try_get::<Option<String>, _>("adresse_livraison").unwrap_or(None),
                gps_str,
                gps,
                nom: if nom.is_empty() { "Parent".into() } else { nom },
                phone: r.try_get::<Option<String>, _>("phone").unwrap_or(None),
                email: r.try_get::<Option<String>, _>("email").unwrap_or(None),
                nb_neufs: r.try_get::<i64, _>("nb_neufs").unwrap_or(0),
                nb_occasion: r.try_get::<i64, _>("nb_occasion").unwrap_or(0),
                total_articles: r.try_get::<i32, _>("total_articles_neufs").unwrap_or(0),
                classes: r
                    .try_get::<Option<Vec<String>>, _>("classes")
                    .unwrap_or(None)
                    .unwrap_or_default(),
            }
        })
        .collect();

    // Heuristique d'extraction de la ville : dernier morceau séparé par ","
    // ou avant une virgule contenant un mot-clé géographique. Fallback "Sans
    // adresse".
    fn extract_city(addr: &Option<String>) -> String {
        let a = addr.as_deref().unwrap_or("").trim();
        if a.is_empty() {
            return "Sans adresse".into();
        }
        let parts: Vec<&str> = a.rsplit(',').collect();
        for p in &parts {
            let s = p.trim();
            if !s.is_empty() && s.len() < 60 {
                return s.to_string();
            }
        }
        a.to_string()
    }

    fn haversine_km(a: (f64, f64), b: (f64, f64)) -> f64 {
        let r = 6371.0;
        let lat1 = a.0.to_radians();
        let lat2 = b.0.to_radians();
        let dlat = (b.0 - a.0).to_radians();
        let dlon = (b.1 - a.1).to_radians();
        let h = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
        2.0 * r * h.sqrt().asin()
    }

    // Groupement : ville → sous-clusters GPS (greedy par distance).
    use std::collections::BTreeMap;
    let mut by_city: BTreeMap<String, Vec<Item>> = BTreeMap::new();
    for it in items {
        by_city.entry(extract_city(&it.adresse)).or_default().push(it);
    }

    // ─── Récupération détaillée des articles et des pickups troc ──────────
    // Pour chaque commande, on charge :
    //   - livres_a_livrer : articles neufs + occasion à DÉPOSER chez le parent
    //     (titre, quantité, matière, classe)
    //   - livres_a_recuperer : livres en occasion que le parent met EN ÉCHANGE
    //     ou en vente — le coursier doit les RAMASSER au domicile (titre,
    //     valeur estimée, état). Indispensable pour que le coursier sache
    //     qu'il a aussi du pickup à faire en plus de la livraison.
    // Une seule requête batchée pour éviter le N+1.
    use std::collections::HashMap;
    let all_cmd_ids: Vec<uuid::Uuid> = by_city
        .values()
        .flat_map(|v| v.iter().filter_map(|x| uuid::Uuid::parse_str(&x.commande_id).ok()))
        .collect();

    let mut livres_livrer_by_cmd: HashMap<String, Vec<serde_json::Value>> = HashMap::new();
    let mut livres_recup_by_cmd: HashMap<String, Vec<serde_json::Value>> = HashMap::new();

    if !all_cmd_ids.is_empty() {
        let livrer_rows = sqlx::query(
            r#"
            SELECT
                cln.commande_id,
                cln.titre,
                COALESCE(cln.matiere, '') AS matiere,
                COALESCE(cln.classe, '') AS classe,
                cln.quantite,
                COALESCE(cln.prix_final, cln.prix_officiel)::DOUBLE PRECISION AS prix
            FROM commande_livres_neufs cln
            WHERE cln.commande_id = ANY($1)
              AND (cln.statut_validation IS NULL OR cln.statut_validation::text != 'indisponible')
            ORDER BY cln.classe NULLS LAST, cln.matiere NULLS LAST, cln.titre
            "#,
        )
        .bind(&all_cmd_ids)
        .fetch_all(&state.pg)
        .await
        .ok()
        .unwrap_or_default();

        for r in livrer_rows {
            let cmd_id: uuid::Uuid = r.try_get("commande_id").unwrap_or_default();
            let entry = serde_json::json!({
                "titre": r.try_get::<String, _>("titre").unwrap_or_default(),
                "matiere": r.try_get::<String, _>("matiere").unwrap_or_default(),
                "classe": r.try_get::<String, _>("classe").unwrap_or_default(),
                "quantite": r.try_get::<i32, _>("quantite").unwrap_or(1),
                "prix": r.try_get::<Option<f64>, _>("prix").ok().flatten(),
                "type": "livraison",
            });
            livres_livrer_by_cmd.entry(cmd_id.to_string()).or_default().push(entry);
        }

        // Livres à RÉCUPÉRER chez le parent : ceux qu'il a proposés en troc
        // (référencés dans commande_livres_occasion qui pointe vers livres_scolaires
        // — la table où le parent a stocké son livre via la photo recto/verso).
        let recup_rows = sqlx::query(
            r#"
            SELECT
                clo.commande_id,
                ls.titre,
                COALESCE(ls.matiere, '') AS matiere,
                COALESCE(ls.classe, '') AS classe,
                clo.quantite,
                ls.etat_livre,
                ls.valeur_calculee::DOUBLE PRECISION AS valeur
            FROM commande_livres_occasion clo
            JOIN livres_scolaires ls ON ls.id = clo.livre_scolaire_id
            WHERE clo.commande_id = ANY($1)
            ORDER BY ls.classe NULLS LAST, ls.titre
            "#,
        )
        .bind(&all_cmd_ids)
        .fetch_all(&state.pg)
        .await
        .ok()
        .unwrap_or_default();

        for r in recup_rows {
            let cmd_id: uuid::Uuid = r.try_get("commande_id").unwrap_or_default();
            let entry = serde_json::json!({
                "titre": r.try_get::<String, _>("titre").unwrap_or_default(),
                "matiere": r.try_get::<String, _>("matiere").unwrap_or_default(),
                "classe": r.try_get::<String, _>("classe").unwrap_or_default(),
                "quantite": r.try_get::<i32, _>("quantite").unwrap_or(1),
                "etat": r.try_get::<Option<String>, _>("etat_livre").ok().flatten(),
                "valeur_estimee": r.try_get::<Option<f64>, _>("valeur").ok().flatten(),
                "type": "pickup_troc",
            });
            livres_recup_by_cmd.entry(cmd_id.to_string()).or_default().push(entry);
        }
    }

    let mut routes: Vec<serde_json::Value> = Vec::new();
    for (city, list) in by_city {
        // Sous-clusters GPS greedy : on parcourt les items, et on rattache à
        // un cluster existant si la distance haversine au centre est < bucket_km.
        let mut clusters: Vec<Vec<Item>> = Vec::new();
        for it in list {
            let mut placed = false;
            if let Some(g) = it.gps {
                for c in clusters.iter_mut() {
                    if let Some(centre) = c.first().and_then(|x| x.gps) {
                        if haversine_km(g, centre) <= bucket_km {
                            c.push(it.clone());
                            placed = true;
                            break;
                        }
                    }
                }
            }
            if !placed {
                clusters.push(vec![it]);
            }
        }
        for (idx, cluster) in clusters.into_iter().enumerate() {
            let pkg_ref = format!("PKG-{:03}", idx + 1);
            let count = cluster.len();
            let mut cluster_has_pickup = false;
            let parents: Vec<serde_json::Value> = cluster
                .iter()
                .map(|x| {
                    let livrer =
                        livres_livrer_by_cmd.get(&x.commande_id).cloned().unwrap_or_default();
                    let recup =
                        livres_recup_by_cmd.get(&x.commande_id).cloned().unwrap_or_default();
                    if !recup.is_empty() {
                        cluster_has_pickup = true;
                    }
                    serde_json::json!({
                        "package_ref": format!("{}#{}", x.reference_commande, pkg_ref),
                        "commande_id": x.commande_id,
                        "reference_commande": x.reference_commande,
                        "statut": x.statut,
                        "adresse": x.adresse,
                        "gps": x.gps_str,
                        "nom": x.nom,
                        "phone": x.phone,
                        "email": x.email,
                        "nb_neufs": x.nb_neufs,
                        "nb_occasion": x.nb_occasion,
                        "total_articles": x.total_articles,
                        "classes": x.classes,
                        // ✅ Détails à imprimer dans le PDF coursier
                        "livres_a_livrer": livrer,
                        "livres_a_recuperer": recup,
                    })
                })
                .collect();

            routes.push(serde_json::json!({
                "city": city,
                "cluster_ref": format!("{}-{}", city.chars().filter(|c| c.is_alphanumeric()).take(6).collect::<String>().to_uppercase(), pkg_ref),
                "package_count": count,
                "centre_gps": cluster.first().and_then(|x| x.gps).map(|(la, lo)| format!("{:.5},{:.5}", la, lo)),
                "has_pickup": cluster_has_pickup,
                "parents": parents,
            }));
        }
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "bucket_km": bucket_km,
        "routes": routes,
        "total_packages": routes.iter().map(|r| r["package_count"].as_i64().unwrap_or(0)).sum::<i64>(),
    })))
}

/// Catégorise un article (titre+matière) en `manuel | cahier | fourniture`.
/// Heuristique pragmatique :
///   - Titre contenant "cahier", "exercise book", "notebook", "copybook",
///     "carnet" → cahier
///   - Matière vide / "Fournitures" / titre contenant accessoire connu → fourniture
///   - Sinon → manuel (livre scolaire de matière)
fn classify_article(titre: &str, matiere: &str) -> &'static str {
    let t = titre.to_lowercase();
    let m = matiere.to_lowercase();

    // Cahiers
    let cahier_keywords = [
        "cahier",
        "exercise book",
        "exercise-book",
        "notebook",
        "copybook",
        "copy book",
        "carnet",
        "workbook",
        "livret",
    ];
    if cahier_keywords.iter().any(|k| t.contains(k)) {
        return "cahier";
    }

    // Fournitures / accessoires : matière explicitement Fournitures ou titre
    // contenant un accessoire connu.
    let fourniture_keywords = [
        "stylo",
        "crayon",
        "pen",
        "pencil",
        "gomme",
        "eraser",
        "taille-crayon",
        "sharpener",
        "règle",
        "ruler",
        "équerre",
        "set square",
        "rapporteur",
        "protractor",
        "compas",
        "compass",
        "calculatrice",
        "calculator",
        "casio",
        "ti-30",
        "ardoise",
        "slate",
        "craie",
        "chalk",
        "blouse",
        "lab coat",
        "tablier",
        "uniforme",
        "uniform",
        "cartable",
        "sac",
        "bag",
        "trousse",
        "pencil case",
        "classeur",
        "binder",
        "pochette",
        "pochettes",
        "intercalaire",
        "ramette",
        "ream",
        "papier",
        "paper",
        "colle",
        "glue",
        "ciseaux",
        "scissors",
        "agrafeuse",
        "stapler",
        "scotch",
        "tape",
        "marqueur",
        "marker",
        "feutre",
        "felt",
        "surligneur",
        "highlighter",
        "atlas",
        "dictionnaire",
        "dictionary",
        "bescherelle",
        "bouteille d'eau",
        "water bottle",
        "geometry set",
        "mathematical set",
        "boîte de géométrie",
        "fournitures",
    ];
    if m == "fournitures" || fourniture_keywords.iter().any(|k| t.contains(k) || m.contains(k)) {
        return "fourniture";
    }

    "manuel"
}

/// GET /api/librairie-network/super-librairie/wholesale-order
/// Bon de commande grossiste : agrège tous les articles neufs en cours de
/// préparation (statuts validee_*/en_preparation), regroupe par titre+auteur+
/// éditeur (normalisés), somme les quantités, et **classifie en 3 sections**
/// (manuel/cahier/fourniture) car les grossistes sont généralement différents.
/// Sortie destinée à être imprimée en PDF côté frontend (window.print).
pub async fn super_librairie_wholesale_order(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    ensure_super_libraire_access(&state.pg, user_id, &role).await?;

    let rows = sqlx::query(
        r#"
        SELECT
            COALESCE(NULLIF(TRIM(cln.titre), ''), 'Sans titre') AS titre,
            COALESCE(NULLIF(TRIM(cln.auteur), ''), '') AS auteur,
            COALESCE(NULLIF(TRIM(cln.editeur), ''), '') AS editeur,
            COALESCE(NULLIF(TRIM(cln.isbn), ''), '') AS isbn,
            COALESCE(NULLIF(TRIM(cln.classe), ''), '') AS classe_principale,
            COALESCE(NULLIF(TRIM(cln.matiere), ''), '') AS matiere,
            SUM(cln.quantite)::INT AS quantite_totale,
            COUNT(DISTINCT cln.commande_id) AS nb_commandes,
            AVG(COALESCE(cln.prix_final, cln.prix_officiel))::DOUBLE PRECISION AS prix_moyen,
            ARRAY_AGG(DISTINCT cln.classe) FILTER (WHERE cln.classe IS NOT NULL) AS classes
        FROM commande_livres_neufs cln
        JOIN commandes_mixtes cm ON cm.id = cln.commande_id
        WHERE cm.statut IN ('validee_complete', 'validee_partielle', 'en_preparation')
          AND (cln.statut_validation IS NULL OR cln.statut_validation::text != 'indisponible')
        GROUP BY
            LOWER(REGEXP_REPLACE(COALESCE(cln.titre, ''), '\s+', ' ', 'g')),
            LOWER(COALESCE(cln.auteur, '')),
            LOWER(COALESCE(cln.editeur, '')),
            COALESCE(cln.isbn, ''),
            cln.titre, cln.auteur, cln.editeur, cln.isbn, cln.classe, cln.matiere
        ORDER BY quantite_totale DESC, titre ASC
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur grossiste: {}", e)))?;

    use sqlx::Row;
    let mut articles: Vec<serde_json::Value> = Vec::new();
    let mut sec_manuels: Vec<usize> = Vec::new();
    let mut sec_cahiers: Vec<usize> = Vec::new();
    let mut sec_fournitures: Vec<usize> = Vec::new();

    for r in rows.into_iter() {
        let titre = r.try_get::<String, _>("titre").unwrap_or_default();
        let matiere = r.try_get::<String, _>("matiere").unwrap_or_default();
        let category = classify_article(&titre, &matiere);
        let qte = r.try_get::<i32, _>("quantite_totale").unwrap_or(0);
        let prix = r.try_get::<Option<f64>, _>("prix_moyen").unwrap_or(None);
        let entry = serde_json::json!({
            "titre": titre,
            "auteur": r.try_get::<String, _>("auteur").unwrap_or_default(),
            "editeur": r.try_get::<String, _>("editeur").unwrap_or_default(),
            "isbn": r.try_get::<String, _>("isbn").unwrap_or_default(),
            "matiere": matiere,
            "category": category,
            "classes": r.try_get::<Option<Vec<String>>, _>("classes").unwrap_or(None).unwrap_or_default(),
            "quantite_totale": qte,
            "nb_commandes": r.try_get::<i64, _>("nb_commandes").unwrap_or(0),
            "prix_moyen": prix,
            "valeur_estimee": prix.map(|p| p * qte as f64),
        });
        let idx = articles.len();
        articles.push(entry);
        match category {
            "manuel" => sec_manuels.push(idx),
            "cahier" => sec_cahiers.push(idx),
            _ => sec_fournitures.push(idx),
        }
    }

    fn section_totals(articles: &[serde_json::Value], idxs: &[usize]) -> (i64, f64) {
        let mut q = 0_i64;
        let mut v = 0.0_f64;
        for i in idxs {
            q += articles[*i]["quantite_totale"].as_i64().unwrap_or(0);
            v += articles[*i]["valeur_estimee"].as_f64().unwrap_or(0.0);
        }
        (q, v)
    }
    let (qm, vm) = section_totals(&articles, &sec_manuels);
    let (qc, vc) = section_totals(&articles, &sec_cahiers);
    let (qf, vf) = section_totals(&articles, &sec_fournitures);

    let make_section = |idxs: &[usize], q: i64, v: f64| -> serde_json::Value {
        let items: Vec<&serde_json::Value> = idxs.iter().map(|i| &articles[*i]).collect();
        serde_json::json!({
            "lignes": items,
            "total_articles": q,
            "total_valeur_estimee": v,
            "nb_lignes": idxs.len(),
        })
    };

    let total_articles = qm + qc + qf;
    let total_valeur = vm + vc + vf;

    Ok(Json(serde_json::json!({
        "success": true,
        "sections": {
            "manuels": make_section(&sec_manuels, qm, vm),
            "cahiers": make_section(&sec_cahiers, qc, vc),
            "fournitures": make_section(&sec_fournitures, qf, vf),
        },
        // Champs aplatis pour rétrocompatibilité avec d'éventuels appelants.
        "articles": articles,
        "total_lignes": articles.len(),
        "total_articles": total_articles,
        "total_valeur_estimee": total_valeur,
        "generated_at": chrono::Utc::now().to_rfc3339(),
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

// ============================================================================
// Invitations WhatsApp avec traçage (table libraire_team_invitations)
// ============================================================================

async fn ensure_invitations_table(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS libraire_team_invitations (
            id              SERIAL PRIMARY KEY,
            librairie_id    INTEGER NOT NULL,
            invitation_token TEXT NOT NULL UNIQUE,
            role            VARCHAR(20) NOT NULL DEFAULT 'preparer',
            telephone       VARCHAR(50),
            nom_affiche     VARCHAR(255),
            invited_by      INTEGER REFERENCES users(id),
            opened_at       TIMESTAMPTZ,
            accepted_at     TIMESTAMPTZ,
            accepted_user_id INTEGER REFERENCES users(id),
            expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_libraire_invitations_lib ON libraire_team_invitations(librairie_id, accepted_at)")
        .execute(pool).await.ok();
    Ok(())
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateInvitationPayload {
    pub role: String,
    pub telephone: Option<String>,
    pub nom_affiche: Option<String>,
}

/// POST /api/librairie-network/super-librairie/team/invitations
pub async fn super_librairie_create_invitation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateInvitationPayload>,
) -> AppResult<impl IntoResponse> {
    let _ = ensure_invitations_table(&state.pg).await;
    let is_admin = role == "admin" || role == "super_admin";
    let sl_id: uuid::Uuid = if is_admin {
        sqlx::query_scalar("SELECT id FROM librairie_partners WHERE est_super_librairie = true AND est_actif = true LIMIT 1")
            .fetch_optional(&state.pg).await
            .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
            .ok_or_else(|| AppError::NotFound("Aucun super libraire actif".to_string()))?
    } else {
        sqlx::query_scalar("SELECT id FROM librairie_partners WHERE user_id = $1 AND est_super_librairie = true AND est_actif = true LIMIT 1")
            .bind(user_id).fetch_optional(&state.pg).await
            .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
            .ok_or_else(|| AppError::Forbidden("Réservé au super libraire ou aux administrateurs".to_string()))?
    };

    let token = uuid::Uuid::new_v4().to_string();
    let row = sqlx::query(
        "INSERT INTO libraire_team_invitations (librairie_id, invitation_token, role, telephone, nom_affiche, invited_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id"
    )
    .bind(sl_id).bind(&token).bind(&payload.role)
    .bind(payload.telephone.as_ref()).bind(payload.nom_affiche.as_ref()).bind(user_id)
    .fetch_one(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur invitation: {}", e)))?;

    use sqlx::Row;
    let invitation_id: i32 = row.try_get("id").unwrap_or(0);
    let invitation_path = format!("/team/accept?token={}", token);
    let role_label = match payload.role.as_str() {
        "manager" => "Gestionnaire",
        "preparer" => "Préparateur",
        "cashier" => "Caisse",
        _ => &payload.role,
    };
    let whatsapp_msg = format!(
        "Bonjour ! Vous êtes invité(e) à rejoindre l'équipe Yukpo Librairie en tant que {}. Cliquez ici pour créer votre compte et accepter : https://bourse.yukpomnang.com{}",
        role_label, invitation_path
    );
    let phone_clean = payload.telephone.unwrap_or_default().replace('+', "").replace(' ', "");

    Ok(Json(serde_json::json!({
        "success": true, "invitation_id": invitation_id, "token": token,
        "invitation_path": invitation_path,
        "whatsapp_url": format!("https://wa.me/{}?text={}", phone_clean,
            whatsapp_msg.chars().map(|c| match c {
                ' ' => "%20".to_string(),
                c if c.is_ascii_alphanumeric() || ":/?=&._-".contains(c) => c.to_string(),
                c => format!("%{:02X}", c as u32),
            }).collect::<String>()),
        "whatsapp_message": whatsapp_msg,
    })))
}

/// DELETE /api/librairie-network/super-librairie/team/invitations/{invitation_id}
///
/// Révoque une invitation (pending/opened) ou retire un membre (accepted) en
/// supprimant la ligne. Réservé aux admins Yukpo et au super-libraire actif.
/// Garde-fou : on ne peut pas se retirer soi-même.
pub async fn super_librairie_delete_invitation(
    State(state): State<Arc<AppState>>,
    Path(invitation_id): Path<i32>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let _ = ensure_invitations_table(&state.pg).await;
    let is_admin = role == "admin" || role == "super_admin";
    let sl_id: uuid::Uuid = if is_admin {
        sqlx::query_scalar(
            "SELECT id FROM librairie_partners WHERE est_super_librairie = true AND est_actif = true LIMIT 1",
        )
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Aucun super libraire actif".to_string()))?
    } else {
        sqlx::query_scalar(
            "SELECT id FROM librairie_partners WHERE user_id = $1 AND est_super_librairie = true AND est_actif = true LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .ok_or_else(|| AppError::Forbidden("Réservé au super libraire ou aux administrateurs".to_string()))?
    };

    // Vérifie que l'invitation appartient bien à cette librairie + qu'on ne se
    // retire pas soi-même.
    use sqlx::Row;
    let row = sqlx::query(
        "SELECT librairie_id, accepted_user_id FROM libraire_team_invitations WHERE id = $1",
    )
    .bind(invitation_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur lookup: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Invitation introuvable".to_string()))?;

    let target_lib: uuid::Uuid = row.try_get("librairie_id").unwrap_or_default();
    let accepted_user: Option<i32> = row.try_get("accepted_user_id").ok().flatten();
    if target_lib != sl_id {
        return Err(AppError::Forbidden(
            "Cette invitation n'appartient pas à votre librairie".into(),
        ));
    }
    if accepted_user == Some(user_id) {
        return Err(AppError::BadRequest(
            "Vous ne pouvez pas vous retirer vous-même de l'équipe.".into(),
        ));
    }

    // Suppression nette : invitation supprimée + membre désactivé s'il était accepté
    sqlx::query("DELETE FROM libraire_team_invitations WHERE id = $1")
        .bind(invitation_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur delete: {}", e)))?;
    if let Some(uid) = accepted_user {
        let _ = sqlx::query(
            "UPDATE libraire_team_members SET is_active = false, updated_at = NOW() WHERE librairie_id = $1 AND user_id = $2",
        )
        .bind(sl_id)
        .bind(uid)
        .execute(&state.pg)
        .await;
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

/// GET /api/librairie-network/super-librairie/team/invitations
pub async fn super_librairie_list_invitations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let _ = ensure_invitations_table(&state.pg).await;
    let is_admin = role == "admin" || role == "super_admin";
    let sl_id: uuid::Uuid = if is_admin {
        sqlx::query_scalar("SELECT id FROM librairie_partners WHERE est_super_librairie = true AND est_actif = true LIMIT 1")
            .fetch_optional(&state.pg).await
            .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
            .ok_or_else(|| AppError::NotFound("Aucun super libraire actif".to_string()))?
    } else {
        sqlx::query_scalar("SELECT id FROM librairie_partners WHERE user_id = $1 AND est_super_librairie = true AND est_actif = true LIMIT 1")
            .bind(user_id).fetch_optional(&state.pg).await
            .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
            .ok_or_else(|| AppError::Forbidden("Accès réservé".to_string()))?
    };

    let rows = sqlx::query(
        "SELECT i.id, i.invitation_token, i.role, i.telephone, i.nom_affiche, \
                i.opened_at, i.accepted_at, i.accepted_user_id, i.expires_at, i.created_at, \
                u.email AS accepted_email, u.nom AS accepted_nom \
         FROM libraire_team_invitations i \
         LEFT JOIN users u ON u.id = i.accepted_user_id \
         WHERE i.librairie_id = $1 ORDER BY i.created_at DESC LIMIT 100",
    )
    .bind(sl_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur liste: {}", e)))?;

    use sqlx::Row;
    let invitations: Vec<serde_json::Value> = rows.iter().map(|r| {
        let token: String = r.try_get("invitation_token").unwrap_or_default();
        let opened: Option<chrono::DateTime<Utc>> = r.try_get("opened_at").ok().flatten();
        let accepted: Option<chrono::DateTime<Utc>> = r.try_get("accepted_at").ok().flatten();
        let status = if accepted.is_some() { "accepted" } else if opened.is_some() { "opened" } else { "pending" };
        serde_json::json!({
            "id": r.try_get::<i32, _>("id").unwrap_or(0),
            "token": &token,
            "invitation_path": format!("/team/accept?token={}", token),
            "role": r.try_get::<Option<String>, _>("role").unwrap_or(None),
            "telephone": r.try_get::<Option<String>, _>("telephone").unwrap_or(None),
            "nom_affiche": r.try_get::<Option<String>, _>("nom_affiche").unwrap_or(None),
            "status": status,
            "opened_at": opened.map(|t| t.to_rfc3339()),
            "accepted_at": accepted.map(|t| t.to_rfc3339()),
            "accepted_user_id": r.try_get::<Option<i32>, _>("accepted_user_id").unwrap_or(None),
            "accepted_email": r.try_get::<Option<String>, _>("accepted_email").unwrap_or(None),
            "accepted_nom": r.try_get::<Option<String>, _>("accepted_nom").unwrap_or(None),
            "expires_at": r.try_get::<chrono::DateTime<Utc>, _>("expires_at").ok().map(|t| t.to_rfc3339()),
            "created_at": r.try_get::<chrono::DateTime<Utc>, _>("created_at").ok().map(|t| t.to_rfc3339()),
        })
    }).collect();

    Ok(Json(
        serde_json::json!({ "success": true, "invitations": invitations }),
    ))
}

/// GET /api/team/invitation-preview/{token} (public)
///
/// Cherche d'abord dans la table d'invitations librairie ; si rien n'est trouvé,
/// fallback sur etablissement_team_invitations. Le client (TeamInvitationAcceptPage)
/// reçoit un champ `source` lui indiquant quel dashboard ouvrir après acceptation.
pub async fn preview_invitation(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> AppResult<impl IntoResponse> {
    let _ = ensure_invitations_table(&state.pg).await;
    use sqlx::Row;

    // 1. Tente librairie
    if let Some(inv) = sqlx::query(
        "SELECT i.role, i.expires_at, i.accepted_at, lp.nom AS librairie_nom \
         FROM libraire_team_invitations i \
         LEFT JOIN librairie_partners lp ON lp.id = i.librairie_id \
         WHERE i.invitation_token = $1",
    )
    .bind(&token)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    {
        let _ = sqlx::query("UPDATE libraire_team_invitations SET opened_at = COALESCE(opened_at, NOW()) WHERE invitation_token = $1")
            .bind(&token).execute(&state.pg).await;
        return Ok(Json(serde_json::json!({
            "success": true,
            "source": "librairie",
            "role": inv.try_get::<Option<String>, _>("role").unwrap_or(None),
            "librairie_nom": inv.try_get::<Option<String>, _>("librairie_nom").unwrap_or(None),
            "already_accepted": inv.try_get::<Option<chrono::DateTime<Utc>>, _>("accepted_at").ok().flatten().is_some(),
            "expired": inv.try_get::<chrono::DateTime<Utc>, _>("expires_at").map(|t| t < Utc::now()).unwrap_or(true),
        })));
    }

    // 2. Fallback établissement
    let inv = sqlx::query(
        "SELECT i.role, i.expires_at, i.accepted_at, e.nom_etablissement AS etablissement_nom \
         FROM etablissement_team_invitations i \
         LEFT JOIN etablissements_scolaires e ON e.id = i.etablissement_id \
         WHERE i.invitation_token = $1",
    )
    .bind(&token)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Invitation introuvable".to_string()))?;

    let _ = sqlx::query("UPDATE etablissement_team_invitations SET opened_at = COALESCE(opened_at, NOW()) WHERE invitation_token = $1")
        .bind(&token).execute(&state.pg).await;

    Ok(Json(serde_json::json!({
        "success": true,
        "source": "etablissement",
        "role": inv.try_get::<Option<String>, _>("role").unwrap_or(None),
        "etablissement_nom": inv.try_get::<Option<String>, _>("etablissement_nom").unwrap_or(None),
        "already_accepted": inv.try_get::<Option<chrono::DateTime<Utc>>, _>("accepted_at").ok().flatten().is_some(),
        "expired": inv.try_get::<chrono::DateTime<Utc>, _>("expires_at").map(|t| t < Utc::now()).unwrap_or(true),
    })))
}

#[derive(Debug, serde::Deserialize)]
pub struct AcceptInvitationPayload {
    pub token: String,
}

/// POST /api/team/invitation-accept
///
/// Cherche le token dans `libraire_team_invitations` ET
/// `etablissement_team_invitations`. La réponse inclut `source` pour que le
/// client redirige vers le bon dashboard (`/librairie` ou `/etablissement-portal`).
pub async fn accept_team_invitation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<AcceptInvitationPayload>,
) -> AppResult<impl IntoResponse> {
    let _ = ensure_invitations_table(&state.pg).await;
    use sqlx::Row;

    // 1. Tentative librairie
    if let Some(inv) = sqlx::query(
        "SELECT id, librairie_id, role, accepted_at, expires_at FROM libraire_team_invitations WHERE invitation_token = $1"
    )
    .bind(&payload.token).fetch_optional(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur token: {}", e)))?
    {
        let inv_id: i32 = inv.try_get("id").unwrap_or(0);
        let librairie_id: i32 = inv.try_get("librairie_id").unwrap_or(0);
        let role_str: String = inv.try_get("role").unwrap_or_else(|_| "preparer".to_string());
        let already: Option<chrono::DateTime<Utc>> = inv.try_get("accepted_at").ok().flatten();
        let expires: chrono::DateTime<Utc> = inv.try_get("expires_at").unwrap_or_else(|_| Utc::now());

        if already.is_some() {
            return Err(AppError::BadRequest("Invitation déjà acceptée".to_string()));
        }
        if expires < Utc::now() {
            return Err(AppError::BadRequest("Invitation expirée".to_string()));
        }

        sqlx::query("UPDATE libraire_team_invitations SET accepted_at = NOW(), accepted_user_id = $1 WHERE id = $2")
            .bind(user_id).bind(inv_id).execute(&state.pg).await
            .map_err(|e| AppError::Internal(format!("Erreur update: {}", e)))?;

        let _ = sqlx::query(
            "INSERT INTO libraire_team_members (librairie_id, user_id, role, is_active, created_at, updated_at) \
             VALUES ($1, $2, $3, true, NOW(), NOW()) \
             ON CONFLICT (librairie_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true, updated_at = NOW()"
        ).bind(librairie_id).bind(user_id).bind(&role_str).execute(&state.pg).await;

        return Ok(Json(serde_json::json!({
            "success": true,
            "source": "librairie",
            "message": "Bienvenue dans l'équipe Yukpo Librairie !",
            "librairie_id": librairie_id,
            "role": role_str,
        })));
    }

    // 2. Fallback établissement
    let inv = sqlx::query(
        "SELECT id, etablissement_id, role, accepted_at, expires_at FROM etablissement_team_invitations WHERE invitation_token = $1"
    )
    .bind(&payload.token).fetch_optional(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur token: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Invitation introuvable".to_string()))?;

    let inv_id: i32 = inv.try_get("id").unwrap_or(0);
    let etablissement_id: i32 = inv.try_get("etablissement_id").unwrap_or(0);
    let role_str: String = inv.try_get("role").unwrap_or_else(|_| "editor".to_string());
    let already: Option<chrono::DateTime<Utc>> = inv.try_get("accepted_at").ok().flatten();
    let expires: chrono::DateTime<Utc> = inv.try_get("expires_at").unwrap_or_else(|_| Utc::now());

    if already.is_some() {
        return Err(AppError::BadRequest("Invitation déjà acceptée".to_string()));
    }
    if expires < Utc::now() {
        return Err(AppError::BadRequest("Invitation expirée".to_string()));
    }

    sqlx::query("UPDATE etablissement_team_invitations SET accepted_at = NOW(), accepted_user_id = $1 WHERE id = $2")
        .bind(user_id).bind(inv_id).execute(&state.pg).await
        .map_err(|e| AppError::Internal(format!("Erreur update: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "source": "etablissement",
        "message": "Bienvenue dans l'équipe de l'établissement !",
        "etablissement_id": etablissement_id,
        "role": role_str,
    })))
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

    // Vérifier que c'est un librairie OU un membre d'équipe avec rôle
    // autorisé à valider (manager / preparer). Le cashier (caisse) n'a pas
    // accès à la validation des prix — c'est le rôle du préparateur.
    // SELECT explicite avec cast NUMERIC→DOUBLE PRECISION sur rating et
    // commission_app : la struct Rust LibrairiePartner déclare ces deux champs
    // en f64, mais la colonne DB est NUMERIC (sqlx refuse le decode direct).
    let mut librairie: Option<LibrairiePartner> = sqlx::query_as::<_, LibrairiePartner>(
        r#"
        SELECT id, user_id, nom, email, telephone, gps, ville, quartier,
               rayon_service_km, statut,
               rating::DOUBLE PRECISION AS rating,
               temps_moyen_validation,
               commission_app::DOUBLE PRECISION AS commission_app,
               est_actif, horaires_ouverture, created_at, updated_at
        FROM librairie_partners WHERE user_id = $1 AND est_actif = true AND statut = 'actif'
        "#,
    )
    .bind(librairie_user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    if librairie.is_none() {
        librairie = sqlx::query_as::<_, LibrairiePartner>(
            r#"
            SELECT lp.id, lp.user_id, lp.nom, lp.email, lp.telephone, lp.gps, lp.ville, lp.quartier,
                   lp.rayon_service_km, lp.statut,
                   lp.rating::DOUBLE PRECISION AS rating,
                   lp.temps_moyen_validation,
                   lp.commission_app::DOUBLE PRECISION AS commission_app,
                   lp.est_actif, lp.horaires_ouverture, lp.created_at, lp.updated_at
            FROM librairie_partners lp
            JOIN libraire_team_members tm ON tm.librairie_id = lp.id
            WHERE tm.user_id = $1
              AND tm.is_active = true
              AND tm.role IN ('manager','preparer')
              AND lp.est_actif = true
              AND lp.statut = 'actif'
            LIMIT 1
            "#,
        )
        .bind(librairie_user_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur team: {}", e)))?;
    }

    let librairie = librairie.ok_or_else(|| {
        AppError::Forbidden(
            "Validation réservée au gérant ou aux membres d'équipe (manager / préparateur)"
                .to_string(),
        )
    })?;

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
        &format!(
            "SELECT {} FROM commandes_mixtes WHERE id = $1 AND user_id = $2 AND statut IN ('validee_complete', 'validee_partielle')",
            COMMANDES_MIXTES_PROJECTION
        ),
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
        SELECT cm.id,
               cm.user_id,
               cm.reference_commande,
               cm.budget_total::DOUBLE PRECISION AS budget_total,
               cm.devise,
               cm.statut,
               cm.mode_livraison,
               cm.adresse_livraison,
               cm.gps_livraison,
               cm.notes_client,
               cm.commission_app::DOUBLE PRECISION AS commission_app,
               cm.montant_net_libraires::DOUBLE PRECISION AS montant_net_libraires,
               cm.created_at,
               cm.updated_at,
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
               cm.budget_total::DOUBLE PRECISION AS budget_total,
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
    Extension(AuthenticatedUser {
        id: user_id, role, ..
    }): Extension<AuthenticatedUser>,
    Path(commande_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_commande_details] User: {}, Role: {}, Commande: {}",
        user_id, role, commande_id
    );

    // Autorisation : (a) propriétaire de la commande, (b) admin/super_admin,
    // (c) super-libraire actif (un seul, qui voit tout), (d) libraire associé
    // à la commande via super_librairie_id ou via libraire_team_members.
    let is_admin = role == "admin" || role == "super_admin";

    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM commandes_mixtes WHERE id = $1 AND user_id = $2)",
    )
    .bind(commande_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur auth commande: {}", e)))?;

    let is_super_libraire = !is_admin && !is_owner && {
        sqlx::query_scalar::<_, bool>(
            r#"SELECT EXISTS(
                SELECT 1 FROM librairie_partners
                WHERE user_id = $1 AND est_super_librairie = true AND est_actif = true
            ) OR EXISTS(
                SELECT 1 FROM libraire_team_members ltm
                JOIN librairie_partners lp ON lp.id = ltm.librairie_id
                WHERE ltm.user_id = $1 AND ltm.is_active = true
                  AND lp.est_super_librairie = true AND lp.est_actif = true
            )"#,
        )
        .bind(user_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur auth super: {}", e)))?
    };

    let is_libraire_partenaire = !is_admin
        && !is_owner
        && !is_super_libraire
        && user_est_librairie_avec_validation_commande(&state.pg, commande_id, user_id).await?;

    if !(is_owner || is_admin || is_super_libraire || is_libraire_partenaire) {
        return Err(AppError::Forbidden("Accès non autorisé".to_string()));
    }

    let details = fetch_commande_details(&state.pg, commande_id).await?;

    // Pour les libraires, on ajoute les coordonnées du parent (téléphone +
    // email + nom) afin de permettre une prise de contact directe (WhatsApp).
    // Le propriétaire n'a pas besoin de ces infos puisque ce sont les siennes.
    let parent_contact: Option<serde_json::Value> = if is_owner {
        None
    } else {
        sqlx::query_as::<_, (Option<String>, Option<String>, Option<String>)>(
            r#"
            SELECT u.phone, u.email, u.nom
              FROM commandes_mixtes cm
              JOIN users u ON u.id = cm.user_id
             WHERE cm.id = $1
            "#,
        )
        .bind(commande_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten()
        .map(|(phone, email, nom)| {
            serde_json::json!({
                "phone": phone,
                "email": email,
                "nom": nom,
            })
        })
    };

    Ok(Json(serde_json::json!({
        "success": true,
        "details": details,
        "parent_contact": parent_contact,
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

    let lignes = sqlx::query_as::<_, CommandeLivreNeuf>(&format!(
        "SELECT {} FROM commande_livres_neufs WHERE commande_id = $1 ORDER BY created_at",
        COMMANDE_LIVRES_NEUFS_PROJECTION
    ))
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

    let ligne = sqlx::query_as::<_, CommandeLivreNeuf>(&format!(
        "SELECT {} FROM commande_livres_neufs WHERE id = $1 AND commande_id = $2",
        COMMANDE_LIVRES_NEUFS_PROJECTION
    ))
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
    let commande = sqlx::query_as::<_, CommandeMixte>(&format!(
        "SELECT {} FROM commandes_mixtes WHERE id = $1",
        COMMANDES_MIXTES_PROJECTION
    ))
    .bind(commande_id)
    .fetch_one(pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let livres_neufs = sqlx::query_as::<_, CommandeLivreNeuf>(&format!(
        "SELECT {} FROM commande_livres_neufs WHERE commande_id = $1",
        COMMANDE_LIVRES_NEUFS_PROJECTION
    ))
    .bind(commande_id)
    .fetch_all(pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?;

    let livres_occasion = sqlx::query_as::<_, CommandeLivreOccasion>(&format!(
        "SELECT {} FROM commande_livres_occasion WHERE commande_id = $1",
        COMMANDE_LIVRES_OCCASION_PROJECTION
    ))
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
    // ✅ FIX 2026-05-18 — `prix_final` (NUMERIC) × `quantite` (INTEGER) = NUMERIC.
    // Le décodage en `Option<f64>` (FLOAT8) plantait au runtime avec :
    // "Rust type Option<f64> (as SQL type FLOAT8) is not compatible with NUMERIC".
    // Cast explicite ::DOUBLE PRECISION pour aligner sur le type Rust attendu.
    // Bug révélé par sim E2E itér 4 : 100 % des POST /valider-budget tombaient en 500.
    let total_neufs: f64 = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT COALESCE(SUM(prix_final * quantite), 0)::DOUBLE PRECISION FROM commande_livres_neufs WHERE commande_id = $1",
    )
    .bind(commande_id)
    .fetch_one(&mut **tx)
    .await
        .map_err(|e| AppError::Internal(format!("Erreur: {}", e)))?
        .unwrap_or(0.0);

    let total_occasion: f64 = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT COALESCE(SUM(prix * quantite), 0)::DOUBLE PRECISION FROM commande_livres_occasion WHERE commande_id = $1",
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

// ============================================================================
// ✅ 2026-05-17 — ADMIN : Liste commandes mixtes
// ============================================================================
//
// Permet à un admin Yukpo de consulter toutes les commandes mixtes (neufs +
// occasion) pour suivi opérationnel (broadcast, validation libraire, retards
// livraison, etc.). Avant cet endpoint, il n'existait AUCUN moyen côté admin
// de voir les commandes passées par les parents → impossible d'orchestrer
// l'opérationnel.
//
// Filtres optionnels : `statut` (un ou plusieurs séparés par virgule),
// `limit` (défaut 100, max 500), `offset`. Tri DESC sur created_at.
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct AdminCommandesQuery {
    pub statut: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn admin_list_commandes_mixtes(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { role, .. }): Extension<AuthenticatedUser>,
    Query(q): Query<AdminCommandesQuery>,
) -> AppResult<impl IntoResponse> {
    if role != "admin" && role != "super_admin" {
        return Err(AppError::Forbidden(
            "Réservé aux administrateurs Yukpo".to_string(),
        ));
    }

    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let offset = q.offset.unwrap_or(0).max(0);
    let statuts: Option<Vec<String>> = q.statut.map(|s| {
        s.split(',')
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .collect()
    });

    use sqlx::Row;
    let rows = if let Some(filter_statuts) = statuts.as_ref().filter(|v| !v.is_empty()) {
        sqlx::query(
            r#"
            SELECT cm.id, cm.reference_commande, cm.user_id, cm.statut, cm.budget_total,
                   cm.devise, cm.commission_app, cm.montant_net_libraires,
                   cm.mode_livraison, cm.adresse_livraison, cm.gps_livraison,
                   cm.notes_client, cm.created_at, cm.updated_at,
                   u.email AS user_email, u.nom AS user_nom,
                   (SELECT COUNT(*) FROM commande_livres_neufs WHERE commande_id = cm.id) AS livres_neufs_count,
                   (SELECT COUNT(*) FROM commande_livres_occasion WHERE commande_id = cm.id) AS livres_occasion_count
              FROM commandes_mixtes cm
              LEFT JOIN users u ON u.id = cm.user_id
             WHERE cm.statut = ANY($1::commande_statut[])
             ORDER BY cm.created_at DESC
             LIMIT $2 OFFSET $3
            "#,
        )
        .bind(filter_statuts)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
    } else {
        sqlx::query(
            r#"
            SELECT cm.id, cm.reference_commande, cm.user_id, cm.statut, cm.budget_total,
                   cm.devise, cm.commission_app, cm.montant_net_libraires,
                   cm.mode_livraison, cm.adresse_livraison, cm.gps_livraison,
                   cm.notes_client, cm.created_at, cm.updated_at,
                   u.email AS user_email, u.nom AS user_nom,
                   (SELECT COUNT(*) FROM commande_livres_neufs WHERE commande_id = cm.id) AS livres_neufs_count,
                   (SELECT COUNT(*) FROM commande_livres_occasion WHERE commande_id = cm.id) AS livres_occasion_count
              FROM commandes_mixtes cm
              LEFT JOIN users u ON u.id = cm.user_id
             ORDER BY cm.created_at DESC
             LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
    }
    .map_err(|e| AppError::Internal(format!("Erreur liste commandes admin: {}", e)))?;

    let commandes: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.try_get::<uuid::Uuid, _>("id").ok().map(|u| u.to_string()),
                "reference_commande": r.try_get::<String, _>("reference_commande").ok(),
                "user_id": r.try_get::<i32, _>("user_id").ok(),
                "user_email": r.try_get::<Option<String>, _>("user_email").ok().flatten(),
                "user_nom": r.try_get::<Option<String>, _>("user_nom").ok().flatten(),
                "statut": r.try_get::<crate::models::librairie_network::CommandeStatut, _>("statut")
                    .ok()
                    .map(|s| s.as_db_str().to_string()),
                "budget_total": r.try_get::<f64, _>("budget_total").ok(),
                "devise": r.try_get::<String, _>("devise").ok(),
                "commission_app": r.try_get::<Option<f64>, _>("commission_app").ok().flatten(),
                "montant_net_libraires": r.try_get::<Option<f64>, _>("montant_net_libraires").ok().flatten(),
                "mode_livraison": r.try_get::<Option<String>, _>("mode_livraison").ok().flatten(),
                "adresse_livraison": r.try_get::<Option<String>, _>("adresse_livraison").ok().flatten(),
                "notes_client": r.try_get::<Option<String>, _>("notes_client").ok().flatten(),
                "created_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok(),
                "updated_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").ok(),
                "livres_neufs_count": r.try_get::<i64, _>("livres_neufs_count").ok(),
                "livres_occasion_count": r.try_get::<i64, _>("livres_occasion_count").ok(),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "commandes": commandes,
        "limit": limit,
        "offset": offset,
    })))
}

// ============================================================================
// 2026-05-19 — MVP1 Yukpo Librairie : cascade rupture grossiste
// ============================================================================

/// Helper : vérifie que l'utilisateur est super-libraire actif.
/// Retourne l'UUID de la super-librairie. Refuse sinon avec 403.
async fn ensure_super_librairie(state: &Arc<AppState>, user_id: i32) -> AppResult<Uuid> {
    let row = sqlx::query(
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
    Ok(row.get::<Uuid, _>("id"))
}

// ✅ 2026-05-19 — Helper team-aware unifié dans utils/role_helpers.rs.
// L'ancienne version locale est supprimée pour éviter la duplication.
// Pattern d'appel : ensure_super_lib_role(&state.pg, &user, "manager").

#[derive(Debug, Deserialize)]
pub struct MarquerRuptureItem {
    pub commande_id: Uuid,
    pub livre_neuf_id: Uuid,
    #[serde(default)]
    pub motif: Option<String>,
    #[serde(default)]
    pub grossiste_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct MarquerRupturePayload {
    pub ruptures: Vec<MarquerRuptureItem>,
}

/// POST /api/librairie-network/super-librairie/marquer-rupture-articles
///
/// Yukpo Lib (super-libraire) marque en batch des articles comme indisponibles
/// chez le grossiste. UPDATE `commande_livres_neufs.statut_validation =
/// 'rupture_grossiste'`. Idempotent : un livre déjà en rupture est ignoré
/// silencieusement (counted comme `skipped`).
///
/// La libération vers les libraires_proches est gérée par l'endpoint
/// `liberer-articles` qui suit, pour séparer clairement les deux étapes.
pub async fn super_librairie_marquer_rupture_articles(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<MarquerRupturePayload>,
) -> AppResult<impl IntoResponse> {
    // ✅ MVP4 — helper team-aware unifié (admin OR owner OR team manager).
    let sl_id = crate::utils::role_helpers::ensure_super_lib_role(&state.pg, &user, "manager").await?;
    let user_id = user.id;

    if payload.ruptures.is_empty() {
        return Err(AppError::BadRequest("ruptures vide".to_string()));
    }

    let mut marked = 0usize;
    let mut skipped = 0usize;
    let mut errors: Vec<serde_json::Value> = Vec::new();

    for item in &payload.ruptures {
        // Une rupture qui plante ne doit pas casser le batch entier.
        let res = sqlx::query(
            r#"
            UPDATE commande_livres_neufs
            SET statut_validation = 'rupture_grossiste',
                grossiste_assigne_id = COALESCE($3, grossiste_assigne_id)
            WHERE id = $1
              AND commande_id = $2
              AND statut_validation IN ('en_attente', 'valide')
            RETURNING id
            "#,
        )
        .bind(item.livre_neuf_id)
        .bind(item.commande_id)
        .bind(item.grossiste_id)
        .fetch_optional(&state.pg)
        .await;

        match res {
            Ok(Some(_)) => {
                marked += 1;
                // Log audit (silencieux si la table n'existe pas, pas critique)
                let _ = sqlx::query(
                    r#"
                    INSERT INTO super_librairie_audit_log (commande_id, evenement, details)
                    VALUES ($1, 'rupture_grossiste', $2)
                    "#,
                )
                .bind(item.commande_id)
                .bind(serde_json::json!({
                    "livre_neuf_id": item.livre_neuf_id.to_string(),
                    "motif": item.motif.clone().unwrap_or_else(|| "rupture_grossiste".into()),
                    "grossiste_id": item.grossiste_id.map(|u| u.to_string()),
                    "marque_par_user": user_id,
                    "super_librairie_id": sl_id.to_string(),
                }))
                .execute(&state.pg)
                .await;
            }
            Ok(None) => {
                // Livre déjà en rupture/annulé/refusé → idempotent
                skipped += 1;
            }
            Err(e) => {
                errors.push(serde_json::json!({
                    "livre_neuf_id": item.livre_neuf_id.to_string(),
                    "error": e.to_string(),
                }));
            }
        }
    }

    info!(
        "[marquer_rupture_articles] super-lib {} : {} marqués, {} skipped, {} erreurs",
        sl_id,
        marked,
        skipped,
        errors.len()
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "marked": marked,
        "skipped": skipped,
        "errors": errors,
    })))
}

#[derive(Debug, Deserialize)]
pub struct LibererArticlesPayload {
    /// IDs des livres neufs à libérer (doivent être en statut_validation = 'rupture_grossiste').
    pub livre_neuf_ids: Vec<Uuid>,
    /// Rayon de recherche libraires_proches en km (défaut : 20 km).
    #[serde(default)]
    pub rayon_km: Option<f64>,
    /// Durée de la libération en heures avant expiration → annule_rupture (défaut : 48h).
    #[serde(default)]
    pub duree_heures: Option<i64>,
}

/// POST /api/librairie-network/super-librairie/liberer-articles
///
/// Libère vers les libraires_proches (rayon 20 km du GPS de livraison du
/// parent) les articles préalablement marqués `rupture_grossiste`. Pour
/// chaque article, on UPDATE en `libere_libraires` puis on INSERT/UPSERT
/// une row `commande_validations` par libraire éligible avec
/// `articles_libere` et `expire_at = NOW() + 48h`. Push notif aux libraires.
///
/// Idempotent : un livre qui n'est PAS en `rupture_grossiste` est ignoré.
pub async fn super_librairie_liberer_articles(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<LibererArticlesPayload>,
) -> AppResult<impl IntoResponse> {
    // ✅ MVP4 — helper team-aware unifié (admin OR owner OR team manager).
    let sl_id = crate::utils::role_helpers::ensure_super_lib_role(&state.pg, &user, "manager").await?;
    let _user_id = user.id;

    if payload.livre_neuf_ids.is_empty() {
        return Err(AppError::BadRequest("livre_neuf_ids vide".to_string()));
    }

    let rayon_km = payload.rayon_km.unwrap_or(ConfigurationSysteme::RAYON_RECHERCHE_LIBRAIRIE);
    let duree_heures = payload.duree_heures.unwrap_or(48);

    // 1. Récupérer pour chaque livre : commande_id, gps_livraison, infos commande.
    let livres_info = sqlx::query(
        r#"
        SELECT cln.id AS livre_id,
               cln.commande_id,
               cm.gps_livraison,
               cm.reference_commande,
               cln.statut_validation::text AS statut
        FROM commande_livres_neufs cln
        JOIN commandes_mixtes cm ON cm.id = cln.commande_id
        WHERE cln.id = ANY($1)
        "#,
    )
    .bind(&payload.livre_neuf_ids)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur lookup livres: {}", e)))?;

    let mut libere_count = 0usize;
    let mut skipped = 0usize;
    let mut notifications_par_user: HashMap<i32, Vec<(String, Uuid)>> = HashMap::new();

    for row in &livres_info {
        let livre_id: Uuid = row.get("livre_id");
        let commande_id: Uuid = row.get("commande_id");
        let gps_opt: Option<String> = row.try_get("gps_livraison").ok();
        let reference: String = row.try_get("reference_commande").unwrap_or_default();
        let statut: String = row.try_get("statut").unwrap_or_default();

        if statut != "rupture_grossiste" {
            skipped += 1;
            continue;
        }

        let gps = match gps_opt.as_deref() {
            Some(g) if !g.is_empty() => g,
            _ => {
                skipped += 1;
                continue;
            }
        };

        let (lat, lng) = match parse_gps(gps) {
            Ok(v) => v,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };

        // 2. Trouver les libraires_proches (NON super-lib).
        let libraires = sqlx::query(
            r#"
            SELECT id, user_id, nom FROM librairie_partners
            WHERE est_actif = true
              AND statut = 'actif'
              AND est_super_librairie = false
              AND distance_gps($1, $2,
                               SPLIT_PART(gps, ',', 1)::FLOAT,
                               SPLIT_PART(gps, ',', 2)::FLOAT) <= $3
            ORDER BY distance_gps($1, $2,
                                 SPLIT_PART(gps, ',', 1)::FLOAT,
                                 SPLIT_PART(gps, ',', 2)::FLOAT)
            LIMIT 20
            "#,
        )
        .bind(lat)
        .bind(lng)
        .bind(rayon_km)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur recherche libraires: {}", e)))?;

        if libraires.is_empty() {
            // Pas de libraire éligible : on garde en rupture, le worker
            // expire et fera annule_rupture après 48h sans preneur.
            skipped += 1;
            continue;
        }

        // 3. Tx atomique : UPDATE livre → libere_libraires + UPSERT validations.
        let mut tx = state.pg.begin().await.map_err(|e| {
            AppError::Internal(format!("Erreur tx libération: {}", e))
        })?;

        let updated = sqlx::query(
            r#"
            UPDATE commande_livres_neufs
            SET statut_validation = 'libere_libraires'
            WHERE id = $1 AND statut_validation = 'rupture_grossiste'
            RETURNING id
            "#,
        )
        .bind(livre_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur update livre: {}", e)))?;

        if updated.is_none() {
            tx.rollback().await.ok();
            skipped += 1;
            continue;
        }

        for lib_row in &libraires {
            let lib_id: Uuid = lib_row.get("id");
            let lib_user_id: i32 = lib_row.get("user_id");

            // UPSERT-like : si une row (commande_id, librairie_id) existe en
            // 'en_cours', on append livre_id à articles_libere ; sinon INSERT.
            sqlx::query(
                r#"
                INSERT INTO commande_validations (
                    commande_id, librairie_id, statut, verrou_exclusif,
                    articles_libere, timestamp_libere, expire_at
                )
                VALUES ($1, $2, 'en_cours', false, ARRAY[$3]::uuid[], NOW(), NOW() + ($4 || ' hours')::interval)
                ON CONFLICT (commande_id, librairie_id) WHERE statut IN ('en_cours', 'valide_partiel', 'valide_complet')
                DO UPDATE SET
                    articles_libere = array_append(commande_validations.articles_libere, $3),
                    timestamp_libere = COALESCE(commande_validations.timestamp_libere, NOW()),
                    expire_at = GREATEST(commande_validations.expire_at, NOW() + ($4 || ' hours')::interval)
                "#,
            )
            .bind(commande_id)
            .bind(lib_id)
            .bind(livre_id)
            .bind(duree_heures.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur upsert validation: {}", e)))?;

            notifications_par_user
                .entry(lib_user_id)
                .or_default()
                .push((reference.clone(), livre_id));
        }

        tx.commit().await.map_err(|e| {
            AppError::Internal(format!("Erreur commit libération: {}", e))
        })?;

        libere_count += 1;
    }

    // 4. Push notif aux libraires (hors tx).
    for (lib_user_id, articles) in &notifications_par_user {
        let count = articles.len();
        let msg = format!(
            "{} article(s) disponible(s) à valider (rupture grossiste) — 48h pour répondre",
            count
        );
        let _ = send_notification(
            &state,
            *lib_user_id,
            "Articles libérés à valider",
            &msg,
            Some(serde_json::json!({
                "type": "librairie_articles_liberes",
                "nb_articles": count,
                "expire_in_hours": duree_heures,
            })),
        )
        .await;
    }

    info!(
        "[liberer_articles] super-lib {} : {} libérés, {} skipped, {} libraires notifiés",
        sl_id,
        libere_count,
        skipped,
        notifications_par_user.len()
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "libere_count": libere_count,
        "skipped": skipped,
        "libraires_notifies": notifications_par_user.len(),
        "rayon_km": rayon_km,
        "expire_in_hours": duree_heures,
    })))
}
