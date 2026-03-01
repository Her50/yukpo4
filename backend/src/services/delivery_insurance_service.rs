// ✅ Service pour calculer les frais d'assurance selon le type d'engin et la valeur des produits
use crate::core::types::AppResult;
use crate::models::delivery_model::DeliveryEngineType;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

/// Configuration des frais d'assurance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsuranceFeeConfig {
    pub engine_type: DeliveryEngineType,
    pub base_fee_fcfa: f64,       // Frais de base fixes
    pub percentage_rate: f64,     // Pourcentage sur la valeur des produits
    pub max_fee_fcfa: f64,        // Frais maximum plafonnés
    pub min_value_threshold: f64, // Seuil minimum de valeur des produits pour appliquer
    pub description: Option<String>,
}

impl InsuranceFeeConfig {
    /// Calcule les frais d'assurance pour une valeur de produits donnée
    pub fn calculate_insurance_fee(&self, product_value_fcfa: f64) -> f64 {
        // Si la valeur des produits est sous le seuil, pas de frais
        if product_value_fcfa < self.min_value_threshold {
            return 0.0;
        }

        // Calcul : frais de base + pourcentage de la valeur
        let percentage_fee = product_value_fcfa * (self.percentage_rate / 100.0);
        let total_fee = self.base_fee_fcfa + percentage_fee;

        // Plafonner aux frais maximum
        total_fee.min(self.max_fee_fcfa)
    }
}

/// Service de gestion des frais d'assurance
pub struct DeliveryInsuranceService {
    pool: PgPool,
}

impl DeliveryInsuranceService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Récupère la configuration des frais d'assurance pour un type d'engin
    pub async fn get_insurance_config(
        &self,
        engine_type: DeliveryEngineType,
    ) -> AppResult<InsuranceFeeConfig> {
        let row = sqlx::query_as::<_, InsuranceFeeConfigRow>(
            "SELECT engine_type, base_fee_fcfa, percentage_rate, max_fee_fcfa, 
                    min_value_threshold, description
             FROM delivery_insurance_fees
             WHERE engine_type = $1",
        )
        .bind(engine_type)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(InsuranceFeeConfig {
                engine_type: row.engine_type,
                base_fee_fcfa: row.base_fee_fcfa,
                percentage_rate: row.percentage_rate,
                max_fee_fcfa: row.max_fee_fcfa,
                min_value_threshold: row.min_value_threshold,
                description: row.description,
            })
        } else {
            // Fallback : utiliser la configuration par défaut
            Ok(Self::default_insurance(engine_type))
        }
    }

    /// Calcule les frais d'assurance pour un type d'engin et une valeur de produits
    pub async fn calculate_insurance_fee(
        &self,
        engine_type: DeliveryEngineType,
        product_value_fcfa: f64,
    ) -> AppResult<f64> {
        let config = self.get_insurance_config(engine_type).await?;
        Ok(config.calculate_insurance_fee(product_value_fcfa))
    }

    /// Configuration par défaut (fallback si pas en DB)
    fn default_insurance(engine_type: DeliveryEngineType) -> InsuranceFeeConfig {
        match engine_type {
            DeliveryEngineType::Pieton => InsuranceFeeConfig {
                engine_type,
                base_fee_fcfa: 0.0, // Pas d'assurance pour livraison à pied
                percentage_rate: 0.0,
                max_fee_fcfa: 0.0,
                min_value_threshold: 999999.0, // Jamais appliqué
                description: Some("Livraison à pied - pas d'assurance".to_string()),
            },
            DeliveryEngineType::VeloCargo => InsuranceFeeConfig {
                engine_type,
                base_fee_fcfa: 100.0,        // 100 FCFA de base
                percentage_rate: 0.5,        // 0.5% de la valeur
                max_fee_fcfa: 1000.0,        // Maximum 1000 FCFA
                min_value_threshold: 5000.0, // Appliqué si produits > 5000 FCFA
                description: Some("Vélo cargo".to_string()),
            },
            DeliveryEngineType::Scooter => InsuranceFeeConfig {
                engine_type,
                base_fee_fcfa: 200.0,        // 200 FCFA de base
                percentage_rate: 0.8,        // 0.8% de la valeur
                max_fee_fcfa: 2500.0,        // Maximum 2500 FCFA
                min_value_threshold: 3000.0, // Appliqué si produits > 3000 FCFA
                description: Some("Scooter".to_string()),
            },
            DeliveryEngineType::Moto => InsuranceFeeConfig {
                engine_type,
                base_fee_fcfa: 250.0,        // 250 FCFA de base
                percentage_rate: 1.0,        // 1% de la valeur
                max_fee_fcfa: 3000.0,        // Maximum 3000 FCFA
                min_value_threshold: 2000.0, // Appliqué si produits > 2000 FCFA
                description: Some("Moto".to_string()),
            },
            DeliveryEngineType::Tricycle => InsuranceFeeConfig {
                engine_type,
                base_fee_fcfa: 300.0,        // 300 FCFA de base
                percentage_rate: 1.2,        // 1.2% de la valeur
                max_fee_fcfa: 4000.0,        // Maximum 4000 FCFA
                min_value_threshold: 2000.0, // Appliqué si produits > 2000 FCFA
                description: Some("Tricycle".to_string()),
            },
            DeliveryEngineType::Voiture => InsuranceFeeConfig {
                engine_type,
                base_fee_fcfa: 500.0,        // 500 FCFA de base
                percentage_rate: 1.5,        // 1.5% de la valeur
                max_fee_fcfa: 5000.0,        // Maximum 5000 FCFA
                min_value_threshold: 1000.0, // Appliqué si produits > 1000 FCFA
                description: Some("Voiture".to_string()),
            },
            DeliveryEngineType::Camionnette => InsuranceFeeConfig {
                engine_type,
                base_fee_fcfa: 800.0,        // 800 FCFA de base
                percentage_rate: 2.0,        // 2% de la valeur
                max_fee_fcfa: 8000.0,        // Maximum 8000 FCFA
                min_value_threshold: 1000.0, // Appliqué si produits > 1000 FCFA
                description: Some("Camionnette/Pickup".to_string()),
            },
            DeliveryEngineType::CamionLeger => InsuranceFeeConfig {
                engine_type,
                base_fee_fcfa: 1200.0,       // 1200 FCFA de base
                percentage_rate: 2.5,        // 2.5% de la valeur
                max_fee_fcfa: 12000.0,       // Maximum 12000 FCFA
                min_value_threshold: 1000.0, // Appliqué si produits > 1000 FCFA
                description: Some("Camion léger".to_string()),
            },
            DeliveryEngineType::Autre => InsuranceFeeConfig {
                engine_type,
                base_fee_fcfa: 300.0,        // 300 FCFA de base
                percentage_rate: 1.0,        // 1% de la valeur
                max_fee_fcfa: 3000.0,        // Maximum 3000 FCFA
                min_value_threshold: 2000.0, // Appliqué si produits > 2000 FCFA
                description: Some("Autre type d'engin".to_string()),
            },
        }
    }

    /// Met à jour la configuration des frais d'assurance
    pub async fn update_insurance_config(
        &self,
        engine_type: DeliveryEngineType,
        base_fee_fcfa: f64,
        percentage_rate: f64,
        max_fee_fcfa: f64,
        min_value_threshold: f64,
        description: Option<String>,
    ) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO delivery_insurance_fees 
             (engine_type, base_fee_fcfa, percentage_rate, max_fee_fcfa, min_value_threshold, description)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (engine_type) 
             DO UPDATE SET 
                base_fee_fcfa = EXCLUDED.base_fee_fcfa,
                percentage_rate = EXCLUDED.percentage_rate,
                max_fee_fcfa = EXCLUDED.max_fee_fcfa,
                min_value_threshold = EXCLUDED.min_value_threshold,
                description = EXCLUDED.description,
                updated_at = NOW()"
        )
        .bind(engine_type)
        .bind(base_fee_fcfa)
        .bind(percentage_rate)
        .bind(max_fee_fcfa)
        .bind(min_value_threshold)
        .bind(description)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

#[derive(sqlx::FromRow)]
struct InsuranceFeeConfigRow {
    engine_type: DeliveryEngineType,
    base_fee_fcfa: f64,
    percentage_rate: f64,
    max_fee_fcfa: f64,
    min_value_threshold: f64,
    description: Option<String>,
}
