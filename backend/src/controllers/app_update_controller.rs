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

/// Valeurs par defaut si les variables d'environnement ne sont pas definies (Cloud Run / secrets).
/// IMPORTANT: le `versionCode` Android (EAS/Gradle) est souvent un entier eleve (ex. 42, 100+).
/// Si `ANDROID_LATEST_VERSION_CODE` reste a 3 alors que les telephones ont deja `versionCode` >= 3,
/// la comparaison `current < latest` est toujours fausse → **aucune mise a jour proposee**.
/// A chaque nouvel APK public: definir `ANDROID_LATEST_VERSION_CODE` au moins egal au `versionCode`
/// contenu dans cet APK (voir `android.defaultConfig.versionCode` / build EAS).
const DEFAULT_LATEST_ANDROID_VERSION: i32 = 3;
const DEFAULT_LATEST_ANDROID_VERSION_NAME: &str = "3.0.0";
const DEFAULT_MIN_SUPPORTED_ANDROID_VERSION: i32 = 1;
const DEFAULT_APK_SIZE_BYTES: i64 = 132_331_530;

fn env_i32(key: &str, default: i32) -> i32 {
    std::env::var(key).ok().and_then(|s| s.trim().parse().ok()).unwrap_or(default)
}

fn env_i64(key: &str, default: i64) -> i64 {
    std::env::var(key).ok().and_then(|s| s.trim().parse().ok()).unwrap_or(default)
}

fn env_string(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn latest_android_version_code() -> i32 {
    env_i32(
        "ANDROID_LATEST_VERSION_CODE",
        DEFAULT_LATEST_ANDROID_VERSION,
    )
}

fn latest_android_version_name() -> String {
    env_string(
        "ANDROID_LATEST_VERSION_NAME",
        DEFAULT_LATEST_ANDROID_VERSION_NAME,
    )
}

fn min_supported_android_version() -> i32 {
    env_i32(
        "ANDROID_MIN_SUPPORTED_VERSION_CODE",
        DEFAULT_MIN_SUPPORTED_ANDROID_VERSION,
    )
}

fn android_apk_size_bytes() -> i64 {
    env_i64("ANDROID_APK_SIZE_BYTES", DEFAULT_APK_SIZE_BYTES)
}

// ======================================================================
// DISPONIBILITE SUR LES STORES
// Passez ces flags a `true` le jour ou l'app est publiee sur le store.
// Tous les utilisateurs seront alors rediriges vers le store
// au lieu du telechargement direct APK.
// ======================================================================
const ANDROID_ON_PLAY_STORE: bool = false;
const IOS_ON_APP_STORE: bool = false;

const PLAY_STORE_URL: &str = "https://play.google.com/store/apps/details?id=com.yukpomnang.mobile";
const APP_STORE_URL: &str = "https://apps.apple.com/app/yukpomnang";
const DIRECT_APK_URL: &str = "https://yukpomnang.com/download";

fn get_download_info(platform: &str, _install_source: Option<&str>) -> (String, String) {
    match platform {
        "android" => {
            if ANDROID_ON_PLAY_STORE {
                // L'app est publiee sur le Play Store : rediriger tout le monde
                // (y compris ceux qui avaient un APK direct, pour qu'ils migrent)
                (PLAY_STORE_URL.into(), "play_store".into())
            } else {
                // Pas encore sur le Play Store : telechargement direct
                (DIRECT_APK_URL.into(), "direct_apk".into())
            }
        }
        "ios" => {
            if IOS_ON_APP_STORE {
                (APP_STORE_URL.into(), "app_store".into())
            } else {
                (DIRECT_APK_URL.into(), "direct_apk".into())
            }
        }
        _ => (DIRECT_APK_URL.into(), "direct_apk".into()),
    }
}

pub async fn check_for_updates(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<UpdateCheckRequest>,
) -> Json<UpdateCheckResponse> {
    let platform = request.platform.to_lowercase();
    let (download_url, download_type) =
        get_download_info(&platform, request.install_source.as_deref());

    let latest_version = if platform == "ios" {
        1
    } else {
        latest_android_version_code()
    };
    let latest_name = if platform == "ios" {
        "1.0.0".to_string()
    } else {
        latest_android_version_name()
    };

    let min_supported = if platform == "android" {
        min_supported_android_version()
    } else {
        1
    };

    let has_update = request.current_version_code < latest_version;

    let update_info = if has_update {
        Some(AppVersionInfo {
            version_code: latest_version,
            version_name: latest_name,
            download_url,
            download_type,
            release_date: chrono::Utc::now().to_rfc3339(),
            size_bytes: android_apk_size_bytes(),
            mandatory: request.current_version_code < min_supported,
            changelog: vec![
                "Performance amelioree".into(),
                "Correction de bugs critiques".into(),
                "Nouvelle interface utilisateur".into(),
                "Securite renforcee".into(),
            ],
            min_supported_version: min_supported,
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
    let (download_url, download_type) = get_download_info("android", None);
    let min_supported = min_supported_android_version();

    Json(AppVersionInfo {
        version_code: latest_android_version_code(),
        version_name: latest_android_version_name(),
        download_url,
        download_type,
        release_date: chrono::Utc::now().to_rfc3339(),
        size_bytes: android_apk_size_bytes(),
        mandatory: false,
        changelog: vec![
            "Performance amelioree".into(),
            "Correction de bugs critiques".into(),
            "Nouvelle interface utilisateur".into(),
            "Securite renforcee".into(),
        ],
        min_supported_version: min_supported,
    })
}
