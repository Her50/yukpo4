/**
 * 🗄️ BASE DE DONNÉES ENRICHIE DE PRODUITS
 * 
 * Cette base contient des produits pré-configurés avec TOUTES leurs caractéristiques.
 * Quand l'utilisateur sélectionne un produit, le système pré-remplit automatiquement
 * tous les champs connus, réduisant la saisie de 15 champs à 3-4 champs seulement !
 */

export interface ProductCharacteristics {
    // Champs système (pré-remplis automatiquement)
    categorie?: string;
    marque?: string;
    type?: string;
    unite?: string;
    
    // Caractéristiques fixes du produit (pré-remplies)
    caracteristiques_fixes?: Record<string, any>;
    
    // Caractéristiques variables (à demander à l'utilisateur)
    caracteristiques_variables?: {
        field: string;
        label: string;
        type: 'select' | 'number' | 'text';
        options?: string[]; // Pour les select
        required?: boolean;
    }[];
    
    // Métadonnées
    source?: 'database' | 'user_contribution' | 'ai_extraction';
    popularity?: number; // Nombre de fois utilisé
    lastUpdated?: string;
}

export interface EnrichedProduct {
    // Identifiant unique
    id: string;
    
    // Nom du produit (ce que l'utilisateur cherche)
    nom: string;
    aliases?: string[]; // Variantes de noms (iPhone 15 Pro Max, iPhone15ProMax, etc.)
    
    // Caractéristiques complètes
    characteristics: ProductCharacteristics;
    
    // Données de localisation (disponibilité par pays)
    availableIn?: string[]; // Codes pays : ['CM', 'CI', 'SN']
}

// ═══════════════════════════════════════════════════════════════
// 📱 TÉLÉPHONES - Base enrichie avec caractéristiques complètes
// ═══════════════════════════════════════════════════════════════

export const TELEPHONES_ENRICHIS: EnrichedProduct[] = [
    {
        id: 'iphone-15-pro-max',
        nom: 'iPhone 15 Pro Max',
        aliases: ['iPhone 15 Pro Max', 'iPhone15ProMax', 'iPhone 15 PM'],
        characteristics: {
            categorie: 'Téléphone',
            marque: 'Apple',
            type: 'Smartphone',
            unite: 'unité',
            caracteristiques_fixes: {
                systeme_exploitation: 'iOS 17',
                taille_ecran: '6.7 pouces',
                type_ecran: 'Super Retina XDR OLED',
                camera_principale: '48MP Triple caméra',
                camera_frontale: '12MP TrueDepth',
                processeur: 'A17 Pro',
                ram: '8GB',
                connectivite: '5G',
                batterie: '4441 mAh',
                charge_rapide: 'Oui (27W)',
                charge_sans_fil: 'Oui (MagSafe 15W)',
                resistance: 'IP68',
                materiau: 'Titane',
            },
            caracteristiques_variables: [
                {
                    field: 'stockage',
                    label: 'Capacité de stockage',
                    type: 'select',
                    options: ['256GB', '512GB', '1TB'],
                    required: true
                },
                {
                    field: 'couleur',
                    label: 'Couleur',
                    type: 'select',
                    options: ['Titane naturel', 'Titane bleu', 'Titane blanc', 'Titane noir'],
                    required: true
                },
                {
                    field: 'etat',
                    label: 'État du téléphone',
                    type: 'select',
                    options: ['Neuf (scellé)', 'Neuf (déballé)', 'Très bon état', 'Bon état', 'État correct'],
                    required: true
                },
                {
                    field: 'accessoires',
                    label: 'Accessoires inclus',
                    type: 'select',
                    options: ['Complet (boîte + accessoires)', 'Téléphone seul', 'Avec chargeur', 'Sans accessoires'],
                    required: false
                }
            ],
            source: 'database',
            popularity: 1250
        },
        availableIn: ['CM', 'CI', 'SN', 'GA', 'CD', 'BJ', 'TG']
    },
    
    {
        id: 'samsung-galaxy-s24-ultra',
        nom: 'Samsung Galaxy S24 Ultra',
        aliases: ['Galaxy S24 Ultra', 'S24 Ultra', 'Samsung S24U'],
        characteristics: {
            categorie: 'Téléphone',
            marque: 'Samsung',
            type: 'Smartphone',
            unite: 'unité',
            caracteristiques_fixes: {
                systeme_exploitation: 'Android 14 (One UI 6)',
                taille_ecran: '6.8 pouces',
                type_ecran: 'Dynamic AMOLED 2X 120Hz',
                camera_principale: '200MP Quad caméra',
                camera_frontale: '12MP',
                processeur: 'Snapdragon 8 Gen 3',
                ram: '12GB',
                connectivite: '5G',
                batterie: '5000 mAh',
                charge_rapide: 'Oui (45W)',
                charge_sans_fil: 'Oui (15W)',
                resistance: 'IP68',
                stylus: 'S Pen intégré',
            },
            caracteristiques_variables: [
                {
                    field: 'stockage',
                    label: 'Capacité de stockage',
                    type: 'select',
                    options: ['256GB', '512GB', '1TB'],
                    required: true
                },
                {
                    field: 'couleur',
                    label: 'Couleur',
                    type: 'select',
                    options: ['Titanium Black', 'Titanium Gray', 'Titanium Violet', 'Titanium Yellow'],
                    required: true
                },
                {
                    field: 'etat',
                    label: 'État',
                    type: 'select',
                    options: ['Neuf', 'Très bon état', 'Bon état'],
                    required: true
                }
            ],
            source: 'database',
            popularity: 980
        },
        availableIn: ['CM', 'CI', 'SN', 'GA', 'CD']
    },
    
    {
        id: 'tecno-camon-20-pro',
        nom: 'Tecno Camon 20 Pro',
        aliases: ['Camon 20 Pro', 'Tecno Camon20Pro'],
        characteristics: {
            categorie: 'Téléphone',
            marque: 'Tecno',
            type: 'Smartphone',
            unite: 'unité',
            caracteristiques_fixes: {
                systeme_exploitation: 'Android 13',
                taille_ecran: '6.67 pouces',
                type_ecran: 'AMOLED 120Hz',
                camera_principale: '64MP Triple caméra',
                camera_frontale: '32MP',
                processeur: 'MediaTek Dimensity 8050',
                ram: '8GB',
                connectivite: '5G',
                batterie: '5000 mAh',
                charge_rapide: 'Oui (33W)',
            },
            caracteristiques_variables: [
                {
                    field: 'stockage',
                    label: 'Stockage',
                    type: 'select',
                    options: ['256GB'],
                    required: true
                },
                {
                    field: 'couleur',
                    label: 'Couleur',
                    type: 'select',
                    options: ['Noir', 'Bleu', 'Or'],
                    required: true
                },
                {
                    field: 'etat',
                    label: 'État',
                    type: 'select',
                    options: ['Neuf', 'Occasion'],
                    required: true
                }
            ],
            source: 'database',
            popularity: 2100 // Très populaire en Afrique
        },
        availableIn: ['CM', 'CI', 'SN', 'BJ', 'TG', 'CD', 'GA', 'BF', 'NE', 'ML']
    }
];

// ═══════════════════════════════════════════════════════════════
// 🚗 AUTOMOBILES - Base enrichie
// ═══════════════════════════════════════════════════════════════

export const AUTOMOBILES_ENRICHIES: EnrichedProduct[] = [
    {
        id: 'toyota-corolla-2020',
        nom: 'Toyota Corolla 2020',
        aliases: ['Corolla 2020', 'Toyota Corolla 20'],
        characteristics: {
            categorie: 'Automobile',
            marque: 'Toyota',
            type: 'Berline',
            unite: 'unité',
            caracteristiques_fixes: {
                modele: 'Corolla',
                annee: 2020,
                type_vehicule: 'Berline',
                nombre_portes: 4,
                nombre_places: 5,
                taille_moteur: '1.8L',
                puissance: '139 ch',
                type_carrosserie: 'Berline 4 portes',
            },
            caracteristiques_variables: [
                {
                    field: 'type_carburant',
                    label: 'Type de carburant',
                    type: 'select',
                    options: ['Essence', 'Hybride'],
                    required: true
                },
                {
                    field: 'transmission',
                    label: 'Transmission',
                    type: 'select',
                    options: ['Automatique CVT', 'Manuelle 6 vitesses'],
                    required: true
                },
                {
                    field: 'kilometrage',
                    label: 'Kilométrage (km)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'etat_general',
                    label: 'État général',
                    type: 'select',
                    options: ['Excellent', 'Très bon', 'Bon', 'Correct'],
                    required: true
                },
                {
                    field: 'couleur',
                    label: 'Couleur',
                    type: 'select',
                    options: ['Blanc', 'Noir', 'Gris', 'Argent', 'Rouge', 'Bleu'],
                    required: true
                }
            ],
            source: 'database',
            popularity: 1850
        },
        availableIn: ['CM', 'CI', 'SN', 'GA', 'CD', 'BJ']
    },
    
    {
        id: 'toyota-land-cruiser-v8-2015',
        nom: 'Toyota Land Cruiser V8 2015',
        aliases: ['Land Cruiser V8 2015', 'LC V8 2015'],
        characteristics: {
            categorie: 'Automobile',
            marque: 'Toyota',
            type: 'SUV 4x4',
            unite: 'unité',
            caracteristiques_fixes: {
                modele: 'Land Cruiser V8',
                annee: 2015,
                type_vehicule: 'SUV 4x4',
                nombre_portes: 5,
                nombre_places: 8,
                taille_moteur: '4.5L V8 Diesel',
                puissance: '286 ch',
                traction: '4x4 permanent',
            },
            caracteristiques_variables: [
                {
                    field: 'version',
                    label: 'Version',
                    type: 'select',
                    options: ['GX-R', 'VX-R', 'VXR Limited'],
                    required: true
                },
                {
                    field: 'kilometrage',
                    label: 'Kilométrage (km)',
                    type: 'number',
                    required: true
                },
                {
                    field: 'etat_general',
                    label: 'État',
                    type: 'select',
                    options: ['Excellent', 'Très bon', 'Bon'],
                    required: true
                },
                {
                    field: 'couleur',
                    label: 'Couleur',
                    type: 'select',
                    options: ['Blanc perle', 'Noir', 'Gris métallisé', 'Argent'],
                    required: true
                }
            ],
            source: 'database',
            popularity: 920
        },
        availableIn: ['CM', 'CI', 'SN', 'GA', 'CD', 'TD', 'CF']
    }
];

// ═══════════════════════════════════════════════════════════════
// 🌾 PRODUITS AGRICOLES - Base enrichie avec unités africaines
// ═══════════════════════════════════════════════════════════════

export const PRODUITS_AGRICOLES_ENRICHIS: EnrichedProduct[] = [
    {
        id: 'riz-parfume-long-grain',
        nom: 'Riz parfumé long grain',
        aliases: ['Riz long grain', 'Riz parfumé', 'Long grain rice'],
        characteristics: {
            categorie: 'Produit agricole',
            type: 'Céréale',
            unite: 'sac (50kg)', // Unité africaine standard !
            caracteristiques_fixes: {
                type_produit: 'Riz',
                variete: 'Long grain parfumé',
                origine_possible: ['Vietnam', 'Thaïlande', 'Pakistan', 'Inde', 'Cameroun'],
                conditionnement_standard: 'Sac de 50kg',
                conservation: 'Sec, à l\'abri de l\'humidité',
                duree_conservation: '12-18 mois',
            },
            caracteristiques_variables: [
                {
                    field: 'origine',
                    label: 'Pays d\'origine',
                    type: 'select',
                    options: ['Vietnam', 'Thaïlande', 'Pakistan', 'Inde', 'Cameroun', 'Autre'],
                    required: true
                },
                {
                    field: 'qualite',
                    label: 'Qualité',
                    type: 'select',
                    options: ['Premium (brisures <5%)', 'Standard (brisures 5-15%)', 'Économique (brisures >15%)'],
                    required: true
                },
                {
                    field: 'quantite_sacs',
                    label: 'Nombre de sacs disponibles',
                    type: 'number',
                    required: true
                },
                {
                    field: 'prix_unitaire',
                    label: 'Prix par sac (FCFA)',
                    type: 'number',
                    required: true
                }
            ],
            source: 'database',
            popularity: 3500 // Très demandé !
        },
        availableIn: ['CM', 'CI', 'SN', 'BJ', 'TG', 'BF', 'NE', 'ML', 'GA', 'CD']
    },
    
    {
        id: 'huile-vegetale-bidon',
        nom: 'Huile végétale (bidon 5L)',
        aliases: ['Huile végétale', 'Huile de cuisine', 'Cooking oil'],
        characteristics: {
            categorie: 'Produit agricole',
            type: 'Huile alimentaire',
            unite: 'bidon (5L)', // Unité courante en Afrique
            caracteristiques_fixes: {
                type_produit: 'Huile végétale',
                conditionnement: 'Bidon plastique 5 litres',
                type_huile_possible: ['Palme', 'Soja', 'Tournesol', 'Arachide', 'Mélange'],
            },
            caracteristiques_variables: [
                {
                    field: 'type_huile',
                    label: 'Type d\'huile',
                    type: 'select',
                    options: ['Huile de palme', 'Huile de soja', 'Huile de tournesol', 'Huile d\'arachide', 'Mélange végétal'],
                    required: true
                },
                {
                    field: 'marque',
                    label: 'Marque',
                    type: 'text',
                    required: false
                },
                {
                    field: 'quantite_bidons',
                    label: 'Nombre de bidons',
                    type: 'number',
                    required: true
                }
            ],
            source: 'database',
            popularity: 2800
        },
        availableIn: ['CM', 'CI', 'SN', 'BJ', 'TG', 'CD', 'GA']
    }
];

// ═══════════════════════════════════════════════════════════════
// 🏗️ MATÉRIAUX DE CONSTRUCTION
// ═══════════════════════════════════════════════════════════════

export const MATERIAUX_CONSTRUCTION_ENRICHIS: EnrichedProduct[] = [
    {
        id: 'ciment-portland-50kg',
        nom: 'Ciment Portland (sac 50kg)',
        aliases: ['Ciment', 'Sac de ciment', 'Ciment 50kg'],
        characteristics: {
            categorie: 'Matériau de construction',
            type: 'Ciment',
            unite: 'sac (50kg)',
            caracteristiques_fixes: {
                type_produit: 'Ciment Portland',
                poids_sac: '50kg',
                type_ciment: 'CEM II/A 42.5R',
                usage: 'Tous travaux de maçonnerie',
            },
            caracteristiques_variables: [
                {
                    field: 'marque',
                    label: 'Marque',
                    type: 'select',
                    options: ['Cimencam', 'Cimaf', 'Dangote', 'Cimtogo', 'Autre'],
                    required: true
                },
                {
                    field: 'quantite_sacs',
                    label: 'Nombre de sacs',
                    type: 'number',
                    required: true
                }
            ],
            source: 'database',
            popularity: 4200
        },
        availableIn: ['CM', 'CI', 'SN', 'BJ', 'TG', 'BF', 'CD', 'GA']
    }
];

// ═══════════════════════════════════════════════════════════════
// 🔧 FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════

/**
 * Rechercher un produit enrichi par nom ou alias
 */
export function searchEnrichedProduct(query: string): EnrichedProduct | null {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Chercher dans toutes les catégories
    const allProducts = [
        ...TELEPHONES_ENRICHIS,
        ...AUTOMOBILES_ENRICHIES,
        ...PRODUITS_AGRICOLES_ENRICHIS,
        ...MATERIAUX_CONSTRUCTION_ENRICHIS
    ];
    
    // Recherche exacte par nom
    let product = allProducts.find(p => 
        p.nom.toLowerCase() === normalizedQuery
    );
    
    // Recherche par alias
    if (!product) {
        product = allProducts.find(p =>
            p.aliases?.some(alias => alias.toLowerCase() === normalizedQuery)
        );
    }
    
    // Recherche partielle (contient)
    if (!product) {
        product = allProducts.find(p =>
            p.nom.toLowerCase().includes(normalizedQuery) ||
            p.aliases?.some(alias => alias.toLowerCase().includes(normalizedQuery))
        );
    }
    
    return product || null;
}

/**
 * Obtenir les produits enrichis par catégorie
 */
export function getEnrichedProductsByCategory(category: string): EnrichedProduct[] {
    const categoryMap: Record<string, EnrichedProduct[]> = {
        'telephone': TELEPHONES_ENRICHIS,
        'automobile': AUTOMOBILES_ENRICHIES,
        'agriculture': PRODUITS_AGRICOLES_ENRICHIS,
        'construction': MATERIAUX_CONSTRUCTION_ENRICHIS
    };
    
    return categoryMap[category.toLowerCase()] || [];
}

/**
 * Obtenir les produits enrichis disponibles dans un pays
 */
export function getEnrichedProductsByCountry(countryCode: string): EnrichedProduct[] {
    const allProducts = [
        ...TELEPHONES_ENRICHIS,
        ...AUTOMOBILES_ENRICHIES,
        ...PRODUITS_AGRICOLES_ENRICHIS,
        ...MATERIAUX_CONSTRUCTION_ENRICHIS
    ];
    
    return allProducts.filter(p =>
        !p.availableIn || p.availableIn.includes(countryCode)
    );
}

/**
 * Obtenir les suggestions de produits (autocomplete)
 */
export function getProductSuggestions(query: string, limit: number = 10): string[] {
    if (!query || query.length < 2) return [];
    
    const normalizedQuery = query.toLowerCase();
    const allProducts = [
        ...TELEPHONES_ENRICHIS,
        ...AUTOMOBILES_ENRICHIES,
        ...PRODUITS_AGRICOLES_ENRICHIS,
        ...MATERIAUX_CONSTRUCTION_ENRICHIS
    ];
    
    // Trier par popularité
    const sorted = allProducts
        .filter(p =>
            p.nom.toLowerCase().includes(normalizedQuery) ||
            p.aliases?.some(alias => alias.toLowerCase().includes(normalizedQuery))
        )
        .sort((a, b) => (b.characteristics.popularity || 0) - (a.characteristics.popularity || 0));
    
    return sorted.slice(0, limit).map(p => p.nom);
}

