// Endpoint pour servir la page de téléchargement APK et rediriger vers GCS
use crate::state::AppState;
use axum::{
    body::Body,
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::path::Path as StdPath;
use std::sync::Arc;

/// Sert le fichier APK directement depuis le filesystem local (fallback)
pub async fn get_test_apk() -> impl IntoResponse {
    let apk_path = StdPath::new("uploads/yukpo-mobile-test.apk");

    if !apk_path.exists() {
        // Redirect to GCS if local file doesn't exist
        let gcs_url = std::env::var("APK_DOWNLOAD_URL").unwrap_or_else(|_| {
            "https://storage.googleapis.com/yukpo-project-yukpo-backend-media/app/yukpo.apk"
                .to_string()
        });
        return Response::builder()
            .status(StatusCode::FOUND)
            .header(header::LOCATION, gcs_url)
            .header(header::CACHE_CONTROL, "no-cache")
            .body(Body::empty())
            .unwrap()
            .into_response();
    }

    let apk_content: Vec<u8> = match tokio::fs::read(apk_path).await {
        Ok(content) => content,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erreur lors de la lecture du fichier APK.",
            )
                .into_response();
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            "application/vnd.android.package-archive",
        )
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"Yukpo.apk\"",
        )
        .body(Body::from(apk_content))
        .unwrap()
        .into_response()
}

/// Redirige vers l'URL de téléchargement APK (GCS presigned ou public)
pub async fn redirect_to_apk(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    // Priority: APK_DOWNLOAD_URL env > GCS presigned > GCS public
    let download_url = if let Ok(url) = std::env::var("APK_DOWNLOAD_URL") {
        url
    } else {
        // Try to generate presigned URL from GCS
        let gcs_path = "app/yukpo.apk";
        match state.media_storage.generate_presigned_url(gcs_path, 86400).await {
            Ok(presigned) => presigned,
            Err(_) => {
                // Fallback to public GCS URL
                "https://storage.googleapis.com/yukpo-project-yukpo-backend-media/app/yukpo.apk"
                    .to_string()
            }
        }
    };

    Response::builder()
        .status(StatusCode::FOUND)
        .header(header::LOCATION, &download_url)
        .header(header::CACHE_CONTROL, "no-cache, no-store")
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"Yukpo.apk\"",
        )
        .body(Body::empty())
        .unwrap()
}

/// Sert le logo Yukpo (PNG)
pub async fn serve_logo() -> impl IntoResponse {
    let logo_path = StdPath::new("public/logo.png");
    match tokio::fs::read(logo_path).await {
        Ok(content) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "image/png")
            .header(header::CACHE_CONTROL, "public, max-age=86400")
            .body(Body::from(content))
            .unwrap()
            .into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "Logo not found").into_response(),
    }
}

/// Sert la page HTML de téléchargement
pub async fn get_download_page() -> impl IntoResponse {
    let html = include_str!("../../public/test-download.html");
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (header::CACHE_CONTROL, "public, max-age=3600"),
        ],
        html,
    )
}

pub fn create_test_routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // URL propre pour les utilisateurs
        .route("/download", get(get_download_page))
        // Alias pour compatibilité
        .route("/test-download", get(get_download_page))
        // Téléchargement direct APK via redirect GCS
        .route("/download/apk", get(redirect_to_apk))
        // Logo Yukpo
        .route("/download/logo.png", get(serve_logo))
        // Fallback: fichier local
        .route("/downloads/yukpo-mobile-test.apk", get(get_test_apk))
}
