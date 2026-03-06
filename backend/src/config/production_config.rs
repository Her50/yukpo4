// Configuration de production
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageOptimizationConfig {
    pub max_size: u32,
    pub quality: f32,
    pub parallel_processing: bool,
}

impl Default for ImageOptimizationConfig {
    fn default() -> Self {
        Self {
            max_size: 1920,
            quality: 0.85,
            parallel_processing: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiTimeoutsConfig {
    pub multimodal: u64,
}

impl Default for ApiTimeoutsConfig {
    fn default() -> Self {
        Self { multimodal: 60 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionConfig {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub openai_api_key: String,
    pub environment: String,
    pub log_level: String,
    pub gpu_enabled: bool,
    pub image_optimization: ImageOptimizationConfig,
    pub api_timeouts: ApiTimeoutsConfig,
}

impl Default for ProductionConfig {
    fn default() -> Self {
        // Détection GPU via variables d'environnement
        let gpu_enabled = std::env::var("GPU_AVAILABLE")
            .unwrap_or_else(|_| "false".to_string())
            .parse::<bool>()
            .unwrap_or_else(|_| {
                // Fallback: vérifier CUDA_VISIBLE_DEVICES ou NVIDIA_VISIBLE_DEVICES
                std::env::var("CUDA_VISIBLE_DEVICES").is_ok()
                    || std::env::var("NVIDIA_VISIBLE_DEVICES").is_ok()
            });

        // En Cloud Run, les secrets peuvent être montés dans /secrets/
        let database_url = if let Ok(url) = std::env::var("DATABASE_URL") {
            url
        } else if let Ok(content) = std::fs::read_to_string("/secrets/database-url/DATABASE_URL") {
            content
        } else if let Ok(content) = std::fs::read_to_string("/secrets/database-url/value") {
            content
        } else {
            Default::default()
        };

        let redis_url = if let Ok(url) = std::env::var("REDIS_URL") {
            url
        } else if let Ok(content) = std::fs::read_to_string("/secrets/redis-url/REDIS_URL") {
            content
        } else if let Ok(content) = std::fs::read_to_string("/secrets/redis-url/value") {
            content
        } else {
            Default::default()
        };

        let jwt_secret = if let Ok(secret) = std::env::var("JWT_SECRET") {
            secret
        } else if let Ok(content) = std::fs::read_to_string("/secrets/jwt-secret/JWT_SECRET") {
            content
        } else if let Ok(content) = std::fs::read_to_string("/secrets/jwt-secret/value") {
            content
        } else {
            Default::default()
        };

        Self {
            database_url,
            redis_url,
            jwt_secret,
            openai_api_key: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
            environment: std::env::var("ENVIRONMENT").unwrap_or_else(|_| "production".to_string()),
            log_level: std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
            gpu_enabled,
            image_optimization: ImageOptimizationConfig::default(),
            api_timeouts: ApiTimeoutsConfig::default(),
        }
    }
}

impl ProductionConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get_optimization_info(&self) -> String {
        format!(
            "GPU: {}, MaxSize: {}px, Quality: {}, Parallel: {}",
            if self.gpu_enabled {
                "Enabled"
            } else {
                "Disabled"
            },
            self.image_optimization.max_size,
            self.image_optimization.quality,
            if self.image_optimization.parallel_processing {
                "Yes"
            } else {
                "No"
            }
        )
    }
}
