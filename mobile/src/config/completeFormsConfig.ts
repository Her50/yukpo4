/**
 * 🎯 CONFIGURATION COMPLÈTE DES 60+ FORMULAIRES
 * 
 * Ce fichier capture TOUTE la complexité de chaque formulaire :
 * - Sections organisées
 * - Composants spécialisés
 * - Layout (1/2 colonnes)
 * - Dépendances entre champs
 * - Hints contextuels
 * - Gestion variantes
 * - GPS, images, etc.
 */

export type FieldType = 
    | 'text' 
    | 'number' 
    | 'select' 
    | 'multiselect' 
    | 'date' 
    | 'time'
    | 'gps'
    | 'image'
    | 'smart_phone_model'      // Autocomplete marque-dépendant
    | 'vehicle_model'          // Autocomplete marque-dépendant
    | 'smart_appliance'        // Autocomplete marque-dépendant
    | 'location_selector'      // Sélecteur de lieux
    | 'health_structure'       // Hôpitaux/Cliniques
    | 'hotel_structure'        // Hôtels
    | 'variants';              // Gestion variantes (couleur/taille/prix)

export interface FieldConfig {
    field: string;                          // Nom du champ dans l'objet
    label: string;                          // Label affiché
    type: FieldType;                        // Type de champ
    required?: boolean;                     // Obligatoire ?
    placeholder?: string;                   // Texte placeholder
    
    // Pour select/multiselect
    options?: string[];                     // Options statiques
    productType?: string;                   // Pour récupérer depuis productModalities
    fieldName?: string;                     // Nom du champ dans productModalities
    
    // Pour champs conditionnels
    depends_on?: string;                    // Dépend de quel champ ?
    reset_when_depends_changes?: boolean;   // Reset si dépendance change ?
    show_if?: (formData: any) => boolean;   // Condition d'affichage
    
    // Pour validation
    validation?: {
        min?: number;
        max?: number;
        pattern?: RegExp;
        custom?: (value: any) => boolean | string;
    };
    
    // Pour composants spécialisés
    component_props?: any;                  // Props additionnelles
}

export interface FormSection {
    title: string;
    icon: string;                           // Nom icône SafeIcon
    fields: Array<FieldConfig | FieldConfig[]>;  // Array simple ou array de arrays (pour 2 colonnes)
    hints?: Array<{
        text: string;
        icon?: string;
        show_if?: (formData: any) => boolean;
    }>;
}

export interface CompleteFormConfig {
    category: string;
    
    // Configuration générale
    title: string;
    description?: string;
    
    // Champs pré-remplis automatiquement
    auto_filled_fields: Record<string, any>;
    
    // Sections du formulaire
    sections: FormSection[];
    
    // Gestion de variantes
    variants_enabled?: boolean;
    variants_config?: {
        dimensions: string[];  // ['couleur', 'taille', 'stockage']
        price_per_variant: boolean;
        stock_per_variant: boolean;
    };
    
    // Fonctionnalités activées
    features: {
        gps?: boolean;
        images?: boolean;
        documents?: boolean;
        video?: boolean;
        multi_language?: boolean;
    };
}

// ═══════════════════════════════════════════════════════════════
// 📱 TÉLÉPHONE - Configuration complète
// ═══════════════════════════════════════════════════════════════

export const TELEPHONE_FORM_CONFIG: CompleteFormConfig = {
    category: 'telephone',
    title: 'Vente de téléphone',
    description: 'Vendez votre smartphone rapidement',
    
    auto_filled_fields: {
        categorie: 'Téléphone',
        unite: 'unité',
        type: 'Smartphone'
    },
    
    sections: [
        // ═══ SECTION 1 : Identité du smartphone ═══
        {
            title: 'Identité du smartphone',
            icon: 'smartphone',
            fields: [
                // Ligne 1 : Marque + Modèle (2 colonnes)
                [
                    {
                        field: 'marqueTelephone',
                        label: 'Marque',
                        type: 'select',
                        productType: 'telephone',
                        fieldName: 'marques',
                        required: true,
                        placeholder: 'Ex: Apple, Samsung...'
                    },
                    {
                        field: 'modeleTelephone',
                        label: 'Modèle',
                        type: 'smart_phone_model',
                        depends_on: 'marqueTelephone',
                        reset_when_depends_changes: true,
                        required: true,
                        placeholder: 'Ex: iPhone 14 Pro...',
                        component_props: {
                            autoLoadLastUsed: true
                        }
                    }
                ],
                
                // Ligne 2 : État + Année (2 colonnes)
                [
                    {
                        field: 'etatTelephone',
                        label: 'État',
                        type: 'select',
                        productType: 'telephone',
                        fieldName: 'etats',
                        required: true,
                        placeholder: 'Ex: Neuf, Excellent...'
                    },
                    {
                        field: 'anneeAchatTelephone',
                        label: 'Année d\'achat',
                        type: 'number',
                        placeholder: 'Ex: 2023',
                        validation: {
                            min: 2010,
                            max: new Date().getFullYear()
                        }
                    }
                ]
            ]
        },
        
        // ═══ SECTION 2 : Caractéristiques techniques ═══
        {
            title: 'Caractéristiques techniques',
            icon: 'cpu',
            fields: [
                // Ligne 1 : Stockage + RAM
                [
                    {
                        field: 'stockage',
                        label: 'Stockage',
                        type: 'select',
                        productType: 'telephone',
                        fieldName: 'stockage',
                        placeholder: 'Ex: 64GB, 128GB...'
                    },
                    {
                        field: 'ram',
                        label: 'RAM',
                        type: 'select',
                        productType: 'telephone',
                        fieldName: 'ram',
                        placeholder: 'Ex: 4GB, 6GB...'
                    }
                ],
                
                // Ligne 2 : Taille écran + Type écran
                [
                    {
                        field: 'tailleEcran',
                        label: 'Taille écran',
                        type: 'select',
                        productType: 'telephone',
                        fieldName: 'taillesEcran',
                        placeholder: 'Ex: 6.1", 6.7"...'
                    },
                    {
                        field: 'typeEcran',
                        label: 'Type écran',
                        type: 'select',
                        productType: 'telephone',
                        fieldName: 'typesEcran',
                        placeholder: 'Ex: AMOLED, LCD...'
                    }
                ],
                
                // Ligne 3 : Caméra + Connectivité
                [
                    {
                        field: 'cameraPrincipale',
                        label: 'Caméra principale',
                        type: 'select',
                        productType: 'telephone',
                        fieldName: 'cameraPrincipale',
                        placeholder: 'Ex: 48MP, 64MP...'
                    },
                    {
                        field: 'connectivite',
                        label: 'Connectivité',
                        type: 'multiselect',
                        productType: 'telephone',
                        fieldName: 'connectivite',
                        placeholder: 'Ex: 5G, WiFi 6...'
                    }
                ]
            ],
            hints: [
                {
                    text: '💡 Plus de détails techniques = plus d\'acheteurs intéressés',
                    icon: 'info'
                }
            ]
        },
        
        // ═══ SECTION 3 : Accessoires et garantie ═══
        {
            title: 'Accessoires et garantie',
            icon: 'package',
            fields: [
                {
                    field: 'accessoires',
                    label: 'Accessoires inclus',
                    type: 'multiselect',
                    productType: 'telephone',
                    fieldName: 'accessoires',
                    placeholder: 'Ex: Chargeur, Écouteurs...'
                },
                {
                    field: 'garantie',
                    label: 'Garantie',
                    type: 'select',
                    productType: 'telephone',
                    fieldName: 'garanties',
                    placeholder: 'Ex: 6 mois, 1 an...'
                }
            ]
        },
        
        // ═══ SECTION 4 : Prix ═══
        {
            title: 'Prix',
            icon: 'dollar-sign',
            fields: [
                {
                    field: 'prix',
                    label: 'Prix de vente (FCFA)',
                    type: 'number',
                    required: true,
                    placeholder: 'Ex: 150000',
                    validation: {
                        min: 5000,
                        max: 5000000
                    }
                }
            ],
            hints: [
                {
                    text: '💰 Consultez les prix du marché pour rester compétitif',
                    icon: 'trending-up'
                }
            ]
        }
    ],
    
    variants_enabled: true,
    variants_config: {
        dimensions: ['couleur', 'stockage'],
        price_per_variant: true,
        stock_per_variant: true
    },
    
    features: {
        gps: false,
        images: true,
        documents: false,
        video: false,
        multi_language: true
    }
};

// ═══════════════════════════════════════════════════════════════
// 🚗 AUTOMOBILE - Configuration complète
// ═══════════════════════════════════════════════════════════════

export const AUTOMOBILE_FORM_CONFIG: CompleteFormConfig = {
    category: 'automobile',
    title: 'Vente de véhicule',
    
    auto_filled_fields: {
        categorie: 'Automobile',
        unite: 'unité'
    },
    
    sections: [
        // ═══ SECTION 1 : Identité du véhicule ═══
        {
            title: 'Identité du Véhicule',
            icon: 'car',
            fields: [
                {
                    field: 'description',
                    label: 'Description',
                    type: 'text',
                    required: true,
                    placeholder: 'Décrivez l\'état général, historique...',
                    component_props: {
                        multiline: true,
                        numberOfLines: 4
                    }
                },
                
                // Type + Carrosserie (2 colonnes)
                [
                    {
                        field: 'typeVehicule',
                        label: 'Type de véhicule',
                        type: 'select',
                        productType: 'automobile',
                        fieldName: 'types',
                        required: true,
                        placeholder: 'Ex: Voiture, SUV...'
                    },
                    {
                        field: 'typeCarrosserie',
                        label: 'Carrosserie',
                        type: 'select',
                        productType: 'automobile',
                        fieldName: 'carrosseries',
                        placeholder: 'Ex: Berline, SUV...'
                    }
                ],
                
                // Marque + Modèle (2 colonnes)
                [
                    {
                        field: 'marqueAutomobile',
                        label: 'Marque',
                        type: 'select',
                        productType: 'automobile',
                        fieldName: 'marques',
                        required: true,
                        placeholder: 'Ex: Toyota, Peugeot...'
                    },
                    {
                        field: 'modeleAutomobile',
                        label: 'Modèle',
                        type: 'vehicle_model',  // Composant spécialisé
                        depends_on: 'marqueAutomobile',
                        reset_when_depends_changes: true,
                        required: true,
                        placeholder: 'Ex: Corolla, 308...'
                    }
                ],
                
                // Année + Kilométrage (2 colonnes)
                [
                    {
                        field: 'annee',
                        label: 'Année',
                        type: 'number',
                        required: true,
                        placeholder: 'Ex: 2020',
                        validation: {
                            min: 1980,
                            max: new Date().getFullYear() + 1
                        }
                    },
                    {
                        field: 'kilometrage',
                        label: 'Kilométrage (km)',
                        type: 'number',
                        required: true,
                        placeholder: 'Ex: 65000',
                        validation: {
                            min: 0,
                            max: 1000000
                        }
                    }
                ],
                
                // Couleur + État (2 colonnes)
                [
                    {
                        field: 'couleurAutomobile',
                        label: 'Couleur',
                        type: 'select',
                        productType: 'automobile',
                        fieldName: 'couleurs',
                        required: true,
                        placeholder: 'Ex: Blanc, Noir...'
                    },
                    {
                        field: 'etatVehicule',
                        label: 'État du véhicule',
                        type: 'select',
                        productType: 'automobile',
                        fieldName: 'etat',
                        required: true,
                        placeholder: 'Ex: Excellent état...'
                    }
                ]
            ]
        },
        
        // ═══ SECTION 2 : Caractéristiques techniques ═══
        {
            title: 'Caractéristiques Techniques',
            icon: 'settings',
            fields: [
                // Carburant + Transmission
                [
                    {
                        field: 'typeCarburant',
                        label: 'Carburant',
                        type: 'select',
                        productType: 'automobile',
                        fieldName: 'carburant',
                        required: true,
                        placeholder: 'Ex: Diesel, Essence...'
                    },
                    {
                        field: 'transmission',
                        label: 'Transmission',
                        type: 'select',
                        productType: 'automobile',
                        fieldName: 'transmission',
                        required: true,
                        placeholder: 'Ex: Automatique...'
                    }
                ],
                
                // Puissance + Cylindrée
                [
                    {
                        field: 'puissance',
                        label: 'Puissance (CV)',
                        type: 'number',
                        placeholder: 'Ex: 110'
                    },
                    {
                        field: 'cylindree',
                        label: 'Cylindrée',
                        type: 'text',
                        placeholder: 'Ex: 1.6L, 2.0L...'
                    }
                ],
                
                // Portes + Places
                [
                    {
                        field: 'nbPortes',
                        label: 'Nombre de portes',
                        type: 'select',
                        productType: 'automobile',
                        fieldName: 'portes',
                        placeholder: 'Ex: 4 portes'
                    },
                    {
                        field: 'nbPlaces',
                        label: 'Nombre de places',
                        type: 'select',
                        productType: 'automobile',
                        fieldName: 'places',
                        placeholder: 'Ex: 5 places'
                    }
                ]
            ]
        },
        
        // ═══ SECTION 3 : Équipements ═══
        {
            title: 'Équipements',
            icon: 'tool',
            fields: [
                {
                    field: 'equipementsAuto',
                    label: 'Équipements disponibles',
                    type: 'multiselect',
                    productType: 'automobile',
                    fieldName: 'equipements',
                    placeholder: 'Ex: Climatisation, GPS...'
                }
            ],
            hints: [
                {
                    text: '🚗 Plus d\'équipements = prix de vente plus élevé',
                    icon: 'trending-up'
                }
            ]
        },
        
        // ═══ SECTION 4 : Papiers et Prix ═══
        {
            title: 'Papiers et Prix',
            icon: 'file-text',
            fields: [
                {
                    field: 'papiers',
                    label: 'Situation des papiers',
                    type: 'select',
                    productType: 'automobile',
                    fieldName: 'papiers',
                    placeholder: 'Ex: En règle, À refaire...'
                },
                {
                    field: 'prix',
                    label: 'Prix de vente (FCFA)',
                    type: 'number',
                    required: true,
                    placeholder: 'Ex: 3500000',
                    validation: {
                        min: 100000,
                        max: 100000000
                    }
                }
            ],
            hints: [
                {
                    text: '💡 Véhicule dédouané = vente plus rapide',
                    icon: 'check-circle'
                }
            ]
        }
    ],
    
    variants_enabled: false,  // Pas de variantes pour automobile
    
    features: {
        gps: true,   // Localisation du véhicule
        images: true,
        documents: true,  // Photos carte grise, etc.
        video: true,      // Vidéo du véhicule
        multi_language: false
    }
};

// ═══════════════════════════════════════════════════════════════
// 🌾 AGRICULTURE - Configuration complète
// ═══════════════════════════════════════════════════════════════

export const AGRICULTURE_FORM_CONFIG: CompleteFormConfig = {
    category: 'agriculture',
    title: 'Vente de produit agricole',
    
    auto_filled_fields: {
        categorie: 'Produit agricole',
        unite: 'sac (50kg)',  // Défaut africain
        type: 'Produit agricole'
    },
    
    sections: [
        {
            title: 'Identification du produit',
            icon: 'package',
            fields: [
                {
                    field: 'typeProduit',
                    label: 'Type de produit',
                    type: 'select',
                    productType: 'agriculture',
                    fieldName: 'types_produits',
                    required: true,
                    placeholder: 'Ex: Céréale, Légume...'
                },
                
                // Origine + Qualité
                [
                    {
                        field: 'origine',
                        label: 'Pays d\'origine',
                        type: 'select',
                        productType: 'agriculture',
                        fieldName: 'origines',
                        required: true,
                        placeholder: 'Ex: Vietnam, Cameroun...'
                    },
                    {
                        field: 'qualite',
                        label: 'Qualité',
                        type: 'select',
                        productType: 'agriculture',
                        fieldName: 'qualites',
                        required: true,
                        placeholder: 'Ex: Premium, Standard...'
                    }
                ],
                
                // Quantité + Prix unitaire
                [
                    {
                        field: 'quantite',
                        label: 'Quantité disponible (sacs)',
                        type: 'number',
                        required: true,
                        placeholder: 'Ex: 100',
                        validation: {
                            min: 1,
                            max: 100000
                        }
                    },
                    {
                        field: 'prixUnitaire',
                        label: 'Prix par sac (FCFA)',
                        type: 'number',
                        required: true,
                        placeholder: 'Ex: 25000',
                        validation: {
                            min: 1000,
                            max: 1000000
                        }
                    }
                ]
            ],
            hints: [
                {
                    text: '🌾 Précisez la variété pour attirer les grossistes',
                    icon: 'trending-up'
                },
                {
                    text: '📦 Indiquez le conditionnement (sac 50kg standard Afrique)',
                    icon: 'info'
                }
            ]
        }
    ],
    
    variants_enabled: false,
    
    features: {
        gps: true,  // Localisation champ/entrepôt
        images: true,
        documents: true,
        video: false
    }
};

// ═══════════════════════════════════════════════════════════════
// 🏠 IMMOBILIER - Configuration complète
// ═══════════════════════════════════════════════════════════════

export const IMMOBILIER_FORM_CONFIG: CompleteFormConfig = {
    category: 'immobilier',
    title: 'Vente ou location immobilière',
    
    auto_filled_fields: {
        categorie: 'Immobilier',
        unite: 'unité'
    },
    
    sections: [
        {
            title: 'Type de bien',
            icon: 'home',
            fields: [
                // Type + Statut
                [
                    {
                        field: 'typeBien',
                        label: 'Type de bien',
                        type: 'select',
                        productType: 'immobilier',
                        fieldName: 'types',
                        required: true,
                        placeholder: 'Ex: Appartement, Villa...'
                    },
                    {
                        field: 'statut',
                        label: 'Statut',
                        type: 'select',
                        productType: 'immobilier',
                        fieldName: 'statuts',
                        required: true,
                        placeholder: 'Ex: À vendre, À louer...'
                    }
                ],
                
                // Superficie + Nombre de pièces
                [
                    {
                        field: 'superficie',
                        label: 'Superficie (m²)',
                        type: 'number',
                        required: true,
                        placeholder: 'Ex: 85',
                        validation: {
                            min: 10,
                            max: 10000
                        }
                    },
                    {
                        field: 'nbChambres',
                        label: 'Nombre de chambres',
                        type: 'number',
                        placeholder: 'Ex: 3',
                        validation: {
                            min: 0,
                            max: 20
                        }
                    }
                ]
            ]
        },
        
        {
            title: 'Localisation',
            icon: 'map-pin',
            fields: [
                [
                    {
                        field: 'ville',
                        label: 'Ville',
                        type: 'location_selector',  // Composant spécialisé
                        component_props: {
                            scope: 'city'
                        },
                        required: true
                    },
                    {
                        field: 'quartier',
                        label: 'Quartier',
                        type: 'location_selector',
                        component_props: {
                            scope: 'point',
                            cityContext: 'ville'  // Filtrer selon ville
                        },
                        depends_on: 'ville',
                        required: true
                    }
                ],
                
                {
                    field: 'gpsImmobilier',
                    label: 'Localisation GPS',
                    type: 'gps',
                    placeholder: 'Ajouter la localisation GPS'
                }
            ],
            hints: [
                {
                    text: '📍 La localisation GPS augmente la visibilité de +60%',
                    icon: 'trending-up'
                }
            ]
        },
        
        {
            title: 'Équipements',
            icon: 'tool',
            fields: [
                {
                    field: 'equipements',
                    label: 'Équipements disponibles',
                    type: 'multiselect',
                    productType: 'immobilier',
                    fieldName: 'equipements',
                    placeholder: 'Ex: Eau courante, Électricité...'
                },
                {
                    field: 'proximites',
                    label: 'Proximités',
                    type: 'multiselect',
                    productType: 'immobilier',
                    fieldName: 'proximites',
                    placeholder: 'Ex: École, Hôpital...'
                }
            ]
        },
        
        {
            title: 'Prix',
            icon: 'dollar-sign',
            fields: [
                {
                    field: 'prix',
                    label: 'Prix (FCFA)',
                    type: 'number',
                    required: true,
                    placeholder: 'Ex: 25000000'
                }
            ]
        }
    ],
    
    variants_enabled: false,
    features: {
        gps: true,
        images: true,
        documents: true,
        video: true
    }
};

// ═══════════════════════════════════════════════════════════════
// 👕 VÊTEMENT - Configuration complète avec variantes
// ═══════════════════════════════════════════════════════════════

export const VETEMENT_FORM_CONFIG: CompleteFormConfig = {
    category: 'vetement',
    title: 'Vente de vêtement',
    
    auto_filled_fields: {
        categorie: 'Vêtement',
        unite: 'unité',
        type: 'Vêtement'
    },
    
    sections: [
        {
            title: 'Type de vêtement',
            icon: 'shopping-bag',
            fields: [
                // Type + Genre
                [
                    {
                        field: 'typeVetement',
                        label: 'Type',
                        type: 'select',
                        productType: 'vetement',
                        fieldName: 'types',
                        required: true,
                        placeholder: 'Ex: Chemise, Pantalon...'
                    },
                    {
                        field: 'genre',
                        label: 'Genre',
                        type: 'select',
                        productType: 'vetement',
                        fieldName: 'genres',
                        required: true,
                        placeholder: 'Ex: Homme, Femme...'
                    }
                ],
                
                // Taille + Matière
                [
                    {
                        field: 'taille',
                        label: 'Taille',
                        type: 'multiselect',  // Plusieurs tailles disponibles
                        productType: 'vetement',
                        fieldName: 'tailles',
                        required: true,
                        placeholder: 'Ex: S, M, L...'
                    },
                    {
                        field: 'matiere',
                        label: 'Matière',
                        type: 'select',
                        productType: 'vetement',
                        fieldName: 'matieres',
                        required: true,
                        placeholder: 'Ex: Coton, Polyester...'
                    }
                ]
            ]
        },
        
        {
            title: 'Prix',
            icon: 'dollar-sign',
            fields: [
                {
                    field: 'prix',
                    label: 'Prix de base (FCFA)',
                    type: 'number',
                    required: true,
                    placeholder: 'Ex: 15000'
                }
            ]
        }
    ],
    
    variants_enabled: true,  // Gérer couleur/taille/stock
    variants_config: {
        dimensions: ['couleur', 'taille'],
        price_per_variant: true,
        stock_per_variant: true
    },
    
    features: {
        images: true,
        video: false
    }
};

// ═══════════════════════════════════════════════════════════════
// 🎯 MAPPING CATÉGORIE → CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const FORMS_CONFIG_MAP: Record<string, CompleteFormConfig> = {
    'telephone': TELEPHONE_FORM_CONFIG,
    'automobile': AUTOMOBILE_FORM_CONFIG,
    'agriculture': AGRICULTURE_FORM_CONFIG,
    'immobilier': IMMOBILIER_FORM_CONFIG,
    'immobilier_batiment': IMMOBILIER_FORM_CONFIG,
    'vetement': VETEMENT_FORM_CONFIG,
    
    // TODO: Ajouter les 55+ autres catégories progressivement
    // Pour l'instant, utiliser la config générique
};

/**
 * Obtenir la configuration complète d'une catégorie
 * 
 * STRATÉGIE :
 * 1. Si config manuelle existe → utiliser celle-ci (la plus riche)
 * 2. Sinon → générer automatiquement depuis productModalities
 */
export function getCompleteFormConfig(category: string): CompleteFormConfig | null {
    // Essayer config manuelle d'abord
    if (FORMS_CONFIG_MAP[category]) {
        return FORMS_CONFIG_MAP[category];
    }
    
    // Sinon, générer automatiquement
    try {
        const { generateBasicFormConfig } = require('../utils/formConfigExtractor');
        return generateBasicFormConfig(category);
    } catch (error) {
        console.error(`[FormConfig] Erreur génération auto pour ${category}:`, error);
        return null;
    }
}

/**
 * Vérifier si une catégorie a une configuration MANUELLE détaillée
 */
export function hasManualConfig(category: string): boolean {
    return !!FORMS_CONFIG_MAP[category];
}

/**
 * Vérifier si une catégorie a une configuration (manuelle ou auto)
 */
export function hasCompleteConfig(category: string): boolean {
    return hasManualConfig(category) || !!getCompleteFormConfig(category);
}

