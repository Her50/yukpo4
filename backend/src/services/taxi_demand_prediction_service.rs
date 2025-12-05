//! ✅ Service de Prédiction de Demande pour Taxi/Covoiturage
//!
//! Prédit les pics de demande par zone géographique et heure
//! pour optimiser l'allocation des véhicules

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::AppIA;
use crate::services::delivery_weather_service::DeliveryWeatherService;
use chrono::{DateTime, Datelike, NaiveDateTime, Timelike, Utc};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Zone géographique pour prédiction
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PredictionZone {
    pub zone_id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub radius_km: f64,
    pub name: Option<String>,
}

/// Période de prédiction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PredictionPeriod {
    NextHour,
    NextDay,
    NextWeek,
}

/// Features pour prédiction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemandFeatures {
    pub zone_id: String,
    pub hour: u8,
    pub day_of_week: u8,
    pub month: u8,
    pub is_weekend: bool,
    pub is_holiday: bool,
    pub historical_avg: f64,
    pub historical_trend: f64,
    pub weather_factor: f64,
    pub event_factor: f64, // Événements locaux
}

/// Résultat de prédiction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemandPrediction {
    pub zone: PredictionZone,
    pub predicted_demand: f64,     // Nombre de demandes attendues
    pub confidence: f32,           // 0.0-1.0
    pub peak_hours: Vec<u8>,       // Heures de pic
    pub recommended_vehicles: i32, // Nombre de véhicules recommandés
    pub historical_avg: f64,
    pub trend: String,                 // "increasing", "decreasing", "stable"
    pub factors: HashMap<String, f64>, // Facteurs influençant
    pub timestamp: DateTime<Utc>,
}

/// Service de prédiction de demande
pub struct TaxiDemandPredictionService {
    pool: Arc<PgPool>,
    app_ia: Option<Arc<AppIA>>,
    ml_models: Option<
        Arc<tokio::sync::Mutex<crate::services::delivery_ml_models::DeliveryMLModelsService>>,
    >,
    cache: Arc<tokio::sync::RwLock<HashMap<String, (DemandPrediction, DateTime<Utc>)>>>,
    total_predictions: Arc<AtomicU64>,
    ai_predictions: Arc<AtomicU64>,
    ml_predictions: Arc<AtomicU64>,
    fallback_predictions: Arc<AtomicU64>,
}

impl TaxiDemandPredictionService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        // Initialiser ML models si disponible
        let ml_models = if std::env::var("ML_MODELS_DIR").is_ok() {
            Some(Arc::new(tokio::sync::Mutex::new(
                crate::services::delivery_ml_models::DeliveryMLModelsService::new(),
            )))
        } else {
            None
        };

        Self {
            pool,
            app_ia: None,
            ml_models,
            cache: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
            total_predictions: Arc::new(AtomicU64::new(0)),
            ai_predictions: Arc::new(AtomicU64::new(0)),
            ml_predictions: Arc::new(AtomicU64::new(0)),
            fallback_predictions: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Injecter AppIA pour prédictions IA
    pub fn with_app_ia(mut self, app_ia: Arc<AppIA>) -> Self {
        self.app_ia = Some(app_ia);
        self
    }

    /// Prédire la demande pour une zone et période
    pub async fn predict_demand(
        &self,
        zone: &PredictionZone,
        period: PredictionPeriod,
        target_datetime: Option<DateTime<Utc>>,
    ) -> AppResult<DemandPrediction> {
        self.total_predictions.fetch_add(1, Ordering::Relaxed);

        let target = target_datetime.unwrap_or_else(Utc::now);
        let cache_key = format!("{}_{:?}_{}", zone.zone_id, period, target.timestamp());

        // Vérifier cache (TTL 1h)
        {
            let cache_guard = self.cache.read().await;
            if let Some((cached, cached_time)) = cache_guard.get(&cache_key) {
                if cached_time.elapsed().unwrap().as_secs() < 3600 {
                    info!(
                        "[TaxiDemandPrediction] ✅ Cache hit pour zone {}",
                        zone.zone_id
                    );
                    return Ok(cached.clone());
                }
            }
        }

        info!(
            "[TaxiDemandPrediction] Prédiction demande zone={}, période={:?}",
            zone.zone_id, period
        );

        // 1. Récupérer données historiques
        let historical_data = self.get_historical_data(zone, &period).await?;

        // 2. Calculer features
        let features = self
            .calculate_features(zone, &target, &historical_data)
            .await?;

        // 3. Prédiction (priorité: ML > IA > Fallback)
        let prediction = if let Some(ml_models) = &self.ml_models {
            // Essayer ML d'abord
            match self
                .predict_with_ml(ml_models, &features, zone, &target)
                .await
            {
                Ok(pred) => {
                    self.ml_predictions.fetch_add(1, Ordering::Relaxed);
                    pred
                }
                Err(e) => {
                    warn!("[TaxiDemandPrediction] ML échoué, fallback IA: {}", e);
                    self.predict_with_ai_or_fallback(&features, zone, &target, &historical_data)
                        .await?
                }
            }
        } else {
            self.predict_with_ai_or_fallback(&features, zone, &target, &historical_data)
                .await?
        };

        // 4. Mettre en cache
        {
            let mut cache_guard = self.cache.write().await;
            cache_guard.insert(cache_key, (prediction.clone(), Utc::now()));
        }

        Ok(prediction)
    }

    /// Prédiction avec ML
    async fn predict_with_ml(
        &self,
        ml_models: &Arc<
            tokio::sync::Mutex<crate::services::delivery_ml_models::DeliveryMLModelsService>,
        >,
        features: &DemandFeatures,
        zone: &PredictionZone,
        target: &DateTime<Utc>,
    ) -> AppResult<DemandPrediction> {
        let models = ml_models.lock().await;

        // Convertir features pour ML
        let ml_features = crate::services::delivery_ml_models::ForecastingFeatures {
            zone_id: features.zone_id.clone(),
            latitude: zone.latitude,
            longitude: zone.longitude,
            hour: features.hour,
            day_of_week: features.day_of_week,
            month: features.month,
            historical_avg: features.historical_avg,
            historical_trend: features.historical_trend,
            weather_factor: features.weather_factor,
            is_holiday: features.is_holiday,
        };

        // Prédire avec ML
        let predicted_demand = models.predict_demand(&ml_features).await?;

        // Calculer confiance basée sur historique
        let confidence = if features.historical_avg > 0.0 {
            (1.0 - (predicted_demand - features.historical_avg).abs()
                / features.historical_avg.max(1.0))
            .max(0.0)
            .min(1.0) as f32
        } else {
            0.7
        };

        // Identifier heures de pic (simplifié)
        let peak_hours = self.identify_peak_hours(&features).await?;

        // Recommandation véhicules (1 véhicule pour 3 demandes)
        let recommended_vehicles = (predicted_demand / 3.0).ceil() as i32;

        Ok(DemandPrediction {
            zone: zone.clone(),
            predicted_demand,
            confidence,
            peak_hours,
            recommended_vehicles,
            historical_avg: features.historical_avg,
            trend: if features.historical_trend > 0.1 {
                "increasing".to_string()
            } else if features.historical_trend < -0.1 {
                "decreasing".to_string()
            } else {
                "stable".to_string()
            },
            factors: HashMap::from([
                ("historical".to_string(), features.historical_avg),
                ("trend".to_string(), features.historical_trend),
                ("weather".to_string(), features.weather_factor),
                ("events".to_string(), features.event_factor),
            ]),
            timestamp: *target,
        })
    }

    /// Prédiction avec IA ou fallback
    async fn predict_with_ai_or_fallback(
        &self,
        features: &DemandFeatures,
        zone: &PredictionZone,
        target: &DateTime<Utc>,
        historical_data: &HistoricalData,
    ) -> AppResult<DemandPrediction> {
        if let Some(app_ia) = &self.app_ia {
            match self
                .predict_with_ai(app_ia, features, zone, target, historical_data)
                .await
            {
                Ok(pred) => {
                    self.ai_predictions.fetch_add(1, Ordering::Relaxed);
                    return Ok(pred);
                }
                Err(e) => {
                    warn!("[TaxiDemandPrediction] IA échoué, fallback: {}", e);
                }
            }
        }

        // Fallback: Prédiction basique basée sur historique
        self.fallback_predictions.fetch_add(1, Ordering::Relaxed);
        self.predict_fallback(features, zone, target, historical_data)
            .await
    }

    /// Prédiction avec IA
    async fn predict_with_ai(
        &self,
        app_ia: &Arc<AppIA>,
        features: &DemandFeatures,
        zone: &PredictionZone,
        target: &DateTime<Utc>,
        historical_data: &HistoricalData,
    ) -> AppResult<DemandPrediction> {
        let prompt = format!(
            r#"Tu es un expert en prédiction de demande pour transport partagé.

Analyse les données historiques et prédit la demande pour:
- Zone: {} ({}, {})
- Date/Heure: {}
- Jour de semaine: {}
- Heure: {}h
- Weekend: {}
- Vacances: {}

Données historiques:
- Moyenne historique: {:.2} demandes/heure
- Tendance: {:.2}%
- Facteur météo: {:.2}
- Facteur événements: {:.2}

Historique récent (dernières 7 jours):
{}

Retourne UNIQUEMENT un JSON avec:
{{
    "predicted_demand": <nombre décimal>,
    "confidence": <0.0-1.0>,
    "peak_hours": [<heures de pic>],
    "recommended_vehicles": <nombre entier>,
    "trend": "increasing" | "decreasing" | "stable",
    "factors": {{
        "historical": <poids>,
        "trend": <poids>,
        "weather": <poids>,
        "events": <poids>
    }}
}}"#,
            zone.zone_id,
            zone.latitude,
            zone.longitude,
            target.format("%Y-%m-%d %H:%M"),
            features.day_of_week,
            features.hour,
            features.is_weekend,
            features.is_holiday,
            features.historical_avg,
            features.historical_trend * 100.0,
            features.weather_factor,
            features.event_factor,
            self.format_historical_data(historical_data)
        );

        let (_, response, _) = app_ia.predict(&prompt).await?;

        // Parser JSON
        let prediction_json: Value = serde_json::from_str(&response)
            .map_err(|e| AppError::Internal(format!("Erreur parsing IA: {}", e)))?;

        let predicted_demand = prediction_json
            .get("predicted_demand")
            .and_then(|v| v.as_f64())
            .unwrap_or(features.historical_avg);

        let confidence = prediction_json
            .get("confidence")
            .and_then(|v| v.as_f64())
            .map(|f| f as f32)
            .unwrap_or(0.75);

        let peak_hours: Vec<u8> = prediction_json
            .get("peak_hours")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_u64().map(|u| u as u8))
                    .collect()
            })
            .unwrap_or_default();
        
        // Si peak_hours est vide, calculer avec identify_peak_hours
        let peak_hours = if peak_hours.is_empty() {
            self.identify_peak_hours(features).await.unwrap_or_default()
        } else {
            peak_hours
        };

        let recommended_vehicles = prediction_json
            .get("recommended_vehicles")
            .and_then(|v| v.as_i64())
            .map(|i| i as i32)
            .unwrap_or((predicted_demand / 3.0).ceil() as i32);

        let trend = prediction_json
            .get("trend")
            .and_then(|v| v.as_str())
            .unwrap_or("stable")
            .to_string();

        let factors = prediction_json
            .get("factors")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| v.as_f64().map(|f| (k.clone(), f)))
                    .collect()
            })
            .unwrap_or_default();

        Ok(DemandPrediction {
            zone: zone.clone(),
            predicted_demand,
            confidence,
            peak_hours,
            recommended_vehicles,
            historical_avg: features.historical_avg,
            trend,
            factors,
            timestamp: *target,
        })
    }

    /// Prédiction fallback (basique)
    async fn predict_fallback(
        &self,
        features: &DemandFeatures,
        zone: &PredictionZone,
        target: &DateTime<Utc>,
        historical_data: &HistoricalData,
    ) -> AppResult<DemandPrediction> {
        // Prédiction simple: moyenne historique + tendance + facteurs
        let base_demand = features.historical_avg;
        let trend_adjustment = base_demand * features.historical_trend;
        let weather_adjustment = base_demand * (features.weather_factor - 1.0) * 0.2;
        let event_adjustment = base_demand * (features.event_factor - 1.0) * 0.3;
        let weekend_adjustment = if features.is_weekend {
            base_demand * 0.15
        } else {
            0.0
        };

        let predicted_demand = (base_demand
            + trend_adjustment
            + weather_adjustment
            + event_adjustment
            + weekend_adjustment)
            .max(0.0);

        let peak_hours = self.identify_peak_hours(features).await.unwrap_or_else(|| -> Vec<u8> {
            // Heures de pic par défaut
            if features.is_weekend {
                vec![10, 11, 12, 18, 19, 20]
            } else {
                vec![7, 8, 9, 17, 18, 19]
            }
        });

        Ok(DemandPrediction {
            zone: zone.clone(),
            predicted_demand,
            confidence: 0.7,
            peak_hours,
            recommended_vehicles: (predicted_demand / 3.0).ceil() as i32,
            historical_avg: features.historical_avg,
            trend: if features.historical_trend > 0.1 {
                "increasing".to_string()
            } else if features.historical_trend < -0.1 {
                "decreasing".to_string()
            } else {
                "stable".to_string()
            },
            factors: HashMap::from([
                ("historical".to_string(), features.historical_avg),
                ("trend".to_string(), features.historical_trend),
                ("weather".to_string(), features.weather_factor),
                ("events".to_string(), features.event_factor),
            ]),
            timestamp: *target,
        })
    }

    /// Récupérer données historiques
    async fn get_historical_data(
        &self,
        zone: &PredictionZone,
        period: &PredictionPeriod,
    ) -> AppResult<HistoricalData> {
        let days_back = match period {
            PredictionPeriod::NextHour => 7,
            PredictionPeriod::NextDay => 30,
            PredictionPeriod::NextWeek => 90,
        };

        // Requête historique des réservations taxi/covoiturage dans la zone
        // Utilise specialized_reservations avec type 'taxi' ou 'covoiturage'
        let days_back_str = days_back.to_string();
        let historical = sqlx::query(&format!(
            r#"
            SELECT 
                DATE_TRUNC('hour', created_at) as hour_bucket,
                COUNT(*)::float as demand_count
            FROM specialized_reservations sr
            WHERE sr.created_at >= NOW() - INTERVAL '{} days'
            AND sr.service_type IN ('taxi', 'covoiturage')
            AND sr.status IN ('pending', 'confirmed', 'completed')
            AND EXISTS (
                SELECT 1 FROM services s
                WHERE s.id = sr.service_id
                AND (
                    (sr.service_type = 'taxi' AND s.specialized_type = 'taxi')
                    OR (sr.service_type = 'covoiturage' AND s.specialized_type = 'covoiturage')
                )
                AND s.data->>'gps_depart_lat' IS NOT NULL
                AND s.data->>'gps_depart_lng' IS NOT NULL
                AND (
                    6371 * acos(
                        cos(radians($1)) * cos(radians((s.data->>'gps_depart_lat')::float)) *
                        cos(radians((s.data->>'gps_depart_lng')::float) - radians($2)) +
                        sin(radians($1)) * sin(radians((s.data->>'gps_depart_lat')::float))
                    )
                ) <= $3
            )
            GROUP BY hour_bucket
            ORDER BY hour_bucket DESC
            "#,
            days_back_str
        ))
        .bind(zone.latitude)
        .bind(zone.longitude)
        .bind(zone.radius_km)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur historique: {}", e)))?;

        let mut hourly_demands = HashMap::new();
        let mut total_demand = 0.0;
        let mut count = 0;

        for row in historical {
            let hour_bucket: Option<NaiveDateTime> = row.try_get("hour_bucket")?;
            let demand_count: f64 = row.try_get("demand_count")?;

            if let Some(hour) = hour_bucket {
                let hour_key = hour.hour() as u8;
                *hourly_demands.entry(hour_key).or_insert(0.0) += demand_count;
                total_demand += demand_count;
                count += 1;
            }
        }

        let avg_demand = if count > 0 {
            total_demand / count as f64
        } else {
            0.0
        };

        // Calculer tendance (dernière semaine vs semaine précédente)
        let recent_avg = hourly_demands.values().sum::<f64>() / hourly_demands.len().max(1) as f64;
        let trend = if avg_demand > 0.0 {
            (recent_avg - avg_demand) / avg_demand
        } else {
            0.0
        };

        Ok(HistoricalData {
            hourly_demands,
            avg_demand,
            trend,
            total_count: count,
        })
    }

    /// Calculer features
    async fn calculate_features(
        &self,
        zone: &PredictionZone,
        target: &DateTime<Utc>,
        historical: &HistoricalData,
    ) -> AppResult<DemandFeatures> {
        let hour = target.hour() as u8;
        let day_of_week = target.weekday().num_days_from_monday() as u8;
        let month = target.month() as u8;
        let is_weekend = day_of_week >= 5;

        // TODO: Vérifier jours fériés (base locale)
        let is_holiday = false;

        // Facteur météo (utiliser service météo existant)
        let weather_factor = self
            .get_weather_factor(zone.latitude, zone.longitude)
            .await?;

        // Facteur événements (à implémenter avec base événements)
        let event_factor = self.get_event_factor(zone, target).await?;

        Ok(DemandFeatures {
            zone_id: zone.zone_id.clone(),
            hour,
            day_of_week,
            month,
            is_weekend,
            is_holiday,
            historical_avg: historical.avg_demand,
            historical_trend: historical.trend,
            weather_factor,
            event_factor,
        })
    }

    /// Identifier heures de pic
    async fn identify_peak_hours(&self, features: &DemandFeatures) -> AppResult<Vec<u8>> {
        // Heures de pic basées sur jour de semaine et historique
        let base_peaks = if features.is_weekend {
            vec![10, 11, 12, 18, 19, 20]
        } else {
            vec![7, 8, 9, 17, 18, 19]
        };

        Ok(base_peaks)
    }

    /// Obtenir facteur météo
    async fn get_weather_factor(&self, lat: f64, lng: f64) -> AppResult<f64> {
        // Utiliser service météo avec Mutex pour thread-safety
        let weather_service = Arc::new(tokio::sync::Mutex::new(DeliveryWeatherService::new()));
        let mut weather_guard = weather_service.lock().await;

        match weather_guard.get_weather(lat, lng).await {
            Ok(weather) => Ok(weather.factor),
            Err(e) => {
                warn!("[TaxiDemandPrediction] Erreur météo, fallback 1.0: {}", e);
                Ok(1.0) // Fallback conditions normales
            }
        }
    }

    /// Obtenir facteur événements
    async fn get_event_factor(
        &self,
        zone: &PredictionZone,
        target: &DateTime<Utc>,
    ) -> AppResult<f64> {
        // TODO: Intégrer base événements locaux
        // Pour l'instant, retourner facteur neutre
        Ok(1.0)
    }

    /// Formater données historiques pour prompt IA
    fn format_historical_data(&self, data: &HistoricalData) -> String {
        format!(
            "Moyenne: {:.2}, Tendance: {:.2}%, Total: {}",
            data.avg_demand,
            data.trend * 100.0,
            data.total_count
        )
    }

    /// Obtenir métriques
    pub fn get_metrics(&self) -> HashMap<String, u64> {
        HashMap::from([
            (
                "total_predictions".to_string(),
                self.total_predictions.load(Ordering::Relaxed),
            ),
            (
                "ai_predictions".to_string(),
                self.ai_predictions.load(Ordering::Relaxed),
            ),
            (
                "ml_predictions".to_string(),
                self.ml_predictions.load(Ordering::Relaxed),
            ),
            (
                "fallback_predictions".to_string(),
                self.fallback_predictions.load(Ordering::Relaxed),
            ),
        ])
    }
}

/// Données historiques
#[derive(Debug, Clone)]
struct HistoricalData {
    hourly_demands: HashMap<u8, f64>,
    avg_demand: f64,
    trend: f64,
    total_count: i32,
}
