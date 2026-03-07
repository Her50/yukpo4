use std::collections::HashMap;

use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::Value;

/// Ensemble de flags connus utilisés par l'application.
///
/// L'objectif est de garder une liste centralisée, même si la résolution
/// réelle se fait via variables d'environnement ou configuration externe.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KnownFlag {
    /// Active / désactive le worker GPU vidéo (Remotion).
    GpuWorker,
    /// Active les connecteurs LiveKit / live streaming avancé.
    ConnectorsLivekit,
    /// Active la v2 de la livraison (nouveaux écrans / API).
    DeliveryV2,
    /// Active les campagnes globales de promotion.
    GlobalPromos,
}

impl KnownFlag {
    pub fn as_key(&self) -> &'static str {
        match self {
            KnownFlag::GpuWorker => "gpu_worker",
            KnownFlag::ConnectorsLivekit => "connectors_livekit",
            KnownFlag::DeliveryV2 => "delivery_v2",
            KnownFlag::GlobalPromos => "global_promos",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct FeatureFlagConfig {
    /// Flags booléens simples, typiquement issus de `FEATURE_FLAGS_JSON`.
    pub flags: HashMap<String, bool>,
    /// Payloads optionnels pour certains flags (configuration avancée).
    #[serde(default)]
    pub metadata: HashMap<String, Value>,
}

static DEFAULT_FLAGS: Lazy<FeatureFlagConfig> = Lazy::new(|| FeatureFlagConfig {
    flags: HashMap::new(),
    metadata: HashMap::new(),
});

#[derive(Debug, Clone)]
pub struct FeatureFlagService {
    inner: FeatureFlagConfig,
}

impl FeatureFlagService {
    /// Construit le service à partir de l'environnement.
    ///
    /// Stratégie :
    /// 1. si `FEATURE_FLAGS_JSON` est présent, on le parse comme JSON
    /// 2. sinon, on lit les variables `FEATURE_FLAG_<NAME>=true|false`
    pub fn from_env() -> Self {
        let json = std::env::var("FEATURE_FLAGS_JSON").ok();
        if let Some(raw) = json {
            match serde_json::from_str::<FeatureFlagConfig>(&raw) {
                Ok(cfg) => return FeatureFlagService { inner: cfg },
                Err(err) => {
                    log::warn!(
                        "Impossible de parser FEATURE_FLAGS_JSON, fallback sur flags individuels: {err}"
                    );
                }
            }
        }

        let mut flags = HashMap::new();

        for (key, value) in std::env::vars() {
            if let Some(rest) = key.strip_prefix("FEATURE_FLAG_") {
                let normalized = rest.to_ascii_lowercase();
                let enabled = matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "yes");
                flags.insert(normalized, enabled);
            }
        }

        FeatureFlagService {
            inner: FeatureFlagConfig {
                flags,
                metadata: DEFAULT_FLAGS.metadata.clone(),
            },
        }
    }

    pub fn is_enabled_key(&self, key: &str) -> bool {
        // ✅ CORRIGÉ: GlobalPromos activé par défaut pour éviter le blocage du catalogue Black Friday
        let default_value = key == KnownFlag::GlobalPromos.as_key();
        self.inner.flags.get(key).copied().unwrap_or(default_value)
    }

    pub fn is_enabled(&self, flag: KnownFlag) -> bool {
        self.is_enabled_key(flag.as_key())
    }
}
