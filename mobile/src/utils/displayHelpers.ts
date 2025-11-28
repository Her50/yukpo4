/**
 * Utilitaires pour l'affichage sécurisé de données
 * Garantit qu'aucun JSON brut ne s'affiche dans l'interface
 */

import { getFieldValue } from './productNormalizer';

/**
 * Garantit qu'une valeur affichée est toujours une string valide
 * Gère les objets wrapper, null, undefined, etc.
 * 
 * @param value - La valeur à afficher
 * @param fallback - Valeur par défaut si la valeur est invalide
 * @returns Une string valide pour l'affichage
 */
export const safeStringDisplay = (value: any, fallback: string = ''): string => {
    if (value === null || value === undefined) {
        return fallback;
    }

    // Si c'est déjà une string, la retourner
    if (typeof value === 'string') {
        return value.trim() || fallback;
    }

    // Si c'est un nombre, le convertir
    if (typeof value === 'number') {
        return String(value);
    }

    // Si c'est un booléen, le convertir
    if (typeof value === 'boolean') {
        return String(value);
    }

    // Si c'est un objet wrapper, extraire la valeur
    const extracted = getFieldValue(value);
    if (extracted !== null && extracted !== undefined) {
        if (typeof extracted === 'string') {
            return extracted.trim() || fallback;
        }
        if (typeof extracted === 'number') {
            return String(extracted);
        }
        if (typeof extracted === 'boolean') {
            return String(extracted);
        }
        // Si c'est encore un objet, ne PAS l'afficher - utiliser le fallback
        // On ne veut JAMAIS afficher de JSON brut dans l'UI
        if (typeof extracted === 'object') {
            console.warn('[displayHelpers] Tentative d\'affichage d\'un objet extrait, utilisation du fallback:', extracted);
            return fallback;
        }
    }

    // Si c'est un objet brut, ne PAS l'afficher
    if (typeof value === 'object') {
        console.warn('[displayHelpers] Tentative d\'affichage d\'un objet, utilisation du fallback:', value);
        return fallback;
    }

    // Cas par défaut
    return fallback;
};

/**
 * Extrait et normalise le nom d'un service
 * 
 * @param service - L'objet service
 * @param fallback - Nom par défaut si non trouvé
 * @returns Le nom du service en string
 */
export const extractServiceName = (service: any, fallback: string = 'Service'): string => {
    if (!service) return fallback;

    const candidates = [
        getFieldValue(service.titre),
        getFieldValue(service.name),
        getFieldValue(service.data?.titre_service),
        getFieldValue(service.data?.titre),
        service.titre,
        service.name,
        service.data?.titre_service?.valeur,
        service.data?.titre_service,
    ];

    for (const candidate of candidates) {
        const normalized = safeStringDisplay(candidate, '');
        if (normalized && normalized !== '') {
            return normalized;
        }
    }

    return fallback;
};

/**
 * Extrait et normalise le nom d'un produit
 * 
 * @param product - L'objet produit
 * @param fallback - Nom par défaut si non trouvé
 * @returns Le nom du produit en string
 */
export const extractProductName = (product: any, fallback: string = 'Produit'): string => {
    if (!product) return fallback;

    const candidates = [
        getFieldValue(product.nom),
        getFieldValue(product.name),
        getFieldValue(product.title),
        getFieldValue(product.nom_produit),
        product.nom,
        product.name,
        product.title,
        product.nom_produit,
        product.valeur, // En cas de wrapper direct
    ];

    for (const candidate of candidates) {
        const normalized = safeStringDisplay(candidate, '');
        if (normalized && normalized !== '') {
            return normalized;
        }
    }

    return fallback;
};

/**
 * Extrait et normalise une description
 * 
 * @param value - La valeur à extraire (peut être un wrapper)
 * @param fallback - Description par défaut si non trouvée
 * @returns La description en string
 */
export const extractDescription = (value: any, fallback: string = ''): string => {
    if (!value) return fallback;

    // Essayer d'extraire depuis un wrapper
    const extracted = getFieldValue(value);

    // Utiliser la valeur extraite ou la valeur originale
    const candidate = extracted !== null && extracted !== undefined ? extracted : value;

    return safeStringDisplay(candidate, fallback);
};

