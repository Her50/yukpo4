//! ✅ Service Prix Dynamique IA - Taxi & Covoiturage
//!
//! Pricing intelligent basé sur demande/prédiction + catégorie véhicule
//! Objectif: Optimisation revenus + satisfaction client

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use crate::services::taxi_demand_prediction_service::{
    PredictionPeriod, PredictionZone, TaxiDemandPredictionService,
};
use crate::services::vehicle_category_service::{categorize_vehicle, VehicleCategory};
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

/// Paramètres pricing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingRequest {
    pub base_price: f64,
    pub distance_km: f64,
    pub zone: PredictionZone,
    pub vehicle_type: Option<String>, // "taxi", "covoiturage"
    // Infos véhicule pour catégorisation automatique
    pub marque_modele: Option<String>,
    pub annee: Option<i32>,
    pub climatisation: Option<bool>,
    pub wifi: Option<bool>,
    pub time_of_day: Option<chrono::DateTime<chrono::Utc>>,
}

/// Prix dynamique calculé
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicPrice {
    pub base_price: f64,
    pub dynamic_multiplier: f64,  // 0.8-2.0 (demande/offre + temps)
    pub vehicle_coefficient: f64, // 0.85 / 1.0 / 1.30 / 1.60 selon catégorie
    pub final_price: f64,
    pub surge_factor: f64,        // 1.0-2.0 (surge pricing)
    pub demand_factor: f64,       // 0.0-1.0
    pub supply_factor: f64,       // 0.0-1.0
    pub time_factor: f64,         // 0.0-1.0 (heure de pointe)
    pub vehicle_category: String, // "economique" | "standard" | "confort" | "premium"
    pub vehicle_category_label: String,
    pub confidence: f32, // 0.0-1.0
    pub reasoning: String,
}

/// Service prix dynamique
pub struct TaxiDynamicPricingService {
    pool: Arc<PgPool>,
    app_ia: Option<Arc<AppIA>>,
    prediction_service: Option<Arc<TaxiDemandPredictionService>>,
}

impl TaxiDynamicPricingService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self {
            pool,
            app_ia: None,
            prediction_service: None,
        }
    }

    pub fn with_app_ia(mut self, app_ia: Arc<AppIA>) -> Self {
        self.app_ia = Some(app_ia);
        self
    }

    pub fn with_prediction_service(mut self, service: Arc<TaxiDemandPredictionService>) -> Self {
        self.prediction_service = Some(service);
        self
    }

    /// Calculer prix dynamique
    pub async fn calculate_dynamic_price(
        &self,
        request: PricingRequest,
    ) -> AppResult<DynamicPrice> {
        info!(
            "[TaxiDynamicPricing] Calcul prix dynamique pour zone={}",
            request.zone.zone_id
        );

        // 1. Obtenir prédiction demande (utiliser service existant si disponible)
        let demand_prediction = if let Some(_pred_service) = &self.prediction_service {
            // Créer service temporaire pour prédiction
            let mut temp_service = TaxiDemandPredictionService::new(self.pool.clone());
            if let Some(app_ia) = &self.app_ia {
                temp_service = temp_service.with_app_ia(app_ia.clone());
            }

            temp_service
                .predict_demand(
                    &request.zone,
                    PredictionPeriod::NextHour,
                    request.time_of_day,
                )
                .await
                .ok()
        } else {
            None
        };

        // 2. Calculer facteurs demande/offre/temps
        let (demand_factor, supply_factor) =
            self.calculate_demand_supply_factors(&request.zone).await?;
        let time_factor = self.calculate_time_factor(request.time_of_day);
        let surge_factor = self.calculate_surge_factor(demand_factor, supply_factor).await?;

        // 3. Multiplicateur dynamique (demande/offre + heure de pointe)
        let dynamic_multiplier =
            self.calculate_multiplier(demand_factor, supply_factor, time_factor, surge_factor);
        let dynamic_multiplier = dynamic_multiplier.clamp(0.8, 2.0);

        // 4. Coefficient catégorie véhicule (automatique)
        let category = categorize_vehicle(
            request.vehicle_type.as_deref(),
            request.marque_modele.as_deref(),
            request.annee,
            request.climatisation.unwrap_or(false),
            request.wifi.unwrap_or(false),
        );
        let vehicle_coefficient = category.price_coefficient();

        // Prix final = base × dynamique × catégorie véhicule
        let final_price = request.base_price * dynamic_multiplier * vehicle_coefficient;

        // 5. Reasoning avec IA si disponible
        let reasoning = if let Some(app_ia) = &self.app_ia {
            self.generate_reasoning(
                app_ia,
                &request,
                dynamic_multiplier,
                vehicle_coefficient,
                demand_factor,
                supply_factor,
                category,
            )
            .await
            .unwrap_or_else(|_| {
                format!(
                    "Véhicule {} (×{:.2}) — ajustement demande/offre: {:.1}%",
                    category.label(),
                    vehicle_coefficient,
                    (dynamic_multiplier - 1.0) * 100.0
                )
            })
        } else {
            format!(
                "Catégorie {}: ×{:.2} — demande={:.2}, offre={:.2}, facteur={:.2}",
                category.label(),
                vehicle_coefficient,
                demand_factor,
                supply_factor,
                dynamic_multiplier
            )
        };

        let confidence = if demand_prediction.is_some() {
            0.85
        } else {
            0.70
        };

        info!(
            "[TaxiDynamicPricing] ✅ Prix calculé: {} → {} (×{:.2} dyn, ×{:.2} catégorie={:?})",
            request.base_price, final_price, dynamic_multiplier, vehicle_coefficient, category
        );

        Ok(DynamicPrice {
            base_price: request.base_price,
            dynamic_multiplier,
            vehicle_coefficient,
            final_price,
            surge_factor,
            demand_factor,
            supply_factor,
            time_factor,
            vehicle_category: category.as_str().to_string(),
            vehicle_category_label: category.label().to_string(),
            confidence,
            reasoning,
        })
    }

    /// Calculer facteurs demande/offre
    async fn calculate_demand_supply_factors(
        &self,
        zone: &PredictionZone,
    ) -> AppResult<(f64, f64)> {
        // Demandes actives dans la zone
        let demand: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint
            FROM specialized_reservations sr
            INNER JOIN services s ON s.id = sr.service_id
            WHERE sr.service_type IN ('taxi', 'covoiturage')
            AND sr.status IN ('pending', 'confirmed')
            AND s.is_active = true
            AND (
                6371 * acos(
                    cos(radians($1)) * cos(radians((s.data->>'gps_depart_lat')::float)) *
                    cos(radians((s.data->>'gps_depart_lng')::float) - radians($2)) +
                    sin(radians($1)) * sin(radians((s.data->>'gps_depart_lat')::float))
                )
            ) <= $3
            "#,
        )
        .bind(zone.latitude)
        .bind(zone.longitude)
        .bind(zone.radius_km)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        // Véhicules disponibles dans la zone
        let supply: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint
            FROM taxis_ville t
            INNER JOIN services s ON s.id = t.service_id
            WHERE t.is_active = true
            AND t.is_on_duty = true
            AND s.is_active = true
            AND t.gps_actuel IS NOT NULL
            AND (
                6371 * acos(
                    cos(radians($1)) * cos(radians(SPLIT_PART(t.gps_actuel, ',', 1)::float)) *
                    cos(radians(SPLIT_PART(t.gps_actuel, ',', 2)::float) - radians($2)) +
                    sin(radians($1)) * sin(radians(SPLIT_PART(t.gps_actuel, ',', 1)::float))
                )
            ) <= $3
            "#,
        )
        .bind(zone.latitude)
        .bind(zone.longitude)
        .bind(zone.radius_km)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        // Normaliser facteurs (0.0-1.0)
        let demand_factor = (demand as f64 / 10.0).min(1.0); // Max 10 = 1.0
        let supply_factor = if supply > 0 {
            (supply as f64 / 5.0).min(1.0) // Max 5 = 1.0
        } else {
            0.0
        };

        Ok((demand_factor, supply_factor))
    }

    /// Calculer facteur temps (heure de pointe)
    fn calculate_time_factor(&self, time: Option<chrono::DateTime<chrono::Utc>>) -> f64 {
        use chrono::{Datelike, Timelike};
        let time = time.unwrap_or_else(chrono::Utc::now);
        let hour = time.hour() as u8;
        let day_of_week = time.weekday().num_days_from_monday() as u8;
        let is_weekend = day_of_week >= 5;

        // Heures de pointe
        let peak_hours = if is_weekend {
            vec![10, 11, 12, 18, 19, 20]
        } else {
            vec![7, 8, 9, 17, 18, 19]
        };

        if peak_hours.contains(&hour) {
            1.2 // +20% en heures de pointe
        } else if hour >= 22 || hour <= 5 {
            1.15 // +15% la nuit
        } else {
            1.0 // Normal
        }
    }

    /// Calculer facteur surge (pricing dynamique)
    async fn calculate_surge_factor(
        &self,
        demand_factor: f64,
        supply_factor: f64,
    ) -> AppResult<f64> {
        // Ratio demande/offre
        let ratio = if supply_factor > 0.0 {
            demand_factor / supply_factor
        } else {
            demand_factor * 2.0 // Pas d'offre = surge élevé
        };

        // Surge pricing: 1.0 à 2.0
        let surge = if ratio > 2.0 {
            2.0 // Surge maximum
        } else if ratio > 1.5 {
            1.5 + (ratio - 1.5) * 1.0 // Linéaire 1.5-2.0
        } else if ratio > 1.0 {
            1.0 + (ratio - 1.0) * 1.0 // Linéaire 1.0-1.5
        } else {
            1.0 // Pas de surge
        };

        Ok(surge)
    }

    /// Calculer multiplicateur final
    fn calculate_multiplier(
        &self,
        _demand_factor: f64,
        _supply_factor: f64,
        time_factor: f64,
        surge_factor: f64,
    ) -> f64 {
        // Formule: base × temps × surge
        let base_multiplier = 1.0;
        base_multiplier * time_factor * surge_factor
    }

    /// Générer raisonnement avec IA
    async fn generate_reasoning(
        &self,
        app_ia: &Arc<AppIA>,
        request: &PricingRequest,
        multiplier: f64,
        vehicle_coefficient: f64,
        demand_factor: f64,
        supply_factor: f64,
        category: VehicleCategory,
    ) -> AppResult<String> {
        let prompt = format!(
            r#"Tu es un expert en pricing dynamique pour transport partagé.

Calcul de prix pour un trajet taxi:
- Prix de base chauffeur: {} FCFA
- Distance: {} km
- Catégorie véhicule: {} (coefficient ×{:.2})
- Multiplicateur demande/offre: ×{:.2}
- Demande dans la zone: {:.2}/1.0
- Offre disponible: {:.2}/1.0
- Prix final: {:.0} FCFA

Génère UNIQUEMENT une explication courte (2 phrases max) pour le passager, mentionnant la catégorie du véhicule.

Format: "Véhicule {} — prix estimé à {:.0} FCFA. [Raison de l'ajustement si applicable].""#,
            request.base_price,
            request.distance_km,
            category.label(),
            vehicle_coefficient,
            multiplier,
            demand_factor,
            supply_factor,
            request.base_price * multiplier * vehicle_coefficient,
            category.label(),
            request.base_price * multiplier * vehicle_coefficient,
        );

        let (_, response, _) = app_ia.predict(&prompt).await?;
        Ok(response)
    }
}
