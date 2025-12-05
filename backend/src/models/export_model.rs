// ✅ NOUVEAU Phase 2.3: Modèle pour jobs d'export vidéo

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExportResolution {
    #[serde(rename = "720p")]
    P720,
    #[serde(rename = "1080p")]
    P1080,
    #[serde(rename = "2K")]
    K2,
    #[serde(rename = "4K")]
    K4,
    #[serde(rename = "8K")]
    K8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Mp4,
    Mov,
    Webm,
    Gif,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExportCodec {
    H264,
    H265,
    Prores,
    Vp9,
    #[serde(rename = "dnxhd")]
    DNxHD,
    #[serde(rename = "hdr10")]
    HDR10,
    #[serde(rename = "dolby_vision")]
    DolbyVision,
    #[serde(rename = "hlg")]
    HLG,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExportQuality {
    Low,
    Medium,
    High,
    Ultra,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BitrateMode {
    #[serde(rename = "cbr")]
    CBR, // Constant Bitrate
    #[serde(rename = "vbr")]
    VBR, // Variable Bitrate
    #[serde(rename = "abr")]
    ABR, // Adaptive Bitrate
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AspectRatio {
    #[serde(rename = "16:9")]
    R16_9,
    #[serde(rename = "9:16")]
    R9_16,
    #[serde(rename = "1:1")]
    R1_1,
    #[serde(rename = "4:5")]
    R4_5,
    #[serde(rename = "21:9")]
    R21_9,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettings {
    pub resolution: ExportResolution,
    pub format: ExportFormat,
    pub codec: ExportCodec,
    pub quality: ExportQuality,
    pub aspect_ratio: AspectRatio,
    pub fps: Option<u32>,
    pub bitrate: Option<u32>,              // kbps
    pub bitrate_mode: Option<BitrateMode>, // CBR, VBR, ABR
    pub watermark: Option<bool>,
    pub audio_bitrate: Option<u32>, // kbps
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExportStage {
    #[serde(rename = "preparing")]
    Preparing,
    #[serde(rename = "rendering")]
    Rendering,
    #[serde(rename = "encoding")]
    Encoding,
    #[serde(rename = "uploading")]
    Uploading,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "error")]
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProgress {
    pub progress: f32, // 0-100
    pub stage: ExportStage,
    pub message: Option<String>,
    pub estimated_time_remaining: Option<u64>, // seconds
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExportStatus {
    Queued,
    Processing,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ExportJob {
    pub job_id: String,
    pub user_id: i64,
    pub timeline_id: Option<String>,
    pub settings: serde_json::Value, // ExportSettings as JSON
    pub status: String,              // ExportStatus
    pub progress: serde_json::Value, // ExportProgress as JSON
    pub output_url: Option<String>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartExportRequest {
    pub timeline_id: String,
    pub settings: ExportSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartExportResponse {
    pub success: bool,
    pub job_id: String,
    pub message: Option<String>,
}

impl ExportSettings {
    pub fn get_dimensions(&self) -> (u32, u32) {
        let base = match self.resolution {
            ExportResolution::P720 => (1280, 720),
            ExportResolution::P1080 => (1920, 1080),
            ExportResolution::K2 => (2560, 1440),
            ExportResolution::K4 => (3840, 2160),
            ExportResolution::K8 => (7680, 4320),
        };

        // Ajuster selon aspect ratio
        match self.aspect_ratio {
            AspectRatio::R16_9 => base,
            AspectRatio::R9_16 => (base.1, base.0),
            AspectRatio::R1_1 => {
                let size = base.0.min(base.1);
                (size, size)
            }
            AspectRatio::R4_5 => {
                let height = base.1;
                let width = (height as f32 * 4.0 / 5.0) as u32;
                (width, height)
            }
            AspectRatio::R21_9 => {
                let height = base.1;
                let width = (height as f32 * 21.0 / 9.0) as u32;
                (width, height)
            }
        }
    }

    pub fn get_bitrate(&self) -> u32 {
        self.bitrate.unwrap_or_else(|| match self.quality {
            ExportQuality::Low => 1000,
            ExportQuality::Medium => 5000,
            ExportQuality::High => 10000,
            ExportQuality::Ultra => 20000,
        })
    }

    pub fn get_audio_bitrate(&self) -> u32 {
        self.audio_bitrate.unwrap_or_else(|| match self.quality {
            ExportQuality::Low => 96,
            ExportQuality::Medium => 128,
            ExportQuality::High => 192,
            ExportQuality::Ultra => 320,
        })
    }

    pub fn get_fps(&self) -> u32 {
        self.fps.unwrap_or(30)
    }

    /// Retourne le mode de bitrate (défaut: VBR)
    pub fn get_bitrate_mode(&self) -> BitrateMode {
        self.bitrate_mode.clone().unwrap_or(BitrateMode::VBR)
    }
}
