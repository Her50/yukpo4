// ✅ Service Cycle de vie du Troc — maintenance périodique
// Date : 2026-05-10
//
// Fournit les fonctions de maintenance appelées par un job batch (cron daily) :
//   1. expire_pending_books : livres en `troc_status='pending'` depuis > 60j
//      → bascule en `expired`, notification parent, ouverture du parcours
//      consignation physique boutique secondaire.
//   2. fail_orphan_chains : livres en `chained` depuis > 7j sans coursier
//      assigné → rollback (release crédit, status='returned', notification).
//   3. compute_chain_revenue : calcul de la marge nette Yukpo prévue pour
//      une chaîne, utilisé comme seuil de viabilité avant `finalize_chain`.

use crate::services::wallet_credit_bourse_service::{
    self as wallet, CreditMovementContext, CreditSource, MIN_CHAIN_MARGIN_XAF,
    TTL_CHAINED_WITHOUT_COURSIER_DAYS,
};
use rust_decimal::Decimal;
use sqlx::PgPool;
use std::str::FromStr;

#[derive(Debug, Default)]
pub struct LifecycleReport {
    pub expired_count: i64,
    pub failed_chained_count: i64,
    pub credit_rolled_back_xaf: f64,
}

/// À appeler quotidiennement (cron). Effectue les deux maintenances + log.
pub async fn run_daily_maintenance(pool: &PgPool) -> Result<LifecycleReport, sqlx::Error> {
    let mut report = LifecycleReport::default();

    // 1. Expirer les livres en attente trop longtemps
    let expired = sqlx::query_scalar::<_, i64>(
        r#"
        WITH updated AS (
            UPDATE livres_scolaires
            SET troc_status = 'expired', is_available = false, updated_at = NOW()
            WHERE troc_status = 'pending'
              AND created_at < NOW() - INTERVAL '60 days'
              AND is_active = true
            RETURNING id, user_id
        ),
        notifs AS (
            INSERT INTO notifications (user_id, type, title, body, data, created_at)
            SELECT user_id, 'troc_book_expired',
                   'Livre non matché — passons par la boutique',
                   'Votre livre n''a pas trouvé de partenaire troc en 60 jours. Vous pouvez le déposer chez une librairie partenaire pour vente résiduelle, ou le retirer de la plateforme.',
                   jsonb_build_object('livre_id', id, 'i18n_key', 'troc_book_expired'),
                   NOW()
            FROM updated
            RETURNING 1
        )
        SELECT COUNT(*)::bigint FROM updated
        "#,
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    report.expired_count = expired;

    // 2. Identifier les livres "chained" depuis > 7j sans coursier assigné
    use sqlx::Row;
    let stuck_rows = sqlx::query(
        r#"
        SELECT l.id AS livre_id, l.user_id, ledger.amount, ledger.id AS ledger_id
        FROM livres_scolaires l
        JOIN wallet_credit_bourse_ledger ledger
          ON ledger.livre_id = l.id
         AND ledger.direction = 'credit'
         AND ledger.source IN ('troc_credit_provisional', 'troc_credit_engaged')
        LEFT JOIN book_delivery_packages pkg
          ON pkg.expediteur_id = l.user_id
         AND (pkg.livres @> jsonb_build_array(jsonb_build_object('livre_id', l.id)))
         AND pkg.coursier_id IS NOT NULL
        WHERE l.troc_status = 'chained'
          AND l.updated_at < NOW() - ($1::int * INTERVAL '1 day')
          AND pkg.id IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM wallet_credit_bourse_ledger ll
              WHERE ll.livre_id = l.id
                AND ll.source = 'troc_credit_rolled_back'
                AND ll.created_at > ledger.created_at
          )
        "#,
    )
    .bind(TTL_CHAINED_WITHOUT_COURSIER_DAYS as i32)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for row in stuck_rows {
        let livre_id: i32 = row.try_get("livre_id").unwrap_or(0);
        let user_id: i32 = row.try_get("user_id").unwrap_or(0);
        let amount: Decimal = row.try_get("amount").unwrap_or_default();

        // Rollback : on tente d'abord de débiter le wallet_credit_bourse. Si
        // le user a déjà dépensé ce crédit en commande, consume_credit échoue
        // (solde insuffisant) → on bascule sur apply_debt_tx pour enregistrer
        // une DETTE qui sera apurée à la prochaine commande du user.
        // Le solde effectif (wallet_credit_bourse − bourse_debt_xaf) reflète
        // alors correctement le manque-à-recouvrer côté Yukpo.
        if user_id > 0 && amount > Decimal::ZERO {
            let mut consumed = false;
            if let Ok(mut tx) = pool.begin().await {
                match wallet::consume_credit_tx(
                    &mut tx,
                    user_id,
                    amount,
                    CreditSource::TrocCreditRolledBack,
                    CreditMovementContext {
                        livre_id: Some(livre_id),
                        note: Some(format!(
                            "Rollback chaîne stuck > {}j sans coursier",
                            TTL_CHAINED_WITHOUT_COURSIER_DAYS
                        )),
                        ..Default::default()
                    },
                )
                .await
                {
                    Ok(_) => {
                        let _ = tx.commit().await;
                        consumed = true;
                    }
                    Err(_) => {
                        // Solde insuffisant — rollback la tx pour éviter mauvaise écriture
                        let _ = tx.rollback().await;
                    }
                }
            }
            if !consumed {
                if let Ok(mut tx) = pool.begin().await {
                    let _ = wallet::apply_debt_tx(
                        &mut tx,
                        user_id,
                        amount,
                        CreditMovementContext {
                            livre_id: Some(livre_id),
                            note: Some(
                                "Rollback troc — crédit déjà consommé en commande, dette à apurer"
                                    .to_string(),
                            ),
                            ..Default::default()
                        },
                    )
                    .await;
                    let _ = tx.commit().await;
                }
            }
            report.failed_chained_count += 1;
            report.credit_rolled_back_xaf += f64::from_str(&amount.to_string()).unwrap_or(0.0);
        }

        // Le livre repart en pending pour permettre un nouveau matching
        let _ = sqlx::query(
            r#"UPDATE livres_scolaires
               SET troc_status = 'pending', is_available = true, updated_at = NOW()
               WHERE id = $1"#,
        )
        .bind(livre_id)
        .execute(pool)
        .await;

        // Notification au parent
        let _ = sqlx::query(
            r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
               VALUES ($1, 'troc_chain_failed',
                       'Échange en attente — nouveau matching lancé',
                       'Une chaîne dans laquelle votre livre était engagé n''a pas pu aboutir. Le crédit a été restitué et nous cherchons un nouveau partenaire.',
                       jsonb_build_object('livre_id', $2, 'i18n_key', 'troc_chain_failed'),
                       NOW())"#,
        )
        .bind(user_id)
        .bind(livre_id)
        .execute(pool)
        .await;
    }

    log::info!(
        "[troc_lifecycle] Maintenance: {} expirés (60j), {} chaînes stuck rollbacked ({} XAF restitués)",
        report.expired_count,
        report.failed_chained_count,
        report.credit_rolled_back_xaf as i64
    );

    Ok(report)
}

/// Calcule la marge nette Yukpo attendue d'une chaîne.
/// = (somme des prix de revente IA) - (somme des crédits avancés) - (frais log estimés)
///
/// Utilisé avant `finalize_chain` pour rejeter les chaînes non-viables.
pub async fn compute_chain_revenue(
    pool: &PgPool,
    livre_ids: &[i32],
    distance_totale_km: f64,
) -> Result<f64, sqlx::Error> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT id, valeur_calculee::float8 AS valeur
        FROM livres_scolaires
        WHERE id = ANY($1)
        "#,
    )
    .bind(livre_ids)
    .fetch_all(pool)
    .await?;

    let mut total_valeur: f64 = 0.0;
    let mut total_credit: f64 = 0.0;
    for row in rows {
        let v: f64 = row.try_get("valeur").ok().unwrap_or(0.0);
        total_valeur += v;
        total_credit += wallet::compute_credit_for_book(v);
    }

    // Coût logistique estimé : ~150 XAF/km de coursier (calibrer selon CM)
    const COUT_KM_XAF: f64 = 150.0;
    let cout_logistique = distance_totale_km * COUT_KM_XAF;

    let marge = total_valeur - total_credit - cout_logistique;
    Ok(marge)
}

/// Vrai si la chaîne dépasse le seuil minimal de viabilité.
pub fn is_chain_viable(marge_xaf: f64) -> bool {
    marge_xaf >= MIN_CHAIN_MARGIN_XAF
}
