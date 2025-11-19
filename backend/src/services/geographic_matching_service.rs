// ✅ Phase 10 - Service de matching géographique optimisé
// Utilise le cache Redis et Google Maps Distance Matrix API pour améliorer les performances

use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::core::types::{AppError, AppResult};
use crate::services::cache_service::{cache_keys, CacheService};
use crate::services::geocoding_service::GeocodingService;
use uuid::Uuid;

/// Résultat d'un calcul de distance optimisé
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistanceResult {
    pub distance_meters: f64,
    pub duration_seconds: Option<f64>,
    pub source: DistanceSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DistanceSource {
    Cache,
    Haversine,
    GoogleMaps,
}

/// Service de matching géographique optimisé
pub struct GeographicMatchingService {
    pool: PgPool,
    cache_service: Arc<CacheService>,
    geocoding_service: GeocodingService,
    use_google_maps: bool,
}

impl GeographicMatchingService {
    pub fn new(
        pool: PgPool,
        cache_service: Arc<CacheService>,
        geocoding_service: GeocodingService,
    ) -> Self {
        // Vérifier si Google Maps Distance Matrix API est disponible
        let use_google_maps = std::env::var("GOOGLE_MAPS_API_KEY")
            .ok()
            .filter(|key| !key.is_empty())
            .is_some();

        Self {
            pool,
            cache_service,
            geocoding_service,
            use_google_maps,
        }
    }

    /// ✅ Phase 10 - Vérifie si Google Maps est activé
    pub fn google_maps_enabled(&self) -> bool {
        self.use_google_maps
    }

    /// Calcule la distance entre deux points GPS avec cache et optimisation
    /// Utilise le cache Redis pour éviter les recalculs fréquents
    pub async fn calculate_distance(
        &self,
        origin: (f64, f64),
        destination: (f64, f64),
    ) -> AppResult<DistanceResult> {
        // Générer une clé de cache basée sur les coordonnées arrondies (précision ~100m)
        let cache_key = Self::build_distance_cache_key(origin, destination);

        // Essayer de récupérer depuis le cache
        if let Some(cached) = self.cache_service.get::<DistanceResult>(&cache_key).await? {
            log::debug!(
                "[GeographicMatching] Distance récupérée du cache: {}m",
                cached.distance_meters
            );
            return Ok(cached);
        }

        // Calculer la distance
        let result = if self.use_google_maps {
            // Essayer Google Maps Distance Matrix API pour une distance routière précise
            match self.calculate_distance_google_maps(origin, destination).await {
                Ok(google_result) => {
                    log::debug!(
                        "[GeographicMatching] Distance Google Maps: {}m",
                        google_result.distance_meters
                    );
                    google_result
                }
                Err(e) => {
                    log::warn!(
                        "[GeographicMatching] Erreur Google Maps, fallback Haversine: {:?}",
                        e
                    );
                    // Fallback vers Haversine
                    self.calculate_distance_haversine(origin, destination)
                }
            }
        } else {
            // Utiliser Haversine directement
            self.calculate_distance_haversine(origin, destination)
        };

        // Mettre en cache avec TTL de 1 heure (les distances ne changent pas)
        let _ = self
            .cache_service
            .set_with_ttl(&cache_key, &result, Duration::from_secs(3600))
            .await;

        Ok(result)
    }

    /// Calcule la distance avec la formule de Haversine (distance à vol d'oiseau)
    fn calculate_distance_haversine(
        &self,
        origin: (f64, f64),
        destination: (f64, f64),
    ) -> DistanceResult {
        use crate::services::delivery_service::haversine_distance;

        let distance_meters = haversine_distance(origin, destination);

        DistanceResult {
            distance_meters,
            duration_seconds: None,
            source: DistanceSource::Haversine,
        }
    }

    /// Calcule la distance routière avec Google Maps Distance Matrix API
    async fn calculate_distance_google_maps(
        &self,
        origin: (f64, f64),
        destination: (f64, f64),
    ) -> AppResult<DistanceResult> {
        let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
            .map_err(|_| AppError::Internal("GOOGLE_MAPS_API_KEY non configurée".to_string()))?;

        let url = format!(
            "https://maps.googleapis.com/maps/api/distancematrix/json?origins={},{}&destinations={},{}&key={}&units=metric&language=fr",
            origin.0, origin.1, destination.0, destination.1, api_key
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur requête Google Maps: {}", e)))?;

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing Google Maps: {}", e)))?;

        // Parser la réponse Google Maps
        if let Some(rows) = data.get("rows").and_then(|r| r.as_array()) {
            if let Some(row) = rows.first() {
                if let Some(elements) = row.get("elements").and_then(|e| e.as_array()) {
                    if let Some(element) = elements.first() {
                        if let Some(status) = element.get("status").and_then(|s| s.as_str()) {
                            if status == "OK" {
                                let distance_meters = element
                                    .get("distance")
                                    .and_then(|d| d.get("value"))
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.0);

                                let duration_seconds = element
                                    .get("duration")
                                    .and_then(|d| d.get("value"))
                                    .and_then(|v| v.as_f64());

                                return Ok(DistanceResult {
                                    distance_meters,
                                    duration_seconds,
                                    source: DistanceSource::GoogleMaps,
                                });
                            }
                        }
                    }
                }
            }
        }

        Err(AppError::Internal(
            "Réponse Google Maps invalide".to_string(),
        ))
    }

    /// Construit une clé de cache pour une paire de coordonnées
    /// Arrondit les coordonnées à ~100m de précision pour améliorer le cache hit rate
    fn build_distance_cache_key(origin: (f64, f64), destination: (f64, f64)) -> String {
        // Arrondir à 3 décimales (~100m de précision)
        let round = |coord: f64| (coord * 1000.0).round() / 1000.0;
        let origin_rounded = (round(origin.0), round(origin.1));
        let dest_rounded = (round(destination.0), round(destination.1));

        // Trier les coordonnées pour que la clé soit symétrique (A->B = B->A)
        let (p1, p2) = if origin_rounded < dest_rounded {
            (origin_rounded, dest_rounded)
        } else {
            (dest_rounded, origin_rounded)
        };

        format!(
            "{}:{}:{}:{}:{}",
            cache_keys::MATCHING_RESULTS,
            p1.0,
            p1.1,
            p2.0,
            p2.1
        )
    }

    /// Trouve les coursiers disponibles dans un rayon donné
    /// Utilise le cache pour optimiser les requêtes fréquentes
    pub async fn find_couriers_in_radius(
        &self,
        center: (f64, f64),
        radius_meters: f64,
        limit: Option<i32>,
    ) -> AppResult<Vec<CourierLocation>> {
        let limit = limit.unwrap_or(20);
        let cache_key = format!(
            "{}:couriers:{}:{}:{}:{}",
            cache_keys::MATCHING_RESULTS,
            center.0,
            center.1,
            radius_meters,
            limit
        );

        // Essayer le cache (TTL court car les positions changent)
        if let Some(cached) = self.cache_service.get::<Vec<CourierLocation>>(&cache_key).await? {
            log::debug!(
                "[GeographicMatching] Coursiers récupérés du cache: {}",
                cached.len()
            );
            return Ok(cached);
        }

        // Requête SQL optimisée avec index géographique
        let couriers = sqlx::query_as::<_, CourierLocation>(
            r#"
            SELECT 
                c.id,
                c.user_id,
                c.status::text as status,
                COALESCE(cp.current_latitude, u.latitude) as latitude,
                COALESCE(cp.current_longitude, u.longitude) as longitude,
                ST_Distance(
                    ST_Point($2, $1)::geography,
                    ST_Point(
                        COALESCE(cp.current_longitude, u.longitude),
                        COALESCE(cp.current_latitude, u.latitude)
                    )::geography
                ) as distance_meters
            FROM couriers c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN courier_profiles cp ON cp.id = c.id
            WHERE c.status = 'approved'::delivery_courier_status
            AND (
                cp.current_latitude IS NOT NULL 
                OR u.latitude IS NOT NULL
            )
            AND ST_DWithin(
                ST_Point($2, $1)::geography,
                ST_Point(
                    COALESCE(cp.current_longitude, u.longitude),
                    COALESCE(cp.current_latitude, u.latitude)
                )::geography,
                $3
            )
            ORDER BY distance_meters ASC
            LIMIT $4
            "#,
        )
        .bind(center.0)
        .bind(center.1)
        .bind(radius_meters)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur recherche coursiers: {}", e)))?;

        // Mettre en cache avec TTL court (30 secondes) car les positions changent
        let _ = self
            .cache_service
            .set_with_ttl(&cache_key, &couriers, Duration::from_secs(30))
            .await;

        Ok(couriers)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourierLocation {
    pub id: Uuid,
    pub user_id: i32,
    pub status: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub distance_meters: Option<f64>,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for CourierLocation {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(CourierLocation {
            id: row.try_get("id")?,
            user_id: row.try_get("user_id")?,
            status: row.try_get("status")?,
            latitude: row.try_get("latitude")?,
            longitude: row.try_get("longitude")?,
            distance_meters: row.try_get("distance_meters")?,
        })
    }
}

