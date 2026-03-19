// ✅ NOUVEAU 2025-01-27 : Utilitaire de retry pour opérations réseau/DB
// Implémente retry avec backoff exponentiel pour erreurs transitoires

use std::time::Duration;
use tokio::time::sleep;

/// Configuration du retry
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay_ms: 100,
            max_delay_ms: 5000,
            multiplier: 2.0,
        }
    }
}

/// Erreur transitoire (peut être retentée)
pub trait IsTransientError {
    fn is_transient(&self) -> bool;
}

/// Exécute une opération avec retry automatique
pub async fn retry_with_backoff<F, T, E>(mut operation: F, config: RetryConfig) -> Result<T, E>
where
    F: FnMut() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, E>> + Send>>,
    E: IsTransientError + std::fmt::Debug,
{
    let mut delay_ms = config.initial_delay_ms;
    let mut last_error = None;

    for attempt in 1..=config.max_attempts {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                if !e.is_transient() {
                    // Erreur non transitoire, ne pas retenter
                    return Err(e);
                }

                last_error = Some(e);

                if attempt < config.max_attempts {
                    let delay = Duration::from_millis(delay_ms.min(config.max_delay_ms));
                    log::warn!("Tentative {} échouée, retry dans {:?}", attempt, delay);
                    sleep(delay).await;
                    delay_ms = (delay_ms as f64 * config.multiplier) as u64;
                }
            }
        }
    }

    // Toutes les tentatives ont échoué
    Err(last_error.expect("Au moins une erreur devrait exister"))
}

/// Helper pour retry simple avec config par défaut
pub async fn retry<F, T, E>(operation: F) -> Result<T, E>
where
    F: FnMut() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, E>> + Send>>,
    E: IsTransientError + std::fmt::Debug,
{
    retry_with_backoff(operation, RetryConfig::default()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug)]
    struct TestError {
        transient: bool,
    }

    impl IsTransientError for TestError {
        fn is_transient(&self) -> bool {
            self.transient
        }
    }

    #[tokio::test]
    async fn test_retry_success() {
        let mut attempts = 0;
        let result: Result<i32, TestError> = retry(|| {
            attempts += 1;
            Box::pin(async move {
                if attempts < 2 {
                    Err(TestError { transient: true })
                } else {
                    Ok(42)
                }
            })
        })
        .await;

        assert!(result.is_ok());
        assert_eq!(attempts, 2);
    }

    #[tokio::test]
    async fn test_retry_non_transient() {
        let mut attempts = 0;
        let result: Result<(), TestError> = retry(|| {
            attempts += 1;
            Box::pin(async move { Err(TestError { transient: false }) })
        })
        .await;

        assert!(result.is_err());
        assert_eq!(attempts, 1); // Ne devrait retenter qu'une fois
    }
}
