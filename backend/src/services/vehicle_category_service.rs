//! Catégorisation automatique des véhicules taxi
//!
//! Détermine la catégorie d'un véhicule (Économique / Standard / Confort / Premium)
//! à partir des informations déclarées par le chauffeur : marque/modèle, année,
//! type de véhicule, climatisation, wifi.
//!
//! Aucune saisie manuelle n'est requise : la catégorie est calculée à la volée.

use serde::{Deserialize, Serialize};

/// Catégorie tarifaire d'un véhicule taxi
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VehicleCategory {
    Economique,
    Standard,
    Confort,
    Premium,
}

impl VehicleCategory {
    /// Coefficient multiplicateur appliqué au tarif de base
    pub fn price_coefficient(self) -> f64 {
        match self {
            VehicleCategory::Economique => 0.85,
            VehicleCategory::Standard => 1.0,
            VehicleCategory::Confort => 1.30,
            VehicleCategory::Premium => 1.60,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            VehicleCategory::Economique => "Économique",
            VehicleCategory::Standard => "Standard",
            VehicleCategory::Confort => "Confort",
            VehicleCategory::Premium => "Premium",
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            VehicleCategory::Economique => "economique",
            VehicleCategory::Standard => "standard",
            VehicleCategory::Confort => "confort",
            VehicleCategory::Premium => "premium",
        }
    }

    /// Emoji pour affichage mobile
    pub fn emoji(self) -> &'static str {
        match self {
            VehicleCategory::Economique => "🚗",
            VehicleCategory::Standard => "🚕",
            VehicleCategory::Confort => "🚙",
            VehicleCategory::Premium => "🏎️",
        }
    }
}

// ---------------------------------------------------------------------------
// Listes de référence
// ---------------------------------------------------------------------------

/// Marques considérées comme luxe/premium
const LUXURY_BRANDS: &[&str] = &[
    "mercedes",
    "mercedes-benz",
    "bmw",
    "audi",
    "lexus",
    "land rover",
    "range rover",
    "porsche",
    "jaguar",
    "volvo",
    "infiniti",
    "acura",
    "cadillac",
    "lincoln",
    "bentley",
    "maserati",
    "tesla",
    "genesis",
    "alfa romeo",
];

/// Marques segment intermédiaire supérieur (orientent vers Confort si autres critères OK)
const UPPER_MID_BRANDS: &[&str] = &[
    "honda",
    "volkswagen",
    "vw",
    "nissan",
    "subaru",
    "mazda",
    "mitsubishi",
    "ford",
    "chevrolet",
    "hyundai",
    "kia",
    "skoda",
    "seat",
    "peugeot",
    "renault",
    "citroen",
    "opel",
    "fiat",
    "suzuki",
    "dacia",
];

/// Types de carrosserie "supérieurs" (SUV, berline, limousine)
const UPPER_BODY_TYPES: &[&str] = &[
    "suv",
    "4x4",
    "berline",
    "limousine",
    "sedan",
    "crossover",
    "break",
    "cabriolet",
    "coupe",
    "coupé",
];

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/// Catégorise automatiquement un véhicule taxi.
///
/// Règles (ordre de priorité décroissant) :
///
/// **Premium** : marque luxe + âge ≤ 8 ans + climatisation
///
/// **Confort** (l'un des critères) :
///   - Marque luxe mais vieux (> 8 ans) ou sans clim
///   - Marque intermédiaire + âge ≤ 6 ans + clim + wifi
///   - Carrosserie supérieure + âge ≤ 6 ans + clim + wifi
///   - Tout véhicule ≤ 4 ans + clim + wifi
///
/// **Standard** : clim présente + âge ≤ 12 ans
///
/// **Économique** : tous les autres cas
pub fn categorize_vehicle(
    type_vehicule: Option<&str>,
    marque_modele: Option<&str>,
    annee: Option<i32>,
    climatisation: bool,
    wifi: bool,
) -> VehicleCategory {
    // Année courante fixe (changeable via constante)
    const CURRENT_YEAR: i32 = 2026;
    let age = annee.map(|y| (CURRENT_YEAR - y).max(0)).unwrap_or(15); // inconnu → traité comme vieux

    let marque_lower = marque_modele.unwrap_or("").to_lowercase();
    let type_lower = type_vehicule.unwrap_or("").to_lowercase();

    let is_luxury = LUXURY_BRANDS.iter().any(|b| marque_lower.contains(b));
    let is_upper_mid = UPPER_MID_BRANDS.iter().any(|b| marque_lower.contains(b));
    let is_upper_body = UPPER_BODY_TYPES.iter().any(|t| type_lower.contains(t));

    // ── PREMIUM ──────────────────────────────────────────────────────────────
    if is_luxury && age <= 8 && climatisation {
        return VehicleCategory::Premium;
    }

    // ── CONFORT ───────────────────────────────────────────────────────────────
    // Marque luxe mais hors critères Premium → déclassé à Confort
    if is_luxury {
        return VehicleCategory::Confort;
    }
    // Marque intermédiaire récente + full équipée
    if is_upper_mid && age <= 6 && climatisation && wifi {
        return VehicleCategory::Confort;
    }
    // Carrosserie supérieure récente + full équipée
    if is_upper_body && age <= 6 && climatisation && wifi {
        return VehicleCategory::Confort;
    }
    // Véhicule très récent (≤ 4 ans) + clim + wifi, quelle que soit la marque
    if age <= 4 && climatisation && wifi {
        return VehicleCategory::Confort;
    }

    // ── STANDARD ──────────────────────────────────────────────────────────────
    if climatisation && age <= 12 {
        return VehicleCategory::Standard;
    }

    // ── ÉCONOMIQUE ────────────────────────────────────────────────────────────
    VehicleCategory::Economique
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mercedes_recent_clim_is_premium() {
        assert_eq!(
            categorize_vehicle(
                Some("berline"),
                Some("Mercedes C200"),
                Some(2022),
                true,
                true
            ),
            VehicleCategory::Premium
        );
    }

    #[test]
    fn test_mercedes_old_no_clim_is_confort() {
        assert_eq!(
            categorize_vehicle(
                Some("berline"),
                Some("Mercedes C200"),
                Some(2010),
                false,
                false
            ),
            VehicleCategory::Confort
        );
    }

    #[test]
    fn test_toyota_recent_clim_wifi_is_confort() {
        // Toyota n'est pas dans upper_mid mais SUV récent avec full équipement
        assert_eq!(
            categorize_vehicle(Some("SUV"), Some("Toyota Fortuner"), Some(2022), true, true),
            VehicleCategory::Confort
        );
    }

    #[test]
    fn test_honda_recent_clim_wifi_is_confort() {
        assert_eq!(
            categorize_vehicle(
                Some("berline"),
                Some("Honda Accord"),
                Some(2021),
                true,
                true
            ),
            VehicleCategory::Confort
        );
    }

    #[test]
    fn test_old_no_clim_is_economique() {
        assert_eq!(
            categorize_vehicle(Some("moto"), Some("Yamaha"), Some(2008), false, false),
            VehicleCategory::Economique
        );
    }

    #[test]
    fn test_renault_clim_standard() {
        assert_eq!(
            categorize_vehicle(
                Some("berline"),
                Some("Renault Logan"),
                Some(2016),
                true,
                false
            ),
            VehicleCategory::Standard
        );
    }
}
