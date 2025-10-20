// 🖼️ Contrôleur de recherche par image
use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::services::image_search_service::{ImageSearchService, ImageSearchResult};
use crate::state::AppState;
use crate::utils::logger::{log_error, log_info};

#[derive(Debug, Deserialize)]
pub struct ImageSearchRequest {
    /// Image en base64 (avec ou sans préfixe data:image/...)
    pub image_base64: String,
    /// Seuil de similarité (0.0 à 1.0, défaut: 0.3)
    #[serde(default = "default_similarity_threshold")]
    pub similarity_threshold: f32,
    /// Nombre maximum de résultats (défaut: 10)
    #[serde(default = "default_max_results")]
    pub max_results: i32,
    /// Type de recherche: "signature" (par similarité) ou "hash" (doublons exacts)
    #[serde(default = "default_search_type")]
    pub search_type: String,
}

fn default_similarity_threshold() -> f32 {
    0.3
}

fn default_max_results() -> i32 {
    10
}

fn default_search_type() -> String {
    "signature".to_string()
}

#[derive(Debug, Serialize)]
pub struct ImageSearchResponse {
    pub success: bool,
    pub results: Vec<ImageSearchResult>,
    pub count: usize,
    pub message: String,
}

/// Rechercher des produits/services similaires par image
pub async fn search_by_image(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ImageSearchRequest>,
) -> impl IntoResponse {
    log_info(&format!(
        "[ImageSearchController] Recherche par image: type={}, seuil={}, max={}",
        request.search_type, request.similarity_threshold, request.max_results
    ));

    // Extraire le base64 pur (sans préfixe data:image/...)
    let image_base64 = if request.image_base64.contains("base64,") {
        request.image_base64
            .split("base64,")
            .nth(1)
            .unwrap_or(&request.image_base64)
            .to_string()
    } else {
        request.image_base64.clone()
    };

    // Décoder l'image base64
    let image_data = match general_purpose::STANDARD.decode(&image_base64) {
        Ok(data) => data,
        Err(e) => {
            log_error(&format!("[ImageSearchController] Erreur décodage base64: {}", e));
            return (
                StatusCode::BAD_REQUEST,
                Json(ImageSearchResponse {
                    success: false,
                    results: vec![],
                    count: 0,
                    message: format!("Erreur décodage image: {}", e),
                }),
            )
                .into_response();
        }
    };

    log_info(&format!("[ImageSearchController] Image décodée: {} octets", image_data.len()));

    let search_service = ImageSearchService::new(Arc::new(state.pg.clone()));

    // Recherche selon le type
    let results = match request.search_type.as_str() {
        "hash" => {
            // Recherche par hash (doublons exacts)
            let image_hash = ImageSearchService::calculate_image_hash(&image_data);
            search_service.search_by_image_hash(&image_hash).await
        }
        "signature" | _ => {
            // Recherche par similarité (défaut)
            search_service
                .hybrid_image_search(
                    &image_data,
                    request.similarity_threshold,
                    request.max_results,
                )
                .await
        }
    };

    match results {
        Ok(results) => {
            log_info(&format!("[ImageSearchController] Trouvé {} résultats", results.len()));
            (
                StatusCode::OK,
                Json(ImageSearchResponse {
                    success: true,
                    count: results.len(),
                    message: format!("Trouvé {} résultats similaires", results.len()),
                    results,
                }),
            )
                .into_response()
        }
        Err(e) => {
            log_error(&format!("[ImageSearchController] Erreur recherche: {:?}", e));
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ImageSearchResponse {
                    success: false,
                    results: vec![],
                    count: 0,
                    message: format!("Erreur lors de la recherche: {}", e),
                }),
            )
                .into_response()
        }
    }
}

/// Rechercher spécifiquement dans les images de produits
pub async fn search_product_images(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ImageSearchRequest>,
) -> impl IntoResponse {
    log_info("[ImageSearchController] Recherche dans images de produits");

    let image_base64 = if request.image_base64.contains("base64,") {
        request.image_base64
            .split("base64,")
            .nth(1)
            .unwrap_or(&request.image_base64)
            .to_string()
    } else {
        request.image_base64.clone()
    };

    let image_data = match base64::decode(&image_base64) {
        Ok(data) => data,
        Err(e) => {
            log_error(&format!("[ImageSearchController] Erreur décodage base64: {}", e));
            return (
                StatusCode::BAD_REQUEST,
                Json(ImageSearchResponse {
                    success: false,
                    results: vec![],
                    count: 0,
                    message: format!("Erreur décodage image: {}", e),
                }),
            )
                .into_response();
        }
    };

    let search_service = ImageSearchService::new(Arc::new(state.pg.clone()));
    let signature = match ImageSearchService::generate_image_signature(&image_data) {
        Ok(sig) => sig,
        Err(e) => {
            log_error(&format!("[ImageSearchController] Erreur génération signature: {:?}", e));
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ImageSearchResponse {
                    success: false,
                    results: vec![],
                    count: 0,
                    message: format!("Erreur génération signature: {}", e),
                }),
            )
                .into_response();
        }
    };

    match search_service
        .search_product_images(&signature, request.similarity_threshold, request.max_results)
        .await
    {
        Ok(results) => {
            log_info(&format!("[ImageSearchController] Trouvé {} produits", results.len()));
            (
                StatusCode::OK,
                Json(ImageSearchResponse {
                    success: true,
                    count: results.len(),
                    message: format!("Trouvé {} produits similaires", results.len()),
                    results,
                }),
            )
                .into_response()
        }
        Err(e) => {
            log_error(&format!("[ImageSearchController] Erreur recherche: {:?}", e));
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ImageSearchResponse {
                    success: false,
                    results: vec![],
                    count: 0,
                    message: format!("Erreur lors de la recherche: {}", e),
                }),
            )
                .into_response()
        }
    }
}

