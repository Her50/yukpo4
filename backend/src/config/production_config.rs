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
        Self {
            multimodal: 60,
        }
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
        Self {
            database_url: std::env::var("DATABASE_URL").unwrap_or_default(),
            redis_url: std::env::var("REDIS_URL").unwrap_or_default(),
            jwt_secret: std::env::var("JWT_SECRET").unwrap_or_default(),
            openai_api_key: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
            environment: std::env::var("ENVIRONMENT").unwrap_or_else(|_| "production".to_string()),
            log_level: std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
            gpu_enabled: true,
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
            if self.gpu_enabled { "Enabled" } else { "Disabled" },
            self.image_optimization.max_size,
            self.image_optimization.quality,
            if self.image_optimization.parallel_processing { "Yes" } else { "No" }
        )
    }
}