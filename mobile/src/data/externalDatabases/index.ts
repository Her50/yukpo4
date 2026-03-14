/**
 * 📦 AGRÉGATEUR DES BASES DE DONNÉES EXTERNES
 * 
 * Ce fichier centralise l'accès à toutes les bases de données externes
 * pour faciliter l'import et la synchronisation.
 */

export { CAMEROON_LOCAL_PRODUCTS, getCameroonProductsByCategory, searchCameroonProduct } from './cameroonProducts';
export {
    BURKINA_FASO_LOCAL_PRODUCTS,
    getAllLocalProductsByCountryCode,
    getLocalProductCountByCountry, IVORY_COAST_LOCAL_PRODUCTS, MALI_LOCAL_PRODUCTS, searchLocalProducts, SENEGAL_LOCAL_PRODUCTS
} from './productsByCountry';

import { EnrichedProduct } from '../enrichedProductDatabase';
import { CAMEROON_LOCAL_PRODUCTS } from './cameroonProducts';
import { getAllLocalProductsByCountryCode, searchLocalProducts } from './productsByCountry';

/**
 * Obtenir tous les produits locaux par pays
 */
export function getAllLocalProductsByCountry(countryCode: string): Partial<EnrichedProduct>[] {
    switch (countryCode) {
        case 'CM':
            return CAMEROON_LOCAL_PRODUCTS;
        default:
            // Utiliser la fonction centralisée pour autres pays
            return getAllLocalProductsByCountryCode(countryCode);
    }
}

/**
 * Rechercher dans toutes les bases locales
 */
export function searchAllLocalProducts(query: string, countryCode?: string): Partial<EnrichedProduct>[] {
    // Utiliser la fonction centralisée de productsByCountry.ts
    return searchLocalProducts(query, countryCode);
}

/**
 * Obtenir le nombre total de produits par pays
 */
export function getProductCountByCountry(countryCode: string): number {
    return getAllLocalProductsByCountry(countryCode).length;
}

/**
 * Obtenir les catégories disponibles par pays
 */
export function getCategoriesByCountry(countryCode: string): string[] {
    const products = getAllLocalProductsByCountry(countryCode);
    const categories = new Set<string>();

    products.forEach(product => {
        const category = product.characteristics?.categorie;
        if (category) {
            categories.add(category);
        }
    });

    return Array.from(categories);
}

