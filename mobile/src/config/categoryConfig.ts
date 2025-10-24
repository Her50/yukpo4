/**
 * Configuration intelligente des catégories de produits
 * Ce fichier définit la terminologie, les filtres, et les styles pour chaque catégorie
 */

export interface CategoryFilter {
  id: string;
  label: string;
  type: 'range' | 'select' | 'multiselect' | 'toggle' | 'date' | 'time';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
}

export interface CategoryTerminology {
  productLabel: string; // Ex: "Bien immobilier", "Véhicule", "Article"
  productsLabel: string; // Ex: "Biens immobiliers", "Véhicules", "Articles"
  priceLabel: string; // Ex: "Loyer", "Prix", "Tarif"
  locationLabel: string; // Ex: "Quartier", "Localisation", "Adresse"
  providerLabel: string; // Ex: "Propriétaire", "Vendeur", "Prestataire"
  searchPlaceholder: string;
  emptyMessage: string;
  sortLabels: {
    relevance: string;
    price_asc: string;
    price_desc: string;
    distance: string;
    date?: string;
  };
}

export interface CategoryStyle {
  primaryColor: string;
  gradientColors: string[];
  icon: string;
  badgeColor: string;
  accentColor: string;
}

export interface CategoryConfig {
  terminology: CategoryTerminology;
  filters: CategoryFilter[];
  style: CategoryStyle;
  displayPriority: string[]; // Ordre d'affichage des informations importantes
  contactMethods: ('whatsapp' | 'phone' | 'message' | 'email')[];
  showDistance: boolean;
  showRating: boolean;
  cardLayout: 'horizontal' | 'vertical' | 'grid';
}

// Configuration par catégorie
export const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  // 🏢 IMMOBILIER - BÂTIMENTS
  immobilier_batiment: {
    terminology: {
      productLabel: 'Bien immobilier',
      productsLabel: 'Biens immobiliers',
      priceLabel: 'Prix/Loyer',
      locationLabel: 'Quartier',
      providerLabel: 'Propriétaire',
      searchPlaceholder: 'Rechercher un appartement, villa...',
      emptyMessage: 'Aucun bien immobilier trouvé dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'statutImmobilier',
        label: 'Statut',
        type: 'select',
        options: [
          { value: 'vente', label: 'À vendre' },
          { value: 'location', label: 'À louer' },
          { value: 'colocation', label: 'Colocation' },
        ],
      },
      {
        id: 'typeImmobilier',
        label: 'Type de bien',
        type: 'select',
        options: [
          { value: 'appartement', label: 'Appartement' },
          { value: 'villa', label: 'Villa' },
          { value: 'studio', label: 'Studio' },
          { value: 'duplex', label: 'Duplex' },
          { value: 'immeuble', label: 'Immeuble' },
          { value: 'bureau', label: 'Bureau' },
          { value: 'commerce', label: 'Local commercial' },
        ],
      },
      {
        id: 'nbChambres',
        label: 'Nombre de chambres',
        type: 'range',
        min: 0,
        max: 10,
        unit: 'chambres',
      },
      {
        id: 'nbSallesBain',
        label: 'Salles de bain',
        type: 'range',
        min: 0,
        max: 5,
        unit: 'salles de bain',
      },
      {
        id: 'superficie',
        label: 'Superficie',
        type: 'range',
        min: 0,
        max: 1000,
        unit: 'm²',
      },
      {
        id: 'ameublement',
        label: 'Ameublement',
        type: 'select',
        options: [
          { value: 'meuble', label: 'Meublé' },
          { value: 'semi_meuble', label: 'Semi-meublé' },
          { value: 'non_meuble', label: 'Non meublé' },
        ],
      },
    ],
    style: {
      primaryColor: '#3B82F6',
      gradientColors: ['#3B82F6', '#1D4ED8'],
      icon: '🏢',
      badgeColor: '#EFF6FF',
      accentColor: '#2563EB',
    },
    displayPriority: ['superficie', 'nbPieces', 'quartier', 'prix', 'equipements'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 🏞️ IMMOBILIER - TERRAINS
  immobilier_terrain: {
    terminology: {
      productLabel: 'Terrain',
      productsLabel: 'Terrains',
      priceLabel: 'Prix au m²',
      locationLabel: 'Localisation',
      providerLabel: 'Propriétaire',
      searchPlaceholder: 'Rechercher un terrain...',
      emptyMessage: 'Aucun terrain disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'statutImmobilier',
        label: 'Statut',
        type: 'select',
        options: [
          { value: 'vente', label: 'À vendre' },
          { value: 'location', label: 'À louer' },
        ],
      },
      {
        id: 'typeImmobilier',
        label: 'Type de terrain',
        type: 'select',
        options: [
          { value: 'constructible', label: 'Constructible' },
          { value: 'agricole', label: 'Agricole' },
          { value: 'commercial', label: 'Commercial' },
          { value: 'industriel', label: 'Industriel' },
        ],
      },
      {
        id: 'superficie',
        label: 'Superficie',
        type: 'range',
        min: 0,
        max: 10000,
        unit: 'm²',
      },
    ],
    style: {
      primaryColor: '#10B981',
      gradientColors: ['#10B981', '#059669'],
      icon: '🏞️',
      badgeColor: '#D1FAE5',
      accentColor: '#059669',
    },
    displayPriority: ['superficie', 'typeTerrain', 'viabilise', 'titreFoncier', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 🚗 AUTOMOBILE
  automobile: {
    terminology: {
      productLabel: 'Véhicule',
      productsLabel: 'Véhicules',
      priceLabel: 'Prix',
      locationLabel: 'Localisation',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher une voiture, moto...',
      emptyMessage: 'Aucun véhicule disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'marqueAutomobile',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'toyota', label: 'Toyota' },
          { value: 'mercedes', label: 'Mercedes' },
          { value: 'bmw', label: 'BMW' },
          { value: 'nissan', label: 'Nissan' },
          { value: 'honda', label: 'Honda' },
          { value: 'yamaha', label: 'Yamaha' },
          { value: 'peugeot', label: 'Peugeot' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'modeleAutomobile',
        label: 'Modèle',
        type: 'select',
        options: [
          { value: 'berline', label: 'Berline' },
          { value: '4x4', label: '4x4/SUV' },
          { value: 'pickup', label: 'Pick-up' },
          { value: 'coupe', label: 'Coupé' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'etatVehicule',
        label: 'État',
        type: 'select',
        options: [
          { value: 'neuf', label: 'Neuf' },
          { value: 'occasion', label: 'Occasion' },
          { value: 'accidente', label: 'Accidenté' },
        ],
      },
      {
        id: 'annee',
        label: 'Année',
        type: 'range',
        min: 1990,
        max: new Date().getFullYear() + 1,
        unit: '',
      },
      {
        id: 'kilometrage',
        label: 'Kilométrage',
        type: 'range',
        min: 0,
        max: 500000,
        unit: 'km',
      },
      {
        id: 'couleurAutomobile',
        label: 'Couleur',
        type: 'select',
        options: [
          { value: 'noir', label: 'Noir' },
          { value: 'blanc', label: 'Blanc' },
          { value: 'gris', label: 'Gris' },
          { value: 'rouge', label: 'Rouge' },
          { value: 'bleu', label: 'Bleu' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'typeCarburant',
        label: 'Carburant',
        type: 'select',
        options: [
          { value: 'essence', label: 'Essence' },
          { value: 'diesel', label: 'Diesel' },
          { value: 'hybride', label: 'Hybride' },
          { value: 'electrique', label: 'Électrique' },
        ],
      },
      {
        id: 'transmission',
        label: 'Transmission',
        type: 'select',
        options: [
          { value: 'manuelle', label: 'Manuelle' },
          { value: 'automatique', label: 'Automatique' },
        ],
      },
    ],
    style: {
      primaryColor: '#EF4444',
      gradientColors: ['#EF4444', '#DC2626'],
      icon: '🚗',
      badgeColor: '#FEE2E2',
      accentColor: '#DC2626',
    },
    displayPriority: ['marque', 'modele', 'annee', 'kilometrage', 'carburant', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 🎫 TICKET VOYAGE
  ticket_voyage: {
    terminology: {
      productLabel: 'Billet',
      productsLabel: 'Billets',
      priceLabel: 'Tarif',
      locationLabel: 'Itinéraire',
      providerLabel: 'Compagnie',
      searchPlaceholder: 'Rechercher un trajet...',
      emptyMessage: 'Aucun billet disponible pour cet itinéraire',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Durée du trajet',
        date: 'Date de départ',
      },
    },
    filters: [
      {
        id: 'compagnieTransport',
        label: 'Compagnie',
        type: 'select',
        options: [
          { value: 'touristique_express', label: 'Touristique Express' },
          { value: 'centrale_voyage', label: 'Centrale Voyage' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'typeVehiculeTransport',
        label: 'Type de transport',
        type: 'select',
        options: [
          { value: 'bus', label: 'Bus' },
          { value: 'train', label: 'Train' },
          { value: 'avion', label: 'Avion' },
        ],
      },
      {
        id: 'classeVoyage',
        label: 'Classe',
        type: 'select',
        options: [
          { value: 'economique', label: 'Économique' },
          { value: 'vip', label: 'VIP' },
          { value: 'business', label: 'Business' },
        ],
      },
      {
        id: 'depart',
        label: 'Ville de départ',
        type: 'select',
        options: [
          { value: 'douala', label: 'Douala' },
          { value: 'yaounde', label: 'Yaoundé' },
          { value: 'bafoussam', label: 'Bafoussam' },
          { value: 'bamenda', label: 'Bamenda' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'destination',
        label: 'Destination',
        type: 'select',
        options: [
          { value: 'douala', label: 'Douala' },
          { value: 'yaounde', label: 'Yaoundé' },
          { value: 'bafoussam', label: 'Bafoussam' },
          { value: 'bamenda', label: 'Bamenda' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'dateDepart',
        label: 'Date de départ',
        type: 'date',
      },
      {
        id: 'heureDepart',
        label: 'Heure de départ',
        type: 'time',
      },
    ],
    style: {
      primaryColor: '#8B5CF6',
      gradientColors: ['#8B5CF6', '#7C3AED'],
      icon: '🎫',
      badgeColor: '#F3E8FF',
      accentColor: '#7C3AED',
    },
    displayPriority: ['depart', 'destination', 'dateDepart', 'heureDepart', 'classe', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: false,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🏥 HOPITAL/CLINIQUE
  hopital_clinique: {
    terminology: {
      productLabel: 'Établissement de santé',
      productsLabel: 'Établissements de santé',
      priceLabel: 'Tarif consultation',
      locationLabel: 'Adresse',
      providerLabel: 'Établissement',
      searchPlaceholder: 'Rechercher un hôpital, clinique...',
      emptyMessage: 'Aucun établissement de santé trouvé',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeEtablissement',
        label: 'Type d\'établissement',
        type: 'select',
        options: [
          { value: 'hopital', label: 'Hôpital' },
          { value: 'clinique', label: 'Clinique' },
          { value: 'centre_sante', label: 'Centre de santé' },
          { value: 'cabinet', label: 'Cabinet médical' },
        ],
      },
      {
        id: 'specialites',
        label: 'Spécialités',
        type: 'multiselect',
        options: [
          { value: 'generaliste', label: 'Médecine générale' },
          { value: 'pediatrie', label: 'Pédiatrie' },
          { value: 'gynecologie', label: 'Gynécologie' },
          { value: 'cardiologie', label: 'Cardiologie' },
          { value: 'chirurgie', label: 'Chirurgie' },
          { value: 'dentaire', label: 'Dentaire' },
          { value: 'ophtalmologie', label: 'Ophtalmologie' },
          { value: 'dermatologie', label: 'Dermatologie' },
        ],
      },
      {
        id: 'banqueSang',
        label: 'Banque de sang',
        type: 'toggle',
      },
      {
        id: 'urgences24h',
        label: 'Urgences 24h/24',
        type: 'toggle',
      },
      {
        id: 'rdvEnLigne',
        label: 'RDV en ligne',
        type: 'toggle',
      },
      {
        id: 'assurancesAcceptees',
        label: 'Assurances acceptées',
        type: 'multiselect',
        options: [
          { value: 'cnps', label: 'CNPS' },
          { value: 'allianz', label: 'Allianz' },
          { value: 'saar', label: 'SAAR' },
          { value: 'activa', label: 'Activa' },
          { value: 'autre', label: 'Autre' },
        ],
      },
    ],
    style: {
      primaryColor: '#DC2626',
      gradientColors: ['#DC2626', '#B91C1C'],
      icon: '🏥',
      badgeColor: '#FEE2E2',
      accentColor: '#B91C1C',
    },
    displayPriority: ['typeEtablissement', 'specialites', 'banqueSang', 'urgences24h', 'horaires'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 💊 PHARMACIE
  pharmacie: {
    terminology: {
      productLabel: 'Pharmacie',
      productsLabel: 'Pharmacies',
      priceLabel: 'Prix moyen',
      locationLabel: 'Adresse',
      providerLabel: 'Pharmacie',
      searchPlaceholder: 'Rechercher une pharmacie...',
      emptyMessage: 'Aucune pharmacie trouvée à proximité',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typePharmacie',
        label: 'Type de pharmacie',
        type: 'select',
        options: [
          { value: 'classique', label: 'Classique' },
          { value: 'garde', label: 'De garde' },
          { value: '24h', label: '24h/24' },
        ],
      },
      {
        id: 'deGarde',
        label: 'De garde aujourd\'hui',
        type: 'toggle',
      },
      {
        id: 'livraison',
        label: 'Livraison à domicile',
        type: 'toggle',
      },
      {
        id: 'services',
        label: 'Services',
        type: 'multiselect',
        options: [
          { value: 'test_rapide', label: 'Tests rapides' },
          { value: 'vaccination', label: 'Vaccination' },
          { value: 'conseil', label: 'Conseil pharmaceutique' },
          { value: 'dermato', label: 'Produits dermatologiques' },
          { value: 'pediatrie', label: 'Pédiatrie' },
        ],
      },
    ],
    style: {
      primaryColor: '#059669',
      gradientColors: ['#059669', '#047857'],
      icon: '💊',
      badgeColor: '#D1FAE5',
      accentColor: '#047857',
    },
    displayPriority: ['typePharmacie', 'deGarde', 'horaires', 'telephoneUrgence', 'services'],
    contactMethods: ['phone', 'whatsapp'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🎯 PRESTATION SERVICE
  prestation_service: {
    terminology: {
      productLabel: 'Prestation',
      productsLabel: 'Prestations',
      priceLabel: 'Tarif à partir de',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Prestataire',
      searchPlaceholder: 'Rechercher un prestataire...',
      emptyMessage: 'Aucun prestataire disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'categorie',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'batiment', label: 'Bâtiment' },
          { value: 'beaute', label: 'Beauté' },
          { value: 'informatique', label: 'Informatique' },
          { value: 'mecanique', label: 'Mécanique' },
          { value: 'menage', label: 'Ménage' },
          { value: 'education', label: 'Éducation' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'experience',
        label: 'Expérience (années)',
        type: 'range',
        min: 0,
        max: 30,
        unit: 'ans',
      },
      {
        id: 'certifie',
        label: 'Certifié/Diplômé',
        type: 'toggle',
      },
      {
        id: 'deplacement',
        label: 'Se déplace',
        type: 'toggle',
      },
      {
        id: 'disponibilite',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'immediat', label: 'Immédiate' },
          { value: 'semaine', label: 'Cette semaine' },
          { value: 'mois', label: 'Ce mois' },
        ],
      },
    ],
    style: {
      primaryColor: '#8B5CF6',
      gradientColors: ['#8B5CF6', '#7C3AED'],
      icon: '🎯',
      badgeColor: '#F3E8FF',
      accentColor: '#7C3AED',
    },
    displayPriority: ['prestations', 'experience', 'certifications', 'tarif'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 👟 CHAUSSURE
  chaussure: {
    terminology: {
      productLabel: 'Chaussure',
      productsLabel: 'Chaussures',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher des chaussures...',
      emptyMessage: 'Aucune chaussure disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeChaussure',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'baskets', label: 'Baskets' },
          { value: 'chaussures_ville', label: 'Chaussures de ville' },
          { value: 'sandales', label: 'Sandales' },
          { value: 'bottes', label: 'Bottes' },
          { value: 'talons', label: 'Talons' },
          { value: 'sport', label: 'Sport' },
        ],
      },
      {
        id: 'pointure',
        label: 'Pointure',
        type: 'range',
        min: 20,
        max: 50,
        unit: '',
      },
      {
        id: 'couleurChaussure',
        label: 'Couleur',
        type: 'select',
        options: [
          { value: 'noir', label: 'Noir' },
          { value: 'blanc', label: 'Blanc' },
          { value: 'marron', label: 'Marron' },
          { value: 'bleu', label: 'Bleu' },
          { value: 'rouge', label: 'Rouge' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'marqueChaussure',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'nike', label: 'Nike' },
          { value: 'adidas', label: 'Adidas' },
          { value: 'puma', label: 'Puma' },
          { value: 'clarks', label: 'Clarks' },
          { value: 'autre', label: 'Autre' },
        ],
      },
    ],
    style: {
      primaryColor: '#F97316',
      gradientColors: ['#F97316', '#EA580C'],
      icon: '👟',
      badgeColor: '#FFEDD5',
      accentColor: '#EA580C',
    },
    displayPriority: ['typeChaussure', 'marqueChaussure', 'pointure', 'couleurChaussure', 'prix'],
    contactMethods: ['whatsapp', 'message', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🍎 ALIMENTS
  aliments: {
    terminology: {
      productLabel: 'Produit alimentaire',
      productsLabel: 'Produits alimentaires',
      priceLabel: 'Prix',
      locationLabel: 'Point de vente',
      providerLabel: 'Fournisseur',
      searchPlaceholder: 'Rechercher des aliments...',
      emptyMessage: 'Aucun produit alimentaire disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'categorieAliment',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'fruits', label: 'Fruits' },
          { value: 'legumes', label: 'Légumes' },
          { value: 'viandes', label: 'Viandes' },
          { value: 'poissons', label: 'Poissons' },
          { value: 'cereales', label: 'Céréales' },
          { value: 'produits_laitiers', label: 'Produits laitiers' },
          { value: 'epicerie', label: 'Épicerie' },
        ],
      },
      {
        id: 'origine',
        label: 'Origine',
        type: 'select',
        options: [
          { value: 'locale', label: 'Locale' },
          { value: 'importee', label: 'Importée' },
          { value: 'bio', label: 'Bio' },
        ],
      },
      {
        id: 'frais',
        label: 'Produits frais',
        type: 'toggle',
      },
      {
        id: 'livraison',
        label: 'Livraison disponible',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#84CC16',
      gradientColors: ['#84CC16', '#65A30D'],
      icon: '🍎',
      badgeColor: '#ECFCCB',
      accentColor: '#65A30D',
    },
    displayPriority: ['categorieAliment', 'origine', 'poids', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 👕 VÊTEMENT
  vetement: {
    terminology: {
      productLabel: 'Vêtement',
      productsLabel: 'Vêtements',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher des vêtements...',
      emptyMessage: 'Aucun vêtement disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'taille',
        label: 'Taille',
        type: 'select',
        options: [
          { value: 'xs', label: 'XS' },
          { value: 's', label: 'S' },
          { value: 'm', label: 'M' },
          { value: 'l', label: 'L' },
          { value: 'xl', label: 'XL' },
          { value: 'xxl', label: 'XXL' },
        ],
      },
      {
        id: 'couleurVetement',
        label: 'Couleur',
        type: 'multiselect',
        options: [
          { value: 'noir', label: 'Noir' },
          { value: 'blanc', label: 'Blanc' },
          { value: 'rouge', label: 'Rouge' },
          { value: 'bleu', label: 'Bleu' },
          { value: 'vert', label: 'Vert' },
          { value: 'jaune', label: 'Jaune' },
          { value: 'gris', label: 'Gris' },
          { value: 'rose', label: 'Rose' },
        ],
      },
      {
        id: 'matiereVetement',
        label: 'Matière',
        type: 'select',
        options: [
          { value: 'coton', label: 'Coton' },
          { value: 'polyester', label: 'Polyester' },
          { value: 'lin', label: 'Lin' },
          { value: 'soie', label: 'Soie' },
          { value: 'laine', label: 'Laine' },
          { value: 'jean', label: 'Jean' },
        ],
      },
      {
        id: 'marqueVetement',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'nike', label: 'Nike' },
          { value: 'adidas', label: 'Adidas' },
          { value: 'zara', label: 'Zara' },
          { value: 'hm', label: 'H&M' },
          { value: 'autre', label: 'Autre' },
        ],
      },
    ],
    style: {
      primaryColor: '#EC4899',
      gradientColors: ['#EC4899', '#DB2777'],
      icon: '👕',
      badgeColor: '#FCE7F3',
      accentColor: '#DB2777',
    },
    displayPriority: ['typeVetement', 'taille', 'marque', 'couleur', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🔌 ÉLECTROMÉNAGER
  electromenager: {
    terminology: {
      productLabel: 'Appareil électroménager',
      productsLabel: 'Électroménagers',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher un appareil...',
      emptyMessage: 'Aucun électroménager disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeElectro',
        label: 'Type d\'appareil',
        type: 'select',
        options: [
          { value: 'refrigerateur', label: 'Réfrigérateur' },
          { value: 'cuisiniere', label: 'Cuisinière' },
          { value: 'lave_linge', label: 'Lave-linge' },
          { value: 'micro_ondes', label: 'Micro-ondes' },
          { value: 'climatiseur', label: 'Climatiseur' },
          { value: 'ventilateur', label: 'Ventilateur' },
        ],
      },
      {
        id: 'marqueElectro',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'samsung', label: 'Samsung' },
          { value: 'lg', label: 'LG' },
          { value: 'whirlpool', label: 'Whirlpool' },
          { value: 'haier', label: 'Haier' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'modeleElectro',
        label: 'Modèle',
        type: 'select',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'premium', label: 'Premium' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'etatElectro',
        label: 'État',
        type: 'select',
        options: [
          { value: 'neuf', label: 'Neuf' },
          { value: 'occasion', label: 'Occasion' },
          { value: 'reconditionne', label: 'Reconditionné' },
        ],
      },
      {
        id: 'garantieElectro',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: '6_mois', label: '6 mois' },
          { value: '1_an', label: '1 an' },
          { value: '2_ans', label: '2 ans' },
          { value: 'sans', label: 'Sans garantie' },
        ],
      },
    ],
    style: {
      primaryColor: '#14B8A6',
      gradientColors: ['#14B8A6', '#0D9488'],
      icon: '🔌',
      badgeColor: '#CCFBF1',
      accentColor: '#0D9488',
    },
    displayPriority: ['categorieElectro', 'marque', 'etatProduit', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 📺 IMAGE & SON
  image_son: {
    terminology: {
      productLabel: 'Équipement image/son',
      productsLabel: 'Image & Son',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher TV, enceintes...',
      emptyMessage: 'Aucun équipement image/son disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeImageSon',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'television', label: 'Télévision' },
          { value: 'home_cinema', label: 'Home cinéma' },
          { value: 'enceintes', label: 'Enceintes' },
          { value: 'barre_son', label: 'Barre de son' },
          { value: 'projecteur', label: 'Projecteur' },
        ],
      },
      {
        id: 'marqueImageSon',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'samsung', label: 'Samsung' },
          { value: 'lg', label: 'LG' },
          { value: 'sony', label: 'Sony' },
          { value: 'bose', label: 'Bose' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'resolution',
        label: 'Résolution',
        type: 'select',
        options: [
          { value: 'hd', label: 'HD (720p)' },
          { value: 'full_hd', label: 'Full HD (1080p)' },
          { value: '4k', label: '4K' },
          { value: '8k', label: '8K' },
        ],
      },
      {
        id: 'diagonaleEcran',
        label: 'Taille écran (pouces)',
        type: 'range',
        min: 20,
        max: 100,
        unit: '"',
      },
    ],
    style: {
      primaryColor: '#9C27B0',
      gradientColors: ['#9C27B0', '#7B1FA2'],
      icon: '📺',
      badgeColor: '#F3E5F5',
      accentColor: '#7B1FA2',
    },
    displayPriority: ['typeImageSon', 'marqueImageSon', 'diagonaleEcran', 'resolution', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 📱 TÉLÉPHONE
  telephone: {
    terminology: {
      productLabel: 'Téléphone',
      productsLabel: 'Téléphones',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher un smartphone...',
      emptyMessage: 'Aucun téléphone disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'marqueTelephone',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'samsung', label: 'Samsung' },
          { value: 'apple', label: 'Apple' },
          { value: 'huawei', label: 'Huawei' },
          { value: 'xiaomi', label: 'Xiaomi' },
          { value: 'oppo', label: 'Oppo' },
          { value: 'tecno', label: 'Tecno' },
          { value: 'infinix', label: 'Infinix' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'stockage',
        label: 'Stockage',
        type: 'select',
        options: [
          { value: '32gb', label: '32 GB' },
          { value: '64gb', label: '64 GB' },
          { value: '128gb', label: '128 GB' },
          { value: '256gb', label: '256 GB' },
          { value: '512gb', label: '512 GB' },
          { value: '1tb', label: '1 TB' },
        ],
      },
      {
        id: 'ram',
        label: 'Mémoire RAM',
        type: 'select',
        options: [
          { value: '2gb', label: '2 GB' },
          { value: '4gb', label: '4 GB' },
          { value: '6gb', label: '6 GB' },
          { value: '8gb', label: '8 GB' },
          { value: '12gb', label: '12 GB' },
        ],
      },
      {
        id: 'etat',
        label: 'État',
        type: 'select',
        options: [
          { value: 'neuf', label: 'Neuf' },
          { value: 'occasion', label: 'Occasion' },
          { value: 'reconditionne', label: 'Reconditionné' },
        ],
      },
    ],
    style: {
      primaryColor: '#FF9800',
      gradientColors: ['#FF9800', '#F57C00'],
      icon: '📱',
      badgeColor: '#FFF3E0',
      accentColor: '#F57C00',
    },
    displayPriority: ['marqueTelephone', 'modeleTelephone', 'stockage', 'ram', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 💻 ORDINATEUR
  ordinateur: {
    terminology: {
      productLabel: 'Ordinateur',
      productsLabel: 'Ordinateurs',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher un PC, laptop...',
      emptyMessage: 'Aucun ordinateur disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeOrdinateur',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'portable', label: 'PC Portable' },
          { value: 'bureau', label: 'PC Bureau' },
          { value: 'tablette', label: 'Tablette' },
          { value: 'all_in_one', label: 'All-in-One' },
        ],
      },
      {
        id: 'marqueOrdinateur',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'hp', label: 'HP' },
          { value: 'dell', label: 'Dell' },
          { value: 'lenovo', label: 'Lenovo' },
          { value: 'asus', label: 'Asus' },
          { value: 'apple', label: 'Apple' },
          { value: 'acer', label: 'Acer' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'processeur',
        label: 'Processeur',
        type: 'select',
        options: [
          { value: 'intel_i3', label: 'Intel Core i3' },
          { value: 'intel_i5', label: 'Intel Core i5' },
          { value: 'intel_i7', label: 'Intel Core i7' },
          { value: 'intel_i9', label: 'Intel Core i9' },
          { value: 'amd_ryzen_3', label: 'AMD Ryzen 3' },
          { value: 'amd_ryzen_5', label: 'AMD Ryzen 5' },
          { value: 'amd_ryzen_7', label: 'AMD Ryzen 7' },
        ],
      },
      {
        id: 'ramOrdinateur',
        label: 'Mémoire RAM',
        type: 'select',
        options: [
          { value: '4gb', label: '4 GB' },
          { value: '8gb', label: '8 GB' },
          { value: '16gb', label: '16 GB' },
          { value: '32gb', label: '32 GB' },
        ],
      },
      {
        id: 'stockageOrdinateur',
        label: 'Stockage',
        type: 'select',
        options: [
          { value: '256gb', label: '256 GB SSD' },
          { value: '512gb', label: '512 GB SSD' },
          { value: '1tb', label: '1 TB' },
          { value: '2tb', label: '2 TB' },
        ],
      },
    ],
    style: {
      primaryColor: '#00BCD4',
      gradientColors: ['#00BCD4', '#0097A7'],
      icon: '💻',
      badgeColor: '#E0F7FA',
      accentColor: '#0097A7',
    },
    displayPriority: ['typeOrdinateur', 'marqueOrdinateur', 'processeur', 'ramOrdinateur', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 🪑 MOBILIER
  mobilier: {
    terminology: {
      productLabel: 'Meuble',
      productsLabel: 'Meubles',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher des meubles...',
      emptyMessage: 'Aucun meuble disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeMobilier',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'canape', label: 'Canapé' },
          { value: 'lit', label: 'Lit' },
          { value: 'armoire', label: 'Armoire' },
          { value: 'table', label: 'Table' },
          { value: 'chaise', label: 'Chaise' },
          { value: 'bureau', label: 'Bureau' },
          { value: 'etagere', label: 'Étagère' },
        ],
      },
      {
        id: 'materiau',
        label: 'Matériau',
        type: 'select',
        options: [
          { value: 'bois', label: 'Bois' },
          { value: 'metal', label: 'Métal' },
          { value: 'verre', label: 'Verre' },
          { value: 'plastique', label: 'Plastique' },
          { value: 'cuir', label: 'Cuir' },
          { value: 'tissu', label: 'Tissu' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        type: 'select',
        options: [
          { value: 'moderne', label: 'Moderne' },
          { value: 'classique', label: 'Classique' },
          { value: 'rustique', label: 'Rustique' },
          { value: 'industriel', label: 'Industriel' },
          { value: 'scandinave', label: 'Scandinave' },
        ],
      },
      {
        id: 'etat',
        label: 'État',
        type: 'select',
        options: [
          { value: 'neuf', label: 'Neuf' },
          { value: 'occasion', label: 'Occasion' },
        ],
      },
    ],
    style: {
      primaryColor: '#F97316',
      gradientColors: ['#F97316', '#EA580C'],
      icon: '🪑',
      badgeColor: '#FFEDD5',
      accentColor: '#EA580C',
    },
    displayPriority: ['typeMobilier', 'materiau', 'dimensions', 'style', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 🖼️ DÉCORATION
  decoration: {
    terminology: {
      productLabel: 'Article de décoration',
      productsLabel: 'Décoration',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher de la déco...',
      emptyMessage: 'Aucun article de décoration disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeDecoration',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'tableau', label: 'Tableau' },
          { value: 'luminaire', label: 'Luminaire' },
          { value: 'tapis', label: 'Tapis' },
          { value: 'rideau', label: 'Rideau' },
          { value: 'coussin', label: 'Coussin' },
          { value: 'vase', label: 'Vase' },
          { value: 'miroir', label: 'Miroir' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        type: 'select',
        options: [
          { value: 'moderne', label: 'Moderne' },
          { value: 'vintage', label: 'Vintage' },
          { value: 'boheme', label: 'Bohème' },
          { value: 'minimaliste', label: 'Minimaliste' },
          { value: 'ethnique', label: 'Ethnique' },
        ],
      },
      {
        id: 'couleurDecoration',
        label: 'Couleur dominante',
        type: 'multiselect',
        options: [
          { value: 'blanc', label: 'Blanc' },
          { value: 'noir', label: 'Noir' },
          { value: 'bleu', label: 'Bleu' },
          { value: 'rouge', label: 'Rouge' },
          { value: 'vert', label: 'Vert' },
          { value: 'jaune', label: 'Jaune' },
        ],
      },
    ],
    style: {
      primaryColor: '#E91E63',
      gradientColors: ['#E91E63', '#C2185B'],
      icon: '🖼️',
      badgeColor: '#FCE4EC',
      accentColor: '#C2185B',
    },
    displayPriority: ['typeDecoration', 'style', 'couleurDecoration', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🍴 USTENSILES CUISINE
  ustensiles_cuisine: {
    terminology: {
      productLabel: 'Ustensile de cuisine',
      productsLabel: 'Ustensiles de cuisine',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher des ustensiles...',
      emptyMessage: 'Aucun ustensile disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeUstensile',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'casserole', label: 'Casserole' },
          { value: 'poele', label: 'Poêle' },
          { value: 'couteau', label: 'Couteau' },
          { value: 'planche', label: 'Planche à découper' },
          { value: 'assiettes', label: 'Assiettes' },
          { value: 'couverts', label: 'Couverts' },
          { value: 'ustensiles', label: 'Ustensiles divers' },
        ],
      },
      {
        id: 'materiauUstensile',
        label: 'Matériau',
        type: 'select',
        options: [
          { value: 'inox', label: 'Inox' },
          { value: 'aluminium', label: 'Aluminium' },
          { value: 'ceramique', label: 'Céramique' },
          { value: 'verre', label: 'Verre' },
          { value: 'plastique', label: 'Plastique' },
          { value: 'bois', label: 'Bois' },
        ],
      },
      {
        id: 'marqueUstensile',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'tefal', label: 'Tefal' },
          { value: 'pyrex', label: 'Pyrex' },
          { value: 'autre', label: 'Autre' },
        ],
      },
    ],
    style: {
      primaryColor: '#FF5722',
      gradientColors: ['#FF5722', '#E64A19'],
      icon: '🍴',
      badgeColor: '#FFEBEE',
      accentColor: '#E64A19',
    },
    displayPriority: ['typeUstensile', 'materiauUstensile', 'marqueUstensile', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 📚 LIVRES & FOURNITURES
  livres_fournitures: {
    terminology: {
      productLabel: 'Article scolaire',
      productsLabel: 'Livres & Fournitures',
      priceLabel: 'Prix',
      locationLabel: 'Librairie',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher livres, fournitures...',
      emptyMessage: 'Aucun article disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'categorieLivre',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'manuel_scolaire', label: 'Manuel scolaire' },
          { value: 'cahier', label: 'Cahiers' },
          { value: 'stylo', label: 'Stylos' },
          { value: 'fourniture', label: 'Fournitures diverses' },
          { value: 'sac_ecole', label: 'Sac d\'école' },
          { value: 'livre_lecture', label: 'Livre de lecture' },
        ],
      },
      {
        id: 'niveau',
        label: 'Niveau scolaire',
        type: 'select',
        options: [
          { value: 'maternelle', label: 'Maternelle' },
          { value: 'primaire', label: 'Primaire' },
          { value: 'college', label: 'Collège' },
          { value: 'lycee', label: 'Lycée' },
          { value: 'universite', label: 'Université' },
        ],
      },
      {
        id: 'matiereScolaire',
        label: 'Matière',
        type: 'select',
        options: [
          { value: 'mathematiques', label: 'Mathématiques' },
          { value: 'francais', label: 'Français' },
          { value: 'anglais', label: 'Anglais' },
          { value: 'sciences', label: 'Sciences' },
          { value: 'histoire', label: 'Histoire-Géo' },
        ],
      },
      {
        id: 'etat',
        label: 'État',
        type: 'select',
        options: [
          { value: 'neuf', label: 'Neuf' },
          { value: 'occasion', label: 'Occasion' },
        ],
      },
    ],
    style: {
      primaryColor: '#7C3AED',
      gradientColors: ['#7C3AED', '#6D28D9'],
      icon: '📚',
      badgeColor: '#EDE9FE',
      accentColor: '#6D28D9',
    },
    displayPriority: ['categorieLivre', 'niveau', 'matiereScolaire', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🔨 QUINCAILLERIE
  quincaillerie: {
    terminology: {
      productLabel: 'Article de quincaillerie',
      productsLabel: 'Quincaillerie',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher outils, matériaux...',
      emptyMessage: 'Aucun article de quincaillerie disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'categorieQuincaillerie',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'outils', label: 'Outils' },
          { value: 'materiaux', label: 'Matériaux de construction' },
          { value: 'plomberie', label: 'Plomberie' },
          { value: 'electricite', label: 'Électricité' },
          { value: 'peinture', label: 'Peinture' },
          { value: 'serrurerie', label: 'Serrurerie' },
        ],
      },
      {
        id: 'marqueQuincaillerie',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'bosch', label: 'Bosch' },
          { value: 'makita', label: 'Makita' },
          { value: 'stanley', label: 'Stanley' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'unite',
        label: 'Unité de vente',
        type: 'select',
        options: [
          { value: 'piece', label: 'À la pièce' },
          { value: 'lot', label: 'En lot' },
          { value: 'metre', label: 'Au mètre' },
          { value: 'kg', label: 'Au kilo' },
        ],
      },
    ],
    style: {
      primaryColor: '#64748B',
      gradientColors: ['#64748B', '#475569'],
      icon: '🔨',
      badgeColor: '#F1F5F9',
      accentColor: '#475569',
    },
    displayPriority: ['categorieQuincaillerie', 'marqueQuincaillerie', 'unite', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 🚙 COVOITURAGE
  covoiturage: {
    terminology: {
      productLabel: 'Trajet de covoiturage',
      productsLabel: 'Covoiturages',
      priceLabel: 'Tarif par place',
      locationLabel: 'Itinéraire',
      providerLabel: 'Conducteur',
      searchPlaceholder: 'Rechercher un trajet...',
      emptyMessage: 'Aucun trajet de covoiturage disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Distance',
        date: 'Date de départ',
      },
    },
    filters: [
      {
        id: 'dateDepart',
        label: 'Date de départ',
        type: 'date',
      },
      {
        id: 'heureDepart',
        label: 'Heure de départ',
        type: 'time',
      },
      {
        id: 'nbPlacesDisponibles',
        label: 'Places disponibles',
        type: 'range',
        min: 1,
        max: 7,
        unit: 'places',
      },
      {
        id: 'confort',
        label: 'Confort',
        type: 'select',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'premium', label: 'Premium' },
          { value: 'vip', label: 'VIP' },
        ],
      },
      {
        id: 'climatisation',
        label: 'Climatisation',
        type: 'toggle',
      },
      {
        id: 'bagages',
        label: 'Bagages acceptés',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#EC4899',
      gradientColors: ['#EC4899', '#DB2777'],
      icon: '🚙',
      badgeColor: '#FCE7F3',
      accentColor: '#DB2777',
    },
    displayPriority: ['pointDepart', 'pointArrivee', 'dateDepart', 'heureDepart', 'nbPlacesDisponibles', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: false,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🛡️ ASSURANCE
  assurance: {
    terminology: {
      productLabel: 'Assurance',
      productsLabel: 'Assurances',
      priceLabel: 'Prime mensuelle',
      locationLabel: 'Agence',
      providerLabel: 'Compagnie',
      searchPlaceholder: 'Rechercher une assurance...',
      emptyMessage: 'Aucune offre d\'assurance disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prime croissante',
        price_desc: 'Prime décroissante',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeAssurance',
        label: 'Type d\'assurance',
        type: 'select',
        options: [
          { value: 'auto', label: 'Automobile' },
          { value: 'sante', label: 'Santé' },
          { value: 'habitation', label: 'Habitation' },
          { value: 'vie', label: 'Vie' },
          { value: 'voyage', label: 'Voyage' },
          { value: 'entreprise', label: 'Entreprise' },
        ],
      },
      {
        id: 'compagnie',
        label: 'Compagnie',
        type: 'select',
        options: [
          { value: 'allianz', label: 'Allianz' },
          { value: 'saar', label: 'SAAR' },
          { value: 'activa', label: 'Activa' },
          { value: 'axa', label: 'AXA' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'couverture',
        label: 'Niveau de couverture',
        type: 'select',
        options: [
          { value: 'base', label: 'Base' },
          { value: 'intermediaire', label: 'Intermédiaire' },
          { value: 'complete', label: 'Complète' },
          { value: 'premium', label: 'Premium' },
        ],
      },
    ],
    style: {
      primaryColor: '#14B8A6',
      gradientColors: ['#14B8A6', '#0D9488'],
      icon: '🛡️',
      badgeColor: '#CCFBF1',
      accentColor: '#0D9488',
    },
    displayPriority: ['typeAssurance', 'compagnie', 'couverture', 'prix'],
    contactMethods: ['message', 'phone', 'whatsapp'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🚚 DÉMÉNAGEMENT
  demenagement: {
    terminology: {
      productLabel: 'Service de déménagement',
      productsLabel: 'Services de déménagement',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Déménageur',
      searchPlaceholder: 'Rechercher un déménageur...',
      emptyMessage: 'Aucun service de déménagement disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeDemenagement',
        label: 'Type de déménagement',
        type: 'select',
        options: [
          { value: 'local', label: 'Local' },
          { value: 'national', label: 'National' },
          { value: 'international', label: 'International' },
        ],
      },
      {
        id: 'typeVehicule',
        label: 'Type de véhicule',
        type: 'select',
        options: [
          { value: 'camionnette', label: 'Camionnette' },
          { value: 'camion_10m3', label: 'Camion 10m³' },
          { value: 'camion_20m3', label: 'Camion 20m³' },
          { value: 'camion_40m3', label: 'Camion 40m³' },
        ],
      },
      {
        id: 'volumeEstime',
        label: 'Volume estimé',
        type: 'range',
        min: 1,
        max: 100,
        unit: 'm³',
      },
      {
        id: 'nbDemenageurs',
        label: 'Nombre de déménageurs',
        type: 'range',
        min: 1,
        max: 10,
        unit: 'personnes',
      },
      {
        id: 'assuranceMarchandise',
        label: 'Assurance marchandise',
        type: 'toggle',
      },
      {
        id: 'serviceManutention',
        label: 'Service de manutention',
        type: 'toggle',
      },
      {
        id: 'montageDemontage',
        label: 'Montage/Démontage',
        type: 'toggle',
      },
      {
        id: 'emballageCartons',
        label: 'Emballage et cartons',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#F97316',
      gradientColors: ['#F97316', '#EA580C'],
      icon: '🚚',
      badgeColor: '#FFEDD5',
      accentColor: '#EA580C',
    },
    displayPriority: ['typeDemenagement', 'typeVehicule', 'volumeEstime', 'nbDemenageurs', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // ✨ COSMÉTIQUE & PARFUM
  cosmetique_parfum: {
    terminology: {
      productLabel: 'Produit cosmétique',
      productsLabel: 'Cosmétiques & Parfums',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher cosmétiques, parfums...',
      emptyMessage: 'Aucun produit cosmétique disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeCosmetique',
        label: 'Type de produit',
        type: 'select',
        options: [
          { value: 'parfum', label: 'Parfum' },
          { value: 'creme_visage', label: 'Crème visage' },
          { value: 'creme_corps', label: 'Crème corps' },
          { value: 'huile_beaute', label: 'Huile de beauté' },
          { value: 'maquillage', label: 'Maquillage' },
          { value: 'soin_cheveux', label: 'Soin cheveux' },
        ],
      },
      {
        id: 'marqueCosmetique',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'loreal', label: 'L\'Oréal' },
          { value: 'nivea', label: 'Nivea' },
          { value: 'dove', label: 'Dove' },
          { value: 'dior', label: 'Dior' },
          { value: 'chanel', label: 'Chanel' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'typePeau',
        label: 'Type de peau',
        type: 'select',
        options: [
          { value: 'normale', label: 'Normale' },
          { value: 'seche', label: 'Sèche' },
          { value: 'grasse', label: 'Grasse' },
          { value: 'mixte', label: 'Mixte' },
          { value: 'sensible', label: 'Sensible' },
        ],
      },
      {
        id: 'origineCosmetique',
        label: 'Origine',
        type: 'select',
        options: [
          { value: 'locale', label: 'Locale' },
          { value: 'importee', label: 'Importée' },
          { value: 'bio', label: 'Bio' },
        ],
      },
    ],
    style: {
      primaryColor: '#E91E63',
      gradientColors: ['#E91E63', '#C2185B'],
      icon: '✨',
      badgeColor: '#FCE4EC',
      accentColor: '#C2185B',
    },
    displayPriority: ['typeCosmetique', 'marqueCosmetique', 'volumeCosmetique', 'origineCosmetique', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 💎 BIJOUX
  bijoux: {
    terminology: {
      productLabel: 'Bijou',
      productsLabel: 'Bijoux',
      priceLabel: 'Prix',
      locationLabel: 'Bijouterie',
      providerLabel: 'Bijoutier',
      searchPlaceholder: 'Rechercher bijoux, montres...',
      emptyMessage: 'Aucun bijou disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeBijou',
        label: 'Type de bijou',
        type: 'select',
        options: [
          { value: 'collier', label: 'Collier' },
          { value: 'bague', label: 'Bague' },
          { value: 'bracelet', label: 'Bracelet' },
          { value: 'boucles_oreilles', label: 'Boucles d\'oreilles' },
          { value: 'montre', label: 'Montre' },
          { value: 'broche', label: 'Broche' },
        ],
      },
      {
        id: 'matiereBijou',
        label: 'Matière',
        type: 'select',
        options: [
          { value: 'or', label: 'Or' },
          { value: 'argent', label: 'Argent' },
          { value: 'platine', label: 'Platine' },
          { value: 'acier', label: 'Acier inoxydable' },
          { value: 'fantaisie', label: 'Fantaisie' },
        ],
      },
      {
        id: 'styleBijou',
        label: 'Style',
        type: 'select',
        options: [
          { value: 'classique', label: 'Classique' },
          { value: 'moderne', label: 'Moderne' },
          { value: 'vintage', label: 'Vintage' },
          { value: 'ethnique', label: 'Ethnique' },
        ],
      },
      {
        id: 'certificatBijou',
        label: 'Avec certificat',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#FFD700',
      gradientColors: ['#FFD700', '#FFA500'],
      icon: '💎',
      badgeColor: '#FFFACD',
      accentColor: '#FFA500',
    },
    displayPriority: ['typeBijou', 'matiereBijou', 'poidsBijou', 'styleBijou', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 💇‍♀️ COIFFURE & BEAUTÉ
  coiffure_beaute: {
    terminology: {
      productLabel: 'Article de coiffure',
      productsLabel: 'Coiffure & Beauté',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher mèches, perruques...',
      emptyMessage: 'Aucun article de coiffure disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeCoiffure',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'meches', label: 'Mèches' },
          { value: 'perruque', label: 'Perruque' },
          { value: 'extension', label: 'Extensions' },
          { value: 'tissage', label: 'Tissage' },
          { value: 'accessoire', label: 'Accessoires' },
        ],
      },
      {
        id: 'longueurMech',
        label: 'Longueur',
        type: 'select',
        options: [
          { value: 'courte', label: 'Courte (< 20cm)' },
          { value: 'moyenne', label: 'Moyenne (20-40cm)' },
          { value: 'longue', label: 'Longue (> 40cm)' },
        ],
      },
      {
        id: 'textureMech',
        label: 'Texture',
        type: 'select',
        options: [
          { value: 'lisse', label: 'Lisse' },
          { value: 'ondule', label: 'Ondulé' },
          { value: 'boucle', label: 'Bouclé' },
          { value: 'crepus', label: 'Crépu' },
        ],
      },
      {
        id: 'typeCheveux',
        label: 'Type de cheveux',
        type: 'select',
        options: [
          { value: 'naturel', label: 'Naturel' },
          { value: 'synthetique', label: 'Synthétique' },
          { value: 'mixte', label: 'Mixte' },
        ],
      },
      {
        id: 'origineMech',
        label: 'Origine',
        type: 'select',
        options: [
          { value: 'bresilienne', label: 'Brésilienne' },
          { value: 'indienne', label: 'Indienne' },
          { value: 'peruvienne', label: 'Péruvienne' },
          { value: 'malaisienne', label: 'Malaisienne' },
          { value: 'autre', label: 'Autre' },
        ],
      },
    ],
    style: {
      primaryColor: '#E91E63',
      gradientColors: ['#E91E63', '#C2185B'],
      icon: '💇‍♀️',
      badgeColor: '#FCE4EC',
      accentColor: '#C2185B',
    },
    displayPriority: ['typeCoiffure', 'longueurMech', 'textureMech', 'typeCheveux', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🏨 HÔTELLERIE
  hotellerie: {
    terminology: {
      productLabel: 'Hébergement',
      productsLabel: 'Hébergements',
      priceLabel: 'Prix/nuit',
      locationLabel: 'Adresse',
      providerLabel: 'Hôtel',
      searchPlaceholder: 'Rechercher un hôtel, chambre d\'hôtes...',
      emptyMessage: 'Aucun hébergement disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeHebergement',
        label: 'Type d\'hébergement',
        type: 'select',
        options: [
          { value: 'hotel', label: 'Hôtel' },
          { value: 'chambre_hotes', label: 'Chambre d\'hôtes' },
          { value: 'auberge', label: 'Auberge' },
          { value: 'gite', label: 'Gîte' },
          { value: 'motel', label: 'Motel' },
        ],
      },
      {
        id: 'categorieHotel',
        label: 'Classement',
        type: 'select',
        options: [
          { value: '1_etoile', label: '1 étoile' },
          { value: '2_etoiles', label: '2 étoiles' },
          { value: '3_etoiles', label: '3 étoiles' },
          { value: '4_etoiles', label: '4 étoiles' },
          { value: '5_etoiles', label: '5 étoiles' },
          { value: 'palace', label: 'Palace' },
        ],
      },
      {
        id: 'nbChambresHotel',
        label: 'Nombre de chambres',
        type: 'range',
        min: 1,
        max: 100,
        unit: 'chambres',
      },
      {
        id: 'equipementsHotel',
        label: 'Équipements et services',
        type: 'multiselect',
        options: [
          { value: 'petit_dejeuner', label: 'Petit-déjeuner' },
          { value: 'wifi', label: 'Wi-Fi gratuit' },
          { value: 'piscine', label: 'Piscine' },
          { value: 'parking', label: 'Parking' },
          { value: 'restaurant', label: 'Restaurant' },
          { value: 'spa', label: 'Spa' },
          { value: 'climatisation', label: 'Climatisation' },
          { value: 'salle_sport', label: 'Salle de sport' },
        ],
      },
    ],
    style: {
      primaryColor: '#EC4899',
      gradientColors: ['#EC4899', '#DB2777'],
      icon: '🏨',
      badgeColor: '#FCE7F3',
      accentColor: '#DB2777',
    },
    displayPriority: ['typeHebergement', 'etoiles', 'nbPersonnes', 'services', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🍽️ RESTAURATION
  restauration: {
    terminology: {
      productLabel: 'Établissement',
      productsLabel: 'Restaurants & Traiteurs',
      priceLabel: 'Prix moyen',
      locationLabel: 'Adresse',
      providerLabel: 'Restaurant',
      searchPlaceholder: 'Rechercher un restaurant, traiteur...',
      emptyMessage: 'Aucun établissement disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeCuisine',
        label: 'Type de cuisine',
        type: 'select',
        options: [
          { value: 'camerounaise', label: 'Camerounaise' },
          { value: 'africaine', label: 'Africaine' },
          { value: 'europeenne', label: 'Européenne' },
          { value: 'asiatique', label: 'Asiatique' },
          { value: 'italienne', label: 'Italienne' },
          { value: 'libanaise', label: 'Libanaise' },
          { value: 'grillades', label: 'Grillades' },
        ],
      },
      {
        id: 'specialites',
        label: 'Spécialités',
        type: 'multiselect',
        options: [
          { value: 'poisson', label: 'Poisson' },
          { value: 'viande', label: 'Viande' },
          { value: 'pizza', label: 'Pizza' },
          { value: 'vegetarien', label: 'Végétarien' },
          { value: 'fruits_mer', label: 'Fruits de mer' },
        ],
      },
      {
        id: 'servicesRestau',
        label: 'Services proposés',
        type: 'multiselect',
        options: [
          { value: 'livraison', label: 'Livraison' },
          { value: 'terrasse', label: 'Terrasse' },
          { value: 'wifi', label: 'Wi-Fi' },
          { value: 'parking', label: 'Parking' },
          { value: 'climatisation', label: 'Climatisation' },
          { value: 'traiteur', label: 'Service traiteur' },
        ],
      },
      {
        id: 'gammePrix',
        label: 'Gamme de prix',
        type: 'select',
        options: [
          { value: 'economique', label: 'Économique' },
          { value: 'moyen', label: 'Moyen' },
          { value: 'eleve', label: 'Élevé' },
          { value: 'luxe', label: 'Luxe' },
        ],
      },
      {
        id: 'capacite',
        label: 'Capacité',
        type: 'range',
        min: 10,
        max: 500,
        unit: 'personnes',
      },
    ],
    style: {
      primaryColor: '#F97316',
      gradientColors: ['#F97316', '#EA580C'],
      icon: '🍽️',
      badgeColor: '#FFEDD5',
      accentColor: '#EA580C',
    },
    displayPriority: ['typeRestaurant', 'cuisineType', 'livraison', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 💪 SPORT & FITNESS
  sport_fitness: {
    terminology: {
      productLabel: 'Activité sportive',
      productsLabel: 'Sport & Fitness',
      priceLabel: 'Tarif',
      locationLabel: 'Adresse',
      providerLabel: 'Coach/Salle',
      searchPlaceholder: 'Rechercher une salle, coach...',
      emptyMessage: 'Aucune activité sportive disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeSport',
        label: 'Type d\'activité',
        type: 'select',
        options: [
          { value: 'musculation', label: 'Musculation' },
          { value: 'cardio', label: 'Cardio' },
          { value: 'yoga', label: 'Yoga' },
          { value: 'pilates', label: 'Pilates' },
          { value: 'crossfit', label: 'CrossFit' },
          { value: 'boxe', label: 'Boxe' },
          { value: 'natation', label: 'Natation' },
          { value: 'danse', label: 'Danse' },
        ],
      },
      {
        id: 'niveauSport',
        label: 'Niveau',
        type: 'select',
        options: [
          { value: 'debutant', label: 'Débutant' },
          { value: 'intermediaire', label: 'Intermédiaire' },
          { value: 'avance', label: 'Avancé' },
          { value: 'expert', label: 'Expert' },
        ],
      },
      {
        id: 'dureeSport',
        label: 'Durée',
        type: 'select',
        options: [
          { value: '30min', label: '30 minutes' },
          { value: '1h', label: '1 heure' },
          { value: '1h30', label: '1h30' },
          { value: '2h', label: '2 heures' },
        ],
      },
      {
        id: 'equipementsSport',
        label: 'Équipements fournis',
        type: 'multiselect',
        options: [
          { value: 'tapis', label: 'Tapis de yoga' },
          { value: 'halteres', label: 'Haltères' },
          { value: 'vestiaire', label: 'Vestiaire' },
          { value: 'douche', label: 'Douches' },
          { value: 'casiers', label: 'Casiers' },
        ],
      },
    ],
    style: {
      primaryColor: '#EF4444',
      gradientColors: ['#EF4444', '#DC2626'],
      icon: '💪',
      badgeColor: '#FEE2E2',
      accentColor: '#DC2626',
    },
    displayPriority: ['typeSport', 'niveau', 'coaching', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🎓 FORMATION & ÉDUCATION
  formation_education: {
    terminology: {
      productLabel: 'Formation',
      productsLabel: 'Formations',
      priceLabel: 'Tarif',
      locationLabel: 'Lieu',
      providerLabel: 'Formateur',
      searchPlaceholder: 'Rechercher une formation...',
      emptyMessage: 'Aucune formation disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeFormation',
        label: 'Type de formation',
        type: 'select',
        options: [
          { value: 'informatique', label: 'Informatique' },
          { value: 'langues', label: 'Langues' },
          { value: 'management', label: 'Management' },
          { value: 'bureautique', label: 'Bureautique' },
          { value: 'comptabilite', label: 'Comptabilité' },
          { value: 'marketing', label: 'Marketing' },
        ],
      },
      {
        id: 'niveauFormation',
        label: 'Niveau',
        type: 'select',
        options: [
          { value: 'debutant', label: 'Débutant' },
          { value: 'intermediaire', label: 'Intermédiaire' },
          { value: 'avance', label: 'Avancé' },
          { value: 'expert', label: 'Expert' },
        ],
      },
      {
        id: 'modeFormation',
        label: 'Mode',
        type: 'select',
        options: [
          { value: 'presentiel', label: 'Présentiel' },
          { value: 'en_ligne', label: 'En ligne' },
          { value: 'hybride', label: 'Hybride' },
          { value: 'classe_virtuelle', label: 'Classe virtuelle' },
        ],
      },
      {
        id: 'dureeFormation',
        label: 'Durée',
        type: 'select',
        options: [
          { value: '1_jour', label: '1 jour' },
          { value: '1_semaine', label: '1 semaine' },
          { value: '1_mois', label: '1 mois' },
          { value: '3_mois', label: '3 mois' },
          { value: '6_mois', label: '6+ mois' },
        ],
      },
      {
        id: 'certificationFormation',
        label: 'Avec certification',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#7C3AED',
      gradientColors: ['#7C3AED', '#6D28D9'],
      icon: '🎓',
      badgeColor: '#EDE9FE',
      accentColor: '#6D28D9',
    },
    displayPriority: ['domaine', 'format', 'certification', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🎉 ÉVÉNEMENTIEL
  evenementiel: {
    terminology: {
      productLabel: 'Prestation événementielle',
      productsLabel: 'Événementiel',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Organisateur',
      searchPlaceholder: 'Rechercher une prestation événementielle...',
      emptyMessage: 'Aucune prestation disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeEvenement',
        label: 'Type d\'événement',
        type: 'multiselect',
        options: [
          { value: 'mariage', label: 'Mariage' },
          { value: 'anniversaire', label: 'Anniversaire' },
          { value: 'bapteme', label: 'Baptême' },
          { value: 'entreprise', label: 'Événement d\'entreprise' },
          { value: 'conference', label: 'Conférence' },
          { value: 'concert', label: 'Concert' },
          { value: 'gala', label: 'Gala' },
        ],
      },
      {
        id: 'capaciteEvenement',
        label: 'Capacité',
        type: 'range',
        min: 10,
        max: 1000,
        unit: 'personnes',
      },
      {
        id: 'servicesEvenement',
        label: 'Services inclus',
        type: 'multiselect',
        options: [
          { value: 'decoration', label: 'Décoration' },
          { value: 'traiteur', label: 'Traiteur' },
          { value: 'sono', label: 'Sonorisation' },
          { value: 'animation', label: 'Animation' },
          { value: 'photographie', label: 'Photographie' },
          { value: 'location_salle', label: 'Location salle' },
        ],
      },
      {
        id: 'dureeEvenement',
        label: 'Durée',
        type: 'select',
        options: [
          { value: 'demi_journee', label: 'Demi-journée' },
          { value: 'journee', label: 'Journée' },
          { value: 'soiree', label: 'Soirée' },
          { value: 'week_end', label: 'Week-end' },
        ],
      },
    ],
    style: {
      primaryColor: '#EC4899',
      gradientColors: ['#EC4899', '#DB2777'],
      icon: '🎉',
      badgeColor: '#FCE7F3',
      accentColor: '#DB2777',
    },
    displayPriority: ['typeEvenement', 'nbPersonnes', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // ⚡ ÉLECTRICITÉ
  electricite: {
    terminology: {
      productLabel: 'Article électrique',
      productsLabel: 'Électricité',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher câbles, prises...',
      emptyMessage: 'Aucun article électrique disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'categorieElectrique',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'cable', label: 'Câbles' },
          { value: 'interrupteur', label: 'Interrupteurs' },
          { value: 'prise', label: 'Prises' },
          { value: 'lampe', label: 'Lampes' },
          { value: 'disjoncteur', label: 'Disjoncteurs' },
        ],
      },
      {
        id: 'marqueElectrique',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'legrand', label: 'Legrand' },
          { value: 'schneider', label: 'Schneider Electric' },
          { value: 'nexans', label: 'Nexans' },
          { value: 'hager', label: 'Hager' },
          { value: 'abb', label: 'ABB' },
        ],
      },
      {
        id: 'tension',
        label: 'Tension',
        type: 'select',
        options: [
          { value: '12v', label: '12V' },
          { value: '24v', label: '24V' },
          { value: '220v', label: '220V' },
          { value: '380v', label: '380V (Triphasé)' },
        ],
      },
    ],
    style: {
      primaryColor: '#FFC107',
      gradientColors: ['#FFC107', '#FFA000'],
      icon: '⚡',
      badgeColor: '#FFF9C4',
      accentColor: '#FFA000',
    },
    displayPriority: ['categorieElectrique', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🚰 PLOMBERIE
  plomberie: {
    terminology: {
      productLabel: 'Prestation plomberie',
      productsLabel: 'Plomberie',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Plombier',
      searchPlaceholder: 'Rechercher un plombier...',
      emptyMessage: 'Aucun plombier disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeIntervention',
        label: 'Type d\'intervention',
        type: 'multiselect',
        options: [
          { value: 'fuite', label: 'Réparation fuite' },
          { value: 'debouchage', label: 'Débouchage' },
          { value: 'installation', label: 'Installation' },
          { value: 'urgence', label: 'Urgence' },
        ],
      },
      {
        id: 'urgence24h',
        label: 'Dépannage 24h/24',
        type: 'toggle',
      },
      {
        id: 'equipementsPlomberie',
        label: 'Équipements',
        type: 'multiselect',
        options: [
          { value: 'camera', label: 'Caméra d\'inspection' },
          { value: 'detecteur', label: 'Détecteur de fuite' },
          { value: 'deboucheur', label: 'Déboucheur professionnel' },
          { value: 'soudure', label: 'Équipement de soudure' },
        ],
      },
    ],
    style: {
      primaryColor: '#00BCD4',
      gradientColors: ['#00BCD4', '#0097A7'],
      icon: '🚰',
      badgeColor: '#E0F7FA',
      accentColor: '#0097A7',
    },
    displayPriority: ['typeIntervention', 'urgence24h', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🪵 MENUISERIE
  menuiserie: {
    terminology: {
      productLabel: 'Prestation menuiserie',
      productsLabel: 'Menuiserie',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Menuisier',
      searchPlaceholder: 'Rechercher un menuisier...',
      emptyMessage: 'Aucun menuisier disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeMenuiserie',
        label: 'Type',
        type: 'multiselect',
        options: [
          { value: 'meuble', label: 'Meubles sur mesure' },
          { value: 'porte', label: 'Portes' },
          { value: 'fenetre', label: 'Fenêtres' },
          { value: 'parquet', label: 'Parquet' },
          { value: 'charpente', label: 'Charpente' },
        ],
      },
      {
        id: 'materiaux',
        label: 'Matériaux',
        type: 'multiselect',
        options: [
          { value: 'chene', label: 'Chêne' },
          { value: 'pin', label: 'Pin' },
          { value: 'acajou', label: 'Acajou' },
          { value: 'mdf', label: 'MDF' },
          { value: 'contreplaque', label: 'Contreplaqué' },
        ],
      },
      {
        id: 'finitions',
        label: 'Finitions',
        type: 'select',
        options: [
          { value: 'vernis', label: 'Vernis' },
          { value: 'peinture', label: 'Peinture' },
          { value: 'lasure', label: 'Lasure' },
          { value: 'naturel', label: 'Naturel' },
          { value: 'laque', label: 'Laqué' },
        ],
      },
    ],
    style: {
      primaryColor: '#F97316',
      gradientColors: ['#F97316', '#EA580C'],
      icon: '🪵',
      badgeColor: '#FFEDD5',
      accentColor: '#EA580C',
    },
    displayPriority: ['typeMenuiserie', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🌳 JARDINAGE & PAYSAGISME
  jardinage_paysagisme: {
    terminology: {
      productLabel: 'Prestation jardinage',
      productsLabel: 'Jardinage & Paysagisme',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Jardinier/Paysagiste',
      searchPlaceholder: 'Rechercher un jardinier...',
      emptyMessage: 'Aucun service disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeJardinage',
        label: 'Type de service',
        type: 'multiselect',
        options: [
          { value: 'tonte', label: 'Tonte pelouse' },
          { value: 'taille', label: 'Taille haies' },
          { value: 'elagage', label: 'Élagage' },
          { value: 'plantation', label: 'Plantation' },
          { value: 'creation', label: 'Création espaces verts' },
          { value: 'entretien', label: 'Entretien régulier' },
        ],
      },
      {
        id: 'saisonJardinage',
        label: 'Saison recommandée',
        type: 'select',
        options: [
          { value: 'printemps', label: 'Printemps' },
          { value: 'ete', label: 'Été' },
          { value: 'automne', label: 'Automne' },
          { value: 'hiver', label: 'Hiver' },
          { value: 'toute_annee', label: 'Toute l\'année' },
        ],
      },
      {
        id: 'surfaceJardinage',
        label: 'Surface',
        type: 'range',
        min: 10,
        max: 5000,
        unit: 'm²',
      },
    ],
    style: {
      primaryColor: '#059669',
      gradientColors: ['#059669', '#047857'],
      icon: '🌳',
      badgeColor: '#D1FAE5',
      accentColor: '#047857',
    },
    displayPriority: ['typeService', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🧹 NETTOYAGE & ENTRETIEN
  nettoyage_entretien: {
    terminology: {
      productLabel: 'Service de nettoyage',
      productsLabel: 'Nettoyage & Entretien',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Entreprise/Agent',
      searchPlaceholder: 'Rechercher un service de nettoyage...',
      emptyMessage: 'Aucun service disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeNettoyage',
        label: 'Type de service',
        type: 'select',
        options: [
          { value: 'menage', label: 'Ménage' },
          { value: 'bureaux', label: 'Bureaux' },
          { value: 'vitres', label: 'Vitres' },
          { value: 'fin_chantier', label: 'Fin de chantier' },
          { value: 'industriel', label: 'Nettoyage industriel' },
        ],
      },
      {
        id: 'frequenceNettoyage',
        label: 'Fréquence',
        type: 'select',
        options: [
          { value: 'ponctuel', label: 'Ponctuel' },
          { value: 'hebdomadaire', label: 'Hebdomadaire' },
          { value: 'bi_hebdomadaire', label: 'Bi-hebdomadaire' },
          { value: 'mensuel', label: 'Mensuel' },
        ],
      },
      {
        id: 'surfaceNettoyage',
        label: 'Surface',
        type: 'range',
        min: 10,
        max: 1000,
        unit: 'm²',
      },
      {
        id: 'equipementsNettoyage',
        label: 'Équipements fournis',
        type: 'multiselect',
        options: [
          { value: 'aspirateur', label: 'Aspirateur' },
          { value: 'produits', label: 'Produits d\'entretien' },
          { value: 'materiel', label: 'Matériel professionnel' },
        ],
      },
    ],
    style: {
      primaryColor: '#6B7280',
      gradientColors: ['#6B7280', '#4B5563'],
      icon: '🧹',
      badgeColor: '#F3F4F6',
      accentColor: '#4B5563',
    },
    displayPriority: ['typeNettoyage', 'frequence', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🧘 BIEN-ÊTRE & SPA
  bien_etre_spa: {
    terminology: {
      productLabel: 'Soin bien-être',
      productsLabel: 'Bien-être & Spa',
      priceLabel: 'Tarif',
      locationLabel: 'Adresse',
      providerLabel: 'Spa/Thérapeute',
      searchPlaceholder: 'Rechercher un spa, massage...',
      emptyMessage: 'Aucun soin disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeSoin',
        label: 'Type de soin',
        type: 'multiselect',
        options: [
          { value: 'massage', label: 'Massage' },
          { value: 'spa', label: 'Spa' },
          { value: 'hammam', label: 'Hammam' },
          { value: 'sauna', label: 'Sauna' },
          { value: 'reflexologie', label: 'Réflexologie' },
        ],
      },
    ],
    style: {
      primaryColor: '#14B8A6',
      gradientColors: ['#14B8A6', '#0D9488'],
      icon: '🧘',
      badgeColor: '#CCFBF1',
      accentColor: '#0D9488',
    },
    displayPriority: ['typeSoin', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🌾 AGROALIMENTAIRE
  agroalimentaire: {
    terminology: {
      productLabel: 'Produit agroalimentaire',
      productsLabel: 'Agroalimentaire',
      priceLabel: 'Prix',
      locationLabel: 'Point de vente',
      providerLabel: 'Fournisseur',
      searchPlaceholder: 'Rechercher riz, pâtes, huile...',
      emptyMessage: 'Aucun produit disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'categorieAgro',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'cereales', label: 'Céréales' },
          { value: 'huiles', label: 'Huiles' },
          { value: 'conserves', label: 'Conserves' },
          { value: 'boissons', label: 'Boissons' },
          { value: 'epicerie', label: 'Épicerie' },
        ],
      },
    ],
    style: {
      primaryColor: '#F59E0B',
      gradientColors: ['#F59E0B', '#D97706'],
      icon: '🌾',
      badgeColor: '#FEF3C7',
      accentColor: '#D97706',
    },
    displayPriority: ['categorieAgro', 'marque', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🌱 AGRICULTURE
  agriculture: {
    terminology: {
      productLabel: 'Produit agricole',
      productsLabel: 'Agriculture',
      priceLabel: 'Prix',
      locationLabel: 'Exploitation',
      providerLabel: 'Agriculteur',
      searchPlaceholder: 'Rechercher produits agricoles...',
      emptyMessage: 'Aucun produit disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeAgricole',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'cereale', label: 'Céréales' },
          { value: 'legume', label: 'Légumes' },
          { value: 'fruit', label: 'Fruits' },
          { value: 'elevage', label: 'Élevage' },
        ],
      },
      {
        id: 'bio',
        label: 'Agriculture biologique',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#10B981',
      gradientColors: ['#10B981', '#059669'],
      icon: '🌱',
      badgeColor: '#D1FAE5',
      accentColor: '#059669',
    },
    displayPriority: ['typeAgricole', 'bio', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 🧸 JOUETS & ENFANTS
  jouets_enfants: {
    terminology: {
      productLabel: 'Jouet',
      productsLabel: 'Jouets & Enfants',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher des jouets...',
      emptyMessage: 'Aucun jouet disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'ageJouet',
        label: 'Tranche d\'âge',
        type: 'select',
        options: [
          { value: '0_3', label: '0-3 ans' },
          { value: '3_6', label: '3-6 ans' },
          { value: '6_12', label: '6-12 ans' },
          { value: '12_plus', label: '12+ ans' },
        ],
      },
      {
        id: 'typeJouet',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'peluche', label: 'Peluche' },
          { value: 'educatif', label: 'Éducatif' },
          { value: 'construction', label: 'Construction' },
          { value: 'jeu_societe', label: 'Jeu de société' },
        ],
      },
    ],
    style: {
      primaryColor: '#FF69B4',
      gradientColors: ['#FF69B4', '#FF1493'],
      icon: '🧸',
      badgeColor: '#FFE4E1',
      accentColor: '#FF1493',
    },
    displayPriority: ['typeJouet', 'ageJouet', 'marque', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🔧 PIÈCES AUTO
  pieces_auto: {
    terminology: {
      productLabel: 'Pièce auto',
      productsLabel: 'Pièces Auto',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher pièces auto...',
      emptyMessage: 'Aucune pièce disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'categoriePiece',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'moteur', label: 'Moteur' },
          { value: 'freins', label: 'Freins' },
          { value: 'carrosserie', label: 'Carrosserie' },
          { value: 'filtres', label: 'Filtres' },
          { value: 'batterie', label: 'Batteries' },
        ],
      },
      {
        id: 'marqueVehicule',
        label: 'Marque véhicule',
        type: 'select',
        options: [
          { value: 'toyota', label: 'Toyota' },
          { value: 'mercedes', label: 'Mercedes' },
          { value: 'bmw', label: 'BMW' },
          { value: 'nissan', label: 'Nissan' },
        ],
      },
    ],
    style: {
      primaryColor: '#607D8B',
      gradientColors: ['#607D8B', '#455A64'],
      icon: '🔧',
      badgeColor: '#CFD8DC',
      accentColor: '#455A64',
    },
    displayPriority: ['categoriePiece', 'marqueVehicule', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // ⚙️ PIÈCES INDUSTRIELLES
  pieces_industrielles: {
    terminology: {
      productLabel: 'Pièce industrielle',
      productsLabel: 'Pièces Industrielles',
      priceLabel: 'Prix',
      locationLabel: 'Fournisseur',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher pièces industrielles...',
      emptyMessage: 'Aucune pièce disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeIndustriel',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'roulement', label: 'Roulements' },
          { value: 'courroie', label: 'Courroies' },
          { value: 'moteur', label: 'Moteurs' },
          { value: 'pompe', label: 'Pompes' },
        ],
      },
    ],
    style: {
      primaryColor: '#455A64',
      gradientColors: ['#455A64', '#263238'],
      icon: '⚙️',
      badgeColor: '#ECEFF1',
      accentColor: '#263238',
    },
    displayPriority: ['typeIndustriel', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 📟 ÉLECTRONIQUE
  electronique: {
    terminology: {
      productLabel: 'Appareil électronique',
      productsLabel: 'Électronique',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher électronique...',
      emptyMessage: 'Aucun appareil disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeElectro',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'console', label: 'Console de jeux' },
          { value: 'drone', label: 'Drone' },
          { value: 'camera', label: 'Caméra' },
          { value: 'gadget', label: 'Gadget' },
        ],
      },
    ],
    style: {
      primaryColor: '#00BCD4',
      gradientColors: ['#00BCD4', '#0097A7'],
      icon: '📟',
      badgeColor: '#E0F7FA',
      accentColor: '#0097A7',
    },
    displayPriority: ['typeElectro', 'marque', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🎸 MUSIQUE & INSTRUMENTS
  musique_instruments: {
    terminology: {
      productLabel: 'Instrument de musique',
      productsLabel: 'Musique & Instruments',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher instruments...',
      emptyMessage: 'Aucun instrument disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeInstrument',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'guitare', label: 'Guitare' },
          { value: 'piano', label: 'Piano/Clavier' },
          { value: 'batterie', label: 'Batterie' },
          { value: 'vent', label: 'Instruments à vent' },
          { value: 'percussion', label: 'Percussions' },
        ],
      },
    ],
    style: {
      primaryColor: '#9C27B0',
      gradientColors: ['#9C27B0', '#7B1FA2'],
      icon: '🎸',
      badgeColor: '#F3E5F5',
      accentColor: '#7B1FA2',
    },
    displayPriority: ['typeInstrument', 'marque', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 🛡️ SÉCURITÉ & SURVEILLANCE
  securite_surveillance: {
    terminology: {
      productLabel: 'Service de sécurité',
      productsLabel: 'Sécurité & Surveillance',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Entreprise de sécurité',
      searchPlaceholder: 'Rechercher service de sécurité...',
      emptyMessage: 'Aucun service disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeSecurite',
        label: 'Type',
        type: 'multiselect',
        options: [
          { value: 'gardiennage', label: 'Gardiennage' },
          { value: 'surveillance', label: 'Surveillance' },
          { value: 'alarme', label: 'Installation alarme' },
          { value: 'camera', label: 'Vidéosurveillance' },
        ],
      },
      {
        id: 'garde24h',
        label: '24h/24',
        type: 'toggle',
      },
      {
        id: 'zoneSecurite',
        label: 'Type de zone',
        type: 'select',
        options: [
          { value: 'residentiel', label: 'Résidentiel' },
          { value: 'commercial', label: 'Commercial' },
          { value: 'industriel', label: 'Industriel' },
          { value: 'evenementiel', label: 'Événementiel' },
        ],
      },
      {
        id: 'dureeSecurite',
        label: 'Durée du contrat',
        type: 'select',
        options: [
          { value: '1_mois', label: '1 mois' },
          { value: '3_mois', label: '3 mois' },
          { value: '6_mois', label: '6 mois' },
          { value: '1_an', label: '1 an' },
          { value: 'longue_duree', label: 'Longue durée' },
        ],
      },
      {
        id: 'equipementsSecurite',
        label: 'Équipements',
        type: 'multiselect',
        options: [
          { value: 'cameras', label: 'Caméras' },
          { value: 'alarme', label: 'Système d\'alarme' },
          { value: 'badge', label: 'Badges d\'accès' },
          { value: 'centrale', label: 'Centrale de surveillance' },
        ],
      },
    ],
    style: {
      primaryColor: '#DC2626',
      gradientColors: ['#DC2626', '#B91C1C'],
      icon: '🛡️',
      badgeColor: '#FEE2E2',
      accentColor: '#B91C1C',
    },
    displayPriority: ['typeSecurite', 'garde24h', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🐾 ANIMAUX & VÉTÉRINAIRE
  animaux_veterinaire: {
    terminology: {
      productLabel: 'Service vétérinaire',
      productsLabel: 'Animaux & Vétérinaire',
      priceLabel: 'Tarif',
      locationLabel: 'Adresse',
      providerLabel: 'Vétérinaire',
      searchPlaceholder: 'Rechercher vétérinaire...',
      emptyMessage: 'Aucun service disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeAnimal',
        label: 'Type d\'animal',
        type: 'select',
        options: [
          { value: 'chien', label: 'Chien' },
          { value: 'chat', label: 'Chat' },
          { value: 'oiseau', label: 'Oiseau' },
          { value: 'rongeur', label: 'Rongeur' },
          { value: 'reptile', label: 'Reptile' },
        ],
      },
      {
        id: 'servicesVeterinaire',
        label: 'Services',
        type: 'multiselect',
        options: [
          { value: 'consultation', label: 'Consultation' },
          { value: 'vaccination', label: 'Vaccination' },
          { value: 'toilettage', label: 'Toilettage' },
          { value: 'dressage', label: 'Dressage' },
          { value: 'pension', label: 'Pension' },
          { value: 'urgence', label: 'Urgences' },
        ],
      },
      {
        id: 'raceAnimal',
        label: 'Race',
        type: 'select',
        options: [
          { value: 'labrador', label: 'Labrador' },
          { value: 'berger', label: 'Berger Allemand' },
          { value: 'siamois', label: 'Siamois' },
          { value: 'persan', label: 'Persan' },
          { value: 'autre', label: 'Autre' },
        ],
      },
      {
        id: 'ageAnimal',
        label: 'Tranche d\'âge',
        type: 'select',
        options: [
          { value: 'chiot_chaton', label: 'Chiot/Chaton' },
          { value: 'jeune', label: 'Jeune (1-3 ans)' },
          { value: 'adulte', label: 'Adulte (3-10 ans)' },
          { value: 'senior', label: 'Senior (10+ ans)' },
        ],
      },
    ],
    style: {
      primaryColor: '#FF69B4',
      gradientColors: ['#FF69B4', '#FF1493'],
      icon: '🐾',
      badgeColor: '#FFE4E1',
      accentColor: '#FF1493',
    },
    displayPriority: ['typeService', 'typeAnimal', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // Configuration par défaut pour les catégories non spécifiées
  default: {
    terminology: {
      productLabel: 'Produit',
      productsLabel: 'Produits',
      priceLabel: 'Prix',
      locationLabel: 'Localisation',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher...',
      emptyMessage: 'Aucun résultat trouvé',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'etat',
        label: 'État',
        type: 'select',
        options: [
          { value: 'neuf', label: 'Neuf' },
          { value: 'occasion', label: 'Occasion' },
        ],
      },
    ],
    style: {
      primaryColor: '#6B7280',
      gradientColors: ['#6B7280', '#4B5563'],
      icon: '📦',
      badgeColor: '#F3F4F6',
      accentColor: '#4B5563',
    },
    displayPriority: ['nom', 'description', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },
};

/**
 * Récupère la configuration pour une catégorie donnée
 */
export const getCategoryConfig = (category: string): CategoryConfig => {
  return CATEGORY_CONFIGS[category] || CATEGORY_CONFIGS.default;
};

/**
 * Récupère la terminologie pour une catégorie donnée
 */
export const getCategoryTerminology = (category: string): CategoryTerminology => {
  return getCategoryConfig(category).terminology;
};

/**
 * Récupère les filtres pour une catégorie donnée
 */
export const getCategoryFilters = (category: string): CategoryFilter[] => {
  return getCategoryConfig(category).filters;
};

/**
 * Récupère le style pour une catégorie donnée
 */
export const getCategoryStyle = (category: string): CategoryStyle => {
  return getCategoryConfig(category).style;
};
