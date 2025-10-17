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
}

export interface IAData {
  [key: string]: {
    valeur: any;
    type_donnee: string;
    origine_champs?: string;
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

  // Si aucun composant généré, utiliser les composants par défaut
  if (components.length === 0) {
    console.log('[formDispatcher] Aucun composant généré, utilisation des composants par défaut');
    return generateDefaultComponents();
  }

  console.log('[formDispatcher] Composants générés:', components.length);
  return components;
}

// Créer un composant de formulaire à partir des données IA
function createFieldComponent(fieldName: string, fieldData: any): DynamicField | null {
  const typeDonnee = fieldData.type_donnee || 'string';
  const valeur = fieldData.valeur;

  // Mapping des noms de champs vers des labels français
  const fieldLabels: { [key: string]: string } = {
    titre_service: 'Titre du service',
    category: 'Catégorie',
    description: 'Description',
    is_tarissable: 'Service tarissable',
    whatsapp: 'WhatsApp',
    telephone: 'Téléphone',
    email: 'Email',
    website: 'Site web',
    localisation: 'Localisation',
    prix: 'Prix',
    duree: 'Durée',
    capacite: 'Capacité',
    disponibilite: 'Disponibilité',
    competences: 'Compétences',
    experience: 'Expérience',
    certifications: 'Certifications',
    langues: 'Langues',
    gps_fixe: 'Position GPS fixe'
  };

  const label = fieldLabels[fieldName] || fieldName;

  switch (typeDonnee) {
    case 'string':
      if (fieldName === 'description') {
        return {
          type: 'textarea',
          label,
          name: fieldName,
          placeholder: `Entrez votre ${label.toLowerCase()}`,
          value: valeur || ''
        };
      } else if (fieldName === 'category') {
        return {
          type: 'select',
          label,
          name: fieldName,
          options: ['Informatique', 'Marketing', 'Design', 'Écriture', 'Traduction', 'Autre'],
          value: valeur || ''
        };
      } else {
        return {
          type: 'text',
          label,
          name: fieldName,
          placeholder: `Entrez votre ${label.toLowerCase()}`,
          value: valeur || ''
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
      return {
        type: 'multiselect',
        label,
        name: fieldName,
        options: Array.isArray(valeur) ? valeur : [],
        value: Array.isArray(valeur) ? valeur : []
      };

    default:
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
      label: 'Titre du service',
      name: 'titre_service',
      placeholder: 'Entrez le titre de votre service',
      required: true,
      value: ''
    },
    {
      type: 'select',
      label: 'Catégorie',
      name: 'category',
      options: ['Informatique', 'Marketing', 'Design', 'Écriture', 'Traduction', 'Autre'],
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
      values[fieldName] = fieldData.valeur;
    }
  });

  console.log('[formDispatcher] Valeurs extraites des suggestions:', values);
  return values;
}

