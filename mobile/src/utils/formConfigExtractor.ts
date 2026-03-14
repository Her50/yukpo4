/**
 * 🔧 EXTRACTEUR AUTOMATIQUE DE CONFIGURATION DE FORMULAIRE
 * 
 * Ce système analyse ProductManagerMobile.tsx et extrait automatiquement
 * la structure des formulaires existants pour générer les configurations.
 */

import { CompleteFormConfig, FieldConfig, FormSection } from '../config/completeFormsConfig';
import { getModalitiesByProductType } from '../data/productModalities';
import { categoryAnalyzer } from './categoryAnalyzer';

/**
 * Générer automatiquement une configuration de base pour une catégorie
 * en se basant sur productModalities
 */
export function generateBasicFormConfig(category: string): CompleteFormConfig {
    // Analyser la catégorie
    const analysis = categoryAnalyzer.analyzeCategory(category);
    const modalities = getModalitiesByProductType(category);

    const sections: FormSection[] = [];

    // ═══ SECTION 1 : Informations générales (toujours) ═══
    const generalFields: FieldConfig[] = [];

    // Champs fixes déjà remplis automatiquement
    const auto_filled_fields = analysis.fixed_fields;

    // ═══ SECTION 2 : Caractéristiques principales ═══
    const mainFields: Array<FieldConfig | FieldConfig[]> = [];

    // Grouper les champs par paires pour layout 2 colonnes
    const allFields = Object.keys(modalities);
    const requiredFields = analysis.required_fields;
    const conditionalFields = analysis.conditional_fields;

    // Détecter les paires logiques (marque/modèle, etc.)
    const fieldPairs: Array<[string, string]> = [];

    if (allFields.includes('marque') && allFields.includes('modele')) {
        fieldPairs.push(['marque', 'modele']);
    }
    if (allFields.includes('type') && allFields.includes('etat')) {
        fieldPairs.push(['type', 'etat']);
    }
    if (allFields.includes('couleur') && allFields.includes('taille')) {
        fieldPairs.push(['couleur', 'taille']);
    }

    // Construire les champs par paires
    const usedFields = new Set<string>();

    for (const [field1, field2] of fieldPairs) {
        const pair: FieldConfig[] = [];

        if (allFields.includes(field1)) {
            pair.push(createFieldConfig(category, field1, modalities, undefined, requiredFields, conditionalFields));
            usedFields.add(field1);
        }

        if (allFields.includes(field2)) {
            pair.push(createFieldConfig(category, field2, modalities, conditionalFields.includes(field2) ? field1 : undefined, requiredFields, conditionalFields));
            usedFields.add(field2);
        }

        if (pair.length > 0) {
            mainFields.push(pair);
        }
    }

    // Ajouter les champs restants (non appariés)
    for (const field of allFields) {
        if (usedFields.has(field)) continue;
        if (Object.keys(auto_filled_fields).includes(field)) continue;  // Déjà auto-rempli

        const fieldConfig = createFieldConfig(category, field, modalities, undefined, requiredFields, conditionalFields);
        mainFields.push(fieldConfig);
    }

    // Créer la section principale
    if (mainFields.length > 0) {
        sections.push({
            title: getCategorySectionTitle(category),
            icon: getCategoryIcon(category),
            fields: mainFields,
            hints: getCategoryHints(category)
        });
    }

    // ═══ SECTION PRIX (toujours à la fin) ═══
    if (allFields.includes('prix') || allFields.includes('prixUnitaire')) {
        sections.push({
            title: 'Prix',
            icon: 'dollar-sign',
            fields: [
                {
                    field: 'prix',
                    label: getPriceLabel(category),
                    type: 'number',
                    required: true,
                    placeholder: getPricePlaceholder(category),
                    validation: {
                        min: 100,
                        max: 1000000000
                    }
                }
            ],
            hints: [
                {
                    text: '💰 Consultez les prix du marché pour rester compétitif',
                    icon: 'trending-up'
                }
            ]
        });
    }

    return {
        category,
        title: formatCategoryTitle(category),
        auto_filled_fields,
        sections,
        variants_enabled: shouldEnableVariants(category),
        features: detectFeatures(category)
    };
}

/**
 * Créer une configuration de champ automatiquement
 */
function createFieldConfig(
    category: string,
    fieldName: string,
    modalities: any,
    dependsOn: string | undefined,
    requiredFields: string[],
    conditionalFields: string[]
): FieldConfig {
    const fieldData = modalities[fieldName];
    const isRequired = requiredFields.includes(fieldName);

    // Déterminer le type de champ
    let type: FieldConfig['type'] = 'text';

    // Champs spéciaux
    if (fieldName.includes('modele') && dependsOn) {
        if (category === 'telephone') type = 'smart_phone_model';
        else if (category === 'automobile') type = 'vehicle_model';
        else type = 'select';
    } else if (fieldName.includes('gps') || fieldName === 'localisation') {
        type = 'gps';
    } else if (fieldName.includes('ville') || fieldName.includes('quartier')) {
        type = 'location_selector';
    } else if (Array.isArray(fieldData)) {
        // Si les options sont un tableau
        if (fieldName.includes('prix') || fieldName.includes('quantite') || fieldName.includes('superficie')) {
            type = 'number';
        } else if (fieldData.length > 1 && !fieldName.includes('etat') && !fieldName.includes('type')) {
            type = 'multiselect';  // Par défaut, multi-sélection si plusieurs options
        } else {
            type = 'select';
        }
    } else if (fieldName.includes('date')) {
        type = 'date';
    } else if (fieldName.includes('heure') || fieldName.includes('time')) {
        type = 'time';
    } else if (fieldName.includes('prix') || fieldName.includes('quantite') || fieldName.includes('annee') ||
        fieldName.includes('nombre') || fieldName.includes('superficie') || fieldName.includes('kilometrage')) {
        type = 'number';
    }

    return {
        field: fieldName,
        label: formatFieldLabel(fieldName),
        type,
        required: isRequired,
        placeholder: generatePlaceholder(fieldName, type),
        productType: Array.isArray(fieldData) ? category : undefined,
        fieldName: Array.isArray(fieldData) ? fieldName : undefined,
        depends_on: dependsOn,
        reset_when_depends_changes: !!dependsOn
    };
}

/**
 * Formater le label d'un champ
 */
function formatFieldLabel(fieldName: string): string {
    // Mapping des champs connus
    const knownLabels: Record<string, string> = {
        'marqueTelephone': 'Marque',
        'modeleTelephone': 'Modèle',
        'marqueAutomobile': 'Marque',
        'modeleAutomobile': 'Modèle',
        'typeVehicule': 'Type de véhicule',
        'typeCarrosserie': 'Carrosserie',
        'typeCarburant': 'Carburant',
        'etatTelephone': 'État',
        'etatVehicule': 'État',
        'couleurAutomobile': 'Couleur',
        'prixUnitaire': 'Prix unitaire',
        'nbPortes': 'Nombre de portes',
        'nbPlaces': 'Nombre de places',
        'nbChambres': 'Nombre de chambres',
        'gpsImmobilier': 'Localisation GPS'
    };

    if (knownLabels[fieldName]) {
        return knownLabels[fieldName];
    }

    // Formater automatiquement (snake_case → Title Case)
    return fieldName
        .replace(/([A-Z])/g, ' $1')  // camelCase → spaces
        .replace(/_/g, ' ')           // snake_case → spaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim();
}

/**
 * Générer un placeholder automatique
 */
function generatePlaceholder(fieldName: string, type: string): string {
    if (type === 'number') {
        if (fieldName.includes('prix')) return 'Ex: 150000';
        if (fieldName.includes('quantite')) return 'Ex: 10';
        if (fieldName.includes('annee')) return `Ex: ${new Date().getFullYear()}`;
        if (fieldName.includes('kilometrage')) return 'Ex: 65000';
        return 'Entrez un nombre';
    }

    if (type === 'gps') return 'Ajouter la localisation GPS';
    if (type === 'date') return 'Sélectionner une date';
    if (type === 'time') return 'Sélectionner l\'heure';

    return `Sélectionnez ${formatFieldLabel(fieldName).toLowerCase()}`;
}

/**
 * Titre de la section principale selon catégorie
 */
function getCategorySectionTitle(category: string): string {
    const titles: Record<string, string> = {
        'telephone': 'Caractéristiques du smartphone',
        'automobile': 'Informations du véhicule',
        'agriculture': 'Détails du produit',
        'immobilier': 'Informations du bien',
        'vetement': 'Détails du vêtement',
        'electromenager': 'Caractéristiques de l\'appareil',
        'ordinateur': 'Spécifications techniques'
    };

    return titles[category] || 'Informations du produit';
}

/**
 * Icône selon catégorie
 */
function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
        'telephone': 'smartphone',
        'automobile': 'car',
        'agriculture': 'package',
        'immobilier': 'home',
        'vetement': 'shopping-bag',
        'electromenager': 'zap',
        'ordinateur': 'monitor',
        'moto': 'bike',
        'emploi': 'briefcase',
        'formation': 'book'
    };

    return icons[category] || 'box';
}

/**
 * Hints contextuels selon catégorie
 */
function getCategoryHints(category: string): Array<{ text: string; icon: string }> {
    const hints: Record<string, Array<{ text: string; icon: string }>> = {
        'telephone': [
            { text: '💡 Téléphones débloqués : +30% de visibilité', icon: 'info' }
        ],
        'automobile': [
            { text: '🚗 Véhicule dédouané = vente plus rapide', icon: 'check-circle' }
        ],
        'agriculture': [
            { text: '🌾 Précisez la variété pour les grossistes', icon: 'trending-up' }
        ],
        'immobilier': [
            { text: '📍 GPS = +60% de visibilité', icon: 'map-pin' }
        ]
    };

    return hints[category] || [];
}

/**
 * Label prix selon catégorie
 */
function getPriceLabel(category: string): string {
    const labels: Record<string, string> = {
        'agriculture': 'Prix par sac (FCFA)',
        'immobilier': 'Prix / Loyer (FCFA)',
        'emploi': 'Salaire (FCFA)',
        'formation': 'Tarif (FCFA)'
    };

    return labels[category] || 'Prix (FCFA)';
}

/**
 * Placeholder prix selon catégorie
 */
function getPricePlaceholder(category: string): string {
    const placeholders: Record<string, string> = {
        'telephone': 'Ex: 150000',
        'automobile': 'Ex: 3500000',
        'agriculture': 'Ex: 25000',
        'immobilier': 'Ex: 25000000',
        'vetement': 'Ex: 15000'
    };

    return placeholders[category] || 'Ex: 50000';
}

/**
 * Formater le titre de la catégorie
 */
function formatCategoryTitle(category: string): string {
    const titles: Record<string, string> = {
        'telephone': 'Vente de téléphone',
        'automobile': 'Vente de véhicule',
        'agriculture': 'Vente de produit agricole',
        'immobilier': 'Vente/Location immobilière',
        'vetement': 'Vente de vêtement',
        'emploi': 'Offre d\'emploi',
        'formation': 'Formation'
    };

    return titles[category] || `Vente de ${category}`;
}

/**
 * Déterminer si les variantes doivent être activées
 */
function shouldEnableVariants(category: string): boolean {
    const variantsCategories = [
        'telephone',
        'vetement',
        'chaussure',
        'electromenager',
        'ordinateur',
        'cosmetic_parfum',
        'bijoux'
    ];

    return variantsCategories.includes(category);
}

/**
 * Détecter les fonctionnalités nécessaires
 */
function detectFeatures(category: string): CompleteFormConfig['features'] {
    const features: CompleteFormConfig['features'] = {
        images: true  // Toujours activé
    };

    // GPS pour immobilier, terrain, agriculture, etc.
    const gpsCategories = [
        'immobilier',
        'immobilier_batiment',
        'immobilier_terrain',
        'agriculture',
        'automobile',
        'hotel',
        'restaurant'
    ];
    features.gps = gpsCategories.includes(category);

    // Documents pour automobile, immobilier
    const docCategories = ['automobile', 'immobilier', 'immobilier_batiment'];
    features.documents = docCategories.includes(category);

    // Vidéo pour automobile, immobilier
    const videoCategories = ['automobile', 'immobilier', 'hotel'];
    features.video = videoCategories.includes(category);

    return features;
}

/**
 * Obtenir la liste de TOUTES les catégories disponibles
 */
export function getAllAvailableCategories(): string[] {
    // Ces catégories viennent de votre productModalities.ts
    return [
        'telephone',
        'automobile',
        'moto',
        'tricycle',
        'velo',
        'ordinateur',
        'tablette',
        'electromenager',
        'meuble',
        'vetement',
        'chaussure',
        'bijoux',
        'cosmetic_parfum',
        'sante_beaute',
        'agriculture',
        'elevage',
        'peche',
        'immobilier',
        'immobilier_batiment',
        'immobilier_terrain',
        'hotel',
        'restaurant',
        'bar',
        'emploi',
        'formation',
        'stage',
        'sante',
        'education',
        'transport',
        'demenagement',
        'nettoyage_entretien',
        'reparation',
        'construction',
        'menuiserie',
        'plomberie',
        'electricite',
        'peinture',
        'jardinage',
        'couture',
        'coiffure',
        'esthetique',
        'photographie',
        'videographie',
        'graphisme',
        'developpement_web',
        'marketing_digital',
        'comptabilite',
        'juridique',
        'traduction',
        'cours_particuliers',
        'musique',
        'sport',
        'evenementiel',
        'securite',
        'assurance',
        'banque',
        'credit',
        'voyage',
        'tourisme'
        // ... et 10+ autres
    ];
}

