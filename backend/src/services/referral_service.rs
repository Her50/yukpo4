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

/// Pourcentage du bonus parrain sur la première commande qualifiante du
/// filleul. 2026-06-08 — Bascule du modèle "500 FCFA fixe" vers "5% du
/// montant de la commande" : aligne l'incitation du parrain avec la
/// valeur réelle générée par son filleul (un filleul qui dépense 50 000
/// FCFA rapporte 2 500 FCFA au parrain au lieu de 500). Surcharge via
/// env `REFERRAL_BONUS_PERCENT_VENTE` si besoin d'ajustement sans rebuild.
pub const REFERRAL_BONUS_PERCENT_VENTE_DEFAULT: f64 = 5.0;

/// Pourcentage de la commission Yukpo sur un troc reversé au parrain quand
/// l'initiateur est un filleul. 2026-06-08 — Si Yukpo encaisse par exemple
/// 1 000 FCFA de commission sur un troc initié par un filleul, le parrain
/// reçoit 250 FCFA (25%). Cumulable avec le bonus ventes (sources ledger
/// distinctes : `referral_bonus` vs `referral_troc_commission`).
pub const REFERRAL_TROC_COMMISSION_PERCENT_DEFAULT: f64 = 25.0;

/// Seuil minimum par livraison pour déclencher le 5% bonus parrain.
///
/// 2026-06-24 — Confirmé : 10 000 FCFA conservé COMME GATE PAR LIVRAISON
/// (anti-spam micro-commandes répétées) mais on déclenche désormais sur
/// CHAQUE livraison qualifiante du filleul, pas seulement la première
/// (cf. refonte `try_credit_referral_bonus` qui itère par delivery_id).
pub const REFERRAL_MIN_ORDER_XAF: i32 = 10_000;

/// Helpers env (overrides sans rebuild).
fn referral_bonus_percent_vente() -> f64 {
    std::env::var("REFERRAL_BONUS_PERCENT_VENTE")
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .filter(|p| *p > 0.0 && *p <= 100.0)
        .unwrap_or(REFERRAL_BONUS_PERCENT_VENTE_DEFAULT)
}

fn referral_troc_commission_percent() -> f64 {
    std::env::var("REFERRAL_TROC_COMMISSION_PERCENT")
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .filter(|p| *p > 0.0 && *p <= 100.0)
        .unwrap_or(REFERRAL_TROC_COMMISSION_PERCENT_DEFAULT)
}

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
    /// Somme des bonus ventes crédités (5% × montant commande × N livraisons
    /// validées des filleuls).
    pub total_bonus_xaf: i64,
    /// 2026-06-08 — Nombre de trocs réellement complétés par les filleuls
    /// du parrain (statut = 'complete' dans troc_livres_scolaires). Distinct
    /// du nombre de scans/livres uploadés, qui n'est qu'un acte technique.
    pub total_trocs_filleuls: i64,
    /// Somme des commissions troc déjà CRÉDITÉES (= "initiée" = chaîne/troc
    /// validé, marge Yukpo réservée). Cumul dans le ledger.
    pub total_troc_commission_xaf: i64,
    /// 2026-06-24 — Somme des commissions VENDEUR sur livres d'occasion
    /// déjà crédités (= ventes confirmées via validee_complete). Cumul
    /// dans le ledger source 'referral_seller_commission'.
    pub total_seller_commission_xaf: i64,
    /// 2026-06-24 — Sprint 2 : part EFFECTIVE (released_at IS NOT NULL) du
    /// total gagné — c'est-à-dire la fraction RETIRABLE en cash.
    /// Le reste (total_gains - total_effective) reste INITIÉE (visible mais
    /// bloquée jusqu'à confirmation de la livraison par le coursier).
    pub total_effective_xaf: i64,
    /// 2026-06-24 — Sprint 2 : part INITIÉE (en attente de livraison effective).
    /// Pratique pour l'affichage côté front sans recalcul.
    pub total_initiee_xaf: i64,
    /// 2026-06-24 — Phase 0 ESPÉRÉE : commission potentielle si TOUS les
    /// livres actuellement mis en circulation par les filleuls trouvaient
    /// preneur (troc ou vente). Calcul live SQL = SUM(valeur_calculee × 0.25
    /// × 0.25) sur livres disponibles des filleuls. Ne crée AUCUNE entrée
    /// ledger — c'est un indicateur de potentiel pour motiver l'ambassadeur
    /// à pousser le terrain.
    pub commission_esperee_xaf: i64,
    /// Gains totaux parrainage (ventes + troc déjà crédités) — exclut l'espéré.
    pub total_gains_xaf: i64,
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

    // 2026-06-08 — Trocs réellement complétés par les filleuls du parrain.
    // On joint troc_livres_scolaires.initiateur_id → users.id, en filtrant
    // sur referred_by = parrain. statut='complete' = troc bouclé (livres
    // échangés physiquement, paiements/commissions encaissés).
    let total_trocs_filleuls: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::BIGINT
           FROM troc_livres_scolaires t
           INNER JOIN users u ON u.id = t.initiateur_id
           WHERE u.referred_by = $1 AND t.statut = 'complete'"#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // Cumul commissions troc dans le ledger (source = referral_troc_commission).
    // 2026-06-24 Sprint 3 : NET = crédits − rollbacks. Une commission rolled
    // back ne doit plus apparaître dans le total gagné.
    let total_troc_commission_xaf: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(
              CASE
                WHEN source = 'referral_troc_commission' AND direction = 'credit' THEN amount
                WHEN source = 'referral_troc_commission_rolled_back' AND direction = 'debit' THEN -amount
                ELSE 0
              END
           ), 0)::BIGINT
           FROM wallet_credit_bourse_ledger
           WHERE user_id = $1
             AND source IN ('referral_troc_commission', 'referral_troc_commission_rolled_back')"#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // 2026-06-24 — Cumul commissions VENDEUR (ventes occasion) NET.
    let total_seller_commission_xaf: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(
              CASE
                WHEN source = 'referral_seller_commission' AND direction = 'credit' THEN amount
                WHEN source = 'referral_seller_commission_rolled_back' AND direction = 'debit' THEN -amount
                ELSE 0
              END
           ), 0)::BIGINT
           FROM wallet_credit_bourse_ledger
           WHERE user_id = $1
             AND source IN ('referral_seller_commission', 'referral_seller_commission_rolled_back')"#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let total_gains_xaf =
        total_bonus_xaf + total_troc_commission_xaf + total_seller_commission_xaf;

    // 2026-06-24 — Sprint 2 + 3 : part EFFECTIVE = released ET NON rolled back.
    // Pour le cash-out gate côté wallet_payout_service.
    let total_effective_xaf: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(
              CASE
                WHEN direction = 'credit'
                     AND source IN ('referral_bonus', 'referral_troc_commission', 'referral_seller_commission')
                     AND released_at IS NOT NULL THEN amount
                WHEN direction = 'debit'
                     AND source IN ('referral_troc_commission_rolled_back', 'referral_seller_commission_rolled_back')
                     THEN -amount
                ELSE 0
              END
           ), 0)::BIGINT
           FROM wallet_credit_bourse_ledger
           WHERE user_id = $1
             AND source IN ('referral_bonus', 'referral_troc_commission', 'referral_seller_commission',
                            'referral_troc_commission_rolled_back', 'referral_seller_commission_rolled_back')"#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let total_initiee_xaf = (total_gains_xaf - total_effective_xaf).max(0);

    // ════════════════════════════════════════════════════════════════════
    // PHASE 0 — Commission ESPÉRÉE (potentielle, pas encore créditée)
    // ════════════════════════════════════════════════════════════════════
    // Pour chaque livre actuellement mis en circulation (is_available=true,
    // pas rejeté) par un filleul du parrain, on calcule la commission que
    // CE parrain toucherait si le livre était troqué/vendu maintenant :
    //   marge Yukpo provisionnelle = valeur_calculee × 0.25
    //   commission parrain         = marge × 0.25 = valeur_calculee × 0.0625
    //
    // Cette commission n'est PAS encore créditée — elle est juste estimée
    // pour motiver l'ambassadeur ("voilà ce que ton terrain peut rapporter").
    //
    // On limite aux livres mis en mode 'troc' ou 'vente' (mode_listing) —
    // les livres en mode 'don' ne génèrent pas de marge Yukpo.
    //
    // Si valeur_calculee est NULL (livre tout juste scanné, IA encore en
    // traitement), on l'exclut du calcul plutôt que de crashr.
    let commission_esperee_xaf: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(GREATEST(ls.valeur_calculee, 0) * 0.0625)::BIGINT, 0)
           FROM livres_scolaires ls
           INNER JOIN users u ON u.id = ls.user_id
           WHERE u.referred_by = $1
             AND COALESCE(ls.is_available, true) = true
             AND COALESCE(ls.etat_classification, '') != 'rejete'
             AND ls.mode_listing IN ('troc', 'vente')
             AND ls.valeur_calculee IS NOT NULL"#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    Ok(ReferralStats {
        code,
        total_clicks,
        total_signups,
        total_conversions,
        total_bonus_xaf,
        total_trocs_filleuls,
        total_troc_commission_xaf,
        total_seller_commission_xaf,
        total_effective_xaf,
        total_initiee_xaf,
        commission_esperee_xaf,
        total_gains_xaf,
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
    // 2026-06-24 — Refonte : passage du modèle "bonus once-per-filleul à la
    // 1re commande" vers "5% commission sur CHAQUE vente d'un filleul ≥ 10k".
    //   • Suppression du gate `referrals.status='pending'` : on lit
    //     directement `users.referred_by` (le parrainage existe dès le signup).
    //   • dedup_key par delivery_id (au lieu de par paire parrain/filleul) :
    //     un parrain peut maintenant cumuler les commissions sur TOUTES les
    //     commandes de son filleul.
    //   • Seuil 10 000 FCFA conservé : anti-spam micro-commandes répétées.
    //
    // 1. Filleul = creator de la livraison
    let filleul_row: Option<(i32,)> =
        sqlx::query_as(r#"SELECT creator_id FROM deliveries WHERE id = $1"#)
            .bind(delivery_id)
            .fetch_optional(pool)
            .await?;

    let Some((filleul_id,)) = filleul_row else {
        return Ok(ConversionOutcome::NoOp);
    };

    // 2. Lookup parrain DIRECT via users.referred_by (plus de pending/converted).
    let parrain_id: Option<i32> = sqlx::query_scalar(
        "SELECT referred_by FROM users WHERE id = $1 AND referred_by IS NOT NULL",
    )
    .bind(filleul_id)
    .fetch_optional(pool)
    .await?
    .flatten();

    let Some(parrain_id) = parrain_id else {
        return Ok(ConversionOutcome::NoOp);
    };

    // 3. Total commande via shopping_orders.
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
        return Ok(ConversionOutcome::NoOp);
    };
    let total_cents: i32 = row.try_get("total_cents").unwrap_or(0);
    let currency: String = row.try_get("currency").unwrap_or_else(|_| "XAF".to_string());

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

    // 4. Calcul du bonus (5% par défaut, surchargeable via env).
    let bonus_percent = referral_bonus_percent_vente();
    let bonus_xaf: i32 = ((order_total_xaf as f64) * bonus_percent / 100.0).floor() as i32;
    let bonus_xaf = bonus_xaf.max(1);

    // 5. Anti-fraude — multi-compte, burst, IP commune, phone non vérifié.
    let report =
        crate::services::referral_antifraud::check_eligibility(pool, parrain_id, filleul_id)
            .await?;
    if !report.eligible {
        log::warn!(
            "[referral] crédit BLOQUÉ par anti-fraude pour parrain={} filleul={} delivery={}: {:?}",
            parrain_id,
            filleul_id,
            delivery_id,
            report.signals
        );
        return Ok(ConversionOutcome::NoOp);
    }

    // 6. Crédit avec dedup_key PAR DELIVERY (multi-déclenchements par filleul OK).
    let new_balance = wallet_credit_bourse_service::apply_credit(
        pool,
        parrain_id,
        Decimal::from(bonus_xaf),
        CreditSource::ReferralBonus,
        CreditMovementContext {
            note: Some(format!(
                "Commission parrainage 5% : filleul {} a passé une commande de {} XAF (delivery {})",
                filleul_id, order_total_xaf, delivery_id
            )),
            // dedup_key par delivery → 1 crédit max par (parrain, livraison).
            // Permet à un parrain de cumuler les commissions de toutes les
            // commandes de son filleul, sans risque de double-crédit sur retry.
            dedup_key: Some(format!("referral_sale:delivery={}", delivery_id)),
            ..Default::default()
        },
    )
    .await?;

    // 7. Best-effort : enregistrer la 1re commande dans referrals.
    //    Sert UNIQUEMENT pour l'analytique (KPI "first conversion date" par
    //    filleul). Si UPDATE échoue, ne bloque pas le crédit qui est déjà fait.
    let _ = sqlx::query(
        r#"UPDATE referrals
              SET status = CASE WHEN status = 'pending' THEN 'converted' ELSE status END,
                  bonus_credited_at = COALESCE(bonus_credited_at, NOW()),
                  first_order_id = COALESCE(first_order_id, $2),
                  first_order_total_xaf = COALESCE(first_order_total_xaf, $3),
                  bonus_amount_xaf = COALESCE(NULLIF(bonus_amount_xaf, 0), $4)
            WHERE filleul_id = $1"#,
    )
    .bind(filleul_id)
    .bind(delivery_id)
    .bind(order_total_xaf)
    .bind(bonus_xaf)
    .execute(pool)
    .await;

    Ok(ConversionOutcome::Credited {
        parrain_id,
        order_total_xaf,
        bonus_xaf,
        parrain_new_balance: new_balance,
    })
}

// ============================================================================
// PR #3 — Commission parrain sur troc effectué par un filleul
// ============================================================================

/// Résultat de [`try_credit_referral_troc_commission`].
#[derive(Debug)]
pub enum TrocCommissionOutcome {
    /// L'initiateur n'a pas de parrain (ou auto-parrainage filtré) — no-op.
    NoOp,
    /// Commission créditée au parrain. Retourne le montant + nouveau solde.
    Credited {
        parrain_id: i32,
        commission_xaf: i32,
        parrain_new_balance: Decimal,
    },
}

/// Crédite la commission parrain sur **un livre donné** d'un troc fraîchement
/// passé à `statut='complete'`.
///
/// Modèle de calcul (révisé 2026-06-24) :
///   Chaque livre du troc a un scanneur unique (= `livres_scolaires.user_id`)
///   qui peut être un filleul. Au scan, Yukpo a une marge provisionnelle de
///   `(1 - RATIO_CREDIT_VS_VALEUR_IA)` × valeur_calculee = 25% × valeur_livre.
///   Au troc complet, cette marge se matérialise.
///
///   ➜ Le parrain de **CHAQUE** scanneur reçoit `REFERRAL_TROC_COMMISSION_PERCENT`
///     (25% par défaut) **de la marge sur le livre que SON filleul a apporté**.
///
///   Exemple troc à 2 livres avec 2 ambassadeurs différents :
///     Livre A scanné par Pierre (parrain = Aïcha), valeur 4 000
///       → marge Yukpo livre A = 1 000 → Aïcha reçoit 250
///     Livre B scanné par Sophie (parrain = Brice), valeur 5 000
///       → marge Yukpo livre B = 1 250 → Brice reçoit 312
///
/// Idempotence : dedup_key = `referral_troc:troc=X:livre=L:par=Y` où `livre=L`
/// est l'id du livre concerné. Permet à un même parrain de toucher
/// indépendamment si plusieurs de ses filleuls ont apporté des livres au même
/// troc (rare mais possible pour les ambassadeurs très actifs sur un petit
/// quartier).
///
/// **Anti-fraude minimal** : on filtre l'auto-parrainage (scanneur == parrain).
///
/// Ne lève pas d'erreur métier : pas de parrain, gain ≤ 0, livre sans
/// scanneur → NoOp silencieux.
pub async fn try_credit_referral_troc_commission(
    pool: &PgPool,
    troc_id: i32,
    livre_id: i32,
    scanneur_id: i32,
    livre_gain_yukpo_xaf: i32,
) -> Result<TrocCommissionOutcome, sqlx::Error> {
    if livre_gain_yukpo_xaf <= 0 {
        return Ok(TrocCommissionOutcome::NoOp);
    }

    // Lookup parrain du scanneur du livre.
    let parrain_id: Option<i32> =
        sqlx::query_scalar("SELECT referred_by FROM users WHERE id = $1 AND referred_by IS NOT NULL")
            .bind(scanneur_id)
            .fetch_optional(pool)
            .await?
            .flatten();

    let Some(parrain_id) = parrain_id else {
        return Ok(TrocCommissionOutcome::NoOp);
    };

    if parrain_id == scanneur_id {
        log::warn!(
            "[referral_troc] auto-parrainage filtré scanneur={} (= parrain)",
            scanneur_id
        );
        return Ok(TrocCommissionOutcome::NoOp);
    }

    let percent = referral_troc_commission_percent();
    let commission_xaf: i32 = ((livre_gain_yukpo_xaf as f64) * percent / 100.0).floor() as i32;
    if commission_xaf <= 0 {
        return Ok(TrocCommissionOutcome::NoOp);
    }

    let new_balance = wallet_credit_bourse_service::apply_credit(
        pool,
        parrain_id,
        Decimal::from(commission_xaf),
        CreditSource::ReferralTrocCommission,
        CreditMovementContext {
            troc_id: Some(troc_id),
            livre_id: Some(livre_id),
            note: Some(format!(
                "Commission parrainage troc #{} : livre {} (scanneur user {}, marge Yukpo {} XAF)",
                troc_id, livre_id, scanneur_id, livre_gain_yukpo_xaf
            )),
            // dedup_key par livre : permet 2 crédits indépendants sur le même
            // troc, un par côté ; et permet à un même parrain qui aurait
            // parrainé 2 scanneurs du même troc de toucher les 2 parts.
            dedup_key: Some(format!(
                "referral_troc:troc={}:livre={}:par={}",
                troc_id, livre_id, parrain_id
            )),
            ..Default::default()
        },
    )
    .await?;

    Ok(TrocCommissionOutcome::Credited {
        parrain_id,
        commission_xaf,
        parrain_new_balance: new_balance,
    })
}

// ============================================================================
// PR #4 — Commission parrain VENDEUR sur vente d'un livre d'OCCASION
// ============================================================================

/// Résultat de [`try_credit_referral_seller_commission`].
#[derive(Debug)]
pub enum SellerCommissionOutcome {
    /// Le vendeur n'a pas de parrain — no-op silencieux.
    NoOp,
    Credited {
        parrain_id: i32,
        commission_xaf: i32,
    },
}

/// Crédite la commission parrain pour UN livre d'occasion d'un filleul
/// vendu via Yukpo. À appeler par item, quand la commande mixte est confirmée.
///
/// Modèle (2026-06-24) :
///   Au scan, Yukpo a une marge provisionnelle de 25% × prix de vente.
///   Quand la vente se concrétise (commande validée), la marge se matérialise.
///   Le parrain du VENDEUR (= scanneur du livre, = filleul) reçoit
///   `REFERRAL_TROC_COMMISSION_PERCENT` (25% par défaut) de cette marge.
///
///   commission = prix_vente × 0.25 × 0.25 = prix_vente × 0.0625
///
/// Idempotence : dedup_key = `referral_seller:commande={UUID}:livre={ID}` —
/// chaque ligne de commande_livres_occasion ne peut créditer qu'une seule
/// fois, même si le hook se rejoue.
///
/// Fire-and-forget côté appelant — n'échoue pas la transaction commande
/// si le crédit parrain pose problème.
pub async fn try_credit_referral_seller_commission(
    pool: &PgPool,
    commande_id: Uuid,
    livre_scolaire_id: i32,
    vendeur_id: i32,
    prix_vente_xaf: f64,
) -> Result<SellerCommissionOutcome, sqlx::Error> {
    if prix_vente_xaf <= 0.0 {
        return Ok(SellerCommissionOutcome::NoOp);
    }

    // Lookup parrain du vendeur.
    let parrain_id: Option<i32> = sqlx::query_scalar(
        "SELECT referred_by FROM users WHERE id = $1 AND referred_by IS NOT NULL",
    )
    .bind(vendeur_id)
    .fetch_optional(pool)
    .await?
    .flatten();

    let Some(parrain_id) = parrain_id else {
        return Ok(SellerCommissionOutcome::NoOp);
    };

    if parrain_id == vendeur_id {
        log::warn!(
            "[referral_seller] auto-parrainage filtré vendeur={} (= parrain)",
            vendeur_id
        );
        return Ok(SellerCommissionOutcome::NoOp);
    }

    // Calcul : 25% × (prix × 25% marge Yukpo) = 6.25% × prix.
    let marge_ratio = 1.0
        - crate::services::wallet_credit_bourse_service::RATIO_CREDIT_VS_VALEUR_IA;
    let marge_yukpo = prix_vente_xaf * marge_ratio;
    let percent = referral_troc_commission_percent();
    let commission_xaf: i32 = (marge_yukpo * percent / 100.0).floor() as i32;
    if commission_xaf <= 0 {
        return Ok(SellerCommissionOutcome::NoOp);
    }

    let _ = wallet_credit_bourse_service::apply_credit(
        pool,
        parrain_id,
        Decimal::from(commission_xaf),
        CreditSource::ReferralSellerCommission,
        CreditMovementContext {
            livre_id: Some(livre_scolaire_id),
            note: Some(format!(
                "Commission parrainage vente occasion : livre {} vendu par user {} pour {} XAF (marge Yukpo {} XAF)",
                livre_scolaire_id, vendeur_id, prix_vente_xaf as i64, marge_yukpo as i64
            )),
            dedup_key: Some(format!(
                "referral_seller:commande={}:livre={}",
                commande_id, livre_scolaire_id
            )),
            ..Default::default()
        },
    )
    .await?;

    Ok(SellerCommissionOutcome::Credited {
        parrain_id,
        commission_xaf,
    })
}

// ============================================================================
// PR #5 — Release commissions parrainage (Initiée → Effective)
// ============================================================================
//
// Quand un livre est effectivement livré (coursier confirme la remise au
// destinataire), on marque les commissions parrainage liées à ce livre
// comme RELEASED (released_at = NOW()). Cela les rend retirables en cash
// (gate dans wallet_payout_service).
//
// Tant que released_at IS NULL → INITIÉE : visible dans le dashboard parrain
// mais bloquée pour cash-out.

/// Marque comme effectives toutes les commissions parrainage liées à un livre
/// précis. Appelé quand la livraison effective du livre est confirmée.
///
/// 2026-06-24 V2.2 — Envoie aussi un push notification à CHAQUE parrain
/// dont une commission a été marquée effective (mort viral important :
/// le parrain voit sa rémunération arriver en temps réel).
///
/// Retourne le nombre de lignes ledger mises à jour. Ne lève pas d'erreur si
/// aucune ligne n'est trouvée (livre sans parrainage ou déjà released).
pub async fn release_referral_commissions_for_livre(
    pool: &PgPool,
    livre_id: i32,
) -> Result<u64, sqlx::Error> {
    // On récupère AVANT update les (user_id, amount, source) pour pouvoir
    // notifier ensuite les parrains concernés.
    let to_release: Vec<(i32, Decimal, String)> = sqlx::query_as(
        r#"SELECT user_id, amount, source
           FROM wallet_credit_bourse_ledger
           WHERE livre_id = $1
             AND released_at IS NULL
             AND direction = 'credit'
             AND source IN ('referral_troc_commission', 'referral_seller_commission')"#,
    )
    .bind(livre_id)
    .fetch_all(pool)
    .await?;

    if to_release.is_empty() {
        return Ok(0);
    }

    let res = sqlx::query(
        r#"UPDATE wallet_credit_bourse_ledger
              SET released_at = NOW()
            WHERE livre_id = $1
              AND released_at IS NULL
              AND direction = 'credit'
              AND source IN ('referral_troc_commission', 'referral_seller_commission')"#,
    )
    .bind(livre_id)
    .execute(pool)
    .await?;

    let updated = res.rows_affected();
    if updated > 0 {
        log::info!(
            "[referral_release] ✅ livre {} : {} commission(s) parrainage marquée(s) effective(s)",
            livre_id, updated
        );

        // Push notif par parrain (agrégé si plusieurs commissions du même
        // parrain sur ce livre — cas rare mais possible).
        let mut agg: std::collections::HashMap<i32, (Decimal, Vec<String>)> =
            std::collections::HashMap::new();
        for (uid, amt, src) in to_release {
            let entry = agg.entry(uid).or_insert((Decimal::ZERO, Vec::new()));
            entry.0 += amt;
            entry.1.push(src);
        }
        for (parrain_id, (total, sources)) in agg {
            let total_xaf: i64 = total.to_string().parse::<f64>().unwrap_or(0.0) as i64;
            let kind = if sources.iter().any(|s| s.contains("seller")) {
                "vente"
            } else {
                "troc"
            };
            let title = format!("🎉 {} XAF confirmés !", total_xaf);
            let body = format!(
                "Le livre de ton filleul a été livré. Ta commission {} de {} XAF est maintenant retirable en Mobile Money.",
                kind, total_xaf
            );
            let data = serde_json::json!({
                "type": "referral_commission_effective",
                "amount_xaf": total_xaf,
                "livre_id": livre_id,
            });
            if let Err(e) = crate::services::push_notification_service::send_push_notification(
                pool,
                parrain_id,
                title,
                body,
                Some(data),
                Some("default".to_string()),
            )
            .await
            {
                log::warn!(
                    "[referral_release] push notif parrain {} échouée: {e:?}",
                    parrain_id
                );
            }
        }
    }
    Ok(updated)
}

/// Marque comme effectif le bonus ReferralBonus (5% côté acheteur) lié à une
/// livraison donnée. Appelé quand DeliveryStatus::Completed.
pub async fn release_referral_bonus_for_delivery(
    pool: &PgPool,
    delivery_id: Uuid,
) -> Result<u64, sqlx::Error> {
    let pattern = format!("referral_sale:delivery={}", delivery_id);
    let res = sqlx::query(
        r#"UPDATE wallet_credit_bourse_ledger
              SET released_at = NOW()
            WHERE released_at IS NULL
              AND direction = 'credit'
              AND source = 'referral_bonus'
              AND dedup_key = $1"#,
    )
    .bind(&pattern)
    .execute(pool)
    .await?;

    let updated = res.rows_affected();
    if updated > 0 {
        log::info!(
            "[referral_release] ✅ delivery {} : {} bonus parrainage marqué(s) effectif(s)",
            delivery_id, updated
        );
    }
    Ok(updated)
}

// ============================================================================
// PR #6 — Rollback commissions parrainage (annulations / expirations)
// ============================================================================
//
// Quand un livre est annulé sur le terrain (coursier ne peut pas le livrer)
// ou qu'un troc expire avant complétion, on doit REVERSE la commission qui
// avait été créditée au parrain.
//
// Pattern : on insère une entrée DEBIT dans le ledger avec une source de
// type *_rolled_back (audit trail) et on décrémente le wallet du parrain
// (cap à 0 pour ne pas créer un solde négatif si le parrain a déjà retiré
// cette commission via cash-out).

/// Rollback les commissions troc/seller liées à un livre. Best-effort sur
/// le wallet (cap à 0). Idempotent via dedup_key.
pub async fn rollback_referral_commissions_for_livre(
    pool: &PgPool,
    livre_id: i32,
    raison: &str,
) -> Result<u64, sqlx::Error> {
    // 1. Trouver toutes les commissions encore non-rolled-back pour ce livre.
    let entries: Vec<(i32, Decimal, String)> = sqlx::query_as(
        r#"SELECT user_id, amount, source
           FROM wallet_credit_bourse_ledger
           WHERE livre_id = $1
             AND direction = 'credit'
             AND source IN ('referral_troc_commission', 'referral_seller_commission')
             AND NOT EXISTS (
               SELECT 1 FROM wallet_credit_bourse_ledger r
               WHERE r.livre_id = wallet_credit_bourse_ledger.livre_id
                 AND r.user_id  = wallet_credit_bourse_ledger.user_id
                 AND r.direction = 'debit'
                 AND r.source IN ('referral_troc_commission_rolled_back',
                                  'referral_seller_commission_rolled_back')
             )"#,
    )
    .bind(livre_id)
    .fetch_all(pool)
    .await?;

    if entries.is_empty() {
        return Ok(0);
    }

    let mut rolled_back = 0u64;
    for (user_id, amount, original_source) in entries {
        let rollback_source_str = match original_source.as_str() {
            "referral_troc_commission" => "referral_troc_commission_rolled_back",
            "referral_seller_commission" => "referral_seller_commission_rolled_back",
            _ => continue,
        };

        let mut tx = pool.begin().await?;

        // Décrémenter le wallet (cap à 0).
        sqlx::query(
            r#"UPDATE users
                  SET wallet_credit_bourse = GREATEST(wallet_credit_bourse - $2, 0),
                      updated_at = NOW()
                WHERE id = $1"#,
        )
        .bind(user_id)
        .bind(amount)
        .execute(&mut *tx)
        .await?;

        let new_balance: Decimal =
            sqlx::query_scalar("SELECT wallet_credit_bourse FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_one(&mut *tx)
                .await?;

        let dedup_key = format!("{}:livre={}:par={}", rollback_source_str, livre_id, user_id);
        sqlx::query(
            r#"INSERT INTO wallet_credit_bourse_ledger
                 (user_id, amount, direction, source, livre_id, note, dedup_key, balance_after, released_at)
               VALUES ($1, $2, 'debit', $3, $4, $5, $6, $7, NOW())
               ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING"#,
        )
        .bind(user_id)
        .bind(amount)
        .bind(rollback_source_str)
        .bind(livre_id)
        .bind(format!("Rollback parrainage livre {}: {}", livre_id, raison))
        .bind(&dedup_key)
        .bind(new_balance)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        rolled_back += 1;

        log::info!(
            "[referral_rollback] ✅ livre {} parrain {} : -{} XAF (source={}, raison={})",
            livre_id, user_id, amount, rollback_source_str, raison
        );

        // 2026-06-24 V2.2 — Push notif : informer le parrain de l'annulation.
        // Important pour la transparence (le solde a baissé).
        let amount_xaf: i64 = amount.to_string().parse::<f64>().unwrap_or(0.0) as i64;
        let title = format!("⚠️ Commission annulée : -{} XAF", amount_xaf);
        let body = format!(
            "Un livre apporté par ton filleul a été annulé sur le terrain par le coursier. La commission de {} XAF a été reversée. Raison : {}",
            amount_xaf, raison
        );
        let data = serde_json::json!({
            "type": "referral_commission_rolledback",
            "amount_xaf": amount_xaf,
            "livre_id": livre_id,
            "raison": raison,
        });
        if let Err(e) = crate::services::push_notification_service::send_push_notification(
            pool,
            user_id,
            title,
            body,
            Some(data),
            Some("default".to_string()),
        )
        .await
        {
            log::warn!(
                "[referral_rollback] push notif parrain {} échouée: {e:?}",
                user_id
            );
        }
    }

    Ok(rolled_back)
}
