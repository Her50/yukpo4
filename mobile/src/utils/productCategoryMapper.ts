/**
 * Utilitaire pour mapper les catégories de service vers les types de produits
 * Permet une détection automatique intelligente du type de produit approprié
 */

type ProductType =
    | 'immobilier_batiment'
    | 'immobilier_terrain'
    | 'hotellerie'
    | 'automobile'
    | 'ticket_voyage'
    | 'covoiturage'
    | 'vetement'
    | 'chaussure'
    | 'electromenager'
    | 'image_son'
    | 'telephone'
    | 'ordinateur'
    | 'mobilier'
    | 'decoration'
    | 'ustensiles_cuisine'
    | 'pieces_auto'
    | 'pieces_industrielles'
    | 'jouets_enfants'
    | 'aliments'
    | 'livres_scolaire'
    | 'quincaillerie'
    | 'prestation_service'
    | 'pharmacie'
    | 'hopital_clinique'
    | 'demenagement'
    | 'cosmetique_parfum'
    | 'bijoux'
    | 'coiffure_beaute'
    | 'autre';

/**
 * Mapping des catégories de service vers les types de produits
 * Permet de suggérer automatiquement le bon formulaire de produit
 */
const CATEGORY_TO_PRODUCT_TYPE: Record<string, ProductType> = {
    // Immobilier
    'immobilier': 'immobilier_batiment',
    'vente immobilier': 'immobilier_batiment',
    'location immobilier': 'immobilier_batiment',
    'terrain': 'immobilier_terrain',
    'terrains': 'immobilier_terrain',

    // Hébergement
    'hotel': 'hotellerie',
    'hôtel': 'hotellerie',
    'hotellerie': 'hotellerie',
    'hebergement': 'hotellerie',
    'hébergement': 'hotellerie',

    // Transport
    'automobile': 'automobile',
    'vehicule': 'automobile',
    'véhicule': 'automobile',
    'voiture': 'automobile',
    'transport': 'ticket_voyage',
    'voyage': 'ticket_voyage',
    'covoiturage': 'covoiturage',

    // Mode
    'vetement': 'vetement',
    'vêtement': 'vetement',
    'mode': 'vetement',
    'habillement': 'vetement',
    'chaussure': 'chaussure',
    'chaussures': 'chaussure',

    // Électronique
    'electromenager': 'electromenager',
    'électroménager': 'electromenager',
    'image son': 'image_son',
    'audio video': 'image_son',
    'multimedia': 'image_son',
    'telephone': 'telephone',
    'téléphone': 'telephone',
    'mobile': 'telephone',
    'smartphone': 'telephone',
    'ordinateur': 'ordinateur',
    'informatique': 'ordinateur',
    'pc': 'ordinateur',

    // Maison
    'mobilier': 'mobilier',
    'meuble': 'mobilier',
    'meubles': 'mobilier',
    'decoration': 'decoration',
    'décoration': 'decoration',
    'deco': 'decoration',
    'ustensiles cuisine': 'ustensiles_cuisine',
    'cuisine': 'ustensiles_cuisine',

    // Pièces et Réparations
    'pieces auto': 'pieces_auto',
    'pièces auto': 'pieces_auto',
    'pieces detachees': 'pieces_auto',
    'pieces industrielles': 'pieces_industrielles',
    'pièces industrielles': 'pieces_industrielles',

    // Enfants et Loisirs
    'jouets': 'jouets_enfants',
    'jouet': 'jouets_enfants',
    'enfants': 'jouets_enfants',
    'jeux': 'jouets_enfants',

    // Alimentation
    'aliments': 'aliments',
    'alimentation': 'aliments',
    'alimentaire': 'aliments',
    'fruits': 'aliments',
    'legumes': 'aliments',
    'légumes': 'aliments',
    'viande': 'aliments',
    'poisson': 'aliments',

    // Éducation
    'livres': 'livres_scolaire',
    'livre': 'livres_scolaire',
    'scolaire': 'livres_scolaire',
    'fourniture': 'livres_scolaire',
    'fournitures': 'livres_scolaire',

    // Bricolage
    'quincaillerie': 'quincaillerie',
    'bricolage': 'quincaillerie',
    'outillage': 'quincaillerie',
    'materiaux': 'quincaillerie',
    'matériaux': 'quincaillerie',

    // Services
    'prestation': 'prestation_service',
    'service': 'prestation_service',
    'services': 'prestation_service',

    // Santé
    'pharmacie': 'pharmacie',
    'hopital': 'hopital_clinique',
    'hôpital': 'hopital_clinique',
    'clinique': 'hopital_clinique',
    'sante': 'hopital_clinique',
    'santé': 'hopital_clinique',
    'medical': 'hopital_clinique',
    'médical': 'hopital_clinique',

    // Déménagement
    'demenagement': 'demenagement',
    'déménagement': 'demenagement',
    'demenageur': 'demenagement',

    // Beauté
    'cosmetique': 'cosmetique_parfum',
    'cosmétique': 'cosmetique_parfum',
    'parfum': 'cosmetique_parfum',
    'beaute': 'cosmetique_parfum',
    'beauté': 'cosmetique_parfum',
    'bijoux': 'bijoux',
    'bijou': 'bijoux',
    'joaillerie': 'bijoux',
    'coiffure': 'coiffure_beaute',
    'meche': 'coiffure_beaute',
    'mèche': 'coiffure_beaute',
    'meches': 'coiffure_beaute',
    'mèches': 'coiffure_beaute',
    'perruque': 'coiffure_beaute',
    'extensions': 'coiffure_beaute',
};

/**
 * Détecte intelligemment le type de produit depuis la catégorie du service
 * @param serviceCategory - Catégorie du service (ex: "Vente automobile", "Immobilier", etc.)
 * @returns Type de produit approprié ou 'autre' si aucune correspondance
 */
export function detectProductTypeFromCategory(serviceCategory: string | undefined | null): ProductType {
    if (!serviceCategory) return 'autre';

    // Normaliser la catégorie (minuscules, sans accents)
    const normalized = serviceCategory
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    // Recherche exacte d'abord
    if (CATEGORY_TO_PRODUCT_TYPE[normalized]) {
        return CATEGORY_TO_PRODUCT_TYPE[normalized];
    }

    // Recherche partielle ensuite (si la catégorie contient un mot-clé)
    for (const [key, type] of Object.entries(CATEGORY_TO_PRODUCT_TYPE)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return type;
        }
    }

    // Fallback
    console.log(`[productCategoryMapper] Aucune correspondance pour "${serviceCategory}", utilisation de 'autre'`);
    return 'autre';
}

/**
 * Vérifie si une catégorie de service nécessite un gestionnaire de produits
 * @param serviceCategory - Catégorie du service
 * @returns true si la catégorie nécessite un ProductManagerMobile
 */
export function shouldShowProductManager(serviceCategory: string | undefined | null): boolean {
    if (!serviceCategory) return false;

    // Catégories qui NE nécessitent PAS de produits (services purs)
    const pureServiceCategories = [
        'prestation',
        'service',
        'conseil',
        'formation',
        'education',
        'éducation'
    ];

    const normalized = serviceCategory.toLowerCase().trim();

    // Si c'est une catégorie de service pur, pas besoin de produits
    for (const pureCategory of pureServiceCategories) {
        if (normalized.includes(pureCategory)) {
            return false;
        }
    }

    // Par défaut, proposer le gestionnaire de produits
    return true;
}

/**
 * Détecte le type de produit depuis un produit existant
 * Analyse les champs présents pour deviner le type
 */
export function detectProductTypeFromProduct(product: any): ProductType {
    if (!product || typeof product !== 'object') return 'autre';

    // Si le produit a déjà un type explicite
    if (product.type) return product.type as ProductType;

    // Détecter selon les champs présents
    if (product.superficie || product.nbChambres) return 'immobilier_batiment';
    if (product.surfaceTerrain) return 'immobilier_terrain';
    if (product.nbLits || product.nbPersonnes) return 'hotellerie';
    if (product.marque && product.modele && product.annee) return 'automobile';
    if (product.taille || product.couleur) return 'vetement';
    if (product.pointure) return 'chaussure';
    if (product.puissance || product.consommation) return 'electromenager';
    if (product.marqueImageSon) return 'image_son';
    if (product.systemeExploitation) return 'telephone';
    if (product.processeur || product.ram) return 'ordinateur';
    if (product.materiauMobilier) return 'mobilier';
    if (product.categorieQuincaillerie) return 'quincaillerie';
    if (product.typePharmacie) return 'pharmacie';
    if (product.typeEtablissement) return 'hopital_clinique';
    if (product.typeDemenagement) return 'demenagement';
    if (product.typeCosmetique) return 'cosmetique_parfum';
    if (product.typeBijou) return 'bijoux';
    if (product.typeCoiffure) return 'coiffure_beaute';

    return 'autre';
}

