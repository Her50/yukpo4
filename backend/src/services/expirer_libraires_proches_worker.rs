//! MVP1 (2026-05-19) — Worker expirer-libraires-proches.
//!
//! Quand Yukpo Lib libère un article via `POST /super-librairie/liberer-articles`,
//! une row `commande_validations` est créée pour chaque libraire proche avec
//! `expire_at = NOW() + 48h` et `articles_libere = [livre_neuf_id, ...]`.
//!
//! Si aucun libraire ne valide ces articles dans le délai, ce worker :
//!   - bascule `commande_livres_neufs.statut_validation` de `libere_libraires`
//!     vers `annule_rupture`
//!   - marque la `commande_validations` en `expired` (libère le slot)
//!   - notifie le parent (l'article est définitivement annulé)
//!
//! Note : si UN libraire a déjà validé l'article entre-temps, son statut
//! actuel est `valide` (pas `libere_libraires`) — le UPDATE WHERE clause
//! protège contre la régression de statut. Idempotent par construction.
//!
//! Lancement : `expirer_libraires_proches_worker::spawn_worker(state)`
//! dans main.rs.

use crate::services::push_notification_service::send_push_notification;
use crate::state::AppState;
use log::{error, info, warn};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use std::time::Duration;

/// Intervalle de poll (1 h). Override via `YUKPO_LIB_EXPIRE_INTERVAL_S`.
const DEFAULT_INTERVAL_S: u64 = 3600;
/// Nombre max de validations expirées traitées par tick.
const MAX_PER_TICK: i64 = 500;

pub fn spawn_worker(state: Arc<AppState>) {
    let interval_s = std::env::var("YUKPO_LIB_EXPIRE_INTERVAL_S")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(DEFAULT_INTERVAL_S);
    let enabled = std::env::var("YUKPO_LIB_EXPIRE_ENABLED")
        .map(|v| v != "false" && v != "0")
        .unwrap_or(true);
    if !enabled {
        info!("[expirer-libraires-proches] désactivé via YUKPO_LIB_EXPIRE_ENABLED=false");
        return;
    }

    tokio::spawn(async move {
        info!(
            "[expirer-libraires-proches] démarrage (poll {}s, max {}/tick)",
            interval_s, MAX_PER_TICK
        );
        // Laisse le temps au reste de booter
        tokio::time::sleep(Duration::from_secs(90)).await;

        let mut interval = tokio::time::interval(Duration::from_secs(interval_s));
        loop {
            interval.tick().await;
            match tick(&state).await {
                Ok(n) if n > 0 => info!(
                    "[expirer-libraires-proches] {} validations expirées traitées",
                    n
                ),
                Ok(_) => {}
                Err(e) => warn!("[expirer-libraires-proches] tick error: {}", e),
            }
        }
    });
}

async fn tick(state: &Arc<AppState>) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    // 1. SELECT les validations expirées avec articles libérés.
    let validations = sqlx::query(&format!(
        r#"
        SELECT id, commande_id, librairie_id, articles_libere
        FROM commande_validations
        WHERE expire_at IS NOT NULL
          AND expire_at < NOW()
          AND statut = 'en_cours'
          AND COALESCE(cardinality(articles_libere), 0) > 0
        ORDER BY expire_at ASC
        LIMIT {}
        "#,
        MAX_PER_TICK
    ))
    .fetch_all(&state.pg)
    .await?;

    if validations.is_empty() {
        return Ok(0);
    }

    let mut processed = 0usize;
    for v_row in validations {
        let validation_id: uuid::Uuid = v_row.try_get("id")?;
        let commande_id: uuid::Uuid = v_row.try_get("commande_id")?;
        let articles: Vec<uuid::Uuid> = v_row.try_get("articles_libere")?;

        match expire_one(state, validation_id, commande_id, &articles).await {
            Ok(()) => processed += 1,
            Err(e) => error!(
                "[expirer-libraires-proches] échec validation {} : {}",
                validation_id, e
            ),
        }
    }

    Ok(processed)
}

async fn expire_one(
    state: &Arc<AppState>,
    validation_id: uuid::Uuid,
    commande_id: uuid::Uuid,
    articles: &[uuid::Uuid],
) -> Result<(), sqlx::Error> {
    let mut tx = state.pg.begin().await?;

    // a. Bascule les livres TOUJOURS en libere_libraires vers annule_rupture.
    //    Si un libraire a déjà validé entre-temps → statut = 'valide',
    //    le UPDATE laisse intact (WHERE statut_validation = 'libere_libraires').
    let annules_rows = sqlx::query(
        r#"
        UPDATE commande_livres_neufs
        SET statut_validation = 'annule_rupture'
        WHERE id = ANY($1) AND statut_validation = 'libere_libraires'
        RETURNING id
        "#,
    )
    .bind(articles)
    .fetch_all(&mut *tx)
    .await?;

    let nb_annules = annules_rows.len();

    // b. Marque la validation comme expirée (libère la place pour ré-libérer
    //    si besoin). On utilise un statut neutre côté DB — 'rejetee' existe
    //    déjà dans validation_statut et signifie "ce libraire ne validera pas".
    sqlx::query(
        r#"
        UPDATE commande_validations
        SET statut = 'rejetee',
            timestamp_fin = NOW(),
            notes_validation = COALESCE(notes_validation, '') ||
                ' [auto-expirée par worker — 48h sans validation libraires_proches]'
        WHERE id = $1
        "#,
    )
    .bind(validation_id)
    .execute(&mut *tx)
    .await?;

    // c. Audit log (silencieux si erreur — non bloquant).
    let _ = sqlx::query(
        r#"
        INSERT INTO super_librairie_audit_log (commande_id, evenement, details)
        VALUES ($1, 'libraires_proches_expire', $2)
        "#,
    )
    .bind(commande_id)
    .bind(json!({
        "validation_id": validation_id.to_string(),
        "articles_annules_count": nb_annules,
        "articles": articles.iter().map(|u| u.to_string()).collect::<Vec<_>>(),
    }))
    .execute(&mut *tx)
    .await;

    tx.commit().await?;

    // d. Notif parent : seulement si on a effectivement annulé des articles.
    if nb_annules > 0 {
        if let Ok(Some(user_row)) = sqlx::query(
            "SELECT user_id, reference_commande FROM commandes_mixtes WHERE id = $1",
        )
        .bind(commande_id)
        .fetch_optional(&state.pg)
        .await
        {
            let parent_user_id: i32 = user_row.try_get("user_id").unwrap_or(0);
            let reference: String = user_row
                .try_get::<Option<String>, _>("reference_commande")
                .unwrap_or_default()
                .unwrap_or_default();
            if parent_user_id > 0 {
                let msg = format!(
                    "Commande {} : {} article(s) annulé(s) (rupture grossiste, pas de libraire preneur sous 48h).",
                    reference, nb_annules
                );
                let _ = send_push_notification(
                    &state.pg,
                    parent_user_id,
                    "Articles annulés (rupture)".to_string(),
                    msg,
                    Some(json!({
                        "type": "commande_articles_annules",
                        "commande_id": commande_id.to_string(),
                        "nb_articles": nb_annules,
                    })),
                    None,
                )
                .await;
            }
        }
    }

    Ok(())
}
