// 🗺️ Service de géolocalisation locale pour l'Afrique francophone
// Fournit la hiérarchie DESCENDANTE (enfants) manquante dans Google Places API
// ✅ NOUVEAU 2025-11-06: Lit depuis la table PostgreSQL african_locations

use log::warn;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalLocationData {
    pub display_name: String,
    pub location_vector: Vec<String>,
    pub coordinates: LocalCoordinates,
    pub geoname_id: Option<i64>,
    pub is_leaf: bool,
    pub admin_level: i32,
    pub country: String,
    pub country_code: Option<String>,
    pub population: Option<i32>,
    pub timezone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalCoordinates {
    pub lat: f64,
    pub lng: f64,
}

/// Service pour récupérer les enfants géographiques depuis la BDD
pub struct AfricanLocationsService;

impl AfricanLocationsService {
    pub fn new() -> Self {
        Self
    }

    /// Récupère les enfants d'un lieu depuis la BDD
    pub async fn get_children(
        &self,
        pool: &PgPool,
        place_name: &str,
        place_type: &str,
    ) -> Vec<String> {
        let place_lower = place_name.to_lowercase();

        match place_type {
            "city" | "locality" => {
                // Retourner les quartiers de cette ville
                let result = sqlx::query_scalar::<_, String>(
                    "SELECT quartier FROM african_locations WHERE LOWER(ville) = $1 AND quartier IS NOT NULL ORDER BY quartier"
                )
                .bind(&place_lower)
                .fetch_all(pool)
                .await;

                match result {
                    Ok(quartiers) => quartiers,
                    Err(e) => {
                        warn!(
                            "⚠️ Erreur récupération quartiers de '{}': {}",
                            place_name, e
                        );
                        vec![]
                    }
                }
            }
            "country" => {
                // Retourner toutes les villes de ce pays
                let result = sqlx::query_scalar::<_, String>(
                    "SELECT DISTINCT ville FROM african_locations WHERE LOWER(pays) = $1 AND ville IS NOT NULL ORDER BY ville"
                )
                .bind(&place_lower)
                .fetch_all(pool)
                .await;

                match result {
                    Ok(villes) => villes,
                    Err(e) => {
                        warn!("⚠️ Erreur récupération villes de '{}': {}", place_name, e);
                        vec![]
                    }
                }
            }
            _ => vec![],
        }
    }

    /// Détermine le type de lieu (pays, ville, quartier) depuis la BDD
    pub async fn get_place_type(&self, pool: &PgPool, place_name: &str) -> &str {
        let place_lower = place_name.to_lowercase();

        // Liste des pays
        let countries = vec![
            "cameroun",
            "sénégal",
            "côte d'ivoire",
            "mali",
            "burkina faso",
        ];
        if countries.iter().any(|c| place_lower.contains(c)) {
            return "country";
        }

        // Vérifier si c'est une ville dans la BDD
        let is_city = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM african_locations WHERE LOWER(ville) = $1)",
        )
        .bind(&place_lower)
        .fetch_one(pool)
        .await
        .unwrap_or(false);

        if is_city {
            return "city";
        }

        // Vérifier si c'est un quartier dans la BDD
        let is_neighborhood = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM african_locations WHERE LOWER(quartier) = $1)",
        )
        .bind(&place_lower)
        .fetch_one(pool)
        .await
        .unwrap_or(false);

        if is_neighborhood {
            return "neighborhood";
        }

        "unknown"
    }

    /// ✅ NOUVEAU: Recherche un lieu dans la base de données locale (fallback)
    pub async fn search_location(
        &self,
        pool: &PgPool,
        place_name: &str,
        country_hint: Option<&str>,
    ) -> Result<Option<LocalLocationData>, sqlx::Error> {
        let place_lower = place_name.to_lowercase();

        // Construire la requête SQL avec filtrage par pays si fourni
        let row = if let Some(country) = country_hint {
            let country_lower = country.to_lowercase();
            sqlx::query(
                "SELECT 
                    COALESCE(quartier, ville, pays) as display_name,
                    quartier,
                    ville,
                    pays,
                    lat,
                    lng
                 FROM african_locations 
                 WHERE (LOWER(quartier) = $1 OR LOWER(ville) = $1 OR LOWER(pays) = $1)
                   AND LOWER(pays) = $2
                 LIMIT 1",
            )
            .bind(&place_lower)
            .bind(&country_lower)
            .fetch_optional(pool)
            .await?
        } else {
            sqlx::query(
                "SELECT 
                    COALESCE(quartier, ville, pays) as display_name,
                    quartier,
                    ville,
                    pays,
                    lat,
                    lng
                 FROM african_locations 
                 WHERE LOWER(quartier) = $1 OR LOWER(ville) = $1 OR LOWER(pays) = $1
                 LIMIT 1",
            )
            .bind(&place_lower)
            .fetch_optional(pool)
            .await?
        };

        if let Some(row) = row {
            let display_name: String = row.get::<String, _>(0);
            let quartier: Option<String> = row.get::<Option<String>, _>(1);
            let ville: Option<String> = row.get::<Option<String>, _>(2);
            let pays: Option<String> = row.get::<Option<String>, _>(3);
            let lat: Option<f64> = row.get::<Option<f64>, _>(4);
            let lng: Option<f64> = row.get::<Option<f64>, _>(5);

            // Construire le location_vector
            let mut location_vector = Vec::new();
            if let Some(q) = &quartier {
                location_vector.push(q.clone());
            }
            if let Some(v) = &ville {
                if !location_vector.contains(v) {
                    location_vector.push(v.clone());
                }
            }

            let country = pays
                .or_else(|| country_hint.map(|c| c.to_string()))
                .unwrap_or_else(|| "Inconnu".to_string());

            if !location_vector.contains(&country) {
                location_vector.push(country.clone());
            }

            // Déterminer admin_level et is_leaf
            let admin_level = if quartier.is_some() {
                8 // Quartier
            } else if ville.is_some() {
                6 // Ville
            } else {
                0 // Pays
            };

            let is_leaf = admin_level >= 7;

            Ok(Some(LocalLocationData {
                display_name,
                location_vector,
                coordinates: LocalCoordinates {
                    lat: lat.unwrap_or(0.0),
                    lng: lng.unwrap_or(0.0),
                },
                geoname_id: None,
                is_leaf,
                admin_level,
                country,
                country_code: None,
                population: None,
                timezone: None,
            }))
        } else {
            Ok(None)
        }
    }
}

// Tests nécessitent une connexion BDD, à exécuter avec cargo test --features test-db
