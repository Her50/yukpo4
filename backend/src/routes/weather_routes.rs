use std::sync::Arc;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use reqwest::Client;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct WeatherParams {
    pub lat: f64,
    pub lon: f64,
    pub units: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WeatherResponse {
    pub main: WeatherMain,
    pub weather: Vec<WeatherInfo>,
    pub wind: WeatherWind,
    pub name: String,
    pub sys: WeatherSys,
}

#[derive(Debug, Serialize)]
pub struct WeatherMain {
    pub temp: f64,
    pub humidity: i32,
    pub pressure: i32,
}

#[derive(Debug, Serialize)]
pub struct WeatherInfo {
    pub description: String,
    pub icon: String,
}

#[derive(Debug, Serialize)]
pub struct WeatherWind {
    pub speed: f64,
}

#[derive(Debug, Serialize)]
pub struct WeatherSys {
    pub country: String,
}

/// Récupère les données météo depuis OpenWeatherMap
pub async fn get_weather(
    Query(params): Query<WeatherParams>,
    State(_state): State<Arc<AppState>>,
) -> Result<Json<WeatherResponse>, StatusCode> {
    let api_key = std::env::var("OPENWEATHER_API_KEY")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let units = params.units.unwrap_or_else(|| "metric".to_string());
    let lang = params.lang.unwrap_or_else(|| "fr".to_string());
    
    let url = format!(
        "https://api.openweathermap.org/data/2.5/weather?lat={}&lon={}&appid={}&units={}&lang={}",
        params.lat, params.lon, api_key, units, lang
    );
    
    let client = Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if !response.status().is_success() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    let weather_data: WeatherResponse = response
        .json()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(weather_data))
}

pub fn weather_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route("/weather", get(get_weather))
        .with_state(state)
}
