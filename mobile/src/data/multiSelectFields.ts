// Configuration des champs en sélection multiple par catégorie de produit
// Évite de créer plusieurs produits pour des variantes du même article

export interface MultiSelectFieldConfig {
    fieldName: string;
    maxSelections: number;
    description: string;
}

export interface ProductTypeMultiSelectConfig {
    [productType: string]: MultiSelectFieldConfig[];
}

// ✅ CONFIGURATION DES CHAMPS MULTI-SÉLECTION PAR CATÉGORIE
export const MULTI_SELECT_FIELDS: ProductTypeMultiSelectConfig = {
    // VÊTEMENTS - Couleurs et tailles multiples
    vetement: [
        {
            fieldName: 'couleurs',
            maxSelections: 8,
            description: 'Couleurs disponibles pour ce vêtement'
        },
        {
            fieldName: 'tailles',
            maxSelections: 10,
            description: 'Tailles disponibles (S, M, L, XL, etc.)'
        }
    ],

    // CHAUSSURES - Couleurs et pointures multiples
    chaussure: [
        {
            fieldName: 'couleurs',
            maxSelections: 6,
            description: 'Couleurs disponibles pour ces chaussures'
        },
        {
            fieldName: 'pointures',
            maxSelections: 15,
            description: 'Pointures disponibles (35, 36, 37, etc.)'
        }
    ],

    // AUTOMOBILE - Couleurs multiples
    automobile: [
        {
            fieldName: 'couleurs',
            maxSelections: 5,
            description: 'Couleurs disponibles pour ce véhicule'
        }
    ],

    // IMMOBILIER - ✅ REFONTE COMPLÈTE (4 champs multiselect)
    immobilier_batiment: [
        {
            fieldName: 'equipements',
            maxSelections: 15,
            description: 'Équipements inclus (eau courante 24h, groupe électrogène, climatisation, etc.)'
        },
        {
            fieldName: 'proximites',
            maxSelections: 10,
            description: 'Commodités à proximité (école, hôpital, marché, transport, etc.)'
        },
        {
            fieldName: 'conditions_location',
            maxSelections: 8,
            description: 'Conditions de location (caution, avance, garant, etc.)'
        },
        {
            fieldName: 'orientations',
            maxSelections: 4,
            description: 'Orientations du bien (Nord, Sud, Est, Ouest)'
        }
    ],

    // HÔTELLERIE - Équipements et services multiples
    hotellerie: [
        {
            fieldName: 'equipements',
            maxSelections: 15,
            description: 'Équipements de l\'hôtel (Wi-Fi, piscine, spa, etc.)'
        },
        {
            fieldName: 'services',
            maxSelections: 10,
            description: 'Services proposés (petit-déjeuner, navette, etc.)'
        }
    ],

    // ÉLECTROMÉNAGER - Couleurs multiples
    electromenager: [
        {
            fieldName: 'couleurs',
            maxSelections: 5,
            description: 'Couleurs disponibles pour cet appareil'
        }
    ],

    // IMAGE & SON - ✅ REFONTE COMPLÈTE (4 champs multiselect)
    image_son: [
        {
            fieldName: 'connectivites',
            maxSelections: 10,
            description: 'Connectivités disponibles (HDMI, USB, WiFi, Bluetooth, etc.)'
        },
        {
            fieldName: 'fonctionnalites',
            maxSelections: 12,
            description: 'Fonctionnalités (Smart TV, HDR, Dolby Atmos, etc.)'
        },
        {
            fieldName: 'accessoires_inclus',
            maxSelections: 10,
            description: 'Accessoires fournis avec le produit'
        },
        {
            fieldName: 'resolutions',
            maxSelections: 4,
            description: 'Résolutions supportées (HD, 4K, 8K, etc.)'
        }
    ],

    // TÉLÉPHONES - Couleurs et capacités multiples
    telephone: [
        {
            fieldName: 'couleurs',
            maxSelections: 6,
            description: 'Couleurs disponibles pour ce téléphone'
        },
        {
            fieldName: 'stockage',
            maxSelections: 4,
            description: 'Capacités de stockage disponibles (64GB, 128GB, etc.)'
        }
    ],

    // ORDINATEURS - Couleurs et configurations multiples
    ordinateur: [
        {
            fieldName: 'couleurs',
            maxSelections: 4,
            description: 'Couleurs disponibles pour cet ordinateur'
        },
        {
            fieldName: 'ram',
            maxSelections: 5,
            description: 'Configurations RAM disponibles (8GB, 16GB, etc.)'
        },
        {
            fieldName: 'stockage',
            maxSelections: 6,
            description: 'Capacités de stockage disponibles'
        }
    ],

    // MOBILIER - Couleurs et matériaux multiples
    mobilier: [
        {
            fieldName: 'couleurs',
            maxSelections: 6,
            description: 'Couleurs disponibles pour ce meuble'
        },
        {
            fieldName: 'materiaux',
            maxSelections: 4,
            description: 'Matériaux utilisés (bois, métal, tissu, etc.)'
        }
    ],

    // ALIMENTS - Origines et certifications multiples
    aliments: [
        {
            fieldName: 'origines',
            maxSelections: 5,
            description: 'Origines disponibles (locale, importée, bio, etc.)'
        },
        {
            fieldName: 'certifications',
            maxSelections: 6,
            description: 'Certifications (Bio, Halal, Kasher, etc.)'
        }
    ],

    // LIVRES & FOURNITURES - Matières et niveaux multiples
    livres_fournitures: [
        {
            fieldName: 'matieres',
            maxSelections: 8,
            description: 'Matières scolaires couvertes'
        },
        {
            fieldName: 'niveaux',
            maxSelections: 6,
            description: 'Niveaux scolaires concernés'
        }
    ],

    // QUINCAILLERIE - Marques et unités multiples
    quincaillerie: [
        {
            fieldName: 'marques',
            maxSelections: 8,
            description: 'Marques disponibles pour ce produit'
        },
        {
            fieldName: 'unites',
            maxSelections: 5,
            description: 'Unités de vente disponibles (pièce, kg, litre, etc.)'
        }
    ],

    // PRESTATIONS DE SERVICE - Types et zones multiples
    prestation_service: [
        {
            fieldName: 'types',
            maxSelections: 8,
            description: 'Types de prestations proposées'
        },
        {
            fieldName: 'zones',
            maxSelections: 10,
            description: 'Zones d\'intervention'
        }
    ],

    // PHARMACIE - Services et spécialités multiples
    pharmacie: [
        {
            fieldName: 'services',
            maxSelections: 8,
            description: 'Services proposés (délivrance, conseil, garde, etc.)'
        },
        {
            fieldName: 'specialites',
            maxSelections: 6,
            description: 'Spécialités médicales couvertes'
        }
    ],

    // COSMÉTIQUES & PARFUMS - Types et marques multiples
    cosmetique_parfum: [
        {
            fieldName: 'types',
            maxSelections: 8,
            description: 'Types de produits cosmétiques'
        },
        {
            fieldName: 'marques',
            maxSelections: 10,
            description: 'Marques disponibles'
        }
    ],

    // BIJOUX - Matériaux et types multiples
    bijoux: [
        {
            fieldName: 'materiaux',
            maxSelections: 8,
            description: 'Matériaux utilisés (or, argent, diamant, etc.)'
        },
        {
            fieldName: 'types',
            maxSelections: 6,
            description: 'Types de bijoux (bague, collier, bracelet, etc.)'
        }
    ],

    // COIFFURE & BEAUTÉ - Services et types multiples
    coiffure_beaute: [
        {
            fieldName: 'services',
            maxSelections: 10,
            description: 'Services proposés (coupe, coloration, soins, etc.)'
        },
        {
            fieldName: 'types',
            maxSelections: 6,
            description: 'Types de cheveux traités'
        }
    ],

    // DÉMÉNAGEMENT - Services et véhicules multiples
    demenagement: [
        {
            fieldName: 'services',
            maxSelections: 8,
            description: 'Services proposés (emballage, transport, montage, etc.)'
        },
        {
            fieldName: 'vehicules',
            maxSelections: 5,
            description: 'Types de véhicules disponibles'
        }
    ],

    // ASSURANCE - Types et couvertures multiples
    assurance: [
        {
            fieldName: 'types',
            maxSelections: 6,
            description: 'Types d\'assurance proposés'
        },
        {
            fieldName: 'couvertures',
            maxSelections: 8,
            description: 'Types de couverture disponibles'
        }
    ],

    // JOUETS ENFANTS - Types et âges multiples
    jouets_enfants: [
        {
            fieldName: 'types',
            maxSelections: 8,
            description: 'Types de jouets (éducatif, peluche, jeu, etc.)'
        },
        {
            fieldName: 'ages',
            maxSelections: 5,
            description: 'Tranches d\'âge recommandées'
        }
    ],

    // USTENSILES CUISINE - Matériaux et capacités multiples
    ustensiles_cuisine: [
        {
            fieldName: 'materiaux',
            maxSelections: 6,
            description: 'Matériaux utilisés (inox, aluminium, céramique, etc.)'
        },
        {
            fieldName: 'capacites',
            maxSelections: 8,
            description: 'Capacités disponibles (1L, 2L, 3L, etc.)'
        }
    ],

    // PIÈCES AUTO - Types et marques multiples
    pieces_auto: [
        {
            fieldName: 'types',
            maxSelections: 10,
            description: 'Types de pièces (moteur, freinage, suspension, etc.)'
        },
        {
            fieldName: 'marques',
            maxSelections: 8,
            description: 'Marques de pièces disponibles'
        }
    ],

    // PIÈCES INDUSTRIELLES - Types et applications multiples
    pieces_industrielles: [
        {
            fieldName: 'types',
            maxSelections: 8,
            description: 'Types de pièces industrielles'
        },
        {
            fieldName: 'applications',
            maxSelections: 10,
            description: 'Applications industrielles'
        }
    ]
};

// ✅ FONCTION POUR VÉRIFIER SI UN CHAMP EST EN MULTI-SÉLECTION
export const isMultiSelectField = (productType: string, fieldName: string): boolean => {
    const config = MULTI_SELECT_FIELDS[productType];
    if (!config) return false;

    return config.some(field => field.fieldName === fieldName);
};

// ✅ FONCTION POUR OBTENIR LA CONFIGURATION D'UN CHAMP MULTI-SÉLECTION
export const getMultiSelectConfig = (productType: string, fieldName: string): MultiSelectFieldConfig | null => {
    const config = MULTI_SELECT_FIELDS[productType];
    if (!config) return null;

    return config.find(field => field.fieldName === fieldName) || null;
};

// ✅ FONCTION POUR OBTENIR TOUS LES CHAMPS MULTI-SÉLECTION D'UNE CATÉGORIE
export const getMultiSelectFieldsForProductType = (productType: string): MultiSelectFieldConfig[] => {
    return MULTI_SELECT_FIELDS[productType] || [];
};

// ✅ FONCTION POUR OBTENIR LE NOMBRE MAXIMUM DE SÉLECTIONS
export const getMaxSelections = (productType: string, fieldName: string): number => {
    const config = getMultiSelectConfig(productType, fieldName);
    return config?.maxSelections || 10;
};

// ✅ FONCTION POUR OBTENIR LA DESCRIPTION D'UN CHAMP
export const getFieldDescription = (productType: string, fieldName: string): string => {
    const config = getMultiSelectConfig(productType, fieldName);
    return config?.description || '';
};

// ✅ EXEMPLES D'UTILISATION
/*
// Vérifier si un champ est en multi-sélection
const isMulti = isMultiSelectField('vetement', 'couleurs'); // true

// Obtenir la configuration
const config = getMultiSelectConfig('vetement', 'couleurs');
// { fieldName: 'couleurs', maxSelections: 8, description: 'Couleurs disponibles...' }

// Obtenir le maximum de sélections
const max = getMaxSelections('vetement', 'couleurs'); // 8

// Obtenir tous les champs multi-sélection d'une catégorie
const fields = getMultiSelectFieldsForProductType('vetement');
// [{ fieldName: 'couleurs', ... }, { fieldName: 'tailles', ... }]
*/