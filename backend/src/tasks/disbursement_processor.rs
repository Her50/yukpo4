//! Worker de traitement automatique des demandes de retrait partenaires.
//!
//! Tourne toutes les heures. Récupère les `disbursement_requests` en statut `pending`,
//! appelle l'agrégateur de paiement (AfricaPay → CinetPay → NotchPay) pour virer
//! l'argent sur le compte Mobile Money / bancaire du partenaire.
//!
//! Flux :
//!   disbursement_requests (status = 'pending')
//!     → aggregator.initiate_disbursement(phone, amount, method, reference)
//!       → succès : status = 'completed', processor_ref = txn_id
//!       → échec   : status = 'failed',   failure_reason = message
//!                   (le wallet n'est PAS re-crédité — admin doit traiter manuellement)

use log::{error, info, warn};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::time::{interval, Duration as TokioDuration};

use crate::services::payment_aggregator::PaymentAggregator;
use crate::state::AppState;

const INTERVAL_SECS: u64 = 3600; // 1 heure
const BATCH_SIZE: i64 = 30;
const MAX_RETRIES: i32 = 3; // après 3 échecs → statut 'failed'

pub async fn start_disbursement_processor(state: Arc<AppState>) {
    info!(
        "[DisbursementProcessor] Démarré — intervalle {}s, batch {}",
        INTERVAL_SECS, BATCH_SIZE
    );

    let mut timer = interval(TokioDuration::from_secs(INTERVAL_SECS));

    loop {
        timer.tick().await;

        if let Err(e) = process_pending_disbursements(&state.pg).await {
            error!("[DisbursementProcessor] Erreur cycle: {}", e);
        }
    }
}

async fn process_pending_disbursements(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Récupérer les demandes pending avec moins de MAX_RETRIES tentatives
    let rows = sqlx::query(
        r#"
        SELECT id, recipient_user_id, amount_cents, currency,
               recipient_phone, recipient_method, reason,
               COALESCE((metadata->>'retry_count')::int, 0) AS retry_count
        FROM disbursement_requests
        WHERE status = 'pending'
          AND COALESCE((metadata->>'retry_count')::int, 0) < $1
        ORDER BY created_at ASC
        LIMIT $2
        "#,
    )
    .bind(MAX_RETRIES)
    .bind(BATCH_SIZE)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    info!("[DisbursementProcessor] {} demandes à traiter", rows.len());

    let aggregator = PaymentAggregator::new();
    let mut ok = 0usize;
    let mut err = 0usize;

    for row in rows {
        let id: i32 = row.try_get("id").unwrap_or(0);
        let amount_cents: i64 = row.try_get("amount_cents").unwrap_or(0);
        let phone: Option<String> = row.try_get("recipient_phone").ok().flatten();
        let method: String =
            row.try_get("recipient_method").unwrap_or_else(|_| "mobile_money".to_string());
        let retry_count: i32 = row.try_get("retry_count").unwrap_or(0);

        // Sans numéro de téléphone → passer directement en failed (compte bancaire non dispo encore)
        let phone = match phone {
            Some(p) if !p.trim().is_empty() => p,
            _ => {
                warn!(
                    "[DisbursementProcessor] Demande #{} sans téléphone — passage en failed",
                    id
                );
                mark_failed(pool, id, "Numéro de téléphone manquant", retry_count).await;
                err += 1;
                continue;
            }
        };

        let reference = format!("YKP-DISB-{}-{}", id, chrono::Utc::now().timestamp());

        // Marquer en processing (idempotence)
        let _ = sqlx::query(
            "UPDATE disbursement_requests SET status = 'processing', updated_at = NOW() WHERE id = $1 AND status = 'pending'",
        )
        .bind(id)
        .execute(pool)
        .await;

        match aggregator
            .initiate_disbursement(&phone, amount_cents, &method, &reference)
            .await
        {
            Ok(processor_ref) => {
                sqlx::query(
                    r#"UPDATE disbursement_requests
                       SET status = 'completed', processor_ref = $1,
                           processed_at = NOW(), updated_at = NOW()
                       WHERE id = $2"#,
                )
                .bind(&processor_ref)
                .bind(id)
                .execute(pool)
                .await
                .ok();

                info!(
                    "[DisbursementProcessor] ✅ #{} → {}F vers {} (ref: {})",
                    id,
                    amount_cents / 100,
                    phone,
                    processor_ref
                );
                ok += 1;
            }
            Err(e) => {
                error!(
                    "[DisbursementProcessor] ❌ #{} échec (tentative {}/{}): {}",
                    id,
                    retry_count + 1,
                    MAX_RETRIES,
                    e
                );
                mark_failed(pool, id, &e, retry_count + 1).await;
                err += 1;
            }
        }
    }

    info!(
        "[DisbursementProcessor] Cycle terminé — {} OK, {} erreurs",
        ok, err
    );
    Ok(())
}

async fn mark_failed(pool: &PgPool, id: i32, reason: &str, retry_count: i32) {
    let new_status = if retry_count >= MAX_RETRIES {
        "failed"
    } else {
        "pending" // restera en pending pour la prochaine tentative
    };

    let _ = sqlx::query(
        r#"UPDATE disbursement_requests
           SET status = $1,
               failure_reason = $2,
               updated_at = NOW(),
               metadata = jsonb_set(
                   COALESCE(metadata, '{}'),
                   '{retry_count}',
                   to_jsonb($3::int)
               )
           WHERE id = $4"#,
    )
    .bind(new_status)
    .bind(reason)
    .bind(retry_count)
    .bind(id)
    .execute(pool)
    .await;
}
