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
 * Normalise les produits depuis service.data.produits
 * Gère le cas où produits peut être :
 * - Un array direct: [...produits]
 * - Un objet avec structure: {valeur: [...produits], type_donnee: "listeproduit", origine_champs: "ia"}
 * 
 * @param produitsField - Le champ produits du service
 * @returns Array de produits (objets JSON simples)
 */
export const normalizeServiceProducts = (produitsField: any): any[] => {
    if (!produitsField) {
        return [];
    }

    // Si c'est déjà un array (cas rare, legacy)
    if (Array.isArray(produitsField)) {
        return produitsField;
    }

    // Si c'est un objet avec valeur (cas normal du backend)
    if (produitsField.valeur && Array.isArray(produitsField.valeur)) {
        return produitsField.valeur;
    }

    // Fallback pour structure invalide
    console.warn('[productNormalizer] Structure produits non reconnue:', typeof produitsField);
    return [];
};

