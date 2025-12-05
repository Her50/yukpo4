//! Routes de tracking pour les métriques frontend (carrousels, navigation, etc.)

use axum::{extract::State, http::StatusCode, response::Json, routing::post, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CarouselTrackingRequest {
    pub carousel_id: String,
    pub action: String, // "scroll", "auto_scroll", "view", "click", "pause", "resume"
    pub item_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VideoCarouselTrackingRequest {
    pub carousel_id: String,
    pub action: String, // "scroll", "auto_scroll", "view", "play", "pause", "engagement"
    pub video_id: Option<String>,
    pub engagement_type: Option<String>, // "like", "share", "comment"
}

#[derive(Debug, Deserialize)]
pub struct NavigationTrackingRequest {
    pub action: String, // "view", "search", "filter", "click", "geolocation_search", "map_interaction"
    pub query_type: Option<String>, // "keyword", "category", "location"
    pub filter_type: Option<String>, // "price", "category", "location", "rating"
    pub item_type: Option<String>, // "service", "product"
    pub item_id: Option<String>,
    pub results_count: Option<u64>,
    pub has_results: Option<bool>,
    pub map_action: Option<String>, // "zoom", "pan", "marker_click"
}

/// Tracker événements carrousel produits
pub async fn track_product_carousel(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<CarouselTrackingRequest>,
) -> Result<Json<Value>, StatusCode> {
    match payload.action.as_str() {
        "scroll" => {
            crate::metrics::PRODUCT_CAROUSEL_METRICS
                .scrolls_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "auto_scroll" => {
            crate::metrics::PRODUCT_CAROUSEL_METRICS
                .auto_scroll_events_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "view" => {
            crate::metrics::PRODUCT_CAROUSEL_METRICS
                .items_viewed_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "click" => {
            crate::metrics::PRODUCT_CAROUSEL_METRICS
                .interactions_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "pause" => {
            crate::metrics::PRODUCT_CAROUSEL_METRICS
                .pause_events_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "resume" => {
            crate::metrics::PRODUCT_CAROUSEL_METRICS
                .resume_events_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        _ => {}
    }

    Ok(Json(json!({
        "success": true,
        "tracked": true
    })))
}

/// Tracker événements carrousel vidéos
pub async fn track_video_carousel(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<VideoCarouselTrackingRequest>,
) -> Result<Json<Value>, StatusCode> {
    match payload.action.as_str() {
        "scroll" => {
            crate::metrics::VIDEO_CAROUSEL_METRICS
                .scrolls_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "auto_scroll" => {
            crate::metrics::VIDEO_CAROUSEL_METRICS
                .auto_scroll_events_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "view" => {
            crate::metrics::VIDEO_CAROUSEL_METRICS
                .videos_viewed_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "play" => {
            crate::metrics::VIDEO_CAROUSEL_METRICS
                .play_events_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "pause" => {
            crate::metrics::VIDEO_CAROUSEL_METRICS
                .pause_events_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "engagement" => {
            crate::metrics::VIDEO_CAROUSEL_METRICS
                .engagement_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        _ => {}
    }

    Ok(Json(json!({
        "success": true,
        "tracked": true
    })))
}

/// Tracker événements navigation ResultaBesoinScreen
pub async fn track_navigation(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<NavigationTrackingRequest>,
) -> Result<Json<Value>, StatusCode> {
    match payload.action.as_str() {
        "view" => {
            crate::metrics::NAVIGATION_METRICS
                .screen_views_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "search" => {
            crate::metrics::NAVIGATION_METRICS
                .searches_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

            // Si recherche sans résultats
            if let Some(has_results) = payload.has_results {
                if !has_results {
                    crate::metrics::NAVIGATION_METRICS
                        .searches_without_results_total
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                } else if let Some(count) = payload.results_count {
                    crate::metrics::NAVIGATION_METRICS
                        .results_displayed_total
                        .fetch_add(count, std::sync::atomic::Ordering::Relaxed);
                }
            }
        }
        "filter" => {
            crate::metrics::NAVIGATION_METRICS
                .filters_applied_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "click" => {
            crate::metrics::NAVIGATION_METRICS
                .item_clicks_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "geolocation_search" => {
            crate::metrics::NAVIGATION_METRICS
                .geolocation_searches_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "map_interaction" => {
            crate::metrics::NAVIGATION_METRICS
                .map_interactions_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        _ => {}
    }

    Ok(Json(json!({
        "success": true,
        "tracked": true
    })))
}

/// Tracker vues/clics sur entrées de promotion globale
pub async fn track_global_promo_entry(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Value>, StatusCode> {
    let action = payload.get("action").and_then(|v| v.as_str()).unwrap_or("");
    let entry_id = payload.get("entry_id").and_then(|v| v.as_str());

    match action {
        "view" => {
            crate::metrics::GLOBAL_PROMO_METRICS
                .entries_views_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "click" => {
            crate::metrics::GLOBAL_PROMO_METRICS
                .entries_clicks_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "catalog_page_view" => {
            crate::metrics::GLOBAL_PROMO_METRICS
                .catalog_page_views_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        "catalog_search" => {
            crate::metrics::GLOBAL_PROMO_METRICS
                .catalog_searches_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        _ => {}
    }

    Ok(Json(json!({
        "success": true,
        "tracked": true,
        "entry_id": entry_id
    })))
}

pub fn metrics_tracking_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/metrics/track/product-carousel",
            post(track_product_carousel),
        )
        .route(
            "/api/metrics/track/video-carousel",
            post(track_video_carousel),
        )
        .route("/api/metrics/track/navigation", post(track_navigation))
        .route(
            "/api/metrics/track/global-promo-entry",
            post(track_global_promo_entry),
        )
        .with_state(state)
}
