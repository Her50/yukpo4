/**
 * Utilitaire pour normaliser les produits retournés par le backend
 * 
 * STRUCTURE BACKEND:
 * - Le champ "produits" a la structure {valeur: [...], type_donnee: "listeproduit", origine_champs: "ia"}
 * - MAIS les produits individuels dans le tableau sont des objets JSON simples
 * - Exemple: {nom: "Produit", prix: 1000, devise: "XAF"} ← Pas de structure imbriquée
 * 
 * Cette fonction extrait seulement le tableau de produits depuis la structure wrapper
 */

/**
 * Extrait la valeur d'un champ qui peut être soit :
 * - Une valeur directe (string, number, etc.)
 * - Un objet wrapper: {valeur: X, type_donnee: "...", origine_champs: "..."}
 * 
 * @param field - Le champ à extraire
 * @returns La valeur pure du champ
 */
export const getFieldValue = (field: any): any => {
    if (field === null || field === undefined) {
        return null;
    }

    // Si c'est un objet avec la structure wrapper
    if (typeof field === 'object' && 'valeur' in field && 'type_donnee' in field) {
        return field.valeur;
    }

    // Sinon retourner tel quel (valeur directe)
    return field;
};

/**
 * Normalise un produit en extrayant toutes les valeurs des wrappers
 * @param product - Le produit brut du backend
 * @returns Le produit avec toutes les valeurs extraites
 */
export const normalizeProduct = (product: any): any => {
    if (!product || typeof product !== 'object') {
        return product;
    }

    const normalized: any = {};
    
    for (const [key, value] of Object.entries(product)) {
        normalized[key] = getFieldValue(value);
    }

    return normalized;
};

/**
 * Normalise les produits depuis service.data.produits
 * Gère le cas où produits peut être :
 * - Un array direct: [...produits]
 * - Un objet avec structure: {valeur: [...produits], type_donnee: "listeproduit", origine_champs: "ia"}
 * 
 * @param produitsField - Le champ produits du service
 * @returns Array de produits (objets JSON simples avec valeurs extraites)
 */
export const normalizeServiceProducts = (produitsField: any): any[] => {
    if (!produitsField) {
        return [];
    }

    let productsArray: any[] = [];

    // Si c'est déjà un array (cas rare, legacy)
    if (Array.isArray(produitsField)) {
        productsArray = produitsField;
    }
    // Si c'est un objet avec valeur (cas normal du backend)
    else if (produitsField.valeur && Array.isArray(produitsField.valeur)) {
        productsArray = produitsField.valeur;
    }
    else {
        // Fallback pour structure invalide
        console.warn('[productNormalizer] Structure produits non reconnue:', typeof produitsField);
        return [];
    }

    // Normaliser chaque produit pour extraire les valeurs des wrappers
    return productsArray.map(product => normalizeProduct(product));
};

