// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ProductDuplicationModal from './ProductDuplicationModal';
import ProductDeliveryConfigModal from './delivery/ProductDeliveryConfigModal';
// Code corrigé (remplace @ts-ignore)
// Code corrigé (remplace @ts-ignore)
// Code corrigé (remplace @ts-ignore)
// Code corrigé (remplace @ts-ignore)
// Code corrigé (remplace @ts-ignore)
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';
// Code corrigé (remplace @ts-ignore)
// Code corrigé (remplace @ts-ignore)
// ✅ NOUVEAU: Composants pour modalités réutilisables
// ✅ NOUVEAU: Configuration conditionnelle des champs prestations
// ✅ NOUVEAU: Suggestions intelligentes de catégories basées sur les données IA du service
import { ChaussureVariant } from './ChaussureVariantManager';
import { HotelVariant } from './HotelVariantManager';
import { OptionPrime } from './OptionsPrimesManager';
import { ProductVariant } from './ProductVariantManager';

const { width } = Dimensions.get('window');

// ✅ Fonction de normalisation sans accents pour la recherche
const normalizeText = (text: any): string => {
    // Sécurise contre undefined/null/number/boolean/objects
    if (text === undefined || text === null) return '';
    const value = typeof text === 'string' ? text : String(text);
    try {
        return value
            .toLowerCase()
            .normalize('NFD') // Décompose les caractères accentués
            .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
            .trim();
    } catch (_e) {
        // En cas d'environnement ne supportant pas normalize ou autre edge-case
        return value.toLowerCase().trim();
    }
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
    | 'mecanicien' // ✅ NOUVEAU : Mécanicien / Garage automobile
    | 'mecanicien_moto' // ✅ NOUVEAU : Mécanicien spécialisé motos/tricycles
    | 'ticket_voyage'
    | 'covoiturage'
    | 'vetement'
    | 'chaussure'
    | 'electromenager'
    | 'image_son'
    | 'telephone'
    | 'reparateur_telephone' // ✅ NOUVEAU : Réparateur téléphone/smartphone/tablette
    | 'ordinateur'
    | 'reparateur_informatique' // ✅ NOUVEAU : Réparateur ordinateur/imprimante/équipements informatiques
    | 'reparateur_electromenager' // ✅ NOUVEAU : Réparateur électroménager (frigos, cuisinières, lave-linge, etc.)
    | 'reparateur_frigo' // ✅ NOUVEAU : Frigoriste / Réparateur frigo & congélateur
    | 'reparateur_climatiseur' // ✅ NOUVEAU : Réparateur/Maintenance climatiseur/AC
    | 'reparateur_electronique' // ✅ NOUVEAU : Réparateur électronique (TV, radio, audio, vidéo)
    | 'mobilier'
    | 'decoration'
    | 'ustensiles_cuisine'
    | 'pieces_auto'
    | 'pieces_industrielles'
    | 'jouets_enfants'
    | 'aliments'
    | 'livres_fournitures'
    | 'quincaillerie'
    | 'carrelage' // ✅ NOUVEAU : Carrelage, faïence, mosaïque
    | 'prestation_service'
    | 'assurance'
    | 'pharmacie'
    | 'hopital_clinique'
    | 'laboratoire'
    | 'demenagement'
    | 'cosmetique_parfum'
    | 'bijoux'
    | 'coiffure_beaute'
    | 'couturier'
    | 'soutien_scolaire_repetiteur' // ✅ NOUVEAU : Soutien scolaire primaire/secondaire, Répétiteur, Cours particuliers
    | 'formation_education' // ✅ NOUVEAU : Formation professionnelle, Préparation concours grandes écoles
    | 'nettoyage_entretien' // ✅ NOUVEAU : Nettoyage & Entretien (Femme de ménage, Nounou, Blanchisseur, Gardien, Jardinier, Cuisinière, Chauffeur)
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
    actif?: boolean; // ✅ NOUVEAU 2025-11-01: true = actif, false = désactivé, undefined = actif (rétrocompat)

    // Champs spécifiques par type
    // Immobilier - ✅ REFONTE COMPLÈTE
    typeImmobilier?: string; // Type (Appartement, Villa, F1, F2, F3, etc.)
    statutImmobilier?: string; // À vendre, À louer, etc.
    standing?: string; // Économique, Standard, Bon standing, Haut standing, Luxe
    etatGeneral?: string; // Neuf, Excellent état, Bon état, À rénover
    ameublement?: string; // Non meublé, Semi-meublé, Meublé, etc.
    superficie?: string;
    nbChambres?: string;
    nbSallesBain?: string;
    etage?: string; // Numéro d'étage (pour appartements)
    nbEtages?: string; // Nombre d'étages (pour villas/immeubles)
    anneeConstruction?: string; // Année de construction
    adresse?: string;
    quartier?: string; // Quartier (sélection depuis listes quartiers_douala ou quartiers_yaounde)
    ville?: string; // Ville (sélection depuis liste villes Cameroun 60+)
    gpsImmobilier?: string; // Coordonnées GPS de l'immobilier
    // Équipements et commodités
    equipementsImmo?: string[]; // ✅ ENRICHI: Liste 35+ (Eau 24h, Groupe électrogène, etc.)
    parking?: boolean; // Garage/Parking disponible
    nbParkings?: string; // Nombre de places de parking
    ascenseur?: boolean; // Ascenseur disponible
    jardin?: boolean; // Jardin/Espace vert
    piscine?: boolean; // Piscine
    securite?: boolean; // Gardien/Sécurité 24h
    internet?: boolean; // Internet/Fibre
    climatisation?: boolean; // Climatisation
    // ✅ NOUVEAUX CHAMPS
    proximites?: string[]; // ✅ NOUVEAU: Commodités à proximité (École, Mahima, Banque...)
    acces_route?: string; // ✅ NOUVEAU: Type d'accès routier (Route goudronnée, Zone inondable...)
    type_bail?: string; // ✅ NOUVEAU: Durée du bail (1 an, 2 ans, 3 ans...)
    conditions_location?: string[]; // ✅ NOUVEAU: Conditions (Caution 2 mois, Garant exigé...)
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
    servicesLocationCourte?: string[]; // ✅ NOUVEAU: Services supplémentaires (Transfert aéroport, Petit-déj, etc.)
    politiqueAnnulation?: string; // ✅ NOUVEAU: Politique d'annulation (Gratuite 24h, Flexible, Stricte, etc.)
    reglesLocationCourte?: string[]; // ✅ NOUVEAU: Règles de la maison (Non-fumeur, Animaux interdits, etc.)
    typeHote?: string; // ✅ NOUVEAU: Type d'hôte (Sur place, À proximité, À distance, Professionnel)
    languesHote?: string[]; // ✅ NOUVEAU: Langues parlées par l'hôte
    paiementsAcceptes?: string[]; // ✅ NOUVEAU: Modes de paiement acceptés
    disponibiliteLocationCourte?: string; // ✅ NOUVEAU: Disponibilité (Toute l'année, Haute saison, etc.)

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
    // ✅ LOCALISATION DU VÉHICULE
    villeVehicule?: string; // Ville où se trouve le véhicule
    quartierVehicule?: string; // Quartier/Zone précise
    localisationVehicule?: string; // Adresse ou point de repère

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

    // Hôtellerie - ✅ REFONTE COMPLÈTE CONTEXTUALISÉE + VARIANTES
    nomEtablissementHotel?: string; // ✅ NOUVEAU: Nom de l'établissement (liste)
    typeHebergement?: string; // Hôtel, Chambre d'hôte, Auberge, Resort, etc.
    categorieHotel?: string; // 1-5 étoiles, Palace
    zoneHotel?: string; // ✅ NOUVEAU: Zone/Quartier (Akwa, Bonanjo, Bastos...)
    nbChambresHotel?: string; // Nombre total de chambres
    variantesChambres?: HotelVariant[]; // ✅ NOUVEAU: Variantes chambres (type × capacité × prix × image)
    typesChambre?: string[]; // Simple, Double, Suite, Familiale, etc. (obsolète si variantes)
    capaciteHotel?: string; // ✅ NOUVEAU: Capacité (nombre de personnes) (obsolète si variantes)
    equipementsHotel?: string[]; // Wi-Fi, Piscine, Spa, Gym, etc.
    servicesHotel?: string[]; // ✅ NOUVEAU: Services (liste enrichie)
    pensionHotel?: string; // ✅ NOUVEAU: Type de pension
    prixParNuit?: string; // Prix minimum par nuit (obsolète si variantes)
    deviseHotel?: string; // Devise du prix
    politiquesHotel?: string[]; // ✅ NOUVEAU: Politiques (annulation, animaux...)
    languesHotel?: string[]; // ✅ NOUVEAU: Langues parlées
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

    // Covoiturage - ✅ REFONTE COMPLÈTE
    villeDepart?: string; // ✅ NOUVEAU: Ville de départ (Douala, Yaoundé...)
    pointDepart?: string; // Point de départ précis (quartier, gare, lieu)
    villeArrivee?: string; // ✅ NOUVEAU: Ville d'arrivée
    pointArrivee?: string; // Point d'arrivée précis (quartier, gare, lieu)
    dateTrajet?: string; // Date du trajet (format ISO ou date native)
    heureTrajet?: string; // Heure de départ (HH:MM)
    nbPlacesDisponibles?: string; // Nombre de places disponibles
    prixParPlace?: string; // Prix par place
    vehiculeInfo?: string; // Type/Modèle de véhicule (Berline, SUV...)
    typeVehiculeCovoiturage?: string; // ✅ NOUVEAU: Type de véhicule (liste)
    preferencesTrajet?: string[]; // ✅ NOUVEAU: Préférences (array)
    frequenceTrajet?: string; // ✅ NOUVEAU: Fréquence (Quotidien, Hebdomadaire...)

    // Vêtement (Textile) - ✅ ENRICHI + SYSTÈME DE VARIANTES
    typeVetement?: string; // T-shirt, Pantalon, Robe, Veste, etc.
    genreVetement?: string; // Homme, Femme, Enfant, Unisexe
    taille?: string; // XS, S, M, L, XL, XXL, tailles numériques (obsolète si variantes)
    couleurVetement?: string; // (obsolète si variantes)
    matiereVetement?: string; // Coton, Polyester, Laine, Soie, Lin
    marqueVetement?: string;
    etatVetement?: string; // Neuf avec étiquette, Neuf sans étiquette, Occasion - Excellent, Bon
    styleVetement?: string; // Casual, Formel, Sport, Streetwear, Vintage
    saisonVetement?: string; // Été, Hiver, Mi-saison, Toute saison
    origineVetement?: string; // Made in..., Local, Importé
    lavable?: string; // Lavage machine, Lavage main, Nettoyage à sec
    patronVetement?: string; // Uni, Rayé, À pois, Imprimé, Floral
    motifVetement?: string; // Motifs africains (Wax, Pagne, Kente, Bogolan, etc.)
    coupeVetement?: string; // Slim, Regular, Loose, Oversize
    longueurVetement?: string; // Court, Mi-long, Long (pour robes, manteaux)
    collectionVetement?: string; // Collection année, saison
    occasionVetement?: string; // ✅ NOUVEAU: Quotidien, Soirée, Mariage, Sport, etc.
    certifieVetement?: string[]; // Bio, Équitable, Made in France, etc.
    // ✅ SYSTÈME DE VARIANTES (Taille x Couleur x Prix x Images)
    variantesVetements?: ProductVariant[]; // ✅ NOUVEAU: Tableau de variantes (taille, couleur, prix, images)

    // Chaussure - ✅ REFONTE avec système de variantes
    nomChaussure?: string; // ✅ NOUVEAU: Nom de la chaussure (Basket Nike Air Max, Escarpin, etc.)
    typeChaussure?: string; // Baskets, Sandales, Bottes, Mocassins, Escarpins, etc.
    marqueChaussure?: string; // Nike, Adidas, Clarks, etc.
    materiauChaussure?: string; // Cuir, Synthétique, Toile, Daim, etc.
    etatChaussure?: string; // Neuf, Excellent, Bon, Occasion
    genreChaussure?: string; // Homme, Femme, Enfant, Unisexe
    usageChaussure?: string; // Sport, Ville, Casual, Formel, Randonnée
    styleChaussure?: string; // ✅ NOUVEAU: Casual, Sport, Élégant, etc.
    // ✅ SYSTÈME DE VARIANTES (Pointure x Couleur x Prix x Images)
    variantesChaussures?: ChaussureVariant[]; // ✅ NOUVEAU: Tableau de variantes
    // Champs obsolètes (conservés pour compatibilité CSV)
    pointure?: string; // Obsolète: utilisé seulement si pas de variantes
    couleurChaussure?: string; // Obsolète: utilisé seulement si pas de variantes

    // Électroménager - ✅ REFONTE COMPLÈTE
    nomProduitElectro?: string; // ✅ NOUVEAU: Nom du produit (liste)
    typeElectro?: string; // Réfrigérateur, Cuisinière, Four, etc.
    categorieElectro?: string; // Gros électroménager - Froid/Cuisson/Lavage...
    marqueElectro?: string;
    modeleElectro?: string;
    etatElectro?: string; // Neuf, Occasion, Reconditionné
    anneeAchat?: string; // Année d'achat
    garantieElectro?: string; // ✅ AMÉLIORÉ: Liste de garanties
    garantieConstructeur?: boolean; // Garantie constructeur valide
    consommationEnergetique?: string; // A+++, A++, A+, A, B, C, D
    capaciteElectro?: string; // ✅ AMÉLIORÉ: Liste de capacités
    couleurElectro?: string; // Blanc, Inox, Noir, Gris
    dimensionsElectro?: string; // H x L x P
    fonctionnalitesElectro?: string[]; // ✅ AMÉLIORÉ: Liste de fonctionnalités
    facture?: boolean; // Facture disponible
    manuel?: boolean; // Manuel d'utilisation disponible
    accessoires?: string; // Accessoires fournis

    // Image et Son (TV, Audio, etc.) - ✅ REFONTE COMPLÈTE
    nomProduitImageSon?: string; // ✅ NOUVEAU: Nom du produit (TV Samsung QLED 55", Barre de son Sony, etc.)
    categorieImageSon?: string; // ✅ NOUVEAU: Télévision, Home Cinéma, Barre de son, Enceintes, Projecteur
    typeImageSon?: string; // Type spécifique (TV LED, TV OLED, Enceinte Bluetooth, etc.)
    marqueImageSon?: string; // Samsung, LG, Sony, Philips, etc.
    modeleImageSon?: string; // ✅ NOUVEAU: Entrée de gamme, Milieu de gamme, Haut de gamme, Premium
    technologieEcran?: string; // ✅ NOUVEAU: LED, OLED, QLED, NanoCell, etc.
    diagonaleEcran?: string; // Taille écran (24", 32", 43", 50", 55", 65", etc.)
    resolution?: string; // HD (720p), Full HD (1080p), 4K, 8K
    connectivitesImageSon?: string[]; // ✅ NOUVEAU: HDMI, USB, WiFi, Bluetooth, etc. (multiselect)
    fonctionnalitesImageSon?: string[]; // Smart TV, WiFi, Bluetooth, HDR, Dolby Atmos, etc.
    etatImageSon?: string; // Neuf scellé, Excellent état, Bon état, etc.
    garantieImageSon?: string; // ✅ ENRICHI: Garantie constructeur 1 an, 2 ans, etc.
    accessoiresImageSon?: string[]; // ✅ NOUVEAU: Télécommande, Câbles HDMI, Support mural, etc. (multiselect)
    puissanceAudio?: string; // ✅ NOUVEAU: Puissance audio (pour enceintes, barres de son) en Watts
    nbEnceintes?: string; // ✅ NOUVEAU: Nombre d'enceintes (pour home cinéma: 2.1, 5.1, 7.1)
    anneeSortie?: string; // ✅ NOUVEAU: Année de sortie du modèle

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

    // Réparateur Informatique (Ordinateurs, Imprimantes, Équipements) - ✅ NOUVEAU 🌍 AFRIQUE
    typesReparationInfo?: string[]; // ✅ Types de réparations proposées (hardware, software, réseau, imprimantes)
    marquesOrdinateursReparees?: string[]; // ✅ Marques d'ordinateurs supportées (HP, Dell, Lenovo, Asus, Apple, etc.)
    marquesImprimantesReparees?: string[]; // ✅ Marques d'imprimantes supportées (HP, Epson, Canon, Brother, etc.)
    modelesOrdinateursSpecialises?: string[]; // ✅ Modèles spécifiques (HP EliteBook 840 G7, Dell Latitude 5510, etc.)
    modelesImprimantesSpecialises?: string[]; // ✅ Modèles imprimantes (Epson L380, HP LaserJet Pro M28w, Canon G3010, etc.)
    typesPannesReparees?: string[]; // ✅ Types de pannes traitées (écran cassé, virus, surchauffe, etc.)
    delaiReparationInfo?: string; // ✅ Délai de réparation (Express 30min-2h, Rapide même jour, Standard 1-3j, etc.)
    garantieReparation?: string; // ✅ Garantie offerte (1 mois, 3 mois, 6 mois, 1 an, etc.)
    servicesAdditionnelsInfo?: string[]; // ✅ Services additionnels (Déplacement domicile, Support 24/7, Diagnostic gratuit, etc.)
    certificationsInfo?: string[]; // ✅ Certifications (HP certified, Dell certified, Apple ACMT, CompTIA A+, etc.)
    equipementsAtelierInfo?: string[]; // ✅ Équipements disponibles (Micro-soudure, Récupération données, etc.)
    tarifDiagnostic?: string; // ✅ Tarif diagnostic (Gratuit, 1000 FCFA, 2000 FCFA, etc.)
    tarifDeplacementInfo?: string; // ✅ Tarif déplacement (Gratuit zone, 2000 FCFA, selon distance, etc.)
    interventionDomicile?: boolean; // ✅ Propose intervention à domicile/bureau
    supportDistance?: boolean; // ✅ Support technique à distance disponible
    paiementMobileMoney?: boolean; // ✅ Accepte Mobile Money (MTN/Orange)
    paiementEchelonne?: boolean; // ✅ Propose paiement échelonné
    anneesExperienceReparation?: string; // ✅ Années d'expérience (1-2 ans, 3-5 ans, 5-10 ans, 10+ ans)
    languesServiceInfo?: string[]; // ✅ Langues parlées (Français, Anglais, Ewondo, Douala, etc.)

    // Réparateur Électroménager (Frigos, Cuisinières, Lave-linge, etc.) - ✅ NOUVEAU 🌍 AFRIQUE
    typesReparationElectro?: string[]; // ✅ Types de réparations (frigos, cuisinières, lave-linge, micro-ondes, etc.)
    marquesElectromenagerReparees?: string[]; // ✅ Marques supportées (Binatone, Sokany, LG, Samsung, Hisense, etc.)
    typesAppareilsElectro?: string[]; // ✅ Types d'appareils (réfrigérateur, cuisinière, lave-linge, climatiseur, etc.)
    typesPannesElectro?: string[]; // ✅ Types de pannes traitées (ne refroidit plus, ne chauffe plus, fuite, etc.)
    delaiReparationElectro?: string; // ✅ Délai (Express même jour, Rapide 24-48h, Standard 2-5j, etc.)
    garantieReparationElectro?: string; // ✅ Garantie offerte (1 an, 6 mois, 3 mois, 1 mois, etc.)
    servicesAdditionnelsElectro?: string[]; // ✅ Services (Déplacement gratuit, Diagnostic gratuit, Urgence 24/7, etc.)
    certificationsElectro?: string[]; // ✅ Certifications (Frigoriste certifié, Gaz, Agrément constructeur, etc.)
    equipementsAtelierElectro?: string[]; // ✅ Équipements (Manifold, Pompe à vide, Poste à souder, etc.)
    tarifDiagnosticElectro?: string; // ✅ Tarif diagnostic (Gratuit, payant, etc.)
    tarifDeplacementElectro?: string; // ✅ Tarif déplacement (Gratuit zone, selon distance, etc.)
    interventionDomicileElectro?: boolean; // ✅ Propose intervention à domicile
    urgenceDisponibleElectro?: boolean; // ✅ Urgence 24/7 disponible
    paiementMobileMoneyElectro?: boolean; // ✅ Accepte Mobile Money
    paiementEchelonneElectro?: boolean; // ✅ Paiement échelonné
    specialiteFroid?: boolean; // ✅ Spécialiste froid (frigos, congélateurs, climatiseurs)
    specialiteCuisson?: boolean; // ✅ Spécialiste cuisson (cuisinières, fours, micro-ondes)
    specialiteLavage?: boolean; // ✅ Spécialiste lavage (lave-linge, lave-vaisselle, sèche-linge)
    anneesExperienceElectro?: string; // ✅ Années d'expérience
    zonesInterventionElectro?: string[]; // ✅ Zones d'intervention (quartiers Douala, Yaoundé, etc.)

    // Décoration d'Intérieur
    typeDecoration?: string; // Tableau, Luminaire, Tapis, etc.
    styleDecoration?: string; // ✅ Spécifique à la décoration
    couleurDecoration?: string;
    dimensionsDecoration?: string;
    materiauDecoration?: string; // Toile, Bois, Métal, etc.

    // Ustensiles de Cuisine - ✅ REFONTE COMPLÈTE
    nomProduitUstensile?: string; // ✅ NOUVEAU: Nom du produit (liste 100+)
    categorieUstensile?: string; // ✅ NOUVEAU: Catégorie (Traditionnel africain, Batterie, Cuisson, Vaisselle, etc.)
    typeUstensile?: string; // Casserole, Poêle, Couteau, Mixer, etc.
    materiauUstensile?: string; // Inox, Aluminium, Plastique, Bois, Terre cuite, etc.
    marqueUstensile?: string; // Binatone, Sokany, Tefal, Moulinex, etc.
    capaciteUstensile?: string; // ✅ AMÉLIORÉ: Liste de capacités (0.5L à 50L+, diamètres)
    etatUstensile?: string; // ✅ AMÉLIORÉ: Neuf scellé, Excellent état, Bon état, etc.
    usageUstensile?: string; // ✅ NOUVEAU: Domestique, Professionnel, Événementiel, Traditionnel africain, etc.
    piecesDansSet?: string; // ✅ AMÉLIORÉ: Nombre de pièces (1 à 20+)
    compatibiliteUstensile?: string[]; // ✅ NOUVEAU: Compatibilités (Tous feux, Gaz, Induction, Four, etc.)
    // Champs obsolètes (conservés pour compatibilité CSV)
    capacite?: string; // Obsolète: utilisé seulement si pas de capaciteUstensile

    // Assurance - ✅ REFONTE COMPLÈTE
    typeAssuranceVie?: string; // ✅ NOUVEAU: VIE ou NON VIE (PREMIER CHAMP, OBLIGATOIRE)
    produitAssurance?: string; // ✅ RENOMMÉ: Produit d'assurance (Auto, Santé, Vie entière, etc.)
    compagnieAssurance?: string; // Nom de la compagnie d'assurance
    couverturesArray?: string[]; // ✅ NOUVEAU: Couvertures/Garanties en tableau (multi-select)
    beneficesArray?: string[]; // ✅ NOUVEAU: Bénéfices en tableau (multi-select)
    optionsPrimes?: OptionPrime[]; // ✅ NOUVEAU: Tableau options/primes/franchises
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

    // Électricité et éclairage - ✅ REFONTE COMPLÈTE
    nomProduitElectrique?: string; // ✅ NOUVEAU: Nom du produit (liste)
    categorieElectrique?: string; // Câblage, Éclairage, Protection...
    typeElectricite?: string; // Type d'éclairage si applicable
    marqueElectricite?: string;
    tensionElectrique?: string; // 12V, 220V, 380V...
    puissanceElectrique?: string; // 3W, 10W, 100W...
    culotAmpoule?: string; // E27, E14, GU10... (si ampoule)
    couleurLumiere?: string; // Blanc chaud, Blanc froid, RGB...
    normesElectrique?: string[]; // ✅ NOUVEAU: Array pour multi-select (CE, NF, IP44...)
    garantieElectrique?: string; // 1 an, 2 ans, 5 ans...
    etatElectrique?: string; // Neuf, Occasion...
    utilisationElectrique?: string; // Résidentiel, Commercial...

    // Pièces Détachées Automobile - ✅ REFONTE COMPLÈTE
    nomProduitPieceAuto?: string; // ✅ NOUVEAU: Nom de la pièce (liste)
    categoriePieceAuto?: string; // Catégorie principale (Moteur, Freinage, etc.)
    typePieceAuto?: string; // Type de pièce détaillé
    marquePieceAuto?: string; // Marque de la pièce (Bosch, Valeo, etc.)
    marqueVehiculeCompatible?: string; // Marque du véhicule compatible
    modeleVehicule?: string; // Modèle du véhicule (si spécifique)
    niveauCompatibilite?: string; // Niveau de compatibilité
    referenceAuto?: string; // Référence constructeur
    anneesCompatibles?: string; // Années compatibles (Ex: 2015-2020)
    compatibiliteDetaillee?: string; // Compatibilité détaillée (texte libre)
    materiauPiece?: string; // Matériau de fabrication
    originePiece?: string; // Origine de fabrication
    etatPieceAuto?: string; // État de la pièce
    garantiePiece?: string; // Garantie
    typeFournisseur?: string; // Type de fournisseur

    // Pièces Détachées Industrielles
    typePieceIndustrielle?: string; // Roulement, Courroie, Moteur, Pompe, etc.
    marquePieceIndustrielle?: string;
    referencePiece?: string;
    applicationIndustrielle?: string; // Type de machine/industrie
    materielPiece?: string;
    etatPieceIndustrielle?: string; // Neuf d'origine, Neuf équivalent, Reconditionné, Occasion...
    garantiePieceIndustrielle?: string; // Garantie constructeur, 1 an, 2 ans...
    normePieceIndustrielle?: string; // ISO 9001, CE, DIN, ANSI...

    // Jouets pour Enfants
    typeJouet?: string; // Éducatif, Peluche, Jeu de société, Puzzle, etc.
    ageRecommande?: string; // 0-3 ans, 3-6 ans, 6+, etc.
    marqueJouet?: string;
    genreJouet?: string; // Mixte, Garçon, Fille
    etatJouet?: string; // Neuf, Excellent état, Bon état, etc.
    emballageJouet?: string; // Emballé, Sous blister, Sans emballage, etc.
    materiauJouet?: string; // Plastique, Bois, Tissu, etc.
    couleursJouet?: string[]; // Couleurs principales (Array pour MultiSelect)
    alimentationJouet?: string; // Piles, Sans énergie, Rechargeable, etc.
    lieuUtilisation?: string; // Intérieur, Extérieur, Les deux
    fonctionnalitesJouet?: string[]; // Fonctionnalités (Array pour MultiSelect)
    categoriesEducatives?: string[]; // Catégories éducatives (Array pour MultiSelect)
    normesSecurite?: string[]; // CE, EN71, etc. (Array pour MultiSelect)
    nombreJoueurs?: string; // Nombre de joueurs (pour jeux de société)
    dureeJeu?: string; // Durée de jeu (pour jeux de société)
    accessoiresInclus?: string[]; // Accessoires inclus (Array pour MultiSelect)
    garantieJouet?: string; // Garantie
    villeJouet?: string; // Ville où trouver le jouet
    quartierJouet?: string; // Quartier où trouver le jouet

    // Mobilier - ✅ REFONTE COMPLÈTE
    typeMobilier?: string; // Canapé, Lit, Table, Chaise, Armoire, etc.
    categorieMobilier?: string; // Salon, Chambre, Salle à manger, Bureau, Rangement
    styleMobilier?: string; // Moderne, Classique, Scandinave, Industriel, Vintage
    materiauMobilier?: string; // Bois, Métal, Tissu, Cuir, Verre
    couleurMobilier?: string; // ✅ AMÉLIORÉ: Liste de couleurs
    dimensionsMobilier?: string; // H x L x P ou dimension standard
    etatMobilier?: string; // Neuf, Excellent, Bon état, À rénover
    marqueMobilier?: string; // ✅ NOUVEAU: Marque/Fabricant (IKEA, Artisan local, etc.)
    caracteristiquesMobilier?: string[]; // ✅ NOUVEAU: Caractéristiques spéciales (Démontable, Extensible, etc.)
    nombrePlaces?: string; // Pour canapés, tables, etc.
    montageRequis?: boolean; // Montage nécessaire
    livraison?: boolean; // Livraison disponible
    fraisLivraison?: string; // Montant des frais de livraison
    garantieMobilier?: string; // ✅ AMÉLIORÉ: Garantie (liste)
    poids?: string; // Poids en kg
    demontable?: boolean; // Facilement démontable
    villeMobilier?: string; // ✅ NOUVEAU: Ville où se trouve le meuble
    quartierMobilier?: string; // ✅ NOUVEAU: Quartier où se trouve le meuble

    // Aliments & Agroalimentaire
    categorieAliment?: string; // Fruits, Légumes, Viande, Poisson, Céréales, etc.
    typeAliment?: string; // Frais, Surgelé, Séché, En conserve
    marqueAliment?: string; // ✅ NOUVEAU: Marque du produit alimentaire (Maggi, Nestlé, etc.)
    origine?: string; // Locale, Importée (pays)
    bio?: boolean; // Agriculture biologique
    dateExpiration?: string; // Date de péremption (format JJ/MM/AAAA)
    dateProduction?: string; // Date de production/conditionnement (format JJ/MM/AAAA)
    conservation?: string; // Température ambiante, Réfrigéré, Congelé
    poids?: string; // Poids net
    uniteMesure?: string; // ✅ Unité de mesure (kg, g, L, etc.)
    conditionnement?: string; // Vrac, Emballé, Sous vide, Barquette
    labelQualite?: string[]; // Bio, Label Rouge, AOC, AOP, IGP
    valeurNutritionnelle?: string; // Informations nutritionnelles
    allergenes?: string; // Allergènes présents (string pour compatibilité)
    allergenesArray?: string[]; // ✅ NOUVEAU: Allergènes en tableau pour MultiSelect
    certifications?: string[]; // Halal, Casher, Vegan, Sans gluten
    stockDisponible?: number; // Quantité disponible
    variants?: ProductVariant[]; // ✅ NOUVEAU: Variantes de conditionnement/quantité/prix avec images

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
    typeCalculatrice?: string; // Calculatrice simple, scientifique, graphique, etc.

    // Vin et Liqueur (Commercialisation) - ✅ NOUVEAU
    typeProduitVin?: string; // Type de produit (Vin rouge, Vin blanc, Champagne, Spiritueux, Liqueur)
    categorieVin?: string; // Catégorie principale (Vins rouges, Champagnes & Effervescents, etc.)
    regionVin?: string; // Région/Appellation (Bordeaux, Champagne, Afrique du Sud, etc.)
    marqueVin?: string; // Marque/Producteur (Moët & Chandon, Baron de Lestac, etc.)
    cepageVin?: string; // Cépage (Cabernet Sauvignon, Chardonnay, Merlot, etc.)
    millesimeVin?: string; // Millésime (2024, 2020, Non millésimé, etc.)
    formatVin?: string; // Format/Contenance (75cl, 1,5L Magnum, Carton 6 bouteilles, etc.)
    degreAlcool?: string; // Degré d'alcool (12-13%, 40-50%, etc.)
    typeCommercialisation?: string; // Type de commercialisation (Détail, Grossiste, Palette, etc.)
    certificationVin?: string; // Certification/Label (AOC, Bio, IGP, etc.)
    etatVin?: string; // État (Neuf scellé, Excellent état cave climatisée, Collection, etc.)
    emballageVin?: string; // Type d'emballage (Bouteille verre, Carton 6 bouteilles, Caisse bois, etc.)
    paysOrigineVin?: string; // Pays d'origine (France, Afrique du Sud, Chili, etc.)
    occasionVin?: string; // Occasion/Utilisation (Mariage, Apéritif, Bar/Restaurant, etc.)
    temperatureService?: string; // Température de service (6-8°C, 16-18°C, etc.)
    accordMetsVin?: string; // Accords mets-vins (Viandes rouges, Poissons, Fromages, etc.)
    quantiteMinimale?: string; // Quantité minimale (1 bouteille, 6 bouteilles carton, 50 bouteilles, etc.)

    // Quincaillerie - ✅ REFONTE COMPLÈTE
    nomProduitQuincaillerie?: string; // ✅ NOUVEAU: Nom du produit (liste 70+)
    categorieQuincaillerie?: string; // Catégorie principale
    typeQuincaillerie?: string; // Type de produit
    marqueQuincaillerie?: string; // Marque
    materiauQuincaillerie?: string; // Matériau
    dimensionQuincaillerie?: string; // Dimension/Diamètre
    finitionQuincaillerie?: string; // Finition/Couleur
    referenceQuincaillerie?: string; // Référence fabricant
    usageQuincaillerie?: string; // Usage recommandé
    normeQuincaillerie?: string; // Norme/Certification
    etatQuincaillerie?: string; // État
    garantieQuincaillerie?: string; // Garantie
    uniteVente?: string; // Unité de vente
    stockDisponible?: number; // Stock disponible
    typeFournisseurQuincaillerie?: string; // Type de fournisseur

    // Sanitaire - ✅ NOUVELLE CATÉGORIE COMPLÈTE
    nomProduitSanitaire?: string; // ✅ NOUVEAU: Nom du produit sanitaire (liste 140+)
    categorieSanitaire?: string; // Catégorie principale (Robinetterie, Éviers, WC, etc.)
    typeSanitaire?: string; // Type de produit
    marqueSanitaire?: string; // Marque
    materiauSanitaire?: string; // Matériau
    finitionSanitaire?: string; // Finition/Couleur
    dimensionSanitaire?: string; // Dimension standard
    etatSanitaire?: string; // État
    garantieSanitaire?: string; // Garantie
    normeSanitaire?: string; // Norme/Certification
    typeInstallation?: string; // Type d'installation
    caracteristiquesSanitaire?: string[]; // Caractéristiques techniques (Array pour MultiSelect)
    usageSanitaire?: string; // Usage
    diametreTuyauterie?: string; // Diamètre (pour tuyauterie)
    typeFournisseurSanitaire?: string; // Type de fournisseur

    // ✅ PRESTATION DE SERVICE - ULTRA-ENRICHI CONTEXTE AFRIQUE FRANCOPHONE
    // Images & Réalisations (Portfolio)
    imagesRealisations?: string[]; // Images de réalisations/portfolio
    videosRealisations?: string[]; // Vidéos de réalisations/portfolio
    titreService?: string; // Rempli automatiquement depuis bloc info générale
    descriptionService?: string; // Rempli automatiquement depuis bloc info générale

    // Catégorisation (40+ catégories métiers locaux)
    categoriePrestation?: string; // 🏗️ Maçonnerie, 💇 Coiffure, 🔧 Mécanique, 💻 Informatique... (40+)

    // Types de prestation (30+)
    typePrestation?: string; // Consultation, Installation, Réparation, Formation... (30+)

    // Zones d'intervention (100+ villes Afrique francophone)
    zoneIntervention?: string; // 🇨🇲 Douala, Yaoundé, quartiers, 🇨🇮 Abidjan, 🇸🇳 Dakar... (100+)
    zonesMultiples?: string[]; // ✅ NOUVEAU: Zones multiples possibles (array)
    deplacementPossible?: boolean; // ✅ RENOMMÉ: Se déplace (ancien: deplacement)
    modaliteDeplacement?: string; // ✅ NOUVEAU: Je me déplace / Client vient / Les deux / À distance
    fraisDeplacementInclus?: boolean; // ✅ NOUVEAU: Frais de déplacement inclus ou en sus
    rayonDeplacementKm?: string; // ✅ NOUVEAU: Rayon de déplacement en km

    // Expérience & Qualifications (12 niveaux + certifications)
    niveauExperience?: string; // ✅ NOUVEAU: Débutant, 1-2 ans, 5-10 ans, Expert, Maître artisan... (12)
    experienceAnnees?: number; // Années d'expérience (pour compatibilité)
    certification?: string; // ✅ NOUVEAU: CAP, BTS, Habilitation électrique, CETIC... (30+)
    certifications?: string[]; // ✅ NOUVEAU: Certifications multiples (array)
    certifie?: boolean; // Certifié/Diplômé (pour compatibilité)
    diplomeProfessionnel?: string; // ✅ NOUVEAU: Diplôme précis si applicable

    // Disponibilités & Horaires (15+)
    disponibilitePrestation?: string; // ✅ ENRICHI: Immédiate, Sous 2h, Sous 24h, Cette semaine... (15+)
    horairesService?: string; // ✅ NOUVEAU: Lundi-Vendredi 8h-18h, 24h/24, Weekend...
    urgencesAcceptees?: boolean; // ✅ NOUVEAU: Accepte les urgences
    service24h?: boolean; // ✅ NOUVEAU: Service 24h/24
    disponibleWeekend?: boolean; // ✅ NOUVEAU: Disponible le weekend
    disponibleJoursFeries?: boolean; // ✅ NOUVEAU: Disponible jours fériés
    planningFlexible?: boolean; // ✅ NOUVEAU: Planning flexible

    // Tarification (12 modes)
    modeTarification?: string; // ✅ NOUVEAU: Prix fixe, À l'heure, À la journée, Au m², Forfaitaire... (12)
    prixMinimum?: string; // ✅ NOUVEAU: Prix minimum (pour "à partir de")
    prixHoraire?: string; // ✅ NOUVEAU: Tarif horaire
    prixJournalier?: string; // ✅ NOUVEAU: Tarif journalier
    devisGratuit?: boolean; // ✅ NOUVEAU: Devis gratuit proposé
    prixNegociable?: boolean; // ✅ NOUVEAU: Prix négociable

    // Paiement (15+ modes contextualisés Afrique)
    modesPaiement?: string[]; // ✅ NOUVEAU: Espèces, Mobile Money (MTN, Orange), Virement... (15+)
    acompteRequis?: boolean; // ✅ NOUVEAU: Acompte requis
    montantAcompte?: string; // ✅ NOUVEAU: Montant acompte (% ou XAF)
    paiementEchelonne?: boolean; // ✅ NOUVEAU: Paiement échelonné possible

    // Équipements & Outils (20+)
    equipementsPrestation?: string[]; // ✅ NOUVEAU: Équipement professionnel, Outillage, Véhicule... (20+)
    fournitEquipement?: boolean; // ✅ NOUVEAU: Fournit son équipement
    clientFournitMateriel?: boolean; // ✅ NOUVEAU: Client doit fournir le matériel

    // Garanties & Assurances (10)
    garantiePrestation?: string; // ✅ NOUVEAU: Garantie 3 mois, 1 an, SAV assuré... (10)
    assuranceProfessionnelle?: string; // ✅ NOUVEAU: RC Pro, Tous risques, Décennale... (6)
    assure?: boolean; // ✅ NOUVEAU: Assuré oui/non

    // Références & Portfolio (8)
    portfolioDisponible?: boolean; // ✅ NOUVEAU: Portfolio disponible
    photosRealisations?: boolean; // ✅ NOUVEAU: Photos de réalisations
    videosRealisations2?: boolean; // ✅ NOUVEAU: Vidéos de travaux (différent de videosRealisations array)
    referencesClients?: boolean; // ✅ NOUVEAU: Références clients vérifiables
    avisClients?: string; // ✅ NOUVEAU: Avis clients / note moyenne
    travauxEntreprises?: boolean; // ✅ NOUVEAU: Travaux pour entreprises
    travauxParticuliers?: boolean; // ✅ NOUVEAU: Travaux pour particuliers
    projetsPublics?: boolean; // ✅ NOUVEAU: Projets publics réalisés

    // Durées d'intervention (15)
    dureePrestation?: string; // ✅ ENRICHI: Moins de 1h, 1-2h, 1 jour, Sur devis... (15)
    dureeEstimee?: string; // ✅ NOUVEAU: Durée estimée précise
    interventionRapide?: boolean; // ✅ NOUVEAU: Intervention rapide possible

    // Types de clients (8)
    typesClients?: string[]; // ✅ NOUVEAU: Particuliers, Entreprises, Administrations, ONG... (8)

    // Langues parlées (15+)
    languesParlees?: string[]; // ✅ NOUVEAU: Français, Anglais, Douala, Bamiléké, Ewondo... (15+)

    // Services supplémentaires
    conseilInclus?: boolean; // ✅ NOUVEAU: Conseil inclus
    formationIncluse?: boolean; // ✅ NOUVEAU: Formation du client incluse
    maintenanceIncluse?: boolean; // ✅ NOUVEAU: Maintenance incluse
    suiviApresVente?: boolean; // ✅ NOUVEAU: Suivi après-vente

    // Contact & Communication
    telephonePrestation?: string; // ✅ NOUVEAU: Téléphone de contact
    whatsappPrestation?: string; // ✅ NOUVEAU: WhatsApp de contact
    emailPrestation?: string; // ✅ NOUVEAU: Email de contact
    siteWebPrestation?: string; // ✅ NOUVEAU: Site web / portfolio en ligne
    reseauxSociaux?: string[]; // ✅ NOUVEAU: Facebook, Instagram, LinkedIn...

    // ════════════════════════════════════════════════════════════
    // ✅ CHAMPS SPÉCIFIQUES FORMATION & ÉDUCATION - ULTRA-ENRICHI
    // ════════════════════════════════════════════════════════════
    // 🎓 Contexte : Formation professionnelle, Cours particuliers, Préparation concours,
    //              Langues, Informatique, Métiers techniques, Certifications
    // 🌍 Contexte Afrique francophone : Cameroun, CI, Sénégal, Mali, RDC, etc.
    // ════════════════════════════════════════════════════════════

    // ✅ TYPE DE FORMATION
    typeFormation?: string; // Formation académique, Professionnelle, Technique, Langues, Arts...

    // ✅ NIVEAUX SCOLAIRES (cours particuliers, aide aux devoirs)
    niveauxScolaires?: string[]; // CP, CE1, 6ème, Terminale S, Licence... (multi-select)

    // ✅ MATIÈRES ENSEIGNÉES (cours particuliers, soutien scolaire)
    matieresEnseignees?: string[]; // Mathématiques, Français, Anglais, SVT... (multi-select)

    // ✅ FORMATS DE FORMATION
    formatFormation?: string; // Présentiel, En ligne, Hybride, Cours particuliers...
    formatCoursDetail?: string; // Cours particuliers (1-1), Petit groupe (3-5), Classe (15-30)...
    modaliteFormation?: string; // À domicile, En centre, En entreprise, En ligne...

    // ✅ DURÉES & RYTHMES
    dureeFormation?: string; // 1 heure, 1 semaine, 1 mois, 3 mois, 1 an...
    rythmeFormation?: string; // Intensif, Semi-intensif, Hebdomadaire, Horaires flexibles...
    horairesFormation?: string; // Matin (8h-12h), Après-midi (14h-18h), Soir (18h-21h)...

    // ✅ LANGUES D'ENSEIGNEMENT
    languesEnseignement?: string[]; // Français, Anglais, Bilingue (Fr-En), Langues nationales...

    // ✅ PRÉPARATION CONCOURS GRANDES ÉCOLES
    typeConcours?: string; // Écoles d'Ingénieurs, Médecine, Commerce, Administration...
    concoursCibles?: string[]; // Polytechnique Yaoundé, ENAM, ENS, HEC Paris... (multi-select)
    matieresPreparationConcours?: string[]; // Maths Sup, Physique, Chimie, Culture générale... (multi-select)
    niveauPreparationConcours?: string; // Préparation intensive (3-6 mois), Prépa Maths Sup...
    typeAccompagnementConcours?: string; // Stage intensif, Cours hebdomadaires, Cours particuliers...
    supportsPedagogiques?: string[]; // Annales, Fiches, Vidéos, QCM, Concours blancs... (multi-select)
    tauxReussiteConcours?: string; // Taux de réussite (%) - optionnel
    anciensCandidatsAdmis?: number; // Nombre d'élèves admis - optionnel
    preparateurAgree?: boolean; // Préparateur agréé/reconnu
    concoursBlancsProposes?: boolean; // Propose des concours blancs

    // ✅ CERTIFICATIONS & DIPLÔMES
    certificationObtenue?: string; // Attestation, Certificat, Diplôme d'État, TOEFL, IELTS...
    certificationInternationale?: boolean; // Certification internationale (TOEFL, IELTS, MOS...)

    // ✅ NIVEAUX DE COMPÉTENCE (pour formations professionnelles/langues)
    niveauCompetence?: string; // Grand débutant, Débutant, Intermédiaire, Avancé, Expert...

    // ✅ ÉQUIPEMENTS & SUPPORTS
    equipementsSupports?: string[]; // Manuels fournis, PDF, Vidéos, Ordinateurs, Plateformes e-learning... (multi-select)

    // ✅ SERVICES INCLUS
    servicesInclus?: string[]; // Évaluation initiale, Suivi personnalisé, Correction devoirs, Coaching... (multi-select)

    // ✅ MÉTHODES PÉDAGOGIQUES
    methodesPedagogiques?: string[]; // Cours magistraux, Travaux pratiques, Projets réels, Tutorat... (multi-select)

    // ✅ PROFIL FORMATEUR
    profilFormateur?: string; // Enseignant diplômé, Professeur certifié, Expert métier, Ingénieur...
    experienceFormateur?: string; // Moins de 2 ans, 2-5 ans, 5-10 ans, 10-20 ans, +20 ans

    // ✅ PUBLIC CIBLE
    publicCible?: string[]; // Enfants (Maternelle-Primaire), Collégiens, Lycéens, Étudiants, Professionnels... (multi-select)

    // ✅ TARIFICATIONS
    modePaiement?: string; // Paiement unique, Mensuel, Par session, À l'heure, Échelonné...
    moyensPaiementAcceptes?: string[]; // Espèces, Mobile Money, Virement, Carte bancaire... (multi-select)
    reductions?: string[]; // Réduction groupe, Réduction longue durée, Premier cours gratuit... (multi-select)

    // Informations complémentaires
    nombreInterventions?: number; // ✅ NOUVEAU: Nombre d'interventions réalisées
    tauxSatisfaction?: number; // ✅ NOUVEAU: Taux de satisfaction (%)
    membresEquipe?: number; // ✅ NOUVEAU: Nombre de personnes dans l'équipe
    entrepriseEnregistree?: boolean; // ✅ NOUVEAU: Entreprise officiellement enregistrée
    numeroRegistreCommerce?: string; // ✅ NOUVEAU: N° de registre de commerce
    numeroPatente?: string; // ✅ NOUVEAU: N° de patente

    // Déplacement (anciens champs compatibilité)
    deplacement?: boolean; // Se déplace (pour compatibilité CSV - obsolète)

    // Liste des offres de service (array)
    prestations?: Array<{
        nom: string;
        prixAPartirDe: string;
        description?: string;
        duree?: string; // ✅ NOUVEAU: Durée de cette offre spécifique
        inclus?: string[]; // ✅ NOUVEAU: Ce qui est inclus dans cette offre
    }>; // Liste des offres de prestations possibles pour ce prestataire

    // Promotion (pour tous les types de produits)
    promotionActive?: boolean;
    promotionType?: 'reduction' | 'offre' | 'bon_plan' | 'flash';
    promotionValeur?: string; // ex: "20%", "-5000 FCFA", "1+1 gratuit"
    promotionDescription?: string;
    promotionDateFin?: string;
    promotionConditions?: string;

    // Pharmacie - ✅ ENRICHI
    nomPharmacie?: string; // ✅ NOUVEAU: Nom de la pharmacie (liste)
    typePharmacie?: string; // Pharmacie normale, de garde (nuit), de garde (weekend), 24h/24...
    servicesPharmacie?: string[]; // ✅ NOUVEAU: Array des services disponibles
    joursOuverturePharmacie?: string[]; // ✅ NOUVEAU: Array des jours d'ouverture
    heuresOuverture?: string;
    heuresFermeture?: string;
    joursGarde?: string; // Jours de garde (pour compatibilité)
    telephoneUrgence?: string;
    services?: string; // Services disponibles (pour compatibilité - obsolète)

    // Hôpital/Clinique - ✅ REFONTE COMPLÈTE
    nomEtablissement?: string; // ✅ NOUVEAU: Nom de l'établissement (liste)
    typeEtablissement?: string; // Hôpital, Clinique, Centre de santé (liste)
    prestationsGenerales?: string[]; // ✅ NOUVEAU: Urgences, Hospitalisation, Chirurgie...
    consultationsSpecialisees?: string[]; // ✅ NOUVEAU: Gynécologie, Cardiologie, ORL... (30+)
    joursOuverture?: string[]; // ✅ NOUVEAU: Array des jours (Lundi, Mardi...)
    heuresOuverture?: string; // Heure d'ouverture (format HH:MM)
    heuresFermeture?: string; // Heure de fermeture (format HH:MM)
    servicesAnnexes?: string[]; // ✅ NOUVEAU: Laboratoire, Pharmacie, Ambulance...
    equipementsHopital?: string[]; // ✅ NOUVEAU: Scanner, IRM, Échographie...
    urgencesDisponible?: boolean; // Urgences 24h/24
    // Champs obsolètes (conservés pour compatibilité)
    specialites?: string[]; // Obsolète: remplacé par consultationsSpecialisees
    medecinsDisponibles?: string;
    horairesConsultation?: string;
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

    // Déménagement - ✅ REFONTE COMPLÈTE CONTEXTE AFRIQUE
    typeDemenagement?: string; // Déménagement local, national, international, bureau, etc.
    volumeDemenagement?: string; // Studio (10-15m³), F2 (20-30m³), etc.
    typeVehiculeDemenagement?: string; // Camionnette 10m³, Camion 30m³, etc.
    distanceDemenagement?: string; // Moins de 10 km, 10-50 km, etc.
    nbDemenageurs?: string; // Nombre de déménageurs
    servicesDemenagement?: string[]; // Emballage, Transport, Déballage, etc.
    // ✅ NOUVEAUX CHAMPS
    trajetDemenagement?: string; // Trajet populaire (Douala → Yaoundé, etc.)
    villeDepartDemenagement?: string; // Ville de départ
    villeArriveeDemenagement?: string; // Ville d'arrivée
    quartierDepartDemenagement?: string; // Quartier de départ
    quartierArriveeDemenagement?: string; // Quartier d'arrivée
    compagnieDemenagement?: string; // Compagnie de déménagement
    dureeDemenagement?: string; // Durée estimée
    typeAssuranceDemenagement?: string; // Type d'assurance
    accessibiliteDemenagement?: string; // Accessibilité/Étages
    disponibiliteDemenagement?: string; // Disponibilité
    // Champs obsolètes (conservés pour compatibilité)
    assuranceDemenagement?: boolean; // Obsolète: remplacé par typeAssuranceDemenagement
    montageInclus?: boolean; // Inclus dans servicesDemenagement
    cartonsInclus?: boolean; // Inclus dans servicesDemenagement
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

    // ════════════════════════════════════════════════════════════
    // 🧹 NETTOYAGE & ENTRETIEN - ULTRA-ENRICHI AFRIQUE FRANCOPHONE
    // ════════════════════════════════════════════════════════════
    // Synchronisé avec categoryConfig.ts (16 filtres complets)
    // ════════════════════════════════════════════════════════════
    typeServiceNettoyage?: string; // Femme de ménage, Nounou, Blanchisseur, Gardien, Jardinier, Cuisinière, Chauffeur, etc.
    frequenceService?: string; // Ponctuel, Quotidien, Lun-Ven, Hebdomadaire, etc.
    modaliteEmploi?: string; // Live-out, Live-in (logée), Logée+nourrie, Autonome
    horairesService?: string; // Temps plein 8h-17h, Temps partiel, Matin, Après-midi, Nuit, 24h/24
    nombreEnfants?: string; // 1 enfant, 2 enfants, 3 enfants, 4+ enfants (pour nounou)
    ageEnfants?: string; // Nouveau-né, Bébé, Tout-petit, Enfant, Pré-ado, Adolescent (pour nounou)
    tachesSpecifiques?: string[]; // Nettoyage sols, Dépoussiérage, Cuisine, Repassage, Garde d'enfants, Jardin, etc.
    experienceNettoyage?: string; // Débutant(e), 6 mois-1 an, 1-2 ans, 3-5 ans, 5-10 ans, 10-15 ans, 15+ ans
    languesParlees?: string[]; // Français, Anglais, Bilingue, Bamiléké, Ewondo, Fulfuldé, Lingala, Wolof, Dioula, Pidgin
    certificationNettoyage?: string[]; // Références vérifiées, Formation, Premiers secours, Casier judiciaire vierge, etc.
    equipementsFournis?: string[]; // Produits d'entretien, Aspirateur, Balai, Matériel pro, Outils jardinage
    surfaceEntretien?: string; // < 50m², 50-100m², 100-200m², Villa 300-500m², Bureau, Immeuble
    zoneInterventionNettoyage?: string; // Douala Akwa, Yaoundé Bastos, Abidjan Cocody, Dakar Almadies, etc. (100+ quartiers)
    disponibiliteImmediateNettoyage?: string; // Immédiate, Cette semaine, Dans 2 semaines, Dans 1 mois, Préavis
    salaireSouhaite?: string; // Salaire mensuel en FCFA (30000-500000)
    typeContratNettoyage?: string; // CDI, CDD, Temporaire, Remplacement, Freelance, Période d'essai

    // ✅ Champs legacy (compatibilité ancienne version)
    typeNettoyage?: string; // DÉPRÉCIÉ - Utiliser typeServiceNettoyage
    frequenceNettoyage?: string; // DÉPRÉCIÉ - Utiliser frequenceService
    servicesNettoyage?: string[]; // DÉPRÉCIÉ - Utiliser tachesSpecifiques
    surfaceNettoyage?: string; // DÉPRÉCIÉ - Utiliser surfaceEntretien
    produitsNettoyage?: string; // DÉPRÉCIÉ
    produitsBio?: boolean; // DÉPRÉCIÉ
    materielInclus?: boolean; // DÉPRÉCIÉ - Utiliser equipementsFournis
    assuranceResponsabiliteCivile?: boolean; // DÉPRÉCIÉ

    // ✅ Nouveaux champs nettoyage_entretien (version refonte 2025)
    modeTarificationNettoyage?: string; // À l'heure, Au forfait, Au m²
    typeClienteleNettoyage?: string; // Particuliers, Entreprises, Collectivités
    villeNettoyage?: string; // Ville principale d'intervention
    quartiersNettoyage?: string[]; // Quartiers/Zones desservis
    disponibiliteNettoyage?: string; // 7j/7, En semaine, Week-end, Sur rendez-vous
    dureeNettoyage?: string; // Durée estimée en heures
    produitsEcologiques?: boolean; // Utilise des produits écologiques
    materielFourni?: boolean; // Matériel fourni par le prestataire
    urgenceAcceptee?: boolean; // Accepte les urgences
    equipementsNettoyage?: string[]; // Équipements fournis

    // Sécurité & Surveillance - ✅ COMPLET
    typeSecurite?: string; // Type de service (Gardiennage, Vidéosurveillance, Patrouille, etc.)
    zoneSecurite?: string; // Zone à couvrir (Résidentiel, Commercial, Entreprise, etc.)
    dureeSecurite?: string; // Durée du contrat (mois, heures, etc.)
    equipementsSecurite?: string[]; // Équipements fournis (Caméras, Badge, Radio, etc.)
    tarifSecurite?: number | string; // Tarif du service de sécurité
    villeInterventionSecurite?: string; // Ville d'intervention
    quartierInterventionSecurite?: string; // Quartier/Zone spécifique d'intervention

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

    // Décoration - ✅ COMPLET CONTEXTE AFRIQUE
    nomArticleDecoration?: string; // ✅ Nom de l'article (liste complète)
    categorieDecoration?: string; // ✅ Catégorie (Tableaux, Luminaires, Vases, etc.)
    styleDecoration?: string; // Moderne, Ethnique africain, Afro-chic, Vintage, etc.
    pieceDecoration?: string; // Salon, Chambre, Véranda, Jardin/Cour, etc.
    matiereDecoration?: string; // ✅ Matière (Bois, Raphia, Pagne/Wax, Terre cuite, etc.)
    couleurDecoration?: string; // Blanc, Terracotta, Motifs africains, etc.
    tailleDecoration?: string; // ✅ Taille (Petit, Moyen, Grand, XL, Set/Lot)
    etatDecoration?: string; // ✅ État (Neuf, Artisanal fait main, Vintage authentique, Import Afrique)
    marqueDecoration?: string; // ✅ Marque/Origine (Ikea, Artisan local camerounais, Fait main, etc.)
    dimensionsDecoration?: string; // Dimensions exactes (texte libre)
    // Champs legacy (compatibilité)
    typeDecoration?: string; // Obsolète: remplacé par categorieDecoration
    materiauDecoration?: string; // Obsolète: remplacé par matiereDecoration

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
    genreCosmetique?: string; // Genre (Femme, Homme, Mixte/Unisexe)
    volumeCosmetique?: string;
    uniteCosmetique?: string;
    concentrationCosmetique?: string; // Concentration (pour parfums: EDP, EDT, EDC, etc.)
    typePeau?: string;
    typeCheveuxCosmetique?: string; // Type de cheveux (Crépus, Bouclés, Lisses, etc.)
    teinteCosmetique?: string; // Teinte (pour maquillage: Rouge, Nude, Caramel, etc.)
    finitionCosmetique?: string; // Finition (pour maquillage: Mat, Brillant, Satiné, etc.)
    ageRecommandé?: string;
    ingredientsCosmetique?: string;
    certificationsCosmetique?: string[]; // Certifications et labels (Bio, Cruelty-free, Vegan, Halal, etc.)
    origineCosmetique?: string;
    // Champs bijoux - ✅ ENRICHI
    typeBijou?: string; // Type de bijou (Bague, Collier, Montre, etc.)
    matiereBijou?: string; // Matière principale (Or, Argent, Platine, etc.)
    poidsBijou?: string; // Poids exact en grammes
    poidsApproxBijou?: string; // Fourchette de poids (5-10g, 10-20g, etc.)
    unitePoids?: string; // Unité de poids (deprecated, remplacé par poidsApproxBijou)
    tailleBijou?: string; // Taille/Dimensions selon le type
    longueurBijou?: string; // Longueur (colliers, bracelets)
    diametreMontre?: string; // Diamètre boîtier pour montres
    caratsBijou?: string; // Carats pour l'or (9k, 14k, 18k, etc.)
    pureteArgent?: string; // Pureté de l'argent (925, 950, etc.)
    styleBijou?: string; // Style (Moderne, Vintage, Ethnique, etc.)
    pourQuiBijou?: string; // Destinataire (Femme, Homme, Enfant, etc.)
    occasionBijou?: string; // Occasion (Mariage, Quotidien, etc.)
    marqueBijou?: string; // Marque (Rolex, Cartier, Pandora, etc.)
    etatBijou?: string; // État (Neuf, Excellent, etc.)
    certificationBijou?: string; // Type de certification
    garantieBijou?: string; // Durée garantie
    origineBijou?: string; // Pays d'origine/fabrication
    certificatBijou?: string; // Oui/Non (deprecated, remplacé par certificationBijou)
    bijouxVariants?: ProductVariant[]; // ✅ Variantes avec images multiples

    // Musique & Instruments - ✅ ENRICHI AFRIQUE
    categorieInstrument?: string; // Instrument, Accessoire, Sonorisation, DJ, Studio, Traditionnel africain
    typeInstrument?: string; // Guitare, Piano, Batterie, Djembé, Kora, etc.
    marqueInstrument?: string; // Yamaha, Fender, Gibson, Roland, Artisan local, etc.
    modeleInstrument?: string; // Modèle spécifique
    etatInstrument?: string; // Neuf, Excellent, Bon, À réviser, Vintage
    niveauInstrument?: string; // Débutant, Intermédiaire, Avancé, Professionnel
    anneeInstrument?: string; // Année de fabrication
    materiauInstrument?: string; // Bois, Métal, Calebasse, Peau de chèvre, etc.
    couleurInstrument?: string; // Couleur de l'instrument
    tailleInstrument?: string; // 4/4, 3/4, 1/2, Dreadnought, etc.
    nombreCordes?: string; // Pour guitares, basses, violons, kora
    typeAmplification?: string; // Acoustique, Électrique, Électro-acoustique
    puissanceAmpli?: string; // Puissance en Watts pour amplis/sono
    utilisationInstrument?: string; // Apprentissage, Concert, Studio, Église, etc.
    genreMusical?: string; // Jazz, Rock, Afrobeat, Makossa, Classique, etc.
    alimentationInstrument?: string; // Secteur 220V, Batterie, Piles, USB
    connectiquesInstrument?: string[]; // Jack, XLR, MIDI, Bluetooth, etc.
    accessoiresInclus?: string[]; // Étui, Archet, Câbles, Pédalier, etc.
    garantieInstrument?: string; // Garantie restante
    facture?: boolean; // Facture d'achat disponible
    revisionRecente?: boolean; // Révision/entretien récent
    origineInstrument?: string; // Pays de fabrication (France, Japon, Sénégal, Mali, etc.)
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
    villeFormation?: string; // ✅ Ville de la formation
    quartierFormation?: string; // ✅ Quartier / Zone de la formation
    adresseFormation?: string; // ✅ Adresse précise du centre de formation

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

    // ✅ COUTURIER - AFRIQUE FRANCOPHONE
    typeCouture?: string; // Type de service (Robe sur mesure, Boubou, Retouche, etc.)
    tissuCouture?: string; // Tissu utilisé (Bazin, Wax, Coton, Soie, etc.)
    styleCouture?: string; // Style (Traditionnel africain, Afro-fusion, Moderne, etc.)
    categorieCouture?: string; // Catégorie vêtement (Robe, Costume, Boubou, etc.)
    genreCouture?: string; // Genre (Femme, Homme, Enfant, Couple assorti, etc.)
    occasionCouture?: string; // Occasion (Mariage, Soirée, Quotidien, Église, etc.)
    delaiCouture?: string; // Délai de confection (Express 24-48h, Standard 1-2 semaines, etc.)
    specialiteCouturier?: string; // Spécialité (Robes de mariée, Bazin, Wax/pagne, etc.)
    experienceCouturier?: string; // Expérience (Débutant, Confirmé, Maître couturier, etc.)
    finitionCouture?: string; // Niveau de finition (Haute couture, Soignée, Standard, etc.)
    lieuTravailCouturier?: string; // Lieu de travail (Atelier professionnel, Domicile, À domicile client, etc.)
    tailleCouture?: string; // Taille (S, M, L, Sur mesure, etc.)
    couleurCouture?: string; // Couleur principale
    serviceCoutureInclus?: string[]; // Services inclus (Prise de mesures, Essayage, Retouches, etc.)
    tarificationCouture?: string; // Mode de tarification (À la pièce, Forfait, Au mètre, Sur devis, etc.)
    equipementsCouturier?: string[]; // Équipements disponibles (Machine à broder, Surjeteuse, etc.)

    // ✅ MÉCANICIEN / GARAGE AUTOMOBILE - AFRIQUE FRANCOPHONE
    nomGarage?: string; // Nom du garage/atelier
    typeServiceMecanique?: string[]; // Services proposés (Vidange, Frein, Diagnostic, etc.)
    specialitesGarage?: string[]; // Spécialités (Toutes marques, Japonaises, 4x4, etc.)
    marquesVehicules?: string[]; // Marques traitées (Toyota, Nissan, Peugeot, etc.)
    typesVehiculesMeca?: string[]; // Types véhicules (Voitures, SUV, Camions, Motos, etc.)
    certificationsMeca?: string[]; // Certifications (CAP, BTS, Formation constructeur, etc.)
    equipementsGarage?: string[]; // Équipements (Pont élévateur, Valise diagnostic, etc.)
    servicesComplementaires?: string[]; // Services en plus (Vente pièces, Lavage, etc.)
    horairesGarage?: string; // Horaires d'ouverture
    delaisIntervention?: string; // Délais (Immédiat, Même jour, Sous 24h, etc.)
    urgenceMeca?: string; // Dépannage d'urgence (24h/24, Jour uniquement, etc.)
    zonesInterventionMeca?: string[]; // ✅ CORRIGÉ: Zone géographique MULTIPLE (système intelligent)
    languesMeca?: string[]; // Langues parlées
    modesPaiement?: string[]; // Modes de paiement acceptés
    tarifHoraireMeca?: string; // Tarif horaire (optionnel)
    devisGratuit?: boolean; // Devis gratuit
    garantieReparations?: boolean; // Garantie sur réparations
    vehiculeCourtoisie?: boolean; // Véhicule de courtoisie
    enlevementVehicule?: boolean; // Enlèvement véhicule en panne

    // ✅ CHAMPS SPÉCIALISÉS MÉCANICIEN MOTO/TRICYCLE
    nomGarageMoto?: string; // Nom du garage spécialisé motos
    typeServiceMoto?: string[]; // Types de services motos
    specialitesMoto?: string[]; // Spécialités du garage moto
    marquesMotos?: string[]; // Marques de motos traitées
    typesMotos?: string[]; // Types de motos/tricycles traités
    cylindreesMotos?: string[]; // Cylindrées spécialisées
    certificationsMoto?: string[]; // Certifications spécialisées motos
    equipementsMoto?: string[]; // Équipements spécialisés garage moto
    piecesDetacheesMoto?: string[]; // Pièces détachées spécialisées
    servicesComplementairesMoto?: string[]; // Services complémentaires spécialisés
    horairesMoto?: string; // Horaires spécialisés
    delaisMoto?: string; // Délais d'intervention spécialisés
    urgenceMoto?: string; // Prestations d'urgence spécialisées
    zonesInterventionMoto?: string[]; // ✅ CORRIGÉ: Zone géographique spécialisée MULTIPLE (système intelligent)
    languesMoto?: string[]; // Langues parlées spécialisées
    modesPaiementMoto?: string[]; // Modes de paiement spécialisés
    tarifHoraireMoto?: string; // Tarif horaire spécialisé (optionnel)
    devisGratuitMoto?: boolean; // Devis gratuit spécialisé
    garantieReparationsMoto?: boolean; // Garantie sur réparations spécialisées
    motoCourtoisie?: boolean; // Moto de courtoisie
    enlevementMoto?: boolean; // Enlèvement moto en panne

    // ✅ CARRELEUR (SERVICE - POSE DE CARRELAGE)
    typeCarreleur?: string; // Type de prestation (Pose, Rénovation, etc.)
    servicesCarreleur?: string[]; // Services proposés (Sol intérieur, Mural salle de bain, etc.)
    surfacesCarreleur?: string[]; // Surfaces d'application (Sol, Mur, Terrasse, etc.)
    typesCarrelageCarreleur?: string[]; // Types de carrelage posés (Céramique, Grès, Marbre, etc.)
    formatsCarreleur?: string[]; // Formats/Dimensions (Petit, Standard, Grand, etc.)
    techniquesCarreleur?: string[]; // Techniques de pose (Droite, Diagonale, Chevron, etc.)
    finitionsCarreleur?: string[]; // Finitions (Joint blanc, Joint époxy, etc.)
    equipementsCarreleur?: string[]; // Équipements et outils
    experienceCarreleur?: string; // Expérience (Années)
    disponibilitesCarreleur?: string; // Disponibilité
    garantiesCarreleur?: string; // Garanties
    certificationsCarreleur?: string[]; // Certifications
    servicesAdditionnelsCarreleur?: string[]; // Services additionnels
    tarificationCarreleur?: string; // Mode de tarification
    zonesInterventionCarreleur?: string[]; // ✅ Zones d'intervention MULTIPLES (système intelligent)

    // ✅ AGRICULTURE & ÉLEVAGE
    typeAgricole?: string; // Type de produit (Légumes, Fruits, Céréales, Viande, etc.)
    culture?: string; // Culture spécifique (Maïs, Manioc, Tomate, etc.)
    saisonAgricole?: string; // Saison de production (Toute l'année, Saison des pluies, etc.)
    uniteVente?: string; // Unité de vente (Kg, Tonne, Sac, Panier, etc.)
    quantiteDisponible?: string; // Quantité disponible
    certificationsAgricole?: string[]; // Certifications (Bio, Sans pesticides, Agriculture locale, etc.)
    localisationAgricole?: string; // Ville/Zone de production
}

interface ProductManagerMobileProps {
    products: Product[];
    onProductsChange: (products: Product[]) => void;
    readonly?: boolean;
    titreService?: string; // Titre depuis bloc info générale
    descriptionService?: string; // Description depuis bloc info générale
    categoryService?: string; // ✅ NOUVEAU: Catégorie du service pour détection auto du type produit
    onDuplicate?: (product: Product) => void; // ✅ AJOUT: Callback pour la duplication
    focusProductId?: string; // ✅ NOUVEAU: ID du produit à ouvrir/sélectionner automatiquement
    duplicateProduct?: Product; // ✅ NOUVEAU: Produit à dupliquer automatiquement
    serviceId?: number; // ✅ NOUVEAU: ID du service pour navigation vers formulaire d'édition
    serviceData?: any; // ✅ NOUVEAU: Données du service pour préremplir le formulaire
}

// Configuration des types de produits avec noms adaptés
export const PRODUCT_TYPES = [
    { value: 'agroalimentaire', label: 'Alimentation & Produits Alimentaires', icon: '🍽️', color: '#10B981', description: 'Alimentation complète : produits frais (fruits, légumes, viandes, poissons) et produits secs/transformés (riz, pâtes, conserves, boissons)', keywords: ['riz', 'pâtes', 'macaroni', 'spaghetti', 'farine', 'huile', 'arachide', 'palme', 'tournesol', 'olive', 'sucre', 'sel', 'épices', 'poivre', 'curry', 'curcuma', 'gingembre', 'piment', 'sauce', 'ketchup', 'mayonnaise', 'moutarde', 'maggi', 'jumbo', 'bouillon', 'cube', 'conserve', 'sardine', 'thon', 'maquereau', 'haricot', 'pois', 'maïs', 'boisson', 'eau', 'jus', 'soda', 'cola', 'sprite', 'fanta', 'café', 'nescafé', 'thé', 'lipton', 'lait', 'nido', 'peak', 'chocolat', 'cacao', 'biscuit', 'chips', 'snack', 'bonbon', 'confiserie', 'céréale', 'avoine', 'blé', 'mil', 'sorgho', 'manioc', 'couscous', 'semoule', 'légume', 'sec', 'lentille', 'fève', 'pois chiche', 'condiment', 'vinaigre', 'miel', 'confiture', 'beurre', 'cacahuète', 'noix', 'cajou', 'amande', 'produit', 'alimentaire', 'agro', 'transformation', 'conserverie', 'biscuiterie', 'huilerie', 'meunerie', 'rizerie', 'sucrerie', 'chocolaterie', 'confiserie', 'fruit', 'légume', 'viande', 'poisson', 'bœuf', 'poulet', 'porc', 'mouton', 'chèvre', 'tomate', 'oignon', 'pomme', 'banane', 'orange', 'mangue', 'avocat', 'ananas', 'carotte', 'chou', 'salade', 'frais', 'marché', 'alimentaire', 'épicerie', 'supermarché', 'nourriture', 'aliment', 'consommation', 'nutrition'] },
    { value: 'assurance', label: 'Assurance et Protection', icon: '🛡️', color: '#14B8A6', description: 'Assurance auto, santé, habitation, vie, protection sociale', keywords: ['assurance', 'protection', 'garantie', 'prime', 'contrat', 'couverture', 'police', 'assureur', 'sinistre', 'indemnisation', 'franchise', 'souscription', 'mutuelle', 'prévoyance', 'responsabilité civile', 'tous risques', 'assurance vie', 'assurance auto', 'assurance habitation', 'assurance santé', 'assurance maladie', 'hospitalisation', 'accident', 'décès', 'invalidité', 'capital', 'rente', 'bénéficiaire', 'AXA', 'ACTIVA', 'ALLIANZ', 'SUNU', 'NSIA', 'mensuel', 'annuel', 'renouvellement', 'résiliation', 'clause', 'exclusion', 'risque', 'dommage', 'cotisation', 'assurance voyage', 'rapatriement'] },
    { value: 'automobile', label: 'Automobiles et Véhicules', icon: '🚗', color: '#EF4444', description: 'Voitures, motos, camions, véhicules utilitaires', keywords: ['voiture', 'auto', 'véhicule', 'automobile', 'moto', 'scooter', 'camion', '4x4', 'SUV', 'berline', 'coupé', 'cabriolet', 'Toyota', 'Honda', 'Mercedes', 'Peugeot', 'Renault', 'Nissan', 'occasion', 'neuf', 'kilométrage', 'essence', 'diesel', 'hybride', 'électrique', 'automatique', 'manuelle', 'pickup', 'break', 'monospace', 'citadine', 'BMW', 'Audi', 'Volkswagen', 'Ford', 'Hyundai', 'Kia', 'Mazda', 'Mitsubishi', 'Lexus', 'Land Rover', 'Jeep', 'climatisation', 'GPS', 'cuir', 'jante', 'airbag', 'ABS', 'première main', 'papiers en règle', 'contrôle technique', 'carnet d\'entretien', 'révision', 'km', 'transmission', 'carburant', 'cylindrée', 'puissance'] },
    { value: 'chaussure', label: 'Chaussures et Accessoires', icon: '👟', color: '#6366F1', description: 'Chaussures, baskets, sandales, bottes', keywords: ['chaussure', 'soulier', 'basket', 'sneaker', 'sandale', 'tong', 'botte', 'bottine', 'escarpin', 'talon', 'mocassin', 'ballerine', 'pointure', 'semelle', 'cuir', 'sport', 'ville', 'Nike', 'Adidas', 'Puma', 'Reebok', 'New Balance', 'Converse', 'Vans', 'Jordan', 'Air Max', 'running', 'football', 'tennis', 'toile', 'daim', 'synthétique', 'homme', 'femme', 'enfant', 'neuf', 'occasion', 'pointure 38', 'pointure 39', 'pointure 40', 'pointure 41', 'pointure 42', 'pointure 43', 'pointure 44', 'chaussures de mariage', 'chaussures de soirée', 'casual', 'élégant', 'confortable', 'lacet', 'scratch'] },
    { value: 'covoiturage', label: 'Covoiturage et Trajets', icon: '🚙', color: '#F59E0B', description: 'Trajets partagés, carpooling, transport collectif', keywords: ['covoiturage', 'trajet', 'partage', 'carpooling', 'transport partagé', 'passager', 'conducteur', 'départ', 'arrivée', 'itinéraire', 'route', 'place disponible', 'voyage partagé', 'économique', 'écologique', 'voiture', 'auto', 'véhicule', 'trajets quotidiens', 'navette', 'domicile-travail', 'ville à ville', 'interurbain', 'économie carburant', 'convivial', 'rencontre', 'frais partagés', 'co-voiturage', 'BlaBlaCar', 'partage frais', 'trajet régulier', 'ponctuel', 'aller-retour'] },
    { value: 'decoration', label: 'Décoration Intérieure', icon: '🖼️', color: '#E91E63', description: 'Tableaux, luminaires, tapis, accessoires déco', keywords: ['décoration', 'déco', 'tableau', 'toile', 'peinture', 'affiche', 'cadre', 'luminaire', 'lampe', 'lustre', 'applique', 'tapis', 'carpette', 'coussin', 'rideau', 'vase', 'sculpture', 'miroir', 'horloge', 'bougie', 'moderne', 'classique', 'vintage', 'contemporain'] },
    { value: 'electricite', label: 'Électricité et Éclairage', icon: '⚡', color: '#FFC107', description: 'Câbles, prises, interrupteurs, lampes, disjoncteurs', keywords: ['électricité', 'électrique', 'câble', 'fil', 'interrupteur', 'prise', 'disjoncteur', 'tableau électrique', 'lampe', 'ampoule', 'LED', 'néon', 'spot', 'variateur', 'minuterie', 'détecteur', 'multiprise', 'rallonge', '220V', 'installation électrique'] },
    { value: 'electromenager', label: 'Électroménager Domestique', icon: '🔌', color: '#14B8A6', description: 'Frigos, fours, machines à laver, micro-ondes', keywords: ['électroménager', 'frigo', 'réfrigérateur', 'congélateur', 'four', 'cuisinière', 'micro-ondes', 'lave-linge', 'machine à laver', 'lave-vaisselle', 'aspirateur', 'climatiseur', 'ventilateur', 'Samsung', 'LG', 'Bosch', 'Whirlpool', 'appareil', 'domestique', 'ménager', 'cuisine', 'gros électroménager', 'petit électroménager', 'neuf', 'occasion', 'garantie', 'économie énergie', 'A++', 'inverter', 'no frost', 'inox', 'mixeur', 'blender', 'robot', 'cafetière', 'bouilloire', 'grille-pain', 'fer à repasser', 'sèche-linge', 'Hisense', 'Midea', 'Haier'] },
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
    { value: 'couturier', label: 'Couturier / Tailleur', icon: '✂️', color: '#EC4899', description: 'Couture sur mesure, retouches, confection vêtements traditionnels et modernes', keywords: ['couturier', 'tailleur', 'couture', 'sur mesure', 'retouche', 'confection', 'vêtement', 'robe', 'costume', 'boubou', 'bazin', 'wax', 'pagne', 'traditionnel', 'moderne', 'mariage', 'soirée', 'essayage', 'patron', 'coupe', 'couture', 'broderie', 'surjeteuse', 'machine à coudre', 'atelier', 'mesures', 'tissu', 'finition', 'haute couture', 'prêt-à-porter', 'créateur', 'styliste', 'modéliste', 'assemblage', 'ourlet', 'zip', 'bouton', 'doublure', 'parement'] },
    { value: 'pieces_auto', label: 'Pièces Détachées Auto', icon: '🔧', color: '#607D8B', description: 'Pièces moteur, freins, carrosserie, filtres, batteries', keywords: ['pièce auto', 'pièce détachée', 'pièce automobile', 'moteur', 'frein', 'disque', 'plaquette', 'carrosserie', 'pare-choc', 'aile', 'capot', 'phare', 'feu', 'filtre', 'huile', 'batterie', 'alternateur', 'bougie', 'courroie', 'embrayage', 'suspension', 'amortisseur', 'vidange', 'garage'] },
    { value: 'pieces_industrielles', label: 'Pièces Industrielles', icon: '⚙️', color: '#455A64', description: 'Roulements, courroies, moteurs, pompes, pièces machines', keywords: ['pièce industrielle', 'pièce machine', 'roulement', 'palier', 'courroie', 'chaîne', 'poulie', 'pignon', 'engrenage', 'moteur électrique', 'hydraulique', 'pneumatique', 'pompe', 'compresseur', 'vanne', 'vérin', 'tuyau', 'joint', 'acier', 'inox', 'industriel', 'usine', 'maintenance'] },
    { value: 'prestation_service', label: 'Prestation de Service', icon: '🎯', color: '#8B5CF6', description: 'Services professionnels divers : coaching, consulting, développement, services non classés ailleurs', keywords: ['prestation', 'service', 'serrurier', 'vitrier', 'couvreur', 'tapissier', 'soudeur', 'photographe', 'vidéaste', 'graphiste', 'designer', 'développeur', 'programmeur', 'webmaster', 'informaticien', 'coach', 'formateur', 'tuteur', 'traducteur', 'interprète', 'rédacteur', 'secrétaire', 'assistant', 'comptable', 'consultant', 'conseiller', 'expert', 'avocat', 'juriste', 'notaire', 'huissier', 'dresseur', 'toiletteur', 'DJ', 'musicien', 'animateur', 'artiste', 'comédien', 'danseur', 'maquilleur', 'styliste', 'cordonnier', 'sellier', 'horloger', 'opticien', 'guide', 'moniteur', 'analyste', 'data scientist', 'économiste', 'chercheur', 'scientifique', 'agent immobilier', 'promoteur', 'gestionnaire', 'administrateur', 'manager', 'chef de projet', 'coordinateur', 'superviseur', 'expert-comptable', 'fiscaliste', 'banquier', 'conseiller financier', 'vendeur', 'commercial', 'représentant', 'logisticien', 'magasinier', 'wedding planner', 'organisateur', 'traiteur événementiel', 'décorateur', 'fleuriste', 'imprimeur', 'relieur', 'graveur'] },
    { value: 'ingenieur_archi', label: 'Ingénieur / Architecte', icon: '📐', color: '#0891B2', description: 'Bureau d\'études, plans, conception, suivi chantier, permis de construire', keywords: ['architecte', 'ingénieur', 'ingénieur bâtiment', 'ingénieur génie civil', 'bureau d\'études', 'bureau étude', 'BET', 'plan architecte', 'plan maison', 'plan architecture', 'conception architecturale', 'étude architecturale', 'permis de construire', 'dossier permis', 'déclaration préalable', 'étude technique', 'étude de sol', 'étude géotechnique', 'calcul structure', 'calcul béton', 'note de calcul', 'dimensionnement', 'maîtrise d\'œuvre', 'maître d\'œuvre', 'MOE', 'suivi de chantier', 'supervision travaux', 'coordination chantier', 'réception chantier', 'métrés', 'quantitatifs', 'avant-projet', 'APD', 'APS', 'plans d\'exécution', 'plans techniques', 'géomètre', 'topographe', 'levé topographique', 'bornage', 'implantation', 'urbanisme', 'étude urbanisme', 'PLU', 'rénovation énergétique', 'audit énergétique', 'thermique', 'RT2012', 'conception 3D', 'modélisation 3D', 'maquette 3D', 'dessinateur', 'projeteur', 'architecte d\'intérieur', 'aménagement intérieur', 'décoration architecturale'] },
    { value: 'macon', label: 'Maçon', icon: '🧱', color: '#78716C', description: 'Maçonnerie, béton, construction, fondations, murs, dalles', keywords: ['maçon', 'maçonnerie', 'service maçonnerie', 'construction', 'bâtiment', 'fondation', 'dalle', 'mur', 'béton', 'ciment', 'parpaing', 'brique', 'agglo', 'coffrage', 'ferraillage', 'coulage béton', 'gros œuvre', 'soubassement', 'chaînage', 'linteau', 'poteau', 'poutre', 'plancher', 'chape', 'enduit', 'crépi', 'mortier', 'jointoiement', 'maçon urgence', 'dépanneur maçonnerie', 'réparation fissure', 'reprise sous-œuvre', 'rénovation mur', 'extension maison', 'surélévation', 'agrandissement', 'maçon qualifié', 'entreprise maçonnerie', 'travaux maçonnerie', 'devis maçonnerie', 'maçonnerie générale', 'maçonnerie traditionnelle', 'maçonnerie moderne'] },
    { value: 'plombier', label: 'Plombier', icon: '🔧', color: '#00BCD4', description: 'Services de plomberie : installation, réparation, dépannage urgence', keywords: ['plombier', 'plomberie', 'service plomberie', 'dépannage plomberie', 'urgence plomberie', 'installation plomberie', 'réparation plomberie', 'fuite eau', 'fuite', 'débouchage', 'déboucher', 'canalisation', 'tuyau', 'robinet', 'chauffe-eau', 'ballon eau chaude', 'chaudière', 'WC bouché', 'toilette bouchée', 'évier bouché', 'douche bouchée', 'lavabo', 'évier', 'salle de bain', 'sanitaire installation', 'raccordement eau', 'vidange', 'évacuation', 'siphon', 'mitigeur', 'installation sanitaire', 'rénovation salle de bain', 'plombier urgence', 'dépanneur plomberie', 'plombier 24h', 'intervention rapide', 'détection fuite', 'recherche fuite'] },
    { value: 'electricien', label: 'Électricien', icon: '⚡', color: '#FFC107', description: 'Services électricité : installation, dépannage, mise aux normes, urgence', keywords: ['électricien', 'électricité service', 'service électricité', 'dépannage électricité', 'urgence électricité', 'installation électrique', 'réparation électrique', 'panne électricité', 'panne courant', 'court-circuit', 'disjoncteur saute', 'tableau électrique', 'câblage maison', 'mise aux normes', 'norme électrique', 'raccordement électrique', 'branchement électrique', 'électricité bâtiment', 'installation lampe', 'lustre', 'plafonnier', 'éclairage maison', 'prise électrique installation', 'interrupteur installation', 'électricien urgence', 'dépanneur électricité', 'électricien 24h', 'intervention rapide électricité', 'diagnostic électrique', 'recherche panne', 'rénovation électrique', 'travaux électricité'] },
    { value: 'electricien_auto', label: 'Électricien Automobile', icon: '🔋', color: '#FF6B35', description: 'Électricité auto : diagnostic, réparation, installation équipements électroniques', keywords: ['électricien auto', 'électricité automobile', 'électricité voiture', 'électricité moto', 'électronique auto', 'diagnostic électronique', 'réparation électronique voiture', 'batterie auto', 'alternateur', 'démarreur', 'faisceau électrique', 'câblage auto', 'phare voiture', 'feu arrière', 'clignotant', 'klaxon', 'essuie-glace moteur', 'lève-vitre électrique', 'centralisation', 'autoradio installation', 'alarme voiture', 'GPS voiture', 'caméra recul installation', 'capteur parking', 'OBD diagnostic', 'valise diagnostic', 'calculateur moteur', 'boîtier électronique', 'panne électrique voiture', 'court-circuit auto', 'problème batterie', 'alternateur défaillant', 'voyant moteur', 'diagnostic panne électrique', 'réparation faisceau', 'installation équipement électronique'] },
    { value: 'peintre', label: 'Peintre en Bâtiment', icon: '🎨', color: '#8B5CF6', description: 'Services de peinture : intérieur, extérieur, décoration, ravalement de façade', keywords: ['peintre', 'peinture', 'service peinture', 'peinture bâtiment', 'peinture intérieur', 'peinture extérieur', 'peinture murale', 'peinture plafond', 'ravalement façade', 'crépi façade', 'enduit', 'décoration murale', 'papier peint', 'pose papier peint', 'revêtement mural', 'lessivage', 'préparation support', 'ponçage', 'rebouchage', 'impression', 'sous-couche', 'finition', 'laque', 'glycéro', 'acrylique', 'satinée', 'mate', 'brillante', 'peinture décorative', 'effet décoratif', 'pochoir', 'frise', 'trompe-l\'œil', 'peintre professionnel', 'peintre qualifié', 'devis peinture', 'tarif peinture', 'rénovation peinture', 'rafraîchissement peinture', 'travaux peinture'] },
    { value: 'staffeur', label: 'Staffeur / Plâtrier', icon: '🏛️', color: '#64748B', description: 'Plâtrerie, staff, faux plafonds, cloisons, décoration plâtre', keywords: ['staffeur', 'plâtrier', 'plâtrerie', 'staff', 'plâtre', 'platrerie', 'faux plafond', 'plafond suspendu', 'cloison', 'cloison sèche', 'placo', 'placoplâtre', 'BA13', 'isolation phonique', 'isolation thermique', 'doublage', 'enduit plâtre', 'enduit intérieur', 'lissage', 'ragréage', 'rebouchage', 'bandes joints', 'joints placo', 'corniche', 'moulure', 'rosace', 'modénature', 'décoration plâtre', 'ornementation', 'staff décoratif', 'plâtre décoratif', 'arc', 'voûte', 'colonne', 'pilastre', 'aménagement intérieur', 'rénovation intérieure', 'finition plâtre', 'staffeur qualifié', 'plâtrier professionnel'] },
    { value: 'quincaillerie', label: 'Quincaillerie & Accessoires Construction', icon: '🔨', color: '#F59E0B', description: 'Outils, matériaux construction, visserie, peinture, accessoires électriques, accessoires plomberie', keywords: ['quincaillerie', 'outil', 'marteau', 'tournevis', 'clé', 'pince', 'scie', 'vis', 'boulon', 'écrou', 'cheville', 'serrure', 'cadenas', 'verrou', 'charnière', 'matériaux', 'ciment', 'sable', 'gravier', 'brique', 'parpaing', 'fer', 'acier', 'béton', 'mortier', 'chaux', 'plâtre', 'peinture', 'vernis', 'colle', 'mastic', 'silicone', 'joint', 'colle carrelage', 'joint carrelage', 'croisillon', 'peigne colle', 'domino électrique', 'wago', 'gaine', 'douille', 'rallonge', 'multiprise', 'téflon', 'pâte joint', 'raccord', 'coude', 'flexible', 'collier', 'siphon', 'ruban isolant'] },
    { value: 'carrelage', label: 'Carrelage & Revêtements de Sol', icon: '🏗️', color: '#78716C', description: 'Carrelage sol, mural, faïence, mosaïque, grès cérame, marbre', keywords: ['carrelage', 'carreau', 'carreaux', 'faïence', 'faience', 'mosaïque', 'mosaique', 'revêtement sol', 'revetement sol', 'revêtement mural', 'dalle', 'dalles', 'pavé', 'paves', 'grès', 'grès cérame', 'gres cerame', 'céramique', 'ceramique', 'porcelaine', 'marbre', 'granit', 'granite', 'pierre naturelle', 'pierre', 'travertin', 'ardoise', 'terre cuite', 'tomette', 'zellige', 'carrelage piscine', 'carrelage extérieur', 'carrelage exterieur', 'carrelage terrasse', 'carrelage salle de bain', 'carrelage cuisine', 'carrelage intérieur', 'carrelage interieur', 'carrelage commercial', 'carrelage résidentiel', 'residentiel', 'brillant', 'mat', 'antidérapant', 'antiderapant', 'anti-glisse', 'glissant', '10x10', '15x15', '20x20', '25x25', '30x30', '40x40', '45x45', '60x60', '80x80', '120x60', 'grand format', 'petit format', 'dimensions', 'format', 'finition', 'poli', 'satiné', 'satine', 'structuré', 'structure', 'lappato', 'adouci', 'effet bois', 'imitation bois', 'effet pierre', 'imitation pierre', 'effet marbre', 'imitation marbre', 'effet béton', 'beton', 'imitation', 'uni', 'marbré', 'veiné', 'veine', 'motif', 'géométrique', 'geometrique', 'hexagonal', 'métro', 'décor', 'decor', 'durable', 'résistant', 'resistant', 'qualité', 'qualite', 'premium', 'luxe', 'haut de gamme', 'économique', 'economique', 'neuf', 'stock', 'disponible', 'promotion', 'destockage', 'déstockage', 'import', 'importation', 'espagne', 'espagnol', 'italie', 'italien', 'portugal', 'portugais', 'turquie', 'turc', 'chine', 'chinois', 'inde', 'indien', 'egypte', 'égypte', 'egyptien', 'maroc', 'marocain', 'tunisie', 'tunisien', 'afrique du sud', 'sud-africain'] },
    { value: 'telephone', label: 'Téléphones et Accessoires', icon: '📱', color: '#FF9800', description: 'Smartphones, accessoires, coques, écouteurs', keywords: ['téléphone', 'smartphone', 'mobile', 'portable', 'cellulaire', 'iPhone', 'Samsung', 'Huawei', 'Xiaomi', 'Oppo', 'Tecno', 'Infinix', 'Nokia', 'Galaxy', 'Android', 'iOS', 'écran', 'tactile', 'appareil photo', 'caméra', 'double SIM', '4G', '5G', 'Wi-Fi', 'Bluetooth', 'stockage', '64GB', '128GB', '256GB', 'RAM', 'batterie', 'chargeur', 'coque', 'écouteurs', 'neuf', 'occasion', 'débloqué'] },
    { value: 'ticket_voyage', label: 'Tickets et Billets de Transport', icon: '🎫', color: '#8B5CF6', description: 'Bus, train, avion avec sélection de place', keywords: ['ticket', 'billet', 'voyage', 'transport', 'bus', 'car', 'autobus', 'train', 'avion', 'vol', 'bateau', 'ferry', 'départ', 'arrivée', 'destination', 'trajet', 'place', 'siège', 'réservation', 'aller simple', 'aller-retour', 'économique', 'affaires', 'première classe', 'VIP', 'escale', 'direct', 'compagnie', 'horaire'] },
    { value: 'ustensiles_cuisine', label: 'Ustensiles de Cuisine', icon: '🍴', color: '#FF5722', description: 'Casseroles, poêles, couteaux, mixers, batterie cuisine', keywords: ['ustensile', 'cuisine', 'casserole', 'poêle', 'faitout', 'marmite', 'cocotte', 'wok', 'couteau', 'planche à découper', 'râpe', 'fouet', 'louche', 'spatule', 'cuillère', 'mixer', 'mixeur', 'blender', 'robot cuisine', 'balance', 'batterie cuisine', 'inox', 'aluminium', 'téflon', 'anti-adhésif', 'set'] },
    { value: 'vetement', label: 'Vêtements et Prêt-à-Porter', icon: '👕', color: '#EC4899', description: 'Vêtements, habits, articles de mode', keywords: ['vêtement', 'habit', 'mode', 'fashion', 'prêt-à-porter', 'textile', 'chemise', 'polo', 'T-shirt', 'pull', 'sweat', 'gilet', 'veste', 'manteau', 'blouson', 'pantalon', 'jean', 'short', 'jupe', 'robe', 'costume', 'tailleur', 'sous-vêtement', 'chaussette', 'écharpe', 'cravate', 'ceinture', 'gant', 'bonnet', 'chapeau', 'casquette', 'homme', 'femme', 'enfant', 'taille', 'coton', 'soie', 'lin', 'laine', 'Zara', 'H&M'] },
    { value: 'restauration', label: 'Restauration & Traiteur', icon: '🍽️', color: '#F97316', description: 'Restaurants, cafés, bars, traiteurs, food trucks', keywords: ['restaurant', 'resto', 'café', 'bar', 'traiteur', 'food truck', 'cuisine', 'menu', 'plat', 'repas', 'déjeuner', 'dîner', 'petit-déjeuner', 'brunch', 'buffet', 'chef', 'cuisinier', 'gastronomie', 'mets', 'service', 'réservation', 'table', 'terrasse', 'livraison', 'à emporter', 'fast-food', 'snack', 'brasserie', 'bistrot', 'pizzeria', 'boulangerie', 'pâtisserie'] },
    { value: 'electronique', label: 'Électronique & High-Tech', icon: '⚡', color: '#00BCD4', description: 'Appareils électroniques, gadgets, accessoires tech', keywords: ['électronique', 'high-tech', 'technologie', 'gadget', 'appareil', 'accessoire', 'tech', 'numérique', 'digital', 'connecté', 'smart', 'intelligent', 'console', 'PlayStation', 'Xbox', 'Nintendo', 'drone', 'caméra', 'GoPro', 'stabilisateur', 'microphone', 'audio', 'vidéo', 'streaming', 'gaming', 'esport'] },
    { value: 'musique_instruments', label: 'Musique & Instruments', icon: '🎸', color: '#9C27B0', description: 'Instruments de musique, équipements audio, accessoires', keywords: ['musique', 'instrument', 'musical', 'guitare', 'piano', 'clavier', 'synthétiseur', 'batterie', 'percussion', 'saxophone', 'trompette', 'violon', 'flûte', 'harmonica', 'accordéon', 'djembé', 'tam-tam', 'balafon', 'kora', 'ampli', 'amplificateur', 'enceinte', 'micro', 'table de mixage', 'sono', 'sonorisation', 'studio', 'enregistrement'] },
    { value: 'soutien_scolaire_repetiteur', label: 'Soutien Scolaire / Répétiteur', icon: '📚', color: '#10B981', description: 'Cours particuliers primaire/secondaire, aide aux devoirs, répétiteur', keywords: ['soutien scolaire', 'répétiteur', 'cours particuliers', 'aide devoirs', 'rattrapage scolaire', 'révisions', 'professeur particulier', 'enseignant', 'prof à domicile', 'cours à domicile', 'maths', 'français', 'anglais', 'physique', 'primaire', 'collège', 'lycée', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', 'seconde', 'première', 'terminale', 'BEPC', 'probatoire', 'baccalauréat', 'bac'] },
    { value: 'formation_education', label: 'Formation & Éducation', icon: '🎓', color: '#7C3AED', description: 'Formation professionnelle, préparation concours, certifications', keywords: ['formation', 'éducation', 'formation professionnelle', 'certification', 'diplôme', 'stage', 'atelier', 'séminaire', 'workshop', 'préparation concours', 'polytechnique', 'ENAM', 'ENS', 'grandes écoles', 'concours', 'webinaire', 'e-learning', 'en ligne', 'langue', 'informatique', 'bureautique', 'management', 'formateur', 'coach', 'mentor'] },
    { value: 'evenementiel', label: 'Événementiel & Organisation', icon: '🎉', color: '#EC4899', description: 'Organisation d\'événements, mariages, fêtes, célébrations', keywords: ['événement', 'évènement', 'organisation', 'mariage', 'fête', 'anniversaire', 'baptême', 'communion', 'célébration', 'cérémonie', 'réception', 'soirée', 'gala', 'conférence', 'séminaire', 'salon', 'exposition', 'concert', 'spectacle', 'animation', 'DJ', 'sono', 'décoration', 'traiteur', 'location', 'salle', 'tente', 'chapiteau', 'wedding planner', 'organisateur'] },
    { value: 'agriculture', label: 'Agriculture & Élevage', icon: '🌱', color: '#10B981', description: 'Produits agricoles, élevage, matériel agricole', keywords: ['agriculture', 'agricole', 'ferme', 'exploitation', 'élevage', 'culture', 'plantation', 'récolte', 'moisson', 'semence', 'graine', 'engrais', 'pesticide', 'herbicide', 'tracteur', 'charrue', 'moissonneuse', 'batteuse', 'irrigation', 'arrosage', 'serre', 'pépinière', 'maraîchage', 'légume', 'fruit', 'céréale', 'maïs', 'riz', 'mil', 'sorgho', 'manioc', 'bétail', 'vache', 'bœuf', 'mouton', 'chèvre', 'porc', 'volaille', 'poulet', 'canard', 'lapin'] },
    { value: 'sport_fitness', label: 'Sport & Fitness', icon: '💪', color: '#EF4444', description: 'Salles de sport, coaching, équipements sportifs', keywords: ['sport', 'fitness', 'gym', 'salle de sport', 'musculation', 'cardio', 'crossfit', 'yoga', 'pilates', 'zumba', 'danse', 'aerobic', 'spinning', 'cycling', 'running', 'course', 'jogging', 'marathon', 'natation', 'piscine', 'aquagym', 'tennis', 'foot', 'football', 'basketball', 'volleyball', 'handball', 'rugby', 'boxe', 'MMA', 'arts martiaux', 'karaté', 'judo', 'taekwondo', 'coach sportif', 'personal trainer', 'entraîneur', 'préparateur physique', 'nutrition', 'diététique'] },
    { value: 'bien_etre_spa', label: 'Bien-être & Spa', icon: '🧘', color: '#14B8A6', description: 'Spa, massage, relaxation, soins bien-être', keywords: ['bien-être', 'spa', 'massage', 'relaxation', 'détente', 'soin', 'hammam', 'sauna', 'jacuzzi', 'balnéothérapie', 'thalasso', 'aromathérapie', 'réflexologie', 'shiatsu', 'ayurveda', 'thai', 'suédois', 'californien', 'pierre chaude', 'huile', 'gommage', 'enveloppement', 'modelage', 'drainage lymphatique', 'méditation', 'yoga', 'sophrologie', 'hypnose', 'reiki', 'énergétique'] },
    { value: 'nettoyage_entretien', label: 'Nettoyage & Entretien', icon: '🧹', color: '#6B7280', description: 'Services de nettoyage, ménage, entretien', keywords: ['nettoyage', 'ménage', 'entretien', 'propreté', 'nettoyeur', 'femme de ménage', 'homme de ménage', 'agent d\'entretien', 'société de nettoyage', 'lavage', 'dépoussiérage', 'aspirateur', 'balai', 'serpillière', 'désinfection', 'décontamination', 'vitre', 'carrelage', 'moquette', 'tapis', 'canapé', 'bureaux', 'locaux', 'immeuble', 'copropriété', 'commercial', 'industriel', 'après chantier', 'fin de chantier'] },
    { value: 'jardinage_paysagisme', label: 'Jardinage & Paysagisme', icon: '🌳', color: '#059669', description: 'Entretien jardins, création espaces verts, paysagiste', keywords: ['jardinage', 'jardin', 'paysagisme', 'paysagiste', 'espaces verts', 'entretien', 'création', 'aménagement', 'plantation', 'arbre', 'arbuste', 'fleur', 'plante', 'pelouse', 'gazon', 'tonte', 'taille', 'élagage', 'débroussaillage', 'arrosage', 'irrigation', 'clôture', 'haie', 'allée', 'terrasse', 'pergola', 'potager', 'verger', 'compost', 'engrais', 'tondeuse', 'taille-haie', 'tronçonneuse'] },
    { value: 'securite_surveillance', label: 'Sécurité & Surveillance', icon: '🛡️', color: '#DC2626', description: 'Agents de sécurité, gardiennage, vidéosurveillance', keywords: ['sécurité', 'surveillance', 'gardiennage', 'agent de sécurité', 'vigile', 'garde', 'protection', 'sûreté', 'ronde', 'patrouille', 'contrôle', 'accès', 'badge', 'portique', 'caméra', 'vidéosurveillance', 'CCTV', 'alarme', 'détecteur', 'sirène', 'télésurveillance', 'centrale', 'digicode', 'interphone', 'portail', 'barrière', 'gardien', 'concierge', 'veilleur', 'nuit', 'événement', 'magasin', 'entreprise', 'chantier'] },
    { value: 'plomberie_sanitaire', label: 'Plomberie & Sanitaire', icon: '🚰', color: '#00BCD4', description: 'Vente de matériel plomberie et sanitaire', keywords: ['plomberie', 'sanitaire', 'matériel', 'robinet', 'robinetterie', 'lavabo', 'évier', 'WC', 'toilette', 'douche', 'baignoire', 'chauffe-eau', 'tuyauterie', 'canalisation', 'raccord', 'joint', 'siphon', 'vidange', 'évacuation', 'cuivre', 'PVC', 'inox', 'chrome', 'céramique', 'porcelaine', 'grohe', 'geberit', 'roca', 'hansgrohe', 'duravit', 'installation', 'garantie', 'neuf', 'occasion'] },
    { value: 'menuiserie', label: 'Menuiserie & Ébénisterie', icon: '🪵', color: '#F97316', description: 'Fabrication, pose, réparation bois et meubles', keywords: ['menuiserie', 'menuisier', 'ébénisterie', 'ébéniste', 'bois', 'boiserie', 'charpente', 'charpentier', 'parquet', 'plancher', 'lambris', 'porte', 'fenêtre', 'volet', 'portail', 'portillon', 'clôture', 'pergola', 'terrasse', 'deck', 'escalier', 'garde-corps', 'rambarde', 'placard', 'dressing', 'bibliothèque', 'meuble', 'sur mesure', 'fabrication', 'pose', 'installation', 'réparation', 'restauration', 'rénovation', 'agencement', 'aménagement'] },
    { value: 'reparateur_frigo', label: 'Frigoriste / Réparateur Frigo', icon: '❄️', color: '#06B6D4', description: 'Réparation frigos, congélateurs, dépannage urgence, recharge gaz, toutes marques', keywords: ['frigoriste', 'réparateur', 'dépanneur', 'frigo', 'réfrigérateur', 'congélateur', 'dépannage', 'réparation', 'panne', 'fuite', 'gaz', 'recharge', 'compresseur', 'thermostat', 'Samsung', 'LG', 'Hisense', 'Haier', 'Bosch', 'Whirlpool', 'Beko', 'TCL', 'Midea', 'urgence', 'intervention', 'technicien', 'froid', 'climatisation', 'No Frost', 'Inverter', 'service', 'diagnostic', 'réparation circuit', 'gaz réfrigérant', 'R134a', 'R600a', 'entretien', 'maintenance', 'installation', 'domicile', '24h/24'] },
    { value: 'reparateur_climatiseur', label: 'Réparateur Climatiseur / AC', icon: '❄️', color: '#0EA5E9', description: 'Réparation, installation, maintenance climatiseurs, dépannage urgence 24h/24, toutes marques', keywords: ['climatiseur', 'climatisation', 'clim', 'AC', 'air conditionné', 'réparateur', 'dépanneur', 'frigoriste', 'technicien', 'dépannage', 'réparation', 'installation', 'maintenance', 'entretien', 'nettoyage', 'recharge gaz', 'R22', 'R410A', 'R32', 'fuite', 'panne', 'compresseur', 'ventilateur', 'filtre', 'drainage', 'condensats', 'split', 'window', 'cassette', 'inverter', 'Midea', 'Gree', 'Haier', 'Hisense', 'LG', 'Samsung', 'Daikin', 'Mitsubishi', 'urgence', '24h/24', 'diagnostic', 'devis gratuit', 'intervention', 'domicile', 'bureau', 'froid', 'BTU'] },
    { value: 'reparateur_electronique', label: 'Réparateur Électronique (TV/Radio)', icon: '📺', color: '#9C27B0', description: 'Réparation TV, radio, home cinéma, décodeur satellite, vidéoprojecteur, toutes marques', keywords: ['réparateur', 'dépanneur', 'technicien', 'électronique', 'TV', 'télévision', 'téléviseur', 'écran', 'réparation TV', 'dépannage TV', 'panne TV', 'TV cassée', 'Samsung TV', 'LG TV', 'Hisense TV', 'TCL TV', 'Sony TV', 'Nasco', 'Bruhm', 'Polystar', 'QLED', 'OLED', 'LED', 'Smart TV', '4K', 'dalle', 'écran noir', 'lignes', 'pixels', 'rétro-éclairage', 'carte mère', 'alimentation', 'HDMI', 'radio', 'poste radio', 'transistor', 'home cinéma', 'barre de son', 'enceinte', 'amplificateur', 'audio', 'son', 'vidéo', 'décodeur', 'satellite', 'CANAL+', 'TNT', 'parabole', 'antenne', 'vidéoprojecteur', 'projecteur', 'DVD', 'lecteur', 'diagnostic', 'intervention', 'domicile', 'urgence', 'service', 'installation', 'configuration', 'Smart TV'] },
    { value: 'animaux_veterinaire', label: 'Animaux & Vétérinaire', icon: '🐾', color: '#FF69B4', description: 'Vétérinaires, toilettage, dressage, accessoires animaux', keywords: ['animal', 'animaux', 'vétérinaire', 'véto', 'clinique vétérinaire', 'soin', 'consultation', 'vaccination', 'stérilisation', 'castration', 'vermifuge', 'antiparasitaire', 'urgence', 'chirurgie', 'toilettage', 'toiletteur', 'coupe', 'lavage', 'brushing', 'chien', 'chat', 'chiot', 'chaton', 'oiseau', 'lapin', 'rongeur', 'reptile', 'dressage', 'éducation', 'comportementaliste', 'pension', 'garde', 'promenade', 'dog sitter', 'accessoire', 'collier', 'laisse', 'gamelle', 'cage', 'niche', 'litière', 'jouet', 'nourriture', 'croquette', 'pâtée'] },
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

    pieces_industrielles: `Nom,Prix,Devise,Description,Type,Marque,Référence,Application,Matériau,État,Garantie,Norme
Roulement SKF 6205,8500,XAF,Roulement à billes étanche haute vitesse,Roulement à billes,SKF,6205-2RS,Machines-outils,Acier,Neuf d'origine (OEM),2 ans,ISO 9001
Courroie trapézoïdale Gates,4500,XAF,Courroie transmission résistante chaleur,Courroie trapézoïdale,Gates,XPZ1120,Compresseur d'air,Caoutchouc synthétique (NBR),Neuf équivalent,1 an,CE
Moteur électrique ABB 5.5kW,285000,XAF,Moteur asynchrone triphasé rendement,Moteur électrique triphasé,ABB,M2QA 132M,Machines-outils,Fonte/Cuivre,Neuf d'origine (OEM),3 ans et plus,CE
Pompe centrifuge Grundfos,95000,XAF,Pompe eau centrifuge débit 50m³/h,Pompe centrifuge,Grundfos,CR 5-11,Irrigation,Acier inoxydable (Inox 304),Neuf d'origine (OEM),2 ans,ISO 9001
Vérin hydraulique Parker,185000,XAF,Vérin hydraulique double effet,Vérin hydraulique,Parker,25333P,Garage et mécanique,Inox 316,Occasion - Révisé,6 mois,DIN`,

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

    pharmacie: `Nom,Prix,Devise,Description,Type,Heures ouverture,Heures fermeture,Jours ouverture,Téléphone urgence,Services
Exemple Pharmacie garde,0,XAF,Pharmacie de garde avec service 24h/24 et tests rapides,Pharmacie de garde (nuit),20:00,08:00,Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche,+237 699 XX XX XX,Garde de nuit (20h-8h)|Délivrance urgente|Test de glycémie rapide|Paiement Mobile Money
Exemple Pharmacie normale,0,XAF,Pharmacie de quartier avec livraison à domicile,Pharmacie normale,08:00,20:00,Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi,+237 677 XX XX XX,Vente de médicaments sur ordonnance|Conseil pharmaceutique gratuit|Livraison à domicile|Paiement Orange Money`,

    hopital_clinique: `Nom,Prix,Devise,Description,Type,Banque de sang,Prestations médicales,Planning,Urgences 24h/24,RDV en ligne
Exemple Hôpital,0,XAF,Exemple d'établissement avec urgences et banque de sang,Hôpital,Oui,Chirurgie|Consultation générale|Radiologie,Lun-Ven 08:00-18:00,Oui,Non
Exemple Clinique,0,XAF,Exemple de clinique privée avec RDV en ligne,Clinique,Non,Gynécologie|Ophtalmologie|Pédiatrie,Lun-Sam 09:00-19:00,Non,Oui`,

    laboratoire: `Nom,Prix,Devise,Description,Type,Examens disponibles,Planning,Prélèvement domicile,Résultats rapides,RDV en ligne
Exemple Labo Analyses,0,XAF,Exemple de laboratoire d'analyses médicales,Laboratoire d'analyses médicales,Hématologie|Biochimie|Sérologie|Parasitologie,Lun-Sam 07:00-18:00,Oui,Oui,Oui
Exemple Centre Imagerie,0,XAF,Exemple de centre d'imagerie médicale,Centre d'imagerie médicale,Scanner|IRM|Radiographie|Échographie,Lun-Ven 08:00-18:00,Non,Oui,Oui
Exemple Centre Mixte,0,XAF,Exemple de centre mixte analyses et imagerie,Laboratoire & Imagerie (Mixte),Hématologie|Biochimie|Scanner|IRM,Lun-Dim 24h/24,Oui,Oui,Oui`,

    demenagement: `Nom,Prix,Devise,Description,Type,Volume,Type véhicule,Distance,Services,Nb déménageurs,Trajet,Ville départ,Ville arrivée,Compagnie,Durée,Disponibilité,Type assurance,Accessibilité
Déménagement Express Douala,45000,XAF,Déménagement local rapide avec équipe pro,Déménagement local (même ville),F2/2 pièces (20-30m³),Camionnette 15m³,Ville proche (5-20 km),Emballage professionnel|Transport sécurisé|Déballage et installation,2 déménageurs,,Douala,Douala,Pro Déménagement,2-4 heures,Immédiat (24-48h),Assurance de base (responsabilité civile),1er étage sans ascenseur
Déménagement Douala-Yaoundé,180000,XAF,Trajet national populaire avec équipe expérimentée,Déménagement national,F3/3 pièces (30-40m³),Camion 30m³,Longue distance (150-500 km),Emballage professionnel|Transport sécurisé|Déballage et installation|Montage meubles|Démontage meubles,4-5 déménageurs,Douala → Yaoundé (250 km),Douala,Yaoundé,Camtrans Déménagement,1 journée,Cette semaine,Assurance tous risques,Villa/Maison (étages)
Déménagement Yaoundé-Bafoussam,220000,XAF,Service professionnel avec assurance complète,Déménagement national,F4/4 pièces (40-50m³),Camion 40m³,Longue distance (150-500 km),Emballage professionnel|Transport sécurisé|Déballage et installation|Montage meubles|Démontage meubles|Assurance tous risques|Cartons fournis,6+ déménageurs (grande équipe),Yaoundé → Bafoussam (290 km),Yaoundé,Bafoussam,Global Moving Cameroun,2-3 jours,Semaine prochaine,Assurance tous risques,Villa/Maison (étages)
Express 24h Bafoussam,35000,XAF,Déménagement express en 24h chrono,Déménagement express (24h),Studio/Chambre simple (10-15m³),Camionnette 10m³ (petits trajets),Même quartier (moins de 5 km),Transport sécurisé|Cartons fournis,1 déménageur,,Bafoussam,Bafoussam,Express Déménagement Cameroun,Moins de 2h,Immédiat (24-48h),Sans assurance,Rez-de-chaussée
Garde-Meubles Sécurisé Douala,30000,XAF,Stockage sécurisé 24/7 avec assurance,Garde-meubles sécurisé,F3/3 pièces (30-40m³),Camion 25m³,Même quartier (moins de 5 km),Transport sécurisé|Assurance tous risques,2 déménageurs,,Douala,Douala,Garde-Meubles Sécurisés Douala,2-4 heures,Flexible,Assurance objets de valeur,Avec ascenseur
Déménagement Bureau Yaoundé,250000,XAF,Déménagement professionnel d'entreprise,Déménagement bureau/entreprise,Bureau moyen (30-40m³),Camion 40m³,Intercommunal (20-50 km),Emballage professionnel|Transport sécurisé|Déballage et installation|Montage meubles|Démontage meubles|Cartons fournis|Monte-meubles (grue),6+ déménageurs (grande équipe),,Yaoundé,Yaoundé,Move Masters Cameroun,1 journée,Cette semaine,Assurance tous risques,3e+ étage sans ascenseur
Déménagement Douala-Kribi,85000,XAF,Trajet côtier avec équipe spécialisée,Déménagement national,F2/2 pièces (20-30m³),Camionnette 20m³,Régional (50-150 km),Emballage professionnel|Transport sécurisé|Déballage et installation|Cartons fournis,3 déménageurs,Douala → Kribi (150 km),Douala,Kribi,Africa Déménagement Services,4-6 heures,Flexible,Assurance de base (responsabilité civile),Villa/Maison (plain-pied)
Déménageur Indépendant Garoua,25000,XAF,Service local économique et rapide,Déménagement local (même ville),F1/1 pièce (15-20m³),Camionnette 10m³ (petits trajets),Même quartier (moins de 5 km),Transport sécurisé|Portage étages,2 déménageurs,,Garoua,Garoua,Déménageur indépendant certifié,Moins de 2h,Immédiat (24-48h),Sans assurance,2e étage sans ascenseur`,

    cosmetique_parfum: `Nom,Prix,Devise,Description,Type,Marque,Genre,Volume,Unité,Concentration,TypePeau,TypeCheveux,Teinte,Finition,Ingrédients,Certifications,Origine
Crème Hydratante Nivea,15000,XAF,Crème hydratante quotidienne pour peau normale,Crème visage,Nivea,Mixte/Unisexe,50,ml,Non applicable,Peau normale,,,,Vitamine E|Aloe Vera,Dermatologiquement testé,France
Parfum Chanel N°5,85000,XAF,Parfum féminin iconique aux notes florales,Parfum,Chanel,Femme,50,ml,Eau de parfum (EDP) 15-20%,,,,,Rose jasmin,,France
Huile d'Argan Bio,25000,XAF,Huile d'argan pure 100% bio pour cheveux et corps,Huile corporelle,Palmer's,Mixte/Unisexe,100,ml,100%,Tous types de peau,Tous types,,,Argan pur,Bio|Naturel,Maroc
Rouge à Lèvres MAC,18000,XAF,Rouge à lèvres mat longue tenue,Rouge à lèvres,MAC,Femme,3,g,Non applicable,,,Rouge,Mat,Cire d'abeille|Vitamine E,Cruelty-free,Canada
Fair & White Lait Corps,12000,XAF,Lait corporel éclaircissant à la vitamine C,Lait corporel,Fair & White,Mixte/Unisexe,500,ml,Non applicable,Peau noire/métissée,,,,Vitamine C|Glutathion,Dermatologiquement testé,France
Fond de Teint L'Oréal,22000,XAF,Fond de teint longue tenue 24h,Fond de teint,L'Oréal,Femme,30,ml,Non applicable,Peau mixte,,Caramel,Mat,Acide hyaluronique,Non comédogène,France
Shampoing Cantu Afro,8500,XAF,Shampoing sans sulfate pour cheveux crépus,Shampoing,Cantu,Mixte/Unisexe,400,ml,Non applicable,,Cheveux crépus,,,Beurre de karité|Huile de coco,Sans sulfates|Cruelty-free,États-Unis
Déodorant Dove Roll-on,3500,XAF,Déodorant roll-on 48h protection,Déodorant roll-on,Dove,Femme,50,ml,Non applicable,Peau sensible,,,,Aloe Vera,Dermatologiquement testé,Royaume-Uni`,

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

    sport_fitness: `Nom,Prix,Devise,Description,Type,Niveau,Durée,Service,Équipements,Objectif,Jours,Horaires
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

    reparateur_frigo: `Nom,Prix,Devise,Description,Marque,Modèle,Type appareil,Type service,Type panne,Gaz,Garantie,Délai,Zone,Disponibilité,Urgence
Diagnostic Panne Frigo,5000,XAF,Diagnostic complet avec rapport détaillé toutes marques,Toutes marques,,Réfrigérateur simple porte,Diagnostic panne réfrigérateur,Frigo ne refroidit pas,,,Même jour,Douala - Akwa,Lundi-Samedi 8h-20h,Oui
Recharge Gaz R134a,25000,XAF,Recharge gaz R134a avec test étanchéité circuit,Samsung,Samsung RT,Réfrigérateur double porte,Recharge gaz réfrigérant,Fuite de gaz réfrigérant,R134a,6 mois,Sous 24h,Douala - Bonabéri,Lundi-Vendredi 8h-18h,Oui
Remplacement Compresseur,85000,XAF,Changement compresseur d'origine avec garantie pièce,LG,LG Door-in-Door,Réfrigérateur américain,Remplacement compresseur,Compresseur grillé,,2 ans,Selon disponibilité pièces,Yaoundé - Bastos,Urgence 24h/24 - 7j/7,Oui
Réparation Thermostat,12000,XAF,Remplacement thermostat électronique réglage température,Hisense,Hisense REF-25,Réfrigérateur No Frost,Remplacement thermostat électronique,Thermostat ne fonctionne pas,,3 mois,Sous 48h,Douala - Makepe,Lundi-Samedi 8h-20h,Non
Nettoyage Circuit Complet,18000,XAF,Nettoyage évaporateur condenseur avec désinfection,Toutes marques,,Congélateur coffre,Nettoyage complet frigo,Givre excessif dans congélateur,,1 mois,Rendez-vous sous 24h,Yaoundé - Melen,Lundi-Vendredi 8h-18h,Non`,

    reparateur_electronique: `Nom,Prix,Devise,Description,Marque TV,Modèle TV,Type appareil,Type service,Type panne,Garantie,Délai,Zone,Disponibilité,Urgence
Diagnostic Panne TV,6000,XAF,Diagnostic complet avec rapport détaillé toutes marques TV,Toutes marques TV,,Téléviseur LED,Diagnostic panne TV,TV ne s'allume pas,,Même jour,Douala - Akwa,Lundi-Samedi 8h-20h,Oui
Réparation Écran Noir TV,15000,XAF,Réparation écran noir avec test rétro-éclairage et cartes,Samsung,Samsung Crystal UHD,Smart TV,Réparation écran noir,Écran noir (LED allumée),3 mois,Sous 24h,Douala - Bonabéri,Lundi-Vendredi 8h-18h,Oui
Remplacement Dalle TV,75000,XAF,Changement dalle d'origine avec garantie pièce,LG,LG OLED,TV OLED 55 pouces,Remplacement dalle TV,Écran cassé,6 mois,Selon disponibilité pièces,Yaoundé - Bastos,Urgence 24h/24 - 7j/7,Oui
Réparation Port HDMI,10000,XAF,Remplacement port HDMI défectueux micro-soudure,Hisense,Hisense VIDAA,Smart TV 43 pouces,Réparation port HDMI,Port HDMI ne fonctionne pas,3 mois,Sous 48h,Douala - Makepe,Lundi-Samedi 8h-20h,Non
Installation Home Cinéma,25000,XAF,Installation complète home cinéma avec calibration son,Toutes marques,,Home cinéma,Installation home cinéma,,,Rendez-vous sous 24h,Yaoundé - Melen,Lundi-Vendredi 8h-18h,Non
Configuration Smart TV,8000,XAF,Configuration Wi-Fi applications Netflix YouTube etc,TCL,TCL Android TV,Smart TV,Configuration Smart TV,Wi-Fi ne fonctionne pas,1 mois,Même jour,Douala - Bonanjo,Lundi-Samedi 8h-20h,Non`,

    animaux_veterinaire: `Nom,Prix,Devise,Description,Type animal,Race,Services vétérinaire,Tarif
Consultation Vétérinaire,15000,XAF,Examen clinique complet avec conseil personnalisé,Chien|Chat,Toutes races,Consultation générale,Standard
Vaccination Antirabique,8000,XAF,Vaccin antirabique avec carnet de santé,Chien,Toutes races,Vaccination,Standard
Toilettage Canin Complet,18000,XAF,Bain coupe brushing coupe griffes nettoyage oreilles,Chien,Toutes races,Toilettage professionnel,Standard
Garde Pension Animaux,5000,XAF,Pension journalière alimentation soins et promenade,Chien|Chat,Toutes races,Pension,Standard par jour
Stérilisation Chat,25000,XAF,Opération stérilisation avec suivi post-opératoire,Chat,Toutes races,Chirurgie,Standard`,

    electricite: `Nom,Prix,Devise,Description,Catégorie,Type d'éclairage,Marque,Tension,Puissance,Culot,Couleur lumière,Normes,Garantie,État,Utilisation
Ampoule LED E27 10W,3500,XAF,Ampoule LED blanc chaud économique,Ampoules et tubes,Ampoule LED,Philips,220V AC,10W,E27 (gros culot),Blanc chaud (2700K),CE|NF|A++,2 ans,Neuf en boîte,Résidentiel
Câble électrique 2.5mm²,8500,XAF,Câble électrique souple au mètre,Câblage et fils,,Nexans,220V AC,,,,,1 an,Neuf,Commercial
Interrupteur va-et-vient,4500,XAF,Interrupteur design blanc Legrand,Interrupteurs et commandes,,Legrand,220V AC,,,,CE|NF,2 ans,Neuf en boîte,Résidentiel
Plafonnier LED,25000,XAF,Plafonnier moderne 3 spots orientables,Luminaires intérieurs,Plafonnier,Philips,220V AC,30W,,Blanc neutre (4000K),CE|IP20,3 ans,Neuf en boîte,Résidentiel`
};

const ProductManagerMobile: React.FC<ProductManagerMobileProps> = ({
    products,
    onProductsChange,
    readonly = false,
    titreService,
    descriptionService,
    categoryService,
    onDuplicate,
    focusProductId, // ✅ NOUVEAU
    duplicateProduct, // ✅ NOUVEAU
    serviceId, // ✅ NOUVEAU
    serviceData // ✅ NOUVEAU
}) => {
    const navigation = useNavigation(); // ✅ Navigation pour modifier/ajouter produit
    const [showDuplicationModal, setShowDuplicationModal] = useState(false);
    const [productToDuplicate, setProductToDuplicate] = useState<Product | null>(null);
    const [showDeliveryConfigModal, setShowDeliveryConfigModal] = useState(false);
    const [configProductIndex, setConfigProductIndex] = useState<number | null>(null);

    // ✅ NOUVEAU 2025-11-01: Gérer la duplication automatique d'un produit
    // ✅ CORRECTION: Naviguer vers AjouterProduitSimpleScreen (formulaire dédié ajout produit)
    React.useEffect(() => {
        if (duplicateProduct && serviceId && serviceData) {
            console.log('[ProductManagerMobile] 📋 Navigation vers AjouterProduitSimple pour dupliquer produit:', {
                nom: duplicateProduct.nom,
                type: duplicateProduct.type,
                serviceId
            });

            // ✅ CORRECTION: Naviguer vers AjouterProduitSimpleScreen (formulaire dédié pour ajouter un produit)
            (navigation as any).navigate('AjouterProduitSimple', {
                serviceId: serviceId,
                prefill: duplicateProduct, // Préremplir avec le produit à dupliquer
                mode: 'duplicate', // Mode duplication
                suggestionIA: {
                    data: serviceData
                }
            });
        }
    }, [duplicateProduct, serviceId, serviceData, navigation]);

    // ✅ NOUVEAU 2025-11-01: Fonction de gestion d'erreurs API (Objectif #10)
    const handleAPIError = (error: any, operation: string, retryFn?: () => void) => {
        console.error(`[ProductManagerMobile - ${operation}]`, error);

        let title = `❌ Erreur - ${operation}`;
        let message = 'Une erreur inattendue est survenue';

        if (error.response) {
            switch (error.response.status) {
                case 400:
                    title = '⚠️ Données invalides';
                    message = error.response.data?.message || 'Vérifiez les données';
                    break;
                case 401:
                    title = '🔐 Non autorisé';
                    message = 'Session expirée. Reconnectez-vous.';
                    break;
                case 402:
                    title = '💳 Solde insuffisant';
                    message = error.response.data?.message || 'Rechargez votre compte';
                    break;
                case 404:
                    title = '🔍 Non trouvé';
                    message = 'Le produit ou service n\'existe plus';
                    break;
                case 500:
                    title = '⚙️ Erreur serveur';
                    message = 'Problème temporaire. Réessayez dans quelques instants.';
                    break;
                default:
                    message = error.response.data?.message || error.response.statusText || message;
            }
        } else if (error.request) {
            title = '📡 Pas de connexion';
            message = 'Vérifiez votre connexion internet.';
        } else {
            message = error.message || message;
        }

        const buttons: any[] = [{ text: 'OK' }];
        if (retryFn) {
            buttons.push({ text: '🔄 Réessayer', onPress: retryFn });
        }

        Alert.alert(title, message, buttons);
    };

    const handleEditProduct = (product: Product) => {
        // ✅ CORRECTION: Naviguer vers AjouterProduitSimpleScreen en mode édition
        // Ce formulaire est dédié à l'édition/ajout de produit, pas FormulaireYukpoIntelligent
        if (serviceId && !readonly) {
            console.log('[ProductManagerMobile] 📝 Navigation vers AjouterProduitSimple pour édition produit:', {
                productId: product.id,
                productName: product.nom,
                serviceId
            });

            // Trouver l'index du produit dans la liste
            const productIndex = products.findIndex(p => p.id === product.id);

            (navigation as any).navigate('AjouterProduitSimple', {
                mode: 'edit',
                serviceId: serviceId,
                productId: product.id,
                productIndex: productIndex >= 0 ? productIndex : null,
                prefill: product, // Données complètes du produit à modifier
                suggestionIA: {
                    data: serviceData || {}
                }
            });
        }
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

    // ✅ NOUVEAU 2025-11-01: Désactivation produit (Objectif #5)
    const handleDeactivateProduct = async (productId: string, productIndex: number) => {
        Alert.alert(
            '🔒 Désactiver le produit',
            'Le produit sera retiré temporairement de vos offres actives.\n\n✅ Vous pourrez le réactiver plus tard (1000 FCFA)\n⏰ Notification automatique après 30 jours',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Désactiver',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // TODO: Remplacer par votre URL API
                            const API_URL = 'http://localhost:8080';
                            const userToken = 'YOUR_JWT_TOKEN'; // À récupérer depuis le contexte Auth

                            const response = await fetch(
                                `${API_URL}/api/services/${serviceId}/products/${productIndex}/deactivate`,
                                {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${userToken}`
                                    }
                                }
                            );

                            if (response.ok) {
                                Alert.alert('✅ Succès', 'Le produit a été désactivé');
                                // Rafraîchir la liste des produits
                                // onRefresh?.();
                            } else {
                                const error = await response.json();
                                throw new Error(error.message);
                            }
                        } catch (error: any) {
                            handleAPIError(error, 'Désactivation produit', () => handleDeactivateProduct(productId, productIndex));
                        }
                    }
                }
            ]
        );
    };

    // ✅ NOUVEAU 2025-11-01: Réactivation produit (Objectif #6)
    const handleReactivateProduct = async (productId: string, productIndex: number) => {
        Alert.alert(
            '♻️ Réactiver le produit',
            '💰 Coût : 1000 FCFA maximum (ou prorata)\n\nLe montant sera déduit de votre solde.\n\nVoulez-vous continuer ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Réactiver',
                    onPress: async () => {
                        try {
                            // TODO: Remplacer par votre URL API
                            const API_URL = 'http://localhost:8080';
                            const userToken = 'YOUR_JWT_TOKEN'; // À récupérer depuis le contexte Auth

                            const response = await fetch(
                                `${API_URL}/api/services/${serviceId}/products/${productIndex}/reactivate`,
                                {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${userToken}`
                                    }
                                }
                            );

                            if (response.ok) {
                                const data = await response.json();
                                Alert.alert(
                                    '✅ Produit réactivé',
                                    `Le produit est à nouveau actif !\n\n💰 Coût : ${data.cost} FCFA\n💳 Nouveau solde : ${data.nouveau_solde} FCFA`
                                );
                                // Rafraîchir la liste
                                // onRefresh?.();
                            } else {
                                const error = await response.json();
                                throw new Error(error.message);
                            }
                        } catch (error: any) {
                            handleAPIError(error, 'Réactivation produit', () => handleReactivateProduct(productId, productIndex));
                        }
                    }
                }
            ]
        );
    };

    const getProductTypeInfo = (type: ProductType) => {
        return PRODUCT_TYPES.find(t => t.value === type) || PRODUCT_TYPES[PRODUCT_TYPES.length - 1];
    };

    // ✅ NOUVEAU 2025-11-01: Rendu simplifié - Formulaires gérés par IA + Autocomplete
    const renderSpecificFields = () => {
        if (!selectedType) return null;

        // Les formulaires détaillés sont maintenant générés dynamiquement par l'IA
        // dans FormulaireYukpoIntelligentScreen avec AutocompleteGranularEditor

        return (
            <View style={styles.formInfoContainer}>
                {/* Message informatif */}
                <View style={styles.infoCard}>
                    <SafeIcon name="sparkles" size={20} color={modernColors.primary} />
                    <Text style={styles.infoCardText}>
                        ✨ <Text style={{ fontWeight: '700' }}>Formulaire intelligent</Text>{'\n'}
                        Les champs spécifiques (marque, modèle, caractéristiques) sont générés
                        automatiquement par l'IA dans le formulaire principal.{'\n\n'}
                        💡 Utilisez ce formulaire pour des modifications rapides.
                    </Text>
                </View>

                {/* Champs de base uniquement */}
                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>
                        Nom du produit <Text style={styles.required}>*</Text>
                    </Text>
                    <NativeInput
                        placeholder={`Ex: ${getProductTypeInfo(selectedType).label}`}
                        value={newProduct.nom || ''}
                        onChangeText={(text) => setNewProduct({ ...newProduct, nom: text })}
                        style={styles.fieldInput}
                    />
                </View>

                <View style={styles.fieldRow}>
                    <View style={[styles.fieldContainer, { flex: 2 }]}>
                        <Text style={styles.fieldLabel}>
                            Prix <Text style={styles.required}>*</Text>
                        </Text>
                        <NativeInput
                            placeholder="Ex: 50000"
                            value={newProduct.prix || ''}
                            onChangeText={(text) => setNewProduct({ ...newProduct, prix: text })}
                            style={styles.fieldInput}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Devise</Text>
                        <View style={styles.deviseContainer}>
                            {['XAF', 'EUR', 'USD'].map((devise) => (
                                <TouchableOpacity
                                    key={devise}
                                    style={[
                                        styles.deviseButton,
                                        (newProduct.devise || 'XAF') === devise && styles.deviseButtonActive
                                    ]}
                                    onPress={() => setNewProduct({ ...newProduct, devise })}
                                >
                                    <Text style={[
                                        styles.deviseButtonText,
                                        (newProduct.devise || 'XAF') === devise && styles.deviseButtonTextActive
                                    ]}>
                                        {devise}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <NativeInput
                        placeholder="Décrivez votre produit en détail..."
                        value={newProduct.description || ''}
                        onChangeText={(text) => setNewProduct({ ...newProduct, description: text })}
                        style={[styles.fieldInput, styles.textArea]}
                        multiline
                        numberOfLines={4}
                    />
                </View>

                {/* Note importante */}
                <View style={styles.warningBox}>
                    <SafeIcon name="info" size={16} color={modernColors.info} />
                    <Text style={styles.warningText}>
                        💡 <Text style={{ fontWeight: '700' }}>Pour des produits détaillés :</Text>{'\n\n'}
                        Créez votre produit via le formulaire principal (bouton ➕) pour
                        bénéficier de l'analyse IA et des champs autocomplete (marque, modèle,
                        couleur, taille, etc.).
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* ✅ NOUVEAU 2025-11-01: État vide avec texte explicatif */}
            {products.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                    <View style={styles.emptyIconContainer}>
                        <SafeIcon name="package" size={64} color={modernColors.textSecondary} />
                    </View>

                    <Text style={styles.emptyTitle}>
                        📦 Créez votre premier produit
                    </Text>

                    <Text style={styles.emptySubtitle}>
                        Pour ajouter un produit à ce service, utilisez le bouton
                        "➕ Ajouter un produit" en haut de l'écran.
                    </Text>

                    <View style={styles.emptyStepsContainer}>
                        <View style={styles.emptyStep}>
                            <Text style={styles.emptyStepNumber}>1️⃣</Text>
                            <Text style={styles.emptyStepText}>
                                Cliquez sur "➕ Ajouter un produit"
                            </Text>
                        </View>

                        <View style={styles.emptyStep}>
                            <Text style={styles.emptyStepNumber}>2️⃣</Text>
                            <Text style={styles.emptyStepText}>
                                Remplissez les informations du produit
                            </Text>
                        </View>

                        <View style={styles.emptyStep}>
                            <Text style={styles.emptyStepNumber}>3️⃣</Text>
                            <Text style={styles.emptyStepText}>
                                Sauvegardez (coût: 3000 FCFA)
                            </Text>
                        </View>
                    </View>

                    <View style={styles.emptyNoteContainer}>
                        <SafeIcon name="info" size={16} color={modernColors.info} />
                        <Text style={styles.emptyNoteText}>
                            💡 Vous pouvez également dupliquer un produit existant depuis
                            "Mes Produits" pour gagner du temps.
                        </Text>
                    </View>
                </View>
            ) : (
                <>
                    {/* ✅ NOUVEAU: Bouton configuration livraison transversale */}
                    {!readonly && serviceId && products.filter(p => p.type !== 'prestation_service').length > 0 && (
                        <View style={{ padding: 16, paddingBottom: 8 }}>
                            <NativeButton
                                title="🚚 Configurer livraison pour tous les produits"
                                variant="secondary"
                                onPress={() => {
                                    setConfigProductIndex(-1); // -1 = mode transversal
                                    setShowDeliveryConfigModal(true);
                                }}
                                style={{ backgroundColor: modernColors.success }}
                            />
                        </View>
                    )}
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
                                                    {/* ✅ NOUVEAU 2025-11-01: Badge désactivé */}
                                                    {product.actif === false && (
                                                        <View style={styles.deactivatedBadge}>
                                                            <Text style={styles.deactivatedText}>🔒 Désactivé</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                {!readonly && (
                                                    <View style={styles.productActions}>
                                                        {/* ✅ NOUVEAU 2025-11-01: Boutons selon état du produit */}
                                                        {product.actif === false ? (
                                                            // Produit désactivé → Bouton Réactiver uniquement
                                                            <TouchableOpacity
                                                                style={[styles.actionButton, styles.reactivateButton]}
                                                                onPress={() => {
                                                                    const index = products.findIndex(p => p.id === product.id);
                                                                    handleReactivateProduct(product.id, index);
                                                                }}
                                                            >
                                                                <SafeIcon name="eye" size={16} color="#FFFFFF" />
                                                                <Text style={styles.reactivateText}>Réactiver</Text>
                                                            </TouchableOpacity>
                                                        ) : (
                                                            // Produit actif → Boutons normaux + Désactiver
                                                            <>
                                                                {/* ✅ NOUVEAU: Bouton configuration livraison (uniquement pour produits, pas prestations) */}
                                                                {serviceId && product.type !== 'prestation_service' && (
                                                                    <TouchableOpacity
                                                                        style={styles.actionButton}
                                                                        onPress={() => {
                                                                            const index = products.findIndex(p => p.id === product.id);
                                                                            setConfigProductIndex(index);
                                                                            setShowDeliveryConfigModal(true);
                                                                        }}
                                                                    >
                                                                        <SafeIcon name="truck" size={16} color={modernColors.success} />
                                                                    </TouchableOpacity>
                                                                )}
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
                                                                <TouchableOpacity
                                                                    style={styles.actionButton}
                                                                    onPress={() => {
                                                                        const index = products.findIndex(p => p.id === product.id);
                                                                        handleDeactivateProduct(product.id, index);
                                                                    }}
                                                                >
                                                                    <SafeIcon name="eye-off" size={16} color={modernColors.warning} />
                                                                </TouchableOpacity>
                                                            </>
                                                        )}
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
                </>
            )}

            {/* Bouton d'ajout de produit */}
            {!readonly && (
                <View style={styles.buttonsContainer}>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => {
                            // ✅ CORRECTION: Navigation vers AjouterProduitSimpleScreen (formulaire dédié ajout produit)
                            console.log('[ProductManagerMobile] Navigation vers AjouterProduitSimple pour ajouter un produit');
                            (navigation as any).navigate('AjouterProduitSimple', {
                                serviceId: serviceId,
                                suggestionIA: {
                                    data: serviceData || {}
                                },
                                mode: 'create'
                            });
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

            {/* Modal de duplication de produit */}
            <ProductDuplicationModal
                visible={showDuplicationModal}
                onClose={handleCancelDuplication}
                product={productToDuplicate}
                onDuplicate={handleConfirmDuplication}
            />

            {/* ✅ Modal configuration livraison */}
            {serviceId && configProductIndex !== null && (
                <ProductDeliveryConfigModal
                    visible={showDeliveryConfigModal}
                    onClose={() => {
                        setShowDeliveryConfigModal(false);
                        setConfigProductIndex(null);
                    }}
                    serviceId={serviceId}
                    productIndex={configProductIndex}
                    productName={
                        configProductIndex === -1
                            ? 'Tous les produits'
                            : (products[configProductIndex]?.nom || 'Produit')
                    }
                    allProducts={
                        configProductIndex === -1 && Array.isArray(products) && products.length > 0
                            ? products
                                .map((p, idx) => ({ index: idx, name: p?.nom || 'Produit' }))
                                .filter((_, idx) => products[idx]?.type !== 'prestation_service')
                            : []
                    }
                    onSuccess={() => {
                        Alert.alert(
                            'Succès',
                            configProductIndex === -1
                                ? 'La configuration de livraison a été appliquée à tous les produits'
                                : 'La configuration de livraison a été enregistrée avec succès'
                        );
                    }}
                />
            )}
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
        fontSize: 16, // ✅ COMPACT : Réduit de 18 à 16
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6, // ✅ COMPACT : Réduit de 8 à 6
    },
    sectionSubtitle: {
        fontSize: 12, // ✅ COMPACT : Réduit de 14 à 12
        color: modernColors.textSecondary,
        marginBottom: 12, // ✅ COMPACT : Réduit de 16 à 12
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
    // ✨ NOUVEAU: Styles pour les suggestions intelligentes
    suggestionsBlock: {
        backgroundColor: '#F0F9FF',
        borderBottomWidth: 2,
        borderBottomColor: modernColors.primary,
        padding: 12,
    },
    suggestionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    suggestionsTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.primary,
    },
    suggestionsSubtitle: {
        fontSize: 10,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    suggestedItem: {
        backgroundColor: '#FFFFFF',
        marginBottom: 8,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: modernColors.primary,
        shadowColor: modernColors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    suggestedBadge: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestedLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 2,
    },
    suggestedLabel: {
        fontWeight: '600',
        flex: 0,
    },
    scoreChip: {
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    scoreText: {
        fontSize: 9,
        fontWeight: '700',
        color: modernColors.primary,
    },
    suggestionsDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 4,
    },
    suggestionsDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: modernColors.border,
    },
    suggestionsDividerText: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginHorizontal: 12,
        textTransform: 'uppercase',
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
    lockedCategoryHint: {
        fontSize: 10,
        fontWeight: '500',
        color: modernColors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
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
        marginBottom: 10, // ✅ COMPACT : Réduit de 12 à 10 pour économiser l'espace
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12, // ✅ COMPACT : Réduit de 16 à 12
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6, // ✅ COMPACT : Réduit de 8 à 6
    },
    required: {
        color: modernColors.error,
    },
    autoFilledHint: {
        fontSize: 10, // ✅ COMPACT : Réduit de 11 à 10 pour hints plus petits
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
        padding: 8, // ✅ COMPACT : Réduit de 12 à 8
        marginTop: 8, // ✅ COMPACT : Réduit de 12 à 8
        borderLeftWidth: 4,
        borderLeftColor: modernColors.primary,
    },
    hintText: {
        fontSize: 10, // ✅ COMPACT : Réduit de 12 à 10 pour description plus petite
        color: modernColors.text,
        lineHeight: 14, // ✅ COMPACT : Réduit de 16 à 14
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
        fontSize: 10, // ✅ COMPACT : Réduit de 11 à 10 pour hints plus petits
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
    regeneratePlanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 10,
        marginTop: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderRadius: 8,
    },
    regeneratePlanText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    busLoadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        marginTop: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: modernColors.border,
    },
    busLoadingText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 12,
    },
    busLoadingHint: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
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
    // ✅ NOUVEAU: Style pour bouton "Sélectionner tous les jours"
    selectAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        marginTop: 8,
        marginBottom: 12,
    },
    selectAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    selectAllTextActive: {
        color: modernColors.primary,
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
        minWidth: 60, // ✅ NOUVEAU: Largeur minimale pour éviter le texte coupé
        paddingHorizontal: 14, // ✅ Augmenté pour plus d'espace
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
        fontSize: 10, // ✅ COMPACT : Réduit de 12 à 10 pour descriptions plus petites
        color: '#6B7280',
        marginTop: 3, // ✅ COMPACT : Réduit de 4 à 3
        fontStyle: 'italic',
    },
    hintBold: {
        fontSize: 10, // ✅ COMPACT : Réduit de 12 à 10
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
    boldText: {
        fontWeight: '700',
        color: '#1E40AF',
    },

    // Styles Immobilier
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8, // ✅ COMPACT : Réduit de 10 à 8
        marginTop: 16, // ✅ COMPACT : Réduit de 20 à 16
        marginBottom: 10, // ✅ COMPACT : Réduit de 12 à 10
        paddingBottom: 6, // ✅ COMPACT : Réduit de 8 à 6
        borderBottomWidth: 2,
        borderBottomColor: modernColors.primary,
    },
    sectionTitle: {
        fontSize: 15, // ✅ COMPACT : Réduit de 16 à 15
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
    toggleHint: {
        fontSize: 10, // ✅ COMPACT : Réduit de 11 à 10 pour hints plus petits
        color: modernColors.textSecondary,
        marginTop: 3, // ✅ COMPACT : Réduit de 4 à 3
        marginLeft: 32,
        fontStyle: 'italic',
    },
    fieldHint: {
        fontSize: 10, // ✅ COMPACT : Réduit de 11 à 10 pour hints plus petits
        color: modernColors.textSecondary,
        marginTop: 3, // ✅ COMPACT : Réduit de 4 à 3
        fontStyle: 'italic',
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
    // ✅ NOUVEAU 2025-11-01: Styles pour formulaire simplifié
    formInfoContainer: {
        padding: 16,
        gap: 16,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
        marginTop: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        color: '#92400E',
        lineHeight: 20,
    },
    deviseContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    deviseButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.border,
        borderRadius: 8,
        alignItems: 'center',
    },
    deviseButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    deviseButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    deviseButtonTextActive: {
        color: '#FFFFFF',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
        paddingTop: 12,
    },
    // ✅ NOUVEAU 2025-11-01: Styles état vide
    emptyStateContainer: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        margin: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
        paddingHorizontal: 16,
    },
    emptyStepsContainer: {
        width: '100%',
        gap: 12,
        marginBottom: 20,
    },
    emptyStep: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        gap: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    emptyStepNumber: {
        fontSize: 20,
    },
    emptyStepText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
        lineHeight: 18,
    },
    emptyNoteContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    emptyNoteText: {
        flex: 1,
        fontSize: 12,
        color: '#1E40AF',
        lineHeight: 16,
    },
    // ✅ NOUVEAU 2025-11-01: Styles désactivation/réactivation (Objectifs #5 et #6)
    deactivatedBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    deactivatedText: {
        fontSize: 11,
        color: '#92400E',
        fontWeight: '600',
    },
    reactivateButton: {
        backgroundColor: modernColors.success,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    reactivateText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
});

export default ProductManagerMobile;











