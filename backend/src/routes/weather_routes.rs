use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct WeatherParams {
    pub lat: f64,
    pub lon: f64,
    pub units: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WeatherResponse {
    pub main: WeatherMain,
    pub weather: Vec<WeatherInfo>,
    pub wind: WeatherWind,
    pub name: String,
    pub sys: WeatherSys,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WeatherMain {
    pub temp: f64,
    pub humidity: i32,
    pub pressure: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WeatherInfo {
    pub description: String,
    pub icon: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WeatherWind {
    pub speed: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WeatherSys {
    pub country: String,
}

/// Récupère les données météo depuis OpenWeatherMap
pub async fn get_weather(
    Query(params): Query<WeatherParams>,
    State(_state): State<Arc<AppState>>,
) -> Json<WeatherResponse> {
    let api_key = match std::env::var("OPENWEATHER_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            return Json(WeatherResponse {
                main: WeatherMain {
                    temp: 0.0,
                    humidity: 0,
                    pressure: 0,
                },
                weather: vec![WeatherInfo {
                    description: "API key manquante".to_string(),
                    icon: "01d".to_string(),
                }],
                wind: WeatherWind { speed: 0.0 },
                name: "Erreur".to_string(),
                sys: WeatherSys {
                    country: "XX".to_string(),
                },
            });
        }
    };

    let units = params.units.unwrap_or_else(|| "metric".to_string());
    let lang = params.lang.unwrap_or_else(|| "fr".to_string());

    let url = format!(
        "https://api.openweathermap.org/data/2.5/weather?lat={}&lon={}&appid={}&units={}&lang={}",
        params.lat, params.lon, api_key, units, lang
    );

    let client = Client::new();
    let response = match client.get(&url).send().await {
        Ok(resp) => resp,
        Err(_) => {
            return Json(WeatherResponse {
                main: WeatherMain {
                    temp: 0.0,
                    humidity: 0,
                    pressure: 0,
                },
                weather: vec![WeatherInfo {
                    description: "Erreur de connexion".to_string(),
                    icon: "01d".to_string(),
                }],
                wind: WeatherWind { speed: 0.0 },
                name: "Erreur".to_string(),
                sys: WeatherSys {
                    country: "XX".to_string(),
                },
            });
        }
    };

    if !response.status().is_success() {
        return Json(WeatherResponse {
            main: WeatherMain {
                temp: 0.0,
                humidity: 0,
                pressure: 0,
            },
            weather: vec![WeatherInfo {
                description: "Erreur API météo".to_string(),
                icon: "01d".to_string(),
            }],
            wind: WeatherWind { speed: 0.0 },
            name: "Erreur".to_string(),
            sys: WeatherSys {
                country: "XX".to_string(),
            },
        });
    }

    let weather_data: WeatherResponse = match response.json().await {
        Ok(data) => data,
        Err(_) => {
            return Json(WeatherResponse {
                main: WeatherMain {
                    temp: 0.0,
                    humidity: 0,
                    pressure: 0,
                },
                weather: vec![WeatherInfo {
                    description: "Erreur de parsing".to_string(),
                    icon: "01d".to_string(),
                }],
                wind: WeatherWind { speed: 0.0 },
                name: "Erreur".to_string(),
                sys: WeatherSys {
                    country: "XX".to_string(),
                },
            });
        }
    };

    Json(weather_data)
}

/// Endpoint pour exposer la configuration météo (clé API) pour l'app mobile
pub async fn get_weather_config(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<Value>, StatusCode> {
    let api_key = std::env::var("OPENWEATHER_API_KEY")
        .unwrap_or_else(|_| "YOUR_OPENWEATHER_API_KEY".to_string());

    Ok(Json(json!({
        "apiKey": api_key,
        "status": "success",
        "message": "Configuration météo récupérée avec succès"
    })))
}

pub fn weather_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route("/weather", get(get_weather))
        .route("/weather/config", get(get_weather_config))
        .with_state(state)
}
