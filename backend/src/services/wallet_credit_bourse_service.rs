// ✅ Service Wallet Credit Bourse — pivot du modèle troc
// Date : 2026-05-10
//
// Crédit utilisable UNIQUEMENT sur Bourse du Livre (manuels, fournitures,
// frais de livraison côté Yukpo). Distinct de `users.tokens_balance` qui
// reste un wallet cash général.
//
// Tous les mouvements passent par cette API, qui maintient :
//   - users.wallet_credit_bourse (solde courant)
//   - wallet_credit_bourse_ledger (audit trail FIFO)
//
// Sources canoniques (champ `source` du ledger) :
//   - "troc_credit_provisional"   : crédit avancé à la finalisation TrocPrep
//                                   (livre passe en troc_status='matched')
//   - "troc_credit_engaged"       : engagement définitif quand chaîne créée
//   - "troc_credit_rolled_back"   : rollback si chaîne échoue
//   - "order_credit_used"         : utilisation au checkout (réduit la facture)
//   - "consignation_recovery"     : récupération via vente boutique secondaire
//   - "manual_admin_adjustment"   : ajustement par un admin Yukpo
//   - "referral_bonus"            : bonus parrain crédité à la conversion
//                                   (1ère commande filleul ≥ 10 000 FCFA)
//   - "payout_reserved"           : débit à la création d'une demande de
//                                   payout cash (réserve les fonds)
//   - "payout_refunded"           : recrédit si l'admin rejette la demande

use rust_decimal::Decimal;
use sqlx::{PgPool, Postgres, Transaction};

#[derive(Debug, Clone, Copy)]
pub enum CreditSource {
    TrocCreditProvisional,
    TrocCreditEngaged,
    TrocCreditRolledBack,
    OrderCreditUsed,
    ConsignationRecovery,
    ManualAdminAdjustment,
    /// ✅ 2026-05-15 : bonus parrain. Crédité quand le filleul passe sa
    /// première commande ≥ 10 000 FCFA en statut `Completed`.
    ReferralBonus,
    /// ✅ 2026-05-15 (PR #3) : débit pour réserver les fonds d'une demande
    /// de payout cash (avant approbation admin).
    PayoutReserved,
    /// ✅ 2026-05-15 (PR #3) : recrédit si l'admin rejette la demande payout.
    PayoutRefunded,
}

impl CreditSource {
    fn as_str(&self) -> &'static str {
        match self {
            CreditSource::TrocCreditProvisional => "troc_credit_provisional",
            CreditSource::TrocCreditEngaged => "troc_credit_engaged",
            CreditSource::TrocCreditRolledBack => "troc_credit_rolled_back",
            CreditSource::OrderCreditUsed => "order_credit_used",
            CreditSource::ConsignationRecovery => "consignation_recovery",
            CreditSource::ManualAdminAdjustment => "manual_admin_adjustment",
            CreditSource::ReferralBonus => "referral_bonus",
            CreditSource::PayoutReserved => "payout_reserved",
            CreditSource::PayoutRefunded => "payout_refunded",
        }
    }
}

#[derive(Debug, Default)]
pub struct CreditMovementContext {
    pub livre_id: Option<i32>,
    pub chaine_id: Option<i32>,
    pub troc_id: Option<i32>,
    pub purchase_id: Option<i32>,
    pub note: Option<String>,
    /// ✅ 2026-05-16 — Clé d'idempotence applicative.
    /// Si fournie + UNIQUE en base : un retry (double-clic, webhook rejoué,
    /// reprise après crash) renvoie ON CONFLICT au lieu de double-écrire le
    /// ledger. Le wallet reste cohérent.
    /// Format recommandé : `<feature>:<entity_id>[:<sub>]`
    ///   - "payout:42"                      → débit pour la demande payout #42
    ///   - "payout:42:refund"               → recrédit si rejet
    ///   - "referral:par=1:fil=5"           → bonus parrain
    ///   - "order:123:credit_used"          → utilisation crédit au checkout
    ///   - "admin:adj=2026-05-16:user=10"   → ajustement admin idempotent
    pub dedup_key: Option<String>,
}

/// Crédite le wallet bourse d'un user. Atomique. Renvoie le nouveau solde.
/// Utilise une transaction interne — si tu veux composer avec une transaction
/// extérieure, utilise `apply_credit_tx`.
pub async fn apply_credit(
    pool: &PgPool,
    user_id: i32,
    amount: Decimal,
    source: CreditSource,
    ctx: CreditMovementContext,
) -> Result<Decimal, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let new_balance = apply_credit_tx(&mut tx, user_id, amount, source, ctx).await?;
    tx.commit().await?;
    Ok(new_balance)
}

/// Variante composable : utilise une transaction existante (pour atomicité
/// avec d'autres écritures dans la même unité de travail).
pub async fn apply_credit_tx(
    tx: &mut Transaction<'_, Postgres>,
    user_id: i32,
    amount: Decimal,
    source: CreditSource,
    ctx: CreditMovementContext,
) -> Result<Decimal, sqlx::Error> {
    if amount <= Decimal::ZERO {
        // Crédit nul ou négatif : on ne fait rien (mais pas d'erreur)
        let bal: Decimal =
            sqlx::query_scalar("SELECT wallet_credit_bourse FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_one(&mut **tx)
                .await?;
        return Ok(bal);
    }

    // ✅ 2026-05-16 — Si dedup_key fournie, on protège via INSERT ... ON CONFLICT.
    // L'ordre est important : on insère D'ABORD le ledger (qui peut échouer sur
    // conflit) puis seulement après on update le wallet. Sinon, en cas de retry,
    // on créditerait deux fois le wallet avant que l'INSERT échoue.
    if let Some(key) = ctx.dedup_key.as_deref() {
        let inserted: Option<i64> = sqlx::query_scalar(
            r#"
            INSERT INTO wallet_credit_bourse_ledger
                (user_id, amount, direction, source, livre_id, chaine_id, troc_id, purchase_id, note, dedup_key, balance_after)
            VALUES ($1, $2, 'credit', $3, $4, $5, $6, $7, $8, $9, NULL)
            ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
            RETURNING id
            "#,
        )
        .bind(user_id)
        .bind(amount)
        .bind(source.as_str())
        .bind(ctx.livre_id)
        .bind(ctx.chaine_id)
        .bind(ctx.troc_id)
        .bind(ctx.purchase_id)
        .bind(ctx.note.as_deref())
        .bind(key)
        .fetch_optional(&mut **tx)
        .await?;
        if inserted.is_none() {
            // Conflit → opération déjà appliquée. On retourne le solde courant
            // sans toucher au wallet (idempotence).
            let bal: Decimal =
                sqlx::query_scalar("SELECT wallet_credit_bourse FROM users WHERE id = $1")
                    .bind(user_id)
                    .fetch_one(&mut **tx)
                    .await?;
            return Ok(bal);
        }
    }

    let new_balance: Decimal = sqlx::query_scalar(
        r#"
        UPDATE users
        SET wallet_credit_bourse = wallet_credit_bourse + $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING wallet_credit_bourse
        "#,
    )
    .bind(user_id)
    .bind(amount)
    .fetch_one(&mut **tx)
    .await?;

    if ctx.dedup_key.is_some() {
        // Mise à jour du balance_after sur la ligne déjà insérée plus haut
        sqlx::query(
            r#"UPDATE wallet_credit_bourse_ledger
                  SET balance_after = $2
                WHERE dedup_key = $1 AND balance_after IS NULL"#,
        )
        .bind(ctx.dedup_key.as_deref())
        .bind(new_balance)
        .execute(&mut **tx)
        .await?;
    } else {
        sqlx::query(
            r#"
            INSERT INTO wallet_credit_bourse_ledger
                (user_id, amount, direction, source, livre_id, chaine_id, troc_id, purchase_id, note, balance_after)
            VALUES ($1, $2, 'credit', $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(user_id)
        .bind(amount)
        .bind(source.as_str())
        .bind(ctx.livre_id)
        .bind(ctx.chaine_id)
        .bind(ctx.troc_id)
        .bind(ctx.purchase_id)
        .bind(ctx.note.as_deref())
        .bind(new_balance)
        .execute(&mut **tx)
        .await?;
    }

    Ok(new_balance)
}

/// Débite le wallet. Échec si solde insuffisant.
pub async fn consume_credit(
    pool: &PgPool,
    user_id: i32,
    amount: Decimal,
    source: CreditSource,
    ctx: CreditMovementContext,
) -> Result<Decimal, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let new_balance = consume_credit_tx(&mut tx, user_id, amount, source, ctx).await?;
    tx.commit().await?;
    Ok(new_balance)
}

pub async fn consume_credit_tx(
    tx: &mut Transaction<'_, Postgres>,
    user_id: i32,
    amount: Decimal,
    source: CreditSource,
    ctx: CreditMovementContext,
) -> Result<Decimal, sqlx::Error> {
    if amount <= Decimal::ZERO {
        let bal: Decimal =
            sqlx::query_scalar("SELECT wallet_credit_bourse FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_one(&mut **tx)
                .await?;
        return Ok(bal);
    }

    // ✅ 2026-05-16 — Idempotence : si dedup_key déjà présente dans le ledger,
    // l'opération a déjà été appliquée. On retourne le solde sans débiter ni
    // lever d'erreur InsufficientBalance (qui surviendrait sinon car le 1er
    // appel a déjà consommé les fonds).
    if let Some(key) = ctx.dedup_key.as_deref() {
        let already: Option<i64> = sqlx::query_scalar(
            "SELECT id FROM wallet_credit_bourse_ledger WHERE dedup_key = $1 LIMIT 1",
        )
        .bind(key)
        .fetch_optional(&mut **tx)
        .await?;
        if already.is_some() {
            let bal: Decimal =
                sqlx::query_scalar("SELECT wallet_credit_bourse FROM users WHERE id = $1")
                    .bind(user_id)
                    .fetch_one(&mut **tx)
                    .await?;
            return Ok(bal);
        }
    }

    // Vérification + débit atomique : on update seulement si solde suffisant.
    // Si pas suffisant, on lève une erreur explicite.
    let result = sqlx::query_scalar::<_, Decimal>(
        r#"
        UPDATE users
        SET wallet_credit_bourse = wallet_credit_bourse - $2,
            updated_at = NOW()
        WHERE id = $1 AND wallet_credit_bourse >= $2
        RETURNING wallet_credit_bourse
        "#,
    )
    .bind(user_id)
    .bind(amount)
    .fetch_optional(&mut **tx)
    .await?;

    let new_balance = match result {
        Some(b) => b,
        None => {
            return Err(sqlx::Error::Protocol(format!(
                "Solde wallet_credit_bourse insuffisant pour user {} (besoin: {})",
                user_id, amount
            )));
        }
    };

    sqlx::query(
        r#"
        INSERT INTO wallet_credit_bourse_ledger
            (user_id, amount, direction, source, livre_id, chaine_id, troc_id, purchase_id, note, dedup_key, balance_after)
        VALUES ($1, $2, 'debit', $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
    )
    .bind(user_id)
    .bind(amount)
    .bind(source.as_str())
    .bind(ctx.livre_id)
    .bind(ctx.chaine_id)
    .bind(ctx.troc_id)
    .bind(ctx.purchase_id)
    .bind(ctx.note.as_deref())
    .bind(ctx.dedup_key.as_deref())
    .bind(new_balance)
    .execute(&mut **tx)
    .await?;

    Ok(new_balance)
}

/// Renvoie le solde actuel du wallet bourse d'un user.
pub async fn get_balance(pool: &PgPool, user_id: i32) -> Result<Decimal, sqlx::Error> {
    sqlx::query_scalar("SELECT wallet_credit_bourse FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await
}

// ============================================================================
// 🟠 Dette Bourse — SPECIFIQUE au cas troc rollback après usage du crédit.
// Cette dette ne casse PAS la sémantique du wallet (qui reste ≥ 0).
// Elle est récupérée à la prochaine commande (ajoutée au total à payer).
// ============================================================================

/// Augmente la dette troc d'un user. Utilisée UNIQUEMENT par troc_lifecycle
/// quand un rollback survient après que le crédit ait déjà été consommé.
/// Atomique, audite via ledger (direction='debit', source='troc_rollback_debt').
pub async fn apply_debt_tx(
    tx: &mut Transaction<'_, Postgres>,
    user_id: i32,
    amount: Decimal,
    ctx: CreditMovementContext,
) -> Result<Decimal, sqlx::Error> {
    if amount <= Decimal::ZERO {
        let bal: Decimal =
            sqlx::query_scalar("SELECT COALESCE(bourse_debt_xaf, 0) FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_one(&mut **tx)
                .await?;
        return Ok(bal);
    }
    let new_debt: Decimal = sqlx::query_scalar(
        r#"UPDATE users
           SET bourse_debt_xaf = COALESCE(bourse_debt_xaf, 0) + $2,
               updated_at = NOW()
           WHERE id = $1
           RETURNING bourse_debt_xaf"#,
    )
    .bind(user_id)
    .bind(amount)
    .fetch_one(&mut **tx)
    .await?;

    // Trace dans le ledger pour audit (direction = 'debit' du point de vue user)
    sqlx::query(
        r#"INSERT INTO wallet_credit_bourse_ledger
           (user_id, amount, direction, source, livre_id, chaine_id, troc_id, purchase_id, note, balance_after)
           VALUES ($1, $2, 'debit', 'troc_rollback_debt', $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(user_id)
    .bind(amount)
    .bind(ctx.livre_id)
    .bind(ctx.chaine_id)
    .bind(ctx.troc_id)
    .bind(ctx.purchase_id)
    .bind(ctx.note.as_deref().unwrap_or("Rollback troc — crédit non récupérable du wallet").to_string())
    .bind(new_debt)
    .execute(&mut **tx)
    .await?;
    Ok(new_debt)
}

/// Apure la dette troc lors d'une commande (le user paie la dette dans le
/// total de sa commande). Décrémente bourse_debt_xaf de `amount`.
/// Si amount > dette actuelle, on plafonne à la dette (jamais négatif).
pub async fn clear_debt_tx(
    tx: &mut Transaction<'_, Postgres>,
    user_id: i32,
    amount: Decimal,
    ctx: CreditMovementContext,
) -> Result<Decimal, sqlx::Error> {
    if amount <= Decimal::ZERO {
        return Ok(Decimal::ZERO);
    }
    let result: Option<(Decimal, Decimal)> = sqlx::query_as(
        r#"UPDATE users
           SET bourse_debt_xaf = GREATEST(COALESCE(bourse_debt_xaf, 0) - $2, 0),
               updated_at = NOW()
           WHERE id = $1
           RETURNING LEAST(COALESCE(bourse_debt_xaf, 0) + $2, $2) AS recovered,
                     bourse_debt_xaf AS new_debt"#,
    )
    .bind(user_id)
    .bind(amount)
    .fetch_optional(&mut **tx)
    .await?;
    let (recovered, new_debt) = result.unwrap_or((Decimal::ZERO, Decimal::ZERO));

    if recovered > Decimal::ZERO {
        sqlx::query(
            r#"INSERT INTO wallet_credit_bourse_ledger
               (user_id, amount, direction, source, livre_id, chaine_id, troc_id, purchase_id, note, balance_after)
               VALUES ($1, $2, 'credit', 'debt_repaid_via_order', $3, $4, $5, $6, $7, $8)"#,
        )
        .bind(user_id)
        .bind(recovered)
        .bind(ctx.livre_id)
        .bind(ctx.chaine_id)
        .bind(ctx.troc_id)
        .bind(ctx.purchase_id)
        .bind(ctx.note.as_deref().unwrap_or("Dette apurée via commande cash").to_string())
        .bind(new_debt)
        .execute(&mut **tx)
        .await?;
    }
    Ok(recovered)
}

/// Renvoie la dette actuelle d'un user (toujours ≥ 0).
pub async fn get_debt(pool: &PgPool, user_id: i32) -> Result<Decimal, sqlx::Error> {
    sqlx::query_scalar("SELECT COALESCE(bourse_debt_xaf, 0) FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await
}

// ============================================================================
// Constantes du modèle de crédit
// ============================================================================

/// Ratio crédit / valeur IA — 75% (marge troc Yukpo 25%).
/// Ex: IA dit livre vaut 3850 XAF (état Bon = 70% du neuf 5500), parent A
/// reçoit 3850 × 0.75 = 2887 XAF de crédit brut. Marge Yukpo troc = 963 XAF.
pub const RATIO_CREDIT_VS_VALEUR_IA: f64 = 0.75;

/// Frais d'analyse IA déduits du crédit final.
/// Couvre :
///  - Coût réel GPT-4o multimodal (~5000 tokens input + ~500 output) ≈ 20 XAF
///  - Marge Yukpo sur l'opération d'analyse (~100%) ≈ 20 XAF
/// Total 40 XAF déduit par livre accepté. Les livres rejetés ne coûtent rien
/// à l'utilisateur (le frais n'est appliqué que sur le crédit final).
pub const LLM_ANALYSIS_FEE_XAF: f64 = 40.0;

/// Cap absolu de crédit avancé par parent par rentrée scolaire.
pub const CAP_CREDIT_PAR_PARENT_XAF: f64 = 50_000.0;

/// Pourcentage max de la commande payable en crédit (le reste en cash/MoMo).
/// 1.0 = le crédit peut couvrir 100% de la commande. Si le crédit dépasse la
/// commande, l'excédent reste dans le wallet pour les prochains achats.
pub const RATIO_MAX_CREDIT_DANS_COMMANDE: f64 = 1.0;

/// Marge brute minimale Yukpo pour engager une chaîne troc. En dessous, la
/// chaîne est rejetée (logistique trop coûteuse vs revenu attendu).
pub const MIN_CHAIN_MARGIN_XAF: f64 = 500.0;

/// TTL livre en `pending` avant bascule en `expired` (consignation backup).
pub const TTL_PENDING_DAYS: i64 = 60;

/// TTL livre en `chained` sans coursier assigné avant rollback (fail-chain).
pub const TTL_CHAINED_WITHOUT_COURSIER_DAYS: i64 = 7;

/// Calcule le crédit prévisionnel pour un livre selon sa valeur IA :
/// crédit_net = (valeur_calculee × 0.75) − frais_analyse_IA
/// Garanti ≥ 0 (les très petits livres dont la marge ne couvre pas les frais
/// donnent un crédit de 0 mais ne sont pas "négatifs").
pub fn compute_credit_for_book(valeur_calculee: f64) -> f64 {
    let credit_brut = valeur_calculee * RATIO_CREDIT_VS_VALEUR_IA;
    (credit_brut - LLM_ANALYSIS_FEE_XAF).max(0.0)
}

/// Plafonne le crédit utilisable au checkout selon la commande.
pub fn cap_credit_for_order(credit_disponible: f64, montant_commande: f64) -> f64 {
    let plafond = montant_commande * RATIO_MAX_CREDIT_DANS_COMMANDE;
    credit_disponible.min(plafond).max(0.0)
}
