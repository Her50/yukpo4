// src/services/referral_antifraud.rs
// ✅ 2026-05-16 — Détection de fraude parrainage avant crédit bonus.
//
// Le bonus parrainage (500 FCFA après 1ère commande filleul ≥ 10 000 FCFA, cf
// memo `project_parrainage_yukpo`) est attrayant pour les fraudeurs :
//   - Multi-compte : parent crée N comptes fake → N × 500 FCFA gagné
//   - Auto-parrainage déguisé : parrain et filleul = même personne
//   - Bombing : 1 parrain → 1 000 filleuls « invités » qui ne reviennent jamais
//
// Ce module agrège plusieurs signaux et bloque le crédit si le score dépasse
// le seuil. Bloquer ne casse PAS la commande — on logge en audit_log pour
// review humaine et on retourne `NotEligible` au service parrainage.
//
// Signaux v1 (extensible) :
//   - filleul.id == parrain.id (déjà bloqué dans attach, double check ici)
//   - filleul.phone_verified == FALSE (si la colonne existe)
//   - parrain a déjà eu > N conversions dans les dernières 24 h (rate)
//   - parrain et filleul ont signupé depuis la même IP (si on track)
//   - filleul.created_at < parrain.created_at (filleul antérieur = impossible
//     sauf manipulation)
//   - filleul a moins de N minutes d'âge à la conversion (trop rapide)
//
// Configurable via env vars (cf. constantes ci-dessous).

use sqlx::PgPool;

#[derive(Debug)]
pub struct FraudReport {
    pub eligible: bool,
    pub score: u32,
    pub signals: Vec<&'static str>,
}

impl FraudReport {
    fn block(signals: Vec<&'static str>) -> Self {
        Self {
            eligible: false,
            score: signals.len() as u32 * 10,
            signals,
        }
    }
    fn ok() -> Self {
        Self {
            eligible: true,
            score: 0,
            signals: vec![],
        }
    }
}

/// Plafond conversions/parrain dans la fenêtre 24h. Au-delà, on bloque le
/// crédit jusqu'à review humaine.
fn max_conversions_24h() -> i64 {
    std::env::var("REFERRAL_MAX_CONVERSIONS_24H")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(20)
}

/// Âge minimum filleul (en minutes) entre signup et conversion. En dessous,
/// suspecté de bot scripté.
fn min_filleul_age_minutes() -> i64 {
    std::env::var("REFERRAL_MIN_FILLEUL_AGE_MINUTES")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(15)
}

/// Évalue l'éligibilité d'un couple parrain/filleul à recevoir le bonus.
/// À appeler depuis `try_credit_referral_bonus` AVANT le crédit.
pub async fn check_eligibility(
    pool: &PgPool,
    parrain_id: i32,
    filleul_id: i32,
) -> Result<FraudReport, sqlx::Error> {
    let mut signals: Vec<&'static str> = Vec::new();

    // 1. Auto-parrainage direct (defense in depth — déjà filtré par attach)
    if parrain_id == filleul_id {
        signals.push("self_referral");
    }

    // 2. Comparaison created_at parrain vs filleul
    let dates = sqlx::query_as::<
        _,
        (
            Option<chrono::DateTime<chrono::Utc>>,
            Option<chrono::DateTime<chrono::Utc>>,
        ),
    >(
        "SELECT
            (SELECT created_at FROM users WHERE id = $1),
            (SELECT created_at FROM users WHERE id = $2)",
    )
    .bind(parrain_id)
    .bind(filleul_id)
    .fetch_one(pool)
    .await?;
    if let (Some(p_created), Some(f_created)) = dates {
        if f_created < p_created {
            // Filleul antérieur au parrain → manipulation possible
            signals.push("filleul_predates_parrain");
        }
        let now = chrono::Utc::now();
        let age_min = (now - f_created).num_minutes();
        if age_min < min_filleul_age_minutes() {
            signals.push("filleul_too_young");
        }
    }

    // 3. Phone verified ? (best-effort : si la colonne n'existe pas, on skip)
    let phone_verified: Option<bool> =
        sqlx::query_scalar("SELECT COALESCE(phone_verified, FALSE) FROM users WHERE id = $1")
            .bind(filleul_id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    if matches!(phone_verified, Some(false)) {
        signals.push("filleul_phone_unverified");
    }

    // 4. Limite conversions/parrain dans les 24 dernières heures
    let recent_conv: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::BIGINT
             FROM referrals
            WHERE parrain_id = $1
              AND status = 'converted'
              AND bonus_credited_at > NOW() - INTERVAL '24 hours'"#,
    )
    .bind(parrain_id)
    .fetch_one(pool)
    .await?;
    if recent_conv >= max_conversions_24h() {
        signals.push("parrain_burst_conversions_24h");
    }

    // 5. Même IP au signup ? (si on a tracé referral_clicks ou audit_logs)
    // Best-effort : on regarde audit_logs.actor_ip pour la requête de signup
    // du parrain et du filleul. Si la colonne ou les données manquent, skip.
    let same_ip: Option<bool> = sqlx::query_scalar(
        r#"SELECT COALESCE(
              (
                SELECT MAX(p.actor_ip) = MAX(f.actor_ip)
                  FROM audit_logs p
                  JOIN audit_logs f ON p.actor_ip = f.actor_ip
                                   AND p.actor_ip IS NOT NULL
                 WHERE p.path = '/api/auth/register'
                   AND p.actor_id = $1
                   AND f.path = '/api/auth/register'
                   AND f.actor_id = $2
              ),
              FALSE
           )"#,
    )
    .bind(parrain_id)
    .bind(filleul_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    if matches!(same_ip, Some(true)) {
        signals.push("same_signup_ip");
    }

    if signals.is_empty() {
        Ok(FraudReport::ok())
    } else {
        log::warn!(
            "[referral_antifraud] BLOQUÉ parrain={} filleul={} signals={:?}",
            parrain_id,
            filleul_id,
            signals
        );
        Ok(FraudReport::block(signals))
    }
}
