// Endpoint pour servir l'APK de test
use axum::{
    body::Body,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::path::Path as StdPath;
use std::sync::Arc;

pub async fn get_test_apk() -> impl IntoResponse {
    let apk_path = StdPath::new("uploads/yukpo-mobile-test.apk");

    if !apk_path.exists() {
        return (
            StatusCode::NOT_FOUND,
            "APK de test non trouvé. Veuillez d'abord uploader le fichier.",
        )
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
            "attachment; filename=\"yukpo-mobile-test.apk\"",
        )
        .body(Body::from(apk_content))
        .unwrap()
}

pub async fn get_download_page() -> impl IntoResponse {
    let html = include_str!("../public/test-download.html");
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
        html,
    )
}

pub fn create_test_routes() -> Router {
    Router::new()
        .route("/test-download", get(get_download_page))
        .route("/downloads/yukpo-mobile-test.apk", get(get_test_apk))
}
