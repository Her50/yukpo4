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
import AutocompleteStructure from './AutocompleteStructure';
import { NativeButton, NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';
import SmartApplianceInput from './SmartApplianceInput';
import SmartPhoneModelInput from './SmartPhoneModelInput';
import SmartVehicleModelInput from './SmartVehicleModelInput';
// Code corrigé (remplace @ts-ignore)
import BusSeatSelector from './BusSeatSelector';
// Code corrigé (remplace @ts-ignore)
import ModernGPSModal from './ModernGPSModal';
// Code corrigé (remplace @ts-ignore)
import { SmartModalityInput } from './SmartModalityInput';

const { width } = Dimensions.get('window');

// ✅ Fonction de normalisation sans accents pour la recherche
const normalizeText = (text: string): string => {
    return text
        .toLowerCase()
        .normalize('NFD') // Décompose les caractères accentués
        .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
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
    | 'laboratoire'
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
    standing?: string; // Économique, Standard, Haut standing, Luxe
    etatGeneral?: string; // Neuf, Bon état, À rénover
    ameublement?: string; // Meublé, Semi-meublé, Non meublé
    superficie?: string;
    nbChambres?: string;
    nbSallesBain?: string;
    etage?: string; // Numéro d'étage (pour appartements)
    nbEtages?: string; // Nombre d'étages (pour villas/immeubles)
    anneeConstruction?: string; // Année de construction
    adresse?: string;
    quartier?: string;
    ville?: string;
    gpsImmobilier?: string; // Coordonnées GPS de l'immobilier
    // Équipements et commodités
    equipementsImmo?: string[]; // Cuisine équipée, Balcon, Terrasse, etc.
    parking?: boolean; // Garage/Parking disponible
    nbParkings?: string; // Nombre de places de parking
    ascenseur?: boolean; // Ascenseur disponible
    jardin?: boolean; // Jardin/Espace vert
    piscine?: boolean; // Piscine
    securite?: boolean; // Gardien/Sécurité 24h
    internet?: boolean; // Internet/Fibre
    climatisation?: boolean; // Climatisation
    // Informations location
    chargesMensuelles?: string; // Charges mensuelles (XAF)
    caution?: string; // Caution (nombre de mois ou montant)
    bailMinimum?: string; // Durée minimum du bail
    dateDisponibilite?: string; // Date de disponibilité
    disponibleImmediatement?: boolean; // Disponible maintenant
    // Informations vente
    titreFoncier?: boolean; // Titre foncier disponible
    prixNegociable?: boolean; // Prix négociable

    // 🏠 LOCATION COURTE DURÉE (Type Airbnb/Booking)
    // Pour les locations de vacances, séjours touristiques, hébergements temporaires
    // Typiquement : Nuitées, séjours week-end, vacances (quelques jours à quelques semaines)
    // À distinguer de "À louer" (location long terme = plusieurs mois/années avec bail)
    prixParNuit?: string; // Prix par nuit pour location courte durée
    dureeMinimum?: string; // Séjour minimum requis (ex: "2 nuits", "1 semaine")
    dureeMaximum?: string; // Séjour maximum autorisé (ex: "30 nuits", "3 mois")
    nettoyageInclus?: boolean; // Frais de ménage inclus dans le prix
    lingeInclus?: boolean; // Draps, serviettes, linge de maison fournis
    capacitePersonnes?: string; // Nombre maximum de voyageurs accueillis
    calendrierDispo?: string; // Périodes de disponibilité ou réservées
    reservationInstantanee?: boolean; // Confirmation immédiate sans validation manuelle du propriétaire

    // Terrain spécifique
    typeTerrain?: string; // Résidentiel, Commercial, Industriel, Agricole, Forestier, Mixte
    viabilisation?: string; // Viabilisé, Partiellement viabilisé, Non viabilisé
    topographie?: string; // Plat, Légère pente, Forte pente, Accidenté
    accesTerrain?: string; // Route goudronnée, Piste, Difficile
    zonage?: string; // Zone résidentielle, Zone commerciale, Zone industrielle, Zone agricole, Zone mixte
    largeurFacade?: string; // Largeur de façade en mètres
    profondeur?: string; // Profondeur en mètres
    formeTerrain?: string; // Rectangulaire, Carré, Irrégulière, Trapézoïdale
    bornage?: boolean; // Bornage effectué
    cloture?: boolean; // Clôturé
    vegetation?: string; // Type de végétation (Dégagé, Arbustes, Arbres, Dense)
    usageActuel?: string; // Vacant, Cultivé, Bâti, Autre
    reseauxTerrain?: string[]; // Eau, Électricité, Assainissement, Fibre, Gaz
    numeroTitreFoncier?: string; // Numéro du titre foncier
    prixMetreCarre?: string; // Prix au m² (calculé ou manuel)
    servitudes?: string; // Description des servitudes ou restrictions
    constructibilite?: boolean; // Permis de construire possible
    coefficientOccupation?: string; // COS (Coefficient d'Occupation des Sols)

    // Automobile
    typeVehicule?: string; // Voiture, Moto, Camion, Utilitaire
    typeCarrosserie?: string; // Berline, 4x4/SUV, Pick-up, Coupé, Break, Monospace
    marqueAutomobile?: string; // ✅ Spécifique à l'automobile
    modeleAutomobile?: string; // ✅ Spécifique à l'automobile (autocomplete intelligent)
    etatVehicule?: string; // Neuf, Occasion, Accidenté
    annee?: string;
    kilometrage?: string;
    couleurAutomobile?: string; // ✅ Spécifique à l'automobile
    typeCarburant?: string;
    transmission?: string;
    nbPortes?: string; // Nombre de portes (2, 3, 4, 5)
    nbPlaces?: string; // Nombre de places assises
    puissance?: string; // Puissance en CV
    cylindree?: string; // Cylindrée en cm³
    equipementsAuto?: string[]; // Équipements et options
    historiqueEntretien?: boolean; // Historique d'entretien disponible
    premiereMain?: boolean; // Première main
    garantie?: string; // Garantie constructeur/vendeur
    contreTechnique?: boolean; // Contrôle technique valide
    papiers?: string; // État des papiers (Cartes grises, etc.)

    // Ticket de voyage
    compagnie?: string; // Compagnie de transport
    compagnieTransport?: string; // Alias pour compagnie
    typeVehiculeTransport?: string; // Bus, Avion, Train, Bateau
    classeVoyage?: string; // Économique, Affaires, VIP, Première classe
    depart?: string; // Ville de départ
    destination?: string; // Ville d'arrivée
    dateDepart?: string; // Date du voyage
    heureDepart?: string; // Heure de départ
    numeroPlace?: string; // Numéro de place/siège
    dureeTrajet?: string; // Durée estimée du trajet
    escales?: string[]; // Villes d'escale
    bagage?: string; // Type de bagage inclus (Cabine, Soute, etc.)
    repas?: boolean; // Repas inclus
    wifi?: boolean; // Wi-Fi disponible
    prixEnfant?: string; // Prix pour enfant
    prixBebe?: string; // Prix pour bébé
    remboursable?: boolean; // Billet remboursable
    modifiable?: boolean; // Billet modifiable
    assuranceVoyage?: boolean; // Assurance voyage incluse
    numeroBillet?: string; // Numéro de billet/référence
    codeReservation?: string; // Code de réservation

    // Hôtellerie
    categorieHotel?: string; // 1-5 étoiles, Palace
    typeHebergement?: string; // Hôtel, Chambre d'hôte, Auberge, Resort, etc.
    nbChambresHotel?: string; // Nombre total de chambres
    typesChambre?: string[]; // Simple, Double, Suite, Familiale, etc.
    prixParNuit?: string; // Prix minimum par nuit
    deviseHotel?: string; // Devise du prix
    equipementsHotel?: string[]; // Wi-Fi, Piscine, Spa, Gym, etc.
    servicesHotel?: string[]; // Services disponibles
    petitDejeuner?: boolean; // Petit-déjeuner inclus
    restaurantHotel?: boolean; // Restaurant sur place
    bar?: boolean; // Bar disponible
    piscine?: boolean; // Piscine disponible
    spa?: boolean; // Spa/Bien-être
    parking?: boolean; // Parking disponible
    wifi?: boolean; // Wi-Fi gratuit
    salleReunion?: boolean; // Salle de réunion/Séminaire
    adresseHotel?: string; // Adresse complète
    villeHotel?: string; // Ville de localisation
    gpsHotel?: string; // Coordonnées GPS
    noteHotel?: string; // Note moyenne (sur 5)

    // Covoiturage
    pointDepart?: string; // Point de départ
    pointArrivee?: string; // Point d'arrivée
    dateTrajet?: string; // Date du trajet
    heureTrajet?: string; // Heure de départ
    nbPlacesDisponibles?: string; // Nombre de places disponibles
    prixParPlace?: string; // Prix par place
    vehiculeInfo?: string; // Type/Modèle de véhicule
    preferencesTrajet?: string; // Préférences (Musique, Conversation, Silence, etc.)

    // Vêtement (Textile) - ✅ ENRICHI
    typeVetement?: string; // T-shirt, Pantalon, Robe, Veste, etc.
    genreVetement?: string; // Homme, Femme, Enfant, Unisexe
    taille?: string; // XS, S, M, L, XL, XXL, tailles numériques
    couleurVetement?: string;
    matiereVetement?: string; // Coton, Polyester, Laine, Soie, Lin
    marqueVetement?: string;
    etatVetement?: string; // Neuf avec étiquette, Neuf sans étiquette, Occasion - Excellent, Bon
    styleVetement?: string; // Casual, Formel, Sport, Streetwear, Vintage
    saisonVetement?: string; // Été, Hiver, Mi-saison, Toute saison
    origineVetement?: string; // Made in..., Local, Importé
    lavable?: string; // Lavage machine, Lavage main, Nettoyage à sec
    patronVetement?: string; // Uni, Rayé, À pois, Imprimé, Floral
    coupeVetement?: string; // Slim, Regular, Loose, Oversize
    longueurVetement?: string; // Court, Mi-long, Long (pour robes, manteaux)
    collectionVetement?: string; // Collection année, saison
    certifieVetement?: string[]; // Bio, Équitable, Made in France, etc.

    // Chaussure
    typeChaussure?: string; // Baskets, Sandales, Bottes, Mocassins, Escarpins, etc.
    pointure?: string; // Pointure (35-50)
    couleurChaussure?: string; // Couleur principale
    marqueChaussure?: string; // Nike, Adidas, Clarks, etc.
    materiauChaussure?: string; // Cuir, Synthétique, Toile, Daim, etc.
    etatChaussure?: string; // Neuf, Excellent, Bon, Occasion
    genreChaussure?: string; // Homme, Femme, Enfant, Unisexe
    usageChaussure?: string; // Sport, Ville, Casual, Formel, Randonnée

    // Électroménager
    typeElectro?: string; // Réfrigérateur, Cuisinière, Four, etc.
    categorieElectro?: string; // Gros électroménager, Petit électroménager
    marqueElectro?: string;
    modeleElectro?: string;
    etatElectro?: string; // Neuf, Occasion, Reconditionné
    anneeAchat?: string; // Année d'achat
    garantieElectro?: string; // Durée de garantie restante
    garantieConstructeur?: boolean; // Garantie constructeur valide
    consommationEnergetique?: string; // A+++, A++, A+, A, B, C, D
    capacite?: string; // Capacité (litres pour frigo, kg pour lave-linge)
    couleurElectro?: string; // Blanc, Inox, Noir, Gris
    dimensionsElectro?: string; // H x L x P
    fonctionnalites?: string[]; // No Frost, Dégivrage auto, Smart, WiFi, etc.
    facture?: boolean; // Facture disponible
    manuel?: boolean; // Manuel d'utilisation disponible
    accessoires?: string; // Accessoires fournis

    // Image et Son (TV, Audio, etc.) - ✅ ENRICHI
    typeImageSon?: string; // Télévision, Home cinéma, Barre de son, Ampli, etc.
    marqueImageSon?: string; // Samsung, LG, Sony, Philips, etc.
    modeleImageSon?: string; // Modèle spécifique
    diagonaleEcran?: string; // 32", 43", 50", 55", 65", etc.
    resolution?: string; // HD (720p), Full HD (1080p), 4K, 8K
    etatImageSon?: string; // Neuf avec garantie, Excellent état, Bon état, etc.
    garantieImageSon?: string; // Durée de garantie
    fonctionnalitesImageSon?: string[]; // Smart TV, WiFi, Bluetooth, HDR, etc.

    // Téléphones et Accessoires (Smartphones) - ✅ ENRICHI
    marqueTelephone?: string;
    modeleTelephone?: string; // Autocomplete par marque (BD)
    stockage?: string; // 32GB, 64GB, 128GB, 256GB, 512GB, 1TB
    ram?: string; // 2GB, 3GB, 4GB, 6GB, 8GB, 12GB, 16GB
    etatTelephone?: string; // Neuf, Occasion - Excellent, Bon, Moyen, À réparer
    couleurTelephone?: string;
    operateur?: string; // Débloqué, Orange, MTN, Camtel, Nexttel
    anneeAchatTelephone?: string; // Année d'achat
    imei?: string; // Numéro IMEI (pour vérification)
    garantieTelephone?: string; // Garantie restante
    garantieConstructeurTelephone?: boolean; // Garantie constructeur valide
    factureTelephone?: boolean; // Facture d'achat disponible
    boiteOriginale?: boolean; // Boîte d'origine disponible
    ecranOriginal?: boolean; // Écran original (non remplacé)
    batterieSante?: string; // Santé de la batterie (80-100%)
    reparations?: string; // Réparations effectuées
    accessoiresTelephone?: string[]; // Chargeur, Écouteurs, Coque, Protège-écran
    numeroCameraPrincipale?: string; // Caméra arrière (ex: 48MP)
    numeroCameraFrontale?: string; // Caméra avant (ex: 12MP)
    tailleEcran?: string; // Taille écran (ex: 6.1 pouces)
    typeEcran?: string; // OLED, AMOLED, LCD, IPS
    resolutionEcran?: string; // 1080x2400, 1170x2532
    batterie?: string; // Capacité batterie (mAh)
    chargementRapide?: boolean; // Charge rapide disponible
    chargementSansFil?: boolean; // Charge sans fil
    dualSim?: boolean; // Double SIM
    connectivite5G?: boolean; // Compatible 5G
    nfc?: boolean; // NFC disponible
    etancheite?: string; // IP67, IP68, Non étanche

    // Ordinateurs et Informatique - ✅ ENRICHI
    typeOrdinateur?: string; // PC de bureau, Laptop, MacBook, Tablette, etc.
    marqueOrdinateur?: string;
    modeleOrdinateur?: string; // Autocomplete par marque (BD)
    processeur?: string; // Intel Core i5, AMD Ryzen 7, Apple M2, etc.
    ramOrdinateur?: string; // 4GB, 8GB, 16GB, 32GB, 64GB
    stockageOrdinateur?: string; // 256GB SSD, 512GB SSD, 1TB SSD, etc.
    carteGraphique?: string; // NVIDIA RTX 3060, Intel HD Graphics, etc.
    systemeExploitation?: string; // Windows 11, macOS, Linux
    etatOrdinateur?: string; // Neuf, Occasion - Excellent, Bon, Reconditionné
    anneeAchatOrdinateur?: string; // Année d'achat
    tailleEcranOrdinateur?: string; // 13", 15", 17", 24", 27"
    resolutionOrdinateur?: string; // 1920x1080, 2560x1440, 3840x2160
    typeEcranOrdinateur?: string; // IPS, TN, OLED, Retina
    frequenceProcesseur?: string; // 2.5GHz, 3.0GHz, etc.
    typeSSD?: boolean; // SSD ou HDD
    tailleDisque?: string; // Taille physique (2.5", M.2, etc.)
    lecteurOptique?: boolean; // Lecteur CD/DVD
    clavier?: string; // AZERTY, QWERTY, Rétroéclairé
    webcam?: boolean; // Webcam intégrée
    touchscreen?: boolean; // Écran tactile
    batterie?: string; // Autonomie en heures
    portUSBC?: boolean; // Port USB-C
    portHDMI?: boolean; // Port HDMI
    bluetooth?: boolean; // Bluetooth
    wifi?: string; // Wi-Fi 5, Wi-Fi 6, Wi-Fi 6E
    garantieOrdinateur?: string; // Garantie restante
    garantieConstructeurOrdinateur?: boolean; // Garantie constructeur valide
    factureOrdinateur?: boolean; // Facture d'achat disponible
    boiteOriginaleOrdinateur?: boolean; // Boîte d'origine disponible
    accessoiresOrdinateur?: string[]; // Souris, Clavier, Sac, Chargeur
    usage?: string; // Gaming, Bureautique, Développement, Design graphique
    logicielsInclus?: string[]; // Office, Adobe, Antivirus, etc.

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

    // Assurance - ✅ ENRICHI
    categorieAssurance?: string; // Vie ou Non-Vie
    typeAssurance?: string; // Auto, Santé, Habitation, Vie entière, etc.
    compagnieAssurance?: string; // Nom de la compagnie d'assurance
    typeCouverture?: string; // Tous risques, Au tiers, Comprehensive, etc.
    franchise?: string; // Montant de la franchise
    franchiseAssurance?: string; // Montant de la franchise (alias)
    dureeContrat?: string; // 1 an, 2 ans, 5 ans, 10 ans, etc.
    primeAnnuelle?: string; // Prime annuelle
    primeMensuelle?: string; // Prime mensuelle
    benefices?: string[]; // Principaux bénéfices
    couverture?: string; // Étendue de la couverture (legacy)

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
    typeMobilier?: string; // Canapé, Lit, Table, Chaise, Armoire, etc.
    categorieMobilier?: string; // Salon, Chambre, Salle à manger, Bureau, Rangement
    styleMobilier?: string; // Moderne, Classique, Scandinave, Industriel, Vintage
    materiauMobilier?: string; // Bois, Métal, Tissu, Cuir, Verre
    couleurMobilier?: string;
    dimensionsMobilier?: string; // H x L x P
    etatMobilier?: string; // Neuf, Excellent, Bon état, À rénover
    nombrePlaces?: string; // Pour canapés, tables, etc.
    montageRequis?: boolean; // Montage nécessaire
    livraison?: boolean; // Livraison disponible
    fraisLivraison?: string; // Montant des frais de livraison
    garantieMobilier?: string; // Garantie (mois/années)
    poids?: string; // Poids en kg
    demontable?: boolean; // Facilement démontable

    // Aliments & Agroalimentaire
    categorieAliment?: string; // Fruits, Légumes, Viande, Poisson, Céréales, etc.
    typeAliment?: string; // Frais, Surgelé, Séché, En conserve
    origine?: string; // Locale, Importée (pays)
    bio?: boolean; // Agriculture biologique
    dateExpiration?: string; // Date de péremption
    dateProduction?: string; // Date de production/conditionnement
    conservation?: string; // Température ambiante, Réfrigéré, Congelé
    poids?: string; // Poids net
    conditionnement?: string; // Vrac, Emballé, Sous vide, Barquette
    labelQualite?: string[]; // Bio, Label Rouge, AOC, AOP, IGP
    valeurNutritionnelle?: string; // Informations nutritionnelles
    allergenes?: string; // Allergènes présents
    certifications?: string[]; // Halal, Casher, Vegan, Sans gluten
    stockDisponible?: number; // Quantité disponible
    uniteMesure?: string; // Kg, Litre, Pièce, Carton, Sac
    poids?: string; // Poids ou quantité
    conservation?: string; // Frais, Surgelé, Sec
    certification?: string; // Bio, Halal, Kasher, etc.

    // Livres et Fournitures Scolaires - ✅ ENRICHI
    categorieLivre?: string; // Livre scolaire, Roman, Cahier, Stylo, etc.
    niveau?: string; // Maternelle, Primaire, Secondaire, Université
    matiereScolaire?: string; // Mathématiques, Français, Histoire, etc.
    auteur?: string; // Pour les livres
    editeur?: string; // Maison d'édition/Marque
    isbn?: string; // Code ISBN
    anneeEdition?: string; // Année de publication
    etatLivre?: string; // Neuf emballé, Neuf, Excellent état, Bon état, Occasion
    langue?: string; // Français, Anglais, Bilingue, etc.

    // Quincaillerie et Matériaux
    categorieQuincaillerie?: string; // Outils, Matériaux, Peinture, etc.
    marqueQuincaillerie?: string;
    referenceQuincaillerie?: string;
    unite?: string; // Pièce, Sac, Litre, etc.
    stockDisponible?: string;

    // Prestation de Service - ✅ ENRICHI
    imagesRealisations?: string[]; // Images de réalisations
    videosRealisations?: string[]; // Vidéos de réalisations
    titreService?: string; // Rempli automatiquement depuis bloc info générale
    descriptionService?: string; // Rempli automatiquement depuis bloc info générale
    categoriePrestation?: string; // Bâtiment, Beauté, Informatique, etc.
    typePrestation?: string; // Consultation, Formation, Maintenance, etc.
    dureePrestation?: string; // 1 heure, 2 heures, 1 jour, etc.
    zoneIntervention?: string; // Yaoundé, Douala, Tout le Cameroun, etc.
    experienceAnnees?: number; // Années d'expérience
    certifie?: boolean; // Certifié/Diplômé
    deplacement?: boolean; // Se déplace
    disponibilitePrestation?: string; // Immédiate, Cette semaine, Ce mois
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

    // Laboratoire d'analyses médicales
    typeLaboratoire?: string; // Analyses médicales, Biologie, Bactériologie, Imagerie
    examensLaboratoire?: string[]; // Liste des examens disponibles
    planningExamens?: { [key: string]: { jours?: string; moment?: string } }; // Planning par type d'examen
    prelevementDomicile?: boolean; // Prélèvement à domicile disponible
    resultatRapide?: boolean; // Résultats rapides/urgents
    delaiResultat?: string; // Délai moyen pour les résultats
    accreditations?: string[]; // Accréditations et certifications

    // Restauration
    typeCuisine?: string; // Type de cuisine (Africaine, Française, Italienne, etc.)
    typeRestaurant?: string; // Type d'établissement (Restaurant, Café, Bar, etc.)
    servicesRestau?: string[]; // Services (Sur place, Emporter, Livraison, Traiteur)
    gammePrix?: string; // Gamme de prix (Économique, Moyen, Haut de gamme, Luxe)
    capaciteRestaurant?: string; // Capacité d'accueil (nombre de couverts)
    horairesRestaurant?: string; // Horaires d'ouverture
    ambiance?: string; // Ambiance (Familiale, Romantique, Décontractée, etc.)
    chefNom?: string; // Nom du chef cuisinier
    menuJour?: string; // Plat du jour ou menu spécial
    cartePlats?: string[]; // Carte des plats principaux
    regimesSpeciaux?: string[]; // Régimes spéciaux (Végétarien, Vegan, Sans gluten, Halal, etc.)
    livraison?: boolean; // Service de livraison disponible
    terrasse?: boolean; // Terrasse disponible
    parking?: boolean; // Parking disponible
    wifi?: boolean; // Wi-Fi disponible
    reservation?: boolean; // Réservation possible
    adresseRestaurant?: string; // Adresse du restaurant

    // Déménagement - ✅ ENRICHI
    typeDemenagement?: string; // Déménagement local, national, international, bureau, etc.
    volumeDemenagement?: string; // Studio (10-15m³), F2 (20-30m³), etc.
    typeVehiculeDemenagement?: string; // Camionnette 10m³, Camion 30m³, etc.
    distanceDemenagement?: string; // Moins de 10 km, 10-50 km, etc.
    nbDemenageurs?: string; // Nombre de déménageurs
    servicesDemenagement?: string[]; // Emballage, Transport, Déballage, etc.
    assuranceDemenagement?: boolean; // Assurance marchandise incluse
    montageInclus?: boolean; // Montage/Démontage meubles
    cartonsInclus?: boolean; // Cartons fournis
    dateDebut?: string; // Date de début souhaitée
    serviceManutention?: boolean;
    montageDemontage?: boolean;
    emballageCartons?: boolean;
    gardeMeuble?: boolean;
    debarras?: boolean;

    // Plomberie - ✅ ENRICHI
    typePrestation?: string; // Installation, Réparation, Entretien, Dépannage, etc.
    specialitesPlomberie?: string[]; // Réparation fuite, Débouchage, Installation chaudière, etc.
    equipementsPlomberie?: string[]; // Robinetterie, WC, Douche, Chauffe-eau, etc.
    disponibilitePlomberie?: string; // Urgence 24h/24, Intervention rapide, etc.
    garantieTravaux?: string; // 3 mois, 6 mois, 1 an, 2 ans, Garantie décennale
    urgence?: boolean; // Dépannage d'urgence 24h/24
    devisGratuit?: boolean; // Devis gratuit
    certificationPlombier?: string; // Certifié, Agréé, etc.
    dateDemenagementDisponible?: string;

    // Nettoyage - ✅ ENRICHI
    typeNettoyage?: string; // Résidentiel, Bureaux, Après travaux, etc.
    frequenceNettoyage?: string; // Ponctuel, Hebdomadaire, Mensuel, etc.
    servicesNettoyage?: string[]; // Dépoussiérage, Aspiration, Lavage sols, etc.
    surfaceNettoyage?: string; // Moins de 50m², 50-100m², etc.
    produitsNettoyage?: string; // Produits bio/écologiques, Professionnels, etc.
    produitsBio?: boolean; // Utilisation de produits bio/écologiques
    materielInclus?: boolean; // Matériel de nettoyage inclus
    assuranceResponsabiliteCivile?: boolean; // Assurance RC

    // Réparation - ✅ ENRICHI
    typeReparation?: string; // Électronique, Électroménager, Téléphone, Ordinateur, etc.
    specialiteReparation?: string; // Écran cassé, Batterie, Carte mère, Moteur, etc.
    marqueReparation?: string; // Toutes marques, Samsung, Apple, etc.
    delaiReparation?: string; // Express (même jour), 24-48h, 2-5 jours, etc.
    garantieReparation?: string; // 1 mois, 3 mois, 6 mois, 1 an, 2 ans
    diagnosticGratuit?: boolean; // Diagnostic gratuit
    deplacementInclus?: boolean; // Déplacement inclus
    piecesOrigine?: boolean; // Pièces d'origine

    // Électricité - ✅ ENRICHI
    typeElectrique?: string; // Installation, Réparation, Dépannage, Mise aux normes, etc.
    serviceElectrique?: string; // Installation tableau, Climatisation, Éclairage, etc.
    equipementsElectrique?: string[]; // Tableau, Disjoncteur, Prises, Luminaires, etc.
    puissanceElectrique?: string; // Puissance en kW ou ampères
    certificationElectrique?: string; // Électricien certifié, Agréé, etc.
    urgenceElectrique?: boolean; // Dépannage urgence 24h/24
    miseAuxNormes?: boolean; // Mise aux normes incluse
    garantieElectrique?: string; // Garantie travaux

    // Carrelage - ✅ NOUVEAU
    typeCarrelage?: string; // Sol, Mural, Extérieur, Piscine, etc.
    materiauCarrelage?: string; // Céramique, Porcelaine, Grès, Marbre, etc.
    dimensionsCarrelage?: string; // 20x20cm, 30x30cm, 60x60cm, etc.
    finitionCarrelage?: string; // Brillant, Mat, Antidérapant, etc.
    epaisseurCarrelage?: string; // 6mm, 8mm, 10mm, etc.
    usageCarrelage?: string; // Intérieur, Extérieur, Salle de bain, etc.
    aspectCarrelage?: string[]; // Uni, Marbré, Bois, Pierre, etc.
    couleurCarrelage?: string; // Couleur principale
    surfaceDisponible?: string; // Surface en m²
    origineCarrelage?: string; // Pays d'origine

    // Bricolage - ✅ NOUVEAU
    typeBricolage?: string; // Outils manuels, électriques, Matériaux, etc.
    categorieBricolage?: string; // Sous-catégorie
    marqueBricolage?: string; // Bosch, Makita, DeWalt, etc.
    etatBricolage?: string; // Neuf, Excellent état, Bon état, etc.
    puissanceBricolage?: string; // Pour outils électriques
    garantieBricolage?: string; // Garantie constructeur

    // Enfants & Bébés - ✅ NOUVEAU
    categorieEnfant?: string; // Vêtements, Poussettes, Sièges auto, etc.
    ageRecommande?: string; // 0-3 mois, 1-2 ans, etc.
    etatEnfant?: string; // Neuf, Excellent état, etc.
    tailleEnfant?: string; // Taille vêtement
    marqueEnfant?: string; // Marque
    securiteNorme?: boolean; // Conforme normes sécurité

    // Décoration - ✅ NOUVEAU
    typeDecoration?: string; // Meubles, Luminaires, Tapis, etc.
    styleDecoration?: string; // Moderne, Scandinave, Vintage, etc.
    pieceDecoration?: string; // Salon, Chambre, Cuisine, etc.
    materiauDecoration?: string; // Bois, Métal, Tissu, etc.
    couleurDecoration?: string; // Couleur principale
    dimensionsDecoration?: string; // Dimensions

    // Santé & Beauté - ✅ NOUVEAU
    typeProduitBeaute?: string;
    marqueBeaute?: string;
    volumeBeaute?: string;
    bio?: boolean;

    // Juridique - ✅ NOUVEAU
    typeServiceJuridique?: string;
    specialiteJuridique?: string;
    experienceAvocat?: string;
    tarifHoraire?: string;

    // Musique Services - ✅ NOUVEAU
    typeServiceMusical?: string;
    genreMusical?: string;
    dureePrestation?: string;
    materielInclus?: boolean;

    // Photographie - ✅ NOUVEAU
    typePhotoService?: string;
    stylePhoto?: string;
    equipementPhoto?: string[];
    retouchesIncluses?: boolean;

    // Entreprise & Industrie - ✅ NOUVEAU
    typeEntreprise?: string;
    secteurActivite?: string;
    certification?: string;
    etatMateriel?: string;

    // Bien-être & Spa - ✅ NOUVEAU
    typeBienEtre?: string;
    dureeSoins?: string;
    tarifsSpeciaux?: boolean;
    packageDispo?: boolean;
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

    // Musique & Instruments
    typeInstrument?: string; // Guitare, Piano, Batterie, Vent, Cordes, Percussion, etc.
    categorieInstrument?: string; // Instrument, Accessoire, Sonorisation, Studio
    marqueInstrument?: string; // Yamaha, Fender, Gibson, Roland, etc.
    modeleInstrument?: string; // Modèle spécifique
    etatInstrument?: string; // Neuf, Excellent, Bon, À réviser
    anneeInstrument?: string; // Année de fabrication
    materiauInstrument?: string; // Bois, Métal, Plastique, Composite
    couleurInstrument?: string; // Couleur de l'instrument
    tailleInstrument?: string; // Taille (1/4, 1/2, 3/4, 4/4 pour violon, etc.)
    nombreCordes?: string; // Pour guitares, basses, violons
    typeAmplification?: string; // Acoustique, Électrique, Électro-acoustique
    puissanceAmpli?: string; // Puissance en Watts pour amplis
    accessoiresInclus?: string[]; // Étui, Archet, Câbles, Pédalier, etc.
    garantieInstrument?: string; // Garantie restante
    facture?: boolean; // Facture d'achat disponible
    revisionRecente?: boolean; // Révision/entretien récent
    origineInstrument?: string; // Pays de fabrication
    styleBijou?: string;
    origineBijou?: string;
    certificatBijou?: string;

    // Emploi & Recrutement
    posteOffre?: string; // Titre du poste
    typeContrat?: string; // CDI, CDD, Stage, Freelance, etc.
    domaineActivite?: string; // IT, Commerce, Santé, Éducation, etc.
    niveauExperience?: string; // Débutant, 1-3 ans, 3-5 ans, 5+ ans
    salaireMin?: string; // Salaire minimum
    salaireMax?: string; // Salaire maximum
    deviseOffre?: string; // Devise du salaire
    lieuTravail?: string; // Ville/Localisation du poste
    typeEmploi?: string; // Temps plein, Temps partiel, Télétravail, Hybride
    competencesRequises?: string[]; // Compétences techniques requises
    diplomeRequis?: string; // Niveau de diplôme requis
    languesRequises?: string[]; // Langues nécessaires
    avantages?: string[]; // Avantages sociaux (Assurance, Prime, etc.)
    horaires?: string; // Horaires de travail
    dateDebut?: string; // Date de prise de fonction
    dureeContrat?: string; // Durée du contrat (pour CDD/Stage)
    descriptionPoste?: string; // Description détaillée du poste
    profilRecherche?: string; // Profil recherché

    // Formation & Éducation
    domaineFormation?: string; // Informatique, Langues, Commerce, Santé, etc.
    typeFormation?: string; // Formation professionnelle, Cours de langue, Soutien scolaire, Coaching
    niveauFormation?: string; // Débutant, Intermédiaire, Avancé, Professionnel
    modeFormation?: string; // Présentiel, En ligne, Hybride, À domicile
    dureeFormation?: string; // Durée en heures, jours, semaines, mois
    prixFormation?: string; // Prix de la formation
    certificationFormation?: string; // Certification délivrée (Attestation, Certificat, Diplôme)
    dateDebutFormation?: string; // Date de début de la formation
    prerequis?: string; // Prérequis nécessaires
    objectifs?: string; // Objectifs pédagogiques
    programme?: string; // Programme détaillé
    formateurNom?: string; // Nom du formateur/enseignant
    horairesFormation?: string; // Horaires des cours
    langueEnseignement?: string; // Langue d'enseignement
    matieresFormation?: string[]; // Matières enseignées
    nombrePlaces?: string; // Nombre de places disponibles

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
const PRODUCT_TYPES = [
    { value: 'agroalimentaire', label: 'Agroalimentaire & Produits Secs', icon: '🌾', color: '#F59E0B', description: 'Riz, pâtes, farine, huile, sucre, épices, conserves, boissons, produits transformés', keywords: ['riz', 'pâtes', 'macaroni', 'spaghetti', 'farine', 'huile', 'arachide', 'palme', 'tournesol', 'olive', 'sucre', 'sel', 'épices', 'poivre', 'curry', 'curcuma', 'gingembre', 'piment', 'sauce', 'ketchup', 'mayonnaise', 'moutarde', 'maggi', 'jumbo', 'bouillon', 'cube', 'conserve', 'sardine', 'thon', 'maquereau', 'tomate', 'haricot', 'pois', 'maïs', 'boisson', 'eau', 'jus', 'soda', 'cola', 'sprite', 'fanta', 'café', 'nescafé', 'thé', 'lipton', 'lait', 'nido', 'peak', 'chocolat', 'cacao', 'biscuit', 'chips', 'snack', 'bonbon', 'confiserie', 'céréale', 'avoine', 'blé', 'maïs', 'mil', 'sorgho', 'manioc', 'couscous', 'semoule', 'légume', 'sec', 'lentille', 'fève', 'pois chiche', 'condiment', 'vinaigre', 'miel', 'confiture', 'beurre', 'cacahuète', 'arachide', 'noix', 'cajou', 'amande', 'produit', 'alimentaire', 'agro', 'transformation', 'conserverie', 'biscuiterie', 'huilerie', 'meunerie', 'rizerie', 'sucrerie', 'chocolaterie', 'confiserie'] },
    { value: 'aliments', label: 'Aliments Frais & Produits du Marché', icon: '🍎', color: '#84CC16', description: 'Fruits frais, légumes frais, viandes, poissons, volailles, produits du marché', keywords: ['fruit', 'légume', 'viande', 'poisson', 'bœuf', 'poulet', 'porc', 'mouton', 'chèvre', 'tomate', 'oignon', 'pomme', 'banane', 'orange', 'mangue', 'avocat', 'ananas', 'carotte', 'chou', 'salade', 'frais', 'marché'] },
    { value: 'assurance', label: 'Assurance et Protection', icon: '🛡️', color: '#14B8A6', description: 'Assurance auto, santé, habitation, vie, protection sociale', keywords: ['assurance', 'protection', 'garantie', 'prime', 'contrat', 'couverture', 'police', 'assureur', 'sinistre', 'indemnisation', 'franchise', 'souscription', 'mutuelle', 'prévoyance', 'responsabilité civile', 'tous risques'] },
    { value: 'automobile', label: 'Automobiles et Véhicules', icon: '🚗', color: '#EF4444', description: 'Voitures, motos, camions, véhicules utilitaires', keywords: ['voiture', 'auto', 'véhicule', 'automobile', 'moto', 'scooter', 'camion', '4x4', 'SUV', 'berline', 'coupé', 'cabriolet', 'Toyota', 'Honda', 'Mercedes', 'Peugeot', 'Renault', 'Nissan', 'occasion', 'neuf', 'kilométrage', 'essence', 'diesel', 'hybride', 'électrique', 'automatique', 'manuelle'] },
    { value: 'chaussure', label: 'Chaussures et Accessoires', icon: '👟', color: '#6366F1', description: 'Chaussures, baskets, sandales, bottes', keywords: ['chaussure', 'soulier', 'basket', 'sneaker', 'sandale', 'tong', 'botte', 'bottine', 'escarpin', 'talon', 'mocassin', 'ballerine', 'pointure', 'semelle', 'cuir', 'sport', 'ville', 'Nike', 'Adidas', 'Puma'] },
    { value: 'covoiturage', label: 'Covoiturage et Trajets', icon: '🚙', color: '#F59E0B', description: 'Trajets partagés, carpooling, transport collectif', keywords: ['covoiturage', 'trajet', 'partage', 'carpooling', 'transport partagé', 'passager', 'conducteur', 'départ', 'arrivée', 'itinéraire', 'route', 'place disponible', 'voyage partagé', 'économique', 'écologique'] },
    { value: 'decoration', label: 'Décoration Intérieure', icon: '🖼️', color: '#E91E63', description: 'Tableaux, luminaires, tapis, accessoires déco', keywords: ['décoration', 'déco', 'tableau', 'toile', 'peinture', 'affiche', 'cadre', 'luminaire', 'lampe', 'lustre', 'applique', 'tapis', 'carpette', 'coussin', 'rideau', 'vase', 'sculpture', 'miroir', 'horloge', 'bougie', 'moderne', 'classique', 'vintage', 'contemporain'] },
    { value: 'electricite', label: 'Électricité et Éclairage', icon: '⚡', color: '#FFC107', description: 'Câbles, prises, interrupteurs, lampes, disjoncteurs', keywords: ['électricité', 'électrique', 'câble', 'fil', 'interrupteur', 'prise', 'disjoncteur', 'tableau électrique', 'lampe', 'ampoule', 'LED', 'néon', 'spot', 'variateur', 'minuterie', 'détecteur', 'multiprise', 'rallonge', '220V', 'installation électrique'] },
    { value: 'electromenager', label: 'Électroménager Domestique', icon: '🔌', color: '#14B8A6', description: 'Frigos, fours, machines à laver, micro-ondes', keywords: ['électroménager', 'frigo', 'réfrigérateur', 'congélateur', 'four', 'cuisinière', 'micro-ondes', 'lave-linge', 'machine à laver', 'lave-vaisselle', 'aspirateur', 'climatiseur', 'ventilateur', 'Samsung', 'LG', 'Bosch', 'Whirlpool'] },
    { value: 'hopital_clinique', label: 'Établissements de Santé', icon: '🏥', color: '#DC2626', description: 'Hôpitaux, cliniques, centres médicaux, spécialités', keywords: ['hôpital', 'clinique', 'centre médical', 'centre de santé', 'médecin', 'docteur', 'consultation', 'urgence', 'soins', 'chirurgie', 'imagerie', 'radio', 'scanner', 'IRM', 'maternité', 'pédiatrie', 'cardiologie', 'dentiste', 'rendez-vous'] },
    { value: 'laboratoire', label: 'Laboratoires & Imagerie médicale', icon: '🔬', color: '#7C3AED', description: 'Laboratoires d\'analyses, centres d\'imagerie, scanner, IRM, échographie', keywords: ['laboratoire', 'labo', 'analyse', 'examen', 'biologie', 'prise de sang', 'NFS', 'glycémie', 'sérologie', 'VIH', 'hépatite', 'paludisme', 'parasitologie', 'bactériologie', 'ECBU', 'hormonologie', 'bilan', 'résultat', 'prélèvement', 'biochimie', 'hématologie', 'PCR', 'imagerie', 'radiographie', 'radio', 'scanner', 'IRM', 'échographie', 'écho', 'doppler', 'mammographie', 'panoramique', 'scintigraphie', 'PET scan', 'fibroscopie', 'endoscopie'] },
    { value: 'hotellerie', label: 'Hôtellerie et Hébergement', icon: '🏨', color: '#EC4899', description: 'Hôtels, chambres d\'hôtes, auberges, gîtes, réservations', keywords: ['hôtel', 'hébergement', 'chambre', 'chambre d\'hôtes', 'auberge', 'gîte', 'motel', 'palace', 'réservation', 'booking', 'nuitée', 'séjour', 'étoile', 'luxe', 'petit-déjeuner', 'Wi-Fi', 'piscine', 'restaurant', 'spa', 'climatisation'] },
    { value: 'image_son', label: 'Image et Son', icon: '📺', color: '#9C27B0', description: 'TV, home cinéma, enceintes, projecteurs, systèmes audio', keywords: ['télévision', 'TV', 'téléviseur', 'écran', 'home cinéma', 'enceinte', 'haut-parleur', 'barre de son', 'amplificateur', 'projecteur', 'casque', 'écouteurs', '4K', '8K', 'HD', 'OLED', 'QLED', 'LCD', 'LED', 'Samsung', 'Sony', 'LG'] },
    { value: 'immobilier_batiment', label: 'Immobilier - Vente/Location Long Terme', icon: '🏢', color: '#3B82F6', description: 'Appartements, villas, maisons à vendre ou louer (bail long terme)', keywords: ['immobilier', 'appartement', 'appart', 'F2', 'F3', 'F4', 'villa', 'maison', 'studio', 'duplex', 'loft', 'vente', 'location', 'louer', 'acheter', 'bail', 'loyer', 'chambre', 'salon', 'cuisine', 'salle de bain', 'balcon', 'terrasse', 'jardin', 'garage', 'meublé', 'standing'] },
    { value: 'immobilier_location_courte', label: 'Location Courte Durée (Airbnb)', icon: '🏠', color: '#F59E0B', description: 'Locations vacances, séjours courts, nuitées (type Airbnb/Booking)', keywords: ['location courte', 'airbnb', 'booking', 'vacances', 'séjour', 'nuitée', 'week-end', 'hébergement temporaire', 'tourisme', 'meublé vacances', 'villa vacances', 'appartement vacances', 'court séjour', 'par nuit'] },
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
    immobilier_batiment: `Nom,Prix,Devise,Description,Type,Statut,Standing,État,Superficie,Chambres,Salles de bain,Ameublement,Étage,Année,Parking,Ascenseur,Jardin,Piscine,Sécurité,Internet,Clim,Adresse,Quartier,Ville,GPS
Exemple Appartement F4,50000000,XAF,Bel appartement moderne avec balcon,Appartement,À louer,Standard,Bon état,120,4,2,Meublé,3,2020,Oui,Oui,Non,Non,Oui,Oui,Oui,Rue des Jardins,Bonanjo,Douala,4.0511°N 9.7679°E
Exemple Villa R+2,150000000,XAF,Villa spacieuse avec piscine et jardin,Villa,À vendre,Haut standing,Neuf,300,6,4,Non meublé,R+2,2023,Oui,Non,Oui,Oui,Oui,Oui,Oui,Avenue Kennedy,Bonapriso,Douala,4.0604°N 9.7135°E
Exemple Studio meublé,200000,XAF,Studio moderne tout équipé centre-ville,Studio,À louer,Économique,Bon état,35,1,1,Meublé,2,2019,Non,Oui,Non,Non,Non,Oui,Oui,Av. de Gaulle,Akwa,Douala,4.0490°N 9.6976°E`,

    immobilier_location_courte: `Nom,Prix/nuit,Devise,Description,Type,Standing,État,Superficie,Chambres,Salles bain,Ameublement,Capacité,Équipements,Nettoyage inclus,Linge inclus,Durée min,Durée max,Réservation instant,Parking,Wifi,Clim,Adresse,Quartier,Ville,GPS
Exemple Appartement F3 Bonanjo,35000,XAF,Appartement F3 moderne meublé vue mer idéal séjour court,Appartement,Standard,Excellent état,85,3,2,Meublé,6,Cuisine équipée|Balcon|TV|Internet/Fibre,Oui,Oui,2 nuits,30 nuits,Oui,Oui,Oui,Oui,Rue des Cocotiers,Bonanjo,Douala,4.0511°N 9.7679°E
Exemple Villa Bonapriso,85000,XAF,Villa luxe avec piscine jardin parfait vacances famille,Villa,Haut standing,Neuf,250,5,3,Meublé,10,Cuisine équipée|Jardin|Piscine|TV|Internet/Fibre|Terrasse,Oui,Oui,3 nuits,60 nuits,Non,Oui,Oui,Oui,Avenue Kennedy,Bonapriso,Douala,4.0604°N 9.7135°E
Exemple Studio Centre Yaoundé,15000,XAF,Studio cosy centre-ville équipé idéal voyageurs solo,Studio,Économique,Bon état,30,1,1,Meublé,2,Cuisine équipée|TV|Internet/Fibre,Non,Oui,1 nuit,14 nuits,Oui,Non,Oui,Oui,Centre administratif,Centre-ville,Yaoundé,3.8480°N 11.5021°E`,

    immobilier_terrain: `Nom,Prix,Devise,Description,Type,Statut,Viabilisation,Zonage,Superficie,Prix m²,Largeur,Profondeur,Forme,Topographie,Accès,Végétation,Usage,Réseaux,Titre foncier,Bornage,Constructible,Clôture,Adresse,Quartier,Ville,GPS
Exemple Terrain 500m²,25000000,XAF,Terrain viabilisé prêt à construire,Résidentiel,À vendre,Viabilisé,Zone résidentielle,500,50000,20,25,Rectangulaire,Plat,Route goudronnée,Dégagé,Vacant,Eau|Électricité|Fibre,Oui,Oui,Oui,Oui,Zone industrielle,Logpom,Douala,4.0881°N 9.7043°E
Exemple Parcelle 1000m²,45000000,XAF,Terrain constructible bien situé,Commercial,À vendre,Partiellement viabilisé,Zone commerciale,1000,45000,25,40,Rectangulaire,Plat,Route goudronnée,Arbustes,Vacant,Eau|Électricité,Oui,Non,Oui,Non,Rue des Cocotiers,Akwa,Douala,4.0490°N 9.6976°E
Exemple Terrain agricole 2ha,30000000,XAF,Terrain fertile zone rurale irrigation possible,Agricole,À vendre,Non viabilisé,Zone agricole,20000,1500,100,200,Irrégulière,Légère pente,Piste,Dense,Cultivé,Eau,Non,Non,Non,Non,Route agricole,Ndogpassi,Douala,4.0792°N 9.7311°E`,

    automobile: `Nom,Prix,Devise,Description,Type véhicule,Type carrosserie,Marque,Modèle,État,Année,Kilométrage,Couleur,Carburant,Transmission,Nb portes,Nb places,Puissance,Cylindrée,Équipements,1ère main,Historique,Contrôle tech,Garantie,Papiers
Exemple Toyota Corolla,8500000,XAF,Voiture en excellent état avec révision complète,Voiture,Berline,Toyota,Corolla,Occasion,2018,65000,Blanc,Essence,Automatique,4,5,110,1600,Climatisation|GPS/Navigation|Caméra de recul|Sièges cuir,Oui,Oui,Oui,6 mois vendeur,En règle
Exemple Honda Civic,7500000,XAF,Véhicule bien entretenu avec historique complet,Voiture,Berline,Honda,Civic,Occasion,2017,75000,Gris,Essence,Manuelle,4,5,140,1800,Climatisation|Bluetooth/USB|ABS|Airbags,Non,Oui,Oui,,En règle
Exemple Mercedes Classe E,25000,EUR,Berline luxe full options cuir GPS,Voiture,Berline,Mercedes,Classe E,Occasion,2019,45000,Noir,Diesel,Automatique,4,5,194,2000,Climatisation|GPS/Navigation|Sièges cuir|Toit ouvrant|Caméra de recul|Jantes alliage,Oui,Oui,Oui,12 mois constructeur,En règle`,

    ticket_voyage: `Nom,Prix,Devise,Description,Compagnie,Type véhicule,Classe,Départ,Destination,Date,Heure,Place,Durée,Escales,Bagage,Repas,WiFi,Prix enfant,Prix bébé,Remboursable,Modifiable,Assurance,N° billet
Exemple Douala-Yaoundé Express,3500,XAF,Trajet direct bus VIP climatisé confortable,Touristique Express,Bus,Économique,Douala,Yaoundé,15/01/2025,08:00,A12,4h30,,Cabine + Soute,Non,Oui,,,Oui,Non,Non,TKT-001234
Exemple Yaoundé-Bafoussam VIP,5000,XAF,Bus grand confort reclining seats avec collation,Central Voyages,Bus,VIP,Yaoundé,Bafoussam,16/01/2025,14:00,B05,3h15,,Cabine + Soute,Oui,Oui,4000,2000,Oui,Oui,Oui,TKT-005678
Exemple Paris-Londres Eurostar,150,EUR,Train Eurostar confort première classe wifi gratuit,Eurostar,Train,Première classe,Paris Gare du Nord,London St Pancras,10/02/2025,10:30,12,2h15,,Cabine uniquement,Oui,Oui,120,50,Oui,Oui,Oui,EUR-789012
Exemple Douala-Paris Vol,450,EUR,Vol direct Air France classe affaires tout inclus,Air France,Avion,Business,Douala,Paris CDG,20/03/2025,22:45,14A,6h30,,Cabine + Soute,Oui,Oui,350,150,Oui,Oui,Oui,AF-456789`,

    hotellerie: `Nom,Prix/nuit,Devise,Description,Type,Catégorie,Nb chambres,Équipements,Services,Petit-déj,Restaurant,Bar,Piscine,Spa,Parking,WiFi,Salle réunion,Adresse,Ville,GPS,Note
Exemple Hôtel Sawa,45000,XAF,Hôtel moderne centre-ville avec restaurant gastronomique et piscine panoramique,Hôtel,3 étoiles,35,Wi-Fi|Piscine|Restaurant|Bar|Climatisation|Parking,Room service|Concierge|Blanchisserie,Oui,Oui,Oui,Oui,Non,Oui,Oui,Oui,Boulevard de la Liberté,Douala,4.0511°N 9.7679°E,4.2
Exemple Auberge du Lac,25000,XAF,Auberge chaleureuse au bord du lac avec vue panoramique et terrasse,Auberge,2 étoiles,12,Wi-Fi|Restaurant|Parking,Petit-déjeuner|Navette,Oui,Oui,Non,Non,Non,Oui,Oui,Non,Route du Lac,Yaoundé,3.8480°N 11.5021°E,4.5
Exemple Resort Paradise,150,EUR,Resort 5 étoiles grand luxe avec spa wellness et plage privée,Resort,5 étoiles,85,Wi-Fi|Piscine|Spa|Gym|Restaurant|Bar|Climatisation|Parking,Room service|Concierge|Blanchisserie|Navette aéroport|Garde d'enfants,Oui,Oui,Oui,Oui,Oui,Oui,Oui,Oui,Front de mer,Kribi,2.9483°N 9.9086°E,4.8
Exemple Chambre d'hôtes,15000,XAF,Chambre d'hôtes familiale accueil chaleureux petit-déjeuner maison,Chambre d'hôtes,Non classé,5,Wi-Fi|Parking,Petit-déjeuner,Oui,Non,Non,Non,Non,Oui,Oui,Non,Quartier résidentiel,Bafoussam,5.4774°N 10.4177°E,4.7`,

    covoiturage: `Nom,Prix,Devise,Description,Départ,Arrivée,Date,Heure,Places disponibles
Trajet Douala-Yaoundé,2500,XAF,Voiture confortable et sécurisée avec climatisation,Bonanjo,Centre-ville Yaoundé,2024-01-15,06:00,3
Trajet Yaoundé-Bafoussam,3500,XAF,SUV climatisé spacieux avec bagages,Yaoundé,Bafoussam,2024-01-16,10:00,4
Trajet aéroport,15,USD,Transport aéroport vers centre-ville,Aéroport Douala,Bonanjo,2024-01-20,14:00,2`,

    vetement: `Nom,Prix,Devise,Description,Type,Genre,Taille,Couleur,Matière,Marque,État,Style,Saison,Patron,Coupe,Certifications
Exemple T-shirt Nike Sport,15000,XAF,T-shirt sport respirant et confortable,T-shirt,Homme,L,Bleu,Polyester,Nike,Neuf avec étiquette,Sport,Été,Uni,Regular,
Exemple Robe Zara Été,25000,XAF,Robe légère motifs floraux,Robe,Femme,M,Multicolore,Coton,Zara,Neuf avec étiquette,Casual,Été,Imprimé floral,Regular,
Exemple Jean Levi's 501,45000,XAF,Jean classique coupe droite indémodable,Jean,Homme,32,Bleu,Denim,Levi's,Occasion - Excellent état,Casual,Toutes saisons,Uni,Droit,
Exemple Veste Cuir Vintage,95000,XAF,Veste cuir marron style vintage,Veste,Unisexe,L,Marron,Cuir,Zara,Vintage,Vintage,Toutes saisons,Uni,Regular,
Exemple Chemise Blanche,35000,XAF,Chemise formelle coton 100% bio,Chemise,Homme,40,Blanc,100% Coton,Ralph Lauren,Neuf sans étiquette,Formel,Toutes saisons,Uni,Slim,Bio`,

    chaussure: `Nom,Prix,Devise,Description,Type,Genre,Pointure,Couleur,Marque,Matériau,État,Usage
Exemple Baskets Nike Air,35000,XAF,Baskets running haute performance amorti exceptionnel,Baskets,Homme,42,Noir,Nike,Synthétique,Neuf,Sport
Exemple Sandales Clarks,15000,XAF,Sandales d'été confortables cuir véritable semelle souple,Sandales,Femme,38,Marron,Clarks,Cuir,Excellent,Casual
Exemple Chaussures ville cuir,85000,XAF,Souliers cuir véritable homme élégant bureau,Chaussures de ville,Homme,43,Marron,Clarks,Cuir,Neuf,Formel
Exemple Bottes Timberland,95000,XAF,Bottes montantes imperméables robustes randonnée,Bottes,Unisexe,41,Beige,Timberland,Cuir,Bon,Sport`,

    electromenager: `Nom,Prix,Devise,Description,Type,Catégorie,Marque,Modèle,État,Année,Garantie,Garantie const,Classe énerg,Capacité,Couleur,Dimensions,Fonctionnalités,Facture,Manuel,Accessoires
Exemple Réfrigérateur Samsung,250000,XAF,Grand réfrigérateur double porte No Frost,Réfrigérateur,Gros électroménager,Samsung,RT50K6000S8,Neuf,2023,2 ans,Oui,A++,350,Inox,185x60x65 cm,No Frost|Smart/WiFi,Oui,Oui,Bacs légumes
Exemple Cuisinière Beko,125000,XAF,Cuisinière 4 feux avec four électrique,Cuisinière,Gros électroménager,Beko,FSG62000DW,Neuf,2024,1 an,Oui,A,,,Blanc,90x60x85 cm,Programmable,Oui,Oui,Grilles four
Exemple Micro-ondes LG,45000,XAF,Micro-ondes 800W avec grill,Micro-ondes,Petit électroménager,LG,MS2535,Occasion,2021,6 mois,Non,B,23,Noir,30x45x35 cm,Dégivrage auto,Non,Oui,Plateau tournant`,

    mobilier: `Nom,Prix,Devise,Description,Type,Catégorie,Style,Matériau,Dimensions,Couleur,État,Nb places,Poids,Livraison,Frais livraison,Montage,Démontable,Garantie
Exemple Canapé 3 places,150000,XAF,Canapé moderne confortable tissu gris,Canapé,Salon,Moderne,Tissu,85x200x90 cm,Gris,Neuf,3,45,Oui,5000,Non,Oui,1 an
Exemple Table à manger,80000,XAF,Table bois massif rectangulaire,Table,Salle à manger,Classique,Bois massif,75x180x90 cm,Bois naturel,Excellent état,6,35,Oui,3000,Non,Oui,6 mois
Exemple Lit 2 places,120000,XAF,Lit avec sommier et matelas inclus,Lit,Chambre,Scandinave,Bois,120x200x40 cm,Blanc,Bon état,2,60,Oui,8000,Oui,Non,2 ans`,

    decoration: `Nom,Prix,Devise,Description,Type,Style,Couleur,Dimensions,Matériau
Tableau abstrait moderne,25000,XAF,Tableau peint à la main style contemporain,Tableau,Moderne,Multicolore,80x60 cm,Toile
Lampe design scandinave,15000,EUR,Luminaire minimaliste avec abat-jour tissu,Luminaire,Scandinave,Blanc et bois,45 cm,Bois/Tissu
Tapis berbère artisanal,45000,XAF,Tapis fait main motifs traditionnels,Tapis,Bohème,Beige et rouge,200x150 cm,Laine`,

    assurance: `Nom,Prix,Devise,Description,Catégorie,Type,Compagnie,Couverture,Prime annuelle,Franchise,Durée,Bénéfices
Assurance auto tous risques,180000,XAF,Protection complète pour véhicule,Non-Vie,Auto,AXA Cameroun,Dommages + Vol + Incendie + RC,180000,100000,1 an,Assistance 24h|Véhicule remplacement|Protection juridique
Assurance vie temporaire,120000,USD,Assurance décès avec capital garanti,Vie,Temporaire décès,NSIA Assurances,Capital décès 50M|Invalidité permanente,120000,0,5 ans,Capital décès|Rente conjoint|Protection famille
Assurance habitation,95000,XAF,Protection logement et responsabilité civile,Non-Vie,Habitation,Activa Assurance,Incendie|Dégâts eaux|Vol|RC,95000,50000,2 ans,Relogement|Assistance juridique|Remplacement`,

    aliments: `Nom,Prix,Devise,Description,Catégorie,Type,Origine,Bio,Date prod,Date exp,Conservation,Poids,Unité,Conditionnement,Labels,Certifications,Allergènes,Stock
Exemple Tomates fraîches,500,XAF,Tomates rouges mûres du terroir,Légumes,Frais,Cameroun,Oui,20/10/2025,28/10/2025,Réfrigéré,1,Kg,Vrac,Bio,Vegan,Aucun,100
Exemple Poulet fermier,3500,XAF,Poulet élevé plein air grain,Viandes,Frais,Cameroun,Non,22/10/2025,27/10/2025,Réfrigéré,1.5,Kg,Barquette,,Halal,Aucun,25
Exemple Mangues Kent,1500,XAF,Mangues sucrées saison,Fruits,Frais,Cameroun,Oui,18/10/2025,02/11/2025,Température ambiante,2,Kg,Vrac,Bio|Label Rouge,Vegan,Aucun,80
Riz basmati premium,12,USD,Riz basmati qualité supérieure grain long,Céréales,Importée,2025-12-31,25kg,Sec,Standard
Fromage Emmental,8,EUR,Fromage suisse qualité AOP,Produits laitiers,Importée,2024-03-15,500g,Frais,AOC`,

    telephone: `Nom,Prix,Devise,Description,Marque,Modèle,Stockage,RAM,État,Couleur,Opérateur,Année,IMEI,Garantie,Santé batterie,Taille écran,Caméra principale,5G,Double SIM,Boîte origine,Facture,Écran original,Accessoires
iPhone 14 Pro,450000,XAF,iPhone excellent état boîte complète,Apple,iPhone 14 Pro,256GB,6GB,Neuf sous garantie,Graphite,Débloqué,2023,356789101234567,12 mois,98%,6.1 pouces,48MP Triple,Oui,Oui,Oui,Oui,Oui,Chargeur|Écouteurs|Coque
Samsung Galaxy S23,380000,XAF,Samsung dernière génération garantie,Samsung,Galaxy S23,128GB,8GB,Neuf sous garantie,Blanc,Débloqué,2024,356789101234568,24 mois,100%,6.1 pouces,50MP,Oui,Oui,Oui,Oui,Oui,Chargeur|Câble USB
Google Pixel 7,320000,XAF,Pixel 7 photo exceptionnelle Android pur,Google,Pixel 7,256GB,8GB,Occasion - Excellent état,Noir,Débloqué,2022,356789101234569,6 mois,92%,6.3 pouces,50MP,Non,Oui,Oui,Non,Oui,Chargeur|Protège-écran`,

    ordinateur: `Nom,Prix,Devise,Description,Type,Marque,Modèle,Processeur,RAM,Stockage,Carte graphique,OS,État,Année,Usage,Taille écran,Garantie,SSD,Tactile,Webcam,Boîte,Facture,Accessoires,Logiciels
MacBook Pro M2,1200000,XAF,MacBook Pro puce M2 parfait état,MacBook,Apple,MacBook Pro 14,Apple M2 Pro,16GB,512GB SSD,Apple GPU,macOS Ventura,Neuf sous garantie,2023,Design graphique,14",24 mois,Oui,Non,Oui,Oui,Oui,Chargeur|Câble USB-C|Sac,Final Cut Pro|Logic Pro
Dell XPS 15,950000,XAF,PC portable puissant développement gaming,PC Portable,Dell,XPS 15,Intel Core i7,32GB,1TB SSD,NVIDIA GeForce RTX 3050,Windows 11,Neuf sous garantie,2024,Développement,15.6",18 mois,Oui,Oui,Oui,Oui,Oui,Chargeur|Souris|Sac,Microsoft Office|Antivirus
PC Gamer Desktop,1800000,XAF,Tour gaming RGB watercooling,PC de bureau,Custom,RGB Gaming,AMD Ryzen 9,64GB,2TB SSD,NVIDIA GeForce RTX 4080,Windows 11,Neuf,2024,Gaming,27",12 mois,Oui,Non,Oui,Non,Oui,Clavier RGB|Souris gaming|Casque,Steam|Discord`,

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

    prestation_service: `Nom,Prix,Devise,Description,Catégorie,Type,Durée,Zone,Expérience,Certifié,Déplacement,Disponibilité
Exemple Électricien Pro,35000,XAF,Installation et réparation électrique tous travaux devis gratuit,Bâtiment,Installation,1 jour,Yaoundé,12,Oui,Oui,Immédiate
Exemple Coiffure Domicile,15000,XAF,Coiffure professionnelle à domicile hommes femmes enfants,Beauté,Coiffure,2 heures,Douala,5,Oui,Oui,Cette semaine
Exemple Cours Informatique,25000,XAF,Formation bureautique Word Excel PowerPoint débutants,Éducation,Formation,4 heures,Tout le Cameroun,8,Oui,Non,Ce mois
Exemple Réparation Climatisation,40000,XAF,Réparation et maintenance climatisation toutes marques,Mécanique,Réparation,Sur devis,Yaoundé,15,Oui,Oui,Immédiate`,

    pharmacie: `Nom,Prix,Devise,Description,Type,Heures ouverture,Heures fermeture,Jours de garde,Téléphone urgence,Services
Exemple Pharmacie garde,0,XAF,Exemple de pharmacie de garde 24h/24,Permanence nuit,00:00,23:59,Tous les jours,+237 6XX XX XX XX,Garde|Délivrance|Conseil
Exemple Pharmacie normale,0,XAF,Exemple de pharmacie de proximité,Normale,08:00,20:00,Lun, Mar, Mer, Jeu, Ven, Sam,+237 6XX XX XX XX,Délivrance|Conseil`,

    hopital_clinique: `Nom,Prix,Devise,Description,Type,Banque de sang,Prestations médicales,Planning,Urgences 24h/24,RDV en ligne
Exemple Hôpital,0,XAF,Exemple d'établissement avec urgences et banque de sang,Hôpital,Oui,Chirurgie|Consultation générale|Radiologie,Lun-Ven 08:00-18:00,Oui,Non
Exemple Clinique,0,XAF,Exemple de clinique privée avec RDV en ligne,Clinique,Non,Gynécologie|Ophtalmologie|Pédiatrie,Lun-Sam 09:00-19:00,Non,Oui`,

    laboratoire: `Nom,Prix,Devise,Description,Type,Examens disponibles,Planning,Prélèvement domicile,Résultats rapides,RDV en ligne
Exemple Labo Analyses,0,XAF,Exemple de laboratoire d'analyses médicales,Laboratoire d'analyses médicales,Hématologie|Biochimie|Sérologie|Parasitologie,Lun-Sam 07:00-18:00,Oui,Oui,Oui
Exemple Centre Imagerie,0,XAF,Exemple de centre d'imagerie médicale,Centre d'imagerie médicale,Scanner|IRM|Radiographie|Échographie,Lun-Ven 08:00-18:00,Non,Oui,Oui
Exemple Centre Mixte,0,XAF,Exemple de centre mixte analyses et imagerie,Laboratoire & Imagerie (Mixte),Hématologie|Biochimie|Scanner|IRM,Lun-Dim 24h/24,Oui,Oui,Oui`,

    demenagement: `Nom,Prix,Devise,Description,Type,Volume,Type véhicule,Distance,Services,Nb déménageurs,Assurance,Montage,Cartons,Date début
Exemple Déménagement Express,50000,XAF,Déménagement local rapide avec équipe professionnelle,Déménagement local,F2 (20-30m³),Camionnette 20m³,10-50 km,Emballage|Transport|Déballage,3,Oui,Oui,Oui,15/11/2025
Exemple Trans-Afrique Déménagement,150000,XAF,Déménagement international avec assurance tous risques,Déménagement international,F4 (40-50m³),Camion 40m³,Plus de 300 km,Emballage|Transport|Déballage|Montage meubles|Assurance,5,Oui,Oui,Oui,20/11/2025
Exemple Garde-Meubles Sécurisé,25000,XAF,Service garde-meubles avec accès 24/7 sécurisé,Garde-meubles,F3 (30-40m³),Camion 30m³,Moins de 10 km,Transport|Assurance,2,Oui,Non,Non,01/11/2025`,

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

    restauration: `Nom,Prix,Devise,Description,Type cuisine,Type établissement,Spécialités,Services,Gamme prix,Capacité,Horaires,Ambiance,Chef,Menu jour,Régimes spéciaux,Livraison,Terrasse,Parking,WiFi,Réservation,Adresse
Exemple Restaurant Le Palais,0,XAF,Restaurant gastronomique africain avec terrasse panoramique,Africaine,Restaurant,Ndolé|Poulet DG|Eru,Sur place|À emporter|Livraison,Moyen (2000-5000 FCFA),100,11:00-23:00,Familiale,Chef Mbarga,Poisson braisé sauce tomate,Halal,Oui,Oui,Oui,Oui,Oui,Boulevard de la Liberté Bonanjo Douala
Exemple Café Beaulieu,0,XAF,Café moderne avec wifi gratuit et pâtisseries artisanales,Française,Café,Croissants|Sandwiches|Salades,Sur place|À emporter,Économique (< 2000 FCFA),30,07:00-20:00,Calme,Chef Dupont,Quiche lorraine,Végétarien,Non,Oui,Non,Oui,Oui,Avenue de Gaulle Akwa Douala
Exemple Traiteur Excellence,15000,XAF,Service traiteur haut de gamme pour événements professionnels,Internationale,Traiteur,Buffet|Cocktail|Menu personnalisé,Livraison|Traiteur|Événementiel,Premium (> 10000 FCFA),500,Sur réservation,Professionnel,Chef Bernard,Menu sur mesure,Halal|Vegan|Sans gluten,Oui,Non,Oui,Non,Oui,Rue des Palmiers Bonapriso Douala
Exemple Maquis Chez Tantine,0,XAF,Maquis traditionnel grillades et poisson braisé,Camerounaise,Maquis,Poisson braisé|Poulet DG|Kati-kati,Sur place,Économique (< 2000 FCFA),80,18:00-02:00,Décontractée,Tantine Marie,Poisson fumé,Halal,Non,Oui,Oui,Non,Non,Carrefour Ndokoti Douala`,

    electronique: `Nom,Prix,Devise,Description,Type,Marque,Modèle,État,Garantie,Connectivités
Console PlayStation 5,350000,XAF,Console nouvelle génération 4K 120fps avec manette,Console de jeux,Sony,PS5 Standard,Neuf,2 ans,Wi-Fi|Bluetooth|USB-C
Drone DJI Mini 3,285000,XAF,Drone compact caméra 4K stabilisée avec télécommande,Drone,DJI,Mini 3 Pro,Neuf,1 an,Wi-Fi|Bluetooth
Caméra GoPro Hero11,180000,XAF,Caméra action étanche 5.3K hypersmooth,Caméra action,GoPro,Hero 11 Black,Neuf,1 an,Wi-Fi|Bluetooth|USB-C`,

    musique_instruments: `Nom,Prix,Devise,Description,Type,Catégorie,Marque,Modèle,État,Année,Matériau,Couleur,Taille,Nb cordes,Type amplification,Puissance ampli,Accessoires,Garantie,Facture,Révision récente,Origine
Exemple Guitare Yamaha F310,85000,XAF,Guitare folk acoustique sonorité riche et chaude,Guitare,Instrument,Yamaha,F310,Neuf,2023,Bois,Naturel,4/4,6,Acoustique,,Housse|Accordeur|Médiators,1 an,Oui,Non,Japon
Exemple Piano Casio CDP-S110,180000,XAF,Piano numérique 88 touches toucher lourd et sons réalistes,Piano,Instrument,Casio,CDP-S110,Excellent,2022,Plastique,Noir,Standard,,Électrique,,Pédale sustain|Stand|Casque,6 mois,Oui,Non,Japon
Exemple Djembé artisanal,35000,XAF,Djembé fait main peau chèvre avec sculpture traditionnelle,Djembé,Instrument,Artisanal,Traditionnel,Neuf,2024,Bois,Marron,Medium,,,,,Housse de protection,,Non,Non,Cameroun
Exemple Basse Fender Jazz,250000,XAF,Basse électrique 4 cordes son vintage professionnel,Basse,Instrument,Fender,Jazz Bass,Bon,2019,Bois,Sunburst,4/4,4,Électrique,,Câble jack|Sangle,2 ans,Oui,Oui,USA
Exemple Ampli Marshall 50W,125000,XAF,Amplificateur guitare électrique son rock classique,Amplificateur,Sonorisation,Marshall,MG50,Excellent,2021,Métal,Noir,Standard,,,50W,Câble jack|Footswitch,1 an,Oui,Non,UK`,

    emploi: `Nom,Prix,Devise,Description,Poste,Type contrat,Domaine,Expérience,Salaire min,Salaire max,Lieu,Type emploi,Compétences,Diplôme,Langues,Avantages,Date début,Durée
Exemple Développeur Full Stack,500000,XAF,Poste développeur web stack MERN dans startup innovante,Développeur Full Stack,CDI,Informatique/IT,2-5 ans,450000,550000,Douala,Temps plein,React|Node.js|MongoDB|TypeScript|Git,Licence,Français|Anglais,Assurance santé|Primes|Formation continue,01/11/2025,
Exemple Chef de Projet Marketing,650000,XAF,Chef projet digital marketing réseaux sociaux et campagnes,Chef de Projet Marketing,CDI,Marketing/Communication,5-10 ans,600000,700000,Yaoundé,Hybride (Télétravail partiel),Marketing digital|Réseaux sociaux|Google Ads|Analytics,Master,Français|Anglais,Assurance santé|13ème mois|Véhicule fonction,15/11/2025,
Exemple Stagiaire Comptabilité,100000,XAF,Stage comptabilité générale et analytique 6 mois,Stagiaire Comptable,Stage,Finance/Comptabilité,Débutant/Sans expérience,100000,100000,Douala,Temps plein,Excel|Sage|Comptabilité générale,BTS/DUT,Français,Indemnité stage,01/12/2025,6 mois
Exemple Consultant Freelance IT,80000,XAF,Mission conseil transformation digitale entreprises,Consultant IT,Freelance,Informatique/IT,5-10 ans,,,Télétravail complet,Cloud|DevOps|Architecture|Consulting,Master,Français|Anglais,Mission courte durée,Variable,3 mois`,

    formation_education: `Nom,Prix,Devise,Description,Domaine,Type,Niveau,Mode,Durée,Certification,Matières,Formateur,Horaires,Langue,Prérequis,Objectifs,Places disponibles
Exemple Formation Développement Web,150000,XAF,Formation complète stack MERN avec projets pratiques,Informatique/IT,Formation professionnelle,Débutant,Présentiel,3 mois,Attestation professionnelle,HTML|CSS|JavaScript|React|Node.js,Jean-Paul Ngono,Lun-Ven 18:00-21:00,Français,Bases informatique,Devenir développeur full stack,15
Exemple Cours Anglais Intensif,75000,XAF,Cours anglais conversation grammaire préparation TOEFL,Langues,Cours de langue,Intermédiaire,Hybride,2 mois,Certificat Cambridge,Grammaire|Conversation|TOEFL,Sarah Johnson,Mar-Jeu 17:00-19:00,Anglais,Niveau A2 minimum,Maîtriser anglais professionnel,20
Exemple Soutien Maths Terminale,25000,XAF,Aide devoirs révisions préparation baccalauréat,Mathématiques,Soutien scolaire,Terminale,À domicile,1 mois,Non,Mathématiques|Physique,Prof Kamdem,Flexible selon élève,Français,Élève terminale,Réussir baccalauréat,5
Exemple Coaching Business,200000,XAF,Accompagnement personnalisé création entreprise A à Z,Management,Coaching professionnel,Professionnel,En ligne,6 mois,Certification coaching,Business plan|Finance|Marketing|Leadership,Coach Bernard Fotso,Flexible en ligne,Français|Anglais,Projet entreprise,Créer entreprise viable,10`,

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

    plomberie: `Nom,Prix,Devise,Description,Type prestation,Spécialités,Équipements,Disponibilité,Garantie,Urgence,Devis gratuit,Certification
Exemple Installation Chauffe-eau Pro,85000,XAF,Pose chauffe-eau électrique 150L avec raccordement complet,Installation,Installation chauffe-eau|Raccordement eau,Chauffe-eau|Tuyauterie|Robinetterie,Rendez-vous planifié,1 an,Non,Oui,Plombier agréé
Exemple Débouchage Express 24/7,15000,XAF,Débouchage évier lavabo WC avec équipement professionnel haute pression,Dépannage,Débouchage canalisations,WC|Lavabo|Douche|Tuyauterie,Urgence 24h/24,3 mois,Oui,Oui,Certifié
Exemple Rénovation Salle de Bain,350000,XAF,Rénovation complète salle de bain avec installation douche italienne,Installation,Rénovation salle de bain|Installation sanitaire,Douche|Baignoire|Lavabo|WC|Robinetterie,Rendez-vous sous 24h,2 ans,Non,Oui,Garantie décennale
Exemple Réparation Fuite Rapide,25000,XAF,Détection et réparation fuite eau avec caméra thermique garantie 6 mois,Réparation,Réparation fuite|Détection de fuite,Tuyauterie|Robinetterie,Intervention rapide (2h),6 mois,Oui,Oui,Plombier certifié`,

    nettoyage: `Nom,Prix,Devise,Description,Type,Fréquence,Services,Surface,Produits,Produits bio,Matériel inclus,RC
Exemple Nettoyage Résidentiel Pro,35000,XAF,Nettoyage complet appartement avec produits écologiques,Nettoyage résidentiel,Hebdomadaire,Dépoussiérage|Aspiration|Lavage sols|Nettoyage sanitaires|Nettoyage cuisine,50-100m²,Produits bio/écologiques,Oui,Oui,Oui
Exemple Nettoyage Bureaux Premium,75000,XAF,Nettoyage bureaux avec désinfection professionnelle complète,Nettoyage bureaux,Mensuel,Dépoussiérage|Aspiration|Lavage sols|Nettoyage sanitaires|Vitrerie|Désinfection,200-500m²,Produits professionnels,Non,Oui,Oui
Exemple Nettoyage Après Travaux,150000,XAF,Grand nettoyage après rénovation avec évacuation déchets,Nettoyage après travaux,Ponctuel,Dépoussiérage|Aspiration|Lavage sols|Désinfection,100-200m²,Produits professionnels,Non,Oui,Oui
Exemple Nettoyage Vitres Immeuble,45000,XAF,Nettoyage vitres immeuble avec nacelle équipement pro,Nettoyage vitres,Trimestriel,Vitrerie,Plus de 500m²,Vapeur/Sans chimique,Oui,Oui,Oui`,

    reparation: `Nom,Prix,Devise,Description,Type,Spécialité,Marque,Délai,Garantie,Diagnostic gratuit,Déplacement inclus,Pièces origine
Exemple Réparation iPhone Express,25000,XAF,Réparation écran iPhone avec pièces d'origine garantie 6 mois,Réparation téléphone,Écran cassé,Apple,Express (même jour),6 mois,Oui,Non,Oui
Exemple Réparation Ordinateur Dell,35000,XAF,Diagnostic et réparation ordinateur toutes pannes,Réparation ordinateur,Carte mère,Dell,24-48h,3 mois,Oui,Oui,Non
Exemple Réparation Électroménager,45000,XAF,Réparation machines à laver toutes marques avec garantie,Réparation électroménager,Moteur,Toutes marques,2-5 jours,1 an,Oui,Oui,Non
Exemple Réparation Auto Freins,75000,XAF,Réparation et changement freins avec pièces d'origine,Réparation automobile,Freins,Toutes marques,24-48h,6 mois,Non,Non,Oui`,

    carrelage: `Nom,Prix,Devise,Description,Type,Matériau,Dimensions,Finition,Épaisseur,Usage,Aspect,Couleur,Surface m²,Origine
Exemple Carrelage Sol Premium,8500,XAF,Carrelage grès cérame effet bois antidérapant qualité supérieure,Carrelage sol,Grès cérame,60x60cm,Antidérapant,10mm,Intérieur résidentiel,Bois,Chêne naturel,25,Espagne
Exemple Faïence Salle Bain Blanche,4500,XAF,Faïence murale brillante pour salle de bain résistante humidité,Carrelage mural,Céramique,30x30cm,Brillant,8mm,Salle de bain,Uni,Blanc,15,Italie
Exemple Carrelage Piscine Bleu,12000,XAF,Carrelage spécial piscine antidérapant résistant chlore,Carrelage piscine,Porcelaine,30x30cm,Antidérapant,12mm,Piscine,Uni,Bleu azur,50,Portugal
Exemple Mosaïque Décorative,15000,XAF,Mosaïque murale effet marbre pour décoration intérieure luxe,Mosaïque,Marbre,15x15cm,Poli,6mm,Intérieur commercial,Marbré,Beige|Gris,10,Turquie`,

    bricolage: `Nom,Prix,Devise,Description,Type,Catégorie,Marque,État,Puissance,Garantie
Exemple Perceuse Bosch Pro,45000,XAF,Perceuse visseuse sans fil batterie lithium professionnel,Outils électriques,Perceuses,Bosch,Neuf,18V,2 ans
Exemple Marteau Stanley,5500,XAF,Marteau menuisier manche bois tête acier forgé,Outils manuels,Marteaux,Stanley,Neuf,N/A,1 an
Exemple Scie Circulaire Makita,75000,XAF,Scie circulaire 1200W lame carbure guide laser,Outils électriques,Scies,Makita,Neuf,1200W,3 ans`,

    enfants_bebes: `Nom,Prix,Devise,Description,Catégorie,Âge,État,Taille,Marque,Norme sécurité
Exemple Poussette Trio Chicco,150000,XAF,Poussette 3en1 avec siège auto et nacelle conforme CE,Poussettes,0-3 ans,Neuf avec étiquette,N/A,Chicco,Oui
Exemple Body Bébé Coton,3500,XAF,Lot 3 bodies coton bio manches courtes,Vêtements bébé,0-3 mois,Neuf,3 mois,Petit Bateau,Oui
Exemple Siège Auto Bébé Confort,85000,XAF,Siège auto groupe 0+ isofix rotation 360° testé crash,Sièges auto,0-12 mois,Neuf,N/A,Bébé Confort,Oui`,

    decoration: `Nom,Prix,Devise,Description,Type,Style,Pièce,Matériau,Couleur,Dimensions
Exemple Lampe Scandinave,35000,XAF,Lampe sur pied design scandinave avec abat-jour tissu blanc,Luminaires,Scandinave,Salon,Bois|Tissu,Blanc,H150cm
Exemple Tapis Berbère,65000,XAF,Tapis berbère fait main laine 100% naturelle motifs géométriques,Tapis,Bohème,Salon,Laine,Beige|Noir,200x300cm
Exemple Miroir Mural Doré,28000,XAF,Miroir rond cadre métal doré style vintage,Miroirs,Vintage,Chambre,Métal,Doré,Ø80cm`,

    sante_beaute: `Nom,Prix,Devise,Description,Type,Marque,Volume,Bio
Exemple Crème Nivea Visage,8500,XAF,Crème hydratante visage peaux sensibles 50ml formule douce,Soins visage,Nivea,50ml,Non
Exemple Shampoing L'Oréal,12000,XAF,Shampoing réparateur cheveux abîmés 250ml sans sulfate,Soins cheveux,L'Oréal,250ml,Oui
Exemple Rouge à Lèvres,5500,XAF,Rouge à lèvres mat longue tenue couleur rouge intense,Maquillage,Garnier,4g,Non`,

    juridique: `Nom,Prix,Devise,Description,Type,Spécialité,Expérience,Tarif horaire
Exemple Conseil Juridique Affaires,50000,XAF,Consultation avocat droit des affaires contrats commerciaux,Conseil juridique,Droit des affaires,10 ans,50000
Exemple Divorce Amiable,150000,XAF,Procédure divorce amiable avec accord sur garde enfants,Divorce,Droit de la famille,15 ans,N/A
Exemple Rédaction Contrat,75000,XAF,Rédaction contrat travail commercial bail personnalisé,Rédaction contrat,Droit du travail,8 ans,75000`,

    musique_services: `Nom,Prix,Devise,Description,Type,Genre,Durée,Matériel inclus
Exemple DJ Mariage Pro,200000,XAF,Animation DJ mariage avec sonorisation éclairage playlist personnalisée,DJ,Variété,4h,Oui
Exemple Cours Piano Particulier,25000,XAF,Cours piano individuels tous niveaux débutant à avancé,Cours de musique,Classique,1h,Non
Exemple Groupe Live Afrobeat,350000,XAF,Groupe live 5 musiciens afrobeat makossa ambiance garantie,Groupe live,Afrobeat,3h,Oui`,

    photographie: `Nom,Prix,Devise,Description,Type,Style,Équipement,Retouches
Exemple Photo Mariage Complet,250000,XAF,Reportage mariage complet cérémonie réception 300 photos retouchées,Mariage,Moderne,Drone|Studio mobile,Oui
Exemple Portrait Pro Studio,35000,XAF,Séance portrait professionnel studio éclairage pro 10 photos,Portrait,Classique,Studio mobile,Oui
Exemple Photo Événement,150000,XAF,Couverture événement corporate conférence soirée entreprise,Événement,Moderne,Éclairage professionnel,Non`,

    entreprise_industrie: `Nom,Prix,Devise,Description,Type,Secteur,Certification,État
Exemple Bureau Direction Luxe,450000,XAF,Bureau direction bois massif design ergonomique tiroirs sécurisés,Matériel bureau,Commerce,ISO 9001,Neuf
Exemple Machine Découpe Laser,2500000,XAF,Machine découpe laser industrielle précision 0.1mm capacité métal,Machines industrielles,Industrie,CE,Excellent état
Exemple Échafaudage Pro,180000,XAF,Échafaudage professionnel aluminium 6m hauteur normes sécurité,Équipement professionnel,BTP,NF,Bon état`,

    bien_etre: `Nom,Prix,Devise,Description,Type,Durée,Tarifs spéciaux,Package dispo
Exemple Massage Relaxant,25000,XAF,Massage relaxant corps entier huiles essentielles ambiance zen,Massage,1h,Non,Oui
Exemple Spa Couple Premium,85000,XAF,Forfait spa couple hammam sauna jacuzzi massage champagne,Spa,3h,Oui,Oui
Exemple Yoga Collectif,15000,XAF,Séance yoga collectif tous niveaux dans parc naturel,Yoga,1h30,Non,Non`,

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
            laboratoire: 'Nom du laboratoire',
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
            laboratoire: 'Ex: Laboratoire CERBA',
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
                                typeImmobilier: columns[4],
                                statutImmobilier: columns[5],
                                standing: columns[6],
                                etatGeneral: columns[7],
                                superficie: columns[8],
                                nbChambres: columns[9],
                                nbSallesBain: columns[10],
                                ameublement: columns[11],
                                etage: columns[12],
                                anneeConstruction: columns[13],
                                parking: columns[14]?.toLowerCase() === 'oui',
                                ascenseur: columns[15]?.toLowerCase() === 'oui',
                                jardin: columns[16]?.toLowerCase() === 'oui',
                                piscine: columns[17]?.toLowerCase() === 'oui',
                                securite: columns[18]?.toLowerCase() === 'oui',
                                internet: columns[19]?.toLowerCase() === 'oui',
                                climatisation: columns[20]?.toLowerCase() === 'oui',
                                adresse: columns[21],
                                quartier: columns[22],
                                ville: columns[23],
                                gpsImmobilier: columns[24]
                            } as Product;
                            break;

                        case 'immobilier_location_courte':
                            specificProduct = {
                                ...baseProduct,
                                typeImmobilier: columns[4],
                                statutImmobilier: 'Location courte durée', // Statut fixé automatiquement
                                standing: columns[5],
                                etatGeneral: columns[6],
                                superficie: columns[7],
                                nbChambres: columns[8],
                                nbSallesBain: columns[9],
                                ameublement: columns[10],
                                capacitePersonnes: columns[11],
                                equipementsImmo: columns[12]?.split('|').map(e => e.trim()).filter(e => e),
                                nettoyageInclus: columns[13]?.toLowerCase() === 'oui',
                                lingeInclus: columns[14]?.toLowerCase() === 'oui',
                                dureeMinimum: columns[15],
                                dureeMaximum: columns[16],
                                reservationInstantanee: columns[17]?.toLowerCase() === 'oui',
                                parking: columns[18]?.toLowerCase() === 'oui',
                                internet: columns[19]?.toLowerCase() === 'oui',
                                climatisation: columns[20]?.toLowerCase() === 'oui',
                                adresse: columns[21],
                                quartier: columns[22],
                                ville: columns[23],
                                gpsImmobilier: columns[24]
                            } as Product;
                            break;

                        case 'immobilier_terrain':
                            specificProduct = {
                                ...baseProduct,
                                typeTerrain: columns[4],
                                statutImmobilier: columns[5],
                                viabilisation: columns[6],
                                zonage: columns[7],
                                superficie: columns[8],
                                prixMetreCarre: columns[9],
                                largeurFacade: columns[10],
                                profondeur: columns[11],
                                formeTerrain: columns[12],
                                topographie: columns[13],
                                accesTerrain: columns[14],
                                vegetation: columns[15],
                                usageActuel: columns[16],
                                reseauxTerrain: columns[17]?.split('|').map(r => r.trim()).filter(r => r),
                                titreFoncier: columns[18]?.toLowerCase() === 'oui',
                                bornage: columns[19]?.toLowerCase() === 'oui',
                                constructibilite: columns[20]?.toLowerCase() === 'oui',
                                cloture: columns[21]?.toLowerCase() === 'oui',
                                adresse: columns[22],
                                quartier: columns[23],
                                ville: columns[24],
                                gpsImmobilier: columns[25]
                            } as Product;
                            break;

                        case 'automobile':
                            specificProduct = {
                                ...baseProduct,
                                typeVehicule: columns[4],
                                typeCarrosserie: columns[5],
                                marqueAutomobile: columns[6],
                                modeleAutomobile: columns[7],
                                etatVehicule: columns[8],
                                annee: columns[9],
                                kilometrage: columns[10],
                                couleurAutomobile: columns[11],
                                typeCarburant: columns[12],
                                transmission: columns[13],
                                nbPortes: columns[14],
                                nbPlaces: columns[15],
                                puissance: columns[16],
                                cylindree: columns[17],
                                equipementsAuto: columns[18]?.split('|').map(e => e.trim()).filter(e => e),
                                premiereMain: columns[19]?.toLowerCase() === 'oui',
                                historiqueEntretien: columns[20]?.toLowerCase() === 'oui',
                                contreTechnique: columns[21]?.toLowerCase() === 'oui',
                                garantie: columns[22],
                                papiers: columns[23]
                            } as Product;
                            break;

                        case 'ticket_voyage':
                            specificProduct = {
                                ...baseProduct,
                                compagnieTransport: columns[4],
                                typeVehiculeTransport: columns[5],
                                classeVoyage: columns[6],
                                depart: columns[7],
                                destination: columns[8],
                                dateDepart: columns[9],
                                heureDepart: columns[10],
                                numeroPlace: columns[11],
                                dureeTrajet: columns[12],
                                escales: columns[13]?.split('|').map(e => e.trim()).filter(e => e),
                                bagage: columns[14],
                                repas: columns[15]?.toLowerCase() === 'oui',
                                wifi: columns[16]?.toLowerCase() === 'oui',
                                prixEnfant: columns[17],
                                prixBebe: columns[18],
                                remboursable: columns[19]?.toLowerCase() === 'oui',
                                modifiable: columns[20]?.toLowerCase() === 'oui',
                                assuranceVoyage: columns[21]?.toLowerCase() === 'oui',
                                numeroBillet: columns[22]
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
                                typeVetement: columns[4],
                                genreVetement: columns[5],
                                taille: columns[6],
                                couleurVetement: columns[7],
                                matiereVetement: columns[8],
                                marqueVetement: columns[9],
                                etatVetement: columns[10],
                                styleVetement: columns[11],
                                saisonVetement: columns[12],
                                patronVetement: columns[13],
                                coupeVetement: columns[14],
                                certifieVetement: columns[15]?.split('|').map(c => c.trim()).filter(c => c)
                            } as Product;
                            break;

                        case 'chaussure':
                            specificProduct = {
                                ...baseProduct,
                                typeChaussure: columns[4],
                                genreChaussure: columns[5],
                                pointure: columns[6],
                                couleurChaussure: columns[7],
                                marqueChaussure: columns[8],
                                materiauChaussure: columns[9],
                                etatChaussure: columns[10],
                                usageChaussure: columns[11]
                            } as Product;
                            break;

                        case 'electromenager':
                            specificProduct = {
                                ...baseProduct,
                                typeElectro: columns[4],
                                categorieElectro: columns[5],
                                marqueElectro: columns[6],
                                modeleElectro: columns[7],
                                etatElectro: columns[8],
                                anneeAchat: columns[9],
                                garantieElectro: columns[10],
                                garantieConstructeur: columns[11]?.toLowerCase() === 'oui',
                                consommationEnergetique: columns[12],
                                capacite: columns[13],
                                couleurElectro: columns[14],
                                dimensionsElectro: columns[15],
                                fonctionnalites: columns[16]?.split('|').map(f => f.trim()).filter(f => f),
                                facture: columns[17]?.toLowerCase() === 'oui',
                                manuel: columns[18]?.toLowerCase() === 'oui',
                                accessoires: columns[19]
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
                                categorieAssurance: columns[4], // Catégorie
                                typeAssurance: columns[5], // Type
                                compagnieAssurance: columns[6], // Compagnie
                                typeCouverture: columns[7], // Couverture
                                primeAnnuelle: columns[8], // Prime annuelle
                                franchiseAssurance: columns[9], // Franchise
                                dureeContrat: columns[10], // Durée
                                benefices: columns[11]?.split('|').map(b => b.trim()).filter(b => b) // Bénéfices
                            } as Product;
                            break;

                        case 'mobilier':
                            specificProduct = {
                                ...baseProduct,
                                typeMobilier: columns[4],
                                categorieMobilier: columns[5],
                                styleMobilier: columns[6],
                                materiauMobilier: columns[7],
                                dimensionsMobilier: columns[8],
                                couleurMobilier: columns[9],
                                etatMobilier: columns[10],
                                nombrePlaces: columns[11],
                                poids: columns[12],
                                livraison: columns[13]?.toLowerCase() === 'oui',
                                fraisLivraison: columns[14],
                                montageRequis: columns[15]?.toLowerCase() === 'oui',
                                demontable: columns[16]?.toLowerCase() === 'oui',
                                garantieMobilier: columns[17]
                            } as Product;
                            break;

                        case 'aliments':
                        case 'agroalimentaire':
                            specificProduct = {
                                ...baseProduct,
                                categorieAliment: columns[4],
                                typeAliment: columns[5],
                                origine: columns[6],
                                bio: columns[7]?.toLowerCase() === 'oui',
                                dateProduction: columns[8],
                                dateExpiration: columns[9],
                                conservation: columns[10],
                                poids: columns[11],
                                uniteMesure: columns[12],
                                conditionnement: columns[13],
                                labelQualite: columns[14]?.split('|').map(l => l.trim()).filter(l => l),
                                certifications: columns[15]?.split('|').map(c => c.trim()).filter(c => c),
                                allergenes: columns[16],
                                stockDisponible: columns[17] ? parseInt(columns[17]) : undefined
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
                                ...baseProduct,
                                categoriePrestation: columns[4], // Catégorie
                                typePrestation: columns[5], // Type
                                dureePrestation: columns[6], // Durée
                                zoneIntervention: columns[7], // Zone
                                experienceAnnees: columns[8] ? parseInt(columns[8]) : undefined, // Expérience
                                certifie: columns[9]?.toLowerCase() === 'oui', // Certifié
                                deplacement: columns[10]?.toLowerCase() === 'oui', // Déplacement
                                disponibilitePrestation: columns[11] // Disponibilité
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

                        case 'laboratoire':
                            specificProduct = {
                                ...baseProduct,
                                typeLaboratoire: columns[4],
                                examensLaboratoire: columns[5]?.split('|').map(s => s.trim()).filter(s => s),
                                horairesConsultation: columns[6],
                                prelevementDomicile: columns[7]?.toLowerCase() === 'oui',
                                resultatRapide: columns[8]?.toLowerCase() === 'oui',
                                rdvEnLigne: columns[9]?.toLowerCase() === 'oui'
                            } as Product;
                            break;

                        case 'demenagement':
                            specificProduct = {
                                ...baseProduct,
                                typeDemenagement: columns[4], // Type
                                volumeDemenagement: columns[5], // Volume
                                typeVehiculeDemenagement: columns[6], // Type véhicule
                                distanceDemenagement: columns[7], // Distance
                                servicesDemenagement: columns[8]?.split('|').map(s => s.trim()).filter(s => s), // Services
                                nbDemenageurs: columns[9], // Nb déménageurs
                                assuranceDemenagement: columns[10]?.toLowerCase() === 'oui', // Assurance
                                montageInclus: columns[11]?.toLowerCase() === 'oui', // Montage
                                cartonsInclus: columns[12]?.toLowerCase() === 'oui', // Cartons
                                dateDebut: columns[13] // Date début
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
                                operateur: columns[10],
                                anneeAchatTelephone: columns[11],
                                imei: columns[12],
                                garantieTelephone: columns[13],
                                batterieSante: columns[14],
                                tailleEcran: columns[15],
                                numeroCameraPrincipale: columns[16],
                                connectivite5G: columns[17]?.toLowerCase() === 'oui',
                                dualSim: columns[18]?.toLowerCase() === 'oui',
                                boiteOriginale: columns[19]?.toLowerCase() === 'oui',
                                factureTelephone: columns[20]?.toLowerCase() === 'oui',
                                ecranOriginal: columns[21]?.toLowerCase() === 'oui',
                                accessoiresTelephone: columns[22]?.split('|').map(a => a.trim()).filter(a => a)
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
                                etatOrdinateur: columns[12],
                                anneeAchatOrdinateur: columns[13],
                                usage: columns[14],
                                tailleEcranOrdinateur: columns[15],
                                garantieOrdinateur: columns[16],
                                typeSSD: columns[17]?.toLowerCase() === 'oui',
                                touchscreen: columns[18]?.toLowerCase() === 'oui',
                                webcam: columns[19]?.toLowerCase() === 'oui',
                                boiteOriginaleOrdinateur: columns[20]?.toLowerCase() === 'oui',
                                factureOrdinateur: columns[21]?.toLowerCase() === 'oui',
                                accessoiresOrdinateur: columns[22]?.split('|').map(a => a.trim()).filter(a => a),
                                logicielsInclus: columns[23]?.split('|').map(l => l.trim()).filter(l => l)
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
                                typeRestaurant: columns[5],
                                specialites: columns[6]?.split('|').map(s => s.trim()).filter(s => s),
                                servicesRestau: columns[7]?.split('|').map(s => s.trim()).filter(s => s),
                                gammePrix: columns[8],
                                capaciteRestaurant: columns[9],
                                horairesRestaurant: columns[10],
                                ambiance: columns[11],
                                chefNom: columns[12],
                                menuJour: columns[13],
                                regimesSpeciaux: columns[14]?.split('|').map(r => r.trim()).filter(r => r),
                                livraison: columns[15]?.toLowerCase() === 'oui',
                                terrasse: columns[16]?.toLowerCase() === 'oui',
                                parking: columns[17]?.toLowerCase() === 'oui',
                                wifi: columns[18]?.toLowerCase() === 'oui',
                                reservation: columns[19]?.toLowerCase() === 'oui',
                                adresseRestaurant: columns[20]
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
                                categorieInstrument: columns[5],
                                marqueInstrument: columns[6],
                                modeleInstrument: columns[7],
                                etatInstrument: columns[8],
                                anneeInstrument: columns[9],
                                materiauInstrument: columns[10],
                                couleurInstrument: columns[11],
                                tailleInstrument: columns[12],
                                nombreCordes: columns[13],
                                typeAmplification: columns[14],
                                puissanceAmpli: columns[15],
                                accessoiresInclus: columns[16]?.split('|').map(s => s.trim()).filter(s => s),
                                garantieInstrument: columns[17],
                                facture: columns[18]?.toLowerCase() === 'oui',
                                revisionRecente: columns[19]?.toLowerCase() === 'oui',
                                origineInstrument: columns[20]
                            } as Product;
                            break;

                        case 'emploi':
                            specificProduct = {
                                ...baseProduct,
                                posteOffre: columns[4],
                                typeContrat: columns[5],
                                domaineActivite: columns[6],
                                niveauExperience: columns[7],
                                salaireMin: columns[8],
                                salaireMax: columns[9],
                                lieuTravail: columns[10],
                                typeEmploi: columns[11],
                                competencesRequises: columns[12]?.split('|').map(c => c.trim()).filter(c => c),
                                diplomeRequis: columns[13],
                                languesRequises: columns[14]?.split('|').map(l => l.trim()).filter(l => l),
                                avantages: columns[15]?.split('|').map(a => a.trim()).filter(a => a),
                                dateDebut: columns[16],
                                dureeContrat: columns[17]
                            } as Product;
                            break;

                        case 'formation_education':
                            specificProduct = {
                                ...baseProduct,
                                domaineFormation: columns[4],
                                typeFormation: columns[5],
                                niveauFormation: columns[6],
                                modeFormation: columns[7],
                                dureeFormation: columns[8],
                                certificationFormation: columns[9],
                                matieresFormation: columns[10]?.split('|').map(s => s.trim()).filter(s => s),
                                formateurNom: columns[11],
                                horairesFormation: columns[12],
                                langueEnseignement: columns[13],
                                prerequis: columns[14],
                                objectifs: columns[15],
                                nombrePlaces: columns[16]
                            } as Product;
                            break;

                        case 'hotellerie':
                            specificProduct = {
                                ...baseProduct,
                                typeHebergement: columns[4],
                                categorieHotel: columns[5],
                                nbChambresHotel: columns[6],
                                equipementsHotel: columns[7]?.split('|').map(e => e.trim()).filter(e => e),
                                servicesHotel: columns[8]?.split('|').map(s => s.trim()).filter(s => s),
                                petitDejeuner: columns[9]?.toLowerCase() === 'oui',
                                restaurantHotel: columns[10]?.toLowerCase() === 'oui',
                                bar: columns[11]?.toLowerCase() === 'oui',
                                piscine: columns[12]?.toLowerCase() === 'oui',
                                spa: columns[13]?.toLowerCase() === 'oui',
                                parking: columns[14]?.toLowerCase() === 'oui',
                                wifi: columns[15]?.toLowerCase() === 'oui',
                                salleReunion: columns[16]?.toLowerCase() === 'oui',
                                adresseHotel: columns[17],
                                villeHotel: columns[18],
                                gpsHotel: columns[19],
                                noteHotel: columns[20]
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
                                typePrestation: columns[4], // Type prestation
                                specialitesPlomberie: columns[5]?.split('|').map(s => s.trim()).filter(s => s), // Spécialités
                                equipementsPlomberie: columns[6]?.split('|').map(s => s.trim()).filter(s => s), // Équipements
                                disponibilitePlomberie: columns[7], // Disponibilité
                                garantieTravaux: columns[8], // Garantie
                                urgence: columns[9]?.toLowerCase() === 'oui', // Urgence
                                devisGratuit: columns[10]?.toLowerCase() === 'oui', // Devis gratuit
                                certificationPlombier: columns[11] // Certification
                            } as Product;
                            break;

                        case 'electricite':
                            specificProduct = {
                                ...baseProduct,
                                typeElectrique: columns[4], // Type
                                puissanceElectrique: columns[5], // Puissance
                                garantieElectrique: columns[6], // Garantie
                                certificationElectrique: columns[7], // Certifications
                                urgenceElectrique: columns[8]?.toLowerCase().includes('oui') || columns[8]?.toLowerCase().includes('24') // Urgence
                            } as Product;
                            break;

                        case 'nettoyage':
                            specificProduct = {
                                ...baseProduct,
                                typeNettoyage: columns[4], // Type
                                frequenceNettoyage: columns[5], // Fréquence
                                servicesNettoyage: columns[6]?.split('|').map(s => s.trim()).filter(s => s), // Services
                                surfaceNettoyage: columns[7], // Surface
                                produitsNettoyage: columns[8], // Produits
                                produitsBio: columns[9]?.toLowerCase() === 'oui', // Produits bio
                                materielInclus: columns[10]?.toLowerCase() === 'oui', // Matériel inclus
                                assuranceResponsabiliteCivile: columns[11]?.toLowerCase() === 'oui' // RC
                            } as Product;
                            break;

                        case 'reparation':
                            specificProduct = {
                                ...baseProduct,
                                typeReparation: columns[4], // Type
                                specialiteReparation: columns[5], // Spécialité
                                marqueReparation: columns[6], // Marque
                                delaiReparation: columns[7], // Délai
                                garantieReparation: columns[8], // Garantie
                                diagnosticGratuit: columns[9]?.toLowerCase() === 'oui', // Diagnostic gratuit
                                deplacementInclus: columns[10]?.toLowerCase() === 'oui', // Déplacement inclus
                                piecesOrigine: columns[11]?.toLowerCase() === 'oui' // Pièces origine
                            } as Product;
                            break;

                        case 'carrelage':
                            specificProduct = {
                                ...baseProduct,
                                typeCarrelage: columns[4], // Type
                                materiauCarrelage: columns[5], // Matériau
                                dimensionsCarrelage: columns[6], // Dimensions
                                finitionCarrelage: columns[7], // Finition
                                epaisseurCarrelage: columns[8], // Épaisseur
                                usageCarrelage: columns[9], // Usage
                                aspectCarrelage: columns[10]?.split('|').map(a => a.trim()).filter(a => a), // Aspect
                                couleurCarrelage: columns[11], // Couleur
                                surfaceDisponible: columns[12], // Surface m²
                                origineCarrelage: columns[13] // Origine
                            } as Product;
                            break;

                        case 'bricolage':
                            specificProduct = {
                                ...baseProduct,
                                typeBricolage: columns[4],
                                categorieBricolage: columns[5],
                                marqueBricolage: columns[6],
                                etatBricolage: columns[7],
                                puissanceBricolage: columns[8],
                                garantieBricolage: columns[9]
                            } as Product;
                            break;

                        case 'enfants_bebes':
                            specificProduct = {
                                ...baseProduct,
                                categorieEnfant: columns[4],
                                ageRecommande: columns[5],
                                etatEnfant: columns[6],
                                tailleEnfant: columns[7],
                                marqueEnfant: columns[8],
                                securiteNorme: columns[9]?.toLowerCase() === 'oui'
                            } as Product;
                            break;

                        case 'decoration':
                            specificProduct = {
                                ...baseProduct,
                                typeDecoration: columns[4],
                                styleDecoration: columns[5],
                                pieceDecoration: columns[6],
                                materiauDecoration: columns[7],
                                couleurDecoration: columns[8],
                                dimensionsDecoration: columns[9]
                            } as Product;
                            break;

                        case 'sante_beaute':
                            specificProduct = {
                                ...baseProduct,
                                typeProduitBeaute: columns[4],
                                marqueBeaute: columns[5],
                                volumeBeaute: columns[6],
                                bio: columns[7]?.toLowerCase() === 'oui'
                            } as Product;
                            break;

                        case 'juridique':
                            specificProduct = {
                                ...baseProduct,
                                typeServiceJuridique: columns[4],
                                specialiteJuridique: columns[5],
                                experienceAvocat: columns[6],
                                tarifHoraire: columns[7]
                            } as Product;
                            break;

                        case 'musique_services':
                            specificProduct = {
                                ...baseProduct,
                                typeServiceMusical: columns[4],
                                genreMusical: columns[5],
                                dureePrestation: columns[6],
                                materielInclus: columns[7]?.toLowerCase() === 'oui'
                            } as Product;
                            break;

                        case 'photographie':
                            specificProduct = {
                                ...baseProduct,
                                typePhotoService: columns[4],
                                stylePhoto: columns[5],
                                equipementPhoto: columns[6]?.split('|').map(e => e.trim()).filter(e => e),
                                retouchesIncluses: columns[7]?.toLowerCase() === 'oui'
                            } as Product;
                            break;

                        case 'entreprise_industrie':
                            specificProduct = {
                                ...baseProduct,
                                typeEntreprise: columns[4],
                                secteurActivite: columns[5],
                                certification: columns[6],
                                etatMateriel: columns[7]
                            } as Product;
                            break;

                        case 'bien_etre':
                        case 'bien-etre':
                            specificProduct = {
                                ...baseProduct,
                                typeBienEtre: columns[4],
                                dureeSoins: columns[5],
                                tarifsSpeciaux: columns[6]?.toLowerCase() === 'oui',
                                packageDispo: columns[7]?.toLowerCase() === 'oui'
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
                        {/* Titre de section : Informations générales */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="home" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Informations générales</Text>
                        </View>

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

                        {/* Standing et État général */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Standing"
                                    value={newProduct.standing || ''}
                                    productType="immobilier"
                                    fieldName="standing"
                                    onSelect={(value) => setNewProduct({ ...newProduct, standing: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État général"
                                    value={newProduct.etatGeneral || ''}
                                    productType="immobilier"
                                    fieldName="etat"
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatGeneral: value })}
                                />
                            </View>
                        </View>

                        {/* Titre de section : Caractéristiques */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="layout" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Caractéristiques</Text>
                        </View>

                        {/* Superficie et Ameublement */}
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

                        {/* Étages (conditionnel selon le type) */}
                        {(newProduct.typeImmobilier === 'Appartement' || newProduct.typeImmobilier === 'Studio' || newProduct.typeImmobilier === 'Duplex') && (
                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>Étage</Text>
                                <NativeInput
                                    placeholder="Ex: 3 (ou RDC)"
                                    value={newProduct.etage || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, etage: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        )}

                        {(newProduct.typeImmobilier === 'Villa' || newProduct.typeImmobilier === 'Immeuble' || newProduct.typeImmobilier === 'Maison') && (
                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>Nombre d'étages</Text>
                                <NativeInput
                                    placeholder="Ex: R+2"
                                    value={newProduct.nbEtages || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, nbEtages: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        )}

                        {/* Année de construction */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Année de construction</Text>
                            <NativeInput
                                placeholder="Ex: 2020"
                                value={newProduct.anneeConstruction || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, anneeConstruction: text })}
                                style={styles.fieldInput}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Titre de section : Équipements */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="settings" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Équipements & Commodités</Text>
                        </View>

                        {/* Équipements principaux - Toggles */}
                        <View style={styles.togglesContainer}>
                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.parking && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, parking: !newProduct.parking })}
                            >
                                <SafeIcon
                                    name="square-parking"
                                    size={20}
                                    color={newProduct.parking ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={[styles.toggleLabel, newProduct.parking && styles.toggleLabelActive]}>
                                    Parking/Garage
                                </Text>
                            </TouchableOpacity>

                            {newProduct.parking && (
                                <View style={[styles.fieldContainer, { marginTop: 8 }]}>
                                    <Text style={styles.fieldLabel}>Nombre de places</Text>
                                    <NativeInput
                                        placeholder="Ex: 2"
                                        value={newProduct.nbParkings || ''}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, nbParkings: text })}
                                        style={styles.fieldInput}
                                        keyboardType="numeric"
                                    />
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.ascenseur && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, ascenseur: !newProduct.ascenseur })}
                            >
                                <SafeIcon
                                    name="arrow-up-down"
                                    size={20}
                                    color={newProduct.ascenseur ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={[styles.toggleLabel, newProduct.ascenseur && styles.toggleLabelActive]}>
                                    Ascenseur
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.jardin && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, jardin: !newProduct.jardin })}
                            >
                                <SafeIcon
                                    name="tree-pine"
                                    size={20}
                                    color={newProduct.jardin ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={[styles.toggleLabel, newProduct.jardin && styles.toggleLabelActive]}>
                                    Jardin
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.piscine && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, piscine: !newProduct.piscine })}
                            >
                                <Text style={{ fontSize: 20 }}>{newProduct.piscine ? '🏊' : '🏊‍♂️'}</Text>
                                <Text style={[styles.toggleLabel, newProduct.piscine && styles.toggleLabelActive]}>
                                    Piscine
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.securite && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, securite: !newProduct.securite })}
                            >
                                <SafeIcon
                                    name="shield-check"
                                    size={20}
                                    color={newProduct.securite ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={[styles.toggleLabel, newProduct.securite && styles.toggleLabelActive]}>
                                    Sécurité 24h
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.internet && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, internet: !newProduct.internet })}
                            >
                                <SafeIcon
                                    name="wifi"
                                    size={20}
                                    color={newProduct.internet ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={[styles.toggleLabel, newProduct.internet && styles.toggleLabelActive]}>
                                    Internet/Fibre
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.climatisation && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, climatisation: !newProduct.climatisation })}
                            >
                                <SafeIcon
                                    name="wind"
                                    size={20}
                                    color={newProduct.climatisation ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={[styles.toggleLabel, newProduct.climatisation && styles.toggleLabelActive]}>
                                    Climatisation
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Équipements additionnels - Liste */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Équipements additionnels</Text>
                            <View style={styles.equipementsScrollContainer}>
                                {['Cuisine équipée', 'Balcon', 'Terrasse', 'Eau courante', 'Électricité'].map((equip) => (
                                    <TouchableOpacity
                                        key={equip}
                                        style={[
                                            styles.equipementChip,
                                            newProduct.equipementsImmo?.includes(equip) && styles.equipementChipActive,
                                        ]}
                                        onPress={() => {
                                            const current = newProduct.equipementsImmo || [];
                                            const updated = current.includes(equip)
                                                ? current.filter((e) => e !== equip)
                                                : [...current, equip];
                                            setNewProduct({ ...newProduct, equipementsImmo: updated });
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.equipementChipText,
                                                newProduct.equipementsImmo?.includes(equip) && styles.equipementChipTextActive,
                                            ]}
                                        >
                                            {equip}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Titre de section : Localisation */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Localisation</Text>
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

                        {/* GPS */}
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

                        {/* Titre de section : Informations spécifiques */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="file-text" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>
                                {newProduct.statutImmobilier === 'À louer' ? 'Informations de location' : 'Informations complémentaires'}
                            </Text>
                        </View>

                        {/* Champs spécifiques pour location */}
                        {(newProduct.statutImmobilier === 'À louer' || newProduct.statutImmobilier === 'Colocation') && (
                            <>
                                <View style={styles.fieldRow}>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>Charges mensuelles (XAF)</Text>
                                        <NativeInput
                                            placeholder="Ex: 15000"
                                            value={newProduct.chargesMensuelles || ''}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, chargesMensuelles: text })}
                                            style={styles.fieldInput}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>Caution (mois de loyer)</Text>
                                        <NativeInput
                                            placeholder="Ex: 2"
                                            value={newProduct.caution || ''}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, caution: text })}
                                            style={styles.fieldInput}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>

                                <View style={styles.fieldRow}>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>Bail minimum</Text>
                                        <NativeInput
                                            placeholder="Ex: 1 an"
                                            value={newProduct.bailMinimum || ''}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, bailMinimum: text })}
                                            style={styles.fieldInput}
                                        />
                                    </View>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>Date de disponibilité</Text>
                                        <NativeInput
                                            placeholder="Ex: 01/12/2025"
                                            value={newProduct.dateDisponibilite || ''}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, dateDisponibilite: text })}
                                            style={styles.fieldInput}
                                        />
                                    </View>
                                </View>

                                <View style={styles.fieldContainer}>
                                    <TouchableOpacity
                                        style={[styles.toggleOption, newProduct.disponibleImmediatement && styles.toggleOptionActive]}
                                        onPress={() => setNewProduct({ ...newProduct, disponibleImmediatement: !newProduct.disponibleImmediatement })}
                                    >
                                        <SafeIcon
                                            name="zap"
                                            size={20}
                                            color={newProduct.disponibleImmediatement ? modernColors.primary : '#9CA3AF'}
                                        />
                                        <Text style={[styles.toggleLabel, newProduct.disponibleImmediatement && styles.toggleLabelActive]}>
                                            Disponible immédiatement
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}

                        {/* Champs spécifiques pour vente */}
                        {newProduct.statutImmobilier === 'À vendre' && (
                            <>
                                <View style={styles.fieldContainer}>
                                    <TouchableOpacity
                                        style={[styles.toggleOption, newProduct.titreFoncier && styles.toggleOptionActive]}
                                        onPress={() => setNewProduct({ ...newProduct, titreFoncier: !newProduct.titreFoncier })}
                                    >
                                        <SafeIcon
                                            name="file-check"
                                            size={20}
                                            color={newProduct.titreFoncier ? modernColors.primary : '#9CA3AF'}
                                        />
                                        <Text style={[styles.toggleLabel, newProduct.titreFoncier && styles.toggleLabelActive]}>
                                            Titre foncier disponible
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.toggleOption, newProduct.prixNegociable && styles.toggleOptionActive, { marginTop: 8 }]}
                                        onPress={() => setNewProduct({ ...newProduct, prixNegociable: !newProduct.prixNegociable })}
                                    >
                                        <SafeIcon
                                            name="trending-down"
                                            size={20}
                                            color={newProduct.prixNegociable ? modernColors.primary : '#9CA3AF'}
                                        />
                                        <Text style={[styles.toggleLabel, newProduct.prixNegociable && styles.toggleLabelActive]}>
                                            Prix négociable
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </>
                );

            case 'immobilier_terrain':
                return (
                    <>
                        {/* Titre de section : Informations générales */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="map" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Informations générales</Text>
                        </View>

                        {/* Type et Statut sur la même ligne */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de terrain"
                                    value={newProduct.typeTerrain || ''}
                                    productType="terrain"
                                    fieldName="types"
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeTerrain: value })}
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

                        {/* Viabilisation et Zonage */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Viabilisation"
                                    value={newProduct.viabilisation || ''}
                                    productType="terrain"
                                    fieldName="viabilisation"
                                    onSelect={(value) => setNewProduct({ ...newProduct, viabilisation: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Zonage"
                                    value={newProduct.zonage || ''}
                                    productType="terrain"
                                    fieldName="zonage"
                                    onSelect={(value) => setNewProduct({ ...newProduct, zonage: value })}
                                />
                            </View>
                        </View>

                        {/* Titre de section : Dimensions */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="maximize-2" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Dimensions</Text>
                        </View>

                        {/* Superficie et Prix au m² */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Superficie (m²) <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: 500"
                                    value={newProduct.superficie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, superficie: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Prix au m² (XAF)</Text>
                                <NativeInput
                                    placeholder="Ex: 15000"
                                    value={newProduct.prixMetreCarre || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, prixMetreCarre: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Largeur façade et Profondeur */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Largeur façade (m)</Text>
                                <NativeInput
                                    placeholder="Ex: 20"
                                    value={newProduct.largeurFacade || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, largeurFacade: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Profondeur (m)</Text>
                                <NativeInput
                                    placeholder="Ex: 25"
                                    value={newProduct.profondeur || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, profondeur: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Forme du terrain */}
                        <View style={styles.fieldContainer}>
                            <ProductFieldSelector
                                label="Forme du terrain"
                                value={newProduct.formeTerrain || ''}
                                productType="terrain"
                                fieldName="forme"
                                onSelect={(value) => setNewProduct({ ...newProduct, formeTerrain: value })}
                            />
                        </View>

                        {/* Titre de section : Caractéristiques */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="layers" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Caractéristiques</Text>
                        </View>

                        {/* Topographie et Accès */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Topographie"
                                    value={newProduct.topographie || ''}
                                    productType="terrain"
                                    fieldName="topographie"
                                    onSelect={(value) => setNewProduct({ ...newProduct, topographie: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Accès"
                                    value={newProduct.accesTerrain || ''}
                                    productType="terrain"
                                    fieldName="acces"
                                    onSelect={(value) => setNewProduct({ ...newProduct, accesTerrain: value })}
                                />
                            </View>
                        </View>

                        {/* Végétation et Usage actuel */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Végétation"
                                    value={newProduct.vegetation || ''}
                                    productType="terrain"
                                    fieldName="vegetation"
                                    onSelect={(value) => setNewProduct({ ...newProduct, vegetation: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Usage actuel"
                                    value={newProduct.usageActuel || ''}
                                    productType="terrain"
                                    fieldName="usage"
                                    onSelect={(value) => setNewProduct({ ...newProduct, usageActuel: value })}
                                />
                            </View>
                        </View>

                        {/* Titre de section : Réseaux & Services */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="zap" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Réseaux & Services</Text>
                        </View>

                        {/* Réseaux disponibles */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Réseaux disponibles</Text>
                            <View style={styles.equipementsScrollContainer}>
                                {['Eau', 'Électricité', 'Assainissement', 'Fibre', 'Gaz'].map((reseau) => (
                                    <TouchableOpacity
                                        key={reseau}
                                        style={[
                                            styles.equipementChip,
                                            newProduct.reseauxTerrain?.includes(reseau) && styles.equipementChipActive,
                                        ]}
                                        onPress={() => {
                                            const current = newProduct.reseauxTerrain || [];
                                            const updated = current.includes(reseau)
                                                ? current.filter((r) => r !== reseau)
                                                : [...current, reseau];
                                            setNewProduct({ ...newProduct, reseauxTerrain: updated });
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.equipementChipText,
                                                newProduct.reseauxTerrain?.includes(reseau) && styles.equipementChipTextActive,
                                            ]}
                                        >
                                            {reseau}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Titre de section : Informations juridiques */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="file-text" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Informations juridiques</Text>
                        </View>

                        {/* Toggles juridiques */}
                        <View style={styles.togglesContainer}>
                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.titreFoncier && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, titreFoncier: !newProduct.titreFoncier })}
                            >
                                <SafeIcon
                                    name="file-check"
                                    size={20}
                                    color={newProduct.titreFoncier ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={[styles.toggleLabel, newProduct.titreFoncier && styles.toggleLabelActive]}>
                                    Titre foncier disponible
                                </Text>
                            </TouchableOpacity>

                            {newProduct.titreFoncier && (
                                <View style={[styles.fieldContainer, { marginTop: 8 }]}>
                                    <Text style={styles.fieldLabel}>Numéro du titre foncier</Text>
                                    <NativeInput
                                        placeholder="Ex: TF 12345/2023"
                                        value={newProduct.numeroTitreFoncier || ''}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, numeroTitreFoncier: text })}
                                        style={styles.fieldInput}
                                    />
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.bornage && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, bornage: !newProduct.bornage })}
                            >
                                <SafeIcon
                                    name="square-dashed"
                                    size={20}
                                    color={newProduct.bornage ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={[styles.toggleLabel, newProduct.bornage && styles.toggleLabelActive]}>
                                    Bornage effectué
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.constructibilite && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, constructibilite: !newProduct.constructibilite })}
                            >
                                <SafeIcon
                                    name="hammer"
                                    size={20}
                                    color={newProduct.constructibilite ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={[styles.toggleLabel, newProduct.constructibilite && styles.toggleLabelActive]}>
                                    Permis de construire possible
                                </Text>
                            </TouchableOpacity>

                            {newProduct.constructibilite && (
                                <View style={[styles.fieldContainer, { marginTop: 8 }]}>
                                    <Text style={styles.fieldLabel}>Coefficient d'occupation (COS)</Text>
                                    <NativeInput
                                        placeholder="Ex: 0.6"
                                        value={newProduct.coefficientOccupation || ''}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, coefficientOccupation: text })}
                                        style={styles.fieldInput}
                                        keyboardType="numeric"
                                    />
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.cloture && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, cloture: !newProduct.cloture })}
                            >
                                <SafeIcon
                                    name="fence"
                                    size={20}
                                    color={newProduct.cloture ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={[styles.toggleLabel, newProduct.cloture && styles.toggleLabelActive]}>
                                    Terrain clôturé
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Servitudes */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Servitudes ou restrictions</Text>
                            <NativeInput
                                placeholder="Ex: Droit de passage, servitude d'écoulement..."
                                value={newProduct.servitudes || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, servitudes: text })}
                                style={[styles.fieldInput, { height: 80 }]}
                                multiline
                            />
                        </View>

                        {/* Titre de section : Localisation */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Localisation</Text>
                        </View>

                        {/* Adresse */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Adresse <Text style={styles.required}>*</Text></Text>
                            <NativeInput
                                placeholder="Ex: Zone industrielle, Pk17"
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
                                    placeholder="Ex: Logpom"
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

                        {/* GPS */}
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
                        {/* Type de véhicule et Type de carrosserie */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de véhicule"
                                    value={newProduct.typeVehicule || ''}
                                    productType="automobile"
                                    fieldName="types"
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeVehicule: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de carrosserie"
                                    value={newProduct.typeCarrosserie || ''}
                                    productType="automobile"
                                    fieldName="carrosseries"
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeCarrosserie: value })}
                                />
                            </View>
                        </View>

                        {/* Marque et Modèle intelligent sur la même ligne */}
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
                                <SmartVehicleModelInput
                                    marque={newProduct.marqueAutomobile || ''}
                                    value={newProduct.modeleAutomobile || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modeleAutomobile: text })}
                                    placeholder="Ex: Corolla"
                                    label="Modèle"
                                    required
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

                        {/* Nombre de portes et places */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Nombre de portes"
                                    value={newProduct.nbPortes || ''}
                                    productType="automobile"
                                    fieldName="portes"
                                    onSelect={(value) => setNewProduct({ ...newProduct, nbPortes: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Nombre de places"
                                    value={newProduct.nbPlaces || ''}
                                    productType="automobile"
                                    fieldName="places"
                                    onSelect={(value) => setNewProduct({ ...newProduct, nbPlaces: value })}
                                />
                            </View>
                        </View>

                        {/* Puissance et Cylindrée */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Puissance (CV)</Text>
                                <NativeInput
                                    placeholder="Ex: 110"
                                    value={newProduct.puissance || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, puissance: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Cylindrée (cm³)</Text>
                                <NativeInput
                                    placeholder="Ex: 1600"
                                    value={newProduct.cylindree || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, cylindree: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Équipements et options */}
                        <ProductFieldSelector
                            label="Équipements et options"
                            fieldName="equipements"
                            productType="automobile"
                            value={newProduct.equipementsAuto || []}
                            onSelect={(value) => setNewProduct({ ...newProduct, equipementsAuto: value })}
                            multiSelect
                        />

                        {/* Options booléennes */}
                        <View style={styles.fieldContainer}>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, premiereMain: !newProduct.premiereMain })}
                            >
                                <View style={[styles.checkbox, newProduct.premiereMain && styles.checkboxChecked]}>
                                    {newProduct.premiereMain && (
                                        <SafeIcon name="check" size={16} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>⭐ Première main</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.fieldContainer}>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, historiqueEntretien: !newProduct.historiqueEntretien })}
                            >
                                <View style={[styles.checkbox, newProduct.historiqueEntretien && styles.checkboxChecked]}>
                                    {newProduct.historiqueEntretien && (
                                        <SafeIcon name="check" size={16} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>📋 Historique d'entretien disponible</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.fieldContainer}>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, contreTechnique: !newProduct.contreTechnique })}
                            >
                                <View style={[styles.checkbox, newProduct.contreTechnique && styles.checkboxChecked]}>
                                    {newProduct.contreTechnique && (
                                        <SafeIcon name="check" size={16} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>✅ Contrôle technique valide</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Garantie et Papiers */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Garantie</Text>
                                <NativeInput
                                    placeholder="Ex: 6 mois constructeur"
                                    value={newProduct.garantie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, garantie: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État des papiers"
                                    fieldName="papiers"
                                    productType="automobile"
                                    value={newProduct.papiers || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, papiers: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Plus vous renseignez d'informations (équipements, état des papiers, historique), plus votre annonce sera attractive
                            </Text>
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
                                <SmartModalityInput
                                    label="Nom de l'agence"
                                    value={newProduct.compagnieTransport || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, compagnieTransport: text })}
                                    placeholder="Ex: Alliance Voyage"
                                    modalityType="agency"
                                    fieldKey="agency_name"
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type véhicule"
                                    fieldName="vehicules"
                                    productType="ticket_voyage"
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

                        {/* Option Aller-Retour */}
                        <View style={styles.returnTripSection}>
                            <View style={styles.sectionHeaderWithIcon}>
                                <SafeIcon name="repeat" size={20} color={modernColors.primary} />
                                <Text style={styles.sectionTitleMedium}>Type de Trajet</Text>
                            </View>

                            <View style={styles.tripTypeOptions}>
                                <TouchableOpacity
                                    style={[
                                        styles.tripTypeButton,
                                        !newProduct.proposeAllerRetour && styles.tripTypeButtonActive
                                    ]}
                                    onPress={() => setNewProduct({ ...newProduct, proposeAllerRetour: false })}
                                >
                                    <SafeIcon
                                        name="arrow-right"
                                        size={20}
                                        color={!newProduct.proposeAllerRetour ? '#FFFFFF' : modernColors.primary}
                                    />
                                    <Text style={[
                                        styles.tripTypeButtonText,
                                        !newProduct.proposeAllerRetour && styles.tripTypeButtonTextActive
                                    ]}>
                                        Aller simple uniquement
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.tripTypeButton,
                                        newProduct.proposeAllerRetour && styles.tripTypeButtonActive
                                    ]}
                                    onPress={() => setNewProduct({ ...newProduct, proposeAllerRetour: true })}
                                >
                                    <SafeIcon
                                        name="refresh-cw"
                                        size={20}
                                        color={newProduct.proposeAllerRetour ? '#FFFFFF' : modernColors.primary}
                                    />
                                    <Text style={[
                                        styles.tripTypeButtonText,
                                        newProduct.proposeAllerRetour && styles.tripTypeButtonTextActive
                                    ]}>
                                        Proposer aller-retour
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {newProduct.proposeAllerRetour && (
                                <View style={styles.returnPricingContainer}>
                                    <View style={styles.fieldRow}>
                                        <View style={[styles.fieldContainer, { flex: 1 }]}>
                                            <Text style={styles.fieldLabel}>Prix aller simple <Text style={styles.required}>*</Text></Text>
                                            <NativeInput
                                                placeholder="5000"
                                                value={newProduct.prixAllerSimple || newProduct.prix || ''}
                                                onChangeText={(text) => {
                                                    setNewProduct({ ...newProduct, prixAllerSimple: text, prix: text });
                                                }}
                                                style={styles.fieldInput}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View style={[styles.fieldContainer, { flex: 1 }]}>
                                            <Text style={styles.fieldLabel}>Prix aller-retour <Text style={styles.required}>*</Text></Text>
                                            <NativeInput
                                                placeholder="9000"
                                                value={newProduct.prixAllerRetour || ''}
                                                onChangeText={(text) => setNewProduct({ ...newProduct, prixAllerRetour: text })}
                                                style={styles.fieldInput}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                    </View>

                                    {newProduct.prixAllerSimple && newProduct.prixAllerRetour && (
                                        <View style={styles.savingsIndicator}>
                                            <SafeIcon name="trending-down" size={16} color={modernColors.success} />
                                            <Text style={styles.savingsText}>
                                                Économie: {(parseInt(newProduct.prixAllerSimple) * 2 - parseInt(newProduct.prixAllerRetour)).toLocaleString()} FCFA
                                                ({Math.round((1 - parseInt(newProduct.prixAllerRetour) / (parseInt(newProduct.prixAllerSimple) * 2)) * 100)}%)
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Classe de voyage */}
                        <ProductFieldSelector
                            label="Classe"
                            fieldName="classes"
                            productType="ticket_voyage"
                            value={newProduct.classeVoyage || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, classeVoyage: value })}
                            required
                        />

                        {/* Trajet */}
                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <SmartModalityInput
                                    label="Ville de départ"
                                    value={newProduct.depart || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, depart: text })}
                                    placeholder="Ex: Douala"
                                    modalityType="city"
                                    fieldKey="departure_city"
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <SmartModalityInput
                                    label="Ville de destination"
                                    value={newProduct.destination || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, destination: text })}
                                    placeholder="Ex: Yaoundé"
                                    modalityType="city"
                                    fieldKey="arrival_city"
                                    required
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

                        {/* Informations Ticket PDF */}
                        <View style={styles.ticketInfoSection}>
                            <View style={styles.sectionHeaderWithIcon}>
                                <SafeIcon name="file-text" size={20} color={modernColors.primary} />
                                <Text style={styles.sectionTitleMedium}>Informations Ticket de Voyage</Text>
                            </View>

                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>Numéro/Code du bus <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: BUS-237-DLA"
                                    value={newProduct.numeroBus || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, numeroBus: text })}
                                    style={styles.fieldInput}
                                />
                            </View>

                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>Logo de l'agence (optionnel)</Text>
                                <TouchableOpacity
                                    style={styles.logoUploadButton}
                                    onPress={async () => {
                                        const result = await handlePickImages();
                                        if (result && result.length > 0) {
                                            setNewProduct({ ...newProduct, logoAgence: result[0] });
                                        }
                                    }}
                                >
                                    {newProduct.logoAgence ? (
                                        <View style={styles.logoPreview}>
                                            <Image source={{ uri: newProduct.logoAgence }} style={styles.logoImage} />
                                            <TouchableOpacity
                                                style={styles.removeLogo}
                                                onPress={() => setNewProduct({ ...newProduct, logoAgence: null })}
                                            >
                                                <SafeIcon name="x" size={16} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.logoUploadContent}>
                                            <SafeIcon name="upload" size={24} color={modernColors.primary} />
                                            <Text style={styles.logoUploadText}>Ajouter logo agence</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>Conditions de voyage (optionnel)</Text>
                                <NativeInput
                                    placeholder="Ex: Bagages inclus 20kg max, Arrivée garantie, Remboursement si annulation 24h avant..."
                                    value={newProduct.conditionsVoyage || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, conditionsVoyage: text })}
                                    style={[styles.fieldInput, styles.textareaInput]}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            <View style={styles.infoCard}>
                                <SafeIcon name="info" size={16} color={modernColors.info} />
                                <Text style={styles.infoCardText}>
                                    💰 <Text style={{ fontWeight: '700' }}>Nouveau système:</Text> Le client paie le montant complet du ticket dès la réservation (plus de caution). L'argent est versé à votre structure automatiquement.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                🎫 <Text style={styles.hintBold}>Système Pro:</Text> Paiement complet immédiat → Ticket PDF instantané → Places multiples possibles (famille/amis) → QR Code de validation.
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
                        {/* Section 1: Informations Générales */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="zap" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Informations Générales</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type d'appareil"
                                    value={newProduct.typeElectro || ''}
                                    productType="electromenager"
                                    fieldName="types"
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeElectro: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Catégorie"
                                    value={newProduct.categorieElectro || ''}
                                    productType="electromenager"
                                    fieldName="categories"
                                    onSelect={(value) => setNewProduct({ ...newProduct, categorieElectro: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    value={newProduct.marqueElectro || ''}
                                    productType="electromenager"
                                    fieldName="marques"
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueElectro: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <SmartApplianceInput
                                    brand={newProduct.marqueElectro || ''}
                                    value={newProduct.modeleElectro || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modeleElectro: text })}
                                    placeholder="Ex: RT50K6000S8"
                                    label="Modèle"
                                    autoLoadLastUsed={true}
                                />
                            </View>
                        </View>

                        {/* Section 2: État et Garantie */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="shield" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>État et Garantie</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État"
                                    value={newProduct.etatElectro || ''}
                                    productType="electromenager"
                                    fieldName="etats"
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatElectro: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Année d'achat</Text>
                                <NativeInput
                                    placeholder="Ex: 2022"
                                    value={newProduct.anneeAchat || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, anneeAchat: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Garantie restante</Text>
                            <NativeInput
                                placeholder="Ex: 6 mois"
                                value={newProduct.garantieElectro || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, garantieElectro: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        <View style={styles.togglesContainer}>
                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.garantieConstructeur && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, garantieConstructeur: !newProduct.garantieConstructeur })}
                            >
                                <SafeIcon name="shield-check" size={20} color={newProduct.garantieConstructeur ? modernColors.primary : '#9CA3AF'} />
                                <Text style={[styles.toggleLabel, newProduct.garantieConstructeur && styles.toggleLabelActive]}>
                                    Garantie constructeur valide
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Section 3: Caractéristiques Techniques */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="cpu" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Caractéristiques Techniques</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Classe énergétique"
                                    value={newProduct.consommationEnergetique || ''}
                                    productType="electromenager"
                                    fieldName="classes_energetiques"
                                    onSelect={(value) => setNewProduct({ ...newProduct, consommationEnergetique: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Capacité (L/Kg)</Text>
                                <NativeInput
                                    placeholder="Ex: 350"
                                    value={newProduct.capacite || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, capacite: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Couleur"
                                    value={newProduct.couleurElectro || ''}
                                    productType="electromenager"
                                    fieldName="couleurs"
                                    onSelect={(value) => setNewProduct({ ...newProduct, couleurElectro: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Dimensions (H x L x P)</Text>
                                <NativeInput
                                    placeholder="Ex: 185 x 60 x 65 cm"
                                    value={newProduct.dimensionsElectro || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dimensionsElectro: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* Section 4: Fonctionnalités */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="settings" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Fonctionnalités</Text>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Fonctionnalités spéciales</Text>
                            <View style={styles.equipementsScrollContainer}>
                                {['No Frost', 'Dégivrage auto', 'Smart/WiFi', 'Écran tactile', 'Programmable', 'Silencieux', 'Économie d\'énergie'].map((fonc) => (
                                    <TouchableOpacity
                                        key={fonc}
                                        style={[
                                            styles.equipementChip,
                                            newProduct.fonctionnalites?.includes(fonc) && styles.equipementChipActive,
                                        ]}
                                        onPress={() => {
                                            const current = newProduct.fonctionnalites || [];
                                            const updated = current.includes(fonc)
                                                ? current.filter((f) => f !== fonc)
                                                : [...current, fonc];
                                            setNewProduct({ ...newProduct, fonctionnalites: updated });
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.equipementChipText,
                                                newProduct.fonctionnalites?.includes(fonc) && styles.equipementChipTextActive,
                                            ]}
                                        >
                                            {fonc}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Section 5: Documents */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="file-text" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Documents</Text>
                        </View>

                        <View style={styles.togglesContainer}>
                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.facture && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, facture: !newProduct.facture })}
                            >
                                <SafeIcon name="file-text" size={20} color={newProduct.facture ? modernColors.primary : '#9CA3AF'} />
                                <Text style={[styles.toggleLabel, newProduct.facture && styles.toggleLabelActive]}>
                                    Facture d'achat disponible
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.manuel && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, manuel: !newProduct.manuel })}
                            >
                                <SafeIcon name="book-open" size={20} color={newProduct.manuel ? modernColors.primary : '#9CA3AF'} />
                                <Text style={[styles.toggleLabel, newProduct.manuel && styles.toggleLabelActive]}>
                                    Manuel d'utilisation disponible
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Accessoires fournis</Text>
                            <NativeInput
                                placeholder="Ex: Tuyaux, filtres, télécommande..."
                                value={newProduct.accessoires || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, accessoires: text })}
                                style={[styles.fieldInput, { height: 60 }]}
                                multiline
                            />
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Les documents (facture, manuel) augmentent la confiance et facilitent le SAV
                            </Text>
                        </View>
                    </>
                );

            case 'mobilier':
                return (
                    <>
                        {/* Section 1: Informations Générales */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="package" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Informations Générales</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type de meuble"
                                    value={newProduct.typeMobilier || ''}
                                    productType="mobilier"
                                    fieldName="types"
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeMobilier: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Catégorie"
                                    value={newProduct.categorieMobilier || ''}
                                    productType="mobilier"
                                    fieldName="categories"
                                    onSelect={(value) => setNewProduct({ ...newProduct, categorieMobilier: value })}
                                    required
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Style"
                                    value={newProduct.styleMobilier || ''}
                                    productType="mobilier"
                                    fieldName="styles"
                                    onSelect={(value) => setNewProduct({ ...newProduct, styleMobilier: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État"
                                    value={newProduct.etatMobilier || ''}
                                    productType="mobilier"
                                    fieldName="etats"
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatMobilier: value })}
                                    required
                                />
                            </View>
                        </View>

                        {/* Section 2: Caractéristiques */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="ruler" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Caractéristiques</Text>
                        </View>

                        <View style={styles.fieldContainer}>
                            <ProductFieldSelector
                                label="Matériau principal"
                                value={newProduct.materiauMobilier || ''}
                                productType="mobilier"
                                fieldName="materiaux"
                                onSelect={(value) => setNewProduct({ ...newProduct, materiauMobilier: value })}
                            />
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Dimensions (H x L x P)</Text>
                                <NativeInput
                                    placeholder="Ex: 80 x 200 x 90 cm"
                                    value={newProduct.dimensionsMobilier || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dimensionsMobilier: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Couleur</Text>
                                <NativeInput
                                    placeholder="Ex: Blanc cassé"
                                    value={newProduct.couleurMobilier || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, couleurMobilier: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {(newProduct.typeMobilier === 'Canapé' || newProduct.typeMobilier === 'Table' || newProduct.typeMobilier === 'Chaise') && (
                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>Nombre de places</Text>
                                <NativeInput
                                    placeholder="Ex: 3"
                                    value={newProduct.nombrePlaces || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, nombrePlaces: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        )}

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Poids (kg)</Text>
                            <NativeInput
                                placeholder="Ex: 45"
                                value={newProduct.poids || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, poids: text })}
                                style={styles.fieldInput}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Section 3: Services */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="truck" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Services</Text>
                        </View>

                        <View style={styles.togglesContainer}>
                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.livraison && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, livraison: !newProduct.livraison })}
                            >
                                <SafeIcon name="truck" size={20} color={newProduct.livraison ? modernColors.primary : '#9CA3AF'} />
                                <Text style={[styles.toggleLabel, newProduct.livraison && styles.toggleLabelActive]}>
                                    Livraison disponible
                                </Text>
                            </TouchableOpacity>

                            {newProduct.livraison && (
                                <View style={[styles.fieldContainer, { marginTop: 8 }]}>
                                    <Text style={styles.fieldLabel}>Frais de livraison (XAF)</Text>
                                    <NativeInput
                                        placeholder="Ex: 5000"
                                        value={newProduct.fraisLivraison || ''}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, fraisLivraison: text })}
                                        style={styles.fieldInput}
                                        keyboardType="numeric"
                                    />
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.montageRequis && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, montageRequis: !newProduct.montageRequis })}
                            >
                                <SafeIcon name="wrench" size={20} color={newProduct.montageRequis ? modernColors.primary : '#9CA3AF'} />
                                <Text style={[styles.toggleLabel, newProduct.montageRequis && styles.toggleLabelActive]}>
                                    Montage nécessaire
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.demontable && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, demontable: !newProduct.demontable })}
                            >
                                <SafeIcon name="tool" size={20} color={newProduct.demontable ? modernColors.primary : '#9CA3AF'} />
                                <Text style={[styles.toggleLabel, newProduct.demontable && styles.toggleLabelActive]}>
                                    Facilement démontable
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Garantie</Text>
                            <NativeInput
                                placeholder="Ex: 1 an constructeur"
                                value={newProduct.garantieMobilier || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, garantieMobilier: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Précisez les conditions de livraison et de montage pour faciliter la décision
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
            case 'agroalimentaire':
                return (
                    <>
                        {/* Section 1: Informations Produit */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="package" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Informations Produit</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Catégorie"
                                    value={newProduct.categorieAliment || ''}
                                    productType="aliments"
                                    fieldName="categories"
                                    onSelect={(value) => setNewProduct({ ...newProduct, categorieAliment: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type"
                                    value={newProduct.typeAliment || ''}
                                    productType="aliments"
                                    fieldName="types"
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeAliment: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <ProductFieldSelector
                                label="Origine"
                                value={newProduct.origine || ''}
                                productType="aliments"
                                fieldName="origines"
                                onSelect={(value) => setNewProduct({ ...newProduct, origine: value })}
                            />
                        </View>

                        {/* Section 2: Dates et Conservation */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Dates et Conservation</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Date de production</Text>
                                <NativeInput
                                    placeholder="JJ/MM/AAAA"
                                    value={newProduct.dateProduction || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, dateProduction: text })}
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
                            <ProductFieldSelector
                                label="Mode de conservation"
                                value={newProduct.conservation || ''}
                                productType="aliments"
                                fieldName="conservations"
                                onSelect={(value) => setNewProduct({ ...newProduct, conservation: value })}
                            />
                        </View>

                        {/* Section 3: Qualité et Certifications */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="award" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Qualité et Certifications</Text>
                        </View>

                        <View style={styles.togglesContainer}>
                            <TouchableOpacity
                                style={[styles.toggleOption, newProduct.bio && styles.toggleOptionActive]}
                                onPress={() => setNewProduct({ ...newProduct, bio: !newProduct.bio })}
                            >
                                <SafeIcon name="leaf" size={20} color={newProduct.bio ? modernColors.primary : '#9CA3AF'} />
                                <Text style={[styles.toggleLabel, newProduct.bio && styles.toggleLabelActive]}>
                                    Agriculture biologique
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Labels qualité</Text>
                            <View style={styles.equipementsScrollContainer}>
                                {['Bio', 'Label Rouge', 'AOC', 'AOP', 'IGP'].map((label) => (
                                    <TouchableOpacity
                                        key={label}
                                        style={[
                                            styles.equipementChip,
                                            newProduct.labelQualite?.includes(label) && styles.equipementChipActive,
                                        ]}
                                        onPress={() => {
                                            const current = newProduct.labelQualite || [];
                                            const updated = current.includes(label)
                                                ? current.filter((l) => l !== label)
                                                : [...current, label];
                                            setNewProduct({ ...newProduct, labelQualite: updated });
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.equipementChipText,
                                                newProduct.labelQualite?.includes(label) && styles.equipementChipTextActive,
                                            ]}
                                        >
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Certifications</Text>
                            <View style={styles.equipementsScrollContainer}>
                                {['Halal', 'Casher', 'Vegan', 'Sans gluten', 'Fair Trade'].map((cert) => (
                                    <TouchableOpacity
                                        key={cert}
                                        style={[
                                            styles.equipementChip,
                                            newProduct.certifications?.includes(cert) && styles.equipementChipActive,
                                        ]}
                                        onPress={() => {
                                            const current = newProduct.certifications || [];
                                            const updated = current.includes(cert)
                                                ? current.filter((c) => c !== cert)
                                                : [...current, cert];
                                            setNewProduct({ ...newProduct, certifications: updated });
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.equipementChipText,
                                                newProduct.certifications?.includes(cert) && styles.equipementChipTextActive,
                                            ]}
                                        >
                                            {cert}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Section 4: Quantité et Conditionnement */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="box" size={20} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Quantité et Conditionnement</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Poids/Quantité <Text style={styles.required}>*</Text></Text>
                                <NativeInput
                                    placeholder="Ex: 1"
                                    value={newProduct.poids || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, poids: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Unité"
                                    value={newProduct.uniteMesure || ''}
                                    productType="aliments"
                                    fieldName="unites"
                                    onSelect={(value) => setNewProduct({ ...newProduct, uniteMesure: value })}
                                    required
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Conditionnement"
                                    value={newProduct.conditionnement || ''}
                                    productType="aliments"
                                    fieldName="conditionnements"
                                    onSelect={(value) => setNewProduct({ ...newProduct, conditionnement: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Stock disponible</Text>
                                <NativeInput
                                    placeholder="Ex: 50"
                                    value={newProduct.stockDisponible?.toString() || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, stockDisponible: parseInt(text) || 0 })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Allergènes présents</Text>
                            <NativeInput
                                placeholder="Ex: Gluten, lait, œufs, arachides..."
                                value={newProduct.allergenes || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, allergenes: text })}
                                style={[styles.fieldInput, { height: 60 }]}
                                multiline
                            />
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Les informations sur l'origine, les certifications et les allergènes rassurent les acheteurs
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
                                placeholder="Ex: +237 6XX XX XX XX"
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

            case 'laboratoire': {
                // Listes d'examens de laboratoire et imagerie disponibles
                const examensLaboratoireOptions = [
                    // Analyses biologiques
                    'Hématologie', 'Biochimie', 'Sérologie', 'Parasitologie',
                    'Bactériologie', 'Hormonologie', 'Immunologie', 'Coagulation',
                    'Lipidique', 'Hépatique', 'Rénal', 'Diabète',
                    'Urinaire', 'Cytologie', 'Histologie', 'Génétique',
                    'Toxicologie', 'PCR',
                    // Imagerie médicale
                    'Radiographie', 'Échographie', 'Échographie Doppler',
                    'Scanner', 'IRM', 'Mammographie', 'Panoramique dentaire',
                    'Scintigraphie', 'PET Scan', 'Fibroscopie', 'Coronarographie'
                ];

                const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

                return (
                    <>
                        {/* Type d'établissement */}
                        <ProductFieldSelector
                            label="Type d'établissement"
                            fieldName="types"
                            productType="laboratoire"
                            value={newProduct.typeLaboratoire || ''}
                            onSelect={(value) => setNewProduct({ ...newProduct, typeLaboratoire: value })}
                            required
                        />

                        {/* Prélèvement à domicile */}
                        <View style={styles.fieldContainer}>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, prelevementDomicile: !newProduct.prelevementDomicile })}
                            >
                                <View style={[
                                    styles.checkbox,
                                    newProduct.prelevementDomicile && styles.checkboxChecked
                                ]}>
                                    {newProduct.prelevementDomicile && (
                                        <SafeIcon name="check" size={16} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>🏠 Prélèvement à domicile disponible</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Résultats rapides */}
                        <View style={styles.fieldContainer}>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => setNewProduct({ ...newProduct, resultatRapide: !newProduct.resultatRapide })}
                            >
                                <View style={[
                                    styles.checkbox,
                                    newProduct.resultatRapide && styles.checkboxChecked
                                ]}>
                                    {newProduct.resultatRapide && (
                                        <SafeIcon name="check" size={16} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>⚡ Résultats rapides / Urgents disponibles</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Examens de laboratoire et imagerie disponibles */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Examens et prestations disponibles</Text>
                            <Text style={styles.fieldHint}>Cochez les analyses biologiques et/ou examens d'imagerie proposés, puis configurez leur planning</Text>
                            <ScrollView style={styles.checkboxList} nestedScrollEnabled>
                                {examensLaboratoireOptions.map((examen) => {
                                    const isSelected = (newProduct.examensLaboratoire || []).includes(examen);
                                    return (
                                        <View key={examen}>
                                            <TouchableOpacity
                                                style={styles.checkboxItem}
                                                onPress={() => {
                                                    const current = newProduct.examensLaboratoire || [];
                                                    if (current.includes(examen)) {
                                                        setNewProduct({
                                                            ...newProduct,
                                                            examensLaboratoire: current.filter(e => e !== examen),
                                                            planningExamens: {
                                                                ...newProduct.planningExamens,
                                                                [examen]: undefined
                                                            }
                                                        });
                                                    } else {
                                                        setNewProduct({
                                                            ...newProduct,
                                                            examensLaboratoire: [...current, examen]
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
                                                <Text style={styles.checkboxLabel}>{examen}</Text>
                                            </TouchableOpacity>

                                            {/* Planning pour cet examen si coché */}
                                            {isSelected && (
                                                <View style={styles.prestationPlanningContainer}>
                                                    <Text style={styles.prestationPlanningTitle}>📅 Planning pour {examen}</Text>

                                                    {/* Jours disponibles */}
                                                    <Text style={styles.fieldHint}>Jours disponibles :</Text>
                                                    <View style={styles.weekDaysContainer}>
                                                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((jour) => {
                                                            const joursArray = (newProduct.planningExamens?.[examen]?.jours || '').split(',').map(j => j.trim());
                                                            const isJourSelected = joursArray.includes(jour);
                                                            return (
                                                                <TouchableOpacity
                                                                    key={jour}
                                                                    style={[
                                                                        styles.dayButton,
                                                                        isJourSelected && styles.dayButtonActive
                                                                    ]}
                                                                    onPress={() => {
                                                                        const current = (newProduct.planningExamens?.[examen]?.jours || '').split(',').map(j => j.trim()).filter(j => j);
                                                                        const updated = isJourSelected
                                                                            ? current.filter(j => j !== jour)
                                                                            : [...current, jour];
                                                                        setNewProduct({
                                                                            ...newProduct,
                                                                            planningExamens: {
                                                                                ...newProduct.planningExamens,
                                                                                [examen]: {
                                                                                    ...newProduct.planningExamens?.[examen],
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
                                                                    newProduct.planningExamens?.[examen]?.moment === moment && styles.pickerButtonActive
                                                                ]}
                                                                onPress={() => setNewProduct({
                                                                    ...newProduct,
                                                                    planningExamens: {
                                                                        ...newProduct.planningExamens,
                                                                        [examen]: {
                                                                            ...newProduct.planningExamens?.[examen],
                                                                            moment
                                                                        }
                                                                    }
                                                                })}
                                                            >
                                                                <Text style={[
                                                                    styles.pickerButtonText,
                                                                    newProduct.planningExamens?.[examen]?.moment === moment && styles.pickerButtonTextActive
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

                        {/* Délai moyen pour résultats */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Délai moyen pour les résultats</Text>
                            <NativeInput
                                placeholder="Ex: 24h, 48h, 1 semaine..."
                                value={newProduct.delaiResultat || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, delaiResultat: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                💡 Renseignez précisément vos examens biologiques et/ou prestations d'imagerie, ainsi que leurs horaires, pour aider les patients à trouver rapidement le bon service
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
                        {/* ========== SECTION 1: IDENTITÉ DU SMARTPHONE ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="smartphone" size={18} color="#6366F1" />
                            <Text style={styles.sectionTitle}>Identité du smartphone</Text>
                        </View>

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
                                <SmartPhoneModelInput
                                    marque={newProduct.marqueTelephone || ''}
                                    value={newProduct.modeleTelephone || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modeleTelephone: text })}
                                    label="Modèle"
                                    placeholder="Ex: iPhone 14 Pro, Galaxy S23"
                                    required
                                    autoLoadLastUsed={true}
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
                                <Text style={styles.fieldLabel}>Année d'achat</Text>
                                <NativeInput
                                    placeholder="Ex: 2023"
                                    value={newProduct.anneeAchatTelephone || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, anneeAchatTelephone: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* ========== SECTION 2: CARACTÉRISTIQUES TECHNIQUES ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="cpu" size={18} color="#6366F1" />
                            <Text style={styles.sectionTitle}>Caractéristiques techniques</Text>
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
                                <Text style={styles.fieldLabel}>Taille écran</Text>
                                <NativeInput
                                    placeholder="Ex: 6.1 pouces"
                                    value={newProduct.tailleEcran || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, tailleEcran: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Type écran</Text>
                                <NativeInput
                                    placeholder="Ex: OLED, AMOLED"
                                    value={newProduct.typeEcran || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, typeEcran: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Caméra principale</Text>
                                <NativeInput
                                    placeholder="Ex: 48MP Triple"
                                    value={newProduct.numeroCameraPrincipale || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, numeroCameraPrincipale: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Caméra frontale</Text>
                                <NativeInput
                                    placeholder="Ex: 12MP"
                                    value={newProduct.numeroCameraFrontale || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, numeroCameraFrontale: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Batterie (mAh)</Text>
                                <NativeInput
                                    placeholder="Ex: 4000 mAh"
                                    value={newProduct.batterie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, batterie: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Santé batterie</Text>
                                <NativeInput
                                    placeholder="Ex: 95%"
                                    value={newProduct.batterieSante || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, batterieSante: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* ========== SECTION 3: CONNECTIVITÉ & COULEUR ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="wifi" size={18} color="#6366F1" />
                            <Text style={styles.sectionTitle}>Connectivité & Apparence</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Opérateur"
                                    fieldName="operateurs"
                                    productType="telephone"
                                    value={newProduct.operateur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, operateur: value })}
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

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Étanchéité</Text>
                                <NativeInput
                                    placeholder="Ex: IP68"
                                    value={newProduct.etancheite || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, etancheite: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                {/* Placeholder vide pour alignement */}
                            </View>
                        </View>

                        {/* Toggles: Connectivité */}
                        <View style={styles.toggleGroup}>
                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, dualSim: !newProduct.dualSim })}
                            >
                                <View style={[styles.checkbox, newProduct.dualSim && styles.checkboxActive]}>
                                    {newProduct.dualSim && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Double SIM</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, connectivite5G: !newProduct.connectivite5G })}
                            >
                                <View style={[styles.checkbox, newProduct.connectivite5G && styles.checkboxActive]}>
                                    {newProduct.connectivite5G && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>5G</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, nfc: !newProduct.nfc })}
                            >
                                <View style={[styles.checkbox, newProduct.nfc && styles.checkboxActive]}>
                                    {newProduct.nfc && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>NFC</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, chargementRapide: !newProduct.chargementRapide })}
                            >
                                <View style={[styles.checkbox, newProduct.chargementRapide && styles.checkboxActive]}>
                                    {newProduct.chargementRapide && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Charge rapide</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, chargementSansFil: !newProduct.chargementSansFil })}
                            >
                                <View style={[styles.checkbox, newProduct.chargementSansFil && styles.checkboxActive]}>
                                    {newProduct.chargementSansFil && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Charge sans fil</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ========== SECTION 4: ÉTAT & AUTHENTICITÉ ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="shield-check" size={18} color="#6366F1" />
                            <Text style={styles.sectionTitle}>État & Authenticité</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>IMEI</Text>
                                <NativeInput
                                    placeholder="Ex: 356789101234567"
                                    value={newProduct.imei || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, imei: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Garantie restante</Text>
                                <NativeInput
                                    placeholder="Ex: 6 mois"
                                    value={newProduct.garantieTelephone || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, garantieTelephone: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Réparations effectuées</Text>
                            <NativeInput
                                placeholder="Ex: Changement écran en janvier 2023"
                                value={newProduct.reparations || ''}
                                onChangeText={(text) => setNewProduct({ ...newProduct, reparations: text })}
                                style={styles.fieldInput}
                                multiline
                            />
                        </View>

                        {/* Toggles: Authenticité */}
                        <View style={styles.toggleGroup}>
                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, boiteOriginale: !newProduct.boiteOriginale })}
                            >
                                <View style={[styles.checkbox, newProduct.boiteOriginale && styles.checkboxActive]}>
                                    {newProduct.boiteOriginale && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Boîte d'origine</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, factureTelephone: !newProduct.factureTelephone })}
                            >
                                <View style={[styles.checkbox, newProduct.factureTelephone && styles.checkboxActive]}>
                                    {newProduct.factureTelephone && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Facture disponible</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, ecranOriginal: !newProduct.ecranOriginal })}
                            >
                                <View style={[styles.checkbox, newProduct.ecranOriginal && styles.checkboxActive]}>
                                    {newProduct.ecranOriginal && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Écran original</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, garantieConstructeurTelephone: !newProduct.garantieConstructeurTelephone })}
                            >
                                <View style={[styles.checkbox, newProduct.garantieConstructeurTelephone && styles.checkboxActive]}>
                                    {newProduct.garantieConstructeurTelephone && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Garantie constructeur</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ========== SECTION 5: ACCESSOIRES ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="package" size={18} color="#6366F1" />
                            <Text style={styles.sectionTitle}>Accessoires inclus</Text>
                        </View>

                        <View style={styles.fieldContainer}>
                            <ProductFieldSelector
                                label="Accessoires"
                                fieldName="accessoires"
                                productType="telephone"
                                value={newProduct.accessoiresTelephone || []}
                                onSelect={(value) => {
                                    const current = newProduct.accessoiresTelephone || [];
                                    const updated = current.includes(value)
                                        ? current.filter(item => item !== value)
                                        : [...current, value];
                                    setNewProduct({ ...newProduct, accessoiresTelephone: updated });
                                }}
                                multiselect
                            />

                            {newProduct.accessoiresTelephone && newProduct.accessoiresTelephone.length > 0 && (
                                <View style={styles.chipContainer}>
                                    {newProduct.accessoiresTelephone.map((accessoire, index) => (
                                        <View key={index} style={styles.chip}>
                                            <Text style={styles.chipText}>{accessoire}</Text>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    const updated = newProduct.accessoiresTelephone!.filter((_, i) => i !== index);
                                                    setNewProduct({ ...newProduct, accessoiresTelephone: updated });
                                                }}
                                            >
                                                <SafeIcon name="x" size={14} color="#6B7280" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View style={styles.hintBox}>
                            <SafeIcon name="info" size={16} color="#6366F1" />
                            <Text style={styles.hintText}>
                                📱 Plus votre description est complète (IMEI, état batterie, accessoires), plus vous rassurez les acheteurs !
                            </Text>
                        </View>
                    </>
                );

            case 'ordinateur':
                return (
                    <>
                        {/* ========== SECTION 1: IDENTITÉ DE L'ORDINATEUR ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="monitor" size={18} color="#00BCD4" />
                            <Text style={styles.sectionTitle}>Identité de l'ordinateur</Text>
                        </View>

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
                                <Text style={styles.fieldLabel}>Modèle</Text>
                                <NativeInput
                                    placeholder="Ex: XPS 15, MacBook Pro 14"
                                    value={newProduct.modeleOrdinateur || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, modeleOrdinateur: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
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
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Année d'achat</Text>
                                <NativeInput
                                    placeholder="Ex: 2023"
                                    value={newProduct.anneeAchatOrdinateur || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, anneeAchatOrdinateur: text })}
                                    style={styles.fieldInput}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Usage principal"
                                    fieldName="usages"
                                    productType="ordinateur"
                                    value={newProduct.usage || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, usage: value })}
                                />
                            </View>
                        </View>

                        {/* ========== SECTION 2: PERFORMANCES & CONFIGURATION ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="cpu" size={18} color="#00BCD4" />
                            <Text style={styles.sectionTitle}>Performances & Configuration</Text>
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
                                <Text style={styles.fieldLabel}>Fréquence</Text>
                                <NativeInput
                                    placeholder="Ex: 3.2 GHz"
                                    value={newProduct.frequenceProcesseur || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, frequenceProcesseur: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="RAM"
                                    fieldName="ram"
                                    productType="ordinateur"
                                    value={newProduct.ramOrdinateur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, ramOrdinateur: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Stockage"
                                    fieldName="stockage"
                                    productType="ordinateur"
                                    value={newProduct.stockageOrdinateur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, stockageOrdinateur: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Carte Graphique"
                                    fieldName="cartesGraphiques"
                                    productType="ordinateur"
                                    value={newProduct.carteGraphique || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, carteGraphique: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Système d'exploitation"
                                    fieldName="systemesExploitation"
                                    productType="ordinateur"
                                    value={newProduct.systemeExploitation || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, systemeExploitation: value })}
                                />
                            </View>
                        </View>

                        {/* Toggles: Stockage */}
                        <View style={styles.toggleGroup}>
                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, typeSSD: !newProduct.typeSSD })}
                            >
                                <View style={[styles.checkbox, newProduct.typeSSD && styles.checkboxActive]}>
                                    {newProduct.typeSSD && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>SSD (rapide)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, lecteurOptique: !newProduct.lecteurOptique })}
                            >
                                <View style={[styles.checkbox, newProduct.lecteurOptique && styles.checkboxActive]}>
                                    {newProduct.lecteurOptique && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Lecteur CD/DVD</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ========== SECTION 3: ÉCRAN & MULTIMÉDIA ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="monitor" size={18} color="#00BCD4" />
                            <Text style={styles.sectionTitle}>Écran & Multimédia</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Taille écran"
                                    fieldName="taillesEcran"
                                    productType="ordinateur"
                                    value={newProduct.tailleEcranOrdinateur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, tailleEcranOrdinateur: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type écran"
                                    fieldName="typesEcran"
                                    productType="ordinateur"
                                    value={newProduct.typeEcranOrdinateur || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeEcranOrdinateur: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Résolution écran</Text>
                                <NativeInput
                                    placeholder="Ex: 1920x1080, 4K"
                                    value={newProduct.resolutionOrdinateur || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, resolutionOrdinateur: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Clavier"
                                    fieldName="claviers"
                                    productType="ordinateur"
                                    value={newProduct.clavier || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, clavier: value })}
                                />
                            </View>
                        </View>

                        {/* Toggles: Multimédia */}
                        <View style={styles.toggleGroup}>
                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, touchscreen: !newProduct.touchscreen })}
                            >
                                <View style={[styles.checkbox, newProduct.touchscreen && styles.checkboxActive]}>
                                    {newProduct.touchscreen && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Écran tactile</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, webcam: !newProduct.webcam })}
                            >
                                <View style={[styles.checkbox, newProduct.webcam && styles.checkboxActive]}>
                                    {newProduct.webcam && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Webcam</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ========== SECTION 4: CONNECTIVITÉ & PORTS ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="usb" size={18} color="#00BCD4" />
                            <Text style={styles.sectionTitle}>Connectivité & Ports</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Wi-Fi</Text>
                                <NativeInput
                                    placeholder="Ex: Wi-Fi 6"
                                    value={newProduct.wifi || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, wifi: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Autonomie batterie</Text>
                                <NativeInput
                                    placeholder="Ex: 8 heures"
                                    value={newProduct.batterie || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, batterie: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* Toggles: Connectivité */}
                        <View style={styles.toggleGroup}>
                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, portUSBC: !newProduct.portUSBC })}
                            >
                                <View style={[styles.checkbox, newProduct.portUSBC && styles.checkboxActive]}>
                                    {newProduct.portUSBC && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>USB-C</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, portHDMI: !newProduct.portHDMI })}
                            >
                                <View style={[styles.checkbox, newProduct.portHDMI && styles.checkboxActive]}>
                                    {newProduct.portHDMI && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>HDMI</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, bluetooth: !newProduct.bluetooth })}
                            >
                                <View style={[styles.checkbox, newProduct.bluetooth && styles.checkboxActive]}>
                                    {newProduct.bluetooth && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Bluetooth</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ========== SECTION 5: ÉTAT & GARANTIE ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="shield-check" size={18} color="#00BCD4" />
                            <Text style={styles.sectionTitle}>État & Garantie</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Garantie restante</Text>
                                <NativeInput
                                    placeholder="Ex: 12 mois"
                                    value={newProduct.garantieOrdinateur || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, garantieOrdinateur: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                {/* Placeholder */}
                            </View>
                        </View>

                        {/* Toggles: Garantie & Authenticité */}
                        <View style={styles.toggleGroup}>
                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, garantieConstructeurOrdinateur: !newProduct.garantieConstructeurOrdinateur })}
                            >
                                <View style={[styles.checkbox, newProduct.garantieConstructeurOrdinateur && styles.checkboxActive]}>
                                    {newProduct.garantieConstructeurOrdinateur && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Garantie constructeur</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, factureOrdinateur: !newProduct.factureOrdinateur })}
                            >
                                <View style={[styles.checkbox, newProduct.factureOrdinateur && styles.checkboxActive]}>
                                    {newProduct.factureOrdinateur && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Facture disponible</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toggleButton}
                                onPress={() => setNewProduct({ ...newProduct, boiteOriginaleOrdinateur: !newProduct.boiteOriginaleOrdinateur })}
                            >
                                <View style={[styles.checkbox, newProduct.boiteOriginaleOrdinateur && styles.checkboxActive]}>
                                    {newProduct.boiteOriginaleOrdinateur && <SafeIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.toggleLabel}>Boîte d'origine</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ========== SECTION 6: ACCESSOIRES & LOGICIELS ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="package" size={18} color="#00BCD4" />
                            <Text style={styles.sectionTitle}>Accessoires & Logiciels</Text>
                        </View>

                        <View style={styles.fieldContainer}>
                            <ProductFieldSelector
                                label="Accessoires inclus"
                                fieldName="accessoires"
                                productType="ordinateur"
                                value={newProduct.accessoiresOrdinateur || []}
                                onSelect={(value) => {
                                    const current = newProduct.accessoiresOrdinateur || [];
                                    const updated = current.includes(value)
                                        ? current.filter(item => item !== value)
                                        : [...current, value];
                                    setNewProduct({ ...newProduct, accessoiresOrdinateur: updated });
                                }}
                                multiselect
                            />

                            {newProduct.accessoiresOrdinateur && newProduct.accessoiresOrdinateur.length > 0 && (
                                <View style={styles.chipContainer}>
                                    {newProduct.accessoiresOrdinateur.map((accessoire, index) => (
                                        <View key={index} style={styles.chip}>
                                            <Text style={styles.chipText}>{accessoire}</Text>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    const updated = newProduct.accessoiresOrdinateur!.filter((_, i) => i !== index);
                                                    setNewProduct({ ...newProduct, accessoiresOrdinateur: updated });
                                                }}
                                            >
                                                <SafeIcon name="x" size={14} color="#6B7280" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View style={styles.fieldContainer}>
                            <ProductFieldSelector
                                label="Logiciels inclus"
                                fieldName="logiciels"
                                productType="ordinateur"
                                value={newProduct.logicielsInclus || []}
                                onSelect={(value) => {
                                    const current = newProduct.logicielsInclus || [];
                                    const updated = current.includes(value)
                                        ? current.filter(item => item !== value)
                                        : [...current, value];
                                    setNewProduct({ ...newProduct, logicielsInclus: updated });
                                }}
                                multiselect
                            />

                            {newProduct.logicielsInclus && newProduct.logicielsInclus.length > 0 && (
                                <View style={styles.chipContainer}>
                                    {newProduct.logicielsInclus.map((logiciel, index) => (
                                        <View key={index} style={styles.chip}>
                                            <Text style={styles.chipText}>{logiciel}</Text>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    const updated = newProduct.logicielsInclus!.filter((_, i) => i !== index);
                                                    setNewProduct({ ...newProduct, logicielsInclus: updated });
                                                }}
                                            >
                                                <SafeIcon name="x" size={14} color="#6B7280" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View style={styles.hintBox}>
                            <SafeIcon name="info" size={16} color="#00BCD4" />
                            <Text style={styles.hintText}>
                                💻 Précisez les specs (processeur, RAM, GPU) et logiciels pour maximiser vos chances de vente !
                            </Text>
                        </View>
                    </>
                );

            case 'vetement':
                return (
                    <>
                        {/* ========== SECTION 1: IDENTITÉ DU VÊTEMENT ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="shopping-bag" size={18} color="#EC4899" />
                            <Text style={styles.sectionTitle}>Identité du vêtement</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Type"
                                    fieldName="types"
                                    productType="vetement"
                                    value={newProduct.typeVetement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, typeVetement: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Genre"
                                    fieldName="genres"
                                    productType="vetement"
                                    value={newProduct.genreVetement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, genreVetement: value })}
                                    required
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Taille"
                                    fieldName="tailles"
                                    productType="vetement"
                                    value={newProduct.taille || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, taille: value })}
                                    required
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="État"
                                    fieldName="etats"
                                    productType="vetement"
                                    value={newProduct.etatVetement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, etatVetement: value })}
                                    required
                                />
                            </View>
                        </View>

                        {/* ========== SECTION 2: CARACTÉRISTIQUES ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="info" size={18} color="#EC4899" />
                            <Text style={styles.sectionTitle}>Caractéristiques</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Couleur"
                                    fieldName="couleurs"
                                    productType="vetement"
                                    value={newProduct.couleurVetement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, couleurVetement: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Matière"
                                    fieldName="matieres"
                                    productType="vetement"
                                    value={newProduct.matiereVetement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, matiereVetement: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Marque"
                                    fieldName="marques"
                                    productType="vetement"
                                    value={newProduct.marqueVetement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, marqueVetement: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Style"
                                    fieldName="styles"
                                    productType="vetement"
                                    value={newProduct.styleVetement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, styleVetement: value })}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Patron/Motif"
                                    fieldName="patrons"
                                    productType="vetement"
                                    value={newProduct.patronVetement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, patronVetement: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Coupe"
                                    fieldName="coupes"
                                    productType="vetement"
                                    value={newProduct.coupeVetement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, coupeVetement: value })}
                                />
                            </View>
                        </View>

                        {/* ========== SECTION 3: SAISON & ENTRETIEN ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="sun" size={18} color="#EC4899" />
                            <Text style={styles.sectionTitle}>Saison & Entretien</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <ProductFieldSelector
                                    label="Saison"
                                    fieldName="saisons"
                                    productType="vetement"
                                    value={newProduct.saisonVetement || ''}
                                    onSelect={(value) => setNewProduct({ ...newProduct, saisonVetement: value })}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Entretien</Text>
                                <NativeInput
                                    placeholder="Ex: Lavage machine 30°C"
                                    value={newProduct.lavable || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, lavable: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Origine/Fabrication</Text>
                                <NativeInput
                                    placeholder="Ex: Made in France"
                                    value={newProduct.origineVetement || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, origineVetement: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>Collection</Text>
                                <NativeInput
                                    placeholder="Ex: Printemps 2024"
                                    value={newProduct.collectionVetement || ''}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, collectionVetement: text })}
                                    style={styles.fieldInput}
                                />
                            </View>
                        </View>

                        {/* ========== SECTION 4: CERTIFICATIONS ========== */}
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="award" size={18} color="#EC4899" />
                            <Text style={styles.sectionTitle}>Certifications & Labels (optionnel)</Text>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Certifications</Text>
                            <NativeInput
                                placeholder="Ex: Bio, Équitable, GOTS"
                                value={newProduct.certifieVetement?.join(', ') || ''}
                                onChangeText={(text) => {
                                    const certs = text.split(',').map(c => c.trim()).filter(c => c);
                                    setNewProduct({ ...newProduct, certifieVetement: certs });
                                }}
                                style={styles.fieldInput}
                                multiline
                            />
                        </View>

                        <View style={styles.hintBox}>
                            <SafeIcon name="info" size={16} color="#EC4899" />
                            <Text style={styles.hintText}>
                                👔 Précisez taille, couleur, matière et état pour faciliter la vente !
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

                                        {/* Autocomplete intelligent pour structures de santé */}
                                        {(selectedType === 'hopital_clinique' || selectedType === 'laboratoire' || selectedType === 'pharmacie') ? (
                                            <AutocompleteStructure
                                                type={selectedType}
                                                value={newProduct.nom || ''}
                                                onChangeText={(text) => setNewProduct({ ...newProduct, nom: text })}
                                                placeholder={getProductNamePlaceholder(selectedType)}
                                                required
                                            />
                                        ) : (
                                            <NativeInput
                                                placeholder={getProductNamePlaceholder(selectedType)}
                                                value={newProduct.nom || ''}
                                                onChangeText={(text) => setNewProduct({ ...newProduct, nom: text })}
                                                style={styles.fieldInput}
                                            />
                                        )}
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
    returnTripSection: {
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    tripTypeOptions: {
        flexDirection: 'row',
        gap: 12,
    },
    tripTypeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderRadius: 10,
    },
    tripTypeButtonActive: {
        backgroundColor: modernColors.primary,
    },
    tripTypeButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    tripTypeButtonTextActive: {
        color: '#FFFFFF',
    },
    returnPricingContainer: {
        marginTop: 16,
        gap: 12,
    },
    savingsIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#ECFDF5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    savingsText: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.success,
    },
    ticketInfoSection: {
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    logoUploadButton: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: modernColors.primary,
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.background,
        marginTop: 8,
    },
    logoUploadContent: {
        alignItems: 'center',
        gap: 8,
    },
    logoUploadText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    logoPreview: {
        position: 'relative',
        width: 120,
        height: 120,
    },
    logoImage: {
        width: 120,
        height: 120,
        borderRadius: 8,
        resizeMode: 'contain',
    },
    removeLogo: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: modernColors.error,
        borderRadius: 12,
        padding: 4,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.info,
        marginTop: 12,
    },
    infoCardText: {
        flex: 1,
        fontSize: 13,
        color: modernColors.text,
        lineHeight: 20,
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

    // Styles Immobilier
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 20,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 2,
        borderBottomColor: modernColors.primary,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    togglesContainer: {
        gap: 10,
        marginTop: 8,
    },
    toggleOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
    },
    toggleOptionActive: {
        backgroundColor: '#EFF6FF',
        borderColor: modernColors.primary,
    },
    toggleLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    toggleLabelActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    equipementsScrollContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    equipementChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
    },
    equipementChipActive: {
        backgroundColor: '#EFF6FF',
        borderColor: modernColors.primary,
    },
    equipementChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },
    equipementChipTextActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
});

export default ProductManagerMobile;

