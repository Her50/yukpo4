use std::env;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PremiumAudioProvider {
    Dolby,
    AudioShake,
    Auphonic,
    Dual,
}

#[derive(Debug, Clone)]
pub struct DolbyConfig {
    pub base_url: String,
    pub api_key: String,
    pub api_secret: String,
    pub preset: Option<String>,
    pub webhook_secret: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AudioShakeConfig {
    pub base_url: String,
    pub api_key: String,
    pub enable_stems: bool,
    pub stems: Vec<String>,
    pub webhook_secret: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AuphonicConfig {
    pub base_url: String,
    pub username: String,
    pub api_key: String,
    pub preset: Option<String>,
    pub format: Option<String>,
    pub webhook_secret: Option<String>,
    pub poll_interval_secs: u64,
}

#[derive(Debug, Clone)]
pub struct PremiumAudioConfig {
    pub enabled: bool,
    pub provider: PremiumAudioProvider,
    pub timeout_secs: u64,
    pub max_retries: u32,
    pub webhook_secret: Option<String>,
    pub storage_prefix: String,
    pub keep_local_copy: bool,
    pub dolby: Option<DolbyConfig>,
    pub audioshake: Option<AudioShakeConfig>,
    pub auphonic: Option<AuphonicConfig>,
}

impl PremiumAudioConfig {
    pub fn from_env() -> Option<Self> {
        let enabled = env_bool("PREMIUM_AUDIO_ENABLED", false);
        if !enabled {
            return None;
        }

        let provider_raw = env::var("PREMIUM_AUDIO_PROVIDER")
            .unwrap_or_else(|_| "dolby".to_string())
            .to_lowercase();

        let provider = match provider_raw.as_str() {
            "dolby" => PremiumAudioProvider::Dolby,
            "audioshake" => PremiumAudioProvider::AudioShake,
            "auphonic" => PremiumAudioProvider::Auphonic,
            "dual" => PremiumAudioProvider::Dual,
            other => {
                log::warn!(
                    "[PremiumAudioConfig] Provider inconnu '{}', fallback Dolby",
                    other
                );
                PremiumAudioProvider::Dolby
            }
        };

        let timeout_secs = env::var("PREMIUM_AUDIO_TIMEOUT_SECS")
            .ok()
            .and_then(|raw| raw.parse::<u64>().ok())
            .unwrap_or(900);

        let max_retries = env::var("PREMIUM_AUDIO_MAX_RETRIES")
            .ok()
            .and_then(|raw| raw.parse::<u32>().ok())
            .unwrap_or(3);

        let webhook_secret = env::var("PREMIUM_AUDIO_WEBHOOK_SECRET").ok();
        let storage_prefix = env::var("PREMIUM_AUDIO_STORAGE_PREFIX")
            .unwrap_or_else(|_| "services/audio/masters".to_string());
        let keep_local_copy = env_bool("PREMIUM_AUDIO_KEEP_LOCAL_COPY", false);

        let dolby = DolbyConfig::from_env();
        let audioshake = AudioShakeConfig::from_env();
        let auphonic = AuphonicConfig::from_env();

        match provider {
            PremiumAudioProvider::Dolby => {
                if dolby.is_none() {
                    log::warn!(
                        "[PremiumAudioConfig] Provider Dolby sélectionné mais configuration incomplète."
                    );
                    return None;
                }
            }
            PremiumAudioProvider::AudioShake => {
                if audioshake.is_none() {
                    log::warn!(
                        "[PremiumAudioConfig] Provider AudioShake sélectionné mais configuration incomplète."
                    );
                    return None;
                }
            }
            PremiumAudioProvider::Auphonic => {
                if auphonic.is_none() {
                    log::warn!(
                        "[PremiumAudioConfig] Provider Auphonic sélectionné mais configuration incomplète."
                    );
                    return None;
                }
            }
            PremiumAudioProvider::Dual => {
                if dolby.is_none() && audioshake.is_none() && auphonic.is_none() {
                    log::warn!("[PremiumAudioConfig] Mode dual requis, aucun provider configuré.");
                    return None;
                }
            }
        }

        Some(Self {
            enabled: true,
            provider,
            timeout_secs,
            max_retries,
            webhook_secret,
            storage_prefix,
            keep_local_copy,
            dolby,
            audioshake,
            auphonic,
        })
    }
}

impl DolbyConfig {
    fn from_env() -> Option<Self> {
        let api_key = env::var("DOLBY_API_KEY").ok()?;
        let api_secret = env::var("DOLBY_API_SECRET").ok()?;
        let base_url =
            env::var("DOLBY_BASE_URL").unwrap_or_else(|_| "https://api.dolby.com".into());
        let preset = env::var("DOLBY_ENHANCE_PRESET")
            .ok()
            .filter(|v| !v.is_empty());
        let webhook_secret = env::var("DOLBY_WEBHOOK_SIGNATURE_SECRET").ok();

        Some(Self {
            base_url,
            api_key,
            api_secret,
            preset,
            webhook_secret,
        })
    }
}

impl AudioShakeConfig {
    fn from_env() -> Option<Self> {
        let api_key = env::var("AUDIOSHAKE_API_KEY").ok()?;
        let base_url =
            env::var("AUDIOSHAKE_BASE_URL").unwrap_or_else(|_| "https://api.audioshake.ai".into());
        let enable_stems = env_bool("AUDIOSHAKE_ENABLE_STEMS", false);
        let stems = env::var("AUDIOSHAKE_STEMS")
            .unwrap_or_else(|_| "vocals".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>();
        let webhook_secret = env::var("AUDIOSHAKE_WEBHOOK_SECRET").ok();

        Some(Self {
            base_url,
            api_key,
            enable_stems,
            stems,
            webhook_secret,
        })
    }
}

impl AuphonicConfig {
    fn from_env() -> Option<Self> {
        let username = env::var("AUPHONIC_USERNAME").ok()?;
        let api_key = env::var("AUPHONIC_API_KEY").ok()?;
        let base_url =
            env::var("AUPHONIC_BASE_URL").unwrap_or_else(|_| "https://api.auphonic.com".into());
        let preset = env::var("AUPHONIC_PRESET").ok().filter(|v| !v.is_empty());
        let format = env::var("AUPHONIC_OUTPUT_FORMAT")
            .ok()
            .filter(|v| !v.is_empty());
        let webhook_secret = env::var("AUPHONIC_WEBHOOK_SECRET").ok();
        let poll_interval_secs = env::var("AUPHONIC_POLL_INTERVAL_SECS")
            .ok()
            .and_then(|raw| raw.parse::<u64>().ok())
            .unwrap_or(5);

        Some(Self {
            base_url,
            username,
            api_key,
            preset,
            format,
            webhook_secret,
            poll_interval_secs,
        })
    }
}

fn env_bool(name: &str, default: bool) -> bool {
    env::var(name)
        .ok()
        .and_then(|raw| {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                None
            } else {
                trimmed.parse::<bool>().ok()
            }
        })
        .unwrap_or(default)
}
