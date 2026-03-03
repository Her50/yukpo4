// Utils pour traiter les suggestions IA et générer les composants de formulaire
// Adaptation mobile de dispatchChampsFormulaireIA du frontend

export interface DynamicField {
  type: string;
  label: string;
  name: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  value?: any;
  // ✅ AJOUT: Support pour les sélections multiples et modalités personnalisées
  multiSelect?: boolean;
  allowMultiple?: boolean;
  maxSelections?: number;
  allowCustomModality?: boolean; // Permet d'ajouter de nouvelles modalités
  // ✅ NOUVEAU: Support pour les nouveaux types
  typeDonnee?: string; // 'autocomplete', 'price_variant', 'date', 'location'
  // Pour textarea
  multiline?: boolean;
  minLines?: number;
  // Pour champs spéciaux
  isStructureName?: boolean;
  hint?: string;
  // Pour autocomplete
  separateur?: string;
  sousCaracteristiques?: { [key: string]: string[] };
  identifiantBase?: string;
  filtrable?: boolean;
  // Pour price_variant
  variable?: string;
  modalites?: Array<{
    valeur: string;
    prix: number;
    devise: string;
    stock?: number;
  }>;
  // Pour location
  composants?: { [key: string]: string };
}

export interface IAData {
  [key: string]: {
    valeur: any;
    type_donnee: string;
    origine_champs?: string;
    // ✅ NOUVEAU: Champs pour autocomplete
    separateur?: string;
    sous_caracteristiques?: { [key: string]: string[] };
    identifiant_base?: string;
    filtrable?: boolean;
    // ✅ NOUVEAU: Champs pour price_variant
    variable?: string;
    modalites?: Array<{
      valeur: string;
      prix: number;
      devise: string;
      stock?: number;
    }>;
    // ✅ NOUVEAU: Champs pour date
    format?: string;
    // ✅ NOUVEAU: Champs pour location
    composants?: { [key: string]: string };
  };
}

export interface IASuggestion {
  intention?: string;
  data?: IAData;
  confidence?: number;
  tokens_consumed?: number;
}

// Fonction pour convertir les données IA en composants de formulaire mobile (comme le frontend)
export function processIASuggestion(suggestion: IASuggestion): DynamicField[] {
  console.log('[formDispatcher] Traitement des suggestions IA:', suggestion);

  if (!suggestion.data) {
    console.log('[formDispatcher] Aucune donnée IA, génération des composants par défaut');
    return generateDefaultComponents();
  }

  const components: DynamicField[] = [];
  const data = suggestion.data;

  console.log('[formDispatcher] Données IA reçues:', data);
  console.log('[formDispatcher] Clés des données:', Object.keys(data));

  // Traiter chaque champ des données IA (comme le frontend)
  Object.keys(data).forEach(fieldName => {
    console.log(`[formDispatcher] Traitement du champ: ${fieldName}`);

    const fieldData = data[fieldName];
    console.log(`[formDispatcher] Données du champ ${fieldName}:`, fieldData);

    // Vérifier que c'est un objet avec type_donnee (comme le frontend)
    if (fieldData && typeof fieldData === 'object' && 'type_donnee' in fieldData) {
      console.log(`[formDispatcher] Champ ${fieldName} valide, création du composant`);

      const component = createFieldComponent(fieldName, fieldData);
      if (component) {
        console.log(`[formDispatcher] Composant créé pour ${fieldName}:`, component);
        components.push(component);
      }
    } else {
      console.log(`[formDispatcher] Champ ${fieldName} ignoré - pas de type_donnee`);
    }
  });

  // ✅ NOUVEAU 2025-11-04 : Ajouter les champs produit de base s'ils ne sont pas déjà créés par l'IA
  // Ceci garantit que les champs nom_produit, categorie_produit, description_produit existent TOUJOURS
  const hasNomProduit = components.some(c => c.name === 'nom_produit');
  const hasCategorieProduit = components.some(c => c.name === 'categorie_produit');
  const hasDescriptionProduit = components.some(c => c.name === 'description_produit');

  if (!hasNomProduit) {
    // Fallback: utiliser titre_service si nom_produit n'existe pas
    const titreValue = data.titre_service?.valeur || '';
    components.push({
      type: 'text',
      label: 'Nom du produit/prestation',
      name: 'nom_produit',
      placeholder: 'Ex: iPhone 14 Pro Max, Cours de mathématiques...',
      value: titreValue,
      required: false
    });
    console.log('[formDispatcher] ✅ Champ nom_produit créé automatiquement (fallback titre_service)');
  }

  if (!hasCategorieProduit) {
    // Fallback: utiliser category si categorie_produit n'existe pas
    const categoryValue = data.category?.valeur || '';
    components.push({
      type: 'text',
      label: 'Catégorie du produit/prestation',
      name: 'categorie_produit',
      placeholder: 'Ex: Smartphone, Cours particulier...',
      value: categoryValue,
      required: false
    });
    console.log('[formDispatcher] ✅ Champ categorie_produit créé automatiquement (fallback category)');
  }

  if (!hasDescriptionProduit) {
    // Fallback: utiliser description si description_produit n'existe pas
    const descriptionValue = data.description?.valeur || '';
    components.push({
      type: 'textarea',
      label: 'Description du produit/prestation',
      name: 'description_produit',
      placeholder: 'Décrivez les caractéristiques spécifiques...',
      value: descriptionValue,
      required: false
    });
    console.log('[formDispatcher] ✅ Champ description_produit créé automatiquement (fallback description)');
  }

  // Si aucun composant généré, utiliser les composants par défaut
  if (components.length === 0) {
    console.log('[formDispatcher] Aucun composant généré, utilisation des composants par défaut');
    return generateDefaultComponents();
  }

  console.log('[formDispatcher] Composants générés:', components.length);
  return components;
}

// ✅ NOUVEAU: Liste des champs qui doivent être en multi-select par défaut
const MULTI_SELECT_FIELDS = [
  'couleurs', 'couleur', 'colors', 'color',
  'tailles', 'taille', 'sizes', 'size',
  'materiaux', 'materiau', 'materials', 'material',
  'modalites_paiement', 'payment_methods', 'moyens_paiement',
  'modalites_livraison', 'delivery_methods', 'modes_livraison',
  'caractéristiques', 'caracteristiques', 'features',
  'types', 'type', 'categories_produit',
  'marques', 'marque', 'brands', 'brand',
  'styles', 'style',
  'capacites', 'capacite', 'capacities',
  'garanties', 'garantie', 'warranties',
  'certifications', 'certification',
  'competences', 'skills',
  'langues', 'langue', 'languages',
  'services_inclus', 'included_services',
  'options', 'option',
  'finitions', 'finition', 'finishes',
  'parfums', 'parfum', 'fragrances',
  'saveurs', 'saveur', 'flavors'
];

// Vérifier si un champ doit être en multi-select
function shouldBeMultiSelect(fieldName: string): boolean {
  const normalizedName = fieldName.toLowerCase().trim();
  return MULTI_SELECT_FIELDS.some(pattern =>
    normalizedName.includes(pattern) || pattern.includes(normalizedName)
  );
}

// Créer un composant de formulaire à partir des données IA
function createFieldComponent(fieldName: string, fieldData: any): DynamicField | null {
  const typeDonnee = fieldData.type_donnee || 'string';
  const valeur = fieldData.valeur;
  const isMultiSelectField = shouldBeMultiSelect(fieldName);

  console.log(`[formDispatcher] Création champ ${fieldName}: type=${typeDonnee}, isMultiSelect=${isMultiSelectField}, valeur=`, valeur);

  // Mapping des noms de champs vers des labels français
  const fieldLabels: { [key: string]: string } = {
    titre_service: 'Nom de votre structure',
    category: 'Catégorie',
    description: 'Description',
    is_tarissable: 'Service tarissable',
    whatsapp: 'WhatsApp',
    telephone: 'Téléphone',
    email: 'Email',
    website: 'Site web',
    adresse: 'Adresse',
    horaires: 'Horaires',
    localisation: 'Localisation',
    prix: 'Prix',
    duree: 'Durée',
    capacite: 'Capacité',
    disponibilite: 'Disponibilité',
    competences: 'Compétences',
    experience: 'Expérience',
    certifications: 'Certifications',
    langues: 'Langues',
    gps_fixe: 'Position GPS fixe',
    nom_produit: 'Nom du produit/prestation',
    categorie_produit: 'Catégorie du produit/prestation',
    description_produit: 'Description du produit/prestation',
    prix_produit: 'Prix du produit/prestation',
    devise_produit: 'Devise'
  };

  // ✅ CORRECTION: S'assurer que le label est toujours une string valide (éviter "HORAIRES FALSE")
  const label = String(fieldLabels[fieldName] || fieldName).trim();

  switch (typeDonnee) {
    // ✅ NOUVEAU: Type autocomplete
    case 'autocomplete':
      return {
        type: 'autocomplete',
        label,
        name: fieldName,
        typeDonnee: 'autocomplete',
        value: Array.isArray(valeur) ? valeur : [],
        separateur: fieldData.separateur || ',',
        sousCaracteristiques: fieldData.sous_caracteristiques || {},
        identifiantBase: fieldData.identifiant_base || fieldName,
        filtrable: fieldData.filtrable !== false, // true par défaut
        allowCustomModality: true,
        required: false
      };

    // ✅ NOUVEAU: Type price_variant
    case 'price_variant':
      return {
        type: 'price_variant',
        label,
        name: fieldName,
        typeDonnee: 'price_variant',
        variable: fieldData.variable || 'variante',
        modalites: Array.isArray(fieldData.modalites) ? fieldData.modalites : [],
        filtrable: fieldData.filtrable !== false, // true par défaut
        value: Array.isArray(fieldData.modalites) ? fieldData.modalites : [],
        required: false
      };

    // ✅ NOUVEAU: Type date
    case 'date':
      return {
        type: 'date',
        label,
        name: fieldName,
        typeDonnee: 'date',
        value: valeur || '',
        placeholder: 'YYYY-MM-DD',
        required: false
      };

    // ✅ NOUVEAU: Type location
    case 'location':
      // Détecter si c'est un champ de type lieu/adresse/localisation
      const isLocationField = /lieu|adresse|localisation|ville|quartier|destination|depart|arrivee/i.test(fieldName);
      return {
        type: 'location',
        label,
        name: fieldName,
        typeDonnee: 'location',
        value: valeur || '',
        composants: fieldData.composants || {},
        filtrable: fieldData.filtrable !== false, // true par défaut
        placeholder: isLocationField ? 'Sélectionner un lieu' : `Entrez votre ${label.toLowerCase()}`,
        required: false
      };

    case 'string':
      // ✅ NOUVEAU: Détecter les champs lieu même avec type string
      if (/lieu|adresse|localisation|ville|quartier|destination|depart|arrivee/i.test(fieldName)) {
        return {
          type: 'location',
          label,
          name: fieldName,
          typeDonnee: 'location',
          value: valeur || '',
          composants: {},
          filtrable: true,
          placeholder: 'Sélectionner un lieu',
          required: false
        };
      }

      if (fieldName === 'description') {
        return {
          type: 'textarea',
          label,
          name: fieldName,
          placeholder: `Entrez votre ${label.toLowerCase()}`,
          value: valeur || ''
        };
      } else {
        // ✅ CORRECTION : Traiter category comme un simple champ texte
        // On récupère juste la valeur du backend sans liste de sélection
        // ✅ CORRIGÉ 2026-03-03: titre_service ne doit JAMAIS être pré-rempli par l'IA
        // L'utilisateur DOIT saisir lui-même le vrai nom de sa structure
        const isTitreService = fieldName === 'titre_service';
        return {
          type: 'text',
          label,
          name: fieldName,
          placeholder: isTitreService ? 'Ex: Restaurant Le Gourmet, Boutique XYZ...' : `Entrez votre ${label.toLowerCase()}`,
          required: fieldName === 'category' || isTitreService,
          value: isTitreService ? '' : (valeur || ''), // ✅ FORCÉ vide pour titre_service
          ...(isTitreService && {
            isStructureName: true,
            hint: 'Indiquez le nom officiel de votre structure (boutique, entreprise, prestation). Ce nom sera visible par tous les clients.'
          })
        };
      }

    case 'boolean':
      return {
        type: 'checkbox',
        label,
        name: fieldName,
        value: valeur || false
      };

    case 'number':
      return {
        type: 'number',
        label,
        name: fieldName,
        placeholder: `Entrez votre ${label.toLowerCase()}`,
        value: valeur || ''
      };

    case 'array':
      // ✅ Champ de type array = toujours multi-select avec modalités personnalisées
      return {
        type: 'select',
        label,
        name: fieldName,
        options: Array.isArray(valeur) ? valeur : [],
        value: Array.isArray(valeur) ? valeur : [],
        multiSelect: true,
        allowMultiple: true,
        allowCustomModality: true,
        maxSelections: 20 // Par défaut, permettre jusqu'à 20 sélections
      };

    case 'select':
    case 'dropdown':
      // ✅ Champ select avec détection automatique du multi-select
      const options = fieldData.options || [];
      return {
        type: 'select',
        label,
        name: fieldName,
        options: Array.isArray(options) ? options : [],
        value: isMultiSelectField && !Array.isArray(valeur) ? [valeur] : (valeur || (isMultiSelectField ? [] : '')),
        multiSelect: isMultiSelectField,
        allowMultiple: isMultiSelectField,
        allowCustomModality: true, // Toujours permettre d'ajouter des modalités
        maxSelections: isMultiSelectField ? 20 : 1
      };

    default:
      // ✅ Pour les champs string qui devraient être multi-select
      if (isMultiSelectField) {
        return {
          type: 'select',
          label,
          name: fieldName,
          options: Array.isArray(valeur) ? valeur : [],
          value: Array.isArray(valeur) ? valeur : (valeur ? [valeur] : []),
          multiSelect: true,
          allowMultiple: true,
          allowCustomModality: true,
          maxSelections: 20
        };
      }

      return {
        type: 'text',
        label,
        name: fieldName,
        placeholder: `Entrez votre ${label.toLowerCase()}`,
        value: valeur || ''
      };
  }
}

// Générer les composants par défaut si aucune suggestion IA
function generateDefaultComponents(): DynamicField[] {
  return [
    {
      type: 'text',
      label: 'Nom de votre structure',
      name: 'titre_service',
      placeholder: 'Ex: Restaurant Le Gourmet, Boutique XYZ...',
      required: true,
      isStructureName: true,
      hint: 'Indiquez le nom officiel de votre structure (boutique, entreprise, prestation). Ce nom sera visible par tous les clients.',
      value: ''
    },
    {
      // ✅ CORRECTION : category est maintenant un simple champ texte
      type: 'text',
      label: 'Catégorie',
      name: 'category',
      placeholder: 'Ex: Restauration, Technologie, Santé...',
      required: true,
      value: ''
    },
    {
      type: 'textarea',
      label: 'Description',
      name: 'description',
      placeholder: 'Décrivez votre service en détail',
      required: true,
      value: ''
    },
    {
      type: 'checkbox',
      label: 'Service tarissable',
      name: 'is_tarissable',
      value: true
    },
    {
      type: 'text',
      label: 'WhatsApp',
      name: 'whatsapp',
      placeholder: '+237 6XX XX XX XX',
      value: ''
    },
    {
      type: 'text',
      label: 'Téléphone',
      name: 'telephone',
      placeholder: '+237 6XX XX XX XX',
      value: ''
    },
    {
      type: 'text',
      label: 'Email',
      name: 'email',
      placeholder: 'votre@email.com',
      value: ''
    },
    {
      type: 'text',
      label: 'Site web',
      name: 'website',
      placeholder: 'https://votre-site.com',
      value: ''
    }
  ];
}

// Extraire les valeurs des suggestions pour pré-remplir le formulaire
export function extractSuggestionValues(suggestion: IASuggestion): Record<string, any> {
  const values: Record<string, any> = {};

  if (!suggestion.data) {
    return values;
  }

  Object.keys(suggestion.data).forEach(fieldName => {
    const fieldData = suggestion.data![fieldName];
    if (fieldData && typeof fieldData === 'object' && 'valeur' in fieldData) {
      const typeDonnee = fieldData.type_donnee || 'string';

      // ✅ NOUVEAU: Gestion spéciale pour les nouveaux types
      switch (typeDonnee) {
        case 'autocomplete':
          // Pour autocomplete, garder toute la structure
          values[fieldName] = {
            type_donnee: 'autocomplete',
            valeur: fieldData.valeur,
            separateur: fieldData.separateur || ',',
            sous_caracteristiques: fieldData.sous_caracteristiques || {},
            identifiant_base: fieldData.identifiant_base || fieldName,
            filtrable: fieldData.filtrable !== false,
            origine_champs: fieldData.origine_champs || 'ia'
          };
          break;

        case 'price_variant':
          // Pour price_variant, garder toute la structure
          values[fieldName] = {
            type_donnee: 'price_variant',
            variable: fieldData.variable || 'variante',
            modalites: Array.isArray(fieldData.modalites) ? fieldData.modalites : [],
            filtrable: fieldData.filtrable !== false,
            origine_champs: fieldData.origine_champs || 'ia'
          };
          break;

        case 'date':
          // Pour date, garder valeur et format
          values[fieldName] = {
            type_donnee: 'date',
            valeur: fieldData.valeur || '',
            format: fieldData.format || 'YYYY-MM-DD',
            origine_champs: fieldData.origine_champs || 'ia'
          };
          break;

        case 'location':
          // Pour location, garder valeur et composants
          values[fieldName] = {
            type_donnee: 'location',
            valeur: fieldData.valeur || '',
            composants: fieldData.composants || {},
            filtrable: fieldData.filtrable !== false,
            origine_champs: fieldData.origine_champs || 'ia'
          };
          break;

        default:
          // Pour les autres types, juste la valeur
          values[fieldName] = fieldData.valeur;
          break;
      }
    }
  });

  console.log('[formDispatcher] Valeurs extraites des suggestions:', values);
  return values;
}

