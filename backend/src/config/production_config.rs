use crate::services::gpu_detector::GPUDetector;
use serde::{Deserialize, Serialize};

/// ?? Configuration adaptative pour local et production
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionConfig {
    pub gpu_enabled: bool,
    pub image_optimization: ImageOptimizationConfig,
    pub api_timeouts: APITimeoutConfig,
    pub cache_config: CacheConfig,
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageOptimizationConfig {
    pub max_size: u32,
    pub quality: f32,
    pub parallel_processing: bool,
    pub compression_level: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct APITimeoutConfig {
    pub multimodal: u64,
    pub text_only: u64,
    pub retry_count: u32,
    pub retry_delay_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub enabled: bool,
    pub ttl_seconds: u64,
    pub max_size_mb: u64,
    pub distributed: bool,
}

impl ProductionConfig {
    pub fn new() -> Self {
        let gpu_detector = GPUDetector::new();
        let is_production = gpu_detector.is_production_environment();
        
        log::info!("[ProductionConfig] Environnement d?tect?: {}", 
                  if is_production { "PRODUCTION" } else { "LOCAL" });
        log::info!("[ProductionConfig] GPU: {}", gpu_detector.get_gpu_info());
        
        Self {
            gpu_enabled: gpu_detector.is_gpu_available(),
            image_optimization: ImageOptimizationConfig {
                max_size: if gpu_detector.is_gpu_available() { 2048 } else { 1024 },
                quality: if gpu_detector.is_gpu_available() { 0.9 } else { 0.8 },
                parallel_processing: gpu_detector.is_gpu_available(),
                compression_level: if gpu_detector.is_gpu_available() { 8 } else { 6 },
            },
            api_timeouts: APITimeoutConfig {
                multimodal: if gpu_detector.is_gpu_available() { 10 } else { 30 },
                text_only: if gpu_detector.is_gpu_available() { 5 } else { 15 },
                retry_count: if gpu_detector.is_gpu_available() { 2 } else { 3 },
                retry_delay_ms: if gpu_detector.is_gpu_available() { 100 } else { 200 },
            },
            cache_config: CacheConfig {
                enabled: true,
                ttl_seconds: if is_production { 3600 } else { 1800 },
                max_size_mb: if is_production { 1024 } else { 256 },
                distributed: is_production,
            },
            environment: if is_production { "production".to_string() } else { "local".to_string() },
        }
    }
    
    pub fn is_gpu_available(&self) -> bool {
        self.gpu_enabled
    }
    
    pub fn is_production(&self) -> bool {
        self.environment == "production"
    }
    
    pub fn get_optimization_info(&self) -> String {
        format!(
            "GPU: {}, MaxSize: {}px, Quality: {}, Parallel: {}, Timeout: {}s",
            if self.gpu_enabled { "ON" } else { "OFF" },
            self.image_optimization.max_size,
            self.image_optimization.quality,
            if self.image_optimization.parallel_processing { "YES" } else { "NO" },
            self.api_timeouts.multimodal
        )
    }
}

impl Default for ProductionConfig {
    fn default() -> Self {
        Self::new()
    }
} 
