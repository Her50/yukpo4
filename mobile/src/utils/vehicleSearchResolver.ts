/**
 * 🔍 RÉSOLVEUR INTELLIGENT DE RECHERCHE DE VÉHICULES
 * 
 * Ce module permet de transformer une recherche avec un nom local
 * en filtres concrets pour trouver le bon véhicule.
 * 
 * Exemple :
 * - Recherche: "tête de cochon"
 * - Résolution: { marque: "Renault", modele: "R4", type: "Voiture" }
 * - Résultat: Affiche tous les Renault 4
 */

import {
    ALL_VEHICLE_LOCAL_NAMES,
    findVehicleByLocalName,
    VehicleLocalName
} from '../data/vehicleLocalNames';

export interface ResolvedVehicleSearch {
    isLocalName: boolean; // true si un nom local a été détecté
    originalSearch: string; // Terme de recherche original
    resolvedVehicle?: VehicleLocalName; // Véhicule résolu (si trouvé)
    suggestedFilters: {
        marqueAutomobile?: string;
        modeleAutomobile?: string;
        typeVehicule?: string;
    };
    matchedKeywords: string[]; // Mots-clés qui ont matché
    confidence: number; // Score de confiance (0-100)
}

/**
 * Résout une recherche de véhicule en détectant les noms locaux
 * et en proposant les filtres appropriés
 * 
 * @param searchTerm Le terme de recherche (ex: "tête de cochon", "bendskin", "toyota corolla")
 * @param userCountry Le pays de l'utilisateur (optionnel, améliore la précision)
 * @returns Les informations résolues avec les filtres suggérés
 */
export function resolveVehicleSearch(
    searchTerm: string,
    userCountry?: string
): ResolvedVehicleSearch {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    // Rechercher dans la base de noms locaux
    const localNameResults = findVehicleByLocalName(searchTerm, userCountry);

    // Si un nom local a été trouvé avec un bon score
    if (localNameResults.length > 0 && localNameResults[0].score >= 60) {
        const bestMatch = localNameResults[0];

        return {
            isLocalName: true,
            originalSearch: searchTerm,
            resolvedVehicle: bestMatch,
            suggestedFilters: {
                marqueAutomobile: bestMatch.marque,
                modeleAutomobile: bestMatch.modele,
                typeVehicule: bestMatch.type
            },
            matchedKeywords: [bestMatch.nomLocal, ...(bestMatch.synonymes || [])],
            confidence: Math.min(bestMatch.score, 100)
        };
    }

    // Sinon, c'est une recherche standard (marque/modèle direct)
    return {
        isLocalName: false,
        originalSearch: searchTerm,
        suggestedFilters: {},
        matchedKeywords: [],
        confidence: 0
    };
}

/**
 * Enrichit un produit avec des tags de nom local
 * pour améliorer la recherche
 * 
 * @param product Le produit véhicule
 * @returns Les noms locaux associés à ce véhicule
 */
export function getLocalNamesForVehicle(product: {
    marqueAutomobile?: string;
    modeleAutomobile?: string;
    typeVehicule?: string;
}): string[] {
    const localNames: string[] = [];

    // Chercher tous les noms locaux correspondant à ce véhicule
    for (const vehicle of ALL_VEHICLE_LOCAL_NAMES) {
        let matches = true;

        // Vérifier la marque
        if (vehicle.marque && product.marqueAutomobile) {
            if (vehicle.marque.toLowerCase() !== product.marqueAutomobile.toLowerCase()) {
                matches = false;
            }
        }

        // Vérifier le modèle (plus flexible)
        if (vehicle.modele && product.modeleAutomobile) {
            const normalizedProductModel = product.modeleAutomobile.toLowerCase();
            const normalizedVehicleModel = vehicle.modele.toLowerCase();

            // Match si le modèle du produit contient le modèle du véhicule ou vice-versa
            if (!normalizedProductModel.includes(normalizedVehicleModel) &&
                !normalizedVehicleModel.includes(normalizedProductModel)) {
                matches = false;
            }
        }

        // Vérifier le type
        if (vehicle.type && product.typeVehicule) {
            if (vehicle.type.toLowerCase() !== product.typeVehicule.toLowerCase()) {
                matches = false;
            }
        }

        // Si tout correspond, ajouter le nom local
        if (matches) {
            localNames.push(vehicle.nomLocal);
            if (vehicle.synonymes) {
                localNames.push(...vehicle.synonymes);
            }
        }
    }

    return [...new Set(localNames)]; // Enlever les doublons
}

/**
 * Filtre des produits en fonction d'un terme de recherche
 * en tenant compte des noms locaux
 * 
 * @param products Liste de produits véhicules
 * @param searchTerm Terme de recherche
 * @param userCountry Pays de l'utilisateur (optionnel)
 * @returns Produits filtrés et triés par pertinence
 */
export function filterVehiclesBySearch<T extends {
    nom?: string;
    description?: string;
    marqueAutomobile?: string;
    modeleAutomobile?: string;
    typeVehicule?: string;
}>(
    products: T[],
    searchTerm: string,
    userCountry?: string
): Array<T & { searchScore: number }> {
    if (!searchTerm || searchTerm.trim() === '') {
        return products.map(p => ({ ...p, searchScore: 0 }));
    }

    const normalizedSearch = searchTerm.toLowerCase().trim();
    const resolved = resolveVehicleSearch(searchTerm, userCountry);

    const results: Array<T & { searchScore: number }> = [];

    for (const product of products) {
        let score = 0;

        // Si un nom local a été résolu
        if (resolved.isLocalName && resolved.suggestedFilters) {
            // Match exact sur marque
            if (resolved.suggestedFilters.marqueAutomobile &&
                product.marqueAutomobile?.toLowerCase() === resolved.suggestedFilters.marqueAutomobile.toLowerCase()) {
                score += 50;
            }

            // Match exact sur modèle
            if (resolved.suggestedFilters.modeleAutomobile &&
                product.modeleAutomobile?.toLowerCase().includes(resolved.suggestedFilters.modeleAutomobile.toLowerCase())) {
                score += 40;
            }

            // Match exact sur type
            if (resolved.suggestedFilters.typeVehicule &&
                product.typeVehicule?.toLowerCase() === resolved.suggestedFilters.typeVehicule.toLowerCase()) {
                score += 30;
            }
        }

        // Recherche standard dans les champs texte
        if (product.nom && product.nom.toLowerCase().includes(normalizedSearch)) {
            score += 20;
        }

        if (product.description && product.description.toLowerCase().includes(normalizedSearch)) {
            score += 15;
        }

        if (product.marqueAutomobile && product.marqueAutomobile.toLowerCase().includes(normalizedSearch)) {
            score += 25;
        }

        if (product.modeleAutomobile && product.modeleAutomobile.toLowerCase().includes(normalizedSearch)) {
            score += 25;
        }

        // Vérifier les noms locaux associés à ce produit
        const localNames = getLocalNamesForVehicle(product);
        for (const localName of localNames) {
            if (localName.toLowerCase().includes(normalizedSearch)) {
                score += 35;
                break;
            }
        }

        // Ajouter le produit s'il a un score
        if (score > 0) {
            results.push({ ...product, searchScore: score });
        }
    }

    // Trier par score décroissant
    return results.sort((a, b) => b.searchScore - a.searchScore);
}

/**
 * Génère un message d'aide contextuel basé sur la recherche
 * 
 * @param searchTerm Terme de recherche
 * @param userCountry Pays de l'utilisateur
 * @returns Message d'aide (ou null si pas de suggestion)
 */
export function getSearchHelpMessage(
    searchTerm: string,
    userCountry?: string
): string | null {
    const resolved = resolveVehicleSearch(searchTerm, userCountry);

    if (resolved.isLocalName && resolved.resolvedVehicle) {
        const vehicle = resolved.resolvedVehicle;

        let message = `🔍 "${searchTerm}" correspond à **${vehicle.nomOfficiel}**`;

        if (vehicle.marque && vehicle.modele) {
            message += ` (${vehicle.marque} ${vehicle.modele})`;
        }

        if (vehicle.description) {
            message += `\n\n💡 ${vehicle.description}`;
        }

        return message;
    }

    return null;
}

/**
 * Obtient des suggestions de véhicules basées sur un pays
 * 
 * @param country Le pays
 * @returns Liste de noms locaux populaires dans ce pays
 */
export function getPopularVehicleNamesForCountry(country: string): VehicleLocalName[] {
    return ALL_VEHICLE_LOCAL_NAMES
        .filter(v => v.pays.includes(country))
        .slice(0, 10); // Top 10
}

