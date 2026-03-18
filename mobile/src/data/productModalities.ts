// Système complet de modalités pour les produits organisées par catégorie
// Permet l'ajout de nouvelles modalités par l'utilisateur

import { TOUS_LES_PAYS } from './africanLocations';
import { ASSURANCE_MODALITIES } from './assuranceModalities';
import { genererListeConcours, genererMatieresPreparationConcours } from './concoursGrandesEcoles';
import { genererMatieres, genererNiveauxScolaires } from './educationSystems';
import { genererTousLesLaboratoires } from './laboratoiresAfricains';

// ✅ IMPORT: Hôpitaux RÉELS uniquement (pas de templates)
import { getHopitauxAfricains } from './hopitauxReelsAfricains';

// ✅ IMPORT: Pharmacies RÉELLES uniquement
import { getPharmaciesAfricaines } from './pharmaciesReellesAfricaines';

// ✅ FONCTION SIMPLIFIÉE: Utiliser uniquement les hôpitaux RÉELS
export const genererHopitauxAfricains = (codePaysUtilisateur: string = 'CM'): string[] => {
  return getHopitauxAfricains(codePaysUtilisateur);
};

// ✅ FONCTION SIMPLIFIÉE: Utiliser uniquement les pharmacies RÉELLES
export const genererPharmaciesAfricaines = (codePaysUtilisateur: string = 'CM'): string[] => {
  return getPharmaciesAfricaines(codePaysUtilisateur);
};

// ✅ L'ancien code fictif a été supprimé - maintenant dans hopitauxReelsAfricains.ts et pharmaciesReellesAfricaines.ts

export interface ModalityCategory {
  [key: string]: string[];
}

// ✅ FONCTION UTILITAIRE: Génère la liste de toutes les villes avec PRIORITÉ au pays de l'utilisateur
export const genererToutesLesVilles = (codePaysUtilisateur: string = 'CM'): string[] => {
  const villes: string[] = [];

  // 1️⃣ D'abord les villes du pays de l'utilisateur (PRIORITÉ)
  const paysPrioritaire = TOUS_LES_PAYS.find(p => p.code === codePaysUtilisateur);
  if (paysPrioritaire) {
    paysPrioritaire.villes.forEach(ville => {
      villes.push(`${paysPrioritaire.emoji} ${ville.nom}`);
    });

    // Séparateur visuel
    if (TOUS_LES_PAYS.length > 1) {
      villes.push('─────── Autres pays ───────');
    }
  }

  // 2️⃣ Ensuite les villes des autres pays
  TOUS_LES_PAYS.filter(p => p.code !== codePaysUtilisateur).forEach(pays => {
    // Prendre les 3-5 plus grandes villes par pays
    const nbVilles = ['CD', 'CI', 'SN', 'ML', 'MG'].includes(pays.code) ? 5 : 3;
    pays.villes.slice(0, nbVilles).forEach(ville => {
      villes.push(`${pays.emoji} ${ville.nom}`);
    });
  });

  villes.push('\uD83C\uDD95 Autre (ajouter)');
  return villes;
};

// ✅ FONCTION UTILITAIRE: Génère la liste des quartiers avec PRIORITÉ au pays
export const genererQuartiersPays = (codePays: string = 'CM'): string[] => {
  const pays = TOUS_LES_PAYS.find(p => p.code === codePays);
  if (!pays) return ['Centre-ville', '\uD83C\uDD95 Autre (ajouter)'];

  const quartiers: string[] = [];
  pays.villes.forEach(ville => {
    if (ville.quartiers) {
      ville.quartiers.forEach(q => {
        if (!quartiers.includes(q)) {
          quartiers.push(q);
        }
      });
    }
  });

  if (quartiers.length === 0) {
    return ['Centre-ville', '\uD83C\uDD95 Autre (ajouter)'];
  }

  quartiers.push('\uD83C\uDD95 Autre (ajouter)');
  return quartiers;
};

// ✅ FONCTION UTILITAIRE: Génère zones d'intervention avec PRIORITÉ au pays de l'utilisateur  
export const genererZonesIntervention = (codePaysUtilisateur: string = 'CM'): string[] => {
  const zones: string[] = [];

  // ════════════════════════════════════════════════════════════
  // \uD83D\uDCCD NIVEAU 1: ZONES LARGES (choix rapide en 1 clic)
  // ════════════════════════════════════════════════════════════
  zones.push('\uD83C\uDF0D Toute l\'Afrique francophone');
  zones.push('\uD83C\uDF0D International (hors Afrique)');

  // Pays de l'utilisateur en PREMIER
  const paysPrioritaire = TOUS_LES_PAYS.find(p => p.code === codePaysUtilisateur);
  if (paysPrioritaire) {
    zones.push(`${paysPrioritaire.emoji} Tout le ${paysPrioritaire.nom}`);
  }

  // Autres pays (tri alphabétique)
  TOUS_LES_PAYS.filter(p => p.code !== codePaysUtilisateur)
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .forEach(pays => {
      zones.push(`${pays.emoji} Tout le ${pays.nom}`);
    });

  zones.push('──────── \uD83C\uDFAF Villes & Quartiers ci-dessous ────────');

  // ════════════════════════════════════════════════════════════
  // \uD83D\uDCCD NIVEAU 2: PAYS DE L'UTILISATEUR (DÉTAILLÉ)
  // ════════════════════════════════════════════════════════════
  if (paysPrioritaire) {
    zones.push(`─── ${paysPrioritaire.emoji} ${paysPrioritaire.nom.toUpperCase()} (VOTRE PAYS) ───`);

    // Toutes les villes du pays
    paysPrioritaire.villes.forEach(ville => {
      zones.push(`${paysPrioritaire.emoji} ${ville.nom} (toute la ville)`);
    });

    // Quartiers des 2-3 plus grandes villes
    paysPrioritaire.villes.slice(0, 3).forEach(ville => {
      if (ville.quartiers && ville.quartiers.length > 0) {
        zones.push(`─── ${paysPrioritaire.emoji} Quartiers de ${ville.nom} ───`);
        ville.quartiers.forEach(quartier => {
          zones.push(`${paysPrioritaire.emoji} ${ville.nom} - ${quartier}`);
        });
      }
    });
  }

  // ════════════════════════════════════════════════════════════
  // \uD83D\uDCCD NIVEAU 3: AUTRES PAYS (villes principales uniquement)
  // ════════════════════════════════════════════════════════════
  const autresPays = TOUS_LES_PAYS.filter(p => p.code !== codePaysUtilisateur);

  autresPays.forEach(pays => {
    // Séparateur par pays
    zones.push(`─── ${pays.emoji} ${pays.nom.toUpperCase()} ───`);

    // Prendre les 3-5 plus grandes villes par pays
    const nbVilles = ['CD', 'CI', 'SN', 'ML', 'MG'].includes(pays.code) ? 5 : 3;
    pays.villes.slice(0, nbVilles).forEach(ville => {
      zones.push(`${pays.emoji} ${ville.nom} (toute la ville)`);
    });
  });

  zones.push('\uD83C\uDD95 Autre (ajouter)');
  return zones;
};

// ✅ MODALITÉS AUTOMOBILE - ENRICHIES POUR AFRIQUE FRANCOPHONE
export const AUTOMOBILE_MODALITIES: ModalityCategory = {
  // ✅ Types de véhicules (NOUVEAU)
  types: [
    'Voiture', 'Moto', 'Scooter', 'Camion', 'Camionnette', 'Pick-up',
    'SUV', '4x4', 'Utilitaire', 'Minibus', 'Bus',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types de carrosserie (NOUVEAU)
  carrosseries: [
    'Berline', 'SUV', '4x4', 'Break', 'Coupé', 'Cabriolet',
    'Monospace', 'Pick-up', 'Utilitaire', 'Roadster', 'Crossover',
    'Citadine',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Marques automobiles (ENRICHI - Focus marques populaires en Afrique)
  marques: [
    // Marques japonaises (très populaires en Afrique)
    'Toyota', 'Nissan', 'Honda', 'Mazda', 'Mitsubishi', 'Suzuki',
    'Isuzu', 'Subaru', 'Lexus', 'Infiniti',
    // Marques européennes (populaires)
    'Peugeot', 'Renault', 'Citroën', 'Mercedes-Benz', 'BMW', 'Audi',
    'Volkswagen', 'Ford', 'Hyundai', 'Kia',
    // Autres marques
    'Chevrolet', 'Jeep', 'Land Rover', 'Porsche', 'Volvo',
    'Fiat', 'Opel', 'Seat', 'Skoda', 'Dacia',
    // Marques de luxe (moins fréquent mais présent)
    'Ferrari', 'Lamborghini', 'Bentley', 'Rolls-Royce', 'Aston Martin',
    'McLaren', 'Bugatti', 'Tesla', 'Alfa Romeo', 'Maserati',
    'Jaguar', 'Mini', 'Smart',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Couleurs (ENRICHI)
  couleurs: [
    'Blanc', 'Noir', 'Gris', 'Argent', 'Bleu', 'Rouge', 'Vert',
    'Beige', 'Marron', 'Orange', 'Jaune', 'Violet', 'Or', 'Bronze',
    'Bordeaux', 'Gris métallisé', 'Bleu métallisé', 'Rouge métallisé',
    'Vert métallisé', 'Bi-ton',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types de carburant
  carburant: [
    'Essence', 'Diesel', 'Hybride', 'Hybride rechargeable',
    'Électrique', 'GPL', 'Bioéthanol', 'Hydrogène',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types de transmission
  transmission: [
    'Manuelle', 'Automatique', 'Semi-automatique', 'CVT',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ États du véhicule
  etat: [
    'Neuf', 'Excellent état', 'Très bon état', 'Bon état',
    'État moyen', 'À réparer', 'Pour pièces',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Nombre de portes (NOUVEAU)
  portes: [
    '2 portes', '3 portes', '4 portes', '5 portes',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Nombre de places (NOUVEAU)
  places: [
    '2 places', '4 places', '5 places', '7 places',
    '9 places', '12+ places',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Papiers administratifs (NOUVEAU - Contexte africain)
  papiers: [
    'En règle', 'Carte grise disponible', 'Carte grise à refaire',
    'Dédouanée', 'Non dédouanée', 'À immatriculer',
    'Contrat d\'achat disponible', 'Visite technique valide',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Équipements (NOUVEAU)
  equipements: [
    'Climatisation', 'Climatisation automatique', 'Vitres électriques',
    'GPS / Navigation', 'Bluetooth', 'Caméra de recul', 'Radar de recul',
    'Toit ouvrant', 'Toit panoramique', 'Sièges cuir', 'Sièges chauffants',
    'Régulateur de vitesse', 'Limiteur de vitesse', 'Verrouillage centralisé',
    'ABS', 'ESP', 'Airbags', 'Jantes alliage', 'Antibrouillards',
    'Xénon / LED', 'Système audio premium', 'Écran tactile',
    'Apple CarPlay', 'Android Auto', 'Détecteur angle mort',
    'Freinage automatique', 'Assistance parking', 'Démarrage sans clé',
    'Hayon électrique',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS IMMOBILIER - SYSTÈME INTELLIGENT MULTI-PAYS
// S'adapte automatiquement au pays de l'utilisateur
export const IMMOBILIER_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE BIENS (20+) - ENRICHI
  types: [
    // Résidentiel
    'Appartement', 'Studio', 'F1 (1 pièce)', 'F2 (2 pièces)', 'F3 (3 pièces)',
    'F4 (4 pièces)', 'F5 (5 pièces)', 'F6+ (6 pièces et plus)',
    'Villa', 'Maison individuelle', 'Duplex', 'Triplex', 'Penthouse', 'Loft',
    'Chambre meublée', 'Chambre en colocation',
    // Commercial
    'Bureau', 'Local commercial', 'Boutique', 'Showroom', 'Entrepôt', 'Hangar',
    'Immeuble de rapport', 'Immeuble commercial',
    // Autres
    'Ferme', 'Terrain nu', 'Terrain viabilisé',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ STATUTS (8) - ENRICHI
  statuts: [
    'À vendre', 'À louer (bail)', 'À louer meublé', 'Location courte durée',
    'Colocation', 'Location-vente', 'Vente en viager', 'Sous-location',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ STANDING (5) - NOUVEAU
  standing: [
    'Économique', 'Standard', 'Bon standing', 'Haut standing', 'Luxe / Prestige',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTAT GÉNÉRAL (6) - NOUVEAU
  etat: [
    'Neuf (jamais habité)', 'Excellent état', 'Bon état', 'État moyen',
    'À rafraîchir', 'À rénover entièrement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ VILLES - Toutes les villes d'Afrique francophone avec priorité pays utilisateur
  // NOTE: Par défaut 'CM' (Cameroun), mais s'adapte automatiquement via getModalitiesWithUserContext()
  villes: genererToutesLesVilles('CM'),

  // ✅ QUARTIERS - Tous les quartiers du pays (s'adapte au pays utilisateur)
  quartiers: genererQuartiersPays('CM'),

  // ✅ QUARTIERS PAR VILLE - Fonction pour récupérer quartiers d'une ville spécifique
  // Utilisée quand l'utilisateur sélectionne une ville
  quartiers_douala: (() => {
    const pays = TOUS_LES_PAYS.find(p => p.code === 'CM');
    const ville = pays?.villes.find(v => v.nom === 'Douala');
    return ville?.quartiers ? [...ville.quartiers, '\uD83C\uDD95 Autre (ajouter)'] : ['Centre-ville', '\uD83C\uDD95 Autre (ajouter)'];
  })(),

  quartiers_yaounde: (() => {
    const pays = TOUS_LES_PAYS.find(p => p.code === 'CM');
    const ville = pays?.villes.find(v => v.nom === 'Yaoundé');
    return ville?.quartiers ? [...ville.quartiers, '\uD83C\uDD95 Autre (ajouter)'] : ['Centre-ville', '\uD83C\uDD95 Autre (ajouter)'];
  })(),

  // ✅ AMEUBLEMENT (6) - ENRICHI
  ameublement: [
    'Non meublé', 'Partiellement meublé', 'Semi-meublé',
    'Meublé standard', 'Meublé + équipé', 'Meublé haut de gamme',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉQUIPEMENTS (35+) - NOUVEAU ET ADAPTÉ AU CONTEXTE CAMEROUN
  equipements: [
    // Essentiel Cameroun
    'Eau courante', 'Eau courante 24h/24', 'Réservoir d\'eau', 'Forage/Puits',
    'Électricité ENEO', 'Groupe électrogène', 'Panneaux solaires',
    // Sécurité
    'Gardien/Gardiennage', 'Portail électrique', 'Clôture sécurisée',
    'Caméras de surveillance', 'Alarme',
    // Confort
    'Climatisation', 'Ventilateurs plafond', 'Cuisine équipée', 'Cuisinière/Gaz',
    // Connectivité
    'Internet/Fibre', 'WiFi', 'Parabole/Canal+',
    // Espaces
    'Balcon', 'Terrasse', 'Véranda', 'Jardin', 'Cour privée',
    // Garage/Parking
    'Garage fermé', 'Parking couvert', 'Parking extérieur', 'Espace 2+ voitures',
    // Sanitaire/Eau
    'Eau chaude', 'Chauffe-eau', 'Douche moderne',
    // Autres
    'Ascenseur', 'Concierge', 'Piscine', 'Salle de sport', 'Buanderie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ PROXIMITÉS (15+) - NOUVEAU ET ADAPTÉ
  proximites: [
    'École primaire', 'École secondaire', 'Université', 'Centre de santé',
    'Hôpital', 'Pharmacie', 'Supermarché/Mahima', 'Marché', 'Station-service',
    'Banque/GAB', 'Transport public', 'Gare routière', 'Église', 'Mosquée',
    'Restaurants/Maquis', 'Centre commercial',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ACCÈS ROUTIER (8) - NOUVEAU
  acces_route: [
    'Route goudronnée', 'Route en bon état', 'Route carrossable',
    'Piste en terre', 'Rue pavée', 'Chemin d\'accès difficile',
    'Accès 4x4 recommandé', 'Zone inondable saison pluies',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE BAIL (Location) - NOUVEAU
  types_bail: [
    '1 mois renouvelable', '3 mois', '6 mois', '1 an', '2 ans',
    '3 ans et plus', 'Bail commercial 3-6-9', 'Sans bail écrit',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CONDITIONS LOCATION (12+) - NOUVEAU
  conditions_location: [
    'Caution 1 mois', 'Caution 2 mois', 'Caution 3 mois',
    'Avance 1 mois', 'Avance 2 mois', 'Avance 3 mois',
    'Frais agence inclus', 'Frais agence à la charge du locataire',
    'Garant exigé', 'Fiche de paie exigée', 'Contrat de travail exigé',
    'Paiement annuel accepté', 'Paiement trimestriel accepté',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ORIENTATIONS (9) - EXISTANT
  orientations: [
    'Nord', 'Sud', 'Est', 'Ouest',
    'Nord-Est', 'Nord-Ouest', 'Sud-Est', 'Sud-Ouest',
    'Toutes orientations',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS IMMOBILIER TERRAIN - SPÉCIFIQUE TERRAINS (NOUVEAU)
// Modalités dédiées exclusivement aux terrains (résidentiel, commercial, agricole, industriel)
export const IMMOBILIER_TERRAIN_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE TERRAIN (12+) - Contexte Cameroun
  types_terrain: [
    'Résidentiel', 'Commercial', 'Agricole', 'Industriel', 'Mixte (Résidentiel/Commercial)',
    'Lotissement résidentiel', 'Zone villa', 'Terrain constructible',
    'Terrain nu non viabilisé', 'Terrain de plantation', 'Exploitation agricole',
    'Zone artisanale',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ STATUT DU TERRAIN (8)
  statuts: [
    'À vendre', 'Vendu', 'Réservé', 'Option d\'achat',
    'En cours de viabilisation', 'Location longue durée', 'Concession foncière',
    'Disponible immédiatement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ VIABILISATION (10+) - CRITIQUE pour Cameroun
  viabilisation: [
    'Viabilisé complet (Eau + Électricité + Route)',
    'Partiellement viabilisé (Électricité + Route)',
    'Partiellement viabilisé (Eau + Route)',
    'Partiellement viabilisé (Route uniquement)',
    'Non viabilisé', 'À viabiliser',
    'Raccordement ENEO proche (< 100m)', 'Raccordement CDE proche (< 100m)',
    'Forage existant', 'Puits existant',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ZONAGE / AFFECTATION (12+)
  zonage: [
    'Zone résidentielle R1', 'Zone résidentielle R2', 'Zone résidentielle R3',
    'Zone commerciale C1', 'Zone commerciale C2',
    'Zone industrielle I1', 'Zone industrielle I2',
    'Zone agricole A', 'Zone mixte M',
    'Zone villas haut standing', 'Zone économique',
    'Hors plan d\'urbanisme',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FORME DU TERRAIN (10)
  forme_terrain: [
    'Rectangulaire', 'Carré', 'Irrégulier', 'Trapézoïdal', 'Triangulaire',
    'L-Shape (forme en L)', 'Angle de rue (2 façades)',
    'Longiligne', 'Polygone régulier', 'Atypique',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TOPOGRAPHIE (10+) - Important contexte Cameroun
  topographie: [
    'Plat', 'Légère pente (< 5%)', 'Pente moyenne (5-15%)',
    'Pente importante (15-30%)', 'Forte pente (> 30%)',
    'Vallonné', 'En contrebas', 'Surplombant',
    'Zone inondable (saison pluies)', 'Terrain en hauteur (vue panoramique)',
    'Mi-pente',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ACCÈS TERRAIN (12+) - Adapté routes Cameroun
  acces_terrain: [
    'Route goudronnée en bon état', 'Route goudronnée dégradée',
    'Route carrossable toute saison', 'Route carrossable (saison sèche uniquement)',
    'Piste en terre battue', 'Chemin d\'accès aménagé',
    'Chemin d\'accès difficile', 'Accès 4x4 recommandé',
    'Accès par rue pavée', 'Impasse', 'Voie principale',
    'Double accès (2 entrées)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ VÉGÉTATION / ÉTAT DU SOL (10+)
  vegetation: [
    'Dégagé (terrain nu)', 'Arbustes épars', 'Arbres fruitiers',
    'Arbres (bois d\'œuvre)', 'Dense (débroussaillage nécessaire)',
    'Forêt', 'Cultivé (plantation active)', 'En friche',
    'Pelouse/Gazon', 'Marécageux (assainissement requis)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ USAGE ACTUEL (8)
  usage_actuel: [
    'Vacant (aucune utilisation)', 'Cultivé (plantation cacao/café)',
    'Cultivé (maraîchage)', 'Cultivé (palmiers à huile)',
    'Bâti (construction existante)', 'En friche',
    'Pâturage', 'Exploitation forestière',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ RÉSEAUX DISPONIBLES (10+) - Multi-sélection
  reseaux_disponibles: [
    'Eau courante CDE', 'Eau SNEC/Camwater', 'Forage privé', 'Puits',
    'Électricité ENEO (raccordé)', 'Électricité ENEO (à proximité < 50m)',
    'Électricité ENEO (à proximité 50-200m)',
    'Fibre optique / Internet haut débit', 'Téléphonie fixe',
    'Assainissement collectif (égouts)', 'Assainissement individuel (fosse)',
    'Gaz de ville (rare)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DOCUMENTS FONCIERS (12+) - CRITIQUE Cameroun
  documents_fonciers: [
    'Titre foncier définitif', 'Titre foncier en cours',
    'Certificat de propriété', 'Acte de vente notarié',
    'Attestation de cession', 'Bail emphytéotique',
    'Concession provisoire', 'Permis d\'occuper',
    'Document de palabre (reconnaissance coutumière)',
    'Certificat de non-gage', 'Arrêté de lotissement',
    'Plan cadastral',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ BORNAGE / DÉLIMITATION (8)
  bornage: [
    'Borné (bornes en béton)', 'Borné (piquets métalliques)',
    'Partiellement borné', 'Non borné',
    'Levé topographique récent (< 1 an)', 'Levé topographique ancien (> 3 ans)',
    'Clôturé (limite physique)', 'Délimitation naturelle',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CONSTRUCTIBILITÉ (10+)
  constructibilite: [
    'Constructible immédiatement (permis de construire obtenu)',
    'Constructible (zone constructible)',
    'Constructible sous conditions (étude de sol requise)',
    'Constructible (R+1 maximum)', 'Constructible (R+2 maximum)',
    'Constructible (R+3 et plus)',
    'Non constructible (zone protégée)', 'Non constructible (servitude)',
    'Constructible après viabilisation', 'Constructible après assainissement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CLÔTURE / SÉCURISATION (10)
  cloture: [
    'Clôturé (mur en parpaings)', 'Clôturé (mur en briques)',
    'Clôturé (grillage)', 'Clôturé (haie vive)',
    'Partiellement clôturé', 'Non clôturé',
    'Portail motorisé', 'Portail manuel',
    'Gardien sur place', 'Zone sécurisée/résidentielle',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CONTRAINTES / SERVITUDES (12+)
  contraintes: [
    'Aucune contrainte', 'Servitude de passage', 'Servitude de vue',
    'Ligne électrique haute tension', 'Canalisation souterraine',
    'Cours d\'eau traversant', 'Zone inondable (crue décennale)',
    'Protection environnementale', 'Monument historique à proximité',
    'Emprise aéroportuaire', 'Nuisances sonores (route/aéroport)',
    'Assainissement obligatoire avant construction',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ VILLES CAMEROUN (60+) - Réutilisation de IMMOBILIER_MODALITIES
  villes: [
    // Métropoles
    'Douala', 'Yaoundé',
    // Grandes villes (>100k habitants)
    'Garoua', 'Bafoussam', 'Bamenda', 'Maroua', 'Ngaoundéré', 'Bertoua',
    // Villes importantes (50-100k)
    'Ebolowa', 'Kribi', 'Kumba', 'Limbe', 'Nkongsamba', 'Buea', 'Édéa',
    // Villes moyennes Littoral
    'Mbanga', 'Loum', 'Penja', 'Manjo', 'Dizangué', 'Yabassi',
    // Villes moyennes Centre
    'Mbalmayo', 'Obala', 'Akonolinga', 'Bafia', 'Mfou', 'Saa', 'Eseka',
    // Villes moyennes Sud
    'Sangmélima', 'Ambam', 'Campo', 'Akom II',
    // Villes moyennes Est
    'Abong-Mbang', 'Batouri', 'Yokadouma', 'Lomié', 'Doumé',
    // Villes moyennes Ouest
    'Dschang', 'Foumban', 'Bafang', 'Mbouda', 'Bandjoun', 'Bangangté', 'Baham',
    // Villes moyennes Nord-Ouest
    'Tiko', 'Mamfe', 'Fundong', 'Wum', 'Ndu', 'Njinikom',
    // Villes moyennes Sud-Ouest
    'Mutengene', 'Muyuka', 'Idenau',
    // Villes moyennes Nord
    'Mokolo', 'Kousséri', 'Yagoua', 'Guidiguis', 'Kaélé', 'Mora',
    // Villes moyennes Adamaoua
    'Meiganga', 'Tibati', 'Banyo', 'Tignère',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ QUARTIERS DOUALA (40+) - Réutilisation
  quartiers_douala: [
    // Centre-ville / Affaires
    'Akwa', 'Bonanjo', 'Bali', 'Bonamoussadi',
    // Bonabéri (rive gauche)
    'Bonabéri', 'New Bell', 'Deido', 'Bépanda', 'Ndogbong',
    // Nord
    'Makepe', 'Logpom', 'Logbaba', 'Ndogpassi I', 'Ndogpassi II', 'Ndogpassi III',
    // Est
    'Kotto', 'PK8', 'PK10', 'PK11', 'PK12', 'PK14', 'PK17',
    // Zones résidentielles haut standing
    'Bonapriso', 'Bessengue', 'Bonamoussadi Bel Air',
    // Sud
    'Village', 'Japoma', 'Yassa', 'Ndog-Bong', 'Ndogsimbi',
    // Ouest
    'Cité des Palmiers', 'Sonel', 'Camp Yabassi',
    // Autres
    'Bassa Industrial', 'Bonassama', 'Petit Pays', 'Mabanda', 'Mboppi', 'Omnisport',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ QUARTIERS YAOUNDÉ (35+) - Réutilisation
  quartiers_yaounde: [
    // Centre-ville
    'Centre-ville', 'Poste Centrale', 'Mvog-Ada',
    // Haut standing
    'Bastos', 'Nlongkak', 'Santa Barbara', 'Golf', 'Hippodrome',
    // Nord
    'Elig-Essono', 'Nkolbisson', 'Simbock', 'Odza', 'Nkoldongo',
    // Sud
    'Mfandena', 'Ngoa-Ekelle', 'Mvan', 'Ekounou', 'Elig-Edzoa',
    // Est
    'Nsimeyong', 'Briqueterie', 'Tsinga', 'Messa', 'Mvog-Mbi',
    // Ouest
    'Emana', 'Etoug-Ebe', 'Nkomo', 'Essos',
    // Autres zones résidentielles
    'Mokolo', 'Madagascar', 'Mendong', 'Obili', 'Omnisport',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ PROXIMITÉS (18+) - Adapté contexte terrain
  proximites: [
    'Route principale (< 500m)', 'Axe routier majeur (< 1km)',
    'Centre-ville (< 5km)', 'Zone commerciale (< 2km)',
    'École primaire (< 1km)', 'Lycée/Collège (< 2km)', 'Université (< 5km)',
    'Centre de santé (< 1km)', 'Hôpital (< 3km)',
    'Pharmacie (< 1km)', 'Supermarché/Mahima (< 2km)', 'Marché (< 1km)',
    'Station-service (< 1km)', 'Banque/GAB (< 2km)',
    'Transport public (< 500m)', 'Gare routière (< 3km)',
    'Aéroport (< 20km)', 'Port (< 10km)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ POTENTIEL D'USAGE (12+) - NOUVEAU
  potentiel_usage: [
    'Habitation individuelle (villa)', 'Immeuble résidentiel',
    'Commerce (boutique/bureau)', 'Entrepôt/Stockage',
    'Station-service', 'Centre commercial',
    'Hôtel/Auberge', 'Restaurant/Maquis',
    'Exploitation agricole', 'Élevage',
    'Industrie légère', 'Atelier artisanal',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NATURE DU SOL (10+) - Important pour construction
  nature_sol: [
    'Sableux', 'Argileux', 'Latérite (bon pour construction)',
    'Rocheux', 'Limoneux', 'Mixte (sable/argile)',
    'Marécageux (nécessite remblai)', 'Tourbeux',
    'Étude de sol disponible', 'Étude de sol recommandée',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ORIENTATION / EXPOSITION (9)
  orientation: [
    'Nord', 'Sud', 'Est', 'Ouest',
    'Nord-Est', 'Nord-Ouest', 'Sud-Est', 'Sud-Ouest',
    'Toutes orientations',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS LOCATION COURTE DURÉE (Type Airbnb/Booking) - NOUVEAU
// Spécifique pour les locations vacances, séjours courts, hébergements temporaires
export const LOCATION_COURTE_DUREE_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE LOGEMENT VACANCES (20+) - Adapté Afrique
  types: [
    // Résidentiel classique
    'Appartement meublé', 'Studio meublé', 'F1 meublé', 'F2 meublé', 'F3 meublé',
    'F4 meublé', 'F5 meublé',
    'Villa meublée', 'Maison meublée', 'Duplex meublé',
    // Spécial vacances
    'Bungalow', 'Villa de vacances', 'Villa avec piscine',
    'Appartement vue mer', 'Maison de plage',
    'Chalet', 'Loft',
    // Chambres
    'Chambre privée', 'Chambre chez l\'habitant',
    // Luxe
    'Villa de luxe', 'Penthouse', 'Résidence touristique',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ STANDING (5)
  standing: [
    'Économique', 'Standard', 'Bon standing', 'Haut standing', 'Luxe',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTAT GÉNÉRAL (5)
  etat: [
    'Excellent état', 'Très bon état', 'Bon état', 'Correct',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DURÉES DE SÉJOUR MINIMUM (10)
  durees_minimum: [
    '1 nuit', '2 nuits', '3 nuits', '1 semaine', '2 semaines',
    '1 mois', 'Flexible', 'Pas de minimum',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DURÉES DE SÉJOUR MAXIMUM (10)
  durees_maximum: [
    '7 nuits', '14 nuits', '1 mois', '2 mois', '3 mois',
    '6 mois', 'Illimité', 'À définir',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CAPACITÉ PERSONNES (10)
  capacites: [
    '1 personne', '2 personnes', '3 personnes', '4 personnes',
    '5 personnes', '6 personnes', '8 personnes', '10 personnes',
    '12+ personnes (groupe)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ VILLES TOURISTIQUES CAMEROUN (30+) - PRIORITÉ DESTINATIONS VACANCES
  villes: [
    // Destinations balnéaires
    'Kribi', 'Limbe', 'Idenau', 'Campo', 'Londji',
    // Métropoles (affaires + tourisme)
    'Douala', 'Yaoundé',
    // Villes touristiques
    'Bafoussam', 'Dschang', 'Foumban', 'Bamenda', 'Buea',
    // Nord (safaris, parcs)
    'Garoua', 'Maroua', 'Waza', 'Ngaoundéré',
    // Autres villes
    'Bertoua', 'Ebolowa', 'Sangmélima',
    // Zones spéciales
    'Mont Cameroun', 'Chutes de la Lobé', 'Lac Nyos',
    'Parc Waza', 'Réserve Dja',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ QUARTIERS TOURISTIQUES DOUALA (15+)
  quartiers_douala: [
    'Akwa (Centre affaires)', 'Bonanjo (Centre)', 'Bonapriso (Résidentiel)',
    'Bali', 'Deido', 'Yassa (Plage)', 'Bonamoussadi', 'Bessengue',
    'Logpom', 'Bonabéri', 'Aéroport', 'Zone portuaire',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ QUARTIERS TOURISTIQUES YAOUNDÉ (15+)
  quartiers_yaounde: [
    'Bastos (Haut standing)', 'Centre-ville', 'Nlongkak', 'Santa Barbara',
    'Golf', 'Hippodrome', 'Odza', 'Mvan', 'Emombo',
    'Mont Fébé', 'Nsimeyong', 'Aéroport Nsimalen',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ZONES TOURISTIQUES KRIBI (10+)
  zones_kribi: [
    'Centre-ville Kribi', 'Plage publique', 'Eboundja (Plage)',
    'Grand Batanga', 'Londji', 'Chutes de la Lobé',
    'Ebodjé (tortues)', 'Bord de mer',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ZONES TOURISTIQUES LIMBE (8+)
  zones_limbe: [
    'Centre-ville Limbe', 'Down Beach', 'Mile 4', 'Botanical Garden',
    'Bord de mer', 'Vue Mont Cameroun',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉQUIPEMENTS ESSENTIELS (40+) - Adapté location vacances
  equipements: [
    // Eau & Électricité (CRITIQUE Cameroun)
    'Eau courante 24h/24', 'Réservoir d\'eau 500L+', 'Forage privé',
    'Électricité stable', 'Groupe électrogène', 'Panneaux solaires',
    'Onduleur/Batterie',
    // Cuisine
    'Cuisine équipée', 'Cuisinière gaz', 'Réfrigérateur', 'Congélateur',
    'Micro-ondes', 'Bouilloire', 'Cafetière', 'Vaisselle complète',
    'Ustensiles cuisine',
    // Confort
    'Climatisation toutes pièces', 'Climatisation chambres', 'Ventilateurs plafond',
    'Eau chaude', 'Chauffe-eau électrique', 'Chauffe-eau solaire',
    // Connectivité
    'Wi-Fi haut débit', 'Wi-Fi fibre', 'Parabole/TV satellite', 'Smart TV',
    // Linge
    'Draps fournis', 'Serviettes de bain', 'Serviettes de plage',
    'Lave-linge', 'Fer à repasser',
    // Extérieur
    'Balcon', 'Terrasse', 'Jardin privé', 'Cour', 'Vue mer', 'Vue montagne',
    // Parking & Sécurité
    'Parking privé', 'Garage fermé', 'Gardien 24h/24', 'Portail électrique',
    'Clôture sécurisée', 'Caméras surveillance',
    // Loisirs
    'Piscine privée', 'Piscine partagée', 'Barbecue', 'Salon de jardin',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ SERVICES INCLUS (20+)
  services: [
    // Ménage
    'Ménage quotidien inclus', 'Ménage fin de séjour inclus',
    'Ménage hebdomadaire inclus', 'Ménage sur demande (payant)',
    // Linge
    'Changement draps inclus', 'Linge de maison fourni',
    // Accueil
    'Accueil personnalisé', 'Check-in flexible', 'Check-in 24h/24',
    'Remise clés autonome',
    // Aide
    'Conciergerie disponible', 'Assistance 24h/24', 'Recommandations touristiques',
    // Transport
    'Transfert aéroport inclus', 'Transfert aéroport (payant)',
    'Navette plage', 'Location voiture possible',
    // Autres
    'Petit-déjeuner inclus', 'Repas sur demande',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ POLITIQUES D'ANNULATION (8)
  politiques_annulation: [
    'Annulation gratuite (24h avant)', 'Annulation gratuite (48h avant)',
    'Annulation gratuite (7 jours avant)', 'Annulation flexible (50% remboursé)',
    'Annulation modérée (25% retenu)', 'Annulation stricte (non remboursable)',
    'Remboursement partiel selon délai', 'À définir avec l\'hôte',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ RÈGLES DE LA MAISON (15+)
  regles: [
    'Animaux acceptés', 'Animaux interdits',
    'Fumeur accepté', 'Non-fumeur uniquement',
    'Enfants bienvenus', 'Pas adapté enfants',
    'Fêtes autorisées', 'Fêtes interdites',
    'Calme exigé après 22h', 'Invités extérieurs autorisés',
    'Invités extérieurs interdits', 'Accès piscine règlementé',
    'Respect du voisinage', 'Usage raisonnable équipements',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ PROXIMITÉS TOURISTIQUES (20+)
  proximites: [
    // Plage & Nature
    'Plage (à pied)', 'Plage (5-10 min voiture)', 'Front de mer',
    'Parc national', 'Réserve naturelle', 'Chutes d\'eau',
    // Commodités
    'Supermarché', 'Marché local', 'Restaurants', 'Maquis/Bars',
    'Banque/GAB', 'Station-service', 'Pharmacie',
    // Loisirs
    'Activités nautiques', 'Excursions organisées', 'Location bateaux',
    'Sports nautiques', 'Pêche', 'Randonnée',
    // Services
    'Transport public', 'Taxis disponibles', 'Location motos/voitures',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPE D'HÔTE (6)
  type_hote: [
    'Hôte sur place', 'Hôte à proximité', 'Hôte à distance',
    'Gestion professionnelle', 'Agence immobilière', 'Conciergerie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ LANGUES PARLÉES PAR L'HÔTE (10)
  langues_hote: [
    'Français', 'Anglais', 'Espagnol', 'Allemand', 'Italien',
    'Portugais', 'Arabe', 'Chinois', 'Langues locales (Ewondo, Douala, Bamiléké...)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MODES DE PAIEMENT ACCEPTÉS (12)
  paiements: [
    'Espèces (XAF)', 'Mobile Money (MTN/Orange)',
    'Virement bancaire', 'Carte bancaire',
    'PayPal', 'Western Union', 'MoneyGram',
    'Crypto-monnaies', 'Chèque', 'Paiement en ligne sécurisé',
    'Paiement échelonné possible',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CALENDRIER DISPONIBILITÉ (8)
  disponibilites: [
    'Disponible toute l\'année', 'Haute saison uniquement (Nov-Fév)',
    'Basse saison uniquement', 'Week-ends seulement',
    'Semaine seulement', 'Vacances scolaires', 'Sur demande',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS HÔTELLERIE - REFONTE COMPLÈTE CONTEXTUALISÉE
export const HOTELLERIE_MODALITIES: ModalityCategory = {
  // ✅ NOMS D'ÉTABLISSEMENTS (60+) - Contexte Cameroun
  noms_etablissements: [
    // Hôtels de luxe - Douala
    'Hôtel Sawa', 'Pullman Douala Rabingha', 'Azur Hotel Douala', 'Ibis Douala',
    'La Falaise Hotel Yassa', 'Starland Hotel Bonanjo', 'Hotel Prince de Galles',
    // Hôtels de luxe - Yaoundé
    'Hilton Yaoundé', 'Mont Fébé Hotel', 'Djeuga Palace', 'Merina Hotel',
    'Azur Hotel Bastos', 'Hotel Franco', 'Nobila Airport Hotel',
    // Hôtels milieu de gamme - Douala
    'Hotel Benoue', 'Hotel Akwa Palace', 'Hotel Le Meridien', 'Hotel des Cocotiers',
    'Hotel La Pagode', 'Hotel du Plateau', 'Residence Bougainvilliers',
    // Hôtels milieu de gamme - Yaoundé
    'Hotel Azur', 'Hotel des Deputés', 'Hotel Tou\'Ngou', 'Hotel Central',
    'Hotel Le Diplomate', 'Hotel Mansel', 'Residence La Falaise',
    // Hôtels budget
    'Hotel Residence', 'Foyer du Marin', 'Hotel Le Paradis', 'Hotel Atlanta',
    'Hotel du Centre', 'Hotel Le Phenix', 'Hotel La Providence',
    // Chambres d\'hôtes
    'Chez Marie Chambre d\'hôte', 'Villa Bamileke Guesthouse', 'Maison d\'Hôtes Bastos',
    'Guesthouse Bonanjo', 'Chez Emmanuel B&B', 'Villa Douala Guesthouse',
    // Auberges de jeunesse
    'Auberge de Jeunesse Douala', 'Backpackers Yaoundé', 'Hostel Akwa',
    'Youth Hostel Bastos', 'Auberge du Voyageur',
    // Locations saisonnières
    'Appartement meublé Centre-ville', 'Studio équipé Bonanjo', 'Villa Bastos',
    'Résidence avec piscine Bonapriso', 'Apparthotel Akwa',
    // Établissements génériques
    'Hôtel 3 étoiles', 'Hôtel économique', 'Chambres d\'hôtes familiales',
    'Auberge confort', 'Apart-hôtel moderne',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES D'HÉBERGEMENT (15)
  types: [
    'Hôtel',
    'Hôtel-Boutique',
    'Resort',
    'Auberge',
    'Motel',
    'Chambre d\'hôte',
    'Gîte',
    'Pension',
    'Apart-hôtel',
    'Villa de luxe',
    'Résidence hôtelière',
    'Auberge de jeunesse',
    'Camping',
    'Lodge',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CLASSEMENT/STANDING (8)
  categories: [
    'Sans classement',
    '1 étoile',
    '2 étoiles',
    '3 étoiles',
    '4 étoiles',
    '5 étoiles',
    'Palace',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE CHAMBRES (12)
  chambres: [
    'Chambre Simple',
    'Chambre Double',
    'Chambre Twin (2 lits séparés)',
    'Chambre Triple',
    'Chambre Quadruple',
    'Suite Junior',
    'Suite',
    'Suite Présidentielle',
    'Chambre Familiale',
    'Studio',
    'Appartement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉQUIPEMENTS (30)
  equipements: [
    // Équipements de base
    'Wi-Fi gratuit', 'Climatisation', 'TV satellite', 'Minibar', 'Coffre-fort',
    'Sèche-cheveux', 'Téléphone', 'Bureau',
    // Équipements loisirs
    'Piscine', 'Piscine chauffée', 'Piscine pour enfants', 'Jacuzzi',
    'Salle de sport', 'Spa', 'Sauna', 'Hammam',
    'Tennis', 'Golf', 'Plage privée', 'Jardin',
    // Services hôteliers
    'Restaurant', 'Bar', 'Room service', 'Réception 24h/24',
    'Parking gratuit', 'Parking sécurisé', 'Ascenseur',
    // Professionnels
    'Salle de conférence', 'Centre d\'affaires', 'Salles de réunion',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ SERVICES (25)
  services: [
    'Concierge',
    'Room service 24h/24',
    'Service d\'étage',
    'Navette aéroport gratuite',
    'Navette aéroport payante',
    'Service de voiturier',
    'Location de voiture',
    'Blanchisserie',
    'Pressing',
    'Nettoyage à sec',
    'Service de garde d\'enfants',
    'Animateur pour enfants',
    'Service de réveil',
    'Change de devises',
    'Coffre-fort à la réception',
    'Bagagerie',
    'Réservation excursions',
    'Service de taxi',
    'Transfert aéroport',
    'Massage',
    'Coiffeur/Salon de beauté',
    'Boutique de souvenirs',
    'Distributeur automatique',
    'Service médical',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FORMULES DE PENSION (8)
  pensions: [
    'Nuitée seule (sans repas)',
    'Petit-déjeuner inclus',
    'Petit-déjeuner continental',
    'Petit-déjeuner buffet',
    'Demi-pension (petit-déj + dîner)',
    'Pension complète (3 repas)',
    'All inclusive (tout compris)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ZONES/QUARTIERS (20) - Contexte Cameroun
  zones: [
    // Douala
    'Akwa (Douala)', 'Bonanjo (Douala)', 'Bonapriso (Douala)', 'Bali (Douala)',
    'Deido (Douala)', 'Yassa (Douala)', 'Logpom (Douala)', 'Bonaberi (Douala)',
    'Aéroport Douala',
    // Yaoundé
    'Bastos (Yaoundé)', 'Centre-ville (Yaoundé)', 'Mvan (Yaoundé)', 'Nlongkak (Yaoundé)',
    'Odza (Yaoundé)', 'Essos (Yaoundé)', 'Emombo (Yaoundé)',
    'Aéroport Nsimalen',
    // Autres villes
    'Centre-ville', 'Quartier résidentiel',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CAPACITÉS (10)
  capacites: [
    '1 personne',
    '2 personnes',
    '3 personnes',
    '4 personnes',
    '5 personnes',
    '6 personnes',
    '8 personnes',
    '10 personnes',
    'Groupe (10+)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ POLITIQUES (12)
  politiques: [
    'Annulation gratuite',
    'Annulation flexible',
    'Non remboursable',
    'Paiement à l\'arrivée',
    'Paiement anticipé requis',
    'Animaux acceptés',
    'Animaux interdits',
    'Enfants bienvenus',
    'Fumeur accepté',
    'Non-fumeur uniquement',
    'Accessible handicapés',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ LANGUES PARLÉES (10)
  langues: [
    'Français',
    'Anglais',
    'Espagnol',
    'Allemand',
    'Italien',
    'Portugais',
    'Arabe',
    'Chinois',
    'Langues locales',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS VOYAGE
export const VOYAGE_MODALITIES: ModalityCategory = {
  // Compagnies de transport - ENRICHI CONTEXTE CAMEROUN
  compagniesTransport: [
    // \uD83C\uDDE8\uD83C\uDDF2 COMPAGNIES BUS CAMEROUN (principales)
    '\uD83D\uDE8C Touristique Express',
    '\uD83D\uDE8C Centrale Voyage',
    '\uD83D\uDE8C Express Voyage',
    '\uD83D\uDE8C Express Ferry',
    '\uD83D\uDE8C TGM Transport',
    '\uD83D\uDE8C Achille Talon',
    '\uD83D\uDE8C Trans Cameroun',
    '\uD83D\uDE8C Gazelle Voyages',
    '\uD83D\uDE8C Voyages Safari',
    '\uD83D\uDE8C Buca Voyages',
    '\uD83D\uDE8C Musango',
    // ✈️ COMPAGNIES AÉRIENNES
    '✈️ Camair-Co',
    '✈️ Asky Airlines',
    '✈️ Ethiopian Airlines',
    '✈️ Kenya Airways',
    '✈️ Air France',
    '✈️ Turkish Airlines',
    '✈️ Royal Air Maroc',
    '✈️ Brussels Airlines',
    '✈️ Emirates',
    '✈️ Qatar Airways',
    '✈️ CEIBA Intercontinental',
    '✈️ South African Airways',
    '✈️ EgyptAir',
    // \uD83D\uDE82 TRAINS
    '\uD83D\uDE82 Camrail',
    // \uD83D\uDEA2 BATEAUX
    '\uD83D\uDEA2 Compagnie fluviale',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Villes de départ/destination - CAMEROUN + AFRIQUE FRANCOPHONE
  villesDepart: genererToutesLesVilles('CM'),

  villesDestination: genererToutesLesVilles('CM'),

  // Classes de voyage
  classesVoyage: [
    'Économique',
    'Économique Premium',
    'Affaires',
    'Business',
    'Première classe',
    'VIP',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de véhicules de transport
  typesVehiculeTransport: [
    '\uD83D\uDE8C Bus',
    '\uD83D\uDE90 Minibus',
    '\uD83D\uDE90 Van climatisé',
    '\uD83D\uDE82 Train',
    '✈️ Avion',
    '\uD83D\uDEA2 Bateau',
    '⛴️ Ferry',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de billets
  typesBillets: [
    'Aller simple',
    'Aller-retour',
    'Multi-destinations',
    'Open ticket',
    'Groupe (10+ personnes)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements bus
  equipementsBus: [
    '❄️ Climatisation',
    '\uD83D\uDCFA TV/Écrans',
    '\uD83D\uDCF6 Wi-Fi',
    '\uD83D\uDD0C Prises électriques',
    '\uD83C\uDF7D️ Repas inclus',
    '\uD83D\uDCA7 Eau gratuite',
    '\uD83D\uDEBD Toilettes à bord',
    '\uD83D\uDCE6 Soute à bagages',
    '\uD83D\uDECF️ Sièges inclinables',
    '\uD83D\uDCF1 Chargeurs USB',
    '\uD83C\uDFA7 Divertissement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Politiques bagage
  politiquesBagage: [
    'Cabine uniquement (petit sac)',
    'Cabine + 1 bagage en soute (23kg max)',
    'Cabine + 2 bagages en soute',
    'Sans bagage (tarif réduit)',
    'Bagage extra payant (par kg)',
    'Bagages illimités',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Gares routières Douala
  garesDouala: [
    'Gare Routière Bonabéri',
    'Gare Centrale Bessengue',
    'Ancien Garage Bessengue',
    'Carrefour Ange Raphaël',
    'Rond-point Deido',
    'Carrefour Ndokoti',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Gares routières Yaoundé
  garesYaounde: [
    'Gare Routière Mvan',
    'Gare Routière Nsam',
    'Carrefour Omnisport',
    'Carrefour Étoile',
    'Carrefour Mimboman',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Configuration bus (nb places)
  capacitesBus: [
    '14 places (Minibus)',
    '18 places',
    '22 places',
    '30 places',
    '40 places',
    '50 places',
    '60 places',
    '70 places (Double étage)',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS TRANSPORT INTRA-URBAIN - CONCURRENT YANGO/GOZEM
// Différence avec covoiturage : courses intra-urbaines avec négociation de prix dynamique
export const TRANSPORT_INTRA_URBAIN_MODALITIES: ModalityCategory = {
  // ✅ VILLES (utilise fonction intelligente africanLocations.ts)
  villes: genererToutesLesVilles('CM'),

  // ✅ QUARTIERS (utilise fonction intelligente pour chaque ville)
  quartiers: genererQuartiersPays('CM'),

  // ✅ TYPES DE VÉHICULES (contexte Afrique francophone)
  types_vehicules: [
    '\uD83C\uDFCD️ Moto-taxi (Okada/Bendskin)',
    '\uD83D\uDEFA Tricycle (Keke Napep)',
    '\uD83D\uDE97 Berline économique (4 places)',
    '\uD83D\uDE97 Berline confort (4 places)',
    '\uD83D\uDE99 SUV (5-7 places)',
    '\uD83D\uDE90 Minibus (9-14 places)',
    '\uD83D\uDE90 Van climatisé (6-8 places)',
    '✨ Voiture de luxe (VIP)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CATÉGORIES DE SERVICE
  categories_service: [
    '\uD83D\uDCCD Course simple (Point A → Point B)',
    '⏳ Course avec attente incluse',
    '\uD83D\uDD04 Courses multiples (plusieurs arrêts)',
    '\uD83D\uDCC5 Service à la journée complète',
    '⏰ Service à l\'heure',
    '\uD83D\uDCE6 Livraison express colis',
    '\uD83C\uDF92 Transport scolaire régulier',
    '\uD83C\uDFE5 Transport médical urgence',
    '\uD83D\uDED2 Accompagnement courses',
    '\uD83C\uDFE2 Transport professionnel',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ OPTIONS DE CONFORT
  options_confort: [
    '❄️ Climatisation fonctionnelle',
    '\uD83D\uDCF6 Wifi gratuit à bord',
    '\uD83D\uDD0C Chargeur téléphone disponible',
    '\uD83D\uDCA7 Eau fraîche offerte',
    '\uD83C\uDFB5 Musique au choix du client',
    '\uD83E\uDD2B Silence garanti / calme',
    '\uD83E\uDDF3 Coffre spacieux pour bagages',
    '\uD83D\uDC76 Siège bébé disponible',
    '♿ Véhicule accessible PMR',
    '\uD83E\uDDFC Véhicule désinfecté régulièrement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MODES DE PAIEMENT (contexte Afrique)
  modes_paiement: [
    '\uD83D\uDCB5 Espèces uniquement',
    '\uD83D\uDCF1 Orange Money',
    '\uD83D\uDCF1 MTN Mobile Money',
    '\uD83D\uDCF1 Moov Money',
    '\uD83D\uDCB3 Carte bancaire (TPE disponible)',
    '\uD83D\uDCB8 Virement bancaire instantané',
    '\uD83D\uDCB3 Tous modes de paiement acceptés',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DISPONIBILITÉ
  disponibilite: [
    '⚡ Disponible maintenant (en ligne)',
    '\uD83C\uDF19 Service 24h/24 7j/7',
    '☀️ Jour uniquement (6h-20h)',
    '\uD83C\uDF19 Nuit uniquement (20h-6h)',
    '\uD83D\uDCC5 Sur réservation uniquement',
    '\uD83C\uDF34 Week-end uniquement',
    '\uD83D\uDCC6 Jours ouvrables uniquement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ZONES D'INTERVENTION (utilise fonction intelligente)
  zones_intervention: genererZonesIntervention('CM'),

  // ✅ SERVICES ADDITIONNELS SPÉCIFIQUES TRANSPORT
  services_additionnels: [
    '\uD83D\uDCCD GPS en temps réel partagé',
    '\uD83D\uDCAC Chat instantané avec chauffeur',
    '\uD83D\uDCDE Appel vocal/vidéo disponible',
    '\uD83D\uDDFA️ Calcul distance exacte Google Maps',
    '\uD83D\uDEE3️ Estimation routes non goudronnées',
    '\uD83D\uDCB0 Négociation prix en direct',
    '\uD83D\uDCCB Devis avant course',
    '\uD83D\uDD12 Trajet sécurisé et assuré',
    '⭐ Chauffeur noté et vérifié',
    '\uD83C\uDF81 Première course réduction',
    '\uD83D\uDD04 Abonnement courses régulières',
    '\uD83D\uDC65 Course partagée (split prix)',
    '\uD83C\uDD95 Autre service (ajouter)'
  ],

  // ✅ ÉTAT DU VÉHICULE
  etat_vehicule: [
    'Neuf (moins 2 ans)',
    'Récent (2-5 ans)',
    'Bon état (5-10 ans)',
    'Fonctionnel (10+ ans)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ LANGUES PARLÉES PAR LE CHAUFFEUR
  langues_chauffeur: [
    '\uD83C\uDDEB\uD83C\uDDF7 Français',
    '\uD83D\uDDE3️ Anglais',
    '\uD83D\uDDE3️ Pidgin English',
    '\uD83D\uDDE3️ Langues locales (Ewondo, Douala, Bassa...)',
    '\uD83D\uDDE3️ Fulfulde',
    '\uD83D\uDDE3️ Arabe',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS COVOITURAGE - NOUVEAU
export const COVOITURAGE_MODALITIES: ModalityCategory = {
  // Villes principales
  villes: [
    'Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Bamenda', 'Maroua', 'Ngaoundéré',
    'Bertoua', 'Kribi', 'Limbé', 'Edéa', 'Kumba', 'Nkongsamba', 'Ebolowa',
    'Buéa', 'Foumban', 'Dschang', 'Mbalmayo', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de véhicules
  vehicules: [
    'Berline', 'SUV', '4x4', 'Break', 'Minibus', 'Van', 'Pick-up', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Préférences trajet
  preferences: [
    'Musique autorisée', 'Conversation', 'Silence/Calme', 'Climatisation',
    'Pause café', 'Non-fumeur', 'Animaux acceptés', 'Bagages volumineux',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Jours de la semaine
  jours: [
    'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'
  ]
};

// ✅ MODALITÉS VOYAGE & TOURISME - NOUVEAU
export const VOYAGE_TOURISME_MODALITIES: ModalityCategory = {
  // Types de voyages
  types: [
    'Séjour balnéaire', 'Safari', 'Circuit touristique', 'Trek/Randonnée', 'Croisière',
    'City break', 'Voyage culturel', 'Écotourisme', 'Voyage aventure', 'Séjour détente',
    'Voyage d\'affaires', 'Pèlerinage', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Destinations populaires
  destinations: [
    'Kribi', 'Limbé', 'Parc Waza', 'Mont Cameroun', 'Réserve Dja', 'Chutes d\'Ekom',
    'Lac Nyos', 'Foumban', 'Maroua', 'Douala', 'Yaoundé', 'Bamenda',
    'International', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Durées
  durees: [
    '1 jour', '2-3 jours', '4-7 jours', '1-2 semaines', '2-4 semaines',
    'Plus d\'un mois', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Services inclus
  services: [
    'Hébergement', 'Transport', 'Repas', 'Guide touristique', 'Activités',
    'Visites guidées', 'Assurance voyage', 'Vol inclus', 'Location véhicule',
    'Transferts aéroport', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types d'hébergement
  hebergements: [
    'Hôtel 3*', 'Hôtel 4*', 'Hôtel 5*', 'Resort', 'Chambre d\'hôte', 'Camping',
    'Lodge', 'Auberge', 'Appartement', 'Villa', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS VÊTEMENTS (TEXTILE) - ENRICHI
// ✅ MODALITÉS VÊTEMENTS & PRÊT-À-PORTER - AFRIQUE FRANCOPHONE (ENRICHI)
export const VETEMENTS_MODALITIES: ModalityCategory = {
  // \uD83D\uDC55 Types de vêtements (45+ options)
  types: [
    // Hauts
    'T-shirt', 'Polo', 'Chemise', 'Chemise africaine', 'Chemisette', 'Débardeur', 'Tunique',
    'Pull', 'Sweat', 'Hoodie', 'Cardigan', 'Gilet', 'Top', 'Bustier', 'Crop top',
    // Bas
    'Pantalon', 'Jean', 'Pantalon africain', 'Pantalon tailleur', 'Chino', 'Cargo',
    'Short', 'Bermuda', 'Jogging', 'Legging',
    'Jupe', 'Jupe africaine', 'Jupe longue', 'Jupe courte', 'Jupe plissée',
    // Robes & Ensembles
    'Robe', 'Robe africaine', 'Robe pagne', 'Robe wax', 'Robe de soirée', 'Robe cocktail',
    'Robe longue', 'Robe courte', 'Combinaison', 'Salopette',
    // Vestes & Manteaux
    'Veste', 'Blazer', 'Veste africaine', 'Blouson', 'Manteau', 'Parka', 'Trench',
    'Coupe-vent', 'Imperméable', 'Doudoune',
    // Tenues complètes
    'Costume', 'Costume africain', 'Tailleur', 'Tailleur africain', 'Boubou',
    'Kaftan', 'Dashiki', 'Agbada', 'Kaba', 'Bazin', 'Ensemble wax',
    // Accessoires vestimentaires
    'Cravate', 'Nœud papillon', 'Écharpe', 'Foulard', 'Châle', 'Ceinture',
    'Sous-vêtements', 'Maillot de bain', 'Pyjama', 'Kimono', 'Peignoir',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDC64 Genres (6 options)
  genres: [
    'Homme', 'Femme', 'Enfant', 'Bébé', 'Unisexe', 'Mixte', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDCCF Tailles (30+ options - lettres + chiffres)
  tailles: [
    // Tailles lettres
    'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL',
    // Tailles numériques françaises
    '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60', '62',
    // Tailles pantalons (tour de taille)
    '26', '28', '30', '32', '34', '36', '38', '40', '42', '44',
    // Enfants
    '2 ans', '4 ans', '6 ans', '8 ans', '10 ans', '12 ans', '14 ans', '16 ans',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDFA8 Couleurs (35+ options incluant motifs africains)
  couleurs: [
    // Couleurs unies basiques
    'Blanc', 'Blanc cassé', 'Écru', 'Crème', 'Beige', 'Noir', 'Gris clair', 'Gris', 'Gris foncé',
    // Couleurs vives populaires
    'Rouge', 'Rouge bordeaux', 'Rose', 'Rose fuschia', 'Corail',
    'Bleu', 'Bleu marine', 'Bleu ciel', 'Bleu roi', 'Turquoise', 'Cyan',
    'Vert', 'Vert olive', 'Vert pomme', 'Vert émeraude', 'Kaki',
    'Jaune', 'Jaune moutarde', 'Doré', 'Orange', 'Marron', 'Camel', 'Chocolat',
    'Violet', 'Mauve', 'Lilas', 'Prune', 'Aubergine', 'Bordeaux',
    // Motifs
    'Multicolore', 'Bicolore', 'Imprimé', 'Imprimé africain', 'Wax', 'Pagne', 'Kente',
    'Bogolan', 'Batik', 'Tie & Dye', 'Rayé', 'À pois', 'À carreaux', 'Floral',
    'Géométrique', 'Animal print', 'Camouflage',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83E\uDDF5 Matières (25+ options)
  matieres: [
    // Naturelles
    'Coton', '100% Coton', 'Coton bio', 'Coton peigné', 'Coton égyptien',
    'Lin', 'Soie', 'Laine', 'Cachemire', 'Alpaga', 'Mohair',
    // Synthétiques
    'Polyester', 'Polyamide', 'Nylon', 'Acrylique', 'Viscose', 'Lycra', 'Spandex', 'Élasthanne',
    // Spécialisées
    'Denim', 'Jean', 'Velours', 'Satin', 'Mousseline', 'Organza', 'Tulle', 'Dentelle',
    'Cuir', 'Cuir véritable', 'Cuir synthétique', 'Simili cuir', 'Daim',
    // Tissus africains
    'Wax', 'Pagne', 'Bazin', 'Bazin riche', 'Bogolan', 'Kente', 'Ankara', 'Batik',
    // Mélanges
    'Mélange coton-polyester', 'Mélange', 'Fibres naturelles', 'Fibres synthétiques',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDFF7️ Marques vêtements (60+ marques internationales + locales africaines)
  marques: [
    // Sport (15)
    'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour', 'New Balance', 'Asics',
    'Fila', 'Kappa', 'Umbro', 'Lotto', 'Diadora', 'Le Coq Sportif', 'Champion', 'Converse',
    // Casual & Fast Fashion (20)
    'Zara', 'H&M', 'Uniqlo', 'Gap', 'Mango', 'Bershka', 'Pull & Bear', 'Stradivarius',
    'Massimo Dutti', 'Primark', 'Forever 21', 'C&A', 'Kiabi', 'Orchestra', 'Okaïdi',
    'Tape à l\'Œil', 'Tex (Carrefour)', 'Livergy (Lidl)', 'Esmara (Lidl)', 'Blue Motion (Lidl)',
    // Premium & Luxe (15)
    'Lacoste', 'Ralph Lauren', 'Polo Ralph Lauren', 'Tommy Hilfiger', 'Calvin Klein',
    'Hugo Boss', 'Armani', 'Versace', 'Dolce & Gabbana', 'Gucci', 'Louis Vuitton',
    'Prada', 'Hermès', 'Dior', 'Chanel',
    // Denim (5)
    'Levi\'s', 'Wrangler', 'Lee', 'Diesel', 'Pepe Jeans',
    // Marques africaines & locales (10+)
    'Vlisco', 'Uniwax', 'ABC Wax', 'GTP', 'Woodin', 'Da Viva', 'Akosombo',
    'Amsik (Cameroun)', 'Alios (Côte d\'Ivoire)', 'Kouleurs & Kontours (Sénégal)',
    'Afriek (Bénin)', 'Modahnik (Cameroun)',
    // Autres
    'Sans marque', 'Marque locale', 'Couture sur mesure', 'Fait main',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✨ États (8 options)
  etats: [
    'Neuf avec étiquette', 'Neuf sans étiquette', 'Jamais porté',
    'Occasion - Excellent état', 'Occasion - Bon état', 'Occasion - État moyen',
    'Vintage', 'Seconde main',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDC8E Styles (20+ options)
  styles: [
    // Styles généraux
    'Casual', 'Décontracté', 'Formel', 'Chic', 'Élégant', 'Classique', 'Moderne', 'Minimaliste',
    // Styles tendance
    'Sport', 'Sportswear', 'Streetwear', 'Urbain', 'Hip-hop', 'Skate',
    // Styles féminins
    'Bohème', 'Boho chic', 'Romantique', 'Glamour', 'Sexy', 'Girly',
    // Styles spéciaux
    'Vintage', 'Rétro', 'Rock', 'Punk', 'Grunge', 'Preppy',
    // Styles africains
    'Africain', 'Afro', 'Afro-fusion', 'Wax moderne', 'Pagne chic', 'Traditionnel moderne',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDF21️ Saisons (5 options)
  saisons: [
    'Été', 'Hiver', 'Automne', 'Printemps', 'Mi-saison', 'Toutes saisons',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDFA8 Motifs/Patrons (20+ options)
  motifs: [
    // Basiques
    'Uni', 'Rayé', 'Rayures horizontales', 'Rayures verticales', 'À pois', 'Pois fins', 'Gros pois',
    'À carreaux', 'Vichy', 'Prince de Galles', 'Écossais', 'Tartan',
    // Imprimés
    'Imprimé', 'Imprimé floral', 'Fleurs', 'Tropical', 'Feuillage',
    'Imprimé géométrique', 'Imprimé abstrait', 'Imprimé graphique',
    'Imprimé animal', 'Léopard', 'Zèbre', 'Python', 'Camouflage', 'Militaire',
    // Motifs africains
    'Imprimé africain', 'Wax', 'Pagne', 'Kente', 'Bogolan', 'Batik', 'Ankara',
    'Motifs ethniques', 'Motifs tribaux', 'Motifs géométriques africains',
    // Autres
    'Logo', 'Texte', 'Brodé', 'Sequins', 'Paillettes', 'Dentelle',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✂️ Coupes (15+ options)
  coupes: [
    // Coupes pantalons
    'Slim', 'Skinny', 'Regular', 'Straight', 'Droit', 'Loose', 'Baggy', 'Oversize',
    'Boyfriend', 'Mom fit', 'Dad fit', 'Carrot', 'Flare', 'Évasé', 'Bootcut',
    // Coupes hauts
    'Ajusté', 'Cintré', 'Ample', 'Col V', 'Col rond', 'Col polo', 'Sans manches',
    'Manches courtes', 'Manches longues', 'Manches 3/4',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDFAF Occasions (15+ options)
  occasions: [
    // Quotidien
    'Quotidien', 'Tous les jours', 'Décontracté', 'Week-end', 'Vacances',
    // Professionnel
    'Travail', 'Bureau', 'Business', 'Réunion', 'Entretien',
    // Événements
    'Soirée', 'Fête', 'Mariage', 'Cérémonie', 'Baptême', 'Anniversaire',
    'Gala', 'Cocktail', 'Dîner', 'Concert', 'Festival',
    // Sport & loisirs
    'Sport', 'Gym', 'Yoga', 'Running', 'Plage', 'Piscine',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDFED Origine fabrication (10+ options)
  origines: [
    'Made in China', 'Made in Turkey', 'Made in Bangladesh', 'Made in India',
    'Made in Vietnam', 'Made in Morocco', 'Made in Tunisia', 'Made in Egypt',
    'Made in Cameroun', 'Made in Côte d\'Ivoire', 'Made in Sénégal', 'Made in Africa',
    'Made in Europe', 'Made in France', 'Made in Italy', 'Made in Spain',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS CHAUSSURES - ENRICHI
export const CHAUSSURES_MODALITIES: ModalityCategory = {
  // Pointures
  pointures: [
    '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47',
    '48', '49', '50', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de chaussures
  types: [
    'Baskets', 'Chaussures de ville', 'Bottes', 'Sandales', 'Tongs', 'Mocassins',
    'Derbies', 'Escarpins', 'Tennis', 'Chaussures de sport', 'Chaussures de sécurité',
    'Bottines', 'Ballerines', 'Talons', 'Chaussons', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques chaussures
  marques: [
    'Nike', 'Adidas', 'Puma', 'Reebok', 'Converse', 'Vans', 'Timberland', 'Dr. Martens',
    'Clarks', 'Geox', 'Ecco', 'Salomon', 'New Balance', 'Asics', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Matériaux
  materiaux: [
    'Cuir', 'Cuir synthétique', 'Tissu', 'Synthétique', 'Toile', 'Daim', 'Caoutchouc',
    'Plastique', 'Mesh', 'Mélange', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Couleurs
  couleurs: [
    'Noir', 'Blanc', 'Marron', 'Beige', 'Gris', 'Bleu', 'Rouge', 'Rose', 'Vert',
    'Jaune', 'Orange', 'Violet', 'Multicolore', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // États
  etats: [
    'Neuf avec boîte', 'Neuf sans boîte', 'Excellent état', 'Bon état',
    'État moyen', 'À rénover', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Genres
  genres: [
    'Homme', 'Femme', 'Enfant garçon', 'Enfant fille', 'Bébé', 'Unisexe', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Usages
  usages: [
    'Sport', 'Running', 'Football', 'Basketball', 'Ville', 'Casual', 'Formel',
    'Randonnée', 'Plage', 'Travail', 'Soirée', 'Quotidien', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ÉLECTROMÉNAGER - REFONTE COMPLÈTE
export const ELECTROMENAGER_MODALITIES: ModalityCategory = {
  // ✅ NOMS DE PRODUITS (70+)
  noms_produits: [
    // Gros électroménager - Froid
    'Réfrigérateur 1 porte', 'Réfrigérateur 2 portes', 'Réfrigérateur américain', 'Réfrigérateur combiné',
    'Congélateur armoire', 'Congélateur coffre', 'Cave à vin',
    // Gros électroménager - Cuisson
    'Cuisinière gaz', 'Cuisinière électrique', 'Cuisinière mixte',
    'Four encastrable', 'Four micro-ondes', 'Micro-ondes solo', 'Micro-ondes grill', 'Micro-ondes combiné',
    'Plaque de cuisson gaz', 'Plaque de cuisson électrique', 'Plaque induction', 'Plaque vitrocéramique',
    'Hotte aspirante', 'Hotte décorative',
    // Gros électroménager - Lavage
    'Lave-linge hublot', 'Lave-linge top', 'Lave-linge séchant',
    'Sèche-linge évacuation', 'Sèche-linge condensation', 'Sèche-linge pompe à chaleur',
    'Lave-vaisselle encastrable', 'Lave-vaisselle pose libre',
    // Gros électroménager - Climatisation
    'Climatiseur split', 'Climatiseur mobile', 'Climatiseur fenêtre',
    'Ventilateur sur pied', 'Ventilateur plafond', 'Ventilateur colonne',
    // Petit électroménager - Cuisine
    'Mixeur plongeant', 'Blender', 'Robot multifonction', 'Robot pâtissier',
    'Cafetière filtre', 'Cafetière expresso', 'Cafetière à capsules', 'Machine à café',
    'Bouilloire électrique', 'Grille-pain', 'Gaufrier', 'Crêpière',
    'Friteuse', 'Friteuse sans huile', 'Multicuiseur', 'Cuiseur vapeur', 'Cuiseur riz',
    'Presse-agrumes', 'Centrifugeuse', 'Extracteur de jus',
    // Petit électroménager - Entretien
    'Aspirateur traîneau', 'Aspirateur balai', 'Aspirateur robot', 'Aspirateur à main',
    'Nettoyeur vapeur', 'Shampouineuse',
    'Fer à repasser', 'Centrale vapeur', 'Défroisseur vapeur',
    // Petit électroménager - Soins
    'Sèche-cheveux', 'Lisseur', 'Boucleur', 'Tondeuse cheveux', 'Rasoir électrique',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CATÉGORIES (8)
  categories: [
    'Gros électroménager - Froid',
    'Gros électroménager - Cuisson',
    'Gros électroménager - Lavage',
    'Gros électroménager - Climatisation',
    'Petit électroménager - Cuisine',
    'Petit électroménager - Entretien',
    'Petit électroménager - Soins',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES (25)
  types: [
    'Réfrigérateur', 'Congélateur', 'Cave à vin',
    'Cuisinière', 'Four', 'Micro-ondes', 'Plaque de cuisson', 'Hotte',
    'Lave-linge', 'Sèche-linge', 'Lave-vaisselle',
    'Climatiseur', 'Ventilateur',
    'Mixeur', 'Blender', 'Robot cuisine', 'Cafetière', 'Bouilloire',
    'Grille-pain', 'Friteuse', 'Multicuiseur',
    'Aspirateur', 'Nettoyeur vapeur',
    'Fer à repasser', 'Sèche-cheveux',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES (35)
  marques: [
    // Grandes marques internationales
    'Samsung', 'LG', 'Whirlpool', 'Bosch', 'Siemens', 'Electrolux',
    'Panasonic', 'Sharp', 'Toshiba', 'Sony',
    // Marques européennes
    'Miele', 'AEG', 'Zanussi', 'Indesit', 'Hotpoint', 'Candy', 'Beko',
    // Marques asiatiques
    'Haier', 'Hisense', 'Midea', 'TCL', 'Gree',
    // Petit électroménager
    'Tefal', 'Moulinex', 'Krups', 'Philips', 'Braun',
    'Rowenta', 'Calor', 'Seb', 'Kenwood', 'Kitchenaid',
    'Sans marque',
    'Marque locale',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CLASSES ÉNERGÉTIQUES (11)
  classes_energetiques: [
    'A+++',
    'A++',
    'A+',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CAPACITÉS (20)
  capacites: [
    // Réfrigérateurs/Congélateurs (litres)
    '100L', '150L', '200L', '250L', '300L', '350L', '400L', '450L', '500L', '600L+',
    // Lave-linge/Lave-vaisselle (kg)
    '3kg', '5kg', '6kg', '7kg', '8kg', '9kg', '10kg', '12kg',
    // Autres
    'Variable',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ COULEURS (12)
  couleurs: [
    'Blanc',
    'Noir',
    'Gris',
    'Inox',
    'Argent',
    'Rouge',
    'Bleu',
    'Vert',
    'Beige',
    'Rose',
    'Multicolore',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GARANTIES (10)
  garanties: [
    '3 mois',
    '6 mois',
    '1 an',
    '2 ans',
    '3 ans',
    '5 ans',
    '10 ans',
    'À vie',
    'Pas de garantie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTATS (8)
  etats: [
    'Neuf en boîte',
    'Neuf sans emballage',
    'Excellent état',
    'Bon état',
    'État moyen',
    'Reconditionné',
    'À réparer',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FONCTIONNALITÉS (30)
  fonctionnalites: [
    // Froid
    'No Frost', 'Distributeur eau', 'Distributeur glace', 'Multi-zones', 'Smart/WiFi',
    // Cuisson
    'Programmable', 'Chaleur tournante', 'Pyrolyse', 'Catalyse', 'Grill',
    'Décongélation auto', 'Cuisson vapeur', 'Convection',
    // Lavage
    'Départ différé', 'Séchage', 'Vapeur', 'Eco', 'Quick wash',
    'Silencieux', 'Inverter', 'Direct Drive',
    // Climatisation
    'Réversible (chaud/froid)', 'Déshumidificateur', 'Purificateur air', 'Minuterie',
    'Télécommande', 'Ioniseur',
    // Petit électroménager
    'Sans fil', 'Rechargeable', 'Pliable', 'Compact', 'Multifonction', 'Numérique',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS IMAGE & SON - ENRICHI
// ✅ MODALITÉS IMAGE & SON - REFONTE COMPLÈTE
export const IMAGE_SON_MODALITIES: ModalityCategory = {
  // ✅ NOMS DE PRODUITS (65+) - NOUVEAU
  noms_produits: [
    // Télévisions Samsung
    'TV Samsung QLED 55"', 'TV Samsung QLED 65"', 'TV Samsung QLED 75"',
    'TV Samsung Crystal UHD 43"', 'TV Samsung Crystal UHD 50"', 'TV Samsung Crystal UHD 55"',
    'TV Samsung The Frame 55"', 'TV Samsung The Frame 65"', 'TV Samsung Neo QLED 65"',
    // Télévisions LG
    'TV LG OLED 48"', 'TV LG OLED 55"', 'TV LG OLED 65"', 'TV LG OLED 77"',
    'TV LG NanoCell 50"', 'TV LG NanoCell 55"', 'TV LG NanoCell 65"',
    'TV LG UHD 43"', 'TV LG UHD 50"', 'TV LG UHD 55"',
    // Télévisions Sony
    'TV Sony Bravia XR 55"', 'TV Sony Bravia XR 65"', 'TV Sony Bravia OLED 55"',
    'TV Sony 4K 43"', 'TV Sony 4K 50"', 'TV Sony 4K 55"',
    // Télévisions TCL, Hisense (populaires en Afrique)
    'TV TCL QLED 55"', 'TV TCL 4K 43"', 'TV TCL 4K 50"', 'TV TCL 4K 55"',
    'TV Hisense ULED 55"', 'TV Hisense 4K 43"', 'TV Hisense 4K 50"', 'TV Hisense 4K 55"',
    // Télévisions autres marques
    'TV Philips Ambilight 55"', 'TV Toshiba 43"', 'TV Sharp Aquos 50"',
    // Home Cinéma
    'Home Cinéma Samsung', 'Home Cinéma Sony', 'Home Cinéma LG', 'Home Cinéma Philips',
    'Home Cinéma 5.1', 'Home Cinéma 7.1', 'Système Home Theater',
    // Barres de son
    'Barre de son Samsung', 'Barre de son Sony', 'Barre de son LG', 'Barre de son JBL',
    'Barre de son Bose', 'Barre de son Yamaha', 'Soundbar 2.1', 'Soundbar 5.1',
    // Enceintes
    'Enceintes JBL', 'Enceintes Bose', 'Enceintes Harman Kardon', 'Enceintes Sony',
    'Enceinte Bluetooth JBL Flip', 'Enceinte Bluetooth JBL Charge', 'Enceinte Bose SoundLink',
    // Projecteurs
    'Projecteur Epson', 'Projecteur BenQ', 'Projecteur Sony', 'Projecteur Optoma',
    'Vidéoprojecteur Full HD', 'Vidéoprojecteur 4K', 'Mini Projecteur',
    // Accessoires
    'Amplificateur Yamaha', 'Amplificateur Denon', 'Récepteur AV', 'Décodeur TV',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CATÉGORIES (10) - NOUVEAU
  categories: [
    'Télévision', 'Home Cinéma', 'Barre de son', 'Enceintes', 'Projecteur',
    'Amplificateur', 'Accessoires audio', 'Lecteur multimédia', 'Casque audio',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES D'ÉQUIPEMENTS (20+) - ENRICHI
  types: [
    // TV
    'TV LED', 'TV OLED', 'TV QLED', 'TV NanoCell', 'TV Crystal UHD', 'TV Neo QLED',
    'Smart TV', 'TV 4K', 'TV 8K', 'TV Full HD',
    // Audio
    'Home cinéma', 'Barre de son', 'Enceinte Bluetooth', 'Enceinte WiFi', 'Enceinte active',
    'Enceinte passive', 'Caisson de basses', 'Amplificateur', 'Récepteur AV',
    // Projecteurs
    'Projecteur Home Cinéma', 'Projecteur portable', 'Vidéoprojecteur', 'Mini projecteur',
    // Lecteurs
    'Lecteur Blu-ray', 'Lecteur DVD', 'Lecteur multimédia', 'Décodeur',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES (30+) - ENRICHI
  marques: [
    // TV
    'Samsung', 'LG', 'Sony', 'Philips', 'TCL', 'Hisense', 'Toshiba', 'Sharp',
    'Panasonic', 'Xiaomi', 'Skyworth', 'Changhong',
    // Audio
    'JBL', 'Bose', 'Harman Kardon', 'Sony', 'Yamaha', 'Denon', 'Marantz', 'Pioneer',
    'KEF', 'Klipsch', 'Bang & Olufsen', 'Marshall', 'Ultimate Ears',
    // Projecteurs
    'Epson', 'BenQ', 'Optoma', 'ViewSonic', 'Acer', 'Canon',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TECHNOLOGIES D'ÉCRAN (12) - NOUVEAU
  technologies_ecran: [
    'LED', 'OLED', 'QLED', 'Mini-LED', 'Neo QLED', 'NanoCell', 'Crystal UHD',
    'ULED', 'Triluminos', 'Quantum Dot', 'LCD', 'Plasma',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ RÉSOLUTIONS (10) - ENRICHI
  resolutions: [
    'HD (720p)', 'HD Ready (1366x768)', 'Full HD (1080p)', '2K',
    '4K UHD (3840x2160)', '4K', '8K UHD (7680x4320)', '8K',
    'QHD (2560x1440)', '1080p',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TAILLES D'ÉCRAN (18) - ENRICHI
  taillesEcran: [
    '24 pouces', '28 pouces', '32 pouces', '40 pouces', '43 pouces', '48 pouces',
    '50 pouces', '55 pouces', '58 pouces', '60 pouces', '65 pouces', '70 pouces',
    '75 pouces', '77 pouces', '82 pouces', '85 pouces', '98 pouces',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CONNECTIVITÉS (15+) - NOUVEAU
  connectivites: [
    'HDMI', 'HDMI 2.0', 'HDMI 2.1', 'USB', 'USB-C', 'Ethernet (RJ45)',
    'WiFi', 'WiFi 6', 'Bluetooth', 'Bluetooth 5.0', 'AirPlay',
    'Chromecast', 'Miracast', 'DLNA', 'ARC (Audio Return Channel)',
    'eARC', 'Optical (Toslink)', 'Coaxial', 'Jack 3.5mm', 'RCA',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FONCTIONNALITÉS (25+) - ENRICHI
  fonctionnalites: [
    // Smart TV
    'Smart TV', 'Android TV', 'WebOS', 'Tizen', 'Google TV', 'Roku TV',
    'Assistant vocal Google', 'Alexa', 'Bixby',
    // Image
    'HDR', 'HDR10', 'HDR10+', 'Dolby Vision', 'HLG', '120Hz', '144Hz',
    'VRR (Variable Refresh Rate)', 'ALLM (Auto Low Latency Mode)', 'Game Mode',
    // Audio
    'Dolby Atmos', 'DTS:X', 'Dolby Digital', 'DTS', 'Surround 5.1', 'Surround 7.1',
    // Connectivité
    'WiFi intégré', 'Bluetooth intégré', 'Chromecast intégré', 'AirPlay 2',
    // Autres
    'Enregistrement PVR', 'Time Shift', 'Tuner TNT', 'CI+ Slot', 'USB Recording',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTATS (8) - ENRICHI
  etats: [
    'Neuf scellé', 'Neuf avec garantie', 'Neuf déballé', 'Neuf - exposition',
    'Excellent état', 'Bon état', 'Occasion fonctionnel', 'À réparer',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GARANTIES (8) - NOUVEAU
  garanties: [
    'Garantie constructeur 1 an', 'Garantie constructeur 2 ans', 'Garantie constructeur 3 ans',
    'Garantie magasin 6 mois', 'Garantie magasin 1 an', 'Garantie étendue disponible',
    'Pas de garantie', 'Garantie expirée',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ACCESSOIRES INCLUS (20+) - NOUVEAU
  accessoires_inclus: [
    // TV
    'Télécommande', 'Télécommande Magic Remote', 'Télécommande vocale', 'Télécommande Bluetooth',
    'Câble HDMI', 'Câble d\'alimentation', 'Pied de table', 'Support mural', 'Manuel d\'utilisation',
    // Audio
    'Câble audio', 'Câble optique', 'Câble RCA', 'Caisson de basses', 'Subwoofer',
    'Enceintes satellites', 'Microphone', 'Câble Jack 3.5mm',
    // Projecteur
    'Câble VGA', 'Télécommande projecteur', 'Sacoche de transport', 'Lentille de rechange',
    // Autres
    'Piles incluses', 'Adaptateur secteur', 'Mode d\'emploi français',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MODÈLES/GAMMES (10) - NOUVEAU
  modeles: [
    'Entrée de gamme', 'Milieu de gamme', 'Haut de gamme', 'Premium', 'Flagship',
    'Série économique', 'Série standard', 'Série professionnelle',
    'Édition limitée', 'Reconditionné officiel',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS TÉLÉPHONES (SMARTPHONES) - ENRICHI
// ✅ MODALITÉS TÉLÉPHONES & ACCESSOIRES - \uD83D\uDCF1 ENRICHI AFRIQUE FRANCOPHONE
export const TELEPHONES_MODALITIES: ModalityCategory = {
  // ✅ Marques (TOP vendues en Afrique francophone - classement par popularité)
  marques: [
    // \uD83E\uDD47 TOP 5 AFRIQUE (80% du marché Cameroun, CI, Sénégal)
    'Tecno',      // #1 Afrique (rapport qualité-prix imbattable)
    'Infinix',    // #2 Afrique (HOT, NOTE, ZERO series)
    'Samsung',    // #3 (Galaxy A series très populaire)
    'Xiaomi',     // #4 (Redmi, POCO budget-friendly)
    'Itel',       // #5 (entrée de gamme, très accessible)

    // \uD83E\uDD48 TRÈS POPULAIRES (milieu/haut de gamme)
    'Realme',     // Budget gaming, jeunes
    'Oppo',       // Reno, A series
    'Vivo',       // Y series, selfie-focused
    'Redmi',      // Xiaomi budget
    'Poco',       // Xiaomi gaming budget

    // \uD83D\uDC8E PREMIUM (prestige, expatriés)
    'Apple',      // iPhone (statut social)
    'Huawei',     // Mate, P series (avant sanctions)
    'Honor',      // Ex-Huawei, populaire
    'OnePlus',    // Flagship killer
    'Google',     // Pixel (rares mais présents)

    // \uD83D\uDCF1 AUTRES MARQUES PRÉSENTES
    'Nokia',      // Nostalgie, robustesse
    'Motorola',   // Moto G series
    'Sony',       // Xperia (rares)
    'LG',         // Ancien stock
    'Nothing',    // Nouveauté tendance
    'Asus',       // ROG Phone (gaming)
    'ZTE',        // Budget
    'Blackview',  // Robustes, batterie longue durée
    'Ulefone',    // Outdoor, robustes
    'Doogee',     // Budget, batterie
    'Cubot',      // Budget
    'Oukitel',    // Batterie énorme

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Modèles populaires (50+ best-sellers Afrique)
  modeles_populaires: [
    // TECNO (best-sellers)
    'Tecno Spark 10', 'Tecno Spark 20', 'Tecno Camon 20', 'Tecno Phantom X2',
    'Tecno Pova 5', 'Tecno Pop 8',

    // INFINIX
    'Infinix Hot 30', 'Infinix Hot 40', 'Infinix Note 30', 'Infinix Zero 30',
    'Infinix Smart 8',

    // SAMSUNG (Galaxy A series - best-sellers Afrique)
    'Samsung Galaxy A54', 'Samsung Galaxy A34', 'Samsung Galaxy A24', 'Samsung Galaxy A14',
    'Samsung Galaxy A05', 'Samsung Galaxy S23', 'Samsung Galaxy S24',

    // XIAOMI / REDMI / POCO
    'Redmi Note 13', 'Redmi 13C', 'Redmi A3', 'Poco X6', 'Poco M6',
    'Xiaomi 14', 'Xiaomi 13T',

    // APPLE (iPhones populaires Afrique)
    'iPhone 15', 'iPhone 15 Pro', 'iPhone 14', 'iPhone 13', 'iPhone 12',
    'iPhone 11', 'iPhone XR', 'iPhone SE (2022)',

    // REALME
    'Realme C55', 'Realme 11', 'Realme GT 6',

    // OPPO
    'Oppo A78', 'Oppo Reno 11', 'Oppo A38',

    // VIVO
    'Vivo Y36', 'Vivo Y100', 'Vivo V29',

    // ITEL
    'Itel P55', 'Itel S23', 'Itel A70',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Capacités de stockage (réorganisées par popularité)
  stockage: [
    '128GB',  // Le plus vendu (standard actuel)
    '64GB',   // Budget/entrée de gamme
    '256GB',  // Milieu/haut de gamme
    '32GB',   // Très ancien/très budget
    '512GB',  // Haut de gamme
    '1TB',    // Premium
    '16GB',   // Très ancien
    '8GB',    // Feature phones
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Mémoire RAM (réorganisée)
  ram: [
    '4GB',    // Standard actuel entrée de gamme
    '6GB',    // Standard milieu de gamme
    '8GB',    // Standard haut de gamme
    '2GB',    // Très budget/ancien
    '3GB',    // Budget
    '12GB',   // Premium
    '16GB',   // Ultra premium/gaming
    '18GB',   // ROG Phone, gaming extrême
    '1GB',    // Feature phones
    '512MB',  // Très ancien
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Couleurs (enrichi avec noms marketing)
  couleurs: [
    // Classiques (toujours populaires)
    'Noir',
    'Noir Minuit',
    'Noir Carbone',
    'Blanc',
    'Blanc Polaire',
    'Gris',
    'Gris Sidéral',
    'Argent',

    // Métalliques et premium
    'Or',
    'Or Rose',
    'Titanium',
    'Titanium Naturel',
    'Graphite',
    'Bronze',
    'Cuivre',

    // Couleurs vives (populaires Afrique)
    'Bleu',
    'Bleu Pacifique',
    'Bleu Alpin',
    'Bleu Ciel',
    'Vert',
    'Vert Alpin',
    'Vert Forêt',
    'Rouge',
    'Rouge Pourpre',
    'Rose',
    'Rose Poudré',
    'Violet',
    'Lavande',
    'Corail',
    'Orange',
    'Jaune',

    // Dégradés (Tecno, Infinix, Realme)
    'Dégradé Bleu-Violet',
    'Dégradé Arc-en-ciel',
    'Holographique',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ États (détaillés pour marketplace)
  etats: [
    'Neuf scellé sous garantie',          // Jamais ouvert, facture
    'Neuf déballé sous garantie',         // Testé mais neuf
    'Reconditionné Grade A+ (comme neuf)', // 95%+ état
    'Reconditionné Grade A',              // 90%+ état
    'Reconditionné Grade B',              // 80%+ état, micro-rayures
    'Occasion - Excellent état',          // 90%+, utilisé avec soin
    'Occasion - Très bon état',           // 80-90%, rayures légères
    'Occasion - Bon état',                // 70-80%, usure normale
    'Occasion - État moyen',              // 60-70%, rayures visibles
    'À réparer (écran cassé)',            // Écran fissuré mais fonctionne
    'À réparer (batterie HS)',            // Batterie morte
    'À réparer (ne s\'allume pas)',       // Carte mère/autre
    'Pour pièces détachées',              // Non fonctionnel
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Opérateurs Afrique francophone (enrichi)
  operateurs: [
    // Universel
    'Débloqué (tous opérateurs)',
    'Dual SIM débloqué',

    // \uD83C\uDDE8\uD83C\uDDF2 CAMEROUN
    'Orange Cameroun',
    'MTN Cameroun',
    'Camtel',
    'Nexttel',

    // \uD83C\uDDE8\uD83C\uDDEE CÔTE D'IVOIRE
    'Orange CI',
    'MTN CI',
    'Moov CI',

    // \uD83C\uDDF8\uD83C\uDDF3 SÉNÉGAL
    'Orange Sénégal',
    'Free Sénégal',
    'Expresso Sénégal',

    // \uD83C\uDDF2\uD83C\uDDF1 MALI
    'Orange Mali',
    'Malitel',

    // \uD83C\uDDEC\uD83C\uDDE6 GABON
    'Airtel Gabon',
    'Moov Gabon',

    // Autres
    'Bloqué opérateur',
    'Bloqué iCloud (iPhone)',
    'Bloqué compte Google',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Accessoires inclus (enrichi)
  accessoires: [
    // Essentiels
    'Chargeur original',
    'Chargeur rapide original',
    'Chargeur compatible',
    'Câble USB-C',
    'Câble Lightning (iPhone)',
    'Câble micro-USB',
    'Adaptateur secteur',

    // Audio
    'Écouteurs filaires originaux',
    'Écouteurs sans fil',
    'AirPods',
    'Écouteurs compatibles',

    // Protection
    'Coque de protection',
    'Coque originale',
    'Protège-écran appliqué',
    'Protège-écran non appliqué',
    'Étui cuir',
    'Étui flip',

    // Autres
    'Boîte originale',
    'Manuel d\'utilisation',
    'Carte de garantie',
    'Facture d\'achat',
    'Carte SIM',
    'Outil éjection SIM',
    'Carte mémoire microSD',
    'Chargeur sans fil',
    'Support voiture',
    'Brassard sport',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types d'écran (enrichi)
  typesEcran: [
    // OLED variants (premium)
    'AMOLED',
    'Super AMOLED',
    'Dynamic AMOLED',
    'Dynamic AMOLED 2X',
    'LTPO AMOLED',
    'OLED',
    'P-OLED',

    // Apple
    'Retina',
    'Liquid Retina',
    'Super Retina XDR',
    'ProMotion',

    // LCD variants (budget/milieu)
    'IPS LCD',
    'LCD',
    'TFT LCD',
    'HD+ LCD',

    // Autres
    'Mini-LED',
    'E-Ink (liseuse)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Tailles d'écran (enrichi avec formats populaires)
  taillesEcran: [
    // Compacts (rares maintenant)
    '4.0"',
    '4.7"', // iPhone SE
    '5.4"', // iPhone 13 mini

    // Standards actuels
    '5.5"',
    '6.0"',
    '6.1"', // iPhone standard
    '6.3"',
    '6.4"',
    '6.5"', // Le plus populaire
    '6.6"',
    '6.7"', // iPhone Pro Max, flagships
    '6.8"', // Gaming phones

    // Grands écrans
    '7.0"',
    '7.2"',
    '7.6"', // Pliables (Galaxy Z Fold)
    '7.9"', // iPad mini

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU : Taux de rafraîchissement écran
  tauxRafraichissement: [
    '60Hz',   // Standard ancien
    '90Hz',   // Milieu de gamme
    '120Hz',  // Haut de gamme standard
    '144Hz',  // Gaming
    '165Hz',  // Gaming premium
    '240Hz',  // Gaming extrême
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU : Appareils photo (mégapixels)
  cameraPrincipale: [
    '8MP',
    '12MP',
    '13MP',
    '16MP',
    '20MP',
    '48MP',
    '50MP',
    '64MP',
    '108MP',
    '200MP',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU : Connectivité
  connectivite: [
    '5G',
    '4G LTE',
    '4G',
    '3G',
    'WiFi 6E',
    'WiFi 6',
    'WiFi 5',
    'Bluetooth 5.3',
    'Bluetooth 5.0',
    'NFC',
    'Infrarouge',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU : Capacité batterie (mAh)
  batterie: [
    '3000-4000 mAh',
    '4000-5000 mAh',  // Le plus courant
    '5000-6000 mAh',  // Très bon
    '6000-7000 mAh',  // Excellent
    '7000+ mAh',      // Exceptionnel
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU : Charge rapide
  chargeRapide: [
    '10W (charge standard)',
    '18W',
    '25W',
    '33W',
    '45W',
    '65W',
    '80W',
    '100W',
    '120W',
    '150W+',
    'Charge sans fil',
    'Charge inverse',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU : Garanties
  garanties: [
    'Garantie constructeur 1 an',
    'Garantie constructeur 2 ans',
    'Garantie vendeur 3 mois',
    'Garantie vendeur 6 mois',
    'Garantie vendeur 1 an',
    'AppleCare+',
    'Samsung Care+',
    'Aucune garantie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU : Sécurité biométrique
  securite: [
    'Face ID (3D)',
    'Reconnaissance faciale 2D',
    'Lecteur d\'empreinte sous écran',
    'Lecteur d\'empreinte latéral',
    'Lecteur d\'empreinte arrière',
    'Déverrouillage iris',
    'Code PIN uniquement',
    'Aucune sécurité biométrique',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS RÉPARATEUR TÉLÉPHONE/SMARTPHONE & TABLETTES - \uD83C\uDF0D AFRIQUE FRANCOPHONE
// Catégorie spécialisée pour les services de réparation mobile
export const REPARATEUR_TELEPHONE_TABLETTE_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE SERVICES DE RÉPARATION (40+) - Classés par fréquence Afrique
  typesReparation: [
    // \uD83D\uDD25 RÉPARATIONS LES PLUS COURANTES (90% des cas)
    '\uD83D\uDCF1 Remplacement écran LCD/AMOLED',
    '\uD83D\uDCF1 Réparation écran fissuré',
    '\uD83D\uDCF1 Remplacement vitre tactile',
    '\uD83D\uDD0B Remplacement batterie',
    '\uD83D\uDD0B Optimisation batterie (calibrage)',
    '\uD83D\uDD0C Réparation port de charge USB-C',
    '\uD83D\uDD0C Réparation port de charge micro-USB',
    '\uD83D\uDD0C Réparation port de charge Lightning (iPhone)',
    '\uD83D\uDD0A Réparation haut-parleur',
    '\uD83C\uDFA4 Réparation microphone',
    '\uD83D\uDCF8 Réparation caméra arrière',
    '\uD83E\uDD33 Réparation caméra frontale/selfie',

    // \uD83D\uDEE0️ RÉPARATIONS TECHNIQUES (hardware)
    '\uD83D\uDCA7 Réparation dégâts des eaux (oxydation)',
    '\uD83D\uDCA7 Nettoyage composants après chute dans l\'eau',
    '\uD83D\uDD27 Remplacement carte mère',
    '\uD83D\uDD27 Micro-soudure composants',
    '\uD83D\uDD27 Réparation circuits internes',
    '\uD83D\uDD27 Reballing (chipset)',
    '\uD83C\uDF9A️ Réparation boutons volume',
    '\uD83C\uDF9A️ Réparation bouton power',
    '\uD83C\uDF9A️ Réparation bouton home',
    '\uD83D\uDCE1 Réparation antenne WiFi',
    '\uD83D\uDCE1 Réparation antenne réseau mobile',
    '\uD83D\uDCF6 Réparation GPS',
    '\uD83D\uDD0A Réparation écouteur interne',
    '\uD83C\uDFA7 Réparation prise jack 3.5mm',
    '\uD83D\uDCF3 Réparation vibreur',
    '\uD83C\uDF21️ Réparation capteur de proximité',
    '☀️ Réparation capteur luminosité',

    // \uD83D\uDD10 DÉBLOCAGE & LOGICIEL (très demandé Afrique)
    '\uD83D\uDD13 Déblocage opérateur (tous réseaux)',
    '\uD83D\uDD13 Déblocage iCloud (iPhone)',
    '\uD83D\uDD13 Déblocage compte Google (FRP)',
    '\uD83D\uDD13 Déverrouillage code oublié',
    '\uD83D\uDD13 Déblocage schéma/motif',
    '\uD83D\uDCBE Flash/Réinstallation système',
    '\uD83D\uDCBE Mise à jour firmware',
    '\uD83D\uDCBE Downgrade version Android',
    '\uD83D\uDCBE Installation ROM custom',
    '\uD83D\uDCBE Root/Jailbreak',
    '\uD83D\uDCBE Suppression bloatware',
    '\uD83E\uDDA0 Suppression virus/malware',
    '\uD83D\uDDD1️ Récupération données (photos, contacts)',

    // \uD83D\uDEE1️ PRÉVENTION & ENTRETIEN
    '\uD83D\uDEE1️ Pose film protecteur écran (verre trempé)',
    '\uD83D\uDEE1️ Pose film protecteur caméra',
    '\uD83D\uDEE1️ Pose coque de protection',
    '\uD83E\uDDF9 Nettoyage complet (poussière, saleté)',
    '\uD83E\uDDF9 Nettoyage port de charge',
    '\uD83D\uDD0B Test diagnostic complet',
    '⚡ Optimisation performances',

    // \uD83C\uDFA8 PERSONNALISATION
    '\uD83C\uDFA8 Changement coque arrière (couleur)',
    '\uD83C\uDFA8 Customisation esthétique',

    // \uD83D\uDCF1 TABLETTES SPÉCIFIQUES
    '\uD83D\uDCBB Réparation tablette Samsung/iPad',
    '\uD83D\uDCBB Remplacement écran tablette',
    '\uD83D\uDCBB Remplacement batterie tablette',

    '\uD83C\uDD95 Autre réparation (ajouter)'
  ],

  // ✅ MARQUES SUPPORTÉES (60+) - Priorité marques populaires Afrique
  marquesSuppoortees: [
    // \uD83E\uDD47 TOP 5 AFRIQUE (expertise obligatoire)
    '\uD83D\uDCF1 Tecno (toutes séries)', // #1 Cameroun, CI, Congo
    '\uD83D\uDCF1 Infinix (toutes séries)', // #2 Afrique francophone
    '\uD83D\uDCF1 Samsung Galaxy (A, S, M, Z series)', // #3
    '\uD83D\uDCF1 Xiaomi / Redmi / Poco', // #4
    '\uD83D\uDCF1 Itel (toutes séries)', // #5 entrée de gamme

    // \uD83E\uDD48 TRÈS POPULAIRES AFRIQUE
    '\uD83D\uDCF1 Realme',
    '\uD83D\uDCF1 Oppo',
    '\uD83D\uDCF1 Vivo',
    '\uD83D\uDCF1 Honor',
    '\uD83D\uDCF1 Huawei',

    // \uD83D\uDC8E PREMIUM (expertise spécialisée = prix élevés)
    '\uD83D\uDCF1 Apple iPhone (toutes générations)',
    '\uD83D\uDCF1 iPhone 15 / 15 Pro / 15 Pro Max',
    '\uD83D\uDCF1 iPhone 14 / 14 Pro / 14 Pro Max',
    '\uD83D\uDCF1 iPhone 13 / 13 Pro / 13 Pro Max',
    '\uD83D\uDCF1 iPhone 12 / 12 Pro / 12 Pro Max',
    '\uD83D\uDCF1 iPhone 11 / 11 Pro / 11 Pro Max',
    '\uD83D\uDCF1 iPhone XR / XS / XS Max',
    '\uD83D\uDCF1 iPhone X / 8 / 8 Plus',
    '\uD83D\uDCF1 iPhone 7 / 7 Plus',
    '\uD83D\uDCF1 iPhone SE (2020/2022)',

    // \uD83D\uDCF1 AUTRES MARQUES PRÉSENTES
    '\uD83D\uDCF1 OnePlus',
    '\uD83D\uDCF1 Google Pixel',
    '\uD83D\uDCF1 Nokia',
    '\uD83D\uDCF1 Motorola',
    '\uD83D\uDCF1 Sony Xperia',
    '\uD83D\uDCF1 LG',
    '\uD83D\uDCF1 Asus (ROG Phone, ZenFone)',
    '\uD83D\uDCF1 Nothing Phone',
    '\uD83D\uDCF1 ZTE',
    '\uD83D\uDCF1 Blackview',
    '\uD83D\uDCF1 Ulefone',
    '\uD83D\uDCF1 Doogee',
    '\uD83D\uDCF1 Cubot',
    '\uD83D\uDCF1 Oukitel',

    // \uD83D\uDCBB TABLETTES
    '\uD83D\uDCBB iPad (toutes générations)',
    '\uD83D\uDCBB iPad Pro',
    '\uD83D\uDCBB iPad Air',
    '\uD83D\uDCBB iPad Mini',
    '\uD83D\uDCBB Samsung Galaxy Tab',
    '\uD83D\uDCBB Huawei MatePad',
    '\uD83D\uDCBB Lenovo Tab',
    '\uD83D\uDCBB Xiaomi Pad',
    '\uD83D\uDCBB Tecno Tablet',

    '\uD83C\uDD95 Autre marque (ajouter)'
  ],

  // ✅ MODÈLES POPULAIRES SPÉCIFIQUES (100+) - Focus Afrique francophone par pays
  modelesPopulaires: [
    // ═══════════════════════════════════════════════════
    // \uD83D\uDD25 TECNO (LEADER CAMEROUN, CI, RDC, CONGO, GABON)
    // ═══════════════════════════════════════════════════
    '\uD83D\uDCF1 Tecno Spark 10 Pro', '\uD83D\uDCF1 Tecno Spark 10C', '\uD83D\uDCF1 Tecno Spark 10',
    '\uD83D\uDCF1 Tecno Spark 20 Pro', '\uD83D\uDCF1 Tecno Spark 20', '\uD83D\uDCF1 Tecno Spark 20C',
    '\uD83D\uDCF1 Tecno Camon 20 Pro 5G', '\uD83D\uDCF1 Tecno Camon 20 Pro', '\uD83D\uDCF1 Tecno Camon 20',
    '\uD83D\uDCF1 Tecno Camon 19 Pro', '\uD83D\uDCF1 Tecno Camon 18 Premier',
    '\uD83D\uDCF1 Tecno Phantom X2 Pro', '\uD83D\uDCF1 Tecno Phantom X2', '\uD83D\uDCF1 Tecno Phantom X',
    '\uD83D\uDCF1 Tecno Pova 5 Pro', '\uD83D\uDCF1 Tecno Pova 5', '\uD83D\uDCF1 Tecno Pova 4 Pro',
    '\uD83D\uDCF1 Tecno Pova Neo 3', '\uD83D\uDCF1 Tecno Pova Neo 2',
    '\uD83D\uDCF1 Tecno Pop 8', '\uD83D\uDCF1 Tecno Pop 7 Pro', '\uD83D\uDCF1 Tecno Pop 7',

    // ═══════════════════════════════════════════════════
    // \uD83D\uDD25 INFINIX (LEADER MALI, BURKINA, NIGER, BÉNIN)
    // ═══════════════════════════════════════════════════
    '\uD83D\uDCF1 Infinix Hot 30i', '\uD83D\uDCF1 Infinix Hot 30', '\uD83D\uDCF1 Infinix Hot 30 Play',
    '\uD83D\uDCF1 Infinix Hot 40i', '\uD83D\uDCF1 Infinix Hot 40 Pro', '\uD83D\uDCF1 Infinix Hot 40',
    '\uD83D\uDCF1 Infinix Note 30 5G', '\uD83D\uDCF1 Infinix Note 30 Pro', '\uD83D\uDCF1 Infinix Note 30',
    '\uD83D\uDCF1 Infinix Note 30i', '\uD83D\uDCF1 Infinix Note 12 Pro', '\uD83D\uDCF1 Infinix Note 12',
    '\uD83D\uDCF1 Infinix Zero 30 5G', '\uD83D\uDCF1 Infinix Zero 30 4G', '\uD83D\uDCF1 Infinix Zero X Pro',
    '\uD83D\uDCF1 Infinix Smart 8 HD', '\uD83D\uDCF1 Infinix Smart 8 Pro', '\uD83D\uDCF1 Infinix Smart 8',
    '\uD83D\uDCF1 Infinix Smart 7 HD',

    // ═══════════════════════════════════════════════════
    // \uD83D\uDD25 SAMSUNG (LEADER SÉNÉGAL, MAURICE, SEYCHELLES)
    // ═══════════════════════════════════════════════════
    '\uD83D\uDCF1 Samsung Galaxy A05', '\uD83D\uDCF1 Samsung Galaxy A05s',
    '\uD83D\uDCF1 Samsung Galaxy A14 4G', '\uD83D\uDCF1 Samsung Galaxy A14 5G',
    '\uD83D\uDCF1 Samsung Galaxy A24 4G', '\uD83D\uDCF1 Samsung Galaxy A24',
    '\uD83D\uDCF1 Samsung Galaxy A34 5G', '\uD83D\uDCF1 Samsung Galaxy A54 5G',
    '\uD83D\uDCF1 Samsung Galaxy A04', '\uD83D\uDCF1 Samsung Galaxy A04e', '\uD83D\uDCF1 Samsung Galaxy A04s',
    '\uD83D\uDCF1 Samsung Galaxy M14 5G', '\uD83D\uDCF1 Samsung Galaxy M34 5G',
    '\uD83D\uDCF1 Samsung Galaxy S23 FE', '\uD83D\uDCF1 Samsung Galaxy S23', '\uD83D\uDCF1 Samsung Galaxy S23+', '\uD83D\uDCF1 Samsung Galaxy S23 Ultra',
    '\uD83D\uDCF1 Samsung Galaxy S24', '\uD83D\uDCF1 Samsung Galaxy S24+', '\uD83D\uDCF1 Samsung Galaxy S24 Ultra',
    '\uD83D\uDCF1 Samsung Galaxy S21 FE', '\uD83D\uDCF1 Samsung Galaxy S22',
    '\uD83D\uDCF1 Samsung Galaxy Z Flip 5', '\uD83D\uDCF1 Samsung Galaxy Z Fold 5',

    // ═══════════════════════════════════════════════════
    // \uD83D\uDD25 XIAOMI / REDMI / POCO (LEADER MADAGASCAR, MAURICE)
    // ═══════════════════════════════════════════════════
    '\uD83D\uDCF1 Redmi Note 13 Pro+ 5G', '\uD83D\uDCF1 Redmi Note 13 Pro', '\uD83D\uDCF1 Redmi Note 13 5G', '\uD83D\uDCF1 Redmi Note 13',
    '\uD83D\uDCF1 Redmi Note 12 Pro+', '\uD83D\uDCF1 Redmi Note 12 Pro', '\uD83D\uDCF1 Redmi Note 12',
    '\uD83D\uDCF1 Redmi 13C 5G', '\uD83D\uDCF1 Redmi 13C', '\uD83D\uDCF1 Redmi 12C', '\uD83D\uDCF1 Redmi 12',
    '\uD83D\uDCF1 Redmi A3', '\uD83D\uDCF1 Redmi A2', '\uD83D\uDCF1 Redmi A1',
    '\uD83D\uDCF1 Poco X6 Pro 5G', '\uD83D\uDCF1 Poco X6 5G', '\uD83D\uDCF1 Poco X5 Pro 5G',
    '\uD83D\uDCF1 Poco M6 Pro', '\uD83D\uDCF1 Poco M6', '\uD83D\uDCF1 Poco M5',
    '\uD83D\uDCF1 Poco F5 Pro 5G', '\uD83D\uDCF1 Poco F5 5G',
    '\uD83D\uDCF1 Xiaomi 14 Ultra', '\uD83D\uDCF1 Xiaomi 14', '\uD83D\uDCF1 Xiaomi 13T Pro', '\uD83D\uDCF1 Xiaomi 13T',

    // ═══════════════════════════════════════════════════
    // \uD83D\uDD25 ITEL (LEADER ENTRÉE DE GAMME - TOUS PAYS)
    // ═══════════════════════════════════════════════════
    '\uD83D\uDCF1 Itel P55 5G', '\uD83D\uDCF1 Itel P55+', '\uD83D\uDCF1 Itel P55',
    '\uD83D\uDCF1 Itel S23+', '\uD83D\uDCF1 Itel S23', '\uD83D\uDCF1 Itel S18',
    '\uD83D\uDCF1 Itel A70', '\uD83D\uDCF1 Itel A60s', '\uD83D\uDCF1 Itel A60',
    '\uD83D\uDCF1 Itel P40+', '\uD83D\uDCF1 Itel P40',

    // ═══════════════════════════════════════════════════
    // \uD83D\uDC8E APPLE iPHONE (PRESTIGE - TOUS PAYS)
    // ═══════════════════════════════════════════════════
    '\uD83D\uDCF1 iPhone 15 Pro Max', '\uD83D\uDCF1 iPhone 15 Pro', '\uD83D\uDCF1 iPhone 15 Plus', '\uD83D\uDCF1 iPhone 15',
    '\uD83D\uDCF1 iPhone 14 Pro Max', '\uD83D\uDCF1 iPhone 14 Pro', '\uD83D\uDCF1 iPhone 14 Plus', '\uD83D\uDCF1 iPhone 14',
    '\uD83D\uDCF1 iPhone 13 Pro Max', '\uD83D\uDCF1 iPhone 13 Pro', '\uD83D\uDCF1 iPhone 13', '\uD83D\uDCF1 iPhone 13 Mini',
    '\uD83D\uDCF1 iPhone 12 Pro Max', '\uD83D\uDCF1 iPhone 12 Pro', '\uD83D\uDCF1 iPhone 12', '\uD83D\uDCF1 iPhone 12 Mini',
    '\uD83D\uDCF1 iPhone 11 Pro Max', '\uD83D\uDCF1 iPhone 11 Pro', '\uD83D\uDCF1 iPhone 11',
    '\uD83D\uDCF1 iPhone XR', '\uD83D\uDCF1 iPhone XS Max', '\uD83D\uDCF1 iPhone XS', '\uD83D\uDCF1 iPhone X',
    '\uD83D\uDCF1 iPhone SE (2022)', '\uD83D\uDCF1 iPhone SE (2020)',
    '\uD83D\uDCF1 iPhone 8 Plus', '\uD83D\uDCF1 iPhone 8', '\uD83D\uDCF1 iPhone 7 Plus', '\uD83D\uDCF1 iPhone 7',

    // ═══════════════════════════════════════════════════
    // \uD83D\uDCF1 AUTRES MARQUES POPULAIRES
    // ═══════════════════════════════════════════════════
    '\uD83D\uDCF1 Realme C55', '\uD83D\uDCF1 Realme 11 Pro+', '\uD83D\uDCF1 Realme 11', '\uD83D\uDCF1 Realme GT 6',
    '\uD83D\uDCF1 Oppo A78 5G', '\uD83D\uDCF1 Oppo A78', '\uD83D\uDCF1 Oppo A38', '\uD83D\uDCF1 Oppo Reno 11 5G',
    '\uD83D\uDCF1 Vivo Y36', '\uD83D\uDCF1 Vivo Y100 5G', '\uD83D\uDCF1 Vivo V29',
    '\uD83D\uDCF1 Honor X9a', '\uD83D\uDCF1 Honor X8a', '\uD83D\uDCF1 Honor 90',
    '\uD83D\uDCF1 Huawei Nova Y91', '\uD83D\uDCF1 Huawei P60 Pro',

    // \uD83D\uDCBB TABLETTES POPULAIRES
    '\uD83D\uDCBB iPad 10.2" (9e gen)', '\uD83D\uDCBB iPad Air 5', '\uD83D\uDCBB iPad Pro 11"', '\uD83D\uDCBB iPad Pro 12.9"',
    '\uD83D\uDCBB Samsung Galaxy Tab A9+', '\uD83D\uDCBB Samsung Galaxy Tab S9 FE',

    '\uD83C\uDD95 Autre modèle (ajouter)'
  ],

  // ✅ DÉLAIS DE RÉPARATION (adaptation contexte africain)
  delaisReparation: [
    '⚡ Réparation express (1-2h)',
    '\uD83D\uDE80 Réparation rapide (3-6h)',
    '\uD83D\uDCC5 Réparation jour même',
    '\uD83D\uDCC5 24-48 heures',
    '\uD83D\uDCC5 2-3 jours',
    '\uD83D\uDCC5 3-5 jours',
    '\uD83D\uDCC5 5-7 jours',
    '\uD83D\uDCC5 1-2 semaines',
    '⏰ Selon disponibilité pièces (10-15 jours)',
    '\uD83D\uDEEB Import pièces nécessaire (3-4 semaines)',
    '\uD83C\uDD95 Autre délai (ajouter)'
  ],

  // ✅ GARANTIES RÉPARATION (très important pour confiance client)
  garantiesReparation: [
    '✅ Garantie 6 mois (pièces + main d\'œuvre)',
    '✅ Garantie 3 mois (pièces + main d\'œuvre)',
    '✅ Garantie 1 mois (pièces + main d\'œuvre)',
    '✅ Garantie 15 jours',
    '✅ Garantie pièces uniquement (3 mois)',
    '✅ Garantie à vie (certaines réparations)',
    '❌ Aucune garantie (pièces d\'occasion)',
    '\uD83D\uDD04 Garantie satisfait ou remboursé (7 jours)',
    '\uD83D\uDEE1️ Extension garantie disponible',
    '\uD83C\uDD95 Autre garantie (ajouter)'
  ],

  // ✅ QUALITÉ DES PIÈCES (transparence cruciale)
  qualitePieces: [
    '⭐ Pièces originales constructeur (neuves)',
    '⭐ Pièces originales Apple (iPhone)',
    '⭐ Pièces originales Samsung',
    '⭐ Pièces officielles revendeur agréé',
    '\uD83D\uDD04 Pièces reconditionnées d\'origine',
    '✅ Pièces compatibles premium (AAA+)',
    '✅ Pièces compatibles qualité supérieure (AAA)',
    '✅ Pièces compatibles standard (AA)',
    '⚠️ Pièces compatibles économiques (A)',
    '♻️ Pièces de récupération (occasion)',
    '\uD83C\uDF81 Choix client (original ou compatible)',
    '\uD83C\uDD95 Autre qualité (ajouter)'
  ],

  // ✅ CERTIFICATIONS & COMPÉTENCES (crédibilité réparateur)
  certifications: [
    '\uD83C\uDF93 Technicien certifié Apple (ACMT)',
    '\uD83C\uDF93 Technicien certifié Samsung',
    '\uD83C\uDF93 Technicien certifié Huawei',
    '\uD83C\uDF93 Certifié micro-soudure',
    '\uD83C\uDF93 Formation officielle constructeur',
    '\uD83C\uDFC6 +5 ans d\'expérience',
    '\uD83C\uDFC6 +10 ans d\'expérience',
    '\uD83C\uDFC6 +15 ans d\'expérience',
    '\uD83D\uDEE0️ Spécialiste iPhone exclusivement',
    '\uD83D\uDEE0️ Spécialiste Samsung exclusivement',
    '\uD83D\uDEE0️ Spécialiste déblocage',
    '\uD83D\uDEE0️ Spécialiste réparation carte mère',
    '\uD83D\uDEE0️ Spécialiste dégâts des eaux',
    '\uD83D\uDCA7 Expert récupération données',
    '⚡ Diagnostic gratuit',
    '\uD83D\uDCF1 Boutique physique',
    '\uD83D\uDE97 Service à domicile',
    '\uD83C\uDD95 Autre certification (ajouter)'
  ],

  // ✅ PRIX RÉPARATIONS ESTIMATIFS (fourchettes réalistes Afrique francophone)
  // Cameroun, CI, Sénégal, Mali, Gabon - FCFA (XAF/XOF)
  prixEstimatifs: [
    // ÉCRANS (le plus demandé)
    '\uD83D\uDCF1 Écran Tecno/Infinix/Itel: 15.000-35.000 FCFA',
    '\uD83D\uDCF1 Écran Samsung A-series: 25.000-60.000 FCFA',
    '\uD83D\uDCF1 Écran Xiaomi/Redmi: 20.000-50.000 FCFA',
    '\uD83D\uDCF1 Écran iPhone (modèles récents): 80.000-200.000 FCFA',
    '\uD83D\uDCF1 Écran iPhone (anciens modèles): 40.000-80.000 FCFA',

    // BATTERIES
    '\uD83D\uDD0B Batterie Tecno/Infinix/Itel: 5.000-15.000 FCFA',
    '\uD83D\uDD0B Batterie Samsung: 10.000-25.000 FCFA',
    '\uD83D\uDD0B Batterie iPhone: 20.000-50.000 FCFA',

    // CONNECTEURS & PORTS
    '\uD83D\uDD0C Port de charge (micro-USB/USB-C): 5.000-15.000 FCFA',
    '\uD83D\uDD0C Port Lightning (iPhone): 15.000-30.000 FCFA',

    // DÉBLOCAGES
    '\uD83D\uDD13 Déblocage opérateur: 5.000-20.000 FCFA',
    '\uD83D\uDD13 Déblocage iCloud/Google: 20.000-100.000 FCFA',

    // AUTRES
    '\uD83D\uDD0A Haut-parleur/microphone: 5.000-15.000 FCFA',
    '\uD83D\uDCF8 Caméra arrière: 10.000-40.000 FCFA',
    '\uD83D\uDCA7 Réparation dégâts eau: 20.000-100.000 FCFA',
    '\uD83D\uDD27 Carte mère: 50.000-300.000 FCFA',

    // SERVICES
    '\uD83D\uDEE1️ Pose film protecteur: 1.000-5.000 FCFA',
    '\uD83D\uDCBE Flash/réinstallation: 5.000-15.000 FCFA',
    '\uD83D\uDD0D Diagnostic: Gratuit',

    '\uD83C\uDD95 Autre tarif (ajouter)'
  ],

  // ✅ TYPES D'INTERVENTION (où se fait la réparation)
  typesIntervention: [
    '\uD83C\uDFEA En boutique/atelier (sur place)',
    '\uD83C\uDFE0 À domicile (déplacement)',
    '\uD83C\uDFE2 En entreprise',
    '\uD83D\uDCE6 Envoi par transporteur (réparation à distance)',
    '⚡ Service express sur place',
    '\uD83D\uDE97 Service mobile (atelier mobile)',
    '\uD83C\uDD95 Autre type (ajouter)'
  ],

  // ✅ ZONES D'INTERVENTION (utilise le système de quartiers déjà implémenté)
  zones_intervention: genererZonesIntervention('CM'),

  // ✅ VILLES (système contextualisé)
  villes: genererToutesLesVilles('CM'),

  // ✅ QUARTIERS (système contextualisé)
  quartiers: genererQuartiersPays('CM'),

  // ✅ SERVICES ADDITIONNELS
  servicesAdditionnels: [
    '\uD83D\uDCE6 Récupération domicile gratuite',
    '\uD83D\uDE97 Livraison domicile gratuite',
    '\uD83D\uDCB3 Paiement mobile money (Orange, MTN, Moov)',
    '\uD83D\uDCB3 Paiement en plusieurs fois',
    '\uD83C\uDF81 Devis gratuit',
    '\uD83D\uDD0D Diagnostic gratuit',
    '\uD83C\uDF81 Film protecteur offert',
    '\uD83C\uDF81 Coque offerte',
    '\uD83D\uDEE1️ Assurance réparation disponible',
    '\uD83D\uDCDE Support téléphonique gratuit',
    '\uD83D\uDCAC Support WhatsApp 24/7',
    '\uD83D\uDD04 Prêt de téléphone pendant réparation',
    '\uD83D\uDCF1 Rachat ancien téléphone',
    '♻️ Reprise ancien appareil',
    '\uD83C\uDD95 Autre service (ajouter)'
  ],

  // ✅ MODES DE PAIEMENT (contexte Afrique)
  modesPaiement: [
    '\uD83D\uDCB5 Espèces',
    '\uD83D\uDCF1 Mobile Money (Orange Money)',
    '\uD83D\uDCF1 Mobile Money (MTN Mobile Money)',
    '\uD83D\uDCF1 Mobile Money (Moov Money)',
    '\uD83D\uDCB3 Carte bancaire',
    '\uD83D\uDCB3 Virement bancaire',
    '\uD83C\uDFE6 Paiement en boutique',
    '\uD83D\uDCE6 Paiement à la livraison',
    '\uD83D\uDCC5 Paiement en plusieurs fois',
    '\uD83C\uDD95 Autre mode (ajouter)'
  ],

  // ✅ LANGUES PARLÉES (important pour service client)
  languesParlees: [
    '\uD83C\uDDEB\uD83C\uDDF7 Français',
    '\uD83D\uDDE3️ Anglais',
    '\uD83D\uDDE3️ Douala (Cameroun)',
    '\uD83D\uDDE3️ Bamiléké (Cameroun)',
    '\uD83D\uDDE3️ Ewondo (Cameroun)',
    '\uD83D\uDDE3️ Fulfuldé (Cameroun)',
    '\uD83D\uDDE3️ Dioula (CI, Mali, Burkina)',
    '\uD83D\uDDE3️ Baoulé (Côte d\'Ivoire)',
    '\uD83D\uDDE3️ Wolof (Sénégal)',
    '\uD83D\uDDE3️ Lingala (RDC, Congo)',
    '\uD83D\uDDE3️ Swahili (RDC)',
    '\uD83C\uDD95 Autre langue (ajouter)'
  ],

  // ✅ HORAIRES D'OUVERTURE
  horaires: [
    '\uD83D\uDD50 Lun-Ven: 8h-18h, Sam: 9h-17h',
    '\uD83D\uDD50 Lun-Sam: 8h-19h',
    '\uD83D\uDD50 Lun-Dim: 8h-20h',
    '\uD83D\uDD50 Tous les jours: 8h-21h',
    '⏰ 24h/24 (urgences)',
    '\uD83C\uDF19 Service de nuit disponible',
    '\uD83D\uDCDE Sur rendez-vous uniquement',
    '\uD83C\uDD95 Autres horaires (ajouter)'
  ],

  // ✅ ÉTAT DES APPAREILS ACCEPTÉS
  etatsAcceptes: [
    '✅ Neuf (sous garantie)',
    '✅ Occasion (bon état)',
    '✅ Occasion (état moyen)',
    '✅ Écran cassé (fonctionne)',
    '✅ Écran cassé (ne fonctionne pas)',
    '✅ Endommagé par l\'eau',
    '✅ Ne s\'allume pas',
    '✅ Bloqué (iCloud, Google)',
    '✅ Tous états acceptés',
    '❌ Uniquement bon état',
    '\uD83C\uDD95 Autre état (ajouter)'
  ]
};

// ✅ MODALITÉS RÉPARATEUR INFORMATIQUE (Ordinateurs, Imprimantes, Équipements) - \uD83C\uDF0D AFRIQUE FRANCOPHONE
// Catégorie spécialisée pour les services de réparation/dépannage informatique
export const REPARATEUR_INFORMATIQUE_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE SERVICES DE RÉPARATION INFORMATIQUE (60+) - Classés par fréquence
  typesReparation: [
    // \uD83D\uDD25 RÉPARATIONS HARDWARE LES PLUS COURANTES (70% des cas)
    '\uD83D\uDCBB Réparation écran cassé/fissuré (laptop)',
    '\uD83D\uDCBB Remplacement écran LCD/LED',
    '\uD83D\uDCBB Réparation charnières cassées',
    '\uD83D\uDD0B Remplacement batterie laptop',
    '\uD83D\uDD0B Batterie ne charge plus',
    '\uD83D\uDD0B Réparation port de charge DC',
    '\uD83D\uDD0C Réparation port USB (2.0, 3.0, USB-C)',
    '\uD83D\uDD0C Réparation port HDMI',
    '\uD83D\uDD0C Réparation prise alimentation',
    '⌨️ Remplacement clavier (touches cassées/manquantes)',
    '⌨️ Réparation clavier rétroéclairé',
    '\uD83D\uDDB1️ Réparation touchpad/pavé tactile',
    '\uD83D\uDD0A Réparation haut-parleurs',
    '\uD83C\uDFA4 Réparation microphone',
    '\uD83D\uDCF8 Réparation webcam',
    '\uD83C\uDF21️ Nettoyage ventilateur (surchauffe)',
    '\uD83C\uDF21️ Remplacement ventilateur/système refroidissement',
    '\uD83C\uDF21️ Changement pâte thermique',

    // \uD83D\uDEE0️ RÉPARATIONS TECHNIQUES AVANCÉES (hardware)
    '\uD83D\uDCA7 Réparation dégâts des eaux/liquides renversés',
    '\uD83D\uDCA7 Oxydation carte mère (eau/humidité)',
    '\uD83D\uDCA7 Séchage et nettoyage composants',
    '\uD83D\uDD27 Réparation carte mère',
    '\uD83D\uDD27 Micro-soudure composants électroniques',
    '\uD83D\uDD27 Remplacement chipset graphique (reballing)',
    '\uD83D\uDD27 Réparation circuits internes',
    '\uD83D\uDCBE Remplacement disque dur HDD',
    '\uD83D\uDCBE Remplacement SSD',
    '\uD83D\uDCBE Upgrade HDD vers SSD',
    '\uD83D\uDCBE Installation dual storage (SSD + HDD)',
    '\uD83E\uDDE0 Upgrade RAM (ajout mémoire)',
    '\uD83E\uDDE0 Remplacement barrettes RAM défectueuses',
    '\uD83C\uDFAE Remplacement carte graphique dédiée (PC bureau)',
    '\uD83C\uDFAE Réparation carte graphique',
    '⚡ Remplacement alimentation (PC bureau)',
    '⚡ Réparation bloc d\'alimentation',
    '\uD83D\uDCE1 Réparation carte WiFi',
    '\uD83D\uDCE1 Réparation Bluetooth',
    '\uD83D\uDCE1 Remplacement carte réseau Ethernet',

    // \uD83D\uDCBB RÉPARATIONS LOGICIELLES (très demandé Afrique)
    '\uD83E\uDE9F Réinstallation Windows (10, 11)',
    '\uD83E\uDE9F Formatage complet',
    '\uD83E\uDE9F Réparation système d\'exploitation',
    '\uD83E\uDE9F Installation macOS (Hackintosh)',
    '\uD83D\uDC27 Installation Linux Ubuntu/Mint',
    '\uD83D\uDD04 Dual boot (Windows + Linux)',
    '\uD83D\uDCBF Installation pilotes manquants',
    '\uD83D\uDCBF Mise à jour BIOS/UEFI',
    '\uD83E\uDDA0 Suppression virus/malware/ransomware',
    '\uD83E\uDDA0 Nettoyage adware/spyware',
    '\uD83E\uDDA0 Protection antivirus professionnelle',
    '\uD83D\uDDD1️ Récupération de données (disque défaillant)',
    '\uD83D\uDDD1️ Restauration fichiers supprimés',
    '\uD83D\uDDD1️ Récupération partition perdue',
    '⚡ Optimisation performances (lenteur)',
    '⚡ Nettoyage système (fichiers temporaires)',
    '⚡ Défragmentation disque',
    '⚡ Suppression bloatware',

    // \uD83D\uDDA8️ RÉPARATIONS IMPRIMANTES (essentiel Afrique bureautique)
    '\uD83D\uDDA8️ Réparation imprimante jet d\'encre',
    '\uD83D\uDDA8️ Réparation imprimante laser',
    '\uD83D\uDDA8️ Déblocage bourrage papier récurrent',
    '\uD83D\uDDA8️ Nettoyage têtes d\'impression',
    '\uD83D\uDDA8️ Réparation bac à papier',
    '\uD83D\uDDA8️ Remplacement tambour (drum)',
    '\uD83D\uDDA8️ Réparation scanner (multifonction)',
    '\uD83D\uDDA8️ Réparation photocopieuse',
    '\uD83D\uDDA8️ Installation pilote imprimante',
    '\uD83D\uDDA8️ Configuration imprimante réseau',
    '\uD83D\uDDA8️ Réparation imprimante 3D',

    // \uD83C\uDF10 RÉSEAUX & CONNECTIVITÉ
    '\uD83D\uDCF6 Installation/configuration réseau WiFi',
    '\uD83D\uDCF6 Réparation connexion Internet',
    '\uD83D\uDCF6 Configuration routeur/modem',
    '\uD83D\uDCF6 Installation réseau local (LAN)',
    '\uD83D\uDCF6 Partage imprimante en réseau',
    '\uD83D\uDD10 Configuration VPN',
    '\uD83D\uDD10 Sécurisation réseau WiFi',

    // \uD83D\uDCBC SERVICES PROFESSIONNELS
    '\uD83D\uDCE7 Configuration emails professionnels',
    '\uD83D\uDCE7 Migration données vers nouveau PC',
    '\uD83D\uDCE7 Sauvegarde automatique cloud',
    '\uD83D\uDCBC Installation suite Office',
    '\uD83D\uDCBC Installation logiciels professionnels',
    '\uD83C\uDFA8 Installation logiciels design (Adobe, etc.)',
    '\uD83C\uDFAE Optimisation PC gaming',
    '\uD83C\uDFAC Installation logiciels montage vidéo',

    // \uD83D\uDEE1️ MAINTENANCE PRÉVENTIVE
    '\uD83E\uDDF9 Nettoyage interne complet (poussière)',
    '\uD83E\uDDF9 Nettoyage clavier/écran',
    '\uD83D\uDD0B Test diagnostic complet',
    '\uD83D\uDD27 Maintenance périodique (check-up)',
    '⚙️ Mise à jour logiciels/drivers',

    // \uD83C\uDFA8 AUTRES SERVICES
    '\uD83D\uDD13 Déverrouillage mot de passe BIOS',
    '\uD83D\uDD13 Récupération mot de passe Windows',
    '\uD83D\uDD13 Déverrouillage session utilisateur',
    '\uD83D\uDCE6 Assemblage PC sur mesure',
    '\uD83D\uDCE6 Upgrade composants (CPU, GPU, RAM)',
    '\uD83D\uDE9A Intervention à domicile/bureau',

    '\uD83C\uDD95 Autre réparation (ajouter)'
  ],

  // ✅ MARQUES ORDINATEURS SUPPORTÉES (50+) - Focus Afrique francophone
  marquesOrdinateurs: [
    // \uD83E\uDD47 TOP 5 AFRIQUE (expertise OBLIGATOIRE)
    '\uD83D\uDCBB HP (toutes séries)', // #1 Afrique (EliteBook, ProBook, Pavilion)
    '\uD83D\uDCBB Dell (toutes séries)', // #2 (Latitude, Inspiron, XPS)
    '\uD83D\uDCBB Lenovo (ThinkPad, IdeaPad)', // #3
    '\uD83D\uDCBB Asus (VivoBook, ROG, ZenBook)', // #4 Gaming + Pro
    '\uD83D\uDCBB Acer (Aspire, Swift, Nitro)', // #5 Budget

    // \uD83E\uDD48 TRÈS POPULAIRES AFRIQUE
    '\uD83D\uDCBB Toshiba (Satellite, Tecra)', // Ancien mais beaucoup d'occasions
    '\uD83D\uDCBB Samsung (Galaxy Book, Notebook)',
    '\uD83D\uDCBB Compaq', // Ancien HP, beaucoup d'occasions
    '\uD83D\uDCBB Packard Bell', // Occasion Europe

    // \uD83D\uDC8E APPLE (expertise spécialisée = prix élevés)
    '\uD83C\uDF4E Apple MacBook Air (toutes générations)',
    '\uD83C\uDF4E Apple MacBook Pro (toutes générations)',
    '\uD83C\uDF4E Apple MacBook Pro M1/M2/M3',
    '\uD83C\uDF4E Apple MacBook Air M1/M2/M3',
    '\uD83C\uDF4E Apple iMac',
    '\uD83C\uDF4E Apple Mac Mini',
    '\uD83C\uDF4E Apple Mac Studio',

    // \uD83C\uDFAE GAMING SPÉCIALISÉ
    '\uD83C\uDFAE MSI (Gaming, Workstation)',
    '\uD83C\uDFAE Razer (Blade, Book)',
    '\uD83C\uDFAE Alienware (Dell Gaming)',
    '\uD83C\uDFAE Gigabyte (Aero, Aorus)',

    // \uD83C\uDF0D AUTRES MARQUES PRÉSENTES
    '\uD83D\uDCBB Microsoft Surface (Pro, Laptop, Book)',
    '\uD83D\uDCBB LG Gram',
    '\uD83D\uDCBB Huawei MateBook',
    '\uD83D\uDCBB Fujitsu (LifeBook)',
    '\uD83D\uDCBB Sony VAIO (ancien, occasion)',

    '\uD83C\uDD95 Autre marque ordinateur (ajouter)'
  ],

  // ✅ MARQUES IMPRIMANTES SUPPORTÉES (30+) - Essentielles Afrique bureautique
  marquesImprimantes: [
    // \uD83E\uDD47 TOP 3 IMPRIMANTES AFRIQUE (90% du marché)
    '\uD83D\uDDA8️ HP (LaserJet, DeskJet, OfficeJet)', // #1 absolu
    '\uD83D\uDDA8️ Epson (EcoTank, WorkForce, L-series)', // #2 (populaire pour L380, L3110)
    '\uD83D\uDDA8️ Canon (PIXMA, MAXIFY, imageCLASS)', // #3

    // \uD83E\uDD48 POPULAIRES
    '\uD83D\uDDA8️ Brother (DCP, MFC, HL-series)',
    '\uD83D\uDDA8️ Samsung (Xpress, ProXpress)', // Maintenant HP
    '\uD83D\uDDA8️ Kyocera', // Bureaux professionnels
    '\uD83D\uDDA8️ Ricoh', // Photocopieurs pro

    // \uD83C\uDF0D MARQUES BUDGET (très présentes Afrique)
    '\uD83D\uDDA8️ Pantum', // Chinois, bon marché
    '\uD83D\uDDA8️ Lexmark',
    '\uD83D\uDDA8️ Xerox', // Pro
    '\uD83D\uDDA8️ Sharp', // Photocopieurs
    '\uD83D\uDDA8️ Konica Minolta', // Pro multifonctions
    '\uD83D\uDDA8️ OKI',
    '\uD83D\uDDA8️ Develop',

    '\uD83C\uDD95 Autre marque imprimante (ajouter)'
  ],

  // ✅ MODÈLES ORDINATEURS POPULAIRES PAR PAYS - \uD83C\uDF0D AFRIQUE FRANCOPHONE (200+)
  modelesOrdinateursPopulaires: [
    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDDE8\uD83C\uDDF2 CAMEROUN (Douala, Yaoundé, Bafoussam) - HP, Dell, Lenovo
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDDE8\uD83C\uDDF2 HP EliteBook 840 G5/G6/G7/G8', // Pro bureautique
    '\uD83C\uDDE8\uD83C\uDDF2 HP EliteBook 850 G5/G6/G7',
    '\uD83C\uDDE8\uD83C\uDDF2 HP ProBook 450 G6/G7/G8/G9', // Très populaire PME
    '\uD83C\uDDE8\uD83C\uDDF2 HP ProBook 440 G7/G8',
    '\uD83C\uDDE8\uD83C\uDDF2 HP Pavilion 15', // Grand public
    '\uD83C\uDDE8\uD83C\uDDF2 HP Pavilion Gaming 15',
    '\uD83C\uDDE8\uD83C\uDDF2 HP 250 G7/G8', // Entrée de gamme
    '\uD83C\uDDE8\uD83C\uDDF2 HP 15-dy/dw series',
    '\uD83C\uDDE8\uD83C\uDDF2 HP Compaq 6200/8200 Pro', // Occasion courant

    '\uD83C\uDDE8\uD83C\uDDF2 Dell Latitude 5490/5500/5510/5520', // Pro très populaire
    '\uD83C\uDDE8\uD83C\uDDF2 Dell Latitude 7490/7400/7410',
    '\uD83C\uDDE8\uD83C\uDDF2 Dell Inspiron 15 3000/5000 series',
    '\uD83C\uDDE8\uD83C\uDDF2 Dell Inspiron 14 5000',
    '\uD83C\uDDE8\uD83C\uDDF2 Dell Vostro 3590/3500', // PME
    '\uD83C\uDDE8\uD83C\uDDF2 Dell OptiPlex 3070/5070 (bureau)',

    '\uD83C\uDDE8\uD83C\uDDF2 Lenovo ThinkPad E14/E15 Gen 2/3', // Pro populaire
    '\uD83C\uDDE8\uD83C\uDDF2 Lenovo ThinkPad L14/L15',
    '\uD83C\uDDE8\uD83C\uDDF2 Lenovo ThinkPad T14/T15',
    '\uD83C\uDDE8\uD83C\uDDF2 Lenovo ThinkPad X1 Carbon', // Premium
    '\uD83C\uDDE8\uD83C\uDDF2 Lenovo IdeaPad 3/5 series', // Grand public
    '\uD83C\uDDE8\uD83C\uDDF2 Lenovo V14/V15', // Budget bureautique

    '\uD83C\uDDE8\uD83C\uDDF2 Asus VivoBook 15 X512/X515',
    '\uD83C\uDDE8\uD83C\uDDF2 Asus VivoBook S15',
    '\uD83C\uDDE8\uD83C\uDDF2 Asus TUF Gaming A15/F15', // Gaming populaire
    '\uD83C\uDDE8\uD83C\uDDF2 Asus ROG Strix G15',

    '\uD83C\uDDE8\uD83C\uDDF2 Acer Aspire 3/5/7 series',
    '\uD83C\uDDE8\uD83C\uDDF2 Acer Swift 3',
    '\uD83C\uDDE8\uD83C\uDDF2 Acer Nitro 5', // Gaming budget

    '\uD83C\uDDE8\uD83C\uDDF2 Toshiba Satellite C50/C55', // Occasion courant
    '\uD83C\uDDE8\uD83C\uDDF2 Toshiba Tecra A50',

    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDDF8\uD83C\uDDF3 SÉNÉGAL (Dakar, Thiès, Saint-Louis) - HP, Dell
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDDF8\uD83C\uDDF3 HP EliteBook 840 G5/G6',
    '\uD83C\uDDF8\uD83C\uDDF3 HP ProBook 450 G7/G8',
    '\uD83C\uDDF8\uD83C\uDDF3 HP ProBook 640 G5',
    '\uD83C\uDDF8\uD83C\uDDF3 HP Pavilion 14/15',
    '\uD83C\uDDF8\uD83C\uDDF3 HP 250 G7',

    '\uD83C\uDDF8\uD83C\uDDF3 Dell Latitude 5400/5500',
    '\uD83C\uDDF8\uD83C\uDDF3 Dell Inspiron 15 3000',
    '\uD83C\uDDF8\uD83C\uDDF3 Dell Vostro 3590',

    '\uD83C\uDDF8\uD83C\uDDF3 Lenovo ThinkPad E14',
    '\uD83C\uDDF8\uD83C\uDDF3 Lenovo IdeaPad 3',
    '\uD83C\uDDF8\uD83C\uDDF3 Lenovo V15',

    '\uD83C\uDDF8\uD83C\uDDF3 Asus VivoBook 15',
    '\uD83C\uDDF8\uD83C\uDDF3 Acer Aspire 5',

    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDDE8\uD83C\uDDEE CÔTE D'IVOIRE (Abidjan, Bouaké, Yamoussoukro)
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDDE8\uD83C\uDDEE HP EliteBook 840 G6/G7',
    '\uD83C\uDDE8\uD83C\uDDEE HP ProBook 450 G8',
    '\uD83C\uDDE8\uD83C\uDDEE HP Pavilion 15-eg',
    '\uD83C\uDDE8\uD83C\uDDEE HP 250 G8',

    '\uD83C\uDDE8\uD83C\uDDEE Dell Latitude 5510/5520',
    '\uD83C\uDDE8\uD83C\uDDEE Dell Inspiron 15 5000',
    '\uD83C\uDDE8\uD83C\uDDEE Dell Vostro 3500',

    '\uD83C\uDDE8\uD83C\uDDEE Lenovo ThinkPad E15 Gen 3',
    '\uD83C\uDDE8\uD83C\uDDEE Lenovo IdeaPad 5',
    '\uD83C\uDDE8\uD83C\uDDEE Lenovo V14',

    '\uD83C\uDDE8\uD83C\uDDEE Asus VivoBook 15 X515',
    '\uD83C\uDDE8\uD83C\uDDEE Asus TUF Gaming F15',
    '\uD83C\uDDE8\uD83C\uDDEE Acer Aspire 5 A515',

    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDDF2\uD83C\uDDF1 MALI (Bamako, Sikasso, Mopti)
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDDF2\uD83C\uDDF1 HP ProBook 450 G7',
    '\uD83C\uDDF2\uD83C\uDDF1 HP 250 G7',
    '\uD83C\uDDF2\uD83C\uDDF1 HP Pavilion 14',
    '\uD83C\uDDF2\uD83C\uDDF1 Dell Latitude 5490',
    '\uD83C\uDDF2\uD83C\uDDF1 Dell Inspiron 14 3000',
    '\uD83C\uDDF2\uD83C\uDDF1 Lenovo V15-IIL',
    '\uD83C\uDDF2\uD83C\uDDF1 Lenovo IdeaPad 3 15',
    '\uD83C\uDDF2\uD83C\uDDF1 Asus VivoBook 14',
    '\uD83C\uDDF2\uD83C\uDDF1 Acer Aspire 3',

    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDDE7\uD83C\uDDEB BURKINA FASO (Ouagadougou, Bobo-Dioulasso)
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDDE7\uD83C\uDDEB HP ProBook 450 G6',
    '\uD83C\uDDE7\uD83C\uDDEB HP 250 G6/G7',
    '\uD83C\uDDE7\uD83C\uDDEB Dell Latitude 5480/5490',
    '\uD83C\uDDE7\uD83C\uDDEB Dell Inspiron 15 3000',
    '\uD83C\uDDE7\uD83C\uDDEB Lenovo V15',
    '\uD83C\uDDE7\uD83C\uDDEB Lenovo IdeaPad 3',
    '\uD83C\uDDE7\uD83C\uDDEB Asus VivoBook 15',
    '\uD83C\uDDE7\uD83C\uDDEB Acer Aspire 5',

    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDDEC\uD83C\uDDE6 GABON (Libreville, Port-Gentil)
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDDEC\uD83C\uDDE6 HP EliteBook 840 G7/G8', // Plus de premium (secteur pétrolier)
    '\uD83C\uDDEC\uD83C\uDDE6 HP ProBook 450 G8/G9',
    '\uD83C\uDDEC\uD83C\uDDE6 Dell Latitude 5510/5520',
    '\uD83C\uDDEC\uD83C\uDDE6 Dell XPS 13/15', // Plus de haut de gamme
    '\uD83C\uDDEC\uD83C\uDDE6 Lenovo ThinkPad T14/T15',
    '\uD83C\uDDEC\uD83C\uDDE6 MacBook Air M1/M2',
    '\uD83C\uDDEC\uD83C\uDDE6 MacBook Pro 13"/14"',

    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDDE8\uD83C\uDDEC CONGO (Brazzaville, Pointe-Noire)
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDDE8\uD83C\uDDEC HP EliteBook 840 G6',
    '\uD83C\uDDE8\uD83C\uDDEC HP ProBook 450 G7',
    '\uD83C\uDDE8\uD83C\uDDEC Dell Latitude 5500',
    '\uD83C\uDDE8\uD83C\uDDEC Lenovo ThinkPad E14',
    '\uD83C\uDDE8\uD83C\uDDEC Asus VivoBook 15',
    '\uD83C\uDDE8\uD83C\uDDEC Acer Aspire 5',

    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDDE8\uD83C\uDDE9 RDC (Kinshasa, Lubumbashi, Goma)
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDDE8\uD83C\uDDE9 HP ProBook 450 G6/G7',
    '\uD83C\uDDE8\uD83C\uDDE9 HP 250 G7',
    '\uD83C\uDDE8\uD83C\uDDE9 HP Pavilion 15',
    '\uD83C\uDDE8\uD83C\uDDE9 Dell Latitude 5490',
    '\uD83C\uDDE8\uD83C\uDDE9 Dell Inspiron 15 3000',
    '\uD83C\uDDE8\uD83C\uDDE9 Lenovo V14/V15',
    '\uD83C\uDDE8\uD83C\uDDE9 Lenovo IdeaPad 3',
    '\uD83C\uDDE8\uD83C\uDDE9 Asus VivoBook 14/15',
    '\uD83C\uDDE8\uD83C\uDDE9 Acer Aspire 3/5',

    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDDF9\uD83C\uDDE9 TCHAD (N'Djamena, Moundou)
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDDF9\uD83C\uDDE9 HP ProBook 450 G7',
    '\uD83C\uDDF9\uD83C\uDDE9 HP 250 G7',
    '\uD83C\uDDF9\uD83C\uDDE9 Dell Latitude 5490',
    '\uD83C\uDDF9\uD83C\uDDE9 Lenovo V15',
    '\uD83C\uDDF9\uD83C\uDDE9 Asus VivoBook 15',

    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDDF2\uD83C\uDDEC MADAGASCAR (Antananarivo, Toamasina)
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDDF2\uD83C\uDDEC HP ProBook 450 G6/G7',
    '\uD83C\uDDF2\uD83C\uDDEC HP Pavilion 14',
    '\uD83C\uDDF2\uD83C\uDDEC Dell Inspiron 14 3000',
    '\uD83C\uDDF2\uD83C\uDDEC Lenovo IdeaPad 3',
    '\uD83C\uDDF2\uD83C\uDDEC Asus VivoBook 14',
    '\uD83C\uDDF2\uD83C\uDDEC Acer Aspire 3',

    // ═══════════════════════════════════════════════════════════════
    // \uD83C\uDF0D MODÈLES OCCIDENTAUX PRÉSENTS EN AFRIQUE (import, expatriés)
    // ═══════════════════════════════════════════════════════════════
    '\uD83C\uDF0D HP Spectre x360',
    '\uD83C\uDF0D HP Envy 13/15',
    '\uD83C\uDF0D HP ZBook (workstation)',

    '\uD83C\uDF0D Dell XPS 13/15/17',
    '\uD83C\uDF0D Dell Precision (workstation)',
    '\uD83C\uDF0D Dell G3/G5/G7 Gaming',

    '\uD83C\uDF0D Lenovo ThinkPad X1 Extreme',
    '\uD83C\uDF0D Lenovo Legion 5/7 (gaming)',
    '\uD83C\uDF0D Lenovo Yoga (2-en-1)',

    '\uD83C\uDF0D Asus ZenBook 13/14/15',
    '\uD83C\uDF0D Asus ROG Zephyrus',
    '\uD83C\uDF0D Asus ROG Flow',

    '\uD83C\uDF0D Acer Predator Helios',
    '\uD83C\uDF0D Acer ConceptD (créatifs)',

    '\uD83C\uDF0D MSI GF/GP/GE/GT series',
    '\uD83C\uDF0D MSI Creator/Prestige',

    '\uD83C\uDF0D Razer Blade 14/15/17',

    '\uD83C\uDF0D Microsoft Surface Laptop 4/5',
    '\uD83C\uDF0D Microsoft Surface Pro 7/8/9',
    '\uD83C\uDF0D Microsoft Surface Book 3',

    '\uD83C\uDD95 Autre modèle (ajouter)'
  ],

  // ✅ MODÈLES IMPRIMANTES POPULAIRES - \uD83C\uDF0D AFRIQUE FRANCOPHONE (100+)
  modelesImprimantesPopulaires: [
    // ═══════════════════════════════════════════════════════════════
    // \uD83E\uDD47 HP LASERJET (Pro bureautique, le PLUS fiable Afrique)
    // ═══════════════════════════════════════════════════════════════
    '\uD83D\uDDA8️ HP LaserJet Pro M15w', // Compact, économique
    '\uD83D\uDDA8️ HP LaserJet Pro M28w/M29w', // Multifonction petit bureau
    '\uD83D\uDDA8️ HP LaserJet Pro M404/M405', // Standard bureau
    '\uD83D\uDDA8️ HP LaserJet Pro M428/M429', // Multifonction pro
    '\uD83D\uDDA8️ HP LaserJet Pro MFP M227/M230', // Très populaire PME
    '\uD83D\uDDA8️ HP LaserJet Pro MFP M148/M149',
    '\uD83D\uDDA8️ HP LaserJet P1102/P1102w', // Classique, beaucoup d'occasions
    '\uD83D\uDDA8️ HP LaserJet 1020/1018', // Ancien, encore présent
    '\uD83D\uDDA8️ HP LaserJet 1320', // Occasion courant
    '\uD83D\uDDA8️ HP LaserJet 400/401', // Pro moyen
    '\uD83D\uDDA8️ HP LaserJet Enterprise M506', // Grandes entreprises
    '\uD83D\uDDA8️ HP LaserJet Enterprise MFP M528/M527',

    // ═══════════════════════════════════════════════════════════════
    // \uD83E\uDD47 HP DESKJET / OFFICEJET (Jet d'encre grand public)
    // ═══════════════════════════════════════════════════════════════
    '\uD83D\uDDA8️ HP DeskJet 2710/2720/2723', // Budget, maison
    '\uD83D\uDDA8️ HP DeskJet 2130/2135', // Très populaire particuliers
    '\uD83D\uDDA8️ HP DeskJet Ink Advantage 2675/2676',
    '\uD83D\uDDA8️ HP DeskJet 3755/3760', // Compact
    '\uD83D\uDDA8️ HP OfficeJet Pro 8010/8012/8015', // Pro couleur
    '\uD83D\uDDA8️ HP OfficeJet Pro 8020/8025/8028',
    '\uD83D\uDDA8️ HP OfficeJet Pro 9010/9012/9015',
    '\uD83D\uDDA8️ HP Envy 6020/6030', // Grand public premium
    '\uD83D\uDDA8️ HP Envy Photo 7820/7830',

    // ═══════════════════════════════════════════════════════════════
    // \uD83E\uDD48 EPSON ECOTANK (Révolution Afrique - réservoirs rechargeables)
    // ═══════════════════════════════════════════════════════════════
    '\uD83D\uDDA8️ Epson L120', // Iconique Afrique (impression seule)
    '\uD83D\uDDA8️ Epson L220', // Multifonction basique
    '\uD83D\uDDA8️ Epson L360', // Très populaire
    '\uD83D\uDDA8️ Epson L380/L382', // \uD83D\uDD25 BEST-SELLER absolu Cameroun/CI/Sénégal
    '\uD83D\uDDA8️ Epson L3110/L3116', // Nouvelle génération L380
    '\uD83D\uDDA8️ Epson L3150/L3156', // WiFi intégré
    '\uD83D\uDDA8️ Epson L3210/L3250/L3260', // Gamme 2022+
    '\uD83D\uDDA8️ Epson L4150/L4160', // Premium EcoTank
    '\uD83D\uDDA8️ Epson L5190', // Fax intégré
    '\uD83D\uDDA8️ Epson L6160/L6170/L6190', // Pro A4
    '\uD83D\uDDA8️ Epson L1800', // A3 photo (studios photo)
    '\uD83D\uDDA8️ Epson L805/L810', // Photo sans bordure
    '\uD83D\uDDA8️ Epson L850', // Photo multifonction

    // ═══════════════════════════════════════════════════════════════
    // \uD83E\uDD48 EPSON WORKFORCE (Pro bureautique)
    // ═══════════════════════════════════════════════════════════════
    '\uD83D\uDDA8️ Epson WorkForce WF-2010/2510',
    '\uD83D\uDDA8️ Epson WorkForce WF-2630/2650',
    '\uD83D\uDDA8️ Epson WorkForce WF-2850/2860',
    '\uD83D\uDDA8️ Epson WorkForce WF-7710/7720', // A3
    '\uD83D\uDDA8️ Epson WorkForce Pro WF-3720/3730',
    '\uD83D\uDDA8️ Epson WorkForce Pro WF-C5790', // Entreprise

    // ═══════════════════════════════════════════════════════════════
    // \uD83E\uDD49 CANON PIXMA (Grand public, qualité photo)
    // ═══════════════════════════════════════════════════════════════
    '\uD83D\uDDA8️ Canon PIXMA E410', // Budget Afrique
    '\uD83D\uDDA8️ Canon PIXMA E470/E477', // Populaire maison
    '\uD83D\uDDA8️ Canon PIXMA TS3150/TS3350/TS3450', // Grand public
    '\uD83D\uDDA8️ Canon PIXMA TS5150/TS5350',
    '\uD83D\uDDA8️ Canon PIXMA MG2540/MG2550', // Classique
    '\uD83D\uDDA8️ Canon PIXMA MG3640/MG3650',
    '\uD83D\uDDA8️ Canon PIXMA G2010/G2020', // Réservoirs (concurrent Epson)
    '\uD83D\uDDA8️ Canon PIXMA G3010/G3020', // \uD83D\uDD25 Populaire Afrique
    '\uD83D\uDDA8️ Canon PIXMA G4010/G4020', // Fax intégré
    '\uD83D\uDDA8️ Canon PIXMA G5040/G6040', // Pro
    '\uD83D\uDDA8️ Canon PIXMA iP2770', // Occasion très courant
    '\uD83D\uDDA8️ Canon PIXMA Pro-100', // Photo pro

    // ═══════════════════════════════════════════════════════════════
    // \uD83E\uDD49 CANON MAXIFY / imageCLASS (Pro bureautique)
    // ═══════════════════════════════════════════════════════════════
    '\uD83D\uDDA8️ Canon MAXIFY MB2740/MB2750',
    '\uD83D\uDDA8️ Canon MAXIFY MB5440/MB5450', // PME
    '\uD83D\uDDA8️ Canon MAXIFY GX6040/GX7040', // Réservoirs pro
    '\uD83D\uDDA8️ Canon imageCLASS MF232w/MF236n', // Laser multifonction
    '\uD83D\uDDA8️ Canon imageCLASS MF244/MF247',
    '\uD83D\uDDA8️ Canon imageCLASS LBP6030', // Laser compact
    '\uD83D\uDDA8️ Canon imageCLASS LBP2900', // Ancien, occasion courant

    // ═══════════════════════════════════════════════════════════════
    // BROTHER (Fiabilité pro, laser abordable)
    // ═══════════════════════════════════════════════════════════════
    '\uD83D\uDDA8️ Brother DCP-L2520D/L2540DW', // Laser multifonction
    '\uD83D\uDDA8️ Brother DCP-T310/T510W', // Réservoirs
    '\uD83D\uDDA8️ Brother DCP-T710W/T720DW',
    '\uD83D\uDDA8️ Brother HL-L2305/L2315', // Laser simple
    '\uD83D\uDDA8️ Brother HL-L2350DW/L2370DN',
    '\uD83D\uDDA8️ Brother MFC-L2710DW/L2750DW', // Multifonction pro
    '\uD83D\uDDA8️ Brother MFC-T910DW', // Réservoirs A4
    '\uD83D\uDDA8️ Brother MFC-J491DW/J497DW',

    // ═══════════════════════════════════════════════════════════════
    // SAMSUNG / PANTUM (Budget, bon marché Afrique)
    // ═══════════════════════════════════════════════════════════════
    '\uD83D\uDDA8️ Samsung Xpress M2020/M2070', // Laser budget
    '\uD83D\uDDA8️ Samsung Xpress SL-M2026/M2070W',
    '\uD83D\uDDA8️ Pantum P2500/P2502', // Chinois, économique
    '\uD83D\uDDA8️ Pantum P2516', // Populaire PME Afrique
    '\uD83D\uDDA8️ Pantum M6500/M6550', // Multifonction laser
    '\uD83D\uDDA8️ Pantum M6559/M6609',

    // ═══════════════════════════════════════════════════════════════
    // AUTRES MARQUES PRO (bureaux, entreprises)
    // ═══════════════════════════════════════════════════════════════
    '\uD83D\uDDA8️ Kyocera ECOSYS M2040dn',
    '\uD83D\uDDA8️ Kyocera ECOSYS P2040dw',
    '\uD83D\uDDA8️ Ricoh SP C250DN',
    '\uD83D\uDDA8️ Ricoh MP 2555/3055', // Photocopieur pro
    '\uD83D\uDDA8️ Xerox WorkCentre 3025',
    '\uD83D\uDDA8️ Xerox Phaser 3260',
    '\uD83D\uDDA8️ Lexmark MS310/MS410',

    '\uD83C\uDD95 Autre modèle imprimante (ajouter)'
  ],

  // ✅ TYPES DE PANNES (classification intelligente)
  typesPannes: [
    '⚡ Panne logicielle (système)',
    '⚡ Panne hardware (composants)',
    '⚡ Panne mixte (logiciel + hardware)',
    '\uD83D\uDCA7 Dégâts liquides/humidité',
    '\uD83D\uDD25 Surchauffe chronique',
    '\uD83D\uDD0B Problème batterie/alimentation',
    '\uD83D\uDCBB Écran cassé/défectueux',
    '⌨️ Clavier/Touchpad défectueux',
    '\uD83D\uDCF6 Problème réseau/WiFi/Bluetooth',
    '\uD83E\uDDA0 Virus/Malware/Ransomware',
    '\uD83D\uDCBE Disque dur défaillant',
    '\uD83E\uDDE0 Problème RAM',
    '\uD83C\uDFAE Problème carte graphique',
    '\uD83D\uDDA8️ Imprimante ne fonctionne plus',
    '\uD83D\uDDA8️ Bourrage papier récurrent',
    '\uD83D\uDDA8️ Qualité impression dégradée',
    '\uD83D\uDD0A Pas de son',
    '\uD83D\uDCF8 Webcam ne fonctionne pas',
    '\uD83D\uDC22 Ordinateur très lent',
    '❌ Ne s\'allume plus',
    '♻️ Redémarrage en boucle',
    '\uD83D\uDD35 Écran bleu de la mort (BSOD)',
    '\uD83C\uDD95 Autre panne (ajouter)'
  ],

  // ✅ DÉLAIS DE RÉPARATION (important pour clients)
  delaisReparation: [
    '⚡ Réparation Express (30 min - 2h)', // Logiciel simple, nettoyage
    '\uD83D\uDE80 Réparation rapide (même jour)', // Remplacement batterie, RAM, SSD
    '\uD83D\uDCC5 Réparation standard (1-3 jours)', // Réparations courantes
    '⏰ Réparation complexe (3-7 jours)', // Carte mère, micro-soudure
    '\uD83D\uDEE0️ Sur commande pièces (7-15 jours)', // Import pièces détachées
    '\uD83D\uDD0D Diagnostic gratuit (30 min)', // Évaluation panne
    '\uD83C\uDD95 Autre délai (ajouter)'
  ],

  // ✅ GARANTIES OFFERTES (confiance clients)
  garanties: [
    '✅ Garantie 1 mois (pièces et main d\'œuvre)',
    '✅ Garantie 3 mois (pièces et main d\'œuvre)',
    '✅ Garantie 6 mois (pièces et main d\'œuvre)',
    '✅ Garantie 1 an (pièces et main d\'œuvre)',
    '✅ Garantie pièces détachées (selon fabricant)',
    '✅ Garantie main d\'œuvre uniquement',
    '✅ Satisfaction garantie ou argent remboursé',
    '❌ Pas de garantie (réparation à risques)',
    '\uD83C\uDD95 Autre garantie (ajouter)'
  ],

  // ✅ SERVICES ADDITIONNELS
  servicesAdditionnels: [
    '\uD83D\uDE9A Déplacement à domicile/bureau',
    '\uD83D\uDE9A Récupération et livraison',
    '\uD83D\uDCF1 Diagnostic téléphonique gratuit',
    '\uD83D\uDCF1 Support technique à distance',
    '\uD83D\uDCAC Support WhatsApp 24/7',
    '⏰ Intervention urgence (week-end/soir)',
    '\uD83D\uDCBC Contrat maintenance mensuel',
    '\uD83D\uDCBC Support entreprise',
    '\uD83D\uDCDA Formation utilisateur',
    '\uD83D\uDCBE Sauvegarde données avant réparation',
    '\uD83C\uDFAF Devis gratuit',
    '\uD83D\uDCB0 Paiement échelonné accepté',
    '\uD83D\uDCB3 Mobile Money accepté (MTN/Orange)',
    '\uD83C\uDD95 Autre service (ajouter)'
  ],

  // ✅ CERTIFICATIONS & EXPERTISE
  certifications: [
    '\uD83C\uDFC5 Technicien certifié HP',
    '\uD83C\uDFC5 Technicien certifié Dell',
    '\uD83C\uDFC5 Technicien certifié Apple (ACMT)',
    '\uD83C\uDFC5 Technicien certifié Lenovo',
    '\uD83C\uDFC5 Technicien certifié Asus',
    '\uD83C\uDFC5 Certification CompTIA A+',
    '\uD83C\uDFC5 Certification Microsoft (MCP)',
    '\uD83C\uDFC5 Certification Cisco (CCNA)',
    '\uD83C\uDFC5 Formation micro-soudure',
    '\uD83C\uDFC5 Formation récupération données',
    '\uD83C\uDFC5 +5 ans d\'expérience',
    '\uD83C\uDFC5 +10 ans d\'expérience',
    '\uD83C\uDFC5 Diplôme ingénieur informatique',
    '\uD83C\uDFC5 Diplôme technicien supérieur',
    '\uD83C\uDD95 Autre certification (ajouter)'
  ],

  // ✅ ÉQUIPEMENTS & OUTILS DISPONIBLES
  equipementsAtelier: [
    '\uD83D\uDD2C Station de micro-soudure',
    '\uD83D\uDD2C Microscope réparation',
    '\uD83C\uDF21️ Station air chaud (reballing)',
    '⚡ Testeur alimentation',
    '\uD83D\uDCBE Station récupération données',
    '\uD83D\uDD0B Testeur batterie',
    '\uD83D\uDCFA Testeur écran LCD',
    '\uD83E\uDDF0 Outils professionnels (tournevis, pinces)',
    '\uD83E\uDDEA Produits nettoyage professionnels',
    '\uD83D\uDD0C Pièces détachées en stock',
    '\uD83D\uDCBB PC de test/diagnostic',
    '\uD83D\uDDA8️ Pièces imprimantes en stock',
    '\uD83C\uDD95 Autre équipement (ajouter)'
  ],

  // ✅ ZONES D'INTERVENTION - S'adapte automatiquement au pays de l'utilisateur
  zones_intervention: genererZonesIntervention('CM') // Système intelligent africanLocations.ts
};

// ✅ MODALITÉS RÉPARATEUR ÉLECTROMÉNAGER - \uD83C\uDF0D AFRIQUE FRANCOPHONE
// Catégorie spécialisée pour les services de réparation/dépannage d'appareils électroménagers
export const REPARATEUR_ELECTROMENAGER_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE SERVICES DE RÉPARATION (80+) - Classés par fréquence Afrique
  typesReparation: [
    // \uD83D\uDD25 RÉFRIGÉRATEURS & CONGÉLATEURS (très demandé)
    '❄️ Réparation réfrigérateur ne refroidit plus',
    '❄️ Réparation fuite gaz réfrigérant',
    '❄️ Remplacement compresseur frigo',
    '❄️ Réparation thermostat réfrigérateur',
    '❄️ Réparation congélateur ne congèle plus',
    '❄️ Réparation givre excessif (dégivrage)',
    '❄️ Remplacement joint de porte frigo',
    '❄️ Réparation moteur ventilateur frigo',
    '❄️ Réparation éclairage intérieur frigo',
    '❄️ Rechargement gaz réfrigérant (R134a, R600a)',
    '❄️ Diagnostic panne réfrigérateur',

    // \uD83C\uDF73 CUISINIÈRES & FOURS (très courant)
    '\uD83C\uDF73 Réparation cuisinière à gaz (brûleurs)',
    '\uD83C\uDF73 Réparation four électrique ne chauffe plus',
    '\uD83C\uDF73 Réparation four à gaz',
    '\uD83C\uDF73 Remplacement brûleurs cuisinière',
    '\uD83C\uDF73 Réparation allumage piezo cuisinière',
    '\uD83C\uDF73 Réparation thermostat four',
    '\uD83C\uDF73 Réparation porte de four',
    '\uD83C\uDF73 Nettoyage injecteurs gaz',
    '\uD83C\uDF73 Réparation four micro-ondes (combiné)',
    '\uD83C\uDF73 Remplacement résistance four électrique',

    // \uD83E\uDDFA LAVE-LINGE & LAVE-VAISSELLE
    '\uD83E\uDDFA Réparation machine à laver ne vidange plus',
    '\uD83E\uDDFA Réparation lave-linge ne tourne plus',
    '\uD83E\uDDFA Remplacement pompe de vidange lave-linge',
    '\uD83E\uDDFA Réparation tambour lave-linge bloqué',
    '\uD83E\uDDFA Remplacement courroie lave-linge',
    '\uD83E\uDDFA Réparation roulement tambour (bruit)',
    '\uD83E\uDDFA Réparation électrovanne lave-linge',
    '\uD83E\uDDFA Réparation carte électronique lave-linge',
    '\uD83E\uDDFA Remplacement joint de porte lave-linge',
    '\uD83E\uDDFA Réparation lave-linge fuite d\'eau',
    '\uD83E\uDDFA Réparation lave-vaisselle ne lave plus',
    '\uD83E\uDDFA Réparation lave-vaisselle ne sèche plus',

    // \uD83D\uDCA8 SÈCHE-LINGE
    '\uD83D\uDCA8 Réparation sèche-linge ne chauffe plus',
    '\uD83D\uDCA8 Nettoyage condenseur sèche-linge',
    '\uD83D\uDCA8 Remplacement résistance sèche-linge',
    '\uD83D\uDCA8 Réparation thermostat sèche-linge',
    '\uD83D\uDCA8 Réparation tambour sèche-linge',

    // ☕ PETIT ÉLECTROMÉNAGER (très demandé Afrique)
    '☕ Réparation machine à café expresso',
    '☕ Détartrage machine à café',
    '☕ Réparation cafetière ne chauffe plus',
    '☕ Réparation machine à café capsules (Nespresso)',
    '☕ Réparation percolateur/cafetière électrique',

    // \uD83D\uDD25 MICRO-ONDES
    '\uD83D\uDD25 Réparation micro-ondes ne chauffe plus',
    '\uD83D\uDD25 Remplacement magnétron micro-ondes',
    '\uD83D\uDD25 Réparation plateau tournant micro-ondes',
    '\uD83D\uDD25 Réparation minuterie micro-ondes',
    '\uD83D\uDD25 Réparation porte micro-ondes',

    // \uD83C\uDF00 MIXEURS, BLENDERS, ROBOTS
    '\uD83C\uDF00 Réparation mixeur/blender moteur grillé',
    '\uD83C\uDF00 Remplacement lames mixeur',
    '\uD83C\uDF00 Réparation robot culinaire',
    '\uD83C\uDF00 Réparation batteur électrique',
    '\uD83C\uDF00 Réparation hachoir à viande',

    // \uD83D\uDD0C FER À REPASSER & PRESSING
    '\uD83D\uDD0C Réparation fer à repasser ne chauffe plus',
    '\uD83D\uDD0C Détartrage fer vapeur',
    '\uD83D\uDD0C Réparation centrale vapeur',
    '\uD83D\uDD0C Remplacement semelle fer à repasser',
    '\uD83D\uDD0C Réparation thermostat fer',

    // \uD83C\uDF2C️ VENTILATEURS & CLIMATISEURS
    '\uD83C\uDF2C️ Réparation ventilateur ne tourne plus',
    '\uD83C\uDF2C️ Réparation climatiseur ne refroidit plus',
    '\uD83C\uDF2C️ Rechargement gaz climatiseur',
    '\uD83C\uDF2C️ Nettoyage filtre climatiseur',
    '\uD83C\uDF2C️ Réparation compresseur climatiseur',
    '\uD83C\uDF2C️ Réparation télécommande climatiseur',
    '\uD83C\uDF2C️ Installation climatiseur split',

    // \uD83D\uDD0A AUTRES APPAREILS
    '\uD83D\uDD0A Réparation bouilloire électrique',
    '\uD83D\uDD0A Réparation grille-pain',
    '\uD83D\uDD0A Réparation presse-agrumes',
    '\uD83D\uDD0A Réparation yaourtière',
    '\uD83D\uDD0A Réparation multicuiseur (rice cooker)',
    '\uD83D\uDD0A Réparation friteuse électrique',
    '\uD83D\uDD0A Réparation gaufrier/crêpière',

    // ⚡ SERVICES GÉNÉRAUX
    '⚡ Diagnostic panne électroménager',
    '⚡ Maintenance préventive',
    '⚡ Nettoyage professionnel appareil',
    '⚡ Installation appareil',
    '⚡ Conseil achat pièces détachées',

    '\uD83C\uDD95 Autre réparation (ajouter)'
  ],

  // ✅ MARQUES ÉLECTROMÉNAGER SUPPORTÉES (60+) - Focus Afrique francophone
  marquesElectromenager: [
    // \uD83E\uDD47 TOP MARQUES AFRIQUE (expertise OBLIGATOIRE - 80% du marché)
    '\uD83D\uDD25 Binatone', // #1 petit électroménager Afrique
    '\uD83D\uDD25 Sokany', // #2 petit électroménager (mixeurs, blenders)
    '\uD83D\uDD25 Nexus', // #3 frigos, cuisinières Afrique
    '\uD83D\uDD25 Scanfrost', // #4 frigos Nigeria/Afrique de l'Ouest
    '\uD83D\uDD25 Hisense', // #5 frigos, clims Afrique
    '\uD83D\uDD25 Midea', // #6 frigos, clims, lave-linge
    '\uD83D\uDD25 Haier', // #7 frigos économiques Afrique
    '\uD83D\uDD25 Restpoint', // #8 électroménager Nigeria/Cameroun

    // \uD83E\uDD48 MARQUES ASIATIQUES TRÈS POPULAIRES
    'LG', // Frigos, lave-linge, clims (populaire)
    'Samsung', // Frigos, lave-linge premium
    'TCL', // Frigos, clims économiques
    'Panasonic', // Micro-ondes, petit électroménager
    'Sharp', // Micro-ondes, frigos
    'Toshiba', // Micro-ondes, frigos
    'Hitachi', // Frigos haut de gamme
    'Daewoo', // Micro-ondes, petit électroménager
    'Sanyo', // Frigos, micro-ondes
    'Nasco', // Ghana, présent Afrique de l'Ouest

    // \uD83D\uDC8E MARQUES PREMIUM (minoritaires mais présentes)
    'Whirlpool', // Lave-linge, frigos
    'Bosch', // Lave-linge, lave-vaisselle premium
    'Siemens', // Lave-linge, four premium
    'Electrolux', // Lave-linge, frigos
    'Miele', // Très haut de gamme (expatriés)
    'AEG', // Lave-linge, four

    // \uD83C\uDF0D MARQUES EUROPÉENNES/OCCIDENTALES
    'Beko', // Frigos, lave-linge budget
    'Hotpoint', // Lave-linge, frigos
    'Indesit', // Lave-linge, lave-vaisselle
    'Candy', // Lave-linge économique
    'Ariston', // Lave-linge, chauffe-eau

    // ☕ SPÉCIALISTES CAFÉ
    'Nespresso', // Machines à capsules
    'Philips', // Cafetières, mixeurs
    'Krups', // Machines à café
    'Delonghi', // Machines expresso
    'Moulinex', // Petit électroménager français
    'Tefal', // Petit électroménager (multicuiseurs)
    'SEB', // Petit électroménager français

    // \uD83C\uDF2C️ SPÉCIALISTES CLIMATISATION
    'Daikin', // Climatisation pro
    'Mitsubishi Electric', // Clims split
    'Gree', // Clims économiques Afrique
    'Carrier', // Climatisation pro
    'York', // Climatisation
    'Haier', // Clims économiques

    // \uD83D\uDD27 AUTRES MARQUES PRÉSENTES
    'Kenwood', // Mixeurs, robots cuisine
    'Braun', // Petit électroménager
    'Black & Decker', // Petit électroménager
    'Russell Hobbs', // Bouilloires, grille-pain
    'Oster', // Mixeurs Amérique/Afrique
    'Thermador', // Fours premium (rare)
    'Frigidaire', // Frigos Amérique
    'Maytag', // Lave-linge Amérique
    'KitchenAid', // Robots cuisine premium

    '\uD83C\uDD95 Autre marque (ajouter)'
  ],

  // ✅ TYPES D'APPAREILS (classification intelligente)
  typesAppareils: [
    // GROS ÉLECTROMÉNAGER (froid)
    'Réfrigérateur 1 porte',
    'Réfrigérateur 2 portes',
    'Réfrigérateur américain (side-by-side)',
    'Congélateur coffre',
    'Congélateur armoire',
    'Combiné frigo-congélateur',

    // GROS ÉLECTROMÉNAGER (cuisson)
    'Cuisinière à gaz (4 feux)',
    'Cuisinière à gaz (5-6 feux)',
    'Cuisinière mixte (gaz + électrique)',
    'Four électrique encastrable',
    'Four à gaz',
    'Plaque de cuisson gaz',
    'Plaque de cuisson électrique',
    'Plaque de cuisson vitrocéramique',
    'Plaque induction',
    'Micro-ondes',
    'Micro-ondes combiné (grill)',

    // GROS ÉLECTROMÉNAGER (lavage)
    'Lave-linge top (chargement dessus)',
    'Lave-linge frontal (hublot)',
    'Lave-linge séchant (2-en-1)',
    'Sèche-linge à condensation',
    'Sèche-linge à évacuation',
    'Lave-vaisselle',

    // PETIT ÉLECTROMÉNAGER (café/cuisine)
    'Machine à café expresso',
    'Machine à café capsules (Nespresso, Dolce Gusto)',
    'Cafetière électrique/percolateur',
    'Mixeur/Blender',
    'Robot culinaire multifonction',
    'Batteur/Pétrin',
    'Hachoir à viande',
    'Presse-agrumes',
    'Centrifugeuse',
    'Bouilloire électrique',
    'Grille-pain',
    'Gaufrier/Crêpière',
    'Friteuse électrique',
    'Multicuiseur/Rice cooker',
    'Yaourtière',

    // PETIT ÉLECTROMÉNAGER (entretien)
    'Fer à repasser',
    'Centrale vapeur',
    'Aspirateur',
    'Aspirateur balai',

    // CLIMATISATION & VENTILATION
    'Climatiseur split',
    'Climatiseur mobile',
    'Climatiseur window',
    'Ventilateur sur pied',
    'Ventilateur de plafond',
    'Ventilateur de table',
    'Brasseur d\'air',

    '\uD83C\uDD95 Autre appareil (ajouter)'
  ],

  // ✅ TYPES DE PANNES (classification par symptôme)
  typesPannes: [
    '❄️ Ne refroidit plus / Ne congèle plus',
    '\uD83D\uDD25 Ne chauffe plus',
    '⚡ Ne s\'allume plus / Pas de courant',
    '\uD83D\uDCA7 Fuite d\'eau',
    '\uD83D\uDCA8 Fuite de gaz (réfrigérant ou gaz cuisine)',
    '\uD83D\uDD0A Bruit anormal / Vibrations',
    '⏰ Minuterie/Programmateur défectueux',
    '\uD83D\uDEAB Tambour bloqué / Ne tourne plus',
    '\uD83C\uDF0A Ne vidange plus / Eau stagnante',
    '\uD83E\uDDCA Givre excessif',
    '\uD83D\uDD0C Court-circuit / Disjoncteur saute',
    '\uD83D\uDCA1 Éclairage ne fonctionne plus',
    '\uD83D\uDEAA Porte ne ferme plus correctement',
    '\uD83C\uDF21️ Température instable',
    '\uD83D\uDD27 Problème mécanique (courroie, roulement)',
    '\uD83D\uDCBB Problème électronique (carte)',
    '\uD83C\uDD95 Autre panne (ajouter)'
  ],

  // ✅ DÉLAIS DE RÉPARATION
  delaisReparation: [
    '⚡ Intervention express (même jour)',
    '\uD83D\uDE80 Intervention rapide (24-48h)',
    '\uD83D\uDCC5 Intervention standard (2-5 jours)',
    '\uD83D\uDEE0️ Sur commande pièces (5-10 jours)',
    '\uD83D\uDD0D Diagnostic gratuit (30-60 min)',
    '⏰ Urgence disponible (week-end/soir)',
    '\uD83C\uDD95 Autre délai (ajouter)'
  ],

  // ✅ GARANTIES OFFERTES
  garanties: [
    '✅ Garantie 1 an (pièces et main d\'œuvre)',
    '✅ Garantie 6 mois (pièces et main d\'œuvre)',
    '✅ Garantie 3 mois (pièces et main d\'œuvre)',
    '✅ Garantie 1 mois (pièces et main d\'œuvre)',
    '✅ Garantie pièces uniquement (selon fabricant)',
    '✅ Garantie main d\'œuvre uniquement',
    '✅ Satisfaction garantie ou remboursé',
    '❌ Pas de garantie (réparation à risques)',
    '\uD83C\uDD95 Autre garantie (ajouter)'
  ],

  // ✅ SERVICES ADDITIONNELS
  servicesAdditionnels: [
    '\uD83D\uDE9A Déplacement à domicile gratuit',
    '\uD83D\uDE9A Déplacement à domicile (zone)',
    '\uD83D\uDE9A Enlèvement et retour appareil',
    '\uD83D\uDCF1 Diagnostic téléphonique gratuit',
    '\uD83D\uDCF1 Devis gratuit',
    '⏰ Intervention urgence 24/7',
    '⏰ Disponible week-end et jours fériés',
    '\uD83D\uDCBC Contrat maintenance annuel',
    '\uD83D\uDCBC Support entreprise/hôtel/restaurant',
    '\uD83D\uDCB3 Paiement Mobile Money (MTN/Orange)',
    '\uD83D\uDCB0 Paiement échelonné accepté',
    '\uD83D\uDD27 Installation incluse',
    '\uD83D\uDD27 Conseil technique gratuit',
    '\uD83D\uDED2 Vente pièces détachées',
    '♻️ Reprise ancien appareil',
    '\uD83D\uDCDA Formation utilisateur',
    '\uD83C\uDD95 Autre service (ajouter)'
  ],

  // ✅ CERTIFICATIONS & EXPERTISE
  certifications: [
    '\uD83C\uDFC5 Technicien frigoriste certifié',
    '\uD83C\uDFC5 Certification gaz (cuisinières)',
    '\uD83C\uDFC5 Agrément constructeur (LG, Samsung, etc.)',
    '\uD83C\uDFC5 Formation technique fabricant',
    '\uD83C\uDF93 Diplôme électrotechnique',
    '\uD83C\uDF93 Diplôme froid et climatisation',
    '\uD83C\uDFC6 +10 ans d\'expérience',
    '\uD83C\uDFC6 +5 ans d\'expérience',
    '\uD83C\uDFC6 +3 ans d\'expérience',
    '\uD83D\uDD27 Spécialiste froid (frigos, clims)',
    '\uD83D\uDD27 Spécialiste lave-linge',
    '\uD83D\uDD27 Spécialiste cuisinières gaz',
    '\uD83C\uDFEA Atelier professionnel équipé',
    '\uD83D\uDC65 Équipe de techniciens',
    '\uD83C\uDD95 Autre certification (ajouter)'
  ],

  // ✅ ÉQUIPEMENTS & OUTILS DISPONIBLES
  equipementsAtelier: [
    '\uD83C\uDF21️ Manifold (mesure pression gaz)',
    '\uD83D\uDCA8 Pompe à vide frigorifique',
    '\uD83D\uDD27 Poste à souder (cuivre/aluminium)',
    '⚡ Multimètre professionnel',
    '\uD83D\uDD0C Pince ampèremétrique',
    '\uD83E\uDDCA Station de récupération gaz',
    '\uD83D\uDEE0️ Outillage complet électroménager',
    '\uD83D\uDCBE Stock pièces détachées courantes',
    '\uD83D\uDD29 Compresseurs de rechange',
    '⚙️ Thermostats de rechange',
    '\uD83D\uDD0C Résistances de rechange',
    '\uD83D\uDCA7 Pompes de vidange en stock',
    '\uD83D\uDE97 Camionnette atelier mobile',
    '\uD83C\uDD95 Autre équipement (ajouter)'
  ],

  // ✅ ZONES D'INTERVENTION - S'adapte automatiquement au pays de l'utilisateur
  zones_intervention: genererZonesIntervention('CM') // Système intelligent africanLocations.ts
};

// ✅ MODALITÉS ORDINATEURS - \uD83C\uDF0D CONTEXTE AFRIQUE FRANCOPHONE (Cameroun focus)
export const ORDINATEURS_MODALITIES: ModalityCategory = {
  // ✅ Types d'ordinateurs (réorganisés par popularité Afrique)
  types: [
    // \uD83D\uDD25 PLUS POPULAIRES EN AFRIQUE
    'PC Portable', // Le plus demandé (mobilité, coupures électriques)
    'PC de bureau', // Bureaux, cyber-cafés, entreprises
    'Laptop Gaming', // Jeunes, gaming, montage vidéo
    'Ultrabook', // Professionnels, expatriés

    // \uD83D\uDC8E APPLE (prestige, expatriés, professionnels)
    'MacBook Air', // Le plus accessible d'Apple
    'MacBook Pro',
    'iMac',
    'Mac Mini',

    // \uD83D\uDCF1 TABLETTES & HYBRIDES
    'iPad', // Étudiants, professions libérales
    'Tablette Android',
    'Surface Pro', // 2-en-1 populaire

    // \uD83C\uDFE2 PROFESSIONNELS & SPÉCIALISÉS
    'Workstation', // Designers, architectes, ingénieurs
    'Chromebook', // Éducation, économique
    'All-in-One', // Espaces réduits
    'Mini PC', // Bureaux compacts
    'Serveur', // Entreprises
    'PC Assemblé sur mesure', // Techniciens locaux
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Marques (TOP vendues en Afrique francophone)
  marques: [
    // \uD83E\uDD47 TOP 3 INCONTOURNABLES (80% du marché Cameroun)
    'HP', // #1 en Afrique (rapport qualité-prix)
    'Dell', // #2 (bureaux, entreprises)
    'Lenovo', // #3 (ThinkPad pro, IdeaPad grand public)

    // \uD83E\uDD48 TRÈS POPULAIRES (gaming, budget)
    'Asus', // Gaming, ROG, VivoBook
    'Acer', // Budget-friendly, Aspire
    'Toshiba', // Ancienne popularité, occasion

    // \uD83D\uDC8E PREMIUM & APPLE
    'Apple', // MacBook, iPad (expatriés, créatifs)
    'Microsoft', // Surface (professionnels)

    // \uD83C\uDFAE GAMING SPÉCIALISÉ
    'MSI', // Gaming haut de gamme
    'Razer', // Gaming premium
    'Alienware', // Gaming ultra-premium

    // \uD83C\uDF0D MARQUES ASIATIQUES (bon rapport qualité-prix)
    'Samsung', // Galaxy Tab, notebooks
    'Huawei', // MateBook (bon prix)
    'LG', // Gram (ultrabooks)

    // \uD83D\uDD27 AUTRES & LOCAL
    'Gigabyte', // Gaming, composants
    'Sony', // VAIO (occasion)
    'Compaq', // Ancien HP (occasion)
    'Fujitsu', // Professionnel
    'PC Assemblé local', // \uD83C\uDDE8\uD83C\uDDF2 Techniciens Cameroun (Douala, Yaoundé)
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Processeurs (du budget au premium)
  processeurs: [
    // \uD83D\uDCB0 ENTRÉE DE GAMME (bureautique, étudiants)
    'Intel Celeron', // Le plus économique
    'Intel Pentium',
    'AMD Athlon',
    'AMD A4 / A6',

    // \uD83D\uDD25 MILIEU DE GAMME (80% des ventes Afrique)
    'Intel Core i3', // Bureautique, navigation
    'Intel Core i5', // LE PLUS VENDU (polyvalent)
    'AMD Ryzen 3',
    'AMD Ryzen 5', // Excellent rapport qualité-prix

    // \uD83D\uDC8E HAUT DE GAMME (professionnels, gaming)
    'Intel Core i7', // Développement, design, gaming
    'AMD Ryzen 7',
    'Intel Core i9', // Workstations, montage vidéo pro
    'AMD Ryzen 9',

    // \uD83C\uDF4E APPLE SILICON (révolution performance/efficacité)
    'Apple M1', // MacBook Air/Pro 2020-2021
    'Apple M2', // MacBook Air/Pro 2022-2023
    'Apple M2 Pro',
    'Apple M2 Max',
    'Apple M3', // 2023-2024
    'Apple M3 Pro',
    'Apple M3 Max',

    // \uD83C\uDD95 NOUVEAUX INTEL
    'Intel Core Ultra 5',
    'Intel Core Ultra 7',
    'Intel Core Ultra 9',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Mémoire RAM (réaliste pour Afrique)
  ram: [
    '2GB', // \uD83C\uDDE8\uD83C\uDDF2 Encore présent en Afrique (très ancien, cyber-cafés)
    '4GB', // Bureautique basique
    '8GB', // \uD83D\uDD25 LE PLUS COURANT (bureautique, navigation, études)
    '16GB', // \uD83D\uDC8E PRO (développement, design, gaming)
    '32GB', // Workstation, montage vidéo pro
    '64GB', // Rare, très haut de gamme
    '128GB', // Serveurs, workstations extrêmes
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Stockage (SSD vs HDD crucial en Afrique)
  stockage: [
    // \uD83D\uDCBE HDD (encore très présent, pas cher)
    '250GB HDD',
    '320GB HDD', // Ancien, occasion
    '500GB HDD', // Courant en occasion
    '1TB HDD', // \uD83D\uDD25 HDD le plus vendu
    '2TB HDD',

    // ⚡ SSD (rapidité, résistance aux coupures électriques)
    '128GB SSD', // Chromebook, budget
    '256GB SSD', // \uD83D\uDD25 Entrée de gamme moderne
    '512GB SSD', // \uD83D\uDC8E LE SWEET SPOT (pro, étudiants)
    '1TB SSD', // Haut de gamme
    '2TB SSD', // Premium
    '4TB SSD', // Très rare

    // \uD83C\uDFAF DUAL STORAGE (populaire Cameroun)
    '256GB SSD + 1TB HDD', // \uD83C\uDDE8\uD83C\uDDF2 Combo intelligent (vitesse + stockage)
    '512GB SSD + 1TB HDD',
    'Dual Storage (autre config)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Cartes graphiques
  cartesGraphiques: [
    // \uD83D\uDD0C INTÉGRÉES (90% des laptops Afrique)
    'Intégrée Intel HD', // Ancien (2010-2018)
    'Intel UHD Graphics', // Moderne (2018+)
    'Intel Iris Xe', // Haut de gamme intégré
    'AMD Radeon Vega', // Ryzen intégré
    'Apple GPU intégrée', // M1/M2/M3

    // \uD83C\uDFAE NVIDIA DÉDIÉES (gaming, design)
    'NVIDIA GeForce MX150', // Entrée de gamme dédié
    'NVIDIA GeForce MX250',
    'NVIDIA GeForce MX450',
    'NVIDIA GeForce GTX 1650', // \uD83D\uDD25 Gaming budget
    'NVIDIA GeForce GTX 1660 Ti',
    'NVIDIA GeForce RTX 2060',
    'NVIDIA GeForce RTX 3050', // Moderne milieu de gamme
    'NVIDIA GeForce RTX 3060',
    'NVIDIA GeForce RTX 3070',
    'NVIDIA GeForce RTX 4050',
    'NVIDIA GeForce RTX 4060', // 2023+
    'NVIDIA GeForce RTX 4070',
    'NVIDIA GeForce RTX 4080', // Rare en Afrique
    'NVIDIA GeForce RTX 4090', // Très rare

    // \uD83D\uDD34 AMD DÉDIÉES
    'AMD Radeon RX 6600M',
    'AMD Radeon RX 6700M',
    'AMD Radeon RX 7600M', // 2023+
    'AMD Radeon RX 7700M',

    // ⚙️ AUTRES
    'Carte graphique dédiée (autre)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Systèmes d'exploitation (réalité Afrique)
  systemesExploitation: [
    // \uD83E\uDE9F WINDOWS (95% du marché Afrique)
    'Windows 11 Pro', // Moderne
    'Windows 11 Home',
    'Windows 10 Pro', // \uD83D\uDD25 LE PLUS COURANT (stable, compatible)
    'Windows 10 Home',
    'Windows 8.1', // Encore présent (occasion)
    'Windows 7', // \uD83C\uDDE8\uD83C\uDDF2 Encore utilisé (anciens PC, compatibilité)

    // \uD83C\uDF4E APPLE (minoritaire, prestige)
    'macOS Sonoma', // 2023+
    'macOS Ventura', // 2022
    'macOS Monterey', // 2021
    'macOS Big Sur', // 2020

    // \uD83D\uDC27 LINUX (techniciens, développeurs, universités)
    'Linux Ubuntu', // Le plus populaire
    'Linux Mint',
    'Linux Fedora',
    'Kali Linux', // Cybersécurité

    // \uD83D\uDCE6 AUTRES
    'ChromeOS', // Chromebook (écoles)
    'FreeDOS', // PC vendus sans OS (piratage fréquent)
    'Sans OS', // Assemblés locaux
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ États (marché occasion ÉNORME en Afrique)
  etats: [
    // \uD83C\uDD95 NEUF (minoritaire, cher)
    'Neuf scellé sous garantie internationale', // Premium
    'Neuf sous garantie locale', // Importateurs Douala/Yaoundé
    'Neuf sans garantie', // Import Dubaï/Chine

    // ♻️ RECONDITIONNÉ (tendance forte)
    'Reconditionné grade A+ (comme neuf)', // Ex-Europe
    'Reconditionné grade A',
    'Reconditionné grade B',

    // \uD83D\uDCBC OCCASION (80% du marché Cameroun)
    'Occasion - Excellent état', // \uD83D\uDD25 Bien entretenu, facture
    'Occasion - Très bon état',
    'Occasion - Bon état', // \uD83D\uDD25 LE PLUS COURANT
    'Occasion - État correct', // Usure visible, fonctionne bien
    'Occasion - État moyen', // Défauts cosmétiques

    // \uD83D\uDD27 AUTRES
    'Pour pièces détachées', // Réparation
    'À réparer', // Panne connue
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Tailles d'écran (pratique Afrique)
  taillesEcran: [
    // \uD83D\uDCBC PORTABLES
    '11.6"', // Chromebook, ultraportable
    '13.3"', // Ultrabook, MacBook Air
    '14"', // Nouveau standard 2023+
    '15.6"', // \uD83D\uDD25 LE PLUS VENDU (polyvalent)
    '17.3"', // Gaming, workstation portable

    // \uD83D\uDDA5️ BUREAUX / ÉCRANS EXTERNES
    '19"', // Ancien
    '21.5"', // Standard budget
    '23.8"', // Moderne
    '24"', // \uD83D\uDD25 STANDARD BUREAU
    '27"', // Premium, designers
    '32"', // Rare, professionnels
    '34"', // Ultrawide, très rare

    // \uD83D\uDCF1 MINI
    '10.1"', // Tablette
    'Sans écran (tour)', // PC de bureau
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types d'écran
  typesEcran: [
    // \uD83D\uDD06 STANDARDS (laptops budget/moyen)
    'TN', // Ancien, angles de vision limités
    'LED', // Standard
    'LCD',

    // \uD83D\uDC8E QUALITÉ (milieu/haut de gamme)
    'IPS Full HD', // \uD83D\uDD25 LE PLUS COURANT (angles larges, couleurs)
    'IPS', // Générique
    'VA', // Contraste élevé

    // ✨ PREMIUM
    'OLED', // Contraste infini, Apple/Samsung
    'Retina', // Apple
    'QHD (2560x1440)', // Designers
    '4K UHD (3840x2160)', // Rare, premium
    '5K', // iMac

    // \uD83C\uDFAF FONCTIONNALITÉS
    'Tactile', // Tablettes, 2-en-1
    'Antireflet', // Travail extérieur
    'Mat',
    'Brillant',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Accessoires (CRITIQUES en Afrique - coupures électriques!)
  accessoires: [
    // ⚡ ÉLECTRICITÉ (PRIORITÉ #1 en Afrique)
    '\uD83D\uDD0B Onduleur/UPS', // \uD83C\uDDE8\uD83C\uDDF2 INDISPENSABLE (coupures ENEO)
    '\uD83D\uDD0C Stabilisateur de tension',
    '⚡ Batterie externe laptop',

    // \uD83D\uDD0C ALIMENTATION
    'Chargeur original',
    'Chargeur compatible',
    'Câble d\'alimentation',
    'Adaptateur secteur',

    // \uD83D\uDDB1️ PÉRIPHÉRIQUES
    'Souris filaire',
    'Souris sans fil',
    'Clavier externe',
    'Clavier + souris combo',
    'Pavé numérique',

    // \uD83D\uDCBC TRANSPORT & PROTECTION
    'Sac de transport rembourré',
    'Housse de protection',
    'Sacoche professionnelle',

    // \uD83D\uDCF7 AUDIO/VIDÉO
    'Webcam HD',
    'Casque audio',
    'Écouteurs',
    'Micro externe',
    'Enceintes USB',

    // \uD83D\uDD17 CONNECTIVITÉ
    'Hub USB (4+ ports)', // Manque de ports fréquent
    'Adaptateur USB-C vers HDMI',
    'Adaptateur USB-C vers USB-A',
    'Câble HDMI',
    'Câble VGA', // Encore utilisé (projecteurs anciens)
    'Dock station',

    // \uD83D\uDCBE STOCKAGE
    'Disque dur externe 1TB',
    'Disque dur externe 2TB',
    'SSD externe',
    'Clé USB 32GB+',

    // \uD83D\uDDA5️ AFFICHAGE
    'Support/Stand réglable',
    'Refroidisseur laptop (ventilateur)',
    'Écran externe',

    // \uD83E\uDDF9 ENTRETIEN
    'Kit de nettoyage',
    'Protection clavier',
    'Film protecteur écran',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Usages (contexte Cameroun)
  usages: [
    // \uD83D\uDCCA BUREAUTIQUE & PROFESSIONNEL (majoritaire)
    'Bureautique', // \uD83D\uDD25 Word, Excel, navigation (90% des besoins)
    'Télétravail', // Post-COVID, freelance
    'Comptabilité/Gestion', // Sage, EBP
    'Administration',

    // \uD83C\uDF93 ÉDUCATION
    'Étudiant', // \uD83D\uDD25 Université, mémoires, recherche
    'Enseignement', // Professeurs
    'Recherche académique',

    // \uD83C\uDFA8 CRÉATION & DESIGN
    'Design graphique', // Photoshop, Illustrator
    'Montage vidéo', // Mariage, événements
    'Montage photo',
    'Architecture/CAO', // AutoCAD, ArchiCAD, Revit
    'Ingénierie/DAO',

    // \uD83D\uDCBB TECHNIQUE
    'Développement web', // Programmeurs
    'Développement logiciel',
    'Data Science',
    'Cybersécurité',

    // \uD83C\uDFAE GAMING & DIVERTISSEMENT
    'Gaming', // FIFA, GTA, Call of Duty, Fortnite
    'Streaming Twitch/YouTube',
    'Musique/MAO', // Production musicale, Afrobeat

    // \uD83C\uDFE2 SPÉCIALISÉ
    'Cyber-café', // \uD83C\uDDE8\uD83C\uDDF2 Très courant Cameroun
    'Point de vente/Caisse',
    'Serveur/NAS',

    // \uD83C\uDFAF GÉNÉRAL
    'Polyvalent', // Tout usage
    'Navigation internet basique',
    'Multimédia (films, musique)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Logiciels inclus (réalité Afrique)
  logiciels: [
    // \uD83D\uDCE6 SUITES BUREAUTIQUES
    'Microsoft Office 2021',
    'Microsoft Office 2019',
    'Microsoft Office 2016', // Encore courant
    'Office 365 (abonnement)',
    'LibreOffice', // Gratuit, populaire
    'WPS Office',

    // \uD83C\uDF4E APPLE
    'Suite iWork (Pages, Numbers, Keynote)',
    'Final Cut Pro', // Montage vidéo
    'Logic Pro', // Musique

    // \uD83C\uDFA8 ADOBE (version ou piratage...)
    'Adobe Photoshop',
    'Adobe Illustrator',
    'Adobe Premiere Pro',
    'Adobe After Effects',
    'Adobe Creative Cloud',

    // \uD83C\uDFD7️ CAO/DAO
    'AutoCAD', // Architecture, ingénierie
    'ArchiCAD',
    'SketchUp',
    'Revit',

    // \uD83D\uDD12 SÉCURITÉ
    'Antivirus Kaspersky',
    'Antivirus Avast',
    'Antivirus AVG',
    'Windows Defender (intégré)',

    // \uD83D\uDCBB DÉVELOPPEMENT
    'Visual Studio Code',
    'Python',
    'MySQL',
    'XAMPP',

    // \uD83C\uDFAE GAMING
    'Steam',
    'Epic Games',

    // \uD83D\uDCCA COMPTABILITÉ (Cameroun)
    'Sage Comptabilité', // \uD83C\uDDE8\uD83C\uDDF2 Très populaire entreprises
    'EBP Gestion',
    'Ciel Comptabilité',

    // \uD83C\uDFAF AUTRES
    'Pack logiciels professionnels',
    'Logiciels préinstallés par vendeur',
    'Aucun logiciel',
    'Windows seul',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Claviers (langues et rétroéclairage)
  claviers: [
    // \uD83C\uDF0D DISPOSITIONS (CRITIQUE pour Afrique francophone)
    'AZERTY français', // \uD83D\uDD25 INDISPENSABLE Cameroun (français)
    'QWERTY US',
    'QWERTY UK',
    'QWERTZ allemand',

    // ✨ FONCTIONNALITÉS
    'Rétroéclairé RGB', // Gaming
    'Rétroéclairé blanc', // Premium, travail nuit
    'Rétroéclairé (couleur unique)',
    'Non rétroéclairé', // Standard

    // \uD83C\uDFAE TYPES
    'Mécanique', // Gaming, durabilité
    'Chiclet', // Macbook, ultrabook
    'Membrane', // Standard économique
    'Silencieux',

    // \uD83C\uDFAF CARACTÉRISTIQUES
    'Pavé numérique intégré', // 15.6" et +
    'Sans pavé numérique', // 13-14"
    'Multimédia (touches médias)',
    'Résistant à l\'eau',

    // \uD83D\uDD17 CONNECTIVITÉ
    'Sans fil Bluetooth',
    'Sans fil 2.4GHz',
    'Filaire USB',

    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS MOBILIER
// ✅ MODALITÉS MOBILIER - REFONTE COMPLÈTE CONTEXTE CAMEROUN
export const MOBILIER_MODALITIES: ModalityCategory = {
  // ✅ NOUVEAU: Noms de meubles populaires (60+)
  noms_produits: [
    // Salon
    'Canapé 3 places', 'Canapé 2 places', 'Canapé d\'angle', 'Fauteuil simple', 'Fauteuil relax',
    'Table basse rectangulaire', 'Table basse ronde', 'Table basse ovale',
    'Meuble TV moderne', 'Meuble TV classique', 'Bibliothèque murale',
    // Chambre à coucher
    'Lit 1 place (90x190)', 'Lit 2 places (140x190)', 'Lit King Size (180x200)', 'Lit Queen Size (160x200)',
    'Matelas mousse', 'Matelas ressorts', 'Matelas orthopédique',
    'Armoire 2 portes', 'Armoire 3 portes', 'Armoire d\'angle', 'Penderie',
    'Commode 3 tiroirs', 'Commode 4 tiroirs', 'Commode 5 tiroirs',
    'Table de chevet', 'Coiffeuse avec miroir',
    // Salle à manger
    'Table à manger 4 places', 'Table à manger 6 places', 'Table à manger 8 places', 'Table à manger extensible',
    'Chaise salle à manger bois', 'Chaise salle à manger rembourrée', 'Chaise pliante',
    'Buffet bas', 'Buffet haut', 'Vaisselier',
    // Bureau / Travail
    'Bureau simple', 'Bureau d\'angle', 'Bureau informatique', 'Bureau direction',
    'Chaise de bureau ergonomique', 'Fauteuil direction', 'Fauteuil gaming',
    'Étagère murale', 'Bibliothèque 3 niveaux', 'Bibliothèque 5 niveaux',
    'Armoire de rangement bureau',
    // Rangement
    'Étagère métallique', 'Étagère en bois', 'Meuble à chaussures', 'Porte-manteau',
    'Coffre de rangement', 'Panier de rangement',
    // Cuisine
    'Placard mural cuisine', 'Placard bas cuisine', 'Îlot central', 'Desserte roulante',
    'Table de cuisine 2 places', 'Table de cuisine 4 places', 'Tabouret de bar',
    // Jardin / Extérieur
    'Salon de jardin 4 places', 'Salon de jardin 6 places', 'Chaise longue', 'Parasol',
    'Table pliante extérieur', 'Banc de jardin',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types de mobilier (15+)
  types: [
    'Canapé', 'Fauteuil', 'Chaise', 'Tabouret',
    'Table', 'Table basse', 'Table de chevet', 'Bureau',
    'Lit', 'Matelas', 'Sommier',
    'Armoire', 'Penderie', 'Commode', 'Étagère', 'Bibliothèque',
    'Meuble TV', 'Buffet', 'Vaisselier',
    'Placard', 'Meuble de rangement', 'Coffre',
    'Coiffeuse', 'Console', 'Paravent',
    'Banc', 'Pouf', 'Repose-pieds',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Catégories par pièce/usage (10+)
  categories: [
    'Salon', 'Chambre à coucher', 'Salle à manger', 'Bureau/Travail',
    'Cuisine', 'Salle de bain', 'Entrée/Couloir', 'Rangement',
    'Enfant/Bébé', 'Jardin/Extérieur', 'Commercial/Professionnel',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Matériaux (20+) - ENRICHI avec essences locales
  materiaux: [
    // Bois
    'Bois massif', 'Bois aggloméré', 'Contreplaqué', 'MDF',
    'Acajou', 'Teck', 'Iroko', 'Wengé', 'Sapelli', 'Doussié', 'Padouk',
    'Bambou', 'Rotin', 'Osier',
    // Autres matériaux
    'Métal', 'Acier inoxydable', 'Aluminium', 'Fer forgé',
    'Verre', 'Verre trempé', 'Miroir',
    'Tissu', 'Cuir véritable', 'Similicuir', 'Velours', 'Lin',
    'Plastique', 'Résine', 'PVC',
    'Pierre', 'Marbre', 'Granite',
    'Combinaison bois et métal', 'Combinaison bois et verre',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Styles (15+)
  styles: [
    'Moderne', 'Contemporain', 'Minimaliste',
    'Classique', 'Néoclassique', 'Traditionnel africain',
    'Rustique', 'Champêtre', 'Colonial',
    'Industriel', 'Loft', 'Vintage', 'Rétro',
    'Scandinave', 'Bohème', 'Baroque', 'Art déco',
    'Ethnique', 'Exotique',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: États (6+)
  etats: [
    'Neuf jamais utilisé', 'Neuf dans emballage',
    'Excellent état (comme neuf)', 'Très bon état',
    'Bon état (usage normal)', 'État moyen (quelques défauts)',
    'À rénover', 'Pièce de récupération',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Marques et fabricants (40+) - Focus Cameroun et Afrique
  marques: [
    // Marques camerounaises / locales
    'Fabrication artisanale locale', 'Menuisier local', 'Ébéniste camerounais',
    'Marché des meubles Douala', 'Marché des meubles Yaoundé',
    'Atelier Bois du Littoral', 'Menuiserie moderne Cameroun',
    // Marques africaines
    'African Design', 'Afri Mobilier', 'Tropical Wood Design',
    // Marques internationales populaires au Cameroun
    'IKEA', 'Conforama', 'BUT',
    'Habitat', 'Maisons du Monde', 'Alinea',
    // Marques haut de gamme
    'Roche Bobois', 'Ligne Roset', 'Poltrona Frau', 'Natuzzi',
    // Marques qualité/prix
    'Home24', 'Wayfair', 'Zara Home',
    // Importation Chine/Asie
    'Import Chine', 'Import Dubaï', 'Import Turquie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Couleurs principales (25+)
  couleurs: [
    'Blanc', 'Blanc cassé', 'Ivoire', 'Beige', 'Crème',
    'Gris clair', 'Gris', 'Gris anthracite', 'Noir',
    'Marron clair', 'Marron', 'Marron foncé', 'Chocolat', 'Caramel',
    'Bois naturel', 'Bois clair', 'Bois foncé', 'Acajou', 'Wengé',
    'Bleu', 'Bleu marine', 'Bleu canard', 'Vert', 'Vert olive',
    'Rouge', 'Bordeaux', 'Orange', 'Jaune', 'Rose',
    'Doré', 'Argenté', 'Cuivré',
    'Multicolore', 'Bicolore',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Garanties (8+)
  garanties: [
    'Garantie 6 mois', 'Garantie 1 an', 'Garantie 2 ans', 'Garantie 3 ans',
    'Garantie 5 ans', 'Garantie à vie (structure)',
    'Garantie fabricant', 'Garantie vendeur',
    'Sans garantie', 'Occasion sans garantie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Dimensions standards (pour certains types)
  dimensions_standards: [
    // Lits
    '90x190 cm (1 place)', '120x190 cm (1 place XL)', '140x190 cm (2 places)',
    '160x200 cm (Queen Size)', '180x200 cm (King Size)', '200x200 cm (Super King)',
    // Tables
    '60x60 cm', '80x80 cm', '90x90 cm', '120x80 cm', '140x90 cm', '160x90 cm', '180x90 cm',
    // Canapés (largeur)
    '150 cm (2 places)', '180 cm (2-3 places)', '200 cm (3 places)', '220 cm (3-4 places)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Services associés
  services: [
    'Livraison disponible', 'Livraison gratuite', 'Livraison et montage',
    'Montage offert', 'Montage sur demande (payant)',
    'Service après-vente', 'Retour possible (7 jours)', 'Échange possible',
    'Paiement échelonné possible', 'Réservation possible',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Caractéristiques spéciales
  caracteristiques: [
    'Démontable', 'Pliable', 'Extensible', 'Modulable', 'Convertible',
    'Avec rangement intégré', 'Avec tiroirs', 'Avec étagères',
    'Réglable en hauteur', 'Inclinable', 'Pivotant', 'Roulettes',
    'Résistant à l\'eau', 'Traité anti-termites', 'Traité anti-moisissure',
    'Résistant aux UV', 'Pour extérieur',
    'Ergonomique', 'Orthopédique (matelas)',
    'Design personnalisable', 'Sur mesure possible',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ALIMENTS FRAIS (fruits, légumes, viandes, poissons)
// ⚠️ FUSION avec AGROALIMENTAIRE - Utiliser AGROALIMENTAIRE_MODALITIES à la place
export const ALIMENTS_MODALITIES: ModalityCategory = {
  // ✅ NOUVEAU: Noms de produits frais courants
  noms_produits: [
    'Tomate', 'Oignon', 'Pomme de terre', 'Carotte', 'Haricot vert', 'Poivron',
    'Aubergine', 'Courgette', 'Concombre', 'Salade', 'Chou', 'Banane plantain',
    'Banane douce', 'Avocat', 'Mangue', 'Ananas', 'Papaye', 'Orange', 'Citron',
    'Poulet entier', 'Cuisses de poulet', 'Ailes de poulet', 'Poisson frais',
    'Tilapia', 'Maquereau frais', 'Crevettes', 'Viande de bœuf', 'Viande de porc',
    'Viande de chèvre', 'Lait frais', 'Yaourt', 'Œufs', 'Fromage',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Catégories d'aliments
  categories: [
    'Fruits', 'Légumes', 'Viande', 'Poisson', 'Volaille', 'Produits laitiers',
    'Céréales', 'Épices', 'Boissons', 'Pâtisserie', 'Conserves', 'Surgelés',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types (aligné sur agroalimentaire)
  types: [
    'Fruits frais', 'Légumes frais', 'Viande fraîche', 'Poisson frais', 'Volaille fraîche',
    'Produits laitiers frais', 'Œufs', 'Pain et pâtisserie', 'Charcuterie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Origines
  origines: [
    'Cameroun', 'Locale', 'Afrique de l\'Ouest', 'Europe', 'Asie', 'Amérique',
    'Bio', 'Équitable', 'Traditionnelle', 'Importée',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Unités de mesure
  unites: [
    'kg', 'g', 'L', 'mL', 'pièce', 'botte', 'paquet', 'barquette',
    'filet', 'cagette', 'bouquet', 'grappe', 'douzaine',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Conditionnements
  conditionnements: [
    'En vrac', 'Barquette', 'Filet', 'Sachet', 'Cagette',
    'Botte', 'Bouquet', 'Grappe', 'Plateau', 'Emballé sous vide',
    'Emballage carton', 'Emballage plastique', 'Portion individuelle',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Méthodes de conservation
  conservation: [
    'Frais (2-8°C)', 'Surgelé (-18°C)', 'Température ambiante', 'Au sec',
    'Sous vide', 'Conserve', 'Séché', 'Fumé', 'Salé', 'Mariné',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Labels qualité
  labels_qualite: [
    'Bio', 'AB (Agriculture Biologique)', 'Label Rouge', 'AOC', 'AOP', 'IGP',
    'Commerce équitable', 'Fermier', 'Artisanal', 'Local', 'Frais du jour',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Certifications
  certifications: [
    'Bio', 'Halal', 'Kasher', 'Vegan', 'Sans gluten', 'Équitable',
    'Sans OGM', 'Sans pesticides', 'Agriculture raisonnée',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Allergènes
  allergenes: [
    'Gluten', 'Lait', 'Lactose', 'Œufs', 'Poisson', 'Crustacés',
    'Arachides', 'Fruits à coque', 'Soja', 'Céleri', 'Moutarde',
    'Sésame', 'Sulfites',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS AGROALIMENTAIRE (produits transformés, conditionnés)
export const AGROALIMENTAIRE_MODALITIES: ModalityCategory = {
  // ✅ FUSION ENRICHIE: Noms de produits - Produits secs, transformés ET frais avec TERMINOLOGIES LOCALES
  // \uD83C\uDF0D Inclut les noms courants dans chaque pays d'Afrique francophone
  noms_produits: [
    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83C\uDF3E CÉRÉALES & FÉCULENTS (40+)
    // ═══════════════════════════════════════════════════════════════════════════
    // Riz (variations locales)
    'Riz', 'Riz parfumé', 'Riz basmati', 'Riz Uncle Ben\'s', 'Riz cargo', 'Riz étuvé',
    'Riz blanc', 'Riz local', 'Riz importé', 'Riz brisé', 'Riz complet',

    // Pâtes
    'Spaghetti', 'Macaroni', 'Pâtes Panzani', 'Pâtes Barilla', 'Vermicelles',
    'Nouilles Indomie', 'Nouilles chinoises', 'Coquillettes', 'Penne',

    // Farines (avec noms locaux)
    'Farine de blé', 'Farine de maïs', 'Farine Golden Penny', 'Farine locale',
    'Farine de manioc', 'Gari (farine manioc fermentée)', 'Tapioca', 'Amidon',
    'Farine de mil', 'Farine de sorgho', 'Farine de riz',

    // Semoules & Couscous
    'Couscous', 'Semoule de blé', 'Semoule de maïs',

    // Pain & Pâtisserie (terminologie locale)
    'Pain', 'Pain de mie', 'Baguette', 'Pain sucré', 'Croissant',
    '\uD83C\uDDE8\uD83C\uDDF2 Puff-puff (beignet)', '\uD83C\uDDE8\uD83C\uDDF2 Beignet haricot (accara)', '\uD83C\uDDF8\uD83C\uDDF3 Fataya',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83E\uDD5B PRODUITS LAITIERS (25+)
    // ═══════════════════════════════════════════════════════════════════════════
    // Lait en poudre (marques populaires)
    'Lait Nido', 'Lait Peak', 'Lait Dano', 'Lait Three Crowns', 'Lait Cowbell',
    'Lait en poudre', 'Lait concentré', 'Lait condensé sucré',

    // Lait liquide & produits frais
    'Lait frais', 'Lait pasteurisé', 'Lait caillé', 'Yaourt', 'Yaourt nature',
    'Yaourt aromatisé', 'Crème fraîche', 'Beurre', 'Margarine',

    // Fromages
    'Fromage', 'La Vache qui Rit', 'Fromage Président', 'Kiri',
    'Fromage fondu', 'Fromage râpé', 'Fromage blanc',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83E\uDD5A ŒUFS (variations)
    // ═══════════════════════════════════════════════════════════════════════════
    'Œufs', 'Œufs de poule', 'Œufs bio', 'Œufs fermiers', 'Œufs locaux',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83D\uDEE2️ HUILES & MATIÈRES GRASSES (30+)
    // ═══════════════════════════════════════════════════════════════════════════
    // Huiles avec marques locales
    '\uD83C\uDDE8\uD83C\uDDF2 Huile SABC', '\uD83C\uDDE8\uD83C\uDDF2 Huile Cicam', '\uD83C\uDDE8\uD83C\uDDF2 Huile Azur', '\uD83C\uDDE8\uD83C\uDDF2 Huile Beauté d\'Afrique',
    '\uD83C\uDDE8\uD83C\uDDEE Huile Moossou', '\uD83C\uDDE8\uD83C\uDDEE Huile TRITURAF',
    'Huile d\'arachide', 'Huile de palme rouge', 'Huile de palmiste',
    'Huile de tournesol', 'Huile d\'olive', 'Huile de soja', 'Huile de coco',
    'Huile végétale', 'Huile mélangée',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83E\uDDC2 SEL, SUCRE, ÉPICES (40+)
    // ═══════════════════════════════════════════════════════════════════════════
    // Sel
    'Sel fin', 'Sel de mer', 'Sel gemme', 'Sel iodé', 'Gros sel',

    // Sucre
    'Sucre en poudre', 'Sucre en morceaux', 'Sucre blanc', 'Sucre roux',
    'Sucre glace', 'Cassonade',

    // Cubes & Assaisonnements (très importants en Afrique !)
    'Cube Maggi', 'Cube Jumbo', 'Cube Knorr', 'Cube d\'arome', 'Cube Goût',
    'Poudre Maggi', 'Jumbo en poudre',

    // Épices (avec noms locaux africains)
    'Poivre noir', 'Poivre moulu', '\uD83C\uDDE8\uD83C\uDDF2 Poivre de Penja', 'Poivre blanc',
    'Piment', 'Piment rouge', 'Piment fort', '\uD83C\uDDE8\uD83C\uDDF2 Top Piment',
    'Curry', 'Curcuma', 'Gingembre moulu', 'Ail en poudre', 'Oignon en poudre',
    '\uD83C\uDDE8\uD83C\uDDF2 Njansan', '\uD83C\uDDE8\uD83C\uDDF2 Djansang', '\uD83C\uDDE8\uD83C\uDDF2 Mbongo', '\uD83C\uDDE8\uD83C\uDDF2 4 côtés',
    'Cannelle', 'Muscade', 'Clou de girofle', 'Thym', 'Laurier',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83C\uDF45 SAUCES & CONDIMENTS (30+)
    // ═══════════════════════════════════════════════════════════════════════════
    'Ketchup', 'Ketchup Heinz', 'Mayonnaise', 'Moutarde',
    'Sauce tomate', '\uD83C\uDDF3\uD83C\uDDEC Concentré Tasty Tom', '\uD83C\uDDF3\uD83C\uDDEC Concentré Gino',
    'Concentré de tomate', 'Sauce piquante', 'Harissa', 'Sauce soja',
    'Vinaigre', 'Vinaigre blanc', 'Vinaigre de vin',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83E\uDD6B CONSERVES (30+)
    // ═══════════════════════════════════════════════════════════════════════════
    // Poissons en conserve
    'Sardines', 'Sardines à l\'huile', 'Sardines sauce tomate',
    'Thon en conserve', 'Thon à l\'huile', 'Thon au naturel',
    'Maquereau en conserve', 'Saumon en conserve',

    // Légumes en conserve
    'Haricots rouges', 'Haricots blancs', 'Pois chiches', 'Lentilles',
    'Maïs doux', 'Petits pois', 'Champignons', 'Tomates pelées',
    'Haricots verts', 'Macédoine de légumes',

    // Fruits en conserve
    'Ananas au sirop', 'Pêches au sirop', 'Fruits au sirop',

    // ═══════════════════════════════════════════════════════════════════════════
    // ☕ BOISSONS CHAUDES (25+)
    // ═══════════════════════════════════════════════════════════════════════════
    // Café
    'Nescafé', 'Café soluble', 'Café moulu', 'Café en grains',

    // Chocolat chaud
    'Milo', 'Chocolat en poudre', 'Cacao en poudre', 'Nesquik',

    // Thé
    'Lipton', 'Thé noir', 'Thé vert', 'Thé en sachet', 'Infusion',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83E\uDD64 BOISSONS (50+ avec marques locales)
    // ═══════════════════════════════════════════════════════════════════════════
    // Eaux (par pays)
    '\uD83C\uDDE8\uD83C\uDDF2 Eau Zena', '\uD83C\uDDE8\uD83C\uDDF2 Eau Supermount', '\uD83C\uDDE8\uD83C\uDDF2 Eau Tangui', '\uD83C\uDDE8\uD83C\uDDF2 Source du Pays',
    '\uD83C\uDDE8\uD83C\uDDEE Eau Celia', '\uD83C\uDDE8\uD83C\uDDEE Eau Awoulaba',
    '\uD83C\uDDF8\uD83C\uDDF3 Eau Kirene', '\uD83C\uDDF8\uD83C\uDDF3 Eau Lafi',
    '\uD83C\uDDF2\uD83C\uDDF1 Eau Djoliba',
    'Eau minérale', 'Eau de source', 'Eau gazeuse',

    // Sodas
    'Coca-Cola', 'Fanta', 'Sprite', 'Schweppes', 'Orangina',

    // Jus (avec marques locales)
    '\uD83C\uDDE8\uD83C\uDDF2 Jus Top Ananas', '\uD83C\uDDE8\uD83C\uDDF2 Jus Zena', '\uD83C\uDDF8\uD83C\uDDF3 Jus Bissap', '\uD83C\uDDF8\uD83C\uDDF3 Jus Kirene',
    'Jus d\'orange', 'Jus de fruits', 'Jus Tropicana', 'Nectar de fruits',
    'Jus de mangue', 'Jus d\'ananas', 'Jus de goyave',

    // Boissons maltées (très populaires)
    '\uD83C\uDDF3\uD83C\uDDEC Maltina', '\uD83C\uDDF3\uD83C\uDDEC Supermalt', 'Boisson maltée',

    // Energy drinks
    'Red Bull', 'Monster', 'Boisson énergisante',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83C\uDF6A SNACKS & CONFISERIES (40+)
    // ═══════════════════════════════════════════════════════════════════════════
    // Biscuits
    'Biscuits', 'Cookies', 'Petit-beurre', 'Biscuits salés',
    '\uD83C\uDDF8\uD83C\uDDF3 Biscuits Patisen', 'Biscuits Marie', 'Gaufrettes',

    // Chips & snacks salés
    'Chips', 'Chips Lay\'s', 'Chips Pringles', 'Chips locales',
    'Biscuits apéritif', 'Crackers', 'Pop-corn',

    // Noix & fruits secs
    'Cacahuètes', 'Cacahuètes grillées', 'Arachides',
    'Noix de cajou', 'Pistaches', 'Amandes', 'Noix mélangées',

    // Confiseries
    'Bonbons', 'Chocolat', 'Chocolat au lait', 'Chocolat noir',
    'Chewing-gum', 'Caramels', '\uD83C\uDDF8\uD83C\uDDF3 Niokobok', 'Sucettes',
    'Barres chocolatées', 'Barres céréales',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83C\uDF4E FRUITS FRAIS (60+ avec noms locaux africains)
    // ═══════════════════════════════════════════════════════════════════════════
    // Bananes (très important en Afrique !)
    'Banane plantain', 'Banane douce', 'Banane poyo', 'Plantain mûr', 'Plantain vert',

    // Agrumes
    'Orange', 'Orange douce', 'Orange amère', 'Citron', 'Citron vert', 'Citron jaune',
    'Mandarine', 'Pamplemousse',

    // Fruits tropicaux courants
    'Mangue', 'Mangue greffée', 'Mangue locale', 'Ananas', 'Ananas Victoria',
    'Papaye', 'Papaye solo', 'Avocat', 'Avocat Hass', 'Poire d\'avocat',
    'Noix de coco', 'Coco vert', 'Coco sec',

    // Pastèque & melon
    'Pastèque', 'Melon', 'Melon d\'eau',

    // Fruits spécifiques africains (avec noms locaux)
    '\uD83C\uDDE8\uD83C\uDDF2 Safou (prune africaine)', 'Corossol', 'Fruit de la passion',
    'Goyave', 'Maracuja',

    // Autres fruits
    'Pomme', 'Poire', 'Raisin', 'Fraises', 'Kiwi',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83E\uDD6C LÉGUMES FRAIS (70+ avec noms locaux africains)
    // ═══════════════════════════════════════════════════════════════════════════
    // Légumes feuilles (très populaires en Afrique !)
    '\uD83C\uDDE8\uD83C\uDDF2 Ndolé (feuilles amères)', '\uD83C\uDDE8\uD83C\uDDF2 Koki (feuilles taro)', '\uD83C\uDDE8\uD83C\uDDF2 Okok (eru/gnetum)',
    'Feuilles de manioc (pondu)', 'Épinards', 'Épinards africains',
    'Amarante (gboma)', 'Oseille (bissap feuilles)', 'Morelle noire',

    // Légumes fruits
    'Tomate', 'Tomate fraîche', 'Tomate locale', 'Tomate cerise',
    'Poivron', 'Poivron vert', 'Poivron rouge', 'Poivron jaune',
    'Piment', 'Piment fort (pili-pili)', 'Piment vert', 'Piment rouge',
    'Aubergine', 'Aubergine africaine', 'Aubergine violette',
    'Gombo (okra)', 'Concombre', 'Courgette',

    // Légumes racines
    'Oignon', 'Oignon rouge', 'Oignon blanc', 'Échalote',
    'Ail', 'Ail frais', 'Gingembre', 'Gingembre frais',
    'Carotte', 'Pomme de terre', 'Patate douce',

    // Légumes verts
    'Haricot vert', 'Petit pois', 'Chou', 'Chou blanc', 'Chou vert',
    'Salade', 'Laitue', 'Céleri', 'Persil', 'Ciboulette',

    // Courges
    'Citrouille', 'Courge', 'Potiron',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83C\uDF57 VIANDES & VOLAILLES (50+ avec terminologie locale)
    // ═══════════════════════════════════════════════════════════════════════════
    // Poulet (très consommé !)
    'Poulet entier', 'Poulet découpé', 'Poulet fermier', '\uD83C\uDDE8\uD83C\uDDF2 Poulet bicyclette (local)',
    'Cuisses de poulet', 'Ailes de poulet', 'Blanc de poulet', 'Pilons de poulet',
    'Gésiers', 'Foie de poulet', 'Poulet congelé', 'Poulet frais',

    // Autres volailles
    'Dinde', 'Canard', 'Pintade', 'Pintade locale',

    // Bœuf
    'Viande de bœuf', 'Bœuf haché', 'Steak de bœuf', 'Côte de bœuf',
    'Rôti de bœuf', 'Viande bovine', 'Queue de bœuf', 'Viande séchée (kilishi)',

    // Mouton & chèvre (très populaire)
    'Viande de mouton', 'Côtelettes d\'agneau', 'Gigot d\'agneau',
    'Viande de chèvre', 'Chèvre découpée', '\uD83C\uDDE8\uD83C\uDDF2 Cabri (chevreau)',

    // Porc
    'Viande de porc', 'Côtes de porc', 'Rôti de porc', 'Porc haché',
    'Jambon', 'Bacon', 'Saucisse', 'Saucisson',

    // Abats
    'Abats', 'Foie', 'Rognons', 'Tripes', 'Pieds de bœuf',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83D\uDC1F POISSONS & FRUITS DE MER (40+ avec espèces locales)
    // ═══════════════════════════════════════════════════════════════════════════
    // Poissons frais (espèces africaines)
    'Poisson frais', 'Tilapia', 'Carpe', 'Poisson-chat (Clarias)',
    'Capitaine', 'Bar', 'Dorade', 'Maquereau frais', 'Sardines fraîches',
    'Barracuda', 'Mérou', 'Thon frais', 'Espadon',

    // Poissons fumés/séchés (très populaire en Afrique)
    'Poisson fumé', 'Poisson séché', 'Machoiron fumé', 'Silure fumé',

    // Fruits de mer
    'Crevettes', 'Crevettes décortiquées', 'Crevettes géantes',
    'Crabes', 'Calamars', 'Poulpe', 'Moules', 'Huîtres',

    // ═══════════════════════════════════════════════════════════════════════════
    // \uD83E\uDD5C LÉGUMINEUSES & GRAINES (20+)
    // ═══════════════════════════════════════════════════════════════════════════
    'Haricots secs', 'Haricots noirs', 'Niébé (haricot local)',
    'Lentilles', 'Lentilles corail', 'Lentilles vertes',
    'Soja', 'Graines de soja', 'Arachide décortiquée', 'Arachide en coque',

    '\uD83C\uDD95 Autre produit (ajouter)'
  ],

  // ✅ FUSION: Types - Produits secs ET frais
  types: [
    // Produits secs/transformés
    'Riz et céréales', 'Pâtes alimentaires', 'Farine', 'Huile alimentaire', 'Sucre et édulcorants',
    'Sel et épices', 'Sauces et condiments', 'Conserves', 'Produits secs', 'Boissons',
    'Produits laitiers transformés', 'Produits surgelés', 'Snacks et confiseries', 'Biscuits et gâteaux',
    'Chocolat et cacao', 'Café et thé', 'Produits diététiques', 'Aliments pour bébés',
    'Produits biologiques', 'Produits halal',
    // ✅ Produits frais (fusionnés de ALIMENTS_MODALITIES)
    'Fruits frais', 'Légumes frais', 'Viande fraîche', 'Poisson frais', 'Volaille fraîche',
    'Produits laitiers frais', 'Œufs', 'Pain et pâtisserie', 'Charcuterie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FUSION: Catégories - Produits secs ET frais
  categories: [
    // Produits secs/transformés
    'Céréales et dérivés', 'Huiles et matières grasses', 'Produits sucrés', 'Condiments',
    'Boissons', 'Conserves', 'Produits secs', 'Snacks', 'Produits transformés',
    'Produits laitiers', 'Surgelés', 'Bio et diététique',
    // ✅ Produits frais (fusionnés de ALIMENTS_MODALITIES)
    'Fruits', 'Légumes', 'Viande', 'Poisson', 'Volaille', 'Céréales', 'Épices',
    'Pâtisserie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de riz
  riz: [
    'Riz blanc', 'Riz brun/complet', 'Riz parfumé', 'Riz basmati', 'Riz jasmin',
    'Riz cargo', 'Riz étuvé', 'Riz gluant', 'Riz long grain', 'Riz court grain',
    'Riz sauvage', 'Riz noir', 'Riz rouge', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de pâtes
  pates: [
    'Spaghetti', 'Macaroni', 'Penne', 'Fusilli', 'Tagliatelles', 'Lasagnes',
    'Vermicelles', 'Coquillettes', 'Farfalle', 'Rigatoni', 'Nouilles chinoises',
    'Pâtes complètes', 'Pâtes sans gluten', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types d'huiles
  huiles: [
    'Huile d\'arachide', 'Huile de palme', 'Huile de tournesol', 'Huile d\'olive',
    'Huile de soja', 'Huile de colza', 'Huile de coco', 'Huile de sésame',
    'Huile végétale mélangée', 'Huile de maïs', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de farines
  farines: [
    'Farine de blé', 'Farine de maïs', 'Farine de manioc', 'Farine de riz',
    'Farine complète', 'Farine de mil', 'Farine de sorgho', 'Farine de soja',
    'Farine sans gluten', 'Farine d\'avoine', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Condiments et sauces
  condiments: [
    'Ketchup', 'Mayonnaise', 'Moutarde', 'Sauce tomate', 'Sauce soja', 'Vinaigre',
    'Sauce piquante', 'Maggi/Jumbo', 'Bouillon cube', 'Concentré de tomate',
    'Sauce barbecue', 'Harissa', 'Piment', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Épices
  epices: [
    'Poivre', 'Sel', 'Curry', 'Curcuma', 'Gingembre', 'Ail en poudre',
    'Oignon en poudre', 'Paprika', 'Cannelle', 'Muscade', 'Clou de girofle',
    'Thym', 'Laurier', 'Persil', 'Coriandre', 'Piment de Cayenne',
    'Quatre-épices', 'Mélange d\'épices', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Boissons
  boissons: [
    'Eau minérale', 'Eau gazeuse', 'Jus de fruits', 'Sodas', 'Boissons énergisantes',
    'Thé', 'Café', 'Lait en poudre', 'Lait concentré', 'Chocolat en poudre',
    'Sirop', 'Bissap', 'Gingembre', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Conserves
  conserves: [
    'Sardines', 'Thon', 'Maquereau', 'Tomates pelées', 'Haricots', 'Pois chiches',
    'Maïs', 'Champignons', 'Fruits au sirop', 'Légumes en conserve',
    'Plats cuisinés', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Snacks et confiseries
  snacks: [
    'Chips', 'Biscuits', 'Cacahuètes', 'Noix de cajou', 'Bonbons', 'Chocolats',
    'Chewing-gum', 'Pop-corn', 'Biscuits apéritif', 'Barres céréales',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FUSION: Unités de mesure - Produits secs ET frais
  unites: [
    'kg', 'g', 'mg', 'L', 'mL', 'cL', 'dL',
    'pièce', 'paquet', 'sachet', 'boîte', 'bouteille', 'bidon',
    'sac', 'carton', 'pot', 'tube', 'flacon',
    // ✅ Unités frais (fusionnées de ALIMENTS_MODALITIES)
    'botte', 'barquette', 'filet', 'cagette', 'bouquet', 'grappe', 'douzaine',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FUSION: Conditionnements - Produits secs ET frais
  conditionnements: [
    'Sachet', 'Sachet individuel', 'Sachet familial',
    'Boîte', 'Boîte métal', 'Boîte carton',
    'Bouteille verre', 'Bouteille plastique', 'Bouteille PET',
    'Bidon', 'Bidon plastique', 'Bidon métal',
    'Sac papier', 'Sac plastique', 'Sac toile',
    'Pot', 'Pot verre', 'Pot plastique',
    'Tube', 'Flacon', 'Flacon spray',
    'Pack de 6', 'Pack de 12', 'Pack de 24',
    'Vrac', 'En vrac', 'Portion individuelle',
    // ✅ Conditionnements frais (fusionnés de ALIMENTS_MODALITIES)
    'Barquette', 'Filet', 'Cagette', 'Botte', 'Bouquet', 'Grappe', 'Plateau',
    'Emballé sous vide', 'Emballage carton', 'Emballage plastique',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Formats/Conditionnements (gardé pour compatibilité)
  formats: [
    '500g', '1kg', '2kg', '5kg', '10kg', '25kg', '50kg',
    '1L', '2L', '5L', '20L',
    'Sachet', 'Boîte', 'Bouteille', 'Bidon', 'Sac',
    'Pack de 6', 'Pack de 12', 'Pack de 24',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques populaires (exemples camerounais et internationaux)
  marques: [
    'Uncle Ben\'s', 'Tilda', 'Golden Rice', 'Panzani', 'Barilla', 'Nestlé',
    'Maggi', 'Knorr', 'Heinz', 'Coca-Cola', 'Pepsi', 'Sprite', 'Fanta',
    'Lipton', 'Nescafé', 'Nido', 'Peak', 'Danone', 'Président',
    'La Vache qui rit', 'Jumbo', 'Nivea', 'Ferrero', 'Mars', 'Snickers',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Origine/Provenance
  origines: [
    'Cameroun', 'Locale', 'Afrique de l\'Ouest', 'Europe', 'Asie',
    'Amérique', 'Thaïlande', 'Inde', 'Pakistan', 'France', 'Italie',
    'Chine', 'Vietnam', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Certifications et labels
  certifications: [
    'Bio', 'Halal', 'Kasher', 'Sans OGM', 'Commerce équitable',
    'Label rouge', 'Agriculture biologique', 'Sans gluten', 'Vegan',
    'Sans lactose', 'Sans sucre ajouté', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Labels qualité spécifiques
  labels_qualite: [
    'Bio', 'AB (Agriculture Biologique)', 'Label Rouge', 'AOC (Appellation d\'Origine Contrôlée)',
    'AOP (Appellation d\'Origine Protégée)', 'IGP (Indication Géographique Protégée)',
    'STG (Spécialité Traditionnelle Garantie)', 'Commerce équitable', 'Max Havelaar',
    'Rainforest Alliance', 'Fair Trade', 'Ecocert', 'Demeter', 'Nature & Progrès',
    'EU Organic', 'USDA Organic', 'JAS (Japanese Agricultural Standard)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Allergènes courants
  allergenes: [
    'Gluten', 'Blé', 'Seigle', 'Orge', 'Avoine',
    'Lait', 'Lactose', 'Produits laitiers',
    'Œufs', 'Poisson', 'Crustacés', 'Mollusques',
    'Arachides', 'Cacahuètes', 'Fruits à coque',
    'Noix', 'Noisettes', 'Amandes', 'Noix de cajou', 'Pistaches',
    'Soja', 'Céleri', 'Moutarde', 'Sésame', 'Lupin',
    'Sulfites', 'Anhydride sulfureux',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Conservation
  // ✅ FUSION: Modes de conservation - Produits secs ET frais
  conservation: [
    'Température ambiante', 'Au frais (2-8°C)', 'Frais (2-8°C)', 'Au sec', 'À l\'abri de la lumière',
    'Réfrigéré (0-4°C)', 'Réfrigéré après ouverture', 'Congelé (-18°C)', 'Surgelé (-18°C)',
    'Sous vide', 'Atmosphère contrôlée', 'Lyophilisé',
    // ✅ Conservation frais (fusionnés de ALIMENTS_MODALITIES)
    'Conserve', 'Séché', 'Fumé', 'Salé', 'Mariné',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ ALIMENTS_MODALITIES est maintenant obsolète - tout fusionné dans AGROALIMENTAIRE_MODALITIES
// Conservé temporairement pour référence historique uniquement
const ALIMENTS_MODALITIES_DEPRECATED = ALIMENTS_MODALITIES;

// ✅ MODALITÉS VIN ET LIQUEUR (COMMERCIALISATION) - AFRIQUE FRANCOPHONE
// \uD83C\uDFAF Périmètre : Vins, Champagnes, Liqueurs, Spiritueux (Commercialisation grossiste/détail)
// \uD83C\uDF0D Contexte : Marques internationales + productions africaines + liqueurs locales
export const VIN_LIQUEUR_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE PRODUITS (40+ types)
  types_produits: [
    // Vins rouges
    'Vin rouge tranquille', 'Vin rouge de Bordeaux', 'Vin rouge de Bourgogne',
    'Vin rouge de la Vallée du Rhône', 'Vin rouge du Languedoc', 'Vin rouge d\'Afrique du Sud',
    'Vin rouge italien (Chianti, Barolo)', 'Vin rouge espagnol (Rioja, Ribera)',
    'Vin rouge californien', 'Vin rouge chilien', 'Vin rouge argentin (Malbec)',

    // Vins blancs
    'Vin blanc sec', 'Vin blanc moelleux', 'Vin blanc liquoreux',
    'Vin blanc de Bourgogne (Chablis)', 'Vin blanc d\'Alsace', 'Vin blanc de Loire',
    'Vin blanc d\'Afrique du Sud', 'Vin blanc allemand (Riesling)', 'Vin blanc italien (Pinot Grigio)',

    // Vins rosés
    'Vin rosé de Provence', 'Vin rosé du Languedoc', 'Vin rosé d\'Afrique',

    // Champagnes & Effervescents
    'Champagne brut', 'Champagne demi-sec', 'Champagne rosé', 'Champagne millésimé',
    'Crémant (Alsace, Bourgogne, Loire)', 'Prosecco italien', 'Cava espagnol',
    'Vin mousseux', 'Vin pétillant naturel',

    // Vins spéciaux & locaux
    'Vin de palme naturel (Afrique)', 'Vin de raphia', 'Vin artisanal local',
    'Vin de fruits (mangue, ananas, goyave)', 'Hydromel', 'Cidre',

    // Spiritueux & Liqueurs
    'Whisky (Scotch, Bourbon, Irish)', 'Cognac', 'Armagnac', 'Rhum (blanc, ambré, vieux)',
    'Vodka', 'Gin', 'Tequila', 'Brandy',
    'Liqueur de fruits', 'Liqueur de café', 'Liqueur de crème',
    'Pastis / Anisette', 'Vermouth', 'Porto', 'Sherry',

    // Alcools africains traditionnels
    'Odontol (liqueur camerounaise)', 'Top Ananas (liqueur)', 'Mandjou (liqueur mangue)',
    'Bili-Bili (bière traditionnelle)', 'Tchapalo (bière de mil)', 'Koutoukou (alcool de palme)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CATÉGORIES (8 catégories principales)
  categories: [
    'Vins rouges',
    'Vins blancs',
    'Vins rosés',
    'Champagnes & Effervescents',
    'Spiritueux (Whisky, Cognac, Rhum, Vodka)',
    'Liqueurs & Apéritifs',
    'Vins fortifiés (Porto, Sherry, Vermouth)',
    'Alcools traditionnels africains',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ RÉGIONS/APPELLATIONS (50+ régions)
  regions: [
    // France - Bordeaux
    'Bordeaux', 'Médoc', 'Pauillac', 'Saint-Émilion', 'Pomerol', 'Graves', 'Sauternes',
    // France - Bourgogne
    'Bourgogne', 'Chablis', 'Côte de Nuits', 'Côte de Beaune', 'Mâconnais', 'Beaujolais',
    // France - Autres régions
    'Champagne', 'Alsace', 'Loire (Sancerre, Muscadet)', 'Vallée du Rhône (Côtes du Rhône)',
    'Provence', 'Languedoc-Roussillon', 'Sud-Ouest (Cahors, Madiran)',

    // Europe
    'Rioja (Espagne)', 'Ribera del Duero (Espagne)', 'Toscane (Italie)', 'Piémont (Italie)',
    'Vénétie (Italie)', 'Portugal (Douro, Alentejo)', 'Allemagne (Moselle, Rheingau)',

    // Nouveau Monde
    'Afrique du Sud (Stellenbosch, Paarl, Robertson)', 'Californie (Napa Valley, Sonoma)',
    'Chili (Maipo, Colchagua)', 'Argentine (Mendoza)', 'Australie (Barossa Valley)',
    'Nouvelle-Zélande (Marlborough)',

    // Afrique
    'Cameroun (productions locales)', 'Côte d\'Ivoire', 'Sénégal', 'Tunisie (Coteaux de Carthage)',
    'Maroc (Meknès, Casablanca)', 'Algérie (Mascara, Médéa)', 'Kenya', 'Éthiopie',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES/PRODUCTEURS (60+ marques - Focus Afrique francophone)
  marques: [
    // Champagnes prestigieux
    'Moët & Chandon', 'Veuve Clicquot', 'Dom Pérignon', 'Mumm', 'Piper-Heidsieck',
    'Taittinger', 'Nicolas Feuillatte', 'Laurent-Perrier', 'Bollinger', 'Krug',

    // Vins français populaires en Afrique
    'Baron de Lestac', 'Baron Philippe de Rothschild', 'Mouton Cadet', 'Castel Frères',
    'J.P. Chenet', 'Les Jamelles', 'Gato Negro', 'Calvet', 'Réserve du Patron',
    'William Pitters', 'Blason de Bourgogne', 'La Villageoise',

    // Spiritueux internationaux
    'Johnnie Walker', 'Jack Daniel\'s', 'Chivas Regal', 'Hennessy', 'Rémy Martin',
    'Ballantine\'s', 'Absolut Vodka', 'Smirnoff', 'Grey Goose', 'Bombay Sapphire',
    'Tanqueray', 'Bacardi', 'Captain Morgan', 'Havana Club', 'Martini',
    'Ricard', 'Pernod', 'Cointreau', 'Grand Marnier', 'Baileys', 'Malibu',

    // Productions africaines
    'SABC (Société Anonyme des Brasseries du Cameroun)', 'UCB (Union des Brasseries du Cameroun)',
    'Guinness Cameroun', 'Castel Cameroun', '33 Export', 'Top Ananas', 'Odontol',
    'Mandjou', 'KWV (Afrique du Sud)', 'Nederburg (Afrique du Sud)',
    'Stellenbosch Vineyards', 'Robertson Winery', 'Drostdy-Hof',

    // Vins abordables populaires
    'Cellier des Dauphins', 'Foncalieu', 'Listel', 'Patriarche', 'Boisset',
    'Concha y Toro', 'Santa Rita', 'Casillero del Diablo', 'Yellow Tail',

    // Liqueurs locales africaines
    'Top Pamplemousse', 'Top Orange', 'Tangui (liqueur)', 'Kulu (liqueur gingembre)',

    'Sans marque', 'Artisan local', 'Production familiale',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CÉPAGES (30+ cépages principaux)
  cepages: [
    // Rouges
    'Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Syrah/Shiraz', 'Grenache',
    'Malbec', 'Tempranillo', 'Sangiovese', 'Nebbiolo', 'Zinfandel',
    'Carignan', 'Mourvèdre', 'Gamay', 'Cabernet Franc',
    // Blancs
    'Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Pinot Gris/Grigio', 'Gewürztraminer',
    'Viognier', 'Sémillon', 'Chenin Blanc', 'Muscat', 'Albariño',
    'Ugni Blanc', 'Colombard',
    // Assemblages
    'Assemblage Bordeaux', 'Assemblage Rhône', 'Assemblage méditerranéen',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MILLÉSIMES (Années de production)
  millesimes: [
    '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015',
    '2014', '2013', '2012', '2011', '2010', '2009', '2008', '2007', '2006', '2005',
    '2000-2005 (grande année)', '1990-2000 (collection)', 'Avant 1990 (vintage)',
    'Non millésimé', 'Sans année', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FORMATS/CONTENANCES (15+ formats)
  formats: [
    '20cl (Piccolo)', '37,5cl (Demi-bouteille)', '50cl', '70cl (Spiritueux)',
    '75cl (Bouteille standard)', '1L (Litre)', '1,5L (Magnum)',
    '3L (Jéroboam)', '5L (Réhoboam)', '6L (Mathusalem)',
    'Carton 6 bouteilles', 'Carton 12 bouteilles', 'Caisse bois 6 bouteilles',
    'Caisse bois 12 bouteilles', 'Palette (grossiste)', 'Container (importation)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DEGRÉ D'ALCOOL (Par paliers)
  degres_alcool: [
    '0-8% (Vins légers)', '8-10%', '10-12%', '12-13%', '13-14%', '14-15%',
    '15-16% (Vins puissants)', '16-20% (Vins fortifiés)', '20-30% (Liqueurs)',
    '30-40% (Spiritueux)', '40-50% (Spiritueux forts)', '50%+ (Spiritueux très forts)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE COMMERCIALISATION (Businessmodel)
  types_commercialisation: [
    'Vente au détail (unité)', 'Vente en carton (6/12 bouteilles)',
    'Vente en caisse bois (6/12 bouteilles)', 'Vente en palette (grossiste)',
    'Importation directe (container)', 'Dépôt-vente (consignation)',
    'Vente événementielle (mariage, fête)', 'Vente en gros (minimum 50 unités)',
    'Vente export (international)', 'Vente aux professionnels (bars, restaurants, hôtels)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CERTIFICATIONS/LABELS (15+ certifications)
  certifications: [
    'AOC (Appellation d\'Origine Contrôlée)', 'AOP (Appellation d\'Origine Protégée)',
    'IGP (Indication Géographique Protégée)', 'Vin de France', 'Vin de Pays',
    'Bio / Agriculture Biologique', 'Biodynamie (Demeter)', 'Haute Valeur Environnementale (HVE)',
    'Terra Vitis', 'Vin nature / Vin naturel', 'Vegan', 'Sans sulfites ajoutés',
    'Fair Trade / Commerce équitable', 'Rainforest Alliance',
    'Sans certification', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTATS (Conditions de vente)
  etats: [
    'Neuf scellé (bouteille intacte)', 'Neuf sans scellé',
    'Excellent état (stockage optimal, cave climatisée)',
    'Bon état (stockage correct)', 'État moyen (stockage variable)',
    'Collection (bouteille rare, vintage)', 'Occasion (déjà ouverte, entamée)',
    'À consommer rapidement (proche DLC)', 'Déstockage (fin de série)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES D'EMBALLAGE
  emballages: [
    'Bouteille verre (standard)', 'Bouteille verre épais (premium)',
    'Carton standard (6 bouteilles)', 'Carton renforcé (12 bouteilles)',
    'Caisse bois (collection)', 'Coffret cadeau (1-3 bouteilles)',
    'Étui carton individuel', 'Film plastique (lot)', 'Palette filmée (grossiste)',
    'Sans emballage (vrac)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ PAYS D'ORIGINE (30+ pays producteurs)
  pays_origine: [
    // Europe
    'France', 'Italie', 'Espagne', 'Portugal', 'Allemagne', 'Grèce', 'Hongrie',
    // Afrique
    'Afrique du Sud', 'Cameroun', 'Maroc', 'Tunisie', 'Algérie', 'Kenya', 'Éthiopie',
    'Côte d\'Ivoire', 'Sénégal', 'Zimbabwe', 'Namibie',
    // Amériques
    'États-Unis (Californie)', 'Chili', 'Argentine', 'Brésil', 'Canada', 'Mexique',
    // Océanie
    'Australie', 'Nouvelle-Zélande',
    // Autres
    'Liban', 'Israël', 'Turquie', 'Géorgie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ OCCASIONS/UTILISATIONS
  occasions: [
    'Consommation quotidienne', 'Apéritif', 'Repas gastronomique',
    'Mariage', 'Anniversaire', 'Fête', 'Cérémonie traditionnelle',
    'Cadeau d\'affaires', 'Réception professionnelle', 'Bar / Restaurant / Hôtel',
    'Collection / Investissement', 'Revente / Commerce',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TEMPÉRATURES DE SERVICE (Conseils)
  temperatures_service: [
    '6-8°C (Vins blancs frais, Champagnes)', '8-10°C (Vins blancs secs)',
    '10-12°C (Vins blancs complexes, Rosés)', '12-14°C (Vins rouges légers)',
    '14-16°C (Vins rouges moyens)', '16-18°C (Vins rouges puissants)',
    '18-20°C (Vins rouges tanniques)', 'Température ambiante',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ACCORDS METS-VINS
  accords_mets: [
    'Viandes rouges', 'Viandes blanches', 'Poissons', 'Fruits de mer',
    'Fromages', 'Charcuterie', 'Plats épicés (cuisine africaine)',
    'Plats en sauce', 'Grillades', 'Desserts', 'Apéritif seul',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ QUANTITÉS MINIMALES (Pour grossistes)
  quantites_min: [
    '1 bouteille (détail)', '6 bouteilles (carton)', '12 bouteilles (caisse)',
    '24 bouteilles (2 cartons)', '50 bouteilles (grossiste)', '100 bouteilles (grossiste)',
    '500 bouteilles (importateur)', '1000+ bouteilles (distributeur)',
    'Sans minimum', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS LIVRES & FOURNITURES - ULTRA ENRICHI CAMEROUN
export const LIVRES_FOURNITURES_MODALITIES: ModalityCategory = {
  // ✅ TYPES D'ARTICLES (25 types - Livres + Fournitures + Accessoires)
  types: [
    // Livres (9)
    'Livre scolaire', 'Manuel scolaire', 'Livre de référence', 'Roman', 'BD/Comics',
    'Livre technique', 'Dictionnaire', 'Atlas', 'Encyclopédie',
    // Fournitures écriture (9)
    'Stylo', 'Stylo bille', 'Stylo plume', 'Crayon', 'Crayon de couleur', 'Marqueur/Feutre',
    'Gomme', 'Correcteur', 'Taille-crayon',
    // Accessoires dessin/calcul (5)
    'Règle', 'Équerre', 'Compas', 'Rapporteur', 'Calculatrice',
    // Organisation (5)
    'Cahier', 'Classeur', 'Chemise cartonnée', 'Cahier spirale', 'Agenda',
    // Accessoires sacs (5)
    'Cartable', 'Sac à dos scolaire', 'Trousse', 'Porte-documents', 'Farde',
    // Papeterie (4)
    'Feuilles', 'Papier millimétré', 'Papier calque', 'Carnet de notes',
    // Autres (2)
    'Calculatrice scientifique', 'Trousse géométrie complète',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NIVEAUX SCOLAIRES CAMEROUN (Détaillé par classes)
  niveaux: [
    // Maternelle
    'Petite section (3 ans)', 'Moyenne section (4 ans)', 'Grande section (5 ans)',
    // Primaire
    'CP (Cours Préparatoire)', 'CE1 (Cours Élémentaire 1)', 'CE2 (Cours Élémentaire 2)',
    'CM1 (Cours Moyen 1)', 'CM2 (Cours Moyen 2)',
    // Secondaire (Premier cycle)
    '6ème', '5ème', '4ème', '3ème',
    // Lycée (Second cycle)
    'Seconde', 'Première', 'Terminale',
    // Parcours Lycée Cameroun
    'Première S (Scientifique)', 'Terminale S', 'Première L (Littéraire)', 'Terminale L',
    'Première ES (Économie-Social)', 'Terminale ES', 'Première C (Technique)', 'Terminale C',
    // Université
    'Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2',
    // Formation professionnelle
    'CAP (Certificat d\'Aptitude Professionnelle)', 'BEP (Brevet d\'Études Professionnelles)',
    'BTS (Brevet de Technicien Supérieur)', 'Formation professionnelle',
    // Autres
    'Tous niveaux', 'Autodidacte',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MATIÈRES SCOLAIRES CAMEROUN (Par cycles)
  matieres: [
    // Matières générales Primaire
    'Français', 'Mathématiques', 'Éveil (Histoire-Géo-Sciences)', 'Langue vivante',
    // Matières Collège
    'Français', 'Anglais', 'Espagnol', 'Allemand', 'Mathématiques',
    'Histoire', 'Géographie', 'Sciences de la Vie et de la Terre (SVT)',
    'Physique-Chimie', 'Technologie', 'Arts plastiques', 'Musique', 'EPS (Sport)',
    // Matières Lycée Général
    'Français/Philosophie', 'Anglais', 'Espagnol', 'Allemand',
    'Mathématiques', 'Sciences de la Vie et de la Terre (SVT)',
    'Physique', 'Chimie', 'Sciences Économiques et Sociales (SES)',
    'Histoire-Géographie', 'Philosophie', 'Littérature', 'Latin', 'Informatique',
    // Matières techniques
    'Dessin technique', 'Électricité', 'Mécanique', 'Électronique',
    // Toutes matières
    'Toutes matières',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉDITEURS CAMEROUN (Programmes MENESRES + Locaux)
  editeurs: [
    // Éditeurs programmes MENESRES (Manuels officiels)
    'Edicef Afrique', 'CIAM (Centre d\'Impression et d\'Édition du Cameroun)',
    'Éditions CLE (Cameroon Literature in English)', 'Éditions St-Paul',
    'Éditions Clé', 'Longman Cameroun', 'Macmillan Cameroun',
    // Éditeurs internationaux (utilisés au Cameroun)
    'Nathan', 'Hachette', 'Bordas', 'Hatier', 'Magnard', 'Belin', 'Larousse',
    'Oxford University Press', 'Cambridge University Press', 'Pearson',
    // Marques fournitures populaires Cameroun
    'Bic', 'Stabilo', 'Maped', 'Clairefontaine', 'Oxford', 'Rhodia', 'Quo Vadis',
    'Pilot', 'Uni-ball', 'Monteverde', 'Caran d\'Ache', 'Faber-Castell',
    // Marques calculatrices
    'Casio', 'Texas Instruments', 'HP (Hewlett-Packard)', 'Sharp',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTATS ARTICLES (Détaillés pour prix occasion)
  etats: [
    'Neuf emballé (jamais ouvert)', 'Neuf sans emballage',
    'Excellent état (comme neuf, très peu utilisé)', 'Bon état (peu utilisé, presque comme neuf)',
    'État moyen (utilisé mais correct)', 'Occasion (utilisation normale)',
    'Usagé (utilisé intensément mais fonctionnel)', 'À rénover (utilisable mais nécessite réparation)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ LANGUES (Contexte Cameroun bilingue)
  langues: [
    'Français (uniquement)', 'Anglais (uniquement)',
    'Bilingue (Français-Anglais)', 'Espagnol', 'Allemand', 'Arabe',
    'Langues nationales (Duala, Ewondo, etc.)', 'Multilingue',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ PROGRAMMES MENESRES (Référentiels officiels)
  programmesMenesres: [
    'Programme MENESRES Primaire 2024-2025',
    'Programme MENESRES Secondaire 2024-2025',
    'Programme MENESRES Lycée scientifique 2024-2025',
    'Programme MENESRES Lycée littéraire 2024-2025',
    'OGE (Office du Baccalauréat) - Préparation Bac',
    'CAPES - Préparation concours enseignement',
    'BEPC - Préparation brevet',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE CALCULATRICES (Par niveau)
  typesCalculatrice: [
    'Calculatrice simple', 'Calculatrice scientifique',
    'Calculatrice graphique (Casio fx-9750GIII, TI-83 Plus)',
    'Calculatrice programmable', 'Calculatrice financière',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FORMATS DE CAHIERS
  formatsCahiers: [
    '17x22 (Petit format)', '21x29,7 (A4)', '24x32 (Grand format)',
    'A5 (14,8x21)', 'Spirale 17x22', 'Spirale A4', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ COULEURS FOURNITURES (Pour stylos, marqueurs, etc.)
  couleursFournitures: [
    'Noir', 'Bleu', 'Rouge', 'Vert', 'Jaune', 'Orange', 'Rose', 'Violet',
    'Marron', 'Gris', 'Or', 'Argenté', 'Transparent', 'Multicolore',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS QUINCAILLERIE - REFONTE COMPLÈTE
// \uD83C\uDFAF Périmètre : UNIQUEMENT Quincaillerie (visserie, outils, matériaux, peinture, serrurerie)
// ✅ INCLUT : Accessoires électriques et plomberie (petits matériaux)
// ❌ EXCLUS : Gros produits électriques (voir ELECTRICITE_MODALITIES), Gros sanitaires (voir SANITAIRE_MODALITIES), Services (voir PLOMBERIE_MODALITIES)
export const QUINCAILLERIE_MODALITIES: ModalityCategory = {
  // ✅ NOMS DE PRODUITS (70+ produits spécifiques quincaillerie)
  noms_produits: [
    // Visserie & Boulonnerie
    'Vis acier', 'Vis inox', 'Vis bois', 'Vis placo', 'Vis béton', 'Vis tôle',
    'Boulon acier', 'Boulon inox', 'Écrou', 'Rondelle', 'Rondelle frein',
    'Cheville plastique', 'Cheville métallique', 'Cheville chimique',
    'Tire-fond', 'Piton à visser', 'Crochet mural', 'Agrafe', 'Rivet',

    // Serrurerie & Sécurité
    'Cadenas laiton', 'Cadenas acier', 'Cadenas à code', 'Cadenas biométrique',
    'Verrou de porte', 'Verrou de sécurité', 'Verrou de portail',
    'Serrure encastrée', 'Serrure en applique', 'Cylindre de serrure',
    'Poignée de porte', 'Béquille de porte', 'Poignée de fenêtre',
    'Barre anti-effraction', 'Chaîne de sécurité', 'Entrebâilleur', 'Gâche électrique',

    // Quincaillerie de porte/fenêtre
    'Charnière', 'Paumelle', 'Gond', 'Ferme-porte', 'Pivot de porte',
    'Butoir de porte', 'Pêne dormant', 'Cornière de protection',
    'Crémone', 'Espagnolette', 'Targette',

    // Outils manuels
    'Marteau rivoir', 'Marteau menuisier', 'Masse', 'Maillet',
    'Tournevis plat', 'Tournevis cruciforme', 'Tournevis embout',
    'Pince multiprise', 'Pince coupante', 'Pince à dénuder',
    'Clé à molette', 'Clé plate', 'Clé à pipe', 'Clé Allen',
    'Scie à métaux', 'Scie égoïne', 'Scie à bois',
    'Rabot', 'Lime', 'Râpe', 'Ciseau à bois', 'Burin',
    'Niveau à bulle', 'Mètre ruban', 'Équerre', 'Pied à coulisse',
    'Cutter', 'Tenaille', 'Arrache-clou',

    // Matériaux construction
    'Ciment gris (sac 50kg)', 'Ciment blanc', 'Mortier prêt à l\'emploi',
    'Sable (m³)', 'Sable fin', 'Gravier (m³)', 'Gravier décoratif',
    'Brique rouge', 'Brique creuse', 'Parpaing creux', 'Parpaing plein',
    'Fer à béton 6mm', 'Fer à béton 8mm', 'Fer à béton 10mm', 'Fer à béton 12mm',
    'Treillis soudé', 'Fil de fer', 'Fil d\'attache',

    // Peinture & Finitions
    'Peinture acrylique intérieure', 'Peinture glycéro', 'Peinture anti-humidité',
    'Peinture façade', 'Peinture sol', 'Peinture antirouille',
    'Vernis bois incolore', 'Vernis teinté', 'Lasure bois',
    'Enduit rebouchage', 'Enduit lissage', 'Mastic acrylique', 'Mastic silicone',
    'Colle à bois', 'Colle néoprène', 'Colle carrelage', 'Joint carrelage', 'Croisillon carrelage',
    'Peigne à colle', 'Raclette carrelage', 'Maillet caoutchouc',
    'Primaire d\'accrochage', 'Sous-couche', 'Pinceau', 'Rouleau peinture', 'Bac à peinture',

    // Accessoires électriques (petits matériaux vendus en quincaillerie)
    'Domino électrique', 'Wago', 'Boîte de dérivation', 'Gaine ICO', 'Gaine électrique',
    'Douille E27', 'Douille E14', 'Support de lampe', 'Interrupteur simple', 'Prise simple',
    'Rallonge électrique', 'Multiprise', 'Ruban isolant',

    // Accessoires plomberie (petits matériaux vendus en quincaillerie)
    'Téflon', 'Pâte à joint', 'Joint fibre', 'Joint caoutchouc', 'Collier de serrage',
    'Raccord laiton', 'Raccord PVC', 'Coude PVC 90°', 'Manchon PVC', 'Flexible eau',
    'Siphon lavabo', 'Bonde', 'Robinet d\'arrêt', 'Clapet anti-retour',

    // Divers quincaillerie
    'Chaîne acier', 'Câble acier', 'Corde', 'Sandow', 'Sangle',
    'Cadre photo', 'Miroir', 'Tringle à rideau', 'Support étagère',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CATÉGORIES (10 catégories principales)
  categories: [
    'Visserie & Boulonnerie',
    'Serrurerie & Sécurité',
    'Quincaillerie porte/fenêtre',
    'Outils manuels',
    'Matériaux construction',
    'Peinture & Finitions',
    'Accessoires électriques',
    'Accessoires plomberie',
    'Fixations & Accrochage',
    'Accessoires quincaillerie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE PRODUITS (25+ types)
  types: [
    // Visserie
    'Vis', 'Boulons', 'Écrous', 'Rondelles', 'Chevilles', 'Rivets', 'Agrafes',
    // Serrurerie
    'Serrures & Verrous', 'Cadenas', 'Cylindres', 'Poignées & Béquilles',
    // Quincaillerie
    'Charnières & Paumelles', 'Ferme-portes', 'Targettes & Crémones',
    // Outils
    'Outils de frappe', 'Outils de coupe', 'Outils de serrage', 'Outils de mesure',
    // Matériaux
    'Ciment & Mortier', 'Sable & Gravier', 'Briques & Parpaings', 'Fer à béton',
    // Peinture
    'Peintures', 'Vernis & Lasures', 'Enduits', 'Mastics & Colles',
    // Accessoires électriques
    'Dominos & Wagos', 'Gaines électriques', 'Douilles & Supports', 'Prises & Interrupteurs basiques',
    // Accessoires plomberie
    'Raccords & Coudes', 'Téflon & Joints', 'Flexibles & Siphons', 'Colliers & Fixations',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES (45+ marques - \uD83C\uDF0D AFRIQUE FRANCOPHONE COMPLÈTE)
  marques: [
    // Outils manuels
    'Stanley', 'Facom', 'Bahco', 'Irwin', 'Wiha', 'Wera', 'KS Tools',
    // Outillage électroportatif (basique)
    'Bosch', 'Makita', 'DeWalt', 'Black & Decker', 'Ryobi', 'Einhell', 'Milwaukee',
    // Peinture
    'Dulux', 'Ripolin', 'Seigneurie', 'Zolpan', 'Tollens', 'V33', 'Julien', 'Astral',
    // Serrurerie
    'Vachette', 'Bricard', 'Picard', 'Abus', 'Master Lock', 'Yale', 'Fichet',

    // ✅ MATÉRIAUX - AFRIQUE FRANCOPHONE COMPLÈTE
    // \uD83C\uDDE8\uD83C\uDDF2 CAMEROUN
    'Cimencam (Cameroun)', 'Lafarge Cameroun', 'Dangote Cement Cameroun',
    // \uD83C\uDDE8\uD83C\uDDEE CÔTE D'IVOIRE
    'SCA Côte d\'Ivoire', 'Cimaf Côte d\'Ivoire', 'Lafarge Côte d\'Ivoire',
    // \uD83C\uDDF8\uD83C\uDDF3 SÉNÉGAL
    'Sococim (Sénégal)', 'Les Ciments du Sahel (Sénégal)', 'Dangote Cement Sénégal',
    // \uD83C\uDDF2\uD83C\uDDF1 MALI
    'Diamond Cement Mali', 'Ciments du Mali',
    // \uD83C\uDDE7\uD83C\uDDEB BURKINA FASO
    'Cim Burkina', 'ScanTogo Mines',
    // \uD83C\uDDF3\uD83C\uDDEA NIGER
    'SN Sonichar (Niger)',
    // \uD83C\uDDF9\uD83C\uDDEC TOGO
    'CimTogo', 'Diamond Cement Togo',
    // \uD83C\uDDE8\uD83C\uDDEC CONGO-BRAZZAVILLE
    'SCA Congo',
    // \uD83C\uDDEC\uD83C\uDDE6 GABON
    'Cimgabon',
    // \uD83C\uDDE7\uD83C\uDDEF BÉNIN
    'SCB Lafarge Bénin', 'Ciments du Bénin',
    // \uD83C\uDDF9\uD83C\uDDE9 TCHAD
    'Ciments du Tchad',
    // \uD83C\uDDE8\uD83C\uDDE9 RDC
    'PPC Barnet (RDC)', 'Cilu (RDC)',
    // \uD83C\uDDF3\uD83C\uDDEC NIGERIA (voisin important)
    'Dangote Cement Nigeria', 'BUA Cement Nigeria', 'Lafarge Africa Nigeria',

    // Internationales multi-pays
    'Lafarge Holcim', 'Heidelberg Cement', 'Cemex International',

    // Marques locales/budget
    'Sans marque', 'Marque locale', 'Importation Chine', 'Importation Turquie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MATÉRIAUX (12+ matériaux)
  materiaux: [
    'Acier', 'Acier inoxydable', 'Acier galvanisé', 'Laiton', 'Aluminium',
    'Zinc', 'Plastique', 'PVC', 'Bois', 'Béton', 'Ciment', 'Fer',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FINITIONS/COULEURS (15+)
  finitions: [
    'Naturel', 'Brut', 'Zingué', 'Galvanisé', 'Chromé', 'Nickelé', 'Laitonné',
    'Noir', 'Blanc', 'Gris', 'Marron', 'Doré', 'Argenté', 'Peint', 'Verni',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTATS (7 états)
  etats: [
    'Neuf emballé',
    'Neuf déballé',
    'Excellent état',
    'Bon état',
    'Occasion',
    'À réparer',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GARANTIES (7 types)
  garanties: [
    'Garantie fabricant 10 ans',
    'Garantie fabricant 5 ans',
    'Garantie fabricant 2 ans',
    'Garantie fabricant 1 an',
    'Garantie vendeur 3 mois',
    'Sans garantie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ UTILISATIONS (8 usages)
  utilisations: [
    'Usage résidentiel',
    'Usage professionnel',
    'Chantier',
    'Rénovation',
    'Construction neuve',
    'Bricolage',
    'Usage intensif',
    'Usage extérieur',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NORMES & CERTIFICATIONS (10+)
  normes: [
    'CE', 'NF', 'ISO 9001', 'EN 197-1 (Ciment)', 'A2P (serrurerie)',
    'DIN (norme allemande)', 'AFNOR', 'Norme européenne',
    'Certifié usage extérieur', 'Sans norme',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ UNITÉS DE VENTE (15+)
  unites: [
    'Pièce', 'Lot de 10', 'Lot de 50', 'Lot de 100', 'Lot de 500', 'Lot de 1000',
    'Sac 25kg', 'Sac 50kg', 'Tonne', 'm³ (mètre cube)', 'm² (mètre carré)',
    'Mètre linéaire', 'Litre', 'Pot 1L', 'Pot 2.5L', 'Pot 5L', 'Pot 10L',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DIAMÈTRES/DIMENSIONS (Visserie - 15+)
  dimensions: [
    'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M14', 'M16', 'M20',
    '3mm', '4mm', '5mm', '6mm', '8mm', '10mm', '12mm',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE FOURNISSEURS (8 types)
  fournisseurs_types: [
    'Quincaillerie/Magasin spécialisé',
    'Grande surface bricolage',
    'Grossiste matériaux',
    'Importateur direct',
    'Fabricant local',
    'Dépôt de matériaux',
    'Particulier',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS SANITAIRE - NOUVELLE CATÉGORIE COMPLÈTE
// \uD83C\uDFAF Périmètre : UNIQUEMENT Produits sanitaires (robinetterie, éviers, WC, douches, baignoires, tuyauterie)
// ❌ EXCLUS : Services de plomberie (voir PLOMBERIE_MODALITIES), Quincaillerie (voir QUINCAILLERIE_MODALITIES)
export const SANITAIRE_MODALITIES: ModalityCategory = {
  // ✅ NOMS DE PRODUITS (80+ produits sanitaires)
  noms_produits: [
    // Robinetterie Lavabos & Éviers
    'Robinet lavabo simple', 'Robinet lavabo cascade', 'Robinet lavabo col de cygne',
    'Mitigeur lavabo chromé', 'Mitigeur lavabo noir mat', 'Mitigeur lavabo doré',
    'Robinet évier mural', 'Mitigeur évier avec douchette', 'Mitigeur 3 voies (eau filtrée)',
    'Robinet cuisine professionnel', 'Robinet temporisé (lieux publics)',

    // Robinetterie Douche & Baignoire
    'Mitigeur douche encastré', 'Mitigeur douche apparent', 'Mitigeur thermostatique douche',
    'Colonne de douche complète', 'Colonne de douche LED', 'Colonne de douche hydromassante',
    'Pommeau de douche pluie', 'Pommeau de douche économique', 'Douchette à main',
    'Mitigeur baignoire cascade', 'Mitigeur baignoire îlot', 'Robinetterie bain/douche',

    // Robinetterie Spéciale
    'Robinet extérieur antigel', 'Robinet de jardin', 'Robinet machine à laver',
    'Robinet d\'arrêt', 'Vanne d\'arrêt', 'Robinet autoperceur',

    // Éviers
    'Évier inox 1 bac', 'Évier inox 2 bacs', 'Évier inox à encastrer',
    'Évier inox à poser', 'Évier céramique blanc', 'Évier céramique couleur',
    'Évier granit noir', 'Évier granit gris', 'Évier résine composite',
    'Évier d\'angle', 'Évier buanderie', 'Bac à laver',

    // Lavabos & Vasques
    'Lavabo suspendu', 'Lavabo sur colonne', 'Lavabo semi-encastré',
    'Vasque à poser ronde', 'Vasque à poser carrée', 'Vasque à poser ovale',
    'Vasque à encastrer', 'Vasque en pierre', 'Vasque en verre',
    'Lave-mains compact', 'Lave-mains d\'angle', 'Meuble lavabo',

    // WC & Accessoires WC
    'WC suspendu', 'WC au sol compact', 'WC au sol sortie horizontale',
    'WC broyeur', 'WC japonais (toilettes lavantes)', 'WC chimique portable',
    'Cuvette WC seule', 'Réservoir WC à encastrer', 'Réservoir WC apparent',
    'Abattant WC standard', 'Abattant WC frein de chute', 'Abattant WC déclipsable',
    'Mécanisme de chasse', 'Flotteur WC', 'Chasse d\'eau économique',

    // Douches
    'Receveur de douche 80x80', 'Receveur de douche 90x90', 'Receveur de douche 120x80',
    'Receveur extra-plat', 'Receveur surélevé', 'Bac à douche acrylique',
    'Paroi de douche fixe', 'Paroi de douche coulissante', 'Cabine de douche complète',
    'Porte de douche pivotante', 'Rideau de douche', 'Barre de rideau',
    'Siphon de douche', 'Bonde de douche',

    // Baignoires
    'Baignoire acrylique rectangulaire', 'Baignoire acrylique d\'angle',
    'Baignoire îlot', 'Baignoire balnéo', 'Baignoire sabot',
    'Baignoire sur pieds', 'Pare-baignoire', 'Tablier de baignoire',
    'Bonde de baignoire', 'Vidage de baignoire',

    // Tuyauterie & Raccordement
    'Tuyau PVC évacuation Ø32mm', 'Tuyau PVC évacuation Ø40mm', 'Tuyau PVC Ø50mm',
    'Tuyau PVC Ø100mm', 'Tuyau PER 12mm', 'Tuyau PER 16mm', 'Tuyau multicouche',
    'Raccord PVC mâle-femelle', 'Raccord PVC en T', 'Coude PVC 90°', 'Coude PVC 45°',
    'Raccord laiton', 'Raccord bicône', 'Manchon PVC', 'Réduction PVC',
    'Collier de serrage', 'Flexible eau tressé', 'Flexible WC',

    // Joints & Étanchéité
    'Joint silicone sanitaire', 'Joint mousse', 'Joint fibre',
    'Téflon (ruban d\'étanchéité)', 'Pâte à joint', 'Mastic silicone',

    // Accessoires Salle de Bain
    'Porte-serviettes simple', 'Porte-serviettes double', 'Anneau porte-serviettes',
    'Porte-papier toilette', 'Distributeur savon mural', 'Porte-savon',
    'Miroir salle de bain avec LED', 'Miroir simple', 'Armoire de toilette',
    'Étagère salle de bain', 'Tablette murale', 'Panier de douche',
    'Barre d\'appui', 'Barre de maintien', 'Siège de douche',
    'Balai WC', 'Brosse WC murale', 'Poubelle salle de bain',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CATÉGORIES (10 catégories)
  categories: [
    'Robinetterie',
    'Éviers',
    'Lavabos & Vasques',
    'WC & Accessoires WC',
    'Douches',
    'Baignoires',
    'Tuyauterie & Raccordement',
    'Joints & Étanchéité',
    'Accessoires salle de bain',
    'Accessoires décoratifs',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE PRODUITS (30+ types)
  types: [
    // Robinetterie
    'Robinet simple', 'Mitigeur', 'Mitigeur thermostatique', 'Robinet temporisé',
    'Colonne de douche', 'Pommeaux de douche', 'Douchettes',
    // Éviers & Lavabos
    'Évier 1 bac', 'Évier 2 bacs', 'Évier d\'angle', 'Lavabos', 'Vasques à poser', 'Vasques encastrées',
    // WC
    'WC complets', 'Cuvettes seules', 'Réservoirs', 'Abattants', 'Mécanismes',
    // Douches
    'Receveurs de douche', 'Parois de douche', 'Cabines complètes', 'Accessoires douche',
    // Baignoires
    'Baignoires rectangulaires', 'Baignoires d\'angle', 'Baignoires îlot', 'Baignoires balnéo',
    // Tuyauterie
    'Tuyaux PVC', 'Tuyaux PER', 'Raccords PVC', 'Raccords laiton', 'Flexibles',
    // Accessoires
    'Porte-serviettes', 'Miroirs', 'Étagères', 'Barres d\'appui', 'Accessoires WC',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES SANITAIRE (40+ marques - \uD83C\uDF0D AFRIQUE FRANCOPHONE)
  marques: [
    // Premium International
    'Grohe', 'Hansgrohe', 'Kohler', 'Ideal Standard', 'Roca', 'Villeroy & Boch',
    'Duravit', 'Geberit', 'Jacob Delafon', 'Porcher', 'Allia', 'Laufen',
    // Milieu de gamme
    'Franke', 'Blanco', 'Wirquin', 'Siamp', 'Nicoll', 'Wavin',
    'Bouyer', 'Porcher', 'Alterna', 'Aquance', 'Gessi',
    // Budget / Accessible Afrique
    'Selles', 'Delabie', 'Tres', 'Ramon Soler', 'Clever',

    // ✅ MARQUES LOCALES AFRIQUE FRANCOPHONE
    // \uD83C\uDDE8\uD83C\uDDF2 CAMEROUN
    'Produits sanitaires Cameroun',
    // \uD83C\uDDE8\uD83C\uDDEE CÔTE D'IVOIRE
    'Sanitaire CI',
    // \uD83C\uDDF8\uD83C\uDDF3 SÉNÉGAL
    'Sanitaire Sénégal',
    // \uD83C\uDDF3\uD83C\uDDEC NIGERIA (gros marché voisin)
    'Sanitaire Nigeria', 'Dorf Nigeria',

    // Importateurs/Distributeurs locaux
    'Importation directe Europe',
    'Importation directe Chine',
    'Importation directe Turquie',
    'Distributeur local',
    'Sans marque',
    'Marque locale',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MATÉRIAUX (12 matériaux)
  materiaux: [
    // Robinetterie
    'Laiton chromé', 'Laiton', 'Acier inoxydable', 'Zamak', 'Plastique ABS',
    // Sanitaires
    'Céramique', 'Porcelaine', 'Grès émaillé',
    // Éviers & Vasques
    'Inox 304', 'Inox 316', 'Granit composite', 'Résine', 'Acrylique', 'Pierre naturelle', 'Verre trempé',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FINITIONS/COULEURS (20+ finitions)
  finitions: [
    // Robinetterie
    'Chromé brillant', 'Chromé mat', 'Noir mat', 'Blanc mat', 'Doré', 'Or rose',
    'Cuivre', 'Laiton brossé', 'Nickel brossé', 'Inox brossé',
    // Céramique
    'Blanc brillant', 'Blanc mat', 'Noir', 'Gris', 'Beige', 'Ivoire',
    'Taupe', 'Bleu', 'Vert', 'Coloré',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DIMENSIONS STANDARDS (25+ dimensions)
  dimensions: [
    // Lavabos
    '40x30cm', '50x40cm', '55x45cm', '60x45cm', '65x50cm', '70x50cm', '80x50cm',
    // Éviers
    '40x40cm (1 bac)', '45x50cm (1 bac)', '80x50cm (2 bacs)', '100x50cm (2 bacs)', '116x50cm (2 bacs)',
    // WC
    'Standard (40cm hauteur)', 'PMR (50cm hauteur)', 'Compact (35cm profondeur)',
    // Receveurs douche
    '70x70cm', '80x80cm', '90x90cm', '100x80cm', '100x100cm', '120x80cm', '120x90cm', '140x90cm',
    // Baignoires
    '140x70cm', '150x70cm', '160x70cm', '170x70cm', '180x80cm',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTATS (7 états)
  etats: [
    'Neuf emballé',
    'Neuf déballé',
    'Excellent état (exposition)',
    'Bon état',
    'Occasion',
    'Fin de série',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GARANTIES (8 types)
  garanties: [
    'Garantie fabricant 10 ans',
    'Garantie fabricant 5 ans',
    'Garantie fabricant 2 ans',
    'Garantie fabricant 1 an',
    'Garantie SAV 6 mois',
    'Garantie pièces 3 mois',
    'Sans garantie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NORMES & CERTIFICATIONS (12+)
  normes: [
    'CE', 'NF', 'ACS (eau potable)', 'EN 817 (robinetterie)', 'EN 997 (WC)',
    'ISO 9001', 'Norme européenne', 'WaterSense', 'Économie d\'eau',
    'Certification écologique', 'Conformité PMR', 'Sans norme',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES D'INSTALLATION (8 types)
  installations: [
    'À poser', 'À encastrer', 'À suspendre (mural)', 'Sur colonne',
    'Sur pied', 'En applique', 'Encastrement partiel', 'Installation facile',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CARACTÉRISTIQUES TECHNIQUES (10+)
  caracteristiques: [
    'Économie d\'eau (réducteur de débit)',
    'Anti-calcaire',
    'Cartouche céramique',
    'Thermostatique (température constante)',
    'Cascade/Waterfall',
    'Avec LED intégré',
    'Tactile/Infrarouge',
    'Anti-bactérien',
    'Autonettoyant',
    'Résistant chocs',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ UTILISATIONS (8 usages)
  utilisations: [
    'Usage résidentiel',
    'Usage professionnel (hôtels)',
    'Lieux publics',
    'Rénovation',
    'Construction neuve',
    'PMR (personnes à mobilité réduite)',
    'Usage intensif',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DIAMÈTRES TUYAUTERIE (12+)
  diametres: [
    'Ø12mm', 'Ø14mm', 'Ø16mm', 'Ø20mm', 'Ø25mm', 'Ø32mm',
    'Ø40mm', 'Ø50mm', 'Ø63mm', 'Ø100mm', 'Ø110mm', 'Ø125mm',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE FOURNISSEURS (8 types)
  fournisseurs_types: [
    'Magasin sanitaire spécialisé',
    'Grande surface bricolage',
    'Grossiste sanitaire',
    'Showroom sanitaire',
    'Importateur direct',
    'Plombier-vendeur',
    'Particulier',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS PRESTATIONS DE SERVICE
// ✅ MODALITÉS PRESTATIONS DE SERVICE - ULTRA-COMPLET CONTEXTE AFRIQUE FRANCOPHONE
export const PRESTATIONS_SERVICE_MODALITIES: ModalityCategory = {
  // ✅ CATÉGORIES PRINCIPALES (40+) - Métiers locaux Afrique francophone
  categories: [
    // \uD83C\uDFD7️ BÂTIMENT & CONSTRUCTION (métiers les plus demandés)
    '\uD83C\uDFD7️ Maçonnerie & Béton', '\uD83C\uDFD7️ Menuiserie Bois', '\uD83C\uDFD7️ Menuiserie Aluminium',
    '\uD83C\uDFD7️ Plomberie & Sanitaire', '\uD83C\uDFD7️ Électricité Bâtiment', '\uD83C\uDFD7️ Peinture & Décoration',
    '\uD83C\uDFD7️ Carrelage & Revêtement', '\uD83C\uDFD7️ Plâtrerie & Faux Plafonds', '\uD83C\uDFD7️ Ferraillage & Coffrage',
    '\uD83C\uDFD7️ Toiture & Charpente', '\uD83C\uDFD7️ Étanchéité', '\uD83C\uDFD7️ Vitrerie', '\uD83C\uDFD7️ Climatisation',

    // \uD83D\uDC87 BEAUTÉ & COIFFURE (très populaire)
    '\uD83D\uDC87 Coiffure Femme', '\uD83D\uDC87 Coiffure Homme (Barbier)', '\uD83D\uDC87 Tresses & Nattes',
    '\uD83D\uDC87 Pose de Mèches', '\uD83D\uDC87 Manucure & Pédicure', '\uD83D\uDC87 Maquillage',
    '\uD83D\uDC87 Massage & Spa', '\uD83D\uDC87 Esthétique & Soins', '\uD83D\uDC87 Onglerie',

    // \uD83D\uDD27 MÉCANIQUE & AUTOMOBILE
    '\uD83D\uDD27 Mécanique Auto', '\uD83D\uDD27 Mécanique Moto', '\uD83D\uDD27 Électricité Auto',
    '\uD83D\uDD27 Carrosserie & Peinture', '\uD83D\uDD27 Climatisation Auto', '\uD83D\uDD27 Vulcanisation (Pneus)',
    '\uD83D\uDD27 Lavage Auto', '\uD83D\uDD27 Dépannage Auto',

    // \uD83D\uDCBB INFORMATIQUE & TECHNOLOGIE (en croissance)
    '\uD83D\uDCBB Réparation Téléphone', '\uD83D\uDCBB Réparation Ordinateur', '\uD83D\uDCBB Développement Web',
    '\uD83D\uDCBB Développement Mobile', '\uD83D\uDCBB Graphisme & Design', '\uD83D\uDCBB Montage Vidéo',
    '\uD83D\uDCBB Installation Réseau', '\uD83D\uDCBB Maintenance IT', '\uD83D\uDCBB Formation Informatique',
    '\uD83D\uDCBB Cybersécurité', '\uD83D\uDCBB Création de Sites Web',

    // \uD83C\uDFE0 MÉNAGE & ENTRETIEN
    '\uD83C\uDFE0 Ménage à Domicile', '\uD83C\uDFE0 Repassage', '\uD83C\uDFE0 Jardinage', '\uD83C\uDFE0 Nettoyage Bureaux',
    '\uD83C\uDFE0 Nettoyage Vitres', '\uD83C\uDFE0 Désinfection & Fumigation',

    // \uD83D\uDC68‍\uD83C\uDF73 CUISINE & RESTAURATION
    '\uD83D\uDC68‍\uD83C\uDF73 Cuisinier à Domicile', '\uD83D\uDC68‍\uD83C\uDF73 Traiteur Événements', '\uD83D\uDC68‍\uD83C\uDF73 Pâtisserie',
    '\uD83D\uDC68‍\uD83C\uDF73 Chef à Domicile', '\uD83D\uDC68‍\uD83C\uDF73 Livraison Repas',

    // ⚠️ NOTE : Formation & Éducation → Catégorie dédiée "Formation & Éducation"
    // Les cours particuliers, soutien scolaire, préparation concours sont désormais
    // dans la catégorie FORMATION_EDUCATION_MODALITIES (séparation claire)

    // \uD83E\uDE7A SANTÉ & BIEN-ÊTRE
    '\uD83E\uDE7A Soins Infirmiers', '\uD83E\uDE7A Kinésithérapie', '\uD83E\uDE7A Aide-Soignant', '\uD83E\uDE7A Auxiliaire de Vie',
    '\uD83E\uDE7A Garde-Malade', '\uD83E\uDE7A Pharmacien à Domicile',

    // \uD83D\uDC76 GARDE & ASSISTANCE
    '\uD83D\uDC76 Garde d\'Enfants', '\uD83D\uDC76 Baby-sitting', '\uD83D\uDC76 Nounou à Domicile',
    '\uD83D\uDC76 Accompagnement Scolaire',

    // \uD83D\uDCF8 ÉVÉNEMENTIEL & MULTIMÉDIA
    '\uD83D\uDCF8 Photographie', '\uD83D\uDCF8 Vidéographie', '\uD83D\uDCF8 DJ & Sonorisation', '\uD83D\uDCF8 Animation Événements',
    '\uD83D\uDCF8 Location Matériel Sono', '\uD83D\uDCF8 Décoration Événements',

    // \uD83D\uDE9A TRANSPORT & LOGISTIQUE
    '\uD83D\uDE9A Déménagement', '\uD83D\uDE9A Transport Marchandise', '\uD83D\uDE9A Coursier/Livreur',
    '\uD83D\uDE9A Chauffeur Personnel', '\uD83D\uDE9A Location Véhicule avec Chauffeur',

    // \uD83D\uDD10 SÉCURITÉ & SURVEILLANCE
    '\uD83D\uDD10 Agent de Sécurité', '\uD83D\uDD10 Gardiennage', '\uD83D\uDD10 Installation Caméras',
    '\uD83D\uDD10 Installation Alarmes',

    // \uD83E\uDEA1 COUTURE & MODE
    '\uD83E\uDEA1 Couture sur Mesure', '\uD83E\uDEA1 Retouches Vêtements', '\uD83E\uDEA1 Stylisme',
    '\uD83E\uDEA1 Broderie', '\uD83E\uDEA1 Tapisserie',

    // ⚡ ÉLECTRONIQUE & RÉPARATION
    '⚡ Réparation Électroménager', '⚡ Réparation TV', '⚡ Réparation Climatiseur',
    '⚡ Installation Antenne Satellite', '⚡ Réparation Générateur',

    // \uD83C\uDFA8 ARTISANAT & ART
    '\uD83C\uDFA8 Peinture Artistique', '\uD83C\uDFA8 Sculpture', '\uD83C\uDFA8 Décoration Intérieure',
    '\uD83C\uDFA8 Ébénisterie', '\uD83C\uDFA8 Forge & Métallurgie',

    // \uD83D\uDCC4 SERVICES ADMINISTRATIFS
    '\uD83D\uDCC4 Saisie & Frappe', '\uD83D\uDCC4 Traduction', '\uD83D\uDCC4 Rédaction', '\uD83D\uDCC4 Comptabilité',
    '\uD83D\uDCC4 Conseil Juridique', '\uD83D\uDCC4 Assistance Administrative',

    // \uD83C\uDF3E AGRICULTURE & ÉLEVAGE
    '\uD83C\uDF3E Jardinage & Paysagisme', '\uD83C\uDF3E Élevage', '\uD83C\uDF3E Agriculture', '\uD83C\uDF3E Maraîchage',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE PRESTATIONS PAR NATURE (30+)
  types: [
    // Types généraux
    'Consultation', 'Diagnostic', 'Devis gratuit', 'Installation', 'Réparation',
    'Maintenance', 'Entretien régulier', 'Dépannage urgence', 'Rénovation',
    'Transformation', 'Personnalisation',
    'Coaching', 'Conseil', 'Audit', 'Expertise',
    // ⚠️ NOTE : "Formation" et "Cours particulier" → Catégorie "Formation & Éducation"
    // Types de service
    'Service à domicile', 'Service en atelier', 'Service sur chantier',
    'Prestation ponctuelle', 'Contrat mensuel', 'Abonnement',
    // Urgence
    'Intervention immédiate', 'Disponible 24h/24', 'Weekend & jours fériés',
    'Sur rendez-vous uniquement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ZONES D'INTERVENTION - S'adapte automatiquement au pays de l'utilisateur
  // Organisées par échelle: quartiers → villes → pays → continent
  // Permet choix rapide: "Tout le pays", "Toute l'Afrique", ou zones spécifiques multiples
  zones_intervention: genererZonesIntervention('CM'), // Par défaut Cameroun, s'adapte via contexte utilisateur

  // ✅ EXPÉRIENCE (12 niveaux)
  niveaux_experience: [
    'Débutant (< 1 an)', '1-2 ans d\'expérience', '3-5 ans d\'expérience',
    '5-10 ans d\'expérience', '10-15 ans d\'expérience', '15-20 ans d\'expérience',
    '20+ ans d\'expérience', 'Expert reconnu', 'Maître artisan',
    'Formateur professionnel', 'Consultant senior',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CERTIFICATIONS & DIPLÔMES (contexte Afrique francophone)
  certifications: [
    // Diplômes professionnels
    'CAP (Certificat d\'Aptitude Professionnelle)', 'BEP (Brevet d\'Études Professionnelles)',
    'Bac Pro', 'BTS', 'DUT', 'Licence Pro', 'Master', 'Doctorat',

    // Formations spécialisées
    'Diplôme d\'État', 'Certificat professionnel', 'Attestation de formation',
    'Formation qualifiante', 'Formation certifiante',

    // Certifications techniques
    'Habilitation électrique', 'Permis de conduire professionnel',
    'Certificat de soudure', 'Certification ISO', 'Certification CISCO',
    'Certification Microsoft', 'Certification Adobe', 'Certification Google',

    // Certifications locales Cameroun
    'CETIC (Cameroun)', 'Lycée Technique (Cameroun)', 'École des Métiers',
    'Centre de Formation Professionnelle', 'Apprentissage traditionnel',

    // Autres
    'Autodidacte expérimenté', 'Pas de certification (expérience terrain)',
    'En cours de certification',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DISPONIBILITÉS (15+)
  disponibilites: [
    // Immédiat
    'Disponible immédiatement', 'Intervention sous 2h', 'Intervention sous 24h',
    'Disponible cette semaine', 'Disponible ce mois',

    // Horaires
    'Lundi-Vendredi 8h-18h', 'Lundi-Samedi 8h-20h', 'Tous les jours 7h-21h',
    'Disponible le weekend', 'Disponible jours fériés',

    // Urgence
    'Service 24h/24', 'Service 7j/7', 'Urgences acceptées',

    // Planning
    'Sur rendez-vous uniquement', 'Planning flexible', 'À définir avec client',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MODALITÉS DE DÉPLACEMENT (8)
  modalites_deplacement: [
    'Je me déplace chez le client', 'Client vient chez moi (atelier)',
    'Les deux possibles', 'À distance (en ligne)', 'Hybride (présentiel + en ligne)',
    'Frais de déplacement inclus', 'Frais de déplacement en sus',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TARIFICATION (12 modes)
  modes_tarification: [
    'Prix fixe', 'Prix à l\'heure', 'Prix à la journée', 'Prix à la semaine',
    'Prix au mois', 'Prix au m² (surface)', 'Prix au mètre linéaire',
    'Prix forfaitaire', 'Devis sur mesure', 'Sur estimation',
    'Prix négociable', 'Abonnement mensuel',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MODES DE PAIEMENT (15+) - Contexte Afrique
  modes_paiement: [
    // Espèces
    'Espèces (FCFA)', 'Espèces en dollars', 'Espèces en euros',

    // Mobile Money (très populaire en Afrique)
    'Mobile Money (MTN)', 'Mobile Money (Orange Money)', 'Mobile Money (Moov)',
    'Mobile Money (tous opérateurs)',

    // Banque
    'Virement bancaire', 'Chèque', 'Carte bancaire',

    // Autres
    'PayPal', 'Western Union', 'MoneyGram',
    'Paiement échelonné', 'Acompte + solde',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉQUIPEMENTS & OUTILS (20+)
  equipements: [
    'Équipement professionnel complet', 'Outillage de base', 'Matériel moderne',
    'Machines électriques', 'Outils manuels', 'Échafaudage', 'Échelle',
    'Véhicule utilitaire', 'Camionnette équipée', 'Moto pour déplacement',
    'Ordinateur portable', 'Logiciels professionnels', 'Caméra professionnelle',
    'Matériel de sonorisation', 'Groupe électrogène', 'Compresseur',
    'Poste à souder', 'Matériel de sécurité (EPI)', 'Stock de pièces',
    'Pas d\'équipement (client fournit)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ LANGUES PARLÉES (15+) - Contexte Afrique francophone
  langues: [
    // Langues officielles
    'Français', 'Anglais',

    // Langues locales Cameroun
    'Douala (Duala)', 'Bamiléké', 'Ewondo', 'Bassa', 'Fulfulde', 'Haoussa',

    // Autres langues africaines
    'Lingala', 'Wolof', 'Bambara', 'Éwé', 'Yoruba', 'Igbo',

    // Langues internationales
    'Espagnol', 'Allemand', 'Chinois', 'Arabe',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GARANTIES PROPOSÉES (10)
  garanties: [
    'Garantie 3 mois', 'Garantie 6 mois', 'Garantie 1 an', 'Garantie 2 ans',
    'Garantie constructeur', 'Garantie pièces et main d\'œuvre',
    'Garantie main d\'œuvre uniquement', 'Service après-vente assuré',
    'Pas de garantie', 'Garantie selon travaux',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ RÉFÉRENCES & PORTFOLIO (8)
  references: [
    'Portfolio disponible', 'Photos de réalisations', 'Vidéos de travaux',
    'Références clients vérifiables', 'Avis clients positifs',
    'Travaux pour entreprises', 'Travaux pour particuliers',
    'Projets publics réalisés',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DURÉES ESTIMÉES (15)
  durees_intervention: [
    'Moins de 1h', '1-2 heures', '2-4 heures', 'Demi-journée (4h)',
    'Journée complète (8h)', '2-3 jours', '1 semaine', '2 semaines',
    '1 mois', '2-3 mois', 'Selon ampleur du projet',
    'À définir après diagnostic', 'Variable',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE CLIENTS (8)
  types_clients: [
    'Particuliers', 'Professionnels', 'Entreprises', 'Administrations',
    'ONG', 'Collectivités', 'Tous types de clients',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ASSURANCES & RESPONSABILITÉS (6)
  assurances: [
    'Assuré responsabilité civile professionnelle', 'Assuré tous risques',
    'Assuré dommages', 'Assurance décennale (bâtiment)',
    'Pas d\'assurance professionnelle', 'En cours de souscription',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ════════════════════════════════════════════════════════════════════════════════
  // ⚠️ NOTE : Formation & Éducation → Catégorie dédiée "Formation & Éducation"
  // ════════════════════════════════════════════════════════════════════════════════
  // Les champs suivants ont été RETIRÉS de PRESTATIONS_SERVICE_MODALITIES 
  // et sont maintenant EXCLUSIFS à FORMATION_EDUCATION_MODALITIES :
  //
  // ❌ matieres_enseignees (déplacé)
  // ❌ niveaux_scolaires (déplacé)
  // ❌ types_concours (déplacé)
  // ❌ concours_cibles (déplacé)
  // ❌ matieres_preparation_concours (déplacé)
  // ❌ niveaux_preparation_concours (déplacé)
  // ❌ types_accompagnement_concours (déplacé)
  // ❌ supports_pedagogiques_concours (déplacé)
  // ❌ taux_reussite_concours (déplacé)
  //
  // ✅ RAISON : Séparation claire entre :
  //    - "Formation & Éducation" (enseigner, former, apprendre)
  //    - "Prestation de Service" (réparer, construire, entretenir)
  // ════════════════════════════════════════════════════════════════════════════════

  // Suite des modalités prestations de service (techniques, réparation, etc.)
  // Les services d'enseignement/formation ne sont plus ici
};

// ✅ MODALITÉS PHARMACIE
export const PHARMACIE_MODALITIES: ModalityCategory = {
  // Types de pharmacie
  types: [
    'Pharmacie de garde', 'Pharmacie normale', 'Pharmacie hospitalière',
    'Pharmacie vétérinaire', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Services
  services: [
    'Délivrance', 'Conseil', 'Garde', 'Vaccination', 'Mesure tension', 'Analyse rapide',
    'Livraison', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Spécialités
  specialites: [
    'Médecine générale', 'Pédiatrie', 'Gynécologie', 'Cardiologie', 'Dermatologie',
    'Ophtalmologie', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS COSMÉTIQUES & PARFUMS
// ✅ MODALITÉS COSMÉTIQUES & PARFUMS - ENRICHI POUR AFRIQUE
export const COSMETIQUES_PARFUMS_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE PRODUITS (40+) - TRÈS ENRICHI
  types: [
    // Parfums & Fragrances
    'Parfum', 'Eau de parfum (EDP)', 'Eau de toilette (EDT)', 'Eau de Cologne (EDC)',
    'Déodorant', 'Déodorant roll-on', 'Déodorant spray', 'Brume corporelle',
    'Huile parfumée', 'Parfum solide',

    // Soins Visage
    'Crème visage', 'Crème hydratante', 'Crème de nuit', 'Crème de jour',
    'Crème anti-âge', 'Crème éclaircissante', 'Crème anti-taches', 'Crème solaire visage',
    'Sérum visage', 'Lotion tonique', 'Eau micellaire', 'Démaquillant',
    'Masque visage', 'Gommage visage', 'Gel nettoyant', 'Mousse nettoyante',

    // Soins Corps
    'Lait corporel', 'Crème corps', 'Lotion corporelle', 'Beurre corporel',
    'Huile corporelle', 'Gel douche', 'Savon', 'Savon liquide', 'Savon noir',
    'Gommage corps', 'Crème solaire corps', 'Huile de massage',

    // Soins Cheveux
    'Shampoing', 'Après-shampoing', 'Masque cheveux', 'Huile capillaire',
    'Sérum cheveux', 'Gel coiffant', 'Cire coiffante', 'Spray cheveux',

    // Maquillage Teint
    'Fond de teint', 'BB crème', 'CC crème', 'Poudre compacte', 'Poudre libre',
    'Anti-cernes', 'Correcteur', 'Primer', 'Enlumineur', 'Blush', 'Bronzer',

    // Maquillage Yeux
    'Mascara', 'Eye-liner', 'Crayon yeux', 'Fard à paupières', 'Palette yeux',
    'Crayon sourcils', 'Gel sourcils',

    // Maquillage Lèvres
    'Rouge à lèvres', 'Gloss', 'Baume à lèvres', 'Crayon lèvres', 'Teinture lèvres',

    // Soins Mains & Pieds
    'Crème mains', 'Vernis à ongles', 'Dissolvant',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES (60+) - CONTEXTUALISÉ AFRIQUE FRANCOPHONE
  marques: [
    // Marques Populaires Afrique (Grande Distribution)
    'Nivea', 'L\'Oréal', 'Garnier', 'Dove', 'Vaseline', 'Palmolive', 'Lux',
    'Dettol', 'Lifebuoy', 'Imperial Leather', 'Pears', 'Cussons',

    // Marques Éclaircissantes/Soins Peaux Noires (Très populaires)
    'Fair & White', 'White Secret', 'Caro White', 'Makari', 'Skinlight',
    'Diana', 'Carotone', 'Bio Claire', 'Clear Essence', 'Civic',
    'Tchaï', 'Jergens', 'Palmer\'s', 'Shea Moisture',

    // Marques Capillaires Afro
    'Dark and Lovely', 'Soft Sheen Carson', 'ORS', 'African Pride',
    'Cantu', 'As I Am', 'Creme of Nature', 'Mizani',

    // Marques Milieu de Gamme
    'Maybelline', 'Revlon', 'Max Factor', 'Rimmel', 'Essence', 'Catrice',
    'NYX', 'L.A. Girl', 'Sleek', 'Milani', 'Wet n Wild',
    'The Ordinary', 'CeraVe', 'La Roche-Posay', 'Vichy', 'Bioderma',
    'Neutrogena', 'Olay', 'Pond\'s', 'Simple',

    // Marques Luxe (Parfums & Cosmétiques)
    'Chanel', 'Dior', 'Lancôme', 'Yves Saint Laurent', 'Guerlain', 'Hermès',
    'Versace', 'Armani', 'Hugo Boss', 'Calvin Klein', 'Paco Rabanne',
    'Givenchy', 'Burberry', 'Bulgari', 'Dolce & Gabbana', 'Prada',
    'Tom Ford', 'Estée Lauder', 'Clinique', 'MAC', 'Bobbi Brown',

    // Marques Naturelles/Bio
    'The Body Shop', 'Yves Rocher', 'Lush', 'Kiehl\'s', 'Burt\'s Bees',
    'Nuxe', 'Caudalie', 'Clarins',

    // Marques Locales Africaines
    'Maison Jacynthe (Cameroun)', 'Sika\'a (Côte d\'Ivoire)', 'Suzan ObioMa (Nigeria)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CONCENTRATIONS (pour parfums)
  concentrations: [
    'Eau de Cologne (EDC) 2-5%', 'Eau de toilette (EDT) 5-15%',
    'Eau de parfum (EDP) 15-20%', 'Parfum/Extrait 20-40%',
    'Huile parfumée', 'Sans alcool', 'Non applicable',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ VOLUMES/UNITÉS (25+)
  unites: [
    '5ml', '10ml', '15ml', '20ml', '30ml', '50ml', '75ml', '100ml',
    '125ml', '150ml', '200ml', '250ml', '300ml', '400ml', '500ml',
    '1L', '5g', '10g', '15g', '20g', '30g', '50g', '100g', '150g', '200g',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GENRES/CIBLES (8)
  genres: [
    'Femme', 'Homme', 'Mixte/Unisexe', 'Enfant', 'Bébé',
    'Adolescent', 'Senior', 'Tous âges',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE PEAU (12) - ENRICHI
  types_peau: [
    'Tous types de peau', 'Peau normale', 'Peau sèche', 'Peau très sèche',
    'Peau grasse', 'Peau mixte', 'Peau sensible', 'Peau réactive',
    'Peau mature', 'Peau acnéique', 'Peau noire/métissée', 'Peau claire',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE CHEVEUX (pour produits capillaires)
  types_cheveux: [
    'Tous types', 'Cheveux normaux', 'Cheveux secs', 'Cheveux gras',
    'Cheveux mixtes', 'Cheveux crépus', 'Cheveux bouclés', 'Cheveux lisses',
    'Cheveux colorés', 'Cheveux abîmés', 'Cheveux fins', 'Cheveux épais',
    'Cheveux afro', 'Cheveux défrisés',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FINITIONS (pour maquillage)
  finitions: [
    'Mat', 'Satiné', 'Brillant', 'Nacré', 'Métallisé', 'Glowy',
    'Naturel', 'Longue tenue', 'Waterproof', 'Transfer-proof',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TEINTES/NUANCES (pour fond de teint, etc.)
  teintes: [
    'Très clair', 'Clair', 'Moyen clair', 'Moyen', 'Moyen foncé',
    'Foncé', 'Très foncé', 'Ebène', 'Caramel', 'Miel', 'Chocolat',
    'Ivoire', 'Beige', 'Nude', 'Rose', 'Pêche', 'Neutre',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ INGRÉDIENTS STARS (20+)
  ingredients_principaux: [
    'Acide hyaluronique', 'Vitamine C', 'Vitamine E', 'Vitamine A/Rétinol',
    'Niacinamide', 'Collagène', 'Aloe Vera', 'Beurre de karité',
    'Huile d\'argan', 'Huile de coco', 'Huile de jojoba', 'Huile d\'olive',
    'Acide salicylique', 'Acide glycolique', 'Acide kojique',
    'Glutathion', 'Alpha-arbutine', 'Papaye', 'Carotte', 'Citron',
    'Miel', 'Charbon actif', 'Argile', 'SPF/Protection solaire',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ORIGINES/PAYS (15+)
  origines: [
    'France', 'États-Unis', 'Royaume-Uni', 'Italie', 'Allemagne',
    'Corée du Sud', 'Japon', 'Chine', 'Thaïlande', 'Maroc',
    'Afrique du Sud', 'Cameroun', 'Côte d\'Ivoire', 'Sénégal',
    'Ghana', 'Nigeria',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CERTIFICATIONS/LABELS (10+)
  certifications: [
    'Bio', 'Naturel', 'Vegan', 'Cruelty-free', 'Sans parabènes',
    'Sans sulfates', 'Sans alcool', 'Dermatologiquement testé',
    'Hypoallergénique', 'Non comédogène', 'Halal',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS BIJOUX & ACCESSOIRES - ENRICHI CONTEXTE AFRIQUE
export const BIJOUX_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE BIJOUX (25+) - Complet pour marketplace
  types: [
    // Bijoux principaux
    'Bague', 'Alliance', 'Chevalière', 'Collier', 'Pendentif', 'Chaîne',
    'Boucles d\'oreilles', 'Créoles', 'Puces d\'oreilles',
    'Bracelet', 'Gourmette', 'Jonc', 'Manchette',
    'Broche', 'Épingle', 'Médaille', 'Croix',
    // Montres
    'Montre homme', 'Montre femme', 'Montre connectée', 'Montre de luxe',
    'Montre sport', 'Montre enfant',
    // Accessoires bijouterie
    'Parure complète', 'Demi-parure', 'Ensemble assorti',
    // Piercings
    'Piercing nez', 'Piercing oreille', 'Piercing nombril',
    // Bijoux traditionnels africains
    'Bijou traditionnel', 'Perles africaines', 'Amulette', 'Gris-gris',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MATÉRIAUX (30+) - Métaux précieux + matériaux locaux
  materiaux: [
    // Métaux précieux
    'Or jaune', 'Or blanc', 'Or rose', 'Or rouge',
    'Argent 925 (Sterling)', 'Argent massif', 'Argent plaqué',
    'Platine', 'Palladium',
    // Métaux courants
    'Acier inoxydable', 'Acier chirurgical', 'Titane',
    'Laiton', 'Bronze', 'Cuivre',
    // Plaqués et vermeil
    'Plaqué or 18k', 'Plaqué or 14k', 'Plaqué or rose',
    'Vermeil (argent plaqué or)', 'Plaqué rhodium',
    // Pierres précieuses
    'Diamant', 'Émeraude', 'Rubis', 'Saphir',
    'Tanzanite', 'Topaze', 'Améthyste', 'Aigue-marine',
    'Citrine', 'Grenat', 'Péridot', 'Opale',
    // Perles et organiques
    'Perle de culture', 'Perle d\'eau douce', 'Perle de Tahiti',
    'Nacre', 'Corail', 'Ambre', 'Ivoire végétal',
    // Matériaux modernes
    'Céramique', 'Silicone', 'Résine',
    // Matériaux traditionnels africains
    'Perles de verre africaines', 'Bois d\'ébène', 'Bois de rose',
    'Cauri (coquillages)', 'Graines naturelles', 'Os sculpté',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CARATS OR (8) - Standards internationaux
  carats: [
    '9 carats (375)', '10 carats (417)', '14 carats (585)',
    '18 carats (750)', '21 carats (875)', '22 carats (916)',
    '24 carats (999)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ PURETÉ ARGENT (6)
  puretes_argent: [
    '800 (Argent massif)', '925 (Sterling)', '950 (Britannique)',
    '999 (Argent pur)', 'Plaqué argent', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ STYLES DE BIJOUX (25+) - Moderne + traditionnel
  styles: [
    // Styles contemporains
    'Moderne', 'Minimaliste', 'Épuré', 'Géométrique',
    'Vintage', 'Rétro', 'Art déco', 'Art nouveau',
    'Classique', 'Intemporel', 'Élégant',
    // Styles tendance
    'Bohème', 'Boho chic', 'Hippie chic',
    'Rock', 'Punk', 'Gothique',
    'Romantique', 'Délicat', 'Féminin',
    // Luxe et prestige
    'Luxe', 'Haute joaillerie', 'Prestige',
    'Diamantaire', 'Précieux',
    // Styles ethniques et africains
    'Ethnique', 'Tribal', 'Africain traditionnel',
    'Afro-contemporain', 'Wax-inspired', 'Masaï',
    'Berbère', 'Touareg', 'Peul',
    // Sport et casual
    'Sport', 'Casual', 'Urbain',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES DE MONTRES (40+) - Luxe + populaires en Afrique
  marques_montres: [
    // Luxe & Prestige (Suisse)
    'Rolex', 'Patek Philippe', 'Audemars Piguet', 'Omega',
    'Tag Heuer', 'Breitling', 'IWC', 'Jaeger-LeCoultre',
    'Cartier', 'Chopard', 'Hublot', 'Panerai',
    'Vacheron Constantin', 'A. Lange & Söhne',
    // Haut de gamme accessible
    'Longines', 'Tissot', 'Hamilton', 'Rado',
    'Mido', 'Oris', 'Frederique Constant',
    // Populaires internationales
    'Seiko', 'Citizen', 'Orient', 'Casio',
    'G-Shock', 'Timex', 'Swatch', 'Fossil',
    'Michael Kors', 'Armani Exchange', 'Diesel',
    'Tommy Hilfiger', 'Lacoste', 'Hugo Boss',
    // Montres connectées
    'Apple Watch', 'Samsung Galaxy Watch', 'Garmin',
    'Fitbit', 'Huawei Watch', 'Xiaomi Mi Watch',
    'Amazfit', 'Withings',
    // Populaires en Afrique
    'Curren', 'Naviforce', 'Megir', 'Lige',
    'Olevs', 'Wwoor', 'Benyar',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES BIJOUX LUXE (25+) - Internationales connues
  marques_bijoux_luxe: [
    // Très haute joaillerie
    'Cartier', 'Tiffany & Co.', 'Bvlgari', 'Van Cleef & Arpels',
    'Harry Winston', 'Chopard', 'Graff', 'Boucheron',
    'Piaget', 'Chaumet', 'Mauboussin',
    // Luxe accessible
    'Pandora', 'Swarovski', 'Thomas Sabo', 'APM Monaco',
    'Fossil', 'Michael Kors', 'Daniel Wellington',
    'Cluse', 'Paul Hewitt', 'Rosefield',
    // Marques mode
    'Chanel', 'Dior', 'Louis Vuitton', 'Hermès',
    'Gucci', 'Prada', 'Versace',
    // Créateurs locaux africains
    'Créateur africain', 'Artisan local', 'Fait main Afrique',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTATS (7) - Pour bijoux d'occasion
  etats: [
    'Neuf avec certificat', 'Neuf sans certificat',
    'Comme neuf', 'Excellent état', 'Très bon état',
    'Bon état', 'Vintage (bon état)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CERTIFICATIONS (8) - Garantie authenticité
  certifications: [
    'Certificat d\'authenticité', 'Certificat gemmologique',
    'Certificat IGI', 'Certificat GIA', 'Certificat HRD',
    'Poinçon de garantie', 'Facture originale',
    'Sans certificat', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ SEXE/DESTINATAIRE (5)
  pour_qui: [
    'Femme', 'Homme', 'Enfant',
    'Unisexe', 'Couple (alliance)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ OCCASIONS (15+) - Contexte vente
  occasions: [
    'Mariage', 'Fiançailles', 'Alliance',
    'Anniversaire', 'Saint-Valentin', 'Fête des mères',
    'Fête des pères', 'Noël', 'Baptême',
    'Communion', 'Confirmation', 'Diplôme',
    'Promotion professionnelle', 'Cadeau d\'affaires',
    'Quotidien', 'Soirée', 'Cérémonie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TAILLES BAGUES (Standards internationaux)
  tailles_bagues: [
    '44 (EU)', '45', '46', '47', '48', '49',
    '50', '51', '52', '53', '54', '55',
    '56', '57', '58', '59', '60', '61', '62',
    'Taille ajustable', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ LONGUEURS COLLIERS/CHAÎNES (9)
  longueurs_colliers: [
    '30-35 cm (Ras de cou)', '40-45 cm (Court)',
    '50-55 cm (Princesse)', '60-65 cm (Matinée)',
    '70-80 cm (Opéra)', '90+ cm (Sautoir)',
    'Longueur ajustable', 'Sur mesure',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ LONGUEURS BRACELETS (7)
  longueurs_bracelets: [
    '16-17 cm (S)', '18-19 cm (M)', '20-21 cm (L)',
    '22-23 cm (XL)', 'Ajustable', 'Extensible',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ POIDS (Fourchettes approximatives)
  poids_approximatifs: [
    'Moins de 5g', '5-10g', '10-20g', '20-50g',
    '50-100g', '100-200g', 'Plus de 200g',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GARANTIES (7)
  garanties: [
    '6 mois', '1 an', '2 ans', '3 ans',
    '5 ans', 'Garantie à vie', 'Sans garantie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ORIGINES GÉOGRAPHIQUES (12+) - Production bijoux
  origines: [
    'France', 'Italie', 'Suisse', 'Allemagne',
    'Belgique (Anvers)', 'Pays-Bas', 'Espagne',
    'Inde', 'Chine', 'Thaïlande', 'Turquie',
    'Dubai/UAE', 'Cameroun', 'Afrique du Sud',
    'Sénégal', 'Côte d\'Ivoire', 'Mali',
    'Artisanat local', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS COIFFURE & BEAUTÉ - \uD83C\uDF0D CONTEXTE AFRIQUE FRANCOPHONE (Cameroun focus)
export const COIFFURE_BEAUTE_MODALITIES: ModalityCategory = {
  // ✅ Types de services/produits (réorganisés par catégorie)
  types: [
    // \uD83D\uDC87‍♀️ COIFFURE FEMME - PRODUITS (Extensions, Mèches)
    '\uD83C\uDF1F Mèches naturelles', // Les plus demandées
    'Extensions (tissage)',
    'Extensions (clips)',
    'Perruque complète',
    'Half wig (demi-perruque)',
    'Closure 4x4', // \uD83C\uDDE8\uD83C\uDDF2 Très populaire Cameroun
    'Closure 5x5',
    'Frontal 13x4',
    'Frontal 13x6',
    'Lace wig',
    'U-part wig',
    'Bonnet perruque',

    // \uD83D\uDC87‍♀️ COIFFURE FEMME - SERVICES (Tresses, Coiffures africaines)
    '\uD83C\uDF1F Tresses africaines (box braids)', // \uD83C\uDDE8\uD83C\uDDF2 INCONTOURNABLE
    'Nattes collées (cornrows)', // \uD83C\uDDE8\uD83C\uDDF2 Très demandé
    'Vanilles (twists)',
    'Tresses sénégalaises',
    'Tresses Ghana',
    'Tresses crochet',
    'Locks/Dreadlocks',
    'Locks entretien',
    'Défrisage complet', // \uD83C\uDDE8\uD83C\uDDF2 Service très demandé
    'Défrisage retouche racines',
    'Lissage brésilien/japonais',
    'Coloration complète',
    'Coloration racines',
    'Balayage/Mèches',
    'Coupe femme',
    'Brushing',
    'Chignon/Coiffure mariage',
    'Coiffure événement',

    // \uD83E\uDDD4 BARBIER - SERVICES HOMME (très important en Afrique)
    '\uD83C\uDF1F Coupe homme (dégradé)', // \uD83C\uDDE8\uD83C\uDDF2 Service #1 barbier
    'Coupe afro (fade)', // Très populaire jeunes
    'Coupe + Barbe',
    'Taille de barbe',
    'Rasage complet',
    'Rasage traditionnel',
    'Coupe enfant',
    'Design capillaire (motifs)',

    // \uD83D\uDC85 BEAUTÉ & SOINS
    'Manucure simple',
    'Manucure + gel',
    'Pédicure simple',
    'Pédicure + soin',
    'Pose faux ongles',
    'Extension ongles',
    'Maquillage jour',
    'Maquillage soirée/mariage',
    'Soin visage complet',
    'Soin visage anti-acné', // \uD83C\uDDE8\uD83C\uDDF2 Demandé (climat tropical)
    'Soin visage éclaircissant',
    'Épilation sourcils',
    'Épilation visage',
    'Épilation jambes complètes',
    'Épilation maillot',
    'Massage relaxant',
    'Massage californien',
    'Massage aux pierres chaudes',

    // \uD83E\uDDF4 PRODUITS CAPILLAIRES
    'Shampooing professionnel',
    'Après-shampooing',
    'Masque capillaire',
    'Huile capillaire (karité, coco, argan)', // \uD83C\uDDE8\uD83C\uDDF2 Produits naturels africains
    'Gel coiffant',
    'Crème défrisante',
    'Crème coiffante',
    'Spray fixant',

    // \uD83C\uDF80 ACCESSOIRES
    'Accessoires coiffure (épingles, élastiques)',
    'Bonnets de nuit (satin)',
    'Foulards/Turbans',
    'Perles/Décorations tresses', // \uD83C\uDDE8\uD83C\uDDF2 Traditionnel africain

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Longueurs (mèches/extensions)
  longueurs: [
    '10-12 pouces (25-30cm)', // Court
    '14-16 pouces (35-40cm)', // Moyen
    '18-20 pouces (45-50cm)', // \uD83D\uDD25 LE PLUS COURANT
    '22-24 pouces (55-60cm)', // Long
    '26-28 pouces (65-70cm)', // Très long
    '30 pouces+ (75cm+)', // Extra long
    'Mix 3 longueurs (ex: 18/20/22)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Textures (cheveux)
  textures: [
    // \uD83C\uDF0D TEXTURES AFRICAINES (priorité)
    'Afro kinky (4C)', // \uD83C\uDDE8\uD83C\uDDF2 Cheveux crépus naturels
    'Kinky curly (4A/4B)', // Bouclés très serrés
    'Curly (3C)', // Bouclés moyens
    'Coily (spirales)', // En spirales

    // ✨ TEXTURES LISSES/ONDULÉES
    'Straight (lisse)',
    'Yaki straight (lisse texturé)', // \uD83D\uDD25 Imite cheveux afros détendus
    'Light yaki',
    'Italian yaki',

    // \uD83C\uDF0A TEXTURES ONDULÉES/WAVY
    'Body wave (ondulations douces)', // \uD83D\uDD25 Très populaire
    'Deep wave (ondulations profondes)',
    'Water wave (ondulations naturelles)',
    'Loose wave',
    'Beach wave',

    // \uD83D\uDCAB TEXTURES BOUCLÉES
    'Curly (bouclée)',
    'Deep curly (très bouclée)',
    'Kinky curly (afro bouclée)',
    'Jerry curly (bouclée serrée)',
    'Spiral curly',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types de pose/installation
  typesPose: [
    // \uD83D\uDD25 MÉTHODES POPULAIRES AFRIQUE
    'Tissage cousu (sew-in)', // \uD83C\uDDE8\uD83C\uDDF2 Méthode traditionnelle
    'Tresse africaine (crochet)', // \uD83D\uDD25 Très utilisé
    'Clip-in (amovible)', // Facile, réutilisable
    'Bonding (colle)', // Semi-permanent
    'Micro-links/anneaux',
    'Lace closure (collage/couture)',
    'Lace frontal (collage)',
    'U-part (clip + couture)',
    'Perruque lace front',
    'Perruque full lace',
    'Quick weave (colle sur bonnet)',
    'Crochet braids',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types de cheveux (matière)
  typesCheveux: [
    // \uD83C\uDF1F CHEVEUX NATURELS (premium)
    'Virgin hair (vierge 100%)', // \uD83D\uDD25 Jamais traités
    'Remy hair (cuticules alignées)', // Qualité supérieure
    'Brazilian hair (brésilien)', // \uD83D\uDD25 LE PLUS DEMANDÉ Cameroun
    'Peruvian hair (péruvien)', // Épais, résistant
    'Indian hair (indien)', // Doux, brillant
    'Malaysian hair (malaisien)', // Polyvalent
    'Cambodian hair (cambodgien)', // Naturel, léger
    'Mongolian hair (mongol)', // Épais
    'European hair (européen)', // Lisse naturel

    // \uD83C\uDFA8 CHEVEUX SYNTHÉTIQUES (économiques)
    'Cheveux synthétiques premium', // \uD83C\uDDE8\uD83C\uDDF2 Très populaire (prix accessible)
    'Cheveux synthétiques résistants chaleur',
    'Kanekalon (tresses africaines)', // \uD83D\uDD25 INDISPENSABLE tresses
    'X-pression (tresses)', // Marque populaire
    'Toyokalon',

    // \uD83C\uDF08 MIXTES
    'Cheveux mixtes (naturel + synthétique)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Densités (perruques/closures)
  densites: [
    '130% (naturelle légère)',
    '150% (naturelle moyenne)', // \uD83D\uDD25 Standard
    '180% (volumineuse)',
    '200% (très volumineuse)',
    '250% (ultra volumineuse)',
    '300%+',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Couleurs
  couleurs: [
    // \uD83C\uDF0D COULEURS NATURELLES (priorité Afrique)
    'Noir naturel (1B)', // \uD83D\uDD25 LE PLUS DEMANDÉ Cameroun
    'Noir pur (Jet black 1)',
    'Brun très foncé (2)',
    'Brun foncé (4)',
    'Brun moyen (6)',

    // ✨ COULEURS POPULAIRES
    'Brun clair (8)',
    'Châtain (10)',
    'Blond foncé (12)',
    'Blond moyen (14)',
    'Blond clair (16)',
    'Blond platine (613)', // Très demandé

    // \uD83C\uDFA8 COULEURS TENDANCE
    'Ombré noir/brun',
    'Ombré noir/blond',
    'Balayage caramel',
    'Balayage miel',
    'Highlights/Mèches',
    'Roux/Auburn',
    'Bordeaux/Vin',
    'Gris/Argenté',

    // \uD83C\uDF08 COULEURS FANTAISIE
    'Bleu',
    'Violet/Mauve',
    'Rouge',
    'Rose',
    'Vert',
    'Multi-couleurs',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Origines des cheveux naturels
  origines: [
    // \uD83D\uDD25 TOP 3 PLUS POPULAIRES CAMEROUN
    'Brésilien', // #1 - Polyvalent, soyeux
    'Péruvien', // #2 - Épais, volume
    'Indien', // #3 - Doux, brillant

    // \uD83C\uDF0D AUTRES ORIGINES POPULAIRES
    'Malaisien',
    'Cambodgien',
    'Vietnamien',
    'Mongol',
    'Européen',
    'Russe',
    'Birman',

    // \uD83C\uDFA8 SYNTHÉTIQUE
    'Synthétique (Kanekalon)',
    'Synthétique (X-pression)',
    'Synthétique (autre)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Marques populaires (produits capillaires Afrique)
  marques: [
    // \uD83C\uDF0D MARQUES AFRICAINES
    'Darling (Nigeria)', // \uD83C\uDDE8\uD83C\uDDF2 Très populaire Cameroun
    'Noble Hair (Nigeria)',
    'X-pression (tresses)',
    'Kanekalon',
    'Magic Collection',

    // \uD83C\uDF1F MARQUES INTERNATIONALES POPULAIRES AFRIQUE
    'Dark & Lovely', // Défrisants
    'SoftSheen Carson',
    'Olive Oil (ORS)',
    'Africa\'s Best',
    'Cantu', // \uD83D\uDD25 Produits cheveux crépus
    'Shea Moisture', // Huiles naturelles
    'Creme of Nature',
    'TCB',
    'Pink (Luster)',
    'Mizani',
    'Motions',

    // \uD83D\uDC8E MARQUES PREMIUM
    'Sensationnel',
    'Outre',
    'Freetress',
    'Bobbi Boss',
    'Shake-N-Go',

    // \uD83E\uDDF4 PRODUITS NATURELS AFRICAINS
    'Beurre de karité pur', // \uD83C\uDDE8\uD83C\uDDF2 Produit local
    'Huile de coco',
    'Huile d\'argan',
    'Huile de ricin noir jamaïcain',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types de salons/établissements
  typesSalon: [
    // \uD83D\uDC87‍♀️ COIFFURE FEMME
    'Salon de coiffure mixte', // Homme + Femme
    'Salon de coiffure femme uniquement',
    'Salon spécialisé tresses africaines', // \uD83C\uDDE8\uD83C\uDDF2 Très courant
    'Salon spécialisé tissages/extensions',
    'Salon spécialisé défrisage',
    'Coiffure à domicile', // \uD83D\uDD25 Service populaire Cameroun

    // \uD83E\uDDD4 BARBIER HOMME
    'Salon de barbier (homme)', // \uD83D\uDD25 Très nombreux Cameroun
    'Barbershop moderne',
    'Barbier traditionnel',
    'Barbier à domicile',

    // \uD83D\uDC85 BEAUTÉ & ESTHÉTIQUE
    'Institut de beauté complet',
    'Salon manucure/pédicure',
    'Centre esthétique',
    'Spa beauté',

    // \uD83D\uDED2 BOUTIQUES
    'Boutique mèches/extensions',
    'Boutique produits capillaires',
    'Magasin professionnel coiffure',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Services proposés (salons)
  servicesProposed: [
    // \uD83D\uDC87‍♀️ COIFFURE FEMME
    'Tresses africaines (box braids, nattes)', // \uD83C\uDDE8\uD83C\uDDF2
    'Tissages/Extensions',
    'Défrisage',
    'Lissage brésilien',
    'Coloration',
    'Coupes femme',
    'Brushing/Mise en plis',
    'Coiffures mariée',
    'Locks/Dreadlocks',

    // \uD83E\uDDD4 COIFFURE HOMME
    'Coupes homme (dégradé, fade)', // \uD83C\uDDE8\uD83C\uDDF2
    'Taille de barbe',
    'Rasage',
    'Design capillaire',

    // \uD83D\uDC85 BEAUTÉ
    'Manucure/Pédicure',
    'Pose faux ongles',
    'Maquillage',
    'Soins visage',
    'Épilation',
    'Massage',

    // \uD83C\uDF93 FORMATION
    'Formation coiffure',
    'Formation tressage',
    'Formation maquillage',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Durée de vie (produits)
  dureeVie: [
    '1-2 mois (synthétique tresses)',
    '2-3 mois (synthétique qualité)',
    '3-6 mois (naturel entretien moyen)', // \uD83D\uDD25 Standard
    '6-12 mois (naturel bien entretenu)',
    '1-2 ans (virgin hair premium)',
    '2+ ans (excellents soins)',
    'Réutilisable (clips)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Durées (services en salon)
  durees: [
    // ⏱️ SERVICES RAPIDES
    '15-30 minutes (taille barbe, brushing)',
    '30-45 minutes (coupe homme)',
    '45 minutes-1h (coupe femme, manucure)',

    // ⏱️ SERVICES MOYENS
    '1-2 heures (coloration, tissage simple)',
    '2-3 heures (défrisage, lissage)',

    // ⏱️ SERVICES LONGS
    '3-4 heures (tresses courtes)',
    '4-6 heures (tresses moyennes)', // \uD83D\uDD25 Box braids standard
    '6-8 heures (tresses longues)',
    '8-10 heures (tresses extra longues)',
    '10+ heures (tresses très élaborées)',

    // \uD83D\uDCC5 AUTRES
    'Sur devis (selon longueur/complexité)',
    'À définir',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types de cheveux client (pour services)
  typeCheveuxClient: [
    'Cheveux crépus (4C)', // \uD83C\uDDE8\uD83C\uDDF2 Majoritaire Afrique
    'Cheveux frisés (4A/4B)',
    'Cheveux bouclés (3A/3B/3C)',
    'Cheveux ondulés (2A/2B/2C)',
    'Cheveux lisses (1A/1B/1C)',
    'Cheveux défrisés',
    'Cheveux mixtes',
    'Tous types',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Spécialités du salon/coiffeur
  specialites: [
    // \uD83C\uDF0D COIFFURE AFRICAINE
    'Tresses africaines expert', // \uD83C\uDDE8\uD83C\uDDF2
    'Nattes collées (cornrows)',
    'Locks/Dreadlocks',
    'Tissages/Extensions',
    'Défrisage professionnel',

    // ✨ TECHNIQUES MODERNES
    'Lissage brésilien/japonais',
    'Coloration tendance',
    'Balayage/Mèches',
    'Coupes modernes',

    // \uD83E\uDDD4 BARBIER
    'Dégradé américain (fade)',
    'Design capillaire (motifs)',
    'Barbe professionnelle',

    // \uD83D\uDC76 AUTRES
    'Coiffure enfants',
    'Mariée/Événements',
    'Cheveux crépus spécialiste',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Niveau de prix (indication)
  niveauxPrix: [
    '€ Économique (moins de 5000 XAF)',
    '€€ Standard (5000-15000 XAF)',
    '€€€ Moyen standing (15000-30000 XAF)',
    '€€€€ Haut de gamme (30000-50000 XAF)',
    '€€€€€ Luxe (50000 XAF+)',
    'Sur devis',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Modes de paiement acceptés
  paiements: [
    'Espèces',
    'Mobile Money (MTN/Orange)', // \uD83C\uDDE8\uD83C\uDDF2 TRÈS IMPORTANT
    'Carte bancaire',
    'Virement bancaire',
    'Paiement échelonné (facilités)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Jours d'ouverture
  joursOuverture: [
    'Lundi-Samedi',
    'Lundi-Dimanche (7j/7)',
    'Mardi-Dimanche',
    'Sur rendez-vous uniquement',
    'Tous les jours sauf dimanche',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Horaires
  horaires: [
    '8h-18h',
    '9h-19h',
    '10h-20h',
    '8h-20h',
    'Horaires flexibles',
    'Sur rendez-vous',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS COUTURIER - \uD83C\uDF0D CONTEXTE AFRIQUE FRANCOPHONE (Cameroun focus)
export const COUTURIER_MODALITIES: ModalityCategory = {
  // ✅ Types de prestations/services
  types: [
    // \uD83E\uDEA1 CONFECTION SUR MESURE (core business)
    '\uD83C\uDF1F Robe sur mesure', // \uD83C\uDDE8\uD83C\uDDF2 TRÈS DEMANDÉ
    '\uD83C\uDF1F Costume/Tailleur sur mesure',
    '\uD83C\uDF1F Boubou/Kaftan sur mesure', // \uD83C\uDDE8\uD83C\uDDF2 INCONTOURNABLE Afrique
    'Robe de soirée sur mesure',
    'Robe de mariée complète', // \uD83C\uDDE8\uD83C\uDDF2 Service premium
    'Robe cocktail sur mesure',
    'Ensemble pagne complet', // \uD83C\uDDE8\uD83C\uDDF2 Très populaire femmes
    'Chemise/Chemisier sur mesure',
    'Pantalon/Jupe sur mesure',
    'Veste/Blazer sur mesure',
    'Manteau/Pardessus sur mesure',
    'Combinaison sur mesure',

    // \uD83D\uDC54 TENUES AFRICAINES TRADITIONNELLES (spécialité locale)
    '\uD83C\uDF1F Boubou grand bazin', // \uD83C\uDDF2\uD83C\uDDF1 Mali, très demandé
    '\uD83C\uDF1F Agbada (3 pièces)', // \uD83C\uDDF3\uD83C\uDDEC Nigeria, populaire
    'Dashiki sur mesure', // \uD83C\uDF0D Pan-africain
    'Kaftan brodé',
    'Kaba & Slit (Ghana)', // \uD83C\uDDEC\uD83C\uDDED Style ghanéen
    'Wrapper & Blouse (Nigeria)',
    'Gandoura/Djellaba',
    'Ensemble wax complet',
    'Tenue pagne 2 pièces',
    'Tenue pagne 3 pièces',
    'Robe pagne longue',
    'Robe africaine moderne',

    // \uD83D\uDC76 ENFANTS & BÉBÉS
    'Robe enfant sur mesure',
    'Costume enfant sur mesure',
    'Tenue africaine enfant',
    'Vêtements bébé sur mesure',
    'Tenue baptême/cérémonie',

    // \uD83C\uDFAD ÉVÉNEMENTS SPÉCIAUX
    '\uD83C\uDF1F Tenue mariage complète (mariée)', // \uD83C\uDDE8\uD83C\uDDF2 Service premium
    '\uD83C\uDF1F Tenue mariage complet (marié)',
    'Robe demoiselle d\'honneur',
    'Tenue cortège mariage',
    'Tenue dot/mariage traditionnel', // \uD83C\uDDE8\uD83C\uDDF2 Cérémonie traditionnelle
    'Costume cérémonie',
    'Tenue baptême',
    'Tenue communion',

    // ✂️ RETOUCHES & MODIFICATIONS
    'Retouche simple (ourlet, taille)',
    'Retouche complexe (transformation)',
    'Ajustement taille/longueur',
    'Raccourcir/Rallonger',
    'Élargir/Rétrécir',
    'Changement de fermeture éclair',
    'Réparation déchirure',
    'Remplacement doublure',

    // \uD83C\uDFA8 BRODERIE & DÉCORATIONS
    'Broderie main traditionnelle', // \uD83C\uDDE8\uD83C\uDDF2 Artisanat local
    'Broderie machine',
    'Broderie perles', // \uD83C\uDDE8\uD83C\uDDF2 Très prisé
    'Broderie fil d\'or/argent',
    'Application motifs/patchs',
    'Customisation vêtement',

    // \uD83C\uDFE0 AMEUBLEMENT TEXTILE
    'Rideaux sur mesure',
    'Coussins décoratifs',
    'Housse canapé/fauteuil',
    'Nappes & sets de table',
    'Linge de maison',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types de vêtements (catégories)
  categories: [
    // Femme
    'Robe', 'Jupe', 'Chemisier', 'Pantalon femme', 'Tailleur femme',
    'Combinaison', 'Ensemble', 'Manteau/Veste',
    // Homme
    'Chemise', 'Pantalon homme', 'Costume', 'Veste/Blazer', 'Gilet',
    // Africain
    'Boubou', 'Kaftan', 'Agbada', 'Dashiki', 'Gandoura', 'Ensemble pagne',
    // Événements
    'Robe de mariée', 'Costume marié', 'Tenue soirée',
    // Enfant
    'Vêtement enfant', 'Vêtement bébé',
    // Autres
    'Ameublement', 'Accessoires',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Tissus (matières) - CRUCIAL pour l'Afrique
  tissus: [
    // \uD83C\uDF1F TISSUS AFRICAINS (les plus demandés)
    '\uD83C\uDF1F Bazin riche (brodé)', // \uD83C\uDDF2\uD83C\uDDF1 PREMIUM Mali
    '\uD83C\uDF1F Bazin riche (uni)', // Plus accessible
    '\uD83C\uDF1F Wax hollandais (Vlisco)', // \uD83C\uDDE8\uD83C\uDDF2 Référence qualité
    '\uD83C\uDF1F Super wax (premium)',
    'Wax classique',
    'Fancy print (java)',
    'Pagne traditionnel',
    'Kente (Ghana)', // \uD83C\uDDEC\uD83C\uDDED Tissu royal
    'Bogolan (Mali)', // \uD83C\uDDF2\uD83C\uDDF1 Tissu traditionnel
    'Akwete (Nigeria)',
    'Aso-oke (Nigeria)',
    'Woodin',
    'ABC Wax',
    'GTP',
    'Uniwax',

    // \uD83C\uDFA8 TISSUS MODERNES AFRICAINS
    'Wax moderne imprimé',
    'Ankara (imprimé africain)',
    'Kitenge',
    'Kanga',
    'Dashiki fabric',

    // \uD83D\uDC54 TISSUS CLASSIQUES/OCCIDENTAUX
    'Coton',
    'Coton peigné',
    'Popeline',
    'Lin',
    'Soie',
    'Soie sauvage',
    'Satin',
    'Dentelle',
    'Dentelle guipure',
    'Dentelle française',
    'Tulle',
    'Organza',
    'Taffetas',
    'Velours',
    'Velours côtelé',
    'Crêpe',
    'Mousseline',
    'Chiffon',

    // \uD83E\uDDF5 TISSUS FORMELS
    'Laine',
    'Laine peignée',
    'Cachemire',
    'Tweed',
    'Flanelle',
    'Gabardine',

    // \uD83D\uDC56 TISSUS CASUAL
    'Denim/Jean',
    'Jersey',
    'Chambray',
    'Viscose',
    'Polyester',
    'Mélange coton-polyester',

    // \uD83C\uDF1F TISSUS SPÉCIAUX
    'Broderie anglaise',
    'Jacquard',
    'Brocart',
    'Damassé',
    'Sequins/Paillettes',
    'Tissu métallisé',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Styles de couture
  styles: [
    // Africain
    '\uD83C\uDF1F Traditionnel africain',
    '\uD83C\uDF1F Afro-fusion (moderne)', // \uD83C\uDDE8\uD83C\uDDF2 Tendance actuelle
    'Wax moderne chic',
    'Pagne élégant',
    'Ankara fashion',

    // Occidental
    'Classique',
    'Moderne',
    'Chic/Élégant',
    'Casual',
    'Formel',
    'Business',
    'Soirée/Glamour',
    'Bohème',
    'Vintage',
    'Minimaliste',

    // Spéciaux
    'Sur mesure haut de gamme',
    'Haute couture',
    'Prêt-à-porter luxe',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Genres
  genres: [
    'Femme', 'Homme', 'Enfant (fille)', 'Enfant (garçon)',
    'Bébé', 'Unisexe', 'Couple assorti', 'Famille assortie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Occasions/Événements
  occasions: [
    // Mariages
    '\uD83C\uDF1F Mariage (mariée)',
    '\uD83C\uDF1F Mariage (marié)',
    'Mariage traditionnel',
    'Dot (cérémonie)',
    'Demoiselle d\'honneur',
    'Invité mariage',

    // Événements
    'Soirée/Gala',
    'Cocktail',
    'Cérémonie officielle',
    'Baptême',
    'Communion',
    'Anniversaire',
    'Fête traditionnelle',

    // Quotidien
    'Travail/Bureau',
    'Quotidien/Casual',
    'Sport/Loisirs',
    'Église/Mosquée',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Délais de confection
  delais: [
    '⚡ Express (24-48h)', // \uD83C\uDDE8\uD83C\uDDF2 Très demandé pour événements urgents
    'Rapide (3-5 jours)',
    'Standard (1-2 semaines)',
    'Normal (2-3 semaines)',
    'Sur-mesure complet (3-4 semaines)',
    'Robe de mariée (4-8 semaines)',
    'À convenir',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Services inclus
  servicesInclus: [
    'Prise de mesures',
    'Conseil style/modèle',
    'Choix tissu assisté',
    'Croquis/Dessin modèle',
    'Essayage (1 fois)',
    'Essayages multiples (2-3)',
    'Retouches incluses',
    'Livraison à domicile',
    'Urgence acceptée',
    'Conseils entretien',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Tailles (systèmes multiples Afrique)
  tailles: [
    // Tailles lettres
    'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL', '6XL',
    // Tailles françaises femme
    '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60',
    // Tailles homme (tour de taille)
    '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60', '62', '64',
    // Enfants (âge)
    '2 ans', '4 ans', '6 ans', '8 ans', '10 ans', '12 ans', '14 ans', '16 ans',
    // Bébés (mois)
    '0-3 mois', '3-6 mois', '6-12 mois', '12-18 mois', '18-24 mois',
    // Sur mesure
    'Sur mesure (prise de mesures)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Niveau de finition
  finitions: [
    '\uD83C\uDF1F Haute couture',
    'Finition soignée (premium)',
    'Finition standard',
    'Finition simple',
    'Avec doublure complète',
    'Sans doublure',
    'Broderie main',
    'Broderie machine',
    'Perles/Ornements',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Couleurs principales (mêmes que vêtements + wax)
  couleurs: [
    'Blanc', 'Blanc cassé', 'Écru', 'Beige', 'Noir', 'Gris', 'Gris foncé',
    'Rouge', 'Bordeaux', 'Rose', 'Fuchsia', 'Corail',
    'Bleu', 'Bleu marine', 'Bleu ciel', 'Bleu roi', 'Turquoise',
    'Vert', 'Vert olive', 'Vert émeraude', 'Kaki',
    'Jaune', 'Jaune moutarde', 'Doré', 'Orange',
    'Marron', 'Camel', 'Chocolat',
    'Violet', 'Mauve', 'Prune', 'Aubergine',
    // Africain
    '\uD83C\uDF1F Multicolore (wax/pagne)',
    'Imprimé africain',
    'Bazin teint',
    'Doré/Argenté (broderie)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Expérience du couturier
  experiences: [
    'Couturier débutant (1-2 ans)',
    'Couturier confirmé (3-5 ans)',
    'Couturier expérimenté (5-10 ans)',
    'Maître couturier (10+ ans)',
    'Atelier professionnel',
    'Haute couture',
    'Diplômé école mode',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Spécialités du couturier
  specialites: [
    // Vêtements
    'Spécialiste robes',
    'Spécialiste costumes homme',
    'Spécialiste robes de mariée',
    'Spécialiste vêtements enfants',

    // Africain
    '\uD83C\uDF1F Spécialiste tenues africaines',
    '\uD83C\uDF1F Spécialiste bazin',
    'Spécialiste wax/pagne',
    'Spécialiste boubou',
    'Spécialiste agbada',

    // Techniques
    'Spécialiste broderie',
    'Spécialiste retouches',
    'Spécialiste ameublement',
    'Couturier polyvalent',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Prix/Tarification
  tarifications: [
    'À la pièce',
    'Forfait complet',
    'Au mètre de tissu',
    'Selon modèle',
    'Sur devis uniquement',
    'Acompte requis (30-50%)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Modes de paiement
  paiements: [
    'Espèces',
    '\uD83C\uDF1F Mobile Money (MTN/Orange)', // \uD83C\uDDE8\uD83C\uDDF2 ESSENTIEL
    'Carte bancaire',
    'Virement bancaire',
    'Paiement échelonné (2-3 fois)',
    'Acompte + Solde livraison',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Zones d'intervention (reprend le système général)
  zones_intervention: genererZonesIntervention('CM'),

  // ✅ Lieu de travail
  lieuxTravail: [
    'Atelier professionnel',
    'Domicile (atelier maison)',
    'Marché/Centre commercial',
    'À domicile client (déplacement)',
    'Mobile (sur rendez-vous)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Jours de travail
  joursOuverture: [
    'Lundi-Samedi',
    'Lundi-Dimanche (7j/7)',
    'Sur rendez-vous uniquement',
    'Du mardi au dimanche',
    'Jours ouvrables uniquement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Horaires
  horaires: [
    '8h-18h',
    '9h-19h',
    '10h-20h',
    'Horaires flexibles',
    'Sur rendez-vous',
    'Disponible week-end',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Équipements/Machines
  equipements: [
    'Machine à coudre professionnelle',
    'Machine à broder',
    'Surjeteuse',
    'Recouvreuse',
    'Machine piqueuse',
    'Fer à repasser professionnel',
    'Table de coupe',
    'Mannequin de couture',
    'Équipement complet atelier',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ FONCTION GÉNÉRATION MODALITÉS DÉMÉNAGEMENT - SYSTÈME INTELLIGENT
// Cette fonction génère dynamiquement les modalités selon le pays de l'utilisateur
export const getDemenagementModalities = (codePaysUtilisateur: string = 'CM'): ModalityCategory => {
  // Utiliser le système intelligent de localisation africaine
  const villes = genererToutesLesVilles(codePaysUtilisateur);
  const quartiers = genererQuartiersPays(codePaysUtilisateur);
  const zonesIntervention = genererZonesIntervention(codePaysUtilisateur);

  return {
    // Types de déménagement
    types: [
      'Déménagement local (même ville)',
      'Déménagement intercommunal',
      'Déménagement régional',
      'Déménagement national',
      'Déménagement international',
      'Déménagement bureau/entreprise',
      'Déménagement express (24-48h)',
      'Déménagement partiel',
      'Garde-meubles sécurisé',
      'Déménagement de studio étudiant',
      'Déménagement de villa/immeuble',
      'Déménagement économique',
      'Déménagement VIP/premium',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // ✅ Villes d'Afrique francophone (système intelligent)
    villes: villes,

    // ✅ Quartiers (système intelligent selon le pays)
    quartiers: quartiers,

    // ✅ Zones d'intervention (système intelligent)
    zones_intervention: zonesIntervention,

    // Services inclus
    services: [
      'Emballage professionnel',
      'Transport sécurisé',
      'Déballage et installation',
      'Montage meubles',
      'Démontage meubles',
      'Nettoyage fin de chantier',
      'Nettoyage nouveau logement',
      'Assurance tous risques',
      'Assurance de base',
      'Cartons et fournitures inclus',
      'Monte-meubles avec grue',
      'Piano/objets lourds/spéciaux',
      'Climatisation démontée/remontée',
      'Armoire incorporée décrochée',
      'Protection sols et murs',
      'Évaluation gratuite',
      'Inventaire détaillé',
      '\uD83D\uDCE6 Stockage temporaire',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // Types de véhicules
    vehicules: [
      'Camionnette 10m³ (petit déménagement)',
      'Camionnette 15m³',
      'Camionnette 20m³',
      'Fourgon 12m³',
      'Fourgon 20m³',
      'Camion 25m³',
      'Camion 30m³',
      'Camion 40m³',
      'Camion 60m³',
      'Camion 4x4 (routes difficiles)',
      'Remorque pour véhicule personnel',
      'Plusieurs véhicules (fleet)',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // Volumes approximatifs
    volumes: [
      'Chambre simple/Studio (10-15m³)',
      'F1/1 pièce (15-20m³)',
      'F2/2 pièces (20-30m³)',
      'F3/3 pièces (30-40m³)',
      'F4/4 pièces (40-50m³)',
      'F5/5 pièces (50-60m³)',
      'F6/6 pièces (60-80m³)',
      'Villa/T6+ (80m³+)',
      'Bureau petit (< 20m³)',
      'Bureau moyen (30-50m³)',
      'Bureau grand (60-100m³)',
      'Entreprise/Immeuble (100m³+)',
      'Déménagement partiel',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // Distances
    distances: [
      'Même quartier (< 5 km)',
      'Ville proche (5-20 km)',
      'Intercommunal (20-50 km)',
      'Régional (50-150 km)',
      'Longue distance (150-500 km)',
      'Très longue distance (500-1000 km)',
      'National (> 1000 km)',
      'International (Europe/Amérique)',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // Compagnies de déménagement (par pays)
    compagnies: [
      // \uD83C\uDDE8\uD83C\uDDF2 CAMEROUN
      'Africa Déménagement Services',
      'Camtrans Déménagement',
      'Express Déménagement Cameroun',
      'Global Moving Cameroun',
      'Move Masters Cameroun',
      'Pro Déménagement Cameroun',
      'Yukpo Moving',
      'Eko Déménagement',

      // \uD83C\uDDE8\uD83C\uDDEE CÔTE D'IVOIRE
      'Abidjan Transports Express',
      'Yopougon Déménagement',
      'Cocody Moving Services',
      'Plateau Transports',
      'San-Pédro Déménagement',

      // \uD83C\uDDF8\uD83C\uDDF3 SÉNÉGAL
      'Dakar Transports Rapides',
      'Pikine Déménagement',
      'Thiès Moving Express',
      'Rufisque Transports',
      'Saint-Louis Moving',

      // \uD83C\uDDF2\uD83C\uDDF1 MALI
      'Bamako Transports Express',
      'Sikasso Moving Services',
      'Gao Transports',
      'Ségou Déménagement',
      'Tombouctou Moving',

      // \uD83C\uDDEC\uD83C\uDDE6 GABON
      'Libreville Moving Express',
      'Port-Gentil Transports',
      'Franceville Déménagement',

      // \uD83C\uDDE8\uD83C\uDDEC CONGO
      'Brazzaville Moving Services',
      'Pointe-Noire Transports',
      'Congo Transports Express',

      // \uD83C\uDDE8\uD83C\uDDE9 RDC
      'Kinshasa Moving Express',
      'Lubumbashi Transports',
      'Goma Déménagement',
      'Bukavu Moving',

      // \uD83C\uDDF2\uD83C\uDDEC MADAGASCAR
      'Antananarivo Moving',
      'Toamasina Transports',
      'Antsirabe Moving Express',

      // \uD83C\uDDF3\uD83C\uDDEA NIGER
      'Niamey Transports',
      'Zinder Moving',

      // \uD83C\uDDE7\uD83C\uDDEB BURKINA FASO
      'Ouagadougou Moving',
      'Bobo-Dioulasso Transports',

      // \uD83C\uDDF9\uD83C\uDDEC TOGO
      'Lomé Moving Express',
      'Kara Transports',

      // \uD83C\uDDE7\uD83C\uDDEF BÉNIN
      'Cotonou Moving',
      'Porto-Novo Transports',

      // \uD83C\uDDEC\uD83C\uDDF3 GUINÉE
      'Conakry Moving',
      'Kankan Transports',

      // \uD83C\uDFE2 INTERNATIONAL/GÉNÉRIQUES
      'Déménageur indépendant certifié',
      'Entreprise familiale agréée',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // Durées estimées
    durees: [
      'Moins de 2h (express)',
      '2-4 heures',
      '4-6 heures',
      '1 journée complète',
      '2-3 jours',
      '1 semaine (stockage inclus)',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // Disponibilités
    disponibilites: [
      'Immédiat (24-48h)',
      'Cette semaine',
      'Semaine prochaine',
      'Ce mois-ci',
      'Flexible (à planifier)',
      'Urgent (le jour même)',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // Nombre de déménageurs
    nb_demenageurs: [
      '1 déménageur',
      '2 déménageurs',
      '3 déménageurs',
      '4-5 déménageurs',
      '6+ déménageurs (grande équipe)',
      'Équipe variable selon besoin',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // Types d'assurance (alias de garanties)
    assurances: [
      'Assurance tous risques (valeur complète)',
      'Assurance de base (responsabilité civile)',
      'Assurance objets de valeur renforcée',
      'Garantie casse/dommages',
      'Garantie vol/détérioration',
      'Sans assurance (déménagement à vos risques)',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // Garanties et assurances (alias pour compatibilité)
    garanties: [
      'Assurance tous risques (valeur complète)',
      'Assurance de base (responsabilité civile)',
      'Assurance objets de valeur renforcée',
      'Garantie casse/dommages',
      'Garantie vol/détérioration',
      'Sans assurance (déménagement à vos risques)',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // Accessibilité / Étages
    accessibilites: [
      'Rez-de-chaussée',
      '1er étage sans ascenseur',
      '2ème étage sans ascenseur',
      '3ème étage et + sans ascenseur',
      'Avec ascenseur',
      'Villa/Maison (étages)',
      'Sous-sol',
      'Accès difficile (escaliers étroits)',
      'Accès facile (parking proche)',
      '\uD83C\uDD95 Autre (ajouter)'
    ],

    // États des routes
    etat_routes: [
      'Routes bitumées (excellentes)',
      'Routes bitumées normales',
      'Routes latéritiques',
      'Routes en terre (difficiles)',
      'Pistes (4x4 requis)',
      'Tous types de routes',
      '\uD83C\uDD95 Autre (ajouter)'
    ]
  };
};

// ✅ MODALITÉS DÉMÉNAGEMENT - VERSION STATIQUE (pour compatibilité)
// Par défaut, utilise le Cameroun comme pays prioritaire
export const DEMENAGEMENT_MODALITIES: ModalityCategory = getDemenagementModalities('CM');


// ✅ MODALITÉS JOUETS & ARTICLES ENFANTS - REFONTE COMPLÈTE CONTEXTE AFRIQUE
export const JOUETS_ENFANTS_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE JOUETS (35+) - Enrichi avec jouets africains
  types_jouets: [
    // Éveil & Bébé
    'Hochet', 'Mobile musical', 'Tapis d\'éveil', 'Portique d\'éveil',
    'Jouet de bain', 'Doudou', 'Anneau de dentition',
    // Peluches
    'Peluche', 'Peluche interactive', 'Peluche géante', 'Marionnette',
    // Éducatif & Apprentissage
    'Jouet éducatif', 'Jeu d\'apprentissage', 'Tablette éducative',
    'Livre interactif', 'Alphabet/Chiffres', 'Globe terrestre',
    // Construction & Créativité
    'Briques de construction', 'LEGO', 'Blocs en bois', 'Magnétique',
    'Pâte à modeler', 'Kit de bricolage', 'Perles à repasser',
    // Jeux de société
    'Jeu de société', 'Puzzle', 'Jeu de cartes', 'Dominos', 'Échecs',
    // Figurines & Poupées
    'Poupée', 'Figurine', 'Maison de poupée', 'Accessoires poupée',
    'Action figure', 'Miniature',
    // Véhicules
    'Voiture miniature', 'Camion', 'Train', 'Avion', 'Circuit',
    'Véhicule télécommandé', 'Garage jouet',
    // Sport & Plein air
    'Ballon', 'Vélo enfant', 'Trottinette', 'Roller', 'Corde à sauter',
    'Frisbee', 'Cerf-volant', 'Piscine gonflable',
    // Musique
    'Instrument de musique', 'Piano jouet', 'Tambour', 'Xylophone',
    'Guitare jouet', 'Microphone',
    // Électronique & Multimédia
    'Tablette enfant', 'Console de jeu', 'Jeu vidéo', 'Robot programmable',
    'Drone enfant', 'Appareil photo enfant',
    // Déguisement & Imitation
    'Déguisement', 'Cuisine jouet', 'Docteur jouet', 'Outils jouet',
    'Supermarché jouet', 'Garage jouet',
    // Jouets traditionnels africains
    'Djembé enfant', 'Tam-tam miniature', 'Masque africain décoratif',
    'Figurine artisanale', 'Jeu traditionnel (Awalé, etc.)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TRANCHES D'ÂGE DÉTAILLÉES (12) - Précis pour sécurité
  ages_recommandes: [
    '0-6 mois (Nouveau-né)', '6-12 mois (Bébé)', '1-2 ans (Tout-petit)',
    '2-3 ans (Petite enfance)', '3-5 ans (Préscolaire)', '5-7 ans (Maternelle/CP)',
    '7-9 ans (Primaire)', '9-12 ans (Préadolescent)', '12-15 ans (Adolescent)',
    '15+ ans (Jeune adulte)', 'Tous âges', '0-3 ans (avec surveillance)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES (30+) - Internationales + accessibles en Afrique
  marques: [
    // Leaders mondiaux
    'LEGO', 'Hasbro', 'Mattel', 'Fisher-Price', 'Ravensburger',
    'VTech', 'Playmobil', 'Barbie', 'Hot Wheels', 'Nerf',
    // Jouets éducatifs
    'Leap Frog', 'Clementoni', 'Janod', 'Djeco', 'Hape',
    // Peluches
    'Jellycat', 'Steiff', 'TY', 'Build-A-Bear',
    // Gaming
    'Nintendo', 'PlayStation', 'Xbox', 'Pokémon',
    // Bébé/Éveil
    'Chicco', 'Sophie la Girafe', 'Vulli', 'Infantino',
    // Sport
    'Decathlon Kids', 'Smoby', 'Intex',
    // Marques locales/artisanales
    'Artisanat local', 'Fait main Cameroun', 'Made in Africa',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MATÉRIAUX (15+) - Détaillé pour sécurité
  materiaux: [
    'Plastique ABS (sans BPA)', 'Plastique standard', 'Plastique recyclé',
    'Bois massif', 'Bois certifié FSC', 'Contreplaqué',
    'Tissu coton bio', 'Tissu polyester', 'Peluche hypoallergénique',
    'Métal (non toxique)', 'Silicone alimentaire', 'Caoutchouc naturel',
    'Carton recyclé', 'Mousse EVA', 'Matériaux mixtes',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NORMES & CERTIFICATIONS (12+) - Sécurité enfants
  normes_securite: [
    'CE (Conformité Européenne)', 'EN71 (Norme jouets EU)',
    'ASTM F963 (Norme US)', 'ISO 8124 (Norme internationale)',
    'NF (Norme Française)', 'GS (Geprüfte Sicherheit)',
    'Sans phtalates', 'Sans BPA', 'Sans plomb',
    'Non toxique certifié', 'Hypoallergénique', 'Ignifugé',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CATÉGORIES ÉDUCATIVES (18+) - Développement enfant
  categories_educatives: [
    'Motricité fine', 'Motricité globale', 'Coordination œil-main',
    'Éveil sensoriel', 'Éveil musical', 'Éveil artistique',
    'Logique & Réflexion', 'Mémoire & Concentration',
    'Mathématiques & Calcul', 'Lecture & Écriture', 'Langues étrangères',
    'Sciences & Découverte', 'Géographie & Culture',
    'Créativité & Imagination', 'Sociabilité & Partage',
    'Autonomie & Responsabilité', 'Jeu libre', 'Jeu imitatif',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GENRE (5)
  genre: [
    'Mixte/Unisexe', 'Plutôt fille', 'Plutôt garçon',
    'Neutre', 'Pour tous',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTAT DU PRODUIT (8)
  etat: [
    'Neuf (emballé)', 'Neuf (déballé)', 'Comme neuf',
    'Très bon état', 'Bon état', 'État moyen',
    'Occasion (à vérifier)', 'Reconditionné',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FONCTIONNALITÉS (15+) - Caractéristiques techniques
  fonctionnalites: [
    'Sons & Musique', 'Lumières LED', 'Sons + Lumières',
    'Interactif (réactions)', 'Éducatif parlant (voix)',
    'Télécommandé', 'Programmable', 'Connecté (Bluetooth/WiFi)',
    'Réalité augmentée (AR)', 'Enregistrement vocal',
    'Capteurs de mouvement', 'Évolutif (plusieurs niveaux)',
    'Lavable en machine', 'Résistant à l\'eau', 'Pliable/Portable',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ALIMENTATION/ÉNERGIE (10)
  alimentation: [
    'Manuel (sans pile)', 'Piles AA incluses', 'Piles AAA incluses',
    'Piles (non incluses)', 'Batterie rechargeable (USB)',
    'Batterie rechargeable (secteur)', 'Solaire',
    'Mécanique (à remonter)', 'Hybride (piles + manuel)',
    'Secteur 220V',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ COULEURS PRINCIPALES (15+) - Multi-sélection
  couleurs: [
    'Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange', 'Rose', 'Violet',
    'Noir', 'Blanc', 'Gris', 'Marron', 'Multicolore',
    'Pastel', 'Couleurs vives', 'Couleurs naturelles',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CONDITIONNEMENT (10) - Emballage
  emballage: [
    'Boîte d\'origine scellée', 'Boîte d\'origine ouverte',
    'Emballage cadeau disponible', 'Sans emballage',
    'Emballage écologique', 'Blister', 'Sachet plastique',
    'Coffret', 'Vrac', 'Recharge/Extension',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ LIEU D'UTILISATION (8)
  lieu_utilisation: [
    'Intérieur', 'Extérieur', 'Intérieur & Extérieur',
    'Piscine/Plage', 'Jardin', 'Chambre', 'Salle de jeu',
    'Voyage/Voiture',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOMBRE DE JOUEURS (8) - Pour jeux de société
  nombre_joueurs: [
    'Solo (1 joueur)', '2 joueurs', '2-4 joueurs', '3-6 joueurs',
    '4-8 joueurs', '6+ joueurs', 'Illimité', 'Multijoueur en ligne',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DURÉE DE JEU (8) - Pour jeux de société
  duree_jeu: [
    'Moins de 15 min', '15-30 min', '30 min - 1h',
    '1h - 2h', '2h et plus', 'Variable', 'Jeu infini',
    'Par manche (5-10 min)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ACCESSOIRES INCLUS (12+) - Multi-sélection
  accessoires_inclus: [
    'Notice multilingue', 'Piles incluses', 'Chargeur/Câble USB',
    'Sac de rangement', 'Tapis de jeu', 'Stickers/Autocollants',
    'Pièces de rechange', 'Guide éducatif', 'Application mobile',
    'Certificat d\'authenticité', 'Carte de garantie',
    'Aucun accessoire',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GARANTIE (8)
  garantie: [
    'Sans garantie', '3 mois', '6 mois', '1 an',
    '2 ans', '3 ans', '5 ans', 'Garantie à vie',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS USTENSILES CUISINE - REFONTE COMPLÈTE
export const USTENSILES_CUISINE_MODALITIES: ModalityCategory = {
  // ✅ NOMS DE PRODUITS (100+ ustensiles : traditionnels africains + modernes)
  noms_produits: [
    // ===== USTENSILES TRADITIONNELS AFRICAINS =====
    // \uD83C\uDF0D Pilage et broyage
    'Mortier et pilon (bois)', 'Mortier et pilon (pierre)', 'Mortier électrique',
    'Pierre à moudre', 'Meule à grain traditionnelle',

    // \uD83C\uDFFA Récipients traditionnels
    'Canari (petite taille)', 'Canari (moyenne taille)', 'Canari (grande taille)',
    'Marmite en terre cuite', 'Calebasse (grande)', 'Calebasse (petite)',
    'Panier tressé (conservation)', 'Natte de séchage',

    // ===== BATTERIES DE CUISINE =====
    // \uD83C\uDF73 Sets complets
    'Batterie de cuisine 5 pièces', 'Batterie de cuisine 7 pièces',
    'Batterie de cuisine 10 pièces', 'Batterie de cuisine 12 pièces',
    'Batterie de cuisine professionnelle (20+ pièces)',

    // ===== USTENSILES DE CUISSON =====
    // Casseroles & Marmites
    'Casserole 1L', 'Casserole 2L', 'Casserole 3L', 'Casserole 5L',
    'Marmite 5L', 'Marmite 10L', 'Marmite 15L', 'Marmite 20L', 'Marmite 30L',
    'Faitout 5L', 'Faitout 10L', 'Faitout 15L',
    'Cocotte minute 4L', 'Cocotte minute 6L', 'Cocotte minute 8L', 'Cocotte minute 10L',
    'Cocotte en fonte', 'Cocotte en céramique',

    // Poêles & Grills
    'Poêle 20cm', 'Poêle 24cm', 'Poêle 28cm', 'Poêle 32cm',
    'Poêle anti-adhésive', 'Poêle en fonte', 'Poêle grill',
    'Wok 28cm', 'Wok 32cm', 'Wok électrique',
    'Crêpière', 'Gaufrier', 'Plancha électrique',

    // Plats & Moules
    'Plat à four rectangulaire', 'Plat à four ovale', 'Plat à gratin',
    'Moule à cake', 'Moule à tarte', 'Moule à muffins', 'Moule à gâteau',

    // ===== VAISSELLE & SERVICE =====
    // Assiettes
    'Service de table 6 personnes', 'Service de table 12 personnes',
    'Assiette plate', 'Assiette creuse', 'Assiette à dessert',
    'Assiettes jetables (lot 50)', 'Assiettes jetables (lot 100)',

    // Verres & Coupes
    'Verres à eau (lot 6)', 'Verres à jus (lot 6)', 'Verres à vin (lot 6)',
    'Tasses à café (lot 6)', 'Mugs (lot 6)', 'Coupes à champagne (lot 6)',

    // Couverts
    'Ménagère 24 pièces', 'Ménagère 48 pièces', 'Ménagère 72 pièces',
    'Couverts jetables (lot 50)', 'Couverts jetables (lot 100)',

    // Saladiers & Bols
    'Saladier 1L', 'Saladier 2L', 'Saladier 3L', 'Saladier 5L',
    'Bol à soupe', 'Bol à céréales', 'Ramequin',

    // ===== USTENSILES DE PRÉPARATION =====
    // Couteaux
    'Set de couteaux (3 pièces)', 'Set de couteaux (5 pièces)', 'Set de couteaux (10 pièces)',
    'Couteau de chef', 'Couteau à pain', 'Couteau d\'office', 'Couteau à découper',
    'Planche à découper (bois)', 'Planche à découper (plastique)', 'Planche à découper (verre)',

    // Ustensiles manuels
    'Fouet manuel', 'Fouet électrique', 'Spatule silicone', 'Spatule bois',
    'Louche', 'Écumoire', 'Pince de cuisine', 'Cuillère en bois',
    'Râpe multifonction', 'Éplucheur', 'Ouvre-boîte', 'Tire-bouchon',
    'Rouleau à pâtisserie', 'Passoire', 'Chinois', 'Entonnoir',

    // ===== PETITS ÉLECTROMÉNAGERS CUISINE =====
    // Mixeurs & Blenders
    'Mixeur plongeant', 'Blender 1.5L', 'Blender 2L', 'Blender professionnel',
    'Robot multifonction', 'Hachoir électrique', 'Moulin à café électrique',

    // Cuisson
    'Bouilloire électrique 1.7L', 'Bouilloire électrique 2L',
    'Grille-pain 2 tranches', 'Grille-pain 4 tranches',
    'Cuiseur à riz 1L', 'Cuiseur à riz 1.8L', 'Cuiseur à riz 2.8L',
    'Friteuse 2L', 'Friteuse 3L', 'Friteuse sans huile',
    'Multicuiseur 5L', 'Multicuiseur 6L',

    // Presse & Extracteurs
    'Presse-agrumes électrique', 'Presse-agrumes manuel',
    'Centrifugeuse', 'Extracteur de jus',

    // ===== ACCESSOIRES =====
    // Conservation
    'Set de boîtes de conservation (5 pièces)', 'Set de boîtes de conservation (10 pièces)',
    'Bocaux en verre (lot 6)', 'Tupperware (lot 10)',

    // Ustensiles divers
    'Balance de cuisine électronique', 'Balance de cuisine mécanique',
    'Minuteur de cuisine', 'Thermomètre de cuisine',
    'Torchons de cuisine (lot 6)', 'Maniques (lot 2)',
    'Dessous de plat', 'Égouttoir à vaisselle',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CATÉGORIES (11)
  categories: [
    '\uD83C\uDF0D Ustensiles traditionnels africains',
    '\uD83C\uDF73 Batteries de cuisine (sets)',
    '\uD83D\uDD25 Ustensiles de cuisson (casseroles, poêles)',
    '\uD83C\uDF7D️ Vaisselle & Service (assiettes, verres)',
    '\uD83D\uDD2A Ustensiles de préparation (couteaux, râpes)',
    '⚡ Petits électroménagers (mixeur, blender)',
    '\uD83D\uDCE6 Conservation & Stockage',
    '⚖️ Accessoires (balance, minuteur)',
    '\uD83C\uDFAA Événementiel (jetable, location)',
    '\uD83D\uDC68‍\uD83C\uDF73 Professionnel / Restaurant',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES (40+)
  types: [
    // Cuisson
    'Casserole', 'Marmite', 'Faitout', 'Cocotte', 'Cocotte minute',
    'Poêle', 'Poêle anti-adhésive', 'Wok', 'Crêpière', 'Gaufrier', 'Plancha',
    'Plat à four', 'Moule à gâteau', 'Moule à tarte',

    // Vaisselle
    'Service de table', 'Assiette', 'Bol', 'Saladier',
    'Verre', 'Tasse', 'Mug', 'Coupe',
    'Couverts (fourchette, couteau, cuillère)', 'Ménagère',

    // Préparation
    'Couteau', 'Set de couteaux', 'Planche à découper',
    'Fouet', 'Spatule', 'Louche', 'Écumoire', 'Pince',
    'Râpe', 'Éplucheur', 'Passoire', 'Entonnoir',

    // Électrique
    'Mixeur', 'Blender', 'Robot multifonction', 'Hachoir',
    'Bouilloire', 'Grille-pain', 'Cuiseur à riz', 'Friteuse', 'Multicuiseur',
    'Presse-agrumes', 'Centrifugeuse',

    // Traditionnel africain
    'Mortier et pilon', 'Canari', 'Calebasse', 'Marmite en terre',
    'Pierre à moudre', 'Panier tressé',

    // Accessoires
    'Boîte de conservation', 'Balance', 'Minuteur', 'Thermomètre',
    'Torchon', 'Manique', 'Dessous de plat', 'Égouttoir',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MATÉRIAUX (25)
  materiaux: [
    // Métaux
    'Inox (acier inoxydable)', 'Aluminium', 'Aluminium anodisé', 'Fonte', 'Fonte émaillée',
    'Acier', 'Cuivre',

    // Revêtements anti-adhésifs
    'Téflon', 'Anti-adhésif (sans PFOA)', 'Céramique', 'Pierre (granite coating)',
    'Marbre (coating)',

    // Matériaux naturels
    'Bois', 'Bambou', 'Bois d\'olivier', 'Bois de hêtre',
    'Terre cuite', 'Pierre naturelle', 'Argile',

    // Plastique & Silicone
    'Plastique alimentaire', 'Silicone', 'Mélamine',

    // Verre & Porcelaine
    'Verre', 'Verre trempé', 'Pyrex', 'Porcelaine', 'Faïence', 'Grès',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES (45 - Focus Afrique)
  marques: [
    // ===== MARQUES CHINOISES (Très populaires en Afrique) =====
    'Binatone', 'Sokany', 'Lontor', 'Qasa', 'Century', 'Master Chef', 'Scarlett',
    'Hisense', 'Haier', 'Midea', 'Xiaomi', 'Bear',

    // ===== MARQUES TURQUES & EUROPÉENNES =====
    'Tefal', 'Moulinex', 'Arçelik', 'Philips', 'Krups', 'Bosch',
    'Kenwood', 'Braun', 'Rowenta', 'SEB',

    // ===== MARQUES PREMIUM =====
    'KitchenAid', 'Le Creuset', 'Staub', 'Pyrex', 'Luminarc', 'Duralex',

    // ===== MARQUES AFRICAINES / LOCALES =====
    'Marque locale', 'Artisan local', 'Fabrication artisanale',

    // ===== DISCOUNT / ÉCONOMIQUE =====
    'Sans marque', 'Marque chinoise générique',

    // ===== PROFESSIONNELLES =====
    'Beka', 'De Buyer', 'Matfer', 'Lacor',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CAPACITÉS (30)
  capacites: [
    // Petites capacités (casseroles, bols)
    '0.5L', '1L', '1.5L', '2L', '2.5L', '3L',

    // Moyennes capacités (marmites, faitouts)
    '4L', '5L', '6L', '7L', '8L', '10L',

    // Grandes capacités (marmites, cocottes)
    '12L', '15L', '20L', '25L', '30L', '40L', '50L+',

    // Diamètres (poêles, plats)
    'Ø 18cm', 'Ø 20cm', 'Ø 24cm', 'Ø 26cm', 'Ø 28cm', 'Ø 30cm', 'Ø 32cm',

    // Autres
    'Variable', 'N/A',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTATS (7)
  etats: [
    'Neuf scellé',
    'Neuf sans emballage',
    'Excellent état (comme neuf)',
    'Bon état',
    'État correct',
    'Occasion (usure visible)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ USAGES (8)
  usages: [
    'Cuisine quotidienne / Domestique',
    'Professionnel / Restaurant',
    'Événementiel (mariage, fête)',
    'Camping / Extérieur',
    'Cuisine traditionnelle africaine',
    'Pâtisserie',
    'Location pour événements',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOMBRE DE PIÈCES DANS SET (10)
  pieces_dans_set: [
    '1 pièce (ustensile unique)',
    '2 pièces',
    '3 pièces',
    '5 pièces',
    '6 pièces',
    '7 pièces',
    '10 pièces',
    '12 pièces',
    '20+ pièces',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ COMPATIBILITÉS (feux de cuisson)
  compatibilites: [
    'Tous feux',
    'Gaz',
    'Électrique',
    'Induction',
    'Vitrocéramique',
    'Four',
    'Micro-ondes',
    'Lave-vaisselle',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS PIÈCES AUTO - REFONTE COMPLÈTE
export const PIECES_AUTO_MODALITIES: ModalityCategory = {
  // ✅ NOMS DE PRODUITS (60+ pièces spécifiques)
  noms_produits: [
    // Moteur & Mécanique
    'Filtre à huile', 'Filtre à air', 'Filtre à carburant', 'Filtre d\'habitacle',
    'Courroie de distribution', 'Courroie d\'accessoires', 'Kit de distribution',
    'Pompe à eau', 'Pompe à carburant', 'Pompe à huile',
    'Radiateur moteur', 'Radiateur de chauffage', 'Vase d\'expansion',
    'Thermostat', 'Calorstat', 'Durite de radiateur',
    'Bougie d\'allumage', 'Bobine d\'allumage', 'Câbles de bougies',
    'Alternateur', 'Démarreur', 'Batterie',
    'Injecteur', 'Rampe d\'injection', 'Pompe d\'injection',

    // Freinage
    'Plaquettes de frein avant', 'Plaquettes de frein arrière',
    'Disques de frein avant', 'Disques de frein arrière',
    'Tambours de frein', 'Mâchoires de frein',
    'Étriers de frein', 'Liquide de frein',
    'Maître-cylindre', 'Cylindre de roue',
    'Flexible de frein', 'Durite de frein',

    // Suspension & Direction
    'Amortisseur avant', 'Amortisseur arrière',
    'Ressort de suspension', 'Coupelle d\'amortisseur',
    'Rotule de suspension', 'Silent-bloc',
    'Barre stabilisatrice', 'Bielle de direction',
    'Crémaillère de direction', 'Pompe de direction assistée',
    'Triangle de suspension', 'Bras de suspension',

    // Transmission
    'Embrayage complet', 'Disque d\'embrayage', 'Mécanisme d\'embrayage',
    'Butée d\'embrayage', 'Cardan', 'Arbre de transmission',
    'Soufflet de cardan', 'Joint de cardan',

    // Échappement
    'Pot d\'échappement', 'Catalyseur', 'Silencieux',
    'Collecteur d\'échappement', 'Tube d\'échappement',
    'Filtre à particules (FAP)', 'Vanne EGR',

    // Éclairage & Signalisation
    'Phare avant droit', 'Phare avant gauche',
    'Feu arrière droit', 'Feu arrière gauche',
    'Clignotant', 'Feu antibrouillard', 'Ampoule H7', 'Ampoule H4',

    // Carrosserie
    'Pare-choc avant', 'Pare-choc arrière',
    'Capot', 'Aile avant', 'Aile arrière',
    'Porte avant', 'Porte arrière',
    'Hayon', 'Coffre', 'Rétroviseur',

    // Intérieur
    'Tableau de bord', 'Volant', 'Airbag',
    'Siège avant', 'Siège arrière', 'Ceinture de sécurité',

    // Accessoires & Consommables
    'Balai d\'essuie-glace', 'Lave-glace',
    'Joint de culasse', 'Joint de carter', 'Joint SPI',
    'Huile moteur', 'Liquide de refroidissement', 'Liquide lave-glace',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CATÉGORIES (10 catégories principales)
  categories: [
    'Moteur & Mécanique',
    'Freinage',
    'Suspension & Direction',
    'Transmission & Embrayage',
    'Échappement',
    'Éclairage & Signalisation',
    'Carrosserie',
    'Intérieur & Habitacle',
    'Électrique & Électronique',
    'Accessoires & Consommables',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE PIÈCES (20+ types détaillés)
  types: [
    // Moteur
    'Filtre (huile, air, carburant)', 'Distribution (courroie, kit)', 'Allumage (bougies, bobine)',
    'Refroidissement (radiateur, pompe)', 'Injection (injecteur, pompe)', 'Démarrage (démarreur, batterie)',
    // Freinage
    'Plaquettes de frein', 'Disques de frein', 'Tambours & Mâchoires', 'Étriers', 'Liquides',
    // Suspension
    'Amortisseurs', 'Ressorts', 'Rotules & Silent-blocs', 'Direction (crémaillère, bielles)',
    // Transmission
    'Embrayage (kit, disque)', 'Cardans & Arbres', 'Joints',
    // Carrosserie
    'Pare-chocs', 'Ailes & Portes', 'Optiques (phares, feux)', 'Rétroviseurs',
    // Autres
    'Échappement (pot, catalyseur)', 'Intérieur (sièges, tableau de bord)', 'Consommables (huiles, liquides)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES DE PIÈCES (35+ marques)
  marques_pieces: [
    // Premium/OEM
    'Bosch', 'Valeo', 'Continental', 'ZF', 'Brembo', 'Monroe', 'Bilstein',
    'Mann-Filter', 'Mahle', 'Hengst', 'Denso', 'NGK', 'Champion',
    'Sachs', 'LUK', 'TRW', 'ATE', 'Textar', 'Ferodo',
    'SKF', 'FAG', 'INA', 'Gates', 'Dayco', 'Hutchinson',
    // Aftermarket
    'Febi', 'Lemförder', 'Meyle', 'Optimal', 'Magneti Marelli', 'Vaico',
    // Budget
    'Blue Print', 'Ridex', 'Stark',
    // Marque véhicule (origine)
    'Origine constructeur (OEM)', 'Équipementier d\'origine',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES DE VÉHICULES COMPATIBLES (25+ marques populaires Cameroun)
  marques_vehicules: [
    // Japonaises (très populaires Cameroun)
    'Toyota', 'Nissan', 'Honda', 'Mazda', 'Mitsubishi', 'Suzuki', 'Subaru', 'Isuzu',
    // Européennes
    'Mercedes-Benz', 'BMW', 'Volkswagen', 'Peugeot', 'Renault', 'Citroën', 'Audi', 'Volvo',
    // Américaines
    'Ford', 'Chevrolet', 'Jeep', 'Dodge',
    // Coréennes
    'Hyundai', 'Kia', 'Ssangyong',
    // Chinoises (émergentes)
    'Changan', 'Chery', 'Geely', 'Haval',
    // Universelle
    'Universel (toutes marques)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MODÈLES POPULAIRES CAMEROUN (30+ modèles)
  modeles_populaires: [
    // Toyota (roi du Cameroun)
    'Toyota Corolla', 'Toyota Camry', 'Toyota RAV4', 'Toyota Highlander',
    'Toyota Land Cruiser', 'Toyota Prado', 'Toyota Hilux', 'Toyota Yaris',
    'Toyota Avensis', 'Toyota Auris',
    // Nissan
    'Nissan Patrol', 'Nissan Qashqai', 'Nissan X-Trail', 'Nissan Navara', 'Nissan Juke',
    // Honda
    'Honda Accord', 'Honda Civic', 'Honda CR-V', 'Honda Pilot',
    // Mercedes
    'Mercedes Classe C', 'Mercedes Classe E', 'Mercedes GLE', 'Mercedes Sprinter',
    // Peugeot/Renault
    'Peugeot 206', 'Peugeot 207', 'Peugeot 307', 'Renault Clio', 'Renault Mégane',
    // Autres
    'Hyundai Tucson', 'Kia Sportage', 'VW Golf', 'Ford Ranger',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTATS (8 états détaillés)
  etats: [
    'Neuf scellé (emballage d\'origine)',
    'Neuf déballé',
    'Occasion - Excellent état (< 20% usure)',
    'Occasion - Bon état (20-50% usure)',
    'Occasion - État moyen (50-70% usure)',
    'Occasion - État faible (> 70% usure)',
    'Reconditionné (remis à neuf)',
    'À réparer (pièce défectueuse)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GARANTIES (8 types)
  garanties: [
    'Garantie constructeur 2 ans',
    'Garantie constructeur 1 an',
    'Garantie fournisseur 6 mois',
    'Garantie fournisseur 3 mois',
    'Garantie atelier 1 mois',
    'Garantie satisfait ou remboursé 7 jours',
    'Sans garantie (pièce d\'occasion)',
    'Garantie à vie (certaines pièces)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ORIGINES (11 origines - contexte Afrique)
  origines: [
    'Origine Europe (UE)',
    'Origine Allemagne',
    'Origine France',
    'Origine Italie',
    'Origine Asie (Japon, Corée)',
    'Origine Chine',
    'Origine Taïwan',
    'Origine USA',
    'Origine Nigeria', // ✅ Très utilisé au Cameroun (pays voisin)
    'Fabriqué localement (Cameroun)',
    'Importé direct constructeur',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ COMPATIBILITÉS (6 niveaux)
  compatibilites: [
    'Compatible marque spécifique uniquement',
    'Compatible plusieurs marques',
    'Universel (toutes marques)',
    'Nécessite vérification référence',
    'Sur commande (à vérifier)',
    'Adaptable avec modification',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MATÉRIAUX (10 matériaux)
  materiaux: [
    'Acier',
    'Acier inoxydable',
    'Aluminium',
    'Fonte',
    'Plastique renforcé',
    'Caoutchouc',
    'Composite',
    'Céramique (plaquettes)',
    'Carbone',
    'Matériau composite',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE FOURNISSEURS (6 types)
  fournisseurs_types: [
    'Magasin pièces détachées auto',
    'Garage professionnel',
    'Casse automobile',
    'Importateur direct',
    'Particulier (vente pièce)',
    'Marketplace en ligne',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS PIÈCES INDUSTRIELLES - ⚙️ ENRICHI AFRIQUE FRANCOPHONE
export const PIECES_INDUSTRIELLES_MODALITIES: ModalityCategory = {
  // Types de pièces (40+)
  types: [
    // Transmission et roulement
    'Roulement à billes',
    'Roulement à rouleaux',
    'Palier',
    'Butée à billes',
    'Roulement à aiguilles',
    'Courroie trapézoïdale',
    'Courroie plate',
    'Courroie crantée',
    'Chaîne de transmission',
    'Bande transporteuse',
    'Poulie',
    'Pignon',
    'Engrenage',
    'Réducteur de vitesse',
    'Multiplicateur',
    'Accouplement',
    'Cardans',

    // Moteurs et électromécanique
    'Moteur électrique triphasé',
    'Moteur électrique monophasé',
    'Moteur asynchrone',
    'Variateur de vitesse',
    'Contacteur',
    'Relais thermique',
    'Disjoncteur industriel',

    // Pompes et hydraulique
    'Pompe centrifuge',
    'Pompe volumétrique',
    'Pompe immergée',
    'Pompe à eau',
    'Pompe hydraulique',
    'Vérin hydraulique',
    'Distributeur hydraulique',
    'Flexible hydraulique',
    'Raccord hydraulique',

    // Pneumatique
    'Vérin pneumatique',
    'Électrovanne pneumatique',
    'Distributeur pneumatique',
    'Régulateur de pression',
    'Filtre à air comprimé',
    'Lubrifacteur',
    'Raccord pneumatique',
    'Flexible pneumatique',

    // Compresseurs et ventilation
    'Compresseur à vis',
    'Compresseur à pistons',
    'Ventilateur industriel',
    'Extracteur d\'air',

    // Filtration et étanchéité
    'Joint d\'étanchéité',
    'Joint SPI',
    'Joint torique (O-ring)',
    'Filtre à huile',
    'Filtre à air',
    'Filtre hydraulique',
    'Cartouche filtrante',

    // Instrumentation et capteurs
    'Capteur de pression',
    'Capteur de température',
    'Capteur de niveau',
    'Détecteur de proximité',
    'Cellule photoélectrique',
    'Pressostat',
    'Thermostat industriel',
    'Manomètre',

    // Divers
    'Rondelle',
    'Vis industrielle',
    'Écrou',
    'Goujon',
    'Goupille',
    'Clavette',
    'Ressort industriel',
    'Câble électrique industriel',
    'Courroie de manutention',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques internationales très présentes en Afrique (50+)
  marques: [
    // Roulements (leaders mondiaux)
    'SKF',
    'FAG',
    'NSK',
    'NTN',
    'Timken',
    'INA',
    'Koyo',
    'Nachi',
    'SNR',
    'ZKL',

    // Courroies
    'Gates',
    'ContiTech',
    'Optibelt',
    'Hutchinson',
    'Habasit',
    'Megadyne',

    // Moteurs et automation
    'ABB',
    'Siemens',
    'Schneider Electric',
    'SEW-Eurodrive',
    'Leroy-Somer',
    'WEG',
    'Baldor',
    'Nord',
    'Bonfiglioli',

    // Pompes
    'Grundfos',
    'KSB',
    'Wilo',
    'Ebara',
    'Lowara',
    'Calpeda',
    'Pedrollo',
    'Flygt',

    // Hydraulique
    'Parker',
    'Bosch Rexroth',
    'Danfoss',
    'Eaton',
    'Hydac',
    'Vickers',
    'Manuli',

    // Pneumatique
    'Festo',
    'SMC',
    'Camozzi',
    'Norgren',
    'Parker Pneumatic',

    // Compresseurs
    'Atlas Copco',
    'Kaeser',
    'Ingersoll Rand',
    'Gardner Denver',
    'CompAir',

    // Filtration
    'Pall',
    'Donaldson',
    'Mann+Hummel',
    'Mahle',
    'Camfil',

    // Instrumentation
    'Endress+Hauser',
    'Vega',
    'Sick',
    'Omron',
    'Pepperl+Fuchs',
    'Turck',
    'Balluff',
    'Baumer',

    // Divers
    'Loctite',
    'Permatex',
    'Würth',
    'Facom',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Applications industrielles en Afrique (30+)
  applications: [
    // Agroalimentaire
    'Meunerie (minoterie)',
    'Brasserie',
    'Huilerie',
    'Sucrerie',
    'Laiterie',
    'Abattoir',
    'Conserverie',
    'Boulangerie industrielle',

    // Transformation
    'Textile et confection',
    'Scierie',
    'Menuiserie industrielle',
    'Papeterie',
    'Imprimerie',
    'Plasturgie',

    // Industries lourdes
    'Cimenterie',
    'Carrière',
    'Mine',
    'Sidérurgie',
    'Fonderie',

    // BTP et construction
    'Centrale à béton',
    'Matériel de construction',
    'Engins de chantier',

    // Eau et énergie
    'Station de pompage',
    'Traitement d\'eau',
    'Irrigation',
    'Forage',
    'Groupe électrogène',
    'Centrale électrique',

    // Autres
    'Froid et climatisation',
    'Blanchisserie industrielle',
    'Garage et mécanique',
    'Atelier de maintenance',
    'Machines-outils',
    'Manutention et convoyage',
    'Compresseur d\'air',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Matériaux (20+)
  materiaux: [
    'Acier',
    'Acier inoxydable (Inox 304)',
    'Acier inoxydable (Inox 316)',
    'Acier traité',
    'Fonte grise',
    'Fonte ductile',
    'Bronze',
    'Laiton',
    'Cuivre',
    'Aluminium',
    'Zinc',
    'Caoutchouc naturel',
    'Caoutchouc synthétique (NBR)',
    'Caoutchouc EPDM',
    'PVC',
    'Polyéthylène (PE)',
    'Polypropylène (PP)',
    'PTFE (Téflon)',
    'Polyuréthane',
    'Composite',
    'Céramique',
    'Graphite',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // États
  etats: [
    'Neuf d\'origine (OEM)',
    'Neuf équivalent',
    'Occasion - Révisé',
    'Occasion - Bon état',
    'Occasion - À réparer',
    'Reconditionné',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Normes et certifications
  normes: [
    'ISO 9001',
    'CE',
    'DIN (Allemagne)',
    'ANSI (USA)',
    'JIS (Japon)',
    'AFNOR (France)',
    'API (Pétrole)',
    'ATEX (Zones explosives)',
    'IP (Indice de protection)',
    'Sans certification',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Garanties
  garanties: [
    'Aucune garantie',
    '3 mois',
    '6 mois',
    '1 an',
    '2 ans',
    '3 ans et plus',
    'Garantie constructeur',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS RESTAURATION & TRAITEUR - ULTRA-COMPLET AFRIQUE FRANCOPHONE
// \uD83C\uDF0D Focus: Cameroun, Côte d'Ivoire, Sénégal, Mali, Congo, Gabon, Burkina Faso, etc.
export const RESTAURATION_MODALITIES: ModalityCategory = {
  // ===============================================
  // \uD83C\uDF7D️ TYPES D'ÉTABLISSEMENTS (20+)
  // ===============================================
  types: [
    // Afrique
    '\uD83C\uDFE0 Maquis traditionnel',
    '\uD83C\uDFE0 Restaurant africain',
    '\uD83C\uDF56 Braiserie / Grillades',
    '\uD83C\uDF57 Poulet braisé / Rôtisserie',
    '\uD83D\uDC1F Poissonnerie / Poisson braisé',
    '\uD83E\uDD58 Traiteur événementiel',
    '☕ Cafétéria / Snack',

    // International
    '\uD83C\uDF55 Pizzeria',
    '\uD83C\uDF54 Fast-food / Burger',
    '\uD83C\uDF5D Restaurant italien',
    '\uD83C\uDF5C Restaurant asiatique (chinois, japonais)',
    '\uD83E\uDD59 Restaurant libanais / Moyen-Orient',
    '\uD83E\uDD56 Boulangerie-pâtisserie',
    '\uD83E\uDDC1 Pâtisserie / Salon de thé',
    '\uD83C\uDF70 Glacier / Crèmerie',

    // Moderne
    '\uD83D\uDE9A Food truck',
    '\uD83C\uDFEA Kiosque / Stand alimentaire',
    '\uD83C\uDF77 Restaurant gastronomique',
    '\uD83C\uDF78 Bar-restaurant / Lounge',
    '☕ Café / Coffee shop',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDDE8\uD83C\uDDF2 PLATS CAMEROUNAIS (60+ plats authentiques)
  // ===============================================
  plats_camerounais: [
    // \uD83C\uDF56 VIANDES & GRILLADES
    '\uD83C\uDF56 Poulet DG (Directeur Général)',
    '\uD83C\uDF57 Poulet braisé / Kati-kati',
    '\uD83C\uDF57 Poulet bicyclette (poulet local)',
    '\uD83E\uDD69 Bœuf sauté à la tomate',
    '\uD83E\uDD69 Soya (brochettes de bœuf)',
    '\uD83E\uDD69 Khebabs (brochettes)',
    '\uD83D\uDC10 Chèvre rôtie / Chèvre sautée',
    '\uD83D\uDC10 Tchobi (sauce chèvre)',
    '\uD83D\uDC0F Mouton grillé / Mouton sauté',
    '\uD83E\uDD53 Porc sauté / Porc grillé',
    '\uD83E\uDD53 Porc braisé',
    '\uD83C\uDF56 Viande fumée / Kilichi',

    // \uD83D\uDC1F POISSONS & FRUITS DE MER
    '\uD83D\uDC1F Poisson braisé (tilapia, capitaine, carpe)',
    '\uD83D\uDC1F Poisson fumé',
    '\uD83D\uDC1F Poisson salé séché (mbonga)',
    '\uD83D\uDC1F Makayabu (morue salée)',
    '\uD83E\uDD90 Crevettes sautées',
    '\uD83E\uDD90 Crevettes à la sauce tomate',
    '\uD83E\uDD9E Écrevisses fraîches',
    '\uD83D\uDC1A Escargots (congo meat)',

    // \uD83E\uDD58 SAUCES & PLATS EN SAUCE
    '\uD83E\uDD58 Ndolé (feuilles de ndolé + arachides)',
    '\uD83E\uDD58 Eru (okok) - légumes gluants',
    '\uD83E\uDD58 Koki (gâteau de haricots)',
    '\uD83E\uDD58 Koki Bassa (haricots triturés Bassa)',
    '\uD83E\uDD58 Koki du Centre (haricots du Centre)',
    '\uD83E\uDD58 Ikok (feuilles de manioc)',
    '\uD83E\uDD58 Taro sauce jaune (macabo + sauce jaune)',
    '\uD83E\uDD58 Kouakoukou / Macabo rapé (macabo râpé + sauce)',
    '\uD83E\uDD58 Sauce gombo',
    '\uD83E\uDD58 Sauce arachide',
    '\uD83E\uDD58 Sauce graine / Sauce pistache (pistache/courge)',
    '\uD83E\uDD58 Sauce jaune (curcuma)',
    '\uD83E\uDD58 Sauce tomate',
    '\uD83E\uDD58 Nkwem / Kwem (sauce épaisse)',
    '\uD83E\uDD58 Mbongo / Mbongo tchobi (sauce noire)',
    '\uD83E\uDD58 Nkontchap (sauce épaisse à base de légumes)',
    '\uD83E\uDD58 Kondré (plantain + viande)',
    '\uD83E\uDD58 Sanga / Sangah (maïs + feuilles de manioc)',
    '\uD83E\uDD58 Kati (sauce épicée)',
    '\uD83E\uDD57 Légumes sautés (carottes, haricots verts, etc.)',

    // \uD83C\uDF5A FÉCULENTS & ACCOMPAGNEMENTS
    '\uD83C\uDF5A Riz blanc / Riz sauce tomate',
    '\uD83C\uDF5A Riz jollof / Riz au gras',
    '\uD83C\uDF5A Riz sauté',
    '\uD83C\uDF3D Couscous de maïs / Chachacha',
    '\uD83C\uDF3D Couscous de manioc (gari)',
    '\uD83C\uDF3D Bouilli de maïs / Corn fufu',
    '\uD83C\uDF3E Fufu (pâte de maïs fermentée)',
    '\uD83E\uDD54 Water fufu / Waterfufu',
    '\uD83C\uDF60 Igname pilée / Foufou d\'igname',
    '\uD83C\uDF60 Macabo bouilli / Taro',
    '\uD83C\uDF4C Plantain frit / Alloco',
    '\uD83C\uDF4C Plantain bouilli',
    '\uD83C\uDF4C Plantain mûr grillé',
    '\uD83E\uDD54 Patate douce bouillie',
    '\uD83E\uDD5C Miondo (bâtons de manioc)',
    '\uD83E\uDD5C Bobolo (pain de manioc)',
    '\uD83E\uDD5C Bâton de manioc',

    // \uD83E\uDD63 SOUPES & BOUILLONS
    '\uD83E\uDD63 Nkui (soupe épicée)',
    '\uD83E\uDD63 Ekwang (taro pilé + feuilles)',
    '\uD83E\uDD63 Pepper soup (soupe poivrée)',
    '\uD83E\uDD63 Okok (eru en soupe)',

    // \uD83E\uDD50 COLLATIONS & STREET FOOD
    '\uD83E\uDD50 Puff-puff (beignets sucrés)',
    '\uD83E\uDD50 Beignet haricot (accra)',
    '\uD83E\uDD50 Beignets de banane',
    '\uD83E\uDD50 Akara (beignets de haricots)',
    '\uD83E\uDD50 Beignet de maïs',
    '\uD83C\uDF5E Pain artisanal camerounais',
    '\uD83C\uDF2D Saucisses grillées',
    '\uD83E\uDD5A Omelette camerounaise',
    '\uD83E\uDD5A Œufs durs sauce tomate',
    '\uD83C\uDF3D Maïs bouilli / Épis grillés',
    '\uD83E\uDD5C Arachides grillées',

    '\uD83C\uDD95 Autre plat camerounais (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDDE8\uD83C\uDDEE PLATS IVOIRIENS (70+ plats authentiques)
  // ===============================================
  plats_ivoiriens: [
    // \uD83C\uDF56 PLATS SIGNATURE IVOIRIENS
    '\uD83C\uDF56 Attiéké-poisson (semoule manioc + poisson frit)',
    '\uD83C\uDF56 Attiéké-poulet braisé',
    '\uD83C\uDF56 Attiéké-viande',
    '\uD83C\uDF56 Aloco-poisson (plantain frit + poisson)',
    '\uD83C\uDF56 Aloco-œuf / Aloco-viande',
    '\uD83E\uDD58 Garba (attiéké + thon frit)',
    '\uD83E\uDD58 Kedjenou (poulet mijoté traditionnel)',
    '\uD83E\uDD58 Kedjenou de pintade',
    '\uD83E\uDD58 Kedjenou de poisson',
    '\uD83E\uDD58 Placali sauce graine (pâte manioc fermentée)',
    '\uD83E\uDD58 Placali sauce claire',
    '\uD83E\uDD58 Foutou sauce graine',
    '\uD83E\uDD58 Foutou sauce claire',

    // \uD83E\uDD58 SAUCES TRADITIONNELLES
    '\uD83E\uDD58 Sauce claire (gombo + huile palme)',
    '\uD83E\uDD58 Sauce graine (pistache)',
    '\uD83E\uDD58 Sauce arachide',
    '\uD83E\uDD58 Sauce djoumblé (aubergine africaine)',
    '\uD83E\uDD58 Sauce kopé (gombo séché)',
    '\uD83E\uDD58 Sauce gouagouassou (gombo + aubergine)',
    '\uD83E\uDD58 Sauce feuilles de patate',
    '\uD83E\uDD58 Sauce n\'tro (graines de courge)',
    '\uD83E\uDD58 Sauce graine de courge',

    // \uD83C\uDF5A RIZ & FÉCULENTS
    '\uD83C\uDF5A Riz gras / Riz au gras ivoirien',
    '\uD83C\uDF5A Riz sauce',
    '\uD83C\uDF5A Riz sauce tomate',
    '\uD83C\uDF5A Riz jollof ivoirien',
    '\uD83C\uDF3E Foutou banane (banane plantain pilée)',
    '\uD83C\uDF3E Foutou igname',
    '\uD83C\uDF3E Foutou manioc',
    '\uD83C\uDF3E Placali (pâte de manioc fermentée)',
    '\uD83C\uDF60 Igname bouillie / Igname pilée',
    '\uD83C\uDF60 Igname frite',
    '\uD83C\uDF4C Alloco (plantain frit)',
    '\uD83C\uDF4C Plantain bouilli',
    '\uD83E\uDD54 Tubercules bouillis (igname, manioc, etc.)',

    // \uD83C\uDF57 GRILLADES & VIANDES
    '\uD83C\uDF57 Poulet braisé à l\'ivoirienne',
    '\uD83C\uDF57 Poulet bicyclette (poulet local)',
    '\uD83D\uDC1F Poisson braisé (carpe, capitaine, machoiron)',
    '\uD83D\uDC1F Poisson fumé',
    '\uD83D\uDC1F Poisson frit (dorade, sole)',
    '\uD83D\uDC1F Brochettes de poisson',
    '\uD83E\uDD69 Bœuf braisé / Choukouya',
    '\uD83E\uDD69 Brochettes de bœuf',
    '\uD83D\uDC0F Mouton braisé',
    '\uD83D\uDC0F Brochettes de mouton',
    '\uD83E\uDD80 Crabes farcis',
    '\uD83E\uDD90 Crevettes sautées',

    // \uD83E\uDD50 STREET FOOD & COLLATIONS
    '\uD83E\uDD50 Beignets de banane',
    '\uD83E\uDD50 Akara (beignets haricots)',
    '\uD83E\uDD50 Gbofloto (beignets sucrés)',
    '\uD83E\uDD50 Gnangnan (beignets de haricot)',
    '\uD83C\uDF2D Alloco-piment (plantain + piment)',
    '\uD83C\uDF2D Alloco à l\'Abidjanaise',
    '\uD83C\uDF3D Maïs grillé',
    '\uD83C\uDF3D Maïs bouilli',
    '\uD83E\uDD5C Arachides grillées',
    '\uD83E\uDD5A Garba œufs',
    '\uD83C\uDF5E Pain brioché ivoirien',

    // \uD83E\uDD63 SOUPES & RAGOÛTS
    '\uD83E\uDD63 Soupe claire de poisson',
    '\uD83E\uDD63 Soupe gombo',
    '\uD83E\uDD63 Pépé soupe (poisson séché + gombo)',
    '\uD83E\uDD63 Ragoût d\'igname',

    // \uD83C\uDF70 DESSERTS & BOISSONS
    '\uD83E\uDD65 Bangui (vin de palme)',
    '\uD83E\uDD65 Jus de coco / Eau de coco',
    '\uD83C\uDF79 Gnamakoudji (jus de gingembre)',
    '\uD83C\uDF79 Jus de tamarin',
    '\uD83C\uDF70 Dégué (couscous mil au lait)',

    '\uD83C\uDD95 Autre plat ivoirien (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDDF8\uD83C\uDDF3 PLATS SÉNÉGALAIS (80+ plats authentiques)
  // ===============================================
  plats_senegalais: [
    // \uD83C\uDF5A PLATS SIGNATURE AU RIZ
    '\uD83C\uDF5A Thiéboudienne rouge (riz au poisson + sauce tomate)',
    '\uD83C\uDF5A Thiéboudienne blanc (riz au poisson sans tomate)',
    '\uD83C\uDF5A Thiébou yapp (riz à la viande)',
    '\uD83C\uDF5A Thiébou guinar (riz au poulet)',
    '\uD83C\uDF5A Thiébou kethiakh (riz sauce arachide)',
    '\uD83C\uDF5A Riz au gras / Riz wolof',
    '\uD83C\uDF5A Benachin (riz wolof one-pot)',
    '\uD83C\uDF5A Riz yassa',
    '\uD83C\uDF5A Riz sauce tomate',

    // \uD83C\uDF56 YASSA (PLATS CITRONNÉS)
    '\uD83C\uDF56 Yassa poulet (poulet citronné + oignons)',
    '\uD83C\uDF56 Yassa poisson',
    '\uD83C\uDF56 Yassa agneau',
    '\uD83C\uDF56 Yassa bœuf',
    '\uD83C\uDF56 Yassa gambas',
    '\uD83C\uDF56 Yassa mixte (poulet + poisson)',

    // \uD83E\uDD58 SAUCES & RAGOÛTS TRADITIONNELS
    '\uD83E\uDD58 Mafé poulet (sauce arachide)',
    '\uD83E\uDD58 Mafé viande',
    '\uD83E\uDD58 Mafé poisson',
    '\uD83E\uDD58 Domoda (ragoût arachide)',
    '\uD83E\uDD58 Caldou (sauce blanche au poisson)',
    '\uD83E\uDD58 Soupe Kandia (gombo + huile palme)',
    '\uD83E\uDD58 Soupoukandja (gombo + poisson)',
    '\uD83E\uDD58 Bassi salté (couscous mil + sauce)',
    '\uD83E\uDD58 Lakhou bissap (couscous mil au bissap)',
    '\uD83E\uDD58 Lakhou guerte (sauce arachide + mil)',
    '\uD83E\uDD58 Sauce gombo',
    '\uD83E\uDD58 Sauce d\'oseille (bissap)',
    '\uD83E\uDD58 Sauce feuilles de manioc',
    '\uD83E\uDD58 Sauce n\'ététou (soumbala)',

    // \uD83C\uDF3E COUSCOUS & MIL
    '\uD83C\uDF3E Thiéré bassi salté (couscous mil + sauce)',
    '\uD83C\uDF3E Thiakry / Chakery (couscous mil sucré au lait)',
    '\uD83C\uDF3E Thiéré bou diack (couscous mil + viande)',
    '\uD83C\uDF3E Couscous de mil nature',
    '\uD83C\uDF3E Bouillie de mil',

    // \uD83D\uDC1F POISSONS & FRUITS DE MER
    '\uD83D\uDC1F Poisson braisé Saint-Louis',
    '\uD83D\uDC1F Poisson fumé',
    '\uD83D\uDC1F Poisson yassa',
    '\uD83D\uDC1F Poisson thiof farci',
    '\uD83D\uDC1F Mérou grillé',
    '\uD83D\uDC1F Capitaine braisé',
    '\uD83E\uDD90 Gambas grillées',
    '\uD83E\uDD90 Crevettes à la Saint-Louisienne',
    '\uD83E\uDD9E Langouste grillée',
    '\uD83E\uDD91 Poulpe à la sauce tomate',

    // \uD83E\uDD69 GRILLADES & VIANDES
    '\uD83E\uDD69 Dibi (mouton grillé)',
    '\uD83E\uDD69 Dibi bœuf',
    '\uD83E\uDD69 Dibi haako (mouton grillé traditionnel)',
    '\uD83C\uDF57 Poulet yassa',
    '\uD83C\uDF57 Poulet DG sénégalais',
    '\uD83C\uDF57 Poulet rôti',
    '\uD83C\uDF57 Poulet bicyclette',
    '\uD83E\uDD69 Brochettes de bœuf',
    '\uD83D\uDC0F Brochettes de mouton',

    // \uD83E\uDD50 STREET FOOD & COLLATIONS
    '\uD83E\uDD50 Fataya (chausson viande/poisson)',
    '\uD83E\uDD50 Fataya au thon',
    '\uD83E\uDD50 Fataya au poulet',
    '\uD83E\uDD50 Nems sénégalais',
    '\uD83E\uDD50 Pastels (beignets poisson)',
    '\uD83E\uDD50 Accara / Akara (beignets niébé)',
    '\uD83E\uDD50 Beignets sucrés',
    '\uD83E\uDD50 Beignets de haricots',
    '\uD83C\uDF2D Sandwichs dakarois',
    '\uD83C\uDF2D Chawarma sénégalais',
    '\uD83E\uDD5A Omelette sénégalaise',
    '\uD83E\uDD5A Œufs mayo',
    '\uD83C\uDF3D Maïs grillé / Maïs bouilli',

    // \uD83E\uDD63 SOUPES & BOUILLONS
    '\uD83E\uDD63 Soupe de poisson',
    '\uD83E\uDD63 Caldou blanc',
    '\uD83E\uDD63 Soupe kandia',
    '\uD83E\uDD63 Mbaxal (soupe de mil)',

    // \uD83C\uDF70 DESSERTS & SUCRERIES
    '\uD83C\uDF70 Thiakry (dessert couscous mil)',
    '\uD83C\uDF70 Ngalakh (pâte arachide + mil)',
    '\uD83C\uDF70 Chakery au lait caillé',
    '\uD83C\uDF70 Sombi (dessert riz au lait)',
    '\uD83C\uDF69 Cinq centimes (beignets ronds)',
    '\uD83E\uDD65 Thiéré sésame',

    '\uD83C\uDD95 Autre plat sénégalais (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDDF2\uD83C\uDDF1 PLATS MALIENS (50+ plats authentiques)
  // ===============================================
  plats_maliens: [
    // \uD83C\uDF5A RIZ & CÉRÉALES
    '\uD83C\uDF5A Tô (pâte de mil/sorgho + sauce)',
    '\uD83C\uDF5A Tô de mil',
    '\uD83C\uDF5A Tô de sorgho',
    '\uD83C\uDF5A Riz djolof malien / Riz au gras',
    '\uD83C\uDF5A Riz sauce',
    '\uD83C\uDF5A Riz sauce tomate',
    '\uD83C\uDF3E Fonio (céréale ancestrale)',
    '\uD83C\uDF3E Fonio sauce',
    '\uD83C\uDF3E Couscous de mil',
    '\uD83C\uDF3E Bouillie de mil',
    '\uD83C\uDF3E Bouillie de fonio',

    // \uD83E\uDD58 SAUCES & RAGOÛTS
    '\uD83E\uDD58 Tigua dega (sauce arachide malienne)',
    '\uD83E\uDD58 Maafé malien (sauce arachide)',
    '\uD83E\uDD58 Sauce d\'oseille / Djenkourou',
    '\uD83E\uDD58 Sauce gombo malienne',
    '\uD83E\uDD58 Sauce feuilles de baobab',
    '\uD83E\uDD58 Sauce tomate malienne',
    '\uD83E\uDD58 Sauce arachide viande',
    '\uD83E\uDD58 Tiga dege na (arachide + viande)',

    // \uD83C\uDF56 VIANDES & GRILLADES
    '\uD83C\uDF56 Poulet à la malienne',
    '\uD83C\uDF56 Poulet yassa malien',
    '\uD83E\uDD69 Viande de bœuf séchée / Kilichi',
    '\uD83E\uDD69 Suya malien (brochettes épicées)',
    '\uD83E\uDD69 Brochettes de bœuf',
    '\uD83D\uDC0F Mouton grillé / Méchowi',
    '\uD83D\uDC0F Brochettes de mouton',
    '\uD83D\uDC10 Viande de chèvre sauce',

    // \uD83D\uDC1F POISSONS
    '\uD83D\uDC1F Capitaine braisé (poisson du Niger)',
    '\uD83D\uDC1F Poisson fumé sauce',
    '\uD83D\uDC1F Poisson séché en sauce',
    '\uD83D\uDC1F Poisson frit malien',

    // \uD83E\uDD50 STREET FOOD & COLLATIONS
    '\uD83E\uDD50 Beignets de mil',
    '\uD83E\uDD50 Beignets de niébé',
    '\uD83E\uDD50 Masa (galettes de riz)',
    '\uD83E\uDD50 Degué (yaourt + mil)',
    '\uD83E\uDD5A Omelette malienne',
    '\uD83C\uDF3D Maïs grillé',
    '\uD83E\uDD5C Arachides grillées',

    // \uD83C\uDF70 DESSERTS & BOISSONS
    '\uD83C\uDF70 Dégué (couscous mil + lait)',
    '\uD83C\uDF70 Thiakry malien',
    '\uD83C\uDF79 Jus de tamarin',
    '\uD83C\uDF79 Jus de bissap',
    '\uD83C\uDF79 Dableni (jus hibiscus + gingembre)',

    '\uD83C\uDD95 Autre plat malien (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDDEC\uD83C\uDDE6 PLATS GABONAIS (45+ plats authentiques)
  // ===============================================
  plats_gabonais: [
    // \uD83E\uDD58 PLATS SIGNATURE GABONAIS
    '\uD83E\uDD58 Nyembwé (sauce graine de courge)',
    '\uD83E\uDD58 Poulet Nyembwé',
    '\uD83E\uDD58 Poisson Nyembwé',
    '\uD83E\uDD58 Viande Nyembwé',
    '\uD83E\uDD58 Poulet Moambe (sauce palme)',
    '\uD83E\uDD58 Poisson Moambe',
    '\uD83E\uDD58 Odika (sauce mangue sauvage)',
    '\uD83E\uDD58 Sauce feuilles de manioc',
    '\uD83E\uDD58 Sauce gombo gabonaise',
    '\uD83E\uDD58 Sauce arachide',

    // \uD83D\uDC1F POISSONS & FRUITS DE MER
    '\uD83D\uDC1F Poisson fumé gabonais',
    '\uD83D\uDC1F Poisson salé sauce',
    '\uD83D\uDC1F Capitaine grillé',
    '\uD83D\uDC1F Capitaine braisé',
    '\uD83D\uDC1F Makayabu (morue salée)',
    '\uD83D\uDC1F Poisson braisé sauce tomate',
    '\uD83E\uDD90 Crevettes de Libreville',
    '\uD83E\uDD90 Crevettes sauce tomate',
    '\uD83E\uDD80 Crabes sauce',
    '\uD83D\uDC1A Huîtres fraîches',

    // \uD83C\uDF56 VIANDES & GRILLADES
    '\uD83E\uDD69 Viande boucanée (fumée)',
    '\uD83E\uDD69 Bœuf sauté',
    '\uD83D\uDC10 Chèvre sauce tomate',
    '\uD83D\uDC10 Chèvre moambe',
    '\uD83C\uDF57 Poulet bicyclette',
    '\uD83C\uDF57 Poulet braisé gabonais',
    '\uD83E\uDD69 Brochettes de bœuf',
    '\uD83D\uDC0F Brochettes de mouton',

    // \uD83C\uDF5A FÉCULENTS & ACCOMPAGNEMENTS
    '\uD83C\uDF4C Banane plantain frite',
    '\uD83C\uDF4C Banane bouillie',
    '\uD83C\uDF4C Plantain mûr grillé',
    '\uD83E\uDD54 Manioc bouilli',
    '\uD83E\uDD54 Bâton de manioc',
    '\uD83E\uDD54 Tapioca',
    '\uD83E\uDD54 Foufou de manioc',
    '\uD83C\uDF60 Igname bouillie',
    '\uD83C\uDF60 Macabo bouilli',
    '\uD83C\uDF5A Riz blanc',
    '\uD83C\uDF5A Riz sauce gabonaise',
    '\uD83C\uDF5A Riz jollof gabonais',

    // \uD83E\uDD50 STREET FOOD & COLLATIONS
    '\uD83E\uDD50 Beignets gabonais',
    '\uD83E\uDD50 Beignets de banane',
    '\uD83E\uDD5A Omelette gabonaise',

    '\uD83C\uDD95 Autre plat gabonais (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDDE8\uD83C\uDDEC PLATS CONGOLAIS RDC/RC (60+ plats authentiques)
  // ===============================================
  plats_congolais: [
    // \uD83E\uDD58 PLATS SIGNATURE CONGOLAIS
    '\uD83E\uDD58 Moambe chicken (poulet sauce palme)',
    '\uD83E\uDD58 Pondu / Saka-saka (feuilles de manioc pilées)',
    '\uD83E\uDD58 Liboke de poisson (poisson en papillote)',
    '\uD83E\uDD58 Liboke de viande',
    '\uD83E\uDD58 Liboke de poulet',
    '\uD83E\uDD58 Fumbwa (épinards sauvages)',
    '\uD83E\uDD58 Madesu (haricots sauce palme)',
    '\uD83E\uDD58 Ntaba (viande de chèvre)',
    '\uD83E\uDD58 Sauce feuilles de patate',
    '\uD83E\uDD58 Sauce gombo congolaise',
    '\uD83E\uDD58 Sauce arachide',

    // \uD83D\uDC1F POISSONS & FRUITS DE MER
    '\uD83D\uDC1F Poisson salé (makayabu/makayabo)',
    '\uD83D\uDC1F Capitaine entier braisé',
    '\uD83D\uDC1F Capitaine liboke',
    '\uD83D\uDC1F Tilapia braisé',
    '\uD83D\uDC1F Tilapia frit',
    '\uD83D\uDC1F Poisson fumé',
    '\uD83D\uDC1F Sambaza (petits poissons frits)',
    '\uD83E\uDD90 Crevettes du fleuve Congo',
    '\uD83E\uDD90 Crevettes moambe',

    // \uD83C\uDF56 VIANDES & GRILLADES
    '\uD83E\uDD69 Maboke (viande marinée grillée)',
    '\uD83E\uDD69 Chèvre sautée congolaise',
    '\uD83E\uDD69 Chèvre moambe',
    '\uD83E\uDD69 Bœuf sauté',
    '\uD83E\uDD69 Ntaba (chèvre)',
    '\uD83C\uDF57 Poulet moambe',
    '\uD83C\uDF57 Poulet liboke',
    '\uD83C\uDF57 Poulet bicyclette',
    '\uD83E\uDD69 Brochettes de bœuf',
    '\uD83E\uDD69 Brochettes de chèvre',
    '\uD83D\uDC0F Mosapia (chenilles)',

    // \uD83C\uDF5A FÉCULENTS & ACCOMPAGNEMENTS
    '\uD83E\uDD54 Foufou de maïs',
    '\uD83E\uDD54 Foufou de manioc',
    '\uD83E\uDD54 Fufu blanc',
    '\uD83C\uDF56 Chikwangue (pain de manioc)',
    '\uD83C\uDF56 Kwanga (pain de manioc fermenté)',
    '\uD83E\uDD54 Bidia (farine de manioc)',
    '\uD83C\uDF4C Plantain frit / Makemba',
    '\uD83C\uDF4C Banane bouillie',
    '\uD83C\uDF4C Plantain bouilli',
    '\uD83C\uDF60 Igname pilée',
    '\uD83C\uDF60 Pondu na makemba (feuilles + plantain)',
    '\uD83C\uDF5A Riz blanc',
    '\uD83C\uDF5A Riz congolais sauce',
    '\uD83C\uDF5A Riz moambe',

    // \uD83E\uDD50 STREET FOOD & COLLATIONS
    '\uD83E\uDD50 Mikate (beignets congolais)',
    '\uD83E\uDD50 Pâté congolais',
    '\uD83E\uDD50 Mandazi (beignets sucrés)',
    '\uD83E\uDD50 Beignets de banane',
    '\uD83E\uDD5A Omelette congolaise',
    '\uD83C\uDF3D Maïs grillé / Mayi ya kalonji',
    '\uD83E\uDD5C Arachides grillées',

    // \uD83E\uDD63 SOUPES & RAGOÛTS
    '\uD83E\uDD63 Soupe de poisson',
    '\uD83E\uDD63 Soupe fumbwa',
    '\uD83E\uDD63 Soupe pondu',

    '\uD83C\uDD95 Autre plat congolais (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDDE7\uD83C\uDDEB PLATS BURKINABÈ (40+ plats authentiques)
  // ===============================================
  plats_burkinabe: [
    // \uD83C\uDF5A RIZ & CÉRÉALES
    '\uD83C\uDF5A Riz gras burkinabè / Riz au gras',
    '\uD83C\uDF5A Riz sauce tomate',
    '\uD83C\uDF5A Riz sauce arachide',
    '\uD83C\uDF3E Tô de mil (pâte de mil)',
    '\uD83C\uDF3E Tô de sorgho',
    '\uD83C\uDF3E Tô de maïs',
    '\uD83C\uDF3E Couscous de mil',
    '\uD83C\uDF3D Bouillie de mil',
    '\uD83C\uDF3D Zoom-koom (bouillie mil froide)',

    // \uD83E\uDD58 SAUCES & RAGOÛTS
    '\uD83E\uDD58 Sauce gombo burkinabè',
    '\uD83E\uDD58 Sauce tomate burkinabè',
    '\uD83E\uDD58 Sauce d\'oseille / Binga',
    '\uD83E\uDD58 Sauce arachide',
    '\uD83E\uDD58 Sauce feuilles de baobab',
    '\uD83E\uDD58 Riz sauce',
    '\uD83E\uDD58 Tô sauce',

    // \uD83C\uDF56 VIANDES & GRILLADES
    '\uD83C\uDF56 Poulet bicyclette',
    '\uD83C\uDF56 Poulet braisé burkinabè',
    '\uD83C\uDF56 Poulet yassa',
    '\uD83D\uDC1F Poisson braisé du Burkina',
    '\uD83D\uDC1F Poisson fumé',
    '\uD83E\uDD69 Brochettes / Choukouya',
    '\uD83E\uDD69 Soumbala (condiment fermenté)',
    '\uD83E\uDD69 Viande séchée',
    '\uD83D\uDC0F Mouton grillé',
    '\uD83D\uDC10 Chèvre sautée',

    // \uD83E\uDD50 STREET FOOD & COLLATIONS
    '\uD83E\uDD50 Beignets de mil',
    '\uD83E\uDD50 Beignets de niébé',
    '\uD83E\uDD50 Galettes de mil',
    '\uD83E\uDD50 Wagashi (fromage peul local)',
    '\uD83E\uDD5A Omelette burkinabè',
    '\uD83C\uDF3D Maïs grillé',
    '\uD83E\uDD5C Arachides grillées',

    // \uD83C\uDF70 DESSERTS & BOISSONS
    '\uD83C\uDF70 Dégué burkinabè (yaourt + mil)',
    '\uD83C\uDF79 Zoom-koom (jus de mil)',
    '\uD83C\uDF79 Jus de bissap',
    '\uD83C\uDF79 Jus de tamarin',

    '\uD83C\uDD95 Autre plat burkinabè (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDF0D AUTRES PAYS AFRIQUE FRANCOPHONE (80+ plats)
  // ===============================================
  plats_autres_pays: [
    // \uD83C\uDDF9\uD83C\uDDEC TOGO (20+ plats)
    '\uD83C\uDDF9\uD83C\uDDEC Fufu togolais / Akumè',
    '\uD83C\uDDF9\uD83C\uDDEC Akoumé (pâte de maïs)',
    '\uD83C\uDDF9\uD83C\uDDEC Akoumé sauce',
    '\uD83C\uDDF9\uD83C\uDDEC Djenkoumé (pâte igname)',
    '\uD83C\uDDF9\uD83C\uDDEC Ablo (galettes de riz fermentées)',
    '\uD83C\uDDF9\uD83C\uDDEC Amiwo (riz + tomate + crevettes)',
    '\uD83C\uDDF9\uD83C\uDDEC Gboma dessi (épinards)',
    '\uD83C\uDDF9\uD83C\uDDEC Atassi (riz + haricots)',
    '\uD83C\uDDF9\uD83C\uDDEC Ademe (sauce tomate togolaise)',
    '\uD83C\uDDF9\uD83C\uDDEC Kpété kpété (sauce gombo)',
    '\uD83C\uDDF9\uD83C\uDDEC Poisson braisé togolais',
    '\uD83C\uDDF9\uD83C\uDDEC Poulet braisé togolais',
    '\uD83C\uDDF9\uD83C\uDDEC Sauce arachide togolaise',
    '\uD83C\uDDF9\uD83C\uDDEC Klako (beignets de maïs)',

    // \uD83C\uDDE7\uD83C\uDDEF BÉNIN (20+ plats)
    '\uD83C\uDDE7\uD83C\uDDEF Akassa (pâte de maïs fermentée)',
    '\uD83C\uDDE7\uD83C\uDDEF Atassi (riz + haricots rouges)',
    '\uD83C\uDDE7\uD83C\uDDEF Amiwo (tomate + crevettes)',
    '\uD83C\uDDE7\uD83C\uDDEF Wagassi (fromage peul)',
    '\uD83C\uDDE7\uD83C\uDDEF Agouti (viande de brousse)',
    '\uD83C\uDDE7\uD83C\uDDEF Sauce graine béninoise',
    '\uD83C\uDDE7\uD83C\uDDEF Sauce gombo',
    '\uD83C\uDDE7\uD83C\uDDEF Ablo (gâteau de riz fermenté)',
    '\uD83C\uDDE7\uD83C\uDDEF Tchoukoutou (bière de mil)',
    '\uD83C\uDDE7\uD83C\uDDEF Fon fon (beignets haricots)',
    '\uD83C\uDDE7\uD83C\uDDEF Poisson fumé béninois',
    '\uD83C\uDDE7\uD83C\uDDEF Poulet bicyclette béninois',
    '\uD83C\uDDE7\uD83C\uDDEF Igname pilée béninoise',
    '\uD83C\uDDE7\uD83C\uDDEF Gari (semoule manioc)',

    // \uD83C\uDDF3\uD83C\uDDEA NIGER (15+ plats)
    '\uD83C\uDDF3\uD83C\uDDEA Dambou (couscous légumes)',
    '\uD83C\uDDF3\uD83C\uDDEA Jollof nigérien',
    '\uD83C\uDDF3\uD83C\uDDEA Riz sauce nigérienne',
    '\uD83C\uDDF3\uD83C\uDDEA Tô de mil nigérien',
    '\uD83C\uDDF3\uD83C\uDDEA Foura (bouillie mil)',
    '\uD83C\uDDF3\uD83C\uDDEA Kilishi (viande séchée)',
    '\uD83C\uDDF3\uD83C\uDDEA Tchoukou (jus de mil)',
    '\uD83C\uDDF3\uD83C\uDDEA Fura da nono (mil + lait)',
    '\uD83C\uDDF3\uD83C\uDDEA Kopto (brochettes)',
    '\uD83C\uDDF3\uD83C\uDDEA Capitaine braisé Niger',
    '\uD83C\uDDF3\uD83C\uDDEA Sauce gombo',
    '\uD83C\uDDF3\uD83C\uDDEA Maafé nigérien',

    // \uD83C\uDDF9\uD83C\uDDE9 TCHAD (15+ plats)
    '\uD83C\uDDF9\uD83C\uDDE9 Boule (pâte de mil tchadienne)',
    '\uD83C\uDDF9\uD83C\uDDE9 Daraba (gombo + viande)',
    '\uD83C\uDDF9\uD83C\uDDE9 Bangaou (viande séchée)',
    '\uD83C\uDDF9\uD83C\uDDE9 Jarret de bœuf',
    '\uD83C\uDDF9\uD83C\uDDE9 Capitaine du lac Tchad',
    '\uD83C\uDDF9\uD83C\uDDE9 Poisson fumé tchadien',
    '\uD83C\uDDF9\uD83C\uDDE9 Sauce gombo tchadienne',
    '\uD83C\uDDF9\uD83C\uDDE9 Bouillie de mil',
    '\uD83C\uDDF9\uD83C\uDDE9 Brochettes tchadiennes',
    '\uD83C\uDDF9\uD83C\uDDE9 Aiyash (viande séchée pilée)',
    '\uD83C\uDDF9\uD83C\uDDE9 Karantika (galette pois chiche)',

    // \uD83C\uDDF2\uD83C\uDDEC MADAGASCAR (15+ plats)
    '\uD83C\uDDF2\uD83C\uDDEC Romazava (ragoût malgache)',
    '\uD83C\uDDF2\uD83C\uDDEC Ravitoto (feuilles de manioc + porc)',
    '\uD83C\uDDF2\uD83C\uDDEC Vary amin\'anana (riz + brèdes)',
    '\uD83C\uDDF2\uD83C\uDDEC Henakisoa (porc à la malgache)',
    '\uD83C\uDDF2\uD83C\uDDEC Zebu grillé',
    '\uD83C\uDDF2\uD83C\uDDEC Akoho sy voanio (poulet coco)',
    '\uD83C\uDDF2\uD83C\uDDEC Lasary (salade malgache)',
    '\uD83C\uDDF2\uD83C\uDDEC Mofo gasy (pain malgache)',
    '\uD83C\uDDF2\uD83C\uDDEC Koba (gâteau arachide + banane)',
    '\uD83C\uDDF2\uD83C\uDDEC Sambos (samoussas)',
    '\uD83C\uDDF2\uD83C\uDDEC Tilapia à la malgache',
    '\uD83C\uDDF2\uD83C\uDDEC Vary sosoa (soupe de riz)',

    '\uD83C\uDD95 Autre pays africain (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDF55 CUISINE INTERNATIONALE
  // ===============================================
  plats_internationaux: [
    // Italien
    '\uD83C\uDF55 Pizza Margherita',
    '\uD83C\uDF55 Pizza 4 fromages',
    '\uD83C\uDF55 Pizza pepperoni',
    '\uD83C\uDF5D Spaghetti Bolognese',
    '\uD83C\uDF5D Carbonara',
    '\uD83C\uDF5D Penne Arrabiata',
    '\uD83C\uDF5D Lasagnes',

    // Fast-food
    '\uD83C\uDF54 Burger classique',
    '\uD83C\uDF54 Cheeseburger',
    '\uD83C\uDF54 Chicken burger',
    '\uD83C\uDF5F Frites',
    '\uD83C\uDF2D Hot-dog',
    '\uD83E\uDD6A Sandwich club',
    '\uD83E\uDD59 Wrap poulet',
    '\uD83E\uDD59 Tacos',

    // Asiatique
    '\uD83C\uDF5C Riz cantonnais',
    '\uD83C\uDF5C Nouilles sautées',
    '\uD83C\uDF5C Nems / Rouleaux de printemps',
    '\uD83C\uDF5C Riz sauté poulet/crevettes',
    '\uD83C\uDF71 Sushi / Maki',
    '\uD83E\uDD5F Gyoza / Raviolis',

    // Libanais/Moyen-Orient
    '\uD83E\uDD59 Chawarma poulet/viande',
    '\uD83E\uDD59 Falafel',
    '\uD83E\uDD59 Houmous + pain pita',
    '\uD83E\uDD59 Taboulé',
    '\uD83E\uDD59 Grillades libanaises',

    // Français
    '\uD83E\uDD56 Croissant',
    '\uD83E\uDD56 Pain au chocolat',
    '\uD83E\uDD50 Baguette française',
    '\uD83C\uDF70 Pâtisseries françaises',

    '\uD83C\uDD95 Autre international (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDF79 BOISSONS & DESSERTS LOCAUX
  // ===============================================
  boissons_locales: [
    // Jus naturels
    '\uD83E\uDD6D Jus de mangue',
    '\uD83C\uDF4D Jus d\'ananas',
    '\uD83C\uDF4A Jus d\'orange pressée',
    '\uD83C\uDF4B Citronnade / Jus de citron',
    '\uD83E\uDD65 Jus de coco / Eau de coco',
    '\uD83C\uDF49 Jus de pastèque',
    '\uD83E\uDD6D Jus de goyave',
    '\uD83C\uDF47 Jus de bissap (hibiscus)',
    '\uD83C\uDF3E Jus de gingembre',
    '\uD83E\uDD64 Jus de tamarin',
    '\uD83E\uDD64 Jus de baobab (pain de singe)',

    // Boissons traditionnelles
    '\uD83C\uDF7A Bil-bil (bière de mil)',
    '\uD83C\uDF7A Tchapalo (bière de maïs)',
    '\uD83C\uDF7A Vin de palme / Bangui',
    '\uD83E\uDD5B Nkui (boisson fermentée)',

    // Modernes
    '☕ Café',
    '\uD83C\uDF75 Thé Lipton / Thé à la menthe',
    '\uD83E\uDD64 Soda (Coca, Fanta, Sprite)',
    '\uD83E\uDD64 Malta Guinness / Maltina',
    '\uD83E\uDDC3 Top Grenadine / Top Orange',

    '\uD83C\uDD95 Autre boisson (ajouter)'
  ],

  desserts_locaux: [
    '\uD83C\uDF70 Gâteau de banane',
    '\uD83E\uDDC1 Chin-chin (beignets croustillants)',
    '\uD83E\uDD67 Puff-puff sucré',
    '\uD83C\uDF6E Thiakry / Degué (couscous mil sucré)',
    '\uD83C\uDF6E Chakery sénégalais',
    '\uD83E\uDD65 Beignets de coco',
    '\uD83C\uDF4C Banane flambée',
    '\uD83C\uDF70 Gâteaux artisanaux locaux',
    '\uD83C\uDF66 Glace artisanale',
    '\uD83C\uDF70 Pâtisseries occidentales',
    '\uD83C\uDD95 Autre dessert (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDFEA TYPES DE CUISINE (Enrichis)
  // ===============================================
  types_cuisine: [
    // Africaine par pays
    '\uD83C\uDDE8\uD83C\uDDF2 Cuisine camerounaise',
    '\uD83C\uDDE8\uD83C\uDDEE Cuisine ivoirienne',
    '\uD83C\uDDF8\uD83C\uDDF3 Cuisine sénégalaise',
    '\uD83C\uDDF2\uD83C\uDDF1 Cuisine malienne',
    '\uD83C\uDDEC\uD83C\uDDE6 Cuisine gabonaise',
    '\uD83C\uDDE8\uD83C\uDDEC Cuisine congolaise',
    '\uD83C\uDDE7\uD83C\uDDEB Cuisine burkinabè',
    '\uD83C\uDDF9\uD83C\uDDEC Cuisine togolaise',
    '\uD83C\uDDE7\uD83C\uDDEF Cuisine béninoise',
    '\uD83C\uDDF3\uD83C\uDDEA Cuisine nigérienne',
    '\uD83C\uDDF9\uD83C\uDDE9 Cuisine tchadienne',
    '\uD83C\uDDF2\uD83C\uDDEC Cuisine malgache',
    '\uD83C\uDF0D Cuisine africaine (générale)',

    // Internationale
    '\uD83C\uDDEB\uD83C\uDDF7 Cuisine française',
    '\uD83C\uDDEE\uD83C\uDDF9 Cuisine italienne',
    '\uD83C\uDDE8\uD83C\uDDF3 Cuisine chinoise',
    '\uD83C\uDDEF\uD83C\uDDF5 Cuisine japonaise',
    '\uD83C\uDDF1\uD83C\uDDE7 Cuisine libanaise',
    '\uD83C\uDDEE\uD83C\uDDF3 Cuisine indienne',
    '\uD83C\uDDF2\uD83C\uDDFD Cuisine mexicaine',
    '\uD83C\uDDFA\uD83C\uDDF8 Cuisine américaine',
    '\uD83C\uDF54 Fast-food',

    // Spécialités
    '\uD83C\uDF56 Grillades / BBQ',
    '\uD83D\uDC1F Poissons & fruits de mer',
    '\uD83C\uDF55 Pizzas',
    '\uD83E\uDD57 Salades & Healthy',
    '\uD83C\uDF31 Végétarienne',
    '\uD83C\uDF3F Vegan',
    '☪️ Halal',
    '✡️ Kasher',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ===============================================
  // \uD83D\uDCBC SERVICES PROPOSÉS
  // ===============================================
  services: [
    '\uD83C\uDF7D️ Service sur place',
    '\uD83D\uDCE6 Plats à emporter',
    '\uD83D\uDE97 Livraison à domicile',
    '\uD83C\uDF89 Traiteur événementiel (mariages, baptêmes)',
    '\uD83C\uDFE2 Traiteur entreprise (séminaires, pause-café)',
    '\uD83C\uDF71 Buffet sur mesure',
    '\uD83E\uDD58 Commandes groupées',
    '\uD83D\uDCC5 Réservations de tables',
    '\uD83C\uDF82 Gâteaux sur commande',
    '\uD83C\uDF70 Pâtisserie événementielle',
    '☕ Service petit-déjeuner',
    '\uD83C\uDF7D️ Brunch',
    '\uD83C\uDF19 Service nocturne',
    '\uD83C\uDD95 Autre service (ajouter)'
  ],

  // ===============================================
  // \uD83D\uDCB0 GAMMES DE PRIX
  // ===============================================
  gammes_prix: [
    '\uD83D\uDCB0 Économique (500-1500 FCFA)',
    '\uD83D\uDCB0\uD83D\uDCB0 Abordable (1500-3000 FCFA)',
    '\uD83D\uDCB0\uD83D\uDCB0\uD83D\uDCB0 Moyen (3000-6000 FCFA)',
    '\uD83D\uDCB0\uD83D\uDCB0\uD83D\uDCB0\uD83D\uDCB0 Élevé (6000-12000 FCFA)',
    '\uD83D\uDCB0\uD83D\uDCB0\uD83D\uDCB0\uD83D\uDCB0\uD83D\uDCB0 Premium (> 12000 FCFA)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ===============================================
  // \uD83D\uDD50 HORAIRES DE SERVICE
  // ===============================================
  horaires: [
    '\uD83C\uDF05 Petit-déjeuner (6h-11h)',
    '☀️ Déjeuner (11h-16h)',
    '\uD83C\uDF06 Dîner (18h-23h)',
    '\uD83C\uDF7D️ Service continu (11h-23h)',
    '\uD83C\uDF19 Service nocturne (20h-4h)',
    '⏰ 24h/24',
    '\uD83D\uDCC5 Week-ends uniquement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDFAF RÉGIMES ALIMENTAIRES SPÉCIAUX
  // ===============================================
  regimes: [
    '☪️ Halal certifié',
    '✡️ Kasher',
    '\uD83C\uDF31 Végétarien',
    '\uD83C\uDF3F Vegan (100% végétal)',
    '\uD83C\uDF3E Sans gluten',
    '\uD83E\uDD5B Sans lactose',
    '\uD83E\uDD57 Bio / Produits locaux',
    '❤️ Diabétique / Faible en sucre',
    '\uD83D\uDCAA Hyperprotéiné / Fitness',
    '\uD83E\uDD57 Régime méditerranéen',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDFEA AMBIANCE & ÉQUIPEMENTS
  // ===============================================
  ambiance: [
    '\uD83D\uDC68‍\uD83D\uDC69‍\uD83D\uDC67‍\uD83D\uDC66 Familial',
    '\uD83D\uDC91 Romantique',
    '\uD83D\uDC54 Professionnel / Business',
    '\uD83C\uDF89 Festif / Événementiel',
    '\uD83C\uDF33 Terrasse / Jardin',
    '❄️ Climatisé',
    '\uD83D\uDCF6 Wi-Fi gratuit',
    '\uD83D\uDE97 Parking disponible',
    '♿ Accessible PMR',
    '\uD83C\uDFB5 Musique live',
    '\uD83D\uDCFA Écrans TV / Sports',
    '\uD83C\uDFAE Espace jeux enfants',
    '\uD83D\uDD0C Prises électriques',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ===============================================
  // \uD83D\uDCCD ZONES DE LIVRAISON (Cameroun - exemple)
  // ===============================================
  zones_livraison_douala: [
    'Akwa', 'Bonanjo', 'Bonapriso', 'Bali', 'Deido', 'New Bell',
    'Bonabéri', 'Logbaba', 'Makepe', 'PK8', 'PK10', 'PK12',
    'Ndogpassi', 'Kotto', 'Bépanda', 'Koumassi', 'Village',
    'Bonamoussadi', 'Logpom', 'Nyalla', 'Sodiko',
    '\uD83C\uDF0D Toute la ville de Douala',
    '\uD83C\uDD95 Autre quartier (ajouter)'
  ],

  zones_livraison_yaounde: [
    'Centre-ville', 'Bastos', 'Nlongkak', 'Essos', 'Mvan',
    'Odza', 'Emana', 'Elig-Edzoa', 'Mendong', 'Nsam',
    'Ngousso', 'Mokolo', 'Briqueterie', 'Tsinga', 'Ekounou',
    'Nkol-Eton', 'Omnisport', 'Carrière', 'Mvog-Ada',
    '\uD83C\uDF0D Tout Yaoundé',
    '\uD83C\uDD95 Autre quartier (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDF96️ CERTIFICATIONS & LABELS
  // ===============================================
  certifications: [
    '✅ Agréé par le Ministère de la Santé',
    '✅ Certification Halal',
    '✅ Hygiène HACCP',
    '✅ ISO 22000 (Sécurité alimentaire)',
    '\uD83C\uDFC6 Restaurant recommandé',
    '⭐ Classement étoiles (1-5)',
    '\uD83C\uDF31 Produits bio certifiés',
    '\uD83C\uDDE8\uD83C\uDDF2 Label Made in Cameroon',
    '\uD83C\uDD95 Autre certification (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDF81 PROMOTIONS & AVANTAGES
  // ===============================================
  promotions: [
    '\uD83C\uDF89 Promotion du jour',
    '\uD83D\uDCC5 Menu du midi réduit',
    '\uD83D\uDC68‍\uD83D\uDC69‍\uD83D\uDC67‍\uD83D\uDC66 Offre famille',
    '\uD83D\uDC91 Menu Saint-Valentin',
    '\uD83C\uDF82 Anniversaires (réduction)',
    '\uD83C\uDF70 Dessert offert',
    '\uD83E\uDD64 Boisson offerte',
    '\uD83D\uDCE6 Livraison gratuite (à partir de...)',
    '\uD83D\uDCB3 Carte de fidélité',
    '\uD83C\uDF81 Programme de parrainage',
    '\uD83C\uDD95 Autre promotion (ajouter)'
  ],

  // ===============================================
  // \uD83D\uDC68‍\uD83C\uDF73 ÉQUIPE & SPÉCIALISATION
  // ===============================================
  specialisation_chef: [
    '\uD83D\uDC68‍\uD83C\uDF73 Chef camerounais traditionnel',
    '\uD83D\uDC68‍\uD83C\uDF73 Chef cuisine africaine',
    '\uD83D\uDC68‍\uD83C\uDF73 Chef cuisine française',
    '\uD83D\uDC68‍\uD83C\uDF73 Chef pâtissier',
    '\uD83D\uDC68‍\uD83C\uDF73 Chef grillades/BBQ',
    '\uD83D\uDC68‍\uD83C\uDF73 Chef cuisine internationale',
    '\uD83D\uDC68‍\uD83C\uDF73 Cuisinier autodidacte passionné',
    '\uD83C\uDF93 Formation hôtelière',
    '\uD83C\uDF93 École de cuisine professionnelle',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ===============================================
  // \uD83D\uDCF8 CAPACITÉ & INFRASTRUCTURE
  // ===============================================
  capacite_accueil: [
    '\uD83D\uDC65 Petit (1-20 personnes)',
    '\uD83D\uDC65 Moyen (20-50 personnes)',
    '\uD83D\uDC65 Grand (50-100 personnes)',
    '\uD83D\uDC65 Très grand (100-200 personnes)',
    '\uD83D\uDC65 Événementiel (200-500+ personnes)',
    '\uD83C\uDD95 Autre capacité (ajouter)'
  ],

  type_clientele: [
    '\uD83D\uDC68‍\uD83D\uDC69‍\uD83D\uDC67‍\uD83D\uDC66 Familles',
    '\uD83D\uDCBC Professionnels / Entreprises',
    '\uD83C\uDF93 Étudiants',
    '\uD83D\uDC54 Clientèle haut de gamme',
    '\uD83C\uDF0D Expatriés',
    '\uD83E\uDDF3 Touristes',
    '\uD83C\uDF89 Événements privés',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ÉLECTRONIQUE
export const ELECTRONIQUE_MODALITIES: ModalityCategory = {
  // Types d'appareils
  types: [
    'Smartphone', 'Tablette', 'Ordinateur portable', 'PC de bureau', 'Télévision',
    'Console de jeux', 'Appareil photo', 'Caméra', 'Drone', 'Montre connectée',
    'Écouteurs', 'Casque audio', 'Enceinte', 'Chargeur', 'Batterie externe',
    'Accessoires', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Sony', 'LG', 'Panasonic', 'Canon',
    'Nikon', 'DJI', 'Bose', 'JBL', 'Beats', 'Anker', 'Belkin', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // États
  etats: [
    'Neuf sous garantie', 'Neuf sans garantie', 'Reconditionné', 'Occasion - Excellent',
    'Occasion - Bon', 'Occasion - Moyen', 'Pour pièces', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Connectivité
  connectivite: [
    'Wi-Fi', 'Bluetooth', '4G', '5G', 'NFC', 'USB-C', 'Lightning', 'HDMI',
    'Jack 3.5mm', 'USB', 'Ethernet', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ════════════════════════════════════════════════════════════
// ✅ MODALITÉS SOUTIEN SCOLAIRE / RÉPÉTITEUR - AFRIQUE FRANCOPHONE
// ════════════════════════════════════════════════════════════
// \uD83D\uDCDA Contexte : Cours particuliers primaire/secondaire, Aide aux devoirs,
//              Rattrapage scolaire, Soutien niveau Maternelle → Terminale
// \uD83C\uDFAF DIFFÉRENT DE : Formation professionnelle et Préparation concours (formation_education)
// \uD83C\uDF0D Zones : Cameroun, Côte d'Ivoire, Sénégal, Mali, RDC, Gabon, Congo, etc.
// ════════════════════════════════════════════════════════════
export const SOUTIEN_SCOLAIRE_MODALITIES: ModalityCategory = {

  // ✅ TYPES DE SOUTIEN SCOLAIRE (15+ options)
  types_soutien: [
    '─── \uD83D\uDCDA SOUTIEN SCOLAIRE CLASSIQUE ───',
    'Cours particuliers à domicile',
    'Cours particuliers en ligne',
    'Aide aux devoirs',
    'Rattrapage scolaire',
    'Révisions examens (BEPC, Probatoire, Bac)',
    'Cours de vacances intensifs',
    'Remise à niveau',
    'Méthodologie & organisation',

    '─── \uD83D\uDC65 FORMAT COURS ───',
    'Cours individuels (1 élève)',
    'Cours en binôme (2 élèves)',
    'Cours en petit groupe (3-5 élèves)',
    'Cours en groupe classe (6-15 élèves)',

    '\uD83C\uDD95 Autre type (préciser)'
  ],

  // ✅ NIVEAUX SCOLAIRES (Utilise genererNiveauxScolaires du système éducatif)
  // \uD83D\uDD04 Focus : Maternelle → Terminale (PAS université/grandes écoles)
  niveaux_scolaires: [
    '─── \uD83C\uDDE8\uD83C\uDDF2 MATERNELLE ───',
    '\uD83C\uDDE8\uD83C\uDDF2 Petite Section (3-4 ans)',
    '\uD83C\uDDE8\uD83C\uDDF2 Moyenne Section (4-5 ans)',
    '\uD83C\uDDE8\uD83C\uDDF2 Grande Section (5-6 ans)',

    '─── \uD83C\uDDE8\uD83C\uDDF2 PRIMAIRE ───',
    '\uD83C\uDDE8\uD83C\uDDF2 CP (Cours Préparatoire)',
    '\uD83C\uDDE8\uD83C\uDDF2 CE1',
    '\uD83C\uDDE8\uD83C\uDDF2 CE2',
    '\uD83C\uDDE8\uD83C\uDDF2 CM1',
    '\uD83C\uDDE8\uD83C\uDDF2 CM2',

    '─── \uD83C\uDDE8\uD83C\uDDF2 COLLÈGE ───',
    '\uD83C\uDDE8\uD83C\uDDF2 6ème',
    '\uD83C\uDDE8\uD83C\uDDF2 5ème',
    '\uD83C\uDDE8\uD83C\uDDF2 4ème',
    '\uD83C\uDDE8\uD83C\uDDF2 3ème',

    '─── \uD83C\uDDE8\uD83C\uDDF2 LYCÉE ───',
    '\uD83C\uDDE8\uD83C\uDDF2 Seconde',
    '\uD83C\uDDE8\uD83C\uDDF2 Première',
    '\uD83C\uDDE8\uD83C\uDDF2 Terminale',

    '──────────────────',
    '\uD83D\uDCDA Tous niveaux (Maternelle → Terminale)',
    '\uD83D\uDC76 Niveau Maternelle uniquement',
    '\uD83D\uDCD6 Niveau Primaire uniquement',
    '\uD83D\uDCD8 Niveau Collège uniquement',
    '\uD83D\uDCD5 Niveau Lycée uniquement',
    '\uD83C\uDD95 Autre niveau (préciser)'
  ],

  // ✅ MATIÈRES ENSEIGNÉES (30+ options - Focus primaire/secondaire)
  matieres_enseignees: [
    '─── \uD83D\uDCD0 SCIENCES & MATHÉMATIQUES ───',
    'Mathématiques',
    'Physique',
    'Chimie',
    'SVT (Sciences de la Vie et de la Terre)',
    'Sciences (primaire)',

    '─── \uD83D\uDCD6 LANGUES & LITTÉRATURE ───',
    'Français',
    'Anglais',
    'Espagnol',
    'Allemand',
    'Littérature',
    'Expression écrite',
    'Lecture & compréhension',

    '─── \uD83C\uDF0D SCIENCES HUMAINES ───',
    'Histoire-Géographie',
    'Histoire',
    'Géographie',
    'Éducation civique et morale (ECM)',
    'Philosophie (Terminale)',

    '─── \uD83D\uDCBC ÉCONOMIE & GESTION ───',
    'Sciences économiques et sociales (SES)',
    'Économie',
    'Comptabilité',
    'Gestion',

    '─── \uD83D\uDCBB AUTRES MATIÈRES ───',
    'Informatique',
    'Arts plastiques',
    'Éducation physique (Sport)',
    'Musique',

    '──────────────────',
    '\uD83D\uDCDA Aide aux devoirs (toutes matières)',
    '\uD83C\uDFAF Méthodologie & organisation',
    '\uD83D\uDCDD Préparation examens (BEPC, Probatoire, Bac)',
    '\uD83C\uDD95 Autre matière (préciser)'
  ],

  // ✅ FORMATS & MODALITÉS (15+ options)
  formats: [
    '─── \uD83D\uDCCD LIEU DES COURS ───',
    'À domicile (déplacement du répétiteur)',
    'Au domicile du répétiteur',
    'En ligne (visioconférence)',
    'Hybride (présentiel + en ligne)',
    'Dans un centre/école',

    '─── ⏰ PLANNING ───',
    'Séances régulières (1-2 fois/semaine)',
    'Stage intensif vacances',
    'Cours ponctuels (à la demande)',
    'Programme suivi sur plusieurs mois',

    '─── \uD83D\uDD50 CRÉNEAUX HORAIRES ───',
    'Après-midi (sortie école)',
    'Soir (18h-20h)',
    'Mercredi après-midi',
    'Week-end (samedi-dimanche)',
    'Vacances scolaires',

    '\uD83C\uDD95 Autre format (préciser)'
  ],

  // ✅ DURÉES DE SÉANCE (10+ options)
  durees_seance: [
    '1 heure (cours standard)',
    '1h30 (cours approfondi)',
    '2 heures (cours double)',
    '2h30',
    '3 heures',
    'Demi-journée (4 heures)',
    'Journée complète (6-8 heures)',
    'À définir selon besoins',
    '\uD83C\uDD95 Autre durée (préciser)'
  ],

  // ✅ TARIFICATION (15+ options)
  modes_tarification: [
    '─── \uD83D\uDCB0 PAR SÉANCE ───',
    'Tarif horaire (par heure)',
    'Tarif par séance (1h-2h)',
    'Forfait 5 séances',
    'Forfait 10 séances',
    'Forfait 20 séances',

    '─── \uD83D\uDCC5 PAR PÉRIODE ───',
    'Forfait mensuel (4 semaines)',
    'Forfait trimestriel (3 mois)',
    'Forfait semestre (6 mois)',
    'Forfait année scolaire (9 mois)',

    '─── \uD83C\uDFAF SPÉCIAL ───',
    'Stage vacances (prix global)',
    'Préparation examen (package complet)',
    'Tarif dégressif (groupe)',

    '\uD83C\uDD95 Autre mode (préciser)'
  ],

  // ✅ FOURCHETTES DE PRIX (Contexte Cameroun/Afrique francophone)
  fourchettes_prix: [
    '─── \uD83D\uDCB5 TARIFS HORAIRES ───',
    'Moins de 2 000 FCFA/heure',
    '2 000 - 3 000 FCFA/heure',
    '3 000 - 5 000 FCFA/heure',
    '5 000 - 8 000 FCFA/heure',
    '8 000 - 10 000 FCFA/heure',
    '10 000 - 15 000 FCFA/heure',
    'Plus de 15 000 FCFA/heure',

    '─── \uD83D\uDCE6 FORFAITS MENSUELS ───',
    'Moins de 30 000 FCFA/mois',
    '30 000 - 50 000 FCFA/mois',
    '50 000 - 80 000 FCFA/mois',
    '80 000 - 120 000 FCFA/mois',
    'Plus de 120 000 FCFA/mois',

    'Prix négociable',
    '\uD83C\uDD95 Autre fourchette'
  ],

  // ✅ EXPÉRIENCE DU RÉPÉTITEUR (10+ options)
  niveaux_experience: [
    'Étudiant universitaire',
    'Moins de 1 an d\'expérience',
    '1-2 ans d\'expérience',
    '3-5 ans d\'expérience',
    '5-10 ans d\'expérience',
    '10-15 ans d\'expérience',
    '15-20 ans d\'expérience',
    'Plus de 20 ans d\'expérience',
    'Enseignant en activité',
    'Enseignant retraité',
    'Professeur certifié',
    '\uD83C\uDD95 Autre profil'
  ],

  // ✅ DIPLÔMES & CERTIFICATIONS (15+ options)
  certifications: [
    '─── \uD83C\uDF93 DIPLÔMES ACADÉMIQUES ───',
    'Baccalauréat',
    'Licence (BAC+3)',
    'Master (BAC+5)',
    'Doctorat (BAC+8)',
    'Ingénieur',

    '─── \uD83D\uDCDC CERTIFICATIONS ENSEIGNEMENT ───',
    'CAPIEMP (Primaire)',
    'CAPIET (Technique)',
    'DIPES I (Secondaire 1er cycle)',
    'DIPES II (Secondaire 2nd cycle)',
    'Agrégation',

    '─── \uD83C\uDF0D CERTIFICATIONS INTERNATIONALES ───',
    'TOEFL (anglais)',
    'DELF/DALF (français)',

    'Aucun diplôme formel (expérience pratique)',
    '\uD83C\uDD95 Autre certification'
  ],

  // ✅ ZONES D'INTERVENTION (Auto-génération selon pays)
  zones_intervention: genererZonesIntervention('CM'),

  // ✅ DISPONIBILITÉS (12+ options)
  disponibilites: [
    '─── \uD83D\uDCC5 JOURS ───',
    'Lundi au vendredi',
    'Week-end uniquement',
    'Tous les jours (7j/7)',
    'Jours de semaine uniquement',

    '─── ⏰ CRÉNEAUX ───',
    'Matin (8h-12h)',
    'Après-midi (14h-18h)',
    'Soir (18h-21h)',
    'Mercredi après-midi',
    'Vacances scolaires',

    '─── \uD83D\uDD04 FLEXIBILITÉ ───',
    'Horaires flexibles (à convenir)',
    'Horaires fixes uniquement',

    '\uD83C\uDD95 Autre disponibilité'
  ],

  // ✅ MODALITÉS DE DÉPLACEMENT (8+ options)
  modalites_deplacement: [
    'Je me déplace au domicile de l\'élève',
    'L\'élève vient chez moi',
    'Cours en ligne uniquement (pas de déplacement)',
    'Les deux (domicile ou chez moi)',
    'Dans un lieu neutre (bibliothèque, centre)',
    'Déplacement inclus dans le prix',
    'Frais de déplacement en sus',
    '\uD83C\uDD95 Autre modalité'
  ],

  // ✅ RAYON DE DÉPLACEMENT (8+ options)
  rayons_deplacement: [
    'Moins de 2 km',
    '2-5 km',
    '5-10 km',
    '10-15 km',
    '15-20 km',
    'Plus de 20 km',
    'Toute la ville',
    'Plusieurs villes',
    'Pas de déplacement (en ligne uniquement)',
    '\uD83C\uDD95 Autre rayon'
  ],

  // ✅ SUPPORTS PÉDAGOGIQUES (15+ options)
  supports_pedagogiques: [
    '─── \uD83D\uDCDA MATÉRIEL FOURNI ───',
    'Livres et manuels scolaires',
    'Fiches de révision',
    'Exercices pratiques',
    'Annales d\'examens',
    'Supports numériques (PDF)',
    'Vidéos explicatives',

    '─── \uD83D\uDDA5️ OUTILS NUMÉRIQUES ───',
    'Tableau blanc interactif',
    'Plateforme e-learning',
    'Applications éducatives',
    'Quiz interactifs',

    '─── \uD83D\uDCDD SUIVI ───',
    'Cahier de suivi des progrès',
    'Rapports mensuels aux parents',
    'Tests d\'évaluation réguliers',

    'Aucun support (oral uniquement)',
    '\uD83C\uDD95 Autre support'
  ],

  // ✅ LANGUES D'ENSEIGNEMENT (8+ options)
  langues_enseignement: [
    'Français uniquement',
    'Anglais uniquement',
    'Bilingue (Français-Anglais)', // \uD83C\uDDE8\uD83C\uDDF2 Contexte Cameroun
    'Langues nationales (Duala, Ewondo, etc.)',
    'Espagnol',
    'Allemand',
    'Multilingue',
    '\uD83C\uDD95 Autre langue'
  ],

  // ✅ OBJECTIFS PÉDAGOGIQUES (12+ options)
  objectifs: [
    'Améliorer les notes',
    'Rattraper le retard scolaire',
    'Préparer un examen (BEPC, Bac)',
    'Renforcer la confiance en soi',
    'Acquérir une méthodologie de travail',
    'Développer l\'autonomie',
    'Combler les lacunes',
    'Approfondir les connaissances',
    'Préparer l\'orientation scolaire',
    'Aide spécialisée (dyslexie, etc.)',
    'Maintenir le niveau',
    '\uD83C\uDD95 Autre objectif'
  ],

  // ✅ RÉSULTATS & GARANTIES (8+ options)
  garanties: [
    'Garantie satisfaction ou remboursement',
    'Premier cours gratuit (essai)',
    'Suivi personnalisé garanti',
    'Résultats visibles en 1 mois',
    'Amélioration moyenne de 2-3 points',
    'Taux de réussite aux examens : 80%+',
    'Aucune garantie formelle',
    '\uD83C\uDD95 Autre garantie'
  ],

  // ✅ MODES DE PAIEMENT (12+ options)
  modes_paiement: [
    'Espèces',
    'Mobile Money (MTN, Orange, etc.)',
    'Virement bancaire',
    'Paiement en ligne',
    'Chèque',
    'Paiement après chaque séance',
    'Paiement mensuel d\'avance',
    'Paiement trimestriel',
    'Paiement échelonné possible',
    'Facilités de paiement',
    'Réduction fratrie (plusieurs enfants)',
    '\uD83C\uDD95 Autre mode'
  ],

  // ✅ TYPE DE CONTRAT (6+ options)
  types_contrat: [
    'Sans engagement (séance par séance)',
    'Engagement mensuel',
    'Engagement trimestriel',
    'Engagement année scolaire',
    'Stage vacances (durée limitée)',
    '\uD83C\uDD95 Autre type'
  ]
};

// ════════════════════════════════════════════════════════════
// ✅ MODALITÉS FORMATION & ÉDUCATION - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
// ════════════════════════════════════════════════════════════
// \uD83C\uDF93 Contexte : Formation professionnelle, Préparation concours grandes écoles,
//              Langues, Informatique, Métiers techniques, Certifications
// ⚠️ DIFFÉRENT DE : Soutien scolaire primaire/secondaire (soutien_scolaire_repetiteur)
// \uD83C\uDF0D Zones : Cameroun, Côte d'Ivoire, Sénégal, Mali, RDC, Gabon, Congo, etc.
// ════════════════════════════════════════════════════════════
export const FORMATION_EDUCATION_MODALITIES: ModalityCategory = {

  // ✅ TYPES DE FORMATION (30+ options)
  types_formation: [
    '─── \uD83C\uDF93 FORMATION ACADÉMIQUE ───',
    'Cours particuliers (toutes matières)',
    'Aide aux devoirs',
    'Rattrapage scolaire',
    'Cours de vacances (intensif)',
    'Préparation examens (BEPC, Probatoire, Bac)',
    'Préparation concours grandes écoles',
    'Méthodologie & organisation',

    '─── \uD83D\uDCBC FORMATION PROFESSIONNELLE ───',
    'Formation diplômante',
    'Formation qualifiante',
    'Formation certifiante',
    'Reconversion professionnelle',
    'Perfectionnement professionnel',
    'Formation continue (employés)',

    '─── \uD83D\uDCBB FORMATION TECHNIQUE ───',
    'Informatique & Bureautique',
    'Programmation & Développement',
    'Design graphique',
    'Marketing digital',
    'Gestion de projet',
    'Entrepreneuriat',

    '─── \uD83C\uDF0D LANGUES ───',
    'Langues étrangères',
    'Français (FLE - Français Langue Étrangère)',
    'Anglais (cours & certifications)',
    'Espagnol, Allemand, Chinois',

    '─── ⚙️ MÉTIERS TECHNIQUES ───',
    'Mécanique automobile',
    'Électricité & Électronique',
    'Plomberie & Sanitaire',
    'Menuiserie & Ébénisterie',
    'Soudure & Métallurgie',
    'Climatisation & Froid',
    'Agriculture & Élevage',

    '─── \uD83C\uDFA8 ARTS & CRÉATIFS ───',
    'Musique & Instruments',
    'Danse & Chorégraphie',
    'Théâtre & Art dramatique',
    'Photographie & Vidéo',
    'Dessin & Peinture',
    'Mode & Couture',
    'Coiffure & Esthétique',
    'Cuisine & Pâtisserie',

    '\uD83C\uDD95 Autre type (préciser)'
  ],

  // ✅ NIVEAUX SCOLAIRES (Utilise genererNiveauxScolaires du système éducatif)
  // \uD83D\uDD04 Cette liste sera automatiquement remplacée par les niveaux du pays de l'utilisateur
  niveaux_scolaires: [
    '─── \uD83C\uDDE8\uD83C\uDDF2 MATERNELLE ───',
    '\uD83C\uDDE8\uD83C\uDDF2 Petite Section (3-4 ans)',
    '\uD83C\uDDE8\uD83C\uDDF2 Moyenne Section (4-5 ans)',
    '\uD83C\uDDE8\uD83C\uDDF2 Grande Section (5-6 ans)',

    '─── \uD83C\uDDE8\uD83C\uDDF2 PRIMAIRE ───',
    '\uD83C\uDDE8\uD83C\uDDF2 CP (Cours Préparatoire)',
    '\uD83C\uDDE8\uD83C\uDDF2 CE1',
    '\uD83C\uDDE8\uD83C\uDDF2 CE2',
    '\uD83C\uDDE8\uD83C\uDDF2 CM1',
    '\uD83C\uDDE8\uD83C\uDDF2 CM2',

    '─── \uD83C\uDDE8\uD83C\uDDF2 COLLÈGE ───',
    '\uD83C\uDDE8\uD83C\uDDF2 6ème',
    '\uD83C\uDDE8\uD83C\uDDF2 5ème',
    '\uD83C\uDDE8\uD83C\uDDF2 4ème',
    '\uD83C\uDDE8\uD83C\uDDF2 3ème',

    '─── \uD83C\uDDE8\uD83C\uDDF2 LYCÉE ───',
    '\uD83C\uDDE8\uD83C\uDDF2 Seconde',
    '\uD83C\uDDE8\uD83C\uDDF2 Première',
    '\uD83C\uDDE8\uD83C\uDDF2 Terminale',

    '─── \uD83C\uDDE8\uD83C\uDDF2 SUPÉRIEUR ───',
    '\uD83C\uDDE8\uD83C\uDDF2 Licence 1 (L1)',
    '\uD83C\uDDE8\uD83C\uDDF2 Licence 2 (L2)',
    '\uD83C\uDDE8\uD83C\uDDF2 Licence 3 (L3)',
    '\uD83C\uDDE8\uD83C\uDDF2 Master 1 (M1)',
    '\uD83C\uDDE8\uD83C\uDDF2 Master 2 (M2)',
    '\uD83C\uDDE8\uD83C\uDDF2 Doctorat',

    '──────────────────',
    '\uD83D\uDCDA Tous niveaux (Maternelle → Terminale)',
    '\uD83C\uDF93 Enseignement supérieur uniquement',
    '\uD83D\uDC68‍\uD83C\uDF93 Formation adultes / Remise à niveau',
    '\uD83C\uDD95 Autre niveau (préciser)'
  ],

  // ✅ MATIÈRES ENSEIGNÉES (40+ options)
  matieres_enseignees: [
    '─── \uD83D\uDCD0 SCIENCES & MATHÉMATIQUES ───',
    'Mathématiques (tous niveaux)',
    'Mathématiques supérieures (prépa)',
    'Physique',
    'Chimie',
    'SVT (Sciences de la Vie et de la Terre)',
    'Biologie',
    'Sciences naturelles',

    '─── \uD83D\uDCD6 LANGUES & LITTÉRATURE ───',
    'Français',
    'Anglais',
    'Espagnol',
    'Allemand',
    'Arabe',
    'Chinois',
    'Langues nationales (Duala, Ewondo, Wolof, Bambara)',
    'Littérature',
    'Philosophie',

    '─── \uD83C\uDF0D SCIENCES HUMAINES ───',
    'Histoire-Géographie',
    'Histoire',
    'Géographie',
    'Éducation civique et morale (ECM)',
    'Sciences économiques et sociales (SES)',
    'Économie',
    'Droit',
    'Gestion',
    'Comptabilité',

    '─── \uD83D\uDCBB INFORMATIQUE & TECHNOLOGIES ───',
    'Informatique / Bureautique',
    'Programmation (Python, Java, JavaScript, etc.)',
    'Développement web',
    'Développement mobile',
    'Base de données',
    'Réseaux informatiques',
    'Cybersécurité',
    'Intelligence artificielle',

    '─── \uD83C\uDFA8 ARTS & CULTURE ───',
    'Arts plastiques / Dessin',
    'Musique',
    'Éducation physique (Sport)',
    'Arts & Culture',

    '──────────────────',
    '\uD83D\uDCDA Aide aux devoirs (toutes matières)',
    '\uD83C\uDFAF Méthodologie & organisation',
    '\uD83D\uDCDD Préparation examens nationaux',
    '\uD83C\uDD95 Autre matière (préciser)'
  ],

  // ✅ FORMATS DE FORMATION (20+ options)
  formats: [
    '─── \uD83D\uDC65 FORMAT COURS ───',
    'Cours particuliers (1-1)',
    'Cours en binôme (2 élèves)',
    'Cours en petit groupe (3-5 élèves)',
    'Cours en groupe (6-15 élèves)',
    'Cours en classe complète (15-30 élèves)',

    '─── \uD83D\uDCCD MODALITÉ ───',
    'Présentiel uniquement',
    'En ligne uniquement (distanciel)',
    'Hybride (présentiel + en ligne)',
    'À domicile (déplacement formateur)',
    'Au domicile de l\'élève',
    'En centre de formation',
    'En entreprise',

    '─── \uD83D\uDCC5 FORMAT PROGRAMME ───',
    'Stage intensif (1-2 semaines)',
    'Bootcamp (formation accélérée)',
    'Formation modulaire (par modules)',
    'Formation continue (longue durée)',
    'Atelier pratique',
    'Masterclass (avec expert)',
    'Conférence / Séminaire',

    '\uD83C\uDD95 Autre format (préciser)'
  ],

  // ✅ DURÉES DE FORMATION (15+ options)
  durees: [
    '─── ⏱️ COURTE DURÉE ───',
    '1 heure (cours unique)',
    '2 heures (cours unique)',
    '1 jour (journée complète)',
    '2-3 jours (week-end)',
    '1 semaine (5 jours)',
    '2 semaines',

    '─── \uD83D\uDCC5 MOYENNE DURÉE ───',
    '1 mois (4 semaines)',
    '2 mois',
    '3 mois (1 trimestre)',

    '─── \uD83D\uDCC6 LONGUE DURÉE ───',
    '6 mois (1 semestre)',
    '9 mois (année scolaire)',
    '1 an',
    '2 ans',
    '3 ans et plus',

    '──────────────────',
    'Formation continue (sans limite)',
    'À la carte (durée flexible)',
    '\uD83C\uDD95 Autre durée (préciser)'
  ],

  // ✅ RYTHMES DE FORMATION (12+ options)
  rythmes: [
    '─── ⏰ INTENSITÉ ───',
    'Intensif (tous les jours)',
    'Semi-intensif (3-4 fois/semaine)',
    'Régulier (2 fois/semaine)',
    'Hebdomadaire (1 fois/semaine)',
    'Bi-mensuel (2 fois/mois)',
    'Mensuel (1 fois/mois)',

    '─── \uD83D\uDD50 HORAIRES ───',
    'Matin (8h-12h)',
    'Après-midi (14h-18h)',
    'Soir (18h-21h)',
    'Week-end (samedi-dimanche)',
    'Vacances scolaires',
    'Horaires flexibles (à définir)',

    '\uD83C\uDD95 Autre rythme (préciser)'
  ],

  // ✅ LANGUES D'ENSEIGNEMENT (10+ options)
  langues_enseignement: [
    'Français (uniquement)',
    'Anglais (uniquement)',
    'Bilingue (Français-Anglais)', // \uD83C\uDDE8\uD83C\uDDF2 Contexte Cameroun
    'Espagnol',
    'Allemand',
    'Arabe',
    'Chinois',
    'Portugais',
    'Langues nationales (Duala, Ewondo, Wolof, etc.)',
    'Multilingue',
    '\uD83C\uDD95 Autre langue (préciser)'
  ],

  // ✅ PRÉPARATION CONCOURS (Utilise genererListeConcours)
  // \uD83D\uDD04 Cette liste sera automatiquement remplacée par les concours du pays de l'utilisateur
  concours_cibles: [
    '─── \uD83C\uDDE8\uD83C\uDDF2 CONCOURS NATIONAUX ───',
    '─── \uD83D\uDD27 Écoles d\'Ingénieurs ───',
    '\uD83C\uDDE8\uD83C\uDDF2 Polytechnique Yaoundé',
    '\uD83C\uDDE8\uD83C\uDDF2 Polytechnique Douala',
    '\uD83C\uDDE8\uD83C\uDDF2 IUT Douala',
    '\uD83C\uDDE8\uD83C\uDDF2 ENSP Yaoundé',

    '─── \uD83E\uDE7A Médecine & Santé ───',
    '\uD83C\uDDE8\uD83C\uDDF2 FMSB (Faculté de Médecine)',

    '─── \uD83C\uDF93 Écoles Normales (Enseignement) ───',
    '\uD83C\uDDE8\uD83C\uDDF2 ENS Yaoundé',

    '─── \uD83C\uDFDB️ Administration & Magistrature ───',
    '\uD83C\uDDE8\uD83C\uDDF2 ENAM',
    '\uD83C\uDDE8\uD83C\uDDF2 IRIC',

    '─── \uD83D\uDCBC Commerce & Gestion ───',
    '\uD83C\uDDE8\uD83C\uDDF2 ESSEC Douala/Yaoundé',

    '──────────────────────────',
    '─── \uD83C\uDDEB\uD83C\uDDF7 GRANDES ÉCOLES FRANÇAISES ───',
    '\uD83C\uDDEB\uD83C\uDDF7 Polytechnique Paris',
    '\uD83C\uDDEB\uD83C\uDDF7 Centrale Paris',
    '\uD83C\uDDEB\uD83C\uDDF7 HEC Paris',

    '──────────────────────────',
    '\uD83C\uDFAF Préparation concours généraux (toutes écoles)',
    '\uD83D\uDCDA Méthodologie concours (toutes filières)',
    '\uD83C\uDD95 Autre concours (préciser)'
  ],

  // ✅ MATIÈRES PRÉPARATION CONCOURS (Utilise genererMatieresPreparationConcours)
  matieres_preparation_concours: [
    '─── \uD83D\uDD2C MATIÈRES SCIENTIFIQUES ───',
    'Mathématiques (algèbre, analyse, géométrie)',
    'Mathématiques supérieures (prépa)',
    'Physique (mécanique, thermodynamique, électricité)',
    'Physique avancée (optique, quantique)',
    'Chimie (organique, minérale, analytique)',
    'Chimie avancée (thermochimie, cinétique)',
    'Biologie / SVT',
    'Sciences de l\'Ingénieur (SI)',
    'Informatique & Algorithmique',

    '─── \uD83D\uDCD6 MATIÈRES LITTÉRAIRES ───',
    'Français (dissertation, résumé, synthèse)',
    'Français avancé (commentaire, analyse)',
    'Anglais (grammaire, vocabulaire, compréhension)',
    'Anglais avancé (TOEFL, IELTS)',
    'Culture générale',
    'Philosophie',
    'Littérature',

    '─── \uD83C\uDF0D SCIENCES HUMAINES ───',
    'Histoire-Géographie',
    'Sciences politiques',
    'Géopolitique',
    'Droit constitutionnel',
    'Droit administratif',
    'Économie',
    'Économie approfondie (micro, macro)',

    '─── \uD83C\uDFAF PRÉPARATION SPÉCIALISÉE ───',
    'Tests psychotechniques',
    'Tests de logique & raisonnement',
    'QCM (Questions à Choix Multiples)',
    'Dissertation & synthèse',
    'Épreuves orales (entretien, exposé)',
    'Méthodologie des concours',
    'Gestion du stress & timing',
    'Annales & sujets types',

    '──────────────────────────',
    '\uD83D\uDCDA Préparation complète (toutes matières)',
    '\uD83C\uDFAF Méthodologie générale concours',
    '\uD83C\uDD95 Autre matière (préciser)'
  ],

  // ✅ NOUVEAU: ANCIENS SUJETS ET ÉPREUVES DISPONIBLES
  anciens_sujets_disponibles: [
    '─── \uD83D\uDCCB SUJETS RÉCENTS (2020-2024) ───',
    'Sujets 2024 (dernière session)',
    'Sujets 2023',
    'Sujets 2022',
    'Sujets 2021',
    'Sujets 2020',
    '─── \uD83D\uDCDA ARCHIVES (2015-2019) ───',
    'Sujets 2019',
    'Sujets 2018',
    'Sujets 2017',
    'Sujets 2016',
    'Sujets 2015',
    '─── \uD83C\uDFAF TYPES D\'ÉPREUVES ───',
    'Épreuves écrites (admissibilité)',
    'Épreuves orales (admission)',
    'Épreuves pratiques',
    'Épreuves de culture générale',
    'Épreuves de langue',
    '─── \uD83D\uDCD6 SUPPORTS PÉDAGOGIQUES ───',
    'Corrigés détaillés',
    'Commentaires de correction',
    'Méthodes de résolution',
    'Conseils d\'examinateurs',
    'Statistiques de réussite',
    '─── \uD83D\uDD04 FORMATS DISPONIBLES ───',
    'PDF numérique',
    'Copies physiques',
    'Vidéos de correction',
    'Audio-explications',
    '\uD83C\uDD95 Autre format (préciser)'
  ],

  // ✅ NOUVEAU: ANNÉES DE CONCOURS DISPONIBLES
  annees_concours_disponibles: [
    '2024 (dernière session)',
    '2023',
    '2022',
    '2021',
    '2020',
    '2019',
    '2018',
    '2017',
    '2016',
    '2015',
    '2014',
    '2013',
    '2012',
    '2011',
    '2010',
    'Archive complète (2000-2009)',
    'Archive ancienne (1990-1999)',
    '\uD83C\uDD95 Autre année (préciser)'
  ],

  // ✅ NOUVEAU: TYPES DE DOCUMENTS CONCOURS
  types_documents_concours: [
    '─── \uD83D\uDCDD SUJETS D\'EXAMEN ───',
    'Sujets d\'admissibilité',
    'Sujets d\'admission',
    'Sujets de rattrapage',
    'Sujets de session spéciale',
    '─── \uD83D\uDCCB CORRIGÉS ───',
    'Corrigés officiels',
    'Corrigés détaillés',
    'Corrigés commentés',
    'Corrigés vidéo',
    '─── \uD83D\uDCCA ANALYSES ───',
    'Statistiques de réussite',
    'Commentaires d\'examinateurs',
    'Conseils méthodologiques',
    'Erreurs fréquentes',
    '─── \uD83C\uDFAF PRÉPARATION ───',
    'Fiches de révision',
    'QCM d\'entraînement',
    'Exercices pratiques',
    'Simulations d\'examen',
    '\uD83C\uDD95 Autre document (préciser)'
  ],

  // ✅ NIVEAUX DE PRÉPARATION CONCOURS (Utilise getNiveauxPreparationConcours)
  niveaux_preparation_concours: [
    '─── \uD83D\uDCDA NIVEAU BAC (après Terminale) ───',
    'Préparation intensive (3-6 mois)',
    'Préparation longue (12 mois)',
    'Préparation très longue (18-24 mois)',

    '─── \uD83C\uDF93 NIVEAU BAC+2 (Classes Prépa) ───',
    'Prépa Maths Sup / Maths Spé (MPSI, PCSI)',
    'Prépa Commerciales (ECE, ECS)',
    'Prépa Littéraires (Khâgne, Hypokhâgne)',
    'Prépa Biologie (BCPST)',

    '─── \uD83C\uDFC6 NIVEAU BAC+3/+5 ───',
    'Préparation Master / Doctorat',
    'Préparation concours professionnels',

    '─── ⏱️ FORMAT ───',
    'Stage intensif vacances (1-2 semaines)',
    'Cours hebdomadaires (toute l\'année)',
    'Cours particuliers sur mesure',
    'Formation en ligne / à distance',

    '\uD83C\uDD95 Autre format'
  ],

  // ✅ CERTIFICATIONS & DIPLÔMES (25+ options)
  certifications: [
    '─── \uD83C\uDF93 CERTIFICATIONS ACADÉMIQUES ───',
    'Attestation de formation',
    'Certificat de formation',
    'Diplôme d\'État',
    'Diplôme universitaire',
    'Certificat de compétences',

    '─── \uD83D\uDCBC CERTIFICATIONS PROFESSIONNELLES ───',
    'Certification métier',
    'Qualification professionnelle',
    'Habilitation professionnelle',
    'Agrément professionnel',

    '─── \uD83C\uDF0D CERTIFICATIONS INTERNATIONALES ───',
    'TOEFL (anglais)',
    'IELTS (anglais)',
    'TOEIC (anglais professionnel)',
    'DELF/DALF (français)',
    'TCF (français)',
    'DELE (espagnol)',
    'Goethe-Zertifikat (allemand)',
    'HSK (chinois)',

    '─── \uD83D\uDCBB CERTIFICATIONS INFORMATIQUE ───',
    'Microsoft Office Specialist (MOS)',
    'CompTIA A+',
    'Cisco CCNA',
    'AWS Certified',
    'Google Analytics',
    'Adobe Certified',

    '──────────────────',
    'Aucune certification (formation simple)',
    'Certificat interne (non officiel)',
    '\uD83C\uDD95 Autre certification (préciser)'
  ],

  // ✅ NIVEAUX DE COMPÉTENCE (8 options)
  niveaux_competence: [
    'Grand débutant (aucune base)',
    'Débutant',
    'Intermédiaire',
    'Intermédiaire-Avancé',
    'Avancé',
    'Expert',
    'Professionnel',
    'Tous niveaux (mixte)',
    '\uD83C\uDD95 Autre niveau (préciser)'
  ],

  // ✅ ÉQUIPEMENTS & SUPPORTS (15+ options)
  equipements_supports: [
    '─── \uD83D\uDCDA SUPPORTS PÉDAGOGIQUES ───',
    'Manuels & livres fournis',
    'Supports de cours (PDF, documents)',
    'Exercices & annales',
    'Vidéos enregistrées',
    'Plateforme e-learning',

    '─── \uD83D\uDCBB ÉQUIPEMENTS TECHNIQUES ───',
    'Ordinateurs fournis',
    'Tablettes fournies',
    'Accès internet inclus',
    'Logiciels installés',

    '─── \uD83C\uDF92 MATÉRIEL ───',
    'Matériel pédagogique fourni',
    'Outils techniques fournis (selon formation)',
    'Kit de formation complet',

    '──────────────────',
    'Apporter son propre matériel',
    'Liste de matériel fournie à l\'avance',
    '\uD83C\uDD95 Autre équipement (préciser)'
  ],

  // ✅ SERVICES INCLUS (20+ options)
  services_inclus: [
    '─── \uD83D\uDCDD SUIVI PÉDAGOGIQUE ───',
    'Évaluation initiale (test de niveau)',
    'Suivi personnalisé',
    'Évaluations régulières',
    'Correction de devoirs',
    'Compte-rendu aux parents',
    'Entretiens individuels',

    '─── \uD83C\uDFAF ACCOMPAGNEMENT ───',
    'Coaching & motivation',
    'Aide à l\'orientation',
    'Préparation CV & entretien',
    'Stage en entreprise',
    'Placement après formation',

    '─── \uD83D\uDCBE RESSOURCES ───',
    'Accès plateforme en ligne (illimité)',
    'Bibliothèque de ressources',
    'Support technique',
    'Communauté d\'entraide (forum, groupe)',

    '─── ☕ SERVICES PRATIQUES ───',
    'Pause café / collation incluse',
    'Parking gratuit',
    'Transport inclus',
    'Hébergement possible',

    '\uD83C\uDD95 Autre service (préciser)'
  ],

  // ✅ MÉTHODES PÉDAGOGIQUES (15+ options)
  methodes_pedagogiques: [
    'Cours magistraux (théorie)',
    'Travaux pratiques (exercices)',
    'Études de cas',
    'Projets réels',
    'Ateliers pratiques',
    'Jeux de rôle',
    'Classe inversée',
    'Apprentissage par projet',
    'Apprentissage par problèmes',
    'Pédagogie active',
    'Tutorat personnalisé',
    'Peer-to-peer (entraide)',
    'E-learning interactif',
    'Blended learning (mixte)',
    'Microlearning (capsules courtes)',
    '\uD83C\uDD95 Autre méthode (préciser)'
  ],

  // ✅ PROFIL FORMATEUR (12+ options)
  profil_formateur: [
    '─── \uD83C\uDF93 QUALIFICATION ───',
    'Enseignant diplômé (CAPES, Agrégation)',
    'Professeur certifié',
    'Formateur professionnel certifié',
    'Expert métier (+ de 10 ans d\'expérience)',
    'Ingénieur (formation technique)',
    'Docteur (PhD)',

    '─── \uD83D\uDCBC EXPÉRIENCE ───',
    'Moins de 2 ans d\'expérience',
    '2-5 ans d\'expérience',
    '5-10 ans d\'expérience',
    '10-20 ans d\'expérience',
    'Plus de 20 ans d\'expérience',

    '──────────────────',
    'Natif (langue maternelle - pour langues)',
    'Bilingue certifié',
    '\uD83C\uDD95 Autre profil (préciser)'
  ],

  // ✅ PUBLIC CIBLE (15+ options)
  public_cible: [
    '─── \uD83D\uDC76 ENFANTS & ADOLESCENTS ───',
    'Enfants (Maternelle-Primaire)',
    'Collégiens (6ème-3ème)',
    'Lycéens (Seconde-Terminale)',

    '─── \uD83C\uDF93 ÉTUDIANTS ───',
    'Étudiants (Licence)',
    'Étudiants (Master)',
    'Étudiants (Doctorat)',
    'Élèves classes prépa',

    '─── \uD83D\uDCBC PROFESSIONNELS ───',
    'Salariés en activité',
    'Demandeurs d\'emploi',
    'Entrepreneurs',
    'Reconversion professionnelle',

    '─── \uD83D\uDC68‍\uD83C\uDF93 ADULTES ───',
    'Adultes débutants',
    'Seniors (3ème âge)',

    '──────────────────',
    'Tout public (enfants, ados, adultes)',
    '\uD83C\uDD95 Autre public (préciser)'
  ],

  // ✅ TARIFICATIONS (12+ options)
  tarifications: [
    '─── \uD83D\uDCB0 MODE DE PAIEMENT ───',
    'Paiement unique (forfait)',
    'Paiement mensuel',
    'Paiement par session',
    'Paiement à l\'heure',
    'Paiement échelonné (plusieurs fois)',

    '─── \uD83D\uDCB3 MOYENS ACCEPTÉS ───',
    'Espèces uniquement',
    'Mobile Money (MTN, Orange)',
    'Virement bancaire',
    'Carte bancaire',
    'Chèque',

    '─── \uD83C\uDF81 RÉDUCTIONS ───',
    'Réduction groupe (3+ personnes)',
    'Réduction longue durée',
    'Premier cours gratuit',
    'Pack découverte (tarif réduit)',

    '\uD83C\uDD95 Autre modalité (préciser)'
  ]
};

// ✅ MODALITÉS ÉVÉNEMENTIEL & ORGANISATION - ENRICHI AFRIQUE FRANCOPHONE
export const EVENEMENTIEL_MODALITIES: ModalityCategory = {
  // ===============================================
  // \uD83C\uDF89 TYPES D'ÉVÉNEMENTS (30+)
  // ===============================================
  types: [
    // \uD83D\uDC92 Événements traditionnels & religieux (AFRIQUE)
    '\uD83D\uDC92 Mariage traditionnel',
    '\uD83D\uDC92 Mariage religieux (église)',
    '\uD83D\uDC92 Mariage civil',
    '\uD83D\uDC92 Mariage mixte (traditionnel + religieux)',
    '\uD83D\uDC92 Dot / Ntchounke (cérémonie traditionnelle)',
    '\uD83D\uDC8D Fiançailles officielles',

    // \uD83D\uDC76 Événements familiaux
    '\uD83D\uDC76 Baptême',
    '\uD83D\uDC76 Cérémonie de naissance / Présentation bébé',
    '\uD83C\uDF82 Anniversaire enfant',
    '\uD83C\uDF82 Anniversaire adulte',
    '\uD83C\uDF93 Remise de diplôme / Graduation',
    '⚰️ Funérailles / Veillée mortuaire',
    '\uD83C\uDFE1 Pendaison de crémaillère',
    '\uD83D\uDC91 Demande en mariage',

    // \uD83C\uDFE2 Événements professionnels
    '\uD83C\uDFE2 Séminaire d\'entreprise',
    '\uD83C\uDFE2 Conférence / Forum',
    '\uD83C\uDFE2 Atelier / Formation',
    '\uD83C\uDFE2 Team building',
    '\uD83C\uDFE2 Lancement de produit / Service',
    '\uD83C\uDFE2 Inauguration (magasin, bureau)',
    '\uD83C\uDFE2 Assemblée générale',
    '\uD83C\uDFE2 Soirée d\'entreprise / Gala',

    // \uD83C\uDFAD Événements culturels & divertissement
    '\uD83C\uDFAD Concert / Spectacle musical',
    '\uD83C\uDFAD Festival culturel',
    '\uD83C\uDFAD Défilé de mode',
    '\uD83C\uDFAD Exposition (art, produits)',
    '\uD83C\uDFAC Projection de film / Avant-première',
    '\uD83C\uDFAA Salon professionnel / Foire',

    // \uD83C\uDF8A Autres événements
    '\uD83C\uDF8A Cocktail / Réception',
    '\uD83C\uDF8A Soirée privée',
    '\uD83C\uDF8A Journée portes ouvertes',
    '\uD83C\uDF8A Levée de fonds / Charité',

    '\uD83C\uDD95 Autre type d\'événement (ajouter)'
  ],

  // ===============================================
  // \uD83D\uDCCB SERVICES PROPOSÉS (40+)
  // ===============================================
  services: [
    // \uD83C\uDFDB️ Lieux & Infrastructures
    '\uD83C\uDFDB️ Location de salle climatisée',
    '\uD83C\uDFDB️ Location de jardin / Espace extérieur',
    '\uD83C\uDFDB️ Location d\'hôtel / Salle de réception',
    '\uD83C\uDFDB️ Location de domicile privé',
    '⛺ Location de chapiteau / Tente',
    '⛺ Location de barnums',
    '⛺ Montage/démontage de structures',

    // \uD83C\uDF7D️ Restauration & Traiteur
    '\uD83C\uDF7D️ Traiteur complet (repas + service)',
    '\uD83C\uDF7D️ Buffet à volonté',
    '\uD83C\uDF7D️ Repas assis / Service à table',
    '\uD83C\uDF7D️ Cocktail dînatoire',
    '\uD83C\uDF7D️ Pâtisserie (gâteau d\'événement)',
    '\uD83E\uDD64 Bar & Boissons',
    '☕ Pause-café / Collations',

    // \uD83C\uDFA8 Décoration & Ambiance
    '\uD83C\uDFA8 Décoration florale',
    '\uD83C\uDFA8 Décoration thématique',
    '\uD83C\uDFA8 Arche de cérémonie',
    '\uD83C\uDFA8 Ballons & Décorations gonflables',
    '\uD83C\uDFA8 Nappage & Housse de chaises',
    '\uD83C\uDFA8 Éclairage d\'ambiance / LED',
    '\uD83C\uDF86 Feux d\'artifice',
    '✨ Fumée lourde / Effets spéciaux',

    // \uD83C\uDFA4 Animation & Divertissement
    '\uD83C\uDFA4 DJ / Disc-jockey',
    '\uD83C\uDFB5 Orchestre / Groupe musical',
    '\uD83C\uDFB8 Musiciens (solistes)',
    '\uD83C\uDF99️ Maître de cérémonie / Présentateur',
    '\uD83E\uDD39 Animateurs enfants',
    '\uD83C\uDFAD Spectacle / Artistes (danseurs, comédiens)',
    '\uD83C\uDFAA Structures gonflables enfants',

    // \uD83D\uDCF8 Médias & Souvenirs
    '\uD83D\uDCF8 Photographe professionnel',
    '\uD83D\uDCF9 Vidéaste / Cameraman',
    '\uD83C\uDFAC Drone (vidéo aérienne)',
    '\uD83D\uDCFA Live streaming / Diffusion en direct',
    '\uD83D\uDCF1 Photobooth / Borne photo',

    // \uD83D\uDD0A Sonorisation & Technique
    '\uD83D\uDD0A Sonorisation complète',
    '\uD83C\uDF9B️ Location de matériel audio',
    '\uD83D\uDCA1 Éclairage scénique',
    '\uD83C\uDFA5 Projecteur & Écran géant',
    '\uD83C\uDFA4 Micros sans fil',

    // \uD83E\uDE91 Mobilier & Équipements
    '\uD83E\uDE91 Location de tables',
    '\uD83E\uDE91 Location de chaises (diverses)',
    '\uD83E\uDE91 Mobilier VIP / Lounge',
    '\uD83C\uDF7D️ Vaisselle & Couverts',
    '\uD83C\uDF77 Verres & Service boissons',

    // \uD83D\uDE97 Services complémentaires
    '\uD83D\uDE97 Valet parking',
    '\uD83D\uDE97 Navette / Transport invités',
    '\uD83D\uDE97 Location de voiture de luxe / Cortège',
    '\uD83D\uDD10 Service de sécurité',
    '\uD83E\uDDF9 Nettoyage post-événement',
    '\uD83D\uDC54 Hôtesses d\'accueil',

    // \uD83D\uDCBC Services de coordination
    '\uD83D\uDCBC Wedding planner / Organisateur complet',
    '\uD83D\uDCBC Coordination jour J',
    '\uD83D\uDCCB Gestion invitations & RSVP',

    '\uD83C\uDD95 Autre service (ajouter)'
  ],

  // ===============================================
  // \uD83D\uDC65 CAPACITÉS D'ACCUEIL
  // ===============================================
  capacites: [
    '\uD83D\uDC65 Petit événement (10-30 personnes)',
    '\uD83D\uDC65 Moyen événement (30-50 personnes)',
    '\uD83D\uDC65 Grand événement (50-100 personnes)',
    '\uD83D\uDC65 Très grand événement (100-200 personnes)',
    '\uD83D\uDC65 Événement majeur (200-500 personnes)',
    '\uD83D\uDC65 Événement massif (500-1000 personnes)',
    '\uD83D\uDC65 Méga-événement (1000+ personnes)',
    '\uD83C\uDD95 Autre capacité (préciser)'
  ],

  // ===============================================
  // \uD83E\uDE91 MOBILIER & ÉQUIPEMENTS
  // ===============================================
  equipements: [
    // Tables
    '\uD83E\uDE91 Tables rondes (8-10 places)',
    '\uD83E\uDE91 Tables rectangulaires (6-8 places)',
    '\uD83E\uDE91 Tables cocktail (hautes)',
    '\uD83E\uDE91 Tables buffet',

    // Chaises
    '\uD83E\uDE91 Chaises Napoléon',
    '\uD83E\uDE91 Chaises pliantes',
    '\uD83E\uDE91 Chaises design / Modernes',
    '\uD83E\uDE91 Bancs',

    // Vaisselle & Service
    '\uD83C\uDF7D️ Assiettes (porcelaine, plastique)',
    '\uD83C\uDF77 Verres (vin, champagne, eau)',
    '\uD83E\uDD44 Couverts complets',
    '\uD83E\uDDFB Nappes & Serviettes',
    '\uD83E\uDE91 Housses de chaises',

    // Technique
    '\uD83C\uDFA5 Projecteur HD/4K',
    '\uD83D\uDCFA Écran de projection / LED géant',
    '\uD83C\uDFA4 Micros sans fil (main, col, serre-tête)',
    '\uD83D\uDD0A Enceintes puissantes',
    '\uD83C\uDF9B️ Table de mixage',
    '\uD83D\uDCA1 Éclairage LED / Par LED',
    '\uD83D\uDCA1 Projecteurs scéniques',
    '\uD83C\uDF86 Machine à fumée',
    '✨ Effets lumineux (lasers, stroboscopes)',

    // Climatisation & Confort
    '❄️ Climatiseurs mobiles',
    '\uD83C\uDF00 Ventilateurs',
    '☂️ Parasols',
    '\uD83D\uDEBD Toilettes mobiles / VIP',

    // Décoration
    '\uD83C\uDF88 Arche de ballons',
    '\uD83D\uDC90 Compositions florales',
    '\uD83D\uDD6F️ Bougies & Photophores',
    '\uD83E\uDE9E Tapis rouge',
    '\uD83C\uDFA8 Structures décoratives',

    // Cuisine & Service
    '\uD83C\uDF73 Cuisine mobile / Food truck',
    '\uD83E\uDDCA Réfrigérateurs / Glacières',
    '☕ Machine à café professionnelle',
    '\uD83C\uDF79 Bar mobile',

    '\uD83C\uDD95 Autre équipement (ajouter)'
  ],

  // ===============================================
  // \uD83C\uDFA8 STYLES & THÈMES (NOUVEAU)
  // ===============================================
  styles_themes: [
    // Traditionnel africain
    '\uD83C\uDF0D Traditionnel camerounais',
    '\uD83C\uDF0D Traditionnel ivoirien',
    '\uD83C\uDF0D Traditionnel sénégalais',
    '\uD83C\uDF0D Pagne africain / Wax',

    // Moderne & Occidental
    '\uD83D\uDC8E Élégant / Chic',
    '\uD83D\uDC8E Luxe / VIP',
    '\uD83C\uDF38 Romantique',
    '\uD83C\uDFA8 Bohème',
    '\uD83C\uDF3F Champêtre / Nature',
    '\uD83C\uDFAD Vintage / Rétro',

    // Couleurs & Ambiances
    '\uD83D\uDD34 Rouge & Or',
    '\uD83D\uDC9C Violet & Argent',
    '\uD83D\uDC99 Bleu & Blanc',
    '\uD83D\uDC9A Vert & Doré',
    '\uD83D\uDDA4 Noir & Blanc (élégant)',
    '\uD83C\uDF08 Multicolore / Festif',

    // Thèmes spécifiques
    '\uD83C\uDFAA Cirque',
    '\uD83E\uDD84 Licorne / Princesse',
    '\uD83E\uDDB8 Super-héros',
    '\uD83C\uDFD6️ Tropical / Plage',
    '\uD83C\uDFAC Cinéma / Hollywood',

    '\uD83C\uDD95 Autre thème (préciser)'
  ],

  // ===============================================
  // \uD83D\uDCB0 FORMULES & FORFAITS (NOUVEAU)
  // ===============================================
  formules: [
    '\uD83D\uDCE6 Formule Essentielle (services de base)',
    '\uD83D\uDCE6 Formule Confort (services intermédiaires)',
    '\uD83D\uDCE6 Formule Premium (tout inclus)',
    '\uD83D\uDCE6 Formule VIP (luxe + extras)',
    '\uD83D\uDCE6 Service à la carte (modulable)',
    '\uD83D\uDCE6 Forfait demi-journée',
    '\uD83D\uDCE6 Forfait journée complète',
    '\uD83D\uDCE6 Forfait week-end',
    '\uD83C\uDD95 Autre formule (préciser)'
  ],

  // ===============================================
  // \uD83D\uDCC5 DISPONIBILITÉS (NOUVEAU)
  // ===============================================
  disponibilites: [
    '\uD83D\uDCC5 Semaine (lundi-vendredi)',
    '\uD83D\uDCC5 Week-end (samedi-dimanche)',
    '\uD83D\uDCC5 Tous les jours',
    '\uD83C\uDF19 Événements de jour',
    '\uD83C\uDF19 Événements de soir/nuit',
    '\uD83C\uDF19 24h/24',
    '\uD83C\uDD95 Autre disponibilité (préciser)'
  ],

  // ===============================================
  // \uD83C\uDFAF TYPES DE CLIENTS (NOUVEAU)
  // ===============================================
  types_clients: [
    '\uD83D\uDC68‍\uD83D\uDC69‍\uD83D\uDC67‍\uD83D\uDC66 Particuliers / Familles',
    '\uD83C\uDFE2 Entreprises / Sociétés',
    '\uD83C\uDFDB️ Institutions / Administrations',
    '\uD83C\uDFEB Écoles / Universités',
    '⛪ Organisations religieuses',
    '\uD83C\uDF97️ ONG / Associations',
    '\uD83C\uDF0D Expatriés / Internationaux',
    '\uD83C\uDD95 Autre type de client (préciser)'
  ],

  // ===============================================
  // ⚙️ OPTIONS & SERVICES ADDITIONNELS (NOUVEAU)
  // ===============================================
  options_additionnelles: [
    '✅ Devis gratuit',
    '✅ Visite des lieux incluse',
    '✅ Dégustation menu (pour traiteur)',
    '✅ Coordinateur dédié jour J',
    '✅ Assurance événement',
    '✅ Plan B (solution de repli pluie)',
    '✅ Kit d\'urgence événementiel',
    '✅ Albums photo/vidéo inclus',
    '✅ Souvenirs personnalisés invités',
    '✅ Décoration recyclable / Éco-responsable',
    '✅ Wifi gratuit',
    '✅ Parking sécurisé',
    '✅ Générateur/groupe électrogène',
    '✅ Paiement échelonné possible',
    '✅ Facilités de paiement',
    '\uD83C\uDD95 Autre option (préciser)'
  ],

  // ===============================================
  // ⏱️ DÉLAIS DE PRÉPARATION (NOUVEAU)
  // ===============================================
  delais_preparation: [
    '⚡ Événement urgent (moins de 7 jours)',
    '\uD83D\uDCC5 Court délai (7-15 jours)',
    '\uD83D\uDCC5 Délai standard (15-30 jours)',
    '\uD83D\uDCC5 Délai confortable (1-3 mois)',
    '\uD83D\uDCC5 Longue préparation (3-6 mois)',
    '\uD83D\uDCC5 Très longue préparation (6+ mois)',
    '\uD83C\uDD95 Autre délai (préciser)'
  ]
};

// ✅ MODALITÉS AGRICULTURE & ÉLEVAGE - VERSION AFRIQUE FRANCOPHONE COMPLÈTE
// \uD83C\uDF3E Adapté aux réalités agricoles de chaque pays (Cameroun, Côte d'Ivoire, Sénégal, Mali, Gabon, Congo, etc.)
// \uD83D\uDC04 Intègre les unités de mesure locales : seau, sac, ver, cagnon, alvéole, tas, liasse, etc.
export const AGRICULTURE_ELEVAGE_MODALITIES: ModalityCategory = {

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83D\uDCE6 CATÉGORIE PRINCIPALE
  // ═══════════════════════════════════════════════════════════════════════════
  categorie_principale: [
    '\uD83C\uDF3E Produits Agricoles',
    '\uD83D\uDC04 Animaux d\'Élevage',
    '\uD83E\uDD5A Produits Animaux (œufs, lait, miel)',
    '\uD83C\uDF31 Intrants Agricoles (semences, engrais)',
    '\uD83D\uDE9C Matériel & Équipements',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83C\uDF3E PRODUITS AGRICOLES PAR TYPE (150+ produits)
  // ═══════════════════════════════════════════════════════════════════════════

  // \uD83E\uDD6C LÉGUMES (40+ variétés africaines)
  legumes: [
    // Légumes feuilles (très populaires en Afrique)
    '\uD83E\uDD6C Ndolé (feuilles amères)', '\uD83E\uDD6C Koki (feuilles de taro)', '\uD83E\uDD6C Épinards africains',
    '\uD83E\uDD6C Gnetum (okok/eru)', '\uD83E\uDD6C Amarante (gboma)', '\uD83E\uDD6C Morelle noire (feuilles)',
    '\uD83E\uDD6C Feuilles de manioc (pondu/saka-saka)', '\uD83E\uDD6C Feuilles de patate douce',
    '\uD83E\uDD6C Oseille (bissap feuilles)', '\uD83E\uDD6C Gombo feuilles', '\uD83E\uDD6C Persil africain',

    // Légumes fruits
    '\uD83C\uDF45 Tomate fraîche', '\uD83C\uDF45 Tomate locale', '\uD83C\uDF45 Tomate cerise',
    '\uD83E\uDED1 Piment fort (pili-pili)', '\uD83E\uDED1 Poivron vert', '\uD83E\uDED1 Poivron rouge/jaune',
    '\uD83E\uDD52 Concombre', '\uD83E\uDD52 Courgette', '\uD83E\uDD52 Gombo (okra)',
    '\uD83C\uDF46 Aubergine africaine', '\uD83C\uDF46 Aubergine violette', '\uD83C\uDF46 Aubergine blanche',

    // Légumes racines & tubercules
    '\uD83E\uDD55 Carotte', '\uD83E\uDDC5 Oignon rouge', '\uD83E\uDDC5 Oignon blanc', '\uD83E\uDDC5 Échalote',
    '\uD83E\uDDC4 Ail', '\uD83E\uDD54 Pomme de terre', '\uD83E\uDD54 Pomme de terre douce',

    // Légumineuses fraîches
    '\uD83E\uDED8 Haricot vert', '\uD83E\uDED8 Petit pois', '\uD83E\uDED8 Niébé (haricot africain)',

    // Courges & cucurbitacées
    '\uD83C\uDF83 Citrouille', '\uD83C\uDF83 Courge', '\uD83C\uDF83 Potiron',

    // Aromates & condiments
    '\uD83C\uDF3F Céleri', '\uD83C\uDF3F Persil', '\uD83C\uDF3F Ciboulette', '\uD83C\uDF3F Basilic africain',
    '\uD83C\uDF3F Njansan', '\uD83C\uDF3F Kankan',

    '\uD83C\uDD95 Autre légume (ajouter)'
  ],

  // \uD83C\uDF4E FRUITS (50+ variétés africaines)
  fruits: [
    // Fruits tropicaux africains
    '\uD83C\uDF4C Banane plantain', '\uD83C\uDF4C Banane douce', '\uD83C\uDF4C Banane poyo',
    '\uD83E\uDD6D Mangue locale', '\uD83E\uDD6D Mangue greffée', '\uD83E\uDD6D Mangue Julie',
    '\uD83E\uDD51 Avocat local', '\uD83E\uDD51 Avocat Hass', '\uD83E\uDD51 Poire d\'avocat',
    '\uD83C\uDF4A Orange douce', '\uD83C\uDF4A Orange amère', '\uD83C\uDF4B Citron vert', '\uD83C\uDF4B Citron jaune',
    '\uD83C\uDF4D Ananas Victoria', '\uD83C\uDF4D Ananas Cayenne', '\uD83C\uDF4D Ananas MD2',
    '\uD83E\uDD65 Noix de coco', '\uD83E\uDD65 Coco sec', '\uD83E\uDD65 Coco vert',
    '\uD83C\uDF48 Papaye solo', '\uD83C\uDF48 Papaye locale',
    '\uD83C\uDF49 Pastèque (watermelon)', '\uD83C\uDF49 Melon',

    // Fruits spécifiques africains
    '\uD83E\uDED0 Safou (prune africaine)', '\uD83E\uDED0 Safoutier',
    '\uD83C\uDF51 Mangoustan', '\uD83C\uDF51 Corossol (cachiman)', '\uD83C\uDF51 Anone',
    '\uD83C\uDF51 Fruit de la passion', '\uD83C\uDF51 Maracuja',
    '\uD83C\uDF47 Raisin local',

    // Fruits secs à coque
    '\uD83E\uDD5C Arachide (cacahuète)', '\uD83E\uDD5C Arachide grillée', '\uD83E\uDD5C Arachide en coque',
    '\uD83C\uDF30 Noix de cajou', '\uD83C\uDF30 Karité (noix)', '\uD83C\uDF30 Noisette locale',
    '\uD83C\uDF30 Pistache africaine', '\uD83C\uDF30 Kola (noix de kola)',

    // Fruits de palmier
    '\uD83E\uDED2 Noix de palme', '\uD83E\uDED2 Régime de palme',

    // Autres fruits
    '\uD83C\uDF53 Goyave', '\uD83C\uDF51 Pêche locale', '\uD83C\uDF51 Prune locale',
    '\uD83C\uDF4B Mandarine', '\uD83C\uDF4B Pamplemousse',

    '\uD83C\uDD95 Autre fruit (ajouter)'
  ],

  // \uD83C\uDF3E CÉRÉALES & GRAINS (25+)
  cereales: [
    '\uD83C\uDF3E Maïs grain', '\uD83C\uDF3E Maïs en épi', '\uD83C\uDF3E Maïs blanc', '\uD83C\uDF3E Maïs jaune',
    '\uD83C\uDF3E Riz paddy', '\uD83C\uDF3E Riz cargo', '\uD83C\uDF3E Riz blanc', '\uD83C\uDF3E Riz parfumé',
    '\uD83C\uDF3E Mil (petit mil)', '\uD83C\uDF3E Sorgho (gros mil)',
    '\uD83C\uDF3E Blé', '\uD83C\uDF3E Fonio', '\uD83C\uDF3E Orge',
    '\uD83C\uDF3E Sésame', '\uD83C\uDF3E Quinoa',
    '\uD83C\uDD95 Autre céréale (ajouter)'
  ],

  // \uD83E\uDD54 TUBERCULES & RACINES (20+)
  tubercules: [
    '\uD83E\uDD54 Manioc frais', '\uD83E\uDD54 Manioc amer', '\uD83E\uDD54 Manioc doux',
    '\uD83C\uDF60 Igname blanche', '\uD83C\uDF60 Igname jaune', '\uD83C\uDF60 Igname locale',
    '\uD83C\uDF60 Patate douce orange', '\uD83C\uDF60 Patate douce blanche', '\uD83C\uDF60 Patate douce violette',
    '\uD83E\uDD54 Macabo (taro rouge)', '\uD83E\uDD54 Taro blanc',
    '\uD83E\uDD54 Pomme de terre locale', '\uD83E\uDD54 Pomme de terre importée',
    '\uD83E\uDD55 Carotte tubercule',
    '\uD83C\uDD95 Autre tubercule (ajouter)'
  ],

  // \uD83E\uDED8 LÉGUMINEUSES SÈCHES (15+)
  legumineuses: [
    '\uD83E\uDED8 Niébé (haricot blanc local)', '\uD83E\uDED8 Haricot rouge', '\uD83E\uDED8 Haricot noir',
    '\uD83E\uDED8 Haricot blanc (lingot)', '\uD83E\uDED8 Pois chiche',
    '\uD83E\uDED8 Lentilles corail', '\uD83E\uDED8 Lentilles vertes',
    '\uD83E\uDED8 Soja grain', '\uD83E\uDED8 Arachide coque', '\uD83E\uDED8 Arachide décortiquée',
    '\uD83E\uDED8 Voandzou (pois de terre)', '\uD83E\uDED8 Pois d\'Angole',
    '\uD83C\uDD95 Autre légumineuse (ajouter)'
  ],

  // \uD83C\uDF36️ ÉPICES & CONDIMENTS (30+)
  epices_condiments: [
    '\uD83C\uDF36️ Piment rouge séché', '\uD83C\uDF36️ Piment vert', '\uD83C\uDF36️ Pili-pili',
    '\uD83C\uDF36️ Poivre noir', '\uD83C\uDF36️ Poivre blanc', '\uD83C\uDF36️ Poivre de Penja (Cameroun)',
    '\uD83E\uDDC4 Ail frais', '\uD83E\uDDC4 Ail en poudre', '\uD83E\uDDC5 Oignon séché',
    '\uD83C\uDF3F Gingembre frais', '\uD83C\uDF3F Gingembre séché', '\uD83C\uDF3F Curcuma',
    '\uD83C\uDF3F Persil séché', '\uD83C\uDF3F Thym', '\uD83C\uDF3F Laurier',
    '\uD83C\uDF3F Cannelle', '\uD83C\uDF3F Muscade', '\uD83C\uDF3F Clou de girofle',
    '\uD83C\uDF3F Njansan (épice camerounaise)', '\uD83C\uDF3F Djansang',
    '\uD83C\uDF3F Mbongo (épice noire)', '\uD83C\uDF3F 4 côtés',
    '\uD83C\uDF3F Cube Maggi', '\uD83C\uDF3F Cube Jumbo', '\uD83C\uDF3F Cube d\'arome',
    '\uD83E\uDDC2 Sel gemme', '\uD83E\uDDC2 Sel iodé', '\uD83E\uDDC2 Sel de mer',
    '\uD83C\uDD95 Autre épice (ajouter)'
  ],

  // \uD83C\uDF3B OLÉAGINEUX (15+)
  oleagineux: [
    '\uD83C\uDF3B Arachide décortiquée', '\uD83C\uDF3B Arachide en coque',
    '\uD83C\uDF3B Sésame', '\uD83C\uDF3B Tournesol',
    '\uD83E\uDED2 Noix de palme', '\uD83E\uDED2 Palmiste',
    '\uD83C\uDF30 Noix de cajou', '\uD83C\uDF30 Karité (amandes)',
    '\uD83E\uDD65 Coprah (coco séché)', '\uD83E\uDED2 Olive',
    '\uD83C\uDD95 Autre oléagineux (ajouter)'
  ],

  // ☕ CULTURES DE RENTE (15+)
  cultures_rente: [
    '☕ Café arabica', '☕ Café robusta', '☕ Café cerise',
    '\uD83C\uDF6B Cacao fève', '\uD83C\uDF6B Cacao marchand', '\uD83C\uDF6B Cacao fin',
    '\uD83C\uDF75 Thé vert', '\uD83C\uDF75 Thé noir',
    '\uD83C\uDF3F Coton graine', '\uD83C\uDF3F Coton fibre',
    '\uD83C\uDF3F Tabac feuille',
    '\uD83C\uDF3F Hévéa (latex)', '\uD83C\uDF3F Caoutchouc',
    '\uD83E\uDDB4 Canne à sucre',
    '\uD83C\uDD95 Autre culture de rente (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83D\uDC04 ANIMAUX D'ÉLEVAGE (50+ types)
  // ═══════════════════════════════════════════════════════════════════════════

  // \uD83D\uDC04 BOVINS
  animaux_bovins: [
    '\uD83D\uDC04 Bœuf adulte (race locale)', '\uD83D\uDC04 Vache laitière', '\uD83D\uDC04 Vache allaitante',
    '\uD83D\uDC02 Taureau reproducteur', '\uD83D\uDC02 Zébu Foulbé', '\uD83D\uDC02 Zébu Bororo',
    '\uD83D\uDC02 Goudali (race camerounaise)', '\uD83D\uDC02 Ndama (race ouest-africaine)',
    '\uD83D\uDC2E Veau de lait', '\uD83D\uDC2E Génisse', '\uD83D\uDC2E Broutard',
    '\uD83D\uDC02 Bœuf de trait', '\uD83D\uDC02 Bœuf d\'embouche',
    '\uD83C\uDD95 Autre bovin (ajouter)'
  ],

  // \uD83D\uDC0F OVINS (moutons)
  animaux_ovins: [
    '\uD83D\uDC0F Mouton Djallonké (race locale)', '\uD83D\uDC0F Mouton sahélien',
    '\uD83D\uDC11 Bélier reproducteur', '\uD83D\uDC11 Brebis',
    '\uD83D\uDC11 Agneau de lait', '\uD83D\uDC11 Agneau sevré',
    '\uD83D\uDC0F Mouton Peulh', '\uD83D\uDC0F Mouton touareg',
    '\uD83D\uDC0F Mouton d\'embouche (Tabaski)', '\uD83D\uDC0F Mouton de case',
    '\uD83C\uDD95 Autre ovin (ajouter)'
  ],

  // \uD83D\uDC10 CAPRINS (chèvres)
  animaux_caprins: [
    '\uD83D\uDC10 Chèvre naine (race locale)', '\uD83D\uDC10 Chèvre sahélienne',
    '\uD83D\uDC10 Bouc reproducteur', '\uD83D\uDC10 Chevrette',
    '\uD83D\uDC10 Cabri (chevreau)', '\uD83D\uDC10 Chèvre laitière',
    '\uD83D\uDC10 Chèvre d\'embouche', '\uD83D\uDC10 Chèvre de case',
    '\uD83C\uDD95 Autre caprin (ajouter)'
  ],

  // \uD83D\uDC16 PORCINS (porcs)
  animaux_porcins: [
    '\uD83D\uDC16 Porc local (race africaine)', '\uD83D\uDC16 Porc amélioré',
    '\uD83D\uDC16 Truie reproductrice', '\uD83D\uDC16 Verrat',
    '\uD83D\uDC37 Porcelet sevré', '\uD83D\uDC37 Porcelet de lait',
    '\uD83D\uDC16 Porc d\'embouche (80-100kg)', '\uD83D\uDC16 Porc charcutier (100-120kg)',
    '\uD83D\uDC16 Large White', '\uD83D\uDC16 Landrace', '\uD83D\uDC16 Duroc',
    '\uD83C\uDD95 Autre porcin (ajouter)'
  ],

  // \uD83D\uDC14 VOLAILLES (25+ types)
  animaux_volailles: [
    // Poulets
    '\uD83D\uDC14 Poulet de chair (45 jours)', '\uD83D\uDC14 Poulet fermier (3-4 mois)',
    '\uD83D\uDC14 Poulet local (bicyclette)', '\uD83D\uDC14 Poulet villageois',
    '\uD83D\uDC14 Poule pondeuse', '\uD83D\uDC14 Poule réforme', '\uD83D\uDC14 Coq reproducteur',
    '\uD83D\uDC25 Poussin 1 jour', '\uD83D\uDC25 Poussin démarré (7 jours)', '\uD83D\uDC25 Poussin 21 jours',

    // Autres volailles
    '\uD83E\uDD86 Canard de Barbarie', '\uD83E\uDD86 Canard mulard', '\uD83E\uDD86 Canette',
    '\uD83E\uDD83 Dinde locale', '\uD83E\uDD83 Dindon', '\uD83E\uDD83 Dindonneau',
    '\uD83D\uDC26 Pintade locale', '\uD83D\uDC26 Pintade méléagris', '\uD83D\uDC26 Pintadeaux',
    '\uD83D\uDD4A️ Pigeon', '\uD83E\uDD85 Caille', '\uD83E\uDDA2 Oie',

    '\uD83C\uDD95 Autre volaille (ajouter)'
  ],

  // \uD83D\uDC30 AUTRES ANIMAUX
  autres_animaux: [
    '\uD83D\uDC30 Lapin fermier', '\uD83D\uDC30 Lapin géant', '\uD83D\uDC30 Lapine reproductrice',
    '\uD83D\uDC0C Escargots (achatines)',
    '\uD83D\uDC1C Aulacodes (agoutis/grasscutters)',
    '\uD83E\uDD8E Varans (pour certains pays)',
    '\uD83C\uDD95 Autre animal (ajouter)'
  ],

  // \uD83D\uDC1D APICULTURE
  apiculture: [
    '\uD83D\uDC1D Abeilles (essaim)', '\uD83D\uDC1D Ruche peuplée', '\uD83D\uDC1D Reine d\'abeilles',
    '\uD83C\uDF6F Miel brut', '\uD83C\uDF6F Miel filtré', '\uD83C\uDF6F Miel en rayon',
    '\uD83D\uDD6F️ Cire d\'abeille', '\uD83C\uDF3F Propolis', '\uD83E\uDD5B Gelée royale',
    '\uD83C\uDD95 Autre produit apicole (ajouter)'
  ],

  // \uD83D\uDC1F AQUACULTURE / PISCICULTURE
  aquaculture: [
    '\uD83D\uDC1F Tilapia (alevins)', '\uD83D\uDC1F Tilapia (poisson table 200-300g)',
    '\uD83D\uDC1F Poisson-chat (Clarias)', '\uD83D\uDC1F Carpe commune',
    '\uD83D\uDC1F Silure africain', '\uD83D\uDC1F Heterotis',
    '\uD83E\uDD90 Crevettes d\'élevage', '\uD83E\uDD80 Crabes',
    '\uD83D\uDC0C Escargots aquatiques',
    '\uD83C\uDD95 Autre produit aquacole (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83D\uDCCF UNITÉS DE MESURE AFRICAINES (Adaptation locale essentielle !)
  // ═══════════════════════════════════════════════════════════════════════════

  unite_mesure: [
    // ──── POIDS (Système métrique) ────
    '⚖️ Gramme (g)', '⚖️ 100g', '⚖️ 250g', '⚖️ 500g',
    '⚖️ Kilogramme (kg)', '⚖️ 2 kg', '⚖️ 5 kg', '⚖️ 10 kg',
    '⚖️ 25 kg', '⚖️ 50 kg', '⚖️ 100 kg',
    '⚖️ Tonne (1000 kg)', '⚖️ Quintal (100 kg)',

    // ──── SEAUX (Très utilisé en Afrique !) ────
    '\uD83E\uDEA3 Seau 2L', '\uD83E\uDEA3 Seau 5L', '\uD83E\uDEA3 Seau 10L',
    '\uD83E\uDEA3 Seau 15L (standard)', '\uD83E\uDEA3 Seau 20L', '\uD83E\uDEA3 Seau 25L',
    '\uD83E\uDEA3 Demi-seau', '\uD83E\uDEA3 Quart de seau',

    // ──── SACS ────
    '\uD83D\uDCBC Sac 1 kg', '\uD83D\uDCBC Sac 2 kg', '\uD83D\uDCBC Sac 5 kg',
    '\uD83D\uDCBC Sac 10 kg', '\uD83D\uDCBC Sac 25 kg (standard)', '\uD83D\uDCBC Sac 50 kg',
    '\uD83D\uDCBC Sac 100 kg', '\uD83D\uDCBC Grand sac (50-100kg)',
    '\uD83D\uDCBC Demi-sac', '\uD83D\uDCBC Quart de sac',

    // ──── VER (Pour arachides, soja, etc.) ────
    '\uD83E\uDD5C Ver (petite mesure)', '\uD83E\uDD5C Demi-ver', '\uD83E\uDD5C Grand ver',

    // ──── CAGIO / CAGEOT (Pour tomates, légumes) ────
    // Note : "Cagio" est le terme local africain, "Cageot" est le terme français
    '\uD83E\uDDFA Cagio petit', '\uD83E\uDDFA Cagio moyen', '\uD83E\uDDFA Cagio grand',
    '\uD83E\uDDFA Cageot bois', '\uD83E\uDDFA Cageot plastique',
    '\uD83E\uDDFA Demi-cagio', '\uD83E\uDDFA Quart de cagio',
    '\uD83E\uDDFA Demi-cageot', '\uD83E\uDDFA Quart de cageot',

    // ──── TAS (Pour ignames, manioc) ────
    '\uD83E\uDD54 Tas (petit)', '\uD83E\uDD54 Tas (moyen)', '\uD83E\uDD54 Tas (grand)',
    '\uD83E\uDD54 Demi-tas', '\uD83E\uDD54 10 tubercules', '\uD83E\uDD54 20 tubercules',

    // ──── LIASSE / BOTTE (Pour légumes feuilles) ────
    '\uD83E\uDD6C Liasse (petite)', '\uD83E\uDD6C Liasse (moyenne)', '\uD83E\uDD6C Liasse (grande)',
    '\uD83E\uDD6C Botte', '\uD83E\uDD6C Demi-botte', '\uD83E\uDD6C Fagot',

    // ──── PANIER ────
    '\uD83E\uDDFA Panier petit', '\uD83E\uDDFA Panier moyen', '\uD83E\uDDFA Panier grand',
    '\uD83E\uDDFA Panier traditionnel', '\uD83E\uDDFA Panier tressé',

    // ──── ALVÉOLE (Pour œufs) ────
    '\uD83E\uDD5A Alvéole 6 œufs', '\uD83E\uDD5A Alvéole 12 œufs (1 douzaine)',
    '\uD83E\uDD5A Alvéole 18 œufs', '\uD83E\uDD5A Alvéole 24 œufs (2 douzaines)',
    '\uD83E\uDD5A Alvéole 30 œufs (plateau)', '\uD83E\uDD5A Carton 180 œufs',
    '\uD83E\uDD5A Carton 360 œufs',

    // ──── RÉGIME (Pour bananes, plantains) ────
    '\uD83C\uDF4C Régime complet', '\uD83C\uDF4C Demi-régime', '\uD83C\uDF4C Quart de régime',
    '\uD83C\uDF4C Main (5-7 bananes)', '\uD83C\uDF4C Doigt (unité)',

    // ──── BOUTEILLE / BIDON (Pour liquides) ────
    '\uD83C\uDF76 Bouteille 33cl', '\uD83C\uDF76 Bouteille 50cl', '\uD83C\uDF76 Bouteille 1L',
    '\uD83C\uDF76 Bidon 5L', '\uD83C\uDF76 Bidon 10L', '\uD83C\uDF76 Bidon 20L', '\uD83C\uDF76 Bidon 25L',
    '\uD83C\uDF76 Jerrycan 20L', '\uD83C\uDF76 Jerrycan 25L',

    // ──── LITRE (Pour liquides - lait, huile) ────
    '\uD83E\uDD5B Litre (L)', '\uD83E\uDD5B Demi-litre (0.5L)', '\uD83E\uDD5B Quart de litre (0.25L)',
    '\uD83E\uDD5B 5 litres', '\uD83E\uDD5B 10 litres', '\uD83E\uDD5B 20 litres',

    // ──── VRAC ────
    '\uD83D\uDCE6 Vrac (au poids)', '\uD83D\uDCE6 Vrac (au volume)',

    // ──── UNITÉ / PIÈCE ────
    '1️⃣ Unité', '1️⃣ Pièce', '1️⃣ Tête (pour animaux)',
    '1️⃣ Lot de 10', '1️⃣ Lot de 50', '1️⃣ Lot de 100',

    '\uD83C\uDD95 Autre unité (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83C\uDF0D ORIGINE / PROVENANCE (Par pays)
  // ═══════════════════════════════════════════════════════════════════════════
  origine_geographique: [
    // Cameroun (Focus principal)
    '\uD83C\uDDE8\uD83C\uDDF2 Cameroun - Littoral (Douala, Édéa)', '\uD83C\uDDE8\uD83C\uDDF2 Cameroun - Centre (Yaoundé, Mbalmayo)',
    '\uD83C\uDDE8\uD83C\uDDF2 Cameroun - Ouest (Bafoussam, Dschang)', '\uD83C\uDDE8\uD83C\uDDF2 Cameroun - Nord-Ouest (Bamenda)',
    '\uD83C\uDDE8\uD83C\uDDF2 Cameroun - Sud-Ouest (Buea, Kumba)', '\uD83C\uDDE8\uD83C\uDDF2 Cameroun - Adamaoua (Ngaoundéré)',
    '\uD83C\uDDE8\uD83C\uDDF2 Cameroun - Nord (Garoua)', '\uD83C\uDDE8\uD83C\uDDF2 Cameroun - Extrême-Nord (Maroua)',
    '\uD83C\uDDE8\uD83C\uDDF2 Cameroun - Sud (Ebolowa, Kribi)', '\uD83C\uDDE8\uD83C\uDDF2 Cameroun - Est (Bertoua)',

    // Autres pays francophones
    '\uD83C\uDDE8\uD83C\uDDEE Côte d\'Ivoire', '\uD83C\uDDF8\uD83C\uDDF3 Sénégal', '\uD83C\uDDF2\uD83C\uDDF1 Mali', '\uD83C\uDDE7\uD83C\uDDEF Bénin',
    '\uD83C\uDDF9\uD83C\uDDEC Togo', '\uD83C\uDDE7\uD83C\uDDEB Burkina Faso', '\uD83C\uDDF3\uD83C\uDDEA Niger', '\uD83C\uDDF9\uD83C\uDDE9 Tchad',
    '\uD83C\uDDE8\uD83C\uDDE9 RD Congo', '\uD83C\uDDE8\uD83C\uDDEC Congo-Brazzaville', '\uD83C\uDDEC\uD83C\uDDE6 Gabon',
    '\uD83C\uDDEC\uD83C\uDDF3 Guinée Conakry', '\uD83C\uDDF2\uD83C\uDDEC Madagascar', '\uD83C\uDDF2\uD83C\uDDE6 Maroc',

    // Production locale
    '\uD83C\uDFE1 Production locale (village)', '\uD83C\uDFE1 Production fermière',
    '\uD83C\uDFE1 Jardin potager', '\uD83C\uDFE1 Exploitation familiale',

    // Importation
    '\uD83C\uDF0D Importé Europe', '\uD83C\uDF0D Importé Asie', '\uD83C\uDF0D Importé Amérique',

    '\uD83C\uDD95 Autre origine (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83C\uDF31 MÉTHODES DE PRODUCTION
  // ═══════════════════════════════════════════════════════════════════════════
  methode_production: [
    // Agriculture
    '\uD83C\uDF31 Agriculture biologique', '\uD83C\uDF31 Agriculture conventionnelle',
    '\uD83C\uDF31 Agriculture raisonnée', '\uD83C\uDF31 Agroécologie',
    '\uD83C\uDF31 Permaculture', '\uD83C\uDF31 Agriculture traditionnelle',
    '\uD83C\uDF31 Culture en serre', '\uD83C\uDF31 Culture sous abri',
    '\uD83C\uDF31 Plein champ', '\uD83C\uDF31 Culture maraîchère',
    '\uD83C\uDF31 Culture vivrière', '\uD83C\uDF31 Culture de rente',
    '\uD83C\uDF31 Hydroponie', '\uD83C\uDF31 Culture hors-sol',

    // Élevage
    '\uD83D\uDC04 Élevage traditionnel', '\uD83D\uDC04 Élevage moderne',
    '\uD83D\uDC04 Élevage intensif', '\uD83D\uDC04 Élevage semi-intensif',
    '\uD83D\uDC04 Élevage extensif (pâturage)', '\uD83D\uDC04 Élevage en divagation',
    '\uD83D\uDC04 Élevage fermier', '\uD83D\uDC04 Élevage biologique',
    '\uD83D\uDC04 Embouche (engraissement)', '\uD83D\uDC04 Élevage laitier',

    '\uD83C\uDD95 Autre méthode (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83C\uDFC6 QUALITÉ & LABELS
  // ═══════════════════════════════════════════════════════════════════════════
  qualite_labels: [
    '✅ Bio certifié', '✅ Agriculture biologique AB',
    '✅ Commerce équitable', '✅ Label Rouge',
    '✅ AOC (Appellation Origine Contrôlée)',
    '✅ IGP (Indication Géographique Protégée)',
    '✅ Sans pesticides', '✅ Sans OGM', '✅ Sans engrais chimiques',
    '✅ Halal', '✅ Kasher',
    '\uD83C\uDF1F Qualité premium', '\uD83C\uDF1F Première qualité',
    '\uD83C\uDF1F Qualité standard', '\uD83C\uDF1F Qualité économique',
    '\uD83C\uDF1F Produit frais du jour', '\uD83C\uDF1F Fraîcheur garantie',
    '\uD83C\uDF1F Production locale', '\uD83C\uDF1F Circuit court',
    '\uD83C\uDD95 Autre label (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83D\uDCC5 SAISONS & DISPONIBILITÉ
  // ═══════════════════════════════════════════════════════════════════════════
  saison_disponibilite: [
    '\uD83C\uDF1E Toute l\'année', '\uD83C\uDF1E Disponible actuellement',

    // Saisons africaines (2 saisons principales)
    '☔ Saison des pluies (Mars-Octobre)', '☀️ Saison sèche (Novembre-Février)',

    // Périodes spécifiques
    '\uD83D\uDCC5 Janvier-Février', '\uD83D\uDCC5 Mars-Avril', '\uD83D\uDCC5 Mai-Juin',
    '\uD83D\uDCC5 Juillet-Août', '\uD83D\uDCC5 Septembre-Octobre', '\uD83D\uDCC5 Novembre-Décembre',

    // Récoltes
    '\uD83C\uDF3E Période de récolte', '\uD83C\uDF3E Début de saison', '\uD83C\uDF3E Pleine saison',
    '\uD83C\uDF3E Fin de saison', '\uD83C\uDF3E Hors saison',

    // Disponibilité spéciale
    '⏰ Sur commande uniquement', '⏰ Stock limité',
    '⏰ Arrivage hebdomadaire', '⏰ Livraison jour de marché',

    '\uD83C\uDD95 Autre période (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83C\uDFAF ÉTAT & FRAÎCHEUR
  // ═══════════════════════════════════════════════════════════════════════════
  etat_fraicheur: [
    // Fraîcheur produits
    '✨ Ultra-frais (récolte jour même)', '✨ Très frais (récolte veille)',
    '✨ Frais (2-3 jours)', '✨ Bon état',

    // État animaux
    '\uD83D\uDC04 Animal vivant sur pied', '\uD83D\uDC04 Bonne santé', '\uD83D\uDC04 Vacciné',
    '\uD83D\uDC04 Déparasité', '\uD83D\uDC04 Suivi vétérinaire',

    // Transformation
    '\uD83D\uDCE6 Produit brut', '\uD83D\uDCE6 Nettoyé', '\uD83D\uDCE6 Lavé', '\uD83D\uDCE6 Trié',
    '\uD83D\uDCE6 Épluché', '\uD83D\uDCE6 Coupé', '\uD83D\uDCE6 Préparé',
    '\uD83D\uDCE6 Séché', '\uD83D\uDCE6 Fumé', '\uD83D\uDCE6 Salé', '\uD83D\uDCE6 Fermenté',

    // Conservation
    '❄️ Réfrigéré', '❄️ Congelé', '\uD83C\uDF21️ Température ambiante',

    '\uD83C\uDD95 Autre état (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83D\uDE9C MATÉRIEL & INTRANTS AGRICOLES
  // ═══════════════════════════════════════════════════════════════════════════
  materiel_equipements: [
    // Matériel de culture
    '\uD83D\uDE9C Tracteur', '\uD83D\uDE9C Motoculteur', '\uD83D\uDE9C Charrue',
    '\uD83D\uDE9C Herse', '\uD83D\uDE9C Semoir', '\uD83D\uDE9C Pulvérisateur',
    '\uD83D\uDE9C Brouette', '\uD83D\uDE9C Arrosoir', '\uD83D\uDE9C Pompe à eau',

    // Outils manuels
    '⚒️ Machette', '⚒️ Houe', '⚒️ Pioche', '⚒️ Râteau',
    '⚒️ Pelle', '⚒️ Fourche', '⚒️ Sécateur',

    // Matériel d'élevage
    '\uD83C\uDFE0 Poulailler', '\uD83C\uDFE0 Porcherie', '\uD83C\uDFE0 Étable', '\uD83C\uDFE0 Bergerie',
    '\uD83C\uDFE0 Clapier (lapins)', '\uD83C\uDFE0 Abreuvoir', '\uD83C\uDFE0 Mangeoire',
    '\uD83C\uDFE0 Clôture', '\uD83C\uDFE0 Filet', '\uD83C\uDFE0 Cage',

    // Matériel de transformation
    '⚙️ Décortiqueuse', '⚙️ Égreneuse', '⚙️ Moulin',
    '⚙️ Presse à huile', '⚙️ Séchoir',

    '\uD83C\uDD95 Autre matériel (ajouter)'
  ],

  intrants_agricoles: [
    // Semences & plants
    '\uD83C\uDF31 Semences certifiées', '\uD83C\uDF31 Semences locales', '\uD83C\uDF31 Semences hybrides',
    '\uD83C\uDF31 Plants maraîchers', '\uD83C\uDF31 Boutures', '\uD83C\uDF31 Greffons',

    // Engrais
    '\uD83D\uDC9A Fumier animal', '\uD83D\uDC9A Compost', '\uD83D\uDC9A Engrais organique',
    '\uD83D\uDC9A Engrais NPK', '\uD83D\uDC9A Urée', '\uD83D\uDC9A Engrais foliaire',
    '\uD83D\uDC9A Engrais minéral',

    // Produits phytosanitaires
    '\uD83E\uDDEA Pesticide', '\uD83E\uDDEA Herbicide', '\uD83E\uDDEA Fongicide',
    '\uD83E\uDDEA Insecticide', '\uD83E\uDDEA Produit bio',

    // Aliments animaux
    '\uD83C\uDF3E Aliment volaille (démarrage)', '\uD83C\uDF3E Aliment volaille (croissance)',
    '\uD83C\uDF3E Aliment volaille (finition)', '\uD83C\uDF3E Aliment pondeuse',
    '\uD83C\uDF3E Aliment porc', '\uD83C\uDF3E Aliment lapin',
    '\uD83C\uDF3E Concentré bétail', '\uD83C\uDF3E Tourteau', '\uD83C\uDF3E Son de riz/maïs',
    '\uD83C\uDF3E Complément minéral vitaminé (CMV)',

    // Produits vétérinaires
    '\uD83D\uDC89 Vaccin', '\uD83D\uDC8A Antibiotique', '\uD83D\uDC8A Antiparasitaire',
    '\uD83D\uDC8A Vitamines', '\uD83D\uDC8A Désinfectant',

    '\uD83C\uDD95 Autre intrant (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83C\uDFEA TYPE DE VENTE & COMMERCIALISATION
  // ═══════════════════════════════════════════════════════════════════════════
  type_vente: [
    // Modes de commercialisation standards
    '\uD83C\uDFEA Vente au détail', '\uD83C\uDFEA Vente en gros', '\uD83C\uDFEA Demi-gros',
    '\uD83D\uDCE6 Lot', '\uD83D\uDCE6 Palette', '\uD83D\uDCE6 Conteneur',
    '\uD83D\uDED2 Vente directe producteur', '\uD83D\uDED2 Circuit court',
    '\uD83C\uDFEA Vente au marché', '\uD83C\uDFEA Vente à domicile',
    '\uD83D\uDE9A Livraison possible', '\uD83D\uDE9A À emporter uniquement',
    '\uD83D\uDCB0 Prix négociable', '\uD83D\uDCB0 Prix fixe',
    '\uD83D\uDCDE Sur commande', '\uD83D\uDCDE Stock disponible',

    // ✅ TERMES LOCAUX AFRIQUE FRANCOPHONE
    // \uD83C\uDDE8\uD83C\uDDF2 CAMEROUN
    '\uD83C\uDFEA Bayam-Selam (Marchande au marché - Cameroun)',
    '\uD83C\uDFEA Bayam Sellam (Vendeuse au marché)',
    '\uD83C\uDFEA Boulot (Révendeur intermédiaire)',
    '\uD83C\uDFEA Fournisseur fermiers locaux',

    // \uD83C\uDDE8\uD83C\uDDEE CÔTE D'IVOIRE
    '\uD83C\uDFEA Boutiquier (Épicier Côte d\'Ivoire)',
    '\uD83C\uDFEA Commerçant marché Adjamé',

    // \uD83C\uDDF8\uD83C\uDDF3 SÉNÉGAL
    '\uD83C\uDFEA Détaillant ouolof',
    '\uD83C\uDFEA Vendeur Sandaga',

    // \uD83C\uDDF2\uD83C\uDDF1 MALI
    '\uD83C\uDFEA Dillali (Courtier agricole - Mali)',
    '\uD83C\uDFEA Commerçant marché de Bamako',

    // \uD83C\uDDE7\uD83C\uDDEF BÉNIN
    '\uD83C\uDFEA Façonnière (Révendeuse Bénin)',

    // \uD83C\uDF0D TERMES GÉNÉRIQUES
    '\uD83C\uDFEA Révendeur professionnel', '\uD83C\uDFEA Grossiste',
    '\uD83C\uDFEA Importateur agricole', '\uD83C\uDFEA Exportateur local',
    '\uD83D\uDED2 Coopérative agricole', '\uD83D\uDED2 GIE (Groupement d\'intérêt économique)',

    '\uD83C\uDD95 Autre type de vente (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83D\uDE9A CONDITIONNEMENT & EMBALLAGE
  // ═══════════════════════════════════════════════════════════════════════════
  conditionnement_emballage: [
    '\uD83D\uDCE6 Vrac (sans emballage)', '\uD83D\uDCE6 Sac plastique', '\uD83D\uDCE6 Sac papier',
    '\uD83D\uDCE6 Sac jute/toile', '\uD83D\uDCE6 Sac polypropylène',
    '\uD83D\uDCE6 Carton', '\uD83D\uDCE6 Cageot bois', '\uD83D\uDCE6 Cageot plastique',
    '\uD83D\uDCE6 Panier traditionnel', '\uD83D\uDCE6 Panier plastique tressé',
    '\uD83D\uDCE6 Filet', '\uD83D\uDCE6 Film plastique', '\uD83D\uDCE6 Sous vide',
    '\uD83D\uDCE6 Barquette', '\uD83D\uDCE6 Boîte', '\uD83D\uDCE6 Bouteille', '\uD83D\uDCE6 Bidon',
    '\uD83C\uDD95 Autre conditionnement (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // \uD83C\uDF3E ZONES D'INTERVENTION (Utilise le système existant)
  // ═══════════════════════════════════════════════════════════════════════════
  zones_intervention: genererZonesIntervention('CM')
};

// ✅ ALIAS pour compatibilité avec l'ancien nom
export const AGRICULTURE_MODALITIES = AGRICULTURE_ELEVAGE_MODALITIES;

// ✅ MODALITÉS SPORT & FITNESS - ENRICHI CONTEXTE AFRIQUE FRANCOPHONE
export const SPORT_FITNESS_MODALITIES: ModalityCategory = {
  // Types de sports (enrichi avec sports locaux)
  types: [
    // Sports collectifs populaires
    'Football', 'Basketball', 'Volleyball', 'Handball',
    // Fitness & Cardio
    'Musculation', 'Cardio', 'CrossFit', 'Circuit Training', 'HIIT',
    // Douceur & Bien-être
    'Yoga', 'Pilates', 'Stretching', 'Méditation',
    // Sports de combat
    'Boxe', 'Kickboxing', 'Muay Thai', 'MMA', 'Karaté', 'Taekwondo', 'Judo',
    'Lutte traditionnelle', // Sport local africain
    // Danse & Rythme
    'Zumba', 'Danse', 'Aerobic', 'Step', 'Danse africaine',
    // Sports individuels
    'Natation', 'Tennis', 'Cyclisme', 'Course à pied', 'Running', 'Jogging',
    'Golf', 'Squash', 'Badminton', 'Tennis de table',
    // Spécialisés
    'Spinning', 'Body Pump', 'Body Combat', 'TRX', 'Corde à sauter',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Niveaux
  niveaux: [
    'Débutant', 'Débutant avancé', 'Intermédiaire', 'Intermédiaire avancé',
    'Avancé', 'Compétition', 'Professionnel', 'Tous niveaux',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Durées des séances (structuré)
  durees: [
    '30 minutes', '45 minutes', '1 heure', '1h15', '1h30', '2 heures',
    '2h30', '3 heures', 'Demi-journée', 'Journée complète',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements disponibles/fournis
  equipements: [
    // Cardio
    'Tapis de course', 'Vélo d\'appartement', 'Vélo spinning', 'Rameur', 'Elliptique',
    'Stepper', 'Vélo Assault', 'Ski-erg',
    // Musculation
    'Haltères', 'Barres olympiques', 'Disques de fonte', 'Kettlebells',
    'Banc de musculation', 'Rack à squat', 'Smith machine', 'Presse à cuisses',
    'Poulie haute/basse', 'Cages de crossfit',
    // Fonctionnel
    'TRX', 'Battle rope', 'Sacs de sable', 'Bosu', 'Swiss ball',
    'Medicine ball', 'Slam ball', 'Box de pliométrie',
    // Yoga & Pilates
    'Tapis de yoga', 'Briques de yoga', 'Sangles de yoga', 'Rouleaux en mousse',
    // Accessoires
    'Corde à sauter', 'Élastiques de résistance', 'Bandes élastiques', 'Gants',
    'Miroirs', 'Vestiaires', 'Douches', 'Casiers', 'Climatisation',
    'Parking', 'Wifi', 'Bar protéiné', 'Espace détente',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de services
  services: [
    'Abonnement mensuel', 'Abonnement trimestriel', 'Abonnement annuel',
    'Séance à l\'unité', 'Pack 5 séances', 'Pack 10 séances', 'Pack 20 séances',
    'Coaching personnalisé', 'Coaching en groupe', 'Cours collectifs',
    'Personal training', 'Programme sur mesure', 'Bilan physique initial',
    'Suivi nutritionnel', 'Plan alimentaire', 'Consultation diététique',
    'Cours d\'essai gratuit', 'Séance découverte',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Salles de sport & centres renommés (Cameroun + Afrique francophone)
  salles_sport_cameroun: [
    // Douala
    'Fitness First Douala', 'Planet Fitness Douala', 'Energy Gym Douala',
    'Body Shape Gym', 'Power Gym Akwa', 'Gold\'s Gym Bonapriso',
    'CrossFit Douala', 'Yoga Studio Douala', 'Wellness Center Bonanjo',
    'Sport Zone Makepe', 'Dynamic Fitness Bonabéri', 'Champion Gym Deido',
    // Yaoundé
    'Fitness Club Bastos', 'Gym Center Nlongkak', 'Top Form Yaoundé',
    'CrossFit Yaoundé', 'Energie Gym Yaoundé', 'Body Fit Center',
    'Power House Gym', 'Wellness Gym Bastos', 'Sport Palace Yaoundé',
    'Yoga Bastos', 'Pilates Studio Yaoundé',
    // Autres villes
    'Gym Bafoussam', 'Fitness Garoua', 'Sport Center Bamenda',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques populaires (focus Afrique)
  marques: [
    // Marques internationales présentes en Afrique
    'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour',
    'New Balance', 'Asics', 'Fila', 'Kappa', 'Lotto',
    // Accessible
    'Decathlon', 'Kipsta', 'Domyos', 'Kalenji', 'Nabaiji',
    // Autres
    'Champion', 'Umbro', 'Diadora', 'Le Coq Sportif', 'Hummel',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Tailles vêtements sport
  tailles: [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Jours et horaires
  jours_disponibles: [
    'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche',
    'Lundi au Vendredi', 'Week-end uniquement', 'Tous les jours',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  horaires: [
    '06h00 - 08h00 (Matin tôt)', '08h00 - 10h00 (Matinée)',
    '10h00 - 12h00 (Fin de matinée)', '12h00 - 14h00 (Midi)',
    '14h00 - 16h00 (Début après-midi)', '16h00 - 18h00 (Fin après-midi)',
    '18h00 - 20h00 (Soirée)', '20h00 - 22h00 (Soirée tardive)',
    '06h00 - 22h00 (Ouvert toute la journée)', 'Flexible',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types d'objectifs
  objectifs: [
    'Perte de poids', 'Prise de masse musculaire', 'Tonification',
    'Remise en forme', 'Amélioration cardio', 'Gain de force',
    'Souplesse et mobilité', 'Préparation sportive', 'Rééducation',
    'Bien-être et détente', 'Compétition', 'Maintien de la forme',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Zones intervention (villes principales Cameroun)
  zones_intervention: genererZonesIntervention('CM'), // Système intelligent africanLocations.ts

  // Sports populaires Afrique
  sports_populaires_afrique: [
    'Football', 'Basketball', 'Handball', 'Volleyball',
    'Lutte traditionnelle', 'Course à pied', 'Athlétisme',
    'Boxe', 'Arts martiaux', 'Cyclisme', 'Natation',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS BIEN-ÊTRE & SPA
// ════════════════════════════════════════════════════════════
// \uD83E\uDDD8 BIEN-ÊTRE & SPA - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
// ════════════════════════════════════════════════════════════
export const BIEN_ETRE_SPA_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE SOINS (25+ options)
  types: [
    // Massages
    'Massage suédois (relaxant, circulation sanguine)',
    'Massage thaïlandais (étirements, pression)',
    'Massage californien (doux, relaxation profonde)',
    'Massage ayurvédique (huiles, équilibre énergétique)',
    'Massage aux pierres chaudes (détente musculaire)',
    'Massage balinais (pressions, étirements)',
    'Massage shiatsu (points de pression)',
    'Massage africain traditionnel (beurre de karité)',
    'Massage sportif (récupération musculaire)',
    'Massage femme enceinte (prénatal)',

    // Spa & Balnéothérapie
    'Hammam (vapeur, gommage)',
    'Sauna (chaleur sèche, détox)',
    'Jacuzzi / Bain à remous',
    'Balnéothérapie (bains hydromassants)',
    'Thalassothérapie (eau de mer)',

    // Soins corporels
    'Gommage corporel (exfoliation)',
    'Enveloppement corporel (argile, algues)',
    'Drainage lymphatique (détox, circulation)',

    // Soins visage
    'Soin visage hydratant',
    'Soin visage anti-âge',
    'Soin visage purifiant (acné)',
    'Soin visage éclaircissant',

    // Soins énergétiques & alternatifs
    'Réflexologie plantaire (points de pression pieds)',
    'Aromathérapie (huiles essentielles)',
    'Reiki (énergie, guérison)',
    'Méditation guidée',
    'Yoga & Relaxation',
    'Sophrologie (relaxation dynamique)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE MASSAGES (détaillés, 15+ options)
  massages: [
    'Massage suédois (relaxant)',
    'Massage californien (doux)',
    'Massage thaïlandais (étirements)',
    'Massage ayurvédique (huiles)',
    'Massage shiatsu (pression)',
    'Massage balinais (énergétique)',
    'Massage deep tissue (profond)',
    'Massage sportif (récupération)',
    'Massage relaxant (anti-stress)',
    'Massage aux pierres chaudes',
    'Massage aromathérapie (huiles essentielles)',
    'Massage africain (beurre de karité)',
    'Massage femme enceinte (prénatal)',
    'Massage réflexologie (pieds, mains)',
    'Massage drainage lymphatique',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ SERVICES & ÉQUIPEMENTS (15+ options)
  services: [
    'Hammam',
    'Sauna',
    'Jacuzzi / Bain à remous',
    'Piscine chauffée',
    'Salle de massage privée',
    'Cabine duo (massage à 2)',
    'Espace relaxation (thé, tisanes)',
    'Vestiaires individuels',
    'Climatisation',
    'Musique relaxante',
    'Aromathérapie (diffuseur huiles essentielles)',
    'Produits bio / naturels',
    'Produits africains (beurre karité, huile argan)',
    'Service à domicile',
    'Parking gratuit',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DURÉES (10+ options)
  durees: [
    '30 minutes (rapide)',
    '45 minutes',
    '1 heure (standard)',
    '1h30 (relaxation complète)',
    '2 heures (soin premium)',
    '2h30',
    '3 heures (formule luxe)',
    'Demi-journée (4h)',
    'Journée complète (8h)',
    'À la carte (durée flexible)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FORMULES & FORFAITS (12+ options)
  forfaits: [
    'Séance unique (à l\'unité)',
    'Forfait 3 séances',
    'Forfait 5 séances',
    'Forfait 10 séances',
    'Abonnement mensuel (illimité)',
    'Formule Découverte (1er client)',
    'Formule Couple (2 personnes)',
    'Formule Détente (massage + hammam)',
    'Formule Premium (3 soins)',
    'Carte cadeau disponible',
    'Enterrement de vie de jeune fille',
    'Spa day (journée)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPE DE CLIENTÈLE (7+ options)
  clientele: [
    'Hommes uniquement',
    'Femmes uniquement',
    'Mixte (hommes et femmes)',
    'Couples (massage duo)',
    'Femmes enceintes',
    'Seniors',
    'Sportifs (récupération)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TARIFICATION (fourchettes FCFA Afrique francophone)
  tarifs: [
    'Moins de 10 000 FCFA',
    '10 000 - 20 000 FCFA',
    '20 000 - 35 000 FCFA',
    '35 000 - 50 000 FCFA',
    '50 000 - 75 000 FCFA',
    '75 000 - 100 000 FCFA',
    'Plus de 100 000 FCFA (luxe)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ SPÉCIALITÉS & BESOINS (15+ options)
  specialites: [
    'Relaxation & Anti-stress',
    'Détox & Drainage',
    'Minceur & Amincissement',
    'Cellulite & Raffermissement',
    'Douleurs musculaires',
    'Circulation sanguine',
    'Insomnie & Troubles du sommeil',
    'Migraine & Maux de tête',
    'Récupération sportive',
    'Soins post-partum',
    'Soins anti-âge',
    'Soins éclaircissants (teint)',
    'Soins peaux noires / métissées',
    'Soins bio / naturels',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ HORAIRES D'OUVERTURE (8+ options)
  horaires: [
    'Ouvert le dimanche',
    'Ouvert en soirée (après 18h)',
    'Ouvert tôt le matin (avant 8h)',
    '24h/24 (sur réservation)',
    'Jours fériés',
    'Sur rendez-vous uniquement',
    'Sans rendez-vous (walk-in)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ THÉRAPEUTES & PERSONNEL (8+ options)
  personnel: [
    'Thérapeutes diplômés (certification)',
    'Massage thérapeutique médical',
    'Kinésithérapeute sur place',
    'Personnel féminin uniquement',
    'Personnel masculin disponible',
    'Formation continue',
    'Plusieurs langues (FR, EN, etc.)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ LOCALISATION & ACCESSIBILITÉ (10+ options)
  localisation: [
    'Centre-ville (facile d\'accès)',
    'Quartier résidentiel (calme)',
    'Hôtel 4-5 étoiles',
    'Spa indépendant',
    'Parking gratuit',
    'Accès handicapés',
    'Arrêt de bus proche',
    'Zone sécurisée',
    'Service navette / transfert',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CERTIFICATIONS & LABELS (8+ options)
  certifications: [
    'Certifié spa professionnel',
    'Label bio / éco-responsable',
    'Produits certifiés (Ecocert, etc.)',
    'Hygiène & désinfection stricte',
    'Thérapeutes certifiés',
    'Membre d\'association professionnelle',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MODES DE PAIEMENT (8+ options)
  paiement: [
    'Espèces (Cash)',
    'Mobile Money (MTN, Orange)',
    'Carte bancaire',
    'Virement bancaire',
    'Chèques acceptés',
    'Paiement en plusieurs fois',
    'Réduction 1ère visite',
    'Fidélité (points, réductions)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ AMBIANCE & STYLE (8+ options)
  ambiance: [
    'Zen & Minimaliste',
    'Luxe & Raffiné',
    'Traditionnel africain',
    'Moderne & Design',
    'Naturel & Éco',
    'Oriental (style asiatique)',
    'Intime & Discret',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ PRESTATIONS COMPLÉMENTAIRES (10+ options)
  prestations_complementaires: [
    'Manucure / Pédicure',
    'Coiffure sur place',
    'Esthétique (épilation, maquillage)',
    'Coach nutritionnel',
    'Coach sportif',
    'Consultation bien-être',
    'Boutique produits (huiles, crèmes)',
    'Espace restauration / bar à jus',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CENTRES & SPAS RENOMMÉS (20+ Afrique francophone)
  centres_renommes: [
    // Cameroun
    '\uD83C\uDDE8\uD83C\uDDF2 La Source du Nil (Yaoundé)',
    '\uD83C\uDDE8\uD83C\uDDF2 Hilton Spa Yaoundé',
    '\uD83C\uDDE8\uD83C\uDDF2 Merina Hotel Spa (Yaoundé)',
    '\uD83C\uDDE8\uD83C\uDDF2 Pullman Douala Spa',
    '\uD83C\uDDE8\uD83C\uDDF2 Sawa Hotel Spa (Douala)',
    '\uD83C\uDDE8\uD83C\uDDF2 Azur Bien-Être (Douala)',
    '\uD83C\uDDE8\uD83C\uDDF2 Zen Attitude Spa (Yaoundé)',

    // Côte d'Ivoire
    '\uD83C\uDDE8\uD83C\uDDEE Sofitel Abidjan Spa',
    '\uD83C\uDDE8\uD83C\uDDEE Ivoire Hotel Spa',
    '\uD83C\uDDE8\uD83C\uDDEE Azalaï Spa (Abidjan)',
    '\uD83C\uDDE8\uD83C\uDDEE Wellness Center Abidjan',

    // Sénégal
    '\uD83C\uDDF8\uD83C\uDDF3 Terrou-Bi Spa (Dakar)',
    '\uD83C\uDDF8\uD83C\uDDF3 Radisson Blu Spa Dakar',
    '\uD83C\uDDF8\uD83C\uDDF3 King Fahd Palace Spa',
    '\uD83C\uDDF8\uD83C\uDDF3 Spa Djoloff (Dakar)',

    // Gabon
    '\uD83C\uDDEC\uD83C\uDDE6 Radisson Blu Spa Libreville',
    '\uD83C\uDDEC\uD83C\uDDE6 Hibiscus Spa (Libreville)',

    // Congo
    '\uD83C\uDDE8\uD83C\uDDEC Pefaco Spa (Brazzaville)',

    '\uD83C\uDD95 Autre spa (ajouter)'
  ],

  // ✅ PROMOTIONS & OFFRES (8+ options)
  promotions: [
    'Promotion en cours (-10% à -50%)',
    'Offre découverte 1ère visite',
    'Tarif réduit groupe (3+ personnes)',
    'Happy hour (tarif réduit certaines heures)',
    'Forfait anniversaire',
    'Forfait couple (Saint-Valentin)',
    'Offre parrainage',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ PRODUITS UTILISÉS (spécificité africaine, 12+ options)
  produits: [
    'Beurre de karité pur (Afrique)',
    'Huile d\'argan (Maroc)',
    'Huile de coco vierge',
    'Huile de baobab',
    'Huile d\'avocat',
    'Argile verte / rouge',
    'Algues marines',
    'Huiles essentielles bio',
    'Produits certifiés Ecocert',
    'Produits locaux africains',
    'Produits de luxe internationaux',
    'Produits végans / cruelty-free',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ZONES GÉOGRAPHIQUES PRIORITAIRES
  // S'adapte au pays de l'utilisateur via genererZonesIntervention()
  zones_intervention: genererZonesIntervention('CM'),

  // ✅ VILLES (toutes les villes Afrique francophone avec priorité pays utilisateur)
  villes: genererToutesLesVilles('CM'),

  // ✅ QUARTIERS (tous les quartiers du pays)
  quartiers: genererQuartiersPays('CM')
};

// ✅ MODALITÉS ANIMAUX & VÉTÉRINAIRE - ENRICHIES POUR AFRIQUE FRANCOPHONE
export const ANIMAUX_VETERINAIRE_MODALITIES: ModalityCategory = {
  // ✅ Types d'animaux (ENRICHI avec contexte africain)
  animaux: [
    // ════════ ANIMAUX DOMESTIQUES ════════
    '\uD83D\uDC15 Chien', '\uD83D\uDC08 Chat',

    // ════════ OISEAUX (très populaires en Afrique) ════════
    '\uD83E\uDD9C Perroquet africain', '\uD83E\uDD9C Gris du Gabon', '\uD83E\uDD9C Youyou du Sénégal',
    '\uD83E\uDD9C Inséparable', '\uD83E\uDD9C Calopsitte', '\uD83D\uDC26 Canari', '\uD83D\uDC26 Pigeon',

    // ════════ ANIMAUX D\'ÉLEVAGE ════════
    '\uD83D\uDC04 Bétail (bœuf, vache, zébu)', '\uD83D\uDC10 Chèvre', '\uD83D\uDC0F Mouton',
    '\uD83D\uDC14 Volaille (poulet, poule, coq)', '\uD83E\uDD86 Canard', '\uD83E\uDD83 Dinde',
    '\uD83E\uDDA2 Oie', '\uD83D\uDC16 Porc', '\uD83D\uDC30 Lapin (élevage)',

    // ════════ AUTRES ════════
    '\uD83D\uDC1F Poisson d\'aquarium', '\uD83E\uDD8E Reptile (lézard, gecko)',
    '\uD83D\uDC22 Tortue', '\uD83D\uDC34 Cheval', '\uD83D\uDC0E Âne', '\uD83D\uDC39 Rongeur (hamster, cochon d\'Inde)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Services vétérinaires (ENRICHI)
  services: [
    // ════════ SOINS MÉDICAUX ════════
    '\uD83D\uDC89 Consultation générale',
    '\uD83D\uDC89 Vaccination (rage, parvovirose, etc.)',
    '\uD83D\uDC8A Déparasitage (interne/externe)',
    '\uD83D\uDC8A Traitement anti-puces/tiques',
    '\uD83C\uDFE5 Soins d\'urgence',
    '\uD83E\uDE7A Diagnostic/Analyses',

    // ════════ CHIRURGIE ════════
    '✂️ Stérilisation/Castration',
    '\uD83C\uDFE5 Chirurgie générale',
    '\uD83E\uDDB4 Chirurgie orthopédique',

    // ════════ SOINS SPÉCIALISÉS ════════
    '\uD83E\uDDB7 Soins dentaires',
    '\uD83D\uDC42 Soins oreilles/yeux',
    '\uD83D\uDC87 Toilettage (bain, coupe)',
    '✂️ Coupe griffes/ongles',

    // ════════ SERVICES ════════
    '\uD83C\uDFE0 Garde d\'animaux (pension)',
    '\uD83C\uDF93 Dressage/Éducation',
    '\uD83D\uDC15‍\uD83E\uDDBA Dressage de garde',
    '\uD83D\uDCCB Certificat vétérinaire',
    '\uD83D\uDE91 Visite à domicile',
    '\uD83D\uDCDE Téléconsultation',

    // ════════ ÉLEVAGE ════════
    '\uD83D\uDC04 Suivi d\'élevage (bétail)',
    '\uD83D\uDC14 Suivi avicole (volaille)',
    '\uD83E\uDD30 Suivi de reproduction',
    '\uD83E\uDE7A Insémination artificielle',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Produits pour animaux (ENRICHI)
  produits: [
    // ════════ ALIMENTATION ════════
    '\uD83C\uDF56 Nourriture sèche (croquettes)',
    '\uD83E\uDD6B Nourriture humide (pâtée)',
    '\uD83C\uDF56 Viande fraîche',
    '\uD83E\uDDB4 Os à mâcher',
    '\uD83C\uDF6A Friandises',
    '\uD83C\uDF3E Aliment pour volaille',
    '\uD83C\uDF3E Aliment pour bétail',

    // ════════ SANTÉ ════════
    '\uD83D\uDC8A Médicaments vétérinaires',
    '\uD83D\uDC89 Vaccins',
    '\uD83D\uDC8A Antiparasitaires',
    '\uD83D\uDC8A Vitamines/Compléments',

    // ════════ ACCESSOIRES ════════
    '\uD83C\uDFE0 Cage/Clapier',
    '\uD83D\uDC1F Aquarium',
    '\uD83E\uDEBA Niche',
    '\uD83D\uDECF️ Coussin/Tapis',
    '\uD83E\uDEA3 Litière',
    '\uD83E\uDD63 Gamelle (eau/nourriture)',

    // ════════ ÉQUIPEMENT ════════
    '\uD83E\uDDB4 Collier', '\uD83E\uDDB4 Laisse', '\uD83E\uDDB4 Harnais',
    '\uD83C\uDFBE Jouets',
    '\uD83C\uDF92 Sac de transport',
    '\uD83E\uDDFC Produits d\'hygiène',
    '\uD83E\uDE92 Matériel toilettage',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Races de chiens (ENRICHI avec races populaires en Afrique)
  races_chiens: [
    // ════════ RACES LOCALES/AFRICAINES ════════
    '\uD83D\uDC15 Chien local (race africaine)',
    '\uD83D\uDC15 Basenji (chien du Congo)',
    '\uD83D\uDC15 Sloughi (lévrier africain)',
    '\uD83D\uDC15 Azawakh (lévrier touareg)',

    // ════════ RACES DE GARDE (très populaires) ════════
    '\uD83E\uDDAE Berger allemand',
    '\uD83E\uDDAE Rottweiler',
    '\uD83E\uDDAE Doberman',
    '\uD83E\uDDAE Malinois (Berger belge)',
    '\uD83E\uDDAE Pitbull/American Staffordshire',
    '\uD83E\uDDAE Cane Corso',
    '\uD83E\uDDAE Dogue allemand',
    '\uD83E\uDDAE Bullmastiff',

    // ════════ RACES COURANTES ════════
    '\uD83D\uDC15 Labrador',
    '\uD83D\uDC15 Golden Retriever',
    '\uD83D\uDC15 Husky',
    '\uD83D\uDC15 Bulldog',

    // ════════ PETITES RACES ════════
    '\uD83D\uDC29 Caniche',
    '\uD83D\uDC15 Chihuahua',
    '\uD83D\uDC15 Yorkshire Terrier',
    '\uD83D\uDC15 Shih Tzu',

    // ════════ AUTRES ════════
    '\uD83D\uDC15 Croisé/Métis',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Races de chats (populaires en Afrique)
  races_chats: [
    '\uD83D\uDC08 Chat de gouttière (race locale)',
    '\uD83D\uDC08 Siamois',
    '\uD83D\uDC08 Persan',
    '\uD83D\uDC08 Angora',
    '\uD83D\uDC08 Maine Coon',
    '\uD83D\uDC08 Bengal',
    '\uD83D\uDC08 British Shorthair',
    '\uD83D\uDC08 Sacré de Birmanie',
    '\uD83D\uDC08 Abyssin',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Âge de l'animal
  age_animal: [
    '\uD83D\uDC3E Chiot/Chaton (0-6 mois)',
    '\uD83D\uDC3E Jeune (6 mois - 2 ans)',
    '\uD83D\uDC3E Adulte (2-7 ans)',
    '\uD83D\uDC3E Senior (7-10 ans)',
    '\uD83D\uDC3E Très âgé (10+ ans)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Taille de l'animal (pour chiens)
  taille_animal: [
    '\uD83D\uDCCF Très petit (< 5 kg)',
    '\uD83D\uDCCF Petit (5-10 kg)',
    '\uD83D\uDCCF Moyen (10-25 kg)',
    '\uD83D\uDCCF Grand (25-45 kg)',
    '\uD83D\uDCCF Très grand (> 45 kg)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: État de santé
  etat_sante: [
    '✅ Bonne santé',
    '\uD83D\uDC89 Vacciné à jour',
    '\uD83D\uDC8A Déparasité',
    '\uD83E\uDE7A Certificat vétérinaire disponible',
    '\uD83C\uDFE5 En traitement',
    '⚠️ Problème de santé (préciser)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Urgence
  urgence: [
    '\uD83D\uDEA8 Urgence absolue (< 1h)',
    '⚡ Urgent (< 24h)',
    '\uD83D\uDCC5 Rendez-vous planifié',
    '\uD83D\uDC8A Suivi régulier',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Horaires
  horaires: [
    '\uD83D\uDD50 Lundi-Vendredi (8h-17h)',
    '\uD83D\uDD50 Lundi-Samedi (8h-18h)',
    '\uD83D\uDD50 7j/7 (8h-20h)',
    '\uD83C\uDF19 Service de nuit disponible',
    '\uD83D\uDEA8 Urgences 24h/24',
    '\uD83D\uDCDE Sur rendez-vous uniquement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Zones d'intervention (vétérinaires mobiles)
  zones_intervention: genererZonesIntervention('CM'),

  // ✅ Villes (priorité Cameroun)
  villes: genererToutesLesVilles('CM'),

  // ✅ Quartiers
  quartiers: genererQuartiersPays('CM')
};

// ⚠️ OBSOLÈTE : Cette constante a été remplacée par NETTOYAGE_MODALITIES (ligne 13016)
// Conservée temporairement pour compatibilité ascendante
// ✅ VERSION COMPLÈTE : NETTOYAGE_MODALITIES avec 16+ champs enrichis (typeServiceNettoyage, frequenceService, modaliteEmploi, etc.)
export const NETTOYAGE_ENTRETIEN_MODALITIES: ModalityCategory = {
  // ⚠️ ANCIENNE VERSION - Utiliser NETTOYAGE_MODALITIES à la place
  // Types de nettoyage (legacy)
  types: [
    'Nettoyage de maison', 'Nettoyage de bureau', 'Nettoyage après chantier',
    'Nettoyage de vitres', 'Nettoyage de tapis', 'Nettoyage de voiture',
    'Jardinage', 'Piscine', 'Pressing', 'Repassage', 'Désinfection', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Fréquences (legacy)
  frequencies: [
    'Ponctuel', 'Hebdomadaire', 'Bihebdomadaire', 'Mensuel', 'Trimestriel',
    'Semestriel', 'Annuel', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements (legacy)
  equipements: [
    'Aspirateur', 'Nettoyeur vapeur', 'Karcher', 'Balai', 'Serpillière',
    'Produits de nettoyage inclus', 'Matériel professionnel', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Surfaces (legacy)
  surfaces: [
    'Studio (< 30m²)', 'Petit appartement (30-50m²)', 'Moyen appartement (50-80m²)',
    'Grand appartement (80-120m²)', 'Maison (> 120m²)', 'Bureau', 'Local commercial',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ════════════════════════════════════════════════════════════
// \uD83C\uDF33 JARDINAGE & PAYSAGISME - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
// ════════════════════════════════════════════════════════════
// Services: Élagage palmiers, arbres fruitiers, potagers africains,
// espaces verts tropicaux, irrigation saison sèche
// ════════════════════════════════════════════════════════════
export const JARDINAGE_PAYSAGISME_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE SERVICES (40+ options) - Classés par popularité Afrique
  typeService: [
    // \uD83D\uDD25 SERVICES POPULAIRES (50% des demandes)
    '\uD83C\uDF34 Élagage palmiers (royal, cocotier, dattier)',
    '\uD83E\uDD6D Entretien arbres fruitiers (manguier, avocatier, papayer)',
    '\uD83C\uDFE1 Tonte pelouse/gazon (résidentiel)',
    '✂️ Taille de haies et arbustes',
    '\uD83C\uDF3E Désherbage manuel et chimique',
    '\uD83D\uDCA7 Installation système arrosage automatique',
    '\uD83C\uDFE2 Entretien espaces verts (entreprise/hôtel)',
    '\uD83C\uDF31 Création et entretien potager',

    // \uD83C\uDFA8 AMÉNAGEMENT & CRÉATION (30%)
    '\uD83C\uDFD7️ Aménagement paysager complet',
    '\uD83C\uDF3F Création jardin tropical',
    '\uD83C\uDF38 Plantation massifs floraux',
    '\uD83C\uDF33 Plantation d\'arbres et arbustes',
    '\uD83C\uDF34 Plantation de palmiers décoratifs',
    '\uD83E\uDEB4 Plantation haies végétales',
    '\uD83C\uDFDE️ Création allées et bordures',
    '\uD83E\uDEA8 Dallage et pavage jardin',
    '\uD83C\uDFD7️ Construction terrasse en bois',
    '⛲ Installation fontaine/bassin',
    '\uD83C\uDF3F Création jardin zen/japonais',

    // \uD83D\uDD27 ENTRETIEN RÉGULIER (20%)
    '\uD83D\uDCC5 Contrat entretien mensuel',
    '\uD83D\uDCC5 Contrat entretien trimestriel',
    '\uD83C\uDF3E Tonte gazon + ramassage',
    '\uD83D\uDCA7 Arrosage régulier (saison sèche)',
    '\uD83C\uDF42 Ramassage feuilles mortes',
    '✂️ Taille saisonnière arbustes',
    '\uD83C\uDF31 Traitement phytosanitaire (anti-insectes)',
    '\uD83C\uDF3F Fertilisation/engrais naturel',

    // \uD83D\uDE9C GROS TRAVAUX (10%)
    '\uD83E\uDE93 Abattage d\'arbres',
    '\uD83C\uDF33 Dessouchage',
    '\uD83D\uDE9C Défrichage terrain',
    '\uD83C\uDF3E Débroussaillage grande surface',
    '⛏️ Terrassement et nivellement',
    '\uD83C\uDFD7️ Évacuation déchets verts',

    // \uD83C\uDF8B SPÉCIALITÉS AFRICAINES (10%)
    '\uD83C\uDF34 Taille palmiers royaux en hauteur',
    '\uD83E\uDD6D Récolte fruits arbres fruitiers',
    '\uD83C\uDF31 Potager bio maraîcher africain',
    '\uD83C\uDF3A Jardin de plantes médicinales',
    '\uD83C\uDF3E Culture de gazon tropical résistant',
    '\uD83C\uDF3F Jardinage permaculture',

    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ PLANTES TROPICALES AFRICAINES (60+ options)
  plantesAfricaines: [
    // \uD83C\uDF34 PALMIERS (très populaire)
    '\uD83C\uDF34 Palmier royal',
    '\uD83E\uDD65 Cocotier',
    '\uD83C\uDF34 Palmier dattier',
    '\uD83C\uDF34 Palmier raphia',
    '\uD83C\uDF34 Palmier à huile',
    '\uD83C\uDF34 Palmier areca',
    '\uD83C\uDF34 Palmier nain',

    // \uD83E\uDD6D ARBRES FRUITIERS (essentiel)
    '\uD83E\uDD6D Manguier',
    '\uD83E\uDD51 Avocatier',
    '\uD83C\uDF48 Papayer',
    '\uD83C\uDF4A Oranger',
    '\uD83C\uDF4B Citronnier',
    '\uD83E\uDD6D Goyavier',
    '\uD83C\uDF4C Bananier',
    '\uD83C\uDF4D Ananas (culture)',
    '\uD83C\uDF30 Safoutier',
    '\uD83C\uDF30 Corossolier',
    '\uD83E\uDED0 Bissap (fleur d\'hibiscus)',
    '\uD83C\uDF30 Néré (soumbala)',

    // \uD83C\uDF3A FLEURS TROPICALES
    '\uD83C\uDF3A Hibiscus (rose de Chine)',
    '\uD83C\uDF38 Bougainvilliers',
    '\uD83C\uDF38 Ixora (flamme des bois)',
    '\uD83C\uDF3C Alamanda',
    '\uD83C\uDF3A Frangipanier',
    '\uD83C\uDF37 Rose du désert (Adenium)',
    '\uD83C\uDF38 Laurier rose',
    '\uD83C\uDF3A Canna (balisier)',

    // \uD83C\uDF3F PLANTES ORNEMENTALES
    '\uD83C\uDF3F Croton (codiaeum)',
    '\uD83C\uDF3F Dracaena (dragonnier)',
    '\uD83C\uDF3F Cordyline',
    '\uD83C\uDF3F Asparagus',
    '\uD83C\uDF3F Fougère tropicale',
    '\uD83C\uDF35 Euphorbe cactus',
    '\uD83C\uDF3F Sansevière (langue de belle-mère)',
    '\uD83E\uDEB4 Philodendron',
    '\uD83E\uDEB4 Monstera',

    // \uD83C\uDF31 POTAGER AFRICAIN
    '\uD83C\uDF36️ Piment',
    '\uD83C\uDF45 Tomate',
    '\uD83E\uDED1 Poivron',
    '\uD83E\uDD52 Concombre',
    '\uD83E\uDEDB Gombo (okra)',
    '\uD83E\uDD55 Carotte',
    '\uD83E\uDDC5 Oignon',
    '\uD83E\uDD6C Feuilles de manioc',
    '\uD83E\uDD6C Feuilles d\'amarante (folong)',
    '\uD83E\uDD6C Épinards africains (ndolé)',
    '\uD83C\uDF3D Maïs',
    '\uD83C\uDF46 Aubergine africaine',

    // \uD83C\uDF3E GAZON & HAIES
    '\uD83C\uDF3E Gazon tropical résistant',
    '\uD83C\uDF3E Gazon kikuyu',
    '\uD83C\uDF3E Gazon bahia',
    '\uD83C\uDF3F Haie de lauriers',
    '\uD83C\uDF3F Haie de thuyas',
    '\uD83C\uDF3F Haie de bambous',

    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ MATÉRIEL & ÉQUIPEMENT (25+ options)
  materielJardinage: [
    // Motorisé
    '\uD83D\uDE9C Tondeuse à essence',
    '\uD83D\uDE9C Tondeuse électrique',
    '\uD83D\uDE9C Tondeuse autoportée',
    '✂️ Taille-haie motorisé',
    '\uD83C\uDF3E Débroussailleuse thermique',
    '\uD83E\uDE93 Tronçonneuse',
    '\uD83D\uDCA8 Souffleur de feuilles',
    '♻️ Broyeur de végétaux',

    // Manuel
    '\uD83E\uDE93 Coupe-coupe (machette africaine)',
    '⚒️ Houe (daba)',
    '\uD83D\uDD28 Pioche',
    '⛏️ Bêche',
    '\uD83E\uDE9D Râteau',
    '\uD83E\uDE9D Fourche à bêcher',
    '✂️ Sécateur manuel',
    '✂️ Cisaille à haies',

    // Arrosage
    '\uD83D\uDCA7 Système arrosage automatique',
    '\uD83D\uDCA7 Tuyau d\'arrosage',
    '\uD83E\uDEA3 Arrosoir manuel',
    '\uD83D\uDCA6 Pulvérisateur (traitement)',
    '\uD83D\uDCA7 Pompe à eau',

    // Autre
    '\uD83E\uDDE4 Équipement protection (gants, bottes)',
    '\uD83E\uDEA3 Brouette',
    '\uD83E\uDE9C Échelle télescopique',
    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ FRÉQUENCE D'ENTRETIEN (adaptée au climat africain)
  frequenceEntretien: [
    '\uD83D\uDCC5 Hebdomadaire (toutes les semaines)',
    '\uD83D\uDCC5 Bi-hebdomadaire (2 fois/semaine)',
    '\uD83D\uDCC5 Mensuel (1 fois/mois)',
    '\uD83D\uDCC5 Bi-mensuel (2 fois/mois)',
    '\uD83D\uDCC5 Trimestriel (tous les 3 mois)',
    '\uD83C\uDF27️ Début saison des pluies (mars-avril)',
    '☀️ Milieu saison sèche (décembre-janvier)',
    '\uD83C\uDF3F Intervention ponctuelle unique',
    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ TYPE DE TERRAIN (important pour devis)
  typeTerrain: [
    '\uD83C\uDFE1 Jardin résidentiel (villa)',
    '\uD83C\uDFD8️ Cour maison (petit jardin)',
    '\uD83C\uDFE2 Espace vert entreprise/bureau',
    '\uD83C\uDFE8 Jardin hôtel/résidence',
    '\uD83C\uDFEB Espace vert école/université',
    '\uD83C\uDFE5 Jardin clinique/hôpital',
    '⛪ Jardin église/mosquée',
    '\uD83C\uDFDF️ Stade/terrain de sport',
    '\uD83C\uDFDE️ Parc public',
    '\uD83C\uDFD7️ Chantier/terrain vague',
    '\uD83C\uDF34 Plantation (grande surface)',
    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ SURFACE (en m²) - Grille adaptée aux réalités africaines
  surfaceTerrain: [
    '\uD83D\uDCCF Moins de 50 m² (petite cour)',
    '\uD83D\uDCCF 50 à 100 m² (jardin moyen)',
    '\uD83D\uDCCF 100 à 200 m² (grand jardin)',
    '\uD83D\uDCCF 200 à 500 m² (très grand jardin)',
    '\uD83D\uDCCF 500 à 1000 m² (petit espace vert)',
    '\uD83D\uDCCF 1000 à 3000 m² (grand espace vert)',
    '\uD83D\uDCCF 3000 à 5000 m² (parc)',
    '\uD83D\uDCCF Plus de 5000 m² (grande plantation)',
    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ TARIFICATION (mode de facturation)
  modeTarification: [
    '\uD83D\uDCB0 Forfait intervention unique',
    '\uD83D\uDCB0 Tarif horaire (par heure)',
    '\uD83D\uDCB0 Forfait mensuel (abonnement)',
    '\uD83D\uDCB0 Forfait trimestriel',
    '\uD83D\uDCB0 Forfait annuel',
    '\uD83D\uDCB0 Prix au m² (grande surface)',
    '\uD83D\uDCB0 Devis sur mesure',
    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ NIVEAU D'EXPÉRIENCE
  niveauExperience: [
    '\uD83D\uDC68‍\uD83C\uDF3E Jardinier professionnel (5+ ans)',
    '\uD83C\uDF93 Paysagiste diplômé',
    '\uD83C\uDFE2 Entreprise de paysagisme',
    '\uD83C\uDF31 Jardinier indépendant',
    '\uD83D\uDC68‍\uD83C\uDF3E Aide-jardinier',
    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ PRESTATIONS INCLUSES
  prestationsIncluses: [
    '✅ Matériel fourni',
    '✅ Produits (engrais, phyto) fournis',
    '✅ Évacuation déchets verts incluse',
    '✅ Arrosage inclus',
    '✅ Conseil personnalisé',
    '✅ Garantie reprise plantes',
    '❌ Matériel client uniquement',
    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // \uD83D\uDCCD ZONES D'INTERVENTION (système intelligent - s'adapte au pays de l'utilisateur)
  zones_intervention: genererZonesIntervention('CM') // Par défaut Cameroun, s'adapte via useUserCountry
};

// ════════════════════════════════════════════════════════════
// ✅ MODALITÉS SÉCURITÉ & SURVEILLANCE - ULTRA-ENRICHI AFRIQUE
// ════════════════════════════════════════════════════════════
export const SECURITE_SURVEILLANCE_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE SERVICES (30+) - Gardiennage, Caméras, Alarmes, Contrôle accès
  typeServiceSecurite: [
    // Services humains (très demandés)
    'Gardiennage résidentiel (villa, maison)',
    'Gardiennage commercial (boutique, magasin)',
    'Gardiennage industriel (usine, entrepôt)',
    'Agent de sécurité qualifié',
    'Vigile armé',
    'Vigile non armé',
    'Maître-chien (avec chien dressé)',
    'Sécurité événementielle (mariage, concert)',
    'Garde du corps / Protection rapprochée',
    'Convoyage de fonds',
    'Ronde de surveillance',
    'Patrouille mobile',
    // Vidéosurveillance
    'Installation caméras surveillance',
    'Maintenance système vidéosurveillance',
    'Centrale de télésurveillance 24h/24',
    'Location caméras surveillance',
    'Vente équipements caméras',
    // Alarmes & Contrôle d\'accès
    'Installation système alarme',
    'Alarme anti-intrusion',
    'Alarme incendie',
    'Contrôle d\'accès (badge, biométrie)',
    'Barrière automatique / Portail sécurisé',
    'Interphone vidéo / Visiophone',
    // Consulting & Formation
    'Audit de sécurité',
    'Consulting sécurité',
    'Formation agents de sécurité',
    'Analyse des risques',
    'Plan de sécurité sur mesure',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPE DE CLIENT (8 options)
  typeClientSecurite: [
    'Particuliers (maisons, villas)',
    'Commerces (boutiques, magasins)',
    'Entreprises (bureaux, sièges)',
    'Industries (usines, entrepôts)',
    'Hôtels & Résidences',
    'Événements (mariages, concerts)',
    'Administrations publiques',
    'Banques & Institutions financières',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DISPONIBILITÉ (10 options)
  disponibiliteSecurite: [
    'Service 24h/24 - 7j/7',
    'Journée uniquement (6h-18h)',
    'Nuit uniquement (18h-6h)',
    'Ronde périodique (2-4 passages/jour)',
    'Week-end uniquement',
    'Intervention sur appel',
    'Événements ponctuels',
    'Horaires flexibles (à définir)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES DE CAMÉRAS (15+) - Enrichi Afrique
  typeCameraSecurite: [
    'Caméra dôme intérieur',
    'Caméra bullet extérieur',
    'Caméra PTZ motorisée (360°)',
    'Caméra vision nocturne infrarouge',
    'Caméra IP (réseau Ethernet/WiFi)',
    'Caméra analogique HD (AHD/TVI/CVI)',
    'Caméra 4K ultra haute résolution',
    'Caméra avec détection de mouvement',
    'Caméra avec audio bidirectionnel',
    'Caméra sans fil (batterie/solaire)',
    'Caméra thermique',
    'Sonnette vidéo intelligente',
    'Caméra miniature discrète',
    'Caméra espion camouflée',
    'Caméra de comptage personnes',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ RÉSOLUTION CAMÉRA (10 options)
  resolutionCamera: [
    '720p (1MP) - Basique',
    '1080p (2MP) - Full HD ⭐',
    '3MP - Super HD',
    '4MP - 2K',
    '5MP - 2.5K',
    '6MP',
    '8MP (4K) - Ultra HD \uD83D\uDD25',
    '12MP',
    '16MP+',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ STOCKAGE VIDÉO (12 options)
  stockageVideo: [
    'DVR (enregistreur analogique)',
    'NVR (enregistreur IP)',
    'Cloud sécurisé (stockage en ligne)',
    'Carte SD locale',
    'Disque dur 500GB',
    'Disque dur 1TB',
    'Disque dur 2TB',
    'Disque dur 4TB',
    'Disque dur 6TB+',
    'Rétention 7 jours',
    'Rétention 30 jours',
    'Rétention 60+ jours',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES D'ALARMES (15+)
  typeAlarme: [
    'Alarme anti-intrusion filaire',
    'Alarme anti-intrusion sans fil',
    'Alarme GSM (alerte SMS)',
    'Alarme connectée (app smartphone)',
    'Alarme IP (Internet)',
    'Détecteur de mouvement infrarouge',
    'Détecteur d\'ouverture (porte/fenêtre)',
    'Détecteur de choc/vibration',
    'Détecteur de bris de vitre',
    'Sirène extérieure puissante (120dB)',
    'Sirène intérieure',
    'Flash lumineux',
    'Télécommande/Badge d\'activation',
    'Alarme incendie/fumée',
    'Alarme inondation',
    'Alarme gaz/monoxyde de carbone',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CONTRÔLE D'ACCÈS (12+ options)
  controleAcces: [
    'Badge RFID',
    'Lecteur biométrique empreintes digitales',
    'Reconnaissance faciale',
    'Code PIN / Clavier numérique',
    'Carte magnétique',
    'QR Code / NFC',
    'Barrière automatique véhicules',
    'Portillon piéton automatique',
    'Interphone vidéo',
    'Visiophone',
    'Gestion visiteurs',
    'Tourniquets',
    'Sas de sécurité',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOMBRE D'AGENTS (8 options)
  nombreAgents: [
    '1 agent',
    '2 agents',
    '3-5 agents',
    '6-10 agents',
    '11-20 agents',
    '20+ agents',
    'Équipe roulante (relais)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ARMEMENT AGENTS (6 options)
  armementAgents: [
    'Agents non armés',
    'Agents armés (arme de poing)',
    'Agents avec matraque/bâton',
    'Agents avec chiens dressés',
    'Équipement protection (gilet pare-balles)',
    'Équipement complet (arme + protection)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CERTIFICATIONS (15+) - Adapté contexte africain
  certificationsSecurite: [
    'Agrément Ministère Sécurité (DGSN)',
    'Licence professionnelle sécurité privée',
    'ISO 9001 (Qualité)',
    'ISO 27001 (Sécurité information)',
    'Formation pompiers/incendie',
    'Formation premiers secours',
    'Assurance responsabilité civile',
    'Assurance responsabilité professionnelle',
    'Membres association sécurité nationale',
    'Certification APSAD (Alarmes)',
    'Certification NF & A2P (France)',
    'Expérience 5+ ans',
    'Expérience 10+ ans',
    'Anciens militaires/policiers',
    'Agents formés et diplômés',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ DURÉE CONTRAT (12 options)
  dureeContratSecurite: [
    'Intervention ponctuelle (1 jour)',
    'Week-end (2-3 jours)',
    '1 semaine',
    '2 semaines',
    '1 mois',
    '3 mois',
    '6 mois',
    '1 an',
    '2 ans',
    '3 ans',
    'Longue durée (3+ ans)',
    'Contrat flexible (renouvelable)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES ÉQUIPEMENTS (25+) - Marques présentes en Afrique
  marquesEquipements: [
    // Caméras (leaders en Afrique)
    'Hikvision \uD83D\uDD25',
    'Dahua ⭐',
    'Uniview',
    'Axis Communications',
    'Samsung',
    'Bosch',
    'Honeywell',
    'Sony',
    'Panasonic',
    'Hanwha Techwin',
    'Provision-ISR',
    'Ezviz',
    'TP-Link',
    // Alarmes
    'Paradox',
    'DSC (Digital Security Controls)',
    'Ajax Systems',
    'Somfy',
    'Risco',
    'Visonic',
    'Texecom',
    // Contrôle d\'accès
    'ZKTeco',
    'HID Global',
    'CAME',
    'BFT',
    'Nice',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GARANTIE ÉQUIPEMENTS (8 options)
  garantieEquipement: [
    '6 mois',
    '1 an ⭐',
    '2 ans',
    '3 ans',
    '5 ans',
    '10 ans',
    'Garantie à vie (pièces)',
    'Pas de garantie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ALIMENTATION ÉLECTRIQUE (10 options)
  alimentationElectrique: [
    'Secteur 220V',
    'Batterie de secours (UPS)',
    'Panneaux solaires',
    'Autonomie 12h',
    'Autonomie 24h',
    'Autonomie 48h',
    'Autonomie 72h+',
    'Générateur de secours',
    'PoE (Power over Ethernet)',
    'Batterie lithium rechargeable',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ FONCTIONNALITÉS CAMÉRAS (20+)
  fonctionnalitesCamera: [
    'Vision nocturne infrarouge',
    'Vision nocturne couleur',
    'Détection de mouvement',
    'Détection humaine (IA)',
    'Reconnaissance faciale',
    'Lecture plaque d\'immatriculation',
    'Audio bidirectionnel',
    'Audio unidirectionnel',
    'Zoom optique',
    'Zoom numérique',
    'PTZ motorisé (panoramique-inclinaison-zoom)',
    'Tracking automatique (suivi)',
    'Alerte push smartphone',
    'Alerte email',
    'Alerte SMS',
    'Enregistrement sur événement',
    'Enregistrement continu 24h/24',
    'Accès distant (app mobile)',
    'Vision 360° panoramique',
    'Double objectif',
    'Anti-vandalisme (IK10)',
    'Étanchéité IP66/IP67',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ SERVICES INCLUS (15+)
  servicesInclus: [
    'Installation complète',
    'Configuration système',
    'Formation utilisateur',
    'Maintenance préventive',
    'Maintenance corrective',
    'Support technique 24h/24',
    'Intervention rapide (sous 2h)',
    'Garantie pièces et main-d\'œuvre',
    'Mise à jour logiciel gratuite',
    'Extension garantie',
    'Télésurveillance',
    'Levée de doute vidéo',
    'Appel forces de l\'ordre',
    'Devis et audit gratuits',
    'Test système gratuit',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPE DE SITE À SÉCURISER (20+)
  typeSiteSecuriser: [
    'Villa / Maison individuelle',
    'Appartement / Résidence',
    'Immeuble de rapport',
    'Boutique / Magasin',
    'Supermarché',
    'Station-service',
    'Pharmacie',
    'Bureau / Entreprise',
    'Entrepôt',
    'Usine',
    'Hôtel',
    'Restaurant',
    'École / Université',
    'Hôpital / Clinique',
    'Banque',
    'Parking',
    'Chantier de construction',
    'Site industriel',
    'Ferme / Exploitation agricole',
    'Entrepôt frigorifique',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDCCD ZONES D'INTERVENTION (système intelligent)
  zones_intervention: genererZonesIntervention('CM') // Adapté au pays de l'utilisateur
};

// ✅ MODALITÉS PLOMBIER (SERVICE) - ENRICHI ET OPTIMISÉ
export const PLOMBERIE_MODALITIES: ModalityCategory = {
  // Types de prestations
  types: [
    'Installation', 'Réparation', 'Entretien', 'Dépannage', 'Débouchage',
    'Raccordement', 'Remplacement', 'Diagnostic', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de services/Spécialités
  services: [
    'Installation sanitaire', 'Réparation fuite', 'Débouchage canalisations', 'Installation chaudière',
    'Installation chauffe-eau', 'Raccordement eau', 'Entretien annuel', 'Dépannage d\'urgence',
    'Détection de fuite', 'Rénovation salle de bain', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements
  equipements: [
    'Robinetterie', 'Lavabo', 'WC', 'Douche', 'Baignoire', 'Évier', 'Chauffe-eau',
    'Chaudière', 'Tuyauterie', 'Siphon', 'Mitigeur', 'Fosse septique', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ AMÉLIORÉ: Disponibilité avec granularité fine
  disponibilites: [
    'Intervention express (1h)', 'Intervention rapide (2h)', 'Intervention sous 3h',
    'Intervention sous 6h', 'Intervention sous 12h', 'Intervention sous 24h',
    'Urgence 24h/24', 'Rendez-vous planifié', 'Week-end disponible', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Garanties
  garanties: [
    '1 mois', '3 mois', '6 mois', '1 an', '2 ans', 'Garantie décennale',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Certifications professionnelles
  certifications: [
    'Certifié QualiPlomberie', 'Certification CAP Plomberie', 'Habilitation professionnelle',
    'Agrément assurance décennale', 'Certification sanitaire', 'Label qualité',
    'Prestataire certifié', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NOUVEAU: Ancienneté / Expérience
  experiencePlombier: [
    'Débutant (0-2 ans)', 'Confirmé (3-5 ans)', 'Expérimenté (6-10 ans)',
    'Expert (11-20 ans)', 'Maître-artisan (20+ ans)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDCCD Zones d'intervention (système intelligent - s'adapte au pays de l'utilisateur)
  zones_intervention: genererZonesIntervention('CM') // Par défaut Cameroun, s'adapte via useUserCountry
};

// ✅ MODALITÉS ÉLECTRICIEN (SERVICE) - ENRICHI
export const ELECTRICIEN_MODALITIES: ModalityCategory = {
  // Types de prestations
  types: [
    'Installation', 'Réparation', 'Dépannage', 'Mise aux normes', 'Diagnostic',
    'Raccordement', 'Rénovation', 'Maintenance', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de services/Spécialités
  services: [
    'Installation tableau électrique', 'Dépannage panne électrique', 'Mise aux normes électriques',
    'Installation éclairage', 'Installation prises et interrupteurs', 'Câblage maison',
    'Installation domotique', 'Installation climatisation', 'Installation chauffage électrique',
    'Détection panne', 'Réparation court-circuit', 'Installation parafoudre',
    'Raccordement compteur', 'Rénovation installation électrique', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements
  equipements: [
    'Tableau électrique', 'Prises électriques', 'Interrupteurs', 'Disjoncteurs',
    'Éclairage', 'Luminaires', 'Câblage', 'Parafoudre', 'Différentiel',
    'Domotique', 'Climatisation', 'Chauffage électrique', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Disponibilité
  disponibilites: [
    'Urgence 24h/24', 'Intervention rapide (2h)', 'Rendez-vous sous 24h',
    'Rendez-vous planifié', 'Week-end', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Garanties
  garanties: [
    '3 mois', '6 mois', '1 an', '2 ans', '5 ans', 'Garantie décennale',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Certifications
  certifications: [
    'Électricien qualifié', 'Habilitation électrique', 'Certification Consuel',
    'Qualification RGE', 'Agrément assurance', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDCCD Zones d'intervention (système intelligent - s'adapte au pays de l'utilisateur)
  zones_intervention: genererZonesIntervention('CM') // Par défaut Cameroun, s'adapte via useUserCountry
};

// ✅ MODALITÉS FORGERON / FERRONNERIE D'ART - \uD83C\uDF0D AFRIQUE FRANCOPHONE
// Métier artisanal très important : sécurité (anti-vol, grilles) + décoration
export const FORGERON_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE RÉALISATIONS (50+) - Classés par popularité Afrique
  typesRealisations: [
    // \uD83D\uDD25 SÉCURITÉ (80% des demandes - PRIORITÉ #1 en Afrique)
    '\uD83D\uDD12 Grilles de fenêtre anti-vol',
    '\uD83D\uDD12 Grilles de porte anti-vol',
    '\uD83D\uDD12 Barreaux de sécurité fixes',
    '\uD83D\uDD12 Barreaux de sécurité amovibles',
    '\uD83D\uDD12 Grilles de protection balcon',
    '\uD83D\uDD12 Grilles de protection terrasse',
    '\uD83D\uDD12 Protection fenêtre en fer forgé',
    '\uD83D\uDD12 Rideau métallique (boutique/magasin)',
    '\uD83D\uDD12 Rideau métallique (garage)',
    '\uD83D\uDD12 Volet roulant métallique',
    '\uD83D\uDD12 Grille extensible (accordéon)',
    '\uD83D\uDD12 Porte blindée métallique',
    '\uD83D\uDD12 Renfort de porte existante',
    '\uD83D\uDD12 Cadenas de sécurité renforcé',

    // \uD83D\uDEAA PORTAILS & ENTRÉES (très demandé)
    '\uD83D\uDEAA Portail coulissant motorisé',
    '\uD83D\uDEAA Portail coulissant manuel',
    '\uD83D\uDEAA Portail battant 2 vantaux',
    '\uD83D\uDEAA Portail battant 1 vantail',
    '\uD83D\uDEAA Portail piéton',
    '\uD83D\uDEAA Portillon de jardin',
    '\uD83D\uDEAA Porte de garage métallique',
    '\uD83D\uDEAA Porte d\'entrée en fer forgé',
    '\uD83D\uDEAA Porte de service',
    '\uD83D\uDEAA Portail de villa (haut standing)',

    // \uD83C\uDFD7️ CLÔTURES & MURS (résidentiel + commercial)
    '\uD83C\uDFD7️ Clôture en fer forgé',
    '\uD83C\uDFD7️ Grillage rigide (panneau)',
    '\uD83C\uDFD7️ Grillage souple avec poteaux',
    '\uD83C\uDFD7️ Clôture à barreaudage',
    '\uD83C\uDFD7️ Garde-corps / Main courante',
    '\uD83C\uDFD7️ Brise-vue métallique',
    '\uD83C\uDFD7️ Muret surmonté de grilles',

    // \uD83C\uDFE0 BALCONS & TERRASSES (décoration + sécurité)
    '\uD83C\uDFE0 Garde-corps de balcon fer forgé',
    '\uD83C\uDFE0 Garde-corps de terrasse',
    '\uD83C\uDFE0 Rambarde d\'escalier extérieur',
    '\uD83C\uDFE0 Rambarde d\'escalier intérieur',
    '\uD83C\uDFE0 Main courante escalier',
    '\uD83C\uDFE0 Balustrade décorative',

    // \uD83C\uDFA8 DÉCORATION & ESTHÉTIQUE (montée en gamme)
    '\uD83C\uDFA8 Pergola métallique',
    '\uD83C\uDFA8 Tonnelle en fer forgé',
    '\uD83C\uDFA8 Marquise de porte',
    '\uD83C\uDFA8 Auvent métallique',
    '\uD83C\uDFA8 Brise-soleil métallique',
    '\uD83C\uDFA8 Cache-climatiseur décoratif',
    '\uD83C\uDFA8 Claustra métallique',
    '\uD83C\uDFA8 Paravent en fer forgé',
    '\uD83C\uDFA8 Élément décoratif mural',

    // \uD83C\uDFE2 PROFESSIONNEL & COMMERCIAL
    '\uD83C\uDFE2 Devanture de magasin',
    '\uD83C\uDFE2 Vitrine de boutique',
    '\uD83C\uDFE2 Porte de hangar',
    '\uD83C\uDFE2 Structure métallique (charpente)',
    '\uD83C\uDFE2 Passerelle métallique',
    '\uD83C\uDFE2 Escalier métallique industriel',

    // \uD83E\uDE91 MOBILIER MÉTALLIQUE (sur mesure)
    '\uD83E\uDE91 Table en fer forgé',
    '\uD83E\uDE91 Chaise en fer forgé',
    '\uD83E\uDE91 Banc de jardin',
    '\uD83E\uDE91 Salon de jardin métallique',
    '\uD83E\uDE91 Étagère métallique',

    '\uD83C\uDD95 Autre réalisation (ajouter)'
  ],

  // ✅ TYPES DE PRESTATIONS (10+)
  typesPrestation: [
    'Fabrication sur mesure',
    'Installation complète',
    'Réparation / Soudure',
    'Rénovation (peinture, traitement)',
    'Motorisation portail existant',
    'Renforcement sécurité',
    'Conseil et devis',
    'Prise de mesures à domicile',
    'Maintenance et entretien',
    'Dépannage urgence',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MATÉRIAUX UTILISÉS (15+) - Adapté disponibilité Afrique
  materiaux: [
    // Fer & Acier (les plus courants)
    'Fer forgé',
    'Fer plein (barre ronde)',
    'Fer carré',
    'Fer plat',
    'Tube acier carré',
    'Tube acier rond',
    'Cornière acier',
    'Profilé acier (IPN, UPN)',
    'Tôle acier',
    'Acier galvanisé',

    // Aluminium (montée en gamme)
    'Aluminium anodisé',
    'Aluminium thermolaqué',

    // Inox (haut de gamme)
    'Inox 304',
    'Inox 316 (marine)',

    // Mixte
    'Fer + Bois',
    'Fer + Verre',

    '\uD83C\uDD95 Autre matériau (ajouter)'
  ],

  // ✅ STYLES & DESIGNS (20+) - Goûts locaux + moderne
  styles: [
    // Moderne (tendance actuelle)
    '\uD83C\uDFA8 Moderne épuré',
    '\uD83C\uDFA8 Minimaliste contemporain',
    '\uD83C\uDFA8 Design géométrique',
    '\uD83C\uDFA8 Lignes droites épurées',

    // Classique & Traditionnel
    '\uD83C\uDFA8 Classique élégant',
    '\uD83C\uDFA8 Traditionnel africain',
    '\uD83C\uDFA8 Style colonial',
    '\uD83C\uDFA8 Baroque orné',

    // Artistique & Décoratif
    '\uD83C\uDFA8 Fer forgé artistique',
    '\uD83C\uDFA8 Motifs floraux',
    '\uD83C\uDFA8 Motifs géométriques',
    '\uD83C\uDFA8 Arabesques',
    '\uD83C\uDFA8 Volutes et spirales',

    // Fonctionnel
    '\uD83C\uDFA8 Simple et fonctionnel',
    '\uD83C\uDFA8 Industriel brut',
    '\uD83C\uDFA8 Sobre et discret',

    // Sur mesure
    '\uD83C\uDFA8 Personnalisé (nom, logo, initiales)',
    '\uD83C\uDFA8 Création unique sur-mesure',

    '\uD83C\uDD95 Autre style (ajouter)'
  ],

  // ✅ FINITIONS (12+) - Durabilité importante (climat tropical)
  finitions: [
    // Protection contre rouille (ESSENTIEL en Afrique)
    'Peinture antirouille',
    'Galvanisé à chaud (anti-rouille)',
    'Thermolaquage (très résistant)',
    'Peinture époxy',
    'Peinture glycéro',

    // Couleurs populaires
    'Noir mat',
    'Noir brillant',
    'Blanc',
    'Gris anthracite',
    'Couleur RAL au choix',
    'Fer brut (sans peinture)',
    'Aspect rouillé artistique',

    '\uD83C\uDD95 Autre finition (ajouter)'
  ],

  // ✅ DIMENSIONS STANDARD (format africain)
  dimensions: [
    // Portails (largeur x hauteur)
    '3m x 2m (portail standard)',
    '4m x 2m (portail large)',
    '5m x 2m (portail villa)',
    '3m x 1.80m',
    '3.50m x 2m',

    // Grilles fenêtre
    '1m x 1m (fenêtre standard)',
    '1.20m x 1m',
    '1.50m x 1.20m',
    '2m x 1.50m (grande fenêtre)',

    // Balcons
    '3m linéaires (garde-corps)',
    '5m linéaires',
    '10m linéaires',

    'Sur mesure (prise de mesure)',
    '\uD83C\uDD95 Autre dimension (ajouter)'
  ],

  // ✅ DÉLAIS DE RÉALISATION (réaliste Afrique)
  delaisRealisation: [
    '⏰ 3-5 jours (pièce simple)',
    '⏰ 1 semaine (grille/balcon standard)',
    '⏰ 10-15 jours (portail simple)',
    '⏰ 2-3 semaines (portail motorisé)',
    '⏰ 3-4 semaines (travaux complexes)',
    '⏰ 1-2 mois (grosse commande)',
    '⏰ Selon disponibilité matériaux',
    '\uD83C\uDD95 Autre délai (ajouter)'
  ],

  // ✅ GARANTIES (important pour confiance)
  garanties: [
    '✅ Garantie 5 ans (structure)',
    '✅ Garantie 2 ans (structure + peinture)',
    '✅ Garantie 1 an (structure + peinture)',
    '✅ Garantie 6 mois',
    '✅ Garantie contre rouille (2 ans)',
    '✅ Garantie motorisation (1 an)',
    '❌ Aucune garantie',
    '\uD83C\uDD95 Autre garantie (ajouter)'
  ],

  // ✅ SERVICES INCLUS (très important)
  servicesInclus: [
    '\uD83D\uDCD0 Prise de mesures gratuite',
    '\uD83D\uDCB0 Devis détaillé gratuit',
    '\uD83C\uDFA8 Conception/Design inclus',
    '\uD83D\uDCCB Plans et dessins techniques',
    '\uD83D\uDE9A Livraison incluse',
    '\uD83D\uDD27 Installation complète incluse',
    '\uD83D\uDD27 Pose et fixation incluse',
    '\uD83C\uDFA8 Peinture antirouille incluse',
    '\uD83D\uDD29 Visserie et fixations incluses',
    '\uD83E\uDDF9 Nettoyage chantier inclus',
    '\uD83D\uDCDE SAV et assistance inclus',
    '\uD83D\uDD04 Ajustements après pose',
    '\uD83C\uDD95 Autre service (ajouter)'
  ],

  // ✅ OPTIONS & MOTORISATION (montée en gamme)
  options: [
    // Motorisation (portails)
    '⚡ Motorisation portail battant',
    '⚡ Motorisation portail coulissant',
    '⚡ Télécommande (1-2 unités)',
    '⚡ Télécommande (3-5 unités)',
    '⚡ Digicode',
    '⚡ Visiophone',
    '⚡ Interphone',
    '⚡ Automatisme solaire',
    '⚡ Batterie de secours',

    // Sécurité
    '\uD83D\uDD10 Serrure multipoints',
    '\uD83D\uDD10 Serrure électrique',
    '\uD83D\uDD10 Verrou de sécurité',
    '\uD83D\uDD10 Cadenas haute sécurité',
    '\uD83D\uDD10 Gâche électrique',

    // Accessoires
    '\uD83D\uDD14 Sonnette',
    '\uD83D\uDD14 Carillon',
    '\uD83D\uDCA1 Éclairage LED intégré',
    '\uD83C\uDFA8 Plaque de nom personnalisée',

    '\uD83C\uDD95 Autre option (ajouter)'
  ],

  // ✅ TYPES DE FIXATION (important pour solidité)
  typesFixation: [
    'Scellement chimique (ultra-solide)',
    'Scellement béton',
    'Chevilles mécaniques',
    'Platine à souder',
    'Fixation murale renforcée',
    'Fixation au sol (poteau)',
    'Ancrage profond (30-50cm)',
    '\uD83C\uDD95 Autre fixation (ajouter)'
  ],

  // ✅ PRIX ESTIMATIFS FCFA (fourchettes réalistes Cameroun, CI, Sénégal...)
  prixEstimatifs: [
    // SÉCURITÉ (les plus demandés)
    '\uD83D\uDD12 Grille fenêtre simple (1m x 1m): 25.000-50.000 FCFA',
    '\uD83D\uDD12 Grille fenêtre renforcée (1m x 1m): 40.000-70.000 FCFA',
    '\uD83D\uDD12 Barreaux porte: 35.000-80.000 FCFA',
    '\uD83D\uDD12 Rideau métallique boutique: 150.000-400.000 FCFA',
    '\uD83D\uDD12 Porte blindée: 200.000-800.000 FCFA',

    // PORTAILS
    '\uD83D\uDEAA Portail simple (3m): 150.000-300.000 FCFA',
    '\uD83D\uDEAA Portail fer forgé décoratif (3m): 250.000-500.000 FCFA',
    '\uD83D\uDEAA Portail coulissant (4m): 300.000-600.000 FCFA',
    '\uD83D\uDEAA Portail motorisé (4m): 500.000-1.200.000 FCFA',
    '\uD83D\uDEAA Portail haut standing (5m): 800.000-2.000.000 FCFA',

    // BALCONS & GARDE-CORPS
    '\uD83C\uDFE0 Garde-corps balcon (mètre linéaire): 20.000-50.000 FCFA/m',
    '\uD83C\uDFE0 Garde-corps terrasse (5m): 100.000-250.000 FCFA',
    '\uD83C\uDFE0 Rampe escalier (mètre linéaire): 25.000-60.000 FCFA/m',

    // CLÔTURES
    '\uD83C\uDFD7️ Clôture simple (mètre linéaire): 15.000-35.000 FCFA/m',
    '\uD83C\uDFD7️ Clôture fer forgé (mètre linéaire): 25.000-60.000 FCFA/m',

    // DIVERS
    '\uD83C\uDFA8 Marquise de porte: 50.000-150.000 FCFA',
    '\uD83C\uDFA8 Pergola métallique (3m x 3m): 200.000-500.000 FCFA',
    '\uD83E\uDE91 Mobilier jardin (table + 4 chaises): 150.000-400.000 FCFA',

    '\uD83C\uDD95 Autre tarif (ajouter)'
  ],

  // ✅ ÉPAISSEUR / RÉSISTANCE (sécurité importante)
  epaisseurMateriau: [
    'Fer Ø 8mm (léger, décoratif)',
    'Fer Ø 10mm (standard résidentiel)',
    'Fer Ø 12mm (renforcé)',
    'Fer Ø 14mm (haute sécurité)',
    'Fer Ø 16mm (très haute sécurité)',
    'Tube 20x20mm',
    'Tube 25x25mm',
    'Tube 30x30mm (portails)',
    'Tube 40x40mm (portails lourds)',
    'Tube 50x50mm (portails industriels)',
    '\uD83C\uDD95 Autre épaisseur (ajouter)'
  ],

  // ✅ CERTIFICATIONS & COMPÉTENCES
  certifications: [
    '\uD83C\uDF93 Artisan professionnel agréé',
    '\uD83C\uDF93 Formation soudure certifiée',
    '\uD83C\uDFC6 +5 ans d\'expérience',
    '\uD83C\uDFC6 +10 ans d\'expérience',
    '\uD83C\uDFC6 +15 ans d\'expérience',
    '\uD83C\uDFC6 +20 ans d\'expérience (maître artisan)',
    '\uD83D\uDEE0️ Spécialiste portails motorisés',
    '\uD83D\uDEE0️ Spécialiste fer forgé artistique',
    '\uD83D\uDEE0️ Spécialiste sécurité (anti-vol)',
    '\uD83D\uDEE0️ Soudure TIG (inox, aluminium)',
    '\uD83D\uDEE0️ Soudure MIG/MAG (acier)',
    '\uD83D\uDEE0️ Soudure à l\'arc',
    '\uD83D\uDCF1 Atelier équipé moderne',
    '\uD83D\uDE97 Atelier mobile (déplacements)',
    '\uD83C\uDD95 Autre certification (ajouter)'
  ],

  // ✅ ZONES D'INTERVENTION (utilise le système intelligent)
  zones_intervention: genererZonesIntervention('CM'),

  // ✅ VILLES (système contextualisé)
  villes: genererToutesLesVilles('CM'),

  // ✅ QUARTIERS (système contextualisé)
  quartiers: genererQuartiersPays('CM'),

  // ✅ MODES DE PAIEMENT (contexte Afrique)
  modesPaiement: [
    '\uD83D\uDCB5 Espèces',
    '\uD83D\uDCF1 Mobile Money (Orange Money)',
    '\uD83D\uDCF1 Mobile Money (MTN Mobile Money)',
    '\uD83D\uDCF1 Mobile Money (Moov Money)',
    '\uD83D\uDCB3 Virement bancaire',
    '\uD83D\uDCB3 Carte bancaire',
    '\uD83D\uDCC5 Paiement échelonné (30% avance)',
    '\uD83D\uDCC5 Paiement en 2 fois (50% avance)',
    '\uD83D\uDCC5 Paiement en 3 fois (40% avance)',
    '\uD83D\uDCB0 Acompte + solde à la livraison',
    '\uD83C\uDD95 Autre mode (ajouter)'
  ],

  // ✅ SERVICES ADDITIONNELS
  servicesAdditionnels: [
    '\uD83D\uDCD0 Étude et conception gratuite',
    '\uD83D\uDCB0 Devis détaillé et chiffré gratuit',
    '\uD83D\uDCF8 Photos de réalisations antérieures',
    '\uD83C\uDFA8 Modèles de catalogue disponibles',
    '\uD83D\uDE9A Transport et livraison inclus',
    '\uD83D\uDD27 Installation et pose incluse',
    '\uD83C\uDFA8 Traitement antirouille inclus',
    '\uD83D\uDD04 Retouches gratuites (1 mois)',
    '\uD83D\uDCDE SAV et maintenance',
    '\uD83D\uDEE1️ Garantie décennale disponible',
    '⚡ Intervention urgence 24h',
    '\uD83D\uDCF1 Support WhatsApp',
    '\uD83C\uDD95 Autre service (ajouter)'
  ],

  // ✅ TYPES DE CLIENTS (adapté contexte)
  typesClients: [
    '\uD83C\uDFE0 Particuliers (résidentiel)',
    '\uD83C\uDFE2 Entreprises et commerces',
    '\uD83C\uDFD7️ Promoteurs immobiliers',
    '\uD83C\uDFDB️ Administrations publiques',
    '\uD83C\uDFE8 Hôtels et résidences',
    '\uD83C\uDFEA Boutiques et magasins',
    '\uD83C\uDFED Industries et usines',
    '⛪ Établissements religieux',
    '\uD83C\uDFEB Écoles et universités',
    '\uD83C\uDD95 Autre type (ajouter)'
  ],

  // ✅ NORMES & STANDARDS (sécurité)
  normes: [
    '✅ Conforme normes de sécurité',
    '✅ Résistance effraction certifiée',
    '✅ Certification anti-corrosion',
    '✅ Norme NF (France)',
    '✅ Test de charge validé',
    '✅ Garantie solidité 10 ans',
    '\uD83C\uDD95 Autre norme (ajouter)'
  ],

  // ✅ ÉQUIPEMENTS ATELIER (crédibilité)
  equipementsAtelier: [
    '\uD83D\uDD27 Poste à souder professionnel',
    '\uD83D\uDD27 Soudure TIG (aluminium/inox)',
    '\uD83D\uDD27 Soudure MIG/MAG (acier)',
    '\uD83D\uDD27 Plieuse métallique',
    '\uD83D\uDD27 Cisaille',
    '\uD83D\uDD27 Meuleuse d\'angle',
    '\uD83D\uDD27 Perceuse à colonne',
    '\uD83D\uDD27 Tour à métaux',
    '\uD83D\uDD27 Fraiseuse',
    '\uD83D\uDD27 Forge traditionnelle',
    '\uD83D\uDD27 Cabine de peinture',
    '\uD83D\uDD27 Compresseur air',
    '\uD83C\uDD95 Autre équipement (ajouter)'
  ],

  // ✅ RÉALISATIONS SPÉCIALES (portfolio)
  realisationsSpeciales: [
    '\uD83C\uDFC6 Villas haut standing',
    '\uD83C\uDFC6 Résidences de prestige',
    '\uD83C\uDFC6 Ambassades et consulats',
    '\uD83C\uDFC6 Hôtels 4-5 étoiles',
    '\uD83C\uDFC6 Banques et institutions',
    '\uD83C\uDFC6 Centres commerciaux',
    '\uD83C\uDFC6 Mosquées et églises',
    '\uD83C\uDFC6 Projets gouvernementaux',
    '\uD83C\uDFC6 Œuvres d\'art monumentales',
    '\uD83C\uDD95 Autre réalisation (ajouter)'
  ],

  // ✅ LANGUES PARLÉES (service client)
  languesParlees: [
    '\uD83C\uDDEB\uD83C\uDDF7 Français',
    '\uD83D\uDDE3️ Anglais',
    '\uD83D\uDDE3️ Douala (Cameroun)',
    '\uD83D\uDDE3️ Bamiléké (Cameroun)',
    '\uD83D\uDDE3️ Ewondo (Cameroun)',
    '\uD83D\uDDE3️ Fulfuldé (Cameroun)',
    '\uD83D\uDDE3️ Dioula (CI, Mali, Burkina)',
    '\uD83D\uDDE3️ Baoulé (Côte d\'Ivoire)',
    '\uD83D\uDDE3️ Wolof (Sénégal)',
    '\uD83D\uDDE3️ Lingala (RDC, Congo)',
    '\uD83D\uDDE3️ Swahili (RDC)',
    '\uD83C\uDD95 Autre langue (ajouter)'
  ],

  // ✅ DISPONIBILITÉ & HORAIRES
  disponibilites: [
    '\uD83D\uDD50 Lun-Ven: 7h-18h, Sam: 8h-17h',
    '\uD83D\uDD50 Lun-Sam: 7h-19h',
    '\uD83D\uDD50 Lun-Dim: 8h-18h',
    '\uD83D\uDD50 Tous les jours: 7h-20h',
    '⏰ Déplacements 7j/7',
    '\uD83D\uDCDE Sur rendez-vous',
    '⚡ Urgence 24h/24 (dépannage)',
    '\uD83C\uDD95 Autres horaires (ajouter)'
  ]
};

// ✅ MODALITÉS ÉLECTRICIEN AUTOMOBILE (SERVICE) - SPÉCIALISÉ
export const ELECTRICIEN_AUTO_MODALITIES: ModalityCategory = {
  // Types de prestations
  types: [
    'Diagnostic électronique', 'Réparation système électrique', 'Installation équipement',
    'Dépannage panne électrique', 'Remplacement composant', 'Maintenance préventive',
    'Mise à jour calculateur', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de services/Spécialités
  services: [
    'Diagnostic OBD', 'Réparation alternateur', 'Remplacement batterie', 'Réparation démarreur',
    'Réparation faisceau électrique', 'Installation autoradio', 'Installation alarme',
    'Installation caméra de recul', 'Installation GPS', 'Installation capteurs parking',
    'Réparation phares', 'Réparation feux', 'Réparation lève-vitre', 'Réparation centralisation',
    'Programmation clé électronique', 'Réparation climatisation auto', 'Diagnostic voyant moteur',
    'Réparation calculateur', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements concernés
  equipements: [
    'Batterie', 'Alternateur', 'Démarreur', 'Faisceau électrique', 'Calculateur moteur',
    'Phares', 'Feux arrière', 'Clignotants', 'Autoradio', 'Alarme', 'Caméra de recul',
    'GPS', 'Capteurs parking', 'Lève-vitre', 'Centralisation', 'Climatisation',
    'Essuie-glace', 'Klaxon', 'Allume-cigare', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Véhicules pris en charge
  vehicules: [
    'Voitures légères', 'Motos', 'Scooters', '4x4 / SUV', 'Camionnettes',
    'Poids lourds', 'Véhicules utilitaires', 'Camping-cars', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques spécialisées
  marques_specialisees: [
    'Toyota', 'Honda', 'Mercedes', 'BMW', 'Audi', 'Volkswagen', 'Peugeot', 'Renault',
    'Nissan', 'Hyundai', 'Kia', 'Ford', 'Chevrolet', 'Mazda', 'Suzuki',
    'Toutes marques', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Disponibilité
  disponibilites: [
    'Urgence 24h/24', 'Intervention rapide (2h)', 'Rendez-vous sous 24h',
    'Rendez-vous planifié', 'Week-end', 'Déplacement à domicile', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Garanties
  garanties: [
    '1 mois', '3 mois', '6 mois', '1 an', '2 ans', 'Garantie pièces et main d\'œuvre',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements de diagnostic
  equipements_diagnostic: [
    'Valise diagnostic OBD', 'Multimètre', 'Oscilloscope', 'Testeur de batterie',
    'Testeur alternateur', 'Scanner électronique', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDCCD Zones d'intervention (système intelligent - s'adapte au pays de l'utilisateur)
  zones_intervention: genererZonesIntervention('CM') // Par défaut Cameroun, s'adapte via useUserCountry
};

// ✅ MODALITÉS MAÇON (SERVICE) - ENRICHI
export const MACON_MODALITIES: ModalityCategory = {
  // Types de prestations
  types: [
    'Construction neuve', 'Rénovation', 'Extension', 'Réparation', 'Surélévation',
    'Aménagement', 'Démolition', 'Reprise sous-œuvre', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de travaux/Spécialités
  services: [
    'Fondations', 'Dalle béton', 'Mur porteur', 'Mur de clôture', 'Chape',
    'Coulage béton', 'Coffrage', 'Ferraillage', 'Enduit façade', 'Crépi',
    'Jointoiement', 'Réparation fissures', 'Extension maison', 'Garage',
    'Terrasse béton', 'Escalier béton', 'Piscine béton', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Matériaux utilisés
  materiaux: [
    'Béton armé', 'Parpaing', 'Brique', 'Pierre naturelle', 'Agglo',
    'Béton cellulaire', 'Mortier', 'Ciment', 'Chaux', 'Enduit', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de bâtiments
  types_batiment: [
    'Maison individuelle', 'Immeuble', 'Villa', 'Commercial', 'Industriel',
    'Rénovation ancien', 'Construction neuve', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements
  equipements: [
    'Bétonnière', 'Échafaudage', 'Niveau laser', 'Machines à projeter',
    'Toupie béton', 'Outils professionnels', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Disponibilité
  disponibilites: [
    'Intervention rapide', 'Rendez-vous sous 48h', 'Rendez-vous planifié',
    'Week-end', 'Chantiers longs', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Garanties
  garanties: [
    '6 mois', '1 an', '2 ans', 'Garantie décennale', 'Assurance décennale',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Certifications
  certifications: [
    'Maçon qualifié', 'Certification RGE', 'Assurance décennale', 'Qualibat',
    'Entreprise agréée', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDCCD Zones d'intervention (système intelligent - s'adapte au pays de l'utilisateur)
  zones_intervention: genererZonesIntervention('CM') // Par défaut Cameroun, s'adapte via useUserCountry
};

// ✅ MODALITÉS CARRELEUR (SERVICE) - ENRICHI
export const CARRELEUR_MODALITIES: ModalityCategory = {
  // Types de prestations
  types: [
    'Pose de carrelage', 'Pose de faïence', 'Pose de mosaïque', 'Rénovation carrelage',
    'Remplacement carrelage', 'Réparation joints', 'Ragréage sol', 'Étanchéité',
    'Pose terrasse extérieure', 'Pose carrelage piscine', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de services/Spécialités
  services: [
    'Carrelage sol intérieur', 'Carrelage mural salle de bain', 'Faïence cuisine',
    'Carrelage terrasse', 'Carrelage balcon', 'Carrelage piscine', 'Mosaïque décorative',
    'Ragréage et préparation sol', 'Étanchéité salle de bain', 'Joints et finitions',
    'Réparation carrelage cassé', 'Rénovation ancienne faïence', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Surfaces d'application
  surfaces: [
    'Sol intérieur', 'Sol extérieur', 'Mur salle de bain', 'Mur cuisine',
    'Terrasse', 'Balcon', 'Escalier', 'Piscine', 'Garage',
    'Commerce/Boutique', 'Bureau', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de carrelage posés
  types_carrelage: [
    'Carrelage céramique', 'Grès cérame', 'Porcelaine', 'Faïence',
    'Mosaïque', 'Marbre', 'Granit', 'Pierre naturelle', 'Terre cuite',
    'Tomette', 'Carrelage antidérapant', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Formats/Dimensions
  formats: [
    'Petit format (< 20x20cm)', 'Standard (20x20 à 40x40cm)',
    'Grand format (60x60cm et +)', 'Très grand format (120x60cm)',
    'Mosaïque (petits carreaux)', 'Sur mesure', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Techniques de pose
  techniques: [
    'Pose droite classique', 'Pose en diagonale', 'Pose en chevron',
    'Pose en damier', 'Pose à joints décalés', 'Pose sans joint (rectifié)',
    'Double encollage (grands formats)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Finitions
  finitions: [
    'Joint blanc', 'Joint gris', 'Joint noir', 'Joint coloré',
    'Joint époxy (étanche)', 'Joint fin (1-2mm)', 'Joint large (5-10mm)',
    'Plinthe carrelage', 'Baguette d\'angle', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements et outils
  equipements: [
    'Carrelette manuelle', 'Carrelette électrique', 'Coupe-carrelage',
    'Niveau laser', 'Malaxeur', 'Croisillons et cales', 'Raclette à joint',
    'Équipement professionnel complet', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Expérience
  experience: [
    'Moins de 2 ans', '2-5 ans d\'expérience', '5-10 ans d\'expérience',
    '10-15 ans d\'expérience', '15-20 ans d\'expérience',
    'Plus de 20 ans (maître carreleur)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Disponibilité
  disponibilites: [
    'Disponible immédiatement', 'Intervention sous 48h', 'Rendez-vous sous 1 semaine',
    'Rendez-vous planifié', 'Week-end possible', 'Grands chantiers uniquement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Garanties
  garanties: [
    '6 mois', '1 an', '2 ans', 'Garantie décennale',
    'Assurance responsabilité civile', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Certifications
  certifications: [
    'Carreleur qualifié', 'CAP Carreleur-mosaïste', 'Formation professionnelle',
    'Artisan agréé', 'Assurance décennale', 'RGE (Reconnu Garant Environnement)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Services additionnels
  services_additionnels: [
    'Devis gratuit et détaillé', 'Conseil choix matériaux', 'Fourniture carrelage',
    'Démolition ancien carrelage', 'Évacuation gravats', 'Ragréage inclus',
    'Nettoyage fin de chantier', 'Garantie anti-fissure', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Modes de tarification
  tarification: [
    'Au m² (fourniture non incluse)', 'Au m² (fourniture incluse)', 'Forfait global',
    'Devis personnalisé', 'Tarif horaire', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDCCD Zones d'intervention (système intelligent - s'adapte au pays de l'utilisateur)
  zones_intervention: genererZonesIntervention('CM') // Par défaut Cameroun, s'adapte via useUserCountry
};

// ✅ MODALITÉS INGÉNIEUR / ARCHITECTE (SERVICE) - ENRICHI
export const INGENIEUR_ARCHI_MODALITIES: ModalityCategory = {
  // Types de prestations
  types: [
    'Étude architecturale', 'Étude technique', 'Maîtrise d\'œuvre', 'Suivi de chantier',
    'Permis de construire', 'Conception 3D', 'Expertise technique', 'Audit',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de services/Spécialités
  services: [
    'Plans architecturaux', 'Avant-projet (APS/APD)', 'Plans d\'exécution', 'Permis de construire',
    'Déclaration préalable', 'Étude de sol / Géotechnique', 'Calcul de structure', 'Note de calcul',
    'Dimensionnement béton', 'Étude thermique / RT2012', 'Audit énergétique', 'Maîtrise d\'œuvre complète',
    'Suivi de chantier', 'Coordination travaux', 'Réception travaux', 'Métrés / Quantitatifs',
    'Levé topographique', 'Bornage terrain', 'Implantation bâtiment', 'Étude urbanisme / PLU',
    'Conception 3D / Modélisation', 'Maquette 3D', 'Architecture d\'intérieur', 'Aménagement intérieur',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de projets
  types_projet: [
    'Maison individuelle', 'Immeuble résidentiel', 'Villa', 'Bâtiment commercial',
    'Bâtiment industriel', 'Extension / Surélévation', 'Rénovation / Réhabilitation',
    'Aménagement intérieur', 'Piscine', 'Ouvrage d\'art', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Domaines de compétence
  domaines: [
    'Génie civil', 'Architecture', 'Géotechnique', 'Structure béton',
    'Structure métallique', 'Bois / Charpente', 'Thermique / Énergétique',
    'Urbanisme', 'Topographie', 'VRD (Voiries Réseaux Divers)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Logiciels utilisés
  logiciels: [
    'AutoCAD', 'Revit', 'ArchiCAD', 'SketchUp', 'Rhino', '3ds Max',
    'Lumion', 'Robot Structural', 'SAP2000', 'ETABS', 'Pleiades', 'Climawin',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Certifications
  certifications: [
    'Ordre des architectes', 'Ingénieur diplômé', 'Certification RGE',
    'Assurance RC Pro', 'Assurance décennale', 'Qualibat', 'OPQIBI',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Livrables
  livrables: [
    'Plans 2D', 'Plans 3D', 'Maquette numérique', 'Notice descriptive',
    'Dossier permis de construire', 'Note de calcul', 'Métrés détaillés',
    'Cahier des charges', 'Planning travaux', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Tarification
  tarification: [
    'Au forfait', 'Au m²', 'Pourcentage du coût travaux', 'Tarif horaire',
    'Mission complète', 'Mission partielle', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDCCD Zones d'intervention (système intelligent - s'adapte au pays de l'utilisateur)
  zones_intervention: genererZonesIntervention('CM') // Par défaut Cameroun, s'adapte via useUserCountry
};

// ✅ MODALITÉS PLOMBERIE & SANITAIRE (PRODUITS - VENTE MATÉRIEL)
export const PLOMBERIE_SANITAIRE_MODALITIES: ModalityCategory = {
  // Catégories de produits
  categories: [
    '\uD83D\uDEB0 Robinetterie', '\uD83D\uDEB0 Lavabo & Évier', '\uD83D\uDEB0 WC & Toilettes', '\uD83D\uDEB0 Douche & Baignoire',
    '\uD83D\uDEB0 Chauffe-eau', '\uD83D\uDEB0 Tuyauterie', '\uD83D\uDEB0 Accessoires', '\uD83D\uDEB0 Outils plomberie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Grohe', 'Geberit', 'Roca', 'Hansgrohe', 'Duravit', 'Ideal Standard',
    'Jacob Delafon', 'Villeroy & Boch', 'Kohler', 'American Standard',
    '\uD83C\uDD95 Autre marque'
  ],

  // Matériaux
  materiaux: [
    'Céramique', 'Porcelaine', 'Inox', 'Chrome', 'Laiton', 'PVC',
    'Cuivre', 'Acier', 'Composite', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Finitions
  finitions: [
    'Chromé', 'Blanc', 'Noir mat', 'Doré', 'Brossé', 'Satiné',
    'Mat', 'Brillant', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // États
  etats: [
    'Neuf', 'Très bon état', 'Bon état', 'État correct', 'À rénover',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Garanties
  garanties: [
    'Garantie constructeur', '1 an', '2 ans', '5 ans', 'Garantie limitée',
    'Sans garantie', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Livraison
  livraisons: [
    'Livraison gratuite', 'Livraison payante', 'Retrait magasin',
    'Livraison express', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Installation
  installations: [
    'Installation incluse', 'Installation payante', 'Installation par tiers',
    'Auto-installation', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDF0D Villes (système intelligent - s'adapte au pays de l'utilisateur)
  villes: genererToutesLesVilles('CM'), // Par défaut Cameroun, s'adapte via useUserCountry

  // \uD83C\uDFD8️ Quartiers (système intelligent - s'adapte au pays de l'utilisateur)
  quartiers: genererQuartiersPays('CM'), // Par défaut Cameroun, s'adapte via useUserCountry

  // \uD83D\uDCCD Zones d'intervention (pour services de livraison éventuels)
  zones_intervention: genererZonesIntervention('CM') // Par défaut Cameroun
};

// ════════════════════════════════════════════════════════════
// \uD83E\uDDF9 MODALITÉS NETTOYAGE & ENTRETIEN - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
// ════════════════════════════════════════════════════════════
// Synchronisé avec categoryConfig.ts (16 filtres complets)
// Femme de ménage, Nounou, Blanchisseur, Pressing, Gardien, Jardinier, etc.
// ════════════════════════════════════════════════════════════
export const NETTOYAGE_MODALITIES: ModalityCategory = {
  // ✅ Type de service (40+ options - Contexte Afrique)
  typeServiceNettoyage: [
    // Ménage & Nettoyage domestique
    'Femme de ménage (aide ménagère)', 'Bonne à demeure (logée/nourrie)', 'House girl (anglophone)',
    'Boy domestique (homme de ménage)', 'Aide ménagère à temps partiel', 'Aide ménagère à temps plein',
    'Technicienne de surface',

    // Garde d'enfants & Nounou
    'Nounou à domicile (nanny)', 'Baby-sitter (bébé sitter)', 'Gardienne d\'enfants certifiée',
    'Nounou de nuit (garde nocturne)', 'Nounou bilingue (français-anglais)', 'Assistante maternelle agréée',
    'Nanny (anglophone)',

    // Blanchisseur & Pressing
    'Blanchisseur/Blanchisseuse (lavage vêtements)', 'Service de pressing (nettoyage à sec)',
    'Repassage professionnel', 'Lavage + Repassage vêtements', 'Blanchisserie industrielle',

    // Sécurité & Gardiennage
    'Gardien de maison (watchman)', 'Vigile/Agent de sécurité', 'Gardien de nuit (night watchman)',
    'Gardien de jour', 'Gardien 24h/24', 'Agent de sécurité armé',

    // Jardinage & Espaces verts
    'Jardinier (entretien jardin)', 'Jardinier-paysagiste', 'Entretien espaces verts',
    'Élagage arbres & taille haies', 'Arrosage & entretien pelouse',

    // Cuisine à domicile
    'Cuisinière/Cuisinier à domicile', 'Chef cuisinier personnel (cook)', 'Cuisinière logée/nourrie',
    'Aide-cuisinière',

    // Chauffeur
    'Chauffeur personnel', 'Chauffeur famille (tous trajets)', 'Chauffeur-livreur',

    // Nettoyage professionnel
    'Nettoyage bureaux/commerces', 'Nettoyage immeuble/copropriété', 'Nettoyage après chantier',
    'Nettoyage industriel', 'Nettoyage vitres & façades', 'Nettoyage moquettes & tapis',
    'Désinfection & désinsectisation',

    // Entretien spécifique
    'Entretien piscine', 'Entretien climatisation', 'Lavage voiture à domicile',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Fréquence de service (13+ options)
  frequenceService: [
    'Ponctuel (une fois)', 'Quotidien (tous les jours)', 'Du lundi au vendredi (5j/7)',
    'Du lundi au samedi (6j/7)', '2 fois par semaine', '3 fois par semaine',
    'Hebdomadaire (1 fois/semaine)', 'Bi-hebdomadaire (tous les 15 jours)', 'Mensuel (1 fois/mois)',
    'Week-end uniquement', 'Soir uniquement (après 18h)', 'Nuit uniquement (garde de nuit)',
    'Horaires flexibles (à définir)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Modalité d'emploi (Live-in / Live-out)
  modaliteEmploi: [
    'Live-out (rentre chez elle le soir)', 'Live-in (logée sur place)',
    'Logée + nourrie (à demeure)', 'Demi-pension (déjeuner fourni)',
    'Nourrie uniquement (pas logée)', 'Autonome (non logée, non nourrie)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Horaires de travail (10+ options)
  horairesService: [
    'Temps plein (8h-17h)', 'Temps plein (7h-16h)', 'Temps partiel (4 heures/jour)',
    'Temps partiel (2-3 heures/jour)', 'Matin uniquement (6h-12h)', 'Après-midi uniquement (12h-18h)',
    'Soirée (18h-22h)', 'Nuit (22h-6h)', '24h/24 (garde permanente)',
    'Horaires à définir (flexible)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Nombre d'enfants (pour nounou/baby-sitter)
  nombreEnfants: [
    '1 enfant', '2 enfants', '3 enfants', '4 enfants ou plus',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Âge des enfants (pour nounou)
  ageEnfants: [
    'Nouveau-né (0-6 mois)', 'Bébé (6 mois - 2 ans)', 'Tout-petit (2-4 ans)',
    'Enfant (4-8 ans)', 'Pré-ado (8-12 ans)', 'Adolescent (12+ ans)', 'Tous âges',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Tâches spécifiques (Multi-sélection - 35+ options)
  tachesSpecifiques: [
    // Ménage
    'Nettoyage sols (balayage, lavage)', 'Dépoussiérage meubles', 'Nettoyage cuisine',
    'Nettoyage salles de bain/WC', 'Nettoyage vitres', 'Rangement intérieur',
    'Lessivage murs & plafonds',

    // Linge
    'Lavage linge à la main', 'Lavage linge en machine', 'Repassage vêtements',
    'Pliage & rangement linge', 'Nettoyage à sec (pressing)',

    // Cuisine
    'Préparation repas (cuisine)', 'Cuisine locale africaine', 'Vaisselle & rangement cuisine',
    'Courses au marché',

    // Garde d'enfants
    'Garde d\'enfants', 'Préparation biberons/repas bébé', 'Change couches & toilette bébé',
    'Accompagnement école/activités', 'Aide aux devoirs', 'Activités ludiques/éducatives',
    'Surveillance bain/douche',

    // Extérieur & Jardin
    'Nettoyage cour/terrasse', 'Arrosage plantes/jardin', 'Tonte pelouse',
    'Taille haies & arbustes', 'Entretien piscine',

    // Autres
    'Lavage voiture', 'Surveillance maison', 'Réception visiteurs/colis',
    'Soins animaux domestiques',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Expérience professionnelle (8 niveaux)
  experienceNettoyage: [
    'Débutant(e) (< 6 mois)', '6 mois - 1 an', '1-2 ans', '2-3 ans',
    '3-5 ans', '5-10 ans', '10-15 ans', '15+ ans (très expérimenté)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Langues parlées (12+ langues africaines)
  languesParlees: [
    'Français (courant)', 'Anglais (fluent)', 'Bilingue (français-anglais)',
    'Bamiléké', 'Ewondo', 'Douala', 'Fulfuldé (Peul)', 'Bassa', 'Pidgin English',
    'Lingala', 'Wolof', 'Dioula',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Certifications & Références (8+ options)
  certificationNettoyage: [
    'Références vérifiées', 'Attestation formation ménagère', 'Certificat premiers secours',
    'Certificat garde d\'enfants', 'Diplôme cuisinière/cuisinier', 'Certificat sécurité/gardiennage',
    'Casier judiciaire vierge', 'Recommandations familles précédentes',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Équipements fournis par le prestataire
  equipementsFournis: [
    'Produits d\'entretien', 'Aspirateur', 'Serpillière & balai', 'Matériel professionnel',
    'Nettoyeur vapeur', 'Équipement de sécurité', 'Outils de jardinage',
    'Aucun (client fournit)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Surface à entretenir (pour ménage/bureaux)
  surfaceEntretien: [
    'Petit logement (< 50m²)', 'Logement moyen (50-100m²)', 'Grand logement (100-200m²)',
    'Très grand logement (200-300m²)', 'Villa/Maison (300-500m²)', 'Grande propriété (500m²+)',
    'Bureau petit (< 100m²)', 'Bureau moyen (100-300m²)', 'Bureau grand (300m²+)',
    'Immeuble/Copropriété',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Zone d'intervention (100+ quartiers Afrique) - Système intelligent
  zoneInterventionNettoyage: genererZonesIntervention('CM'), // S'adapte au pays de l'utilisateur

  // ✅ Disponibilité immédiate
  disponibiliteImmediateNettoyage: [
    'Disponible immédiatement', 'Disponible cette semaine', 'Disponible dans 2 semaines',
    'Disponible dans 1 mois', 'Période de préavis (employeur actuel)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Salaire mensuel souhaité (FCFA) - Options prédéfinies
  salaireSouhaite: [
    '30 000 - 50 000 FCFA', '50 000 - 75 000 FCFA', '75 000 - 100 000 FCFA',
    '100 000 - 150 000 FCFA', '150 000 - 200 000 FCFA', '200 000 - 300 000 FCFA',
    '300 000 - 400 000 FCFA', '400 000 - 500 000 FCFA', '500 000+ FCFA',
    'À négocier',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Type de contrat
  typeContratNettoyage: [
    'CDI (Contrat à durée indéterminée)', 'CDD (Contrat à durée déterminée)',
    'Contrat temporaire (< 3 mois)', 'Remplacement (congé/maladie)',
    'Freelance/Indépendant', 'Essai professionnel (1 mois)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Champs legacy (compatibilité ancienne version)
  types: [
    'Nettoyage résidentiel', 'Nettoyage bureaux', 'Nettoyage après travaux',
    'Nettoyage vitres', 'Nettoyage façades', 'Nettoyage moquettes/tapis',
    'Nettoyage climatisation', 'Désinfection', '\uD83C\uDD95 Autre (ajouter)'
  ],
  frequences: [
    'Ponctuel', 'Hebdomadaire', 'Bi-mensuel', 'Mensuel',
    'Trimestriel', 'Annuel', '\uD83C\uDD95 Autre (ajouter)'
  ],
  services: [
    'Dépoussiérage', 'Aspiration', 'Lavage sols', 'Nettoyage sanitaires',
    'Nettoyage cuisine', 'Repassage', 'Vitrerie', 'Désinfection',
    'Détachage', 'Cirage', '\uD83C\uDD95 Autre (ajouter)'
  ],
  surfaces: [
    'Moins de 50m²', '50-100m²', '100-200m²', '200-500m²',
    'Plus de 500m²', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Nouveaux champs version refonte 2025
  mode_tarification: [
    'À l\'heure', 'Au forfait', 'Au m²', 'À la journée',
    'À la semaine', 'Au mois', 'À négocier',
    '\uD83C\uDD95 Autre (ajouter)'
  ],
  type_clientele: [
    'Particuliers', 'Entreprises', 'Collectivités', 'Commerces',
    'Bureaux', 'Copropriétés', 'Hôtels/Restaurants',
    '\uD83C\uDD95 Autre (ajouter)'
  ],
  quartiers: [
    'Akwa', 'Bonanjo', 'Bonapriso', 'Bali', 'Bonabéri', 'Deido', 'Kotto',
    'Makepe', 'New Bell', 'Ndogpassi', 'Bépanda', 'Logbaba', 'PK8', 'PK10',
    'Bastos', 'Mvan', 'Essos', 'Ngousso', 'Emana', 'Ekounou', 'Tsinga',
    'Odza', 'Kondengui', 'Nkol-Eton', 'Nlongkak', 'Elig-Essono',
    'Cocody', 'Plateau', 'Marcory', 'Adjamé', 'Yopougon', 'Abobo',
    'Almadies', 'Plateau', 'Mermoz', 'Sacré-Coeur', 'Ouakam',
    '\uD83C\uDD95 Autre (ajouter)'
  ],
  disponibilite: [
    '7j/7', 'En semaine (Lun-Ven)', 'Week-end uniquement',
    'Sur rendez-vous', 'Urgences acceptées', 'Du lundi au samedi',
    'Horaires flexibles',
    '\uD83C\uDD95 Autre (ajouter)'
  ],
  equipements: [
    'Produits écologiques', 'Matériel professionnel', 'Aspirateur',
    'Nettoyeur vapeur', 'Balai', 'Serpillière', 'Produits désinfectants',
    'Outils jardinage', 'Aucun équipement (client fournit)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],
  produits: [
    'Produits bio/écologiques', 'Produits professionnels', 'Produits standards',
    'Vapeur/Sans chimique', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS RÉPARATION - NOUVEAU
export const REPARATION_MODALITIES: ModalityCategory = {
  // Types de réparation
  types: [
    'Réparation électronique', 'Réparation électroménager', 'Réparation téléphone',
    'Réparation ordinateur', 'Réparation automobile', 'Réparation moto',
    'Réparation vélo', 'Réparation montre', 'Réparation bijoux',
    'Réparation chaussures', 'Réparation vêtements', 'Réparation meubles',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Spécialités
  specialites: [
    'Écran cassé', 'Batterie', 'Carte mère', 'Connectique', 'Logiciel',
    'Moteur', 'Freins', 'Embrayage', 'Suspension', 'Plomberie', 'Électricité',
    'Menuiserie', 'Tapisserie', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Délais d'intervention
  delais: [
    'Express (même jour)', '24-48h', '2-5 jours', '1-2 semaines',
    'Sur devis', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Garanties
  garanties: [
    '1 mois', '3 mois', '6 mois', '1 an', '2 ans',
    'Garantie pièces', 'Garantie main d\'œuvre', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de marques
  marques: [
    'Toutes marques', 'Samsung', 'Apple', 'LG', 'Sony', 'HP', 'Dell',
    'Lenovo', 'Asus', 'Huawei', 'Xiaomi', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ÉLECTRICITÉ
export const ELECTRICITE_MODALITIES: ModalityCategory = {
  // ✅ NOMS DE PRODUITS (60+)
  noms_produits: [
    // Câblage
    'Câble électrique 1.5mm²', 'Câble électrique 2.5mm²', 'Câble électrique 4mm²', 'Câble électrique 6mm²',
    'Fil électrique souple', 'Gaine électrique', 'Goulotte', 'Câble RJ45', 'Câble coaxial',
    // Interrupteurs & Prises
    'Interrupteur simple', 'Interrupteur double', 'Interrupteur va-et-vient', 'Variateur de lumière',
    'Prise simple', 'Prise double', 'Prise avec terre', 'Prise USB', 'Multiprise',
    // Protection
    'Disjoncteur 10A', 'Disjoncteur 16A', 'Disjoncteur 20A', 'Disjoncteur 32A',
    'Tableau électrique', 'Coffret électrique', 'Parafoudre', 'Différentiel 30mA',
    // Éclairage - Ampoules
    'Ampoule LED E27', 'Ampoule LED E14', 'Ampoule LED GU10', 'Ampoule halogène',
    'Tube néon LED', 'Ampoule filament', 'Ampoule connectée', 'Ampoule couleur RGB',
    // Éclairage - Luminaires
    'Lustre', 'Plafonnier', 'Applique murale', 'Spot encastrable', 'Spot sur rail',
    'Lampe de chevet', 'Lampadaire', 'Lampe de bureau', 'Réglette LED', 'Bandeau LED',
    // Détection & Sécurité
    'Détecteur de mouvement', 'Détecteur de fumée', 'Minuterie', 'Télécommande lumière',
    'Sonnette électrique', 'Interphone', 'Visiophone',
    // Domotique
    'Prise connectée', 'Interrupteur connecté', 'Thermostat connecté', 'Centrale domotique',
    // Accessoires
    'Rallonge électrique', 'Enrouleur de câble', 'Domino électrique', 'Wago',
    'Boîte de dérivation', 'Support de lampe', 'Douille E27', 'Douille E14',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CATÉGORIES (15)
  categories: [
    'Câblage et fils',
    'Interrupteurs et commandes',
    'Prises électriques',
    'Protection et tableaux',
    'Ampoules et tubes',
    'Luminaires intérieurs',
    'Luminaires extérieurs',
    'Éclairage décoratif',
    'Détection et sécurité',
    'Domotique et connecté',
    'Accessoires électriques',
    'Matériel professionnel',
    'Installation solaire',
    'Éclairage secours',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TYPES D'ÉCLAIRAGE (20)
  types_eclairage: [
    'Ampoule LED',
    'Ampoule halogène',
    'Ampoule incandescence',
    'Tube néon',
    'Tube LED',
    'Bandeau LED',
    'Spot LED',
    'Plafonnier',
    'Lustre',
    'Applique murale',
    'Lampadaire',
    'Lampe de table',
    'Lampe de chevet',
    'Réglette',
    'Hublot',
    'Projecteur',
    'Guirlande lumineuse',
    'Éclairage solaire',
    'Veilleuse',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES (30)
  marques: [
    // Grandes marques électriques
    'Legrand', 'Schneider Electric', 'ABB', 'Hager', 'Siemens', 'General Electric',
    // Marques éclairage
    'Philips', 'Osram', 'Sylvania', 'Noxion', 'Luceco', 'V-TAC',
    // Marques câbles
    'Nexans', 'Prysmian', 'NKT', 'Brugg',
    // Marques domotique
    'Somfy', 'Legrand Netatmo', 'Xiaomi', 'TP-Link',
    // Marques budget
    'Debflex', 'Diall', 'Extel', 'Chacon', 'Brennenstuhl',
    'Sans marque',
    'Marque locale',
    'Artisan',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TENSIONS (12)
  tensions: [
    '12V DC',
    '24V DC',
    '48V DC',
    '110V AC',
    '220V AC',
    '230V AC',
    '380V AC (Triphasé)',
    '400V AC (Triphasé)',
    'Basse tension (< 50V)',
    'Solaire',
    'Batterie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ PUISSANCES (18)
  puissances: [
    '3W', '5W', '7W', '9W', '10W', '12W', '15W', '18W',
    '20W', '25W', '40W', '50W', '60W', '75W', '100W', '150W',
    '200W+',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ CULOTS D'AMPOULES (16)
  culots_ampoules: [
    'E14 (petit culot)',
    'E27 (gros culot)',
    'B22 (baïonnette)',
    'GU10',
    'GU5.3 (MR16)',
    'G4',
    'G9',
    'R7s',
    'G13 (tube)',
    'GX53',
    'E40',
    'S14s',
    'S14d',
    'Non applicable',
    'Intégré',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ TEMPÉRATURES DE COULEUR (9)
  couleurs_lumiere: [
    'Blanc chaud (2700K)',
    'Blanc extra-chaud (2200K)',
    'Blanc neutre (4000K)',
    'Blanc froid (6000K)',
    'Blanc naturel (5000K)',
    'RGB (multicolore)',
    'RGB + Blanc',
    'Lumière jaune',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ NORMES & CERTIFICATIONS (15)
  normes: [
    'CE',
    'NF',
    'IEC',
    'RoHS',
    'IP20 (intérieur sec)',
    'IP44 (salle de bain)',
    'IP54 (extérieur protégé)',
    'IP65 (étanche)',
    'IP68 (immersion)',
    'Classe I (avec terre)',
    'Classe II (double isolation)',
    'Classe III (basse tension)',
    'A+ (économie énergie)',
    'A++ (très économique)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ GARANTIES (9)
  garanties: [
    '6 mois',
    '1 an',
    '2 ans',
    '3 ans',
    '5 ans',
    '10 ans',
    '25 ans (LED)',
    'À vie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ ÉTAT (8)
  etats: [
    'Neuf en boîte',
    'Neuf sans emballage',
    'Excellent état',
    'Bon état',
    'Occasion',
    'Reconditionné',
    'Déstockage',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ UTILISATIONS (12)
  utilisations: [
    'Résidentiel',
    'Commercial',
    'Industriel',
    'Bureau',
    'Magasin',
    'Restaurant',
    'Hôtel',
    'École',
    'Hôpital',
    'Entrepôt',
    'Extérieur',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS SANTÉ & BEAUTÉ - NOUVEAU
export const SANTE_BEAUTE_MODALITIES: ModalityCategory = {
  types: [
    'Soins visage', 'Soins corps', 'Soins cheveux', 'Maquillage', 'Parfums',
    'Hygiène', 'Compléments alimentaires', 'Équipement médical', '\uD83C\uDD95 Autre (ajouter)'
  ],
  marques: [
    'Nivea', 'L\'Oréal', 'Garnier', 'Dove', 'Neutrogena', 'Vichy',
    '\uD83C\uDD95 Autre (ajouter)'
  ],
  etats: [
    'Neuf scellé', 'Neuf', 'Excellent état', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS JURIDIQUE - NOUVEAU
export const JURIDIQUE_MODALITIES: ModalityCategory = {
  types: [
    'Conseil juridique', 'Rédaction contrat', 'Contentieux', 'Divorce',
    'Immobilier', 'Commercial', 'Pénal', 'Administratif', '\uD83C\uDD95 Autre (ajouter)'
  ],
  specialites: [
    'Droit des affaires', 'Droit du travail', 'Droit de la famille', 'Droit immobilier',
    'Droit pénal', 'Droit fiscal', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS MUSIQUE SERVICES - NOUVEAU
export const MUSIQUE_SERVICES_MODALITIES: ModalityCategory = {
  types: [
    'Cours de musique', 'Animation musicale', 'DJ', 'Groupe live', 'Orchestre',
    'Chanteur', 'Studio enregistrement', '\uD83C\uDD95 Autre (ajouter)'
  ],
  genres: [
    'Variété', 'Jazz', 'Rock', 'Pop', 'Classique', 'R&B', 'Hip-hop', 'Reggae',
    'Afrobeat', 'Makossa', 'Coupé-décalé', '\uD83C\uDD95 Autre (ajouter)'
  ],
  durees: [
    '1h', '2h', '3h', '4h', 'Demi-journée', 'Journée complète', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS PHOTOGRAPHIE - NOUVEAU
export const PHOTOGRAPHIE_MODALITIES: ModalityCategory = {
  types: [
    'Mariage', 'Événement', 'Portrait', 'Famille', 'Grossesse', 'Naissance',
    'Commercial', 'Immobilier', 'Mode', 'Reportage', '\uD83C\uDD95 Autre (ajouter)'
  ],
  styles: [
    'Classique', 'Moderne', 'Artistique', 'Naturel', 'Studio', '\uD83C\uDD95 Autre (ajouter)'
  ],
  equipements: [
    'Drone', 'Studio mobile', 'Éclairage professionnel', 'Photobooth',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ENTREPRISE & INDUSTRIE - NOUVEAU
export const ENTREPRISE_INDUSTRIE_MODALITIES: ModalityCategory = {
  types: [
    'Matériel bureau', 'Machines industrielles', 'Équipement professionnel',
    'Fournitures', 'Services aux entreprises', '\uD83C\uDD95 Autre (ajouter)'
  ],
  secteurs: [
    'Industrie', 'Commerce', 'Services', 'BTP', 'Agriculture', 'Transport',
    'Technologie', '\uD83C\uDD95 Autre (ajouter)'
  ],
  etats: [
    'Neuf', 'Excellent état', 'Bon état', 'Occasion', 'À rénover', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS DÉCORATION INTÉRIEURE - \uD83C\uDF0D CONTEXTE AFRIQUE FRANCOPHONE
export const DECORATION_MODALITIES: ModalityCategory = {
  // \uD83C\uDFA8 CATÉGORIES (21 types) - Focus marché africain
  categories: [
    // \uD83D\uDDBC️ DÉCORATION MURALE (populaire)
    '\uD83D\uDDBC️ Tableaux & Affiches', '\uD83D\uDDBC️ Tableaux africains', '\uD83D\uDDBC️ Art mural',
    '\uD83E\uDE9E Miroirs décoratifs', '\uD83D\uDD70️ Horloges murales', '\uD83D\uDCDA Étagères décoratives',

    // \uD83D\uDCA1 LUMINAIRES (très demandé)
    '\uD83D\uDCA1 Lampes de table', '\uD83D\uDCA1 Lampes sur pied', '\uD83D\uDCA1 Suspensions & Lustres',
    '\uD83D\uDCA1 Appliques murales', '\uD83D\uDCA1 Lampes solaires déco', // ✅ Adaptation Afrique

    // \uD83D\uDECB️ TEXTILES DÉCO
    '\uD83D\uDECB️ Coussins & Plaids', '\uD83E\uDE9F Rideaux & Voilages', '\uD83E\uDDF5 Tapis & Carpettes',

    // \uD83C\uDFFA OBJETS DÉCO
    '\uD83C\uDFFA Vases & Pots décoratifs', '\uD83D\uDD6F️ Bougies & Senteurs', '\uD83D\uDDFF Sculptures & Statues',

    // \uD83C\uDF3F AUTRES
    '\uD83C\uDF3F Plantes artificielles', '\uD83D\uDDBC️ Cadres photo', '\uD83C\uDF7D️ Centre de table',

    // \uD83C\uDF0D THÉMATIQUES AFRICAINES
    '\uD83C\uDF0D Objets ethniques africains', // ✅ Masques, paniers, tissus traditionnels
    '\uD83C\uDFAD Art africain contemporain',
    '♻️ Objets vintage/rétro',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✨ STYLES (15) - Ajout styles africains
  styles: [
    // MODERNES
    'Moderne', 'Contemporain', 'Minimaliste', 'Industriel', 'Scandinave',

    // CLASSIQUES
    'Classique', 'Luxe', 'Art déco',

    // ALTERNATIFS
    'Bohème', 'Ethnique africain', '\uD83C\uDF0D Afro-chic', // ✅ Styles africains
    'Vintage', 'Rustique', 'Shabby chic', 'Tropical',
    'Éclectique',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDFE0 PIÈCES (13)
  pieces: [
    // PRINCIPALES
    'Salon', 'Chambre adulte', 'Cuisine', 'Salle à manger', 'Bureau',

    // SECONDAIRES
    'Salle de bain', 'Entrée/Hall', 'Couloir', 'Véranda', // ✅ Véranda = populaire en Afrique

    // EXTÉRIEUR
    'Terrasse', 'Jardin/Cour', // ✅ Cour intérieure = typique Afrique

    // ENFANTS
    'Chambre enfant', 'Chambre bébé',

    // UNIVERSEL
    'Toutes pièces',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDD28 MATIÈRES (18)
  matieres: [
    // NATURELLES (très prisées en Afrique)
    'Bois', 'Bois exotique', 'Bambou', 'Rotin', 'Osier', 'Raphia', // ✅ Raphia = artisanat local
    'Pierre', 'Marbre',

    // MÉTAUX
    'Métal', 'Fer forgé', 'Cuivre/Cuivré', 'Laiton',

    // VERRE/CÉRAMIQUE
    'Verre', 'Céramique', 'Porcelaine', 'Terre cuite', // ✅ Terre cuite = poterie locale

    // TEXTILES
    'Tissu', 'Coton', 'Lin', 'Velours', 'Pagne/Wax', // ✅ Pagne africain = très demandé

    // AUTRES
    'Plastique', 'Résine', 'Papier', 'Carton',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDFA8 COULEURS (20)
  couleurs: [
    // NEUTRES (base)
    'Blanc', 'Noir', 'Gris', 'Beige/Écru', 'Marron/Brun',

    // COULEURS VIVES (populaires en Afrique)
    'Bleu', 'Vert', 'Rouge', 'Rose', 'Jaune', 'Orange', 'Violet/Mauve',
    'Terracotta', // ✅ Très prisé en déco africaine

    // MÉTALLIQUES (montée en gamme)
    'Doré/Or', 'Argenté', 'Cuivré/Bronze',

    // SPÉCIALES
    'Multicolore', 'Transparent', 'Naturel/Brut',
    'Motifs africains', // ✅ Wax, bogolan, kente

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83D\uDCCF TAILLES (7)
  tailles: [
    'Très petit (< 20cm)',
    'Petit (20-40cm)',
    'Moyen (40-60cm)',
    'Grand (60-100cm)',
    'Très grand (> 100cm)',
    'XL / Monumental (> 150cm)',
    'Set / Lot (plusieurs pièces)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDFF7️ ÉTAT (8) - Valorisation artisanat
  etats: [
    'Neuf avec emballage',
    'Neuf sans emballage',
    'Excellent état',
    'Bon état',
    'Occasion',
    '\uD83C\uDFA8 Artisanal fait main', // ✅ Valorise artisans locaux
    '♻️ Vintage authentique', // ✅ Valorise pièces anciennes
    '\uD83C\uDF0D Import Afrique', // ✅ Provenance authentique africaine

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // \uD83C\uDFEA MARQUES/ORIGINE (15) - Mix international + local
  marques: [
    // GRANDES ENSEIGNES INTERNATIONALES
    'Ikea', 'Maisons du Monde', 'Zara Home', 'H&M Home',
    'Habitat', 'Conforama', 'But', 'La Redoute', 'Alinéa', 'Casa',

    // ARTISANAT LOCAL (valorisation forte)
    '\uD83C\uDF0D Artisan local camerounais', // ✅ Spécifique au pays
    '\uD83C\uDF0D Artisan africain',
    '\uD83C\uDFA8 Fait main',
    'Sans marque',
    '\uD83C\uDF0D Import Afrique de l\'Ouest',

    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ENFANTS & BÉBÉS - NOUVEAU
export const ENFANTS_BEBES_MODALITIES: ModalityCategory = {
  categories: [
    'Vêtements bébé', 'Vêtements enfant', 'Chaussures', 'Poussettes', 'Sièges auto',
    'Lits & berceaux', 'Jouets', 'Alimentation', 'Hygiène', 'Puériculture',
    '\uD83C\uDD95 Autre (ajouter)'
  ],
  ages: [
    '0-3 mois', '3-6 mois', '6-12 mois', '1-2 ans', '2-4 ans', '4-6 ans',
    '6-8 ans', '8-10 ans', '10-12 ans', '\uD83C\uDD95 Autre (ajouter)'
  ],
  etats: [
    'Neuf avec étiquette', 'Neuf', 'Excellent état', 'Bon état', 'Occasion',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS BRICOLAGE - NOUVEAU
export const BRICOLAGE_MODALITIES: ModalityCategory = {
  types: [
    'Outils manuels', 'Outils électriques', 'Matériaux construction', 'Peinture',
    'Plomberie', 'Électricité', 'Quincaillerie', 'Visserie', 'Menuiserie',
    'Jardinage', 'Sécurité', '\uD83C\uDD95 Autre (ajouter)'
  ],
  marques: [
    'Bosch', 'Makita', 'DeWalt', 'Stanley', 'Black & Decker', 'Ryobi',
    'Einhell', 'Skil', 'Hitachi', '\uD83C\uDD95 Autre (ajouter)'
  ],
  etats: [
    'Neuf', 'Excellent état', 'Bon état', 'Occasion', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS CARRELAGE - CONTEXTUALISÉ AFRIQUE FRANCOPHONE
export const CARRELAGE_MODALITIES: ModalityCategory = {
  // Types de carrelage
  types: [
    'Carrelage sol', 'Carrelage mural', 'Carrelage extérieur', 'Carrelage piscine',
    'Faïence', 'Mosaïque', 'Carrelage terrasse', 'Tomette', 'Zellige (marocain)',
    'Pavé extérieur', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Matériaux
  materiaux: [
    'Céramique', 'Porcelaine', 'Grès cérame', 'Grès émaillé', 'Marbre',
    'Granit', 'Pierre naturelle', 'Terre cuite', 'Ardoise', 'Travertin',
    'Quartzite', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Dimensions (✅ Adaptées au marché africain)
  dimensions: [
    '10x10cm', '15x15cm', '20x20cm', '25x25cm', '30x30cm', '33x33cm',
    '40x40cm', '45x45cm', '50x50cm', '60x60cm', '80x80cm', '100x100cm',
    '120x60cm', 'Sur mesure', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Finitions
  finitions: [
    'Brillant', 'Mat', 'Satiné', 'Poli', 'Antidérapant', 'Structuré',
    'Lappato', 'Adouci', 'Brossé', 'Flammé', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Épaisseurs
  epaisseurs: [
    '6mm', '7mm', '8mm', '9mm', '10mm', '11mm', '12mm', '15mm', '20mm',
    '30mm (extérieur)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Usage
  usages: [
    'Intérieur résidentiel', 'Intérieur commercial', 'Extérieur', 'Salle de bain',
    'Cuisine', 'Piscine', 'Terrasse', 'Garage', 'Hall d\'entrée', 'Boutique/Magasin',
    'Hôtel/Restaurant', 'Bureau', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Aspects / Décors
  aspects: [
    'Uni', 'Marbré', 'Imitation bois', 'Imitation pierre', 'Imitation béton',
    'Imitation marbre', 'Métallique', 'Motif géométrique', 'Hexagonal',
    'Format métro', 'Décor floral', 'Décor oriental', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ MARQUES & ORIGINES (Focus Afrique Francophone + International)
  marques: [
    // \uD83C\uDF0D Import Afrique du Nord (très présent en Afrique Centrale/Ouest)
    'Ceramica Flaminia (Tunisie)', 'Ceramica Cleopatra (Égypte)', 'Ceramica (Maroc)',
    'SOMOCER (Maroc)', 'CMPC (Maroc)', 'Ceramica Atlas (Maroc)',

    // \uD83C\uDF0D Import Afrique du Sud
    'Italtile (Afrique du Sud)', 'Johnson Tiles (Afrique du Sud)', 'Cera (Afrique du Sud)',

    // \uD83C\uDDEA\uD83C\uDDF8 Espagne (Leader en Afrique francophone)
    'Porcelanosa', 'Grespania', 'Pamesa', 'Vives', 'Tau Ceramica', 'Saloni',
    'Rocersa', 'Aparici', 'Argenta', 'Halcon',

    // \uD83C\uDDEE\uD83C\uDDF9 Italie (Haut de gamme)
    'Marazzi', 'Ceramiche Keope', 'Atlas Concorde', 'Imola', 'Ragno',
    'Panaria', 'Lea Ceramiche', 'Fap Ceramiche', 'Cerdomus',

    // \uD83C\uDDF5\uD83C\uDDF9 Portugal
    'Revigrés', 'Ceusa', 'Kerion Ceramics', 'Love Tiles',

    // \uD83C\uDDF9\uD83C\uDDF7 Turquie (Rapport qualité/prix)
    'Kale', 'Ege Seramik', 'Çanakkale Seramik', 'Vitra', 'Topçu',

    // \uD83C\uDDE8\uD83C\uDDF3 Chine (Économique)
    'Foshan (Chine)', 'Guangdong (Chine)', 'Marco Polo (Chine)', 'Eagle (Chine)',

    // \uD83C\uDDEE\uD83C\uDDF3 Inde
    'Kajaria', 'Somany', 'Johnson Tiles India', 'Orient Bell',

    // \uD83C\uDF0D Production locale / Artisanal
    'Artisan local', 'Production locale', 'Fabrication artisanale',
    'Sans marque', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Couleurs principales
  couleurs: [
    'Blanc', 'Beige', 'Gris clair', 'Gris foncé', 'Noir', 'Ivoire', 'Crème',
    'Marron', 'Taupe', 'Bois naturel', 'Bois foncé', 'Pierre', 'Bleu',
    'Vert', 'Rouge', 'Multicolore', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Origine / Provenance
  origines: [
    '\uD83C\uDDEA\uD83C\uDDF8 Espagne', '\uD83C\uDDEE\uD83C\uDDF9 Italie', '\uD83C\uDDF5\uD83C\uDDF9 Portugal', '\uD83C\uDDF9\uD83C\uDDF7 Turquie', '\uD83C\uDDE8\uD83C\uDDF3 Chine',
    '\uD83C\uDDEE\uD83C\uDDF3 Inde', '\uD83C\uDDEA\uD83C\uDDEC Égypte', '\uD83C\uDDF2\uD83C\uDDE6 Maroc', '\uD83C\uDDF9\uD83C\uDDF3 Tunisie', '\uD83C\uDDFF\uD83C\uDDE6 Afrique du Sud',
    'Cameroun', 'Production locale', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ État du produit
  etats: [
    'Neuf', 'En stock', 'Sur commande', 'Promotion', 'Déstockage',
    'Fin de série', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Conditionnement
  conditionnements: [
    'À la pièce', 'Par m²', 'Par carton (1m²)', 'Par carton (1.2m²)',
    'Par carton (1.44m²)', 'Par palette', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS MENUISERIE - \uD83C\uDF0D CONTEXTE AFRIQUE FRANCOPHONE (Focus Cameroun)
export const MENUISERIE_MODALITIES: ModalityCategory = {
  // ═══════════════════════════════════════════════════════════════
  // \uD83D\uDEE0️ TYPES DE SERVICES (60+) - COMPLET CAMEROUN & AFRIQUE
  // ═══════════════════════════════════════════════════════════════
  services: [
    // \uD83E\uDE91 MEUBLES SUR MESURE (20)
    '\uD83E\uDE91 Fabrication salon complet (canapé, fauteuils, table basse)',
    '\uD83E\uDE91 Fabrication chambre à coucher (lit, armoire, coiffeuse)',
    '\uD83E\uDE91 Fabrication salle à manger (table, chaises, buffet)',
    '\uD83E\uDE91 Fabrication bureau (table bureau, bibliothèque, étagères)',
    '\uD83E\uDE91 Fabrication lit sur mesure (simple, double, king size)',
    '\uD83E\uDE91 Fabrication armoire/garde-robe sur mesure',
    '\uD83E\uDE91 Fabrication placard mural/encastré',
    '\uD83E\uDE91 Fabrication bibliothèque/étagères murales',
    '\uD83E\uDE91 Fabrication bar d\'intérieur/comptoir',
    '\uD83E\uDE91 Fabrication meuble TV/home cinéma',
    '\uD83E\uDE91 Fabrication table basse/console',
    '\uD83E\uDE91 Fabrication chaises/fauteuils',
    '\uD83E\uDE91 Fabrication meuble vasque/salle de bain',
    '\uD83E\uDE91 Fabrication cuisine équipée/aménagée',
    '\uD83E\uDE91 Fabrication meuble pour boutique/commerce',
    '\uD83E\uDE91 Fabrication présentoir produits',
    '\uD83E\uDE91 Fabrication rayonnage/stockage',
    '\uD83E\uDE91 Fabrication mobilier restaurant/maquis',
    '\uD83E\uDE91 Fabrication mobilier hôtel/auberge',
    '\uD83E\uDE91 Fabrication mobilier école/bureau',

    // \uD83D\uDEAA PORTES & FENÊTRES (15)
    '\uD83D\uDEAA Fabrication & pose porte d\'entrée bois massif',
    '\uD83D\uDEAA Fabrication & pose porte intérieure bois',
    '\uD83D\uDEAA Fabrication & pose porte blindée/sécurisée',
    '\uD83D\uDEAA Fabrication & pose porte coulissante',
    '\uD83D\uDEAA Fabrication & pose portail bois',
    '\uD83D\uDEAA Fabrication & pose porte garage',
    '\uD83E\uDE9F Fabrication & pose fenêtres bois',
    '\uD83E\uDE9F Fabrication & pose fenêtres bois/alu',
    '\uD83E\uDE9F Fabrication & pose volets bois',
    '\uD83E\uDE9F Fabrication & pose baies vitrées bois',
    '\uD83D\uDEAA Réparation/remplacement porte',
    '\uD83E\uDE9F Réparation/remplacement fenêtre',
    '\uD83D\uDD27 Dépannage serrurerie bois',
    '\uD83D\uDD27 Ajustement porte/fenêtre (grincement, blocage)',
    '\uD83D\uDD27 Remplacement gonds/charnières',

    // \uD83C\uDFE0 MENUISERIE INTÉRIEURE (12)
    '\uD83C\uDFE0 Pose parquet massif/flottant',
    '\uD83C\uDFE0 Pose lambris mural/plafond',
    '\uD83C\uDFE0 Pose plinthes bois',
    '\uD83C\uDFE0 Aménagement combles/grenier',
    '\uD83C\uDFE0 Fabrication & pose escalier bois intérieur',
    '\uD83C\uDFE0 Habillage escalier existant',
    '\uD83C\uDFE0 Cloison bois/séparation pièce',
    '\uD83C\uDFE0 Faux plafond/plafond suspendu bois',
    '\uD83C\uDFE0 Dressing/penderie sur mesure',
    '\uD83C\uDFE0 Aménagement sous escalier',
    '\uD83C\uDFE0 Mezzanine bois',
    '\uD83C\uDFE0 Terrasse intérieure bois',

    // \uD83C\uDF33 MENUISERIE EXTÉRIEURE (10)
    '\uD83C\uDF33 Terrasse/plancher extérieur bois',
    '\uD83C\uDF33 Pergola/tonnelle bois',
    '\uD83C\uDF33 Clôture/palissade bois',
    '\uD83C\uDF33 Portillon/portail bois',
    '\uD83C\uDF33 Abri jardin/cabanon bois',
    '\uD83C\uDF33 Charpente bois/toiture',
    '\uD83C\uDF33 Couverture/bardage bois',
    '\uD83C\uDF33 Kiosque/gazebo bois',
    '\uD83C\uDF33 Poulailler/enclos bois',
    '\uD83C\uDF33 Auvent/marquise bois',

    // \uD83D\uDD28 RÉPARATIONS & RESTAURATION (8)
    '\uD83D\uDD28 Réparation meubles anciens/endommagés',
    '\uD83D\uDD28 Restauration meubles (antiquité, héritage)',
    '\uD83D\uDD28 Vernissage/revêtement meubles',
    '\uD83D\uDD28 Rénovation parquet (ponçage, vitrification)',
    '\uD83D\uDD28 Traitement bois (anti-termites, anti-humidité)',
    '\uD83D\uDD28 Remplacement pièces cassées',
    '\uD83D\uDD28 Ajustement/renforcement structure',
    '\uD83D\uDD28 Transformation/modification meubles',

    // \uD83C\uDFA8 ÉBÉNISTERIE & DÉCORATION (8)
    '\uD83C\uDFA8 Ébénisterie artistique/sculpture bois',
    '\uD83C\uDFA8 Marqueterie/incrustation',
    '\uD83C\uDFA8 Objets décoratifs bois (cadres, miroirs)',
    '\uD83C\uDFA8 Portes sculptées traditionnelles',
    '\uD83C\uDFA8 Mobilier design/contemporain',
    '\uD83C\uDFA8 Mobilier traditionnel africain',
    '\uD83C\uDFA8 Objets artisanaux (masques, statues)',
    '\uD83C\uDFA8 Personnalisation/gravure sur bois',

    '\uD83C\uDD95 Autre service menuiserie (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83C\uDF32 TYPES DE BOIS (50+) - Focus BOIS AFRICAINS + Internationaux
  // ═══════════════════════════════════════════════════════════════
  bois: [
    // === \uD83C\uDDE8\uD83C\uDDF2 BOIS AFRICAINS LOCAUX (25) - POPULAIRES AU CAMEROUN ===
    '\uD83C\uDDE8\uD83C\uDDF2 Acajou d\'Afrique (Khaya)', // Très prisé
    '\uD83C\uDDE8\uD83C\uDDF2 Sapelli (Acajou africain)', // Noble, résistant
    '\uD83C\uDDE8\uD83C\uDDF2 Iroko (Teck africain)', // Très durable
    '\uD83C\uDDE8\uD83C\uDDF2 Doussié/Afzelia', // Dur, résistant termites
    '\uD83C\uDDE8\uD83C\uDDF2 Moabi', // Bois rouge noble
    '\uD83C\uDDE8\uD83C\uDDF2 Padouk rouge d\'Afrique', // Couleur rouge vif
    '\uD83C\uDDE8\uD83C\uDDF2 Tali/Eloun', // Résistant, construction
    '\uD83C\uDDE8\uD83C\uDDF2 Bilinga/Opepe', // Jaune, durable
    '\uD83C\uDDE8\uD83C\uDDF2 Bubinga/Kevazingo', // Bois précieux
    '\uD83C\uDDE8\uD83C\uDDF2 Wengé', // Très sombre, luxe
    '\uD83C\uDDE8\uD83C\uDDF2 Dibétou', // Clair, économique
    '\uD83C\uDDE8�M Framiré', // Jaune pâle
    '\uD83C\uDDE8\uD83C\uDDF2 Kosipo', // Acajou léger
    '\uD83C\uDDE8\uD83C\uDDF2 Sipo', // Acajou rose
    '\uD83C\uDDE8\uD83C\uDDF2 Ayous/Obeche/Samba', // Très léger, économique
    '\uD83C\uDDE8\uD83C\uDDF2 Azobé/Bongossi', // Ultra dur, extérieur
    '\uD83C\uDDE8\uD83C\uDDF2 Ebène d\'Afrique', // Précieux, noir
    '\uD83C\uDDE8\uD83C\uDDF2 Teck d\'Afrique (plantation)',
    '\uD83C\uDDE8\uD83C\uDDF2 Eucalyptus (plantation locale)',
    '\uD83C\uDDE8\uD83C\uDDF2 Bambou africain',
    '\uD83C\uDDE8\uD83C\uDDF2 Palmier (bois artisanal)',
    '\uD83C\uDDE8\uD83C\uDDF2 Fromager',
    '\uD83C\uDDE8\uD83C\uDDF2 Niangon',
    '\uD83C\uDDE8\uD83C\uDDF2 Tiama',
    '\uD83C\uDDE8\uD83C\uDDF2 Bois local mixte',

    // === \uD83C\uDF0D BOIS IMPORTÉS POPULAIRES (10) ===
    '\uD83C\uDF0D Chêne européen', // Importé, cher
    '\uD83C\uDF0D Hêtre', // Importé
    '\uD83C\uDF0D Pin maritime',
    '\uD83C\uDF0D Sapin du Nord',
    '\uD83C\uDF0D Teck d\'Asie (Thaïlande, Birmanie)',
    '\uD83C\uDF0D Acajou d\'Amérique',
    '\uD83C\uDF0D Cerisier',
    '\uD83C\uDF0D Noyer',
    '\uD83C\uDF0D Merisier',
    '\uD83C\uDF0D Érable',

    // === \uD83C\uDFED PANNEAUX & DÉRIVÉS (15) - Très utilisés au Cameroun ===
    '\uD83C\uDFED Contreplaqué okoumé (production locale)',
    '\uD83C\uDFED Contreplaqué marine',
    '\uD83C\uDFED Contreplaqué standard',
    '\uD83C\uDFED MDF (Medium Density Fiberboard)',
    '\uD83C\uDFED Aggloméré/Particules',
    '\uD83C\uDFED OSB (Oriented Strand Board)',
    '\uD83C\uDFED Latté/Lattis',
    '\uD83C\uDFED Multiplis',
    '\uD83C\uDFED MDF mélaminé',
    '\uD83C\uDFED Aggloméré stratifié',
    '\uD83C\uDFED Panneau bois massif reconstitué',
    '\uD83C\uDFED HDF (High Density Fiberboard)',
    '\uD83C\uDFED Panneau alvéolaire',
    '\uD83C\uDFED Plywood',
    '\uD83C\uDFED Isorel',

    '\uD83C\uDD95 Autre bois (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83C\uDFA8 FINITIONS & TRAITEMENTS (25+)
  // ═══════════════════════════════════════════════════════════════
  finitions: [
    // Finitions classiques
    'Vernis brillant', 'Vernis mat', 'Vernis satiné',
    'Peinture laquée brillante', 'Peinture laquée mate',
    'Peinture glycéro', 'Peinture acrylique',
    'Lasure transparente', 'Lasure teintée',
    'Huile de lin', 'Huile dure', 'Huile naturelle',
    'Cire d\'abeille', 'Cire incolore', 'Cire teintée',

    // Traitements spécifiques Afrique
    'Traitement anti-termites (crucial Cameroun)', // Très important !
    'Traitement anti-humidité/moisissures',
    'Traitement insecticide complet',
    'Traitement fongicide',
    'Protection UV (pour extérieur)',

    // Finitions particulières
    'Brut/naturel non traité',
    'Brut poncé',
    'Teinté bois',
    'Cérusé',
    'Vieilli/patiné',

    '\uD83C\uDD95 Autre finition (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83C\uDFAD STYLES DE MENUISERIE (20+)
  // ═══════════════════════════════════════════════════════════════
  styles: [
    // Styles modernes
    'Moderne/Contemporain',
    'Minimaliste',
    'Design épuré',
    'Industriel',
    'Scandinave',
    'Japonais/Zen',

    // Styles traditionnels
    'Classique français',
    'Colonial britannique',
    'Colonial français',
    'Rustique/Campagnard',
    'Provençal',
    'Louis XV/XVI',

    // Styles africains
    'Traditionnel africain',
    'Afro-contemporain (fusion)',
    'Artisanal camerounais',
    'Ethnique/Tribal',
    'Afro-chic/Afro-luxe',

    // Autres
    'Vintage/Rétro',
    'Art déco',
    'Baroque',

    '\uD83C\uDD95 Autre style (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83D\uDEE0️ OUTILS & ÉQUIPEMENTS (30+)
  // ═══════════════════════════════════════════════════════════════
  outils_disponibles: [
    // Outils électriques
    'Scie circulaire', 'Scie sauteuse', 'Scie à onglet',
    'Raboteuse électrique', 'Dégauchisseuse',
    'Toupie/Défonceuse',
    'Ponceuse orbitale', 'Ponceuse à bande',
    'Perceuse/Visseuse', 'Perceuse à colonne',
    'Fraiseuse', 'Mortaiseuse',
    'Affleureuse', 'Scie à ruban',

    // Outils manuels
    'Rabot manuel', 'Ciseaux à bois', 'Gouges',
    'Scie égoïne', 'Scie japonaise',
    'Équerre', 'Niveau à bulle',
    'Serre-joints', 'Étau', 'Varlope',
    'Marteau menuisier', 'Maillet bois',
    'Lime bois', 'Râpe bois',

    // Atelier équipé
    'Atelier complet professionnel',
    'Atelier semi-équipé',
    'Outils basiques manuels uniquement',

    '\uD83C\uDD95 Autre équipement (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83C\uDF93 NIVEAUX D'EXPÉRIENCE (12)
  // ═══════════════════════════════════════════════════════════════
  niveaux_experience: [
    'Apprenti menuisier (< 1 an)',
    'Débutant (1-2 ans)',
    'Menuisier confirmé (3-5 ans)',
    'Menuisier expérimenté (5-10 ans)',
    'Menuisier expert (10-15 ans)',
    'Menuisier senior (15-20 ans)',
    'Maître menuisier (20+ ans)',
    'Ébéniste d\'art',
    'Artisan primé/reconnu',
    'Formateur/Enseignant menuiserie',
    'Chef d\'atelier',
    '\uD83C\uDD95 Autre niveau (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83C\uDF96️ CERTIFICATIONS & DIPLÔMES (15+) - Contexte Cameroun
  // ═══════════════════════════════════════════════════════════════
  certifications: [
    // Diplômes camerounais
    'CAP Menuiserie (Cameroun)',
    'BP Menuisier (Cameroun)',
    'BT Menuiserie-Ébénisterie',
    'BTS Menuiserie (ENSET, Universités)',
    'Certificat MINEFOP Menuiserie',
    'Formation CEFAM (Centre Formation Artisanale)',

    // Formations professionnelles
    'Apprentissage traditionnel (maître artisan)',
    'Formation centre artisanal',
    'Compagnon menuisier',

    // Certifications qualité
    'Certification qualité artisan',
    'Label Artisan Cameroun',
    'Agrément chambre des métiers',

    // International
    'CAP Menuisier France/Europe',
    'Formation professionnelle internationale',

    'Autodidacte/Expérience terrain',
    '\uD83C\uDD95 Autre certification (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83C\uDFED ATELIERS & FABRICANTS (20+) - Focus Cameroun
  // ═══════════════════════════════════════════════════════════════
  marques_ateliers: [
    // === \uD83C\uDDE8\uD83C\uDDF2 ATELIERS CAMEROUNAIS (Douala, Yaoundé, autres) ===
    '\uD83C\uDDE8\uD83C\uDDF2 Atelier artisanal Bonabéri (Douala)',
    '\uD83C\uDDE8\uD83C\uDDF2 Marché bois Mboppi (Douala)',
    '\uD83C\uDDE8\uD83C\uDDF2 Menuisiers Deido (Douala)',
    '\uD83C\uDDE8\uD83C\uDDF2 Ateliers Nkoulouloun (Douala)',
    '\uD83C\uDDE8\uD83C\uDDF2 Menuiserie Bassa (Douala)',
    '\uD83C\uDDE8\uD83C\uDDF2 Atelier Mvog-Ada (Yaoundé)',
    '\uD83C\uDDE8\uD83C\uDDF2 Menuisiers Mokolo (Yaoundé)',
    '\uD83C\uDDE8\uD83C\uDDF2 Ateliers Melen (Yaoundé)',
    '\uD83C\uDDE8\uD83C\uDDF2 Menuiserie Elig-Edzoa (Yaoundé)',
    '\uD83C\uDDE8\uD83C\uDDF2 Ébénistes Bafoussam',
    '\uD83C\uDDE8\uD83C\uDDF2 Menuisiers Garoua',
    '\uD83C\uDDE8\uD83C\uDDF2 Artisans Maroua',
    '\uD83C\uDDE8\uD83C\uDDF2 Menuiserie moderne Cameroun',
    '\uD83C\uDDE8\uD83C\uDDF2 Cameroon Wood Design',
    '\uD83C\uDDE8\uD83C\uDDF2 African Wood Craft',

    // Qualifications
    'Menuisier indépendant local',
    'Atelier familial traditionnel',
    'Coopérative artisans menuisiers',
    'Entreprise menuiserie PME',

    '\uD83C\uDD95 Autre atelier (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // ⏱️ DÉLAIS DE FABRICATION (10)
  // ═══════════════════════════════════════════════════════════════
  delais: [
    'Express (24-48h) - selon disponibilité',
    'Rapide (3-7 jours)',
    'Standard (1-2 semaines)',
    'Moyen (2-4 semaines)',
    'Long (1-2 mois)',
    'Très long (2-3 mois)',
    'Sur mesure complexe (3+ mois)',
    'À définir selon projet',
    'Production en série (stock disponible)',
    '\uD83C\uDD95 Autre délai (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83D\uDCB0 MODES DE PAIEMENT (12)
  // ═══════════════════════════════════════════════════════════════
  modes_paiement: [
    'Espèces (FCFA)',
    'Mobile Money (MTN, Orange)',
    'Virement bancaire',
    'Chèque',
    'Paiement échelonné (mensualités)',
    'Acompte + Solde à livraison',
    '30% acompte / 70% livraison',
    '50% acompte / 50% livraison',
    'Paiement complet avant fabrication',
    'Paiement à la livraison',
    'Crédit artisan (facilités)',
    '\uD83C\uDD95 Autre mode (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83D\uDCCD ZONES D'INTERVENTION - \uD83C\uDF0D SYSTÈME INTELLIGENT AUTO-ADAPTATIF
  // S'adapte automatiquement au pays de l'utilisateur via getModalitiesWithUserContext()
  // Génère: pays utilisateur (prioritaire) → villes principales → autres pays Afrique
  // ═══════════════════════════════════════════════════════════════
  zones_intervention: genererZonesIntervention('CM'), // Par défaut Cameroun, s'adapte via useUserCountry

  // ═══════════════════════════════════════════════════════════════
  // ✅ GARANTIES & SAV (10)
  // ═══════════════════════════════════════════════════════════════
  garanties: [
    'Garantie 6 mois travaux',
    'Garantie 1 an',
    'Garantie 2 ans',
    'Garantie 5 ans (bois massif)',
    'Garantie à vie (structure)',
    'SAV disponible',
    'Retouches gratuites (6 mois)',
    'Remplacement pièces défectueuses',
    'Pas de garantie formelle',
    '\uD83C\uDD95 Autre garantie (ajouter)'
  ]
};

// ✅ MODALITÉS RÉPARATEUR/MAINTENANCE CLIMATISEUR - \uD83C\uDF0D CONTEXTE AFRIQUE FRANCOPHONE
export const REPARATEUR_CLIMATISEUR_MODALITIES: ModalityCategory = {
  // ═══════════════════════════════════════════════════════════════
  // \uD83D\uDEE0️ TYPES DE SERVICES (25+) - COMPLET CLIMATISATION
  // ═══════════════════════════════════════════════════════════════
  services: [
    // Services principaux
    '❄️ Installation climatiseur neuf',
    '❄️ Réparation/Dépannage climatiseur',
    '❄️ Maintenance préventive/Entretien régulier',
    '❄️ Nettoyage complet climatiseur (intérieur + extérieur)',
    '❄️ Recharge gaz réfrigérant (R22, R410A, R32)',
    '❄️ Détection et réparation fuite de gaz',
    '❄️ Remplacement compresseur',
    '❄️ Remplacement carte électronique',
    '❄️ Remplacement ventilateur',
    '❄️ Remplacement filtre à air',
    '❄️ Remplacement télécommande',
    '❄️ Réparation drainage (évacuation eau)',
    '❄️ Diagnostic panne/Devis gratuit',

    // Services spécialisés
    '\uD83C\uDFE2 Installation climatisation centrale',
    '\uD83C\uDFE2 Maintenance climatisation bureau/commerce',
    '\uD83C\uDFE2 Dépannage urgence 24h/24',
    '\uD83C\uDFE2 Contrat maintenance annuel',
    '\uD83C\uDFE2 Désinstallation/Réinstallation (déménagement)',
    '\uD83C\uDFE2 Optimisation consommation électrique',
    '\uD83C\uDFE2 Mise aux normes climatisation',

    // Services complémentaires
    '\uD83D\uDD27 Vente pièces détachées climatiseur',
    '\uD83D\uDD27 Conseil achat climatiseur adapté',
    '\uD83D\uDD27 Formation utilisation/entretien',

    '\uD83C\uDD95 Autre service (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // ❄️ MARQUES CLIMATISEURS (40+) - Focus Afrique & Cameroun
  // ═══════════════════════════════════════════════════════════════
  marques_climatiseurs: [
    // === \uD83C\uDDE8\uD83C\uDDF3 MARQUES CHINOISES (Très populaires en Afrique) ===
    '\uD83C\uDDE8\uD83C\uDDF3 Midea', // Leader en Afrique
    '\uD83C\uDDE8\uD83C\uDDF3 Gree', // Très populaire
    '\uD83C\uDDE8\uD83C\uDDF3 Haier',
    '\uD83C\uDDE8\uD83C\uDDF3 Hisense',
    '\uD83C\uDDE8\uD83C\uDDF3 TCL',
    '\uD83C\uDDE8\uD83C\uDDF3 Aux',
    '\uD83C\uDDE8\uD83C\uDDF3 Chigo',
    '\uD83C\uDDE8\uD83C\uDDF3 Galanz',
    '\uD83C\uDDE8\uD83C\uDDF3 Kelon',
    '\uD83C\uDDE8\uD83C\uDDF3 Changhong',

    // === \uD83C\uDDEF\uD83C\uDDF5 MARQUES JAPONAISES (Haut de gamme) ===
    '\uD83C\uDDEF\uD83C\uDDF5 Daikin', // Premium
    '\uD83C\uDDEF\uD83C\uDDF5 Mitsubishi Electric',
    '\uD83C\uDDEF\uD83C\uDDF5 Mitsubishi Heavy Industries',
    '\uD83C\uDDEF\uD83C\uDDF5 Fujitsu',
    '\uD83C\uDDEF\uD83C\uDDF5 Toshiba',
    '\uD83C\uDDEF\uD83C\uDDF5 Panasonic',
    '\uD83C\uDDEF\uD83C\uDDF5 Hitachi',
    '\uD83C\uDDEF\uD83C\uDDF5 Sharp',

    // === \uD83C\uDDF0\uD83C\uDDF7 MARQUES CORÉENNES (Milieu/Haut de gamme) ===
    '\uD83C\uDDF0\uD83C\uDDF7 LG', // Très populaire en Afrique
    '\uD83C\uDDF0\uD83C\uDDF7 Samsung',
    '\uD83C\uDDF0\uD83C\uDDF7 Carrier (LG)',

    // === \uD83C\uDF0D MARQUES INTERNATIONALES ===
    '\uD83C\uDF0D Carrier (USA)',
    '\uD83C\uDF0D York',
    '\uD83C\uDF0D Trane',
    '\uD83C\uDF0D Lennox',
    '\uD83C\uDF0D Rheem',
    '\uD83C\uDF0D Whirlpool',

    // === \uD83C\uDDEA\uD83C\uDDFA MARQUES EUROPÉENNES ===
    '\uD83C\uDDEA\uD83C\uDDFA Electrolux',
    '\uD83C\uDDEA\uD83C\uDDFA Bosch',
    '\uD83C\uDDEA\uD83C\uDDFA Siemens',
    '\uD83C\uDDEA\uD83C\uDDFA De Longhi',

    // === \uD83C\uDDF9\uD83C\uDDF7 MARQUES TURQUES (Économiques) ===
    '\uD83C\uDDF9\uD83C\uDDF7 Vestel',
    '\uD83C\uDDF9\uD83C\uDDF7 Arçelik',

    'Toutes marques',
    'Sans préférence marque',
    '\uD83C\uDD95 Autre marque (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83C\uDFE0 TYPES DE CLIMATISEURS (15+)
  // ═══════════════════════════════════════════════════════════════
  types_climatiseurs: [
    '❄️ Split mural (le plus courant)',
    '❄️ Split multi-split (plusieurs unités intérieures)',
    '❄️ Window/Fenêtre (monobloc)',
    '❄️ Cassette (encastré plafond)',
    '❄️ Gainable (conduits)',
    '❄️ Mobile/Portable',
    '❄️ Centralisé/VRV',
    '❄️ Inverter (économie énergie)',
    '❄️ On/Off (classique)',
    '❄️ Monosplit',
    '❄️ Multisplit',
    '❄️ Console (au sol)',
    '❄️ Armoire (standing)',
    '❄️ Réversible (chaud/froid)',
    '\uD83C\uDD95 Autre type (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // ⚙️ PIÈCES DÉTACHÉES COURANTES (30+)
  // ═══════════════════════════════════════════════════════════════
  pieces_detachees: [
    // Pièces principales
    '\uD83D\uDD27 Compresseur',
    '\uD83D\uDD27 Carte électronique/PCB',
    '\uD83D\uDD27 Condensateur',
    '\uD83D\uDD27 Ventilateur unité intérieure',
    '\uD83D\uDD27 Ventilateur unité extérieure',
    '\uD83D\uDD27 Moteur ventilateur',
    '\uD83D\uDD27 Télécommande',
    '\uD83D\uDD27 Récepteur infrarouge',
    '\uD83D\uDD27 Détendeur/Vanne expansion',
    '\uD83D\uDD27 Filtre déshydrateur',

    // Filtres et nettoyage
    '\uD83D\uDD27 Filtre à air',
    '\uD83D\uDD27 Filtre antibactérien',
    '\uD83D\uDD27 Filtre charbon actif',
    '\uD83D\uDD27 Filtre HEPA',

    // Drainage
    '\uD83D\uDD27 Pompe de relevage condensats',
    '\uD83D\uDD27 Tuyau drainage',
    '\uD83D\uDD27 Bac condensats',

    // Électronique
    '\uD83D\uDD27 Capteur température',
    '\uD83D\uDD27 Thermostat',
    '\uD83D\uDD27 Relais démarrage',
    '\uD83D\uDD27 Transformateur',

    // Tuyauterie et gaz
    '\uD83D\uDD27 Tuyau cuivre (frigorifique)',
    '\uD83D\uDD27 Gaz réfrigérant R22',
    '\uD83D\uDD27 Gaz réfrigérant R410A',
    '\uD83D\uDD27 Gaz réfrigérant R32',
    '\uD83D\uDD27 Vanne de service',
    '\uD83D\uDD27 Raccord cuivre',

    // Accessoires
    '\uD83D\uDD27 Support mural',
    '\uD83D\uDD27 Cache climatiseur',

    '\uD83C\uDD95 Autre pièce (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83C\uDF93 CERTIFICATIONS & QUALIFICATIONS (12+)
  // ═══════════════════════════════════════════════════════════════
  certifications: [
    // Certifications frigoristes
    '\uD83C\uDF93 Certificat FROID (Frigoriste qualifié)',
    '\uD83C\uDF93 Habilitation manipulation fluides frigorigènes',
    '\uD83C\uDF93 Attestation aptitude gaz fluorés',
    '\uD83C\uDF93 CAP Froid et Climatisation',
    '\uD83C\uDF93 BEP Froid et Climatisation',
    '\uD83C\uDF93 BTS Fluides Énergies Domotique',
    '\uD83C\uDF93 Formation constructeur (Daikin, Mitsubishi...)',

    // Expérience
    '\uD83C\uDF93 Technicien certifié constructeur',
    '\uD83C\uDF93 Frigoriste agréé',
    '\uD83C\uDF93 Expert climatisation (10+ ans)',

    // Sans certification
    'Autodidacte/Expérience terrain',
    '\uD83C\uDD95 Autre certification (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // ⏱️ DISPONIBILITÉS & URGENCE (10)
  // ═══════════════════════════════════════════════════════════════
  disponibilites: [
    '\uD83D\uDEA8 Urgence 24h/24 - 7j/7',
    '\uD83D\uDEA8 Dépannage urgence (même jour)',
    '⏰ Intervention sous 2-4h',
    '⏰ Intervention sous 24h',
    '⏰ Rendez-vous sous 48h',
    '\uD83D\uDCC5 Planning semaine',
    '\uD83D\uDCC5 Week-end disponible',
    '\uD83D\uDCC5 Jours ouvrables uniquement (Lun-Ven)',
    '\uD83D\uDCC5 Sur rendez-vous uniquement',
    '\uD83C\uDD95 Autre disponibilité (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // ⚡ PUISSANCES TRAITÉES (BTU) - Important pour climatisation
  // ═══════════════════════════════════════════════════════════════
  puissances_btu: [
    '9000 BTU (petite pièce 10-15m²)',
    '12000 BTU (pièce moyenne 15-25m²)',
    '18000 BTU (grande pièce 25-35m²)',
    '24000 BTU (très grande pièce 35-50m²)',
    '30000 BTU+ (espace commercial)',
    'Climatisation centrale (toute puissance)',
    'Toutes puissances',
    '\uD83C\uDD95 Autre puissance (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83D\uDCB0 MODES DE TARIFICATION (10)
  // ═══════════════════════════════════════════════════════════════
  modes_tarification: [
    '\uD83D\uDCB5 Diagnostic/Devis gratuit',
    '\uD83D\uDCB5 Tarif forfaitaire intervention',
    '\uD83D\uDCB5 Tarif horaire',
    '\uD83D\uDCB5 Prix selon panne',
    '\uD83D\uDCB5 Pièces + main d\'œuvre',
    '\uD83D\uDCB5 Contrat maintenance annuel',
    '\uD83D\uDCB5 Abonnement maintenance mensuel',
    '\uD83D\uDCB5 Prix négociable',
    '\uD83D\uDCB5 Devis obligatoire avant intervention',
    '\uD83C\uDD95 Autre tarification (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83D\uDCB3 MODES DE PAIEMENT (12) - Contexte Afrique
  // ═══════════════════════════════════════════════════════════════
  modes_paiement: [
    '\uD83D\uDCB3 Espèces (FCFA)',
    '\uD83D\uDCB3 Mobile Money (MTN, Orange)',
    '\uD83D\uDCB3 Virement bancaire',
    '\uD83D\uDCB3 Chèque',
    '\uD83D\uDCB3 Carte bancaire',
    '\uD83D\uDCB3 Paiement après travaux',
    '\uD83D\uDCB3 Acompte + Solde',
    '\uD83D\uDCB3 50% avant / 50% après',
    '\uD83D\uDCB3 Paiement échelonné possible',
    '\uD83D\uDCB3 Facture entreprise acceptée',
    '\uD83D\uDCB3 Paiement mobile (Wave, PayPal...)',
    '\uD83C\uDD95 Autre mode (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // ✅ GARANTIES TRAVAUX (8)
  // ═══════════════════════════════════════════════════════════════
  garanties: [
    '✅ Garantie 1 mois travaux',
    '✅ Garantie 3 mois travaux',
    '✅ Garantie 6 mois travaux',
    '✅ Garantie 1 an travaux',
    '✅ Garantie pièces neuves (constructeur)',
    '✅ SAV assuré',
    '✅ Retour gratuit si panne récurrente',
    'Pas de garantie formelle',
    '\uD83C\uDD95 Autre garantie (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83C\uDFE2 TYPES DE CLIENTÈLE (8)
  // ═══════════════════════════════════════════════════════════════
  types_clients: [
    '\uD83C\uDFE0 Particuliers/Résidentiel',
    '\uD83C\uDFE2 Entreprises/Bureaux',
    '\uD83C\uDFE8 Hôtels/Hébergements',
    '\uD83C\uDFEA Commerces/Boutiques',
    '\uD83C\uDFE5 Hôpitaux/Cliniques',
    '\uD83C\uDFEB Écoles/Universités',
    '\uD83C\uDFED Industrie/Usines',
    '⛪ Administrations/ONG',
    '\uD83C\uDD95 Autre clientèle (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83D\uDEE0️ ÉQUIPEMENTS TECHNICIEN (12+)
  // ═══════════════════════════════════════════════════════════════
  equipements_technicien: [
    '\uD83D\uDEE0️ Outillage complet professionnel',
    '\uD83D\uDEE0️ Pompe à vide',
    '\uD83D\uDEE0️ Manomètres (groupe froid)',
    '\uD83D\uDEE0️ Détecteur de fuite électronique',
    '\uD83D\uDEE0️ Multimètre/Testeur électrique',
    '\uD83D\uDEE0️ Poste à souder',
    '\uD83D\uDEE0️ Machine à cintrer cuivre',
    '\uD83D\uDEE0️ Pompe de relevage',
    '\uD83D\uDEE0️ Nettoyeur haute pression',
    '\uD83D\uDEE0️ Stock pièces détachées',
    '\uD83D\uDEE0️ Véhicule équipé',
    'Équipement de base',
    '\uD83C\uDD95 Autre équipement (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // \uD83D\uDCCD ZONES D'INTERVENTION - \uD83C\uDF0D SYSTÈME INTELLIGENT AUTO-ADAPTATIF
  // S'adapte automatiquement au pays de l'utilisateur via getModalitiesWithUserContext()
  // Génère: pays utilisateur (prioritaire) → villes principales → autres pays Afrique
  // ═══════════════════════════════════════════════════════════════
  zones_intervention: genererZonesIntervention('CM'), // Par défaut Cameroun, s'adapte via useUserCountry

  // ═══════════════════════════════════════════════════════════════
  // \uD83D\uDE97 DÉPLACEMENT (5)
  // ═══════════════════════════════════════════════════════════════
  modalites_deplacement: [
    '\uD83D\uDE97 Je me déplace chez le client',
    '\uD83C\uDFEA Client vient à l\'atelier',
    '\uD83D\uDE97\uD83C\uDFEA Les deux possibles',
    '\uD83D\uDE97 Frais déplacement inclus',
    '\uD83D\uDE97 Frais déplacement selon zone',
    '\uD83C\uDD95 Autre modalité (ajouter)'
  ],

  // ═══════════════════════════════════════════════════════════════
  // ⚠️ TYPES DE PANNES COURANTES (20+) - Pour diagnostic
  // ═══════════════════════════════════════════════════════════════
  types_pannes: [
    '⚠️ Climatiseur ne démarre pas',
    '⚠️ Pas de froid/Ne refroidit pas',
    '⚠️ Fuite d\'eau/Condensats',
    '⚠️ Bruit anormal (compresseur, ventilateur)',
    '⚠️ Odeur désagréable',
    '⚠️ Télécommande ne fonctionne pas',
    '⚠️ Consommation électrique élevée',
    '⚠️ Ventilateur ne tourne pas',
    '⚠️ Compresseur ne démarre pas',
    '⚠️ Givre sur l\'unité intérieure',
    '⚠️ Code erreur affiché',
    '⚠️ Disjoncteur saute',
    '⚠️ Fuite de gaz réfrigérant',
    '⚠️ Mauvaise répartition air froid',
    '⚠️ Climatiseur s\'arrête tout seul',
    '⚠️ Écran/Affichage ne fonctionne pas',
    '⚠️ Mode chauffage ne fonctionne pas (réversible)',
    '⚠️ Filtres encrassés',
    '⚠️ Panne électronique/Carte',
    '⚠️ Autre panne (diagnostic nécessaire)',
    '\uD83C\uDD95 Autre problème (ajouter)'
  ]
};

// ✅ MODALITÉS MUSIQUE & INSTRUMENTS - AFRIQUE FRANCOPHONE
export const MUSIQUE_INSTRUMENTS_MODALITIES: ModalityCategory = {
  // ========== CATÉGORIES PRINCIPALES ==========
  categories: [
    'Instrument de musique', 'Accessoire musical', 'Sonorisation & Sono',
    'Matériel DJ', 'Studio & Enregistrement', 'Instrument traditionnel africain',
    'Équipement scène', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ========== TYPES D'INSTRUMENTS (150+) ==========

  // === CORDES - GUITARES (25+) ===
  types_cordes_guitares: [
    // Guitares acoustiques
    'Guitare acoustique', 'Guitare classique', 'Guitare folk',
    'Guitare 12 cordes', 'Guitare électro-acoustique',

    // Guitares électriques
    'Guitare électrique', 'Guitare semi-acoustique', 'Guitare basse',
    'Basse 4 cordes', 'Basse 5 cordes', 'Basse 6 cordes',
    'Basse électro-acoustique', 'Basse fretless',

    // Guitares spéciales
    'Ukulélé soprano', 'Ukulélé concert', 'Ukulélé ténor', 'Ukulélé baryton',
    'Banjo 4/5 cordes', 'Mandoline', 'Bouzouki',

    // Accessoires guitares
    'Ampli guitare', 'Pédale effet guitare', 'Multi-effet guitare',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === CORDES - ORCHESTRE (15+) ===
  types_cordes_orchestre: [
    'Violon 4/4', 'Violon 3/4', 'Violon 1/2', 'Violon 1/4',
    'Alto', 'Violoncelle', 'Contrebasse',
    'Harpe celtique', 'Harpe de concert', 'Lyre',
    'Kora', 'Ngoni', 'Mvet', 'Sanza/Kalimba',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === CLAVIERS & PIANOS (20+) ===
  types_claviers: [
    // Pianos acoustiques
    'Piano droit', 'Piano à queue', 'Piano quart de queue',
    'Piano demi-queue', 'Piano de concert',

    // Pianos numériques
    'Piano numérique 88 touches', 'Piano numérique 76 touches',
    'Piano numérique 61 touches', 'Piano portable',

    // Claviers & synthés
    'Clavier arrangeur', 'Synthétiseur', 'Synthé analogique',
    'Synthé modulaire', 'Workstation', 'Sampler',
    'Orgue électronique', 'Accordéon', 'Harmonica',
    'Mélodica', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === PERCUSSIONS & BATTERIES (30+) ===
  types_percussions: [
    // Batteries acoustiques
    'Batterie acoustique complète', 'Batterie 5 pièces', 'Batterie 7 pièces',
    'Batterie enfant', 'Batterie de jazz', 'Grosse caisse',

    // Batteries électroniques
    'Batterie électronique', 'Pad électronique', 'Module batterie',

    // Percussions latines
    'Congas', 'Bongos', 'Timbales', 'Cajón', 'Claves',
    'Maracas', 'Güiro', 'Cowbell', 'Agogô',

    // Percussions africaines traditionnelles \uD83C\uDF0D
    'Djembé', 'Dundun', 'Balafon', 'Tam-tam', 'Talking drum',
    'Ashiko', 'Bougarabou', 'Kpanlogo', 'Sabar',
    'Shekere', 'Caxixi', 'Agogo', 'Bells africaines',

    // Cymbales & accessoires
    'Cymbale crash', 'Cymbale ride', 'Charleston/Hi-hat',
    'Cymbale china', 'Cymbale splash', 'Stand cymbale',
    'Pédale grosse caisse', 'Throne batterie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === VENTS - BOIS (15+) ===
  types_vents_bois: [
    'Flûte traversière', 'Flûte à bec soprano', 'Flûte à bec alto',
    'Piccolo', 'Clarinette Bb', 'Clarinette basse',
    'Saxophone soprano', 'Saxophone alto', 'Saxophone ténor',
    'Saxophone baryton', 'Hautbois', 'Basson',
    'Cor anglais', 'Flûte de Pan', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === VENTS - CUIVRES (12+) ===
  types_vents_cuivres: [
    'Trompette Bb', 'Trompette Ut', 'Cornet', 'Bugle',
    'Trombone ténor', 'Trombone basse', 'Tuba',
    'Cor d\'harmonie', 'Euphonium', 'Sousaphone',
    'Trompe africaine', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === INSTRUMENTS TRADITIONNELS AFRICAINS (20+) \uD83C\uDF0D ===
  instruments_africains: [
    // Cordes
    'Kora (21 cordes)', 'Ngoni', 'Mvet', 'Sanza/Kalimba/Mbira',
    'Arc musical', 'Goje (violon peul)', 'Kundi',

    // Percussions
    'Djembé', 'Dundun', 'Balafon', 'Tam-tam', 'Talking drum',
    'Sabar sénégalais', 'Bougarabou', 'Kpanlogo ghanéen',
    'Shekere', 'Udu (pot terre cuite)', 'Bendir',

    // Vents
    'Flûte peule', 'Trompe corne', 'Sifflet bambou',
    'Vuvuzela', 'Algaita (hautbois haoussa)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === SONORISATION & DJ (25+) ===
  equipement_sono_dj: [
    // Enceintes & Sono
    'Enceinte active', 'Enceinte passive', 'Caisson de basse/Subwoofer',
    'Enceinte colonne', 'Enceinte monitoring', 'Enceinte retour scène',
    'Enceinte Bluetooth portable', 'Sono portable', 'Line array',

    // Amplification
    'Ampli sono', 'Ampli basse', 'Ampli guitare', 'Préampli',
    'Crossover actif', 'Limiteur/Compresseur',

    // Matériel DJ
    'Platine vinyle DJ', 'Contrôleur DJ', 'Table de mixage DJ',
    'CDJ/Lecteur DJ', 'Casque DJ', 'Cellule platine',
    'Flight case DJ', 'Câble XLR/Jack',

    // Accessoires
    'Pied enceinte', 'Câble sono', 'Multipaire', 'DI box',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === STUDIO & ENREGISTREMENT (20+) ===
  equipement_studio: [
    // Enregistrement
    'Microphone à condensateur', 'Microphone dynamique', 'Micro USB',
    'Interface audio USB', 'Interface audio Thunderbolt', 'Carte son externe',
    'Préampli micro', 'Compresseur hardware', 'Égaliseur hardware',

    // Monitoring
    'Enceinte monitoring studio', 'Casque studio', 'Ampli casque',
    'Contrôleur monitoring', 'Isolation monitoring',

    // Traitement
    'Processeur vocal', 'Multi-effet rack', 'Réverbe hardware',
    'Noise gate', 'Exciter/Enhancer',

    // Accessoires
    'Filtre anti-pop', 'Suspension micro', 'Pied micro perche',
    'Panneau acoustique', 'Bass trap', 'Câble XLR', 'Câble Jack TRS',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === ACCESSOIRES MUSICAUX (30+) ===
  accessoires: [
    // Guitare & Basse
    'Cordes guitare', 'Cordes basse', 'Médiators/Picks', 'Capodastre',
    'Sangle guitare', 'Accordeur', 'Métronome', 'Étui guitare',
    'Housse guitare', 'Support guitare', 'Humidificateur guitare',

    // Piano & Clavier
    'Pédale sustain', 'Pédale expression', 'Support clavier',
    'Banquette piano', 'Lampe piano', 'Pupitre',

    // Batterie
    'Baguettes', 'Balais batterie', 'Peaux batterie', 'Peau de djembé',
    'Huile cymbale', 'Tapis batterie', 'Housse cymbales',

    // Vents
    'Anches clarinette/saxo', 'Embouchure', 'Sourdine trompette',
    'Écouvillon', 'Graisse liège', 'Étui instrument vent',

    // Général
    'Câble instrument', 'Câble audio', 'Multiprise filtrée',
    'Pupitre partition', 'Lampe pupitre', 'Diapason',
    'Sac transport', 'Flight case', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ========== MARQUES (50+) ==========

  // === MARQUES GUITARES & BASSES ===
  marques_guitares: [
    // Haut de gamme
    'Fender', 'Gibson', 'PRS (Paul Reed Smith)', 'Ibanez',
    'Music Man', 'Rickenbacker', 'Gretsch', 'ESP',

    // Milieu de gamme
    'Yamaha', 'Epiphone', 'Squier (Fender)', 'Cort',
    'Godin', 'Takamine', 'Ovation', 'Taylor',

    // Entrée de gamme / Populaires Afrique
    'Washburn', 'Lag', 'Stagg', 'Harley Benton',
    'Valencia', 'Admira', 'Alhambra',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === MARQUES PIANOS & CLAVIERS ===
  marques_pianos: [
    // Pianos acoustiques prestige
    'Steinway & Sons', 'Yamaha', 'Kawai', 'Bösendorfer',
    'Fazioli', 'Bechstein', 'Blüthner', 'Pleyel',

    // Pianos numériques & Claviers
    'Roland', 'Korg', 'Casio', 'Kurzweil', 'Nord',
    'Yamaha Clavinova', 'Kawai Digital', 'Alesis',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === MARQUES BATTERIES & PERCUSSIONS ===
  marques_batteries: [
    // Batteries acoustiques
    'Pearl', 'Yamaha', 'Tama', 'DW (Drum Workshop)',
    'Gretsch', 'Ludwig', 'Mapex', 'Sonor',

    // Batteries électroniques
    'Roland', 'Alesis', 'Yamaha DTX', 'Simmons',

    // Cymbales
    'Zildjian', 'Sabian', 'Meinl', 'Paiste',

    // Percussions africaines artisanales
    'Artisan local', 'Fait main Afrique', 'Sénégal traditionnel',
    'Mali artisanal', 'Guinée artisanal',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === MARQUES VENTS ===
  marques_vents: [
    'Yamaha', 'Buffet Crampon', 'Selmer', 'Conn',
    'Bach', 'Leblanc', 'Jupiter', 'Eastman',
    'Antigua', 'Trevor James', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === MARQUES SONO & DJ ===
  marques_sono_dj: [
    // Enceintes sono
    'JBL', 'QSC', 'Electro-Voice (EV)', 'Yamaha', 'RCF',
    'dB Technologies', 'Mackie', 'Behringer', 'Peavey',
    'Alto Professional', 'Wharfedale', 'HK Audio',

    // DJ
    'Pioneer DJ', 'Technics', 'Numark', 'Denon DJ',
    'Reloop', 'Native Instruments', 'Rane', 'Allen & Heath',

    // Populaires Afrique \uD83C\uDF0D
    'Soundking', 'Audiophony', 'Power Dynamics', 'Ibiza Sound',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === MARQUES STUDIO ===
  marques_studio: [
    // Micros
    'Shure', 'Sennheiser', 'AKG', 'Audio-Technica',
    'Neumann', 'Rode', 'Blue', 'Electro-Voice',

    // Interfaces & Monitoring
    'Focusrite', 'Universal Audio', 'Presonus', 'M-Audio',
    'Behringer', 'Steinberg', 'Yamaha', 'KRK', 'Adam Audio',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === MARQUES SYNTHÉTISEURS ===
  marques_synthes: [
    'Roland', 'Korg', 'Moog', 'Yamaha', 'Nord',
    'Arturia', 'Novation', 'Sequential', 'Dave Smith',
    'Teenage Engineering', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ========== CARACTÉRISTIQUES ==========

  // === MATÉRIAUX ===
  materiaux: [
    // Bois
    'Épicéa massif', 'Cèdre massif', 'Acajou', 'Érable',
    'Palissandre', 'Ébène', 'Tilleul', 'Aulne',
    'Frêne', 'Noyer', 'Bois stratifié',

    // Métaux
    'Laiton', 'Cuivre', 'Bronze', 'Acier',
    'Aluminium', 'Nickel', 'Argent plaqué',

    // Modernes
    'Plastique ABS', 'Fibre de carbone', 'Composite',
    'Peau naturelle', 'Peau synthétique',

    // Traditionnels africains \uD83C\uDF0D
    'Calebasse', 'Terre cuite', 'Bambou',
    'Peau de chèvre', 'Corde boyau', 'Corde nylon',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === TAILLES & DIMENSIONS ===
  tailles: [
    // Violon/Alto/Violoncelle
    '4/4 (adulte)', '3/4 (ado/petit adulte)', '1/2 (8-11 ans)',
    '1/4 (6-8 ans)', '1/8 (4-6 ans)', '1/10 (3-4 ans)',

    // Guitares
    'Taille 4/4', 'Taille 3/4', 'Taille 1/2', 'Taille 1/4',
    'Dreadnought', 'Jumbo', 'Parlor', 'Concert', 'Grand auditorium',

    // Ukulélé
    'Soprano (standard)', 'Concert', 'Ténor', 'Baryton',

    // Batteries
    '5 pièces', '7 pièces', '9 pièces', 'Junior/Enfant',

    // Djembé
    '8 pouces (20 cm)', '10 pouces (25 cm)', '12 pouces (30 cm)',
    '14 pouces (35 cm)', 'Professionnel (40+ cm)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === ÉTATS ===
  etats: [
    'Neuf scellé', 'Neuf jamais utilisé', 'Neuf avec garantie',
    'Comme neuf', 'Excellent état', 'Très bon état',
    'Bon état fonctionnel', 'État correct',
    'À réviser/Régler', 'À réparer', 'Pour pièces',
    'Vintage/Collection', 'Antiquité',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === NIVEAUX ===
  niveaux: [
    'Débutant', 'Faux débutant', 'Intermédiaire',
    'Intermédiaire avancé', 'Avancé', 'Expert',
    'Professionnel', 'Concert/Scène', 'Studio',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === UTILISATION ===
  utilisations: [
    'Apprentissage', 'Pratique maison', 'Cours de musique',
    'Répétition', 'Concert/Scène', 'Studio enregistrement',
    'Église/Culte', 'Animation événement', 'Mariage',
    'DJ soirée', 'Bar/Restaurant', 'Salle spectacle',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === GARANTIES ===
  garanties: [
    'Sans garantie', '3 mois', '6 mois', '1 an',
    '2 ans', '3 ans', '5 ans', 'Garantie constructeur',
    'Extension garantie disponible', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === ORIGINES / FABRICATION ===
  origines: [
    // Asie
    'Japon', 'Chine', 'Corée du Sud', 'Taïwan',
    'Indonésie', 'Vietnam', 'Inde',

    // Europe
    'Allemagne', 'France', 'Italie', 'Espagne',
    'Royaume-Uni', 'République tchèque',

    // Amériques
    'États-Unis', 'Mexique', 'Canada', 'Brésil',

    // Afrique \uD83C\uDF0D
    'Sénégal', 'Mali', 'Guinée', 'Burkina Faso',
    'Côte d\'Ivoire', 'Cameroun', 'Ghana',
    'Artisanat africain', 'Fait main local',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === GENRES MUSICAUX ===
  genres_musicaux: [
    // Internationaux
    'Classique', 'Jazz', 'Blues', 'Rock', 'Pop',
    'Funk', 'Soul', 'R&B', 'Hip-hop', 'Reggae',
    'Country', 'Folk', 'Metal', 'Électro', 'House',

    // Africains \uD83C\uDF0D
    'Afrobeat', 'Afro-pop', 'Makossa', 'Bikutsi',
    'Coupé-décalé', 'Zouglou', 'Ndombolo', 'Soukous',
    'Mbalax', 'Highlife', 'Assiko', 'Bend-skin',
    'Musique traditionnelle', 'Gospel africain',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === ALIMENTATIONS ===
  alimentations: [
    'Secteur 220V', 'Batterie rechargeable', 'Piles AA/AAA',
    'USB', 'Adaptateur 12V', 'Phantom 48V',
    'Alimentation mixte (secteur/batterie)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === CONNECTIQUES ===
  connectiques: [
    'Jack 6.35mm', 'Jack 3.5mm', 'XLR', 'RCA',
    'USB', 'MIDI', 'Bluetooth', 'Wi-Fi',
    'Optique/Toslink', 'Speakon', 'Ethernet',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // === ACCESSOIRES INCLUS ===
  inclusions: [
    'Étui/Housse inclus', 'Câbles inclus', 'Baguettes incluses',
    'Médiators inclus', 'Sangle incluse', 'Accordeur inclus',
    'Pupitre inclus', 'Casque inclus', 'Pédale incluse',
    'Support inclus', 'Manuel en français', 'Garantie carte',
    'Facture fournie', 'Certificat authenticité',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ════════════════════════════════════════════════════════════
// ✅ MODALITÉS EMPLOI & RECRUTEMENT - ULTRA-ENRICHI AFRIQUE + INTERNATIONAL
// ════════════════════════════════════════════════════════════
// \uD83C\uDFAF Objectif : Référence absolue pour publier/trouver un emploi
// \uD83D\uDCCA Contenu : 500+ métiers, 100+ secteurs, spécificités africaines
// ════════════════════════════════════════════════════════════
export const EMPLOI_MODALITIES: ModalityCategory = {
  // ✅ Types de contrat (13 options)
  types_contrat: [
    'CDI (Contrat à Durée Indéterminée)',
    'CDD (Contrat à Durée Déterminée)',
    'Stage / Internship',
    'Freelance / Indépendant',
    'Intérim / Travail temporaire',
    'Alternance (Contrat pro / Apprentissage)',
    'Contrat de professionnalisation',
    'Apprentissage',
    'Contrat saisonnier',
    'Vacation / Contractuel',
    'Consultant externe',
    'Service civique',
    'Bénévolat / Volontariat',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Secteurs d'activité (100+ options - contexte Afrique)
  secteurs_activite: [
    // Secteurs clés Afrique
    'Agriculture/Agro-industrie',
    'Mines/Pétrole/Gaz',
    'Télécommunications',
    'Banque/Microfinance',
    'Mobile Money/Fintech',
    'ONG/Humanitaire',
    'Transport/Logistique',
    'Commerce général/Import-Export',
    'Énergie solaire/Renouvelables',
    'Santé/Médical/Pharmaceutique',
    'Éducation/Formation',
    'Tourisme/Hôtellerie',
    'BTP/Construction/Génie civil',
    'Sécurité/Gardiennage',
    // Secteurs traditionnels
    'Informatique/IT/Tech',
    'Développement web/mobile',
    'Data Science/IA',
    'Cybersécurité',
    'Marketing/Communication',
    'Marketing digital/SEO',
    'Commerce/Vente',
    'Finance/Comptabilité',
    'Audit/Contrôle de gestion',
    'Ressources Humaines/RH',
    'Juridique/Droit',
    'Administration/Secrétariat',
    'Gestion de projet/PMO',
    // Industrie & Production
    'Industrie manufacturière',
    'Agroalimentaire/Transformation',
    'Textile/Confection',
    'Bois/Menuiserie/Ébénisterie',
    'Métallurgie/Soudure',
    'Chimie/Plasturgie',
    'Électronique/Électrotechnique',
    'Automobile/Mécanique',
    'Maintenance industrielle',
    'Qualité/QHSE',
    'Immobilier/Promotion',
    'Assurance/Actuariat',
    'Sport/Fitness/Coaching',
    'Beauté/Esthétique/Coiffure',
    'Fonction publique',
    'Défense/Armée/Police',
    'Autre secteur',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Niveaux d'expérience (8 options détaillées)
  niveaux_experience: [
    'Débutant accepté / Sans expérience',
    'Junior (< 1 an)',
    '1-2 ans d\'expérience',
    '2-5 ans d\'expérience',
    '5-10 ans d\'expérience',
    '10-15 ans d\'expérience',
    '15+ ans (Expert/Senior)',
    'Peu importe (tous niveaux)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types d'emploi / Modes de travail (11 options)
  types_emploi: [
    'Temps plein (35-40h/semaine)',
    'Temps partiel (< 35h/semaine)',
    'Mi-temps (20h/semaine)',
    'Télétravail complet (100% remote)',
    'Hybride (Télétravail + Présentiel)',
    'Sur site uniquement (Présentiel)',
    'Horaires flexibles',
    'Horaires fixes',
    'Travail de nuit',
    'Travail en équipe (3x8, 2x8)',
    'Week-end uniquement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Diplômes requis (10 options)
  diplomes: [
    'Aucun diplôme requis',
    'BEPC/Brevet',
    'Baccalauréat (BAC)',
    'BTS / DUT / Bac+2',
    'Licence / Bachelor / Bac+3',
    'Master / Bac+5',
    'Doctorat / PhD / Bac+8',
    'MBA',
    'Diplôme d\'ingénieur',
    'Formation professionnelle certifiante',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Langues (10+ langues africaines et internationales)
  langues: [
    'Français (obligatoire)',
    'Anglais (obligatoire)',
    'Bilingue Français-Anglais',
    'Espagnol',
    'Allemand',
    'Arabe',
    'Chinois (Mandarin)',
    'Portugais',
    'Italien',
    // Langues africaines
    'Fulfuldé (Peul)',
    'Ewondo',
    'Douala',
    'Bamiléké',
    'Bassa',
    'Pidgin English',
    'Wolof (Sénégal)',
    'Dioula (Côte d\'Ivoire)',
    'Lingala (Congo)',
    'Swahili',
    'Langues locales africaines',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Avantages sociaux (20+ options)
  avantages_sociaux: [
    'Assurance santé / Mutuelle',
    'Assurance vie',
    'Primes de performance',
    '13ème mois',
    '14ème mois',
    'Tickets restaurant / Cantine',
    'Véhicule de fonction',
    'Téléphone professionnel',
    'Ordinateur portable fourni',
    'Formation continue payée',
    'Congés payés (30 jours+)',
    'RTT (Réduction Temps Travail)',
    'Pension de retraite',
    'Logement fourni',
    'Allocation transport',
    'Allocation logement',
    'Bonus annuel',
    'Stock-options / Participation',
    'Salle de sport / Gym',
    'Crèche d\'entreprise',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Types d'entreprise (8 options)
  types_entreprise: [
    'Startup / Scale-up',
    'PME (Petite/Moyenne Entreprise)',
    'Grande entreprise / Corporate',
    'Multinationale',
    'ONG / Association',
    'Administration publique',
    'Entreprise familiale',
    'Agence / Cabinet conseil',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Lieux de travail (système intelligent dynamique)
  lieux_travail: genererZonesIntervention('CM'),

  // ✅ Compétences techniques générales (50+ options)
  competences_techniques: [
    // IT & Tech
    'Développement web',
    'Développement mobile',
    'Base de données SQL/NoSQL',
    'Cloud (AWS, Azure, GCP)',
    'DevOps / CI/CD',
    'Cybersécurité',
    'Data Science / IA',
    'Machine Learning',
    'Blockchain',
    // Bureautique & Digital
    'Pack Office (Word, Excel, PowerPoint)',
    'Excel avancé (VBA, Macros)',
    'Google Workspace',
    'CRM (Salesforce, HubSpot)',
    'ERP (SAP, Odoo)',
    'Adobe Suite (Photoshop, Illustrator)',
    'Montage vidéo',
    'Design UI/UX',
    // Marketing & Communication
    'Marketing digital',
    'SEO / Référencement',
    'SEA / Google Ads',
    'Réseaux sociaux',
    'Content Marketing',
    'Email Marketing',
    'Analytics (Google Analytics)',
    // Finance & Comptabilité
    'Comptabilité générale',
    'Contrôle de gestion',
    'Analyse financière',
    'Fiscalité',
    'Audit',
    // Langues techniques
    'Python',
    'JavaScript',
    'Java',
    'PHP',
    'C++/C#',
    'React/Vue/Angular',
    'Node.js',
    'Flutter/React Native',
    // Autres
    'Gestion de projet (Agile, Scrum)',
    'AutoCAD / DAO',
    'Conduite de véhicules (Permis B, C, D)',
    'Soudure',
    'Électricité',
    'Plomberie',
    'Mécanique',
    'Cuisine professionnelle',
    'Premiers secours',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Soft Skills / Compétences comportementales (30+ options)
  soft_skills: [
    'Leadership',
    'Management d\'équipe',
    'Communication orale',
    'Communication écrite',
    'Négociation',
    'Esprit d\'équipe',
    'Autonomie',
    'Adaptabilité / Flexibilité',
    'Gestion du stress',
    'Résolution de problèmes',
    'Pensée critique',
    'Créativité / Innovation',
    'Organisation / Rigueur',
    'Gestion du temps',
    'Sens du service client',
    'Empathie',
    'Prise d\'initiative',
    'Force de proposition',
    'Persévérance',
    'Capacité d\'apprentissage',
    'Travail sous pression',
    'Sens des responsabilités',
    'Esprit analytique',
    'Proactivité',
    'Capacité de synthèse',
    'Aisance relationnelle',
    'Écoute active',
    'Gestion de conflits',
    'Travail multiculturel',
    'Diplomatie',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Statut urgence (pour filtrage)
  urgence_recrutement: [
    'Recrutement urgent (< 1 semaine)',
    'Recrutement prioritaire (< 2 semaines)',
    'Recrutement normal',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // ✅ Date de prise de poste
  date_prise_poste: [
    'Immédiate (cette semaine)',
    'Sous 2 semaines',
    'Sous 1 mois',
    'Sous 3 mois',
    'Flexible / À définir',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS MÉCANICIEN / GARAGE AUTOMOBILE - AFRIQUE FRANCOPHONE
export const MECANICIEN_MODALITIES: ModalityCategory = {
  // Types de services mécaniques
  types_service_mecanique: [
    // Entretien courant
    'Vidange moteur', 'Changement filtres (huile, air, carburant)',
    'Remplacement plaquettes de frein', 'Changement disques de frein',
    'Contrôle technique', 'Révision complète', 'Diagnostic électronique',
    'Remplacement courroie distribution', 'Changement batterie',

    // Mécanique générale
    'Réparation moteur', 'Réfection moteur', 'Culasse',
    'Embrayage', 'Boîte de vitesses', 'Transmission', 'Cardan',
    'Suspension (amortisseurs, ressorts)', 'Direction assistée',
    'Échappement (pot, ligne complète)', 'Turbo',

    // Électricité & électronique
    'Diagnostic électronique (valise)', 'Reprogrammation calculateur',
    'Alternateur', 'Démarreur', 'Faisceau électrique',
    'Système d\'allumage', 'Injection', 'ABS', 'Airbag',
    'Climatisation (recharge, réparation)', 'Autoradio', 'GPS',

    // Carrosserie & peinture
    'Débosselage', 'Peinture complète', 'Peinture partielle',
    'Pare-choc', 'Aile', 'Capot', 'Hayon', 'Portière',
    'Vitrage (pare-brise, vitres)', 'Phares/Feux',

    // Pneumatiques
    'Montage pneus', 'Équilibrage roues', 'Parallélisme',
    'Géométrie', 'Permutation pneus', 'Réparation crevaison',

    // Dépannage
    'Dépannage sur route', 'Remorquage', 'Démarrage batterie',
    'Dépannage 24h/24', 'Dépannage week-end',

    // Spécialités africaines
    'Adaptation véhicule terrain africain', 'Rehausse suspension 4x4',
    'Installation porte-bagages', 'Renforcement châssis',
    'Installation treuil', 'Protection bas de caisse',
    'Installation barre LED', 'Snorkel (prise d\'air haute)',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Spécialités du garage
  specialites_garage: [
    'Toutes marques', 'Marques japonaises', 'Marques européennes',
    'Marques américaines', 'Marques chinoises', 'Marques coréennes',
    'Véhicules 4x4/SUV', 'Véhicules légers', 'Véhicules utilitaires',
    'Camions/Poids lourds', 'Motos/Scooters', 'Engins TP/BTP',
    'Véhicules agricoles', 'Véhicules hybrides/électriques',
    'Véhicules anciens/collection', 'Tuning/Préparation',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques de véhicules traitées (focus Afrique)
  marques_vehicules: [
    // Japonaises (très populaires en Afrique)
    'Toyota', 'Nissan', 'Honda', 'Mitsubishi', 'Mazda',
    'Suzuki', 'Isuzu', 'Subaru', 'Lexus', 'Infiniti',

    // Européennes
    'Renault', 'Peugeot', 'Citroën', 'Mercedes-Benz', 'BMW',
    'Volkswagen', 'Audi', 'Opel', 'Ford', 'Fiat',
    'Volvo', 'Skoda', 'Seat', 'Dacia',

    // Américaines
    'Chevrolet', 'GMC', 'Jeep', 'Dodge', 'Cadillac',
    'Hummer', 'Chrysler', 'Lincoln',

    // Coréennes
    'Hyundai', 'Kia', 'SsangYong', 'Daewoo',

    // Chinoises (en expansion en Afrique)
    'Changan', 'Chery', 'Geely', 'BYD', 'Great Wall',
    'Haval', 'JAC', 'Dongfeng', 'BAIC', 'Foton',

    // Indiennes
    'Tata', 'Mahindra', 'Ashok Leyland',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Certifications & qualifications
  certifications: [
    'Mécanicien agréé constructeur', 'Diplôme CAP/BEP Mécanique',
    'BTS Maintenance automobile', 'Licence professionnelle',
    'Formation Toyota', 'Formation Nissan', 'Formation Renault',
    'Formation Peugeot', 'Certification diagnostic électronique',
    'Habilitation climatisation', 'Certification soudure',
    'Expert 4x4', 'Expert moteur diesel', 'Expert injection',
    'Expert transmission automatique', 'Expert véhicules hybrides',
    'Sans certification (expérience terrain)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements du garage
  equipements: [
    'Pont élévateur', 'Fosse de visite', 'Compresseur',
    'Valise diagnostic électronique', 'Appareil géométrie/parallélisme',
    'Équilibreuse roues', 'Démonte-pneus', 'Presse hydraulique',
    'Poste soudure', 'Cabine peinture', 'Pont de levage 2 colonnes',
    'Pont de levage 4 colonnes', 'Chariot hydraulique',
    'Banc de démarrage', 'Station recharge climatisation',
    'Nettoyeur haute pression', 'Aspirateur industriel',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de véhicules traités
  types_vehicules: [
    'Voitures particulières', 'SUV/4x4', 'Pick-up',
    'Utilitaires légers', 'Camionnettes', 'Minibus',
    'Camions', 'Poids lourds', 'Semi-remorques',
    'Motos', 'Scooters', 'Tricycles',
    'Engins BTP', 'Tracteurs agricoles', 'Engins de levage',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Services complémentaires
  services_complementaires: [
    'Vente pièces détachées', 'Pièces d\'origine constructeur',
    'Pièces adaptables', 'Pièces d\'occasion garanties',
    'Lavage véhicule', 'Nettoyage intérieur complet',
    'Lustrage carrosserie', 'Traitement anti-rouille',
    'Contrôle avant achat', 'Expertise après accident',
    'Devis gratuit', 'Garantie réparations', 'Véhicule de courtoisie',
    'Enlèvement véhicule en panne', 'Carte fidélité',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Modes de paiement
  modes_paiement: [
    'Espèces', 'Mobile Money (MTN, Orange, etc.)', 'Virement bancaire',
    'Chèque', 'Carte bancaire', 'Paiement en plusieurs fois',
    'Facilités de paiement', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Horaires d'ouverture
  horaires: [
    'Lundi-Vendredi 8h-18h', 'Lundi-Samedi 8h-18h',
    'Lundi-Dimanche 8h-18h', 'Service 24h/24',
    'Dépannage 24h/24', 'Sur rendez-vous uniquement',
    'Sans rendez-vous', 'Horaires flexibles',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Délais d'intervention
  delais: [
    'Intervention immédiate', 'Même jour', 'Sous 24h',
    'Sous 48h', 'Sous 1 semaine', 'Sur devis',
    'Selon disponibilité pièces', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Zone d'intervention
  zone_intervention: genererZonesIntervention('CM'),

  // Villes principales
  villes: genererToutesLesVilles('CM'),

  // Quartiers (Douala, Yaoundé, etc.)
  quartiers: genererQuartiersPays('CM'),

  // Langues parlées
  langues: [
    'Français', 'Anglais', 'Pidgin', 'Fulfuldé',
    'Ewondo', 'Douala', 'Bamiléké', 'Bassa',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Prestations d'urgence
  urgence: [
    'Oui - Dépannage 24h/24', 'Oui - Dépannage jour uniquement',
    'Non - Sur rendez-vous uniquement', '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS MÉCANICIEN MOTO/TRICYCLE - SPÉCIALISÉ AFRIQUE FRANCOPHONE
export const MECANICIEN_MOTO_MODALITIES: ModalityCategory = {
  // Types de services spécialisés motos/tricycles
  types_service_moto: [
    // Entretien moteur moto
    'Vidange moteur moto', 'Changement huile moteur', 'Changement filtres (huile, air)',
    'Réglage carburateur', 'Nettoyage carburateur', 'Remplacement carburateur',
    'Réglage injection', 'Diagnostic injection', 'Remplacement injecteurs',
    'Réglage allumage', 'Remplacement bougies', 'Remplacement bobine allumage',
    'Réglage soupapes', 'Remplacement segments', 'Révision moteur complète',

    // Transmission moto
    'Réglage embrayage', 'Remplacement disque embrayage', 'Remplacement câble embrayage',
    'Réglage chaîne', 'Remplacement chaîne', 'Remplacement pignon',
    'Réglage courroie', 'Remplacement courroie', 'Réglage variateur',
    'Remplacement couronne', 'Réglage transmission',

    // Freinage moto
    'Réglage freins', 'Remplacement plaquettes frein', 'Remplacement disques frein',
    'Purge circuit freinage', 'Remplacement liquide frein', 'Réglage frein arrière',
    'Remplacement câble frein', 'Réglage ABS moto',

    // Suspension moto
    'Réglage suspension avant', 'Réglage suspension arrière', 'Remplacement amortisseurs',
    'Réglage précharge', 'Remplacement ressorts', 'Réglage géométrie',

    // Pneumatiques moto
    'Montage pneus moto', 'Équilibrage roues moto', 'Réparation crevaison',
    'Remplacement chambre à air', 'Réglage pression pneus',

    // Électricité moto
    'Diagnostic électrique', 'Remplacement batterie', 'Réglage alternateur',
    'Remplacement démarreur', 'Réparation faisceau', 'Installation éclairage LED',
    'Installation alarme', 'Installation GPS moto',

    // Carrosserie moto
    'Réparation carénage', 'Peinture carénage', 'Remplacement phares',
    'Réparation garde-boue', 'Installation accessoires', 'Personnalisation',

    // Spécialités tricycles
    'Réglage direction tricycle', 'Réglage suspension tricycle', 'Remplacement roues tricycle',
    'Installation coffre tricycle', 'Réglage équilibrage tricycle',

    // Dépannage spécialisé
    'Dépannage moto sur route', 'Remorquage moto', 'Démarrage batterie moto',
    'Dépannage carburateur', 'Dépannage injection', 'Dépannage électrique',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Spécialités du garage moto
  specialites_moto: [
    'Toutes marques motos', 'Marques japonaises motos', 'Marques chinoises motos',
    'Marques indiennes motos', 'Marques européennes motos', 'Motos de course',
    'Motos custom', 'Motos trail/enduro', 'Motos sportives', 'Motos routières',
    'Scooters', 'Cyclomoteurs', 'Tricycles', 'Quadricycles', 'Motos anciennes',
    'Motos électriques', 'Motos hybrides', 'Tuning motos', 'Préparation course',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques de motos traitées (focus Afrique)
  marques_motos: [
    // Japonaises (très populaires en Afrique)
    'Yamaha', 'Honda', 'Suzuki', 'Kawasaki', 'Ducati',

    // Chinoises (en forte croissance en Afrique)
    'Bajaj', 'TVS', 'Hero', 'Royal Enfield', 'Mahindra',
    'Lifan', 'Zongshen', 'Qingqi', 'Jialing', 'Dayun',

    // Européennes
    'BMW Motorrad', 'KTM', 'Aprilia', 'Piaggio', 'Vespa',
    'Benelli', 'MV Agusta', 'Triumph', 'Husqvarna',

    // Américaines
    'Harley-Davidson', 'Indian', 'Buell',

    // Autres asiatiques
    'Hyosung', 'SYM', 'Kymco', 'Keeway',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de motos/tricycles traités
  types_motos: [
    'Moto sportive', 'Moto routière', 'Moto trail', 'Moto enduro',
    'Moto custom', 'Moto naked', 'Moto touring', 'Moto de course',
    'Scooter', 'Cyclomoteur', 'Tricycle', 'Quadricycle',
    'Moto électrique', 'Moto hybride', 'Moto ancienne',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Cylindrées spécialisées motos
  cylindrees_motos: [
    '50cc', '80cc', '100cc', '110cc', '125cc', '150cc',
    '200cc', '250cc', '300cc', '400cc', '500cc', '600cc',
    '750cc', '800cc', '900cc', '1000cc', '1100cc', '1200cc',
    '1300cc', '1400cc', '1600cc', '1800cc', '2000cc+',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Certifications spécialisées motos
  certifications_moto: [
    'Mécanicien agréé constructeur moto', 'CAP/BEP Mécanique moto',
    'BTS Maintenance motocycles', 'Formation Yamaha', 'Formation Honda',
    'Formation Suzuki', 'Formation Bajaj', 'Formation TVS',
    'Certification diagnostic électronique moto', 'Expert carburation',
    'Expert injection moto', 'Expert transmission moto', 'Expert électrique moto',
    'Expert suspension moto', 'Expert pneumatiques moto', 'Expert tuning moto',
    'Sans certification (expérience terrain)', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements spécialisés garage moto
  equipements_moto: [
    'Pont élévateur moto', 'Béquille centrale', 'Béquille latérale',
    'Valise diagnostic moto', 'Appareil équilibrage roues moto',
    'Démonte-pneus moto', 'Compresseur moto', 'Poste soudure moto',
    'Cabine peinture moto', 'Banc de test moteur', 'Dynamomètre moto',
    'Station recharge batterie moto', 'Nettoyeur haute pression',
    'Aspirateur industriel', 'Outillage spécialisé moto',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Pièces détachées spécialisées
  pieces_detachees_moto: [
    'Carburateurs', 'Injecteurs', 'Bougies', 'Filtres à air', 'Filtres à huile',
    'Chaînes', 'Pignons', 'Couronnes', 'Courroies', 'Variateurs',
    'Plaquettes de frein', 'Disques de frein', 'Liquide de frein',
    'Amortisseurs', 'Ressorts', 'Pneus moto', 'Chambres à air',
    'Batteries moto', 'Alternateurs', 'Démarreurs', 'Bougies d\'allumage',
    'Carénages', 'Phares', 'Garde-boue', 'Selles', 'Guidons',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Services complémentaires spécialisés
  services_complementaires_moto: [
    'Vente pièces détachées moto', 'Pièces d\'origine constructeur',
    'Pièces adaptables moto', 'Pièces d\'occasion garanties',
    'Lavage moto', 'Nettoyage moto complet', 'Polissage carénage',
    'Traitement anti-rouille', 'Contrôle avant achat moto',
    'Expertise après accident moto', 'Devis gratuit', 'Garantie réparations',
    'Moto de courtoisie', 'Enlèvement moto en panne', 'Carte fidélité',
    'Installation accessoires', 'Personnalisation moto', 'Tuning moto',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Modes de paiement spécialisés
  modes_paiement_moto: [
    'Espèces', 'Mobile Money (MTN, Orange, etc.)', 'Virement bancaire',
    'Chèque', 'Carte bancaire', 'Paiement en plusieurs fois',
    'Facilités de paiement', 'Échange moto', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Horaires spécialisés
  horaires_moto: [
    'Lundi-Vendredi 8h-18h', 'Lundi-Samedi 8h-18h',
    'Lundi-Dimanche 8h-18h', 'Service 24h/24',
    'Dépannage 24h/24', 'Sur rendez-vous uniquement',
    'Sans rendez-vous', 'Horaires flexibles',
    'Ouvert week-end', '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Délais d'intervention spécialisés
  delais_moto: [
    'Intervention immédiate', 'Même jour', 'Sous 24h',
    'Sous 48h', 'Sous 1 semaine', 'Sur devis',
    'Selon disponibilité pièces', 'Urgence moto',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Zone d'intervention
  zone_intervention_moto: genererZonesIntervention('CM'),

  // Villes principales
  villes_moto: genererToutesLesVilles('CM'),

  // Quartiers (Douala, Yaoundé, etc.)
  quartiers_moto: genererQuartiersPays('CM'),

  // Langues parlées
  langues_moto: [
    'Français', 'Anglais', 'Pidgin', 'Fulfuldé',
    'Ewondo', 'Douala', 'Bamiléké', 'Bassa',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Prestations d'urgence spécialisées
  urgence_moto: [
    'Oui - Dépannage moto 24h/24', 'Oui - Dépannage jour uniquement',
    'Non - Sur rendez-vous uniquement', 'Urgence moto uniquement',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS FRIGORISTE / RÉPARATEUR FRIGO & CONGÉLATEUR - SPÉCIALISÉ AFRIQUE
export const FRIGORISTE_MODALITIES: ModalityCategory = {
  // Types de prestations frigoriste
  types_service_frigoriste: [
    // Diagnostic & Dépannage
    'Diagnostic panne réfrigérateur', 'Diagnostic congélateur',
    'Dépannage urgence frigo', 'Dépannage urgence congélateur',
    'Réparation frigo à domicile', 'Réparation congélateur à domicile',
    'Dépannage 24h/24', 'Intervention rapide',

    // Réparations circuit frigorifique
    'Recharge gaz réfrigérant', 'Recharge gaz R134a', 'Recharge gaz R404a', 'Recharge gaz R600a',
    'Détection fuite gaz', 'Réparation fuite circuit', 'Soudure circuit frigorifique',
    'Remplacement filtre déshydrateur', 'Nettoyage circuit frigorifique',
    'Vidange circuit', 'Tirage au vide circuit', 'Test étanchéité circuit',

    // Réparations compresseur
    'Diagnostic compresseur', 'Remplacement compresseur',
    'Réparation compresseur', 'Test compresseur',
    'Remplacement relais compresseur', 'Remplacement condensateur compresseur',

    // Système électrique
    'Réparation thermostat', 'Remplacement thermostat mécanique',
    'Remplacement thermostat électronique', 'Réglage thermostat',
    'Réparation carte électronique', 'Remplacement carte électronique',
    'Réparation timer / minuterie', 'Remplacement résistance dégivrage',
    'Réparation éclairage intérieur', 'Remplacement ampoule LED frigo',
    'Réparation prise de courant', 'Test continuité électrique',

    // Système de refroidissement
    'Réparation évaporateur', 'Nettoyage évaporateur',
    'Dégivrage manuel évaporateur', 'Remplacement ventilateur évaporateur',
    'Réparation condenseur', 'Nettoyage condenseur',
    'Remplacement ventilateur condenseur', 'Réparation capillaire bouché',

    // Joints & Étanchéité
    'Remplacement joint de porte', 'Réparation joint magnétique',
    'Réglage porte frigo', 'Réparation charnières',
    'Remplacement poignée de porte', 'Réglage niveau frigo',

    // Systèmes spéciaux
    'Réparation système No Frost', 'Réparation dégivrage automatique',
    'Réparation distributeur eau/glaçons', 'Réparation machine à glaçons',
    'Réparation afficheur digital', 'Réparation alarme porte ouverte',

    // Entretien & Maintenance
    'Entretien préventif réfrigérateur', 'Nettoyage complet frigo',
    'Désinfection circuit d\'eau', 'Nettoyage bac récupérateur',
    'Contrôle général frigorifique', 'Maintenance préventive',

    // Installations
    'Installation frigo neuf', 'Installation congélateur',
    'Déplacement réfrigérateur', 'Mise en service frigo',
    'Raccordement électrique', 'Mise à niveau frigo',

    // Spécialités africaines
    'Adaptation voltage (110V/220V)', 'Installation stabilisateur tension',
    'Protection contre coupures électriques', 'Conversion gaz écologique',
    'Réparation frigo coupure prolongée', 'Remise en service après stockage',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques de réfrigérateurs/congélateurs (focus Afrique + International)
  marques_frigos: [
    // ═══════ MARQUES AFRICAINES & TRÈS POPULAIRES EN AFRIQUE ═══════

    // Chinoises (dominantes en Afrique francophone)
    'Hisense', 'Haier', 'TCL', 'Chigo', 'Midea', 'Gree', 'Changhong',
    'Konka', 'Skyworth', 'Armco', 'Von Hotpoint', 'Nasco', 'Bruhm',
    'Nikai', 'Solstar', 'Syinix', 'Zara',

    // Coréennes (très présentes)
    'Samsung', 'LG', 'Daewoo',

    // Japonaises
    'Panasonic', 'Toshiba', 'Sharp', 'Hitachi', 'Mitsubishi Electric', 'Sanyo',

    // Européennes
    'Bosch', 'Siemens', 'Beko', 'Whirlpool', 'Indesit', 'Ariston', 'Hotpoint',
    'Candy', 'Electrolux', 'AEG', 'Liebherr', 'Miele', 'Zanussi', 'Smeg',

    // Américaines
    'General Electric (GE)', 'Frigidaire', 'Maytag', 'Amana', 'KitchenAid',

    // Turques (en expansion en Afrique)
    'Vestel', 'Arçelik', 'Altus', 'Beko',

    // Autres asiatiques
    'Godrej (Inde)', 'Videocon', 'Blue Star', 'Orient',

    // Marques locales africaines
    'Binatone', 'Restpoint', 'Scanfrost', 'Polystar', 'Thermocool',

    // Anciennes marques encore en service
    'Fagor', 'Thomson', 'Brandt', 'Vedette', 'Arthur Martin', 'Rosières',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Modèles populaires par marque (focus marques dominantes en Afrique)
  modeles_frigos: [
    // ═══ SAMSUNG ═══
    'Samsung RT', 'Samsung RS (Side-by-Side)', 'Samsung RF (French Door)',
    'Samsung RB', 'Samsung RZ (Congélateur)', 'Samsung RT38', 'Samsung RT46',
    'Samsung RS67', 'Samsung RF56', 'Samsung RB29', 'Samsung Family Hub',

    // ═══ LG ═══
    'LG InstaView', 'LG Door-in-Door', 'LG GC', 'LG GM', 'LG GN', 'LG GB',
    'LG GC-B247', 'LG GN-B222', 'LG GM-B844', 'LG Side-by-Side',
    'LG Smart ThinQ', 'LG Linear Compressor',

    // ═══ HISENSE (TRÈS POPULAIRE AFRIQUE) ═══
    'Hisense REF', 'Hisense RD', 'Hisense RS', 'Hisense RT',
    'Hisense REF-18', 'Hisense REF-25', 'Hisense RD-35', 'Hisense RS-62',
    'Hisense No Frost', 'Hisense Double Door', 'Hisense Single Door',

    // ═══ HAIER ═══
    'Haier HRF', 'Haier HB', 'Haier HSR', 'Haier HCR',
    'Haier French Door', 'Haier Thermocool', 'Haier Inverter',

    // ═══ TCL ═══
    'TCL P', 'TCL S', 'TCL 250L', 'TCL 350L', 'TCL Double Door',

    // ═══ MIDEA ═══
    'Midea HS', 'Midea HD', 'Midea HT', 'Midea No Frost',

    // ═══ BOSCH ═══
    'Bosch Serie 2', 'Bosch Serie 4', 'Bosch Serie 6', 'Bosch Serie 8',
    'Bosch KGN', 'Bosch KGV', 'Bosch KAN', 'Bosch VitaFresh',

    // ═══ WHIRLPOOL ═══
    'Whirlpool WRF', 'Whirlpool WRS', 'Whirlpool WRT',
    'Whirlpool 6th Sense', 'Whirlpool No Frost',

    // ═══ BEKO ═══
    'Beko RCNA', 'Beko RCNE', 'Beko RDSA', 'Beko ProSmart Inverter',
    'Beko NeoFrost', 'Beko HarvestFresh',

    // ═══ PANASONIC ═══
    'Panasonic NR', 'Panasonic Econavi', 'Panasonic Prime Fresh',

    // ═══ NASCO (POPULAIRE AFRIQUE DE L\'OUEST) ═══
    'Nasco NAS', 'Nasco 120L', 'Nasco 160L', 'Nasco 200L', 'Nasco 350L',

    // ═══ BRUHM (AFRIQUE) ═══
    'Bruhm BRF', 'Bruhm BCD', 'Bruhm 90L', 'Bruhm 120L', 'Bruhm 160L',
    'Bruhm 200L', 'Bruhm 350L', 'Bruhm 420L',

    // ═══ ARMCO (AFRIQUE) ═══
    'Armco ARF', 'Armco 120L', 'Armco 160L', 'Armco 200L', 'Armco 350L',

    // ═══ CHIGO ═══
    'Chigo BCD', 'Chigo 180L', 'Chigo 220L', 'Chigo 300L',

    '\uD83C\uDD95 Autre modèle (ajouter)'
  ],

  // Types d'appareils frigorifiques
  types_appareils: [
    // Réfrigérateurs domestiques
    'Réfrigérateur simple porte (Top)', 'Réfrigérateur double porte',
    'Réfrigérateur américain (Side-by-Side)', 'Réfrigérateur French Door (3-4 portes)',
    'Réfrigérateur Multi-Door', 'Réfrigérateur encastrable',
    'Réfrigérateur mini-bar', 'Réfrigérateur compact (< 100L)',
    'Réfrigérateur table-top',

    // Congélateurs
    'Congélateur armoire (vertical)', 'Congélateur coffre (horizontal)',
    'Congélateur petit format', 'Congélateur professionnel',
    'Conservateur de glaces', 'Chambre froide domestique',

    // Combos
    'Réfrigérateur-Congélateur (2 compresseurs)', 'Réfrigérateur-Congélateur (1 compresseur)',
    'Réfrigérateur avec distributeur eau', 'Réfrigérateur avec machine à glaçons',
    'Réfrigérateur avec distributeur eau & glaçons',

    // Technologies spéciales
    'Réfrigérateur No Frost', 'Réfrigérateur Inverter',
    'Réfrigérateur Smart / Connecté', 'Réfrigérateur à froid ventilé',
    'Réfrigérateur à froid statique', 'Réfrigérateur à froid brassé',

    // Professionnels
    'Vitrine réfrigérée (boutique)', 'Armoire réfrigérée (restaurant)',
    'Chambre froide commerciale', 'Congélateur vitrine',
    'Glacière professionnelle', 'Présentoir réfrigéré',
    'Meuble frigorifique bar', 'Cave à vin',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Capacités / Volumes
  capacites: [
    'Très petit (< 100L)', 'Petit (100-150L)', 'Moyen (150-250L)',
    'Grand (250-350L)', 'Très grand (350-500L)', 'XXL (500-700L)',
    'Professionnel (> 700L)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de pannes courantes
  types_pannes: [
    // Pannes frigorifiques
    'Frigo ne refroidit pas', 'Frigo ne refroidit plus du tout',
    'Frigo refroidit trop (givre excessif)', 'Frigo refroidit peu (tiède)',
    'Congélateur ne congèle pas', 'Givre excessif dans congélateur',
    'Dégivrage automatique ne fonctionne pas',

    // Pannes électriques
    'Frigo ne s\'allume pas', 'Frigo s\'éteint tout seul',
    'Prise de courant défectueuse', 'Court-circuit électrique',
    'Éclairage intérieur ne fonctionne pas', 'Afficheur digital éteint',
    'Afficheur digital affiche erreur', 'Carte électronique grillée',
    'Thermostat ne fonctionne pas', 'Thermostat bloqué',

    // Pannes compresseur
    'Compresseur ne démarre pas', 'Compresseur tourne en continu',
    'Compresseur fait du bruit', 'Compresseur surchauffe',
    'Compresseur grillé', 'Relais compresseur défectueux',

    // Pannes circuit frigorifique
    'Fuite de gaz réfrigérant', 'Manque de gaz', 'Gaz épuisé',
    'Circuit frigorifique bouché', 'Capillaire bouché',
    'Évaporateur givré bloqué', 'Condenseur encrassé',
    'Filtre déshydrateur saturé',

    // Pannes ventilation
    'Ventilateur évaporateur ne tourne pas', 'Ventilateur condenseur en panne',
    'Ventilateur fait du bruit', 'Moteur ventilateur grillé',

    // Pannes étanchéité & joints
    'Joint de porte défectueux', 'Porte ne ferme pas bien',
    'Aimant porte usé', 'Charnières cassées',
    'Poignée de porte cassée',

    // Pannes système eau/glaçons
    'Distributeur d\'eau ne fonctionne pas', 'Machine à glaçons en panne',
    'Fuite d\'eau dans frigo', 'Gouttes d\'eau dans bac',
    'Tuyau d\'eau bouché', 'Filtre à eau saturé',

    // Autres pannes
    'Alarme porte ouverte sonne en continu', 'Frigo fait du bruit anormal',
    'Vibrations excessives', 'Odeur désagréable',
    'Condensation excessive à l\'extérieur', 'Eau sous le frigo',
    'Bac récupérateur déborde', 'Thermostat déréglé',

    '\uD83C\uDD95 Autre panne (ajouter)'
  ],

  // Gaz réfrigérants utilisés
  gaz_refrigerants: [
    'R134a (HFC - standard froid domestique)',
    'R600a (Isobutane - écologique)',
    'R404a (HFC - froid commercial)',
    'R410a (HFC - climatisation)',
    'R22 (HCFC - ancien, interdit)',
    'R32 (HFC - nouvelle génération)',
    'R290 (Propane - écologique)',
    'R407C (HFC - remplacement R22)',
    '\uD83C\uDD95 Autre gaz (ajouter)'
  ],

  // Pièces détachées courantes
  pieces_detachees_frigo: [
    // Compresseur & circuit
    'Compresseur hermétique', 'Relais compresseur', 'Condensateur compresseur',
    'Thermostat mécanique', 'Thermostat électronique', 'Sonde de température',
    'Filtre déshydrateur', 'Capillaire', 'Détendeur',
    'Évaporateur', 'Condenseur', 'Ventilateur évaporateur', 'Ventilateur condenseur',

    // Électronique
    'Carte électronique principale', 'Carte afficheur', 'Transformateur',
    'Timer / Minuterie', 'Résistance de dégivrage', 'Thermostat de dégivrage',
    'Fusible thermique', 'Ampoule LED intérieure',

    // Joints & portes
    'Joint de porte magnétique', 'Charnières de porte', 'Poignée de porte',
    'Bac à légumes', 'Clayette en verre', 'Balconnet de porte',
    'Bouchon trou dégivrage', 'Bac récupérateur d\'eau',

    // Système eau/glaçons
    'Filtre à eau', 'Électrovanne eau', 'Tuyau d\'alimentation eau',
    'Bac à glaçons', 'Moteur machine à glaçons', 'Distributeur eau',

    // Accessoires
    'Stabilisateur de tension', 'Rallonge électrique renforcée',
    'Kit anti-vibration', 'Pied réglable', 'Grille condenseur',

    '\uD83C\uDD95 Autre pièce (ajouter)'
  ],

  // Spécialités du frigoriste
  specialites_frigoriste: [
    'Toutes marques réfrigérateurs', 'Toutes marques congélateurs',
    'Marques coréennes (Samsung, LG)', 'Marques chinoises (Hisense, Haier, TCL)',
    'Marques européennes (Bosch, Beko, Whirlpool)', 'Marques japonaises',
    'Réfrigérateurs domestiques uniquement', 'Congélateurs uniquement',
    'Réfrigérateurs professionnels', 'Vitrines réfrigérées',
    'Chambres froides', 'Climatisation + Froid',
    'Réfrigérateurs No Frost', 'Réfrigérateurs Inverter',
    'Réfrigérateurs américains (Side-by-Side)', 'Anciens modèles (> 15 ans)',
    'Modèles récents (< 5 ans)', 'Frigos avec distributeur eau/glaçons',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Certifications & qualifications
  certifications_frigoriste: [
    'CAP/BEP Froid et Climatisation', 'Bac Pro TFCA (Technicien Froid Climatisation Automatisme)',
    'BTS Fluides Énergies Domotique option Froid et Climatisation',
    'Licence professionnelle Froid et Climatisation',
    'Attestation manipulation fluides frigorigènes (obligatoire)',
    'Certification Qualiclimafroid', 'Certification F-Gas (Europe)',
    'Formation constructeur Samsung', 'Formation constructeur LG',
    'Formation constructeur Hisense', 'Formation constructeur Bosch',
    'Habilitation électrique (BR/BC)',
    'Expert diagnostic électronique frigo', 'Expert circuit frigorifique',
    'Expert No Frost', 'Expert gaz écologiques (R600a, R290)',
    'Sans certification (expérience terrain)', 'Formation en cours',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements & outillage frigoriste
  equipements_frigoriste: [
    // Équipements circuit frigorifique
    'Groupe de manomètres 4 voies', 'Détecteur de fuite électronique',
    'Détecteur de fuite UV', 'Station de récupération gaz',
    'Pompe à vide frigorifique', 'Balance électronique réfrigérant',
    'Bouteilles gaz réfrigérant (R134a, R600a, etc.)', 'Kit de soudure oxyacétylène',
    'Poste soudure TIG (cuivre)', 'Détendeurs gaz', 'Flexible de charge',
    'Cintreuse tube cuivre', 'Coupe-tube', 'Dudgeonnière',

    // Équipements électroniques
    'Multimètre digital', 'Pince ampèremétrique', 'Thermomètre infrarouge',
    'Thermomètre sonde digitale', 'Testeur de continuité', 'Testeur de relais',
    'Testeur de condensateur', 'Testeur de carte électronique',
    'Valise diagnostic électronique', 'Hygromètre (humidité)',

    // Outillage général
    'Jeu de clés plates et à pipe', 'Jeu de tournevis', 'Pince multiprise',
    'Pince coupante', 'Pince à dénuder', 'Clé dynamométrique',
    'Perceuse', 'Visseuse', 'Aspirateur de service', 'Lampe torche LED',

    // Équipements de sécurité
    'Lunettes de protection', 'Gants anti-froid', 'Masque respiratoire',
    'Détecteur gaz combustible', 'Extincteur CO2',

    // Équipements déplacement
    'Diable de transport frigo', 'Sangles de levage', 'Ventouse porte-vitres',
    'Chariot roulant', 'Couvertures de protection',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Services complémentaires
  services_complementaires_frigoriste: [
    'Vente pièces détachées frigo', 'Pièces d\'origine constructeur',
    'Pièces compatibles garanties', 'Pièces d\'occasion testées',
    'Devis gratuit à domicile', 'Déplacement gratuit (périmètre)',
    'Diagnostic gratuit', 'Conseil achat frigo neuf',
    'Installation frigo neuf', 'Mise en service + garantie',
    'Déplacement et réinstallation frigo', 'Enlèvement ancien frigo',
    'Recyclage gaz et composants', 'Conversion gaz écologique',
    'Entretien préventif annuel', 'Contrat maintenance',
    'Désinfection complète circuit', 'Nettoyage professionnel',
    'Garantie réparations (3 mois - 1 an)', 'Suivi après réparation',
    'Dépannage urgence 24h/24', 'Intervention week-end & jours fériés',
    'Paiement après réparation', 'Facilités de paiement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Disponibilités
  disponibilites_frigoriste: [
    'Urgence 24h/24 - 7j/7', 'Intervention rapide (< 2h)',
    'Rendez-vous sous 24h', 'Rendez-vous sous 48h',
    'Rendez-vous planifié', 'Lundi-Vendredi (8h-18h)',
    'Lundi-Samedi (8h-20h)', 'Dimanche & jours fériés',
    'Dépannage nuit (majoration)', 'Intervention week-end',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Délais d'intervention
  delais_intervention_frigoriste: [
    'Intervention immédiate (< 1h)', 'Intervention rapide (< 2h)',
    'Même jour', 'Sous 24h', 'Sous 48h',
    'Sous 1 semaine', 'Selon disponibilité pièces',
    'Sur devis après diagnostic', 'Urgence frigo uniquement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Garanties
  garanties_frigoriste: [
    '1 mois', '3 mois', '6 mois', '1 an', '2 ans',
    'Garantie pièces uniquement', 'Garantie main d\'œuvre uniquement',
    'Garantie totale (pièces + main d\'œuvre)', 'Garantie compresseur 2 ans',
    'Garantie gaz 6 mois', 'Sans garantie (occasion/réparation provisoire)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Tarification
  tarifs_types: [
    'Déplacement gratuit + diagnostic gratuit', 'Déplacement payant (à déduire si réparation)',
    'Diagnostic payant', 'Forfait diagnostic + petite réparation',
    'Tarif à l\'heure', 'Tarif forfaitaire par panne',
    'Devis sur mesure', 'Tarif nuit/week-end (majoration)',
    'Tarif urgence (majoration)', 'Tarif négociable',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Modes de paiement
  modes_paiement_frigoriste: [
    'Espèces', 'Mobile Money (MTN, Orange, Moov, etc.)',
    'Virement bancaire', 'Chèque', 'Carte bancaire',
    'Paiement en plusieurs fois', 'Paiement après réparation',
    'Paiement à la livraison pièce', 'Facilités de paiement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Zone d'intervention (système intelligent africain)
  zones_intervention_frigoriste: genererZonesIntervention('CM'), // S'adapte au pays utilisateur

  // Villes principales
  villes_frigoriste: genererToutesLesVilles('CM'),

  // Quartiers
  quartiers_frigoriste: genererQuartiersPays('CM'),

  // Langues parlées
  langues_frigoriste: [
    'Français', 'Anglais', 'Pidgin', 'Fulfuldé',
    'Ewondo', 'Douala', 'Bamiléké', 'Bassa',
    'Arabe', 'Lingala', 'Wolof', 'Dioula',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Expérience professionnelle
  experience_annees: [
    'Moins de 1 an', '1-2 ans', '3-5 ans', '6-10 ans',
    '11-15 ans', '16-20 ans', 'Plus de 20 ans',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Type de clientèle
  type_clientele: [
    'Particuliers uniquement', 'Professionnels uniquement',
    'Particuliers + Professionnels', 'Hôtels & Restaurants',
    'Commerces & Supermarchés', 'Hôpitaux & Cliniques',
    'Écoles & Universités', 'Entreprises', 'Collectivités',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Prestations d'urgence
  urgence_frigoriste: [
    'Oui - Dépannage frigo 24h/24', 'Oui - Dépannage jour uniquement (6h-22h)',
    'Oui - Dépannage sur rendez-vous rapide', 'Non - Sur rendez-vous uniquement',
    'Urgence commerciale/restaurant prioritaire', 'Urgence médicale prioritaire',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS RÉPARATEUR ÉLECTRONIQUE (TV, RADIO, AUDIO, VIDÉO) - SPÉCIALISÉ AFRIQUE
export const REPARATEUR_ELECTRONIQUE_MODALITIES: ModalityCategory = {
  // Types de prestations réparateur électronique
  types_service_electronique: [
    // Diagnostic & Dépannage TV
    'Diagnostic panne TV', 'Diagnostic écran TV',
    'Dépannage urgence TV', 'Réparation TV à domicile',
    'Dépannage 24h/24 électronique', 'Intervention rapide TV',

    // Réparations écran TV
    'Réparation écran TV LED', 'Réparation écran TV OLED',
    'Réparation écran TV LCD', 'Réparation écran TV Plasma',
    'Remplacement dalle TV', 'Réparation écran cassé',
    'Réparation rétro-éclairage TV', 'Réparation pixels morts',

    // Réparations électroniques TV
    'Réparation carte mère TV', 'Réparation carte d\'alimentation',
    'Réparation carte T-CON', 'Réparation carte contrôle',
    'Réparation carte tuner TV', 'Réparation port HDMI',
    'Réparation port USB TV', 'Réparation prise péritel',
    'Réparation connectique TV', 'Réparation alimentation TV',

    // Problèmes image & son TV
    'Réparation image TV (lignes verticales)', 'Réparation image floue',
    'Réparation image saccadée', 'Réparation écran noir',
    'Réparation son TV', 'Réparation haut-parleurs TV',
    'Réparation audio/vidéo désynchronisé', 'Réparation pas de son',

    // Smart TV & Logiciels
    'Configuration Smart TV', 'Installation applications TV',
    'Réparation Wi-Fi TV', 'Réparation Bluetooth TV',
    'Mise à jour firmware TV', 'Réinitialisation Smart TV',
    'Configuration réseau TV', 'Déblocage Smart TV',

    // Home Cinéma & Audio
    'Installation home cinéma', 'Réparation home cinéma',
    'Réparation barre de son', 'Réparation amplificateur',
    'Réparation enceinte', 'Réparation subwoofer',
    'Câblage système audio', 'Optimisation son home cinéma',

    // Décodeurs & Accessoires
    'Installation décodeur satellite', 'Réparation décodeur CANAL+',
    'Réparation décodeur TNT', 'Configuration parabole',
    'Orientation antenne satellite', 'Réparation récepteur satellite',
    'Programmation télécommande', 'Réparation télécommande TV',

    // Radio & Audio classique
    'Réparation radio FM', 'Réparation radio transistor',
    'Réparation poste radio', 'Réparation chaîne Hi-Fi',
    'Réparation lecteur CD', 'Réparation platine vinyle',
    'Réparation magnétophone', 'Réparation cassette audio',

    // Lecteurs & Enregistreurs
    'Réparation lecteur DVD', 'Réparation lecteur Blu-ray',
    'Réparation décodeur', 'Réparation enregistreur numérique',
    'Réparation magnétoscope', 'Réparation lecteur USB',

    // Projecteurs & Vidéoprojecteurs
    'Réparation vidéoprojecteur', 'Remplacement lampe projecteur',
    'Réparation objectif projecteur', 'Nettoyage optique projecteur',
    'Réparation écran de projection', 'Installation vidéoprojecteur',

    // Caméras & Surveillance
    'Installation caméra surveillance', 'Réparation système vidéosurveillance',
    'Configuration DVR/NVR', 'Réparation caméra IP',
    'Installation interphone vidéo', 'Réparation portier vidéo',

    // Services annexes
    'Support mural TV', 'Installation antenne TV',
    'Câblage professionnel', 'Réglage image TV',
    'Calibration couleurs TV', 'Entretien préventif équipement audio/vidéo',
    'Consultation achat TV', 'Devis gratuit réparation',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Marques de TV (focus Afrique + International)
  marques_tv: [
    // Marques dominantes Afrique (chinoises)
    'Hisense', 'TCL', 'Haier', 'Skyworth', 'Changhong', 'Konka',
    'Midea', 'Chigo', 'Nasco', 'Bruhm', 'Nikai', 'Solstar',
    'Syinix', 'Vitron', 'Vision Plus', 'Polystar', 'Armco',
    'Von Hotpoint', 'Ramtons', 'Mika', 'Nobel', 'Amtec',

    // Marques coréennes
    'Samsung', 'LG', 'Daewoo',

    // Marques japonaises
    'Sony', 'Panasonic', 'Toshiba', 'Sharp', 'Hitachi',
    'JVC', 'Pioneer', 'Aiwa', 'Sanyo', 'Mitsubishi Electric',

    // Marques européennes
    'Philips', 'Grundig', 'Thomson', 'Telefunken',
    'Blaupunkt', 'Loewe', 'Bang & Olufsen',

    // Marques américaines
    'Vizio', 'RCA', 'Insignia', 'Element',

    // Marques chinoises premium
    'Xiaomi', 'OnePlus TV', 'Realme TV', 'Oppo TV',

    // Autres
    'Toutes marques TV',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Modèles populaires TV (focus marques dominantes en Afrique)
  modeles_tv: [
    // Samsung
    'Samsung QLED', 'Samsung Neo QLED', 'Samsung The Frame',
    'Samsung Crystal UHD', 'Samsung AU', 'Samsung TU', 'Samsung RU',
    'Samsung Smart TV 32"', 'Samsung Smart TV 43"', 'Samsung Smart TV 55"',
    'Samsung Smart TV 65"', 'Samsung Smart TV 75"',

    // LG
    'LG OLED', 'LG NanoCell', 'LG UHD', 'LG Smart TV webOS',
    'LG 32LM', 'LG 43UM', 'LG 55UN', 'LG 65UN', 'LG C1', 'LG C2',
    'LG Magic Remote', 'LG ThinQ AI',

    // Hisense (très populaire Afrique)
    'Hisense ULED', 'Hisense Laser TV', 'Hisense Roku TV',
    'Hisense VIDAA', 'Hisense A6', 'Hisense A7', 'Hisense U7',
    'Hisense 32A4', 'Hisense 40A5', 'Hisense 43A6', 'Hisense 50A7',
    'Hisense 55U7', 'Hisense 65U8', 'Hisense Android TV',

    // TCL (très populaire Afrique)
    'TCL QLED', 'TCL Mini LED', 'TCL P Series', 'TCL C Series',
    'TCL Android TV', 'TCL Roku TV', 'TCL Google TV',
    'TCL 32S', 'TCL 40S', 'TCL 43P', 'TCL 50C', 'TCL 55C', 'TCL 65C',

    // Sony
    'Sony Bravia', 'Sony OLED', 'Sony X90', 'Sony X80', 'Sony A80',
    'Sony Google TV', 'Sony Android TV',

    // Nasco (populaire Afrique de l'Ouest)
    'Nasco LED', 'Nasco Smart TV', 'Nasco 32"', 'Nasco 40"',
    'Nasco 43"', 'Nasco 50"', 'Nasco 55"',

    // Bruhm (populaire Afrique)
    'Bruhm Smart TV', 'Bruhm LED', 'Bruhm 32"', 'Bruhm 43"',
    'Bruhm 50"', 'Bruhm 55"', 'Bruhm Android TV',

    // Polystar (Nigeria/Afrique)
    'Polystar Smart TV', 'Polystar LED', 'Polystar 32"',
    'Polystar 43"', 'Polystar 50"',

    // Autres modèles populaires
    'Smart TV Android', 'Smart TV Roku', 'Smart TV webOS',
    'TV LED Full HD', 'TV LED 4K UHD', 'TV LED 8K',
    'TV OLED', 'TV QLED', 'TV LCD',

    '\uD83C\uDD95 Autre modèle (ajouter)'
  ],

  // Types d'appareils électroniques
  types_appareils_electroniques: [
    // Téléviseurs
    'Téléviseur LED', 'Téléviseur OLED', 'Téléviseur QLED',
    'Téléviseur LCD', 'Téléviseur Plasma (ancien)',
    'Téléviseur tube cathodique (CRT ancien)', 'Smart TV',
    'TV 4K UHD', 'TV 8K', 'TV Full HD 1080p', 'TV HD Ready 720p',
    'TV 32 pouces', 'TV 40-43 pouces', 'TV 50-55 pouces',
    'TV 65 pouces', 'TV 75 pouces et +',

    // Systèmes audio
    'Home cinéma', 'Barre de son', 'Soundbar',
    'Système audio 5.1', 'Système audio 7.1', 'Dolby Atmos',
    'Amplificateur audio', 'Amplificateur Hi-Fi',
    'Enceinte active', 'Enceinte passive', 'Subwoofer',
    'Enceinte Bluetooth', 'Enceinte Wi-Fi', 'Enceinte multiroom',

    // Radio & Audio classique
    'Poste radio FM/AM', 'Radio transistor', 'Radio réveil',
    'Chaîne Hi-Fi', 'Micro-chaîne', 'Mini-chaîne',
    'Lecteur CD', 'Platine vinyle', 'Tourne-disque',
    'Magnétophone', 'Lecteur cassette',

    // Lecteurs & Enregistreurs
    'Lecteur DVD', 'Lecteur Blu-ray', 'Lecteur 4K Blu-ray',
    'Enregistreur numérique', 'DVR', 'Magnétoscope VHS',
    'Lecteur multimédia', 'Box multimédia',

    // Décodeurs & Récepteurs
    'Décodeur satellite', 'Décodeur CANAL+', 'Décodeur TNT',
    'Récepteur satellite', 'Décodeur numérique',
    'Android TV Box', 'Apple TV', 'Amazon Fire TV',
    'Chromecast', 'Roku',

    // Projecteurs
    'Vidéoprojecteur', 'Projecteur 4K', 'Projecteur Full HD',
    'Projecteur laser', 'Projecteur DLP', 'Projecteur LCD',
    'Écran de projection', 'Projecteur home cinéma',

    // Surveillance & Sécurité
    'Caméra surveillance', 'Caméra IP', 'Caméra analogique',
    'Système vidéosurveillance', 'DVR surveillance', 'NVR surveillance',
    'Interphone vidéo', 'Portier vidéo', 'Sonnette vidéo',

    // Accessoires
    'Antenne TV', 'Antenne parabolique', 'Antenne satellite',
    'Télécommande universelle', 'Support mural TV',
    'Câble HDMI', 'Convertisseur audio/vidéo',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Tailles écran TV
  tailles_ecran_tv: [
    'Petit (< 32 pouces)', '32 pouces', '40 pouces', '43 pouces',
    '50 pouces', '55 pouces', '65 pouces', '75 pouces',
    'Très grand (> 75 pouces)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Technologies écran
  technologies_ecran: [
    'LED', 'OLED', 'QLED', 'Mini LED', 'Micro LED',
    'LCD', 'Plasma', 'CRT (tube cathodique)',
    'NanoCell', 'Crystal UHD', 'Neo QLED',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Résolutions
  resolutions_tv: [
    'HD Ready (720p)', 'Full HD (1080p)', '4K UHD (2160p)',
    '8K UHD (4320p)', 'SD (définition standard)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Types de pannes courantes électronique
  types_pannes_electronique: [
    // Pannes écran TV
    'TV ne s\'allume pas', 'TV s\'allume puis s\'éteint',
    'Écran noir (LED allumée)', 'Écran noir complet',
    'Image saccadée', 'Image floue', 'Image double',
    'Lignes verticales écran', 'Lignes horizontales écran',
    'Taches sur l\'écran', 'Pixels morts', 'Pixels bloqués',
    'Rétro-éclairage défectueux', 'Écran trop sombre',
    'Écran clignotant', 'Écran gelé/figé',
    'Couleurs anormales', 'Écran bleu', 'Écran blanc',

    // Pannes son
    'Pas de son', 'Son faible', 'Son grésille',
    'Son coupé', 'Son désynchronisé avec image',
    'Haut-parleurs grillés', 'Distorsion audio',
    'Son sur certains canaux uniquement',

    // Pannes alimentation
    'Ne s\'allume pas', 'Coupure aléatoire', 'Redémarrage intempestif',
    'LED clignote', 'Problème d\'alimentation',
    'Surtension', 'Court-circuit',

    // Pannes connectique
    'Port HDMI ne fonctionne pas', 'Port USB HS',
    'Prise péritel défectueuse', 'Port Ethernet HS',
    'Connectique desserrée', 'Prise secteur endommagée',

    // Pannes Smart TV
    'Wi-Fi ne fonctionne pas', 'Bluetooth HS',
    'Applications ne s\'ouvrent pas', 'Smart TV lent',
    'Mise à jour bloquée', 'Problème Netflix/YouTube',
    'Écran d\'accueil gelé', 'Télécommande ne répond pas',

    // Pannes tuner/réception
    'Pas de signal', 'Chaînes disparues',
    'Tuner défectueux', 'Problème réception satellite',
    'Problème TNT', 'Image neige/parasites',

    // Home cinéma & Audio
    'Amplificateur en panne', 'Subwoofer ne fonctionne pas',
    'Enceinte muette', 'Barre de son HS',
    'Problème synchronisation audio', 'Télécommande home cinéma HS',

    // Décodeur
    'Décodeur bloqué', 'Carte satellite non reconnue',
    'Problème activation décodeur', 'Décodeur surchauffe',

    // Projecteur
    'Lampe projecteur grillée', 'Image floue projecteur',
    'Ventilateur bruyant', 'Surchauffe projecteur',
    'Pas d\'image projecteur',

    '\uD83C\uDD95 Autre panne (ajouter)'
  ],

  // Pièces détachées électronique courantes
  pieces_detachees_electronique: [
    // Cartes électroniques TV
    'Carte mère TV (Main Board)', 'Carte d\'alimentation (Power Supply)',
    'Carte T-CON', 'Carte contrôle', 'Carte tuner TV',
    'Carte Wi-Fi/Bluetooth', 'Carte inverter',

    // Écran & Dalle
    'Dalle écran LED', 'Dalle écran OLED', 'Dalle écran LCD',
    'Rétro-éclairage LED', 'Backlight LED strip',
    'Film polarisant', 'Vitre écran tactile',

    // Connectique
    'Port HDMI', 'Port USB', 'Prise péritel',
    'Connecteur VGA', 'Connecteur RCA', 'Port Ethernet',
    'Prise secteur TV', 'Câble LVDS',

    // Audio
    'Haut-parleurs TV', 'Subwoofer', 'Tweeter',
    'Membrane enceinte', 'Bobine enceinte',
    'Amplificateur audio', 'Carte son',

    // Alimentation
    'Transformateur', 'Condensateur', 'Fusible',
    'Régulateur tension', 'Bloc alimentation',
    'Câble alimentation', 'Prise secteur',

    // Mécanique & Accessoires
    'Support TV', 'Pied TV', 'Support mural',
    'Télécommande TV', 'Récepteur IR',
    'Ventilateur', 'Grille protection',

    // Projecteur
    'Lampe projecteur', 'Filtre à air projecteur',
    'Lentille objectif', 'Roue colorimétrique',

    // Décodeur & Satellite
    'Tête LNB satellite', 'Câble coaxial',
    'Splitter signal', 'Amplificateur antenne',
    'Carte décodeur',

    '\uD83C\uDD95 Autre pièce (ajouter)'
  ],

  // Spécialités du réparateur électronique
  specialites_electronique: [
    'Toutes marques TV', 'TV LED uniquement', 'TV OLED/QLED',
    'Marques coréennes (Samsung, LG)', 'Marques chinoises (Hisense, TCL)',
    'Marques japonaises (Sony, Panasonic)', 'Marques européennes',
    'Smart TV uniquement', 'TV anciennes (Plasma, CRT)',
    'Home cinéma & Audio', 'Systèmes son professionnel',
    'Décodeurs satellite', 'Vidéoprojecteurs',
    'Vidéosurveillance', 'Interphonie vidéo',
    'Réparation carte électronique (soudure)', 'Électronique micro-soudure',
    'TV grand format (> 55")', 'TV petit format (< 40")',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Certifications & qualifications
  certifications_electronique: [
    'CAP/BEP Électronique', 'Bac Pro Systèmes Électroniques',
    'BTS Électronique', 'BTS Systèmes Numériques',
    'DUT Génie Électrique', 'Licence pro Électronique',
    'Formation Samsung TV', 'Formation LG TV',
    'Formation Sony TV', 'Formation Hisense',
    'Certification technique audiovisuelle',
    'Expert micro-soudure CMS', 'Expert diagnostic carte électronique',
    'Expert Smart TV & Android TV', 'Expert home cinéma',
    'Habilitation électrique (BR/BC)',
    'Sans certification (expérience terrain)', 'Formation en cours',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Équipements & outillage réparateur électronique
  equipements_electronique: [
    // Diagnostic
    'Multimètre digital', 'Oscilloscope', 'Générateur de signaux',
    'Testeur de carte électronique', 'Testeur de dalle TV',
    'Testeur LVDS', 'Testeur backlight LED', 'Analyseur de spectre',
    'Testeur de condensateur', 'Testeur de diode',

    // Soudure
    'Station de soudage', 'Fer à souder', 'Pistolet à air chaud',
    'Station dessoudage', 'Panne micro-soudure', 'Flux soudure',
    'Étain sans plomb', 'Tresse dessoudage',

    // Outils
    'Jeu de tournevis précision', 'Pince brucelles',
    'Loupe binoculaire', 'Microscope', 'Ventouses écran',
    'Spatule ouverture', 'Pinces anti-statiques',

    // Mesure & Test
    'Testeur HDMI', 'Générateur de mire', 'Testeur signal TV',
    'Analyseur satellite', 'Mesureur de champ',
    'Caméra thermique', 'Thermomètre infrarouge',

    // Protection
    'Bracelet anti-statique', 'Tapis anti-statique',
    'Gants ESD', 'Lunettes protection',

    // Divers
    'Alimentations de laboratoire', 'Transformateurs variables',
    'Boîte composants (condensateurs, résistances)',
    'Support TV mural', 'Établi réparation',

    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Services complémentaires
  services_complementaires_electronique: [
    'Vente pièces détachées TV', 'Pièces d\'origine constructeur',
    'Pièces compatibles garanties', 'Pièces d\'occasion testées',
    'Devis gratuit à domicile', 'Déplacement gratuit (périmètre)',
    'Diagnostic gratuit', 'Conseil achat TV neuf',
    'Installation TV neuf', 'Mise en service Smart TV',
    'Configuration Smart TV', 'Installation applications',
    'Support mural TV', 'Installation antenne satellite',
    'Orientation parabole', 'Installation home cinéma',
    'Câblage audio/vidéo professionnel', 'Calibration image TV',
    'Optimisation son', 'Réglages avancés TV',
    'Installation vidéosurveillance', 'Configuration réseau TV',
    'Garantie réparations (3 mois - 1 an)', 'Suivi après réparation',
    'Dépannage urgence 24h/24', 'Intervention week-end & jours fériés',
    'Paiement après réparation', 'Facilités de paiement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Disponibilités
  disponibilites_electronique: [
    'Urgence 24h/24 - 7j/7', 'Intervention rapide (< 2h)',
    'Rendez-vous sous 24h', 'Rendez-vous sous 48h',
    'Rendez-vous planifié', 'Lundi-Vendredi (8h-18h)',
    'Lundi-Samedi (8h-20h)', 'Dimanche & jours fériés',
    'Dépannage nuit (majoration)', 'Intervention week-end',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Délais d'intervention
  delais_intervention_electronique: [
    'Intervention immédiate (< 1h)', 'Intervention rapide (< 2h)',
    'Même jour', 'Sous 24h', 'Sous 48h',
    'Sous 1 semaine', 'Selon disponibilité pièces',
    'Sur devis après diagnostic', 'Urgence TV uniquement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Garanties
  garanties_electronique: [
    '1 mois', '3 mois', '6 mois', '1 an', '2 ans',
    'Garantie pièces uniquement', 'Garantie main d\'œuvre uniquement',
    'Garantie totale (pièces + main d\'œuvre)', 'Garantie dalle 1 an',
    'Garantie carte mère 6 mois', 'Sans garantie (occasion/réparation provisoire)',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Tarification
  tarifs_types_electronique: [
    'Déplacement gratuit + diagnostic gratuit', 'Déplacement payant (à déduire si réparation)',
    'Diagnostic payant', 'Forfait diagnostic + petite réparation',
    'Tarif à l\'heure', 'Tarif forfaitaire par panne',
    'Devis sur mesure', 'Tarif nuit/week-end (majoration)',
    'Tarif urgence (majoration)', 'Tarif négociable',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Modes de paiement
  modes_paiement_electronique: [
    'Espèces', 'Mobile Money (MTN, Orange, Moov, etc.)',
    'Virement bancaire', 'Chèque', 'Carte bancaire',
    'Paiement en plusieurs fois', 'Paiement après réparation',
    'Paiement à la livraison pièce', 'Facilités de paiement',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Zone d'intervention (système intelligent africain)
  zones_intervention_electronique: genererZonesIntervention('CM'), // S'adapte au pays utilisateur

  // Villes principales
  villes_electronique: genererToutesLesVilles('CM'),

  // Quartiers
  quartiers_electronique: genererQuartiersPays('CM'),

  // Langues parlées
  langues_electronique: [
    'Français', 'Anglais', 'Pidgin', 'Fulfuldé',
    'Ewondo', 'Douala', 'Bamiléké', 'Bassa',
    'Arabe', 'Lingala', 'Wolof', 'Dioula',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Expérience professionnelle
  experience_annees_electronique: [
    'Moins de 1 an', '1-2 ans', '3-5 ans', '6-10 ans',
    '11-15 ans', '16-20 ans', 'Plus de 20 ans',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Type de clientèle
  type_clientele_electronique: [
    'Particuliers uniquement', 'Professionnels uniquement',
    'Particuliers + Professionnels', 'Hôtels & Restaurants',
    'Commerces & Bureaux', 'Salles de conférence',
    'Écoles & Universités', 'Entreprises', 'Collectivités',
    '\uD83C\uDD95 Autre (ajouter)'
  ],

  // Prestations d'urgence
  urgence_electronique: [
    'Oui - Dépannage TV 24h/24', 'Oui - Dépannage jour uniquement (6h-22h)',
    'Oui - Dépannage sur rendez-vous rapide', 'Non - Sur rendez-vous uniquement',
    'Urgence événement/entreprise prioritaire', 'Urgence hôtel/commerce prioritaire',
    '\uD83C\uDD95 Autre (ajouter)'
  ]
};

// ✅ ════════════════════════════════════════════════════════════════════════════
// \uD83E\uDE9F MENUISIER ALUMINIUM - SPÉCIALISÉ AFRIQUE FRANCOPHONE
// ✅ ════════════════════════════════════════════════════════════════════════════
// Focus: Fenêtres, portes, baies vitrées, vitrines, vérandas, façades
// Particularité Afrique: Climat tropical, ventilation, sécurité, prix accessibles
// Différenciation: vs Menuisier Bois, vs Forgeron, vs Vitrerie
// ════════════════════════════════════════════════════════════════════════════
export const MENUISIER_ALUMINIUM_MODALITIES: ModalityCategory = {
  // ✅ TYPES DE RÉALISATIONS (60+) - Classés par POPULARITÉ AFRIQUE
  typesRealisation: [
    // ═══ \uD83E\uDE9F FENÊTRES (60% des demandes) ═══
    '\uD83E\uDE9F Fenêtre coulissante (2-3 vantaux)',
    '\uD83E\uDE9F Fenêtre coulissante (4-6 vantaux)',
    '\uD83E\uDE9F Fenêtre battante (1-2 vantaux)',
    '\uD83E\uDE9F Fenêtre oscillo-battante',
    '\uD83E\uDE9F Fenêtre fixe',
    '\uD83E\uDE9F Fenêtre avec jalousie intégrée',
    '\uD83E\uDE9F Fenêtre avec moucharabieh',
    '\uD83E\uDE9F Fenêtre anti-effraction',
    '\uD83E\uDE9F Baie vitrée coulissante (grande)',
    '\uD83E\uDE9F Baie vitrée à galandage',
    '\uD83E\uDE9F Baie vitrée pliante (accordéon)',

    // ═══ \uD83D\uDEAA PORTES & PORTAILS (25% des demandes) ═══
    '\uD83D\uDEAA Porte-fenêtre coulissante',
    '\uD83D\uDEAA Porte-fenêtre battante',
    '\uD83D\uDEAA Porte d\'entrée aluminium',
    '\uD83D\uDEAA Porte vitrée (commerce)',
    '\uD83D\uDEAA Porte coulissante automatique',
    '\uD83D\uDEAA Portail aluminium coulissant',
    '\uD83D\uDEAA Portail aluminium battant',
    '\uD83D\uDEAA Portillon piéton aluminium',

    // ═══ \uD83C\uDFEA VITRINES & DEVANTURES COMMERCIALES (20%) ═══
    '\uD83C\uDFEA Vitrine de magasin complète',
    '\uD83C\uDFEA Devanture de boutique',
    '\uD83C\uDFEA Vitrine avec porte vitrée',
    '\uD83C\uDFEA Vitrine réfrigérée (cadre alu)',
    '\uD83C\uDFEA Kiosque aluminium et verre',
    '\uD83C\uDFEA Stand exposition (structure alu)',

    // ═══ \uD83C\uDFE2 FAÇADES & STRUCTURES (15%) ═══
    '\uD83C\uDFE2 Façade vitrée (mur-rideau)',
    '\uD83C\uDFE2 Habillage de façade aluminium',
    '\uD83C\uDFE2 Bardage aluminium',
    '\uD83C\uDFE2 Brise-soleil aluminium',
    '\uD83C\uDFE2 Claustra aluminium ajouré',
    '\uD83C\uDFE2 Moucharabieh aluminium',

    // ═══ \uD83C\uDF3F VÉRANDAS & PERGOLAS (10%) ═══
    '\uD83C\uDF3F Véranda aluminium et verre',
    '\uD83C\uDF3F Pergola bioclimatique alu',
    '\uD83C\uDF3F Pergola aluminium fixe',
    '\uD83C\uDF3F Abri de terrasse aluminium',
    '\uD83C\uDF3F Serre de jardin aluminium',

    // ═══ \uD83D\uDEE1️ VOLETS & PROTECTION (8%) ═══
    '\uD83D\uDEE1️ Volet roulant motorisé',
    '\uD83D\uDEE1️ Volet roulant manuel',
    '\uD83D\uDEE1️ Volet battant aluminium',
    '\uD83D\uDEE1️ Store banne (structure alu)',
    '\uD83D\uDEE1️ Pergola avec stores',

    // ═══ \uD83C\uDFE0 GARDE-CORPS & BALCONS (7%) ═══
    '\uD83C\uDFE0 Garde-corps de balcon alu',
    '\uD83C\uDFE0 Garde-corps de terrasse',
    '\uD83C\uDFE0 Rambarde d\'escalier alu',
    '\uD83C\uDFE0 Main courante aluminium',
    '\uD83C\uDFE0 Balustrade vitrée (cadre alu)',

    // ═══ \uD83D\uDEAA PORTES SPÉCIALES (5%) ═══
    '\uD83D\uDEAA Porte coupe-feu (cadre alu)',
    '\uD83D\uDEAA Porte anti-panique',
    '\uD83D\uDEAA Porte acoustique',
    '\uD83D\uDEAA Porte isotherme',

    // ═══ ⚙️ AUTRES RÉALISATIONS ═══
    '⚙️ Fenêtre de toit (Velux type)',
    '⚙️ Imposte fixe',
    '⚙️ Allège vitrée',
    '⚙️ Cloison vitrée aluminium',
    '⚙️ Séparation de bureau (alu+verre)',

    '\uD83C\uDD95 Autre réalisation (à préciser)'
  ],

  // ✅ TYPES DE PRESTATIONS (12+)
  typesPrestations: [
    '\uD83D\uDD27 Fabrication sur mesure + pose',
    '\uD83D\uDD27 Fabrication sur mesure seule',
    '\uD83D\uDD27 Installation / Pose uniquement',
    '\uD83D\uDD27 Rénovation complète (remplacement)',
    '\uD83D\uDD27 Réparation / Dépannage',
    '\uD83D\uDD27 Entretien & maintenance',
    '\uD83D\uDD27 Motorisation (volets, portails)',
    '\uD83D\uDD27 Vitrerie (remplacement verre)',
    '\uD83D\uDD27 Étanchéité & joints',
    '\uD83D\uDD27 Mise aux normes',
    '\uD83D\uDD27 Extension / Agrandissement',
    '\uD83C\uDD95 Autre prestation (à préciser)'
  ],

  // ✅ TYPES D\'ALUMINIUM (10+) - Adapté disponibilité Afrique
  typesAluminium: [
    // Standard (le plus courant en Afrique)
    '\uD83D\uDD29 Aluminium anodisé naturel',
    '\uD83D\uDD29 Aluminium anodisé couleur',
    '\uD83D\uDD29 Aluminium thermolaqué (peinture)',

    // Performance
    '\uD83D\uDD29 Aluminium à rupture de pont thermique',
    '\uD83D\uDD29 Aluminium renforcé (épaisseur +)',
    '\uD83D\uDD29 Aluminium anti-corrosion (maritime)',

    // Finitions
    '\uD83D\uDD29 Aluminium laqué RAL',
    '\uD83D\uDD29 Aluminium effet bois',
    '\uD83D\uDD29 Aluminium brossé',
    '\uD83C\uDD95 Autre type (à préciser)'
  ],

  // ✅ COULEURS ALUMINIUM (20+) - Tendances Afrique
  couleursAluminium: [
    // Classiques (80% du marché)
    '\uD83C\uDFA8 Blanc (RAL 9016)',
    '\uD83C\uDFA8 Gris anthracite (RAL 7016)',
    '\uD83C\uDFA8 Noir mat (RAL 9005)',
    '\uD83C\uDFA8 Marron (RAL 8014)',
    '\uD83C\uDFA8 Beige / Ivoire',
    '\uD83C\uDFA8 Aluminium naturel (anodisé)',

    // Tendances modernes
    '\uD83C\uDFA8 Gris clair (RAL 7035)',
    '\uD83C\uDFA8 Gris foncé (RAL 7021)',
    '\uD83C\uDFA8 Vert (RAL 6005)',
    '\uD83C\uDFA8 Bleu (RAL 5010)',

    // Effet bois (tendance)
    '\uD83C\uDFA8 Chêne doré',
    '\uD83C\uDFA8 Noyer',
    '\uD83C\uDFA8 Acajou',
    '\uD83C\uDFA8 Teck',

    // Bi-coloration
    '\uD83C\uDFA8 Blanc intérieur / Gris extérieur',
    '\uD83C\uDFA8 Blanc intérieur / Marron extérieur',
    '\uD83C\uDFA8 Sur mesure bi-couleur',

    '\uD83C\uDD95 Autre couleur RAL (à préciser)'
  ],

  // ✅ TYPES DE VITRAGE (15+)
  typesVitrage: [
    // Standard Afrique
    '\uD83E\uDE9F Simple vitrage 4mm',
    '\uD83E\uDE9F Simple vitrage 6mm',

    // Double vitrage (tendance croissante)
    '\uD83E\uDE9F Double vitrage 4/12/4',
    '\uD83E\uDE9F Double vitrage 4/16/4',
    '\uD83E\uDE9F Double vitrage phonique',
    '\uD83E\uDE9F Double vitrage anti-effraction',

    // Spécialisé
    '\uD83E\uDE9F Verre feuilleté sécurité',
    '\uD83E\uDE9F Verre trempé securit',
    '\uD83E\uDE9F Verre anti-UV',
    '\uD83E\uDE9F Verre teinté (gris, bronze)',
    '\uD83E\uDE9F Verre réfléchissant',
    '\uD83E\uDE9F Verre opaque / dépoli',
    '\uD83E\uDE9F Verre ornementé',

    // Sans vitrage
    '\uD83E\uDE9F Sans vitrage (structure seule)',
    '\uD83C\uDD95 Autre vitrage (à préciser)'
  ],

  // ✅ DIMENSIONS STANDARD (18+) - Marché africain
  dimensionsStandard: [
    // Fenêtres courantes
    '\uD83D\uDCCF 60 x 60 cm',
    '\uD83D\uDCCF 60 x 80 cm',
    '\uD83D\uDCCF 80 x 100 cm',
    '\uD83D\uDCCF 100 x 120 cm',
    '\uD83D\uDCCF 120 x 120 cm',
    '\uD83D\uDCCF 120 x 150 cm',
    '\uD83D\uDCCF 150 x 120 cm',
    '\uD83D\uDCCF 150 x 150 cm',

    // Baies vitrées
    '\uD83D\uDCCF 200 x 210 cm (2 vantaux)',
    '\uD83D\uDCCF 300 x 210 cm (3 vantaux)',
    '\uD83D\uDCCF 400 x 210 cm (4 vantaux)',
    '\uD83D\uDCCF 500 x 210 cm (5 vantaux)',
    '\uD83D\uDCCF 600 x 210 cm (6 vantaux)',

    // Portes
    '\uD83D\uDCCF 80 x 210 cm (porte standard)',
    '\uD83D\uDCCF 90 x 210 cm',
    '\uD83D\uDCCF 100 x 210 cm',

    // Vitrines
    '\uD83D\uDCCF Grande vitrine (sur mesure)',
    '\uD83D\uDCCF Sur mesure (indiquer dimensions)'
  ],

  // ✅ DÉLAIS DE RÉALISATION (8+) - Réaliste Afrique
  delaisRealisation: [
    '⚡ 3-5 jours (fenêtre standard)',
    '⚡ 1 semaine (fenêtre sur mesure)',
    '⚡ 10-15 jours (baie vitrée)',
    '⚡ 2-3 semaines (porte, vitrine)',
    '⚡ 3-4 semaines (véranda petite)',
    '⚡ 1-2 mois (façade vitrée)',
    '⚡ 2-3 mois (grosse commande)',
    '⚡ Urgent sur devis (supplément)'
  ],

  // ✅ GARANTIES (8+)
  garanties: [
    '\uD83D\uDEE1️ 10 ans (structure aluminium)',
    '\uD83D\uDEE1️ 5 ans (structure + quincaillerie)',
    '\uD83D\uDEE1️ 3 ans (structure + installation)',
    '\uD83D\uDEE1️ 2 ans (garantie standard)',
    '\uD83D\uDEE1️ 1 an (garantie minimale)',
    '\uD83D\uDEE1️ Garantie décennale (entreprise)',
    '\uD83D\uDEE1️ Garantie fabricant uniquement',
    '\uD83C\uDD95 Autre garantie (à préciser)'
  ],

  // ✅ SERVICES INCLUS (14+)
  servicesInclus: [
    '✅ Prise de mesures gratuite',
    '✅ Devis détaillé gratuit',
    '✅ Conception / Dessin technique',
    '✅ Fabrication atelier',
    '✅ Livraison sur chantier',
    '✅ Installation complète',
    '✅ Pose des joints d\'étanchéité',
    '✅ Nettoyage après pose',
    '✅ Réglage et finitions',
    '✅ SAV & retouches',
    '✅ Entretien 1ère année',
    '✅ Formation utilisation',
    '✅ Garantie décennale',
    '\uD83C\uDD95 Autre service (à préciser)'
  ],

  // ✅ OPTIONS DISPONIBLES (18+)
  optionsDisponibles: [
    // Sécurité
    '\uD83D\uDD12 Serrure multipoints',
    '\uD83D\uDD12 Serrure électrique',
    '\uD83D\uDD12 Cylindre haute sécurité',
    '\uD83D\uDD12 Grilles de protection intégrées',
    '\uD83D\uDD12 Verre feuilleté anti-effraction',

    // Confort
    '⚙️ Motorisation (volets, portes)',
    '⚙️ Télécommande',
    '⚙️ Domotique / Smart home',
    '⚙️ Détecteur d\'ouverture',

    // Ventilation (important Afrique)
    '\uD83C\uDF2C️ Jalousies intégrées',
    '\uD83C\uDF2C️ Grilles de ventilation',
    '\uD83C\uDF2C️ Moucharabieh décoratif',

    // Accessoires
    '\uD83C\uDFA8 Moustiquaire intégrée',
    '\uD83C\uDFA8 Store intégré',
    '\uD83C\uDFA8 Volet roulant',
    '\uD83C\uDFA8 Éclairage LED intégré',
    '\uD83C\uDFA8 Poignées design',
    '\uD83C\uDD95 Autre option (à préciser)'
  ],

  // ✅ ÉPAISSEUR PROFILÉS (8+)
  epaisseurProfil: [
    '\uD83D\uDCD0 40mm (entrée de gamme)',
    '\uD83D\uDCD0 50mm (standard)',
    '\uD83D\uDCD0 60mm (qualité)',
    '\uD83D\uDCD0 70mm (haute performance)',
    '\uD83D\uDCD0 80mm et + (très haute isolation)',
    '\uD83D\uDCD0 À rupture pont thermique',
    '\uD83D\uDCD0 Renforcé sécurité',
    '\uD83C\uDD95 Autre épaisseur (à préciser)'
  ],

  // ✅ TYPES D\'OUVERTURE (12+)
  typesOuverture: [
    '↔️ Coulissante (rails)',
    '↔️ Coulissante à galandage',
    '\uD83D\uDEAA Battante (1 vantail)',
    '\uD83D\uDEAA Battante (2 vantaux)',
    '\uD83E\uDE9F Oscillo-battante',
    '\uD83E\uDE9F Basculante',
    '\uD83E\uDE9F Soufflet',
    '\uD83E\uDE9F Pivotante',
    '\uD83E\uDE9F Pliante (accordéon)',
    '⚙️ Automatique (motorisée)',
    '\uD83D\uDD12 Fixe (non ouvrante)',
    '\uD83C\uDD95 Autre système (à préciser)'
  ],

  // ✅ PRIX ESTIMATIFS FCFA (20+) - Marché Cameroun/Afrique francophone
  prixEstimatifs: [
    // ═══ FENÊTRES STANDARD ═══
    '\uD83D\uDCB0 Fenêtre coulissante 2 vantaux (80x100cm) : 45.000-80.000 FCFA',
    '\uD83D\uDCB0 Fenêtre coulissante 3 vantaux (120x120cm) : 65.000-110.000 FCFA',
    '\uD83D\uDCB0 Fenêtre battante (60x80cm) : 35.000-60.000 FCFA',
    '\uD83D\uDCB0 Fenêtre fixe (100x120cm) : 30.000-50.000 FCFA',

    // ═══ BAIES VITRÉES ═══
    '\uD83D\uDCB0 Baie vitrée 2 vantaux (200x210cm) : 120.000-200.000 FCFA',
    '\uD83D\uDCB0 Baie vitrée 3 vantaux (300x210cm) : 180.000-300.000 FCFA',
    '\uD83D\uDCB0 Baie vitrée 4 vantaux (400x210cm) : 240.000-400.000 FCFA',
    '\uD83D\uDCB0 Baie vitrée à galandage : 300.000-600.000 FCFA',

    // ═══ PORTES ═══
    '\uD83D\uDCB0 Porte-fenêtre simple : 80.000-150.000 FCFA',
    '\uD83D\uDCB0 Porte d\'entrée aluminium : 100.000-250.000 FCFA',
    '\uD83D\uDCB0 Porte vitrée commerce : 120.000-300.000 FCFA',
    '\uD83D\uDCB0 Porte coulissante auto : 500.000-1.500.000 FCFA',

    // ═══ VITRINES & DEVANTURES ═══
    '\uD83D\uDCB0 Vitrine magasin simple (3m) : 200.000-400.000 FCFA',
    '\uD83D\uDCB0 Vitrine complète (6m) : 400.000-800.000 FCFA',
    '\uD83D\uDCB0 Devanture boutique complète : 600.000-1.500.000 FCFA',
    '\uD83D\uDCB0 Kiosque aluminium + verre : 300.000-800.000 FCFA',

    // ═══ VÉRANDAS & PERGOLAS ═══
    '\uD83D\uDCB0 Véranda 10m² (simple) : 800.000-1.500.000 FCFA',
    '\uD83D\uDCB0 Véranda 20m² (standard) : 1.500.000-3.000.000 FCFA',
    '\uD83D\uDCB0 Pergola aluminium 10m² : 400.000-800.000 FCFA',

    // ═══ AUTRES ═══
    '\uD83D\uDCB0 Garde-corps aluminium (mètre linéaire) : 25.000-50.000 FCFA/m',
    '\uD83D\uDCB0 Volet roulant motorisé : 80.000-200.000 FCFA'
  ],

  // ✅ CERTIFICATIONS & QUALIFICATIONS (12+)
  certifications: [
    '\uD83D\uDCDC Menuisier aluminium professionnel agréé',
    '\uD83D\uDCDC Formation fabricant (Technal, Aliplast...)',
    '\uD83D\uDCDC Certification pose menuiserie alu',
    '\uD83D\uDCDC Artisan qualifié RGE (si applicable)',
    '\uD83D\uDCDC +5 ans d\'expérience',
    '\uD83D\uDCDC +10 ans d\'expérience',
    '\uD83D\uDCDC +15 ans d\'expérience',
    '\uD83D\uDCDC +20 ans d\'expérience',
    '\uD83D\uDCDC Spécialiste vitrines commerciales',
    '\uD83D\uDCDC Spécialiste façades vitrées',
    '\uD83D\uDCDC Spécialiste vérandas',
    '\uD83C\uDD95 Autre certification (à préciser)'
  ],

  // ✅ ÉQUIPEMENTS ATELIER (14+)
  equipementsAtelier: [
    '\uD83D\uDD27 Atelier complet équipé',
    '\uD83D\uDD27 Scie à onglet aluminium',
    '\uD83D\uDD27 Perceuse à colonne',
    '\uD83D\uDD27 Fraiseuse',
    '\uD83D\uDD27 Plieuse aluminium',
    '\uD83D\uDD27 Cisaille',
    '\uD83D\uDD27 Meuleuse',
    '\uD83D\uDD27 Poste de soudure',
    '\uD83D\uDD27 Table d\'assemblage',
    '\uD83D\uDD27 Outils de mesure professionnels',
    '\uD83D\uDD27 Véhicule de livraison',
    '\uD83D\uDD27 Échafaudage & nacelle',
    '\uD83D\uDD27 Outillage pose sur chantier',
    '\uD83C\uDD95 Autre équipement (à préciser)'
  ],

  // ✅ ZONES D\'INTERVENTION (utilise système intelligent)
  zonesIntervention: genererZonesIntervention('CM'),

  // ✅ VILLES (contextualisées Afrique francophone)
  villes: genererToutesLesVilles('CM'),

  // ✅ QUARTIERS (par pays)
  quartiers: genererQuartiersPays('CM'),

  // ✅ MODES DE PAIEMENT (12+) - Adapté Afrique
  modesPaiement: [
    // Mobile Money (le PLUS important)
    '\uD83D\uDCF1 Orange Money',
    '\uD83D\uDCF1 MTN Mobile Money',
    '\uD83D\uDCF1 Moov Money',

    // Classiques
    '\uD83D\uDCB5 Espèces',
    '\uD83D\uDCB3 Carte bancaire',
    '\uD83C\uDFE6 Virement bancaire',
    '\uD83D\uDCDD Chèque',

    // Échelonné (très demandé)
    '\uD83D\uDCCA Paiement échelonné (30% - 40% - 30%)',
    '\uD83D\uDCCA Paiement en 2 fois (50% - 50%)',
    '\uD83D\uDCCA Acompte 40% + Solde à livraison',
    '\uD83D\uDCCA Acompte 50% + Solde à livraison',
    '\uD83C\uDD95 Autre mode (à préciser)'
  ],

  // ✅ TYPES DE CLIENTS (7+)
  typesClients: [
    '\uD83C\uDFE0 Particuliers (maisons, appartements)',
    '\uD83C\uDFE2 Entreprises & Bureaux',
    '\uD83C\uDFEA Commerces & Boutiques',
    '\uD83C\uDFE8 Hôtels & Restaurants',
    '\uD83C\uDFD7️ Promoteurs immobiliers',
    '\uD83C\uDFDB️ Administrations & Collectivités',
    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ NORMES & STANDARDS (10+)
  normesStandards: [
    '✅ Conformité normes camerounaises',
    '✅ Conformité normes françaises (DTU)',
    '✅ Conformité normes européennes (CE)',
    '✅ Étanchéité à l\'air testée',
    '✅ Étanchéité à l\'eau testée',
    '✅ Résistance au vent testée',
    '✅ Isolation thermique certifiée',
    '✅ Isolation phonique certifiée',
    '✅ Anti-effraction certifiée',
    '\uD83C\uDD95 Autre norme (à préciser)'
  ],

  // ✅ MARQUES UTILISÉES (15+) - Disponibles Afrique
  marquesUtilisees: [
    // Internationales (présentes en Afrique)
    '\uD83C\uDFED Technal (France)',
    '\uD83C\uDFED Aliplast (Pologne)',
    '\uD83C\uDFED Reynaers (Belgique)',
    '\uD83C\uDFED Schüco (Allemagne)',
    '\uD83C\uDFED ALUK (Chine)',
    '\uD83C\uDFED Alumil (Grèce)',

    // Locales / Régionales
    '\uD83C\uDFED Fabrication locale (Cameroun)',
    '\uD83C\uDFED Fabrication Afrique',
    '\uD83C\uDFED Profilés importés standard',

    // Chinoises (très présentes)
    '\uD83C\uDFED Marques chinoises qualité',
    '\uD83C\uDFED Marques chinoises économiques',

    // Mixte
    '\uD83C\uDFED Profilés européens + assemblage local',
    '\uD83C\uDFED Selon disponibilité marché',
    '\uD83C\uDFED Plusieurs marques (polyvalent)',
    '\uD83C\uDD95 Autre marque (à préciser)'
  ],

  // ✅ RÉALISATIONS SPÉCIALES (10+)
  realisationsSpeciales: [
    '\uD83C\uDFA8 Façade rideau (mur-rideau)',
    '\uD83C\uDFA8 Brise-soleil orientable',
    '\uD83C\uDFA8 Moucharabieh moderne',
    '\uD83C\uDFA8 Verrière d\'atelier',
    '\uD83C\uDFA8 Serre de jardin',
    '\uD83C\uDFA8 Pergola bioclimatique',
    '\uD83C\uDFA8 Structure pour panneaux solaires',
    '\uD83C\uDFA8 Auvent de terrasse',
    '\uD83C\uDFA8 Marquise aluminium',
    '\uD83C\uDD95 Autre réalisation (à préciser)'
  ],

  // ✅ LANGUES PARLÉES (8+)
  languesParlees: [
    '\uD83D\uDDE3️ Français',
    '\uD83D\uDDE3️ Anglais',
    '\uD83D\uDDE3️ Douala (Cameroun)',
    '\uD83D\uDDE3️ Ewondo (Cameroun)',
    '\uD83D\uDDE3️ Fulfulde',
    '\uD83D\uDDE3️ Arabe',
    '\uD83D\uDDE3️ Plusieurs langues locales',
    '\uD83C\uDD95 Autre langue (à préciser)'
  ],

  // ✅ DISPONIBILITÉ (6+)
  disponibilite: [
    '\uD83D\uDCC5 Immédiate (sous 48h)',
    '\uD83D\uDCC5 Cette semaine',
    '\uD83D\uDCC5 Sous 2 semaines',
    '\uD83D\uDCC5 Sous 1 mois',
    '\uD83D\uDCC5 Sur rendez-vous',
    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ SERVICES ADDITIONNELS (12+)
  servicesAdditionnels: [
    '➕ Étude technique gratuite',
    '➕ Visite chantier gratuite',
    '➕ Assistance choix matériaux',
    '➕ Conseil optimisation budget',
    '➕ Dépannage urgence 24h/24',
    '➕ Entretien annuel (contrat)',
    '➕ Remplacement vitrage cassé',
    '➕ Réparation serrurerie',
    '➕ Motorisation ultérieure',
    '➕ Extension future',
    '➕ Showroom / Exposition',
    '\uD83C\uDD95 Autre service (à préciser)'
  ]
};

// ════════════════════════════════════════════════════════════════════════════
// \uD83D\uDC76 CRÈCHE & GARDERIE D'ENFANTS - \uD83C\uDF0D AFRIQUE FRANCOPHONE (CAMEROUN FOCUS)
// ════════════════════════════════════════════════════════════════════════════
// Contexte: Structures d'accueil petite enfance (0-6 ans)
// Particularité Afrique: Normes locales, langues maternelles, contexte multiculturel
// Sécurité: Agrément gouvernemental, encadrement qualifié, locaux adaptés
// Services: Éducation, éveil, repas, suivi médical, activités culturelles
// ════════════════════════════════════════════════════════════════════════════
export const CRECHE_GARDERIE_MODALITIES: ModalityCategory = {
  // ✅ TYPES D'ÉTABLISSEMENT (15+) - Classés par POPULARITÉ AFRIQUE
  typesEtablissement: [
    // ═══ \uD83C\uDFE0 STRUCTURES PRIVÉES (70% du marché en Afrique) ═══
    '\uD83C\uDFE0 Crèche privée (accueil journée complète)',
    '\uD83C\uDFE0 Garderie familiale (petit effectif)',
    '\uD83C\uDFE0 Micro-crèche (< 12 enfants)',
    '\uD83C\uDFE0 Halte-garderie (accueil occasionnel)',
    '\uD83C\uDFE0 Crèche parentale (gestion parents)',
    '\uD83C\uDFE0 Jardin d\'enfants',

    // ═══ \uD83C\uDFE2 STRUCTURES PROFESSIONNELLES (20%) ═══
    '\uD83C\uDFE2 Crèche d\'entreprise',
    '\uD83C\uDFE2 Garderie inter-entreprises',
    '\uD83C\uDFE2 Crèche hospitalière (personnel médical)',

    // ═══ \uD83C\uDFD8️ STRUCTURES COMMUNAUTAIRES (10%) ═══
    '\uD83C\uDFD8️ Garderie communautaire',
    '\uD83C\uDFD8️ Crèche associative',
    '\uD83C\uDFD8️ Garderie religieuse (église, mosquée)',

    // ═══ \uD83C\uDF93 STRUCTURES ÉDUCATIVES ═══
    '\uD83C\uDF93 Crèche-école (maternelle intégrée)',
    '\uD83C\uDF93 Centre d\'éveil et petite enfance',

    '\uD83C\uDD95 Autre type d\'établissement (à préciser)'
  ],

  // ✅ TRANCHES D'ÂGE ACCUEILLIES (10+) - Très spécifique
  tranchesAge: [
    '\uD83D\uDC76 Bébés (0-6 mois)',
    '\uD83D\uDC76 Nourrissons (6-12 mois)',
    '\uD83D\uDC76 Petits (12-18 mois)',
    '\uD83E\uDDD2 Enfants (18-24 mois)',
    '\uD83E\uDDD2 Enfants (2-3 ans)',
    '\uD83E\uDDD2 Enfants (3-4 ans)',
    '\uD83D\uDC67 Grands (4-5 ans)',
    '\uD83D\uDC67 Préscolaires (5-6 ans)',
    '\uD83D\uDC68‍\uD83D\uDC69‍\uD83D\uDC67 Toutes tranches (0-6 ans)',
    '\uD83C\uDD95 Autre tranche d\'âge (à préciser)'
  ],

  // ✅ HORAIRES DE GARDE (12+)
  horairesGarde: [
    // Temps plein
    '⏰ Temps plein (7h-18h)',
    '⏰ Temps plein étendu (6h-19h)',
    '⏰ Garde journée (8h-17h)',

    // Temps partiel
    '⏰ Demi-journée matin (7h-12h)',
    '⏰ Demi-journée après-midi (12h-18h)',
    '⏰ 2-3 jours par semaine',

    // Horaires spéciaux
    '⏰ Horaires flexibles (sur mesure)',
    '⏰ Garde occasionnelle (à l\'heure)',
    '⏰ Garde de nuit (19h-7h)',
    '⏰ Garde week-end (samedi-dimanche)',
    '⏰ Garde 24h/24 (internat)',

    '\uD83C\uDD95 Autres horaires (à préciser)'
  ],

  // ✅ JOURS DE FONCTIONNEMENT (8+)
  joursFonctionnement: [
    '\uD83D\uDCC5 Lundi à Vendredi (5 jours)',
    '\uD83D\uDCC5 Lundi à Samedi (6 jours)',
    '\uD83D\uDCC5 Toute la semaine (7j/7)',
    '\uD83D\uDCC5 Ouvert jours fériés',
    '\uD83D\uDCC5 Ouvert vacances scolaires',
    '\uD83D\uDCC5 Fermé vacances scolaires',
    '\uD83D\uDCC5 Fermé jours fériés',
    '\uD83C\uDD95 Autre (à préciser)'
  ],

  // ✅ CAPACITÉ D'ACCUEIL (10+)
  capaciteAccueil: [
    '\uD83D\uDC65 Très petit (1-5 enfants)',
    '\uD83D\uDC65 Petit (6-10 enfants)',
    '\uD83D\uDC65 Moyen (11-20 enfants)',
    '\uD83D\uDC65 Grand (21-30 enfants)',
    '\uD83D\uDC65 Très grand (31-50 enfants)',
    '\uD83D\uDC65 Structure importante (51-80 enfants)',
    '\uD83D\uDC65 Grande structure (81-120 enfants)',
    '\uD83D\uDC65 Centre petite enfance (120+ enfants)',
    '\uD83D\uDC65 Places disponibles immédiatement',
    '\uD83C\uDD95 Autre capacité (à préciser)'
  ],

  // ✅ SERVICES PROPOSÉS (25+) - Très détaillé
  servicesProproses: [
    // ═══ \uD83C\uDF7D️ RESTAURATION (Crucial en Afrique) ═══
    '\uD83C\uDF7D️ Repas complets (petit-déj + déjeuner + goûter)',
    '\uD83C\uDF7D️ Déjeuner + goûter',
    '\uD83C\uDF7D️ Goûter uniquement',
    '\uD83C\uDF7D️ Repas maison (cuisine sur place)',
    '\uD83C\uDF7D️ Repas traiteur (externe)',
    '\uD83C\uDF7D️ Régimes spéciaux (allergie, religion)',
    '\uD83C\uDF7D️ Lait maternisé fourni',
    '\uD83C\uDF7D️ Alimentation bio',

    // ═══ \uD83D\uDE34 REPOS & HYGIÈNE ═══
    '\uD83D\uDE34 Sieste surveillée',
    '\uD83D\uDE34 Chambre de repos individuelle',
    '\uD83D\uDE34 Couches fournies',
    '\uD83D\uDE34 Produits d\'hygiène fournis',
    '\uD83D\uDE34 Change régulier',

    // ═══ \uD83C\uDFE5 SANTÉ & SÉCURITÉ ═══
    '\uD83C\uDFE5 Suivi médical régulier',
    '\uD83C\uDFE5 Infirmière sur place',
    '\uD83C\uDFE5 Pédiatre partenaire',
    '\uD83C\uDFE5 Premiers secours',
    '\uD83C\uDFE5 Carnet de santé suivi',
    '\uD83C\uDFE5 Protocole médicaments',
    '\uD83C\uDFE5 Assurance accidents',

    // ═══ \uD83D\uDE90 TRANSPORT ═══
    '\uD83D\uDE90 Transport matin + soir (navette)',
    '\uD83D\uDE90 Transport matin seulement',
    '\uD83D\uDE90 Transport soir seulement',
    '\uD83D\uDE90 Transport sur demande',

    // ═══ \uD83D\uDCF1 COMMUNICATION PARENTS ═══
    '\uD83D\uDCF1 Suivi quotidien (WhatsApp/SMS)',
    '\uD83D\uDCF1 Photos/vidéos journalières',
    '\uD83D\uDCF1 Cahier de liaison',
    '\uD83D\uDCF1 Réunions parents trimestrielles',
    '\uD83D\uDCF1 Application mobile dédiée',
    '\uD83D\uDCF1 Caméras surveillance (accès parents)',

    // ═══ \uD83C\uDF93 PÉDAGOGIE & ÉVEIL ═══
    '\uD83C\uDF93 Programme éducatif structuré',
    '\uD83C\uDF93 Méthode Montessori',
    '\uD83C\uDF93 Éveil sensoriel',
    '\uD83C\uDF93 Préparation maternelle',
    '\uD83C\uDF93 Initiation lecture/écriture',
    '\uD83C\uDF93 Activités manuelles quotidiennes',

    '\uD83C\uDD95 Autre service (à préciser)'
  ],

  // ✅ ACTIVITÉS PROPOSÉES (30+) - Très détaillé contexte africain
  activitesProposees: [
    // ═══ \uD83C\uDFA8 CRÉATIVITÉ & ARTS ═══
    '\uD83C\uDFA8 Dessin & peinture',
    '\uD83C\uDFA8 Coloriage & gommettes',
    '\uD83C\uDFA8 Pâte à modeler / Argile',
    '\uD83C\uDFA8 Bricolage & collage',
    '\uD83C\uDFA8 Arts plastiques',

    // ═══ \uD83C\uDFB5 MUSIQUE & DANSE ═══
    '\uD83C\uDFB5 Éveil musical',
    '\uD83C\uDFB5 Chansons enfantines',
    '\uD83C\uDFB5 Comptines africaines',
    '\uD83C\uDFB5 Danse & mouvement',
    '\uD83C\uDFB5 Initiation instruments (maracas, djembé)',

    // ═══ \uD83D\uDCDA LANGUE & COMMUNICATION ═══
    '\uD83D\uDCDA Contes & histoires',
    '\uD83D\uDCDA Lecture d\'albums illustrés',
    '\uD83D\uDCDA Bibliothèque enfantine',
    '\uD83D\uDCDA Éveil langues (français, anglais, langues locales)',
    '\uD83D\uDCDA Marionnettes & théâtre',

    // ═══ \uD83E\uDDE9 JEUX & APPRENTISSAGE ═══
    '\uD83E\uDDE9 Jeux éducatifs',
    '\uD83E\uDDE9 Puzzles & encastrements',
    '\uD83E\uDDE9 Jeux de construction (Lego, Kapla)',
    '\uD83E\uDDE9 Jeux de société adaptés',
    '\uD83E\uDDE9 Jeux sensoriels (matières, textures)',

    // ═══ ⚽ SPORT & MOTRICITÉ ═══
    '⚽ Motricité fine',
    '⚽ Motricité globale',
    '⚽ Parcours de motricité',
    '⚽ Jeux de ballon',
    '⚽ Baby gym',
    '⚽ Activités extérieures quotidiennes',

    // ═══ \uD83C\uDF0D CULTURE AFRICAINE (Spécificité locale) ═══
    '\uD83C\uDF0D Contes africains traditionnels',
    '\uD83C\uDF0D Initiation langues maternelles',
    '\uD83C\uDF0D Danses traditionnelles',
    '\uD83C\uDF0D Découverte culture locale',
    '\uD83C\uDF0D Fêtes culturelles (Ngondo, Nguon, etc.)',

    // ═══ \uD83C\uDF33 DÉCOUVERTE ENVIRONNEMENT ═══
    '\uD83C\uDF33 Jardin potager',
    '\uD83C\uDF33 Découverte nature',
    '\uD83C\uDF33 Animaux de la ferme',
    '\uD83C\uDF33 Sorties éducatives',

    // ═══ \uD83D\uDCBB NUMÉRIQUE (Optionnel) ═══
    '\uD83D\uDCBB Initiation tablette éducative',
    '\uD83D\uDCBB Jeux éducatifs numériques',

    '\uD83C\uDD95 Autre activité (à préciser)'
  ],

  // ✅ LANGUES PARLÉES (15+) - Contexte multilingue africain
  languesParlees: [
    // Officielles
    '\uD83D\uDDE3️ Français',
    '\uD83D\uDDE3️ Anglais',

    // Langues camerounaises principales
    '\uD83D\uDDE3️ Douala (Cameroun Littoral)',
    '\uD83D\uDDE3️ Ewondo (Cameroun Centre)',
    '\uD83D\uDDE3️ Bamiléké / Medumba (Ouest)',
    '\uD83D\uDDE3️ Bassa (Littoral)',
    '\uD83D\uDDE3️ Fulfuldé (Nord)',
    '\uD83D\uDDE3️ Pidgin English (Sud-Ouest)',

    // Autres langues africaines francophones
    '\uD83D\uDDE3️ Bambara (Mali)',
    '\uD83D\uDDE3️ Wolof (Sénégal)',
    '\uD83D\uDDE3️ Lingala (Congo/RDC)',
    '\uD83D\uDDE3️ Dioula (Côte d\'Ivoire)',
    '\uD83D\uDDE3️ Fon (Bénin)',
    '\uD83D\uDDE3️ Plusieurs langues locales',

    '\uD83C\uDD95 Autre langue (à préciser)'
  ],

  // ✅ ENCADREMENT & PERSONNEL (12+)
  encadrementPersonnel: [
    '\uD83D\uDC69‍\uD83C\uDFEB Éducateurs diplômés petite enfance',
    '\uD83D\uDC69‍\uD83C\uDFEB Puéricultrices diplômées',
    '\uD83D\uDC69‍\uD83C\uDFEB Auxiliaires petite enfance',
    '\uD83D\uDC69‍\uD83C\uDFEB Personnel formé premiers secours',
    '\uD83D\uDC68‍⚕️ Infirmière sur place',
    '\uD83D\uDC68‍⚕️ Pédiatre consultant',
    '\uD83D\uDC69‍\uD83C\uDF73 Cuisinière qualifiée',
    '\uD83E\uDDF9 Personnel d\'entretien',
    '\uD83D\uDE90 Chauffeur navette',
    '\uD83D\uDC65 Ratio adulte/enfant: 1 pour 5 enfants',
    '\uD83D\uDC65 Ratio adulte/enfant: 1 pour 8 enfants',
    '\uD83C\uDD95 Autre encadrement (à préciser)'
  ],

  // ✅ ÉQUIPEMENTS & INFRASTRUCTURES (20+)
  equipementsInfrastructures: [
    // ═══ \uD83C\uDFE0 LOCAUX ═══
    '\uD83C\uDFE0 Locaux climatisés',
    '\uD83C\uDFE0 Ventilation naturelle + brasseurs d\'air',
    '\uD83C\uDFE0 Salles de jeux spacieuses',
    '\uD83C\uDFE0 Dortoir séparé',
    '\uD83C\uDFE0 Cuisine équipée',
    '\uD83C\uDFE0 Sanitaires adaptés enfants',
    '\uD83C\uDFE0 Espace extérieur sécurisé',
    '\uD83C\uDFE0 Jardin / Cour de jeux',

    // ═══ \uD83D\uDEE1️ SÉCURITÉ ═══
    '\uD83D\uDEE1️ Portail sécurisé',
    '\uD83D\uDEE1️ Gardien à l\'entrée',
    '\uD83D\uDEE1️ Caméras de surveillance',
    '\uD83D\uDEE1️ Clôture sécurisée',
    '\uD83D\uDEE1️ Alarme incendie',
    '\uD83D\uDEE1️ Extincteurs',

    // ═══ ⚡ CONFORT ═══
    '⚡ Groupe électrogène',
    '⚡ Eau courante 24h/24',
    '⚡ Château d\'eau / Réserve',
    '\uD83D\uDCF6 Wi-Fi (communication parents)',

    // ═══ \uD83C\uDFAE ÉQUIPEMENTS LUDIQUES ═══
    '\uD83C\uDFAE Jeux d\'extérieur (toboggan, balançoire)',
    '\uD83C\uDFAE Aire de jeux couverte',
    '\uD83C\uDFAE Bibliothèque enfantine',
    '\uD83C\uDFAE Jouets éducatifs variés',

    '\uD83C\uDD95 Autre équipement (à préciser)'
  ],

  // ✅ CERTIFICATIONS & AGRÉMENTS (12+)
  certificationsAgrements: [
    '✅ Agréé Ministère Affaires Sociales',
    '✅ Agréé Ministère Éducation',
    '✅ Licence d\'exploitation valide',
    '✅ Normes sécurité respectées',
    '✅ Contrôles sanitaires réguliers',
    '✅ Personnel diplômé certifié',
    '✅ Assurance responsabilité civile',
    '✅ Assurance accidents enfants',
    '✅ Hygiène certifiée',
    '✅ Registre officiel tenu à jour',
    '✅ Inspections régulières',
    '\uD83C\uDD95 Autre certification (à préciser)'
  ],

  // ✅ TARIFICATION (10+) - Contexte économique africain
  modelesTarification: [
    '\uD83D\uDCB0 Tarif mensuel (forfait)',
    '\uD83D\uDCB0 Tarif hebdomadaire',
    '\uD83D\uDCB0 Tarif journalier',
    '\uD83D\uDCB0 Tarif demi-journée',
    '\uD83D\uDCB0 Tarif horaire (garde occasionnelle)',
    '\uD83D\uDCB0 Forfait 2-3 jours/semaine',
    '\uD83D\uDCB0 Frais d\'inscription (une fois)',
    '\uD83D\uDCB0 Réduction 2ème enfant (-10%)',
    '\uD83D\uDCB0 Réduction 3ème enfant (-15%)',
    '\uD83D\uDCB0 Tarifs dégressifs (fratrie)',
    '\uD83D\uDCB0 Facilités de paiement',
    '\uD83C\uDD95 Autre tarification (à préciser)'
  ],

  // ✅ GAMME DE PRIX (Cameroun/Afrique francophone)
  gammePrix: [
    '\uD83D\uDCB5 Économique (15 000 - 35 000 FCFA/mois)',
    '\uD83D\uDCB5 Accessible (35 000 - 60 000 FCFA/mois)',
    '\uD83D\uDCB5 Standard (60 000 - 100 000 FCFA/mois)',
    '\uD83D\uDCB5 Confort (100 000 - 150 000 FCFA/mois)',
    '\uD83D\uDCB5 Premium (150 000 - 250 000 FCFA/mois)',
    '\uD83D\uDCB5 Haut de gamme (250 000+ FCFA/mois)',
    '\uD83C\uDD95 Autre gamme (à préciser)'
  ],

  // ✅ AVANTAGES & POINTS FORTS (15+)
  avantagesPointsForts: [
    '⭐ Personnel expérimenté (5+ ans)',
    '⭐ Petit effectif (suivi personnalisé)',
    '⭐ Programme pédagogique structuré',
    '⭐ Repas équilibrés maison',
    '⭐ Locaux neufs / récents',
    '⭐ Environnement verdoyant',
    '⭐ Proximité écoles maternelles',
    '⭐ Transport inclus',
    '⭐ Horaires flexibles',
    '⭐ Caméras avec accès parents',
    '⭐ Activités culturelles africaines',
    '⭐ Bilinguisme (français-anglais)',
    '⭐ Groupe électrogène 24h/24',
    '⭐ Espace extérieur spacieux',
    '⭐ Tarifs compétitifs',
    '\uD83C\uDD95 Autre avantage (à préciser)'
  ],

  // ✅ PÉRIODES D'INSCRIPTION (8+)
  periodesInscription: [
    '\uD83D\uDCDD Inscriptions ouvertes toute l\'année',
    '\uD83D\uDCDD Rentrée septembre (année scolaire)',
    '\uD83D\uDCDD Rentrée janvier (2ème trimestre)',
    '\uD83D\uDCDD Places disponibles immédiatement',
    '\uD83D\uDCDD Liste d\'attente (6-12 mois)',
    '\uD83D\uDCDD Visite & test d\'adaptation proposés',
    '\uD83D\uDCDD Inscription en ligne possible',
    '\uD83C\uDD95 Autre période (à préciser)'
  ],

  // ✅ TYPES DE CONTRAT (8+)
  typesContrat: [
    '\uD83D\uDCC4 Contrat annuel (année scolaire)',
    '\uD83D\uDCC4 Contrat mensuel renouvelable',
    '\uD83D\uDCC4 Contrat à la carte (jours choisis)',
    '\uD83D\uDCC4 Contrat occasionnel (sans engagement)',
    '\uD83D\uDCC4 Période d\'essai (1 mois)',
    '\uD83D\uDCC4 Préavis 1 mois',
    '\uD83D\uDCC4 Résiliation possible tout moment',
    '\uD83C\uDD95 Autre contrat (à préciser)'
  ],

  // ✅ ZONES D'INTERVENTION - S'adapte automatiquement au pays de l'utilisateur
  zones_intervention: genererZonesIntervention('CM') // Système intelligent africanLocations.ts
};

// ✅ FONCTION POUR OBTENIR LES MODALITÉS PAR TYPE DE PRODUIT
// Cette fonction fait le mapping entre la catégorie du produit et ses modalités spécifiques
export const getModalitiesByProductType = (productType: string): ModalityCategory => {
  // Normaliser la catégorie (minuscules, suppression des espaces)
  const normalizedType = productType?.toLowerCase().trim() || '';

  console.log('[productModalities] Récupération modalités pour catégorie:', normalizedType);

  switch (normalizedType) {
    // ✅ FRIGORISTE / RÉPARATEUR FRIGO & CONGÉLATEUR
    case 'frigoriste':
    case 'reparateur_frigo':
    case 'réparateur_frigo':
    case 'reparateur_frigidaire':
    case 'réparateur_frigidaire':
    case 'reparateur_refrigerateur':
    case 'réparateur_réfrigérateur':
    case 'reparateur_congelateur':
    case 'réparateur_congélateur':
    case 'reparation_frigo':
    case 'réparation_frigo':
    case 'depanneur_frigo':
    case 'dépanneur_frigo':
    case 'depannage_frigo':
    case 'dépannage_frigo':
    case 'technicien_froid':
    case 'service_froid':
      return FRIGORISTE_MODALITIES;

    // ✅ RÉPARATEUR ÉLECTRONIQUE (TV, RADIO, AUDIO, VIDÉO)
    case 'reparateur_electronique':
    case 'réparateur_électronique':
    case 'reparateur_tv':
    case 'réparateur_tv':
    case 'reparateur_television':
    case 'réparateur_télévision':
    case 'reparateur_televiseur':
    case 'réparateur_téléviseur':
    case 'depanneur_tv':
    case 'dépanneur_tv':
    case 'depannage_tv':
    case 'dépannage_tv':
    case 'reparation_tv':
    case 'réparation_tv':
    case 'reparateur_audio':
    case 'réparateur_audio':
    case 'reparateur_video':
    case 'réparateur_vidéo':
    case 'reparateur_radio':
    case 'réparateur_radio':
    case 'technicien_audiovisuel':
    case 'technicien_tv':
    case 'service_tv':
    case 'reparation_home_cinema':
    case 'réparation_home_cinéma':
      return REPARATEUR_ELECTRONIQUE_MODALITIES;

    // ✅ MÉCANICIEN / GARAGE AUTOMOBILE
    case 'mecanicien':
    case 'mécanicien':
    case 'garage':
    case 'reparation_auto':
    case 'depannage':
    case 'garagiste':
      return MECANICIEN_MODALITIES;

    // ✅ MÉCANICIEN MOTO/TRICYCLE SPÉCIALISÉ
    case 'mecanicien_moto':
    case 'garage_moto':
    case 'reparation_moto':
    case 'depannage_moto':
    case 'garagiste_moto':
    case 'mecanicien_tricycle':
    case 'garage_tricycle':
      return MECANICIEN_MOTO_MODALITIES;

    // ✅ AUTOMOBILE & TRANSPORT
    case 'automobile':
    case 'voiture':
    case 'vehicule':
    case 'moto':
      return AUTOMOBILE_MODALITIES;

    // ✅ LOCATION COURTE DURÉE (Airbnb/Booking)
    case 'immobilier_location_courte':
    case 'location_courte':
    case 'location_courte_duree':
    case 'airbnb':
    case 'booking':
      return LOCATION_COURTE_DUREE_MODALITIES;

    // ✅ IMMOBILIER (vente et location long terme)
    case 'immobilier':
    case 'immobilier_batiment':
    case 'maison':
    case 'appartement':
      return IMMOBILIER_MODALITIES;

    // ✅ IMMOBILIER TERRAIN - Modalités spécifiques terrains
    case 'immobilier_terrain':
    case 'terrain':
    case 'parcelle':
    case 'lot':
      return IMMOBILIER_TERRAIN_MODALITIES;

    // ✅ HÔTELLERIE & HÉBERGEMENT
    case 'hotellerie':
    case 'hotel':
    case 'hebergement':
    case 'chambre':
      return HOTELLERIE_MODALITIES;

    // ✅ VOYAGE & TRANSPORT
    case 'voyage':
    case 'ticket_voyage':
    case 'transport':
    case 'billet':
      return VOYAGE_MODALITIES;

    // ✅ TRANSPORT INTRA-URBAIN (Taxi/VTC - Concurrent Yango/Gozem)
    case 'transport_intra_urbain':
    case 'taxi':
    case 'vtc':
    case 'chauffeur':
    case 'course':
    case 'transport_urbain':
    case 'transport_local':
    case 'moto_taxi':
    case 'okada':
    case 'bendskin':
    case 'keke':
    case 'tricycle':
    case 'clando':
      return TRANSPORT_INTRA_URBAIN_MODALITIES;

    // ✅ COVOITURAGE & TRAJETS
    case 'covoiturage':
    case 'carpooling':
    case 'trajet':
      return {
        villes: [
          // Grandes villes
          'Douala', 'Yaoundé', 'Garoua', 'Bafoussam', 'Bamenda', 'Maroua', 'Ngaoundéré',
          'Bertoua', 'Ebolowa', 'Kribi', 'Kumba', 'Limbe', 'Nkongsamba', 'Buea',
          // Villes moyennes
          'Édéa', 'Mbalmayo', 'Sangmélima', 'Abong-Mbang', 'Batouri', 'Yokadouma',
          'Dschang', 'Foumban', 'Bafang', 'Mbouda', 'Bandjoun',
          'Tiko', 'Mamfe', 'Fundong', 'Wum',
          'Mokolo', 'Kousséri', 'Yagoua', 'Guidiguis',
          'Meiganga', 'Tibati', 'Banyo',
          'Mbanga', 'Loum', 'Penja', 'Manjo',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        quartiers_douala: [
          // Douala
          'Akwa', 'Bonanjo', 'Bali', 'Bonabéri', 'Deido', 'New Bell', 'Bépanda',
          'Makepe', 'Logpom', 'Ndogpassi', 'Kotto', 'Pk10', 'Pk14', 'Pk17',
          'Village', 'Japoma', 'Yassa', 'Ndogsimbi', 'Cité des Palmiers',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        quartiers_yaounde: [
          // Yaoundé
          'Centre-ville', 'Bastos', 'Nlongkak', 'Melen', 'Mvog-Ada', 'Mokolo',
          'Essos', 'Ngousso', 'Emana', 'Ekounou', 'Odza', 'Elig-Essono',
          'Nkol-Eton', 'Nkol-Bisson', 'Nkol-Messeng', 'Mimboman', 'Nkolndongo',
          'Tsinga', 'Damas', 'Briqueterie', 'Kondengui', 'Mfandena',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        points_depart: [
          // Points de départ génériques
          'Gare routière', 'Gare ferroviaire', 'Agence de voyage', 'Station Total',
          'Station Oando', 'Carrefour principal', 'Rond-point', 'Marché central',
          'Centre commercial', 'Aéroport', 'Port', 'Hôtel', 'Domicile',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        types_vehicule: [
          'Berline (4 places)', 'SUV (6-7 places)', 'Break (5-6 places)',
          'Minibus (9-15 places)', 'Camionnette', 'Voiture de luxe',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        preferences: [
          'Musique autorisée', 'Silence apprécié', 'Discussion agréable',
          'Non-fumeur', 'Fumeur autorisé', 'Animaux autorisés',
          'Bagages volumineux acceptés', 'Climatisation', 'Arrêts flexibles',
          'Trajet direct', 'Femmes seulement', 'Hommes seulement',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        frequences: [
          'Trajet unique', 'Quotidien', 'Hebdomadaire', 'Week-end',
          'Occasionnel', 'Sur demande',
          '\uD83C\uDD95 Autre (ajouter)'
        ]
      };

    // \uD83D\uDE95 TRANSPORT URBAIN VTC (Taxi/Uber local)
    case 'transport_urbain':
    case 'vtc':
    case 'taxi_urbain':
    case 'taxi':
      return {
        types_vehicule: [
          'Berline économique (4 places)',
          'Berline confort (4 places)',
          'SUV (6-7 places)',
          'Minibus (9-15 places)',
          'Voiture climatisée premium',
          'Moto-taxi (1-2 places)',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        options_confort: [
          'Climatisation',
          'Sièges cuir',
          'Wifi à bord',
          'Chargeur téléphone',
          'Eau fraîche',
          'Musique au choix',
          'Bagages volumineux',
          'Siège bébé',
          'Accès handicapé',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        preferences_chauffeur: [
          'Non-fumeur uniquement',
          'Silence apprécié',
          'Discussion agréable',
          'Animaux acceptés',
          'Paiement mobile (OM/Momo)',
          'Paiement espèces uniquement',
          'Reçu disponible',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        statut_disponibilite: [
          'Disponible immédiatement',
          'Disponible dans 5-10 min',
          'Disponible dans 15-30 min',
          'Sur réservation uniquement',
          'Hors service'
        ],
        zones_service: [
          'Toute la ville',
          'Centre-ville uniquement',
          'Périphérie incluse',
          'Aéroport inclus',
          'Trajets inter-villes acceptés',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        types_tarification: [
          'Prix au kilomètre',
          'Prix forfaitaire par zone',
          'Prix négociable',
          'Prix selon traffic',
          'Prix selon heure (jour/nuit)',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        jours_disponibilite: [
          'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'
        ],
        tranches_horaires: [
          '00h-06h (Nuit)', '06h-09h (Matin)', '09h-12h (Matinée)',
          '12h-14h (Midi)', '14h-17h (Après-midi)', '17h-20h (Soirée)',
          '20h-00h (Nuit)', '24h/24h'
        ]
      };

    // ✅ VOYAGE & TOURISME
    case 'voyage_tourisme':
    case 'tourisme':
    case 'sejour':
    case 'vacances':
      return VOYAGE_TOURISME_MODALITIES;

    // ✅ VÊTEMENTS & MODE
    case 'vetement':
    case 'vêtement':
    case 'mode':
    case 'habit':
    case 'textile':
      return VETEMENTS_MODALITIES;

    // \uD83C\uDFE5 ÉTABLISSEMENTS DE SANTÉ (Hôpitaux, Cliniques)
    case 'hopital_clinique':
    case 'hopital':
    case 'clinique':
    case 'centre_sante':
      return {
        // ✅ SYSTÈME INTELLIGENT: Priorisation automatique selon le pays de l'utilisateur
        // Par défaut Cameroun ('CM'), sera adapté dynamiquement selon la géolocalisation
        noms_etablissements: genererHopitauxAfricains('CM'), // TODO: Récupérer le pays de l'utilisateur depuis le contexte
        types_etablissement: [
          'Hôpital public', 'Hôpital universitaire (CHU)', 'Hôpital régional',
          'Clinique privée', 'Polyclinique', 'Centre médical',
          'Dispensaire', 'Centre de santé intégré', 'Maternité',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        prestations_generales: [
          'Consultation générale', 'Urgences 24h/24', 'Hospitalisation',
          'Soins ambulatoires', 'Soins intensifs', 'Réanimation',
          'Chirurgie', 'Maternité', 'Pédiatrie',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        consultations_specialisees: [
          // Médecine interne
          'Cardiologie', 'Pneumologie', 'Gastro-entérologie', 'Néphrologie',
          'Endocrinologie', 'Diabétologie', 'Rhumatologie', 'Neurologie',
          // Chirurgie
          'Chirurgie générale', 'Chirurgie orthopédique', 'Chirurgie viscérale',
          'Neurochirurgie', 'Chirurgie maxillo-faciale', 'Chirurgie plastique',
          // Femme et enfant
          'Gynécologie', 'Obstétrique', 'Pédiatrie', 'Néonatologie',
          // Organes des sens
          'Ophtalmologie', 'ORL (Oto-Rhino-Laryngologie)', 'Stomatologie',
          // Imagerie et diagnostic
          'Radiologie', 'Échographie', 'Scanner', 'IRM', 'Mammographie',
          // Autres spécialités
          'Dermatologie', 'Urologie', 'Oncologie', 'Hématologie',
          'Psychiatrie', 'Médecine physique et réadaptation', 'Anesthésie',
          'Odontologie (Dentaire)', 'Médecine du travail',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        services_annexes: [
          'Laboratoire d\'analyses', 'Pharmacie interne', 'Ambulance',
          'Banque de sang', 'Dialyse', 'Kinésithérapie',
          'Nutrition/Diététique', 'Bloc opératoire', 'Service mortuaire',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        equipements: [
          'Scanner', 'IRM', 'Échographie', 'Radiologie numérique',
          'Mammographe', 'Endoscopie', 'ECG/EEG', 'Respirateur',
          'Couveuse', 'Défibrillateur', 'Unité de dialyse',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        jours_semaine: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
      };

    // \uD83D\uDC8A PHARMACIES - SYSTÈME INTELLIGENT AVEC PHARMACIES RÉELLES
    case 'pharmacie':
    case 'pharmacies':
      return {
        // ✅ SYSTÈME GÉO-INTELLIGENT: Plus de 200 pharmacies réelles d'Afrique francophone
        // TRIPLE PRIORITÉ AUTOMATIQUE :
        // 1️⃣ Pharmacies de la VILLE de l'utilisateur (en premier)
        // 2️⃣ Pharmacies du PAYS de l'utilisateur (autres villes)
        // 3️⃣ Pharmacies renommées des pays voisins (suggestions)
        // 
        // La fonction détecte automatiquement :
        // - Le pays via les données utilisateur ou GPS
        // - La ville via l'adresse ou les coordonnées
        noms_pharmacies: genererPharmaciesAfricaines('CM'), // Valeur par défaut : Cameroun
        types_pharmacie: [
          'Pharmacie normale',
          'Pharmacie de garde (nuit)',
          'Pharmacie de garde (weekend)',
          'Pharmacie 24h/24',
          'Pharmacie hospitalière',
          'Pharmacie d\'officine',
          'Parapharmacie',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        services_pharmacie: [
          // \uD83D\uDC8A Services de base
          'Vente de médicaments sur ordonnance',
          'Vente libre (sans ordonnance)',
          'Conseil pharmaceutique gratuit',
          'Délivrance urgente',

          // \uD83C\uDF19 Services garde
          'Garde de nuit (20h-8h)',
          'Garde weekend (Sam-Dim)',
          'Garde jours fériés',
          'Permanence 24h/24',

          // \uD83E\uDDEA Tests et analyses
          'Test de glycémie rapide',
          'Prise de tension artérielle',
          'Test de grossesse',
          'Test paludisme (goutte épaisse)',
          'Test COVID-19',

          // \uD83D\uDC89 Soins et injections
          'Injections/Vaccinations',
          'Pansements',
          'Premiers secours',

          // \uD83D\uDE9A Services pratiques
          'Livraison à domicile',
          'Livraison Express (<2h)',
          'Commande téléphonique',
          'WhatsApp Business',

          // \uD83E\uDDF4 Parapharmacie
          'Parapharmacie (cosmétiques)',
          'Produits bébé (lait, couches)',
          'Compléments alimentaires',
          'Matériel médical',
          'Orthopédie',

          // \uD83D\uDCB3 Paiement
          'Paiement Mobile Money',
          'Paiement Orange Money',
          'Paiement MTN Mobile Money',
          'Paiement carte bancaire',

          '\uD83C\uDD95 Autre (ajouter)'
        ],
        jours_semaine: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
      };

    // \uD83E\uDDEA LABORATOIRES D'ANALYSES & IMAGERIE MÉDICALE
    case 'laboratoire':
    case 'laboratoires':
    case 'labo':
      return {
        // ✅ SYSTÈME GÉO-INTELLIGENT: Plus de 400 laboratoires réels d'Afrique francophone
        // TRIPLE PRIORITÉ AUTOMATIQUE :
        // 1️⃣ Laboratoires de la VILLE de l'utilisateur (en premier)
        // 2️⃣ Laboratoires du PAYS de l'utilisateur (autres villes)
        // 3️⃣ Laboratoires renommés des pays voisins (suggestions)
        // 
        // La fonction détecte automatiquement :
        // - Le pays via les données utilisateur ou GPS
        // - La ville via l'adresse ou les coordonnées
        // 
        // TODO DANS L'APPELANT (ProductManagerMobile, etc.) :
        // Passer userData et gpsCoords pour personnalisation
        // Exemple : genererTousLesLaboratoires(codePays, ville)
        noms_laboratoires: genererTousLesLaboratoires('CM', 'Douala'), // Valeurs par défaut : Cameroun/Douala
        types_laboratoire: [
          'Laboratoire d\'analyses médicales',
          'Laboratoire de biologie médicale',
          'Centre d\'imagerie médicale',
          'Laboratoire d\'anatomie pathologique',
          'Laboratoire de microbiologie',
          'Laboratoire & Imagerie (Mixte)',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        analyses_proposees: [
          // ========== ANALYSES BIOLOGIQUES ==========

          // Hématologie
          'Numération formule sanguine (NFS)', 'Groupe sanguin', 'Bilan de coagulation',
          'Formule sanguine complète (FSC)', 'Vitesse de sédimentation (VS)',

          // Biochimie
          'Glycémie', 'Glycémie à jeun', 'Hémoglobine glyquée (HbA1c)',
          'Bilan lipidique', 'Cholestérol total', 'Triglycérides',
          'Bilan hépatique', 'Transaminases (ALAT/ASAT)', 'Bilirubine',
          'Bilan rénal', 'Créatinine', 'Urée', 'Acide urique',
          'Ionogramme', 'Sodium', 'Potassium', 'Calcium',
          'Bilan thyroïdien', 'TSH', 'T3', 'T4',

          // Sérologie/Immunologie
          'Sérologie VIH', 'Sérologie hépatites (B/C)', 'Sérologie toxoplasmose',
          'Sérologie rubéole', 'Test de grossesse (Beta-HCG)',

          // Microbiologie & Bactériologie
          'ECBU (Examen cytobactériologique urinaire)', 'Coproculture',
          'Prélèvement vaginal', 'Hémoculture', 'Antibiogramme',

          // Parasitologie
          'Goutte épaisse (Paludisme)', 'Test rapide paludisme',
          'Recherche parasites intestinaux', 'Examen parasitologique des selles',

          // Hormonologie
          'Dosage hormones sexuelles', 'FSH', 'LH', 'Prolactine',
          'Testostérone', 'Œstradiol', 'Progestérone',

          // Autres analyses
          'Analyse d\'urine complète', 'Analyse de selles',
          'Spermogramme', 'Biopsie', 'Frottis cervical (Pap test)',
          'PCR COVID-19', 'Test antigénique COVID-19',

          // ========== IMAGERIE MÉDICALE ==========

          // Radiologie conventionnelle
          'Radiographie standard', 'Radiographie thoracique (Poumons)',
          'Radiographie osseuse', 'Radiographie abdominale',
          'Radiographie du crâne', 'Radiographie de la colonne vertébrale',
          'Radiographie des membres', 'Panoramique dentaire',

          // Échographie
          'Échographie abdominale', 'Échographie pelvienne',
          'Échographie obstétricale (grossesse)', 'Échographie cardiaque (Échocardiographie)',
          'Échographie thyroïdienne', 'Échographie mammaire',
          'Échographie Doppler', 'Échographie des vaisseaux',
          'Échographie 3D/4D', 'Échographie de datation',

          // Scanner (Tomodensitométrie - TDM)
          'Scanner cérébral', 'Scanner thoracique',
          'Scanner abdomino-pelvien', 'Scanner du rachis',
          'Scanner des sinus', 'Scanner osseux',
          'Scanner avec injection de produit de contraste',

          // IRM (Imagerie par Résonance Magnétique)
          'IRM cérébrale', 'IRM de la colonne vertébrale',
          'IRM abdominale', 'IRM pelvienne',
          'IRM articulaire (genou, épaule...)', 'IRM cardiaque',
          'IRM avec injection de Gadolinium',

          // Mammographie & Sénologie
          'Mammographie de dépistage', 'Mammographie diagnostique',
          'Mammographie bilatérale',

          // Examens spécialisés
          'Scintigraphie osseuse', 'Scintigraphie thyroïdienne',
          'PET Scan (Tomographie par émission de positons)',
          'Fibroscopie digestive', 'Coloscopie',
          'Coronarographie', 'Angiographie',

          '\uD83C\uDD95 Autre (ajouter)'
        ],
        jours_semaine: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
      };

    // \uD83C\uDFA8 ARTICLES DE DÉCORATION
    case 'decoration':
    case 'déco':
    case 'objet_deco':
      return {
        noms_articles: [
          // Décoration murale
          'Tableau abstrait', 'Tableau paysage', 'Affiche moderne', 'Poster vintage',
          'Miroir rond', 'Miroir rectangulaire', 'Miroir soleil', 'Horloge murale',
          'Étagère murale flottante', 'Cadre photo mural',
          // Luminaires
          'Lampe de table', 'Lampe de chevet', 'Lampe sur pied', 'Suspension',
          'Lustre', 'Applique murale', 'Guirlande lumineuse', 'Lampe LED',
          // Objets décoratifs
          'Vase décoratif', 'Pot de fleurs', 'Cache-pot', 'Sculpture décorative',
          'Statuette', 'Bougeoir', 'Chandelier', 'Porte-bougie',
          // Textiles
          'Coussin décoratif', 'Housse de coussin', 'Plaid', 'Jeté de canapé',
          'Rideau occultant', 'Voilage', 'Tapis de salon', 'Tapis berbère',
          'Tapis rond', 'Descente de lit',
          // Accessoires
          'Bougie parfumée', 'Diffuseur de parfum', 'Plante artificielle',
          'Fleurs artificielles', 'Plateau décoratif', 'Boîte de rangement déco',
          'Panier en osier', 'Vide-poche', 'Porte-revues', 'Set de table',
          'Chemin de table', 'Nappe décorative', 'Carillon', 'Attrape-rêves',
          // Objets d\'art
          'Sculpture en bois', 'Objet ethnique', 'Masque africain', 'Statue Buddha',
          'Objet vintage', 'Horloge ancienne', 'Globe terrestre déco',
          // Saisonniers
          'Couronne de Noël', 'Guirlande de Noël', 'Déco Halloween',
          'Déco Pâques', 'Centre de table festif',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        categories: [
          'Décoration murale', 'Tableaux & Affiches', 'Miroirs', 'Horloges',
          'Étagères décoratives', 'Luminaires', 'Lampes', 'Vases & Pots',
          'Coussins & Plaids', 'Rideaux & Voilages', 'Tapis', 'Bougies & Senteurs',
          'Sculptures & Statues', 'Plantes artificielles', 'Cadres photo',
          'Accessoires de table', 'Centre de table', 'Objets ethniques',
          'Objets vintage', 'Déco de Noël', 'Déco de fête',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        styles: [
          'Moderne', 'Contemporain', 'Classique', 'Scandinave', 'Industriel',
          'Bohème', 'Ethnique', 'Vintage', 'Rustique', 'Minimaliste',
          'Luxe', 'Tropical', 'Art déco', 'Shabby chic', 'Écléctique',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        pieces: [
          'Salon', 'Chambre', 'Cuisine', 'Salle à manger', 'Bureau',
          'Salle de bain', 'Entrée', 'Couloir', 'Terrasse', 'Jardin',
          'Chambre enfant', 'Chambre bébé', 'Toutes pièces',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        matieres: [
          'Bois', 'Métal', 'Verre', 'Céramique', 'Porcelaine', 'Terre cuite',
          'Plastique', 'Tissu', 'Coton', 'Lin', 'Velours', 'Rotin', 'Osier',
          'Marbre', 'Pierre', 'Résine', 'Papier', 'Carton', 'Bambou',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        couleurs: [
          'Blanc', 'Noir', 'Gris', 'Beige', 'Marron', 'Bleu', 'Vert', 'Rouge',
          'Rose', 'Jaune', 'Orange', 'Violet', 'Doré', 'Argenté', 'Cuivré',
          'Multicolore', 'Transparent', 'Naturel',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        tailles: [
          'Très petit (< 20cm)', 'Petit (20-40cm)', 'Moyen (40-60cm)',
          'Grand (60-100cm)', 'Très grand (> 100cm)', 'Set/Lot',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        etat: [
          'Neuf avec emballage', 'Neuf sans emballage', 'Excellent état',
          'Bon état', 'Occasion', 'Artisanal fait main', 'Vintage authentique',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        marques: [
          'Ikea', 'Maisons du Monde', 'Zara Home', 'H&M Home', 'Habitat',
          'Conforama', 'But', 'La Redoute', 'Alinéa', 'Casa',
          'Artisan local', 'Fait main', 'Sans marque',
          '\uD83C\uDD95 Autre (ajouter)'
        ]
      };

    // ✅ CHAUSSURES
    case 'chaussure':
    case 'soulier':
    case 'basket':
    case 'sandale':
      return {
        noms_chaussures: [
          'Basket Nike Air Max', 'Basket Adidas Stan Smith', 'Basket Puma', 'Basket Reebok',
          'Basket Converse All Star', 'Basket New Balance', 'Sneakers', 'Running',
          'Escarpin', 'Talon haut', 'Talon compensé', 'Ballerine', 'Mocassin',
          'Derby', 'Richelieu', 'Oxford', 'Bottine', 'Botte', 'Sandale', 'Tong',
          'Claquette', 'Chaussure de sport', 'Chaussure de ville', 'Chaussure de randonnée',
          'Chaussure de sécurité', 'Chaussure enfant', 'Chausson',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        types: [
          'Basket / Sneakers', 'Escarpin', 'Sandale', 'Botte', 'Bottine', 'Mocassin',
          'Ballerine', 'Tong', 'Chaussure de sport', 'Chaussure de ville', 'Chaussure enfant',
          'Chaussure de sécurité', 'Chausson', '\uD83C\uDD95 Autre (ajouter)'
        ],
        marques: [
          'Nike', 'Adidas', 'Puma', 'Reebok', 'New Balance', 'Converse', 'Vans',
          'Asics', 'Skechers', 'Fila', 'Under Armour', 'Jordan', 'Lacoste',
          'Timberland', 'Clarks', 'Geox', 'Crocs', 'Dr. Martens', 'Birkenstock',
          'Zara', 'H&M', 'Bata', 'Aldo', 'Steve Madden', 'Local',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        pointures: [
          // Pointures femmes
          '35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5',
          '40', '40.5', '41', '41.5', '42',
          // Pointures hommes
          '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48',
          // Pointures enfants
          '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
          '31', '32', '33', '34',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        couleurs: [
          'Noir', 'Blanc', 'Marron', 'Beige', 'Gris', 'Bleu', 'Rouge', 'Vert',
          'Jaune', 'Orange', 'Rose', 'Violet', 'Doré', 'Argenté', 'Multicolore',
          'Nude', 'Camel', 'Bordeaux', 'Marine', 'Kaki', 'Léopard', 'Imprimé',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        matieres: [
          'Cuir', 'Cuir véritable', 'Cuir synthétique', 'Daim', 'Nubuck',
          'Toile', 'Canvas', 'Textile', 'Mesh', 'Synthétique', 'Caoutchouc',
          'Plastique', 'Velours', 'Satin',
          '\uD83C\uDD95 Autre (ajouter)'
        ],
        genres: ['Femme', 'Homme', 'Enfant', 'Bébé', 'Unisexe', '\uD83C\uDD95 Autre (ajouter)'],
        etat: ['Neuf avec étiquette', 'Neuf sans étiquette', 'Excellent état', 'Bon état', 'Occasion', '\uD83C\uDD95 Autre (ajouter)'],
        styles: [
          'Casual', 'Sport', 'Élégant', 'Classique', 'Mode', 'Vintage', 'Streetwear',
          'Confort', 'Running', 'Basketball', 'Football', 'Tennis',
          '\uD83C\uDD95 Autre (ajouter)'
        ]
      };

    // ✅ ÉLECTROMÉNAGER
    case 'electromenager':
    case 'électroménager':
    case 'appareil':
    case 'menager':
      return ELECTROMENAGER_MODALITIES;

    // ✅ IMAGE & SON
    case 'image_son':
    case 'tv':
    case 'television':
    case 'audio':
    case 'video':
    case 'multimedia':
      return IMAGE_SON_MODALITIES;

    // ✅ TÉLÉPHONES & SMARTPHONES
    case 'telephone':
    case 'téléphone':
    case 'smartphone':
    case 'mobile':
    case 'cellulaire':
      return TELEPHONES_MODALITIES;

    // ✅ RÉPARATEUR TÉLÉPHONE/SMARTPHONE & TABLETTES
    case 'reparateur_telephone':
    case 'reparateur_telephone_tablette':
    case 'réparateur_téléphone':
    case 'réparateur_smartphone':
    case 'reparation_telephone':
    case 'réparation_téléphone':
    case 'reparation_smartphone':
    case 'réparation_smartphone':
    case 'reparation_mobile':
    case 'réparation_mobile':
    case 'reparation_tablette':
    case 'réparation_tablette':
    case 'depannage_telephone':
    case 'dépannage_téléphone':
    case 'service_reparation_mobile':
      return REPARATEUR_TELEPHONE_TABLETTE_MODALITIES;

    // ✅ RÉPARATEUR INFORMATIQUE (Ordinateurs, Imprimantes, Équipements)
    case 'reparateur_informatique':
    case 'reparateur_ordinateur':
    case 'réparateur_informatique':
    case 'réparateur_ordinateur':
    case 'reparation_informatique':
    case 'réparation_informatique':
    case 'reparation_ordinateur':
    case 'réparation_ordinateur':
    case 'reparation_imprimante':
    case 'réparation_imprimante':
    case 'depanneur_informatique':
    case 'dépanneur_informatique':
    case 'depannage_informatique':
    case 'dépannage_informatique':
    case 'service_informatique':
    case 'technicien_informatique':
      return REPARATEUR_INFORMATIQUE_MODALITIES;

    // ✅ RÉPARATEUR ÉLECTROMÉNAGER (Frigos, Cuisinières, Lave-linge, etc.)
    case 'reparateur_electromenager':
    case 'réparateur_électroménager':
    case 'reparation_electromenager':
    case 'réparation_électroménager':
    case 'depanneur_electromenager':
    case 'dépanneur_électroménager':
    case 'depannage_electromenager':
    case 'dépannage_électroménager':
    case 'reparateur_frigo':
    case 'reparation_refrigerateur':
    case 'reparation_cuisiniere':
    case 'reparation_lave_linge':
    case 'reparation_machine_laver':
    case 'technicien_electromenager':
    case 'frigoriste':
      return REPARATEUR_ELECTROMENAGER_MODALITIES;

    // ✅ ORDINATEURS & INFORMATIQUE (Vente)
    case 'ordinateur':
    case 'pc':
    case 'laptop':
    case 'informatique':
    case 'tablette':
      return ORDINATEURS_MODALITIES;

    // ✅ MOBILIER & DÉCORATION
    case 'mobilier':
    case 'meuble':
    case 'decoration':
    case 'décoration':
    case 'ameublement':
      return MOBILIER_MODALITIES;

    // ✅ ASSURANCE
    case 'assurance':
    case 'assurances':
      return ASSURANCE_MODALITIES;

    // ✅ ALIMENTATION COMPLÈTE (fusion agroalimentaire + aliments frais)
    case 'agroalimentaire':
    case 'agro-alimentaire':
    case 'epicerie':
    case 'alimentaire':
    case 'conserve':
    case 'aliment':
    case 'aliments':
    case 'nourriture':
    case 'frais':
    case 'fruit':
    case 'legume':
    case 'viande':
    case 'poisson':
      return AGROALIMENTAIRE_MODALITIES;

    // ✅ LIVRES & FOURNITURES
    // ✅ VIN ET LIQUEUR (COMMERCIALISATION)
    case 'vin':
    case 'vins':
    case 'vin_liqueur':
    case 'vin_et_liqueur':
    case 'liqueur':
    case 'liqueurs':
    case 'spiritueux':
    case 'alcool':
    case 'champagne':
    case 'caviste':
    case 'commercialisation_vin':
    case 'commercialisation_alcool':
      return VIN_LIQUEUR_MODALITIES;

    // ✅ LIVRES & FOURNITURES SCOLAIRES
    case 'livre':
    case 'livres':
    case 'livres_fournitures':
    case 'fourniture':
    case 'scolaire':
    case 'papeterie':
      return LIVRES_FOURNITURES_MODALITIES;

    // ✅ QUINCAILLERIE & BRICOLAGE
    case 'quincaillerie':
    case 'bricolage':
    case 'outil':
    case 'materiel':
    case 'construction':
      return QUINCAILLERIE_MODALITIES;

    // ✅ PRESTATIONS DE SERVICE
    case 'service':
    case 'prestation':
    case 'prestation_service':
    case 'services':
      return PRESTATIONS_SERVICE_MODALITIES;

    // ✅ MÉDICAMENT & SANTÉ (distinct de pharmacie établissement)
    case 'medicament':
    case 'médicament':
    case 'sante':
    case 'santé':
      return PHARMACIE_MODALITIES;

    // ✅ COSMÉTIQUES & PARFUMS
    case 'cosmetique':
    case 'cosmétique':
    case 'cosmetique_parfum':
    case 'parfum':
    case 'beaute':
    case 'beauté':
      return COSMETIQUES_PARFUMS_MODALITIES;

    // ✅ BIJOUX & ACCESSOIRES
    case 'bijou':
    case 'bijoux':
    case 'joaillerie':
    case 'accessoire':
      return BIJOUX_MODALITIES;

    // ✅ COIFFURE & BEAUTÉ
    case 'coiffure':
    case 'coiffure_beaute':
    case 'salon':
    case 'esthetique':
    case 'esthétique':
      return COIFFURE_BEAUTE_MODALITIES;

    // ✅ COUTURIER
    case 'couturier':
    case 'couturiere':
    case 'couturière':
    case 'tailleur':
    case 'couture':
    case 'confection':
    case 'retouche':
    case 'styliste':
    case 'mode':
      return COUTURIER_MODALITIES;

    // ✅ DÉMÉNAGEMENT
    case 'demenagement':
    case 'déménagement':
    case 'demenageur':
      return DEMENAGEMENT_MODALITIES;

    // ✅ JOUETS & ENFANTS
    case 'jouet':
    case 'jouets':
    case 'jouets_enfants':
    case 'enfant':
    case 'bebe':
    case 'bébé':
      return JOUETS_ENFANTS_MODALITIES;

    // ✅ USTENSILES DE CUISINE
    case 'ustensile':
    case 'ustensiles':
    case 'ustensiles_cuisine':
    case 'cuisine':
    case 'vaisselle':
      return USTENSILES_CUISINE_MODALITIES;

    // ✅ PIÈCES AUTO
    case 'piece_auto':
    case 'pieces_auto':
    case 'pièce_auto':
    case 'pièces_auto':
    case 'mecanique':
    case 'mécanique':
    case 'garage':
      return PIECES_AUTO_MODALITIES;

    // ✅ PIÈCES INDUSTRIELLES
    case 'piece_industrielle':
    case 'pieces_industrielles':
    case 'pièce_industrielle':
    case 'pièces_industrielles':
    case 'industriel':
    case 'machine':
      return PIECES_INDUSTRIELLES_MODALITIES;

    // ✅ RESTAURATION
    case 'restauration':
    case 'restaurant':
    case 'maquis':
    case 'bar':
    case 'cafe':
    case 'café':
    case 'boulangerie':
    case 'patisserie':
    case 'pâtisserie':
    case 'traiteur':
      return RESTAURATION_MODALITIES;

    // ✅ ÉLECTRONIQUE
    case 'electronique':
    case 'électronique':
    case 'hi-tech':
    case 'high-tech':
    case 'tech':
      return ELECTRONIQUE_MODALITIES;

    // ✅ SOUTIEN SCOLAIRE / RÉPÉTITEUR (Primaire/Secondaire)
    case 'soutien_scolaire':
    case 'soutien_scolaire_repetiteur':
    case 'repetiteur':
    case 'répétiteur':
    case 'cours_particuliers':
    case 'aide_devoirs':
    case 'rattrapage_scolaire':
      return SOUTIEN_SCOLAIRE_MODALITIES;

    // ✅ FORMATION & ÉDUCATION (Formation professionnelle, Concours)
    case 'formation':
    case 'formation_education':
    case 'education':
    case 'éducation':
    case 'enseignement':
    case 'cours':
    case 'ecole':
    case 'école':
      return FORMATION_EDUCATION_MODALITIES;

    // ✅ ÉVÉNEMENTIEL
    case 'evenementiel':
    case 'événementiel':
    case 'evenement':
    case 'événement':
    case 'mariage':
    case 'fete':
    case 'fête':
    case 'ceremonie':
    case 'cérémonie':
      return EVENEMENTIEL_MODALITIES;

    // ✅ PRODUCTEURS LOCAUX (Agriculture & Élevage)
    // ✅ RENOMMÉ: "agriculture" → "producteurs_locaux"
    case 'producteurs_locaux':    // ✅ NOUVEAU NOM PRINCIPAL
    case 'agriculture':           // ✅ ALIAS rétrocompatibilité
    case 'agriculture_elevage':
    case 'agriculture_élevage':
    case 'agricole':
    case 'ferme':
    case 'elevage':
    case 'élevage':
    case 'peche':
    case 'pêche':
    case 'pisciculture':
    case 'aquaculture':
    case 'apiculture':
    case 'aviculture':
    case 'maraichage':
    case 'maraîchage':
    case 'culture':
    case 'potager': // ✅ Potager maraîcher (agriculture)
    case 'plantation':
    case 'bétail':
    case 'betail':
    case 'volaille':
    case 'bovin':
    case 'ovin':
    case 'caprin':
    case 'porcin':
    case 'producteur':            // ✅ NOUVEAU: Direct producteur
    case 'production_locale':     // ✅ NOUVEAU: Production locale
    case 'direct_producteur':     // ✅ NOUVEAU: Circuit court
      return AGRICULTURE_ELEVAGE_MODALITIES;
    // ⚠️ Note : "jardin" et "jardinage" sont dans JARDINAGE_PAYSAGISME (services d'entretien)

    // ✅ SPORT & FITNESS
    case 'sport_fitness': // ✅ AJOUTÉ : Mapping direct catégorie officielle
    case 'sport':
    case 'fitness':
    case 'gym':
    case 'gymnastique':
    case 'musculation':
    case 'salle_sport':
    case 'salle_de_sport':
    case 'coach_sportif':
    case 'coaching':
    case 'entrainement':
    case 'entraînement':
    case 'yoga':
    case 'pilates':
    case 'crossfit':
    case 'boxe':
    case 'natation':
      return SPORT_FITNESS_MODALITIES;

    // ✅ BIEN-ÊTRE & SPA (20+ mots-clés)
    case 'bien_etre_spa': // ✅ AJOUTÉ : Mapping direct catégorie officielle
    case 'bien-etre':
    case 'bien-être':
    case 'bien_etre':
    case 'spa':
    case 'massage':
    case 'massages':
    case 'masseur':
    case 'masseuse':
    case 'relaxation':
    case 'detente':
    case 'détente':
    case 'hammam':
    case 'sauna':
    case 'jacuzzi':
    case 'balnéo':
    case 'balnéothérapie':
    case 'thalasso':
    case 'thalassothérapie':
    case 'reflexologie':
    case 'réflexologie':
    case 'aromathérapie':
    case 'aromatherapie':
    case 'reiki':
    case 'sophrologie':
    case 'meditation':
    case 'méditation':
    case 'gommage':
    case 'drainage':
    case 'enveloppement':
    case 'soin_visage':
    case 'soin_corps':
    case 'therapeute':
    case 'thérapeute':
      return BIEN_ETRE_SPA_MODALITIES;

    // ✅ ANIMAUX & VÉTÉRINAIRE
    case 'animaux':
    case 'animal':
    case 'veterinaire':
    case 'vétérinaire':
    case 'animalerie':
    case 'pet':
      return ANIMAUX_VETERINAIRE_MODALITIES;

    // ✅ NETTOYAGE & ENTRETIEN
    case 'nettoyage_entretien': // ✅ ID officiel de la catégorie
    case 'nettoyage':
    case 'menage':
    case 'ménage':
    case 'entretien':
    case 'femme_de_menage':
    case 'nounou':
    case 'baby_sitter':
    case 'blanchisseur':
    case 'pressing':
    case 'lavage':
    case 'gardien':
    case 'vigile':
    case 'jardinier':
    case 'cuisiniere':
    case 'chauffeur':
    case 'house_girl':
    case 'nanny':
      return NETTOYAGE_MODALITIES;

    // ✅ JARDINAGE & PAYSAGISME (Services d'entretien)
    case 'jardinage_paysagisme': // ✅ ID officiel de la catégorie
    case 'jardinage':
    case 'jardinier':
    case 'paysagiste':
    case 'jardin':
    case 'paysagisme':
    case 'paysage':
    case 'espaces_verts':
    case 'espace_vert':
    case 'tonte':
    case 'elagage':
    case 'élagage':
    case 'arrosage':
      return JARDINAGE_PAYSAGISME_MODALITIES;

    // ✅ SÉCURITÉ & SURVEILLANCE
    case 'securite_surveillance': // ✅ ID officiel de la catégorie
    case 'sécurité_surveillance':
    case 'securite':
    case 'sécurité':
    case 'surveillance':
    case 'gardiennage':
    case 'alarme':
    case 'camera':
    case 'caméra':
    case 'videosurveillance':
    case 'vidéosurveillance':
    case 'vigile':
    case 'garde':
    case 'agent_securite':
    case 'agent_sécurité':
      return SECURITE_SURVEILLANCE_MODALITIES;

    // ✅ PLOMBERIE (Services)
    case 'plomberie':
    case 'plombier':
    case 'installation_plomberie':
    case 'reparation_plomberie':
      return PLOMBERIE_MODALITIES;

    // ✅ ÉLECTRICIEN (Services)
    case 'electricien':
    case 'installation_electrique':
    case 'reparation_electrique':
    case 'depannage_electrique':
      return ELECTRICIEN_MODALITIES;

    // ✅ ÉLECTRICIEN AUTOMOBILE (Service spécialisé)
    case 'electricien_auto':
    case 'electricite_auto':
    case 'electronique_auto':
    case 'diagnostic_auto':
      return ELECTRICIEN_AUTO_MODALITIES;

    // ✅ MAÇON (Service)
    case 'macon':
    case 'maçon':
    case 'maconnerie':
    case 'maçonnerie':
    case 'construction':
      return MACON_MODALITIES;

    // ✅ MENUISIER ALUMINIUM (Service)
    case 'menuisier_aluminium':
    case 'menuisier_alu':
    case 'menuiserie_aluminium':
    case 'menuiserie_alu':
    case 'alu_vitrerie':
    case 'aluminium_verre':
    case 'vitrerie_alu':
    case 'menuiserie_metallique':
    case 'menuisier_metallique':
    case 'fenetre_aluminium':
    case 'fenêtre_aluminium':
    case 'baie_vitree':
    case 'baie_vitrée':
    case 'vitrine_alu':
    case 'veranda':
    case 'véranda':
      return MENUISIER_ALUMINIUM_MODALITIES;

    // ✅ FORGERON / FERRONNERIE D'ART (Service)
    case 'forgeron':
    case 'ferronnerie':
    case 'ferronnerie_art':
    case 'ferronnerie_dart':
    case 'ferronnier':
    case 'fer_forge':
    case 'fer_forgé':
    case 'metallerie':
    case 'métallerie':
    case 'soudeur':
    case 'soudure_metallique':
    case 'travail_metal':
    case 'travail_fer':
    case 'artisan_fer':
    case 'serrurerie':
    case 'serrurier_metallier':
      return FORGERON_MODALITIES;

    // ✅ INGÉNIEUR / ARCHITECTE (Service conception)
    case 'ingenieur_archi':
    case 'architecte':
    case 'ingenieur':
    case 'ingénieur':
    case 'bureau_etude':
    case 'geometre':
    case 'géomètre':
      return INGENIEUR_ARCHI_MODALITIES;

    // ✅ PLOMBERIE & SANITAIRE (Produits - Vente matériel)
    case 'plomberie_sanitaire':
    case 'materiel_plomberie':
    case 'vente_plomberie':
    case 'equipement_plomberie':
      return PLOMBERIE_SANITAIRE_MODALITIES;

    // ✅ SANITAIRE (Produits)
    case 'sanitaire':
    case 'produits_sanitaires':
    case 'robinetterie':
    case 'salle_de_bain':
    case 'equipement_sanitaire':
      return SANITAIRE_MODALITIES;

    // ✅ RÉPARATION
    case 'reparation':
    case 'réparation':
    case 'depannage':
    case 'dépannage':
    case 'maintenance':
      return REPARATION_MODALITIES;

    // ✅ ÉLECTRICITÉ
    case 'electricite':
    case 'électricité':
    case 'electricien':
    case 'électricien':
    case 'installation_electrique':
      return ELECTRICITE_MODALITIES;

    // ✅ SANTÉ & BEAUTÉ
    case 'sante':
    case 'santé':
    case 'sante_beaute':
    case 'beaute':
    case 'beauté':
      return SANTE_BEAUTE_MODALITIES;

    // ✅ JURIDIQUE
    case 'juridique':
    case 'avocat':
    case 'droit':
    case 'legal':
      return JURIDIQUE_MODALITIES;

    // ✅ MUSIQUE SERVICES
    case 'musique_services':
    case 'animation_musicale':
    case 'dj':
    case 'cours_musique':
      return MUSIQUE_SERVICES_MODALITIES;

    // ✅ PHOTOGRAPHIE
    case 'photographie':
    case 'photo':
    case 'photographe':
      return PHOTOGRAPHIE_MODALITIES;

    // ✅ ENTREPRISE & INDUSTRIE
    case 'entreprise':
    case 'entreprise_industrie':
    case 'industrie':
    case 'professionnel':
      return ENTREPRISE_INDUSTRIE_MODALITIES;

    // ✅ DÉCORATION
    case 'decoration':
    case 'décoration':
    case 'deco':
    case 'déco':
      return DECORATION_MODALITIES;

    // ✅ ENFANTS & BÉBÉS
    case 'enfants':
    case 'enfants_bebes':
    case 'bebe':
    case 'bébé':
    case 'puericulture':
    case 'puériculture':
      return ENFANTS_BEBES_MODALITIES;

    // ✅ BRICOLAGE
    case 'bricolage':
    case 'outil':
    case 'outillage':
    case 'quincaillerie':
      return BRICOLAGE_MODALITIES;

    // ✅ CARRELAGE (PRODUIT - Vente de carrelage)
    case 'carrelage':
    case 'carreau':
    case 'faience':
    case 'faïence':
    case 'vente_carrelage':
    case 'materiel_carrelage':
      return CARRELAGE_MODALITIES;

    // ✅ CARRELEUR (PRESTATION - Service de pose de carrelage)
    case 'carreleur':
    case 'prestation_carrelage':
    case 'pose_carrelage':
    case 'service_carreleur':
    case 'artisan_carreleur':
      return CARRELEUR_MODALITIES;

    // ✅ MENUISERIE
    case 'menuiserie':
    case 'menuisier':
    case 'bois':
    case 'charpente':
    case 'ebenisterie':
    case 'ébénisterie':
      return MENUISERIE_MODALITIES;

    // ✅ RÉPARATEUR CLIMATISEUR
    case 'reparateur_climatiseur':
    case 'reparateur_clim':
    case 'climatiseur':
    case 'climatisation':
    case 'clim':
    case 'frigoriste':
    case 'froid':
    case 'depanneur_climatiseur':
    case 'depannage_climatiseur':
    case 'maintenance_climatiseur':
    case 'technicien_climatisation':
      return REPARATEUR_CLIMATISEUR_MODALITIES;

    // ✅ MUSIQUE & INSTRUMENTS
    case 'musique':
    case 'musique_instruments': // ✅ AJOUTÉ : nom exact de la catégorie
    case 'instrument':
    case 'instruments':
    case 'audio':
    case 'concert':
    case 'sono':
    case 'sonorisation':
    case 'dj_equipement':
    case 'studio_enregistrement':
      return MUSIQUE_INSTRUMENTS_MODALITIES;

    // ✅ EMPLOI & RECRUTEMENT
    case 'emploi':
    case 'recrutement':
    case 'job':
    case 'offre':
    case 'poste':
    case 'travail':
      return EMPLOI_MODALITIES;

    // ✅ CRÈCHE & GARDERIE D'ENFANTS
    case 'creche':
    case 'crèche':
    case 'creche_garderie':
    case 'crèche_garderie':
    case 'garderie':
    case 'garderie_enfants':
    case 'halte_garderie':
    case 'micro_creche':
    case 'micro_crèche':
    case 'jardin_enfants':
    case 'petite_enfance':
    case 'garde_enfants':
    case 'accueil_petite_enfance':
    case 'centre_petite_enfance':
    case 'nursery':
    case 'daycare':
    case 'childcare':
      return CRECHE_GARDERIE_MODALITIES;

    // ✅ PAR DÉFAUT - Aucune modalité spécifique
    default:
      console.warn('[productModalities] ⚠️ Catégorie non reconnue:', productType);
      console.log('[productModalities] Utilisation des modalités génériques par défaut');
      // Retourner des modalités de base pour toute catégorie non reconnue
      return {
        types: ['Standard', 'Premium', 'Professionnel', '\uD83C\uDD95 Autre (ajouter)'],
        etats: ['Neuf', 'Occasion - Bon état', 'Occasion - Moyen', '\uD83C\uDD95 Autre (ajouter)'],
        services: ['Installation', 'Réparation', 'Maintenance', 'Consultation', '\uD83C\uDD95 Autre (ajouter)']
      };
  }
};

// ✅ FONCTION POUR AJOUTER UNE NOUVELLE MODALITÉ
export const addCustomModality = (
  productType: string,
  fieldName: string,
  newModality: string
): void => {
  const modalities = getModalitiesByProductType(productType);
  if (modalities[fieldName]) {
    // Ajouter la nouvelle modalité avant "\uD83C\uDD95 Autre (ajouter)"
    const index = modalities[fieldName].findIndex(item => item.includes('\uD83C\uDD95 Autre'));
    if (index > -1) {
      modalities[fieldName].splice(index, 0, newModality);
    } else {
      modalities[fieldName].push(newModality);
    }
  }
};

// ✅ FONCTION POUR OBTENIR LES OPTIONS D'UN CHAMP SPÉCIFIQUE
// ✅ NOUVELLE FONCTION: Adapter les modalités au pays de l'utilisateur
// Régénère les champs géographiques ET éducatifs selon le contexte
export const getModalitiesWithUserContext = (
  productType: string,
  userCountryCode: string = 'CM'
): ModalityCategory => {
  const baseModalities = getModalitiesByProductType(productType);

  // Régénérer les champs selon le pays de l'utilisateur
  const contextualized = { ...baseModalities };

  // ════════════════════════════════════════════════════════════
  // \uD83D\uDCCD CHAMPS GÉOGRAPHIQUES (villes, quartiers, zones)
  // ════════════════════════════════════════════════════════════

  // Si le type utilise des villes, régénérer avec priorité pays utilisateur
  if (baseModalities.villes) {
    contextualized.villes = genererToutesLesVilles(userCountryCode);
  }

  // Si le type utilise des quartiers, régénérer selon le pays
  if (baseModalities.quartiers) {
    contextualized.quartiers = genererQuartiersPays(userCountryCode);
  }

  // Si le type utilise des zones d'intervention, régénérer
  if (baseModalities.zones_intervention) {
    contextualized.zones_intervention = genererZonesIntervention(userCountryCode);
  }

  // ════════════════════════════════════════════════════════════
  // \uD83C\uDF93 CHAMPS ÉDUCATIFS (matières, niveaux scolaires)
  // S'adapte au système éducatif du pays (Cameroun, RDC, CI, SN, ML...)
  // ════════════════════════════════════════════════════════════

  // Si le type utilise des matières (prestation_service éducation)
  if (baseModalities.matieres_enseignees) {
    contextualized.matieres_enseignees = genererMatieres(userCountryCode);
    console.log(`[productModalities] ✅ Matières adaptées au système éducatif ${userCountryCode}`);
  }

  // Si le type utilise des niveaux scolaires
  if (baseModalities.niveaux_scolaires) {
    contextualized.niveaux_scolaires = genererNiveauxScolaires(userCountryCode);
    console.log(`[productModalities] ✅ Niveaux scolaires adaptés au système ${userCountryCode}`);
  }

  // ════════════════════════════════════════════════════════════
  // \uD83C\uDFC6 CHAMPS PRÉPARATION CONCOURS GRANDES ÉCOLES
  // S'adapte aux concours nationaux du pays en priorité
  // ════════════════════════════════════════════════════════════

  // Si le type utilise des concours ciblés
  if (baseModalities.concours_cibles) {
    contextualized.concours_cibles = genererListeConcours(userCountryCode);
    console.log(`[productModalities] ✅ Concours adaptés au pays ${userCountryCode}`);
  }

  // Si le type utilise des matières de préparation concours
  if (baseModalities.matieres_preparation_concours) {
    contextualized.matieres_preparation_concours = genererMatieresPreparationConcours(userCountryCode);
    console.log(`[productModalities] ✅ Matières préparation concours adaptées`);
  }

  console.log(`[productModalities] Modalités complètes adaptées pour ${productType} au pays ${userCountryCode}`);

  return contextualized;
};

export const getFieldOptions = (productType: string, fieldName: string): string[] => {
  const modalities = getModalitiesByProductType(productType);
  const options = modalities[fieldName] || [];

  console.log(`[productModalities] Options pour ${productType} > ${fieldName}:`, options.length);

  // ✅ CORRECTION: Toujours ajouter l'option pour créer une nouvelle modalité
  // si elle n'existe pas déjà
  if (!options.some(opt => opt.includes('\uD83C\uDD95'))) {
    return [...options, '\uD83C\uDD95 Autre (ajouter)'];
  }

  return options;
};

// ✅ FONCTION POUR OBTENIR TOUTES LES CATÉGORIES DISPONIBLES
export const getAllCategories = (): string[] => {
  return [
    'automobile', 'immobilier', 'hotellerie', 'voyage', 'vetement', 'chaussure',
    'electromenager', 'image_son', 'telephone', 'ordinateur', 'mobilier',
    'agroalimentaire', 'livres_fournitures', 'quincaillerie',
    'prestation_service', 'pharmacie', 'cosmetique_parfum', 'bijoux',
    'coiffure_beaute', 'demenagement', 'assurance', 'jouets_enfants',
    'ustensiles_cuisine', 'pieces_auto', 'pieces_industrielles', 'restauration',
    'electronique', 'formation', 'evenementiel', 'agriculture', 'sport',
    'bien-etre', 'animaux', 'nettoyage', 'jardinage', 'securite', 'plomberie',
    'electricite', 'menuiserie', 'musique'
  ];
};

// ✅ FONCTION POUR OBTENIR LE NOMBRE TOTAL DE CATÉGORIES
export const getCategoriesCount = (): number => {
  return getAllCategories().length;
};

// ✅ FONCTION POUR VÉRIFIER SI UNE CATÉGORIE A DES MODALITÉS
export const hasModalities = (productType: string): boolean => {
  const modalities = getModalitiesByProductType(productType);
  return Object.keys(modalities).length > 0;
};

// ✅ FONCTION POUR OBTENIR LE NOMBRE DE CHAMPS AVEC MODALITÉS POUR UNE CATÉGORIE
export const getModalitiesFieldsCount = (productType: string): number => {
  const modalities = getModalitiesByProductType(productType);
  return Object.keys(modalities).length;
};


