use std::env;

#[derive(Debug, Clone)]
pub enum PremiumAudioProvider {
    Dolby,
    AudioShake,
    Custom,
}

#[derive(Debug, Clone)]
pub struct PremiumAudioConfig {
    pub enabled: bool,
    pub provider: PremiumAudioProvider,
    pub endpoint: String,
    pub api_key: String,
    pub poll_interval_ms: u64,
}

impl PremiumAudioConfig {
    pub fn from_env() -> Option<Self> {
        let endpoint = env::var("PREMIUM_AUDIO_ENDPOINT").ok()?;
        let api_key = env::var("PREMIUM_AUDIO_API_KEY").ok()?;

        let enabled = env::var("PREMIUM_AUDIO_ENABLED")
            .ok()
            .and_then(|raw| raw.parse::<bool>().ok())
            .unwrap_or(true);

        if !enabled {
            return None;
        }

        let provider = env::var("PREMIUM_AUDIO_PROVIDER")
            .ok()
            .and_then(|raw| match raw.to_lowercase().as_str() {
                "dolby" => Some(PremiumAudioProvider::Dolby),
                "audioshake" => Some(PremiumAudioProvider::AudioShake),
                "custom" => Some(PremiumAudioProvider::Custom),
                _ => None,
            })
            .unwrap_or(PremiumAudioProvider::Dolby);

        let poll_interval_ms = env::var("PREMIUM_AUDIO_POLL_INTERVAL_MS")
            .ok()
            .and_then(|raw| raw.parse::<u64>().ok())
            .unwrap_or(3_000);

        Some(Self {
            enabled: true,
            provider,
            endpoint,
            api_key,
            poll_interval_ms,
        })
    }
}
