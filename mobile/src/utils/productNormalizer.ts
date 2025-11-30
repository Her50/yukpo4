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
/**
 * Fonction récursive pour déballer les wrappers multiples
 */
const unwrapProducts = (value: any, depth = 0, path = ''): any[] => {
    if (depth > 4) {
        console.warn('[productNormalizer] ⚠️ Profondeur maximale atteinte lors du déballage:', path);
        return [];
    }

    if (!value) {
        return [];
    }

    // Cas 1: Array direct
    if (Array.isArray(value)) {
        return value;
    }

    // Cas 2: Objet - chercher dans les clés communes
    if (typeof value === 'object' && value !== null) {
        const keys = ['valeur', 'data', 'items', 'produits', 'listeproduit', 'produits_list', 'products'];

        for (const key of keys) {
            if (value[key] !== undefined && value[key] !== null) {
                if (Array.isArray(value[key])) {
                    console.log(`[productNormalizer] ✅ Format {${key}: [...]} détecté (chemin: ${path}.${key}):`, value[key].length, 'produits');
                    return value[key];
                }
                // Récursion si c'est un objet imbriqué
                if (typeof value[key] === 'object') {
                    const unwrapped = unwrapProducts(value[key], depth + 1, `${path}.${key}`);
                    if (unwrapped.length > 0) {
                        return unwrapped;
                    }
                }
            }
        }
    }

    return [];
};

export const normalizeServiceProducts = (produitsField: any): any[] => {
    if (!produitsField) {
        console.log('[productNormalizer] produitsField est null/undefined');
        return [];
    }

    // Utiliser la fonction récursive pour déballer
    let productsArray = unwrapProducts(produitsField);

    // Si aucun array trouvé, essayer les formats simples
    if (productsArray.length === 0) {
        // Cas spécial: Objet avec type_donnee mais valeur non-array (produit unique)
        if (produitsField.type_donnee && produitsField.valeur && !Array.isArray(produitsField.valeur)) {
            console.log('[productNormalizer] ✅ Format {valeur: object} détecté (produit unique), conversion en array');
            productsArray = [produitsField.valeur];
        } else {
            // Fallback pour structure invalide
            console.warn('[productNormalizer] ⚠️ Structure produits non reconnue:', {
                type: typeof produitsField,
                isArray: Array.isArray(produitsField),
                keys: typeof produitsField === 'object' && produitsField !== null ? Object.keys(produitsField) : [],
                sample: JSON.stringify(produitsField).substring(0, 300)
            });
            return [];
        }
    }

    // Normaliser chaque produit pour extraire les valeurs des wrappers
    const normalized = productsArray.map(product => normalizeProduct(product));
    console.log('[productNormalizer] ✅ Produits normalisés:', normalized.length);
    return normalized;
};

