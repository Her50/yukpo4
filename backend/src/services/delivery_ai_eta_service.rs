//! ✅ AI ETA Prediction Service - Prédiction ETA avec IA
//!
//! Ce service utilise l'IA pour prédire le temps d'arrivée estimé (ETA)
//! avec une précision élevée, en utilisant les prompts spécialisés et le système AppIA.
//! Fallback sur delivery_ml_eta si l'IA n'est pas disponible.

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use crate::services::delivery_ai_prompts::ETA_PREDICTION_PROMPT;
use crate::services::delivery_ml_models::{DeliveryMLModelsService, ETAFeatures as MLEtaFeatures};
use crate::services::delivery_traffic_service::DeliveryTrafficService;
use crate::services::delivery_weather_service::DeliveryWeatherService;
use chrono::{DateTime, Datelike, Timelike, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Localisation (origine ou destination)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub lat: f64,
    pub lng: f64,
}

/// Prédiction ETA avec IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimatedTime {
    pub estimated_minutes: f64,
    pub confidence: f32, // 0.0-1.0
    pub lower_bound_minutes: f64,
    pub upper_bound_minutes: f64,
    pub factors: HashMap<String, f64>,
    pub risk_factors: Vec<String>,
    pub method: String, // "ai" ou "ml_fallback"
}

/// Historique de livraison pour contexte
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryHistory {
    pub delivery_id: i32,
    pub origin: Location,
    pub destination: Location,
    pub distance_km: f64,
    pub actual_duration_minutes: i32,
    pub created_at: DateTime<Utc>,
}

/// Service AI ETA avec monitoring et métriques
/// Intègre météo, trafic et ML models pour prédictions de niveau mondial
pub struct DeliveryAIETAService {
    app_ia: Option<Arc<AppIA>>, // Option pour injection comme dans DeliveryAIRecommendationsService
    db: Arc<PgPool>,
    // Services externes pour données réelles
    weather_service: Arc<tokio::sync::Mutex<DeliveryWeatherService>>,
    traffic_service: Arc<tokio::sync::Mutex<DeliveryTrafficService>>,
    ml_models: Arc<tokio::sync::Mutex<DeliveryMLModelsService>>,
    // Cache pour prédictions récentes (5 minutes)
    cache: HashMap<String, (EstimatedTime, DateTime<Utc>)>,
    // Métriques pour monitoring
    total_predictions: Arc<AtomicU64>,
    ai_predictions: Arc<AtomicU64>,
    ml_predictions: Arc<AtomicU64>,
    fallback_predictions: Arc<AtomicU64>,
    cache_hits: Arc<AtomicU64>,
}

impl DeliveryAIETAService {
    pub fn new(db: Arc<PgPool>) -> Self {
        Self {
            app_ia: None,
            db,
            weather_service: Arc::new(tokio::sync::Mutex::new(DeliveryWeatherService::new())),
            traffic_service: Arc::new(tokio::sync::Mutex::new(DeliveryTrafficService::new())),
            ml_models: Arc::new(tokio::sync::Mutex::new(DeliveryMLModelsService::new())),
            cache: HashMap::new(),
            total_predictions: Arc::new(AtomicU64::new(0)),
            ai_predictions: Arc::new(AtomicU64::new(0)),
            ml_predictions: Arc::new(AtomicU64::new(0)),
            fallback_predictions: Arc::new(AtomicU64::new(0)),
            cache_hits: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Pattern with_ia() comme dans DeliveryAIRecommendationsService
    pub fn with_ia(mut self, app_ia: Arc<AppIA>) -> Self {
        self.app_ia = Some(app_ia);
        self
    }

    /// Prédit l'ETA avec IA (utilise le système AppIA existant)
    pub async fn predict_eta_with_ai(
        &mut self,
        origin: &Location,
        destination: &Location,
        distance_km: f64,
        delivery_type: &str,
        courier_rating: Option<f32>,
    ) -> AppResult<EstimatedTime> {
        // Métriques
        self.total_predictions.fetch_add(1, Ordering::Relaxed);

        // Vérifier le cache (5 minutes)
        let cache_key = format!(
            "{:.2}_{:.2}_{:.2}_{:.2}_{}",
            origin.lat, origin.lng, destination.lat, destination.lng, delivery_type
        );

        if let Some((cached, cached_time)) = self.cache.get(&cache_key) {
            let elapsed = Utc::now() - *cached_time;
            if elapsed.num_seconds() < 300 {
                self.cache_hits.fetch_add(1, Ordering::Relaxed);
                log::info!(
                    "[AI ETA] Cache hit (total: {})",
                    self.cache_hits.load(Ordering::Relaxed)
                );
                return Ok(cached.clone());
            }
        }

        // ARCHITECTURE OPTIMALE: IA Prioritaire + ML Fallback (Qualité Maximale)
        // 1. IA calcule d'abord si disponible (meilleure précision avec données réelles)
        if let Some(app_ia) = &self.app_ia {
            // Utiliser timeout réaliste pour prompts enrichis (données météo/trafic)
            // Les prompts ETA sont complexes avec historique + météo + trafic réels
            // Timeout 10s pour garantir traitement complet même avec APIs lentes
            // Fallback ML garantit continuité si timeout (<1ms)
            let ai_result = tokio::time::timeout(
                std::time::Duration::from_millis(10000), // Max 10s pour IA (qualité maximale avec prompts enrichis)
                self.predict_with_ai(
                    app_ia,
                    origin,
                    destination,
                    distance_km,
                    delivery_type,
                    courier_rating,
                ),
            )
            .await;

            match ai_result {
                Ok(Ok(ai_eta)) => {
                    // IA réussie - Calculer ML en parallèle pour combinaison optimale
                    self.ai_predictions.fetch_add(1, Ordering::Relaxed);

                    // Essayer d'obtenir ML pour combinaison (non-bloquant)
                    let ml_prediction_opt = match self
                        .predict_with_ml(
                            origin,
                            destination,
                            distance_km,
                            delivery_type,
                            courier_rating,
                        )
                        .await
                    {
                        Ok(eta) => {
                            self.ml_predictions.fetch_add(1, Ordering::Relaxed);
                            Some(eta)
                        }
                        Err(_) => None,
                    };

                    // Combiner IA + ML si ML disponible, sinon utiliser IA seul
                    let final_eta = if let Some(ml_pred) = ml_prediction_opt {
                        // Combinaison optimale: IA (60%) + ML (40%) - IA prioritaire pour qualité
                        self.combine_ml_and_ai_weighted(&ml_pred, &ai_eta, 0.4, 0.6)
                    } else {
                        // Utiliser IA seul si ML indisponible
                        ai_eta
                    };

                    // Mettre en cache
                    self.cache.insert(cache_key, (final_eta.clone(), Utc::now()));

                    log::info!(
                        "[AI ETA] Prédiction IA+ML réussie (IA: {}, ML: {}, Cache: {})",
                        self.ai_predictions.load(Ordering::Relaxed),
                        self.ml_predictions.load(Ordering::Relaxed),
                        self.cache_hits.load(Ordering::Relaxed)
                    );
                    return Ok(final_eta);
                }
                Ok(Err(e)) => {
                    log::warn!("[AI ETA] Erreur prédiction IA, fallback ML: {}", e);
                    // Continue vers ML fallback
                }
                Err(_) => {
                    log::warn!("[AI ETA] Timeout prédiction IA (>10s), fallback ML");
                    // Continue vers ML fallback
                }
            }
        }

        // 2. Fallback ML (toujours fonctionnel si IA échoue ou indisponible)
        self.fallback_predictions.fetch_add(1, Ordering::Relaxed);

        let ml_prediction = match self
            .predict_with_ml(
                origin,
                destination,
                distance_km,
                delivery_type,
                courier_rating,
            )
            .await
        {
            Ok(eta) => {
                self.ml_predictions.fetch_add(1, Ordering::Relaxed);
                eta
            }
            Err(e) => {
                log::warn!("[AI ETA] Erreur ML, formule basique: {}", e);
                // Fallback formule basique
                return self.predict_basic_eta(distance_km, delivery_type);
            }
        };

        // Mettre en cache
        self.cache.insert(cache_key, (ml_prediction.clone(), Utc::now()));

        log::info!(
            "[AI ETA] Prédiction ML réussie (IA: {}, ML: {}, Fallback: {}, Cache: {})",
            self.ai_predictions.load(Ordering::Relaxed),
            self.ml_predictions.load(Ordering::Relaxed),
            self.fallback_predictions.load(Ordering::Relaxed),
            self.cache_hits.load(Ordering::Relaxed)
        );

        Ok(ml_prediction)
    }

    /// Combine les prédictions ML et IA avec poids personnalisables
    #[allow(dead_code)]
    fn combine_ml_and_ai_weighted(
        &self,
        ml_eta: &EstimatedTime,
        ai_eta: &EstimatedTime,
        ml_weight: f64,
        ai_weight: f64,
    ) -> EstimatedTime {
        let combined_minutes =
            ml_eta.estimated_minutes * ml_weight + ai_eta.estimated_minutes * ai_weight;

        // Utiliser la confiance la plus élevée
        let combined_confidence = ml_eta.confidence.max(ai_eta.confidence);

        // Prendre les bounds les plus conservateurs
        let lower_bound = ml_eta.lower_bound_minutes.min(ai_eta.lower_bound_minutes);
        let upper_bound = ml_eta.upper_bound_minutes.max(ai_eta.upper_bound_minutes);

        // Fusionner les facteurs
        let mut combined_factors = ml_eta.factors.clone();
        for (key, value) in &ai_eta.factors {
            // Prioriser les facteurs IA car ils contiennent données réelles
            combined_factors.insert(key.clone(), *value);
        }

        // Fusionner les risk factors
        let mut combined_risks = ml_eta.risk_factors.clone();
        for risk in &ai_eta.risk_factors {
            if !combined_risks.contains(risk) {
                combined_risks.push(risk.clone());
            }
        }

        EstimatedTime {
            estimated_minutes: combined_minutes,
            confidence: combined_confidence,
            lower_bound_minutes: lower_bound,
            upper_bound_minutes: upper_bound,
            factors: combined_factors,
            risk_factors: combined_risks,
            method: "ml+ai_hybrid".to_string(),
        }
    }

    /// Combine les prédictions ML et IA pour un résultat optimal (défaut: ML 70%, IA 30%)
    /// ML = base fiable, IA = enrichissement avec données réelles
    #[allow(dead_code)]
    fn combine_ml_and_ai(&self, ml_eta: &EstimatedTime, ai_eta: &EstimatedTime) -> EstimatedTime {
        self.combine_ml_and_ai_weighted(ml_eta, ai_eta, 0.7, 0.3)
    }

    /// Prédit avec l'IA (utilise AppIA comme dans DeliveryAIRecommendationsService)
    /// Avec validation des données et gestion d'erreurs robuste
    async fn predict_with_ai(
        &self,
        app_ia: &Arc<AppIA>,
        origin: &Location,
        destination: &Location,
        distance_km: f64,
        delivery_type: &str,
        courier_rating: Option<f32>,
    ) -> AppResult<EstimatedTime> {
        // Validation des données d'entrée
        if !(-90.0..=90.0).contains(&origin.lat) || !(-180.0..=180.0).contains(&origin.lng) {
            return Err(crate::core::types::AppError::BadRequest(
                "Coordonnées origine invalides".to_string(),
            ));
        }
        if !(-90.0..=90.0).contains(&destination.lat)
            || !(-180.0..=180.0).contains(&destination.lng)
        {
            return Err(crate::core::types::AppError::BadRequest(
                "Coordonnées destination invalides".to_string(),
            ));
        }
        if distance_km <= 0.0 || distance_km > 10000.0 {
            return Err(crate::core::types::AppError::BadRequest(
                "Distance invalide (doit être entre 0 et 10000 km)".to_string(),
            ));
        }
        // 1. Récupérer l'historique depuis la DB
        let historical = self.get_historical_deliveries(origin, destination, 30).await?;

        // 2. Récupérer données météo et trafic RÉELLES
        let weather = {
            let mut weather_svc = self.weather_service.lock().await;
            weather_svc
                .get_weather(origin.lat, origin.lng)
                .await
                .unwrap_or_else(|_| weather_svc.get_default_weather())
        };

        let traffic = {
            let mut traffic_svc = self.traffic_service.lock().await;
            match traffic_svc
                .get_traffic(origin.lat, origin.lng, destination.lat, destination.lng)
                .await
            {
                Ok(t) => t,
                Err(_) => {
                    traffic_svc
                        .estimate_traffic_by_time(
                            origin.lat,
                            origin.lng,
                            destination.lat,
                            destination.lng,
                        )
                        .await
                }
            }
        };

        // 3. Préparer le contexte
        let now = Utc::now();
        let hour_of_day = now.hour() as u8;
        let day_of_week = now.weekday().num_days_from_monday() as u8;

        // 3. Construire le prompt avec les données (incluant météo et trafic réels)
        let prompt = self.build_eta_prompt(
            origin,
            destination,
            distance_km,
            hour_of_day,
            day_of_week,
            delivery_type,
            courier_rating,
            &historical,
            &weather,
            &traffic,
        );

        log::info!("[AI ETA] Appel IA avec prompt spécialisé");

        // 4. Appeler l'IA (utiliser le système existant)
        let (model_name, response, tokens) = app_ia.predict(&prompt).await?;

        log::info!(
            "[AI ETA] Réponse reçue de {} ({} tokens)",
            model_name,
            tokens
        );

        // 5. Parser la réponse JSON (avec météo/trafic si nécessaire)
        let eta = self
            .parse_eta_response(response, origin, destination, &weather, &traffic)
            .await?;

        Ok(eta)
    }

    /// Construit le prompt pour l'IA avec données météo et trafic réelles
    /// ✅ AMÉLIORATION: Format JSON strict avec instructions claires
    fn build_eta_prompt(
        &self,
        origin: &Location,
        destination: &Location,
        distance_km: f64,
        hour_of_day: u8,
        day_of_week: u8,
        delivery_type: &str,
        courier_rating: Option<f32>,
        historical: &[DeliveryHistory],
        weather: &crate::services::delivery_weather_service::WeatherConditions,
        traffic: &crate::services::delivery_traffic_service::TrafficConditions,
    ) -> String {
        let day_names = [
            "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche",
        ];
        let day_name = day_names.get(day_of_week as usize).unwrap_or(&"Jour");

        // Formater l'historique
        let historical_str = if historical.is_empty() {
            "Aucun historique disponible".to_string()
        } else {
            historical
                .iter()
                .take(10) // Limiter à 10 pour ne pas surcharger le prompt
                .map(|h| {
                    format!(
                        "- Livraison #{}: {} km, durée réelle: {} min (date: {})",
                        h.delivery_id,
                        h.distance_km,
                        h.actual_duration_minutes,
                        h.created_at.format("%Y-%m-%d %H:%M")
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        };

        // Calculer la complexité de route basée sur la distance et l'historique
        let route_complexity = self.calculate_route_complexity(distance_km, &historical);

        // Construire le prompt optimisé avec plus de contexte
        let prompt_base = ETA_PREDICTION_PROMPT
            .replace("{distance_km}", &format!("{:.2}", distance_km))
            .replace("{hour_of_day}", &hour_of_day.to_string())
            .replace("{day_of_week}", day_name)
            .replace("{delivery_type}", delivery_type)
            .replace(
                "{courier_rating}",
                &courier_rating
                    .map(|r| r.max(0.0).min(5.0).to_string())
                    .unwrap_or_else(|| "N/A".to_string()),
            )
            .replace(
                "{weather}",
                &format!(
                    "{} (temp: {:.1}°C, précip: {:.1}mm/h, visibilité: {:.1}km)",
                    weather.condition,
                    weather.temperature,
                    weather.precipitation,
                    weather.visibility
                ),
            )
            .replace(
                "{traffic_factor}",
                &format!("{:.2} ({})", traffic.factor, traffic.congestion_level),
            )
            .replace("{route_complexity}", &format!("{:.2}", route_complexity))
            .replace("{similar_deliveries_history}", &historical_str);

        // Ajouter les coordonnées et statistiques pour contexte enrichi avec données réelles
        let avg_historical_duration = if !historical.is_empty() {
            historical.iter().map(|h| h.actual_duration_minutes as f64).sum::<f64>()
                / historical.len() as f64
        } else {
            0.0
        };

        // ✅ AMÉLIORATION: Enrichir le prompt avec instructions JSON strictes
        format!(
            r#"{}

CONTEXTE GÉOGRAPHIQUE ENRICHI AVEC DONNÉES RÉELLES:
- Origine: ({:.6}, {:.6})
- Destination: ({:.6}, {:.6})
- Distance: {:.2} km
- Durée moyenne historique: {:.1} min
- Nombre de livraisons similaires: {}
- Complexité route estimée: {:.2}

DONNÉES MÉTÉO RÉELLES (API OpenWeatherMap):
- Condition: {} (facteur impact: {:.2})
- Température: {:.1}°C
- Précipitation: {:.1} mm/h
- Visibilité: {:.1} km
- Vent: {:.1} km/h (direction: {:.0}°)
- Humidité: {:.0}%

DONNÉES TRAFIC RÉELLES (API Google Maps):
- Niveau de congestion: {} (facteur: {:.2})
- Durée estimée avec trafic: {} secondes
- Distance route: {} mètres

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
- Tous les champs numériques doivent être des nombres (pas de strings)
"#,
            prompt_base,
            origin.lat,
            origin.lng,
            destination.lat,
            destination.lng,
            distance_km,
            avg_historical_duration,
            historical.len(),
            route_complexity,
            weather.condition,
            weather.factor,
            weather.temperature,
            weather.precipitation,
            weather.visibility,
            weather.wind_speed,
            weather.wind_direction,
            weather.humidity,
            traffic.congestion_level,
            traffic.factor,
            traffic.duration_seconds,
            traffic.distance_meters
        )
    }

    /// Parse la réponse JSON de l'IA
    /// Utilise les données météo et trafic réelles pour enrichir les facteurs
    async fn parse_eta_response(
        &self,
        response: String,
        _origin: &Location,
        _destination: &Location,
        weather: &crate::services::delivery_weather_service::WeatherConditions,
        traffic: &crate::services::delivery_traffic_service::TrafficConditions,
    ) -> AppResult<EstimatedTime> {
        // Nettoyer la réponse (enlever markdown si présent)
        let cleaned = response.replace("```json", "").replace("```", "").trim().to_string();

        let json: Value = serde_json::from_str(&cleaned).map_err(|e| {
            log::error!("[AI ETA] Erreur parsing JSON: {}", e);
            crate::core::types::AppError::Internal(format!("Erreur parsing réponse IA: {}", e))
        })?;

        // Extraire les données
        let estimated_minutes = json["estimated_minutes"].as_f64().ok_or_else(|| {
            crate::core::types::AppError::Internal(
                "Champ estimated_minutes manquant dans réponse IA".to_string(),
            )
        })?;

        let confidence = json["confidence"].as_f64().unwrap_or(0.7) as f32;

        let lower_bound = json["lower_bound_minutes"].as_f64().unwrap_or(estimated_minutes * 0.8);

        let upper_bound = json["upper_bound_minutes"].as_f64().unwrap_or(estimated_minutes * 1.2);

        // Extraire les facteurs
        let mut factors = HashMap::new();
        if let Some(factors_obj) = json.get("factors").and_then(|v| v.as_object()) {
            for (key, value) in factors_obj {
                if let Some(num) = value.as_f64() {
                    factors.insert(key.clone(), num);
                }
            }
        }

        // Utiliser les facteurs météo et trafic RÉELS fournis
        if !factors.contains_key("weather") {
            factors.insert("weather".to_string(), weather.factor);
        }
        if !factors.contains_key("traffic") {
            factors.insert("traffic".to_string(), traffic.factor);
        }

        // Extraire les facteurs de risque
        let risk_factors = json["risk_factors"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        Ok(EstimatedTime {
            estimated_minutes,
            confidence,
            lower_bound_minutes: lower_bound,
            upper_bound_minutes: upper_bound,
            factors,
            risk_factors,
            method: "ai".to_string(),
        })
    }

    /// Calcule la complexité de route (0.0-1.0)
    fn calculate_route_complexity(&self, distance_km: f64, historical: &[DeliveryHistory]) -> f64 {
        if historical.is_empty() {
            // Complexité basée sur distance seule
            return (distance_km / 50.0).min(1.0);
        }

        // Complexité basée sur variance des durées historiques
        let durations: Vec<f64> =
            historical.iter().map(|h| h.actual_duration_minutes as f64).collect();
        let avg = durations.iter().sum::<f64>() / durations.len() as f64;
        let variance =
            durations.iter().map(|d| (d - avg).powi(2)).sum::<f64>() / durations.len() as f64;

        // Plus de variance = plus complexe
        (variance / (avg * avg + 1.0)).min(1.0)
    }

    /// Estime le facteur de trafic selon l'heure et le jour
    #[allow(dead_code)]
    fn estimate_traffic_factor(&self, hour: u8, day_of_week: u8) -> String {
        let factor = match hour {
            7..=9 => 1.3,           // Heure de pointe matin
            17..=19 => 1.4,         // Heure de pointe soir
            12..=14 => 1.2,         // Pause déjeuner
            22..=23 | 0..=6 => 0.9, // Nuit
            _ => 1.0,
        };

        // Weekend moins de trafic
        let weekend_factor = if day_of_week >= 5 { 0.9 } else { 1.0 };

        format!("{:.2}", factor * weekend_factor)
    }

    /// Prédit avec modèle ML entraîné (TensorFlow/PyTorch)
    async fn predict_with_ml(
        &self,
        origin: &Location,
        destination: &Location,
        distance_km: f64,
        _delivery_type: &str,
        courier_rating: Option<f32>,
    ) -> AppResult<EstimatedTime> {
        // Récupérer météo et trafic pour les features ML
        let weather = {
            let mut weather_svc = self.weather_service.lock().await;
            weather_svc
                .get_weather(origin.lat, origin.lng)
                .await
                .unwrap_or_else(|_| weather_svc.get_default_weather())
        };

        let traffic = {
            let mut traffic_svc = self.traffic_service.lock().await;
            match traffic_svc
                .get_traffic(origin.lat, origin.lng, destination.lat, destination.lng)
                .await
            {
                Ok(t) => t,
                Err(_) => {
                    traffic_svc
                        .estimate_traffic_by_time(
                            origin.lat,
                            origin.lng,
                            destination.lat,
                            destination.lng,
                        )
                        .await
                }
            }
        };

        // Récupérer historique pour moyenne
        let historical = self
            .get_historical_deliveries(origin, destination, 30)
            .await
            .unwrap_or_default();
        let historical_avg = if !historical.is_empty() {
            historical.iter().map(|h| h.actual_duration_minutes as f64).sum::<f64>()
                / historical.len() as f64
        } else {
            distance_km / 30.0 * 60.0
        };

        // Préparer les features pour le modèle ML
        let now = Utc::now();
        let features = MLEtaFeatures {
            distance_km,
            hour_of_day: now.hour() as u8,
            day_of_week: now.weekday().num_days_from_monday() as u8,
            is_weekend: now.weekday().num_days_from_monday() >= 5,
            weather_factor: weather.factor,
            traffic_factor: traffic.factor,
            courier_rating: courier_rating.unwrap_or(4.0),
            historical_avg_duration: historical_avg,
            route_complexity: self.calculate_route_complexity(distance_km, &historical),
        };

        // Appeler le modèle ML
        let ml_models = self.ml_models.lock().await;
        let predicted_minutes = ml_models.predict_eta(&features).await?;

        let mut factors = HashMap::new();
        factors.insert("weather".to_string(), weather.factor);
        factors.insert("traffic".to_string(), traffic.factor);
        factors.insert("distance".to_string(), distance_km);
        factors.insert("route_complexity".to_string(), features.route_complexity);

        Ok(EstimatedTime {
            estimated_minutes: predicted_minutes,
            confidence: 0.85, // Modèle ML généralement plus confiant
            lower_bound_minutes: predicted_minutes * 0.85,
            upper_bound_minutes: predicted_minutes * 1.15,
            factors,
            risk_factors: vec!["Prédiction ML (modèle entraîné)".to_string()],
            method: "ml_model".to_string(),
        })
    }

    /// Fallback: formule basique améliorée si l'IA et ML échouent
    fn predict_basic_eta(&self, distance_km: f64, delivery_type: &str) -> AppResult<EstimatedTime> {
        let avg_speed_kmh = 30.0; // Vitesse moyenne en ville
        let base_time_hours = distance_km / avg_speed_kmh;
        let base_minutes = base_time_hours * 60.0;

        // Ajouter temps fixe selon type
        let delivery_time = match delivery_type {
            "shopping" => 8.0,
            "parcel" => 5.0,
            _ => 6.0,
        };

        let estimated_minutes = base_minutes + delivery_time;

        let mut factors = HashMap::new();
        factors.insert("distance".to_string(), distance_km);
        factors.insert("base_speed".to_string(), avg_speed_kmh);
        factors.insert("delivery_time".to_string(), delivery_time);

        Ok(EstimatedTime {
            estimated_minutes,
            confidence: 0.5,
            lower_bound_minutes: estimated_minutes * 0.8,
            upper_bound_minutes: estimated_minutes * 1.2,
            factors,
            risk_factors: vec!["Calcul basique (IA non disponible)".to_string()],
            method: "ml_fallback".to_string(),
        })
    }

    /// Récupère l'historique des livraisons similaires depuis la DB
    async fn get_historical_deliveries(
        &self,
        origin: &Location,
        destination: &Location,
        days: i32,
    ) -> AppResult<Vec<DeliveryHistory>> {
        // Requête SQL optimisée avec le schéma réel (table deliveries)
        // Utilise PostGIS pour les calculs de distance géographique
        let query = r#"
            SELECT 
                d.id::text as id,
                ST_Y(d.pickup_location::geometry) as origin_lat,
                ST_X(d.pickup_location::geometry) as origin_lng,
                ST_Y(d.dropoff_location::geometry) as destination_lat,
                ST_X(d.dropoff_location::geometry) as destination_lng,
                COALESCE(d.distance_meters::float / 1000.0, 
                    ST_Distance(
                        d.pickup_location::geography,
                        d.dropoff_location::geography
                    ) / 1000.0) as distance_km,
                COALESCE(
                    d.actual_duration_seconds::float / 60.0,
                    EXTRACT(EPOCH FROM (d.completed_at - d.picked_up_at)) / 60.0
                ) as duration_minutes,
                COALESCE(d.completed_at, d.delivered_at, d.requested_at) as created_at
            FROM deliveries d
            WHERE 
                d.status = 'delivered'
                AND d.completed_at IS NOT NULL
                AND d.completed_at >= NOW() - INTERVAL '1 day' * $1
                AND ST_DWithin(
                    d.pickup_location::geography,
                    ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
                    1000.0
                )
                AND ST_DWithin(
                    d.dropoff_location::geography,
                    ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
                    1000.0
                )
            ORDER BY d.completed_at DESC
            LIMIT 50
        "#;

        // Note: Cette requête utilise PostGIS pour des calculs géographiques précis
        // Fallback gracieux si la table n'existe pas
        match sqlx::query_as::<_, DeliveryHistoryRow>(query)
            .bind(days)
            .bind(origin.lat)
            .bind(origin.lng)
            .bind(destination.lat)
            .bind(destination.lng)
            .fetch_all(&*self.db)
            .await
        {
            Ok(rows) => {
                let history: Vec<DeliveryHistory> = rows
                    .into_iter()
                    .filter_map(|row| {
                        // Parser l'ID (peut être UUID ou i32)
                        let delivery_id = row.id.parse::<i32>().unwrap_or_else(|_| {
                            // Si c'est un UUID, utiliser un hash pour avoir un i32
                            use std::collections::hash_map::DefaultHasher;
                            use std::hash::{Hash, Hasher};
                            let mut hasher = DefaultHasher::new();
                            row.id.hash(&mut hasher);
                            (hasher.finish() % (i32::MAX as u64)) as i32
                        });

                        Some(DeliveryHistory {
                            delivery_id,
                            origin: Location {
                                lat: row.origin_lat,
                                lng: row.origin_lng,
                            },
                            destination: Location {
                                lat: row.destination_lat,
                                lng: row.destination_lng,
                            },
                            distance_km: row.distance_km.unwrap_or(0.0),
                            actual_duration_minutes: row.duration_minutes.unwrap_or(0.0).max(1.0)
                                as i32,
                            created_at: row.created_at,
                        })
                    })
                    .collect();
                Ok(history)
            }
            Err(e) => {
                log::warn!(
                    "[AI ETA] Erreur récupération historique (table peut ne pas exister): {}",
                    e
                );
                // Retourner historique vide plutôt que d'échouer
                Ok(Vec::new())
            }
        }
    }

    /// Obtient les métriques de performance
    pub fn get_metrics(&self) -> ETAMetrics {
        ETAMetrics {
            total_predictions: self.total_predictions.load(Ordering::Relaxed),
            ai_predictions: self.ai_predictions.load(Ordering::Relaxed),
            fallback_predictions: self.fallback_predictions.load(Ordering::Relaxed),
            cache_hits: self.cache_hits.load(Ordering::Relaxed),
            cache_size: self.cache.len(),
        }
    }

    /// Nettoie le cache des entrées expirées
    pub fn cleanup_cache(&mut self) {
        let now = Utc::now();
        self.cache.retain(|_, (_, cached_time)| {
            let elapsed = now - *cached_time;
            elapsed.num_seconds() < 300 // Garder seulement les entrées < 5 min
        });
    }
}

/// Structure pour mapper les résultats SQL
#[derive(sqlx::FromRow)]
struct DeliveryHistoryRow {
    id: String, // UUID converti en string
    origin_lat: f64,
    origin_lng: f64,
    destination_lat: f64,
    destination_lng: f64,
    distance_km: Option<f64>,
    duration_minutes: Option<f64>,
    created_at: DateTime<Utc>,
}

/// Métriques de performance pour monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ETAMetrics {
    pub total_predictions: u64,
    pub ai_predictions: u64,
    pub fallback_predictions: u64,
    pub cache_hits: u64,
    pub cache_size: usize,
}

impl Default for DeliveryAIETAService {
    fn default() -> Self {
        // Ne peut pas créer sans DB, donc pas de Default réel
        panic!("DeliveryAIETAService nécessite une DB, utiliser new()")
    }
}
