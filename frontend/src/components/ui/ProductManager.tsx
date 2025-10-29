import { Badge } from '@/components/ui/badge';
import BusSeatSelector from '@/components/ui/BusSeatSelector';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MapModal from '@/components/ui/MapModal';
import { useToast } from '@/components/ui/use-toast';
import { Check, Download, Edit2, FileText, MapPin, Plus, Trash2, Upload, Video, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

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
    '🆕 Autre'
];

// Types de transmission
const TYPES_TRANSMISSION = ['Manuelle', 'Automatique', 'Semi-automatique', 'CVT', '🆕 Autre'];

// Types de carburant
const TYPES_CARBURANT = ['Essence', 'Diesel', 'Hybride', 'Électrique', 'GPL', 'Bioéthanol', '🆕 Autre'];

// États du véhicule
const ETATS_VEHICULE = ['Neuf', 'Occasion - Excellent état', 'Occasion - Bon état', 'Occasion - État moyen', 'À réparer'];

// Types immobiliers
const TYPES_IMMOBILIERS = [
    'Appartement', 'Villa', 'Studio', 'Duplex', 'Triplex',
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

type ProductType =
    | 'immobilier_batiment'
    | 'immobilier_terrain'
    | 'hotellerie' // ✅ Hôtels, Chambres d'hôtes, Auberges
    | 'automobile'
    | 'ticket_voyage'
    | 'covoiturage' // ✅ NOUVEAU
    | 'vetement' // ✅ NOUVEAU
    | 'chaussure' // ✅ NOUVEAU
    | 'electromenager'
    | 'image_son' // ✅ NOUVEAU : TV, Audio, Vidéo
    | 'telephone'
    | 'ordinateur'
    | 'mobilier'
    | 'decoration'
    | 'ustensiles_cuisine' // ✅ NOUVEAU
    | 'pieces_auto' // ✅ NOUVEAU
    | 'pieces_industrielles' // ✅ NOUVEAU
    | 'jouets_enfants' // ✅ NOUVEAU
    | 'aliments'
    | 'agriculture_elevage' // ✅ NOUVEAU : Agriculture & Élevage
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
    name: string;
    price: string;
    currency: string;
    description?: string;
    images: string[];
    videos: string[];
    logo?: string; // Logo du produit/marque
    banner?: string; // Bannière promotionnelle
    prestations?: Array<{ // Pour prestations de service
        nom: string;
        prixAPartirDe: string;
        description?: string;
    }>;

    // ✅ Promotion (pour tous les types de produits)
    promotionActive?: boolean;
    promotionType?: 'reduction' | 'offre' | 'bon_plan' | 'flash';
    promotionValeur?: string; // ex: "20%", "-5000 FCFA", "1+1 gratuit"
    promotionDescription?: string;
    promotionDateFin?: string;
    promotionConditions?: string;

    // Champs immobilier
    superficie?: string;
    nbChambres?: string;
    nbSallesBain?: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gpsImmobilier?: string;

    // Champs automobile
    marque?: string;
    modele?: string;
    annee?: string;
    kilometrage?: string;
    couleur?: string;
    typeCarburant?: string;
    transmission?: string;

    // Champs coiffure_beaute
    typeCoiffure?: string;
    longueurMech?: string;
    couleurMech?: string;
    textureMech?: string;
    typePose?: string;
    marqueCoiffure?: string;
    origineMech?: string;
    entretienMech?: string;
    dureeVie?: string;
    typeCheveux?: string;

    // Champs autres types (simplifié pour le frontend)
    [key: string]: any;
}

interface ProductManagerProps {
    products: Product[];
    onProductsChange: (products: Product[]) => void;
    readonly?: boolean;
    titreService?: string;
    descriptionService?: string;
}

const PRODUCT_TYPES = [
    { value: 'agriculture_elevage', label: 'Agriculture & Élevage', icon: '🌾', description: 'Produits agricoles, animaux d\'élevage, semences, intrants, matériel agricole' },
    { value: 'aliments', label: 'Aliments et Produits Frais', icon: '🍎', description: 'Fruits, légumes, viandes, poissons, produits frais et secs' },
    { value: 'automobile', label: 'Automobiles et Véhicules', icon: '🚗', description: 'Voitures, motos, camions, véhicules utilitaires' },
    { value: 'chaussure', label: 'Chaussures et Accessoires', icon: '👟', description: 'Chaussures, baskets, sandales, bottes' },
    { value: 'covoiturage', label: 'Covoiturage et Trajets', icon: '🚙', description: 'Trajets partagés, carpooling, transport collectif' },
    { value: 'decoration', label: 'Décoration Intérieure', icon: '🖼️', description: 'Tableaux, luminaires, tapis, accessoires déco' },
    { value: 'electromenager', label: 'Électroménager Domestique', icon: '🔌', description: 'Frigos, fours, machines à laver, micro-ondes' },
    { value: 'hopital_clinique', label: 'Établissements de Santé', icon: '🏥', description: 'Hôpitaux, cliniques, centres médicaux, spécialités' },
    { value: 'hotellerie', label: 'Hôtellerie et Hébergement', icon: '🏨', description: 'Hôtels, chambres d\'hôtes, auberges, gîtes, réservations' },
    { value: 'image_son', label: 'Image et Son', icon: '📺', description: 'TV, home cinéma, enceintes, projecteurs, systèmes audio' },
    { value: 'immobilier_batiment', label: 'Immobilier - Vente/Location', icon: '🏢', description: 'Appartements, villas, maisons à vendre ou louer (long terme)' },
    { value: 'immobilier_terrain', label: 'Immobilier - Terrains', icon: '🏞️', description: 'Terrains constructibles, parcelles, lots' },
    { value: 'livres_fournitures', label: 'Livres et Fournitures Scolaires', icon: '📚', description: 'Manuels, livres, cahiers, stylos, fournitures' },
    { value: 'mobilier', label: 'Mobilier et Ameublement', icon: '🪑', description: 'Meubles salon, chambre, bureau, rangement' },
    { value: 'ordinateur', label: 'Ordinateurs et Informatique', icon: '💻', description: 'PC portables, bureaux, tablettes, accessoires' },
    { value: 'pharmacie', label: 'Pharmacies et Gardes', icon: '💊', description: 'Pharmacies, planning de garde, services pharmaceutiques' },
    { value: 'prestation_service', label: 'Prestation de Service', icon: '🎯', description: 'Plombier, électricien, mécanicien, coiffeur, développeur...', keywords: ['plombier', 'électricien', 'mécanicien', 'menuisier', 'peintre', 'maçon', 'carreleur', 'soudeur', 'serrurier', 'vitrier', 'plâtrier', 'couvreur', 'charpentier', 'ébéniste', 'tapissier', 'décorateur', 'jardinier', 'paysagiste', 'élagueur', 'coiffeur', 'barbier', 'esthéticienne', 'manucure', 'massage', 'spa', 'kinésithérapeute', 'ostéopathe', 'infirmier', 'sage-femme', 'aide-soignant', 'auxiliaire', 'photographe', 'vidéaste', 'graphiste', 'designer', 'développeur', 'programmeur', 'webmaster', 'informaticien', 'technicien', 'réparateur', 'dépanneur', 'installateur', 'monteur', 'agent', 'nettoyage', 'entretien', 'ménage', 'repassage', 'cuisinier', 'traiteur', 'pâtissier', 'boulanger', 'serveur', 'barman', 'chauffeur', 'livreur', 'coursier', 'déménageur', 'manutentionnaire', 'gardien', 'vigile', 'agent de sécurité', 'coach', 'formateur', 'professeur', 'enseignant', 'répétiteur', 'tuteur', 'traducteur', 'interprète', 'rédacteur', 'correcteur', 'secrétaire', 'assistant', 'comptable', 'auditeur', 'consultant', 'conseiller', 'expert', 'avocat', 'juriste', 'notaire', 'huissier', 'architecte', 'ingénieur', 'géomètre', 'topographe', 'vétérinaire', 'dresseur', 'toiletteur', 'DJ', 'musicien', 'animateur', 'présentateur', 'artiste', 'comédien', 'danseur', 'maquilleur', 'styliste', 'couturier', 'tailleur', 'cordonnier', 'tapissier', 'sellier', 'bijoutier', 'horloger', 'opticien', 'prothésiste', 'dentiste', 'orthodontiste', 'pédicure', 'podologue', 'sophrologue', 'psychologue', 'psychiatre', 'nutritionniste', 'diététicien', 'coach sportif', 'personal trainer', 'yoga', 'pilates', 'danse', 'sport', 'guide', 'accompagnateur', 'moniteur', 'instructeur', 'analyste', 'data scientist', 'statisticien', 'économiste', 'chercheur', 'scientifique', 'laborantin', 'pharmacien', 'préparateur', 'radiologiste', 'échographiste', 'technicien médical', 'ambulancier', 'secouriste', 'pompier', 'agent immobilier', 'promoteur', 'syndic', 'gestionnaire', 'administrateur', 'directeur', 'manager', 'chef de projet', 'coordinateur', 'superviseur', 'contrôleur', 'inspecteur', 'évaluateur', 'expert-comptable', 'fiscaliste', 'commissaire aux comptes', 'assureur', 'courtier', 'agent général', 'banquier', 'conseiller financier', 'trader', 'cambiste', 'caissier', 'guichetier', 'vendeur', 'commercial', 'télévendeur', 'VRP', 'représentant', 'agent commercial', 'négociateur', 'acheteur', 'approvisionneur', 'logisticien', 'magasinier', 'gestionnaire de stock', 'préparateur de commandes', 'cariste', 'grutier', 'conducteur', 'opérateur', 'machiniste', 'usineur', 'tourneur', 'fraiseur', 'ajusteur', 'monteur', 'assembleur', 'câbleur', 'électronicien', 'automaticien', 'roboticien', 'mécanicien auto', 'mécanicien moto', 'carrossier', 'peintre auto', 'tôlier', 'mécanicien poids lourds', 'mécanicien agricole', 'dépanneur auto', 'garagiste', 'vulcanisateur', 'climaticien', 'frigoriste', 'chauffagiste', 'sanitaire', 'zingueur'] },
    { value: 'quincaillerie', label: 'Quincaillerie, Sanitaire & Électricité', icon: '🔨', description: 'Outils, matériaux, plomberie, électricité, construction', keywords: ['quincaillerie', 'outil', 'marteau', 'tournevis', 'clé', 'pince', 'scie', 'perceuse', 'visseuse', 'meuleuse', 'ponceuse', 'raboteuse', 'tronçonneuse', 'matériaux', 'ciment', 'sable', 'gravier', 'brique', 'parpaing', 'fer', 'acier', 'béton', 'mortier', 'chaux', 'plâtre', 'peinture', 'vernis', 'colle', 'mastic', 'silicone', 'joint', 'sanitaire', 'plomberie', 'robinet', 'robinetterie', 'mitigeur', 'mélangeur', 'douche', 'baignoire', 'lavabo', 'évier', 'WC', 'toilette', 'chasse', 'tuyau', 'canalisation', 'raccord', 'coude', 'té', 'vanne', 'électricité', 'électrique', 'câble', 'fil', 'interrupteur', 'prise', 'disjoncteur', 'tableau', 'lampe', 'ampoule', 'LED', 'néon', 'spot', 'applique', 'lustre', 'plafonnier', 'variateur', 'minuterie', 'détecteur', 'sonnette', 'multiprise', 'rallonge', 'domino', 'gaine', 'conduit'] },
    { value: 'telephone', label: 'Téléphones et Accessoires', icon: '📱', description: 'Smartphones, accessoires, coques, écouteurs' },
    { value: 'demenagement', label: 'Déménagement et Transport', icon: '🚚', description: 'Services de déménagement, transport de meubles, garde-meuble' },
    { value: 'cosmetique_parfum', label: 'Cosmétique et Parfums', icon: '✨', description: 'Parfums, huiles de beauté, produits cosmétiques, soins' },
    { value: 'bijoux', label: 'Bijoux et Accessoires', icon: '💎', description: 'Bagues, colliers, bracelets, montres, accessoires précieux' },
    { value: 'coiffure_beaute', label: 'Coiffure et Beauté', icon: '💇‍♀️', description: 'Mèches, extensions, perruques, tissages, accessoires capillaires' },
    { value: 'ticket_voyage', label: 'Tickets et Billets de Transport', icon: '🎫', description: 'Bus, train, avion avec sélection de place' },
    { value: 'ustensiles_cuisine', label: 'Ustensiles de Cuisine', icon: '🍴', description: 'Casseroles, poêles, couteaux, mixers, batterie cuisine' },
    { value: 'vetement', label: 'Vêtements et Prêt-à-Porter', icon: '👕', description: 'Vêtements, habits, articles de mode' },
    { value: 'pieces_auto', label: 'Pièces Détachées Automobile', icon: '🔧', description: 'Pièces de rechange, accessoires auto, pneumatiques' },
    { value: 'pieces_industrielles', label: 'Pièces Détachées Industrielles', icon: '⚙️', description: 'Roulements, courroies, moteurs, pompes industrielles' },
    { value: 'jouets_enfants', label: 'Jouets et Articles Enfants', icon: '🧸', description: 'Jouets, peluches, jeux éducatifs, articles pour enfants' },
    { value: 'assurance', label: 'Assurances et Produits Financiers', icon: '🛡️', description: 'Assurances vie, auto, santé, habitation, produits financiers' },
    { value: 'autre', label: 'Autres Produits', icon: '📦', description: 'Autres types de produits et services' },
] as const;

const CURRENCIES = [
    { code: 'XAF', name: 'Franc CFA (XAF)', symbol: 'FCFA' },
    { code: 'EUR', name: 'Euro (EUR)', symbol: '€' },
    { code: 'USD', name: 'Dollar US (USD)', symbol: '$' },
]; // ✅ Devises principales seulement

// Modèles Excel par type
const EXCEL_TEMPLATES: { [key: string]: string } = {
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
Assurance vie temporaire,120000,USD,Assurance décès avec capital garanti,Vie,Temporaire décès,NSIA Assurances,Capital décès 50M|Invalidité permanente,120000,0,5 ans,Capital décès|Rente conjoint|Protection famille`,

    aliments: `Nom,Prix,Devise,Description,Catégorie,Origine,Date expiration,Poids/Quantité,Conservation,Certification
Tomates fraîches,500,XAF,Tomates rouges mûres et juteuses du terroir,Légumes,Locale,2024-02-01,1kg,Frais,Bio
Poulet fermier,3500,XAF,Poulet élevé en plein air nourri au grain,Viande,Locale,2024-01-25,1.5kg,Frais,Halal
Fromage Emmental,8,EUR,Fromage suisse qualité AOP,Produits laitiers,Importée,2024-03-15,500g,Frais,AOC`,

    livres_fournitures: `Nom,Prix,Devise,Description,Catégorie,Niveau,Matière,Auteur,Éditeur,ISBN,Année édition,État
Mathématiques Terminale C,8500,XAF,Manuel complet avec exercices corrigés,Livre scolaire,Secondaire,Mathématiques,CIAM,Edicef,978-2-7531-0584-3,2023,Neuf
Roman Le Vieux Nègre,6,EUR,Roman classique littérature africaine,Roman,Tous,Français,Ferdinand Oyono,Pocket,978-2-266-14563-2,2006,Bon état`,

    quincaillerie: `Nom,Prix,Devise,Description,Catégorie,Marque,Référence,Unité,Stock disponible
Marteau menuisier,5000,XAF,Marteau professionnel manche bois robuste,Outils,Stanley,STHT0-51309,Pièce,50
Peinture blanche 25L,35000,XAF,Peinture acrylique mat lessivable,Peinture,Dulux,25L-BL-MAT,Seau,20
Câble électrique 2.5mm,8500,XAF,Câble pour installation électrique,Électricité,Nexans,H07V-U,m,500`,

    prestation_service: `Nom,Prix,Devise
Portfolio Réalisation 1,0,XAF
Portfolio Réalisation 2,0,XAF`,

    coiffure_beaute: `Nom,Prix,Devise,Description,Type,Longueur,Couleur,Texture,Pose,Marque,Origine,Entretien,Durée,Type cheveux
Mèches Brésiliennes 30cm,15000,XAF,Mèches naturelles de qualité supérieure,Extensions,30cm,Noir naturel,Lisse,Clip,Brazilian Hair,Brésilien,Shampoing doux,6-12 mois,100% Naturel
Perruque Afro 40cm,25000,XAF,Perruque afro texture naturelle,Perruque,40cm,Châtain,Afro,Lace,Virgin Hair,Péruvien,Séchage naturel,1-2 ans,Remy Hair
Tissage Indien 50cm,20000,XAF,Tissage indien remy de qualité,Tissage,50cm,Blond,Crépu,Tissage,Indian Hair,Indien,Éviter chaleur,3-6 mois,Virgin Hair`,

    autre: `Nom,Prix,Devise,Description
Produit divers,10000,XAF,Description détaillée du produit
Article standard,50,USD,Description complète de l'article`,

    covoiturage: `Nom,Prix,Devise,Description,Départ,Arrivée,Date,Heure,Places disponibles
Trajet Douala-Yaoundé,2500,XAF,Voiture confortable et sécurisée avec climatisation,Bonanjo,Centre-ville Yaoundé,2024-01-15,06:00,3
Trajet Yaoundé-Bafoussam,3500,XAF,SUV climatisé spacieux avec bagages,Yaoundé,Bafoussam,2024-01-16,10:00,4`,

    vetement: `Nom,Prix,Devise,Description,Taille,Couleur,Matière,Marque
T-shirt casual,5000,XAF,T-shirt confortable pour usage quotidien,L,Bleu,Coton,Nike
Robe élégante,25000,XAF,Robe de soirée élégante et raffinée,M,Rouge,Soie,Zara`,

    chaussure: `Nom,Prix,Devise,Description,Pointure,Couleur,Marque
Baskets sport,35000,XAF,Chaussures de running haute performance,42,Noire,Adidas
Sandales,15000,XAF,Sandales d'été confortables et légères,38,Marron,Clarks`,

    image_son: `Nom,Prix,Devise,Description,Marque,Modèle,Type,État
TV Samsung 55 pouces,350000,XAF,Smart TV 4K HDR apps intégrées,Samsung,QE55Q80B,TV,Neuf
Home Cinéma Sony,180000,XAF,Système 5.1 Bluetooth Dolby Atmos,Sony,HT-S40R,Home cinéma,Neuf`,

    pieces_auto: `Nom,Prix,Devise,Description,Type,Marque,Référence,État
Pneu Michelin 205/55 R16,45000,XAF,Pneu toutes saisons excellent grip,Pneumatiques,Michelin,205/55R16 91V,Neuf
Batterie Varta 12V 60Ah,35000,XAF,Batterie démarrage forte puissance,Batterie,Varta,D59,Neuf`,

    pieces_industrielles: `Nom,Prix,Devise,Description,Type,Marque,Référence,Matériel
Roulement SKF 6205,8500,XAF,Roulement à billes étanche haute vitesse,Roulement,SKF,6205-2RS,Acier
Moteur électrique 5.5kW,285000,XAF,Moteur asynchrone triphasé rendement,Moteur,ABB,M2QA 132M,Fonte/Cuivre`,

    jouets_enfants: `Nom,Prix,Devise,Description,Type,Âge recommandé,Marque
Puzzle éducatif 100 pièces,3500,XAF,Puzzle animaux Afrique éducatif,Éducatif,6-10 ans,Ravensburger
Peluche lion,8500,XAF,Peluche douce lavable hypoallergénique,Peluche,0-3 ans,Jellycat`,

    hotellerie: `Nom,Prix par nuit,Devise,Description,Catégorie,Type,Services,Adresse
Hôtel Les Cocotiers,45000,XAF,Hôtel 4 étoiles centre-ville vue mer,4 étoiles,Hôtel,Petit-déjeuner|Piscine|Wi-Fi,Avenue Kennedy Douala
Chambres d'hôtes Villa,25000,XAF,Chambre d'hôtes familiale calme,Sans étoile,Chambre d'hôte,Petit-déjeuner|Wi-Fi,Bonapriso Douala`
};

const ProductManager: React.FC<ProductManagerProps> = ({
    products,
    onProductsChange,
    readonly = false,
    titreService,
    descriptionService
}) => {
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [selectedType, setSelectedType] = useState<ProductType>('autre');
    const [currentStep, setCurrentStep] = useState<'type' | 'form'>('type');
    const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState(''); // Recherche textuelle pour types
    const [showSeatSelector, setShowSeatSelector] = useState(false);
    const [selectedGPSLocation, setSelectedGPSLocation] = useState<{ lat: number; lng: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleAddProduct = () => {
        setCurrentStep('type');
        setSelectedType('autre');
        const newProduct: Product = {
            id: Date.now().toString(),
            type: 'autre',
            name: '',
            price: '',
            currency: 'XAF',
            description: '',
            images: [],
            videos: []
        };
        setEditingProduct(newProduct);
    };

    const handleSelectType = (type: ProductType) => {
        setSelectedType(type);

        // ✅ Pour Prestation de Service : Pré-remplir automatiquement titre et description
        if (type === 'prestation_service') {
            setEditingProduct(prev => prev ? {
                ...prev,
                type,
                name: titreService || 'Réalisation',
                description: descriptionService || ''
            } : null);
        } else {
            setEditingProduct(prev => prev ? { ...prev, type } : null);
        }

        setCurrentStep('form');
    };

    const downloadExcelTemplate = (type: ProductType) => {
        const template = EXCEL_TEMPLATES[type] || EXCEL_TEMPLATES['autre'];
        const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `modele_${type}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: "Modèle téléchargé",
            description: `Le modèle Excel pour ${PRODUCT_TYPES.find(t => t.value === type)?.label} a été téléchargé`,
        });
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct({ ...product });
        setSelectedType(product.type);
        setCurrentStep('form');
    };

    const handleDeleteProduct = (productId: string) => {
        onProductsChange(products.filter(p => p.id !== productId));
        toast({
            title: "Produit supprimé",
            description: "Le produit a été supprimé avec succès.",
        });
    };

    const handleSaveProduct = () => {
        if (!editingProduct?.name.trim() || !editingProduct?.price.trim()) {
            toast({
                title: "Erreur",
                description: "Veuillez remplir le nom et le prix du produit",
            });
            return;
        }

        const existingIndex = products.findIndex(p => p.id === editingProduct.id);
        if (existingIndex >= 0) {
            const updatedProducts = products.map((p, index) =>
                index === existingIndex ? editingProduct : p
            );
            onProductsChange(updatedProducts);
        } else {
            onProductsChange([...products, editingProduct]);
        }

        setEditingProduct(null);
        toast({
            title: "Produit enregistré",
            description: "Le produit a été enregistré avec succès.",
        });
    };

    const handleFileUpload = (files: FileList, type: 'images' | 'videos') => {
        if (!editingProduct) return;

        // ✅ CORRECTION: Augmentation des limites
        const currentCount = editingProduct[type]?.length || 0;
        const maxImages = 10; // Max 10 images par produit (augmenté de 5)
        const maxVideos = 3; // Max 3 vidéos par produit (augmenté de 1)
        const maxItems = type === 'images' ? maxImages : maxVideos;

        if (currentCount >= maxItems) {
            toast({
                title: "Limite atteinte",
                description: `Maximum ${maxItems} ${type === 'images' ? 'images' : 'vidéos'} par produit`,
            });
            return;
        }

        const fileArray = Array.from(files);
        const validFiles = fileArray.filter(file => {
            if (type === 'images') {
                return file.type.startsWith('image/');
            } else {
                return file.type.startsWith('video/');
            }
        }).slice(0, maxItems - currentCount); // ✅ Limiter au nombre disponible

        if (validFiles.length === 0) {
            toast({
                title: "Erreur",
                description: `Aucun fichier ${type === 'images' ? 'image' : 'vidéo'} valide sélectionné`,
            });
            return;
        }

        // ✅ Vérifier la taille des fichiers (images max 2MB, vidéos max 20MB)
        const maxSizeMB = type === 'images' ? 2 : 20;
        const oversizedFiles = validFiles.filter(file => file.size > maxSizeMB * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            toast({
                title: "Fichiers trop volumineux",
                description: `Certains fichiers dépassent ${maxSizeMB} MB. Veuillez compresser vos ${type === 'images' ? 'images' : 'vidéos'}.`,
            });
            return;
        }

        // Convertir les fichiers en base64
        const processFiles = async () => {
            const base64Files: string[] = [];

            for (const file of validFiles) {
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
                base64Files.push(base64);
            }

            setEditingProduct(prev => ({
                ...prev!,
                [type]: [...(prev![type] || []), ...base64Files]
            }));

            toast({
                title: `${type === 'images' ? 'Images' : 'Vidéo'} ajoutée(s)`,
                description: `${validFiles.length} fichier(s) ajouté(s). Maximum ${maxItems} par produit.`,
            });
        };

        processFiles();
    };

    const removeMedia = (type: 'images' | 'videos', index: number) => {
        if (!editingProduct) return;

        setEditingProduct(prev => ({
            ...prev!,
            [type]: prev![type].filter((_, i) => i !== index)
        }));
    };

    const formatPrice = (price: string, currency: string) => {
        const currencyInfo = CURRENCIES.find(c => c.code === currency);
        const symbol = currencyInfo?.symbol || currency;
        return `${price} ${symbol}`;
    };

    return (
        <div className="space-y-4">
            {/* En-tête */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">🛍️ Produits</h3>
                        <p className="text-sm text-gray-600">Gérez les produits de votre service</p>
                    </div>
                </div>
                {!readonly && (
                    <Button
                        onClick={handleAddProduct}
                        size="default"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        <span className="text-white">Ajouter un produit</span>
                    </Button>
                )}
            </div>

            {/* Liste des produits */}
            {products.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-300">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Plus className="w-6 h-6 text-gray-400" />
                        </div>
                        <h4 className="text-lg font-medium text-gray-900 mb-2">Aucun produit</h4>
                        <p className="text-sm text-gray-600 text-center">
                            Ajoutez des produits pour enrichir votre service
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {products.map((product) => {
                        const typeInfo = PRODUCT_TYPES.find(t => t.value === product.type);
                        return (
                            <Card key={product.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-500 mb-1">
                                                {typeInfo?.icon} {typeInfo?.label}
                                            </div>
                                            <h4 className="font-semibold text-gray-900">{product.name}</h4>
                                            <p className="text-sm text-blue-600 font-medium">
                                                {formatPrice(product.price, product.currency)}
                                            </p>
                                            {product.description && (
                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                                            )}
                                            <div className="flex items-center gap-4 mt-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    📷 {product.images.length} image(s)
                                                </Badge>
                                                <Badge variant="secondary" className="text-xs">
                                                    🎥 {product.videos.length} vidéo(s)
                                                </Badge>
                                            </div>
                                        </div>
                                        {!readonly && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEditProduct(product)}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDeleteProduct(product.id)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal d'édition de produit */}
            {editingProduct && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <Card className="w-full max-w-2xl my-8">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                {editingProduct.id ? 'Modifier le produit' : 'Nouveau produit'}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setEditingProduct(null);
                                        setCurrentStep('type');
                                    }}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 max-h-[75vh] overflow-y-auto">
                            {/* Étape 1: Sélection du type */}
                            {currentStep === 'type' && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">✨ Sélectionnez le type de produit <span className="text-red-600">*</span></h3>
                                    <p className="text-sm text-gray-600">Choisissez la catégorie qui correspond le mieux à votre produit</p>

                                    {/* 🔍 Champ de recherche intelligente */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <div className="flex items-start gap-2 mb-2">
                                            <span className="text-lg">💡</span>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-blue-900">Recherche intelligente</p>
                                                <p className="text-xs text-blue-700">Tapez le nom de votre produit ou service pour une suggestion automatique</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Champ de recherche textuelle */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="🔍 Rechercher une catégorie..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {(() => {
                                            // Filtrer les catégories selon la recherche
                                            let filteredTypes = PRODUCT_TYPES.filter(type => {
                                                if (searchQuery.length === 0) return true;
                                                // ✅ Recherche sans sensibilité aux accents
                                                const normalizedQuery = normalizeText(searchQuery);
                                                return normalizeText(type.label).includes(normalizedQuery) ||
                                                    normalizeText(type.description).includes(normalizedQuery) ||
                                                    ((type as any).keywords && (type as any).keywords.some((kw: string) => normalizeText(kw).includes(normalizedQuery)));
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
                                                        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                                                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                            </svg>
                                                            <span>Aucune catégorie ne correspond. Nous vous proposons "Prestation de service" par défaut.</span>
                                                        </div>
                                                    )}
                                                    {filteredTypes.map((type) => (
                                                        <button
                                                            key={type.value}
                                                            onClick={() => handleSelectType(type.value as ProductType)}
                                                            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${selectedType === type.value
                                                                ? 'border-blue-500 bg-blue-50'
                                                                : 'border-gray-200 hover:border-gray-300'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3 flex-1">
                                                                    <span className="text-2xl">{type.icon}</span>
                                                                    <div className="flex-1">
                                                                        <div className="font-semibold text-gray-900">{type.label}</div>
                                                                        <div className="text-sm text-gray-600">{type.description}</div>
                                                                    </div>
                                                                </div>
                                                                {selectedType === type.value && (
                                                                    <Check className="w-5 h-5 text-blue-600" />
                                                                )}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Étape 2: Formulaire */}
                            {currentStep === 'form' && (
                                <div className="space-y-6">
                                    {/* Badge du type sélectionné */}
                                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{PRODUCT_TYPES.find(t => t.value === selectedType)?.icon}</span>
                                            <span className="font-semibold text-blue-900">
                                                {PRODUCT_TYPES.find(t => t.value === selectedType)?.label}
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentStep('type')}
                                        >
                                            Changer
                                        </Button>
                                    </div>

                                    {/* Boutons Excel */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => downloadExcelTemplate(selectedType)}
                                            className="w-full"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Télécharger modèle Excel
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = '.csv,.xlsx';
                                                input.onchange = (e) => {
                                                    const files = (e.target as HTMLInputElement).files;
                                                    if (files) {
                                                        toast({
                                                            title: "Import Excel",
                                                            description: "Fonctionnalité d'import en cours de développement",
                                                        });
                                                    }
                                                };
                                                input.click();
                                            }}
                                            className="w-full"
                                        >
                                            <FileText className="w-4 h-4 mr-2" />
                                            Importer Excel
                                        </Button>
                                    </div>

                                    <div className="text-center text-sm text-gray-500">
                                        ou remplir manuellement
                                    </div>

                                    {/* Informations de base - Cachées pour Prestation de Service */}
                                    {selectedType !== 'prestation_service' && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <Label htmlFor="product-name">Nom du produit *</Label>
                                                    <Input
                                                        id="product-name"
                                                        value={editingProduct.name}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            name: e.target.value
                                                        }))}
                                                        placeholder={selectedType === 'immobilier_batiment' ? 'Ex: Appartement F4' :
                                                            selectedType === 'automobile' ? 'Ex: Toyota Corolla 2018' :
                                                                selectedType === 'electromenager' ? 'Ex: Réfrigérateur Samsung' :
                                                                    selectedType === 'assurance' ? 'Ex: Assurance auto tous risques' :
                                                                        selectedType === 'quincaillerie' ? 'Ex: Marteau menuisier' :
                                                                            'Ex: Nom du produit'}
                                                    />
                                                </div>
                                                {/* Prix - MASQUÉ pour pharmacie et hopital_clinique */}
                                                {selectedType !== 'pharmacie' && selectedType !== 'hopital_clinique' && (
                                                    <div>
                                                        <Label htmlFor="product-price">
                                                            {selectedType === 'assurance' ? 'Prime (à partir de)' : 'Prix'} *
                                                        </Label>
                                                        <Input
                                                            id="product-price"
                                                            type="number"
                                                            value={editingProduct.price}
                                                            onChange={(e) => setEditingProduct(prev => ({
                                                                ...prev!,
                                                                price: e.target.value
                                                            }))}
                                                            placeholder={selectedType === 'assurance' ? 'Prime mensuelle/annuelle' : '0'}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Description */}
                                            <div>
                                                <Label htmlFor="product-description">Description</Label>
                                                <textarea
                                                    id="product-description"
                                                    value={editingProduct.description || ''}
                                                    onChange={(e) => setEditingProduct(prev => ({
                                                        ...prev!,
                                                        description: e.target.value
                                                    }))}
                                                    placeholder="Décrivez ce produit..."
                                                    className="w-full p-2 border border-gray-300 rounded-md min-h-[80px]"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Prix pour Prestation de Service (optionnel) */}
                                    {selectedType === 'prestation_service' && (
                                        <div>
                                            <Label htmlFor="product-price">Prix de cette réalisation (optionnel)</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="product-price"
                                                    type="number"
                                                    value={editingProduct.price}
                                                    onChange={(e) => setEditingProduct(prev => ({
                                                        ...prev!,
                                                        price: e.target.value
                                                    }))}
                                                    placeholder="0"
                                                    className="flex-1"
                                                />
                                                <select
                                                    value={editingProduct.currency}
                                                    onChange={(e) => setEditingProduct(prev => ({
                                                        ...prev!,
                                                        currency: e.target.value
                                                    }))}
                                                    className="px-3 py-2 border border-gray-300 rounded-md"
                                                >
                                                    {CURRENCIES.map(c => (
                                                        <option key={c.code} value={c.code}>{c.code}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                💡 Le titre et la description sont automatiquement repris du service principal
                                            </p>
                                        </div>
                                    )}

                                    {/* Champs spécifiques selon le type */}
                                    {selectedType === 'immobilier_batiment' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">Caractéristiques du bien</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <Label>Superficie (m²)</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingProduct.superficie || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            superficie: e.target.value
                                                        }))}
                                                        placeholder="120"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Chambres</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingProduct.nbChambres || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            nbChambres: e.target.value
                                                        }))}
                                                        placeholder="4"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Salles de bain</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingProduct.nbSallesBain || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            nbSallesBain: e.target.value
                                                        }))}
                                                        placeholder="2"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <Label>Quartier</Label>
                                                    <Input
                                                        value={editingProduct.quartier || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            quartier: e.target.value
                                                        }))}
                                                        placeholder="Bonanjo"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Ville</Label>
                                                    <Input
                                                        value={editingProduct.ville || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            ville: e.target.value
                                                        }))}
                                                        placeholder="Douala"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <Label>📍 Localisation GPS</Label>
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => setShowGPSModal(true)}
                                                >
                                                    <MapPin className="w-4 h-4 mr-2" />
                                                    {editingProduct.gpsImmobilier ? 'Modifier la localisation' : 'Ajouter la localisation GPS'}
                                                </Button>
                                                {editingProduct.gpsImmobilier && (
                                                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                                                        ✓ Position enregistrée
                                                    </div>
                                                )}
                                                <p className="text-xs text-gray-500 mt-1">
                                                    💡 La localisation GPS aide les acheteurs à trouver le bien
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Champs pour Terrain */}
                                    {selectedType === 'immobilier_terrain' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">Caractéristiques du terrain</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <Label>Superficie (m²)</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingProduct.superficie || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            superficie: e.target.value
                                                        }))}
                                                        placeholder="500"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Ville</Label>
                                                    <Input
                                                        value={editingProduct.ville || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            ville: e.target.value
                                                        }))}
                                                        placeholder="Douala"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <Label>📍 Localisation GPS</Label>
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => setShowGPSModal(true)}
                                                >
                                                    <MapPin className="w-4 h-4 mr-2" />
                                                    {editingProduct.gpsImmobilier ? 'Modifier la localisation' : 'Ajouter la localisation GPS'}
                                                </Button>
                                                {editingProduct.gpsImmobilier && (
                                                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                                                        ✓ Position enregistrée
                                                    </div>
                                                )}
                                                <p className="text-xs text-gray-500 mt-1">
                                                    💡 La localisation GPS précise augmente la visibilité du terrain
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Automobile */}
                                    {selectedType === 'automobile' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🚗 Caractéristiques du véhicule</h4>

                                            {/* Marque */}
                                            <div>
                                                <Label>Marque *</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {MARQUES_AUTOMOBILES.slice(0, 12).map((marque) => (
                                                        <button
                                                            key={marque}
                                                            type="button"
                                                            className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${editingProduct.marque === marque
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                                                                }`}
                                                            onClick={() => setEditingProduct(prev => ({ ...prev!, marque }))}
                                                        >
                                                            {marque}
                                                        </button>
                                                    ))}
                                                </div>
                                                <Input
                                                    placeholder="Ou entrez une autre marque..."
                                                    value={!MARQUES_AUTOMOBILES.includes(editingProduct.marque || '') ? editingProduct.marque : ''}
                                                    onChange={(e) => setEditingProduct(prev => ({ ...prev!, marque: e.target.value }))}
                                                    className="mt-2"
                                                />
                                            </div>

                                            {/* Modèle */}
                                            <div>
                                                <Label>Modèle *</Label>
                                                <Input
                                                    placeholder="Ex: Corolla, Civic, Classe E..."
                                                    value={editingProduct.modele || ''}
                                                    onChange={(e) => setEditingProduct(prev => ({ ...prev!, modele: e.target.value }))}
                                                />
                                            </div>

                                            {/* État véhicule */}
                                            <div>
                                                <Label>État du véhicule *</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {ETATS_VEHICULE.map((etat) => (
                                                        <button
                                                            key={etat}
                                                            type="button"
                                                            className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${editingProduct.etatVehicule === etat
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                                                                }`}
                                                            onClick={() => setEditingProduct(prev => ({ ...prev!, etatVehicule: etat }))}
                                                        >
                                                            {etat}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Année et Kilométrage */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label>Année *</Label>
                                                    <Input
                                                        type="number"
                                                        placeholder="Ex: 2018"
                                                        value={editingProduct.annee || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({ ...prev!, annee: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Kilométrage (km)</Label>
                                                    <Input
                                                        type="number"
                                                        placeholder="Ex: 65000"
                                                        value={editingProduct.kilometrage || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({ ...prev!, kilometrage: e.target.value }))}
                                                    />
                                                </div>
                                            </div>

                                            {/* Carburant */}
                                            <div>
                                                <Label>Type de carburant *</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {TYPES_CARBURANT.map((carburant) => (
                                                        <button
                                                            key={carburant}
                                                            type="button"
                                                            className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${editingProduct.typeCarburant === carburant
                                                                ? 'bg-orange-600 text-white border-orange-600'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:border-orange-500'
                                                                }`}
                                                            onClick={() => setEditingProduct(prev => ({ ...prev!, typeCarburant: carburant }))}
                                                        >
                                                            {carburant}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Transmission */}
                                            <div>
                                                <Label>Transmission *</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {TYPES_TRANSMISSION.map((transmission) => (
                                                        <button
                                                            key={transmission}
                                                            type="button"
                                                            className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${editingProduct.transmission === transmission
                                                                ? 'bg-purple-600 text-white border-purple-600'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:border-purple-500'
                                                                }`}
                                                            onClick={() => setEditingProduct(prev => ({ ...prev!, transmission }))}
                                                        >
                                                            {transmission}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Couleur */}
                                            <div>
                                                <Label>Couleur</Label>
                                                <Input
                                                    placeholder="Ex: Blanche, Noire, Grise..."
                                                    value={editingProduct.couleur || ''}
                                                    onChange={(e) => setEditingProduct(prev => ({ ...prev!, couleur: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Ticket de Voyage */}
                                    {selectedType === 'ticket_voyage' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🎫 Informations du billet</h4>

                                            {/* Compagnie */}
                                            <div>
                                                <Label>Compagnie de transport *</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {COMPAGNIES_VOYAGE.slice(0, 8).map((compagnie) => (
                                                        <button
                                                            key={compagnie}
                                                            type="button"
                                                            className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${editingProduct.compagnie === compagnie
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                                                                }`}
                                                            onClick={() => setEditingProduct(prev => ({ ...prev!, compagnie }))}
                                                        >
                                                            {compagnie}
                                                        </button>
                                                    ))}
                                                </div>
                                                <Input
                                                    placeholder="Ou entrez une autre compagnie..."
                                                    value={!COMPAGNIES_VOYAGE.includes(editingProduct.compagnie || '') ? editingProduct.compagnie : ''}
                                                    onChange={(e) => setEditingProduct(prev => ({ ...prev!, compagnie: e.target.value }))}
                                                    className="mt-2"
                                                />
                                            </div>

                                            {/* Type de véhicule */}
                                            <div>
                                                <Label>Type de véhicule *</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {TYPES_VEHICULES_TRANSPORT.map((type) => (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${editingProduct.typeVehiculeTransport === type
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                                                                }`}
                                                            onClick={() => setEditingProduct(prev => ({ ...prev!, typeVehiculeTransport: type }))}
                                                        >
                                                            {type}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Classe de voyage */}
                                            <div>
                                                <Label>Classe *</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {CLASSES_VOYAGE.map((classe) => (
                                                        <button
                                                            key={classe}
                                                            type="button"
                                                            className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${editingProduct.classeVoyage === classe
                                                                ? 'bg-yellow-600 text-white border-yellow-600'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:border-yellow-500'
                                                                }`}
                                                            onClick={() => setEditingProduct(prev => ({ ...prev!, classeVoyage: classe }))}
                                                        >
                                                            {classe}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Départ et Destination */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label>Ville de départ *</Label>
                                                    <Input
                                                        placeholder="Ex: Douala"
                                                        value={editingProduct.depart || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({ ...prev!, depart: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Destination *</Label>
                                                    <Input
                                                        placeholder="Ex: Yaoundé"
                                                        value={editingProduct.destination || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({ ...prev!, destination: e.target.value }))}
                                                    />
                                                </div>
                                            </div>

                                            {/* Date et Heure */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label>Date de départ *</Label>
                                                    <Input
                                                        type="date"
                                                        value={editingProduct.dateDepart || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({ ...prev!, dateDepart: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Heure *</Label>
                                                    <Input
                                                        type="time"
                                                        value={editingProduct.heureDepart || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({ ...prev!, heureDepart: e.target.value }))}
                                                    />
                                                </div>
                                            </div>

                                            {/* Sélection de place avec BusSeatSelector */}
                                            <div>
                                                <Label>Numéro de place</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Ex: A12"
                                                        value={editingProduct.numeroPlace || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({ ...prev!, numeroPlace: e.target.value }))}
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setShowSeatSelector(true)}
                                                        className="flex-shrink-0"
                                                    >
                                                        <MapPin className="w-4 h-4 mr-1" />
                                                        Sélectionner
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    💡 Utilisez le sélecteur pour choisir visuellement une place
                                                </p>
                                            </div>

                                            {/* Nombre de places disponibles */}
                                            <div>
                                                <Label>Places disponibles</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="Ex: 45"
                                                    value={editingProduct.nbPlacesDisponibles || ''}
                                                    onChange={(e) => setEditingProduct(prev => ({ ...prev!, nbPlacesDisponibles: e.target.value }))}
                                                />
                                            </div>

                                            {/* Escales */}
                                            <div>
                                                <Label>Escales (optionnel)</Label>
                                                <textarea
                                                    placeholder="Ex: Bafoussam, Bertoua..."
                                                    value={editingProduct.escales || ''}
                                                    onChange={(e) => setEditingProduct(prev => ({ ...prev!, escales: e.target.value }))}
                                                    className="w-full p-2 border border-gray-300 rounded-md min-h-[60px]"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Hôtellerie */}
                                    {selectedType === 'hotellerie' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🏨 Informations de l'hébergement</h4>

                                            {/* Type */}
                                            <div>
                                                <Label>Type d'hébergement *</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {TYPES_HEBERGEMENT.map((type) => (
                                                        <button key={type} type="button"
                                                            className={`px-3 py-1.5 border rounded-lg text-sm ${editingProduct.typeHebergement === type ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border-gray-300'}`}
                                                            onClick={() => setEditingProduct(prev => ({ ...prev!, typeHebergement: type }))}>
                                                            {type}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Catégorie */}
                                            <div>
                                                <Label>Catégorie *</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {CATEGORIES_HOTEL.map((cat) => (
                                                        <button key={cat} type="button"
                                                            className={`px-3 py-1.5 border rounded-lg text-sm ${editingProduct.categorieHotel === cat ? 'bg-yellow-600 text-white' : 'bg-white text-gray-700 border-gray-300'}`}
                                                            onClick={() => setEditingProduct(prev => ({ ...prev!, categorieHotel: cat }))}>
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Prix par nuit (min) *</Label><Input type="number" placeholder="Ex: 35000" value={editingProduct.prixParNuit || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, prixParNuit: e.target.value }))} /></div>
                                                <div><Label>Nombre de chambres</Label><Input type="number" placeholder="Ex: 25" value={editingProduct.nbChambresHotel || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, nbChambresHotel: e.target.value }))} /></div>
                                            </div>

                                            <div><Label>Adresse *</Label><Input placeholder="Ex: Avenue Kennedy" value={editingProduct.adresseHotel || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, adresseHotel: e.target.value }))} /></div>
                                            <div><Label>Ville *</Label><Input placeholder="Ex: Douala" value={editingProduct.villeHotel || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, villeHotel: e.target.value }))} /></div>
                                        </div>
                                    )}

                                    {/* Formulaire Covoiturage */}
                                    {selectedType === 'covoiturage' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🚙 Informations du trajet</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Point de départ *</Label><Input placeholder="Ex: Bonanjo" value={editingProduct.pointDepart || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, pointDepart: e.target.value }))} /></div>
                                                <div><Label>Point d'arrivée *</Label><Input placeholder="Ex: Yaoundé" value={editingProduct.pointArrivee || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, pointArrivee: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Date *</Label><Input type="date" value={editingProduct.dateTrajet || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, dateTrajet: e.target.value }))} /></div>
                                                <div><Label>Heure *</Label><Input type="time" value={editingProduct.heureTrajet || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, heureTrajet: e.target.value }))} /></div>
                                                <div><Label>Places dispo</Label><Input type="number" placeholder="3" value={editingProduct.nbPlacesDisponibles || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, nbPlacesDisponibles: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Vêtement */}
                                    {selectedType === 'vetement' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">👕 Caractéristiques du vêtement</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Taille</Label><Input placeholder="S, M, L, XL" value={editingProduct.taille || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, taille: e.target.value }))} /></div>
                                                <div><Label>Couleur</Label><Input placeholder="Ex: Bleu" value={editingProduct.couleurVetement || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, couleurVetement: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Matière</Label><Input placeholder="Ex: Coton" value={editingProduct.matiere || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, matiere: e.target.value }))} /></div>
                                                <div><Label>Marque</Label><Input placeholder="Ex: Nike" value={editingProduct.marqueVetement || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueVetement: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Chaussure */}
                                    {selectedType === 'chaussure' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">👟 Caractéristiques de la chaussure</h4>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Pointure</Label><Input type="number" placeholder="42" value={editingProduct.pointure || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, pointure: e.target.value }))} /></div>
                                                <div><Label>Couleur</Label><Input placeholder="Noire" value={editingProduct.couleurChaussure || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, couleurChaussure: e.target.value }))} /></div>
                                                <div><Label>Marque</Label><Input placeholder="Adidas" value={editingProduct.marqueChaussure || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueChaussure: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Électroménager */}
                                    {selectedType === 'electromenager' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🔌 Caractéristiques de l'appareil</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type d'appareil</Label><Input placeholder="Réfrigérateur, Four..." value={editingProduct.typeElectro || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeElectro: e.target.value }))} /></div>
                                                <div><Label>Marque</Label><Input placeholder="Samsung, LG..." value={editingProduct.marqueElectro || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueElectro: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Modèle</Label><Input placeholder="RT50K6000S8" value={editingProduct.modeleElectro || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, modeleElectro: e.target.value }))} /></div>
                                                <div><Label>État</Label><Input placeholder="Neuf, Bon état" value={editingProduct.etat || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, etat: e.target.value }))} /></div>
                                            </div>
                                            <div><Label>Garantie</Label><Input placeholder="2 ans, 1 an..." value={editingProduct.garantie || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, garantie: e.target.value }))} /></div>
                                        </div>
                                    )}

                                    {/* Formulaire Image et Son */}
                                    {selectedType === 'image_son' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">📺 Caractéristiques de l'appareil</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type</Label><Input placeholder="TV, Home cinéma..." value={editingProduct.typeImageSon || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeImageSon: e.target.value }))} /></div>
                                                <div><Label>Marque</Label><Input placeholder="Samsung, Sony..." value={editingProduct.marqueImageSon || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueImageSon: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Modèle</Label><Input placeholder="QE55Q80B" value={editingProduct.modeleImageSon || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, modeleImageSon: e.target.value }))} /></div>
                                                <div><Label>Diagonale</Label><Input placeholder="55 pouces" value={editingProduct.diagonaleEcran || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, diagonaleEcran: e.target.value }))} /></div>
                                                <div><Label>Résolution</Label><Input placeholder="4K, HD..." value={editingProduct.resolution || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, resolution: e.target.value }))} /></div>
                                            </div>
                                            <div><Label>État</Label><Input placeholder="Neuf, Bon état" value={editingProduct.etatImageSon || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, etatImageSon: e.target.value }))} /></div>
                                        </div>
                                    )}

                                    {/* Formulaire Téléphone */}
                                    {selectedType === 'telephone' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">📱 Caractéristiques du téléphone</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Marque</Label><Input placeholder="Apple, Samsung..." value={editingProduct.marqueTelephone || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueTelephone: e.target.value }))} /></div>
                                                <div><Label>Modèle</Label><Input placeholder="iPhone 13 Pro" value={editingProduct.modeleTelephone || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, modeleTelephone: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Stockage</Label><Input placeholder="256GB" value={editingProduct.stockage || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, stockage: e.target.value }))} /></div>
                                                <div><Label>RAM</Label><Input placeholder="6GB" value={editingProduct.ram || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, ram: e.target.value }))} /></div>
                                                <div><Label>Couleur</Label><Input placeholder="Graphite" value={editingProduct.couleurTelephone || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, couleurTelephone: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>État</Label><Input placeholder="Neuf, Bon état" value={editingProduct.etatTelephone || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, etatTelephone: e.target.value }))} /></div>
                                                <div><Label>Opérateur</Label><Input placeholder="Débloqué, Orange..." value={editingProduct.operateur || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, operateur: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Ordinateur */}
                                    {selectedType === 'ordinateur' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">💻 Caractéristiques de l'ordinateur</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type</Label><Input placeholder="Portable, Bureau..." value={editingProduct.typeOrdinateur || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeOrdinateur: e.target.value }))} /></div>
                                                <div><Label>Marque</Label><Input placeholder="Apple, Dell..." value={editingProduct.marqueOrdinateur || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueOrdinateur: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Modèle</Label><Input placeholder="MacBook Pro 14" value={editingProduct.modeleOrdinateur || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, modeleOrdinateur: e.target.value }))} /></div>
                                                <div><Label>Processeur</Label><Input placeholder="M2 Pro, i7..." value={editingProduct.processeur || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, processeur: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>RAM</Label><Input placeholder="16GB" value={editingProduct.ramOrdinateur || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, ramOrdinateur: e.target.value }))} /></div>
                                                <div><Label>Stockage</Label><Input placeholder="512GB SSD" value={editingProduct.stockageOrdinateur || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, stockageOrdinateur: e.target.value }))} /></div>
                                                <div><Label>Carte graphique</Label><Input placeholder="Intégrée, RTX..." value={editingProduct.carteGraphique || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, carteGraphique: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>OS</Label><Input placeholder="macOS, Windows..." value={editingProduct.systemeExploitation || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, systemeExploitation: e.target.value }))} /></div>
                                                <div><Label>État</Label><Input placeholder="Neuf, Bon état" value={editingProduct.etatOrdinateur || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, etatOrdinateur: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Mobilier */}
                                    {selectedType === 'mobilier' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🪑 Caractéristiques du meuble</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type de meuble</Label><Input placeholder="Canapé, Table..." value={editingProduct.typeMobilier || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeMobilier: e.target.value }))} /></div>
                                                <div><Label>Matériau</Label><Input placeholder="Bois, Métal..." value={editingProduct.materiau || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, materiau: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Dimensions</Label><Input placeholder="LxPxH en cm" value={editingProduct.dimensions || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, dimensions: e.target.value }))} /></div>
                                                <div><Label>Couleur</Label><Input placeholder="Gris, Marron..." value={editingProduct.couleurMobilier || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, couleurMobilier: e.target.value }))} /></div>
                                                <div><Label>État</Label><Input placeholder="Neuf, Bon état" value={editingProduct.etatMobilier || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, etatMobilier: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Décoration */}
                                    {selectedType === 'decoration' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🖼️ Caractéristiques de l'article déco</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type</Label><Input placeholder="Tableau, Tapis..." value={editingProduct.typeDecoration || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeDecoration: e.target.value }))} /></div>
                                                <div><Label>Style</Label><Input placeholder="Moderne, Classique..." value={editingProduct.style || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, style: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Couleur</Label><Input placeholder="Multicolore..." value={editingProduct.couleurDecoration || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, couleurDecoration: e.target.value }))} /></div>
                                                <div><Label>Dimensions</Label><Input placeholder="80x60 cm" value={editingProduct.dimensionsDecoration || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, dimensionsDecoration: e.target.value }))} /></div>
                                                <div><Label>Matériau</Label><Input placeholder="Toile, Bois..." value={editingProduct.materiauDecoration || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, materiauDecoration: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Ustensiles de Cuisine */}
                                    {selectedType === 'ustensiles_cuisine' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🍴 Caractéristiques de l'ustensile</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type</Label><Input placeholder="Casserole, Poêle..." value={editingProduct.typeUstensile || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeUstensile: e.target.value }))} /></div>
                                                <div><Label>Matériau</Label><Input placeholder="Inox, Aluminium..." value={editingProduct.materiauUstensile || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, materiauUstensile: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Marque</Label><Input placeholder="Tefal" value={editingProduct.marqueUstensile || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueUstensile: e.target.value }))} /></div>
                                                <div><Label>Capacité</Label><Input placeholder="2L, 28cm..." value={editingProduct.capacite || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, capacite: e.target.value }))} /></div>
                                                <div><Label>Pièces (si set)</Label><Input type="number" placeholder="12" value={editingProduct.piecesDansSet || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, piecesDansSet: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Pièces Auto */}
                                    {selectedType === 'pieces_auto' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🔧 Caractéristiques de la pièce</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type de pièce</Label><Input placeholder="Pneu, Batterie..." value={editingProduct.typePieceAuto || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typePieceAuto: e.target.value }))} /></div>
                                                <div><Label>Marque</Label><Input placeholder="Michelin, Varta..." value={editingProduct.marquePieceAuto || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marquePieceAuto: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Référence</Label><Input placeholder="205/55R16 91V" value={editingProduct.referenceAuto || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, referenceAuto: e.target.value }))} /></div>
                                                <div><Label>Compatibilité</Label><Input placeholder="Toyota Corolla..." value={editingProduct.compatibilite || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, compatibilite: e.target.value }))} /></div>
                                            </div>
                                            <div><Label>État</Label><Input placeholder="Neuf, Reconditionné" value={editingProduct.etatPieceAuto || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, etatPieceAuto: e.target.value }))} /></div>
                                        </div>
                                    )}

                                    {/* Formulaire Pièces Industrielles */}
                                    {selectedType === 'pieces_industrielles' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">⚙️ Caractéristiques de la pièce</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type de pièce</Label><Input placeholder="Roulement, Moteur..." value={editingProduct.typePieceIndustrielle || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typePieceIndustrielle: e.target.value }))} /></div>
                                                <div><Label>Marque</Label><Input placeholder="SKF, ABB..." value={editingProduct.marquePieceIndustrielle || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marquePieceIndustrielle: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Référence</Label><Input placeholder="6205-2RS" value={editingProduct.referencePiece || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, referencePiece: e.target.value }))} /></div>
                                                <div><Label>Application</Label><Input placeholder="Machines outils..." value={editingProduct.applicationIndustrielle || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, applicationIndustrielle: e.target.value }))} /></div>
                                            </div>
                                            <div><Label>Matériel</Label><Input placeholder="Acier, Fonte..." value={editingProduct.materielPiece || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, materielPiece: e.target.value }))} /></div>
                                        </div>
                                    )}

                                    {/* Formulaire Jouets Enfants */}
                                    {selectedType === 'jouets_enfants' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🧸 Caractéristiques du jouet</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type de jouet</Label><Input placeholder="Éducatif, Peluche..." value={editingProduct.typeJouet || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeJouet: e.target.value }))} /></div>
                                                <div><Label>Âge recommandé</Label><Input placeholder="6-10 ans" value={editingProduct.ageRecommande || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, ageRecommande: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Marque</Label><Input placeholder="Ravensburger..." value={editingProduct.marqueJouet || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueJouet: e.target.value }))} /></div>
                                                <div><Label>Matériel</Label><Input placeholder="Plastique, Bois..." value={editingProduct.materielJouet || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, materielJouet: e.target.value }))} /></div>
                                                <div><Label>Norme sécurité</Label><Input placeholder="CE, EN71..." value={editingProduct.normeSecurite || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, normeSecurite: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Aliments */}
                                    {selectedType === 'aliments' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🍎 Caractéristiques du produit alimentaire</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Catégorie</Label><Input placeholder="Fruits, Légumes..." value={editingProduct.categorieAliment || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, categorieAliment: e.target.value }))} /></div>
                                                <div><Label>Origine</Label><Input placeholder="Locale, Importée" value={editingProduct.origine || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, origine: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Date expiration</Label><Input type="date" value={editingProduct.dateExpiration || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, dateExpiration: e.target.value }))} /></div>
                                                <div><Label>Poids/Quantité</Label><Input placeholder="1kg, 2L..." value={editingProduct.poids || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, poids: e.target.value }))} /></div>
                                                <div><Label>Conservation</Label><Input placeholder="Frais, Surgelé..." value={editingProduct.conservation || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, conservation: e.target.value }))} /></div>
                                            </div>
                                            <div><Label>Certification</Label><Input placeholder="Bio, Halal..." value={editingProduct.certification || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, certification: e.target.value }))} /></div>
                                        </div>
                                    )}

                                    {/* Formulaire Livres et Fournitures */}
                                    {selectedType === 'livres_fournitures' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">📚 Caractéristiques</h4>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Catégorie</Label><Input placeholder="Livre, Cahier..." value={editingProduct.categorieLivre || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, categorieLivre: e.target.value }))} /></div>
                                                <div><Label>Niveau</Label><Input placeholder="Primaire, Secondaire..." value={editingProduct.niveau || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, niveau: e.target.value }))} /></div>
                                                <div><Label>Matière</Label><Input placeholder="Mathématiques..." value={editingProduct.matiereScolaire || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, matiereScolaire: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Auteur</Label><Input placeholder="Pour livres" value={editingProduct.auteur || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, auteur: e.target.value }))} /></div>
                                                <div><Label>Éditeur</Label><Input placeholder="Edicef..." value={editingProduct.editeur || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, editeur: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>ISBN</Label><Input placeholder="978-X-XXX..." value={editingProduct.isbn || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, isbn: e.target.value }))} /></div>
                                                <div><Label>Année édition</Label><Input type="number" placeholder="2023" value={editingProduct.anneeEdition || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, anneeEdition: e.target.value }))} /></div>
                                                <div><Label>État</Label><Input placeholder="Neuf, Bon état" value={editingProduct.etatLivre || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, etatLivre: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Quincaillerie */}
                                    {selectedType === 'quincaillerie' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🔨 Caractéristiques</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Catégorie</Label><Input placeholder="Outils, Peinture..." value={editingProduct.categorieQuincaillerie || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, categorieQuincaillerie: e.target.value }))} /></div>
                                                <div><Label>Marque</Label><Input placeholder="Stanley..." value={editingProduct.marqueQuincaillerie || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueQuincaillerie: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Référence</Label><Input placeholder="STHT0-51309" value={editingProduct.referenceQuincaillerie || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, referenceQuincaillerie: e.target.value }))} /></div>
                                                <div><Label>Unité</Label><Input placeholder="Pièce, Sac, m..." value={editingProduct.unite || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, unite: e.target.value }))} /></div>
                                                <div><Label>Stock disponible</Label><Input type="number" placeholder="50" value={editingProduct.stockDisponible || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, stockDisponible: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Assurance */}
                                    {selectedType === 'assurance' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🛡️ Détails de l'assurance</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Catégorie</Label><Input placeholder="Vie, Non-Vie" value={editingProduct.categorieAssurance || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, categorieAssurance: e.target.value }))} /></div>
                                                <div><Label>Type</Label><Input placeholder="Auto, Santé..." value={editingProduct.typeAssurance || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeAssurance: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Compagnie</Label><Input placeholder="AXA Cameroun..." value={editingProduct.compagnieAssurance || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, compagnieAssurance: e.target.value }))} /></div>
                                                <div><Label>Prime annuelle</Label><Input type="number" placeholder="180000" value={editingProduct.primeAnnuelle || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, primeAnnuelle: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Franchise</Label><Input type="number" placeholder="100000" value={editingProduct.franchise || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, franchise: e.target.value }))} /></div>
                                                <div><Label>Durée</Label><Input placeholder="1 an, 2 ans..." value={editingProduct.dureeContrat || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, dureeContrat: e.target.value }))} /></div>
                                                <div><Label>Couverture</Label><Input placeholder="Dommages, Vol..." value={editingProduct.couverture || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, couverture: e.target.value }))} /></div>
                                            </div>
                                            <div><Label>Bénéfices</Label><textarea placeholder="Assistance 24h, Véhicule remplacement..." value={editingProduct.benefices || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, benefices: e.target.value }))} className="w-full p-2 border border-gray-300 rounded-md min-h-[60px]" /></div>
                                        </div>
                                    )}

                                    {/* Formulaire Pharmacie */}
                                    {selectedType === 'pharmacie' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">💊 Informations pharmacie</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Heures ouverture</Label><Input type="time" placeholder="08:00" value={editingProduct.heuresOuverture || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, heuresOuverture: e.target.value }))} /></div>
                                                <div><Label>Heures fermeture</Label><Input type="time" placeholder="20:00" value={editingProduct.heuresFermeture || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, heuresFermeture: e.target.value }))} /></div>
                                            </div>
                                            <div><Label>Jours de garde</Label><Input placeholder="Lundi-Samedi" value={editingProduct.joursGarde || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, joursGarde: e.target.value }))} /></div>
                                            <div><Label>Téléphone urgence</Label><Input type="tel" placeholder="+237 6XX XX XX XX" value={editingProduct.telephoneUrgence || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, telephoneUrgence: e.target.value }))} /></div>
                                        </div>
                                    )}

                                    {/* Formulaire Hôpital/Clinique */}
                                    {selectedType === 'hopital_clinique' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🏥 Informations établissement</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type</Label><Input placeholder="Hôpital, Clinique..." value={editingProduct.typeEtablissement || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeEtablissement: e.target.value }))} /></div>
                                                <div><Label>Banque de sang</Label><Input placeholder="Oui, Non" value={editingProduct.banqueSang || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, banqueSang: e.target.value }))} /></div>
                                            </div>
                                            <div><Label>Prestations médicales</Label><textarea placeholder="Chirurgie, Radiologie..." value={editingProduct.prestationsMedicales || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, prestationsMedicales: e.target.value }))} className="w-full p-2 border border-gray-300 rounded-md min-h-[60px]" /></div>
                                            <div><Label>Planning</Label><Input placeholder="Lun-Ven 08:00-18:00" value={editingProduct.planning || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, planning: e.target.value }))} /></div>
                                        </div>
                                    )}

                                    {/* Formulaire Déménagement */}
                                    {selectedType === 'demenagement' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">🚚 Détails du déménagement</h4>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Type</Label><Input placeholder="Local, International" value={editingProduct.typeDemenagement || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeDemenagement: e.target.value }))} /></div>
                                                <div><Label>Volume (m³)</Label><Input type="number" placeholder="20" value={editingProduct.volumeDemenagement || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, volumeDemenagement: e.target.value }))} /></div>
                                                <div><Label>Nb déménageurs</Label><Input type="number" placeholder="3" value={editingProduct.nbDemenageurs || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, nbDemenageurs: e.target.value }))} /></div>
                                            </div>
                                            <div><Label>Services inclus</Label><textarea placeholder="Emballage, Montage/Démontage, Assurance..." value={editingProduct.servicesInclus || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, servicesInclus: e.target.value }))} className="w-full p-2 border border-gray-300 rounded-md min-h-[60px]" /></div>
                                        </div>
                                    )}

                                    {/* Formulaire Cosmétique et Parfums */}
                                    {selectedType === 'cosmetique_parfum' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">✨ Caractéristiques du produit</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type</Label><Input placeholder="Parfum, Crème..." value={editingProduct.typeCosmetique || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeCosmetique: e.target.value }))} /></div>
                                                <div><Label>Marque</Label><Input placeholder="Chanel, Nivea..." value={editingProduct.marqueCosmetique || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueCosmetique: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Volume</Label><Input placeholder="50ml, 100ml" value={editingProduct.volumeCosmetique || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, volumeCosmetique: e.target.value }))} /></div>
                                                <div><Label>Pour qui</Label><Input placeholder="Homme, Femme..." value={editingProduct.genre || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, genre: e.target.value }))} /></div>
                                                <div><Label>Type peau</Label><Input placeholder="Toutes, Sèche..." value={editingProduct.typePeau || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typePeau: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Bijoux */}
                                    {selectedType === 'bijoux' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">💎 Caractéristiques du bijou</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type</Label><Input placeholder="Collier, Bague..." value={editingProduct.typeBijou || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeBijou: e.target.value }))} /></div>
                                                <div><Label>Matière</Label><Input placeholder="Or, Argent..." value={editingProduct.matiereBijou || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, matiereBijou: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Poids (g)</Label><Input type="number" placeholder="15" value={editingProduct.poidsBijou || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, poidsBijou: e.target.value }))} /></div>
                                                <div><Label>Carat</Label><Input placeholder="18, 1 carat..." value={editingProduct.carat || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, carat: e.target.value }))} /></div>
                                                <div><Label>Certificat</Label><Input placeholder="Oui, Non, GIA..." value={editingProduct.certificat || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, certificat: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Formulaire Coiffure et Beauté */}
                                    {selectedType === 'coiffure_beaute' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">💇‍♀️ Caractéristiques du produit capillaire</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Type</Label><Input placeholder="Mèches, Perruque..." value={editingProduct.typeCoiffure || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typeCoiffure: e.target.value }))} /></div>
                                                <div><Label>Longueur</Label><Input placeholder="30cm, 50cm..." value={editingProduct.longueurMech || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, longueurMech: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>Couleur</Label><Input placeholder="Noir, Châtain..." value={editingProduct.couleurMech || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, couleurMech: e.target.value }))} /></div>
                                                <div><Label>Texture</Label><Input placeholder="Lisse, Afro..." value={editingProduct.textureMech || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, textureMech: e.target.value }))} /></div>
                                                <div><Label>Type pose</Label><Input placeholder="Clip, Tissage..." value={editingProduct.typePose || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, typePose: e.target.value }))} /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><Label>Marque</Label><Input placeholder="Remy Hair..." value={editingProduct.marqueCoiffure || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, marqueCoiffure: e.target.value }))} /></div>
                                                <div><Label>Origine</Label><Input placeholder="Brésilien, Indien..." value={editingProduct.origineMech || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev!, origineMech: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sélection de devise - MASQUÉE pour pharmacie et hopital_clinique */}
                                    {selectedType !== 'pharmacie' && selectedType !== 'hopital_clinique' && (
                                        <div>
                                            <Label>Devise</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {CURRENCIES.map((currency) => (
                                                    <button
                                                        key={currency.code}
                                                        className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all ${editingProduct.currency === currency.code
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                                                            }`}
                                                        onClick={() => {
                                                            setEditingProduct(prev => ({
                                                                ...prev!,
                                                                currency: currency.code
                                                            }));
                                                        }}
                                                    >
                                                        {currency.code} ({currency.symbol})
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ✅ Section Promotion */}
                                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                            🎁 Promotion (optionnel)
                                        </h3>

                                        <div className="space-y-4">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={editingProduct.promotionActive || false}
                                                    onChange={(e) => setEditingProduct(prev => ({
                                                        ...prev!,
                                                        promotionActive: e.target.checked
                                                    }))}
                                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <label className="text-sm font-medium text-gray-700">
                                                    Activer une promotion pour ce produit
                                                </label>
                                            </div>

                                            {editingProduct.promotionActive && (
                                                <div className="space-y-3 pl-6 border-l-2 border-yellow-400">
                                                    <div>
                                                        <Label>🏷️ Type de promotion</Label>
                                                        <div className="grid grid-cols-4 gap-2 mt-2">
                                                            {['reduction', 'offre', 'bon_plan', 'flash'].map((type) => (
                                                                <button
                                                                    key={type}
                                                                    type="button"
                                                                    onClick={() => setEditingProduct(prev => ({
                                                                        ...prev!,
                                                                        promotionType: type as any
                                                                    }))}
                                                                    className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${editingProduct.promotionType === type
                                                                        ? 'bg-yellow-500 text-white border-yellow-500'
                                                                        : 'bg-white text-gray-700 border-gray-300 hover:border-yellow-400'
                                                                        }`}
                                                                >
                                                                    {type === 'reduction' ? 'Réduction' :
                                                                        type === 'offre' ? 'Offre' :
                                                                            type === 'bon_plan' ? 'Bon plan' : 'Flash'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <Label>💰 Valeur</Label>
                                                        <Input
                                                            placeholder="Ex: -20%, 1+1 gratuit"
                                                            value={editingProduct.promotionValeur || ''}
                                                            onChange={(e) => setEditingProduct(prev => ({
                                                                ...prev!,
                                                                promotionValeur: e.target.value
                                                            }))}
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label>📝 Description</Label>
                                                        <textarea
                                                            placeholder="Décrivez l'offre..."
                                                            value={editingProduct.promotionDescription || ''}
                                                            onChange={(e) => setEditingProduct(prev => ({
                                                                ...prev!,
                                                                promotionDescription: e.target.value
                                                            }))}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label>📅 Date de fin</Label>
                                                        <Input
                                                            type="date"
                                                            value={editingProduct.promotionDateFin || ''}
                                                            onChange={(e) => setEditingProduct(prev => ({
                                                                ...prev!,
                                                                promotionDateFin: e.target.value
                                                            }))}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Upload d'images */}
                                    <div>
                                        <Label>Images du produit</Label>
                                        <div
                                            className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center ${dragActive ? 'border-blue-500 bg-blue-50' : ''
                                                }`}
                                            onDragEnter={(e) => {
                                                e.preventDefault();
                                                setDragActive(true);
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                setDragActive(false);
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setDragActive(false);
                                                handleFileUpload(e.dataTransfer.files, 'images');
                                            }}
                                        >
                                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 mb-2">
                                                Glissez-déposez des images ou cliquez pour sélectionner
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                Sélectionner des images
                                            </Button>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => e.target.files && handleFileUpload(e.target.files, 'images')}
                                            />
                                        </div>

                                        {/* Aperçu des images */}
                                        {editingProduct.images.length > 0 && (
                                            <div className="grid grid-cols-4 gap-2 mt-4">
                                                {editingProduct.images.map((image, index) => (
                                                    <div key={index} className="relative group">
                                                        <img
                                                            src={image}
                                                            alt={`Produit ${index + 1}`}
                                                            className="w-full h-20 object-cover rounded-lg"
                                                        />
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="absolute -top-2 -right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => removeMedia('images', index)}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload de vidéos */}
                                    <div>
                                        <Label>Vidéos du produit</Label>
                                        <div
                                            className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center ${dragActive ? 'border-blue-500 bg-blue-50' : ''
                                                }`}
                                            onDragEnter={(e) => {
                                                e.preventDefault();
                                                setDragActive(true);
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                setDragActive(false);
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setDragActive(false);
                                                handleFileUpload(e.dataTransfer.files, 'videos');
                                            }}
                                        >
                                            <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 mb-2">
                                                Glissez-déposez des vidéos ou cliquez pour sélectionner
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.multiple = true;
                                                    input.accept = 'video/*';
                                                    input.onchange = (e) => {
                                                        const files = (e.target as HTMLInputElement).files;
                                                        if (files) handleFileUpload(files, 'videos');
                                                    };
                                                    input.click();
                                                }}
                                            >
                                                Sélectionner des vidéos
                                            </Button>
                                        </div>

                                        {/* Aperçu des vidéos */}
                                        {editingProduct.videos.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 mt-4">
                                                {editingProduct.videos.map((video, index) => (
                                                    <div key={index} className="relative group">
                                                        <video
                                                            src={video}
                                                            className="w-full h-32 object-cover rounded-lg"
                                                            controls
                                                        />
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="absolute -top-2 -right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => removeMedia('videos', index)}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions - TOUJOURS VISIBLES */}
                                    <div className="sticky bottom-0 bg-white pt-4 border-t mt-6 flex justify-end gap-2 z-10">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setEditingProduct(null);
                                                setCurrentStep('type');
                                            }}
                                        >
                                            Annuler
                                        </Button>
                                        <Button onClick={handleSaveProduct} className="bg-green-600 hover:bg-green-700">
                                            <Check className="w-4 h-4 mr-2" />
                                            Enregistrer
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal GPS pour immobilier */}
            {showGPSModal && (
                <MapModal
                    onClose={() => setShowGPSModal(false)}
                    onSelect={(coordinatesString) => {
                        const firstPoint = coordinatesString.split('|')[0].split(',');
                        if (firstPoint.length === 2) {
                            const lat = parseFloat(firstPoint[0]);
                            const lng = parseFloat(firstPoint[1]);
                            setSelectedGPSLocation({ lat, lng });
                            setEditingProduct(prev => ({
                                ...prev!,
                                gpsImmobilier: coordinatesString
                            }));
                        }
                        setShowGPSModal(false);
                    }}
                />
            )}

            {/* Sélecteur de place pour bus */}
            <BusSeatSelector
                isOpen={showSeatSelector}
                onClose={() => setShowSeatSelector(false)}
                onSelectSeat={(seatLabel) => {
                    setEditingProduct(prev => ({
                        ...prev!,
                        numeroPlace: seatLabel
                    }));
                    setShowSeatSelector(false);
                }}
            />
        </div>
    );
};

export default ProductManager;

















