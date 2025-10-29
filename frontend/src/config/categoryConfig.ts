/**
 * Configuration intelligente des catégories de produits pour le frontend
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
  searchKeywords?: string[]; // ✅ NOUVEAU: Mots-clés pour différencier les catégories
}

// Configuration par catégorie (même structure que mobile mais adaptée au web)
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
        id: 'typeTransaction',
        label: 'Type de transaction',
        type: 'select',
        options: [
          { value: 'vente', label: 'Vente' },
          { value: 'location', label: 'Location' },
          { value: 'colocation', label: 'Colocation' },
        ],
      },
      {
        id: 'typeBatiment',
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
        id: 'nbPieces',
        label: 'Nombre de pièces',
        type: 'range',
        min: 1,
        max: 10,
        unit: 'pièces',
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
        id: 'meuble',
        label: 'Meublé',
        type: 'toggle',
      },
      {
        id: 'equipements',
        label: 'Équipements',
        type: 'multiselect',
        options: [
          { value: 'climatisation', label: 'Climatisation' },
          { value: 'piscine', label: 'Piscine' },
          { value: 'jardin', label: 'Jardin' },
          { value: 'parking', label: 'Parking' },
          { value: 'gardien', label: 'Gardien' },
          { value: 'eau_courante', label: 'Eau courante' },
          { value: 'electricite', label: 'Électricité' },
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
        id: 'superficie',
        label: 'Superficie',
        type: 'range',
        min: 0,
        max: 10000,
        unit: 'm²',
      },
      {
        id: 'typeTerrain',
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
        id: 'viabilise',
        label: 'Viabilisé',
        type: 'toggle',
      },
      {
        id: 'titreFoncier',
        label: 'Titre foncier',
        type: 'toggle',
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
        id: 'typeVehicule',
        label: 'Type de véhicule',
        type: 'select',
        options: [
          { value: 'voiture', label: 'Voiture' },
          { value: 'moto', label: 'Moto' },
          { value: 'camion', label: 'Camion' },
          { value: 'bus', label: 'Bus' },
          { value: 'tricycle', label: 'Tricycle' },
        ],
      },
      {
        id: 'marque',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'toyota', label: 'Toyota' },
          { value: 'mercedes', label: 'Mercedes' },
          { value: 'bmw', label: 'BMW' },
          { value: 'nissan', label: 'Nissan' },
          { value: 'honda', label: 'Honda' },
          { value: 'yamaha', label: 'Yamaha' },
          { value: 'autre', label: 'Autre' },
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
        id: 'carburant',
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
        id: 'etat',
        label: 'État',
        type: 'select',
        options: [
          { value: 'neuf', label: 'Neuf' },
          { value: 'occasion', label: 'Occasion' },
          { value: 'accidente', label: 'Accidenté' },
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
        id: 'typeTransport',
        label: 'Type de transport',
        type: 'select',
        options: [
          { value: 'bus', label: 'Bus' },
          { value: 'train', label: 'Train' },
          { value: 'avion', label: 'Avion' },
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
      {
        id: 'classe',
        label: 'Classe',
        type: 'select',
        options: [
          { value: 'economique', label: 'Économique' },
          { value: 'vip', label: 'VIP' },
          { value: 'business', label: 'Business' },
        ],
      },
      {
        id: 'placesDisponibles',
        label: 'Places disponibles',
        type: 'range',
        min: 1,
        max: 50,
        unit: 'places',
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
        id: 'type',
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
        id: 'genre',
        label: 'Genre',
        type: 'select',
        options: [
          { value: 'homme', label: 'Homme' },
          { value: 'femme', label: 'Femme' },
          { value: 'enfant', label: 'Enfant' },
          { value: 'unisexe', label: 'Unisexe' },
        ],
      },
      {
        id: 'taille',
        label: 'Pointure',
        type: 'range',
        min: 20,
        max: 50,
        unit: '',
      },
      {
        id: 'marque',
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
      icon: '👟',
      badgeColor: '#FFEDD5',
      accentColor: '#EA580C',
    },
    displayPriority: ['type', 'marque', 'taille', 'couleur', 'prix'],
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
        id: 'typeVetement',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'haut', label: 'Haut' },
          { value: 'pantalon', label: 'Pantalon' },
          { value: 'robe', label: 'Robe' },
          { value: 'veste', label: 'Veste' },
          { value: 'costume', label: 'Costume' },
          { value: 'sportswear', label: 'Sportswear' },
        ],
      },
      {
        id: 'genre',
        label: 'Genre',
        type: 'select',
        options: [
          { value: 'homme', label: 'Homme' },
          { value: 'femme', label: 'Femme' },
          { value: 'enfant', label: 'Enfant' },
          { value: 'unisexe', label: 'Unisexe' },
        ],
      },
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
        id: 'marque',
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
        id: 'categorieElectro',
        label: 'Catégorie',
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
        id: 'marque',
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
        id: 'etatProduit',
        label: 'État',
        type: 'select',
        options: [
          { value: 'neuf', label: 'Neuf' },
          { value: 'occasion', label: 'Occasion' },
          { value: 'reconditionne', label: 'Reconditionné' },
        ],
      },
      {
        id: 'garantie',
        label: 'Avec garantie',
        type: 'toggle',
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
    searchKeywords: [
      // ✅ MOTS-CLÉS VENTE DE TÉLÉPHONES (pour différencier de la réparation)
      // Termes généraux VENTE
      'acheter téléphone', 'acheter telephone', 'acheter smartphone', 'achat téléphone', 'achat smartphone',
      'vendre téléphone', 'vendre telephone', 'vendre smartphone', 'vente téléphone', 'vente smartphone',
      'téléphone à vendre', 'telephone a vendre', 'smartphone à vendre', 'smartphone a vendre',
      'téléphone neuf', 'telephone neuf', 'smartphone neuf', 'téléphone occasion', 'telephone occasion',
      'téléphone reconditionné', 'telephone reconditionne', 'smartphone reconditionné',
      // Prix et état
      'prix téléphone', 'prix telephone', 'prix smartphone', 'prix iPhone', 'prix Samsung',
      'téléphone pas cher', 'telephone pas cher', 'smartphone pas cher',
      'téléphone bon état', 'telephone bon etat', 'téléphone excellent état',
      'téléphone sous garantie', 'telephone sous garantie', 'garantie constructeur',
      // Marques spécifiques VENTE
      'acheter iPhone', 'vendre iPhone', 'iPhone à vendre', 'iPhone neuf', 'iPhone occasion',
      'acheter Samsung', 'vendre Samsung', 'Samsung à vendre', 'Samsung Galaxy',
      'acheter Tecno', 'vendre Tecno', 'Tecno à vendre', 'Tecno neuf',
      'acheter Infinix', 'vendre Infinix', 'Infinix à vendre', 'Infinix neuf',
      'acheter Xiaomi', 'vendre Xiaomi', 'Xiaomi à vendre', 'Redmi à vendre',
      'acheter Itel', 'vendre Itel', 'Itel à vendre',
      // Caractéristiques techniques
      'téléphone 128GB', 'smartphone 128GB', 'téléphone 256GB',
      'téléphone 5G', 'smartphone 5G', 'téléphone dual SIM',
      'téléphone grande batterie', 'smartphone grande batterie',
      'téléphone bonne caméra', 'smartphone bonne camera',
      // Tablettes
      'acheter iPad', 'vendre iPad', 'iPad à vendre', 'tablette à vendre',
      'acheter tablette', 'vendre tablette', 'tablette Samsung',
      // Boutique/Vendeur
      'boutique téléphone', 'boutique smartphone', 'magasin téléphone',
      'vendeur téléphone', 'vendeur smartphone', 'revendeur téléphone',
    ],
  },

  // 🔧 RÉPARATEUR TÉLÉPHONE/SMARTPHONE & TABLETTES
  reparateur_telephone_tablette: {
    terminology: {
      productLabel: 'Service de réparation',
      productsLabel: 'Réparateurs Téléphones & Tablettes',
      priceLabel: 'Tarif',
      locationLabel: 'Atelier',
      providerLabel: 'Réparateur',
      searchPlaceholder: 'Rechercher réparateur (écran, batterie, déblocage...)...',
      emptyMessage: 'Aucun réparateur disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeReparation',
        label: 'Type de réparation',
        type: 'multiselect',
        options: [
          { value: 'remplacement_ecran', label: '📱 Remplacement écran' },
          { value: 'reparation_ecran_fissure', label: '📱 Réparation écran fissuré' },
          { value: 'remplacement_batterie', label: '🔋 Remplacement batterie' },
          { value: 'reparation_port_charge', label: '🔌 Réparation port de charge' },
          { value: 'reparation_haut_parleur', label: '🔊 Réparation haut-parleur' },
          { value: 'reparation_microphone', label: '🎤 Réparation microphone' },
          { value: 'reparation_camera', label: '📸 Réparation caméra' },
          { value: 'deblocage_operateur', label: '🔓 Déblocage opérateur' },
          { value: 'deblocage_icloud_google', label: '🔓 Déblocage iCloud/Google' },
          { value: 'flash_reinstallation', label: '💾 Flash/Réinstallation' },
          { value: 'reparation_degats_eau', label: '💧 Réparation dégâts eau' },
          { value: 'remplacement_carte_mere', label: '🔧 Remplacement carte mère' },
          { value: 'micro_soudure', label: '🔧 Micro-soudure' },
          { value: 'recuperation_donnees', label: '🗑️ Récupération données' },
          { value: 'pose_film_protecteur', label: '🛡️ Pose film protecteur' },
        ],
      },
      {
        id: 'marquesSuppoortees',
        label: 'Marques supportées',
        type: 'multiselect',
        options: [
          { value: 'tecno', label: 'Tecno' },
          { value: 'infinix', label: 'Infinix' },
          { value: 'samsung', label: 'Samsung Galaxy' },
          { value: 'xiaomi', label: 'Xiaomi/Redmi/Poco' },
          { value: 'itel', label: 'Itel' },
          { value: 'apple', label: 'Apple iPhone' },
          { value: 'huawei', label: 'Huawei' },
          { value: 'honor', label: 'Honor' },
          { value: 'realme', label: 'Realme' },
          { value: 'oppo', label: 'Oppo' },
          { value: 'vivo', label: 'Vivo' },
          { value: 'onePlus', label: 'OnePlus' },
          { value: 'nokia', label: 'Nokia' },
          { value: 'motorola', label: 'Motorola' },
          { value: 'ipad', label: 'iPad (tablette)' },
          { value: 'samsung_tab', label: 'Samsung Galaxy Tab' },
        ],
      },
      {
        id: 'delaisReparation',
        label: 'Délai de réparation',
        type: 'select',
        options: [
          { value: 'express_1_2h', label: '⚡ Express (1-2h)' },
          { value: 'rapide_3_6h', label: '🚀 Rapide (3-6h)' },
          { value: 'jour_meme', label: '📅 Jour même' },
          { value: '24_48h', label: '📅 24-48h' },
          { value: '2_3_jours', label: '📅 2-3 jours' },
          { value: '3_5_jours', label: '📅 3-5 jours' },
          { value: '5_7_jours', label: '📅 5-7 jours' },
        ],
      },
      {
        id: 'garantieReparation',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'garantie_6_mois', label: '✅ 6 mois' },
          { value: 'garantie_3_mois', label: '✅ 3 mois' },
          { value: 'garantie_1_mois', label: '✅ 1 mois' },
          { value: 'garantie_15_jours', label: '✅ 15 jours' },
          { value: 'garantie_a_vie', label: '✅ À vie (certaines réparations)' },
          { value: 'aucune_garantie', label: '❌ Aucune garantie' },
        ],
      },
      {
        id: 'qualitePieces',
        label: 'Qualité des pièces',
        type: 'select',
        options: [
          { value: 'pieces_originales', label: '⭐ Pièces originales constructeur' },
          { value: 'pieces_originales_apple', label: '⭐ Pièces originales Apple' },
          { value: 'pieces_originales_samsung', label: '⭐ Pièces originales Samsung' },
          { value: 'pieces_compatibles_aaa_plus', label: '✅ Compatibles premium (AAA+)' },
          { value: 'pieces_compatibles_aaa', label: '✅ Compatibles supérieure (AAA)' },
          { value: 'pieces_compatibles_aa', label: '✅ Compatibles standard (AA)' },
          { value: 'choix_client', label: '🎁 Choix client (original ou compatible)' },
        ],
      },
      {
        id: 'typeIntervention',
        label: 'Type d\'intervention',
        type: 'multiselect',
        options: [
          { value: 'en_boutique', label: '🏪 En boutique/atelier' },
          { value: 'a_domicile', label: '🏠 À domicile' },
          { value: 'en_entreprise', label: '🏢 En entreprise' },
          { value: 'service_express', label: '⚡ Service express' },
          { value: 'service_mobile', label: '🚗 Atelier mobile' },
        ],
      },
      {
        id: 'certifications',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'certifie_apple', label: '🎓 Technicien certifié Apple (ACMT)' },
          { value: 'certifie_samsung', label: '🎓 Technicien certifié Samsung' },
          { value: 'certifie_micro_soudure', label: '🎓 Certifié micro-soudure' },
          { value: 'plus_5_ans_experience', label: '🏆 +5 ans d\'expérience' },
          { value: 'plus_10_ans_experience', label: '🏆 +10 ans d\'expérience' },
          { value: 'specialiste_iphone', label: '🛠️ Spécialiste iPhone' },
          { value: 'specialiste_samsung', label: '🛠️ Spécialiste Samsung' },
          { value: 'boutique_physique', label: '📱 Boutique physique' },
        ],
      },
      {
        id: 'servicesAdditionnels',
        label: 'Services additionnels',
        type: 'multiselect',
        options: [
          { value: 'diagnostic_gratuit', label: '🔍 Diagnostic gratuit' },
          { value: 'devis_gratuit', label: '🎁 Devis gratuit' },
          { value: 'recuperation_domicile', label: '📦 Récupération domicile gratuite' },
          { value: 'livraison_domicile', label: '🚗 Livraison domicile gratuite' },
          { value: 'paiement_mobile_money', label: '💳 Paiement mobile money' },
          { value: 'paiement_plusieurs_fois', label: '💳 Paiement en plusieurs fois' },
          { value: 'pret_telephone', label: '🔄 Prêt de téléphone' },
          { value: 'support_whatsapp_24_7', label: '💬 Support WhatsApp 24/7' },
          { value: 'rachat_ancien_telephone', label: '📱 Rachat ancien téléphone' },
        ],
      },
      {
        id: 'etatAppareilAccepte',
        label: 'États acceptés',
        type: 'multiselect',
        options: [
          { value: 'ecran_casse', label: '✅ Écran cassé' },
          { value: 'endommage_eau', label: '✅ Endommagé par l\'eau' },
          { value: 'ne_allume_pas', label: '✅ Ne s\'allume pas' },
          { value: 'bloque_icloud_google', label: '✅ Bloqué (iCloud, Google)' },
          { value: 'tous_etats', label: '✅ Tous états acceptés' },
        ],
      },
      {
        id: 'specialisteIPhone',
        label: 'Spécialiste iPhone',
        type: 'toggle',
      },
      {
        id: 'serviceADomicile',
        label: 'Service à domicile disponible',
        type: 'toggle',
      },
      {
        id: 'microSoudure',
        label: 'Micro-soudure (réparation avancée)',
        type: 'toggle',
      },
      {
        id: 'piecesOriginales',
        label: 'Pièces originales uniquement',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#10B981',
      gradientColors: ['#10B981', '#059669'],
      icon: '🔧',
      badgeColor: '#D1FAE5',
      accentColor: '#047857',
    },
    displayPriority: ['nomAtelier', 'typeReparation', 'marquesSuppoortees', 'delaisReparation', 'garantieReparation', 'qualitePieces', 'certifications', 'prixEstimatif'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    searchKeywords: [
      // ✅ MOTS-CLÉS RÉPARATION (pour différencier de la vente)
      // Termes généraux RÉPARATION
      'réparation téléphone', 'reparation telephone', 'réparateur', 'reparateur',
      'réparation smartphone', 'reparation smartphone', 'réparation mobile', 'reparation mobile',
      'dépannage téléphone', 'depannage telephone', 'dépanneur', 'depanneur',
      'dépanneur téléphone', 'depanneur telephone', 'dépanneur smartphone', 'depanneur smartphone',
      'atelier réparation', 'atelier reparation', 'atelier de réparation',
      'technicien téléphone', 'technicien telephone', 'technicien smartphone',
      'service après-vente', 'service apres-vente', 'SAV téléphone', 'SAV telephone',
      'réparer téléphone', 'reparer telephone', 'réparer smartphone', 'reparer smartphone',
      'faire réparer', 'faire reparer', 'besoin réparation', 'besoin reparation',
      // Types de réparation
      'écran cassé', 'ecran casse', 'remplacement écran', 'remplacement ecran',
      'batterie téléphone', 'batterie smartphone', 'changer batterie',
      'port de charge', 'chargeur ne marche pas', 'ne charge plus',
      'déblocage', 'deblocage', 'déverrouillage', 'deverrouillage',
      'déblocage iCloud', 'deblocage icloud', 'déblocage Google', 'deblocage google',
      'flash téléphone', 'flash telephone', 'réinstallation', 'reinstallation',
      'dégâts eau', 'degats eau', 'téléphone mouillé', 'telephone mouille',
      'micro-soudure', 'micro soudure', 'carte mère', 'carte mere',
      // Marques
      'réparation iPhone', 'reparation iphone', 'réparation Samsung', 'reparation samsung',
      'réparation Tecno', 'reparation tecno', 'réparation Infinix', 'reparation infinix',
      'réparation Itel', 'reparation itel', 'réparation Xiaomi', 'reparation xiaomi',
      'réparation iPad', 'reparation ipad', 'réparation tablette', 'reparation tablette',
      // Services
      'diagnostic gratuit', 'devis gratuit', 'réparation express', 'reparation express',
      'réparation rapide', 'reparation rapide', 'réparation urgente', 'reparation urgente',
      'service à domicile', 'service a domicile', 'atelier mobile',
      'pièces originales', 'pieces originales', 'garantie réparation', 'garantie reparation',
    ],
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

  // 🚕 TRANSPORT INTRA-URBAIN
  transport_intra_urbain: {
    terminology: {
      productLabel: 'Course',
      productsLabel: 'Courses disponibles',
      priceLabel: 'Tarif proposé',
      locationLabel: 'Zone de récupération',
      providerLabel: 'Chauffeur',
      searchPlaceholder: 'Chercher un chauffeur dans votre ville...',
      emptyMessage: 'Aucun chauffeur disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
        date: 'Disponibilité',
      },
    },
    filters: [
      {
        id: 'typeVehiculeTransport',
        label: 'Type de véhicule',
        type: 'select',
        options: [
          { value: 'Moto-taxi', label: 'Moto-taxi' },
          { value: 'Tricycle', label: 'Tricycle' },
          { value: 'Berline économique', label: 'Berline économique' },
          { value: 'SUV', label: 'SUV' },
          { value: 'Minibus', label: 'Minibus' },
        ],
      },
      {
        id: 'disponibilite',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Maintenant', label: 'Disponible maintenant' },
          { value: '24h/24', label: 'Service 24h/24' },
          { value: 'Jour uniquement', label: 'Jour uniquement' },
        ],
      },
      {
        id: 'tarifBase',
        label: 'Tarif de base',
        type: 'range',
        min: 0,
        max: 50000,
        unit: 'FCFA',
      },
    ],
    style: {
      primaryColor: '#F59E0B',
      gradientColors: ['#F59E0B', '#D97706'],
      icon: '🚕',
      badgeColor: '#FEF3C7',
      accentColor: '#D97706',
    },
    displayPriority: ['typeVehiculeTransport', 'villeService', 'disponibilite', 'tarifBase'],
    contactMethods: ['whatsapp', 'phone', 'message'],
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

  // 🪟 MENUISIER ALUMINIUM - ✅ ENRICHI AFRIQUE FRANCOPHONE
  menuisier_aluminium: {
    terminology: {
      productLabel: 'Réalisation',
      productsLabel: 'Menuisier Aluminium',
      priceLabel: 'Tarif',
      locationLabel: 'Atelier',
      providerLabel: 'Menuisier Alu / Artisan',
      searchPlaceholder: 'Rechercher menuisier alu (fenêtres, baies vitrées, vitrines...)...',
      emptyMessage: 'Aucun menuisier aluminium disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },

    // ✅ 15 FILTRES INTELLIGENTS
    filters: [
      // Filtre 1: Type de réalisation
      {
        id: 'typeRealisation',
        label: 'Type de réalisation',
        type: 'multiselect',
        options: [
          { value: 'Fenêtre coulissante', label: 'Fenêtre coulissante' },
          { value: 'Fenêtre battante', label: 'Fenêtre battante' },
          { value: 'Baie vitrée', label: 'Baie vitrée' },
          { value: 'Porte-fenêtre', label: 'Porte-fenêtre' },
          { value: 'Porte aluminium', label: 'Porte aluminium' },
          { value: 'Vitrine magasin', label: 'Vitrine magasin' },
          { value: 'Devanture boutique', label: 'Devanture boutique' },
          { value: 'Façade vitrée', label: 'Façade vitrée (mur-rideau)' },
          { value: 'Véranda', label: 'Véranda' },
          { value: 'Pergola aluminium', label: 'Pergola aluminium' },
          { value: 'Volet roulant', label: 'Volet roulant' },
          { value: 'Garde-corps', label: 'Garde-corps aluminium' },
          { value: 'Portail aluminium', label: 'Portail aluminium' },
        ],
      },
      // Filtre 2: Type d'aluminium
      {
        id: 'typeAluminium',
        label: 'Type d\'aluminium',
        type: 'select',
        options: [
          { value: 'Anodisé naturel', label: 'Anodisé naturel' },
          { value: 'Anodisé couleur', label: 'Anodisé couleur' },
          { value: 'Thermolaqué', label: 'Thermolaqué (peinture)' },
          { value: 'Rupture pont thermique', label: 'À rupture de pont thermique' },
          { value: 'Renforcé', label: 'Renforcé (épaisseur +)' },
          { value: 'Anti-corrosion', label: 'Anti-corrosion (maritime)' },
          { value: 'Effet bois', label: 'Effet bois' },
        ],
      },
      // Filtre 3: Couleur aluminium
      {
        id: 'couleurAluminium',
        label: 'Couleur',
        type: 'select',
        options: [
          { value: 'Blanc', label: 'Blanc (RAL 9016)' },
          { value: 'Gris anthracite', label: 'Gris anthracite (RAL 7016)' },
          { value: 'Noir mat', label: 'Noir mat (RAL 9005)' },
          { value: 'Marron', label: 'Marron (RAL 8014)' },
          { value: 'Aluminium naturel', label: 'Aluminium naturel' },
          { value: 'Effet bois', label: 'Effet bois' },
          { value: 'Bi-couleur', label: 'Bi-couleur' },
        ],
      },
      // Filtre 4: Type de vitrage
      {
        id: 'typeVitrage',
        label: 'Vitrage',
        type: 'select',
        options: [
          { value: 'Simple vitrage', label: 'Simple vitrage' },
          { value: 'Double vitrage', label: 'Double vitrage' },
          { value: 'Double vitrage phonique', label: 'Double vitrage phonique' },
          { value: 'Verre securit', label: 'Verre trempé securit' },
          { value: 'Verre feuilleté', label: 'Verre feuilleté sécurité' },
          { value: 'Verre anti-UV', label: 'Verre anti-UV' },
          { value: 'Sans vitrage', label: 'Sans vitrage' },
        ],
      },
      // Filtre 5: Type d'ouverture
      {
        id: 'typeOuverture',
        label: 'Ouverture',
        type: 'select',
        options: [
          { value: 'Coulissante', label: 'Coulissante' },
          { value: 'Battante', label: 'Battante' },
          { value: 'Oscillo-battante', label: 'Oscillo-battante' },
          { value: 'Pliante', label: 'Pliante (accordéon)' },
          { value: 'Automatique', label: 'Automatique (motorisée)' },
          { value: 'Fixe', label: 'Fixe (non ouvrante)' },
        ],
      },
      // Filtre 6: Délai de réalisation
      {
        id: 'delaiRealisation',
        label: 'Délai',
        type: 'select',
        options: [
          { value: '3-5 jours', label: '3-5 jours' },
          { value: '1 semaine', label: '1 semaine' },
          { value: '10-15 jours', label: '10-15 jours' },
          { value: '2-3 semaines', label: '2-3 semaines' },
          { value: '1-2 mois', label: '1-2 mois' },
          { value: 'Urgent', label: 'Urgent (sur devis)' },
        ],
      },
      // Filtre 7: Garantie
      {
        id: 'garantie',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: '10 ans', label: '10 ans (structure)' },
          { value: '5 ans', label: '5 ans' },
          { value: '3 ans', label: '3 ans' },
          { value: '2 ans', label: '2 ans' },
          { value: '1 an', label: '1 an' },
          { value: 'Garantie décennale', label: 'Garantie décennale' },
        ],
      },
      // Filtre 8: Services inclus
      {
        id: 'servicesInclus',
        label: 'Services inclus',
        type: 'multiselect',
        options: [
          { value: 'Mesures gratuites', label: 'Prise de mesures gratuite' },
          { value: 'Devis gratuit', label: 'Devis gratuit' },
          { value: 'Livraison', label: 'Livraison' },
          { value: 'Installation', label: 'Installation complète' },
          { value: 'SAV', label: 'SAV & retouches' },
          { value: 'Garantie décennale', label: 'Garantie décennale' },
        ],
      },
      // Filtre 9: Options disponibles
      {
        id: 'optionsDisponibles',
        label: 'Options',
        type: 'multiselect',
        options: [
          { value: 'Motorisation', label: 'Motorisation' },
          { value: 'Serrure multipoints', label: 'Serrure multipoints' },
          { value: 'Jalousies', label: 'Jalousies intégrées' },
          { value: 'Moustiquaire', label: 'Moustiquaire' },
          { value: 'Volet roulant', label: 'Volet roulant' },
          { value: 'Domotique', label: 'Domotique / Smart home' },
        ],
      },
      // Filtre 10: Certifications
      {
        id: 'certifications',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'Professionnel agréé', label: 'Professionnel agréé' },
          { value: 'Formation fabricant', label: 'Formation fabricant' },
          { value: '+5 ans expérience', label: '+5 ans d\'expérience' },
          { value: '+10 ans expérience', label: '+10 ans d\'expérience' },
          { value: '+15 ans expérience', label: '+15 ans d\'expérience' },
          { value: 'Spécialiste vitrines', label: 'Spécialiste vitrines commerciales' },
          { value: 'Spécialiste façades', label: 'Spécialiste façades vitrées' },
          { value: 'Spécialiste vérandas', label: 'Spécialiste vérandas' },
        ],
      },
      // Filtre 11: Type de clients
      {
        id: 'typeClient',
        label: 'Clientèle',
        type: 'multiselect',
        options: [
          { value: 'Particuliers', label: 'Particuliers' },
          { value: 'Entreprises', label: 'Entreprises & Bureaux' },
          { value: 'Commerces', label: 'Commerces & Boutiques' },
          { value: 'Hôtels', label: 'Hôtels & Restaurants' },
          { value: 'Promoteurs', label: 'Promoteurs immobiliers' },
        ],
      },
      // Filtre 12: Motorisation disponible
      {
        id: 'motorisationDisponible',
        label: 'Motorisation disponible',
        type: 'toggle',
      },
      // Filtre 13: Devis gratuit
      {
        id: 'devisGratuit',
        label: 'Devis gratuit',
        type: 'toggle',
      },
      // Filtre 14: Installation incluse
      {
        id: 'installationIncluse',
        label: 'Installation incluse',
        type: 'toggle',
      },
      // Filtre 15: Paiement échelonné
      {
        id: 'paiementEchelonne',
        label: 'Paiement échelonné',
        type: 'toggle',
      },
    ],

    // ✅ STYLE PERSONNALISÉ
    style: {
      primaryColor: '#607D8B', // Gris-bleu aluminium
      gradientColors: ['#607D8B', '#455A64'],
      icon: '🪟', // Fenêtre
      badgeColor: '#CFD8DC',
      accentColor: '#37474F',
    },

    // ✅ PRIORITÉ D'AFFICHAGE
    displayPriority: [
      'nomAtelier',
      'typeRealisation',
      'typeAluminium',
      'couleurAluminium',
      'typeVitrage',
      'delaiRealisation',
      'garantie',
      'prixEstimatif',
      'certifications',
    ],

    contactMethods: ['whatsapp', 'phone', 'message', 'email'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid', // Grid layout optimal pour web

    // ✅ MOTS-CLÉS EXCLUSIFS (100+) - Différenciation ALUMINIUM vs BOIS vs FORGERON
    searchKeywords: [
      // ═══ TERMES MÉTIER ALUMINIUM (exclusifs) ═══
      'menuisier aluminium', 'menuisier alu', 'menuiserie aluminium', 'menuiserie alu',
      'artisan aluminium', 'artisan alu', 'poseur aluminium', 'installateur alu',
      'fabricant aluminium', 'atelier aluminium', 'atelier alu',

      // ═══ FENÊTRES ALUMINIUM (exclusifs) ═══
      'fenêtre aluminium', 'fenêtre alu', 'fenêtre coulissante alu',
      'fenêtre battante alu', 'fenêtre oscillo-battante', 'chassis aluminium',
      'chassis alu', 'menuiserie fenêtre alu', 'pose fenêtre alu',
      'installation fenêtre aluminium', 'fabrication fenêtre alu',
      'fenêtre alu Cameroun', 'fenêtre aluminium Douala', 'fenêtre alu Yaoundé',

      // ═══ BAIES VITRÉES (exclusifs) ═══
      'baie vitrée', 'baie vitrée coulissante', 'baie vitrée alu',
      'baie vitrée aluminium', 'grande baie vitrée', 'baie à galandage',
      'porte-fenêtre alu', 'porte-fenêtre aluminium',
      'baie vitrée Cameroun', 'baie vitrée Douala', 'baie vitrée Yaoundé',

      // ═══ VITRINES & COMMERCES (exclusifs) ═══
      'vitrine magasin', 'vitrine boutique', 'vitrine alu', 'vitrine aluminium',
      'devanture boutique', 'devanture magasin', 'devanture alu',
      'kiosque aluminium', 'stand alu', 'vitrine commerce',
      'façade boutique', 'façade magasin alu',
      'vitrine magasin Cameroun', 'devanture Douala', 'vitrine Abidjan',

      // ═══ FAÇADES VITRÉES (exclusifs) ═══
      'façade vitrée', 'mur-rideau', 'façade aluminium',
      'habillage façade alu', 'bardage aluminium', 'brise-soleil alu',
      'claustra aluminium', 'moucharabieh alu',

      // ═══ VÉRANDAS & PERGOLAS (exclusifs) ═══
      'véranda', 'véranda aluminium', 'véranda alu', 'véranda alu et verre',
      'pergola aluminium', 'pergola alu', 'pergola bioclimatique',
      'abri terrasse alu', 'pergola Cameroun',

      // ═══ VOLETS & PROTECTIONS (exclusifs) ═══
      'volet roulant', 'volet roulant motorisé', 'volet roulant alu',
      'volet battant aluminium', 'store banne', 'pergola avec stores',

      // ═══ PORTES ALUMINIUM (exclusifs) ═══
      'porte aluminium', 'porte alu', 'porte entrée aluminium',
      'porte vitrée alu', 'porte coulissante automatique',
      'portail aluminium', 'portail alu', 'portillon alu',

      // ═══ GARDE-CORPS ALUMINIUM (exclusifs) ═══
      'garde-corps aluminium', 'garde-corps alu', 'rambarde alu',
      'balustrade aluminium', 'main courante alu',

      // ═══ SERVICES ALUMINIUM (exclusifs) ═══
      'pose aluminium', 'installation aluminium', 'fabrication aluminium',
      'réparation fenêtre alu', 'dépannage fenêtre alu',
      'remplacement fenêtre alu', 'rénovation fenêtre alu',
      'sur mesure aluminium', 'menuiserie sur mesure alu',

      // ═══ MATÉRIAUX & TECHNIQUES (exclusifs) ═══
      'aluminium anodisé', 'aluminium thermolaqué', 'rupture pont thermique',
      'double vitrage alu', 'simple vitrage alu', 'verre feuilleté',
      'vitrage phonique', 'vitrage anti-UV',

      // ═══ DIFFÉRENCIATION vs BOIS (exclusifs) ═══
      'aluminium pas bois', 'alu pas menuiserie bois',
      'fenêtre aluminium pas bois', 'porte aluminium pas bois',
      'menuiserie métallique', 'menuiserie aluminium',

      // ═══ DIFFÉRENCIATION vs FORGERON (exclusifs) ═══
      'aluminium pas fer', 'alu pas forgeron', 'alu pas ferronnerie',
      'fenêtre alu pas grille fer', 'menuiserie alu pas forge',

      // ═══ CONTEXTE GÉOGRAPHIQUE AFRIQUE ═══
      'menuisier alu Cameroun', 'menuisier aluminium Douala',
      'menuisier alu Yaoundé', 'menuisier alu Bafoussam',
      'menuisier alu Abidjan', 'menuisier alu Dakar',
      'fenêtre aluminium Afrique', 'baie vitrée Afrique',
      'vitrine alu Cameroun', 'véranda Cameroun',
      'aluminium Douala', 'aluminium Yaoundé', 'aluminium Abidjan',
    ],
  },

  // 🔨 FORGERON / FERRONNERIE D'ART
  forgeron: {
    terminology: {
      productLabel: 'Réalisation',
      productsLabel: 'Forgeron / Ferronnerie',
      priceLabel: 'Tarif',
      locationLabel: 'Atelier',
      providerLabel: 'Forgeron / Artisan',
      searchPlaceholder: 'Rechercher forgeron (grilles, portail, balcon, anti-vol...)...',
      emptyMessage: 'Aucun forgeron disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeRealisation',
        label: 'Type de réalisation',
        type: 'multiselect',
        options: [
          { value: 'grille_fenetre', label: '🔒 Grilles de fenêtre anti-vol' },
          { value: 'grille_porte', label: '🔒 Grilles de porte anti-vol' },
          { value: 'barreaux_securite', label: '🔒 Barreaux de sécurité' },
          { value: 'rideau_metallique', label: '🔒 Rideau métallique' },
          { value: 'porte_blindee', label: '🔒 Porte blindée' },
          { value: 'portail_coulissant', label: '🚪 Portail coulissant' },
          { value: 'portail_battant', label: '🚪 Portail battant' },
          { value: 'portail_motorise', label: '🚪 Portail motorisé' },
          { value: 'portillon', label: '🚪 Portillon / Porte piétonne' },
          { value: 'garde_corps_balcon', label: '🏠 Garde-corps de balcon' },
          { value: 'rampe_escalier', label: '🏠 Rampe d\'escalier' },
          { value: 'balustrade', label: '🏠 Balustrade décorative' },
          { value: 'cloture_fer', label: '🏗️ Clôture en fer forgé' },
          { value: 'grillage', label: '🏗️ Grillage rigide/souple' },
          { value: 'pergola', label: '🎨 Pergola métallique' },
          { value: 'marquise', label: '🎨 Marquise de porte' },
          { value: 'mobilier_fer', label: '🪑 Mobilier en fer forgé' },
        ],
      },
      {
        id: 'materiau',
        label: 'Matériau',
        type: 'select',
        options: [
          { value: 'fer_forge', label: 'Fer forgé' },
          { value: 'acier', label: 'Acier' },
          { value: 'acier_galvanise', label: 'Acier galvanisé (anti-rouille)' },
          { value: 'aluminium', label: 'Aluminium' },
          { value: 'inox', label: 'Inox (304/316)' },
          { value: 'mixte_fer_bois', label: 'Fer + Bois' },
          { value: 'mixte_fer_verre', label: 'Fer + Verre' },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        type: 'select',
        options: [
          { value: 'moderne', label: '🎨 Moderne épuré' },
          { value: 'classique', label: '🎨 Classique élégant' },
          { value: 'artistique', label: '🎨 Fer forgé artistique' },
          { value: 'minimaliste', label: '🎨 Minimaliste contemporain' },
          { value: 'traditionnel', label: '🎨 Traditionnel africain' },
          { value: 'baroque', label: '🎨 Baroque orné' },
          { value: 'industriel', label: '🎨 Industriel brut' },
          { value: 'personnalise', label: '🎨 Personnalisé sur-mesure' },
        ],
      },
      {
        id: 'finition',
        label: 'Finition',
        type: 'select',
        options: [
          { value: 'galvanise', label: 'Galvanisé (anti-rouille)' },
          { value: 'thermolaquage', label: 'Thermolaquage (très résistant)' },
          { value: 'peinture_antirouille', label: 'Peinture antirouille' },
          { value: 'peinture_epoxy', label: 'Peinture époxy' },
          { value: 'noir_mat', label: 'Noir mat' },
          { value: 'noir_brillant', label: 'Noir brillant' },
          { value: 'blanc', label: 'Blanc' },
          { value: 'gris_anthracite', label: 'Gris anthracite' },
          { value: 'couleur_ral', label: 'Couleur RAL au choix' },
        ],
      },
      {
        id: 'delaiRealisation',
        label: 'Délai de réalisation',
        type: 'select',
        options: [
          { value: '3_5_jours', label: '⏰ 3-5 jours' },
          { value: '1_semaine', label: '⏰ 1 semaine' },
          { value: '10_15_jours', label: '⏰ 10-15 jours' },
          { value: '2_3_semaines', label: '⏰ 2-3 semaines' },
          { value: '3_4_semaines', label: '⏰ 3-4 semaines' },
          { value: '1_2_mois', label: '⏰ 1-2 mois' },
        ],
      },
      {
        id: 'garantie',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'garantie_5_ans', label: '✅ 5 ans (structure)' },
          { value: 'garantie_2_ans', label: '✅ 2 ans (structure + peinture)' },
          { value: 'garantie_1_an', label: '✅ 1 an (structure + peinture)' },
          { value: 'garantie_6_mois', label: '✅ 6 mois' },
          { value: 'garantie_antirouille', label: '✅ Garantie anti-rouille (2 ans)' },
          { value: 'aucune_garantie', label: '❌ Aucune garantie' },
        ],
      },
      {
        id: 'servicesInclus',
        label: 'Services inclus',
        type: 'multiselect',
        options: [
          { value: 'mesures_gratuites', label: '📐 Prise de mesures gratuite' },
          { value: 'devis_gratuit', label: '💰 Devis détaillé gratuit' },
          { value: 'conception_incluse', label: '🎨 Conception/Design inclus' },
          { value: 'livraison_incluse', label: '🚚 Livraison incluse' },
          { value: 'installation_incluse', label: '🔧 Installation incluse' },
          { value: 'peinture_incluse', label: '🎨 Peinture antirouille incluse' },
          { value: 'sav_inclus', label: '📞 SAV et maintenance' },
        ],
      },
      {
        id: 'motorisation',
        label: 'Motorisation',
        type: 'multiselect',
        options: [
          { value: 'motorisation_battant', label: '⚡ Motorisation portail battant' },
          { value: 'motorisation_coulissant', label: '⚡ Motorisation portail coulissant' },
          { value: 'telecommande', label: '⚡ Télécommande incluse' },
          { value: 'digicode', label: '⚡ Digicode' },
          { value: 'visiophone', label: '⚡ Visiophone' },
          { value: 'interphone', label: '⚡ Interphone' },
          { value: 'solaire', label: '⚡ Automatisme solaire' },
        ],
      },
      {
        id: 'certifications',
        label: 'Certifications & Compétences',
        type: 'multiselect',
        options: [
          { value: 'artisan_agree', label: '🎓 Artisan professionnel agréé' },
          { value: 'soudure_certifiee', label: '🎓 Formation soudure certifiée' },
          { value: 'plus_5_ans', label: '🏆 +5 ans d\'expérience' },
          { value: 'plus_10_ans', label: '🏆 +10 ans d\'expérience' },
          { value: 'plus_15_ans', label: '🏆 +15 ans d\'expérience' },
          { value: 'specialiste_portails', label: '🛠️ Spécialiste portails motorisés' },
          { value: 'specialiste_artistique', label: '🛠️ Spécialiste fer forgé artistique' },
          { value: 'specialiste_securite', label: '🛠️ Spécialiste sécurité (anti-vol)' },
        ],
      },
      {
        id: 'typeClient',
        label: 'Types de clients',
        type: 'multiselect',
        options: [
          { value: 'particuliers', label: '🏠 Particuliers' },
          { value: 'entreprises', label: '🏢 Entreprises et commerces' },
          { value: 'promoteurs', label: '🏗️ Promoteurs immobiliers' },
          { value: 'hotels', label: '🏨 Hôtels et résidences' },
          { value: 'administrations', label: '🏛️ Administrations publiques' },
        ],
      },
      {
        id: 'motorisationDisponible',
        label: 'Motorisation de portail disponible',
        type: 'toggle',
      },
      {
        id: 'devisGratuit',
        label: 'Devis et étude gratuits',
        type: 'toggle',
      },
      {
        id: 'installationIncluse',
        label: 'Installation et pose incluses',
        type: 'toggle',
      },
      {
        id: 'paiementEchelonne',
        label: 'Paiement échelonné possible',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#78909C',
      gradientColors: ['#78909C', '#546E7A'],
      icon: '🔨',
      badgeColor: '#CFD8DC',
      accentColor: '#455A64',
    },
    displayPriority: ['nomAtelier', 'typeRealisation', 'materiau', 'style', 'delaiRealisation', 'garantie', 'prixEstimatif', 'certifications'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    searchKeywords: [
      // ✅ MOTS-CLÉS FORGERON (pour différencier de prestation_service générique)
      // Termes métier
      'forgeron', 'ferronnier', 'ferronnerie', 'fer forgé', 'fer forge',
      'métallier', 'metallier', 'soudeur', 'artisan fer', 'travail fer',
      'serrurerie', 'serrurier', 'métallerie', 'metallerie',
      // Sécurité (priorité #1)
      'grille anti-vol', 'grille antivol', 'grilles de fenêtre', 'grilles de fenetres',
      'barreaux', 'barreaux de sécurité', 'barreaux securite',
      'rideau métallique', 'rideau metallique', 'volet roulant métallique',
      'porte blindée', 'porte blindee', 'renfort porte',
      'protection fenêtre', 'protection fenetre', 'sécurité maison', 'securite maison',
      // Portails
      'portail', 'portail coulissant', 'portail battant', 'portail motorisé', 'portail motorise',
      'portail fer forgé', 'portail fer forge', 'portillon', 'porte de garage',
      'motorisation portail', 'automatisme portail',
      // Balcons & Garde-corps
      'garde-corps', 'garde corps', 'balcon', 'balustrade', 'rambarde',
      'rampe escalier', 'main courante', 'protection balcon',
      // Clôtures
      'clôture', 'cloture', 'grillage', 'clôture fer forgé', 'cloture fer forge',
      'muret grillé', 'muret grille',
      // Décoration
      'pergola', 'pergola métallique', 'marquise', 'auvent', 'tonnelle',
      'brise-soleil', 'brise soleil', 'claustra', 'paravent métallique',
      // Mobilier
      'mobilier fer forgé', 'mobilier fer forge', 'table fer forgé', 'salon jardin métallique',
      // Services
      'soudure', 'soudure fer', 'soudure acier', 'soudure aluminium', 'soudure inox',
      'réparation portail', 'reparation portail', 'dépannage portail', 'depannage portail',
      'devis forgeron', 'devis gratuit forgeron', 'atelier ferronnerie',
      // Types de travaux
      'fabrication sur mesure', 'sur mesure fer', 'création fer forgé', 'creation fer forge',
      'installation portail', 'pose grilles', 'pose barreaux',
      // Contexte africain
      'anti-vol Cameroun', 'anti-vol Douala', 'anti-vol Yaoundé', 'anti-vol Yaounde',
      'portail Cameroun', 'grilles Afrique', 'forgeron Douala', 'forgeron Yaoundé',
      'forgeron Abidjan', 'forgeron Dakar',
    ],
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

  // ⚙️ PIÈCES INDUSTRIELLES - ✅ ENRICHI AFRIQUE FRANCOPHONE
  pieces_industrielles: {
    terminology: {
      productLabel: 'Pièce industrielle',
      productsLabel: 'Pièces Industrielles',
      priceLabel: 'Prix',
      locationLabel: 'Fournisseur',
      providerLabel: 'Vendeur / Distributeur',
      searchPlaceholder: 'Rechercher pièces industrielles (roulements, courroies, moteurs...)...',
      emptyMessage: 'Aucune pièce industrielle disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité fournisseur',
      },
    },
    filters: [
      {
        id: 'typePieceIndustrielle',
        label: 'Type de pièce',
        type: 'select',
        options: [
          // Transmission et roulement
          { value: 'Roulement à billes', label: 'Roulement à billes' },
          { value: 'Roulement à rouleaux', label: 'Roulement à rouleaux' },
          { value: 'Palier', label: 'Palier' },
          { value: 'Butée à billes', label: 'Butée à billes' },
          { value: 'Courroie trapézoïdale', label: 'Courroie trapézoïdale' },
          { value: 'Courroie plate', label: 'Courroie plate' },
          { value: 'Courroie crantée', label: 'Courroie crantée' },
          { value: 'Bande transporteuse', label: 'Bande transporteuse' },
          { value: 'Chaîne de transmission', label: 'Chaîne de transmission' },
          { value: 'Poulie', label: 'Poulie' },
          { value: 'Engrenage', label: 'Engrenage' },
          { value: 'Réducteur de vitesse', label: 'Réducteur de vitesse' },
          { value: 'Accouplement', label: 'Accouplement' },

          // Moteurs et électromécanique
          { value: 'Moteur électrique triphasé', label: 'Moteur électrique triphasé' },
          { value: 'Moteur électrique monophasé', label: 'Moteur électrique monophasé' },
          { value: 'Variateur de vitesse', label: 'Variateur de vitesse' },
          { value: 'Contacteur', label: 'Contacteur' },
          { value: 'Disjoncteur industriel', label: 'Disjoncteur industriel' },

          // Pompes
          { value: 'Pompe centrifuge', label: 'Pompe centrifuge' },
          { value: 'Pompe volumétrique', label: 'Pompe volumétrique' },
          { value: 'Pompe immergée', label: 'Pompe immergée' },
          { value: 'Pompe à eau', label: 'Pompe à eau' },
          { value: 'Pompe hydraulique', label: 'Pompe hydraulique' },

          // Hydraulique et pneumatique
          { value: 'Vérin hydraulique', label: 'Vérin hydraulique' },
          { value: 'Vérin pneumatique', label: 'Vérin pneumatique' },
          { value: 'Électrovanne pneumatique', label: 'Électrovanne' },
          { value: 'Distributeur hydraulique', label: 'Distributeur hydraulique' },
          { value: 'Flexible hydraulique', label: 'Flexible hydraulique' },

          // Compresseurs et ventilation
          { value: 'Compresseur à vis', label: 'Compresseur à vis' },
          { value: 'Compresseur à pistons', label: 'Compresseur à pistons' },
          { value: 'Ventilateur industriel', label: 'Ventilateur industriel' },

          // Filtration et étanchéité
          { value: 'Joint d\'étanchéité', label: 'Joint d\'étanchéité' },
          { value: 'Joint torique (O-ring)', label: 'Joint torique (O-ring)' },
          { value: 'Filtre à huile', label: 'Filtre à huile' },
          { value: 'Filtre à air', label: 'Filtre à air' },
          { value: 'Filtre hydraulique', label: 'Filtre hydraulique' },

          // Capteurs
          { value: 'Capteur de pression', label: 'Capteur de pression' },
          { value: 'Capteur de température', label: 'Capteur de température' },
          { value: 'Détecteur de proximité', label: 'Détecteur de proximité' },
        ],
      },
      {
        id: 'marquePieceIndustrielle',
        label: 'Marque',
        type: 'select',
        options: [
          // Roulements (top 10)
          { value: 'SKF', label: 'SKF' },
          { value: 'FAG', label: 'FAG' },
          { value: 'NSK', label: 'NSK' },
          { value: 'NTN', label: 'NTN' },
          { value: 'Timken', label: 'Timken' },
          { value: 'INA', label: 'INA' },
          { value: 'SNR', label: 'SNR' },

          // Courroies (top 5)
          { value: 'Gates', label: 'Gates' },
          { value: 'ContiTech', label: 'ContiTech' },
          { value: 'Optibelt', label: 'Optibelt' },
          { value: 'Hutchinson', label: 'Hutchinson' },

          // Moteurs et automation (top 10)
          { value: 'ABB', label: 'ABB' },
          { value: 'Siemens', label: 'Siemens' },
          { value: 'Schneider Electric', label: 'Schneider Electric' },
          { value: 'SEW-Eurodrive', label: 'SEW-Eurodrive' },
          { value: 'Leroy-Somer', label: 'Leroy-Somer' },
          { value: 'WEG', label: 'WEG' },

          // Pompes (top 8)
          { value: 'Grundfos', label: 'Grundfos' },
          { value: 'KSB', label: 'KSB' },
          { value: 'Wilo', label: 'Wilo' },
          { value: 'Ebara', label: 'Ebara' },
          { value: 'Lowara', label: 'Lowara' },
          { value: 'Calpeda', label: 'Calpeda' },
          { value: 'Pedrollo', label: 'Pedrollo' },

          // Hydraulique (top 6)
          { value: 'Parker', label: 'Parker' },
          { value: 'Bosch Rexroth', label: 'Bosch Rexroth' },
          { value: 'Danfoss', label: 'Danfoss' },
          { value: 'Eaton', label: 'Eaton' },
          { value: 'Hydac', label: 'Hydac' },

          // Pneumatique (top 5)
          { value: 'Festo', label: 'Festo' },
          { value: 'SMC', label: 'SMC' },
          { value: 'Camozzi', label: 'Camozzi' },
          { value: 'Norgren', label: 'Norgren' },

          // Compresseurs (top 5)
          { value: 'Atlas Copco', label: 'Atlas Copco' },
          { value: 'Kaeser', label: 'Kaeser' },
          { value: 'Ingersoll Rand', label: 'Ingersoll Rand' },
          { value: 'Gardner Denver', label: 'Gardner Denver' },

          // Instrumentation (top 5)
          { value: 'Endress+Hauser', label: 'Endress+Hauser' },
          { value: 'Sick', label: 'Sick' },
          { value: 'Omron', label: 'Omron' },
          { value: 'Turck', label: 'Turck' },

          { value: 'Autre', label: 'Autre marque' },
        ],
      },
      {
        id: 'applicationIndustrielle',
        label: 'Application / Secteur',
        type: 'select',
        options: [
          // Agroalimentaire
          { value: 'Meunerie (minoterie)', label: 'Meunerie (minoterie)' },
          { value: 'Brasserie', label: 'Brasserie' },
          { value: 'Huilerie', label: 'Huilerie' },
          { value: 'Sucrerie', label: 'Sucrerie' },
          { value: 'Laiterie', label: 'Laiterie' },
          { value: 'Abattoir', label: 'Abattoir' },
          { value: 'Boulangerie industrielle', label: 'Boulangerie industrielle' },

          // Transformation
          { value: 'Textile et confection', label: 'Textile et confection' },
          { value: 'Scierie', label: 'Scierie' },
          { value: 'Menuiserie industrielle', label: 'Menuiserie industrielle' },
          { value: 'Imprimerie', label: 'Imprimerie' },
          { value: 'Plasturgie', label: 'Plasturgie' },

          // Industries lourdes
          { value: 'Cimenterie', label: 'Cimenterie' },
          { value: 'Carrière', label: 'Carrière' },
          { value: 'Mine', label: 'Mine' },
          { value: 'Fonderie', label: 'Fonderie' },

          // BTP et construction
          { value: 'Centrale à béton', label: 'Centrale à béton' },
          { value: 'Matériel de construction', label: 'Matériel de construction' },
          { value: 'Engins de chantier', label: 'Engins de chantier' },

          // Eau et énergie
          { value: 'Station de pompage', label: 'Station de pompage' },
          { value: 'Traitement d\'eau', label: 'Traitement d\'eau' },
          { value: 'Irrigation', label: 'Irrigation' },
          { value: 'Forage', label: 'Forage' },
          { value: 'Groupe électrogène', label: 'Groupe électrogène' },

          // Autres
          { value: 'Froid et climatisation', label: 'Froid et climatisation' },
          { value: 'Garage et mécanique', label: 'Garage et mécanique' },
          { value: 'Machines-outils', label: 'Machines-outils' },
          { value: 'Manutention et convoyage', label: 'Manutention et convoyage' },
          { value: 'Compresseur d\'air', label: 'Compresseur d\'air' },
        ],
      },
      {
        id: 'materielPiece',
        label: 'Matériau',
        type: 'select',
        options: [
          { value: 'Acier', label: 'Acier' },
          { value: 'Acier inoxydable (Inox 304)', label: 'Inox 304' },
          { value: 'Acier inoxydable (Inox 316)', label: 'Inox 316' },
          { value: 'Fonte grise', label: 'Fonte grise' },
          { value: 'Fonte ductile', label: 'Fonte ductile' },
          { value: 'Bronze', label: 'Bronze' },
          { value: 'Laiton', label: 'Laiton' },
          { value: 'Cuivre', label: 'Cuivre' },
          { value: 'Aluminium', label: 'Aluminium' },
          { value: 'Caoutchouc naturel', label: 'Caoutchouc naturel' },
          { value: 'Caoutchouc synthétique (NBR)', label: 'Caoutchouc NBR' },
          { value: 'Caoutchouc EPDM', label: 'Caoutchouc EPDM' },
          { value: 'PVC', label: 'PVC' },
          { value: 'Polyéthylène (PE)', label: 'Polyéthylène (PE)' },
          { value: 'PTFE (Téflon)', label: 'PTFE (Téflon)' },
          { value: 'Polyuréthane', label: 'Polyuréthane' },
          { value: 'Composite', label: 'Composite' },
        ],
      },
      {
        id: 'etatPieceIndustrielle',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf d\'origine (OEM)', label: 'Neuf d\'origine (OEM)' },
          { value: 'Neuf équivalent', label: 'Neuf équivalent' },
          { value: 'Reconditionné', label: 'Reconditionné' },
          { value: 'Occasion - Révisé', label: 'Occasion - Révisé' },
          { value: 'Occasion - Bon état', label: 'Occasion - Bon état' },
          { value: 'Occasion - À réparer', label: 'Occasion - À réparer' },
        ],
      },
      {
        id: 'garantiePieceIndustrielle',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'Garantie constructeur', label: 'Garantie constructeur' },
          { value: '3 ans et plus', label: '3 ans et plus' },
          { value: '2 ans', label: '2 ans' },
          { value: '1 an', label: '1 an' },
          { value: '6 mois', label: '6 mois' },
          { value: '3 mois', label: '3 mois' },
          { value: 'Aucune garantie', label: 'Aucune garantie' },
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
    displayPriority: ['typePieceIndustrielle', 'marquePieceIndustrielle', 'applicationIndustrielle', 'etatPieceIndustrielle', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message', 'email'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
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

  // 🎉 ÉVÉNEMENTIEL & ORGANISATION - ENRICHI AFRIQUE FRANCOPHONE
  evenementiel: {
    terminology: {
      productLabel: 'Prestation événementielle',
      productsLabel: 'Prestations événementielles',
      priceLabel: 'Tarif à partir de',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Organisateur',
      searchPlaceholder: 'Rechercher un organisateur d\'événement...',
      emptyMessage: 'Aucun organisateur disponible pour cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Type d'événement
      {
        id: 'typeEvenement',
        label: 'Type d\'événement',
        type: 'select',
        options: [
          // Traditionnels & Religieux
          { value: '💒 Mariage traditionnel', label: '💒 Mariage traditionnel' },
          { value: '💒 Mariage religieux (église)', label: '💒 Mariage religieux' },
          { value: '💒 Mariage civil', label: '💒 Mariage civil' },
          { value: '💒 Mariage mixte', label: '💒 Mariage mixte' },
          { value: '💒 Dot / Ntchounke', label: '💒 Dot / Ntchounke' },
          { value: '💍 Fiançailles officielles', label: '💍 Fiançailles' },
          // Familiaux
          { value: '👶 Baptême', label: '👶 Baptême' },
          { value: '👶 Cérémonie de naissance', label: '👶 Naissance' },
          { value: '🎂 Anniversaire enfant', label: '🎂 Anniversaire enfant' },
          { value: '🎂 Anniversaire adulte', label: '🎂 Anniversaire adulte' },
          { value: '🎓 Remise de diplôme', label: '🎓 Graduation' },
          { value: '⚰️ Funérailles', label: '⚰️ Funérailles' },
          { value: '🏡 Pendaison de crémaillère', label: '🏡 Crémaillère' },
          { value: '💑 Demande en mariage', label: '💑 Demande en mariage' },
          // Professionnels
          { value: '🏢 Séminaire d\'entreprise', label: '🏢 Séminaire' },
          { value: '🏢 Conférence / Forum', label: '🏢 Conférence' },
          { value: '🏢 Atelier / Formation', label: '🏢 Formation' },
          { value: '🏢 Team building', label: '🏢 Team building' },
          { value: '🏢 Lancement de produit', label: '🏢 Lancement produit' },
          { value: '🏢 Inauguration', label: '🏢 Inauguration' },
          { value: '🏢 Soirée d\'entreprise', label: '🏢 Soirée entreprise' },
          // Culturels
          { value: '🎭 Concert', label: '🎭 Concert' },
          { value: '🎭 Festival culturel', label: '🎭 Festival' },
          { value: '🎭 Défilé de mode', label: '🎭 Défilé de mode' },
          { value: '🎭 Exposition', label: '🎭 Exposition' },
          { value: '🎬 Projection de film', label: '🎬 Projection' },
          { value: '🎪 Salon professionnel', label: '🎪 Salon' },
          // Autres
          { value: '🎊 Cocktail / Réception', label: '🎊 Cocktail' },
          { value: '🎊 Soirée privée', label: '🎊 Soirée privée' },
          { value: '🎊 Levée de fonds', label: '🎊 Levée de fonds' },
        ],
      },
      // ✅ FILTRE 2 : Services proposés
      {
        id: 'servicesEvenement',
        label: 'Services proposés',
        type: 'multiselect',
        options: [
          // Lieux
          { value: 'Location de salle', label: '🏛️ Location de salle' },
          { value: 'Location chapiteau', label: '⛺ Chapiteau/Tente' },
          // Restauration
          { value: 'Traiteur complet', label: '🍽️ Traiteur' },
          { value: 'Buffet', label: '🍽️ Buffet' },
          { value: 'Pâtisserie', label: '🍰 Pâtisserie' },
          { value: 'Bar & Boissons', label: '🥤 Bar' },
          // Décoration
          { value: 'Décoration florale', label: '🎨 Décoration florale' },
          { value: 'Décoration thématique', label: '🎨 Décoration thématique' },
          { value: 'Éclairage ambiance', label: '💡 Éclairage' },
          { value: 'Feux d\'artifice', label: '🎆 Feux d\'artifice' },
          // Animation
          { value: 'DJ', label: '🎤 DJ' },
          { value: 'Orchestre', label: '🎵 Orchestre' },
          { value: 'Maître de cérémonie', label: '🎙️ MC' },
          { value: 'Animateurs enfants', label: '🤹 Animateurs' },
          // Médias
          { value: 'Photographe', label: '📸 Photographe' },
          { value: 'Vidéaste', label: '📹 Vidéaste' },
          { value: 'Drone', label: '🎬 Drone' },
          { value: 'Live streaming', label: '📺 Live streaming' },
          // Technique
          { value: 'Sonorisation', label: '🔊 Sonorisation' },
          { value: 'Projecteur & Écran', label: '🎥 Projecteur' },
          // Mobilier
          { value: 'Tables & Chaises', label: '🪑 Mobilier' },
          { value: 'Vaisselle', label: '🍽️ Vaisselle' },
          // Complémentaires
          { value: 'Sécurité', label: '🔐 Sécurité' },
          { value: 'Valet parking', label: '🚗 Valet parking' },
          { value: 'Wedding planner', label: '💼 Wedding planner' },
          { value: 'Coordination jour J', label: '💼 Coordination' },
        ],
      },
      // ✅ FILTRE 3 : Capacité d'accueil
      {
        id: 'capaciteEvenement',
        label: 'Capacité d\'accueil',
        type: 'select',
        options: [
          { value: '10-30 personnes', label: '👥 Petit (10-30)' },
          { value: '30-50 personnes', label: '👥 Moyen (30-50)' },
          { value: '50-100 personnes', label: '👥 Grand (50-100)' },
          { value: '100-200 personnes', label: '👥 Très grand (100-200)' },
          { value: '200-500 personnes', label: '👥 Majeur (200-500)' },
          { value: '500-1000 personnes', label: '👥 Massif (500-1000)' },
          { value: '1000+ personnes', label: '👥 Méga (1000+)' },
        ],
      },
      // ✅ FILTRE 4 : Style/Thème
      {
        id: 'styleTheme',
        label: 'Style/Thème',
        type: 'select',
        options: [
          // Traditionnel
          { value: 'Traditionnel camerounais', label: '🌍 Traditionnel camerounais' },
          { value: 'Traditionnel ivoirien', label: '🌍 Traditionnel ivoirien' },
          { value: 'Traditionnel sénégalais', label: '🌍 Traditionnel sénégalais' },
          { value: 'Pagne africain', label: '🌍 Pagne/Wax' },
          // Moderne
          { value: 'Élégant / Chic', label: '💎 Élégant/Chic' },
          { value: 'Luxe / VIP', label: '💎 Luxe/VIP' },
          { value: 'Romantique', label: '🌸 Romantique' },
          { value: 'Bohème', label: '🎨 Bohème' },
          { value: 'Champêtre', label: '🌿 Champêtre' },
          { value: 'Vintage', label: '🎭 Vintage' },
          // Couleurs
          { value: 'Rouge & Or', label: '🔴 Rouge & Or' },
          { value: 'Violet & Argent', label: '💜 Violet & Argent' },
          { value: 'Bleu & Blanc', label: '💙 Bleu & Blanc' },
          { value: 'Noir & Blanc', label: '🖤 Noir & Blanc' },
          { value: 'Multicolore', label: '🌈 Multicolore' },
        ],
      },
      // ✅ FILTRE 5 : Formule/Forfait
      {
        id: 'formuleEvenement',
        label: 'Formule',
        type: 'select',
        options: [
          { value: 'Essentielle', label: '📦 Essentielle' },
          { value: 'Confort', label: '📦 Confort' },
          { value: 'Premium', label: '📦 Premium' },
          { value: 'VIP', label: '📦 VIP' },
          { value: 'À la carte', label: '📦 À la carte' },
          { value: 'Demi-journée', label: '⏰ Demi-journée' },
          { value: 'Journée complète', label: '⏰ Journée' },
          { value: 'Week-end', label: '⏰ Week-end' },
        ],
      },
      // ✅ FILTRE 6 : Type de client
      {
        id: 'typeClientEvenement',
        label: 'Type de client',
        type: 'select',
        options: [
          { value: 'Particuliers', label: '👨‍👩‍👧‍👦 Particuliers' },
          { value: 'Entreprises', label: '🏢 Entreprises' },
          { value: 'Institutions', label: '🏛️ Institutions' },
          { value: 'Écoles', label: '🏫 Écoles/Universités' },
          { value: 'Organisations religieuses', label: '⛪ Religieux' },
          { value: 'ONG', label: '🎗️ ONG/Associations' },
          { value: 'Expatriés', label: '🌍 Expatriés' },
        ],
      },
      // ✅ FILTRE 7 : Délai de préparation
      {
        id: 'delaiPreparation',
        label: 'Délai de préparation',
        type: 'select',
        options: [
          { value: 'Urgent (< 7 jours)', label: '⚡ Urgent (< 7j)' },
          { value: 'Court (7-15 jours)', label: '📅 Court (7-15j)' },
          { value: 'Standard (15-30 jours)', label: '📅 Standard (15-30j)' },
          { value: 'Confortable (1-3 mois)', label: '📅 1-3 mois' },
          { value: 'Longue (3-6 mois)', label: '📅 3-6 mois' },
          { value: 'Très longue (6+ mois)', label: '📅 6+ mois' },
        ],
      },
      // ✅ FILTRE 8 : Options supplémentaires
      {
        id: 'optionsSupplementaires',
        label: 'Options supplémentaires',
        type: 'multiselect',
        options: [
          { value: 'Devis gratuit', label: '✅ Devis gratuit' },
          { value: 'Visite lieux incluse', label: '✅ Visite des lieux' },
          { value: 'Coordinateur jour J', label: '✅ Coordinateur dédié' },
          { value: 'Plan B pluie', label: '✅ Plan B (pluie)' },
          { value: 'Albums photo/vidéo', label: '✅ Albums inclus' },
          { value: 'Wifi gratuit', label: '✅ Wifi' },
          { value: 'Parking sécurisé', label: '✅ Parking' },
          { value: 'Générateur', label: '✅ Générateur' },
          { value: 'Paiement échelonné', label: '✅ Paiement échelonné' },
        ],
      },
      // ✅ FILTRE 9 : Prix estimé (range)
      {
        id: 'prixEstime',
        label: 'Budget estimé',
        type: 'range',
        min: 0,
        max: 10000000,
        unit: 'XAF',
      },
      // ✅ FILTRE 10 : Disponibilité
      {
        id: 'disponibiliteEvenement',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Semaine', label: '📅 Semaine (lun-ven)' },
          { value: 'Week-end', label: '📅 Week-end' },
          { value: 'Tous les jours', label: '📅 Tous les jours' },
          { value: 'Jour uniquement', label: '🌙 Jour' },
          { value: 'Soir/nuit uniquement', label: '🌙 Soir/Nuit' },
          { value: '24h/24', label: '🌙 24h/24' },
        ],
      },
      // ✅ FILTRE 11 : Certifications (toggle)
      {
        id: 'avecReferences',
        label: 'Avec références/portfolio',
        type: 'toggle',
      },
      // ✅ FILTRE 12 : Expérience
      {
        id: 'experienceEvenement',
        label: 'Expérience minimale',
        type: 'select',
        options: [
          { value: 'Débutant', label: 'Débutant' },
          { value: '1-2 ans', label: '1-2 ans' },
          { value: '3-5 ans', label: '3-5 ans' },
          { value: '5-10 ans', label: '5-10 ans' },
          { value: '10+ ans', label: '10+ ans d\'expérience' },
        ],
      },
    ],
    style: {
      primaryColor: '#EC4899',
      gradientColors: ['#EC4899', '#DB2777'],
      icon: '🎉',
      badgeColor: '#FCE7F3',
      accentColor: '#BE185D',
    },
    displayPriority: [
      'typeEvenement',
      'capaciteEvenement',
      'servicesEvenement',
      'styleTheme',
      'formuleEvenement',
      'prix',
      'disponibiliteEvenement',
    ],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
    searchKeywords: [
      // ✅ MOTS-CLÉS ÉVÉNEMENTIEL (pour différencier de prestation_service)
      // Termes généraux
      'événementiel', 'evenementiel', 'événement', 'evenement',
      'organisation événement', 'organisation evenement',
      'organisateur', 'wedding planner', 'event planner',

      // Mariages
      'mariage', 'dot', 'ntchounke', 'fiançailles', 'mariage traditionnel',
      'mariage camerounais', 'mariage africain', 'mariage church',
      'wedding', 'cérémonie mariage', 'ceremonie mariage',
      'organisateur mariage', 'planificateur mariage',

      // Événements familiaux
      'baptême', 'bapteme', 'anniversaire', 'fête anniversaire', 'fete anniversaire',
      'graduation', 'remise diplôme', 'remise diplome',
      'funérailles', 'funerailles', 'veillée mortuaire', 'veillee mortuaire',
      'crémaillère', 'cremaillere', 'pendaison crémaillère',

      // Événements professionnels
      'séminaire', 'seminaire', 'conférence', 'conference',
      'team building', 'atelier', 'formation entreprise',
      'lancement produit', 'inauguration', 'soirée entreprise', 'soiree entreprise',
      'gala', 'cocktail', 'réception', 'reception',

      // Événements culturels
      'concert', 'festival', 'défilé', 'defile', 'défilé mode', 'defile mode',
      'exposition', 'salon professionnel', 'foire',

      // Services spécifiques
      'traiteur événement', 'traiteur evenement', 'traiteur mariage',
      'décoration événement', 'decoration evenement', 'décoration mariage',
      'dj mariage', 'dj événement', 'sonorisation événement',
      'photographe mariage', 'vidéaste mariage', 'videaste mariage',
      'location salle', 'salle réception', 'salle reception',
      'chapiteau', 'tente événement', 'tente mariage',

      // Équipements
      'location matériel événement', 'location materiel evenement',
      'tables chaises mariage', 'mobilier événement', 'mobilier evenement',
      'sonorisation', 'éclairage événement', 'eclairage evenement',

      // Contexte africain
      'organisateur mariage Douala', 'organisateur mariage Yaoundé',
      'événementiel Cameroun', 'evenementiel Cameroun',
      'wedding planner Douala', 'wedding planner Yaoundé',
      'traiteur Douala', 'traiteur Yaoundé', 'traiteur Yaounde',
      'location salle Douala', 'location salle Yaoundé',
      'organisateur Abidjan', 'organisateur Dakar',
      'événementiel Afrique', 'evenementiel Afrique',

      // Types de lieux
      'salle climatisée', 'salle climatisee', 'jardin événement',
      'espace extérieur', 'espace exterieur', 'terrasse événement',

      // Budget & Formules
      'forfait mariage', 'package mariage', 'formule événement',
      'devis événement gratuit', 'devis mariage gratuit',
      'mariage petit budget', 'mariage luxe',

      // Styles
      'mariage traditionnel camerounais', 'mariage wax',
      'mariage chic', 'mariage romantique', 'mariage champêtre',
      'décoration africaine', 'thème africain',
    ],
  },

  // 🌾 AGRICULTURE & ÉLEVAGE
  agriculture_elevage: {
    terminology: {
      productLabel: 'Produit agricole / Animal',
      productsLabel: 'Produits agricoles / Animaux',
      priceLabel: 'Prix',
      locationLabel: 'Zone de production',
      providerLabel: 'Producteur / Éleveur',
      searchPlaceholder: 'Rechercher produits agricoles, animaux...',
      emptyMessage: 'Aucun produit agricole / animal disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'categorie_principale',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: '🌾 Produits Agricoles', label: '🌾 Produits Agricoles' },
          { value: '🐄 Animaux d\'Élevage', label: '🐄 Animaux d\'Élevage' },
          { value: '🥚 Produits Animaux', label: '🥚 Produits Animaux (œufs, lait, miel)' },
          { value: '🌱 Intrants Agricoles', label: '🌱 Intrants Agricoles (semences, engrais)' },
          { value: '🚜 Matériel & Équipements', label: '🚜 Matériel & Équipements' },
        ],
      },
      {
        id: 'type_produit',
        label: 'Type de produit',
        type: 'select',
        options: [
          { value: 'Légumes', label: '🥬 Légumes' },
          { value: 'Fruits', label: '🍎 Fruits' },
          { value: 'Céréales', label: '🌾 Céréales & Grains' },
          { value: 'Tubercules', label: '🥔 Tubercules & Racines' },
          { value: 'Légumineuses', label: '🫘 Légumineuses sèches' },
          { value: 'Épices', label: '🌶️ Épices & Condiments' },
          { value: 'Cultures de rente', label: '☕ Cultures de rente (café, cacao)' },
        ],
      },
      {
        id: 'type_animal',
        label: 'Type d\'animal',
        type: 'select',
        options: [
          { value: 'Bovins', label: '🐄 Bovins (bœuf, vache)' },
          { value: 'Ovins', label: '🐏 Ovins (moutons)' },
          { value: 'Caprins', label: '🐐 Caprins (chèvres)' },
          { value: 'Porcins', label: '🐖 Porcins (porcs)' },
          { value: 'Volailles', label: '🐔 Volailles (poulets, canards)' },
          { value: 'Autres', label: '🐰 Autres animaux (lapins, escargots)' },
          { value: 'Poissons', label: '🐟 Poissons (aquaculture)' },
        ],
      },
      {
        id: 'unite_mesure',
        label: 'Unité de vente',
        type: 'select',
        options: [
          { value: 'kg', label: '⚖️ Kilogramme (kg)' },
          { value: 'seau', label: '🪣 Seau 15L' },
          { value: 'sac', label: '💼 Sac 25 kg' },
          { value: 'cagio', label: '🧺 Cagio / Cageot' },
          { value: 'tas', label: '🥔 Tas' },
          { value: 'liasse', label: '🥬 Liasse / Botte' },
          { value: 'alveole', label: '🥚 Alvéole (œufs)' },
          { value: 'ver', label: '🥜 Ver' },
          { value: 'unite', label: '1️⃣ Unité / Pièce / Tête' },
          { value: 'regime', label: '🍌 Régime (bananes)' },
          { value: 'litre', label: '🥛 Litre' },
        ],
      },
      {
        id: 'origine',
        label: 'Origine',
        type: 'select',
        options: [
          { value: 'cameroun', label: '🇨🇲 Cameroun' },
          { value: 'cote_ivoire', label: '🇨🇮 Côte d\'Ivoire' },
          { value: 'senegal', label: '🇸🇳 Sénégal' },
          { value: 'mali', label: '🇲🇱 Mali' },
          { value: 'locale', label: '🏡 Production locale' },
        ],
      },
      {
        id: 'methode',
        label: 'Méthode de production',
        type: 'select',
        options: [
          { value: 'bio', label: '🌱 Agriculture biologique' },
          { value: 'conventionnelle', label: '🌱 Agriculture conventionnelle' },
          { value: 'agroecologie', label: '🌱 Agroécologie' },
          { value: 'traditionnelle', label: '🌱 Agriculture traditionnelle' },
          { value: 'elevage_trad', label: '🐄 Élevage traditionnel' },
          { value: 'elevage_moderne', label: '🐄 Élevage moderne' },
        ],
      },
      {
        id: 'qualite',
        label: 'Qualité / Labels',
        type: 'multiselect',
        options: [
          { value: 'bio', label: '✅ Bio certifié' },
          { value: 'equitable', label: '✅ Commerce équitable' },
          { value: 'sans_pesticides', label: '✅ Sans pesticides' },
          { value: 'sans_ogm', label: '✅ Sans OGM' },
          { value: 'halal', label: '✅ Halal' },
          { value: 'frais', label: '🌟 Frais du jour' },
          { value: 'local', label: '🌟 Production locale' },
        ],
      },
      {
        id: 'etat',
        label: 'État / Fraîcheur',
        type: 'select',
        options: [
          { value: 'ultra_frais', label: '✨ Ultra-frais (récolte jour même)' },
          { value: 'tres_frais', label: '✨ Très frais (récolte veille)' },
          { value: 'frais', label: '✨ Frais (2-3 jours)' },
          { value: 'vivant', label: '🐄 Animal vivant sur pied' },
          { value: 'vaccine', label: '🐄 Vacciné' },
          { value: 'seche', label: '📦 Séché' },
        ],
      },
      {
        id: 'saison',
        label: 'Saison / Disponibilité',
        type: 'select',
        options: [
          { value: 'toute_annee', label: '🌞 Toute l\'année' },
          { value: 'disponible', label: '🌞 Disponible actuellement' },
          { value: 'pluies', label: '☔ Saison des pluies' },
          { value: 'seche', label: '☀️ Saison sèche' },
          { value: 'recolte', label: '🌾 Période de récolte' },
          { value: 'commande', label: '⏰ Sur commande' },
        ],
      },
      {
        id: 'type_vente',
        label: 'Type de vente',
        type: 'select',
        options: [
          { value: 'detail', label: '🏪 Vente au détail' },
          { value: 'gros', label: '🏪 Vente en gros' },
          { value: 'demi_gros', label: '🏪 Demi-gros' },
          { value: 'directe', label: '🛒 Vente directe producteur' },
          { value: 'marche', label: '🏪 Vente au marché' },
          { value: 'livraison', label: '🚚 Livraison possible' },
          { value: 'negociable', label: '💰 Prix négociable' },
        ],
      },
    ],
    style: {
      primaryColor: '#10B981',
      gradientColors: ['#10B981', '#059669'],
      icon: '🌾',
      badgeColor: '#D1FAE5',
      accentColor: '#059669',
    },
    displayPriority: ['categorie_principale', 'type_produit', 'unite_mesure', 'origine', 'qualite', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message', 'email'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    searchKeywords: [
      'agriculture', 'agricole', 'ferme', 'fermier', 'paysan', 'cultivateur',
      'maraichage', 'maraîchage', 'potager', 'jardin', 'elevage', 'élevage',
      'bétail', 'betail', 'animal', 'animaux', 'légume', 'legume', 'fruit',
      'céréale', 'cereale', 'tubercule', 'ndolé', 'ndole', 'okok', 'eru',
      'gombo', 'okra', 'manioc', 'igname', 'plantain', 'safou', 'mangue',
      'bœuf', 'boeuf', 'vache', 'mouton', 'chèvre', 'chevre', 'porc',
      'poulet', 'volaille', 'œuf', 'oeuf', 'lait', 'miel',
      'seau', 'sac', 'cagio', 'cagnon', 'cageot', 'tas', 'liasse', 'alvéole', 'alveole', 'ver',
      'bio', 'biologique', 'frais', 'local', 'producteur', 'éleveur', 'eleveur',
    ],
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

