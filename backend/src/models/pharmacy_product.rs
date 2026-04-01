// ✅ NOUVEAU: Modèle pour produits de pharmacie

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PharmacyProduct {
    pub id: i32,
    pub pharmacy_service_id: i32,
    pub nom_produit: String,
    pub description: Option<String>,
    pub prix: rust_decimal::Decimal,
    pub stock: i32,
    pub disponible: bool,
    pub unite: String,
    pub code_barre: Option<String>,
    pub categorie: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PharmacyProductWithDistance {
    #[serde(flatten)]
    pub product: PharmacyProduct,
    pub distance_km: Option<f64>,
    pub pharmacy_nom: Option<String>,
    pub pharmacy_adresse: Option<String>,
    pub pharmacy_gps: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NearbyMedicationResult {
    #[serde(flatten)]
    pub product: PharmacyProduct,
    pub pharmacy_id: i32,
    pub pharmacy_nom: Option<String>,
    pub pharmacy_adresse: Option<String>,
    pub distance_km: Option<f64>,
    pub is_on_duty_now: bool,
    pub can_fulfill_quantity: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetCalculationItem {
    pub product_id: i32,
    pub nom_produit: String,
    pub quantity: i32,
    pub prix_unitaire: rust_decimal::Decimal,
    pub prix_total: rust_decimal::Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetCalculation {
    pub pharmacy_service_id: i32,
    pub pharmacy_nom: String,
    pub items: Vec<BudgetCalculationItem>,
    pub total: rust_decimal::Decimal,
    pub distance_km: Option<f64>,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetComparison {
    pub best_pharmacy: BudgetCalculation,
    pub all_pharmacies: Vec<BudgetCalculation>,
    pub savings: Option<rust_decimal::Decimal>, // Économie avec la meilleure pharmacie
}
