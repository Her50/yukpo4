// ✅ Service Payout Cash Universel — PR #3 (2026-05-15)
//
// Le user demande à retirer son solde wallet_credit_bourse en cash via
// Orange Money ou MTN Mobile Money. Toute source de crédit dans le ledger
// est éligible (bonus parrainage, ventes livres, troc).
//
// FLOW :
//   1. user POST /api/wallet/payout/request   {amount, operator, phone}
//      → on consume_credit_tx avec source 'payout_reserved' (réserve)
//      → on insert wallet_payout_requests (status='pending')
//   2. admin GET /api/admin/wallet/payouts?status=pending → liste
//   3. admin POST .../approve  → UPDATE status='approved' (kyc validé)
//   4. admin POST .../paid     → UPDATE status='paid' + paid_at + payout_ref
//      (les fonds étaient déjà débités à l'étape 1, plus rien à faire wallet)
//   5. admin POST .../reject   → UPDATE status='rejected'
//      + apply_credit_tx avec source 'payout_refunded' (recrédit)
//
// IDEMPOTENCE : refund est guardé par "status was pending|approved" → si on
// reject 2× on ne recrédite qu'une fois.
//
// SEUIL MIN : 2000 FCFA par demande (configurable via env PAYOUT_MIN_XAF).
// Évite de processer des micro-demandes de 500 FCFA (frais opérateur >>>).

use rust_decimal::Decimal;
use sqlx::{PgPool, Row};

use crate::services::wallet_credit_bourse_service::{
    apply_credit_tx, consume_credit_tx, CreditMovementContext, CreditSource,
};

/// Montant minimum d'une demande de payout (FCFA).
/// Surchargeable via env `PAYOUT_MIN_XAF`.
fn payout_min_xaf() -> i32 {
    std::env::var("PAYOUT_MIN_XAF")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(2_000)
}

#[derive(Debug, thiserror::Error)]
pub enum PayoutError {
    #[error("Montant minimum : {0} FCFA")]
    AmountTooLow(i32),
    #[error("Montant doit être positif")]
    AmountNotPositive,
    #[error("Opérateur invalide : utilisez 'orange_money' ou 'mtn_momo'")]
    InvalidOperator,
    #[error("Numéro de téléphone invalide (format E.164 attendu)")]
    InvalidPhone,
    #[error("Solde insuffisant : {balance} FCFA disponibles, {requested} FCFA demandés")]
    InsufficientBalance { balance: i32, requested: i32 },
    #[error("Demande introuvable")]
    NotFound,
    #[error("Transition de statut invalide : {0} → {1}")]
    InvalidTransition(String, String),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

const VALID_OPERATORS: &[&str] = &["orange_money", "mtn_momo"];

fn validate_phone_e164(phone: &str) -> bool {
    // E.164 simplifié : commence par +, 8-15 chiffres après. Suffit pour
    // distinguer "67912345" de "+237679123456" — l'admin valide visuellement
    // le format complet avant payout.
    let trimmed = phone.trim();
    if !trimmed.starts_with('+') {
        return false;
    }
    let digits: String = trimmed[1..].chars().filter(|c| c.is_ascii_digit()).collect();
    digits.len() >= 8 && digits.len() <= 15
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PayoutRequest {
    pub id: i64,
    pub user_id: i32,
    pub amount_xaf: i32,
    pub operator: String,
    pub phone_e164: String,
    pub status: String,
    pub admin_note: Option<String>,
    pub payout_ref: Option<String>,
    pub requested_at: chrono::DateTime<chrono::Utc>,
    pub processed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub paid_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Crée une demande de payout pour un user. Atomique :
/// débite le wallet (source `payout_reserved`) et insert la demande
/// dans la même transaction.
pub async fn request_payout(
    pool: &PgPool,
    user_id: i32,
    amount_xaf: i32,
    operator: &str,
    phone_e164: &str,
    idempotency_key: Option<&str>,
) -> Result<i64, PayoutError> {
    if amount_xaf <= 0 {
        return Err(PayoutError::AmountNotPositive);
    }
    let min = payout_min_xaf();
    if amount_xaf < min {
        return Err(PayoutError::AmountTooLow(min));
    }
    if !VALID_OPERATORS.contains(&operator) {
        return Err(PayoutError::InvalidOperator);
    }
    if !validate_phone_e164(phone_e164) {
        return Err(PayoutError::InvalidPhone);
    }

    // ✅ 2026-05-16 — Idempotence : si user_id + idempotency_key existe déjà,
    // on retourne l'id de la demande existante sans en créer une seconde.
    // Cf. UNIQUE INDEX `uniq_wallet_payout_requests_idem`.
    if let Some(key) = idempotency_key {
        let existing: Option<i64> = sqlx::query_scalar(
            r#"SELECT id FROM wallet_payout_requests
                WHERE user_id = $1 AND idempotency_key = $2
                LIMIT 1"#,
        )
        .bind(user_id)
        .bind(key)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();
        if let Some(id) = existing {
            log::info!(
                "[payout] idempotent replay user={} key={} → id existant {}",
                user_id,
                key,
                id
            );
            return Ok(id);
        }
    }

    let mut tx = pool.begin().await?;

    // Vérification + débit atomique (consume_credit_tx échoue si solde < amount).
    // dedup_key associée au payout : si le wallet ledger est déjà débité pour
    // cette clé, on ne re-débite pas (et on n'échoue pas avec InsufficientBalance).
    let dedup_key = idempotency_key.map(|k| format!("payout:idem:{}:{}", user_id, k));
    consume_credit_tx(
        &mut tx,
        user_id,
        Decimal::from(amount_xaf),
        CreditSource::PayoutReserved,
        CreditMovementContext {
            note: Some(format!("Réservation payout {} {}", amount_xaf, operator)),
            dedup_key: dedup_key.clone(),
            ..Default::default()
        },
    )
    .await
    .map_err(|e| {
        // Mapping erreur "solde insuffisant" → message clair API
        if let sqlx::Error::Protocol(s) = &e {
            if s.contains("insuffisant") {
                return PayoutError::InsufficientBalance {
                    balance: 0,
                    requested: amount_xaf,
                };
            }
        }
        PayoutError::Db(e)
    })?;

    let id: i64 = sqlx::query_scalar(
        r#"INSERT INTO wallet_payout_requests
              (user_id, amount_xaf, operator, phone_e164, status, idempotency_key)
           VALUES ($1, $2, $3, $4, 'pending', $5)
           RETURNING id"#,
    )
    .bind(user_id)
    .bind(amount_xaf)
    .bind(operator)
    .bind(phone_e164.trim())
    .bind(idempotency_key)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(id)
}

/// Liste les demandes d'un user (toutes statuts, plus récentes d'abord).
pub async fn list_for_user(pool: &PgPool, user_id: i32) -> Result<Vec<PayoutRequest>, sqlx::Error> {
    sqlx::query_as::<_, PayoutRequest>(
        r#"SELECT id, user_id, amount_xaf, operator, phone_e164, status,
                  admin_note, payout_ref, requested_at, processed_at, paid_at
             FROM wallet_payout_requests
            WHERE user_id = $1
            ORDER BY requested_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Liste les demandes pour l'admin, filtrables par statut.
/// Si `status_filter` est None, retourne toutes les demandes en attente d'action
/// (pending + approved).
pub async fn list_admin(
    pool: &PgPool,
    status_filter: Option<&str>,
) -> Result<Vec<PayoutRequest>, sqlx::Error> {
    let query = if let Some(s) = status_filter {
        sqlx::query_as::<_, PayoutRequest>(
            r#"SELECT id, user_id, amount_xaf, operator, phone_e164, status,
                      admin_note, payout_ref, requested_at, processed_at, paid_at
                 FROM wallet_payout_requests
                WHERE status = $1
                ORDER BY requested_at ASC"#,
        )
        .bind(s)
    } else {
        sqlx::query_as::<_, PayoutRequest>(
            r#"SELECT id, user_id, amount_xaf, operator, phone_e164, status,
                      admin_note, payout_ref, requested_at, processed_at, paid_at
                 FROM wallet_payout_requests
                WHERE status IN ('pending', 'approved')
                ORDER BY requested_at ASC"#,
        )
    };
    query.fetch_all(pool).await
}

/// Admin : valide KYC et passe à approved. Le wallet reste débité.
pub async fn approve(pool: &PgPool, id: i64, admin_note: Option<&str>) -> Result<(), PayoutError> {
    let updated = sqlx::query(
        r#"UPDATE wallet_payout_requests
              SET status = 'approved',
                  processed_at = NOW(),
                  admin_note = COALESCE($2, admin_note)
            WHERE id = $1 AND status = 'pending'"#,
    )
    .bind(id)
    .bind(admin_note)
    .execute(pool)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(PayoutError::InvalidTransition(
            "?".into(),
            "approved".into(),
        ));
    }
    Ok(())
}

/// Admin : virement effectué, on garde la référence transaction.
pub async fn mark_paid(pool: &PgPool, id: i64, payout_ref: &str) -> Result<(), PayoutError> {
    if payout_ref.trim().is_empty() {
        return Err(PayoutError::InvalidTransition(
            "approved".into(),
            "paid (ref manquante)".into(),
        ));
    }
    let updated = sqlx::query(
        r#"UPDATE wallet_payout_requests
              SET status = 'paid',
                  paid_at = NOW(),
                  payout_ref = $2
            WHERE id = $1 AND status IN ('pending', 'approved')"#,
    )
    .bind(id)
    .bind(payout_ref.trim())
    .execute(pool)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(PayoutError::InvalidTransition("?".into(), "paid".into()));
    }
    Ok(())
}

/// Admin : rejette la demande et recrédite le wallet du user.
pub async fn reject(pool: &PgPool, id: i64, reason: &str) -> Result<(), PayoutError> {
    let mut tx = pool.begin().await?;

    // Lock + lookup ligne à rejeter — seulement si pending|approved (pas paid|rejected)
    let row = sqlx::query(
        r#"SELECT user_id, amount_xaf, status
             FROM wallet_payout_requests
            WHERE id = $1
              AND status IN ('pending', 'approved')
            FOR UPDATE"#,
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(row) = row else {
        return Err(PayoutError::NotFound);
    };
    let user_id: i32 = row.try_get("user_id").map_err(PayoutError::Db)?;
    let amount_xaf: i32 = row.try_get("amount_xaf").map_err(PayoutError::Db)?;

    sqlx::query(
        r#"UPDATE wallet_payout_requests
              SET status = 'rejected',
                  processed_at = NOW(),
                  admin_note = $2
            WHERE id = $1"#,
    )
    .bind(id)
    .bind(reason)
    .execute(&mut *tx)
    .await?;

    // Refund : on recrédite le user. ✅ 2026-05-16 — dedup_key garantit qu'un
    // double-rejet (concurrent admin clicks) ne re-crédite pas 2× le wallet.
    apply_credit_tx(
        &mut tx,
        user_id,
        Decimal::from(amount_xaf),
        CreditSource::PayoutRefunded,
        CreditMovementContext {
            note: Some(format!("Refund payout #{} (rejected) : {}", id, reason)),
            dedup_key: Some(format!("payout:{}:refund", id)),
            ..Default::default()
        },
    )
    .await?;

    tx.commit().await?;
    Ok(())
}

// ============================================================================
// Treasury summary (admin) — distingue trésorerie Yukpo vs dette envers clients
// ============================================================================

/// Résumé trésorerie pour dashboard admin financier.
///
/// Why: `wallet_credit_bourse` appartient AUX CLIENTS, pas à Yukpo. Quand
/// l'admin regarde "combien d'argent dispose Yukpo", il faut soustraire :
///   - le solde wallet total outstanding (dette de l'app envers ses users)
///   - les payouts en cours (pending + approved) — déjà sortis du wallet
///     mais pas encore virés en cash, donc à provisionner.
///
/// Le revenu NET réel de Yukpo doit toujours déduire ces deux montants des
/// commissions brutes perçues côté business (calcul amont, hors ce module).
#[derive(Debug, serde::Serialize)]
pub struct TreasurySummary {
    /// Somme de users.wallet_credit_bourse — dette client.
    pub total_wallet_outstanding_xaf: i64,
    /// Demandes de payout pending + approved — provisionné, pas encore versé.
    pub total_payouts_pending_xaf: i64,
    /// Demandes payées historiquement (info).
    pub total_payouts_paid_xaf: i64,
    /// Total bonus parrainage déjà crédité (info).
    pub total_referral_bonus_credited_xaf: i64,
    /// Nombre de demandes en attente d'action admin.
    pub pending_count: i64,
}

pub async fn treasury_summary(pool: &PgPool) -> Result<TreasurySummary, sqlx::Error> {
    let total_wallet_outstanding_xaf: i64 =
        sqlx::query_scalar(r#"SELECT COALESCE(SUM(wallet_credit_bourse), 0)::BIGINT FROM users"#)
            .fetch_one(pool)
            .await?;

    let total_payouts_pending_xaf: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(amount_xaf), 0)::BIGINT
             FROM wallet_payout_requests
            WHERE status IN ('pending', 'approved')"#,
    )
    .fetch_one(pool)
    .await?;

    let total_payouts_paid_xaf: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(amount_xaf), 0)::BIGINT
             FROM wallet_payout_requests
            WHERE status = 'paid'"#,
    )
    .fetch_one(pool)
    .await?;

    let total_referral_bonus_credited_xaf: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(amount), 0)::BIGINT
             FROM wallet_credit_bourse_ledger
            WHERE source = 'referral_bonus' AND direction = 'credit'"#,
    )
    .fetch_one(pool)
    .await?;

    let pending_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT FROM wallet_payout_requests WHERE status = 'pending'",
    )
    .fetch_one(pool)
    .await?;

    Ok(TreasurySummary {
        total_wallet_outstanding_xaf,
        total_payouts_pending_xaf,
        total_payouts_paid_xaf,
        total_referral_bonus_credited_xaf,
        pending_count,
    })
}
