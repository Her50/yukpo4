//! 2026-05-19 — Worker commande_stale_watchdog.
//!
//! Filet de sécurité contre l'inaction de Yukpo Librairie. Cas concret :
//!   - Worker `yukpo_lib_auto_validator` valide la commande à T+5min
//!     (tous les livres en statut `valide`).
//!   - YL DOIT ensuite contacter le grossiste manuellement pour vérifier
//!     le stock (téléphone / WhatsApp — pas d'API B2B en MVP1).
//!   - Si YL oublie OU si le grossiste ne répond pas, la commande reste
//!     en `validee_complete` indéfiniment, et le paquet va être livré
//!     avec des livres que YL n'a pas en stock → drame opérationnel.
//!
//! Ce worker, en cron 6h, détecte les commandes "validees mais non traitées"
//! (pas de paquet `book_delivery_packages` constitué après 48h depuis la
//! validation) et envoie une notification push aux super-libraires actifs
//! pour les rappeler que des commandes attendent action.
//!
//! Désactivable via `YUKPO_LIB_STALE_ENABLED=false`.

use crate::services::push_notification_service::send_push_notification;
use crate::state::AppState;
use log::{error, info, warn};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use std::time::Duration;

/// Intervalle de poll (6 h). Override via `YUKPO_LIB_STALE_INTERVAL_S`.
const DEFAULT_INTERVAL_S: u64 = 21_600;
/// Seuil "commande stale" en heures. Override via `YUKPO_LIB_STALE_THRESHOLD_H`.
const DEFAULT_THRESHOLD_H: i64 = 48;
/// Nb max de commandes loggées par tick (pour le résumé notif).
const MAX_LIST_IN_NOTIF: usize = 10;

pub fn spawn_worker(state: Arc<AppState>) {
    let interval_s = std::env::var("YUKPO_LIB_STALE_INTERVAL_S")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(DEFAULT_INTERVAL_S);
    let threshold_h = std::env::var("YUKPO_LIB_STALE_THRESHOLD_H")
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(DEFAULT_THRESHOLD_H);
    let enabled = std::env::var("YUKPO_LIB_STALE_ENABLED")
        .map(|v| v != "false" && v != "0")
        .unwrap_or(true);
    if !enabled {
        info!("[commande-stale-watchdog] désactivé via YUKPO_LIB_STALE_ENABLED=false");
        return;
    }

    tokio::spawn(async move {
        info!(
            "[commande-stale-watchdog] démarrage (poll {}s, seuil {}h)",
            interval_s, threshold_h
        );
        // Laisse le temps au reste de booter
        tokio::time::sleep(Duration::from_secs(120)).await;

        let mut interval = tokio::time::interval(Duration::from_secs(interval_s));
        loop {
            interval.tick().await;
            match tick(&state, threshold_h).await {
                Ok(n) if n > 0 => info!("[commande-stale-watchdog] {} commande(s) stale détectée(s)", n),
                Ok(_) => {}
                Err(e) => warn!("[commande-stale-watchdog] tick error: {}", e),
            }
        }
    });
}

async fn tick(
    state: &Arc<AppState>,
    threshold_h: i64,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    // Critères "commande stale" :
    //   - statut `validee_complete` ou `validee_partielle`
    //   - mise à jour il y a plus de threshold_h heures
    //   - AUCUN book_delivery_package n'a été constitué pour le destinataire
    //     (sous-requête NOT EXISTS, scope strict au user_id de la commande).
    //
    // La sous-requête est volontairement large : si le parent a déjà un
    // paquet en cours pour une AUTRE commande, on ne pense pas "stale"
    // (cas rare en pratique — 1 commande active par parent à la rentrée).
    let rows = sqlx::query(&format!(
        r#"
        SELECT cm.id, cm.reference_commande, cm.user_id, cm.updated_at,
               (SELECT COUNT(*) FROM commande_livres_neufs WHERE commande_id = cm.id) AS nb_neufs
        FROM commandes_mixtes cm
        WHERE cm.statut IN ('validee_complete', 'validee_partielle')
          AND cm.updated_at < NOW() - INTERVAL '{} hours'
          AND NOT EXISTS (
              SELECT 1 FROM book_delivery_packages bdp
              WHERE bdp.destinataire_id = cm.user_id
                AND bdp.statut IN ('constitue', 'en_route', 'livre', 'confirme')
                AND bdp.created_at >= cm.updated_at
          )
        ORDER BY cm.updated_at ASC
        LIMIT 100
        "#,
        threshold_h
    ))
    .fetch_all(&state.pg)
    .await?;

    let stale_count = rows.len();
    if stale_count == 0 {
        return Ok(0);
    }

    // Construit un résumé human-friendly pour la notif YL.
    let mut refs: Vec<String> = Vec::with_capacity(MAX_LIST_IN_NOTIF);
    for row in rows.iter().take(MAX_LIST_IN_NOTIF) {
        let r: Option<String> = row.try_get("reference_commande").ok().flatten();
        if let Some(s) = r {
            refs.push(s);
        }
    }
    let body = if stale_count <= MAX_LIST_IN_NOTIF {
        format!(
            "{} commande(s) validée(s) sans paquet > {}h : {}",
            stale_count,
            threshold_h,
            refs.join(", ")
        )
    } else {
        format!(
            "{} commande(s) validée(s) sans paquet > {}h. Échantillon : {} … (+{} autres)",
            stale_count,
            threshold_h,
            refs.join(", "),
            stale_count - MAX_LIST_IN_NOTIF
        )
    };

    // Notifie TOUS les super-libraires actifs (l'équipe Yukpo Lib partage
    // un compte ou plusieurs membres — manager + preparer notifiés tous).
    let sl_user_rows = sqlx::query(
        r#"
        SELECT DISTINCT user_id FROM librairie_partners
        WHERE est_super_librairie = true AND est_actif = true
        "#,
    )
    .fetch_all(&state.pg)
    .await?;

    for sl_row in sl_user_rows {
        let sl_user_id: i32 = match sl_row.try_get("user_id") {
            Ok(id) => id,
            Err(_) => continue,
        };
        if let Err(e) = send_push_notification(
            &state.pg,
            sl_user_id,
            "Commandes en attente d'action".to_string(),
            body.clone(),
            Some(json!({
                "type": "yukpo_lib_stale_commandes",
                "count": stale_count,
                "threshold_hours": threshold_h,
                "references_sample": refs,
            })),
            None,
        )
        .await
        {
            error!(
                "[commande-stale-watchdog] notif super-lib {} échouée : {}",
                sl_user_id, e
            );
        }
    }

    Ok(stale_count)
}
