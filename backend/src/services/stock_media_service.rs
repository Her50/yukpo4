// ✅ NOUVEAU: Service d'intégration Stock Media (Unsplash, Pexels, Pixabay)
// Date: 2025-01-27
// Phase 2: Stock Media Integration

use crate::core::types::{AppError, AppResult};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::{timeout, Duration};

/// Configuration des APIs Stock Media
#[derive(Debug, Clone)]
pub struct StockMediaConfig {
    pub unsplash_access_key: Option<String>,
    pub pexels_api_key: Option<String>,
    pub pixabay_api_key: Option<String>,
    pub cache_ttl_seconds: u64,
    pub max_results_per_query: usize,
}

impl Default for StockMediaConfig {
    fn default() -> Self {
        Self {
            unsplash_access_key: std::env::var("UNSPLASH_ACCESS_KEY").ok(),
            pexels_api_key: std::env::var("PEXELS_API_KEY").ok(),
            pixabay_api_key: std::env::var("PIXABAY_API_KEY").ok(),
            cache_ttl_seconds: 3600, // 1 heure
            max_results_per_query: 20,
        }
    }
}

/// Résultat de recherche Stock Media
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMediaResult {
    pub id: String,
    pub provider: StockMediaProvider,
    pub url: String,
    pub thumbnail_url: String,
    pub width: u32,
    pub height: u32,
    pub author: String,
    pub author_url: Option<String>,
    pub license: String,
    pub tags: Vec<String>,
    pub download_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StockMediaProvider {
    Unsplash,
    Pexels,
    Pixabay,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMediaSearchRequest {
    pub query: String,
    pub provider: Option<StockMediaProvider>,
    pub media_type: StockMediaType,
    pub orientation: Option<StockMediaOrientation>,
    pub color: Option<String>,
    pub min_width: Option<u32>,
    pub min_height: Option<u32>,
    pub page: Option<usize>,
    pub per_page: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StockMediaType {
    Photo,
    Video,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StockMediaOrientation {
    Landscape,
    Portrait,
    Square,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMediaSearchResponse {
    pub results: Vec<StockMediaResult>,
    pub total: usize,
    pub page: usize,
    pub per_page: usize,
    pub provider: StockMediaProvider,
}

/// Service Stock Media
pub struct StockMediaService {
    config: StockMediaConfig,
    // Cache sera ajouté avec Redis si disponible
}

impl StockMediaService {
    pub fn new(config: StockMediaConfig) -> Self {
        Self { config }
    }

    /// Recherche dans tous les providers disponibles
    pub async fn search(
        &self,
        request: StockMediaSearchRequest,
    ) -> AppResult<Vec<StockMediaSearchResponse>> {
        info!(
            "[StockMedia] Recherche: '{}', type: {:?}",
            request.query, request.media_type
        );

        let mut results = Vec::new();

        // Si provider spécifié, chercher uniquement là
        if let Some(provider) = &request.provider {
            match provider {
                StockMediaProvider::Unsplash => {
                    if let Some(response) = self.search_unsplash(&request).await? {
                        results.push(response);
                    }
                }
                StockMediaProvider::Pexels => {
                    if let Some(response) = self.search_pexels(&request).await? {
                        results.push(response);
                    }
                }
                StockMediaProvider::Pixabay => {
                    if let Some(response) = self.search_pixabay(&request).await? {
                        results.push(response);
                    }
                }
            }
        } else {
            // Chercher dans tous les providers disponibles
            if self.config.unsplash_access_key.is_some() {
                if let Ok(Some(response)) = self.search_unsplash(&request).await {
                    results.push(response);
                }
            }

            if self.config.pexels_api_key.is_some() {
                if let Ok(Some(response)) = self.search_pexels(&request).await {
                    results.push(response);
                }
            }

            if self.config.pixabay_api_key.is_some() {
                if let Ok(Some(response)) = self.search_pixabay(&request).await {
                    results.push(response);
                }
            }
        }

        info!("[StockMedia] {} résultats trouvés", results.len());
        Ok(results)
    }

    /// Recherche Unsplash
    async fn search_unsplash(
        &self,
        request: &StockMediaSearchRequest,
    ) -> AppResult<Option<StockMediaSearchResponse>> {
        let access_key = match &self.config.unsplash_access_key {
            Some(key) => key,
            None => {
                warn!("[StockMedia] Unsplash API key non configurée");
                return Ok(None);
            }
        };

        if request.media_type != StockMediaType::Photo {
            return Ok(None); // Unsplash ne supporte que les photos
        }

        let page = request.page.unwrap_or(1);
        let per_page = request
            .per_page
            .unwrap_or(self.config.max_results_per_query.min(30));

        let mut url = format!(
            "https://api.unsplash.com/search/photos?query={}&page={}&per_page={}",
            urlencoding::encode(&request.query),
            page,
            per_page
        );

        if let Some(orientation) = &request.orientation {
            url.push_str(&format!(
                "&orientation={}",
                match orientation {
                    StockMediaOrientation::Landscape => "landscape",
                    StockMediaOrientation::Portrait => "portrait",
                    StockMediaOrientation::Square => "squarish",
                }
            ));
        }

        if let Some(color) = &request.color {
            url.push_str(&format!("&color={}", color));
        }

        let client = reqwest::Client::new();
        let response = timeout(
            Duration::from_secs(10),
            client
                .get(&url)
                .header("Authorization", format!("Client-ID {}", access_key))
                .send(),
        )
        .await
        .map_err(|e| AppError::Internal(format!("Timeout Unsplash: {}", e)))?
        .map_err(|e| AppError::Internal(format!("Erreur Unsplash: {}", e)))?;

        if !response.status().is_success() {
            error!("[StockMedia] Erreur Unsplash: {}", response.status());
            return Ok(None);
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing Unsplash: {}", e)))?;

        let results: Vec<StockMediaResult> = json["results"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .take(self.config.max_results_per_query)
            .filter_map(|item| {
                Some(StockMediaResult {
                    id: format!("unsplash_{}", item["id"].as_str()?),
                    provider: StockMediaProvider::Unsplash,
                    url: item["urls"]["regular"].as_str()?.to_string(),
                    thumbnail_url: item["urls"]["thumb"].as_str()?.to_string(),
                    width: item["width"].as_u64()? as u32,
                    height: item["height"].as_u64()? as u32,
                    author: item["user"]["name"].as_str()?.to_string(),
                    author_url: item["user"]["links"]["html"]
                        .as_str()
                        .map(|s| s.to_string()),
                    license: "Unsplash License".to_string(),
                    tags: item["tags"]
                        .as_array()
                        .unwrap_or(&vec![])
                        .iter()
                        .filter_map(|t| t["title"].as_str().map(|s| s.to_string()))
                        .collect(),
                    download_url: item["links"]["download"].as_str().map(|s| s.to_string()),
                })
            })
            .collect();

        Ok(Some(StockMediaSearchResponse {
            total: json["total"].as_u64().unwrap_or(0) as usize,
            page,
            per_page,
            provider: StockMediaProvider::Unsplash,
            results,
        }))
    }

    /// Recherche Pexels
    async fn search_pexels(
        &self,
        request: &StockMediaSearchRequest,
    ) -> AppResult<Option<StockMediaSearchResponse>> {
        let api_key = match &self.config.pexels_api_key {
            Some(key) => key,
            None => {
                warn!("[StockMedia] Pexels API key non configurée");
                return Ok(None);
            }
        };

        let page = request.page.unwrap_or(1);
        let per_page = request
            .per_page
            .unwrap_or(self.config.max_results_per_query.min(80));

        let media_type = match request.media_type {
            StockMediaType::Photo => "photos",
            StockMediaType::Video => "videos",
        };

        let mut url = format!(
            "https://api.pexels.com/v1/search?query={}&page={}&per_page={}",
            urlencoding::encode(&request.query),
            page,
            per_page
        );

        if let Some(orientation) = &request.orientation {
            url.push_str(&format!(
                "&orientation={}",
                match orientation {
                    StockMediaOrientation::Landscape => "landscape",
                    StockMediaOrientation::Portrait => "portrait",
                    StockMediaOrientation::Square => "square",
                }
            ));
        }

        if let Some(color) = &request.color {
            url.push_str(&format!("&color={}", color));
        }

        let client = reqwest::Client::new();
        let response = timeout(
            Duration::from_secs(10),
            client.get(&url).header("Authorization", api_key).send(),
        )
        .await
        .map_err(|e| AppError::Internal(format!("Timeout Pexels: {}", e)))?
        .map_err(|e| AppError::Internal(format!("Erreur Pexels: {}", e)))?;

        if !response.status().is_success() {
            error!("[StockMedia] Erreur Pexels: {}", response.status());
            return Ok(None);
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing Pexels: {}", e)))?;

        let results: Vec<StockMediaResult> = json[media_type]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .take(self.config.max_results_per_query)
            .filter_map(|item| {
                Some(StockMediaResult {
                    id: format!("pexels_{}", item["id"].as_u64()?),
                    provider: StockMediaProvider::Pexels,
                    url: item["src"]["large"].as_str()?.to_string(),
                    thumbnail_url: item["src"]["medium"].as_str()?.to_string(),
                    width: item["width"].as_u64()? as u32,
                    height: item["height"].as_u64()? as u32,
                    author: item["photographer"].as_str()?.to_string(),
                    author_url: item["photographer_url"].as_str().map(|s| s.to_string()),
                    license: "Pexels License".to_string(),
                    tags: vec![], // Pexels ne fournit pas de tags dans l'API de base
                    download_url: None,
                })
            })
            .collect();

        Ok(Some(StockMediaSearchResponse {
            total: json["total_results"].as_u64().unwrap_or(0) as usize,
            page,
            per_page,
            provider: StockMediaProvider::Pexels,
            results,
        }))
    }

    /// Recherche Pixabay
    async fn search_pixabay(
        &self,
        request: &StockMediaSearchRequest,
    ) -> AppResult<Option<StockMediaSearchResponse>> {
        let api_key = match &self.config.pixabay_api_key {
            Some(key) => key,
            None => {
                warn!("[StockMedia] Pixabay API key non configurée");
                return Ok(None);
            }
        };

        if request.media_type != StockMediaType::Photo {
            return Ok(None); // Pixabay supporte photos et vidéos, mais on se concentre sur photos pour l'instant
        }

        let page = request.page.unwrap_or(1);
        let per_page = request
            .per_page
            .unwrap_or(self.config.max_results_per_query.min(200));

        let mut url = format!(
            "https://pixabay.com/api/?key={}&q={}&page={}&per_page={}&image_type=photo",
            api_key,
            urlencoding::encode(&request.query),
            page,
            per_page
        );

        if let Some(orientation) = &request.orientation {
            url.push_str(&format!(
                "&orientation={}",
                match orientation {
                    StockMediaOrientation::Landscape => "horizontal",
                    StockMediaOrientation::Portrait => "vertical",
                    StockMediaOrientation::Square => "all",
                }
            ));
        }

        if let Some(color) = &request.color {
            url.push_str(&format!("&colors={}", color));
        }

        if let Some(min_width) = request.min_width {
            url.push_str(&format!("&min_width={}", min_width));
        }

        if let Some(min_height) = request.min_height {
            url.push_str(&format!("&min_height={}", min_height));
        }

        let client = reqwest::Client::new();
        let response = timeout(Duration::from_secs(10), client.get(&url).send())
            .await
            .map_err(|e| AppError::Internal(format!("Timeout Pixabay: {}", e)))?
            .map_err(|e| AppError::Internal(format!("Erreur Pixabay: {}", e)))?;

        if !response.status().is_success() {
            error!("[StockMedia] Erreur Pixabay: {}", response.status());
            return Ok(None);
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing Pixabay: {}", e)))?;

        let results: Vec<StockMediaResult> = json["hits"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .take(self.config.max_results_per_query)
            .filter_map(|item| {
                Some(StockMediaResult {
                    id: format!("pixabay_{}", item["id"].as_u64()?),
                    provider: StockMediaProvider::Pixabay,
                    url: item["largeImageURL"].as_str()?.to_string(),
                    thumbnail_url: item["previewURL"].as_str()?.to_string(),
                    width: item["imageWidth"].as_u64()? as u32,
                    height: item["imageHeight"].as_u64()? as u32,
                    author: item["user"].as_str()?.to_string(),
                    author_url: None,
                    license: "Pixabay License".to_string(),
                    tags: item["tags"]
                        .as_str()
                        .map(|s| s.split(',').map(|t| t.trim().to_string()).collect())
                        .unwrap_or_default(),
                    download_url: None,
                })
            })
            .collect();

        Ok(Some(StockMediaSearchResponse {
            total: json["total"].as_u64().unwrap_or(0) as usize,
            page,
            per_page,
            provider: StockMediaProvider::Pixabay,
            results,
        }))
    }
}
