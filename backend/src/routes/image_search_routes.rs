use std::sync::Arc;
use crate::AppState;

#[cfg(feature = "image_search")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "image_search")]
use crate::{
    services::image_search_service::{ImageSearchResult, ImageMetadata},
    core::types::{AppResult, AppError},
};

#[cfg(feature = "image_search")]
use axum::{
    extract::{Multipart, State},
    response::Json,
    routing::post,
    Router,
};

#[cfg(feature = "image_search")]
use crate::services::image_search_service::ImageSearchService;

#[derive(Debug, Serialize, Deserialize)]
#[cfg(feature = "image_search")]
pub struct ImageSearchRequest {
    pub similarity_threshold: Option<f32>,
    pub max_results: Option<i32>,
    pub gps_zone: Option<String>,  // Format: "lat1,lng1|lat2,lng2|..." pour polygone ou "lat,lng" pour point
    pub search_radius_km: Option<i32>,  // Rayon de recherche en km (défaut: 50)
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg(feature = "image_search")]
pub struct ImageSearchResponse {
    pub results: Vec<ImageSearchResult>,
    pub total_found: usize,
    pub search_time_ms: u64,
}

#[cfg(feature = "image_search")]
pub fn image_search_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/image-search/upload", post(upload_and_search_image))
        .route("/api/image-search/search", post(search_by_metadata))
        .route("/api/image-search/process-existing", post(process_existing_images))
        .with_state(state)
}

#[cfg(not(feature = "image_search"))]
pub fn image_search_routes_disabled(_state: Arc<AppState>) -> axum::Router<Arc<AppState>> {
    axum::Router::new()
}

/// Upload une image et recherche des images similaires
#[cfg(feature = "image_search")]
pub async fn upload_and_search_image(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> AppResult<Json<ImageSearchResponse>> {
    let start_time = std::time::Instant::now();
    
    let mut image_data: Option<Vec<u8>> = None;
    let mut _similarity_threshold: f32 = 0.3;
    let mut max_results: i32 = 10;
    
    // Extraire l'image et les paramètres du multipart
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        log::error!("Erreur multipart: {}", e);
        AppError::internal_server_error("Erreur lors de l'upload".to_string())
    })? {
        let field_name = field.name().unwrap_or("").to_string();
        
        match field_name.as_str() {
            "image" => {
                image_data = Some(field.bytes().await.map_err(|e| {
                    log::error!("Erreur lecture image: {}", e);
                    AppError::internal_server_error("Erreur lors de la lecture de l'image".to_string())
                })?.to_vec());
            }
            "similarity_threshold" => {
                if let Ok(value) = field.text().await {
                    if let Ok(threshold) = value.parse::<f32>() {
                        _similarity_threshold = threshold;
                    }
                }
            }
            "max_results" => {
                if let Ok(value) = field.text().await {
                    if let Ok(results) = value.parse::<i32>() {
                        max_results = results;
                    }
                }
            }
            _ => {}
        }
    }
    
    let image_data = image_data.ok_or_else(|| {
        AppError::BadRequest("Image requise".to_string())
    })?;
    
    // Créer le service de recherche d'images
    let image_service = ImageSearchService::new(state.pg.clone());
    
    // Rechercher des images similaires
    let results = image_service.search_similar_images_with_service_data(&image_data, max_results).await.map_err(|e| {
        log::error!("Erreur recherche images: {}", e);
        AppError::internal_server_error("Erreur lors de la recherche d'images".to_string())
    })?;
    
    let search_time = start_time.elapsed().as_millis() as u64;
    
    Ok(Json(ImageSearchResponse {
        results: results.clone(),
        total_found: results.len(),
        search_time_ms: search_time,
    }))
}

/// Recherche par métadonnées d'image avec filtrage GPS optionnel
#[cfg(feature = "image_search")]
pub async fn search_by_metadata(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ImageSearchRequest>,
) -> AppResult<Json<ImageSearchResponse>> {
    let start_time = std::time::Instant::now();
    
    // Pour cet exemple, on utilise des métadonnées fictives
    // En pratique, ces métadonnées viendraient de l'image uploadée
    let query_metadata = ImageMetadata {
        width: 800,
        height: 600,
        format: "jpeg".to_string(),
        file_size: 102400,
        dominant_colors: vec![[255, 0, 0], [0, 255, 0], [0, 0, 255]],
        color_histogram: vec![0.1; 256], // Histogramme de couleurs par défaut
        edge_density: 0.5, // Densité de contours par défaut
        brightness: 0.6, // Luminosité moyenne par défaut
        contrast: 0.4, // Contraste par défaut
    };
    
    let image_service = ImageSearchService::new(state.pg.clone());
    
    // Utiliser la recherche avec filtrage GPS si des coordonnées sont fournies
    let results = if let Some(gps_zone) = &request.gps_zone {
        log::info!("[ImageSearch] Recherche avec filtrage GPS: {}", gps_zone);
        image_service.search_by_metadata_with_gps_filter(
            &query_metadata, 
            Some(gps_zone),
            request.search_radius_km,
            request.max_results.unwrap_or(10)
        ).await.map_err(|e| {
            log::error!("Erreur recherche par métadonnées avec GPS: {}", e);
            AppError::internal_server_error("Erreur lors de la recherche par métadonnées avec GPS".to_string())
        })?
    } else {
        // Recherche classique sans filtrage GPS
        image_service.search_by_metadata_with_service_data(&query_metadata, request.max_results.unwrap_or(10)).await.map_err(|e| {
            log::error!("Erreur recherche par métadonnées: {}", e);
            AppError::internal_server_error("Erreur lors de la recherche par métadonnées".to_string())
        })?
    };
    
    let search_time = start_time.elapsed().as_millis() as u64;
    
    Ok(Json(ImageSearchResponse {
        results: results.clone(),
        total_found: results.len(),
        search_time_ms: search_time,
    }))
}

/// Traite tous les médias d'images existants pour générer leurs signatures
#[cfg(feature = "image_search")]
pub async fn process_existing_images(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<serde_json::Value>> {
    let image_service = ImageSearchService::new(state.pg.clone());
    
    let processed_count = image_service.process_existing_images().await.map_err(|e| {
        log::error!("Erreur traitement images existantes: {}", e);
        AppError::internal_server_error("Erreur lors du traitement des images existantes".to_string())
    })?;
    
    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("{} images traitées avec succès", processed_count),
        "processed_count": processed_count
    })))
} 