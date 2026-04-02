// @ts-nocheck
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ProductDuplicationModal from './ProductDuplicationModal';
import ProductFieldSelector from './ProductFieldSelector';
// Code corrigé (remplace @ts-ignore)
import * as ImagePicker from 'expo-image-picker';
// Code corrigé (remplace @ts-ignore)
import * as DocumentPicker from 'expo-document-picker';
// Code corrigé (remplace @ts-ignore)
import * as FileSystem from 'expo-file-system';
// Code corrigé (remplace @ts-ignore)
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
// Code corrigé (remplace @ts-ignore)
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';
// Code corrigé (remplace @ts-ignore)
import BusSeatSelector from './BusSeatSelector';
// Code corrigé (remplace @ts-ignore)
import ModernGPSModal from './ModernGPSModal';

const { width } = Dimensions.get('window');

// ✅ Fonction de normalisation sans accents pour la recherche
const normalizeText = (text: string): string => {
    return text
        .toLowerCase()
        .normalize('NFD') // Décompose les caractères accentués
        .replace(/[̀-ͯ]/g, '') // Supprime les accents
        .trim();
};

// ✅ NOUVEAU: Composant moderne pour les champs multi-sélection
const ModernSelectField = ({
    label,
    value,
    options,
    onSelect,
    required = false,
    allowCustom = false
}: {
    label: string;
    value: string;
    options: string[];
    onSelect: (value: string) => void;
    required?: boolean;
    allowCustom?: boolean;
}) => {
    return (
        <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>

            <TouchableOpacity
                style={styles.modernSelect}
                onPress={() => {
                    // @ts-ignore - TypeScript faux positif sur Alert.alert buttons
                    const alertButtons: any = [
                        ...options.map(option => ({
                            text: option,
                            onPress: () => {
                                if (option.includes('🆕 Autre') && allowCustom) {
                                    Alert.prompt(
                                        'Nouveau type',
                                        `Entrez le ${label.toLowerCase()} :`,
                                        [
                                            { text: 'Annuler', style: 'cancel' },
                                            {
                                                text: 'Ajouter',
                                                // @ts-ignore - onPress prend bien un paramètre text dans Alert.prompt
                                                onPress: (text?: string) => {
                                                    if (text && text.trim()) {
                                                        onSelect(text.trim());
                                                    }
                                                }
                                            }
                                        ],
                                        'plain-text'
                                    );
                                } else {
                                    onSelect(option);
                                }
                            }
                        })),
                        { text: 'Annuler', style: 'cancel' }
                    ];

                    Alert.alert(label, 'Sélectionnez une option :', alertButtons);
                }}
            >
                <Text style={[
                    styles.selectText,
                    !value && styles.selectPlaceholder
                ]}>
                    {value || 'Sélectionner...'}
                </Text>
                <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
            </TouchableOpacity>
        </View>
    );
};

// ✅ DONNÉES PROFESSIONNELLES POUR LISTES DÉROULANTES

// Marques automobiles professionnelles
// ✅ Constantes inutilisées supprimées - Remplacées par productModalities.ts et ProductFieldSelector

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
    prix: number | string; // ✅ Accepte les deux types (string du formulaire, number pour l'API)
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
    marqueAutomobile?: string; // ✅ Spécifique à l'automobile
    modeleAutomobile?: string; // ✅ Spécifique à l'automobile
    etatVehicule?: string; // Neuf, Occasion, etc.
    annee?: string;
    kilometrage?: string;
    couleurAutomobile?: string; // ✅ Spécifique à l'automobile
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
    matiereVetement?: string; // ✅ Spécifique aux vêtements
    marqueVetement?: string;

    // Chaussure
    pointure?: string;
    couleurChaussure?: string;
    marqueChaussure?: string;

    // Électroménager
    typeElectro?: string; // Réfrigérateur, Cuisinière, Four, etc.
    marqueElectro?: string;
    modeleElectro?: string;
    etatElectro?: string; // ✅ Spécifique à l'électroménager
    garantieElectro?: string; // ✅ Spécifique à l'électroménager

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
    styleDecoration?: string; // ✅ Spécifique à la décoration
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
    materiauMobilier?: string; // ✅ Spécifique au mobilier
    dimensionsMobilier?: string; // ✅ Spécifique au mobilier
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
    categoryService?: string; // ✅ NOUVEAU: Catégorie du service pour détection auto du type produit
    onDuplicate?: (product: Product) => void; // ✅ AJOUT: Callback pour la duplication
}

// Configuration des types de produits avec noms adaptés
export const PRODUCT_TYPES = [
    { value: 'agroalimentaire', label: 'Agroalimentaire & Produits Secs', icon: '🌾', color: '#F59E0B', description: 'Riz, pâtes, farine, huile, sucre, épices, conserves, boissons, produits transformés', keywords: ['riz', 'pâtes', 'macaroni', 'spaghetti', 'farine', 'huile', 'arachide', 'palme', 'tournesol', 'olive', 'sucre', 'sel', 'épices', 'poivre', 'curry', 'curcuma', 'gingembre', 'piment', 'sauce', 'ketchup', 'mayonnaise', 'moutarde', 'maggi', 'jumbo', 'bouillon', 'cube', 'conserve', 'sardine', 'thon', 'maquereau', 'tomate', 'haricot', 'pois', 'maïs', 'boisson', 'eau', 'jus', 'soda', 'cola', 'sprite', 'fanta', 'café', 'nescafé', 'thé', 'lipton', 'lait', 'nido', 'peak', 'chocolat', 'cacao', 'biscuit', 'chips', 'snack', 'bonbon', 'confiserie', 'céréale', 'avoine', 'blé', 'maïs', 'mil', 'sorgho', 'manioc', 'couscous', 'semoule', 'légume', 'sec', 'lentille', 'fève', 'pois chiche', 'condiment', 'vinaigre', 'miel', 'confiture', 'beurre', 'cacahuète', 'arachide', 'noix', 'cajou', 'amande', 'produit', 'alimentaire', 'agro', 'transformation', 'conserverie', 'biscuiterie', 'huilerie', 'meunerie', 'rizerie', 'sucrerie', 'chocolaterie', 'confiserie'] },
    { value: 'aliments', label: 'Aliments Frais & Produits du Marché', icon: '🍎', color: '#84CC16', description: 'Fruits frais, légumes frais, viandes, poissons, volailles, produits du marché', keywords: ['fruit', 'légume', 'viande', 'poisson', 'bœuf', 'poulet', 'porc', 'mouton', 'chèvre', 'tomate', 'oignon', 'pomme', 'banane', 'orange', 'mangue', 'avocat', 'ananas', 'carotte', 'chou', 'salade', 'frais', 'marché'] },
    { value: 'assurance', label: 'Assurance et Protection', icon: '🛡️', color: '#14B8A6', description: 'Assurance auto, santé, habitation, vie, protection sociale', keywords: ['assurance', 'protection', 'garantie', 'prime', 'contrat', 'couverture', 'police', 'assureur', 'sinistre', 'indemnisation', 'franchise', 'souscription', 'mutuelle', 'prévoyance', 'responsabilité civile', 'tous risques'] },
    { value: 'automobile', label: 'Automobiles et Véhicules', icon: '🚗', color: '#EF4444', description: 'Voitures, motos, camions, véhicules utilitaires', keywords: ['voiture', 'auto', 'véhicule', 'automobile', 'moto', 'scooter', 'camion', '4x4', 'SUV', 'berline', 'coupé', 'cabriolet', 'Toyota', 'Honda', 'Mercedes', 'Peugeot', 'Renault', 'Nissan', 'occasion', 'neuf', 'kilométrage', 'essence', 'diesel', 'hybride', 'électrique', 'automatique', 'manuelle'] },
    { value: 'chaussure', label: 'Chaussures et Accessoires', icon: '👟', color: '#6366F1', description: 'Chaussures, baskets, sandales, bottes', keywords: ['chaussure', 'soulier', 'basket', 'sneaker', 'sandale', 'tong', 'botte', 'bottine', 'escarpin', 'talon', 'mocassin', 'ballerine', 'pointure', 'semelle', 'cuir', 'sport', 'ville', 'Nike', 'Adidas', 'Puma'] },
    { value: 'covoiturage', label: 'Covoiturage et Trajets', icon: '🚙', color: '#F59E0B', description: 'Trajets partagés, carpooling, transport collectif', keywords: ['covoiturage', 'trajet', 'partage', 'carpooling', 'transport partagé', 'passager', 'conducteur', 'départ', 'arrivée', 'itinéraire', 'route', 'place disponible', 'voyage partagé', 'économique', 'écologique'] },
    { value: 'decoration', label: 'Décoration Intérieure', icon: '🖼️', color: '#E91E63', description: 'Tableaux, luminaires, tapis, accessoires déco', keywords: ['décoration', 'déco', 'tableau', 'toile', 'peinture', 'affiche', 'cadre', 'luminaire', 'lampe', 'lustre', 'applique', 'tapis', 'carpette', 'coussin', 'rideau', 'vase', 'sculpture', 'miroir', 'horloge', 'bougie', 'moderne', 'classique', 'vintage', 'contemporain'] },
    { value: 'electricite', label: 'Électricité et Éclairage', icon: '⚡', color: '#FFC107', description: 'Câbles, prises, interrupteurs, lampes, disjoncteurs', keywords: ['électricité', 'électrique', 'câble', 'fil', 'interrupteur', 'prise', 'disjoncteur', 'tableau électrique', 'lampe', 'ampoule', 'LED', 'néon', 'spot', 'variateur', 'minuterie', 'détecteur', 'multiprise', 'rallonge', '220V', 'installation électrique'] },
    { value: 'electromenager', label: 'Électroménager Domestique', icon: '🔌', color: '#14B8A6', description: 'Frigos, fours, machines à laver, micro-ondes', keywords: ['électroménager', 'frigo', 'réfrigérateur', 'congélateur', 'four', 'cuisinière', 'micro-ondes', 'lave-linge', 'machine à laver', 'lave-vaisselle', 'aspirateur', 'climatiseur', 'ventilateur', 'Samsung', 'LG', 'Bosch', 'Whirlpool'] },
    { value: 'hopital_clinique', label: 'Établissements de Santé', icon: '🏥', color: '#DC2626', description: 'Hôpitaux, cliniques, centres médicaux, spécialités', keywords: ['hôpital', 'clinique', 'centre médical', 'centre de santé', 'médecin', 'docteur', 'consultation', 'urgence', 'soins', 'chirurgie', 'imagerie', 'radio', 'scanner', 'IRM', 'laboratoire', 'maternité', 'pédiatrie', 'cardiologie', 'dentiste', 'rendez-vous'] },
    { value: 'hotellerie', label: 'Hôtellerie et Hébergement', icon: '🏨', color: '#EC4899', description: 'Hôtels, chambres d\'hôtes, auberges, gîtes, réservations', keywords: ['hôtel', 'hébergement', 'chambre', 'chambre d\'hôtes', 'auberge', 'gîte', 'motel', 'palace', 'réservation', 'booking', 'nuitée', 'séjour', 'étoile', 'luxe', 'petit-déjeuner', 'Wi-Fi', 'piscine', 'restaurant', 'spa', 'climatisation'] },
    { value: 'image_son', label: 'Image et Son', icon: '📺', color: '#9C27B0', description: 'TV, home cinéma, enceintes, projecteurs, systèmes audio', keywords: ['télévision', 'TV', 'téléviseur', 'écran', 'home cinéma', 'enceinte', 'haut-parleur', 'barre de son', 'amplificateur', 'projecteur', 'casque', 'écouteurs', '4K', '8K', 'HD', 'OLED', 'QLED', 'LCD', 'LED', 'Samsung', 'Sony', 'LG'] },
    { value: 'immobilier_batiment', label: 'Immobilier - Vente/Location', icon: '🏢', color: '#3B82F6', description: 'Appartements, villas, maisons à vendre ou louer (long terme)', keywords: ['immobilier', 'appartement', 'appart', 'F2', 'F3', 'F4', 'villa', 'maison', 'studio', 'duplex', 'loft', 'vente', 'location', 'louer', 'acheter', 'bail', 'loyer', 'chambre', 'salon', 'cuisine', 'salle de bain', 'balcon', 'terrasse', 'jardin', 'garage', 'meublé', 'standing'] },
    { value: 'immobilier_terrain', label: 'Immobilier - Terrains', icon: '🏞️', color: '#10B981', description: 'Terrains constructibles, parcelles, lots', keywords: ['terrain', 'parcelle', 'lot', 'terrain constructible', 'constructible', 'viabilisé', 'terrain agricole', 'champ', 'plantation', 'titre foncier', 'cadastre', 'superficie', 'hectare', 'mètre carré', 'clôturé', 'lotissement'] },
    { value: 'jouets_enfants', label: 'Jouets et Articles pour Enfants', icon: '🧸', color: '#FF69B4', description: 'Jouets éducatifs, peluches, jeux, puzzles, livres enfants', keywords: ['jouet', 'jeu', 'enfant', 'bébé', 'peluche', 'poupée', 'figurine', 'voiture miniature', 'puzzle', 'lego', 'construction', 'éducatif', 'éveil', 'jeu de société', 'ballon', 'vélo', 'trottinette', 'poussette', 'berceau', 'hochet', 'doudou', '0-3 ans', '3-6 ans'] },
    { value: 'livres_fournitures', label: 'Livres et Fournitures Scolaires', icon: '📚', color: '#7C3AED', description: 'Manuels, livres, cahiers, stylos, fournitures', keywords: ['livre', 'manuel', 'manuel scolaire', 'cahier', 'classeur', 'feuille', 'papier', 'stylo', 'crayon', 'gomme', 'règle', 'trousse', 'cartable', 'sac à dos', 'marqueur', 'feutre', 'calculatrice', 'dictionnaire', 'roman', 'BD', 'maternelle', 'primaire', 'secondaire', 'lycée', 'université', 'mathématiques', 'français'] },
    { value: 'mobilier', label: 'Mobilier et Ameublement', icon: '🪑', color: '#F97316', description: 'Meubles salon, chambre, bureau, rangement', keywords: ['meuble', 'mobilier', 'ameublement', 'canapé', 'fauteuil', 'chaise', 'table', 'bureau', 'armoire', 'placard', 'commode', 'étagère', 'bibliothèque', 'lit', 'matelas', 'rangement', 'salon', 'chambre', 'salle à manger', 'bois', 'métal', 'cuir', 'moderne', 'vintage', 'IKEA'] },
    { value: 'ordinateur', label: 'Ordinateurs et Informatique', icon: '💻', color: '#00BCD4', description: 'PC portables, bureaux, tablettes, accessoires', keywords: ['ordinateur', 'PC', 'laptop', 'portable', 'desktop', 'MacBook', 'iMac', 'tablette', 'iPad', 'processeur', 'CPU', 'Intel', 'AMD', 'RAM', 'disque dur', 'SSD', 'carte graphique', 'clavier', 'souris', 'Windows', 'macOS', 'Dell', 'HP', 'Lenovo', 'Asus', 'Apple', 'gaming'] },
    { value: 'pharmacie', label: 'Pharmacies et Gardes', icon: '💊', color: '#059669', description: 'Pharmacies, planning de garde, services pharmaceutiques', keywords: ['pharmacie', 'pharmacien', 'médicament', 'ordonnance', 'prescription', 'garde', 'pharmacie de garde', 'urgence', 'parapharmacie', 'vitamine', 'complément', 'pansement', 'sirop', 'comprimé', 'gélule', 'crème', 'antiseptique', 'doliprane', 'paracétamol'] },
    { value: 'demenagement', label: 'Déménagement et Transport', icon: '📦', color: '#F97316', description: 'Services de déménagement local, national et international', keywords: ['déménagement', 'déménager', 'déménageur', 'manutention', 'transport', 'camion', 'camionnette', 'carton', 'emballage', 'meuble', 'monte-meuble', 'garde-meuble', 'stockage', 'local', 'national', 'international', 'express', 'assurance', 'devis', 'tarif'] },
    { value: 'cosmetique_parfum', label: 'Cosmétique & Parfum', icon: '✨', color: '#E91E63', description: 'Parfums, maquillage, soins beauté, huiles, crèmes', keywords: ['cosmétique', 'parfum', 'maquillage', 'beauté', 'soin', 'crème', 'lotion', 'sérum', 'masque', 'fond de teint', 'rouge à lèvres', 'mascara', 'vernis', 'eau de toilette', 'déodorant', 'gel douche', 'shampoing', 'Chanel', 'Dior', 'L\'Oréal', 'Nivea', 'naturel', 'bio'] },
    { value: 'bijoux', label: 'Bijoux & Accessoires', icon: '💎', color: '#FFD700', description: 'Colliers, bagues, bracelets, montres, pierres précieuses', keywords: ['bijou', 'bijouterie', 'collier', 'pendentif', 'bague', 'alliance', 'bracelet', 'gourmette', 'boucle d\'oreille', 'montre', 'chaîne', 'médaille', 'or', 'argent', 'platine', 'diamant', 'pierre précieuse', 'rubis', 'saphir', 'perle', '18k', '14k', 'plaqué or', 'Cartier', 'Tiffany'] },
    { value: 'coiffure_beaute', label: 'Coiffure & Beauté', icon: '💇‍♀️', color: '#E91E63', description: 'Mèches, extensions, perruques, accessoires de coiffure, soins cheveux', keywords: ['coiffure', 'cheveu', 'mèche', 'extension', 'perruque', 'tissage', 'tresse', 'défrisage', 'lissage', 'bouclage', 'coloration', 'teinture', 'balayage', 'coupe', 'brushing', 'lisse', 'bouclé', 'naturel', 'synthétique', 'brésilienne', 'indienne', 'remy hair', 'clip', 'pose'] },
    { value: 'pieces_auto', label: 'Pièces Détachées Auto', icon: '🔧', color: '#607D8B', description: 'Pièces moteur, freins, carrosserie, filtres, batteries', keywords: ['pièce auto', 'pièce détachée', 'pièce automobile', 'moteur', 'frein', 'disque', 'plaquette', 'carrosserie', 'pare-choc', 'aile', 'capot', 'phare', 'feu', 'filtre', 'huile', 'batterie', 'alternateur', 'bougie', 'courroie', 'embrayage', 'suspension', 'amortisseur', 'vidange', 'garage'] },
    { value: 'pieces_industrielles', label: 'Pièces Industrielles', icon: '⚙️', color: '#455A64', description: 'Roulements, courroies, moteurs, pompes, pièces machines', keywords: ['pièce industrielle', 'pièce machine', 'roulement', 'palier', 'courroie', 'chaîne', 'poulie', 'pignon', 'engrenage', 'moteur électrique', 'hydraulique', 'pneumatique', 'pompe', 'compresseur', 'vanne', 'vérin', 'tuyau', 'joint', 'acier', 'inox', 'industriel', 'usine', 'maintenance'] },
    { value: 'prestation_service', label: 'Prestation de Service', icon: '🎯', color: '#8B5CF6', description: 'Plombier, électricien, mécanicien, coiffeur, développeur...', keywords: ['plombier', 'électricien', 'mécanicien', 'menuisier', 'peintre', 'maçon', 'carreleur', 'soudeur', 'serrurier', 'vitrier', 'plâtrier', 'couvreur', 'charpentier', 'ébéniste', 'tapissier', 'décorateur', 'jardinier', 'paysagiste', 'élagueur', 'coiffeur', 'barbier', 'esthéticienne', 'manucure', 'massage', 'spa', 'kinésithérapeute', 'ostéopathe', 'infirmier', 'sage-femme', 'aide-soignant', 'auxiliaire', 'photographe', 'vidéaste', 'graphiste', 'designer', 'développeur', 'programmeur', 'webmaster', 'informaticien', 'technicien', 'réparateur', 'dépanneur', 'installateur', 'monteur', 'agent', 'nettoyage', 'entretien', 'ménage', 'repassage', 'cuisinier', 'traiteur', 'pâtissier', 'boulanger', 'serveur', 'barman', 'chauffeur', 'livreur', 'coursier', 'déménageur', 'manutentionnaire', 'gardien', 'vigile', 'agent de sécurité', 'coach', 'formateur', 'professeur', 'enseignant', 'répétiteur', 'tuteur', 'traducteur', 'interprète', 'rédacteur', 'correcteur', 'secrétaire', 'assistant', 'comptable', 'auditeur', 'consultant', 'conseiller', 'expert', 'avocat', 'juriste', 'notaire', 'huissier', 'architecte', 'ingénieur', 'géomètre', 'topographe', 'vétérinaire', 'dresseur', 'toiletteur', 'DJ', 'musicien', 'animateur', 'présentateur', 'artiste', 'comédien', 'danseur', 'maquilleur', 'styliste', 'couturier', 'tailleur', 'cordonnier', 'tapissier', 'sellier', 'bijoutier', 'horloger', 'opticien', 'prothésiste', 'dentiste', 'orthodontiste', 'pédicure', 'podologue', 'sophrologue', 'psychologue', 'psychiatre', 'nutritionniste', 'diététicien', 'coach sportif', 'personal trainer', 'yoga', 'pilates', 'danse', 'sport', 'guide', 'accompagnateur', 'moniteur', 'instructeur', 'analyste', 'data scientist', 'statisticien', 'économiste', 'chercheur', 'scientifique', 'laborantin', 'pharmacien', 'préparateur', 'radiologiste', 'échographiste', 'technicien médical', 'ambulancier', 'secouriste', 'pompier', 'agent immobilier', 'promoteur', 'syndic', 'gestionnaire', 'administrateur', 'directeur', 'manager', 'chef de projet', 'coordinateur', 'superviseur', 'contrôleur', 'inspecteur', 'évaluateur', 'expert-comptable', 'fiscaliste', 'commissaire aux comptes', 'assureur', 'courtier', 'agent général', 'banquier', 'conseiller financier', 'trader', 'cambiste', 'caissier', 'guichetier', 'vendeur', 'commercial', 'télévendeur', 'VRP', 'représentant', 'agent commercial', 'négociateur', 'acheteur', 'approvisionneur', 'logisticien', 'magasinier', 'gestionnaire de stock', 'préparateur de commandes', 'cariste', 'grutier', 'conducteur', 'opérateur', 'machiniste', 'usineur', 'tourneur', 'fraiseur', 'ajusteur', 'monteur', 'assembleur', 'câbleur', 'électronicien', 'automaticien', 'roboticien', 'mécanicien auto', 'mécanicien moto', 'carrossier', 'peintre auto', 'tôlier', 'mécanicien poids lourds', 'mécanicien agricole', 'dépanneur auto', 'garagiste', 'vulcanisateur', 'climaticien', 'frigoriste', 'chauffagiste', 'sanitaire', 'zingueur'] },
    { value: 'quincaillerie', label: 'Quincaillerie, Sanitaire & Électricité', icon: '🔨', color: '#F59E0B', description: 'Outils, matériaux, plomberie, électricité, construction', keywords: ['quincaillerie', 'outil', 'marteau', 'tournevis', 'clé', 'pince', 'scie', 'perceuse', 'visseuse', 'meuleuse', 'ponceuse', 'raboteuse', 'tronçonneuse', 'matériaux', 'ciment', 'sable', 'gravier', 'brique', 'parpaing', 'fer', 'acier', 'béton', 'mortier', 'chaux', 'plâtre', 'peinture', 'vernis', 'colle', 'mastic', 'silicone', 'joint', 'sanitaire', 'plomberie', 'robinet', 'robinetterie', 'mitigeur', 'mélangeur', 'douche', 'baignoire', 'lavabo', 'évier', 'WC', 'toilette', 'chasse', 'tuyau', 'canalisation', 'raccord', 'coude', 'té', 'vanne', 'électricité', 'électrique', 'câble', 'fil', 'interrupteur', 'prise', 'disjoncteur', 'tableau', 'lampe', 'ampoule', 'LED', 'néon', 'spot', 'applique', 'lustre', 'plafonnier', 'variateur', 'minuterie', 'détecteur', 'sonnette', 'multiprise', 'rallonge', 'domino', 'gaine', 'conduit'] },
    { value: 'telephone', label: 'Téléphones et Accessoires', icon: '📱', color: '#FF9800', description: 'Smartphones, accessoires, coques, écouteurs', keywords: ['téléphone', 'smartphone', 'mobile', 'portable', 'cellulaire', 'iPhone', 'Samsung', 'Huawei', 'Xiaomi', 'Oppo', 'Tecno', 'Infinix', 'Nokia', 'Galaxy', 'Android', 'iOS', 'écran', 'tactile', 'appareil photo', 'caméra', 'double SIM', '4G', '5G', 'Wi-Fi', 'Bluetooth', 'stockage', '64GB', '128GB', '256GB', 'RAM', 'batterie', 'chargeur', 'coque', 'écouteurs', 'neuf', 'occasion', 'débloqué'] },
    { value: 'ticket_voyage', label: 'Tickets et Billets de Transport', icon: '🎫', color: '#8B5CF6', description: 'Bus, train, avion avec sélection de place', keywords: ['ticket', 'billet', 'voyage', 'transport', 'bus', 'car', 'autobus', 'train', 'avion', 'vol', 'bateau', 'ferry', 'départ', 'arrivée', 'destination', 'trajet', 'place', 'siège', 'réservation', 'aller simple', 'aller-retour', 'économique', 'affaires', 'première classe', 'VIP', 'escale', 'direct', 'compagnie', 'horaire'] },
    { value: 'ustensiles_cuisine', label: 'Ustensiles de Cuisine', icon: '🍴', color: '#FF5722', description: 'Casseroles, poêles, couteaux, mixers, batterie cuisine', keywords: ['ustensile', 'cuisine', 'casserole', 'poêle', 'faitout', 'marmite', 'cocotte', 'wok', 'couteau', 'planche à découper', 'râpe', 'fouet', 'louche', 'spatule', 'cuillère', 'mixer', 'mixeur', 'blender', 'robot cuisine', 'balance', 'batterie cuisine', 'inox', 'aluminium', 'téflon', 'anti-adhésif', 'set'] },
    { value: 'vetement', label: 'Vêtements et Prêt-à-Porter', icon: '👕', color: '#EC4899', description: 'Vêtements, habits, articles de mode', keywords: ['vêtement', 'habit', 'mode', 'fashion', 'prêt-à-porter', 'textile', 'chemise', 'polo', 'T-shirt', 'pull', 'sweat', 'gilet', 'veste', 'manteau', 'blouson', 'pantalon', 'jean', 'short', 'jupe', 'robe', 'costume', 'tailleur', 'sous-vêtement', 'chaussette', 'écharpe', 'cravate', 'ceinture', 'gant', 'bonnet', 'chapeau', 'casquette', 'homme', 'femme', 'enfant', 'taille', 'coton', 'soie', 'lin', 'laine', 'Zara', 'H&M'] },
    { value: 'restauration', label: 'Restauration & Traiteur', icon: '🍽️', color: '#F97316', description: 'Restaurants, cafés, bars, traiteurs, food trucks', keywords: ['restaurant', 'resto', 'café', 'bar', 'traiteur', 'food truck', 'cuisine', 'menu', 'plat', 'repas', 'déjeuner', 'dîner', 'petit-déjeuner', 'brunch', 'buffet', 'chef', 'cuisinier', 'gastronomie', 'mets', 'service', 'réservation', 'table', 'terrasse', 'livraison', 'à emporter', 'fast-food', 'snack', 'brasserie', 'bistrot', 'pizzeria', 'boulangerie', 'pâtisserie'] },
    { value: 'electronique', label: 'Électronique & High-Tech', icon: '⚡', color: '#00BCD4', description: 'Appareils électroniques, gadgets, accessoires tech', keywords: ['électronique', 'high-tech', 'technologie', 'gadget', 'appareil', 'accessoire', 'tech', 'numérique', 'digital', 'connecté', 'smart', 'intelligent', 'console', 'PlayStation', 'Xbox', 'Nintendo', 'drone', 'caméra', 'GoPro', 'stabilisateur', 'microphone', 'audio', 'vidéo', 'streaming', 'gaming', 'esport'] },
    { value: 'musique_instruments', label: 'Musique & Instruments', icon: '🎸', color: '#9C27B0', description: 'Instruments de musique, équipements audio, accessoires', keywords: ['musique', 'instrument', 'musical', 'guitare', 'piano', 'clavier', 'synthétiseur', 'batterie', 'percussion', 'saxophone', 'trompette', 'violon', 'flûte', 'harmonica', 'accordéon', 'djembé', 'tam-tam', 'balafon', 'kora', 'ampli', 'amplificateur', 'enceinte', 'micro', 'table de mixage', 'sono', 'sonorisation', 'studio', 'enregistrement'] },
    { value: 'formation_education', label: 'Formation & Éducation', icon: '🎓', color: '#7C3AED', description: 'Cours, formations, coaching, enseignement', keywords: ['formation', 'éducation', 'cours', 'leçon', 'enseignement', 'apprentissage', 'école', 'académie', 'institut', 'centre de formation', 'coaching', 'tutorat', 'soutien scolaire', 'répétition', 'professeur', 'enseignant', 'formateur', 'instructeur', 'mentor', 'coach', 'certification', 'diplôme', 'stage', 'atelier', 'séminaire', 'workshop', 'webinaire', 'e-learning', 'en ligne', 'langue', 'informatique', 'bureautique', 'management'] },
    { value: 'evenementiel', label: 'Événementiel & Organisation', icon: '🎉', color: '#EC4899', description: 'Organisation d\'événements, mariages, fêtes, célébrations', keywords: ['événement', 'évènement', 'organisation', 'mariage', 'fête', 'anniversaire', 'baptême', 'communion', 'célébration', 'cérémonie', 'réception', 'soirée', 'gala', 'conférence', 'séminaire', 'salon', 'exposition', 'concert', 'spectacle', 'animation', 'DJ', 'sono', 'décoration', 'traiteur', 'location', 'salle', 'tente', 'chapiteau', 'wedding planner', 'organisateur'] },
    { value: 'agriculture', label: 'Agriculture & Élevage', icon: '🌱', color: '#10B981', description: 'Produits agricoles, élevage, matériel agricole', keywords: ['agriculture', 'agricole', 'ferme', 'exploitation', 'élevage', 'culture', 'plantation', 'récolte', 'moisson', 'semence', 'graine', 'engrais', 'pesticide', 'herbicide', 'tracteur', 'charrue', 'moissonneuse', 'batteuse', 'irrigation', 'arrosage', 'serre', 'pépinière', 'maraîchage', 'légume', 'fruit', 'céréale', 'maïs', 'riz', 'mil', 'sorgho', 'manioc', 'bétail', 'vache', 'bœuf', 'mouton', 'chèvre', 'porc', 'volaille', 'poulet', 'canard', 'lapin'] },
    { value: 'sport_fitness', label: 'Sport & Fitness', icon: '💪', color: '#EF4444', description: 'Salles de sport, coaching, équipements sportifs', keywords: ['sport', 'fitness', 'gym', 'salle de sport', 'musculation', 'cardio', 'crossfit', 'yoga', 'pilates', 'zumba', 'danse', 'aerobic', 'spinning', 'cycling', 'running', 'course', 'jogging', 'marathon', 'natation', 'piscine', 'aquagym', 'tennis', 'foot', 'football', 'basketball', 'volleyball', 'handball', 'rugby', 'boxe', 'MMA', 'arts martiaux', 'karaté', 'judo', 'taekwondo', 'coach sportif', 'personal trainer', 'entraîneur', 'préparateur physique', 'nutrition', 'diététique'] },
    { value: 'bien_etre_spa', label: 'Bien-être & Spa', icon: '🧘', color: '#14B8A6', description: 'Spa, massage, relaxation, soins bien-être', keywords: ['bien-être', 'spa', 'massage', 'relaxation', 'détente', 'soin', 'hammam', 'sauna', 'jacuzzi', 'balnéothérapie', 'thalasso', 'aromathérapie', 'réflexologie', 'shiatsu', 'ayurveda', 'thai', 'suédois', 'californien', 'pierre chaude', 'huile', 'gommage', 'enveloppement', 'modelage', 'drainage lymphatique', 'méditation', 'yoga', 'sophrologie', 'hypnose', 'reiki', 'énergétique'] },
    { value: 'nettoyage_entretien', label: 'Nettoyage & Entretien', icon: '🧹', color: '#6B7280', description: 'Services de nettoyage, ménage, entretien', keywords: ['nettoyage', 'ménage', 'entretien', 'propreté', 'nettoyeur', 'femme de ménage', 'homme de ménage', 'agent d\'entretien', 'société de nettoyage', 'lavage', 'dépoussiérage', 'aspirateur', 'balai', 'serpillière', 'désinfection', 'décontamination', 'vitre', 'carrelage', 'moquette', 'tapis', 'canapé', 'bureaux', 'locaux', 'immeuble', 'copropriété', 'commercial', 'industriel', 'après chantier', 'fin de chantier'] },
    { value: 'jardinage_paysagisme', label: 'Jardinage & Paysagisme', icon: '🌳', color: '#059669', description: 'Entretien jardins, création espaces verts, paysagiste', keywords: ['jardinage', 'jardin', 'paysagisme', 'paysagiste', 'espaces verts', 'entretien', 'création', 'aménagement', 'plantation', 'arbre', 'arbuste', 'fleur', 'plante', 'pelouse', 'gazon', 'tonte', 'taille', 'élagage', 'débroussaillage', 'arrosage', 'irrigation', 'clôture', 'haie', 'allée', 'terrasse', 'pergola', 'potager', 'verger', 'compost', 'engrais', 'tondeuse', 'taille-haie', 'tronçonneuse'] },
    { value: 'securite_surveillance', label: 'Sécurité & Surveillance', icon: '🛡️', color: '#DC2626', description: 'Agents de sécurité, gardiennage, vidéosurveillance', keywords: ['sécurité', 'surveillance', 'gardiennage', 'agent de sécurité', 'vigile', 'garde', 'protection', 'sûreté', 'ronde', 'patrouille', 'contrôle', 'accès', 'badge', 'portique', 'caméra', 'vidéosurveillance', 'CCTV', 'alarme', 'détecteur', 'sirène', 'télésurveillance', 'centrale', 'digicode', 'interphone', 'portail', 'barrière', 'gardien', 'concierge', 'veilleur', 'nuit', 'événement', 'magasin', 'entreprise', 'chantier'] },
    { value: 'plomberie', label: 'Plomberie & Sanitaire', icon: '🚰', color: '#00BCD4', description: 'Installation, réparation, dépannage plomberie', keywords: ['plomberie', 'plombier', 'sanitaire', 'eau', 'canalisation', 'tuyauterie', 'robinetterie', 'robinet', 'fuite', 'débouchage', 'dégorgement', 'évier', 'lavabo', 'douche', 'baignoire', 'WC', 'toilette', 'chauffe-eau', 'ballon', 'cumulus', 'chaudière', 'installation', 'réparation', 'dépannage', 'urgence', 'tuyau', 'PVC', 'cuivre', 'joint', 'siphon', 'vidange', 'évacuation', 'raccord'] },
    { value: 'menuiserie', label: 'Menuiserie & Ébénisterie', icon: '🪵', color: '#F97316', description: 'Fabrication, pose, réparation bois et meubles', keywords: ['menuiserie', 'menuisier', 'ébénisterie', 'ébéniste', 'bois', 'boiserie', 'charpente', 'charpentier', 'parquet', 'plancher', 'lambris', 'porte', 'fenêtre', 'volet', 'portail', 'portillon', 'clôture', 'pergola', 'terrasse', 'deck', 'escalier', 'garde-corps', 'rambarde', 'placard', 'dressing', 'bibliothèque', 'meuble', 'sur mesure', 'fabrication', 'pose', 'installation', 'réparation', 'restauration', 'rénovation', 'agencement', 'aménagement'] },
    { value: 'animaux_veterinaire', label: 'Animaux & Vétérinaire', icon: '🐾', color: '#FF69B4', description: 'Vétérinaires, toilettage, dressage, accessoires animaux', keywords: ['animal', 'animaux', 'vétérinaire', 'véto', 'clinique vétérinaire', 'soin', 'consultation', 'vaccination', 'stérilisation', 'castration', 'vermifuge', 'antiparasitaire', 'urgence', 'chirurgie', 'toilettage', 'toiletteur', 'coupe', 'lavage', 'brushing', 'chien', 'chat', 'chiot', 'chaton', 'oiseau', 'lapin', 'rongeur', 'reptile', 'dressage', 'éducation', 'comportementaliste', 'pension', 'garde', 'promenade', 'dog sitter', 'accessoire', 'collier', 'laisse', 'gamelle', 'cage', 'niche', 'litière', 'jouet', 'nourriture', 'croquette', 'pâtée'] },
    { value: 'autre', label: 'Autres Produits', icon: '📦', color: '#6B7280', description: 'Autres types de produits et services', keywords: ['autre', 'divers', 'varié', 'mixte', 'général', 'non classé', 'produit', 'service', 'article', 'objet'] },
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

    agroalimentaire: `Nom,Prix,Devise,Description,Type,Marque,Format,Origine,Certification,Conservation
Riz parfumé Royal 5kg,6500,XAF,Riz parfumé thaï long grain qualité premium,Riz et céréales,Uncle Ben's,5kg,Thaïlande,Sans OGM,Température ambiante
Huile d'arachide pure 5L,8500,XAF,Huile arachide raffinée 100% naturelle cuisine,Huile alimentaire,Dinor,5L,Cameroun,Locale,Au sec
Spaghetti pâtes italiennes 500g,1200,XAF,Pâtes de semoule blé dur cuisson parfaite,Pâtes alimentaires,Barilla,500g,Italie,Bio,Température ambiante
Farine de blé T55 1kg,850,XAF,Farine blé qualité supérieure pâtisserie pain,Farine,Dovv,1kg,France,Agriculture biologique,Au sec
Sauce tomate concentrée 210g,450,XAF,Concentré tomate double qualité cuisines sauces,Sauces et condiments,Heinz,210g,Europe,Halal,Réfrigéré après ouverture
Café soluble premium 200g,3500,XAF,Café soluble arôme intense sans sucre,Café et thé,Nescafé,200g,Brésil,Commerce équitable,À l'abri de la lumière
Lait en poudre instantané 400g,4200,XAF,Lait poudre entier enrichi vitamines minéraux,Produits laitiers transformés,Nido,400g,Europe,Sans lactose,Au frais
Sardines à l'huile 125g,650,XAF,Sardines entières huile végétale qualité,Conserves,Pêcheur d'Armor,125g,Maroc,Halal,Température ambiante
Sucre cristallisé blanc 1kg,1200,XAF,Sucre cristal blanc pur canne raffiné,Sucre et édulcorants,Sosucam,1kg,Cameroun,Locale,Au sec
Bouillon cube poulet 100g,500,XAF,Cubes bouillon saveur poulet cuisine africaine,Condiments,Maggi,100g,Afrique de l'Ouest,Halal,Température ambiante`,

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
Produit 2,20000,XAF,Description complète du produit 2 et ses avantages`,

    restauration: `Nom,Prix,Devise,Description,Type cuisine,Spécialités,Services,Ambiance,Gamme prix,Capacité,Horaires,Localisation
Restaurant Le Palais,0,XAF,Restaurant gastronomique africain avec terrasse,Africaine,Ndolé|Poulet DG|Eru,Sur place|À emporter|Livraison,Familiale,Moyen,100,11:00-23:00,Bonanjo Douala
Café Beaulieu,0,XAF,Café moderne avec wifi et snacks,Café,Sandwiches|Salades|Pâtisseries,Sur place|À emporter,Calme,Économique,30,07:00-20:00,Akwa Douala
Traiteur Excellence,15000,XAF,Service traiteur pour événements professionnels,Internationale,Buffet|Cocktail|Menu personnalisé,Livraison|Service|Matériel,Professionnel,Premium,500,Sur réservation,Bonapriso Douala`,

    electronique: `Nom,Prix,Devise,Description,Type,Marque,Modèle,État,Garantie,Connectivités
Console PlayStation 5,350000,XAF,Console nouvelle génération 4K 120fps avec manette,Console de jeux,Sony,PS5 Standard,Neuf,2 ans,Wi-Fi|Bluetooth|USB-C
Drone DJI Mini 3,285000,XAF,Drone compact caméra 4K stabilisée avec télécommande,Drone,DJI,Mini 3 Pro,Neuf,1 an,Wi-Fi|Bluetooth
Caméra GoPro Hero11,180000,XAF,Caméra action étanche 5.3K hypersmooth,Caméra action,GoPro,Hero 11 Black,Neuf,1 an,Wi-Fi|Bluetooth|USB-C`,

    musique_instruments: `Nom,Prix,Devise,Description,Type,Marque,Modèle,État,Niveau,Accessoires
Guitare acoustique Yamaha,85000,XAF,Guitare folk corps épicéa sonorité riche et chaude,Guitare acoustique,Yamaha,F310,Neuf,Débutant,Housse|Accordeur|Médiators
Piano numérique Casio,180000,XAF,Piano 88 touches toucher lourd sons réalistes,Piano numérique,Casio,CDP-S110,Neuf,Intermédiaire,Pédale sustain|Stand|Casque
Djembé artisanal,35000,XAF,Djembé fait main peau chèvre sculpture bois,Percussion africaine,Artisanal,Traditionnel,Neuf,Tous,Housse de protection
Balafon professionnel,250000,XAF,Balafon 21 lames bois de rose avec résonateurs,Instrument traditionnel,Artisanal,21 lames,Neuf,Avancé,Support|Mailloches`,

    formation_education: `Nom,Prix,Devise,Description,Type,Niveau,Mode,Matières,Durée,Certification,Horaires
Formation Développement Web,150000,XAF,Formation complète HTML CSS JavaScript React avec projets,Formation professionnelle,Débutant,Présentiel,HTML|CSS|JavaScript|React,3 mois,Attestation,Lun-Ven 18:00-21:00
Cours d'Anglais intensif,75000,XAF,Cours anglais conversation et grammaire tous niveaux,Cours de langue,Intermédiaire,Présentiel,Anglais,2 mois,Certificat Cambridge,Mar-Jeu 17:00-19:00
Soutien scolaire Mathématiques,25000,XAF,Aide aux devoirs et révisions programme officiel,Soutien scolaire,Secondaire,À domicile,Mathématiques,1 mois,Non,Flexible selon élève
Coaching Business,200000,XAF,Accompagnement création entreprise de A à Z,Coaching professionnel,Professionnel,En ligne,Management|Finance|Marketing,6 mois,Certification coaching,Flexible en ligne`,

    evenementiel: `Nom,Prix,Devise,Description,Type,Services,Capacité,Tarif,Localisation,Disponibilité
Organisation Mariage Complet,2500000,XAF,Organisation mariage clé en main tout inclus avec coordinateur,Mariage,Décoration|Traiteur|Animation|Photos|Sono|Vidéo,300,Premium,Douala et environs,Sur réservation
Animation Anniversaire Enfant,75000,XAF,Animation complète avec jeux gonflables et cadeaux,Anniversaire enfant,Animation|Décoration|Gâteau|Cadeaux,30,Standard,Douala,Week-ends disponibles
Location Salle Réception,150000,XAF,Salle climatisée équipée avec parking gardé,Location salle,Salle|Chaises|Tables|Sono|Éclairage,200,Moyen,Bonapriso Douala,Selon disponibilité
DJ Professionnel Soirée,100000,XAF,Prestation DJ avec sono professionnelle et lumières,Animation DJ,Sono|Lumières|Mixage|Ambiance,500,Standard,Douala et région,Selon événement`,

    agriculture: `Nom,Prix,Devise,Description,Type,Culture,Saison,Unité vente,Certifications,Localisation
Semences Maïs hybride,15000,XAF,Semences maïs rendement élevé résistant sécheresse,Semences,Maïs,Toutes saisons,Sac 25kg,Certifiées MINADER,Bafoussam
Engrais NPK 20-10-10,35000,XAF,Engrais complet cultures céréales et maraîchères,Engrais chimique,Céréales|Maraîchage,Toutes saisons,Sac 50kg,Agréé ministère,Douala
Tracteur 75CV occasion,8500000,XAF,Tracteur agricole bon état révision récente avec outils,Matériel agricole,Toutes cultures,Toutes saisons,Unité,Contrôle technique,Bafoussam
Poulets de chair 1 mois,3500,XAF,Poulets vaccinés nourris grain qualité fermière,Élevage volaille,Volaille,Toutes saisons,Pièce,Contrôle vétérinaire,Dschang`,

    sport_fitness: `Nom,Prix,Devise,Description,Type,Niveau,Durée,Équipements,Tarif,Horaires
Abonnement Salle Sport,25000,XAF,Accès illimité musculation cardio avec vestiaires,Abonnement salle,Tous niveaux,1 mois,Fournis et modernes,Standard,06:00-22:00
Cours Yoga collectif,15000,XAF,Séances yoga débutant 2 fois par semaine avec prof certifié,Cours collectif,Débutant,1 mois,Tapis fourni,Économique,Mar-Jeu 18:00-19:30
Coach Sportif Personnel,50000,XAF,Coaching personnalisé avec programme nutrition,Coaching individuel,Tous niveaux,1 mois,Fournis selon objectifs,Premium,Flexible sur RDV
Cours Zumba Fitness,10000,XAF,Cours collectif danse fitness ambiance latine,Cours collectif,Tous niveaux,1 mois,Non requis,Économique,Lun-Mer-Ven 19:00-20:00`,

    bien_etre_spa: `Nom,Prix,Devise,Description,Type,Services,Durée,Tarif,Horaires
Massage Relaxant,25000,XAF,Massage corps entier huiles essentielles aromathérapie,Massage,Massage suédois relaxant,60 min,Standard,10:00-20:00
Spa Journée Complète,85000,XAF,Hammam sauna jacuzzi massage gommage et thé,Forfait spa,Hammam|Sauna|Jacuzzi|Massage|Gommage,4h,Premium,09:00-18:00
Soin Visage Hydratant,18000,XAF,Soin visage nettoyage hydratation masque et sérum,Soin visage,Nettoyage|Hydratation|Masque,45 min,Standard,10:00-19:00
Réflexologie Plantaire,20000,XAF,Massage pieds points énergétiques relaxation profonde,Réflexologie,Plantaire énergétique,45 min,Standard,10:00-20:00`,

    nettoyage_entretien: `Nom,Prix,Devise,Description,Type,Fréquence,Surface,Équipements,Tarif
Ménage Appartement,15000,XAF,Nettoyage complet appartement avec matériel professionnel,Ménage résidentiel,Hebdomadaire,100m²,Fournis et écologiques,Standard
Nettoyage Bureaux,50000,XAF,Entretien bureaux sanitaires et espaces communs,Nettoyage commercial,Quotidien,200m²,Fournis professionnels,Professionnel
Lavage Vitres,8000,XAF,Nettoyage vitres intérieur extérieur sans traces,Lavage vitres,Mensuel,50m²,Fournis spécialisés,Standard
Nettoyage Fin Chantier,150000,XAF,Nettoyage après travaux dépoussièrage évacuation,Nettoyage chantier,Ponctuel,300m²,Fournis industriels,Premium`,

    jardinage_paysagisme: `Nom,Prix,Devise,Description,Type,Saison,Surface,Services,Tarif
Tonte Pelouse,8000,XAF,Tonte et ramassage gazon avec matériel professionnel,Tonte,Toutes,100m²,Tonte|Ramassage|Évacuation,Standard
Élagage Arbres,25000,XAF,Taille et élagage arbres arbustes avec sécurité,Élagage,Toutes,N/A,Taille|Ramassage|Évacuation déchets,Standard
Création Jardin Paysager,350000,XAF,Conception et réalisation jardin paysager sur mesure,Paysagisme,Printemps-Été,200m²,Conception|Plantation|Arrosage|Engazonnement,Premium
Entretien Jardin Mensuel,15000,XAF,Entretien jardin mensuel tonte taille arrosage,Entretien,Toutes,150m²,Tonte|Taille|Arrosage|Désherbage,Standard`,

    securite_surveillance: `Nom,Prix,Devise,Description,Type,Zone,Durée,Équipements,Tarif
Agent Sécurité Nuit,75000,XAF,Garde nuit professionnel formation avec badge,Gardiennage,Résidentiel,12h par nuit,Radio|Lampe|Badge,Standard
Vidéosurveillance 8 caméras,850000,XAF,Installation système 8 caméras IP avec enregistrement,Vidéosurveillance,Commercial,Installation complète,Caméras IP|DVR|Câbles|Écran,Premium
Ronde Sécurité Entreprise,50000,XAF,Ronde périodique vérification accès avec rapport,Patrouille,Entreprise,Mensuel,Badge|Rapport détaillé,Standard
Télésurveillance 24h/24,45000,XAF,Monitoring centre surveillance avec intervention rapide,Télésurveillance,Résidentiel,Mensuel,Centrale|Détecteurs|Sirène,Standard`,

    plomberie: `Nom,Prix,Devise,Description,Type,Puissance,Garantie,Matériaux,Urgence
Installation Chauffe-eau,85000,XAF,Pose chauffe-eau électrique 150L avec raccordement,Installation,150L,1 an,Cuivre|PVC|Flexibles,Non
Débouchage Canalisation,15000,XAF,Débouchage évier lavabo WC avec équipement professionnel,Dépannage,N/A,Non,Flexible spécialisé,Oui disponible
Réparation Fuite Eau,25000,XAF,Détection et réparation fuite eau avec garantie,Réparation,N/A,6 mois,Selon type fuite,Oui intervention rapide
Rénovation Salle Bain,450000,XAF,Rénovation complète plomberie sanitaire avec finitions,Rénovation,N/A,2 ans,Cuivre|PVC|Céramique,Non sur devis`,

    menuiserie: `Nom,Prix,Devise,Description,Type,Bois,Finition,Style,Dimensions,Délai
Porte Intérieure Bois,75000,XAF,Porte bois massif finition vernie avec serrure,Porte,Acajou,Vernie brillante,Classique,210x80x4cm,2 semaines
Fenêtre Double Vitrage,150000,XAF,Fenêtre bois double vitrage isolation thermique,Fenêtre,Chêne,Peinte blanche,Moderne,120x140cm,3 semaines
Placard Sur Mesure,250000,XAF,Placard bois avec étagères penderie et tiroirs,Placard,Contreplaqué,Mélaminé chêne,Moderne,200x60x240cm,4 semaines
Escalier Bois Massif,850000,XAF,Escalier sur mesure avec rampe et contre-marches,Escalier,Iroko,Vernie mate,Classique,Variable selon hauteur,6 semaines`,

    animaux_veterinaire: `Nom,Prix,Devise,Description,Type animal,Race,Services vétérinaire,Tarif
Consultation Vétérinaire,15000,XAF,Examen clinique complet avec conseil personnalisé,Chien|Chat,Toutes races,Consultation générale,Standard
Vaccination Antirabique,8000,XAF,Vaccin antirabique avec carnet de santé,Chien,Toutes races,Vaccination,Standard
Toilettage Canin Complet,18000,XAF,Bain coupe brushing coupe griffes nettoyage oreilles,Chien,Toutes races,Toilettage professionnel,Standard
Garde Pension Animaux,5000,XAF,Pension journalière alimentation soins et promenade,Chien|Chat,Toutes races,Pension,Standard par jour
Stérilisation Chat,25000,XAF,Opération stérilisation avec suivi post-opératoire,Chat,Toutes races,Chirurgie,Standard`,

    electricite: `Nom,Prix,Devise,Description,Type,Puissance,Garantie,Certifications,Urgence
Installation Tableau Électrique,150000,XAF,Pose tableau disjoncteurs différentiels aux normes,Installation,Monophasé 220V,2 ans,Conforme NF C15-100,Non
Dépannage Électrique Urgent,25000,XAF,Intervention rapide panne électrique diagnostic gratuit,Dépannage,N/A,Non,N/A,Oui 24h/24
Mise aux Normes Électriques,350000,XAF,Rénovation installation électrique complète maison,Rénovation,Triphasé 380V,5 ans,Conforme NF C15-100,Non sur devis
Installation Éclairage LED,45000,XAF,Installation spots LED économiques avec variateur,Installation,12W par spot,3 ans,CE|RoHS,Non`
};

const ProductManagerMobile: React.FC<ProductManagerMobileProps> = ({
    products,
    onProductsChange,
    readonly = false,
    titreService,
    descriptionService,
    categoryService,
    onDuplicate
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedType, setSelectedType] = useState<ProductType | null>(null);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState<'type' | 'form'>('type');
    const [showSeatSelector, setShowSeatSelector] = useState(false);
    const [searchQuery, setSearchQuery] = useState(''); // Recherche textuelle dans dropdown
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPSLocation, setSelectedGPSLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [showDuplicationModal, setShowDuplicationModal] = useState(false);
    const [productToDuplicate, setProductToDuplicate] = useState<Product | null>(null);

    const [newProduct, setNewProduct] = useState<Partial<Product>>({
        type: 'autre',
        nom: '',
        prix: '',
        devise: 'XAF',
        description: '',
        images: [],
        videos: []
    });

    // ✅ NOUVEAU: Détection automatique du type de produit depuis la catégorie du service
    React.useEffect(() => {
        if (categoryService && !selectedType) {
            const { detectProductTypeFromCategory } = require('../utils/productCategoryMapper');
            const detectedType = detectProductTypeFromCategory(categoryService);
            console.log('[ProductManagerMobile] Type auto-détecté depuis catégorie:', detectedType, 'pour', categoryService);
            setSelectedType(detectedType);
            setCurrentStep('form'); // ✅ CORRECTION: Ouvrir automatiquement le formulaire
        } else if (products.length > 0 && !selectedType) {
            // Si pas de catégorie mais des produits existants, détecter depuis le premier produit
            const { detectProductTypeFromProduct } = require('../utils/productCategoryMapper');
            const detectedType = detectProductTypeFromProduct(products[0]);
            console.log('[ProductManagerMobile] Type auto-détecté depuis produit:', detectedType);
            setSelectedType(detectedType);
            setCurrentStep('form'); // ✅ CORRECTION: Ouvrir automatiquement le formulaire
        }
    }, [categoryService, products.length]);

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
            restauration: 'Nom du restaurant',
            sport_fitness: 'Titre de l\'activité',
            formation_education: 'Titre de la formation',
            evenementiel: 'Titre de l\'événement',
            electricite: 'Nom du produit électrique',
            plomberie: 'Titre de la prestation',
            menuiserie: 'Titre de la prestation',
            jardinage_paysagisme: 'Titre de la prestation',
            securite_surveillance: 'Titre du service',
            animaux_veterinaire: 'Nom de l\'animal / Service',
            nettoyage_entretien: 'Titre du service',
            bien_etre_spa: 'Titre du soin',
            agroalimentaire: 'Nom du produit',
            agriculture: 'Nom du produit agricole',
            electronique: 'Nom de l\'appareil',
            musique_instruments: 'Nom de l\'instrument',
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
            restauration: 'Ex: Restaurant Le Beau Jardin',
            sport_fitness: 'Ex: Cours de Yoga débutant',
            formation_education: 'Ex: Formation Excel avancé',
            evenementiel: 'Ex: Organisation mariage complet',
            electricite: 'Ex: Câble électrique 2.5mm',
            plomberie: 'Ex: Installation chauffe-eau',
            menuiserie: 'Ex: Porte sur mesure en chêne',
            jardinage_paysagisme: 'Ex: Tonte pelouse et entretien',
            securite_surveillance: 'Ex: Gardiennage 24h/24',
            animaux_veterinaire: 'Ex: Rex - Labrador 5 ans',
            nettoyage_entretien: 'Ex: Nettoyage bureau hebdomadaire',
            bien_etre_spa: 'Ex: Massage relaxant 1h',
            agroalimentaire: 'Ex: Riz parfumé 25kg',
            agriculture: 'Ex: Semences maïs hybride',
            electronique: 'Ex: Console PlayStation 5',
            musique_instruments: 'Ex: Guitare Yamaha acoustique',
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

            // ✅ CORRECTION: Limite réduite à 5 images max pour éviter erreur 413
            const currentImagesCount = (newProduct.images || []).length;
            if (currentImagesCount >= 5) {
                Alert.alert(
                    'Limite atteinte',
                    '📸 Maximum 5 images par produit pour optimiser la vitesse d\'envoi.\n\n💡 Astuce : Choisissez les 5 meilleures photos de votre produit !',
                    [{ text: 'OK' }]
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.3, // ✅ Qualité réduite à 30% pour éviter erreur 413
                base64: false // ✅ Ne pas utiliser base64 de l'ImagePicker
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                // ✅ Limiter le nombre total d'images à 5
                const remainingSlots = 5 - currentImagesCount;
                const assetsToAdd = result.assets.slice(0, remainingSlots);

                if (result.assets.length > remainingSlots) {
                    Alert.alert(
                        'Images limitées',
                        `📸 Seulement ${remainingSlots} image(s) ajoutée(s).\n\nMaximum 5 images par produit pour optimiser l'envoi.`,
                        [{ text: 'OK' }]
                    );
                }

                // ✅ NOUVEAU : Compression AGRESSIVE et redimensionnement des images
                const compressedImages = await Promise.all(
                    assetsToAdd.map(async (asset) => {
                        try {
                            // ✅ OPTIMISATION ÉQUILIBRÉE: Balance qualité/taille
                            const manipulatedImage = await manipulateAsync(
                                asset.uri,
                                [{ resize: { width: 1024 } }], // 1024px = bon compromis pour affichage mobile
                                { compress: 0.5, format: SaveFormat.JPEG, base64: true } // 50% = Qualité acceptable avec taille réduite
                            );

                            // Calculer la taille de l'image compressée
                            const imageSizeKB = (manipulatedImage.base64!.length * 3) / 4 / 1024;
                            console.log(`[ProductManager] Image compressée: ${imageSizeKB.toFixed(2)} KB (1024px, JPEG 50%)`);

                            return `data:image/jpeg;base64,${manipulatedImage.base64}`;
                        } catch (error) {
                            console.error('Erreur compression image:', error);
                            // En cas d'erreur, retourner null pour filtrer ensuite
                            return null;
                        }
                    })
                );

                // Filtrer les images null (erreurs)
                const validImages = compressedImages.filter(img => img !== null) as string[];

                if (validImages.length === 0) {
                    Alert.alert('Erreur', 'Impossible de compresser les images. Veuillez réessayer.');
                    return;
                }

                setNewProduct({
                    ...newProduct,
                    images: [...(newProduct.images || []), ...validImages]
                });

                // Afficher message de succès avec info compression
                Alert.alert(
                    'Images ajoutées',
                    `${validImages.length} image(s) ajoutée(s) et compressées pour optimiser l'envoi.`,
                    [{ text: 'OK' }]
                );
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

            // ✅ CORRECTION: Limite réduite à 2 vidéos max pour éviter erreur 413
            const currentVideosCount = (newProduct.videos || []).length;
            if (currentVideosCount >= 2) {
                Alert.alert(
                    'Limite atteinte',
                    '🎥 Maximum 2 vidéos par produit pour optimiser l\'envoi.\n\n💡 Astuces :\n- Max 15 secondes par vidéo\n- Filmez en qualité moyenne\n- Privilégiez les vidéos essentielles',
                    [{ text: 'OK' }]
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsMultipleSelection: false,
                quality: 0.5, // ✅ Qualité 50% = Bon compromis visuel/taille
                videoMaxDuration: 20 // ✅ 20 secondes = Temps suffisant pour démonstration produit
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];

                // ✅ CORRECTION: Taille max réduite à 5MB pour éviter erreur 413
                const fileInfo = await FileSystem.getInfoAsync(asset.uri);
                let videoSizeMB = 0;

                if (fileInfo.exists && 'size' in fileInfo && fileInfo.size) {
                    videoSizeMB = fileInfo.size / (1024 * 1024);
                    if (videoSizeMB > 5) {
                        Alert.alert(
                            'Vidéo trop volumineuse',
                            `📹 La vidéo fait ${videoSizeMB.toFixed(2)} MB.\n\n⚠️ Maximum : 5 MB et 15 secondes\n\n💡 Solutions :\n- Réduire la résolution (720p ou moins)\n- Raccourcir la vidéo (max 15s)\n- Filmer en qualité moyenne`,
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

                    const remainingVideos = 2 - (newProduct.videos?.length || 0) - 1;
                    Alert.alert(
                        'Vidéo ajoutée',
                        `✅ Vidéo ajoutée${videoSizeMB > 0 ? ` (${videoSizeMB.toFixed(2)} MB)` : ''}\n\n📹 ${remainingVideos > 0 ? `Vous pouvez encore ajouter ${remainingVideos} vidéo.` : 'Limite atteinte : 2 vidéos max'}`,
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
                                marqueAutomobile: columns[4],
                                modeleAutomobile: columns[5],
                                annee: columns[6],
                                kilometrage: columns[7],
                                couleurAutomobile: columns[8],
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
                                matiereVetement: columns[6],
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
                                etatElectro: columns[7],
                                garantieElectro: columns[8]
                            } as Product;
                            break;

                        case 'decoration':
                            specificProduct = {
                                ...baseProduct,
                                typeDecoration: columns[4],
                                styleDecoration: columns[5],
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
                                materiauMobilier: columns[5],
                                dimensionsMobilier: columns[6],
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

                        case 'agroalimentaire':
                            specificProduct = {
                                ...baseProduct,
                                typeAgro: columns[4],
                                marqueAgro: columns[5],
                                formatAgro: columns[6],
                                origine: columns[7],
                                certification: columns[8],
                                modeConservation: columns[9]
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

                        // ✅ NOUVELLES CATÉGORIES - Versions Excel
                        case 'restauration':
                            specificProduct = {
                                ...baseProduct,
                                typeCuisine: columns[4],
                                specialites: columns[5]?.split('|').map(s => s.trim()).filter(s => s),
                                servicesRestau: columns[6]?.split('|').map(s => s.trim()).filter(s => s),
                                ambiance: columns[7],
                                gammePrix: columns[8],
                                capacite: columns[9],
                                horaires: columns[10],
                                localisationRestau: columns[11] // ✅ Corrigé : correspond à la colonne Excel
                            } as Product;
                            break;

                        case 'electronique':
                            specificProduct = {
                                ...baseProduct,
                                typeElectronique: columns[4],
                                marqueElectronique: columns[5],
                                modeleElectronique: columns[6],
                                etatElectronique: columns[7],
                                garantieElectronique: columns[8],
                                connectivites: columns[9]?.split('|').map(s => s.trim()).filter(s => s)
                            } as Product;
                            break;

                        case 'musique_instruments':
                            specificProduct = {
                                ...baseProduct,
                                typeInstrument: columns[4],
                                marqueInstrument: columns[5],
                                modeleInstrument: columns[6],
                                etatInstrument: columns[7],
                                niveauInstrument: columns[8],
                                accessoiresInstrument: columns[9]?.split('|').map(s => s.trim()).filter(s => s) // ✅ Ajouté
                            } as Product;
                            break;

                        case 'formation_education':
                            specificProduct = {
                                ...baseProduct,
                                typeFormation: columns[4],
                                niveauFormation: columns[5],
                                modeFormation: columns[6],
                                matieresFormation: columns[7]?.split('|').map(s => s.trim()).filter(s => s),
                                dureeFormation: columns[8],
                                certificationFormation: columns[9],
                                horairesFormation: columns[10] // ✅ Ajouté
                            } as Product;
                            break;

                        case 'evenementiel':
                            specificProduct = {
                                ...baseProduct,
                                typeEvenement: columns[4],
                                servicesEvenement: columns[5]?.split('|').map(s => s.trim()).filter(s => s),
                                capaciteEvenement: columns[6],
                                tarifEvenement: columns[7],
                                localisationEvenement: columns[8], // ✅ Ajouté
                                disponibiliteEvenement: columns[9] // ✅ Ajouté
                            } as Product;
                            break;

                        case 'agriculture':
                            specificProduct = {
                                ...baseProduct,
                                typeAgricole: columns[4],
                                culture: columns[5],
                                saisonAgricole: columns[6],
                                uniteVente: columns[7],
                                certificationsAgricole: columns[8]?.split('|').map(s => s.trim()).filter(s => s), // ✅ Corrigé : colonne 8
                                localisationAgricole: columns[9] // ✅ Corrigé : colonne 9
                            } as Product;
                            break;

                        case 'sport_fitness':
                            specificProduct = {
                                ...baseProduct,
                                typeSport: columns[4],
                                niveauSport: columns[5],
                                dureeSport: columns[6],
                                equipementsSport: columns[7]?.split('|').map(s => s.trim()).filter(s => s),
                                tarifSport: columns[8], // ✅ Ajouté
                                horairesSport: columns[9] // ✅ Ajouté
                            } as Product;
                            break;

                        case 'bien_etre_spa':
                            specificProduct = {
                                ...baseProduct,
                                typeBienEtre: columns[4],
                                servicesBienEtre: columns[5]?.split('|').map(s => s.trim()).filter(s => s),
                                dureeBienEtre: columns[6],
                                tarifBienEtre: columns[7],
                                horairesBienEtre: columns[8] // ✅ Ajouté
                            } as Product;
                            break;

                        case 'animaux_veterinaire':
                            specificProduct = {
                                ...baseProduct,
                                typeAnimal: columns[4],
                                raceAnimal: columns[5],
                                servicesVeterinaire: columns[6]?.split('|').map(s => s.trim()).filter(s => s), // ✅ Corrigé : colonne 6
                                tarifVeterinaire: columns[7] // ✅ Corrigé : colonne 7
                            } as Product;
                            break;

                        case 'nettoyage_entretien':
                            specificProduct = {
                                ...baseProduct,
                                typeNettoyage: columns[4],
                                frequenceNettoyage: columns[5],
                                surfaceNettoyage: columns[6],
                                equipementsNettoyage: columns[7]?.split('|').map(s => s.trim()).filter(s => s),
                                tarifNettoyage: columns[8] // ✅ Ajouté
                            } as Product;
                            break;

                        case 'jardinage_paysagisme':
                            specificProduct = {
                                ...baseProduct,
                                typeJardinage: columns[4],
                                saisonJardinage: columns[5],
                                surfaceJardinage: columns[6],
                                servicesJardinage: columns[7]?.split('|').map(s => s.trim()).filter(s => s),
                                tarifJardinage: columns[8] // ✅ Ajouté
                            } as Product;
                            break;

                        case 'securite_surveillance':
                            specificProduct = {
                                ...baseProduct,
                                typeSecurite: columns[4],
                                zoneSecurite: columns[5],
                                dureeSecurite: columns[6],
                                equipementsSecurite: columns[7]?.split('|').map(s => s.trim()).filter(s => s),
                                tarifSecurite: columns[8] // ✅ Ajouté
                            } as Product;
                            break;

                        case 'plomberie':
                            specificProduct = {
                                ...baseProduct,
                                typePlomberie: columns[4],
                                puissancePlomberie: columns[5], // ✅ Corrigé : Puissance au lieu d'urgence
                                garantiePlomberie: columns[6],
                                materiauxPlomberie: columns[7]?.split('|').map(s => s.trim()).filter(s => s),
                                urgencePlomberie: columns[8] // ✅ Corrigé : Urgence est en colonne 8
                            } as Product;
                            break;

                        case 'electricite':
                            specificProduct = {
                                ...baseProduct,
                                typeElectricite: columns[4],
                                puissanceElectricite: columns[5],
                                garantieElectricite: columns[6],
                                certificationsElectricite: columns[7]?.split('|').map(s => s.trim()).filter(s => s),
                                urgenceElectricite: columns[8] // ✅ Ajouté
                            } as Product;
                            break;

                        case 'menuiserie':
                            specificProduct = {
                                ...baseProduct,
                                typeMenuiserie: columns[4],
                                typeBois: columns[5],
                                finitionMenuiserie: columns[6],
                                styleMenuiserie: columns[7],
                                dimensionsMenuiserie: columns[8],
                                delaiMenuiserie: columns[9] // ✅ Ajouté
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

    // Fonction pour gérer la duplication de produit
    const handleDuplicateProduct = (product: Product) => {
        setProductToDuplicate(product);
        setShowDuplicationModal(true);
    };

    const handleConfirmDuplication = (duplicatedProduct: Product) => {
        // ✅ Si onDuplicate est fourni (depuis FormulaireYukpoIntelligent), l'utiliser
        if (onDuplicate) {
            onDuplicate(duplicatedProduct);
        } else {
            // Sinon, ajouter directement à la liste (comportement par défaut)
            const updatedProducts = [...products, duplicatedProduct];
            onProductsChange(updatedProducts);
        }
        setShowDuplicationModal(false);
        setProductToDuplicate(null);
    };

    const handleCancelDuplication = () => {
        setShowDuplicationModal(false);
        setProductToDuplicate(null);
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
            prix: typeof newProduct.prix === 'string' ? parseFloat(newProduct.prix) || 0 : newProduct.prix, // ✅ Convertir en nombre
            devise: newProduct.devise || 'XAF',
            description: newProduct.description,
            images: newProduct.images || [],
            videos: newProduct.videos || [],
            ...newProduct,
            // ✅ Assurer que tous les prix numériques sont bien des nombres
            prixParNuit: newProduct.prixParNuit ? (typeof newProduct.prixParNuit === 'string' ? parseFloat(newProduct.prixParNuit) || undefined : newProduct.prixParNuit) : undefined,
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
                        {/* Type et Statut sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type d'immobilier"
                                    value={newProduct.typeImmobilier || ''}
                                    productType="immobilier"
                                    fieldName="types"
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeImmobilier: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Statut"
                                    value={newProduct.statutImmobilier || ''}
                                    productType="immobilier"
                                    fieldName="statuts"
                                    onSelect={(value) => setNewProduct({ ...newProduct, statutImmobilier: value })}
                                    required
                                />
                            </View>
                        </View>

                        {/* Superficie et Ameublement sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Superficie (m²) <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: 120"
                                    value={newProduct.superficie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, superficie: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Ameublement"
                                    value={newProduct.ameublement || ''}
                                    productType="immobilier"
                                    fieldName="ameublement"
                                    onSelect={(value) => setNewProduct({ ...newProduct, ameublement: value })}
                                />
                            </View>
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
                        {/* Type et Statut sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de terrain"
                                    value={newProduct.typeImmobilier || ''}
                                    productType="immobilier"
                                    fieldName="types"
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeImmobilier: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Statut"
                                    value={newProduct.statutImmobilier || ''}
                                    productType="immobilier"
                                    fieldName="statuts"
                                    onSelect={(value) => setNewProduct({ ...newProduct, statutImmobilier: value })}
                                    required
                                />
                            </View>
                        </View>

                        {/* Superficie et Adresse sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Superficie (m²)</Text>
                                <NativeInput
                                    placeholder="Ex: 500"
                                    value={newProduct.superficie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, superficie: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Adresse</Text>
                                <NativeInput
                                    placeholder="Ex: Zone industrielle"
                                    value={newProduct.adresse || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, adresse: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
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
                        {/* Marque et Modèle sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    value={newProduct.marqueAutomobile || ''}
                                    productType="automobile"
                                    fieldName="marques"
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueAutomobile: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Modèle <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: Corolla"
                                    value={newProduct.modeleAutomobile || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modeleAutomobile: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* État et Couleur sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État du véhicule"
                                    value={newProduct.etatVehicule || ''}
                                    productType="automobile"
                                    fieldName="etat"
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatVehicule: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Couleur"
                                    value={newProduct.couleurAutomobile || ''}
                                    productType="automobile"
                                    fieldName="couleur"
                                    onSelect={(value) => setNewProduct({ ...newProduct, couleurAutomobile: value })}
                                />
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

                        {/* Carburant et Transmission sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Carburant"
                                    value={newProduct.typeCarburant || ''}
                                    productType="automobile"
                                    fieldName="carburant"
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeCarburant: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Transmission"
                                    value={newProduct.transmission || ''}
                                    productType="automobile"
                                    fieldName="transmission"
                                    onSelect={(value) => setNewProduct({ ...newProduct, transmission: value })}
                                    required
                                />
                            </View>
                        </View>
                    </>
                );

            case 'ticket_voyage':
                const busConfig = newProduct.busConfiguration || { 
                    rows: 12, 
                    seatsPerRow: 4, 
                    aislePosition: 2,
                    firstRowSeats: 2, // 2 ou 3 (chauffeur + passagers)
                    allSeatsAvailable: true // Par défaut toutes les places disponibles
                };
                
                // Calculer le nombre total de sièges (première rangée différente)
                const firstRowPassengerSeats = busConfig.firstRowSeats || 2;
                const totalSeats = firstRowPassengerSeats + (busConfig.rows - 1) * busConfig.seatsPerRow;
                
                // Générer le plan de sièges si pas déjà fait
                if (!newProduct.seatMap || newProduct.seatMap.length === 0) {
                    const seatMap = [];
                    let seatNumber = 1;
                    
                    for (let row = 1; row <= busConfig.rows; row++) {
                        const seatsInRow = row === 1 ? firstRowPassengerSeats : busConfig.seatsPerRow;
                        
                        for (let col = 1; col <= seatsInRow; col++) {
                            const isDriver = row === 1 && col === 1;
                            seatMap.push({
                                id: `${row}-${col}`,
                                number: isDriver ? 0 : seatNumber++, // Chauffeur = 0
                                row,
                                col,
                                status: isDriver ? 'occupied' : (busConfig.allSeatsAvailable ? 'available' : 'available'),
                                type: isDriver ? 'driver' : 'standard',
                                label: isDriver ? '🚗 Chauffeur' : undefined
                            });
                        }
                    }
                    if (newProduct.nom) { // Only update if product exists
                        newProduct.seatMap = seatMap;
                        newProduct.totalSeats = totalSeats - 1; // Moins le chauffeur
                    }
                }

                return (
                    <>
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                🚌 <Text style={styles.hintBold}>Système Pro de Réservation:</Text> Configurez votre bus, générez le plan des sièges et gérez les réservations en temps réel.
                            </Text>
                        </View>

                        {/* Compagnie et Type de véhicule */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Compagnie"
                                    fieldName="compagnies"
                                    productType="voyage"
                                    value={newProduct.compagnieTransport || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, compagnieTransport: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type véhicule"
                                    fieldName="vehicules"
                                    productType="voyage"
                                    value={newProduct.typeVehiculeTransport || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeVehiculeTransport: value })}
                                    required
                                />
                            </View>
                        </View>

                        {/* Configuration du Bus */}
                        <View style={styles.busConfigSection}>
                            <View style={styles.sectionHeaderWithIcon}>
                                <SafeIcon name="settings" size={20} color={modernColors.primary} />
                                <Text style={styles.sectionTitleMedium}>Configuration du Bus</Text>
                            </View>
                            
                            <View style={styles.fieldRow}>
                                <View style={[styles.fieldContainer, { flex: 1 }]}>
                                    <Text style={styles.fieldLabel}>Rangées <Text style={styles.required}>*</Text></Text>
                                    <NativeInput
                                        placeholder="12"
                                        value={busConfig.rows?.toString() || ''}
                                        onChangeText={(text) => {
                                            const rows = parseInt(text) || 0;
                                            setNewProduct({ 
                                                ...newProduct, 
                                                busConfiguration: { ...busConfig, rows },
                                                seatMap: [] // Reset seat map
                                            });
                                        }}
                                        style={styles.fieldInput}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={[styles.fieldContainer, { flex: 1 }]}>
                                    <Text style={styles.fieldLabel}>Sièges/rangée <Text style={styles.required}>*</Text></Text>
                                    <NativeInput
                                        placeholder="4"
                                        value={busConfig.seatsPerRow?.toString() || ''}
                                        onChangeText={(text) => {
                                            const seatsPerRow = parseInt(text) || 0;
                                            setNewProduct({ 
                                                ...newProduct, 
                                                busConfiguration: { ...busConfig, seatsPerRow },
                                                seatMap: [] // Reset seat map
                                            });
                                        }}
                                        style={styles.fieldInput}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            {/* Configuration première rangée */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>1ère rangée (Chauffeur + passagers) <Text style={styles.required}>*</Text></Text>
                                <View style={styles.busFirstRowOptions}>
                                    <TouchableOpacity
                                        style={[
                                            styles.busFirstRowButton,
                                            busConfig.firstRowSeats === 2 && styles.busFirstRowButtonActive
                                        ]}
                                        onPress={() => {
                                            setNewProduct({
                                                ...newProduct,
                                                busConfiguration: { ...busConfig, firstRowSeats: 2 },
                                                seatMap: []
                                            });
                                        }}
                                    >
                                        <SafeIcon 
                                            name="user" 
                                            size={18} 
                                            color={busConfig.firstRowSeats === 2 ? '#FFFFFF' : modernColors.primary} 
                                        />
                                        <Text style={[
                                            styles.busFirstRowButtonText,
                                            busConfig.firstRowSeats === 2 && styles.busFirstRowButtonTextActive
                                        ]}>
                                            2 places (1+1)
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.busFirstRowButton,
                                            busConfig.firstRowSeats === 3 && styles.busFirstRowButtonActive
                                        ]}
                                        onPress={() => {
                                            setNewProduct({
                                                ...newProduct,
                                                busConfiguration: { ...busConfig, firstRowSeats: 3 },
                                                seatMap: []
                                            });
                                        }}
                                    >
                                        <SafeIcon 
                                            name="users" 
                                            size={18} 
                                            color={busConfig.firstRowSeats === 3 ? '#FFFFFF' : modernColors.primary} 
                                        />
                                        <Text style={[
                                            styles.busFirstRowButtonText,
                                            busConfig.firstRowSeats === 3 && styles.busFirstRowButtonTextActive
                                        ]}>
                                            3 places (1+2)
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Option disponibilité */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>Disponibilité des places</Text>
                                <TouchableOpacity
                                    style={styles.availabilityToggle}
                                    onPress={() => {
                                        setNewProduct({
                                            ...newProduct,
                                            busConfiguration: { 
                                                ...busConfig, 
                                                allSeatsAvailable: !busConfig.allSeatsAvailable 
                                            },
                                            seatMap: []
                                        });
                                    }}
                                >
                                    <View style={[
                                        styles.toggleSwitch,
                                        busConfig.allSeatsAvailable && styles.toggleSwitchActive
                                    ]}>
                                        <View style={[
                                            styles.toggleThumb,
                                            busConfig.allSeatsAvailable && styles.toggleThumbActive
                                        ]} />
                                    </View>
                                    <Text style={styles.availabilityToggleText}>
                                        {busConfig.allSeatsAvailable 
                                            ? '✅ Toutes les places disponibles' 
                                            : '⚠️ Sélection manuelle requise'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.busConfigSummary}>
                                <SafeIcon name="info" size={16} color={modernColors.info} />
                                <Text style={styles.busConfigText}>
                                    Total: <Text style={styles.busConfigBold}>{totalSeats - 1} places passagers</Text>
                                    {' '}(+ 1 chauffeur)
                                </Text>
                            </View>

                            {/* Aperçu du plan de bus */}
                            {newProduct.seatMap && newProduct.seatMap.length > 0 && (
                                <View style={styles.busPreviewContainer}>
                                    <Text style={styles.busPreviewTitle}>📋 Aperçu du Plan</Text>
                                    <View style={styles.busLayout}>
                                        <View style={styles.busFront}>
                                            <SafeIcon name="navigation" size={16} color="#FFFFFF" />
                                            <Text style={styles.busFrontText}>Avant</Text>
                                        </View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            <View style={styles.busSeatsGrid}>
                                                {Array.from({ length: busConfig.rows }).map((_, rowIndex) => {
                                                    const seatsInRow = rowIndex === 0 ? firstRowPassengerSeats : busConfig.seatsPerRow;
                                                    return (
                                                        <View key={rowIndex} style={styles.busRow}>
                                                            <Text style={styles.rowNumber}>{rowIndex + 1}</Text>
                                                            {Array.from({ length: seatsInRow }).map((_, colIndex) => {
                                                                const isDriver = rowIndex === 0 && colIndex === 0;
                                                                const isAisle = !isDriver && colIndex === Math.floor(seatsInRow / 2);
                                                                const seat = newProduct.seatMap.find(s => s.row === rowIndex + 1 && s.col === colIndex + 1);
                                                                
                                                                return (
                                                                    <React.Fragment key={colIndex}>
                                                                        {isAisle && <View style={styles.busAisle} />}
                                                                        <View style={[
                                                                            styles.busSeatMini,
                                                                            isDriver && styles.busSeatDriver
                                                                        ]}>
                                                                            <Text style={[
                                                                                styles.busSeatNumber,
                                                                                isDriver && styles.busSeatDriverText
                                                                            ]}>
                                                                                {isDriver ? '🚗' : (seat?.number || '')}
                                                                            </Text>
                                                                        </View>
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </ScrollView>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Classe de voyage */}
                        <ProductFieldSelector
                            label="Classe"
                            fieldName="classes"
                            productType="voyage"
                            value={newProduct.classeVoyage || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, classeVoyage: value })}
                            required
                        />

                        {/* Trajet */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Départ <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Douala"
                                    value={newProduct.depart || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, depart: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Destination <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Yaoundé"
                                    value={newProduct.destination || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, destination: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* Date et Heure */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Date <Text style={styles.required}>*</Text></Text>
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

                        {/* Escales */}
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
                                ✅ <Text style={styles.hintBold}>Les clients pourront:</Text> Voir le plan du bus en temps réel, sélectionner leur place préférée, et réserver instantanément depuis ResultatBesoinScreen.
                            </Text>
                        </View>
                    </>
                );

            case 'hotellerie':
                return (
                    <>
                        {/* Type et Catégorie sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type d'hébergement"
                                    fieldName="types"
                                    productType="hotellerie"
                                    value={newProduct.typeHebergement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeHebergement: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Catégorie"
                                    fieldName="categories"
                                    productType="hotellerie"
                                    value={newProduct.categorieHotel || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, categorieHotel: value })}
                                    required
                                />
                            </View>
                        </View>

                        {/* Prix par nuit et Nombre de chambres sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Prix/nuit (min) <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: 35000"
                                    value={newProduct.prixParNuit || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, prixParNuit: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Nb chambres</Text>
                                <NativeInput
                                    placeholder="Ex: 25"
                                    value={newProduct.nbChambresHotel || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, nbChambresHotel: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Types de chambres disponibles */}
                        <ProductFieldSelector
                            label="Types de chambres disponibles"
                            fieldName="chambres"
                            productType="hotellerie"
                            value={newProduct.typesChambre || []}
                            onSelect={(value) => setNewProduct({ ...newProduct, typesChambre: value })}
                            multiSelect
                        />

                        {/* Équipements de l'hôtel */}
                        <ProductFieldSelector
                            label="Équipements et services"
                            fieldName="equipements"
                            productType="hotellerie"
                            value={newProduct.equipementsHotel || []}
                            onSelect={(value) => setNewProduct({ ...newProduct, equipementsHotel: value })}
                            multiSelect
                        />

                        {/* Adresse et Ville sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Adresse <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: Avenue Kennedy"
                                    value={newProduct.adresseHotel || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, adresseHotel: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Ville <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: Douala"
                                    value={newProduct.villeHotel || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, villeHotel: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
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
                                <ProductFieldSelector
                                    label="Taille"
                                    value={newProduct.taille || ''}
                                    productType="vetement"
                                    fieldName="tailles"
                                    onSelect={(value) => setNewProduct({ ...newProduct, taille: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Couleur"
                                    value={newProduct.couleurVetement || ''}
                                    productType="vetement"
                                    fieldName="couleurs"
                                    onSelect={(value) => setNewProduct({ ...newProduct, couleurVetement: value })}
                                    multiSelect
                                />
                            </View>
                        </View>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Matière"
                                    value={newProduct.matiereVetement || ''}
                                    productType="vetement"
                                    fieldName="matieres"
                                    onSelect={(value) => setNewProduct({ ...newProduct, matiereVetement: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    value={newProduct.marqueVetement || ''}
                                    productType="vetement"
                                    fieldName="marques"
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueVetement: value })}
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
                                <ProductFieldSelector
                                    label="Type"
                                    value={newProduct.typeChaussure || ''}
                                    productType="chaussure"
                                    fieldName="types"
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeChaussure: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    value={newProduct.marqueChaussure || ''}
                                    productType="chaussure"
                                    fieldName="marques"
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueChaussure: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Pointure"
                                    value={newProduct.pointure || ''}
                                    productType="chaussure"
                                    fieldName="pointures"
                                    onSelect={(value) => setNewProduct({ ...newProduct, pointure: value })}
                                    multiSelect
                                    maxSelections={10}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Couleur"
                                    value={newProduct.couleurChaussure || ''}
                                    productType="chaussure"
                                    fieldName="couleurs"
                                    onSelect={(value) => setNewProduct({ ...newProduct, couleurChaussure: value })}
                                />
                            </View>
                        </View>
                    </>
                );

            case 'electromenager':
                return (
                    <>
                        {/* Type et Marque sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type d'appareil"
                                    fieldName="types"
                                    productType="electromenager"
                                    value={newProduct.typeElectro || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeElectro: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="electromenager"
                                    value={newProduct.marqueElectro || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueElectro: value })}
                                />
                            </View>
                        </View>

                        {/* Modèle seul */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Modèle</Text>
                            <NativeInput
                                placeholder="Ex: RT50K6000S8"
                                value={newProduct.modeleElectro || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, modeleElectro: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* État et Garantie sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État"
                                    fieldName="etats"
                                    productType="electromenager"
                                    value={newProduct.etatElectro || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatElectro: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Garantie"
                                    fieldName="garanties"
                                    productType="electromenager"
                                    value={newProduct.garantieElectro || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, garantieElectro: value })}
                                />
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
                        {/* Type et Matériau sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de mobilier"
                                    fieldName="types"
                                    productType="mobilier"
                                    value={newProduct.typeMobilier || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeMobilier: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Matériau"
                                    fieldName="matieres"
                                    productType="mobilier"
                                    value={newProduct.materiauMobilier || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, materiauMobilier: value })}
                                />
                            </View>
                        </View>

                        {/* Couleur seule */}
                        <ProductFieldSelector
                            label="Couleur"
                            fieldName="couleurs"
                            productType="mobilier"
                            value={newProduct.couleurMobilier || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, couleurMobilier: value })}
                        />
                        {/* Dimensions et État sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Dimensions (LxPxH cm)</Text>
                                <NativeInput
                                    placeholder="Ex: 200x90x85"
                                    value={newProduct.dimensionsMobilier || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dimensionsMobilier: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État"
                                    fieldName="etats"
                                    productType="mobilier"
                                    value={newProduct.etatMobilier || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatMobilier: value })}
                                />
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
                        {/* Type et Style sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de décoration"
                                    fieldName="types"
                                    productType="mobilier"
                                    value={newProduct.typeDecoration || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeDecoration: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Style décoratif"
                                    fieldName="styles"
                                    productType="mobilier"
                                    value={newProduct.styleDecoration || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, styleDecoration: value })}
                                />
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

                        <ProductFieldSelector
                            label="Matériau / Matière"
                            fieldName="materiaux"
                            productType="decoration"
                            value={newProduct.materiauDecoration || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, materiauDecoration: value })}
                        />

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
                        <ProductFieldSelector
                            label="Catégorie d'aliment"
                            fieldName="categories"
                            productType="aliments"
                            value={newProduct.categorieAliment || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, categorieAliment: value })}
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Origine"
                                    fieldName="origines"
                                    productType="aliments"
                                    value={newProduct.origine || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, origine: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Conservation"
                                    fieldName="conservations"
                                    productType="aliments"
                                    value={newProduct.conservation || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, conservation: value })}
                                />
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
                        <ProductFieldSelector
                            label="Certification (optionnel)"
                            fieldName="certifications"
                            productType="aliments"
                            value={newProduct.certification || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, certification: value })}
                        />
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
                        <ProductFieldSelector
                            label="Catégorie"
                            fieldName="categories"
                            productType="quincaillerie"
                            value={newProduct.categorieQuincaillerie || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, categorieQuincaillerie: value })}
                        />
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
                                <ProductFieldSelector
                                    label="Unité"
                                    fieldName="unites"
                                    productType="quincaillerie"
                                    value={newProduct.unite || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, unite: value })}
                                />
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
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        style={styles.addPrestationButtonSecondary}
                                        onPress={() => {
                                            const prestations = newProduct.prestations || [];
                                            // Ajouter 3 offres d'un coup
                                            for (let i = 0; i < 3; i++) {
                                                prestations.push({ nom: '', prixAPartirDe: '', description: '' });
                                            }
                                            setNewProduct({ ...newProduct, prestations });
                                        }}
                                    >
                                        <SafeIcon name="layers" size={18} color={modernColors.primary} />
                                        <Text style={styles.addPrestationTextSecondary}>+3 offres</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.addPrestationButton}
                                        onPress={() => {
                                            const prestations = newProduct.prestations || [];
                                            prestations.push({ nom: '', prixAPartirDe: '', description: '' });
                                            setNewProduct({ ...newProduct, prestations });
                                        }}
                                    >
                                        <SafeIcon name="plus-circle" size={20} color="#FFFFFF" />
                                        <Text style={styles.addPrestationText}>Ajouter</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {(newProduct.prestations || []).map((prestation, index) => (
                                <View key={index} style={styles.prestationCardCompact}>
                                    <View style={styles.prestationCardHeader}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                            <View style={styles.prestationNumber}>
                                                <Text style={styles.prestationNumberText}>{index + 1}</Text>
                                            </View>
                                            <Text style={styles.prestationCardTitle}>
                                                {prestation.nom || `Offre ${index + 1}`}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <TouchableOpacity
                                                style={styles.duplicatePrestationButton}
                                                onPress={() => {
                                                    const prestations = [...(newProduct.prestations || [])];
                                                    prestations.splice(index + 1, 0, { ...prestation });
                                                    setNewProduct({ ...newProduct, prestations });
                                                }}
                                            >
                                                <SafeIcon name="copy" size={16} color={modernColors.success} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.deletePrestationButton}
                                                onPress={() => {
                                                    const prestations = [...(newProduct.prestations || [])];
                                                    prestations.splice(index, 1);
                                                    setNewProduct({ ...newProduct, prestations });
                                                }}
                                            >
                                                <SafeIcon name="trash-2" size={16} color={modernColors.error} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.prestationFieldContainerCompact}>
                                        <Text style={styles.prestationFieldLabelCompact}>Nom de l'offre *</Text>
                                        <NativeInput
                                            placeholder="Ex: Installation électrique"
                                            value={prestation.nom}
                                            onChangeText={(text) => {
                                                const prestations = [...(newProduct.prestations || [])];
                                                prestations[index].nom = text;
                                                setNewProduct({ ...newProduct, prestations });
                                            }}
                                            style={styles.fieldInputCompact}
                                        />
                                    </View>

                                    <View style={styles.prestationFieldRow}>
                                        <View style={[styles.prestationFieldContainerCompact, { flex: 1 }]}>
                                            <Text style={styles.prestationFieldLabelCompact}>Prix min. (XAF) *</Text>
                                            <NativeInput
                                                placeholder="50000"
                                                value={prestation.prixAPartirDe}
                                                onChangeText={(text) => {
                                                    const prestations = [...(newProduct.prestations || [])];
                                                    prestations[index].prixAPartirDe = text;
                                                    setNewProduct({ ...newProduct, prestations });
                                                }}
                                                style={styles.fieldInputCompact}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View style={[styles.prestationFieldContainerCompact, { flex: 2 }]}>
                                            <Text style={styles.prestationFieldLabelCompact}>Description (opt.)</Text>
                                            <NativeInput
                                                placeholder="Ex: Comprend installation + câblage..."
                                                value={prestation.description}
                                                onChangeText={(text) => {
                                                    const prestations = [...(newProduct.prestations || [])];
                                                    prestations[index].description = text;
                                                    setNewProduct({ ...newProduct, prestations });
                                                }}
                                                style={styles.fieldInputCompact}
                                            />
                                        </View>
                                    </View>
                                </View>
                            ))}

                            {(!newProduct.prestations || newProduct.prestations.length === 0) && (
                                <View style={styles.emptyPrestationState}>
                                    <SafeIcon name="briefcase" size={40} color={modernColors.textSecondary} />
                                    <Text style={styles.emptyPrestationText}>
                                        Aucune offre ajoutée
                                    </Text>
                                    <Text style={styles.emptyPrestationSubtext}>
                                        Ajoutez vos offres rapidement avec les boutons ci-dessus
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                        <Text style={styles.emptyPrestationHint}>💡 Astuce: Utilisez "+3 offres" pour gagner du temps</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💰 <Text style={styles.hintBold}>Conseil :</Text> Listez toutes vos offres de service avec leur montant minimum. Utilisez le bouton de duplication 📋 pour créer rapidement des variantes.
                            </Text>
                        </View>
                    </>
                );

            case 'livres_fournitures':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type d'article"
                            fieldName="types"
                            productType="livres_fournitures"
                            value={newProduct.categorieLivre || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, categorieLivre: value })}
                        />

                        <ProductFieldSelector
                            label="Niveau scolaire"
                            fieldName="niveaux"
                            productType="livres_fournitures"
                            value={newProduct.niveau || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, niveau: value })}
                        />
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
                        <ProductFieldSelector
                            label="État"
                            fieldName="etats"
                            productType="livres_fournitures"
                            value={newProduct.etatLivre || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, etatLivre: value })}
                        />
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
                        <ProductFieldSelector
                            label="🌙 Fonctionnement la nuit"
                            fieldName="types"
                            productType="pharmacie"
                            value={newProduct.typePharmacie || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typePharmacie: value, joursGarde: value === 'Permanence nuit' ? 'Tous les jours' : undefined })}
                            required
                        />

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

                        {/* Heures d'ouverture et fermeture sur la même ligne */}
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

                        {/* Téléphone d'urgence */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Téléphone d'urgence</Text>
                            <NativeInput
                                placeholder="Ex: +XXX XXXXXXXXX"
                                value={newProduct.telephoneUrgence || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, telephoneUrgence: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        {/* Services disponibles avec multiSelect */}
                        <ProductFieldSelector
                            label="Services disponibles"
                            fieldName="services"
                            productType="pharmacie"
                            value={newProduct.services || []}
                            onSelect={(value) => setNewProduct({ ...newProduct, services: value })}
                            multiSelect
                        />

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
                        <ProductFieldSelector
                            label="Type d'établissement médical"
                            fieldName="types"
                            productType="hopital_clinique"
                            value={newProduct.typeEtablissement || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeEtablissement: value })}
                            required
                        />

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

            case 'agroalimentaire':
                return (
                    <>
                        {/* Type et Marque sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de produit"
                                    fieldName="types"
                                    productType={selectedType}
                                    value={newProduct.typeAgro || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeAgro: value })}
                                    required
                                    placeholder="Ex: Riz et céréales..."
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType={selectedType}
                                    value={newProduct.marqueAgro || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueAgro: value })}
                                    placeholder="Ex: Nestlé, Maggi..."
                                />
                            </View>
                        </View>

                        {/* Format et Origine sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Format / Conditionnement"
                                    fieldName="formats"
                                    productType={selectedType}
                                    value={newProduct.formatAgro || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, formatAgro: value })}
                                    required
                                    placeholder="Ex: 5kg, 1L..."
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Origine / Provenance"
                                    fieldName="origines"
                                    productType={selectedType}
                                    value={newProduct.origine || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, origine: value })}
                                    placeholder="Ex: Cameroun..."
                                />
                            </View>
                        </View>

                        {/* Certification et Mode de conservation sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Certification / Label"
                                    fieldName="certifications"
                                    productType={selectedType}
                                    value={newProduct.certification || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, certification: value })}
                                    placeholder="Ex: Bio, Halal..."
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Mode de conservation"
                                    fieldName="conservation"
                                    productType={selectedType}
                                    value={newProduct.modeConservation || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, modeConservation: value })}
                                    placeholder="Ex: Au sec..."
                                />
                            </View>
                        </View>

                        {/* Date de péremption */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Date de péremption / DLC</Text>
                            <NativeInput
                                placeholder="Ex: 2026-12-31"
                                value={newProduct.datePeremption || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, datePeremption: text })}
                                style={styles.fieldInput}
                            />
                            <Text style={styles.fieldHint}>Format: AAAA-MM-JJ (optionnel)</Text>
                        </View>

                        {/* Numéro de lot */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Numéro de lot</Text>
                            <NativeInput
                                placeholder="Ex: LOT2025-001"
                                value={newProduct.numeroLot || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, numeroLot: text })}
                                style={styles.fieldInput}
                            />
                            <Text style={styles.fieldHint}>Pour la traçabilité (optionnel)</Text>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez le format, l'origine et les certifications pour rassurer les acheteurs
                            </Text>
                        </View>
                    </>
                );

            case 'demenagement':
                return (
                    <>
                        {/* Type et Volume sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de déménagement"
                                    fieldName="types"
                                    productType="demenagement"
                                    value={newProduct.typeDemenagement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeDemenagement: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Volume estimé (m³)</Text>
                                <NativeInput
                                    placeholder="Ex: 20, 30"
                                    value={newProduct.volumeEstime || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, volumeEstime: text })}
                                    keyboardType="numeric"
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* Type véhicule et Distance sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de véhicule"
                                    fieldName="vehicules"
                                    productType="demenagement"
                                    value={newProduct.typeVehicule || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeVehicule: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Distance max (km)</Text>
                                <NativeInput
                                    placeholder="Ex: 500"
                                    value={newProduct.distanceKm || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, distanceKm: text })}
                                    keyboardType="numeric"
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* Nombre de déménageurs */}
                        <Text style={styles.fieldLabel}>Nombre de déménageurs</Text>
                        <NativeInput
                            placeholder="Ex: 3"
                            value={newProduct.nbDemenageurs || ''}
                            onChangeText={(text) => setNewProduct({ ...newProduct, nbDemenageurs: text })}
                            style={styles.fieldInput}
                            keyboardType="numeric"
                        />

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
                        <ProductFieldSelector
                            label="Type de produit"
                            fieldName="types"
                            productType="cosmetique_parfum"
                            value={newProduct.typeCosmetique || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeCosmetique: value })}
                        />

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
                                <ProductFieldSelector
                                    label="Unité"
                                    fieldName="unites"
                                    productType="cosmetique_parfum"
                                    value={newProduct.uniteCosmetique || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, uniteCosmetique: value })}
                                />
                            </View>
                        </View>

                        {/* Type de peau */}
                        <ProductFieldSelector
                            label="Type de peau / Cible"
                            fieldName="types_peau"
                            productType="cosmetique_parfum"
                            value={newProduct.typePeau || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typePeau: value })}
                        />

                        {/* Âge recommandé */}
                        <Text style={styles.fieldLabel}>Âge recommandé (années)</Text>
                        <NativeInput
                            placeholder="Ex: 18"
                            value={newProduct.ageRecommandé || ''}
                            onChangeText={(text) => setNewProduct({ ...newProduct, ageRecommandé: text })}
                            style={styles.fieldInput}
                            keyboardType="numeric"
                        />

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
                        <ProductFieldSelector
                            label="Type de bijou"
                            fieldName="types"
                            productType="bijoux"
                            value={newProduct.typeBijou || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeBijou: value })}
                        />

                        {/* Matière */}
                        <ProductFieldSelector
                            label="Matière principale"
                            fieldName="matieres"
                            productType="bijoux"
                            value={newProduct.matiereBijou || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, matiereBijou: value })}
                        />

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
                                <ProductFieldSelector
                                    label="Unité"
                                    fieldName="unites_poids"
                                    productType="bijoux"
                                    value={newProduct.unitePoids || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, unitePoids: value })}
                                />
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
                        <ProductFieldSelector
                            label="Style"
                            fieldName="styles"
                            productType="bijoux"
                            value={newProduct.styleBijou || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, styleBijou: value })}
                        />

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
                        {/* Type et Longueur sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de produit"
                                    fieldName="types"
                                    productType="coiffure_beaute"
                                    value={newProduct.typeCoiffure || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeCoiffure: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Longueur"
                                    fieldName="longueurs"
                                    productType="coiffure_beaute"
                                    value={newProduct.longueurMech || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, longueurMech: value })}
                                    required
                                />
                            </View>
                        </View>

                        {/* Couleur et Texture sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Couleur</Text>
                                <NativeInput
                                    placeholder="Ex: Noir naturel"
                                    value={newProduct.couleurMech || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, couleurMech: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Texture"
                                    fieldName="textures"
                                    productType="coiffure_beaute"
                                    value={newProduct.textureMech || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, textureMech: value })}
                                />
                            </View>
                        </View>

                        {/* Type pose et Marque sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de pose"
                                    fieldName="typesPose"
                                    productType="coiffure_beaute"
                                    value={newProduct.typePose || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typePose: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Marque</Text>
                                <NativeInput
                                    placeholder="Ex: Remy Hair"
                                    value={newProduct.marqueCoiffure || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, marqueCoiffure: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* Origine et Type cheveux sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Origine"
                                    fieldName="origines"
                                    productType="coiffure_beaute"
                                    value={newProduct.origineMech || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, origineMech: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de cheveux"
                                    fieldName="typesCheveux"
                                    productType="coiffure_beaute"
                                    value={newProduct.typeCheveux || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeCheveux: value })}
                                />
                            </View>
                        </View>

                        {/* Entretien et Durée de vie */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Conseils d'entretien</Text>
                                <NativeInput
                                    placeholder="Ex: Shampoing doux"
                                    value={newProduct.entretienMech || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, entretienMech: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Durée de vie (jours)</Text>
                                <NativeInput
                                    placeholder="Ex: 30"
                                    value={newProduct.dureeVie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dureeVie: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
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
                        <ProductFieldSelector
                            label="Type d'assurance"
                            fieldName="categories"
                            productType="assurance"
                            value={newProduct.categorieAssurance || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, categorieAssurance: value, typeAssurance: '' })}
                            required
                        />

                        {/* Sous-catégories selon Vie ou Non-Vie */}
                        {newProduct.categorieAssurance && (
                            <ProductFieldSelector
                                label="Sous-catégorie"
                                fieldName="types"
                                productType="assurance"
                                value={newProduct.typeAssurance || ''}
                                onSelect={(value) => setNewProduct({ ...newProduct, typeAssurance: value })}
                                required
                            />
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

                        <Text style={styles.fieldLabel}>Durée du contrat (mois)</Text>
                        <NativeInput
                            placeholder="Ex: 12"
                            value={newProduct.dureeContrat || ''}
                            onChangeText={(text) => setNewProduct({ ...newProduct, dureeContrat: text })}
                            style={styles.fieldInput}
                            keyboardType="numeric"
                        />

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

            case 'restauration':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type de cuisine"
                            fieldName="types_cuisine"
                            productType="restauration"
                            value={newProduct.typeCuisine || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeCuisine: value })}
                            required
                        />

                        <ProductFieldSelector
                            label="Spécialités"
                            fieldName="specialites"
                            productType="restauration"
                            value={newProduct.specialites || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, specialites: values })}
                            multiSelect
                        />

                        <ProductFieldSelector
                            label="Services proposés"
                            fieldName="services"
                            productType="restauration"
                            value={newProduct.servicesRestau || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, servicesRestau: values })}
                            multiSelect
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Ambiance"
                                    fieldName="ambiances"
                                    productType="restauration"
                                    value={newProduct.ambiance || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, ambiance: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Gamme de prix"
                                    fieldName="gammes_prix"
                                    productType="restauration"
                                    value={newProduct.gammePrix || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, gammePrix: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Capacité (personnes)</Text>
                                <NativeInput
                                    placeholder="Ex: 50"
                                    value={newProduct.capacite || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, capacite: text })}
                                    keyboardType="numeric"
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Horaires</Text>
                                <NativeInput
                                    placeholder="Ex: 11h-23h"
                                    value={newProduct.horaires || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, horaires: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Certifications"
                            fieldName="certifications"
                            productType="restauration"
                            value={newProduct.certificationsRestau || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, certificationsRestau: values })}
                            multiSelect
                        />

                        <ProductFieldSelector
                            label="Options alimentaires"
                            fieldName="options_alimentaires"
                            productType="restauration"
                            value={newProduct.optionsAlimentaires || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, optionsAlimentaires: values })}
                            multiSelect
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 <Text style={styles.hintBold}>Conseil :</Text> Détaillez vos spécialités et services pour attirer plus de clients.
                            </Text>
                        </View>
                    </>
                );

            case 'electronique':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type d'appareil"
                            fieldName="types"
                            productType="electronique"
                            value={newProduct.typeElectronique || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeElectronique: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="electronique"
                                    value={newProduct.marqueElectronique || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueElectronique: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Modèle</Text>
                                <NativeInput
                                    placeholder="Ex: Galaxy S23"
                                    value={newProduct.modeleElectronique || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modeleElectronique: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État"
                                    fieldName="etats"
                                    productType="electronique"
                                    value={newProduct.etatElectronique || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatElectronique: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Garantie"
                                    fieldName="garanties"
                                    productType="electronique"
                                    value={newProduct.garantieElectronique || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, garantieElectronique: value })}
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Connectivités"
                            fieldName="connectivites"
                            productType="electronique"
                            value={newProduct.connectivites || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, connectivites: values })}
                            multiSelect
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez les spécifications techniques pour aider les acheteurs.
                            </Text>
                        </View>
                    </>
                );

            case 'musique_instruments':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type d'instrument"
                            fieldName="types"
                            productType="musique_instruments"
                            value={newProduct.typeInstrument || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeInstrument: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="musique_instruments"
                                    value={newProduct.marqueInstrument || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueInstrument: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Modèle</Text>
                                <NativeInput
                                    placeholder="Ex: Stratocaster"
                                    value={newProduct.modeleInstrument || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modeleInstrument: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État"
                                    fieldName="etats"
                                    productType="musique_instruments"
                                    value={newProduct.etatInstrument || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatInstrument: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Niveau"
                                    fieldName="niveaux"
                                    productType="musique_instruments"
                                    value={newProduct.niveauInstrument || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, niveauInstrument: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez si des accessoires sont inclus (étui, cordes, etc.).
                            </Text>
                        </View>
                    </>
                );

            case 'formation_education':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type de formation"
                            fieldName="types"
                            productType="formation_education"
                            value={newProduct.typeFormation || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeFormation: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Niveau"
                                    fieldName="niveaux"
                                    productType="formation_education"
                                    value={newProduct.niveauFormation || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, niveauFormation: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Mode"
                                    fieldName="modes"
                                    productType="formation_education"
                                    value={newProduct.modeFormation || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, modeFormation: value })}
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Matières enseignées"
                            fieldName="matieres"
                            productType="formation_education"
                            value={newProduct.matieresFormation || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, matieresFormation: values })}
                            multiSelect
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Durée (heures)</Text>
                                <NativeInput
                                    placeholder="Ex: 40"
                                    value={newProduct.dureeFormation || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dureeFormation: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Certification"
                                    fieldName="certifications"
                                    productType="formation_education"
                                    value={newProduct.certificationFormation || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, certificationFormation: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Indiquez si la formation est certifiante ou diplômante.
                            </Text>
                        </View>
                    </>
                );

            case 'evenementiel':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type d'événement"
                            fieldName="types"
                            productType="evenementiel"
                            value={newProduct.typeEvenement || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeEvenement: value })}
                            required
                        />

                        <ProductFieldSelector
                            label="Services inclus"
                            fieldName="services"
                            productType="evenementiel"
                            value={newProduct.servicesEvenement || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, servicesEvenement: values })}
                            multiSelect
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Capacité (personnes)</Text>
                                <NativeInput
                                    placeholder="Ex: 200"
                                    value={newProduct.capaciteEvenement || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, capaciteEvenement: text })}
                                    keyboardType="numeric"
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Gamme tarifaire"
                                    fieldName="tarifs"
                                    productType="evenementiel"
                                    value={newProduct.tarifEvenement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, tarifEvenement: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Ajoutez des photos de vos événements précédents pour inspirer confiance.
                            </Text>
                        </View>
                    </>
                );

            case 'agriculture':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type de produit"
                            fieldName="types"
                            productType="agriculture"
                            value={newProduct.typeAgricole || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeAgricole: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Culture"
                                    fieldName="cultures"
                                    productType="agriculture"
                                    value={newProduct.culture || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, culture: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Saison"
                                    fieldName="saisons"
                                    productType="agriculture"
                                    value={newProduct.saisonAgricole || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, saisonAgricole: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Unité de vente"
                                    fieldName="unites"
                                    productType="agriculture"
                                    value={newProduct.uniteVente || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, uniteVente: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Quantité disponible</Text>
                                <NativeInput
                                    placeholder="Ex: 500"
                                    value={newProduct.quantiteDisponible || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, quantiteDisponible: text })}
                                    keyboardType="numeric"
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Certifications"
                            fieldName="certifications"
                            productType="agriculture"
                            value={newProduct.certificationsAgricole || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, certificationsAgricole: values })}
                            multiSelect
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Indiquez si vos produits sont bio, sans pesticides, ou issus de l'agriculture locale.
                            </Text>
                        </View>
                    </>
                );

            case 'sport_fitness':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type d'activité"
                            fieldName="types"
                            productType="sport_fitness"
                            value={newProduct.typeSport || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeSport: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Niveau"
                                    fieldName="niveaux"
                                    productType="sport_fitness"
                                    value={newProduct.niveauSport || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, niveauSport: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Durée (minutes)</Text>
                                <NativeInput
                                    placeholder="Ex: 60"
                                    value={newProduct.dureeSport || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dureeSport: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Équipements fournis"
                            fieldName="equipements"
                            productType="sport_fitness"
                            value={newProduct.equipementsSport || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, equipementsSport: values })}
                            multiSelect
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez si les équipements sont fournis ou si les participants doivent les apporter.
                            </Text>
                        </View>
                    </>
                );

            case 'bien_etre_spa':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type de service"
                            fieldName="types"
                            productType="bien_etre_spa"
                            value={newProduct.typeBienEtre || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeBienEtre: value })}
                            required
                        />

                        <ProductFieldSelector
                            label="Services"
                            fieldName="services"
                            productType="bien_etre_spa"
                            value={newProduct.servicesBienEtre || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, servicesBienEtre: values })}
                            multiSelect
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Durée (minutes)</Text>
                                <NativeInput
                                    placeholder="Ex: 90"
                                    value={newProduct.dureeBienEtre || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dureeBienEtre: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Gamme tarifaire"
                                    fieldName="tarifs"
                                    productType="bien_etre_spa"
                                    value={newProduct.tarifBienEtre || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, tarifBienEtre: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Détaillez vos prestations pour permettre aux clients de choisir facilement.
                            </Text>
                        </View>
                    </>
                );

            case 'animaux_veterinaire':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type d'animal"
                            fieldName="types"
                            productType="animaux_veterinaire"
                            value={newProduct.typeAnimal || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeAnimal: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Race"
                                    fieldName="races"
                                    productType="animaux_veterinaire"
                                    value={newProduct.raceAnimal || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, raceAnimal: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Âge (années)</Text>
                                <NativeInput
                                    placeholder="Ex: 5"
                                    value={newProduct.ageAnimal || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, ageAnimal: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Services vétérinaires"
                            fieldName="services"
                            productType="animaux_veterinaire"
                            value={newProduct.servicesVeterinaire || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, servicesVeterinaire: values })}
                            multiSelect
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Ajoutez des photos de qualité pour montrer votre animal ou vos services.
                            </Text>
                        </View>
                    </>
                );

            case 'nettoyage_entretien':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type de service"
                            fieldName="types"
                            productType="nettoyage_entretien"
                            value={newProduct.typeNettoyage || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeNettoyage: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Fréquence"
                                    fieldName="frequences"
                                    productType="nettoyage_entretien"
                                    value={newProduct.frequenceNettoyage || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, frequenceNettoyage: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Surface"
                                    fieldName="surfaces"
                                    productType="nettoyage_entretien"
                                    value={newProduct.surfaceNettoyage || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, surfaceNettoyage: value })}
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Équipements"
                            fieldName="equipements"
                            productType="nettoyage_entretien"
                            value={newProduct.equipementsNettoyage || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, equipementsNettoyage: values })}
                            multiSelect
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez si vous fournissez les produits d'entretien et le matériel.
                            </Text>
                        </View>
                    </>
                );

            case 'jardinage_paysagisme':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type de service"
                            fieldName="types"
                            productType="jardinage_paysagisme"
                            value={newProduct.typeJardinage || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeJardinage: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Saison recommandée"
                                    fieldName="saisons"
                                    productType="jardinage_paysagisme"
                                    value={newProduct.saisonJardinage || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, saisonJardinage: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Surface"
                                    fieldName="surfaces"
                                    productType="jardinage_paysagisme"
                                    value={newProduct.surfaceJardinage || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, surfaceJardinage: value })}
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Services inclus"
                            fieldName="services"
                            productType="jardinage_paysagisme"
                            value={newProduct.servicesJardinage || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, servicesJardinage: values })}
                            multiSelect
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Montrez vos réalisations avec des photos avant/après.
                            </Text>
                        </View>
                    </>
                );

            case 'securite_surveillance':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type de service"
                            fieldName="types"
                            productType="securite_surveillance"
                            value={newProduct.typeSecurite || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeSecurite: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Zone à couvrir"
                                    fieldName="zones"
                                    productType="securite_surveillance"
                                    value={newProduct.zoneSecurite || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, zoneSecurite: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Durée du contrat (mois)</Text>
                                <NativeInput
                                    placeholder="Ex: 12"
                                    value={newProduct.dureeSecurite || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dureeSecurite: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Équipements"
                            fieldName="equipements"
                            productType="securite_surveillance"
                            value={newProduct.equipementsSecurite || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, equipementsSecurite: values })}
                            multiSelect
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez vos certifications et agréments de sécurité.
                            </Text>
                        </View>
                    </>
                );

            case 'plomberie':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type de service"
                            fieldName="types"
                            productType="plomberie"
                            value={newProduct.typePlomberie || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typePlomberie: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Service d'urgence"
                                    fieldName="urgences"
                                    productType="plomberie"
                                    value={newProduct.urgencePlomberie || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, urgencePlomberie: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Garantie"
                                    fieldName="garanties"
                                    productType="plomberie"
                                    value={newProduct.garantiePlomberie || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, garantiePlomberie: value })}
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Matériaux"
                            fieldName="materiaux"
                            productType="plomberie"
                            value={newProduct.materiauxPlomberie || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, materiauxPlomberie: values })}
                            multiSelect
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Indiquez si vous intervenez en urgence 24h/24.
                            </Text>
                        </View>
                    </>
                );

            case 'electricite':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type de service"
                            fieldName="types"
                            productType="electricite"
                            value={newProduct.typeElectricite || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeElectricite: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Puissance (watts)</Text>
                                <NativeInput
                                    placeholder="Ex: 1500"
                                    value={newProduct.puissanceElectricite || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, puissanceElectricite: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Garantie"
                                    fieldName="garanties"
                                    productType="electricite"
                                    value={newProduct.garantieElectricite || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, garantieElectricite: value })}
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="Certifications"
                            fieldName="certifications"
                            productType="electricite"
                            value={newProduct.certificationsElectricite || []}
                            onSelect={(values) => setNewProduct({ ...newProduct, certificationsElectricite: values })}
                            multiSelect
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Mentionnez vos certifications et agréments électriques.
                            </Text>
                        </View>
                    </>
                );

            case 'menuiserie':
                return (
                    <>
                        <ProductFieldSelector
                            label="Type de produit/service"
                            fieldName="types"
                            productType="menuiserie"
                            value={newProduct.typeMenuiserie || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeMenuiserie: value })}
                            required
                        />

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de bois"
                                    fieldName="bois"
                                    productType="menuiserie"
                                    value={newProduct.typeBois || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeBois: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Finition"
                                    fieldName="finitions"
                                    productType="menuiserie"
                                    value={newProduct.finitionMenuiserie || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, finitionMenuiserie: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Style"
                                    fieldName="styles"
                                    productType="menuiserie"
                                    value={newProduct.styleMenuiserie || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, styleMenuiserie: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Dimensions</Text>
                                <NativeInput
                                    placeholder="Ex: 200x100x80cm"
                                    value={newProduct.dimensionsMenuiserie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dimensionsMenuiserie: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Ajoutez des photos de vos réalisations pour montrer votre savoir-faire.
                            </Text>
                        </View>
                    </>
                );

            case 'telephone':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="telephone"
                                    value={newProduct.marqueTelephone || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueTelephone: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Modèle <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: iPhone 14 Pro"
                                    value={newProduct.modeleTelephone || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modeleTelephone: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Stockage"
                                    fieldName="stockage"
                                    productType="telephone"
                                    value={newProduct.stockage || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, stockage: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="RAM"
                                    fieldName="ram"
                                    productType="telephone"
                                    value={newProduct.ram || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, ram: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État"
                                    fieldName="etats"
                                    productType="telephone"
                                    value={newProduct.etatTelephone || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatTelephone: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Couleur"
                                    fieldName="couleurs"
                                    productType="telephone"
                                    value={newProduct.couleurTelephone || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, couleurTelephone: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                📱 Précisez les caractéristiques techniques pour rassurer les acheteurs
                            </Text>
                        </View>
                    </>
                );

            case 'ordinateur':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type"
                                    fieldName="types"
                                    productType="ordinateur"
                                    value={newProduct.typeOrdinateur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeOrdinateur: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="ordinateur"
                                    value={newProduct.marqueOrdinateur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueOrdinateur: value })}
                                    required
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Processeur"
                                    fieldName="processeurs"
                                    productType="ordinateur"
                                    value={newProduct.processeur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, processeur: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="RAM"
                                    fieldName="ram"
                                    productType="ordinateur"
                                    value={newProduct.ramOrdinateur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, ramOrdinateur: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Stockage"
                                    fieldName="stockage"
                                    productType="ordinateur"
                                    value={newProduct.stockageOrdinateur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, stockageOrdinateur: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Carte Graphique"
                                    fieldName="cartesGraphiques"
                                    productType="ordinateur"
                                    value={newProduct.carteGraphique || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, carteGraphique: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État"
                                    fieldName="etats"
                                    productType="ordinateur"
                                    value={newProduct.etatOrdinateur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatOrdinateur: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Système d'exploitation</Text>
                                <NativeInput
                                    placeholder="Ex: Windows 11, macOS"
                                    value={newProduct.systemeExploitation || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, systemeExploitation: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💻 Les spécifications techniques sont essentielles pour les ordinateurs
                            </Text>
                        </View>
                    </>
                );

            case 'image_son':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type d'appareil"
                                    fieldName="types"
                                    productType="image_son"
                                    value={newProduct.typeImageSon || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeImageSon: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="image_son"
                                    value={newProduct.marqueImageSon || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueImageSon: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Résolution"
                                    fieldName="resolutions"
                                    productType="image_son"
                                    value={newProduct.resolution || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, resolution: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Taille écran (pouces)</Text>
                                <NativeInput
                                    placeholder="Ex: 55"
                                    value={newProduct.diagonaleEcran || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, diagonaleEcran: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <ProductFieldSelector
                            label="État"
                            fieldName="etats"
                            productType="image_son"
                            value={newProduct.etatImageSon || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, etatImageSon: value })}
                            required
                        />

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                📺 Pour les TV, précisez la taille et la résolution
                            </Text>
                        </View>
                    </>
                );

            case 'pieces_auto':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de pièce"
                                    fieldName="types"
                                    productType="pieces_auto"
                                    value={newProduct.typePieceAuto || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typePieceAuto: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="pieces_auto"
                                    value={newProduct.marquePieceAuto || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marquePieceAuto: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État"
                                    fieldName="etats"
                                    productType="pieces_auto"
                                    value={newProduct.etatPieceAuto || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatPieceAuto: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Référence</Text>
                                <NativeInput
                                    placeholder="Ex: REF-12345"
                                    value={newProduct.referenceAuto || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, referenceAuto: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Compatibilité</Text>
                            <NativeInput
                                placeholder="Ex: Toyota Camry 2015-2020"
                                value={newProduct.compatibilite || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, compatibilite: text })}
                                style={styles.fieldInput}
                                multiline
                            />
                        </View>
                    </>
                );

            case 'pieces_industrielles':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de pièce"
                                    fieldName="types"
                                    productType="pieces_industrielles"
                                    value={newProduct.typePieceIndustrielle || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typePieceIndustrielle: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="pieces_industrielles"
                                    value={newProduct.marquePieceIndustrielle || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marquePieceIndustrielle: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Matériau"
                                    fieldName="materiaux"
                                    productType="pieces_industrielles"
                                    value={newProduct.materielPiece || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, materielPiece: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Application"
                                    fieldName="applications"
                                    productType="pieces_industrielles"
                                    value={newProduct.applicationIndustrielle || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, applicationIndustrielle: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Référence</Text>
                            <NativeInput
                                placeholder="Ex: SKF-6205-2Z"
                                value={newProduct.referencePiece || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, referencePiece: text })}
                                style={styles.fieldInput}
                            />
                        </View>
                    </>
                );

            case 'jouets_enfants':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de jouet"
                                    fieldName="types"
                                    productType="jouets_enfants"
                                    value={newProduct.typeJouet || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeJouet: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Âge recommandé (années)</Text>
                                <NativeInput
                                    placeholder="Ex: 5"
                                    value={newProduct.ageJouet || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, ageJouet: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="jouets_enfants"
                                    value={newProduct.marqueJouet || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueJouet: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Matériau"
                                    fieldName="materiaux"
                                    productType="jouets_enfants"
                                    value={newProduct.materiauJouet || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, materiauJouet: value })}
                                />
                            </View>
                        </View>
                    </>
                );

            case 'ustensiles_cuisine':
                return (
                    <>
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type d'ustensile"
                                    fieldName="types"
                                    productType="ustensiles_cuisine"
                                    value={newProduct.typeUstensile || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeUstensile: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Matériau"
                                    fieldName="materiaux"
                                    productType="ustensiles_cuisine"
                                    value={newProduct.materiauUstensile || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, materiauUstensile: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="ustensiles_cuisine"
                                    value={newProduct.marqueUstensile || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueUstensile: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Capacité</Text>
                                <NativeInput
                                    placeholder="Ex: 2L, 5L"
                                    value={newProduct.capaciteUstensile || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, capaciteUstensile: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
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
                                                <Text style={styles.productBadge} numberOfLines={1}>
                                                    {typeInfo.icon} {typeInfo.label}
                                                </Text>
                                                <Text style={styles.productName} numberOfLines={2} ellipsizeMode="tail">
                                                    {product.nom}
                                                </Text>
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
                                                        onPress={() => handleDuplicateProduct(product)}
                                                    >
                                                        <SafeIcon name="copy" size={16} color={modernColors.success} />
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
                            colors={modernColors.primaryGradient as unknown as readonly [string, string, ...string[]]}
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
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={0}
                >
                    <View style={styles.modalContainer}>
                        {/* Header */}
                        <LinearGradient
                            colors={modernColors.primaryGradient as unknown as readonly [string, string, ...string[]]}
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

                        <ScrollView
                            style={styles.modalContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={{ paddingBottom: 120 }}
                        >
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

                                    {/* Section Médias */}
                                    <View style={styles.mediaSectionContainer}>
                                        <Text style={styles.sectionTitle}>📸 Images du produit</Text>

                                        {/* Message descriptif incitatif */}
                                        <View style={styles.mediaHintContainer}>
                                            <SafeIcon name="info" size={16} color={modernColors.info} />
                                            <Text style={styles.mediaHintText}>
                                                💡 Ajoutez des photos de qualité pour attirer plus de clients ! Montrez votre produit sous tous les angles.
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.mediaButton}
                                            onPress={handlePickImages}
                                        >
                                            <SafeIcon name="image" size={20} color={modernColors.primary} />
                                            <Text style={styles.mediaButtonText}>
                                                📷 Ajouter des images
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

                                        {/* Message descriptif incitatif pour vidéos */}
                                        <View style={styles.mediaHintContainer}>
                                            <SafeIcon name="info" size={16} color={modernColors.info} />
                                            <Text style={styles.mediaHintText}>
                                                🎬 Les vidéos augmentent de 80% les chances de vente ! Montrez votre produit en action ou en démonstration.
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.mediaButton}
                                            onPress={handlePickVideos}
                                        >
                                            <SafeIcon name="video" size={20} color={modernColors.success} />
                                            <Text style={styles.mediaButtonText}>
                                                🎥 Ajouter des vidéos
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

                                    {/* Section Promotion - APRÈS les médias */}
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
                </KeyboardAvoidingView>
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

            {/* Modal de duplication de produit */}
            <ProductDuplicationModal
                visible={showDuplicationModal}
                onClose={handleCancelDuplication}
                product={productToDuplicate}
                onDuplicate={handleConfirmDuplication}
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
        flexShrink: 1, // ✅ Permet au badge de rétrécir
    },
    productName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        flexShrink: 1, // ✅ Permet au texte de rétrécir si nécessaire
        flexWrap: 'nowrap', // ✅ Empêche le wrap non contrôlé
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
        shadowColor: modernColors.primary, // ✅ Ombre pour effet élevé
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4, // ✅ Pour Android
    },
    deviseButtonText: {
        fontSize: 14, // ✅ Augmenté de 12 à 14 pour lisibilité
        fontWeight: '700', // ✅ Plus gras pour meilleure visibilité
        color: modernColors.textSecondary,
        letterSpacing: 0.5, // ✅ Espacement pour clarté
    },
    deviseButtonTextActive: {
        color: '#FFFFFF',
        fontWeight: '800', // ✅ Extra gras quand actif
        letterSpacing: 0.8, // ✅ Plus d'espacement quand actif
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
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    addPrestationText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    addPrestationButtonSecondary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: modernColors.surface,
        borderWidth: 1.5,
        borderColor: modernColors.primary,
        borderRadius: 8,
    },
    addPrestationTextSecondary: {
        fontSize: 12,
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
    emptyPrestationHint: {
        fontSize: 11,
        color: modernColors.primary,
        fontStyle: 'italic',
    },
    prestationCardCompact: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    prestationNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    prestationNumberText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    duplicatePrestationButton: {
        padding: 6,
        borderRadius: 6,
        backgroundColor: '#D1FAE5',
    },
    prestationFieldContainerCompact: {
        marginBottom: 8,
    },
    prestationFieldLabelCompact: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    fieldInputCompact: {
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 13,
        color: modernColors.text,
    },
    // Styles pour système de réservation de bus
    busConfigSection: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionHeaderWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitleMedium: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    busConfigSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        marginTop: 8,
    },
    busConfigText: {
        fontSize: 13,
        color: modernColors.text,
    },
    busConfigBold: {
        fontWeight: '700',
        color: modernColors.primary,
        fontSize: 15,
    },
    busPreviewContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    busPreviewTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    busLayout: {
        gap: 8,
    },
    busFront: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 8,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        marginBottom: 8,
    },
    busFrontText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    busSeatsGrid: {
        gap: 4,
    },
    busRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    rowNumber: {
        width: 24,
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    busAisle: {
        width: 12,
    },
    busSeatMini: {
        width: 32,
        height: 32,
        backgroundColor: '#10B981',
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#059669',
    },
    busSeatNumber: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    busSeatDriver: {
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
    },
    busSeatDriverText: {
        fontSize: 14,
    },
    busFirstRowOptions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    busFirstRowButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderRadius: 10,
    },
    busFirstRowButtonActive: {
        backgroundColor: modernColors.primary,
    },
    busFirstRowButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    busFirstRowButtonTextActive: {
        color: '#FFFFFF',
    },
    availabilityToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        backgroundColor: modernColors.background,
        borderRadius: 10,
        marginTop: 8,
    },
    toggleSwitch: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#D1D5DB',
        padding: 2,
        justifyContent: 'center',
    },
    toggleSwitchActive: {
        backgroundColor: modernColors.success,
    },
    toggleThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleThumbActive: {
        transform: [{ translateX: 22 }],
    },
    availabilityToggleText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
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
    // ✅ AMÉLIORATION: Grille de devises (toutes sur la même ligne)
    deviseGridContainer: {
        flexDirection: 'row',
        flexWrap: 'nowrap', // ✅ Empêcher retour à la ligne
        gap: 6, // ✅ Réduit pour plus d'espace
        marginTop: 8,
        justifyContent: 'flex-start', // ✅ Alignement à gauche
    },
    deviseButtonGrid: {
        flex: 1, // ✅ Chaque devise prend espace égal
        paddingHorizontal: 10, // ✅ Réduit de 12 à 10
        paddingVertical: 10, // ✅ Augmenté pour meilleure cible tactile
        borderRadius: 10, // ✅ Plus arrondi pour modernité
        backgroundColor: '#F3F4F6',
        borderWidth: 2, // ✅ Border plus épaisse pour visibilité
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center', // ✅ Centrage vertical
        minHeight: 42, // ✅ Hauteur minimale pour touch target
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
    // Styles manquants
    fieldHint: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
        fontStyle: 'italic',
    },
    hintBold: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginTop: 4,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    promotionSectionContainer: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#FFF7ED',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FDBA74',
    },
    promotionFields: {
        gap: 12,
    },
    // Styles pour le select moderne
    modernSelect: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 8,
    },
    selectText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    selectPlaceholder: {
        color: modernColors.textSecondary,
    },
    // Styles pour les messages descriptifs des médias
    mediaHintContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        gap: 8,
    },
    mediaHintText: {
        flex: 1,
        fontSize: 12,
        color: '#0369A1',
        lineHeight: 16,
        fontWeight: '500',
    },
});

export default ProductManagerMobile;

