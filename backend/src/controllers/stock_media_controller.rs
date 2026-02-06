// ✅ NOUVEAU Phase 2: Controller pour Stock Media Integration
// Date: 2025-01-27

use crate::core::types::AppResult;
use crate::services::stock_media_service::{
    StockMediaConfig, StockMediaOrientation, StockMediaProvider, StockMediaSearchRequest,
    StockMediaService, StockMediaType,
};
use axum::{extract::Query, Json};
use log::info;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct StockMediaSearchQuery {
    pub query: String,
    pub provider: Option<String>,
    pub media_type: Option<String>,  // "photo" | "video"
    pub orientation: Option<String>, // "landscape" | "portrait" | "square"
    pub color: Option<String>,
    pub min_width: Option<u32>,
    pub min_height: Option<u32>,
    pub page: Option<usize>,
    pub per_page: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct StockMediaSearchResponse {
    pub success: bool,
    pub results: Vec<crate::services::stock_media_service::StockMediaSearchResponse>,
    pub total_results: usize,
}

/// Recherche dans Stock Media (Unsplash, Pexels, Pixabay)
pub async fn search_stock_media(
    Query(params): Query<StockMediaSearchQuery>,
) -> AppResult<Json<StockMediaSearchResponse>> {
    info!("[StockMedia] Recherche: '{}'", params.query);

    let config = StockMediaConfig::default();
    let service = StockMediaService::new(config);

    let media_type = match params.media_type.as_deref() {
        Some("video") => StockMediaType::Video,
        _ => StockMediaType::Photo,
    };

    let provider = params.provider.as_deref().and_then(|p| match p.to_lowercase().as_str() {
        "unsplash" => Some(StockMediaProvider::Unsplash),
        "pexels" => Some(StockMediaProvider::Pexels),
        "pixabay" => Some(StockMediaProvider::Pixabay),
        _ => None,
    });

    let orientation = params.orientation.as_deref().and_then(|o| match o.to_lowercase().as_str() {
        "landscape" => Some(StockMediaOrientation::Landscape),
        "portrait" => Some(StockMediaOrientation::Portrait),
        "square" => Some(StockMediaOrientation::Square),
        _ => None,
    });

    let request = StockMediaSearchRequest {
        query: params.query,
        provider,
        media_type,
        orientation,
        color: params.color,
        min_width: params.min_width,
        min_height: params.min_height,
        page: params.page,
        per_page: params.per_page,
    };

    let results = service.search(request).await?;

    let total_results = results.iter().map(|r| r.total).sum();

    Ok(Json(StockMediaSearchResponse {
        success: true,
        results,
        total_results,
    }))
}

/// Liste les providers disponibles
pub async fn list_stock_media_providers() -> AppResult<Json<serde_json::Value>> {
    let config = StockMediaConfig::default();

    let providers = vec![
        serde_json::json!({
            "name": "Unsplash",
            "available": config.unsplash_access_key.is_some(),
            "supports": ["photo"]
        }),
        serde_json::json!({
            "name": "Pexels",
            "available": config.pexels_api_key.is_some(),
            "supports": ["photo", "video"]
        }),
        serde_json::json!({
            "name": "Pixabay",
            "available": config.pixabay_api_key.is_some(),
            "supports": ["photo", "video"]
        }),
    ];

    Ok(Json(serde_json::json!({
        "success": true,
        "providers": providers
    })))
}
