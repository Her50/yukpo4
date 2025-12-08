//! ✅ Demand Forecasting pour prédire la demande par zone/heure
//!
//! Ce service utilise le Machine Learning pour prédire la demande de livraisons
//! par zone géographique et heure, permettant d'optimiser l'allocation des coursiers.

use crate::core::types::AppResult;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Zone géographique (grid cell)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GeoZone {
    pub zone_id: String, // Format: "lat_lng" arrondi
    pub latitude: f64,
    pub longitude: f64,
    pub radius_km: f64,
}

/// Prédiction de demande
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemandForecast {
    pub zone: GeoZone,
    pub hour: u8,              // 0-23
    pub day_of_week: u8,       // 0-6
    pub predicted_demand: f64, // Nombre de livraisons attendues
    pub confidence: f32,       // 0.0-1.0
    pub historical_avg: f64,
    pub trend: String, // "increasing", "decreasing", "stable"
}

/// Service de forecasting
pub struct DeliveryDemandForecastingService {
    // Cache des prédictions
    forecast_cache: HashMap<String, (DemandForecast, DateTime<Utc>)>,
    // Données historiques agrégées
    historical_data: HashMap<String, Vec<f64>>, // zone_hour -> [demand values]
}

impl DeliveryDemandForecastingService {
    pub fn new() -> Self {
        Self {
            forecast_cache: HashMap::new(),
            historical_data: HashMap::new(),
        }
    }

    /// Prédit la demande pour une zone et heure
    pub async fn forecast_demand(
        &mut self,
        zone: GeoZone,
        hour: u8,
        day_of_week: u8,
    ) -> AppResult<DemandForecast> {
        let cache_key = format!("{}_{}_{}", zone.zone_id, hour, day_of_week);

        // Vérifier le cache (1 heure)
        if let Some((cached, cached_time)) = self.forecast_cache.get(&cache_key) {
            let elapsed = chrono::Utc::now() - *cached_time;
            if elapsed.num_hours() < 1 {
                return Ok(cached.clone());
            }
        }

        // Calculer prédiction
        let forecast = self.calculate_forecast(&zone, hour, day_of_week).await?;

        // Mettre en cache
        self.forecast_cache
            .insert(cache_key, (forecast.clone(), Utc::now()));

        Ok(forecast)
    }

    /// Calcule la prédiction avec modèle simple (moving average + trend)
    async fn calculate_forecast(
        &self,
        zone: &GeoZone,
        hour: u8,
        day_of_week: u8,
    ) -> AppResult<DemandForecast> {
        let key = format!("{}_{}", zone.zone_id, hour);
        let historical = self.historical_data.get(&key).cloned().unwrap_or_default();

        // Moyenne historique
        let historical_avg = if !historical.is_empty() {
            historical.iter().sum::<f64>() / historical.len() as f64
        } else {
            2.0 // Valeur par défaut
        };

        // Facteur jour de semaine
        let day_factor = match day_of_week {
            0 | 6 => 0.8, // Weekend moins de demande
            1..=4 => 1.1, // Semaine plus de demande
            5 => 1.0,     // Vendredi
            _ => 1.0,
        };

        // Facteur heure (pics de demande)
        let hour_factor = match hour {
            7..=9 => 1.3,   // Matin
            12..=14 => 1.4, // Déjeuner
            17..=20 => 1.5, // Soir
            21..=23 => 1.2, // Nuit
            _ => 0.8,       // Autres heures
        };

        // Prédiction = moyenne historique * facteurs
        let predicted_demand = historical_avg * day_factor * hour_factor;

        // Calculer trend (simple: comparer dernières valeurs)
        let trend = if historical.len() >= 7 {
            let recent_avg: f64 = historical.iter().rev().take(3).sum::<f64>() / 3.0;
            let older_avg: f64 = historical.iter().rev().skip(3).take(3).sum::<f64>() / 3.0;
            if recent_avg > older_avg * 1.1 {
                "increasing".to_string()
            } else if recent_avg < older_avg * 0.9 {
                "decreasing".to_string()
            } else {
                "stable".to_string()
            }
        } else {
            "stable".to_string()
        };

        // Confiance basée sur quantité de données
        let confidence = if historical.len() > 20 {
            0.85
        } else if historical.len() > 10 {
            0.70
        } else {
            0.50
        };

        Ok(DemandForecast {
            zone: zone.clone(),
            hour,
            day_of_week,
            predicted_demand,
            confidence,
            historical_avg,
            trend,
        })
    }

    /// Enregistre une demande réelle (pour améliorer le modèle)
    pub async fn record_actual_demand(
        &mut self,
        zone: GeoZone,
        hour: u8,
        actual_demand: f64,
    ) -> AppResult<()> {
        let key = format!("{}_{}", zone.zone_id, hour);
        let historical = self.historical_data.entry(key).or_insert_with(Vec::new);

        historical.push(actual_demand);

        // Garder seulement les 100 dernières valeurs
        if historical.len() > 100 {
            historical.remove(0);
        }

        // Invalider le cache pour cette zone/heure
        let cache_key = format!("{}_{}_0", zone.zone_id, hour); // day_of_week = 0 pour pattern
        self.forecast_cache
            .retain(|k, _| !k.starts_with(&cache_key));

        log::info!(
            "[Demand Forecasting] Recorded demand {} for zone {} at hour {}",
            actual_demand,
            zone.zone_id,
            hour
        );

        Ok(())
    }

    /// Obtient les zones à forte demande (heat map)
    pub async fn get_high_demand_zones(
        &mut self,
        _start_date: NaiveDate,
        _end_date: NaiveDate,
        _radius_km: f64,
    ) -> AppResult<Vec<DemandForecast>> {
        // TODO: Implémenter requête toutes zones
        // Pour l'instant, retourner vide
        Ok(Vec::new())
    }
}

impl Default for DeliveryDemandForecastingService {
    fn default() -> Self {
        Self::new()
    }
}
