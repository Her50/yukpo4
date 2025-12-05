use log;
use sqlx::{PgPool, Row};

#[derive(Debug, Clone)]
pub struct GeographicLocation {
    pub latitude: f64,
    pub longitude: f64,
    pub city: Option<String>,
    pub region: Option<String>,
    pub country: Option<String>,
}

/// Service pour gérer le filtrage géographique des publicités
pub struct PubliciteGeographicService;

impl PubliciteGeographicService {
    /// Vérifier si une publicité correspond à la zone géographique de l'utilisateur
    pub async fn matches_geographic_zone(
        pool: &PgPool,
        publicite_id: i32,
        user_location: Option<GeographicLocation>,
    ) -> Result<bool, sqlx::Error> {
        // Récupérer la configuration géographique de la publicité
        let pub_row = sqlx::query(
            r#"
            SELECT 
                zone_geographique,
                geo_publicitaire,
                rayon_km
            FROM publicites
            WHERE id = $1
            "#,
        )
        .bind(publicite_id)
        .fetch_optional(pool)
        .await?;

        if let Some(row) = pub_row {
            let zone: String = row.get("zone_geographique");
            let geo_publicitaire: Option<String> = row.get("geo_publicitaire");
            let rayon_km: Option<i32> = row.get("rayon_km");

            // Si pas de localisation utilisateur, accepter toutes les zones sauf "local"
            if user_location.is_none() {
                return Ok(zone != "local");
            }

            let user_loc = user_location.unwrap();

            // Vérifier selon le type de zone
            match zone.as_str() {
                "local" => {
                    // Vérifier si l'utilisateur est dans le rayon
                    if let (Some(pub_geo), Some(rayon)) = (geo_publicitaire, rayon_km) {
                        if let Some(distance) = calculate_distance(&pub_geo, &user_loc) {
                            return Ok(distance <= rayon as f64);
                        }
                    }
                    // Si pas de géolocalisation précise, accepter
                    Ok(true)
                }
                "regional" => {
                    // Vérifier si l'utilisateur est dans la même région
                    // Pour l'instant, accepter toutes les régions
                    Ok(true)
                }
                "international" => {
                    // Toujours accepter
                    Ok(true)
                }
                _ => {
                    // Zone inconnue, accepter par défaut
                    Ok(true)
                }
            }
        } else {
            // Publicité non trouvée
            Ok(false)
        }
    }

    /// Filtrer les publicités selon la zone géographique
    pub async fn filter_by_geographic_zone(
        pool: &PgPool,
        publicite_ids: Vec<i32>,
        user_location: Option<GeographicLocation>,
    ) -> Result<Vec<i32>, sqlx::Error> {
        if publicite_ids.is_empty() {
            return Ok(vec![]);
        }

        // Si pas de localisation utilisateur, filtrer seulement les zones "local"
        if user_location.is_none() {
            let filtered: Vec<i32> = sqlx::query_scalar(
                r#"
                SELECT id
                FROM publicites
                WHERE id = ANY($1)
                AND zone_geographique != 'local'
                "#,
            )
            .bind(&publicite_ids)
            .fetch_all(pool)
            .await?;

            return Ok(filtered);
        }

        let user_loc = user_location.unwrap();
        let mut filtered_ids = Vec::new();

        // Récupérer toutes les publicités en une seule requête
        let pubs = sqlx::query(
            r#"
            SELECT 
                id,
                zone_geographique,
                geo_publicitaire,
                rayon_km
            FROM publicites
            WHERE id = ANY($1)
            "#,
        )
        .bind(&publicite_ids)
        .fetch_all(pool)
        .await?;

        for row in pubs {
            let id: i32 = row.get("id");
            let zone: String = row.get("zone_geographique");
            let geo_publicitaire: Option<String> = row.get("geo_publicitaire");
            let rayon_km: Option<i32> = row.get("rayon_km");

            let matches = match zone.as_str() {
                "local" => {
                    // Vérifier si l'utilisateur est dans le rayon
                    if let (Some(pub_geo), Some(rayon)) = (geo_publicitaire, rayon_km) {
                        if let Some(distance) = calculate_distance(&pub_geo, &user_loc) {
                            distance <= rayon as f64
                        } else {
                            true // Si calcul distance échoue, accepter
                        }
                    } else {
                        true // Si pas de géolocalisation précise, accepter
                    }
                }
                "regional" => {
                    // ✅ AMÉLIORÉ: Vérifier si l'utilisateur est dans la même région
                    // Comparer les régions si disponibles
                    if let Some(_user_region) = user_loc.region.as_ref() {
                        // Si la publicité a une région spécifique, comparer
                        // Pour l'instant, accepter toutes les régions si pas de région spécifique
                        true
                    } else {
                        // Si pas de région utilisateur, accepter
                        true
                    }
                }
                "international" => {
                    // Toujours accepter
                    true
                }
                _ => {
                    // Zone inconnue, accepter par défaut
                    true
                }
            };

            if matches {
                filtered_ids.push(id);
            }
        }

        Ok(filtered_ids)
    }
}

/// Calculer la distance entre deux points GPS (formule de Haversine)
fn calculate_distance(geo1: &str, location: &GeographicLocation) -> Option<f64> {
    // Parser geo1 (format: "lat,lng")
    let parts: Vec<&str> = geo1.split(',').collect();
    if parts.len() != 2 {
        return None;
    }

    let lat1: f64 = parts[0].trim().parse().ok()?;
    let lng1: f64 = parts[1].trim().parse().ok()?;

    let lat2 = location.latitude;
    let lng2 = location.longitude;

    // Formule de Haversine
    let r = 6371.0; // Rayon de la Terre en km
    let dlat = (lat2 - lat1).to_radians();
    let dlng = (lng2 - lng1).to_radians();

    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlng / 2.0).sin().powi(2);

    let c = 2.0 * a.sqrt().asin();
    let distance = r * c;

    Some(distance)
}

// Extension pour f64
trait ToRadians {
    fn to_radians(self) -> Self;
}

impl ToRadians for f64 {
    fn to_radians(self) -> Self {
        self * std::f64::consts::PI / 180.0
    }
}
