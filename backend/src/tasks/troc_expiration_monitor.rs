use log::{error, info};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::time::{interval, Duration as TokioDuration};

use crate::state::AppState;

const DEFAULT_TROC_TTL_HOURS: i64 = 72;
const DEFAULT_CHECK_INTERVAL_SECS: u64 = 3600;

/// Tâche périodique qui expire les trocs restés en "en_attente" trop longtemps.
/// TTL configurable via TROC_EXPIRATION_HOURS (défaut: 72h).
/// Intervalle configurable via TROC_EXPIRATION_CHECK_INTERVAL_SECS (défaut: 3600s / 1h).
pub async fn start_troc_expiration_monitor(state: Arc<AppState>) {
    info!("[TROC_EXPIRATION] Démarrage du monitor d'expiration des trocs...");

    let interval_secs: u64 = std::env::var("TROC_EXPIRATION_CHECK_INTERVAL_SECS")
        .unwrap_or_else(|_| DEFAULT_CHECK_INTERVAL_SECS.to_string())
        .parse()
        .unwrap_or(DEFAULT_CHECK_INTERVAL_SECS);

    let ttl_hours: i64 = std::env::var("TROC_EXPIRATION_HOURS")
        .unwrap_or_else(|_| DEFAULT_TROC_TTL_HOURS.to_string())
        .parse()
        .unwrap_or(DEFAULT_TROC_TTL_HOURS);

    let mut interval_timer = interval(TokioDuration::from_secs(interval_secs));

    loop {
        interval_timer.tick().await;

        if let Err(e) = expire_stale_trocs(&state.pg, ttl_hours).await {
            error!("[TROC_EXPIRATION] Erreur lors de l'expiration: {}", e);
        }
    }
}

async fn expire_stale_trocs(pool: &PgPool, ttl_hours: i64) -> Result<(), String> {
    // Expire direct trocs that have been pending too long
    let expired_direct = sqlx::query(
        r#"
        UPDATE troc_livres_scolaires
        SET statut = 'expire'
        WHERE statut = 'en_attente'
        AND created_at < NOW() - ($1 || ' hours')::INTERVAL
        "#,
    )
    .bind(ttl_hours.to_string())
    .execute(pool)
    .await
    .map_err(|e| format!("Erreur expiration trocs directs: {}", e))?;

    let direct_count = expired_direct.rows_affected();

    // Expire chain trocs that have been in formation too long
    let expired_chains = sqlx::query(
        r#"
        UPDATE chaines_troc_livres
        SET statut = 'expiree'
        WHERE statut = 'en_formation'
        AND created_at < NOW() - ($1 || ' hours')::INTERVAL
        "#,
    )
    .bind(ttl_hours.to_string())
    .execute(pool)
    .await
    .map_err(|e| format!("Erreur expiration chaînes: {}", e))?;

    let chain_count = expired_chains.rows_affected();

    // Expire accepted trocs that haven't been completed within double the TTL
    let expired_accepted = sqlx::query(
        r#"
        UPDATE troc_livres_scolaires
        SET statut = 'expire'
        WHERE statut = 'accepte'
        AND updated_at < NOW() - ($1 || ' hours')::INTERVAL
        "#,
    )
    .bind((ttl_hours * 2).to_string())
    .execute(pool)
    .await
    .map_err(|e| format!("Erreur expiration trocs acceptés: {}", e))?;

    let accepted_count = expired_accepted.rows_affected();

    if direct_count > 0 || chain_count > 0 || accepted_count > 0 {
        info!(
            "[TROC_EXPIRATION] Expirés: {} trocs en attente, {} chaînes en formation, {} trocs acceptés (TTL: {}h)",
            direct_count, chain_count, accepted_count, ttl_hours
        );
    }

    Ok(())
}
