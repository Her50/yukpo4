//! ✅ Service Météo pour prédictions ETA et Forecasting
//!
//! Intègre les APIs météo réelles (OpenWeatherMap) pour améliorer
//! la précision des prédictions de livraison.

use crate::core::types::AppResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::time::{Duration, Instant};

/// Conditions météo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherConditions {
    pub temperature: f64,    // Celsius
    pub humidity: f64,       // 0-100%
    pub wind_speed: f64,     // km/h
    pub wind_direction: f64, // degrés
    pub precipitation: f64,  // mm/h
    pub visibility: f64,     // km
    pub condition: String,   // "clear", "rain", "storm", etc.
    pub factor: f64,         // 0.0-2.0 (1.0 = conditions normales)
    pub timestamp: DateTime<Utc>,
}

/// Service météo avec cache
pub struct DeliveryWeatherService {
    api_key: Option<String>,
    cache: HashMap<String, (WeatherConditions, Instant)>,
    cache_ttl: Duration,
    total_requests: Arc<AtomicU64>,
    cache_hits: Arc<AtomicU64>,
    api_calls: Arc<AtomicU64>,
}

impl DeliveryWeatherService {
    pub fn new() -> Self {
        Self {
            api_key: std::env::var("OPENWEATHERMAP_API_KEY").ok(),
            cache: HashMap::new(),
            cache_ttl: Duration::from_secs(1800), // 30 minutes
            total_requests: Arc::new(AtomicU64::new(0)),
            cache_hits: Arc::new(AtomicU64::new(0)),
            api_calls: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Obtient les conditions météo pour une localisation
    pub async fn get_weather(&mut self, lat: f64, lng: f64) -> AppResult<WeatherConditions> {
        self.total_requests.fetch_add(1, Ordering::Relaxed);

        // Vérifier le cache
        let cache_key = format!("{:.4}_{:.4}", lat, lng);
        if let Some((cached, cached_time)) = self.cache.get(&cache_key) {
            if cached_time.elapsed() < self.cache_ttl {
                self.cache_hits.fetch_add(1, Ordering::Relaxed);
                return Ok(cached.clone());
            }
        }

        // Appeler l'API météo
        let weather = if let Some(api_key) = &self.api_key {
            self.fetch_weather_from_api(lat, lng, api_key).await?
        } else {
            // Fallback: conditions normales si pas d'API key
            self.get_default_weather()
        };

        // Mettre en cache
        self.cache.insert(cache_key, (weather.clone(), Instant::now()));
        Ok(weather)
    }

    /// Appelle l'API OpenWeatherMap
    async fn fetch_weather_from_api(
        &self,
        lat: f64,
        lng: f64,
        api_key: &str,
    ) -> AppResult<WeatherConditions> {
        self.api_calls.fetch_add(1, Ordering::Relaxed);

        let url = format!(
            "https://api.openweathermap.org/data/2.5/weather?lat={}&lon={}&appid={}&units=metric&lang=fr",
            lat, lng, api_key
        );

        let client = reqwest::Client::new();
        let response =
            client.get(&url).timeout(Duration::from_secs(5)).send().await.map_err(|e| {
                log::warn!("[Weather] Erreur API: {}, fallback conditions normales", e);
                crate::core::types::AppError::Internal(format!("Erreur API météo: {}", e))
            })?;

        if !response.status().is_success() {
            log::warn!(
                "[Weather] API retourne erreur: {}, fallback",
                response.status()
            );
            return Ok(self.get_default_weather());
        }

        let data: serde_json::Value = response.json().await.map_err(|e| {
            log::warn!("[Weather] Erreur parsing JSON: {}, fallback", e);
            crate::core::types::AppError::Internal(format!("Erreur parsing météo: {}", e))
        })?;

        // Parser la réponse OpenWeatherMap
        let temp = data["main"]["temp"].as_f64().unwrap_or(25.0);
        let humidity = data["main"]["humidity"].as_f64().unwrap_or(60.0);
        let wind_speed = data["wind"]["speed"].as_f64().unwrap_or(0.0) * 3.6; // m/s -> km/h
        let wind_dir = data["wind"]["deg"].as_f64().unwrap_or(0.0);
        let precipitation = data["rain"]["1h"]
            .as_f64()
            .or_else(|| data["rain"]["3h"].as_f64().map(|v| v / 3.0))
            .unwrap_or(0.0);
        let visibility = data["visibility"].as_f64().unwrap_or(10000.0) / 1000.0; // m -> km
        let condition = data["weather"][0]["main"].as_str().unwrap_or("Clear").to_lowercase();

        // Calculer le facteur météo (1.0 = normal, >1.0 = ralentit, <1.0 = accélère)
        let factor =
            self.calculate_weather_factor(&condition, precipitation, wind_speed, visibility);

        Ok(WeatherConditions {
            temperature: temp,
            humidity,
            wind_speed,
            wind_direction: wind_dir,
            precipitation,
            visibility,
            condition,
            factor,
            timestamp: Utc::now(),
        })
    }

    /// Calcule le facteur météo (impact sur la livraison)
    fn calculate_weather_factor(
        &self,
        condition: &str,
        precipitation: f64,
        wind_speed: f64,
        visibility: f64,
    ) -> f64 {
        // Impact des conditions
        let mut factor = match condition {
            "clear" | "sunny" => 0.95, // Légèrement plus rapide
            "clouds" => 1.0,
            "rain" | "drizzle" => 1.2 + (precipitation / 10.0).min(0.5),
            "thunderstorm" => 1.5,
            "snow" => 1.8,
            "fog" | "mist" => 1.3,
            _ => 1.1,
        };

        // Impact du vent fort (ralentit)
        if wind_speed > 30.0 {
            factor += (wind_speed - 30.0) / 100.0;
        }

        // Impact de la visibilité réduite
        if visibility < 1.0 {
            factor += 0.3;
        } else if visibility < 5.0 {
            factor += 0.1;
        }

        factor.max(0.5).min(2.0) // Limiter entre 0.5 et 2.0
    }

    /// Conditions météo par défaut (si API non disponible)
    pub fn get_default_weather(&self) -> WeatherConditions {
        WeatherConditions {
            temperature: 25.0,
            humidity: 60.0,
            wind_speed: 10.0,
            wind_direction: 0.0,
            precipitation: 0.0,
            visibility: 10.0,
            condition: "clear".to_string(),
            factor: 1.0,
            timestamp: Utc::now(),
        }
    }

    /// Obtient les métriques
    pub fn get_metrics(&self) -> WeatherMetrics {
        WeatherMetrics {
            total_requests: self.total_requests.load(Ordering::Relaxed),
            cache_hits: self.cache_hits.load(Ordering::Relaxed),
            api_calls: self.api_calls.load(Ordering::Relaxed),
            cache_size: self.cache.len(),
        }
    }

    /// Nettoie le cache
    pub fn cleanup_cache(&mut self) {
        let now = Instant::now();
        self.cache
            .retain(|_, (_, cached_time)| now.duration_since(*cached_time) < self.cache_ttl);
    }
}

/// Métriques météo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherMetrics {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub api_calls: u64,
    pub cache_size: usize,
}

impl Default for DeliveryWeatherService {
    fn default() -> Self {
        Self::new()
    }
}
