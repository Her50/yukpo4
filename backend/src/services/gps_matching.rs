// ✅ Phase 6.1: Service de matching GPS pour covoiturages et taxis

use log::info;
use sqlx::PgPool;

// Extension trait pour to_radians
#[allow(dead_code)]
trait ToRadians {
    fn to_radians(self) -> f64;
}

impl ToRadians for f64 {
    fn to_radians(self) -> f64 {
        self * std::f64::consts::PI / 180.0
    }
}

/// Calculer la distance entre deux points GPS (formule de Haversine)
/// Retourne la distance en kilomètres
pub fn calculate_distance_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const EARTH_RADIUS_KM: f64 = 6371.0;

    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();

    let a = (d_lat / 2.0).sin() * (d_lat / 2.0).sin()
        + lat1.to_radians().cos()
            * lat2.to_radians().cos()
            * (d_lon / 2.0).sin()
            * (d_lon / 2.0).sin();

    let c = 2.0 * a.sqrt().asin();
    EARTH_RADIUS_KM * c
}

/// Trouver les utilisateurs dans un rayon donné autour d'un point GPS
pub async fn find_users_in_radius(
    pool: &PgPool,
    center_lat: f64,
    center_lon: f64,
    radius_km: f64,
) -> Result<Vec<i32>, Box<dyn std::error::Error>> {
    info!(
        "[GPSMatching] Recherche utilisateurs dans rayon {} km autour de ({}, {})",
        radius_km, center_lat, center_lon
    );

    // Utiliser une approximation rapide pour filtrer d'abord
    // 1 degré de latitude ≈ 111 km
    let lat_delta = radius_km / 111.0;
    let lon_delta = radius_km / (111.0 * center_lat.to_radians().cos());

    let users: Vec<(i32, f64, f64)> = sqlx::query_as(
        r#"
        SELECT u.id, u.latitude, u.longitude
        FROM users u
        WHERE u.latitude IS NOT NULL
          AND u.longitude IS NOT NULL
          AND u.latitude BETWEEN $1 AND $2
          AND u.longitude BETWEEN $3 AND $4
        "#,
    )
    .bind(center_lat - lat_delta)
    .bind(center_lat + lat_delta)
    .bind(center_lon - lon_delta)
    .bind(center_lon + lon_delta)
    .fetch_all(pool)
    .await?;

    // Filtrer avec la distance exacte
    let mut user_ids = Vec::new();
    for (user_id, lat, lon) in users {
        let distance = calculate_distance_km(center_lat, center_lon, lat, lon);
        if distance <= radius_km {
            user_ids.push(user_id);
        }
    }

    info!(
        "[GPSMatching] ✅ {} utilisateurs trouvés dans le rayon",
        user_ids.len()
    );
    Ok(user_ids)
}

/// Trouver les covoiturages correspondants à une recherche
pub async fn find_matching_carpools(
    pool: &PgPool,
    user_lat: f64,
    user_lon: f64,
    destination_lat: f64,
    destination_lon: f64,
    max_distance_km: f64,
) -> Result<Vec<(i32, String, String)>, Box<dyn std::error::Error>> {
    info!(
        "[GPSMatching] Recherche covoiturages: ({}, {}) → ({}, {})",
        user_lat, user_lon, destination_lat, destination_lon
    );

    // Récupérer les covoiturages actifs
    let carpool_services: Vec<(i32, serde_json::Value)> = sqlx::query_as(
        r#"
        SELECT s.id, s.data
        FROM services s
        WHERE s.specialized_type = 'covoiturage'
          AND s.is_active = true
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut matches = Vec::new();

    for (service_id, data) in carpool_services {
        // Extraire les coordonnées depuis les métadonnées
        let departure_lat = data
            .get("departure_latitude")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let departure_lon = data
            .get("departure_longitude")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let dest_lat = data
            .get("destination_latitude")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let dest_lon = data
            .get("destination_longitude")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        if departure_lat == 0.0 || departure_lon == 0.0 || dest_lat == 0.0 || dest_lon == 0.0 {
            continue;
        }

        // Vérifier si le départ est proche de l'utilisateur
        let distance_departure =
            calculate_distance_km(user_lat, user_lon, departure_lat, departure_lon);
        // Vérifier si la destination correspond
        let distance_destination =
            calculate_distance_km(destination_lat, destination_lon, dest_lat, dest_lon);

        if distance_departure <= max_distance_km && distance_destination <= max_distance_km {
            let departure_name = data
                .get("departure")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let destination_name = data
                .get("destination")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            matches.push((service_id, departure_name, destination_name));
        }
    }

    info!(
        "[GPSMatching] ✅ {} covoiturages correspondants trouvés",
        matches.len()
    );
    Ok(matches)
}

/// Trouver les taxis disponibles dans une zone
pub async fn find_taxis_in_zone(
    pool: &PgPool,
    center_lat: f64,
    center_lon: f64,
    radius_km: f64,
) -> Result<Vec<(i32, String, f64, f64)>, Box<dyn std::error::Error>> {
    info!(
        "[GPSMatching] Recherche taxis dans rayon {} km autour de ({}, {})",
        radius_km, center_lat, center_lon
    );

    // Récupérer les taxis actifs
    let taxi_services: Vec<(i32, serde_json::Value)> = sqlx::query_as(
        r#"
        SELECT s.id, s.data
        FROM services s
        WHERE s.specialized_type = 'taxi'
          AND s.is_active = true
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut taxis = Vec::new();

    for (service_id, data) in taxi_services {
        let taxi_lat = data.get("latitude").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let taxi_lon = data
            .get("longitude")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        if taxi_lat == 0.0 || taxi_lon == 0.0 {
            continue;
        }

        let distance = calculate_distance_km(center_lat, center_lon, taxi_lat, taxi_lon);

        if distance <= radius_km {
            let taxi_name = data
                .get("nom_chauffeur")
                .and_then(|v| v.as_str())
                .or_else(|| data.get("telephone").and_then(|v| v.as_str()))
                .unwrap_or("Taxi")
                .to_string();

            taxis.push((service_id, taxi_name, taxi_lat, taxi_lon));
        }
    }

    info!(
        "[GPSMatching] ✅ {} taxis trouvés dans la zone",
        taxis.len()
    );
    Ok(taxis)
}
