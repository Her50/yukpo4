use log::{error, info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

const CACHE_TTL_SECS: u64 = 24 * 60 * 60; // 24 hours
const API_TIMEOUT_SECS: u64 = 10;

// ExchangeRate-API (open/free plan): 1500 req/month, no key needed, supports all African currencies
const EXCHANGERATE_API_URL: &str = "https://open.er-api.com/v6/latest/XAF";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeRates {
    pub base: String,                // "XAF"
    pub rates: HashMap<String, f64>, // 1 XAF = N foreign currency
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub source: String, // "api" or "fallback"
}

struct CacheEntry {
    rates_to_xaf: HashMap<String, f64>, // 1 foreign = N XAF (inverse of API)
    raw_rates: HashMap<String, f64>,    // 1 XAF = N foreign (from API)
    fetched_at: Instant,
    updated_at: chrono::DateTime<chrono::Utc>,
    source: String,
}

pub struct ExchangeRateService {
    client: Client,
    cache: Arc<RwLock<Option<CacheEntry>>>,
}

impl ExchangeRateService {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(API_TIMEOUT_SECS))
            .build()
            .expect("Failed to create HTTP client for exchange rates");

        Self {
            client,
            cache: Arc::new(RwLock::new(None)),
        }
    }

    /// Get exchange rate: 1 unit of `currency` = N XAF
    /// Uses live API with in-memory cache (24h TTL), falls back to static rates
    pub async fn rate_to_xaf(&self, currency: &str) -> f64 {
        let upper = currency.to_uppercase();

        // Fixed parities (never change)
        match upper.as_str() {
            "XAF" => return 1.0,
            "XOF" => return 1.0,
            "EUR" => return 655.957,
            _ => {}
        }

        // Try cache first
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.as_ref() {
                if entry.fetched_at.elapsed() < Duration::from_secs(CACHE_TTL_SECS) {
                    if let Some(&rate) = entry.rates_to_xaf.get(&upper) {
                        return rate;
                    }
                }
            }
        }

        // Cache miss or expired: refresh
        if let Err(e) = self.refresh_rates().await {
            warn!(
                "[ExchangeRateService] API refresh failed: {}, using fallback",
                e
            );
        }

        // Try cache again after refresh
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.as_ref() {
                if let Some(&rate) = entry.rates_to_xaf.get(&upper) {
                    return rate;
                }
            }
        }

        // Final fallback: static rates
        static_rate_to_xaf(&upper)
    }

    /// Get all rates for mobile display
    pub async fn get_all_rates(&self) -> ExchangeRates {
        // Ensure cache is fresh
        {
            let cache = self.cache.read().await;
            let needs_refresh = match cache.as_ref() {
                Some(entry) => entry.fetched_at.elapsed() >= Duration::from_secs(CACHE_TTL_SECS),
                None => true,
            };
            if needs_refresh {
                drop(cache);
                let _ = self.refresh_rates().await;
            }
        }

        let cache = self.cache.read().await;
        match cache.as_ref() {
            Some(entry) => ExchangeRates {
                base: "XAF".to_string(),
                rates: entry.raw_rates.clone(),
                updated_at: entry.updated_at,
                source: entry.source.clone(),
            },
            None => ExchangeRates {
                base: "XAF".to_string(),
                rates: static_rates_map(),
                updated_at: chrono::Utc::now(),
                source: "fallback".to_string(),
            },
        }
    }

    /// Convert amount from source currency to XAF
    pub async fn convert_to_xaf(&self, amount: f64, source_currency: &str) -> i64 {
        let rate = self.rate_to_xaf(source_currency).await;
        (amount * rate).round() as i64
    }

    async fn refresh_rates(&self) -> Result<(), String> {
        info!("[ExchangeRateService] Fetching rates from ExchangeRate-API...");

        let response = self
            .client
            .get(EXCHANGERATE_API_URL)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("API returned status {}", response.status()));
        }

        let data: ApiResponse = response.json().await.map_err(|e| format!("Parse error: {}", e))?;

        if data.result != "success" {
            return Err(format!("API error: result={}", data.result));
        }

        // API returns: 1 XAF = N foreign currency
        // We need the inverse: 1 foreign = N XAF
        let mut rates_to_xaf = HashMap::new();
        let mut raw_rates = HashMap::new();

        for (currency, rate) in &data.rates {
            raw_rates.insert(currency.clone(), *rate);
            if *rate > 0.0 {
                rates_to_xaf.insert(currency.clone(), 1.0 / rate);
            }
        }
        // Ensure XAF is always 1:1
        rates_to_xaf.insert("XAF".to_string(), 1.0);
        raw_rates.insert("XAF".to_string(), 1.0);

        // Fixed parities
        rates_to_xaf.insert("XOF".to_string(), 1.0);
        rates_to_xaf.insert("EUR".to_string(), 655.957);
        raw_rates.insert("XOF".to_string(), 1.0);
        raw_rates.insert("EUR".to_string(), 1.0 / 655.957);

        let count = rates_to_xaf.len();
        let now = chrono::Utc::now();

        let mut cache = self.cache.write().await;
        *cache = Some(CacheEntry {
            rates_to_xaf,
            raw_rates,
            fetched_at: Instant::now(),
            updated_at: now,
            source: "api".to_string(),
        });

        info!(
            "[ExchangeRateService] Cached {} rates from API (TTL=24h)",
            count
        );
        Ok(())
    }

    /// Persist current rates to database for cold-start recovery
    pub async fn persist_to_db(&self, pool: &sqlx::PgPool) {
        let cache = self.cache.read().await;
        if let Some(entry) = cache.as_ref() {
            let rates_json = serde_json::to_value(&entry.raw_rates).unwrap_or_default();
            let _ = sqlx::query(
                r#"INSERT INTO exchange_rate_cache (base_currency, rates, source, fetched_at)
                   VALUES ('XAF', $1, $2, $3)
                   ON CONFLICT (base_currency) DO UPDATE SET
                       rates = $1, source = $2, fetched_at = $3"#,
            )
            .bind(&rates_json)
            .bind(&entry.source)
            .bind(entry.updated_at)
            .execute(pool)
            .await
            .map_err(|e| warn!("[ExchangeRateService] DB persist failed: {}", e));
        }
    }

    /// Load rates from database (for cold start when API is unreachable)
    pub async fn load_from_db(&self, pool: &sqlx::PgPool) {
        #[derive(sqlx::FromRow)]
        struct CachedRate {
            rates: serde_json::Value,
            source: String,
            fetched_at: chrono::DateTime<chrono::Utc>,
        }

        match sqlx::query_as::<_, CachedRate>(
            "SELECT rates, source, fetched_at FROM exchange_rate_cache WHERE base_currency = 'XAF'",
        )
        .fetch_optional(pool)
        .await
        {
            Ok(Some(row)) => {
                if let Ok(raw_rates) = serde_json::from_value::<HashMap<String, f64>>(row.rates) {
                    let mut rates_to_xaf = HashMap::new();
                    for (currency, rate) in &raw_rates {
                        if *rate > 0.0 {
                            rates_to_xaf.insert(currency.clone(), 1.0 / rate);
                        }
                    }
                    rates_to_xaf.insert("XAF".to_string(), 1.0);
                    rates_to_xaf.insert("XOF".to_string(), 1.0);
                    rates_to_xaf.insert("EUR".to_string(), 655.957);

                    let count = rates_to_xaf.len();
                    let mut cache = self.cache.write().await;
                    *cache = Some(CacheEntry {
                        rates_to_xaf,
                        raw_rates,
                        fetched_at: Instant::now(),
                        updated_at: row.fetched_at,
                        source: format!("db:{}", row.source),
                    });
                    info!("[ExchangeRateService] Loaded {} rates from DB cache", count);
                }
            }
            Ok(None) => {
                info!("[ExchangeRateService] No cached rates in DB, will fetch from API");
            }
            Err(e) => {
                warn!("[ExchangeRateService] DB load failed: {}", e);
            }
        }
    }
}

#[derive(Debug, Deserialize)]
struct ApiResponse {
    result: String,
    rates: HashMap<String, f64>,
}

/// Static fallback rates: 1 unit of currency = N XAF
/// Only used when API is unreachable AND no DB cache exists
fn static_rate_to_xaf(currency: &str) -> f64 {
    match currency {
        "XAF" => 1.0,
        "XOF" => 1.0,
        "EUR" => 655.957,
        "USD" => 610.0,
        "GBP" => 770.0,
        "NGN" => 0.40,
        "GHS" => 42.0,
        "GNF" => 0.070,
        "MRU" => 15.5,
        "KES" => 4.5,
        "TZS" => 0.24,
        "UGX" => 0.16,
        "RWF" => 0.46,
        "BIF" => 0.21,
        "ETB" => 5.0,
        "CDF" => 0.22,
        "ZAR" => 33.0,
        "MGA" => 0.13,
        "MAD" => 60.0,
        "DZD" => 4.5,
        "TND" => 195.0,
        "EGP" => 12.5,
        "CHF" => 690.0,
        "CAD" => 450.0,
        "BRL" => 120.0,
        "MXN" => 35.0,
        "INR" => 7.3,
        "CNY" => 84.0,
        "AED" => 166.0,
        "SAR" => 163.0,
        _ => {
            error!(
                "[ExchangeRateService] Unknown currency '{}', REJECTING (rate=0)",
                currency
            );
            0.0 // Return 0 instead of 1:1 to prevent silent miscrediting
        }
    }
}

fn static_rates_map() -> HashMap<String, f64> {
    let pairs = vec![
        ("XAF", 1.0),
        ("XOF", 1.0),
        ("EUR", 1.0 / 655.957),
        ("USD", 1.0 / 610.0),
        ("GBP", 1.0 / 770.0),
        ("NGN", 1.0 / 0.40),
        ("GHS", 1.0 / 42.0),
        ("KES", 1.0 / 4.5),
        ("TZS", 1.0 / 0.24),
        ("UGX", 1.0 / 0.16),
        ("RWF", 1.0 / 0.46),
        ("ZAR", 1.0 / 33.0),
        ("MAD", 1.0 / 60.0),
        ("EGP", 1.0 / 12.5),
        ("ETB", 1.0 / 5.0),
        ("CDF", 1.0 / 0.22),
    ];
    pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect()
}
