//! ✅ AI Demand Forecasting Service - Prévision de demande avec IA
//!
//! Ce service utilise l'IA pour prédire la demande de livraisons par zone géographique
//! et heure, en utilisant les prompts spécialisés et le système AppIA.
//! Fallback sur delivery_demand_forecasting si l'IA n'est pas disponible.

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use crate::services::delivery_ai_prompts::DEMAND_FORECASTING_PROMPT;
use crate::services::delivery_ml_models::{
    DeliveryMLModelsService, ForecastingFeatures as MLForecastingFeatures,
};
use crate::services::delivery_weather_service::DeliveryWeatherService;
use chrono::{DateTime, Datelike, Timelike, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Zone géographique
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GeoZone {
    pub zone_id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub radius_km: f64,
}

impl std::hash::Hash for GeoZone {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.zone_id.hash(state);
        // Note: f64 ne peut pas être hashé directement, on utilise zone_id
    }
}

impl Eq for GeoZone {}

/// Période de prévision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimePeriod {
    NextDay,
    NextWeek,
    NextMonth,
}

impl TimePeriod {
    pub fn get_historical_days(&self) -> i32 {
        match self {
            TimePeriod::NextDay => 30,
            TimePeriod::NextWeek => 60,
            TimePeriod::NextMonth => 90,
        }
    }
}

/// Données de vente historiques
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesData {
    pub date: DateTime<Utc>,
    pub quantity: f64,
    pub location: GeoZone,
}

/// Prévision de demande avec IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DemandForecast {
    pub predicted_demand: f64,
    pub confidence: f32, // 0.0-1.0
    pub trend: String,   // "increasing", "decreasing", "stable"
    pub historical_avg: f64,
    pub factors: HashMap<String, f64>,
    pub method: String, // "ai" ou "basic_fallback"
}

/// Service AI Forecasting avec monitoring et métriques
/// Intègre météo et ML models pour prédictions de niveau mondial
pub struct DeliveryAIForecastingService {
    app_ia: Option<Arc<AppIA>>, // Option pour injection comme dans DeliveryAIRecommendationsService
    db: Arc<PgPool>,
    // Services externes pour données réelles
    weather_service: Arc<tokio::sync::Mutex<DeliveryWeatherService>>,
    ml_models: Arc<tokio::sync::Mutex<DeliveryMLModelsService>>,
    // Cache pour prévisions récentes (1 heure)
    cache: HashMap<String, (DemandForecast, DateTime<Utc>)>,
    // Métriques pour monitoring
    total_forecasts: Arc<AtomicU64>,
    ai_forecasts: Arc<AtomicU64>,
    fallback_forecasts: Arc<AtomicU64>,
    cache_hits: Arc<AtomicU64>,
}

impl DeliveryAIForecastingService {
    pub fn new(db: Arc<PgPool>) -> Self {
        Self {
            app_ia: None,
            db,
            weather_service: Arc::new(tokio::sync::Mutex::new(DeliveryWeatherService::new())),
            ml_models: Arc::new(tokio::sync::Mutex::new(DeliveryMLModelsService::new())),
            cache: HashMap::new(),
            total_forecasts: Arc::new(AtomicU64::new(0)),
            ai_forecasts: Arc::new(AtomicU64::new(0)),
            fallback_forecasts: Arc::new(AtomicU64::new(0)),
            cache_hits: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Pattern with_ia() comme dans DeliveryAIRecommendationsService
    pub fn with_ia(mut self, app_ia: Arc<AppIA>) -> Self {
        self.app_ia = Some(app_ia);
        self
    }

    /// Prédit la demande avec IA (utilise le système AppIA existant)
    pub async fn forecast_demand_with_ai(
        &mut self,
        zone: &GeoZone,
        time_period: TimePeriod,
        product_id: Option<i32>,
    ) -> AppResult<DemandForecast> {
        // Métriques
        self.total_forecasts.fetch_add(1, Ordering::Relaxed);

        // Vérifier le cache (1 heure)
        let cache_key = format!("{}_{:?}_{:?}", zone.zone_id, time_period, product_id);

        if let Some((cached, cached_time)) = self.cache.get(&cache_key) {
            let elapsed = Utc::now() - *cached_time;
            if elapsed.num_hours() < 1 {
                self.cache_hits.fetch_add(1, Ordering::Relaxed);
                log::info!(
                    "[AI Forecasting] Cache hit (total: {})",
                    self.cache_hits.load(Ordering::Relaxed)
                );
                return Ok(cached.clone());
            }
        }

        // Utiliser l'IA si disponible (avec timeout 10s comme ETA)
        if let Some(app_ia) = &self.app_ia {
            let time_period_clone = time_period.clone();
            let ai_result = tokio::time::timeout(
                std::time::Duration::from_millis(10000), // Max 10s pour IA (prompts complexes avec météo)
                self.forecast_with_ai(app_ia, zone, &time_period_clone, product_id),
            )
            .await;

            match ai_result {
                Ok(Ok(forecast)) => {
                    self.ai_forecasts.fetch_add(1, Ordering::Relaxed);
                    // Mettre en cache
                    self.cache.insert(cache_key, (forecast.clone(), Utc::now()));
                    log::info!(
                        "[AI Forecasting] Prévision IA réussie (AI: {}, Fallback: {}, Cache: {})",
                        self.ai_forecasts.load(Ordering::Relaxed),
                        self.fallback_forecasts.load(Ordering::Relaxed),
                        self.cache_hits.load(Ordering::Relaxed)
                    );
                    return Ok(forecast);
                }
                Ok(Err(e)) => {
                    log::warn!("[AI Forecasting] Erreur prédiction IA, fallback: {}", e);
                    // Continue vers fallback
                }
                Err(_) => {
                    log::warn!("[AI Forecasting] Timeout prédiction IA (>10s), fallback ML");
                    // Continue vers fallback
                }
            }
        }

        // Fallback: utiliser modèle ML si disponible, sinon moyenne basique
        self.fallback_forecasts.fetch_add(1, Ordering::Relaxed);

        // Essayer d'abord avec le modèle ML
        if let Ok(ml_forecast) = self.predict_with_ml(zone, &time_period, product_id).await {
            return Ok(ml_forecast);
        }

        // Sinon, moyenne basique
        let time_period_clone = time_period.clone();
        self.forecast_basic(zone, &time_period_clone, product_id)
            .await
    }

    /// Prédit avec l'IA (utilise AppIA comme dans DeliveryAIRecommendationsService)
    /// Avec validation des données et gestion d'erreurs robuste
    async fn forecast_with_ai(
        &self,
        app_ia: &Arc<AppIA>,
        zone: &GeoZone,
        time_period: &TimePeriod,
        product_id: Option<i32>,
    ) -> AppResult<DemandForecast> {
        // Validation des données d'entrée
        if !(-90.0..=90.0).contains(&zone.latitude) || !(-180.0..=180.0).contains(&zone.longitude) {
            return Err(crate::core::types::AppError::BadRequest(
                "Coordonnées zone invalides".to_string(),
            ));
        }
        if zone.radius_km <= 0.0 || zone.radius_km > 1000.0 {
            return Err(crate::core::types::AppError::BadRequest(
                "Rayon zone invalide (doit être entre 0 et 1000 km)".to_string(),
            ));
        }
        // 1. Récupérer l'historique des ventes depuis la DB
        let sales_history = self
            .get_sales_history(zone, time_period.get_historical_days(), product_id)
            .await?;

        // 2. Récupérer données météo RÉELLES
        let weather = {
            let mut weather_svc = self.weather_service.lock().await;
            weather_svc
                .get_weather(zone.latitude, zone.longitude)
                .await
                .unwrap_or_else(|_| weather_svc.get_default_weather())
        };

        // 3. Préparer le contexte
        let now = Utc::now();
        let hour = now.hour() as u8;
        let day_of_week = now.weekday().num_days_from_monday() as u8;
        let day_names = [
            "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche",
        ];
        let day_name = day_names.get(day_of_week as usize).unwrap_or(&"Jour");

        // 3. Construire le prompt avec les données météo réelles
        let prompt = self.build_forecasting_prompt(
            zone,
            hour,
            day_name,
            &now.format("%Y-%m-%d").to_string(),
            time_period,
            &sales_history,
            &weather,
        );

        log::info!("[AI Forecasting] Appel IA avec prompt spécialisé");

        // 4. Appeler l'IA (utiliser le système existant)
        let (model_name, response, tokens) = app_ia.predict(&prompt).await?;

        log::info!(
            "[AI Forecasting] Réponse reçue de {} ({} tokens)",
            model_name,
            tokens
        );

        // 5. Parser la réponse JSON
        let forecast = self.parse_forecast_response(response, &sales_history)?;

        Ok(forecast)
    }

    /// Construit le prompt pour l'IA
    fn build_forecasting_prompt(
        &self,
        zone: &GeoZone,
        hour: u8,
        day_of_week: &str,
        date: &str,
        time_period: &TimePeriod,
        sales_history: &[SalesData],
        weather: &crate::services::delivery_weather_service::WeatherConditions,
    ) -> String {
        // Formater l'historique
        let historical_str = if sales_history.is_empty() {
            "Aucune donnée historique disponible".to_string()
        } else {
            // Grouper par jour pour simplifier
            let mut daily_data: HashMap<String, Vec<f64>> = HashMap::new();
            for sale in sales_history {
                let day_key = sale.date.format("%Y-%m-%d").to_string();
                daily_data
                    .entry(day_key)
                    .or_insert_with(Vec::new)
                    .push(sale.quantity);
            }

            daily_data
                .iter()
                .take(30) // Limiter à 30 jours
                .map(|(date, quantities)| {
                    let total: f64 = quantities.iter().sum();
                    format!("- {}: {:.1} livraisons", date, total)
                })
                .collect::<Vec<_>>()
                .join("\n")
        };

        // Construire le prompt en remplaçant les placeholders
        // Note: time_period est utilisé pour déterminer la période de prévision dans le contexte
        let period_desc = match time_period {
            TimePeriod::NextDay => "prochain jour",
            TimePeriod::NextWeek => "prochaine semaine",
            TimePeriod::NextMonth => "prochain mois",
        };

        DEMAND_FORECASTING_PROMPT
            .replace("{zone_id}", &zone.zone_id)
            .replace("{lat}", &zone.latitude.to_string())
            .replace("{lng}", &zone.longitude.to_string())
            .replace("{radius_km}", &format!("{:.2}", zone.radius_km))
            .replace("{hour}", &hour.to_string())
            .replace("{day_of_week}", day_of_week)
            .replace("{date}", date)
            .replace("{historical_demand_data}", &historical_str)
            .replace("{local_events}", "Aucun événement local connu") // TODO: Intégrer API événements
            .replace("{weather_forecast}", &format!("{} (temp: {:.1}°C, précip: {:.1}mm/h, facteur: {:.2})", 
                weather.condition, weather.temperature, weather.precipitation, weather.factor))
            .replace("{holidays}", "Aucun jour férié") // TODO: Intégrer calendrier
            .replace(
                "{seasonal_trends}",
                &self.get_seasonal_trend_description(),
            )
            // Ajouter la période de prévision et données météo réelles dans le contexte
            + &format!("\n\nPÉRIODE DE PRÉVISION: {}\n\nDONNÉES MÉTÉO RÉELLES (API OpenWeatherMap):\n- Condition: {} (facteur impact: {:.2})\n- Température: {:.1}°C\n- Précipitation: {:.1} mm/h\n- Visibilité: {:.1} km\n- Humidité: {:.0}%", 
                period_desc,
                weather.condition, weather.factor,
                weather.temperature,
                weather.precipitation,
                weather.visibility,
                weather.humidity)
    }

    /// Parse la réponse JSON de l'IA
    fn parse_forecast_response(
        &self,
        response: String,
        sales_history: &[SalesData],
    ) -> AppResult<DemandForecast> {
        // Nettoyer la réponse (enlever markdown si présent)
        let cleaned = response
            .replace("```json", "")
            .replace("```", "")
            .trim()
            .to_string();

        let json: Value = serde_json::from_str(&cleaned).map_err(|e| {
            log::error!("[AI Forecasting] Erreur parsing JSON: {}", e);
            crate::core::types::AppError::Internal(format!("Erreur parsing réponse IA: {}", e))
        })?;

        // Extraire les données
        let predicted_demand = json["predicted_demand"].as_f64().ok_or_else(|| {
            crate::core::types::AppError::Internal(
                "Champ predicted_demand manquant dans réponse IA".to_string(),
            )
        })?;

        let confidence = json["confidence"].as_f64().unwrap_or(0.7) as f32;

        let trend = json["trend"].as_str().unwrap_or("stable").to_string();

        // Calculer moyenne historique
        let historical_avg = if !sales_history.is_empty() {
            sales_history.iter().map(|s| s.quantity).sum::<f64>() / sales_history.len() as f64
        } else {
            predicted_demand * 0.8 // Estimation si pas d'historique
        };

        // Extraire les facteurs
        let mut factors = HashMap::new();
        if let Some(factors_obj) = json.get("factors").and_then(|v| v.as_object()) {
            for (key, value) in factors_obj {
                if let Some(num) = value.as_f64() {
                    factors.insert(key.clone(), num);
                }
            }
        }

        Ok(DemandForecast {
            predicted_demand,
            confidence,
            trend,
            historical_avg,
            factors,
            method: "ai".to_string(),
        })
    }

    /// Prédit avec modèle ML entraîné (TensorFlow/PyTorch)
    async fn predict_with_ml(
        &self,
        zone: &GeoZone,
        time_period: &TimePeriod,
        product_id: Option<i32>,
    ) -> AppResult<DemandForecast> {
        // Récupérer météo pour les features ML
        let weather = {
            let mut weather_svc = self.weather_service.lock().await;
            weather_svc
                .get_weather(zone.latitude, zone.longitude)
                .await
                .unwrap_or_else(|_| weather_svc.get_default_weather())
        };

        // Récupérer historique pour calculer tendances
        let sales_history = self
            .get_sales_history(zone, time_period.get_historical_days(), product_id)
            .await
            .unwrap_or_default();
        let historical_avg = if !sales_history.is_empty() {
            sales_history.iter().map(|s| s.quantity).sum::<f64>() / sales_history.len() as f64
        } else {
            2.0
        };

        // Calculer tendance
        let historical_trend = if sales_history.len() >= 7 {
            let recent: f64 = sales_history
                .iter()
                .rev()
                .take(3)
                .map(|s| s.quantity)
                .sum::<f64>()
                / 3.0;
            let older: f64 = sales_history
                .iter()
                .rev()
                .skip(3)
                .take(3)
                .map(|s| s.quantity)
                .sum::<f64>()
                / 3.0;
            if older > 0.0 {
                (recent - older) / older
            } else {
                0.0
            }
        } else {
            0.0
        };

        // Préparer les features pour le modèle ML
        let now = Utc::now();
        let features = MLForecastingFeatures {
            zone_id: zone.zone_id.clone(),
            latitude: zone.latitude,
            longitude: zone.longitude,
            hour: now.hour() as u8,
            day_of_week: now.weekday().num_days_from_monday() as u8,
            month: now.month() as u8,
            historical_avg,
            historical_trend,
            weather_factor: weather.factor,
            is_holiday: false, // TODO: Intégrer calendrier
        };

        // Appeler le modèle ML
        let ml_models = self.ml_models.lock().await;
        let predicted_demand = ml_models.predict_demand(&features).await?;

        let mut factors = HashMap::new();
        factors.insert("weather".to_string(), weather.factor);
        factors.insert("historical_avg".to_string(), historical_avg);
        factors.insert("historical_trend".to_string(), historical_trend);

        let trend = if historical_trend > 0.1 {
            "increasing"
        } else if historical_trend < -0.1 {
            "decreasing"
        } else {
            "stable"
        };

        Ok(DemandForecast {
            predicted_demand,
            confidence: 0.85, // Modèle ML généralement plus confiant
            trend: trend.to_string(),
            historical_avg,
            factors,
            method: "ml_model".to_string(),
        })
    }

    /// Fallback: moyenne basique si l'IA et ML échouent
    async fn forecast_basic(
        &self,
        zone: &GeoZone,
        time_period: &TimePeriod,
        product_id: Option<i32>,
    ) -> AppResult<DemandForecast> {
        // Récupérer historique pour calculer moyenne
        let sales_history = self
            .get_sales_history(zone, time_period.get_historical_days(), product_id)
            .await?;

        let avg = if !sales_history.is_empty() {
            sales_history.iter().map(|s| s.quantity).sum::<f64>() / sales_history.len() as f64
        } else {
            2.0 // Valeur par défaut
        };

        let mut factors = HashMap::new();
        factors.insert("historical_avg".to_string(), avg);
        factors.insert("data_points".to_string(), sales_history.len() as f64);

        Ok(DemandForecast {
            predicted_demand: avg,
            confidence: if sales_history.len() > 10 { 0.6 } else { 0.4 },
            trend: "stable".to_string(),
            historical_avg: avg,
            factors,
            method: "basic_fallback".to_string(),
        })
    }

    /// Récupère l'historique des ventes depuis la DB
    async fn get_sales_history(
        &self,
        zone: &GeoZone,
        days: i32,
        product_id: Option<i32>,
    ) -> AppResult<Vec<SalesData>> {
        // Requête SQL optimisée avec le schéma réel (table deliveries)
        // Utilise PostGIS pour les calculs géographiques précis
        let query = if product_id.is_some() {
            r#"
                SELECT 
                    date_trunc('day', d.completed_at) as date,
                    COUNT(*)::float as quantity,
                    ST_Y(ST_Centroid(ST_Collect(d.dropoff_location::geometry))) as lat,
                    ST_X(ST_Centroid(ST_Collect(d.dropoff_location::geometry))) as lng
                FROM deliveries d
                INNER JOIN delivery_parcels p ON d.parcel_id = p.id
                WHERE 
                    p.type_id = $1
                    AND d.status = 'delivered'
                    AND d.completed_at IS NOT NULL
                    AND d.completed_at >= NOW() - INTERVAL '1 day' * $2
                    AND ST_DWithin(
                        d.dropoff_location::geography,
                        ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
                        $5 * 1000.0
                    )
                GROUP BY date_trunc('day', d.completed_at)
                ORDER BY date DESC
            "#
        } else {
            r#"
                SELECT 
                    date_trunc('day', d.completed_at) as date,
                    COUNT(*)::float as quantity,
                    ST_Y(ST_Centroid(ST_Collect(d.dropoff_location::geometry))) as lat,
                    ST_X(ST_Centroid(ST_Collect(d.dropoff_location::geometry))) as lng
                FROM deliveries d
                WHERE 
                    d.status = 'delivered'
                    AND d.completed_at IS NOT NULL
                    AND d.completed_at >= NOW() - INTERVAL '1 day' * $1
                    AND ST_DWithin(
                        d.dropoff_location::geography,
                        ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
                        $4 * 1000.0
                    )
                GROUP BY date_trunc('day', d.completed_at)
                ORDER BY date DESC
            "#
        };

        // Note: Cette requête peut échouer si la table n'existe pas ou a un schéma différent
        // Dans ce cas, retourner un historique vide (l'IA fonctionnera quand même)
        let result = if let Some(pid) = product_id {
            sqlx::query_as::<_, SalesDataRow>(query)
                .bind(pid)
                .bind(days)
                .bind(zone.latitude)
                .bind(zone.longitude)
                .bind(zone.radius_km)
                .fetch_all(&*self.db)
                .await
        } else {
            sqlx::query_as::<_, SalesDataRow>(query)
                .bind(days)
                .bind(zone.latitude)
                .bind(zone.longitude)
                .bind(zone.radius_km)
                .fetch_all(&*self.db)
                .await
        };

        match result {
            Ok(rows) => {
                let sales: Vec<SalesData> = rows
                    .into_iter()
                    .map(|row| SalesData {
                        date: row.date,
                        quantity: row.quantity,
                        location: GeoZone {
                            zone_id: format!("{:.2}_{:.2}", row.lat, row.lng),
                            latitude: row.lat,
                            longitude: row.lng,
                            radius_km: zone.radius_km,
                        },
                    })
                    .collect();
                Ok(sales)
            }
            Err(e) => {
                log::warn!(
                    "[AI Forecasting] Erreur récupération historique (table peut ne pas exister): {}",
                    e
                );
                // Retourner historique vide plutôt que d'échouer
                Ok(Vec::new())
            }
        }
    }

    /// Description des tendances saisonnières
    fn get_seasonal_trend_description(&self) -> String {
        let month = Utc::now().month() as u32;
        match month {
            12 | 1 | 2 => "Saison sèche - Demande modérée".to_string(),
            3 | 4 | 5 => "Saison des pluies - Demande variable".to_string(),
            6 | 7 | 8 => "Saison des pluies - Demande élevée".to_string(),
            9 | 10 | 11 => "Saison sèche - Demande stable".to_string(),
            _ => "Tendance normale".to_string(),
        }
    }

    /// Obtient les métriques de performance
    pub fn get_metrics(&self) -> ForecastingMetrics {
        ForecastingMetrics {
            total_forecasts: self.total_forecasts.load(Ordering::Relaxed),
            ai_forecasts: self.ai_forecasts.load(Ordering::Relaxed),
            fallback_forecasts: self.fallback_forecasts.load(Ordering::Relaxed),
            cache_hits: self.cache_hits.load(Ordering::Relaxed),
            cache_size: self.cache.len(),
        }
    }

    /// Nettoie le cache des entrées expirées
    pub fn cleanup_cache(&mut self) {
        let now = Utc::now();
        self.cache.retain(|_, (_, cached_time)| {
            let elapsed = now - *cached_time;
            elapsed.num_hours() < 1 // Garder seulement les entrées < 1h
        });
    }
}

/// Structure pour mapper les résultats SQL
#[derive(sqlx::FromRow)]
struct SalesDataRow {
    date: DateTime<Utc>,
    quantity: f64,
    lat: f64,
    lng: f64,
}

/// Métriques de performance pour monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastingMetrics {
    pub total_forecasts: u64,
    pub ai_forecasts: u64,
    pub fallback_forecasts: u64,
    pub cache_hits: u64,
    pub cache_size: usize,
}

impl Default for DeliveryAIForecastingService {
    fn default() -> Self {
        // Ne peut pas créer sans DB, donc pas de Default réel
        panic!("DeliveryAIForecastingService nécessite une DB, utiliser new()")
    }
}
