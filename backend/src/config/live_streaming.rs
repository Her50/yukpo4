use std::env;

#[derive(Clone, Debug)]
pub struct LiveStreamingConfig {
    pub livekit_api_url: Option<String>,
    pub livekit_ws_url: Option<String>,
    pub livekit_api_key: Option<String>,
    pub livekit_api_secret: Option<String>,
    pub livekit_hls_base_url: Option<String>,
    pub livekit_ingress_type: LiveKitIngressMode,
    pub srs_rtmp_url: Option<String>,
    pub srs_hls_url: Option<String>,
    pub fallback_enabled: bool,
    pub default_room_ttl_seconds: u64,
    pub recording_enabled: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LiveKitIngressMode {
    WebRtc,
    Rtmp,
}

impl LiveStreamingConfig {
    pub fn from_env() -> Self {
        let livekit_api_url = env::var("LIVEKIT_API_URL").ok();
        let livekit_ws_url = env::var("LIVEKIT_WS_URL").ok();
        let livekit_api_key = env::var("LIVEKIT_API_KEY").ok();
        let livekit_api_secret = env::var("LIVEKIT_API_SECRET").ok();
        let livekit_hls_base_url = env::var("LIVEKIT_HLS_URL").ok();

        let ingress_mode = env::var("LIVEKIT_INGRESS_MODE")
            .ok()
            .and_then(|raw| match raw.to_lowercase().as_str() {
                "rtmp" => Some(LiveKitIngressMode::Rtmp),
                "webrtc" => Some(LiveKitIngressMode::WebRtc),
                _ => None,
            })
            .unwrap_or(LiveKitIngressMode::Rtmp);

        let srs_rtmp_url = env::var("SRS_RTMP_URL").ok();
        let srs_hls_url = env::var("SRS_HLS_URL").ok();

        let fallback_enabled = env::var("LIVE_FALLBACK_ENABLED")
            .ok()
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(true);

        let default_room_ttl_seconds = env::var("LIVEKIT_ROOM_TTL_SECONDS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(2 * 60 * 60);

        let recording_enabled = env::var("LIVE_RECORDING_ENABLED")
            .ok()
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(true);

        LiveStreamingConfig {
            livekit_api_url,
            livekit_ws_url,
            livekit_api_key,
            livekit_api_secret,
            livekit_hls_base_url,
            livekit_ingress_type: ingress_mode,
            srs_rtmp_url,
            srs_hls_url,
            fallback_enabled,
            default_room_ttl_seconds,
            recording_enabled,
        }
    }

    pub fn is_livekit_enabled(&self) -> bool {
        self.livekit_api_url.is_some()
            && self.livekit_api_key.is_some()
            && self.livekit_api_secret.is_some()
    }

    /// Valide la configuration LiveKit et retourne un message d'erreur si incohérente
    pub fn validate(&self) -> Result<(), String> {
        let has_api_url = self.livekit_api_url.is_some();
        let has_api_key = self.livekit_api_key.is_some();
        let has_api_secret = self.livekit_api_secret.is_some();

        // Si aucune variable n'est définie, c'est OK (LiveKit désactivé)
        if !has_api_url && !has_api_key && !has_api_secret {
            return Ok(());
        }

        // Si certaines variables sont définies mais pas toutes, c'est une erreur
        if has_api_url && (!has_api_key || !has_api_secret) {
            return Err(
                "LIVEKIT_API_URL est défini mais LIVEKIT_API_KEY ou LIVEKIT_API_SECRET manquent"
                    .to_string(),
            );
        }

        if has_api_key && (!has_api_url || !has_api_secret) {
            return Err(
                "LIVEKIT_API_KEY est défini mais LIVEKIT_API_URL ou LIVEKIT_API_SECRET manquent"
                    .to_string(),
            );
        }

        if has_api_secret && (!has_api_url || !has_api_key) {
            return Err(
                "LIVEKIT_API_SECRET est défini mais LIVEKIT_API_URL ou LIVEKIT_API_KEY manquent"
                    .to_string(),
            );
        }

        // Valider le format de l'URL
        if let Some(ref url) = self.livekit_api_url {
            if !url.starts_with("http://") && !url.starts_with("https://") {
                return Err(format!(
                    "LIVEKIT_API_URL doit commencer par http:// ou https://, reçu: {}",
                    url.chars().take(50).collect::<String>()
                ));
            }
        }

        Ok(())
    }
}
