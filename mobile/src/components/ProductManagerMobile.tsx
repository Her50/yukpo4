import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
// @ts-ignore
import { Image, Modal } from 'react-native';
// @ts-ignore
import { LinearGradient } from 'expo-linear-gradient';
// @ts-ignore
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore
import * as DocumentPicker from 'expo-document-picker';
// @ts-ignore
import * as FileSystem from 'expo-file-system';
// @ts-ignore
import SafeIcon from './SafeIcon';
// @ts-ignore
import { NativeButton, NativeInput } from './NativeDesign';
// @ts-ignore
import { modernColors } from '../theme/modernTheme';
// @ts-ignore
import BusSeatSelector from './BusSeatSelector';
// @ts-ignore
import ModernGPSModal from './ModernGPSModal';

const { width } = Dimensions.get('window');

// ✅ Fonction de normalisation sans accents pour la recherche
const normalizeText = (text: string): string => {
    return text
        .toLowerCase()
        .normalize('NFD') // Décompose les caractères accentués
        .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
        .trim();
};

// ✅ DONNÉES PROFESSIONNELLES POUR LISTES DÉROULANTES

// Marques automobiles professionnelles
const MARQUES_AUTOMOBILES = [
    'Toyota', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen', 'Ford', 'Honda',
    'Nissan', 'Hyundai', 'Kia', 'Peugeot', 'Renault', 'Citroën', 'Mazda',
    'Chevrolet', 'Jeep', 'Land Rover', 'Porsche', 'Ferrari', 'Lamborghini',
    'Bentley', 'Rolls-Royce', 'Aston Martin', 'McLaren', 'Bugatti', 'Tesla',
    'Volvo', 'Subaru', 'Mitsubishi', 'Suzuki', 'Isuzu', 'Daihatsu', 'Fiat',
    'Alfa Romeo', 'Maserati', 'Jaguar', 'Mini', 'Smart', 'Seat', 'Skoda',
    '🆕 Autre (ajouter)'
];

// Types de transmission
const TYPES_TRANSMISSION = ['Manuelle', 'Automatique', 'Semi-automatique', 'CVT', '🆕 Autre'];

// Types de carburant
const TYPES_CARBURANT = ['Essence', 'Diesel', 'Hybride', 'Électrique', 'GPL', 'Bioéthanol', '🆕 Autre'];

// États du véhicule
const ETATS_VEHICULE = ['Neuf', 'Occasion - Excellent état', 'Occasion - Bon état', 'Occasion - État moyen', 'À réparer'];

// Types immobiliers
const TYPES_IMMOBILIERS = [
    'Appartement', 'Maison individuelle', 'Villa', 'Studio', 'Duplex', 'Triplex',
    'Penthouse', 'Loft', 'Chambre', 'Bureau', 'Local commercial', 'Entrepôt',
    'Terrain nu', 'Terrain viabilisé', 'Immeuble', '🆕 Autre'
];

// Statuts immobiliers
const STATUTS_IMMOBILIERS = ['À vendre', 'À louer', 'Location courte durée', 'Colocation'];

// Niveaux d'ameublement
const NIVEAUX_AMEUBLEMENT = ['Non meublé', 'Semi-meublé', 'Meublé', 'Meublé + équipé'];

// Compagnies de voyage
const COMPAGNIES_VOYAGE = [
    'Camair-Co', 'Ethiopian Airlines', 'Kenya Airways', 'Air France', 'Turkish Airlines',
    'Brussels Airlines', 'Royal Air Maroc', 'Emirates', 'Qatar Airways', 'Asky Airlines',
    'CEIBA Intercontinental', 'Cronos Airlines', 'Toumai Air Tchad', '🆕 Autre'
];

// Classes de voyage
const CLASSES_VOYAGE = ['Économique', 'Économique Premium', 'Affaires', 'Première classe'];

// Types de véhicules de transport
const TYPES_VEHICULES_TRANSPORT = ['Bus', 'Minibus', 'Van', 'Avion', 'Train', 'Bateau'];

// Catégories hôtelières
const CATEGORIES_HOTEL = ['Sans étoile', '1 étoile', '2 étoiles', '3 étoiles', '4 étoiles', '5 étoiles', 'Palace'];

// Équipements hôteliers
const EQUIPEMENTS_HOTEL = [
    'Wi-Fi gratuit', 'Climatisation', 'Piscine', 'Restaurant', 'Bar', 'Salle de sport',
    'Spa', 'Parking gratuit', 'Service chambre 24h/24', 'Blanchisserie', 'Navette aéroport',
    'Salle de conférence', 'Coffre-fort', 'Réception 24h/24'
];

// Types d'hébergement
const TYPES_HEBERGEMENT = [
    'Hôtel', 'Hôtel-Boutique', 'Resort', 'Auberge', 'Motel',
    'Chambre d\'hôte', 'Gîte', 'Pension', 'Apart-hôtel', '🆕 Autre'
];

// Types de chambres hôtel
const TYPES_CHAMBRES_HOTEL = [
    'Chambre Simple', 'Chambre Double', 'Chambre Twin', 'Suite Junior',
    'Suite', 'Suite Présidentielle', 'Chambre Familiale', 'Studio'
];

// Types de produits disponibles
type ProductType =
    | 'immobilier_batiment'
    | 'immobilier_terrain'
    | 'hotellerie' // ✅ NOUVEAU : Hôtels, Chambres d'hôtes, Auberges
    | 'automobile'
    | 'ticket_voyage'
    | 'covoiturage'
    | 'vetement'
    | 'chaussure'
    | 'electromenager'
    | 'image_son'
    | 'telephone'
    | 'ordinateur'
    | 'mobilier'
    | 'decoration'
    | 'ustensiles_cuisine'
    | 'pieces_auto'
    | 'pieces_industrielles'
    | 'jouets_enfants'
    | 'aliments'
    | 'livres_fournitures'
    | 'quincaillerie'
    | 'prestation_service'
    | 'assurance'
    | 'pharmacie'
    | 'hopital_clinique'
    | 'demenagement'
    | 'cosmetique_parfum'
    | 'bijoux'
    | 'coiffure_beaute'
    | 'autre';

interface Product {
    id: string;
    type: ProductType;
    nom: string;
    prix: string;
    devise: string;
    description?: string;
    images?: string[]; // Tableau d'images en Base64
    videos?: string[]; // Tableau de vidéos en Base64

    // Champs spécifiques par type
    // Immobilier
    typeImmobilier?: string; // Type (Appartement, Villa, etc.)
    statutImmobilier?: string; // À vendre, À louer, etc.
    ameublement?: string; // Meublé, Semi-meublé, etc.
    superficie?: string;
    nbChambres?: string;
    nbSallesBain?: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gpsImmobilier?: string; // Coordonnées GPS de l'immobilier

    // Automobile
    marque?: string;
    modele?: string;
    etatVehicule?: string; // Neuf, Occasion, etc.
    annee?: string;
    kilometrage?: string;
    couleur?: string;
    typeCarburant?: string;
    transmission?: string;

    // Ticket de voyage
    compagnie?: string; // Compagnie de transport
    typeVehiculeTransport?: string; // Bus, Avion, Train, etc.
    classeVoyage?: string; // Économique, Affaires, etc.
    depart?: string;
    destination?: string;
    dateDepart?: string;
    heureDepart?: string;
    numeroPlace?: string;
    escales?: string; // Villes d'escale
    compagnieTransport?: string;

    // Hôtellerie (NOUVEAU)
    categorieHotel?: string; // 1-5 étoiles, Palace
    typeHebergement?: string; // Hôtel, Chambre d'hôte, Auberge, etc.
    nbChambresHotel?: string; // Nombre total de chambres
    typesChambre?: string[]; // Simple, Double, Suite, etc.
    prixParNuit?: string; // Prix minimum par nuit
    equipementsHotel?: string[]; // Wi-Fi, Piscine, Restaurant, etc.
    servicesHotel?: string; // Petit-déjeuner, Room service, etc.
    adresseHotel?: string;
    villeHotel?: string;
    gpsHotel?: string;

    // Covoiturage
    pointDepart?: string;
    pointArrivee?: string;
    dateTrajet?: string;
    heureTrajet?: string;
    nbPlacesDisponibles?: string;

    // Vêtement
    taille?: string;
    couleurVetement?: string;
    matiere?: string;
    marqueVetement?: string;

    // Chaussure
    pointure?: string;
    couleurChaussure?: string;
    marqueChaussure?: string;

    // Électroménager
    typeElectro?: string; // Réfrigérateur, Cuisinière, Four, etc.
    marqueElectro?: string;
    modeleElectro?: string;
    etat?: string;
    garantie?: string;

    // Image et Son (TV, Audio, etc.)
    marqueImageSon?: string;
    modeleImageSon?: string;
    typeImageSon?: string; // TV, Home cinéma, Enceintes, Projecteur, etc.
    diagonaleEcran?: string; // Pour TV
    resolution?: string; // HD, 4K, 8K
    etatImageSon?: string;
    garantieImageSon?: string;

    // Téléphones et Accessoires
    marqueTelephone?: string;
    modeleTelephone?: string;
    stockage?: string; // 64GB, 128GB, etc.
    ram?: string;
    etatTelephone?: string;
    couleurTelephone?: string;
    operateur?: string; // Débloqué, Orange, MTN, etc.

    // Ordinateurs et Informatique
    marqueOrdinateur?: string;
    modeleOrdinateur?: string;
    typeOrdinateur?: string; // Portable, Bureau, Tablette
    processeur?: string;
    ramOrdinateur?: string;
    stockageOrdinateur?: string;
    carteGraphique?: string;
    systemeExploitation?: string; // Windows, macOS, Linux
    etatOrdinateur?: string;

    // Décoration d'Intérieur
    typeDecoration?: string; // Tableau, Luminaire, Tapis, etc.
    style?: string; // Moderne, Classique, Vintage, etc.
    couleurDecoration?: string;
    dimensionsDecoration?: string;
    materiauDecoration?: string; // Toile, Bois, Métal, etc.

    // Ustensiles de Cuisine
    typeUstensile?: string; // Casserole, Poêle, Couteau, Mixer, etc.
    materiauUstensile?: string; // Inox, Aluminium, Plastique, Bois
    marqueUstensile?: string;
    capacite?: string; // Pour casseroles, mixers, etc.
    piecesDansSet?: string; // Nombre de pièces si set
    etatUstensile?: string;

    // Assurance
    categorieAssurance?: string; // Vie ou Non-Vie
    typeAssurance?: string; // Auto, Santé, Habitation, Vie entière, etc.
    compagnieAssurance?: string; // Nom de la compagnie d'assurance
    couverture?: string; // Étendue de la couverture
    franchise?: string; // Montant de la franchise
    dureeContrat?: string; // 1 an, 2 ans, etc.
    primeAnnuelle?: string; // Prime annuelle
    benefices?: string; // Principaux bénéfices

    // Sanitaire (Plomberie, Salle de bain)
    typeSanitaire?: string; // Robinetterie, WC, Lavabo, Baignoire, Douche
    marqueSanitaire?: string;
    materielSanitaire?: string; // Céramique, Inox, Plastique
    couleurSanitaire?: string;

    // Électricité
    typeElectricite?: string; // Câbles, Interrupteurs, Prises, Disjoncteurs, Lampes
    marqueElectricite?: string;
    puissance?: string; // Watt, Ampère
    voltage?: string; // 220V, 12V, etc.
    norme?: string; // CE, NF, etc.

    // Pièces Détachées Automobile
    typePieceAuto?: string; // Moteur, Freins, Suspension, Carrosserie, etc.
    marquePieceAuto?: string;
    referenceAuto?: string;
    compatibilite?: string; // Modèles compatibles
    etatPieceAuto?: string; // Neuf, Occasion, Reconditionné

    // Pièces Détachées Industrielles
    typePieceIndustrielle?: string; // Roulement, Courroie, Moteur, Pompe, etc.
    marquePieceIndustrielle?: string;
    referencePiece?: string;
    applicationIndustrielle?: string; // Type de machine/industrie
    materielPiece?: string;

    // Jouets pour Enfants
    typeJouet?: string; // Éducatif, Peluche, Jeu de société, Puzzle, etc.
    ageRecommande?: string; // 0-3 ans, 3-6 ans, 6+, etc.
    marqueJouet?: string;
    materielJouet?: string; // Plastique, Bois, Tissu, etc.
    normeSecurite?: string; // CE, EN71, etc.

    // Mobilier
    typeMobilier?: string; // Salon, Chambre, Bureau, etc.
    materiau?: string; // Bois, Métal, Tissu, etc.
    dimensions?: string; // LxPxH en cm
    couleurMobilier?: string;
    etatMobilier?: string; // Neuf, Occasion, Bon état

    // Aliments
    categorieAliment?: string; // Fruits, Légumes, Viande, Poisson, etc.
    origine?: string; // Locale, Importée
    dateExpiration?: string; // Date de péremption
    poids?: string; // Poids ou quantité
    conservation?: string; // Frais, Surgelé, Sec
    certification?: string; // Bio, Halal, Kasher, etc.

    // Livres et Fournitures Scolaires
    categorieLivre?: string; // Livre scolaire, Roman, Cahier, Stylo, etc.
    niveau?: string; // Maternelle, Primaire, Secondaire, Université
    matiereScolaire?: string; // Mathématiques, Français, Histoire, etc.
    auteur?: string; // Pour les livres
    editeur?: string; // Maison d'édition
    isbn?: string; // Code ISBN
    anneeEdition?: string; // Année de publication
    etatLivre?: string; // Neuf, Bon état, Occasion

    // Quincaillerie et Matériaux
    categorieQuincaillerie?: string; // Outils, Matériaux, Peinture, etc.
    marqueQuincaillerie?: string;
    referenceQuincaillerie?: string;
    unite?: string; // Pièce, Sac, Litre, etc.
    stockDisponible?: string;

    // Prestation de Service
    imagesRealisations?: string[]; // Images de réalisations
    videosRealisations?: string[]; // Vidéos de réalisations
    titreService?: string; // Rempli automatiquement depuis bloc info générale
    descriptionService?: string; // Rempli automatiquement depuis bloc info générale
    prestations?: Array<{
        nom: string;
        prixAPartirDe: string;
        description?: string;
    }>; // Liste des prestations possibles pour ce service

    // Promotion (pour tous les types de produits)
    promotionActive?: boolean;
    promotionType?: 'reduction' | 'offre' | 'bon_plan' | 'flash';
    promotionValeur?: string; // ex: "20%", "-5000 FCFA", "1+1 gratuit"
    promotionDescription?: string;
    promotionDateFin?: string;
    promotionConditions?: string;

    // Pharmacie
    typePharmacie?: string; // Garde, Normale
    heuresOuverture?: string;
    heuresFermeture?: string;
    joursGarde?: string; // Jours de garde
    telephoneUrgence?: string;
    services?: string; // Services disponibles

    // Hôpital/Clinique
    typeEtablissement?: string; // Hôpital, Clinique, Centre de santé
    specialites?: string[]; // Liste des spécialités
    medecinsDisponibles?: string;
    horairesConsultation?: string;
    urgencesDisponible?: boolean;
    rdvEnLigne?: boolean;
    banqueSang?: boolean; // Disponibilité d'une banque de sang
    prestationsMedicales?: string[]; // Liste des prestations médicales disponibles
    planningHebdomadaire?: { [key: string]: { jours?: string; moment?: string; debut?: string; fin?: string; permanent?: boolean } }; // Planning par prestation avec jours et moment

    // Déménagement
    typeDemenagement?: string; // Local, National, International
    volumeEstime?: string; // En m³
    typeVehicule?: string; // Camionnette, Camion 20m³, etc.
    distanceKm?: string;
    nbDemenageurs?: string;
    assuranceMarchandise?: boolean;
    serviceManutention?: boolean;
    montageDemontage?: boolean;
    emballageCartons?: boolean;
    gardeMeuble?: boolean;
    debarras?: boolean;
    dateDemenagementDisponible?: string;
    // Champs cosmétique & parfum
    typeCosmetique?: string;
    marqueCosmetique?: string;
    volumeCosmetique?: string;
    uniteCosmetique?: string;
    typePeau?: string;
    ageRecommandé?: string;
    ingredientsCosmetique?: string;
    origineCosmetique?: string;
    // Champs bijoux
    typeBijou?: string;
    matiereBijou?: string;
    poidsBijou?: string;
    unitePoids?: string;
    tailleBijou?: string;
    styleBijou?: string;
    origineBijou?: string;
    certificatBijou?: string;

    // Champs coiffure_beaute
    typeCoiffure?: string; // mèches, extensions, perruques, accessoires
    longueurMech?: string; // longueur des mèches/extensions
    couleurMech?: string; // couleur des mèches
    textureMech?: string; // texture (lisse, bouclée, ondulée)
    typePose?: string; // type de pose (clip, collé, tissé, etc.)
    marqueCoiffure?: string; // marque du produit
    origineMech?: string; // origine des cheveux
    entretienMech?: string; // conseils d'entretien
    dureeVie?: string; // durée de vie du produit
    typeCheveux?: string; // type de cheveux (naturel, synthétique, mixte)
}

interface ProductManagerMobileProps {
    products: Product[];
    onProductsChange: (products: Product[]) => void;
    readonly?: boolean;
    titreService?: string; // Titre depuis bloc info générale
    descriptionService?: string; // Description depuis bloc info générale
}

// Configuration des types de produits avec noms adaptés
const PRODUCT_TYPES = [
    { value: 'aliments', label: 'Aliments et Produits Frais', icon: '🍎', color: '#84CC16', description: 'Fruits, légumes, viandes, poissons, produits frais et secs' },
    { value: 'assurance', label: 'Assurance et Protection', icon: '🛡️', color: '#14B8A6', description: 'Assurance auto, santé, habitation, vie, protection sociale' },
    { value: 'automobile', label: 'Automobiles et Véhicules', icon: '🚗', color: '#EF4444', description: 'Voitures, motos, camions, véhicules utilitaires' },
    { value: 'chaussure', label: 'Chaussures et Accessoires', icon: '👟', color: '#6366F1', description: 'Chaussures, baskets, sandales, bottes' },
    { value: 'covoiturage', label: 'Covoiturage et Trajets', icon: '🚙', color: '#F59E0B', description: 'Trajets partagés, carpooling, transport collectif' },
    { value: 'decoration', label: 'Décoration Intérieure', icon: '🖼️', color: '#E91E63', description: 'Tableaux, luminaires, tapis, accessoires déco' },
    { value: 'electricite', label: 'Électricité et Éclairage', icon: '⚡', color: '#FFC107', description: 'Câbles, prises, interrupteurs, lampes, disjoncteurs' },
    { value: 'electromenager', label: 'Électroménager Domestique', icon: '🔌', color: '#14B8A6', description: 'Frigos, fours, machines à laver, micro-ondes' },
    { value: 'hopital_clinique', label: 'Établissements de Santé', icon: '🏥', color: '#DC2626', description: 'Hôpitaux, cliniques, centres médicaux, spécialités' },
    { value: 'hotellerie', label: 'Hôtellerie et Hébergement', icon: '🏨', color: '#EC4899', description: 'Hôtels, chambres d\'hôtes, auberges, gîtes, réservations' },
    { value: 'image_son', label: 'Image et Son', icon: '📺', color: '#9C27B0', description: 'TV, home cinéma, enceintes, projecteurs, systèmes audio' },
    { value: 'immobilier_batiment', label: 'Immobilier - Vente/Location', icon: '🏢', color: '#3B82F6', description: 'Appartements, villas, maisons à vendre ou louer (long terme)' },
    { value: 'immobilier_terrain', label: 'Immobilier - Terrains', icon: '🏞️', color: '#10B981', description: 'Terrains constructibles, parcelles, lots' },
    { value: 'jouets_enfants', label: 'Jouets et Articles pour Enfants', icon: '🧸', color: '#FF69B4', description: 'Jouets éducatifs, peluches, jeux, puzzles, livres enfants' },
    { value: 'livres_fournitures', label: 'Livres et Fournitures Scolaires', icon: '📚', color: '#7C3AED', description: 'Manuels, livres, cahiers, stylos, fournitures' },
    { value: 'mobilier', label: 'Mobilier et Ameublement', icon: '🪑', color: '#F97316', description: 'Meubles salon, chambre, bureau, rangement' },
    { value: 'ordinateur', label: 'Ordinateurs et Informatique', icon: '💻', color: '#00BCD4', description: 'PC portables, bureaux, tablettes, accessoires' },
    { value: 'pharmacie', label: 'Pharmacies et Gardes', icon: '💊', color: '#059669', description: 'Pharmacies, planning de garde, services pharmaceutiques' },
    { value: 'demenagement', label: 'Déménagement et Transport', icon: '📦', color: '#F97316', description: 'Services de déménagement local, national et international' },
    { value: 'cosmetique_parfum', label: 'Cosmétique & Parfum', icon: '✨', color: '#E91E63', description: 'Parfums, maquillage, soins beauté, huiles, crèmes' },
    { value: 'bijoux', label: 'Bijoux & Accessoires', icon: '💎', color: '#FFD700', description: 'Colliers, bagues, bracelets, montres, pierres précieuses' },
    { value: 'coiffure_beaute', label: 'Coiffure & Beauté', icon: '💇‍♀️', color: '#E91E63', description: 'Mèches, extensions, perruques, accessoires de coiffure, soins cheveux' },
    { value: 'pieces_auto', label: 'Pièces Détachées Auto', icon: '🔧', color: '#607D8B', description: 'Pièces moteur, freins, carrosserie, filtres, batteries' },
    { value: 'pieces_industrielles', label: 'Pièces Industrielles', icon: '⚙️', color: '#455A64', description: 'Roulements, courroies, moteurs, pompes, pièces machines' },
    { value: 'prestation_service', label: 'Prestation de Service', icon: '🎯', color: '#8B5CF6', description: 'Plombier, électricien, mécanicien, coiffeur, développeur...', keywords: ['plombier', 'électricien', 'mécanicien', 'menuisier', 'peintre', 'maçon', 'carreleur', 'soudeur', 'serrurier', 'vitrier', 'plâtrier', 'couvreur', 'charpentier', 'ébéniste', 'tapissier', 'décorateur', 'jardinier', 'paysagiste', 'élagueur', 'coiffeur', 'barbier', 'esthéticienne', 'manucure', 'massage', 'spa', 'kinésithérapeute', 'ostéopathe', 'infirmier', 'sage-femme', 'aide-soignant', 'auxiliaire', 'photographe', 'vidéaste', 'graphiste', 'designer', 'développeur', 'programmeur', 'webmaster', 'informaticien', 'technicien', 'réparateur', 'dépanneur', 'installateur', 'monteur', 'agent', 'nettoyage', 'entretien', 'ménage', 'repassage', 'cuisinier', 'traiteur', 'pâtissier', 'boulanger', 'serveur', 'barman', 'chauffeur', 'livreur', 'coursier', 'déménageur', 'manutentionnaire', 'gardien', 'vigile', 'agent de sécurité', 'coach', 'formateur', 'professeur', 'enseignant', 'répétiteur', 'tuteur', 'traducteur', 'interprète', 'rédacteur', 'correcteur', 'secrétaire', 'assistant', 'comptable', 'auditeur', 'consultant', 'conseiller', 'expert', 'avocat', 'juriste', 'notaire', 'huissier', 'architecte', 'ingénieur', 'géomètre', 'topographe', 'vétérinaire', 'dresseur', 'toiletteur', 'DJ', 'musicien', 'animateur', 'présentateur', 'artiste', 'comédien', 'danseur', 'maquilleur', 'styliste', 'couturier', 'tailleur', 'cordonnier', 'tapissier', 'sellier', 'bijoutier', 'horloger', 'opticien', 'prothésiste', 'dentiste', 'orthodontiste', 'pédicure', 'podologue', 'sophrologue', 'psychologue', 'psychiatre', 'nutritionniste', 'diététicien', 'coach sportif', 'personal trainer', 'yoga', 'pilates', 'danse', 'sport', 'guide', 'accompagnateur', 'moniteur', 'instructeur', 'analyste', 'data scientist', 'statisticien', 'économiste', 'chercheur', 'scientifique', 'laborantin', 'pharmacien', 'préparateur', 'radiologiste', 'échographiste', 'technicien médical', 'ambulancier', 'secouriste', 'pompier', 'agent immobilier', 'promoteur', 'syndic', 'gestionnaire', 'administrateur', 'directeur', 'manager', 'chef de projet', 'coordinateur', 'superviseur', 'contrôleur', 'inspecteur', 'évaluateur', 'expert-comptable', 'fiscaliste', 'commissaire aux comptes', 'assureur', 'courtier', 'agent général', 'banquier', 'conseiller financier', 'trader', 'cambiste', 'caissier', 'guichetier', 'vendeur', 'commercial', 'télévendeur', 'VRP', 'représentant', 'agent commercial', 'négociateur', 'acheteur', 'approvisionneur', 'logisticien', 'magasinier', 'gestionnaire de stock', 'préparateur de commandes', 'cariste', 'grutier', 'conducteur', 'opérateur', 'machiniste', 'usineur', 'tourneur', 'fraiseur', 'ajusteur', 'monteur', 'assembleur', 'câbleur', 'électronicien', 'automaticien', 'roboticien', 'mécanicien auto', 'mécanicien moto', 'carrossier', 'peintre auto', 'tôlier', 'mécanicien poids lourds', 'mécanicien agricole', 'dépanneur auto', 'garagiste', 'vulcanisateur', 'climaticien', 'frigoriste', 'chauffagiste', 'sanitaire', 'zingueur'] },
    { value: 'quincaillerie', label: 'Quincaillerie, Sanitaire & Électricité', icon: '🔨', color: '#F59E0B', description: 'Outils, matériaux, plomberie, électricité, construction', keywords: ['quincaillerie', 'outil', 'marteau', 'tournevis', 'clé', 'pince', 'scie', 'perceuse', 'visseuse', 'meuleuse', 'ponceuse', 'raboteuse', 'tronçonneuse', 'matériaux', 'ciment', 'sable', 'gravier', 'brique', 'parpaing', 'fer', 'acier', 'béton', 'mortier', 'chaux', 'plâtre', 'peinture', 'vernis', 'colle', 'mastic', 'silicone', 'joint', 'sanitaire', 'plomberie', 'robinet', 'robinetterie', 'mitigeur', 'mélangeur', 'douche', 'baignoire', 'lavabo', 'évier', 'WC', 'toilette', 'chasse', 'tuyau', 'canalisation', 'raccord', 'coude', 'té', 'vanne', 'électricité', 'électrique', 'câble', 'fil', 'interrupteur', 'prise', 'disjoncteur', 'tableau', 'lampe', 'ampoule', 'LED', 'néon', 'spot', 'applique', 'lustre', 'plafonnier', 'variateur', 'minuterie', 'détecteur', 'sonnette', 'multiprise', 'rallonge', 'domino', 'gaine', 'conduit'] },
    { value: 'telephone', label: 'Téléphones et Accessoires', icon: '📱', color: '#FF9800', description: 'Smartphones, accessoires, coques, écouteurs' },
    { value: 'ticket_voyage', label: 'Tickets et Billets de Transport', icon: '🎫', color: '#8B5CF6', description: 'Bus, train, avion avec sélection de place' },
    { value: 'ustensiles_cuisine', label: 'Ustensiles de Cuisine', icon: '🍴', color: '#FF5722', description: 'Casseroles, poêles, couteaux, mixers, batterie cuisine' },
    { value: 'vetement', label: 'Vêtements et Prêt-à-Porter', icon: '👕', color: '#EC4899', description: 'Vêtements, habits, articles de mode' },
    { value: 'autre', label: 'Autres Produits', icon: '📦', color: '#6B7280', description: 'Autres types de produits et services' },
] as const;

// Modèles Excel pour chaque type de produit
const EXCEL_TEMPLATES = {
    immobilier_batiment: `Nom,Prix,Devise,Description,Superficie,Chambres,Salles de bain,Adresse,Quartier,Ville,GPS
Appartement F4,50000000,XAF,Bel appartement moderne avec balcon,120,4,2,Rue des Jardins,Bonanjo,Douala,4.0511°N 9.7679°E
Villa R+2,150000000,XAF,Villa spacieuse avec piscine et jardin,300,6,4,Avenue Kennedy,Bonapriso,Douala,4.0604°N 9.7135°E
Studio meublé,20000,EUR,Studio moderne tout équipé centre-ville,35,1,1,Av. de Gaulle,Akwa,Douala,4.0490°N 9.6976°E`,

    immobilier_terrain: `Nom,Prix,Devise,Description,Superficie,Adresse,Quartier,Ville,GPS
Terrain 500m²,25000000,XAF,Terrain viabilisé prêt à construire,500,Zone industrielle,Logpom,Douala,4.0881°N 9.7043°E
Parcelle 1000m²,45000000,XAF,Terrain constructible bien situé,1000,Rue des Cocotiers,Akwa,Douala,4.0490°N 9.6976°E
Terrain agricole 2ha,15000,USD,Terrain fertile zone rurale irrigation possible,20000,Route agricole,Ndogpassi,Douala,4.0792°N 9.7311°E`,

    automobile: `Nom,Prix,Devise,Description,Marque,Modèle,Année,Kilométrage,Couleur,Carburant,Transmission
Toyota Corolla,8500000,XAF,Voiture en excellent état avec révision complète,Toyota,Corolla,2018,65000,Blanche,Essence,Automatique
Honda Civic,7500000,XAF,Véhicule bien entretenu avec historique complet,Honda,Civic,2017,75000,Grise,Essence,Manuelle
Mercedes Classe E,25000,EUR,Berline luxe full options cuir GPS,Mercedes,Classe E,2019,45000,Noire,Diesel,Automatique`,

    ticket_voyage: `Nom,Prix,Devise,Description,Départ,Destination,Date,Heure,Place,Compagnie
Douala-Yaoundé,3500,XAF,Trajet direct avec arrêt climatisation,Douala,Yaoundé,2024-01-15,08:00,A12,Touristique Express
Yaoundé-Bafoussam,5000,XAF,Bus VIP grand confort avec collation,Yaoundé,Bafoussam,2024-01-16,14:00,B05,Central Voyages
Paris-Londres,150,EUR,Train Eurostar confort 1ère classe,Paris,Londres,2024-02-10,10:30,12,Eurostar`,

    hotellerie: `Nom,Prix par nuit,Devise,Description,Type,Catégorie,Nombre de chambres,Adresse,Ville,GPS
Hôtel Sawa,45000,XAF,Hôtel moderne centre-ville avec restaurant et piscine,Hôtel,3 étoiles,35,Boulevard de la Liberté,Douala,4.0511°N 9.7679°E
Auberge du Lac,25000,XAF,Auberge chaleureuse au bord du lac avec vue panoramique,Auberge,2 étoiles,12,Route du Lac,Yaoundé,3.8480°N 11.5021°E
Resort Paradise,150,EUR,Resort 5 étoiles luxe avec spa et plage privée,Resort,5 étoiles,85,Front de mer,Kribi,2.9483°N 9.9086°E`,

    covoiturage: `Nom,Prix,Devise,Description,Départ,Arrivée,Date,Heure,Places disponibles
Trajet Douala-Yaoundé,2500,XAF,Voiture confortable et sécurisée avec climatisation,Bonanjo,Centre-ville Yaoundé,2024-01-15,06:00,3
Trajet Yaoundé-Bafoussam,3500,XAF,SUV climatisé spacieux avec bagages,Yaoundé,Bafoussam,2024-01-16,10:00,4
Trajet aéroport,15,USD,Transport aéroport vers centre-ville,Aéroport Douala,Bonanjo,2024-01-20,14:00,2`,

    vetement: `Nom,Prix,Devise,Description,Taille,Couleur,Matière,Marque
T-shirt casual,5000,XAF,T-shirt confortable pour usage quotidien,L,Bleu,Coton,Nike
Robe élégante,25000,XAF,Robe de soirée élégante et raffinée,M,Rouge,Soie,Zara
Chemise business,45,EUR,Chemise homme coupe slim 100% coton,M,Blanc,Coton,Hugo Boss`,

    chaussure: `Nom,Prix,Devise,Description,Pointure,Couleur,Marque
Baskets sport,35000,XAF,Chaussures de running haute performance,42,Noire,Adidas
Sandales,15000,XAF,Sandales d'été confortables et légères,38,Marron,Clarks
Chaussures ville cuir,85,USD,Souliers cuir véritable homme élégant,43,Marron,Clarks`,

    electromenager: `Nom,Prix,Devise,Description,Type,Marque,Modèle,État,Garantie
Réfrigérateur Samsung RT50,250000,XAF,Grand réfrigérateur double porte avec congélateur,Réfrigérateur,Samsung,RT50K6000S8,Neuf,2 ans
Cuisinière 4 feux,125000,EUR,Cuisinière à gaz 4 feux avec four,Cuisinière,Beko,FSG62000DW,Neuf,1 an
Micro-ondes LG,45000,XAF,Micro-ondes 800W avec grill et minuteur,Micro-ondes,LG,MS2535,Bon état,6 mois`,

    mobilier: `Nom,Prix,Devise,Description,Type,Matériau,Dimensions,Couleur,État
Canapé 3 places,85000,XAF,Canapé confortable avec coussins moelleux,Salon,Tissu,200x90x85,Gris,Neuf
Table à manger,65000,EUR,Table élégante pour 6 personnes,Salle à manger,Bois massif,180x90x75,Marron,Bon état
Bureau moderne,45000,XAF,Bureau spacieux avec tiroirs de rangement,Bureau,Bois/Métal,120x60x75,Blanc,Neuf`,

    decoration: `Nom,Prix,Devise,Description,Type,Style,Couleur,Dimensions,Matériau
Tableau abstrait moderne,25000,XAF,Tableau peint à la main style contemporain,Tableau,Moderne,Multicolore,80x60 cm,Toile
Lampe design scandinave,15000,EUR,Luminaire minimaliste avec abat-jour tissu,Luminaire,Scandinave,Blanc et bois,45 cm,Bois/Tissu
Tapis berbère artisanal,45000,XAF,Tapis fait main motifs traditionnels,Tapis,Bohème,Beige et rouge,200x150 cm,Laine`,

    assurance: `Nom,Prix,Devise,Description,Catégorie,Type,Compagnie,Couverture,Prime annuelle,Franchise,Durée,Bénéfices
Assurance auto tous risques,180000,XAF,Protection complète pour véhicule,Non-Vie,Auto,AXA Cameroun,Dommages + Vol + Incendie + RC,180000,100000,1 an,Assistance 24h|Véhicule remplacement|Protection juridique
Assurance vie temporaire,120000,USD,Assurance décès avec capital garanti,Vie,Temporaire décès,NSIA Assurances,Capital décès 50M|Invalidité permanente,120000,0,5 ans,Capital décès|Rente conjoint|Protection famille
Assurance habitation,95000,XAF,Protection logement et responsabilité civile,Non-Vie,Habitation,Activa Assurance,Incendie|Dégâts eaux|Vol|RC,95000,50000,2 ans,Relogement|Assistance juridique|Remplacement`,

    aliments: `Nom,Prix,Devise,Description,Catégorie,Origine,Date expiration,Poids/Quantité,Conservation,Certification
Tomates fraîches,500,XAF,Tomates rouges mûres et juteuses du terroir,Légumes,Locale,2024-02-01,1kg,Frais,Bio
Poulet fermier,3500,XAF,Poulet élevé en plein air nourri au grain,Viande,Locale,2024-01-25,1.5kg,Frais,Halal
Mangues Kent,1500,XAF,Mangues sucrées et parfumées de saison,Fruits,Locale,2024-02-05,2kg,Frais,Bio
Riz basmati premium,12,USD,Riz basmati qualité supérieure grain long,Céréales,Importée,2025-12-31,25kg,Sec,Standard
Fromage Emmental,8,EUR,Fromage suisse qualité AOP,Produits laitiers,Importée,2024-03-15,500g,Frais,AOC`,

    telephone: `Nom,Prix,Devise,Description,Marque,Modèle,Stockage,RAM,État,Couleur,Opérateur
iPhone 13 Pro,450000,XAF,iPhone excellent état boîte complète,Apple,iPhone 13 Pro,256GB,6GB,Bon état,Graphite,Débloqué
Samsung Galaxy S22,380000,XAF,Samsung dernière génération garantie,Samsung,Galaxy S22,128GB,8GB,Neuf,Blanc,Débloqué
Google Pixel 7,550,USD,Pixel 7 photo exceptionnelle Android pur,Google,Pixel 7,256GB,8GB,Neuf,Noir,Débloqué`,

    ordinateur: `Nom,Prix,Devise,Description,Type,Marque,Modèle,Processeur,RAM,Stockage,Carte graphique,OS,État
MacBook Pro M2,1200,EUR,MacBook Pro puce M2 parfait état,Portable,Apple,MacBook Pro 14,M2 Pro,16GB,512GB SSD,Intégrée,macOS,Neuf
Dell XPS 15,950000,XAF,PC portable puissant développement gaming,Portable,Dell,XPS 15,Intel i7-12700H,32GB,1TB SSD,RTX 3050,Windows 11,Neuf
PC Gamer Desktop,1800,USD,Tour gaming RGB watercooling,Bureau,Custom,RGB Gaming,AMD Ryzen 9,64GB,2TB NVMe,RTX 4080,Windows 11,Neuf`,

    image_son: `Nom,Prix,Devise,Description,Marque,Modèle,Type,Diagonale,Résolution,État,Garantie
TV Samsung 55 pouces,350000,XAF,Smart TV 4K HDR apps intégrées,Samsung,QE55Q80B,TV,55 pouces,4K UHD,Neuf,2 ans
Home Cinéma Sony,180000,XAF,Système 5.1 Bluetooth Dolby Atmos,Sony,HT-S40R,Home cinéma,N/A,N/A,Neuf,1 an
Barre de son LG,95,EUR,Barre son Dolby Atmos wireless,LG,SP9YA,Barre de son,N/A,N/A,Bon état,6 mois`,

    livres_fournitures: `Nom,Prix,Devise,Description,Catégorie,Niveau,Matière,Auteur,Éditeur,ISBN,Année édition,État
Mathématiques Terminale C,8500,XAF,Manuel complet avec exercices corrigés et cours détaillés,Livre scolaire,Secondaire,Mathématiques,Collection CIAM,Edicef,978-2-7531-0584-3,2023,Neuf
Cahier grand format,500,XAF,Cahier 200 pages grands carreaux de qualité supérieure,Cahier,Primaire,Tous,N/A,Oxford,N/A,2024,Neuf
Pack stylos BIC,2000,XAF,Lot de 10 stylos à bille bleus et noirs longue durée,Stylos,Tous,Tous,N/A,BIC,N/A,2024,Neuf
Histoire du Cameroun,12000,XAF,Ouvrage de référence sur l'histoire précoloniale à nos jours,Livre,Université,Histoire,Prof. Mveng,Clé,978-2-35191-045-7,2022,Bon état
Roman Le Vieux Nègre,6,EUR,Roman classique littérature africaine,Roman,Tous,Français,Ferdinand Oyono,Pocket,978-2-266-14563-2,2006,Bon état`,

    pieces_auto: `Nom,Prix,Devise,Description,Type,Marque,Référence,Compatibilité,État
Pneu Michelin 205/55 R16,45000,XAF,Pneu toutes saisons excellent grip,Pneumatiques,Michelin,205/55R16 91V,Toyota Corolla|Honda Civic,Neuf
Batterie Varta 12V 60Ah,35000,XAF,Batterie démarrage forte puissance,Batterie,Varta,D59,Universel,Neuf
Plaquettes de frein Bosch,18000,XAF,Plaquettes avant céramique,Freins,Bosch,0986494XXX,Mercedes Classe C,Neuf
Filtre à huile Mann,2500,XAF,Filtre huile moteur haute filtration,Filtres,Mann-Filter,HU 819 x,BMW Série 3,Neuf
Amortisseur avant Bilstein,125,EUR,Amortisseur gaz haute performance,Suspension,Bilstein,B4,Audi A4,Neuf`,

    pieces_industrielles: `Nom,Prix,Devise,Description,Type,Marque,Référence,Application,Matériel
Roulement SKF 6205,8500,XAF,Roulement à billes étanche haute vitesse,Roulement,SKF,6205-2RS,Machines outils|Pompes,Acier
Courroie trapézoïdale,4500,XAF,Courroie transmission résistante chaleur,Courroie,Gates,XPZ1120,Compresseurs|Ventilateurs,Caoutchouc
Moteur électrique 5.5kW,285000,XAF,Moteur asynchrone triphasé rendement,Moteur,ABB,M2QA 132M,Machines diverses,Fonte/Cuivre
Pompe centrifuge,95,USD,Pompe eau centrifuge débit 50m³/h,Pompe,Grundfos,CR 5-11,Irrigation|Industrie,Fonte/Inox`,

    jouets_enfants: `Nom,Prix,Devise,Description,Type,Âge recommandé,Marque,Matériel,Norme
Puzzle éducatif 100 pièces,3500,XAF,Puzzle animaux Afrique éducatif,Éducatif,6-10 ans,Ravensburger,Carton,CE
Peluche lion,8500,XAF,Peluche douce lavable hypoallergénique,Peluche,0-3 ans,Jellycat,Tissu,EN71
Jeu de société Monopoly,15000,XAF,Monopoly édition camerounaise famille,Jeu de société,8+ ans,Hasbro,Plastique/Carton,CE
LEGO Classic 900 pièces,45,EUR,Briques construction créativité infinie,Construction,4-99 ans,LEGO,Plastique,EN71`,

    ustensiles_cuisine: `Nom,Prix,Devise,Description,Type,Matériau,Marque,Capacité,Pièces,État
Batterie cuisine 12 pièces,55000,XAF,Set complet casseroles poêles couvercles,Set,Inox,Tefal,Mixte,12,Neuf
Poêle antiadhésive 28cm,12000,XAF,Poêle professionnelle revêtement titanium,Poêle,Aluminium,Tefal,N/A,1,Neuf
Mixer plongeant Bosch,25000,XAF,Mixeur puissant 800W accessoires,Mixer,Plastique/Inox,Bosch,N/A,1,Neuf
Set couteaux céramique,35,USD,Set 5 couteaux céramique ultra-tranchant,Couteaux,Céramique,Kyocera,N/A,5,Neuf`,

    quincaillerie: `Nom,Prix,Devise,Description,Catégorie,Marque,Référence,Unité,Stock disponible
Marteau menuisier,5000,XAF,Marteau professionnel manche bois robuste et tête acier,Outils,Stanley,STHT0-51309,Pièce,50
Peinture blanche 25L,35000,XAF,Peinture acrylique mat lessivable pour intérieur et extérieur,Peinture,Dulux,25L-BL-MAT,Seau,20
Ciment gris,4500,XAF,Ciment Portland haute résistance qualité premium,Matériaux,Cimencam,CEM-II-42.5,Sac 50kg,100
Robinet mitigeur,12000,XAF,Mitigeur lavabo chromé avec aérateur économique,Sanitaire,Grohe,32467001,Pièce,30
Câble électrique 2.5mm,8500,XAF,Câble souple 2.5mm² pour installation électrique domestique,Électricité,Nexans,H07V-U,Mètre,500
Interrupteur double,1500,XAF,Interrupteur va-et-vient double commande blanc,Électricité,Legrand,099520,Pièce,100`,

    prestation_service: `Nom,Prix,Devise
Portfolio Réalisation 1,0,XAF
Portfolio Réalisation 2,0,XAF`,

    pharmacie: `Nom,Prix,Devise,Description,Type,Heures ouverture,Heures fermeture,Jours de garde,Téléphone urgence,Services
Pharmacie Centrale,0,XAF,Pharmacie de garde disponible 24h/24 pour urgences médicales,Garde,00:00,23:59,Lundi-Dimanche,+237 6XX XX XX XX,Garde|Délivrance|Conseil
Pharmacie du Marché,0,XAF,Pharmacie de proximité avec conseil pharmaceutique gratuit,Normale,08:00,20:00,Lundi-Samedi,+237 6XX XX XX XX,Délivrance|Conseil`,

    hopital_clinique: `Nom,Prix,Devise,Description,Type,Banque de sang,Prestations médicales,Planning,Urgences 24h/24,RDV en ligne
Hôpital Général,0,XAF,Établissement public avec service d'urgences et banque de sang,Hôpital,Oui,Chirurgie|Consultation générale|Radiologie|Laboratoire,Lun-Ven 08:00-18:00,Oui,Non
Clinique Saint-Joseph,0,XAF,Clinique privée spécialisée avec RDV en ligne,Clinique,Non,Gynécologie|Ophtalmologie|Pédiatrie,Lun-Sam 09:00-19:00,Non,Oui`,

    demenagement: `Nom,Prix,Devise,Description,Type,Volume m³,Type véhicule,Distance km,Nb déménageurs,Assurance,Manutention,Montage/Démontage,Emballage,Garde-meuble,Débarras
Déménagement Express,50000,XAF,Déménagement local rapide avec équipe professionnelle,Local,20,Camion 20m³,50,3,Oui,Oui,Oui,Non,Non,Non
Trans-Afrique Déménagement,150000,XAF,Déménagement international avec assurance tous risques,International,40,Camion 40m³,1500,5,Oui,Oui,Oui,Oui,Oui,Non`,

    cosmetique_parfum: `Nom,Prix,Devise,Description,Type,Marque,Volume,Concentration,Peau,Âge,Ingrédients,Origine
Crème Hydratante Nivea,15000,XAF,Crème hydratante pour peau normale,Soin visage,Nivea,50ml,24h,Toutes,18+,Vitamine E,France
Parfum Chanel N°5,85000,XAF,Parfum féminin iconique aux notes florales,Parfum,Chanel,50ml,EDP,Femme,18+,Rose jasmin,France
Huile d'Argan Bio,25000,XAF,Huile d'argan pure 100% bio pour cheveux et corps,Soin corps,Argania,100ml,100%,Toutes,16+,Argan pur,Maroc
Rouge à Lèvres MAC,18000,XAF,Rouge à lèvres mat longue tenue,Maquillage,MAC,3g,Mat,Femme,16+,Cire d'abeille,Canada`,

    bijoux: `Nom,Prix,Devise,Description,Type,Matière,Poids,Carat,Taille,Style,Origine,Certificat
Collier Or 18 carats,450000,XAF,Collier en or jaune 18 carats avec pendentif,Collier,Or,15g,18,16 pouces,Classique,Italie,Oui
Bague Diamant,750000,XAF,Bague de fiançailles diamant solitaire,Bague,Or blanc,8g,1 carat,54,Moderne,Belgique,GIA
Bracelet Argent,35000,XAF,Bracelet en argent sterling avec perles,Bracelet,Argent,12g,925,18 cm,Bohemian,Mexique,Non
Montre Rolex Submariner,25000,USD,Montre de plongée automatique étanche,Montre,Acier,150g,0,40mm,Sport,Suisse,Oui`,

    coiffure_beaute: `Nom,Prix,Devise,Description,Type,Longueur,Couleur,Texture,Type pose,Marque,Origine,Entretien,Durée vie,Type cheveux
Mèches Brésiliennes 50cm,85000,XAF,Mèches naturelles brésiliennes de qualité premium,Mèches,50cm,Châtain,Brésilienne,Clip,Remy Hair,Brésil,Shampooing doux,6 mois,Naturel
Extensions Indiennes 60cm,120000,XAF,Extensions de cheveux indiens remy 100% naturels,Extensions,60cm,Noir,Indienne,Tissé,Indian Hair,Inde,Produits sans sulfate,8 mois,Naturel
Perruque Synthétique,45000,XAF,Perruque synthétique résistante à la chaleur,Perruque,40cm,Blond,Synthétique,Clip,Beauty World,Chine,Shampooing froid,3 mois,Synthétique
Accessoires Coiffure,15000,XAF,Lot d'accessoires pour coiffure professionnelle,Accessoires,Variable,Variable,Variable,Variable,Pro Style,Chine,Nettoyage régulier,1 an,Variable`,

    autre: `Nom,Prix,Devise,Description
Produit 1,10000,XAF,Description détaillée du produit 1 avec ses caractéristiques
Produit 2,20000,XAF,Description complète du produit 2 et ses avantages`
};

const ProductManagerMobile: React.FC<ProductManagerMobileProps> = ({
    products,
    onProductsChange,
    readonly = false,
    titreService,
    descriptionService
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedType, setSelectedType] = useState<ProductType | null>(null);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState<'type' | 'form'>('type');
    const [showSeatSelector, setShowSeatSelector] = useState(false);
    const [searchQuery, setSearchQuery] = useState(''); // Recherche textuelle dans dropdown
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPSLocation, setSelectedGPSLocation] = useState<{ lat: number; lng: number } | null>(null);

    const [newProduct, setNewProduct] = useState<Partial<Product>>({
        type: 'autre',
        nom: '',
        prix: '',
        devise: 'XAF',
        description: '',
        images: [],
        videos: []
    });

    const devises = ['XAF', 'EUR', 'USD']; // ✅ Devises principales : FCFA, Euro, Dollar

    // ✅ Fonction pour obtenir le label adapté selon la catégorie
    const getProductNameLabel = (type: ProductType | null): string => {
        if (!type) return 'Nom du produit';

        const labels: Record<ProductType, string> = {
            immobilier_batiment: 'Titre du bien',
            immobilier_terrain: 'Titre du terrain',
            hotellerie: 'Nom de l\'établissement',
            automobile: 'Désignation du véhicule',
            ticket_voyage: 'Trajet / Titre du billet',
            covoiturage: 'Titre du trajet',
            vetement: 'Nom de l\'article',
            chaussure: 'Nom de la chaussure',
            electromenager: 'Nom de l\'appareil',
            image_son: 'Nom de l\'appareil',
            telephone: 'Modèle du téléphone',
            ordinateur: 'Modèle de l\'ordinateur',
            mobilier: 'Nom du meuble',
            decoration: 'Nom de l\'article déco',
            ustensiles_cuisine: 'Nom de l\'ustensile',
            pieces_auto: 'Référence de la pièce',
            pieces_industrielles: 'Référence de la pièce',
            jouets_enfants: 'Nom du jouet',
            aliments: 'Nom du produit',
            livres_fournitures: 'Titre / Nom',
            quincaillerie: 'Nom du produit',
            prestation_service: 'Nom de la prestation',
            assurance: 'Type d\'assurance',
            pharmacie: 'Nom de la pharmacie',
            hopital_clinique: 'Nom de l\'établissement',
            demenagement: 'Titre de l\'offre',
            cosmetique_parfum: 'Nom du produit',
            bijoux: 'Nom du bijou',
            coiffure_beaute: 'Nom du produit',
            autre: 'Nom du produit'
        };

        return labels[type] || 'Nom du produit';
    };

    // Fonction pour obtenir un exemple de nom de produit selon le type
    const getProductNamePlaceholder = (type: ProductType | null): string => {
        if (!type) return 'Ex: Nom du produit';

        const placeholders: Record<ProductType, string> = {
            immobilier_batiment: 'Ex: Appartement F4',
            immobilier_terrain: 'Ex: Terrain 500m²',
            hotellerie: 'Ex: Hôtel Sawa - Chambre Double',
            automobile: 'Ex: Toyota Corolla 2018',
            ticket_voyage: 'Ex: Douala-Yaoundé',
            covoiturage: 'Ex: Trajet Douala-Yaoundé',
            vetement: 'Ex: T-shirt casual homme',
            chaussure: 'Ex: Baskets sport Adidas',
            electromenager: 'Ex: Réfrigérateur Samsung',
            image_son: 'Ex: TV Samsung 55 pouces',
            telephone: 'Ex: iPhone 13 Pro',
            ordinateur: 'Ex: MacBook Pro M2',
            mobilier: 'Ex: Canapé 3 places',
            decoration: 'Ex: Tableau moderne',
            ustensiles_cuisine: 'Ex: Batterie cuisine 12 pièces',
            pieces_auto: 'Ex: Pneu Michelin 205/55 R16',
            pieces_industrielles: 'Ex: Roulement SKF',
            jouets_enfants: 'Ex: Puzzle éducatif 100 pièces',
            aliments: 'Ex: Tomates fraîches',
            livres_fournitures: 'Ex: Manuel Mathématiques Term C',
            quincaillerie: 'Ex: Marteau menuisier',
            prestation_service: 'Ex: Installation électrique',
            assurance: 'Ex: Assurance auto tous risques',
            pharmacie: 'Ex: Pharmacie Centrale',
            hopital_clinique: 'Ex: Clinique Saint-Joseph',
            demenagement: 'Ex: Déménagement Express',
            cosmetique_parfum: 'Ex: Crème hydratante Nivea',
            bijoux: 'Ex: Collier en or 18 carats',
            coiffure_beaute: 'Ex: Mèches brésiliennes 30cm',
            autre: 'Ex: Nom du produit'
        };

        return placeholders[type] || 'Ex: Nom du produit';
    };

    // Fonction pour télécharger le modèle Excel
    const downloadExcelTemplate = (type: ProductType) => {
        const template = EXCEL_TEMPLATES[type];

        Alert.alert(
            'Modèle Excel',
            `Copiez ce modèle dans Excel :\n\n${template.substring(0, 200)}...`,
            [
                { text: 'OK' }
            ]
        );
    };

    // Fonction pour sélectionner plusieurs images
    const handlePickImages = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permissionResult.granted === false) {
                Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la galerie');
                return;
            }

            // ✅ Vérifier le nombre d'images déjà ajoutées (limite: 5 images max pour éviter payload trop gros)
            const currentImagesCount = (newProduct.images || []).length;
            if (currentImagesCount >= 5) {
                Alert.alert(
                    'Limite atteinte',
                    'Vous pouvez ajouter maximum 5 images par produit pour éviter l\'erreur 413 (payload trop volumineux).\n\nConseils : Privilégiez la qualité sur la quantité !',
                    [{ text: 'OK' }]
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.3, // ✅ Qualité réduite à 30% pour garantir payload < 100MB
                base64: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                // ✅ Limiter le nombre total d'images à 5
                const remainingSlots = 5 - currentImagesCount;
                const assetsToAdd = result.assets.slice(0, remainingSlots);

                if (result.assets.length > remainingSlots) {
                    Alert.alert(
                        'Images limitées',
                        `Seulement ${remainingSlots} image(s) ajoutée(s). Maximum 5 images par produit.`,
                        [{ text: 'OK' }]
                    );
                }

                const base64Images = assetsToAdd.map(asset =>
                    `data:image/jpeg;base64,${asset.base64}`
                );

                setNewProduct({
                    ...newProduct,
                    images: [...(newProduct.images || []), ...base64Images]
                });
            }
        } catch (error) {
            console.error('Erreur sélection images:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner les images');
        }
    };

    // Fonction pour sélectionner des vidéos
    const handlePickVideos = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permissionResult.granted === false) {
                Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la galerie');
                return;
            }

            // ✅ Vérifier le nombre de vidéos déjà ajoutées (limite: 1 vidéo max pour éviter payload énorme)
            const currentVideosCount = (newProduct.videos || []).length;
            if (currentVideosCount >= 1) {
                Alert.alert(
                    'Limite atteinte',
                    'Vous pouvez ajouter maximum 1 vidéo par produit pour éviter l\'erreur 413 (payload trop volumineux).\n\nConseils : Privilégiez une vidéo courte et de qualité !',
                    [{ text: 'OK' }]
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsMultipleSelection: false,
                quality: 0.2, // ✅ Compression TRÈS forte (20%) pour vidéos
                videoMaxDuration: 30 // ✅ Limiter à 30 secondes max (au lieu de 60)
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];

                // ✅ Vérifier la taille du fichier vidéo (max 20MB au lieu de 50MB)
                const fileInfo = await FileSystem.getInfoAsync(asset.uri);
                let videoSizeMB = 0;

                if (fileInfo.exists && 'size' in fileInfo && fileInfo.size) {
                    videoSizeMB = fileInfo.size / (1024 * 1024);
                    if (videoSizeMB > 20) {
                        Alert.alert(
                            'Vidéo trop volumineuse',
                            `La vidéo fait ${videoSizeMB.toFixed(2)} MB. Veuillez sélectionner une vidéo de moins de 20 MB et max 30 secondes.\n\nConseils : Filmez en résolution réduite ou raccourcissez la vidéo.`,
                            [{ text: 'OK' }]
                        );
                        return;
                    }
                }

                try {
                    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                        encoding: FileSystem.EncodingType.Base64
                    });

                    const videoData = `data:video/mp4;base64,${base64}`;

                    setNewProduct({
                        ...newProduct,
                        videos: [...(newProduct.videos || []), videoData]
                    });

                    Alert.alert(
                        'Vidéo ajoutée',
                        `Vidéo ajoutée avec succès${videoSizeMB > 0 ? ` (${videoSizeMB.toFixed(2)} MB)` : ''}.\n\n⚠️ Limite atteinte : 1 vidéo maximum par produit.`,
                        [{ text: 'OK' }]
                    );
                } catch (err) {
                    console.error('Erreur conversion vidéo:', err);
                    Alert.alert(
                        'Erreur de conversion',
                        'Impossible de convertir la vidéo. Essayez une vidéo plus courte ou de taille réduite.',
                        [{ text: 'OK' }]
                    );
                }
            }
        } catch (error) {
            console.error('Erreur sélection vidéos:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner les vidéos');
        }
    };

    // Supprimer une image
    const removeImage = (index: number) => {
        const newImages = [...(newProduct.images || [])];
        newImages.splice(index, 1);
        setNewProduct({ ...newProduct, images: newImages });
    };

    // Supprimer une vidéo
    const removeVideo = (index: number) => {
        const newVideos = [...(newProduct.videos || [])];
        newVideos.splice(index, 1);
        setNewProduct({ ...newProduct, videos: newVideos });
    };

    // Fonction pour importer des produits depuis Excel
    const handleImportExcel = async () => {
        if (!selectedType) {
            Alert.alert('Erreur', 'Veuillez d\'abord sélectionner un type de produit');
            return;
        }

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/csv',
                    'text/comma-separated-values'
                ],
                copyToCacheDirectory: true
            });

            // @ts-ignore - DocumentPicker result type
            if (result.type === 'cancel' || !result.uri) {
                return;
            }

            // Lire le fichier
            // @ts-ignore - DocumentPicker result type
            const fileContent = await FileSystem.readAsStringAsync(result.uri);

            // Parser le CSV
            const lines = fileContent.split('\n').filter(line => line.trim());

            if (lines.length === 0) {
                Alert.alert('Erreur', 'Le fichier est vide');
                return;
            }

            // Ignorer la première ligne (en-têtes)
            const dataLines = lines.slice(1);
            const newProducts: Product[] = [];

            // Parser selon le type de produit
            dataLines.forEach(line => {
                const columns = line.split(',').map(col => col.trim());

                if (columns.length >= 2 && columns[0] && columns[1]) {
                    const baseProduct = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        type: selectedType,
                        nom: columns[0],
                        prix: columns[1],
                        devise: columns[2] || 'XAF',
                        description: columns[3] || ''
                    };

                    // Ajouter les champs spécifiques selon le type
                    let specificProduct: Product;

                    switch (selectedType) {
                        case 'immobilier_batiment':
                            specificProduct = {
                                ...baseProduct,
                                superficie: columns[4],
                                nbChambres: columns[5],
                                nbSallesBain: columns[6],
                                adresse: columns[7],
                                quartier: columns[8],
                                ville: columns[9],
                                gpsImmobilier: columns[10]
                            } as Product;
                            break;

                        case 'immobilier_terrain':
                            specificProduct = {
                                ...baseProduct,
                                superficie: columns[4],
                                adresse: columns[5],
                                quartier: columns[6],
                                ville: columns[7],
                                gpsImmobilier: columns[8]
                            } as Product;
                            break;

                        case 'automobile':
                            specificProduct = {
                                ...baseProduct,
                                marque: columns[4],
                                modele: columns[5],
                                annee: columns[6],
                                kilometrage: columns[7],
                                couleur: columns[8],
                                typeCarburant: columns[9],
                                transmission: columns[10]
                            } as Product;
                            break;

                        case 'ticket_voyage':
                            specificProduct = {
                                ...baseProduct,
                                depart: columns[4],
                                destination: columns[5],
                                dateDepart: columns[6],
                                heureDepart: columns[7],
                                numeroPlace: columns[8],
                                compagnieTransport: columns[9]
                            } as Product;
                            break;

                        case 'covoiturage':
                            specificProduct = {
                                ...baseProduct,
                                pointDepart: columns[4],
                                pointArrivee: columns[5],
                                dateTrajet: columns[6],
                                heureTrajet: columns[7],
                                nbPlacesDisponibles: columns[8]
                            } as Product;
                            break;

                        case 'vetement':
                            specificProduct = {
                                ...baseProduct,
                                taille: columns[4],
                                couleurVetement: columns[5],
                                matiere: columns[6],
                                marqueVetement: columns[7]
                            } as Product;
                            break;

                        case 'chaussure':
                            specificProduct = {
                                ...baseProduct,
                                pointure: columns[4],
                                couleurChaussure: columns[5],
                                marqueChaussure: columns[6]
                            } as Product;
                            break;

                        case 'electromenager':
                            specificProduct = {
                                ...baseProduct,
                                typeElectro: columns[4],
                                marqueElectro: columns[5],
                                modeleElectro: columns[6],
                                etat: columns[7],
                                garantie: columns[8]
                            } as Product;
                            break;

                        case 'decoration':
                            specificProduct = {
                                ...baseProduct,
                                typeDecoration: columns[4],
                                style: columns[5],
                                couleurDecoration: columns[6],
                                dimensionsDecoration: columns[7],
                                materiauDecoration: columns[8]
                            } as Product;
                            break;

                        case 'assurance':
                            specificProduct = {
                                ...baseProduct,
                                categorieAssurance: columns[4],
                                typeAssurance: columns[5],
                                compagnieAssurance: columns[6],
                                couverture: columns[7],
                                primeAnnuelle: columns[8],
                                franchise: columns[9],
                                dureeContrat: columns[10],
                                benefices: columns[11]
                            } as Product;
                            break;

                        case 'mobilier':
                            specificProduct = {
                                ...baseProduct,
                                typeMobilier: columns[4],
                                materiau: columns[5],
                                dimensions: columns[6],
                                couleurMobilier: columns[7],
                                etatMobilier: columns[8]
                            } as Product;
                            break;

                        case 'aliments':
                            specificProduct = {
                                ...baseProduct,
                                categorieAliment: columns[4],
                                origine: columns[5],
                                dateExpiration: columns[6],
                                poids: columns[7],
                                conservation: columns[8],
                                certification: columns[9]
                            } as Product;
                            break;

                        case 'livres_fournitures':
                            specificProduct = {
                                ...baseProduct,
                                categorieLivre: columns[4],
                                niveau: columns[5],
                                matiereScolaire: columns[6],
                                auteur: columns[7],
                                editeur: columns[8],
                                isbn: columns[9],
                                anneeEdition: columns[10],
                                etatLivre: columns[11]
                            } as Product;
                            break;

                        case 'quincaillerie':
                            specificProduct = {
                                ...baseProduct,
                                categorieQuincaillerie: columns[4],
                                marqueQuincaillerie: columns[5],
                                reference: columns[6],
                                unite: columns[7],
                                stockDisponible: columns[8]
                            } as Product;
                            break;

                        case 'prestation_service':
                            specificProduct = {
                                ...baseProduct
                            } as Product;
                            break;

                        case 'pharmacie':
                            specificProduct = {
                                ...baseProduct,
                                typePharmacie: columns[4],
                                heuresOuverture: columns[5],
                                heuresFermeture: columns[6],
                                joursGarde: columns[7],
                                telephoneUrgence: columns[8],
                                services: columns[9]
                            } as Product;
                            break;

                        case 'hopital_clinique':
                            specificProduct = {
                                ...baseProduct,
                                typeEtablissement: columns[4],
                                banqueSang: columns[5]?.toLowerCase() === 'oui',
                                prestationsMedicales: columns[6]?.split('|').map(s => s.trim()).filter(s => s),
                                horairesConsultation: columns[7],
                                urgencesDisponible: columns[8]?.toLowerCase() === 'oui',
                                rdvEnLigne: columns[9]?.toLowerCase() === 'oui'
                            } as Product;
                            break;

                        case 'demenagement':
                            specificProduct = {
                                ...baseProduct,
                                typeDemenagement: columns[4],
                                volumeEstime: columns[5],
                                typeVehicule: columns[6],
                                distanceKm: columns[7],
                                nbDemenageurs: columns[8],
                                assuranceMarchandise: columns[9]?.toLowerCase() === 'oui',
                                serviceManutention: columns[10]?.toLowerCase() === 'oui',
                                montageDemontage: columns[11]?.toLowerCase() === 'oui',
                                emballageCartons: columns[12]?.toLowerCase() === 'oui',
                                gardeMeuble: columns[13]?.toLowerCase() === 'oui',
                                debarras: columns[14]?.toLowerCase() === 'oui'
                            } as Product;
                            break;

                        case 'cosmetique_parfum':
                            specificProduct = {
                                ...baseProduct,
                                typeCosmetique: columns[4],
                                marqueCosmetique: columns[5],
                                volumeCosmetique: columns[6],
                                uniteCosmetique: columns[7],
                                typePeau: columns[8],
                                ageRecommandé: columns[9],
                                ingredientsCosmetique: columns[10],
                                origineCosmetique: columns[11]
                            } as Product;
                            break;

                        case 'bijoux':
                            specificProduct = {
                                ...baseProduct,
                                typeBijou: columns[4],
                                matiereBijou: columns[5],
                                poidsBijou: columns[6],
                                unitePoids: columns[7],
                                tailleBijou: columns[8],
                                styleBijou: columns[9],
                                origineBijou: columns[10],
                                certificatBijou: columns[11]
                            } as Product;
                            break;

                        case 'coiffure_beaute':
                            specificProduct = {
                                ...baseProduct,
                                typeCoiffure: columns[4],
                                longueurMech: columns[5],
                                couleurMech: columns[6],
                                textureMech: columns[7],
                                typePose: columns[8],
                                marqueCoiffure: columns[9],
                                origineMech: columns[10],
                                entretienMech: columns[11],
                                dureeVie: columns[12],
                                typeCheveux: columns[13]
                            } as Product;
                            break;

                        case 'telephone':
                            specificProduct = {
                                ...baseProduct,
                                marqueTelephone: columns[4],
                                modeleTelephone: columns[5],
                                stockage: columns[6],
                                ram: columns[7],
                                etatTelephone: columns[8],
                                couleurTelephone: columns[9],
                                operateur: columns[10]
                            } as Product;
                            break;

                        case 'ordinateur':
                            specificProduct = {
                                ...baseProduct,
                                typeOrdinateur: columns[4],
                                marqueOrdinateur: columns[5],
                                modeleOrdinateur: columns[6],
                                processeur: columns[7],
                                ramOrdinateur: columns[8],
                                stockageOrdinateur: columns[9],
                                carteGraphique: columns[10],
                                systemeExploitation: columns[11],
                                etatOrdinateur: columns[12]
                            } as Product;
                            break;

                        case 'image_son':
                            specificProduct = {
                                ...baseProduct,
                                marqueImageSon: columns[4],
                                modeleImageSon: columns[5],
                                typeImageSon: columns[6],
                                diagonaleEcran: columns[7],
                                resolution: columns[8],
                                etatImageSon: columns[9],
                                garantieImageSon: columns[10]
                            } as Product;
                            break;

                        case 'pieces_auto':
                            specificProduct = {
                                ...baseProduct,
                                typePieceAuto: columns[4],
                                marquePieceAuto: columns[5],
                                referenceAuto: columns[6],
                                compatibilite: columns[7],
                                etatPieceAuto: columns[8]
                            } as Product;
                            break;

                        case 'pieces_industrielles':
                            specificProduct = {
                                ...baseProduct,
                                typePieceIndustrielle: columns[4],
                                marquePieceIndustrielle: columns[5],
                                referencePiece: columns[6],
                                applicationIndustrielle: columns[7],
                                materielPiece: columns[8]
                            } as Product;
                            break;

                        case 'jouets_enfants':
                            specificProduct = {
                                ...baseProduct,
                                typeJouet: columns[4],
                                ageRecommande: columns[5],
                                marqueJouet: columns[6],
                                materielJouet: columns[7],
                                normeSecurite: columns[8]
                            } as Product;
                            break;

                        case 'ustensiles_cuisine':
                            specificProduct = {
                                ...baseProduct,
                                typeUstensile: columns[4],
                                materiauUstensile: columns[5],
                                marqueUstensile: columns[6],
                                capacite: columns[7],
                                piecesDansSet: columns[8],
                                etatUstensile: columns[9]
                            } as Product;
                            break;

                        default:
                            specificProduct = baseProduct as Product;
                    }

                    newProducts.push(specificProduct);
                }
            });

            if (newProducts.length > 0) {
                onProductsChange([...products, ...newProducts]);
                Alert.alert(
                    'Import réussi',
                    `${newProducts.length} produit(s) ont été importés avec succès`
                );
            } else {
                Alert.alert('Erreur', 'Aucun produit valide trouvé dans le fichier');
            }

        } catch (error) {
            console.error('Erreur import Excel:', error);
            Alert.alert('Erreur', 'Impossible d\'importer le fichier');
        }
    };

    const handleSelectType = (type: ProductType) => {
        setSelectedType(type);

        // ✅ Pour Prestation de Service : Pré-remplir automatiquement titre et description
        if (type === 'prestation_service') {
            setNewProduct({
                ...newProduct,
                type,
                nom: titreService || 'Réalisation',
                description: descriptionService || '',
                titreService: titreService || '',
                descriptionService: descriptionService || ''
            });
        } else {
            setNewProduct({ ...newProduct, type });
        }

        setCurrentStep('form');
    };

    const handleAddProduct = () => {
        // Validation : Nom obligatoire, Prix obligatoire sauf pour pharmacie/hopital_clinique
        const isPriceRequired = selectedType !== 'pharmacie' && selectedType !== 'hopital_clinique' && selectedType !== 'prestation_service' && selectedType !== 'assurance';

        if (!newProduct.nom?.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir le nom du produit');
            return;
        }

        if (isPriceRequired && !newProduct.prix?.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir le prix du produit');
            return;
        }

        const product: Product = {
            id: editingProductId || Date.now().toString(),
            type: newProduct.type || 'autre',
            nom: newProduct.nom,
            prix: newProduct.prix,
            devise: newProduct.devise || 'XAF',
            description: newProduct.description,
            images: newProduct.images || [],
            videos: newProduct.videos || [],
            ...newProduct
        } as Product;

        if (editingProductId) {
            onProductsChange(products.map(p => p.id === editingProductId ? product : p));
        } else {
            onProductsChange([...products, product]);
        }

        handleCancel();
    };

    const handleEditProduct = (product: Product) => {
        setNewProduct({ ...product });
        setSelectedType(product.type);
        setEditingProductId(product.id);
        setCurrentStep('form');
        setShowAddModal(true);
    };

    const handleDeleteProduct = (id: string) => {
        Alert.alert(
            'Supprimer le produit',
            'Êtes-vous sûr de vouloir supprimer ce produit ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => onProductsChange(products.filter(p => p.id !== id))
                }
            ]
        );
    };

    const handleCancel = () => {
        setNewProduct({
            type: 'autre',
            nom: '',
            prix: '',
            devise: 'XAF',
            description: '',
            images: [],
            videos: []
        });
        setSelectedType(null);
        setEditingProductId(null);
        setCurrentStep('type');
        setShowAddModal(false);
    };

    const getProductTypeInfo = (type: ProductType) => {
        return PRODUCT_TYPES.find(t => t.value === type) || PRODUCT_TYPES[PRODUCT_TYPES.length - 1];
    };

    // Rendu des champs spécifiques selon le type
    const renderSpecificFields = () => {
        if (!selectedType) return null;

        switch (selectedType) {
            case 'immobilier_batiment':
                return (
                    <>
                        {/* Type d'immobilier */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type d'immobilier <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {TYPES_IMMOBILIERS.map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeImmobilier === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => {
                                            if (type === '🆕 Autre') {
                                                Alert.prompt(
                                                    'Nouveau type',
                                                    'Entrez le type d\'immobilier :',
                                                    (text) => {
                                                        if (text && text.trim()) {
                                                            TYPES_IMMOBILIERS.splice(TYPES_IMMOBILIERS.length - 1, 0, text.trim());
                                                            setNewProduct({ ...newProduct, typeImmobilier: text.trim() });
                                                        }
                                                    }
                                                );
                                            } else {
                                                setNewProduct({ ...newProduct, typeImmobilier: type });
                                            }
                                        }}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeImmobilier === type && styles.pickerButtonTextActive
                                        ]}>{type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Statut (Vente/Location) */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Statut <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {STATUTS_IMMOBILIERS.map((statut) => (
                                    <TouchableOpacity
                                        key={statut}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.statutImmobilier === statut && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, statutImmobilier: statut })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.statutImmobilier === statut && styles.pickerButtonTextActive
                                        ]}>{statut}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Superficie */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Superficie (m²) <Text style={styles.required}>*</Text></Text>
                            <NativeInput
                                placeholder="Ex: 120"
                                value={newProduct.superficie || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, superficie: text })}
                                style={styles.fieldInput}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Chambres et Salles de bain */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Chambres <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: 4"
                                    value={newProduct.nbChambres || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, nbChambres: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Salles de bain</Text>
                                <NativeInput
                                    placeholder="Ex: 2"
                                    value={newProduct.nbSallesBain || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, nbSallesBain: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Niveau d'ameublement */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Ameublement</Text>
                            <View style={styles.pickerButtons}>
                                {NIVEAUX_AMEUBLEMENT.map((niveau) => (
                                    <TouchableOpacity
                                        key={niveau}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.ameublement === niveau && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, ameublement: niveau })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.ameublement === niveau && styles.pickerButtonTextActive
                                        ]}>{niveau}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Adresse complète */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Adresse <Text style={styles.required}>*</Text></Text>
                            <NativeInput
                                placeholder="Ex: Rue des Jardins"
                                value={newProduct.adresse || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, adresse: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* Quartier et Ville */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Quartier</Text>
                                <NativeInput
                                    placeholder="Ex: Bonanjo"
                                    value={newProduct.quartier || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, quartier: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Ville <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: Douala"
                                    value={newProduct.ville || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, ville: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>📍 Localisation GPS</Text>
                            <TouchableOpacity
                                style={styles.gpsButton}
                                onPress={() => setShowGPSModal(true)}
                            >
                                <SafeIcon name="map-pin" size={16} color={modernColors.primary} />
                                <Text style={styles.gpsButtonText}>
                                    {newProduct.gpsImmobilier ? 'Modifier la localisation' : 'Ajouter la localisation GPS'}
                                </Text>
                            </TouchableOpacity>
                            {newProduct.gpsImmobilier && (
                                <View style={styles.gpsInfoCard}>
                                    <SafeIcon name="check-circle" size={14} color={modernColors.success} />
                                    <Text style={styles.gpsInfoText}>
                                        Position enregistrée : {newProduct.gpsImmobilier}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.hintBox}>
                                <Text style={styles.hintText}>
                                    💡 La localisation GPS aide les acheteurs à trouver facilement le bien
                                </Text>
                            </View>
                        </View>
                    </>
                );

            case 'immobilier_terrain':
                return (
                    <>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Superficie (m²)</Text>
                            <NativeInput
                                placeholder="Ex: 500"
                                value={newProduct.superficie || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, superficie: text })}
                                style={styles.fieldInput}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Adresse</Text>
                            <NativeInput
                                placeholder="Ex: Zone industrielle"
                                value={newProduct.adresse || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, adresse: text })}
                                style={styles.fieldInput}
                            />
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Quartier</Text>
                                <NativeInput
                                    placeholder="Ex: Logpom"
                                    value={newProduct.quartier || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, quartier: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Ville</Text>
                                <NativeInput
                                    placeholder="Ex: Douala"
                                    value={newProduct.ville || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, ville: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>📍 Localisation GPS</Text>
                            <TouchableOpacity
                                style={styles.gpsButton}
                                onPress={() => setShowGPSModal(true)}
                            >
                                <SafeIcon name="map-pin" size={16} color={modernColors.primary} />
                                <Text style={styles.gpsButtonText}>
                                    {newProduct.gpsImmobilier ? 'Modifier la localisation' : 'Ajouter la localisation GPS'}
                                </Text>
                            </TouchableOpacity>
                            {newProduct.gpsImmobilier && (
                                <View style={styles.gpsInfoCard}>
                                    <SafeIcon name="check-circle" size={14} color={modernColors.success} />
                                    <Text style={styles.gpsInfoText}>
                                        Position enregistrée : {newProduct.gpsImmobilier}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.hintBox}>
                                <Text style={styles.hintText}>
                                    💡 La localisation GPS précise augmente la visibilité du terrain
                                </Text>
                            </View>
                        </View>
                    </>
                );

            case 'automobile':
                return (
                    <>
                        {/* Marque avec liste déroulante */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Marque <Text style={styles.required}>*</Text></Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollablePicker}>
                                <View style={styles.pickerButtons}>
                                    {MARQUES_AUTOMOBILES.map((marque) => (
                                        <TouchableOpacity
                                            key={marque}
                                            style={[
                                                styles.pickerButton,
                                                newProduct.marque === marque && styles.pickerButtonActive
                                            ]}
                                            onPress={() => {
                                                if (marque === '🆕 Autre (ajouter)') {
                                                    Alert.prompt(
                                                        'Nouvelle marque',
                                                        'Entrez le nom de la marque :',
                                                        (text) => {
                                                            if (text && text.trim()) {
                                                                MARQUES_AUTOMOBILES.splice(MARQUES_AUTOMOBILES.length - 1, 0, text.trim());
                                                                setNewProduct({ ...newProduct, marque: text.trim() });
                                                            }
                                                        }
                                                    );
                                                } else {
                                                    setNewProduct({ ...newProduct, marque });
                                                }
                                            }}
                                        >
                                            <Text style={[
                                                styles.pickerButtonText,
                                                newProduct.marque === marque && styles.pickerButtonTextActive
                                            ]}>{marque}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>

                        {/* Modèle */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Modèle <Text style={styles.required}>*</Text></Text>
                            <NativeInput
                                placeholder="Ex: Corolla, Civic, Classe E..."
                                value={newProduct.modele || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, modele: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* État du véhicule */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>État du véhicule <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {ETATS_VEHICULE.map((etat) => (
                                    <TouchableOpacity
                                        key={etat}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.etatVehicule === etat && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, etatVehicule: etat })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.etatVehicule === etat && styles.pickerButtonTextActive
                                        ]}>{etat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Année et Kilométrage */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Année <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: 2018"
                                    value={newProduct.annee || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, annee: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Kilométrage (km)</Text>
                                <NativeInput
                                    placeholder="Ex: 65000"
                                    value={newProduct.kilometrage || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, kilometrage: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Type de carburant */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de carburant <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {TYPES_CARBURANT.map((carburant) => (
                                    <TouchableOpacity
                                        key={carburant}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeCarburant === carburant && styles.pickerButtonActive
                                        ]}
                                        onPress={() => {
                                            if (carburant === '🆕 Autre') {
                                                Alert.prompt(
                                                    'Nouveau carburant',
                                                    'Entrez le type de carburant :',
                                                    (text) => {
                                                        if (text && text.trim()) {
                                                            TYPES_CARBURANT.splice(TYPES_CARBURANT.length - 1, 0, text.trim());
                                                            setNewProduct({ ...newProduct, typeCarburant: text.trim() });
                                                        }
                                                    }
                                                );
                                            } else {
                                                setNewProduct({ ...newProduct, typeCarburant: carburant });
                                            }
                                        }}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeCarburant === carburant && styles.pickerButtonTextActive
                                        ]}>{carburant}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Transmission */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Transmission <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {TYPES_TRANSMISSION.map((transmission) => (
                                    <TouchableOpacity
                                        key={transmission}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.transmission === transmission && styles.pickerButtonActive
                                        ]}
                                        onPress={() => {
                                            if (transmission === '🆕 Autre') {
                                                Alert.prompt(
                                                    'Nouvelle transmission',
                                                    'Entrez le type de transmission :',
                                                    (text) => {
                                                        if (text && text.trim()) {
                                                            TYPES_TRANSMISSION.splice(TYPES_TRANSMISSION.length - 1, 0, text.trim());
                                                            setNewProduct({ ...newProduct, transmission: text.trim() });
                                                        }
                                                    }
                                                );
                                            } else {
                                                setNewProduct({ ...newProduct, transmission });
                                            }
                                        }}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.transmission === transmission && styles.pickerButtonTextActive
                                        ]}>{transmission}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Couleur */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Couleur</Text>
                            <NativeInput
                                placeholder="Ex: Blanche, Noire, Grise..."
                                value={newProduct.couleur || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, couleur: text })}
                                style={styles.fieldInput}
                            />
                        </View>
                    </>
                );

            case 'ticket_voyage':
                return (
                    <>
                        {/* Compagnie de voyage */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Compagnie de transport <Text style={styles.required}>*</Text></Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollablePicker}>
                                <View style={styles.pickerButtons}>
                                    {COMPAGNIES_VOYAGE.map((compagnie) => (
                                        <TouchableOpacity
                                            key={compagnie}
                                            style={[
                                                styles.pickerButton,
                                                newProduct.compagnie === compagnie && styles.pickerButtonActive
                                            ]}
                                            onPress={() => {
                                                if (compagnie === '🆕 Autre') {
                                                    Alert.prompt(
                                                        'Nouvelle compagnie',
                                                        'Entrez le nom de la compagnie :',
                                                        (text) => {
                                                            if (text && text.trim()) {
                                                                COMPAGNIES_VOYAGE.splice(COMPAGNIES_VOYAGE.length - 1, 0, text.trim());
                                                                setNewProduct({ ...newProduct, compagnie: text.trim() });
                                                            }
                                                        }
                                                    );
                                                } else {
                                                    setNewProduct({ ...newProduct, compagnie });
                                                }
                                            }}
                                        >
                                            <Text style={[
                                                styles.pickerButtonText,
                                                newProduct.compagnie === compagnie && styles.pickerButtonTextActive
                                            ]}>{compagnie}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>

                        {/* Type de véhicule */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de véhicule <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {TYPES_VEHICULES_TRANSPORT.map((typeVehicule) => (
                                    <TouchableOpacity
                                        key={typeVehicule}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeVehiculeTransport === typeVehicule && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeVehiculeTransport: typeVehicule })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeVehiculeTransport === typeVehicule && styles.pickerButtonTextActive
                                        ]}>{typeVehicule}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Classe de voyage */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Classe <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {CLASSES_VOYAGE.map((classe) => (
                                    <TouchableOpacity
                                        key={classe}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.classeVoyage === classe && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, classeVoyage: classe })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.classeVoyage === classe && styles.pickerButtonTextActive
                                        ]}>{classe}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Départ et Destination */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Ville de départ <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: Douala"
                                    value={newProduct.depart || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, depart: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Destination <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: Yaoundé"
                                    value={newProduct.destination || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, destination: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* Date et Heure */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Date de départ <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="JJ/MM/AAAA"
                                    value={newProduct.dateDepart || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dateDepart: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Heure <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="HH:MM"
                                    value={newProduct.heureDepart || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, heureDepart: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* Sélection de place */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Numéro de place</Text>
                            <View style={styles.seatSelectionContainer}>
                                <NativeInput
                                    placeholder="Ex: A12"
                                    value={newProduct.numeroPlace || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, numeroPlace: text })}
                                    style={[styles.fieldInput, { flex: 1 }]}
                                />
                                <TouchableOpacity
                                    style={styles.seatSelectorButton}
                                    onPress={() => setShowSeatSelector(true)}
                                >
                                    <SafeIcon name="grid" size={20} color="#FFFFFF" />
                                    <Text style={styles.seatSelectorButtonText}>Sélectionner</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Nombre de places disponibles */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Places disponibles</Text>
                            <NativeInput
                                placeholder="Ex: 45"
                                value={newProduct.nbPlacesDisponibles || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, nbPlacesDisponibles: text })}
                                style={styles.fieldInput}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Escales (optionnel) */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Escales (optionnel)</Text>
                            <NativeInput
                                placeholder="Ex: Bafoussam, Bertoua..."
                                value={newProduct.escales || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, escales: text })}
                                style={styles.fieldInput}
                                multiline
                            />
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Utilisez le sélecteur de place pour choisir visuellement une place dans le véhicule
                            </Text>
                        </View>
                    </>
                );

            case 'hotellerie':
                return (
                    <>
                        {/* Type d'hébergement */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type d'hébergement <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {TYPES_HEBERGEMENT.map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeHebergement === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => {
                                            if (type === '🆕 Autre') {
                                                Alert.prompt(
                                                    'Nouveau type',
                                                    'Entrez le type d\'hébergement :',
                                                    (text) => {
                                                        if (text && text.trim()) {
                                                            TYPES_HEBERGEMENT.splice(TYPES_HEBERGEMENT.length - 1, 0, text.trim());
                                                            setNewProduct({ ...newProduct, typeHebergement: text.trim() });
                                                        }
                                                    }
                                                );
                                            } else {
                                                setNewProduct({ ...newProduct, typeHebergement: type });
                                            }
                                        }}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeHebergement === type && styles.pickerButtonTextActive
                                        ]}>{type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Catégorie (Étoiles) */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Catégorie <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {CATEGORIES_HOTEL.map((categorie) => (
                                    <TouchableOpacity
                                        key={categorie}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.categorieHotel === categorie && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, categorieHotel: categorie })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.categorieHotel === categorie && styles.pickerButtonTextActive
                                        ]}>{categorie}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Prix par nuit */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Prix par nuit (minimum) <Text style={styles.required}>*</Text></Text>
                            <NativeInput
                                placeholder="Ex: 35000"
                                value={newProduct.prixParNuit || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, prixParNuit: text })}
                                style={styles.fieldInput}
                                keyboardType="numeric"
                            />
                            <Text style={styles.fieldHint}>Prix de la chambre la moins chère</Text>
                        </View>

                        {/* Nombre de chambres */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Nombre de chambres disponibles</Text>
                            <NativeInput
                                placeholder="Ex: 25"
                                value={newProduct.nbChambresHotel || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, nbChambresHotel: text })}
                                style={styles.fieldInput}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Types de chambres disponibles */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Types de chambres disponibles</Text>
                            <ScrollView style={styles.checkboxList} nestedScrollEnabled>
                                {TYPES_CHAMBRES_HOTEL.map((typeChambre) => {
                                    const isSelected = (newProduct.typesChambre || []).includes(typeChambre);
                                    return (
                                        <TouchableOpacity
                                            key={typeChambre}
                                            style={styles.checkboxContainer}
                                            onPress={() => {
                                                const current = newProduct.typesChambre || [];
                                                if (isSelected) {
                                                    setNewProduct({
                                                        ...newProduct,
                                                        typesChambre: current.filter(p => p !== typeChambre)
                                                    });
                                                } else {
                                                    setNewProduct({
                                                        ...newProduct,
                                                        typesChambre: [...current, typeChambre]
                                                    });
                                                }
                                            }}
                                        >
                                            <View style={[
                                                styles.checkbox,
                                                isSelected && styles.checkboxChecked
                                            ]}>
                                                {isSelected && (
                                                    <SafeIcon name="check" size={14} color="#FFFFFF" />
                                                )}
                                            </View>
                                            <Text style={styles.checkboxLabel}>{typeChambre}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Équipements de l'hôtel */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Équipements et services</Text>
                            <ScrollView style={styles.checkboxList} nestedScrollEnabled>
                                {EQUIPEMENTS_HOTEL.map((equipement) => {
                                    const isSelected = (newProduct.equipementsHotel || []).includes(equipement);
                                    return (
                                        <TouchableOpacity
                                            key={equipement}
                                            style={styles.checkboxContainer}
                                            onPress={() => {
                                                const current = newProduct.equipementsHotel || [];
                                                if (isSelected) {
                                                    setNewProduct({
                                                        ...newProduct,
                                                        equipementsHotel: current.filter(e => e !== equipement)
                                                    });
                                                } else {
                                                    setNewProduct({
                                                        ...newProduct,
                                                        equipementsHotel: [...current, equipement]
                                                    });
                                                }
                                            }}
                                        >
                                            <View style={[
                                                styles.checkbox,
                                                isSelected && styles.checkboxChecked
                                            ]}>
                                                {isSelected && (
                                                    <SafeIcon name="check" size={14} color="#FFFFFF" />
                                                )}
                                            </View>
                                            <Text style={styles.checkboxLabel}>{equipement}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Adresse et Ville */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Adresse <Text style={styles.required}>*</Text></Text>
                            <NativeInput
                                placeholder="Ex: Avenue Kennedy"
                                value={newProduct.adresseHotel || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, adresseHotel: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Ville <Text style={styles.required}>*</Text></Text>
                            <NativeInput
                                placeholder="Ex: Douala"
                                value={newProduct.villeHotel || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, villeHotel: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* GPS de l'hôtel */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>📍 Localisation GPS</Text>
                            <TouchableOpacity
                                style={styles.gpsButton}
                                onPress={() => setShowGPSModal(true)}
                            >
                                <SafeIcon name="map-pin" size={16} color={modernColors.primary} />
                                <Text style={styles.gpsButtonText}>
                                    {newProduct.gpsHotel ? 'Modifier la localisation' : 'Ajouter la localisation GPS'}
                                </Text>
                            </TouchableOpacity>
                            {newProduct.gpsHotel && (
                                <View style={styles.gpsInfoCard}>
                                    <SafeIcon name="check-circle" size={14} color={modernColors.success} />
                                    <Text style={styles.gpsInfoText}>
                                        Position enregistrée : {newProduct.gpsHotel}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.hintBox}>
                                <Text style={styles.hintText}>
                                    💡 La localisation GPS facilite la recherche de l'établissement par les clients
                                </Text>
                            </View>
                        </View>
                    </>
                );

            case 'covoiturage':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Point de départ</Text>
                                <NativeInput
                                    placeholder="Ex: Bonanjo"
                                    value={newProduct.pointDepart || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, pointDepart: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Point d'arrivée</Text>
                                <NativeInput
                                    placeholder="Ex: Yaoundé"
                                    value={newProduct.pointArrivee || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, pointArrivee: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Date du trajet</Text>
                                <NativeInput
                                    placeholder="JJ/MM/AAAA"
                                    value={newProduct.dateTrajet || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dateTrajet: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Heure</Text>
                                <NativeInput
                                    placeholder="HH:MM"
                                    value={newProduct.heureTrajet || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, heureTrajet: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Places disponibles</Text>
                            <NativeInput
                                placeholder="Ex: 3"
                                value={newProduct.nbPlacesDisponibles || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, nbPlacesDisponibles: text })}
                                style={styles.fieldInput}
                                keyboardType="numeric"
                            />
                        </View>
                    </>
                );

            case 'vetement':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Taille</Text>
                                <NativeInput
                                    placeholder="Ex: L"
                                    value={newProduct.taille || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, taille: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Couleur</Text>
                                <NativeInput
                                    placeholder="Ex: Bleu"
                                    value={newProduct.couleurVetement || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, couleurVetement: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Matière</Text>
                                <NativeInput
                                    placeholder="Ex: Coton"
                                    value={newProduct.matiere || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, matiere: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Marque</Text>
                                <NativeInput
                                    placeholder="Ex: Nike"
                                    value={newProduct.marqueVetement || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, marqueVetement: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                    </>
                );

            case 'chaussure':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Pointure</Text>
                                <NativeInput
                                    placeholder="Ex: 42"
                                    value={newProduct.pointure || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, pointure: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Couleur</Text>
                                <NativeInput
                                    placeholder="Ex: Noire"
                                    value={newProduct.couleurChaussure || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, couleurChaussure: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Marque</Text>
                            <NativeInput
                                placeholder="Ex: Adidas"
                                value={newProduct.marqueChaussure || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, marqueChaussure: text })}
                                style={styles.fieldInput}
                            />
                        </View>
                    </>
                );

            case 'electromenager':
                return (
                    <>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type d'appareil <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {['Réfrigérateur', 'Cuisinière', 'Four', 'Micro-ondes', 'Lave-linge', 'Lave-vaisselle', 'Climatiseur', 'Ventilateur', 'Autre'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeElectro === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeElectro: type })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeElectro === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Marque</Text>
                                <NativeInput
                                    placeholder="Ex: Samsung"
                                    value={newProduct.marqueElectro || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, marqueElectro: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Modèle</Text>
                                <NativeInput
                                    placeholder="Ex: RT50K6000S8"
                                    value={newProduct.modeleElectro || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modeleElectro: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>État</Text>
                                <View style={styles.pickerButtons}>
                                    {['Neuf', 'Bon état', 'Occasion'].map((etat) => (
                                        <TouchableOpacity
                                            key={etat}
                                            style={[
                                                styles.pickerButton,
                                                newProduct.etat === etat && styles.pickerButtonActive
                                            ]}
                                            onPress={() => setNewProduct({ ...newProduct, etat })}
                                        >
                                            <Text style={[
                                                styles.pickerButtonText,
                                                newProduct.etat === etat && styles.pickerButtonTextActive
                                            ]}>
                                                {etat}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Garantie</Text>
                            <View style={styles.pickerButtons}>
                                {['6 mois', '1 an', '2 ans', '5 ans', 'Aucune'].map((garantie) => (
                                    <TouchableOpacity
                                        key={garantie}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.garantie === garantie && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, garantie })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.garantie === garantie && styles.pickerButtonTextActive
                                        ]}>
                                            {garantie}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez le type d'appareil pour aider les clients à trouver exactement ce qu'ils cherchent
                            </Text>
                        </View>
                    </>
                );

            case 'mobilier':
                return (
                    <>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de mobilier</Text>
                            <View style={styles.pickerButtons}>
                                {['Salon', 'Chambre', 'Bureau', 'Salle à manger', 'Cuisine', 'Extérieur'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeMobilier === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeMobilier: type })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeMobilier === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Matériau</Text>
                                <NativeInput
                                    placeholder="Ex: Bois massif"
                                    value={newProduct.materiau || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, materiau: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Couleur</Text>
                                <NativeInput
                                    placeholder="Ex: Marron"
                                    value={newProduct.couleurMobilier || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, couleurMobilier: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Dimensions (LxPxH en cm)</Text>
                            <NativeInput
                                placeholder="Ex: 200x90x85"
                                value={newProduct.dimensions || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, dimensions: text })}
                                style={styles.fieldInput}
                            />
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>État</Text>
                            <View style={styles.pickerButtons}>
                                {['Neuf', 'Bon état', 'Occasion', 'À rénover'].map((etat) => (
                                    <TouchableOpacity
                                        key={etat}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.etatMobilier === etat && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, etatMobilier: etat })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.etatMobilier === etat && styles.pickerButtonTextActive
                                        ]}>
                                            {etat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez les dimensions et l'état pour faciliter l'évaluation par les acheteurs
                            </Text>
                        </View>
                    </>
                );

            case 'decoration':
                return (
                    <>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de décoration <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {['Tableau', 'Luminaire', 'Tapis', 'Coussin', 'Vase', 'Miroir', 'Horloge', 'Rideau', 'Plante déco', 'Sculpture', 'Autre'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeDecoration === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeDecoration: type })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeDecoration === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Style décoratif</Text>
                            <View style={styles.pickerButtons}>
                                {['Moderne', 'Classique', 'Vintage', 'Industriel', 'Scandinave', 'Bohème', 'Minimaliste', 'Africain'].map((styleType) => (
                                    <TouchableOpacity
                                        key={styleType}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.style === styleType && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, style: styleType })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.style === styleType && styles.pickerButtonTextActive
                                        ]}>
                                            {styleType}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Couleur principale</Text>
                                <NativeInput
                                    placeholder="Ex: Beige et or"
                                    value={newProduct.couleurDecoration || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, couleurDecoration: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Dimensions</Text>
                                <NativeInput
                                    placeholder="Ex: 80x60 cm"
                                    value={newProduct.dimensionsDecoration || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dimensionsDecoration: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Matériau / Matière</Text>
                            <View style={styles.pickerButtons}>
                                {['Toile', 'Bois', 'Métal', 'Verre', 'Céramique', 'Tissu', 'Plastique', 'Rotin'].map((mat) => (
                                    <TouchableOpacity
                                        key={mat}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.materiauDecoration === mat && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, materiauDecoration: mat })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.materiauDecoration === mat && styles.pickerButtonTextActive
                                        ]}>
                                            {mat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 <Text style={styles.hintBold}>Conseil :</Text> Ajoutez de belles photos pour montrer comment votre article s'intègre dans un intérieur
                            </Text>
                        </View>
                    </>
                );

            case 'aliments':
                return (
                    <>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Catégorie d'aliment</Text>
                            <View style={styles.pickerButtons}>
                                {['Fruits', 'Légumes', 'Viande', 'Poisson', 'Céréales', 'Produits laitiers', 'Épicerie'].map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.categorieAliment === cat && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, categorieAliment: cat })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.categorieAliment === cat && styles.pickerButtonTextActive
                                        ]}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Origine</Text>
                                <View style={styles.pickerButtons}>
                                    {['Locale', 'Importée'].map((orig) => (
                                        <TouchableOpacity
                                            key={orig}
                                            style={[
                                                styles.pickerButton,
                                                newProduct.origine === orig && styles.pickerButtonActive
                                            ]}
                                            onPress={() => setNewProduct({ ...newProduct, origine: orig })}
                                        >
                                            <Text style={[
                                                styles.pickerButtonText,
                                                newProduct.origine === orig && styles.pickerButtonTextActive
                                            ]}>
                                                {orig}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Conservation</Text>
                                <View style={styles.pickerButtons}>
                                    {['Frais', 'Surgelé', 'Sec'].map((cons) => (
                                        <TouchableOpacity
                                            key={cons}
                                            style={[
                                                styles.pickerButton,
                                                newProduct.conservation === cons && styles.pickerButtonActive
                                            ]}
                                            onPress={() => setNewProduct({ ...newProduct, conservation: cons })}
                                        >
                                            <Text style={[
                                                styles.pickerButtonText,
                                                newProduct.conservation === cons && styles.pickerButtonTextActive
                                            ]}>
                                                {cons}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Poids / Quantité</Text>
                                <NativeInput
                                    placeholder="Ex: 1kg, 500g, 2L"
                                    value={newProduct.poids || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, poids: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Date d'expiration</Text>
                                <NativeInput
                                    placeholder="JJ/MM/AAAA"
                                    value={newProduct.dateExpiration || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dateExpiration: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Certification (optionnel)</Text>
                            <View style={styles.pickerButtons}>
                                {['Bio', 'Halal', 'Kasher', 'Standard', 'AOC'].map((cert) => (
                                    <TouchableOpacity
                                        key={cert}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.certification === cert && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, certification: cert })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.certification === cert && styles.pickerButtonTextActive
                                        ]}>
                                            {cert}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Les informations sur l'origine et la certification rassurent les acheteurs sur la qualité
                            </Text>
                        </View>
                    </>
                );

            case 'quincaillerie':
                return (
                    <>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Catégorie</Text>
                            <View style={styles.pickerButtons}>
                                {['Outils', 'Matériaux', 'Peinture', 'Plomberie', 'Sanitaire', 'Électricité'].map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.categorieQuincaillerie === cat && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, categorieQuincaillerie: cat })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.categorieQuincaillerie === cat && styles.pickerButtonTextActive
                                        ]}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Marque</Text>
                                <NativeInput
                                    placeholder="Ex: Stanley"
                                    value={newProduct.marqueQuincaillerie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, marqueQuincaillerie: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Référence</Text>
                                <NativeInput
                                    placeholder="Ex: STHT0-51309"
                                    value={newProduct.referenceQuincaillerie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, referenceQuincaillerie: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Unité</Text>
                                <View style={styles.pickerButtons}>
                                    {['Pièce', 'Sac', 'Seau', 'Litre', 'm', 'm²', 'Lot'].map((unite) => (
                                        <TouchableOpacity
                                            key={unite}
                                            style={[
                                                styles.pickerButton,
                                                newProduct.unite === unite && styles.pickerButtonActive
                                            ]}
                                            onPress={() => setNewProduct({ ...newProduct, unite })}
                                        >
                                            <Text style={[
                                                styles.pickerButtonText,
                                                newProduct.unite === unite && styles.pickerButtonTextActive
                                            ]}>
                                                {unite}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Stock disponible</Text>
                                <NativeInput
                                    placeholder="Ex: 50"
                                    value={newProduct.stockDisponible || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, stockDisponible: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez la référence et le stock pour faciliter les commandes
                            </Text>
                        </View>
                    </>
                );

            case 'prestation_service':
                return (
                    <>
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 <Text style={styles.hintBold}>Portfolio de Réalisations :</Text> Ajoutez des images et vidéos de vos meilleures réalisations pour montrer votre savoir-faire. Le titre et la description sont automatiquement repris du service principal.
                            </Text>
                        </View>

                        {/* Gestion des offres de service */}
                        <View style={styles.fieldContainer}>
                            <View style={styles.prestationHeader}>
                                <Text style={styles.fieldLabel}>Offres de service proposées</Text>
                                <TouchableOpacity
                                    style={styles.addPrestationButton}
                                    onPress={() => {
                                        const prestations = newProduct.prestations || [];
                                        prestations.push({ nom: '', prixAPartirDe: '', description: '' });
                                        setNewProduct({ ...newProduct, prestations });
                                    }}
                                >
                                    <SafeIcon name="plus-circle" size={20} color={modernColors.primary} />
                                    <Text style={styles.addPrestationText}>Ajouter une offre</Text>
                                </TouchableOpacity>
                            </View>

                            {(newProduct.prestations || []).map((prestation, index) => (
                                <View key={index} style={styles.prestationCard}>
                                    <View style={styles.prestationCardHeader}>
                                        <Text style={styles.prestationCardTitle}>Offre {index + 1}</Text>
                                        <TouchableOpacity
                                            style={styles.deletePrestationButton}
                                            onPress={() => {
                                                const prestations = [...(newProduct.prestations || [])];
                                                prestations.splice(index, 1);
                                                setNewProduct({ ...newProduct, prestations });
                                            }}
                                        >
                                            <SafeIcon name="trash-2" size={18} color={modernColors.error} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.prestationFieldContainer}>
                                        <Text style={styles.prestationFieldLabel}>Nom de l'offre *</Text>
                                        <NativeInput
                                            placeholder="Ex: Traitement de données, Analyse statistique, Rédaction de rapport..."
                                            value={prestation.nom}
                                            onChangeText={(text) => {
                                                const prestations = [...(newProduct.prestations || [])];
                                                prestations[index].nom = text;
                                                setNewProduct({ ...newProduct, prestations });
                                            }}
                                            style={styles.fieldInput}
                                        />
                                    </View>

                                    <View style={styles.prestationFieldRow}>
                                        <View style={[styles.prestationFieldContainer, { flex: 1 }]}>
                                            <Text style={styles.prestationFieldLabel}>Montant minimum *</Text>
                                            <NativeInput
                                                placeholder="50000"
                                                value={prestation.prixAPartirDe}
                                                onChangeText={(text) => {
                                                    const prestations = [...(newProduct.prestations || [])];
                                                    prestations[index].prixAPartirDe = text;
                                                    setNewProduct({ ...newProduct, prestations });
                                                }}
                                                style={styles.fieldInput}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View style={styles.xafLabel}>
                                            <Text style={styles.xafText}>XAF</Text>
                                        </View>
                                    </View>

                                    <View style={styles.prestationFieldContainer}>
                                        <Text style={styles.prestationFieldLabel}>Description de l'offre (optionnelle)</Text>
                                        <NativeInput
                                            placeholder="Ex: Comprend l'analyse complète des données, visualisations, et recommandations..."
                                            value={prestation.description}
                                            onChangeText={(text) => {
                                                const prestations = [...(newProduct.prestations || [])];
                                                prestations[index].description = text;
                                                setNewProduct({ ...newProduct, prestations });
                                            }}
                                            style={[styles.fieldInput, styles.textareaInput]}
                                            multiline
                                        />
                                    </View>
                                </View>
                            ))}

                            {(!newProduct.prestations || newProduct.prestations.length === 0) && (
                                <View style={styles.emptyPrestationState}>
                                    <SafeIcon name="info" size={32} color={modernColors.textSecondary} />
                                    <Text style={styles.emptyPrestationText}>
                                        Aucune offre ajoutée
                                    </Text>
                                    <Text style={styles.emptyPrestationSubtext}>
                                        Cliquez sur "Ajouter une offre" pour commencer
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💰 <Text style={styles.hintBold}>Conseil :</Text> Listez toutes vos offres de service avec leur montant minimum. Cela permet aux clients d'évaluer rapidement si votre offre correspond à leur budget.
                            </Text>
                        </View>
                    </>
                );

            case 'livres_fournitures':
                return (
                    <>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type d'article</Text>
                            <View style={styles.pickerButtons}>
                                {['Livre scolaire', 'Livre', 'Roman', 'Cahier', 'Stylos', 'Cartable', 'Calculatrice', 'Fournitures'].map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.categorieLivre === cat && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, categorieLivre: cat })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.categorieLivre === cat && styles.pickerButtonTextActive
                                        ]}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Niveau scolaire</Text>
                            <View style={styles.pickerButtons}>
                                {['Maternelle', 'Primaire', 'Secondaire', 'Université', 'Tous'].map((niv) => (
                                    <TouchableOpacity
                                        key={niv}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.niveau === niv && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, niveau: niv })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.niveau === niv && styles.pickerButtonTextActive
                                        ]}>
                                            {niv}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        {(newProduct.categorieLivre === 'Livre scolaire' || newProduct.categorieLivre === 'Livre') && (
                            <>
                                <View style={styles.fieldContainer}>
                                    <Text style={styles.fieldLabel}>Matière</Text>
                                    <NativeInput
                                        placeholder="Ex: Mathématiques, Français, Histoire"
                                        value={newProduct.matiereScolaire || ''}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, matiereScolaire: text })}
                                        style={styles.fieldInput}
                                    />
                                </View>
                                <View style={styles.fieldRow}>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>Auteur</Text>
                                        <NativeInput
                                            placeholder="Ex: Collection CIAM"
                                            value={newProduct.auteur || ''}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, auteur: text })}
                                            style={styles.fieldInput}
                                        />
                                    </View>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>Éditeur</Text>
                                        <NativeInput
                                            placeholder="Ex: Edicef"
                                            value={newProduct.editeur || ''}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, editeur: text })}
                                            style={styles.fieldInput}
                                        />
                                    </View>
                                </View>
                                <View style={styles.fieldRow}>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>ISBN (optionnel)</Text>
                                        <NativeInput
                                            placeholder="Ex: 978-2-7531-0584-3"
                                            value={newProduct.isbn || ''}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, isbn: text })}
                                            style={styles.fieldInput}
                                        />
                                    </View>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>Année d'édition</Text>
                                        <NativeInput
                                            placeholder="Ex: 2023"
                                            value={newProduct.anneeEdition || ''}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, anneeEdition: text })}
                                            style={styles.fieldInput}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>
                            </>
                        )}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>État</Text>
                            <View style={styles.pickerButtons}>
                                {['Neuf', 'Bon état', 'Occasion'].map((etat) => (
                                    <TouchableOpacity
                                        key={etat}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.etatLivre === etat && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, etatLivre: etat })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.etatLivre === etat && styles.pickerButtonTextActive
                                        ]}>
                                            {etat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez le niveau et la matière pour aider les étudiants à trouver le bon article
                            </Text>
                        </View>
                    </>
                );

            case 'pharmacie':
                return (
                    <>
                        {/* Planification nuit simplifiée */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>🌙 Fonctionnement la nuit</Text>
                            <View style={styles.pickerButtons}>
                                {['Permanence nuit', 'Planning hebdomadaire'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typePharmacie === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typePharmacie: type, joursGarde: type === 'Permanence nuit' ? 'Tous les jours' : undefined })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typePharmacie === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Planning hebdomadaire de garde */}
                        {newProduct.typePharmacie === 'Planning hebdomadaire' && (
                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>Jours de garde la nuit</Text>
                                <Text style={styles.fieldHint}>Sélectionnez les jours où votre pharmacie est de garde la nuit</Text>
                                <View style={styles.weekDaysContainer}>
                                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((jour, index) => {
                                        const joursArray = (newProduct.joursGarde || '').split(',').map(j => j.trim());
                                        const isSelected = joursArray.includes(jour);
                                        return (
                                            <TouchableOpacity
                                                key={jour}
                                                style={[
                                                    styles.dayButton,
                                                    isSelected && styles.dayButtonActive
                                                ]}
                                                onPress={() => {
                                                    const current = (newProduct.joursGarde || '').split(',').map(j => j.trim()).filter(j => j);
                                                    const updated = isSelected
                                                        ? current.filter(j => j !== jour)
                                                        : [...current, jour];
                                                    setNewProduct({ ...newProduct, joursGarde: updated.join(', ') });
                                                }}
                                            >
                                                <Text style={[
                                                    styles.dayButtonText,
                                                    isSelected && styles.dayButtonTextActive
                                                ]}>
                                                    {jour}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Heure d'ouverture</Text>
                                <NativeInput
                                    placeholder="Ex: 08:00"
                                    value={newProduct.heuresOuverture || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, heuresOuverture: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Heure de fermeture</Text>
                                <NativeInput
                                    placeholder="Ex: 20:00"
                                    value={newProduct.heuresFermeture || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, heuresFermeture: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Téléphone d'urgence</Text>
                            <NativeInput
                                placeholder="Ex: +237 6XX XX XX XX"
                                value={newProduct.telephoneUrgence || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, telephoneUrgence: text })}
                                style={styles.fieldInput}
                            />
                        </View>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Services disponibles</Text>
                            <NativeInput
                                placeholder="Ex: Délivrance, Conseil pharmaceutique, Vaccination"
                                value={newProduct.services || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, services: text })}
                                multiline
                                style={[styles.fieldInput, styles.textareaInput]}
                            />
                        </View>
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 {newProduct.typePharmacie === 'Permanence nuit' ? 'Votre pharmacie est de garde tous les soirs' : 'Sélectionnez les jours de garde hebdomadaire'}
                            </Text>
                        </View>
                    </>
                );

            case 'hopital_clinique': {
                // Listes de prestations médicales disponibles
                const prestationsMedicalesOptions = [
                    'Consultation générale', 'Consultation spécialisée', 'Chirurgie',
                    'Maternité / Accouchement', 'Pédiatrie', 'Cardiologie',
                    'Radiologie', 'Échographie', 'Scanner', 'IRM',
                    'Laboratoire', 'Analyses médicales', 'Pharmacie',
                    'Urgences 24h/24', 'Hospitalisation', 'Soins intensifs',
                    'Dialyse', 'Dentaire', 'Ophtalmologie', 'ORL',
                    'Kinésithérapie', 'Radiothérapie', 'Chimiothérapie'
                ];

                const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

                return (
                    <>
                        {/* Type d'établissement */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type d'établissement médical</Text>
                            <View style={styles.pickerButtons}>
                                {['Hôpital', 'Clinique', 'Centre de santé', 'Dispensaire'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeEtablissement === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeEtablissement: type })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeEtablissement === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Banque de sang */}
                        <View style={styles.fieldContainer}>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, banqueSang: !newProduct.banqueSang })}
                            >
                                <View style={[
                                    styles.checkbox,
                                    newProduct.banqueSang && styles.checkboxChecked
                                ]}>
                                    {newProduct.banqueSang && (
                                        <SafeIcon name="check" size={16} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>🩸 Banque de sang disponible</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Prestations médicales disponibles */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Prestations médicales disponibles</Text>
                            <Text style={styles.fieldHint}>Cochez les prestations et configurez leur planning</Text>
                            <ScrollView style={styles.checkboxList} nestedScrollEnabled>
                                {prestationsMedicalesOptions.map((prestation) => {
                                    const isSelected = (newProduct.prestationsMedicales || []).includes(prestation);
                                    return (
                                        <View key={prestation}>
                                            <TouchableOpacity
                                                style={styles.checkboxItem}
                                                onPress={() => {
                                                    const current = newProduct.prestationsMedicales || [];
                                                    if (current.includes(prestation)) {
                                                        setNewProduct({
                                                            ...newProduct,
                                                            prestationsMedicales: current.filter(p => p !== prestation),
                                                            planningHebdomadaire: {
                                                                ...newProduct.planningHebdomadaire,
                                                                [prestation]: undefined
                                                            }
                                                        });
                                                    } else {
                                                        setNewProduct({
                                                            ...newProduct,
                                                            prestationsMedicales: [...current, prestation]
                                                        });
                                                    }
                                                }}
                                            >
                                                <View style={[
                                                    styles.checkbox,
                                                    isSelected && styles.checkboxChecked
                                                ]}>
                                                    {isSelected && (
                                                        <SafeIcon name="check" size={14} color="#FFFFFF" />
                                                    )}
                                                </View>
                                                <Text style={styles.checkboxLabel}>{prestation}</Text>
                                            </TouchableOpacity>

                                            {/* Planning pour cette prestation si cochée */}
                                            {isSelected && (
                                                <View style={styles.prestationPlanningContainer}>
                                                    <Text style={styles.prestationPlanningTitle}>📅 Planning pour {prestation}</Text>

                                                    {/* Jours disponibles */}
                                                    <Text style={styles.fieldHint}>Jours disponibles :</Text>
                                                    <View style={styles.weekDaysContainer}>
                                                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((jour) => {
                                                            const joursArray = (newProduct.planningHebdomadaire?.[prestation]?.jours || '').split(',').map(j => j.trim());
                                                            const isJourSelected = joursArray.includes(jour);
                                                            return (
                                                                <TouchableOpacity
                                                                    key={jour}
                                                                    style={[
                                                                        styles.dayButton,
                                                                        isJourSelected && styles.dayButtonActive
                                                                    ]}
                                                                    onPress={() => {
                                                                        const current = (newProduct.planningHebdomadaire?.[prestation]?.jours || '').split(',').map(j => j.trim()).filter(j => j);
                                                                        const updated = isJourSelected
                                                                            ? current.filter(j => j !== jour)
                                                                            : [...current, jour];
                                                                        setNewProduct({
                                                                            ...newProduct,
                                                                            planningHebdomadaire: {
                                                                                ...newProduct.planningHebdomadaire,
                                                                                [prestation]: {
                                                                                    ...newProduct.planningHebdomadaire?.[prestation],
                                                                                    jours: updated.join(', ')
                                                                                }
                                                                            }
                                                                        });
                                                                    }}
                                                                >
                                                                    <Text style={[
                                                                        styles.dayButtonText,
                                                                        isJourSelected && styles.dayButtonTextActive
                                                                    ]}>
                                                                        {jour}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>

                                                    {/* Moment de disponibilité */}
                                                    <Text style={styles.fieldHint}>Moment de disponibilité :</Text>
                                                    <View style={styles.pickerButtons}>
                                                        {['Journée', 'Nuit', '24h/24'].map((moment) => (
                                                            <TouchableOpacity
                                                                key={moment}
                                                                style={[
                                                                    styles.pickerButton,
                                                                    newProduct.planningHebdomadaire?.[prestation]?.moment === moment && styles.pickerButtonActive
                                                                ]}
                                                                onPress={() => setNewProduct({
                                                                    ...newProduct,
                                                                    planningHebdomadaire: {
                                                                        ...newProduct.planningHebdomadaire,
                                                                        [prestation]: {
                                                                            ...newProduct.planningHebdomadaire?.[prestation],
                                                                            moment
                                                                        }
                                                                    }
                                                                })}
                                                            >
                                                                <Text style={[
                                                                    styles.pickerButtonText,
                                                                    newProduct.planningHebdomadaire?.[prestation]?.moment === moment && styles.pickerButtonTextActive
                                                                ]}>
                                                                    {moment}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* RDV en ligne */}
                        <View style={styles.fieldContainer}>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, rdvEnLigne: !newProduct.rdvEnLigne })}
                            >
                                <View style={[
                                    styles.checkbox,
                                    newProduct.rdvEnLigne && styles.checkboxChecked
                                ]}>
                                    {newProduct.rdvEnLigne && (
                                        <SafeIcon name="check" size={16} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>📅 Prise de rendez-vous en ligne disponible</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Renseignez précisément vos prestations et horaires pour aider les patients à trouver le bon service médical
                            </Text>
                        </View>
                    </>
                );
            }

            case 'demenagement':
                return (
                    <>
                        {/* Type de déménagement */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de déménagement</Text>
                            <View style={styles.pickerButtons}>
                                {['Local', 'National', 'International'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeDemenagement === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeDemenagement: type })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeDemenagement === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Volume estimé */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Volume estimé (m³)</Text>
                            <NativeInput
                                placeholder="Ex: 20, 30, 40"
                                value={newProduct.volumeEstime || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, volumeEstime: text })}
                                keyboardType="numeric"
                                style={styles.fieldInput}
                            />
                            <Text style={styles.fieldHint}>Volume maximal que vous pouvez transporter</Text>
                        </View>

                        {/* Type de véhicule */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de véhicule disponible</Text>
                            <View style={styles.pickerButtons}>
                                {['Camionnette 10m³', 'Camion 20m³', 'Camion 30m³', 'Camion 40m³+'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeVehicule === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeVehicule: type })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeVehicule === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Distance maximale */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Distance maximale (km)</Text>
                            <NativeInput
                                placeholder="Ex: 50, 500, 2000"
                                value={newProduct.distanceKm || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, distanceKm: text })}
                                keyboardType="numeric"
                                style={styles.fieldInput}
                            />
                            <Text style={styles.fieldHint}>Distance maximale que vous couvrez</Text>
                        </View>

                        {/* Nombre de déménageurs */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Nombre de déménageurs</Text>
                            <View style={styles.pickerButtons}>
                                {['1', '2', '3', '4', '5+'].map((nb) => (
                                    <TouchableOpacity
                                        key={nb}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.nbDemenageurs === nb && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, nbDemenageurs: nb })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.nbDemenageurs === nb && styles.pickerButtonTextActive
                                        ]}>
                                            {nb}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Services inclus */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Services inclus</Text>
                            <Text style={styles.fieldHint}>Cochez tous les services que vous proposez</Text>

                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, assuranceMarchandise: !newProduct.assuranceMarchandise })}
                            >
                                <View style={[styles.checkbox, newProduct.assuranceMarchandise && styles.checkboxChecked]}>
                                    {newProduct.assuranceMarchandise && <SafeIcon name="check" size={16} color="#FFFFFF" />}
                                </View>
                                <Text style={styles.checkboxLabel}>🛡️ Assurance marchandise</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, serviceManutention: !newProduct.serviceManutention })}
                            >
                                <View style={[styles.checkbox, newProduct.serviceManutention && styles.checkboxChecked]}>
                                    {newProduct.serviceManutention && <SafeIcon name="check" size={16} color="#FFFFFF" />}
                                </View>
                                <Text style={styles.checkboxLabel}>💪 Service de manutention</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, montageDemontage: !newProduct.montageDemontage })}
                            >
                                <View style={[styles.checkbox, newProduct.montageDemontage && styles.checkboxChecked]}>
                                    {newProduct.montageDemontage && <SafeIcon name="check" size={16} color="#FFFFFF" />}
                                </View>
                                <Text style={styles.checkboxLabel}>🔧 Montage / Démontage meubles</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, emballageCartons: !newProduct.emballageCartons })}
                            >
                                <View style={[styles.checkbox, newProduct.emballageCartons && styles.checkboxChecked]}>
                                    {newProduct.emballageCartons && <SafeIcon name="check" size={16} color="#FFFFFF" />}
                                </View>
                                <Text style={styles.checkboxLabel}>📦 Fourniture cartons d'emballage</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, gardeMeuble: !newProduct.gardeMeuble })}
                            >
                                <View style={[styles.checkbox, newProduct.gardeMeuble && styles.checkboxChecked]}>
                                    {newProduct.gardeMeuble && <SafeIcon name="check" size={16} color="#FFFFFF" />}
                                </View>
                                <Text style={styles.checkboxLabel}>🏠 Garde-meuble disponible</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, debarras: !newProduct.debarras })}
                            >
                                <View style={[styles.checkbox, newProduct.debarras && styles.checkboxChecked]}>
                                    {newProduct.debarras && <SafeIcon name="check" size={16} color="#FFFFFF" />}
                                </View>
                                <Text style={styles.checkboxLabel}>🗑️ Service de débarras</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Date de disponibilité */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Première date de disponibilité</Text>
                            <NativeInput
                                placeholder="Ex: 2025-01-15"
                                value={newProduct.dateDemenagementDisponible || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, dateDemenagementDisponible: text })}
                                style={styles.fieldInput}
                            />
                            <Text style={styles.fieldHint}>Format: AAAA-MM-JJ</Text>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez tous vos services pour que les clients puissent comparer facilement les offres
                            </Text>
                        </View>
                    </>
                );

            case 'cosmetique_parfum':
                return (
                    <>
                        {/* Type de produit cosmétique */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de produit</Text>
                            <View style={styles.pickerButtons}>
                                {['Parfum', 'Maquillage', 'Soin visage', 'Soin corps', 'Cheveux', 'Hygiène'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeCosmetique === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeCosmetique: type })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeCosmetique === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Marque */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Marque</Text>
                            <NativeInput
                                placeholder="Ex: Chanel, Dior, Nivea, L'Oréal"
                                value={newProduct.marqueCosmetique || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, marqueCosmetique: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* Volume */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Volume / Poids</Text>
                            <View style={styles.inputRow}>
                                <NativeInput
                                    placeholder="Ex: 50"
                                    value={newProduct.volumeCosmetique || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, volumeCosmetique: text })}
                                    keyboardType="numeric"
                                    style={[styles.fieldInput, { flex: 1, marginRight: 8 }]}
                                />
                                <View style={styles.pickerButtons}>
                                    {['ml', 'g', 'unité'].map((unit) => (
                                        <TouchableOpacity
                                            key={unit}
                                            style={[
                                                styles.pickerButton,
                                                newProduct.uniteCosmetique === unit && styles.pickerButtonActive
                                            ]}
                                            onPress={() => setNewProduct({ ...newProduct, uniteCosmetique: unit })}
                                        >
                                            <Text style={[
                                                styles.pickerButtonText,
                                                newProduct.uniteCosmetique === unit && styles.pickerButtonTextActive
                                            ]}>
                                                {unit}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Type de peau */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de peau / Cible</Text>
                            <View style={styles.pickerButtons}>
                                {['Toutes peaux', 'Peau sèche', 'Peau grasse', 'Peau mixte', 'Peau sensible', 'Femme', 'Homme', 'Enfant'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typePeau === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typePeau: type })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typePeau === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Âge recommandé */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Âge recommandé</Text>
                            <View style={styles.pickerButtons}>
                                {['Tous âges', '16+', '18+', '25+', '35+', '50+'].map((age) => (
                                    <TouchableOpacity
                                        key={age}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.ageRecommandé === age && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, ageRecommandé: age })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.ageRecommandé === age && styles.pickerButtonTextActive
                                        ]}>
                                            {age}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Ingrédients principaux */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Ingrédients principaux</Text>
                            <NativeInput
                                placeholder="Ex: Vitamine E, Argan, Aloe Vera, Collagène"
                                value={newProduct.ingredientsCosmetique || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, ingredientsCosmetique: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* Origine */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Origine / Pays</Text>
                            <NativeInput
                                placeholder="Ex: France, Corée du Sud, Maroc"
                                value={newProduct.origineCosmetique || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, origineCosmetique: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                ✨ Précisez les caractéristiques pour aider les clients à choisir le bon produit cosmétique
                            </Text>
                        </View>
                    </>
                );

            case 'bijoux':
                return (
                    <>
                        {/* Type de bijou */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de bijou</Text>
                            <View style={styles.pickerButtons}>
                                {['Collier', 'Bague', 'Bracelet', 'Boucles d\'oreilles', 'Montre', 'Pierres précieuses'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeBijou === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeBijou: type })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeBijou === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Matière */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Matière principale</Text>
                            <View style={styles.pickerButtons}>
                                {['Or jaune', 'Or blanc', 'Or rose', 'Argent', 'Platine', 'Acier', 'Cuir', 'Autre'].map((matiere) => (
                                    <TouchableOpacity
                                        key={matiere}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.matiereBijou === matiere && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, matiereBijou: matiere })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.matiereBijou === matiere && styles.pickerButtonTextActive
                                        ]}>
                                            {matiere}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Poids */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Poids</Text>
                            <View style={styles.inputRow}>
                                <NativeInput
                                    placeholder="Ex: 15"
                                    value={newProduct.poidsBijou || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, poidsBijou: text })}
                                    keyboardType="numeric"
                                    style={[styles.fieldInput, { flex: 1, marginRight: 8 }]}
                                />
                                <View style={styles.pickerButtons}>
                                    {['g', 'carat', 'oz'].map((unit) => (
                                        <TouchableOpacity
                                            key={unit}
                                            style={[
                                                styles.pickerButton,
                                                newProduct.unitePoids === unit && styles.pickerButtonActive
                                            ]}
                                            onPress={() => setNewProduct({ ...newProduct, unitePoids: unit })}
                                        >
                                            <Text style={[
                                                styles.pickerButtonText,
                                                newProduct.unitePoids === unit && styles.pickerButtonTextActive
                                            ]}>
                                                {unit}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Taille */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Taille / Dimensions</Text>
                            <NativeInput
                                placeholder="Ex: 54, 16 pouces, 40mm"
                                value={newProduct.tailleBijou || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, tailleBijou: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* Style */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Style</Text>
                            <View style={styles.pickerButtons}>
                                {['Classique', 'Moderne', 'Vintage', 'Bohemian', 'Luxe', 'Minimaliste', 'Sport'].map((style) => (
                                    <TouchableOpacity
                                        key={style}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.styleBijou === style && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, styleBijou: style })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.styleBijou === style && styles.pickerButtonTextActive
                                        ]}>
                                            {style}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Origine */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Origine / Pays de fabrication</Text>
                            <NativeInput
                                placeholder="Ex: Italie, Suisse, France, Thaïlande"
                                value={newProduct.origineBijou || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, origineBijou: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* Certificat */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Certificat d'authenticité</Text>
                            <View style={styles.pickerButtons}>
                                {['Oui', 'Non'].map((cert) => (
                                    <TouchableOpacity
                                        key={cert}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.certificatBijou === cert && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, certificatBijou: cert })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.certificatBijou === cert && styles.pickerButtonTextActive
                                        ]}>
                                            {cert}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💎 Précisez tous les détails pour rassurer les clients sur l'authenticité et la qualité
                            </Text>
                        </View>
                    </>
                );

            case 'coiffure_beaute':
                return (
                    <>
                        {/* Type de coiffure */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de produit</Text>
                            <View style={styles.pickerButtons}>
                                {['Mèches', 'Extensions', 'Perruque', 'Tissage', 'Closure', 'Frontal', 'Accessoires'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeCoiffure === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeCoiffure: type })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeCoiffure === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Longueur */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Longueur</Text>
                            <View style={styles.pickerButtons}>
                                {['10cm', '20cm', '30cm', '40cm', '50cm', '60cm', '70cm+'].map((longueur) => (
                                    <TouchableOpacity
                                        key={longueur}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.longueurMech === longueur && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, longueurMech: longueur })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.longueurMech === longueur && styles.pickerButtonTextActive
                                        ]}>
                                            {longueur}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Couleur */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Couleur</Text>
                            <NativeInput
                                placeholder="Ex: Noir naturel, Blond platine, Châtain clair"
                                value={newProduct.couleurMech || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, couleurMech: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* Texture */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Texture</Text>
                            <View style={styles.pickerButtons}>
                                {['Lisse', 'Ondulée', 'Bouclée', 'Crépue', 'Kinky', 'Afro'].map((texture) => (
                                    <TouchableOpacity
                                        key={texture}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.textureMech === texture && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, textureMech: texture })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.textureMech === texture && styles.pickerButtonTextActive
                                        ]}>
                                            {texture}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Type de pose */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de pose</Text>
                            <View style={styles.pickerButtons}>
                                {['Clip', 'Collage', 'Tissage', 'Tresse', 'Crochet', 'Lace'].map((pose) => (
                                    <TouchableOpacity
                                        key={pose}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typePose === pose && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typePose: pose })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typePose === pose && styles.pickerButtonTextActive
                                        ]}>
                                            {pose}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Marque */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Marque</Text>
                            <NativeInput
                                placeholder="Ex: Remy Hair, Virgin Hair, Brazilian Hair"
                                value={newProduct.marqueCoiffure || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, marqueCoiffure: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* Origine */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Origine des cheveux</Text>
                            <View style={styles.pickerButtons}>
                                {['Brésilien', 'Péruvien', 'Indien', 'Malaisien', 'Cambodgien', 'Européen', 'Synthétique'].map((origine) => (
                                    <TouchableOpacity
                                        key={origine}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.origineMech === origine && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, origineMech: origine })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.origineMech === origine && styles.pickerButtonTextActive
                                        ]}>
                                            {origine}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Type de cheveux */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type de cheveux</Text>
                            <View style={styles.pickerButtons}>
                                {['100% Naturel', 'Remy Hair', 'Virgin Hair', 'Semi-naturel', 'Synthétique'].map((typeChev) => (
                                    <TouchableOpacity
                                        key={typeChev}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.typeCheveux === typeChev && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, typeCheveux: typeChev })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.typeCheveux === typeChev && styles.pickerButtonTextActive
                                        ]}>
                                            {typeChev}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Entretien */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Conseils d'entretien</Text>
                            <NativeInput
                                placeholder="Ex: Shampoing doux, Séchage naturel, Éviter chaleur élevée"
                                value={newProduct.entretienMech || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, entretienMech: text })}
                                multiline
                                style={[styles.fieldInput, styles.textareaInput]}
                            />
                        </View>

                        {/* Durée de vie */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Durée de vie estimée</Text>
                            <View style={styles.pickerButtons}>
                                {['1-3 mois', '3-6 mois', '6-12 mois', '1-2 ans', '2+ ans'].map((duree) => (
                                    <TouchableOpacity
                                        key={duree}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.dureeVie === duree && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, dureeVie: duree })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.dureeVie === duree && styles.pickerButtonTextActive
                                        ]}>
                                            {duree}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💇‍♀️ Précisez la qualité, l'origine et l'entretien pour aider vos clientes à faire le bon choix
                            </Text>
                        </View>
                    </>
                );

            case 'assurance':
                return (
                    <>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Type d'assurance <Text style={styles.required}>*</Text></Text>
                            <View style={styles.pickerButtons}>
                                {['Vie', 'Non-Vie'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.categorieAssurance === type && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, categorieAssurance: type, typeAssurance: '' })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.categorieAssurance === type && styles.pickerButtonTextActive
                                        ]}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Sous-catégories selon Vie ou Non-Vie */}
                        {newProduct.categorieAssurance && (
                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>Sous-catégorie <Text style={styles.required}>*</Text></Text>
                                <View style={styles.pickerButtons}>
                                    {newProduct.categorieAssurance === 'Vie' ? (
                                        ['Vie entière', 'Temporaire décès', 'Épargne retraite', 'Prévoyance', 'Obsèques'].map((subtype) => (
                                            <TouchableOpacity
                                                key={subtype}
                                                style={[
                                                    styles.pickerButton,
                                                    newProduct.typeAssurance === subtype && styles.pickerButtonActive
                                                ]}
                                                onPress={() => setNewProduct({ ...newProduct, typeAssurance: subtype })}
                                            >
                                                <Text style={[
                                                    styles.pickerButtonText,
                                                    newProduct.typeAssurance === subtype && styles.pickerButtonTextActive
                                                ]}>
                                                    {subtype}
                                                </Text>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        ['Auto', 'Habitation', 'Santé', 'Voyage', 'Responsabilité civile', 'Entreprise'].map((subtype) => (
                                            <TouchableOpacity
                                                key={subtype}
                                                style={[
                                                    styles.pickerButton,
                                                    newProduct.typeAssurance === subtype && styles.pickerButtonActive
                                                ]}
                                                onPress={() => setNewProduct({ ...newProduct, typeAssurance: subtype })}
                                            >
                                                <Text style={[
                                                    styles.pickerButtonText,
                                                    newProduct.typeAssurance === subtype && styles.pickerButtonTextActive
                                                ]}>
                                                    {subtype}
                                                </Text>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>
                            </View>
                        )}

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Compagnie d'assurance</Text>
                                <NativeInput
                                    placeholder="Ex: AXA Assurances"
                                    value={newProduct.compagnieAssurance || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, compagnieAssurance: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Couverture / Garanties</Text>
                            <NativeInput
                                placeholder="Ex: Tous risques, Protection juridique, Assistance 24h/24"
                                value={newProduct.couverture || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, couverture: text })}
                                multiline
                                style={[styles.fieldInput, styles.textareaInput]}
                            />
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Prime annuelle (FCFA)</Text>
                                <NativeInput
                                    placeholder="Ex: 150000"
                                    value={newProduct.primeAnnuelle || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, primeAnnuelle: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Franchise (FCFA)</Text>
                                <NativeInput
                                    placeholder="Ex: 50000"
                                    value={newProduct.franchise || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, franchise: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Durée du contrat</Text>
                            <View style={styles.pickerButtons}>
                                {['1 an', '2 ans', '5 ans', '10 ans', 'Vie entière'].map((duree) => (
                                    <TouchableOpacity
                                        key={duree}
                                        style={[
                                            styles.pickerButton,
                                            newProduct.dureeContrat === duree && styles.pickerButtonActive
                                        ]}
                                        onPress={() => setNewProduct({ ...newProduct, dureeContrat: duree })}
                                    >
                                        <Text style={[
                                            styles.pickerButtonText,
                                            newProduct.dureeContrat === duree && styles.pickerButtonTextActive
                                        ]}>
                                            {duree}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Principaux bénéfices</Text>
                            <NativeInput
                                placeholder="Ex: Capital décès, Rente invalidité, Assistance rapatriement..."
                                value={newProduct.benefices || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, benefices: text })}
                                multiline
                                style={[styles.fieldInput, styles.textareaInput]}
                            />
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 <Text style={styles.hintBold}>Conseil :</Text> Détaillez bien les garanties et la couverture pour aider vos clients à comparer les offres.
                            </Text>
                        </View>
                    </>
                );

            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Liste des produits */}
            {products.length > 0 ? (
                <ScrollView style={styles.productsList} showsVerticalScrollIndicator={false}>
                    {products.map((product) => {
                        const typeInfo = getProductTypeInfo(product.type);
                        return (
                            <View key={product.id} style={styles.productCard}>
                                <View style={styles.productContent}>
                                    {product.images && product.images.length > 0 && (
                                        <Image
                                            source={{ uri: product.images[0] }}
                                            style={styles.productImage}
                                            resizeMode="cover"
                                        />
                                    )}
                                    <View style={styles.productInfo}>
                                        <View style={styles.productHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.productBadge}>
                                                    {typeInfo.icon} {typeInfo.label}
                                                </Text>
                                                <Text style={styles.productName}>{product.nom}</Text>
                                            </View>
                                            {!readonly && (
                                                <View style={styles.productActions}>
                                                    <TouchableOpacity
                                                        style={styles.actionButton}
                                                        onPress={() => handleEditProduct(product)}
                                                    >
                                                        <SafeIcon name="edit-2" size={16} color={modernColors.primary} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.actionButton}
                                                        onPress={() => handleDeleteProduct(product.id)}
                                                    >
                                                        <SafeIcon name="trash-2" size={16} color={modernColors.error} />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.productPrice}>
                                            {product.prix} {product.devise}
                                        </Text>
                                        {product.description && (
                                            <Text style={styles.productDescription} numberOfLines={2}>
                                                {product.description}
                                            </Text>
                                        )}
                                        {product.images && product.images.length > 1 && (
                                            <Text style={styles.productMediaCount}>
                                                📷 {product.images.length} image(s)
                                            </Text>
                                        )}
                                        {product.videos && product.videos.length > 0 && (
                                            <Text style={styles.productMediaCount}>
                                                🎥 {product.videos.length} vidéo(s)
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            ) : (
                <View style={styles.emptyState}>
                    <SafeIcon name="package" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucun produit ajouté</Text>
                    <Text style={styles.emptyHint}>
                        Ajoutez des produits pour enrichir votre offre
                    </Text>
                </View>
            )}

            {/* Boutons d'ajout et d'import */}
            {!readonly && (
                <View style={styles.buttonsContainer}>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => {
                            setCurrentStep('type');
                            setShowAddModal(true);
                        }}
                    >
                        <LinearGradient
                            colors={modernColors.primaryGradient}
                            style={styles.addButtonGradient}
                        >
                            <SafeIcon name="plus" size={20} color="#FFFFFF" />
                            <Text style={styles.addButtonText}>Ajouter un produit</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {/* Modal d'ajout/modification */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={handleCancel}
            >
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <LinearGradient
                        colors={modernColors.primaryGradient}
                        style={styles.modalHeaderGradient}
                    >
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={handleCancel}
                        >
                            <SafeIcon name="x" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.modalHeaderTitle}>
                            {editingProductId ? 'Modifier le produit' : 'Nouveau produit'}
                        </Text>
                        <View style={styles.modalSpacer} />
                    </LinearGradient>

                    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                        {/* Étape 1: Sélection du type */}
                        {currentStep === 'type' && (
                            <View style={styles.stepContainer}>
                                <Text style={styles.sectionTitle}>
                                    ✨ Sélectionnez le type de produit <Text style={styles.required}>*</Text>
                                </Text>
                                <Text style={styles.sectionSubtitle}>
                                    Choisissez la catégorie qui correspond le mieux à votre produit
                                </Text>

                                {/* Champ de recherche textuelle */}
                                <View style={styles.searchContainer}>
                                    <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
                                    <NativeInput
                                        placeholder="Rechercher une catégorie..."
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        style={styles.searchInput}
                                    />
                                    {searchQuery.length > 0 && (
                                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                                            <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View style={styles.dropdownContainer}>
                                    {(() => {
                                        // Filtrer les catégories selon la recherche
                                        let filteredTypes = PRODUCT_TYPES.filter(type => {
                                            if (searchQuery.length === 0) return true;
                                            // ✅ Recherche sans sensibilité aux accents
                                            const normalizedQuery = normalizeText(searchQuery);
                                            return normalizeText(type.label).includes(normalizedQuery) ||
                                                normalizeText(type.description).includes(normalizedQuery) ||
                                                ('keywords' in type && type.keywords.some((kw: string) => normalizeText(kw).includes(normalizedQuery)));
                                        });

                                        // ✅ Si aucune catégorie ne correspond et qu'il y a une recherche, proposer "Prestation de service" par défaut
                                        const hasNoResults = filteredTypes.length === 0 && searchQuery.length > 0;
                                        if (hasNoResults) {
                                            const prestationService = PRODUCT_TYPES.find(t => t.value === 'prestation_service');
                                            if (prestationService) {
                                                filteredTypes = [prestationService];
                                            }
                                        }

                                        return (
                                            <>
                                                {hasNoResults && filteredTypes.length > 0 && (
                                                    <View style={styles.noResultsHint}>
                                                        <SafeIcon name="info" size={16} color={modernColors.primary} />
                                                        <Text style={styles.noResultsText}>
                                                            Aucune catégorie ne correspond. Nous vous proposons "Prestation de service" par défaut.
                                                        </Text>
                                                    </View>
                                                )}
                                                {filteredTypes.map((type) => (
                                                    <TouchableOpacity
                                                        key={type.value}
                                                        style={[
                                                            styles.dropdownItem,
                                                            selectedType === type.value && styles.dropdownItemActive
                                                        ]}
                                                        onPress={() => handleSelectType(type.value as ProductType)}
                                                    >
                                                        <View style={styles.dropdownItemLeft}>
                                                            <Text style={styles.dropdownIcon}>{type.icon}</Text>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={[
                                                                    styles.dropdownLabel,
                                                                    selectedType === type.value && styles.dropdownLabelActive
                                                                ]}>{type.label}</Text>
                                                                <Text style={styles.dropdownDescription}>{type.description}</Text>
                                                            </View>
                                                        </View>
                                                        {selectedType === type.value && (
                                                            <SafeIcon name="check" size={20} color={modernColors.primary} />
                                                        )}
                                                    </TouchableOpacity>
                                                ))}
                                            </>
                                        );
                                    })()}
                                </View>
                            </View>
                        )}

                        {/* Étape 2: Formulaire */}
                        {currentStep === 'form' && selectedType && (
                            <View style={styles.stepContainer}>
                                {/* Badge de type sélectionné */}
                                <View style={styles.selectedTypeBadge}>
                                    <Text style={styles.selectedTypeText}>
                                        {getProductTypeInfo(selectedType).icon} {getProductTypeInfo(selectedType).label}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setCurrentStep('type')}
                                        style={styles.changeTypeButton}
                                    >
                                        <Text style={styles.changeTypeText}>Changer</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Bouton télécharger modèle Excel */}
                                <TouchableOpacity
                                    style={styles.templateButton}
                                    onPress={() => downloadExcelTemplate(selectedType)}
                                >
                                    <SafeIcon name="download" size={18} color={modernColors.primary} />
                                    <Text style={styles.templateButtonText}>
                                        Télécharger le modèle Excel
                                    </Text>
                                </TouchableOpacity>

                                {/* Bouton importer Excel */}
                                <TouchableOpacity
                                    style={styles.importExcelButton}
                                    onPress={handleImportExcel}
                                >
                                    <SafeIcon name="file-text" size={18} color={modernColors.success} />
                                    <Text style={styles.importExcelText}>
                                        Importer depuis Excel/CSV
                                    </Text>
                                </TouchableOpacity>

                                <View style={styles.dividerWithText}>
                                    <View style={styles.dividerLine} />
                                    <Text style={styles.dividerText}>ou remplir manuellement</Text>
                                    <View style={styles.dividerLine} />
                                </View>

                                {/* Champs communs - Toujours visibles, pré-remplis pour Prestation de Service */}
                                <View style={styles.fieldContainer}>
                                    <Text style={styles.fieldLabel}>
                                        {getProductNameLabel(selectedType)} <Text style={styles.required}>*</Text>
                                        {selectedType === 'prestation_service' && (
                                            <Text style={styles.autoFilledHint}> (pré-rempli automatiquement)</Text>
                                        )}
                                    </Text>
                                    {selectedType && (
                                        <Text style={styles.categoryReminder}>
                                            📦 Catégorie : {PRODUCT_TYPES.find(t => t.value === selectedType)?.label}
                                        </Text>
                                    )}
                                    <NativeInput
                                        placeholder={getProductNamePlaceholder(selectedType)}
                                        value={newProduct.nom || ''}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, nom: text })}
                                        style={styles.fieldInput}
                                    />
                                </View>

                                <View style={styles.fieldContainer}>
                                    <Text style={styles.fieldLabel}>
                                        Description
                                        {selectedType === 'prestation_service' && (
                                            <Text style={styles.autoFilledHint}> (pré-remplie automatiquement)</Text>
                                        )}
                                    </Text>
                                    <NativeInput
                                        placeholder="Décrivez ce produit..."
                                        value={newProduct.description || ''}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, description: text })}
                                        multiline
                                        style={[styles.fieldInput, styles.textareaInput]}
                                    />
                                </View>

                                {/* Prix et devise - MASQUÉ pour pharmacie et hopital_clinique */}
                                {selectedType !== 'pharmacie' && selectedType !== 'hopital_clinique' && (
                                    <View style={styles.fieldRow}>
                                        <View style={[styles.fieldContainer, { flex: 1 }]}>
                                            <Text style={styles.fieldLabel}>
                                                {selectedType === 'assurance' ? 'Prime (à partir de)' :
                                                    selectedType === 'prestation_service' ? 'À partir de' : 'Prix'}
                                                {selectedType !== 'prestation_service' && selectedType !== 'assurance' && <Text style={styles.required}>*</Text>}
                                            </Text>
                                            <NativeInput
                                                placeholder={selectedType === 'prestation_service' || selectedType === 'assurance' ? 'Prix (optionnel)' : '0'}
                                                value={newProduct.prix || ''}
                                                onChangeText={(text) => setNewProduct({ ...newProduct, prix: text })}
                                                style={styles.fieldInput}
                                                keyboardType="numeric"
                                            />
                                        </View>

                                        <View style={[styles.fieldContainer, { flex: 1 }]}>
                                            <Text style={styles.fieldLabel}>Devise</Text>
                                            <View style={styles.deviseGridContainer}>
                                                {devises.map((devise) => (
                                                    <TouchableOpacity
                                                        key={devise}
                                                        style={[
                                                            styles.deviseButtonGrid,
                                                            newProduct.devise === devise && styles.deviseButtonActive
                                                        ]}
                                                        onPress={() => setNewProduct({ ...newProduct, devise })}
                                                    >
                                                        <Text style={[
                                                            styles.deviseButtonText,
                                                            newProduct.devise === devise && styles.deviseButtonTextActive
                                                        ]}>
                                                            {devise}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Champs spécifiques */}
                                {renderSpecificFields()}

                                {/* Section Promotion */}
                                <View style={styles.promotionSectionContainer}>
                                    <Text style={styles.sectionTitle}>🎁 Promotion (optionnel)</Text>

                                    <TouchableOpacity
                                        style={styles.checkboxContainer}
                                        onPress={() => setNewProduct({ ...newProduct, promotionActive: !newProduct.promotionActive })}
                                    >
                                        <View style={[
                                            styles.checkbox,
                                            newProduct.promotionActive && styles.checkboxChecked
                                        ]}>
                                            {newProduct.promotionActive && (
                                                <SafeIcon name="check" size={16} color="#FFFFFF" />
                                            )}
                                        </View>
                                        <Text style={styles.checkboxLabel}>Activer une promotion pour ce produit</Text>
                                    </TouchableOpacity>

                                    {newProduct.promotionActive && (
                                        <View style={styles.promotionFields}>
                                            <View style={styles.fieldContainer}>
                                                <Text style={styles.fieldLabel}>🏷️ Type de promotion</Text>
                                                <View style={styles.pickerButtons}>
                                                    {(['reduction', 'offre', 'bon_plan', 'flash'] as const).map((type) => (
                                                        <TouchableOpacity
                                                            key={type}
                                                            style={[
                                                                styles.pickerButton,
                                                                newProduct.promotionType === type && styles.pickerButtonActive
                                                            ]}
                                                            onPress={() => setNewProduct({ ...newProduct, promotionType: type })}
                                                        >
                                                            <Text style={[
                                                                styles.pickerButtonText,
                                                                newProduct.promotionType === type && styles.pickerButtonTextActive
                                                            ]}>
                                                                {type === 'reduction' ? 'Réduction' :
                                                                    type === 'offre' ? 'Offre' :
                                                                        type === 'bon_plan' ? 'Bon plan' : 'Flash'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>

                                            <View style={styles.fieldContainer}>
                                                <Text style={styles.fieldLabel}>💰 Valeur</Text>
                                                <NativeInput
                                                    placeholder="Ex: -20%, 1+1 gratuit"
                                                    value={newProduct.promotionValeur || ''}
                                                    onChangeText={(text) => setNewProduct({ ...newProduct, promotionValeur: text })}
                                                    style={styles.fieldInput}
                                                />
                                            </View>

                                            <View style={styles.fieldContainer}>
                                                <Text style={styles.fieldLabel}>📝 Description</Text>
                                                <NativeInput
                                                    placeholder="Décrivez l'offre..."
                                                    value={newProduct.promotionDescription || ''}
                                                    onChangeText={(text) => setNewProduct({ ...newProduct, promotionDescription: text })}
                                                    multiline
                                                    style={[styles.fieldInput, styles.textareaInput]}
                                                />
                                            </View>

                                            <View style={styles.fieldContainer}>
                                                <Text style={styles.fieldLabel}>📅 Date de fin</Text>
                                                <NativeInput
                                                    placeholder="JJ/MM/AAAA"
                                                    value={newProduct.promotionDateFin || ''}
                                                    onChangeText={(text) => setNewProduct({ ...newProduct, promotionDateFin: text })}
                                                    style={styles.fieldInput}
                                                />
                                            </View>
                                        </View>
                                    )}
                                </View>

                                {/* Section Médias */}
                                <View style={styles.mediaSectionContainer}>
                                    <Text style={styles.sectionTitle}>📸 Images du produit</Text>

                                    <TouchableOpacity
                                        style={styles.mediaButton}
                                        onPress={handlePickImages}
                                    >
                                        <SafeIcon name="image" size={20} color={modernColors.primary} />
                                        <Text style={styles.mediaButtonText}>
                                            Ajouter des images
                                        </Text>
                                    </TouchableOpacity>

                                    {newProduct.images && newProduct.images.length > 0 && (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewScroll}>
                                            {newProduct.images.map((image, index) => (
                                                <View key={index} style={styles.mediaPreviewItem}>
                                                    <Image source={{ uri: image }} style={styles.mediaPreviewImage} />
                                                    <TouchableOpacity
                                                        style={styles.removeMediaButton}
                                                        onPress={() => removeImage(index)}
                                                    >
                                                        <SafeIcon name="x" size={16} color="#FFFFFF" />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </ScrollView>
                                    )}

                                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🎥 Vidéos du produit</Text>

                                    <TouchableOpacity
                                        style={styles.mediaButton}
                                        onPress={handlePickVideos}
                                    >
                                        <SafeIcon name="video" size={20} color={modernColors.success} />
                                        <Text style={styles.mediaButtonText}>
                                            Ajouter des vidéos
                                        </Text>
                                    </TouchableOpacity>

                                    {newProduct.videos && newProduct.videos.length > 0 && (
                                        <View style={styles.videosList}>
                                            {newProduct.videos.map((video, index) => (
                                                <View key={index} style={styles.videoItem}>
                                                    <SafeIcon name="video" size={20} color={modernColors.success} />
                                                    <Text style={styles.videoText}>Vidéo {index + 1}</Text>
                                                    <TouchableOpacity
                                                        style={styles.removeVideoButton}
                                                        onPress={() => removeVideo(index)}
                                                    >
                                                        <SafeIcon name="trash-2" size={16} color={modernColors.error} />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer avec boutons */}
                    {currentStep === 'form' && (
                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={handleCancel}
                                variant="secondary"
                                style={{ flex: 1 }}
                            />
                            <NativeButton
                                title={editingProductId ? 'Modifier' : 'Ajouter'}
                                onPress={handleAddProduct}
                                variant="primary"
                                style={{ flex: 1 }}
                            />
                        </View>
                    )}
                </View>
            </Modal>

            {/* Modal de sélection de place pour tickets de voyage */}
            <BusSeatSelector
                visible={showSeatSelector}
                onClose={() => setShowSeatSelector(false)}
                onSelectSeat={(seatLabel) => {
                    setNewProduct({ ...newProduct, numeroPlace: seatLabel });
                }}
                busType="standard"
            />

            {/* Modal GPS pour immobilier et hôtellerie */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={(coordinatesString) => {
                    const firstPoint = coordinatesString.split('|')[0].split(',');
                    if (firstPoint.length === 2) {
                        const lat = parseFloat(firstPoint[0]);
                        const lng = parseFloat(firstPoint[1]);
                        setSelectedGPSLocation({ lat, lng });

                        // ✅ Déterminer quel champ GPS mettre à jour selon le type
                        if (selectedType === 'immobilier_batiment' || selectedType === 'immobilier_terrain') {
                            setNewProduct({ ...newProduct, gpsImmobilier: coordinatesString });
                        } else if (selectedType === 'hotellerie') {
                            setNewProduct({ ...newProduct, gpsHotel: coordinatesString });
                        } else {
                            // Fallback pour autres types qui pourraient utiliser GPS
                            setNewProduct({ ...newProduct, gpsImmobilier: coordinatesString });
                        }
                    }
                    setShowGPSModal(false);
                }}
                currentLocation={selectedGPSLocation}
                title="Localisation du bien immobilier"
                allowZoneSelection={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    productsList: {
        maxHeight: 400,
    },
    productCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    productContent: {
        flexDirection: 'row',
        gap: 12,
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: modernColors.background,
    },
    productInfo: {
        flex: 1,
    },
    productHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    productBadge: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    productName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    productActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
        backgroundColor: modernColors.background,
        borderRadius: 8,
    },
    productPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 4,
    },
    productDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 16,
        marginBottom: 4,
    },
    productMediaCount: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginTop: 12,
    },
    emptyHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    buttonsContainer: {
        marginTop: 12,
        gap: 8,
    },
    addButton: {
        marginTop: 8,
    },
    addButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    modalHeaderGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalHeaderTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    modalSpacer: {
        width: 40,
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    stepContainer: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: modernColors.border,
        paddingHorizontal: 12,
        marginBottom: 16,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 14,
        color: modernColors.text,
    },
    dropdownContainer: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        overflow: 'hidden',
    },
    noResultsHint: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#EEF2FF',
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        gap: 8,
    },
    noResultsText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.primary,
        lineHeight: 18,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    dropdownItemActive: {
        backgroundColor: '#EFF6FF',
    },
    dropdownItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    dropdownIcon: {
        fontSize: 24,
    },
    dropdownLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: modernColors.text,
        flex: 1,
    },
    dropdownLabelActive: {
        fontWeight: '600',
        color: modernColors.primary,
    },
    dropdownDescription: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    selectedTypeBadge: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    selectedTypeText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    changeTypeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    changeTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    templateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    templateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    importExcelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.success,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    importExcelText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.success,
    },
    dividerWithText: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: modernColors.border,
    },
    dividerText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginHorizontal: 12,
    },
    fieldContainer: {
        marginBottom: 16,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    required: {
        color: modernColors.error,
    },
    autoFilledHint: {
        fontSize: 11,
        color: modernColors.success,
        fontStyle: 'italic',
        fontWeight: '400',
    },
    fieldInput: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: modernColors.text,
    },
    textareaInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    pickerContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    deviseButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginRight: 4,
    },
    deviseButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    deviseButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    deviseButtonTextActive: {
        color: '#FFFFFF',
    },
    mediaSectionContainer: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    mediaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.border,
        borderStyle: 'dashed',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    mediaButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    mediaPreviewScroll: {
        marginTop: 12,
    },
    mediaPreviewItem: {
        position: 'relative',
        marginRight: 12,
    },
    mediaPreviewImage: {
        width: 100,
        height: 100,
        borderRadius: 8,
    },
    removeMediaButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.error,
        alignItems: 'center',
        justifyContent: 'center',
    },
    videosList: {
        marginTop: 12,
        gap: 8,
    },
    videoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: modernColors.surface,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    videoText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    removeVideoButton: {
        padding: 8,
    },
    hintBox: {
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.primary,
    },
    hintText: {
        fontSize: 12,
        color: modernColors.text,
        lineHeight: 16,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    seatSelectionContainer: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    seatSelectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
    },
    seatSelectorButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    scrollablePicker: {
        maxHeight: 50,
        marginBottom: 8,
    },
    pickerButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pickerButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    pickerButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    pickerButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    pickerButtonTextActive: {
        color: '#FFFFFF',
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    checkboxLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        flex: 1,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 8,
    },
    gpsButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    gpsInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: modernColors.success,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginTop: 8,
        gap: 8,
    },
    gpsInfoText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.text,
    },
    // Styles pour les prestations de service
    prestationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    addPrestationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderRadius: 8,
    },
    addPrestationText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    prestationCard: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    prestationCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    prestationCardTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    deletePrestationButton: {
        padding: 6,
        borderRadius: 6,
        backgroundColor: '#FEE2E2',
    },
    prestationFieldContainer: {
        marginBottom: 12,
    },
    prestationFieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    prestationFieldRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: 12,
    },
    xafLabel: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    xafText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    emptyPrestationState: {
        alignItems: 'center',
        padding: 32,
        backgroundColor: modernColors.background,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        borderStyle: 'dashed',
    },
    emptyPrestationText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginTop: 12,
    },
    emptyPrestationSubtext: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    // Style pour le rappel de catégorie
    categoryReminder: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    // Styles pour Logo et Bannière
    logoBannerContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    logoBannerItem: {
        flex: 1,
        gap: 8,
    },
    logoBannerLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    logoBannerButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.border,
        borderStyle: 'dashed',
        borderRadius: 12,
        paddingVertical: 20,
        paddingHorizontal: 16,
        gap: 8,
    },
    logoBannerButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
    logoPreview: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    bannerPreview: {
        width: '100%',
        height: 80,
        borderRadius: 8,
    },
    removeLogoBannerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#FEE2E2',
        borderRadius: 6,
    },
    removeLogoBannerText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.error,
    },
    // ✅ NOUVEAU: Styles pour listes à cocher (prestations médicales)
    checkboxList: {
        maxHeight: 300,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 8,
        marginTop: 8,
        backgroundColor: modernColors.surface,
    },
    checkboxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    // ✅ NOUVEAU: Styles pour planning hebdomadaire
    planningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    planningJour: {
        width: 80,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    planningInputs: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    planningInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 8,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    planningDivider: {
        fontSize: 14,
        color: modernColors.textSecondary,
        paddingHorizontal: 4,
    },
    checkboxSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    checkboxLabelSmall: {
        fontSize: 12,
        color: modernColors.text,
    },
    // Styles pour les jours de la semaine (pharmacie)
    weekDaysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    dayButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dayButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    dayButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    dayButtonTextActive: {
        color: '#FFFFFF',
    },
    // Grille de devises (toutes visibles)
    deviseGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    deviseButtonGrid: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        minWidth: 60,
        alignItems: 'center',
    },
    // Container pour le planning des prestations médicales
    prestationPlanningContainer: {
        marginLeft: 32,
        marginTop: 12,
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: modernColors.primary,
    },
    prestationPlanningTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 12,
    },
});

export default ProductManagerMobile;

