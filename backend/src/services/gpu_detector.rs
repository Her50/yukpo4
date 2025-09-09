use std::env;

/// ?? D?tecteur GPU r?trocompatible pour local et production
pub struct GPUDetector {
    pub has_gpu: bool,
    pub gpu_type: Option<String>,
    pub cuda_available: bool,
    pub memory_gb: Option<u32>,
}

impl GPUDetector {
    pub fn new() -> Self {
        // D?tection automatique de l'environnement
        let has_gpu = env::var("CUDA_VISIBLE_DEVICES").is_ok() || 
                     env::var("GPU_AVAILABLE").is_ok() ||
                     env::var("NVIDIA_VISIBLE_DEVICES").is_ok();
        
        let gpu_type = env::var("GPU_TYPE").ok()
            .or_else(|| if has_gpu { Some("nvidia".to_string()) } else { None });
        
        let cuda_available = env::var("CUDA_HOME").is_ok() || 
                            env::var("CUDA_PATH").is_ok() ||
                            has_gpu;
        
        let memory_gb = env::var("GPU_MEMORY_GB")
            .ok()
            .and_then(|s| s.parse::<u32>().ok());

        Self {
            has_gpu,
            gpu_type,
            cuda_available,
            memory_gb,
        }
    }
    
    pub fn is_gpu_available(&self) -> bool {
        self.has_gpu && self.cuda_available
    }
    
    pub fn get_gpu_info(&self) -> String {
        if self.is_gpu_available() {
            format!("GPU {} ({}GB)", 
                self.gpu_type.as_deref().unwrap_or("unknown"),
                self.memory_gb.unwrap_or(0))
        } else {
            "CPU only".to_string()
        }
    }
    
    pub fn is_production_environment(&self) -> bool {
        env::var("RUST_ENV").unwrap_or_default() == "production" ||
        env::var("ENVIRONMENT").unwrap_or_default() == "production"
    }
}

impl Default for GPUDetector {
    fn default() -> Self {
        Self::new()
    }
} 
