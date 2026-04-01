//! Worker de timeout du super libraire (YukpoLibrairie).
//!
//! Ce worker tourne toutes les 60 secondes et surveille les commandes
//! dont le statut est `envoyee_super_librairie` et dont
//! `super_librairie_timeout_at < NOW()` sans fallback déjà déclenché.
//!
//! Lorsqu'une commande expire :
//!   1. Son statut passe à `envoyee_librairies`
//!   2. Le champ `super_librairie_fallback_at` est horodaté
//!   3. Les librairies proches du GPS de livraison sont notifiées (broadcast normal)
//!   4. Un log d'audit est inséré dans `super_librairie_audit_log`

use chrono::Utc;
use log::{error, info, warn};
use sqlx::{PgPool, Row};
use std::sync::Arc;

use crate::{state::AppState, utils::send_notification};

const POLL_INTERVAL_SECS: u64 = 60;
const FALLBACK_RAYON_KM: f64 = 20.0;

/// Démarre le worker dans une tokio task infinie.
pub fn start_super_librairie_timeout_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        info!("[SuperLibrairieWorker] Démarré — poll toutes les {}s", POLL_INTERVAL_SECS);
        loop {
            if let Err(e) = process_expired_super_librairie_commandes(&state).await {
                error!("[SuperLibrairieWorker] Erreur: {}", e);
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;
        }
    });
}

/// Traite les commandes dont le timeout super libraire est expiré.
async fn process_expired_super_librairie_commandes(
    state: &Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let pool = &state.pg;

    let expired_commandes = sqlx::query(
        r#"
        SELECT
            cm.id,
            cm.gps_livraison,
            cm.reference_commande,
            cm.super_librairie_id,
            COUNT(DISTINCT cln.id) AS nb_livres_neufs,
            COUNT(DISTINCT clo.id) AS nb_livres_occasion
        FROM commandes_mixtes cm
        LEFT JOIN commande_livres_neufs cln ON cm.id = cln.commande_id
        LEFT JOIN commande_livres_occasion clo ON cm.id = clo.commande_id
        WHERE cm.statut = 'envoyee_super_librairie'
          AND cm.super_librairie_timeout_at IS NOT NULL
          AND cm.super_librairie_timeout_at < NOW()
          AND cm.super_librairie_fallback_at IS NULL
        GROUP BY cm.id, cm.gps_livraison, cm.reference_commande, cm.super_librairie_id
        LIMIT 50
        "#,
    )
    .fetch_all(pool)
    .await?;

    if expired_commandes.is_empty() {
        return Ok(());
    }

    info!(
        "[SuperLibrairieWorker] {} commande(s) expirée(s) à libérer",
        expired_commandes.len()
    );

    for row in expired_commandes {
        let commande_id: uuid::Uuid = row.try_get("id")?;
        let gps_livraison: Option<String> = row.try_get("gps_livraison").ok().flatten();
        let reference: Option<String> = row.try_get("reference_commande").ok().flatten();
        let gps_livraison = gps_livraison.unwrap_or_default();
        let reference = reference.unwrap_or_default();

        if gps_livraison.is_empty() {
            warn!(
                "[SuperLibrairieWorker] Commande {} sans GPS livraison — impossible de faire le broadcast",
                commande_id
            );
            let _ = marquer_fallback_declenche(pool, commande_id).await;
            continue;
        }

        match declencher_fallback_broadcast(state, commande_id, &gps_livraison, &reference).await {
            Ok(nb_notifiees) => {
                info!(
                    "[SuperLibrairieWorker] ✅ Commande {} libérée → {} librairie(s) notifiée(s)",
                    commande_id, nb_notifiees
                );
            }
            Err(e) => {
                error!(
                    "[SuperLibrairieWorker] ❌ Commande {}: erreur fallback: {}",
                    commande_id, e
                );
            }
        }
    }

    Ok(())
}

/// Déclenche le broadcast vers les librairies proches après expiration du timeout.
async fn declencher_fallback_broadcast(
    state: &Arc<AppState>,
    commande_id: uuid::Uuid,
    gps_livraison: &str,
    reference_commande: &str,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    let pool = &state.pg;

    let parts: Vec<&str> = gps_livraison.split(',').collect();
    if parts.len() < 2 {
        return Err(format!("GPS invalide: {}", gps_livraison).into());
    }
    let lat: f64 = parts[0].trim().parse().map_err(|_| format!("Lat invalide: {}", parts[0]))?;
    let lng: f64 = parts[1].trim().parse().map_err(|_| format!("Lng invalide: {}", parts[1]))?;

    let mut tx = pool.begin().await?;

    // 1. Mettre à jour le statut de la commande
    sqlx::query(
        r#"
        UPDATE commandes_mixtes
        SET statut                      = 'envoyee_librairies',
            super_librairie_fallback_at = NOW(),
            updated_at                  = NOW()
        WHERE id = $1
        "#,
    )
    .bind(commande_id)
    .execute(&mut *tx)
    .await?;

    // 2. Log d'audit
    sqlx::query(
        r#"
        INSERT INTO super_librairie_audit_log (commande_id, evenement, details)
        VALUES ($1, 'timeout_fallback', $2)
        "#,
    )
    .bind(commande_id)
    .bind(serde_json::json!({
        "gps_livraison": gps_livraison,
        "rayon_fallback_km": FALLBACK_RAYON_KM,
        "fallback_at": Utc::now().to_rfc3339()
    }))
    .execute(&mut *tx)
    .await?;

    // 3. Trouver les librairies proches
    let librairies = sqlx::query(
        r#"
        SELECT id, user_id, nom
        FROM librairie_partners lp
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
    .bind(FALLBACK_RAYON_KM)
    .fetch_all(&mut *tx)
    .await?;

    let nb_librairies = librairies.len();
    let message = format!(
        "Commande {} disponible — le super libraire l'a libérée. Validez rapidement !",
        reference_commande
    );

    for lib in &librairies {
        let lib_id: i32 = lib.try_get("id").unwrap_or_default();
        let lib_user_id: i32 = lib.try_get("user_id").unwrap_or_default();

        sqlx::query(
            r#"
            INSERT INTO commande_validations (commande_id, librairie_id, statut, verrou_exclusif)
            VALUES ($1, $2, 'en_cours', false)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(commande_id)
        .bind(lib_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO notifications_librairie (
                librairie_id, commande_id, type_notification, message, statut
            )
            VALUES ($1, $2, 'nouvelle_commande', $3, 'envoyee')
            "#,
        )
        .bind(lib_id)
        .bind(commande_id)
        .bind(&message)
        .execute(&mut *tx)
        .await?;

        // Store user_id for push notifications after commit
        let _ = lib_user_id; // used below after tx
    }

    tx.commit().await?;

    // 5. Notifications push (hors transaction)
    for lib in &librairies {
        let lib_id: i32 = lib.try_get("id").unwrap_or_default();
        let lib_user_id: i32 = lib.try_get("user_id").unwrap_or_default();
        if let Err(e) = send_notification(
            state,
            lib_user_id,
            "Commande disponible",
            &message,
            Some(serde_json::json!({
                "type": "librairie_commande_mixte_fallback",
                "commande_id": commande_id.to_string(),
            })),
        )
        .await
        {
            warn!(
                "[SuperLibrairieWorker] Notification push {} échouée: {}",
                lib_id, e
            );
        }
    }

    Ok(nb_librairies)
}

/// Marque le fallback comme déclenché sans broadcast (cas GPS manquant).
async fn marquer_fallback_declenche(
    pool: &PgPool,
    commande_id: uuid::Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE commandes_mixtes
        SET super_librairie_fallback_at = NOW(),
            statut = 'envoyee_librairies',
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(commande_id)
    .execute(pool)
    .await?;
    Ok(())
}
