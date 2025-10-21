use sqlx::{PgPool, Row};
use std::collections::HashMap;
use log;

/// Service pour enrichir les résultats de recherche avec les informations de publicité
pub struct PubliciteSearchService;

impl PubliciteSearchService {
    /// Enrichir les résultats de recherche avec le flag en_promotion
    /// et booster le score des produits en publicité active
    pub async fn enrich_search_results_with_promotion(
        pool: &PgPool,
        results: &mut Vec<serde_json::Value>,
        _user_gps: Option<(f64, f64)>, // (latitude, longitude)
    ) -> Result<(), sqlx::Error> {
        if results.is_empty() {
            return Ok(());
        }

        // Récupérer toutes les publicités actives avec leurs produits
        let active_publicites = sqlx::query(
            r#"
            SELECT 
                id,
                produits_indexes,
                zone_geographique,
                ST_X(geo_publicitaire::geometry) as pub_lng,
                ST_Y(geo_publicitaire::geometry) as pub_lat,
                rayon_km
            FROM publicites
            WHERE status = 'active'
            AND date_fin > NOW()
            "#
        )
        .fetch_all(pool)
        .await?;

        // Créer un HashMap pour lookup rapide
        let mut promotion_map: HashMap<String, (String, Option<f64>, Option<f64>, Option<i32>)> = HashMap::new();
        
        for pub_record in active_publicites {
            let produits_indexes: Vec<String> = pub_record.try_get("produits_indexes").unwrap_or_default();
            let zone: String = pub_record.try_get("zone_geographique").unwrap_or_default();
            let pub_lng: Option<f64> = pub_record.try_get("pub_lng").ok();
            let pub_lat: Option<f64> = pub_record.try_get("pub_lat").ok();
            let rayon_km: Option<i32> = pub_record.try_get("rayon_km").ok();

            for product_key in produits_indexes {
                promotion_map.insert(
                    product_key,
                    (
                        zone.clone(),
                        pub_lng,
                        pub_lat,
                        rayon_km
                    )
                );
            }
        }

        // Enrichir chaque résultat
        for result in results.iter_mut() {
            // Clone service_id pour éviter le conflit de borrow
            let service_id = result.get("service_id").and_then(|v| v.as_str()).map(|s| s.to_string());
            
            if let Some(service_id_str) = service_id {
                // Pour chaque produit du service, vérifier s'il est en promotion
                if let Some(data) = result.get_mut("data").and_then(|v| v.as_object_mut()) {
                    if let Some(produits) = data.get_mut("produits").and_then(|p| p.as_array_mut()) {
                        for (idx, product) in produits.iter_mut().enumerate() {
                            let product_key = format!("{}_{}", service_id_str, idx);
                            
                            if let Some((zone, _pub_lng, _pub_lat, _rayon_km)) = promotion_map.get(&product_key) {
                                // Marquer comme en promotion
                                if let Some(prod_obj) = product.as_object_mut() {
                                    prod_obj.insert("en_promotion".to_string(), serde_json::json!(true));
                                    prod_obj.insert("promotion_active".to_string(), serde_json::json!(true));
                                    prod_obj.insert("publicite_zone".to_string(), serde_json::json!(zone));
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
                                    if prod_obj.get("en_promotion").and_then(|v| v.as_bool()).unwrap_or(false) {
                                        let current_score = result.get("score")
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
        + lat1.to_radians().cos()
            * lat2.to_radians().cos()
            * (dlng / 2.0).sin().powi(2);

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
        assert!((distance - 230.0).abs() < 20.0); // Marge de 20 km
    }
}

