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
use sqlx::{PgPool, Postgres, Transaction};

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
