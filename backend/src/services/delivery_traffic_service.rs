//! ✅ Service Trafic pour prédictions ETA
//!
//! Intègre les APIs trafic réelles (Google Maps) pour améliorer
//! la précision des prédictions de temps de livraison.

use crate::core::types::AppResult;
use chrono::{DateTime, Datelike, Timelike, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::time::{Duration, Instant};

/// Conditions de trafic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficConditions {
    pub factor: f64,              // 0.5-2.0 (1.0 = trafic normal)
    pub duration_seconds: i32,    // Durée estimée en secondes
    pub distance_meters: i32,     // Distance en mètres
    pub congestion_level: String, // "light", "moderate", "heavy", "severe"
    pub timestamp: DateTime<Utc>,
}

/// Service trafic avec cache
pub struct DeliveryTrafficService {
    api_key: Option<String>,
    cache: HashMap<String, (TrafficConditions, Instant)>,
    cache_ttl: Duration,
    total_requests: Arc<AtomicU64>,
    cache_hits: Arc<AtomicU64>,
    api_calls: Arc<AtomicU64>,
}

impl DeliveryTrafficService {
    pub fn new() -> Self {
        Self {
            api_key: std::env::var("GOOGLE_MAPS_API_KEY").ok(),
            cache: HashMap::new(),
            cache_ttl: Duration::from_secs(600), // 10 minutes (trafic change plus vite)
            total_requests: Arc::new(AtomicU64::new(0)),
            cache_hits: Arc::new(AtomicU64::new(0)),
            api_calls: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Obtient les conditions de trafic entre deux points
    pub async fn get_traffic(
        &mut self,
        origin_lat: f64,
        origin_lng: f64,
        dest_lat: f64,
        dest_lng: f64,
    ) -> AppResult<TrafficConditions> {
        self.total_requests.fetch_add(1, Ordering::Relaxed);

        // Vérifier le cache
        let cache_key = format!(
            "{:.4}_{:.4}_{:.4}_{:.4}",
            origin_lat, origin_lng, dest_lat, dest_lng
        );
        if let Some((cached, cached_time)) = self.cache.get(&cache_key) {
            if cached_time.elapsed() < self.cache_ttl {
                self.cache_hits.fetch_add(1, Ordering::Relaxed);
                return Ok(cached.clone());
            }
        }

        // Appeler l'API trafic
        let traffic = if let Some(api_key) = &self.api_key {
            self.fetch_traffic_from_api(origin_lat, origin_lng, dest_lat, dest_lng, api_key)
                .await?
        } else {
            // Fallback: estimer selon l'heure
            self.estimate_traffic_by_time(origin_lat, origin_lng, dest_lat, dest_lng)
                .await
        };

        // Mettre en cache
        self.cache
            .insert(cache_key, (traffic.clone(), Instant::now()));
        Ok(traffic)
    }

    /// Appelle l'API Google Maps Directions
    async fn fetch_traffic_from_api(
        &self,
        origin_lat: f64,
        origin_lng: f64,
        dest_lat: f64,
        dest_lng: f64,
        api_key: &str,
    ) -> AppResult<TrafficConditions> {
        self.api_calls.fetch_add(1, Ordering::Relaxed);

        let origin = format!("{},{}", origin_lat, origin_lng);
        let destination = format!("{},{}", dest_lat, dest_lng);
        let url = format!(
            "https://maps.googleapis.com/maps/api/directions/json?origin={}&destination={}&key={}&departure_time=now&traffic_model=best_guess",
            origin, destination, api_key
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| {
                log::warn!("[Traffic] Erreur API: {}, fallback estimation", e);
                crate::core::types::AppError::Internal(format!("Erreur API trafic: {}", e))
            })?;

        if !response.status().is_success() {
            log::warn!(
                "[Traffic] API retourne erreur: {}, fallback",
                response.status()
            );
            return Ok(self
                .estimate_traffic_by_time(origin_lat, origin_lng, dest_lat, dest_lng)
                .await);
        }

        let data: serde_json::Value = response.json().await.map_err(|e| {
            log::warn!("[Traffic] Erreur parsing JSON: {}, fallback", e);
            crate::core::types::AppError::Internal(format!("Erreur parsing trafic: {}", e))
        })?;

        // Parser la réponse Google Maps
        if let Some(routes) = data["routes"].as_array() {
            if let Some(route) = routes.first() {
                if let Some(legs) = route["legs"].as_array() {
                    if let Some(leg) = legs.first() {
                        let duration_in_traffic = leg["duration_in_traffic"]["value"]
                            .as_i64()
                            .or_else(|| leg["duration"]["value"].as_i64())
                            .unwrap_or(0) as i32;
                        let duration_normal = leg["duration"]["value"].as_i64().unwrap_or(1) as i32;
                        let distance = leg["distance"]["value"].as_i64().unwrap_or(0) as i32;

                        // Calculer le facteur de trafic
                        let factor = if duration_normal > 0 {
                            (duration_in_traffic as f64 / duration_normal as f64)
                                .max(0.5)
                                .min(2.0)
                        } else {
                            1.0
                        };

                        // Déterminer le niveau de congestion
                        let congestion_level = if factor < 1.1 {
                            "light"
                        } else if factor < 1.3 {
                            "moderate"
                        } else if factor < 1.6 {
                            "heavy"
                        } else {
                            "severe"
                        };

                        return Ok(TrafficConditions {
                            factor,
                            duration_seconds: duration_in_traffic,
                            distance_meters: distance,
                            congestion_level: congestion_level.to_string(),
                            timestamp: Utc::now(),
                        });
                    }
                }
            }
        }

        // Fallback si parsing échoue
        Ok(self
            .estimate_traffic_by_time(origin_lat, origin_lng, dest_lat, dest_lng)
            .await)
    }

    /// Estime le trafic selon l'heure (fallback si pas d'API)
    pub async fn estimate_traffic_by_time(
        &self,
        _origin_lat: f64,
        _origin_lng: f64,
        _dest_lat: f64,
        _dest_lng: f64,
    ) -> TrafficConditions {
        let now = Utc::now();
        let hour = now.hour();
        let day_of_week = now.weekday().num_days_from_monday();

        // Facteur selon l'heure
        let factor: f64 = match hour {
            7..=9 => 1.4,           // Heure de pointe matin
            17..=19 => 1.5,         // Heure de pointe soir
            12..=14 => 1.2,         // Pause déjeuner
            22..=23 | 0..=6 => 0.9, // Nuit
            _ => 1.0,
        };

        // Weekend moins de trafic
        let weekend_factor: f64 = if day_of_week >= 5 { 0.85 } else { 1.0 };
        let final_factor = (factor * weekend_factor).max(0.5).min(2.0);

        TrafficConditions {
            factor: final_factor,
            duration_seconds: 0, // Non disponible sans API
            distance_meters: 0,  // Non disponible sans API
            congestion_level: if final_factor < 1.1 {
                "light"
            } else if final_factor < 1.3 {
                "moderate"
            } else {
                "heavy"
            }
            .to_string(),
            timestamp: Utc::now(),
        }
    }

    /// Obtient les métriques
    pub fn get_metrics(&self) -> TrafficMetrics {
        TrafficMetrics {
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

/// Métriques trafic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficMetrics {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub api_calls: u64,
    pub cache_size: usize,
}

impl Default for DeliveryTrafficService {
    fn default() -> Self {
        Self::new()
    }
}
