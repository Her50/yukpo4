// ✅ Service Parrainage Yukpo — PR #1 (fondations)
// Date : 2026-05-15
//
// Responsabilités :
//   - Génération de codes uniques (6 chars, alphabet sans ambiguïté)
//   - Résolution code → parrain_id
//   - Attachement filleul → parrain au signup (idempotent, set une fois)
//   - Tracking clics anonymes (rate-limit côté controller)
//   - Lecture stats par parrain (clics / inscrits / conversions / bonus)
//
// La conversion (crédit du bonus) est gérée en PR #2 via referral_conversion.rs

use rand::Rng;
use rust_decimal::Decimal;
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use crate::services::wallet_credit_bourse_service::{self, CreditMovementContext, CreditSource};

const CODE_LEN: usize = 6;
// Alphabet sans 0/O/1/I/L : impossible de confondre à l'oral / au scan
const CODE_ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_GEN_ATTEMPTS: u8 = 10;

/// Montant du bonus parrain (FCFA) crédité à la conversion du filleul.
pub const REFERRAL_BONUS_XAF: i32 = 500;

/// Seuil minimum de la première commande du filleul pour déclencher le bonus.
/// Why: empêche un parrain de gamer le système en s'auto-parrainant (ou en
/// payant un faux filleul) via une micro-commande de 500-1000 FCFA juste pour
/// déclencher le bonus. Avec un seuil à 10 000 FCFA, la commande coûte plus
/// que le bonus → arbitrage économique cassé.
///
/// Le filleul peut faire plusieurs commandes en-dessous du seuil avant
/// d'atteindre ce montant : on déclenche au moment où la PREMIÈRE commande
/// ≥ 10 000 FCFA passe en statut `completed`. Les commandes précédentes
/// n'invalident pas l'éligibilité (referrals.status reste 'pending').
pub const REFERRAL_MIN_ORDER_XAF: i32 = 10_000;

/// Génère un code aléatoire (pur, sans accès DB).
pub fn random_code() -> String {
    let mut rng = rand::thread_rng();
    (0..CODE_LEN)
        .map(|_| {
            let idx = rng.gen_range(0..CODE_ALPHABET.len());
            CODE_ALPHABET[idx] as char
        })
        .collect()
}

/// Assure qu'un utilisateur a un referral_code. Idempotent — si déjà présent,
/// retourne le code existant. Sinon en génère un unique (retry sur collision).
pub async fn ensure_referral_code(pool: &PgPool, user_id: i32) -> Result<String, sqlx::Error> {
    if let Some(existing) =
        sqlx::query_scalar::<_, Option<String>>("SELECT referral_code FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await?
            .flatten()
    {
        return Ok(existing);
    }

    for _ in 0..MAX_GEN_ATTEMPTS {
        let candidate = random_code();
        let updated = sqlx::query(
            r#"
            UPDATE users
            SET referral_code = $2
            WHERE id = $1 AND referral_code IS NULL
              AND NOT EXISTS (SELECT 1 FROM users WHERE referral_code = $2)
            "#,
        )
        .bind(user_id)
        .bind(&candidate)
        .execute(pool)
        .await?;

        if updated.rows_affected() == 1 {
            return Ok(candidate);
        }

        // Soit le code existe déjà ailleurs, soit le user en a déjà reçu un
        // (concurrent call) — relire pour décider.
        let current: Option<String> =
            sqlx::query_scalar("SELECT referral_code FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_one(pool)
                .await?;
        if let Some(c) = current {
            return Ok(c);
        }
    }

    Err(sqlx::Error::Protocol(format!(
        "Impossible de générer un referral_code unique pour user {} après {} tentatives",
        user_id, MAX_GEN_ATTEMPTS
    )))
}

/// Résout un code → id du parrain. Retourne None si code inconnu ou vide.
pub async fn resolve_code(pool: &PgPool, code: &str) -> Result<Option<i32>, sqlx::Error> {
    let code = code.trim().to_uppercase();
    if code.is_empty() {
        return Ok(None);
    }
    sqlx::query_scalar::<_, i32>("SELECT id FROM users WHERE referral_code = $1")
        .bind(&code)
        .fetch_optional(pool)
        .await
}

/// Attache un filleul fraîchement inscrit à un parrain via son code.
/// Idempotent : si users.referred_by est déjà set ou si le code ne résout pas,
/// ne fait rien (et ne retourne pas d'erreur).
/// Compose dans la transaction d'inscription pour atomicité avec l'INSERT users.
pub async fn attach_referrer_tx(
    tx: &mut Transaction<'_, Postgres>,
    filleul_id: i32,
    code: &str,
) -> Result<Option<i32>, sqlx::Error> {
    let code = code.trim().to_uppercase();
    if code.is_empty() {
        return Ok(None);
    }

    // Lookup parrain via code
    let parrain_id: Option<i32> =
        sqlx::query_scalar("SELECT id FROM users WHERE referral_code = $1 AND id <> $2")
            .bind(&code)
            .bind(filleul_id)
            .fetch_optional(&mut **tx)
            .await?;

    let Some(parrain_id) = parrain_id else {
        return Ok(None);
    };

    // Set users.referred_by seulement si pas déjà attribué (set-once)
    let updated =
        sqlx::query("UPDATE users SET referred_by = $2 WHERE id = $1 AND referred_by IS NULL")
            .bind(filleul_id)
            .bind(parrain_id)
            .execute(&mut **tx)
            .await?;

    if updated.rows_affected() == 0 {
        // Déjà attribué (run concurrent ou re-signup avorté) — on ne crée pas
        // de doublon dans referrals.
        return Ok(None);
    }

    // Insert relation referrals (status='pending', filleul_id UNIQUE bloque doublon)
    sqlx::query(
        r#"
        INSERT INTO referrals (parrain_id, filleul_id, status)
        VALUES ($1, $2, 'pending')
        ON CONFLICT (filleul_id) DO NOTHING
        "#,
    )
    .bind(parrain_id)
    .bind(filleul_id)
    .execute(&mut **tx)
    .await?;

    // Si on avait un click anonyme avec ce code, on lie au user
    sqlx::query(
        r#"
        UPDATE referral_clicks
        SET signed_up_user_id = $1
        WHERE code = $2 AND signed_up_user_id IS NULL
        "#,
    )
    .bind(filleul_id)
    .bind(&code)
    .execute(&mut **tx)
    .await?;

    Ok(Some(parrain_id))
}

/// Wrapper non-tx de [`attach_referrer_tx`] : ouvre sa propre transaction.
/// À utiliser quand on n'a pas besoin d'atomicité avec l'INSERT users
/// (le user existe déjà). N'échoue PAS si pas de code ou code invalide.
pub async fn attach_referrer(
    pool: &PgPool,
    filleul_id: i32,
    code: &str,
) -> Result<Option<i32>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let res = attach_referrer_tx(&mut tx, filleul_id, code).await?;
    tx.commit().await?;
    Ok(res)
}

/// Enregistre un clic anonyme (avant signup). Rate-limit doit être fait
/// au niveau controller (ex: 1/sec par IP).
pub async fn record_click(
    pool: &PgPool,
    code: &str,
    ip_hash: Option<&str>,
    ua_hash: Option<&str>,
    landing_path: Option<&str>,
) -> Result<(), sqlx::Error> {
    let code = code.trim().to_uppercase();
    if code.is_empty() {
        return Ok(());
    }
    sqlx::query(
        r#"
        INSERT INTO referral_clicks (code, ip_hash, ua_hash, landing_path)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(&code)
    .bind(ip_hash)
    .bind(ua_hash)
    .bind(landing_path)
    .execute(pool)
    .await?;
    Ok(())
}

#[derive(Debug, serde::Serialize)]
pub struct ReferralStats {
    pub code: String,
    pub total_clicks: i64,
    pub total_signups: i64,
    pub total_conversions: i64,
    pub total_bonus_xaf: i64,
}

/// Stats agrégées pour un parrain donné. Utilisé par l'onglet Parrainage du
/// dashboard. Le bonus_total est calculé depuis referrals.bonus_amount_xaf
/// pour les conversions ; en PR #2, on ajoutera le crédit ledger comme source
/// de vérité avec rapprochement.
pub async fn get_stats(pool: &PgPool, user_id: i32) -> Result<ReferralStats, sqlx::Error> {
    let code = ensure_referral_code(pool, user_id).await?;

    let total_clicks: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::BIGINT FROM referral_clicks WHERE code = $1")
            .bind(&code)
            .fetch_one(pool)
            .await?;

    let total_signups: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::BIGINT FROM referrals WHERE parrain_id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await?;

    let total_conversions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT FROM referrals WHERE parrain_id = $1 AND status = 'converted'",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    let total_bonus_xaf: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(bonus_amount_xaf), 0)::BIGINT
           FROM referrals
           WHERE parrain_id = $1 AND status = 'converted'"#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(ReferralStats {
        code,
        total_clicks,
        total_signups,
        total_conversions,
        total_bonus_xaf,
    })
}

// ============================================================================
// PR #2 — Conversion (crédit bonus parrain)
// ============================================================================

/// Outcome de [`try_credit_referral_bonus`].
#[derive(Debug)]
pub enum ConversionOutcome {
    /// Pas de parrain ou parrainage déjà converti — aucune action.
    NoOp,
    /// Filleul a un parrainage pending mais la commande est sous le seuil
    /// (< REFERRAL_MIN_ORDER_XAF). Le parrainage reste pending pour une
    /// future commande qui franchira le seuil.
    BelowThreshold {
        parrain_id: i32,
        order_total_xaf: i32,
    },
    /// Bonus crédité au parrain. Retourne l'id du parrain et le nouveau solde.
    Credited {
        parrain_id: i32,
        order_total_xaf: i32,
        bonus_xaf: i32,
        parrain_new_balance: Decimal,
    },
}

/// Tente de créditer le bonus parrain pour une commande passée en `Completed`.
///
/// Pipeline :
///   1. Lookup filleul = `deliveries.creator_id`
///   2. Lookup référral pending pour ce filleul (sinon NoOp)
///   3. Lookup total commande via `shopping_orders` (actual_total_cents ||
///      estimated_total_cents)
///   4. Si total < REFERRAL_MIN_ORDER_XAF → BelowThreshold (no-op, on attend
///      une prochaine commande)
///   5. Sinon, transaction atomique :
///      - INSERT credit wallet_credit_bourse_ledger via apply_credit_tx
///      - UPDATE referrals SET status='converted', bonus_credited_at=NOW(),
///        first_order_id=$delivery_id, first_order_total_xaf=$total
///
/// Idempotent : si `bonus_credited_at IS NOT NULL`, retourne NoOp.
/// Idempotent : si le même `delivery_id` arrive 2x (via uniq index sur
/// first_order_id), la 2e fois est NoOp.
///
/// **Ne lève pas d'erreur métier** : si le parrainage n'existe pas, si la
/// commande n'a pas de shopping_order, on retourne NoOp. Les erreurs DB
/// remontent telles quelles.
pub async fn try_credit_referral_bonus(
    pool: &PgPool,
    delivery_id: Uuid,
) -> Result<ConversionOutcome, sqlx::Error> {
    // 1. Filleul + parrainage pending
    let filleul_row: Option<(i32,)> =
        sqlx::query_as(r#"SELECT creator_id FROM deliveries WHERE id = $1"#)
            .bind(delivery_id)
            .fetch_optional(pool)
            .await?;

    let Some((filleul_id,)) = filleul_row else {
        return Ok(ConversionOutcome::NoOp);
    };

    let pending: Option<(i64, i32, i32)> = sqlx::query_as(
        r#"SELECT id, parrain_id, bonus_amount_xaf
             FROM referrals
            WHERE filleul_id = $1
              AND status = 'pending'
              AND bonus_credited_at IS NULL
            LIMIT 1"#,
    )
    .bind(filleul_id)
    .fetch_optional(pool)
    .await?;

    let Some((referral_id, parrain_id, bonus_xaf)) = pending else {
        return Ok(ConversionOutcome::NoOp);
    };

    // 2. Total commande via shopping_orders
    let total_row = sqlx::query(
        r#"SELECT
               COALESCE(actual_total_cents, estimated_total_cents) AS total_cents,
               currency
             FROM shopping_orders
            WHERE delivery_id = $1
            LIMIT 1"#,
    )
    .bind(delivery_id)
    .fetch_optional(pool)
    .await?;

    let Some(row) = total_row else {
        // Livraison sans shopping_order associé (livraison "vide" / non Bourse) →
        // pas de bonus.
        return Ok(ConversionOutcome::NoOp);
    };
    let total_cents: i32 = row.try_get("total_cents").unwrap_or(0);
    let currency: String = row.try_get("currency").unwrap_or_else(|_| "XAF".to_string());

    // Convention repo : *_cents = FCFA × 100 (cf. bus_ticket_controller / 100).
    // Si la devise n'est pas XAF on ignore (pas de support multi-devise pour le bonus v1).
    if currency != "XAF" {
        return Ok(ConversionOutcome::NoOp);
    }
    let order_total_xaf = total_cents / 100;

    if order_total_xaf < REFERRAL_MIN_ORDER_XAF {
        return Ok(ConversionOutcome::BelowThreshold {
            parrain_id,
            order_total_xaf,
        });
    }

    // 2bis. ✅ 2026-05-16 — ANTI-FRAUDE : vérifie multi-compte, burst, IP commune,
    // phone non vérifié. Si signaux détectés, on enregistre dans audit_logs et on
    // NoOp le crédit (pas d'erreur métier — le filleul reçoit sa commande mais le
    // parrain n'est pas crédité ; review humaine via audit_logs).
    let report =
        crate::services::referral_antifraud::check_eligibility(pool, parrain_id, filleul_id)
            .await?;
    if !report.eligible {
        log::warn!(
            "[referral] crédit BLOQUÉ par anti-fraude pour parrain={} filleul={}: {:?}",
            parrain_id,
            filleul_id,
            report.signals
        );
        return Ok(ConversionOutcome::NoOp);
    }

    // 3. Crédit atomique parrain
    let mut tx = pool.begin().await?;

    let new_balance = wallet_credit_bourse_service::apply_credit_tx(
        &mut tx,
        parrain_id,
        Decimal::from(bonus_xaf),
        CreditSource::ReferralBonus,
        CreditMovementContext {
            note: Some(format!(
                "Bonus parrainage : filleul user {} a passé sa première commande de {} XAF",
                filleul_id, order_total_xaf
            )),
            ..Default::default()
        },
    )
    .await?;

    // UPDATE referrals — guard idempotency via bonus_credited_at IS NULL
    let updated = sqlx::query(
        r#"UPDATE referrals
              SET status = 'converted',
                  bonus_credited_at = NOW(),
                  first_order_id = $2,
                  first_order_total_xaf = $3
            WHERE id = $1 AND bonus_credited_at IS NULL"#,
    )
    .bind(referral_id)
    .bind(delivery_id)
    .bind(order_total_xaf)
    .execute(&mut *tx)
    .await?;

    if updated.rows_affected() == 0 {
        // Concurrent : un autre thread a déjà crédité. Rollback.
        tx.rollback().await?;
        return Ok(ConversionOutcome::NoOp);
    }

    tx.commit().await?;

    Ok(ConversionOutcome::Credited {
        parrain_id,
        order_total_xaf,
        bonus_xaf,
        parrain_new_balance: new_balance,
    })
}
