// @ts-nocheck
/**
 * 🌍 PRODUITS LOCAUX PAR PAYS - AFRIQUE FRANCOPHONE
 * 
 * Cette base centralise les produits locaux critiques manquants dans Open Food Facts
 * pour tous les pays africains francophones.
 * 
 * Stratégie: Focus sur produits frais, vrac, artisanaux, locaux (non couverts par OFF)
 */

import { EnrichedProduct } from '../enrichedProductDatabase';

// ═══════════════════════════════════════════════════════════
// 🇨🇮 CÔTE D'IVOIRE
// ═══════════════════════════════════════════════════════════

export const IVORY_COAST_LOCAL_PRODUCTS: Partial<EnrichedProduct>[] = [
    {
        id: 'ci_cacao_brut',
        nom: 'Fèves de Cacao Brutes',
        aliases: ['Cacao brut', 'Fèves cacao', 'Cacao vert'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Fève',
            marque: 'Local',
            origine: 'Côte d\'Ivoire',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Cacao',
                variete: 'Forastero',
                zone_production: 'Sud-Ouest Côte d\'Ivoire',
                qualite: 'Premium',
                traitement: 'Brut (non torréfié)'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'qualite',
                    label: 'Qualité',
                    type: 'select',
                    options: ['Premium', 'Standard', 'Courant'],
                    required: true
                }
            ]
        },
        availableIn: ['CI']
    },

    {
        id: 'ci_cafe_vert',
        nom: 'Café Vert',
        aliases: ['Café vert', 'Café non torréfié'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Grain de café',
            marque: 'Local',
            origine: 'Côte d\'Ivoire',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Café',
                variete: 'Robusta',
                zone_production: 'Ouest Côte d\'Ivoire'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['CI']
    },

    {
        id: 'ci_anacarde',
        nom: 'Anacarde Brut',
        aliases: ['Noix de cajou', 'Anacarde', 'Cajou brut'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Fruit à coque',
            marque: 'Local',
            origine: 'Côte d\'Ivoire',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Anacarde',
                zone_production: 'Nord Côte d\'Ivoire',
                traitement: 'Brut (non décortiqué)'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['CI']
    },

    {
        id: 'ci_riz_local',
        nom: 'Riz Local',
        aliases: ['Riz ivoirien', 'Riz local'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Côte d\'Ivoire',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                type_produit: 'Riz',
                zone_production: 'Nord Côte d\'Ivoire'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (sacs)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['CI']
    },

    {
        id: 'ci_igname',
        nom: 'Igname',
        aliases: ['Igname', 'Yam'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Tubercule',
            marque: 'Local',
            origine: 'Côte d\'Ivoire',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Igname',
                zone_production: 'Centre Côte d\'Ivoire'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['CI']
    }
];

// ═══════════════════════════════════════════════════════════
// 🇸🇳 SÉNÉGAL
// ═══════════════════════════════════════════════════════════

export const SENEGAL_LOCAL_PRODUCTS: Partial<EnrichedProduct>[] = [
    {
        id: 'sn_arachide',
        nom: 'Arachide Locale',
        aliases: ['Cacahuètes', 'Arachides', 'Arachide sénégalaise'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Légumineuse',
            marque: 'Local',
            origine: 'Sénégal',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Arachide',
                zone_production: 'Bassin arachidier (Centre Sénégal)',
                variete: 'Locale'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'etat',
                    label: 'État',
                    type: 'select',
                    options: ['En coque', 'Décortiquées', 'Torréfiées'],
                    required: true
                }
            ]
        },
        availableIn: ['SN']
    },

    {
        id: 'sn_mil',
        nom: 'Mil (Petit Mil)',
        aliases: ['Petit mil', 'Mil', 'Sorgho'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Sénégal',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                type_produit: 'Mil',
                zone_production: 'Nord Sénégal',
                variete: 'Petit mil'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (sacs)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['SN']
    },

    {
        id: 'sn_riz_local',
        nom: 'Riz Local',
        aliases: ['Riz sénégalais', 'Riz local', 'Riz de la vallée'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Sénégal',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                type_produit: 'Riz',
                zone_production: 'Vallée du Fleuve Sénégal'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (sacs)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['SN']
    },

    {
        id: 'sn_poisson_fume',
        nom: 'Poisson Fumé',
        aliases: ['Poisson fumé', 'Poisson séché', 'Poisson séché fumé'],
        characteristics: {
            categorie: 'Agroalimentaire',
            type: 'Poisson transformé',
            marque: 'Local',
            origine: 'Sénégal',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Poisson fumé',
                zone_production: 'Côte sénégalaise',
                conservation: 'Fumé et séché'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'espece',
                    label: 'Espèce',
                    type: 'select',
                    options: ['Thiof', 'Capitaine', 'Sardine', 'Yaboy', 'Autre'],
                    required: true
                }
            ]
        },
        availableIn: ['SN']
    },

    {
        id: 'sn_fonio',
        nom: 'Fonio',
        aliases: ['Fonio', 'Petit mil blanc'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Sénégal',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Fonio',
                zone_production: 'Sud-Est Sénégal',
                variete: 'Fonio blanc'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['SN']
    }
];

// ═══════════════════════════════════════════════════════════
// 🇲🇱 MALI
// ═══════════════════════════════════════════════════════════

export const MALI_LOCAL_PRODUCTS: Partial<EnrichedProduct>[] = [
    {
        id: 'ml_mil',
        nom: 'Mil (Petit Mil)',
        aliases: ['Petit mil', 'Mil', 'Sorgho'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Mali',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                type_produit: 'Mil',
                zone_production: 'Soudan malien',
                variete: 'Petit mil'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (sacs)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['ML']
    },

    {
        id: 'ml_sorgho',
        nom: 'Sorgho',
        aliases: ['Sorgho', 'Gros mil'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Mali',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                type_produit: 'Sorgho',
                zone_production: 'Soudan malien'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (sacs)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['ML']
    },

    {
        id: 'ml_fonio',
        nom: 'Fonio',
        aliases: ['Fonio', 'Petit mil blanc'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Mali',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Fonio',
                zone_production: 'Pays Dogon (Mali)',
                variete: 'Fonio blanc'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['ML']
    },

    {
        id: 'ml_riz_local',
        nom: 'Riz Local',
        aliases: ['Riz malien', 'Riz local', 'Riz de l\'Office du Niger'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Mali',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                type_produit: 'Riz',
                zone_production: 'Office du Niger (Ségou)'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (sacs)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['ML']
    },

    {
        id: 'ml_arachide',
        nom: 'Arachide Locale',
        aliases: ['Cacahuètes', 'Arachides'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Légumineuse',
            marque: 'Local',
            origine: 'Mali',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Arachide',
                zone_production: 'Soudan malien'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['ML']
    }
];

// ═══════════════════════════════════════════════════════════
// 🇧🇫 BURKINA FASO
// ═══════════════════════════════════════════════════════════

export const BURKINA_FASO_LOCAL_PRODUCTS: Partial<EnrichedProduct>[] = [
    {
        id: 'bf_mil',
        nom: 'Mil (Petit Mil)',
        aliases: ['Petit mil', 'Mil'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Burkina Faso',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                type_produit: 'Mil',
                zone_production: 'Centre-Nord Burkina Faso'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (sacs)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['BF']
    },

    {
        id: 'bf_sorgho',
        nom: 'Sorgho',
        aliases: ['Sorgho', 'Gros mil'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Burkina Faso',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                type_produit: 'Sorgho',
                zone_production: 'Burkina Faso'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (sacs)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['BF']
    },

    {
        id: 'bf_karite',
        nom: 'Beurre de Karité',
        aliases: ['Beurre karité', 'Karité', 'Beurre de karité brut'],
        characteristics: {
            categorie: 'Agroalimentaire',
            type: 'Graisse végétale',
            marque: 'Local',
            origine: 'Burkina Faso',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Beurre de karité',
                zone_production: 'Nord Burkina Faso',
                traitement: 'Artisanal'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'qualite',
                    label: 'Qualité',
                    type: 'select',
                    options: ['Premium', 'Standard', 'Brut'],
                    required: true
                }
            ]
        },
        availableIn: ['BF']
    },

    {
        id: 'bf_sesame',
        nom: 'Sésame',
        aliases: ['Sésame', 'Graines de sésame'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Graine oléagineuse',
            marque: 'Local',
            origine: 'Burkina Faso',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Sésame',
                zone_production: 'Burkina Faso'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['BF']
    },

    {
        id: 'bf_arachide',
        nom: 'Arachide Locale',
        aliases: ['Cacahuètes', 'Arachides'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Légumineuse',
            marque: 'Local',
            origine: 'Burkina Faso',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Arachide',
                zone_production: 'Burkina Faso'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['BF']
    }
];

// ═══════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════

/**
 * Obtenir tous les produits locaux par pays
 */
export function getAllLocalProductsByCountryCode(countryCode: string): Partial<EnrichedProduct>[] {
    switch (countryCode) {
        case 'CM':
            // Importé depuis cameroonProducts.ts
            return [];
        case 'CI':
            return IVORY_COAST_LOCAL_PRODUCTS;
        case 'SN':
            return SENEGAL_LOCAL_PRODUCTS;
        case 'ML':
            return MALI_LOCAL_PRODUCTS;
        case 'BF':
            return BURKINA_FASO_LOCAL_PRODUCTS;
        default:
            return [];
    }
}

/**
 * Obtenir le nombre total de produits locaux par pays
 */
export function getLocalProductCountByCountry(countryCode: string): number {
    return getAllLocalProductsByCountryCode(countryCode).length;
}

/**
 * Rechercher dans tous les produits locaux
 */
export function searchLocalProducts(query: string, countryCode?: string): Partial<EnrichedProduct>[] {
    const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const results: Partial<EnrichedProduct>[] = [];

    const countries = countryCode ? [countryCode] : ['CM', 'CI', 'SN', 'ML', 'BF'];

    countries.forEach(code => {
        const products = getAllLocalProductsByCountryCode(code);
        products.forEach(product => {
            const nom = product.nom?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
            const aliases = product.aliases?.map(a => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) || [];

            if (nom.includes(normalizedQuery) || aliases.some(alias => alias.includes(normalizedQuery))) {
                results.push(product);
            }
        });
    });

    return results;
}

