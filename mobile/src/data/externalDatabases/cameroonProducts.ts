// @ts-nocheck
/**
 * \uD83C\uDDE8\uD83C\uDDF2 PRODUITS LOCAUX CAMEROUN
 * 
 * Base de données de produits typiques camerounais pour enrichir l'autocomplétion.
 * Ces produits sont disponibles localement et souvent recherchés.
 */

import { EnrichedProduct } from '../enrichedProductDatabase';

export const CAMEROON_LOCAL_PRODUCTS: Partial<EnrichedProduct>[] = [
    // ═══════════════════════════════════════════════════════════
    // \uD83C\uDF3E AGRICULTURE ET CÉRÉALES
    // ═══════════════════════════════════════════════════════════

    {
        id: 'cm_riz_nerica',
        nom: 'Riz Nerica',
        aliases: ['Riz Nerica', 'Riz NERICA', 'Riz local camerounais'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Cameroun',
            qualite: 'Standard',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                variete: 'NERICA',
                type_produit: 'Riz',
                zone_production: 'Ouest Cameroun',
                saison: 'Toute l\'année'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité',
                    type: 'number',
                    required: true
                },
                {
                    field: 'prix',
                    label: 'Prix',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['CM']
    },

    {
        id: 'cm_mais_local',
        nom: 'Maïs Local',
        aliases: ['Maïs camerounais', 'Maïs local', 'Maïs jaune'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Céréale',
            marque: 'Local',
            origine: 'Cameroun',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                type_produit: 'Maïs',
                couleur: 'Jaune',
                zone_production: 'Nord Cameroun'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (sacs)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'prix',
                    label: 'Prix par sac',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['CM']
    },

    {
        id: 'cm_manioc',
        nom: 'Manioc',
        aliases: ['Manioc frais', 'Manioc local', 'Cassava'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Tubercule',
            marque: 'Local',
            origine: 'Cameroun',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Manioc',
                forme: 'Tubercule',
                zone_production: 'Sud Cameroun'
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
                    options: ['Frais', 'Séché', 'Farine'],
                    required: true
                }
            ]
        },
        availableIn: ['CM']
    },

    // ═══════════════════════════════════════════════════════════
    // \uD83D\uDEE2️ HUILES ET LIQUIDES
    // ═══════════════════════════════════════════════════════════

    {
        id: 'cm_huile_palme',
        nom: 'Huile de Palme',
        aliases: ['Huile rouge', 'Huile de palme rouge', 'Huile palme locale'],
        characteristics: {
            categorie: 'Agroalimentaire',
            type: 'Huile alimentaire',
            marque: 'Local',
            origine: 'Cameroun',
            unite: 'litre',
            caracteristiques_fixes: {
                type_produit: 'Huile de palme',
                couleur: 'Rouge',
                zone_production: 'Sud-Ouest Cameroun',
                conditionnement: 'Bidons, Bouteilles'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (litres)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'conditionnement',
                    label: 'Conditionnement',
                    type: 'select',
                    options: ['Bidon 5L', 'Bidon 20L', 'Bouteille 1L', 'Vrac'],
                    required: true
                }
            ]
        },
        availableIn: ['CM']
    },

    {
        id: 'cm_huile_arachide',
        nom: 'Huile d\'Arachide',
        aliases: ['Huile arachide', 'Huile cacahuète'],
        characteristics: {
            categorie: 'Agroalimentaire',
            type: 'Huile alimentaire',
            marque: 'Local',
            origine: 'Cameroun',
            unite: 'litre',
            caracteristiques_fixes: {
                type_produit: 'Huile d\'arachide',
                couleur: 'Jaune clair',
                zone_production: 'Nord Cameroun'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (litres)',
                    type: 'number',
                    required: true
                }
            ]
        },
        availableIn: ['CM']
    },

    // ═══════════════════════════════════════════════════════════
    // \uD83C\uDF6B CACAO ET CAFÉ
    // ═══════════════════════════════════════════════════════════

    {
        id: 'cm_cacao',
        nom: 'Cacao',
        aliases: ['Fèves de cacao', 'Cacao camerounais', 'Cacao local'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Fève',
            marque: 'Local',
            origine: 'Cameroun',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Cacao',
                variete: 'Forastero',
                zone_production: 'Sud Cameroun',
                qualite: 'Premium'
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
        availableIn: ['CM']
    },

    {
        id: 'cm_cafe_robusta',
        nom: 'Café Robusta',
        aliases: ['Café Robusta camerounais', 'Café local'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Grain de café',
            marque: 'Local',
            origine: 'Cameroun',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Café',
                variete: 'Robusta',
                zone_production: 'Ouest Cameroun'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'torrefaction',
                    label: 'Torréfaction',
                    type: 'select',
                    options: ['Non torréfié', 'Torréfié léger', 'Torréfié moyen', 'Torréfié foncé'],
                    required: false
                }
            ]
        },
        availableIn: ['CM']
    },

    // ═══════════════════════════════════════════════════════════
    // \uD83E\uDD5C ARACHIDES ET NOIX
    // ═══════════════════════════════════════════════════════════

    {
        id: 'cm_arachide',
        nom: 'Arachide',
        aliases: ['Cacahuètes', 'Arachides décortiquées', 'Arachides en coque'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Légumineuse',
            marque: 'Local',
            origine: 'Cameroun',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Arachide',
                zone_production: 'Nord Cameroun'
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
        availableIn: ['CM']
    },

    // ═══════════════════════════════════════════════════════════
    // \uD83C\uDF4C FRUITS ET LÉGUMES
    // ═══════════════════════════════════════════════════════════

    {
        id: 'cm_banane_plantain',
        nom: 'Banane Plantain',
        aliases: ['Plantain', 'Banane plantain', 'Plantain mûr'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Fruit',
            marque: 'Local',
            origine: 'Cameroun',
            unite: 'régime',
            caracteristiques_fixes: {
                type_produit: 'Banane plantain',
                zone_production: 'Sud Cameroun'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (régimes)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'maturite',
                    label: 'Maturité',
                    type: 'select',
                    options: ['Vert', 'Mi-mûr', 'Mûr'],
                    required: true
                }
            ]
        },
        availableIn: ['CM']
    },

    {
        id: 'cm_tomate',
        nom: 'Tomate Locale',
        aliases: ['Tomates', 'Tomate fraîche', 'Tomate locale'],
        characteristics: {
            categorie: 'Agriculture',
            type: 'Légume',
            marque: 'Local',
            origine: 'Cameroun',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Tomate',
                variete: 'Locale',
                zone_production: 'Ouest Cameroun'
            },
            caracteristiques_variables: [
                {
                    field: 'quantite',
                    label: 'Quantité (kg)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'calibre',
                    label: 'Calibre',
                    type: 'select',
                    options: ['Gros', 'Moyen', 'Petit'],
                    required: false
                }
            ]
        },
        availableIn: ['CM']
    },

    // ═══════════════════════════════════════════════════════════
    // \uD83D\uDC1F POISSONS ET FRUITS DE MER
    // ═══════════════════════════════════════════════════════════

    {
        id: 'cm_poisson_fume',
        nom: 'Poisson Fumé',
        aliases: ['Poisson fumé', 'Poisson séché', 'Sardines fumées'],
        characteristics: {
            categorie: 'Agroalimentaire',
            type: 'Poisson transformé',
            marque: 'Local',
            origine: 'Cameroun',
            unite: 'kg',
            caracteristiques_fixes: {
                type_produit: 'Poisson fumé',
                zone_production: 'Littoral Cameroun',
                conservation: 'Fumé'
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
                    options: ['Sardine', 'Tilapia', 'Capitaine', 'Autre'],
                    required: true
                }
            ]
        },
        availableIn: ['CM']
    }
];

/**
 * Fonction helper pour obtenir les produits par catégorie
 */
export function getCameroonProductsByCategory(category: string): Partial<EnrichedProduct>[] {
    return CAMEROON_LOCAL_PRODUCTS.filter(product => {
        const productCategory = product.characteristics?.categorie?.toLowerCase() || '';
        return productCategory.includes(category.toLowerCase());
    });
}

/**
 * Fonction helper pour rechercher un produit par nom
 */
export function searchCameroonProduct(query: string): Partial<EnrichedProduct>[] {
    const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return CAMEROON_LOCAL_PRODUCTS.filter(product => {
        const nom = product.nom?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
        const aliases = product.aliases?.map(a => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) || [];

        return nom.includes(normalizedQuery) ||
            aliases.some(alias => alias.includes(normalizedQuery));
    });
}

