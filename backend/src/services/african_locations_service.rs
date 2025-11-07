// 🗺️ Service de géolocalisation locale pour l'Afrique francophone
// Fournit la hiérarchie DESCENDANTE (enfants) manquante dans Google Places API
// ✅ NOUVEAU 2025-11-06: Lit depuis la table PostgreSQL african_locations

use log::warn;
use sqlx::PgPool;

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
}

// Tests nécessitent une connexion BDD, à exécuter avec cargo test --features test-db
