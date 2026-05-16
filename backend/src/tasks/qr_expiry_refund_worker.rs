//! Worker de remboursement automatique sur expiration de QR code non validé.
//!
//! Tourne toutes les 15 minutes. Détecte les commandes dont le QR code de livraison
//! n'a jamais été scanné au-delà d'un délai configurable, puis rembourse le patient
//! en re-créditant son wallet du montant réservé (`wallet_reserved_cents`).
//!
//! Couverture :
//!   - pharmacy_orders  : QR de type 'delivery' (ou 'pickup') non validé > REFUND_DELAY_HOURS
//!   - restaurant_orders: QR non validé > REFUND_DELAY_HOURS
//!   - shopping_orders  : Livraison jamais complétée (delivery_payment_reservations 'reserved') > REFUND_DELAY_HOURS
//!
//! Règles de remboursement :
//!   - Seules les commandes payées par wallet (payment_status = 'paid') sont remboursables
//!   - La commande ne doit pas être déjà annulée, livrée ou reversée
//!   - Idempotent : une commande remboursée n'est pas re-traitée (refunded_at IS NOT NULL)

use chrono::Utc;
use log::{error, info, warn};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::time::{interval, Duration as TokioDuration};

use crate::state::AppState;

const INTERVAL_SECS: u64 = 900; // 15 minutes
const REFUND_DELAY_HOURS: i64 = 48; // Délai avant remboursement si QR non validé (48h)

pub async fn start_qr_expiry_refund_worker(state: Arc<AppState>) {
    // ✅ 2026-05-16 — Jitter init contre thundering herd. Sans ça, les 3-50 VM
    // Fly exécutent ce worker à la même seconde toutes les 15 min → 50× la même
    // query DB simultanément, lock contention sur user_wallets et pic CPU/IO
    // côté Postgres. Décale chaque VM de 0..INTERVAL_SECS au démarrage pour
    // dérouler le travail en continu sur la fenêtre au lieu d'un spike.
    let jitter = TokioDuration::from_secs(rand::random::<u64>() % INTERVAL_SECS);
    info!(
        "[QRExpiryRefund] Démarré — intervalle {}s, délai remboursement {}h, jitter init {}s",
        INTERVAL_SECS,
        REFUND_DELAY_HOURS,
        jitter.as_secs()
    );
    tokio::time::sleep(jitter).await;

    let mut timer = interval(TokioDuration::from_secs(INTERVAL_SECS));

    loop {
        timer.tick().await;

        if let Err(e) = process_expired_pharmacy_orders(&state.pg).await {
            error!("[QRExpiryRefund] Erreur pharmacy: {}", e);
        }

        if let Err(e) = process_expired_restaurant_orders(&state.pg).await {
            error!("[QRExpiryRefund] Erreur restaurant: {}", e);
        }

        if let Err(e) = process_expired_shopping_orders(&state.pg).await {
            error!("[QRExpiryRefund] Erreur shopping: {}", e);
        }
    }
}

// ============================================================================
// PHARMACIE
// ============================================================================

async fn process_expired_pharmacy_orders(pool: &PgPool) -> Result<(), sqlx::Error> {
    let cutoff = Utc::now() - chrono::Duration::hours(REFUND_DELAY_HOURS);

    // Commandes payées par wallet, non livrées, non reversées, sans QR validé,
    // créées il y a plus de REFUND_DELAY_HOURS
    let rows = sqlx::query(
        r#"
        SELECT o.id, o.user_id, o.wallet_reserved_cents, o.status
        FROM pharmacy_orders o
        WHERE o.payment_status  = 'paid'
          AND o.wallet_reserved_cents > 0
          AND o.reversed_at     IS NULL
          AND o.refunded_at     IS NULL
          AND o.status NOT IN ('delivered', 'cancelled', 'refunded')
          AND o.created_at < $1
          AND NOT EXISTS (
              SELECT 1 FROM pharmacy_order_qr_codes q
              WHERE q.order_id = o.id
                AND q.status = 'validated'
          )
        LIMIT 50
        "#,
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    info!(
        "[QRExpiryRefund] {} commandes pharmacie expirées sans livraison",
        rows.len()
    );

    for row in rows {
        let order_id: uuid::Uuid = row.try_get("id").unwrap();
        let patient_id: i32 = row.try_get("user_id").unwrap_or(0);
        let reserved: i64 = row.try_get("wallet_reserved_cents").unwrap_or(0);

        if let Err(e) = refund_patient_wallet(
            pool,
            patient_id,
            reserved,
            "pharmacy_order",
            &order_id.to_string(),
        )
        .await
        {
            error!("[QRExpiryRefund] ❌ Pharmacy #{}: {}", order_id, e);
            continue;
        }

        // Marquer la commande comme remboursée + annulée
        sqlx::query(
            "UPDATE pharmacy_orders SET status = 'cancelled', refunded_at = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(order_id)
        .execute(pool)
        .await
        .ok();

        // Marquer les QR comme expirés
        sqlx::query(
            "UPDATE pharmacy_order_qr_codes SET status = 'expired' WHERE order_id = $1 AND status = 'pending'",
        )
        .bind(order_id)
        .execute(pool)
        .await
        .ok();

        info!(
            "[QRExpiryRefund] ✅ Pharmacie #{} remboursé: {}F → patient {}",
            order_id,
            reserved / 100,
            patient_id
        );
    }

    Ok(())
}

// ============================================================================
// RESTAURANT
// ============================================================================

async fn process_expired_restaurant_orders(pool: &PgPool) -> Result<(), sqlx::Error> {
    let cutoff = Utc::now() - chrono::Duration::hours(REFUND_DELAY_HOURS);

    let rows = sqlx::query(
        r#"
        SELECT o.id, o.client_user_id, o.wallet_reserved_cents, o.status
        FROM restaurant_orders o
        WHERE o.payment_status      = 'paid'
          AND o.wallet_reserved_cents > 0
          AND o.reversed_at         IS NULL
          AND o.refunded_at         IS NULL
          AND o.status NOT IN ('completed', 'cancelled', 'refunded')
          AND o.created_at < $1
          AND NOT EXISTS (
              SELECT 1 FROM restaurant_order_qr_codes q
              WHERE q.order_id = o.id
                AND q.status = 'validated'
          )
        LIMIT 50
        "#,
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    info!(
        "[QRExpiryRefund] {} commandes restaurant expirées sans livraison",
        rows.len()
    );

    for row in rows {
        let order_id: i32 = row.try_get("id").unwrap_or(0);
        let client_id: Option<i32> = row.try_get("client_user_id").ok().flatten();
        let reserved: i64 = row.try_get("wallet_reserved_cents").unwrap_or(0);

        let client_id = match client_id {
            Some(id) => id,
            None => {
                warn!(
                    "[QRExpiryRefund] Restaurant #{} sans client_user_id, ignoré",
                    order_id
                );
                continue;
            }
        };

        if let Err(e) = refund_patient_wallet(
            pool,
            client_id,
            reserved,
            "restaurant_order",
            &order_id.to_string(),
        )
        .await
        {
            error!("[QRExpiryRefund] ❌ Restaurant #{}: {}", order_id, e);
            continue;
        }

        sqlx::query(
            "UPDATE restaurant_orders SET status = 'cancelled', refunded_at = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(order_id)
        .execute(pool)
        .await
        .ok();

        sqlx::query(
            "UPDATE restaurant_order_qr_codes SET status = 'expired' WHERE order_id = $1 AND status = 'pending'",
        )
        .bind(order_id)
        .execute(pool)
        .await
        .ok();

        info!(
            "[QRExpiryRefund] ✅ Restaurant #{} remboursé: {}F → client {}",
            order_id,
            reserved / 100,
            client_id
        );
    }

    Ok(())
}

// ============================================================================
// Créditer le wallet patient (opération atomique)
// ============================================================================

async fn refund_patient_wallet(
    pool: &PgPool,
    user_id: i32,
    amount_cents: i64,
    reference_type: &str,
    reference_id: &str,
) -> Result<(), String> {
    // Créer le wallet si absent
    sqlx::query(
        "INSERT INTO user_wallets (user_id, balance_cents, currency) VALUES ($1, 0, 'XAF') ON CONFLICT (user_id, currency) DO NOTHING",
    )
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Erreur create wallet: {}", e))?;

    let balance_before: i64 = sqlx::query_scalar(
        "SELECT COALESCE(balance_cents, 0) FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .unwrap_or(0);

    // Créditer le remboursement
    sqlx::query(
        "UPDATE user_wallets SET balance_cents = balance_cents + $1, updated_at = NOW() WHERE user_id = $2 AND currency = 'XAF'",
    )
    .bind(amount_cents)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Erreur crédit remboursement: {}", e))?;

    // Traçabilité wallet
    sqlx::query(
        r#"INSERT INTO wallet_transactions (
            user_id, transaction_type, direction, amount_cents,
            balance_before_cents, balance_after_cents,
            currency, reference_type, reference_id, description, created_at
        ) VALUES ($1, 'order_refund', 'credit', $2, $3, $4, 'XAF', $5, $6, $7, NOW())"#,
    )
    .bind(user_id)
    .bind(amount_cents)
    .bind(balance_before)
    .bind(balance_before + amount_cents)
    .bind(reference_type)
    .bind(reference_id)
    .bind(format!(
        "Remboursement automatique — commande non livrée dans les {}h ({}F)",
        REFUND_DELAY_HOURS,
        amount_cents / 100
    ))
    .execute(pool)
    .await
    .ok(); // log failure only — le crédit wallet est déjà fait

    Ok(())
}

// ============================================================================
// SHOPPING (supermarché, e-commerce, boutique, magasin, etc.)
// ============================================================================
// Le paiement shopping passe par delivery_payment_reservations.
// On détecte les réservations 'reserved' dont la livraison n'est pas terminée
// au-delà de REFUND_DELAY_HOURS et on rembourse le wallet client + l'assurance.

async fn process_expired_shopping_orders(pool: &PgPool) -> Result<(), sqlx::Error> {
    let cutoff = Utc::now() - chrono::Duration::hours(REFUND_DELAY_HOURS);

    // Réservations encore actives dont la livraison est expirée
    let rows = sqlx::query(
        r#"
        SELECT
            dpr.id            AS reservation_id,
            dpr.delivery_id,
            dpr.user_id,
            dpr.total_amount_cents,
            so.id::TEXT       AS shopping_order_id
        FROM delivery_payment_reservations dpr
        JOIN shopping_orders so ON so.delivery_id = dpr.delivery_id
        JOIN deliveries      d  ON d.id = dpr.delivery_id
        WHERE dpr.reservation_status = 'reserved'
          AND dpr.refunded_at IS NULL
          AND so.status NOT IN ('delivered', 'cancelled', 'refunded')
          AND d.status  NOT IN ('delivered', 'completed', 'cancelled')
          AND d.requested_at < $1
        LIMIT 50
        "#,
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    info!(
        "[QRExpiryRefund] {} commandes shopping expirées sans livraison confirmée",
        rows.len()
    );

    for row in rows {
        let reservation_id: uuid::Uuid = row.try_get("reservation_id").unwrap();
        let delivery_id: uuid::Uuid = row.try_get("delivery_id").unwrap();
        let user_id: i32 = row.try_get("user_id").unwrap_or(0);
        let total_cents: i64 = row.try_get("total_amount_cents").unwrap_or(0);
        let shopping_order_id: String = row.try_get("shopping_order_id").unwrap_or_default();

        // 1. Rembourser le montant principal (produit + livraison)
        if let Err(e) = refund_patient_wallet(
            pool,
            user_id,
            total_cents,
            "shopping_order",
            &shopping_order_id,
        )
        .await
        {
            error!(
                "[QRExpiryRefund] ❌ Shopping reservation {} (user {}): {}",
                reservation_id, user_id, e
            );
            continue;
        }

        // 2. Rembourser l'assurance si un débit a été enregistré pour cette commande
        let insurance_cents: i64 = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COALESCE(amount_cents, 0)
            FROM wallet_transactions
            WHERE user_id          = $1
              AND transaction_type = 'insurance_debit'
              AND reference_type   = 'shopping_order'
              AND reference_id     = $2
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .bind(&shopping_order_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .unwrap_or(0);

        if insurance_cents > 0 {
            if let Err(e) = refund_patient_wallet(
                pool,
                user_id,
                insurance_cents,
                "shopping_order_insurance",
                &shopping_order_id,
            )
            .await
            {
                warn!(
                    "[QRExpiryRefund] ⚠️ Remboursement assurance shopping {} échoué: {}",
                    shopping_order_id, e
                );
            } else {
                info!(
                    "[QRExpiryRefund] ✅ Assurance {}F remboursée → user {}",
                    insurance_cents / 100,
                    user_id
                );
            }
        }

        // 3. Marquer la réservation comme remboursée
        sqlx::query(
            "UPDATE delivery_payment_reservations SET reservation_status = 'refunded', refunded_at = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(reservation_id)
        .execute(pool)
        .await
        .ok();

        // 4. Annuler la commande shopping et la livraison associée
        sqlx::query(
            "UPDATE shopping_orders SET status = 'cancelled', updated_at = NOW() WHERE delivery_id = $1",
        )
        .bind(delivery_id)
        .execute(pool)
        .await
        .ok();

        sqlx::query(
            "UPDATE deliveries SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1 AND status NOT IN ('delivered','completed','cancelled')",
        )
        .bind(delivery_id)
        .execute(pool)
        .await
        .ok();

        info!(
            "[QRExpiryRefund] ✅ Shopping {} remboursé: {}F + assurance → user {}",
            shopping_order_id,
            total_cents / 100,
            user_id
        );
    }

    Ok(())
}
