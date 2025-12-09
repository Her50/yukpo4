// ✅ Service matching intelligent pour taxi (variant proximité)
// Date: 2025-01-29
// Fonctionnalité : Score de compatibilité basé sur proximité + préférences

use crate::core::types::{AppError, AppResult};
use log::{error, info};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::f64::consts::PI;

// Trait pour convertir en radians
#[allow(dead_code)]
trait ToRadians {
    fn to_radians(&self) -> f64;
}

impl ToRadians for f64 {
    fn to_radians(&self) -> f64 {
        *self * PI / 180.0
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaxiPassengerPreferences {
    pub climatisation_preferee: bool,
    pub wifi_prefere: bool,
    pub paiement_carte: bool, // Préfère paiement carte
    pub prix_max: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaxiMatch {
    pub taxi_id: i32,
    pub compatibility_score: f64, // 0.0 - 100.0
    pub distance_km: f64,
    pub estimated_arrival_minutes: i32,
    pub estimated_price: i32,
    pub match_reasons: Vec<String>,
    pub driver_rating: Option<f64>,
    pub driver_reviews_count: Option<i32>,
    pub is_verified_driver: bool,
    // Champs supplémentaires pour affichage détaillé
    pub user_id: i32,
    pub gps_actuel: Option<String>,
    pub tarif_base: i32,
    pub tarif_par_km: i32,
    pub devise: String,
}

pub struct TaxiMatchingService {
    pool: PgPool,
}

impl TaxiMatchingService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Trouve les taxis correspondant aux préférences (matching proximité)
    pub async fn find_matching_taxis(
        &self,
        passenger_lat: f64,
        passenger_lng: f64,
        destination_lat: Option<f64>,
        destination_lng: Option<f64>,
        prefs: &TaxiPassengerPreferences,
        radius_km: Option<f64>,
    ) -> AppResult<Vec<TaxiMatch>> {
        info!("[TaxiMatching] Recherche taxis avec matching intelligent (proximité)");

        const EARTH_RADIUS_KM: f64 = 6371.0;
        let radius = radius_km.unwrap_or(10.0); // 10km par défaut pour taxi

        // Recherche taxis disponibles dans le rayon
        let taxis = sqlx::query(
            r#"
            SELECT 
                t.id,
                t.user_id,
                t.gps_actuel,
                t.tarif_base,
                t.tarif_par_km,
                t.devise,
                t.climatisation,
                t.wifi,
                t.paiement_carte,
                COALESCE(AVG(r.rating)::float, NULL) as driver_rating,
                COUNT(r.id)::int as driver_reviews_count,
                u.is_verified as is_verified_driver,
                (
                    2 * ASIN(
                        SQRT(
                            POWER(SIN(RADIANS($1 - (SPLIT_PART(t.gps_actuel, ',', 1)::float)) / 2), 2) +
                            COS(RADIANS($1)) * COS(RADIANS(SPLIT_PART(t.gps_actuel, ',', 1)::float)) *
                            POWER(SIN(RADIANS($2 - (SPLIT_PART(t.gps_actuel, ',', 2)::float)) / 2), 2)
                        )
                    ) * $3
                ) AS distance_km
            FROM taxis_ville t
            INNER JOIN services s ON s.id = t.service_id
            INNER JOIN users u ON u.id = t.user_id
            LEFT JOIN reviews r ON r.service_id = s.id
            WHERE s.is_active = true
            AND t.is_active = true
            AND t.is_available_now = true
            AND t.gps_actuel IS NOT NULL
            AND (
                2 * ASIN(
                    SQRT(
                        POWER(SIN(RADIANS($1 - (SPLIT_PART(t.gps_actuel, ',', 1)::float)) / 2), 2) +
                        COS(RADIANS($1)) * COS(RADIANS(SPLIT_PART(t.gps_actuel, ',', 1)::float)) *
                        POWER(SIN(RADIANS($2 - (SPLIT_PART(t.gps_actuel, ',', 2)::float)) / 2), 2)
                    )
                ) * $3
            ) <= $4
            GROUP BY t.id, t.user_id, t.gps_actuel, t.tarif_base, t.tarif_par_km, t.devise,
                     t.climatisation, t.wifi, t.paiement_carte, u.is_verified
            ORDER BY distance_km ASC
            LIMIT 20
            "#
        )
        .bind(passenger_lat)
        .bind(passenger_lng)
        .bind(EARTH_RADIUS_KM)
        .bind(radius)
        .map(|row: sqlx::postgres::PgRow| {
            use sqlx::Row;
            let distance_km: f64 = row.get::<f64, _>("distance_km");
            let tarif_base: i32 = row.get::<i32, _>("tarif_base");
            let tarif_par_km: i32 = row.get::<i32, _>("tarif_par_km");

            // Estimation prix (base + distance * tarif/km)
            // Pour taxi, estimation basée sur distance (ex: 5km moyen)
            let estimated_distance_km = if let (Some(dest_lat), Some(dest_lng)) = (destination_lat, destination_lng) {
                // Calculer distance réelle si destination fournie
                calculate_distance_km(passenger_lat, passenger_lng, dest_lat, dest_lng)
            } else {
                5.0 // Distance moyenne par défaut
            };

            let estimated_price = tarif_base + (estimated_distance_km * tarif_par_km as f64) as i32;

            // Estimation temps arrivée (distance * 2 min/km en ville)
            let estimated_arrival_minutes = (distance_km * 2.0) as i32;

            TaxiData {
                id: row.get::<i32, _>("id"),
                user_id: row.get::<i32, _>("user_id"),
                gps_actuel: row.get::<Option<String>, _>("gps_actuel"),
                tarif_base,
                tarif_par_km,
                devise: row.get::<String, _>("devise"),
                climatisation: row.get::<bool, _>("climatisation"),
                wifi: row.get::<bool, _>("wifi"),
                paiement_carte: row.get::<bool, _>("paiement_carte"),
                driver_rating: row.get::<Option<f64>, _>("driver_rating"),
                driver_reviews_count: row.get::<Option<i32>, _>("driver_reviews_count"),
                is_verified_driver: row.get::<bool, _>("is_verified_driver"),
                distance_km,
                estimated_price,
                estimated_arrival_minutes,
            }
        })
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[TaxiMatching] Erreur recherche: {}", e);
            AppError::Internal(format!("Erreur recherche taxis: {}", e))
        })?;

        // Calculer score de compatibilité pour chaque taxi
        let mut matches: Vec<TaxiMatch> = Vec::new();

        for taxi in taxis {
            let score = self.calculate_compatibility_score(&taxi, prefs);
            matches.push(score);
        }

        // Trier par score décroissant puis distance
        matches.sort_by(|a, b| {
            b.compatibility_score
                .partial_cmp(&a.compatibility_score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| {
                    a.distance_km
                        .partial_cmp(&b.distance_km)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
        });

        info!("[TaxiMatching] ✅ {} taxis matchés", matches.len());
        Ok(matches)
    }

    /// Calcule le score de compatibilité (proximité + préférences)
    fn calculate_compatibility_score(
        &self,
        taxi: &TaxiData,
        prefs: &TaxiPassengerPreferences,
    ) -> TaxiMatch {
        let mut score = 100.0;
        let mut match_reasons = Vec::new();

        // 1. Distance (proximité) - Impact majeur pour taxi
        if taxi.distance_km <= 1.0 {
            score += 20.0; // Très proche
            match_reasons.push(format!("Très proche ({:.1}km)", taxi.distance_km));
        } else if taxi.distance_km <= 3.0 {
            score += 10.0; // Proche
            match_reasons.push(format!("Proche ({:.1}km)", taxi.distance_km));
        } else if taxi.distance_km <= 5.0 {
            score += 5.0; // Acceptable
            match_reasons.push(format!("Distance acceptable ({:.1}km)", taxi.distance_km));
        } else {
            score -= 10.0; // Trop loin
        }

        // 2. Temps d'arrivée
        if taxi.estimated_arrival_minutes <= 5 {
            score += 15.0;
            match_reasons.push(format!(
                "Arrivée rapide ({}min)",
                taxi.estimated_arrival_minutes
            ));
        } else if taxi.estimated_arrival_minutes <= 10 {
            score += 10.0;
            match_reasons.push(format!(
                "Arrivée proche ({}min)",
                taxi.estimated_arrival_minutes
            ));
        }

        // 3. Climatisation
        if prefs.climatisation_preferee && taxi.climatisation {
            score += 10.0;
            match_reasons.push("Climatisation disponible".to_string());
        }

        // 4. WiFi
        if prefs.wifi_prefere && taxi.wifi {
            score += 5.0;
            match_reasons.push("WiFi disponible".to_string());
        }

        // 5. Paiement carte
        if prefs.paiement_carte && taxi.paiement_carte {
            score += 5.0;
            match_reasons.push("Paiement par carte accepté".to_string());
        }

        // 6. Prix
        if let Some(prix_max) = prefs.prix_max {
            if taxi.estimated_price > prix_max {
                score -= 30.0;
            } else {
                match_reasons.push(format!("Prix {} dans budget", taxi.estimated_price));
            }
        }

        // 7. Note conducteur
        if let Some(rating) = taxi.driver_rating {
            let rating_bonus = (rating - 3.0) * 5.0;
            score += rating_bonus.max(0.0).min(15.0);
            match_reasons.push(format!("Conducteur noté {:.1}/5", rating));
        }

        // 8. Conducteur vérifié
        if taxi.is_verified_driver {
            score += 10.0;
            match_reasons.push("Conducteur vérifié".to_string());
        }

        // Normaliser score entre 0 et 100
        let final_score = score.max(0.0).min(100.0);

        TaxiMatch {
            taxi_id: taxi.id,
            compatibility_score: final_score,
            distance_km: taxi.distance_km,
            estimated_arrival_minutes: taxi.estimated_arrival_minutes,
            estimated_price: taxi.estimated_price,
            match_reasons,
            driver_rating: taxi.driver_rating,
            driver_reviews_count: taxi.driver_reviews_count,
            is_verified_driver: taxi.is_verified_driver,
            // Inclure les champs supplémentaires pour utilisation future
            user_id: taxi.user_id,
            gps_actuel: taxi.gps_actuel.clone(),
            tarif_base: taxi.tarif_base,
            tarif_par_km: taxi.tarif_par_km,
            devise: taxi.devise.clone(),
        }
    }
}

#[derive(Debug)]
struct TaxiData {
    id: i32,
    user_id: i32,
    gps_actuel: Option<String>,
    tarif_base: i32,
    tarif_par_km: i32,
    devise: String,
    climatisation: bool,
    wifi: bool,
    paiement_carte: bool,
    driver_rating: Option<f64>,
    driver_reviews_count: Option<i32>,
    is_verified_driver: bool,
    distance_km: f64,
    estimated_price: i32,
    estimated_arrival_minutes: i32,
}

fn calculate_distance_km(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    const EARTH_RADIUS_KM: f64 = 6371.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lng = (lng2 - lng1).to_radians();
    let a = (d_lat / 2.0).sin() * (d_lat / 2.0).sin()
        + lat1.to_radians().cos()
            * lat2.to_radians().cos()
            * (d_lng / 2.0).sin()
            * (d_lng / 2.0).sin();
    let c = 2.0 * a.sqrt().asin();
    EARTH_RADIUS_KM * c
}
