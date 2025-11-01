// 💰 Configuration des coûts de création de services et produits
// Ce fichier centralise tous les coûts pour faciliter les mises à jour

/// Coût de création du premier produit (basé sur tokens IA)
/// Formule : tokens_ia_externe * COST_PER_TOKEN_XAF * MULTIPLIER_FIRST_PRODUCT
pub const COST_PER_TOKEN_XAF: f64 = 0.004;
pub const MULTIPLIER_FIRST_PRODUCT: f64 = 100.0;

/// Coût fixe d'ajout d'un nouveau produit dupliqué (modifié)
/// Ce coût s'applique à partir du 2e produit dans un service
pub const COST_NEW_PRODUCT_DUPLICATE_XAF: i64 = 3000;

/// Coût minimum de création d'un service sans produits
pub const COST_SERVICE_MINIMUM_XAF: i64 = 500;

/// Coût de modification d'un service existant (GRATUIT)
pub const COST_SERVICE_UPDATE_XAF: i64 = 0;

/// Calculer le coût de création d'un service selon le contexte
pub fn calculate_service_creation_cost(
    tokens_ia_externe: i64,
    is_first_product: bool,
) -> i64 {
    if is_first_product {
        // Premier produit : coût basé sur tokens IA
        let cost = (tokens_ia_externe as f64) * COST_PER_TOKEN_XAF * MULTIPLIER_FIRST_PRODUCT;
        cost.round() as i64
    } else {
        // Produits suivants : coût fixe
        COST_NEW_PRODUCT_DUPLICATE_XAF
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_first_product_cost() {
        // Exemple : 1000 tokens IA
        let cost = calculate_service_creation_cost(1000, true);
        // 1000 * 0.004 * 100 = 400 FCFA
        assert_eq!(cost, 400);
    }

    #[test]
    fn test_duplicate_product_cost() {
        // Produit dupliqué : coût fixe 3000 FCFA
        let cost = calculate_service_creation_cost(0, false);
        assert_eq!(cost, COST_NEW_PRODUCT_DUPLICATE_XAF);
    }
}

