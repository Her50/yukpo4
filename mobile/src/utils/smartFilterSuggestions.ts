/**
 * Utilitaire pour générer des suggestions de filtres intelligents
 * Analyse les patterns dans les données pour proposer des filtres pertinents
 */

import { CategoryFilter } from '../config/categoryConfig';

// Types
export interface ProductPattern {
    priceRange?: {
        min: number;
        max: number;
        average: number;
        median: number;
    };
    popularBrands?: Array<{ brand: string; count: number }>;
    commonFeatures?: Array<{ feature: string; count: number }>;
    locationClusters?: Array<{ location: string; count: number }>;
    priceDistribution?: {
        budget: number;      // < 30% de la moyenne
        moyen: number;       // 30-70%
        premium: number;     // > 70%
    };
}

export interface SmartFilterSuggestion extends CategoryFilter {
    priority: number;        // 0-10, 10 = très pertinent
    reason: string;          // Explication de la suggestion
    applicableCount: number; // Nombre de produits concernés
}

/**
 * Analyse les patterns dans une liste de produits
 */
export const analyzeProductPatterns = (products: any[]): ProductPattern => {
    if (products.length === 0) return {};

    const pattern: ProductPattern = {};

    // 1. Analyse des prix
    const prices = products
        .map(p => parseFloat(p.prix || p.price))
        .filter(price => !isNaN(price) && price > 0)
        .sort((a, b) => a - b);

    if (prices.length > 0) {
        const sum = prices.reduce((acc, price) => acc + price, 0);
        const average = sum / prices.length;
        const median = prices[Math.floor(prices.length / 2)];

        pattern.priceRange = {
            min: prices[0],
            max: prices[prices.length - 1],
            average,
            median,
        };

        // Distribution des prix
        const budgetCount = prices.filter(p => p < average * 0.3).length;
        const moyenCount = prices.filter(p => p >= average * 0.3 && p <= average * 1.5).length;
        const premiumCount = prices.filter(p => p > average * 1.5).length;

        pattern.priceDistribution = {
            budget: budgetCount,
            moyen: moyenCount,
            premium: premiumCount,
        };
    }

    // 2. Analyse des marques populaires
    const brandCount: Record<string, number> = {};
    products.forEach(product => {
        const brand = product.marque || product.brand || product.marqueTelephone || product.marqueOrdinateur;
        if (brand) {
            brandCount[brand] = (brandCount[brand] || 0) + 1;
        }
    });

    if (Object.keys(brandCount).length > 0) {
        pattern.popularBrands = Object.entries(brandCount)
            .map(([brand, count]) => ({ brand, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10 marques
    }

    // 3. Analyse des caractéristiques communes
    const featureCount: Record<string, number> = {};
    const featureFields = [
        'typeTransaction', 'typeBatiment', 'typeVehicule', 'typeTransport',
        'carburant', 'etat', 'equipements', 'style', 'materiau'
    ];

    products.forEach(product => {
        featureFields.forEach(field => {
            const value = product[field];
            if (value) {
                if (Array.isArray(value)) {
                    value.forEach(v => {
                        featureCount[`${field}:${v}`] = (featureCount[`${field}:${v}`] || 0) + 1;
                    });
                } else {
                    featureCount[`${field}:${value}`] = (featureCount[`${field}:${value}`] || 0) + 1;
                }
            }
        });
    });

    if (Object.keys(featureCount).length > 0) {
        pattern.commonFeatures = Object.entries(featureCount)
            .map(([feature, count]) => ({ feature, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15); // Top 15 features
    }

    // 4. Analyse des localisations
    const locationCount: Record<string, number> = {};
    products.forEach(product => {
        const location = product.quartier || product.ville || product.localisation;
        if (location) {
            locationCount[location] = (locationCount[location] || 0) + 1;
        }
    });

    if (Object.keys(locationCount).length > 0) {
        pattern.locationClusters = Object.entries(locationCount)
            .map(([location, count]) => ({ location, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5 localisations
    }

    return pattern;
};

/**
 * Génère des suggestions de filtres intelligents basées sur les patterns
 */
export const generateSmartFilterSuggestions = (
    products: any[],
    dominantCategory: string,
    userContext?: {
        location?: { latitude: number; longitude: number };
        budget?: number;
        searchQuery?: string;
    }
): SmartFilterSuggestion[] => {
    const suggestions: SmartFilterSuggestion[] = [];
    const patterns = analyzeProductPatterns(products);

    // 1. Suggestions de prix intelligentes
    if (patterns.priceRange && patterns.priceDistribution) {
        const { min, max, average, median } = patterns.priceRange;
        const { budget, moyen, premium } = patterns.priceDistribution;

        // Filtre gamme de prix suggérée (autour de la médiane)
        suggestions.push({
            id: 'prix_median',
            label: `Prix autour de ${Math.round(median).toLocaleString()} FCFA`,
            type: 'range',
            min: Math.round(median * 0.7),
            max: Math.round(median * 1.3),
            unit: 'FCFA',
            priority: 9,
            reason: 'Gamme de prix la plus courante',
            applicableCount: moyen,
        });

        // Filtre budget
        if (budget > products.length * 0.2) {
            suggestions.push({
                id: 'prix_budget',
                label: 'Options économiques',
                type: 'range',
                min: Math.round(min),
                max: Math.round(average * 0.3),
                unit: 'FCFA',
                priority: 8,
                reason: `${budget} options économiques disponibles`,
                applicableCount: budget,
            });
        }

        // Filtre premium
        if (premium > products.length * 0.15) {
            suggestions.push({
                id: 'prix_premium',
                label: 'Gamme premium',
                type: 'range',
                min: Math.round(average * 1.5),
                max: Math.round(max),
                unit: 'FCFA',
                priority: 7,
                reason: `${premium} options haut de gamme disponibles`,
                applicableCount: premium,
            });
        }
    }

    // 2. Suggestions de marques populaires
    if (patterns.popularBrands && patterns.popularBrands.length > 3) {
        const topBrands = patterns.popularBrands.slice(0, 8);
        const totalBrandProducts = topBrands.reduce((sum, b) => sum + b.count, 0);

        suggestions.push({
            id: 'marques_populaires',
            label: 'Marques populaires',
            type: 'multiselect',
            options: topBrands.map(b => ({
                value: b.brand.toLowerCase(),
                label: `${b.brand} (${b.count})`,
            })),
            priority: 8,
            reason: 'Marques les plus représentées',
            applicableCount: totalBrandProducts,
        });
    }

    // 3. Suggestions de caractéristiques communes
    if (patterns.commonFeatures && patterns.commonFeatures.length > 0) {
        // Grouper par type de feature
        const featureGroups: Record<string, Array<{ value: string; count: number }>> = {};
        patterns.commonFeatures.forEach(({ feature, count }) => {
            const [type, value] = feature.split(':');
            if (!featureGroups[type]) {
                featureGroups[type] = [];
            }
            featureGroups[type].push({ value, count });
        });

        // Créer des suggestions pour chaque groupe significatif
        Object.entries(featureGroups).forEach(([type, values]) => {
            if (values.length >= 3) {
                const totalCount = values.reduce((sum, v) => sum + v.count, 0);
                suggestions.push({
                    id: `${type}_commun`,
                    label: getLabelForFeatureType(type),
                    type: 'select',
                    options: values.map(v => ({
                        value: v.value,
                        label: `${capitalizeFirst(v.value)} (${v.count})`,
                    })),
                    priority: 7,
                    reason: 'Options les plus courantes',
                    applicableCount: totalCount,
                });
            }
        });
    }

    // 4. Suggestions contextuelles (si userContext fourni)
    if (userContext?.location) {
        suggestions.push({
            id: 'proximite',
            label: 'Distance maximale',
            type: 'range',
            min: 1,
            max: 50,
            unit: 'km',
            priority: 10,
            reason: 'Filtrer par proximité de votre position',
            applicableCount: products.length,
        });
    }

    if (userContext?.budget) {
        suggestions.push({
            id: 'dans_budget',
            label: `Dans votre budget (${userContext.budget.toLocaleString()} FCFA)`,
            type: 'range',
            min: 0,
            max: userContext.budget,
            unit: 'FCFA',
            priority: 10,
            reason: 'Affiner selon votre budget',
            applicableCount: products.filter(p => {
                const price = parseFloat(p.prix || p.price);
                return !isNaN(price) && price <= userContext.budget;
            }).length,
        });
    }

    // 5. Suggestions de localisation
    if (patterns.locationClusters && patterns.locationClusters.length > 0) {
        suggestions.push({
            id: 'quartier_populaire',
            label: 'Quartiers populaires',
            type: 'select',
            options: patterns.locationClusters.map(l => ({
                value: l.location,
                label: `${l.location} (${l.count})`,
            })),
            priority: 6,
            reason: 'Zones avec le plus d\'offres',
            applicableCount: patterns.locationClusters.reduce((sum, l) => sum + l.count, 0),
        });
    }

    // Trier par priorité
    return suggestions.sort((a, b) => b.priority - a.priority);
};

/**
 * Calcule un poids pour la catégorie d'un produit (pour détection intelligente)
 */
export const calculateProductCategoryWeight = (product: any): number => {
    let weight = 1;

    // 1. Bonus pour complétude des informations
    const fieldCount = Object.keys(product).filter(key => {
        const value = product[key];
        return value !== null && value !== undefined && value !== '';
    }).length;
    weight += fieldCount * 0.05; // +0.05 par champ rempli

    // 2. Bonus pour produits récents
    if (product.date_creation || product.created_at) {
        const creationDate = new Date(product.date_creation || product.created_at);
        const daysSinceCreation = (Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation < 30) {
            weight += (30 - daysSinceCreation) * 0.03; // Jusqu'à +0.9 pour très récent
        }
    }

    // 3. Bonus pour score de pertinence élevé
    if (product.score && typeof product.score === 'number') {
        weight += product.score * 0.5;
    }

    // 4. Bonus pour produits avec images
    const images = product.images || product.imagesRealisations || [];
    if (Array.isArray(images) && images.length > 0) {
        weight += Math.min(images.length * 0.2, 1); // Jusqu'à +1 pour 5+ images
    }

    // 5. Bonus pour produits avec prix
    if (product.prix || product.price) {
        weight += 0.3;
    }

    // 6. Bonus pour produits en promotion
    if (product.en_promotion || product.promotion_active) {
        weight += 0.5;
    }

    // 7. Bonus pour interaction utilisateur
    if (product.nb_vues || product.views) {
        const views = product.nb_vues || product.views;
        weight += Math.log10(views + 1) * 0.2; // Échelle logarithmique
    }

    return weight;
};

/**
 * Détecte la catégorie dominante avec pondération intelligente
 */
export const detectDominantCategoryWeighted = (products: any[]): string => {
    if (products.length === 0) return 'default';

    // Calculer les poids par catégorie
    const categoryWeights: Record<string, number> = {};
    products.forEach((product) => {
        const category = product.type || 'default';
        const weight = calculateProductCategoryWeight(product);
        categoryWeights[category] = (categoryWeights[category] || 0) + weight;
    });

    // Trouver la catégorie avec le poids le plus élevé
    let maxWeight = 0;
    let dominantCategory = 'default';
    Object.entries(categoryWeights).forEach(([category, weight]) => {
        if (weight > maxWeight) {
            maxWeight = weight;
            dominantCategory = category;
        }
    });

    return dominantCategory;
};

/**
 * Utilitaires
 */
const getLabelForFeatureType = (type: string): string => {
    const labels: Record<string, string> = {
        typeTransaction: 'Type de transaction',
        typeBatiment: 'Type de bien',
        typeVehicule: 'Type de véhicule',
        typeTransport: 'Type de transport',
        carburant: 'Carburant',
        etat: 'État',
        equipements: 'Équipements',
        style: 'Style',
        materiau: 'Matériau',
    };
    return labels[type] || capitalizeFirst(type);
};

const capitalizeFirst = (str: string): string => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Sauvegarde et récupération de l'historique des filtres
 */
export interface FilterHistory {
    category: string;
    filters: Record<string, any>;
    timestamp: number;
    resultCount: number;
}

const FILTER_HISTORY_KEY = '@yukpo_filter_history';
const MAX_HISTORY_SIZE = 20;

/**
 * Sauvegarde un filtre dans l'historique
 */
export const saveFilterToHistory = async (
    category: string,
    filters: Record<string, any>,
    resultCount: number
): Promise<void> => {
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        
        // Récupérer l'historique existant
        const historyJson = await AsyncStorage.getItem(FILTER_HISTORY_KEY);
        let history: FilterHistory[] = historyJson ? JSON.parse(historyJson) : [];

        // Ajouter le nouveau filtre
        history.unshift({
            category,
            filters,
            timestamp: Date.now(),
            resultCount,
        });

        // Limiter la taille de l'historique
        history = history.slice(0, MAX_HISTORY_SIZE);

        // Sauvegarder
        await AsyncStorage.setItem(FILTER_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
        console.error('[smartFilterSuggestions] Erreur sauvegarde historique:', error);
    }
};

/**
 * Récupère l'historique des filtres
 */
export const getFilterHistory = async (category?: string): Promise<FilterHistory[]> => {
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const historyJson = await AsyncStorage.getItem(FILTER_HISTORY_KEY);
        let history: FilterHistory[] = historyJson ? JSON.parse(historyJson) : [];

        // Filtrer par catégorie si spécifiée
        if (category) {
            history = history.filter(h => h.category === category);
        }

        return history;
    } catch (error) {
        console.error('[smartFilterSuggestions] Erreur récupération historique:', error);
        return [];
    }
};

/**
 * Suggère des filtres basés sur l'historique utilisateur
 */
export const suggestFiltersFromHistory = async (
    category: string,
    currentProducts: any[]
): Promise<SmartFilterSuggestion[]> => {
    const history = await getFilterHistory(category);
    const suggestions: SmartFilterSuggestion[] = [];

    if (history.length === 0) return suggestions;

    // Analyser les filtres les plus utilisés
    const filterUsage: Record<string, { count: number; values: Set<any> }> = {};
    history.forEach(h => {
        Object.entries(h.filters).forEach(([key, value]) => {
            if (!filterUsage[key]) {
                filterUsage[key] = { count: 0, values: new Set() };
            }
            filterUsage[key].count++;
            filterUsage[key].values.add(JSON.stringify(value));
        });
    });

    // Créer des suggestions pour les filtres fréquents
    Object.entries(filterUsage).forEach(([key, usage]) => {
        if (usage.count >= 2) { // Utilisé au moins 2 fois
            suggestions.push({
                id: `history_${key}`,
                label: `Filtre fréquent: ${getLabelForFeatureType(key)}`,
                type: 'select',
                priority: 6,
                reason: `Utilisé ${usage.count} fois récemment`,
                applicableCount: currentProducts.length,
            });
        }
    });

    return suggestions;
};

