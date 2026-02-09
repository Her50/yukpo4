// ✅ Service de matching intelligent pour covoiturage
// Date: 2025-01-29
// Fonctionnalité : Score de compatibilité, matching préférences, recommandations

use crate::core::types::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PassengerPreferences {
    pub fumeur_autorise: bool,
    pub animaux_autorises: bool,
    pub bagages_autorises: bool,
    pub climatisation_preferee: bool,
    pub horaire_flexible: bool, // Accepte ±30min
    pub prix_max: Option<i32>,
    pub horaire_depart_prefere: Option<String>, // Format HH:MM
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TripMatch {
    pub covoiturage_id: i32,
    pub compatibility_score: f64,      // 0.0 - 100.0
    pub match_reasons: Vec<String>,    // Raisons du match
    pub mismatch_reasons: Vec<String>, // Raisons de non-match
    pub estimated_price: i32,
    pub estimated_duration_minutes: Option<i32>,
    pub driver_rating: Option<f64>,
    pub driver_reviews_count: Option<i32>,
    pub is_verified_driver: bool,
}

pub struct CovoiturageMatchingService {
    pool: PgPool,
}

impl CovoiturageMatchingService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Trouve les trajets correspondant aux préférences du passager
    pub async fn find_matching_trips(
        &self,
        passenger_prefs: &PassengerPreferences,
        depart: &str,
        destination: &str,
        date_depart: chrono::NaiveDate,
        lat: Option<f64>,
        lng: Option<f64>,
        radius_km: Option<f64>,
    ) -> AppResult<Vec<TripMatch>> {
        info!("[CovoiturageMatching] Recherche trajets avec matching intelligent");

        // Recherche de base (GPS si disponible, sinon texte)
        let base_trips = if let (Some(lat), Some(lng)) = (lat, lng) {
            self.search_trips_gps(lat, lng, radius_km.unwrap_or(50.0), &date_depart).await?
        } else {
            self.search_trips_text(depart, destination, &date_depart).await?
        };

        // Calculer score de compatibilité pour chaque trajet
        let mut matches: Vec<TripMatch> = Vec::new();

        for trip in base_trips {
            let score = self.calculate_compatibility_score(&trip, passenger_prefs).await?;

            if score.compatibility_score > 0.0 {
                matches.push(score);
            }
        }

        // Trier par score décroissant
        matches.sort_by(|a, b| {
            b.compatibility_score
                .partial_cmp(&a.compatibility_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        info!("[CovoiturageMatching] ✅ {} trajets matchés", matches.len());
        Ok(matches)
    }

    /// Calcule le score de compatibilité entre un trajet et les préférences
    async fn calculate_compatibility_score(
        &self,
        trip: &TripData,
        prefs: &PassengerPreferences,
    ) -> AppResult<TripMatch> {
        let mut score = 100.0;
        let mut match_reasons = Vec::new();
        let mut mismatch_reasons = Vec::new();

        // 1. Préférences fumeur (-20 si mismatch)
        if !prefs.fumeur_autorise && trip.fumeur_autorise {
            score -= 20.0;
            mismatch_reasons.push("Fumeur autorisé alors que vous ne le souhaitez pas".to_string());
        } else if !trip.fumeur_autorise {
            match_reasons.push("Non-fumeur".to_string());
        }

        // 2. Animaux (-15 si mismatch)
        if prefs.animaux_autorises && !trip.animaux_autorises {
            score -= 15.0;
            mismatch_reasons.push("Animaux non autorisés".to_string());
        } else if trip.animaux_autorises {
            match_reasons.push("Animaux autorisés".to_string());
        }

        // 3. Bagages (-10 si mismatch)
        if prefs.bagages_autorises && !trip.bagages_autorises {
            score -= 10.0;
            mismatch_reasons.push("Bagages non autorisés".to_string());
        } else if trip.bagages_autorises {
            match_reasons.push("Bagages autorisés".to_string());
        }

        // 4. Climatisation (+5 si préférée et disponible)
        if prefs.climatisation_preferee && trip.climatisation {
            score += 5.0;
            match_reasons.push("Climatisation disponible".to_string());
        }

        // 5. Prix (-30 si dépasse budget)
        if let Some(prix_max) = prefs.prix_max {
            if trip.prix_par_place > prix_max {
                score -= 30.0;
                mismatch_reasons.push(format!(
                    "Prix {} > budget {}",
                    trip.prix_par_place, prix_max
                ));
            } else {
                match_reasons.push(format!("Prix {} dans budget", trip.prix_par_place));
            }
        }

        // 6. Horaire (flexibilité ±30min)
        if let Some(ref horaire_pref) = prefs.horaire_depart_prefere {
            if let Ok(pref_time) = chrono::NaiveTime::parse_from_str(horaire_pref, "%H:%M") {
                if let Ok(trip_time) =
                    chrono::NaiveTime::parse_from_str(&trip.heure_depart, "%H:%M")
                {
                    let diff_minutes = (trip_time - pref_time).num_minutes().abs();

                    if diff_minutes <= 30 {
                        score += 10.0;
                        match_reasons.push(format!("Horaire proche ({}min d'écart)", diff_minutes));
                    } else if prefs.horaire_flexible && diff_minutes <= 60 {
                        score += 5.0;
                        match_reasons.push(format!(
                            "Horaire flexible acceptable ({}min d'écart)",
                            diff_minutes
                        ));
                    } else {
                        score -= 15.0;
                        mismatch_reasons.push(format!(
                            "Horaire trop éloigné ({}min d'écart)",
                            diff_minutes
                        ));
                    }
                }
            }
        }

        // 7. Places disponibles (+10 si plusieurs places)
        if trip.places_disponibles > 1 {
            score += 10.0;
            match_reasons.push(format!("{} places disponibles", trip.places_disponibles));
        }

        // 8. Note conducteur (+5 à +15 selon note)
        if let Some(rating) = trip.driver_rating {
            let rating_bonus = (rating - 3.0) * 5.0; // +0 si 3.0, +10 si 5.0
            score += rating_bonus.clamp(0.0, 15.0);
            match_reasons.push(format!("Conducteur noté {:.1}/5", rating));
        }

        // 9. Conducteur vérifié (+10)
        if trip.is_verified_driver {
            score += 10.0;
            match_reasons.push("Conducteur vérifié".to_string());
        }

        // Normaliser score entre 0 et 100
        let final_score = score.clamp(0.0, 100.0);

        Ok(TripMatch {
            covoiturage_id: trip.id,
            compatibility_score: final_score,
            match_reasons,
            mismatch_reasons,
            estimated_price: trip.prix_par_place,
            estimated_duration_minutes: None, // À calculer avec itinéraire
            driver_rating: trip.driver_rating,
            driver_reviews_count: trip.driver_reviews_count,
            is_verified_driver: trip.is_verified_driver,
        })
    }

    /// Recherche trajets par GPS
    async fn search_trips_gps(
        &self,
        lat: f64,
        lng: f64,
        radius_km: f64,
        date: &chrono::NaiveDate,
    ) -> AppResult<Vec<TripData>> {
        const EARTH_RADIUS_KM: f64 = 6371.0;

        let trips = sqlx::query(
            r#"
            SELECT 
                c.id,
                c.depart,
                c.destination,
                c.gps_depart,
                c.gps_destination,
                c.heure_depart,
                c.nombre_places,
                c.places_disponibles,
                c.prix_par_place,
                c.bagages_autorises,
                c.animaux_autorises,
                c.fumeur_autorise,
                c.climatisation,
                COALESCE(AVG(r.rating)::float, NULL) as driver_rating,
                COUNT(r.id)::int as driver_reviews_count,
                u.is_verified as is_verified_driver
            FROM covoiturages c
            INNER JOIN services s ON s.id = c.service_id
            INNER JOIN users u ON u.id = c.user_id
            LEFT JOIN reviews r ON r.service_id = s.id
            WHERE s.is_active = true
            AND c.is_active = true
            AND c.statut = 'ouvert'
            AND c.places_disponibles > 0
            AND c.date_depart::date = $1
            AND (
                2 * ASIN(
                    SQRT(
                        POWER(SIN(RADIANS($2 - (SPLIT_PART(c.gps_depart, ',', 1)::float)) / 2), 2) +
                        COS(RADIANS($2)) * COS(RADIANS(SPLIT_PART(c.gps_depart, ',', 1)::float)) *
                        POWER(SIN(RADIANS($3 - (SPLIT_PART(c.gps_depart, ',', 2)::float)) / 2), 2)
                    )
                ) * $4
            ) <= $5
            GROUP BY c.id, c.depart, c.destination, c.gps_depart, c.gps_destination,
                     c.heure_depart, c.nombre_places, c.places_disponibles, c.prix_par_place,
                     c.bagages_autorises, c.animaux_autorises, c.fumeur_autorise, c.climatisation,
                     u.is_verified
            ORDER BY c.heure_depart ASC
            LIMIT 50
            "#,
        )
        .bind(*date)
        .bind(lat)
        .bind(lng)
        .bind(EARTH_RADIUS_KM)
        .bind(radius_km)
        .map(|row: sqlx::postgres::PgRow| TripData {
            id: row.get::<i32, _>("id"),
            depart: row.get::<String, _>("depart"),
            destination: row.get::<String, _>("destination"),
            gps_depart: row.get::<Option<String>, _>("gps_depart"),
            gps_destination: row.get::<Option<String>, _>("gps_destination"),
            heure_depart: row.get::<String, _>("heure_depart"),
            nombre_places: row.get::<i32, _>("nombre_places"),
            places_disponibles: row.get::<i32, _>("places_disponibles"),
            prix_par_place: row.get::<i32, _>("prix_par_place"),
            bagages_autorises: row.get::<bool, _>("bagages_autorises"),
            animaux_autorises: row.get::<bool, _>("animaux_autorises"),
            fumeur_autorise: row.get::<bool, _>("fumeur_autorise"),
            climatisation: row.get::<bool, _>("climatisation"),
            driver_rating: row.get::<Option<f64>, _>("driver_rating"),
            driver_reviews_count: row.get::<Option<i32>, _>("driver_reviews_count"),
            is_verified_driver: row.get::<bool, _>("is_verified_driver"),
        })
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[CovoiturageMatching] Erreur recherche GPS: {}", e);
            AppError::Internal(format!("Erreur recherche trajets: {}", e))
        })?;

        Ok(trips)
    }

    /// Recherche trajets par texte
    async fn search_trips_text(
        &self,
        depart: &str,
        destination: &str,
        date: &chrono::NaiveDate,
    ) -> AppResult<Vec<TripData>> {
        let trips = sqlx::query(
            r#"
            SELECT 
                c.id,
                c.depart,
                c.destination,
                c.gps_depart,
                c.gps_destination,
                c.heure_depart,
                c.nombre_places,
                c.places_disponibles,
                c.prix_par_place,
                c.bagages_autorises,
                c.animaux_autorises,
                c.fumeur_autorise,
                c.climatisation,
                COALESCE(AVG(r.rating)::float, NULL) as driver_rating,
                COUNT(r.id)::int as driver_reviews_count,
                u.is_verified as is_verified_driver
            FROM covoiturages c
            INNER JOIN services s ON s.id = c.service_id
            INNER JOIN users u ON u.id = c.user_id
            LEFT JOIN reviews r ON r.service_id = s.id
            WHERE s.is_active = true
            AND c.is_active = true
            AND c.statut = 'ouvert'
            AND c.places_disponibles > 0
            AND c.date_depart::date = $1
            AND (LOWER(c.depart) LIKE LOWER($2) OR LOWER(c.depart) LIKE LOWER($3))
            AND (LOWER(c.destination) LIKE LOWER($4) OR LOWER(c.destination) LIKE LOWER($5))
            GROUP BY c.id, c.depart, c.destination, c.gps_depart, c.gps_destination,
                     c.heure_depart, c.nombre_places, c.places_disponibles, c.prix_par_place,
                     c.bagages_autorises, c.animaux_autorises, c.fumeur_autorise, c.climatisation,
                     u.is_verified
            ORDER BY c.heure_depart ASC
            LIMIT 50
            "#,
        )
        .bind(*date)
        .bind(format!("%{}%", depart))
        .bind(format!("{}%", depart))
        .bind(format!("%{}%", destination))
        .bind(format!("{}%", destination))
        .map(|row: sqlx::postgres::PgRow| TripData {
            id: row.get::<i32, _>("id"),
            depart: row.get::<String, _>("depart"),
            destination: row.get::<String, _>("destination"),
            gps_depart: row.get::<Option<String>, _>("gps_depart"),
            gps_destination: row.get::<Option<String>, _>("gps_destination"),
            heure_depart: row.get::<String, _>("heure_depart"),
            nombre_places: row.get::<i32, _>("nombre_places"),
            places_disponibles: row.get::<i32, _>("places_disponibles"),
            prix_par_place: row.get::<i32, _>("prix_par_place"),
            bagages_autorises: row.get::<bool, _>("bagages_autorises"),
            animaux_autorises: row.get::<bool, _>("animaux_autorises"),
            fumeur_autorise: row.get::<bool, _>("fumeur_autorise"),
            climatisation: row.get::<bool, _>("climatisation"),
            driver_rating: row.get::<Option<f64>, _>("driver_rating"),
            driver_reviews_count: row.get::<Option<i32>, _>("driver_reviews_count"),
            is_verified_driver: row.get::<bool, _>("is_verified_driver"),
        })
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[CovoiturageMatching] Erreur recherche texte: {}", e);
            AppError::Internal(format!("Erreur recherche trajets: {}", e))
        })?;

        Ok(trips)
    }
}

#[derive(Debug)]
struct TripData {
    id: i32,
    #[allow(dead_code)]
    depart: String,
    #[allow(dead_code)]
    destination: String,
    #[allow(dead_code)]
    gps_depart: Option<String>,
    #[allow(dead_code)]
    gps_destination: Option<String>,
    heure_depart: String,
    #[allow(dead_code)]
    nombre_places: i32,
    places_disponibles: i32,
    prix_par_place: i32,
    bagages_autorises: bool,
    animaux_autorises: bool,
    fumeur_autorise: bool,
    climatisation: bool,
    driver_rating: Option<f64>,
    driver_reviews_count: Option<i32>,
    is_verified_driver: bool,
}

use log::{error, info};
