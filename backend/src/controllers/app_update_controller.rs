use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::auth::Claims;
use crate::database::Database;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppVersionInfo {
    pub version_code: i32,
    pub version_name: String,
    pub download_url: String,
    pub release_date: DateTime<Utc>,
    pub size_bytes: i64,
    pub mandatory: bool,
    pub changelog: Vec<String>,
    pub min_supported_version: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCheckRequest {
    pub current_version_code: i32,
    pub platform: String, // "android" or "ios"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCheckResponse {
    pub has_update: bool,
    pub update_info: Option<AppVersionInfo>,
    pub server_time: DateTime<Utc>,
}

// Configuration des versions (à mettre dans la base de données ou config)
const LATEST_ANDROID_VERSION: i32 = 3;
const LATEST_ANDROID_VERSION_NAME: &str = "3.0.0";
const MIN_SUPPORTED_ANDROID_VERSION: i32 = 1;

pub async fn check_for_updates(
    _claims: Option<Claims>,
    db: &Database,
    request: UpdateCheckRequest,
) -> Result<UpdateCheckResponse, Box<dyn std::error::Error + Send + Sync>> {
    let current_version = request.current_version_code;
    let platform = request.platform.to_lowercase();
    
    let (latest_version, latest_version_name, download_url) = if platform == "android" {
        // Vérifier si l'app est sur Play Store ou version directe
        let is_play_store_version = request.current_version_code >= 1000; // Convention: versions Play Store >= 1000
        
        (
            LATEST_ANDROID_VERSION,
            LATEST_ANDROID_VERSION_NAME.to_string(),
            if is_play_store_version {
                // Play Store (priorité pour versions officielles)
                "https://play.google.com/store/apps/details?id=com.yukpomnang.mobile".to_string()
            } else {
                // APK direct (versions de test/développement)
                "https://yukpomnang.com/download".to_string()
            }
        )
    } else if platform == "ios" {
        // iOS (toujours App Store)
        (
            1, // version iOS
            "1.0.0".to_string(),
            "https://apps.apple.com/app/yukpomnang".to_string(),
        )
    } else {
        // Fallback pour autres plateformes
        (
            LATEST_ANDROID_VERSION,
            LATEST_ANDROID_VERSION_NAME.to_string(),
            "https://yukpomnang.com/download".to_string(),
        )
    };

    let has_update = current_version < latest_version;
    
    let update_info = if has_update {
        Some(AppVersionInfo {
            version_code: latest_version,
            version_name: latest_version_name,
            download_url,
            release_date: Utc::now(),
            size_bytes: 132_318_582, // Taille actuelle de l'APK
            mandatory: current_version < MIN_SUPPORTED_ANDROID_VERSION,
            changelog: vec![
                "🚀 Performance améliorée".to_string(),
                "🐛 Correction de bugs critiques".to_string(),
                "📱 Nouvelle interface utilisateur".to_string(),
                "🔐 Sécurité renforcée".to_string(),
            ],
            min_supported_version: MIN_SUPPORTED_ANDROID_VERSION,
        })
    } else {
        None
    };

    Ok(UpdateCheckResponse {
        has_update,
        update_info,
        server_time: Utc::now(),
    })
}

// Endpoint pour forcer la vérification (pour les notifications push)
pub async fn get_update_info(
    _claims: Option<Claims>,
    db: &Database,
) -> Result<AppVersionInfo, Box<dyn std::error::Error + Send + Sync>> {
    Ok(AppVersionInfo {
        version_code: LATEST_ANDROID_VERSION,
        version_name: LATEST_ANDROID_VERSION_NAME.to_string(),
        download_url: "https://yukpomnang.com/download".to_string(),
        release_date: Utc::now(),
        size_bytes: 132_318_582,
        mandatory: false,
        changelog: vec![
            "🚀 Performance améliorée".to_string(),
            "🐛 Correction de bugs critiques".to_string(),
            "📱 Nouvelle interface utilisateur".to_string(),
            "🔐 Sécurité renforcée".to_string(),
        ],
        min_supported_version: MIN_SUPPORTED_ANDROID_VERSION,
    })
}
