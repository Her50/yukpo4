//! Utilitaires pour retry des requêtes PostgreSQL avec backoff exponentiel
//! Gère les erreurs de connexion fermée et les erreurs TLS

use crate::core::types::AppResult;
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

                // ✅ CORRIGÉ 2025-12-27: Vérifier si c'est une erreur de connexion qui peut être retry
                // Inclut les erreurs TLS spécifiques qui sont récupérables
                let is_retryable = error_str.contains("peer closed connection")
                    || error_str.contains("TLS close_notify")
                    || error_str.contains("terminating connection")
                    || error_str.contains("crash of another server process")  // ✅ NOUVEAU: Gérer les crashes PostgreSQL
                    || error_str.contains("error communicating with database")
                    || error_str.contains("connection closed")
                    || error_str.contains("broken pipe")
                    || error_str.contains("connection reset")
                    || error_str.contains("unexpected_eof")  // ✅ NOUVEAU: Erreur TLS spécifique
                    || error_str.contains("Unexpected EOF")  // ✅ NOUVEAU: Variante de l'erreur TLS
                    || error_str.contains("closed without sending TLS close_notify")  // ✅ NOUVEAU: Erreur TLS complète
                    || error_str.contains("without sending TLS close_notify");  // ✅ NOUVEAU 2025-12-27: Variante de l'erreur TLS

                if is_retryable && attempt < max_retries {
                    // ✅ NOUVEAU 2025-11-27: Backoff plus long pour les crashes PostgreSQL
                    let is_crash_error = error_str.contains("crash of another server process")
                        || error_str.contains("terminating connection because of crash");

                    // ✅ CORRIGÉ 2025-12-27: Backoff adaptatif selon le type d'erreur
                    // Détection améliorée des erreurs TLS (toutes les variantes)
                    let is_tls_error = error_str.contains("TLS") 
                        || error_str.contains("close_notify") 
                        || error_str.contains("unexpected_eof")
                        || error_str.contains("Unexpected EOF")
                        || error_str.contains("peer closed connection");
                    
                    let backoff_ms: u64 = if is_crash_error {
                        // Backoff plus long pour les crashes (500ms, 1000ms, 2000ms, 4000ms, 5000ms max)
                        500 * (1u64 << (attempt - 1)).min(5000)
                    } else if is_tls_error {
                        // ✅ AMÉLIORÉ 2025-12-30: Backoff encore plus long pour erreurs TLS (2000ms, 3000ms, 4000ms, 5000ms, 6000ms max)
                        // Les erreurs TLS nécessitent beaucoup plus de temps pour que Render DB se stabilise
                        // Minimum 2000ms pour laisser le temps à la connexion de se rétablir complètement
                        // Le pool va créer une nouvelle connexion pendant ce temps
                        2000 + (1000 * (attempt as u64 - 1)).min(4000)
                    } else {
                        // Backoff normal pour autres erreurs (200ms, 400ms, 800ms, 1600ms, 2000ms max)
                        200 * (1u64 << (attempt - 1)).min(2000)
                    };

                    // ✅ CORRIGÉ 2025-12-27: Log en info pour erreurs TLS (important pour diagnostic)
                    if is_tls_error {
                        log::info!(
                            "[DB Retry] Tentative {}/{} échouée (erreur TLS récupérable): {}. Retry dans {}ms",
                            attempt,
                            max_retries,
                            error_str,
                            backoff_ms
                        );
                    } else {
                        log::debug!(
                            "[DB Retry] Tentative {}/{} échouée (erreur récupérable{}): {}. Retry dans {}ms",
                            attempt,
                            max_retries,
                            if is_crash_error { " - crash PostgreSQL" } else { "" },
                            error_str,
                            backoff_ms
                        );
                    }
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
    Err(last_error.unwrap_or_else(|| sqlx::Error::PoolClosed))
}

/// Retry une opération avec AppResult pour gérer les erreurs de connexion DB
/// Gère les erreurs de connexion fermée et les erreurs TLS dans les services
pub async fn retry_service_operation<T, F>(operation: F, max_retries: u32) -> AppResult<T>
where
    T: Send + 'static,
    F: Fn() -> Pin<Box<dyn Future<Output = AppResult<T>> + Send + 'static>>,
{
    let mut last_error = None;

    for attempt in 1..=max_retries {
        let future = operation();
        match future.await {
            Ok(result) => return Ok(result),
            Err(e) => {
                let error_str = e.to_string();

                // Vérifier si c'est une erreur de connexion qui peut être retry
                let is_retryable = error_str.contains("peer closed connection")
                    || error_str.contains("TLS close_notify")
                    || error_str.contains("terminating connection")
                    || error_str.contains("crash of another server process")
                    || error_str.contains("error communicating with database")
                    || error_str.contains("connection closed")
                    || error_str.contains("broken pipe")
                    || error_str.contains("connection reset")
                    || error_str.contains("Database(");

                if is_retryable && attempt < max_retries {
                    // Backoff exponentiel (200ms, 400ms, 800ms, 1600ms, 2000ms max)
                    let backoff_ms = 200 * (1u64 << (attempt - 1)).min(2000);

                    log::debug!(
                        "[Service Retry] Tentative {}/{} échouée (erreur récupérable): {}. Retry dans {}ms",
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
                            "[Service Retry] ❌ Toutes les {} tentatives ont échoué. Dernière erreur: {}",
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
        crate::core::types::AppError::Internal(
            "Toutes les tentatives de retry ont échoué".to_string(),
        )
    }))
}
