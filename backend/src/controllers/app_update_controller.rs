use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppVersionInfo {
    pub version_code: i32,
    pub version_name: String,
    pub download_url: String,
    pub download_type: String,
    pub release_date: String,
    pub size_bytes: i64,
    pub mandatory: bool,
    pub changelog: Vec<String>,
    pub min_supported_version: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCheckRequest {
    pub current_version_code: i32,
    pub platform: String,
    pub install_source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCheckResponse {
    pub has_update: bool,
    pub update_info: Option<AppVersionInfo>,
    pub server_time: String,
}

const LATEST_ANDROID_VERSION: i32 = 3;
const LATEST_ANDROID_VERSION_NAME: &str = "3.0.0";
const MIN_SUPPORTED_ANDROID_VERSION: i32 = 1;
const APK_SIZE_BYTES: i64 = 132_318_582;

fn get_download_info(platform: &str, version_code: i32) -> (String, String) {
    match platform {
        "android" => {
            if version_code >= 1000 {
                (
                    "https://play.google.com/store/apps/details?id=com.yukpomnang.mobile".into(),
                    "play_store".into(),
                )
            } else {
                (
                    "https://yukpomnang.com/download".into(),
                    "direct_apk".into(),
                )
            }
        }
        "ios" => (
            "https://apps.apple.com/app/yukpomnang".into(),
            "app_store".into(),
        ),
        _ => (
            "https://yukpomnang.com/download".into(),
            "direct_apk".into(),
        ),
    }
}

pub async fn check_for_updates(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<UpdateCheckRequest>,
) -> Json<UpdateCheckResponse> {
    let platform = request.platform.to_lowercase();
    let (download_url, download_type) = get_download_info(&platform, request.current_version_code);

    let latest_version = if platform == "ios" {
        1
    } else {
        LATEST_ANDROID_VERSION
    };
    let latest_name = if platform == "ios" {
        "1.0.0".to_string()
    } else {
        LATEST_ANDROID_VERSION_NAME.to_string()
    };

    let has_update = request.current_version_code < latest_version;

    let update_info = if has_update {
        Some(AppVersionInfo {
            version_code: latest_version,
            version_name: latest_name,
            download_url,
            download_type,
            release_date: chrono::Utc::now().to_rfc3339(),
            size_bytes: APK_SIZE_BYTES,
            mandatory: request.current_version_code < MIN_SUPPORTED_ANDROID_VERSION,
            changelog: vec![
                "Performance amelioree".into(),
                "Correction de bugs critiques".into(),
                "Nouvelle interface utilisateur".into(),
                "Securite renforcee".into(),
            ],
            min_supported_version: MIN_SUPPORTED_ANDROID_VERSION,
        })
    } else {
        None
    };

    Json(UpdateCheckResponse {
        has_update,
        update_info,
        server_time: chrono::Utc::now().to_rfc3339(),
    })
}

pub async fn get_update_info(State(_state): State<Arc<AppState>>) -> Json<AppVersionInfo> {
    Json(AppVersionInfo {
        version_code: LATEST_ANDROID_VERSION,
        version_name: LATEST_ANDROID_VERSION_NAME.to_string(),
        download_url: "https://yukpomnang.com/download".to_string(),
        download_type: "direct_apk".to_string(),
        release_date: chrono::Utc::now().to_rfc3339(),
        size_bytes: APK_SIZE_BYTES,
        mandatory: false,
        changelog: vec![
            "Performance amelioree".into(),
            "Correction de bugs critiques".into(),
            "Nouvelle interface utilisateur".into(),
            "Securite renforcee".into(),
        ],
        min_supported_version: MIN_SUPPORTED_ANDROID_VERSION,
    })
}
