//! MVP1 (2026-05-19) — Worker auto-validation Yukpo Librairie.
//!
//! Contexte : depuis 2026-05-09 (commit 936698d950), TOUTES les commandes
//! mixtes broadcastées sont routées en priorité vers la super-librairie
//! (YukpoLibrairie). Sans intervention humaine, elles restent indéfiniment
//! en statut `envoyee_super_librairie` — bottleneck humain inacceptable.
//!
//! Ce worker valide automatiquement ces commandes côté Yukpo Lib, comme si
//! la super-librairie avait cliqué "Valider tout" sur chacune. Les prix
//! sont déjà figés (entrée / standard / premium) en dur côté code
//! `librairie_prix_bornes_service.rs` et `GammeSelector.tsx`, donc Yukpo
//! Lib s'aligne mécaniquement — aucune validation prix-par-prix à faire.
//!
//! Après cette validation auto :
//!   - les `commande_livres_neufs.statut_validation` passent à 'valide'
//!   - la `commande_validation` pour la super-librairie passe à 'valide_complet'
//!   - la `commandes_mixtes.statut` passe à 'validee_complete'
//!   - le workflow continue naturellement : `/packages/build-all` peut
//!     construire les paquets, le wholesale-order s'agrège, etc.
//!
//! Yukpo Librairie reste libre d'INTERVENIR plus tard pour annuler/libérer
//! des articles en cas de rupture grossiste — la validation auto fixe juste
//! l'état initial pour débloquer la chaîne.
//!
//! Lancement : `yukpo_lib_auto_validator::spawn_worker(state)` dans main.rs.

use crate::state::AppState;
use log::{error, info, warn};
use sqlx::Row;
use std::sync::Arc;
use std::time::Duration;

/// Intervalle de poll (5 min). Override via env `YUKPO_LIB_AUTO_VAL_INTERVAL_S`.
const DEFAULT_INTERVAL_S: u64 = 300;
/// Nombre max de commandes traitées par tick. Évite une rafale après downtime.
const MAX_PER_TICK: i64 = 200;
/// Délai minimal entre `envoyee_super_librairie` et auto-validation, pour
/// laisser le temps au broadcast de finir proprement ses INSERTs.
const MIN_AGE_S: i64 = 60;

pub fn spawn_worker(state: Arc<AppState>) {
    let interval_s = std::env::var("YUKPO_LIB_AUTO_VAL_INTERVAL_S")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(DEFAULT_INTERVAL_S);
    let enabled = std::env::var("YUKPO_LIB_AUTO_VAL_ENABLED")
        .map(|v| v != "false" && v != "0")
        .unwrap_or(true);
    if !enabled {
        info!("[yukpo-lib-auto-validator] désactivé via YUKPO_LIB_AUTO_VAL_ENABLED=false");
        return;
    }

    tokio::spawn(async move {
        info!(
            "[yukpo-lib-auto-validator] démarrage (poll {}s, max {} cmds/tick, min_age {}s)",
            interval_s, MAX_PER_TICK, MIN_AGE_S
        );
        // Laisse le temps au reste de booter (pool DB, etc.)
        tokio::time::sleep(Duration::from_secs(45)).await;

        let mut interval = tokio::time::interval(Duration::from_secs(interval_s));
        loop {
            interval.tick().await;
            match tick(&state).await {
                Ok(n) if n > 0 => info!("[yukpo-lib-auto-validator] {} commandes auto-validées", n),
                Ok(_) => {}, // silencieux quand rien à faire
                Err(e) => warn!("[yukpo-lib-auto-validator] tick error: {}", e),
            }
        }
    });
}

async fn tick(state: &Arc<AppState>) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    // 1. Trouver la super-librairie active. Si aucune, on ne fait rien (pas
    //    de YukpoLibrairie configurée — peut arriver en staging vierge).
    let super_lib_row = sqlx::query(
        "SELECT id FROM librairie_partners
         WHERE est_super_librairie = true AND est_actif = true
         LIMIT 1",
    )
    .fetch_optional(&state.pg)
    .await?;
    let super_lib_id: uuid::Uuid = match super_lib_row {
        Some(row) => row.try_get("id")?,
        None => {
            // Pas de super-librairie active : rien à faire.
            return Ok(0);
        }
    };

    // 2. Récupérer les commandes éligibles : statut envoyee_super_librairie
    //    + created_at suffisamment ancien pour ne pas concurrencer le broadcast.
    let cmds = sqlx::query(&format!(
        "SELECT id FROM commandes_mixtes
         WHERE statut = 'envoyee_super_librairie'
           AND created_at < NOW() - INTERVAL '{} seconds'
         ORDER BY created_at ASC
         LIMIT {}",
        MIN_AGE_S, MAX_PER_TICK
    ))
    .fetch_all(&state.pg)
    .await?;

    if cmds.is_empty() {
        return Ok(0);
    }

    let mut count_validated = 0usize;
    for cmd_row in cmds {
        let commande_id: uuid::Uuid = cmd_row.try_get("id")?;
        match valider_commande(state, commande_id, super_lib_id).await {
            Ok(()) => count_validated += 1,
            Err(e) => {
                // Une commande qui plante ne doit pas casser le tick entier.
                error!(
                    "[yukpo-lib-auto-validator] échec validation commande {} : {}",
                    commande_id, e
                );
            }
        }
    }

    Ok(count_validated)
}

/// Auto-valide une commande pour le compte de la super-librairie.
/// Idempotent : si déjà en `validee_complete` (ou autre statut terminal),
/// le SELECT initial ne la retournera pas → pas de double exécution.
async fn valider_commande(
    state: &Arc<AppState>,
    commande_id: uuid::Uuid,
    super_lib_id: uuid::Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = state.pg.begin().await?;

    // a. Vérifier que la commande est toujours en envoyee_super_librairie
    //    (FOR UPDATE pour bloquer une éventuelle action manuelle concurrente)
    let still_eligible = sqlx::query(
        "SELECT 1 FROM commandes_mixtes
         WHERE id = $1 AND statut = 'envoyee_super_librairie'
         FOR UPDATE",
    )
    .bind(commande_id)
    .fetch_optional(&mut *tx)
    .await?;
    if still_eligible.is_none() {
        // Plus éligible (intervention manuelle ou déjà traité par un tick concurrent)
        tx.rollback().await?;
        return Ok(());
    }

    // b. Récupérer les IDs des livres_neufs de la commande
    let livre_rows = sqlx::query(
        "SELECT id FROM commande_livres_neufs
         WHERE commande_id = $1
           AND statut_validation = 'en_attente'",
    )
    .bind(commande_id)
    .fetch_all(&mut *tx)
    .await?;
    let livre_ids: Vec<uuid::Uuid> = livre_rows
        .iter()
        .map(|r| r.try_get::<uuid::Uuid, _>("id"))
        .collect::<Result<_, _>>()?;

    // c. UPDATE commande_livres_neufs.statut_validation = 'valide'
    if !livre_ids.is_empty() {
        sqlx::query(
            "UPDATE commande_livres_neufs
             SET statut_validation = 'valide',
                 librairie_validateur_id = $1
             WHERE id = ANY($2)",
        )
        .bind(super_lib_id)
        .bind(&livre_ids)
        .execute(&mut *tx)
        .await?;
    }

    // d. UPDATE commande_validations pour la super-librairie : marquer comme
    //    valide_complet. La row a été créée par broadcast_vers_super_librairie.
    //    `livres_valides` est jsonb (cf. fix N : 2026-05-19 — commit 839183b7a).
    let livres_valides_json = serde_json::json!(
        livre_ids.iter().map(|u| u.to_string()).collect::<Vec<_>>()
    );
    sqlx::query(
        "UPDATE commande_validations
         SET statut = 'valide_complet',
             livres_valides = $1,
             verrou_exclusif = true,
             timestamp_fin = NOW(),
             notes_validation = 'auto-validation Yukpo Librairie'
         WHERE commande_id = $2 AND librairie_id = $3",
    )
    .bind(livres_valides_json)
    .bind(commande_id)
    .bind(super_lib_id)
    .execute(&mut *tx)
    .await?;

    // e. UPDATE commandes_mixtes.statut = 'validee_complete'. Note : si tous
    //    les livres_neufs sont en `valide`, le statut commande passe à
    //    validee_complete ; sinon validee_partielle. Comme ici on valide
    //    TOUS les livres en `en_attente`, on bascule directement en complete
    //    (sauf si certains étaient déjà annulés/refusés, auquel cas
    //    validee_partielle est plus juste — on délègue cette logique au
    //    backend de finalisation plus tard).
    sqlx::query(
        "UPDATE commandes_mixtes
         SET statut = 'validee_complete',
             updated_at = NOW()
         WHERE id = $1",
    )
    .bind(commande_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}
