//! ✅ Service Recommandations Personnalisées - Taxi & Covoiturage
//!
//! Recommandations basées sur historique et préférences
//! Objectif: Taux clic > 30%

use crate::core::types::AppResult;
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;

/// Recommandation personnalisée
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalizedRecommendation {
    pub service_id: i32,
    pub service_type: String,
    pub recommendation_score: f64,
    pub reasons: Vec<String>,
    pub match_factors: Vec<MatchFactor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchFactor {
    pub factor: String,
    pub weight: f64,
    pub score: f64,
}

/// Service de recommandations
pub struct TaxiPersonalizedRecommendationsService {
    pool: Arc<PgPool>,
}

impl TaxiPersonalizedRecommendationsService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Obtenir recommandations pour un utilisateur
    /// Stratégie: services les plus réservés par l'utilisateur + services bien notés à proximité
    pub async fn get_recommendations(
        &self,
        user_id: i32,
        service_type: Option<String>,
        location_lat: Option<f64>,
        location_lng: Option<f64>,
        radius_km: Option<f64>,
        limit: Option<i64>,
    ) -> AppResult<Vec<PersonalizedRecommendation>> {
        info!(
            "[TaxiRecommendations] Recommandations pour user_id={}",
            user_id
        );

        let limit = limit.unwrap_or(10);
        let radius = radius_km.unwrap_or(20.0);
        let svc_filter = match service_type.as_deref() {
            Some("taxi") => "s.specialized_type = 'taxi'",
            Some("covoiturage") => "s.specialized_type = 'covoiturage'",
            _ => "s.specialized_type IN ('taxi', 'covoiturage')",
        };

        // ── Voie 1: services déjà réservés par l'utilisateur (collaborative filtering simplifié)
        let history_rows = sqlx::query(&format!(
            r#"
            SELECT
                s.id AS service_id,
                s.specialized_type AS service_type,
                COUNT(sr.id)::float AS booking_count,
                COALESCE(AVG(rat.rating), 0)::float AS user_rating
            FROM specialized_reservations sr
            JOIN services s ON s.id = sr.service_id
            LEFT JOIN specialized_ratings rat ON rat.reservation_id = sr.id AND rat.user_id = $1
            WHERE sr.user_id = $1
            AND {}
            AND sr.status IN ('completed', 'confirmed')
            GROUP BY s.id, s.specialized_type
            ORDER BY booking_count DESC, user_rating DESC
            LIMIT $2
            "#,
            svc_filter
        ))
        .bind(user_id)
        .bind(limit)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        let mut recommendations: Vec<PersonalizedRecommendation> = history_rows
            .into_iter()
            .map(|row| {
                let service_id: i32 = row.get("service_id");
                let service_type: String = row.get("service_type");
                let booking_count: f64 = row.get("booking_count");
                let user_rating: f64 = row.get("user_rating");

                // Score = fréquence normalisée (max 50pts) + note utilisateur (max 50pts)
                let freq_score = (booking_count / 10.0).min(1.0) * 50.0;
                let rating_score = (user_rating / 5.0) * 50.0;
                let recommendation_score = freq_score + rating_score;

                let mut reasons = vec!["Déjà réservé par vous".to_string()];
                if user_rating >= 4.0 {
                    reasons.push("Bien noté par vous".to_string());
                }
                if booking_count >= 3.0 {
                    reasons.push("Prestataire habituel".to_string());
                }

                PersonalizedRecommendation {
                    service_id,
                    service_type,
                    recommendation_score,
                    reasons,
                    match_factors: vec![
                        MatchFactor {
                            factor: "historique".to_string(),
                            weight: 0.6,
                            score: freq_score,
                        },
                        MatchFactor {
                            factor: "rating".to_string(),
                            weight: 0.4,
                            score: rating_score,
                        },
                    ],
                }
            })
            .collect();

        // ── Voie 2: services bien notés à proximité (si coordonnées fournies et pas assez de résultats)
        if recommendations.len() < limit as usize {
            let remaining = limit - recommendations.len() as i64;
            let already_ids: Vec<i32> = recommendations.iter().map(|r| r.service_id).collect();

            if let (Some(lat), Some(lng)) = (location_lat, location_lng) {
                let nearby_rows = sqlx::query(&format!(
                    r#"
                    SELECT
                        s.id AS service_id,
                        s.specialized_type AS service_type,
                        COALESCE(AVG(rat.rating), 0)::float AS avg_rating,
                        COUNT(rat.id)::float AS rating_count,
                        (6371 * acos(
                            LEAST(1.0, cos(radians($1)) * cos(radians(COALESCE((s.data->>'gps_depart_lat')::float, $1))) *
                            cos(radians(COALESCE((s.data->>'gps_depart_lng')::float, $2)) - radians($2)) +
                            sin(radians($1)) * sin(radians(COALESCE((s.data->>'gps_depart_lat')::float, $1))))
                        )) AS distance_km
                    FROM services s
                    LEFT JOIN specialized_ratings rat ON rat.service_id = s.id
                    WHERE {}
                    AND s.is_active = TRUE
                    AND s.id != ALL($3)
                    HAVING (6371 * acos(
                        LEAST(1.0, cos(radians($1)) * cos(radians(COALESCE((s.data->>'gps_depart_lat')::float, $1))) *
                        cos(radians(COALESCE((s.data->>'gps_depart_lng')::float, $2)) - radians($2)) +
                        sin(radians($1)) * sin(radians(COALESCE((s.data->>'gps_depart_lat')::float, $1))))
                    )) <= $4
                    GROUP BY s.id, s.specialized_type
                    ORDER BY avg_rating DESC, rating_count DESC
                    LIMIT $5
                    "#,
                    svc_filter
                ))
                .bind(lat)
                .bind(lng)
                .bind(&already_ids)
                .bind(radius)
                .bind(remaining)
                .fetch_all(&*self.pool)
                .await
                .unwrap_or_default();

                for row in nearby_rows {
                    let service_id: i32 = row.get("service_id");
                    let service_type: String = row.get("service_type");
                    let avg_rating: f64 = row.get("avg_rating");
                    let rating_count: f64 = row.get("rating_count");
                    let distance_km: f64 = row.get("distance_km");

                    let rating_score = (avg_rating / 5.0) * 60.0;
                    let popularity_score = (rating_count / 50.0).min(1.0) * 20.0;
                    let proximity_score = ((radius - distance_km) / radius).max(0.0) * 20.0;
                    let recommendation_score = rating_score + popularity_score + proximity_score;

                    let mut reasons = Vec::new();
                    if avg_rating >= 4.5 {
                        reasons.push("Excellent score".to_string());
                    } else if avg_rating >= 4.0 {
                        reasons.push("Bien noté".to_string());
                    }
                    if distance_km <= 5.0 {
                        reasons.push(format!("À {:.1} km de vous", distance_km));
                    }
                    if rating_count >= 10.0 {
                        reasons.push("Populaire".to_string());
                    }
                    if reasons.is_empty() {
                        reasons.push("Disponible près de vous".to_string());
                    }

                    recommendations.push(PersonalizedRecommendation {
                        service_id,
                        service_type,
                        recommendation_score,
                        reasons,
                        match_factors: vec![
                            MatchFactor {
                                factor: "rating".to_string(),
                                weight: 0.6,
                                score: rating_score,
                            },
                            MatchFactor {
                                factor: "proximité".to_string(),
                                weight: 0.2,
                                score: proximity_score,
                            },
                            MatchFactor {
                                factor: "popularité".to_string(),
                                weight: 0.2,
                                score: popularity_score,
                            },
                        ],
                    });
                }
            }
        }

        // Trier par score décroissant
        recommendations
            .sort_by(|a, b| b.recommendation_score.partial_cmp(&a.recommendation_score).unwrap());

        info!(
            "[TaxiRecommendations] ✅ {} recommandations générées pour user_id={}",
            recommendations.len(),
            user_id
        );

        Ok(recommendations)
    }
}
