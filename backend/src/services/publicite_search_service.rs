use log;
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use crate::services::cache_service::CacheService;

/// Service pour enrichir les résultats de recherche avec les informations de publicité
pub struct PubliciteSearchService {
    cache_service: Option<Arc<CacheService>>,
}

impl PubliciteSearchService {
    /// Crée un nouveau service avec cache optionnel
    pub fn new(cache_service: Option<Arc<CacheService>>) -> Self {
        Self { cache_service }
    }

    /// Enrichir les résultats de recherche avec le flag en_promotion
    /// et booster le score des produits en publicité active
    /// ✅ OPTIMISÉ: Utilise le cache et les colonnes pré-calculées pub_lng/pub_lat
    pub async fn enrich_search_results_with_promotion(
        &self,
        pool: &PgPool,
        results: &mut Vec<serde_json::Value>,
        _user_gps: Option<(f64, f64)>, // (latitude, longitude)
    ) -> Result<(), sqlx::Error> {
        if results.is_empty() {
            return Ok(());
        }

        // ✅ OPTIMISÉ: Vérifier le cache d'abord
        let cache_key = "publicites:active";
        let active_publicites: Option<Vec<(i32, Vec<String>, String, Option<f64>, Option<f64>, Option<i32>)>> = 
            if let Some(cache) = &self.cache_service {
                cache.get(cache_key).await.unwrap_or(None)
            } else {
                None
            };

        let active_publicites = if let Some(cached) = active_publicites {
            log::debug!("[PubliciteSearchService] Cache hit pour publicités actives");
            cached
        } else {
            log::debug!("[PubliciteSearchService] Cache miss, requête DB");
            
            // ✅ OPTIMISÉ: Utiliser les colonnes pré-calculées pub_lng/pub_lat au lieu de ST_X/ST_Y
            // Cela évite le calcul géométrique à chaque requête (409ms → <50ms)
            let rows = sqlx::query(
                r#"
                SELECT 
                    id,
                    produits_indexes,
                    zone_geographique,
                    pub_lng,
                    pub_lat,
                    rayon_km
                FROM publicites
                WHERE status = 'active'
                  AND date_fin > NOW()
                  AND date_debut <= NOW()
                ORDER BY date_debut DESC
                LIMIT 1000
                "#,
            )
            .fetch_all(pool)
            .await?;

            let mut publicites = Vec::new();
            for row in rows {
                let id: i32 = row.get("id");
                let produits_indexes: Vec<String> = row.try_get("produits_indexes").unwrap_or_default();
                let zone: String = row.try_get("zone_geographique").unwrap_or_default();
                let pub_lng: Option<f64> = row.try_get("pub_lng").ok();
                let pub_lat: Option<f64> = row.try_get("pub_lat").ok();
                let rayon_km: Option<i32> = row.try_get("rayon_km").ok();
                
                publicites.push((id, produits_indexes, zone, pub_lng, pub_lat, rayon_km));
            }

            // ✅ Mettre en cache pour 5 minutes
            if let Some(cache) = &self.cache_service {
                let _ = cache.set_with_ttl(cache_key, &publicites, Duration::from_secs(300)).await;
            }

            publicites
        };

        // Créer un HashMap pour lookup rapide
        let mut promotion_map: HashMap<String, (String, Option<f64>, Option<f64>, Option<i32>)> =
            HashMap::new();

        for (_, produits_indexes, zone, pub_lng, pub_lat, rayon_km) in active_publicites {
            for product_key in produits_indexes {
                promotion_map.insert(product_key, (zone.clone(), pub_lng, pub_lat, rayon_km));
            }
        }

        // Enrichir chaque résultat
        for result in results.iter_mut() {
            // Clone service_id pour éviter le conflit de borrow
            let service_id = result
                .get("service_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            if let Some(service_id_str) = service_id {
                // Pour chaque produit du service, vérifier s'il est en promotion
                if let Some(data) = result.get_mut("data").and_then(|v| v.as_object_mut()) {
                    if let Some(produits) = data.get_mut("produits").and_then(|p| p.as_array_mut())
                    {
                        for (idx, product) in produits.iter_mut().enumerate() {
                            let product_key = format!("{}_{}", service_id_str, idx);

                            if let Some((zone, _pub_lng, _pub_lat, _rayon_km)) =
                                promotion_map.get(&product_key)
                            {
                                // Marquer comme en promotion
                                if let Some(prod_obj) = product.as_object_mut() {
                                    prod_obj.insert(
                                        "en_promotion".to_string(),
                                        serde_json::json!(true),
                                    );
                                    prod_obj.insert(
                                        "promotion_active".to_string(),
                                        serde_json::json!(true),
                                    );
                                    prod_obj.insert(
                                        "publicite_zone".to_string(),
                                        serde_json::json!(zone),
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        // ✅ BOOSTER LE SCORE après avoir fini de modifier les produits
        for result in results.iter_mut() {
            if let Some(service_id) = result.get("service_id").and_then(|v| v.as_str()) {
                if let Some(data) = result.get("data").and_then(|v| v.as_object()) {
                    if let Some(produits) = data.get("produits").and_then(|p| p.as_array()) {
                        for (idx, product) in produits.iter().enumerate() {
                            let product_key = format!("{}_{}", service_id, idx);

                            if promotion_map.contains_key(&product_key) {
                                if let Some(prod_obj) = product.as_object() {
                                    if prod_obj
                                        .get("en_promotion")
                                        .and_then(|v| v.as_bool())
                                        .unwrap_or(false)
                                    {
                                        let current_score = result
                                            .get("score")
                                            .and_then(|v| v.as_f64())
                                            .unwrap_or(0.0);

                                        let bonus = 100.0; // Bonus fixe pour promotion
                                        let new_score = current_score + bonus;

                                        if let Some(score_val) = result.get_mut("score") {
                                            *score_val = serde_json::json!(new_score);
                                        }

                                        log::debug!(
                                            "🎯 Produit {} en promotion: score {} → {} (+{} bonus)",
                                            product_key,
                                            current_score,
                                            new_score,
                                            bonus
                                        );
                                        break; // Un seul bonus par résultat
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

/// Calculer la distance entre deux points GPS en km (formule de Haversine)
#[allow(dead_code)]
fn calculate_distance(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let r = 6371.0; // Rayon de la Terre en km

    let dlat = (lat2 - lat1).to_radians();
    let dlng = (lng2 - lng1).to_radians();

    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlng / 2.0).sin().powi(2);

    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    r * c
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_distance() {
        // Distance Douala - Yaoundé (environ 230 km)
        let distance = calculate_distance(4.0511, 9.7679, 3.8480, 11.5021);
        assert!(
            (distance - 230.0).abs() < 40.0,
            "Distance attendue ≈230km, obtenu {distance:.2}km"
        );
    }
}
