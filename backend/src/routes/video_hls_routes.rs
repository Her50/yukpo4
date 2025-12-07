/**
 * Routes pour génération et streaming HLS/DASH
 */
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::services::hls_dash_service::HLSDashService;
use crate::state::AppState;

pub fn video_hls_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Générer variantes HLS pour une vidéo
        .route(
            "/api/videos/:video_id/generate-hls",
            post(generate_hls_variants),
        )
        // Générer variantes DASH pour une vidéo
        .route(
            "/api/videos/:video_id/generate-dash",
            post(generate_dash_variants),
        )
        // Récupérer master playlist HLS
        .route(
            "/api/videos/:video_id/master.m3u8",
            get(get_master_playlist),
        )
        // Récupérer playlist variante HLS
        .route(
            "/api/videos/:video_id/:quality/playlist.m3u8",
            get(get_variant_playlist),
        )
        // Récupérer manifest DASH
        .route("/api/videos/:video_id/manifest.mpd", get(get_dash_manifest))
        .with_state(state)
}

/// POST /api/videos/:video_id/generate-hls
async fn generate_hls_variants(
    State(state): State<Arc<AppState>>,
    Path(video_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Récupérer le chemin de la vidéo originale
    let video_path = sqlx::query_scalar::<_, Option<String>>(
        "SELECT path FROM media WHERE id = $1::integer OR id::text = $1",
    )
    .bind(&video_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let video_path = video_path.ok_or(StatusCode::NOT_FOUND)?;

    // Initialiser service HLS
    let output_dir = std::env::var("HLS_OUTPUT_DIR").unwrap_or_else(|_| "./hls_output".to_string());
    let hls_service = HLSDashService::new(output_dir.clone());

    // Générer variantes
    match hls_service
        .generate_hls_variants(video_path.as_deref().ok_or(StatusCode::NOT_FOUND)?, &video_id)
        .await
    {
        Ok(manifest) => Ok(Json(serde_json::json!({
            "success": true,
            "manifest": manifest
        }))),
        Err(e) => {
            log::error!("Erreur génération HLS: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// POST /api/videos/:video_id/generate-dash
async fn generate_dash_variants(
    State(state): State<Arc<AppState>>,
    Path(video_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let video_path = sqlx::query_scalar::<_, Option<String>>(
        "SELECT path FROM media WHERE id = $1::integer OR id::text = $1",
    )
    .bind(&video_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let video_path = video_path.ok_or(StatusCode::NOT_FOUND)?;

    let output_dir = std::env::var("HLS_OUTPUT_DIR").unwrap_or_else(|_| "./hls_output".to_string());
    let hls_service = HLSDashService::new(output_dir.clone());

    match hls_service
        .generate_dash_variants(&video_path.unwrap(), &video_id)
        .await
    {
        Ok(manifest_url) => Ok(Json(serde_json::json!({
            "success": true,
            "manifest_url": manifest_url
        }))),
        Err(e) => {
            log::error!("Erreur génération DASH: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// GET /api/videos/:video_id/master.m3u8
async fn get_master_playlist(Path(video_id): Path<String>) -> Result<String, StatusCode> {
    let output_dir = std::env::var("HLS_OUTPUT_DIR").unwrap_or_else(|_| "./hls_output".to_string());
    let hls_service = HLSDashService::new(output_dir.clone());

    if let Some(_url) = hls_service.get_master_playlist_url(&video_id) {
        // Lire et retourner le contenu du master playlist
        let playlist_path = std::path::Path::new(&output_dir)
            .join(&video_id)
            .join("master.m3u8");

        match tokio::fs::read_to_string(playlist_path).await {
            Ok(content) => Ok(content),
            Err(_) => Err(StatusCode::NOT_FOUND),
        }
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// GET /api/videos/:video_id/:quality/playlist.m3u8
async fn get_variant_playlist(
    Path((video_id, quality)): Path<(String, String)>,
) -> Result<String, StatusCode> {
    let output_dir = std::env::var("HLS_OUTPUT_DIR").unwrap_or_else(|_| "./hls_output".to_string());

    let playlist_path = std::path::Path::new(&output_dir)
        .join(&video_id)
        .join(&quality)
        .join("playlist.m3u8");

    match tokio::fs::read_to_string(playlist_path).await {
        Ok(content) => Ok(content),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

/// GET /api/videos/:video_id/manifest.mpd
async fn get_dash_manifest(Path(video_id): Path<String>) -> Result<String, StatusCode> {
    let output_dir = std::env::var("HLS_OUTPUT_DIR").unwrap_or_else(|_| "./hls_output".to_string());

    let manifest_path = std::path::Path::new(&output_dir)
        .join(&video_id)
        .join("manifest.mpd");

    match tokio::fs::read_to_string(manifest_path).await {
        Ok(content) => Ok(content),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}
