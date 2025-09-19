use serde::{Deserialize, Serialize};
use crate::core::types::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct GeocodingResult {
    pub address: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub formatted_address: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
}

pub struct GeocodingService;

impl GeocodingService {
    pub fn new() -> Self {
        Self
    }

    pub async fn reverse_geocode(&self, latitude: f64, longitude: f64) -> Result<GeocodingResult, AppError> {
        let result = GeocodingResult {
            address: Some(format!("Position: {:.6}, {:.6}", latitude, longitude)),
            city: Some("Ville non determinee".to_string()),
            country: Some("Pays non determine".to_string()),
            formatted_address: Some(format!("Latitude: {:.6}, Longitude: {:.6}", latitude, longitude)),
            latitude,
            longitude,
        };
        Ok(result)
    }
}

impl Default for GeocodingService {
    fn default() -> Self {
        Self::new()
    }
}
