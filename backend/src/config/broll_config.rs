use std::env;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct BrollAIProviderConfig {
    pub runway_endpoint: Option<String>,
    pub runway_api_key: Option<String>,
    pub pika_endpoint: Option<String>,
    pub pika_api_key: Option<String>,
    pub sora_endpoint: Option<String>,
    pub sora_api_key: Option<String>,
}

#[derive(Debug, Clone)]
pub struct BrollCacheConfig {
    pub enabled: bool,
    pub ttl: Duration,
}

#[derive(Debug, Clone)]
pub struct BrollConfig {
    pub stock_api_url: Option<String>,
    pub stock_api_key: Option<String>,
    pub download_dir: String,
    pub cache: BrollCacheConfig,
    pub ai: BrollAIProviderConfig,
}

impl BrollConfig {
    pub fn from_env() -> Self {
        let stock_api_url = env::var("STOCK_VIDEO_API_URL").ok();
        let stock_api_key = env::var("STOCK_VIDEO_API_KEY").ok();

        let download_dir =
            env::var("BROLL_DOWNLOAD_DIR").unwrap_or_else(|_| "storage/broll".to_string());

        let cache_ttl_secs = env::var("BROLL_CACHE_TTL_SECS")
            .ok()
            .and_then(|raw| raw.parse::<u64>().ok())
            .unwrap_or(86_400);

        let cache_enabled = env::var("BROLL_CACHE_ENABLED")
            .ok()
            .and_then(|raw| raw.parse::<bool>().ok())
            .unwrap_or(true);

        let ai = BrollAIProviderConfig {
            runway_endpoint: env::var("RUNWAY_API_URL").ok(),
            runway_api_key: env::var("RUNWAY_API_KEY").ok(),
            pika_endpoint: env::var("PIKA_API_URL").ok(),
            pika_api_key: env::var("PIKA_API_KEY").ok(),
            sora_endpoint: env::var("SORA_API_URL").ok(),
            sora_api_key: env::var("SORA_API_KEY").ok(),
        };

        Self {
            stock_api_url,
            stock_api_key,
            download_dir,
            cache: BrollCacheConfig {
                enabled: cache_enabled,
                ttl: Duration::from_secs(cache_ttl_secs.max(60)),
            },
            ai,
        }
    }
}
