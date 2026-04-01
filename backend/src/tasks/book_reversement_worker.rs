//! Worker de reversement automatique des vendeurs de la bourse du livre.
//!
//! Ce worker tourne toutes les `BOOK_REVERSEMENT_INTERVAL_SECS` secondes (défaut: 3600 = 1h).
//! Il sélectionne les commissions dont le reversement est `en_attente` ET dont la livraison
//! est confirmée (`book_delivery_packages.statut = 'confirme'`), puis déclenche le reversement
//! via un crédit wallet ou un enregistrement de paiement.
//!
//! Flux :
//!   book_exchange_commissions (reversement_statut = 'en_attente')
//!     → paquet correspondant confirmé ?
//!       → oui : créditer wallet vendeur + marquer reversement_statut = 'effectue'
//!       → non : laisser en_attente (la livraison n'est pas encore terminée)

use chrono::Utc;
use log::{error, info, warn};
use sqlx::{PgPool, Row};
use std::sync::Arc;

/// Configuration du worker.
#[derive(Debug, Clone)]
pub struct BookReversementWorkerConfig {
    /// Intervalle entre deux exécutions en secondes (défaut: 3600 = 1h).
    pub interval_seconds: u64,
    /// Nombre max de reversements traités par exécution.
    pub batch_size: i64,
}

impl Default for BookReversementWorkerConfig {
    fn default() -> Self {
        let interval_seconds: u64 = std::env::var("BOOK_REVERSEMENT_INTERVAL_SECS")
            .unwrap_or_else(|_| "3600".to_string())
            .parse()
            .unwrap_or(3600);
        let batch_size: i64 = std::env::var("BOOK_REVERSEMENT_BATCH_SIZE")
            .unwrap_or_else(|_| "100".to_string())
            .parse()
            .unwrap_or(100);
        Self { interval_seconds, batch_size }
    }
}

/// Lance le worker en boucle infinie (tokio task).
pub async fn run_book_reversement_worker(pool: Arc<PgPool>, config: BookReversementWorkerConfig) {
    info!(
        "[BookReversement] Worker démarré — intervalle {}s, batch {}",
        config.interval_seconds, config.batch_size
    );

    loop {
        if let Err(e) = process_pending_reversements(&pool, config.batch_size).await {
            error!("[BookReversement] Erreur traitement: {}", e);
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(config.interval_seconds)).await;
    }
}

/// Traite un batch de commissions en attente de reversement.
async fn process_pending_reversements(pool: &PgPool, batch_size: i64) -> Result<(), sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            bec.id                              AS commission_id,
            bec.vendeur_id,
            bec.montant_reversement_vendeur,
            bec.devise,
            bec.package_id,
            bec.livre_id
        FROM book_exchange_commissions bec
        LEFT JOIN book_delivery_packages bdp ON bdp.id = bec.package_id
        WHERE bec.reversement_statut = 'en_attente'
          AND bec.montant_reversement_vendeur > 0
          AND (
              bdp.statut = 'confirme'
              OR bec.package_id IS NULL
          )
        ORDER BY bec.created_at ASC
        LIMIT $1
        "#,
    )
    .bind(batch_size)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    info!("[BookReversement] {} reversements à traiter", rows.len());

    let mut ok_count = 0usize;
    let mut err_count = 0usize;

    for row in rows {
        let commission_id: i32 = row.try_get("commission_id").unwrap_or_default();
        let vendeur_id: Option<i32> = row.try_get("vendeur_id").ok().flatten();
        let montant: Option<rust_decimal::Decimal> = row.try_get("montant_reversement_vendeur").ok().flatten();

        let vendeur_id = match vendeur_id {
            Some(v) => v,
            None => {
                warn!("[BookReversement] Commission {} sans vendeur_id, ignorée", commission_id);
                continue;
            }
        };
        let montant = match montant {
            Some(m) => m,
            None => continue,
        };

        match credit_vendeur_wallet(pool, commission_id, vendeur_id, montant).await {
            Ok(_) => {
                ok_count += 1;
                info!(
                    "[BookReversement] ✅ Commission {} reversée au vendeur {} : {} XAF",
                    commission_id, vendeur_id, montant
                );
            }
            Err(e) => {
                err_count += 1;
                error!(
                    "[BookReversement] ❌ Erreur reversement commission {}: {}",
                    commission_id, e
                );
            }
        }
    }

    info!(
        "[BookReversement] Batch terminé — {} OK, {} erreurs",
        ok_count, err_count
    );
    Ok(())
}

/// Crédite le wallet du vendeur et marque la commission comme reversée.
/// Opération atomique via transaction PostgreSQL.
async fn credit_vendeur_wallet(
    pool: &PgPool,
    commission_id: i32,
    vendeur_id: i32,
    montant: rust_decimal::Decimal,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        UPDATE users
        SET wallet_balance = COALESCE(wallet_balance, 0) + $1
        WHERE id = $2
        "#,
    )
    .bind(montant)
    .bind(vendeur_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE book_exchange_commissions
        SET reversement_statut = 'effectue',
            reversement_date   = $1
        WHERE id = $2
          AND reversement_statut = 'en_attente'
        "#,
    )
    .bind(Utc::now())
    .bind(commission_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}
