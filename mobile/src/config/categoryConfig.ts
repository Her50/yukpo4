/**
 * Configuration intelligente des catégories de produits
 * Ce fichier définit la terminologie, les filtres, et les styles pour chaque catégorie
 */

// Import du système de localisation intelligent
import { genererZonesIntervention } from '../data/productModalities';

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
  supportsVariants?: boolean; // ✅ NOUVEAU: Indique si cette catégorie supporte les variantes de produit
  searchKeywords?: string[]; // ✅ NOUVEAU: Mots-clés locaux africains pour faciliter la recherche
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
          { value: 'À vendre', label: 'À vendre' },
          { value: 'À louer (bail)', label: 'À louer (bail long terme)' },
          { value: 'À louer meublé', label: 'À louer meublé' },
          { value: 'Location courte durée', label: 'Location courte (vacances/nuitées)' },
          { value: 'Colocation', label: 'Colocation' },
          { value: 'Location-vente', label: 'Location-vente' },
        ],
      },
      {
        id: 'typeImmobilier',
        label: 'Type de bien',
        type: 'select',
        options: [
          { value: 'Appartement', label: 'Appartement' },
          { value: 'Villa', label: 'Villa' },
          { value: 'Studio', label: 'Studio' },
          { value: 'Duplex', label: 'Duplex' },
          { value: 'Triplex', label: 'Triplex' },
          { value: 'Immeuble', label: 'Immeuble' },
          { value: 'Maison', label: 'Maison' },
          { value: 'Bureau', label: 'Bureau' },
          { value: 'Commerce', label: 'Local commercial' },
        ],
      },
      {
        id: 'standing',
        label: 'Standing',
        type: 'select',
        options: [
          { value: 'Économique', label: 'Économique' },
          { value: 'Standard', label: 'Standard' },
          { value: 'Bon standing', label: 'Bon standing' },
          { value: 'Haut standing', label: 'Haut standing' },
          { value: 'Luxe / Prestige', label: 'Luxe / Prestige' },
        ],
      },
      {
        id: 'etatGeneral',
        label: 'État général',
        type: 'select',
        options: [
          { value: 'Neuf (jamais habité)', label: 'Neuf (jamais habité)' },
          { value: 'Excellent état', label: 'Excellent état' },
          { value: 'Bon état', label: 'Bon état' },
          { value: 'État moyen', label: 'État moyen' },
          { value: 'À rafraîchir', label: 'À rafraîchir' },
          { value: 'À rénover entièrement', label: 'À rénover entièrement' },
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
          { value: 'Non meublé', label: 'Non meublé' },
          { value: 'Partiellement meublé', label: 'Partiellement meublé' },
          { value: 'Semi-meublé', label: 'Semi-meublé' },
          { value: 'Meublé standard', label: 'Meublé standard' },
          { value: 'Meublé + équipé', label: 'Meublé + équipé' },
          { value: 'Meublé haut de gamme', label: 'Meublé haut de gamme' },
        ],
      },
      // ✅ NOUVEAU: Filtre Ville (top 10 villes)
      {
        id: 'ville',
        label: 'Ville',
        type: 'select',
        options: [
          { value: 'Douala', label: 'Douala' },
          { value: 'Yaoundé', label: 'Yaoundé' },
          { value: 'Garoua', label: 'Garoua' },
          { value: 'Bafoussam', label: 'Bafoussam' },
          { value: 'Bamenda', label: 'Bamenda' },
          { value: 'Maroua', label: 'Maroua' },
          { value: 'Ngaoundéré', label: 'Ngaoundéré' },
          { value: 'Bertoua', label: 'Bertoua' },
          { value: 'Kribi', label: 'Kribi' },
          { value: 'Limbe', label: 'Limbe' },
        ],
      },
      // ✅ ENRICHI: Équipements (focus Cameroun)
      {
        id: 'equipementsImmo',
        label: 'Équipements',
        type: 'multiselect',
        options: [
          { value: 'Eau courante 24h/24', label: 'Eau courante 24h/24' },
          { value: 'Groupe électrogène', label: 'Groupe électrogène' },
          { value: 'Cuisine équipée', label: 'Cuisine équipée' },
          { value: 'Balcon', label: 'Balcon' },
          { value: 'Terrasse', label: 'Terrasse' },
          { value: 'Jardin', label: 'Jardin' },
          { value: 'Piscine', label: 'Piscine' },
          { value: 'Garage fermé', label: 'Garage fermé' },
          { value: 'Parking couvert', label: 'Parking couvert' },
          { value: 'Ascenseur', label: 'Ascenseur' },
          { value: 'Gardien/Gardiennage', label: 'Gardien/Gardiennage' },
          { value: 'Climatisation', label: 'Climatisation' },
          { value: 'Internet/Fibre', label: 'Internet/Fibre' },
          { value: 'Eau courante', label: 'Eau courante' },
          { value: 'Électricité ENEO', label: 'Électricité ENEO' },
        ],
      },
      // ✅ NOUVEAU: Filtre Accès routier
      {
        id: 'acces_route',
        label: 'Accès routier',
        type: 'select',
        options: [
          { value: 'Route goudronnée', label: 'Route goudronnée' },
          { value: 'Route en bon état', label: 'Route en bon état' },
          { value: 'Route carrossable', label: 'Route carrossable' },
          { value: 'Zone inondable saison pluies', label: 'Zone inondable saison pluies' },
        ],
      },
      // ✅ NOUVEAU: Filtre Proximités
      {
        id: 'proximites',
        label: 'Proximités',
        type: 'multiselect',
        options: [
          { value: 'École primaire', label: 'École primaire' },
          { value: 'École secondaire', label: 'École secondaire' },
          { value: 'Hôpital', label: 'Hôpital' },
          { value: 'Pharmacie', label: 'Pharmacie' },
          { value: 'Supermarché/Mahima', label: 'Supermarché/Mahima' },
          { value: 'Marché', label: 'Marché' },
          { value: 'Banque/GAB', label: 'Banque/GAB' },
          { value: 'Transport public', label: 'Transport public' },
        ],
      },
      {
        id: 'parking',
        label: 'Avec parking',
        type: 'toggle',
      },
      {
        id: 'ascenseur',
        label: 'Avec ascenseur',
        type: 'toggle',
      },
      {
        id: 'disponibleImmediatement',
        label: 'Disponible immédiatement',
        type: 'toggle',
      },
      {
        id: 'titreFoncier',
        label: 'Titre foncier (vente)',
        type: 'toggle',
      },
      {
        id: 'capacitePersonnes',
        label: 'Capacité (voyageurs)',
        type: 'range',
        min: 1,
        max: 20,
        unit: 'personnes',
      },
      {
        id: 'nettoyageInclus',
        label: 'Ménage inclus',
        type: 'toggle',
      },
      {
        id: 'lingeInclus',
        label: 'Linge fourni',
        type: 'toggle',
      },
      {
        id: 'reservationInstantanee',
        label: 'Réservation instantanée',
        type: 'toggle',
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

  // 🏠 LOCATION COURTE DURÉE (Type Airbnb)
  // Réutilise la même configuration qu'immobilier_batiment avec des filtres additionnels
  immobilier_location_courte: {
    terminology: {
      productLabel: 'Hébergement vacances',
      productsLabel: 'Locations courte durée',
      priceLabel: 'Prix/nuit',
      locationLabel: 'Quartier',
      providerLabel: 'Hôte',
      searchPlaceholder: 'Rechercher une location de vacances...',
      emptyMessage: 'Aucune location courte durée disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix/nuit croissant',
        price_desc: 'Prix/nuit décroissant',
        distance: 'Proximité',
      },
    },
    // ✅ FILTRES ENRICHIS SPÉCIFIQUES LOCATION COURTE DURÉE
    filters: [
      {
        id: 'ville',
        label: 'Destination',
        type: 'select',
        options: [
          { value: 'Kribi', label: 'Kribi (Plage)' },
          { value: 'Limbe', label: 'Limbe (Plage)' },
          { value: 'Douala', label: 'Douala' },
          { value: 'Yaoundé', label: 'Yaoundé' },
          { value: 'Bafoussam', label: 'Bafoussam' },
          { value: 'Dschang', label: 'Dschang' },
          { value: 'Foumban', label: 'Foumban' },
          { value: 'Buea', label: 'Buea (Mont Cameroun)' },
        ],
      },
      {
        id: 'typeImmobilier',
        label: 'Type de logement',
        type: 'select',
        options: [
          { value: 'Appartement meublé', label: 'Appartement meublé' },
          { value: 'Studio meublé', label: 'Studio meublé' },
          { value: 'Villa meublée', label: 'Villa meublée' },
          { value: 'Villa avec piscine', label: 'Villa avec piscine' },
          { value: 'Appartement vue mer', label: 'Vue mer' },
          { value: 'Maison de plage', label: 'Maison de plage' },
          { value: 'Bungalow', label: 'Bungalow' },
          { value: 'Chambre privée', label: 'Chambre privée' },
          { value: 'Villa de luxe', label: 'Villa de luxe' },
        ],
      },
      {
        id: 'standing',
        label: 'Standing',
        type: 'select',
        options: [
          { value: 'Économique', label: 'Économique' },
          { value: 'Standard', label: 'Standard' },
          { value: 'Bon standing', label: 'Bon standing' },
          { value: 'Haut standing', label: 'Haut standing' },
          { value: 'Luxe', label: 'Luxe' },
        ],
      },
      {
        id: 'capacites',
        label: 'Capacité',
        type: 'select',
        options: [
          { value: '1 personne', label: '1 personne' },
          { value: '2 personnes', label: '2 personnes (couple)' },
          { value: '3 personnes', label: '3 personnes' },
          { value: '4 personnes', label: '4 personnes (famille)' },
          { value: '5 personnes', label: '5 personnes' },
          { value: '6 personnes', label: '6 personnes' },
          { value: '8 personnes', label: '8 personnes' },
          { value: '10 personnes', label: '10 personnes' },
          { value: '12+ personnes (groupe)', label: 'Groupe (12+)' },
        ],
      },
      {
        id: 'nbChambres',
        label: 'Chambres',
        type: 'range',
        min: 0,
        max: 10,
        unit: 'chambres',
      },
      {
        id: 'dureeMinimum',
        label: 'Durée minimum',
        type: 'select',
        options: [
          { value: '1 nuit', label: '1 nuit' },
          { value: '2 nuits', label: '2 nuits' },
          { value: '3 nuits', label: '3 nuits' },
          { value: '1 semaine', label: '1 semaine' },
          { value: '2 semaines', label: '2 semaines' },
          { value: '1 mois', label: '1 mois' },
          { value: 'Pas de minimum', label: 'Flexible' },
        ],
      },
      {
        id: 'dureeMaximum',
        label: 'Durée maximum',
        type: 'select',
        options: [
          { value: '7 nuits', label: '1 semaine' },
          { value: '14 nuits', label: '2 semaines' },
          { value: '1 mois', label: '1 mois' },
          { value: '2 mois', label: '2 mois' },
          { value: '3 mois', label: '3 mois' },
          { value: 'Illimité', label: 'Aucune limite' },
        ],
      },
      {
        id: 'politiqueAnnulation',
        label: 'Politique annulation',
        type: 'select',
        options: [
          { value: 'Annulation gratuite (24h avant)', label: 'Gratuite (24h avant)' },
          { value: 'Annulation gratuite (48h avant)', label: 'Gratuite (48h avant)' },
          { value: 'Annulation gratuite (7 jours avant)', label: 'Gratuite (7 jours)' },
          { value: 'Annulation flexible (50% remboursé)', label: 'Flexible (50%)' },
          { value: 'Annulation modérée (25% retenu)', label: 'Modérée (25%)' },
          { value: 'Annulation stricte', label: 'Stricte' },
        ],
      },
      {
        id: 'equipementsImmo',
        label: 'Équipements',
        type: 'multiselect',
        options: [
          { value: 'Cuisine équipée', label: 'Cuisine équipée' },
          { value: 'Climatisation', label: 'Climatisation' },
          { value: 'Wi-Fi', label: 'Wi-Fi' },
          { value: 'Piscine', label: 'Piscine' },
          { value: 'Piscine privée', label: 'Piscine privée' },
          { value: 'Jardin', label: 'Jardin' },
          { value: 'Terrasse/Balcon', label: 'Terrasse/Balcon' },
          { value: 'Vue mer', label: 'Vue mer' },
          { value: 'Parking', label: 'Parking' },
          { value: 'Groupe électrogène', label: 'Groupe électrogène' },
          { value: 'Eau courante 24h/24', label: 'Eau 24h/24' },
        ],
      },
      {
        id: 'nettoyageInclus',
        label: 'Ménage inclus',
        type: 'toggle',
      },
      {
        id: 'lingeInclus',
        label: 'Linge fourni',
        type: 'toggle',
      },
      {
        id: 'reservationInstantanee',
        label: 'Réservation instantanée',
        type: 'toggle',
      },
      {
        id: 'type_hote',
        label: 'Type d\'hôte',
        type: 'select',
        options: [
          { value: 'Hôte sur place', label: 'Hôte sur place' },
          { value: 'Hôte à proximité', label: 'Hôte à proximité' },
          { value: 'Hôte à distance', label: 'Hôte à distance' },
          { value: 'Gestion professionnelle', label: 'Gestion professionnelle' },
          { value: 'Agence immobilière', label: 'Agence immobilière' },
          { value: 'Conciergerie', label: 'Conciergerie' },
        ],
      },
      {
        id: 'regles',
        label: 'Règles importantes',
        type: 'multiselect',
        options: [
          { value: 'Animaux acceptés', label: 'Animaux acceptés' },
          { value: 'Animaux interdits', label: 'Animaux interdits' },
          { value: 'Non-fumeur uniquement', label: 'Non-fumeur uniquement' },
          { value: 'Enfants bienvenus', label: 'Enfants bienvenus' },
          { value: 'Fêtes interdites', label: 'Fêtes interdites' },
        ],
      },
      {
        id: 'disponibilites',
        label: 'Disponibilité',
        type: 'multiselect',
        options: [
          { value: 'Disponible toute l\'année', label: 'Toute l\'année' },
          { value: 'Haute saison uniquement (Nov-Fév)', label: 'Haute saison (Nov-Fév)' },
          { value: 'Basse saison uniquement', label: 'Basse saison' },
          { value: 'Week-ends seulement', label: 'Week-ends seulement' },
        ],
      },
      {
        id: 'paiements',
        label: 'Modes de paiement',
        type: 'multiselect',
        options: [
          { value: 'Mobile Money (MTN/Orange)', label: 'Mobile Money' },
          { value: 'Espèces (XAF)', label: 'Espèces' },
          { value: 'Virement bancaire', label: 'Virement bancaire' },
          { value: 'Carte bancaire', label: 'Carte bancaire' },
        ],
      },
    ],
    style: {
      primaryColor: '#F59E0B',
      gradientColors: ['#F59E0B', '#D97706'],
      icon: '🏠',
      badgeColor: '#FEF3C7',
      accentColor: '#D97706',
    },
    displayPriority: ['typeImmobilier', 'capacites', 'prix', 'equipements', 'proximites'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🏞️ IMMOBILIER - TERRAINS (✅ FILTRES ENRICHIS V2)
  immobilier_terrain: {
    terminology: {
      productLabel: 'Terrain',
      productsLabel: 'Terrains',
      priceLabel: 'Prix/Prix au m²',
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
        id: 'ville',
        label: 'Ville',
        type: 'select',
        options: [
          { value: 'Douala', label: 'Douala' },
          { value: 'Yaoundé', label: 'Yaoundé' },
          { value: 'Garoua', label: 'Garoua' },
          { value: 'Bafoussam', label: 'Bafoussam' },
          { value: 'Bamenda', label: 'Bamenda' },
          { value: 'Maroua', label: 'Maroua' },
          { value: 'Ngaoundéré', label: 'Ngaoundéré' },
          { value: 'Kribi', label: 'Kribi' },
          { value: 'Limbe', label: 'Limbe' },
          { value: 'Ebolowa', label: 'Ebolowa' },
        ],
      },
      {
        id: 'statutImmobilier',
        label: 'Statut',
        type: 'select',
        options: [
          { value: 'À vendre', label: 'À vendre' },
          { value: 'Vendu', label: 'Vendu' },
          { value: 'Réservé', label: 'Réservé' },
          { value: 'Disponible immédiatement', label: 'Disponible immédiatement' },
        ],
      },
      {
        id: 'typeTerrain',
        label: 'Type de terrain',
        type: 'select',
        options: [
          { value: 'Résidentiel', label: 'Résidentiel' },
          { value: 'Commercial', label: 'Commercial' },
          { value: 'Agricole', label: 'Agricole' },
          { value: 'Industriel', label: 'Industriel' },
          { value: 'Mixte (Résidentiel/Commercial)', label: 'Mixte' },
          { value: 'Lotissement résidentiel', label: 'Lotissement' },
          { value: 'Zone villa', label: 'Zone villa' },
        ],
      },
      {
        id: 'viabilisation',
        label: 'Viabilisation',
        type: 'select',
        options: [
          { value: 'Viabilisé complet (Eau + Électricité + Route)', label: 'Viabilisé complet' },
          { value: 'Partiellement viabilisé (Électricité + Route)', label: 'Partiellement viabilisé' },
          { value: 'Non viabilisé', label: 'Non viabilisé' },
          { value: 'Raccordement ENEO proche (< 100m)', label: 'ENEO proche' },
          { value: 'Raccordement CDE proche (< 100m)', label: 'CDE proche' },
        ],
      },
      {
        id: 'topographie',
        label: 'Topographie',
        type: 'select',
        options: [
          { value: 'Plat', label: 'Plat' },
          { value: 'Légère pente (< 5%)', label: 'Légère pente' },
          { value: 'Pente moyenne (5-15%)', label: 'Pente moyenne' },
          { value: 'Pente importante (15-30%)', label: 'Pente importante' },
          { value: 'Terrain en hauteur (vue panoramique)', label: 'Vue panoramique' },
        ],
      },
      {
        id: 'accesTerrain',
        label: 'Accès',
        type: 'select',
        options: [
          { value: 'Route goudronnée en bon état', label: 'Route goudronnée' },
          { value: 'Route carrossable toute saison', label: 'Carrossable toute saison' },
          { value: 'Route carrossable (saison sèche uniquement)', label: 'Saison sèche uniquement' },
          { value: 'Piste en terre battue', label: 'Piste' },
          { value: 'Accès 4x4 recommandé', label: '4x4 recommandé' },
        ],
      },
      {
        id: 'superficie',
        label: 'Superficie',
        type: 'range',
        min: 0,
        max: 50000,
        unit: 'm²',
      },
      {
        id: 'zonage',
        label: 'Zonage',
        type: 'select',
        options: [
          { value: 'Zone résidentielle R1', label: 'Zone résidentielle R1' },
          { value: 'Zone résidentielle R2', label: 'Zone résidentielle R2' },
          { value: 'Zone commerciale C1', label: 'Zone commerciale' },
          { value: 'Zone industrielle I1', label: 'Zone industrielle' },
          { value: 'Zone agricole A', label: 'Zone agricole' },
          { value: 'Zone mixte M', label: 'Zone mixte' },
        ],
      },
      {
        id: 'formeTerrain',
        label: 'Forme',
        type: 'select',
        options: [
          { value: 'Rectangulaire', label: 'Rectangulaire' },
          { value: 'Carré', label: 'Carré' },
          { value: 'Irrégulier', label: 'Irrégulier' },
          { value: 'Angle de rue (2 façades)', label: 'Angle de rue' },
        ],
      },
      {
        id: 'vegetation',
        label: 'Végétation',
        type: 'select',
        options: [
          { value: 'Dégagé (terrain nu)', label: 'Dégagé' },
          { value: 'Arbustes épars', label: 'Arbustes' },
          { value: 'Arbres fruitiers', label: 'Arbres fruitiers' },
          { value: 'Dense (débroussaillage nécessaire)', label: 'Dense' },
        ],
      },
      {
        id: 'usageActuel',
        label: 'Usage actuel',
        type: 'select',
        options: [
          { value: 'Vacant (aucune utilisation)', label: 'Vacant' },
          { value: 'Cultivé (plantation cacao/café)', label: 'Cultivé (cacao/café)' },
          { value: 'Cultivé (maraîchage)', label: 'Cultivé (maraîchage)' },
          { value: 'Bâti (construction existante)', label: 'Bâti' },
          { value: 'En friche', label: 'En friche' },
        ],
      },
      {
        id: 'reseauxTerrain',
        label: 'Réseaux disponibles',
        type: 'multiselect',
        options: [
          { value: 'Eau courante CDE', label: 'Eau CDE' },
          { value: 'Électricité ENEO (raccordé)', label: 'Électricité ENEO' },
          { value: 'Fibre optique / Internet haut débit', label: 'Fibre optique' },
          { value: 'Forage privé', label: 'Forage' },
          { value: 'Assainissement collectif (égouts)', label: 'Assainissement' },
        ],
      },
      {
        id: 'natureSol',
        label: 'Nature du sol',
        type: 'select',
        options: [
          { value: 'Latérite (bon pour construction)', label: 'Latérite' },
          { value: 'Sableux', label: 'Sableux' },
          { value: 'Argileux', label: 'Argileux' },
          { value: 'Rocheux', label: 'Rocheux' },
        ],
      },
      {
        id: 'titreFoncier',
        label: 'Titre foncier',
        type: 'toggle',
      },
      {
        id: 'bornage',
        label: 'Bornage effectué',
        type: 'toggle',
      },
      {
        id: 'constructibilite',
        label: 'Constructible',
        type: 'toggle',
      },
      {
        id: 'cloture',
        label: 'Clôturé',
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
      searchPlaceholder: 'Rechercher une voiture, moto, tête de cochon, bendskin...',
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
          { value: 'Voiture', label: 'Voiture' },
          { value: 'Moto', label: 'Moto/Scooter' },
          { value: 'Camion', label: 'Camion' },
          { value: 'Utilitaire', label: 'Utilitaire' },
          { value: 'Bus', label: 'Bus/Minibus' },
        ],
      },
      {
        id: 'marqueAutomobile',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Toyota', label: 'Toyota' },
          { value: 'Honda', label: 'Honda' },
          { value: 'Mercedes', label: 'Mercedes-Benz' },
          { value: 'BMW', label: 'BMW' },
          { value: 'Nissan', label: 'Nissan' },
          { value: 'Hyundai', label: 'Hyundai' },
          { value: 'Kia', label: 'Kia' },
          { value: 'Mazda', label: 'Mazda' },
          { value: 'Ford', label: 'Ford' },
          { value: 'Volkswagen', label: 'Volkswagen' },
          { value: 'Peugeot', label: 'Peugeot' },
          { value: 'Renault', label: 'Renault' },
          { value: 'Citroën', label: 'Citroën' },
          { value: 'Audi', label: 'Audi' },
          { value: 'Suzuki', label: 'Suzuki' },
          { value: 'Mitsubishi', label: 'Mitsubishi' },
          { value: 'Yamaha', label: 'Yamaha' },
          { value: 'Kawasaki', label: 'Kawasaki' },
          { value: 'KTM', label: 'KTM' },
          { value: 'Autre', label: 'Autre' },
        ],
      },
      {
        id: 'typeCarrosserie',
        label: 'Type de carrosserie',
        type: 'select',
        options: [
          { value: 'Berline', label: 'Berline' },
          { value: '4x4/SUV', label: '4x4/SUV' },
          { value: 'Pick-up', label: 'Pick-up' },
          { value: 'Coupé', label: 'Coupé' },
          { value: 'Break', label: 'Break' },
          { value: 'Monospace', label: 'Monospace' },
          { value: 'Cabriolet', label: 'Cabriolet' },
          { value: 'Citadine', label: 'Citadine' },
        ],
      },
      {
        id: 'etatVehicule',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf', label: 'Neuf (0 km)' },
          { value: 'Occasion', label: 'Occasion' },
          { value: 'Accidenté', label: 'Accidenté' },
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
          { value: 'Noir', label: 'Noir' },
          { value: 'Blanc', label: 'Blanc' },
          { value: 'Gris', label: 'Gris' },
          { value: 'Argent', label: 'Argent' },
          { value: 'Rouge', label: 'Rouge' },
          { value: 'Bleu', label: 'Bleu' },
          { value: 'Vert', label: 'Vert' },
          { value: 'Jaune', label: 'Jaune' },
          { value: 'Autre', label: 'Autre' },
        ],
      },
      {
        id: 'typeCarburant',
        label: 'Carburant',
        type: 'select',
        options: [
          { value: 'Essence', label: 'Essence' },
          { value: 'Diesel', label: 'Diesel' },
          { value: 'Hybride', label: 'Hybride' },
          { value: 'Électrique', label: 'Électrique' },
          { value: 'GPL', label: 'GPL' },
        ],
      },
      {
        id: 'transmission',
        label: 'Transmission',
        type: 'select',
        options: [
          { value: 'Manuelle', label: 'Manuelle' },
          { value: 'Automatique', label: 'Automatique' },
          { value: 'Semi-automatique', label: 'Semi-automatique' },
        ],
      },
      {
        id: 'equipementsAuto',
        label: 'Équipements',
        type: 'multiselect',
        options: [
          { value: 'Climatisation', label: 'Climatisation' },
          { value: 'GPS/Navigation', label: 'GPS/Navigation' },
          { value: 'Caméra de recul', label: 'Caméra de recul' },
          { value: 'Sièges cuir', label: 'Sièges cuir' },
          { value: 'Toit ouvrant', label: 'Toit ouvrant' },
          { value: 'Bluetooth/USB', label: 'Bluetooth/USB' },
          { value: 'Régulateur vitesse', label: 'Régulateur de vitesse' },
          { value: 'Airbags', label: 'Airbags' },
          { value: 'ABS', label: 'ABS' },
          { value: 'Alarme', label: 'Alarme/Anti-vol' },
          { value: 'Jantes alliage', label: 'Jantes alliage' },
          { value: 'Vitres électriques', label: 'Vitres électriques' },
        ],
      },
      {
        id: 'premiereMain',
        label: 'Première main',
        type: 'toggle',
      },
      {
        id: 'contreTechnique',
        label: 'Contrôle technique valide',
        type: 'toggle',
      },
      {
        id: 'bonEtat',
        label: 'Bon état uniquement',
        type: 'toggle',
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
    // ✅ NOUVEAU: Mots-clés locaux africains pour recherche intelligente
    searchKeywords: [
      // Noms standards
      'voiture', 'auto', 'automobile', 'véhicule', 'vehicule', 'moto', 'scooter',
      'camion', 'pick-up', 'pickup', '4x4', 'suv', 'bus', 'minibus',
      // 🇨🇲 CAMEROUN
      'tête de cochon', 'tete de cochon', 'r4', 'renault 4',
      '504 bâchée', '504 bachee', 'bâchée', 'bachee',
      'bendskin', 'bend skin', 'moto taxi', 'mototaxi',
      'clandos', 'clando', 'taxi clando',
      'corolla 88', 'corolla e90', 'toyota 88',
      'hiace', 'hi-ace', 'hiace bus',
      // 🇨🇮 CÔTE D'IVOIRE
      'gbaka', 'gbakas',
      'wôrô-wôrô', 'woro woro', 'woro-woro', 'wôrô wôrô', 'taxi collectif',
      'pinasse', 'pirogue motorisée',
      // 🇸🇳 SÉNÉGAL
      'car rapide', 'cars rapides',
      'ndiaga ndiaye', 'ndiaga-ndiaye',
      'sept-places', '7 places', 'sept places', 'taxi brousse',
      'jakarta', 'jakarta moto',
      // 🇨🇩🇨🇬 CONGO RDC/RC
      'fula-fula', 'fula fula', 'fullah-fullah',
      'esprit de mort', 'esprit-de-mort', 'moto dangereuse',
      '100kg', '100 kg', 'cent kilo', 'moto livraison',
      'taxi-bus', 'taxi bus', 'bus taxi',
      // 🇧🇯🇹🇬 BÉNIN/TOGO
      'zémidjan', 'zemidjan', 'zem',
      'oléya', 'oleya',
      // 🇲🇱 MALI
      'sotrama', 'sotrama bus',
      'djan-djan', 'djan djan', 'djandjan',
      // 🇬🇦 GABON
      'clandos gabon', 'taxi gabon',
      // Marques populaires en Afrique
      'toyota', 'peugeot', 'nissan', 'honda', 'hyundai', 'kia',
      'mercedes', 'bmw', 'volkswagen', 'renault', 'ford',
      // Modèles iconiques
      'corolla', 'camry', 'hilux', 'land cruiser', 'rav4',
      '504', '505', '307', '308', '407',
      'carina', 'avensis', 'yaris', 'vitz',
      'patrol', 'navara', 'qashqai',
      'accord', 'civic', 'cr-v',
    ],
  },

  // 🔧 MÉCANICIEN / GARAGE AUTOMOBILE
  mecanicien: {
    terminology: {
      productLabel: 'Garage',
      productsLabel: 'Garages & Mécaniciens',
      priceLabel: 'Tarif',
      locationLabel: 'Zone',
      providerLabel: 'Garage',
      searchPlaceholder: 'Rechercher un garage, mécanicien...',
      emptyMessage: 'Aucun garage trouvé dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeServiceMecanique',
        label: 'Type de service',
        type: 'multiselect',
        options: [
          // Entretien courant
          { value: 'Vidange moteur', label: 'Vidange moteur' },
          { value: 'Révision complète', label: 'Révision complète' },
          { value: 'Diagnostic électronique', label: 'Diagnostic électronique' },
          { value: 'Contrôle technique', label: 'Contrôle technique' },
          { value: 'Changement filtres', label: 'Changement filtres' },
          { value: 'Remplacement plaquettes de frein', label: 'Freins' },
          { value: 'Changement batterie', label: 'Batterie' },
          // Mécanique
          { value: 'Réparation moteur', label: 'Réparation moteur' },
          { value: 'Embrayage', label: 'Embrayage' },
          { value: 'Boîte de vitesses', label: 'Boîte de vitesses' },
          { value: 'Suspension', label: 'Suspension' },
          { value: 'Échappement', label: 'Échappement' },
          { value: 'Turbo', label: 'Turbo' },
          // Électricité
          { value: 'Alternateur', label: 'Alternateur' },
          { value: 'Démarreur', label: 'Démarreur' },
          { value: 'Climatisation', label: 'Climatisation' },
          { value: 'Injection', label: 'Injection' },
          // Carrosserie
          { value: 'Débosselage', label: 'Débosselage' },
          { value: 'Peinture', label: 'Peinture' },
          { value: 'Vitrage', label: 'Vitrage (pare-brise)' },
          // Pneumatiques
          { value: 'Montage pneus', label: 'Montage pneus' },
          { value: 'Parallélisme', label: 'Parallélisme' },
          { value: 'Équilibrage roues', label: 'Équilibrage roues' },
          // Dépannage
          { value: 'Dépannage sur route', label: 'Dépannage sur route' },
          { value: 'Remorquage', label: 'Remorquage' },
          { value: 'Dépannage 24h/24', label: 'Dépannage 24h/24' },
        ],
      },
      {
        id: 'specialitesGarage',
        label: 'Spécialités',
        type: 'multiselect',
        options: [
          { value: 'Toutes marques', label: 'Toutes marques' },
          { value: 'Marques japonaises', label: 'Marques japonaises' },
          { value: 'Marques européennes', label: 'Marques européennes' },
          { value: 'Marques américaines', label: 'Marques américaines' },
          { value: 'Marques chinoises', label: 'Marques chinoises' },
          { value: 'Véhicules 4x4/SUV', label: 'Véhicules 4x4/SUV' },
          { value: 'Véhicules légers', label: 'Véhicules légers' },
          { value: 'Camions/Poids lourds', label: 'Camions/Poids lourds' },
          { value: 'Motos/Scooters', label: 'Motos/Scooters' },
          { value: 'Engins TP/BTP', label: 'Engins TP/BTP' },
        ],
      },
      {
        id: 'marquesVehicules',
        label: 'Marques traitées',
        type: 'multiselect',
        options: [
          // Japonaises (populaires en Afrique)
          { value: 'Toyota', label: 'Toyota' },
          { value: 'Nissan', label: 'Nissan' },
          { value: 'Honda', label: 'Honda' },
          { value: 'Mitsubishi', label: 'Mitsubishi' },
          { value: 'Mazda', label: 'Mazda' },
          { value: 'Suzuki', label: 'Suzuki' },
          { value: 'Isuzu', label: 'Isuzu' },
          // Européennes
          { value: 'Renault', label: 'Renault' },
          { value: 'Peugeot', label: 'Peugeot' },
          { value: 'Citroën', label: 'Citroën' },
          { value: 'Mercedes-Benz', label: 'Mercedes-Benz' },
          { value: 'BMW', label: 'BMW' },
          { value: 'Volkswagen', label: 'Volkswagen' },
          { value: 'Ford', label: 'Ford' },
          // Américaines
          { value: 'Chevrolet', label: 'Chevrolet' },
          { value: 'GMC', label: 'GMC' },
          { value: 'Jeep', label: 'Jeep' },
          // Coréennes
          { value: 'Hyundai', label: 'Hyundai' },
          { value: 'Kia', label: 'Kia' },
          // Chinoises
          { value: 'Changan', label: 'Changan' },
          { value: 'Chery', label: 'Chery' },
          { value: 'Great Wall', label: 'Great Wall' },
        ],
      },
      {
        id: 'certificationsMeca',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'Mécanicien agréé constructeur', label: 'Agréé constructeur' },
          { value: 'CAP/BEP Mécanique', label: 'CAP/BEP Mécanique' },
          { value: 'BTS Maintenance automobile', label: 'BTS Maintenance' },
          { value: 'Formation Toyota', label: 'Formation Toyota' },
          { value: 'Formation Nissan', label: 'Formation Nissan' },
          { value: 'Formation Renault', label: 'Formation Renault' },
          { value: 'Certification diagnostic électronique', label: 'Diagnostic électronique' },
          { value: 'Expert 4x4', label: 'Expert 4x4' },
          { value: 'Expert moteur diesel', label: 'Expert diesel' },
        ],
      },
      {
        id: 'delaisIntervention',
        label: 'Délais',
        type: 'select',
        options: [
          { value: 'Intervention immédiate', label: 'Immédiat' },
          { value: 'Même jour', label: 'Même jour' },
          { value: 'Sous 24h', label: 'Sous 24h' },
          { value: 'Sous 48h', label: 'Sous 48h' },
          { value: 'Sous 1 semaine', label: 'Sous 1 semaine' },
        ],
      },
      {
        id: 'urgenceMeca',
        label: 'Dépannage urgence',
        type: 'select',
        options: [
          { value: 'Oui - Dépannage 24h/24', label: 'Oui - 24h/24' },
          { value: 'Oui - Dépannage jour uniquement', label: 'Oui - Jour uniquement' },
          { value: 'Non', label: 'Non' },
        ],
      },
      {
        id: 'devisGratuit',
        label: 'Devis gratuit',
        type: 'toggle',
      },
      {
        id: 'garantieReparations',
        label: 'Garantie réparations',
        type: 'toggle',
      },
      {
        id: 'vehiculeCourtoisie',
        label: 'Véhicule de courtoisie',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#0EA5E9',
      gradientColors: ['#0EA5E9', '#0284C7'],
      icon: '🔧',
      badgeColor: '#E0F2FE',
      accentColor: '#0284C7',
    },
    displayPriority: ['nomGarage', 'specialitesGarage', 'typeServiceMecanique', 'certificationsMeca', 'urgenceMeca'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    searchKeywords: [
      // Termes généraux
      'garage', 'mécanicien', 'mecanicien', 'garagiste', 'atelier auto',
      'réparation auto', 'reparation auto', 'réparation automobile',
      'dépannage', 'depannage', 'dépannage auto', 'depannage auto',
      'mécanique', 'mecanique', 'mécanique auto', 'mecanique auto',
      // Services populaires
      'vidange', 'révision', 'revision', 'diagnostic',
      'frein', 'freins', 'plaquettes', 'disques',
      'batterie', 'alternateur', 'démarreur', 'demarreur',
      'embrayage', 'boîte de vitesses', 'boite de vitesses',
      'suspension', 'amortisseur', 'échappement', 'echappement',
      'pneu', 'pneus', 'pneumatique', 'parallélisme', 'parallelisme',
      'climatisation', 'clim', 'recharge clim',
      'peinture auto', 'carrosserie', 'débosselage', 'debosselage',
      'vitrage', 'pare-brise', 'pare brise',
      // Dépannage
      'dépannage 24h', 'depannage 24h', 'remorquage',
      'dépannage urgent', 'urgence auto', 'panne auto',
      // Termes locaux africains
      'garage douala', 'garage yaoundé', 'garage yaounde',
      'mécanicien douala', 'mecanicien douala',
      'mécanicien yaoundé', 'mecanicien yaounde',
      'atelier mécanique', 'atelier mecanique',
      // Quartiers populaires (Cameroun)
      'garage akwa', 'garage bonanjo', 'garage bonabéri', 'garage bonaberi',
      'garage makepe', 'garage deido', 'garage new bell',
      'garage bastos', 'garage nlongkak', 'garage melen',
      'garage mokolo', 'garage essos', 'garage emana',
      // Spécialités
      'garage toyota', 'garage nissan', 'garage peugeot', 'garage renault',
      'garage 4x4', 'garage poids lourds', 'garage moto',
      'expert diesel', 'expert injection', 'expert clim',
      // Services
      'contrôle technique', 'controle technique',
      'vente pièces auto', 'vente pieces auto',
    ],
  },

  // 🏍️ MÉCANICIEN MOTO/TRICYCLE SPÉCIALISÉ
  mecanicien_moto: {
    terminology: {
      productLabel: 'Garage Moto',
      productsLabel: 'Garages Moto & Tricycle',
      priceLabel: 'Tarif',
      locationLabel: 'Zone',
      providerLabel: 'Garage Moto',
      searchPlaceholder: 'Rechercher un garage moto, mécanicien moto...',
      emptyMessage: 'Aucun garage moto trouvé dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeServiceMoto',
        label: 'Services spécialisés motos',
        type: 'multiselect',
        options: [
          // Entretien moteur moto
          { value: 'Vidange moteur moto', label: 'Vidange moteur moto' },
          { value: 'Réglage carburateur', label: 'Réglage carburateur' },
          { value: 'Nettoyage carburateur', label: 'Nettoyage carburateur' },
          { value: 'Diagnostic injection', label: 'Diagnostic injection' },
          { value: 'Révision moteur complète', label: 'Révision moteur complète' },
          // Transmission
          { value: 'Réglage embrayage', label: 'Réglage embrayage' },
          { value: 'Remplacement chaîne', label: 'Remplacement chaîne' },
          { value: 'Réglage courroie', label: 'Réglage courroie' },
          { value: 'Réglage variateur', label: 'Réglage variateur' },
          // Freinage
          { value: 'Réglage freins', label: 'Réglage freins' },
          { value: 'Remplacement plaquettes frein', label: 'Remplacement plaquettes' },
          { value: 'Purge circuit freinage', label: 'Purge freinage' },
          // Suspension moto
          { value: 'Réglage suspension avant', label: 'Réglage suspension avant' },
          { value: 'Réglage suspension arrière', label: 'Réglage suspension arrière' },
          { value: 'Remplacement amortisseurs', label: 'Remplacement amortisseurs' },
          // Pneumatiques moto
          { value: 'Montage pneus moto', label: 'Montage pneus moto' },
          { value: 'Équilibrage roues moto', label: 'Équilibrage roues' },
          { value: 'Réparation crevaison', label: 'Réparation crevaison' },
          // Électricité moto
          { value: 'Diagnostic électrique', label: 'Diagnostic électrique' },
          { value: 'Remplacement batterie', label: 'Remplacement batterie' },
          { value: 'Réparation faisceau', label: 'Réparation faisceau' },
          { value: 'Installation alarme', label: 'Installation alarme' },
          { value: 'Installation GPS moto', label: 'Installation GPS' },
          // Carrosserie moto
          { value: 'Réparation carénage', label: 'Réparation carénage' },
          { value: 'Peinture carénage', label: 'Peinture carénage' },
          { value: 'Remplacement phares', label: 'Remplacement phares' },
          { value: 'Personnalisation', label: 'Personnalisation' },
          // Tricycles
          { value: 'Réglage direction tricycle', label: 'Réglage direction tricycle' },
          { value: 'Installation coffre tricycle', label: 'Installation coffre tricycle' },
          // Dépannage
          { value: 'Dépannage moto sur route', label: 'Dépannage sur route' },
          { value: 'Remorquage moto', label: 'Remorquage moto' },
          { value: 'Dépannage 24h/24', label: 'Dépannage 24h/24' },
        ],
      },
      {
        id: 'specialitesMoto',
        label: 'Spécialités motos',
        type: 'multiselect',
        options: [
          { value: 'Toutes marques motos', label: 'Toutes marques motos' },
          { value: 'Marques japonaises motos', label: 'Marques japonaises' },
          { value: 'Marques chinoises motos', label: 'Marques chinoises' },
          { value: 'Marques indiennes motos', label: 'Marques indiennes' },
          { value: 'Marques européennes motos', label: 'Marques européennes' },
          { value: 'Motos de course', label: 'Motos de course' },
          { value: 'Motos custom', label: 'Motos custom' },
          { value: 'Motos trail/enduro', label: 'Motos trail/enduro' },
          { value: 'Motos sportives', label: 'Motos sportives' },
          { value: 'Scooters', label: 'Scooters' },
          { value: 'Tricycles', label: 'Tricycles' },
          { value: 'Motos électriques', label: 'Motos électriques' },
        ],
      },
      {
        id: 'marquesMotos',
        label: 'Marques motos traitées',
        type: 'multiselect',
        options: [
          // Japonaises (très populaires)
          { value: 'Yamaha', label: 'Yamaha' },
          { value: 'Honda', label: 'Honda' },
          { value: 'Suzuki', label: 'Suzuki' },
          { value: 'Kawasaki', label: 'Kawasaki' },
          // Chinoises/Indiennes (croissance en Afrique)
          { value: 'Bajaj', label: 'Bajaj' },
          { value: 'TVS', label: 'TVS' },
          { value: 'Hero', label: 'Hero' },
          { value: 'Royal Enfield', label: 'Royal Enfield' },
          { value: 'Lifan', label: 'Lifan' },
          { value: 'Zongshen', label: 'Zongshen' },
          { value: 'Qingqi', label: 'Qingqi' },
          // Européennes
          { value: 'BMW Motorrad', label: 'BMW Motorrad' },
          { value: 'KTM', label: 'KTM' },
          { value: 'Aprilia', label: 'Aprilia' },
          { value: 'Piaggio', label: 'Piaggio' },
          { value: 'Vespa', label: 'Vespa' },
          // Américaines
          { value: 'Harley-Davidson', label: 'Harley-Davidson' },
        ],
      },
      {
        id: 'typesMotos',
        label: 'Types de motos/tricycles',
        type: 'multiselect',
        options: [
          { value: 'Moto sportive', label: 'Moto sportive' },
          { value: 'Moto routière', label: 'Moto routière' },
          { value: 'Moto trail', label: 'Moto trail' },
          { value: 'Moto enduro', label: 'Moto enduro' },
          { value: 'Moto custom', label: 'Moto custom' },
          { value: 'Scooter', label: 'Scooter' },
          { value: 'Cyclomoteur', label: 'Cyclomoteur' },
          { value: 'Tricycle', label: 'Tricycle' },
          { value: 'Quadricycle', label: 'Quadricycle' },
        ],
      },
      {
        id: 'cylindreesMotos',
        label: 'Cylindrées spécialisées',
        type: 'multiselect',
        options: [
          { value: '50cc', label: '50cc' },
          { value: '80cc', label: '80cc' },
          { value: '100cc', label: '100cc' },
          { value: '110cc', label: '110cc' },
          { value: '125cc', label: '125cc' },
          { value: '150cc', label: '150cc' },
          { value: '200cc', label: '200cc' },
          { value: '250cc', label: '250cc' },
          { value: '300cc', label: '300cc' },
          { value: '500cc', label: '500cc' },
          { value: '600cc', label: '600cc' },
          { value: '750cc', label: '750cc' },
          { value: '1000cc', label: '1000cc' },
          { value: '1200cc+', label: '1200cc+' },
        ],
      },
      {
        id: 'certificationsMoto',
        label: 'Certifications motos',
        type: 'multiselect',
        options: [
          { value: 'Mécanicien agréé constructeur moto', label: 'Agréé constructeur moto' },
          { value: 'CAP/BEP Mécanique moto', label: 'CAP/BEP Moto' },
          { value: 'Formation Yamaha', label: 'Formation Yamaha' },
          { value: 'Formation Honda', label: 'Formation Honda' },
          { value: 'Formation Suzuki', label: 'Formation Suzuki' },
          { value: 'Formation Bajaj', label: 'Formation Bajaj' },
          { value: 'Expert carburation', label: 'Expert carburation' },
          { value: 'Expert injection moto', label: 'Expert injection moto' },
          { value: 'Expert transmission moto', label: 'Expert transmission moto' },
        ],
      },
      {
        id: 'delaisMoto',
        label: 'Délais d\'intervention',
        type: 'select',
        options: [
          { value: 'Intervention immédiate', label: 'Immédiat' },
          { value: 'Même jour', label: 'Même jour' },
          { value: 'Sous 24h', label: 'Sous 24h' },
          { value: 'Sous 48h', label: 'Sous 48h' },
          { value: 'Sous 1 semaine', label: 'Sous 1 semaine' },
        ],
      },
      {
        id: 'urgenceMoto',
        label: 'Dépannage urgence moto',
        type: 'select',
        options: [
          { value: 'Oui - Dépannage moto 24h/24', label: 'Oui - 24h/24' },
          { value: 'Oui - Dépannage jour uniquement', label: 'Oui - Jour uniquement' },
          { value: 'Non', label: 'Non' },
        ],
      },
      {
        id: 'devisGratuitMoto',
        label: 'Devis gratuit',
        type: 'toggle',
      },
      {
        id: 'garantieReparationsMoto',
        label: 'Garantie réparations',
        type: 'toggle',
      },
      {
        id: 'motoCourtoisie',
        label: 'Moto de courtoisie',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#F59E0B',
      gradientColors: ['#F59E0B', '#D97706'],
      icon: '🏍️',
      badgeColor: '#FEF3C7',
      accentColor: '#D97706',
    },
    displayPriority: ['nomGarageMoto', 'specialitesMoto', 'typeServiceMoto', 'marquesMotos', 'certificationsMoto', 'urgenceMoto'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    searchKeywords: [
      // Termes généraux motos
      'garage moto', 'mécanicien moto', 'mecanicien moto', 'garagiste moto',
      'atelier moto', 'réparation moto', 'reparation moto',
      'dépannage moto', 'depannage moto', 'mécanique moto', 'mecanique moto',
      // Tricycles
      'garage tricycle', 'mécanicien tricycle', 'mecanicien tricycle',
      'réparation tricycle', 'reparation tricycle', 'tricycle',
      // Services motos
      'vidange moto', 'révision moto', 'revision moto',
      'carburateur', 'carburation', 'réglage carbu', 'reglage carbu',
      'chaîne moto', 'chaine moto', 'courroie moto',
      'frein moto', 'freins moto', 'plaquettes moto',
      'pneu moto', 'pneus moto', 'crevaison moto',
      'batterie moto', 'alternateur moto',
      'suspension moto', 'amortisseur moto',
      'carénage', 'carenage', 'peinture moto',
      // Marques populaires
      'yamaha', 'honda moto', 'suzuki moto', 'kawasaki',
      'bajaj', 'tvs', 'hero', 'royal enfield',
      'lifan', 'zongshen', 'qingqi',
      'ktm', 'bmw moto', 'harley davidson',
      // Types motos
      'scooter', 'moto sport', 'moto trail', 'enduro',
      'moto custom', 'moto routière', 'moto routiere',
      'cyclomoteur', '50cc', '125cc', 'grosse cylindrée', 'grosse cylindree',
      // Dépannage
      'dépannage moto 24h', 'depannage moto 24h', 'remorquage moto',
      'dépannage moto urgent', 'urgence moto', 'panne moto',
      // Termes locaux africains
      'garage moto douala', 'garage moto yaoundé', 'garage moto yaounde',
      'mécanicien moto douala', 'mecanicien moto douala',
      'mécanicien moto yaoundé', 'mecanicien moto yaounde',
      'atelier moto douala', 'atelier moto yaounde',
      // Quartiers populaires (Cameroun)
      'garage moto akwa', 'garage moto bonanjo', 'garage moto makepe',
      'garage moto deido', 'garage moto new bell', 'garage moto bastos',
      'garage moto nlongkak', 'garage moto melen', 'garage moto mokolo',
      // Spécialités
      'garage yamaha', 'garage honda moto', 'garage bajaj', 'garage tvs',
      'expert carbu', 'expert carburation', 'expert injection moto',
      'spécialiste moto', 'specialiste moto', 'pro moto',
      // Pièces
      'pièces moto', 'pieces moto', 'pièces détachées moto', 'pieces detachees moto',
      'accessoires moto',
    ],
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
        label: 'Compagnie de transport',
        type: 'select',
        options: [
          // 🇨🇲 COMPAGNIES BUS CAMEROUN
          { value: 'touristique_express', label: '🚌 Touristique Express' },
          { value: 'centrale_voyage', label: '🚌 Centrale Voyage' },
          { value: 'express_voyage', label: '🚌 Express Voyage' },
          { value: 'express_ferry', label: '🚌 Express Ferry' },
          { value: 'tgm_transport', label: '🚌 TGM Transport' },
          { value: 'achille_talon', label: '🚌 Achille Talon' },
          { value: 'trans_cameroun', label: '🚌 Trans Cameroun' },
          { value: 'gazelle_voyages', label: '🚌 Gazelle Voyages' },
          { value: 'voyages_safari', label: '🚌 Voyages Safari' },
          // ✈️ COMPAGNIES AÉRIENNES
          { value: 'camair_co', label: '✈️ Camair-Co' },
          { value: 'asky_airlines', label: '✈️ Asky Airlines' },
          { value: 'ethiopian_airlines', label: '✈️ Ethiopian Airlines' },
          { value: 'kenya_airways', label: '✈️ Kenya Airways' },
          { value: 'air_france', label: '✈️ Air France' },
          { value: 'turkey_airlines', label: '✈️ Turkish Airlines' },
          { value: 'royal_air_maroc', label: '✈️ Royal Air Maroc' },
          // 🚂 TRAINS
          { value: 'camrail', label: '🚂 Camrail' },
          // Autres
          { value: 'autre', label: 'Autre compagnie' },
        ],
      },
      {
        id: 'typeVehiculeTransport',
        label: 'Type de transport',
        type: 'select',
        options: [
          { value: 'bus', label: '🚌 Bus' },
          { value: 'minibus', label: '🚐 Minibus' },
          { value: 'van', label: '🚐 Van climatisé' },
          { value: 'train', label: '🚂 Train' },
          { value: 'avion', label: '✈️ Avion' },
          { value: 'bateau', label: '🚢 Bateau' },
        ],
      },
      {
        id: 'classeVoyage',
        label: 'Classe',
        type: 'select',
        options: [
          { value: 'economique', label: 'Économique' },
          { value: 'economique_premium', label: 'Économique Premium' },
          { value: 'affaires', label: 'Affaires' },
          { value: 'business', label: 'Business' },
          { value: 'premiere_classe', label: 'Première classe' },
          { value: 'vip', label: 'VIP' },
        ],
      },
      {
        id: 'depart',
        label: 'Ville de départ',
        type: 'select',
        options: [
          // Grandes villes
          { value: 'douala', label: 'Douala (Littoral)' },
          { value: 'yaounde', label: 'Yaoundé (Centre)' },
          { value: 'garoua', label: 'Garoua (Nord)' },
          { value: 'bafoussam', label: 'Bafoussam (Ouest)' },
          { value: 'bamenda', label: 'Bamenda (Nord-Ouest)' },
          { value: 'maroua', label: 'Maroua (Extrême-Nord)' },
          { value: 'ngaoundere', label: 'Ngaoundéré (Adamaoua)' },
          { value: 'bertoua', label: 'Bertoua (Est)' },
          { value: 'ebolowa', label: 'Ebolowa (Sud)' },
          { value: 'limbe', label: 'Limbe (Sud-Ouest)' },
          { value: 'kribi', label: 'Kribi (Sud)' },
          // Villes moyennes
          { value: 'buea', label: 'Buea (Sud-Ouest)' },
          { value: 'dschang', label: 'Dschang (Ouest)' },
          { value: 'foumban', label: 'Foumban (Ouest)' },
          { value: 'kumba', label: 'Kumba (Sud-Ouest)' },
          { value: 'edea', label: 'Édéa (Littoral)' },
          { value: 'autre', label: 'Autre ville' },
        ],
      },
      {
        id: 'destination',
        label: 'Destination',
        type: 'select',
        options: [
          // Grandes villes
          { value: 'douala', label: 'Douala (Littoral)' },
          { value: 'yaounde', label: 'Yaoundé (Centre)' },
          { value: 'garoua', label: 'Garoua (Nord)' },
          { value: 'bafoussam', label: 'Bafoussam (Ouest)' },
          { value: 'bamenda', label: 'Bamenda (Nord-Ouest)' },
          { value: 'maroua', label: 'Maroua (Extrême-Nord)' },
          { value: 'ngaoundere', label: 'Ngaoundéré (Adamaoua)' },
          { value: 'bertoua', label: 'Bertoua (Est)' },
          { value: 'ebolowa', label: 'Ebolowa (Sud)' },
          { value: 'limbe', label: 'Limbe (Sud-Ouest)' },
          { value: 'kribi', label: 'Kribi (Sud)' },
          // Villes moyennes
          { value: 'buea', label: 'Buea (Sud-Ouest)' },
          { value: 'dschang', label: 'Dschang (Ouest)' },
          { value: 'foumban', label: 'Foumban (Ouest)' },
          { value: 'kumba', label: 'Kumba (Sud-Ouest)' },
          { value: 'edea', label: 'Édéa (Littoral)' },
          { value: 'autre', label: 'Autre ville' },
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
        id: 'placesDisponibles',
        label: 'Places disponibles',
        type: 'range',
        min: 1,
        max: 60,
        unit: 'places',
      },
      {
        id: 'bagage',
        label: 'Bagage inclus',
        type: 'select',
        options: [
          { value: 'Cabine uniquement', label: 'Cabine uniquement' },
          { value: 'Cabine + Soute', label: 'Cabine + Soute' },
          { value: 'Sans bagage', label: 'Sans bagage' },
        ],
      },
      {
        id: 'repas',
        label: 'Repas inclus',
        type: 'toggle',
      },
      {
        id: 'wifi',
        label: 'Wi-Fi disponible',
        type: 'toggle',
      },
      {
        id: 'climatisation',
        label: 'Climatisation',
        type: 'toggle',
      },
      {
        id: 'remboursable',
        label: 'Billet remboursable',
        type: 'toggle',
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

  // 🎯 PRESTATION SERVICE - ULTRA-ENRICHI CONTEXTE AFRIQUE FRANCOPHONE
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
        date: 'Mieux notés',
      },
    },
    filters: [
      {
        id: 'categoriePrestation',
        label: 'Catégorie',
        type: 'select',
        options: [
          // Bâtiment & Construction
          { value: '🏗️ Maçonnerie & Béton', label: 'Maçonnerie & Béton' },
          { value: '🏗️ Menuiserie Bois', label: 'Menuiserie Bois' },
          { value: '🏗️ Menuiserie Aluminium', label: 'Menuiserie Aluminium' },
          { value: '🏗️ Plomberie & Sanitaire', label: 'Plomberie & Sanitaire' },
          { value: '🏗️ Électricité Bâtiment', label: 'Électricité Bâtiment' },
          { value: '🏗️ Peinture & Décoration', label: 'Peinture & Décoration' },
          { value: '🏗️ Carrelage & Revêtement', label: 'Carrelage & Revêtement' },
          { value: '🏗️ Climatisation', label: 'Climatisation' },
          // Beauté & Coiffure
          { value: '💇 Coiffure Femme', label: 'Coiffure Femme' },
          { value: '💇 Coiffure Homme (Barbier)', label: 'Barbier' },
          { value: '💇 Tresses & Nattes', label: 'Tresses & Nattes' },
          { value: '💇 Pose de Mèches', label: 'Pose de Mèches' },
          { value: '💇 Manucure & Pédicure', label: 'Manucure & Pédicure' },
          { value: '💇 Maquillage', label: 'Maquillage' },
          // Mécanique & Automobile
          { value: '🔧 Mécanique Auto', label: 'Mécanique Auto' },
          { value: '🔧 Mécanique Moto', label: 'Mécanique Moto' },
          { value: '🔧 Électricité Auto', label: 'Électricité Auto' },
          { value: '🔧 Carrosserie & Peinture', label: 'Carrosserie' },
          { value: '🔧 Vulcanisation (Pneus)', label: 'Vulcanisation' },
          { value: '🔧 Lavage Auto', label: 'Lavage Auto' },
          // Informatique & Tech
          { value: '💻 Réparation Téléphone', label: 'Réparation Téléphone' },
          { value: '💻 Réparation Ordinateur', label: 'Réparation Ordinateur' },
          { value: '💻 Développement Web', label: 'Développement Web' },
          { value: '💻 Graphisme & Design', label: 'Graphisme & Design' },
          // Ménage & Entretien
          { value: '🏠 Ménage à Domicile', label: 'Ménage à Domicile' },
          { value: '🏠 Repassage', label: 'Repassage' },
          { value: '🏠 Jardinage', label: 'Jardinage' },
          // Cuisine & Restauration
          { value: '👨‍🍳 Cuisinier à Domicile', label: 'Cuisinier à Domicile' },
          { value: '👨‍🍳 Traiteur Événements', label: 'Traiteur' },
          { value: '👨‍🍳 Pâtisserie', label: 'Pâtisserie' },
          // Éducation
          { value: '📚 Cours Particuliers Maths', label: 'Cours Maths' },
          { value: '📚 Cours Particuliers Français', label: 'Cours Français' },
          { value: '📚 Cours Particuliers Anglais', label: 'Cours Anglais' },
          { value: '📚 Soutien Scolaire', label: 'Soutien Scolaire' },
          // Santé & Bien-être
          { value: '🩺 Soins Infirmiers', label: 'Soins Infirmiers' },
          { value: '🩺 Kinésithérapie', label: 'Kinésithérapie' },
          { value: '🩺 Aide-Soignant', label: 'Aide-Soignant' },
          // Garde & Assistance
          { value: '👶 Garde d\'Enfants', label: 'Garde d\'Enfants' },
          { value: '👶 Baby-sitting', label: 'Baby-sitting' },
          // Événementiel
          { value: '📸 Photographie', label: 'Photographie' },
          { value: '📸 Vidéographie', label: 'Vidéographie' },
          { value: '📸 DJ & Sonorisation', label: 'DJ & Sonorisation' },
          // Transport
          { value: '🚚 Déménagement', label: 'Déménagement' },
          { value: '🚚 Transport Marchandise', label: 'Transport Marchandise' },
          { value: '🚚 Coursier/Livreur', label: 'Coursier/Livreur' },
          // Sécurité
          { value: '🔐 Agent de Sécurité', label: 'Agent de Sécurité' },
          { value: '🔐 Gardiennage', label: 'Gardiennage' },
          // Couture
          { value: '🪡 Couture sur Mesure', label: 'Couture sur Mesure' },
          { value: '🪡 Retouches Vêtements', label: 'Retouches' },
          // Autres
          { value: '⚡ Réparation Électroménager', label: 'Réparation Électroménager' },
          { value: '📄 Saisie & Frappe', label: 'Saisie & Frappe' },
          { value: '📄 Traduction', label: 'Traduction' },
        ],
      },
      {
        id: 'typePrestation',
        label: 'Type de prestation',
        type: 'select',
        options: [
          { value: 'Consultation', label: 'Consultation' },
          { value: 'Installation', label: 'Installation' },
          { value: 'Réparation', label: 'Réparation' },
          { value: 'Maintenance', label: 'Maintenance' },
          { value: 'Formation', label: 'Formation' },
          { value: 'Dépannage urgence', label: 'Dépannage urgence' },
          { value: 'Service à domicile', label: 'À domicile' },
          { value: 'Service en atelier', label: 'En atelier' },
          { value: 'Intervention immédiate', label: 'Urgence 24h/24' },
        ],
      },
      {
        id: 'zoneIntervention',
        label: 'Zone d\'intervention',
        type: 'select',
        options: [
          // ✅ NIVEAU 1: Zones larges (choix rapide)
          { value: '🌍 Toute l\'Afrique francophone', label: 'Toute l\'Afrique francophone' },
          { value: '🇨🇲 Tout le Cameroun', label: 'Tout le Cameroun' },
          { value: '🇨🇩 Tout le RDC', label: 'Toute la RDC' },
          { value: '🇨🇮 Tout le Côte d\'Ivoire', label: 'Toute la Côte d\'Ivoire' },
          { value: '🇸🇳 Tout le Sénégal', label: 'Tout le Sénégal' },
          { value: '🇲🇱 Tout le Mali', label: 'Tout le Mali' },
          { value: '🇬🇦 Tout le Gabon', label: 'Tout le Gabon' },
          { value: '🇨🇬 Tout le Congo-Brazzaville', label: 'Tout le Congo' },

          // ✅ NIVEAU 2: Grandes villes Cameroun
          { value: '🇨🇲 Douala (toute la ville)', label: 'Douala (toute la ville)' },
          { value: '🇨🇲 Yaoundé (toute la ville)', label: 'Yaoundé (toute la ville)' },
          { value: '🇨🇲 Garoua', label: 'Garoua' },
          { value: '🇨🇲 Bafoussam', label: 'Bafoussam' },
          { value: '🇨🇲 Bamenda', label: 'Bamenda' },
          { value: '🇨🇲 Maroua', label: 'Maroua' },

          // ✅ Quartiers Douala (top 5)
          { value: '🇨🇲 Douala - Akwa', label: 'Douala Akwa' },
          { value: '🇨🇲 Douala - Bonanjo', label: 'Douala Bonanjo' },
          { value: '🇨🇲 Douala - Bonapriso', label: 'Douala Bonapriso' },
          { value: '🇨🇲 Douala - Makepe', label: 'Douala Makepe' },
          { value: '🇨🇲 Douala - PK8-PK17', label: 'Douala PK8-17' },

          // ✅ Quartiers Yaoundé (top 5)
          { value: '🇨🇲 Yaoundé - Bastos', label: 'Yaoundé Bastos' },
          { value: '🇨🇲 Yaoundé - Centre-ville', label: 'Yaoundé Centre' },
          { value: '🇨🇲 Yaoundé - Nlongkak', label: 'Yaoundé Nlongkak' },
          { value: '🇨🇲 Yaoundé - Odza', label: 'Yaoundé Odza' },
          { value: '🇨🇲 Yaoundé - Mvan', label: 'Yaoundé Mvan' },

          // ✅ Autres grandes villes Afrique francophone
          { value: '🇨🇩 Kinshasa', label: 'Kinshasa (RDC)' },
          { value: '🇨🇩 Lubumbashi', label: 'Lubumbashi (RDC)' },
          { value: '🇨🇮 Abidjan', label: 'Abidjan (CI)' },
          { value: '🇸🇳 Dakar', label: 'Dakar (SN)' },
          { value: '🇲🇱 Bamako', label: 'Bamako (ML)' },
          { value: '🇬🇦 Libreville', label: 'Libreville (GA)' },
          { value: '🇨🇬 Brazzaville', label: 'Brazzaville (CG)' },
          { value: '🇧🇯 Cotonou', label: 'Cotonou (BJ)' },
          { value: '🇹🇬 Lomé', label: 'Lomé (TG)' },
        ],
      },
      {
        id: 'niveauExperience',
        label: 'Niveau d\'expérience',
        type: 'select',
        options: [
          { value: 'Débutant (< 1 an)', label: 'Débutant' },
          { value: '1-2 ans d\'expérience', label: '1-2 ans' },
          { value: '3-5 ans d\'expérience', label: '3-5 ans' },
          { value: '5-10 ans d\'expérience', label: '5-10 ans' },
          { value: '10-15 ans d\'expérience', label: '10-15 ans' },
          { value: '15-20 ans d\'expérience', label: '15-20 ans' },
          { value: '20+ ans d\'expérience', label: '20+ ans' },
          { value: 'Expert reconnu', label: 'Expert' },
          { value: 'Maître artisan', label: 'Maître artisan' },
        ],
      },
      {
        id: 'certification',
        label: 'Certification/Diplôme',
        type: 'toggle',
      },
      {
        id: 'disponibilitePrestation',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Disponible immédiatement', label: 'Immédiate' },
          { value: 'Intervention sous 2h', label: 'Sous 2h' },
          { value: 'Intervention sous 24h', label: 'Sous 24h' },
          { value: 'Disponible cette semaine', label: 'Cette semaine' },
          { value: 'Disponible ce mois', label: 'Ce mois' },
          { value: 'Service 24h/24', label: '24h/24' },
          { value: 'Service 7j/7', label: '7j/7' },
        ],
      },
      {
        id: 'urgencesAcceptees',
        label: 'Urgences acceptées',
        type: 'toggle',
      },
      {
        id: 'service24h',
        label: 'Service 24h/24',
        type: 'toggle',
      },
      {
        id: 'modaliteDeplacement',
        label: 'Déplacement',
        type: 'select',
        options: [
          { value: 'Je me déplace chez le client', label: 'Se déplace chez le client' },
          { value: 'Client vient chez moi (atelier)', label: 'Client vient en atelier' },
          { value: 'Les deux possibles', label: 'Les deux possibles' },
          { value: 'À distance (en ligne)', label: 'À distance/en ligne' },
        ],
      },
      {
        id: 'modeTarification',
        label: 'Mode de tarification',
        type: 'select',
        options: [
          { value: 'Prix fixe', label: 'Prix fixe' },
          { value: 'Prix à l\'heure', label: 'À l\'heure' },
          { value: 'Prix à la journée', label: 'À la journée' },
          { value: 'Prix forfaitaire', label: 'Forfaitaire' },
          { value: 'Devis sur mesure', label: 'Sur devis' },
          { value: 'Prix négociable', label: 'Négociable' },
        ],
      },
      {
        id: 'devisGratuit',
        label: 'Devis gratuit',
        type: 'toggle',
      },
      {
        id: 'garantiePrestation',
        label: 'Garantie proposée',
        type: 'toggle',
      },
      {
        id: 'assuranceProfessionnelle',
        label: 'Assuré professionnellement',
        type: 'toggle',
      },
      // ✅ FILTRES SPÉCIFIQUES ÉDUCATION
      {
        id: 'matieresEnseignees',
        label: 'Matières enseignées',
        type: 'select',
        options: [
          { value: 'Mathématiques', label: 'Mathématiques' },
          { value: 'Français', label: 'Français' },
          { value: 'Anglais', label: 'Anglais' },
          { value: 'Physique-Chimie', label: 'Physique-Chimie' },
          { value: 'SVT (Sciences)', label: 'Sciences (SVT)' },
          { value: 'Histoire-Géographie', label: 'Histoire-Géo' },
          { value: 'Philosophie', label: 'Philosophie' },
          { value: 'Espagnol', label: 'Espagnol' },
          { value: 'Allemand', label: 'Allemand' },
          { value: 'Informatique', label: 'Informatique' },
          { value: 'Économie', label: 'Économie' },
          { value: 'Comptabilité', label: 'Comptabilité' },
        ],
      },
      {
        id: 'niveauxScolaires',
        label: 'Niveaux enseignés',
        type: 'select',
        options: [
          { value: 'Maternelle', label: 'Maternelle' },
          { value: 'Primaire', label: 'Primaire' },
          { value: 'CP', label: 'CP' },
          { value: 'CE1', label: 'CE1' },
          { value: 'CE2', label: 'CE2' },
          { value: 'CM1', label: 'CM1' },
          { value: 'CM2', label: 'CM2' },
          { value: '6ème', label: '6ème' },
          { value: '5ème', label: '5ème' },
          { value: '4ème', label: '4ème' },
          { value: '3ème', label: '3ème / BEPC' },
          { value: 'Seconde', label: 'Seconde' },
          { value: 'Première', label: 'Première' },
          { value: 'Terminale', label: 'Terminale / Bac' },
          { value: 'Supérieur', label: 'Enseignement supérieur' },
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
    displayPriority: ['categoriePrestation', 'matieresEnseignees', 'niveauxScolaires', 'niveauExperience', 'certification', 'disponibilitePrestation', 'zoneIntervention'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },


  // ✅ CATÉGORIE OBSOLÈTE SUPPRIMÉE
  // 🍎 "aliments" a été fusionnée avec "agroalimentaire" (version enrichie avec 120+ marques et 400+ produits)
  // ➡️ Utiliser la catégorie "agroalimentaire" à la place

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
        label: 'Type de vêtement',
        type: 'select',
        options: [
          // Hauts
          { value: 'T-shirt', label: 'T-shirt' },
          { value: 'Polo', label: 'Polo' },
          { value: 'Chemise', label: 'Chemise' },
          { value: 'Chemise africaine', label: 'Chemise africaine' },
          { value: 'Chemisette', label: 'Chemisette' },
          { value: 'Débardeur', label: 'Débardeur' },
          { value: 'Tunique', label: 'Tunique' },
          { value: 'Pull', label: 'Pull' },
          { value: 'Sweat', label: 'Sweat' },
          { value: 'Hoodie', label: 'Hoodie' },
          { value: 'Cardigan', label: 'Cardigan' },
          { value: 'Gilet', label: 'Gilet' },
          { value: 'Top', label: 'Top' },
          { value: 'Bustier', label: 'Bustier' },
          { value: 'Crop top', label: 'Crop top' },
          // Bas
          { value: 'Pantalon', label: 'Pantalon' },
          { value: 'Jean', label: 'Jean' },
          { value: 'Pantalon africain', label: 'Pantalon africain' },
          { value: 'Pantalon tailleur', label: 'Pantalon tailleur' },
          { value: 'Chino', label: 'Chino' },
          { value: 'Cargo', label: 'Cargo' },
          { value: 'Short', label: 'Short' },
          { value: 'Bermuda', label: 'Bermuda' },
          { value: 'Jogging', label: 'Jogging' },
          { value: 'Legging', label: 'Legging' },
          { value: 'Jupe', label: 'Jupe' },
          { value: 'Jupe africaine', label: 'Jupe africaine' },
          { value: 'Jupe longue', label: 'Jupe longue' },
          { value: 'Jupe courte', label: 'Jupe courte' },
          { value: 'Jupe plissée', label: 'Jupe plissée' },
          // Robes & Ensembles
          { value: 'Robe', label: 'Robe' },
          { value: 'Robe africaine', label: 'Robe africaine' },
          { value: 'Robe pagne', label: 'Robe pagne' },
          { value: 'Robe wax', label: 'Robe wax' },
          { value: 'Robe de soirée', label: 'Robe de soirée' },
          { value: 'Robe cocktail', label: 'Robe cocktail' },
          { value: 'Robe longue', label: 'Robe longue' },
          { value: 'Robe courte', label: 'Robe courte' },
          { value: 'Combinaison', label: 'Combinaison' },
          { value: 'Salopette', label: 'Salopette' },
          // Vestes & Manteaux
          { value: 'Veste', label: 'Veste' },
          { value: 'Blazer', label: 'Blazer' },
          { value: 'Veste africaine', label: 'Veste africaine' },
          { value: 'Blouson', label: 'Blouson' },
          { value: 'Manteau', label: 'Manteau' },
          { value: 'Parka', label: 'Parka' },
          { value: 'Trench', label: 'Trench' },
          { value: 'Coupe-vent', label: 'Coupe-vent' },
          { value: 'Imperméable', label: 'Imperméable' },
          { value: 'Doudoune', label: 'Doudoune' },
          // Tenues complètes
          { value: 'Costume', label: 'Costume' },
          { value: 'Costume africain', label: 'Costume africain' },
          { value: 'Tailleur', label: 'Tailleur' },
          { value: 'Tailleur africain', label: 'Tailleur africain' },
          { value: 'Boubou', label: 'Boubou' },
          { value: 'Kaftan', label: 'Kaftan' },
          { value: 'Dashiki', label: 'Dashiki' },
          { value: 'Agbada', label: 'Agbada' },
          { value: 'Kaba', label: 'Kaba' },
          { value: 'Bazin', label: 'Bazin' },
          { value: 'Ensemble wax', label: 'Ensemble wax' },
        ],
      },
      {
        id: 'genreVetement',
        label: 'Genre',
        type: 'select',
        options: [
          { value: 'Homme', label: 'Homme' },
          { value: 'Femme', label: 'Femme' },
          { value: 'Enfant', label: 'Enfant' },
          { value: 'Bébé', label: 'Bébé' },
          { value: 'Unisexe', label: 'Unisexe' },
          { value: 'Mixte', label: 'Mixte' },
        ],
      },
      {
        id: 'taille',
        label: 'Taille',
        type: 'multiselect',
        options: [
          // Tailles lettres
          { value: 'XXS', label: 'XXS' },
          { value: 'XS', label: 'XS' },
          { value: 'S', label: 'S' },
          { value: 'M', label: 'M' },
          { value: 'L', label: 'L' },
          { value: 'XL', label: 'XL' },
          { value: 'XXL', label: 'XXL' },
          { value: 'XXXL', label: 'XXXL' },
          { value: '4XL', label: '4XL' },
          { value: '5XL', label: '5XL' },
          // Tailles numériques françaises
          { value: '32', label: '32' },
          { value: '34', label: '34' },
          { value: '36', label: '36' },
          { value: '38', label: '38' },
          { value: '40', label: '40' },
          { value: '42', label: '42' },
          { value: '44', label: '44' },
          { value: '46', label: '46' },
          { value: '48', label: '48' },
          { value: '50', label: '50' },
          { value: '52', label: '52' },
          { value: '54', label: '54' },
          { value: '56', label: '56' },
          { value: '58', label: '58' },
          { value: '60', label: '60' },
          { value: '62', label: '62' },
          // Tailles pantalons
          { value: '26', label: '26' },
          { value: '28', label: '28' },
          { value: '30', label: '30' },
          { value: '32', label: '32' },
          { value: '34', label: '34' },
          { value: '36', label: '36' },
          { value: '38', label: '38' },
          { value: '40', label: '40' },
          { value: '42', label: '42' },
          { value: '44', label: '44' },
          // Enfants
          { value: '2 ans', label: '2 ans' },
          { value: '4 ans', label: '4 ans' },
          { value: '6 ans', label: '6 ans' },
          { value: '8 ans', label: '8 ans' },
          { value: '10 ans', label: '10 ans' },
          { value: '12 ans', label: '12 ans' },
          { value: '14 ans', label: '14 ans' },
          { value: '16 ans', label: '16 ans' },
        ],
      },
      {
        id: 'couleurVetement',
        label: 'Couleur',
        type: 'multiselect',
        options: [
          { value: 'Blanc', label: 'Blanc' },
          { value: 'Noir', label: 'Noir' },
          { value: 'Gris', label: 'Gris' },
          { value: 'Beige', label: 'Beige' },
          { value: 'Rouge', label: 'Rouge' },
          { value: 'Bleu', label: 'Bleu' },
          { value: 'Bleu marine', label: 'Bleu marine' },
          { value: 'Vert', label: 'Vert' },
          { value: 'Jaune', label: 'Jaune' },
          { value: 'Rose', label: 'Rose' },
          { value: 'Violet', label: 'Violet' },
          { value: 'Marron', label: 'Marron' },
          { value: 'Multicolore', label: 'Multicolore' },
        ],
      },
      {
        id: 'matiereVetement',
        label: 'Matière',
        type: 'multiselect',
        options: [
          { value: 'Coton', label: 'Coton' },
          { value: '100% Coton', label: '100% Coton' },
          { value: 'Polyester', label: 'Polyester' },
          { value: 'Lin', label: 'Lin' },
          { value: 'Soie', label: 'Soie' },
          { value: 'Laine', label: 'Laine' },
          { value: 'Denim', label: 'Denim' },
          { value: 'Cuir', label: 'Cuir' },
          { value: 'Coton bio', label: 'Coton bio' },
        ],
      },
      {
        id: 'marqueVetement',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Nike', label: 'Nike' },
          { value: 'Adidas', label: 'Adidas' },
          { value: 'Puma', label: 'Puma' },
          { value: 'Zara', label: 'Zara' },
          { value: 'H&M', label: 'H&M' },
          { value: 'Uniqlo', label: 'Uniqlo' },
          { value: 'Lacoste', label: 'Lacoste' },
          { value: 'Ralph Lauren', label: 'Ralph Lauren' },
          { value: 'Levi\'s', label: 'Levi\'s' },
        ],
      },
      {
        id: 'etatVetement',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf avec étiquette', label: 'Neuf avec étiquette' },
          { value: 'Neuf sans étiquette', label: 'Neuf sans étiquette' },
          { value: 'Occasion - Excellent état', label: 'Occasion - Excellent état' },
          { value: 'Occasion - Bon état', label: 'Occasion - Bon état' },
          { value: 'Occasion - État moyen', label: 'Occasion - État moyen' },
          { value: 'Vintage', label: 'Vintage' },
        ],
      },
      {
        id: 'styleVetement',
        label: 'Style',
        type: 'multiselect',
        options: [
          { value: 'Casual', label: 'Casual' },
          { value: 'Formel', label: 'Formel' },
          { value: 'Sport', label: 'Sport' },
          { value: 'Streetwear', label: 'Streetwear' },
          { value: 'Chic', label: 'Chic' },
          { value: 'Élégant', label: 'Élégant' },
          { value: 'Vintage', label: 'Vintage' },
          { value: 'Classique', label: 'Classique' },
        ],
      },
      {
        id: 'saisonVetement',
        label: 'Saison',
        type: 'multiselect',
        options: [
          { value: 'Été', label: 'Été' },
          { value: 'Hiver', label: 'Hiver' },
          { value: 'Mi-saison', label: 'Mi-saison' },
          { value: 'Toutes saisons', label: 'Toutes saisons' },
        ],
      },
      {
        id: 'patronVetement',
        label: 'Motif',
        type: 'multiselect',
        options: [
          { value: 'Uni', label: 'Uni' },
          { value: 'Rayé', label: 'Rayé' },
          { value: 'À pois', label: 'À pois' },
          { value: 'À carreaux', label: 'À carreaux' },
          { value: 'Imprimé floral', label: 'Imprimé floral' },
          { value: 'Imprimé géométrique', label: 'Imprimé géométrique' },
          { value: 'Logo', label: 'Logo' },
        ],
      },
      {
        id: 'coupeVetement',
        label: 'Coupe',
        type: 'select',
        options: [
          { value: 'Slim', label: 'Slim' },
          { value: 'Regular', label: 'Regular' },
          { value: 'Loose', label: 'Loose' },
          { value: 'Oversize', label: 'Oversize' },
          { value: 'Skinny', label: 'Skinny' },
          { value: 'Droit', label: 'Droit' },
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
    supportsVariants: true,
    searchKeywords: [
      // Termes généraux
      'vetement', 'vêtement', 'habit', 'fringue', 'sape', 'look',
      // Friperie & Seconde main (Cameroun & Afrique francophone)
      'friperie', 'fripe', 'dead stock', 'dead-stock', 'deadstock',
      'seconde main', 'deuxième main', 'occasion', 'used', 'okrika',
      'bend skin', 'bendskin', 'kaki benda', 'kakibenda',
      'mitumba', 'boutique mitumba', 'marché mitumba',
      // Marchés populaires
      'marché mokolo', 'mokolo', 'sandaga', 'marché sandaga',
      'adjamé', 'marché adjamé', 'treichville', 'cocody',
      'lagos market', 'cotonou market',
      // Termes mode africaine
      'wax', 'pagne', 'bazin', 'bogolan', 'kente', 'ankara',
      'boubou', 'kaftan', 'dashiki', 'agbada', 'kaba',
      'tenue africaine', 'mode africaine', 'african fashion',
      'afro-fusion', 'afro wear', 'african wear',
      // Termes locaux Cameroun
      'ndole fashion', 'makossa style', 'bikutsi look',
      'bamiléké outfit', 'bassa dress',
      // Termes locaux Côte d'Ivoire
      'wêwê', 'gbagba', 'brouteur style', 'zouglou fashion',
      // Termes locaux Sénégal
      'thiès fashion', 'dakar style', 'teranga wear',
      // Termes locaux autres pays
      'congolaise', 'sapeur', 'sape', 'la sape',
      'kinshasa fashion', 'brazzaville style',
      // Occasions spéciales
      'tenue de mariage', 'tenue de cérémonie', 'tenue de baptême',
      'tenue de soirée', 'tenue de gala', 'tenue de fête',
      // Types populaires
      'jeans', 'jean', 'chemise', 't-shirt', 'tshirt',
      'polo', 'robe', 'jupe', 'pantalon',
      // Marques locales
      'vlisco', 'uniwax', 'abc wax', 'gtp', 'woodin',
      'amsik', 'alios', 'modahnik',
    ],
  },

  // 🔌 ÉLECTROMÉNAGER
  electromenager: {
    terminology: {
      productLabel: 'Appareil électroménager',
      productsLabel: 'Électroménager Domestique',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher un appareil électroménager...',
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
          { value: 'Gros électroménager - Froid', label: 'Gros électroménager - Froid' },
          { value: 'Gros électroménager - Cuisson', label: 'Gros électroménager - Cuisson' },
          { value: 'Gros électroménager - Lavage', label: 'Gros électroménager - Lavage' },
          { value: 'Gros électroménager - Climatisation', label: 'Gros électroménager - Climatisation' },
          { value: 'Petit électroménager - Cuisine', label: 'Petit électroménager - Cuisine' },
          { value: 'Petit électroménager - Entretien', label: 'Petit électroménager - Entretien' },
          { value: 'Petit électroménager - Soins', label: 'Petit électroménager - Soins' },
        ],
      },
      {
        id: 'typeElectro',
        label: 'Type d\'appareil',
        type: 'select',
        options: [
          { value: 'Réfrigérateur', label: 'Réfrigérateur' },
          { value: 'Congélateur', label: 'Congélateur' },
          { value: 'Cuisinière', label: 'Cuisinière' },
          { value: 'Four', label: 'Four' },
          { value: 'Micro-ondes', label: 'Micro-ondes' },
          { value: 'Lave-linge', label: 'Lave-linge' },
          { value: 'Sèche-linge', label: 'Sèche-linge' },
          { value: 'Lave-vaisselle', label: 'Lave-vaisselle' },
          { value: 'Climatiseur', label: 'Climatiseur' },
          { value: 'Aspirateur', label: 'Aspirateur' },
          { value: 'Cafetière', label: 'Cafetière' },
          { value: 'Friteuse', label: 'Friteuse' },
        ],
      },
      {
        id: 'marqueElectro',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Samsung', label: 'Samsung' },
          { value: 'LG', label: 'LG' },
          { value: 'Bosch', label: 'Bosch' },
          { value: 'Whirlpool', label: 'Whirlpool' },
          { value: 'Siemens', label: 'Siemens' },
          { value: 'Electrolux', label: 'Electrolux' },
          { value: 'Haier', label: 'Haier' },
          { value: 'Beko', label: 'Beko' },
          { value: 'Miele', label: 'Miele' },
          { value: 'Tefal', label: 'Tefal' },
          { value: 'Moulinex', label: 'Moulinex' },
          { value: 'Philips', label: 'Philips' },
        ],
      },
      {
        id: 'etatElectro',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf en boîte', label: 'Neuf en boîte' },
          { value: 'Neuf sans emballage', label: 'Neuf sans emballage' },
          { value: 'Excellent état', label: 'Excellent état' },
          { value: 'Bon état', label: 'Bon état' },
          { value: 'Reconditionné', label: 'Reconditionné' },
        ],
      },
      {
        id: 'consommationEnergetique',
        label: 'Classe énergétique',
        type: 'select',
        options: [
          { value: 'A+++', label: 'A+++' },
          { value: 'A++', label: 'A++' },
          { value: 'A+', label: 'A+' },
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
          { value: 'C', label: 'C' },
          { value: 'D', label: 'D' },
        ],
      },
      {
        id: 'capaciteElectro',
        label: 'Capacité',
        type: 'select',
        options: [
          { value: '100L', label: '100L' },
          { value: '150L', label: '150L' },
          { value: '200L', label: '200L' },
          { value: '250L', label: '250L' },
          { value: '300L', label: '300L' },
          { value: '350L', label: '350L' },
          { value: '400L', label: '400L' },
          { value: '5kg', label: '5kg' },
          { value: '6kg', label: '6kg' },
          { value: '7kg', label: '7kg' },
          { value: '8kg', label: '8kg' },
          { value: '10kg', label: '10kg' },
        ],
      },
      {
        id: 'couleurElectro',
        label: 'Couleur',
        type: 'select',
        options: [
          { value: 'Blanc', label: 'Blanc' },
          { value: 'Inox', label: 'Inox' },
          { value: 'Noir', label: 'Noir' },
          { value: 'Gris', label: 'Gris' },
          { value: 'Argent', label: 'Argent' },
          { value: 'Rouge', label: 'Rouge' },
          { value: 'Bleu', label: 'Bleu' },
        ],
      },
      {
        id: 'garantieElectro',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
          { value: '3 ans', label: '3 ans' },
          { value: '5 ans', label: '5 ans' },
        ],
      },
      {
        id: 'fonctionnalitesElectro',
        label: 'Fonctionnalités',
        type: 'multiselect',
        options: [
          { value: 'No Frost', label: 'No Frost' },
          { value: 'Smart/WiFi', label: 'Smart/WiFi' },
          { value: 'Programmable', label: 'Programmable' },
          { value: 'Silencieux', label: 'Silencieux' },
          { value: 'Inverter', label: 'Inverter' },
          { value: 'Eco', label: 'Eco' },
          { value: 'Quick wash', label: 'Quick wash' },
          { value: 'Chaleur tournante', label: 'Chaleur tournante' },
          { value: 'Départ différé', label: 'Départ différé' },
          { value: 'Réversible (chaud/froid)', label: 'Réversible (chaud/froid)' },
        ],
      },
      {
        id: 'garantieConstructeur',
        label: 'Garantie constructeur',
        type: 'toggle',
      },
      {
        id: 'facture',
        label: 'Avec facture',
        type: 'toggle',
      },
      {
        id: 'manuel',
        label: 'Avec manuel',
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
    displayPriority: ['name', 'categorieElectro', 'marqueElectro', 'typeElectro', 'consommationEnergetique', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
    supportsVariants: false,
  },

  // 📺 IMAGE & SON
  // 📺 IMAGE & SON - ✅ REFONTE COMPLÈTE (14 filtres)
  image_son: {
    terminology: {
      productLabel: 'Équipement image/son',
      productsLabel: 'Image & Son',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher TV, enceintes, projecteurs...',
      emptyMessage: 'Aucun équipement image/son disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // Filtre 1 : Catégorie principale
      {
        id: 'categorieImageSon',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'Télévision', label: 'Télévision' },
          { value: 'Home Cinéma', label: 'Home Cinéma' },
          { value: 'Barre de son', label: 'Barre de son' },
          { value: 'Enceintes', label: 'Enceintes' },
          { value: 'Projecteur', label: 'Projecteur' },
          { value: 'Amplificateur', label: 'Amplificateur' },
          { value: 'Accessoires audio', label: 'Accessoires audio' },
          { value: 'Casque audio', label: 'Casque audio' },
        ],
      },
      // Filtre 2 : Type spécifique
      {
        id: 'typeImageSon',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'TV LED', label: 'TV LED' },
          { value: 'TV OLED', label: 'TV OLED' },
          { value: 'TV QLED', label: 'TV QLED' },
          { value: 'TV NanoCell', label: 'TV NanoCell' },
          { value: 'Smart TV', label: 'Smart TV' },
          { value: 'Enceinte Bluetooth', label: 'Enceinte Bluetooth' },
          { value: 'Enceinte WiFi', label: 'Enceinte WiFi' },
          { value: 'Projecteur Home Cinéma', label: 'Projecteur Home Cinéma' },
        ],
      },
      // Filtre 3 : Marque
      {
        id: 'marqueImageSon',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Samsung', label: 'Samsung' },
          { value: 'LG', label: 'LG' },
          { value: 'Sony', label: 'Sony' },
          { value: 'Philips', label: 'Philips' },
          { value: 'TCL', label: 'TCL' },
          { value: 'Hisense', label: 'Hisense' },
          { value: 'JBL', label: 'JBL' },
          { value: 'Bose', label: 'Bose' },
          { value: 'Harman Kardon', label: 'Harman Kardon' },
          { value: 'Yamaha', label: 'Yamaha' },
          { value: 'Epson', label: 'Epson' },
          { value: 'BenQ', label: 'BenQ' },
        ],
      },
      // Filtre 4 : Technologie d'écran
      {
        id: 'technologieEcran',
        label: 'Technologie écran',
        type: 'select',
        options: [
          { value: 'LED', label: 'LED' },
          { value: 'OLED', label: 'OLED' },
          { value: 'QLED', label: 'QLED' },
          { value: 'NanoCell', label: 'NanoCell' },
          { value: 'Mini-LED', label: 'Mini-LED' },
          { value: 'Neo QLED', label: 'Neo QLED' },
        ],
      },
      // Filtre 5 : Résolution
      {
        id: 'resolution',
        label: 'Résolution',
        type: 'select',
        options: [
          { value: 'HD (720p)', label: 'HD (720p)' },
          { value: 'Full HD (1080p)', label: 'Full HD (1080p)' },
          { value: '4K UHD (3840x2160)', label: '4K UHD' },
          { value: '8K UHD (7680x4320)', label: '8K UHD' },
        ],
      },
      // Filtre 6 : Taille écran (range)
      {
        id: 'diagonaleEcran',
        label: 'Taille écran (pouces)',
        type: 'range',
        min: 24,
        max: 98,
        unit: '"',
      },
      // Filtre 7 : Gamme/Modèle
      {
        id: 'modeleImageSon',
        label: 'Gamme',
        type: 'select',
        options: [
          { value: 'Entrée de gamme', label: 'Entrée de gamme' },
          { value: 'Milieu de gamme', label: 'Milieu de gamme' },
          { value: 'Haut de gamme', label: 'Haut de gamme' },
          { value: 'Premium', label: 'Premium' },
        ],
      },
      // Filtre 8 : État
      {
        id: 'etatImageSon',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf scellé', label: 'Neuf scellé' },
          { value: 'Neuf avec garantie', label: 'Neuf avec garantie' },
          { value: 'Neuf déballé', label: 'Neuf déballé' },
          { value: 'Excellent état', label: 'Excellent état' },
          { value: 'Bon état', label: 'Bon état' },
          { value: 'Occasion fonctionnel', label: 'Occasion fonctionnel' },
        ],
      },
      // Filtre 9 : Garantie
      {
        id: 'garantieImageSon',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'Garantie constructeur 1 an', label: 'Garantie constructeur 1 an' },
          { value: 'Garantie constructeur 2 ans', label: 'Garantie constructeur 2 ans' },
          { value: 'Garantie constructeur 3 ans', label: 'Garantie constructeur 3 ans' },
          { value: 'Garantie magasin 6 mois', label: 'Garantie magasin 6 mois' },
          { value: 'Garantie magasin 1 an', label: 'Garantie magasin 1 an' },
          { value: 'Pas de garantie', label: 'Sans garantie' },
        ],
      },
      // Filtre 10 : Connectivités (multiselect)
      {
        id: 'connectivitesImageSon',
        label: 'Connectivités',
        type: 'multiselect',
        options: [
          { value: 'HDMI', label: 'HDMI' },
          { value: 'HDMI 2.1', label: 'HDMI 2.1' },
          { value: 'USB', label: 'USB' },
          { value: 'WiFi', label: 'WiFi' },
          { value: 'Bluetooth', label: 'Bluetooth' },
          { value: 'Ethernet (RJ45)', label: 'Ethernet' },
        ],
      },
      // Filtre 11 : Fonctionnalités (multiselect)
      {
        id: 'fonctionnalitesImageSon',
        label: 'Fonctionnalités',
        type: 'multiselect',
        options: [
          { value: 'Smart TV', label: 'Smart TV' },
          { value: 'Android TV', label: 'Android TV' },
          { value: 'HDR', label: 'HDR' },
          { value: 'Dolby Atmos', label: 'Dolby Atmos' },
          { value: 'WiFi intégré', label: 'WiFi intégré' },
          { value: 'Bluetooth intégré', label: 'Bluetooth intégré' },
          { value: '120Hz', label: '120Hz' },
          { value: 'Game Mode', label: 'Game Mode' },
        ],
      },
      // Filtre 12 : Puissance audio (range)
      {
        id: 'puissanceAudio',
        label: 'Puissance audio (W)',
        type: 'range',
        min: 10,
        max: 1000,
        unit: 'W',
      },
      // Filtre 13 : Année de sortie (range)
      {
        id: 'anneeSortie',
        label: 'Année de sortie',
        type: 'range',
        min: 2018,
        max: 2025,
        unit: '',
      },
      // Filtre 14 : Accessoires inclus (multiselect)
      {
        id: 'accessoiresImageSon',
        label: 'Accessoires inclus',
        type: 'multiselect',
        options: [
          { value: 'Télécommande', label: 'Télécommande' },
          { value: 'Câble HDMI', label: 'Câble HDMI' },
          { value: 'Support mural', label: 'Support mural' },
          { value: 'Manuel d\'utilisation', label: 'Manuel d\'utilisation' },
        ],
      },
    ],
    style: {
      primaryColor: '#9C27B0',
      gradientColors: ['#9C27B0', '#7B1FA2'],
      icon: '📺',
      badgeColor: '#F3E5F5',
      accentColor: '#7B1FA2',
    },
    displayPriority: ['nomProduitImageSon', 'categorieImageSon', 'marqueImageSon', 'typeImageSon', 'diagonaleEcran', 'resolution', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
    supportsVariants: false, // ✅ IMPORTANT: Pas de variantes pour Image & Son
    searchKeywords: [
      // Termes généraux
      'tv', 'télé', 'télévision', 'television', 'téléviseur', 'televiseur',
      'hifi', 'hi-fi', 'son', 'audio', 'vidéo', 'video', 'multimédia', 'multimedia',
      // Télévisions
      'smart tv', 'led tv', 'oled tv', 'qled tv', 'tv 4k', 'tv 8k',
      'samsung', 'lg', 'sony', 'philips', 'tcl', 'hisense',
      // Audio
      'enceinte', 'haut-parleur', 'haut parleur', 'speaker', 'soundbar',
      'barre de son', 'home cinema', 'home cinéma', 'home theater',
      'jbl', 'bose', 'harman kardon', 'yamaha', 'denon',
      'enceinte bluetooth', 'enceinte wifi', 'caisson de basses', 'subwoofer',
      // Projecteurs
      'projecteur', 'vidéoprojecteur', 'videoprojecteur', 'epson', 'benq',
      // Accessoires
      'amplificateur', 'ampli', 'amplificateur audio', 'récepteur', 'recepteur',
      'casque audio', 'casque bluetooth', 'cable hdmi',
      // Termes locaux Afrique
      'baffle', 'boom', 'boombox', 'dj box', 'lecteur dvd', 'lecteur blu-ray'
    ],
  },

  // 💻 ORDINATEUR - 🌍 ENRICHI CONTEXTE AFRIQUE (18 filtres)
  ordinateur: {
    terminology: {
      productLabel: 'Ordinateur',
      productsLabel: 'Ordinateurs & Informatique',
      priceLabel: 'Prix',
      locationLabel: 'Magasin/Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher PC, laptop, MacBook (marque, usage)...',
      emptyMessage: 'Aucun ordinateur disponible dans cette zone',
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
          { value: 'PC Portable', label: '💼 PC Portable' },
          { value: 'PC de bureau', label: '🖥️ PC de bureau' },
          { value: 'Laptop Gaming', label: '🎮 Laptop Gaming' },
          { value: 'Ultrabook', label: '✈️ Ultrabook' },
          { value: 'MacBook Air', label: '🍎 MacBook Air' },
          { value: 'MacBook Pro', label: '🍎 MacBook Pro' },
          { value: 'iMac', label: '🍎 iMac' },
          { value: 'iPad', label: '📱 iPad' },
          { value: 'Tablette Android', label: '📱 Tablette' },
          { value: 'Surface Pro', label: '📱 Surface Pro' },
          { value: 'Workstation', label: '🏢 Workstation' },
          { value: 'Chromebook', label: '🎓 Chromebook' },
          { value: 'All-in-One', label: '🖥️ All-in-One' },
        ],
      },
      {
        id: 'marqueOrdinateur',
        label: 'Marque',
        type: 'select',
        options: [
          // 🔥 TOP 3 Afrique
          { value: 'HP', label: 'HP' },
          { value: 'Dell', label: 'Dell' },
          { value: 'Lenovo', label: 'Lenovo' },
          // Populaires
          { value: 'Asus', label: 'Asus' },
          { value: 'Acer', label: 'Acer' },
          { value: 'Toshiba', label: 'Toshiba' },
          // Premium
          { value: 'Apple', label: 'Apple' },
          { value: 'Microsoft', label: 'Microsoft' },
          // Gaming
          { value: 'MSI', label: 'MSI' },
          { value: 'Razer', label: 'Razer' },
          { value: 'Alienware', label: 'Alienware' },
          // Autres
          { value: 'Samsung', label: 'Samsung' },
          { value: 'Huawei', label: 'Huawei' },
          { value: 'PC Assemblé local', label: '🇨🇲 PC Assemblé local' },
        ],
      },
      {
        id: 'etatOrdinateur',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf scellé sous garantie internationale', label: '🆕 Neuf garantie internationale' },
          { value: 'Neuf sous garantie locale', label: '🆕 Neuf garantie locale' },
          { value: 'Neuf sans garantie', label: '🆕 Neuf sans garantie' },
          { value: 'Reconditionné grade A+ (comme neuf)', label: '♻️ Reconditionné A+' },
          { value: 'Reconditionné grade A', label: '♻️ Reconditionné A' },
          { value: 'Reconditionné grade B', label: '♻️ Reconditionné B' },
          { value: 'Occasion - Excellent état', label: '💼 Occasion - Excellent' },
          { value: 'Occasion - Très bon état', label: '💼 Occasion - Très bon' },
          { value: 'Occasion - Bon état', label: '💼 Occasion - Bon' },
          { value: 'Occasion - État correct', label: '💼 Occasion - Correct' },
        ],
      },
      {
        id: 'processeur',
        label: 'Processeur',
        type: 'multiselect',
        options: [
          // Budget
          { value: 'Intel Celeron', label: '💰 Intel Celeron' },
          { value: 'Intel Pentium', label: '💰 Intel Pentium' },
          { value: 'AMD Athlon', label: '💰 AMD Athlon' },
          // Milieu de gamme
          { value: 'Intel Core i3', label: 'Intel Core i3' },
          { value: 'Intel Core i5', label: '🔥 Intel Core i5' },
          { value: 'AMD Ryzen 3', label: 'AMD Ryzen 3' },
          { value: 'AMD Ryzen 5', label: '🔥 AMD Ryzen 5' },
          // Haut de gamme
          { value: 'Intel Core i7', label: '💎 Intel Core i7' },
          { value: 'AMD Ryzen 7', label: '💎 AMD Ryzen 7' },
          { value: 'Intel Core i9', label: '💎 Intel Core i9' },
          { value: 'AMD Ryzen 9', label: '💎 AMD Ryzen 9' },
          // Apple Silicon
          { value: 'Apple M1', label: '🍎 Apple M1' },
          { value: 'Apple M2', label: '🍎 Apple M2' },
          { value: 'Apple M3', label: '🍎 Apple M3' },
          // Nouveau
          { value: 'Intel Core Ultra 5', label: 'Intel Core Ultra 5' },
          { value: 'Intel Core Ultra 7', label: 'Intel Core Ultra 7' },
        ],
      },
      {
        id: 'ramOrdinateur',
        label: 'Mémoire RAM',
        type: 'multiselect',
        options: [
          { value: '2GB', label: '2 GB' },
          { value: '4GB', label: '4 GB' },
          { value: '8GB', label: '🔥 8 GB' },
          { value: '16GB', label: '💎 16 GB' },
          { value: '32GB', label: '32 GB' },
          { value: '64GB', label: '64 GB' },
        ],
      },
      {
        id: 'stockageOrdinateur',
        label: 'Stockage',
        type: 'multiselect',
        options: [
          // HDD
          { value: '500GB HDD', label: '💾 500 GB HDD' },
          { value: '1TB HDD', label: '💾 1 TB HDD' },
          { value: '2TB HDD', label: '💾 2 TB HDD' },
          // SSD
          { value: '128GB SSD', label: '⚡ 128 GB SSD' },
          { value: '256GB SSD', label: '⚡ 256 GB SSD' },
          { value: '512GB SSD', label: '⚡ 512 GB SSD' },
          { value: '1TB SSD', label: '⚡ 1 TB SSD' },
          { value: '2TB SSD', label: '⚡ 2 TB SSD' },
          // Dual Storage
          { value: '256GB SSD + 1TB HDD', label: '🎯 256 SSD + 1TB HDD' },
          { value: '512GB SSD + 1TB HDD', label: '🎯 512 SSD + 1TB HDD' },
        ],
      },
      {
        id: 'carteGraphique',
        label: 'Carte graphique',
        type: 'select',
        options: [
          { value: 'Intégrée Intel HD', label: 'Intel HD Intégrée' },
          { value: 'Intel UHD Graphics', label: 'Intel UHD' },
          { value: 'Intel Iris Xe', label: 'Intel Iris Xe' },
          { value: 'AMD Radeon Vega', label: 'AMD Radeon Vega' },
          { value: 'Apple GPU intégrée', label: 'Apple GPU' },
          { value: 'NVIDIA GeForce MX150', label: 'NVIDIA MX150' },
          { value: 'NVIDIA GeForce MX250', label: 'NVIDIA MX250' },
          { value: 'NVIDIA GeForce GTX 1650', label: '🎮 NVIDIA GTX 1650' },
          { value: 'NVIDIA GeForce RTX 3050', label: '🎮 NVIDIA RTX 3050' },
          { value: 'NVIDIA GeForce RTX 3060', label: '🎮 NVIDIA RTX 3060' },
          { value: 'NVIDIA GeForce RTX 4060', label: '🎮 NVIDIA RTX 4060' },
          { value: 'AMD Radeon RX 6600M', label: 'AMD RX 6600M' },
        ],
      },
      {
        id: 'usage',
        label: 'Usage',
        type: 'multiselect',
        options: [
          { value: 'Bureautique', label: '📊 Bureautique' },
          { value: 'Étudiant', label: '🎓 Étudiant' },
          { value: 'Télétravail', label: '🏠 Télétravail' },
          { value: 'Comptabilité/Gestion', label: '💼 Comptabilité/Gestion' },
          { value: 'Gaming', label: '🎮 Gaming' },
          { value: 'Développement web', label: '💻 Développement web' },
          { value: 'Développement logiciel', label: '💻 Développement' },
          { value: 'Design graphique', label: '🎨 Design graphique' },
          { value: 'Montage vidéo', label: '🎬 Montage vidéo' },
          { value: 'Architecture/CAO', label: '🏗️ Architecture/CAO' },
          { value: 'Cyber-café', label: '🇨🇲 Cyber-café' },
          { value: 'Polyvalent', label: '🎯 Polyvalent' },
        ],
      },
      {
        id: 'systemeExploitation',
        label: 'Système d\'exploitation',
        type: 'select',
        options: [
          { value: 'Windows 11 Pro', label: '🪟 Windows 11 Pro' },
          { value: 'Windows 11 Home', label: '🪟 Windows 11 Home' },
          { value: 'Windows 10 Pro', label: '🪟 Windows 10 Pro' },
          { value: 'Windows 10 Home', label: '🪟 Windows 10 Home' },
          { value: 'Windows 7', label: '🪟 Windows 7' },
          { value: 'macOS Sonoma', label: '🍎 macOS Sonoma' },
          { value: 'macOS Ventura', label: '🍎 macOS Ventura' },
          { value: 'macOS Monterey', label: '🍎 macOS Monterey' },
          { value: 'Linux Ubuntu', label: '🐧 Linux Ubuntu' },
          { value: 'ChromeOS', label: 'ChromeOS' },
          { value: 'FreeDOS', label: 'FreeDOS (sans OS)' },
        ],
      },
      {
        id: 'tailleEcranOrdinateur',
        label: 'Taille écran',
        type: 'select',
        options: [
          { value: '11.6"', label: '11.6"' },
          { value: '13.3"', label: '13.3"' },
          { value: '14"', label: '14"' },
          { value: '15.6"', label: '🔥 15.6"' },
          { value: '17.3"', label: '17.3"' },
          { value: '21.5"', label: '21.5"' },
          { value: '24"', label: '24"' },
          { value: '27"', label: '27"' },
        ],
      },
      {
        id: 'typeSSD',
        label: 'SSD rapide',
        type: 'toggle',
      },
      {
        id: 'touchscreen',
        label: 'Écran tactile',
        type: 'toggle',
      },
      {
        id: 'webcam',
        label: 'Webcam',
        type: 'toggle',
      },
      {
        id: 'portUSBC',
        label: 'Port USB-C',
        type: 'toggle',
      },
      {
        id: 'bluetooth',
        label: 'Bluetooth',
        type: 'toggle',
      },
      {
        id: 'boiteOriginaleOrdinateur',
        label: 'Boîte d\'origine',
        type: 'toggle',
      },
      {
        id: 'factureOrdinateur',
        label: 'Facture disponible',
        type: 'toggle',
      },
      {
        id: 'anneeAchatOrdinateur',
        label: 'Année d\'achat',
        type: 'range',
        min: 2010,
        max: 2025,
        unit: '',
      },
    ],
    style: {
      primaryColor: '#00BCD4',
      gradientColors: ['#00BCD4', '#0097A7'],
      icon: '💻',
      badgeColor: '#E0F7FA',
      accentColor: '#0097A7',
    },
    displayPriority: ['typeOrdinateur', 'marqueOrdinateur', 'modeleOrdinateur', 'processeur', 'ramOrdinateur', 'etatOrdinateur', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 🪑 MOBILIER - ✅ REFONTE COMPLÈTE
  mobilier: {
    terminology: {
      productLabel: 'Meuble',
      productsLabel: 'Meubles et ameublement',
      priceLabel: 'Prix',
      locationLabel: 'Magasin/Atelier',
      providerLabel: 'Vendeur/Menuisier',
      searchPlaceholder: 'Rechercher un meuble (canapé, lit, armoire...)...',
      emptyMessage: 'Aucun meuble disponible dans cette zone',
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
        label: 'Type de meuble',
        type: 'select',
        options: [
          { value: 'Canapé', label: 'Canapé' },
          { value: 'Fauteuil', label: 'Fauteuil' },
          { value: 'Chaise', label: 'Chaise' },
          { value: 'Tabouret', label: 'Tabouret' },
          { value: 'Table', label: 'Table' },
          { value: 'Table basse', label: 'Table basse' },
          { value: 'Table de chevet', label: 'Table de chevet' },
          { value: 'Bureau', label: 'Bureau' },
          { value: 'Lit', label: 'Lit' },
          { value: 'Matelas', label: 'Matelas' },
          { value: 'Sommier', label: 'Sommier' },
          { value: 'Armoire', label: 'Armoire' },
          { value: 'Penderie', label: 'Penderie' },
          { value: 'Commode', label: 'Commode' },
          { value: 'Étagère', label: 'Étagère' },
          { value: 'Bibliothèque', label: 'Bibliothèque' },
          { value: 'Meuble TV', label: 'Meuble TV' },
          { value: 'Buffet', label: 'Buffet' },
          { value: 'Vaisselier', label: 'Vaisselier' },
          { value: 'Placard', label: 'Placard' },
          { value: 'Meuble de rangement', label: 'Meuble de rangement' },
          { value: 'Coffre', label: 'Coffre' },
          { value: 'Coiffeuse', label: 'Coiffeuse' },
          { value: 'Console', label: 'Console' },
          { value: 'Banc', label: 'Banc' },
          { value: 'Pouf', label: 'Pouf' },
        ],
      },
      {
        id: 'categorieMobilier',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'Salon', label: 'Salon' },
          { value: 'Chambre à coucher', label: 'Chambre à coucher' },
          { value: 'Salle à manger', label: 'Salle à manger' },
          { value: 'Bureau/Travail', label: 'Bureau/Travail' },
          { value: 'Cuisine', label: 'Cuisine' },
          { value: 'Salle de bain', label: 'Salle de bain' },
          { value: 'Entrée/Couloir', label: 'Entrée/Couloir' },
          { value: 'Rangement', label: 'Rangement' },
          { value: 'Enfant/Bébé', label: 'Enfant/Bébé' },
          { value: 'Jardin/Extérieur', label: 'Jardin/Extérieur' },
          { value: 'Commercial/Professionnel', label: 'Commercial/Professionnel' },
        ],
      },
      {
        id: 'styleMobilier',
        label: 'Style',
        type: 'select',
        options: [
          { value: 'Moderne', label: 'Moderne' },
          { value: 'Contemporain', label: 'Contemporain' },
          { value: 'Minimaliste', label: 'Minimaliste' },
          { value: 'Classique', label: 'Classique' },
          { value: 'Néoclassique', label: 'Néoclassique' },
          { value: 'Traditionnel africain', label: 'Traditionnel africain' },
          { value: 'Rustique', label: 'Rustique' },
          { value: 'Champêtre', label: 'Champêtre' },
          { value: 'Colonial', label: 'Colonial' },
          { value: 'Industriel', label: 'Industriel' },
          { value: 'Loft', label: 'Loft' },
          { value: 'Vintage', label: 'Vintage' },
          { value: 'Rétro', label: 'Rétro' },
          { value: 'Scandinave', label: 'Scandinave' },
          { value: 'Bohème', label: 'Bohème' },
          { value: 'Baroque', label: 'Baroque' },
          { value: 'Art déco', label: 'Art déco' },
          { value: 'Ethnique', label: 'Ethnique' },
          { value: 'Exotique', label: 'Exotique' },
        ],
      },
      {
        id: 'materiauMobilier',
        label: 'Matériau',
        type: 'select',
        options: [
          { value: 'Bois massif', label: 'Bois massif' },
          { value: 'Bois aggloméré', label: 'Bois aggloméré' },
          { value: 'Acajou', label: 'Acajou' },
          { value: 'Teck', label: 'Teck' },
          { value: 'Iroko', label: 'Iroko' },
          { value: 'Wengé', label: 'Wengé' },
          { value: 'Sapelli', label: 'Sapelli' },
          { value: 'Bambou', label: 'Bambou' },
          { value: 'Rotin', label: 'Rotin' },
          { value: 'Métal', label: 'Métal' },
          { value: 'Acier inoxydable', label: 'Acier inoxydable' },
          { value: 'Fer forgé', label: 'Fer forgé' },
          { value: 'Verre', label: 'Verre' },
          { value: 'Verre trempé', label: 'Verre trempé' },
          { value: 'Tissu', label: 'Tissu' },
          { value: 'Cuir véritable', label: 'Cuir véritable' },
          { value: 'Similicuir', label: 'Similicuir' },
          { value: 'Velours', label: 'Velours' },
          { value: 'Plastique', label: 'Plastique' },
          { value: 'Pierre', label: 'Pierre' },
          { value: 'Marbre', label: 'Marbre' },
          { value: 'Combinaison bois et métal', label: 'Bois et métal' },
          { value: 'Combinaison bois et verre', label: 'Bois et verre' },
        ],
      },
      {
        id: 'couleurMobilier',
        label: 'Couleur',
        type: 'select',
        options: [
          { value: 'Blanc', label: 'Blanc' },
          { value: 'Blanc cassé', label: 'Blanc cassé' },
          { value: 'Beige', label: 'Beige' },
          { value: 'Gris clair', label: 'Gris clair' },
          { value: 'Gris', label: 'Gris' },
          { value: 'Gris anthracite', label: 'Gris anthracite' },
          { value: 'Noir', label: 'Noir' },
          { value: 'Marron clair', label: 'Marron clair' },
          { value: 'Marron', label: 'Marron' },
          { value: 'Marron foncé', label: 'Marron foncé' },
          { value: 'Bois naturel', label: 'Bois naturel' },
          { value: 'Bois clair', label: 'Bois clair' },
          { value: 'Bois foncé', label: 'Bois foncé' },
          { value: 'Acajou', label: 'Acajou' },
          { value: 'Wengé', label: 'Wengé' },
          { value: 'Bleu', label: 'Bleu' },
          { value: 'Vert', label: 'Vert' },
          { value: 'Rouge', label: 'Rouge' },
          { value: 'Multicolore', label: 'Multicolore' },
        ],
      },
      {
        id: 'etatMobilier',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf jamais utilisé', label: 'Neuf jamais utilisé' },
          { value: 'Neuf dans emballage', label: 'Neuf dans emballage' },
          { value: 'Excellent état (comme neuf)', label: 'Excellent état (comme neuf)' },
          { value: 'Très bon état', label: 'Très bon état' },
          { value: 'Bon état (usage normal)', label: 'Bon état (usage normal)' },
          { value: 'État moyen (quelques défauts)', label: 'État moyen (quelques défauts)' },
          { value: 'À rénover', label: 'À rénover' },
        ],
      },
      // ✅ NOUVEAU: Filtre par marque/fabricant
      {
        id: 'marqueMobilier',
        label: 'Marque/Fabricant',
        type: 'select',
        options: [
          { value: 'Fabrication artisanale locale', label: 'Artisan local' },
          { value: 'Menuisier local', label: 'Menuisier local' },
          { value: 'IKEA', label: 'IKEA' },
          { value: 'Conforama', label: 'Conforama' },
          { value: 'BUT', label: 'BUT' },
          { value: 'Habitat', label: 'Habitat' },
          { value: 'Maisons du Monde', label: 'Maisons du Monde' },
          { value: 'Roche Bobois', label: 'Roche Bobois' },
          { value: 'Import Chine', label: 'Import Chine' },
          { value: 'Import Dubaï', label: 'Import Dubaï' },
        ],
      },
      // ✅ NOUVEAU: Filtre par garantie
      {
        id: 'garantieMobilier',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'Garantie 6 mois', label: 'Garantie 6 mois' },
          { value: 'Garantie 1 an', label: 'Garantie 1 an' },
          { value: 'Garantie 2 ans', label: 'Garantie 2 ans' },
          { value: 'Garantie 3 ans', label: 'Garantie 3 ans' },
          { value: 'Garantie 5 ans', label: 'Garantie 5 ans' },
        ],
      },
      // ✅ NOUVEAU: Filtre par caractéristiques
      {
        id: 'caracteristiquesMobilier',
        label: 'Caractéristiques',
        type: 'multiselect',
        options: [
          { value: 'Démontable', label: 'Démontable' },
          { value: 'Pliable', label: 'Pliable' },
          { value: 'Extensible', label: 'Extensible' },
          { value: 'Modulable', label: 'Modulable' },
          { value: 'Convertible', label: 'Convertible' },
          { value: 'Avec rangement intégré', label: 'Avec rangement' },
          { value: 'Avec tiroirs', label: 'Avec tiroirs' },
          { value: 'Réglable en hauteur', label: 'Réglable en hauteur' },
          { value: 'Inclinable', label: 'Inclinable' },
          { value: 'Pivotant', label: 'Pivotant' },
          { value: 'Roulettes', label: 'Roulettes' },
          { value: 'Traité anti-termites', label: 'Anti-termites' },
          { value: 'Pour extérieur', label: 'Pour extérieur' },
          { value: 'Ergonomique', label: 'Ergonomique' },
        ],
      },
      {
        id: 'nombrePlaces',
        label: 'Nombre de places',
        type: 'range',
        min: 1,
        max: 12,
        unit: 'places',
      },
      {
        id: 'livraison',
        label: 'Livraison disponible',
        type: 'toggle',
      },
      {
        id: 'demontable',
        label: 'Démontable',
        type: 'toggle',
      },
      {
        id: 'montageRequis',
        label: 'Montage requis',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#F97316',
      gradientColors: ['#F97316', '#EA580C'],
      icon: '🪑',
      badgeColor: '#FFEDD5',
      accentColor: '#EA580C',
    },
    displayPriority: ['typeMobilier', 'marqueMobilier', 'materiauMobilier', 'dimensionsMobilier', 'couleurMobilier', 'etatMobilier', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
    supportsVariants: false, // Mobilier standard sans variantes complexes
    searchKeywords: ['canapé', 'lit', 'table', 'chaise', 'armoire', 'commode', 'meuble TV', 'buffet', 'bibliothèque', 'étagère', 'pouf', 'fauteuil', 'tabouret', 'coiffeuse', 'console'],
  },

  // 🖼️ DÉCORATION
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
      // ✅ Catégorie (NOUVEAU)
      {
        id: 'categorieUstensile',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: '🌍 Ustensiles traditionnels africains', label: '🌍 Traditionnel africain' },
          { value: '🍳 Batteries de cuisine (sets)', label: '🍳 Batteries (sets)' },
          { value: '🔥 Ustensiles de cuisson (casseroles, poêles)', label: '🔥 Cuisson' },
          { value: '🍽️ Vaisselle & Service (assiettes, verres)', label: '🍽️ Vaisselle' },
          { value: '🔪 Ustensiles de préparation (couteaux, râpes)', label: '🔪 Préparation' },
          { value: '⚡ Petits électroménagers (mixeur, blender)', label: '⚡ Électroménager' },
          { value: '📦 Conservation & Stockage', label: '📦 Conservation' },
          { value: '⚖️ Accessoires (balance, minuteur)', label: '⚖️ Accessoires' },
          { value: '🎪 Événementiel (jetable, location)', label: '🎪 Événementiel' },
          { value: '👨‍🍳 Professionnel / Restaurant', label: '👨‍🍳 Professionnel' },
        ],
      },
      // ✅ Type (ENRICHI : 40+ options)
      {
        id: 'typeUstensile',
        label: 'Type d\'ustensile',
        type: 'select',
        options: [
          // Traditionnel africain
          { value: 'Mortier et pilon', label: '🌍 Mortier et pilon' },
          { value: 'Canari', label: '🏺 Canari' },
          { value: 'Calebasse', label: '🌰 Calebasse' },
          { value: 'Marmite en terre', label: '🏺 Marmite en terre' },

          // Cuisson
          { value: 'Casserole', label: 'Casserole' },
          { value: 'Marmite', label: 'Marmite' },
          { value: 'Faitout', label: 'Faitout' },
          { value: 'Cocotte', label: 'Cocotte' },
          { value: 'Cocotte minute', label: 'Cocotte minute' },
          { value: 'Poêle', label: 'Poêle' },
          { value: 'Poêle anti-adhésive', label: 'Poêle anti-adhésive' },
          { value: 'Wok', label: 'Wok' },
          { value: 'Crêpière', label: 'Crêpière' },
          { value: 'Gaufrier', label: 'Gaufrier' },
          { value: 'Plancha', label: 'Plancha' },
          { value: 'Plat à four', label: 'Plat à four' },
          { value: 'Moule à gâteau', label: 'Moule à gâteau' },

          // Vaisselle
          { value: 'Service de table', label: 'Service de table' },
          { value: 'Assiette', label: 'Assiette' },
          { value: 'Bol', label: 'Bol' },
          { value: 'Saladier', label: 'Saladier' },
          { value: 'Verre', label: 'Verre' },
          { value: 'Tasse', label: 'Tasse' },
          { value: 'Mug', label: 'Mug' },
          { value: 'Coupe', label: 'Coupe' },
          { value: 'Couverts (fourchette, couteau, cuillère)', label: 'Couverts' },
          { value: 'Ménagère', label: 'Ménagère' },

          // Préparation
          { value: 'Couteau', label: 'Couteau' },
          { value: 'Set de couteaux', label: 'Set de couteaux' },
          { value: 'Planche à découper', label: 'Planche à découper' },
          { value: 'Fouet', label: 'Fouet' },
          { value: 'Spatule', label: 'Spatule' },
          { value: 'Louche', label: 'Louche' },
          { value: 'Râpe', label: 'Râpe' },
          { value: 'Éplucheur', label: 'Éplucheur' },
          { value: 'Passoire', label: 'Passoire' },

          // Électrique
          { value: 'Mixeur', label: '⚡ Mixeur' },
          { value: 'Blender', label: '⚡ Blender' },
          { value: 'Robot multifonction', label: '⚡ Robot multifonction' },
          { value: 'Bouilloire', label: '⚡ Bouilloire' },
          { value: 'Grille-pain', label: '⚡ Grille-pain' },
          { value: 'Cuiseur à riz', label: '⚡ Cuiseur à riz' },
          { value: 'Friteuse', label: '⚡ Friteuse' },
          { value: 'Multicuiseur', label: '⚡ Multicuiseur' },
          { value: 'Presse-agrumes', label: '⚡ Presse-agrumes' },

          // Accessoires
          { value: 'Boîte de conservation', label: 'Boîte de conservation' },
          { value: 'Balance', label: 'Balance' },
          { value: 'Minuteur', label: 'Minuteur' },
          { value: 'Thermomètre', label: 'Thermomètre' },
        ],
      },
      // ✅ Matériau (ENRICHI : 25+ options incluant traditionnel)
      {
        id: 'materiauUstensile',
        label: 'Matériau',
        type: 'select',
        options: [
          // Métaux
          { value: 'Inox (acier inoxydable)', label: 'Inox' },
          { value: 'Aluminium', label: 'Aluminium' },
          { value: 'Aluminium anodisé', label: 'Aluminium anodisé' },
          { value: 'Fonte', label: 'Fonte' },
          { value: 'Fonte émaillée', label: 'Fonte émaillée' },
          { value: 'Acier', label: 'Acier' },
          { value: 'Cuivre', label: 'Cuivre' },

          // Anti-adhésifs
          { value: 'Téflon', label: 'Téflon' },
          { value: 'Anti-adhésif (sans PFOA)', label: 'Anti-adhésif' },
          { value: 'Céramique', label: 'Céramique' },
          { value: 'Pierre (granite coating)', label: 'Pierre (granite)' },

          // Naturels (africain)
          { value: 'Bois', label: '🌍 Bois' },
          { value: 'Bambou', label: '🌍 Bambou' },
          { value: 'Terre cuite', label: '🏺 Terre cuite' },
          { value: 'Pierre naturelle', label: '🌍 Pierre naturelle' },
          { value: 'Argile', label: '🏺 Argile' },

          // Plastique & Silicone
          { value: 'Plastique alimentaire', label: 'Plastique' },
          { value: 'Silicone', label: 'Silicone' },
          { value: 'Mélamine', label: 'Mélamine' },

          // Verre & Porcelaine
          { value: 'Verre', label: 'Verre' },
          { value: 'Verre trempé', label: 'Verre trempé' },
          { value: 'Pyrex', label: 'Pyrex' },
          { value: 'Porcelaine', label: 'Porcelaine' },
          { value: 'Faïence', label: 'Faïence' },
          { value: 'Grès', label: 'Grès' },
        ],
      },
      // ✅ Marque (ENRICHI : 45+ marques africaines)
      {
        id: 'marqueUstensile',
        label: 'Marque',
        type: 'select',
        options: [
          // Marques chinoises populaires en Afrique
          { value: 'Binatone', label: '🌏 Binatone' },
          { value: 'Sokany', label: '🌏 Sokany' },
          { value: 'Lontor', label: '🌏 Lontor' },
          { value: 'Qasa', label: '🌏 Qasa' },
          { value: 'Century', label: '🌏 Century' },
          { value: 'Master Chef', label: '🌏 Master Chef' },
          { value: 'Scarlett', label: '🌏 Scarlett' },
          { value: 'Xiaomi', label: '🌏 Xiaomi' },

          // Marques européennes/turques
          { value: 'Tefal', label: 'Tefal' },
          { value: 'Moulinex', label: 'Moulinex' },
          { value: 'Arçelik', label: 'Arçelik' },
          { value: 'Philips', label: 'Philips' },
          { value: 'Krups', label: 'Krups' },
          { value: 'Bosch', label: 'Bosch' },
          { value: 'Kenwood', label: 'Kenwood' },
          { value: 'Braun', label: 'Braun' },

          // Premium
          { value: 'Pyrex', label: 'Pyrex' },
          { value: 'Luminarc', label: 'Luminarc' },
          { value: 'Duralex', label: 'Duralex' },
          { value: 'KitchenAid', label: 'KitchenAid' },
          { value: 'Le Creuset', label: 'Le Creuset' },

          // Locales
          { value: 'Marque locale', label: '🌍 Marque locale' },
          { value: 'Artisan local', label: '🌍 Artisan local' },
          { value: 'Fabrication artisanale', label: '🌍 Fabrication artisanale' },
          { value: 'Sans marque', label: 'Sans marque' },
        ],
      },
      // ✅ État (NOUVEAU)
      {
        id: 'etatUstensile',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf scellé', label: '🆕 Neuf scellé' },
          { value: 'Neuf sans emballage', label: '📦 Neuf sans emballage' },
          { value: 'Excellent état (comme neuf)', label: '⭐ Excellent état' },
          { value: 'Bon état', label: '✔️ Bon état' },
          { value: 'État correct', label: '👌 État correct' },
          { value: 'Occasion (usure visible)', label: '♻️ Occasion' },
        ],
      },
      // ✅ Usage (NOUVEAU)
      {
        id: 'usageUstensile',
        label: 'Usage',
        type: 'select',
        options: [
          { value: 'Cuisine quotidienne / Domestique', label: '🏠 Domestique' },
          { value: 'Professionnel / Restaurant', label: '👨‍🍳 Professionnel' },
          { value: 'Événementiel (mariage, fête)', label: '🎪 Événementiel' },
          { value: 'Camping / Extérieur', label: '⛺ Camping' },
          { value: 'Cuisine traditionnelle africaine', label: '🌍 Cuisine traditionnelle' },
          { value: 'Pâtisserie', label: '🎂 Pâtisserie' },
          { value: 'Location pour événements', label: '🎪 Location' },
        ],
      },
      // ✅ Nombre de pièces (NOUVEAU)
      {
        id: 'piecesDansSet',
        label: 'Nombre de pièces',
        type: 'select',
        options: [
          { value: '1 pièce (ustensile unique)', label: '1 pièce' },
          { value: '2 pièces', label: '2 pièces' },
          { value: '3 pièces', label: '3 pièces' },
          { value: '5 pièces', label: '5 pièces' },
          { value: '6 pièces', label: '6 pièces' },
          { value: '7 pièces', label: '7 pièces' },
          { value: '10 pièces', label: '10 pièces' },
          { value: '12 pièces', label: '12 pièces' },
          { value: '20+ pièces', label: '20+ pièces (set complet)' },
        ],
      },
      // ✅ Capacité (NOUVEAU - range)
      {
        id: 'capaciteUstensile',
        label: 'Capacité',
        type: 'select',
        options: [
          { value: '0.5L', label: '0.5L' },
          { value: '1L', label: '1L' },
          { value: '1.5L', label: '1.5L' },
          { value: '2L', label: '2L' },
          { value: '3L', label: '3L' },
          { value: '5L', label: '5L' },
          { value: '10L', label: '10L' },
          { value: '15L', label: '15L' },
          { value: '20L', label: '20L' },
          { value: '30L', label: '30L' },
          { value: '40L', label: '40L+' },
          { value: 'Ø 20cm', label: 'Ø 20cm' },
          { value: 'Ø 24cm', label: 'Ø 24cm' },
          { value: 'Ø 28cm', label: 'Ø 28cm' },
          { value: 'Ø 32cm', label: 'Ø 32cm' },
          { value: 'N/A', label: 'Non applicable' },
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
    displayPriority: ['categorieUstensile', 'typeUstensile', 'materiauUstensile', 'marqueUstensile', 'etatUstensile', 'usageUstensile', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    // ✅ NOUVEAU: Mots-clés locaux africains pour recherche intelligente
    searchKeywords: [
      // ═══ TERMES GÉNÉRAUX ═══
      'ustensile', 'ustensiles', 'ustensile cuisine', 'vaisselle', 'batterie cuisine', 'accessoire cuisine',
      'matériel cuisine', 'équipement cuisine', 'outil cuisine',

      // ═══ USTENSILES TRADITIONNELS AFRICAINS ═══
      'mortier', 'pilon', 'mortier et pilon', 'canari', 'calebasse', 'marmite terre',
      'terre cuite', 'argile', 'panier tressé', 'natte séchage', 'pierre à moudre',
      'meule grain', 'traditionnel africain',

      // ═══ BOUTERIE DE CUISINE (SETS) ═══
      'batterie cuisine 5 pièces', 'batterie cuisine 7 pièces', 'batterie cuisine 10 pièces',
      'set cuisine', 'set casserole', 'kit cuisine',

      // ═══ CASSEROLES & MARMITES ═══
      'casserole', 'marmite', 'faitout', 'cocotte minute', 'autocuiseur', 'cocotte fonte',
      'marmite 10L', 'marmite 20L', 'marmite 30L',

      // ═══ POÊLES & GRILLS ═══
      'poêle', 'wok', 'crêpière', 'gaufrier', 'plancha', 'poêle anti-adhésive',
      'poêle antiadhesive', 'poele inox',

      // ═══ VAISSELLE ═══
      'assiette', 'verre', 'tasse', 'mug', 'coupe', 'bol', 'saladier',
      'service table', 'ménagère', 'couverts', 'fourchette', 'couteau', 'cuillère',
      'assiettes jetables', 'couverts jetables',

      // ═══ PRÉPARATION ═══
      'couteau cuisine', 'set couteaux', 'planche découper', 'fouet', 'spatule',
      'louche', 'écumoire', 'pince', 'râpe', 'éplucheur', 'passoire', 'entonnoir',
      'rouleau pâtisserie',

      // ═══ PETITS ÉLECTROMÉNAGERS ═══
      'mixeur', 'blender', 'robot multifonction', 'hachoir', 'moulin café',
      'bouilloire', 'bouilloire électrique', 'grille-pain', 'grille pain',
      'cuiseur riz', 'friteuse', 'multicuiseur', 'presse-agrumes', 'centrifugeuse',
      'extracteur jus',

      // ═══ CONSERVATION & STOCKAGE ═══
      'boîte conservation', 'boite conservation', 'tupperware', 'bocal verre',
      'bocaux', 'plastique alimentaire',

      // ═══ ACCESSOIRES ═══
      'balance cuisine', 'minuteur', 'thermomètre cuisine', 'torchon', 'manique',
      'dessous plat', 'égouttoir vaisselle',

      // ═══ MARQUES POPULAIRES CAMEROUN & AFRIQUE ═══
      'binatone', 'sokany', 'lontor', 'qasa', 'century', 'master chef',
      'tefal', 'moulinex', 'philips', 'krups', 'bosch', 'kenwood',
      'pyrex', 'luminarc', 'duralex', 'xiaomi',

      // ═══ MATÉRIAUX ═══
      'inox', 'inoxydable', 'aluminium', 'fonte', 'acier', 'cuivre',
      'téflon', 'céramique', 'silicone', 'verre', 'pyrex', 'porcelaine',

      // ═══ USAGES ═══
      'professionnel', 'restaurant', 'domestique', 'événementiel', 'mariage',
      'camping', 'pâtisserie', 'cuisine africaine', 'traditionnel',

      // ═══ DOUALA & CAMEROUN ═══
      'ustensile Douala', 'vaisselle Douala', 'casserole Douala',
      'batterie cuisine Yaoundé', 'ustensile Cameroun', 'équipement cuisine Douala',
      'marché central Douala', 'sandaga', 'marché mokolo',
    ],
  },

  // 🍷 VIN ET LIQUEUR (COMMERCIALISATION)
  vin_liqueur: {
    terminology: {
      productLabel: 'Produit',
      productsLabel: 'Vins & Liqueurs',
      priceLabel: 'Prix',
      locationLabel: 'Vendeur',
      providerLabel: 'Commerçant',
      searchPlaceholder: 'Rechercher vin, champagne, spiritueux...',
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
        id: 'categorieVin',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'Vins rouges', label: 'Vins rouges' },
          { value: 'Vins blancs', label: 'Vins blancs' },
          { value: 'Vins rosés', label: 'Vins rosés' },
          { value: 'Champagnes & Effervescents', label: 'Champagnes & Effervescents' },
          { value: 'Spiritueux (Whisky, Cognac, Rhum, Vodka)', label: 'Spiritueux' },
          { value: 'Liqueurs & Apéritifs', label: 'Liqueurs & Apéritifs' },
          { value: 'Vins fortifiés (Porto, Sherry, Vermouth)', label: 'Vins fortifiés' },
          { value: 'Alcools traditionnels africains', label: 'Alcools africains' },
        ],
      },
      {
        id: 'regionVin',
        label: 'Région',
        type: 'select',
        options: [
          // France principales
          { value: 'Bordeaux', label: 'Bordeaux' },
          { value: 'Bourgogne', label: 'Bourgogne' },
          { value: 'Champagne', label: 'Champagne' },
          { value: 'Provence', label: 'Provence' },
          { value: 'Vallée du Rhône (Côtes du Rhône)', label: 'Vallée du Rhône' },
          { value: 'Loire (Sancerre, Muscadet)', label: 'Loire' },
          { value: 'Languedoc-Roussillon', label: 'Languedoc-Roussillon' },
          // Nouveau Monde
          { value: 'Afrique du Sud (Stellenbosch, Paarl, Robertson)', label: 'Afrique du Sud' },
          { value: 'Chili (Maipo, Colchagua)', label: 'Chili' },
          { value: 'Argentine (Mendoza)', label: 'Argentine' },
          { value: 'Californie (Napa Valley, Sonoma)', label: 'Californie' },
          { value: 'Australie (Barossa Valley)', label: 'Australie' },
          // Afrique
          { value: 'Cameroun (productions locales)', label: 'Cameroun' },
          { value: 'Maroc (Meknès, Casablanca)', label: 'Maroc' },
          { value: 'Tunisie (Coteaux de Carthage)', label: 'Tunisie' },
          { value: 'Algérie (Mascara, Médéa)', label: 'Algérie' },
        ],
      },
      {
        id: 'marqueVin',
        label: 'Marque',
        type: 'select',
        options: [
          // Champagnes
          { value: 'Moët & Chandon', label: 'Moët & Chandon' },
          { value: 'Veuve Clicquot', label: 'Veuve Clicquot' },
          { value: 'Dom Pérignon', label: 'Dom Pérignon' },
          { value: 'Mumm', label: 'Mumm' },
          { value: 'Piper-Heidsieck', label: 'Piper-Heidsieck' },
          // Vins populaires Afrique
          { value: 'Baron de Lestac', label: 'Baron de Lestac' },
          { value: 'Baron Philippe de Rothschild', label: 'Baron Philippe de Rothschild' },
          { value: 'Mouton Cadet', label: 'Mouton Cadet' },
          { value: 'Castel Frères', label: 'Castel Frères' },
          { value: 'J.P. Chenet', label: 'J.P. Chenet' },
          { value: 'Les Jamelles', label: 'Les Jamelles' },
          // Spiritueux
          { value: 'Johnnie Walker', label: 'Johnnie Walker' },
          { value: 'Jack Daniel\'s', label: 'Jack Daniel\'s' },
          { value: 'Chivas Regal', label: 'Chivas Regal' },
          { value: 'Hennessy', label: 'Hennessy' },
          { value: 'Rémy Martin', label: 'Rémy Martin' },
          { value: 'Absolut Vodka', label: 'Absolut Vodka' },
          { value: 'Bacardi', label: 'Bacardi' },
          // Productions africaines
          { value: 'Top Ananas', label: 'Top Ananas' },
          { value: 'Odontol', label: 'Odontol' },
          { value: 'Mandjou', label: 'Mandjou' },
          { value: 'KWV (Afrique du Sud)', label: 'KWV' },
          { value: 'Nederburg (Afrique du Sud)', label: 'Nederburg' },
        ],
      },
      {
        id: 'formatVin',
        label: 'Format',
        type: 'select',
        options: [
          { value: '75cl (Bouteille standard)', label: '75cl (Bouteille)' },
          { value: '1,5L (Magnum)', label: '1,5L (Magnum)' },
          { value: '70cl (Spiritueux)', label: '70cl (Spiritueux)' },
          { value: 'Carton 6 bouteilles', label: 'Carton 6' },
          { value: 'Carton 12 bouteilles', label: 'Carton 12' },
          { value: 'Caisse bois 6 bouteilles', label: 'Caisse bois 6' },
          { value: 'Palette (grossiste)', label: 'Palette (grossiste)' },
        ],
      },
      {
        id: 'typeCommercialisation',
        label: 'Commercialisation',
        type: 'select',
        options: [
          { value: 'Vente au détail (unité)', label: 'Détail (unité)' },
          { value: 'Vente en carton (6/12 bouteilles)', label: 'Carton (6/12)' },
          { value: 'Vente en gros (minimum 50 unités)', label: 'Gros (50+)' },
          { value: 'Vente en palette (grossiste)', label: 'Palette' },
          { value: 'Vente aux professionnels (bars, restaurants, hôtels)', label: 'Professionnels' },
          { value: 'Vente événementielle (mariage, fête)', label: 'Événementiel' },
        ],
      },
      {
        id: 'certificationVin',
        label: 'Certification',
        type: 'select',
        options: [
          { value: 'AOC (Appellation d\'Origine Contrôlée)', label: 'AOC' },
          { value: 'AOP (Appellation d\'Origine Protégée)', label: 'AOP' },
          { value: 'IGP (Indication Géographique Protégée)', label: 'IGP' },
          { value: 'Bio / Agriculture Biologique', label: 'Bio' },
          { value: 'Vin nature / Vin naturel', label: 'Vin nature' },
          { value: 'Sans certification', label: 'Sans certification' },
        ],
      },
      {
        id: 'paysOrigineVin',
        label: 'Pays d\'origine',
        type: 'select',
        options: [
          { value: 'France', label: 'France' },
          { value: 'Afrique du Sud', label: 'Afrique du Sud' },
          { value: 'Italie', label: 'Italie' },
          { value: 'Espagne', label: 'Espagne' },
          { value: 'Chili', label: 'Chili' },
          { value: 'Argentine', label: 'Argentine' },
          { value: 'États-Unis (Californie)', label: 'États-Unis' },
          { value: 'Cameroun', label: 'Cameroun' },
          { value: 'Maroc', label: 'Maroc' },
          { value: 'Algérie', label: 'Algérie' },
          { value: 'Tunisie', label: 'Tunisie' },
        ],
      },
    ],
    style: {
      primaryColor: '#7C2D12',
      gradientColors: ['#7C2D12', '#991B1B'],
      icon: '🍷',
      badgeColor: '#FEE2E2',
      accentColor: '#991B1B',
    },
    displayPriority: ['typeProduitVin', 'marqueVin', 'regionVin', 'formatVin', 'millesimeVin', 'typeCommercialisation', 'prix'],
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
        label: 'Type d\'article',
        type: 'select',
        options: [
          // Livres
          { value: 'Livre scolaire', label: 'Livre scolaire' },
          { value: 'Manuel scolaire', label: 'Manuel scolaire' },
          { value: 'Dictionnaire', label: 'Dictionnaire' },
          { value: 'Roman', label: 'Roman' },
          { value: 'BD/Comics', label: 'BD/Comics' },
          // Fournitures écriture
          { value: 'Stylo', label: 'Stylo' },
          { value: 'Crayon', label: 'Crayon' },
          { value: 'Marqueur/Feutre', label: 'Marqueur' },
          { value: 'Gomme', label: 'Gomme' },
          // Accessoires dessin/calcul
          { value: 'Règle', label: 'Règle' },
          { value: 'Calculatrice', label: 'Calculatrice' },
          { value: 'Calculatrice scientifique', label: 'Calc. scientifique' },
          // Organisation
          { value: 'Cahier', label: 'Cahier' },
          { value: 'Classeur', label: 'Classeur' },
          // Accessoires sacs
          { value: 'Cartable', label: 'Cartable' },
          { value: 'Sac à dos scolaire', label: 'Sac à dos' },
          { value: 'Trousse', label: 'Trousse' },
        ],
      },
      {
        id: 'niveau',
        label: 'Niveau scolaire',
        type: 'select',
        options: [
          // Maternelle
          { value: 'Petite section (3 ans)', label: 'Petite section' },
          { value: 'Moyenne section (4 ans)', label: 'Moyenne section' },
          { value: 'Grande section (5 ans)', label: 'Grande section' },
          // Primaire
          { value: 'CP (Cours Préparatoire)', label: 'CP' },
          { value: 'CE1 (Cours Élémentaire 1)', label: 'CE1' },
          { value: 'CE2 (Cours Élémentaire 2)', label: 'CE2' },
          { value: 'CM1 (Cours Moyen 1)', label: 'CM1' },
          { value: 'CM2 (Cours Moyen 2)', label: 'CM2' },
          // Collège
          { value: '6ème', label: '6ème' },
          { value: '5ème', label: '5ème' },
          { value: '4ème', label: '4ème' },
          { value: '3ème', label: '3ème' },
          // Lycée général
          { value: 'Seconde', label: 'Seconde' },
          { value: 'Première', label: 'Première' },
          { value: 'Terminale', label: 'Terminale' },
          // Parcours Lycée Cameroun
          { value: 'Première S (Scientifique)', label: '1ère S' },
          { value: 'Terminale S', label: 'Terminale S' },
          { value: 'Première L (Littéraire)', label: '1ère L' },
          { value: 'Terminale L', label: 'Terminale L' },
          { value: 'Première ES (Économie-Social)', label: '1ère ES' },
          { value: 'Terminale ES', label: 'Terminale ES' },
          // Université
          { value: 'Licence 1', label: 'Licence 1' },
          { value: 'Licence 2', label: 'Licence 2' },
          { value: 'Licence 3', label: 'Licence 3' },
          { value: 'Master 1', label: 'Master 1' },
          { value: 'Master 2', label: 'Master 2' },
          // Formation pro
          { value: 'BTS (Brevet de Technicien Supérieur)', label: 'BTS' },
          { value: 'Formation professionnelle', label: 'Formation pro' },
          // Autres
          { value: 'Tous niveaux', label: 'Tous niveaux' },
        ],
      },
      {
        id: 'matiereScolaire',
        label: 'Matière',
        type: 'select',
        options: [
          // Matières générales
          { value: 'Mathématiques', label: 'Mathématiques' },
          { value: 'Français', label: 'Français' },
          { value: 'Anglais', label: 'Anglais' },
          { value: 'Espagnol', label: 'Espagnol' },
          { value: 'Allemand', label: 'Allemand' },
          // Sciences
          { value: 'Sciences de la Vie et de la Terre (SVT)', label: 'SVT' },
          { value: 'Physique', label: 'Physique' },
          { value: 'Chimie', label: 'Chimie' },
          { value: 'Physique-Chimie', label: 'Physique-Chimie' },
          // Sciences sociales
          { value: 'Histoire', label: 'Histoire' },
          { value: 'Géographie', label: 'Géographie' },
          { value: 'Sciences Économiques et Sociales (SES)', label: 'SES' },
          // Autres
          { value: 'Philosophie', label: 'Philosophie' },
          { value: 'Informatique', label: 'Informatique' },
          { value: 'Toutes matières', label: 'Toutes matières' },
        ],
      },
      {
        id: 'editeur',
        label: 'Éditeur/Marque',
        type: 'select',
        options: [
          // Éditeurs MENESRES
          { value: 'Edicef Afrique', label: 'Edicef Afrique' },
          { value: 'CIAM (Centre d\'Impression et d\'Édition du Cameroun)', label: 'CIAM' },
          { value: 'Éditions CLE (Cameroon Literature in English)', label: 'Éditions CLE' },
          { value: 'Éditions St-Paul', label: 'Éditions St-Paul' },
          { value: 'Longman Cameroun', label: 'Longman Cameroun' },
          // Éditeurs internationaux
          { value: 'Nathan', label: 'Nathan' },
          { value: 'Hachette', label: 'Hachette' },
          { value: 'Bordas', label: 'Bordas' },
          { value: 'Hatier', label: 'Hatier' },
          { value: 'Magnard', label: 'Magnard' },
          { value: 'Oxford University Press', label: 'Oxford U.P.' },
          // Marques fournitures populaires
          { value: 'Bic', label: 'Bic' },
          { value: 'Stabilo', label: 'Stabilo' },
          { value: 'Maped', label: 'Maped' },
          { value: 'Clairefontaine', label: 'Clairefontaine' },
          // Marques calculatrices
          { value: 'Casio', label: 'Casio' },
          { value: 'Texas Instruments', label: 'Texas Instruments' },
        ],
      },
      {
        id: 'etatLivre',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf emballé (jamais ouvert)', label: 'Neuf emballé' },
          { value: 'Neuf sans emballage', label: 'Neuf sans emballage' },
          { value: 'Excellent état (comme neuf, très peu utilisé)', label: 'Excellent état' },
          { value: 'Bon état (peu utilisé, presque comme neuf)', label: 'Bon état' },
          { value: 'État moyen (utilisé mais correct)', label: 'État moyen' },
          { value: 'Occasion (utilisation normale)', label: 'Occasion' },
          { value: 'Usagé (utilisé intensément mais fonctionnel)', label: 'Usagé' },
        ],
      },
      {
        id: 'langue',
        label: 'Langue',
        type: 'select',
        options: [
          { value: 'Français (uniquement)', label: 'Français' },
          { value: 'Anglais (uniquement)', label: 'Anglais' },
          { value: 'Bilingue (Français-Anglais)', label: 'Bilingue 🇨🇲' },
          { value: 'Espagnol', label: 'Espagnol' },
          { value: 'Allemand', label: 'Allemand' },
          { value: 'Langues nationales (Duala, Ewondo, etc.)', label: 'Langues nationales' },
        ],
      },
      {
        id: 'typeCalculatrice',
        label: 'Type calculatrice',
        type: 'select',
        options: [
          { value: 'Calculatrice simple', label: 'Simple' },
          { value: 'Calculatrice scientifique', label: 'Scientifique' },
          { value: 'Calculatrice graphique (Casio fx-9750GIII, TI-83 Plus)', label: 'Graphique' },
          { value: 'Calculatrice programmable', label: 'Programmable' },
          { value: 'Calculatrice financière', label: 'Financière' },
        ],
      },
      {
        id: 'programmesMenesres',
        label: 'Programme MENESRES',
        type: 'select',
        options: [
          { value: 'Programme MENESRES Primaire 2024-2025', label: 'Primaire 2024-2025' },
          { value: 'Programme MENESRES Secondaire 2024-2025', label: 'Secondaire 2024-2025' },
          { value: 'Programme MENESRES Lycée scientifique 2024-2025', label: 'Lycée scientifique' },
          { value: 'Programme MENESRES Lycée littéraire 2024-2025', label: 'Lycée littéraire' },
          { value: 'OGE (Office du Baccalauréat) - Préparation Bac', label: 'OGE - Bac' },
          { value: 'BEPC - Préparation brevet', label: 'BEPC' },
        ],
      },
      {
        id: 'formatsCahiers',
        label: 'Format cahier',
        type: 'select',
        options: [
          { value: '17x22 (Petit format)', label: '17x22 (Petit)' },
          { value: '21x29,7 (A4)', label: 'A4' },
          { value: '24x32 (Grand format)', label: '24x32 (Grand)' },
          { value: 'A5 (14,8x21)', label: 'A5' },
          { value: 'Spirale 17x22', label: 'Spirale 17x22' },
          { value: 'Spirale A4', label: 'Spirale A4' },
        ],
      },
      {
        id: 'couleursFournitures',
        label: 'Couleur',
        type: 'select',
        options: [
          { value: 'Noir', label: 'Noir' },
          { value: 'Bleu', label: 'Bleu' },
          { value: 'Rouge', label: 'Rouge' },
          { value: 'Vert', label: 'Vert' },
          { value: 'Jaune', label: 'Jaune' },
          { value: 'Orange', label: 'Orange' },
          { value: 'Rose', label: 'Rose' },
          { value: 'Violet', label: 'Violet' },
          { value: 'Multicolore', label: 'Multicolore' },
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

  // 🔨 QUINCAILLERIE - REFONTE COMPLÈTE
  // 🎯 Focus: Visserie, Outils, Matériaux, Peinture, Serrurerie (SANS électricité ni sanitaire)
  quincaillerie: {
    terminology: {
      productLabel: 'Article de quincaillerie',
      productsLabel: 'Quincaillerie',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher visserie, outils, matériaux, peinture...',
      emptyMessage: 'Aucun article de quincaillerie disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Catégorie (8 catégories - SANS électricité ni sanitaire)
      {
        id: 'categorieQuincaillerie',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'Visserie & Boulonnerie', label: 'Visserie & Boulonnerie' },
          { value: 'Serrurerie & Sécurité', label: 'Serrurerie & Sécurité' },
          { value: 'Quincaillerie porte/fenêtre', label: 'Quincaillerie porte/fenêtre' },
          { value: 'Outils manuels', label: 'Outils manuels' },
          { value: 'Matériaux construction', label: 'Matériaux construction' },
          { value: 'Peinture & Finitions', label: 'Peinture & Finitions' },
          { value: 'Fixations & Accrochage', label: 'Fixations & Accrochage' },
          { value: 'Accessoires quincaillerie', label: 'Accessoires quincaillerie' },
        ],
      },
      // ✅ FILTRE 2 : Type de produit
      {
        id: 'typeQuincaillerie',
        label: 'Type de produit',
        type: 'select',
        options: [
          { value: 'Vis', label: 'Vis' },
          { value: 'Boulons', label: 'Boulons' },
          { value: 'Serrures & Verrous', label: 'Serrures & Verrous' },
          { value: 'Cadenas', label: 'Cadenas' },
          { value: 'Outils de frappe', label: 'Outils de frappe' },
          { value: 'Outils de coupe', label: 'Outils de coupe' },
          { value: 'Ciment & Mortier', label: 'Ciment & Mortier' },
          { value: 'Peintures', label: 'Peintures' },
        ],
      },
      // ✅ FILTRE 3 : Marque
      {
        id: 'marqueQuincaillerie',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Stanley', label: 'Stanley' },
          { value: 'Facom', label: 'Facom' },
          { value: 'Bosch', label: 'Bosch' },
          { value: 'Makita', label: 'Makita' },
          { value: 'DeWalt', label: 'DeWalt' },
          { value: 'Dulux', label: 'Dulux' },
          { value: 'Vachette', label: 'Vachette' },
          { value: 'Lafarge', label: 'Lafarge' },
          { value: 'Cimencam (Cameroun)', label: 'Cimencam (Cameroun)' },
        ],
      },
      // ✅ FILTRE 4 : Matériau
      {
        id: 'materiauQuincaillerie',
        label: 'Matériau',
        type: 'select',
        options: [
          { value: 'Acier', label: 'Acier' },
          { value: 'Acier inoxydable', label: 'Acier inoxydable' },
          { value: 'Laiton', label: 'Laiton' },
          { value: 'Aluminium', label: 'Aluminium' },
          { value: 'Bois', label: 'Bois' },
          { value: 'Béton', label: 'Béton' },
          { value: 'Plastique', label: 'Plastique' },
        ],
      },
      // ✅ FILTRE 5 : Dimension/Diamètre
      {
        id: 'dimensionQuincaillerie',
        label: 'Dimension',
        type: 'select',
        options: [
          { value: 'M3', label: 'M3' },
          { value: 'M4', label: 'M4' },
          { value: 'M5', label: 'M5' },
          { value: 'M6', label: 'M6' },
          { value: 'M8', label: 'M8' },
          { value: 'M10', label: 'M10' },
          { value: 'M12', label: 'M12' },
        ],
      },
      // ✅ FILTRE 6 : Finition
      {
        id: 'finitionQuincaillerie',
        label: 'Finition',
        type: 'select',
        options: [
          { value: 'Zingué', label: 'Zingué' },
          { value: 'Galvanisé', label: 'Galvanisé' },
          { value: 'Chromé', label: 'Chromé' },
          { value: 'Nickelé', label: 'Nickelé' },
          { value: 'Brut', label: 'Brut' },
        ],
      },
      // ✅ FILTRE 7 : Usage
      {
        id: 'usageQuincaillerie',
        label: 'Usage',
        type: 'select',
        options: [
          { value: 'Usage résidentiel', label: 'Usage résidentiel' },
          { value: 'Usage professionnel', label: 'Usage professionnel' },
          { value: 'Chantier', label: 'Chantier' },
          { value: 'Bricolage', label: 'Bricolage' },
        ],
      },
      // ✅ FILTRE 8 : État
      {
        id: 'etatQuincaillerie',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf emballé', label: 'Neuf emballé' },
          { value: 'Neuf déballé', label: 'Neuf déballé' },
          { value: 'Excellent état', label: 'Excellent état' },
          { value: 'Bon état', label: 'Bon état' },
          { value: 'Occasion', label: 'Occasion' },
        ],
      },
      // ✅ FILTRE 9 : Garantie
      {
        id: 'garantieQuincaillerie',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'Garantie fabricant 10 ans', label: 'Garantie 10 ans' },
          { value: 'Garantie fabricant 5 ans', label: 'Garantie 5 ans' },
          { value: 'Garantie fabricant 2 ans', label: 'Garantie 2 ans' },
          { value: 'Garantie fabricant 1 an', label: 'Garantie 1 an' },
          { value: 'Sans garantie', label: 'Sans garantie' },
        ],
      },
      // ✅ FILTRE 10 : Norme/Certification
      {
        id: 'normeQuincaillerie',
        label: 'Norme',
        type: 'select',
        options: [
          { value: 'CE', label: 'CE' },
          { value: 'NF', label: 'NF' },
          { value: 'ISO 9001', label: 'ISO 9001' },
          { value: 'A2P (serrurerie)', label: 'A2P (serrurerie)' },
          { value: 'EN 197-1 (Ciment)', label: 'EN 197-1 (Ciment)' },
        ],
      },
      // ✅ FILTRE 11 : Unité de vente
      {
        id: 'uniteVente',
        label: 'Unité de vente',
        type: 'select',
        options: [
          { value: 'Pièce', label: 'À la pièce' },
          { value: 'Lot de 10', label: 'Lot de 10' },
          { value: 'Lot de 50', label: 'Lot de 50' },
          { value: 'Lot de 100', label: 'Lot de 100' },
          { value: 'Sac 25kg', label: 'Sac 25kg' },
          { value: 'Sac 50kg', label: 'Sac 50kg' },
        ],
      },
      // ✅ FILTRE 12 : Type de fournisseur
      {
        id: 'typeFournisseurQuincaillerie',
        label: 'Type vendeur',
        type: 'select',
        options: [
          { value: 'Quincaillerie/Magasin spécialisé', label: 'Quincaillerie' },
          { value: 'Grande surface bricolage', label: 'Grande surface' },
          { value: 'Grossiste matériaux', label: 'Grossiste' },
          { value: 'Importateur direct', label: 'Importateur' },
          { value: 'Fabricant local', label: 'Fabricant local' },
        ],
      },
      // ✅ FILTRE 13 : Localisation - Ville (système intelligent)
      {
        id: 'ville',
        label: 'Ville du magasin',
        type: 'select',
        options: [
          // Les villes s'adaptent au pays de l'utilisateur via africanLocations.ts
          { value: 'Douala', label: '🇨🇲 Douala' },
          { value: 'Yaoundé', label: '🇨🇲 Yaoundé' },
          { value: 'Bafoussam', label: '🇨🇲 Bafoussam' },
          { value: 'Garoua', label: '🇨🇲 Garoua' },
          { value: 'Bamenda', label: '🇨🇲 Bamenda' },
          // Autres pays prioritaires
          { value: 'Kinshasa', label: '🇨🇩 Kinshasa' },
          { value: 'Lubumbashi', label: '🇨🇩 Lubumbashi' },
          { value: 'Abidjan', label: '🇨🇮 Abidjan' },
          { value: 'Dakar', label: '🇸🇳 Dakar' },
          { value: 'Bamako', label: '🇲🇱 Bamako' },
        ],
      },
      // ✅ FILTRE 14 : Localisation - Quartier (système intelligent)
      {
        id: 'quartier',
        label: 'Quartier',
        type: 'select',
        options: [
          // Quartiers Douala
          { value: 'Akwa', label: 'Douala - Akwa' },
          { value: 'Bonanjo', label: 'Douala - Bonanjo' },
          { value: 'Bonapriso', label: 'Douala - Bonapriso' },
          { value: 'Deido', label: 'Douala - Deido' },
          { value: 'Bali', label: 'Douala - Bali' },
          // Quartiers Yaoundé
          { value: 'Bastos', label: 'Yaoundé - Bastos' },
          { value: 'Nlongkak', label: 'Yaoundé - Nlongkak' },
          { value: 'Mvan', label: 'Yaoundé - Mvan' },
          { value: 'Essos', label: 'Yaoundé - Essos' },
          { value: 'Mokolo', label: 'Yaoundé - Mokolo' },
        ],
      },
      // ✅ FILTRE 15 : Stock disponible (toggle)
      {
        id: 'enStock',
        label: 'En stock immédiat',
        type: 'toggle',
      },
      // ✅ FILTRE 16 : Livraison disponible (toggle)
      {
        id: 'livraisonDisponible',
        label: 'Livraison disponible',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#64748B',
      gradientColors: ['#64748B', '#475569'],
      icon: '🔨',
      badgeColor: '#F1F5F9',
      accentColor: '#475569',
    },
    displayPriority: ['nomProduitQuincaillerie', 'categorieQuincaillerie', 'marqueQuincaillerie', 'materiauQuincaillerie', 'etatQuincaillerie', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
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
        id: 'typeAssuranceVie',
        label: 'Type d\'assurance',
        type: 'select',
        options: [
          { value: 'VIE', label: 'Assurance VIE' },
          { value: 'NON VIE', label: 'Assurance NON VIE' },
        ],
      },
      {
        id: 'produitAssurance',
        label: 'Produit',
        type: 'select',
        options: [
          // VIE
          { value: 'Assurance Vie Entière', label: 'Vie Entière' },
          { value: 'Assurance Vie Temporaire', label: 'Vie Temporaire' },
          { value: 'Assurance Décès', label: 'Décès' },
          { value: 'Assurance Épargne', label: 'Épargne' },
          { value: 'Assurance Retraite', label: 'Retraite' },
          { value: 'Assurance Éducation', label: 'Éducation' },
          // NON VIE
          { value: 'Assurance Automobile', label: 'Automobile' },
          { value: 'Assurance Auto Tous Risques', label: 'Auto Tous Risques' },
          { value: 'Assurance Auto Au Tiers', label: 'Auto Au Tiers' },
          { value: 'Assurance Moto', label: 'Moto' },
          { value: 'Assurance Habitation', label: 'Habitation' },
          { value: 'Assurance Multirisque Habitation', label: 'Multirisque Habitation' },
          { value: 'Assurance Santé / Maladie', label: 'Santé / Maladie' },
          { value: 'Assurance Hospitalisation', label: 'Hospitalisation' },
          { value: 'Assurance Voyage', label: 'Voyage' },
          { value: 'Assurance Responsabilité Civile', label: 'Responsabilité Civile' },
          { value: 'Assurance Entreprise', label: 'Entreprise' },
        ],
      },
      {
        id: 'compagnieAssurance',
        label: 'Compagnie',
        type: 'select',
        options: [
          { value: 'ACTIVA Assurances', label: 'ACTIVA' },
          { value: 'AXA Assurances Cameroun', label: 'AXA' },
          { value: 'ALLIANZ Cameroun', label: 'ALLIANZ' },
          { value: 'SAHAM Assurance', label: 'SAHAM' },
          { value: 'NSIA Assurances', label: 'NSIA' },
          { value: 'SUNU Assurances', label: 'SUNU' },
          { value: 'CHANAS Assurance', label: 'CHANAS' },
          { value: 'UBA Assurance', label: 'UBA' },
          { value: 'ARO Assurance', label: 'ARO' },
          { value: 'Beneficial Life', label: 'Beneficial Life' },
          { value: 'Allianz', label: 'Allianz' },
          { value: 'AXA', label: 'AXA' },
          { value: 'Generali', label: 'Generali' },
        ],
      },
      {
        id: 'dureeContrat',
        label: 'Durée du contrat',
        type: 'select',
        options: [
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
          { value: '3 ans', label: '3 ans' },
          { value: '5 ans', label: '5 ans' },
          { value: '10 ans', label: '10 ans' },
          { value: '15 ans', label: '15 ans' },
          { value: '20 ans', label: '20 ans' },
        ],
      },
      {
        id: 'modePaiementAssurance',
        label: 'Mode de paiement',
        type: 'select',
        options: [
          { value: 'Mensuel', label: 'Mensuel' },
          { value: 'Trimestriel', label: 'Trimestriel' },
          { value: 'Semestriel', label: 'Semestriel' },
          { value: 'Annuel', label: 'Annuel' },
          { value: 'Paiement unique', label: 'Paiement unique' },
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
    displayPriority: ['typeAssuranceVie', 'produitAssurance', 'compagnieAssurance', 'primeAnnuelle'],
    contactMethods: ['message', 'phone', 'whatsapp'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🚚 DÉMÉNAGEMENT - REFONTE COMPLÈTE CONTEXTE AFRIQUE
  demenagement: {
    terminology: {
      productLabel: 'Service de déménagement',
      productsLabel: 'Services de déménagement',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Déménageur',
      searchPlaceholder: 'Rechercher un déménageur, trajet...',
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
          { value: 'Déménagement local (même ville)', label: 'Local (même ville)' },
          { value: 'Déménagement intercommunal', label: 'Intercommunal' },
          { value: 'Déménagement national', label: 'National' },
          { value: 'Déménagement international', label: 'International' },
          { value: 'Déménagement bureau/entreprise', label: 'Bureau/Entreprise' },
          { value: 'Déménagement express (24h)', label: 'Express (24h)' },
          { value: 'Garde-meubles sécurisé', label: 'Garde-meubles' },
        ],
      },
      {
        id: 'villeDepartDemenagement',
        label: 'Ville de départ',
        type: 'select',
        options: genererZonesIntervention('CM')
          .filter(z => !z.includes('────') && !z.includes('Toute l\'Afrique') && !z.includes('International'))
          .slice(0, 100)
          .map(z => ({ value: z, label: z }))
      },
      {
        id: 'villeArriveeDemenagement',
        label: 'Ville d\'arrivée',
        type: 'select',
        options: genererZonesIntervention('CM')
          .filter(z => !z.includes('────') && !z.includes('Toute l\'Afrique') && !z.includes('International'))
          .slice(0, 100)
          .map(z => ({ value: z, label: z }))
      },
      {
        id: 'trajetDemenagement',
        label: 'Trajet populaire',
        type: 'select',
        options: [
          // 🇨🇲 CAMEROUN
          { value: 'Douala → Yaoundé (250 km)', label: '🇨🇲 Douala → Yaoundé' },
          { value: 'Yaoundé → Douala (250 km)', label: '🇨🇲 Yaoundé → Douala' },
          { value: 'Douala → Bafoussam (280 km)', label: '🇨🇲 Douala → Bafoussam' },
          { value: 'Yaoundé → Bafoussam (290 km)', label: '🇨🇲 Yaoundé → Bafoussam' },
          { value: 'Douala → Kribi (150 km)', label: '🇨🇲 Douala → Kribi' },
          { value: 'Douala → Limbé (80 km)', label: '🇨🇲 Douala → Limbé' },
          { value: 'Yaoundé → Garoua (1165 km)', label: '🇨🇲 Yaoundé → Garoua' },
          { value: 'Douala → Bamenda (280 km)', label: '🇨🇲 Douala → Bamenda' },

          // 🇨🇮 CÔTE D'IVOIRE
          { value: 'Abidjan → Yamoussoukro (240 km)', label: '🇨🇮 Abidjan → Yamoussoukro' },
          { value: 'Abidjan → San-Pédro (350 km)', label: '🇨🇮 Abidjan → San-Pédro' },
          { value: 'Abidjan → Bouaké (340 km)', label: '🇨🇮 Abidjan → Bouaké' },

          // 🇸🇳 SÉNÉGAL
          { value: 'Dakar → Thiès (70 km)', label: '🇸🇳 Dakar → Thiès' },
          { value: 'Dakar → Saint-Louis (280 km)', label: '🇸🇳 Dakar → Saint-Louis' },
          { value: 'Dakar → Kaolack (200 km)', label: '🇸🇳 Dakar → Kaolack' },

          // 🇲🇱 MALI
          { value: 'Bamako → Sikasso (375 km)', label: '🇲🇱 Bamako → Sikasso' },
          { value: 'Bamako → Ségou (240 km)', label: '🇲🇱 Bamako → Ségou' },
          { value: 'Bamako → Tombouctou (900 km)', label: '🇲🇱 Bamako → Tombouctou' },

          // 🇬🇦 GABON
          { value: 'Libreville → Port-Gentil (350 km)', label: '🇬🇦 Libreville → Port-Gentil' },
          { value: 'Libreville → Franceville (650 km)', label: '🇬🇦 Libreville → Franceville' },

          // 🇨🇬 CONGO
          { value: 'Brazzaville → Pointe-Noire (550 km)', label: '🇨🇬 Brazzaville → Pointe-Noire' },

          // 🇨🇩 RDC
          { value: 'Kinshasa → Lubumbashi (1800 km)', label: '🇨🇩 Kinshasa → Lubumbashi' },
          { value: 'Kinshasa → Goma (1600 km)', label: '🇨🇩 Kinshasa → Goma' },

          // 🇲🇬 MADAGASCAR
          { value: 'Antananarivo → Toamasina (215 km)', label: '🇲🇬 Antananarivo → Toamasina' },
          { value: 'Antananarivo → Antsirabe (170 km)', label: '🇲🇬 Antananarivo → Antsirabe' },
        ],
      },
      {
        id: 'volumeDemenagement',
        label: 'Volume à déménager',
        type: 'select',
        options: [
          { value: 'Studio/Chambre simple (10-15m³)', label: 'Studio (10-15m³)' },
          { value: 'F1/1 pièce (15-20m³)', label: 'F1 (15-20m³)' },
          { value: 'F2/2 pièces (20-30m³)', label: 'F2 (20-30m³)' },
          { value: 'F3/3 pièces (30-40m³)', label: 'F3 (30-40m³)' },
          { value: 'F4/4 pièces (40-50m³)', label: 'F4 (40-50m³)' },
          { value: 'F5/5 pièces (50-60m³)', label: 'F5 (50-60m³)' },
          { value: 'Bureau petit (10-20m³)', label: 'Bureau petit' },
          { value: 'Bureau moyen (30-40m³)', label: 'Bureau moyen' },
          { value: 'Bureau grand (50-80m³)', label: 'Bureau grand' },
        ],
      },
      {
        id: 'typeVehiculeDemenagement',
        label: 'Type de véhicule',
        type: 'select',
        options: [
          { value: 'Camionnette 10m³ (petits trajets)', label: 'Camionnette 10m³' },
          { value: 'Camionnette 15m³', label: 'Camionnette 15m³' },
          { value: 'Camionnette 20m³', label: 'Camionnette 20m³' },
          { value: 'Camion 25m³', label: 'Camion 25m³' },
          { value: 'Camion 30m³', label: 'Camion 30m³' },
          { value: 'Camion 40m³', label: 'Camion 40m³' },
          { value: 'Camion 4x4 (routes difficiles)', label: 'Camion 4x4' },
        ],
      },
      {
        id: 'distanceDemenagement',
        label: 'Distance',
        type: 'select',
        options: [
          { value: 'Même quartier (moins de 5 km)', label: 'Même quartier' },
          { value: 'Ville proche (5-20 km)', label: 'Ville proche (5-20 km)' },
          { value: 'Intercommunal (20-50 km)', label: 'Intercommunal (20-50 km)' },
          { value: 'Régional (50-150 km)', label: 'Régional (50-150 km)' },
          { value: 'Longue distance (150-500 km)', label: 'Longue distance (150-500 km)' },
          { value: 'Très longue distance (500+ km)', label: 'Très longue distance (500+ km)' },
        ],
      },
      {
        id: 'compagnieDemenagement',
        label: 'Compagnie',
        type: 'select',
        options: [
          // 🇨🇲 CAMEROUN
          { value: 'Africa Déménagement Services', label: '🇨🇲 Africa Déménagement' },
          { value: 'Camtrans Déménagement', label: '🇨🇲 Camtrans' },
          { value: 'Express Déménagement Cameroun', label: '🇨🇲 Express Déménagement' },
          { value: 'Global Moving Cameroun', label: '🇨🇲 Global Moving' },
          { value: 'Move Masters Cameroun', label: '🇨🇲 Move Masters' },
          { value: 'Yukpomnang Moving', label: '🇨🇲 Yukpomnang Moving' },

          // 🇨🇮 CÔTE D'IVOIRE
          { value: 'Abidjan Transports Express', label: '🇨🇮 Abidjan Transports' },
          { value: 'Yopougon Déménagement', label: '🇨🇮 Yopougon Moving' },

          // 🇸🇳 SÉNÉGAL
          { value: 'Dakar Transports Rapides', label: '🇸🇳 Dakar Transports' },
          { value: 'Pikine Déménagement', label: '🇸🇳 Pikine Moving' },

          // 🇲🇱 MALI
          { value: 'Bamako Transports Express', label: '🇲🇱 Bamako Transports' },

          // 🇬🇦 GABON
          { value: 'Libreville Moving Express', label: '🇬🇦 Libreville Moving' },

          // 🇨🇬 CONGO
          { value: 'Brazzaville Moving Services', label: '🇨🇬 Brazzaville Moving' },

          // 🇨🇩 RDC
          { value: 'Kinshasa Moving Express', label: '🇨🇩 Kinshasa Moving' },

          // Génériques
          { value: 'Déménageur indépendant certifié', label: 'Indépendant certifié' },
          { value: 'Entreprise familiale agréée', label: 'Entreprise familiale' },
        ],
      },
      {
        id: 'servicesDemenagement',
        label: 'Services inclus',
        type: 'multiselect',
        options: [
          { value: 'Emballage professionnel', label: 'Emballage' },
          { value: 'Transport sécurisé', label: 'Transport' },
          { value: 'Déballage et installation', label: 'Déballage' },
          { value: 'Montage meubles', label: 'Montage' },
          { value: 'Démontage meubles', label: 'Démontage' },
          { value: 'Assurance tous risques', label: 'Assurance' },
          { value: 'Cartons fournis', label: 'Cartons' },
          { value: 'Monte-meubles (grue)', label: 'Monte-meubles' },
          { value: 'Piano et objets lourds', label: 'Objets lourds' },
        ],
      },
      {
        id: 'typeAssuranceDemenagement',
        label: 'Type d\'assurance',
        type: 'select',
        options: [
          { value: 'Assurance tous risques', label: 'Tous risques' },
          { value: 'Assurance de base (responsabilité civile)', label: 'Responsabilité civile' },
          { value: 'Assurance objets de valeur', label: 'Objets de valeur' },
          { value: 'Sans assurance', label: 'Sans assurance' },
        ],
      },
      {
        id: 'dureeDemenagement',
        label: 'Durée estimée',
        type: 'select',
        options: [
          { value: 'Moins de 2h', label: 'Moins de 2h' },
          { value: '2-4 heures', label: '2-4 heures' },
          { value: '4-6 heures', label: '4-6 heures' },
          { value: '1 journée', label: '1 journée' },
          { value: '2-3 jours', label: '2-3 jours' },
        ],
      },
      {
        id: 'disponibiliteDemenagement',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Immédiat (24-48h)', label: 'Immédiat (24-48h)' },
          { value: 'Cette semaine', label: 'Cette semaine' },
          { value: 'Semaine prochaine', label: 'Semaine prochaine' },
          { value: 'Flexible', label: 'Flexible' },
        ],
      },
      {
        id: 'nbDemenageurs',
        label: 'Nombre de déménageurs',
        type: 'select',
        options: [
          { value: '1 déménageur', label: '1 déménageur' },
          { value: '2 déménageurs', label: '2 déménageurs' },
          { value: '3 déménageurs', label: '3 déménageurs' },
          { value: '4-5 déménageurs', label: '4-5 déménageurs' },
          { value: '6+ déménageurs (grande équipe)', label: '6+ déménageurs' },
        ],
      },
    ],
    style: {
      primaryColor: '#F97316',
      gradientColors: ['#F97316', '#EA580C'],
      icon: '🚚',
      badgeColor: '#FFEDD5',
      accentColor: '#EA580C',
    },
    displayPriority: ['trajetDemenagement', 'typeDemenagement', 'volumeDemenagement', 'compagnieDemenagement', 'typeVehiculeDemenagement', 'servicesDemenagement', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // ✨ COSMÉTIQUE & PARFUM - 🌍 ENRICHI CONTEXTE AFRIQUE FRANCOPHONE
  cosmetique_parfum: {
    terminology: {
      productLabel: 'Produit cosmétique',
      productsLabel: 'Cosmétiques & Parfums',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher cosmétiques, parfums, maquillage...',
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
        id: 'types',
        label: 'Type de produit',
        type: 'select',
        options: [
          // Parfums & Fragrances
          { value: 'Parfum', label: 'Parfum' },
          { value: 'Eau de parfum (EDP)', label: 'Eau de parfum (EDP)' },
          { value: 'Eau de toilette (EDT)', label: 'Eau de toilette' },
          { value: 'Déodorant', label: 'Déodorant' },
          { value: 'Déodorant spray', label: 'Déodorant spray' },
          // Soins Visage
          { value: 'Crème visage', label: 'Crème visage' },
          { value: 'Crème hydratante', label: 'Crème hydratante' },
          { value: 'Crème anti-âge', label: 'Crème anti-âge' },
          { value: 'Crème éclaircissante', label: 'Crème éclaircissante' },
          { value: 'Sérum visage', label: 'Sérum visage' },
          { value: 'Eau micellaire', label: 'Eau micellaire' },
          // Soins Corps
          { value: 'Lait corporel', label: 'Lait corporel' },
          { value: 'Crème corps', label: 'Crème corps' },
          { value: 'Gel douche', label: 'Gel douche' },
          { value: 'Savon', label: 'Savon' },
          // Soins Cheveux
          { value: 'Shampoing', label: 'Shampoing' },
          { value: 'Masque cheveux', label: 'Masque cheveux' },
          { value: 'Huile capillaire', label: 'Huile capillaire' },
          // Maquillage
          { value: 'Fond de teint', label: 'Fond de teint' },
          { value: 'Poudre compacte', label: 'Poudre' },
          { value: 'Mascara', label: 'Mascara' },
          { value: 'Rouge à lèvres', label: 'Rouge à lèvres' },
        ],
      },
      {
        id: 'marques',
        label: 'Marque',
        type: 'select',
        options: [
          // Marques Populaires Afrique
          { value: 'Nivea', label: 'Nivea' },
          { value: 'L\'Oréal', label: 'L\'Oréal' },
          { value: 'Garnier', label: 'Garnier' },
          { value: 'Dove', label: 'Dove' },
          { value: 'Vaseline', label: 'Vaseline' },
          // Marques Éclaircissantes (Très populaires)
          { value: 'Fair & White', label: 'Fair & White' },
          { value: 'White Secret', label: 'White Secret' },
          { value: 'Makari', label: 'Makari' },
          { value: 'Caro White', label: 'Caro White' },
          { value: 'Carotone', label: 'Carotone' },
          // Marques Capillaires Afro
          { value: 'Dark and Lovely', label: 'Dark and Lovely' },
          { value: 'Cantu', label: 'Cantu' },
          { value: 'ORS', label: 'ORS' },
          // Marques Milieu de Gamme
          { value: 'Maybelline', label: 'Maybelline' },
          { value: 'Revlon', label: 'Revlon' },
          { value: 'The Ordinary', label: 'The Ordinary' },
          { value: 'CeraVe', label: 'CeraVe' },
          // Marques Luxe
          { value: 'Chanel', label: 'Chanel' },
          { value: 'Dior', label: 'Dior' },
          { value: 'Yves Saint Laurent', label: 'YSL' },
          { value: 'Guerlain', label: 'Guerlain' },
          { value: 'MAC', label: 'MAC' },
        ],
      },
      {
        id: 'genres',
        label: 'Genre',
        type: 'select',
        options: [
          { value: 'Femme', label: 'Femme' },
          { value: 'Homme', label: 'Homme' },
          { value: 'Mixte/Unisexe', label: 'Mixte/Unisexe' },
          { value: 'Enfant', label: 'Enfant' },
          { value: 'Bébé', label: 'Bébé' },
        ],
      },
      {
        id: 'types_peau',
        label: 'Type de peau',
        type: 'select',
        options: [
          { value: 'Tous types de peau', label: 'Tous types' },
          { value: 'Peau normale', label: 'Normale' },
          { value: 'Peau sèche', label: 'Sèche' },
          { value: 'Peau grasse', label: 'Grasse' },
          { value: 'Peau mixte', label: 'Mixte' },
          { value: 'Peau sensible', label: 'Sensible' },
          { value: 'Peau acnéique', label: 'Acnéique' },
          { value: 'Peau noire/métissée', label: 'Peau noire/métissée' },
        ],
      },
      {
        id: 'types_cheveux',
        label: 'Type de cheveux',
        type: 'select',
        options: [
          { value: 'Tous types', label: 'Tous types' },
          { value: 'Cheveux crépus', label: 'Crépus' },
          { value: 'Cheveux bouclés', label: 'Bouclés' },
          { value: 'Cheveux lisses', label: 'Lisses' },
          { value: 'Cheveux secs', label: 'Secs' },
          { value: 'Cheveux gras', label: 'Gras' },
          { value: 'Cheveux abîmés', label: 'Abîmés' },
        ],
      },
      {
        id: 'concentrations',
        label: 'Concentration (Parfums)',
        type: 'select',
        options: [
          { value: 'Eau de Cologne (EDC) 2-5%', label: 'Cologne (EDC)' },
          { value: 'Eau de toilette (EDT) 5-15%', label: 'Toilette (EDT)' },
          { value: 'Eau de parfum (EDP) 15-20%', label: 'Parfum (EDP)' },
          { value: 'Parfum/Extrait 20-40%', label: 'Extrait de parfum' },
          { value: 'Sans alcool', label: 'Sans alcool' },
        ],
      },
      {
        id: 'finitions',
        label: 'Finition (Maquillage)',
        type: 'select',
        options: [
          { value: 'Mat', label: 'Mat' },
          { value: 'Satiné', label: 'Satiné' },
          { value: 'Brillant', label: 'Brillant' },
          { value: 'Longue tenue', label: 'Longue tenue' },
          { value: 'Waterproof', label: 'Waterproof' },
        ],
      },
      {
        id: 'teintes',
        label: 'Teinte (Maquillage)',
        type: 'select',
        options: [
          { value: 'Très clair', label: 'Très clair' },
          { value: 'Clair', label: 'Clair' },
          { value: 'Moyen', label: 'Moyen' },
          { value: 'Moyen foncé', label: 'Moyen foncé' },
          { value: 'Foncé', label: 'Foncé' },
          { value: 'Très foncé', label: 'Très foncé' },
          { value: 'Caramel', label: 'Caramel' },
          { value: 'Chocolat', label: 'Chocolat' },
        ],
      },
      {
        id: 'origines',
        label: 'Origine',
        type: 'select',
        options: [
          { value: 'France', label: 'France' },
          { value: 'États-Unis', label: 'USA' },
          { value: 'Royaume-Uni', label: 'Royaume-Uni' },
          { value: 'Cameroun', label: 'Cameroun' },
          { value: 'Côte d\'Ivoire', label: 'Côte d\'Ivoire' },
          { value: 'Maroc', label: 'Maroc' },
          { value: 'Afrique du Sud', label: 'Afrique du Sud' },
        ],
      },
      {
        id: 'certifications',
        label: 'Certification',
        type: 'multiselect',
        options: [
          { value: 'Bio', label: 'Bio' },
          { value: 'Vegan', label: 'Vegan' },
          { value: 'Cruelty-free', label: 'Cruelty-free' },
          { value: 'Sans parabènes', label: 'Sans parabènes' },
          { value: 'Sans sulfates', label: 'Sans sulfates' },
          { value: 'Dermatologiquement testé', label: 'Testé dermatologiquement' },
        ],
      },
      {
        id: 'unites',
        label: 'Volume',
        type: 'select',
        options: [
          { value: '30ml', label: '30 ml' },
          { value: '50ml', label: '50 ml' },
          { value: '75ml', label: '75 ml' },
          { value: '100ml', label: '100 ml' },
          { value: '150ml', label: '150 ml' },
          { value: '200ml', label: '200 ml' },
          { value: '500ml', label: '500 ml' },
          { value: '1L', label: '1 Litre' },
        ],
      },
      {
        id: 'prix_min',
        label: 'Prix minimum',
        type: 'range',
        min: 0,
        max: 200000,
        unit: 'FCFA',
      },
      {
        id: 'prix_max',
        label: 'Prix maximum',
        type: 'range',
        min: 0,
        max: 200000,
        unit: 'FCFA',
      },
    ],
    style: {
      primaryColor: '#E91E63',
      gradientColors: ['#E91E63', '#C2185B'],
      icon: '✨',
      badgeColor: '#FCE4EC',
      accentColor: '#C2185B',
    },
    displayPriority: ['types', 'marques', 'genres', 'types_peau', 'unites', 'origines', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    supportsVariants: true,
    searchKeywords: [
      // ═══ MOTS-CLÉS CAMEROUN ═══
      'parfum Douala', 'cosmétique Douala', 'maquillage Douala',
      'parfum Yaoundé', 'cosmétique Yaoundé', 'crème éclaircissante Cameroun',
      'Fair & White Cameroun', 'Makari Cameroun', 'White Secret Douala',
      'shampoing afro Cameroun', 'crème défrisante Douala',
      // ═══ MOTS-CLÉS AFRIQUE FRANCOPHONE ═══
      'parfum Côte d\'Ivoire', 'cosmétique Abidjan', 'parfum Sénégal',
      'cosmétique Dakar', 'maquillage Afrique', 'beauté Afrique',
      'crème éclaircissante', 'huile capillaire africaine',
      'produit capillaires afro', 'cosmétique locale Afrique',
    ],
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

  // 🔨 FORGERON / FERRONNERIE D'ART - 🌍 AFRIQUE FRANCOPHONE
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
      // ✅ FILTRE 1 : Types de réalisations (le plus important)
      {
        id: 'typeRealisation',
        label: 'Type de réalisation',
        type: 'multiselect',
        options: [
          // Sécurité
          { value: 'grille_fenetre', label: '🔒 Grilles de fenêtre anti-vol' },
          { value: 'grille_porte', label: '🔒 Grilles de porte anti-vol' },
          { value: 'barreaux_securite', label: '🔒 Barreaux de sécurité' },
          { value: 'rideau_metallique', label: '🔒 Rideau métallique' },
          { value: 'porte_blindee', label: '🔒 Porte blindée' },
          // Portails
          { value: 'portail_coulissant', label: '🚪 Portail coulissant' },
          { value: 'portail_battant', label: '🚪 Portail battant' },
          { value: 'portail_motorise', label: '🚪 Portail motorisé' },
          { value: 'portillon', label: '🚪 Portillon / Porte piétonne' },
          // Balcons & Garde-corps
          { value: 'garde_corps_balcon', label: '🏠 Garde-corps de balcon' },
          { value: 'rampe_escalier', label: '🏠 Rampe d\'escalier' },
          { value: 'balustrade', label: '🏠 Balustrade décorative' },
          // Clôtures
          { value: 'cloture_fer', label: '🏗️ Clôture en fer forgé' },
          { value: 'grillage', label: '🏗️ Grillage rigide/souple' },
          // Décoration
          { value: 'pergola', label: '🎨 Pergola métallique' },
          { value: 'marquise', label: '🎨 Marquise de porte' },
          { value: 'mobilier_fer', label: '🪑 Mobilier en fer forgé' },
        ],
      },
      // ✅ FILTRE 2 : Matériaux
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
      // ✅ FILTRE 3 : Style
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
      // ✅ FILTRE 4 : Finition
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
      // ✅ FILTRE 5 : Délais de réalisation
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
      // ✅ FILTRE 6 : Garantie
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
      // ✅ FILTRE 7 : Services inclus
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
      // ✅ FILTRE 8 : Motorisation (pour portails)
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
      // ✅ FILTRE 9 : Certifications
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
      // ✅ FILTRE 10 : Types de clients
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
      // ✅ FILTRE 11 : Motorisation disponible (toggle)
      {
        id: 'motorisationDisponible',
        label: 'Motorisation de portail disponible',
        type: 'toggle',
      },
      // ✅ FILTRE 12 : Devis gratuit (toggle)
      {
        id: 'devisGratuit',
        label: 'Devis et étude gratuits',
        type: 'toggle',
      },
      // ✅ FILTRE 13 : Installation incluse (toggle)
      {
        id: 'installationIncluse',
        label: 'Installation et pose incluses',
        type: 'toggle',
      },
      // ✅ FILTRE 14 : Paiement échelonné (toggle)
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
    contactMethods: ['whatsapp', 'phone', 'message'],
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

  // 🪟 MENUISIER ALUMINIUM - ✅ ENRICHI AFRIQUE FRANCOPHONE
  menuisier_aluminium: {
    terminology: {
      productLabel: 'Réalisation',
      productsLabel: 'Menuisier Aluminium',
      priceLabel: 'Tarif',
      locationLabel: 'Atelier',
      providerLabel: 'Menuisier Alu / Artisan',
      searchPlaceholder: 'Rechercher menuisier alu (fenêtres, baies vitrées, vitrines...)...',
      emptyMessage: 'Aucun menuisier aluminium disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },

    // ✅ 15 FILTRES INTELLIGENTS
    filters: [
      // Filtre 1: Type de réalisation (multiselect)
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

      // Filtre 8: Services inclus (multiselect)
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

      // Filtre 9: Options disponibles (multiselect)
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

      // Filtre 10: Certifications (multiselect)
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

      // Filtre 12: Motorisation disponible (toggle)
      {
        id: 'motorisationDisponible',
        label: 'Motorisation disponible',
        type: 'toggle',
      },

      // Filtre 13: Devis gratuit (toggle)
      {
        id: 'devisGratuit',
        label: 'Devis gratuit',
        type: 'toggle',
      },

      // Filtre 14: Installation incluse (toggle)
      {
        id: 'installationIncluse',
        label: 'Installation incluse',
        type: 'toggle',
      },

      // Filtre 15: Paiement échelonné (toggle)
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

    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical', // Layout vertical optimal pour services

    // ✅ MOTS-CLÉS EXCLUSIFS (100+) - Différenciation ALUMINIUM vs BOIS vs FORGERON vs VITRERIE
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

  // 💇‍♀️ COIFFURE & BEAUTÉ - 🌍 ENRICHI CONTEXTE AFRIQUE
  coiffure_beaute: {
    terminology: {
      productLabel: 'Article de coiffure',
      productsLabel: 'Coiffure & Beauté',
      priceLabel: 'Prix',
      locationLabel: 'Boutique/Salon',
      providerLabel: 'Vendeur/Coiffeur',
      searchPlaceholder: 'Rechercher mèches, tresses, extensions, salon...',
      emptyMessage: 'Aucun article/service de coiffure disponible',
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
          // 💇‍♀️ PRODUITS
          { value: '🌟 Mèches naturelles', label: '🌟 Mèches naturelles' },
          { value: 'Extensions (tissage)', label: 'Extensions (tissage)' },
          { value: 'Extensions (clips)', label: 'Extensions (clips)' },
          { value: 'Perruque complète', label: 'Perruque complète' },
          { value: 'Closure 4x4', label: 'Closure 4x4' },
          { value: 'Frontal 13x4', label: 'Frontal 13x4' },
          { value: 'Lace wig', label: 'Lace wig' },

          // 💇‍♀️ SERVICES FEMME
          { value: '🌟 Tresses africaines (box braids)', label: '🌟 Tresses africaines (box braids)' },
          { value: 'Nattes collées (cornrows)', label: 'Nattes collées (cornrows)' },
          { value: 'Vanilles (twists)', label: 'Vanilles (twists)' },
          { value: 'Tresses sénégalaises', label: 'Tresses sénégalaises' },
          { value: 'Défrisage complet', label: 'Défrisage complet' },
          { value: 'Lissage brésilien/japonais', label: 'Lissage brésilien/japonais' },
          { value: 'Coloration complète', label: 'Coloration' },
          { value: 'Coupe femme', label: 'Coupe femme' },
          { value: 'Locks/Dreadlocks', label: 'Locks/Dreadlocks' },

          // 🧔 SERVICES HOMME (BARBIER)
          { value: '🌟 Coupe homme (dégradé)', label: '🌟 Coupe homme (dégradé)' },
          { value: 'Coupe afro (fade)', label: 'Coupe afro (fade)' },
          { value: 'Coupe + Barbe', label: 'Coupe + Barbe' },
          { value: 'Taille de barbe', label: 'Taille de barbe' },
          { value: 'Rasage complet', label: 'Rasage' },
          { value: 'Design capillaire (motifs)', label: 'Design capillaire' },

          // 💅 BEAUTÉ
          { value: 'Manucure simple', label: 'Manucure' },
          { value: 'Pédicure simple', label: 'Pédicure' },
          { value: 'Maquillage jour', label: 'Maquillage' },
          { value: 'Soin visage complet', label: 'Soin visage' },

          // 🧴 PRODUITS
          { value: 'Shampooing professionnel', label: 'Shampooing' },
          { value: 'Huile capillaire (karité, coco, argan)', label: 'Huile capillaire' },
          { value: 'Crème défrisante', label: 'Crème défrisante' },
        ],
      },
      {
        id: 'longueurMech',
        label: 'Longueur',
        type: 'select',
        options: [
          { value: '10-12 pouces (25-30cm)', label: '10-12" (25-30cm) Court' },
          { value: '14-16 pouces (35-40cm)', label: '14-16" (35-40cm) Moyen' },
          { value: '18-20 pouces (45-50cm)', label: '🔥 18-20" (45-50cm) Standard' },
          { value: '22-24 pouces (55-60cm)', label: '22-24" (55-60cm) Long' },
          { value: '26-28 pouces (65-70cm)', label: '26-28" (65-70cm) Très long' },
          { value: '30 pouces+ (75cm+)', label: '30"+ (75cm+) Extra long' },
        ],
      },
      {
        id: 'textureMech',
        label: 'Texture',
        type: 'select',
        options: [
          // 🌍 TEXTURES AFRICAINES
          { value: 'Afro kinky (4C)', label: 'Afro kinky (4C) 🇨🇲' },
          { value: 'Kinky curly (4A/4B)', label: 'Kinky curly (4A/4B)' },
          { value: 'Curly (3C)', label: 'Curly (3C)' },

          // ✨ LISSES
          { value: 'Straight (lisse)', label: 'Straight (lisse)' },
          { value: 'Yaki straight (lisse texturé)', label: 'Yaki straight' },

          // 🌊 ONDULÉES
          { value: 'Body wave (ondulations douces)', label: '🔥 Body wave' },
          { value: 'Deep wave (ondulations profondes)', label: 'Deep wave' },
          { value: 'Water wave (ondulations naturelles)', label: 'Water wave' },

          // 💫 BOUCLÉES
          { value: 'Curly (bouclée)', label: 'Curly (bouclée)' },
          { value: 'Deep curly (très bouclée)', label: 'Deep curly' },
          { value: 'Kinky curly (afro bouclée)', label: 'Kinky curly' },
        ],
      },
      {
        id: 'typeCheveux',
        label: 'Type de cheveux',
        type: 'select',
        options: [
          // 🌟 NATURELS
          { value: 'Virgin hair (vierge 100%)', label: 'Virgin hair (vierge 100%)' },
          { value: 'Remy hair (cuticules alignées)', label: 'Remy hair' },
          { value: 'Brazilian hair (brésilien)', label: '🔥 Brazilian hair' },
          { value: 'Peruvian hair (péruvien)', label: 'Peruvian hair' },
          { value: 'Indian hair (indien)', label: 'Indian hair' },

          // 🎨 SYNTHÉTIQUES
          { value: 'Cheveux synthétiques premium', label: 'Synthétique premium' },
          { value: 'Kanekalon (tresses africaines)', label: '🔥 Kanekalon (tresses)' },
          { value: 'X-pression (tresses)', label: 'X-pression (tresses)' },

          // 🌈 AUTRES
          { value: 'Cheveux mixtes (naturel + synthétique)', label: 'Mixte' },
        ],
      },
      {
        id: 'origineMech',
        label: 'Origine',
        type: 'select',
        options: [
          { value: 'Brésilien', label: '🔥 Brésilien' },
          { value: 'Péruvien', label: 'Péruvien' },
          { value: 'Indien', label: 'Indien' },
          { value: 'Malaisien', label: 'Malaisien' },
          { value: 'Cambodgien', label: 'Cambodgien' },
          { value: 'Synthétique (Kanekalon)', label: 'Kanekalon (synthétique)' },
          { value: 'Synthétique (X-pression)', label: 'X-pression (synthétique)' },
        ],
      },
      {
        id: 'marqueCoiffure',
        label: 'Marque',
        type: 'select',
        options: [
          // 🌍 MARQUES AFRICAINES
          { value: 'Darling (Nigeria)', label: '🇨🇲 Darling (Nigeria)' },
          { value: 'X-pression (tresses)', label: 'X-pression' },
          { value: 'Kanekalon', label: 'Kanekalon' },

          // 🌟 MARQUES INTERNATIONALES AFRIQUE
          { value: 'Dark & Lovely', label: 'Dark & Lovely' },
          { value: 'Cantu', label: 'Cantu' },
          { value: 'Shea Moisture', label: 'Shea Moisture' },
          { value: 'Africa\'s Best', label: 'Africa\'s Best' },
          { value: 'Olive Oil (ORS)', label: 'Olive Oil (ORS)' },

          // 💎 PREMIUM
          { value: 'Sensationnel', label: 'Sensationnel' },
          { value: 'Outre', label: 'Outre' },
          { value: 'Freetress', label: 'Freetress' },
        ],
      },
      {
        id: 'couleurMech',
        label: 'Couleur',
        type: 'select',
        options: [
          { value: 'Noir naturel (1B)', label: '🔥 Noir naturel (1B)' },
          { value: 'Noir pur (Jet black 1)', label: 'Noir pur (1)' },
          { value: 'Brun très foncé (2)', label: 'Brun très foncé (2)' },
          { value: 'Brun foncé (4)', label: 'Brun foncé (4)' },
          { value: 'Brun moyen (6)', label: 'Brun moyen (6)' },
          { value: 'Châtain (10)', label: 'Châtain (10)' },
          { value: 'Blond moyen (14)', label: 'Blond moyen (14)' },
          { value: 'Blond platine (613)', label: 'Blond platine (613)' },
          { value: 'Ombré noir/brun', label: 'Ombré noir/brun' },
          { value: 'Ombré noir/blond', label: 'Ombré noir/blond' },
          { value: 'Balayage caramel', label: 'Balayage caramel' },
          { value: 'Bordeaux/Vin', label: 'Bordeaux/Vin' },
        ],
      },
      {
        id: 'typePose',
        label: 'Type de pose',
        type: 'select',
        options: [
          { value: 'Tissage cousu (sew-in)', label: '🇨🇲 Tissage cousu' },
          { value: 'Tresse africaine (crochet)', label: '🔥 Crochet (tresses)' },
          { value: 'Clip-in (amovible)', label: 'Clip-in (amovible)' },
          { value: 'Bonding (colle)', label: 'Bonding (colle)' },
          { value: 'Lace closure (collage/couture)', label: 'Lace closure' },
          { value: 'Lace frontal (collage)', label: 'Lace frontal' },
          { value: 'Perruque lace front', label: 'Perruque lace front' },
        ],
      },
      {
        id: 'dureeVie',
        label: 'Durée de vie',
        type: 'select',
        options: [
          { value: '1-2 mois (synthétique tresses)', label: '1-2 mois (synthétique)' },
          { value: '3-6 mois (naturel entretien moyen)', label: '🔥 3-6 mois (naturel)' },
          { value: '6-12 mois (naturel bien entretenu)', label: '6-12 mois' },
          { value: '1-2 ans (virgin hair premium)', label: '1-2 ans (premium)' },
        ],
      },
      {
        id: 'densiteMech',
        label: 'Densité',
        type: 'select',
        options: [
          { value: '130% (naturelle légère)', label: '130% (légère)' },
          { value: '150% (naturelle moyenne)', label: '🔥 150% (standard)' },
          { value: '180% (volumineuse)', label: '180% (volumineuse)' },
          { value: '200% (très volumineuse)', label: '200%' },
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
    displayPriority: ['typeCoiffure', 'longueurMech', 'typeCheveux', 'origineMech', 'couleurMech', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🪡 COUTURIER - 🌍 CONTEXTE AFRIQUE FRANCOPHONE
  couturier: {
    terminology: {
      productLabel: 'Service de couture',
      productsLabel: 'Couture & Confection',
      priceLabel: 'Tarif',
      locationLabel: 'Atelier',
      providerLabel: 'Couturier/ière',
      searchPlaceholder: 'Rechercher couturier, tailleur, confection, retouche...',
      emptyMessage: 'Aucun service de couture disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeCouture',
        label: 'Type de service',
        type: 'select',
        options: [
          // 🪡 CONFECTION SUR MESURE
          { value: '🌟 Robe sur mesure', label: '🌟 Robe sur mesure' },
          { value: '🌟 Costume/Tailleur sur mesure', label: '🌟 Costume/Tailleur' },
          { value: '🌟 Boubou/Kaftan sur mesure', label: '🌟 Boubou/Kaftan' },
          { value: 'Robe de mariée complète', label: 'Robe de mariée' },
          { value: 'Robe de soirée sur mesure', label: 'Robe de soirée' },
          { value: 'Ensemble pagne complet', label: 'Ensemble pagne' },
          { value: 'Chemise/Chemisier sur mesure', label: 'Chemise/Chemisier' },
          { value: 'Pantalon/Jupe sur mesure', label: 'Pantalon/Jupe' },

          // 👔 TENUES AFRICAINES
          { value: '🌟 Boubou grand bazin', label: 'Boubou grand bazin' },
          { value: '🌟 Agbada (3 pièces)', label: 'Agbada (3 pièces)' },
          { value: 'Dashiki sur mesure', label: 'Dashiki' },
          { value: 'Kaftan brodé', label: 'Kaftan brodé' },
          { value: 'Ensemble wax complet', label: 'Ensemble wax' },
          { value: 'Robe africaine moderne', label: 'Robe africaine moderne' },

          // ✂️ RETOUCHES
          { value: 'Retouche simple (ourlet, taille)', label: 'Retouche simple' },
          { value: 'Retouche complexe (transformation)', label: 'Retouche complexe' },
          { value: 'Ajustement taille/longueur', label: 'Ajustement' },

          // 🎨 BRODERIE
          { value: 'Broderie main traditionnelle', label: 'Broderie main' },
          { value: 'Broderie machine', label: 'Broderie machine' },
          { value: 'Broderie perles', label: 'Broderie perles' },
        ],
      },
      {
        id: 'tissuCouture',
        label: 'Tissu',
        type: 'select',
        options: [
          // 🌟 TISSUS AFRICAINS
          { value: '🌟 Bazin riche (brodé)', label: '🌟 Bazin riche (brodé)' },
          { value: '🌟 Bazin riche (uni)', label: 'Bazin riche (uni)' },
          { value: '🌟 Wax hollandais (Vlisco)', label: '🌟 Wax hollandais (Vlisco)' },
          { value: '🌟 Super wax (premium)', label: 'Super wax' },
          { value: 'Wax classique', label: 'Wax classique' },
          { value: 'Fancy print (java)', label: 'Fancy print' },
          { value: 'Pagne traditionnel', label: 'Pagne traditionnel' },
          { value: 'Kente (Ghana)', label: 'Kente (Ghana)' },
          { value: 'Ankara (imprimé africain)', label: 'Ankara' },

          // 👔 TISSUS CLASSIQUES
          { value: 'Coton', label: 'Coton' },
          { value: 'Lin', label: 'Lin' },
          { value: 'Soie', label: 'Soie' },
          { value: 'Satin', label: 'Satin' },
          { value: 'Dentelle', label: 'Dentelle' },
          { value: 'Velours', label: 'Velours' },
          { value: 'Mousseline', label: 'Mousseline' },
          { value: 'Laine', label: 'Laine' },
        ],
      },
      {
        id: 'styleCouture',
        label: 'Style',
        type: 'select',
        options: [
          // Africain
          { value: '🌟 Traditionnel africain', label: '🌟 Traditionnel africain' },
          { value: '🌟 Afro-fusion (moderne)', label: '🌟 Afro-fusion' },
          { value: 'Wax moderne chic', label: 'Wax moderne chic' },
          { value: 'Pagne élégant', label: 'Pagne élégant' },

          // Occidental
          { value: 'Classique', label: 'Classique' },
          { value: 'Moderne', label: 'Moderne' },
          { value: 'Chic/Élégant', label: 'Chic/Élégant' },
          { value: 'Formel', label: 'Formel' },
          { value: 'Business', label: 'Business' },
          { value: 'Soirée/Glamour', label: 'Soirée/Glamour' },
          { value: 'Haute couture', label: 'Haute couture' },
        ],
      },
      {
        id: 'genreCouture',
        label: 'Genre',
        type: 'select',
        options: [
          { value: 'Femme', label: 'Femme' },
          { value: 'Homme', label: 'Homme' },
          { value: 'Enfant (fille)', label: 'Enfant (fille)' },
          { value: 'Enfant (garçon)', label: 'Enfant (garçon)' },
          { value: 'Bébé', label: 'Bébé' },
          { value: 'Unisexe', label: 'Unisexe' },
          { value: 'Couple assorti', label: 'Couple assorti' },
          { value: 'Famille assortie', label: 'Famille assortie' },
        ],
      },
      {
        id: 'occasionCouture',
        label: 'Occasion',
        type: 'select',
        options: [
          // Mariages
          { value: '🌟 Mariage (mariée)', label: '🌟 Mariage (mariée)' },
          { value: '🌟 Mariage (marié)', label: '🌟 Mariage (marié)' },
          { value: 'Mariage traditionnel', label: 'Mariage traditionnel' },
          { value: 'Dot (cérémonie)', label: 'Dot (cérémonie)' },
          { value: 'Demoiselle d\'honneur', label: 'Demoiselle d\'honneur' },

          // Événements
          { value: 'Soirée/Gala', label: 'Soirée/Gala' },
          { value: 'Cocktail', label: 'Cocktail' },
          { value: 'Cérémonie officielle', label: 'Cérémonie officielle' },
          { value: 'Baptême', label: 'Baptême' },
          { value: 'Anniversaire', label: 'Anniversaire' },

          // Quotidien
          { value: 'Travail/Bureau', label: 'Travail/Bureau' },
          { value: 'Quotidien/Casual', label: 'Quotidien' },
          { value: 'Église/Mosquée', label: 'Église/Mosquée' },
        ],
      },
      {
        id: 'delaiCouture',
        label: 'Délai',
        type: 'select',
        options: [
          { value: '⚡ Express (24-48h)', label: '⚡ Express (24-48h)' },
          { value: 'Rapide (3-5 jours)', label: 'Rapide (3-5 jours)' },
          { value: 'Standard (1-2 semaines)', label: 'Standard (1-2 semaines)' },
          { value: 'Normal (2-3 semaines)', label: 'Normal (2-3 semaines)' },
          { value: 'Sur-mesure complet (3-4 semaines)', label: 'Sur-mesure (3-4 semaines)' },
          { value: 'Robe de mariée (4-8 semaines)', label: 'Robe de mariée (4-8 semaines)' },
        ],
      },
      {
        id: 'specialiteCouturier',
        label: 'Spécialité',
        type: 'select',
        options: [
          // Vêtements
          { value: 'Spécialiste robes', label: 'Spécialiste robes' },
          { value: 'Spécialiste costumes homme', label: 'Spécialiste costumes' },
          { value: 'Spécialiste robes de mariée', label: 'Spécialiste mariée' },
          { value: 'Spécialiste vêtements enfants', label: 'Spécialiste enfants' },

          // Africain
          { value: '🌟 Spécialiste tenues africaines', label: '🌟 Tenues africaines' },
          { value: '🌟 Spécialiste bazin', label: '🌟 Spécialiste bazin' },
          { value: 'Spécialiste wax/pagne', label: 'Spécialiste wax/pagne' },
          { value: 'Spécialiste boubou', label: 'Spécialiste boubou' },

          // Techniques
          { value: 'Spécialiste broderie', label: 'Spécialiste broderie' },
          { value: 'Spécialiste retouches', label: 'Spécialiste retouches' },
          { value: 'Couturier polyvalent', label: 'Polyvalent' },
        ],
      },
      {
        id: 'experienceCouturier',
        label: 'Expérience',
        type: 'select',
        options: [
          { value: 'Couturier débutant (1-2 ans)', label: 'Débutant (1-2 ans)' },
          { value: 'Couturier confirmé (3-5 ans)', label: 'Confirmé (3-5 ans)' },
          { value: 'Couturier expérimenté (5-10 ans)', label: 'Expérimenté (5-10 ans)' },
          { value: 'Maître couturier (10+ ans)', label: 'Maître couturier (10+ ans)' },
          { value: 'Atelier professionnel', label: 'Atelier professionnel' },
          { value: 'Haute couture', label: 'Haute couture' },
        ],
      },
      {
        id: 'finitionCouture',
        label: 'Finition',
        type: 'select',
        options: [
          { value: '🌟 Haute couture', label: '🌟 Haute couture' },
          { value: 'Finition soignée (premium)', label: 'Finition soignée' },
          { value: 'Finition standard', label: 'Finition standard' },
          { value: 'Avec doublure complète', label: 'Avec doublure' },
          { value: 'Broderie main', label: 'Broderie main' },
          { value: 'Broderie machine', label: 'Broderie machine' },
          { value: 'Perles/Ornements', label: 'Perles/Ornements' },
        ],
      },
      {
        id: 'lieuTravailCouturier',
        label: 'Lieu de travail',
        type: 'select',
        options: [
          { value: 'Atelier professionnel', label: 'Atelier professionnel' },
          { value: 'Domicile (atelier maison)', label: 'Domicile' },
          { value: 'Marché/Centre commercial', label: 'Marché/Centre commercial' },
          { value: 'À domicile client (déplacement)', label: 'À domicile client' },
          { value: 'Mobile (sur rendez-vous)', label: 'Mobile' },
        ],
      },
    ],
    style: {
      primaryColor: '#9C27B0',
      gradientColors: ['#9C27B0', '#7B1FA2'],
      icon: '🪡',
      badgeColor: '#F3E5F5',
      accentColor: '#7B1FA2',
    },
    displayPriority: ['typeCouture', 'tissuCouture', 'styleCouture', 'occasionCouture', 'specialiteCouturier', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    supportsVariants: false,
    searchKeywords: [
      // Termes français
      'couturier', 'couturière', 'tailleur', 'confection', 'couture', 'retouche',
      'modiste', 'styliste', 'broderie', 'bazir', 'broder',

      // Termes africains locaux
      'boubou', 'agbada', 'kaftan', 'bazin', 'wax', 'pagne', 'ankara',
      'dashiki', 'kente', 'super wax', 'fancy print',

      // Occasions
      'mariage', 'dot', 'mariée', 'marié', 'cérémonie', 'fête', 'baptême',

      // Services
      'robe sur mesure', 'costume sur mesure', 'robes africaines', 'tenues traditionnelles',
      'mode africaine', 'couture africaine'
    ],
  },

  // 🏨 HÔTELLERIE
  hotellerie: {
    terminology: {
      productLabel: 'Établissement',
      productsLabel: 'Hôtellerie & Hébergement',
      priceLabel: 'Prix/nuit',
      locationLabel: 'Adresse',
      providerLabel: 'Hôtel',
      searchPlaceholder: 'Rechercher hôtel, chambre d\'hôtes, auberge...',
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
        id: 'ville',
        label: 'Ville',
        type: 'select',
        options: [
          { value: 'Douala', label: 'Douala' },
          { value: 'Yaoundé', label: 'Yaoundé' },
          { value: 'Kribi', label: 'Kribi' },
          { value: 'Limbe', label: 'Limbe' },
          { value: 'Garoua', label: 'Garoua' },
          { value: 'Bafoussam', label: 'Bafoussam' },
          { value: 'Bamenda', label: 'Bamenda' },
          { value: 'Buea', label: 'Buea' },
        ],
      },
      {
        id: 'typeHebergement',
        label: 'Type d\'hébergement',
        type: 'select',
        options: [
          { value: 'Hôtel', label: 'Hôtel' },
          { value: 'Hôtel-Boutique', label: 'Hôtel-Boutique' },
          { value: 'Resort', label: 'Resort' },
          { value: 'Hôtel d\'affaires', label: 'Hôtel d\'affaires' },
          { value: 'Chambre d\'hôte', label: 'Chambre d\'hôte' },
          { value: 'Auberge', label: 'Auberge' },
          { value: 'Auberge de jeunesse', label: 'Auberge de jeunesse' },
          { value: 'Gîte', label: 'Gîte' },
          { value: 'Apart-hôtel', label: 'Apart-hôtel' },
        ],
      },
      {
        id: 'categorieHotel',
        label: 'Classement',
        type: 'select',
        options: [
          { value: 'Sans classement', label: 'Sans classement' },
          { value: '1 étoile', label: '1 étoile' },
          { value: '2 étoiles', label: '2 étoiles' },
          { value: '3 étoiles', label: '3 étoiles' },
          { value: '4 étoiles', label: '4 étoiles' },
          { value: '5 étoiles', label: '5 étoiles' },
          { value: 'Palace', label: 'Palace' },
        ],
      },
      {
        id: 'typeChambreHotel',
        label: 'Type de chambre',
        type: 'select',
        options: [
          // ✅ SYNCHRONISÉ avec productModalities.ts
          { value: 'Chambre Simple', label: 'Chambre Simple' },
          { value: 'Chambre Double', label: 'Chambre Double' },
          { value: 'Chambre Twin (2 lits séparés)', label: 'Chambre Twin' },
          { value: 'Chambre Triple', label: 'Chambre Triple' },
          { value: 'Chambre Quadruple', label: 'Chambre Quadruple' },
          { value: 'Suite Junior', label: 'Suite Junior' },
          { value: 'Suite', label: 'Suite' },
          { value: 'Suite Présidentielle', label: 'Suite Présidentielle' },
          { value: 'Chambre Familiale', label: 'Chambre Familiale' },
          { value: 'Studio', label: 'Studio' },
          { value: 'Appartement', label: 'Appartement' },
        ],
      },
      {
        id: 'capaciteHotel',
        label: 'Capacité',
        type: 'select',
        options: [
          { value: '1 personne', label: '1 personne' },
          { value: '2 personnes', label: '2 personnes' },
          { value: '3 personnes', label: '3 personnes' },
          { value: '4 personnes', label: '4 personnes' },
          { value: 'Famille (4-6 pers)', label: 'Famille (4-6)' },
          { value: 'Groupe (10+)', label: 'Groupe (10+)' },
        ],
      },
      {
        id: 'pensionHotel',
        label: 'Type de pension',
        type: 'select',
        options: [
          // ✅ SYNCHRONISÉ avec productModalities.ts
          { value: 'Nuitée seule (sans repas)', label: 'Nuitée seule' },
          { value: 'Petit-déjeuner inclus', label: 'Petit-déjeuner inclus' },
          { value: 'Petit-déjeuner continental', label: 'Pt-déj continental' },
          { value: 'Petit-déjeuner buffet', label: 'Pt-déj buffet' },
          { value: 'Demi-pension (petit-déj + dîner)', label: 'Demi-pension' },
          { value: 'Pension complète (3 repas)', label: 'Pension complète' },
          { value: 'All inclusive (tout compris)', label: 'All inclusive' },
        ],
      },
      {
        id: 'equipementsHotel',
        label: 'Équipements',
        type: 'multiselect',
        options: [
          // ✅ SYNCHRONISÉ avec productModalities.ts
          { value: 'Wi-Fi gratuit', label: 'Wi-Fi gratuit' },
          { value: 'Climatisation', label: 'Climatisation' },
          { value: 'TV satellite', label: 'TV satellite' },
          { value: 'Minibar', label: 'Minibar' },
          { value: 'Coffre-fort', label: 'Coffre-fort' },
          { value: 'Sèche-cheveux', label: 'Sèche-cheveux' },
          { value: 'Piscine', label: 'Piscine' },
          { value: 'Piscine chauffée', label: 'Piscine chauffée' },
          { value: 'Piscine pour enfants', label: 'Piscine enfants' },
          { value: 'Jacuzzi', label: 'Jacuzzi' },
          { value: 'Salle de sport', label: 'Salle de sport' },
          { value: 'Spa', label: 'Spa' },
          { value: 'Sauna', label: 'Sauna' },
          { value: 'Hammam', label: 'Hammam' },
          { value: 'Tennis', label: 'Tennis' },
          { value: 'Golf', label: 'Golf' },
          { value: 'Plage privée', label: 'Plage privée' },
          { value: 'Jardin', label: 'Jardin' },
          { value: 'Restaurant', label: 'Restaurant' },
          { value: 'Bar', label: 'Bar' },
          { value: 'Parking gratuit', label: 'Parking gratuit' },
          { value: 'Parking sécurisé', label: 'Parking sécurisé' },
          { value: 'Ascenseur', label: 'Ascenseur' },
          { value: 'Salle de conférence', label: 'Salle de conférence' },
          { value: 'Centre d\'affaires', label: 'Centre d\'affaires' },
          { value: 'Salles de réunion', label: 'Salles de réunion' },
        ],
      },
      {
        id: 'servicesHotel',
        label: 'Services',
        type: 'multiselect',
        options: [
          // ✅ SYNCHRONISÉ avec productModalities.ts
          { value: 'Concierge', label: 'Concierge' },
          { value: 'Room service 24h/24', label: 'Room service 24h' },
          { value: 'Service d\'étage', label: 'Service d\'étage' },
          { value: 'Navette aéroport gratuite', label: 'Navette aéroport gratuite' },
          { value: 'Navette aéroport payante', label: 'Navette aéroport payante' },
          { value: 'Service de voiturier', label: 'Voiturier' },
          { value: 'Location de voiture', label: 'Location de voiture' },
          { value: 'Blanchisserie', label: 'Blanchisserie' },
          { value: 'Pressing', label: 'Pressing' },
          { value: 'Nettoyage à sec', label: 'Nettoyage à sec' },
          { value: 'Service de garde d\'enfants', label: 'Garde d\'enfants' },
          { value: 'Animateur pour enfants', label: 'Animateur enfants' },
          { value: 'Service de réveil', label: 'Service réveil' },
          { value: 'Change de devises', label: 'Change devises' },
          { value: 'Coffre-fort à la réception', label: 'Coffre réception' },
          { value: 'Bagagerie', label: 'Bagagerie' },
          { value: 'Réservation excursions', label: 'Réservation excursions' },
          { value: 'Service de taxi', label: 'Service taxi' },
          { value: 'Transfert aéroport', label: 'Transfert aéroport' },
          { value: 'Massage', label: 'Massage' },
          { value: 'Coiffeur/Salon de beauté', label: 'Coiffeur/Salon' },
          { value: 'Boutique de souvenirs', label: 'Boutique souvenirs' },
          { value: 'Distributeur automatique', label: 'Distributeur' },
          { value: 'Service médical', label: 'Service médical' },
        ],
      },
      {
        id: 'petitDejeuner',
        label: 'Petit-déjeuner inclus',
        type: 'toggle',
      },
      {
        id: 'wifi',
        label: 'Wi-Fi gratuit',
        type: 'toggle',
      },
      {
        id: 'parking',
        label: 'Parking disponible',
        type: 'toggle',
      },
      {
        id: 'piscine',
        label: 'Piscine',
        type: 'toggle',
      },
      {
        id: 'spa',
        label: 'Spa disponible',
        type: 'toggle',
      },
      {
        id: 'prixParNuit',
        label: 'Prix par nuit',
        type: 'range',
        min: 5000,
        max: 500000,
        unit: 'XAF',
      },
    ],
    style: {
      primaryColor: '#EC4899',
      gradientColors: ['#EC4899', '#DB2777'],
      icon: '🏨',
      badgeColor: '#FCE7F3',
      accentColor: '#DB2777',
    },
    displayPriority: ['name', 'typeHebergement', 'categorieHotel', 'zoneHotel', 'pensionHotel', 'variantesChambres'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    supportsVariants: true, // ✅ Support des variantes de chambres
  },

  // 🍽️ RESTAURATION & TRAITEUR - ULTRA-COMPLET AFRIQUE FRANCOPHONE
  restauration: {
    terminology: {
      productLabel: 'Établissement',
      productsLabel: 'Restaurants & Traiteurs',
      priceLabel: 'Prix moyen',
      locationLabel: 'Adresse',
      providerLabel: 'Restaurant',
      searchPlaceholder: 'Rechercher un restaurant, plat local, traiteur...',
      emptyMessage: 'Aucun établissement disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
        date: 'Mieux notés',
      },
    },
    filters: [
      // ===== TYPE D'ÉTABLISSEMENT =====
      {
        id: 'typeRestaurant',
        label: 'Type d\'établissement',
        type: 'multiselect',
        options: [
          { value: '🏠 Maquis traditionnel', label: 'Maquis traditionnel' },
          { value: '🏠 Restaurant africain', label: 'Restaurant africain' },
          { value: '🍖 Braiserie / Grillades', label: 'Braiserie / Grillades' },
          { value: '🍗 Poulet braisé / Rôtisserie', label: 'Poulet braisé' },
          { value: '🐟 Poissonnerie / Poisson braisé', label: 'Poissonnerie' },
          { value: '🥘 Traiteur événementiel', label: 'Traiteur événementiel' },
          { value: '☕ Cafétéria / Snack', label: 'Cafétéria / Snack' },
          { value: '🍕 Pizzeria', label: 'Pizzeria' },
          { value: '🍔 Fast-food / Burger', label: 'Fast-food' },
          { value: '🍝 Restaurant italien', label: 'Restaurant italien' },
          { value: '🍜 Restaurant asiatique (chinois, japonais)', label: 'Restaurant asiatique' },
          { value: '🥙 Restaurant libanais / Moyen-Orient', label: 'Restaurant libanais' },
          { value: '🥖 Boulangerie-pâtisserie', label: 'Boulangerie-pâtisserie' },
          { value: '🚚 Food truck', label: 'Food truck' },
        ],
      },

      // ===== TYPE DE CUISINE =====
      {
        id: 'typeCuisine',
        label: 'Type de cuisine',
        type: 'multiselect',
        options: [
          { value: '🇨🇲 Cuisine camerounaise', label: 'Camerounaise' },
          { value: '🇨🇮 Cuisine ivoirienne', label: 'Ivoirienne' },
          { value: '🇸🇳 Cuisine sénégalaise', label: 'Sénégalaise' },
          { value: '🇲🇱 Cuisine malienne', label: 'Malienne' },
          { value: '🇬🇦 Cuisine gabonaise', label: 'Gabonaise' },
          { value: '🇨🇬 Cuisine congolaise', label: 'Congolaise' },
          { value: '🇧🇫 Cuisine burkinabè', label: 'Burkinabè' },
          { value: '🌍 Cuisine africaine (générale)', label: 'Africaine générale' },
          { value: '🇫🇷 Cuisine française', label: 'Française' },
          { value: '🇮🇹 Cuisine italienne', label: 'Italienne' },
          { value: '🇨🇳 Cuisine chinoise', label: 'Chinoise' },
          { value: '🇯🇵 Cuisine japonaise', label: 'Japonaise' },
          { value: '🇱🇧 Cuisine libanaise', label: 'Libanaise' },
          { value: '🍔 Fast-food', label: 'Fast-food' },
          { value: '🍖 Grillades / BBQ', label: 'Grillades / BBQ' },
          { value: '🐟 Poissons & fruits de mer', label: 'Poissons & fruits de mer' },
        ],
      },

      // ===== PLATS POPULAIRES (Recherche intelligente) =====
      {
        id: 'platsPopulaires',
        label: 'Plats recherchés',
        type: 'multiselect',
        options: [
          // Cameroun
          { value: '🇨🇲 Ndolé', label: 'Ndolé (Cameroun)' },
          { value: '🇨🇲 Eru / Okok', label: 'Eru / Okok (Cameroun)' },
          { value: '🇨🇲 Poulet DG', label: 'Poulet DG (Cameroun)' },
          { value: '🇨🇲 Koki', label: 'Koki (Cameroun)' },
          { value: '🇨🇲 Poulet braisé / Kati-kati', label: 'Poulet braisé (Cameroun)' },
          { value: '🇨🇲 Poisson braisé', label: 'Poisson braisé (Cameroun)' },
          { value: '🇨🇲 Soya / Khebabs', label: 'Soya / Khebabs (Cameroun)' },
          { value: '🇨🇲 Mbongo tchobi', label: 'Mbongo tchobi (Cameroun)' },
          // Côte d'Ivoire
          { value: '🇨🇮 Attiéké-poisson', label: 'Attiéké-poisson (Côte d\'Ivoire)' },
          { value: '🇨🇮 Aloco', label: 'Aloco (Côte d\'Ivoire)' },
          { value: '🇨🇮 Garba', label: 'Garba (Côte d\'Ivoire)' },
          { value: '🇨🇮 Kedjenou', label: 'Kedjenou (Côte d\'Ivoire)' },
          // Sénégal
          { value: '🇸🇳 Thiéboudienne', label: 'Thiéboudienne (Sénégal)' },
          { value: '🇸🇳 Yassa poulet', label: 'Yassa poulet (Sénégal)' },
          { value: '🇸🇳 Mafé', label: 'Mafé (Sénégal)' },
          { value: '🇸🇳 Dibi (mouton grillé)', label: 'Dibi (Sénégal)' },
          // Congo/Gabon
          { value: '🇨🇬 Pondu / Saka-saka', label: 'Pondu / Saka-saka (Congo)' },
          { value: '🇨🇬 Liboke', label: 'Liboke (Congo)' },
          { value: '🇬🇦 Nyembwé', label: 'Nyembwé (Gabon)' },
          { value: '🇬🇦 Moambe chicken', label: 'Moambe chicken (Gabon/Congo)' },
          // International
          { value: '🍕 Pizza', label: 'Pizza' },
          { value: '🍔 Burger', label: 'Burger' },
          { value: '🍜 Riz cantonnais / Nouilles', label: 'Riz cantonnais / Nouilles' },
          { value: '🥙 Chawarma', label: 'Chawarma' },
        ],
      },

      // ===== SERVICES =====
      {
        id: 'servicesRestau',
        label: 'Services proposés',
        type: 'multiselect',
        options: [
          { value: '🍽️ Service sur place', label: 'Sur place' },
          { value: '📦 Plats à emporter', label: 'À emporter' },
          { value: '🚗 Livraison à domicile', label: 'Livraison' },
          { value: '🎉 Traiteur événementiel (mariages, baptêmes)', label: 'Traiteur événementiel' },
          { value: '🏢 Traiteur entreprise (séminaires, pause-café)', label: 'Traiteur entreprise' },
          { value: '🍱 Buffet sur mesure', label: 'Buffet' },
        ],
      },

      // ===== GAMME DE PRIX =====
      {
        id: 'gammePrix',
        label: 'Gamme de prix',
        type: 'select',
        options: [
          { value: '💰 Économique (500-1500 FCFA)', label: 'Économique (500-1500 FCFA)' },
          { value: '💰💰 Abordable (1500-3000 FCFA)', label: 'Abordable (1500-3000 FCFA)' },
          { value: '💰💰💰 Moyen (3000-6000 FCFA)', label: 'Moyen (3000-6000 FCFA)' },
          { value: '💰💰💰💰 Élevé (6000-12000 FCFA)', label: 'Élevé (6000-12000 FCFA)' },
          { value: '💰💰💰💰💰 Premium (> 12000 FCFA)', label: 'Premium (> 12000 FCFA)' },
        ],
      },

      // ===== RÉGIMES ALIMENTAIRES =====
      {
        id: 'regimesSpeciaux',
        label: 'Régimes alimentaires',
        type: 'multiselect',
        options: [
          { value: '☪️ Halal certifié', label: 'Halal certifié' },
          { value: '✡️ Kasher', label: 'Kasher' },
          { value: '🌱 Végétarien', label: 'Végétarien' },
          { value: '🌿 Vegan (100% végétal)', label: 'Vegan' },
          { value: '🌾 Sans gluten', label: 'Sans gluten' },
          { value: '🥛 Sans lactose', label: 'Sans lactose' },
          { value: '🥗 Bio / Produits locaux', label: 'Bio / Produits locaux' },
        ],
      },

      // ===== HORAIRES =====
      {
        id: 'horairesRestaurant',
        label: 'Horaires de service',
        type: 'multiselect',
        options: [
          { value: '🌅 Petit-déjeuner (6h-11h)', label: 'Petit-déjeuner' },
          { value: '☀️ Déjeuner (11h-16h)', label: 'Déjeuner' },
          { value: '🌆 Dîner (18h-23h)', label: 'Dîner' },
          { value: '🍽️ Service continu (11h-23h)', label: 'Service continu' },
          { value: '🌙 Service nocturne (20h-4h)', label: 'Service nocturne' },
          { value: '⏰ 24h/24', label: '24h/24' },
        ],
      },

      // ===== AMBIANCE & ÉQUIPEMENTS =====
      {
        id: 'ambianceRestau',
        label: 'Ambiance & Équipements',
        type: 'multiselect',
        options: [
          { value: '👨‍👩‍👧‍👦 Familial', label: 'Familial' },
          { value: '💑 Romantique', label: 'Romantique' },
          { value: '👔 Professionnel / Business', label: 'Professionnel' },
          { value: '🎉 Festif / Événementiel', label: 'Festif' },
          { value: '🌳 Terrasse / Jardin', label: 'Terrasse / Jardin' },
          { value: '❄️ Climatisé', label: 'Climatisé' },
          { value: '📶 Wi-Fi gratuit', label: 'Wi-Fi gratuit' },
          { value: '🚗 Parking disponible', label: 'Parking' },
          { value: '🎵 Musique live', label: 'Musique live' },
          { value: '📺 Écrans TV / Sports', label: 'Écrans TV / Sports' },
        ],
      },

      // ===== CAPACITÉ =====
      {
        id: 'capaciteRestaurant',
        label: 'Capacité d\'accueil',
        type: 'select',
        options: [
          { value: '👥 Petit (1-20 personnes)', label: 'Petit (1-20 pers.)' },
          { value: '👥 Moyen (20-50 personnes)', label: 'Moyen (20-50 pers.)' },
          { value: '👥 Grand (50-100 personnes)', label: 'Grand (50-100 pers.)' },
          { value: '👥 Très grand (100-200 personnes)', label: 'Très grand (100-200 pers.)' },
          { value: '👥 Événementiel (200-500+ personnes)', label: 'Événementiel (200+ pers.)' },
        ],
      },

      // ===== CERTIFICATIONS =====
      {
        id: 'certificationsRestau',
        label: 'Certifications & Labels',
        type: 'multiselect',
        options: [
          { value: '✅ Agréé par le Ministère de la Santé', label: 'Agréé Ministère Santé' },
          { value: '✅ Certification Halal', label: 'Certification Halal' },
          { value: '✅ Hygiène HACCP', label: 'Hygiène HACCP' },
          { value: '🏆 Restaurant recommandé', label: 'Restaurant recommandé' },
          { value: '🌱 Produits bio certifiés', label: 'Produits bio' },
        ],
      },

      // ===== PROMOTIONS =====
      {
        id: 'promotionsRestau',
        label: 'Promotions & Avantages',
        type: 'multiselect',
        options: [
          { value: '🎉 Promotion du jour', label: 'Promotion du jour' },
          { value: '📅 Menu du midi réduit', label: 'Menu du midi réduit' },
          { value: '👨‍👩‍👧‍👦 Offre famille', label: 'Offre famille' },
          { value: '🥤 Boisson offerte', label: 'Boisson offerte' },
          { value: '📦 Livraison gratuite (à partir de...)', label: 'Livraison gratuite' },
          { value: '💳 Carte de fidélité', label: 'Carte de fidélité' },
        ],
      },

      // ===== TOGGLES RAPIDES =====
      {
        id: 'ouvertMaintenant',
        label: 'Ouvert maintenant',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#F97316',
      gradientColors: ['#F97316', '#EA580C'],
      icon: '🍽️',
      badgeColor: '#FFEDD5',
      accentColor: '#EA580C',
    },
    displayPriority: ['typeRestaurant', 'typeCuisine', 'platsPopulaires', 'servicesRestau', 'gammePrix'],
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
          // Sports collectifs populaires
          { value: 'Football', label: 'Football' },
          { value: 'Basketball', label: 'Basketball' },
          { value: 'Volleyball', label: 'Volleyball' },
          { value: 'Handball', label: 'Handball' },
          // Fitness & Cardio
          { value: 'Musculation', label: 'Musculation' },
          { value: 'Cardio', label: 'Cardio' },
          { value: 'CrossFit', label: 'CrossFit' },
          { value: 'Circuit Training', label: 'Circuit Training' },
          { value: 'HIIT', label: 'HIIT' },
          // Douceur & Bien-être
          { value: 'Yoga', label: 'Yoga' },
          { value: 'Pilates', label: 'Pilates' },
          { value: 'Stretching', label: 'Stretching' },
          { value: 'Méditation', label: 'Méditation' },
          // Sports de combat
          { value: 'Boxe', label: 'Boxe' },
          { value: 'Kickboxing', label: 'Kickboxing' },
          { value: 'Muay Thai', label: 'Muay Thai' },
          { value: 'MMA', label: 'MMA' },
          { value: 'Karaté', label: 'Karaté' },
          { value: 'Taekwondo', label: 'Taekwondo' },
          { value: 'Judo', label: 'Judo' },
          { value: 'Lutte traditionnelle', label: 'Lutte traditionnelle' },
          // Danse & Rythme
          { value: 'Zumba', label: 'Zumba' },
          { value: 'Danse', label: 'Danse' },
          { value: 'Aerobic', label: 'Aerobic' },
          { value: 'Step', label: 'Step' },
          { value: 'Danse africaine', label: 'Danse africaine' },
          // Sports individuels
          { value: 'Natation', label: 'Natation' },
          { value: 'Tennis', label: 'Tennis' },
          { value: 'Cyclisme', label: 'Cyclisme' },
          { value: 'Course à pied', label: 'Course à pied' },
          { value: 'Running', label: 'Running' },
          { value: 'Jogging', label: 'Jogging' },
          { value: 'Golf', label: 'Golf' },
          { value: 'Squash', label: 'Squash' },
          { value: 'Badminton', label: 'Badminton' },
          { value: 'Tennis de table', label: 'Tennis de table' },
          // Spécialisés
          { value: 'Spinning', label: 'Spinning' },
          { value: 'Body Pump', label: 'Body Pump' },
          { value: 'Body Combat', label: 'Body Combat' },
          { value: 'TRX', label: 'TRX' },
          { value: 'Corde à sauter', label: 'Corde à sauter' },
        ],
      },
      {
        id: 'niveauSport',
        label: 'Niveau',
        type: 'select',
        options: [
          { value: 'Débutant', label: 'Débutant' },
          { value: 'Débutant avancé', label: 'Débutant avancé' },
          { value: 'Intermédiaire', label: 'Intermédiaire' },
          { value: 'Intermédiaire avancé', label: 'Intermédiaire avancé' },
          { value: 'Avancé', label: 'Avancé' },
          { value: 'Compétition', label: 'Compétition' },
          { value: 'Professionnel', label: 'Professionnel' },
          { value: 'Tous niveaux', label: 'Tous niveaux' },
        ],
      },
      {
        id: 'dureeSport',
        label: 'Durée',
        type: 'select',
        options: [
          { value: '30 minutes', label: '30 minutes' },
          { value: '45 minutes', label: '45 minutes' },
          { value: '1 heure', label: '1 heure' },
          { value: '1h15', label: '1h15' },
          { value: '1h30', label: '1h30' },
          { value: '2 heures', label: '2 heures' },
          { value: '2h30', label: '2h30' },
          { value: '3 heures', label: '3 heures' },
          { value: 'Demi-journée', label: 'Demi-journée' },
          { value: 'Journée complète', label: 'Journée complète' },
        ],
      },
      {
        id: 'serviceSport',
        label: 'Type de service',
        type: 'select',
        options: [
          { value: 'Abonnement mensuel', label: 'Abonnement mensuel' },
          { value: 'Abonnement trimestriel', label: 'Abonnement trimestriel' },
          { value: 'Abonnement annuel', label: 'Abonnement annuel' },
          { value: 'Séance à l\'unité', label: 'Séance à l\'unité' },
          { value: 'Pack 5 séances', label: 'Pack 5 séances' },
          { value: 'Pack 10 séances', label: 'Pack 10 séances' },
          { value: 'Pack 20 séances', label: 'Pack 20 séances' },
          { value: 'Coaching personnalisé', label: 'Coaching personnalisé' },
          { value: 'Coaching en groupe', label: 'Coaching en groupe' },
          { value: 'Cours collectifs', label: 'Cours collectifs' },
          { value: 'Personal training', label: 'Personal training' },
          { value: 'Programme sur mesure', label: 'Programme sur mesure' },
          { value: 'Bilan physique initial', label: 'Bilan physique initial' },
          { value: 'Suivi nutritionnel', label: 'Suivi nutritionnel' },
          { value: 'Plan alimentaire', label: 'Plan alimentaire' },
          { value: 'Consultation diététique', label: 'Consultation diététique' },
          { value: 'Cours d\'essai gratuit', label: 'Cours d\'essai gratuit' },
          { value: 'Séance découverte', label: 'Séance découverte' },
        ],
      },
      {
        id: 'objectifSport',
        label: 'Objectif',
        type: 'select',
        options: [
          { value: 'Perte de poids', label: 'Perte de poids' },
          { value: 'Prise de masse musculaire', label: 'Prise de masse musculaire' },
          { value: 'Tonification', label: 'Tonification' },
          { value: 'Remise en forme', label: 'Remise en forme' },
          { value: 'Amélioration cardio', label: 'Amélioration cardio' },
          { value: 'Gain de force', label: 'Gain de force' },
          { value: 'Souplesse et mobilité', label: 'Souplesse et mobilité' },
          { value: 'Préparation sportive', label: 'Préparation sportive' },
          { value: 'Rééducation', label: 'Rééducation' },
          { value: 'Bien-être et détente', label: 'Bien-être et détente' },
          { value: 'Compétition', label: 'Compétition' },
          { value: 'Maintien de la forme', label: 'Maintien de la forme' },
        ],
      },
      {
        id: 'equipementsSport',
        label: 'Équipements',
        type: 'multiselect',
        options: [
          // Cardio
          { value: 'Tapis de course', label: 'Tapis de course' },
          { value: 'Vélo d\'appartement', label: 'Vélo d\'appartement' },
          { value: 'Vélo spinning', label: 'Vélo spinning' },
          { value: 'Rameur', label: 'Rameur' },
          { value: 'Elliptique', label: 'Elliptique' },
          { value: 'Stepper', label: 'Stepper' },
          { value: 'Vélo Assault', label: 'Vélo Assault' },
          { value: 'Ski-erg', label: 'Ski-erg' },
          // Musculation
          { value: 'Haltères', label: 'Haltères' },
          { value: 'Barres olympiques', label: 'Barres olympiques' },
          { value: 'Disques de fonte', label: 'Disques de fonte' },
          { value: 'Kettlebells', label: 'Kettlebells' },
          { value: 'Banc de musculation', label: 'Banc de musculation' },
          { value: 'Rack à squat', label: 'Rack à squat' },
          { value: 'Smith machine', label: 'Smith machine' },
          { value: 'Presse à cuisses', label: 'Presse à cuisses' },
          { value: 'Poulie haute/basse', label: 'Poulie haute/basse' },
          { value: 'Cages de crossfit', label: 'Cages de crossfit' },
          // Fonctionnel
          { value: 'TRX', label: 'TRX' },
          { value: 'Battle rope', label: 'Battle rope' },
          { value: 'Sacs de sable', label: 'Sacs de sable' },
          { value: 'Bosu', label: 'Bosu' },
          { value: 'Swiss ball', label: 'Swiss ball' },
          { value: 'Medicine ball', label: 'Medicine ball' },
          { value: 'Slam ball', label: 'Slam ball' },
          { value: 'Box de pliométrie', label: 'Box de pliométrie' },
          { value: 'Corde à sauter', label: 'Corde à sauter' },
          { value: 'Élastiques de résistance', label: 'Élastiques de résistance' },
          { value: 'Bandes élastiques', label: 'Bandes élastiques' },
          { value: 'Gants', label: 'Gants' },
          // Yoga & Pilates
          { value: 'Tapis de yoga', label: 'Tapis de yoga' },
          { value: 'Briques de yoga', label: 'Briques de yoga' },
          { value: 'Sangles de yoga', label: 'Sangles de yoga' },
          { value: 'Rouleaux en mousse', label: 'Rouleaux en mousse' },
          // Services
          { value: 'Miroirs', label: 'Miroirs' },
          { value: 'Vestiaires', label: 'Vestiaires' },
          { value: 'Douches', label: 'Douches' },
          { value: 'Casiers', label: 'Casiers' },
          { value: 'Climatisation', label: 'Climatisation' },
          { value: 'Parking', label: 'Parking' },
          { value: 'Wifi', label: 'Wifi' },
          { value: 'Bar protéiné', label: 'Bar protéiné' },
          { value: 'Espace détente', label: 'Espace détente' },
        ],
      },
      {
        id: 'joursSport',
        label: 'Jours disponibles',
        type: 'multiselect',
        options: [
          { value: 'Lundi', label: 'Lundi' },
          { value: 'Mardi', label: 'Mardi' },
          { value: 'Mercredi', label: 'Mercredi' },
          { value: 'Jeudi', label: 'Jeudi' },
          { value: 'Vendredi', label: 'Vendredi' },
          { value: 'Samedi', label: 'Samedi' },
          { value: 'Dimanche', label: 'Dimanche' },
          { value: 'Lundi au Vendredi', label: 'Lundi au Vendredi' },
          { value: 'Week-end uniquement', label: 'Week-end uniquement' },
          { value: 'Tous les jours', label: 'Tous les jours' },
        ],
      },
      {
        id: 'horairesSport',
        label: 'Horaires',
        type: 'select',
        options: [
          { value: '06h00 - 08h00 (Matin tôt)', label: '06h00 - 08h00 (Matin tôt)' },
          { value: '08h00 - 10h00 (Matinée)', label: '08h00 - 10h00 (Matinée)' },
          { value: '10h00 - 12h00 (Fin de matinée)', label: '10h00 - 12h00 (Fin de matinée)' },
          { value: '12h00 - 14h00 (Midi)', label: '12h00 - 14h00 (Midi)' },
          { value: '14h00 - 16h00 (Début après-midi)', label: '14h00 - 16h00 (Début après-midi)' },
          { value: '16h00 - 18h00 (Fin après-midi)', label: '16h00 - 18h00 (Fin après-midi)' },
          { value: '18h00 - 20h00 (Soirée)', label: '18h00 - 20h00 (Soirée)' },
          { value: '20h00 - 22h00 (Soirée tardive)', label: '20h00 - 22h00 (Soirée tardive)' },
          { value: '06h00 - 22h00 (Ouvert toute la journée)', label: '06h00 - 22h00 (Ouvert toute la journée)' },
          { value: 'Flexible', label: 'Flexible' },
        ],
      },
      {
        id: 'salleSport',
        label: 'Salle / Centre',
        type: 'select',
        options: [
          // Douala
          { value: 'Fitness First Douala', label: 'Fitness First Douala' },
          { value: 'Planet Fitness Douala', label: 'Planet Fitness Douala' },
          { value: 'Energy Gym Douala', label: 'Energy Gym Douala' },
          { value: 'Body Shape Gym', label: 'Body Shape Gym' },
          { value: 'Power Gym Akwa', label: 'Power Gym Akwa' },
          { value: 'Gold\'s Gym Bonapriso', label: 'Gold\'s Gym Bonapriso' },
          { value: 'CrossFit Douala', label: 'CrossFit Douala' },
          { value: 'Yoga Studio Douala', label: 'Yoga Studio Douala' },
          { value: 'Wellness Center Bonanjo', label: 'Wellness Center Bonanjo' },
          { value: 'Sport Zone Makepe', label: 'Sport Zone Makepe' },
          { value: 'Dynamic Fitness Bonabéri', label: 'Dynamic Fitness Bonabéri' },
          { value: 'Champion Gym Deido', label: 'Champion Gym Deido' },
          // Yaoundé
          { value: 'Fitness Club Bastos', label: 'Fitness Club Bastos' },
          { value: 'Gym Center Nlongkak', label: 'Gym Center Nlongkak' },
          { value: 'Top Form Yaoundé', label: 'Top Form Yaoundé' },
          { value: 'CrossFit Yaoundé', label: 'CrossFit Yaoundé' },
          { value: 'Energie Gym Yaoundé', label: 'Energie Gym Yaoundé' },
          { value: 'Body Fit Center', label: 'Body Fit Center' },
          { value: 'Power House Gym', label: 'Power House Gym' },
          { value: 'Wellness Gym Bastos', label: 'Wellness Gym Bastos' },
          { value: 'Sport Palace Yaoundé', label: 'Sport Palace Yaoundé' },
          { value: 'Yoga Bastos', label: 'Yoga Bastos' },
          { value: 'Pilates Studio Yaoundé', label: 'Pilates Studio Yaoundé' },
          // Autres villes
          { value: 'Gym Bafoussam', label: 'Gym Bafoussam' },
          { value: 'Fitness Garoua', label: 'Fitness Garoua' },
          { value: 'Sport Center Bamenda', label: 'Sport Center Bamenda' },
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
    displayPriority: ['typeSport', 'niveauSport', 'serviceSport', 'objectifSport', 'dureeSport', 'horairesSport', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // ════════════════════════════════════════════════════════════
  // 💼 EMPLOI & RECRUTEMENT - ULTRA-ENRICHI AFRIQUE + INTERNATIONAL
  // ════════════════════════════════════════════════════════════
  // 🎯 Objectif : Référence absolue pour RECRUTER et trouver un emploi
  // 📊 Contenu : 500+ métiers, 100+ secteurs, spécificités africaines
  // ⚠️ DISTINCTION : Cette catégorie = OFFRES de recrutement (entreprises qui recrutent)
  //                  ≠ nettoyage_entretien (prestataires individuels qui proposent services)
  // ════════════════════════════════════════════════════════════
  emploi: {
    terminology: {
      productLabel: 'Offre d\'emploi / Recrutement',
      productsLabel: 'Offres d\'emploi & Recrutements',
      priceLabel: 'Salaire proposé',
      locationLabel: 'Lieu de travail',
      providerLabel: 'Entreprise/Recruteur',
      searchPlaceholder: 'Rechercher une offre d\'emploi, recrutement, poste...',
      emptyMessage: 'Aucune offre d\'emploi disponible pour ces critères',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Salaire croissant',
        price_desc: 'Salaire décroissant',
        distance: 'Proximité géographique',
        date: 'Date de publication',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Secteur d'activité (100+ options - contextualisé Afrique)
      {
        id: 'secteurActivite',
        label: 'Secteur d\'activité',
        type: 'select',
        options: [
          // ═══ 🌍 SECTEURS CLÉS AFRIQUE ═══
          { value: '─── 🌍 SECTEURS CLÉS AFRIQUE ───', label: '─── 🌍 SECTEURS CLÉS AFRIQUE ───' },
          { value: 'Agriculture/Agro-industrie', label: 'Agriculture/Agro-industrie' },
          { value: 'Mines/Pétrole/Gaz', label: 'Mines/Pétrole/Gaz' },
          { value: 'Télécommunications', label: 'Télécommunications' },
          { value: 'Banque/Microfinance', label: 'Banque/Microfinance' },
          { value: 'Mobile Money/Fintech', label: 'Mobile Money/Fintech' },
          { value: 'ONG/Humanitaire', label: 'ONG/Humanitaire' },
          { value: 'Transport/Logistique', label: 'Transport/Logistique' },
          { value: 'Commerce général/Import-Export', label: 'Commerce/Import-Export' },
          { value: 'Énergie solaire/Renouvelables', label: 'Énergie solaire/Renouvelables' },
          { value: 'Santé/Médical/Pharmaceutique', label: 'Santé/Médical/Pharma' },
          { value: 'Éducation/Formation', label: 'Éducation/Formation' },
          { value: 'Tourisme/Hôtellerie', label: 'Tourisme/Hôtellerie' },
          { value: 'BTP/Construction/Génie civil', label: 'BTP/Construction' },
          { value: 'Sécurité/Gardiennage', label: 'Sécurité/Gardiennage' },

          // ═══ 💼 SECTEURS TRADITIONNELS ═══
          { value: '─── 💼 SECTEURS TRADITIONNELS ───', label: '─── 💼 SECTEURS TRADITIONNELS ───' },
          { value: 'Informatique/IT/Tech', label: 'Informatique/IT/Tech' },
          { value: 'Développement web/mobile', label: 'Développement web/mobile' },
          { value: 'Data Science/IA', label: 'Data Science/IA' },
          { value: 'Cybersécurité', label: 'Cybersécurité' },
          { value: 'Marketing/Communication', label: 'Marketing/Communication' },
          { value: 'Marketing digital/SEO', label: 'Marketing digital/SEO' },
          { value: 'Commerce/Vente', label: 'Commerce/Vente' },
          { value: 'Finance/Comptabilité', label: 'Finance/Comptabilité' },
          { value: 'Audit/Contrôle de gestion', label: 'Audit/Contrôle gestion' },
          { value: 'Ressources Humaines/RH', label: 'Ressources Humaines/RH' },
          { value: 'Juridique/Droit', label: 'Juridique/Droit' },
          { value: 'Administration/Secrétariat', label: 'Administration/Secrétariat' },
          { value: 'Gestion de projet/PMO', label: 'Gestion de projet/PMO' },

          // ═══ 🏭 INDUSTRIE & PRODUCTION ═══
          { value: '─── 🏭 INDUSTRIE & PRODUCTION ───', label: '─── 🏭 INDUSTRIE & PRODUCTION ───' },
          { value: 'Industrie manufacturière', label: 'Industrie manufacturière' },
          { value: 'Agroalimentaire/Transformation', label: 'Agroalimentaire' },
          { value: 'Textile/Confection', label: 'Textile/Confection' },
          { value: 'Bois/Menuiserie/Ébénisterie', label: 'Bois/Menuiserie' },
          { value: 'Métallurgie/Soudure', label: 'Métallurgie/Soudure' },
          { value: 'Chimie/Plasturgie', label: 'Chimie/Plasturgie' },
          { value: 'Électronique/Électrotechnique', label: 'Électronique' },
          { value: 'Automobile/Mécanique', label: 'Automobile/Mécanique' },
          { value: 'Maintenance industrielle', label: 'Maintenance industrielle' },
          { value: 'Qualité/QHSE', label: 'Qualité/QHSE' },

          // ═══ 🏗️ BTP & INFRASTRUCTURE ═══
          { value: '─── 🏗️ BTP & INFRASTRUCTURE ───', label: '─── 🏗️ BTP & INFRASTRUCTURE ───' },
          { value: 'Architecture/Urbanisme', label: 'Architecture/Urbanisme' },
          { value: 'Génie civil/Travaux publics', label: 'Génie civil/TP' },
          { value: 'Électricité bâtiment', label: 'Électricité bâtiment' },
          { value: 'Plomberie/Sanitaire', label: 'Plomberie/Sanitaire' },
          { value: 'Peinture/Décoration', label: 'Peinture/Décoration' },
          { value: 'Carrelage/Revêtements', label: 'Carrelage/Revêtements' },
          { value: 'Maçonnerie/Béton armé', label: 'Maçonnerie/Béton' },
          { value: 'Menuiserie aluminium/PVC', label: 'Menuiserie alu/PVC' },
          { value: 'Topographie/Géomètre', label: 'Topographie/Géomètre' },
          { value: 'Études de prix/Métreur', label: 'Métreur/Études prix' },

          // ═══ 🍽️ HÔTELLERIE & RESTAURATION ═══
          { value: '─── 🍽️ HÔTELLERIE & RESTAURATION ───', label: '─── 🍽️ HÔTELLERIE & RESTAURATION ───' },
          { value: 'Hôtellerie', label: 'Hôtellerie' },
          { value: 'Restauration/Cuisine', label: 'Restauration/Cuisine' },
          { value: 'Boulangerie/Pâtisserie', label: 'Boulangerie/Pâtisserie' },
          { value: 'Bar/Café/Maquis', label: 'Bar/Café/Maquis' },
          { value: 'Traiteur/Événementiel', label: 'Traiteur/Événementiel' },
          { value: 'Réception/Accueil', label: 'Réception/Accueil' },

          // ═══ 🎨 CRÉATION & MÉDIAS ═══
          { value: '─── 🎨 CRÉATION & MÉDIAS ───', label: '─── 🎨 CRÉATION & MÉDIAS ───' },
          { value: 'Design graphique/UI-UX', label: 'Design graphique/UI-UX' },
          { value: 'Photographie/Vidéographie', label: 'Photo/Vidéo' },
          { value: 'Journalisme/Presse', label: 'Journalisme/Presse' },
          { value: 'Audiovisuel/Production', label: 'Audiovisuel/Production' },
          { value: 'Mode/Stylisme', label: 'Mode/Stylisme' },
          { value: 'Arts/Culture/Spectacle', label: 'Arts/Culture' },
          { value: 'Impression/Imprimerie', label: 'Impression/Imprimerie' },

          // ═══ 🛒 COMMERCE & DISTRIBUTION ═══
          { value: '─── 🛒 COMMERCE & DISTRIBUTION ───', label: '─── 🛒 COMMERCE & DISTRIBUTION ───' },
          { value: 'Grande distribution/Supermarché', label: 'Grande distribution' },
          { value: 'Commerce de détail', label: 'Commerce de détail' },
          { value: 'Commerce de gros', label: 'Commerce de gros' },
          { value: 'E-commerce/Vente en ligne', label: 'E-commerce' },
          { value: 'Pharmacie/Parapharmacie', label: 'Pharmacie' },
          { value: 'Librairie/Papeterie', label: 'Librairie/Papeterie' },

          // ═══ 🌐 SERVICES AUX ENTREPRISES ═══
          { value: '─── 🌐 SERVICES AUX ENTREPRISES ───', label: '─── 🌐 SERVICES AUX ENTREPRISES ───' },
          { value: 'Conseil/Consulting', label: 'Conseil/Consulting' },
          { value: 'Formation professionnelle', label: 'Formation professionnelle' },
          { value: 'Nettoyage/Propreté', label: 'Nettoyage/Propreté' },
          { value: 'Facility Management', label: 'Facility Management' },
          { value: 'Call center/Centre d\'appels', label: 'Call center' },
          { value: 'Traduction/Interprétariat', label: 'Traduction' },
          { value: 'Recrutement/Intérim', label: 'Recrutement/Intérim' },

          // ═══ 🚗 TRANSPORT & LOGISTIQUE ═══
          { value: '─── 🚗 TRANSPORT & LOGISTIQUE ───', label: '─── 🚗 TRANSPORT & LOGISTIQUE ───' },
          { value: 'Transport routier', label: 'Transport routier' },
          { value: 'Transport urbain/Taxi', label: 'Transport urbain/Taxi' },
          { value: 'Livraison/Coursier', label: 'Livraison/Coursier' },
          { value: 'Logistique/Supply Chain', label: 'Logistique/Supply Chain' },
          { value: 'Transit/Douane', label: 'Transit/Douane' },
          { value: 'Fret/Maritime/Aérien', label: 'Fret/Maritime/Aérien' },
          { value: 'Entreposage/Stockage', label: 'Entreposage' },

          // ═══ 🏥 SANTÉ & SOCIAL ═══
          { value: '─── 🏥 SANTÉ & SOCIAL ───', label: '─── 🏥 SANTÉ & SOCIAL ───' },
          { value: 'Médecine/Médecin', label: 'Médecine/Médecin' },
          { value: 'Soins infirmiers', label: 'Soins infirmiers' },
          { value: 'Paramédical', label: 'Paramédical' },
          { value: 'Pharmacie/Pharmacien', label: 'Pharmacie/Pharmacien' },
          { value: 'Laboratoire médical', label: 'Laboratoire médical' },
          { value: 'Dentaire/Orthodontie', label: 'Dentaire' },
          { value: 'Kinésithérapie/Réadaptation', label: 'Kinésithérapie' },
          { value: 'Aide à domicile/Care', label: 'Aide à domicile' },
          { value: 'Action sociale/ONG', label: 'Action sociale/ONG' },

          // ═══ 🌾 AGRICULTURE & ENVIRONNEMENT ═══
          { value: '─── 🌾 AGRICULTURE & ENVIRONNEMENT ───', label: '─── 🌾 AGRICULTURE & ENVIRONNEMENT ───' },
          { value: 'Agriculture/Élevage', label: 'Agriculture/Élevage' },
          { value: 'Agro-pastoral', label: 'Agro-pastoral' },
          { value: 'Pêche/Aquaculture', label: 'Pêche/Aquaculture' },
          { value: 'Forêt/Exploitation forestière', label: 'Forêt' },
          { value: 'Agronomie/Agronome', label: 'Agronomie' },
          { value: 'Vétérinaire/Zootechnie', label: 'Vétérinaire' },
          { value: 'Environnement/Développement durable', label: 'Environnement/Durable' },
          { value: 'Eau/Assainissement', label: 'Eau/Assainissement' },
          { value: 'Gestion des déchets/Recyclage', label: 'Déchets/Recyclage' },

          // ═══ 📚 AUTRE ═══
          { value: 'Fonction publique', label: 'Fonction publique' },
          { value: 'Défense/Armée/Police', label: 'Défense/Armée/Police' },
          { value: 'Sport/Fitness/Coaching', label: 'Sport/Fitness' },
          { value: 'Beauté/Esthétique/Coiffure', label: 'Beauté/Esthétique' },
          { value: 'Immobilier/Promotion', label: 'Immobilier/Promotion' },
          { value: 'Assurance/Actuariat', label: 'Assurance/Actuariat' },
          { value: 'Autre secteur', label: 'Autre secteur' },
        ],
      },

      // ✅ FILTRE 2 : Métier / Poste recherché (500+ options - EXHAUSTIF Afrique + International)
      {
        id: 'metierPoste',
        label: 'Métier / Poste',
        type: 'select',
        options: [
          // ═══ 💻 INFORMATIQUE & TECH (80+ métiers) ═══
          { value: '─── 💻 INFORMATIQUE & TECH ───', label: '─── 💻 INFORMATIQUE & TECH ───' },
          { value: 'Développeur Full Stack', label: 'Développeur Full Stack' },
          { value: 'Développeur Front-end (React, Vue, Angular)', label: 'Développeur Front-end' },
          { value: 'Développeur Back-end (Node.js, PHP, Python)', label: 'Développeur Back-end' },
          { value: 'Développeur Mobile (iOS, Android, React Native)', label: 'Développeur Mobile' },
          { value: 'Développeur Web', label: 'Développeur Web' },
          { value: 'Ingénieur logiciel (Software Engineer)', label: 'Ingénieur logiciel' },
          { value: 'Architecte logiciel', label: 'Architecte logiciel' },
          { value: 'Data Scientist / Data Analyst', label: 'Data Scientist' },
          { value: 'Data Engineer', label: 'Data Engineer' },
          { value: 'Ingénieur DevOps', label: 'Ingénieur DevOps' },
          { value: 'Ingénieur Cloud (AWS, Azure, GCP)', label: 'Ingénieur Cloud' },
          { value: 'Administrateur système (SysAdmin)', label: 'Administrateur système' },
          { value: 'Administrateur réseau', label: 'Administrateur réseau' },
          { value: 'Ingénieur cybersécurité', label: 'Ingénieur cybersécurité' },
          { value: 'Analyste cybersécurité / SOC Analyst', label: 'Analyste cybersécurité' },
          { value: 'Pentester / Ethical Hacker', label: 'Pentester' },
          { value: 'Chef de projet IT / Scrum Master', label: 'Chef de projet IT' },
          { value: 'Product Owner', label: 'Product Owner' },
          { value: 'Product Manager', label: 'Product Manager' },
          { value: 'Technicien informatique', label: 'Technicien informatique' },
          { value: 'Technicien helpdesk / Support IT', label: 'Support IT' },
          { value: 'Technicien réseau', label: 'Technicien réseau' },
          { value: 'Ingénieur QA / Testeur logiciel', label: 'Ingénieur QA' },
          { value: 'Ingénieur IA / Machine Learning', label: 'Ingénieur IA' },
          { value: 'Ingénieur Big Data', label: 'Ingénieur Big Data' },
          { value: 'Ingénieur blockchain', label: 'Ingénieur blockchain' },
          { value: 'Designer UI/UX', label: 'Designer UI/UX' },
          { value: 'Designer produit', label: 'Designer produit' },
          { value: 'Graphiste / Designer graphique', label: 'Graphiste' },
          { value: 'Motion Designer', label: 'Motion Designer' },
          { value: 'Webmaster', label: 'Webmaster' },
          { value: 'Webdesigner', label: 'Webdesigner' },
          { value: 'Consultant IT', label: 'Consultant IT' },
          { value: 'Consultant SAP', label: 'Consultant SAP' },
          { value: 'Intégrateur web', label: 'Intégrateur web' },
          { value: 'Ingénieur ERP', label: 'Ingénieur ERP' },
          { value: 'Analyste programmeur', label: 'Analyste programmeur' },
          { value: 'Chef de projet digital', label: 'Chef de projet digital' },
          { value: 'Responsable informatique / DSI', label: 'Responsable informatique' },
          { value: 'CTO (Chief Technology Officer)', label: 'CTO' },
          { value: 'Architecte réseau', label: 'Architecte réseau' },
          { value: 'Ingénieur télécom', label: 'Ingénieur télécom' },

          // ═══ 💼 FINANCE & COMPTABILITÉ (50+ métiers) ═══
          { value: '─── 💼 FINANCE & COMPTABILITÉ ───', label: '─── 💼 FINANCE & COMPTABILITÉ ───' },
          { value: 'Comptable', label: 'Comptable' },
          { value: 'Assistant comptable', label: 'Assistant comptable' },
          { value: 'Aide-comptable', label: 'Aide-comptable' },
          { value: 'Chef comptable', label: 'Chef comptable' },
          { value: 'Responsable comptable', label: 'Responsable comptable' },
          { value: 'Expert-comptable', label: 'Expert-comptable' },
          { value: 'Contrôleur de gestion', label: 'Contrôleur de gestion' },
          { value: 'Analyste financier', label: 'Analyste financier' },
          { value: 'Auditeur interne', label: 'Auditeur interne' },
          { value: 'Auditeur externe', label: 'Auditeur externe' },
          { value: 'Commissaire aux comptes', label: 'Commissaire aux comptes' },
          { value: 'Directeur financier / DAF / CFO', label: 'Directeur financier' },
          { value: 'Responsable administratif et financier / RAF', label: 'RAF' },
          { value: 'Trésorier', label: 'Trésorier' },
          { value: 'Credit Manager', label: 'Credit Manager' },
          { value: 'Risk Manager', label: 'Risk Manager' },
          { value: 'Chargé de recouvrement', label: 'Chargé de recouvrement' },
          { value: 'Fiscaliste', label: 'Fiscaliste' },
          { value: 'Conseiller fiscal', label: 'Conseiller fiscal' },
          { value: 'Analyste crédit', label: 'Analyste crédit' },
          { value: 'Gestionnaire de paie', label: 'Gestionnaire de paie' },
          { value: 'Responsable paie', label: 'Responsable paie' },
          { value: 'Agent de crédit (microfinance)', label: 'Agent de crédit' },
          { value: 'Conseiller clientèle banque', label: 'Conseiller bancaire' },
          { value: 'Chargé de clientèle banque', label: 'Chargé de clientèle banque' },
          { value: 'Gestionnaire de portefeuille', label: 'Gestionnaire de portefeuille' },
          { value: 'Trader', label: 'Trader' },
          { value: 'Analyste financier marché', label: 'Analyste financier marché' },
          { value: 'Chargé d\'études financières', label: 'Chargé d\'études financières' },
          { value: 'Contrôleur budgétaire', label: 'Contrôleur budgétaire' },
          { value: 'Responsable consolidation', label: 'Responsable consolidation' },

          // ═══ 📊 COMMERCE & VENTE (60+ métiers) ═══
          { value: '─── 📊 COMMERCE & VENTE ───', label: '─── 📊 COMMERCE & VENTE ───' },
          { value: 'Commercial / Attaché commercial', label: 'Commercial' },
          { value: 'Vendeur / Vendeuse', label: 'Vendeur' },
          { value: 'Conseiller de vente', label: 'Conseiller de vente' },
          { value: 'Télévendeur / Téléconseiller', label: 'Télévendeur' },
          { value: 'Commercial terrain', label: 'Commercial terrain' },
          { value: 'Commercial sédentaire', label: 'Commercial sédentaire' },
          { value: 'Technico-commercial', label: 'Technico-commercial' },
          { value: 'Ingénieur commercial', label: 'Ingénieur commercial' },
          { value: 'Chef des ventes', label: 'Chef des ventes' },
          { value: 'Responsable commercial', label: 'Responsable commercial' },
          { value: 'Directeur commercial', label: 'Directeur commercial' },
          { value: 'Business Developer', label: 'Business Developer' },
          { value: 'Chargé d\'affaires', label: 'Chargé d\'affaires' },
          { value: 'Account Manager', label: 'Account Manager' },
          { value: 'Key Account Manager', label: 'Key Account Manager' },
          { value: 'Area Manager', label: 'Area Manager' },
          { value: 'Sales Manager', label: 'Sales Manager' },
          { value: 'Délégué commercial', label: 'Délégué commercial' },
          { value: 'Délégué médical / Visiteur médical', label: 'Délégué médical' },
          { value: 'Délégué pharmaceutique', label: 'Délégué pharmaceutique' },
          { value: 'Représentant commercial', label: 'Représentant commercial' },
          { value: 'Agent commercial indépendant', label: 'Agent commercial' },
          { value: 'Promoteur des ventes', label: 'Promoteur des ventes' },
          { value: 'Merchandiser', label: 'Merchandiser' },
          { value: 'Chef de rayon', label: 'Chef de rayon' },
          { value: 'Chef de secteur', label: 'Chef de secteur' },
          { value: 'Superviseur ventes', label: 'Superviseur ventes' },
          { value: 'Caissier / Caissière', label: 'Caissier' },
          { value: 'Hôte / Hôtesse de caisse', label: 'Hôte de caisse' },
          { value: 'Gérant de magasin', label: 'Gérant de magasin' },
          { value: 'Responsable de boutique', label: 'Responsable de boutique' },
          { value: 'Directeur de magasin', label: 'Directeur de magasin' },
          { value: 'Acheteur', label: 'Acheteur' },
          { value: 'Approvisionneur', label: 'Approvisionneur' },
          { value: 'Négociateur immobilier', label: 'Négociateur immobilier' },
          { value: 'Agent immobilier', label: 'Agent immobilier' },

          // ═══ 📢 MARKETING & COMMUNICATION (40+ métiers) ═══
          { value: '─── 📢 MARKETING & COMMUNICATION ───', label: '─── 📢 MARKETING & COMMUNICATION ───' },
          { value: 'Chargé de marketing', label: 'Chargé de marketing' },
          { value: 'Chef de produit / Product Manager', label: 'Chef de produit' },
          { value: 'Responsable marketing', label: 'Responsable marketing' },
          { value: 'Directeur marketing', label: 'Directeur marketing' },
          { value: 'Chef de projet marketing', label: 'Chef de projet marketing' },
          { value: 'Traffic Manager', label: 'Traffic Manager' },
          { value: 'Growth Hacker', label: 'Growth Hacker' },
          { value: 'Responsable CRM', label: 'Responsable CRM' },
          { value: 'Chargé d\'études marketing', label: 'Chargé d\'études marketing' },
          { value: 'Analyste marketing', label: 'Analyste marketing' },
          { value: 'Community Manager', label: 'Community Manager' },
          { value: 'Social Media Manager', label: 'Social Media Manager' },
          { value: 'Content Manager', label: 'Content Manager' },
          { value: 'Rédacteur web / Content Writer', label: 'Rédacteur web' },
          { value: 'Copywriter', label: 'Copywriter' },
          { value: 'SEO Manager / Référenceur', label: 'SEO Manager' },
          { value: 'SEM / SEA Specialist', label: 'SEM Specialist' },
          { value: 'Digital Marketing Manager', label: 'Digital Marketing Manager' },
          { value: 'Responsable e-commerce', label: 'Responsable e-commerce' },
          { value: 'Webmarketeur', label: 'Webmarketeur' },
          { value: 'Brand Manager', label: 'Brand Manager' },
          { value: 'Chargé de communication', label: 'Chargé de communication' },
          { value: 'Responsable communication', label: 'Responsable communication' },
          { value: 'Directeur de la communication', label: 'Directeur de la communication' },
          { value: 'Attaché de presse', label: 'Attaché de presse' },
          { value: 'Chargé de relations publiques', label: 'Chargé de relations publiques' },
          { value: 'Event Manager / Chargé d\'événementiel', label: 'Event Manager' },
          { value: 'Graphiste publicitaire', label: 'Graphiste publicitaire' },
          { value: 'Directeur artistique', label: 'Directeur artistique' },
          { value: 'Media Planner', label: 'Media Planner' },

          // J'inclus le reste des métiers depuis ton texte (tronqué pour la longueur)
          // ... (tous les autres secteurs que tu as fournis)

          { value: 'Autre métier', label: 'Autre métier' },
        ],
      },

      // ✅ FILTRE 3 : Type de contrat
      {
        id: 'typeContrat',
        label: 'Type de contrat',
        type: 'select',
        options: [
          { value: 'CDI (Contrat à Durée Indéterminée)', label: 'CDI' },
          { value: 'CDD (Contrat à Durée Déterminée)', label: 'CDD' },
          { value: 'Stage / Internship', label: 'Stage' },
          { value: 'Freelance / Indépendant', label: 'Freelance' },
          { value: 'Intérim / Travail temporaire', label: 'Intérim' },
          { value: 'Alternance (Contrat pro / Apprentissage)', label: 'Alternance' },
          { value: 'Contrat de professionnalisation', label: 'Contrat pro' },
          { value: 'Apprentissage', label: 'Apprentissage' },
          { value: 'Contrat saisonnier', label: 'Saisonnier' },
          { value: 'Vacation / Contractuel', label: 'Vacation' },
          { value: 'Consultant externe', label: 'Consultant' },
          { value: 'Service civique', label: 'Service civique' },
          { value: 'Bénévolat / Volontariat', label: 'Bénévolat' },
        ],
      },

      // ✅ FILTRE 4 : Type d'emploi (mode de travail)
      {
        id: 'typeEmploi',
        label: 'Mode de travail',
        type: 'select',
        options: [
          { value: 'Temps plein (35-40h/semaine)', label: 'Temps plein' },
          { value: 'Temps partiel (< 35h/semaine)', label: 'Temps partiel' },
          { value: 'Mi-temps (20h/semaine)', label: 'Mi-temps' },
          { value: 'Télétravail complet (100% remote)', label: 'Télétravail 100%' },
          { value: 'Hybride (Télétravail + Présentiel)', label: 'Hybride' },
          { value: 'Sur site uniquement (Présentiel)', label: 'Sur site uniquement' },
          { value: 'Horaires flexibles', label: 'Horaires flexibles' },
          { value: 'Horaires fixes', label: 'Horaires fixes' },
          { value: 'Travail de nuit', label: 'Travail de nuit' },
          { value: 'Travail en équipe (3x8, 2x8)', label: 'Travail en équipe' },
          { value: 'Week-end uniquement', label: 'Week-end uniquement' },
        ],
      },

      // ✅ FILTRE 5 : Niveau d'expérience
      {
        id: 'niveauExperience',
        label: 'Expérience requise',
        type: 'select',
        options: [
          { value: 'Débutant accepté / Sans expérience', label: 'Débutant accepté' },
          { value: 'Junior (< 1 an)', label: 'Junior (< 1 an)' },
          { value: '1-2 ans d\'expérience', label: '1-2 ans' },
          { value: '2-5 ans d\'expérience', label: '2-5 ans' },
          { value: '5-10 ans d\'expérience', label: '5-10 ans' },
          { value: '10-15 ans d\'expérience', label: '10-15 ans' },
          { value: '15+ ans (Expert/Senior)', label: '15+ ans (Expert)' },
          { value: 'Peu importe (tous niveaux)', label: 'Tous niveaux' },
        ],
      },

      // ✅ FILTRE 6 : Salaire (fourchette)
      {
        id: 'salaireMin',
        label: 'Salaire minimum (XAF)',
        type: 'range',
        min: 0,
        max: 10000000,
        unit: 'XAF',
      },
      {
        id: 'salaireMax',
        label: 'Salaire maximum (XAF)',
        type: 'range',
        min: 50000,
        max: 20000000,
        unit: 'XAF',
      },

      // ✅ FILTRE 7 : Diplôme requis
      {
        id: 'diplomeRequis',
        label: 'Diplôme requis',
        type: 'select',
        options: [
          { value: 'Aucun diplôme requis', label: 'Aucun diplôme' },
          { value: 'BEPC/Brevet', label: 'BEPC/Brevet' },
          { value: 'Baccalauréat (BAC)', label: 'Baccalauréat' },
          { value: 'BTS / DUT / Bac+2', label: 'BTS/DUT (Bac+2)' },
          { value: 'Licence / Bachelor / Bac+3', label: 'Licence (Bac+3)' },
          { value: 'Master / Bac+5', label: 'Master (Bac+5)' },
          { value: 'Doctorat / PhD / Bac+8', label: 'Doctorat (PhD)' },
          { value: 'MBA', label: 'MBA' },
          { value: 'Diplôme d\'ingénieur', label: 'Diplôme d\'ingénieur' },
          { value: 'Formation professionnelle certifiante', label: 'Formation pro certifiante' },
        ],
      },

      // ✅ FILTRE 8 : Langues requises
      {
        id: 'languesRequises',
        label: 'Langues requises',
        type: 'multiselect',
        options: [
          { value: 'Français (obligatoire)', label: 'Français' },
          { value: 'Anglais (obligatoire)', label: 'Anglais' },
          { value: 'Bilingue Français-Anglais', label: 'Bilingue Fr-En' },
          { value: 'Espagnol', label: 'Espagnol' },
          { value: 'Allemand', label: 'Allemand' },
          { value: 'Arabe', label: 'Arabe' },
          { value: 'Chinois (Mandarin)', label: 'Chinois' },
          { value: 'Portugais', label: 'Portugais' },
          { value: 'Italien', label: 'Italien' },
          { value: 'Langues locales africaines', label: 'Langues locales' },
        ],
      },

      // ✅ FILTRE 9 : Lieu de travail (système intelligent avec TOUS les quartiers africains)
      {
        id: 'lieuTravail',
        label: 'Lieu de travail',
        type: 'select',
        options: genererZonesIntervention('CM').map(zone => ({ value: zone, label: zone })),
      },

      // ✅ FILTRE 10 : Avantages sociaux
      {
        id: 'avantagesSociaux',
        label: 'Avantages offerts',
        type: 'multiselect',
        options: [
          { value: 'Assurance santé / Mutuelle', label: 'Assurance santé' },
          { value: 'Assurance vie', label: 'Assurance vie' },
          { value: 'Primes de performance', label: 'Primes' },
          { value: '13ème mois', label: '13ème mois' },
          { value: '14ème mois', label: '14ème mois' },
          { value: 'Tickets restaurant / Cantine', label: 'Tickets restaurant' },
          { value: 'Véhicule de fonction', label: 'Véhicule de fonction' },
          { value: 'Téléphone professionnel', label: 'Téléphone pro' },
          { value: 'Ordinateur portable fourni', label: 'Ordinateur fourni' },
          { value: 'Formation continue payée', label: 'Formation continue' },
          { value: 'Congés payés (30 jours+)', label: 'Congés payés' },
          { value: 'RTT (Réduction Temps Travail)', label: 'RTT' },
          { value: 'Pension de retraite', label: 'Pension retraite' },
          { value: 'Logement fourni', label: 'Logement fourni' },
          { value: 'Allocation transport', label: 'Allocation transport' },
          { value: 'Allocation logement', label: 'Allocation logement' },
          { value: 'Bonus annuel', label: 'Bonus annuel' },
          { value: 'Stock-options / Participation', label: 'Stock-options' },
          { value: 'Salle de sport / Gym', label: 'Salle de sport' },
          { value: 'Crèche d\'entreprise', label: 'Crèche' },
        ],
      },

      // ✅ FILTRE 11 : Secteur entreprise
      {
        id: 'secteurEntreprise',
        label: 'Type d\'entreprise',
        type: 'select',
        options: [
          { value: 'Startup / Scale-up', label: 'Startup' },
          { value: 'PME (Petite/Moyenne Entreprise)', label: 'PME' },
          { value: 'Grande entreprise / Corporate', label: 'Grande entreprise' },
          { value: 'Multinationale', label: 'Multinationale' },
          { value: 'ONG / Association', label: 'ONG/Association' },
          { value: 'Administration publique', label: 'Administration publique' },
          { value: 'Entreprise familiale', label: 'Entreprise familiale' },
          { value: 'Agence / Cabinet conseil', label: 'Agence/Cabinet' },
        ],
      },

      // ✅ FILTRE 12 : Date publication
      {
        id: 'datePublication',
        label: 'Date de publication',
        type: 'select',
        options: [
          { value: 'Moins de 24h', label: 'Dernières 24h' },
          { value: 'Moins de 3 jours', label: 'Derniers 3 jours' },
          { value: 'Moins d\'1 semaine', label: 'Dernière semaine' },
          { value: 'Moins de 2 semaines', label: '2 dernières semaines' },
          { value: 'Moins d\'1 mois', label: 'Dernier mois' },
          { value: 'Toutes les offres', label: 'Toutes' },
        ],
      },

      // ✅ FILTRE 13 : Télétravail possible
      {
        id: 'teletravail',
        label: 'Télétravail',
        type: 'toggle',
      },

      // ✅ FILTRE 14 : Urgence recrutement
      {
        id: 'urgence',
        label: 'Recrutement urgent',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#3B82F6',
      gradientColors: ['#3B82F6', '#2563EB'],
      icon: '💼',
      badgeColor: '#DBEAFE',
      accentColor: '#2563EB',
    },
    displayPriority: ['metierPoste', 'typeContrat', 'secteurActivite', 'salaireMin', 'lieuTravail', 'niveauExperience'],
    contactMethods: ['message', 'whatsapp', 'phone', 'email'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    supportsVariants: false, // Pas de variantes pour les offres d'emploi
    searchKeywords: [
      'emploi', 'job', 'recrutement', 'offre', 'poste', 'travail', 'career', 'hiring',
      'CDI', 'CDD', 'stage', 'freelance', 'intérim', 'alternance',
      'informatique', 'IT', 'développeur', 'ingénieur', 'commercial', 'comptable',
      'vente', 'marketing', 'RH', 'juridique', 'BTP', 'santé', 'éducation',
      'hôtellerie', 'restauration', 'logistique', 'transport', 'agriculture'
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 📚 SOUTIEN SCOLAIRE / RÉPÉTITEUR - AFRIQUE FRANCOPHONE
  // ════════════════════════════════════════════════════════════
  // Cours particuliers primaire/secondaire, Aide aux devoirs,
  // Rattrapage scolaire, Répétiteur niveau Maternelle → Terminale
  // ⚠️ DIFFÉRENT DE : Formation professionnelle et Préparation concours (formation_education)
  // ════════════════════════════════════════════════════════════
  soutien_scolaire_repetiteur: {
    terminology: {
      productLabel: 'Service de Soutien Scolaire',
      productsLabel: 'Services de Soutien Scolaire',
      priceLabel: 'Tarif',
      locationLabel: 'Lieu des cours',
      providerLabel: 'Répétiteur',
      searchPlaceholder: 'Rechercher un répétiteur, cours particuliers, aide aux devoirs...',
      emptyMessage: 'Aucun répétiteur disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Type de soutien
      {
        id: 'typeSoutien',
        label: 'Type de soutien',
        type: 'select',
        options: [
          { value: 'Cours particuliers à domicile', label: 'Cours à domicile' },
          { value: 'Cours particuliers en ligne', label: 'Cours en ligne' },
          { value: 'Aide aux devoirs', label: 'Aide aux devoirs' },
          { value: 'Rattrapage scolaire', label: 'Rattrapage' },
          { value: 'Révisions examens (BEPC, Probatoire, Bac)', label: 'Révisions examens' },
          { value: 'Cours de vacances intensifs', label: 'Cours vacances' },
          { value: 'Remise à niveau', label: 'Remise à niveau' },
          { value: 'Méthodologie & organisation', label: 'Méthodologie' },
        ],
      },

      // ✅ FILTRE 2 : Niveaux scolaires (multiselect)
      {
        id: 'niveauxScolaires',
        label: 'Niveaux enseignés',
        type: 'multiselect',
        options: [
          { value: 'CP (Cours Préparatoire)', label: 'CP' },
          { value: 'CE1', label: 'CE1' },
          { value: 'CE2', label: 'CE2' },
          { value: 'CM1', label: 'CM1' },
          { value: 'CM2', label: 'CM2' },
          { value: '6ème', label: '6ème' },
          { value: '5ème', label: '5ème' },
          { value: '4ème', label: '4ème' },
          { value: '3ème', label: '3ème' },
          { value: 'Seconde', label: 'Seconde' },
          { value: 'Première', label: 'Première' },
          { value: 'Terminale', label: 'Terminale' },
          { value: '📚 Tous niveaux (Maternelle → Terminale)', label: 'Tous niveaux' },
        ],
      },

      // ✅ FILTRE 3 : Matières enseignées (multiselect)
      {
        id: 'matieresEnseignees',
        label: 'Matières',
        type: 'multiselect',
        options: [
          { value: 'Mathématiques', label: 'Mathématiques' },
          { value: 'Français', label: 'Français' },
          { value: 'Anglais', label: 'Anglais' },
          { value: 'Physique', label: 'Physique' },
          { value: 'Chimie', label: 'Chimie' },
          { value: 'SVT (Sciences de la Vie et de la Terre)', label: 'SVT' },
          { value: 'Histoire-Géographie', label: 'Histoire-Géo' },
          { value: 'Philosophie (Terminale)', label: 'Philosophie' },
          { value: 'Sciences économiques et sociales (SES)', label: 'SES' },
          { value: 'Aide aux devoirs (toutes matières)', label: 'Aide aux devoirs' },
        ],
      },

      // ✅ FILTRE 4 : Format
      {
        id: 'formatSoutien',
        label: 'Format',
        type: 'select',
        options: [
          { value: 'À domicile (déplacement du répétiteur)', label: 'À domicile' },
          { value: 'Au domicile du répétiteur', label: 'Chez le répétiteur' },
          { value: 'En ligne (visioconférence)', label: 'En ligne' },
          { value: 'Hybride (présentiel + en ligne)', label: 'Hybride' },
          { value: 'Dans un centre/école', label: 'En centre' },
        ],
      },

      // ✅ FILTRE 5 : Durée séance
      {
        id: 'dureeSeance',
        label: 'Durée séance',
        type: 'select',
        options: [
          { value: '1 heure (cours standard)', label: '1h' },
          { value: '1h30 (cours approfondi)', label: '1h30' },
          { value: '2 heures (cours double)', label: '2h' },
          { value: '2h30', label: '2h30' },
          { value: '3 heures', label: '3h' },
        ],
      },

      // ✅ FILTRE 6 : Modalité déplacement
      {
        id: 'modaliteDeplacement',
        label: 'Déplacement',
        type: 'select',
        options: [
          { value: 'Je me déplace au domicile de l\'élève', label: 'Déplacement répétiteur' },
          { value: 'L\'élève vient chez moi', label: 'Chez le répétiteur' },
          { value: 'Cours en ligne uniquement (pas de déplacement)', label: 'En ligne uniquement' },
          { value: 'Les deux (domicile ou chez moi)', label: 'Les deux' },
        ],
      },

      // ✅ FILTRE 7 : Disponibilité
      {
        id: 'disponibilite',
        label: 'Disponibilité',
        type: 'multiselect',
        options: [
          { value: 'Après-midi (sortie école)', label: 'Après-midi' },
          { value: 'Soir (18h-21h)', label: 'Soir' },
          { value: 'Mercredi après-midi', label: 'Mercredi' },
          { value: 'Week-end (samedi-dimanche)', label: 'Week-end' },
          { value: 'Vacances scolaires', label: 'Vacances' },
        ],
      },

      // ✅ FILTRE 8 : Mode tarification
      {
        id: 'modeTarification',
        label: 'Mode tarification',
        type: 'select',
        options: [
          { value: 'Tarif horaire (par heure)', label: 'Horaire' },
          { value: 'Tarif par séance (1h-2h)', label: 'Par séance' },
          { value: 'Forfait mensuel (4 semaines)', label: 'Forfait mensuel' },
          { value: 'Forfait trimestriel (3 mois)', label: 'Forfait trimestriel' },
          { value: 'Stage vacances (prix global)', label: 'Stage vacances' },
        ],
      },

      // ✅ FILTRE 9 : Expérience
      {
        id: 'niveauExperience',
        label: 'Expérience',
        type: 'select',
        options: [
          { value: 'Étudiant universitaire', label: 'Étudiant' },
          { value: '1-2 ans d\'expérience', label: '1-2 ans' },
          { value: '3-5 ans d\'expérience', label: '3-5 ans' },
          { value: '5-10 ans d\'expérience', label: '5-10 ans' },
          { value: 'Enseignant en activité', label: 'Enseignant' },
          { value: 'Professeur certifié', label: 'Professeur certifié' },
        ],
      },
    ],
    style: {
      primaryColor: '#10B981',
      gradientColors: ['#10B981', '#059669'],
      icon: '📚',
      badgeColor: '#D1FAE5',
      accentColor: '#059669',
    },
    displayPriority: ['typeSoutien', 'niveauxScolaires', 'matieresEnseignees', 'formatSoutien', 'prix'],
    contactMethods: ['message', 'whatsapp', 'phone'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    searchKeywords: ['répétiteur', 'professeur particulier', 'cours particuliers', 'aide devoirs', 'soutien scolaire', 'rattrapage'],
  },

  // ════════════════════════════════════════════════════════════
  // 🎓 FORMATION & ÉDUCATION - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
  // ════════════════════════════════════════════════════════════
  // Formation professionnelle, Préparation concours grandes écoles,
  // Langues, Informatique, Métiers techniques
  // ⚠️ DIFFÉRENT DE : Soutien scolaire primaire/secondaire (soutien_scolaire_repetiteur)
  // ════════════════════════════════════════════════════════════
  formation_education: {
    terminology: {
      productLabel: 'Formation',
      productsLabel: 'Formations',
      priceLabel: 'Tarif',
      locationLabel: 'Lieu de formation',
      providerLabel: 'Formateur',
      searchPlaceholder: 'Rechercher une formation, cours, préparation...',
      emptyMessage: 'Aucune formation disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Type de formation (30+ options)
      {
        id: 'typeFormation',
        label: 'Type de formation',
        type: 'select',
        options: [
          { value: 'Cours particuliers (toutes matières)', label: 'Cours particuliers' },
          { value: 'Aide aux devoirs', label: 'Aide aux devoirs' },
          { value: 'Rattrapage scolaire', label: 'Rattrapage scolaire' },
          { value: 'Cours de vacances (intensif)', label: 'Cours de vacances' },
          { value: 'Préparation examens (BEPC, Probatoire, Bac)', label: 'Préparation examens' },
          { value: 'Préparation concours grandes écoles', label: 'Préparation concours' },
          { value: 'Formation diplômante', label: 'Formation diplômante' },
          { value: 'Formation certifiante', label: 'Formation certifiante' },
          { value: 'Informatique & Bureautique', label: 'Informatique & Bureautique' },
          { value: 'Programmation & Développement', label: 'Programmation' },
          { value: 'Langues étrangères', label: 'Langues étrangères' },
          { value: 'Marketing digital', label: 'Marketing digital' },
          { value: 'Mécanique automobile', label: 'Mécanique auto' },
          { value: 'Électricité & Électronique', label: 'Électricité' },
          { value: 'Mode & Couture', label: 'Couture' },
          { value: 'Cuisine & Pâtisserie', label: 'Cuisine' },
        ],
      },

      // ✅ FILTRE 2 : Format de formation (20+ options)
      {
        id: 'formatFormation',
        label: 'Format',
        type: 'multiselect',
        options: [
          { value: 'Cours particuliers (1-1)', label: 'Cours particuliers (1-1)' },
          { value: 'Cours en petit groupe (3-5 élèves)', label: 'Petit groupe (3-5)' },
          { value: 'Présentiel uniquement', label: 'Présentiel' },
          { value: 'En ligne uniquement (distanciel)', label: 'En ligne' },
          { value: 'Hybride (présentiel + en ligne)', label: 'Hybride' },
          { value: 'À domicile (déplacement formateur)', label: 'À domicile' },
          { value: 'En centre de formation', label: 'En centre' },
          { value: 'Stage intensif (1-2 semaines)', label: 'Stage intensif' },
          { value: 'Bootcamp (formation accélérée)', label: 'Bootcamp' },
        ],
      },

      // ✅ FILTRE 3 : Durée de formation (15+ options)
      {
        id: 'dureeFormation',
        label: 'Durée',
        type: 'select',
        options: [
          { value: '1 heure (cours unique)', label: '1 heure' },
          { value: '1 jour (journée complète)', label: '1 jour' },
          { value: '1 semaine (5 jours)', label: '1 semaine' },
          { value: '2 semaines', label: '2 semaines' },
          { value: '1 mois (4 semaines)', label: '1 mois' },
          { value: '3 mois (1 trimestre)', label: '3 mois' },
          { value: '6 mois (1 semestre)', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: 'À la carte (durée flexible)', label: 'Flexible' },
        ],
      },

      // ✅ FILTRE 4 : Rythme de formation (12+ options)
      {
        id: 'rythmeFormation',
        label: 'Rythme',
        type: 'select',
        options: [
          { value: 'Intensif (tous les jours)', label: 'Intensif' },
          { value: 'Semi-intensif (3-4 fois/semaine)', label: 'Semi-intensif' },
          { value: 'Régulier (2 fois/semaine)', label: 'Régulier' },
          { value: 'Hebdomadaire (1 fois/semaine)', label: 'Hebdomadaire' },
          { value: 'Week-end (samedi-dimanche)', label: 'Week-end' },
          { value: 'Horaires flexibles (à définir)', label: 'Flexible' },
        ],
      },

      // ✅ NOUVEAU FILTRE 5 : Horaires de formation
      {
        id: 'horairesFormation',
        label: 'Horaires',
        type: 'multiselect',
        options: [
          { value: 'Matin (8h-12h)', label: 'Matin (8h-12h)' },
          { value: 'Après-midi (14h-18h)', label: 'Après-midi (14h-18h)' },
          { value: 'Soir (18h-21h)', label: 'Soir (18h-21h)' },
          { value: 'Week-end (samedi-dimanche)', label: 'Week-end' },
          { value: 'Vacances scolaires', label: 'Vacances' },
          { value: 'Horaires flexibles (à définir)', label: 'Flexible' },
        ],
      },

      // ✅ FILTRE 6 : Langues d'enseignement (10+ options)
      {
        id: 'languesEnseignement',
        label: 'Langue d\'enseignement',
        type: 'multiselect',
        options: [
          { value: 'Français (uniquement)', label: 'Français' },
          { value: 'Anglais (uniquement)', label: 'Anglais' },
          { value: 'Bilingue (Français-Anglais)', label: 'Bilingue (Fr-En)' },
          { value: 'Espagnol', label: 'Espagnol' },
          { value: 'Allemand', label: 'Allemand' },
          { value: 'Arabe', label: 'Arabe' },
          { value: 'Chinois', label: 'Chinois' },
        ],
      },

      // ✅ FILTRE 7 : Niveau de compétence (8 options)
      {
        id: 'niveauCompetence',
        label: 'Niveau de compétence',
        type: 'select',
        options: [
          { value: 'Grand débutant (aucune base)', label: 'Grand débutant' },
          { value: 'Débutant', label: 'Débutant' },
          { value: 'Intermédiaire', label: 'Intermédiaire' },
          { value: 'Intermédiaire-Avancé', label: 'Intermédiaire-Avancé' },
          { value: 'Avancé', label: 'Avancé' },
          { value: 'Expert', label: 'Expert' },
          { value: 'Professionnel', label: 'Professionnel' },
          { value: 'Tous niveaux (mixte)', label: 'Tous niveaux' },
        ],
      },

      // ✅ FILTRE 8 : Matières enseignées (cours particuliers, soutien scolaire)
      {
        id: 'matieresEnseignees',
        label: 'Matières',
        type: 'multiselect',
        options: [
          { value: 'Mathématiques (tous niveaux)', label: 'Mathématiques' },
          { value: 'Français', label: 'Français' },
          { value: 'Anglais', label: 'Anglais' },
          { value: 'Physique', label: 'Physique' },
          { value: 'Chimie', label: 'Chimie' },
          { value: 'SVT (Sciences de la Vie et de la Terre)', label: 'SVT' },
          { value: 'Histoire-Géographie', label: 'Histoire-Géo' },
          { value: 'Philosophie', label: 'Philosophie' },
          { value: 'Informatique / Bureautique', label: 'Informatique' },
          { value: 'Économie', label: 'Économie' },
          { value: 'Aide aux devoirs (toutes matières)', label: 'Aide aux devoirs' },
        ],
      },

      // ✅ FILTRE 9 : Niveaux scolaires (30+ options - contexte Cameroun)
      {
        id: 'niveauxScolaires',
        label: 'Niveaux enseignés',
        type: 'multiselect',
        options: [
          { value: 'CP (Cours Préparatoire)', label: 'CP' },
          { value: 'CE1', label: 'CE1' },
          { value: 'CE2', label: 'CE2' },
          { value: 'CM1', label: 'CM1' },
          { value: 'CM2', label: 'CM2' },
          { value: '6ème', label: '6ème' },
          { value: '5ème', label: '5ème' },
          { value: '4ème', label: '4ème' },
          { value: '3ème', label: '3ème' },
          { value: 'Seconde', label: 'Seconde' },
          { value: 'Première', label: 'Première' },
          { value: 'Terminale', label: 'Terminale' },
          { value: 'Licence 1 (L1)', label: 'Licence' },
          { value: 'Master 1 (M1)', label: 'Master' },
        ],
      },

      // ✅ FILTRE 10 : Préparation concours (grandes écoles)
      {
        id: 'concoursCibles',
        label: 'Préparation concours',
        type: 'multiselect',
        options: [
          { value: 'Polytechnique Yaoundé', label: 'Polytechnique Yaoundé' },
          { value: 'Polytechnique Douala', label: 'Polytechnique Douala' },
          { value: 'ENAM', label: 'ENAM' },
          { value: 'ENS Yaoundé', label: 'ENS Yaoundé' },
          { value: 'ESSEC Douala/Yaoundé', label: 'ESSEC' },
          { value: 'FMSB (Faculté de Médecine)', label: 'Médecine' },
          { value: 'IUT Douala', label: 'IUT' },
          { value: 'Polytechnique Paris', label: 'Polytechnique Paris' },
          { value: 'HEC Paris', label: 'HEC Paris' },
        ],
      },

      // ✅ NOUVEAU FILTRE 11 : Anciens sujets disponibles
      {
        id: 'anciensSujetsDisponibles',
        label: 'Anciens sujets disponibles',
        type: 'multiselect',
        options: [
          { value: 'Sujets 2024 (dernière session)', label: 'Sujets 2024' },
          { value: 'Sujets 2023', label: 'Sujets 2023' },
          { value: 'Sujets 2022', label: 'Sujets 2022' },
          { value: 'Sujets 2021', label: 'Sujets 2021' },
          { value: 'Sujets 2020', label: 'Sujets 2020' },
          { value: 'Archive complète (2000-2009)', label: 'Archive 2000-2009' },
          { value: 'Corrigés détaillés', label: 'Corrigés détaillés' },
          { value: 'Vidéos de correction', label: 'Vidéos correction' },
          { value: 'PDF numérique', label: 'PDF numérique' },
          { value: 'Copies physiques', label: 'Copies physiques' },
        ],
      },

      // ✅ NOUVEAU FILTRE 12 : Types de documents concours
      {
        id: 'typesDocumentsConcours',
        label: 'Types de documents',
        type: 'multiselect',
        options: [
          { value: 'Sujets d\'admissibilité', label: 'Sujets admissibilité' },
          { value: 'Sujets d\'admission', label: 'Sujets admission' },
          { value: 'Corrigés officiels', label: 'Corrigés officiels' },
          { value: 'Corrigés commentés', label: 'Corrigés commentés' },
          { value: 'Fiches de révision', label: 'Fiches révision' },
          { value: 'QCM d\'entraînement', label: 'QCM entraînement' },
          { value: 'Simulations d\'examen', label: 'Simulations' },
          { value: 'Statistiques de réussite', label: 'Statistiques' },
        ],
      },

      // ✅ FILTRE 10 : Certifications
      {
        id: 'certificationObtenue',
        label: 'Certification',
        type: 'select',
        options: [
          { value: 'Attestation de formation', label: 'Attestation' },
          { value: 'Certificat de formation', label: 'Certificat' },
          { value: 'Diplôme d\'État', label: 'Diplôme d\'État' },
          { value: 'TOEFL (anglais)', label: 'TOEFL' },
          { value: 'IELTS (anglais)', label: 'IELTS' },
          { value: 'DELF/DALF (français)', label: 'DELF/DALF' },
          { value: 'Microsoft Office Specialist (MOS)', label: 'MOS' },
          { value: 'CompTIA A+', label: 'CompTIA A+' },
          { value: 'Aucune certification (formation simple)', label: 'Sans certification' },
        ],
      },

      // ✅ FILTRE 14 : Public cible
      {
        id: 'publicCible',
        label: 'Public cible',
        type: 'multiselect',
        options: [
          { value: 'Enfants (Maternelle-Primaire)', label: 'Enfants' },
          { value: 'Collégiens (6ème-3ème)', label: 'Collégiens' },
          { value: 'Lycéens (Seconde-Terminale)', label: 'Lycéens' },
          { value: 'Étudiants (Licence)', label: 'Étudiants' },
          { value: 'Salariés en activité', label: 'Professionnels' },
          { value: 'Demandeurs d\'emploi', label: 'Demandeurs d\'emploi' },
          { value: 'Entrepreneurs', label: 'Entrepreneurs' },
          { value: 'Tout public (enfants, ados, adultes)', label: 'Tout public' },
        ],
      },

      // ✅ FILTRE 15 : Prix / Tarif
      {
        id: 'prix',
        label: 'Tarif (XAF)',
        type: 'range',
        min: 0,
        max: 500000,
        unit: 'XAF',
      },
    ],
    style: {
      primaryColor: '#7C3AED',
      gradientColors: ['#7C3AED', '#6D28D9'],
      icon: '🎓',
      badgeColor: '#EDE9FE',
      accentColor: '#6D28D9',
    },
    displayPriority: ['typeFormation', 'formatFormation', 'dureeFormation', 'certificationObtenue', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // ════════════════════════════════════════════════════════════
  // 👶 CRÈCHE & GARDERIE D'ENFANTS - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
  // ════════════════════════════════════════════════════════════
  // Accueil petite enfance (0-6 ans), Garde quotidienne, Éveil éducatif
  // Focus: Sécurité, Hygiène, Encadrement qualifié, Activités adaptées
  // Contexte: Normes africaines, langues locales, culture locale
  // ════════════════════════════════════════════════════════════
  creche_garderie: {
    terminology: {
      productLabel: 'Établissement',
      productsLabel: 'Crèches & Garderies',
      priceLabel: 'Tarif mensuel',
      locationLabel: 'Adresse',
      providerLabel: 'Établissement',
      searchPlaceholder: 'Rechercher une crèche, garderie, jardin d\'enfants...',
      emptyMessage: 'Aucun établissement disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
        date: 'Mieux notés',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Type d'établissement
      {
        id: 'typeEtablissement',
        label: 'Type d\'établissement',
        type: 'multiselect',
        options: [
          { value: '🏠 Crèche privée (accueil journée complète)', label: 'Crèche privée' },
          { value: '🏠 Garderie familiale (petit effectif)', label: 'Garderie familiale' },
          { value: '🏠 Micro-crèche (< 12 enfants)', label: 'Micro-crèche' },
          { value: '🏠 Halte-garderie (accueil occasionnel)', label: 'Halte-garderie' },
          { value: '🏠 Jardin d\'enfants', label: 'Jardin d\'enfants' },
          { value: '🏢 Crèche d\'entreprise', label: 'Crèche d\'entreprise' },
          { value: '🏢 Garderie inter-entreprises', label: 'Garderie inter-entreprises' },
          { value: '🏘️ Garderie communautaire', label: 'Garderie communautaire' },
          { value: '🏘️ Crèche associative', label: 'Crèche associative' },
          { value: '🎓 Crèche-école (maternelle intégrée)', label: 'Crèche-école' },
        ],
      },

      // ✅ FILTRE 2 : Tranches d'âge accueillies
      {
        id: 'tranchesAge',
        label: 'Tranches d\'âge accueillies',
        type: 'multiselect',
        options: [
          { value: '👶 Bébés (0-6 mois)', label: 'Bébés (0-6 mois)' },
          { value: '👶 Nourrissons (6-12 mois)', label: 'Nourrissons (6-12 mois)' },
          { value: '🧒 Enfants (1-2 ans)', label: 'Enfants (1-2 ans)' },
          { value: '🧒 Enfants (2-3 ans)', label: 'Enfants (2-3 ans)' },
          { value: '🧒 Enfants (3-4 ans)', label: 'Enfants (3-4 ans)' },
          { value: '👧 Grands (4-6 ans)', label: 'Grands (4-6 ans)' },
          { value: '👨‍👩‍👧 Toutes tranches (0-6 ans)', label: 'Toutes tranches (0-6 ans)' },
        ],
      },

      // ✅ FILTRE 3 : Horaires de garde
      {
        id: 'horairesGarde',
        label: 'Horaires de garde',
        type: 'multiselect',
        options: [
          { value: '⏰ Temps plein (7h-18h)', label: 'Temps plein (7h-18h)' },
          { value: '⏰ Temps plein étendu (6h-19h)', label: 'Étendu (6h-19h)' },
          { value: '⏰ Demi-journée matin (7h-12h)', label: 'Demi-journée matin' },
          { value: '⏰ Demi-journée après-midi (12h-18h)', label: 'Demi-journée après-midi' },
          { value: '⏰ Horaires flexibles (sur mesure)', label: 'Horaires flexibles' },
          { value: '⏰ Garde occasionnelle (à l\'heure)', label: 'Garde occasionnelle' },
          { value: '⏰ Garde de nuit (19h-7h)', label: 'Garde de nuit' },
          { value: '⏰ Garde week-end (samedi-dimanche)', label: 'Garde week-end' },
        ],
      },

      // ✅ FILTRE 4 : Jours de fonctionnement
      {
        id: 'joursFonctionnement',
        label: 'Jours de fonctionnement',
        type: 'select',
        options: [
          { value: '📅 Lundi à Vendredi (5 jours)', label: 'Lun-Ven (5 jours)' },
          { value: '📅 Lundi à Samedi (6 jours)', label: 'Lun-Sam (6 jours)' },
          { value: '📅 Toute la semaine (7j/7)', label: 'Toute la semaine (7j/7)' },
          { value: '📅 Ouvert jours fériés', label: 'Ouvert jours fériés' },
          { value: '📅 Ouvert vacances scolaires', label: 'Ouvert vacances' },
        ],
      },

      // ✅ FILTRE 5 : Capacité d'accueil
      {
        id: 'capaciteAccueil',
        label: 'Capacité d\'accueil',
        type: 'select',
        options: [
          { value: '👥 Très petit (1-5 enfants)', label: 'Très petit (1-5)' },
          { value: '👥 Petit (6-10 enfants)', label: 'Petit (6-10)' },
          { value: '👥 Moyen (11-20 enfants)', label: 'Moyen (11-20)' },
          { value: '👥 Grand (21-30 enfants)', label: 'Grand (21-30)' },
          { value: '👥 Très grand (31-50 enfants)', label: 'Très grand (31-50)' },
          { value: '👥 Structure importante (51-80 enfants)', label: 'Importante (51-80)' },
          { value: '👥 Grande structure (81-120 enfants)', label: 'Grande (81-120)' },
          { value: '👥 Centre petite enfance (120+ enfants)', label: 'Centre (120+)' },
        ],
      },

      // ✅ FILTRE 6 : Services proposés
      {
        id: 'servicesProproses',
        label: 'Services proposés',
        type: 'multiselect',
        options: [
          // Restauration
          { value: '🍽️ Repas complets (petit-déj + déjeuner + goûter)', label: 'Repas complets' },
          { value: '🍽️ Repas maison (cuisine sur place)', label: 'Repas maison' },
          { value: '🍽️ Régimes spéciaux (allergie, religion)', label: 'Régimes spéciaux' },

          // Repos & Hygiène
          { value: '😴 Sieste surveillée', label: 'Sieste surveillée' },
          { value: '😴 Couches fournies', label: 'Couches fournies' },

          // Santé & Sécurité
          { value: '🏥 Suivi médical régulier', label: 'Suivi médical' },
          { value: '🏥 Infirmière sur place', label: 'Infirmière sur place' },
          { value: '🏥 Premiers secours', label: 'Premiers secours' },

          // Transport
          { value: '🚐 Transport matin + soir (navette)', label: 'Transport (navette)' },

          // Communication
          { value: '📱 Suivi quotidien (WhatsApp/SMS)', label: 'Suivi quotidien' },
          { value: '📱 Photos/vidéos journalières', label: 'Photos/vidéos' },
          { value: '📱 Caméras surveillance (accès parents)', label: 'Caméras surveillance' },

          // Pédagogie
          { value: '🎓 Programme éducatif structuré', label: 'Programme éducatif' },
          { value: '🎓 Méthode Montessori', label: 'Méthode Montessori' },
          { value: '🎓 Préparation maternelle', label: 'Préparation maternelle' },
        ],
      },

      // ✅ FILTRE 7 : Activités proposées
      {
        id: 'activitesProposees',
        label: 'Activités proposées',
        type: 'multiselect',
        options: [
          // Créativité & Arts
          { value: '🎨 Dessin & peinture', label: 'Dessin & peinture' },
          { value: '🎨 Bricolage & collage', label: 'Bricolage & collage' },

          // Musique & Danse
          { value: '🎵 Éveil musical', label: 'Éveil musical' },
          { value: '🎵 Comptines africaines', label: 'Comptines africaines' },
          { value: '🎵 Danse & mouvement', label: 'Danse & mouvement' },

          // Langue & Communication
          { value: '📚 Contes & histoires', label: 'Contes & histoires' },
          { value: '📚 Éveil langues (français, anglais, langues locales)', label: 'Éveil langues' },

          // Jeux & Apprentissage
          { value: '🧩 Jeux éducatifs', label: 'Jeux éducatifs' },
          { value: '🧩 Jeux de construction (Lego, Kapla)', label: 'Jeux de construction' },

          // Sport & Motricité
          { value: '⚽ Motricité globale', label: 'Motricité globale' },
          { value: '⚽ Baby gym', label: 'Baby gym' },
          { value: '⚽ Activités extérieures quotidiennes', label: 'Activités extérieures' },

          // Culture Africaine
          { value: '🌍 Contes africains traditionnels', label: 'Contes africains' },
          { value: '🌍 Initiation langues maternelles', label: 'Langues maternelles' },
          { value: '🌍 Danses traditionnelles', label: 'Danses traditionnelles' },

          // Découverte Environnement
          { value: '🌳 Jardin potager', label: 'Jardin potager' },
          { value: '🌳 Découverte nature', label: 'Découverte nature' },
        ],
      },

      // ✅ FILTRE 8 : Langues parlées
      {
        id: 'languesParlees',
        label: 'Langues parlées',
        type: 'multiselect',
        options: [
          { value: '🗣️ Français', label: 'Français' },
          { value: '🗣️ Anglais', label: 'Anglais' },
          { value: '🗣️ Douala (Cameroun Littoral)', label: 'Douala' },
          { value: '🗣️ Ewondo (Cameroun Centre)', label: 'Ewondo' },
          { value: '🗣️ Bamiléké / Medumba (Ouest)', label: 'Bamiléké' },
          { value: '🗣️ Fulfuldé (Nord)', label: 'Fulfuldé' },
          { value: '🗣️ Pidgin English (Sud-Ouest)', label: 'Pidgin' },
          { value: '🗣️ Wolof (Sénégal)', label: 'Wolof' },
          { value: '🗣️ Lingala (Congo/RDC)', label: 'Lingala' },
          { value: '🗣️ Plusieurs langues locales', label: 'Plusieurs langues locales' },
        ],
      },

      // ✅ FILTRE 9 : Encadrement & Personnel
      {
        id: 'encadrementPersonnel',
        label: 'Encadrement & Personnel',
        type: 'multiselect',
        options: [
          { value: '👩‍🏫 Éducateurs diplômés petite enfance', label: 'Éducateurs diplômés' },
          { value: '👩‍🏫 Puéricultrices diplômées', label: 'Puéricultrices' },
          { value: '👩‍🏫 Personnel formé premiers secours', label: 'Formé premiers secours' },
          { value: '👨‍⚕️ Infirmière sur place', label: 'Infirmière sur place' },
          { value: '👥 Ratio adulte/enfant: 1 pour 5 enfants', label: 'Ratio 1/5' },
          { value: '👥 Ratio adulte/enfant: 1 pour 8 enfants', label: 'Ratio 1/8' },
        ],
      },

      // ✅ FILTRE 10 : Équipements & Infrastructures
      {
        id: 'equipementsInfrastructures',
        label: 'Équipements & Infrastructures',
        type: 'multiselect',
        options: [
          // Locaux
          { value: '🏠 Locaux climatisés', label: 'Climatisés' },
          { value: '🏠 Salles de jeux spacieuses', label: 'Salles spacieuses' },
          { value: '🏠 Dortoir séparé', label: 'Dortoir séparé' },
          { value: '🏠 Cuisine équipée', label: 'Cuisine équipée' },
          { value: '🏠 Espace extérieur sécurisé', label: 'Espace extérieur' },
          { value: '🏠 Jardin / Cour de jeux', label: 'Jardin / Cour' },

          // Sécurité
          { value: '🛡️ Portail sécurisé', label: 'Portail sécurisé' },
          { value: '🛡️ Gardien à l\'entrée', label: 'Gardien' },
          { value: '🛡️ Caméras de surveillance', label: 'Caméras' },
          { value: '🛡️ Clôture sécurisée', label: 'Clôture' },

          // Confort
          { value: '⚡ Groupe électrogène', label: 'Groupe électrogène' },
          { value: '⚡ Eau courante 24h/24', label: 'Eau 24h/24' },

          // Équipements Ludiques
          { value: '🎮 Jeux d\'extérieur (toboggan, balançoire)', label: 'Jeux d\'extérieur' },
          { value: '🎮 Aire de jeux couverte', label: 'Aire couverte' },
          { value: '🎮 Bibliothèque enfantine', label: 'Bibliothèque' },
        ],
      },

      // ✅ FILTRE 11 : Certifications & Agréments
      {
        id: 'certificationsAgrements',
        label: 'Certifications & Agréments',
        type: 'multiselect',
        options: [
          { value: '✅ Agréé Ministère Affaires Sociales', label: 'Agréé Ministère' },
          { value: '✅ Licence d\'exploitation valide', label: 'Licence valide' },
          { value: '✅ Normes sécurité respectées', label: 'Normes sécurité' },
          { value: '✅ Personnel diplômé certifié', label: 'Personnel certifié' },
          { value: '✅ Assurance responsabilité civile', label: 'Assurance RC' },
          { value: '✅ Hygiène certifiée', label: 'Hygiène certifiée' },
        ],
      },

      // ✅ FILTRE 12 : Modèle de tarification
      {
        id: 'modeleTarification',
        label: 'Modèle de tarification',
        type: 'multiselect',
        options: [
          { value: '💰 Tarif mensuel (forfait)', label: 'Mensuel (forfait)' },
          { value: '💰 Tarif hebdomadaire', label: 'Hebdomadaire' },
          { value: '💰 Tarif journalier', label: 'Journalier' },
          { value: '💰 Tarif horaire (garde occasionnelle)', label: 'Horaire' },
          { value: '💰 Forfait 2-3 jours/semaine', label: 'Forfait 2-3 jours' },
          { value: '💰 Réduction 2ème enfant (-10%)', label: 'Réduction 2ème enfant' },
          { value: '💰 Facilités de paiement', label: 'Facilités paiement' },
        ],
      },

      // ✅ FILTRE 13 : Gamme de prix
      {
        id: 'gammePrix',
        label: 'Gamme de prix',
        type: 'select',
        options: [
          { value: '💵 Économique (15 000 - 35 000 FCFA/mois)', label: 'Économique (15-35k)' },
          { value: '💵 Accessible (35 000 - 60 000 FCFA/mois)', label: 'Accessible (35-60k)' },
          { value: '💵 Standard (60 000 - 100 000 FCFA/mois)', label: 'Standard (60-100k)' },
          { value: '💵 Confort (100 000 - 150 000 FCFA/mois)', label: 'Confort (100-150k)' },
          { value: '💵 Premium (150 000 - 250 000 FCFA/mois)', label: 'Premium (150-250k)' },
          { value: '💵 Haut de gamme (250 000+ FCFA/mois)', label: 'Haut de gamme (250k+)' },
        ],
      },

      // ✅ FILTRE 14 : Avantages & Points forts
      {
        id: 'avantagesPointsForts',
        label: 'Avantages & Points forts',
        type: 'multiselect',
        options: [
          { value: '⭐ Personnel expérimenté (5+ ans)', label: 'Personnel expérimenté' },
          { value: '⭐ Petit effectif (suivi personnalisé)', label: 'Petit effectif' },
          { value: '⭐ Programme pédagogique structuré', label: 'Programme structuré' },
          { value: '⭐ Repas équilibrés maison', label: 'Repas maison' },
          { value: '⭐ Locaux neufs / récents', label: 'Locaux récents' },
          { value: '⭐ Environnement verdoyant', label: 'Environnement verdoyant' },
          { value: '⭐ Transport inclus', label: 'Transport inclus' },
          { value: '⭐ Horaires flexibles', label: 'Horaires flexibles' },
          { value: '⭐ Caméras avec accès parents', label: 'Caméras accès parents' },
          { value: '⭐ Activités culturelles africaines', label: 'Culture africaine' },
          { value: '⭐ Bilinguisme (français-anglais)', label: 'Bilinguisme' },
          { value: '⭐ Groupe électrogène 24h/24', label: 'Groupe électrogène' },
          { value: '⭐ Espace extérieur spacieux', label: 'Espace extérieur' },
        ],
      },

      // ✅ FILTRE 15 : Périodes d'inscription
      {
        id: 'periodesInscription',
        label: 'Périodes d\'inscription',
        type: 'multiselect',
        options: [
          { value: '📝 Inscriptions ouvertes toute l\'année', label: 'Ouvert toute l\'année' },
          { value: '📝 Rentrée septembre (année scolaire)', label: 'Rentrée septembre' },
          { value: '📝 Places disponibles immédiatement', label: 'Places immédiates' },
          { value: '📝 Visite & test d\'adaptation proposés', label: 'Visite & test adaptation' },
        ],
      },

      // ✅ FILTRE 16 : Types de contrat
      {
        id: 'typesContrat',
        label: 'Types de contrat',
        type: 'multiselect',
        options: [
          { value: '📄 Contrat annuel (année scolaire)', label: 'Annuel' },
          { value: '📄 Contrat mensuel renouvelable', label: 'Mensuel' },
          { value: '📄 Contrat à la carte (jours choisis)', label: 'À la carte' },
          { value: '📄 Contrat occasionnel (sans engagement)', label: 'Occasionnel' },
          { value: '📄 Période d\'essai (1 mois)', label: 'Période d\'essai' },
        ],
      },

      // ✅ FILTRE 17 : Prix mensuel (RANGE)
      {
        id: 'prixMensuel',
        label: 'Prix mensuel (FCFA)',
        type: 'range',
        min: 10000,
        max: 300000,
        unit: 'XAF',
      },

      // ✅ FILTRE 18 : Places disponibles immédiatement (TOGGLE)
      {
        id: 'placesDisponibles',
        label: 'Places disponibles immédiatement',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#F472B6',
      gradientColors: ['#F472B6', '#EC4899'],
      icon: '👶',
      badgeColor: '#FCE7F3',
      accentColor: '#EC4899',
    },
    displayPriority: ['typeEtablissement', 'tranchesAge', 'horairesGarde', 'capaciteAccueil', 'servicesProproses', 'gammePrix', 'certificationsAgrements'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    supportsVariants: false, // Pas de variantes pour les établissements
    searchKeywords: [
      'crèche', 'creche', 'garderie', 'garde enfants', 'petite enfance',
      'halte-garderie', 'micro-crèche', 'jardin enfants', 'nursery', 'daycare',
      'bébé', 'bebe', 'nourrisson', 'enfant', 'bambin', 'préscolaire',
      'éveil', 'éveil', 'pédagogie', 'pedagogie', 'Montessori',
      'garde journée', 'garde nuit', 'garde week-end', 'garde occasionnelle',
      'éducateurs', 'educateurs', 'puéricultrice', 'puericultrice',
      'encadrement', 'activités', 'activites', 'jeux', 'éveil musical',
      'repas', 'sieste', 'transport', 'navette',
      'agréé', 'agree', 'certifié', 'certifie', 'licence',
      'Douala', 'Yaoundé', 'Yaounde', 'Bafoussam', 'Garoua',
      'sécurité', 'securite', 'hygiène', 'hygiene', 'surveillance'
    ],
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
        type: 'select',
        options: [
          { value: 'Mariage', label: 'Mariage' },
          { value: 'Anniversaire', label: 'Anniversaire' },
          { value: 'Baptême', label: 'Baptême' },
          { value: 'Conférence', label: 'Conférence' },
          { value: 'Séminaire', label: 'Séminaire' },
          { value: 'Concert', label: 'Concert' },
          { value: 'Festival', label: 'Festival' },
          { value: 'Gala', label: 'Gala' },
          { value: 'Soirée d\'entreprise', label: 'Soirée d\'entreprise' },
          { value: 'Cocktail', label: 'Cocktail' },
        ],
      },
      {
        id: 'capaciteEvenement',
        label: 'Capacité',
        type: 'select',
        options: [
          { value: '10-50 personnes', label: '10-50 personnes' },
          { value: '50-100 personnes', label: '50-100 personnes' },
          { value: '100-200 personnes', label: '100-200 personnes' },
          { value: '200-500 personnes', label: '200-500 personnes' },
          { value: '500-1000 personnes', label: '500-1000 personnes' },
          { value: '1000+ personnes', label: '1000+ personnes' },
        ],
      },
      {
        id: 'servicesEvenement',
        label: 'Services inclus',
        type: 'multiselect',
        options: [
          { value: 'Location de salle', label: 'Location de salle' },
          { value: 'Traiteur', label: 'Traiteur' },
          { value: 'Décoration', label: 'Décoration' },
          { value: 'Animation', label: 'Animation' },
          { value: 'DJ', label: 'DJ' },
          { value: 'Photographe', label: 'Photographe' },
          { value: 'Vidéaste', label: 'Vidéaste' },
          { value: 'Sonorisation', label: 'Sonorisation' },
          { value: 'Éclairage', label: 'Éclairage' },
        ],
      },
      {
        id: 'equipementsEvenement',
        label: 'Équipements',
        type: 'multiselect',
        options: [
          { value: 'Projecteur', label: 'Projecteur' },
          { value: 'Écran', label: 'Écran' },
          { value: 'Micro', label: 'Micro' },
          { value: 'Scène', label: 'Scène' },
          { value: 'Tables', label: 'Tables' },
          { value: 'Chaises', label: 'Chaises' },
          { value: 'Climatisation', label: 'Climatisation' },
        ],
      },
      {
        id: 'dureeEvenement',
        label: 'Durée',
        type: 'select',
        options: [
          { value: 'Demi-journée', label: 'Demi-journée' },
          { value: 'Journée complète', label: 'Journée complète' },
          { value: 'Soirée', label: 'Soirée' },
          { value: 'Week-end', label: 'Week-end' },
          { value: 'Plusieurs jours', label: 'Plusieurs jours' },
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

  // ✈️ VOYAGE & TOURISME
  voyage_tourisme: {
    terminology: {
      productLabel: 'Séjour',
      productsLabel: 'Voyages & Tourisme',
      priceLabel: 'Prix',
      locationLabel: 'Destination',
      providerLabel: 'Agence',
      searchPlaceholder: 'Rechercher un voyage, séjour...',
      emptyMessage: 'Aucun voyage disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeVoyage',
        label: 'Type de voyage',
        type: 'select',
        options: [
          { value: 'Séjour balnéaire', label: 'Séjour balnéaire' },
          { value: 'Safari', label: 'Safari' },
          { value: 'Circuit touristique', label: 'Circuit touristique' },
          { value: 'Trek/Randonnée', label: 'Trek/Randonnée' },
          { value: 'City break', label: 'City break' },
          { value: 'Voyage culturel', label: 'Voyage culturel' },
          { value: 'Écotourisme', label: 'Écotourisme' },
          { value: 'Séjour détente', label: 'Séjour détente' },
        ],
      },
      {
        id: 'destinationVoyage',
        label: 'Destination',
        type: 'select',
        options: [
          { value: 'Kribi', label: 'Kribi' },
          { value: 'Limbé', label: 'Limbé' },
          { value: 'Parc Waza', label: 'Parc Waza' },
          { value: 'Mont Cameroun', label: 'Mont Cameroun' },
          { value: 'Foumban', label: 'Foumban' },
          { value: 'Maroua', label: 'Maroua' },
          { value: 'International', label: 'International' },
        ],
      },
      {
        id: 'dureeVoyage',
        label: 'Durée',
        type: 'select',
        options: [
          { value: '1 jour', label: '1 jour' },
          { value: '2-3 jours', label: '2-3 jours' },
          { value: '4-7 jours', label: '4-7 jours' },
          { value: '1-2 semaines', label: '1-2 semaines' },
          { value: '2-4 semaines', label: '2-4 semaines' },
        ],
      },
      {
        id: 'servicesVoyage',
        label: 'Services inclus',
        type: 'multiselect',
        options: [
          { value: 'Hébergement', label: 'Hébergement' },
          { value: 'Transport', label: 'Transport' },
          { value: 'Repas', label: 'Repas' },
          { value: 'Guide touristique', label: 'Guide touristique' },
          { value: 'Activités', label: 'Activités' },
          { value: 'Visites guidées', label: 'Visites guidées' },
          { value: 'Vol inclus', label: 'Vol inclus' },
        ],
      },
      {
        id: 'hebergementVoyage',
        label: 'Hébergement',
        type: 'select',
        options: [
          { value: 'Hôtel 3*', label: 'Hôtel 3*' },
          { value: 'Hôtel 4*', label: 'Hôtel 4*' },
          { value: 'Hôtel 5*', label: 'Hôtel 5*' },
          { value: 'Resort', label: 'Resort' },
          { value: 'Lodge', label: 'Lodge' },
          { value: 'Camping', label: 'Camping' },
        ],
      },
    ],
    style: {
      primaryColor: '#0EA5E9',
      gradientColors: ['#0EA5E9', '#0284C7'],
      icon: '✈️',
      badgeColor: '#E0F2FE',
      accentColor: '#0284C7',
    },
    displayPriority: ['typeVoyage', 'destinationVoyage', 'dureeVoyage', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: false,
    showRating: true,
    cardLayout: 'vertical',
  },

  // ⚡ ÉLECTRICITÉ
  electricite: {
    terminology: {
      productLabel: 'Article électrique',
      productsLabel: 'Électricité & Éclairage',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher câbles, prises, ampoules...',
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
          { value: 'Câblage et fils', label: 'Câblage et fils' },
          { value: 'Interrupteurs et commandes', label: 'Interrupteurs et commandes' },
          { value: 'Prises électriques', label: 'Prises électriques' },
          { value: 'Protection et tableaux', label: 'Protection et tableaux' },
          { value: 'Ampoules et tubes', label: 'Ampoules et tubes' },
          { value: 'Luminaires intérieurs', label: 'Luminaires intérieurs' },
          { value: 'Luminaires extérieurs', label: 'Luminaires extérieurs' },
          { value: 'Domotique et connecté', label: 'Domotique et connecté' },
        ],
      },
      {
        id: 'typeElectricite',
        label: 'Type d\'éclairage',
        type: 'select',
        options: [
          { value: 'Ampoule LED', label: 'Ampoule LED' },
          { value: 'Tube LED', label: 'Tube LED' },
          { value: 'Spot LED', label: 'Spot LED' },
          { value: 'Plafonnier', label: 'Plafonnier' },
          { value: 'Lustre', label: 'Lustre' },
          { value: 'Applique murale', label: 'Applique murale' },
          { value: 'Lampadaire', label: 'Lampadaire' },
          { value: 'Lampe de table', label: 'Lampe de table' },
        ],
      },
      {
        id: 'marqueElectricite',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Legrand', label: 'Legrand' },
          { value: 'Schneider Electric', label: 'Schneider Electric' },
          { value: 'ABB', label: 'ABB' },
          { value: 'Hager', label: 'Hager' },
          { value: 'Siemens', label: 'Siemens' },
          { value: 'Philips', label: 'Philips' },
          { value: 'Osram', label: 'Osram' },
          { value: 'Nexans', label: 'Nexans' },
          { value: 'Somfy', label: 'Somfy' },
        ],
      },
      {
        id: 'tensionElectrique',
        label: 'Tension',
        type: 'select',
        options: [
          { value: '12V DC', label: '12V DC' },
          { value: '24V DC', label: '24V DC' },
          { value: '220V AC', label: '220V AC' },
          { value: '230V AC', label: '230V AC' },
          { value: '380V AC (Triphasé)', label: '380V AC (Triphasé)' },
          { value: 'Basse tension (< 50V)', label: 'Basse tension (< 50V)' },
        ],
      },
      {
        id: 'puissanceElectrique',
        label: 'Puissance',
        type: 'select',
        options: [
          { value: '5W', label: '5W' },
          { value: '10W', label: '10W' },
          { value: '15W', label: '15W' },
          { value: '25W', label: '25W' },
          { value: '40W', label: '40W' },
          { value: '60W', label: '60W' },
          { value: '100W', label: '100W' },
          { value: '200W+', label: '200W+' },
        ],
      },
      {
        id: 'culotAmpoule',
        label: 'Culot (ampoules)',
        type: 'select',
        options: [
          { value: 'E14 (petit culot)', label: 'E14 (petit culot)' },
          { value: 'E27 (gros culot)', label: 'E27 (gros culot)' },
          { value: 'GU10', label: 'GU10' },
          { value: 'GU5.3 (MR16)', label: 'GU5.3 (MR16)' },
          { value: 'B22 (baïonnette)', label: 'B22 (baïonnette)' },
          { value: 'G13 (tube)', label: 'G13 (tube)' },
        ],
      },
      {
        id: 'couleurLumiere',
        label: 'Couleur de lumière',
        type: 'select',
        options: [
          { value: 'Blanc chaud (2700K)', label: 'Blanc chaud (2700K)' },
          { value: 'Blanc neutre (4000K)', label: 'Blanc neutre (4000K)' },
          { value: 'Blanc froid (6000K)', label: 'Blanc froid (6000K)' },
          { value: 'RGB (multicolore)', label: 'RGB (multicolore)' },
        ],
      },
      {
        id: 'normesElectrique',
        label: 'Normes',
        type: 'multiselect',
        options: [
          { value: 'CE', label: 'CE' },
          { value: 'NF', label: 'NF' },
          { value: 'IP44 (salle de bain)', label: 'IP44 (salle de bain)' },
          { value: 'IP65 (étanche)', label: 'IP65 (étanche)' },
          { value: 'A+ (économie énergie)', label: 'A+ (économie énergie)' },
          { value: 'A++ (très économique)', label: 'A++ (très économique)' },
        ],
      },
      {
        id: 'etatElectrique',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf en boîte', label: 'Neuf en boîte' },
          { value: 'Neuf sans emballage', label: 'Neuf sans emballage' },
          { value: 'Excellent état', label: 'Excellent état' },
          { value: 'Bon état', label: 'Bon état' },
          { value: 'Occasion', label: 'Occasion' },
        ],
      },
      {
        id: 'utilisationElectrique',
        label: 'Type d\'utilisation',
        type: 'select',
        options: [
          { value: 'Résidentiel', label: 'Résidentiel' },
          { value: 'Commercial', label: 'Commercial' },
          { value: 'Industriel', label: 'Industriel' },
          { value: 'Extérieur', label: 'Extérieur' },
        ],
      },
      // ✅ LOCALISATION - Ville (système intelligent)
      {
        id: 'ville',
        label: 'Ville du magasin',
        type: 'select',
        options: [
          // Les villes s'adaptent au pays de l'utilisateur via africanLocations.ts
          { value: 'Douala', label: '🇨🇲 Douala' },
          { value: 'Yaoundé', label: '🇨🇲 Yaoundé' },
          { value: 'Bafoussam', label: '🇨🇲 Bafoussam' },
          { value: 'Garoua', label: '🇨🇲 Garoua' },
          { value: 'Bamenda', label: '🇨🇲 Bamenda' },
          // Autres pays prioritaires
          { value: 'Kinshasa', label: '🇨🇩 Kinshasa' },
          { value: 'Lubumbashi', label: '🇨🇩 Lubumbashi' },
          { value: 'Abidjan', label: '🇨🇮 Abidjan' },
          { value: 'Dakar', label: '🇸🇳 Dakar' },
          { value: 'Bamako', label: '🇲🇱 Bamako' },
        ],
      },
      // ✅ LOCALISATION - Quartier (système intelligent)
      {
        id: 'quartier',
        label: 'Quartier',
        type: 'select',
        options: [
          // Quartiers Douala
          { value: 'Akwa', label: 'Douala - Akwa' },
          { value: 'Bonanjo', label: 'Douala - Bonanjo' },
          { value: 'Bonapriso', label: 'Douala - Bonapriso' },
          { value: 'Deido', label: 'Douala - Deido' },
          { value: 'Bali', label: 'Douala - Bali' },
          // Quartiers Yaoundé
          { value: 'Bastos', label: 'Yaoundé - Bastos' },
          { value: 'Nlongkak', label: 'Yaoundé - Nlongkak' },
          { value: 'Mvan', label: 'Yaoundé - Mvan' },
          { value: 'Essos', label: 'Yaoundé - Essos' },
          { value: 'Mokolo', label: 'Yaoundé - Mokolo' },
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
    displayPriority: ['name', 'categorieElectrique', 'marqueElectricite', 'puissanceElectrique', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    supportsVariants: false,
  },

  // 🔧 PLOMBIER (SERVICE)
  plombier: {
    terminology: {
      productLabel: 'Prestation plombier',
      productsLabel: 'Services plombier',
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
        id: 'typePrestation',
        label: 'Type de prestation',
        type: 'select',
        options: [
          { value: 'Installation', label: 'Installation' },
          { value: 'Réparation', label: 'Réparation' },
          { value: 'Entretien', label: 'Entretien' },
          { value: 'Dépannage', label: 'Dépannage' },
          { value: 'Débouchage', label: 'Débouchage' },
          { value: 'Diagnostic', label: 'Diagnostic' },
        ],
      },
      {
        id: 'specialitesPlomberie',
        label: 'Spécialités',
        type: 'multiselect',
        options: [
          { value: 'Réparation fuite', label: 'Réparation fuite' },
          { value: 'Débouchage canalisations', label: 'Débouchage' },
          { value: 'Installation chaudière', label: 'Installation chaudière' },
          { value: 'Installation chauffe-eau', label: 'Chauffe-eau' },
          { value: 'Raccordement eau', label: 'Raccordement' },
          { value: 'Détection de fuite', label: 'Détection fuite' },
          { value: 'Rénovation salle de bain', label: 'Rénovation' },
        ],
      },
      {
        id: 'equipementsPlomberie',
        label: 'Équipements concernés',
        type: 'multiselect',
        options: [
          { value: 'Robinetterie', label: 'Robinetterie' },
          { value: 'Lavabo', label: 'Lavabo' },
          { value: 'WC', label: 'WC' },
          { value: 'Douche', label: 'Douche' },
          { value: 'Chauffe-eau', label: 'Chauffe-eau' },
          { value: 'Chaudière', label: 'Chaudière' },
          { value: 'Tuyauterie', label: 'Tuyauterie' },
        ],
      },
      {
        id: 'disponibilitePlomberie',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Intervention express (1h)', label: 'Express (1h)' },
          { value: 'Intervention rapide (2h)', label: 'Rapide (2h)' },
          { value: 'Intervention sous 3h', label: 'Sous 3h' },
          { value: 'Intervention sous 6h', label: 'Sous 6h' },
          { value: 'Intervention sous 12h', label: 'Sous 12h' },
          { value: 'Intervention sous 24h', label: 'Sous 24h' },
          { value: 'Urgence 24h/24', label: 'Urgence 24h/24' },
          { value: 'Rendez-vous planifié', label: 'Planifié' },
          { value: 'Week-end disponible', label: 'Week-end' },
        ],
      },
      {
        id: 'garantieTravaux',
        label: 'Garantie travaux',
        type: 'select',
        options: [
          { value: '3 mois', label: '3 mois' },
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
          { value: 'Garantie décennale', label: 'Garantie décennale' },
        ],
      },
      {
        id: 'certificationsPlombier',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'Certifié QualiPlomberie', label: 'QualiPlomberie' },
          { value: 'Certification CAP Plomberie', label: 'CAP Plomberie' },
          { value: 'Habilitation professionnelle', label: 'Habilité' },
          { value: 'Agrément assurance décennale', label: 'Assurance décennale' },
          { value: 'Certification sanitaire', label: 'Sanitaire' },
          { value: 'Label qualité', label: 'Label qualité' },
          { value: 'Prestataire certifié', label: 'Certifié' },
        ],
      },
      {
        id: 'experiencePlombier',
        label: 'Expérience',
        type: 'select',
        options: [
          { value: 'Débutant (0-2 ans)', label: 'Débutant (0-2 ans)' },
          { value: 'Confirmé (3-5 ans)', label: 'Confirmé (3-5 ans)' },
          { value: 'Expérimenté (6-10 ans)', label: 'Expérimenté (6-10 ans)' },
          { value: 'Expert (11-20 ans)', label: 'Expert (11-20 ans)' },
          { value: 'Maître-artisan (20+ ans)', label: 'Maître-artisan (20+ ans)' },
        ],
      },
      {
        id: 'urgence',
        label: 'Dépannage d\'urgence',
        type: 'toggle',
      },
      {
        id: 'devisGratuit',
        label: 'Devis gratuit',
        type: 'toggle',
      },
      {
        id: 'certifie',
        label: 'Plombier certifié',
        type: 'toggle',
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

  // ⚡ ÉLECTRICIEN (SERVICE)
  electricien: {
    terminology: {
      productLabel: 'Prestation électricien',
      productsLabel: 'Services électricien',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Électricien',
      searchPlaceholder: 'Rechercher un électricien...',
      emptyMessage: 'Aucun électricien disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typePrestation',
        label: 'Type de prestation',
        type: 'select',
        options: [
          { value: 'Installation', label: 'Installation' },
          { value: 'Réparation', label: 'Réparation' },
          { value: 'Dépannage', label: 'Dépannage' },
          { value: 'Mise aux normes', label: 'Mise aux normes' },
          { value: 'Diagnostic', label: 'Diagnostic' },
          { value: 'Rénovation', label: 'Rénovation' },
        ],
      },
      {
        id: 'specialitesElectricien',
        label: 'Spécialités',
        type: 'multiselect',
        options: [
          { value: 'Installation tableau électrique', label: 'Tableau électrique' },
          { value: 'Câblage maison', label: 'Câblage' },
          { value: 'Installation éclairage', label: 'Éclairage' },
          { value: 'Installation domotique', label: 'Domotique' },
          { value: 'Installation climatisation', label: 'Climatisation' },
          { value: 'Mise aux normes', label: 'Mise aux normes' },
          { value: 'Dépannage panne', label: 'Dépannage panne' },
        ],
      },
      {
        id: 'equipementsElectricien',
        label: 'Équipements concernés',
        type: 'multiselect',
        options: [
          { value: 'Tableau électrique', label: 'Tableau électrique' },
          { value: 'Prises électriques', label: 'Prises' },
          { value: 'Interrupteurs', label: 'Interrupteurs' },
          { value: 'Éclairage', label: 'Éclairage' },
          { value: 'Disjoncteurs', label: 'Disjoncteurs' },
          { value: 'Domotique', label: 'Domotique' },
          { value: 'Climatisation', label: 'Climatisation' },
        ],
      },
      {
        id: 'disponibiliteElectricien',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Urgence 24h/24', label: 'Urgence 24h/24' },
          { value: 'Intervention rapide (2h)', label: 'Intervention rapide' },
          { value: 'Rendez-vous sous 24h', label: 'Sous 24h' },
          { value: 'Rendez-vous planifié', label: 'Planifié' },
          { value: 'Week-end', label: 'Week-end' },
        ],
      },
      {
        id: 'garantieTravaux',
        label: 'Garantie travaux',
        type: 'select',
        options: [
          { value: '3 mois', label: '3 mois' },
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
          { value: '5 ans', label: '5 ans' },
        ],
      },
      {
        id: 'certifications',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'Électricien qualifié', label: 'Qualifié' },
          { value: 'Habilitation électrique', label: 'Habilitation' },
          { value: 'Certification Consuel', label: 'Consuel' },
          { value: 'Qualification RGE', label: 'RGE' },
        ],
      },
      {
        id: 'urgence',
        label: 'Dépannage d\'urgence',
        type: 'toggle',
      },
      {
        id: 'devisGratuit',
        label: 'Devis gratuit',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#FFC107',
      gradientColors: ['#FFC107', '#FF9800'],
      icon: '⚡',
      badgeColor: '#FFF8E1',
      accentColor: '#FF9800',
    },
    displayPriority: ['typeIntervention', 'urgence24h', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🔋 ÉLECTRICIEN AUTOMOBILE (SERVICE)
  electricien_auto: {
    terminology: {
      productLabel: 'Prestation électricien auto',
      productsLabel: 'Services électricité automobile',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Électricien automobile',
      searchPlaceholder: 'Rechercher un électricien auto...',
      emptyMessage: 'Aucun électricien auto disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typePrestation',
        label: 'Type de prestation',
        type: 'select',
        options: [
          { value: 'Diagnostic électronique', label: 'Diagnostic électronique' },
          { value: 'Réparation système électrique', label: 'Réparation électrique' },
          { value: 'Installation équipement', label: 'Installation équipement' },
          { value: 'Dépannage panne électrique', label: 'Dépannage' },
          { value: 'Remplacement composant', label: 'Remplacement' },
        ],
      },
      {
        id: 'specialitesElectricienAuto',
        label: 'Spécialités',
        type: 'multiselect',
        options: [
          { value: 'Diagnostic OBD', label: 'Diagnostic OBD' },
          { value: 'Réparation alternateur', label: 'Alternateur' },
          { value: 'Remplacement batterie', label: 'Batterie' },
          { value: 'Réparation faisceau électrique', label: 'Faisceau' },
          { value: 'Installation autoradio', label: 'Autoradio' },
          { value: 'Installation alarme', label: 'Alarme' },
          { value: 'Installation caméra de recul', label: 'Caméra recul' },
          { value: 'Installation GPS', label: 'GPS' },
        ],
      },
      {
        id: 'vehicules',
        label: 'Véhicules pris en charge',
        type: 'multiselect',
        options: [
          { value: 'Voitures légères', label: 'Voitures légères' },
          { value: 'Motos', label: 'Motos' },
          { value: '4x4 / SUV', label: '4x4 / SUV' },
          { value: 'Camionnettes', label: 'Camionnettes' },
          { value: 'Poids lourds', label: 'Poids lourds' },
        ],
      },
      {
        id: 'marques',
        label: 'Marques spécialisées',
        type: 'multiselect',
        options: [
          { value: 'Toyota', label: 'Toyota' },
          { value: 'Honda', label: 'Honda' },
          { value: 'Mercedes', label: 'Mercedes' },
          { value: 'BMW', label: 'BMW' },
          { value: 'Peugeot', label: 'Peugeot' },
          { value: 'Renault', label: 'Renault' },
          { value: 'Toutes marques', label: 'Toutes marques' },
        ],
      },
      {
        id: 'disponibiliteElectricienAuto',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Urgence 24h/24', label: 'Urgence 24h/24' },
          { value: 'Intervention rapide (2h)', label: 'Intervention rapide' },
          { value: 'Rendez-vous sous 24h', label: 'Sous 24h' },
          { value: 'Rendez-vous planifié', label: 'Planifié' },
          { value: 'Week-end', label: 'Week-end' },
        ],
      },
      {
        id: 'garantieTravaux',
        label: 'Garantie travaux',
        type: 'select',
        options: [
          { value: '1 mois', label: '1 mois' },
          { value: '3 mois', label: '3 mois' },
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
        ],
      },
      {
        id: 'urgence',
        label: 'Dépannage d\'urgence',
        type: 'toggle',
      },
      {
        id: 'deplacementDomicile',
        label: 'Déplacement à domicile',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#FF6B35',
      gradientColors: ['#FF6B35', '#FF8C42'],
      icon: '🔋',
      badgeColor: '#FFEDD5',
      accentColor: '#F97316',
    },
    displayPriority: ['typeIntervention', 'urgence24h', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🧱 MAÇON (SERVICE)
  macon: {
    terminology: {
      productLabel: 'Prestation maçonnerie',
      productsLabel: 'Services maçonnerie',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Maçon',
      searchPlaceholder: 'Rechercher un maçon...',
      emptyMessage: 'Aucun maçon disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typePrestation',
        label: 'Type de prestation',
        type: 'select',
        options: [
          { value: 'Construction neuve', label: 'Construction neuve' },
          { value: 'Rénovation', label: 'Rénovation' },
          { value: 'Extension', label: 'Extension' },
          { value: 'Réparation', label: 'Réparation' },
          { value: 'Surélévation', label: 'Surélévation' },
        ],
      },
      {
        id: 'specialitesMacon',
        label: 'Spécialités',
        type: 'multiselect',
        options: [
          { value: 'Fondations', label: 'Fondations' },
          { value: 'Dalle béton', label: 'Dalle béton' },
          { value: 'Mur porteur', label: 'Mur porteur' },
          { value: 'Enduit façade', label: 'Enduit façade' },
          { value: 'Crépi', label: 'Crépi' },
          { value: 'Extension maison', label: 'Extension' },
          { value: 'Piscine béton', label: 'Piscine' },
        ],
      },
      {
        id: 'typesBatiment',
        label: 'Types de bâtiments',
        type: 'multiselect',
        options: [
          { value: 'Maison individuelle', label: 'Maison individuelle' },
          { value: 'Immeuble', label: 'Immeuble' },
          { value: 'Villa', label: 'Villa' },
          { value: 'Commercial', label: 'Commercial' },
          { value: 'Industriel', label: 'Industriel' },
        ],
      },
      {
        id: 'disponibiliteMacon',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Intervention rapide', label: 'Intervention rapide' },
          { value: 'Rendez-vous sous 48h', label: 'Sous 48h' },
          { value: 'Rendez-vous planifié', label: 'Planifié' },
          { value: 'Week-end', label: 'Week-end' },
        ],
      },
      {
        id: 'garantie',
        label: 'Garantie travaux',
        type: 'select',
        options: [
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
          { value: 'Garantie décennale', label: 'Garantie décennale' },
        ],
      },
      {
        id: 'assuranceDecennale',
        label: 'Assurance décennale',
        type: 'toggle',
      },
      {
        id: 'devisGratuit',
        label: 'Devis gratuit',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#78716C',
      gradientColors: ['#78716C', '#57534E'],
      icon: '🧱',
      badgeColor: '#E7E5E4',
      accentColor: '#A8A29E',
    },
    displayPriority: ['typeIntervention', 'assuranceDecennale', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 📐 INGÉNIEUR / ARCHITECTE (SERVICE)
  ingenieur_archi: {
    terminology: {
      productLabel: 'Prestation ingénieur/architecte',
      productsLabel: 'Services ingénierie & architecture',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Ingénieur / Architecte',
      searchPlaceholder: 'Rechercher un architecte, ingénieur...',
      emptyMessage: 'Aucun professionnel disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typePrestation',
        label: 'Type de prestation',
        type: 'select',
        options: [
          { value: 'Étude architecturale', label: 'Étude architecturale' },
          { value: 'Étude technique', label: 'Étude technique' },
          { value: 'Maîtrise d\'œuvre', label: 'Maîtrise d\'œuvre' },
          { value: 'Suivi de chantier', label: 'Suivi de chantier' },
          { value: 'Permis de construire', label: 'Permis de construire' },
          { value: 'Conception 3D', label: 'Conception 3D' },
        ],
      },
      {
        id: 'servicesArchi',
        label: 'Services proposés',
        type: 'multiselect',
        options: [
          { value: 'Plans architecturaux', label: 'Plans architecturaux' },
          { value: 'Permis de construire', label: 'Permis' },
          { value: 'Calcul de structure', label: 'Calcul structure' },
          { value: 'Étude de sol', label: 'Étude de sol' },
          { value: 'Maîtrise d\'œuvre', label: 'MOE' },
          { value: 'Suivi de chantier', label: 'Suivi chantier' },
          { value: 'Conception 3D', label: '3D' },
        ],
      },
      {
        id: 'typesProjet',
        label: 'Types de projets',
        type: 'multiselect',
        options: [
          { value: 'Maison individuelle', label: 'Maison' },
          { value: 'Immeuble résidentiel', label: 'Immeuble' },
          { value: 'Villa', label: 'Villa' },
          { value: 'Bâtiment commercial', label: 'Commercial' },
          { value: 'Bâtiment industriel', label: 'Industriel' },
        ],
      },
      {
        id: 'domaines',
        label: 'Domaines de compétence',
        type: 'multiselect',
        options: [
          { value: 'Génie civil', label: 'Génie civil' },
          { value: 'Architecture', label: 'Architecture' },
          { value: 'Géotechnique', label: 'Géotechnique' },
          { value: 'Structure béton', label: 'Structure béton' },
          { value: 'Thermique', label: 'Thermique' },
          { value: 'Urbanisme', label: 'Urbanisme' },
        ],
      },
      {
        id: 'logiciels',
        label: 'Logiciels utilisés',
        type: 'multiselect',
        options: [
          { value: 'AutoCAD', label: 'AutoCAD' },
          { value: 'Revit', label: 'Revit' },
          { value: 'ArchiCAD', label: 'ArchiCAD' },
          { value: 'SketchUp', label: 'SketchUp' },
          { value: 'Robot Structural', label: 'Robot Structural' },
        ],
      },
      {
        id: 'certifications',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'Ordre des architectes', label: 'Ordre architectes' },
          { value: 'Ingénieur diplômé', label: 'Ingénieur diplômé' },
          { value: 'Assurance RC Pro', label: 'RC Pro' },
          { value: 'Assurance décennale', label: 'Décennale' },
        ],
      },
      {
        id: 'assuranceRCPro',
        label: 'Assurance RC Pro',
        type: 'toggle',
      },
      {
        id: 'assuranceDecennale',
        label: 'Assurance décennale',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#0891B2',
      gradientColors: ['#0891B2', '#06B6D4'],
      icon: '📐',
      badgeColor: '#CFFAFE',
      accentColor: '#0E7490',
    },
    displayPriority: ['typeIntervention', 'assuranceRCPro', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🚰 PLOMBERIE & SANITAIRE (PRODUIT - VENTE MATÉRIEL)
  plomberie_sanitaire: {
    terminology: {
      productLabel: 'Matériel plomberie',
      productsLabel: 'Plomberie & Sanitaire',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher du matériel plomberie...',
      emptyMessage: 'Aucun matériel disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
        date: 'Plus récents',
      },
    },
    filters: [
      {
        id: 'categorieProduit',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: '🚰 Robinetterie', label: 'Robinetterie' },
          { value: '🚰 Lavabo & Évier', label: 'Lavabo & Évier' },
          { value: '🚰 WC & Toilettes', label: 'WC & Toilettes' },
          { value: '🚰 Douche & Baignoire', label: 'Douche & Baignoire' },
          { value: '🚰 Chauffe-eau', label: 'Chauffe-eau' },
          { value: '🚰 Tuyauterie', label: 'Tuyauterie' },
          { value: '🚰 Accessoires', label: 'Accessoires' },
          { value: '🚰 Outils plomberie', label: 'Outils' },
        ],
      },
      {
        id: 'marque',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Grohe', label: 'Grohe' },
          { value: 'Geberit', label: 'Geberit' },
          { value: 'Roca', label: 'Roca' },
          { value: 'Hansgrohe', label: 'Hansgrohe' },
          { value: 'Duravit', label: 'Duravit' },
          { value: 'Ideal Standard', label: 'Ideal Standard' },
          { value: 'Jacob Delafon', label: 'Jacob Delafon' },
          { value: 'Villeroy & Boch', label: 'Villeroy & Boch' },
          { value: 'Kohler', label: 'Kohler' },
          { value: 'American Standard', label: 'American Standard' },
          { value: 'Autre', label: 'Autre marque' },
        ],
      },
      {
        id: 'materiau',
        label: 'Matériau',
        type: 'multiselect',
        options: [
          { value: 'Céramique', label: 'Céramique' },
          { value: 'Porcelaine', label: 'Porcelaine' },
          { value: 'Inox', label: 'Inox' },
          { value: 'Chrome', label: 'Chrome' },
          { value: 'Laiton', label: 'Laiton' },
          { value: 'PVC', label: 'PVC' },
          { value: 'Cuivre', label: 'Cuivre' },
          { value: 'Acier', label: 'Acier' },
          { value: 'Composite', label: 'Composite' },
        ],
      },
      {
        id: 'finition',
        label: 'Finition',
        type: 'select',
        options: [
          { value: 'Chromé', label: 'Chromé' },
          { value: 'Blanc', label: 'Blanc' },
          { value: 'Noir mat', label: 'Noir mat' },
          { value: 'Doré', label: 'Doré' },
          { value: 'Brossé', label: 'Brossé' },
          { value: 'Satiné', label: 'Satiné' },
          { value: 'Mat', label: 'Mat' },
          { value: 'Brillant', label: 'Brillant' },
        ],
      },
      {
        id: 'prix',
        label: 'Prix',
        type: 'range',
        min: 0,
        max: 1000000,
        unit: 'FCFA',
      },
      {
        id: 'etat',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf', label: 'Neuf' },
          { value: 'Très bon état', label: 'Très bon état' },
          { value: 'Bon état', label: 'Bon état' },
          { value: 'État correct', label: 'État correct' },
          { value: 'À rénover', label: 'À rénover' },
        ],
      },
      {
        id: 'garantie',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'Garantie constructeur', label: 'Garantie constructeur' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
          { value: '5 ans', label: '5 ans' },
          { value: 'Garantie limitée', label: 'Garantie limitée' },
          { value: 'Sans garantie', label: 'Sans garantie' },
        ],
      },
      {
        id: 'livraison',
        label: 'Livraison',
        type: 'select',
        options: [
          { value: 'Livraison gratuite', label: 'Livraison gratuite' },
          { value: 'Livraison payante', label: 'Livraison payante' },
          { value: 'Retrait magasin', label: 'Retrait magasin' },
          { value: 'Livraison express', label: 'Livraison express' },
        ],
      },
      {
        id: 'installation',
        label: 'Installation',
        type: 'select',
        options: [
          { value: 'Installation incluse', label: 'Installation incluse' },
          { value: 'Installation payante', label: 'Installation payante' },
          { value: 'Installation par tiers', label: 'Installation par tiers' },
          { value: 'Auto-installation', label: 'Auto-installation' },
        ],
      },
      // ✅ FILTRE 10 : Localisation - Ville (système intelligent)
      {
        id: 'ville',
        label: 'Ville du magasin',
        type: 'select',
        options: [
          // Les villes s'adaptent au pays de l'utilisateur via africanLocations.ts
          { value: 'Douala', label: '🇨🇲 Douala' },
          { value: 'Yaoundé', label: '🇨🇲 Yaoundé' },
          { value: 'Bafoussam', label: '🇨🇲 Bafoussam' },
          { value: 'Garoua', label: '🇨🇲 Garoua' },
          { value: 'Bamenda', label: '🇨🇲 Bamenda' },
          // Autres pays prioritaires
          { value: 'Kinshasa', label: '🇨🇩 Kinshasa' },
          { value: 'Lubumbashi', label: '🇨🇩 Lubumbashi' },
          { value: 'Abidjan', label: '🇨🇮 Abidjan' },
          { value: 'Dakar', label: '🇸🇳 Dakar' },
          { value: 'Bamako', label: '🇲🇱 Bamako' },
        ],
      },
      // ✅ FILTRE 11 : Localisation - Quartier (système intelligent)
      {
        id: 'quartier',
        label: 'Quartier',
        type: 'select',
        options: [
          // Quartiers Douala
          { value: 'Akwa', label: 'Douala - Akwa' },
          { value: 'Bonanjo', label: 'Douala - Bonanjo' },
          { value: 'Bonapriso', label: 'Douala - Bonapriso' },
          { value: 'Deido', label: 'Douala - Deido' },
          { value: 'Bali', label: 'Douala - Bali' },
          // Quartiers Yaoundé
          { value: 'Bastos', label: 'Yaoundé - Bastos' },
          { value: 'Nlongkak', label: 'Yaoundé - Nlongkak' },
          { value: 'Mvan', label: 'Yaoundé -Mvan' },
          { value: 'Essos', label: 'Yaoundé - Essos' },
          { value: 'Mokolo', label: 'Yaoundé - Mokolo' },
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
    displayPriority: ['categorieProduit', 'marque', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    supportsVariants: true,
  },

  // 🧹 NETTOYAGE
  nettoyage: {
    terminology: {
      productLabel: 'Service de nettoyage',
      productsLabel: 'Services de nettoyage',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Agent de nettoyage',
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
        label: 'Type de nettoyage',
        type: 'select',
        options: [
          { value: 'Nettoyage résidentiel', label: 'Résidentiel' },
          { value: 'Nettoyage bureaux', label: 'Bureaux' },
          { value: 'Nettoyage après travaux', label: 'Après travaux' },
          { value: 'Nettoyage vitres', label: 'Vitres' },
          { value: 'Nettoyage façades', label: 'Façades' },
          { value: 'Nettoyage moquettes/tapis', label: 'Moquettes/Tapis' },
          { value: 'Désinfection', label: 'Désinfection' },
        ],
      },
      {
        id: 'frequenceNettoyage',
        label: 'Fréquence',
        type: 'select',
        options: [
          { value: 'Ponctuel', label: 'Ponctuel' },
          { value: 'Hebdomadaire', label: 'Hebdomadaire' },
          { value: 'Bi-mensuel', label: 'Bi-mensuel' },
          { value: 'Mensuel', label: 'Mensuel' },
          { value: 'Trimestriel', label: 'Trimestriel' },
        ],
      },
      {
        id: 'servicesNettoyage',
        label: 'Services inclus',
        type: 'multiselect',
        options: [
          { value: 'Dépoussiérage', label: 'Dépoussiérage' },
          { value: 'Aspiration', label: 'Aspiration' },
          { value: 'Lavage sols', label: 'Lavage sols' },
          { value: 'Nettoyage sanitaires', label: 'Sanitaires' },
          { value: 'Nettoyage cuisine', label: 'Cuisine' },
          { value: 'Vitrerie', label: 'Vitrerie' },
          { value: 'Désinfection', label: 'Désinfection' },
        ],
      },
      {
        id: 'surfaceNettoyage',
        label: 'Surface',
        type: 'select',
        options: [
          { value: 'Moins de 50m²', label: 'Moins de 50m²' },
          { value: '50-100m²', label: '50-100m²' },
          { value: '100-200m²', label: '100-200m²' },
          { value: '200-500m²', label: '200-500m²' },
          { value: 'Plus de 500m²', label: 'Plus de 500m²' },
        ],
      },
      {
        id: 'produitsNettoyage',
        label: 'Type de produits',
        type: 'select',
        options: [
          { value: 'Produits bio/écologiques', label: 'Bio/Écologiques' },
          { value: 'Produits professionnels', label: 'Professionnels' },
          { value: 'Vapeur/Sans chimique', label: 'Vapeur/Sans chimique' },
        ],
      },
      {
        id: 'produitsBio',
        label: 'Produits bio/écologiques',
        type: 'toggle',
      },
      {
        id: 'materielInclus',
        label: 'Matériel inclus',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#10B981',
      gradientColors: ['#10B981', '#059669'],
      icon: '🧹',
      badgeColor: '#D1FAE5',
      accentColor: '#059669',
    },
    displayPriority: ['typeNettoyage', 'frequenceNettoyage', 'surface', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🛠️ RÉPARATION
  reparation: {
    terminology: {
      productLabel: 'Service de réparation',
      productsLabel: 'Réparations',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Réparateur',
      searchPlaceholder: 'Rechercher un service de réparation...',
      emptyMessage: 'Aucun service de réparation disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeReparation',
        label: 'Type de réparation',
        type: 'select',
        options: [
          { value: 'Réparation électronique', label: 'Électronique' },
          { value: 'Réparation électroménager', label: 'Électroménager' },
          { value: 'Réparation téléphone', label: 'Téléphone' },
          { value: 'Réparation ordinateur', label: 'Ordinateur' },
          { value: 'Réparation automobile', label: 'Automobile' },
          { value: 'Réparation moto', label: 'Moto' },
          { value: 'Réparation vélo', label: 'Vélo' },
          { value: 'Réparation meubles', label: 'Meubles' },
        ],
      },
      {
        id: 'specialiteReparation',
        label: 'Spécialité',
        type: 'select',
        options: [
          { value: 'Écran cassé', label: 'Écran cassé' },
          { value: 'Batterie', label: 'Batterie' },
          { value: 'Carte mère', label: 'Carte mère' },
          { value: 'Connectique', label: 'Connectique' },
          { value: 'Moteur', label: 'Moteur' },
          { value: 'Freins', label: 'Freins' },
          { value: 'Embrayage', label: 'Embrayage' },
        ],
      },
      {
        id: 'marqueReparation',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Toutes marques', label: 'Toutes marques' },
          { value: 'Samsung', label: 'Samsung' },
          { value: 'Apple', label: 'Apple' },
          { value: 'LG', label: 'LG' },
          { value: 'Sony', label: 'Sony' },
          { value: 'HP', label: 'HP' },
          { value: 'Dell', label: 'Dell' },
        ],
      },
      {
        id: 'delaiReparation',
        label: 'Délai',
        type: 'select',
        options: [
          { value: 'Express (même jour)', label: 'Express (même jour)' },
          { value: '24-48h', label: '24-48h' },
          { value: '2-5 jours', label: '2-5 jours' },
          { value: '1-2 semaines', label: '1-2 semaines' },
        ],
      },
      {
        id: 'garantieReparation',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: '1 mois', label: '1 mois' },
          { value: '3 mois', label: '3 mois' },
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
        ],
      },
      {
        id: 'diagnosticGratuit',
        label: 'Diagnostic gratuit',
        type: 'toggle',
      },
      {
        id: 'deplacementInclus',
        label: 'Déplacement inclus',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#F97316',
      gradientColors: ['#F97316', '#EA580C'],
      icon: '🛠️',
      badgeColor: '#FED7AA',
      accentColor: '#EA580C',
    },
    displayPriority: ['typeReparation', 'specialiteReparation', 'delaiReparation', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🪵 MENUISERIE
  // 🪵 MENUISERIE & ARTISAN - 🌍 CONTEXTE AFRIQUE FRANCOPHONE
  menuiserie: {
    terminology: {
      productLabel: 'Prestation menuiserie',
      productsLabel: 'Menuiserie & Artisans bois',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Menuisier/Ébéniste',
      searchPlaceholder: 'Rechercher menuisier, ébéniste, artisan bois...',
      emptyMessage: 'Aucun menuisier disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1: Type de service menuiserie (multiselect)
      {
        id: 'serviceMenuiserie',
        label: 'Type de service',
        type: 'multiselect',
        options: [
          // Meubles
          { value: '🪑 Fabrication salon complet (canapé, fauteuils, table basse)', label: 'Salon complet' },
          { value: '🪑 Fabrication chambre à coucher (lit, armoire, coiffeuse)', label: 'Chambre à coucher' },
          { value: '🪑 Fabrication salle à manger (table, chaises, buffet)', label: 'Salle à manger' },
          { value: '🪑 Fabrication bureau (table bureau, bibliothèque, étagères)', label: 'Bureau/Bibliothèque' },
          { value: '🪑 Fabrication placard mural/encastré', label: 'Placard sur mesure' },
          { value: '🪑 Fabrication cuisine équipée/aménagée', label: 'Cuisine aménagée' },
          { value: '🪑 Fabrication mobilier restaurant/maquis', label: 'Mobilier commercial' },

          // Portes & Fenêtres
          { value: '🚪 Fabrication & pose porte d\'entrée bois massif', label: 'Porte d\'entrée' },
          { value: '🚪 Fabrication & pose porte intérieure bois', label: 'Porte intérieure' },
          { value: '🚪 Fabrication & pose portail bois', label: 'Portail bois' },
          { value: '🪟 Fabrication & pose fenêtres bois', label: 'Fenêtres' },
          { value: '🪟 Fabrication & pose volets bois', label: 'Volets' },

          // Intérieur
          { value: '🏠 Pose parquet massif/flottant', label: 'Parquet' },
          { value: '🏠 Fabrication & pose escalier bois intérieur', label: 'Escalier' },
          { value: '🏠 Dressing/penderie sur mesure', label: 'Dressing' },
          { value: '🏠 Pose lambris mural/plafond', label: 'Lambris' },

          // Extérieur
          { value: '🌳 Terrasse/plancher extérieur bois', label: 'Terrasse bois' },
          { value: '🌳 Pergola/tonnelle bois', label: 'Pergola' },
          { value: '🌳 Clôture/palissade bois', label: 'Clôture' },
          { value: '🌳 Charpente bois/toiture', label: 'Charpente' },

          // Réparations
          { value: '🔨 Réparation meubles anciens/endommagés', label: 'Réparation meubles' },
          { value: '🔨 Restauration meubles (antiquité, héritage)', label: 'Restauration' },
          { value: '🔨 Traitement bois (anti-termites, anti-humidité)', label: 'Traitement anti-termites' },

          // Ébénisterie artistique
          { value: '🎨 Ébénisterie artistique/sculpture bois', label: 'Ébénisterie d\'art' },
          { value: '🎨 Mobilier traditionnel africain', label: 'Mobilier africain' },
          { value: '🎨 Portes sculptées traditionnelles', label: 'Portes sculptées' },
        ],
      },

      // ✅ FILTRE 2: Type de bois (multiselect) - Focus bois africains
      {
        id: 'typeBois',
        label: 'Type de bois',
        type: 'multiselect',
        options: [
          // Bois africains nobles
          { value: '🇨🇲 Acajou d\'Afrique (Khaya)', label: '🇨🇲 Acajou Afrique' },
          { value: '🇨🇲 Sapelli (Acajou africain)', label: '🇨🇲 Sapelli' },
          { value: '🇨🇲 Iroko (Teck africain)', label: '🇨🇲 Iroko' },
          { value: '🇨🇲 Doussié/Afzelia', label: '🇨🇲 Doussié' },
          { value: '🇨🇲 Moabi', label: '🇨🇲 Moabi' },
          { value: '🇨🇲 Padouk rouge d\'Afrique', label: '🇨🇲 Padouk rouge' },
          { value: '🇨🇲 Wengé', label: '🇨🇲 Wengé' },
          { value: '🇨🇲 Bubinga/Kevazingo', label: '🇨🇲 Bubinga' },
          { value: '🇨🇲 Ebène d\'Afrique', label: '🇨🇲 Ébène' },
          { value: '🇨🇲 Azobé/Bongossi', label: '🇨🇲 Azobé (extérieur)' },

          // Bois économiques locaux
          { value: '🇨🇲 Ayous/Obeche/Samba', label: '🇨🇲 Ayous (économique)' },
          { value: '🇨🇲 Dibétou', label: '🇨🇲 Dibétou' },
          { value: '🇨🇲 Teck d\'Afrique (plantation)', label: '🇨🇲 Teck Afrique' },
          { value: '🇨🇲 Eucalyptus (plantation locale)', label: '🇨🇲 Eucalyptus' },
          { value: '🇨🇲 Bambou africain', label: '🇨🇲 Bambou' },

          // Bois importés
          { value: '🌍 Chêne européen', label: '🌍 Chêne (importé)' },
          { value: '🌍 Hêtre', label: '🌍 Hêtre' },
          { value: '🌍 Pin maritime', label: '🌍 Pin' },
          { value: '🌍 Teck d\'Asie (Thaïlande, Birmanie)', label: '🌍 Teck Asie' },

          // Panneaux
          { value: '🏭 Contreplaqué okoumé (production locale)', label: '🏭 Contreplaqué' },
          { value: '🏭 MDF (Medium Density Fiberboard)', label: '🏭 MDF' },
          { value: '🏭 Aggloméré/Particules', label: '🏭 Aggloméré' },
        ],
      },

      // ✅ FILTRE 3: Finitions & Traitements
      {
        id: 'finitionsMenuiserie',
        label: 'Finitions',
        type: 'multiselect',
        options: [
          { value: 'Vernis brillant', label: 'Vernis brillant' },
          { value: 'Vernis mat', label: 'Vernis mat' },
          { value: 'Peinture laquée brillante', label: 'Laque brillante' },
          { value: 'Peinture laquée mate', label: 'Laque mate' },
          { value: 'Lasure transparente', label: 'Lasure' },
          { value: 'Huile naturelle', label: 'Huile' },
          { value: 'Cire d\'abeille', label: 'Cire' },
          { value: 'Traitement anti-termites (crucial Cameroun)', label: '⚠️ Anti-termites' },
          { value: 'Traitement anti-humidité/moisissures', label: 'Anti-humidité' },
          { value: 'Brut/naturel non traité', label: 'Brut naturel' },
        ],
      },

      // ✅ FILTRE 4: Style de menuiserie
      {
        id: 'styleMenuiserie',
        label: 'Style',
        type: 'select',
        options: [
          { value: 'Moderne/Contemporain', label: 'Moderne' },
          { value: 'Minimaliste', label: 'Minimaliste' },
          { value: 'Classique français', label: 'Classique' },
          { value: 'Colonial français', label: 'Colonial' },
          { value: 'Rustique/Campagnard', label: 'Rustique' },
          { value: 'Traditionnel africain', label: '🇨🇲 Traditionnel africain' },
          { value: 'Afro-contemporain (fusion)', label: '🇨🇲 Afro-contemporain' },
          { value: 'Artisanal camerounais', label: '🇨🇲 Artisanal local' },
          { value: 'Industriel', label: 'Industriel' },
          { value: 'Scandinave', label: 'Scandinave' },
        ],
      },

      // ✅ FILTRE 5: Niveau d'expérience
      {
        id: 'experienceMenuisier',
        label: 'Expérience',
        type: 'select',
        options: [
          { value: 'Apprenti menuisier (< 1 an)', label: 'Apprenti' },
          { value: 'Débutant (1-2 ans)', label: 'Débutant (1-2 ans)' },
          { value: 'Menuisier confirmé (3-5 ans)', label: 'Confirmé (3-5 ans)' },
          { value: 'Menuisier expérimenté (5-10 ans)', label: 'Expérimenté (5-10 ans)' },
          { value: 'Menuisier expert (10-15 ans)', label: 'Expert (10-15 ans)' },
          { value: 'Maître menuisier (20+ ans)', label: 'Maître menuisier (20+)' },
          { value: 'Ébéniste d\'art', label: 'Ébéniste d\'art' },
          { value: 'Artisan primé/reconnu', label: 'Artisan primé' },
        ],
      },

      // ✅ FILTRE 6: Certifications & Diplômes
      {
        id: 'certificationMenuisier',
        label: 'Certification',
        type: 'multiselect',
        options: [
          { value: 'CAP Menuiserie (Cameroun)', label: '🇨🇲 CAP Menuiserie' },
          { value: 'BP Menuisier (Cameroun)', label: '🇨🇲 BP Menuisier' },
          { value: 'BTS Menuiserie (ENSET, Universités)', label: '🇨🇲 BTS Menuiserie' },
          { value: 'Certificat MINEFOP Menuiserie', label: '🇨🇲 MINEFOP' },
          { value: 'Formation CEFAM (Centre Formation Artisanale)', label: '🇨🇲 CEFAM' },
          { value: 'Apprentissage traditionnel (maître artisan)', label: 'Apprentissage traditionnel' },
          { value: 'Certification qualité artisan', label: 'Certifié qualité' },
          { value: 'Label Artisan Cameroun', label: '🇨🇲 Label Artisan' },
          { value: 'CAP Menuisier France/Europe', label: '🌍 CAP France/Europe' },
          { value: 'Autodidacte/Expérience terrain', label: 'Autodidacte' },
        ],
      },

      // ✅ FILTRE 7: Délais de fabrication
      {
        id: 'delaiMenuiserie',
        label: 'Délai de fabrication',
        type: 'select',
        options: [
          { value: 'Express (24-48h) - selon disponibilité', label: 'Express (24-48h)' },
          { value: 'Rapide (3-7 jours)', label: 'Rapide (3-7j)' },
          { value: 'Standard (1-2 semaines)', label: 'Standard (1-2 sem)' },
          { value: 'Moyen (2-4 semaines)', label: 'Moyen (2-4 sem)' },
          { value: 'Long (1-2 mois)', label: 'Long (1-2 mois)' },
          { value: 'Sur mesure complexe (3+ mois)', label: 'Complexe (3+ mois)' },
          { value: 'Production en série (stock disponible)', label: 'Stock disponible' },
        ],
      },

      // ✅ FILTRE 8: Atelier/Fabricant
      {
        id: 'atelierMenuiserie',
        label: 'Type d\'atelier',
        type: 'select',
        options: [
          { value: '🇨🇲 Atelier artisanal Bonabéri (Douala)', label: 'Bonabéri (Douala)' },
          { value: '🇨🇲 Marché bois Mboppi (Douala)', label: 'Mboppi (Douala)' },
          { value: '🇨🇲 Menuisiers Deido (Douala)', label: 'Deido (Douala)' },
          { value: '🇨🇲 Atelier Mvog-Ada (Yaoundé)', label: 'Mvog-Ada (Yaoundé)' },
          { value: '🇨🇲 Menuisiers Mokolo (Yaoundé)', label: 'Mokolo (Yaoundé)' },
          { value: '🇨🇲 Ébénistes Bafoussam', label: 'Bafoussam' },
          { value: 'Menuisier indépendant local', label: 'Indépendant local' },
          { value: 'Atelier familial traditionnel', label: 'Atelier familial' },
          { value: 'Coopérative artisans menuisiers', label: 'Coopérative' },
          { value: 'Entreprise menuiserie PME', label: 'Entreprise PME' },
        ],
      },

      // ✅ FILTRE 9: Garantie
      {
        id: 'garantieMenuiserie',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'Garantie 6 mois travaux', label: '6 mois' },
          { value: 'Garantie 1 an', label: '1 an' },
          { value: 'Garantie 2 ans', label: '2 ans' },
          { value: 'Garantie 5 ans (bois massif)', label: '5 ans (massif)' },
          { value: 'SAV disponible', label: 'SAV disponible' },
          { value: 'Retouches gratuites (6 mois)', label: 'Retouches gratuites' },
        ],
      },

      // ✅ FILTRE 10: Mode de paiement
      {
        id: 'paiementMenuiserie',
        label: 'Mode de paiement',
        type: 'multiselect',
        options: [
          { value: 'Espèces (FCFA)', label: 'Espèces (FCFA)' },
          { value: 'Mobile Money (MTN, Orange)', label: 'Mobile Money' },
          { value: 'Virement bancaire', label: 'Virement' },
          { value: 'Paiement échelonné (mensualités)', label: 'Échelonné' },
          { value: '30% acompte / 70% livraison', label: '30/70%' },
          { value: '50% acompte / 50% livraison', label: '50/50%' },
          { value: 'Crédit artisan (facilités)', label: 'Crédit artisan' },
        ],
      },

      // ✅ FILTRE 11: Équipement atelier
      {
        id: 'equipementAtelier',
        label: 'Équipement atelier',
        type: 'select',
        options: [
          { value: 'Atelier complet professionnel', label: 'Atelier complet pro' },
          { value: 'Atelier semi-équipé', label: 'Semi-équipé' },
          { value: 'Outils basiques manuels uniquement', label: 'Outils manuels' },
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
    displayPriority: ['serviceMenuiserie', 'typeBois', 'experienceMenuisier', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // ❄️ RÉPARATEUR CLIMATISEUR - 🌍 CONTEXTE AFRIQUE FRANCOPHONE
  reparateur_climatiseur: {
    terminology: {
      productLabel: 'Service climatisation',
      productsLabel: 'Réparateur/Technicien Climatiseur',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Technicien/Frigoriste',
      searchPlaceholder: 'Rechercher technicien climatisation, réparateur AC, dépanneur clim...',
      emptyMessage: 'Aucun technicien climatisation disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1: Type de service climatisation
      {
        id: 'serviceClimatisation',
        label: 'Type de service',
        type: 'multiselect',
        options: [
          { value: '❄️ Installation climatiseur neuf', label: 'Installation neuf' },
          { value: '❄️ Réparation/Dépannage climatiseur', label: 'Réparation/Dépannage' },
          { value: '❄️ Maintenance préventive/Entretien régulier', label: 'Maintenance préventive' },
          { value: '❄️ Nettoyage complet climatiseur (intérieur + extérieur)', label: 'Nettoyage complet' },
          { value: '❄️ Recharge gaz réfrigérant (R22, R410A, R32)', label: 'Recharge gaz' },
          { value: '❄️ Détection et réparation fuite de gaz', label: 'Réparation fuite gaz' },
          { value: '🏢 Dépannage urgence 24h/24', label: '🚨 Urgence 24h/24' },
          { value: '🏢 Contrat maintenance annuel', label: 'Contrat maintenance' },
          { value: '🏢 Désinstallation/Réinstallation (déménagement)', label: 'Désinstallation/Réinstallation' },
          { value: '❄️ Diagnostic panne/Devis gratuit', label: 'Diagnostic gratuit' },
        ],
      },

      // ✅ FILTRE 2: Marque climatiseur (focus Afrique)
      {
        id: 'marqueClimatiseur',
        label: 'Marque spécialisée',
        type: 'multiselect',
        options: [
          // Chinoises (top Afrique)
          { value: '🇨🇳 Midea', label: '🇨🇳 Midea (leader)' },
          { value: '🇨🇳 Gree', label: '🇨🇳 Gree' },
          { value: '🇨🇳 Haier', label: '🇨🇳 Haier' },
          { value: '🇨🇳 Hisense', label: '🇨🇳 Hisense' },
          { value: '🇨🇳 TCL', label: '🇨🇳 TCL' },
          { value: '🇨🇳 Aux', label: '🇨🇳 Aux' },

          // Coréennes
          { value: '🇰🇷 LG', label: '🇰🇷 LG' },
          { value: '🇰🇷 Samsung', label: '🇰🇷 Samsung' },

          // Japonaises (haut de gamme)
          { value: '🇯🇵 Daikin', label: '🇯🇵 Daikin (premium)' },
          { value: '🇯🇵 Mitsubishi Electric', label: '🇯🇵 Mitsubishi' },
          { value: '🇯🇵 Fujitsu', label: '🇯🇵 Fujitsu' },
          { value: '🇯🇵 Toshiba', label: '🇯🇵 Toshiba' },
          { value: '🇯🇵 Panasonic', label: '🇯🇵 Panasonic' },

          { value: 'Toutes marques', label: 'Toutes marques' },
        ],
      },

      // ✅ FILTRE 3: Type de climatiseur
      {
        id: 'typeClimatiseur',
        label: 'Type de climatiseur',
        type: 'multiselect',
        options: [
          { value: '❄️ Split mural (le plus courant)', label: 'Split mural' },
          { value: '❄️ Window/Fenêtre (monobloc)', label: 'Window/Fenêtre' },
          { value: '❄️ Cassette (encastré plafond)', label: 'Cassette plafond' },
          { value: '❄️ Inverter (économie énergie)', label: 'Inverter' },
          { value: '❄️ Réversible (chaud/froid)', label: 'Réversible chaud/froid' },
          { value: '❄️ Centralisé/VRV', label: 'Centralisé/VRV' },
          { value: '❄️ Mobile/Portable', label: 'Mobile' },
        ],
      },

      // ✅ FILTRE 4: Puissance BTU
      {
        id: 'puissanceBTU',
        label: 'Puissance (BTU)',
        type: 'select',
        options: [
          { value: '9000 BTU (petite pièce 10-15m²)', label: '9000 BTU (10-15m²)' },
          { value: '12000 BTU (pièce moyenne 15-25m²)', label: '12000 BTU (15-25m²)' },
          { value: '18000 BTU (grande pièce 25-35m²)', label: '18000 BTU (25-35m²)' },
          { value: '24000 BTU (très grande pièce 35-50m²)', label: '24000 BTU (35-50m²)' },
          { value: '30000 BTU+ (espace commercial)', label: '30000+ BTU (commercial)' },
          { value: 'Toutes puissances', label: 'Toutes puissances' },
        ],
      },

      // ✅ FILTRE 5: Certification frigoriste
      {
        id: 'certificationFrigoriste',
        label: 'Certification',
        type: 'multiselect',
        options: [
          { value: '🎓 Certificat FROID (Frigoriste qualifié)', label: '🎓 Certificat FROID' },
          { value: '🎓 Habilitation manipulation fluides frigorigènes', label: '🎓 Habilitation fluides' },
          { value: '🎓 CAP Froid et Climatisation', label: '🎓 CAP Froid' },
          { value: '🎓 BTS Fluides Énergies Domotique', label: '🎓 BTS Fluides' },
          { value: '🎓 Formation constructeur (Daikin, Mitsubishi...)', label: '🎓 Formation constructeur' },
          { value: '🎓 Technicien certifié constructeur', label: '🎓 Certifié constructeur' },
          { value: 'Autodidacte/Expérience terrain', label: 'Autodidacte' },
        ],
      },

      // ✅ FILTRE 6: Disponibilité/Urgence
      {
        id: 'disponibiliteClim',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: '🚨 Urgence 24h/24 - 7j/7', label: '🚨 Urgence 24h/24' },
          { value: '🚨 Dépannage urgence (même jour)', label: 'Même jour' },
          { value: '⏰ Intervention sous 2-4h', label: 'Sous 2-4h' },
          { value: '⏰ Intervention sous 24h', label: 'Sous 24h' },
          { value: '⏰ Rendez-vous sous 48h', label: 'Sous 48h' },
          { value: '📅 Week-end disponible', label: 'Week-end' },
          { value: '📅 Jours ouvrables uniquement (Lun-Ven)', label: 'Lun-Ven uniquement' },
        ],
      },

      // ✅ FILTRE 7: Type de panne
      {
        id: 'typePanneClim',
        label: 'Type de panne',
        type: 'multiselect',
        options: [
          { value: '⚠️ Climatiseur ne démarre pas', label: 'Ne démarre pas' },
          { value: '⚠️ Pas de froid/Ne refroidit pas', label: 'Pas de froid' },
          { value: '⚠️ Fuite d\'eau/Condensats', label: 'Fuite d\'eau' },
          { value: '⚠️ Bruit anormal (compresseur, ventilateur)', label: 'Bruit anormal' },
          { value: '⚠️ Odeur désagréable', label: 'Odeur' },
          { value: '⚠️ Télécommande ne fonctionne pas', label: 'Problème télécommande' },
          { value: '⚠️ Consommation électrique élevée', label: 'Consomme trop' },
          { value: '⚠️ Fuite de gaz réfrigérant', label: 'Fuite gaz' },
          { value: '⚠️ Autre panne (diagnostic nécessaire)', label: 'Autre (diagnostic)' },
        ],
      },

      // ✅ FILTRE 8: Type de clientèle
      {
        id: 'clienteleClim',
        label: 'Type de clientèle',
        type: 'multiselect',
        options: [
          { value: '🏠 Particuliers/Résidentiel', label: 'Particuliers' },
          { value: '🏢 Entreprises/Bureaux', label: 'Entreprises/Bureaux' },
          { value: '🏨 Hôtels/Hébergements', label: 'Hôtels' },
          { value: '🏪 Commerces/Boutiques', label: 'Commerces' },
          { value: '🏥 Hôpitaux/Cliniques', label: 'Santé' },
          { value: '🏫 Écoles/Universités', label: 'Éducation' },
        ],
      },

      // ✅ FILTRE 9: Équipement professionnel
      {
        id: 'equipementTechnicien',
        label: 'Équipement',
        type: 'select',
        options: [
          { value: '🛠️ Outillage complet professionnel', label: 'Outillage complet pro' },
          { value: '🛠️ Pompe à vide', label: 'Pompe à vide' },
          { value: '🛠️ Manomètres (groupe froid)', label: 'Manomètres' },
          { value: '🛠️ Détecteur de fuite électronique', label: 'Détecteur fuite' },
          { value: '🛠️ Stock pièces détachées', label: 'Stock pièces' },
          { value: 'Équipement de base', label: 'Équipement basique' },
        ],
      },

      // ✅ FILTRE 10: Garantie travaux
      {
        id: 'garantieClim',
        label: 'Garantie travaux',
        type: 'select',
        options: [
          { value: '✅ Garantie 1 mois travaux', label: '1 mois' },
          { value: '✅ Garantie 3 mois travaux', label: '3 mois' },
          { value: '✅ Garantie 6 mois travaux', label: '6 mois' },
          { value: '✅ Garantie 1 an travaux', label: '1 an' },
          { value: '✅ SAV assuré', label: 'SAV assuré' },
        ],
      },

      // ✅ FILTRE 11: Mode de paiement
      {
        id: 'paiementClim',
        label: 'Mode de paiement',
        type: 'multiselect',
        options: [
          { value: '💳 Espèces (FCFA)', label: 'Espèces (FCFA)' },
          { value: '💳 Mobile Money (MTN, Orange)', label: 'Mobile Money' },
          { value: '💳 Virement bancaire', label: 'Virement' },
          { value: '💳 Paiement échelonné possible', label: 'Échelonné' },
          { value: '💳 Facture entreprise acceptée', label: 'Facture entreprise' },
          { value: '💵 Diagnostic/Devis gratuit', label: 'Devis gratuit' },
        ],
      },
    ],
    style: {
      primaryColor: '#0EA5E9',
      gradientColors: ['#0EA5E9', '#0284C7'],
      icon: '❄️',
      badgeColor: '#E0F2FE',
      accentColor: '#0284C7',
    },
    displayPriority: ['serviceClimatisation', 'marqueClimatiseur', 'disponibiliteClim', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // ════════════════════════════════════════════════════════════
  // 🌳 JARDINAGE & PAYSAGISME - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
  // ════════════════════════════════════════════════════════════
  // Services: Élagage palmiers, arbres fruitiers tropicaux, potagers africains,
  // irrigation saison sèche, espaces verts entreprises/hôtels
  // ════════════════════════════════════════════════════════════
  jardinage_paysagisme: {
    terminology: {
      productLabel: 'Service de jardinage',
      productsLabel: 'Jardinage & Paysagisme',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Jardinier/Paysagiste',
      searchPlaceholder: 'Rechercher élagage, tonte, création jardin...',
      emptyMessage: 'Aucun jardinier disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Type de service (40+ options) - PRIORITÉ
      {
        id: 'typeService',
        label: 'Type de service',
        type: 'multiselect',
        options: [
          // Services populaires
          { value: '🌴 Élagage palmiers (royal, cocotier, dattier)', label: '🌴 Élagage palmiers' },
          { value: '🥭 Entretien arbres fruitiers (manguier, avocatier, papayer)', label: '🥭 Arbres fruitiers' },
          { value: '🏡 Tonte pelouse/gazon (résidentiel)', label: '🏡 Tonte pelouse' },
          { value: '✂️ Taille de haies et arbustes', label: '✂️ Taille haies' },
          { value: '🌾 Désherbage manuel et chimique', label: '🌾 Désherbage' },
          { value: '💧 Installation système arrosage automatique', label: '💧 Arrosage automatique' },
          { value: '🏢 Entretien espaces verts (entreprise/hôtel)', label: '🏢 Espaces verts pro' },
          { value: '🌱 Création et entretien potager', label: '🌱 Potager' },
          // Aménagement
          { value: '🏗️ Aménagement paysager complet', label: '🏗️ Aménagement complet' },
          { value: '🌿 Création jardin tropical', label: '🌿 Jardin tropical' },
          { value: '🌸 Plantation massifs floraux', label: '🌸 Massifs floraux' },
          { value: '🌳 Plantation d\'arbres et arbustes', label: '🌳 Plantation arbres' },
          { value: '🏞️ Création allées et bordures', label: '🏞️ Allées/bordures' },
          { value: '🪨 Dallage et pavage jardin', label: '🪨 Dallage' },
          { value: '🏗️ Construction terrasse en bois', label: '🏗️ Terrasse' },
          // Entretien
          { value: '📅 Contrat entretien mensuel', label: '📅 Contrat mensuel' },
          { value: '💧 Arrosage régulier (saison sèche)', label: '💧 Arrosage régulier' },
          { value: '🌱 Traitement phytosanitaire (anti-insectes)', label: '🌱 Traitement phyto' },
          // Gros travaux
          { value: '🪓 Abattage d\'arbres', label: '🪓 Abattage' },
          { value: '🚜 Défrichage terrain', label: '🚜 Défrichage' },
        ],
      },

      // ✅ FILTRE 2 : Plantes africaines (30+ options)
      {
        id: 'plantesAfricaines',
        label: 'Plantes concernées',
        type: 'multiselect',
        options: [
          // Palmiers
          { value: '🌴 Palmier royal', label: '🌴 Palmier royal' },
          { value: '🥥 Cocotier', label: '🥥 Cocotier' },
          { value: '🌴 Palmier dattier', label: '🌴 Palmier dattier' },
          // Arbres fruitiers
          { value: '🥭 Manguier', label: '🥭 Manguier' },
          { value: '🥑 Avocatier', label: '🥑 Avocatier' },
          { value: '🍈 Papayer', label: '🍈 Papayer' },
          { value: '🍊 Oranger', label: '🍊 Oranger' },
          { value: '🍋 Citronnier', label: '🍋 Citronnier' },
          { value: '🥭 Goyavier', label: '🥭 Goyavier' },
          // Fleurs tropicales
          { value: '🌺 Hibiscus (rose de Chine)', label: '🌺 Hibiscus' },
          { value: '🌸 Bougainvilliers', label: '🌸 Bougainvilliers' },
          { value: '🌺 Frangipanier', label: '🌺 Frangipanier' },
          // Plantes ornementales
          { value: '🌿 Croton (codiaeum)', label: '🌿 Croton' },
          { value: '🌿 Dracaena (dragonnier)', label: '🌿 Dracaena' },
          // Potager
          { value: '🌶️ Piment', label: '🌶️ Piment' },
          { value: '🍅 Tomate', label: '🍅 Tomate' },
          { value: '🫛 Gombo (okra)', label: '🫛 Gombo' },
          { value: '🥬 Feuilles de manioc', label: '🥬 Manioc' },
          { value: '🥬 Épinards africains (ndolé)', label: '🥬 Ndolé' },
          // Gazon
          { value: '🌾 Gazon tropical résistant', label: '🌾 Gazon tropical' },
        ],
      },

      // ✅ FILTRE 3 : Fréquence d'entretien (adapté climat africain)
      {
        id: 'frequenceEntretien',
        label: 'Fréquence',
        type: 'select',
        options: [
          { value: '📅 Hebdomadaire (toutes les semaines)', label: '📅 Hebdomadaire' },
          { value: '📅 Bi-hebdomadaire (2 fois/semaine)', label: '📅 2 fois/semaine' },
          { value: '📅 Mensuel (1 fois/mois)', label: '📅 Mensuel' },
          { value: '📅 Bi-mensuel (2 fois/mois)', label: '📅 2 fois/mois' },
          { value: '📅 Trimestriel (tous les 3 mois)', label: '📅 Trimestriel' },
          { value: '🌧️ Début saison des pluies (mars-avril)', label: '🌧️ Saison des pluies' },
          { value: '☀️ Milieu saison sèche (décembre-janvier)', label: '☀️ Saison sèche' },
          { value: '🌿 Intervention ponctuelle unique', label: '🌿 Ponctuel' },
        ],
      },

      // ✅ FILTRE 4 : Type de terrain
      {
        id: 'typeTerrain',
        label: 'Type de terrain',
        type: 'select',
        options: [
          { value: '🏡 Jardin résidentiel (villa)', label: '🏡 Jardin villa' },
          { value: '🏘️ Cour maison (petit jardin)', label: '🏘️ Petite cour' },
          { value: '🏢 Espace vert entreprise/bureau', label: '🏢 Entreprise' },
          { value: '🏨 Jardin hôtel/résidence', label: '🏨 Hôtel' },
          { value: '🏫 Espace vert école/université', label: '🏫 École/Université' },
          { value: '🏥 Jardin clinique/hôpital', label: '🏥 Clinique' },
          { value: '⛪ Jardin église/mosquée', label: '⛪ Lieu de culte' },
          { value: '🏞️ Parc public', label: '🏞️ Parc public' },
          { value: '🌴 Plantation (grande surface)', label: '🌴 Plantation' },
        ],
      },

      // ✅ FILTRE 5 : Surface du terrain (range)
      {
        id: 'surfaceTerrain',
        label: 'Surface terrain',
        type: 'select',
        options: [
          { value: '📏 Moins de 50 m² (petite cour)', label: '< 50 m²' },
          { value: '📏 50 à 100 m² (jardin moyen)', label: '50-100 m²' },
          { value: '📏 100 à 200 m² (grand jardin)', label: '100-200 m²' },
          { value: '📏 200 à 500 m² (très grand jardin)', label: '200-500 m²' },
          { value: '📏 500 à 1000 m² (petit espace vert)', label: '500-1000 m²' },
          { value: '📏 1000 à 3000 m² (grand espace vert)', label: '1000-3000 m²' },
          { value: '📏 Plus de 5000 m² (grande plantation)', label: '> 5000 m²' },
        ],
      },

      // ✅ FILTRE 6 : Matériel fourni
      {
        id: 'materielJardinage',
        label: 'Matériel disponible',
        type: 'multiselect',
        options: [
          { value: '🚜 Tondeuse à essence', label: '🚜 Tondeuse essence' },
          { value: '✂️ Taille-haie motorisé', label: '✂️ Taille-haie' },
          { value: '🌾 Débroussailleuse thermique', label: '🌾 Débroussailleuse' },
          { value: '🪓 Tronçonneuse', label: '🪓 Tronçonneuse' },
          { value: '💧 Système arrosage automatique', label: '💧 Arrosage auto' },
          { value: '🪓 Coupe-coupe (machette africaine)', label: '🪓 Coupe-coupe' },
          { value: '⚒️ Houe (daba)', label: '⚒️ Houe/Daba' },
        ],
      },

      // ✅ FILTRE 7 : Mode de tarification
      {
        id: 'modeTarification',
        label: 'Mode de tarification',
        type: 'select',
        options: [
          { value: '💰 Forfait intervention unique', label: '💰 Forfait unique' },
          { value: '💰 Tarif horaire (par heure)', label: '💰 Tarif horaire' },
          { value: '💰 Forfait mensuel (abonnement)', label: '💰 Abonnement mensuel' },
          { value: '💰 Forfait trimestriel', label: '💰 Forfait trimestriel' },
          { value: '💰 Prix au m² (grande surface)', label: '💰 Prix au m²' },
          { value: '💰 Devis sur mesure', label: '💰 Devis personnalisé' },
        ],
      },

      // ✅ FILTRE 8 : Niveau d'expérience
      {
        id: 'niveauExperience',
        label: 'Niveau d\'expérience',
        type: 'select',
        options: [
          { value: '👨‍🌾 Jardinier professionnel (5+ ans)', label: '👨‍🌾 Professionnel (5+ ans)' },
          { value: '🎓 Paysagiste diplômé', label: '🎓 Paysagiste diplômé' },
          { value: '🏢 Entreprise de paysagisme', label: '🏢 Entreprise' },
          { value: '🌱 Jardinier indépendant', label: '🌱 Indépendant' },
        ],
      },

      // ✅ FILTRE 9 : Prestations incluses
      {
        id: 'prestationsIncluses',
        label: 'Prestations incluses',
        type: 'multiselect',
        options: [
          { value: '✅ Matériel fourni', label: '✅ Matériel fourni' },
          { value: '✅ Produits (engrais, phyto) fournis', label: '✅ Produits fournis' },
          { value: '✅ Évacuation déchets verts incluse', label: '✅ Évacuation déchets' },
          { value: '✅ Arrosage inclus', label: '✅ Arrosage inclus' },
          { value: '✅ Conseil personnalisé', label: '✅ Conseils' },
          { value: '✅ Garantie reprise plantes', label: '✅ Garantie reprise' },
        ],
      },

      // ✅ FILTRE 10 : Prix (range)
      {
        id: 'prix',
        label: 'Budget',
        type: 'range',
        min: 5000,
        max: 500000,
        unit: 'FCFA',
      },

      // ✅ FILTRE 11 : Zone d'intervention (géolocalisation intelligente)
      {
        id: 'zonesIntervention',
        label: 'Zone d\'intervention',
        type: 'select',
        options: [
          // Les villes s'adaptent au pays de l'utilisateur via africanLocations.ts
          // Cameroun par défaut
          { value: 'Douala', label: 'Douala' },
          { value: 'Yaoundé', label: 'Yaoundé' },
          { value: 'Bafoussam', label: 'Bafoussam' },
          { value: 'Garoua', label: 'Garoua' },
          { value: 'Bamenda', label: 'Bamenda' },
          { value: 'Limbe', label: 'Limbe' },
        ],
      },

      // ✅ FILTRE 12 : Disponibilité
      {
        id: 'disponibilite',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Immédiate (cette semaine)', label: 'Cette semaine' },
          { value: 'Sous 2 semaines', label: 'Sous 2 semaines' },
          { value: 'Sous 1 mois', label: 'Sous 1 mois' },
          { value: 'Planning flexible', label: 'Flexible' },
        ],
      },

      // ✅ FILTRE 13 : Évaluation (note minimale)
      {
        id: 'noteMinimale',
        label: 'Note minimale',
        type: 'select',
        options: [
          { value: '5', label: '⭐⭐⭐⭐⭐ 5 étoiles' },
          { value: '4', label: '⭐⭐⭐⭐ 4+ étoiles' },
          { value: '3', label: '⭐⭐⭐ 3+ étoiles' },
        ],
      },

      // ✅ FILTRE 14 : Urgence
      {
        id: 'urgence',
        label: 'Urgence',
        type: 'select',
        options: [
          { value: 'oui', label: '🚨 Intervention urgente uniquement' },
          { value: 'non', label: 'Toutes interventions' },
        ],
      },

      // ✅ FILTRE 15 : Devis gratuit
      {
        id: 'devisGratuit',
        label: 'Devis gratuit',
        type: 'select',
        options: [
          { value: 'oui', label: '✅ Devis gratuit uniquement' },
          { value: 'tous', label: 'Tous' },
        ],
      },
    ],
    style: {
      primaryColor: '#059669',
      gradientColors: ['#059669', '#047857'],
      icon: '🌳',
      badgeColor: '#D1FAE5',
      accentColor: '#047857',
    },
    displayPriority: ['typeService', 'frequenceEntretien', 'surfaceTerrain', 'prix', 'zonesIntervention'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🧹 NETTOYAGE & ENTRETIEN
  // ════════════════════════════════════════════════════════════
  // 🧹 NETTOYAGE & ENTRETIEN - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
  // ════════════════════════════════════════════════════════════
  // Femme de ménage (Bonne, Aide ménagère, House girl, Boy domestique),
  // Nounou/Baby-sitter (Nanny, Gardienne d'enfants, Bébé sitter),
  // Blanchisseur/Pressing (Lavage vêtements, Repassage, Dry cleaning),
  // Gardien/Vigile (Watchman, Agent de sécurité, Gardien de nuit),
  // Jardinier (Espaces verts, Entretien jardin, Paysagiste),
  // Cuisinière/Cuisinier à domicile (Chef à domicile, Cook),
  // Chauffeur personnel, Nettoyage bureaux/commerces, Entretien piscine
  // ════════════════════════════════════════════════════════════
  nettoyage_entretien: {
    terminology: {
      productLabel: 'Service de nettoyage & entretien',
      productsLabel: 'Nettoyage & Entretien Domestique',
      priceLabel: 'Tarif mensuel/journalier',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Prestataire/Employé',
      searchPlaceholder: 'Rechercher femme de ménage, nounou, blanchisseur, gardien...',
      emptyMessage: 'Aucun service de nettoyage & entretien disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Type de service (40+ options - Contexte Afrique)
      {
        id: 'typeServiceNettoyage',
        label: 'Type de service',
        type: 'select',
        options: [
          // Ménage & Nettoyage domestique
          { value: 'Femme de ménage (aide ménagère)', label: 'Femme de ménage' },
          { value: 'Bonne à demeure (logée/nourrie)', label: 'Bonne à demeure' },
          { value: 'House girl (anglophone)', label: 'House girl' },
          { value: 'Boy domestique (homme de ménage)', label: 'Boy domestique' },
          { value: 'Aide ménagère à temps partiel', label: 'Aide ménagère (temps partiel)' },
          { value: 'Aide ménagère à temps plein', label: 'Aide ménagère (temps plein)' },
          { value: 'Technicienne de surface', label: 'Technicienne de surface' },

          // Garde d'enfants & Nounou
          { value: 'Nounou à domicile (nanny)', label: 'Nounou à domicile' },
          { value: 'Baby-sitter (bébé sitter)', label: 'Baby-sitter' },
          { value: 'Gardienne d\'enfants certifiée', label: 'Gardienne d\'enfants' },
          { value: 'Nounou de nuit (garde nocturne)', label: 'Nounou de nuit' },
          { value: 'Nounou bilingue (français-anglais)', label: 'Nounou bilingue' },
          { value: 'Assistante maternelle agréée', label: 'Assistante maternelle' },
          { value: 'Nanny (anglophone)', label: 'Nanny (anglophone)' },

          // Blanchisseur & Pressing
          { value: 'Blanchisseur/Blanchisseuse (lavage vêtements)', label: 'Blanchisseur' },
          { value: 'Service de pressing (nettoyage à sec)', label: 'Pressing/Dry cleaning' },
          { value: 'Repassage professionnel', label: 'Repassage' },
          { value: 'Lavage + Repassage vêtements', label: 'Lavage + Repassage' },
          { value: 'Blanchisserie industrielle', label: 'Blanchisserie industrielle' },

          // Sécurité & Gardiennage
          { value: 'Gardien de maison (watchman)', label: 'Gardien de maison' },
          { value: 'Vigile/Agent de sécurité', label: 'Vigile/Agent de sécurité' },
          { value: 'Gardien de nuit (night watchman)', label: 'Gardien de nuit' },
          { value: 'Gardien de jour', label: 'Gardien de jour' },
          { value: 'Gardien 24h/24', label: 'Gardien 24h/24' },
          { value: 'Agent de sécurité armé', label: 'Agent de sécurité armé' },

          // Jardinage & Espaces verts
          { value: 'Jardinier (entretien jardin)', label: 'Jardinier' },
          { value: 'Jardinier-paysagiste', label: 'Jardinier-paysagiste' },
          { value: 'Entretien espaces verts', label: 'Entretien espaces verts' },
          { value: 'Élagage arbres & taille haies', label: 'Élagage & taille' },
          { value: 'Arrosage & entretien pelouse', label: 'Arrosage & pelouse' },

          // Cuisine à domicile
          { value: 'Cuisinière/Cuisinier à domicile', label: 'Cuisinière à domicile' },
          { value: 'Chef cuisinier personnel (cook)', label: 'Chef personnel' },
          { value: 'Cuisinière logée/nourrie', label: 'Cuisinière logée' },
          { value: 'Aide-cuisinière', label: 'Aide-cuisinière' },

          // Chauffeur
          { value: 'Chauffeur personnel', label: 'Chauffeur personnel' },
          { value: 'Chauffeur famille (tous trajets)', label: 'Chauffeur famille' },
          { value: 'Chauffeur-livreur', label: 'Chauffeur-livreur' },

          // Nettoyage professionnel
          { value: 'Nettoyage bureaux/commerces', label: 'Nettoyage bureaux' },
          { value: 'Nettoyage immeuble/copropriété', label: 'Nettoyage immeuble' },
          { value: 'Nettoyage après chantier', label: 'Nettoyage après chantier' },
          { value: 'Nettoyage industriel', label: 'Nettoyage industriel' },
          { value: 'Nettoyage vitres & façades', label: 'Nettoyage vitres' },
          { value: 'Nettoyage moquettes & tapis', label: 'Nettoyage moquettes' },
          { value: 'Désinfection & désinsectisation', label: 'Désinfection' },

          // Entretien spécifique
          { value: 'Entretien piscine', label: 'Entretien piscine' },
          { value: 'Entretien climatisation', label: 'Entretien climatisation' },
          { value: 'Lavage voiture à domicile', label: 'Lavage voiture' },
        ],
      },

      // ✅ FILTRE 2 : Fréquence de service (15+ options)
      {
        id: 'frequenceService',
        label: 'Fréquence',
        type: 'select',
        options: [
          { value: 'Ponctuel (une fois)', label: 'Ponctuel' },
          { value: 'Quotidien (tous les jours)', label: 'Quotidien (7j/7)' },
          { value: 'Du lundi au vendredi (5j/7)', label: 'Lun-Ven (5j/7)' },
          { value: 'Du lundi au samedi (6j/7)', label: 'Lun-Sam (6j/7)' },
          { value: '2 fois par semaine', label: '2 fois/semaine' },
          { value: '3 fois par semaine', label: '3 fois/semaine' },
          { value: 'Hebdomadaire (1 fois/semaine)', label: '1 fois/semaine' },
          { value: 'Bi-hebdomadaire (tous les 15 jours)', label: 'Tous les 15 jours' },
          { value: 'Mensuel (1 fois/mois)', label: '1 fois/mois' },
          { value: 'Week-end uniquement', label: 'Week-end' },
          { value: 'Soir uniquement (après 18h)', label: 'Soir (après 18h)' },
          { value: 'Nuit uniquement (garde de nuit)', label: 'Nuit' },
          { value: 'Horaires flexibles (à définir)', label: 'Flexible' },
        ],
      },

      // ✅ FILTRE 3 : Modalité d'emploi (Live-in / Live-out)
      {
        id: 'modaliteEmploi',
        label: 'Modalité d\'emploi',
        type: 'select',
        options: [
          { value: 'Live-out (rentre chez elle le soir)', label: 'Live-out (rentre le soir)' },
          { value: 'Live-in (logée sur place)', label: 'Live-in (logée)' },
          { value: 'Logée + nourrie (à demeure)', label: 'Logée + nourrie' },
          { value: 'Demi-pension (déjeuner fourni)', label: 'Demi-pension' },
          { value: 'Nourrie uniquement (pas logée)', label: 'Nourrie seulement' },
          { value: 'Autonome (non logée, non nourrie)', label: 'Autonome' },
        ],
      },

      // ✅ FILTRE 4 : Horaires de travail
      {
        id: 'horairesService',
        label: 'Horaires de travail',
        type: 'select',
        options: [
          { value: 'Temps plein (8h-17h)', label: 'Temps plein (8h-17h)' },
          { value: 'Temps plein (7h-16h)', label: 'Temps plein (7h-16h)' },
          { value: 'Temps partiel (4 heures/jour)', label: 'Mi-temps (4h/jour)' },
          { value: 'Temps partiel (2-3 heures/jour)', label: 'Quelques heures/jour' },
          { value: 'Matin uniquement (6h-12h)', label: 'Matin (6h-12h)' },
          { value: 'Après-midi uniquement (12h-18h)', label: 'Après-midi (12h-18h)' },
          { value: 'Soirée (18h-22h)', label: 'Soirée (18h-22h)' },
          { value: 'Nuit (22h-6h)', label: 'Nuit (22h-6h)' },
          { value: '24h/24 (garde permanente)', label: '24h/24' },
          { value: 'Horaires à définir (flexible)', label: 'Flexible' },
        ],
      },

      // ✅ FILTRE 5 : Nombre d'enfants (pour nounou/baby-sitter)
      {
        id: 'nombreEnfants',
        label: 'Nombre d\'enfants à garder',
        type: 'select',
        options: [
          { value: '1 enfant', label: '1 enfant' },
          { value: '2 enfants', label: '2 enfants' },
          { value: '3 enfants', label: '3 enfants' },
          { value: '4 enfants ou plus', label: '4+ enfants' },
        ],
      },

      // ✅ FILTRE 6 : Âge des enfants (pour nounou)
      {
        id: 'ageEnfants',
        label: 'Âge des enfants',
        type: 'select',
        options: [
          { value: 'Nouveau-né (0-6 mois)', label: 'Nouveau-né (0-6 mois)' },
          { value: 'Bébé (6 mois - 2 ans)', label: 'Bébé (6 mois - 2 ans)' },
          { value: 'Tout-petit (2-4 ans)', label: 'Tout-petit (2-4 ans)' },
          { value: 'Enfant (4-8 ans)', label: 'Enfant (4-8 ans)' },
          { value: 'Pré-ado (8-12 ans)', label: 'Pré-ado (8-12 ans)' },
          { value: 'Adolescent (12+ ans)', label: 'Adolescent (12+)' },
          { value: 'Tous âges', label: 'Tous âges' },
        ],
      },

      // ✅ FILTRE 7 : Tâches spécifiques (Multi-sélection)
      {
        id: 'tachesSpecifiques',
        label: 'Tâches incluses',
        type: 'multiselect',
        options: [
          // Ménage
          { value: 'Nettoyage sols (balayage, lavage)', label: 'Nettoyage sols' },
          { value: 'Dépoussiérage meubles', label: 'Dépoussiérage' },
          { value: 'Nettoyage cuisine', label: 'Nettoyage cuisine' },
          { value: 'Nettoyage salles de bain/WC', label: 'Nettoyage SDB/WC' },
          { value: 'Nettoyage vitres', label: 'Nettoyage vitres' },
          { value: 'Rangement intérieur', label: 'Rangement' },
          { value: 'Lessivage murs & plafonds', label: 'Lessivage murs' },

          // Linge
          { value: 'Lavage linge à la main', label: 'Lavage à la main' },
          { value: 'Lavage linge en machine', label: 'Lavage en machine' },
          { value: 'Repassage vêtements', label: 'Repassage' },
          { value: 'Pliage & rangement linge', label: 'Pliage linge' },
          { value: 'Nettoyage à sec (pressing)', label: 'Pressing' },

          // Cuisine
          { value: 'Préparation repas (cuisine)', label: 'Préparation repas' },
          { value: 'Cuisine locale africaine', label: 'Cuisine africaine' },
          { value: 'Vaisselle & rangement cuisine', label: 'Vaisselle' },
          { value: 'Courses au marché', label: 'Courses au marché' },

          // Garde d'enfants
          { value: 'Garde d\'enfants', label: 'Garde d\'enfants' },
          { value: 'Préparation biberons/repas bébé', label: 'Repas bébé' },
          { value: 'Change couches & toilette bébé', label: 'Change & toilette' },
          { value: 'Accompagnement école/activités', label: 'Accompagnement école' },
          { value: 'Aide aux devoirs', label: 'Aide aux devoirs' },
          { value: 'Activités ludiques/éducatives', label: 'Activités ludiques' },
          { value: 'Surveillance bain/douche', label: 'Surveillance bain' },

          // Extérieur & Jardin
          { value: 'Nettoyage cour/terrasse', label: 'Nettoyage cour' },
          { value: 'Arrosage plantes/jardin', label: 'Arrosage' },
          { value: 'Tonte pelouse', label: 'Tonte pelouse' },
          { value: 'Taille haies & arbustes', label: 'Taille haies' },
          { value: 'Entretien piscine', label: 'Entretien piscine' },

          // Autres
          { value: 'Lavage voiture', label: 'Lavage voiture' },
          { value: 'Surveillance maison', label: 'Surveillance maison' },
          { value: 'Réception visiteurs/colis', label: 'Réception' },
          { value: 'Soins animaux domestiques', label: 'Soins animaux' },
        ],
      },

      // ✅ FILTRE 8 : Expérience professionnelle
      {
        id: 'experienceNettoyage',
        label: 'Expérience',
        type: 'select',
        options: [
          { value: 'Débutant(e) (< 6 mois)', label: 'Débutant(e)' },
          { value: '6 mois - 1 an', label: '6 mois - 1 an' },
          { value: '1-2 ans', label: '1-2 ans' },
          { value: '2-3 ans', label: '2-3 ans' },
          { value: '3-5 ans', label: '3-5 ans' },
          { value: '5-10 ans', label: '5-10 ans' },
          { value: '10-15 ans', label: '10-15 ans' },
          { value: '15+ ans (très expérimenté)', label: '15+ ans' },
        ],
      },

      // ✅ FILTRE 9 : Langues parlées (important en Afrique bilingue/multilingue)
      {
        id: 'languesParlees',
        label: 'Langues parlées',
        type: 'multiselect',
        options: [
          { value: 'Français (courant)', label: 'Français' },
          { value: 'Anglais (fluent)', label: 'Anglais' },
          { value: 'Bilingue (français-anglais)', label: 'Bilingue (Fr-En)' },
          { value: 'Bamiléké', label: 'Bamiléké' },
          { value: 'Ewondo', label: 'Ewondo' },
          { value: 'Douala', label: 'Douala' },
          { value: 'Fulfuldé (Peul)', label: 'Fulfuldé' },
          { value: 'Bassa', label: 'Bassa' },
          { value: 'Pidgin English', label: 'Pidgin English' },
          { value: 'Lingala', label: 'Lingala' },
          { value: 'Wolof', label: 'Wolof' },
          { value: 'Dioula', label: 'Dioula' },
        ],
      },

      // ✅ FILTRE 10 : Certifications & Références
      {
        id: 'certificationNettoyage',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'Références vérifiées', label: 'Références vérifiées' },
          { value: 'Attestation formation ménagère', label: 'Formation ménagère' },
          { value: 'Certificat premiers secours', label: 'Premiers secours' },
          { value: 'Certificat garde d\'enfants', label: 'Garde d\'enfants' },
          { value: 'Diplôme cuisinière/cuisinier', label: 'Diplôme cuisine' },
          { value: 'Certificat sécurité/gardiennage', label: 'Sécurité' },
          { value: 'Casier judiciaire vierge', label: 'Casier judiciaire vierge' },
          { value: 'Recommandations familles précédentes', label: 'Recommandations' },
        ],
      },

      // ✅ FILTRE 11 : Équipements fournis par le prestataire
      {
        id: 'equipementsFournis',
        label: 'Équipements fournis',
        type: 'multiselect',
        options: [
          { value: 'Produits d\'entretien', label: 'Produits d\'entretien' },
          { value: 'Aspirateur', label: 'Aspirateur' },
          { value: 'Serpillière & balai', label: 'Serpillière & balai' },
          { value: 'Matériel professionnel', label: 'Matériel professionnel' },
          { value: 'Nettoyeur vapeur', label: 'Nettoyeur vapeur' },
          { value: 'Équipement de sécurité', label: 'Équipement sécurité' },
          { value: 'Outils de jardinage', label: 'Outils jardinage' },
          { value: 'Aucun (client fournit)', label: 'Aucun (client fournit)' },
        ],
      },

      // ✅ FILTRE 12 : Surface à entretenir (pour ménage/bureaux)
      {
        id: 'surfaceEntretien',
        label: 'Surface à entretenir',
        type: 'select',
        options: [
          { value: 'Petit logement (< 50m²)', label: '< 50m²' },
          { value: 'Logement moyen (50-100m²)', label: '50-100m²' },
          { value: 'Grand logement (100-200m²)', label: '100-200m²' },
          { value: 'Très grand logement (200-300m²)', label: '200-300m²' },
          { value: 'Villa/Maison (300-500m²)', label: '300-500m²' },
          { value: 'Grande propriété (500m²+)', label: '500m²+' },
          { value: 'Bureau petit (< 100m²)', label: 'Bureau < 100m²' },
          { value: 'Bureau moyen (100-300m²)', label: 'Bureau 100-300m²' },
          { value: 'Bureau grand (300m²+)', label: 'Bureau 300m²+' },
          { value: 'Immeuble/Copropriété', label: 'Immeuble' },
        ],
      },

      // ✅ FILTRE 13 : Zone d'intervention (Villes & Quartiers Afrique)
      {
        id: 'zoneInterventionNettoyage',
        label: 'Zone d\'intervention',
        type: 'select',
        options: [
          // ═══ CAMEROUN ═══
          // Douala (20 quartiers principaux)
          { value: '🇨🇲 Douala - Akwa', label: 'Douala Akwa' },
          { value: '🇨🇲 Douala - Bonanjo (Centre affaires)', label: 'Douala Bonanjo' },
          { value: '🇨🇲 Douala - Bonapriso (Résidentiel)', label: 'Douala Bonapriso' },
          { value: '🇨🇲 Douala - Deido', label: 'Douala Deido' },
          { value: '🇨🇲 Douala - Makepe', label: 'Douala Makepe' },
          { value: '🇨🇲 Douala - PK8-PK17 (Route Yaoundé)', label: 'Douala PK8-17' },
          { value: '🇨🇲 Douala - Logpom', label: 'Douala Logpom' },
          { value: '🇨🇲 Douala - Bassa', label: 'Douala Bassa' },
          { value: '🇨🇲 Douala - Ndogpassi', label: 'Douala Ndogpassi' },
          { value: '🇨🇲 Douala - New Bell', label: 'Douala New Bell' },
          { value: '🇨🇲 Douala - Bonabéri', label: 'Douala Bonabéri' },
          { value: '🇨🇲 Douala - Kotto', label: 'Douala Kotto' },
          { value: '🇨🇲 Douala - Cité SIC', label: 'Douala Cité SIC' },
          { value: '🇨🇲 Douala - Bépanda', label: 'Douala Bépanda' },
          { value: '🇨🇲 Douala - Bonamoussadi', label: 'Douala Bonamoussadi' },

          // Yaoundé (20 quartiers principaux)
          { value: '🇨🇲 Yaoundé - Bastos (Quartier diplomates)', label: 'Yaoundé Bastos' },
          { value: '🇨🇲 Yaoundé - Centre-ville', label: 'Yaoundé Centre' },
          { value: '🇨🇲 Yaoundé - Nlongkak', label: 'Yaoundé Nlongkak' },
          { value: '🇨🇲 Yaoundé - Odza', label: 'Yaoundé Odza' },
          { value: '🇨🇲 Yaoundé - Mvan', label: 'Yaoundé Mvan' },
          { value: '🇨🇲 Yaoundé - Omnisport', label: 'Yaoundé Omnisport' },
          { value: '🇨🇲 Yaoundé - Elig-Edzoa', label: 'Yaoundé Elig-Edzoa' },
          { value: '🇨🇲 Yaoundé - Mokolo', label: 'Yaoundé Mokolo' },
          { value: '🇨🇲 Yaoundé - Tsinga', label: 'Yaoundé Tsinga' },
          { value: '🇨🇲 Yaoundé - Obili', label: 'Yaoundé Obili' },
          { value: '🇨🇲 Yaoundé - Essos', label: 'Yaoundé Essos' },
          { value: '🇨🇲 Yaoundé - Emana', label: 'Yaoundé Emana' },
          { value: '🇨🇲 Yaoundé - Ekounou', label: 'Yaoundé Ekounou' },
          { value: '🇨🇲 Yaoundé - Ngousso', label: 'Yaoundé Ngousso' },
          { value: '🇨🇲 Yaoundé - Mendong', label: 'Yaoundé Mendong' },

          // Autres villes Cameroun
          { value: '🇨🇲 Bafoussam', label: 'Bafoussam' },
          { value: '🇨🇲 Garoua', label: 'Garoua' },
          { value: '🇨🇲 Bamenda', label: 'Bamenda' },
          { value: '🇨🇲 Maroua', label: 'Maroua' },
          { value: '🇨🇲 Ngaoundéré', label: 'Ngaoundéré' },
          { value: '🇨🇲 Limbé', label: 'Limbé' },
          { value: '🇨🇲 Kribi', label: 'Kribi' },
          { value: '🇨🇲 Bertoua', label: 'Bertoua' },
          { value: '🇨🇲 Ebolowa', label: 'Ebolowa' },

          // ═══ CÔTE D'IVOIRE ═══
          { value: '🇨🇮 Abidjan - Plateau', label: 'Abidjan Plateau' },
          { value: '🇨🇮 Abidjan - Cocody (Résidentiel)', label: 'Abidjan Cocody' },
          { value: '🇨🇮 Abidjan - Marcory', label: 'Abidjan Marcory' },
          { value: '🇨🇮 Abidjan - Yopougon', label: 'Abidjan Yopougon' },
          { value: '🇨🇮 Abidjan - Adjamé', label: 'Abidjan Adjamé' },
          { value: '🇨🇮 Abidjan - Treichville', label: 'Abidjan Treichville' },
          { value: '🇨🇮 Abidjan - Koumassi', label: 'Abidjan Koumassi' },
          { value: '🇨🇮 Abidjan - Abobo', label: 'Abidjan Abobo' },
          { value: '🇨🇮 Abidjan - Riviera (Résidentiel)', label: 'Abidjan Riviera' },
          { value: '🇨🇮 Abidjan - Angré', label: 'Abidjan Angré' },
          { value: '🇨🇮 Yamoussoukro', label: 'Yamoussoukro' },
          { value: '🇨🇮 Bouaké', label: 'Bouaké' },
          { value: '🇨🇮 San Pedro', label: 'San Pedro' },

          // ═══ RDC ═══
          { value: '🇨🇩 Kinshasa - Gombe (Centre)', label: 'Kinshasa Gombe' },
          { value: '🇨🇩 Kinshasa - Ngaliema', label: 'Kinshasa Ngaliema' },
          { value: '🇨🇩 Kinshasa - Limete', label: 'Kinshasa Limete' },
          { value: '🇨🇩 Kinshasa - Kalamu', label: 'Kinshasa Kalamu' },
          { value: '🇨🇩 Kinshasa - Bandalungwa', label: 'Kinshasa Bandalungwa' },
          { value: '🇨🇩 Kinshasa - Matete', label: 'Kinshasa Matete' },
          { value: '🇨🇩 Lubumbashi', label: 'Lubumbashi' },
          { value: '🇨🇩 Mbuji-Mayi', label: 'Mbuji-Mayi' },

          // ═══ SÉNÉGAL ═══
          { value: '🇸🇳 Dakar - Plateau', label: 'Dakar Plateau' },
          { value: '🇸🇳 Dakar - Almadies (Résidentiel)', label: 'Dakar Almadies' },
          { value: '🇸🇳 Dakar - Mermoz', label: 'Dakar Mermoz' },
          { value: '🇸🇳 Dakar - Parcelles Assainies', label: 'Dakar Parcelles' },
          { value: '🇸🇳 Dakar - Grand Yoff', label: 'Dakar Grand Yoff' },
          { value: '🇸🇳 Dakar - Ouakam', label: 'Dakar Ouakam' },
          { value: '🇸🇳 Dakar - Point E', label: 'Dakar Point E' },
          { value: '🇸🇳 Thiès', label: 'Thiès' },
          { value: '🇸🇳 Saint-Louis', label: 'Saint-Louis' },

          // ═══ GABON ═══
          { value: '🇬🇦 Libreville - Centre-ville', label: 'Libreville Centre' },
          { value: '🇬🇦 Libreville - Louis (Quartier résidentiel)', label: 'Libreville Louis' },
          { value: '🇬🇦 Libreville - Batterie IV', label: 'Libreville Batterie IV' },
          { value: '🇬🇦 Port-Gentil', label: 'Port-Gentil' },

          // ═══ CONGO-BRAZZAVILLE ═══
          { value: '🇨🇬 Brazzaville - Centre-ville', label: 'Brazzaville Centre' },
          { value: '🇨🇬 Brazzaville - Poto-Poto', label: 'Brazzaville Poto-Poto' },
          { value: '🇨🇬 Brazzaville - Bacongo', label: 'Brazzaville Bacongo' },
          { value: '🇨🇬 Pointe-Noire', label: 'Pointe-Noire' },

          // ═══ MALI ═══
          { value: '🇲🇱 Bamako - Centre', label: 'Bamako Centre' },
          { value: '🇲🇱 Bamako - Hippodrome', label: 'Bamako Hippodrome' },
          { value: '🇲🇱 Bamako - Badalabougou', label: 'Bamako Badalabougou' },
          { value: '🇲🇱 Sikasso', label: 'Sikasso' },

          // ═══ BÉNIN ═══
          { value: '🇧🇯 Cotonou - Centre', label: 'Cotonou Centre' },
          { value: '🇧🇯 Cotonou - Cadjèhoun', label: 'Cotonou Cadjèhoun' },
          { value: '🇧🇯 Porto-Novo', label: 'Porto-Novo' },

          // ═══ TOGO ═══
          { value: '🇹🇬 Lomé - Centre', label: 'Lomé Centre' },
          { value: '🇹🇬 Lomé - Kodjoviakopé', label: 'Lomé Kodjoviakopé' },

          // ═══ NIGER ═══
          { value: '🇳🇪 Niamey', label: 'Niamey' },

          // ═══ TCHAD ═══
          { value: '🇹🇩 N\'Djamena', label: 'N\'Djamena' },

          // Zone large
          { value: '🌍 Toute la ville', label: 'Toute la ville' },
          { value: '🌍 Toute l\'Afrique francophone', label: 'Toute l\'Afrique francophone' },
        ],
      },

      // ✅ FILTRE 14 : Disponibilité immédiate
      {
        id: 'disponibiliteImmediateNettoyage',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Disponible immédiatement', label: 'Immédiate' },
          { value: 'Disponible cette semaine', label: 'Cette semaine' },
          { value: 'Disponible dans 2 semaines', label: 'Dans 2 semaines' },
          { value: 'Disponible dans 1 mois', label: 'Dans 1 mois' },
          { value: 'Période de préavis (employeur actuel)', label: 'Période de préavis' },
        ],
      },

      // ✅ FILTRE 15 : Salaire mensuel souhaité (FCFA)
      {
        id: 'salaireSouhaite',
        label: 'Salaire mensuel (FCFA)',
        type: 'range',
        min: 30000,
        max: 500000,
        unit: 'FCFA',
      },

      // ✅ FILTRE 16 : Type de contrat
      {
        id: 'typeContratNettoyage',
        label: 'Type de contrat',
        type: 'select',
        options: [
          { value: 'CDI (Contrat à durée indéterminée)', label: 'CDI' },
          { value: 'CDD (Contrat à durée déterminée)', label: 'CDD' },
          { value: 'Contrat temporaire (< 3 mois)', label: 'Temporaire' },
          { value: 'Remplacement (congé/maladie)', label: 'Remplacement' },
          { value: 'Freelance/Indépendant', label: 'Freelance' },
          { value: 'Essai professionnel (1 mois)', label: 'Période d\'essai' },
        ],
      },
    ],
    style: {
      primaryColor: '#10B981',
      gradientColors: ['#10B981', '#059669'],
      icon: '🧹',
      badgeColor: '#D1FAE5',
      accentColor: '#059669',
    },
    displayPriority: ['typeServiceNettoyage', 'frequenceService', 'modaliteEmploi', 'horairesService', 'zoneInterventionNettoyage', 'experienceNettoyage', 'languesParlees', 'salaireSouhaite'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    searchKeywords: [
      // Français général
      'femme de menage', 'aide menagere', 'bonne', 'domestique', 'nounou', 'nanny', 'baby sitter', 'babysitter',
      'blanchisseur', 'blanchisseuse', 'pressing', 'lavage', 'repassage', 'gardien', 'vigile', 'watchman',
      'jardinier', 'paysagiste', 'cuisiniere', 'cuisinier', 'cook', 'chauffeur', 'nettoyage',

      // Termes camerounais
      'house girl', 'house boy', 'boy', 'small', 'garde enfant', 'bebe sitter',

      // Termes RDC (Lingala)
      'mususu', 'mobali ya ndako', 'mama ya bilanga',

      // Termes Côte d'Ivoire (Nouchi)
      'go', 'tchin', 'bonne menagere',

      // Termes Sénégal (Wolof)
      'jabar', 'diara', 'liggey ndaw',
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 🧘 BIEN-ÊTRE & SPA - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
  // ════════════════════════════════════════════════════════════
  // Massages (Suédois, Thai, Californien, Ayurvédique, Africain),
  // Spa (Hammam, Sauna, Jacuzzi, Balnéothérapie, Thalasso),
  // Soins corporels (Gommage, Enveloppement, Drainage lymphatique),
  // Soins visage (Anti-âge, Hydratant, Purifiant), Réflexologie,
  // Méditation, Yoga, Sophrologie, Reiki
  // ════════════════════════════════════════════════════════════
  bien_etre_spa: {
    terminology: {
      productLabel: 'Soin bien-être',
      productsLabel: 'Bien-être & Spa',
      priceLabel: 'Tarif',
      locationLabel: 'Adresse',
      providerLabel: 'Spa/Thérapeute',
      searchPlaceholder: 'Rechercher un spa, massage, soin bien-être...',
      emptyMessage: 'Aucun soin disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Type de soin (25+ options)
      {
        id: 'typeBienEtre',
        label: 'Type de soin',
        type: 'select',
        options: [
          // Massages
          { value: 'Massage suédois (relaxant, circulation sanguine)', label: 'Massage Suédois' },
          { value: 'Massage thaïlandais (étirements, pression)', label: 'Massage Thaï' },
          { value: 'Massage californien (doux, relaxation profonde)', label: 'Massage Californien' },
          { value: 'Massage ayurvédique (huiles, équilibre énergétique)', label: 'Massage Ayurvédique' },
          { value: 'Massage aux pierres chaudes (détente musculaire)', label: 'Pierres Chaudes' },
          { value: 'Massage balinais (pressions, étirements)', label: 'Massage Balinais' },
          { value: 'Massage shiatsu (points de pression)', label: 'Massage Shiatsu' },
          { value: 'Massage africain traditionnel (beurre de karité)', label: 'Massage Africain' },
          { value: 'Massage sportif (récupération musculaire)', label: 'Massage Sportif' },
          { value: 'Massage femme enceinte (prénatal)', label: 'Massage Prénatal' },

          // Spa & Balnéothérapie
          { value: 'Hammam (vapeur, gommage)', label: 'Hammam' },
          { value: 'Sauna (chaleur sèche, détox)', label: 'Sauna' },
          { value: 'Jacuzzi / Bain à remous', label: 'Jacuzzi' },
          { value: 'Balnéothérapie (bains hydromassants)', label: 'Balnéothérapie' },
          { value: 'Thalassothérapie (eau de mer)', label: 'Thalasso' },

          // Soins corporels
          { value: 'Gommage corporel (exfoliation)', label: 'Gommage Corporel' },
          { value: 'Enveloppement corporel (argile, algues)', label: 'Enveloppement' },
          { value: 'Drainage lymphatique (détox, circulation)', label: 'Drainage Lymphatique' },

          // Soins visage
          { value: 'Soin visage hydratant', label: 'Soin Visage Hydratant' },
          { value: 'Soin visage anti-âge', label: 'Soin Anti-Âge' },
          { value: 'Soin visage purifiant (acné)', label: 'Soin Purifiant' },
          { value: 'Soin visage éclaircissant', label: 'Soin Éclaircissant' },

          // Soins énergétiques & alternatifs
          { value: 'Réflexologie plantaire (points de pression pieds)', label: 'Réflexologie' },
          { value: 'Aromathérapie (huiles essentielles)', label: 'Aromathérapie' },
          { value: 'Reiki (énergie, guérison)', label: 'Reiki' },
          { value: 'Méditation guidée', label: 'Méditation' },
          { value: 'Yoga & Relaxation', label: 'Yoga' },
          { value: 'Sophrologie (relaxation dynamique)', label: 'Sophrologie' },
        ],
      },

      // ✅ FILTRE 2 : Services & équipements disponibles (15+ options)
      {
        id: 'servicesBienEtre',
        label: 'Services & Équipements',
        type: 'multiselect',
        options: [
          { value: 'Hammam', label: 'Hammam' },
          { value: 'Sauna', label: 'Sauna' },
          { value: 'Jacuzzi / Bain à remous', label: 'Jacuzzi' },
          { value: 'Piscine chauffée', label: 'Piscine chauffée' },
          { value: 'Salle de massage privée', label: 'Salle privée' },
          { value: 'Cabine duo (massage à 2)', label: 'Cabine Duo' },
          { value: 'Espace relaxation (thé, tisanes)', label: 'Espace relaxation' },
          { value: 'Vestiaires individuels', label: 'Vestiaires' },
          { value: 'Climatisation', label: 'Climatisation' },
          { value: 'Musique relaxante', label: 'Ambiance musicale' },
          { value: 'Aromathérapie (diffuseur huiles essentielles)', label: 'Aromathérapie' },
          { value: 'Produits bio / naturels', label: 'Produits Bio' },
          { value: 'Produits africains (beurre karité, huile argan)', label: 'Produits Africains' },
          { value: 'Service à domicile', label: 'Service à Domicile' },
          { value: 'Parking gratuit', label: 'Parking' },
        ],
      },

      // ✅ FILTRE 3 : Durée du soin (10+ options)
      {
        id: 'dureeBienEtre',
        label: 'Durée du soin',
        type: 'select',
        options: [
          { value: '30 minutes (rapide)', label: '30 min' },
          { value: '45 minutes', label: '45 min' },
          { value: '1 heure (standard)', label: '1h' },
          { value: '1h30 (relaxation complète)', label: '1h30' },
          { value: '2 heures (soin premium)', label: '2h' },
          { value: '2h30', label: '2h30' },
          { value: '3 heures (formule luxe)', label: '3h' },
          { value: 'Demi-journée (4h)', label: 'Demi-journée' },
          { value: 'Journée complète (8h)', label: 'Journée complète' },
          { value: 'À la carte (durée flexible)', label: 'Flexible' },
        ],
      },

      // ✅ FILTRE 4 : Type de clientèle (7+ options)
      {
        id: 'clienteleBienEtre',
        label: 'Type de clientèle',
        type: 'multiselect',
        options: [
          { value: 'Hommes uniquement', label: 'Hommes' },
          { value: 'Femmes uniquement', label: 'Femmes' },
          { value: 'Mixte (hommes et femmes)', label: 'Mixte' },
          { value: 'Couples (massage duo)', label: 'Couples' },
          { value: 'Femmes enceintes', label: 'Femmes enceintes' },
          { value: 'Seniors', label: 'Seniors' },
          { value: 'Sportifs (récupération)', label: 'Sportifs' },
        ],
      },

      // ✅ FILTRE 5 : Tarification (fourchettes réalistes Afrique francophone)
      {
        id: 'tarifsParCategorie',
        label: 'Fourchette tarifaire',
        type: 'select',
        options: [
          { value: 'Moins de 10 000 FCFA', label: '< 10 000 FCFA' },
          { value: '10 000 - 20 000 FCFA', label: '10K - 20K FCFA' },
          { value: '20 000 - 35 000 FCFA', label: '20K - 35K FCFA' },
          { value: '35 000 - 50 000 FCFA', label: '35K - 50K FCFA' },
          { value: '50 000 - 75 000 FCFA', label: '50K - 75K FCFA' },
          { value: '75 000 - 100 000 FCFA', label: '75K - 100K FCFA' },
          { value: 'Plus de 100 000 FCFA (luxe)', label: '> 100K FCFA' },
        ],
      },

      // ✅ FILTRE 6 : Formules & forfaits (10+ options)
      {
        id: 'formulesSpa',
        label: 'Formules & Forfaits',
        type: 'multiselect',
        options: [
          { value: 'Séance unique (à l\'unité)', label: 'Séance unique' },
          { value: 'Forfait 3 séances', label: 'Forfait 3 séances' },
          { value: 'Forfait 5 séances', label: 'Forfait 5 séances' },
          { value: 'Forfait 10 séances', label: 'Forfait 10 séances' },
          { value: 'Abonnement mensuel (illimité)', label: 'Abonnement mensuel' },
          { value: 'Formule Découverte (1er client)', label: 'Formule Découverte' },
          { value: 'Formule Couple (2 personnes)', label: 'Formule Couple' },
          { value: 'Formule Détente (massage + hammam)', label: 'Formule Détente' },
          { value: 'Formule Premium (3 soins)', label: 'Formule Premium' },
          { value: 'Carte cadeau disponible', label: 'Carte Cadeau' },
        ],
      },

      // ✅ FILTRE 7 : Spécialités & besoins (15+ options)
      {
        id: 'specialitesBienEtre',
        label: 'Spécialités & Besoins',
        type: 'multiselect',
        options: [
          { value: 'Relaxation & Anti-stress', label: 'Relaxation' },
          { value: 'Détox & Drainage', label: 'Détox' },
          { value: 'Minceur & Amincissement', label: 'Minceur' },
          { value: 'Cellulite & Raffermissement', label: 'Raffermissement' },
          { value: 'Douleurs musculaires', label: 'Douleurs musculaires' },
          { value: 'Circulation sanguine', label: 'Circulation' },
          { value: 'Insomnie & Troubles du sommeil', label: 'Troubles du sommeil' },
          { value: 'Migraine & Maux de tête', label: 'Migraine' },
          { value: 'Récupération sportive', label: 'Récupération sportive' },
          { value: 'Soins post-partum', label: 'Post-partum' },
          { value: 'Soins anti-âge', label: 'Anti-âge' },
          { value: 'Soins éclaircissants (teint)', label: 'Éclaircissant' },
          { value: 'Soins peaux noires / métissées', label: 'Peaux noires' },
          { value: 'Soins bio / naturels', label: 'Bio/Naturel' },
        ],
      },

      // ✅ FILTRE 8 : Horaires d'ouverture (10+ options)
      {
        id: 'horairesSpa',
        label: 'Horaires d\'ouverture',
        type: 'multiselect',
        options: [
          { value: 'Ouvert le dimanche', label: 'Dimanche' },
          { value: 'Ouvert en soirée (après 18h)', label: 'Soirée' },
          { value: 'Ouvert tôt le matin (avant 8h)', label: 'Tôt le matin' },
          { value: '24h/24 (sur réservation)', label: '24h/24' },
          { value: 'Jours fériés', label: 'Jours fériés' },
          { value: 'Sur rendez-vous uniquement', label: 'Sur RDV' },
          { value: 'Sans rendez-vous (walk-in)', label: 'Sans RDV' },
        ],
      },

      // ✅ FILTRE 9 : Thérapeutes & personnel (8+ options)
      {
        id: 'personnelSpa',
        label: 'Thérapeutes & Personnel',
        type: 'multiselect',
        options: [
          { value: 'Thérapeutes diplômés (certification)', label: 'Diplômés' },
          { value: 'Massage thérapeutique médical', label: 'Médical' },
          { value: 'Kinésithérapeute sur place', label: 'Kinésithérapeute' },
          { value: 'Personnel féminin uniquement', label: 'Personnel féminin' },
          { value: 'Personnel masculin disponible', label: 'Personnel masculin' },
          { value: 'Formation continue', label: 'Formation continue' },
          { value: 'Plusieurs langues (FR, EN, etc.)', label: 'Multilingue' },
        ],
      },

      // ✅ FILTRE 10 : Localisation & accessibilité (10+ options)
      {
        id: 'localisationSpa',
        label: 'Localisation & Accès',
        type: 'multiselect',
        options: [
          { value: 'Centre-ville (facile d\'accès)', label: 'Centre-ville' },
          { value: 'Quartier résidentiel (calme)', label: 'Quartier résidentiel' },
          { value: 'Hôtel 4-5 étoiles', label: 'Hôtel 4-5*' },
          { value: 'Spa indépendant', label: 'Spa indépendant' },
          { value: 'Parking gratuit', label: 'Parking' },
          { value: 'Accès handicapés', label: 'Accès handicapés' },
          { value: 'Arrêt de bus proche', label: 'Arrêt bus' },
          { value: 'Zone sécurisée', label: 'Sécurisé' },
          { value: 'Service navette / transfert', label: 'Navette' },
        ],
      },

      // ✅ FILTRE 11 : Certifications & labels (8+ options)
      {
        id: 'certificationsSpa',
        label: 'Certifications & Labels',
        type: 'multiselect',
        options: [
          { value: 'Certifié spa professionnel', label: 'Certifié Pro' },
          { value: 'Label bio / éco-responsable', label: 'Bio/Éco' },
          { value: 'Produits certifiés (Ecocert, etc.)', label: 'Produits certifiés' },
          { value: 'Hygiène & désinfection stricte', label: 'Hygiène stricte' },
          { value: 'Thérapeutes certifiés', label: 'Thérapeutes certifiés' },
          { value: 'Membre d\'association professionnelle', label: 'Association pro' },
        ],
      },

      // ✅ FILTRE 12 : Options de paiement (8+ options)
      {
        id: 'paiementSpa',
        label: 'Modes de paiement',
        type: 'multiselect',
        options: [
          { value: 'Espèces (Cash)', label: 'Espèces' },
          { value: 'Mobile Money (MTN, Orange)', label: 'Mobile Money' },
          { value: 'Carte bancaire', label: 'Carte bancaire' },
          { value: 'Virement bancaire', label: 'Virement' },
          { value: 'Chèques acceptés', label: 'Chèques' },
          { value: 'Paiement en plusieurs fois', label: 'Paiement fractionné' },
          { value: 'Réduction 1ère visite', label: 'Réduction 1ère visite' },
          { value: 'Fidélité (points, réductions)', label: 'Programme fidélité' },
        ],
      },

      // ✅ FILTRE 13 : Ambiance & style (8+ options)
      {
        id: 'ambianceSpa',
        label: 'Ambiance & Style',
        type: 'multiselect',
        options: [
          { value: 'Zen & Minimaliste', label: 'Zen' },
          { value: 'Luxe & Raffiné', label: 'Luxe' },
          { value: 'Traditionnel africain', label: 'Africain' },
          { value: 'Moderne & Design', label: 'Moderne' },
          { value: 'Naturel & Éco', label: 'Naturel' },
          { value: 'Oriental (style asiatique)', label: 'Oriental' },
          { value: 'Intime & Discret', label: 'Intime' },
        ],
      },

      // ✅ FILTRE 14 : Prestations complémentaires (10+ options)
      {
        id: 'prestationsComplementaires',
        label: 'Prestations Complémentaires',
        type: 'multiselect',
        options: [
          { value: 'Manucure / Pédicure', label: 'Manucure/Pédicure' },
          { value: 'Coiffure sur place', label: 'Coiffure' },
          { value: 'Esthétique (épilation, maquillage)', label: 'Esthétique' },
          { value: 'Coach nutritionnel', label: 'Coach nutrition' },
          { value: 'Coach sportif', label: 'Coach sportif' },
          { value: 'Consultation bien-être', label: 'Consultation' },
          { value: 'Boutique produits (huiles, crèmes)', label: 'Boutique' },
          { value: 'Espace restauration / bar à jus', label: 'Restauration' },
        ],
      },

      // ✅ FILTRE 15 : Centres & spas renommés (20+ options Afrique francophone)
      {
        id: 'centresSpaRenommes',
        label: 'Centres & Spas Renommés',
        type: 'select',
        options: [
          // Cameroun
          { value: '🇨🇲 La Source du Nil (Yaoundé)', label: '🇨🇲 La Source du Nil' },
          { value: '🇨🇲 Hilton Spa Yaoundé', label: '🇨🇲 Hilton Spa Yaoundé' },
          { value: '🇨🇲 Merina Hotel Spa (Yaoundé)', label: '🇨🇲 Merina Hotel Spa' },
          { value: '🇨🇲 Pullman Douala Spa', label: '🇨🇲 Pullman Douala Spa' },
          { value: '🇨🇲 Sawa Hotel Spa (Douala)', label: '🇨🇲 Sawa Hotel Spa' },
          { value: '🇨🇲 Azur Bien-Être (Douala)', label: '🇨🇲 Azur Bien-Être' },
          { value: '🇨🇲 Zen Attitude Spa (Yaoundé)', label: '🇨🇲 Zen Attitude' },

          // Côte d\'Ivoire
          { value: '🇨🇮 Sofitel Abidjan Spa', label: '🇨🇮 Sofitel Abidjan' },
          { value: '🇨🇮 Ivoire Hotel Spa', label: '🇨🇮 Ivoire Hotel Spa' },
          { value: '🇨🇮 Azalaï Spa (Abidjan)', label: '🇨🇮 Azalaï Spa' },
          { value: '🇨🇮 Wellness Center Abidjan', label: '🇨🇮 Wellness Center' },

          // Sénégal
          { value: '🇸🇳 Terrou-Bi Spa (Dakar)', label: '🇸🇳 Terrou-Bi Spa' },
          { value: '🇸🇳 Radisson Blu Spa Dakar', label: '🇸🇳 Radisson Blu Spa' },
          { value: '🇸🇳 King Fahd Palace Spa', label: '🇸🇳 King Fahd Palace' },
          { value: '🇸🇳 Spa Djoloff (Dakar)', label: '🇸🇳 Spa Djoloff' },

          // Gabon
          { value: '🇬🇦 Radisson Blu Spa Libreville', label: '🇬🇦 Radisson Blu Libreville' },
          { value: '🇬🇦 Hibiscus Spa (Libreville)', label: '🇬🇦 Hibiscus Spa' },

          // Congo
          { value: '🇨🇬 Pefaco Spa (Brazzaville)', label: '🇨🇬 Pefaco Spa' },

          // Autres
          { value: '🆕 Autre spa (ajouter)', label: '🆕 Autre (ajouter)' },
        ],
      },

      // ✅ FILTRE 16 : Promotions & offres spéciales (8+ options)
      {
        id: 'promotionsSpa',
        label: 'Promotions & Offres',
        type: 'multiselect',
        options: [
          { value: 'Promotion en cours (-10% à -50%)', label: 'Promotion active' },
          { value: 'Offre découverte 1ère visite', label: 'Offre découverte' },
          { value: 'Tarif réduit groupe (3+ personnes)', label: 'Tarif groupe' },
          { value: 'Happy hour (tarif réduit certaines heures)', label: 'Happy hour' },
          { value: 'Forfait anniversaire', label: 'Forfait anniversaire' },
          { value: 'Forfait couple (Saint-Valentin)', label: 'Forfait couple' },
          { value: 'Offre parrainage', label: 'Parrainage' },
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
    displayPriority: ['typeBienEtre', 'dureeBienEtre', 'tarifsParCategorie', 'servicesBienEtre', 'specialitesBienEtre'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    supportsVariants: false, // ❌ PAS de variantes pour services
    searchKeywords: ['spa', 'massage', 'bien-être', 'détente', 'relaxation', 'hammam', 'sauna', 'jacuzzi', 'balnéo', 'thalasso', 'soin', 'visage', 'corporel', 'gommage', 'réflexologie', 'aromathérapie', 'reiki', 'yoga', 'méditation', 'sophrologie', 'anti-stress', 'détox', 'minceur', 'drainage', 'thérapeute', 'masseur', 'esthétique', 'karité', 'argan', 'huile', 'pierre chaude', 'thai', 'suédois', 'californien', 'ayurvédique', 'shiatsu', 'balinais', 'sportif', 'prénatal'],
  },

  // 🌱 PRODUCTEURS LOCAUX (Agriculture & Élevage)
  // ✅ RENOMMÉ de "agriculture" → "producteurs_locaux" pour mieux refléter le contenu
  producteurs_locaux: {
    terminology: {
      productLabel: 'Produit local',
      productsLabel: 'Producteurs Locaux',
      priceLabel: 'Prix',
      locationLabel: 'Exploitation/Ferme',
      providerLabel: 'Producteur',
      searchPlaceholder: 'Rechercher produits de producteurs locaux...',
      emptyMessage: 'Aucun produit de producteur disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité de la ferme',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Catégorie principale (Agriculture/Élevage/Pêche/Miel)
      {
        id: 'categoriePrincipale',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: '🌾 Agriculture (Plantes, Fruits, Légumes)', label: '🌾 Agriculture' },
          { value: '🐄 Élevage (Animaux, Viande, Lait)', label: '🐄 Élevage' },
          { value: '🐟 Pêche & Aquaculture', label: '🐟 Pêche/Aquaculture' },
          { value: '🐝 Apiculture (Miel, Cire, Gelée royale)', label: '🐝 Apiculture' },
          { value: '🌿 Cultures de rente (Cacao, Café, Thé)', label: '🌿 Cultures de rente' },
          { value: '⚒️ Matériel agricole (Outil, Intrants)', label: '⚒️ Matériel agricole' },
        ],
      },
      // ✅ FILTRE 2 : Type de produit agricole
      {
        id: 'typeProduitAgricole',
        label: 'Type de produit',
        type: 'select',
        options: [
          // Céréales
          { value: '🌾 Maïs (grain, épi, blanc, jaune)', label: '🌾 Maïs' },
          { value: '🌾 Riz (paddy, cargo, blanc, parfumé)', label: '🌾 Riz' },
          { value: '🌾 Mil (petit mil, sorgho)', label: '🌾 Mil/Sorgho' },
          // Tubercules
          { value: '🥔 Manioc (frais, amer, doux)', label: '🥔 Manioc' },
          { value: '🍠 Igname (blanche, jaune, locale)', label: '🍠 Igname' },
          { value: '🍠 Patate douce (orange, blanche, violette)', label: '🍠 Patate douce' },
          // Légumes
          { value: '🥬 Légumes feuilles (Sauce, Mbongo, Ndolé)', label: '🥬 Légumes feuilles' },
          { value: '🍅 Tomate locale', label: '🍅 Tomate' },
          { value: '🥒 Courgette/Aubergine', label: '🥒 Courgette' },
          // Fruits
          { value: '🍌 Banane plantain', label: '🍌 Banane plantain' },
          { value: '🍌 Banane douce', label: '🍌 Banane douce' },
          { value: '🥭 Mange', label: '🥭 Mange' },
          { value: '🥑 Avocat', label: '🥑 Avocat' },
          { value: '🍍 Ananas', label: '🍍 Ananas' },
          // Légumineuses
          { value: '🫘 Niébé (haricot blanc local)', label: '🫘 Niébé' },
          { value: '🫘 Arachide (coque, décortiquée)', label: '🫘 Arachide' },
          // Épices
          { value: '🌶️ Piment (rouge, vert, séché)', label: '🌶️ Piment' },
          { value: '🌶️ Poivre de Penja (Cameroun)', label: '🌶️ Poivre Penja' },
          // Cultures de rente
          { value: '☕ Café (arabica, robusta)', label: '☕ Café' },
          { value: '🍫 Cacao (fève, marchand, fin)', label: '🍫 Cacao' },
          { value: '🍵 Thé (vert, noir)', label: '🍵 Thé' },
        ],
      },
      // ✅ FILTRE 3 : Animaux d'élevage
      {
        id: 'typeAnimalElevage',
        label: 'Type d\'animal',
        type: 'select',
        options: [
          // Bovins
          { value: '🐄 Bœuf (adulte, race locale)', label: '🐄 Bœuf' },
          { value: '🐄 Vache (laitière, allaitante)', label: '🐄 Vache' },
          { value: '🐂 Zébu (Foulbé, Bororo)', label: '🐂 Zébu' },
          { value: '🐂 Goudali (race camerounaise)', label: '🐂 Goudali' },
          { value: '🐮 Veau de lait', label: '🐮 Veau' },
          // Ovins
          { value: '🐏 Mouton Djallonké (race locale)', label: '🐏 Mouton Djallonké' },
          { value: '🐑 Agneau (de lait, sevré)', label: '🐑 Agneau' },
          // Caprins
          { value: '🐐 Chèvre (naine, sahélienne)', label: '🐐 Chèvre' },
          { value: '🐐 Cabri (chevreau)', label: '🐐 Cabri' },
          // Porcins
          { value: '🐖 Porc (local, amélioré, d\'embouche)', label: '🐖 Porc' },
          { value: '🐷 Porcelet (sevré, de lait)', label: '🐷 Porcelet' },
          // Volailles
          { value: '🐔 Poulet (de chair, fermier, local)', label: '🐔 Poulet' },
          { value: '🐔 Poule pondeuse', label: '🐔 Poule pondeuse' },
          { value: '🐥 Poussin (1 jour, démarré, 21 jours)', label: '🐥 Poussin' },
          { value: '🦆 Canard (de Barbarie, mulard)', label: '🦆 Canard' },
          { value: '🦃 Dinde (locale, dindonneau)', label: '🦃 Dinde' },
          { value: '🐦 Pintade (locale, pintadeaux)', label: '🐦 Pintade' },
          // Autres
          { value: '🐰 Lapin (fermier, géant)', label: '🐰 Lapin' },
          { value: '🐟 Tilapia (alevins, poisson table)', label: '🐟 Tilapia' },
          { value: '🐟 Poisson-chat (Clarias)', label: '🐟 Poisson-chat' },
        ],
      },
      // ✅ FILTRE 4 : Unité de mesure africaine
      {
        id: 'uniteMesureAgricole',
        label: 'Unité de mesure',
        type: 'select',
        options: [
          // Poids
          { value: '⚖️ Kilogramme (kg)', label: '⚖️ Kilogramme' },
          { value: '⚖️ Quintal (100 kg)', label: '⚖️ Quintal' },
          { value: '⚖️ Tonne (1000 kg)', label: '⚖️ Tonne' },
          // Seaux (très utilisé en Afrique!)
          { value: '🪣 Seau 5L', label: '🪣 Seau 5L' },
          { value: '🪣 Seau 10L', label: '🪣 Seau 10L' },
          { value: '🪣 Seau 15L (standard)', label: '🪣 Seau 15L' },
          { value: '🪣 Seau 20L', label: '🪣 Seau 20L' },
          // Sacs
          { value: '💼 Sac 25 kg (standard)', label: '💼 Sac 25kg' },
          { value: '💼 Sac 50 kg', label: '💼 Sac 50kg' },
          { value: '💼 Sac 100 kg', label: '💼 Sac 100kg' },
          // Cagio/Cageot
          { value: '🧺 Cagio (petit, moyen, grand)', label: '🧺 Cagio/Cageot' },
          // Tas (pour ignames, manioc)
          { value: '🥔 Tas (10-20 tubercules)', label: '🥔 Tas (tubercules)' },
          // Liasse/Botte (légumes feuilles)
          { value: '🥬 Liasse (petite, moyenne, grande)', label: '🥬 Liasse/Botte' },
          // Alvéole (œufs)
          { value: '🥚 Alvéole 12 œufs (1 douzaine)', label: '🥚 Douzaine d\'œufs' },
          // Régime (bananes, plantains)
          { value: '🍌 Régime complet (bananes)', label: '🍌 Régime (bananes)' },
          // Unité/Pièce
          { value: '1️⃣ Tête (animal sur pied)', label: '1️⃣ Tête (animal)' },
          { value: '1️⃣ Unité/Pièce', label: '1️⃣ Unité' },
        ],
      },
      // ✅ FILTRE 5 : Type de vente/Commercialisation
      {
        id: 'typeVenteCommercial',
        label: 'Type de vente',
        type: 'multiselect',
        options: [
          { value: '🛒 Vente directe producteur', label: '🛒 Direct producteur' },
          { value: '🛒 Circuit court', label: '🛒 Circuit court' },
          { value: '🏪 Vente au détail', label: '🏪 Détail' },
          { value: '🏪 Vente en gros', label: '🏪 Gros' },
          { value: '🏪 Vente au marché', label: '🏪 Au marché' },
          { value: '🏪 Vente à domicile', label: '🏪 À domicile' },
          { value: '🚚 Livraison possible', label: '🚚 Livraison' },
          { value: '💰 Prix négociable', label: '💰 Prix négociable' },
          { value: '📞 Sur commande', label: '📞 Sur commande' },
          { value: '📞 Stock disponible', label: '📞 En stock' },
          // ✅ TERMES LOCAUX
          { value: '🏪 Bayam-Selam (Cameroun)', label: '🏪 Bayam-Selam (CM)' },
          { value: '🏪 Boulot (révendeur)', label: '🏪 Boulot (révendeur)' },
        ],
      },
      // ✅ FILTRE 6 : Origine/Géographique
      {
        id: 'origineGeo',
        label: 'Origine',
        type: 'select',
        options: [
          // Cameroun (Focus)
          { value: '🇨🇲 Cameroun - Littoral (Douala, Édéa)', label: '🇨🇲 Littoral' },
          { value: '🇨🇲 Cameroun - Centre (Yaoundé, Mbalmayo)', label: '🇨🇲 Centre' },
          { value: '🇨🇲 Cameroun - Ouest (Bafoussam, Dschang)', label: '🇨🇲 Ouest' },
          { value: '🇨🇲 Cameroun - Nord (Garoua)', label: '🇨🇲 Nord' },
          // Autres pays
          { value: '🇨🇮 Côte d\'Ivoire', label: '🇨🇮 Côte d\'Ivoire' },
          { value: '🇸🇳 Sénégal', label: '🇸🇳 Sénégal' },
          { value: '🇲🇱 Mali', label: '🇲🇱 Mali' },
          // Production locale
          { value: '🏡 Production locale (village)', label: '🏡 Production locale' },
          { value: '🏡 Exploitation familiale', label: '🏡 Exploitation familiale' },
          // Importation
          { value: '🌍 Importé Europe', label: '🌍 Importé Europe' },
        ],
      },
      // ✅ FILTRE 7 : Méthode de production
      {
        id: 'methodeProduction',
        label: 'Méthode de production',
        type: 'multiselect',
        options: [
          { value: '🌱 Agriculture biologique', label: '🌱 Bio' },
          { value: '🌱 Agriculture raisonnée', label: '🌱 Raisonné' },
          { value: '🌱 Permaculture', label: '🌱 Permaculture' },
          { value: '🌱 Culture traditionnelle', label: '🌱 Traditionnel' },
          { value: '🌱 Culture en serre', label: '🌱 Serre' },
          { value: '🌱 Plein champ', label: '🌱 Plein champ' },
          { value: '🐄 Élevage extensif (pâturage)', label: '🐄 Extensif' },
          { value: '🐄 Élevage fermier', label: '🐄 Fermier' },
          { value: '🐄 Embouche (engraissement)', label: '🐄 Embouche' },
        ],
      },
      // ✅ FILTRE 8 : Qualité & Labels
      {
        id: 'qualiteLabels',
        label: 'Qualité & Labels',
        type: 'multiselect',
        options: [
          { value: '✅ Bio certifié', label: '✅ Bio' },
          { value: '✅ Commerce équitable', label: '✅ Commerce équitable' },
          { value: '✅ Sans pesticides', label: '✅ Sans pesticides' },
          { value: '✅ Sans OGM', label: '✅ Sans OGM' },
          { value: '✅ Halal', label: '✅ Halal' },
          { value: '🌟 Qualité premium', label: '🌟 Premium' },
          { value: '🌟 Produit frais du jour', label: '🌟 Frais du jour' },
          { value: '🌟 Production locale', label: '🌟 Local' },
        ],
      },
      // ✅ FILTRE 9 : Saison & Disponibilité
      {
        id: 'saisonDisponibilite',
        label: 'Saison',
        type: 'select',
        options: [
          { value: '🌞 Toute l\'année', label: '🌞 Toute l\'année' },
          { value: '☔ Saison des pluies (Mars-Octobre)', label: '☔ Saison pluies' },
          { value: '☀️ Saison sèche (Novembre-Février)', label: '☀️ Saison sèche' },
          { value: '🌾 Période de récolte', label: '🌾 Récolte' },
          { value: '⏰ Sur commande uniquement', label: '⏰ Sur commande' },
        ],
      },
      // ✅ FILTRE 10 : État & Fraîcheur
      {
        id: 'etatFraicheur',
        label: 'État & Fraîcheur',
        type: 'multiselect',
        options: [
          { value: '✨ Ultra-frais (récolte jour même)', label: '✨ Ultra-frais' },
          { value: '✨ Très frais (récolte veille)', label: '✨ Très frais' },
          { value: '🐄 Animal vivant sur pied', label: '🐄 Vivant' },
          { value: '🐄 Bonne santé, vacciné', label: '🐄 Bonne santé' },
          { value: '📦 Produit brut', label: '📦 Brut' },
          { value: '📦 Nettoyé, lavé', label: '📦 Nettoyé' },
        ],
      },
    ],
    style: {
      primaryColor: '#10B981',
      gradientColors: ['#10B981', '#059669'],
      icon: '🌱',
      badgeColor: '#D1FAE5',
      accentColor: '#059669',
    },
    displayPriority: ['categoriePrincipale', 'typeProduitAgricole', 'typeAnimalElevage', 'uniteMesureAgricole', 'qualiteLabels', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
    supportsVariants: false, // Pas de variantes pour produits agricoles
    searchKeywords: [
      // Français standard
      'agriculture', 'élevage', 'producteur', 'fermier', 'exploitation', 'récolte', 'culture',
      'maïs', 'riz', 'manioc', 'igname', 'banane', 'plantain', 'tomate', 'oignon',
      'bœuf', 'mouton', 'chèvre', 'porc', 'poulet', 'canard', 'dinde', 'pintade',
      'cacao', 'café', 'thé', 'arachide', 'haricot', 'niébé',
      // 🇨🇲 Termes Camerounais
      'bayam-selam', 'bayamselam', 'boulot', 'bicycle', 'poulet bicycle', 'poulet local',
      'goudali', 'zébu', 'djallonké', 'mbongo', 'ndolé', 'poulet bicyclette',
      'fournisseur', 'ferme', 'marché', 'cout circuit', 'agroforestier',
      // 🇨🇮 Termes Ivoiriens
      'pla pla', 'agouti', 'nga kabobé',
      // 🇸🇳 Termes Sénégalais
      'thiouray', 'women food', 'alimentation locale',
      // Unités locales
      'seau', 'cagio', 'cageot', 'tas', 'liasse', 'botte', 'alvéole', 'douzaine',
      'sac 25kg', 'sac 50kg', 'quintal', 'tonne', 'tête', 'vivant', 'sur pied',
      'frais', 'bio', 'local', 'traditionnel', 'fermier', 'circuit court'
    ],
  },

  // 🧸 JOUETS & ENFANTS (✅ FILTRES ENRICHIS V2)
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
        id: 'ageRecommande',
        label: 'Âge recommandé',
        type: 'select',
        options: [
          { value: '0-6 mois (Nouveau-né)', label: '0-6 mois' },
          { value: '6-12 mois (Bébé)', label: '6-12 mois' },
          { value: '1-2 ans (Tout-petit)', label: '1-2 ans' },
          { value: '2-3 ans (Petite enfance)', label: '2-3 ans' },
          { value: '3-5 ans (Préscolaire)', label: '3-5 ans' },
          { value: '5-7 ans (Maternelle/CP)', label: '5-7 ans' },
          { value: '7-9 ans (Primaire)', label: '7-9 ans' },
          { value: '9-12 ans (Préadolescent)', label: '9-12 ans' },
          { value: '12-15 ans (Adolescent)', label: '12-15 ans' },
          { value: 'Tous âges', label: 'Tous âges' },
        ],
      },
      {
        id: 'typeJouet',
        label: 'Type de jouet',
        type: 'select',
        options: [
          // Bébé & Éveil
          { value: 'Tapis d\'éveil', label: 'Tapis d\'éveil' },
          { value: 'Hochet', label: 'Hochet' },
          { value: 'Mobile musical', label: 'Mobile musical' },
          { value: 'Doudou', label: 'Doudou' },
          // Peluches
          { value: 'Peluche', label: 'Peluche' },
          { value: 'Peluche interactive', label: 'Peluche interactive' },
          // Éducatif
          { value: 'Jouet éducatif', label: 'Jouet éducatif' },
          { value: 'Tablette éducative', label: 'Tablette éducative' },
          { value: 'Livre interactif', label: 'Livre interactif' },
          // Construction
          { value: 'LEGO', label: 'LEGO' },
          { value: 'Briques de construction', label: 'Briques construction' },
          { value: 'Blocs en bois', label: 'Blocs en bois' },
          // Jeux
          { value: 'Jeu de société', label: 'Jeu de société' },
          { value: 'Puzzle', label: 'Puzzle' },
          { value: 'Jeu de cartes', label: 'Jeu de cartes' },
          // Figurines
          { value: 'Poupée', label: 'Poupée' },
          { value: 'Figurine', label: 'Figurine' },
          // Véhicules
          { value: 'Voiture miniature', label: 'Voiture miniature' },
          { value: 'Véhicule télécommandé', label: 'Télécommandé' },
          // Sport
          { value: 'Ballon', label: 'Ballon' },
          { value: 'Vélo enfant', label: 'Vélo' },
          { value: 'Trottinette', label: 'Trottinette' },
          // Gaming
          { value: 'Console de jeu', label: 'Console de jeu' },
          { value: 'Jeu vidéo', label: 'Jeu vidéo' },
          // Africain
          { value: 'Djembé enfant', label: 'Djembé enfant' },
          { value: 'Jeu traditionnel (Awalé, etc.)', label: 'Jeu traditionnel' },
        ],
      },
      {
        id: 'marqueJouet',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'LEGO', label: 'LEGO' },
          { value: 'Fisher-Price', label: 'Fisher-Price' },
          { value: 'Mattel', label: 'Mattel' },
          { value: 'Hasbro', label: 'Hasbro' },
          { value: 'VTech', label: 'VTech' },
          { value: 'Playmobil', label: 'Playmobil' },
          { value: 'Barbie', label: 'Barbie' },
          { value: 'Hot Wheels', label: 'Hot Wheels' },
          { value: 'Nintendo', label: 'Nintendo' },
          { value: 'PlayStation', label: 'PlayStation' },
          { value: 'Artisanat local', label: 'Artisanat local' },
          { value: 'Made in Africa', label: 'Made in Africa' },
        ],
      },
      {
        id: 'etatJouet',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf (emballé)', label: 'Neuf emballé' },
          { value: 'Neuf (déballé)', label: 'Neuf déballé' },
          { value: 'Comme neuf', label: 'Comme neuf' },
          { value: 'Très bon état', label: 'Très bon état' },
          { value: 'Bon état', label: 'Bon état' },
          { value: 'Occasion (à vérifier)', label: 'Occasion' },
        ],
      },
      {
        id: 'genreJouet',
        label: 'Genre',
        type: 'select',
        options: [
          { value: 'Mixte/Unisexe', label: 'Mixte/Unisexe' },
          { value: 'Plutôt fille', label: 'Plutôt fille' },
          { value: 'Plutôt garçon', label: 'Plutôt garçon' },
        ],
      },
      {
        id: 'categoriesEducatives',
        label: 'Catégories éducatives',
        type: 'multiselect',
        options: [
          { value: 'Motricité fine', label: 'Motricité fine' },
          { value: 'Motricité globale', label: 'Motricité globale' },
          { value: 'Éveil sensoriel', label: 'Éveil sensoriel' },
          { value: 'Éveil musical', label: 'Éveil musical' },
          { value: 'Logique & Réflexion', label: 'Logique' },
          { value: 'Mémoire & Concentration', label: 'Mémoire' },
          { value: 'Mathématiques & Calcul', label: 'Mathématiques' },
          { value: 'Lecture & Écriture', label: 'Lecture' },
          { value: 'Créativité & Imagination', label: 'Créativité' },
          { value: 'Sociabilité & Partage', label: 'Sociabilité' },
        ],
      },
      {
        id: 'normesSecurite',
        label: 'Normes de sécurité',
        type: 'multiselect',
        options: [
          { value: 'CE (Conformité Européenne)', label: 'CE' },
          { value: 'EN71 (Norme jouets EU)', label: 'EN71' },
          { value: 'Sans phtalates', label: 'Sans phtalates' },
          { value: 'Sans BPA', label: 'Sans BPA' },
          { value: 'Non toxique certifié', label: 'Non toxique' },
        ],
      },
      {
        id: 'materiauJouet',
        label: 'Matériau',
        type: 'select',
        options: [
          { value: 'Plastique ABS (sans BPA)', label: 'Plastique sans BPA' },
          { value: 'Bois massif', label: 'Bois massif' },
          { value: 'Bois certifié FSC', label: 'Bois certifié FSC' },
          { value: 'Tissu coton bio', label: 'Coton bio' },
          { value: 'Peluche hypoallergénique', label: 'Hypoallergénique' },
        ],
      },
      {
        id: 'lieuUtilisation',
        label: 'Lieu d\'utilisation',
        type: 'select',
        options: [
          { value: 'Intérieur', label: 'Intérieur' },
          { value: 'Extérieur', label: 'Extérieur' },
          { value: 'Intérieur & Extérieur', label: 'Intérieur & Extérieur' },
          { value: 'Piscine/Plage', label: 'Piscine/Plage' },
        ],
      },
      {
        id: 'alimentationJouet',
        label: 'Alimentation',
        type: 'select',
        options: [
          { value: 'Manuel (sans pile)', label: 'Manuel' },
          { value: 'Piles AA incluses', label: 'Piles AA incluses' },
          { value: 'Piles AAA incluses', label: 'Piles AAA incluses' },
          { value: 'Batterie rechargeable (USB)', label: 'Rechargeable USB' },
          { value: 'Secteur 220V', label: 'Secteur 220V' },
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
    displayPriority: ['typeJouet', 'ageRecommande', 'marqueJouet', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🔧 PIÈCES AUTO - REFONTE COMPLÈTE
  pieces_auto: {
    terminology: {
      productLabel: 'Pièce auto',
      productsLabel: 'Pièces Auto',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher pièces auto (filtre, freins, amortisseurs...)...',
      emptyMessage: 'Aucune pièce auto disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Catégorie principale
      {
        id: 'categoriePieceAuto',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'Moteur & Mécanique', label: 'Moteur & Mécanique' },
          { value: 'Freinage', label: 'Freinage' },
          { value: 'Suspension & Direction', label: 'Suspension & Direction' },
          { value: 'Transmission & Embrayage', label: 'Transmission & Embrayage' },
          { value: 'Échappement', label: 'Échappement' },
          { value: 'Éclairage & Signalisation', label: 'Éclairage & Signalisation' },
          { value: 'Carrosserie', label: 'Carrosserie' },
          { value: 'Intérieur & Habitacle', label: 'Intérieur & Habitacle' },
          { value: 'Électrique & Électronique', label: 'Électrique & Électronique' },
          { value: 'Accessoires & Consommables', label: 'Accessoires & Consommables' },
        ],
      },
      // ✅ FILTRE 2 : Type de pièce
      {
        id: 'typePieceAuto',
        label: 'Type de pièce',
        type: 'select',
        options: [
          { value: 'Filtre (huile, air, carburant)', label: 'Filtres' },
          { value: 'Distribution (courroie, kit)', label: 'Distribution' },
          { value: 'Plaquettes de frein', label: 'Plaquettes de frein' },
          { value: 'Disques de frein', label: 'Disques de frein' },
          { value: 'Amortisseurs', label: 'Amortisseurs' },
          { value: 'Embrayage (kit, disque)', label: 'Embrayage' },
          { value: 'Pare-chocs', label: 'Pare-chocs' },
          { value: 'Optiques (phares, feux)', label: 'Optiques' },
        ],
      },
      // ✅ FILTRE 3 : Marque de la pièce
      {
        id: 'marquePieceAuto',
        label: 'Marque pièce',
        type: 'select',
        options: [
          { value: 'Bosch', label: 'Bosch' },
          { value: 'Valeo', label: 'Valeo' },
          { value: 'Continental', label: 'Continental' },
          { value: 'Brembo', label: 'Brembo' },
          { value: 'Mann-Filter', label: 'Mann-Filter' },
          { value: 'Mahle', label: 'Mahle' },
          { value: 'TRW', label: 'TRW' },
          { value: 'Origine constructeur (OEM)', label: 'Origine constructeur (OEM)' },
        ],
      },
      // ✅ FILTRE 4 : Marque véhicule compatible
      {
        id: 'marqueVehiculeCompatible',
        label: 'Marque véhicule',
        type: 'select',
        options: [
          { value: 'Toyota', label: 'Toyota' },
          { value: 'Nissan', label: 'Nissan' },
          { value: 'Mercedes-Benz', label: 'Mercedes-Benz' },
          { value: 'Honda', label: 'Honda' },
          { value: 'BMW', label: 'BMW' },
          { value: 'Peugeot', label: 'Peugeot' },
          { value: 'Renault', label: 'Renault' },
          { value: 'Hyundai', label: 'Hyundai' },
          { value: 'Universel (toutes marques)', label: 'Universel' },
        ],
      },
      // ✅ FILTRE 5 : Modèle véhicule (populaires Cameroun)
      {
        id: 'modeleVehicule',
        label: 'Modèle véhicule',
        type: 'select',
        options: [
          { value: 'Toyota Corolla', label: 'Toyota Corolla' },
          { value: 'Toyota Camry', label: 'Toyota Camry' },
          { value: 'Toyota RAV4', label: 'Toyota RAV4' },
          { value: 'Toyota Land Cruiser', label: 'Toyota Land Cruiser' },
          { value: 'Toyota Hilux', label: 'Toyota Hilux' },
          { value: 'Nissan Patrol', label: 'Nissan Patrol' },
          { value: 'Mercedes Classe C', label: 'Mercedes Classe C' },
          { value: 'Mercedes Classe E', label: 'Mercedes Classe E' },
        ],
      },
      // ✅ FILTRE 6 : État
      {
        id: 'etatPieceAuto',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf scellé (emballage d\'origine)', label: 'Neuf scellé' },
          { value: 'Neuf déballé', label: 'Neuf déballé' },
          { value: 'Occasion - Excellent état (< 20% usure)', label: 'Occasion - Excellent' },
          { value: 'Occasion - Bon état (20-50% usure)', label: 'Occasion - Bon' },
          { value: 'Reconditionné (remis à neuf)', label: 'Reconditionné' },
        ],
      },
      // ✅ FILTRE 7 : Origine fabrication
      {
        id: 'originePiece',
        label: 'Origine',
        type: 'select',
        options: [
          { value: 'Origine Europe (UE)', label: 'Europe (UE)' },
          { value: 'Origine Allemagne', label: 'Allemagne' },
          { value: 'Origine France', label: 'France' },
          { value: 'Origine Italie', label: 'Italie' },
          { value: 'Origine Asie (Japon, Corée)', label: 'Asie (Japon, Corée)' },
          { value: 'Origine Chine', label: 'Chine' },
          { value: 'Origine Taïwan', label: 'Taïwan' },
          { value: 'Origine Nigeria', label: 'Nigeria' },
          { value: 'Fabriqué localement (Cameroun)', label: 'Cameroun (local)' },
        ],
      },
      // ✅ FILTRE 8 : Garantie
      {
        id: 'garantiePiece',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'Garantie constructeur 2 ans', label: 'Garantie 2 ans' },
          { value: 'Garantie constructeur 1 an', label: 'Garantie 1 an' },
          { value: 'Garantie fournisseur 6 mois', label: 'Garantie 6 mois' },
          { value: 'Garantie fournisseur 3 mois', label: 'Garantie 3 mois' },
          { value: 'Sans garantie (pièce d\'occasion)', label: 'Sans garantie' },
        ],
      },
      // ✅ FILTRE 9 : Niveau de compatibilité
      {
        id: 'niveauCompatibilite',
        label: 'Compatibilité',
        type: 'select',
        options: [
          { value: 'Universel (toutes marques)', label: 'Universel' },
          { value: 'Compatible marque spécifique uniquement', label: 'Marque spécifique' },
          { value: 'Compatible plusieurs marques', label: 'Plusieurs marques' },
        ],
      },
      // ✅ FILTRE 10 : Matériau
      {
        id: 'materiauPiece',
        label: 'Matériau',
        type: 'select',
        options: [
          { value: 'Acier', label: 'Acier' },
          { value: 'Acier inoxydable', label: 'Acier inoxydable' },
          { value: 'Aluminium', label: 'Aluminium' },
          { value: 'Fonte', label: 'Fonte' },
          { value: 'Céramique (plaquettes)', label: 'Céramique' },
        ],
      },
      // ✅ FILTRE 11 : Type de fournisseur
      {
        id: 'typeFournisseur',
        label: 'Type vendeur',
        type: 'select',
        options: [
          { value: 'Magasin pièces détachées auto', label: 'Magasin pièces auto' },
          { value: 'Garage professionnel', label: 'Garage professionnel' },
          { value: 'Casse automobile', label: 'Casse automobile' },
          { value: 'Importateur direct', label: 'Importateur direct' },
          { value: 'Particulier (vente pièce)', label: 'Particulier' },
        ],
      },
      // ✅ FILTRE 12 : Avec référence constructeur (toggle)
      {
        id: 'avecReference',
        label: 'Avec référence constructeur',
        type: 'toggle',
      },
      // ✅ FILTRE 13 : Compatible modèle exact (toggle)
      {
        id: 'compatibiliteExacte',
        label: 'Compatible mon modèle exact',
        type: 'toggle',
      },
      // ✅ FILTRE 14 : Livraison disponible (toggle)
      {
        id: 'livraisonDisponible',
        label: 'Livraison disponible',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#607D8B',
      gradientColors: ['#607D8B', '#455A64'],
      icon: '🔧',
      badgeColor: '#CFD8DC',
      accentColor: '#455A64',
    },
    displayPriority: ['nomProduitPieceAuto', 'categoriePieceAuto', 'marqueVehiculeCompatible', 'modeleVehicule', 'marquePieceAuto', 'etatPieceAuto', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 📱 TÉLÉPHONES & ACCESSOIRES - ✅ ENRICHI AFRIQUE FRANCOPHONE
  telephone: {
    terminology: {
      productLabel: 'Smartphone',
      productsLabel: 'Téléphones & Accessoires',
      priceLabel: 'Prix',
      locationLabel: 'Vendeur',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher téléphones (iPhone, Samsung, Tecno, Infinix...)...',
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
          // TOP 5 AFRIQUE
          { value: 'Tecno', label: 'Tecno' },
          { value: 'Infinix', label: 'Infinix' },
          { value: 'Samsung', label: 'Samsung' },
          { value: 'Xiaomi', label: 'Xiaomi' },
          { value: 'Itel', label: 'Itel' },

          // TRÈS POPULAIRES
          { value: 'Realme', label: 'Realme' },
          { value: 'Oppo', label: 'Oppo' },
          { value: 'Vivo', label: 'Vivo' },
          { value: 'Redmi', label: 'Redmi' },
          { value: 'Poco', label: 'Poco' },

          // PREMIUM
          { value: 'Apple', label: 'Apple (iPhone)' },
          { value: 'Huawei', label: 'Huawei' },
          { value: 'Honor', label: 'Honor' },
          { value: 'OnePlus', label: 'OnePlus' },
          { value: 'Google', label: 'Google (Pixel)' },

          // AUTRES
          { value: 'Nokia', label: 'Nokia' },
          { value: 'Motorola', label: 'Motorola' },
          { value: 'Nothing', label: 'Nothing' },
          { value: 'Blackview', label: 'Blackview' },
        ],
      },
      {
        id: 'stockage',
        label: 'Stockage',
        type: 'select',
        options: [
          { value: '128GB', label: '128GB' },
          { value: '64GB', label: '64GB' },
          { value: '256GB', label: '256GB' },
          { value: '512GB', label: '512GB' },
          { value: '32GB', label: '32GB' },
          { value: '1TB', label: '1TB' },
        ],
      },
      {
        id: 'ram',
        label: 'RAM',
        type: 'select',
        options: [
          { value: '4GB', label: '4GB' },
          { value: '6GB', label: '6GB' },
          { value: '8GB', label: '8GB' },
          { value: '12GB', label: '12GB' },
          { value: '2GB', label: '2GB' },
          { value: '3GB', label: '3GB' },
          { value: '16GB', label: '16GB' },
        ],
      },
      {
        id: 'etatTelephone',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf scellé sous garantie', label: 'Neuf scellé sous garantie' },
          { value: 'Neuf déballé sous garantie', label: 'Neuf déballé sous garantie' },
          { value: 'Reconditionné Grade A+', label: 'Reconditionné Grade A+ (comme neuf)' },
          { value: 'Reconditionné Grade A', label: 'Reconditionné Grade A' },
          { value: 'Reconditionné Grade B', label: 'Reconditionné Grade B' },
          { value: 'Occasion - Excellent état', label: 'Occasion - Excellent état' },
          { value: 'Occasion - Très bon état', label: 'Occasion - Très bon état' },
          { value: 'Occasion - Bon état', label: 'Occasion - Bon état' },
          { value: 'Occasion - État moyen', label: 'Occasion - État moyen' },
        ],
      },
      {
        id: 'couleurTelephone',
        label: 'Couleur',
        type: 'select',
        options: [
          { value: 'Noir', label: 'Noir' },
          { value: 'Blanc', label: 'Blanc' },
          { value: 'Bleu', label: 'Bleu' },
          { value: 'Vert', label: 'Vert' },
          { value: 'Rouge', label: 'Rouge' },
          { value: 'Or', label: 'Or' },
          { value: 'Rose', label: 'Rose' },
          { value: 'Gris', label: 'Gris' },
          { value: 'Violet', label: 'Violet' },
          { value: 'Argent', label: 'Argent' },
          { value: 'Titanium', label: 'Titanium' },
        ],
      },
      {
        id: 'operateur',
        label: 'Opérateur / Blocage',
        type: 'select',
        options: [
          { value: 'Débloqué', label: 'Débloqué (tous opérateurs)' },
          { value: 'Dual SIM débloqué', label: 'Dual SIM débloqué' },
          { value: 'Orange Cameroun', label: 'Orange Cameroun' },
          { value: 'MTN Cameroun', label: 'MTN Cameroun' },
          { value: 'Camtel', label: 'Camtel' },
          { value: 'Nexttel', label: 'Nexttel' },
          { value: 'Bloqué opérateur', label: 'Bloqué opérateur' },
          { value: 'Bloqué iCloud', label: 'Bloqué iCloud (iPhone)' },
        ],
      },
      {
        id: 'tailleEcran',
        label: 'Taille écran',
        type: 'select',
        options: [
          { value: '6.5"', label: '6.5 pouces' },
          { value: '6.7"', label: '6.7 pouces' },
          { value: '6.1"', label: '6.1 pouces' },
          { value: '6.4"', label: '6.4 pouces' },
          { value: '6.0"', label: '6.0 pouces' },
          { value: '6.8"', label: '6.8 pouces' },
          { value: '5.5"', label: '5.5 pouces' },
        ],
      },
      {
        id: 'cameraPrincipale',
        label: 'Appareil photo',
        type: 'select',
        options: [
          { value: '50MP', label: '50MP et plus' },
          { value: '48MP', label: '48MP et plus' },
          { value: '108MP', label: '108MP et plus' },
          { value: '200MP', label: '200MP et plus' },
          { value: '12MP', label: '12MP et plus' },
        ],
      },
      {
        id: 'connectivite5G',
        label: '5G',
        type: 'toggle',
      },
      {
        id: 'dualSim',
        label: 'Dual SIM',
        type: 'toggle',
      },
      {
        id: 'boiteOriginale',
        label: 'Boîte originale',
        type: 'toggle',
      },
      {
        id: 'factureTelephone',
        label: 'Facture disponible',
        type: 'toggle',
      },
      {
        id: 'ecranOriginal',
        label: 'Écran original (jamais changé)',
        type: 'toggle',
      },
      {
        id: 'imei',
        label: 'IMEI disponible',
        type: 'toggle',
      },
      {
        id: 'batterie',
        label: 'Capacité batterie',
        type: 'select',
        options: [
          { value: '3000-4000 mAh', label: '3000-4000 mAh' },
          { value: '4000-5000 mAh', label: '4000-5000 mAh (standard)' },
          { value: '5000-6000 mAh', label: '5000-6000 mAh (bonne autonomie)' },
          { value: '6000-7000 mAh', label: '6000-7000 mAh (excellente)' },
          { value: '7000+ mAh', label: '7000+ mAh (exceptionnelle)' },
        ],
      },
      {
        id: 'chargeRapide',
        label: 'Charge rapide',
        type: 'select',
        options: [
          { value: '10W', label: 'Charge standard (10W)' },
          { value: '18W', label: 'Rapide (18W)' },
          { value: '25W', label: 'Très rapide (25W)' },
          { value: '33W', label: 'Ultra rapide (33W)' },
          { value: '45W+', label: 'Super rapide (45W+)' },
          { value: 'Sans fil', label: 'Sans fil' },
        ],
      },
      {
        id: 'securiteBiometrique',
        label: 'Sécurité biométrique',
        type: 'select',
        options: [
          { value: 'Face ID 3D', label: 'Face ID 3D' },
          { value: 'Reconnaissance faciale 2D', label: 'Reconnaissance faciale 2D' },
          { value: 'Lecteur empreinte sous écran', label: 'Empreinte sous écran' },
          { value: 'Lecteur empreinte latéral', label: 'Empreinte latéral' },
          { value: 'Lecteur empreinte arrière', label: 'Empreinte arrière' },
          { value: 'Déverrouillage iris', label: 'Iris' },
        ],
      },
    ],
    style: {
      primaryColor: '#FF9800',
      gradientColors: ['#FF9800', '#F57C00'],
      icon: '📱',
      badgeColor: '#FFF3E0',
      accentColor: '#E65100',
    },
    displayPriority: ['marqueTelephone', 'modeleTelephone', 'stockage', 'ram', 'etatTelephone', 'couleurTelephone', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
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

  // 🔧 RÉPARATEUR TÉLÉPHONE/SMARTPHONE & TABLETTES - ✅ AFRIQUE FRANCOPHONE
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
      // ✅ FILTRE 1 : Types de réparation (le plus important)
      {
        id: 'typeReparation',
        label: 'Type de réparation',
        type: 'multiselect',
        options: [
          { value: 'Remplacement écran', label: '📱 Remplacement écran' },
          { value: 'Réparation écran fissuré', label: '📱 Réparation écran fissuré' },
          { value: 'Remplacement batterie', label: '🔋 Remplacement batterie' },
          { value: 'Réparation port de charge', label: '🔌 Réparation port de charge' },
          { value: 'Réparation haut-parleur', label: '🔊 Réparation haut-parleur' },
          { value: 'Réparation microphone', label: '🎤 Réparation microphone' },
          { value: 'Réparation caméra', label: '📸 Réparation caméra' },
          { value: 'Déblocage opérateur', label: '🔓 Déblocage opérateur' },
          { value: 'Déblocage iCloud/Google', label: '🔓 Déblocage iCloud/Google' },
          { value: 'Flash/Réinstallation système', label: '💾 Flash/Réinstallation' },
          { value: 'Réparation dégâts eau', label: '💧 Réparation dégâts eau' },
          { value: 'Remplacement carte mère', label: '🔧 Remplacement carte mère' },
          { value: 'Micro-soudure', label: '🔧 Micro-soudure' },
          { value: 'Récupération données', label: '🗑️ Récupération données' },
          { value: 'Pose film protecteur', label: '🛡️ Pose film protecteur' },
        ],
      },
      // ✅ FILTRE 2 : Marques supportées
      {
        id: 'marquesSuppoortees',
        label: 'Marques supportées',
        type: 'multiselect',
        options: [
          // TOP 5 AFRIQUE
          { value: 'Tecno', label: 'Tecno' },
          { value: 'Infinix', label: 'Infinix' },
          { value: 'Samsung', label: 'Samsung Galaxy' },
          { value: 'Xiaomi', label: 'Xiaomi/Redmi/Poco' },
          { value: 'Itel', label: 'Itel' },
          // PREMIUM
          { value: 'Apple', label: 'Apple iPhone' },
          { value: 'Huawei', label: 'Huawei' },
          { value: 'Honor', label: 'Honor' },
          // AUTRES POPULAIRES
          { value: 'Realme', label: 'Realme' },
          { value: 'Oppo', label: 'Oppo' },
          { value: 'Vivo', label: 'Vivo' },
          { value: 'OnePlus', label: 'OnePlus' },
          { value: 'Nokia', label: 'Nokia' },
          { value: 'Motorola', label: 'Motorola' },
          // TABLETTES
          { value: 'iPad', label: 'iPad (tablette)' },
          { value: 'Samsung Tab', label: 'Samsung Galaxy Tab' },
        ],
      },
      // ✅ FILTRE 3 : Délais de réparation
      {
        id: 'delaisReparation',
        label: 'Délai de réparation',
        type: 'select',
        options: [
          { value: 'Express (1-2h)', label: '⚡ Express (1-2h)' },
          { value: 'Rapide (3-6h)', label: '🚀 Rapide (3-6h)' },
          { value: 'Jour même', label: '📅 Jour même' },
          { value: '24-48h', label: '📅 24-48h' },
          { value: '2-3 jours', label: '📅 2-3 jours' },
          { value: '3-5 jours', label: '📅 3-5 jours' },
          { value: '5-7 jours', label: '📅 5-7 jours' },
        ],
      },
      // ✅ FILTRE 4 : Garantie réparation
      {
        id: 'garantieReparation',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'Garantie 6 mois', label: '✅ 6 mois' },
          { value: 'Garantie 3 mois', label: '✅ 3 mois' },
          { value: 'Garantie 1 mois', label: '✅ 1 mois' },
          { value: 'Garantie 15 jours', label: '✅ 15 jours' },
          { value: 'Garantie à vie', label: '✅ À vie (certaines réparations)' },
          { value: 'Aucune garantie', label: '❌ Aucune garantie' },
        ],
      },
      // ✅ FILTRE 5 : Qualité des pièces
      {
        id: 'qualitePieces',
        label: 'Qualité des pièces',
        type: 'select',
        options: [
          { value: 'Pièces originales', label: '⭐ Pièces originales constructeur' },
          { value: 'Pièces originales Apple', label: '⭐ Pièces originales Apple' },
          { value: 'Pièces originales Samsung', label: '⭐ Pièces originales Samsung' },
          { value: 'Pièces compatibles AAA+', label: '✅ Compatibles premium (AAA+)' },
          { value: 'Pièces compatibles AAA', label: '✅ Compatibles supérieure (AAA)' },
          { value: 'Pièces compatibles AA', label: '✅ Compatibles standard (AA)' },
          { value: 'Choix client', label: '🎁 Choix client (original ou compatible)' },
        ],
      },
      // ✅ FILTRE 6 : Type d'intervention
      {
        id: 'typeIntervention',
        label: 'Type d\'intervention',
        type: 'multiselect',
        options: [
          { value: 'En boutique', label: '🏪 En boutique/atelier' },
          { value: 'À domicile', label: '🏠 À domicile' },
          { value: 'En entreprise', label: '🏢 En entreprise' },
          { value: 'Service express', label: '⚡ Service express' },
          { value: 'Service mobile', label: '🚗 Atelier mobile' },
        ],
      },
      // ✅ FILTRE 7 : Certifications
      {
        id: 'certifications',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'Certifié Apple', label: '🎓 Technicien certifié Apple (ACMT)' },
          { value: 'Certifié Samsung', label: '🎓 Technicien certifié Samsung' },
          { value: 'Certifié micro-soudure', label: '🎓 Certifié micro-soudure' },
          { value: '+5 ans expérience', label: '🏆 +5 ans d\'expérience' },
          { value: '+10 ans expérience', label: '🏆 +10 ans d\'expérience' },
          { value: 'Spécialiste iPhone', label: '🛠️ Spécialiste iPhone' },
          { value: 'Spécialiste Samsung', label: '🛠️ Spécialiste Samsung' },
          { value: 'Boutique physique', label: '📱 Boutique physique' },
        ],
      },
      // ✅ FILTRE 8 : Services additionnels
      {
        id: 'servicesAdditionnels',
        label: 'Services additionnels',
        type: 'multiselect',
        options: [
          { value: 'Diagnostic gratuit', label: '🔍 Diagnostic gratuit' },
          { value: 'Devis gratuit', label: '🎁 Devis gratuit' },
          { value: 'Récupération domicile', label: '📦 Récupération domicile gratuite' },
          { value: 'Livraison domicile', label: '🚗 Livraison domicile gratuite' },
          { value: 'Paiement mobile money', label: '💳 Paiement mobile money' },
          { value: 'Paiement plusieurs fois', label: '💳 Paiement en plusieurs fois' },
          { value: 'Prêt téléphone', label: '🔄 Prêt de téléphone' },
          { value: 'Support WhatsApp 24/7', label: '💬 Support WhatsApp 24/7' },
          { value: 'Rachat ancien téléphone', label: '📱 Rachat ancien téléphone' },
        ],
      },
      // ✅ FILTRE 9 : États appareils acceptés
      {
        id: 'etatAppareilAccepte',
        label: 'États acceptés',
        type: 'multiselect',
        options: [
          { value: 'Écran cassé', label: '✅ Écran cassé' },
          { value: 'Endommagé eau', label: '✅ Endommagé par l\'eau' },
          { value: 'Ne s\'allume pas', label: '✅ Ne s\'allume pas' },
          { value: 'Bloqué iCloud/Google', label: '✅ Bloqué (iCloud, Google)' },
          { value: 'Tous états', label: '✅ Tous états acceptés' },
        ],
      },
      // ✅ FILTRE 10 : Spécialiste iPhone (toggle)
      {
        id: 'specialisteIPhone',
        label: 'Spécialiste iPhone',
        type: 'toggle',
      },
      // ✅ FILTRE 11 : Service à domicile (toggle)
      {
        id: 'serviceADomicile',
        label: 'Service à domicile disponible',
        type: 'toggle',
      },
      // ✅ FILTRE 12 : Micro-soudure (toggle)
      {
        id: 'microSoudure',
        label: 'Micro-soudure (réparation avancée)',
        type: 'toggle',
      },
      // ✅ FILTRE 13 : Pièces originales uniquement (toggle)
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
    contactMethods: ['whatsapp', 'phone', 'message'],
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

  // 💻 RÉPARATEUR INFORMATIQUE (Ordinateurs, Imprimantes, Équipements) - ✅ NOUVEAU 🌍 AFRIQUE
  reparateur_informatique: {
    terminology: {
      productLabel: 'Service de réparation informatique',
      productsLabel: 'Réparateurs Informatiques',
      priceLabel: 'Tarif',
      locationLabel: 'Atelier',
      providerLabel: 'Technicien',
      searchPlaceholder: 'Rechercher réparateur PC/imprimante (virus, écran, upgrade...)...',
      emptyMessage: 'Aucun réparateur informatique disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Types de réparation (PLUS IMPORTANT)
      {
        id: 'typesReparationInfo',
        label: 'Types de réparation',
        type: 'multiselect',
        options: [
          // Hardware le plus courant
          { value: 'Réparation écran cassé', label: '💻 Réparation écran cassé' },
          { value: 'Remplacement batterie', label: '🔋 Remplacement batterie laptop' },
          { value: 'Réparation clavier', label: '⌨️ Réparation/Remplacement clavier' },
          { value: 'Réparation touchpad', label: '🖱️ Réparation touchpad' },
          { value: 'Nettoyage ventilateur', label: '🌡️ Nettoyage ventilateur (surchauffe)' },
          { value: 'Upgrade RAM', label: '🧠 Upgrade RAM (ajout mémoire)' },
          { value: 'Remplacement SSD', label: '💾 Remplacement/Upgrade SSD' },
          { value: 'Upgrade HDD vers SSD', label: '💾 Upgrade HDD vers SSD' },
          // Logiciel très demandé
          { value: 'Réinstallation Windows', label: '🪟 Réinstallation Windows (10, 11)' },
          { value: 'Formatage complet', label: '🪟 Formatage complet' },
          { value: 'Suppression virus', label: '🦠 Suppression virus/malware' },
          { value: 'Récupération données', label: '🗑️ Récupération de données' },
          { value: 'Optimisation performances', label: '⚡ Optimisation performances (lenteur)' },
          { value: 'Installation Linux', label: '🐧 Installation Linux Ubuntu/Mint' },
          { value: 'Dual boot', label: '🔄 Dual boot (Windows + Linux)' },
          // Imprimantes
          { value: 'Réparation imprimante jet d\'encre', label: '🖨️ Réparation imprimante jet d\'encre' },
          { value: 'Réparation imprimante laser', label: '🖨️ Réparation imprimante laser' },
          { value: 'Déblocage bourrage papier', label: '🖨️ Déblocage bourrage papier' },
          { value: 'Nettoyage têtes impression', label: '🖨️ Nettoyage têtes d\'impression' },
          { value: 'Configuration imprimante réseau', label: '🖨️ Configuration imprimante réseau' },
          // Réseaux
          { value: 'Configuration réseau WiFi', label: '📶 Configuration réseau WiFi' },
          { value: 'Réparation connexion Internet', label: '📶 Réparation connexion Internet' },
          { value: 'Configuration VPN', label: '🔐 Configuration VPN' },
          // Avancé
          { value: 'Réparation carte mère', label: '🔧 Réparation carte mère' },
          { value: 'Micro-soudure', label: '🔧 Micro-soudure composants' },
          { value: 'Réparation dégâts liquides', label: '💧 Réparation dégâts liquides' },
        ],
      },
      // ✅ FILTRE 2 : Marques ordinateurs supportées
      {
        id: 'marquesOrdinateursReparees',
        label: 'Marques ordinateurs supportées',
        type: 'multiselect',
        options: [
          // TOP 5 AFRIQUE
          { value: 'HP', label: 'HP (EliteBook, ProBook, Pavilion)' },
          { value: 'Dell', label: 'Dell (Latitude, Inspiron, XPS)' },
          { value: 'Lenovo', label: 'Lenovo (ThinkPad, IdeaPad)' },
          { value: 'Asus', label: 'Asus (VivoBook, ROG, ZenBook)' },
          { value: 'Acer', label: 'Acer (Aspire, Swift, Nitro)' },
          // POPULAIRES
          { value: 'Toshiba', label: 'Toshiba (Satellite, Tecra)' },
          { value: 'Samsung', label: 'Samsung (Galaxy Book)' },
          { value: 'Compaq', label: 'Compaq (ancien HP)' },
          // PREMIUM
          { value: 'Apple', label: 'Apple (MacBook Air/Pro, iMac)' },
          { value: 'Microsoft', label: 'Microsoft (Surface)' },
          // GAMING
          { value: 'MSI', label: 'MSI (Gaming, Workstation)' },
          { value: 'Razer', label: 'Razer (Blade, Book)' },
          { value: 'Alienware', label: 'Alienware (Dell Gaming)' },
          // AUTRES
          { value: 'Huawei', label: 'Huawei (MateBook)' },
          { value: 'LG', label: 'LG (Gram)' },
          { value: 'Fujitsu', label: 'Fujitsu (LifeBook)' },
        ],
      },
      // ✅ FILTRE 3 : Marques imprimantes supportées
      {
        id: 'marquesImprimantesReparees',
        label: 'Marques imprimantes supportées',
        type: 'multiselect',
        options: [
          // TOP 3 AFRIQUE
          { value: 'HP', label: 'HP (LaserJet, DeskJet, OfficeJet)' },
          { value: 'Epson', label: 'Epson (EcoTank, WorkForce, L-series)' },
          { value: 'Canon', label: 'Canon (PIXMA, MAXIFY, imageCLASS)' },
          // POPULAIRES
          { value: 'Brother', label: 'Brother (DCP, MFC, HL-series)' },
          { value: 'Samsung', label: 'Samsung (Xpress, ProXpress)' },
          { value: 'Pantum', label: 'Pantum (P2500, M6500)' },
          // PRO
          { value: 'Kyocera', label: 'Kyocera (ECOSYS)' },
          { value: 'Ricoh', label: 'Ricoh (Photocopieurs)' },
          { value: 'Xerox', label: 'Xerox (WorkCentre)' },
          { value: 'Lexmark', label: 'Lexmark' },
        ],
      },
      // ✅ FILTRE 4 : Types de pannes
      {
        id: 'typesPannesReparees',
        label: 'Types de pannes traitées',
        type: 'multiselect',
        options: [
          { value: 'Panne logicielle', label: '⚡ Panne logicielle (système)' },
          { value: 'Panne hardware', label: '⚡ Panne hardware (composants)' },
          { value: 'Virus/Malware', label: '🦠 Virus/Malware/Ransomware' },
          { value: 'Ordinateur très lent', label: '🐢 Ordinateur très lent' },
          { value: 'Écran cassé', label: '💻 Écran cassé/défectueux' },
          { value: 'Surchauffe', label: '🔥 Surchauffe chronique' },
          { value: 'Ne s\'allume plus', label: '❌ Ne s\'allume plus' },
          { value: 'Problème batterie', label: '🔋 Problème batterie/alimentation' },
          { value: 'Problème réseau WiFi', label: '📶 Problème réseau/WiFi' },
          { value: 'Disque dur défaillant', label: '💾 Disque dur défaillant' },
          { value: 'Dégâts liquides', label: '💧 Dégâts liquides/humidité' },
          { value: 'Écran bleu', label: '🔵 Écran bleu (BSOD)' },
          { value: 'Imprimante ne fonctionne plus', label: '🖨️ Imprimante ne fonctionne plus' },
          { value: 'Bourrage papier', label: '🖨️ Bourrage papier récurrent' },
        ],
      },
      // ✅ FILTRE 5 : Délais de réparation
      {
        id: 'delaiReparationInfo',
        label: 'Délai de réparation',
        type: 'select',
        options: [
          { value: 'Express (30 min - 2h)', label: '⚡ Express (30 min - 2h)' },
          { value: 'Rapide (même jour)', label: '🚀 Rapide (même jour)' },
          { value: 'Standard (1-3 jours)', label: '📅 Standard (1-3 jours)' },
          { value: 'Complexe (3-7 jours)', label: '⏰ Complexe (3-7 jours)' },
          { value: 'Sur commande (7-15 jours)', label: '🛠️ Sur commande pièces (7-15 jours)' },
        ],
      },
      // ✅ FILTRE 6 : Garantie réparation
      {
        id: 'garantieReparation',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'Garantie 1 an', label: '✅ 1 an' },
          { value: 'Garantie 6 mois', label: '✅ 6 mois' },
          { value: 'Garantie 3 mois', label: '✅ 3 mois' },
          { value: 'Garantie 1 mois', label: '✅ 1 mois' },
          { value: 'Satisfaction garantie', label: '✅ Satisfaction garantie' },
        ],
      },
      // ✅ FILTRE 7 : Certifications
      {
        id: 'certificationsInfo',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'Certifié HP', label: '🏅 Technicien certifié HP' },
          { value: 'Certifié Dell', label: '🏅 Technicien certifié Dell' },
          { value: 'Certifié Apple', label: '🏅 Technicien certifié Apple (ACMT)' },
          { value: 'Certifié Lenovo', label: '🏅 Technicien certifié Lenovo' },
          { value: 'CompTIA A+', label: '🎓 Certification CompTIA A+' },
          { value: 'Microsoft Certified', label: '🎓 Certification Microsoft (MCP)' },
          { value: 'Cisco CCNA', label: '🎓 Certification Cisco (CCNA)' },
          { value: '+5 ans expérience', label: '🏆 +5 ans d\'expérience' },
          { value: '+10 ans expérience', label: '🏆 +10 ans d\'expérience' },
          { value: 'Micro-soudure certifié', label: '🔬 Formation micro-soudure' },
          { value: 'Récupération données certifié', label: '💾 Formation récupération données' },
        ],
      },
      // ✅ FILTRE 8 : Services additionnels
      {
        id: 'servicesAdditionnelsInfo',
        label: 'Services additionnels',
        type: 'multiselect',
        options: [
          { value: 'Diagnostic gratuit', label: '🔍 Diagnostic gratuit' },
          { value: 'Devis gratuit', label: '🎁 Devis gratuit' },
          { value: 'Déplacement domicile/bureau', label: '🚚 Déplacement domicile/bureau' },
          { value: 'Récupération et livraison', label: '📦 Récupération et livraison' },
          { value: 'Support WhatsApp 24/7', label: '💬 Support WhatsApp 24/7' },
          { value: 'Support technique à distance', label: '📱 Support technique à distance' },
          { value: 'Intervention urgence', label: '⏰ Intervention urgence (week-end/soir)' },
          { value: 'Contrat maintenance', label: '💼 Contrat maintenance mensuel' },
          { value: 'Mobile Money accepté', label: '💳 Mobile Money accepté' },
          { value: 'Paiement échelonné', label: '💰 Paiement échelonné accepté' },
          { value: 'Sauvegarde données', label: '💾 Sauvegarde données avant réparation' },
        ],
      },
      // ✅ FILTRE 9 : Équipements atelier
      {
        id: 'equipementsAtelierInfo',
        label: 'Équipements atelier',
        type: 'multiselect',
        options: [
          { value: 'Station micro-soudure', label: '🔬 Station micro-soudure' },
          { value: 'Station récupération données', label: '💾 Station récupération données' },
          { value: 'Microscope réparation', label: '🔬 Microscope réparation' },
          { value: 'Station air chaud', label: '🌡️ Station air chaud (reballing)' },
          { value: 'Testeur alimentation', label: '⚡ Testeur alimentation' },
          { value: 'Testeur batterie', label: '🔋 Testeur batterie' },
          { value: 'Pièces en stock', label: '🔌 Pièces détachées en stock' },
          { value: 'Pièces imprimantes stock', label: '🖨️ Pièces imprimantes en stock' },
        ],
      },
      // ✅ FILTRE 10 : Type d'intervention
      {
        id: 'typeIntervention',
        label: 'Type d\'intervention',
        type: 'multiselect',
        options: [
          { value: 'En atelier', label: '🏪 En atelier' },
          { value: 'À domicile', label: '🏠 À domicile' },
          { value: 'En entreprise', label: '🏢 En entreprise' },
          { value: 'À distance', label: '📱 Support à distance' },
          { value: 'Service express', label: '⚡ Service express' },
        ],
      },
      // ✅ FILTRE 11 : Spécialiste Apple (toggle)
      {
        id: 'specialisteApple',
        label: 'Spécialiste Apple (MacBook, iMac)',
        type: 'toggle',
      },
      // ✅ FILTRE 12 : Intervention à domicile (toggle)
      {
        id: 'interventionDomicile',
        label: 'Intervention à domicile/bureau',
        type: 'toggle',
      },
      // ✅ FILTRE 13 : Support à distance (toggle)
      {
        id: 'supportDistance',
        label: 'Support technique à distance',
        type: 'toggle',
      },
      // ✅ FILTRE 14 : Micro-soudure (toggle)
      {
        id: 'microSoudure',
        label: 'Micro-soudure (réparation avancée)',
        type: 'toggle',
      },
      // ✅ FILTRE 15 : Récupération données (toggle)
      {
        id: 'recuperationDonnees',
        label: 'Récupération de données',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#3B82F6',
      gradientColors: ['#3B82F6', '#2563EB'],
      icon: '💻',
      badgeColor: '#DBEAFE',
      accentColor: '#1E40AF',
    },
    displayPriority: ['nomAtelier', 'typesReparationInfo', 'marquesOrdinateursReparees', 'marquesImprimantesReparees', 'delaiReparationInfo', 'garantieReparation', 'certificationsInfo', 'prixEstimatif'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    searchKeywords: [
      // Termes généraux - RÉPARATEUR ET DÉPANNEUR (Important !)
      'réparateur informatique', 'reparateur informatique', 'réparateur', 'reparateur',
      'dépanneur informatique', 'depanneur informatique', 'dépanneur', 'depanneur',
      'technicien informatique', 'technicien IT', 'service informatique',
      'réparation ordinateur', 'reparation ordinateur', 'réparation PC', 'reparation PC',
      'réparation laptop', 'reparation laptop', 'réparation MacBook', 'reparation macbook',
      'dépannage informatique', 'depannage informatique', 'dépannage PC', 'depannage PC',
      'atelier informatique', 'maintenance informatique', 'support informatique',
      // Ordinateurs types
      'réparation portable', 'reparation portable', 'réparation laptop',
      'réparation PC bureau', 'reparation PC bureau', 'réparation tour PC',
      'réparation iMac', 'reparation imac', 'réparation Mac', 'reparation mac',
      // Réparations hardware
      'écran cassé', 'ecran casse', 'remplacement écran PC', 'remplacement ecran PC',
      'écran PC cassé', 'ecran PC casse', 'changer écran laptop', 'changer ecran laptop',
      'batterie laptop', 'batterie PC', 'changer batterie ordinateur',
      'clavier cassé', 'clavier casse', 'touches cassées', 'touches cassees',
      'touchpad ne marche pas', 'pavé tactile', 'pave tactile',
      'charnières cassées', 'charnieres cassees', 'charnière PC', 'charniere PC',
      'surchauffe PC', 'PC chauffe', 'ventilateur bruyant',
      'nettoyage PC', 'nettoyage ordinateur', 'nettoyage ventilateur',
      'upgrade RAM', 'augmenter RAM', 'ajouter mémoire', 'ajouter memoire',
      'upgrade SSD', 'remplacer disque dur', 'changer HDD',
      'installer SSD', 'passer au SSD', 'HDD vers SSD',
      'carte mère', 'carte mere', 'réparation carte mère', 'reparation carte mere',
      'micro-soudure', 'micro soudure', 'reballing', 'composants électroniques',
      'dégâts eau', 'degats eau', 'PC mouillé', 'PC mouille', 'oxydation',
      // Réparations logicielles
      'réinstallation Windows', 'reinstallation windows', 'installation Windows',
      'formatage PC', 'formatage ordinateur', 'formater PC',
      'Windows lent', 'PC lent', 'ordinateur lent', 'lenteur PC',
      'virus', 'malware', 'ransomware', 'suppression virus',
      'enlever virus', 'nettoyer virus', 'PC infecté', 'PC infecte',
      'récupération données', 'recuperation donnees', 'récupérer fichiers', 'recuperer fichiers',
      'disque dur HS', 'disque dur mort', 'disque défaillant', 'disque defaillant',
      'restaurer données', 'restaurer donnees', 'sauvegarder données', 'sauvegarder donnees',
      'installation Linux', 'installer Ubuntu', 'installer Linux Mint',
      'dual boot', 'Windows Linux', 'partition',
      'écran bleu', 'ecran bleu', 'BSOD', 'blue screen',
      'PC ne démarre pas', 'PC ne demarre pas', 'ne s\'allume pas',
      'mot de passe oublié', 'mot de passe oublie', 'récupérer mot de passe',
      'déblocage BIOS', 'deblocage BIOS', 'déverrouillage PC',
      // Imprimantes
      'réparation imprimante', 'reparation imprimante', 'dépannage imprimante', 'depannage imprimante',
      'réparateur imprimante', 'reparateur imprimante', 'technicien imprimante',
      'imprimante ne fonctionne pas', 'imprimante HS', 'imprimante cassée', 'imprimante cassee',
      'bourrage papier', 'imprimante bloquée', 'imprimante bloquee',
      'têtes impression', 'tetes impression', 'nettoyage têtes', 'nettoyage tetes',
      'imprimante laser', 'imprimante jet d\'encre', 'imprimante Epson',
      'réparation Epson L380', 'reparation Epson L380', 'réparation HP LaserJet',
      'réparation Canon PIXMA', 'reparation Canon PIXMA', 'réparation Brother',
      'photocopieuse', 'photocopieur', 'scanner ne marche pas',
      'configuration imprimante', 'installer imprimante', 'driver imprimante',
      'imprimante réseau', 'imprimante reseau', 'imprimante WiFi',
      // Réseau & WiFi
      'problème WiFi', 'probleme WiFi', 'WiFi ne marche pas',
      'connexion Internet', 'pas d\'Internet', 'Internet lent',
      'configuration réseau', 'configuration reseau', 'installer WiFi',
      'routeur', 'modem', 'configuration routeur',
      'réseau local', 'reseau local', 'LAN', 'partage réseau', 'partage reseau',
      'VPN', 'configuration VPN', 'sécurité réseau', 'securite reseau',
      // Marques populaires
      'réparation HP', 'reparation HP', 'réparation Dell', 'reparation Dell',
      'réparation Lenovo', 'reparation Lenovo', 'réparation Asus', 'reparation Asus',
      'réparation Acer', 'reparation Acer', 'réparation Toshiba', 'reparation Toshiba',
      'réparation Apple', 'reparation Apple', 'réparation MacBook', 'reparation MacBook',
      'réparation Surface', 'reparation Surface', 'Microsoft Surface',
      // Services
      'diagnostic PC gratuit', 'diagnostic gratuit', 'devis gratuit',
      'réparation express', 'reparation express', 'réparation rapide', 'reparation rapide',
      'réparation urgent', 'reparation urgent', 'dépannage urgent', 'depannage urgent',
      'service à domicile', 'service a domicile', 'intervention à domicile',
      'technicien à domicile', 'technicien a domicile',
      'support technique', 'assistance technique', 'aide informatique',
      'maintenance PC', 'maintenance ordinateur', 'entretien PC',
      'assemblage PC', 'monter PC', 'PC sur mesure',
      // Termes locaux Cameroun
      'réparateur Douala', 'reparateur Douala', 'technicien Yaoundé', 'technicien Yaounde',
      'dépanneur Douala', 'depanneur Douala', 'dépanneur Yaoundé',
      'réparation PC Akwa', 'reparation PC Bonanjo', 'réparation PC Bastos',
    ],
  },

  // ❄️ RÉPARATEUR ÉLECTROMÉNAGER - ✅ NOUVEAU 🌍 AFRIQUE
  reparateur_electromenager: {
    terminology: {
      productLabel: 'Service de réparation électroménager',
      productsLabel: 'Réparateurs Électroménager',
      priceLabel: 'Tarif',
      locationLabel: 'Atelier/Zone',
      providerLabel: 'Technicien',
      searchPlaceholder: 'Rechercher réparateur frigo/cuisinière/lave-linge...',
      emptyMessage: 'Aucun réparateur électroménager disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // ✅ FILTRE 1 : Types de réparations (PLUS IMPORTANT)
      {
        id: 'typesReparationElectro',
        label: 'Types de réparations',
        type: 'multiselect',
        options: [
          // Frigos & Congélateurs
          { value: 'Réparation réfrigérateur', label: '❄️ Réparation réfrigérateur' },
          { value: 'Réparation congélateur', label: '❄️ Réparation congélateur' },
          { value: 'Rechargement gaz réfrigérant', label: '❄️ Rechargement gaz' },
          { value: 'Remplacement compresseur', label: '❄️ Remplacement compresseur' },
          // Cuisinières & Fours
          { value: 'Réparation cuisinière gaz', label: '🍳 Réparation cuisinière gaz' },
          { value: 'Réparation four électrique', label: '🍳 Réparation four électrique' },
          { value: 'Réparation four gaz', label: '🍳 Réparation four gaz' },
          { value: 'Nettoyage injecteurs gaz', label: '🍳 Nettoyage injecteurs gaz' },
          // Lave-linge & Lave-vaisselle
          { value: 'Réparation lave-linge', label: '🧺 Réparation lave-linge' },
          { value: 'Réparation lave-vaisselle', label: '🧺 Réparation lave-vaisselle' },
          { value: 'Remplacement pompe vidange', label: '🧺 Remplacement pompe vidange' },
          // Micro-ondes
          { value: 'Réparation micro-ondes', label: '🔥 Réparation micro-ondes' },
          // Climatiseurs
          { value: 'Réparation climatiseur', label: '🌬️ Réparation climatiseur' },
          { value: 'Installation climatiseur', label: '🌬️ Installation climatiseur' },
          // Petit électroménager
          { value: 'Réparation machine à café', label: '☕ Réparation machine à café' },
          { value: 'Réparation mixeur/blender', label: '🌀 Réparation mixeur/blender' },
          { value: 'Réparation fer à repasser', label: '🔌 Réparation fer à repasser' },
        ],
      },
      // ✅ FILTRE 2 : Marques supportées
      {
        id: 'marquesElectromenagerReparees',
        label: 'Marques supportées',
        type: 'multiselect',
        options: [
          // TOP MARQUES AFRIQUE
          { value: 'Binatone', label: 'Binatone' },
          { value: 'Sokany', label: 'Sokany' },
          { value: 'Nexus', label: 'Nexus' },
          { value: 'Scanfrost', label: 'Scanfrost' },
          { value: 'Hisense', label: 'Hisense' },
          { value: 'Midea', label: 'Midea' },
          { value: 'Haier', label: 'Haier' },
          { value: 'Restpoint', label: 'Restpoint' },
          // POPULAIRES
          { value: 'LG', label: 'LG' },
          { value: 'Samsung', label: 'Samsung' },
          { value: 'TCL', label: 'TCL' },
          { value: 'Panasonic', label: 'Panasonic' },
          { value: 'Sharp', label: 'Sharp' },
          { value: 'Toshiba', label: 'Toshiba' },
          // PREMIUM
          { value: 'Whirlpool', label: 'Whirlpool' },
          { value: 'Bosch', label: 'Bosch' },
          { value: 'Siemens', label: 'Siemens' },
          { value: 'Electrolux', label: 'Electrolux' },
          // CAFÉ
          { value: 'Nespresso', label: 'Nespresso' },
          { value: 'Philips', label: 'Philips' },
          { value: 'Delonghi', label: 'Delonghi' },
          { value: 'Moulinex', label: 'Moulinex' },
          // CLIMATISATION
          { value: 'Daikin', label: 'Daikin' },
          { value: 'Gree', label: 'Gree' },
          { value: 'Carrier', label: 'Carrier' },
        ],
      },
      // ✅ FILTRE 3 : Types d'appareils
      {
        id: 'typesAppareilsElectro',
        label: 'Types d\'appareils',
        type: 'multiselect',
        options: [
          { value: 'Réfrigérateur', label: 'Réfrigérateur' },
          { value: 'Congélateur', label: 'Congélateur' },
          { value: 'Cuisinière', label: 'Cuisinière' },
          { value: 'Four', label: 'Four' },
          { value: 'Lave-linge', label: 'Lave-linge' },
          { value: 'Lave-vaisselle', label: 'Lave-vaisselle' },
          { value: 'Sèche-linge', label: 'Sèche-linge' },
          { value: 'Micro-ondes', label: 'Micro-ondes' },
          { value: 'Climatiseur', label: 'Climatiseur' },
          { value: 'Machine à café', label: 'Machine à café' },
          { value: 'Mixeur/Blender', label: 'Mixeur/Blender' },
          { value: 'Fer à repasser', label: 'Fer à repasser' },
          { value: 'Ventilateur', label: 'Ventilateur' },
        ],
      },
      // ✅ FILTRE 4 : Types de pannes
      {
        id: 'typesPannesElectro',
        label: 'Types de pannes',
        type: 'multiselect',
        options: [
          { value: 'Ne refroidit plus', label: '❄️ Ne refroidit plus' },
          { value: 'Ne chauffe plus', label: '🔥 Ne chauffe plus' },
          { value: 'Ne s\'allume plus', label: '⚡ Ne s\'allume plus' },
          { value: 'Fuite d\'eau', label: '💧 Fuite d\'eau' },
          { value: 'Fuite de gaz', label: '💨 Fuite de gaz' },
          { value: 'Bruit anormal', label: '🔊 Bruit anormal' },
          { value: 'Ne tourne plus', label: '🚫 Ne tourne plus' },
          { value: 'Ne vidange plus', label: '🌊 Ne vidange plus' },
        ],
      },
      // ✅ FILTRE 5 : Délai de réparation
      {
        id: 'delaiReparationElectro',
        label: 'Délai de réparation',
        type: 'select',
        options: [
          { value: 'Express (même jour)', label: '⚡ Express (même jour)' },
          { value: 'Rapide (24-48h)', label: '🚀 Rapide (24-48h)' },
          { value: 'Standard (2-5 jours)', label: '📅 Standard (2-5 jours)' },
          { value: 'Sur commande (5-10 jours)', label: '🛠️ Sur commande pièces' },
        ],
      },
      // ✅ FILTRE 6 : Garantie
      {
        id: 'garantieReparationElectro',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: 'Garantie 1 an', label: '✅ 1 an' },
          { value: 'Garantie 6 mois', label: '✅ 6 mois' },
          { value: 'Garantie 3 mois', label: '✅ 3 mois' },
          { value: 'Garantie 1 mois', label: '✅ 1 mois' },
        ],
      },
      // ✅ FILTRE 7 : Certifications
      {
        id: 'certificationsElectro',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'Frigoriste certifié', label: '🏅 Frigoriste certifié' },
          { value: 'Certification gaz', label: '🏅 Certification gaz' },
          { value: 'Agrément constructeur', label: '🏅 Agrément constructeur' },
          { value: '+10 ans expérience', label: '🏆 +10 ans d\'expérience' },
          { value: '+5 ans expérience', label: '🏆 +5 ans d\'expérience' },
          { value: 'Spécialiste froid', label: '🔧 Spécialiste froid' },
          { value: 'Spécialiste lavage', label: '🔧 Spécialiste lavage' },
          { value: 'Spécialiste cuisson', label: '🔧 Spécialiste cuisson' },
        ],
      },
      // ✅ FILTRE 8 : Services additionnels
      {
        id: 'servicesAdditionnelsElectro',
        label: 'Services additionnels',
        type: 'multiselect',
        options: [
          { value: 'Diagnostic gratuit', label: '🔍 Diagnostic gratuit' },
          { value: 'Devis gratuit', label: '🎁 Devis gratuit' },
          { value: 'Déplacement gratuit', label: '🚚 Déplacement gratuit' },
          { value: 'Urgence 24/7', label: '⏰ Urgence 24/7' },
          { value: 'Mobile Money', label: '💳 Mobile Money' },
          { value: 'Paiement échelonné', label: '💰 Paiement échelonné' },
          { value: 'Installation incluse', label: '🔧 Installation incluse' },
        ],
      },
      // ✅ FILTRE 9 : Intervention à domicile (toggle)
      {
        id: 'interventionDomicileElectro',
        label: 'Intervention à domicile',
        type: 'toggle',
      },
      // ✅ FILTRE 10 : Urgence disponible (toggle)
      {
        id: 'urgenceDisponibleElectro',
        label: 'Urgence 24/7 disponible',
        type: 'toggle',
      },
      // ✅ FILTRE 11 : Spécialiste froid (toggle)
      {
        id: 'specialiteFroid',
        label: 'Spécialiste froid (frigos, clims)',
        type: 'toggle',
      },
      // ✅ FILTRE 12 : Spécialiste cuisson (toggle)
      {
        id: 'specialiteCuisson',
        label: 'Spécialiste cuisson (cuisinières, fours)',
        type: 'toggle',
      },
      // ✅ FILTRE 13 : Spécialiste lavage (toggle)
      {
        id: 'specialiteLavage',
        label: 'Spécialiste lavage (lave-linge, lave-vaisselle)',
        type: 'toggle',
      },
      // ✅ FILTRE 14 : Distance maximale (select) - 🆕 AMÉLIORATION PRODUCTION
      {
        id: 'distanceMaxElectro',
        label: 'Distance maximale',
        type: 'select',
        options: [
          { value: 'all', label: 'Toutes distances' },
          { value: '5', label: '📍 À moins de 5 km' },
          { value: '10', label: '📍 À moins de 10 km' },
          { value: '20', label: '📍 À moins de 20 km' },
          { value: '50', label: '📍 À moins de 50 km' },
        ],
      },
    ],
    style: {
      primaryColor: '#06B6D4',
      gradientColors: ['#06B6D4', '#0891B2'],
      icon: '❄️',
      badgeColor: '#CFFAFE',
      accentColor: '#0E7490',
    },
    displayPriority: ['typesReparationElectro', 'marquesElectromenagerReparees', 'typesAppareilsElectro', 'delaiReparationElectro', 'garantieReparationElectro', 'certificationsElectro'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    searchKeywords: [
      // Termes généraux - RÉPARATEUR ET DÉPANNEUR (Important !)
      'réparateur électroménager', 'reparateur electromenager', 'réparateur', 'reparateur',
      'dépanneur électroménager', 'depanneur electromenager', 'dépanneur', 'depanneur',
      'technicien électroménager', 'technicien electromenager', 'service électroménager',
      'réparation électroménager', 'reparation electromenager', 'dépannage électroménager',
      // Réfrigérateurs & Congélateurs
      'réparation frigo', 'reparation frigo', 'réparateur frigo', 'reparateur frigo',
      'dépanneur frigo', 'depanneur frigo', 'frigoriste', 'technicien frigoriste',
      'réparation réfrigérateur', 'reparation refrigerateur', 'frigo ne refroidit plus',
      'frigo cassé', 'frigo casse', 'frigo ne marche plus',
      'réparation congélateur', 'reparation congelateur', 'congélateur cassé',
      'rechargement gaz frigo', 'gaz réfrigérant', 'gaz refrigerant',
      'compresseur frigo', 'thermostat frigo', 'fuite gaz frigo',
      // Cuisinières & Fours
      'réparation cuisinière', 'reparation cuisiniere', 'réparateur cuisinière',
      'cuisinière gaz', 'cuisiniere gaz', 'brûleurs cuisinière', 'bruleurs cuisiniere',
      'réparation four', 'reparation four', 'four ne chauffe plus',
      'four électrique', 'four electrique', 'four gaz',
      'injecteurs gaz', 'allumage piezo',
      // Lave-linge & Lave-vaisselle
      'réparation lave-linge', 'reparation lave-linge', 'réparation machine à laver',
      'machine à laver', 'machine a laver', 'lave-linge cassé', 'lave-linge casse',
      'lave-linge ne vidange plus', 'tambour bloqué', 'tambour bloque',
      'pompe vidange', 'courroie lave-linge', 'fuite lave-linge',
      'réparation lave-vaisselle', 'reparation lave-vaisselle',
      // Micro-ondes
      'réparation micro-ondes', 'reparation micro-ondes', 'micro-ondes cassé',
      'micro-ondes ne chauffe plus', 'magnétron', 'magnetron',
      // Climatiseurs
      'réparation climatiseur', 'reparation climatiseur', 'réparation clim', 'reparation clim',
      'climatiseur cassé', 'climatiseur casse', 'clim ne refroidit plus',
      'installation climatiseur', 'installation clim', 'recharge gaz clim',
      'nettoyage filtre clim', 'maintenance climatiseur',
      // Petit électroménager
      'réparation machine à café', 'reparation machine cafe', 'cafetière cassée',
      'détartrage machine café', 'detartrage machine cafe',
      'réparation mixeur', 'reparation mixeur', 'mixeur cassé', 'blender cassé',
      'réparation fer à repasser', 'reparation fer repasser', 'fer ne chauffe plus',
      'centrale vapeur', 'détartrage fer', 'detartrage fer',
      // Marques
      'réparation Binatone', 'reparation Binatone', 'réparation Sokany', 'reparation Sokany',
      'réparation LG', 'reparation LG', 'réparation Samsung', 'reparation Samsung',
      'réparation Hisense', 'reparation Hisense', 'réparation Midea', 'reparation Midea',
      'réparation Nexus', 'reparation Nexus', 'réparation Scanfrost', 'reparation Scanfrost',
      // Services
      'diagnostic gratuit', 'devis gratuit', 'réparation express', 'reparation express',
      'réparation urgente', 'reparation urgente', 'dépannage urgent', 'depannage urgent',
      'intervention domicile', 'service à domicile', 'service a domicile',
      'technicien à domicile', 'technicien a domicile',
      'frigoriste Douala', 'réparateur frigo Douala', 'reparateur frigo Douala',
      'frigoriste Yaoundé', 'frigoriste Yaounde', 'réparateur frigo Yaoundé',
      'réparation électroménager Akwa', 'reparation electromenager Bonanjo',
    ],
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

  // 📟 ÉLECTRONIQUE & HIGH-TECH
  electronique: {
    terminology: {
      productLabel: 'Appareil électronique',
      productsLabel: 'Électronique & High-Tech',
      priceLabel: 'Prix',
      locationLabel: 'Boutique',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher smartphone, ordinateur, drone...',
      emptyMessage: 'Aucun appareil disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeElectronique',
        label: 'Type d\'appareil',
        type: 'multiselect',
        options: [
          { value: 'Smartphone', label: '📱 Smartphone' },
          { value: 'Tablette', label: '📱 Tablette' },
          { value: 'Ordinateur portable', label: '💻 Ordinateur portable' },
          { value: 'PC de bureau', label: '🖥️ PC de bureau' },
          { value: 'Télévision', label: '📺 Télévision' },
          { value: 'Console de jeux', label: '🎮 Console de jeux' },
          { value: 'Appareil photo', label: '📷 Appareil photo' },
          { value: 'Caméra', label: '📹 Caméra' },
          { value: 'Drone', label: '🚁 Drone' },
          { value: 'Montre connectée', label: '⌚ Montre connectée' },
          { value: 'Écouteurs', label: '🎧 Écouteurs' },
          { value: 'Casque audio', label: '🎧 Casque audio' },
          { value: 'Enceinte', label: '🔊 Enceinte' },
          { value: 'Chargeur', label: '🔌 Chargeur' },
          { value: 'Batterie externe', label: '🔋 Batterie externe' },
          { value: 'Accessoires', label: '📦 Accessoires' },
        ],
      },
      {
        id: 'marqueElectronique',
        label: 'Marque',
        type: 'multiselect',
        options: [
          { value: 'Apple', label: '🍎 Apple' },
          { value: 'Samsung', label: 'Samsung' },
          { value: 'Huawei', label: 'Huawei' },
          { value: 'Xiaomi', label: 'Xiaomi' },
          { value: 'Sony', label: 'Sony' },
          { value: 'LG', label: 'LG' },
          { value: 'Panasonic', label: 'Panasonic' },
          { value: 'Canon', label: 'Canon' },
          { value: 'Nikon', label: 'Nikon' },
          { value: 'DJI', label: 'DJI' },
          { value: 'Bose', label: 'Bose' },
          { value: 'JBL', label: 'JBL' },
          { value: 'Beats', label: 'Beats' },
          { value: 'Anker', label: 'Anker' },
          { value: 'Belkin', label: 'Belkin' },
        ],
      },
      {
        id: 'etatElectronique',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf sous garantie', label: '🆕 Neuf sous garantie' },
          { value: 'Neuf sans garantie', label: '🆕 Neuf sans garantie' },
          { value: 'Reconditionné', label: '♻️ Reconditionné' },
          { value: 'Occasion - Excellent', label: '✨ Occasion - Excellent' },
          { value: 'Occasion - Bon', label: '👍 Occasion - Bon' },
          { value: 'Occasion - Moyen', label: '⚠️ Occasion - Moyen' },
          { value: 'Pour pièces', label: '🔧 Pour pièces' },
        ],
      },
      {
        id: 'connectiviteElectronique',
        label: 'Connectivité',
        type: 'multiselect',
        options: [
          { value: 'Wi-Fi', label: '📶 Wi-Fi' },
          { value: 'Bluetooth', label: '🔵 Bluetooth' },
          { value: '4G', label: '📱 4G' },
          { value: '5G', label: '📱 5G' },
          { value: 'NFC', label: '💳 NFC' },
          { value: 'USB-C', label: '🔌 USB-C' },
          { value: 'Lightning', label: '⚡ Lightning' },
          { value: 'HDMI', label: '🎬 HDMI' },
          { value: 'Jack 3.5mm', label: '🎧 Jack 3.5mm' },
          { value: 'USB', label: '🔌 USB' },
          { value: 'Ethernet', label: '🌐 Ethernet' },
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
    displayPriority: ['typeElectronique', 'marqueElectronique', 'etatElectronique', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    supportsVariants: true, // ✅ NOUVEAU: Support des variantes (couleur, stockage, etc.)
    searchKeywords: [
      // Appareils principaux
      'smartphone', 'telephone', 'mobil', 'portable', 'tel',
      'ordinateur', 'laptop', 'pc', 'computer',
      'tablette', 'ipad', 'tablet',
      'tele', 'tv', 'television',
      'drone', 'multirotor', 'quadcopter',
      'appareil photo', 'app photo', 'camera',
      'casque', 'ecouteur', 'airpods',
      'enceinte', 'speaker', 'haut parleur',
      'chargeur', 'charger', 'power bank',

      // Marques populaires Afrique
      'iphone', 'samsung galaxy', 'techno', 'infinix', 'itel',
      'sony', 'lg', 'xiaomi', 'huawei', 'oppo', 'vivo',

      // États
      'neuf', 'occasion', 'reconditionné', 'reconditionne',

      // Accessoires
      'etui', 'coque', 'pochette', 'support',
      'cable', 'adaptateur', 'clavier', 'souris',

      // Services
      'reparation', 'reparation', 'depannage',
      'installation', 'configuration',
    ],
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
      // ✅ FILTRE 1 : Catégorie principale
      {
        id: 'categorieInstrument',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'Instrument de musique', label: '🎵 Instrument de musique' },
          { value: 'Instrument traditionnel africain', label: '🥁 Instrument africain' },
          { value: 'Sonorisation & Sono', label: '🔊 Sonorisation' },
          { value: 'Matériel DJ', label: '🎧 Matériel DJ' },
          { value: 'Studio & Enregistrement', label: '🎙️ Studio' },
          { value: 'Accessoire musical', label: '🎸 Accessoires' },
        ],
      },

      // ✅ FILTRE 2 : Type d'instrument (enrichi)
      {
        id: 'typeInstrument',
        label: 'Type d\'instrument',
        type: 'select',
        options: [
          // Guitares & Cordes
          { value: 'Guitare acoustique', label: 'Guitare acoustique' },
          { value: 'Guitare électrique', label: 'Guitare électrique' },
          { value: 'Guitare classique', label: 'Guitare classique' },
          { value: 'Basse 4 cordes', label: 'Basse 4 cordes' },
          { value: 'Basse 5 cordes', label: 'Basse 5 cordes' },
          { value: 'Ukulélé', label: 'Ukulélé' },
          { value: 'Violon', label: 'Violon' },
          { value: 'Alto', label: 'Alto' },
          { value: 'Violoncelle', label: 'Violoncelle' },
          // Pianos & Claviers
          { value: 'Piano droit', label: 'Piano droit' },
          { value: 'Piano à queue', label: 'Piano à queue' },
          { value: 'Piano numérique', label: 'Piano numérique' },
          { value: 'Clavier arrangeur', label: 'Clavier arrangeur' },
          { value: 'Synthétiseur', label: 'Synthétiseur' },
          // Percussions
          { value: 'Batterie acoustique', label: 'Batterie acoustique' },
          { value: 'Batterie électronique', label: 'Batterie électronique' },
          // Vents
          { value: 'Saxophone alto', label: 'Saxophone alto' },
          { value: 'Saxophone ténor', label: 'Saxophone ténor' },
          { value: 'Trompette', label: 'Trompette' },
          { value: 'Flûte traversière', label: 'Flûte traversière' },
          { value: 'Clarinette', label: 'Clarinette' },
          // Instruments africains 🌍
          { value: 'Djembé', label: '🥁 Djembé' },
          { value: 'Balafon', label: '🥁 Balafon' },
          { value: 'Kora', label: '🎵 Kora' },
          { value: 'Tam-tam', label: '🥁 Tam-tam' },
          { value: 'Talking drum', label: '🥁 Talking drum' },
          { value: 'Ngoni', label: '🎵 Ngoni' },
          { value: 'Sanza/Kalimba', label: '🎵 Sanza/Kalimba' },
        ],
      },

      // ✅ FILTRE 3 : Marque (enrichi)
      {
        id: 'marqueInstrument',
        label: 'Marque',
        type: 'select',
        options: [
          // Guitares
          { value: 'Fender', label: 'Fender' },
          { value: 'Gibson', label: 'Gibson' },
          { value: 'Yamaha', label: 'Yamaha' },
          { value: 'Ibanez', label: 'Ibanez' },
          { value: 'Epiphone', label: 'Epiphone' },
          { value: 'Cort', label: 'Cort' },
          { value: 'Takamine', label: 'Takamine' },
          // Pianos & Claviers
          { value: 'Steinway & Sons', label: 'Steinway & Sons' },
          { value: 'Kawai', label: 'Kawai' },
          { value: 'Roland', label: 'Roland' },
          { value: 'Korg', label: 'Korg' },
          { value: 'Casio', label: 'Casio' },
          // Batteries
          { value: 'Pearl', label: 'Pearl' },
          { value: 'Tama', label: 'Tama' },
          { value: 'DW', label: 'DW (Drum Workshop)' },
          { value: 'Zildjian', label: 'Zildjian (cymbales)' },
          // Sono & DJ
          { value: 'JBL', label: 'JBL' },
          { value: 'Pioneer DJ', label: 'Pioneer DJ' },
          { value: 'Technics', label: 'Technics' },
          { value: 'QSC', label: 'QSC' },
          { value: 'Behringer', label: 'Behringer' },
          // Studio
          { value: 'Shure', label: 'Shure' },
          { value: 'Sennheiser', label: 'Sennheiser' },
          { value: 'Focusrite', label: 'Focusrite' },
          // Artisans locaux 🌍
          { value: 'Artisan local', label: '🌍 Artisan local' },
          { value: 'Fait main Afrique', label: '🌍 Fait main Afrique' },
        ],
      },

      // ✅ FILTRE 4 : État
      {
        id: 'etatInstrument',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf scellé', label: 'Neuf scellé' },
          { value: 'Neuf jamais utilisé', label: 'Neuf jamais utilisé' },
          { value: 'Comme neuf', label: 'Comme neuf' },
          { value: 'Excellent état', label: 'Excellent état' },
          { value: 'Très bon état', label: 'Très bon état' },
          { value: 'Bon état fonctionnel', label: 'Bon état' },
          { value: 'À réviser/Régler', label: 'À réviser' },
          { value: 'Vintage/Collection', label: 'Vintage/Collection' },
        ],
      },

      // ✅ FILTRE 5 : Niveau
      {
        id: 'niveauInstrument',
        label: 'Niveau',
        type: 'select',
        options: [
          { value: 'Débutant', label: 'Débutant' },
          { value: 'Intermédiaire', label: 'Intermédiaire' },
          { value: 'Avancé', label: 'Avancé' },
          { value: 'Professionnel', label: 'Professionnel' },
          { value: 'Concert/Scène', label: 'Concert/Scène' },
        ],
      },

      // ✅ FILTRE 6 : Matériau (multiselect enrichi)
      {
        id: 'materiauInstrument',
        label: 'Matériau',
        type: 'multiselect',
        options: [
          // Bois
          { value: 'Épicéa massif', label: 'Épicéa massif' },
          { value: 'Acajou', label: 'Acajou' },
          { value: 'Érable', label: 'Érable' },
          { value: 'Palissandre', label: 'Palissandre' },
          { value: 'Ébène', label: 'Ébène' },
          // Métaux
          { value: 'Laiton', label: 'Laiton' },
          { value: 'Bronze', label: 'Bronze' },
          { value: 'Acier', label: 'Acier' },
          // Traditionnels africains 🌍
          { value: 'Calebasse', label: '🌍 Calebasse' },
          { value: 'Peau de chèvre', label: '🌍 Peau de chèvre' },
          { value: 'Bambou', label: '🌍 Bambou' },
          // Modernes
          { value: 'Plastique ABS', label: 'Plastique ABS' },
          { value: 'Fibre de carbone', label: 'Fibre de carbone' },
        ],
      },

      // ✅ FILTRE 7 : Utilisation
      {
        id: 'utilisationInstrument',
        label: 'Utilisation',
        type: 'select',
        options: [
          { value: 'Apprentissage', label: 'Apprentissage' },
          { value: 'Pratique maison', label: 'Pratique maison' },
          { value: 'Cours de musique', label: 'Cours de musique' },
          { value: 'Concert/Scène', label: 'Concert/Scène' },
          { value: 'Studio enregistrement', label: 'Studio' },
          { value: 'Église/Culte', label: 'Église/Culte' },
          { value: 'Animation événement', label: 'Animation événement' },
          { value: 'DJ soirée', label: 'DJ soirée' },
          { value: 'Mariage', label: 'Mariage' },
        ],
      },

      // ✅ FILTRE 8 : Genre musical
      {
        id: 'genreMusical',
        label: 'Genre musical',
        type: 'select',
        options: [
          // Genres internationaux
          { value: 'Classique', label: 'Classique' },
          { value: 'Jazz', label: 'Jazz' },
          { value: 'Blues', label: 'Blues' },
          { value: 'Rock', label: 'Rock' },
          { value: 'Pop', label: 'Pop' },
          { value: 'Reggae', label: 'Reggae' },
          { value: 'Hip-hop', label: 'Hip-hop' },
          { value: 'R&B', label: 'R&B' },
          // Genres africains 🌍
          { value: 'Afrobeat', label: '🌍 Afrobeat' },
          { value: 'Afro-pop', label: '🌍 Afro-pop' },
          { value: 'Makossa', label: '🌍 Makossa' },
          { value: 'Bikutsi', label: '🌍 Bikutsi' },
          { value: 'Coupé-décalé', label: '🌍 Coupé-décalé' },
          { value: 'Zouglou', label: '🌍 Zouglou' },
          { value: 'Ndombolo', label: '🌍 Ndombolo' },
          { value: 'Mbalax', label: '🌍 Mbalax' },
          { value: 'Highlife', label: '🌍 Highlife' },
          { value: 'Musique traditionnelle', label: '🌍 Traditionnelle' },
          { value: 'Gospel africain', label: '🌍 Gospel africain' },
        ],
      },

      // ✅ FILTRE 9 : Nombre de cordes
      {
        id: 'nombreCordes',
        label: 'Nombre de cordes',
        type: 'select',
        options: [
          { value: '4', label: '4 cordes' },
          { value: '5', label: '5 cordes' },
          { value: '6', label: '6 cordes' },
          { value: '7', label: '7 cordes' },
          { value: '12', label: '12 cordes' },
          { value: '21', label: '21 cordes (Kora)' },
        ],
      },

      // ✅ FILTRE 10 : Taille
      {
        id: 'tailleInstrument',
        label: 'Taille',
        type: 'select',
        options: [
          // Violon/Alto
          { value: '4/4', label: '4/4 (adulte)' },
          { value: '3/4', label: '3/4 (ado)' },
          { value: '1/2', label: '1/2 (enfant)' },
          { value: '1/4', label: '1/4 (jeune enfant)' },
          // Guitares
          { value: 'Dreadnought', label: 'Dreadnought' },
          { value: 'Jumbo', label: 'Jumbo' },
          { value: 'Concert', label: 'Concert' },
          // Djembé
          { value: '10 pouces', label: '10 pouces (25 cm)' },
          { value: '12 pouces', label: '12 pouces (30 cm)' },
          { value: '14 pouces', label: '14 pouces (35 cm)' },
        ],
      },

      // ✅ FILTRE 11 : Garantie
      {
        id: 'garantieInstrument',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: '3 mois', label: '3 mois' },
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
          { value: '3 ans', label: '3 ans' },
          { value: '5 ans', label: '5 ans' },
          { value: 'Garantie constructeur', label: 'Garantie constructeur' },
        ],
      },

      // ✅ FILTRE 12 : Origine/Fabrication
      {
        id: 'origineInstrument',
        label: 'Origine',
        type: 'select',
        options: [
          // Asie
          { value: 'Japon', label: 'Japon' },
          { value: 'Chine', label: 'Chine' },
          { value: 'Corée du Sud', label: 'Corée du Sud' },
          { value: 'Indonésie', label: 'Indonésie' },
          // Europe
          { value: 'Allemagne', label: 'Allemagne' },
          { value: 'France', label: 'France' },
          { value: 'Italie', label: 'Italie' },
          { value: 'Espagne', label: 'Espagne' },
          // Amériques
          { value: 'États-Unis', label: 'États-Unis' },
          { value: 'Mexique', label: 'Mexique' },
          // Afrique 🌍
          { value: 'Sénégal', label: '🌍 Sénégal' },
          { value: 'Mali', label: '🌍 Mali' },
          { value: 'Guinée', label: '🌍 Guinée' },
          { value: 'Cameroun', label: '🌍 Cameroun' },
          { value: 'Burkina Faso', label: '🌍 Burkina Faso' },
          { value: 'Côte d\'Ivoire', label: '🌍 Côte d\'Ivoire' },
          { value: 'Ghana', label: '🌍 Ghana' },
          { value: 'Artisanat africain', label: '🌍 Artisanat africain' },
          { value: 'Fait main local', label: '🌍 Fait main local' },
        ],
      },

      // ✅ FILTRE 13 : Facture disponible (toggle)
      {
        id: 'facture',
        label: 'Facture disponible',
        type: 'toggle',
      },

      // ✅ FILTRE 14 : Révision récente (toggle)
      {
        id: 'revisionRecente',
        label: 'Révision récente',
        type: 'toggle',
      },

      // ✅ FILTRE 15 : Année de fabrication (range)
      {
        id: 'anneeInstrument',
        label: 'Année de fabrication',
        type: 'range',
        min: 1950,
        max: 2025,
        unit: '',
      },
    ],
    style: {
      primaryColor: '#9C27B0',
      gradientColors: ['#9C27B0', '#7B1FA2'],
      icon: '🎸',
      badgeColor: '#F3E5F5',
      accentColor: '#7B1FA2',
    },
    displayPriority: ['typeInstrument', 'marqueInstrument', 'modeleInstrument', 'niveauInstrument', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // ════════════════════════════════════════════════════════════
  // 🛡️ SÉCURITÉ & SURVEILLANCE - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
  // ════════════════════════════════════════════════════════════
  // Gardiennage, Caméras surveillance, Alarmes, Agents de sécurité,
  // Contrôle d'accès, Sécurité événementielle, Maîtres-chiens
  // ════════════════════════════════════════════════════════════
  securite_surveillance: {
    terminology: {
      productLabel: 'Service de sécurité',
      productsLabel: 'Sécurité & Surveillance',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Entreprise de sécurité',
      searchPlaceholder: 'Rechercher gardiennage, caméras, alarme, agent sécurité...',
      emptyMessage: 'Aucun service de sécurité disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },

    // ✅ 22 FILTRES INTELLIGENTS CONTEXTE AFRICAIN
    filters: [
      // ✅ FILTRE 1 : Type de service (30+ options) - Multiselect
      {
        id: 'typeServiceSecurite',
        label: 'Type de service',
        type: 'multiselect',
        options: [
          // 🔥 Services humains (très demandés en Afrique)
          { value: 'Gardiennage résidentiel (villa, maison)', label: '👮 Gardiennage résidentiel' },
          { value: 'Gardiennage commercial (boutique, magasin)', label: '👮 Gardiennage commercial' },
          { value: 'Gardiennage industriel (usine, entrepôt)', label: '👮 Gardiennage industriel' },
          { value: 'Agent de sécurité qualifié', label: '🛡️ Agent de sécurité' },
          { value: 'Vigile armé', label: '🔫 Vigile armé' },
          { value: 'Maître-chien (avec chien dressé)', label: '🐕 Maître-chien' },
          { value: 'Sécurité événementielle (mariage, concert)', label: '🎉 Sécurité événementielle' },
          { value: 'Garde du corps / Protection rapprochée', label: '🕴️ Garde du corps' },
          { value: 'Convoyage de fonds', label: '💰 Convoyage de fonds' },
          { value: 'Ronde de surveillance', label: '🚶 Ronde surveillance' },

          // 📹 Vidéosurveillance
          { value: 'Installation caméras surveillance', label: '📹 Installation caméras' },
          { value: 'Maintenance système vidéosurveillance', label: '🔧 Maintenance caméras' },
          { value: 'Centrale de télésurveillance 24h/24', label: '🖥️ Télésurveillance' },
          { value: 'Location caméras surveillance', label: '📹 Location caméras' },

          // 🚨 Alarmes & Contrôle d'accès
          { value: 'Installation système alarme', label: '🚨 Installation alarme' },
          { value: 'Alarme anti-intrusion', label: '🚨 Alarme anti-intrusion' },
          { value: 'Alarme incendie', label: '🔥 Alarme incendie' },
          { value: 'Contrôle d\'accès (badge, biométrie)', label: '🔐 Contrôle accès' },
          { value: 'Barrière automatique / Portail sécurisé', label: '🚧 Barrière automatique' },
          { value: 'Interphone vidéo / Visiophone', label: '📞 Interphone vidéo' },

          // 🔒 Consulting & Formation
          { value: 'Audit de sécurité', label: '📋 Audit sécurité' },
          { value: 'Consulting sécurité', label: '💼 Consulting' },
          { value: 'Formation agents de sécurité', label: '🎓 Formation agents' },
          { value: 'Analyse des risques', label: '⚠️ Analyse risques' },
        ],
      },

      // ✅ FILTRE 2 : Type de client (8 options)
      {
        id: 'typeClientSecurite',
        label: 'Type de client',
        type: 'multiselect',
        options: [
          { value: 'Particuliers (maisons, villas)', label: '🏠 Particuliers' },
          { value: 'Commerces (boutiques, magasins)', label: '🏪 Commerces' },
          { value: 'Entreprises (bureaux, sièges)', label: '🏢 Entreprises' },
          { value: 'Industries (usines, entrepôts)', label: '🏭 Industries' },
          { value: 'Hôtels & Résidences', label: '🏨 Hôtels' },
          { value: 'Événements (mariages, concerts)', label: '🎉 Événements' },
          { value: 'Administrations publiques', label: '🏛️ Administrations' },
          { value: 'Banques & Institutions financières', label: '🏦 Banques' },
        ],
      },

      // ✅ FILTRE 3 : Disponibilité (10 options)
      {
        id: 'disponibiliteSecurite',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Service 24h/24 - 7j/7', label: '🌙 24h/24 - 7j/7' },
          { value: 'Journée uniquement (6h-18h)', label: '☀️ Journée (6h-18h)' },
          { value: 'Nuit uniquement (18h-6h)', label: '🌙 Nuit (18h-6h)' },
          { value: 'Ronde périodique (2-4 passages/jour)', label: '🔄 Ronde périodique' },
          { value: 'Week-end uniquement', label: '📅 Week-end' },
          { value: 'Intervention sur appel', label: '📞 Sur appel' },
          { value: 'Événements ponctuels', label: '🎉 Événements' },
          { value: 'Horaires flexibles (à définir)', label: '⏰ Horaires flexibles' },
        ],
      },

      // ✅ FILTRE 4 : Type d'équipement caméra (12+ options)
      {
        id: 'typeCameraSecurite',
        label: 'Type de caméra',
        type: 'multiselect',
        options: [
          { value: 'Caméra dôme intérieur', label: '📹 Dôme intérieur' },
          { value: 'Caméra bullet extérieur', label: '📹 Bullet extérieur' },
          { value: 'Caméra PTZ motorisée (360°)', label: '🔄 PTZ motorisée' },
          { value: 'Caméra vision nocturne infrarouge', label: '🌙 Vision nocturne' },
          { value: 'Caméra IP (réseau Ethernet/WiFi)', label: '🌐 Caméra IP' },
          { value: 'Caméra analogique HD (AHD/TVI)', label: '📺 Analogique HD' },
          { value: 'Caméra 4K ultra haute résolution', label: '🎬 4K UHD' },
          { value: 'Caméra avec détection de mouvement', label: '🚶 Détection mouvement' },
          { value: 'Caméra avec audio bidirectionnel', label: '🔊 Audio bidirectionnel' },
          { value: 'Caméra sans fil (batterie solaire)', label: '☀️ Sans fil solaire' },
          { value: 'Caméra thermique', label: '🌡️ Thermique' },
          { value: 'Sonnette vidéo intelligente', label: '🔔 Sonnette vidéo' },
        ],
      },

      // ✅ FILTRE 5 : Résolution caméra (8 options)
      {
        id: 'resolutionCamera',
        label: 'Résolution caméra',
        type: 'select',
        options: [
          { value: '720p (1MP) - Basique', label: '720p (1MP)' },
          { value: '1080p (2MP) - Full HD', label: '1080p (2MP) ⭐' },
          { value: '3MP - Super HD', label: '3MP' },
          { value: '4MP - 2K', label: '4MP (2K)' },
          { value: '5MP - 2.5K', label: '5MP (2.5K)' },
          { value: '8MP (4K) - Ultra HD', label: '8MP (4K) 🔥' },
          { value: '12MP+', label: '12MP+' },
        ],
      },

      // ✅ FILTRE 6 : Stockage vidéo (10 options)
      {
        id: 'stockageVideo',
        label: 'Stockage vidéo',
        type: 'select',
        options: [
          { value: 'DVR (enregistreur analogique)', label: 'DVR Analogique' },
          { value: 'NVR (enregistreur IP)', label: 'NVR IP' },
          { value: 'Cloud sécurisé (stockage en ligne)', label: '☁️ Cloud' },
          { value: 'Carte SD locale', label: '💾 Carte SD' },
          { value: 'Disque dur 500GB', label: '💿 500GB' },
          { value: 'Disque dur 1TB', label: '💿 1TB' },
          { value: 'Disque dur 2TB', label: '💿 2TB' },
          { value: 'Disque dur 4TB+', label: '💿 4TB+' },
          { value: 'Rétention 7 jours', label: '📅 7 jours' },
          { value: 'Rétention 30 jours', label: '📅 30 jours' },
        ],
      },

      // ✅ FILTRE 7 : Type alarme (12+ options)
      {
        id: 'typeAlarme',
        label: 'Type d\'alarme',
        type: 'multiselect',
        options: [
          { value: 'Alarme anti-intrusion filaire', label: '🔌 Anti-intrusion filaire' },
          { value: 'Alarme anti-intrusion sans fil', label: '📡 Anti-intrusion sans fil' },
          { value: 'Alarme GSM (alerte SMS)', label: '📱 Alarme GSM/SMS' },
          { value: 'Alarme connectée (app smartphone)', label: '📲 Alarme connectée' },
          { value: 'Détecteur de mouvement infrarouge', label: '🚶 Détecteur mouvement' },
          { value: 'Détecteur d\'ouverture (porte/fenêtre)', label: '🚪 Détecteur ouverture' },
          { value: 'Détecteur de choc/vibration', label: '💥 Détecteur choc' },
          { value: 'Sirène extérieure puissante (120dB)', label: '🔊 Sirène 120dB' },
          { value: 'Sirène intérieure', label: '🔔 Sirène intérieure' },
          { value: 'Télécommande/Badge d\'activation', label: '🎛️ Télécommande' },
          { value: 'Alarme incendie/fumée', label: '🔥 Alarme incendie' },
          { value: 'Alarme inondation', label: '💧 Alarme inondation' },
        ],
      },

      // ✅ FILTRE 8 : Contrôle d'accès (10+ options)
      {
        id: 'controleAcces',
        label: 'Contrôle d\'accès',
        type: 'multiselect',
        options: [
          { value: 'Badge RFID', label: '🎫 Badge RFID' },
          { value: 'Lecteur biométrique empreintes', label: '👆 Empreintes digitales' },
          { value: 'Reconnaissance faciale', label: '👤 Reconnaissance faciale' },
          { value: 'Code PIN / Clavier', label: '🔢 Code PIN' },
          { value: 'Carte magnétique', label: '💳 Carte magnétique' },
          { value: 'QR Code / NFC', label: '📱 QR Code/NFC' },
          { value: 'Barrière automatique véhicules', label: '🚧 Barrière véhicules' },
          { value: 'Portillon piéton automatique', label: '🚶 Portillon piéton' },
          { value: 'Interphone vidéo', label: '📞 Interphone vidéo' },
          { value: 'Gestion visiteurs', label: '📋 Gestion visiteurs' },
        ],
      },

      // ✅ FILTRE 9 : Nombre d'agents (8 options)
      {
        id: 'nombreAgents',
        label: 'Nombre d\'agents',
        type: 'select',
        options: [
          { value: '1 agent', label: '1 agent' },
          { value: '2 agents', label: '2 agents' },
          { value: '3-5 agents', label: '3-5 agents' },
          { value: '6-10 agents', label: '6-10 agents' },
          { value: '11-20 agents', label: '11-20 agents' },
          { value: '20+ agents', label: '20+ agents' },
          { value: 'Équipe roulante (relais)', label: 'Équipe roulante' },
        ],
      },

      // ✅ FILTRE 10 : Armement agents (5 options)
      {
        id: 'armementAgents',
        label: 'Armement',
        type: 'select',
        options: [
          { value: 'Agents non armés', label: 'Non armés' },
          { value: 'Agents armés (arme de poing)', label: 'Armés (arme de poing)' },
          { value: 'Agents avec matraque/bâton', label: 'Matraque/Bâton' },
          { value: 'Agents avec chiens dressés', label: '🐕 Avec chiens' },
          { value: 'Équipement protection (gilet pare-balles)', label: '🦺 Gilet pare-balles' },
        ],
      },

      // ✅ FILTRE 11 : Certifications entreprise (12+ options)
      {
        id: 'certificationsSecurite',
        label: 'Certifications',
        type: 'multiselect',
        options: [
          { value: 'Agrément Ministère Sécurité', label: '✅ Agrément Ministère' },
          { value: 'Licence professionnelle sécurité privée', label: '📜 Licence pro' },
          { value: 'ISO 9001 (Qualité)', label: '🏆 ISO 9001' },
          { value: 'Formation pompiers/incendie', label: '🔥 Formation incendie' },
          { value: 'Formation premiers secours', label: '⚕️ Premiers secours' },
          { value: 'Assurance responsabilité civile', label: '🛡️ Assurance RC' },
          { value: 'Membres association sécurité nationale', label: '🤝 Association nationale' },
          { value: 'Expérience 5+ ans', label: '⭐ Expérience 5+ ans' },
          { value: 'Expérience 10+ ans', label: '⭐ Expérience 10+ ans' },
          { value: 'Anciens militaires/policiers', label: '🎖️ Ex-militaires' },
        ],
      },

      // ✅ FILTRE 12 : Durée contrat (10 options)
      {
        id: 'dureeContratSecurite',
        label: 'Durée du contrat',
        type: 'select',
        options: [
          { value: 'Intervention ponctuelle (1 jour)', label: '1 jour' },
          { value: 'Week-end (2-3 jours)', label: 'Week-end' },
          { value: '1 semaine', label: '1 semaine' },
          { value: '1 mois', label: '1 mois' },
          { value: '3 mois', label: '3 mois' },
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
          { value: 'Longue durée (3+ ans)', label: 'Longue durée' },
          { value: 'Contrat flexible (renouvelable)', label: 'Flexible' },
        ],
      },

      // ✅ FILTRE 13 : Zone intervention (toggle)
      {
        id: 'interventionRapide',
        label: 'Intervention rapide',
        type: 'toggle',
      },

      // ✅ FILTRE 14 : Service 24h/24 (toggle)
      {
        id: 'service24h7j',
        label: 'Service 24h/24 - 7j/7',
        type: 'toggle',
      },

      // ✅ FILTRE 15 : Télésurveillance (toggle)
      {
        id: 'telesurveillance',
        label: 'Télésurveillance incluse',
        type: 'toggle',
      },

      // ✅ FILTRE 16 : Installation incluse (toggle)
      {
        id: 'installationIncluse',
        label: 'Installation équipements incluse',
        type: 'toggle',
      },

      // ✅ FILTRE 17 : Maintenance incluse (toggle)
      {
        id: 'maintenanceIncluse',
        label: 'Maintenance incluse',
        type: 'toggle',
      },

      // ✅ FILTRE 18 : Devis gratuit (toggle)
      {
        id: 'devisGratuit',
        label: 'Devis et audit gratuits',
        type: 'toggle',
      },

      // ✅ FILTRE 19 : Garantie équipement (8 options)
      {
        id: 'garantieEquipement',
        label: 'Garantie équipements',
        type: 'select',
        options: [
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an ⭐' },
          { value: '2 ans', label: '2 ans' },
          { value: '3 ans', label: '3 ans' },
          { value: '5 ans', label: '5 ans' },
          { value: 'Garantie à vie pièces', label: 'À vie (pièces)' },
          { value: 'Pas de garantie', label: 'Pas de garantie' },
        ],
      },

      // ✅ FILTRE 20 : Marques équipements (15+ marques)
      {
        id: 'marquesEquipements',
        label: 'Marques équipements',
        type: 'multiselect',
        options: [
          // Caméras (marques présentes en Afrique)
          { value: 'Hikvision', label: 'Hikvision 🔥' },
          { value: 'Dahua', label: 'Dahua ⭐' },
          { value: 'Axis', label: 'Axis' },
          { value: 'Uniview', label: 'Uniview' },
          { value: 'Samsung', label: 'Samsung' },
          { value: 'Bosch', label: 'Bosch' },
          { value: 'Honeywell', label: 'Honeywell' },
          // Alarmes
          { value: 'Paradox', label: 'Paradox' },
          { value: 'DSC', label: 'DSC' },
          { value: 'Ajax', label: 'Ajax' },
          { value: 'Somfy', label: 'Somfy' },
          { value: 'Risco', label: 'Risco' },
          // Contrôle d'accès
          { value: 'ZKTeco', label: 'ZKTeco' },
          { value: 'HID Global', label: 'HID Global' },
          { value: 'CAME', label: 'CAME' },
        ],
      },

      // ✅ FILTRE 21 : Alimentation électrique (8 options)
      {
        id: 'alimentationElectrique',
        label: 'Alimentation',
        type: 'multiselect',
        options: [
          { value: 'Secteur 220V', label: '🔌 Secteur 220V' },
          { value: 'Batterie de secours (UPS)', label: '🔋 Batterie secours' },
          { value: 'Panneaux solaires', label: '☀️ Solaire' },
          { value: 'Autonomie 24h', label: '⏰ Autonomie 24h' },
          { value: 'Autonomie 48h', label: '⏰ Autonomie 48h' },
          { value: 'Générateur de secours', label: '⚡ Générateur' },
          { value: 'PoE (Power over Ethernet)', label: '🌐 PoE' },
        ],
      },

      // ✅ FILTRE 22 : Application mobile (toggle)
      {
        id: 'applicationMobile',
        label: 'Application mobile de suivi',
        type: 'toggle',
      },
    ],

    style: {
      primaryColor: '#DC2626',
      gradientColors: ['#DC2626', '#B91C1C'],
      icon: '🛡️',
      badgeColor: '#FEE2E2',
      accentColor: '#B91C1C',
    },

    displayPriority: [
      'typeServiceSecurite',
      'disponibiliteSecurite',
      'nombreAgents',
      'service24h7j',
      'certificationsSecurite',
      'typeCameraSecurite',
      'resolutionCamera',
      'typeAlarme',
      'controleAcces',
      'prix'
    ],

    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    supportsVariants: false, // Pas de variantes pour sécurité/surveillance

    // ✅ MOTS-CLÉS AFRICAINS POUR RECHERCHE (100+)
    searchKeywords: [
      // Services généraux
      'sécurité', 'securite', 'surveillance', 'gardiennage', 'garde', 'vigile',
      'agent de sécurité', 'agent securite', 'gardien', 'watchman', 'security',

      // Gardiennage
      'gardien de nuit', 'gardien résidentiel', 'gardien immeuble', 'gardien villa',
      'gardien boutique', 'gardien magasin', 'gardien usine', 'gardien parking',
      'service de garde', 'société de gardiennage', 'entreprise sécurité',

      // Agents
      'vigile armé', 'vigile non armé', 'agent qualifié', 'veilleur de nuit',
      'maître-chien', 'maitre-chien', 'chien de garde', 'garde du corps',
      'protection rapprochée', 'escorte sécurité', 'convoyage fonds',

      // Caméras
      'caméra', 'camera', 'caméra surveillance', 'camera surveillance',
      'vidéosurveillance', 'videosurveillance', 'CCTV', 'télésurveillance',
      'caméra IP', 'caméra wifi', 'caméra sans fil', 'caméra infrarouge',
      'caméra vision nocturne', 'caméra extérieur', 'caméra intérieur',
      'caméra dôme', 'caméra bullet', 'caméra PTZ', 'caméra 360',
      'installation caméra', 'installation camera', 'pose caméra',

      // Résolutions
      '720p', '1080p', 'Full HD', '2MP', '4MP', '5MP', '4K', '8MP',
      'haute résolution', 'haute resolution', 'HD', 'UHD',

      // Enregistrement
      'DVR', 'NVR', 'enregistreur vidéo', 'stockage vidéo', 'cloud',
      'disque dur', 'carte SD', 'enregistrement 24h', 'historique vidéo',

      // Alarmes
      'alarme', 'système alarme', 'systeme alarme', 'alarme maison',
      'alarme anti-intrusion', 'alarme antivol', 'alarme GSM',
      'alarme sans fil', 'alarme filaire', 'alarme connectée',
      'détecteur mouvement', 'detecteur mouvement', 'détecteur intrusion',
      'détecteur fumée', 'detecteur fumee', 'alarme incendie',
      'sirène', 'sirene', 'sirène extérieure', 'sirène intérieure',
      'centrale alarme', 'installation alarme', 'pose alarme',

      // Contrôle d'accès
      'contrôle accès', 'controle acces', 'badge', 'badge RFID',
      'lecteur biométrique', 'lecteur biometrique', 'empreinte digitale',
      'reconnaissance faciale', 'code PIN', 'digicode', 'clavier code',
      'carte magnétique', 'carte magnetique', 'barrière automatique',
      'barriere automatique', 'portail automatique', 'portillon',
      'interphone', 'interphone vidéo', 'interphone video', 'visiophone',
      'sonnette vidéo', 'sonnette video', 'vidéophone', 'videophone',

      // Événementiel
      'sécurité événement', 'securite evenement', 'sécurité mariage',
      'sécurité concert', 'securite concert', 'sécurité conférence',
      'sécurité festival', 'service ordre', 'équipe sécurité',

      // Contexte africain
      'sécurité Cameroun', 'securite Cameroun', 'gardiennage Douala',
      'gardiennage Yaoundé', 'gardiennage Yaounde', 'vigile Douala',
      'vigile Yaoundé', 'caméra Cameroun', 'alarme Douala',
      'sécurité Côte d\'Ivoire', 'gardiennage Abidjan', 'vigile Abidjan',
      'sécurité Sénégal', 'gardiennage Dakar', 'vigile Dakar',
      'sécurité Gabon', 'gardiennage Libreville',
      'sécurité Congo', 'gardiennage Brazzaville', 'gardiennage Kinshasa',

      // Services spécialisés
      'audit sécurité', 'audit securite', 'consultant sécurité',
      'étude sécurité', 'etude securite', 'analyse risques',
      'plan sécurité', 'plan securite', 'formation sécurité',
      'formation agents', 'ronde sécurité', 'ronde surveillance',

      // Équipements
      'équipement sécurité', 'equipement securite', 'matériel surveillance',
      'kit alarme', 'kit caméra', 'pack sécurité', 'pack surveillance',
      'système complet', 'systeme complet', 'solution sécurité',

      // Marques
      'Hikvision', 'Dahua', 'Axis', 'Samsung', 'Bosch', 'Paradox',
      'DSC', 'Ajax', 'ZKTeco', 'Honeywell', 'Uniview',

      // Urgences
      'urgence', 'intervention rapide', '24h/24', '7j/7',
      'disponible maintenant', 'service urgent', 'garde immédiate',
    ],
  },

  // 🧘 BIEN-ÊTRE & SPA
  bien_etre: {
    terminology: {
      productLabel: 'Service bien-être',
      productsLabel: 'Bien-être & Spa',
      priceLabel: 'Tarif',
      locationLabel: 'Centre',
      providerLabel: 'Praticien',
      searchPlaceholder: 'Rechercher massage, spa...',
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
        id: 'typeBienEtre',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'Massage', label: 'Massage' },
          { value: 'Spa', label: 'Spa' },
          { value: 'Yoga', label: 'Yoga' },
          { value: 'Méditation', label: 'Méditation' },
          { value: 'Hammam', label: 'Hammam' },
        ],
      },
      {
        id: 'dureeSoins',
        label: 'Durée',
        type: 'select',
        options: [
          { value: '30min', label: '30 min' },
          { value: '1h', label: '1 heure' },
          { value: '1h30', label: '1h30' },
          { value: '2h', label: '2 heures' },
          { value: '3h', label: '3 heures' },
        ],
      },
      {
        id: 'packageDispo',
        label: 'Package disponible',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#10B981',
      gradientColors: ['#10B981', '#059669'],
      icon: '🧘',
      badgeColor: '#D1FAE5',
      accentColor: '#059669',
    },
    displayPriority: ['typeBienEtre', 'dureeSoins', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 💄 SANTÉ & BEAUTÉ
  sante_beaute: {
    terminology: {
      productLabel: 'Produit beauté/santé',
      productsLabel: 'Santé & Beauté',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher produits...',
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
        id: 'typeProduitBeaute',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'Soins visage', label: 'Soins visage' },
          { value: 'Soins corps', label: 'Soins corps' },
          { value: 'Soins cheveux', label: 'Soins cheveux' },
          { value: 'Maquillage', label: 'Maquillage' },
          { value: 'Parfums', label: 'Parfums' },
        ],
      },
      {
        id: 'marqueBeaute',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Nivea', label: 'Nivea' },
          { value: 'L\'Oréal', label: 'L\'Oréal' },
          { value: 'Garnier', label: 'Garnier' },
          { value: 'Dove', label: 'Dove' },
        ],
      },
    ],
    style: {
      primaryColor: '#EC4899',
      gradientColors: ['#EC4899', '#DB2777'],
      icon: '💄',
      badgeColor: '#FCE7F3',
      accentColor: '#DB2777',
    },
    displayPriority: ['typeProduitBeaute', 'marqueBeaute', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // ⚖️ JURIDIQUE
  juridique: {
    terminology: {
      productLabel: 'Service juridique',
      productsLabel: 'Services juridiques',
      priceLabel: 'Tarif',
      locationLabel: 'Cabinet',
      providerLabel: 'Avocat',
      searchPlaceholder: 'Rechercher avocat, service...',
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
        id: 'typeServiceJuridique',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'Conseil juridique', label: 'Conseil' },
          { value: 'Rédaction contrat', label: 'Rédaction' },
          { value: 'Contentieux', label: 'Contentieux' },
          { value: 'Divorce', label: 'Divorce' },
        ],
      },
      {
        id: 'specialiteJuridique',
        label: 'Spécialité',
        type: 'select',
        options: [
          { value: 'Droit des affaires', label: 'Affaires' },
          { value: 'Droit du travail', label: 'Travail' },
          { value: 'Droit de la famille', label: 'Famille' },
          { value: 'Droit immobilier', label: 'Immobilier' },
        ],
      },
    ],
    style: {
      primaryColor: '#0891B2',
      gradientColors: ['#0891B2', '#0E7490'],
      icon: '⚖️',
      badgeColor: '#CFFAFE',
      accentColor: '#0E7490',
    },
    displayPriority: ['typeServiceJuridique', 'specialiteJuridique', 'prix'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🎵 MUSIQUE SERVICES
  musique_services: {
    terminology: {
      productLabel: 'Service musical',
      productsLabel: 'Musique & Animation',
      priceLabel: 'Tarif',
      locationLabel: 'Zone',
      providerLabel: 'Artiste',
      searchPlaceholder: 'Rechercher DJ, musicien...',
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
        id: 'typeServiceMusical',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'DJ', label: 'DJ' },
          { value: 'Animation musicale', label: 'Animation' },
          { value: 'Groupe live', label: 'Groupe live' },
          { value: 'Cours de musique', label: 'Cours' },
        ],
      },
      {
        id: 'genreMusical',
        label: 'Genre',
        type: 'select',
        options: [
          { value: 'Variété', label: 'Variété' },
          { value: 'Afrobeat', label: 'Afrobeat' },
          { value: 'Makossa', label: 'Makossa' },
          { value: 'Jazz', label: 'Jazz' },
        ],
      },
    ],
    style: {
      primaryColor: '#8B5CF6',
      gradientColors: ['#8B5CF6', '#7C3AED'],
      icon: '🎵',
      badgeColor: '#EDE9FE',
      accentColor: '#7C3AED',
    },
    displayPriority: ['typeServiceMusical', 'genreMusical', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 📷 PHOTOGRAPHIE
  photographie: {
    terminology: {
      productLabel: 'Service photo',
      productsLabel: 'Photographie',
      priceLabel: 'Tarif',
      locationLabel: 'Zone',
      providerLabel: 'Photographe',
      searchPlaceholder: 'Rechercher photographe...',
      emptyMessage: 'Aucun photographe disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typePhotoService',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'Mariage', label: 'Mariage' },
          { value: 'Événement', label: 'Événement' },
          { value: 'Portrait', label: 'Portrait' },
          { value: 'Commercial', label: 'Commercial' },
        ],
      },
      {
        id: 'stylePhoto',
        label: 'Style',
        type: 'select',
        options: [
          { value: 'Classique', label: 'Classique' },
          { value: 'Moderne', label: 'Moderne' },
          { value: 'Artistique', label: 'Artistique' },
        ],
      },
    ],
    style: {
      primaryColor: '#F59E0B',
      gradientColors: ['#F59E0B', '#D97706'],
      icon: '📷',
      badgeColor: '#FEF3C7',
      accentColor: '#D97706',
    },
    displayPriority: ['typePhotoService', 'stylePhoto', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🏭 ENTREPRISE & INDUSTRIE
  entreprise_industrie: {
    terminology: {
      productLabel: 'Équipement pro',
      productsLabel: 'Entreprise & Industrie',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher équipement...',
      emptyMessage: 'Aucun équipement disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeEntreprise',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'Matériel bureau', label: 'Matériel bureau' },
          { value: 'Machines industrielles', label: 'Machines' },
          { value: 'Équipement professionnel', label: 'Équipement pro' },
        ],
      },
      {
        id: 'secteurActivite',
        label: 'Secteur',
        type: 'select',
        options: [
          { value: 'Industrie', label: 'Industrie' },
          { value: 'Commerce', label: 'Commerce' },
          { value: 'BTP', label: 'BTP' },
        ],
      },
    ],
    style: {
      primaryColor: '#64748B',
      gradientColors: ['#64748B', '#475569'],
      icon: '🏭',
      badgeColor: '#F1F5F9',
      accentColor: '#475569',
    },
    displayPriority: ['typeEntreprise', 'secteurActivite', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },


  // 👶 ENFANTS & BÉBÉS
  enfants_bebes: {
    terminology: {
      productLabel: 'Article enfant/bébé',
      productsLabel: 'Enfants & Bébés',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher vêtements, jouets...',
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
        id: 'categorieEnfant',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'Vêtements bébé', label: 'Vêtements bébé' },
          { value: 'Vêtements enfant', label: 'Vêtements enfant' },
          { value: 'Chaussures', label: 'Chaussures' },
          { value: 'Poussettes', label: 'Poussettes' },
          { value: 'Sièges auto', label: 'Sièges auto' },
          { value: 'Lits & berceaux', label: 'Lits & berceaux' },
          { value: 'Jouets', label: 'Jouets' },
        ],
      },
      {
        id: 'ageRecommande',
        label: 'Âge',
        type: 'select',
        options: [
          { value: '0-3 mois', label: '0-3 mois' },
          { value: '3-6 mois', label: '3-6 mois' },
          { value: '6-12 mois', label: '6-12 mois' },
          { value: '1-2 ans', label: '1-2 ans' },
          { value: '2-4 ans', label: '2-4 ans' },
          { value: '4-6 ans', label: '4-6 ans' },
        ],
      },
      {
        id: 'etatEnfant',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf avec étiquette', label: 'Neuf avec étiquette' },
          { value: 'Neuf', label: 'Neuf' },
          { value: 'Excellent état', label: 'Excellent état' },
          { value: 'Bon état', label: 'Bon état' },
        ],
      },
    ],
    style: {
      primaryColor: '#EC4899',
      gradientColors: ['#EC4899', '#DB2777'],
      icon: '👶',
      badgeColor: '#FCE7F3',
      accentColor: '#DB2777',
    },
    displayPriority: ['categorieEnfant', 'ageRecommande', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🔨 BRICOLAGE
  bricolage: {
    terminology: {
      productLabel: 'Article bricolage',
      productsLabel: 'Bricolage',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher outils, matériaux...',
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
        id: 'typeBricolage',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'Outils manuels', label: 'Outils manuels' },
          { value: 'Outils électriques', label: 'Outils électriques' },
          { value: 'Matériaux construction', label: 'Matériaux' },
          { value: 'Peinture', label: 'Peinture' },
          { value: 'Quincaillerie', label: 'Quincaillerie' },
        ],
      },
      {
        id: 'marqueBricolage',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Bosch', label: 'Bosch' },
          { value: 'Makita', label: 'Makita' },
          { value: 'DeWalt', label: 'DeWalt' },
          { value: 'Stanley', label: 'Stanley' },
          { value: 'Black & Decker', label: 'Black & Decker' },
        ],
      },
      {
        id: 'etatBricolage',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf', label: 'Neuf' },
          { value: 'Excellent état', label: 'Excellent état' },
          { value: 'Bon état', label: 'Bon état' },
          { value: 'Occasion', label: 'Occasion' },
        ],
      },
    ],
    style: {
      primaryColor: '#F97316',
      gradientColors: ['#F97316', '#EA580C'],
      icon: '🔨',
      badgeColor: '#FED7AA',
      accentColor: '#EA580C',
    },
    displayPriority: ['typeBricolage', 'marqueBricolage', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 🏗️ CARRELAGE
  carrelage: {
    terminology: {
      productLabel: 'Carrelage',
      productsLabel: 'Carrelages',
      priceLabel: 'Prix',
      locationLabel: 'Magasin',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher carrelage...',
      emptyMessage: 'Aucun carrelage disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeCarrelage',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'Carrelage sol', label: 'Sol' },
          { value: 'Carrelage mural', label: 'Mural' },
          { value: 'Carrelage extérieur', label: 'Extérieur' },
          { value: 'Carrelage terrasse', label: 'Terrasse' },
          { value: 'Carrelage balcon', label: 'Balcon' },
          { value: 'Carrelage piscine', label: 'Piscine' },
          { value: 'Faïence', label: 'Faïence' },
          { value: 'Mosaïque', label: 'Mosaïque' },
          { value: 'Mosaïque décorative', label: 'Mosaïque décorative' },
          { value: 'Tomette', label: 'Tomette' },
          { value: 'Zellige (marocain)', label: 'Zellige' },
          { value: 'Pavé extérieur', label: 'Pavé extérieur' },
        ],
      },
      {
        id: 'materiauCarrelage',
        label: 'Matériau',
        type: 'select',
        options: [
          { value: 'Céramique', label: 'Céramique' },
          { value: 'Porcelaine', label: 'Porcelaine' },
          { value: 'Grès cérame', label: 'Grès cérame' },
          { value: 'Grès émaillé', label: 'Grès émaillé' },
          { value: 'Marbre', label: 'Marbre' },
          { value: 'Granit', label: 'Granit' },
          { value: 'Pierre naturelle', label: 'Pierre naturelle' },
          { value: 'Terre cuite', label: 'Terre cuite' },
          { value: 'Ardoise', label: 'Ardoise' },
          { value: 'Travertin', label: 'Travertin' },
          { value: 'Quartzite', label: 'Quartzite' },
        ],
      },
      {
        id: 'dimensionsCarrelage',
        label: 'Dimensions',
        type: 'select',
        options: [
          { value: '10x10cm', label: '10x10cm' },
          { value: '15x15cm', label: '15x15cm' },
          { value: '20x20cm', label: '20x20cm' },
          { value: '25x25cm', label: '25x25cm' },
          { value: '30x30cm', label: '30x30cm' },
          { value: '33x33cm', label: '33x33cm' },
          { value: '40x40cm', label: '40x40cm' },
          { value: '45x45cm', label: '45x45cm' },
          { value: '50x50cm', label: '50x50cm' },
          { value: '60x60cm', label: '60x60cm' },
          { value: '80x80cm', label: '80x80cm' },
          { value: '100x100cm', label: '100x100cm' },
          { value: '120x60cm', label: '120x60cm' },
          { value: 'Sur mesure', label: 'Sur mesure' },
        ],
      },
      {
        id: 'finitionCarrelage',
        label: 'Finition',
        type: 'multiselect',
        options: [
          { value: 'Brillant', label: 'Brillant' },
          { value: 'Mat', label: 'Mat' },
          { value: 'Satiné', label: 'Satiné' },
          { value: 'Poli', label: 'Poli' },
          { value: 'Antidérapant', label: 'Antidérapant' },
          { value: 'Structuré', label: 'Structuré' },
          { value: 'Lappato', label: 'Lappato' },
          { value: 'Adouci', label: 'Adouci' },
          { value: 'Brossé', label: 'Brossé' },
          { value: 'Flammé', label: 'Flammé' },
        ],
      },
      {
        id: 'usageCarrelage',
        label: 'Usage',
        type: 'multiselect',
        options: [
          { value: 'Intérieur résidentiel', label: 'Intérieur résidentiel' },
          { value: 'Intérieur commercial', label: 'Commercial' },
          { value: 'Extérieur', label: 'Extérieur' },
          { value: 'Salle de bain', label: 'Salle de bain' },
          { value: 'Cuisine', label: 'Cuisine' },
          { value: 'Piscine', label: 'Piscine' },
          { value: 'Terrasse', label: 'Terrasse' },
          { value: 'Garage', label: 'Garage' },
          { value: 'Hall d\'entrée', label: 'Hall d\'entrée' },
          { value: 'Boutique/Magasin', label: 'Boutique/Magasin' },
          { value: 'Hôtel/Restaurant', label: 'Hôtel/Restaurant' },
          { value: 'Bureau', label: 'Bureau' },
        ],
      },
      {
        id: 'aspectCarrelage',
        label: 'Aspect/Décor',
        type: 'multiselect',
        options: [
          { value: 'Uni', label: 'Uni' },
          { value: 'Marbré', label: 'Marbré' },
          { value: 'Imitation bois', label: 'Imitation bois' },
          { value: 'Imitation pierre', label: 'Imitation pierre' },
          { value: 'Imitation béton', label: 'Imitation béton' },
          { value: 'Imitation marbre', label: 'Imitation marbre' },
          { value: 'Métallique', label: 'Métallique' },
          { value: 'Motif géométrique', label: 'Motif géométrique' },
          { value: 'Hexagonal', label: 'Hexagonal' },
          { value: 'Format métro', label: 'Format métro' },
          { value: 'Décor floral', label: 'Décor floral' },
          { value: 'Décor oriental', label: 'Décor oriental' },
        ],
      },
      {
        id: 'origineCarrelage',
        label: 'Origine',
        type: 'select',
        options: [
          { value: '🇪🇸 Espagne', label: '🇪🇸 Espagne' },
          { value: '🇮🇹 Italie', label: '🇮🇹 Italie' },
          { value: '🇵🇹 Portugal', label: '🇵🇹 Portugal' },
          { value: '🇹🇷 Turquie', label: '🇹🇷 Turquie' },
          { value: '🇨🇳 Chine', label: '🇨🇳 Chine' },
          { value: '🇮🇳 Inde', label: '🇮🇳 Inde' },
          { value: '🇪🇬 Égypte', label: '🇪🇬 Égypte' },
          { value: '🇲🇦 Maroc', label: '🇲🇦 Maroc' },
          { value: '🇹🇳 Tunisie', label: '🇹🇳 Tunisie' },
          { value: '🇿🇦 Afrique du Sud', label: '🇿🇦 Afrique du Sud' },
          { value: 'Cameroun', label: 'Cameroun' },
          { value: 'Production locale', label: 'Production locale' },
        ],
      },
    ],
    style: {
      primaryColor: '#78716C',
      gradientColors: ['#78716C', '#57534E'],
      icon: '🏗️',
      badgeColor: '#E7E5E4',
      accentColor: '#57534E',
    },
    displayPriority: ['typeCarrelage', 'materiauCarrelage', 'dimensionsCarrelage', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    supportsVariants: false,
    searchKeywords: ['carrelage', 'carreau', 'faïence', 'mosaïque', 'ciment', 'revêtement', 'sol', 'mur', 'tomette', 'zellige', 'dalle', 'grès', 'céramique', 'porcelaine'],
  },

  // 🏗️ CARRELEUR (PRESTATION - Service de pose de carrelage)
  carreleur: {
    terminology: {
      productLabel: 'Service carreleur',
      productsLabel: 'Carreleurs',
      priceLabel: 'Prix au m²',
      locationLabel: 'Zones d\'intervention',
      providerLabel: 'Carreleur',
      searchPlaceholder: 'Rechercher un carreleur...',
      emptyMessage: 'Aucun carreleur disponible',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typePrestation',
        label: 'Type de prestation',
        type: 'select',
        options: [
          { value: 'Pose de carrelage', label: 'Pose de carrelage' },
          { value: 'Pose de faïence', label: 'Pose de faïence' },
          { value: 'Pose de mosaïque', label: 'Pose de mosaïque' },
          { value: 'Rénovation carrelage', label: 'Rénovation carrelage' },
          { value: 'Remplacement carrelage', label: 'Remplacement carrelage' },
          { value: 'Réparation joints', label: 'Réparation joints' },
          { value: 'Ragréage sol', label: 'Ragréage sol' },
          { value: 'Étanchéité', label: 'Étanchéité' },
          { value: 'Pose terrasse extérieure', label: 'Terrasse extérieure' },
          { value: 'Pose carrelage piscine', label: 'Carrelage piscine' },
        ],
      },
      {
        id: 'typesCarrelage',
        label: 'Types de carrelage',
        type: 'multiselect',
        options: [
          { value: 'Carrelage céramique', label: 'Céramique' },
          { value: 'Grès cérame', label: 'Grès cérame' },
          { value: 'Porcelaine', label: 'Porcelaine' },
          { value: 'Faïence', label: 'Faïence' },
          { value: 'Mosaïque', label: 'Mosaïque' },
          { value: 'Marbre', label: 'Marbre' },
          { value: 'Granit', label: 'Granit' },
          { value: 'Pierre naturelle', label: 'Pierre naturelle' },
          { value: 'Terre cuite', label: 'Terre cuite' },
          { value: 'Tomette', label: 'Tomette' },
        ],
      },
      {
        id: 'surfaces',
        label: 'Surfaces',
        type: 'multiselect',
        options: [
          { value: 'Sol intérieur', label: 'Sol intérieur' },
          { value: 'Sol extérieur', label: 'Sol extérieur' },
          { value: 'Mur salle de bain', label: 'Mur salle de bain' },
          { value: 'Mur cuisine', label: 'Mur cuisine' },
          { value: 'Terrasse', label: 'Terrasse' },
          { value: 'Balcon', label: 'Balcon' },
          { value: 'Escalier', label: 'Escalier' },
          { value: 'Piscine', label: 'Piscine' },
          { value: 'Garage', label: 'Garage' },
        ],
      },
      {
        id: 'tarification',
        label: 'Mode de tarification',
        type: 'select',
        options: [
          { value: 'Au m² (fourniture non incluse)', label: 'Au m² sans fourniture' },
          { value: 'Au m² (fourniture incluse)', label: 'Au m² avec fourniture' },
          { value: 'Forfait global', label: 'Forfait global' },
          { value: 'Devis personnalisé', label: 'Devis personnalisé' },
          { value: 'Tarif horaire', label: 'Tarif horaire' },
        ],
      },
      {
        id: 'experience',
        label: 'Expérience',
        type: 'select',
        options: [
          { value: 'Moins de 2 ans', label: 'Moins de 2 ans' },
          { value: '2-5 ans d\'expérience', label: '2-5 ans' },
          { value: '5-10 ans d\'expérience', label: '5-10 ans' },
          { value: '10-15 ans d\'expérience', label: '10-15 ans' },
          { value: '15-20 ans d\'expérience', label: '15-20 ans' },
          { value: 'Plus de 20 ans (maître carreleur)', label: '20+ ans (maître)' },
        ],
      },
      {
        id: 'garantie',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
          { value: 'Garantie décennale', label: 'Décennale' },
        ],
      },
    ],
    style: {
      primaryColor: '#78716C',
      gradientColors: ['#78716C', '#57534E'],
      icon: '🏗️',
      badgeColor: '#E7E5E4',
      accentColor: '#57534E',
    },
    displayPriority: ['typePrestation', 'typesCarrelage', 'surfaces', 'tarification', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    supportsVariants: false,
    searchKeywords: ['carreleur', 'pose carrelage', 'faïence', 'mosaïque', 'ragréage', 'étanchéité', 'joint carrelage', 'rénovation carrelage'],
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

  // 🍽️ ALIMENTATION & PRODUITS ALIMENTAIRES
  agroalimentaire: {
    terminology: {
      productLabel: 'Produit alimentaire',
      productsLabel: 'Produits alimentaires',
      priceLabel: 'Prix',
      locationLabel: 'Point de vente',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher riz, huile, fruits...',
      emptyMessage: 'Aucun produit alimentaire trouvé',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant (par unité min)',
        price_desc: 'Prix décroissant (par unité max)',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'categorieAliment',
        label: 'Catégorie',
        type: 'select',
        options: [
          { value: 'Céréales & Féculents', label: 'Céréales & Féculents' },
          { value: 'Huiles & Matières grasses', label: 'Huiles & Matières grasses' },
          { value: 'Condiments & Épices', label: 'Condiments & Épices' },
          { value: 'Conserves', label: 'Conserves' },
          { value: 'Boissons', label: 'Boissons' },
          { value: 'Fruits frais', label: 'Fruits frais' },
          { value: 'Légumes frais', label: 'Légumes frais' },
          { value: 'Viandes & Poissons', label: 'Viandes & Poissons' },
          { value: 'Produits laitiers', label: 'Produits laitiers' },
          { value: 'Boulangerie & Pâtisserie', label: 'Boulangerie & Pâtisserie' },
          { value: 'Confiserie & Snacks', label: 'Confiserie & Snacks' },
        ],
      },
      {
        id: 'typeAliment',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'Produit sec', label: 'Produit sec' },
          { value: 'Produit frais', label: 'Produit frais' },
          { value: 'Surgelé', label: 'Surgelé' },
          { value: 'Conserve', label: 'Conserve' },
          { value: 'Boisson', label: 'Boisson' },
        ],
      },
      {
        id: 'marqueAliment',
        label: 'Marque',
        type: 'select',
        options: [
          // 🇨🇲 CAMEROUN - Marques locales populaires (30+)
          { value: 'SABC', label: '🇨🇲 SABC (Huile)' },
          { value: 'Zena', label: '🇨🇲 Zena (Eau, Jus)' },
          { value: 'Top Piment', label: '🇨🇲 Top Piment' },
          { value: 'Cicam', label: '🇨🇲 Cicam (Huile)' },
          { value: 'Supermount', label: '🇨🇲 Supermount (Eau)' },
          { value: 'Tangui', label: '🇨🇲 Tangui (Eau)' },
          { value: 'Source du Pays', label: '🇨🇲 Source du Pays (Eau)' },
          { value: 'Beauté d\'Afrique', label: '🇨🇲 Beauté d\'Afrique (Huile)' },
          { value: 'Azur', label: '🇨🇲 Azur (Huile)' },
          { value: 'Douala Minoterie', label: '🇨🇲 Douala Minoterie (Farine)' },
          { value: 'La Boulangère', label: '🇨🇲 La Boulangère (Pain)' },
          { value: 'Top Ananas', label: '🇨🇲 Top Ananas (Jus)' },
          { value: 'SOCAVER', label: '🇨🇲 SOCAVER (Boissons)' },
          { value: 'Guinness Cameroun', label: '🇨🇲 Guinness Cameroun' },
          { value: '33 Export', label: '🇨🇲 33 Export' },
          { value: 'Beaufort', label: '🇨🇲 Beaufort' },
          { value: 'Isenbeck', label: '🇨🇲 Isenbeck' },
          { value: 'Castel Beer', label: '🇨🇲 Castel Beer' },

          // 🇨🇮 CÔTE D\'IVOIRE - Marques locales populaires (15+)
          { value: 'Ivoire Lait', label: '🇨🇮 Ivoire Lait' },
          { value: 'Celia', label: '🇨🇮 Celia (Eau)' },
          { value: 'Awoulaba', label: '🇨🇮 Awoulaba (Eau)' },
          { value: 'Moossou', label: '🇨🇮 Moossou (Huile)' },
          { value: 'TRITURAF', label: '🇨🇮 TRITURAF (Huile)' },
          { value: 'Brassivoire', label: '🇨🇮 Brassivoire (Boissons)' },
          { value: 'Solibra', label: '🇨🇮 Solibra (Boissons)' },
          { value: 'Ivoire Cacao', label: '🇨🇮 Ivoire Cacao' },
          { value: 'Chococam', label: '🇨🇮 Chococam' },
          { value: 'Nestle CI', label: '🇨🇮 Nestlé CI' },
          { value: 'Flag', label: '🇨🇮 Flag (Bière)' },
          { value: 'Bock', label: '🇨🇮 Bock (Bière)' },

          // 🇸🇳 SÉNÉGAL - Marques locales populaires (12+)
          { value: 'Kirene', label: '🇸🇳 Kirene (Eau, Boissons)' },
          { value: 'Lafi', label: '🇸🇳 Lafi (Eau)' },
          { value: 'Bissap', label: '🇸🇳 Bissap (Jus)' },
          { value: 'Soboa', label: '🇸🇳 Soboa (Boissons)' },
          { value: 'Brasseries du Sénégal', label: '🇸🇳 Brasseries du Sénégal' },
          { value: 'Gazelle', label: '🇸🇳 Gazelle (Bière)' },
          { value: 'Flag Sénégal', label: '🇸🇳 Flag' },
          { value: 'Patisen', label: '🇸🇳 Patisen (Biscuits)' },
          { value: 'Niokobok', label: '🇸🇳 Niokobok (Confiserie)' },

          // 🇲🇱 MALI - Marques locales populaires (8+)
          { value: 'Djoliba', label: '🇲🇱 Djoliba (Eau)' },
          { value: 'Huicoma', label: '🇲🇱 Huicoma (Huile)' },
          { value: 'SOMAPIL', label: '🇲🇱 SOMAPIL (Farine)' },
          { value: 'Brakina', label: '🇲🇱 Brakina (Bière)' },
          { value: 'Castel Mali', label: '🇲🇱 Castel Mali' },

          // 🇨🇩 CONGO (RDC) - Marques locales populaires (10+)
          { value: 'Bracongo', label: '🇨🇩 Bracongo (Boissons)' },
          { value: 'Primus', label: '🇨🇩 Primus (Bière)' },
          { value: 'Tembo', label: '🇨🇩 Tembo (Bière)' },
          { value: 'Skol Congo', label: '🇨🇩 Skol Congo' },
          { value: 'Celtis', label: '🇨🇩 Celtis' },
          { value: 'MIDEMA', label: '🇨🇩 MIDEMA (Farine)' },
          { value: 'Nganda', label: '🇨🇩 Nganda' },

          // 🇬🇦 GABON - Marques locales populaires (8+)
          { value: 'Sogapal', label: '🇬🇦 Sogapal (Huile)' },
          { value: 'Regab', label: '🇬🇦 Regab (Bière)' },
          { value: 'Beaufort Gabon', label: '🇬🇦 Beaufort Gabon' },
          { value: 'SOBRAGA', label: '🇬🇦 SOBRAGA (Boissons)' },

          // 🇳🇬 NIGERIA - Marques très populaires en Afrique francophone (15+)
          { value: 'Golden Penny', label: '🇳🇬 Golden Penny (Farine)' },
          { value: 'Dangote', label: '🇳🇬 Dangote' },
          { value: 'Indomie', label: '🇳🇬 Indomie' },
          { value: 'Peak Milk', label: '🇳🇬 Peak Milk' },
          { value: 'Dano Milk', label: '🇳🇬 Dano Milk' },
          { value: 'Three Crowns', label: '🇳🇬 Three Crowns (Lait)' },
          { value: 'Cowbell', label: '🇳🇬 Cowbell (Lait)' },
          { value: 'Tasty Tom', label: '🇳🇬 Tasty Tom' },
          { value: 'Gino', label: '🇳🇬 Gino (Tomate)' },
          { value: 'Maltina', label: '🇳🇬 Maltina' },
          { value: 'Supermalt', label: '🇳🇬 Supermalt' },
          { value: 'Star Beer', label: '🇳🇬 Star Beer' },
          { value: 'Gulder', label: '🇳🇬 Gulder' },
          { value: 'Trophy', label: '🇳🇬 Trophy' },

          // 🌍 MARQUES INTERNATIONALES POPULAIRES EN AFRIQUE (25+)
          { value: 'Maggi', label: 'Maggi' },
          { value: 'Jumbo', label: 'Jumbo' },
          { value: 'Knorr', label: 'Knorr' },
          { value: 'Nido', label: 'Nido' },
          { value: 'Nestlé', label: 'Nestlé' },
          { value: 'Nescafé', label: 'Nescafé' },
          { value: 'Milo', label: 'Milo' },
          { value: 'Coca-Cola', label: 'Coca-Cola' },
          { value: 'Fanta', label: 'Fanta' },
          { value: 'Sprite', label: 'Sprite' },
          { value: 'Schweppes', label: 'Schweppes' },
          { value: 'Lipton', label: 'Lipton' },
          { value: 'La Vache qui Rit', label: 'La Vache qui Rit' },
          { value: 'Président', label: 'Président' },
          { value: 'Uncle Ben\'s', label: 'Uncle Ben\'s' },
          { value: 'Panzani', label: 'Panzani' },
          { value: 'Barilla', label: 'Barilla' },
          { value: 'Heinz', label: 'Heinz' },
          { value: 'Kellogg\'s', label: 'Kellogg\'s' },
          { value: 'Pringles', label: 'Pringles' },
          { value: 'Lay\'s', label: 'Lay\'s' },
          { value: 'Guinness', label: 'Guinness' },
          { value: 'Heineken', label: 'Heineken' },
          { value: 'Castel', label: 'Castel' },
          { value: 'Orangina', label: 'Orangina' },
          { value: 'Tropicana', label: 'Tropicana' },
          { value: 'Red Bull', label: 'Red Bull' },
          { value: 'Monster', label: 'Monster' },
        ],
      },
      {
        id: 'origine',
        label: 'Origine',
        type: 'select',
        options: [
          { value: 'Locale', label: 'Locale' },
          { value: 'Import', label: 'Importé' },
          { value: 'Afrique', label: 'Afrique' },
          { value: 'Europe', label: 'Europe' },
          { value: 'Asie', label: 'Asie' },
        ],
      },
      {
        id: 'bio',
        label: 'Bio',
        type: 'toggle',
      },
      {
        id: 'labelQualite',
        label: 'Labels qualité',
        type: 'multiselect',
        options: [
          { value: 'Bio', label: 'Bio' },
          { value: 'Label Rouge', label: 'Label Rouge' },
          { value: 'AOC', label: 'AOC' },
          { value: 'AOP', label: 'AOP' },
          { value: 'Commerce équitable', label: 'Commerce équitable' },
        ],
      },
      {
        id: 'allergenesArray',
        label: 'Sans allergènes',
        type: 'multiselect',
        options: [
          { value: 'Gluten', label: 'Gluten' },
          { value: 'Lait', label: 'Lait' },
          { value: 'Œufs', label: 'Œufs' },
          { value: 'Arachides', label: 'Arachides' },
          { value: 'Fruits à coque', label: 'Fruits à coque' },
          { value: 'Soja', label: 'Soja' },
        ],
      },
      {
        id: 'conservation',
        label: 'Mode de conservation',
        type: 'select',
        options: [
          { value: 'Température ambiante', label: 'Température ambiante' },
          { value: 'Au frais (2-8°C)', label: 'Au frais (2-8°C)' },
          { value: 'Réfrigéré (0-4°C)', label: 'Réfrigéré (0-4°C)' },
          { value: 'Congelé (-18°C)', label: 'Congelé (-18°C)' },
        ],
      },
      {
        id: 'uniteMesure',
        label: 'Unité',
        type: 'select',
        options: [
          { value: 'kg', label: 'Kilogramme (kg)' },
          { value: 'g', label: 'Gramme (g)' },
          { value: 'L', label: 'Litre (L)' },
          { value: 'mL', label: 'Millilitre (mL)' },
          { value: 'pièce', label: 'Pièce' },
        ],
      },
      {
        id: 'conditionnement',
        label: 'Conditionnement',
        type: 'select',
        options: [
          { value: 'Sachet', label: 'Sachet' },
          { value: 'Boîte', label: 'Boîte' },
          { value: 'Bouteille', label: 'Bouteille' },
          { value: 'Bidon', label: 'Bidon' },
          { value: 'Vrac', label: 'Vrac' },
        ],
      },
    ],
    style: {
      primaryColor: '#10B981',
      gradientColors: ['#10B981', '#059669'],
      icon: '🍽️',
      badgeColor: '#D1FAE5',
      accentColor: '#059669',
    },
    displayPriority: ['name', 'variants', 'categorieAliment', 'marqueAliment', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    supportsVariants: true, // ✅ NOUVEAU: Indique que cette catégorie supporte les variantes
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

  // 🏥 ÉTABLISSEMENTS DE SANTÉ (Hôpitaux, Cliniques)
  hopital_clinique: {
    terminology: {
      productLabel: 'Établissement de santé',
      productsLabel: 'Établissements de santé',
      priceLabel: 'Consultation',
      locationLabel: 'Localisation',
      providerLabel: 'Établissement',
      searchPlaceholder: 'Rechercher hôpital, clinique...',
      emptyMessage: 'Aucun établissement trouvé',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeEtablissement',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'Hôpital public', label: 'Hôpital public' },
          { value: 'Hôpital universitaire (CHU)', label: 'CHU' },
          { value: 'Clinique privée', label: 'Clinique privée' },
          { value: 'Polyclinique', label: 'Polyclinique' },
          { value: 'Centre médical', label: 'Centre médical' },
          { value: 'Maternité', label: 'Maternité' },
        ]
      },
      {
        id: 'prestationsGenerales',
        label: 'Prestations générales',
        type: 'multiselect',
        options: [
          { value: 'Consultation générale', label: 'Consultation générale' },
          { value: 'Urgences 24h/24', label: 'Urgences 24h/24' },
          { value: 'Hospitalisation', label: 'Hospitalisation' },
          { value: 'Chirurgie', label: 'Chirurgie' },
          { value: 'Maternité', label: 'Maternité' },
          { value: 'Pédiatrie', label: 'Pédiatrie' },
        ]
      },
      {
        id: 'consultationsSpecialisees',
        label: 'Spécialités médicales',
        type: 'multiselect',
        options: [
          // Médecine interne
          { value: 'Cardiologie', label: '❤️ Cardiologie' },
          { value: 'Pneumologie', label: '🫁 Pneumologie' },
          { value: 'Gastro-entérologie', label: '🔬 Gastro-entérologie' },
          { value: 'Néphrologie', label: 'Néphrologie' },
          { value: 'Endocrinologie', label: 'Endocrinologie' },
          { value: 'Diabétologie', label: '🩸 Diabétologie' },
          { value: 'Rhumatologie', label: 'Rhumatologie' },
          { value: 'Neurologie', label: '🧠 Neurologie' },
          // Chirurgie
          { value: 'Chirurgie générale', label: '🏥 Chirurgie générale' },
          { value: 'Chirurgie orthopédique', label: '🦴 Orthopédie' },
          { value: 'Chirurgie viscérale', label: 'Chirurgie viscérale' },
          { value: 'Neurochirurgie', label: 'Neurochirurgie' },
          { value: 'Chirurgie maxillo-faciale', label: 'Chirurgie maxillo-faciale' },
          { value: 'Chirurgie plastique', label: 'Chirurgie plastique' },
          // Femme et enfant
          { value: 'Gynécologie', label: '👶 Gynécologie' },
          { value: 'Obstétrique', label: 'Obstétrique' },
          { value: 'Pédiatrie', label: '🧒 Pédiatrie' },
          { value: 'Néonatologie', label: 'Néonatologie' },
          // Organes des sens
          { value: 'Ophtalmologie', label: '👁️ Ophtalmologie' },
          { value: 'ORL (Oto-Rhino-Laryngologie)', label: '👂 ORL' },
          { value: 'Stomatologie', label: 'Stomatologie' },
          { value: 'Odontologie (Dentaire)', label: '🦷 Dentiste' },
          // Imagerie et diagnostic
          { value: 'Radiologie', label: '📡 Radiologie' },
          { value: 'Échographie', label: '🔊 Échographie' },
          { value: 'Scanner', label: 'Scanner' },
          { value: 'IRM', label: 'IRM' },
          { value: 'Mammographie', label: 'Mammographie' },
          // Autres spécialités
          { value: 'Dermatologie', label: 'Dermatologie' },
          { value: 'Urologie', label: '💧 Urologie' },
          { value: 'Oncologie', label: '🎗️ Oncologie (Cancer)' },
          { value: 'Hématologie', label: 'Hématologie' },
          { value: 'Psychiatrie', label: '🧘 Psychiatrie' },
          { value: 'Médecine physique et réadaptation', label: 'Réadaptation' },
          { value: 'Anesthésie', label: 'Anesthésie' },
          { value: 'Médecine du travail', label: 'Médecine du travail' },
        ]
      },
      {
        id: 'joursOuverture',
        label: 'Jours d\'ouverture',
        type: 'multiselect',
        options: [
          { value: 'Lundi', label: 'Lundi' },
          { value: 'Mardi', label: 'Mardi' },
          { value: 'Mercredi', label: 'Mercredi' },
          { value: 'Jeudi', label: 'Jeudi' },
          { value: 'Vendredi', label: 'Vendredi' },
          { value: 'Samedi', label: 'Samedi' },
          { value: 'Dimanche', label: 'Dimanche' },
        ]
      },
      { id: 'ouvertMaintenant', label: '🟢 Ouvert maintenant', type: 'toggle' },
      { id: 'urgencesDisponible', label: 'Urgences 24h/24', type: 'toggle' },
      { id: 'banqueSang', label: 'Banque de sang', type: 'toggle' },
      { id: 'rdvEnLigne', label: 'RDV en ligne', type: 'toggle' },
      {
        id: 'servicesAnnexes',
        label: 'Services annexes',
        type: 'multiselect',
        options: [
          { value: 'Laboratoire d\'analyses', label: 'Laboratoire' },
          { value: 'Pharmacie interne', label: 'Pharmacie interne' },
          { value: 'Ambulance', label: 'Ambulance' },
          { value: 'Banque de sang', label: 'Banque de sang' },
          { value: 'Dialyse', label: 'Dialyse' },
          { value: 'Kinésithérapie', label: 'Kinésithérapie' },
        ]
      },
      {
        id: 'equipementsHopital',
        label: 'Équipements',
        type: 'multiselect',
        options: [
          { value: 'Scanner', label: 'Scanner' },
          { value: 'IRM', label: 'IRM' },
          { value: 'Échographie', label: 'Échographie' },
          { value: 'Radiologie numérique', label: 'Radiologie' },
          { value: 'Mammographe', label: 'Mammographe' },
          { value: 'Endoscopie', label: 'Endoscopie' },
          { value: 'Bloc opératoire', label: 'Bloc opératoire' },
        ]
      },
    ],
    style: {
      primaryColor: '#DC2626',
      gradientColors: ['#DC2626', '#B91C1C'],
      icon: '🏥',
      badgeColor: '#FEE2E2',
      accentColor: '#B91C1C',
    },
    displayPriority: ['name', 'typeEtablissement', 'consultationsSpecialisees', 'urgencesDisponible'],
    contactMethods: ['phone', 'message', 'whatsapp'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 💊 PHARMACIES - ENRICHI AVEC FILTRES INTELLIGENTS
  pharmacie: {
    terminology: {
      productLabel: 'Pharmacie',
      productsLabel: 'Pharmacies',
      priceLabel: 'Tarif',
      locationLabel: 'Localisation',
      providerLabel: 'Pharmacie',
      searchPlaceholder: 'Rechercher pharmacie, médicament...',
      emptyMessage: 'Aucune pharmacie trouvée',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // 🎯 FILTRE INTELLIGENT: Disponibilité immédiate
      {
        id: 'disponibiliteImmediate',
        label: '⚡ Disponibilité',
        type: 'select',
        options: [
          { value: 'Toutes', label: 'Toutes les pharmacies' },
          { value: 'Ouvertes maintenant', label: '🟢 Ouvertes maintenant' },
          { value: 'De garde ce soir', label: '🌙 De garde ce soir (20h-8h)' },
          { value: '24h/24', label: '🕐 Permanence 24h/24' },
          { value: 'Ouvertes weekend', label: '📅 Ouvertes samedi-dimanche' },
        ]
      },
      // Type de pharmacie
      {
        id: 'typePharmacie',
        label: 'Type de pharmacie',
        type: 'select',
        options: [
          { value: 'Pharmacie normale', label: 'Pharmacie normale' },
          { value: 'Pharmacie de garde (nuit)', label: 'Pharmacie de garde (nuit)' },
          { value: 'Pharmacie de garde (weekend)', label: 'Pharmacie de garde (weekend)' },
          { value: 'Pharmacie 24h/24', label: 'Pharmacie 24h/24' },
          { value: 'Pharmacie hospitalière', label: 'Pharmacie hospitalière' },
          { value: 'Pharmacie d\'officine', label: 'Pharmacie d\'officine' },
          { value: 'Parapharmacie', label: 'Parapharmacie' },
        ]
      },
      // Services disponibles (SYNCHRONISÉ avec modalités)
      {
        id: 'servicesPharmacie',
        label: 'Services',
        type: 'multiselect',
        options: [
          // Services de base
          { value: 'Vente de médicaments sur ordonnance', label: 'Sur ordonnance' },
          { value: 'Vente libre (sans ordonnance)', label: 'Sans ordonnance' },
          { value: 'Conseil pharmaceutique gratuit', label: 'Conseil gratuit' },
          { value: 'Délivrance urgente', label: 'Urgence' },

          // Services garde
          { value: 'Garde de nuit (20h-8h)', label: '🌙 Garde de nuit' },
          { value: 'Garde weekend (Sam-Dim)', label: '📅 Garde weekend' },
          { value: 'Garde jours fériés', label: '🎉 Garde jours fériés' },
          { value: 'Permanence 24h/24', label: '🕐 24h/24' },

          // Tests et analyses
          { value: 'Test de glycémie rapide', label: '🩸 Test glycémie' },
          { value: 'Prise de tension artérielle', label: '❤️ Tension' },
          { value: 'Test de grossesse', label: '🤰 Test grossesse' },
          { value: 'Test paludisme (goutte épaisse)', label: '🦟 Test paludisme' },
          { value: 'Test COVID-19', label: '😷 Test COVID' },

          // Soins
          { value: 'Injections/Vaccinations', label: '💉 Injections' },
          { value: 'Pansements', label: '🩹 Pansements' },
          { value: 'Premiers secours', label: '🚑 Premiers secours' },

          // Services pratiques
          { value: 'Livraison à domicile', label: '🚚 Livraison' },
          { value: 'Livraison Express (<2h)', label: '⚡ Livraison Express' },
          { value: 'Commande téléphonique', label: '📞 Commande tél' },
          { value: 'WhatsApp Business', label: '💬 WhatsApp' },

          // Parapharmacie
          { value: 'Parapharmacie (cosmétiques)', label: '💄 Cosmétiques' },
          { value: 'Produits bébé (lait, couches)', label: '👶 Produits bébé' },
          { value: 'Compléments alimentaires', label: '💊 Compléments' },
          { value: 'Matériel médical', label: '🏥 Matériel médical' },
          { value: 'Orthopédie', label: '🦴 Orthopédie' },

          // Paiement
          { value: 'Paiement Mobile Money', label: '💳 Mobile Money' },
          { value: 'Paiement Orange Money', label: '🟠 Orange Money' },
          { value: 'Paiement MTN Mobile Money', label: '🟡 MTN MoMo' },
          { value: 'Paiement carte bancaire', label: '💳 Carte bancaire' },
        ]
      },
      // Villes principales (NOUVEAU)
      {
        id: 'villesPharmacie',
        label: 'Villes',
        type: 'multiselect',
        options: [
          { value: 'Douala', label: 'Douala' },
          { value: 'Yaoundé', label: 'Yaoundé' },
          { value: 'Bafoussam', label: 'Bafoussam' },
          { value: 'Garoua', label: 'Garoua' },
          { value: 'Bamenda', label: 'Bamenda' },
          { value: 'Maroua', label: 'Maroua' },
          { value: 'Ngaoundéré', label: 'Ngaoundéré' },
          { value: 'Bertoua', label: 'Bertoua' },
          { value: 'Kribi', label: 'Kribi' },
          { value: 'Limbe', label: 'Limbe' },
          { value: 'Ebolowa', label: 'Ebolowa' },
          { value: 'Kumba', label: 'Kumba' },
          { value: 'Buea', label: 'Buea' },
          { value: 'Dschang', label: 'Dschang' },
        ]
      },
      // Jours d'ouverture
      {
        id: 'joursOuverturePharmacie',
        label: 'Jours d\'ouverture',
        type: 'multiselect',
        options: [
          { value: 'Lundi', label: 'Lundi' },
          { value: 'Mardi', label: 'Mardi' },
          { value: 'Mercredi', label: 'Mercredi' },
          { value: 'Jeudi', label: 'Jeudi' },
          { value: 'Vendredi', label: 'Vendredi' },
          { value: 'Samedi', label: 'Samedi' },
          { value: 'Dimanche', label: 'Dimanche' },
        ]
      },
    ],
    style: {
      primaryColor: '#16A34A',
      gradientColors: ['#16A34A', '#15803D'],
      icon: '💊',
      badgeColor: '#DCFCE7',
      accentColor: '#15803D',
    },
    displayPriority: ['name', 'typePharmacie', 'servicesPharmacie'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🧪 LABORATOIRES D'ANALYSES
  laboratoire: {
    terminology: {
      productLabel: 'Laboratoire',
      productsLabel: 'Laboratoires',
      priceLabel: 'Tarif',
      locationLabel: 'Localisation',
      providerLabel: 'Laboratoire',
      searchPlaceholder: 'Rechercher laboratoire...',
      emptyMessage: 'Aucun laboratoire trouvé',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'typeLaboratoire',
        label: 'Type de laboratoire',
        type: 'select',
        options: [
          { value: 'Laboratoire d\'analyses médicales', label: 'Laboratoire d\'analyses' },
          { value: 'Laboratoire de biologie médicale', label: 'Biologie médicale' },
          { value: 'Centre d\'imagerie médicale', label: 'Imagerie médicale' },
          { value: 'Laboratoire d\'anatomie pathologique', label: 'Anatomie pathologique' },
          { value: 'Laboratoire de microbiologie', label: 'Microbiologie' },
          { value: 'Laboratoire & Imagerie (Mixte)', label: 'Mixte (Analyses & Imagerie)' },
        ],
      },
      {
        id: 'examensLaboratoire',
        label: 'Examens disponibles',
        type: 'multiselect',
        options: [
          // Analyses biologiques courantes
          { value: 'Numération formule sanguine (NFS)', label: 'NFS' },
          { value: 'Glycémie', label: 'Glycémie' },
          { value: 'Bilan lipidique', label: 'Bilan lipidique' },
          { value: 'Bilan hépatique', label: 'Bilan hépatique' },
          { value: 'Bilan rénal', label: 'Bilan rénal' },
          { value: 'Bilan thyroïdien', label: 'Bilan thyroïdien' },
          { value: 'Sérologie VIH', label: 'Sérologie VIH' },
          { value: 'Sérologie hépatites (B/C)', label: 'Hépatites B/C' },
          { value: 'Goutte épaisse (Paludisme)', label: 'Test paludisme' },
          { value: 'ECBU (Examen cytobactériologique urinaire)', label: 'ECBU' },
          { value: 'Test de grossesse (Beta-HCG)', label: 'Test grossesse' },
          // Imagerie médicale
          { value: 'Radiographie', label: 'Radiographie' },
          { value: 'Échographie', label: 'Échographie' },
          { value: 'Échographie Doppler', label: 'Doppler' },
          { value: 'Scanner', label: 'Scanner' },
          { value: 'IRM', label: 'IRM' },
          { value: 'Mammographie', label: 'Mammographie' },
        ],
      },
      {
        id: 'jourDisponibilite',
        label: 'Jour disponible',
        type: 'select',
        options: [
          { value: 'Lundi', label: 'Lundi' },
          { value: 'Mardi', label: 'Mardi' },
          { value: 'Mercredi', label: 'Mercredi' },
          { value: 'Jeudi', label: 'Jeudi' },
          { value: 'Vendredi', label: 'Vendredi' },
          { value: 'Samedi', label: 'Samedi' },
          { value: 'Dimanche', label: 'Dimanche' },
        ],
      },
      {
        id: 'momentDisponibilite',
        label: 'Moment',
        type: 'select',
        options: [
          { value: 'Matin (6h-12h)', label: 'Matin' },
          { value: 'Après-midi (12h-18h)', label: 'Après-midi' },
          { value: 'Soir (18h-22h)', label: 'Soir' },
          { value: '24h/24', label: '24h/24' },
        ],
      },
      {
        id: 'prelevementDomicile',
        label: 'Prélèvement à domicile',
        type: 'toggle',
      },
      {
        id: 'resultatRapide',
        label: 'Résultats rapides',
        type: 'toggle',
      },
      {
        id: 'rdvEnLigne',
        label: 'RDV en ligne',
        type: 'toggle',
      },
    ],
    style: {
      primaryColor: '#0891B2',
      gradientColors: ['#0891B2', '#0E7490'],
      icon: '🧪',
      badgeColor: '#CFFAFE',
      accentColor: '#0E7490',
    },
    displayPriority: ['name', 'typeLaboratoire', 'analysesProposees'],
    contactMethods: ['phone', 'whatsapp', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
  },

  // 🚕 TRANSPORT INTRA-URBAIN (Taxi/VTC - Concurrent de Yango/Gozem)
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
        id: 'villeService',
        label: 'Ville du service',
        type: 'select',
        options: genererZonesIntervention('CM')
          .filter(z => !z.includes('────') && !z.includes('Toute l\'Afrique') && !z.includes('International'))
          .slice(0, 50)
          .map(z => ({ value: z, label: z }))
      },
      {
        id: 'typeVehiculeTransport',
        label: 'Type de véhicule',
        type: 'select',
        options: [
          { value: 'Moto-taxi', label: '🏍️ Moto-taxi (Okada/Bendskin)' },
          { value: 'Tricycle', label: '🛺 Tricycle (Keke Napep)' },
          { value: 'Berline économique', label: '🚗 Berline économique (4 places)' },
          { value: 'Berline confort', label: '🚗 Berline confort (4 places)' },
          { value: 'SUV', label: '🚙 SUV (5-7 places)' },
          { value: 'Minibus', label: '🚐 Minibus (9-14 places)' },
          { value: 'Van climatisé', label: '🚐 Van climatisé (6-8 places)' },
          { value: 'Voiture de luxe', label: '✨ Voiture de luxe (VIP)' },
        ]
      },
      {
        id: 'categorieService',
        label: 'Catégorie de service',
        type: 'select',
        options: [
          { value: 'Course simple', label: '📍 Course simple (A → B)' },
          { value: 'Course avec attente', label: '⏳ Course avec attente' },
          { value: 'Courses multiples', label: '🔄 Courses multiples (plusieurs arrêts)' },
          { value: 'Service à la journée', label: '📅 Service à la journée' },
          { value: 'Service à l\'heure', label: '⏰ Service à l\'heure' },
          { value: 'Livraison express', label: '📦 Livraison express' },
          { value: 'Transport scolaire', label: '🎒 Transport scolaire' },
          { value: 'Transport médical', label: '🏥 Transport médical' },
        ]
      },
      {
        id: 'optionsConfort',
        label: 'Options de confort',
        type: 'multiselect',
        options: [
          { value: 'Climatisation', label: '❄️ Climatisation' },
          { value: 'Wifi gratuit', label: '📶 Wifi gratuit' },
          { value: 'Chargeur téléphone', label: '🔌 Chargeur téléphone' },
          { value: 'Eau fraîche offerte', label: '💧 Eau fraîche offerte' },
          { value: 'Musique au choix', label: '🎵 Musique au choix' },
          { value: 'Silence garanti', label: '🤫 Silence garanti' },
          { value: 'Coffre spacieux', label: '🧳 Coffre spacieux' },
          { value: 'Siège bébé disponible', label: '👶 Siège bébé disponible' },
        ]
      },
      {
        id: 'modePaiement',
        label: 'Mode de paiement accepté',
        type: 'multiselect',
        options: [
          { value: 'Espèces', label: '💵 Espèces' },
          { value: 'Orange Money', label: '📱 Orange Money' },
          { value: 'MTN Mobile Money', label: '📱 MTN Mobile Money' },
          { value: 'Moov Money', label: '📱 Moov Money' },
          { value: 'Carte bancaire', label: '💳 Carte bancaire' },
          { value: 'Virement instantané', label: '💸 Virement instantané' },
        ]
      },
      {
        id: 'disponibilite',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Maintenant', label: '⚡ Disponible maintenant' },
          { value: '24h/24', label: '🌙 Service 24h/24' },
          { value: 'Jour uniquement', label: '☀️ Jour uniquement (6h-20h)' },
          { value: 'Nuit uniquement', label: '🌙 Nuit uniquement (20h-6h)' },
          { value: 'Sur réservation', label: '📅 Sur réservation' },
          { value: 'Week-end', label: '🌴 Week-end uniquement' },
        ]
      },
      {
        id: 'tarifBase',
        label: 'Tarif de base (indication)',
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
    displayPriority: ['name', 'villeService', 'typeVehiculeTransport', 'categorieService', 'disponibilite', 'tarifBase'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
    searchKeywords: ['taxi', 'vtc', 'chauffeur', 'course', 'transport', 'moto', 'okada', 'bendskin', 'keke', 'clando'],
  },

  // 🚗 COVOITURAGE & TRAJETS
  covoiturage: {
    terminology: {
      productLabel: 'Trajet',
      productsLabel: 'Trajets',
      priceLabel: 'Prix/place',
      locationLabel: 'Départ',
      providerLabel: 'Conducteur',
      searchPlaceholder: 'Rechercher Douala-Yaoundé, trajets...',
      emptyMessage: 'Aucun trajet trouvé',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
        date: 'Date',
      },
    },
    filters: [
      {
        id: 'villeDepart',
        label: 'Ville de départ',
        type: 'select',
        options: [
          // 🇨🇲 Villes principales Cameroun
          { value: 'Douala', label: '🏙️ Douala' },
          { value: 'Yaoundé', label: '🏙️ Yaoundé' },
          { value: 'Garoua', label: '🏙️ Garoua' },
          { value: 'Bafoussam', label: '🏙️ Bafoussam' },
          { value: 'Bamenda', label: '🏙️ Bamenda' },
          { value: 'Maroua', label: '🏙️ Maroua' },
          { value: 'Ngaoundéré', label: '🏙️ Ngaoundéré' },
          { value: 'Bertoua', label: 'Bertoua' },
          { value: 'Ebolowa', label: 'Ebolowa' },
          { value: 'Kribi', label: '🏖️ Kribi' },
          { value: 'Kumba', label: 'Kumba' },
          { value: 'Limbe', label: '🏖️ Limbe' },
          { value: 'Nkongsamba', label: 'Nkongsamba' },
          { value: 'Buea', label: 'Buea' },
          { value: 'Édéa', label: 'Édéa' },
          { value: 'Mbalmayo', label: 'Mbalmayo' },
          { value: 'Dschang', label: 'Dschang' },
          { value: 'Foumban', label: 'Foumban' },
        ]
      },
      {
        id: 'villeArrivee',
        label: 'Ville d\'arrivée',
        type: 'select',
        options: [
          // 🇨🇲 Villes principales Cameroun
          { value: 'Douala', label: '🏙️ Douala' },
          { value: 'Yaoundé', label: '🏙️ Yaoundé' },
          { value: 'Garoua', label: '🏙️ Garoua' },
          { value: 'Bafoussam', label: '🏙️ Bafoussam' },
          { value: 'Bamenda', label: '🏙️ Bamenda' },
          { value: 'Maroua', label: '🏙️ Maroua' },
          { value: 'Ngaoundéré', label: '🏙️ Ngaoundéré' },
          { value: 'Bertoua', label: 'Bertoua' },
          { value: 'Ebolowa', label: 'Ebolowa' },
          { value: 'Kribi', label: '🏖️ Kribi' },
          { value: 'Kumba', label: 'Kumba' },
          { value: 'Limbe', label: '🏖️ Limbe' },
          { value: 'Nkongsamba', label: 'Nkongsamba' },
          { value: 'Buea', label: 'Buea' },
          { value: 'Édéa', label: 'Édéa' },
          { value: 'Mbalmayo', label: 'Mbalmayo' },
          { value: 'Dschang', label: 'Dschang' },
          { value: 'Foumban', label: 'Foumban' },
        ]
      },
      { id: 'dateTrajet', label: 'Date du trajet', type: 'date' },
      { id: 'nbPlacesDisponibles', label: 'Places disponibles', type: 'range', min: 1, max: 15, unit: 'places' },
      {
        id: 'typeVehiculeCovoiturage',
        label: 'Type de véhicule',
        type: 'select',
        options: [
          { value: 'Berline (4 places)', label: '🚗 Berline (4 places)' },
          { value: 'SUV (6-7 places)', label: '🚙 SUV (6-7 places)' },
          { value: 'Break (5-6 places)', label: '🚐 Break (5-6 places)' },
          { value: 'Minibus (9-15 places)', label: '🚐 Minibus (9-15 places)' },
          { value: 'Camionnette', label: '🚚 Camionnette' },
          { value: 'Voiture de luxe', label: '✨ Voiture de luxe' },
        ]
      },
      {
        id: 'frequenceTrajet',
        label: 'Fréquence',
        type: 'select',
        options: [
          { value: 'Trajet unique', label: '📅 Trajet unique' },
          { value: 'Quotidien', label: '🔄 Quotidien' },
          { value: 'Hebdomadaire', label: '📆 Hebdomadaire' },
          { value: 'Week-end', label: '🌴 Week-end' },
          { value: 'Occasionnel', label: '🎯 Occasionnel' },
          { value: 'Sur demande', label: '📞 Sur demande' },
        ]
      },
      {
        id: 'preferencesTrajet',
        label: 'Préférences',
        type: 'multiselect',
        options: [
          { value: 'Non-fumeur', label: '🚭 Non-fumeur' },
          { value: 'Climatisation', label: '❄️ Climatisation' },
          { value: 'Musique autorisée', label: '🎵 Musique autorisée' },
          { value: 'Silence apprécié', label: '🤫 Silence apprécié' },
          { value: 'Discussion agréable', label: '💬 Discussion agréable' },
          { value: 'Bagages volumineux acceptés', label: '🧳 Bagages volumineux' },
          { value: 'Animaux autorisés', label: '🐕 Animaux autorisés' },
          { value: 'Arrêts flexibles', label: '🛑 Arrêts flexibles' },
          { value: 'Trajet direct', label: '➡️ Trajet direct' },
        ]
      },
    ],
    style: {
      primaryColor: '#EC4899',
      gradientColors: ['#EC4899', '#DB2777'],
      icon: '🚗',
      badgeColor: '#FCE7F3',
      accentColor: '#DB2777',
    },
    displayPriority: ['name', 'villeDepart', 'villeArrivee', 'dateTrajet', 'heureTrajet', 'nbPlacesDisponibles', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'horizontal',
  },

  // 🎨 ARTICLES DE DÉCORATION
  decoration: {
    terminology: {
      productLabel: 'Article de décoration',
      productsLabel: 'Articles de décoration',
      priceLabel: 'Prix',
      locationLabel: 'Localisation',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher tableau, vase, coussin...',
      emptyMessage: 'Aucun article de décoration trouvé',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      { id: 'categorieDecoration', label: 'Catégorie', type: 'select', options: [] },
      { id: 'styleDecoration', label: 'Style', type: 'select', options: [] },
      { id: 'pieceDecoration', label: 'Pièce', type: 'select', options: [] },
      { id: 'matiereDecoration', label: 'Matière', type: 'select', options: [] },
      { id: 'couleurDecoration', label: 'Couleur', type: 'select', options: [] },
      { id: 'tailleDecoration', label: 'Taille', type: 'select', options: [] },
      { id: 'etatDecoration', label: 'État', type: 'select', options: [] },
      { id: 'marqueDecoration', label: 'Marque/Origine', type: 'select', options: [] },
    ],
    style: {
      primaryColor: '#E91E63',
      gradientColors: ['#E91E63', '#C2185B'],
      icon: '🎨',
      badgeColor: '#FCE4EC',
      accentColor: '#C2185B',
    },
    displayPriority: ['name', 'categorieDecoration', 'styleDecoration', 'couleurDecoration', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
  },

  // 👟 CHAUSSURES
  chaussure: {
    terminology: {
      productLabel: 'Chaussure',
      productsLabel: 'Chaussures',
      priceLabel: 'Prix',
      locationLabel: 'Localisation',
      providerLabel: 'Vendeur',
      searchPlaceholder: 'Rechercher basket, escarpin, botte...',
      emptyMessage: 'Aucune chaussure trouvée',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Prix croissant',
        price_desc: 'Prix décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      {
        id: 'genreChaussure',
        label: 'Genre',
        type: 'select',
        options: [
          { value: 'Homme', label: 'Homme' },
          { value: 'Femme', label: 'Femme' },
          { value: 'Enfant garçon', label: 'Enfant garçon' },
          { value: 'Enfant fille', label: 'Enfant fille' },
          { value: 'Bébé', label: 'Bébé' },
          { value: 'Unisexe', label: 'Unisexe' },
        ]
      },
      {
        id: 'typeChaussure',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'Baskets', label: 'Baskets' },
          { value: 'Chaussures de sport', label: 'Sport' },
          { value: 'Chaussures de ville', label: 'Ville' },
          { value: 'Sandales', label: 'Sandales' },
          { value: 'Bottes', label: 'Bottes' },
          { value: 'Bottines', label: 'Bottines' },
          { value: 'Escarpins', label: 'Escarpins' },
          { value: 'Mocassins', label: 'Mocassins' },
          { value: 'Tongs', label: 'Tongs/Claquettes' },
          { value: 'Ballerines', label: 'Ballerines' },
        ]
      },
      {
        id: 'marqueChaussure',
        label: 'Marque',
        type: 'select',
        options: [
          { value: 'Nike', label: 'Nike' },
          { value: 'Adidas', label: 'Adidas' },
          { value: 'Puma', label: 'Puma' },
          { value: 'Reebok', label: 'Reebok' },
          { value: 'Converse', label: 'Converse' },
          { value: 'Vans', label: 'Vans' },
          { value: 'Timberland', label: 'Timberland' },
          { value: 'New Balance', label: 'New Balance' },
          { value: 'Asics', label: 'Asics' },
        ]
      },
      {
        id: 'etatChaussure',
        label: 'État',
        type: 'select',
        options: [
          { value: 'Neuf avec boîte', label: 'Neuf avec boîte' },
          { value: 'Neuf sans boîte', label: 'Neuf sans boîte' },
          { value: 'Excellent état', label: 'Excellent état' },
          { value: 'Bon état', label: 'Bon état' },
          { value: 'État moyen', label: 'État moyen' },
        ]
      },
      {
        id: 'materiauChaussure',
        label: 'Matière',
        type: 'select',
        options: [
          { value: 'Cuir', label: 'Cuir' },
          { value: 'Cuir synthétique', label: 'Cuir synthétique' },
          { value: 'Tissu', label: 'Tissu' },
          { value: 'Toile', label: 'Toile' },
          { value: 'Synthétique', label: 'Synthétique' },
          { value: 'Daim', label: 'Daim' },
        ]
      },
      {
        id: 'usageChaussure',
        label: 'Usage',
        type: 'select',
        options: [
          { value: 'Sport', label: 'Sport' },
          { value: 'Running', label: 'Running' },
          { value: 'Ville', label: 'Ville' },
          { value: 'Casual', label: 'Casual' },
          { value: 'Formel', label: 'Formel' },
          { value: 'Plage', label: 'Plage' },
        ]
      },
      {
        id: 'pointure',
        label: 'Pointure',
        type: 'select',
        options: [
          { value: '35', label: '35' },
          { value: '36', label: '36' },
          { value: '37', label: '37' },
          { value: '38', label: '38' },
          { value: '39', label: '39' },
          { value: '40', label: '40' },
          { value: '41', label: '41' },
          { value: '42', label: '42' },
          { value: '43', label: '43' },
          { value: '44', label: '44' },
          { value: '45', label: '45' },
          { value: '46', label: '46' },
        ]
      },
      {
        id: 'couleurChaussure',
        label: 'Couleur',
        type: 'select',
        options: [
          { value: 'Noir', label: 'Noir' },
          { value: 'Blanc', label: 'Blanc' },
          { value: 'Marron', label: 'Marron' },
          { value: 'Gris', label: 'Gris' },
          { value: 'Bleu', label: 'Bleu' },
          { value: 'Rouge', label: 'Rouge' },
          { value: 'Beige', label: 'Beige' },
        ]
      },
    ],
    style: {
      primaryColor: '#F59E0B',
      gradientColors: ['#F59E0B', '#D97706'],
      icon: '👟',
      badgeColor: '#FEF3C7',
      accentColor: '#D97706',
    },
    displayPriority: ['name', 'variantesChaussures', 'typeChaussure', 'marqueChaussure', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'grid',
    supportsVariants: true, // ✅ Supporte les variantes (Pointure x Couleur)
    searchKeywords: [
      // Termes généraux
      'chaussure', 'soulier', 'godasse', 'pompe', 'croquenot',
      'shoe', 'shoes', 'footwear', 'sneaker', 'sneakers',
      // Friperie & Seconde main (Cameroun & Afrique francophone)
      'friperie chaussures', 'fripe chaussures', 'dead stock shoes',
      'chaussures occasion', 'chaussures seconde main',
      'okrika shoes', 'bend skin shoes', 'bendskin shoes',
      'mitumba shoes', 'kaki benda shoes',
      // Types populaires
      'basket', 'baskets', 'tennis', 'running',
      'escarpin', 'escarpins', 'talon', 'talons',
      'sandale', 'sandales', 'tong', 'tongs', 'claquette', 'claquettes',
      'botte', 'bottes', 'bottine', 'bottines',
      'mocassin', 'mocassins', 'derby', 'richelieu',
      'ballerine', 'ballerines', 'nu-pied', 'nu-pieds',
      'charentaise', 'pantoufle', 'chausson',
      // Marques populaires
      'nike', 'adidas', 'puma', 'reebok', 'new balance',
      'converse', 'vans', 'jordan', 'air max', 'yeezy',
      'timberland', 'caterpillar', 'clarks',
      // Usage
      'chaussures de sport', 'chaussures de ville',
      'chaussures de mariage', 'chaussures de soirée',
      'chaussures de football', 'chaussures de basket',
      'chaussures de course', 'chaussures de trail',
      // Marchés populaires
      'mokolo chaussures', 'sandaga chaussures',
      'adjamé chaussures', 'treichville chaussures',
      // Termes locaux Cameroun
      'makossa shoes', 'ndolé style shoes',
      // Termes locaux Sénégal
      'dakar shoes', 'sandaga shoes',
      // Termes locaux Côte d'Ivoire
      'adjamé shoes', 'cocody shoes',
      // Caractéristiques
      'pointure', 'taille chaussure', 'size',
      'cuir', 'synthétique', 'toile', 'daim',
      'compensé', 'plateforme', 'semelle',
      // Occasions
      'bureau', 'travail', 'casual', 'formel',
      'plage', 'piscine', 'sport', 'running',
    ],
  },

  // ❄️ FRIGORISTE / RÉPARATEUR FRIGO & CONGÉLATEUR - COMPLET AFRIQUE
  reparateur_frigo: {
    terminology: {
      productLabel: 'Prestation frigoriste',
      productsLabel: 'Frigoristes & Réparateurs Frigo',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Frigoriste/Technicien',
      searchPlaceholder: 'Rechercher frigoriste, réparateur frigo, dépanneur...',
      emptyMessage: 'Aucun frigoriste disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // FILTRE 1: Type de service frigoriste
      {
        id: 'serviceFrigoriste',
        label: 'Type de service',
        type: 'multiselect',
        options: [
          { value: 'Diagnostic panne réfrigérateur', label: 'Diagnostic frigo' },
          { value: 'Recharge gaz réfrigérant', label: 'Recharge gaz' },
          { value: 'Remplacement compresseur', label: 'Compresseur' },
          { value: 'Réparation thermostat', label: 'Thermostat' },
          { value: 'Nettoyage complet frigo', label: 'Nettoyage' },
          { value: 'Installation frigo neuf', label: 'Installation' },
          { value: 'Entretien préventif réfrigérateur', label: 'Entretien préventif' },
        ],
      },

      // FILTRE 2: Marques frigo
      {
        id: 'marqueFrigo',
        label: 'Marque frigo',
        type: 'multiselect',
        options: [
          { value: 'Samsung', label: 'Samsung' },
          { value: 'LG', label: 'LG' },
          { value: 'Hisense', label: 'Hisense' },
          { value: 'Haier', label: 'Haier' },
          { value: 'TCL', label: 'TCL' },
          { value: 'Bosch', label: 'Bosch' },
          { value: 'Whirlpool', label: 'Whirlpool' },
          { value: 'Beko', label: 'Beko' },
          { value: 'Midea', label: 'Midea' },
          { value: 'Toutes marques', label: 'Toutes marques' },
        ],
      },

      // FILTRE 3: Type d'appareil
      {
        id: 'typeAppareil',
        label: 'Type d\'appareil',
        type: 'multiselect',
        options: [
          { value: 'Réfrigérateur simple porte', label: 'Frigo simple porte' },
          { value: 'Réfrigérateur double porte', label: 'Frigo double porte' },
          { value: 'Réfrigérateur américain', label: 'Frigo américain' },
          { value: 'Congélateur armoire', label: 'Congélateur vertical' },
          { value: 'Congélateur coffre', label: 'Congélateur coffre' },
          { value: 'Réfrigérateur No Frost', label: 'No Frost' },
        ],
      },

      // FILTRE 4: Type de panne
      {
        id: 'typePanne',
        label: 'Type de panne',
        type: 'multiselect',
        options: [
          { value: 'Frigo ne refroidit pas', label: 'Ne refroidit pas' },
          { value: 'Fuite de gaz réfrigérant', label: 'Fuite gaz' },
          { value: 'Compresseur grillé', label: 'Compresseur HS' },
          { value: 'Thermostat défectueux', label: 'Thermostat' },
          { value: 'Givre excessif', label: 'Givre excessif' },
        ],
      },

      // FILTRE 5: Disponibilité/Urgence
      {
        id: 'disponibilite',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Urgence 24h/24', label: 'Urgence 24h/24' },
          { value: 'Intervention rapide', label: 'Intervention rapide' },
          { value: 'Rendez-vous sous 24h', label: 'Sous 24h' },
          { value: 'Rendez-vous sous 48h', label: 'Sous 48h' },
        ],
      },

      // FILTRE 6: Garantie
      {
        id: 'garantie',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: '1 mois', label: '1 mois' },
          { value: '3 mois', label: '3 mois' },
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
          { value: '2 ans', label: '2 ans' },
        ],
      },
    ],
    style: {
      primaryColor: '#06B6D4',
      gradientColors: ['#06B6D4', '#0891B2'],
      icon: '❄️',
      badgeColor: '#CFFAFE',
      accentColor: '#0891B2',
    },
    displayPriority: ['serviceFrigoriste', 'marqueFrigo', 'typeAppareil', 'disponibilite', 'garantie'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    searchKeywords: [
      // Mots-clés principaux
      'frigoriste', 'réparateur frigo', 'dépanneur frigo', 'technicien froid',
      'réparation réfrigérateur', 'réparation congélateur', 'dépannage frigo',
      'recharge gaz frigo', 'compresseur frigo', 'thermostat frigo',
      // Marques
      'samsung frigo', 'lg frigo', 'hisense frigo', 'haier frigo',
      'bosch frigo', 'whirlpool frigo', 'beko frigo', 'tcl frigo',
      // Services
      'diagnostic frigo', 'réparation urgence frigo', 'intervention rapide frigo',
      'dépannage 24h/24', 'réparation domicile frigo',
      // Pannes courantes
      'frigo ne refroidit pas', 'fuite gaz', 'compresseur hs',
      'givre excessif', 'thermostat défectueux',
      // Types
      'réparateur congélateur', 'frigoriste professionnel',
      'technicien climatisation', 'service froid',
    ],
  },

  // 📺 RÉPARATEUR ÉLECTRONIQUE (TV, RADIO, AUDIO, VIDÉO)
  reparateur_electronique: {
    terminology: {
      productLabel: 'Prestation réparation électronique',
      productsLabel: 'Réparateurs Électronique (TV/Radio/Audio)',
      priceLabel: 'Tarif',
      locationLabel: 'Zone d\'intervention',
      providerLabel: 'Réparateur/Technicien',
      searchPlaceholder: 'Rechercher réparateur TV, radio, home cinéma...',
      emptyMessage: 'Aucun réparateur électronique disponible dans cette zone',
      sortLabels: {
        relevance: 'Pertinence',
        price_asc: 'Tarif croissant',
        price_desc: 'Tarif décroissant',
        distance: 'Proximité',
      },
    },
    filters: [
      // FILTRE 1: Type de service électronique
      {
        id: 'serviceElectronique',
        label: 'Type de service',
        type: 'multiselect',
        options: [
          { value: 'Diagnostic panne TV', label: 'Diagnostic TV' },
          { value: 'Réparation écran noir', label: 'Écran noir' },
          { value: 'Remplacement dalle TV', label: 'Dalle TV' },
          { value: 'Réparation port HDMI', label: 'Port HDMI' },
          { value: 'Configuration Smart TV', label: 'Smart TV' },
          { value: 'Installation home cinéma', label: 'Home cinéma' },
          { value: 'Réparation barre de son', label: 'Barre de son' },
          { value: 'Installation décodeur satellite', label: 'Décodeur' },
          { value: 'Réparation vidéoprojecteur', label: 'Vidéoprojecteur' },
        ],
      },

      // FILTRE 2: Marques TV
      {
        id: 'marqueTv',
        label: 'Marque TV',
        type: 'multiselect',
        options: [
          { value: 'Samsung', label: 'Samsung' },
          { value: 'LG', label: 'LG' },
          { value: 'Hisense', label: 'Hisense' },
          { value: 'TCL', label: 'TCL' },
          { value: 'Sony', label: 'Sony' },
          { value: 'Panasonic', label: 'Panasonic' },
          { value: 'Nasco', label: 'Nasco' },
          { value: 'Bruhm', label: 'Bruhm' },
          { value: 'Polystar', label: 'Polystar' },
          { value: 'Toutes marques TV', label: 'Toutes marques' },
        ],
      },

      // FILTRE 3: Type d'appareil
      {
        id: 'typeAppareilElectronique',
        label: 'Type d\'appareil',
        type: 'multiselect',
        options: [
          { value: 'Téléviseur LED', label: 'TV LED' },
          { value: 'Téléviseur OLED', label: 'TV OLED' },
          { value: 'Téléviseur QLED', label: 'TV QLED' },
          { value: 'Smart TV', label: 'Smart TV' },
          { value: 'Home cinéma', label: 'Home cinéma' },
          { value: 'Barre de son', label: 'Barre de son' },
          { value: 'Décodeur satellite', label: 'Décodeur' },
          { value: 'Vidéoprojecteur', label: 'Projecteur' },
          { value: 'Poste radio', label: 'Radio' },
        ],
      },

      // FILTRE 4: Type de panne
      {
        id: 'typePanneElectronique',
        label: 'Type de panne',
        type: 'multiselect',
        options: [
          { value: 'TV ne s\'allume pas', label: 'TV éteinte' },
          { value: 'Écran noir (LED allumée)', label: 'Écran noir' },
          { value: 'Lignes verticales écran', label: 'Lignes écran' },
          { value: 'Pas de son', label: 'Pas de son' },
          { value: 'Port HDMI ne fonctionne pas', label: 'Port HDMI HS' },
          { value: 'Wi-Fi ne fonctionne pas', label: 'Wi-Fi HS' },
          { value: 'Écran cassé', label: 'Écran cassé' },
        ],
      },

      // FILTRE 5: Taille écran TV
      {
        id: 'tailleEcranTv',
        label: 'Taille écran',
        type: 'select',
        options: [
          { value: '32 pouces', label: '32"' },
          { value: '40 pouces', label: '40"' },
          { value: '43 pouces', label: '43"' },
          { value: '50 pouces', label: '50"' },
          { value: '55 pouces', label: '55"' },
          { value: '65 pouces', label: '65"' },
          { value: '75 pouces', label: '75"' },
        ],
      },

      // FILTRE 6: Disponibilité/Urgence
      {
        id: 'disponibiliteElectronique',
        label: 'Disponibilité',
        type: 'select',
        options: [
          { value: 'Urgence 24h/24', label: 'Urgence 24h/24' },
          { value: 'Intervention rapide', label: 'Intervention rapide' },
          { value: 'Rendez-vous sous 24h', label: 'Sous 24h' },
          { value: 'Rendez-vous sous 48h', label: 'Sous 48h' },
        ],
      },

      // FILTRE 7: Garantie
      {
        id: 'garantieElectronique',
        label: 'Garantie',
        type: 'select',
        options: [
          { value: '1 mois', label: '1 mois' },
          { value: '3 mois', label: '3 mois' },
          { value: '6 mois', label: '6 mois' },
          { value: '1 an', label: '1 an' },
        ],
      },
    ],
    style: {
      primaryColor: '#9C27B0',
      gradientColors: ['#9C27B0', '#7B1FA2'],
      icon: '📺',
      badgeColor: '#F3E5F5',
      accentColor: '#7B1FA2',
    },
    displayPriority: ['serviceElectronique', 'marqueTv', 'typeAppareilElectronique', 'disponibiliteElectronique', 'garantieElectronique'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    searchKeywords: [
      // Mots-clés principaux
      'réparateur tv', 'dépanneur tv', 'technicien électronique',
      'réparation télévision', 'réparation téléviseur', 'dépannage tv',
      'réparateur électronique', 'service tv', 'réparation écran tv',
      // Marques
      'samsung tv', 'lg tv', 'hisense tv', 'tcl tv', 'sony tv',
      'nasco tv', 'bruhm tv', 'polystar tv', 'panasonic tv',
      // Types d'appareils
      'réparation smart tv', 'réparation oled', 'réparation qled',
      'réparation home cinéma', 'réparation barre de son',
      'réparation décodeur', 'réparation vidéoprojecteur',
      'réparation radio', 'réparation audio', 'réparation vidéo',
      // Services
      'diagnostic tv', 'réparation urgence tv', 'intervention rapide tv',
      'configuration smart tv', 'installation home cinéma',
      'réparation écran noir', 'réparation dalle tv',
      // Pannes courantes
      'tv ne s\'allume pas', 'écran noir', 'lignes écran',
      'pas de son', 'port hdmi hs', 'wifi tv hs',
      // Technologie
      '4k tv', 'led tv', 'oled tv', 'qled tv', 'smart tv',
      'android tv', 'netflix tv', 'youtube tv',
      // Types
      'réparateur home cinéma', 'technicien audiovisuel',
      'dépannage électronique', 'service électronique',
    ],
  },

  // ⚠️ NOTE : Configuration "evenementiel" dupliquée supprimée (existait déjà ligne 6460)

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
        date: 'Récent',
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
          { value: '🥚 Produits Animaux (œufs, lait, miel)', label: '🥚 Produits Animaux' },
          { value: '🌱 Intrants Agricoles (semences, engrais)', label: '🌱 Intrants Agricoles' },
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
          { value: 'Cultures de rente', label: '☕ Cultures de rente' },
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
          { value: 'Autres animaux', label: '🐰 Autres animaux (lapins, escargots)' },
          { value: 'Poissons', label: '🐟 Poissons (aquaculture)' },
        ],
      },
      {
        id: 'unite_mesure',
        label: 'Unité de vente',
        type: 'select',
        options: [
          { value: 'Kilogramme (kg)', label: '⚖️ Kilogramme (kg)' },
          { value: 'Seau 15L (standard)', label: '🪣 Seau 15L' },
          { value: 'Sac 25 kg (standard)', label: '💼 Sac 25 kg' },
          { value: 'Cagio', label: '🧺 Cagio / Cageot' },
          { value: 'Tas', label: '🥔 Tas' },
          { value: 'Liasse', label: '🥬 Liasse / Botte' },
          { value: 'Alvéole 30 œufs (plateau)', label: '🥚 Alvéole (œufs)' },
          { value: 'Ver', label: '🥜 Ver' },
          { value: 'Unité', label: '1️⃣ Unité / Pièce / Tête' },
          { value: 'Régime', label: '🍌 Régime (bananes)' },
          { value: 'Litre', label: '🥛 Litre' },
        ],
      },
      {
        id: 'origine_geographique',
        label: 'Origine / Provenance',
        type: 'select',
        options: [
          { value: '🇨🇲 Cameroun', label: '🇨🇲 Cameroun' },
          { value: '🇨🇮 Côte d\'Ivoire', label: '🇨🇮 Côte d\'Ivoire' },
          { value: '🇸🇳 Sénégal', label: '🇸🇳 Sénégal' },
          { value: '🇲🇱 Mali', label: '🇲🇱 Mali' },
          { value: '🇧🇯 Bénin', label: '🇧🇯 Bénin' },
          { value: '🇹🇬 Togo', label: '🇹🇬 Togo' },
          { value: '🇧🇫 Burkina Faso', label: '🇧🇫 Burkina Faso' },
          { value: '🇬🇦 Gabon', label: '🇬🇦 Gabon' },
          { value: '🇨🇩 RD Congo', label: '🇨🇩 RD Congo' },
          { value: '🏡 Production locale', label: '🏡 Production locale' },
        ],
      },
      {
        id: 'methode_production',
        label: 'Méthode de production',
        type: 'select',
        options: [
          { value: '🌱 Agriculture biologique', label: '🌱 Agriculture biologique' },
          { value: '🌱 Agriculture conventionnelle', label: '🌱 Agriculture conventionnelle' },
          { value: '🌱 Agroécologie', label: '🌱 Agroécologie' },
          { value: '🌱 Agriculture traditionnelle', label: '🌱 Agriculture traditionnelle' },
          { value: '🐄 Élevage traditionnel', label: '🐄 Élevage traditionnel' },
          { value: '🐄 Élevage moderne', label: '🐄 Élevage moderne' },
          { value: '🐄 Élevage biologique', label: '🐄 Élevage biologique' },
        ],
      },
      {
        id: 'qualite_labels',
        label: 'Qualité / Labels',
        type: 'multiselect',
        options: [
          { value: '✅ Bio certifié', label: '✅ Bio certifié' },
          { value: '✅ Commerce équitable', label: '✅ Commerce équitable' },
          { value: '✅ Sans pesticides', label: '✅ Sans pesticides' },
          { value: '✅ Sans OGM', label: '✅ Sans OGM' },
          { value: '✅ Halal', label: '✅ Halal' },
          { value: '🌟 Produit frais du jour', label: '🌟 Frais du jour' },
          { value: '🌟 Production locale', label: '🌟 Production locale' },
          { value: '🌟 Circuit court', label: '🌟 Circuit court' },
        ],
      },
      {
        id: 'etat_fraicheur',
        label: 'État / Fraîcheur',
        type: 'select',
        options: [
          { value: '✨ Ultra-frais (récolte jour même)', label: '✨ Ultra-frais (récolte jour même)' },
          { value: '✨ Très frais (récolte veille)', label: '✨ Très frais (récolte veille)' },
          { value: '✨ Frais (2-3 jours)', label: '✨ Frais (2-3 jours)' },
          { value: '🐄 Animal vivant sur pied', label: '🐄 Animal vivant sur pied' },
          { value: '🐄 Vacciné', label: '🐄 Vacciné' },
          { value: '📦 Séché', label: '📦 Séché' },
          { value: '📦 Fumé', label: '📦 Fumé' },
        ],
      },
      {
        id: 'saison_disponibilite',
        label: 'Saison / Disponibilité',
        type: 'select',
        options: [
          { value: '🌞 Toute l\'année', label: '🌞 Toute l\'année' },
          { value: '🌞 Disponible actuellement', label: '🌞 Disponible actuellement' },
          { value: '☔ Saison des pluies', label: '☔ Saison des pluies' },
          { value: '☀️ Saison sèche', label: '☀️ Saison sèche' },
          { value: '🌾 Période de récolte', label: '🌾 Période de récolte' },
          { value: '⏰ Sur commande uniquement', label: '⏰ Sur commande' },
        ],
      },
      {
        id: 'type_vente',
        label: 'Type de vente',
        type: 'select',
        options: [
          { value: '🏪 Vente au détail', label: '🏪 Vente au détail' },
          { value: '🏪 Vente en gros', label: '🏪 Vente en gros' },
          { value: '🏪 Demi-gros', label: '🏪 Demi-gros' },
          { value: '🛒 Vente directe producteur', label: '🛒 Vente directe producteur' },
          { value: '🛒 Circuit court', label: '🛒 Circuit court' },
          { value: '🏪 Vente au marché', label: '🏪 Vente au marché' },
          { value: '🚚 Livraison possible', label: '🚚 Livraison possible' },
          { value: '💰 Prix négociable', label: '💰 Prix négociable' },
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
    displayPriority: ['categorie_principale', 'type_produit', 'unite_mesure', 'origine_geographique', 'qualite_labels', 'prix'],
    contactMethods: ['whatsapp', 'phone', 'message'],
    showDistance: true,
    showRating: true,
    cardLayout: 'vertical',
    supportsVariants: false, // Produits agricoles généralement sans variantes (mais on pourrait activer si besoin)
    searchKeywords: [
      // ──── AGRICULTURE ────
      'agriculture', 'agricole', 'ferme', 'fermier', 'paysan', 'cultivateur',
      'maraichage', 'maraîchage', 'maraîcher', 'potager', 'jardin', 'jardinage',
      'culture', 'plantation', 'récolte', 'recolte', 'semence', 'graine',

      // ──── ÉLEVAGE ────
      'elevage', 'élevage', 'éleveur', 'eleveur', 'bétail', 'betail',
      'animal', 'animaux', 'ferme animaux', 'ferme d\'élevage',

      // ──── PRODUITS AGRICOLES ────
      'légume', 'legume', 'fruit', 'céréale', 'cereale',
      'tubercule', 'légumineuse', 'legumineuse', 'épice', 'epice',

      // Légumes africains spécifiques
      'ndolé', 'ndole', 'okok', 'eru', 'koki', 'gombo', 'okra',
      'feuille de manioc', 'pondu', 'saka-saka', 'saka saka',
      'amarante', 'gboma', 'morelle', 'gnétum', 'gnetum',

      // Fruits africains
      'mangue', 'avocat', 'papaye', 'ananas', 'banane', 'plantain',
      'safou', 'prune africaine', 'corossol', 'maracuja', 'passion',
      'noix de palme', 'noix de coco', 'karité', 'karite',

      // Tubercules
      'manioc', 'igname', 'patate douce', 'macabo', 'taro',

      // Céréales
      'maïs', 'mais', 'riz', 'mil', 'sorgho', 'fonio',

      // ──── ANIMAUX D'ÉLEVAGE ────
      'bœuf', 'boeuf', 'vache', 'taureau', 'zébu', 'zebu',
      'mouton', 'bélier', 'belier', 'agneau', 'ovin',
      'chèvre', 'chevre', 'bouc', 'cabri', 'caprin',
      'porc', 'cochon', 'truie', 'porcelet', 'porcin',
      'poulet', 'poule', 'coq', 'poussin', 'volaille',
      'canard', 'dinde', 'pintade', 'oie', 'caille',
      'lapin', 'escargot', 'aulacode', 'agouti', 'grasscutter',

      // Races locales
      'poulet bicyclette', 'poulet local', 'poulet villageois',
      'mouton djallonké', 'djallonke', 'mouton sahélien', 'sahelien',
      'zébu foulbé', 'zebu foulbe', 'goudali', 'ndama',

      // ──── PRODUITS ANIMAUX ────
      'œuf', 'oeuf', 'lait', 'miel', 'cire', 'propolis',

      // ──── INTRANTS ────
      'semence', 'engrais', 'fumier', 'compost', 'pesticide',
      'aliment volaille', 'aliment porc', 'aliment bétail',
      'vaccin animal', 'médicament vétérinaire', 'veterinaire',

      // ──── MATÉRIEL ────
      'tracteur', 'charrue', 'houe', 'machette', 'pulvérisateur', 'pulverisateur',
      'poulailler', 'porcherie', 'étable', 'etable', 'bergerie', 'clapier',

      // ──── CONTEXTE AFRICAIN ────
      'producteur Cameroun', 'producteur Douala', 'producteur Yaoundé', 'producteur Yaounde',
      'producteur Côte d\'Ivoire', 'producteur Cote d\'Ivoire', 'producteur Abidjan',
      'producteur Sénégal', 'producteur Senegal', 'producteur Dakar',
      'ferme Cameroun', 'ferme Douala', 'ferme bio',
      'éleveur Cameroun', 'eleveur Cameroun',

      // ──── UNITÉS DE MESURE LOCALES ────
      'seau', 'sac', 'cagio', 'cagnon', 'cageot', 'tas', 'liasse', 'botte',
      'alvéole', 'alveole', 'régime', 'regime', 'ver', 'panier',

      // ──── QUALITÉ ────
      'bio', 'biologique', 'organique', 'sans pesticide',
      'frais', 'local', 'circuit court', 'producteur local',

      // ──── SAISONS ────
      'saison pluies', 'saison sèche', 'saison seche', 'récolte', 'recolte',

      // ──── LIEUX DE VENTE ────
      'marché', 'marche', 'marché central', 'marché vivrier',
      'ferme vente directe', 'exploitation agricole',
    ],
  },
};

/**
 * Récupère la configuration pour une catégorie donnée
 */
export const getCategoryConfig = (category: string): CategoryConfig => {
  // ✅ ALIAS pour compatibilité et rétrocompatibilité
  let categoryKey = category;

  // aliments (obsolète) → agroalimentaire (enrichie)
  if (category === 'aliments') categoryKey = 'agroalimentaire';

  // agriculture (ancien nom) → producteurs_locaux (nouveau nom)
  if (category === 'agriculture' || category === 'agriculture_elevage' || category === 'elevage') {
    categoryKey = 'producteurs_locaux';
  }

  // ✅ NOUVEAU: Aliases pour forgeron / ferronnerie
  if (
    category === 'ferronnerie' ||
    category === 'ferronnerie_art' ||
    category === 'ferronnerie_dart' ||
    category === 'ferronnier' ||
    category === 'fer_forge' ||
    category === 'metallerie' ||
    category === 'metallier' ||
    category === 'serrurerie' ||
    category === 'serrurier_metallier' ||
    category === 'travail_metal' ||
    category === 'travail_fer' ||
    category === 'artisan_fer'
  ) {
    categoryKey = 'forgeron';
  }

  return CATEGORY_CONFIGS[categoryKey] || CATEGORY_CONFIGS.default;
};

/**
 * ✅ NOUVEAU: Recherche de catégorie par mot-clé local africain
 * Permet de retrouver une catégorie via des termes populaires (friperie, okrika, mitumba, etc.)
 * @param keyword - Mot-clé recherché (ex: "friperie", "okrika", "dead stock")
 * @returns Nom de la catégorie correspondante ou null
 */
export const findCategoryByKeyword = (keyword: string): string | null => {
  const normalizedKeyword = keyword.toLowerCase().trim();

  for (const [categoryName, config] of Object.entries(CATEGORY_CONFIGS)) {
    if (config.searchKeywords) {
      const matchingKeyword = config.searchKeywords.find(kw =>
        kw.toLowerCase() === normalizedKeyword ||
        kw.toLowerCase().includes(normalizedKeyword) ||
        normalizedKeyword.includes(kw.toLowerCase())
      );

      if (matchingKeyword) {
        return categoryName;
      }
    }
  }

  return null;
};

/**
 * ✅ NOUVEAU: Obtient tous les mots-clés pour une catégorie
 * @param category - Nom de la catégorie
 * @returns Liste des mots-clés ou tableau vide
 */
export const getCategoryKeywords = (category: string): string[] => {
  const config = getCategoryConfig(category);
  return config.searchKeywords || [];
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

/**
 * ✅ NOUVEAU: Vérifie si une catégorie supporte les variantes de produit
 */
export const categorySupportsVariants = (category: string): boolean => {
  return getCategoryConfig(category).supportsVariants === true;
};

/**
 * ✅ NOUVEAU: Liste des catégories qui supportent les variantes
 */
export const VARIANT_SUPPORTED_CATEGORIES = [
  'agroalimentaire',  // ✅ Agroalimentaire: Conditionnement × Prix × Stock × Images
  'aliments',         // ✅ ALIAS obsolète (redirige vers agroalimentaire)
  'chaussure',        // ✅ Chaussures: Pointure × Couleur × Prix × Images
  'hotellerie',       // ✅ Hôtellerie: Type chambre × Capacité × Prix/nuit × Image
  // Ajoutez ici d'autres catégories qui auront besoin de variantes
  // Ex: 'cosmetique_parfum' (différentes tailles de parfum), etc.
];
