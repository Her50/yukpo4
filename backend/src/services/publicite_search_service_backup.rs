use sqlx::PgPool;
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
        user_gps: Option<(f64, f64)>, // (latitude, longitude)
    ) -> Result<(), sqlx::Error> {
        if results.is_empty() {
            return Ok(());
        }

        #[derive(sqlx::FromRow)]
        struct PubliciteRow {
            id: i32,
            produits_indexes: Vec<String>,
            zone_geographique: String,
            pub_lng: Option<f64>,
            pub_lat: Option<f64>,
            rayon_km: Option<i32>,
        }
        
        // Récupérer toutes les publicités actives avec leurs produits
        let active_publicites: Vec<PubliciteRow> = sqlx::query_as(
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
            for product_key in pub_record.produits_indexes {
                promotion_map.insert(
                    product_key,
                    (
                        pub_record.zone_geographique.clone(),
                        pub_record.pub_lng,
                        pub_record.pub_lat,
                        pub_record.rayon_km
                    )
                );
            }
        }

        // Enrichir chaque résultat
        for result in results.iter_mut() {
            if let Some(service_id) = result.get("service_id").and_then(|v| v.as_str()) {
                // Pour chaque produit du service, vérifier s'il est en promotion
                if let Some(data) = result.get_mut("data").and_then(|v| v.as_object_mut()) {
                    if let Some(produits) = data.get_mut("produits").and_then(|p| p.as_array_mut()) {
                        for (idx, product) in produits.iter_mut().enumerate() {
                            let product_key = format!("{}_{}", service_id, idx);
                            
                            if let Some((zone, pub_lng, pub_lat, rayon_km)) = promotion_map.get(&product_key) {
                                // Marquer comme en promotion
                                if let Some(prod_obj) = product.as_object_mut() {
                                    prod_obj.insert("en_promotion".to_string(), serde_json::json!(true));
                                    prod_obj.insert("promotion_active".to_string(), serde_json::json!(true));
                                    prod_obj.insert("publicite_zone".to_string(), serde_json::json!(zone));

                                    // ✅ BOOSTER LE SCORE
                                    let current_score = result.get("score")
                                        .and_then(|v| v.as_f64())
                                        .unwrap_or(0.0);

                                    let mut bonus = 100.0; // Bonus de base pour promotion

                                    // Bonus additionnel selon zone et proximité
                                    if let Some((user_lat, user_lng)) = user_gps {
                                        if let (Some(pub_lat_val), Some(pub_lng_val)) = (*pub_lat, *pub_lng) {
                                            let distance_km = calculate_distance(
                                                user_lat,
                                                user_lng,
                                                pub_lat_val,
                                                pub_lng_val
                                            );

                                            match zone.as_str() {
                                                "local" => {
                                                    let rayon = rayon_km.unwrap_or(50) as f64;
                                                    if distance_km <= rayon {
                                                        bonus += 20.0; // Zone locale pertinente
                                                    }
                                                }
                                                "regional" => {
                                                    // Vérifier si même pays (simplification: distance < 1000 km)
                                                    if distance_km < 1000.0 {
                                                        bonus += 10.0;
                                                    }
                                                }
                                                "international" => {
                                                    bonus += 5.0;
                                                }
                                                _ => {}
                                            }
                                        }
                                    }

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


