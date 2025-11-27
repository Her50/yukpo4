//! Utilitaires pour retry des requêtes PostgreSQL avec backoff exponentiel
//! Gère les erreurs de connexion fermée et les erreurs TLS

use sqlx::PgPool;
use std::future::Future;
use std::pin::Pin;
use std::time::Duration;
use tokio::time::sleep;

/// Retry une requête PostgreSQL avec backoff exponentiel
/// Gère les erreurs de connexion fermée et les erreurs TLS
/// 
/// Cette version utilise Box<dyn Future> pour permettre la capture de valeurs
/// dans les closures sans problème de lifetime
pub async fn retry_query<T, F>(
    _pool: &PgPool,
    query_fn: F,
    max_retries: u32,
) -> Result<T, sqlx::Error>
where
    T: Send + 'static,
    F: Fn() -> Pin<Box<dyn Future<Output = Result<T, sqlx::Error>> + Send + 'static>>,
{
    let mut last_error = None;
    
    for attempt in 1..=max_retries {
        let future = query_fn();
        match future.await {
            Ok(result) => return Ok(result),
            Err(e) => {
                let error_str = e.to_string();
                
                // Vérifier si c'est une erreur de connexion qui peut être retry
                let is_retryable = error_str.contains("peer closed connection")
                    || error_str.contains("TLS close_notify")
                    || error_str.contains("terminating connection")
                    || error_str.contains("crash of another server process")  // ✅ NOUVEAU: Gérer les crashes PostgreSQL
                    || error_str.contains("error communicating with database")
                    || error_str.contains("connection closed")
                    || error_str.contains("broken pipe")
                    || error_str.contains("connection reset");
                
                if is_retryable && attempt < max_retries {
                    let backoff_ms = 200 * (1u64 << (attempt - 1)).min(2000); // ✅ CORRIGÉ: Augmenté de 100ms/1000ms à 200ms/2000ms pour plus de stabilité
                    // ✅ CORRIGÉ: Log en debug pour réduire le bruit (les erreurs récupérables sont normales)
                    log::debug!(
                        "[DB Retry] Tentative {}/{} échouée (erreur récupérable): {}. Retry dans {}ms",
                        attempt,
                        max_retries,
                        error_str,
                        backoff_ms
                    );
                    sleep(Duration::from_millis(backoff_ms)).await;
                    last_error = Some(e);
                } else {
                    // Erreur non récupérable ou dernière tentative
                    if attempt >= max_retries {
                        log::error!(
                            "[DB Retry] ❌ Toutes les {} tentatives ont échoué. Dernière erreur: {}",
                            max_retries,
                            error_str
                        );
                    }
                    return Err(e);
                }
            }
        }
    }
    
    // Si on arrive ici, toutes les tentatives ont échoué
    Err(last_error.unwrap_or_else(|| {
        sqlx::Error::PoolClosed
    }))
}

