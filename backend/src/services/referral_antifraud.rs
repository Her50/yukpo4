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
// ✅ 2026-05-16 — Signaux v2 (durcissement objectif 10k tx) :
//   - same_signup_subnet : IP /24 partagé (anti VPN/datacenter pool partagé)
//   - same_user_agent    : User-Agent identique (anti bot scripté)
//   - parrain_signup_burst : > N comptes signupés depuis la même IP en 24h
//     (anti farming massif)
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

/// Plafond signups distincts par IP (audit_logs `/api/auth/register`) sur 24h.
/// Au-delà, suspicion de farming massif (un même appareil/proxy crée N comptes).
fn max_signups_per_ip_24h() -> i64 {
    std::env::var("REFERRAL_MAX_SIGNUPS_PER_IP_24H")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(5)
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

    // 5. Cross-check IP + User-Agent + subnet /24 au signup.
    //
    // On joint audit_logs.path='/api/auth/register' pour parrain et filleul.
    // ✅ 2026-05-16 — Ajout :
    //   - same_signup_ip (exact match) — VPN dédié, même appareil
    //   - same_signup_subnet (mêmes 3 premiers octets IPv4) — VPN pool / NAT
    //     opérateur partagé. Faux positif possible (foyer = même /24) mais
    //     combiné avec d'autres signaux → score augmente.
    //   - same_user_agent — bot scripté qui n'aléatorise pas son UA.
    //
    // Best-effort : si audit_logs est vide pour l'un des deux users, skip.
    type SignupFingerprint = (Option<String>, Option<String>);
    let parrain_fp: Option<SignupFingerprint> = sqlx::query_as(
        r#"SELECT actor_ip::text,
                  metadata->>'user_agent'
             FROM audit_logs
            WHERE actor_id = $1 AND path = '/api/auth/register'
            ORDER BY id DESC LIMIT 1"#,
    )
    .bind(parrain_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    let filleul_fp: Option<SignupFingerprint> = sqlx::query_as(
        r#"SELECT actor_ip::text,
                  metadata->>'user_agent'
             FROM audit_logs
            WHERE actor_id = $1 AND path = '/api/auth/register'
            ORDER BY id DESC LIMIT 1"#,
    )
    .bind(filleul_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    if let (Some((p_ip, p_ua)), Some((f_ip, f_ua))) = (parrain_fp.as_ref(), filleul_fp.as_ref()) {
        match (p_ip.as_deref(), f_ip.as_deref()) {
            (Some(pi), Some(fi)) if !pi.is_empty() && !fi.is_empty() => {
                if pi == fi {
                    signals.push("same_signup_ip");
                } else {
                    // Match /24 (IPv4) ou /48 (IPv6) — heuristique simple
                    let p_prefix = ip_prefix(pi);
                    let f_prefix = ip_prefix(fi);
                    if !p_prefix.is_empty() && p_prefix == f_prefix {
                        signals.push("same_signup_subnet");
                    }
                }
            }
            _ => {}
        }
        if let (Some(pu), Some(fu)) = (p_ua.as_deref(), f_ua.as_deref()) {
            if !pu.is_empty() && pu == fu {
                signals.push("same_user_agent");
            }
        }
    }

    // 6. ✅ 2026-05-16 — Burst signups depuis la même IP que le filleul (24h).
    //    Si > N comptes ont signupé depuis la même IP que le filleul dans les
    //    dernières 24h, on suspecte du farming massif (un acteur derrière un
    //    seul appareil/proxy qui multiplie les comptes).
    if let Some((Some(f_ip_raw), _)) = filleul_fp.as_ref().map(|(ip, ua)| (ip.clone(), ua.clone()))
    {
        if !f_ip_raw.is_empty() {
            let count: i64 = sqlx::query_scalar(
                r#"SELECT COUNT(DISTINCT actor_id)::BIGINT
                     FROM audit_logs
                    WHERE path = '/api/auth/register'
                      AND actor_ip::text = $1
                      AND created_at > NOW() - INTERVAL '24 hours'"#,
            )
            .bind(&f_ip_raw)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
            if count > max_signups_per_ip_24h() {
                signals.push("signup_ip_burst_24h");
            }
        }
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

/// Renvoie le préfixe réseau d'une IP pour matcher des comptes co-localisés.
/// IPv4 → premiers 3 octets (/24). IPv6 → 4 premiers groupes hex (/64).
/// Retourne `""` si parsing impossible.
fn ip_prefix(ip: &str) -> String {
    let trimmed = ip.trim();
    if trimmed.contains(':') {
        // IPv6 : tronque au /64 (4 premiers groupes)
        trimmed.split(':').take(4).collect::<Vec<_>>().join(":")
    } else {
        // IPv4 : tronque au /24
        let parts: Vec<&str> = trimmed.split('.').collect();
        if parts.len() == 4 {
            parts[..3].join(".")
        } else {
            String::new()
        }
    }
}
