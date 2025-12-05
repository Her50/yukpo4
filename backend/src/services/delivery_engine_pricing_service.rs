// ✅ Service pour calculer le coût de livraison selon le type d'engin
use crate::core::types::AppResult;
use crate::models::delivery_model::DeliveryEngineType;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

/// Configuration de prix par type d'engin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnginePricingConfig {
    pub engine_type: DeliveryEngineType,
    pub cost_per_km_fcfa: f64,  // Coût par kilomètre en FCFA
    pub minimum_cost_fcfa: f64, // Coût minimum garanti en FCFA
    pub fuel_consumption_l_per_km: Option<f64>, // Consommation carburant (optionnel, pour info)
    pub description: Option<String>,
}

impl EnginePricingConfig {
    /// Calcule le coût de livraison pour une distance donnée
    pub fn calculate_cost(&self, distance_km: f64) -> f64 {
        let cost = distance_km * self.cost_per_km_fcfa;
        cost.max(self.minimum_cost_fcfa)
    }
}

/// Service de gestion des prix par type d'engin
pub struct DeliveryEnginePricingService {
    pool: PgPool,
}

impl DeliveryEnginePricingService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Récupère la configuration de prix pour un type d'engin
    pub async fn get_pricing_config(
        &self,
        engine_type: DeliveryEngineType,
    ) -> AppResult<EnginePricingConfig> {
        let row = sqlx::query_as::<_, EnginePricingConfigRow>(
            "SELECT engine_type, cost_per_km_fcfa, minimum_cost_fcfa, 
                    fuel_consumption_l_per_km, description
             FROM delivery_engine_pricing
             WHERE engine_type = $1",
        )
        .bind(engine_type)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(EnginePricingConfig {
                engine_type: row.engine_type,
                cost_per_km_fcfa: row.cost_per_km_fcfa,
                minimum_cost_fcfa: row.minimum_cost_fcfa,
                fuel_consumption_l_per_km: row.fuel_consumption_l_per_km,
                description: row.description,
            })
        } else {
            // Fallback : utiliser la configuration par défaut
            Ok(Self::default_pricing(engine_type))
        }
    }

    /// Calcule le coût de livraison pour un type d'engin et une distance
    pub async fn calculate_delivery_cost(
        &self,
        engine_type: DeliveryEngineType,
        distance_km: f64,
    ) -> AppResult<f64> {
        let config = self.get_pricing_config(engine_type).await?;
        Ok(config.calculate_cost(distance_km))
    }

    /// Récupère tous les types d'engin avec leurs configurations
    pub async fn get_all_pricing_configs(&self) -> AppResult<Vec<EnginePricingConfig>> {
        let rows = sqlx::query_as::<_, EnginePricingConfigRow>(
            "SELECT engine_type, cost_per_km_fcfa, minimum_cost_fcfa,
                    fuel_consumption_l_per_km, description
             FROM delivery_engine_pricing
             ORDER BY cost_per_km_fcfa ASC",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| EnginePricingConfig {
                engine_type: row.engine_type,
                cost_per_km_fcfa: row.cost_per_km_fcfa,
                minimum_cost_fcfa: row.minimum_cost_fcfa,
                fuel_consumption_l_per_km: row.fuel_consumption_l_per_km,
                description: row.description,
            })
            .collect())
    }

    /// Met à jour la configuration de prix pour un type d'engin
    pub async fn update_pricing_config(
        &self,
        engine_type: DeliveryEngineType,
        cost_per_km_fcfa: f64,
        minimum_cost_fcfa: f64,
        fuel_consumption_l_per_km: Option<f64>,
        description: Option<String>,
    ) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO delivery_engine_pricing 
             (engine_type, cost_per_km_fcfa, minimum_cost_fcfa, fuel_consumption_l_per_km, description)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (engine_type) 
             DO UPDATE SET 
                cost_per_km_fcfa = EXCLUDED.cost_per_km_fcfa,
                minimum_cost_fcfa = EXCLUDED.minimum_cost_fcfa,
                fuel_consumption_l_per_km = EXCLUDED.fuel_consumption_l_per_km,
                description = EXCLUDED.description,
                updated_at = NOW()"
        )
        .bind(engine_type)
        .bind(cost_per_km_fcfa)
        .bind(minimum_cost_fcfa)
        .bind(fuel_consumption_l_per_km)
        .bind(description)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Configuration par défaut (fallback si pas en DB)
    fn default_pricing(engine_type: DeliveryEngineType) -> EnginePricingConfig {
        match engine_type {
            DeliveryEngineType::Pieton => EnginePricingConfig {
                engine_type,
                cost_per_km_fcfa: 200.0,  // 200 FCFA/km (à pied)
                minimum_cost_fcfa: 500.0, // Minimum 500 FCFA
                fuel_consumption_l_per_km: None,
                description: Some("Livraison à pied".to_string()),
            },
            DeliveryEngineType::VeloCargo => EnginePricingConfig {
                engine_type,
                cost_per_km_fcfa: 200.0,  // 200 FCFA/km (vélo cargo - réduit)
                minimum_cost_fcfa: 800.0, // Minimum 800 FCFA (conservé)
                fuel_consumption_l_per_km: None,
                description: Some("Vélo cargo".to_string()),
            },
            DeliveryEngineType::Scooter => EnginePricingConfig {
                engine_type,
                cost_per_km_fcfa: 225.0, // 225 FCFA/km (réduit de moitié de 450, aligné avec moto)
                minimum_cost_fcfa: 1000.0, // Minimum 1000 FCFA (conservé)
                fuel_consumption_l_per_km: Some(0.03), // ~3L/100km
                description: Some("Scooter".to_string()),
            },
            DeliveryEngineType::Moto => EnginePricingConfig {
                engine_type,
                cost_per_km_fcfa: 225.0, // 225 FCFA/km (réduit de moitié de 450, aligné avec scooter)
                minimum_cost_fcfa: 1000.0, // Minimum 1000 FCFA (conservé)
                fuel_consumption_l_per_km: Some(0.04), // ~4L/100km
                description: Some("Moto".to_string()),
            },
            DeliveryEngineType::Tricycle => EnginePricingConfig {
                engine_type,
                cost_per_km_fcfa: 250.0,   // 250 FCFA/km (tricycle)
                minimum_cost_fcfa: 1000.0, // Minimum 1000 FCFA
                fuel_consumption_l_per_km: Some(0.035), // ~3.5L/100km
                description: Some("Tricycle".to_string()),
            },
            DeliveryEngineType::Voiture => EnginePricingConfig {
                engine_type,
                cost_per_km_fcfa: 600.0,   // 600 FCFA/km (voiture - OK)
                minimum_cost_fcfa: 1500.0, // Minimum 1500 FCFA (conservé)
                fuel_consumption_l_per_km: Some(0.08), // ~8L/100km
                description: Some("Voiture".to_string()),
            },
            DeliveryEngineType::Camionnette => EnginePricingConfig {
                engine_type,
                cost_per_km_fcfa: 1000.0, // 1000 FCFA/km (camionnette/pickup - base 1000)
                minimum_cost_fcfa: 5000.0, // Minimum 5000 FCFA
                fuel_consumption_l_per_km: Some(0.10), // ~10L/100km
                description: Some("Camionnette/Pickup".to_string()),
            },
            DeliveryEngineType::CamionLeger => EnginePricingConfig {
                engine_type,
                cost_per_km_fcfa: 2000.0, // 2000 FCFA/km (camion - base 2000)
                minimum_cost_fcfa: 10000.0, // Minimum 10000 FCFA
                fuel_consumption_l_per_km: Some(0.12), // ~12L/100km
                description: Some("Camion léger".to_string()),
            },
            DeliveryEngineType::Autre => EnginePricingConfig {
                engine_type,
                cost_per_km_fcfa: 500.0,   // 500 FCFA/km (par défaut)
                minimum_cost_fcfa: 1000.0, // Minimum 1000 FCFA
                fuel_consumption_l_per_km: None,
                description: Some("Autre type d'engin".to_string()),
            },
        }
    }
}

#[derive(sqlx::FromRow)]
struct EnginePricingConfigRow {
    engine_type: DeliveryEngineType,
    cost_per_km_fcfa: f64,
    minimum_cost_fcfa: f64,
    fuel_consumption_l_per_km: Option<f64>,
    description: Option<String>,
}
