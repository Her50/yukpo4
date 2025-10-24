/**
 * Templates de formulaires pour chaque catégorie de produit
 * Génère automatiquement les bons champs avec modalités quand une catégorie est sélectionnée
 */

import { DynamicField } from './formDispatcher';

export interface ProductFormTemplate {
    category: string;
    fields: DynamicField[];
}

/**
 * Génère les champs de formulaire pour une catégorie de produit donnée
 * Ces champs utilisent automatiquement les modalités de productModalities.ts
 */
export function getProductFormTemplate(category: string): DynamicField[] {
    const normalizedCategory = category?.toLowerCase().trim() || '';

    console.log(`[ProductFormTemplates] Génération template pour: ${normalizedCategory}`);

    switch (normalizedCategory) {
        case 'automobile':
        case 'voiture':
        case 'vehicule':
            return [
                {
                    type: 'text',
                    name: 'nom',
                    label: 'Nom du produit',
                    required: true,
                    placeholder: 'Ex: Toyota Camry 2020'
                },
                {
                    type: 'select',
                    name: 'marques',
                    label: 'Marque',
                    required: true,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la marque'
                },
                {
                    type: 'select',
                    name: 'transmission',
                    label: 'Transmission',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la transmission'
                },
                {
                    type: 'select',
                    name: 'carburant',
                    label: 'Carburant',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le carburant'
                },
                {
                    type: 'select',
                    name: 'etat',
                    label: 'État',
                    required: true,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner l\'état'
                },
                {
                    type: 'select',
                    name: 'couleur',
                    label: 'Couleur',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la couleur'
                },
                {
                    type: 'number',
                    name: 'annee',
                    label: 'Année',
                    required: false,
                    placeholder: 'Ex: 2020'
                },
                {
                    type: 'number',
                    name: 'kilometrage',
                    label: 'Kilométrage (km)',
                    required: false,
                    placeholder: 'Ex: 50000'
                },
                {
                    type: 'number',
                    name: 'prix',
                    label: 'Prix',
                    required: true,
                    placeholder: 'Ex: 5000000'
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: 'Description',
                    required: false,
                    placeholder: 'Décrivez le véhicule...'
                }
            ];

        case 'agroalimentaire':
        case 'agro-alimentaire':
        case 'epicerie':
            return [
                {
                    type: 'text',
                    name: 'nom',
                    label: 'Nom du produit',
                    required: true,
                    placeholder: 'Ex: Riz parfumé Golden'
                },
                {
                    type: 'select',
                    name: 'types',
                    label: 'Type de produit',
                    required: true,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le type'
                },
                {
                    type: 'select',
                    name: 'categories',
                    label: 'Catégorie',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la catégorie'
                },
                {
                    type: 'select',
                    name: 'formats',
                    label: 'Format/Conditionnement',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le format'
                },
                {
                    type: 'select',
                    name: 'marques',
                    label: 'Marque',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la marque'
                },
                {
                    type: 'select',
                    name: 'origines',
                    label: 'Origine',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner l\'origine'
                },
                {
                    type: 'select',
                    name: 'certifications',
                    label: 'Certifications',
                    required: false,
                    multiSelect: true,
                    maxSelections: 5,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner les certifications'
                },
                {
                    type: 'number',
                    name: 'prix',
                    label: 'Prix',
                    required: true,
                    placeholder: 'Ex: 2500'
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: 'Description',
                    required: false,
                    placeholder: 'Décrivez le produit...'
                }
            ];

        case 'vetement':
        case 'vêtement':
        case 'mode':
            return [
                {
                    type: 'text',
                    name: 'nom',
                    label: 'Nom du produit',
                    required: true,
                    placeholder: 'Ex: T-shirt Nike Dri-Fit'
                },
                {
                    type: 'select',
                    name: 'types',
                    label: 'Type de vêtement',
                    required: true,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le type'
                },
                {
                    type: 'select',
                    name: 'tailles',
                    label: 'Tailles disponibles',
                    required: true,
                    multiSelect: true,
                    maxSelections: 10,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner les tailles'
                },
                {
                    type: 'select',
                    name: 'couleurs',
                    label: 'Couleurs disponibles',
                    required: false,
                    multiSelect: true,
                    maxSelections: 10,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner les couleurs'
                },
                {
                    type: 'select',
                    name: 'matieres',
                    label: 'Matière',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la matière'
                },
                {
                    type: 'select',
                    name: 'marques',
                    label: 'Marque',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la marque'
                },
                {
                    type: 'number',
                    name: 'prix',
                    label: 'Prix',
                    required: true,
                    placeholder: 'Ex: 15000'
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: 'Description',
                    required: false,
                    placeholder: 'Décrivez le vêtement...'
                }
            ];

        case 'chaussure':
        case 'soulier':
            return [
                {
                    type: 'text',
                    name: 'nom',
                    label: 'Nom du produit',
                    required: true,
                    placeholder: 'Ex: Nike Air Max 90'
                },
                {
                    type: 'select',
                    name: 'types',
                    label: 'Type de chaussure',
                    required: true,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le type'
                },
                {
                    type: 'select',
                    name: 'pointures',
                    label: 'Pointures disponibles',
                    required: true,
                    multiSelect: true,
                    maxSelections: 15,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner les pointures'
                },
                {
                    type: 'select',
                    name: 'marques',
                    label: 'Marque',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la marque'
                },
                {
                    type: 'select',
                    name: 'materiaux',
                    label: 'Matériau',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le matériau'
                },
                {
                    type: 'number',
                    name: 'prix',
                    label: 'Prix',
                    required: true,
                    placeholder: 'Ex: 45000'
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: 'Description',
                    required: false,
                    placeholder: 'Décrivez la chaussure...'
                }
            ];

        case 'electromenager':
        case 'électroménager':
            return [
                {
                    type: 'text',
                    name: 'nom',
                    label: 'Nom du produit',
                    required: true,
                    placeholder: 'Ex: Réfrigérateur Samsung 350L'
                },
                {
                    type: 'select',
                    name: 'types',
                    label: 'Type d\'appareil',
                    required: true,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le type'
                },
                {
                    type: 'select',
                    name: 'marques',
                    label: 'Marque',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la marque'
                },
                {
                    type: 'select',
                    name: 'classesEnergetiques',
                    label: 'Classe énergétique',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la classe'
                },
                {
                    type: 'select',
                    name: 'etats',
                    label: 'État',
                    required: true,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner l\'état'
                },
                {
                    type: 'number',
                    name: 'prix',
                    label: 'Prix',
                    required: true,
                    placeholder: 'Ex: 250000'
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: 'Description',
                    required: false,
                    placeholder: 'Décrivez l\'appareil...'
                }
            ];

        case 'telephone':
        case 'téléphone':
        case 'smartphone':
            return [
                {
                    type: 'text',
                    name: 'nom',
                    label: 'Nom du produit',
                    required: true,
                    placeholder: 'Ex: iPhone 14 Pro Max'
                },
                {
                    type: 'select',
                    name: 'marques',
                    label: 'Marque',
                    required: true,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la marque'
                },
                {
                    type: 'select',
                    name: 'stockage',
                    label: 'Capacité de stockage',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le stockage'
                },
                {
                    type: 'select',
                    name: 'ram',
                    label: 'Mémoire RAM',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la RAM'
                },
                {
                    type: 'select',
                    name: 'couleurs',
                    label: 'Couleurs disponibles',
                    required: false,
                    multiSelect: true,
                    maxSelections: 5,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner les couleurs'
                },
                {
                    type: 'select',
                    name: 'etats',
                    label: 'État',
                    required: true,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner l\'état'
                },
                {
                    type: 'number',
                    name: 'prix',
                    label: 'Prix',
                    required: true,
                    placeholder: 'Ex: 650000'
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: 'Description',
                    required: false,
                    placeholder: 'Décrivez le téléphone...'
                }
            ];

        case 'ordinateur':
        case 'pc':
        case 'laptop':
            return [
                {
                    type: 'text',
                    name: 'nom',
                    label: 'Nom du produit',
                    required: true,
                    placeholder: 'Ex: MacBook Pro 16" M3'
                },
                {
                    type: 'select',
                    name: 'types',
                    label: 'Type d\'ordinateur',
                    required: true,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le type'
                },
                {
                    type: 'select',
                    name: 'marques',
                    label: 'Marque',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la marque'
                },
                {
                    type: 'select',
                    name: 'processeurs',
                    label: 'Processeur',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le processeur'
                },
                {
                    type: 'select',
                    name: 'ram',
                    label: 'Mémoire RAM',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la RAM'
                },
                {
                    type: 'select',
                    name: 'stockage',
                    label: 'Stockage',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner le stockage'
                },
                {
                    type: 'select',
                    name: 'cartesGraphiques',
                    label: 'Carte graphique',
                    required: false,
                    multiSelect: false,
                    allowCustomModality: true,
                    placeholder: 'Sélectionner la carte graphique'
                },
                {
                    type: 'number',
                    name: 'prix',
                    label: 'Prix',
                    required: true,
                    placeholder: 'Ex: 1200000'
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: 'Description',
                    required: false,
                    placeholder: 'Décrivez l\'ordinateur...'
                }
            ];

        // Template par défaut pour les catégories non définies
        default:
            console.log(`[ProductFormTemplates] Catégorie non reconnue: ${normalizedCategory}, template par défaut`);
            return [
                {
                    type: 'text',
                    name: 'nom',
                    label: 'Nom du produit',
                    required: true,
                    placeholder: 'Ex: Mon produit'
                },
                {
                    type: 'number',
                    name: 'prix',
                    label: 'Prix',
                    required: true,
                    placeholder: 'Ex: 10000'
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: 'Description',
                    required: false,
                    placeholder: 'Décrivez le produit...'
                }
            ];
    }
}

/**
 * Liste de toutes les catégories supportées
 */
export const SUPPORTED_CATEGORIES = [
    'automobile',
    'agroalimentaire',
    'vetement',
    'chaussure',
    'electromenager',
    'telephone',
    'ordinateur',
    // Ajoutez d'autres catégories au fur et à mesure
];

/**
 * Vérifie si une catégorie a un template dédié
 */
export function hasProductTemplate(category: string): boolean {
    const normalized = category?.toLowerCase().trim() || '';
    return SUPPORTED_CATEGORIES.some(cat => normalized.includes(cat) || cat.includes(normalized));
}

