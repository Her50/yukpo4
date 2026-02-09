// ✅ NOUVEAU: Service de fallback pour rendu vidéo si device utilisateur trop faible

use crate::core::types::AppResult;
use log::info;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCapabilities {
    pub gpu_available: bool,
    pub hardware_encoding: bool,
    pub memory_gb: Option<f64>,
    pub cpu_cores: Option<u32>,
    pub device_model: Option<String>,
    pub os_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderFallbackRequest {
    pub device_capabilities: DeviceCapabilities,
    pub video_duration: f64,      // secondes
    pub timeline_complexity: f64, // Score de complexité (0.0 à 1.0)
    pub effects_count: u32,
    pub resolution: Option<(u32, u32)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderFallbackResponse {
    pub should_use_backend: bool,
    pub reason: String,
    pub estimated_backend_time: Option<u64>, // secondes
    pub estimated_local_time: Option<u64>,   // secondes
}

pub struct RenderFallbackService;

impl Default for RenderFallbackService {
    fn default() -> Self {
        Self::new()
    }
}

impl RenderFallbackService {
    pub fn new() -> Self {
        Self
    }

    /// Détermine si le rendu doit être fait sur le backend ou localement
    pub fn should_use_backend(
        &self,
        request: RenderFallbackRequest,
    ) -> AppResult<RenderFallbackResponse> {
        info!(
            "[RenderFallback] Évaluation device - GPU: {}, Hardware: {}, Memory: {:?}GB",
            request.device_capabilities.gpu_available,
            request.device_capabilities.hardware_encoding,
            request.device_capabilities.memory_gb
        );

        let mut reasons = Vec::new();
        let mut should_use_backend = false;

        // Critère 1: Pas de GPU
        if !request.device_capabilities.gpu_available {
            should_use_backend = true;
            reasons.push("GPU non disponible".to_string());
        }

        // Critère 2: Pas d'encodage hardware
        if !request.device_capabilities.hardware_encoding {
            reasons.push("Encodage hardware non disponible".to_string());
            // Pas forcément bloquant, mais pénalise
        }

        // Critère 3: Mémoire insuffisante (< 2GB)
        if let Some(memory) = request.device_capabilities.memory_gb {
            if memory < 2.0 {
                should_use_backend = true;
                reasons.push(format!("Mémoire insuffisante ({:.1}GB < 2GB)", memory));
            }
        }

        // Critère 4: Vidéo trop longue (> 60 secondes)
        if request.video_duration > 60.0 {
            reasons.push(format!(
                "Vidéo trop longue ({:.1}s > 60s)",
                request.video_duration
            ));
            // Recommandation backend mais pas forcé
        }

        // Critère 5: Complexité élevée (> 0.7)
        if request.timeline_complexity > 0.7 {
            reasons.push(format!(
                "Complexité élevée ({:.2} > 0.7)",
                request.timeline_complexity
            ));
        }

        // Critère 6: Trop d'effets (> 10)
        if request.effects_count > 10 {
            reasons.push(format!("Trop d'effets ({} > 10)", request.effects_count));
        }

        // Critère 7: Résolution élevée (> 1080p)
        if let Some((width, height)) = request.resolution {
            if width > 1920 || height > 1080 {
                reasons.push(format!("Résolution élevée ({}x{} > 1080p)", width, height));
            }
        }

        // Calculer temps estimés
        let estimated_local_time = self.estimate_local_render_time(&request);
        let estimated_backend_time = self.estimate_backend_render_time(&request);

        let reason = if reasons.is_empty() {
            "Device capable de rendu local".to_string()
        } else {
            reasons.join(", ")
        };

        info!(
            "[RenderFallback] Décision: {} - Raison: {}",
            if should_use_backend {
                "Backend"
            } else {
                "Local"
            },
            reason
        );

        Ok(RenderFallbackResponse {
            should_use_backend,
            reason,
            estimated_backend_time: Some(estimated_backend_time),
            estimated_local_time: Some(estimated_local_time),
        })
    }

    /// Estime le temps de rendu local (secondes)
    fn estimate_local_render_time(&self, request: &RenderFallbackRequest) -> u64 {
        let base_time = request.video_duration * 2.0; // 2x la durée vidéo en base
        let complexity_multiplier = 1.0 + (request.timeline_complexity * 0.5);
        let effects_multiplier = 1.0 + (request.effects_count as f64 * 0.1);

        let estimated = base_time * complexity_multiplier * effects_multiplier;

        // Ajuster selon capacités device
        let device_multiplier = if !request.device_capabilities.gpu_available {
            3.0 // 3x plus lent sans GPU
        } else if !request.device_capabilities.hardware_encoding {
            1.5 // 1.5x plus lent sans hardware encoding
        } else {
            1.0
        };

        (estimated * device_multiplier) as u64
    }

    /// Estime le temps de rendu backend (secondes)
    fn estimate_backend_render_time(&self, request: &RenderFallbackRequest) -> u64 {
        let base_time = request.video_duration * 0.5; // Backend plus rapide (0.5x)
        let complexity_multiplier = 1.0 + (request.timeline_complexity * 0.3);
        let effects_multiplier = 1.0 + (request.effects_count as f64 * 0.05);

        let estimated = base_time * complexity_multiplier * effects_multiplier;

        // Minimum 5 secondes
        estimated.max(5.0) as u64
    }

    /// Vérifie si un device est capable de rendu local
    pub fn is_device_capable(capabilities: &DeviceCapabilities) -> bool {
        capabilities.gpu_available && capabilities.memory_gb.map(|m| m >= 2.0).unwrap_or(true)
    }
}
